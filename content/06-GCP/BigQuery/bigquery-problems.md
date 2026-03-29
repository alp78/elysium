---
tags: [infrastructure, bigquery, gcp]
type: reference
technology: bigquery
status: stable
updated: 2026-03-23
description: "Comprehensive catalog of BigQuery production problems for data engineers — 25 issues ranked by severity with root cause analysis, impact assessment, prevention protocols, and fix procedures. Covers cost control, query performance, DML concurrency, data types, and operational issues."
---

# BigQuery Production Problems

BigQuery is deceptively simple — write SQL, get results. But in a production data platform serving financial index calculations, the pay-per-scan pricing model, DML concurrency limits, and implicit behaviors around partitioning, data types, and NULL handling create a minefield. A single unfiltered `SELECT *` on a 10TB table costs $62.50. A pipeline that runs 20 concurrent MERGEs hits a hard quota wall. FLOAT64 arithmetic that works in a spreadsheet produces wrong index values in BigQuery. This note catalogs every major problem with actionable prevention and fixes.

**Platform context:** BigQuery serves as the analytics warehouse for a financial index and ESG data provider on GCP. Workloads include: published index level consumption by clients, analytical queries by analysts, dbt transformation targets, scheduled queries for derived tables, materialized views for dashboards, and INFORMATION_SCHEMA for cost monitoring. On-demand pricing is used primarily. Data flows from a SQL Server gold layer into BigQuery via Cloud Run export jobs. The platform is EU BMR regulated — audit trail and reproducibility are non-negotiable.

---

## Table of Contents

