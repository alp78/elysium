---
tags: [reference, dbt]
type: reference
technology: [dbt]
status: stable
updated: 2026-03-23
description: "Consumption-ready facts and dimensions, gold layer"
related:
  - "[[dbt-intermediate-models]]"
  - "[[dbt-materializations]]"
  - "[[dbt-testing-framework]]"
  - "[[rest-api-design-and-consumption]]"
---

# dbt: Mart Models

Mart models are the gold layer — consumption-ready tables and views that BI tools, APIs, and data scientists query directly. They enforce a clear grain, carry comprehensive documentation, and are defined in data contracts via `_exposures.yml`.

---

## Core Principles

| Rule | Rationale |
|---|---|
| Prefix `fct_` for facts, `dim_` for dimensions | Communicates model type to consumers |
| Declare grain explicitly in YAML description | Prevents ambiguous aggregation by consumers |
| Materialise as `table` or `incremental` | Views are too slow for direct BI consumption at scale |
| Full column documentation | Marts are the consumer contract |
| Register exposures | Creates lineage from model to consuming system |
| Never reference `source()` | Always reference `ref()` |

---

## Grain Definition

Every mart model must have a clearly stated grain — the combination of columns that uniquely identifies one row.

```yaml
# In _performance.yml
- name: fct_index_performance
  description: >
    **Grain: one row per index per trading date.**
    Contains daily performance metrics, rolling return windows,
    and constituent-weighted factor exposures for each index.
```

---

## fct_index_performance

```sql
-- models/marts/performance/fct_index_performance.sql
-- Grain: one row per index_id per price_date
{{ config(
    materialized  = 'incremental',
    unique_key    = ['index_id', 'price_date'],
    on_schema_change = 'append_new_columns',
    tags          = ['daily', 'performance', 'incremental']
) }}

with constituents as (

    select
        index_id,
        security_id,
        effective_date,
        weight

    from {{ ref('stg_market_data__index_constituents') }}

),

returns as (

    select
        security_id,
        price_date,
        daily_simple_return

    from {{ ref('int_daily_returns') }}

    {% if is_incremental() %}
    -- For incremental runs, only process recent dates.
    -- Include a lookback window to handle late-arriving constituent data.
    where price_date >= (
        select dateadd(day, -{{ var('lookback_days', 3) }}, max(price_date))
        from {{ this }}
    )
    {% endif %}

),

-- Match each return observation to the constituent weight active on that date
constituent_returns as (

    select
        c.index_id,
        r.price_date,
        c.security_id,
        c.weight,
        r.daily_simple_return,
        c.weight * r.daily_simple_return   as weighted_return

    from returns r
    inner join constituents c
        on  r.security_id   = c.security_id
        and r.price_date   >= c.effective_date
        -- Weight is valid until the next effective_date for this security in this index
        and r.price_date   <  coalesce(
                lead(c.effective_date) over (
                    partition by c.index_id, c.security_id
                    order by c.effective_date
                ),
                '9999-12-31'
            )

),

-- Aggregate to index level
index_daily as (

    select
        index_id,
        price_date,
        sum(weighted_return)                                 as index_daily_return,
        count(distinct security_id)                         as constituent_count,
        sum(weight)                                         as total_weight_coverage

    from constituent_returns
    group by index_id, price_date

),

-- Rolling return windows using cumulative log return trick
rolling as (

    select
        index_id,
        price_date,
        index_daily_return,
        constituent_count,
        total_weight_coverage,

        -- 1-month trailing return (~21 trading days)
        exp(sum(ln(1 + index_daily_return)) over (
            partition by index_id
            order by price_date
            rows between 20 preceding and current row
        )) - 1                                              as return_1m,

        -- 3-month trailing return (~63 trading days)
        exp(sum(ln(1 + index_daily_return)) over (
            partition by index_id
            order by price_date
            rows between 62 preceding and current row
        )) - 1                                              as return_3m,

        -- 12-month trailing return (~252 trading days)
        exp(sum(ln(1 + index_daily_return)) over (
            partition by index_id
            order by price_date
            rows between 251 preceding and current row
        )) - 1                                              as return_12m,

        -- Annualised volatility (21-day)
        stddev(index_daily_return) over (
            partition by index_id
            order by price_date
            rows between 20 preceding and current row
        ) * sqrt(252)                                       as volatility_21d_annualised

    from index_daily

)

select * from rolling
```

