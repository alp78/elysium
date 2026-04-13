---
title: "01 - dbt: Staging Models"
tags: [pipeline, dbt]
status: stable
updated: 2026-03-23
description: "Staging models 1:1 with source, source freshness"
---

# dbt: Staging Models

> [!quote]
> "A pure task should be deterministic and idempotent, meaning that it will produce the same result every time it runs or re-runs."
>
> — **Maxime Beauchemin**, "Functional Data Engineering" (2018)

> [!abstract]- Summary
>
> Explains how dbt staging models form the first modeling layer above raw sources by keeping transformations structural, source-aligned, and easy to audit before any business logic enters the DAG.
>
> **Staging role and operating rules**
> - Defines the core staging principles: one model per source table, rename-and-cast only, view materialization by default, explicit `stg_<source>__<entity>` naming, and no cross-source joins or embedded business rules
> - Ties staging behavior to deterministic, idempotent modeling so source changes remain visible immediately instead of being hidden inside downstream enrichment logic
>
> **Source declarations and freshness**
> - Covers `_sources.yml`, source-level tests, table-level metadata, and freshness thresholds so raw ingestion contracts are explicit before modeled relations are built
> - Explains how source declarations document the handoff from ingestion into dbt and provide early warning when upstream feeds drift or stall
>
> **Model implementation patterns**
> - Walks through concrete staging model SQL, including renaming, casting, lightweight derived fields, accepted-range tests, and surrogate-key decisions that simplify downstream joins without changing business meaning
> - Reinforces the boundary between structural cleanup in staging and analytical logic in intermediate or mart layers
>
> **Operations and safety**
> - Warnings: hiding business logic in staging, breaking the 1:1 source mapping, skipping source freshness definitions, and using heavyweight materializations where source-aligned views are the safer default
> - Recommendations: keep staging models narrow, declare sources and freshness centrally, enforce consistent naming, and make every transformation auditable back to a single upstream table

> [!note]- Glossary
>
> **Staging model**
> - The first dbt model layer above raw sources, usually limited to renaming, casting, and lightweight structural cleanup.
> - It matters here because the note defines staging as a strict contract boundary, not as a place for business logic or cross-source analysis.
>
> > [!warning] Structural layer only
> >
> > Once staging starts carrying domain rules or joins, source changes become harder to audit and downstream model responsibilities blur quickly.
>
> ---
>
> **Source table**
> - A raw ingested relation declared to dbt through `source()` metadata rather than produced by another dbt model.
> - It matters here because staging models are intended to stay 1:1 with source tables so lineage remains obvious.
>
> > [!info] Raw-system boundary
> >
> > Source tables represent the handoff from ingestion into transformation. Keeping that boundary explicit is what makes freshness and raw-data troubleshooting workable.
>
> ---
>
> **`_sources.yml`**
> - A YAML declaration file that defines source names, tables, tests, freshness rules, and documentation metadata.
> - It matters here because source correctness and freshness should be declared once at the raw boundary rather than scattered across model SQL.
>
> > [!warning] Metadata is operational control
> >
> > Missing or weak source declarations do not just reduce documentation quality. They remove the main early-warning mechanism for stale or malformed upstream data.
>
> ---
>
> **Source freshness**
> - A dbt check that measures how old the latest loaded source data is relative to configured warning and error thresholds.
> - It matters here because staging models are only trustworthy when the upstream raw feed is current enough for downstream SLAs.
>
> > [!warning] Freshness is not optional monitoring
> >
> > If freshness thresholds are missing, teams often discover upstream ingestion failures only after transformed marts or dashboards are already wrong.
>
> ---
>
> **`source()`**
> - A dbt function that references a declared external source table inside model SQL.
> - It matters here because staging is the main place where `source()` should appear; downstream layers should usually depend on staged refs instead.
>
> > [!info] Entry point into the DAG
> >
> > `source()` marks where dbt modeling starts. If later layers keep reaching back to raw tables directly, the graph stops encoding clean layer boundaries.
>
> ---
>
> **Rename-and-cast pattern**
> - The staging practice of normalizing column names, types, and light formatting while preserving the original business meaning of the raw data.
> - It matters here because most staging value comes from standardizing raw inputs without inventing new logic.
>
> > [!warning] Do not over-transform
> >
> > Renaming and casting improve usability; derived business semantics belong elsewhere. Over-transforming in staging hides where meaning changed.
>
> ---
>
> **`stg_<source>__<entity>`**
> - The conventional naming pattern for staging models, using a double underscore to separate source system from entity.
> - It matters here because naming is one of the fastest ways to communicate origin and keep selection patterns consistent across the project.
>
> > [!info] Machine-readable origin marker
> >
> > Good staging names help both humans and selectors. The source prefix makes lineage visible before you open the SQL file.
>
> ---
>
> **View materialization**
> - A dbt materialization that creates a view instead of storing a physical copy of the staging result.
> - It matters here because views are usually the safest default for source-aligned structural cleanup with minimal storage cost.
>
> > [!warning] Cheap does not mean free everywhere
> >
> > Views preserve freshness and avoid storage, but they can still become expensive if downstream queries repeatedly stack complex logic on top of them.
>
> ---
>
> **Surrogate key**
> - A simplified identifier added when the natural key is too wide or awkward for reliable downstream joins.
> - It matters here because staging is often the right place to standardize key shape before enrichment layers start depending on it.
>
> > [!warning] Standardize, do not redefine grain
> >
> > A surrogate key should simplify joins, not change what one row represents. If the surrogate key hides a grain change, the model is doing more than staging work.
>
> ---
>
> **Accepted-range test**
> - A validation rule, often from `dbt_utils`, that constrains numeric values to an allowed interval.
> - It matters here because staging models are the first practical place to reject obviously invalid source values such as negative prices or out-of-range weights.
>
> > [!info] Structural sanity check
> >
> > Range tests are not full business-rule coverage. They are fast boundary checks that keep corrupt raw values from flowing deeper into the DAG.
>
> ---
>
> **Business logic boundary**
> - The modeling rule that staging should stop at structural transformation and leave joins, scoring, and domain rules to later layers.
> - It matters here because the whole note is really about enforcing that boundary consistently across a dbt project.
>
> > [!warning] Layer drift is cumulative
> >
> > A little business logic in staging feels harmless until many models depend on it. By then, the layer boundary is gone and refactoring becomes much harder.


