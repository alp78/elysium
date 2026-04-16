---
title: "04 - dbt: Materializations"
tags: [pipeline, dbt]
status: stable
updated: 2026-03-23
description: "View table incremental ephemeral snapshot deep dive"
---

# dbt: Materializations

> [!quote] State management tradeoffs
>
> "There are only two ways to handle state in computing: recompute it or cache it. Everything else is a variation on that theme."
>
> Source: Pat Helland

> [!abstract]- Summary
>
> Explains how dbt materializations turn the same model SQL into very different warehouse behaviors by changing persistence, rebuild semantics, incremental state handling, and long-term cost or performance tradeoffs.
>
> **Materialization decision model**
> - Defines the five core dbt materializations - `view`, `table`, `incremental`, `ephemeral`, and `snapshot` - and compares what object each creates, whether data is stored, and how each behaves across runs
> - Frames materialization choice as one of the biggest architectural controls in a dbt project because it changes both execution semantics and downstream warehouse behavior
>
> **State and persistence patterns**
> - Covers full rebuilds, `is_incremental()` branches, `unique_key`, schema-change handling, and the major incremental strategies such as append, delete+insert, merge, and insert_overwrite
> - Shows where materialization decides whether dbt recomputes from scratch, caches warehouse state physically, or inlines logic without creating an object at all
>
> **Operational fit and failure modes**
> - Maps each materialization to the right modeling layer and workload shape, including why staging tends toward views, marts often use tables or incrementals, and snapshots solve historical tracking rather than ordinary transformation
> - Highlights the most common correctness and cost failures, especially around broken incremental predicates, unnecessary rebuilds, and misuse of ephemeral or snapshot behavior
>
> **Operations and safety**
> - Warnings: wrong `is_incremental()` filters, skipped late-arriving data, casual full refreshes, overuse of views on expensive logic, and snapshot or incremental strategies applied without a clear change model
> - Recommendations: choose materialization by workload shape, pair incrementals with lookback windows and `unique_key`, treat snapshots as temporal history tools, and revisit materialization when query cost or rebuild time changes materially

