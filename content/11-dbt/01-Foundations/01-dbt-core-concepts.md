---
title: "01 - dbt Core Concepts"
tags: [pipeline, sql, dbt, bigquery]
status: stable
updated: 2026-03-23
description: "What dbt is, how it compiles, the DAG, materializations, profiles, adapters, and packages."
---

# dbt Core Concepts

> [!quote]+
>
> "Data engineering is much closer to software engineering than it is to data science."
>
> Source: Maxime Beauchemin | "The Rise of the Data Engineer" (2017)

> [!abstract]- Summary
>
> Explains the mental model behind dbt for first-time setup and onboarding: what dbt does and does not do, how compilation and DAG resolution work, when each materialization fits, and how profiles, adapters, packages, and project config shape a real warehouse transformation project.
>
> **dbt role and execution model**
> - Defines dbt as the transformation layer in ELT, contrasts dbt Core with dbt Cloud, and explains why dbt compiles Jinja plus SQL before the warehouse ever executes a statement
> - Maps dbt's execution flow from model code to compiled SQL to warehouse objects so refactoring, debugging, and orchestration decisions stay grounded in the actual runtime model
>
> **Graph and model behavior**
> - Explains the DAG built from `ref()` and `source()`, shows how execution order is derived implicitly, and ties that model to staging, intermediate, and mart progression in a medallion-style warehouse
> - Compares materializations such as `view`, `table`, `incremental`, `ephemeral`, and `snapshot`, including why materialization choice is one of the biggest performance and cost decisions in a dbt project
>
> **Project connectivity and extensibility**
> - Covers `profiles.yml`, targets, adapters, packages, and `dbt_project.yml` so environment selection, warehouse dialect differences, and project-wide defaults are understood before a team starts building models
> - Highlights adapter-specific execution, package reuse, and the anti-patterns that make dbt projects hard to operate at scale
>
> **Operations and safety**
> - Warnings: treating dbt as ingestion or scheduling software, misreading compile-time versus run-time behavior, choosing the wrong materialization, and letting unset `env_var()` values fail later with misleading connection errors
> - Recommendations: keep the ELT boundary clear, use `dbt debug` before real runs, model dependencies through `ref()` instead of manual ordering, and make target and adapter choice explicit in every environment

