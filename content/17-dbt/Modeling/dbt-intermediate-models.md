---
tags: [reference, dbt]
type: reference
technology: [dbt]
status: stable
updated: 2026-03-23
description: "Business logic transforms, silver layer"
related:
  - "[[dbt-staging-models]]"
  - "[[dbt-mart-models]]"
  - "[[dbt-materializations]]"
  - "[[esg-data-ingestion-framework]]"
---

# dbt: Intermediate Models

Intermediate models are the business logic layer. They join, enrich, and transform staging data into analysis-ready building blocks that feed the mart layer. They are not intended for direct consumption by end users or BI tools — they are internal to the dbt DAG.

---

## Core Principles

| Rule | Rationale |
|---|---|
| Prefix `int_<verb>_<entity>` | Communicates intent (what the model *does*) |
| Reference only `ref()` calls | Never reference `source()` directly |
| Materialise as views by default | Override to table or incremental only when performance demands it |
| One concept per model | Small, composable models are easier to test and refactor |
| No direct BI consumption | If an analyst asks for an intermediate model, consider promoting it to a mart |

---

## Materialisation Strategy

Most intermediate models are views. The exceptions are:

| Case | Materialisation |
|---|---|
| Expensive window functions over millions of rows | `table` |
| Reused by 3+ downstream models | `table` |
| Single-use, very simple derivation | `ephemeral` |
| Large rolling calculations, daily incremental | `incremental` |

---

## int_daily_returns

Calculates daily simple and log returns from adjusted close prices.

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

## Ephemeral Models

Ephemeral models are inlined as CTEs and never materialised. Use them for simple intermediate steps that are only referenced by a single downstream model.

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

> [!NOTE] Ephemeral model limitations
> - Cannot be queried directly in the warehouse (they don't exist as objects).
> - Compilation can produce very long SQL if a single CTE is referenced by many models — dbt inlines the CTE repeatedly.
> - Not compatible with `--defer` (no artifact to defer to).

---

## Anti-Patterns

> [!WARNING] Common intermediate model mistakes

**Referencing sources directly**: Intermediate models should only call `ref()`, never `source()`. This preserves the staging layer as the single point of source contact.

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
- [[dbt-staging-models]]
- [[dbt-mart-models]]
- [[dbt-materializations]]
- [[esg-data-ingestion-framework]]
