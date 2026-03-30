---
tags: [pipeline, dbt]
type: reference
technology: [dbt]
status: stable
updated: 2026-03-23
description: "Project layout, naming conventions, config inheritance, multi-adapter"
---

# dbt: Project Structure

> [!quote]
> "There is no reason to tolerate an unstructured approach."
> — **Ralph Kimball**

A well-organised dbt project is the foundation for maintainability at scale. This note covers the full directory layout, naming conventions, config inheritance, source declarations, and multi-adapter dispatch patterns for a financial data platform handling index constituents, OHLCV prices, ESG scores, and corporate actions.

---

### dbt Directory Tree

```
financial_platform/
├── dbt_project.yml           # root config
├── profiles.yml              # connection targets (not in repo)
├── packages.yml              # dbt-utils, dbt-expectations, etc.
├── .dbtignore
│
├── models/
│   ├── staging/              # bronze → silver: 1:1 with sources
│   │   ├── market_data/
│   │   │   ├── _sources.yml
│   │   │   ├── _staging_market_data.yml
│   │   │   ├── stg_market_data__daily_prices.sql
│   │   │   ├── stg_market_data__corporate_actions.sql
│   │   │   └── stg_market_data__index_constituents.sql
│   │   └── esg/
│   │       ├── _sources.yml
│   │       ├── _staging_esg.yml
│   │       ├── stg_esg__scores.sql
│   │       └── stg_esg__controversies.sql
│   │
│   ├── intermediate/         # silver: business logic, no direct consumption
│   │   ├── market_data/
│   │   │   ├── int_daily_returns.sql
│   │   │   ├── int_momentum_scores.sql
│   │   │   └── int_corporate_action_adjustments.sql
│   │   └── esg/
│   │       ├── int_esg_normalized.sql
│   │       └── int_value_signals.sql
│   │
│   └── marts/                # gold: consumption-ready
│       ├── performance/
│       │   ├── _performance.yml
│       │   ├── fct_index_performance.sql
│       │   └── fct_composite_scores.sql
│       └── reference/
│           ├── _reference.yml
│           ├── dim_constituents.sql
│           └── dim_indices.sql
│
├── seeds/
│   ├── ref_gics_sectors.csv
│   ├── ref_currency_codes.csv
│   └── ref_index_metadata.csv
│
├── snapshots/
│   ├── snap_index_constituents.sql   # SCD Type 2 constituent membership
│   └── snap_esg_scores.sql           # track score changes over time
│
├── tests/
│   ├── assert_weights_sum_to_100.sql
│   ├── assert_no_negative_prices.sql
│   └── assert_no_future_dated_prices.sql
│
├── macros/
│   ├── cross_db/
│   │   ├── date_trunc.sql            # dispatched macro
│   │   └── safe_divide.sql
│   ├── generate_schema_name.sql
│   └── get_fiscal_quarter.sql
│
├── analyses/
│   └── index_rebalance_impact.sql
│
└── docs/
    └── overview.md
```

---

### dbt_project.yml — Fully Annotated