> [!info]- Glossary
>
> **dbt**
> - A transformation framework that compiles Jinja-templated SQL and executes the resulting SQL inside a warehouse.
> - It matters here because every later concept in the dbt chapter assumes this compile-then-run model rather than direct execution of raw SQL files.
>
> > [!info] ELT transformation layer
> >
> > dbt is not an orchestrator or ingestion engine. It becomes much easier to place in the platform once you treat it as the transformation layer that runs after raw data already lands in the warehouse.
>
> ---
>
> **dbt Core**
> - The open-source CLI distribution of dbt that runs anywhere you can install Python and the matching warehouse adapter.
> - It matters here because this vault assumes dbt Core running under external orchestration such as Airflow and CI tooling rather than dbt Cloud's managed runtime.
>
> > [!info] Bring your own orchestration
> >
> > dbt Core gives you execution flexibility and lower cost, but it pushes scheduling, secrets management, and deployment workflow decisions onto the surrounding platform.
>
> ---
>
> **dbt Cloud**
> - The managed SaaS version of dbt that adds hosted execution, a browser IDE, job scheduling, and built-in CI patterns.
> - It matters here because many design choices in Core projects are deliberate replacements for dbt Cloud conveniences.
>
> > [!warning] Same DAG, different operating model
> >
> > Core and Cloud share dbt semantics, but not the same control plane. Guidance about scheduling, state management, and credentials changes once the runtime is managed for you.
>
> ---
>
> **Compilation**
> - The dbt phase that renders Jinja, resolves refs and sources, applies configs, and writes pure SQL into `target/compiled/` without executing it.
> - It matters here because many dbt failures happen before the warehouse sees any SQL, and understanding compilation is the key to debugging them correctly.
>
> > [!warning] Compile time is its own layer
> >
> > A model can fail during compilation even when the resulting SQL would have been valid. Jinja syntax, missing refs, and macro errors all stop the run before execution begins.
>
> ---
>
> **DAG**
> - The directed acyclic graph of dbt nodes and dependencies derived mainly from `ref()` and `source()` calls.
> - It matters here because dbt's execution order, documentation lineage, and state-aware selection all depend on the graph, not on file order.
>
> > [!info] Order is inferred
> >
> > You do not script model order manually in dbt. If the graph is wrong, the fix is almost always in the dependency declarations, not in an external sequencing hack.
>
> ---
>
> **`ref()`**
> - A dbt function that references another model and creates an explicit dependency edge in the graph.
> - It matters here because `ref()` is the main way dbt understands lineage, compiles object names correctly, and schedules models in the right order.
>
> > [!warning] Dependency and naming in one call
> >
> > `ref()` does more than substitute a table name. Replacing it with a hard-coded relation breaks lineage, environment-aware naming, and DAG correctness at the same time.
>
> ---
>
> **`source()`**
> - A dbt function that references an externally loaded table declared in `_sources.yml`.
> - It matters here because sources are the graph entry points that separate raw ingested data from modeled dbt relations.
>
> > [!info] Raw data boundary
> >
> > Treat `source()` as the handoff from ingestion into transformation. Once that boundary blurs, staging models stop being auditable and freshness rules become harder to trust.
>
> ---
>
> **Materialization**
> - The persistence strategy dbt uses when writing a model, such as `view`, `table`, `incremental`, `ephemeral`, or `snapshot`.
> - It matters here because the same model SQL can create very different warehouse objects, storage footprints, and runtime costs depending on materialization choice.
>
> > [!warning] Warehouse behavior changes here
> >
> > Materialization is not a cosmetic setting. It determines rebuild semantics, persistence, cost, and what downstream tools can expect from the relation.
>
> ---
>
> **Incremental model**
> - A model that processes and writes only new or changed rows instead of rebuilding the full relation on every run.
> - It matters here because incremental logic is the first major dbt optimization most teams adopt, and it introduces correctness risks if predicates or unique keys are wrong.
>
> > [!warning] Performance and correctness tradeoff
> >
> > Incremental models save compute only when the cutoff logic is correct. A fast incremental model with drifted history is worse than a slower full rebuild.
>
> ---
>
> **`profiles.yml`**
> - The dbt connection file that defines profiles, outputs, credentials, and targets for warehouse access.
> - It matters here because dbt cannot run until profile selection, authentication, and target naming are correct for the current environment.
>
> > [!danger] Secrets live around this file
> >
> > `profiles.yml` often pulls credentials from environment variables. Bad defaults or missing values show up later as runtime auth failures, which is why preflight checks are essential.
>
> ---
>
> **Target**
> - A named output in `profiles.yml` that selects a specific environment such as `dev`, `prod`, or a different adapter backend.
> - It matters here because the same dbt project can compile and run against different warehouses or schemas depending on the active target.
>
> > [!warning] Same project, different destination
> >
> > Running the right command against the wrong target can write into the wrong schema or warehouse. Treat target selection as an operational control, not a convenience flag.
>
> ---
>
> **Adapter**
> - The warehouse-specific dbt package that translates dbt behavior into a particular SQL dialect and connection method.
> - It matters here because dbt semantics are portable only up to the adapter boundary; SQL capabilities, configs, and performance behavior diverge after that.
>
> > [!warning] Portability ends at the warehouse edge
> >
> > Two projects can share dbt structure while still behaving differently on SQL Server and BigQuery. Adapter differences affect SQL syntax, configs, and runtime characteristics.
>
> ---
>
> **Package**
> - A reusable dbt dependency installed with `dbt deps`, commonly providing tests, macros, or observability helpers.
> - It matters here because packages extend dbt's capabilities quickly, but they also become part of the project's behavior and upgrade surface.
>
> > [!info] Reuse with version discipline
> >
> > Packages accelerate adoption of common patterns, but they should be versioned and reviewed like application dependencies because macro behavior can change model results.
>
> ---
>
> **`dbt_project.yml`**
> - The root project configuration file that defines paths, variables, default configs, and resource-level behavior for the dbt project.
> - It matters here because it is the control plane for model defaults, schema conventions, path resolution, and project-wide behavior.
>
> > [!warning] Defaults become architecture
> >
> > Small config choices in `dbt_project.yml` propagate through every model. A careless default for schemas, materializations, or vars turns into chapter-wide operational drift.

## What dbt Is (and Is Not)

dbt is the **T** in ELT. It does not extract data from sources. It does not load data into the warehouse. It transforms data that is already in the warehouse using SQL.

| dbt Does | dbt Does Not |
|----------|-------------|
| Compile Jinja + SQL into executable SQL | Connect to source APIs or files |
| Execute SQL against the warehouse | Move data between systems |
| Build a dependency graph (DAG) from ref() calls | Schedule itself (needs Airflow, cron, or CI) |
| Run tests against data | Replace stored procedures (but can supersede them) |
| Generate documentation and lineage | Handle real-time/streaming data |

## dbt Core vs dbt Cloud

| Factor | dbt Core (open source) | dbt Cloud (SaaS) |
|--------|----------------------|------------------|
| Cost | Free | $100+/seat/month |
| Execution | CLI, runs anywhere | Managed cloud environment |
| Scheduling | You provide (Airflow, cron) | Built-in scheduler |
| IDE | Your editor + CLI | Browser-based IDE |
| CI | You build (GitHub Actions) | Built-in slim CI |
| State management | You manage manifest.json | Automatic |
| Best for | Teams with Airflow, cost-conscious | Teams without orchestration |

> [!tip] For this stack
>
> We use dbt Core because Airflow already owns orchestration and GitHub Actions already owns CI/CD. That keeps dbt focused on transformation logic while the surrounding platform handles scheduling, secrets, and deployment workflow.