### Staging Model Core Principles

| Rule | Rationale |
|---|---|
| 1:1 with source table | Easy to audit; changes in the source are immediately visible |
| Rename and cast only | Business logic belongs in intermediate models |
| Materialise as views | No storage cost; always reflects current source data |
| Prefix `stg_<source>__<entity>` | Makes origin instantly clear |
| One staging model per source table | Prevents hidden coupling between sources |
| Add `_id` surrogate key where natural key is complex | Simplifies downstream joins |

> [!tip] Related pattern
> The rename-and-cast operations in staging models rely on the same [sql-fundamentals](https://alp78.github.io/elysium/05-DB-Queries/SQL-Server/sql-fundamentals) patterns — `CAST`, `UPPER`, `TRIM`, and `COALESCE` — that appear throughout the SQL reference material.

> [!NOTE] No business logic
> If you find yourself writing a `CASE WHEN` that encodes a business rule (e.g., "a return > 50% is suspicious"), that belongs in an intermediate model, not staging. Staging is for structural transformation only.

---

### dbt _sources.yml — Full Declaration with Freshness

```yaml
# models/staging/market_data/_sources.yml
version: 2

sources:
  - name: market_data
    description: >
      End-of-day market data ingested from the primary exchange data vendor.
      Tables are loaded nightly after exchange close.
    database: raw_db
    schema: market_data_raw
    loaded_at_field: _ingested_at
    freshness:
      warn_after:  {count: 25, period: hour}
      error_after: {count: 49, period: hour}

    tables:
      - name: daily_prices
        description: "OHLCV data per security per trading day."
        freshness:
          warn_after:  {count: 6,  period: hour}
          error_after: {count: 24, period: hour}
        columns:
          - name: security_id
            description: "Vendor-assigned security identifier."
            tests: [not_null]
          - name: price_date
            description: "Calendar date of the price observation."
            tests: [not_null]
          - name: open_price
            tests: [not_null]
          - name: high_price
            tests: [not_null]
          - name: low_price
            tests: [not_null]
          - name: close_price
            tests:
              - not_null
              - dbt_utils.accepted_range:
                  min_value: 0
                  inclusive: false
          - name: adjusted_close_price
            tests:
              - dbt_utils.accepted_range:
                  min_value: 0
                  inclusive: false
          - name: volume
            tests:
              - dbt_utils.accepted_range:
                  min_value: 0
                  inclusive: true

      - name: corporate_actions
        description: "Dividends, splits, spin-offs, mergers."
        columns:
          - name: action_id
            tests: [not_null, unique]
          - name: security_id
            tests: [not_null]
          - name: action_type
            tests:
              - accepted_values:
                  values: ['DIVIDEND', 'SPLIT', 'SPINOFF', 'MERGER', 'RIGHTS']
          - name: effective_date
            tests: [not_null]

      - name: index_constituents
        description: "Point-in-time constituent membership with weights."
        columns:
          - name: index_id
            tests: [not_null]
          - name: security_id
            tests: [not_null]
          - name: effective_date
            tests: [not_null]
          - name: weight
            tests:
              - dbt_utils.accepted_range:
                  min_value: 0
                  max_value: 1
                  inclusive: true

  - name: esg
    description: "ESG scores and controversy data from third-party ESG provider."
    database: raw_db
    schema: esg_raw
    loaded_at_field: _ingested_at
    freshness:
      warn_after:  {count: 8,  period: day}
      error_after: {count: 15, period: day}

    tables:
      - name: scores
        description: "Environmental, Social, Governance pillar scores per security."
        columns:
          - name: security_id
            tests: [not_null]
          - name: score_date
            tests: [not_null]
          - name: esg_score
            tests:
              - dbt_utils.accepted_range:
                  min_value: 0
                  max_value: 100
          - name: e_score
            tests:
              - dbt_utils.accepted_range:
                  min_value: 0
                  max_value: 100
          - name: s_score
            tests:
              - dbt_utils.accepted_range:
                  min_value: 0
                  max_value: 100
          - name: g_score
            tests:
              - dbt_utils.accepted_range:
                  min_value: 0
                  max_value: 100
```

---

### stg_market_data__daily_prices

```sql
-- models/staging/market_data/stg_market_data__daily_prices.sql
-- Materialisation inherited from project config: view, schema: silver

with source as (

    select * from {{ source('market_data', 'daily_prices') }}

),

renamed as (

    select
        -- Primary identifiers
        security_id                                      as security_id,
        cast(price_date as date)                         as price_date,

        -- OHLCV columns — standardised naming
        cast(open_price          as numeric)             as open_price,
        cast(high_price          as numeric)             as high_price,
        cast(low_price           as numeric)             as low_price,
        cast(close_price         as numeric)             as close_price,
        cast(adjusted_close_price as numeric)            as adjusted_close_price,
        cast(volume              as bigint)              as volume,

        -- Currency context
        upper(trim(currency_code))                       as currency_code,

        -- Exchange context
        upper(trim(exchange_code))                       as exchange_code,

        -- Metadata
        _ingested_at                                     as _ingested_at,
        _source_file                                     as _source_file

    from source

)

select * from renamed
```

---

### stg_esg__scores

```sql
-- models/staging/esg/stg_esg__scores.sql

with source as (

    select * from {{ source('esg', 'scores') }}

),

renamed as (

    select
        -- Identifiers
        security_id                              as security_id,
        cast(score_date as date)                 as score_date,

        -- ESG pillar scores (0–100 scale, provider normalised)
        cast(esg_score as numeric(6,3))          as esg_score,
        cast(e_score   as numeric(6,3))          as e_pillar_score,
        cast(s_score   as numeric(6,3))          as s_pillar_score,
        cast(g_score   as numeric(6,3))          as g_pillar_score,

        -- Provider metadata
        upper(trim(provider_code))               as provider_code,
        upper(trim(rating_category))             as rating_category,

        -- Whether this is a restated score
        cast(is_restated as boolean)             as is_restated_flag,

        -- Ingestion metadata
        _ingested_at                             as _ingested_at

    from source

)

select * from renamed
```

---

### stg_market_data__corporate_actions

```sql
-- models/staging/market_data/stg_market_data__corporate_actions.sql

with source as (

    select * from {{ source('market_data', 'corporate_actions') }}

),

renamed as (

    select
        -- Surrogate key (natural key is composite: security_id + action_type + effective_date)
        {{ dbt_utils.generate_surrogate_key([
            'security_id',
            'action_type',
            'effective_date'
        ]) }}                                    as corporate_action_key,

        -- Natural identifiers
        action_id                                as source_action_id,
        security_id                              as security_id,
        cast(effective_date as date)             as effective_date,
        cast(ex_date        as date)             as ex_date,
        cast(record_date    as date)             as record_date,
        cast(payment_date   as date)             as payment_date,

        -- Action classification
        upper(trim(action_type))                 as action_type,

        -- Split / dividend amounts
        cast(split_ratio         as numeric(12,6)) as split_ratio,
        cast(dividend_amount     as numeric(18,6)) as dividend_amount,
        upper(trim(dividend_currency))           as dividend_currency,

        -- Spinoff / merger target
        related_security_id                      as related_security_id,

        -- Ingestion metadata
        _ingested_at                             as _ingested_at

    from source

)

select * from renamed
```

---

### stg_market_data__index_constituents

```sql
-- models/staging/market_data/stg_market_data__index_constituents.sql

with source as (

    select * from {{ source('market_data', 'index_constituents') }}

),

renamed as (

    select
        -- Surrogate key
        {{ dbt_utils.generate_surrogate_key([
            'index_id',
            'security_id',
            'effective_date'
        ]) }}                                    as constituent_key,

        -- Identifiers
        index_id                                 as index_id,
        security_id                              as security_id,
        cast(effective_date as date)             as effective_date,

        -- Weight (decimal; 0.05 = 5%)
        cast(weight as numeric(10,8))            as weight,

        -- Change type on this date
        upper(trim(change_type))                 as change_type,   -- ADD / REMOVE / REWEIGHT

        -- Ingestion metadata
        _ingested_at                             as _ingested_at

    from source

)

select * from renamed
```

---

### _staging_market_data.yml — Column-Level Documentation

```yaml
# models/staging/market_data/_staging_market_data.yml
version: 2

models:
  - name: stg_market_data__daily_prices
    description: "Cleaned, renamed OHLCV data. 1:1 with raw daily_prices table."
    columns:
      - name: security_id
        description: "Vendor security identifier. Natural key."
        tests: [not_null]
      - name: price_date
        description: "Trading date of the observation."
        tests: [not_null]
      - name: close_price
        tests:
          - not_null
          - dbt_utils.accepted_range:
              min_value: 0
              inclusive: false
      - name: adjusted_close_price
        description: "Close price adjusted for corporate actions."
    tests:
      - dbt_utils.unique_combination_of_columns:
          combination_of_columns: [security_id, price_date, exchange_code]

  - name: stg_market_data__index_constituents
    description: "Point-in-time constituent membership per index."
    columns:
      - name: constituent_key
        tests: [not_null, unique]
      - name: weight
        tests:
          - dbt_utils.accepted_range:
              min_value: 0
              max_value: 1
    tests:
      - dbt_utils.unique_combination_of_columns:
          combination_of_columns: [index_id, security_id, effective_date]

  - name: stg_market_data__corporate_actions
    columns:
      - name: corporate_action_key
        tests: [not_null, unique]
      - name: action_type
        tests:
          - accepted_values:
              values: ['DIVIDEND', 'SPLIT', 'SPINOFF', 'MERGER', 'RIGHTS']

  - name: stg_esg__scores
    columns:
      - name: esg_score
        tests:
          - dbt_utils.accepted_range:
              min_value: 0
              max_value: 100
    tests:
      - dbt_utils.unique_combination_of_columns:
          combination_of_columns: [security_id, score_date, provider_code]
```

---

### dbt Source Freshness in Practice

```bash
# Run freshness checks for all sources
dbt source freshness

# Check only the market_data source
dbt source freshness --select source:market_data

# Sample output:
# Found 2 sources
# Freshness of 2 sources checked in 0.43s
# ERROR Source market_data.daily_prices is 26 hours, 4 minutes out of date
# PASS  Source esg.scores is 2 days, 3 hours out of date (within threshold)
```

Wire freshness failures into your orchestration layer to block downstream runs when sources are stale.

---

### Staging Model Anti-Patterns

> [!WARNING] Anti-patterns to avoid in staging

> [!success] Correct staging scope
> Staging models should contain only: column renames, type casts, `UPPER`/`TRIM` normalisation, surrogate key generation, and ingestion metadata passthrough. Any join, filter, or business rule belongs in an intermediate model where it can be independently tested and documented.

**Joining to other models**: Staging models should reference only their own source. Any join introduces a dependency that belongs in the intermediate layer.

```sql
-- WRONG: join in staging
select p.*, s.company_name
from {{ source('market_data', 'daily_prices') }} p
left join {{ ref('dim_securities') }} s on p.security_id = s.security_id
```

**Business logic and filters**: Do not filter rows in staging unless the source truly contains structural garbage (e.g., empty header rows). Filtering valid data hides lineage.

```sql
-- WRONG: business filter in staging
where close_price > 0 and volume > 1000  -- this is analytical logic
```

**Aggregation**: Staging is never the right place to sum, average, or group. It is always 1:1 row-preserving.

**Using `SELECT *` without aliasing**: Even though staging is 1:1, always explicitly list columns. This makes schema drift immediately visible as a compilation error.

---

## Related

- [dbt-intermediate-models](https://alp78.github.io/elysium/11-dbt/Modeling/dbt-intermediate-models)
- [dbt-project-structure](https://alp78.github.io/elysium/11-dbt/Foundations/dbt-project-structure)
- [dbt-core-concepts](https://alp78.github.io/elysium/11-dbt/Foundations/dbt-core-concepts)
- [bronze-layer-loading](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/bronze-layer-loading)