```yaml
# dbt_project.yml
name: financial_platform
version: '1.0.0'
config-version: 2

# The profile to use (matches a key in profiles.yml)
profile: financial_platform

# Where dbt looks for models, tests, macros, etc.
model-paths: ["models"]
analysis-paths: ["analyses"]
test-paths: ["tests"]
seed-paths: ["seeds"]
snapshot-paths: ["snapshots"]
macro-paths: ["macros"]
docs-paths: ["docs"]

# Compiled SQL output directory (gitignored)
target-path: "target"
clean-targets: ["target", "dbt_packages"]

# ── Global variable defaults ───────────────────────────────────────────────
vars:
  # Used in incremental lookback logic
  lookback_days: 3
  # Minimum ESG score threshold for filtering in some marts
  esg_score_floor: 0
  # Calendar start for full-history runs
  history_start_date: '2010-01-01'

# ── Model configuration (config inheritance: project → folder → model) ─────
models:
  financial_platform:
    # Project-level defaults applied to every model unless overridden
    +meta:
      owner: "data-engineering"
    +persist_docs:
      relation: true
      columns: true

    staging:
      # All staging models are views; they sit in the 'silver' dataset
      +materialized: view
      +schema: silver
      +tags: ["staging", "pii_low"]
      market_data:
        +tags: ["market_data"]
      esg:
        +tags: ["esg"]

    intermediate:
      # Intermediate models default to views; expensive ones override to table
      +materialized: view
      +schema: silver
      +tags: ["intermediate"]

    marts:
      # Marts are tables or incremental; they live in the 'gold' dataset
      +materialized: table
      +schema: gold
      +tags: ["mart"]
      performance:
        +tags: ["performance"]
        # Override: performance facts are incremental
        +materialized: incremental
      reference:
        +tags: ["reference"]
        +materialized: table

# ── Seed configuration ─────────────────────────────────────────────────────
seeds:
  financial_platform:
    +schema: reference
    +quote_columns: false
    ref_gics_sectors:
      +column_types:
        sector_code: varchar(10)
        sector_name: varchar(100)

# ── Snapshot configuration ─────────────────────────────────────────────────
snapshots:
  financial_platform:
    +schema: snapshots
    +strategy: timestamp
    +updated_at: updated_at

# ── Test configuration ─────────────────────────────────────────────────────
tests:
  financial_platform:
    +store_failures: true
    +schema: test_failures
    +severity: error
```

---

### dbt Naming Conventions

| Layer | Prefix | Pattern | Example |
|---|---|---|---|
| Staging | `stg_` | `stg_<source>__<entity>` | `stg_market_data__daily_prices` |
| Intermediate | `int_` | `int_<verb>_<entity>` | `int_daily_returns` |
| Fact | `fct_` | `fct_<entity>` | `fct_index_performance` |
| Dimension | `dim_` | `dim_<entity>` | `dim_constituents` |
| Snapshot | `snap_` | `snap_<entity>` | `snap_index_constituents` |
| Seed | `ref_` | `ref_<domain>_<entity>` | `ref_gics_sectors` |

> [!NOTE] Double underscore in staging
> The double underscore (`__`) separates the *source system* from the *entity*. This makes it immediately clear where the data originates and allows globbing with `stg_market_data__*` selectors.

---

### dbt _sources.yml Pattern

```yaml
# models/staging/market_data/_sources.yml
version: 2

sources:
  - name: market_data
    description: "Raw market data ingested from the exchange data vendor."
    database: raw_db
    schema: market_data_raw

    # Freshness checks run via: dbt source freshness
    freshness:
      warn_after: {count: 1, period: day}
      error_after: {count: 2, period: day}
    loaded_at_field: _ingested_at   # column present in all raw tables

    tables:
      - name: daily_prices
        description: "End-of-day OHLCV data per security per trading day."
        freshness:
          warn_after: {count: 6, period: hour}   # table-level override
          error_after: {count: 24, period: hour}
        columns:
          - name: security_id
            description: "Vendor security identifier."
            tests:
              - not_null
          - name: price_date
            tests:
              - not_null
          - name: close_price
            tests:
              - not_null
              - dbt_utils.accepted_range:
                  min_value: 0
                  inclusive: false

      - name: corporate_actions
        description: "Dividends, splits, spin-offs for each security."
        columns:
          - name: action_id
            tests: [not_null, unique]
          - name: action_type
            tests:
              - accepted_values:
                  values: ['DIVIDEND', 'SPLIT', 'SPINOFF', 'MERGER', 'RIGHTS']

      - name: index_constituents
        description: "Point-in-time constituent membership per index."
        columns:
          - name: index_id
            tests: [not_null]
          - name: security_id
            tests: [not_null]
          - name: effective_date
            tests: [not_null]
```

