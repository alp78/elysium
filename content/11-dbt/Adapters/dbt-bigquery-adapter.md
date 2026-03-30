---
tags: [pipeline, dbt, bigquery]
type: reference
technology: [dbt, bigquery]
status: stable
updated: 2026-03-23
description: "BigQuery adapter partitioning, clustering, incremental strategies, slot estimation, cost control, and BigQuery-specific SQL patterns."
---

# dbt: BigQuery Adapter

> [!quote]
> "All models are wrong, but some are useful."
> — **George Box**

`dbt-bigquery` is a first-party adapter maintained by dbt Labs. It maps dbt materializations to BigQuery DDL/DML and exposes BigQuery-specific config options — partitioning, clustering, slot labels, and cost controls — directly in model config blocks. For broader BigQuery cost and query optimization patterns, see [querying-and-cost-optimization](https://alp78.github.io/elysium/06-GCP/BigQuery/querying-and-cost-optimization).

---

### BigQuery Adapter Installation

```bash
pip install dbt-core==1.8.* dbt-bigquery==1.8.*

# Confirm the adapter is registered
dbt --version
# Should show: - bigquery: 1.8.x
```

`dbt-bigquery` depends on `google-cloud-bigquery`. No additional system-level drivers are required — authentication is handled through ADC or explicit credentials.

---

## profiles.yml

### Service Account JSON (CI / GCE without Workload Identity)

```yaml
# ~/.dbt/profiles.yml
financial_index:
  target: dev
  outputs:

    dev:
      type: bigquery
      method: service-account
      project: fi-data-dev
      dataset: dbt_dev
      keyfile: /secrets/dbt-sa-key.json   # path to downloaded SA key
      location: US
      threads: 8
      timeout_seconds: 600
      priority: interactive

    prod:
      type: bigquery
      method: service-account
      project: fi-data-prod
      dataset: dbt_prod
      keyfile: "{{ env_var('DBT_BQ_KEYFILE') }}"
      location: US
      threads: 16
      timeout_seconds: 1800
      priority: batch
```

> [!tip] Prefer Workload Identity over JSON keys on GCE
> On Compute Engine or GKE, attach the service account to the VM/pod and use `method: oauth` or `method: oauth-secrets`. This eliminates key rotation overhead and is the recommended approach for production workloads.

### Application Default Credentials (local development)

```yaml
    local:
      type: bigquery
      method: oauth
      project: fi-data-dev
      dataset: dbt_dev_yourname
      location: US
      threads: 4
      timeout_seconds: 300
```

Before running: `gcloud auth application-default login --scopes=https://www.googleapis.com/auth/bigquery`.

### Service Account Impersonation

```yaml
    impersonated:
      type: bigquery
      method: oauth
      project: fi-data-prod
      dataset: dbt_prod
      impersonate_service_account: dbt-runner@fi-data-prod.iam.gserviceaccount.com
      location: US
      threads: 8
      timeout_seconds: 600
```

Requires the caller's identity to have `roles/iam.serviceAccountTokenCreator` on the target SA. Useful for developers who need prod-read access without holding a prod SA key locally.

---

## Partitioning

Partitioning is the most impactful BigQuery optimization for time-series financial data. Every mart table keyed by `score_date`, `as_of_date`, or `trade_date` should be partitioned.

```sql
-- models/mart/mart_esg_scores.sql
{{
  config(
    materialized = 'table',
    partition_by = {
      "field": "score_date",
      "data_type": "date",
      "granularity": "month"    -- day | month | year
    },
    cluster_by          = ["isin", "provider_code"],
    require_partition_filter = true,
    labels              = {"domain": "esg", "layer": "mart"}
  )
}}

select
    score_id,
    isin,
    provider_code,
    score_date,
    environmental_score,
    social_score,
    governance_score,
    composite_score
from {{ ref('int_esg_scores_validated') }}
```

### Partition Granularity Guide

| Granularity | Use when | Partition count |
|---|---|---|
| `day` | High-frequency data updated daily; date-range queries on narrow windows | Up to 4,000 partitions |
| `month` | Monthly index rebalancing, ESG scores updated monthly | Manageable; good default |
| `year` | Historical archives queried by year | Very few partitions; less pruning benefit |

> [!warning] Require partition filter on marts
>
> Enabling `require_partition_filter = true` on mart tables prevents accidental full-table scans from BI tools. Any query that does not include a filter on the partition column will be rejected with an error. Set this on all mart tables. Do not set it on staging tables — dbt internal queries (e.g., `is_incremental()` checks) may not include partition filters.

### Integer Range Partitioning

For tables without a natural date column — e.g., a universe table partitioned by index code hash:

```sql
{{
  config(
    materialized = 'table',
    partition_by = {
      "field": "index_id",
      "data_type": "int64",
      "range": {
        "start": 0,
        "end": 1000,
        "interval": 100
      }
    }
  )
}}
```

---

### BigQuery Clustering

Clustering sorts data within each partition by the specified columns. BigQuery automatically re-clusters as data accumulates. Clustering is free and has no maintenance overhead.

```sql
{{
  config(
    materialized = 'incremental',
    partition_by = {"field": "score_date", "data_type": "date", "granularity": "month"},
    cluster_by   = ["isin", "provider_code", "score_type"]
    -- Up to 4 cluster columns; order matters — most selective first
  )
}}
```

> [!note] Clustering vs partitioning
> Partitioning prunes at the storage level before any bytes are scanned. Clustering prunes within a partition — it is a secondary optimization. Always partition first, then cluster on the most common filter/join columns.

---

## Incremental Strategy

### merge (default)

BigQuery's native `MERGE` DML. Safe and correct for most use cases.

```sql
{{
  config(
    materialized         = 'incremental',
    unique_key           = 'score_id',
    incremental_strategy = 'merge',
    partition_by         = {"field": "score_date", "data_type": "date", "granularity": "month"},
    cluster_by           = ["isin", "provider_code"]
  )
}}

with new_scores as (
    select *
    from {{ ref('stg_esg_raw_scores') }}
    {% if is_incremental() %}
    where score_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
    {% endif %}
)

select * from new_scores
```

The adapter generates:

```sql
MERGE INTO `fi-data-prod.dbt_prod.mart_esg_scores` AS DBT_INTERNAL_DEST
USING (select * from new_scores) AS DBT_INTERNAL_SOURCE
ON DBT_INTERNAL_SOURCE.score_id = DBT_INTERNAL_DEST.score_id
WHEN MATCHED THEN UPDATE SET ...
WHEN NOT MATCHED THEN INSERT ...
```

### insert_overwrite (partition swap)

Replaces entire partitions atomically. More efficient than `MERGE` for large partition-aligned loads — no per-row comparison overhead.

```sql
{{
  config(
    materialized         = 'incremental',
    incremental_strategy = 'insert_overwrite',
    partition_by         = {"field": "score_date", "data_type": "date", "granularity": "month"},
    -- No unique_key required — entire partitions are replaced
  )
}}

select *
from {{ ref('stg_esg_raw_scores') }}
{% if is_incremental() %}
-- Only process partitions for months that have new/changed data
where DATE_TRUNC(score_date, MONTH) IN (
    select DISTINCT DATE_TRUNC(score_date, MONTH)
    from {{ ref('stg_esg_raw_scores') }}
    where _PARTITIONDATE >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
)
{% endif %}
```

> [!tip] When to use insert_overwrite
> - Source data arrives in complete monthly batches (ESG providers often send full-month corrections).
> - Reprocessing historical partitions is common.
> - The table is too large for MERGE to be economical (MERGE scans the full target table for non-partitioned MERGE keys).
>
> Avoid `insert_overwrite` when you need row-level upsert semantics within a partition.

---

### BigQuery Slot Estimation and Thread Tuning

BigQuery slots are units of compute. On-demand pricing provides up to 2,000 concurrent slots per project. Each query consumes slots proportional to its complexity and data volume.

```yaml
# profiles.yml thread settings
prod:
  threads: 16      # dbt parallelism — concurrent queries
  priority: batch  # batch | interactive
```

- **`interactive`**: queries compete for slots immediately; subject to fair-use limits; higher priority.
- **`batch`**: queries are queued; start within 24 hours; no slot reservation required. Use for scheduled dbt production runs to avoid slot contention with analysts.

> [!warning] Threads vs BigQuery slots
>
> `threads: 16` means dbt submits 16 queries concurrently. Each of those queries may consume hundreds or thousands of slots. Setting threads too high on a shared project can cause slot exhaustion and query queuing. Start with `threads: 8` and increase after confirming slot availability via the BigQuery Admin Console.

---

### BigQuery Labels for Cost Attribution

Labels propagate to BigQuery job metadata and appear in Cloud Billing exports. Mandatory for multi-team environments.

```sql
{{
  config(
    materialized = 'table',
    labels       = {
      "dbt_model":   "mart_esg_scores",
      "domain":      "esg",
      "layer":       "mart",
      "team":        "data-engineering",
      "cost_center": "cc-1234"
    }
  )
}}
```

Labels can also be set at the project level in `dbt_project.yml`:

```yaml
# dbt_project.yml
models:
  financial_index:
    +labels:
      project: financial-index
      managed_by: dbt
    mart:
      +labels:
        layer: mart
    staging:
      +labels:
        layer: staging
```

Query BigQuery INFORMATION_SCHEMA to track model-level cost:

```sql
SELECT
    labels.value                                    AS dbt_model,
    SUM(total_bytes_processed) / POW(10, 12)        AS tb_processed,
    SUM(total_slot_ms) / 1000 / 3600               AS slot_hours
FROM `region-us`.INFORMATION_SCHEMA.JOBS_BY_PROJECT,
UNNEST(labels) AS labels
WHERE labels.key = 'dbt_model'
  AND DATE(creation_time) = CURRENT_DATE()
GROUP BY 1
ORDER BY 2 DESC;
```

---

## BigQuery SQL Patterns

### BigQuery SQL — SAFE_DIVIDE

```sql
-- Avoids ZeroDivisionError at the SQL engine level — returns NULL instead
SELECT
    isin,
    SAFE_DIVIDE(environmental_score, composite_score) AS env_weight,
    -- Equivalent in SQL Server: environmental_score * 1.0 / NULLIF(composite_score, 0)
    SAFE_DIVIDE(social_score, composite_score)        AS social_weight
FROM {{ ref('int_esg_scores_validated') }}
```

### BigQuery SQL — DATE_TRUNC

```sql
-- Truncate to period start
SELECT
    DATE_TRUNC(score_date, MONTH)   AS score_month,
    DATE_TRUNC(score_date, QUARTER) AS score_quarter,
    DATE_TRUNC(score_date, YEAR)    AS score_year,
    DATE_TRUNC(score_date, WEEK)    AS score_week_start   -- Monday
FROM {{ ref('stg_esg_raw_scores') }}

-- Date arithmetic with INTERVAL
DATE_ADD(score_date, INTERVAL 1 MONTH)
DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
DATE_DIFF(end_date, start_date, DAY)
```

### BigQuery SQL — STRUCT and ARRAY

Useful for packing provider-level score breakdowns without a separate table:

```sql
SELECT
    isin,
    score_date,
    STRUCT(
        environmental_score AS e,
        social_score        AS s,
        governance_score    AS g
    )                       AS esg_components,
    ARRAY_AGG(
        STRUCT(provider_code, composite_score)
        ORDER BY composite_score DESC
    )                       AS provider_scores
FROM {{ ref('int_esg_scores_validated') }}
GROUP BY isin, score_date, esg_components
```

> [!note] STRUCT/ARRAY limitations
> Nested types work well for analytical queries but are not compatible with `dbt-sqlserver`. Any model using STRUCT/ARRAY must live in a BigQuery-specific folder or be guarded by `target.type` checks. See [dbt-cross-adapter-patterns](https://alp78.github.io/elysium/11-dbt/Adapters/dbt-cross-adapter-patterns) for the dispatch pattern.

### BigQuery SQL — MERGE DML (manual)

When the dbt incremental MERGE is not granular enough, write explicit MERGE in a post-hook or operation:

```sql
MERGE `fi-data-prod.dbt_prod.dim_index_constituents` AS target
USING (
    SELECT isin, index_code, weight, effective_date
    FROM `fi-data-prod.dbt_staging.stg_index_constituents`
    WHERE effective_date = CURRENT_DATE()
) AS source
ON target.isin = source.isin
   AND target.index_code = source.index_code
   AND target.effective_date = source.effective_date
WHEN MATCHED AND target.weight != source.weight THEN
    UPDATE SET target.weight = source.weight,
               target.updated_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN
    INSERT (isin, index_code, weight, effective_date, updated_at)
    VALUES (source.isin, source.index_code, source.weight,
            source.effective_date, CURRENT_TIMESTAMP())
```

---

## Materialized Views and BI Engine

### BigQuery Materialized Views

```sql
-- macros/create_materialized_view.sql (called as an operation, not a model)
-- dbt-bigquery does not natively manage BQ materialized views as a materialization type.
-- Create via post-hook on the base table or as a standalone operation.

{% set mv_sql %}
CREATE MATERIALIZED VIEW IF NOT EXISTS
  `{{ target.project }}.{{ target.dataset }}.mv_esg_monthly_avg`
OPTIONS (
  enable_refresh = true,
  refresh_interval_minutes = 60
)
AS
SELECT
    DATE_TRUNC(score_date, MONTH) AS score_month,
    provider_code,
    isin,
    AVG(composite_score)          AS avg_composite_score,
    COUNT(*)                      AS score_count
FROM `{{ target.project }}.{{ target.dataset }}.mart_esg_scores`
GROUP BY 1, 2, 3
{% endset %}

{% do run_query(mv_sql) %}
```

> [!note] BI Engine acceleration
> BI Engine accelerates queries on tables and materialized views in the same region as the BI Engine reservation. Ensure mart tables are in the same location as the BI Engine reservation (`US` or a specific multi-region). BI Engine does not accelerate queries using STRUCT/ARRAY columns.

---

## Cost Control

### maximum_bytes_billed

Hard cap per query. Queries exceeding the limit fail with an error rather than incurring unexpected charges.

```yaml
# profiles.yml
prod:
  maximum_bytes_billed: 107374182400   # 100 GB in bytes
```

Set this in production to prevent runaway full-table scans during dbt runs. A model that accidentally drops its partition filter will fail fast rather than billing for a full-table scan.

### Dry Run via bq CLI

Before running an expensive model, estimate bytes:

```bash
bq query --dry_run --use_legacy_sql=false \
  'SELECT * FROM `fi-data-prod.dbt_prod.mart_esg_scores`
   WHERE score_date >= "2024-01-01"'
# Output: Query successfully validated. Assuming the tables are not modified,
# running this query will process 2147483648 bytes.
```

In dbt, use `dbt compile` to get the rendered SQL, then pipe it to `bq query --dry_run`.

---

### BigQuery External Tables with Hive Partitioning

For raw ESG provider files landed in GCS with a Hive-style path structure (see [data-loading-and-export](https://alp78.github.io/elysium/06-GCP/BigQuery/data-loading-and-export) for the upstream loading patterns that produce these files):

```
gs://fi-raw-data/esg_scores/provider=msci/score_year=2024/score_month=01/scores.parquet
```

```sql
-- models/sources/ext_esg_scores_gcs.sql  (or define in sources.yml)
{{
  config(
    materialized = 'external',
    options = {
      "format": "PARQUET",
      "uris": ["gs://fi-raw-data/esg_scores/*"],
      "hive_partition_uri_prefix": "gs://fi-raw-data/esg_scores",
      "require_hive_partition_filter": false
    }
  )
}}
```

`dbt-bigquery` supports the `external` materialization via the `dbt-external-tables` package. Add to `packages.yml`:

```yaml
packages:
  - package: dbt-labs/dbt_external_tables
    version: [">=0.9.0", "<0.10.0"]
```

Then define in `sources.yml` and run `dbt run-operation stage_external_sources`.

---

## Related

- [moc-gcp](https://alp78.github.io/elysium/06-GCP/moc-gcp)
- [querying-and-cost-optimization](https://alp78.github.io/elysium/06-GCP/BigQuery/querying-and-cost-optimization)
- [dbt-performance-tuning](https://alp78.github.io/elysium/11-dbt/Operations/dbt-performance-tuning)
- [dbt-cross-adapter-patterns](https://alp78.github.io/elysium/11-dbt/Adapters/dbt-cross-adapter-patterns)
