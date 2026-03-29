---
tags: [bigquery, runbook, incident]
type: runbook
severity: sev2
technology: bigquery
status: stable
updated: 2026-03-23
---

# BigQuery Quota Exceeded

> **Trigger**: BigQuery concurrent query slots exhausted or on-demand billing spike
> **Severity**: Sev2 | **SLA**: 1 hr acknowledge, 4 hr resolve
> **Owner**: On-call data engineer
> **Paging**: Cloud Monitoring alert `bigquery-quota-exceeded` or billing budget alert `bq-daily-spend-2x`

---

### Symptoms — BigQuery quota or cost spike indicators

- **Queries queuing or timing out**: dbt runs exceed 10-minute timeout; analysts report stale dashboards
- **Cloud Monitoring alert**: `bigquery/query/count` spike above baseline (typically > 3x rolling average)
- **User-visible error** in BigQuery console or API:
  ```
  Resources exceeded during query execution: Not enough resources for query planning - too many subqueries or query is too complex.
  Quota exceeded: Your project exceeded quota for queries per user per minute.
  ```
- **Billing alert**: daily spend > 2x 30-day average, triggering budget notification from Cloud Billing
- **Datadog**: `custom.bigquery.bytes_billed` metric spiking; dashboard shows `slot_utilization > 95%`
- **Airflow DAG failures**: BigQueryExecuteQueryOperator tasks failing with `HttpError 403` or `503 Service Unavailable`
- Looker Studio / Connected Sheets dashboards showing loading spinners with no data

> [!warning] Cost impact
> On-demand BigQuery pricing is $6.25/TiB bytes billed. A single unpartitioned full-table scan of a multi-TB ESG history table can generate hundreds of dollars in a single query. Do not dismiss this as a soft quota issue — identify and cancel the runaway job within the first 15 minutes.

---

## Diagnosis

### Step 1 — List currently running jobs

```bash
bq ls --jobs --max_results=30 --all_users --format=prettyjson \
  | jq '.[] | {jobId: .jobReference.jobId, user: .user_email, state: .status.state, created: .statistics.creationTime}'
```

Alternatively, using `bq ls -j` shorthand:

```bash
bq ls -j --max_results=20 --format=prettyjson
```

Note any jobs in state `RUNNING` with long elapsed time.

### Step 2 — Identify expensive queries by bytes scanned (last 24 hours)

```sql
-- Run in BigQuery console or via bq query
SELECT
    job_id,
    user_email,
    ROUND(total_bytes_processed / POW(1024, 4), 3)  AS tib_scanned,
    ROUND(total_bytes_billed   / POW(1024, 4), 3)  AS tib_billed,
    ROUND(total_slot_ms / 1000 / 60, 1)            AS slot_minutes,
    TIMESTAMP_DIFF(end_time, start_time, SECOND)    AS duration_sec,
    state,
    SUBSTR(query, 1, 300)                           AS query_snippet
FROM `region-europe-west1`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
    AND job_type = 'QUERY'
ORDER BY total_bytes_billed DESC
LIMIT 20;
```

> [!tip] Region matters
> `INFORMATION_SCHEMA.JOBS_BY_PROJECT` is region-specific. If your dataset is in `EU` multi-region, use `region-eu`. For US multi-region, use `region-us`. Adjust the `region-` prefix to match your project's primary location.

### Step 3 — Check slot utilization over time

```sql
SELECT
    period_start,
    period_slot_ms,
    ROUND(period_slot_ms / 1000.0 / 60.0, 1)  AS slot_minutes
FROM `region-europe-west1`.INFORMATION_SCHEMA.JOBS_TIMELINE_BY_PROJECT
WHERE period_start > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 HOUR)
ORDER BY period_slot_ms DESC
LIMIT 20;
```

If slot minutes are consistently near your reservation limit, you have a slot exhaustion issue, not a query bug. If slot minutes are normal but costs are spiking, you have one or more runaway full-table-scan jobs.

### Step 4 — Check for runaway scheduled queries

```bash
# List all scheduled queries (Data Transfer Service)
bq ls --transfer_config --transfer_location=europe-west1 --format=prettyjson \
  | jq '.[] | {displayName: .displayName, state: .state, scheduleOptions: .scheduleOptions}'
```

Look for scheduled queries that have recently started running more frequently than expected, or that have `state: RUNNING` when they should be idle.

Check transfer run history for recent failures that may have triggered retries:

