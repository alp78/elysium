---
tags: [pipeline, dbt]
type: how-to
technology: [dbt]
status: stable
updated: 2026-03-23
description: "Dispatch macros, adapter-conditional SQL, cross-adapter testing strategy, and a SQL Server to BigQuery migration guide."
related:
  - "[[dbt-sqlserver-adapter]]"
  - "[[dbt-bigquery-adapter]]"
  - "[[dbt-macros-and-jinja]]"
---

# dbt: Cross-Adapter Patterns

When a dbt project targets more than one database — or when the same codebase must run against dev (SQL Server) and prod (BigQuery) — adapter-specific SQL divergence becomes a maintenance problem. dbt provides two mechanisms to manage this: the **dispatch macro pattern** and **`target.type` conditional logic**. This note explains both, when to use each, and how to test across adapters.

---

## The Problem

Standard SQL diverges across adapters in predictable ways:

| Operation | SQL Server (T-SQL) | BigQuery (Standard SQL) |
|---|---|---|
| Current date | `CAST(GETDATE() AS DATE)` | `CURRENT_DATE()` |
| Date truncation | `DATEADD(month, DATEDIFF(month, 0, d), 0)` | `DATE_TRUNC(d, MONTH)` |
| Date arithmetic | `DATEADD(day, 7, d)` | `DATE_ADD(d, INTERVAL 7 DAY)` |
| Safe division | `numerator * 1.0 / NULLIF(denominator, 0)` | `SAFE_DIVIDE(numerator, denominator)` |
| String concat | `CONCAT(a, b)` or `a + b` | `CONCAT(a, b)` or `a || b` |
| Row limit | `TOP N` | `LIMIT N` |
| Boolean type | `BIT` (0/1) | `BOOL` |
| Regex | `LIKE` (no regex) | `REGEXP_CONTAINS(col, r'pattern')` |

Writing adapter-specific SQL directly in models creates invisible coupling between the model and the target adapter. The dispatch pattern breaks this coupling.

---

## The Dispatch Macro Pattern

dbt's `adapter.dispatch()` function selects a macro implementation based on the currently active adapter. The calling macro provides a fallback (default) implementation; adapter-specific packages or local macro folders provide overrides.

### Directory Structure

```
macros/
  cross_db/
    date_trunc.sql          -- default (fallback)
    bigquery/
      date_trunc.sql        -- BigQuery override
    sqlserver/
      date_trunc.sql        -- SQL Server override
    safe_divide.sql
    bigquery/
      safe_divide.sql
    sqlserver/
      safe_divide.sql
    date_add.sql
    bigquery/
      date_add.sql
    sqlserver/
      date_add.sql
```

Register the dispatch namespace in `dbt_project.yml`:

```yaml
# dbt_project.yml
dispatch:
  - macro_namespace: cross_db
    search_order: ['your_project', 'dbt_utils']
```

> [!note] dbt_utils already provides many cross-adapter macros
> `dbt-labs/dbt_utils` implements `date_trunc`, `dateadd`, `datediff`, `safe_divide`, `safe_cast`, and others. Before writing your own dispatch macros, check whether `dbt_utils` already covers the function. Write custom dispatch only for logic that `dbt_utils` does not provide or when you need different behavior than the dbt_utils implementation.

---

## Example: Date Truncation

### Default implementation (Postgres / DuckDB fallback)

```sql
-- macros/cross_db/date_trunc.sql
{% macro date_trunc(datepart, date) -%}
  {{ return(adapter.dispatch('date_trunc', 'cross_db')(datepart, date)) }}
{%- endmacro %}

{% macro default__date_trunc(datepart, date) -%}
  -- Standard SQL (Postgres, DuckDB, Snowflake)
  DATE_TRUNC('{{ datepart }}', {{ date }})
{%- endmacro %}
```

### BigQuery override

```sql
-- macros/cross_db/bigquery/date_trunc.sql
{% macro bigquery__date_trunc(datepart, date) -%}
  DATE_TRUNC({{ date }}, {{ datepart }})
  {#- BigQuery syntax: DATE_TRUNC(value, part) — no quotes around part -#}
{%- endmacro %}
```

### SQL Server override