---

### dbt Config Inheritance: Project to Folder to Model

```
dbt_project.yml (project level)
  └── staging/ folder config (+materialized: view, +schema: silver)
        └── stg_market_data__daily_prices.sql
              └── {{ config(tags=["high_priority"]) }}  ← model-level addition
```

Lower levels always win. A model-level `config()` block overrides folder-level, which overrides project-level.

```sql
-- stg_market_data__daily_prices.sql
-- This model inherits: materialized=view, schema=silver from project config.
-- We only add a tag here; no need to repeat materialization.
{{ config(
    tags = ["daily", "high_priority"]
) }}

select ...
```

---

### Multi-Adapter Layout (SQL Server + BigQuery Dispatch)

dbt's dispatch system lets you write adapter-specific macro implementations without forking model SQL.

```yaml
# dbt_project.yml — dispatch configuration
dispatch:
  - macro_namespace: dbt_utils
    search_order: ['financial_platform', 'dbt_utils']
```

```sql
-- macros/cross_db/date_trunc.sql
-- Default (BigQuery) implementation
{% macro date_trunc(datepart, date) %}
    date_trunc({{ date }}, {{ datepart }})
{% endmacro %}

-- SQL Server override: macros/cross_db/sqlserver__date_trunc.sql
{% macro sqlserver__date_trunc(datepart, date) %}
    dateadd({{ datepart }}, datediff({{ datepart }}, 0, {{ date }}), 0)
{% endmacro %}
```

Model SQL calls the abstract macro:

```sql
-- Works on both SQL Server and BigQuery
select
    {{ date_trunc('month', 'price_date') }} as month_start,
    sum(volume)                             as total_volume
from {{ ref('stg_market_data__daily_prices') }}
group by 1
```

---

### dbt Mapping to Medallion Architecture

The directory structure directly mirrors the [medallion-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/medallion-architecture) layers, making the staging/intermediate/marts hierarchy a concrete implementation of bronze/silver/gold:

```
Bronze (raw ingestion)
  └── raw_db.market_data_raw.*          ← Source tables (not owned by dbt)

Silver (cleaned, typed, integrated)
  ├── staging models  (stg_*)           ← 1:1 with source, rename/cast only
  └── intermediate models (int_*)       ← business logic, joins, enrichment

Gold (consumption-ready)
  └── mart models  (fct_*, dim_*)       ← aggregated facts, conformed dims
```

> [!TIP] Schema mapping
> Use `+schema` in `dbt_project.yml` to route each layer to the correct database schema. dbt appends the `+schema` value to the `generate_schema_name` macro output, keeping bronze/silver/gold physically separated without any manual DDL.

---

### profiles.yml Reference (not committed to repo)

```yaml
# ~/.dbt/profiles.yml
financial_platform:
  target: dev
  outputs:
    dev:
      type: bigquery
      method: oauth
      project: fin-platform-dev
      dataset: dbt_dev_{{ env_var('DBT_USER', 'default') }}
      threads: 4
      timeout_seconds: 300

    prod:
      type: bigquery
      method: service-account
      project: fin-platform-prod
      dataset: dbt_prod
      keyfile: "{{ env_var('GOOGLE_APPLICATION_CREDENTIALS') }}"
      threads: 16
      timeout_seconds: 600

    sqlserver_dev:
      type: sqlserver
      server: sql-dev.internal
      port: 1433
      database: FinPlatformDev
      schema: dbt_dev
      authentication: ActiveDirectoryIntegrated
      threads: 8
```

---

## Related
- [dbt-core-concepts](https://alp78.github.io/elysium/11-dbt/Foundations/dbt-core-concepts)
- [dbt-cli-reference](https://alp78.github.io/elysium/11-dbt/Foundations/dbt-cli-reference)
- [medallion-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/medallion-architecture)
- [dbt-transformation-layer](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/dbt-transformation-layer)
