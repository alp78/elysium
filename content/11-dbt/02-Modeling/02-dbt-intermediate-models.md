---
title: "02 - dbt: Intermediate Models"
tags: [pipeline, dbt]
status: stable
updated: 2026-03-23
description: "Business logic transforms, silver layer"
---

# dbt: Intermediate Models

> [!quote] Reusable business logic
>
> "What you realize you're doing over time with data transformation is you're curating the knowledge of the organization that you work for."
>
> Source: Tristan Handy

> [!abstract]- Summary
>
> Explains how dbt intermediate models hold reusable business logic between staging and marts by joining, enriching, and reshaping clean inputs into composable analytical building blocks that stay internal to the DAG.
>
> **Intermediate-layer role and rules**
> - Defines the intermediate layer as the business-logic tier that depends on staged refs rather than raw sources, uses clear `int_<verb>_<entity>` naming, and stays internal rather than consumer-facing
> - Explains why small, composable intermediate models are easier to test, reuse, and refactor than large multi-purpose transformations
>
> **Materialization and transformation patterns**
> - Compares view, table, ephemeral, and incremental choices for intermediate models and ties each to reuse frequency, computational cost, and rolling-calculation behavior
> - Shows concrete patterns for returns, momentum, weights, and other reusable transformations that downstream marts can assemble without duplicating logic
>
> **Operational design boundary**
> - Reinforces why intermediate models should reference only `ref()` nodes, keep one concept per model, and avoid direct BI exposure even when analysts find them convenient
> - Positions the layer as the main place where domain logic becomes explicit and reusable before final publication in marts
>
> **Operations and safety**
> - Warnings: direct `source()` use, overgrown multi-purpose models, premature heavy materialization, and accidental analyst dependence on internal intermediate relations
> - Recommendations: keep one concept per model, prefer refs over raw sources, materialize heavily reused logic intentionally, and publish only the marts that are meant to be queried directly

