---
tags: [cheat-sheet, dbt]
type: cheat-sheet
technology: [dbt]
status: stable
updated: 2026-03-23
---

# dbt Cheat Sheet

## CLI Commands

| Command | Description |
|---------|-------------|
| `dbt run` | Execute all models |
| `dbt test` | Run all tests |
| `dbt build` | Run + test in DAG order |
| `dbt compile` | Compile Jinja to SQL (no execution) |
| `dbt debug` | Test connection and project setup |
| `dbt deps` | Install packages from packages.yml |
| `dbt seed` | Load CSV seed files |
| `dbt snapshot` | Run snapshot models (SCD Type 2) |
| `dbt docs generate` | Generate documentation site |
| `dbt docs serve` | Serve docs locally |
| `dbt source freshness` | Check source data freshness |
| `dbt ls` | List resources matching a selector |
| `dbt clean` | Remove target/ and packages/ |
| `dbt retry` | Re-run only failed models from last run |
| `dbt run --full-refresh` | Rebuild incremental models from scratch |

## Node Selection

| Selector | Meaning |
|----------|---------|
| `--select model_name` | Run one model |
| `--select +model_name` | Model + all upstream |
| `--select model_name+` | Model + all downstream |
| `--select +model_name+` | Model + upstream + downstream |
| `--select tag:critical` | Models tagged "critical" |
| `--select path:models/staging/` | Models in a folder |
| `--select source:yahoo+` | Source and all downstream |
| `--select state:modified+` | Changed models + downstream (slim CI) |
| `--exclude model_name` | Exclude from selection |

## Jinja Quick Reference

| Expression | Purpose |
|------------|---------|
| `{{ ref('model_name') }}` | Reference another model |
| `{{ source('src', 'table') }}` | Reference a source table |
| `{{ config(materialized='incremental') }}` | Set model config |
| `{{ this }}` | Current model's relation |
| `{{ target.name }}` | Current target (dev/prod) |
| `{{ target.type }}` | Adapter type (sqlserver/bigquery) |
| `{{ var('calc_date') }}` | Runtime variable |
| `{{ env_var('DB_PASSWORD') }}` | Environment variable |
| `{{ is_incremental() }}` | True if incremental run (not full-refresh) |
| `{% macro name(arg) %}...{% endmacro %}` | Define a macro |
| `{% if ... %}...{% endif %}` | Conditional |
| `{% for item in list %}...{% endfor %}` | Loop |

## Materialization Config

```yaml
# In model file or dbt_project.yml
{{ config(
    materialized='incremental',
    unique_key=['symbol', 'trade_date'],
    on_schema_change='sync_all_columns',
    partition_by={'field': 'trade_date', 'data_type': 'date'},  # BigQuery
    cluster_by=['symbol'],  # BigQuery
    post_hook="CREATE INDEX ix_sym_date ON {{ this }} (symbol, trade_date)"  # SQL Server
) }}
```

## Common Tests

```yaml
# In schema.yml
models:
  - name: fct_index_performance
    columns:
      - name: index_code
        tests: [not_null, unique]
      - name: calc_date
        tests: [not_null]
      - name: index_level
        tests:
          - not_null
          - dbt_utils.accepted_range:
              min_value: 0
              inclusive: false
    tests:
      - dbt_utils.unique_combination_of_columns:
          combination_of_columns: [index_code, calc_date]
```

## profiles.yml Templates

### SQL Server
```yaml
my_project:
  target: dev
  outputs:
    dev:
      type: sqlserver
      driver: "ODBC Driver 18 for SQL Server"
      server: localhost
      port: 1433
      database: analytics_db
      schema: dbt_dev
      user: "{{ env_var('SQL_USER') }}"
      password: "{{ env_var('SQL_PASSWORD') }}"
      trust_cert: true
      threads: 4
```

### BigQuery
```yaml
my_project:
  target: dev
  outputs:
    dev:
      type: bigquery
      method: service-account
      project: data-platform-prod
      dataset: dbt_dev
      threads: 8
      keyfile: "{{ env_var('GOOGLE_APPLICATION_CREDENTIALS') }}"
      location: EU
      maximum_bytes_billed: 1000000000  # 1 GB cost cap
```

## Related

- [[dbt-index]] — Full dbt section
- [[dbt-core-concepts]] — What dbt is and how it works
- [[dbt-cli-reference]] — Detailed CLI reference
- [[dbt-transformation-layer]] — Foundational overview
