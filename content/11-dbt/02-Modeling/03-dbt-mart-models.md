---
title: "03 - dbt: Mart Models"
tags: [pipeline, dbt]
status: stable
updated: 2026-03-23
description: "Consumption-ready facts and dimensions, gold layer"
---

# dbt: Mart Models

> [!quote] Consumer-facing dimensional design
>
> "Dimensions provide the 'who, what, where, when, why, and how' context surrounding a business process event."
>
> Source: Ralph Kimball | *The Data Warehouse Toolkit* (2013)

> [!abstract]- Summary
>
> Explains how dbt mart models become the published gold layer by defining clear fact and dimension grains, stable consumer-facing contracts, and performance-oriented physical designs that BI tools and APIs can rely on directly.
>
> **Mart role and contract boundary**
> - Defines marts as consumption-ready facts and dimensions with explicit grain, strong documentation, and no direct raw-source access, positioned as the stable output surface of the dbt DAG
> - Connects mart design to downstream trust, where naming, grain statements, and documentation are part of the model contract rather than optional metadata
>
> **Fact and dimension implementation**
> - Covers fact and dimension naming, YAML grain declarations, incremental and table materializations, rolling metrics, and exposure registration so mart logic is both queryable and traceable to its consumers
> - Shows how marts aggregate or publish reusable intermediate logic instead of reintroducing raw-system assumptions or hidden transformations
>
> **Performance and publication behavior**
> - Explains why marts usually materialize as `table` or `incremental`, how incremental windows and schema changes are handled, and where consumer-facing performance needs override lighter internal modeling defaults
> - Reinforces the idea that marts are the layer where operational stability and downstream expectations matter most
>
> **Operations and safety**
> - Warnings: ambiguous grain, undocumented columns, direct `source()` use, view-based marts that collapse under BI load, and mart outputs that skip exposure or consumer traceability
> - Recommendations: declare grain explicitly, document every published column, materialize marts for query stability, and treat mart changes as contract changes with downstream blast radius

> [!info]- Glossary
>
> **Mart model**
> - A consumption-ready dbt model intended for direct use by BI tools, APIs, analysts, or other downstream consumers.
> - It matters here because the note is about what turns an internal dbt relation into a published and supportable warehouse surface.
>
> > [!warning] Published means supported
> >
> > Once a model is a mart, changes to structure, grain, or semantics can break downstream consumers immediately. Mart design is contract design.
>
> ---
>
> **Gold layer**
> - The final modeled layer in a medallion-style warehouse, where curated outputs are optimized for direct analytical consumption.
> - It matters here because mart models are positioned as the gold layer in the chapter's dbt architecture.
>
> > [!info] Final publication layer
> >
> > The gold label matters because it signals that the relation is no longer just an internal transform. It is intended to be read and trusted by consumers outside the modeling team.
>
> ---
>
> **Fact model**
> - A mart table centered on measurable events or observations, usually at a clearly defined transactional or periodic grain.
> - It matters here because fact marts such as performance tables are the main way business metrics become queryable and aggregatable downstream.
>
> > [!warning] Grain drives every metric
> >
> > If the fact grain is ambiguous, every rollup and join built on top of it becomes questionable, even when the SQL itself is technically valid.
>
> ---
>
> **Dimension model**
> - A mart table that provides descriptive context about business entities such as instruments, indices, or other reference domains.
> - It matters here because marts are not only about metrics; they also publish stable descriptive entities that facts and consumers depend on.
>
> > [!info] Context around events
> >
> > Dimensions are what make fact rows interpretable. Keeping them well-documented and stable is part of making marts usable beyond the modeling team.
>
> ---
>
> **Grain**
> - The exact level of uniqueness for one row in a model, usually expressed as a combination of business keys and time.
> - It matters here because mart trust starts with explicit grain statements in YAML and documentation.
>
> > [!warning] Ambiguous grain creates silent misuse
> >
> > Consumers often aggregate first and ask questions later. If grain is not declared explicitly, dashboards and joins will eventually produce plausible but wrong answers.
>
> ---
>
> **Exposure**
> - A dbt metadata object that declares a downstream dependency such as a dashboard, notebook, or application consuming a model.
> - It matters here because exposures make marts traceable to the systems and people that rely on them.
>
> > [!info] Consumer lineage layer
> >
> > Exposures extend lineage beyond dbt models. They show who gets hurt when a mart changes, which is why they belong on published outputs.
>
> ---
>
> **Consumer contract**
> - The documented promise about a mart's structure, semantics, grain, and stability that downstream systems rely on.
> - It matters here because marts are the layer where metadata quality stops being optional and becomes part of operational reliability.
>
> > [!warning] Contract changes need change management
> >
> > Renaming a column or changing a mart's grain is not a local refactor. It is a downstream-breaking event unless consumers have been prepared for it.
>
> ---
>
> **Incremental mart**
> - A mart that appends or merges only recent changes instead of rebuilding all history on every run.
> - It matters here because large fact marts often need incremental execution for cost and runtime reasons.
>
> > [!warning] Performance optimization with state risk
> >
> > Incremental marts need careful lookback logic, unique keys, and schema-change handling. Fast publication is only useful if historical correctness remains intact.
>
> ---
>
> **Table materialization**
> - A materialization that stores the full mart result physically and rebuilds it on each run.
> - It matters here because many published dimensions and smaller marts favor predictable physical tables over repeatedly executed views.
>
> > [!info] Predictable consumer surface
> >
> > Tables often make marts easier to query and reason about because consumers are not paying the full transformation cost at read time.
>
> ---
>
> **`on_schema_change`**
> - A dbt incremental config that controls how schema drift is handled when upstream columns are added or changed.
> - It matters here because published marts often evolve under active consumer usage, and schema change behavior affects both stability and rollout risk.
>
> > [!warning] Drift reaches consumers fast
> >
> > Schema handling decisions in marts are visible to dashboards and applications quickly. Choose them with consumer compatibility in mind, not just developer convenience.
>
> ---
>
> **Rolling metric**
> - A measure calculated across a moving historical window, such as trailing returns or volatility.
> - It matters here because many mart facts publish consumer-ready rolling analytics built from intermediate calculations.
>
> > [!info] Final metric publication point
> >
> > Rolling logic is often prepared upstream, but marts are where it becomes part of the stable analytical surface consumers actually query.
>
> ---
>
> **Direct consumption**
> - The use of a model by downstream tools or users without another dbt layer sitting in between.
> - It matters here because direct consumption is what separates marts from internal-only models operationally.
>
> > [!warning] Query behavior becomes user experience
> >
> > Once a model is directly consumed, latency, documentation, naming, and stability all become external-facing concerns, not just internal engineering preferences.