> [!info]- Glossary
>
> **Intermediate model**
> - A dbt model that applies business logic on top of staged data and feeds other internal models rather than end-user tools directly.
> - It matters here because the note defines the intermediate layer as the main reusable transformation boundary in the project.
>
> > [!info] Business logic lives here
> >
> > Intermediate models are where calculations and enrichments become explicit reusable assets. They sit between structural cleanup and published marts.
>
> ---
>
> **Business logic layer**
> - The modeling layer where joins, enrichments, calculations, and domain-specific rules are applied to standardized upstream inputs.
> - It matters here because the note's core design rule is that intermediate models should absorb this logic instead of leaking it into staging or marts.
>
> > [!warning] Wrong-layer logic is expensive
> >
> > Putting business logic in staging or marts often feels faster at first, but it quickly creates duplication, audit pain, and harder downstream refactors.
>
> ---
>
> **`int_<verb>_<entity>`**
> - The common naming pattern for intermediate models, where the verb signals what the model does to the entity.
> - It matters here because intermediate models are defined more by transformation intent than by source origin or final consumer shape.
>
> > [!info] Intent-driven naming
> >
> > Good intermediate names explain the transformation role at a glance. That matters more here than mimicking source names or mart naming conventions.
>
> ---
>
> **`ref()`**
> - A dbt function that references another modeled relation and creates a dependency edge in the graph.
> - It matters here because intermediate models should be built on prior dbt models, not on raw source tables, so the graph stays layered and auditable.
>
> > [!warning] Stay inside the modeled graph
> >
> > Directly reaching back to raw sources from intermediate logic bypasses the staging contract and makes the DAG harder to reason about.
>
> ---
>
> **Composability**
> - The property that lets small models be combined safely into larger downstream transformations without repeating logic.
> - It matters here because intermediate models are valuable only if they can be reused as stable building blocks across multiple marts.
>
> > [!info] Small models scale better
> >
> > A slightly larger number of narrow intermediate models is usually easier to maintain than a few giant SQL files that mix multiple concepts together.
>
> ---
>
> **View materialization**
> - A materialization that leaves the model as a view, causing the underlying SQL to execute at query time.
> - It matters here because most intermediate models start as views unless reuse or computational cost justifies persistence.
>
> > [!warning] Cheap default, not universal answer
> >
> > Views are a good default for many intermediate models, but heavy window logic or widely reused transformations can make view-on-view stacks too expensive.
>
> ---
>
> **Table materialization**
> - A materialization that rebuilds and stores the full result as a physical table on each run.
> - It matters here because some intermediate models deserve persistence when they are expensive or heavily reused downstream.
>
> > [!warning] Persistence is a performance choice
> >
> > Persisting intermediate logic can help many downstream consumers, but it also adds rebuild cost and storage. Use it because of workload shape, not by default.
>
> ---
>
> **Ephemeral model**
> - A dbt model that is inlined as a CTE into dependent models instead of being created as a standalone warehouse relation.
> - It matters here because single-use helper logic often belongs in the intermediate layer but does not always deserve its own persisted object.
>
> > [!warning] Reuse stops being visible
> >
> > Ephemeral models reduce warehouse clutter, but they also hide intermediate results from direct inspection. Use them for simple single-use logic, not for important shared transformations.
>
> ---
>
> **Incremental intermediate model**
> - An intermediate model that processes only new or changed rows instead of rebuilding all history on every run.
> - It matters here because rolling calculations and large reusable transformations sometimes need incremental behavior before the mart layer.
>
> > [!warning] Optimization adds correctness risk
> >
> > Incremental logic is valuable only when the business transformation can tolerate lookback windows, restatements, and unique-key semantics without drift.
>
> ---
>
> **Window function**
> - A SQL function such as `lag`, `sum over`, or `count over` that computes results across related rows without collapsing them into grouped output.
> - It matters here because many intermediate-layer calculations, such as returns and momentum, depend on windowed history over staged data.
>
> > [!info] Common intermediate building block
> >
> > Window functions are often the first reason an intermediate model stops being trivial. They are powerful, but they also drive materialization and performance choices.
>
> ---
>
> **Reusable building block**
> - A model whose output is designed to be depended on by multiple downstream models without copying the same logic elsewhere.
> - It matters here because intermediate models earn their place by removing duplication across marts and other higher-level transformations.
>
> > [!warning] Publish reuse intentionally
> >
> > If a model is reused but unstable or poorly named, downstream dependencies multiply confusion instead of reducing work.
>
> ---
>
> **Internal DAG surface**
> - The set of dbt relations intended only for other models inside the project, not for direct analyst or BI consumption.
> - It matters here because intermediate models are explicitly described as internal to the graph and should not become accidental consumer contracts.
>
> > [!warning] Consumer creep changes design obligations
> >
> > The moment end users rely on an intermediate model directly, it starts inheriting mart-like expectations for stability, documentation, and support.

## Intermediate Model Core Principles

| Rule | Rationale |
|---|---|
| Prefix `int_<verb>_<entity>` | Communicates intent (what the model *does*) |
| Reference only `ref()` calls | Never reference `source()` directly |
| Materialise as views by default | Override to table or incremental only when performance demands it |
| One concept per model | Small, composable models are easier to test and refactor |
| No direct BI consumption | If an analyst asks for an intermediate model, consider promoting it to a mart |

---

## Intermediate Materialisation Strategy

Most intermediate models are views. The exceptions are:

| Case | Materialisation |
|---|---|
| Expensive window functions over millions of rows | `table` |
| Reused by 3+ downstream models | `table` |
| Single-use, very simple derivation | `ephemeral` |
| Large rolling calculations, daily incremental | `incremental` |

> [!tip] Persist reused window logic deliberately
>
> If an intermediate model contains heavy window functions and feeds several downstream marts, materializing it as a `table` is usually safer than stacking view-on-view execution. The extra storage cost is often lower than repeatedly paying the same compute and debugging the same long compiled SQL in multiple places.

---

## int_daily_returns

Calculates daily simple and log returns from adjusted close prices.