---

## fct_composite_scores

Combines ESG, momentum, and value signals into a single composite factor score per security per date. Consumed by portfolio construction tooling.

```sql
-- models/marts/performance/fct_composite_scores.sql
-- Grain: one row per security_id per score_date
{{ config(
    materialized  = 'incremental',
    unique_key    = ['security_id', 'score_date'],
    on_schema_change = 'append_new_columns',
    tags          = ['esg', 'factor', 'daily']
) }}

with esg as (

    select
        security_id,
        score_date,
        esg_z_score,
        e_pillar_z_score,
        gics_sector_code,
        sector_peer_count

    from {{ ref('int_esg_normalized') }}

),

momentum as (

    select
        security_id,
        month_start             as score_date,
        momentum_12_1,
        momentum_3_1,
        is_momentum_valid_flag

    from {{ ref('int_momentum_scores') }}

),

value as (

    select
        security_id,
        price_date              as score_date,
        book_to_price,
        earnings_yield,
        dividend_yield

    from {{ ref('int_value_signals') }}

),

combined as (

    select
        e.security_id,
        e.score_date,
        e.gics_sector_code,
        e.esg_z_score,
        e.e_pillar_z_score,
        m.momentum_12_1,
        m.momentum_3_1,
        m.is_momentum_valid_flag,
        v.book_to_price,
        v.earnings_yield,
        v.dividend_yield,

        -- Composite score: equal-weight across three signal pillars (0-to-1 normalised)
        -- z-scores are already comparable; apply simple average
        (
            coalesce(e.esg_z_score,  0) * 0.33
          + coalesce(m.momentum_12_1, 0) * 0.33
          + coalesce(v.book_to_price, 0) * 0.34
        )                                                   as composite_score_raw

    from esg e
    left join momentum m
        on  e.security_id = m.security_id
        and e.score_date  = m.score_date
    left join value v
        on  e.security_id = v.security_id
        and e.score_date  = v.score_date

)

{% if is_incremental() %}
, last_run as (
    select max(score_date) as max_date from {{ this }}
)
select c.*
from combined c, last_run lr
where c.score_date > dateadd(day, -{{ var('lookback_days', 3) }}, lr.max_date)
{% else %}
select * from combined
{% endif %}
```

---

## dim_constituents

Slowly-changing reference dimension for securities that have ever been index constituents.

```sql
-- models/marts/reference/dim_constituents.sql
-- Grain: one row per security_id (current attributes; point-in-time via snap_index_constituents)
{{ config(
    materialized = 'table',
    tags         = ['reference', 'dimension']
) }}

with base as (

    select distinct
        security_id

    from {{ ref('stg_market_data__index_constituents') }}

),

attributes as (

    -- Assumes a staged securities master table
    select
        security_id,
        isin,
        sedol,
        cusip,
        ticker_symbol,
        security_name,
        country_of_risk,
        currency_code,
        gics_sector_code,
        gics_industry_code,
        security_type,           -- EQUITY, ETF, REIT, etc.
        listing_exchange_code,
        ipo_date,
        is_active_flag

    from {{ ref('stg_securities__master') }}

),

sectors as (

    select
        sector_code,
        sector_name,
        industry_code,
        industry_name

    from {{ ref('ref_gics_sectors') }}

)

select
    b.security_id,
    a.isin,
    a.sedol,
    a.cusip,
    a.ticker_symbol,
    a.security_name,
    a.country_of_risk,
    a.currency_code,
    a.gics_sector_code,
    s.sector_name                 as gics_sector_name,
    a.gics_industry_code,
    s.industry_name               as gics_industry_name,
    a.security_type,
    a.listing_exchange_code,
    a.ipo_date,
    a.is_active_flag

from base b
left join attributes a using (security_id)
left join sectors s
    on  a.gics_sector_code   = s.sector_code
    and a.gics_industry_code = s.industry_code
```

---

## dim_indices

Reference dimension for all indices tracked by the platform.

