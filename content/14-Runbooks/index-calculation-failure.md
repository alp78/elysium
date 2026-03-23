---
tags: [runbook, airflow, sql-server, bigquery]
type: runbook
severity: sev1
technology: airflow
status: stable
updated: 2026-03-23
---

# Index Calculation Failure

> **Trigger**: Daily index calculation pipeline fails before the publication window
> **Severity**: Sev1 | **SLA**: 15 min acknowledge, resolve before publication deadline
> **Owner**: On-call data engineer

## Symptoms

- Airflow DAG `index_daily_calculation` shows failed or stuck tasks
- Datadog alert: `index.calc.completed` metric missing for today
- No new rows in `dbo.index_levels_daily` or `analytics.index_levels_daily` for today's date
- Client-facing API returns yesterday's values

## Diagnosis

1. **Check Airflow DAG status**
   ```bash
   # SSH to Airflow VM
   gcloud compute ssh airflow-vm --zone=europe-west1-b --tunnel-through-iap
   
   # Check DAG run status
   docker exec airflow-scheduler airflow dags list-runs -d index_daily_calculation --limit 5
   
   # Check failed tasks
   docker exec airflow-scheduler airflow tasks states-for-dag-run index_daily_calculation $(date +%Y-%m-%d)
   ```

2. **Check SQL Server connectivity**
   ```bash
   gcloud compute ssh sql-vm --zone=europe-west1-b --tunnel-through-iap
   sqlcmd -S localhost -U sa -Q "SELECT GETDATE() AS server_time, @@VERSION AS version"
   
   # Check if database is accessible
   sqlcmd -S localhost -U sa -Q "SELECT name, state_desc FROM sys.databases WHERE name = 'analytics_db'"
   ```

3. **Check data completeness (are input prices available?)**
   ```sql
   -- SQL Server: check today's price data landed
   SELECT COUNT(*) AS price_count,
          MIN(price_date) AS min_date,
          MAX(price_date) AS max_date
   FROM dbo.daily_prices
   WHERE price_date = CAST(GETDATE() AS DATE);
   
   -- Expected: 50 rows for a 50-constituent index
   ```

4. **Check BigQuery job status**
   ```bash
   bq ls -j --max_results=10 --format=prettyjson | jq '.[] | {jobId: .jobReference.jobId, state: .status.state, errorResult: .status.errorResult}'
   ```

5. **Check Cloud Run job execution**
   ```bash
   gcloud run jobs executions list --job=index-calculation --region=europe-west1 --limit=5
   ```

## Resolution

### Root Cause: Airflow task failed (most common)

```bash
# Check task logs
docker exec airflow-scheduler airflow tasks logs index_daily_calculation calculate_levels $(date +%Y-%m-%d)

# Clear and retry the failed task
docker exec airflow-scheduler airflow tasks clear index_daily_calculation -t calculate_levels -s $(date +%Y-%m-%d) -e $(date +%Y-%m-%d) --yes
```

### Root Cause: SQL Server unreachable

```bash
# Check if SQL Server process is running
sudo systemctl status mssql-server

# Restart if needed
sudo systemctl restart mssql-server

# Verify recovery
sqlcmd -S localhost -U sa -Q "SELECT 1"
```

### Root Cause: Input data missing (vendor file not arrived)

Follow [[vendor-file-late-or-missing]] runbook first. If data cannot be obtained in time:

```bash
# Manual override: use T-1 prices for missing instruments
# Document this decision in the pipeline lineage table
sqlcmd -S localhost -U sa -Q "
INSERT INTO dbo.pipeline_lineage (pipeline_name, calc_date, status, error_message)
VALUES ('index_daily_calculation', '$(date +%Y-%m-%d)', 'MANUAL_OVERRIDE',
        'Used T-1 prices for instruments: [LIST]. Vendor file late.')
"
```

### Root Cause: BigQuery quota or billing issue

Follow [[bigquery-quota-exceeded]] runbook.

## Manual Calculation Override

If automated pipeline cannot be fixed before the publication deadline:

```bash
# Run calculation manually via Cloud Run
gcloud run jobs execute index-calculation \
  --region=europe-west1 \
  --args="--calc-date=$(date +%Y-%m-%d),--force"

# Verify output
sqlcmd -S localhost -U sa -Q "
SELECT index_code, calc_date, index_level, constituent_count
FROM dbo.index_levels_daily
WHERE calc_date = CAST(GETDATE() AS DATE)
"
```

## Escalation

- If not resolved within 30 minutes: escalate to Engineering Lead
- If publication deadline at risk: notify Index Operations and Client Relations immediately
- If SLA breached (index not published by deadline): notify Compliance Officer for EU BMR Article 13 reporting

## Post-Incident

- [ ] Send resolution notice to #incidents channel
- [ ] Update pipeline lineage table with incident details
- [ ] If manual override was used: document in compliance audit trail
- [ ] Schedule PIR within 48 hours
- [ ] Review: should a new Datadog monitor have caught this earlier?
- [ ] If SLA was breached: prepare regulatory notification

## Related

- [[on-call-guide]] — Severity definitions and escalation matrix
- [[airflow-scheduler-down]] — If the scheduler itself is the problem
- [[vendor-file-late-or-missing]] — If input data is the root cause
- [[compliance-and-auditability]] — Audit trail and EU BMR requirements
- [[dataops-for-indices]] — Incident response framework