*This intermediate model derives reusable return measures from staged adjusted prices while preserving one row per security per trading date.*

```sql
-- models/intermediate/market_data/int_daily_returns.sql
{{ config(materialized='view') }}

with prices as (

    select
        security_id,
        price_date,
        adjusted_close_price
    from {{ ref('stg_market_data__daily_prices') }}
    where adjusted_close_price is not null
      and adjusted_close_price > 0

),

lagged as (

    select
        security_id,
        price_date,
        adjusted_close_price,
        lag(adjusted_close_price) over (
            partition by security_id
            order by price_date
        )                                             as prev_adjusted_close

    from prices

),

returns as (

    select
        security_id,
        price_date,
        adjusted_close_price,
        prev_adjusted_close,

        -- Simple return
        case
            when prev_adjusted_close is null or prev_adjusted_close = 0
            then null
            else (adjusted_close_price - prev_adjusted_close) / prev_adjusted_close
        end                                           as daily_simple_return,

        -- Log return (continuously compounded)
        case
            when prev_adjusted_close is null or prev_adjusted_close <= 0
            then null
            else ln(adjusted_close_price / prev_adjusted_close)
        end                                           as daily_log_return,

        -- Flag first observation per security (no prior price available)
        case
            when prev_adjusted_close is null then true
            else false
        end                                           as is_first_observation_flag

    from lagged

)

select * from returns
```

---

## int_momentum_scores

Calculates trailing 12-month momentum (with 1-month skip) and 3-month short-term momentum for each security.

*This model persists window-heavy momentum calculations because the same factors are likely to feed several downstream marts and portfolio screens.*

```sql
-- models/intermediate/market_data/int_momentum_scores.sql
{{ config(
    materialized = 'table',
    tags         = ['momentum', 'daily']
) }}

with returns as (

    select
        security_id,
        price_date,
        daily_simple_return
    from {{ ref('int_daily_returns') }}
    where is_first_observation_flag = false

),

--  Aggregate to monthly to match standard momentum lookback convention
monthly as (

    select
        security_id,
        {{ date_trunc('month', 'price_date') }}       as month_start,
        -- Compound daily returns into monthly return
        exp(sum(ln(1 + daily_simple_return))) - 1     as monthly_return

    from returns
    group by 1, 2

),

momentum as (

    select
        security_id,
        month_start,
        monthly_return,

        -- 12-1 momentum: product of months t-12 to t-2 (skip most recent month)
        exp(sum(ln(1 + monthly_return)) over (
            partition by security_id
            order by month_start
            rows between 12 preceding and 2 preceding
        )) - 1                                        as momentum_12_1,

        -- 3-month short-term momentum
        exp(sum(ln(1 + monthly_return)) over (
            partition by security_id
            order by month_start
            rows between 3 preceding and 1 preceding
        )) - 1                                        as momentum_3_1,

        -- Number of months available for the 12-1 window
        count(*) over (
            partition by security_id
            order by month_start
            rows between 12 preceding and 2 preceding
        )                                             as months_in_12_1_window

    from monthly

)

select
    security_id,
    month_start,
    momentum_12_1,
    momentum_3_1,
    months_in_12_1_window,
    -- Flag as valid only when we have a full 11-month window (t-12 through t-2)
    case when months_in_12_1_window = 11 then true else false end
        as is_momentum_valid_flag

from momentum
```

---

## int_value_signals

Computes fundamental value signals: price-to-book, earnings yield, dividend yield.

*This model joins staged prices to the most recent available fundamentals so downstream marts can reuse consistent value-factor inputs instead of reimplementing the same point-in-time logic.*

