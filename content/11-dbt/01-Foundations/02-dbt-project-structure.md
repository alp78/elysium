---
title: "02 - dbt: Project Structure"
tags: [pipeline, dbt]
status: stable
updated: 2026-03-23
description: "Project layout, naming conventions, config inheritance, multi-adapter"
---

# dbt: Project Structure

> [!quote]+
>
> "There is no reason to tolerate an unstructured approach."
>
> Source: Ralph Kimball | *The Data Warehouse Toolkit* (2013)

> [!abstract]- Summary
>
> Explains how to structure a dbt project so model layout, naming, config inheritance, source declarations, adapter dispatch, and environment-specific connection settings stay predictable as the warehouse and team scale.
>
> **Project layout and resource boundaries**
> - Maps the full dbt repository tree across `models`, `seeds`, `snapshots`, `tests`, `macros`, `analyses`, and docs so each resource type has a clear home and operational purpose
> - Connects directory structure to warehouse layer boundaries, especially how staging, intermediate, and mart folders mirror auditability and consumption patterns in a medallion-style platform
>
> **Configuration and naming strategy**
> - Breaks down `dbt_project.yml`, naming conventions, `_sources.yml`, and config inheritance from project to folder to model so defaults stay intentional instead of implicit drift
> - Explains how prefixes, schemas, tags, tests, and metadata communicate grain, ownership, and execution policy before a single model is run
>
> **Adapter and environment patterns**
> - Covers multi-adapter dispatch, medallion mapping, and `profiles.yml` targets so one project can serve SQL Server, BigQuery, and other environments without hiding warehouse-specific behavior
> - Shows where environment-specific settings belong and where they must not be committed, especially around connection details and target switching
>
> **Operations and safety**
> - Warnings: unstructured folder growth, hidden config inheritance, inconsistent prefixes, adapter logic leaking into the wrong layer, and committing environment-specific secrets or local profile files into the repo
> - Recommendations: make layer boundaries explicit, keep naming conventions machine-readable, centralize safe defaults in `dbt_project.yml`, and isolate target-specific connection data outside version control

