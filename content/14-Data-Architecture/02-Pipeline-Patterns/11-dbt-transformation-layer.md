---
title: "11 - dbt Transformation Layer"
tags: [data-architecture, architecture, pipeline, python, sql, airflow, dbt, bigquery]
aliases: [dbt Core, dbt Cloud, Data Build Tool, dbt models, dbt snapshots, dbt macros, dbt testing, transformation layer]
description: "dbt (Data Build Tool) is the standard SQL transformation layer for modern data platforms — it implements software engineering practices (version control, testing, documentation, CI/CD) for SQL transforms already inside your warehouse. Covers project structure, staging/intermediate/mart model layers, schema and custom tests, SCD Type 2 snapshots, Jinja macros, Airflow integration, and slim CI builds."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# dbt Transformation Layer

> [!quote]+
> "Analytics code should be version-controlled, tested, and modular — the same standards we apply to software should apply to SQL."
>
> — **Tristan Handy** (creator of dbt)

> [!abstract]- Summary
>
> This note defines dbt as the SQL transformation layer inside the warehouse, showing how staging, intermediate, and mart models, tests, snapshots, macros, orchestration, and slim CI turn warehouse SQL into a modular software-engineering workflow rather than a pile of ad hoc scripts.
>
> **What dbt does and how projects are structured**
> - Explains dbt's exact role as the transformation step in ELT, distinguishes dbt Core from dbt Cloud, and maps a financial-data project layout across models, snapshots, tests, macros, seeds, and packages.
> - Connects the tool's role back to medallion-style layering so dbt fits into the broader platform instead of being treated as a standalone product.
>
> **Models, testing, and snapshots**
> - Covers staging, intermediate, and mart model responsibilities, then adds schema tests, custom data tests, and SCD Type 2 snapshots as the mechanisms that keep warehouse transformations correct and traceable.
> - Treats modeling patterns and test declarations as one transformation discipline rather than separate concerns.
>
> **Reuse, orchestration, and CI/CD**
> - Explains macros for reusable SQL, Airflow integration for scheduled execution, and slim-build CI workflows that limit warehouse work to changed models and their dependencies.
> - Uses edge cases and gotchas to show where dbt fits well and where teams need to stay explicit about target selection, model boundaries, and warehouse cost.
>
> **Operations and safety**
> - Warnings: the default target must stay non-prod, staging models should remain close to sources, and warehouse transforms still need orchestration, cost control, and explicit testing.
> - Recommendations: keep dbt focused on the T in ELT, organize models by layer, declare tests near models, use snapshots for history, and run slim CI before production promotion.