```sql
-- macros/cross_db/sqlserver/date_trunc.sql
{% macro sqlserver__date_trunc(datepart, date) -%}
  {#- T-SQL has no DATE_TRUNC. Emulate with DATEADD/DATEDIFF trick. -#}
  {%- if datepart == 'month' -%}
    DATEADD(month, DATEDIFF(month, 0, {{ date }}), 0)
  {%- elif datepart == 'year' -%}
    DATEADD(year,  DATEDIFF(year,  0, {{ date }}), 0)
  {%- elif datepart == 'quarter' -%}
    DATEADD(quarter, DATEDIFF(quarter, 0, {{ date }}), 0)
  {%- elif datepart == 'week' -%}
    DATEADD(week, DATEDIFF(week, 0, {{ date }}), 0)
  {%- elif datepart == 'day' -%}
    CAST({{ date }} AS DATE)
  {%- else -%}
    {{ exceptions.raise_compiler_error(
        "date_trunc: unsupported datepart '" ~ datepart ~ "' for SQL Server"
    ) }}
  {%- endif -%}
{%- endmacro %}
```

### Usage in a model

```sql
-- models/int/int_esg_scores_monthly.sql
select
    {{ cross_db.date_trunc('month', 'score_date') }}  AS score_month,
    isin,
    provider_code,
    AVG(composite_score)                              AS avg_composite_score
from {{ ref('stg_esg_raw_scores') }}
group by 1, 2, 3
```

This model compiles correctly against both BigQuery and SQL Server without any adapter-specific SQL in the model file.

---

## Example: Safe Division

### Default implementation

```sql
-- macros/cross_db/safe_divide.sql
{% macro safe_divide(numerator, denominator) -%}
  {{ return(adapter.dispatch('safe_divide', 'cross_db')(numerator, denominator)) }}
{%- endmacro %}

{% macro default__safe_divide(numerator, denominator) -%}
  -- ANSI-compatible: works on Postgres, DuckDB, Snowflake
  CASE WHEN {{ denominator }} = 0 OR {{ denominator }} IS NULL
       THEN NULL
       ELSE {{ numerator }} * 1.0 / {{ denominator }}
  END
{%- endmacro %}
```

### BigQuery override

```sql
-- macros/cross_db/bigquery/safe_divide.sql
{% macro bigquery__safe_divide(numerator, denominator) -%}
  SAFE_DIVIDE({{ numerator }}, {{ denominator }})
{%- endmacro %}
```

### SQL Server override

```sql
-- macros/cross_db/sqlserver/safe_divide.sql
{% macro sqlserver__safe_divide(numerator, denominator) -%}
  {{ numerator }} * 1.0 / NULLIF({{ denominator }}, 0)
{%- endmacro %}
```

### Usage in a model

```sql
-- models/mart/mart_index_weights.sql
select
    isin,
    index_code,
    as_of_date,
    {{ cross_db.safe_divide('market_cap', 'total_index_market_cap') }} AS index_weight,
    {{ cross_db.safe_divide('esg_score', 'max_esg_score') }}            AS normalized_esg
from {{ ref('int_index_constituents_enriched') }}
```

---

## Example: Date Add

```sql
-- macros/cross_db/date_add.sql
{% macro date_add(datepart, number, date) -%}
  {{ return(adapter.dispatch('date_add', 'cross_db')(datepart, number, date)) }}
{%- endmacro %}

{% macro default__date_add(datepart, number, date) -%}
  {{ date }} + INTERVAL '{{ number }}' {{ datepart }}
{%- endmacro %}
```

```sql
-- macros/cross_db/bigquery/date_add.sql
{% macro bigquery__date_add(datepart, number, date) -%}
  DATE_ADD({{ date }}, INTERVAL {{ number }} {{ datepart | upper }})
{%- endmacro %}
```

```sql
-- macros/cross_db/sqlserver/date_add.sql
{% macro sqlserver__date_add(datepart, number, date) -%}
  DATEADD({{ datepart }}, {{ number }}, {{ date }})
{%- endmacro %}
```

---

## Using `target.type` for Conditional Logic

For one-off adapter differences that do not warrant a full dispatch macro, use `target.type` inline in model SQL.

```sql
-- models/staging/stg_esg_raw_scores.sql
select
    score_id,
    isin,
    provider_code,

    {% if target.type == 'bigquery' %}
      PARSE_DATE('%Y-%m-%d', raw_score_date)     AS score_date,
      SAFE_CAST(composite_score AS FLOAT64)       AS composite_score,
    {% elif target.type == 'sqlserver' %}
      TRY_CAST(raw_score_date AS DATE)            AS score_date,
      TRY_CAST(composite_score AS FLOAT)          AS composite_score,
    {% else %}
      CAST(raw_score_date AS DATE)                AS score_date,
      CAST(composite_score AS FLOAT)              AS composite_score,
    {% endif %}

    {% if target.type == 'bigquery' %}
      CURRENT_TIMESTAMP()                         AS loaded_at
    {% else %}
      CURRENT_TIMESTAMP                           AS loaded_at
    {% endif %}

from {{ source('esg_provider', 'raw_scores') }}
```

