---
title: "dbt Core Concepts"
tags: [pipeline, sql, dbt, bigquery]
status: stable
updated: 2026-03-23
description: "What dbt is, how it compiles, the DAG, materializations, profiles, adapters, and packages."
parent: "[[domain-foundations]]"
links:
  - "[[dbt-project-structure]]"
  - "[[dbt-cli-reference]]"
---

# dbt Core Concepts

> [!quote]
> "Data engineering is much closer to software engineering than it is to data science."
>
> — **Maxime Beauchemin**, "The Rise of the Data Engineer" (2017)

> [!abstract] When You Need This
> You are setting up dbt for the first time, or onboarding a team member who has never used it. This note explains what dbt is, how it works internally, and the mental model for thinking about dbt projects.

### What dbt Is (and Is Not)

dbt is the **T** in ELT. It does not extract data from sources. It does not load data into the warehouse. It transforms data that is already in the warehouse using SQL.

| dbt Does | dbt Does Not |
|----------|-------------|
| Compile Jinja + SQL into executable SQL | Connect to source APIs or files |
| Execute SQL against the warehouse | Move data between systems |
| Build a dependency graph (DAG) from ref() calls | Schedule itself (needs Airflow, cron, or CI) |
| Run tests against data | Replace stored procedures (but can supersede them) |
| Generate documentation and lineage | Handle real-time/streaming data |

### dbt Core vs dbt Cloud

| Factor | dbt Core (open source) | dbt Cloud (SaaS) |
|--------|----------------------|------------------|
| Cost | Free | $100+/seat/month |
| Execution | CLI, runs anywhere | Managed cloud environment |
| Scheduling | You provide (Airflow, cron) | Built-in scheduler |
| IDE | Your editor + CLI | Browser-based IDE |
| CI | You build (GitHub Actions) | Built-in slim CI |
| State management | You manage manifest.json | Automatic |
| Best for | Teams with Airflow, cost-conscious | Teams without orchestration |

> [!tip] For This Stack
> We use dbt Core because we already have Airflow for orchestration and GitHub Actions for CI/CD. dbt Core runs inside a Docker container triggered by Airflow.

### dbt Compilation Architecture

dbt compiles before executing:

```
Your model (Jinja + SQL)
    --> dbt compile
Compiled SQL (pure SQL)
    --> dbt run
Warehouse executes the SQL
    --> Table/view created
```

Example model `stg_daily_prices.sql`:

```sql
{{ config(materialized='view') }}

SELECT
    instrument_isin,
    CAST(price_date AS DATE) AS price_date,
    CAST(close_price AS DECIMAL(18,4)) AS close_price,
    CAST(volume AS BIGINT) AS volume
FROM {{ source('bronze', 'raw_daily_prices') }}
WHERE close_price > 0
```

After compilation, `target/compiled/` contains pure SQL with `{{ source() }}` resolved to the actual table name.

### The dbt DAG

Every dbt project is a Directed Acyclic Graph built automatically from two functions:

- **ref('model_name')** — references another dbt model (creates a dependency edge)
- **source('source_name', 'table_name')** — references an external table (entry point)

```sql
-- stg_daily_prices.sql (reads from source)
SELECT * FROM {{ source('bronze', 'raw_daily_prices') }}

-- int_daily_returns.sql (depends on stg_daily_prices)
SELECT *,
    (close_price - LAG(close_price) OVER (
        PARTITION BY instrument_isin ORDER BY price_date
    )) / NULLIF(LAG(close_price) OVER (
        PARTITION BY instrument_isin ORDER BY price_date
    ), 0) AS daily_return
FROM {{ ref('stg_daily_prices') }}

-- fct_index_performance.sql (depends on int_daily_returns + int_constituent_weights)
SELECT
    w.index_code,
    r.price_date,
    SUM(r.daily_return * w.weight_pct) AS weighted_return
FROM {{ ref('int_daily_returns') }} r
JOIN {{ ref('int_constituent_weights') }} w
    ON r.instrument_isin = w.instrument_isin
    AND r.price_date = w.price_date
GROUP BY w.index_code, r.price_date
```

dbt knows to run staging first, then intermediate, then marts — mirroring the [medallion-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/medallion-architecture) progression from bronze to silver to gold. You never specify execution order — ref() handles it.

> [!tip] Contrast with Airflow
> In Airflow, you explicitly define `task_a >> task_b >> task_c`. In dbt, dependencies are implicit from ref(). Airflow orchestrates *when* dbt runs; dbt manages the *order within* a run.

### dbt Materializations Overview

| Materialization | Creates | When to Use | Storage Cost |
|----------------|---------|-------------|-------------|
| **view** | SQL view | Staging models, light transforms | None |
| **table** | Physical table (rebuilt each run) | Intermediate, small datasets | Moderate |
| **incremental** | Appends/merges new rows only | Large fact tables, daily data | Lowest at scale |
| **ephemeral** | CTE (no object) | Helper logic, no persistence needed | Zero |
| **snapshot** | SCD Type 2 history | Tracking dimension changes | Moderate |

```sql
{{ config(
    materialized='incremental',
    unique_key=['instrument_isin', 'price_date']
) }}

SELECT ...
FROM {{ ref('stg_daily_prices') }}

{% if is_incremental() %}
WHERE price_date > (SELECT MAX(price_date) FROM {{ this }})
{% endif %}
```

