---
type: concept
category: gcp
technology: [gcp, bigquery]
tags: [performance, cost, infrastructure, bigquery, gcp]
aliases: [BigQuery cost optimization, bq query, BigQuery dry run, BigQuery caching, BigQuery SELECT star cost, BQ cost]
keywords: [bigquery, bq query, cost optimization, dry run, --dry_run, bytes processed, TB scanned, partitioning, clustering, SELECT star, columnar, parameterized query, destination table, materialized view, INFORMATION_SCHEMA, JOBS, standard SQL, legacy SQL, allow_large_results, caching]
description: "How to run BigQuery queries efficiently using the bq CLI — including dry runs for cost estimation, parameterized queries for caching, destination tables, and the 80/20 cost optimization practices."
related: [dataset-and-table-management, data-loading-and-export, job-management, gcp-projects-and-apis, service-accounts-and-iam]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# BigQuery Querying and Cost Optimization

BigQuery charges $5 per TB of data scanned on the on-demand pricing model. A single `SELECT *` on a 10 TB table costs $50 — and runs every time someone executes it. Senior data engineers always dry-run queries before executing them, always use partitioned tables, and never select columns they don't need. This note covers the query execution mechanics and the 80/20 cost optimization practices that have the largest impact.

## Running Queries

```bash
# Run a query
bq query --use_legacy_sql=false 'SELECT COUNT(*) AS total_rows FROM `data-platform-prod.project_data.ohlcv`'
# --use_legacy_sql=false = use standard SQL (ALWAYS set this — legacy SQL is deprecated)
# Backticks around fully-qualified table names: `project.dataset.table`
```

> [!warning] Always Set `--use_legacy_sql=false`
> BigQuery has two SQL dialects: legacy SQL (the original) and standard SQL (GoogleSQL, the modern version). Legacy SQL has different syntax and fewer features. Always use `--use_legacy_sql=false`. Some teams set this as an alias: `alias bq='bq --use_legacy_sql=false'`.

## Dry Run — Estimate Cost Before Executing

```bash
# CRITICAL: Estimate cost BEFORE running (dry run)
bq query --use_legacy_sql=false --dry_run \
  'SELECT * FROM `project_data.large_table` WHERE date >= "2025-01-01"'
# Output: "Query successfully validated. Estimated 4.2 GB will be processed."
# At $5/TB: 4.2 GB = $0.02. Acceptable.
# Without WHERE: "Estimated 2.1 TB" = $10.50. Not acceptable — add partition filters!
```

> [!tip] The Dry Run Habit
> Make `--dry_run` your default first step before any non-trivial query. It is free, instant, and prevents accidental large scans. The cost calculation: `bytes_processed / 1_000_000_000_000 * 5` dollars.

## Saving Results to a Table

```bash
# Run a query and save results to a table
bq query --use_legacy_sql=false --destination_table=project_data.results \
  --replace --allow_large_results \
  'SELECT symbol, AVG(close) as avg_close FROM `project_data.ohlcv` GROUP BY symbol'
# --destination_table = write results to this table
# --replace = overwrite if the table exists (vs. append)
# --allow_large_results = required for results > 128MB
```

## Parameterized Queries (Caching + SQL Injection Prevention)

```bash
# Parameterized query (prevent SQL injection, enable caching)
bq query --use_legacy_sql=false \
  --parameter='index_name:STRING:market_index' \
  --parameter='start_date:DATE:2025-01-01' \
  'SELECT * FROM `project_data.ohlcv` WHERE _index = @index_name AND date >= @start_date'
# @parameter_name = reference in the query
# Parameterized queries are cached — repeated calls with same params are free
```

## Running Queries from a File and Formatting Output

```bash
# Run from a SQL file
bq query --use_legacy_sql=false < query.sql

# Format output
bq query --use_legacy_sql=false --format=prettyjson 'SELECT ...'
bq query --use_legacy_sql=false --format=csv 'SELECT ...'
# --format = prettyjson | json | csv | sparse | table (default)
```

## Cost Optimization — The 80/20 Rules

These six practices account for the vast majority of BigQuery cost reduction:

**1. Always use partitioned tables.** A query with `WHERE date >= '2025-01-01'` on a date-partitioned table scans only the matching partitions. Without partitioning, it scans EVERYTHING. This alone reduces costs by 90%+ for time-filtered queries.

**2. Never `SELECT *` in production.** Select only the columns you need. BigQuery is columnar — unused columns are never read. `SELECT symbol, close` on a 20-column table scans 10% of the data that `SELECT *` scans.

**3. Use `--dry_run` before every expensive query.** This is free and tells you exactly how many bytes will be scanned.

**4. Clustering reduces scan within partitions.** If you frequently filter by `symbol` within a date partition, clustering by `symbol` organizes the data so only the relevant blocks are read.

**5. Materialized views for repeated queries.** If your dashboard runs the same aggregation every 5 minutes, create a materialized view — BigQuery maintains it automatically and queries read the pre-computed result.

**6. Use INFORMATION_SCHEMA.JOBS for cost tracking:**

```sql
SELECT user_email,
  COUNT(*) AS queries,
  ROUND(SUM(total_bytes_processed) / POW(2,40), 2) AS tb_scanned,
  ROUND(SUM(total_bytes_processed) / POW(2,40) * 5, 2) AS cost_usd
FROM `region-EU`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
  AND job_type = 'QUERY'
GROUP BY user_email ORDER BY cost_usd DESC;
```

Run this weekly. Find the expensive queries and optimize them.

## Cost Estimation Quick Reference

| Data scanned | Cost (on-demand) |
|---|---|
| 1 GB | $0.005 |
| 10 GB | $0.05 |
| 100 GB | $0.50 |
| 1 TB | $5.00 |
| 10 TB | $50.00 |
| 100 TB | $500.00 |

## Related

- [[dataset-and-table-management]] — Partitioning and clustering are configured at table creation
- [[data-loading-and-export]] — How data gets into BigQuery for querying
- [[job-management]] — Monitoring query jobs, canceling runaway scans
- [[gcp-projects-and-apis]] — `bigquery.googleapis.com` must be enabled

## References

- [BigQuery on-demand pricing](https://cloud.google.com/bigquery/pricing#on_demand_pricing)
- [Query caching](https://cloud.google.com/bigquery/docs/cached-queries)
- [INFORMATION_SCHEMA.JOBS](https://cloud.google.com/bigquery/docs/information-schema-jobs)