```sql
-- models/intermediate/market_data/int_value_signals.sql
{{ config(materialized='view') }}

with prices as (

    select
        security_id,
        price_date,
        close_price

    from {{ ref('stg_market_data__daily_prices') }}

),

fundamentals as (

    -- Assumes a staging model over a fundamentals source (abbreviated here)
    select
        security_id,
        report_date,
        book_value_per_share,
        earnings_per_share_ttm,
        dividends_per_share_ttm

    from {{ ref('stg_fundamentals__annual_reports') }}

),

-- Join most-recent fundamentals to each price date
joined as (

    select
        p.security_id,
        p.price_date,
        p.close_price,
        f.book_value_per_share,
        f.earnings_per_share_ttm,
        f.dividends_per_share_ttm

    from prices p
    left join fundamentals f
        on p.security_id = f.security_id
        -- Use most recent report available on or before the price date
        and f.report_date = (
            select max(report_date)
            from fundamentals f2
            where f2.security_id = p.security_id
              and f2.report_date  <= p.price_date
        )

),

signals as (

    select
        security_id,
        price_date,
        close_price,

        -- Book-to-price (value: higher = cheaper)
        case
            when close_price > 0 and book_value_per_share is not null
            then book_value_per_share / close_price
        end                                   as book_to_price,

        -- Earnings yield (E/P)
        case
            when close_price > 0 and earnings_per_share_ttm is not null
            then earnings_per_share_ttm / close_price
        end                                   as earnings_yield,

        -- Dividend yield
        case
            when close_price > 0 and dividends_per_share_ttm is not null
            then dividends_per_share_ttm / close_price
        end                                   as dividend_yield

    from joined

)

select * from signals
```

---

## int_esg_normalized

Normalises raw ESG scores to z-scores within each GICS sector on each score date. This enables cross-sector comparison.

*This intermediate table computes sector-relative ESG z-scores once so downstream models inherit a consistent normalization basis instead of repeating peer-group math.*

```sql
-- models/intermediate/esg/int_esg_normalized.sql
{{ config(
    materialized = 'table',
    tags         = ['esg']
) }}

with scores as (

    select
        security_id,
        score_date,
        esg_score,
        e_pillar_score,
        s_pillar_score,
        g_pillar_score,
        provider_code

    from {{ ref('stg_esg__scores') }}
    where is_restated_flag = false   -- use original scores; restated scores handled separately

),

sectors as (

    select
        security_id,
        gics_sector_code

    from {{ ref('dim_constituents') }}

),

enriched as (

    select
        s.*,
        sec.gics_sector_code

    from scores s
    left join sectors sec using (security_id)

),

-- Compute sector-relative z-scores
z_scored as (

    select
        security_id,
        score_date,
        provider_code,
        gics_sector_code,
        esg_score,
        e_pillar_score,
        s_pillar_score,
        g_pillar_score,

        -- ESG composite z-score within sector
        (esg_score - avg(esg_score) over (
            partition by score_date, gics_sector_code
        )) / nullif(stddev(esg_score) over (
            partition by score_date, gics_sector_code
        ), 0)                                         as esg_z_score,

        -- Environmental z-score
        (e_pillar_score - avg(e_pillar_score) over (
            partition by score_date, gics_sector_code
        )) / nullif(stddev(e_pillar_score) over (
            partition by score_date, gics_sector_code
        ), 0)                                         as e_pillar_z_score,

        -- Count peers in sector on this date (data quality indicator)
        count(*) over (
            partition by score_date, gics_sector_code
        )                                             as sector_peer_count

    from enriched

)

select * from z_scored
```

---

## int_corporate_action_adjustments

Builds a multiplicative adjustment factor for each security for each date, used to reconstruct historical adjusted prices.

*This model converts raw corporate actions into reusable price-adjustment factors that later marts and backfills can apply consistently.*