> [!info]- Glossary
>
> **Materialization**
> - The dbt setting that determines how a model's SQL result is persisted or represented in the warehouse.
> - It matters here because the entire note is about how persistence choice changes both performance and correctness behavior for the same logical model.
>
> > [!warning] Same SQL, different system behavior
> >
> > Materialization is not a cosmetic knob. It changes rebuild semantics, query cost, object type, and how downstream consumers interact with the model.
>
> ---
>
> **`view`**
> - A materialization that creates a view so the underlying query executes at read time rather than storing a full physical copy.
> - It matters here because views are a common default, especially in staging, but they push computation into downstream query time.
>
> > [!warning] Cheap storage, repeated compute
> >
> > Views avoid storage cost but can become expensive when downstream models or BI tools repeatedly re-run complex logic on every query.
>
> ---
>
> **`table`**
> - A materialization that drops and recreates a full physical table on each run.
> - It matters here because tables are the simplest persistent option when full rebuilds are cheap enough and predictable reads matter more than run-time efficiency.
>
> > [!info] Full rebuild simplicity
> >
> > Tables trade extra build work for clearer runtime behavior. They are often the easiest persistent surface to reason about when dataset size is still manageable.
>
> ---
>
> **`incremental`**
> - A materialization that processes only new or changed rows after the first full build instead of recreating the entire relation every time.
> - It matters here because incremental models are one of the main ways dbt scales large fact-like workloads without constant full rebuilds.
>
> > [!warning] Optimization with hidden state
> >
> > Incremental models depend on prior warehouse state being correct. A bad predicate can silently skip data for a long time before anyone notices.
>
> ---
>
> **`ephemeral`**
> - A materialization that inlines a model as a CTE into dependent SQL instead of creating a separate warehouse object.
> - It matters here because ephemeral models reduce object clutter but remove the ability to inspect or persist intermediate state directly.
>
> > [!warning] No standalone relation to inspect
> >
> > Ephemeral is convenient for simple helper logic, but it can make debugging and downstream performance analysis harder once the SQL becomes large or widely reused.
>
> ---
>
> **`snapshot`**
> - A dbt resource that stores historical row versions over time, usually for slowly changing dimensions or other temporal tracking.
> - It matters here because snapshots solve a different problem from ordinary models: recording state change history instead of just publishing the latest result.
>
> > [!info] History mechanism, not generic persistence
> >
> > Snapshots should be chosen because temporal history matters, not because they seem like another variant of incremental loading.
>
> ---
>
> **`is_incremental()`**
> - A dbt macro that evaluates to true when an incremental model is running against an already-existing target relation without full refresh.
> - It matters here because incremental correctness depends on the branch guarded by `is_incremental()` being written safely.
>
> > [!warning] Predicate quality decides data completeness
> >
> > The macro is only as safe as the filter behind it. A narrow cutoff can skip late-arriving or corrected records indefinitely.
>
> ---
>
> **Lookback window**
> - A small historical overlap included in an incremental predicate so recent rows are reprocessed and corrected if late-arriving data appears.
> - It matters here because lookback windows are the practical safeguard against gaps and restatements in incremental models.
>
> > [!warning] Exact boundaries are brittle
> >
> > Filtering strictly from the current max timestamp looks efficient, but it often misses delayed or corrected data. Reprocessing a small window is usually safer.
>
> ---
>
> **`unique_key`**
> - A dbt incremental config that identifies which rows should be updated or matched during incremental writes.
> - It matters here because many incremental strategies depend on a trustworthy row identity to avoid duplicates or stale replacements.
>
> > [!warning] Wrong key, wrong history
> >
> > If the unique key does not match real model grain, merge and delete+insert strategies produce silent corruption rather than obvious failures.
>
> ---
>
> **Full refresh**
> - A dbt execution mode that rebuilds an incremental model from scratch instead of using its incremental branch.
> - It matters here because it is both a recovery tool and a high-cost operation that changes how model state is rebuilt.
>
> > [!warning] Expensive but sometimes necessary
> >
> > Full refresh is the cleanest fix for some drift and schema issues, but it can be operationally disruptive on large models if used casually.
>
> ---
>
> **Merge strategy**
> - An incremental write strategy that matches rows by key and updates existing records while inserting new ones.
> - It matters here because merge is the default mental model for many incremental marts, and its behavior depends heavily on adapter support and key correctness.
>
> > [!info] Update plus insert path
> >
> > Merge is powerful because it supports corrections and late data, but it is not automatically safe. It still needs the right key, predicate, and adapter semantics.
>
> ---
>
> **Delete+insert strategy**
> - An incremental strategy that deletes matching target rows and reinserts the replacement set from the incremental run.
> - It matters here because it offers a simpler alternative to merge on some warehouses or workloads.
>
> > [!warning] Rewrites matched slices
> >
> > Delete+insert avoids some merge complexity, but it can still be costly or risky if the selected replacement set is too broad or the key definition is unstable.
>
> ---
>
> **Insert_overwrite strategy**
> - A partition-oriented incremental strategy that replaces full partitions instead of individual rows, often used on systems like BigQuery or Spark.
> - It matters here because some large partitioned models are better served by partition replacement than row-level merge behavior.
>
> > [!info] Partition-shaped optimization
> >
> > Insert_overwrite is powerful when the warehouse and table design support it, but it assumes partition boundaries are the right unit of replacement.

## The Five Materialisation Types

| Type | Warehouse object | Data is stored? | Rebuilt each run? |
|---|---|---|---|
| `view` | View / virtual table | No (query-time) | Yes (DDL is re-applied) |
| `table` | Physical table | Yes | Yes (DROP + CREATE) |
| `incremental` | Physical table | Yes | No (append/merge only) |
| `ephemeral` | CTE (no object) | No | N/A (inlined) |
| `snapshot` | Physical table | Yes | Appended via SCD logic |

---

## dbt view Materialisation

The default materialisation. dbt issues a `CREATE OR REPLACE VIEW` on every run. The underlying query executes at query time, always reflecting current source data.

*This view example keeps a staging model lightweight by pushing the final query evaluation to read time instead of persisting a physical table.*

```sql
-- models/staging/market_data/stg_market_data__daily_prices.sql
{{ config(materialized='view') }}

select
    security_id,
    cast(price_date as date)          as price_date,
    cast(close_price as numeric)      as close_price,
    cast(volume as bigint)            as volume
from {{ source('market_data', 'daily_prices') }}
```

**When to use**: All staging models. Simple intermediate models. Any model where storage cost matters more than query latency.