> [!warning] `target.type` in models is a code smell at scale
> Inline `target.type` branches work for 1-2 differences but become unmaintainable as divergence grows. If you find yourself writing 3+ `target.type` branches in a single model, extract the adapter-specific expressions into dispatch macros.

### `target.type` in schema tests

Useful when a test is only meaningful on one adapter:

```yaml
# models/mart/schema.yml
models:
  - name: mart_esg_scores
    columns:
      - name: composite_score
        tests:
          - not_null
          - dbt_utils.accepted_range:
              min_value: 0
              max_value: 100
              # BigQuery only: check for NaN (SQL Server FLOAT has no NaN)
              config:
                where: "{{ 'NOT IS_NAN(composite_score)' if target.type == 'bigquery' else '1=1' }}"
```

---

## When to Use Adapter Folders vs Dispatch

| Situation | Recommended approach |
|---|---|
| Reusable expression used in many models | Dispatch macro |
| One-off cast or function call | `target.type` inline |
| Completely different SQL structure between adapters | Separate model files in adapter-specific subfolders |
| Adapter-specific materialization options (partition_by, indexes) | Model config block with `target.type` |
| Utility macros called from other macros | Dispatch macro |

### Adapter-specific model folders

For models where the SQL is fundamentally different (not just a function name), use adapter subfolders and configure paths in `dbt_project.yml`:

```yaml
# dbt_project.yml
models:
  financial_index:
    mart:
      +enabled: true
    # Adapter-specific overrides live in adapter subfolders
    # Only one will be enabled per run based on target.type
```

Use an `enabled` conditional at the model level:

```sql
-- models/mart/bigquery/mart_esg_scores_nested.sql
{{
  config(
    enabled = (target.type == 'bigquery'),
    materialized = 'table'
  )
}}
-- Uses STRUCT/ARRAY — BigQuery only
select
    isin,
    score_date,
    STRUCT(environmental_score AS e, social_score AS s, governance_score AS g) AS esg
from {{ ref('int_esg_scores_validated') }}
```

---

## Testing Across Adapters

### CI matrix strategy (GitHub Actions)

```yaml
# .github/workflows/dbt-ci.yml
jobs:
  dbt-test:
    strategy:
      matrix:
        target: [sqlserver, bigquery]
    steps:
      - uses: actions/checkout@v4
      - name: Install dbt
        run: pip install dbt-core dbt-${{ matrix.target }}
      - name: dbt compile
        run: dbt compile --target ${{ matrix.target }} --profiles-dir ci/profiles
      - name: dbt run (slim)
        run: dbt run --target ${{ matrix.target }} --select state:modified+ --profiles-dir ci/profiles
      - name: dbt test
        run: dbt test --target ${{ matrix.target }} --profiles-dir ci/profiles
```

### Adapter-aware generic tests

Write generic tests that gracefully handle adapter differences:

```sql
-- tests/generic/assert_no_future_dates.sql
{% test assert_no_future_dates(model, column_name) %}

select *
from {{ model }}
where {{ column_name }} >
  {% if target.type == 'bigquery' %}
    CURRENT_DATE()
  {% elif target.type == 'sqlserver' %}
    CAST(GETDATE() AS DATE)
  {% else %}
    CURRENT_DATE
  {% endif %}

{% endtest %}
```

### Compile-time validation

Use `dbt compile` (not `dbt run`) in CI for adapters where you cannot provision a real database:

```bash
# Validate SQL Server SQL without a live instance
dbt compile --target sqlserver --profiles-dir ci/profiles --select marts

# Validate BigQuery SQL without spending slots
dbt compile --target bigquery --profiles-dir ci/profiles --select marts
```

`dbt compile` resolves all Jinja and dispatch macro calls, catching adapter-specific compilation errors without executing queries.

---

## Migration Guide: SQL Server to BigQuery

Moving a dbt project from SQL Server to BigQuery involves three categories of change: authentication, SQL syntax, and materialization config.

### Step 1 — Audit adapter-specific SQL

```bash
# Find all models with T-SQL-specific functions
grep -rn "GETDATE|ISNULL|DATEADD|DATEDIFF|CONVERT|TOP [0-9]" models/
grep -rn "NVARCHAR|BIGINT|BIT|DATETIME2" models/
grep -rn "sys\.|OBJECT_ID|INFORMATION_SCHEMA" macros/ models/
```