```sql
-- models/marts/reference/dim_indices.sql
-- Grain: one row per index_id
{{ config(
    materialized = 'table',
    tags         = ['reference', 'dimension']
) }}

select
    i.index_id,
    i.index_name,
    i.index_family,              -- e.g. MSCI, FTSE, S&P
    i.index_type,                -- MARKET_CAP, EQUAL_WEIGHT, FACTOR, ESG
    i.currency_code,
    i.base_date,
    i.base_value,
    i.rebalance_frequency,       -- DAILY, MONTHLY, QUARTERLY
    i.geographic_scope,          -- GLOBAL, REGIONAL, COUNTRY
    i.asset_class,               -- EQUITY, FIXED_INCOME, MULTI_ASSET
    i.is_esg_screened_flag,
    i.is_active_flag,
    m.index_description,
    m.methodology_url

from {{ ref('stg_indices__master') }} i
left join {{ ref('stg_indices__methodology') }} m using (index_id)
```

---

## _performance.yml — Mart Documentation and Tests

```yaml
# models/marts/performance/_performance.yml
version: 2

models:
  - name: fct_index_performance
    description: >
      **Grain: one row per index_id per price_date.**
      Daily performance metrics for each tracked index including daily return,
      rolling 1m/3m/12m returns, and annualised volatility.
      Incremental model; rebuilt from {{ var('history_start_date') }}.
    columns:
      - name: index_id
        description: "Index identifier. FK to dim_indices."
        tests: [not_null]
      - name: price_date
        description: "Trading date of the observation."
        tests: [not_null]
      - name: index_daily_return
        description: "Constituent-weighted daily simple return."
        tests:
          - dbt_utils.accepted_range:
              min_value: -0.5
              max_value:  0.5
              config:
                severity: warn
      - name: total_weight_coverage
        description: "Sum of constituent weights on this date. Should be near 1.0."
        tests:
          - dbt_utils.accepted_range:
              min_value: 0.95
              max_value: 1.05
              config:
                severity: warn
    tests:
      - dbt_utils.unique_combination_of_columns:
          combination_of_columns: [index_id, price_date]

  - name: fct_composite_scores
    description: >
      **Grain: one row per security_id per score_date.**
      Combined ESG, momentum, and value factor scores.
    tests:
      - dbt_utils.unique_combination_of_columns:
          combination_of_columns: [security_id, score_date]

  - name: dim_constituents
    description: >
      **Grain: one row per security_id.**
      Current security attributes for all securities that have ever been
      an index constituent. Point-in-time history in snap_index_constituents.
    columns:
      - name: security_id
        tests: [not_null, unique]
      - name: isin
        tests:
          - dbt_expectations.expect_column_value_lengths_to_equal:
              value: 12
              config:
                severity: warn
```

---

## _exposures.yml

Exposures declare which external systems consume mart models, enabling impact analysis.

```yaml
# models/marts/_exposures.yml
version: 2

exposures:

  - name: index_performance_dashboard
    type: dashboard
    maturity: high
    url: "https://bi.internal/dashboards/index-performance"
    description: >
      Executive dashboard showing index-level daily and rolling performance.
      Refreshed nightly after the dbt production run completes.
    depends_on:
      - ref('fct_index_performance')
      - ref('dim_indices')
    owner:
      name: "Performance Analytics Team"
      email: "perf-analytics@example.com"

  - name: portfolio_construction_api
    type: application
    maturity: high
    description: >
      REST API consumed by the portfolio construction system to retrieve
      composite factor scores for optimisation inputs.
    depends_on:
      - ref('fct_composite_scores')
      - ref('dim_constituents')
    owner:
      name: "Quant Engineering"
      email: "quant-eng@example.com"

  - name: esg_reporting_export
    type: ml
    maturity: medium
    description: >
      Monthly ESG reporting pipeline that exports composite scores to the
      regulatory reporting system.
    depends_on:
      - ref('fct_composite_scores')
      - ref('dim_constituents')
      - ref('dim_indices')
    owner:
      name: "ESG Reporting Team"
      email: "esg@example.com"
```

> [!TIP] Using exposures in selection
> Run only models needed for a specific exposure:
> ```bash
> dbt run --select +exposure:portfolio_construction_api
> ```

---

## Related
- [[dbt-intermediate-models]]
- [[dbt-materializations]]
- [[dbt-testing-framework]]
- [[rest-api-design-and-consumption]]
