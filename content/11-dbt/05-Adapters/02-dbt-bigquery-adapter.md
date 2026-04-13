---
title: "02 - dbt: BigQuery Adapter"
tags: [pipeline, dbt, bigquery]
status: stable
updated: 2026-03-23
description: "BigQuery adapter partitioning, clustering, incremental strategies, slot estimation, cost control, and BigQuery-specific SQL patterns."
---

# dbt: BigQuery Adapter

> [!quote]
> "Serverless is a simple but powerful concept when it comes to gigabyte- to petabyte-scale data analysis. It's a relatively hard engineering problem."
>
> — **Jordan Tigani** (founding engineer of BigQuery)

> [!abstract]- Summary
>
> `dbt-bigquery` is the first-party dbt adapter for BigQuery, and this note defines the BigQuery-specific profile, partitioning, clustering, incremental, SQL, materialization, and cost-control patterns required to run analytical models efficiently and predictably on a serverless warehouse.
>
> **Adapter setup and authentication**
> - Installs pinned `dbt-core` and `dbt-bigquery` versions, confirms adapter registration, and notes that BigQuery relies on API credentials rather than host-level database drivers.
> - Configures `profiles.yml` for service-account JSON keys, local ADC with `oauth`, and service-account impersonation for production-safe access patterns.
>
> **Storage layout and incremental design**
> - Uses `partition_by` and `cluster_by` deliberately, including date and integer-range partitioning, partition granularity choices, and `require_partition_filter` on marts.
> - Compares `merge` and `insert_overwrite`, with guidance on when partition replacement is more efficient than row-level upserts.
>
> **Warehouse tuning and SQL patterns**
> - Covers thread count versus slot consumption, `priority`, and job labels for cost attribution, then maps key BigQuery SQL features such as `SAFE_DIVIDE`, `DATE_TRUNC`, `DATE_ADD`, `STRUCT`, `ARRAY`, and manual `MERGE` DML.
> - Extends the adapter discussion to materialized views, BI Engine behavior, and external tables staged through `dbt_external_tables`.
>
> **Operations and safety**
> - Warnings: enforce partition filters on marts, tune `threads` against slot availability, avoid raw keyfile sprawl when Workload Identity or impersonation is available, and do not deploy large tables without partitioning and clustering.
> - Recommendations table: the partition granularity guide and cost-visibility label patterns define the safe default operating posture.
> - Cost controls: `maximum_bytes_billed`, dry runs, and billing labels are the note's explicit spend-governance mechanisms.