**When not to use**: When downstream queries are complex and scan many rows — the view re-executes the full query every time it is referenced.

---

## dbt table Materialisation

dbt drops and recreates the physical table on every run. Simple and predictable.

*This table example shows the simplest persistent mart pattern: rebuild the whole relation each run when the dataset is still cheap enough to recompute fully.*

```sql
-- models/marts/reference/dim_indices.sql
{{ config(
    materialized = 'table',
    tags         = ['reference']
) }}

select
    index_id,
    index_name,
    index_family,
    currency_code,
    rebalance_frequency
from {{ ref('stg_indices__master') }}
```

**When to use**: Reference dimensions (`dim_*`). Intermediate models that are expensive to recompute and referenced by many downstream models. Any model where full rebuild time is acceptable.

**When not to use**: Tables with hundreds of millions of rows where a full rebuild takes too long. Use `incremental` instead.

> [!info] Full-refresh parity
>
> Running `dbt run --full-refresh` against an incremental model should produce the same logical result as its non-incremental path, but only if that path selects the full historical dataset correctly. Prefer a permanent `table` materialization when the model is small enough that a full rebuild is the normal, low-risk operating mode.

---

## dbt incremental Materialisation

dbt first checks whether the relation exists. If it does, it runs the model's `{% if is_incremental() %}` branch to produce only new/changed rows, then merges or appends them. If the table does not exist (or `--full-refresh` is passed), it behaves like `table`.

> [!danger] Bad incremental predicates lose data quietly
>
> The `is_incremental()` branch determines which rows are processed. If the filter references `max(price_date) FROM {{ this }}` but the table was loaded with a gap such as a missed backfill, that gap can remain unprocessed indefinitely. Always use a lookback window instead of an exact boundary so late-arriving and corrected rows are revisited intentionally.

> [!success] Safe pattern: lookback window
>
> Always subtract a lookback offset from `max()` in the incremental filter:
> ```sql
> where price_date >= (
>     select dateadd(day, -{{ var('lookback_days', 3) }}, max(price_date))
>     from {{ this }}
> )
> ```
> Pair with `unique_key` and `merge` strategy so re-processed rows are updated, not duplicated.

### Basic Pattern

*This baseline incremental pattern uses a unique key, a bounded lookback window, and schema-change handling so reruns can update recent slices instead of duplicating them.*

```sql
-- models/marts/performance/fct_index_performance.sql
{{ config(
    materialized     = 'incremental',
    unique_key       = ['index_id', 'price_date'],
    on_schema_change = 'append_new_columns'
) }}

with source as (

    select
        index_id,
        price_date,
        index_daily_return,
        constituent_count
    from {{ ref('int_daily_returns_indexed') }}

    {% if is_incremental() %}
    -- Late-arriving data lookback: reprocess last N days to catch corrections
    where price_date >= (
        select dateadd(day, -{{ var('lookback_days', 3) }}, max(price_date))
        from {{ this }}
    )
    {% endif %}

)

select * from source
```

### Incremental Strategies

#### append

Inserts new rows only. Never updates existing rows. Fastest option.

*This append strategy is appropriate only when existing rows are immutable and corrections are handled outside the model.*

```sql
{{ config(
    materialized = 'incremental',
    incremental_strategy = 'append'
) }}
```

Use when: rows are immutable once written (e.g., audit logs, intraday tick snapshots).

#### delete+insert

Deletes rows matching `unique_key` in the target, then inserts all rows from the incremental run. Simpler than merge; avoids merge lock contention on some warehouses.

*This strategy rewrites the affected key slice on each incremental run, which is often easier to reason about than a warehouse-specific merge plan.*

```sql
{{ config(
    materialized         = 'incremental',
    unique_key           = 'corporate_action_key',
    incremental_strategy = 'delete+insert'
) }}
```

Use when: rows can be corrected/restated and you want clean replacement without a full rebuild.

#### merge (default for most adapters)

Issues a SQL [MERGE](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/merge-and-upsert) statement matching on `unique_key`. Rows that match are updated; rows that do not match are inserted.

*This merge configuration is the common choice when corrected rows and late-arriving facts need to upsert into an existing published table.*

```sql
{{ config(
    materialized         = 'incremental',
    unique_key           = ['index_id', 'price_date'],
    incremental_strategy = 'merge',
    merge_update_columns = ['index_daily_return', 'constituent_count', 'total_weight_coverage']
) }}
```

