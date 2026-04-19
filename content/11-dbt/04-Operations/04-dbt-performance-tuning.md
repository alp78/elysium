---
title: "04 - dbt: Performance Tuning"
tags: [pipeline, performance, dbt]
status: stable
updated: 2026-03-23
description: "Identifying slow models from run_results.json, BigQuery and SQL Server tuning, thread configuration, incremental strategy optimisation, and model refactoring with dbt-audit-helper."
---

# dbt: Performance Tuning

> [!quote]+
>
> "Bottlenecks occur in surprising places, so don't try to second guess and put in a speed hack until you have proven that's where the bottleneck is."
>
> Source: Rob Pike | *Notes on Programming in C* (1989)

> [!abstract]- Summary
>
> Explains how to tune dbt performance across warehouse compute, model design, thread settings, and execution artifacts so teams can reduce slow runs, freshness risk, and avoidable cloud or database cost.
>
> **Finding and classifying bottlenecks**
> - Uses `run_results.json`, lightweight Python analysis, and automated alerts to identify slow models and distinguish between compute-heavy SQL, incremental drift, warehouse contention, and platform misconfiguration
> - Frames performance tuning as diagnosis first, because the right fix depends on whether the bottleneck is in model logic, warehouse layout, or execution parallelism
>
> **Adapter-specific tuning**
> - Covers BigQuery partition pruning, clustering, slot usage, approximate aggregations, plus SQL Server indexing, statistics, and TempDB-related patterns so tuning stays grounded in the active adapter
> - Connects warehouse-specific primitives to dbt model design rather than pretending performance behavior is portable across adapters
>
> **Execution and run-shape controls**
> - Covers thread counts, incremental rebuild patterns, post-hook indexing, and recommended concurrency choices so dbt runtime settings align with warehouse behavior instead of fighting it
> - Emphasizes that run shape, table design, and warehouse resources must be tuned together, not in separate silos
>
> **Operations and safety**
> - Warnings: tuning threads blindly, scanning unpartitioned history repeatedly, creating indexes or statistics without measuring impact, and masking correctness issues with aggressive performance shortcuts
> - Recommendations: measure before changing, use adapter-native performance primitives, keep thread counts workload-aware, and treat performance artifacts as a recurring observability input rather than a one-off firefight