## dbt Compilation Architecture

dbt compiles before executing:

*This flow shows how dbt renders Jinja into warehouse-specific SQL before any database object is created.*

```text
Your model (Jinja + SQL)
    --> dbt compile
Compiled SQL (pure SQL)
    --> dbt run
Warehouse executes the SQL
    --> Table/view created
```

Example model `stg_daily_prices.sql`:

*This staging model casts raw columns, filters impossible values, and keeps source-aligned cleanup separate from downstream business logic.*

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

## The dbt DAG

Every dbt project is a Directed Acyclic Graph built automatically from two functions:

- **ref('model_name')** — references another dbt model (creates a dependency edge)
- **source('source_name', 'table_name')** — references an external table (entry point)

*This graph example shows how `source()` anchors the raw-data boundary and how successive `ref()` calls define the staging-to-mart execution order.*

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
>
> In Airflow, you explicitly define `task_a >> task_b >> task_c`. In dbt, dependencies are implicit from `ref()`. Airflow orchestrates when dbt runs; dbt manages the order inside the run itself.

## dbt Materializations Overview

| Materialization | Creates | When to Use | Storage Cost |
|----------------|---------|-------------|-------------|
| **view** | SQL view | Staging models, light transforms | None |
| **table** | Physical table (rebuilt each run) | Intermediate, small datasets | Moderate |
| **incremental** | Appends/merges new rows only | Large fact tables, daily data | Lowest at scale |
| **ephemeral** | CTE (no object) | Helper logic, no persistence needed | Zero |
| **snapshot** | SCD Type 2 history | Tracking dimension changes | Moderate |

*This incremental configuration rebuilds the target once, then applies a date-based cutoff on later runs to limit warehouse work to new facts.*

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

> [!warning] Required env vars fail at compile time
>
> If `SQL_PASSWORD` is not set, `{{ env_var('SQL_PASSWORD') }}` raises a compilation error before dbt opens a warehouse connection. That fail-fast behavior is safer than hiding the problem behind a later authentication error. Only provide a default when fallback behavior is genuinely intended, and keep secret values in environment variables rather than hard-coding them in `profiles.yml`.

> [!success] Fail fast on required credentials
>
> Leave required secrets as `{{ env_var('SQL_PASSWORD') }}` so missing values stop compilation immediately. For non-secret settings that genuinely need a fallback, use an explicit default and cast it to the expected type. Keep `dbt debug` in CI as a preflight so profile, target, and connectivity problems surface before a real build starts.

## dbt Profiles and Targets

`profiles.yml` defines where dbt connects. Each profile has multiple targets (environments):

*This profile maps one project to separate SQL Server and BigQuery targets so the same dbt codebase can compile against different backends without manual relation rewrites.*

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

## dbt Adapters

| Adapter | Package | Database |
|---------|---------|----------|
| dbt-sqlserver | `pip install dbt-sqlserver` | SQL Server 2016+ |
| dbt-bigquery | `pip install dbt-bigquery` | Google BigQuery |
| dbt-postgres | `pip install dbt-postgres` | PostgreSQL |

Each adapter handles SQL dialect differences. See [dbt-sqlserver-adapter](https://alp78.github.io/elysium/11-dbt/Adapters/dbt-sqlserver-adapter) and [dbt-bigquery-adapter](https://alp78.github.io/elysium/11-dbt/Adapters/dbt-bigquery-adapter).

## dbt Packages

Declare in `packages.yml`, install with `dbt deps`:

*This package manifest pins shared macro and testing dependencies so every environment resolves the same project behavior during `dbt deps`.*

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

## The dbt_project.yml

*This root configuration sets project-wide paths, variables, and layer defaults so model behavior stays consistent unless a narrower folder or model override is intentional.*

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

> [!danger] Full refresh rebuilds incremental state
>
> Running `dbt run --full-refresh` on an incremental model drops the existing relation and rebuilds it from scratch. If the non-incremental path does not select the complete historical dataset, the rebuilt table becomes incomplete even though the command succeeds. Always test full-refresh behavior in a dev target before you use it to recover production drift or schema changes.

> [!success] Validate the non-incremental path first
>
> Run `dbt run --full-refresh --target dev` against a representative dataset, then compare row counts, date ranges, and key uniqueness with the trusted relation or source. Gate production full refreshes behind a manual approval step so a broad rebuild is never triggered by an ordinary deployment.

> [!warning] CI should use `dbt build`
>
> `dbt run` executes models but does not run tests. `dbt build` runs seeds, snapshots, models, and tests in dependency order, so a failing upstream test can stop downstream work before more warehouse state is written.

> [!success] Keep build and test in one DAG-aware command
>
> Replace `dbt run && dbt test` in CI with `dbt build`, and combine it with narrow selectors such as `state:modified+` when you need slim CI behavior. That keeps the execution graph, test gating, and failure reporting in one command instead of reconstructing the workflow in your orchestrator.

## dbt Anti-Patterns

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