`merge_update_columns` restricts which columns are updated on a match, preventing overwrite of columns not included in the incremental query.

#### insert_overwrite (BigQuery / Spark)

Overwrites entire partitions rather than individual rows. Extremely efficient for partitioned tables.

*This pattern replaces whole date partitions, which is efficient only when the warehouse and table design make partition-level replacement the right unit of change.*

```sql
{{ config(
    materialized         = 'incremental',
    incremental_strategy = 'insert_overwrite',
    partition_by         = {
        'field': 'price_date',
        'data_type': 'date',
        'granularity': 'day'
    }
) }}

select * from {{ ref('int_daily_returns') }}

{% if is_incremental() %}
where price_date >= date_sub(current_date(), interval {{ var('lookback_days', 3) }} day)
{% endif %}
```

---

> [!warning] `on_schema_change: ignore` drops new columns
>
> If you add a column to your incremental model but forget to set `on_schema_change`, dbt defaults to `ignore`. The new column appears in development where the table is created fresh, but it is silently omitted in production when the existing table lacks that column. Set `on_schema_change: 'append_new_columns'` on incremental models unless you have a stronger compatibility requirement.

> [!success] Safe default
>
> Set `on_schema_change: 'append_new_columns'` in incremental model configs that evolve over time. That adds new columns to the existing table in production without immediately forcing a full refresh or manual DDL.

### dbt on_schema_change Behaviour

Controls what happens when the model's column set changes compared to the existing table.

| Value | Behaviour |
|---|---|
| `ignore` | New columns silently dropped from incremental run |
| `fail` | Run fails if schema differs |
| `append_new_columns` | New columns added to table; old columns preserved |
| `sync_all_columns` | Adds new, removes deleted columns (destructive) |

*This config snippet opts into additive schema evolution so published incremental tables can accept new columns without breaking the whole run path.*

```sql
{{ config(
    materialized     = 'incremental',
    unique_key       = ['security_id', 'score_date'],
    on_schema_change = 'append_new_columns'   -- safe default for evolving models
) }}
```

> [!warning] `sync_all_columns` can remove consumer columns
>
> `sync_all_columns` will drop columns that were removed from your model SQL. That can break downstream BI tools and APIs that still reference them. Prefer `append_new_columns` for ordinary evolution and handle destructive removals through an explicit rollout plan.

> [!success] Safe removal workflow
>
> Use `append_new_columns` in production. To retire a column, deprecate it in documentation first, notify consumers, and then schedule a controlled `--full-refresh` or replacement deployment in a maintenance window after consumers have migrated.

---

### dbt Late-Arriving Data Lookback Pattern

A core challenge with incremental models processing financial data is that source systems frequently backfill or correct historical data. A price vendor might correct a corporate action adjustment 2 days after initial delivery.

The lookback pattern reprocesses a rolling window of recent data on every incremental run:

*This example reprocesses a bounded recent slice so corrected vendor data can overwrite stale rows instead of being missed permanently.*

```sql
{{ config(
    materialized = 'incremental',
    unique_key   = ['security_id', 'price_date']
) }}

with prices as (

    select *
    from {{ ref('stg_market_data__daily_prices') }}

    {% if is_incremental() %}
    -- Reprocess lookback window to catch late corrections.
    -- var('lookback_days') defaults to 3; extend for vendors with longer correction windows.
    where price_date >= (
        select dateadd(day, -{{ var('lookback_days', 3) }}, max(price_date))
        from {{ this }}
    )
    {% endif %}

)

select * from prices
```

With `unique_key` and `merge` strategy, dbt will update existing rows that fall in the lookback window with corrected values, then insert genuinely new rows. This merge-based approach is a key ingredient of [idempotent-pipeline-design](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design) — re-running the same date range produces identical results without duplicating data.

---

## dbt ephemeral Materialisation

Ephemeral models are not materialised in the warehouse at all. dbt inlines their SQL as a CTE in every model that references them via `ref()`.

*This ephemeral helper keeps trivial row-level logic out of the warehouse object list, but it still becomes part of every downstream compiled statement that references it.*

```sql
-- models/intermediate/market_data/int_price_flags.sql
{{ config(materialized='ephemeral') }}

select
    security_id,
    price_date,
    case
        when close_price <= 0       then 'ZERO_OR_NEGATIVE'
        when high_price < low_price then 'INVERTED_HLOC'
        else                             'VALID'
    end as price_flag

from {{ ref('stg_market_data__daily_prices') }}
```

