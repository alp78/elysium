---
tags: [pipeline, performance, dbt]
status: stable
updated: 2026-03-23
description: "Identifying slow models from run_results.json, BigQuery and SQL Server tuning, thread configuration, incremental strategy optimisation, and model refactoring with dbt-audit-helper."
---

# dbt: Performance Tuning

> [!quote]
> "Bottlenecks occur in surprising places, so don't try to second guess and put in a speed hack until you have proven that's where the bottleneck is."
>
> — **Rob Pike**, *Notes on Programming in C* (1989)

Performance problems in dbt manifest as three distinct symptoms: slow model execution time (compute cost), slow incremental runs (data freshness SLA risk), and high slot/credit consumption (cloud cost). This note covers diagnosis, adapter-specific tuning, and model-level refactoring techniques.

---

> [!warning] Slowest model sets the SLA
>
> A dbt project with 50 models where 49 run in 10 seconds and 1 runs in 20 minutes has a pipeline SLA of 20+ minutes. Focus optimization on the single slowest model first -- it dominates total runtime because dbt executes models in dependency order and downstream models wait. Use `run_results.json` to identify the critical path, not just the slowest individual model.

> [!success] Diagnosis-first approach
> Parse `run_results.json` with the `slow_models.py` script (below) to rank models by `execution_time`. Fix the top-ranked bottleneck — split it into intermediate tables, add partition pruning, or reduce its source scan — before touching anything else. Re-run and compare.

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

dbt materialises tables without indexes by default. The [partitioning-strategies](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/partitioning-strategies) note covers SQL Server partitioning in depth; for dbt-managed tables, add indexes in `post-hook`:

```sql
-- dbt_project.yml
models:
  financial_indices:
    marts:
      esg:
        +post-hook:
          - "CREATE INDEX IF NOT EXISTS ix_{{ this.identifier }}_issuer_date
             ON {{ this }} (issuer_id, score_date)
             INCLUDE (environmental_score, social_score, governance_score)"
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
> Build both the original and refactored models in a dev dataset, run `audit_helper.compare_relations` and `audit_helper.compare_column_values` for each key column, confirm zero row discrepancies, then open the PR. Gate the merge on these comparisons passing.

---

## Related

- [query-plan-analysis](https://alp78.github.io/elysium/04-SQL-Server/Performance/query-plan-analysis)
- [querying-and-cost-optimization](https://alp78.github.io/elysium/06-GCP/BigQuery/querying-and-cost-optimization)
- [dbt-materializations](https://alp78.github.io/elysium/11-dbt/Modeling/dbt-materializations)
- [dbt-troubleshooting](https://alp78.github.io/elysium/11-dbt/Operations/dbt-troubleshooting)
- [dbt-observability](https://alp78.github.io/elysium/11-dbt/Operations/dbt-observability)