```bash
bq ls --transfer_run \
  --transfer_location=europe-west1 \
  --run_attempt=LATEST \
  --max_results=20 \
  --format=prettyjson \
  "projects/YOUR_PROJECT_ID/locations/europe-west1/transferConfigs/YOUR_CONFIG_ID" \
  | jq '.[] | {runTime: .runTime, state: .state, errorStatus: .errorStatus}'
```

### Step 5 — Check for full-table scans on unpartitioned tables

```sql
-- Queries that scanned more than 100 GB and did not use partition pruning
SELECT
    job_id,
    user_email,
    ROUND(total_bytes_processed / POW(1024, 3), 1) AS gb_scanned,
    referenced_tables,
    SUBSTR(query, 1, 400)                           AS query_snippet
FROM `region-europe-west1`.INFORMATION_SCHEMA.JOBS_BY_PROJECT,
    UNNEST(referenced_tables) AS referenced_tables
WHERE creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
    AND total_bytes_processed > 100 * POW(1024, 3)
    AND job_type = 'QUERY'
ORDER BY total_bytes_processed DESC
LIMIT 20;
```

Cross-reference the `referenced_tables` with your data catalog to confirm whether the table is partitioned and whether the query includes a partition filter.

---

## Resolution

### RC-1: Cancel a Runaway Job

```bash
# Get the job ID from Step 1 or Step 2 output
JOB_ID="bqjob_r1234567890abcdef_0000018abc123456_1"

bq cancel "${JOB_ID}"
```

Confirm cancellation:

```bash
bq show --job "${JOB_ID}" | grep -E "State|Bytes"
```

State should change to `FAILURE` with error reason `Cancelled by user`.

### RC-2: Cancel All Running Jobs From a Specific User

Use this when a single analyst or service account has launched a flood of expensive queries:

```bash
TARGET_USER="analyst@example.com"

# List all running jobs from that user and extract job IDs
RUNNING_JOB_IDS=$(bq ls --jobs --all_users --max_results=100 --format=prettyjson \
  | jq -r --arg u "${TARGET_USER}" \
    '.[] | select(.user_email == $u and .status.state == "RUNNING") | .jobReference.jobId')

# Cancel each
for JOB_ID in ${RUNNING_JOB_IDS}; do
    echo "Cancelling ${JOB_ID}"
    bq cancel "${JOB_ID}"
done
```

### RC-3: Set a Per-User Daily Byte Quota (Emergency Throttle)

This limits how many bytes a user or service account can scan per day. It takes effect immediately for subsequent queries.

```bash
# Set a 1 TiB per-day quota for a specific user
gcloud alpha services quota update \
  --service=bigquery.googleapis.com \
  --consumer="project:YOUR_PROJECT_ID" \
  --metric=bigquery.googleapis.com/quota/query/free_tier_query_bytes_per_day \
  --unit=1~d \
  --value=1099511627776   # 1 TiB in bytes
```

For more precise user-level control, set `maximum_bytes_billed` at the query level in your dbt profile (`profiles.yml`). See [[querying-and-cost-optimization]] for broader BigQuery cost-control techniques including partition pruning, clustering, and BI Engine reservations:

```yaml
# profiles.yml — add to BigQuery target
your_project:
  outputs:
    prod:
      type: bigquery
      method: oauth
      project: your-gcp-project
      dataset: analytics
      location: EU
      maximum_bytes_billed: 107374182400  # 100 GiB — queries exceeding this will fail fast
      timeout_seconds: 300
      threads: 4
```

### RC-4: Switch to Flat-Rate Slot Reservation (Emergency Capacity Add)

If legitimate workloads are being throttled due to slot exhaustion during a market event (e.g., index rebalancing day with high ESG recalculation load), consider whether [[dbt-performance-tuning|dbt model optimization]] can reduce slot consumption before purchasing additional capacity:

```bash
# Purchase a 100-slot commitment for the duration (FLEX — by-the-minute billing)
gcloud alpha bigquery reservations commitments create \
  --project=YOUR_PROJECT_ID \
  --location=europe-west1 \
  --slots=100 \
  --plan=FLEX

# Create a reservation to hold those slots
gcloud alpha bigquery reservations create high-priority-burst \
  --project=YOUR_PROJECT_ID \
  --location=europe-west1 \
  --slots=100

# Assign your project to the reservation
gcloud alpha bigquery reservations assignments create \
  --project=YOUR_PROJECT_ID \
  --location=europe-west1 \
  --reservation=high-priority-burst \
  --job_type=QUERY \
  --assignee_type=PROJECT \
  --assignee_id=YOUR_PROJECT_ID
```

> [!warning] FLEX commitment billing
> FLEX commitments bill by the minute with a 60-second minimum. Delete the commitment as soon as the workload completes to avoid unnecessary charges.

