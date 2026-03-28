---
tags: []
type: runbook
severity: sev3
technology: gcp, airflow, sql-server
status: stable
updated: 2026-03-23
---

# Vendor File Late or Missing

> **Trigger**: A data vendor has not delivered by the expected SLA
> **Severity**: Sev3 (escalates to Sev2 if publication deadline is < 2 hours away)
> **SLA**: Acknowledge within 30 min; resolve or invoke fallback before publication deadline
> **Owner**: On-call data engineer

---

## Staleness Thresholds

These thresholds are derived from the [[data-sources-and-refresh|data source refresh schedule]]. Confirm the current SLAs match your vendor contracts before escalating.

| Data Type | Normal SLA | Warn | Critical | Fallback Action |
|---|---|---|---|---|
| Market prices | T+0 18:00 UTC | +1 hr (19:00) | +4 hr (22:00) | Use backup feed or T-1 close |
| ESG scores | Monday 08:00 UTC | +1 business day | +3 business days | Use prior week's scores |
| Corporate actions | T-1 06:00 UTC | +6 hr (12:00) | +24 hr | Manual sourcing from exchange |
| Index constituents | T-1 12:00 UTC | +4 hr | +12 hr | Use prior day's membership |
| Reference data | Weekly Sunday 22:00 UTC | +2 hr | +12 hr | Use last known good snapshot |

> [!note] Severity upgrade trigger
> If the critical threshold is breached **and** the index publication window opens in less than 2 hours, escalate to Sev2 and pull in the Index Operations lead.

---

## Symptoms

- GCS landing zone has no file for today's expected delivery slot
- Airflow sensor task timed out (default: 6 hours) waiting for the file
- Datadog alert fires: `data.vendor.freshness` exceeds the warn threshold for `<vendor_name>/<data_type>`
- Pipeline is stuck at the ingestion step; all downstream tasks are blocked
- Email or portal notification from vendor indicating a delay

---

## Diagnosis

### Step 1 — Check the landing zone directly

```bash
# Check today's expected delivery path
gcloud storage ls "gs://landing-zone/prices/$(date +%Y/%m/%d)/" --recursive

# Check with a broader date window in case the file arrived with a different date prefix
gcloud storage ls "gs://landing-zone/prices/" --recursive \
  | grep "$(date +%Y-%m-%d)"

# Check for yesterday's file (to confirm T-1 data is present as a fallback baseline)
gcloud storage ls "gs://landing-zone/prices/$(date -d 'yesterday' +%Y/%m/%d)/" --recursive
```

Check vendor-specific landing paths (adjust per your vendor naming conventions):

```bash
# Vendor A — market prices
gcloud storage ls "gs://landing-zone/vendor-a/market-data/$(date +%Y%m%d)/" --recursive

# Vendor B — ESG scores (weekly; check Monday's delivery)
gcloud storage ls "gs://landing-zone/vendor-b/esg/$(date +%Y/%V)/" --recursive

# Vendor C — corporate actions
gcloud storage ls "gs://landing-zone/vendor-c/corporate-actions/$(date +%Y/%m/%d)/" --recursive

# Search for any file matching today's date stamp across all vendor prefixes
gcloud storage ls "gs://landing-zone/" --recursive \
  | grep "$(date +%Y%m%d)"
```

### Step 2 — Check for files with wrong name or path pattern

Vendors occasionally send files with an incorrect date stamp, an extra suffix, or to a wrong sub-folder.

```bash
# List everything that arrived in the landing zone in the last 24 hours
# GCS does not support --modified-after natively; use gsutil stat or filter by name
gcloud storage ls "gs://landing-zone/" --recursive \
  | grep -E "$(date +%Y%m%d)|$(date +%Y-%m-%d)|$(date +%Y/%m/%d)"

# Check the top-level for accidentally dropped files (missing the date subfolder)
gcloud storage ls "gs://landing-zone/prices/"

# If a file is found with a wrong name, move it to the expected location
# so the Airflow sensor can pick it up
gcloud storage mv \
  "gs://landing-zone/prices/<wrong_filename>.csv" \
  "gs://landing-zone/prices/$(date +%Y/%m/%d)/<expected_filename>.csv"
```

### Step 3 — Check Airflow sensor and ingestion task logs

```bash
# View the file-sensor task log for today's ingestion DAG
airflow tasks logs ingest_prices wait_for_vendor_file $(date +%Y-%m-%d)

# View the parse-and-load task log if the sensor passed but loading failed
airflow tasks logs ingest_prices parse_and_load $(date +%Y-%m-%d)

# List recent runs of the ingestion DAG to see their state
airflow dags list-runs --dag-id ingest_prices --limit 10

# Check if the sensor is still polling (state = running) or already failed
airflow tasks state ingest_prices wait_for_vendor_file $(date +%Y-%m-%d)
```

### Step 4 — Check pipeline_lineage for today's ingestion status