> [!note]- Glossary
>
> **dbt**
> - A framework for building, testing, documenting, and versioning SQL transformations that run inside a warehouse or query engine.
> - It matters here because the note positions dbt as the standard transformation layer for modern analytical platforms.
>
> > [!info] SQL plus engineering discipline
> >
> > dbt's real value is not just templated SQL. It is the way it wraps warehouse transforms in version control, testing, and deployment practices.
>
> ---
>
> **ELT**
> - A pipeline pattern where data is extracted and loaded before transformations run inside the target analytical system.
> - It matters here because dbt is explicitly framed as the transformation layer after data has already landed in the warehouse.
>
> > [!info] dbt owns the T only
> >
> > dbt is strongest when teams let it focus on in-warehouse transformation rather than forcing it to do extraction, transport, or orchestration work it was not built for.
>
> ---
>
> **Staging model**
> - A dbt model that stays close to one source table, usually applying renaming, casting, and light cleanup without heavy business logic.
> - It matters here because staging is the first layer that stabilizes raw loaded data for later transformations.
>
> > [!warning] Keep staging thin
> >
> > Once joins and business rules accumulate in staging, the project loses the clear boundary that makes downstream models easier to reason about and debug.
>
> ---
>
> **Intermediate model**
> - A dbt model that applies reusable business logic and prepares cleaned or enriched data for marts.
> - It matters here because the note uses intermediate models as the main expression layer for transformation logic inside the warehouse.
>
> > [!info] Reuse before publish
> >
> > Intermediate models are valuable because they let teams centralize reusable business logic without exposing every internal step directly to end users.
>
> ---
>
> **Mart model**
> - A consumer-facing dbt model shaped for reporting, analytics, or application access rather than for raw transformation reuse.
> - It matters here because marts are where warehouse transformations become published outputs with clearer business meaning.
>
> > [!warning] Shape for the consumer
> >
> > A mart that still looks like a raw source table has probably not completed the transformation job the consumer actually needs.
>
> ---
>
> **Schema test**
> - A declarative dbt test that validates generic structural properties such as uniqueness, non-nullness, accepted values, or relationships.
> - It matters here because schema tests are the fastest way to attach repeatable quality checks directly to models.
>
> > [!info] Cheap guardrails
> >
> > Generic tests catch a large class of model regressions with very little custom code, which is why they should be the baseline in most projects.
>
> ---
>
> **Custom data test**
> - A SQL-based test that encodes project-specific business assertions which generic schema tests cannot express.
> - It matters here because real analytical domains usually need rules beyond `not_null` and `unique`.
>
> > [!warning] Business rules deserve SQL too
> >
> > If a rule matters operationally, it should be executable as a test rather than documented only in a wiki or code review comment.
>
> ---
>
> **Snapshot**
> - A dbt mechanism for tracking historical row versions over time, often used to implement SCD Type 2 behavior.
> - It matters here because the note uses snapshots to preserve change history without rewriting the whole table manually.
>
> > [!info] History as modeled state
> >
> > Snapshots are useful when teams need a warehouse-native record of how dimensions changed, not just their latest current value.
>
> ---
>
> **Macro**
> - A reusable Jinja-templated SQL function or snippet that helps standardize logic across many models.
> - It matters here because macros let projects reuse complex SQL patterns without copy-pasting them throughout the model graph.
>
> > [!warning] Reuse, not obscurity
> >
> > Macros are powerful, but over-abstracting simple SQL can make projects harder to read. Use them to remove duplication, not to hide ordinary logic.
>
> ---
>
> **Slim CI**
> - A dbt build strategy that runs only changed models and their affected dependencies by comparing current state to a saved prior state.
> - It matters here because warehouse-aware CI must stay fast enough to run often without rebuilding the whole project every time.
>
> > [!info] Faster feedback loop
> >
> > Slim CI keeps analytical projects deployable by cutting warehouse work to the models touched by the change instead of paying for full graph rebuilds on every PR.
>


## What dbt Actually Does (and Does Not Do)

**dbt is the T in ELT** — it runs SQL transformations inside your data warehouse:

```
                                     ┌──────────────────────┐
   Airflow / Cloud Run               │    DATA WAREHOUSE    │
   ┌────────────┐                     │                      │
   │  Extract   │──── Load ────▶      │  bronze.raw_ohlcv    │
   │  (Python)  │                     │  bronze.raw_signals  │
   └────────────┘                     │                      │
                                      │       ┌──────────┐   │
                                      │       │   dbt    │   │
                                      │       │  runs    │   │
                                      │       │  SQL     │   │
                                      │       │  inside  │   │
                                      │       │  the     │   │
                                      │       │  warehouse│  │
                                      │       └────┬─────┘   │
                                      │            │          │
                                      │  silver.daily_ohlcv   │
                                      │  silver.daily_signals  │
                                      │  gold.index_performance│
                                      └──────────────────────┘
```

#### dbt Core vs dbt Cloud

| Aspect | dbt Core (OSS) | dbt Cloud |
|---|---|---|
| Cost | Free | $100+/seat/month |
| Execution | CLI (`dbt run`) | Web IDE + scheduler |
| Scheduling | External (Airflow, cron) | Built-in scheduler |
| CI/CD | You set up GitHub Actions | Built-in CI with slim builds |
| Best for | Teams with existing Airflow, cost-conscious | Teams without orchestration, want turnkey |

> [!tip] Which to Choose
> If you already have [Airflow](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-core-concepts) or Cloud Scheduler, use **dbt Core** — it is free and fully featured. dbt Cloud adds value mainly for teams without existing orchestration infrastructure.

---

### dbt Project Structure for Financial Data