```sql
-- models/intermediate/market_data/int_corporate_action_adjustments.sql
{{ config(materialized='table') }}

with actions as (

    select
        security_id,
        effective_date,
        action_type,
        split_ratio,
        dividend_amount,
        dividend_currency

    from {{ ref('stg_market_data__corporate_actions') }}
    -- Only price-adjusting events
    where action_type in ('SPLIT', 'DIVIDEND')

),

-- Translate each action into a price adjustment multiplier
factors as (

    select
        security_id,
        effective_date,
        action_type,

        case
            when action_type = 'SPLIT'
            -- e.g. 2-for-1 split: pre-split prices multiplied by 0.5
            then 1.0 / nullif(split_ratio, 0)

            when action_type = 'DIVIDEND'
            -- Dividend adjustment: (P - D) / P on ex-date
            -- Requires price on ex-date; simplified factor shown here
            then null  -- resolved by joining to prices in a downstream model

            else 1.0
        end                               as price_adjustment_factor

    from actions

),

-- Cumulative product of all adjustments per security up to each date
cumulative as (

    select
        security_id,
        effective_date,
        price_adjustment_factor,

        -- Running product (use log/exp trick)
        exp(sum(ln(nullif(price_adjustment_factor, 0))) over (
            partition by security_id
            order by effective_date
            rows between unbounded preceding and current row
        ))                                as cumulative_adjustment_factor

    from factors
    where price_adjustment_factor is not null

)

select * from cumulative
```

---

## dbt Ephemeral Models for Intermediate Logic

Ephemeral models are inlined as CTEs and never materialised. Use them for simple intermediate steps that are only referenced by a single downstream model.

*This ephemeral helper flags row-level price anomalies without creating a standalone warehouse object because only one downstream model needs it.*

```sql
-- models/intermediate/market_data/int_price_validity_flags.sql
{{ config(materialized='ephemeral') }}

-- Flags prices that fail basic sanity checks.
-- Referenced only by int_daily_returns; no need to persist.
select
    security_id,
    price_date,
    close_price,
    high_price,
    low_price,

    case
        when close_price <= 0                then 'NEGATIVE_OR_ZERO_CLOSE'
        when high_price < low_price          then 'HIGH_BELOW_LOW'
        when close_price > high_price * 1.01 then 'CLOSE_ABOVE_HIGH'
        when close_price < low_price  * 0.99 then 'CLOSE_BELOW_LOW'
        else                                      'VALID'
    end                                      as price_validity_flag

from {{ ref('stg_market_data__daily_prices') }}
```

> [!warning] Ephemeral model limitations
>
> - Cannot be queried directly in the warehouse because no relation is created.
> - Compilation can produce very long SQL if one helper is referenced by many models because dbt inlines it repeatedly.
> - Not compatible with `--defer` because there is no persisted artifact for dbt to resolve against.

---

## Intermediate Model Anti-Patterns

> [!warning] Keep intermediate logic composable
>
> Intermediate models are where shared business logic becomes reusable. They lose that value when they reach back to raw sources, accumulate unrelated concepts in one file, or become quasi-public contracts that downstream tools query directly.

> [!success] Safe patterns
>
> - Reference staging models via `ref('stg_...')` exclusively in intermediate models; never call `source()` directly.
> - Keep each intermediate model focused on one concept and decompose wide logic into a chain of narrow, testable steps.
> - If a BI tool needs a result, promote the `int_` model to a mart with full YAML documentation rather than exposing intermediate models directly.

**Referencing sources directly**: Intermediate models should only call `ref()`, never `source()`. This preserves the staging layer as the single point of source contact.

*This contrast shows the boundary violation directly: the wrong pattern bypasses staging, while the correct pattern stays inside the modeled graph.*

```sql
-- WRONG
from {{ source('market_data', 'daily_prices') }}

-- CORRECT
from {{ ref('stg_market_data__daily_prices') }}
```

**Building too-wide models**: A single intermediate model with 40 columns and 5 joins is hard to test and debug. Decompose into focused models.

**Skipping the intermediate layer entirely**: Putting complex window functions directly in mart models makes marts impossible to reuse and hard to unit-test.

**Making intermediate models user-facing**: If a BI tool connects to an `int_` model, promote it to a mart with proper documentation and contracts.

---

## Related

- [dbt-staging-models](https://alp78.github.io/elysium/11-dbt/Modeling/dbt-staging-models)
- [dbt-mart-models](https://alp78.github.io/elysium/11-dbt/Modeling/dbt-mart-models)
- [dbt-materializations](https://alp78.github.io/elysium/11-dbt/Modeling/dbt-materializations)