See [dbt-materializations](https://alp78.github.io/elysium/11-dbt/Modeling/dbt-materializations) for the deep dive with decision matrices.

> [!warning] env_var() in profiles.yml Fails Silently with Empty String
> If `SQL_PASSWORD` is not set, `{{ env_var('SQL_PASSWORD') }}` resolves to an empty string -- dbt will not raise an error at parse time. The connection will then fail at runtime with a misleading authentication error. Always use `{{ env_var('SQL_PASSWORD', 'MISSING') }}` with a sentinel default, or validate environment variables in your CI startup script.

> [!success] Use a sentinel default and a preflight check
> Write `{{ env_var('SQL_PASSWORD', 'MISSING') }}` in `profiles.yml`. Add a CI startup step that runs `dbt debug` before `dbt run` — `dbt debug` will surface a connection failure immediately if the sentinel value is used, stopping the pipeline before any models execute.

### dbt Profiles and Targets

`profiles.yml` defines where dbt connects. Each profile has multiple targets (environments):

```yaml
financial_platform:
  target: dev
  outputs:
    dev:
      type: sqlserver
      server: localhost
      port: 1433
      database: analytics_db
      schema: dbt_dev
      user: "{{ env_var('SQL_USER') }}"
      password: "{{ env_var('SQL_PASSWORD') }}"
      driver: "ODBC Driver 18 for SQL Server"
      trust_cert: true
      threads: 4

    prod:
      type: sqlserver
      server: sql-vm.internal
      database: analytics_db
      schema: gold
      threads: 8

    bigquery:
      type: bigquery
      method: service-account
      project: data-platform-prod
      dataset: analytics
      threads: 16
      location: EU
```

Switch targets: `dbt run --target prod` or `dbt run --target bigquery`.

### dbt Adapters

| Adapter | Package | Database |
|---------|---------|----------|
| dbt-sqlserver | `pip install dbt-sqlserver` | SQL Server 2016+ |
| dbt-bigquery | `pip install dbt-bigquery` | Google BigQuery |
| dbt-postgres | `pip install dbt-postgres` | PostgreSQL |

Each adapter handles SQL dialect differences. See [dbt-sqlserver-adapter](https://alp78.github.io/elysium/11-dbt/Adapters/dbt-sqlserver-adapter) and [dbt-bigquery-adapter](https://alp78.github.io/elysium/11-dbt/Adapters/dbt-bigquery-adapter).

### dbt Packages

Declare in `packages.yml`, install with `dbt deps`:

```yaml
packages:
  - package: dbt-labs/dbt_utils
    version: ">=1.0.0"
  - package: calogica/dbt_expectations
    version: ">=0.10.0"
  - package: elementary-data/elementary
    version: ">=0.15.0"
```

See [dbt-packages](https://alp78.github.io/elysium/11-dbt/Advanced/dbt-packages) for the full package guide.

### The dbt_project.yml

```yaml
name: financial_platform
version: '1.0.0'
profile: financial_platform

model-paths: ["models"]
test-paths: ["tests"]
seed-paths: ["seeds"]
macro-paths: ["macros"]
snapshot-paths: ["snapshots"]

vars:
  index_universe: ['EURO_STOXX_50', 'GLOBAL_ESG_100']

models:
  financial_platform:
    staging:
      +materialized: view
      +schema: staging
    intermediate:
      +materialized: table
      +schema: intermediate
    marts:
      +materialized: table
      +schema: gold
```

> [!danger] dbt run --full-refresh on Incremental Models Silently Drops and Rebuilds the Table
> Running `dbt run --full-refresh` on an incremental model drops the existing table and rebuilds from scratch. If your incremental model filters on `is_incremental()`, the full-refresh path must produce the correct full dataset -- otherwise you lose historical data. Always test `--full-refresh` in a dev target before running it in production. For snapshot tables, `--full-refresh` destroys all SCD2 history permanently (see [dbt-snapshots-and-scd](https://alp78.github.io/elysium/11-dbt/Advanced/dbt-snapshots-and-scd)).

> [!success] Test full-refresh in dev, validate row counts before prod
> Always run `dbt run --full-refresh --target dev` first and verify the rebuilt table has the expected row count and date range. Ensure the model SQL outside the `{% if is_incremental() %}` block selects the full historical dataset. Gate the production full-refresh behind a manual approval step in CI to prevent accidental execution.

> [!warning] dbt build vs dbt run -- Use build in CI/CD
> `dbt run` executes models but does NOT run tests. `dbt build` runs models AND their downstream tests in dependency order. In CI/CD, always use `dbt build` -- otherwise bad data can propagate to the gold layer before tests catch it.

> [!success] Use dbt build in all CI/CD pipelines
> Replace every `dbt run && dbt test` invocation in CI with a single `dbt build` command. For slim CI, use `dbt build --select state:modified+ --defer --state ./prod_artifacts`. This ensures tests gate downstream execution and no failing data reaches the gold layer.

### dbt Anti-Patterns

| Anti-Pattern | Problem | Better Approach |
|-------------|---------|----------------|
| Business logic in staging | Staging should be 1:1 with source | Move logic to intermediate |
| SELECT * in models | Schema changes propagate silently | Explicitly list columns |
| No ref() (hardcoded tables) | Breaks DAG, no dependency tracking | Always use ref() and source() |
| One giant model | Impossible to test or debug | Split into staging/intermediate/mart |
| Running without tests | Bad data reaches production | Use dbt build (runs + tests together) |

## Related

- [dbt-project-structure](https://alp78.github.io/elysium/11-dbt/Foundations/dbt-project-structure) — Directory layout and naming conventions
- [dbt-cli-reference](https://alp78.github.io/elysium/11-dbt/Foundations/dbt-cli-reference) — CLI commands and flags
- [dbt-transformation-layer](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/dbt-transformation-layer) — Code-heavy walkthrough
- [airflow-core-concepts](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-core-concepts) — How Airflow orchestrates dbt runs
- [medallion-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/medallion-architecture) — How bronze/silver/gold maps to staging/intermediate/marts