```
dbt_project/
├── dbt_project.yml          # project configuration
├── profiles.yml             # connection profiles (not committed to git)
├── models/
│   ├── staging/             # 1:1 with source tables (bronze → cleaned)
│   │   ├── stg_yahoo_ohlcv.sql
│   │   ├── stg_yahoo_ohlcv.yml    # schema tests and docs
│   │   ├── stg_corporate_actions.sql
│   │   └── stg_index_constituents.sql
│   ├── intermediate/        # business logic transforms (silver)
│   │   ├── int_daily_returns.sql
│   │   ├── int_momentum_scores.sql
│   │   ├── int_value_signals.sql
│   │   └── int_sentiment_scores.sql
│   └── marts/               # final consumption models (gold)
│       ├── fct_index_performance.sql
│       ├── fct_composite_scores.sql
│       ├── dim_constituents.sql
│       └── dim_constituents.yml
├── seeds/
│   ├── country_withholding_rates.csv   # static reference data
│   └── exchange_calendars.csv
├── snapshots/
│   └── snap_constituents.sql           # SCD Type 2
├── tests/
│   ├── assert_weights_sum_to_100.sql   # custom data tests
│   └── assert_no_negative_prices.sql
├── macros/
│   ├── z_score.sql                     # reusable SQL macros
│   └── weighted_harmonic_mean.sql
└── packages.yml                        # dbt packages (dbt-utils, etc.)
```

> [!info] Medallion Architecture Mapping
> dbt's `staging/` folder corresponds to the **bronze → silver** transition. `intermediate/` is the **silver layer** business logic. `marts/` is the **gold layer** consumption-ready output. See [open-table-formats](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/open-table-formats) for the Iceberg lakehouse equivalent.

---

## Models: Staging, Intermediate, and Marts

### Staging Models (1:1 With Source, Minimal Transformation)

#### Staging model — rename, cast, and filter a source table

```sql
-- models/staging/stg_yahoo_ohlcv.sql

WITH source AS (
    SELECT * FROM {{ source('bronze', 'yahoo_ohlcv') }}
),

cleaned AS (
    SELECT
        UPPER(TRIM(symbol))             AS symbol,
        CAST(trade_date AS DATE)        AS trade_date,
        CAST(open_price AS DECIMAL(12,4))  AS open_price,
        CAST(high_price AS DECIMAL(12,4))  AS high_price,
        CAST(low_price AS DECIMAL(12,4))   AS low_price,
        CAST(close_price AS DECIMAL(12,4)) AS close_price,
        CAST(volume AS BIGINT)          AS volume,
        CAST(load_timestamp AS DATETIME2)  AS loaded_at
    FROM source
    WHERE close_price > 0               -- filter invalid data
      AND volume >= 0
      AND trade_date <= GETDATE()       -- no future dates
)

SELECT * FROM cleaned
```

> [!tip] Staging Layer Rules
> Staging models must be: (1) 1:1 with the source table — one staging model per source table, (2) renamed and cast but not joined, (3) materialized as views by default (cheap to rebuild). Never put business logic in staging — that belongs in `intermediate/`.

### Intermediate Models (Business Logic)

#### Intermediate model — momentum scores with rolling window functions

```sql
-- models/intermediate/int_momentum_scores.sql

{{
    config(
        materialized='table',
        schema='silver'
    )
}}

WITH daily_returns AS (
    SELECT
        symbol,
        trade_date,
        close_price,
        close_price / LAG(close_price) OVER (PARTITION BY symbol ORDER BY trade_date) - 1
            AS daily_return
    FROM {{ ref('stg_yahoo_ohlcv') }}
),

rolling_metrics AS (
    SELECT
        symbol,
        trade_date,
        close_price,
        daily_return,
        -- 30-day momentum: cumulative return over last 30 trading days
        EXP(SUM(LOG(1 + daily_return)) OVER (
            PARTITION BY symbol ORDER BY trade_date
            ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
        )) - 1 AS momentum_30d,
        -- Z-score of momentum within the index
        {{ z_score('momentum_30d', 'trade_date') }} AS momentum_z_score
    FROM daily_returns
    WHERE daily_return IS NOT NULL
)

SELECT * FROM rolling_metrics
```