> [!info]- Glossary
>
> **dbt project**
> - The full repository structure and configuration that dbt reads when compiling and running models, tests, macros, seeds, and other resources.
> - It matters here because every naming, layout, and config decision in the note is about making that project operable as it grows.
>
> > [!info] Structure becomes operating model
> >
> > In dbt, directory layout is not just cosmetic. It shapes discovery, defaults, ownership, and how quickly a team can reason about what a model is allowed to do.
>
> ---
>
> **`models/`**
> - The primary directory containing SQL models and their adjacent YAML metadata files.
> - It matters here because the staging, intermediate, and mart folder strategy lives under `models/`, and most downstream conventions depend on that hierarchy.
>
> > [!warning] Folder placement implies intent
> >
> > Putting a model in the wrong layer makes its business role ambiguous even if the SQL is technically correct. Layout is a control against hidden logic creep.
>
> ---
>
> **Staging layer**
> - The first modeled layer above raw sources, usually focused on renaming, casting, and basic structural cleanup with minimal business logic.
> - It matters here because the project structure is designed to keep source-aligned cleanup separate from enrichment and consumption-ready modeling.
>
> > [!warning] Do not smuggle business rules in here
> >
> > Once staging starts accumulating joins and domain logic, downstream layers lose their meaning and source changes become harder to audit.
>
> ---
>
> **Intermediate layer**
> - The middle dbt layer that joins, enriches, and reshapes staging models into reusable business-logic building blocks.
> - It matters here because the directory tree and config defaults are meant to keep reusable transformation logic separate from final published marts.
>
> > [!info] Reuse lives here
> >
> > Intermediate models are where shared business transformations belong. Keeping them separate prevents marts from duplicating logic across multiple consumption surfaces.
>
> ---
>
> **Mart layer**
> - The consumption-ready layer of fact and dimension models intended for BI tools, APIs, or direct analytical use.
> - It matters here because naming, schemas, and materialization defaults in the project structure should make mart outputs obviously stable and consumer-facing.
>
> > [!warning] Published surface area
> >
> > Changes in mart structure have the highest downstream impact. Folder placement and naming conventions should make that blast radius obvious during review.
>
> ---
>
> **Seed**
> - A CSV file in `seeds/` that dbt loads into the warehouse as a reference table.
> - It matters here because seeds belong to the project structure and often carry schema, typing, and naming rules that should not be hidden inside model SQL.
>
> > [!info] Small static reference data only
> >
> > Seeds work well for compact, version-controlled reference data. They are a poor fit for large or frequently changing operational datasets.
>
> ---
>
> **Snapshot**
> - A dbt resource that captures slowly changing history for records over time, typically using timestamp or check-based change detection.
> - It matters here because snapshots have their own directory and schema strategy, separate from ordinary models and tests.
>
> > [!warning] Historical state is expensive to redesign
> >
> > Snapshot structure choices persist over time. Bad naming or schema placement becomes painful once history has accumulated and consumers rely on it.
>
> ---
>
> **Macro**
> - A reusable Jinja function defined in `macros/` that can generate SQL or encapsulate repeated logic.
> - It matters here because macros, especially dispatched ones, are part of the project layout strategy for adapter-aware reuse.
>
> > [!warning] Reuse can hide complexity
> >
> > Macros make projects cleaner when they remove duplication, but they also make behavior less obvious at a glance. Keep them discoverable and intentionally named.
>
> ---
>
> **`dbt_project.yml`**
> - The root project configuration file that defines paths, vars, default configs, and resource-level settings.
> - It matters here because config inheritance, naming defaults, schemas, tags, and materialization policies all start from this file.
>
> > [!warning] Small defaults propagate widely
> >
> > A single root-level config can change behavior across hundreds of models. Review defaults as architecture, not as local convenience settings.
>
> ---
>
> **Config inheritance**
> - The way dbt applies settings from project level to folder level to individual resources, with more specific scopes overriding broader ones.
> - It matters here because much of project structure discipline is really about making inherited behavior legible and safe.
>
> > [!warning] Implicit behavior is easy to miss
> >
> > When a model behaves differently because of inherited config rather than local code, reviewers often miss the real cause unless the directory strategy is clear.
>
> ---
>
> **`_sources.yml`**
> - A YAML file that declares external source tables, freshness rules, tests, and documentation metadata.
> - It matters here because sources are part of project structure, and they define the explicit handoff from raw ingestion into dbt modeling.
>
> > [!info] Raw boundary contract
> >
> > Source declarations are where freshness, raw table naming, and basic metadata should live. That keeps raw-system assumptions out of the model SQL itself.
>
> ---
>
> **Dispatch**
> - dbt's adapter-aware macro resolution mechanism that chooses the correct implementation for the active warehouse backend.
> - It matters here because multi-adapter layouts only stay maintainable when warehouse-specific differences are isolated through dispatch instead of scattered inline in model SQL.
>
> > [!warning] Portability needs a boundary
> >
> > Without dispatch, cross-database support turns into repeated `if target.type` branching and duplicated SQL patterns across the project.
>
> ---
>
> **Medallion architecture**
> - A layered data-architecture pattern that organizes transformations into raw, cleaned, and consumption-ready stages, often described as bronze, silver, and gold.
> - It matters here because the note maps dbt folder structure directly onto that architectural progression for readability and governance.
>
> > [!info] Useful mapping, not a magic rule
> >
> > The medallion model gives teams a shared language for layer boundaries, but the project still needs explicit conventions for naming, ownership, and publication level.
>
> ---
>
> **`profiles.yml`**
> - The local dbt connection file that defines profiles, outputs, credentials, and targets outside the repository.
> - It matters here because project structure is incomplete without understanding where environment-specific connection state belongs and why it is usually not committed.
>
> > [!danger] Keep connection state out of git
> >
> > `profiles.yml` often contains credential references and environment-specific endpoints. Treat it as local or managed runtime state, not as repository content.

## dbt Directory Tree

*This repository tree separates models, tests, macros, seeds, snapshots, and docs so ownership and config scope stay legible as the project grows.*