> [!note]- Glossary
>
> **`dbt-bigquery`**
> - The first-party dbt adapter that maps dbt models and materializations to BigQuery DDL, DML, and job configuration.
> - It matters here because all partitioning, clustering, incremental, and cost controls in the note are adapter features exposed through dbt config.
>
> > [!info] First-party coverage
> >
> > This adapter tracks dbt Core more closely than community adapters. Even so, BigQuery-specific runtime behavior still needs deliberate validation in the warehouse, not just in compiled SQL.
>
> ---
>
> **`profiles.yml`**
> - The dbt profile file that stores target definitions and adapter-specific connection parameters.
> - It matters here because project, dataset, auth method, location, threads, timeout, and query priority are all controlled there.
>
> > [!info] Runtime control plane
> >
> > In BigQuery, profile choices shape both identity and spend. Treat the file as an execution policy surface, not as a narrow credential wrapper.
>
> ---
>
> **Service account JSON key**
> - A downloaded private key file that allows a dbt process to authenticate as a Google Cloud service account.
> - It matters here because it is the simplest non-interactive auth method for CI, but also the least desirable long-term credential pattern.
>
> > [!danger] Long-lived secret material
> >
> > JSON keys are easy to copy, hard to rotate everywhere, and frequently over-scoped. Prefer attached identities or impersonation when the platform supports them.
>
> ---
>
> **Application Default Credentials**
> - Google's standard mechanism for discovering local or attached credentials automatically in client libraries and CLI tools.
> - It matters here because local dbt development on BigQuery often uses `method: oauth` backed by ADC rather than embedded key paths.
>
> > [!warning] Developer context leaks
> >
> > ADC follows the active local identity state. If developers switch accounts or projects casually, dbt runs can silently target the wrong BigQuery environment.
>
> ---
>
> **Service account impersonation**
> - A Google Cloud access pattern where one principal temporarily mints short-lived credentials for a target service account.
> - It matters here because it enables production access without distributing the production account's private key.
>
> > [!danger] IAM boundary enforcement
> >
> > The safety of impersonation depends on tightly scoped `roles/iam.serviceAccountTokenCreator` grants. Broad token-creator permissions collapse the security boundary.
>
> ---
>
> **Partitioning**
> - BigQuery's table layout feature that divides data into partitions so queries can prune storage before scanning bytes.
> - It matters here because partitioning is the primary performance and cost control for date-driven analytical marts.
>
> > [!warning] Foundational, not optional
> >
> > Large analytical tables without partitioning become full-scan targets very quickly. Add it during model design instead of treating it as a later tuning step.
>
> ---
>
> **`partition_by`**
> - The dbt model config that declares the partition column, data type, and granularity for a BigQuery table.
> - It matters here because the adapter converts this config directly into the table layout that governs pruning, incremental strategy, and scan cost.
>
> > [!info] Physical design knob
> >
> > This is not just metadata. It changes how the table is stored and which incremental patterns remain economical as data volume grows.
>
> ---
>
> **`require_partition_filter`**
> - A BigQuery table setting that rejects queries which do not filter on the partition column.
> - It matters here because it protects mart tables from accidental full scans by analysts, dashboards, or ad hoc queries.
>
> > [!warning] Apply selectively
> >
> > This safety net is appropriate for marts but can break internal or exploratory queries on staging models. Use it where query discipline matters, not everywhere indiscriminately.
>
> ---
>
> **Clustering**
> - BigQuery's within-partition sort organization on one or more columns.
> - It matters here because it complements partition pruning by making repeated filter and join predicates cheaper inside each partition.
>
> > [!info] Secondary optimization layer
> >
> > Clustering helps only after partitioning is reasonable. It refines scan efficiency within partitions; it does not replace partition design.
>
> ---
>
> **`merge`**
> - The default BigQuery incremental strategy that uses BigQuery `MERGE` DML for row-level upserts.
> - It matters here because it is the general-purpose choice when the model must reconcile changed rows by `unique_key`.
>
> > [!warning] Still compute-heavy
> >
> > `MERGE` is correct for many models, but large targets can still consume substantial slots and bytes. Do not confuse logical convenience with low-cost execution.
>
> ---
>
> **`insert_overwrite`**
> - A partition-replacement incremental strategy that rewrites entire affected partitions instead of performing row-by-row matching.
> - It matters here because it is often more efficient than `merge` when source corrections arrive as complete partition-aligned batches.
>
> > [!warning] Partition semantics required
> >
> > This strategy is safe only when the data naturally replaces whole partitions. If corrections happen at row granularity inside a partition, use `merge` instead.
>
> ---
>
> **Slots**
> - BigQuery compute capacity units consumed by queries while they execute.
> - It matters here because dbt thread count multiplies concurrent query demand, and slot pressure determines whether runs start promptly or queue.
>
> > [!warning] Threads amplify spend
> >
> > A high `threads` setting does not mean lightweight parallelism. Each concurrent query can consume substantial slots, so overshooting thread count creates contention and cost spikes.
>
> ---
>
> **`priority`**
> - The BigQuery job execution mode that chooses between immediate interactive execution and queued batch execution.
> - It matters here because production dbt runs often need to trade latency for reduced contention with analyst workloads.
>
> > [!info] Scheduling policy choice
> >
> > `batch` is not slower SQL; it is a queueing policy. Use it when predictable shared-capacity behavior matters more than immediate start time.
>
> ---
>
> **Labels**
> - Key-value metadata attached to BigQuery jobs and objects for cost attribution and administrative tracking.
> - It matters here because dbt model and layer labels let billing exports and `INFORMATION_SCHEMA` queries trace warehouse spend back to specific workloads.
>
> > [!info] FinOps hook point
> >
> > Without consistent labels, cost analysis collapses into project-level averages. Labels make dbt activity observable at the model and team level.
>
> ---
>
> **`SAFE_DIVIDE`**
> - A BigQuery SQL function that returns `NULL` instead of raising an error when division would fail, such as division by zero.
> - It matters here because it is one of the key BigQuery-native expressions the note uses to contrast adapter-specific SQL idioms.
>
> > [!info] Portable intent, different syntax
> >
> > The analytical intent matches SQL Server's `NULLIF`-based safe division pattern, but the implementation is BigQuery-specific and belongs behind adapter-aware abstractions in shared projects.
>
> ---
>
> **`STRUCT` and `ARRAY`**
> - BigQuery nested data types for representing grouped fields and repeated values inside a single row.
> - It matters here because they enable BigQuery-native analytical models but break portability to adapters such as SQL Server.
>
> > [!warning] Adapter boundary marker
> >
> > Once nested types enter a model, that model is effectively BigQuery-only unless you isolate it in adapter-specific folders or conditional logic.
>
> ---
>
> **Materialized view**
> - A persisted BigQuery query result that refreshes automatically and can accelerate repeated analytical reads.
> - It matters here because the note treats materialized views as an operational extension that dbt manages indirectly rather than as a native dbt materialization.
>
> > [!warning] Not a normal dbt model
> >
> > BigQuery materialized views behave like warehouse objects with their own refresh constraints. Manage them deliberately through operations or hooks rather than assuming full parity with table models.
>
> ---
>
> **`maximum_bytes_billed`**
> - A BigQuery job setting that caps how many bytes a query is allowed to process before it fails.
> - It matters here because it is the note's explicit fail-fast control against accidental runaway scan costs.
>
> > [!danger] Protective failure mode
> >
> > This setting intentionally breaks expensive queries instead of letting them complete. That is desirable in production because a hard failure is usually cheaper than an unnoticed full-table scan.