> [!info]- Glossary
>
> **Performance tuning**
> - The process of reducing dbt runtime, resource consumption, or freshness lag by changing model logic, warehouse design, or execution settings.
> - It matters here because the note is about distinguishing where the real bottleneck lives before applying an optimization.
>
> > [!warning] Optimize the real constraint
> >
> > Performance work fails when teams tune the wrong layer. A thread tweak will not fix a partition-pruning problem, and a query rewrite will not fix warehouse starvation.
>
> ---
>
> **`run_results.json`**
> - The dbt artifact that records per-node execution times and statuses for a run.
> - It matters here because it is one of the fastest ways to identify which models are actually slow instead of guessing from overall pipeline duration.
>
> > [!info] Evidence before intervention
> >
> > Performance tuning starts with measuring which nodes dominate runtime. `run_results.json` is often the first practical source for that evidence.
>
> ---
>
> **Partition pruning**
> - A warehouse optimization that limits scanned data to only the partitions required by a query's filters.
> - It matters here because partition-aware predicates are one of the highest-leverage performance controls on large analytical tables.
>
> > [!warning] Filters must match partition design
> >
> > A partitioned table only helps if queries filter in a way the warehouse can exploit. Broad or non-sargable predicates can still force expensive scans.
>
> ---
>
> **Clustering**
> - A warehouse storage optimization that groups related rows together by selected columns to improve selective query performance.
> - It matters here because some dbt models benefit materially when common filter or join keys align with the warehouse's clustering behavior.
>
> > [!info] Read pattern optimization
> >
> > Clustering is most useful when the same keys are filtered or joined repeatedly. It is a workload-shape optimization, not a universal speed boost.
>
> ---
>
> **Slot usage**
> - The compute capacity consumed by BigQuery queries during execution.
> - It matters here because dbt performance on BigQuery is often a question of both SQL shape and available slot resources.
>
> > [!warning] Fast SQL can still wait for compute
> >
> > If slots are saturated, query runtime reflects resource contention as much as query quality. Measuring warehouse capacity is part of tuning.
>
> ---
>
> **Post-hook index**
> - A warehouse index created by dbt after model materialization using a post-hook.
> - It matters here because SQL Server-backed dbt projects often need physical design help after table builds to keep downstream queries efficient.
>
> > [!warning] Physical tuning outside the SQL body
> >
> > dbt model SQL does not express every performance optimization. On some adapters, post-hooks are the practical place to add physical design improvements after build.
>
> ---
>
> **Statistics update**
> - A database maintenance action that refreshes optimizer statistics so execution plans reflect current data distribution.
> - It matters here because stale statistics can make well-written dbt SQL run poorly for reasons unrelated to model logic.
>
> > [!warning] Optimizer blindness looks like model slowness
> >
> > Sometimes a slow dbt run is really a stale-optimizer problem. If statistics are wrong, the warehouse may choose bad plans even for sensible SQL.
>
> ---
>
> **TempDB pressure**
> - SQL Server contention or spill pressure in TempDB caused by sorts, hashes, spools, or concurrent workloads.
> - It matters here because dbt models using heavy intermediate computation can expose TempDB as a system-level bottleneck.
>
> > [!warning] Not every slowdown is in the model SQL
> >
> > TempDB pressure is a reminder that dbt performance can be constrained by shared database internals, not just by the text of the model query.
>
> ---
>
> **Thread count**
> - The number of dbt worker threads used to execute nodes in parallel.
> - It matters here because too little parallelism wastes capacity while too much can overwhelm adapters, warehouses, or shared database resources.
>
> > [!warning] More threads are not always faster
> >
> > Thread settings should match warehouse and workload behavior. Past a point, extra parallelism creates queueing, lock contention, or slot starvation instead of speed.
>
> ---
>
> **Approximate aggregation**
> - A query pattern such as `APPROX_COUNT_DISTINCT` that trades exactness for faster or cheaper execution on suitable workloads.
> - It matters here because some analytical models can accept approximation and gain meaningful runtime savings.
>
> > [!warning] Accuracy is part of performance policy
> >
> > Approximate functions are only good optimizations when the analytical use case tolerates them. Speed is not a free win if the metric contract demands exactness.
>
> ---
>
> **Incremental drift**
> - Performance or correctness degradation that accumulates when an incremental model's selective processing logic no longer matches the real data-change pattern.
> - It matters here because some slow or stale runs are symptoms of incremental strategy drift rather than of raw compute scarcity.
>
> > [!warning] Cheap runs can hide bad state
> >
> > An incremental model may look fast while still growing less correct over time. Tuning has to protect both runtime and data validity.
>
> ---
>
> **Freshness SLA**
> - The operational time target for how quickly transformed data should be updated and available after source changes.
> - It matters here because dbt performance is not just about cost; it is also about whether the pipeline still meets expected delivery latency.
>
> > [!info] Runtime is a service-level issue
> >
> > Slow models become operational problems when they push delivery past consumer expectations. Performance tuning is often really SLA protection in disguise.

## Identifying Slow Models from `run_results.json`

### Quick Analysis with Python

```python
#!/usr/bin/env python3
"""slow_models.py — print the top N slowest models from a run_results.json."""

import json
import sys

path = sys.argv[1] if len(sys.argv) > 1 else "target/run_results.json"
top_n = int(sys.argv[2]) if len(sys.argv) > 2 else 10

with open(path) as f:
    results = json.load(f)["results"]

models = [
    r for r in results
    if r["unique_id"].startswith("model.")
    and r["status"] == "success"
]

models.sort(key=lambda r: r["execution_time"], reverse=True)

print(f"{'Rank':<5} {'Execution Time':>16} {'Model'}")
print("-" * 60)
for i, r in enumerate(models[:top_n], 1):
    name = r["unique_id"].split(".")[-1]
    t = r["execution_time"]
    print(f"{i:<5} {t:>14.1f}s   {name}")
```

```
Rank   Execution Time  Model
------------------------------------------------------------
1           327.4s   fct_index_constituent_history
2           198.1s   int_esg_normalised_cross_universe
3            87.6s   fct_esg_scores
```

### Automated Slow-Model Alert