When `int_daily_returns` references `int_price_flags`, dbt compiles the ephemeral model's SQL directly into `int_daily_returns` as a CTE. No warehouse object is created.

**Limitations**:

- Cannot be queried directly.
- Not accessible via `--defer` (no artifact).
- Reused in many models = the CTE is duplicated in each compiled output, potentially confusing query planners.

---

## dbt snapshot Materialisation

Snapshots implement SCD Type 2 (slowly changing dimensions) — they record the full history of how a row changed over time.

*This snapshot captures constituent membership history so downstream consumers can query either the current state or a historical point in time without rebuilding old rows.*

```sql
-- snapshots/snap_index_constituents.sql
{% snapshot snap_index_constituents %}

{{ config(
    target_schema           = 'snapshots',
    unique_key              = 'constituent_key',
    strategy                = 'timestamp',
    updated_at              = '_ingested_at',
    invalidate_hard_deletes = true
) }}

select
    {{ dbt_utils.generate_surrogate_key(['index_id', 'security_id']) }} as constituent_key,
    index_id,
    security_id,
    weight,
    effective_date,
    _ingested_at

from {{ ref('stg_market_data__index_constituents') }}

{% endsnapshot %}
```

dbt adds four metadata columns to the snapshot table:

| Column | Meaning |
|---|---|
| `dbt_scd_id` | Unique identifier for each snapshot record |
| `dbt_updated_at` | Timestamp of the source row's last change |
| `dbt_valid_from` | When this version of the row became active |
| `dbt_valid_to` | When this version was superseded (NULL = current) |

Query the current state:

*This query filters snapshot metadata to the rows that are still active today.*

```sql
select * from snap_index_constituents
where dbt_valid_to is null
```

Query the state on a specific date:

*This query reconstructs the state that was valid on a chosen historical date by using the snapshot validity window.*

```sql
select * from snap_index_constituents
where '2023-06-30' between dbt_valid_from and coalesce(dbt_valid_to, '9999-12-31')
```

**Strategies**:

- `timestamp`: uses an `updated_at` column to detect changes. Most reliable.
- `check`: compares a list of columns (`check_cols`) and marks a new version when any column changes. Use when no reliable `updated_at` exists.

---

## Materialisation Decision Matrix

| Scenario | Recommended materialisation |
|---|---|
| Staging model (1:1 with source) | `view` |
| Lightweight intermediate CTE | `ephemeral` |
| Reference dimension, infrequently changing | `table` |
| Expensive intermediate, many downstream refs | `table` |
| Daily incremental fact table, large history | `incremental` (merge or insert_overwrite) |
| Audit log, append-only event stream | `incremental` (append) |
| SCD Type 2 history tracking | `snapshot` |
| Model too slow as view, too large for table rebuild | `incremental` |

---

## dbt Full-Refresh Mechanics

Running `dbt run --full-refresh` against an incremental model causes dbt to:

1. Drop the existing table.
2. Execute the model SQL *without* the `{% if is_incremental() %}` filter.
3. Create a new table with all rows from the full query.

This is equivalent to dropping and recreating a `table` materialisation. It is the escape hatch when incremental state becomes corrupted or when a schema change requires a complete rebuild.

*These commands trigger targeted or broad rebuilds of incremental models when you intentionally want to bypass incremental state and recompute from scratch.*

```bash
# Full-refresh a single incremental model
dbt run --select fct_index_performance --full-refresh

# Full-refresh all models tagged 'incremental'
dbt run --select tag:incremental --full-refresh
```

> [!tip] Treat full refresh as an exception path
>
> Do not schedule routine production `--full-refresh` runs by default. Use them when schema drift, incremental corruption, or major logic changes justify the extra cost, and verify that the warehouse window, downstream SLAs, and backfill volume can absorb the rebuild safely.

---

## Related

- [dbt-core-concepts](https://alp78.github.io/elysium/11-dbt/Foundations/dbt-core-concepts)
- [dbt-mart-models](https://alp78.github.io/elysium/11-dbt/Modeling/dbt-mart-models)
- [dbt-intermediate-models](https://alp78.github.io/elysium/11-dbt/Modeling/dbt-intermediate-models)
- [idempotent-pipeline-design](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design)