> [!example] Warehouse Suitability
>
> > [!success] BigQuery-Native Workload
> >
> > - Use `dbt-bigquery` when BigQuery is the real target warehouse and the project benefits from partition-aware incrementals, serverless elasticity, GCP-native identity patterns, and billing-aware execution controls.
> > - Lean into BigQuery-specific settings such as partitioning, clustering, job labels, and `maximum_bytes_billed` when scan volume and spend must be governed as part of the model design.
>
> > [!failure] Cross-Adapter Constraint
> >
> > - Avoid treating this note as portable warehouse guidance if the project must remain adapter-neutral while relying on BigQuery-specific features such as `STRUCT`, `ARRAY`, or partition-swap semantics.
> > - Do not choose BigQuery-first patterns when the workload depends on SQL Server-style indexing, row-store behavior, or adapter parity that BigQuery does not share.

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

> [!success] Safe pattern
> Set `require_partition_filter = true` only in `config()` blocks for mart and incremental models. Leave staging models without this setting. In dbt config: `require_partition_filter = true` at the mart layer, omit it entirely in staging model configs.

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

> [!success] Safe starting configuration
> Begin with `threads: 8` and `priority: batch` in production profiles. Monitor slot utilisation in the BigQuery Admin Console (`INFORMATION_SCHEMA.JOBS_BY_PROJECT`) for at least one full pipeline cycle before increasing thread count. Reserve slots via BigQuery Reservations if you need guaranteed capacity.

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