```sql
-- SQL Server: has today's ingestion pipeline started or completed?
SELECT
    run_id,
    pipeline_name,
    run_date,
    input_source,
    status,
    error_message,
    started_at,
    finished_at
FROM dbo.pipeline_lineage
WHERE run_date = CAST(GETUTCDATE() AS DATE)
  AND pipeline_name LIKE '%ingest%'
ORDER BY started_at DESC;
```

### Step 5 — Check vendor status

- Check the vendor's status page or support portal (URL should be in your team's runbook annex or password manager)
- Check whether a notification email arrived in the vendor-alerts mailbox
- Check if other teams (quant, sales) have also received a delay notice

---

## Resolution

### Scenario A — File arrived with wrong name or path

```bash
# Rename and move to the correct location
gcloud storage mv \
  "gs://landing-zone/<wrong_path>/<wrong_filename>" \
  "gs://landing-zone/<correct_path>/<expected_filename>"

# Confirm the file is now visible at the expected path
gcloud storage ls "gs://landing-zone/<correct_path>/<expected_filename>"

# Retrigger the failed Airflow task (the sensor should pick up the file on next poke)
airflow tasks clear ingest_prices wait_for_vendor_file \
  --start-date $(date +%Y-%m-%d) \
  --end-date $(date +%Y-%m-%d) \
  --yes

# Or retrigger the whole DAG run
airflow dags trigger ingest_prices \
  --conf '{"run_date": "'"$(date +%Y-%m-%d)"'", "reason": "file_renamed_and_moved"}'
```

### Scenario B — Vendor confirms delay with an ETA within the publication window

```bash
# Check how much time remains before the publication deadline
# Note the publication window for your index schedule (e.g., 23:00 UTC for end-of-day)
echo "Current UTC time: $(date -u +%H:%M)"
echo "Publication deadline: 23:00 UTC"

# Set an Airflow variable to extend the sensor timeout (see [[airflow-dag-patterns]] for the sensor timeout pattern)
airflow variables set vendor_a_sensor_timeout_hours 10

# Monitor until file arrives
watch -n 60 'gcloud storage ls "gs://landing-zone/prices/$(date +%Y/%m/%d)/" --recursive'
```

Document the delay in the audit trail:

```sql
INSERT INTO dbo.pipeline_lineage (
    run_id, pipeline_name, run_date, input_source,
    status, error_message, started_at, finished_at, notes
)
VALUES (
    NEWID(),
    'ingest_prices_vendor_delay',
    CAST(GETUTCDATE() AS DATE),
    'vendor_a — delayed delivery',
    'waiting',
    'Vendor confirmed delay. ETA: <HH:MM> UTC. SLA breach: YES/NO.',
    GETUTCDATE(),
    NULL,
    'Delay logged by <engineer_id> at <HH:MM> UTC. Ticket: <TICKET_ID>.'
);
```

### Scenario C — SLA breached and publication deadline is approaching — use T-1 fallback

> [!warning] Fallback decision gate
> Only invoke the T-1 fallback if: (a) the vendor has not confirmed an ETA within the publication window, OR (b) the critical staleness threshold has been crossed. Record the decision.

**Sub-step C1 — Copy T-1 prices as today's fallback prices**

```sql
BEGIN TRANSACTION;

-- Insert yesterday's prices as today's, tagged as fallback
INSERT INTO dbo.prices_staging (
    instrument_isin,
    price_date,
    close_price,
    open_price,
    high_price,
    low_price,
    volume,
    is_fallback,
    fallback_source_date,
    loaded_at,
    loaded_by,
    ticket_id
)
SELECT
    instrument_isin,
    CAST(GETUTCDATE() AS DATE)     AS price_date,   -- today
    close_price,
    open_price,
    high_price,
    low_price,
    volume,
    1                              AS is_fallback,
    CAST(GETUTCDATE() AS DATE) - 1 AS fallback_source_date,
    GETUTCDATE()                   AS loaded_at,
    '<engineer_id>'                AS loaded_by,
    '<TICKET_ID>'                  AS ticket_id
FROM dbo.prices_staging
WHERE price_date = CAST(GETUTCDATE() AS DATE) - 1
  AND instrument_isin IN (
      SELECT DISTINCT instrument_isin
      FROM dbo.index_constituents_gold
      WHERE index_code IN ('<INDEX_CODE_1>', '<INDEX_CODE_2>')
        AND price_date = CAST(GETUTCDATE() AS DATE) - 1
  );

SELECT @@ROWCOUNT AS fallback_rows_inserted;

-- Spot-check: a few rows
SELECT TOP 5 instrument_isin, price_date, close_price, is_fallback
FROM dbo.prices_staging
WHERE price_date = CAST(GETUTCDATE() AS DATE)
  AND is_fallback = 1;

COMMIT TRANSACTION;
```

**Sub-step C2 — Flag affected indices as "preliminary" in publication metadata**