```text
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

## dbt_project.yml — Fully Annotated

*This annotated root config shows where dbt discovers resources, which defaults apply project-wide, and where layer-specific overrides should live.*

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

## dbt Naming Conventions

| Layer | Prefix | Pattern | Example |
|---|---|---|---|
| Staging | `stg_` | `stg_<source>__<entity>` | `stg_market_data__daily_prices` |
| Intermediate | `int_` | `int_<verb>_<entity>` | `int_daily_returns` |
| Fact | `fct_` | `fct_<entity>` | `fct_index_performance` |
| Dimension | `dim_` | `dim_<entity>` | `dim_constituents` |
| Snapshot | `snap_` | `snap_<entity>` | `snap_index_constituents` |
| Seed | `ref_` | `ref_<domain>_<entity>` | `ref_gics_sectors` |

> [!info] Double underscore in staging
>
> The double underscore (`__`) separates the source system from the entity. That keeps origin and business object readable at a glance and makes selectors such as `stg_market_data__*` useful during targeted runs.

---

## dbt _sources.yml Pattern

*This source declaration captures freshness rules, column tests, and raw-table metadata at the ingestion boundary instead of scattering those assumptions across model SQL.*

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

## dbt Config Inheritance: Project to Folder to Model

*This inheritance sketch shows the config scopes dbt evaluates before it materializes a model.*

```text
dbt_project.yml (project level)
  └── staging/ folder config (+materialized: view, +schema: silver)
        └── stg_market_data__daily_prices.sql
              └── {{ config(tags=["high_priority"]) }}  ← model-level addition
```

More specific scopes take precedence for clobbering configs such as `materialized` or `schema`, but dbt also has additive and merged configs such as `tags`, `meta`, and hooks. Review inheritance with the actual config type in mind so you do not accidentally drop shared metadata or assume a tag list was replaced when it was combined.

*This model-level `config()` block adds a local tag while inheriting the folder's materialization and schema defaults from `dbt_project.yml`.*

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

## Multi-Adapter Layout (SQL Server + BigQuery Dispatch)

dbt's dispatch system lets you write adapter-specific macro implementations without forking model SQL.

*This dispatch configuration tells dbt to resolve shared macros from the project first and then fall back to the upstream package implementation.*

```yaml
# dbt_project.yml — dispatch configuration
dispatch:
  - macro_namespace: dbt_utils
    search_order: ['financial_platform', 'dbt_utils']
```

*These macro variants show how one logical helper can compile to different SQL on BigQuery and SQL Server while the model API stays stable.*

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

*The model calls the abstract macro once and lets dispatch choose the warehouse-specific implementation at compile time.*

```sql
-- Works on both SQL Server and BigQuery
select
    {{ date_trunc('month', 'price_date') }} as month_start,
    sum(volume)                             as total_volume
from {{ ref('stg_market_data__daily_prices') }}
group by 1
```

---

## dbt Mapping to Medallion Architecture

The directory structure directly mirrors the [medallion-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/medallion-architecture) layers, making the staging/intermediate/marts hierarchy a concrete implementation of bronze/silver/gold:

*This mapping makes the warehouse-layer intent explicit by aligning dbt folders with raw, cleaned, and consumption-ready data zones.*

```text
Bronze (raw ingestion)
  └── raw_db.market_data_raw.*          ← Source tables (not owned by dbt)

Silver (cleaned, typed, integrated)
  ├── staging models  (stg_*)           ← 1:1 with source, rename/cast only
  └── intermediate models (int_*)       ← business logic, joins, enrichment

Gold (consumption-ready)
  └── mart models  (fct_*, dim_*)       ← aggregated facts, conformed dims
```

> [!tip] Schema mapping
>
> Use `+schema` in `dbt_project.yml` to route each layer to the correct database schema. dbt appends the `+schema` value to the `generate_schema_name` macro output, which keeps bronze, silver, and gold objects separated without hand-maintained DDL.

---

## profiles.yml Reference (not committed to repo)

> [!warning] Profile discovery order matters
>
> Current dbt docs recommend `~/.dbt/profiles.yml` as the default location, but dbt Core will also search `--profiles-dir`, the `DBT_PROFILES_DIR` environment variable, and the current working directory before it falls back there. In CI and containerized runs, be explicit about the profile directory so a stray local file does not silently change the active target.

*This local profile example keeps warehouse credentials and target-specific execution settings outside the repository while still letting the same project switch environments safely.*

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