In the Airflow DAG, fail the pipeline if any model exceeds a threshold:

```python
def check_slow_models(**context):
    import json

    with open("/opt/dbt/financial_indices/target/run_results.json") as f:
        results = json.load(f)["results"]

    threshold_s = 300   # 5-minute SLA per model
    slow = [
        r["unique_id"].split(".")[-1]
        for r in results
        if r["unique_id"].startswith("model.")
        and r.get("execution_time", 0) > threshold_s
    ]
    if slow:
        raise ValueError(f"Models exceeded {threshold_s}s SLA: {slow}")
```

---

## BigQuery Tuning

### BigQuery Tuning — Partition Pruning

Partitioned tables are only useful if queries filter on the partition column — see [querying-and-cost-optimization](https://alp78.github.io/elysium/06-GCP/BigQuery/querying-and-cost-optimization) for broader BigQuery cost strategies. Verify pruning is happening in the query plan:

```sql
-- Check partitions scanned in INFORMATION_SCHEMA
SELECT
    job_id,
    total_bytes_billed / 1e9          AS gb_billed,
    total_slot_ms / 1000              AS slot_seconds,
    query
FROM `fin-data-prod`.`region-eu`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)
  AND statement_type = "SELECT"
ORDER BY total_bytes_billed DESC
LIMIT 20;
```

In dbt model config, declare the partition column and ensure downstream models filter on it:

```sql
-- models/marts/esg/fct_esg_scores.sql
{{
  config(
    materialized  = 'table',
    partition_by  = {
      'field': 'score_date',
      'data_type': 'date',
      'granularity': 'day'
    },
    cluster_by    = ['issuer_id', 'provider_code'],
    require_partition_filter = true   -- enforce pruning at query time
  )
}}
```

`require_partition_filter = true` raises a query error if a consumer queries without a partition predicate — preventing accidental full-table scans in BI tools.

### BigQuery Tuning — Clustering

Clustering physically sorts data within each partition by the specified columns. Effective for:

- High-cardinality filter columns (`issuer_id`, `isin`).
- Columns used in `GROUP BY` or `JOIN` conditions.

Cluster on the columns most commonly used in `WHERE` and `JOIN`:

```sql
{{
  config(
    cluster_by = ['issuer_id', 'score_date']
  )
}}
```

> [!tip] Automatic re-clustering
>
> BigQuery automatically re-clusters tables over time as data is inserted. No manual maintenance is required. Monitor clustering effectiveness with `INFORMATION_SCHEMA.TABLE_STORAGE`.

### BigQuery Tuning — Slot Usage and Reservation

For large transformation jobs (e.g., daily full-refresh of a 500M-row historical fact table), reserve dedicated slots to avoid slot contention from concurrent workloads:

```sql
-- Create a reservation for dbt batch jobs
CREATE RESERVATION `fin-data-prod`.`region-eu`.dbt_batch
OPTIONS (slot_count = 500);

-- Assign the dbt service account's project to this reservation
CREATE ASSIGNMENT `fin-data-prod`.`region-eu`.dbt_batch.prod_assignment
OPTIONS (
    assignee = "projects/fin-data-prod",
    job_type = "QUERY"
);
```

Monitor slot consumption with the Datadog BigQuery integration or a Looker Studio dashboard on `INFORMATION_SCHEMA.JOBS`.

### BigQuery Tuning — Approximate Aggregations (APPROX_COUNT_DISTINCT)

For exploratory or non-regulatory models, `APPROX_COUNT_DISTINCT` is 2–10× faster than `COUNT(DISTINCT ...)` and consumes far fewer slots:

```sql
-- int_esg_coverage.sql — approximate is acceptable for coverage monitoring
SELECT
    score_date,
    provider_code,
    APPROX_COUNT_DISTINCT(issuer_id)  AS approx_issuer_count
FROM {{ ref('stg_esg_provider_raw') }}
GROUP BY 1, 2
```

---

## SQL Server Tuning

### Post-Hook Indexes

dbt materialises tables without indexes by default. The [partitioning-strategies](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/02-Database-Design-and-Storage/partitioning-strategies) note covers SQL Server partitioning in depth; for dbt-managed tables, add indexes in `post-hook`:

```sql
-- dbt_project.yml
models:
  financial_indices:
    marts:
      esg:
        +post-hook:
          - >
            IF NOT EXISTS (
              SELECT 1
              FROM sys.indexes
              WHERE name = 'ix_{{ this.identifier }}_issuer_date'
                AND object_id = OBJECT_ID('{{ this }}')
            )
            CREATE INDEX ix_{{ this.identifier }}_issuer_date
            ON {{ this }} (issuer_id, score_date)
            INCLUDE (environmental_score, social_score, governance_score)
```

For columnstore (analytical) workloads:

```sql
+post-hook:
  - >
    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = 'ccx_{{ this.identifier }}'
        AND object_id = OBJECT_ID('{{ this }}')
    )
    CREATE CLUSTERED COLUMNSTORE INDEX ccx_{{ this.identifier }}
    ON {{ this }}
```

### Statistics Update

After a large incremental load, SQL Server's statistics may be stale, leading to poor query plans:

```sql
+post-hook:
  - "UPDATE STATISTICS {{ this }} WITH FULLSCAN"
```

Use `WITH SAMPLE 30 PERCENT` for very large tables where `FULLSCAN` takes too long.

### TempDB Pressure

Spill-to-TempDB occurs when a sort or hash join exceeds the granted memory. Diagnose with:

```sql
SELECT
    session_id,
    request_id,
    task_alloc_pages * 8 / 1024.0   AS spill_mb
FROM sys.dm_db_task_space_usage
WHERE task_alloc_pages > 0
ORDER BY spill_mb DESC;
```

Remediation: break the offending CTE into an intermediate table-materialized model, reducing the per-query row set.

---

## Thread Tuning Per Adapter

dbt executes models in parallel up to the `threads` limit. Increasing threads reduces wall-clock time but increases warehouse concurrency load.

```yaml
# profiles.yml
financial_indices:
  outputs:
    prod:
      type: bigquery
      threads: 8          # BigQuery: 4–16 depending on slot quota
      ...

    prod_sqlserver:
      type: sqlserver
      threads: 4          # SQL Server: match max_dop / 2 to avoid contention
      ...
```

### Recommended Thread Counts

| Adapter | Recommended Range | Notes |
|---------|-------------------|-------|
| BigQuery | 6–16 | Bounded by on-demand slot quota; increase for reservations |
| SQL Server | 2–6 | Higher values cause lock contention on shared Dev instances |
| Postgres / AlloyDB | 4–8 | Limited by `max_connections` on the server |
| Snowflake | 4–8 | Bounded by warehouse size; larger warehouse = more threads |

> [!note] Thread count multiplies with Cosmos
>
> Threads apply within a single `dbt run` invocation. If you run multiple DAG branches in parallel via Cosmos, each branch uses the full thread count, which can multiply the warehouse load.

---

## Incremental Optimisation

### Strategy Choice

| Strategy | Best for | Drawback |
|----------|----------|----------|
| `append` | Immutable event streams | Cannot correct late-arriving data |
| `merge` | Slowly changing data; small daily deltas | Expensive merge predicate on large tables |
| `insert_overwrite` | Date-partitioned fact tables (BigQuery) | Over-writes entire partition; any partial run loses data |
| `delete+insert` | SQL Server / Postgres partition-aligned | Two statements; gap between delete and insert |

### Partition Scope for `insert_overwrite`

Without a partition scope, `insert_overwrite` overwrites the entire table on each run:

```sql
{{
  config(
    materialized       = 'incremental',
    incremental_strategy = 'insert_overwrite',
    partition_by       = {'field': 'score_date', 'data_type': 'date'},
  )
}}

SELECT *
FROM {{ ref('int_esg_normalised') }}
{% if is_incremental() %}
WHERE score_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 3 DAY)
{% endif %}
```

The `WHERE` clause limits the source scan; BigQuery's `insert_overwrite` automatically replaces only the partitions present in the result set.

### Merge Predicate Optimisation

An inefficient merge predicate causes a full-table scan on the target:

```sql
-- BAD: scans entire target table
ON target.issuer_id = source.issuer_id

-- BETTER: prune target to recent partitions first
ON target.issuer_id = source.issuer_id
   AND target.score_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
```

In dbt, add the partition filter to the `unique_key` scope via a custom incremental predicate (dbt 1.4+):

```sql
{{
  config(
    materialized            = 'incremental',
    incremental_strategy    = 'merge',
    unique_key              = 'surrogate_key',
    incremental_predicates  = [
      "DBT_INTERNAL_DEST.score_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)"
    ]
  )
}}
```

---

## Model Refactoring: Split Slow Models

### Anti-Pattern: One Giant Model

```sql
-- fct_index_weights.sql  (327s, 8 GB processed)
WITH raw AS (SELECT ... FROM {{ source('provider', 'raw_esg') }}),
     normalised AS (SELECT ... FROM raw),          -- 200-line normalisation
     scored AS (SELECT ... FROM normalised),        -- complex window functions
     weighted AS (SELECT ... FROM scored JOIN ...)  -- 5-table join
SELECT * FROM weighted
```

### Refactored: Layered Materialisation

```
stg_esg_provider_raw   (view)          — rename, cast, no logic
int_esg_normalised      (table)         — per-pillar normalisation (was slow CTE)
int_esg_scored          (table)         — window functions on normalised data
fct_index_weights       (incremental)   — final join, now only merges scored data
```

Split the CTE chain into separate models. Intermediate models materialised as tables act as checkpoints: dbt caches the result set between runs, so a failure in `fct_index_weights` does not re-run normalisation.

### Ephemeral CTEs for Lightweight Logic

For trivial transformations that do not warrant a separate table, use `ephemeral` materialisation. dbt inlines the SQL as a CTE in the downstream model:

```yaml
# models/intermediate/schema.yml
models:
  - name: int_isin_lookup
    config:
      materialized: ephemeral   # no table created; inlined as CTE
```

Use ephemeral only for models with no fan-out (used by exactly one downstream model). Shared logic that is referenced by multiple models should be a table or view.

---

## dbt-audit-helper: Validating Refactors

Before deploying a refactored model, verify that the output is identical to the original using the `dbt-audit-helper` package.

### dbt-audit-helper Installation

```yaml
# packages.yml
packages:
  - package: dbt-labs/audit_helper
    version: [">=0.11.0", "<0.12.0"]
```

### dbt-audit-helper — Row-Level Comparison

```sql
-- analyses/audit_fct_index_weights.sql
{{
  audit_helper.compare_relations(
    a_relation = ref('fct_index_weights'),           -- original (current prod)
    b_relation = ref('fct_index_weights_refactored'),-- candidate refactor
    primary_key = 'surrogate_key'
  )
}}
```

Output:

```
in_a_not_in_b   0 rows   ← no rows dropped
in_b_not_a      0 rows   ← no spurious new rows
in_both         182,400 rows
```

### dbt-audit-helper — Column-Level Comparison

```sql
{{
  audit_helper.compare_column_values(
    a_relation = ref('fct_index_weights'),
    b_relation = ref('fct_index_weights_refactored'),
    primary_key = 'surrogate_key',
    column_to_compare = 'constituent_weight'
  )
}}
```

Run analyses with:

```bash
dbt compile --select analyses/audit_fct_index_weights
bq query --use_legacy_sql=false < target/compiled/.../audit_fct_index_weights.sql
```

> [!warning] Audit helper before merging
>
> Always run `audit_helper` comparisons in a feature branch against the production dataset before merging. For ESG benchmark models, even a 0.0001% deviation in `constituent_weight` can constitute a material change requiring Methodology Committee review.

> [!success] Validation workflow
>
> Build both the original and refactored models in a dev dataset, run `audit_helper.compare_relations` and `audit_helper.compare_column_values` for each key column, confirm zero row discrepancies, and gate the merge on those comparison checks passing.

---

## Related

- [query-store-regressions-and-plan-forcing](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/03-Query-Writing-and-Optimization/query-store-regressions-and-plan-forcing)
- [querying-and-cost-optimization](https://alp78.github.io/elysium/06-GCP/BigQuery/querying-and-cost-optimization)
- [dbt-materializations](https://alp78.github.io/elysium/11-dbt/Modeling/dbt-materializations)
- [dbt-troubleshooting](https://alp78.github.io/elysium/11-dbt/Operations/dbt-troubleshooting)
- [dbt-observability](https://alp78.github.io/elysium/11-dbt/Operations/dbt-observability)