> [!info] The ref() function
>
> `{{ ref('stg_yahoo_ohlcv') }}` is how dbt builds the dependency graph. dbt automatically determines execution order from `ref()` calls — you never manually specify task order. This is dbt's equivalent of [Airflow](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-core-concepts)'s `>>` task dependencies.

### Mart Models (Consumption-Ready, Incremental)

#### Mart model — incremental load of gold layer composite scores

```sql
-- models/marts/fct_index_performance.sql

{{
    config(
        materialized='incremental',
        unique_key=['index_key', 'trade_date'],
        schema='gold',
        on_schema_change='sync_all_columns'
    )
}}

WITH scored AS (
    SELECT
        c.index_key,
        m.symbol,
        m.trade_date,
        m.close_price,
        m.momentum_z_score,
        v.value_z_score,
        s.sentiment_z_score,
        c.shares_in_index,
        c.free_float_factor,
        c.cap_factor,
        -- Composite score: equal-weight average of z-scores
        (COALESCE(m.momentum_z_score, 0) +
         COALESCE(v.value_z_score, 0) +
         COALESCE(s.sentiment_z_score, 0)) / 3.0 AS composite_score
    FROM {{ ref('int_momentum_scores') }} m
    JOIN {{ ref('int_value_signals') }} v ON m.symbol = v.symbol AND m.trade_date = v.trade_date
    JOIN {{ ref('int_sentiment_scores') }} s ON m.symbol = s.symbol AND m.trade_date = s.trade_date
    JOIN {{ ref('dim_constituents') }} c ON m.symbol = c.symbol AND c.is_active = 1
)

SELECT * FROM scored

{% if is_incremental() %}
    -- Only process new data since the last run
    WHERE trade_date > (SELECT MAX(trade_date) FROM {{ this }})
{% endif %}
```

> [!tip] Incremental Models
> The `is_incremental()` macro returns `true` when the target table already exists. On first run (or after `dbt run --full-refresh`), the `WHERE` clause is skipped and all data is loaded. This is the same pattern as [idempotent-pipeline-design](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design) applied to SQL.

---

## Testing: Schema Tests and Custom Data Tests

### Schema Tests (Declared in YAML)

#### Schema test definitions in YAML — declarative data contracts

```yaml
# models/staging/stg_yahoo_ohlcv.yml
version: 2

models:
  - name: stg_yahoo_ohlcv
    description: "Cleaned daily OHLCV data from Yahoo Finance"
    columns:
      - name: symbol
        description: "Stock ticker symbol"
        tests:
          - not_null
          - relationships:
              to: ref('dim_constituents')
              field: symbol
      - name: trade_date
        tests:
          - not_null
      - name: close_price
        tests:
          - not_null
          - dbt_utils.accepted_range:
              min_value: 0.01
              max_value: 100000
      - name: volume
        tests:
          - not_null
          - dbt_utils.accepted_range:
              min_value: 0
    tests:
      - dbt_utils.unique_combination_of_columns:
          combination_of_columns: [symbol, trade_date]
```

### Custom Data Tests (SQL-Based)

#### Custom data test — assert index constituent weights sum to approximately 100%

```sql
-- tests/assert_weights_sum_to_100.sql
-- Fails if any index's constituent weights don't sum to approximately 100%

SELECT
    index_key,
    trade_date,
    SUM(weight_pct) AS total_weight,
    ABS(SUM(weight_pct) - 100.0) AS deviation
FROM {{ ref('fct_index_performance') }}
GROUP BY index_key, trade_date
HAVING ABS(SUM(weight_pct) - 100.0) > 0.5  -- 0.5% tolerance
```

#### Custom data test — no future trade dates allowed

```sql
-- tests/assert_no_future_dates.sql
SELECT *
FROM {{ ref('stg_yahoo_ohlcv') }}
WHERE trade_date > GETDATE()
```

> [!abstract] How dbt Tests Work
> A dbt test is a SQL query that **returns rows on failure**. If the query returns 0 rows, the test passes. If it returns any rows, the test fails. Custom tests in `tests/` are just SQL files — they can be as complex as your business rules require.