**Critical — Cost Explosion / Data Loss**
1. [[#1. Uncontrolled Full-Table Scans ($$$)]]
2. [[#2. DML Quota Exceeded (20 Concurrent Mutations)]]
3. [[#3. Resources Exceeded During Query]]
4. [[#4. Accidental Table/Dataset Deletion]]
5. [[#5. Streaming Insert Cost Explosion]]

**High — Data Quality / Performance**
6. [[#6. FLOAT64 Precision Loss in Financial Calculations]]
7. [[#7. Partition Pruning Not Triggered]]
8. [[#8. No Clustering on Filter Columns]]
9. [[#9. MERGE Scans Everything (Expensive Incremental)]]
10. [[#10. Slot Starvation During Peak Hours]]
11. [[#11. NULL Propagation Hiding Data Quality Issues]]
12. [[#12. Materialized View Silently Stale]]

**Moderate — Operational Pain**
13. [[#13. Schema Evolution Breaks Downstream]]
14. [[#14. Scheduled Query Fails Silently]]
15. [[#15. Cross-Region Query Costs]]
16. [[#16. DML Concurrency Conflict on Same Table]]
17. [[#17. External Table Performance Trap]]
18. [[#18. Authorized View + Column-Level Security Conflict]]
19. [[#19. INFORMATION_SCHEMA Queries Are Expensive]]
20. [[#20. Time Travel Expiry — Can't Reproduce Historical Calculation]]

**Low — Annoyances / Technical Debt**
21. [[#21. No require_partition_filter Enforced]]
22. [[#22. Label/Tag Discipline Missing]]
23. [[#23. Wildcard Table Queries (Legacy Sharding)]]
24. [[#24. BI Engine Cache Misses]]
25. [[#25. Stale Views After Source Rename]]

---

## Critical — Cost Explosion / Data Loss

### Uncontrolled Full-Table Scans ($$$)

**What happens**
An analyst debugs a data discrepancy in `analytics.daily_prices` by running `SELECT * FROM analytics.daily_prices WHERE index_code = 'MSCI_WORLD'` on a 5TB table. The partition filter is omitted because the WHERE clause filters by `index_code`, not the partition column. BigQuery scans all 5TB — $31.25 for a single query. Repeated 10 times during debugging: $312. A BI dashboard tool configured to refresh this query every 5 minutes runs 288 queries per day: ~$4,500/day from one misconfigured dashboard.

**Root cause**
BigQuery uses columnar storage (Capacitor format) and charges $6.25 per TB scanned on on-demand pricing. The engine reads every column listed in `SELECT *` across every partition unless partition pruning is triggered. Filter predicates on non-partition columns (like `index_code`) are applied *after* data is read from storage — they do not reduce bytes billed. Column selection reduces bytes billed proportionally because BigQuery reads only referenced columns.

**Consequences**
- A single analyst incident can generate hundreds of dollars in charges with no warning
- Dashboard tools with auto-refresh multiply the cost by refresh frequency × concurrent users
- `SELECT *` on wide tables (100+ columns) reads columns that are never used in the query result
- Cost attribution is impossible without job labels, so finance cannot identify the responsible team
- On-demand budget alerts trigger after the spend, not before

> [!danger] Cost Trigger
>
> At $6.25/TB, a 5TB table costs $31.25 per unfiltered scan. A dashboard refreshing every 5 minutes on this table costs $4,500/day or $135,000/month. Always validate query cost before deploying to production dashboards.

**Prevention protocol**

1. Enforce partition filter requirement at the table level so that any query without a partition filter is rejected:

```sql
-- Require partition filter on all partitioned production tables
ALTER TABLE analytics.daily_prices
SET OPTIONS (require_partition_filter = TRUE);

-- Apply to all tables in a dataset via Terraform
resource "google_bigquery_table" "daily_prices" {
  dataset_id = google_bigquery_dataset.analytics.dataset_id
  table_id   = "daily_prices"

  time_partitioning {
    type                     = "DAY"
    field                    = "price_date"
    require_partition_filter = true
  }

  clustering = ["index_code", "instrument_isin"]

  labels = {
    env    = "production"
    domain = "index-data"
  }
}
```

2. Set `maximum_bytes_billed` in dbt profiles to block runaway queries:

```yaml
# profiles.yml
production:
  type: bigquery
  method: oauth
  project: my-financial-platform
  dataset: analytics
  location: EU
  maximum_bytes_billed: 10737418240  # 10 GB hard limit per query
  timeout_seconds: 300
  threads: 4
```

3. Use dry-run to check cost before executing:

```bash
# Check bytes that would be scanned without actually running the query
bq query \
  --dry_run \
  --use_legacy_sql=false \
  'SELECT index_code, price_date, close_price
   FROM `my-project.analytics.daily_prices`
   WHERE price_date = "2026-03-22"
     AND index_code = "MSCI_WORLD"'
```

> [!info] Dry-Run Output
>
> The dry run returns a validation message and the total bytes that would be scanned. For example, 45,678,901 bytes (roughly 45 MB) costs approximately $0.00028 at on-demand pricing -- well within acceptable limits for an ad-hoc query.

4. Monitor top-cost queries daily using INFORMATION_SCHEMA:

```sql
-- Top 20 most expensive queries in the last 7 days
SELECT
  user_email,
  job_id,
  query,
  ROUND(total_bytes_processed / POW(1024, 4) * 6.25, 4) AS estimated_cost_usd,
  total_bytes_processed,
  ROUND(total_bytes_processed / POW(1024, 3), 2)         AS gb_processed,
  creation_time,
  total_slot_ms
FROM `my-project`.`region-eu`.INFORMATION_SCHEMA.JOBS
WHERE
  creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
  AND job_type = 'QUERY'
  AND state = 'DONE'
ORDER BY total_bytes_processed DESC
LIMIT 20;
```

5. Select only needed columns — never `SELECT *` in production models:

```sql
-- BAD: scans all columns across all partitions
SELECT * FROM analytics.daily_prices;

-- GOOD: targeted column selection with partition filter
SELECT
  price_date,
  index_code,
  instrument_isin,
  close_price,
  adjusted_close_price
FROM analytics.daily_prices
WHERE price_date BETWEEN '2026-01-01' AND '2026-03-22'
  AND index_code = 'MSCI_WORLD';
```

**Fix procedure**

1. Identify the expensive query from INFORMATION_SCHEMA (query above).
2. Check if the table has `require_partition_filter` disabled:

```sql
SELECT table_name, option_name, option_value
FROM `my-project.analytics`.INFORMATION_SCHEMA.TABLE_OPTIONS
WHERE option_name = 'require_partition_filter';
```

3. Enable partition filter requirement immediately:

```bash
bq update \
  --time_partitioning_field price_date \
  --require_partition_filter \
  my-project:analytics.daily_prices
```

4. If the offending query is a dashboard, open the BI tool, identify the data source query, add the appropriate date filter, and verify with dry-run before republishing.
5. Add a Cloud Billing budget alert at 80% of monthly expected spend to catch future incidents.

---

### DML Quota Exceeded (20 Concurrent Mutations)

**What happens**
An Airflow DAG refreshes the `analytics.index_levels` partitioned table. The DAG has 25 parallel tasks, each running a `MERGE` statement targeting a different monthly partition. Tasks 1–20 start normally. Tasks 21–25 fail immediately with: `Quota exceeded: Your project exceeded quota for concurrent interactive DML statements`. The index publishing pipeline fails, client-facing data is not updated, and the on-call engineer gets paged at 07:00.

**Root cause**
BigQuery enforces a hard project-level quota of **20 concurrent interactive DML statements** (INSERT, UPDATE, DELETE, MERGE, TRUNCATE). This is not a soft limit — it is enforced at the project level, not the table level. A MERGE that runs for 10 minutes holds one DML slot for the entire duration. With 25 parallel Airflow tasks each running a MERGE, 5 will always fail. The quota applies separately to interactive and batch jobs (batch DML has a separate, lower-priority queue).

**Consequences**
- Pipeline fails mid-run, leaving some partitions updated and others stale — partial state that is very hard to debug
- Retry logic without backoff immediately re-queues the failed tasks, potentially blocking other pipelines in the same project
- Client-facing index levels are inconsistent — some dates show new values, others show the previous run's values
- Audit trail gaps if the failure is not logged with sufficient context for BMR compliance

> [!danger] Quota Hard Limit
>
> The 20 concurrent interactive DML limit is project-wide, not per-table or per-dataset. All teams sharing a project compete for the same 20 slots. If another team's ETL is running 15 MERGEs, your pipeline has only 5 slots available.

**Prevention protocol**

1. Inspect the current DML queue before running large parallelized pipelines:

```sql
-- Active DML jobs right now
SELECT
  job_id,
  user_email,
  statement_type,
  start_time,
  TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), start_time, SECOND) AS running_seconds,
  destination_table.table_id                               AS target_table,
  total_bytes_processed
FROM `my-project`.`region-eu`.INFORMATION_SCHEMA.JOBS
WHERE
  creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
  AND state = 'RUNNING'
  AND statement_type IN ('INSERT', 'UPDATE', 'DELETE', 'MERGE', 'TRUNCATE_TABLE')
ORDER BY start_time;
```

2. Serialize DML per table using Airflow pools. Create a pool with a max concurrency below the quota limit:

Create the pool via the Airflow CLI: `airflow pools set bigquery_dml_pool 16 "BigQuery DML concurrency limit (max 20 project-wide)"`. Then reference it in the DAG:

```python
from airflow.providers.google.cloud.operators.bigquery import BigQueryInsertJobOperator

merge_task = BigQueryInsertJobOperator(
    task_id="merge_index_levels_2026_03",
    configuration={
        "query": {
            "query": "{% include 'sql/merge_index_levels.sql' %}",
            "useLegacySql": False,
        }
    },
    project_id="my-financial-platform",
    location="EU",
    pool="bigquery_dml_pool",    # Limits concurrency across all DML tasks
    pool_slots=1,
    dag=dag,
)
```

3. For partition-level refreshes, use `INSERT OVERWRITE` (partition swap) instead of MERGE where possible. Partition overwrites are also DML but are faster and less resource-intensive:

```sql
-- Overwrite a single partition — fast, no scan of entire target table
INSERT INTO analytics.index_levels
PARTITION (price_date = '2026-03-22')
SELECT * FROM staging.index_levels_staging
WHERE price_date = '2026-03-22';
```

4. Route bulk inserts through the Storage Write API rather than DML for high-frequency pipelines (covered in detail in [[#5. Streaming Insert Cost Explosion]]).

5. Use batch DML for non-urgent background jobs to avoid competing with interactive DML quota:

```python
# Set job priority to BATCH to use separate quota
job_config = bigquery.QueryJobConfig(
    priority=bigquery.QueryPriority.BATCH,
    use_query_cache=False,
)
```

**Fix procedure**

1. Identify which jobs are holding DML slots:

```sql
SELECT job_id, user_email, statement_type, start_time,
       TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), start_time, MINUTE) AS minutes_running
FROM `my-project`.`region-eu`.INFORMATION_SCHEMA.JOBS
WHERE state = 'RUNNING'
  AND statement_type IN ('INSERT', 'UPDATE', 'DELETE', 'MERGE', 'TRUNCATE_TABLE')
ORDER BY start_time;
```

2. Cancel stuck/runaway jobs if necessary:

```bash
bq cancel --project_id=my-financial-platform <job_id>
```

3. Requeue failed tasks with a sequentialized approach — set `max_active_tasks` on the TaskGroup to 15:

```python
with TaskGroup("merge_partitions", dag=dag) as merge_group:
    # ... task definitions ...
    pass

# Limit concurrency at the TaskGroup level
merge_group.max_active_tasks = 15
```

4. After the incident, implement the Airflow pool from step 2 of prevention, and add monitoring (see [[#14. Scheduled Query Fails Silently]] for alert setup pattern).

---

### Resources Exceeded During Query

**What happens**
A data analyst runs an ad-hoc query joining three large tables: `analytics.daily_prices` (1B rows), `analytics.index_weights` (500M rows), and `analytics.esg_scores` (200M rows) — all without partition filters, to produce a time-series cross-sectional analysis. After 10 minutes, the query fails with: `Resources exceeded during query execution: The query could not be executed in the allotted memory`. No partial results are returned. The analyst has paid to scan ~3TB of data ($18.75) and received nothing.

**Root cause**
BigQuery executes queries in a distributed shuffle-based execution engine. Large JOINs require materializing intermediate results across worker nodes (shuffle). When the shuffle data exceeds available memory across all assigned slots, the query fails. On-demand pricing assigns slots dynamically, but memory per slot is bounded. Wide Cartesian-like JOINs (e.g., joining on a non-unique key), queries with many GROUP BY dimensions, and ARRAY_AGG on large groups are common triggers. The failure is an execution error, not a quota error — the job will not automatically retry.

**Consequences**
- Analyst paid $10–50 in scan costs and received no result
- Long-running queries (10+ minutes) block slot allocation for other users
- Complex analytical queries for index methodology validation may be impossible without query restructuring
- Pressure on engineers to "just make it work" leads to premature slot reservation purchases

> [!warning] Identify the bottleneck
>
> Check `totalBytesProcessed` vs `totalBytesBilled` in job metadata. Also check `INFORMATION_SCHEMA.JOBS.query_info.resource_warning` — BigQuery sometimes logs a warning before the failure.

**Prevention protocol**

1. Inspect query execution stats to find the shuffle bottleneck:

```sql
SELECT
  job_id,
  total_bytes_processed,
  total_slot_ms,
  query_info.resource_warning,
  JSON_VALUE(job_statistics, '$.queryPlan[0].shuffleOutputBytesSpilled') AS spilled_bytes
FROM `my-project`.`region-eu`.INFORMATION_SCHEMA.JOBS
WHERE job_id = '<your_job_id>';
```

2. Always add partition filters to reduce input data before JOIN:

```sql
-- BAD: joins 1B × 500M × 200M rows
SELECT
  p.instrument_isin,
  p.close_price,
  w.weight,
  e.esg_score
FROM analytics.daily_prices p
JOIN analytics.index_weights w USING (instrument_isin, index_code)
JOIN analytics.esg_scores e USING (instrument_isin);

-- GOOD: partition-filtered, date-scoped
SELECT
  p.instrument_isin,
  p.close_price,
  w.weight,
  e.esg_score
FROM analytics.daily_prices p
JOIN analytics.index_weights w
  ON  p.instrument_isin = w.instrument_isin
  AND p.index_code      = w.index_code
  AND w.effective_date  = '2026-03-22'
JOIN analytics.esg_scores e
  ON  p.instrument_isin  = e.instrument_isin
  AND e.score_date BETWEEN '2026-01-01' AND '2026-03-22'
WHERE p.price_date = '2026-03-22'
  AND p.index_code = 'MSCI_WORLD';
```

3. Break complex queries into CTEs materialized as temp tables to limit shuffle scope:

```sql
-- Step 1: materialize filtered prices into a temp table
CREATE TEMP TABLE filtered_prices AS
SELECT instrument_isin, index_code, close_price
FROM analytics.daily_prices
WHERE price_date = '2026-03-22'
  AND index_code = 'MSCI_WORLD';

-- Step 2: join against the small temp table
SELECT
  fp.instrument_isin,
  fp.close_price,
  w.weight,
  e.esg_score
FROM filtered_prices fp
JOIN analytics.index_weights w
  ON  fp.instrument_isin = w.instrument_isin
  AND fp.index_code      = w.index_code
  AND w.effective_date   = '2026-03-22'
JOIN analytics.esg_scores e
  ON  fp.instrument_isin = e.instrument_isin
  AND e.score_date       = '2026-03-22';
```

4. Use approximate aggregation functions for exploratory queries where exact results are not required:

```sql
-- Exact COUNT DISTINCT (expensive — requires full deduplication)
SELECT COUNT(DISTINCT instrument_isin) FROM analytics.daily_prices;

-- Approximate (fast, ~1% error — fine for exploration)
SELECT APPROX_COUNT_DISTINCT(instrument_isin) FROM analytics.daily_prices;

-- HyperLogLog sketches for repeated approximations
SELECT HLL_COUNT.MERGE(hll_sketch) FROM analytics.daily_prices_hll_sketches;
```

**Fix procedure**

1. Check the failed job ID in the Cloud Console → BigQuery → Job History, or via CLI:

```bash
bq show --format=prettyjson --job <job_id> | jq '.statistics.query.queryPlan[] | {name, shuffleOutputBytes, shuffleOutputBytesSpilled}'
```

2. Identify which query stage spilled the most shuffle data — that is the bottleneck join or aggregation.
3. Add partition filters to the tables in that stage, or break the query into two steps using `CREATE TEMP TABLE`.
4. If the query is part of a dbt model, split it into two models: a filtered staging model and an aggregation model, using `{{ ref() }}` to chain them.
5. For recurring analytical queries with unavoidable large shuffles, consider reserving slots (BigQuery Editions) to guarantee memory capacity.

---

### Accidental Table/Dataset Deletion

**What happens**
A dbt developer refactors the `finance.corporate_actions` model, changing the target dataset from `staging` to `finance`. The dbt run includes a `--full-refresh` flag. The production `finance.corporate_actions` table — containing 5 years of corporate action history used for index backcalculation — is dropped and recreated from the current incremental slice. Five years of history are gone. Alternatively: a Terraform `apply` on a refactored module drops a dataset because the resource was moved without a `moved {}` block.

**Root cause**
BigQuery does not have a confirmation prompt for `DROP TABLE` or `DROP DATASET`. dbt's `--full-refresh` flag explicitly drops and recreates tables. Terraform destroy is triggered automatically when a managed resource is removed from state. BigQuery's time travel feature retains data for up to 7 days (configurable) after deletion, making recovery possible within that window.

**Consequences**
- Loss of historical data required for BMR-regulated index backcalculation
- Pipeline failures for all downstream models that depend on the deleted table
- Potential regulatory breach if audit data cannot be reproduced
- Recovery under time pressure (7-day window) adds operational risk

> [!danger] Irreversible After 7 Days
>
> BigQuery time travel defaults to 7 days. After that, deleted data is permanently gone unless you have snapshots or GCS exports. For EU BMR compliance, establish a snapshot routine for all critical reference and history tables.

**Prevention protocol**

1. Enable `deletion_protection` on all production tables in Terraform:

```hcl
resource "google_bigquery_table" "corporate_actions" {
  dataset_id          = google_bigquery_dataset.finance.dataset_id
  table_id            = "corporate_actions"
  deletion_protection = true   # Prevents accidental Terraform destroy

  time_partitioning {
    type  = "DAY"
    field = "action_date"
  }

  labels = {
    env         = "production"
    criticality = "high"
    domain      = "corporate-actions"
  }
}
```

2. Do NOT set `default_table_expiration_ms` on production datasets:

```hcl
resource "google_bigquery_dataset" "finance" {
  dataset_id  = "finance"
  location    = "EU"
  description = "Production financial data"

  # NEVER set default_table_expiration_ms on production datasets
  # default_table_expiration_ms = 86400000  -- DO NOT DO THIS

  labels = {
    env = "production"
  }
}
```

3. Set `on_schema_change: fail` in dbt model configs to prevent silent schema mutations:

```yaml
# dbt_project.yml
models:
  my_project:
    finance:
      +materialized: incremental
      +on_schema_change: fail     # Fail loudly rather than silently alter
      +incremental_strategy: merge
      +partition_by:
        field: action_date
        data_type: date
        granularity: day
```

4. Set time travel window to maximum (7 days) on critical tables:

```sql
ALTER TABLE finance.corporate_actions
SET OPTIONS (max_time_travel_hours = 168);  -- 168 hours = 7 days
```

5. Schedule daily snapshots for audit compliance:

```sql
-- Run daily via Cloud Scheduler + Cloud Run
CREATE SNAPSHOT TABLE finance.corporate_actions_snapshot_20260323
  CLONE finance.corporate_actions
  OPTIONS (expiration_timestamp = TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL 90 DAY));
```

**Fix procedure**

1. Act immediately — every hour counts against the 7-day time travel window.
2. Recover using time travel (specify a timestamp before the deletion):

```sql
-- Recover data from 2 hours ago
CREATE TABLE finance.corporate_actions_recovered AS
SELECT *
FROM finance.corporate_actions
FOR SYSTEM_TIME AS OF TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 HOUR);
```

3. Verify row counts match expectations:

```sql
SELECT COUNT(*), MIN(action_date), MAX(action_date)
FROM finance.corporate_actions_recovered;
```

4. Rename the recovered table to replace the original:

```bash
bq cp --project_id=my-financial-platform \
  finance.corporate_actions_recovered \
  finance.corporate_actions

bq rm --project_id=my-financial-platform \
  finance.corporate_actions_recovered
```

5. If the table was deleted more than 7 days ago, restore from the most recent snapshot or GCS export.
6. Document the incident and add `deletion_protection = true` to the Terraform resource immediately.

---

### Streaming Insert Cost Explosion

**What happens**
A Cloud Run job exports corporate action events from SQL Server to BigQuery using the legacy streaming API. The developer wrote a loop that calls `rows.insert_rows_json()` once per row. Processing 1 million events takes 45 minutes and generates 1 million API calls. Cost: streaming inserts are billed at $0.012 per 200MB of data — but the real problem is the per-call overhead: latency per insert is 100–500ms, making this 45x slower than a batch load job. Additionally, streamed rows are not available for DML (UPDATE/DELETE) for up to 30 minutes.

**Root cause**
BigQuery has three data ingestion mechanisms with dramatically different cost and performance profiles: (1) **Load jobs**: free, batch, supports all formats, data immediately available for all DML. (2) **Storage Write API**: low cost ($0.025/GB), streaming, supports exactly-once semantics, high throughput. (3) **Legacy Streaming API**: $0.012/200MB, low throughput per connection, not immediately DML-accessible. The legacy streaming API was designed for low-latency single-event ingestion (e.g., clickstream), not batch financial data loads.

**Consequences**
- Cloud Run export jobs run 45x longer, consuming more CPU and memory → higher Cloud Run costs
- BigQuery streaming insert costs add up: 1M rows/day × 365 = $365M rows/year at row-level API overhead
- Rows recently inserted via streaming cannot be updated or deleted for ~30 minutes, breaking downstream MERGE operations
- Duplicate rows if the Cloud Run job retries without idempotency checks

> [!danger] Use Load Jobs for Batch
>
> Use Load Jobs for Batch Data.
> Load jobs from GCS are **free** in BigQuery. There is no per-byte charge for batch loads. For a financial platform moving data from SQL Server → GCS → BigQuery, load jobs should be the default ingestion path. Streaming is for real-time event streams only.

**Prevention protocol**

1. Use load jobs (GCS → BigQuery) for all batch financial data — this is the standard Cloud Run export pattern:

```python
# cloud_run/export_job.py
from google.cloud import bigquery, storage
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

def export_corporate_actions_to_bq(project_id: str, dataset: str, table: str):
    """Export corporate actions from SQL Server gold layer to BigQuery via GCS."""

    # Step 1: Write data to GCS as Parquet (done by Cloud Run job)
    gcs_uri = f"gs://my-platform-staging/corporate_actions/dt=2026-03-23/*.parquet"

    # Step 2: Load from GCS into BigQuery — FREE
    bq_client = bigquery.Client(project=project_id)

    job_config = bigquery.LoadJobConfig(
        source_format=bigquery.SourceFormat.PARQUET,
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,  # or WRITE_APPEND
        time_partitioning=bigquery.TimePartitioning(
            type_=bigquery.TimePartitioningType.DAY,
            field="action_date",
        ),
        clustering_fields=["index_code", "instrument_isin"],
        autodetect=False,
        schema=[
            bigquery.SchemaField("action_date",      "DATE",    mode="REQUIRED"),
            bigquery.SchemaField("instrument_isin",  "STRING",  mode="REQUIRED"),
            bigquery.SchemaField("index_code",       "STRING",  mode="REQUIRED"),
            bigquery.SchemaField("action_type",      "STRING",  mode="REQUIRED"),
            bigquery.SchemaField("adjustment_factor","NUMERIC", mode="NULLABLE"),
        ],
    )

    table_ref = f"{project_id}.{dataset}.{table}"
    load_job = bq_client.load_table_from_uri(gcs_uri, table_ref, job_config=job_config)
    load_job.result()  # Wait for job to complete

    print(f"Loaded {load_job.output_rows} rows into {table_ref}")
```

2. If real-time streaming is genuinely required, use the Storage Write API with batching:

```python
# Use Storage Write API for streaming with batching — much cheaper and faster
from google.cloud.bigquery_storage_v1 import BigQueryWriteClient
from google.cloud.bigquery_storage_v1.types import (
    ProtoRows, WriteStream, AppendRowsRequest
)

# Batch rows into groups of 1000 before appending
BATCH_SIZE = 1000

def stream_rows_via_storage_write_api(rows: list[dict], project: str, dataset: str, table: str):
    client = BigQueryWriteClient()
    parent = client.table_path(project, dataset, table)
    write_stream = client.create_write_stream(
        parent=parent,
        write_stream=WriteStream(type_=WriteStream.Type.COMMITTED),
    )

    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        # ... serialize batch to ProtoRows and append
        # See Google Cloud docs for full serialization example
```

3. Cost comparison to inform architecture decisions:

| Method | Cost per GB | Latency | DML-ready | Use case |
|---|---|---|---|---|
| Load Job (GCS) | **Free** | Minutes | Immediately | Batch ETL, daily exports |
| Storage Write API | $0.025/GB | Seconds | Immediately | Streaming with throughput |
| Legacy Streaming | $0.012/200MB | ms | ~30 min delay | Real-time single events only |

**Fix procedure**

1. Identify whether the pipeline truly needs real-time latency or if batch (hourly/daily) is acceptable. For financial index data from SQL Server: batch is almost always acceptable.
2. Refactor the Cloud Run export job to write Parquet to GCS first, then trigger a BigQuery load job.
3. Remove all calls to `insert_rows_json()` in the batch pipeline path.
4. Verify load job costs are zero by checking INFORMATION_SCHEMA.JOBS:

```sql
SELECT job_type, statement_type, total_bytes_billed, total_bytes_processed
FROM `my-project`.`region-eu`.INFORMATION_SCHEMA.JOBS
WHERE job_type = 'LOAD'
  AND creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY);
-- total_bytes_billed should be 0 for all LOAD jobs
```

---

## High — Data Quality / Performance

### FLOAT64 Precision Loss in Financial Calculations

**What happens**
Index constituent weights are stored as `FLOAT64` in the `analytics.index_weights` table. A validation query checks that constituent weights sum to 1.0 for each index on each date. The query returns `0.9999999999999998` for the MSCI World index. An automated audit validation script that checks `SUM(weight) = 1.0` fails. The pipeline is halted pending investigation. The root cause is not a data error — it is FLOAT64's fundamental inability to represent certain decimal fractions exactly.

**Root cause**
`FLOAT64` (IEEE 754 double-precision) stores numbers as binary fractions. Decimal values like `0.1`, `0.2`, and `0.3` cannot be represented exactly in binary — they become repeating fractions. When you sum 1,500 constituent weights that are each imprecisely stored, the errors compound. `NUMERIC` (DECIMAL) in BigQuery stores numbers as exact decimal values with up to 38 digits of precision and 9 decimal places, making it the correct type for all financial values.

**Consequences**
- Audit validation failures trigger false alarms, causing pipeline halts
- Index levels calculated from FLOAT64 weights are technically incorrect (error is tiny but non-zero)
- EU BMR compliance requires exact reproducibility — FLOAT64 arithmetic is non-deterministic across platforms
- Comparisons like `weight = 0.0025` silently fail because the stored value is `0.0024999999999999...`

> [!danger] Never Use FLOAT64 for Money
>
> Never Use FLOAT64 for Financial Data.
> FLOAT64 is appropriate for scientific calculations where approximate values are acceptable. For index weights, prices, returns, and any value that feeds client-published index levels, use NUMERIC or BIGNUMERIC. This is a correctness issue, not just a precision preference.

**Prevention protocol**

1. Define all financial columns as `NUMERIC` in table schemas:

```sql
-- Correct schema for index weights table
CREATE TABLE analytics.index_weights (
  effective_date   DATE      NOT NULL,
  index_code       STRING    NOT NULL,
  instrument_isin  STRING    NOT NULL,
  weight           NUMERIC   NOT NULL,   -- Exact decimal, not FLOAT64
  market_cap_usd   NUMERIC,              -- Financial value — use NUMERIC
  free_float_mcap  NUMERIC,
  _loaded_at       TIMESTAMP NOT NULL
)
PARTITION BY effective_date
CLUSTER BY index_code, instrument_isin
OPTIONS (require_partition_filter = TRUE);
```

2. Demonstrate the difference to stakeholders:

```sql
-- FLOAT64 precision loss
SELECT
  CAST(0.1 AS FLOAT64) + CAST(0.2 AS FLOAT64) AS float_sum,   -- Returns 0.30000000000000004
  CAST(0.1 AS NUMERIC) + CAST(0.2 AS NUMERIC) AS numeric_sum; -- Returns 0.3 exactly

-- Weight sum comparison
WITH weights AS (
  SELECT 0.3333 AS w UNION ALL
  SELECT 0.3333 UNION ALL
  SELECT 0.3334
)
SELECT
  SUM(CAST(w AS FLOAT64))  AS float_sum,    -- 0.9999999999999999
  SUM(CAST(w AS NUMERIC))  AS numeric_sum   -- 1.0000 exactly
FROM weights;
```

3. Add a NUMERIC type enforcement check in dbt schema tests:

```yaml
# models/analytics/schema.yml
models:
  - name: index_weights
    columns:
      - name: weight
        data_tests:
          - not_null
          - dbt_utils.expression_is_true:
              expression: "weight > 0 AND weight <= 1"
        meta:
          data_type: NUMERIC   # Documented for schema contract enforcement
```

4. Migrate existing FLOAT64 columns to NUMERIC:

```sql
-- Migration: add new NUMERIC column, backfill, rename
ALTER TABLE analytics.index_weights
ADD COLUMN weight_numeric NUMERIC;

UPDATE analytics.index_weights
SET weight_numeric = CAST(weight AS NUMERIC)
WHERE TRUE;

-- Then in a new table creation (BigQuery doesn't support DROP COLUMN in all scenarios):
CREATE TABLE analytics.index_weights_v2 AS
SELECT
  effective_date,
  index_code,
  instrument_isin,
  CAST(weight AS NUMERIC) AS weight,
  CAST(market_cap_usd AS NUMERIC) AS market_cap_usd
FROM analytics.index_weights;
```

**Fix procedure**

1. Identify all FLOAT64 columns in production tables:

```sql
SELECT table_name, column_name, data_type
FROM `my-project.analytics`.INFORMATION_SCHEMA.COLUMNS
WHERE data_type = 'FLOAT64'
  AND table_name NOT LIKE '%_staging%'
ORDER BY table_name, column_name;
```

2. For each identified column, assess financial impact: is this column used in calculations that feed published index levels? If yes, it must be migrated.
3. Create a new table with NUMERIC columns, backfill from the FLOAT64 source with `CAST(col AS NUMERIC)`, validate row counts and spot-check values, then swap with `bq cp`.
4. Update all upstream pipeline schemas (dbt models, Cloud Run export schemas) to use NUMERIC from the source.
5. Update audit validation queries to compare against `ROUND(SUM(weight), 6) = 1.0` as a temporary measure during migration, then remove the ROUND once NUMERIC is in place.

---

### Partition Pruning Not Triggered

**What happens**
The `analytics.daily_prices` table is partitioned by `price_date` (DATE type). A scheduled query filters data with `WHERE DATE(price_date) = '2026-03-22'`. Although the filter appears to target a single day, the `DATE()` function wrapped around the partition column prevents BigQuery from applying partition pruning. The query scans the entire 5TB table instead of a single day's 2GB partition — 2,500x more data than necessary, costing $31.25 instead of $0.01.

**Root cause**
BigQuery's partition pruning requires that the filter expression directly reference the partition column with a comparison operator (`=`, `<`, `>`, `BETWEEN`, `IN`). Any transformation applied to the partition column — including scalar functions like `DATE()`, `TIMESTAMP_TRUNC()`, `FORMAT_DATE()`, or even string concatenation — prevents the query planner from statically determining which partitions to read. The planner cannot invert arbitrary functions to determine the affected partition range.

**Consequences**
- Scheduled queries and dbt models that appear correct run at 100–2500x expected cost
- Performance is indistinguishable from an unpartitioned table
- The partition structure provides zero benefit despite the storage and maintenance overhead
- Hard to detect: the query returns correct results, only the cost and performance reveal the problem

**Prevention protocol**

1. Use direct column comparisons, never functions on partition columns:

```sql
-- BAD: function on partition column — NO pruning
WHERE DATE(price_date) = '2026-03-22'
WHERE TIMESTAMP_TRUNC(price_date, DAY) = '2026-03-22'
WHERE FORMAT_DATE('%Y-%m-%d', price_date) = '2026-03-22'
WHERE EXTRACT(YEAR FROM price_date) = 2026

-- GOOD: direct comparison — pruning applies
WHERE price_date = '2026-03-22'
WHERE price_date BETWEEN '2026-01-01' AND '2026-03-31'
WHERE price_date >= '2026-01-01' AND price_date < '2026-04-01'
WHERE price_date IN ('2026-03-21', '2026-03-22')
```

2. For ingestion-time partitioned tables, use the `_PARTITIONDATE` pseudo-column:

```sql
-- Ingestion-time partitioned tables
WHERE _PARTITIONDATE = '2026-03-22'
WHERE _PARTITIONDATE BETWEEN '2026-01-01' AND '2026-03-31'
```

3. Verify that partition pruning is actually working by checking `totalBytesProcessed` against the expected partition size:

```sql
-- After running a query, check the job stats
SELECT
  job_id,
  total_bytes_processed,
  ROUND(total_bytes_processed / POW(1024, 3), 2) AS gb_processed,
  -- Compare against: SELECT SUM(total_logical_bytes) FROM INFORMATION_SCHEMA.PARTITIONS WHERE partition_id = '20260322'
  query
FROM `my-project`.`region-eu`.INFORMATION_SCHEMA.JOBS
WHERE job_id = '<your_job_id>';

-- Expected partition size for a single day
SELECT
  partition_id,
  ROUND(total_logical_bytes / POW(1024, 3), 2) AS partition_size_gb
FROM `my-project.analytics`.INFORMATION_SCHEMA.PARTITIONS
WHERE table_name = 'daily_prices'
  AND partition_id = '20260322';
```

4. Subqueries in WHERE clauses can also block pruning — materialize them:

```sql
-- BAD: subquery prevents static partition analysis
WHERE price_date = (SELECT MAX(price_date) FROM analytics.trading_calendar)

-- GOOD: use a parameterized variable or pass the date explicitly
DECLARE target_date DATE DEFAULT '2026-03-22';
SELECT * FROM analytics.daily_prices WHERE price_date = target_date;
```

**Fix procedure**

1. Audit all scheduled queries and dbt models for function-wrapped partition column filters:

```bash
# Search dbt models for common pruning anti-patterns
grep -rn "DATE(price_date)|DATE(effective_date)|TIMESTAMP_TRUNC" models/
```

2. Replace all `DATE(partition_col) = 'X'` patterns with `partition_col = 'X'`.
3. Validate fix with dry-run before and after:

```bash
# Before fix — should show ~5TB
bq query --dry_run --use_legacy_sql=false \
  'SELECT * FROM analytics.daily_prices WHERE DATE(price_date) = "2026-03-22"'

# After fix — should show ~2GB
bq query --dry_run --use_legacy_sql=false \
  'SELECT * FROM analytics.daily_prices WHERE price_date = "2026-03-22"'
```

---

### No Clustering on Filter Columns

**What happens**
The `analytics.daily_prices` table is partitioned by `price_date`. Each daily partition contains 500,000 rows across 3,000 instruments and 50 indices. An analyst queries data for a single index (`index_code = 'MSCI_EM'`) on a single date. Partition pruning works correctly — only today's partition is read. But within that partition, all 500,000 rows are scanned to find the ~10,000 rows belonging to `MSCI_EM`. Without clustering, BigQuery has no way to skip rows within a partition.

**Root cause**
BigQuery clustering physically sorts and co-locates data by the specified columns within each partition. When you filter on a cluster column, BigQuery reads only the data blocks that contain matching values — this is called "block pruning." Without clustering, every query that filters on `index_code` or `instrument_isin` scans the entire partition. Clustering is free (no storage overhead, no maintenance jobs) and reduces bytes billed proportionally to the column selectivity.

**Consequences**
- Queries on large partitions scan 10–100x more data than necessary
- Cost scales linearly with partition size even for highly selective queries
- Performance degradation as partition sizes grow over time
- Analysts experience slow queries and complain about BigQuery performance, masking the real issue

**Prevention protocol**

1. Add clustering to all partitioned tables by the top filter columns, in order of selectivity (most selective first):

```sql
-- Add clustering to existing table
ALTER TABLE analytics.daily_prices
CLUSTER BY index_code, instrument_isin, currency_code;

-- Define clustering at table creation
CREATE TABLE analytics.daily_prices (
  price_date           DATE      NOT NULL,
  index_code           STRING    NOT NULL,
  instrument_isin      STRING    NOT NULL,
  currency_code        STRING    NOT NULL,
  open_price           NUMERIC,
  high_price           NUMERIC,
  low_price            NUMERIC,
  close_price          NUMERIC   NOT NULL,
  adjusted_close_price NUMERIC,
  volume               INT64,
  _source_system       STRING,
  _loaded_at           TIMESTAMP NOT NULL
)
PARTITION BY price_date
CLUSTER BY index_code, instrument_isin
OPTIONS (require_partition_filter = TRUE);
```

2. In Terraform:

```hcl
resource "google_bigquery_table" "daily_prices" {
  dataset_id = "analytics"
  table_id   = "daily_prices"

  time_partitioning {
    type                     = "DAY"
    field                    = "price_date"
    require_partition_filter = true
  }

  clustering = ["index_code", "instrument_isin"]  # Up to 4 columns
}
```

3. Measure the impact of clustering by comparing bytes processed before and after:

```sql
-- Cost comparison: same query on clustered vs unclustered table
-- Run against clustered table
SELECT instrument_isin, SUM(close_price * volume) AS traded_value
FROM analytics.daily_prices          -- clustered by index_code, instrument_isin
WHERE price_date = '2026-03-22'
  AND index_code = 'MSCI_EM'
GROUP BY instrument_isin;

-- Expect ~80% reduction in bytes processed vs unclustered equivalent
```

**Fix procedure**

1. Identify tables missing clustering that have common filter patterns:

```sql
SELECT t.table_name, t.row_count, t.size_bytes,
       ROUND(t.size_bytes / POW(1024, 3), 2) AS size_gb,
       c.clustering_ordinal_position,
       c.column_name AS cluster_col
FROM `my-project.analytics`.INFORMATION_SCHEMA.TABLE_STORAGE t
LEFT JOIN `my-project.analytics`.INFORMATION_SCHEMA.COLUMNS c
  ON  t.table_name = c.table_name
  AND c.clustering_ordinal_position IS NOT NULL
WHERE t.table_type = 'BASE TABLE'
ORDER BY t.size_bytes DESC;
-- Tables with NULL cluster_col and large size_gb are clustering candidates
```

2. Review INFORMATION_SCHEMA.JOBS for the most common filter columns used against large tables, then apply clustering on those columns.
3. `ALTER TABLE ... CLUSTER BY` on an existing table triggers a background re-clustering job. Monitor until complete before comparing costs.

---

### MERGE Scans Everything (Expensive Incremental)

**What happens**
A dbt incremental model uses the default `merge` strategy to update `analytics.index_levels` (1 billion rows, partitioned by `level_date`). The Cloud Run job exports 100 new rows for today. dbt generates a MERGE statement that joins the 100-row source against the 1-billion-row target to find rows to update or insert. The MERGE scans the entire 1B row table — approximately 2TB — costing $12.50 to load 100 rows. Running this 288 times per day (every 5 minutes) costs $3,600/day.

**Root cause**
BigQuery's MERGE statement evaluates the `WHEN MATCHED` condition across all rows in both the source and target that join on the merge key. Without predicates that restrict which partitions of the target are considered, the engine must scan every partition to find potential matches. dbt's default `merge` strategy does not add partition predicates unless explicitly configured with `incremental_predicates`.

**Consequences**
- Incremental model refresh cost scales with total table size, not incremental data size
- As the table grows over time, costs increase even with a constant daily row count
- High slot consumption for a simple insert/update operation blocks other queries
- Economic unsustainability: a table that grows to 10B rows would cost $125/merge

**Prevention protocol**

1. Use `insert_overwrite` (partition replacement) strategy for date-partitioned tables where new data arrives by partition:

```sql
-- dbt model: models/analytics/index_levels.sql
{{
  config(
    materialized      = 'incremental',
    incremental_strategy = 'insert_overwrite',
    partition_by      = {
      'field': 'level_date',
      'data_type': 'date',
      'granularity': 'day'
    },
    cluster_by        = ['index_code'],
    on_schema_change  = 'fail'
  )
}}

SELECT
  level_date,
  index_code,
  index_level,
  index_return_1d,
  index_return_mtd,
  calculation_method,
  _loaded_at
FROM {{ ref('stg_index_levels') }}

{% if is_incremental() %}
  -- Only process today's data
  WHERE level_date = CURRENT_DATE()
{% endif %}
```

2. When MERGE is genuinely necessary (e.g., late-arriving updates to past dates), add `incremental_predicates` to restrict the target scan:

```sql
-- dbt model with incremental_predicates
{{
  config(
    materialized            = 'incremental',
    incremental_strategy    = 'merge',
    unique_key              = ['level_date', 'index_code'],
    incremental_predicates  = [
      "DBT_INTERNAL_DEST.level_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)"
    ],
    partition_by = {'field': 'level_date', 'data_type': 'date', 'granularity': 'day'}
  )
}}
```

3. Cost comparison — validate before deploying strategy change:

```bash
# Estimate cost of current MERGE (without predicates)
bq query --dry_run --use_legacy_sql=false \
  "MERGE analytics.index_levels T
   USING staging.index_levels_new S ON T.level_date = S.level_date AND T.index_code = S.index_code
   WHEN MATCHED THEN UPDATE SET T.index_level = S.index_level
   WHEN NOT MATCHED THEN INSERT ROW"
# Likely: ~2TB scanned

# Estimate cost with partition predicate
bq query --dry_run --use_legacy_sql=false \
  "MERGE analytics.index_levels T
   USING staging.index_levels_new S ON T.level_date = S.level_date AND T.index_code = S.index_code
   WHEN MATCHED AND T.level_date = CURRENT_DATE() THEN UPDATE SET T.index_level = S.index_level
   WHEN NOT MATCHED THEN INSERT ROW"
# Expected: ~2GB scanned (today's partition only)
```

**Fix procedure**

1. Identify expensive incremental MERGE jobs in INFORMATION_SCHEMA:

```sql
SELECT job_id, total_bytes_processed,
       ROUND(total_bytes_processed / POW(1024, 4) * 6.25, 2) AS cost_usd,
       query
FROM `my-project`.`region-eu`.INFORMATION_SCHEMA.JOBS
WHERE statement_type = 'MERGE'
  AND creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
ORDER BY total_bytes_processed DESC
LIMIT 10;
```

2. For each expensive MERGE, evaluate whether `insert_overwrite` is viable (new data arrives by partition) or `incremental_predicates` are needed (late-arriving updates to recent partitions).
3. Update dbt model config and validate cost reduction with dry-run.
4. Run `dbt run --full-refresh` on the model once after changing strategy to rebuild cleanly.

---

### Slot Starvation During Peak Hours

**What happens**
At 09:00 CET, index calculation pipelines start, analysts begin running queries, and dashboards auto-refresh. The project is on on-demand pricing. Simple queries that take 5 seconds at midnight take 5 minutes at 09:00. A client-facing dashboard that queries `analytics.index_levels` shows "Loading..." for 4 minutes. The on-call engineer checks the BigQuery console and sees a queue of 200 pending queries.

**Root cause**
On-demand BigQuery pricing gives each project up to 2,000 concurrent slots (soft limit). Slots are shared across all queries in the project. When demand exceeds available slots, queries are queued. Query queueing is fair-schedule based — there is no priority mechanism in on-demand pricing. ETL pipelines, analyst ad-hoc queries, and dashboard refreshes all compete for the same pool. There is no guaranteed latency in on-demand mode.

**Consequences**
- Client-facing dashboards become unusable during business hours
- SLA breaches for index level publication times
- Analysts lose trust in the platform and resort to downloading data to Excel
- On-demand slot queuing can cause cascading failures in time-sensitive pipelines

**Prevention protocol**

1. Monitor slot utilization over time to quantify the problem:

```sql
-- Slot utilization by 15-minute window for the last 7 days
SELECT
  TIMESTAMP_TRUNC(period_start, MINUTE) AS period,
  SUM(period_slot_ms) / (1000 * 60 * 15) AS avg_slots_used,
  COUNT(DISTINCT job_id)                  AS concurrent_jobs
FROM `my-project`.`region-eu`.INFORMATION_SCHEMA.JOBS_TIMELINE
WHERE period_start >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
GROUP BY 1
ORDER BY avg_slots_used DESC
LIMIT 100;
```

2. Use BigQuery Editions (reserved slots) for predictable workloads. Assign separate reservations to separate workload types:

```hcl
# Terraform: BigQuery Editions reservations
resource "google_bigquery_reservation" "etl_reservation" {
  name     = "etl-pipeline-reservation"
  location = "EU"
  slot_capacity    = 500   # Reserved for ETL pipelines
  edition          = "ENTERPRISE"
  ignore_idle_slots = true  # Allow idle slots to be used by others
}

resource "google_bigquery_reservation" "analytics_reservation" {
  name     = "analytics-reservation"
  location = "EU"
  slot_capacity    = 300   # Reserved for analyst queries
  edition          = "ENTERPRISE"
  ignore_idle_slots = true
}

resource "google_bigquery_reservation_assignment" "etl_assignment" {
  reservation = google_bigquery_reservation.etl_reservation.id
  assignee    = "projects/my-financial-platform"
  job_type    = "QUERY"
}
```

3. Use BI Engine for dashboard queries — in-memory acceleration bypasses slot queueing:

```hcl
resource "google_bigtable_app_profile" "bi_engine" {
  # BI Engine reservation for dashboard acceleration
}

# In Terraform for BI Engine:
resource "google_bigquery_bi_reservation" "default" {
  location = "EU"
  size     = 10737418240  # 10 GB BI Engine reservation
}
```

**Fix procedure**

1. During a slot starvation incident, identify and cancel long-running low-priority queries:

```sql
SELECT job_id, user_email, total_slot_ms,
       TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), start_time, SECOND) AS seconds_running,
       LEFT(query, 100) AS query_preview
FROM `my-project`.`region-eu`.INFORMATION_SCHEMA.JOBS
WHERE state = 'RUNNING'
  AND job_type = 'QUERY'
ORDER BY seconds_running DESC;
```

```bash
bq cancel --project_id=my-financial-platform <long_running_job_id>
```

2. As an immediate mitigation, move ETL jobs to BATCH priority to free interactive slots for dashboards:

```python
job_config = bigquery.QueryJobConfig(priority=bigquery.QueryPriority.BATCH)
```

3. Long-term: evaluate slot reservation purchase based on JOBS_TIMELINE analysis. A reservation of 500 slots at ENTERPRISE edition costs approximately $0.04/slot/hour — compare against on-demand queuing cost.

---

### NULL Propagation Hiding Data Quality Issues

**What happens**
The index return calculation model computes: `SAFE_DIVIDE(current_level - previous_level, previous_level)` to get daily returns. For 3 instruments, `previous_level` is NULL (new listings with no prior day). `SAFE_DIVIDE` returns NULL for these rows. The NULL values flow into the downstream `AVG(daily_return)` aggregation, which silently excludes them. The index level is calculated on incomplete constituent data. No error is raised. The published index level is wrong.

**Root cause**
SQL's NULL semantics: any arithmetic operation involving NULL returns NULL. Aggregate functions like `SUM`, `AVG`, `MAX`, and `MIN` silently exclude NULL values. `COUNT(*)` counts NULLs but `COUNT(col)` does not. This is standard SQL behavior, but it means that data quality issues (missing values) are silently absorbed into calculations rather than surfaced as errors. In financial calculations, silent partial data is more dangerous than an explicit failure.

**Consequences**
- Published index levels are calculated on incomplete constituent data with no indication of the issue
- The error is invisible in the output — the result is a number, just the wrong number
- BMR audit trail cannot demonstrate that the calculation used complete data
- NULLs in weights cause `SUM(weight)` to be less than 1.0 without any warning

> [!danger] Silent NULL Propagation
>
> Silent NULL Propagation in Financial Calculations.
> A NULL in a constituent weight silently reduces the effective index weight sum below 100%. The index level appears valid but is calculated on incomplete data. Always assert NULL counts explicitly before aggregation in financial pipelines.

**Prevention protocol**

1. Add NULL rate quality gates after each transformation stage:

```sql
-- Quality check: log NULL rates to audit table
INSERT INTO audit.data_quality_checks (check_date, table_name, column_name, null_count, total_rows, null_rate)
SELECT
  CURRENT_DATE()               AS check_date,
  'index_weights'              AS table_name,
  'weight'                     AS column_name,
  COUNTIF(weight IS NULL)      AS null_count,
  COUNT(*)                     AS total_rows,
  COUNTIF(weight IS NULL) / COUNT(*) AS null_rate
FROM analytics.index_weights
WHERE effective_date = CURRENT_DATE();

-- Fail pipeline if NULL rate exceeds threshold
SELECT IF(
  (SELECT null_rate FROM audit.data_quality_checks
   WHERE check_date = CURRENT_DATE() AND column_name = 'weight') > 0.001,
  ERROR('NULL rate in index_weights.weight exceeds 0.1% threshold'),
  'OK'
);
```

2. Use explicit NULL handling in calculations with documented fallback logic:

```sql
-- BAD: silent NULL propagation
SELECT
  index_code,
  SUM(weight * close_price) AS weighted_price_sum
FROM analytics.index_weights w
JOIN analytics.daily_prices p USING (instrument_isin, price_date)
GROUP BY index_code;

-- GOOD: explicit NULL handling with NULL count logging
SELECT
  index_code,
  SUM(IFNULL(weight, 0) * IFNULL(close_price, 0)) AS weighted_price_sum,
  COUNTIF(weight IS NULL)                           AS null_weight_count,
  COUNTIF(close_price IS NULL)                      AS null_price_count,
  COUNT(*)                                          AS total_constituents
FROM analytics.index_weights w
JOIN analytics.daily_prices p USING (instrument_isin, price_date)
WHERE w.effective_date = '2026-03-22'
  AND p.price_date     = '2026-03-22'
GROUP BY index_code;
-- Then: fail downstream if null_weight_count > 0 for production indices
```

3. Add dbt tests for NULL rates:

```yaml
# models/analytics/schema.yml
models:
  - name: index_weights
    columns:
      - name: weight
        data_tests:
          - not_null
          - dbt_utils.expression_is_true:
              expression: "weight > 0"
      - name: instrument_isin
        data_tests:
          - not_null
          - relationships:
              to: ref('instruments')
              field: isin
```

**Fix procedure**

1. Identify tables and columns with high NULL rates:

```sql
-- NULL audit across critical columns
SELECT column_name,
       COUNTIF(weight IS NULL) AS null_weights,
       COUNTIF(market_cap_usd IS NULL) AS null_mcap,
       COUNT(*) AS total_rows
FROM analytics.index_weights
WHERE effective_date = CURRENT_DATE()
GROUP BY 1;
```

2. For each NULL, trace back to the source: is this a legitimate missing value (new listing, no prior day) or a pipeline defect?
3. Add explicit handling with business rules documented in code comments.
4. Rerun affected calculations after fixing the NULL handling logic.

---

### Materialized View Silently Stale

**What happens**
A client-facing dashboard queries `analytics_mv.index_levels_summary` — a materialized view over `analytics.index_levels`. The base table receives DML updates 20 times per day as indices are recalculated. BigQuery's auto-refresh for the materialized view cannot keep up with the DML frequency. The view exceeds its `max_staleness` window. BigQuery falls back to querying the base table directly — scanning 500GB instead of the 2GB materialized view, costing 250x more per query. Worse, the dashboard team does not know this is happening: queries return results as normal, just slower and more expensive.

**Root cause**
BigQuery materialized views auto-refresh when the base table changes, subject to a `max_staleness` interval. When the base table receives DML faster than the view can refresh, or when refresh jobs fail, the view becomes stale beyond `max_staleness`. BigQuery's fallback behavior is to query the base table directly — this maintains correctness but silently abandons all performance and cost benefits of the materialized view. There is no error or warning surfaced to the querying user.

**Consequences**
- Dashboard query costs increase 50–250x without any visible indication
- Dashboard performance degrades from seconds to minutes
- Reserved slot allocations for dashboard workloads are consumed by unexpectedly large scans
- The materialized view infrastructure creates a false sense of cost control

**Prevention protocol**

1. Monitor materialized view staleness:

```sql
-- Check materialized view freshness
SELECT
  table_name,
  last_refresh_time,
  TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), last_refresh_time, MINUTE) AS minutes_since_refresh,
  refresh_watermark,
  staleness_seconds
FROM `my-project.analytics_mv`.INFORMATION_SCHEMA.MATERIALIZED_VIEWS
ORDER BY minutes_since_refresh DESC;
```

2. Set appropriate `max_staleness` based on business requirements and DML frequency:

```sql
-- Create materialized view with staleness tolerance
CREATE MATERIALIZED VIEW analytics_mv.index_levels_summary
OPTIONS (
  enable_refresh    = TRUE,
  refresh_interval_minutes = 60,
  max_staleness     = INTERVAL 4 HOUR   -- Tolerate up to 4 hours staleness
)
AS
SELECT
  level_date,
  index_code,
  index_level,
  index_return_1d,
  CURRENT_TIMESTAMP() AS _mv_refreshed_at
FROM analytics.index_levels
WHERE level_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY);
```

3. For dashboards on frequently updated tables, trigger manual refresh in the pipeline after DML completes:

```bash
# Trigger materialized view refresh after index level update
bq query \
  --project_id=my-financial-platform \
  --use_legacy_sql=false \
  'CALL BQ.REFRESH_MATERIALIZED_VIEW("my-project.analytics_mv.index_levels_summary")'
```

4. Set up a Cloud Monitoring alert for failed refresh jobs:

```yaml
# Cloud Monitoring alert policy (via Terraform)
resource "google_monitoring_alert_policy" "mv_refresh_failure" {
  display_name = "BigQuery Materialized View Refresh Failure"
  conditions {
    display_name = "MV refresh job failed"
    condition_matched_log {
      filter = <<-EOT
        resource.type="bigquery_resource"
        protoPayload.methodName="google.cloud.bigquery.v2.JobService.InsertJob"
        protoPayload.status.code!=0
        protoPayload.serviceData.jobCompletedEvent.job.jobStatistics.materializedViewStatistics IS NOT NULL
      EOT
    }
  }
  notification_channels = [google_monitoring_notification_channel.pagerduty.id]
}
```

**Fix procedure**

1. Confirm staleness is the issue by checking `last_refresh_time` from INFORMATION_SCHEMA.MATERIALIZED_VIEWS.
2. Manually trigger a refresh:

```bash
bq query --use_legacy_sql=false \
  'CALL BQ.REFRESH_MATERIALIZED_VIEW("my-project.analytics_mv.index_levels_summary")'
```

3. If refreshes keep failing, inspect the reason:

```sql
SELECT state, error_result.reason, error_result.message
FROM `my-project`.`region-eu`.INFORMATION_SCHEMA.JOBS
WHERE job_type = 'QUERY'
  AND REGEXP_CONTAINS(query, r'index_levels_summary')
  AND creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)
ORDER BY creation_time DESC;
```

4. If the base table DML frequency is too high for auto-refresh, disable `enable_refresh`, set `max_staleness` to a large value, and trigger refresh explicitly from the pipeline after the DML completes.

---

## Moderate — Operational Pain

### Schema Evolution Breaks Downstream

**What happens**
The SQL Server gold layer renames the column `close_px` to `close_price` in the `prices` table. The Cloud Run export job immediately picks up the new column name. After the next export, the BigQuery staging table `staging.prices` has a `close_price` column but not `close_px`. All 12 dbt models that reference `close_px` fail with `Unrecognized name: close_px`. Three materialized views break. Five scheduled queries start returning errors. The index calculation pipeline fails. The on-call engineer spends 3 hours tracking down all references.

**Root cause**
BigQuery views, scheduled queries, and dbt models reference table columns by name at query time, not at definition time. A rename in the upstream schema immediately breaks all downstream consumers. BigQuery has no built-in column lineage tracking that can enumerate all consumers of a given column. Finding all dependents requires scanning INFORMATION_SCHEMA.VIEWS and searching scheduled query definitions manually.

**Consequences**
- Cascading failures across all pipeline layers simultaneously
- No centralized way to identify all affected objects without manual investigation
- Index calculation pipeline down until all references are updated
- Risk of missing a reference in a rarely-run query that fails weeks later

**Prevention protocol**

1. Enable dbt contracts and `on_schema_change: fail` to catch schema changes at dbt run time:

```yaml
# models/staging/schema.yml
models:
  - name: stg_prices
    config:
      contract:
        enforced: true
    columns:
      - name: close_price
        data_type: NUMERIC
        constraints:
          - type: not_null
      - name: price_date
        data_type: DATE
        constraints:
          - type: not_null
```

2. Find all views referencing a specific column before making source changes:

```sql
-- Find all views and scheduled queries referencing a column name
SELECT
  table_name,
  view_definition
FROM `my-project.analytics`.INFORMATION_SCHEMA.VIEWS
WHERE REGEXP_CONTAINS(view_definition, r'\bclose_px\b');

-- Also check across all datasets
SELECT table_schema, table_name, view_definition
FROM `my-project`.`region-eu`.INFORMATION_SCHEMA.VIEWS
WHERE REGEXP_CONTAINS(view_definition, r'\bclose_px\b');
```

3. Use column aliasing as a migration bridge: add the new column alongside the old one with an alias:

```sql
-- Migration step: keep both column names temporarily
ALTER TABLE staging.prices ADD COLUMN close_price NUMERIC;
UPDATE staging.prices SET close_price = close_px WHERE TRUE;
-- Downstream migrations can proceed incrementally before dropping close_px
```

4. Add integration tests in CI that run after schema changes:

```yaml
# .github/workflows/bigquery-schema-tests.yml
- name: Run dbt schema tests
  run: |
    dbt test --select staging --store_failures
    dbt test --select analytics --store_failures
```

**Fix procedure**

1. Run the INFORMATION_SCHEMA query above to enumerate all affected views.
2. List all scheduled queries via CLI:

```bash
bq ls --transfer_config --transfer_location=EU --project_id=my-financial-platform
bq show --transfer_config <transfer_config_id>
```

3. Update all dbt models, views, and scheduled queries to use the new column name.
4. Run `dbt compile` first to catch any missed references before executing.
5. Redeploy all updated objects in dependency order.

---

### Scheduled Query Fails Silently

**What happens**
A scheduled query refreshes `analytics.esg_aggregates` daily at 06:00. The service account used by the scheduled query had its `bigquery.jobs.create` role removed during a quarterly IAM review. Starting Monday, the query fails with `Access Denied: BigQuery: Permission denied`. No alert is configured. The failure is discovered on Wednesday when an analyst notices stale ESG data. Three days of ESG aggregate data is missing.

**Root cause**
BigQuery scheduled queries run under a service account and log results to INFORMATION_SCHEMA.JOBS. However, failures do not proactively notify anyone — there is no built-in alerting for scheduled query failures. Cloud Monitoring can alert on BigQuery job failures, but this requires explicit configuration. The default state is silent failure.

**Consequences**
- Data consumers discover stale data days after the failure, with no context on when it stopped working
- Backfilling 3 days of aggregates may require manual intervention and re-running expensive queries
- Regulatory gap: ESG data used in client reports was stale for 3 days without detection

**Prevention protocol**

1. Monitor scheduled query failures with a daily INFORMATION_SCHEMA check:

```sql
-- Find all failed scheduled queries in the last 24 hours
SELECT
  job_id,
  user_email,
  creation_time,
  error_result.reason  AS error_reason,
  error_result.message AS error_message,
  LEFT(query, 200)     AS query_preview
FROM `my-project`.`region-eu`.INFORMATION_SCHEMA.JOBS
WHERE
  creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
  AND job_type = 'QUERY'
  AND state    = 'DONE'
  AND error_result IS NOT NULL
ORDER BY creation_time DESC;
```

2. Create a Cloud Monitoring alert for BigQuery job failures:

```hcl
# Terraform: alert on scheduled query failures
resource "google_monitoring_alert_policy" "scheduled_query_failures" {
  display_name = "BigQuery Scheduled Query Failure"
  combiner     = "OR"

  conditions {
    display_name = "Scheduled query job failed"
    condition_matched_log {
      filter = <<-EOT
        resource.type="bigquery_resource"
        severity="ERROR"
        protoPayload.methodName="google.cloud.bigquery.v2.JobService.InsertJob"
      EOT
      label_extractors = {
        "job_id" = "EXTRACT(protoPayload.serviceData.jobCompletedEvent.job.jobName.jobId)"
      }
    }
  }

  notification_channels = [
    google_monitoring_notification_channel.slack_data_engineering.name,
    google_monitoring_notification_channel.pagerduty.name
  ]

  severity = "WARNING"
}
```

3. Verify scheduled query service account permissions after IAM changes:

```bash
# List all scheduled query service accounts
bq ls --transfer_config --transfer_location=EU | grep -i service_account

# Verify a service account has required roles
gcloud projects get-iam-policy my-financial-platform \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:bq-scheduled-queries@my-financial-platform.iam.gserviceaccount.com"
```

**Fix procedure**

1. Identify the failed scheduled query and its service account:

```bash
bq ls --transfer_config --transfer_location=EU --project_id=my-financial-platform
bq show --transfer_config <config_id>
```

2. Restore the required IAM roles:

```bash
gcloud projects add-iam-policy-binding my-financial-platform \
  --member="serviceAccount:bq-scheduled-queries@my-financial-platform.iam.gserviceaccount.com" \
  --role="roles/bigquery.jobUser"

gcloud projects add-iam-policy-binding my-financial-platform \
  --member="serviceAccount:bq-scheduled-queries@my-financial-platform.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataEditor"
```

3. Manually trigger a backfill run for each missed date via the Cloud Console or Transfer API.
4. Add the monitoring alert from the prevention section to prevent silent failures going forward.

---

### Cross-Region Query Costs

**What happens**
The BigQuery dataset `analytics` is located in `EU` (multi-region). A Cloud Run job deployed in `us-central1` submits query jobs to this dataset. BigQuery processes the query in the EU region, but the job submission originates from the US. Although BigQuery query costs are region-agnostic for data-at-rest, the query results (potentially several GB) are transferred back to the US Cloud Run instance, incurring network egress charges of $0.08–$0.12/GB. A job that transfers 50GB of results per day costs $4/day ($1,460/year) just in egress.

**Root cause**
BigQuery stores data in the specified region. Query compute runs in that region. Results delivered to a client outside that region traverse Google's network. Egress from GCP regions to external IPs or other regions incurs data transfer charges. Additionally, cross-region queries may have higher latency due to round-trip network overhead.

**Consequences**
- Unexpected egress costs accumulate silently — not visible in BigQuery billing line items
- Higher latency for Cloud Run jobs in a different region than the dataset
- Data residency complications for EU GDPR compliance if results traverse US infrastructure

**Prevention protocol**

1. Deploy all compute resources (Cloud Run, Cloud Functions, Dataflow) in the same region as the BigQuery dataset:

```hcl
# Terraform: enforce region consistency
variable "gcp_region" {
  default = "europe-west4"  # Netherlands — single region within EU multi-region
}

resource "google_cloud_run_service" "bq_export_job" {
  name     = "bq-export-job"
  location = var.gcp_region   # Same region as BigQuery data
}

resource "google_bigquery_dataset" "analytics" {
  dataset_id = "analytics"
  location   = "EU"           # BigQuery multi-region covers europe-west4
}
```

2. Use dataset replicas for cross-region access patterns if unavoidable:

```hcl
# Cross-region dataset replica (BigQuery Editions required)
resource "google_bigquery_dataset" "analytics_us_replica" {
  dataset_id = "analytics_us"
  location   = "US"

  # Configure replication from EU source
}
```

3. Check network egress costs separately in Cloud Billing by filtering on service `Cloud Storage` and `Networking`:

```bash
# Cloud Billing export analysis for egress costs
bq query --use_legacy_sql=false \
  "SELECT service.description, SUM(cost) AS total_cost
   FROM \`my-billing-project.billing_export.gcp_billing_export_v1_*\`
   WHERE DATE(usage_start_time) >= '2026-01-01'
     AND service.description LIKE '%Networking%'
   GROUP BY 1 ORDER BY 2 DESC"
```

**Fix procedure**

1. Identify cross-region compute deployments:

```bash
gcloud run services list --format="table(name,region)" --project=my-financial-platform
gcloud functions list --format="table(name,region)" --project=my-financial-platform
```

2. Redeploy any services running in a different region than the BigQuery dataset.
3. For Airflow (Cloud Composer), verify the environment is in the same region as BigQuery.

---

### DML Concurrency Conflict on Same Table

**What happens**
Two Airflow tasks run concurrently: one inserts new index level rows for today into `analytics.index_levels`, and another updates historical rows for a corporate action adjustment. Both target the same table simultaneously. One task fails with: `Table "index_levels" is currently busy. Please try again later.` This is distinct from the 20-slot quota issue — this is a per-table concurrency conflict on DML operations.

**Root cause**
BigQuery serializes DML operations on the same table at the partition level for some operations (INSERT into different partitions can be concurrent), but UPDATE and DELETE acquire table-level locks. A concurrent INSERT and UPDATE/DELETE on the same table will conflict. MERGE operations also acquire exclusive locks during execution. The conflict resolution is immediate failure — BigQuery does not queue the second operation.

**Consequences**
- One of two simultaneous DML operations always fails, requiring retry logic
- Partial pipeline state: some data is written, some is not
- Complex retry logic is needed in Airflow to handle BQ concurrency conflicts without double-counting

**Prevention protocol**

1. Serialize DML operations per table using Airflow task dependencies:

```python
from airflow import DAG
from airflow.providers.google.cloud.operators.bigquery import BigQueryInsertJobOperator

with DAG("index_levels_refresh", ...) as dag:

    insert_new_levels = BigQueryInsertJobOperator(
        task_id="insert_new_index_levels",
        configuration={"query": {"query": INSERT_SQL, "useLegacySql": False}},
        project_id="my-financial-platform",
    )

    apply_ca_adjustments = BigQueryInsertJobOperator(
        task_id="apply_corporate_action_adjustments",
        configuration={"query": {"query": UPDATE_SQL, "useLegacySql": False}},
        project_id="my-financial-platform",
    )

    # Ensure sequential execution on the same table
    insert_new_levels >> apply_ca_adjustments
```

2. Use partition-scoped operations where possible to minimize lock scope:

```sql
-- Target specific partition only — narrower lock scope
INSERT INTO analytics.index_levels
PARTITION (level_date = '2026-03-22')
SELECT * FROM staging.index_levels_today;

-- Partition DELETE instead of table-level UPDATE
DELETE FROM analytics.index_levels
WHERE level_date = '2026-03-22'
  AND index_code = 'MSCI_WORLD';
```

3. Implement retry with exponential backoff in Cloud Run export jobs:

```python
import time
from google.api_core.exceptions import GoogleAPIError
from google.cloud import bigquery

def run_dml_with_retry(client: bigquery.Client, query: str, max_retries: int = 5) -> None:
    for attempt in range(max_retries):
        try:
            job = client.query(query)
            job.result()
            return
        except GoogleAPIError as e:
            if "currently busy" in str(e).lower() and attempt < max_retries - 1:
                wait_secs = (2 ** attempt) + 1  # Exponential backoff: 3, 5, 9, 17s
                print(f"Table busy, retry {attempt + 1}/{max_retries} in {wait_secs}s")
                time.sleep(wait_secs)
            else:
                raise
```

**Fix procedure**

1. Identify the conflicting jobs:

```sql
SELECT job_id, statement_type, start_time, error_result.message
FROM `my-project`.`region-eu`.INFORMATION_SCHEMA.JOBS
WHERE creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
  AND statement_type IN ('INSERT', 'UPDATE', 'DELETE', 'MERGE')
  AND error_result IS NOT NULL
ORDER BY start_time;
```

2. Re-run the failed task after the conflicting operation completes.
3. Add sequential task ordering in the Airflow DAG for all tasks targeting the same table.

---

### External Table Performance Trap

**What happens**
A data engineer creates an external table pointing to Parquet files in GCS as a quick way to query staging data. The table works correctly. However, every query against it reads directly from GCS with no caching, no clustering, no statistics. A query that takes 2 seconds on a native BigQuery table takes 25 seconds on the external table. Dashboards using the external table for "live" data are slow and expensive.

**Root cause**
BigQuery external tables (a.k.a. federated queries) read data from GCS, Cloud Bigtable, Google Sheets, or Cloud SQL at query time. There is no Capacitor columnar format, no clustering, no statistics collection, and no query cache. Each query reads raw files from GCS, paying GCS read API costs and BigQuery processing costs. For Parquet files, column projection works (only referenced columns are read), but row filtering requires reading and decoding all rows in all files.

**Consequences**
- Queries 5–20x slower than equivalent native BigQuery tables
- No benefit from BigQuery's optimizations (clustering, partition pruning, caching)
- GCS data reads are not cached — repeated identical queries pay full cost each time
- External table queries cannot benefit from BI Engine acceleration

**Prevention protocol**

1. Use external tables only for the landing/staging zone — never in production analytical workloads:

```sql
-- External table: acceptable for one-off ingestion verification
CREATE EXTERNAL TABLE staging_ext.prices_landing
OPTIONS (
  format = 'PARQUET',
  uris   = ['gs://my-platform-staging/prices/dt=2026-03-23/*.parquet']
);

-- Immediately load into native table for all downstream use
CREATE TABLE staging.prices_20260323
AS SELECT * FROM staging_ext.prices_landing;
```

2. Automate the GCS → native table load in the Cloud Run export pipeline:

```bash
# bq load: free, fast, produces native table with full optimization
bq load \
  --project_id=my-financial-platform \
  --location=EU \
  --source_format=PARQUET \
  --time_partitioning_field=price_date \
  --time_partitioning_type=DAY \
  --clustering_fields=index_code,instrument_isin \
  analytics.daily_prices \
  'gs://my-platform-staging/prices/dt=2026-03-23/*.parquet'
```

3. Document the architectural principle:

```yaml
# data_platform_principles.yml
bigquery:
  external_tables:
    allowed_uses:
      - staging_zone_validation
      - one_off_migration_queries
    prohibited_uses:
      - production_analytical_queries
      - dashboard_data_sources
      - dbt_source_tables_in_production
```

**Fix procedure**

1. Identify external tables in production datasets:

```sql
SELECT table_name, table_type, external_data_configuration.source_format
FROM `my-project.analytics`.INFORMATION_SCHEMA.TABLES
WHERE table_type = 'EXTERNAL';
```

2. For each external table used by dashboards or dbt, replace with a native table populated by a load job.
3. Update dbt sources to point to the native table.
4. Drop the external table after confirming all consumers use the native table.

---

### Authorized View + Column-Level Security Conflict

**What happens**
The data team creates an authorized view `analytics_restricted.index_levels_public` that exposes only non-sensitive columns to external clients. The authorized view is granted access to the source table `analytics.index_levels`. An external client queries the view and receives `Access Denied: BigQuery BigQuery: Permission denied while reading table analytics.index_levels, column: benchmark_fee`. The view was not designed to expose `benchmark_fee`, but column-level security on the source table evaluates access using the querying user's identity, not the view's identity.

**Root cause**
BigQuery authorized views allow a view to access a table even if the querying user does not have direct table access — but column-level security (policy tags) is evaluated against the **end user's identity**, not the view's identity. If the end user lacks access to a policy-tagged column and that column exists in the source table (even if not selected by the view), the query may fail depending on how the policy tag is configured.

**Consequences**
- External clients receive cryptic Access Denied errors on what appears to be a permitted operation
- The authorized view mechanism does not fully isolate users from column-level policies
- Debugging requires understanding the interaction between authorized views, policy tags, and IAM

**Prevention protocol**

1. Document the security model for each authorized view:

```sql
-- Always test authorized views with the actual service account of the consumer
-- Use bq query with impersonation to verify
bq --impersonate_service_account=external-client@my-financial-platform.iam.gserviceaccount.com \
  query --use_legacy_sql=false \
  'SELECT * FROM analytics_restricted.index_levels_public LIMIT 1'
```

2. Remove policy tags from columns before creating authorized views, or use separate base tables for restricted access patterns:

```sql
-- Create a separate sanitized base table for external views
CREATE TABLE analytics_restricted.index_levels_external AS
SELECT
  level_date,
  index_code,
  index_level,
  index_return_1d
  -- Deliberately omit: benchmark_fee, internal_methodology_notes
FROM analytics.index_levels;
```

3. Use row-level security (row access policies) instead of column-level security when the access pattern is user-specific:

```sql
CREATE ROW ACCESS POLICY index_levels_external_access
ON analytics.index_levels
GRANT TO ("serviceAccount:external-client@my-financial-platform.iam.gserviceaccount.com")
FILTER USING (is_published = TRUE);
```

**Fix procedure**

1. Check which policy tags exist on the source table columns:

```bash
bq show --schema --format=prettyjson my-project:analytics.index_levels | \
  jq '.[] | select(.policyTags) | {name, policyTags}'
```

2. Grant the external user access to the specific policy tags they need, or remove the policy tag from columns not selected by the authorized view.
3. Test the fix with the consumer's service account before declaring resolved.

---

### INFORMATION_SCHEMA Queries Are Expensive

**What happens**
An engineer writes a cost monitoring query: `SELECT * FROM INFORMATION_SCHEMA.JOBS`. On a busy project with hundreds of jobs per day, this query scans days of job history metadata. The query processes several GB and costs $0.02–$0.10 per run. Scheduled to run every hour for cost monitoring, it costs $50/month in monitoring overhead — spending money to find where money is being spent.

**Root cause**
`INFORMATION_SCHEMA` tables in BigQuery contain metadata about jobs, tables, and schemas. `INFORMATION_SCHEMA.JOBS` stores the full query text, statistics, and metadata for every job in the project. Without a `creation_time` filter, it scans all available history (up to 180 days for JOBS). This metadata storage is substantial on active projects. Always constrain INFORMATION_SCHEMA queries with time bounds and use the most specific view available.

**Consequences**
- Cost monitoring infrastructure itself becomes a significant cost center
- Slow metadata queries give the impression of BigQuery being slow
- `SELECT *` on INFORMATION_SCHEMA views retrieves dozens of columns, many of which are large nested structs

**Prevention protocol**

1. Always add a `creation_time` filter and select only needed columns:

```sql
-- BAD: no time filter, SELECT *
SELECT * FROM `my-project`.`region-eu`.INFORMATION_SCHEMA.JOBS;

-- GOOD: time-bounded, column-selective
SELECT
  job_id,
  user_email,
  creation_time,
  total_bytes_processed,
  total_bytes_billed,
  statement_type,
  error_result.message AS error_message,
  LEFT(query, 500)     AS query_preview
FROM `my-project`.`region-eu`.INFORMATION_SCHEMA.JOBS
WHERE
  creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
  AND job_type = 'QUERY'
ORDER BY total_bytes_processed DESC
LIMIT 100;
```

2. Use `JOBS_BY_PROJECT` instead of `JOBS` to limit scope, and `JOBS_BY_USER` for user-specific monitoring:

```sql
-- Project-scoped view (faster than JOBS for project-level monitoring)
SELECT job_id, creation_time, total_bytes_processed
FROM `my-project`.`region-eu`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR);
```

3. For regular cost monitoring, use the BigQuery billing export to Cloud Storage instead of INFORMATION_SCHEMA:

```sql
-- Cloud Billing export (much cheaper for historical analysis)
SELECT
  DATE(usage_start_time)   AS usage_date,
  service.description      AS service,
  SUM(cost)                AS total_cost
FROM `my-billing-project.billing_export.gcp_billing_export_v1_*`
WHERE DATE(usage_start_time) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  AND service.description = 'BigQuery'
GROUP BY 1, 2
ORDER BY 1 DESC;
```

**Fix procedure**

1. Add `creation_time` filters to all existing INFORMATION_SCHEMA monitoring queries.
2. Check the cost of existing monitoring queries:

```sql
SELECT job_id, ROUND(total_bytes_billed / POW(1024, 3) * 0.00625, 4) AS cost_usd, query
FROM `my-project`.`region-eu`.INFORMATION_SCHEMA.JOBS
WHERE REGEXP_CONTAINS(query, r'INFORMATION_SCHEMA')
  AND creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
ORDER BY total_bytes_billed DESC;
```

3. Rewrite any query costing more than $0.01 per execution to include proper time bounds.

---

### Time Travel Expiry — Can't Reproduce Historical Calculation

**What happens**
A client challenges the index level published on 2026-03-10, which is 14 days ago. The EU BMR requires the data provider to demonstrate reproducibility of the calculation. A data engineer attempts to query the historical state of `analytics.index_weights` as of that date: `SELECT * FROM analytics.index_weights FOR SYSTEM_TIME AS OF '2026-03-10 00:00:00'`. The query fails: `Time travel is not supported for the given timestamp`. BigQuery's time travel window for that table is 7 days. The historical state is gone.

**Root cause**
BigQuery time travel retains all versions of table data for a configurable window (default: 7 days, maximum: 7 days). After expiry, historical versions are permanently deleted. For a financial platform under EU BMR regulation, 7 days of time travel is grossly insufficient — regulatory inquiries can arrive months after the fact. The solution requires a separate snapshot or export strategy for long-term audit retention.

**Consequences**
- Inability to reproduce a published index level for regulatory audit
- Potential regulatory breach under EU BMR Article 11 (record-keeping requirements)
- Client disputes cannot be investigated with precision
- Legal liability if the calculation cannot be demonstrated to be correct

> [!danger] EU BMR Record-Keeping
>
> EU BMR requires data and methodology to be retained for a minimum of 5 years. BigQuery's 7-day time travel provides zero regulatory compliance. A dedicated snapshot and archival strategy is mandatory for all tables that feed client-published index levels.

**Prevention protocol**

1. Set time travel window to maximum on all critical tables:

```sql
ALTER TABLE analytics.index_weights
SET OPTIONS (max_time_travel_hours = 168);  -- 7 days maximum

ALTER TABLE analytics.index_levels
SET OPTIONS (max_time_travel_hours = 168);
```

2. Create daily snapshots of all tables that feed published outputs:

```python
# cloud_run/daily_snapshot.py — runs after each daily index calculation

from google.cloud import bigquery
from datetime import date, timedelta

SNAPSHOT_TABLES = [
    "analytics.index_levels",
    "analytics.index_weights",
    "analytics.daily_prices",
    "analytics.corporate_actions",
]

def create_daily_snapshots(project_id: str, snapshot_dataset: str = "audit_snapshots"):
    client = bigquery.Client(project=project_id)
    today = date.today().strftime("%Y%m%d")
    expiry = date.today() + timedelta(days=365 * 5)  # 5-year retention for BMR

    for source_table in SNAPSHOT_TABLES:
        table_name = source_table.split(".")[1]
        snapshot_table = f"{project_id}.{snapshot_dataset}.{table_name}_snapshot_{today}"

        query = f"""
        CREATE SNAPSHOT TABLE `{snapshot_table}`
        CLONE `{project_id}.{source_table}`
        OPTIONS (
          expiration_timestamp = TIMESTAMP '{expiry.strftime("%Y-%m-%d")} 00:00:00 UTC'
        )
        """
        client.query(query).result()
        print(f"Created snapshot: {snapshot_table}")
```

3. Export critical tables to GCS as Parquet for long-term archival:

```bash
# Daily export to GCS — retained by GCS lifecycle policy
bq extract \
  --project_id=my-financial-platform \
  --location=EU \
  --destination_format=PARQUET \
  --compression=SNAPPY \
  "analytics.index_levels" \
  "gs://my-platform-audit-archive/index_levels/dt=$(date +%Y%m%d)/*.parquet"
```

4. Configure GCS bucket lifecycle for long-term retention:

```hcl
resource "google_storage_bucket" "audit_archive" {
  name     = "my-platform-audit-archive"
  location = "EU"

  lifecycle_rule {
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
    condition {
      age = 90  # Move to Nearline after 90 days
    }
  }

  lifecycle_rule {
    action {
      type          = "SetStorageClass"
      storage_class = "COLDLINE"
    }
    condition {
      age = 365  # Move to Coldline after 1 year
    }
  }

  retention_policy {
    retention_period = 157766400  # 5 years in seconds
    is_locked        = true       # Immutable — prevents tampering
  }
}
```

**Fix procedure**

1. For data within 7 days: use `FOR SYSTEM_TIME AS OF` with a timestamp within the window.
2. For data beyond 7 days: restore from the daily snapshot table:

```sql
-- Query historical state from daily snapshot
SELECT *
FROM `my-project.audit_snapshots.index_weights_snapshot_20260310`
WHERE index_code = 'MSCI_WORLD';
```

3. If no snapshot exists: restore from GCS Parquet export:

```bash
bq load \
  --source_format=PARQUET \
  audit_recovery.index_weights_20260310 \
  'gs://my-platform-audit-archive/index_weights/dt=20260310/*.parquet'
```

4. Implement the snapshot creation pipeline from prevention step 2 immediately to prevent recurrence.

---

## Low — Annoyances / Technical Debt

### No `require_partition_filter` Enforced

**What happens**
The `analytics.daily_prices` table is partitioned by `price_date` to improve query performance and reduce costs. However, the `require_partition_filter` option is not enabled. Analysts routinely run queries without date filters — `SELECT instrument_isin, AVG(close_price) FROM analytics.daily_prices WHERE index_code = 'MSCI_WORLD'` — triggering full table scans on every execution. The partition structure provides no cost benefit because nothing forces its use.

**Root cause**
BigQuery's `require_partition_filter` is an opt-in table option. It must be explicitly set. When disabled (the default), queries without partition filters succeed — they simply scan the entire table. This is a sensible default for flexibility but creates a cost risk in production tables.

**Consequences**
- Partition investment provides zero ROI if queries don't use it
- Cost and performance are equivalent to an unpartitioned table for unfiltered queries
- Difficult to enforce through code review alone — needs to be enforced at the table level

**Prevention protocol**

1. Enable on all production partitioned tables:

```sql
-- Enable on individual table
ALTER TABLE analytics.daily_prices
SET OPTIONS (require_partition_filter = TRUE);

-- Verify it's enabled
SELECT table_name, option_name, option_value
FROM `my-project.analytics`.INFORMATION_SCHEMA.TABLE_OPTIONS
WHERE option_name = 'require_partition_filter'
  AND option_value = 'TRUE';
```

2. Include in Terraform resource definitions as non-negotiable:

```hcl
resource "google_bigquery_table" "daily_prices" {
  time_partitioning {
    type                     = "DAY"
    field                    = "price_date"
    require_partition_filter = true  # Always set for production tables
  }
}
```

3. Audit all partitioned tables for missing enforcement:

```sql
SELECT t.table_name, t.row_count,
       ROUND(t.size_bytes / POW(1024, 3), 2) AS size_gb,
       o.option_value AS partition_filter_required
FROM `my-project.analytics`.INFORMATION_SCHEMA.TABLE_STORAGE t
LEFT JOIN `my-project.analytics`.INFORMATION_SCHEMA.TABLE_OPTIONS o
  ON  t.table_name  = o.table_name
  AND o.option_name = 'require_partition_filter'
WHERE t.table_type = 'BASE TABLE'
ORDER BY t.size_bytes DESC;
-- Tables with NULL option_value need require_partition_filter = TRUE
```

**Fix procedure**

Run `ALTER TABLE ... SET OPTIONS (require_partition_filter = TRUE)` on all partitioned production tables identified in the audit query. Test immediately with a dry-run to confirm partition filters are being applied by existing queries. Fix any queries that break.

---

### Label/Tag Discipline Missing

**What happens**
After 18 months of production operation, the finance team asks which teams and pipelines are responsible for the $45,000 monthly BigQuery bill. Without job labels, it is impossible to break down costs by team, pipeline, or data domain. INFORMATION_SCHEMA.JOBS shows `user_email` (service accounts, not teams) but no business context. Every cost inquiry requires manual cross-referencing of service account names to team ownership — a multi-hour exercise with imprecise results.

**Root cause**
BigQuery supports labels on datasets, tables, and query jobs. Labels are key-value pairs that propagate to Cloud Billing export data, enabling cost attribution by any dimension. Labels must be applied at the time of resource creation or job submission — they cannot be retroactively applied to completed jobs.

**Consequences**
- Cost attribution by team, environment, or business domain is impossible
- Showback/chargeback models cannot be implemented
- Identifying the owner of expensive queries requires detective work
- No way to set team-level budget alerts in Cloud Monitoring

**Prevention protocol**

1. Apply labels to all Terraform-managed resources:

```hcl
resource "google_bigquery_dataset" "analytics" {
  dataset_id = "analytics"
  location   = "EU"

  labels = {
    env         = "production"
    team        = "data-engineering"
    domain      = "index-data"
    cost_center = "cc-data-platform"
  }
}

resource "google_bigquery_table" "index_levels" {
  labels = {
    env         = "production"
    team        = "index-engineering"
    domain      = "index-levels"
    criticality = "high"
    bmr_scope   = "true"
  }
}
```

2. Apply labels to dbt query jobs:

```yaml
# profiles.yml — labels on all dbt jobs
production:
  type: bigquery
  job_labels:
    orchestrator: "dbt"
    environment: "production"
    team: "data-engineering"
    pipeline: "{{ env_var('DBT_PIPELINE_NAME', 'unknown') }}"
```

3. Apply labels in Python BigQuery client for Cloud Run jobs:

```python
job_config = bigquery.QueryJobConfig(
    labels={
        "pipeline":    "index-level-export",
        "team":        "data-engineering",
        "environment": "production",
        "cost_center": "cc-data-platform",
    }
)
```

4. Cost breakdown by label in Cloud Billing export:

```sql
SELECT
  labels.key,
  labels.value,
  SUM(cost) AS total_cost_usd
FROM `my-billing-project.billing_export.gcp_billing_export_v1_*`
CROSS JOIN UNNEST(labels) AS labels
WHERE DATE(usage_start_time) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  AND service.description = 'BigQuery'
GROUP BY 1, 2
ORDER BY total_cost_usd DESC;
```

**Fix procedure**

1. Identify unlabeled tables and datasets:

```sql
SELECT table_name
FROM `my-project.analytics`.INFORMATION_SCHEMA.TABLES
WHERE table_name NOT IN (
  SELECT DISTINCT table_name
  FROM `my-project.analytics`.INFORMATION_SCHEMA.TABLE_OPTIONS
  WHERE option_name = 'labels'
);
```

2. Add labels to all resources via Terraform import + label addition. For datasets/tables not yet in Terraform, import them first.
3. Going forward: add label requirements to PR review checklist and CI checks.

---

### Wildcard Table Queries (Legacy Sharding)

**What happens**
A legacy data pipeline from 2021 creates date-sharded tables: `prices_20260101`, `prices_20260102`, ..., `prices_20260322`. A scheduled query aggregates across all of them using `FROM prices_*`. BigQuery treats the `_TABLE_SUFFIX` filter as a partition-equivalent filter, but without a `_TABLE_SUFFIX` predicate, all tables are scanned. The pattern is also incompatible with clustering, cannot benefit from `require_partition_filter`, and makes schema evolution across shards difficult.

**Root cause**
Date sharding was a common BigQuery pattern before native partitioning was mature. It provides approximate partition pruning via `_TABLE_SUFFIX` filters, but is strictly inferior to native partitioning in every dimension: cost (table metadata overhead), performance (multiple table opens), manageability (schema consistency across shards), and clustering (unavailable on wildcard queries).

**Consequences**
- `FROM prices_*` without `_TABLE_SUFFIX` scans all historical shards — potentially years of data
- New analysts are unaware of the `_TABLE_SUFFIX` convention and write queries without it
- Schema changes require updating every shard individually
- Cannot use `require_partition_filter` to enforce filter discipline

**Prevention protocol**

1. Always use `_TABLE_SUFFIX` filter in wildcard queries as an immediate mitigation:

```sql
-- BAD: scans all shards
SELECT * FROM `my-project.analytics.prices_*`;

-- GOOD: filter to recent shards
SELECT *
FROM `my-project.analytics.prices_*`
WHERE _TABLE_SUFFIX BETWEEN '20260101' AND '20260322';
```

2. Migrate from sharded tables to a single partitioned table:

```bash
# Step 1: Create target partitioned table
bq query --use_legacy_sql=false "
CREATE TABLE analytics.prices_partitioned (
  price_date DATE NOT NULL,
  instrument_isin STRING NOT NULL,
  close_price NUMERIC
)
PARTITION BY price_date
CLUSTER BY instrument_isin
OPTIONS (require_partition_filter = TRUE)
"

# Step 2: Load all shards via wildcard load job
bq query --use_legacy_sql=false "
INSERT INTO analytics.prices_partitioned
SELECT * FROM \`my-project.analytics.prices_*\`
"
```

After running the migration commands, complete the cutover:

3. Validate that row counts match between the sharded tables and the new partitioned table.
4. Update all consumers (scheduled queries, dbt models, dashboards) to reference the new table.
5. Drop the sharded tables after a validation period confirms no regressions.

**Fix procedure**

1. Identify all wildcard table patterns in scheduled queries and dbt models:

```sql
SELECT table_name FROM `my-project.analytics`.INFORMATION_SCHEMA.TABLES
WHERE REGEXP_CONTAINS(table_name, r'_\d{8}$')  -- Date-sharded pattern
ORDER BY table_name;
```

2. Add `_TABLE_SUFFIX` filters to all existing wildcard queries immediately.
3. Schedule migration to a partitioned table for the next maintenance window.

---

### BI Engine Cache Misses

**What happens**
The team purchases a 10GB BI Engine reservation for the EU region to accelerate dashboard queries. After deployment, cache hit rates are below 20%. Investigation reveals that Looker Studio dashboards are using dynamic date range parameters (`last_N_days` relative filters) that generate a different SQL query text on each execution. BI Engine caches by query hash — each unique query string is treated as a cache miss. The BI Engine reservation is consuming budget without delivering the expected speedup.

**Root cause**
BI Engine uses an in-memory cache keyed on query hash (the exact SQL text). Queries with dynamic parameters, user-specific filters, or timestamp-based expressions (`CURRENT_DATE()`, `NOW()`) generate unique SQL strings on each execution, preventing cache reuse. Queries must be structurally identical (same SQL text, same parameters) to benefit from BI Engine caching.

**Consequences**
- BI Engine reservation cost ($X/GB/hour) is wasted if cache hit rate is low
- Dashboard performance does not improve despite the reservation spend
- Difficult to diagnose without cache hit rate monitoring

**Prevention protocol**

1. Monitor BI Engine cache hit rates:

```sql
-- BI Engine usage metrics from INFORMATION_SCHEMA
SELECT
  DATE(creation_time)          AS query_date,
  bi_reservation_usage.reservation_id,
  COUNTIF(bi_reservation_usage.input_to_cache = TRUE)   AS cache_writes,
  COUNTIF(bi_reservation_usage.accelerated = TRUE)      AS cache_hits,
  COUNT(*)                                               AS total_queries,
  SAFE_DIVIDE(
    COUNTIF(bi_reservation_usage.accelerated = TRUE),
    COUNT(*)
  )                                                      AS hit_rate
FROM `my-project`.`region-eu`.INFORMATION_SCHEMA.JOBS,
     UNNEST(bi_reservation_usage) AS bi_reservation_usage
WHERE creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
GROUP BY 1, 2
ORDER BY 1 DESC;
```

2. Parameterize queries to maximize structural similarity:

```sql
-- BAD: CURRENT_DATE() generates unique query string every day
SELECT * FROM analytics.index_levels
WHERE level_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY);

-- GOOD: use a fixed date parameter that BI tool can cache
-- In Looker Studio: use a date parameter that produces the same SQL for the same selection
SELECT * FROM analytics.index_levels
WHERE level_date >= @start_date AND level_date <= @end_date;
```

3. Use BI Engine preferred tables to pre-load specific tables into memory:

```hcl
# BI Engine preferred tables guarantee these tables stay in cache
resource "google_bigquery_bi_reservation" "analytics" {
  location = "EU"
  size     = 10737418240  # 10 GB

  preferred_tables {
    project_id = "my-financial-platform"
    dataset_id = "analytics_mv"
    table_id   = "index_levels_summary"
  }
}
```

**Fix procedure**

1. Calculate current BI Engine utilization value (cost vs cache hits).
2. Identify the top queries served from BI Engine datasets and check if they're cacheable.
3. Rewrite dynamic SQL in dashboard tools to use fixed parameters.
4. If cache hit rate remains below 30% after parameterization, reduce BI Engine reservation size and redirect budget to reserved slots.

---

### Stale Views After Source Rename

**What happens**
The `staging.instruments` table is renamed to `staging.instruments_master` during a data model refactoring. The rename is done with `bq cp` followed by `bq rm`. Fifteen BigQuery views in `analytics` and `analytics_restricted` reference `staging.instruments`. After the rename, none of the views fail at definition time — BigQuery views are not validated at creation. They fail only when queried: `Table 'staging.instruments' was not found`. An analyst running a report at 08:00 discovers 15 broken views.

**Root cause**
BigQuery views store the view definition as a SQL string and validate it only at query execution time, not at definition time. A view referencing a renamed or dropped table remains in a syntactically valid but semantically broken state until someone queries it. There is no built-in dependency tracking that proactively notifies view owners when a referenced table changes.

**Consequences**
- Silent breakage: views appear healthy in the schema browser but fail when queried
- Discovery during business hours causes analyst-visible failures
- Without lineage tracking, enumerating all affected views requires scanning all view definitions

**Prevention protocol**

1. Before renaming any table, enumerate all views that reference it:

```sql
-- Find all views referencing a specific table
SELECT
  table_schema AS view_dataset,
  table_name   AS view_name,
  view_definition
FROM `my-project`.`region-eu`.INFORMATION_SCHEMA.VIEWS
WHERE REGEXP_CONTAINS(view_definition, r'`?staging\.instruments`?')
   OR REGEXP_CONTAINS(view_definition, r'"staging"\s*\.\s*"instruments"')
ORDER BY view_dataset, view_name;
```

2. Add a CI check that validates all views compile after schema changes:

```python
# ci/validate_views.py
from google.cloud import bigquery

def validate_all_views(project_id: str, dataset_id: str) -> list[str]:
    """Run dry-run query against every view to detect broken references."""
    client = bigquery.Client(project=project_id)
    broken_views = []

    views = client.list_tables(f"{project_id}.{dataset_id}")
    for view_ref in views:
        table = client.get_table(view_ref)
        if table.table_type != "VIEW":
            continue
        try:
            job_config = bigquery.QueryJobConfig(dry_run=True, use_query_cache=False)
            query = f"SELECT * FROM `{project_id}.{dataset_id}.{table.table_id}` LIMIT 0"
            client.query(query, job_config=job_config)
        except Exception as e:
            broken_views.append(f"{dataset_id}.{table.table_id}: {e}")
            print(f"BROKEN: {dataset_id}.{table.table_id}")

    return broken_views

if __name__ == "__main__":
    broken = validate_all_views("my-financial-platform", "analytics")
    if broken:
        raise SystemExit(f"Found {len(broken)} broken views:\n" + "\n".join(broken))
```

3. Use table rename via DDL (when available) instead of `bq cp` + `bq rm` to maintain referential integrity:

```sql
-- In future BigQuery releases / via ALTER TABLE RENAME:
-- ALTER TABLE staging.instruments RENAME TO instruments_master;
-- (As of 2026, use: create new table, copy data, update all views, drop old table)
```

**Fix procedure**

1. Run the INFORMATION_SCHEMA query above to find all broken views.
2. Update each broken view definition:

```sql
CREATE OR REPLACE VIEW analytics.instrument_details AS
SELECT *
FROM staging.instruments_master  -- Updated reference
JOIN analytics.index_weights USING (instrument_isin);
```

3. Validate all updated views with the CI validation script.
4. Add the INFORMATION_SCHEMA dependency scan to the pre-rename runbook for all future table renames.

---

## Related

- [[querying-and-cost-optimization]] — BigQuery query patterns and cost control
- [[dataset-and-table-management]] — Dataset and table administration
- [[data-loading-and-export]] — Load jobs, streaming, export
- [[gcp-billing-and-pricing]] — BigQuery pricing model
- [[gcp-cost-monitoring-and-budgets]] — Cost monitoring and alerts
- [[gcp-total-cost-of-ownership]] — TCO calculations
- [[bigquery-quota-exceeded]] — Runbook for quota incidents
- [[dbt-bigquery-adapter]] — dbt-specific BigQuery configuration
- [[on-call-guide]] — Incident response framework

---

## Sources

- BigQuery Query Performance Optimization Guide 2025 (e6data)
- Avoiding 8 Common BigQuery Query Mistakes (DoiT)
- 14 BigQuery Shortfalls (Medium)
- SQL Anti-Patterns for BigQuery (TDS)
- FLOAT vs NUMERIC in BigQuery (Medium)
- BigQuery Pricing Explained 2026 (BIX Tech)
- Hidden Costs of BigQuery Queuing (Revefi)
- BigQuery Troubleshoot Queries (Google Cloud Docs)