```sql
-- Mark today's publication run as preliminary (not final)
UPDATE dbo.publication_metadata
SET
    publication_status = 'preliminary',
    status_reason      = 'Vendor data unavailable. T-1 fallback prices used. Will be restated when vendor delivers.',
    updated_at         = GETUTCDATE(),
    updated_by         = '<engineer_id>'
WHERE index_code IN ('<INDEX_CODE_1>', '<INDEX_CODE_2>')
  AND price_date = CAST(GETUTCDATE() AS DATE);

-- Insert a lineage record for the fallback decision
INSERT INTO dbo.pipeline_lineage (
    run_id, pipeline_name, run_date, input_source,
    status, error_message, started_at, finished_at, notes
)
VALUES (
    NEWID(),
    'ingest_prices_t1_fallback',
    CAST(GETUTCDATE() AS DATE),
    'T-1 fallback — vendor_a delivery missed SLA',
    'completed_with_fallback',
    NULL,
    GETUTCDATE(),
    GETUTCDATE(),
    'T-1 fallback applied by <engineer_id>. Ticket: <TICKET_ID>. Vendor: <vendor_name>.'
);
```

**Sub-step C3 — Proceed with preliminary publication**

```bash
# Trigger the index calculation and publication pipelines using the fallback data
airflow dags trigger index_publication_<INDEX_CODE> \
  --conf '{
    "run_date": "'"$(date +%Y-%m-%d)"'",
    "price_source": "t1_fallback",
    "publication_status": "preliminary",
    "ticket_id": "<TICKET_ID>"
  }'
```

**Sub-step C4 — When the vendor file eventually arrives: ingest, recalculate, and publish corrected values**

```bash
# Confirm the vendor file has arrived
gcloud storage ls "gs://landing-zone/prices/$(date +%Y/%m/%d)/" --recursive

# Ingest the late file
airflow dags trigger ingest_prices \
  --conf '{
    "run_date": "'"$(date +%Y-%m-%d)"'",
    "file_path": "gs://landing-zone/prices/<YYYY>/<MM>/<DD>/<filename>.csv",
    "reason": "late_vendor_delivery_replacing_fallback"
  }'

# After ingestion completes, retrigger publication to replace preliminary values
airflow dags trigger index_publication_<INDEX_CODE> \
  --conf '{
    "run_date": "'"$(date +%Y-%m-%d)"'",
    "price_source": "vendor_actual",
    "publication_status": "final",
    "ticket_id": "<TICKET_ID>"
  }'
```

```sql
-- Update publication metadata to final once corrected values are published
UPDATE dbo.publication_metadata
SET
    publication_status = 'final',
    status_reason      = 'Vendor file received and ingested. Preliminary values replaced with final values.',
    updated_at         = GETUTCDATE(),
    updated_by         = '<engineer_id>'
WHERE index_code IN ('<INDEX_CODE_1>', '<INDEX_CODE_2>')
  AND price_date = CAST(GETUTCDATE() AS DATE);
```

---

## Vendor Escalation

If the vendor has not responded within 1 hour of first contact, or if the SLA is definitively breached, send a formal escalation email.

#### Vendor escalation email template — SLA breach notification

```
To: <vendor_support_email>, <vendor_account_manager>
CC: <your_vendor_relationship_manager>
Subject: [SLA BREACH] <Data Type> delivery for <YYYY-MM-DD> — <Vendor Name>

Dear <Vendor Name> Support Team,

We have not received the <data_type> file for <YYYY-MM-DD>.

Expected delivery: <HH:MM> UTC per our contract (clause <X.Y>)
Current time: <HH:MM> UTC
Time overdue: <N> hours <M> minutes

Business impact: Index publication for <INDEX_CODE_LIST> is delayed or
relying on T-1 fallback data. This affects downstream clients and
regulatory reporting obligations.

Please provide:
  1. Root cause of the delay
  2. Confirmed ETA for file delivery
  3. Incident reference number from your side

If delivery cannot be confirmed within 30 minutes, we will formally log
this as an SLA breach under our data service agreement (ref: <CONTRACT_REF>).

Regards,
<Your name>
<Your team>
<Contact number>
```

---

## Post-Incident Checklist

- [ ] Root cause confirmed (vendor-side delay, wrong file name, network issue, etc.)
- [ ] `dbo.pipeline_lineage` updated with final status and notes
- [ ] If fallback was used: `dbo.publication_metadata.publication_status` set to `'final'` once corrected data published
- [ ] Vendor SLA breach formally logged in the contract management system
- [ ] If preliminary values were published: clients notified of correction (see [[data-restatement-procedure]])
- [ ] Monitoring rule reviewed — was the Datadog alert threshold appropriate?
- [ ] Airflow sensor timeout reviewed — is the current timeout too long for the publication deadline?
- [ ] Vendor escalation email sent and response received (file it in the incident ticket)
- [ ] PIR scheduled if this is a recurring pattern or if SLA breach exceeds 4 hours

---

## Related

- [[data-restatement-procedure]]
- [[corporate-action-missed]]
- [[compliance-and-auditability]]
- [[on-call-guide]]
- [[runbooks-index]]