Create a migration checklist from the grep output. Each hit is a conversion task.

### Step 2 — Function mapping

| T-SQL | BigQuery Standard SQL | Notes |
|---|---|---|
| `GETDATE()` | `CURRENT_TIMESTAMP()` | Returns TIMESTAMP, not DATETIME |
| `CAST(GETDATE() AS DATE)` | `CURRENT_DATE()` | |
| `DATEADD(day, 7, d)` | `DATE_ADD(d, INTERVAL 7 DAY)` | |
| `DATEDIFF(day, d1, d2)` | `DATE_DIFF(d2, d1, DAY)` | Argument order reversed |
| `ISNULL(x, y)` | `IFNULL(x, y)` or `COALESCE(x, y)` | |
| `COALESCE(x, y)` | `COALESCE(x, y)` | Identical |
| `x / NULLIF(y, 0)` | `SAFE_DIVIDE(x, y)` | |
| `TOP N` | `LIMIT N` | |
| `NVARCHAR(n)` | `STRING` | BQ strings are always Unicode |
| `BIT` | `BOOL` | |
| `DATETIME2` | `TIMESTAMP` | |
| `CONVERT(VARCHAR, d, 112)` | `FORMAT_DATE('%Y%m%d', d)` | |
| `STRING_SPLIT(s, ',')` | `SPLIT(s, ',')` returns ARRAY | Different usage pattern |
| `TRY_CAST(x AS INT)` | `SAFE_CAST(x AS INT64)` | |
| `CHARINDEX(sub, str)` | `STRPOS(str, sub)` | Argument order reversed |
| `LEN(str)` | `LENGTH(str)` | |
| `STUFF(str, pos, len, rep)` | `CONCAT(SUBSTR(str,1,pos-1), rep, SUBSTR(str,pos+len))` | No direct equivalent |

### Step 3 — Incremental strategy migration

SQL Server `delete+insert` maps most directly to BigQuery `merge`. Map `unique_key` across:

```yaml
# SQL Server
config:
  materialized: incremental
  unique_key: score_id
  incremental_strategy: delete+insert

# BigQuery equivalent
config:
  materialized: incremental
  unique_key: score_id
  incremental_strategy: merge
  partition_by:
    field: score_date
    data_type: date
    granularity: month
```

Add `partition_by` and `cluster_by` at this stage — do not migrate without them or the BigQuery tables will be unpartitioned full-table-scan targets.

### Step 4 — Post-hook migration

SQL Server post-hook indexes have no direct equivalent in BigQuery (clustering is declared in config, not DDL). Remove all `CREATE INDEX` post-hooks and replace with `cluster_by` in the model config.

```sql
-- Remove from BigQuery models:
-- post_hook = ["CREATE NONCLUSTERED INDEX ..."]

-- Replace with config:
{{
  config(
    cluster_by = ["isin", "score_date"]
  )
}}
```

`UPDATE STATISTICS` post-hooks are also irrelevant — BigQuery manages statistics automatically.

### Step 5 — Schema and type migration

```python
# Mapping SQL Server schema.yml data_type to BigQuery
type_map = {
    "nvarchar":  "STRING",
    "varchar":   "STRING",
    "int":       "INT64",
    "bigint":    "INT64",
    "smallint":  "INT64",
    "decimal":   "NUMERIC",
    "float":     "FLOAT64",
    "bit":       "BOOL",
    "datetime2": "TIMESTAMP",
    "date":      "DATE",
    "time":      "TIME",
}
```

Update all `schema.yml` `data_type` fields using this mapping before running `dbt run` against BigQuery.

### Step 6 — Validation

```bash
# Run against BigQuery with --empty flag to validate SQL without loading data
dbt run --target bigquery --empty --select marts

# Run schema tests to confirm types are correct
dbt test --target bigquery --select marts

# Compare row counts between SQL Server and BigQuery for spot-check
dbt run-operation compare_row_counts --args '{"models": ["mart_esg_scores", "mart_index_weights"]}'
```

> [!tip] Migrate staging layer first
> Start the migration with staging models (simple SELECTs with casts), validate them, then move to intermediate, then mart. This incremental approach isolates issues at each layer and avoids debugging complex mart SQL before the source data is confirmed correct.

---

## Related

- [[dbt-sqlserver-adapter]]
- [[dbt-bigquery-adapter]]
- [[dbt-macros-and-jinja]]