Delete the commitment after the incident:

```bash
gcloud alpha bigquery reservations commitments delete COMMITMENT_ID \
  --project=YOUR_PROJECT_ID \
  --location=europe-west1
```

### RC-5: Force Partition Pruning on a Runaway Query

If a specific scheduled query is performing a full-table scan, patch it to include an explicit partition filter:

```sql
-- Before (full-table scan, scans all history):
SELECT isin, esg_score, score_date
FROM `your_project.analytics.esg_scores`
WHERE esg_score > 80;

-- After (partition-pruned, scans only current month):
SELECT isin, esg_score, score_date
FROM `your_project.analytics.esg_scores`
WHERE score_date >= DATE_TRUNC(CURRENT_DATE(), MONTH)
  AND esg_score > 80;
```

Enable `require_partition_filter` on tables to enforce this at the table level:

```bash
bq update \
  --require_partition_filter \
  your_project:analytics.esg_scores
```

After enabling, any query without a partition filter will immediately return an error rather than scanning the full table, protecting against accidental cost spikes.

### RC-6: Acknowledge Unrecoverable Cost — Billing Alert Triage

If the cost spike has already occurred and cannot be reversed:

```bash
# Export the JOBS table for the billing period to understand the breakdown
bq extract \
  --destination_format=CSV \
  'region-europe-west1.INFORMATION_SCHEMA.JOBS_BY_PROJECT' \
  gs://your-archive-bucket/bq-audit/jobs-$(date +%Y%m%d).csv
```

File a billing credit request via GCP Support if the spike was caused by a platform anomaly (e.g., cached query results not being served correctly). Attach the job IDs and bytes-billed data.

---

### Verification — confirm BigQuery quota resolved

After resolution, confirm the incident is cleared:

```bash
# 1. Check no jobs are currently queued or running with high bytes
bq ls -j --max_results=20 --format=prettyjson | jq '.[] | select(.status.state == "RUNNING")'

# 2. Verify slot utilization has dropped (run in BQ console)
# SELECT MAX(period_slot_ms) FROM `region-europe-west1`.INFORMATION_SCHEMA.JOBS_TIMELINE_BY_PROJECT
# WHERE period_start > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 MINUTE)

# 3. Confirm billing alert has auto-resolved in Cloud Billing console
# Navigate to: Billing > Budgets & alerts > check alert status

# 4. Re-run a representative dbt model to confirm queries complete successfully
dbt run --select marts.index_constituents --target prod
```

---

### Escalation — BigQuery quota incident

| Condition | Action |
|-----------|--------|
| Slot exhaustion during index rebalancing window (market hours) | Escalate to data lead; purchase FLEX slots (RC-4) |
| Daily spend > 5x average with no identifiable cause | Escalate to GCP TAM; open P1 support case |
| Scheduled query flood (> 50 concurrent jobs from one source) | Pause the scheduled query config immediately; page pipeline owner |
| Billing alert cannot be silenced (false positive) | Notify finops lead; update budget threshold in Cloud Billing |

---

### Post-incident — BigQuery quota checklist

- [ ] Send resolution notice to #data-engineering-incidents with job IDs and bytes-billed summary
- [ ] Confirm all stale dashboards and Looker reports have refreshed with current data
- [ ] Validate ESG score and index constituent figures for any calculation windows that overlapped with the outage
- [ ] Schedule PIR within 48 hours
- [ ] Update dbt `maximum_bytes_billed` if not yet set
- [ ] Add `require_partition_filter` to any tables identified as full-table-scan targets
- [ ] Review scheduled query configurations for missing partition filters

---

### Long-term prevention — BigQuery cost control

| Action | Owner | Priority |
|--------|-------|----------|
| Set `maximum_bytes_billed` in all dbt targets | Data Eng | Critical |
| Enable `require_partition_filter` on all tables > 10 GB | Data Eng | High |
| Partition all analytics tables by date column | Data Eng | High |
| Add Cloud Monitoring alert at 1.5x daily spend (warning) | Infra | High |
| Implement per-user slot quotas for analyst service accounts | Infra | Medium |
| Schedule weekly INFORMATION_SCHEMA cost report to #data-engineering | Data Eng | Medium |
| Evaluate committed-use slot reservations for baseline workload | Data Lead | Medium |

---

## Related

- [[on-call-guide]]
- [[runbooks-index]]
- [[dataset-and-table-management|partitioning strategy]]
- [[dbt-project-structure|profiles configuration]]
- [[airflow-scheduler-down]]
- [[gcp-cost-monitoring-and-budgets|cost management]]