---

## Snapshots: SCD Type 2 with dbt

dbt snapshots implement [SCD Type 2](https://alp78.github.io/elysium/11-dbt/Advanced/dbt-snapshots-and-scd) automatically — tracking historical changes to dimension tables by adding `dbt_valid_from` and `dbt_valid_to` columns.

#### dbt snapshot for index constituents (SCD Type 2)

```sql
-- snapshots/snap_constituents.sql
{% snapshot snap_constituents %}

{{
    config(
        target_schema='silver',
        unique_key='symbol',
        strategy='check',
        check_cols=['index_key', 'shares_in_index', 'free_float_factor', 'cap_factor', 'sector'],
    )
}}

SELECT
    symbol,
    index_key,
    company_name,
    sector,
    country,
    shares_in_index,
    free_float_factor,
    cap_factor,
    SYSUTCDATETIME() AS snapshot_timestamp
FROM {{ source('bronze', 'index_constituents') }}

{% endsnapshot %}
```

Running `dbt snapshot` automatically:
1. Compares current source data against the snapshot table
2. If any `check_cols` changed for a symbol, closes the old record (`dbt_valid_to = now`)
3. Inserts a new record with the updated values (`dbt_valid_from = now, dbt_valid_to = NULL`)

> [!tip] Snapshot Strategies
> Two strategies available: `timestamp` (uses an `updated_at` column on the source) and `check` (compares specified columns). Use `check` when your source doesn't have a reliable `updated_at` column — it is more reliable but slower on large tables.

---

## Macros: Reusable SQL Logic

dbt macros are Jinja2 templates that generate SQL. They eliminate copy-paste across models and enforce consistent implementations of shared business logic.

#### Z-score macro — reusable statistical normalization

```sql
-- macros/z_score.sql
{% macro z_score(column, partition_col) %}
    ({{ column }} - AVG({{ column }}) OVER (PARTITION BY {{ partition_col }}))
    / NULLIF(STDEV({{ column }}) OVER (PARTITION BY {{ partition_col }}), 0)
{% endmacro %}

-- macros/weighted_harmonic_mean.sql
{% macro weighted_harmonic_mean(value_col, weight_col) %}
    SUM({{ weight_col }}) / NULLIF(SUM({{ weight_col }} / NULLIF({{ value_col }}, 0)), 0)
{% endmacro %}
```

#### Usage in any model

```sql
SELECT
    index_key,
    trade_date,
    {{ z_score('momentum_30d', 'trade_date') }} AS momentum_z,
    {{ weighted_harmonic_mean('pe_ratio', 'market_cap') }} AS harmonic_pe
FROM ...
```

> [!tip] When to Write a Macro
> Write a macro when the same SQL logic appears in 3+ models. Common macro candidates: z-score normalization, weighted averages, fiscal calendar functions, date spine generation. The `dbt-utils` package provides many common macros — check it before writing your own.

---

## dbt + Airflow Integration

dbt integrates with [Airflow](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-core-concepts) via `BashOperator` (simple) or the `DbtTaskGroup` from `astronomer-cosmos` (granular task-level control).

#### Airflow DAG integrating dbt into the daily data pipeline

```python
# Airflow DAG that runs dbt as part of the daily pipeline
from airflow import DAG
from airflow.operators.bash import BashOperator
from datetime import datetime

with DAG('pipeline_daily', schedule_interval='0 9,17,22 * * *', start_date=datetime(2025, 1, 1)) as dag:

    # Task 1: Python extracts and loads to bronze (existing Cloud Run jobs)
    extract_load = BashOperator(
        task_id='extract_load',
        bash_command='gcloud run jobs execute pipeline-daily-load --wait',
    )

    # Task 2: dbt transforms bronze → silver → gold
    dbt_run = BashOperator(
        task_id='dbt_run',
        bash_command='cd /opt/dbt_project && dbt run --select staging+ intermediate+ marts+',
    )

    # Task 3: dbt tests validate the output
    dbt_test = BashOperator(
        task_id='dbt_test',
        bash_command='cd /opt/dbt_project && dbt test',
    )

    # Task 4: Generate dbt docs (optional, for data catalog)
    dbt_docs = BashOperator(
        task_id='dbt_docs',
        bash_command='cd /opt/dbt_project && dbt docs generate',
    )

    extract_load >> dbt_run >> dbt_test >> dbt_docs
```

> [!warning] BashOperator vs Cosmos
> Using `BashOperator` wraps the entire `dbt run` as a single Airflow task — one failure stops everything. The `astronomer-cosmos` library explodes each dbt model into its own Airflow task, giving you granular retries, task-level SLAs, and visibility in the Airflow UI. For production pipelines with 20+ models, prefer Cosmos.

> [!success] Use Cosmos for Production dbt + Airflow Pipelines
>
> Install `astronomer-cosmos` and replace the single `BashOperator` dbt run with a `DbtTaskGroup`. Each dbt model becomes its own Airflow task with individual retry configuration, task-level SLA alerts, and a visual dependency graph in the Airflow UI. When a single model fails, only that model and its downstream dependents are retried — the upstream models that already ran successfully are not re-executed.

---

## dbt CI/CD: Slim Builds and State Comparison

#### GitHub Actions workflow for dbt CI on pull requests

```yaml
# .github/workflows/dbt-ci.yml
name: dbt CI

on:
  pull_request:
    paths: ['dbt_project/**']

jobs:
  dbt-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install dbt
        run: pip install dbt-sqlserver==1.8.*

      - name: dbt compile (syntax check)
        run: cd dbt_project && dbt compile --target ci

      - name: dbt test --select state:modified+
        run: |
          cd dbt_project
          # Download production manifest (state comparison)
          gsutil cp gs://data-pipeline-dbt-artifacts/manifest.json target/prod_manifest.json
          # Only test models changed in this PR
          dbt test --select state:modified+ --state target/prod_manifest.json --target ci
```

**State comparison** (`state:modified+`) is the key to fast CI: instead of testing all 50+ models, dbt only tests the models that changed in the PR and their downstream dependents. This turns a 15-minute CI run into a 2-minute run.

> [!tip] Publishing the Manifest
> After every successful production `dbt run`, save `target/manifest.json` to a shared location (GCS, S3). The CI pipeline downloads this manifest to determine which models have changed. Without the production manifest, state comparison cannot work.

---

### dbt Gotchas and Edge Cases

- **`ref()` vs `source()`:** Use `{{ source('schema', 'table') }}` for raw tables you don't own (bronze layer). Use `{{ ref('model_name') }}` for models defined in your dbt project. Mixing them up breaks the dependency graph.
- **`on_schema_change`:** When new columns are added to a model and the incremental table already exists, dbt defaults to ignoring new columns. Set `on_schema_change='sync_all_columns'` to auto-add them.
- **`dbt run --full-refresh`:** Running with `--full-refresh` drops and recreates all incremental tables. Never run this in production without warning — it can take hours on large tables.
- **Seeds are not ETL:** `seeds/` is for small, static reference tables (< 1MB CSV). For anything larger, use a proper pipeline to load it.
- **Snapshot `unique_key` must truly be unique:** If the source table has duplicates on the `unique_key`, the snapshot will fail with a merge conflict error. Add a deduplication CTE in the snapshot query.

## Related
- [idempotent-pipeline-design](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design) — the incremental load patterns dbt implements
- fastapi and polars — the EL layer that feeds the bronze tables dbt transforms
- [observability-deep-dive](https://alp78.github.io/elysium/13-Observability/Monitoring/observability-deep-dive) — monitoring dbt runs with DataDog
- [open-table-formats](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/open-table-formats) — Iceberg/Delta Lake as storage backends in a lakehouse architecture

## dbt Transformation Layer References
- [dbt Core documentation](https://docs.getdbt.com/)
- [dbt-utils package](https://hub.getdbt.com/dbt-labs/dbt_utils/latest/)
- [astronomer-cosmos (dbt + Airflow)](https://astronomer.github.io/astronomer-cosmos/)
- [dbt state comparison docs](https://docs.getdbt.com/reference/node-selection/methods#the-state-method)