## Mart Model Core Principles

| Rule | Rationale |
|---|---|
| Prefix `fct_` for facts, `dim_` for dimensions | Follows [dimensional-modeling](https://alp78.github.io/elysium/14-Data-Architecture/Data-Modeling/dimensional-modeling) conventions and communicates model type to consumers |
| Declare grain explicitly in YAML description | Prevents ambiguous aggregation by consumers |
| Materialise as `table` or `incremental` | Views are too slow for direct BI consumption at scale |
| Full column documentation | Marts are the consumer contract |
| Register exposures | Creates lineage from model to consuming system |
| Never reference `source()` | Always reference `ref()` |

---

## Mart Grain Definition

Every mart model must have a clearly stated grain — the combination of columns that uniquely identifies one row.

*This YAML description makes grain part of the mart contract so downstream consumers do not have to infer row uniqueness from SQL alone.*

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

*This mart model publishes index-level daily and rolling performance by combining point-in-time constituent weights with reusable return calculations from the intermediate layer.*

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
        weight,
        lead(effective_date) over (
            partition by index_id, security_id
            order by effective_date
        )                                           as next_effective_date

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
                c.next_effective_date,
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

*This mart aligns several reusable factor signals into one published score surface that external portfolio tools can query without reconstructing intermediate joins.*

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

*This dimension publishes stable security attributes so fact models and downstream consumers can join descriptive context without revisiting raw master data tables.*

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

*This dimension provides the descriptive metadata that makes index-level fact rows interpretable in BI tools, APIs, and exports.*

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

*This mart YAML turns grain, test thresholds, and consumer-facing column descriptions into an explicit contract instead of leaving them implicit in SQL.*

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

*This exposure metadata extends lineage past dbt models so reviewers can see which dashboards, APIs, or reporting jobs will feel a mart change immediately.*

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

> [!tip] Using exposures in selection
>
> Run only models needed for a specific exposure:
> ```bash
> dbt run --select +exposure:portfolio_construction_api
> ```

---

## Related

- [dbt-intermediate-models](https://alp78.github.io/elysium/11-dbt/Modeling/dbt-intermediate-models)
- [dbt-materializations](https://alp78.github.io/elysium/11-dbt/Modeling/dbt-materializations)
- [dbt-testing-framework](https://alp78.github.io/elysium/11-dbt/Quality/dbt-testing-framework)
- [rest-api-design-and-consumption](https://alp78.github.io/elysium/14-Data-Architecture/APIs-and-Protocols/rest-api-design-and-consumption)
