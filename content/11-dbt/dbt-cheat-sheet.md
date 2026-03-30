---
tags: [pipeline, dbt]
type: cheat-sheet
technology: [dbt]
status: stable
updated: 2026-03-23
---

# dbt Cheat Sheet

### dbt CLI Anatomy

```
dbt [GLOBAL_FLAGS] COMMAND [COMMAND_FLAGS]
```

Global flags apply to every command and must appear before the command name. Command flags are command-specific and follow the command name.

---

### dbt Global Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--version` | bool | — | Print dbt version and exit |
| `--debug` / `-d` | bool | false | Print debug-level log output to stdout |
| `--log-format` | enum | `default` | Log output format: `default`, `json`, `text` |
| `--log-level` | enum | `info` | Minimum log level: `debug`, `info`, `warn`, `error`, `none` |
| `--log-path` | path | `logs/` | Directory for log files |
| `--log-file-format` | enum | `text` | Log file format: `text`, `json` |
| `--record-timing-info` | path | — | Write timing data to this file |
| `--no-print` | bool | false | Suppress `{{ print() }}` output in macros |
| `--warn-error` | bool | false | Treat all warnings as errors |
| `--warn-error-options` | dict | — | Fine-grained warn-as-error config (include/exclude lists) |
| `--no-version-check` | bool | false | Skip dbt version compatibility check |
| `--profiles-dir` | path | `~/.dbt/` | Directory containing `profiles.yml` |
| `--project-dir` | path | `./` | Root directory of the dbt project |
| `--target` / `-t` | string | profile default | Target name from `profiles.yml` |
| `--vars` | YAML dict | `{}` | Pass variables: `--vars '{"calc_date": "2025-12-31"}'` |
| `--threads` | int | profile setting | Override thread count for this invocation |
| `--no-partial-parse` | bool | false | Disable partial parsing (full re-parse) |
| `--no-use-colors` | bool | false | Disable ANSI color output |
| `--no-static-parser` | bool | false | Disable static parser, use full Jinja parse |
| `--macro-debugging` | bool | false | Enable macro-level Jinja debugging output |
| `--quiet` / `-q` | bool | false | Suppress non-error output to stdout |
| `--use-experimental-parser` | bool | false | Enable experimental static parser |
| `--introspect` | bool | true | Enable database introspection (relations, columns) |
| `--write-json` | bool | true | Write run artifacts (manifest, run_results) to `target/` |
| `--event-buffer-size` | int | 100000 | Max events held in memory before flushing |

---

## Core Commands

### `dbt run`

Executes compiled SQL for selected models against the target database.

```
dbt run [FLAGS]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--select` / `-s` | list | all models | Node selection syntax (see Node Selection section) |
| `--exclude` | list | — | Nodes to exclude from selection |
| `--selector` | string | — | Named selector from `selectors.yml` |
| `--defer` | bool | false | Resolve refs from a prior state artifact (slim CI) |
| `--favor-state` | bool | false | Prefer state artifact refs over current env (use with `--defer`) |
| `--state` | path | — | Path to prior run artifacts for `--defer` / `state:` selection |
| `--target` / `-t` | string | — | Override profile target |
| `--threads` | int | — | Override thread count |
| `--full-refresh` | bool | false | Drop and recreate incremental and snapshot tables |
| `--fail-fast` / `-x` | bool | false | Stop on first model failure |
| `--vars` | YAML dict | `{}` | Runtime variable overrides |
| `--empty` | bool | false | Compile and run models with `limit 0` (schema-only dry run) |
| `--event-time-start` | datetime | — | Filter microbatch models by event time window start |
| `--event-time-end` | datetime | — | Filter microbatch models by event time window end |

#### Examples — dbt run

```bash
# Run all models in the staging layer
dbt run --select path:models/staging/

# Run a specific model and all its downstream dependants
dbt run --select fct_index_performance+

# Incremental run with a variable override
dbt run --select tag:daily --vars '{"calc_date": "2025-12-31"}'

# Slim CI: only run models changed vs. production state
dbt run --select state:modified+ --defer --state ./prod-state/

# Full refresh for one model only
dbt run --select dim_security --full-refresh

# Fail fast on first error (useful in CI pipelines)
dbt run --fail-fast
```

---

### `dbt test`

Runs schema tests (defined in `.yml` files) and singular tests (`.sql` files in `tests/`).

```
dbt test [FLAGS]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--select` / `-s` | list | all tests | Node selection syntax |
| `--exclude` | list | — | Nodes to exclude |
| `--selector` | string | — | Named selector from `selectors.yml` |
| `--defer` | bool | false | Resolve upstream refs from state artifact |
| `--state` | path | — | Path to prior run artifacts |
| `--indirect-selection` | enum | `eager` | How to select tests for selected nodes: `eager`, `cautious`, `buildable`, `empty` |
| `--store-failures` | bool | false | Persist failing rows to a table in the database |
| `--store-failures-as` | enum | — | Override failure materialization: `table`, `view`, `ephemeral` |
| `--limit` | int | — | Limit rows returned per failing test |
| `--fail-fast` / `-x` | bool | false | Stop on first test failure |
| `--vars` | YAML dict | `{}` | Runtime variable overrides |
| `--threads` | int | — | Override thread count |

#### `--indirect-selection` values

| Value | Behavior |
|-------|----------|
| `eager` | Run tests that touch ANY selected node (default) |
| `cautious` | Only run tests where ALL referenced nodes are selected |
| `buildable` | Like cautious but also includes tests that can be deferred |
| `empty` | Run no tests regardless of selection |

#### Examples — dbt test

```bash
# Test only a specific model
dbt test --select fct_index_performance

# Test all sources
dbt test --select source:*

# Store failures for investigation
dbt test --store-failures --select tag:critical

# Run only not_null tests across the project
dbt test --select test_type:not_null
```

---

### `dbt build`

Runs seeds, snapshots, models, and tests together in DAG order. A model is tested immediately after it runs.

```
dbt build [FLAGS]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--select` / `-s` | list | all | Node selection (applies to all resource types) |
| `--exclude` | list | — | Nodes to exclude |
| `--selector` | string | — | Named selector |
| `--defer` | bool | false | Resolve upstream refs from state |
| `--favor-state` | bool | false | Prefer state artifact refs |
| `--state` | path | — | Path to prior run artifacts |
| `--full-refresh` | bool | false | Full refresh for incremental models and snapshots |
| `--fail-fast` / `-x` | bool | false | Stop on first failure |
| `--indirect-selection` | enum | `eager` | Test indirect selection mode |
| `--store-failures` | bool | false | Persist failing test rows |
| `--vars` | YAML dict | `{}` | Runtime variable overrides |
| `--threads` | int | — | Override thread count |
| `--resource-type` | list | all | Restrict to specific resource types |
| `--empty` | bool | false | Dry-run with `limit 0` |

#### Examples — dbt build

```bash
# Full CI build for a feature branch
dbt build --select state:modified+ --defer --state ./prod-state/

# Build only the mart layer
dbt build --select path:models/marts/

# Build with resource type restriction (models and tests only)
dbt build --select tag:daily --resource-type model --resource-type test
```

---

### `dbt compile`

Compiles Jinja-templated SQL to pure SQL and writes output to `target/compiled/`. Does not execute anything.

```
dbt compile [FLAGS]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--select` / `-s` | list | all models | Nodes to compile |
| `--exclude` | list | — | Nodes to exclude |
| `--selector` | string | — | Named selector |
| `--target` / `-t` | string | — | Override profile target |
| `--vars` | YAML dict | `{}` | Runtime variable overrides |
| `--no-introspect` | bool | false | Skip database introspection during compilation |
| `--inline` | string | — | Compile a Jinja string directly (no file needed) |
| `--parse-only` | bool | false | Parse project without compiling |
| `--threads` | int | — | Override thread count |

#### Examples — dbt compile

```bash
# Compile a single model to inspect generated SQL
dbt compile --select fct_index_performance

# Compile an inline expression (useful for debugging Jinja)
dbt compile --inline "{{ ref('dim_security') }}"
```

---

## Data Commands

### `dbt seed`

Loads CSV files from the `seeds/` directory into the database as tables.

```
dbt seed [FLAGS]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--select` / `-s` | list | all seeds | Seed files to load |
| `--exclude` | list | — | Seeds to exclude |
| `--full-refresh` | bool | false | Drop and recreate seed tables |
| `--show` | bool | false | Print first 5 rows of each seed |
| `--vars` | YAML dict | `{}` | Runtime variable overrides |
| `--threads` | int | — | Override thread count |
| `--selector` | string | — | Named selector |

#### Examples — dbt seed

```bash
# Load all seeds
dbt seed

# Reload a specific seed from scratch
dbt seed --select ref_exchange_codes --full-refresh
```

---

### `dbt snapshot`

Executes snapshot models in `snapshots/` to implement SCD Type 2 slowly-changing dimension tracking.

```
dbt snapshot [FLAGS]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--select` / `-s` | list | all snapshots | Snapshots to run |
| `--exclude` | list | — | Snapshots to exclude |
| `--target` / `-t` | string | — | Override profile target |
| `--vars` | YAML dict | `{}` | Runtime variable overrides |
| `--threads` | int | — | Override thread count |
| `--selector` | string | — | Named selector |

#### Examples — dbt snapshot

```bash
# Run all snapshots
dbt snapshot

# Run a specific snapshot
dbt snapshot --select snap_dim_security
```

---

### `dbt source freshness`

Checks whether source tables have been updated within the configured freshness thresholds.

```
dbt source freshness [FLAGS]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--select` / `-s` | list | all sources | Sources to check |
| `--exclude` | list | — | Sources to exclude |
| `--output` | path | — | Write freshness results JSON to this file |
| `--vars` | YAML dict | `{}` | Runtime variable overrides |
| `--threads` | int | — | Override thread count |
| `--selector` | string | — | Named selector |

#### Examples — dbt source freshness

```bash
# Check freshness for all sources
dbt source freshness

# Check freshness and save results for downstream processing
dbt source freshness --output ./target/sources.json

# Check a specific source
dbt source freshness --select source:bloomberg
```

---

## Documentation Commands

### `dbt docs generate`

Compiles project documentation and writes `manifest.json` and `catalog.json` to `target/`.

```
dbt docs generate [FLAGS]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--select` / `-s` | list | all | Nodes to include in catalog introspection |
| `--exclude` | list | — | Nodes to exclude from catalog |
| `--no-compile` | bool | false | Skip compilation step (use existing `manifest.json`) |
| `--vars` | YAML dict | `{}` | Runtime variable overrides |
| `--threads` | int | — | Override thread count |
| `--empty-catalog` | bool | false | Generate docs without querying the database for catalog info |

---

### `dbt docs serve`

Serves the generated documentation site locally using a built-in HTTP server.

```
dbt docs serve [FLAGS]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--profiles-dir` | path | `~/.dbt/` | Profiles directory |
| `--project-dir` | path | `./` | Project directory |
| `--port` | int | `8080` | Port to listen on |
| `--no-browser` | bool | false | Do not automatically open the browser |
| `--target-path` | path | `target/` | Directory containing compiled docs artifacts |

---

## Utility Commands

### `dbt debug`

Tests the database connection and validates `profiles.yml` and `dbt_project.yml`.

```
dbt debug [FLAGS]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--profiles-dir` | path | `~/.dbt/` | Directory containing `profiles.yml` |
| `--profile` | string | project default | Profile name to test |
| `--target` / `-t` | string | profile default | Target name to test |
| `--config-dir` | bool | false | Print the config directory path and exit |

---

### `dbt deps`

Downloads and installs packages declared in `packages.yml` or `dependencies.yml`.

```
dbt deps [FLAGS]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--lock` | bool | false | Write `package-lock.yml` without installing |
| `--upgrade` | bool | false | Re-resolve and upgrade all package versions |
| `--add-package` | string | — | Add a package to `packages.yml` and install it |

---

### `dbt clean`

Deletes the `target/` and `dbt_packages/` directories (configurable via `clean-targets` in `dbt_project.yml`).

```
dbt clean [FLAGS]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--project-dir` | path | `./` | Project root directory |
| `--profiles-dir` | path | `~/.dbt/` | Profiles directory |
| `--no-version-check` | bool | false | Skip dbt version check |

---

### `dbt init`

Scaffolds a new dbt project in the current directory.

```
dbt init [PROJECT_NAME] [FLAGS]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--skip-profile-setup` | bool | false | Do not prompt for profiles.yml setup |

---

### `dbt ls` / `dbt list`

Lists project resources matching a selection. Useful for validating selectors before running.

```
dbt ls [FLAGS]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--select` / `-s` | list | all | Node selection |
| `--exclude` | list | — | Nodes to exclude |
| `--selector` | string | — | Named selector |
| `--resource-type` | list | all | Filter by type: `model`, `test`, `source`, `snapshot`, `seed`, `exposure`, `metric`, `analysis` |
| `--output` | enum | `selector` | Output format: `selector`, `name`, `path`, `json` |
| `--output-keys` | list | — | JSON keys to output (use with `--output json`) |
| `--indirect-selection` | enum | `eager` | Test selection mode |
| `--vars` | YAML dict | `{}` | Runtime variable overrides |

#### Examples — dbt ls / dbt list

```bash
# List all models in the marts layer
dbt ls --select path:models/marts/ --resource-type model

# Validate a selector
dbt ls --select tag:daily+

# Output as JSON with specific keys
dbt ls --select path:models/staging/ --output json --output-keys name,config.materialized
```

---

### `dbt retry`

Re-runs the nodes from the most recent `dbt run` or `dbt build` invocation that failed or were skipped.

```
dbt retry [FLAGS]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--project-dir` | path | `./` | Project directory |
| `--profiles-dir` | path | `~/.dbt/` | Profiles directory |
| `--target` / `-t` | string | — | Override profile target |
| `--threads` | int | — | Override thread count |

---

### `dbt parse`

Parses the project and writes `manifest.json` to `target/`. Does not connect to the database.

```
dbt parse [FLAGS]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--project-dir` | path | `./` | Project directory |
| `--profiles-dir` | path | `~/.dbt/` | Profiles directory |
| `--write-manifest` | bool | true | Write `manifest.json` to `target/` |
| `--no-partial-parse` | bool | false | Full re-parse (ignore partial parse cache) |

---

### `dbt run-operation`

Executes a macro by name with optional arguments. Used for administrative tasks (e.g., granting permissions, dropping stale schemas).

```
dbt run-operation MACRO_NAME [FLAGS]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--args` | YAML dict | `{}` | Keyword arguments to pass to the macro |
| `--vars` | YAML dict | `{}` | Runtime variable overrides |
| `--target` / `-t` | string | — | Override profile target |

#### Examples — dbt run-operation

```bash
# Grant access to a schema after a build
dbt run-operation grant_select --args '{"schema": "analytics", "role": "reporting_role"}'

# Drop a stale dev schema
dbt run-operation drop_schema --args '{"schema_name": "dbt_dev_old"}'
```

---

## Node Selection Syntax

### Selection by Name

| Syntax | Matches |
|--------|---------|
| `model_name` | Exact model name |
| `fct_*` | Glob: all models starting with `fct_` |
| `*_performance` | Glob: all models ending with `_performance` |
| `*index*` | Glob: all models containing `index` |

### Selection by Path

| Syntax | Matches |
|--------|---------|
| `path:models/staging/` | All nodes under `models/staging/` |
| `path:models/marts/finance/` | All nodes in a subdirectory |
| `models/staging/stg_prices.sql` | Exact file path |

### Selection by Tag

| Syntax | Matches |
|--------|---------|
| `tag:daily` | Nodes tagged `daily` |
| `tag:critical` | Nodes tagged `critical` |

### Selection by Source

| Syntax | Matches |
|--------|---------|
| `source:bloomberg` | All tables in the `bloomberg` source |
| `source:bloomberg.prices` | A specific source table |
| `source:bloomberg+` | Source tables and all downstream models |

### Selection by Resource Type

| Syntax | Matches |
|--------|---------|
| `resource_type:model` | All models |
| `resource_type:test` | All tests |
| `resource_type:seed` | All seeds |
| `resource_type:snapshot` | All snapshots |
| `resource_type:exposure` | All exposures |
| `resource_type:metric` | All metrics |
| `resource_type:analysis` | All analyses |
| `resource_type:source` | All sources |

### Selection by Config

| Syntax | Matches |
|--------|---------|
| `config.materialized:incremental` | All incremental models |
| `config.materialized:table` | All table models |
| `config.schema:finance` | Models writing to the `finance` schema |
| `config.tags:daily` | Models with `daily` in their config tags |

### Selection by Test Name and Type

| Syntax | Matches |
|--------|---------|
| `test_name:not_null` | All `not_null` tests |
| `test_name:unique` | All `unique` tests |
| `test_name:accepted_values` | All `accepted_values` tests |
| `test_type:generic` | All generic (schema) tests |
| `test_type:singular` | All singular (SQL file) tests |

### Selection by State (Slim CI)

| Syntax | Matches |
|--------|---------|
| `state:new` | Nodes new since the state artifact |
| `state:modified` | Nodes with any change since state |
| `state:modified.body` | Nodes with SQL/Python changes |
| `state:modified.configs` | Nodes with config changes |
| `state:modified.persisted_descriptions` | Description changes affecting DB |
| `state:modified.relation` | Nodes whose relation identifier changed |
| `state:modified.macros` | Nodes using a modified macro |
| `state:old` | Nodes present in state but not current project |

### Selection by Package

| Syntax | Matches |
|--------|---------|
| `package:dbt_utils` | All nodes from `dbt_utils` |
| `package:my_project` | All nodes in the current project |

### Selection by Access, Group, and Version

| Syntax | Matches |
|--------|---------|
| `access:public` | Models with `access: public` |
| `access:protected` | Models with `access: protected` |
| `access:private` | Models with `access: private` |
| `group:finance` | Models in the `finance` group |
| `version:1` | Version 1 of a versioned model |
| `is_latest_version:true` | Latest version of each versioned model |

### Graph Operators

| Syntax | Meaning |
|--------|---------|
| `+model_name` | Model + all ancestors (upstream) |
| `model_name+` | Model + all descendants (downstream) |
| `+model_name+` | Model + all ancestors + all descendants |
| `1+model_name` | Model + 1 level of ancestors |
| `2+model_name` | Model + 2 levels of ancestors |
| `model_name+3` | Model + 3 levels of descendants |
| `@model_name` | Model + all ancestors + all tests of ancestors |

### Set Operators

| Syntax | Meaning |
|--------|---------|
| `--select a b` | Union: nodes matching `a` OR `b` |
| `--select a,b` | Intersection: nodes matching `a` AND `b` |
| `--select a --exclude b` | Nodes in `a` minus nodes in `b` |

#### Intersection example — Set Operators

```bash
# Incremental models that are also tagged daily
dbt run --select config.materialized:incremental,tag:daily
```

#### Union example — Set Operators

```bash
# Staging models OR models tagged critical
dbt run --select path:models/staging/ tag:critical
```

### Selector YAML (`selectors.yml`)

Reusable named selectors to avoid repeating complex selection strings.

```yaml
# selectors.yml
selectors:
  - name: critical_daily_pipeline
    description: "All daily-tagged models plus downstream, excluding dev-only models"
    default: false
    definition:
      union:
        - method: tag
          value: daily
        - method: tag
          value: critical
      exclude:
        - method: tag
          value: dev_only

  - name: modified_and_downstream
    description: "Slim CI selector"
    definition:
      union:
        - method: state
          value: modified
          children: true
        - method: state
          value: new
```

Usage:

```bash
dbt run --selector critical_daily_pipeline
dbt build --selector modified_and_downstream --state ./prod-state/
```

---

## Jinja Reference

### Variables

```jinja
{# Runtime variable defined via --vars or dbt_project.yml #}
{{ var('calc_date') }}
{{ var('calc_date', '2025-12-31') }}   {# with default value #}

{# Environment variable — raises error if missing #}
{{ env_var('DB_SCHEMA') }}

{# Environment variable with default #}
{{ env_var('FEATURE_FLAG', 'false') }}
```

### References

```jinja
{# Reference another model (creates DAG dependency) #}
{{ ref('fct_index_performance') }}

{# Reference a specific version of a model #}
{{ ref('dim_security', v=2) }}

{# Reference a model in another project (cross-project) #}
{{ ref('finance_platform', 'fct_trades') }}

{# Reference a source table #}
{{ source('bloomberg', 'raw_prices') }}

{# Reference a metric (MetricFlow) #}
{{ metric('index_total_return') }}
```

### `this` Object

`this` refers to the current model's relation. Only available in model files and hooks.

| Expression | Returns |
|------------|---------|
| `{{ this }}` | Full relation: `database.schema.identifier` |
| `{{ this.database }}` | Database name |
| `{{ this.schema }}` | Schema name |
| `{{ this.identifier }}` | Table / view name |
| `{{ this.name }}` | Alias for `this.identifier` |
| `{{ this.render() }}` | Rendered relation string |
| `{{ this.include(schema=false) }}` | Partial relation (e.g., `db..table`) |

### `target` Object

`target` reflects the active profile target.

| Expression | Returns |
|------------|---------|
| `{{ target.name }}` | Target name (e.g., `dev`, `prod`) |
| `{{ target.type }}` | Adapter type (e.g., `sqlserver`, `bigquery`) |
| `{{ target.schema }}` | Default schema |
| `{{ target.database }}` | Default database |
| `{{ target.threads }}` | Thread count |
| `{{ target.user }}` | Database user (if applicable) |
| `{{ target.project }}` | BigQuery project (BigQuery only) |
| `{{ target.dataset }}` | BigQuery dataset (BigQuery only) |

### `config()` and `config.get()`

```jinja
{# Set model configuration at the top of a model file #}
{{ config(
    materialized='incremental',
    unique_key=['symbol', 'calc_date'],
    on_schema_change='sync_all_columns',
    schema='finance',
    alias='fct_idx_perf',
    tags=['daily', 'critical'],
    meta={'owner': 'quant_team'},
    pre_hook="SET NOCOUNT ON",
    post_hook=[
        "GRANT SELECT ON {{ this }} TO reporting_role",
        "CREATE INDEX IF NOT EXISTS ix_sym_date ON {{ this }} (symbol, calc_date)"
    ]
) }}

{# Read a config value (with optional default) #}
{{ config.get('schema', 'default_schema') }}

{# Read a nested config value #}
{{ config.get('partition_by', {}) }}
```

### Incremental Pattern

```jinja
{{ config(
    materialized='incremental',
    unique_key='trade_id',
    incremental_strategy='merge'
) }}

SELECT
    trade_id,
    symbol,
    trade_date,
    notional_amount
FROM {{ source('execution_system', 'trades') }}

{% if is_incremental() %}
    {# Only load new rows since the last run #}
    WHERE trade_date > (
        SELECT MAX(trade_date)
        FROM {{ this }}
    )
{% endif %}
```

### Control Flow

```jinja
{# if / elif / else / endif #}
{% if target.name == 'prod' %}
    SELECT * FROM {{ source('bloomberg', 'prices') }}
{% elif target.name == 'staging' %}
    SELECT * FROM {{ source('bloomberg_staging', 'prices') }}
{% else %}
    SELECT * FROM {{ ref('seed_sample_prices') }}
{% endif %}

{# for / endfor #}
{% set columns = ['open', 'high', 'low', 'close', 'volume'] %}
{% for col in columns %}
    SUM({{ col }}) AS total_{{ col }}
    {{ "," if not loop.last }}
{% endfor %}

{# Loop variables #}
{# loop.index — 1-based index           #}
{# loop.index0 — 0-based index          #}
{# loop.first — true on first iteration #}
{# loop.last — true on last iteration   #}
{# loop.length — total loop count       #}

{# set — assign a variable #}
{% set reporting_schema = 'finance_reporting' %}
{% set price_cols = ['open', 'high', 'low', 'close'] %}

{# do — call a method without rendering output #}
{% set results = [] %}
{% do results.append('symbol') %}
{% do results.append('calc_date') %}
```

### Macros

```jinja
{# Define a macro in macros/*.sql #}
{% macro cents_to_dollars(column_name, scale=2) %}
    ROUND({{ column_name }} / 100.0, {{ scale }})
{% endmacro %}

{# Call a macro #}
{{ cents_to_dollars('notional_amount') }}
{{ cents_to_dollars('fee_amount', scale=4) }}

{# Macro with keyword arguments #}
{% macro generate_schema_name(custom_schema_name, node) -%}
    {%- set default_schema = target.schema -%}
    {%- if custom_schema_name is none -%}
        {{ default_schema }}
    {%- else -%}
        {{ default_schema }}_{{ custom_schema_name | trim }}
    {%- endif -%}
{%- endmacro %}

{# adapter.dispatch — polymorphic macros for multi-adapter support #}
{% macro generate_date_spine(start, end, interval) %}
    {{ return(adapter.dispatch('generate_date_spine', 'my_project')(start, end, interval)) }}
{% endmacro %}

{% macro sqlserver__generate_date_spine(start, end, interval) %}
    -- SQL Server implementation
{% endmacro %}

{% macro bigquery__generate_date_spine(start, end, interval) %}
    -- BigQuery implementation
{% endmacro %}
```

### Whitespace Control

```jinja
{# Strip whitespace before/after a block tag #}
{%- if condition -%}
    no extra newlines around this block
{%- endif -%}

{# Strip whitespace in expressions #}
{{- variable -}}
```

### Comments

```jinja
{# This is a Jinja comment — not rendered in compiled SQL #}
{# Multi-line comments
   are also supported #}
```

### Jinja Filters

```jinja
{{ 'symbol' | upper }}               {# 'SYMBOL' #}
{{ 'SYMBOL' | lower }}               {# 'symbol' #}
{{ '  symbol  ' | trim }}            {# 'symbol' #}
{{ 'sym_bol' | replace('_', ' ') }}  {# 'sym bol' #}
{{ some_value | default('N/A') }}    {# fallback if undefined or none #}
{{ col_list | join(', ') }}          {# 'open, high, low, close' #}
{{ col_list | length }}              {# 4 #}
{{ '42' | int }}                     {# 42 #}
{{ '3.14' | float }}                 {# 3.14 #}
{{ 42 | string }}                    {# '42' #}
{{ some_value | list }}              {# cast to list #}
{{ col_list | first }}               {# 'open' #}
{{ col_list | last }}                {# 'close' #}
{{ col_list | sort }}                {# alphabetically sorted list #}
{{ col_list | unique }}              {# deduplicated list #}
{{ col_list | reject('equalto', 'volume') | list }}  {# remove 'volume' #}
{{ col_list | select('match', '^price_') | list }}   {# filter by regex #}
{{ col_list | map('upper') | list }} {# apply filter to every element #}
{{ col_list | map(attribute='name') | list }}  {# extract attribute #}
{{ some_dict | tojson }}             {# serialize to JSON string #}
{{ '{"key": "val"}' | fromjson }}    {# parse JSON string to dict #}
```

### Jinja Tests

```jinja
{% if my_var is defined %}...{% endif %}
{% if my_var is not defined %}...{% endif %}
{% if my_var is none %}...{% endif %}
{% if my_var is not none %}...{% endif %}
{% if my_var is string %}...{% endif %}
{% if my_var is number %}...{% endif %}
{% if my_var is mapping %}...{% endif %}     {# dict-like #}
{% if my_var is iterable %}...{% endif %}    {# list, string, etc. #}
{% if my_var is sequence %}...{% endif %}
{% if col_list is not iterable %}...{% endif %}
```

### dbt-Specific Jinja Functions

```jinja
{# Print to logs (does not affect compiled SQL) #}
{{ log('Processing ' ~ symbol_count ~ ' symbols', info=true) }}

{# Raise a compiler error and halt #}
{{ exceptions.raise_compiler_error('calc_date var is required') }}

{# Warn without halting #}
{{ exceptions.warn('Deprecated macro called') }}

{# Return a value from a macro #}
{% macro get_schema() %}
    {{ return(target.schema ~ '_reporting') }}
{% endmacro %}

{# Serialize / deserialize JSON #}
{{ tojson({"key": "value"}) }}
{{ fromjson('{"key": "value"}') }}

{# Convert YAML string to object #}
{{ fromyaml('key: value') }}

{# Zip two lists together #}
{% for col, alias in zip(columns, aliases) %}
    {{ col }} AS {{ alias }}
{% endfor %}

{# builtins: access built-in dbt context #}
{{ builtins.ref('model_name') }}    {# call original ref inside an overridden ref() #}
```

### Adapter Methods

```jinja
{# Get column objects for a relation #}
{% set columns = adapter.get_columns_in_relation(ref('fct_index_performance')) %}

{# Check if a relation exists #}
{% if adapter.get_relation(database, schema, identifier) is not none %}
    -- relation exists
{% endif %}

{# Get the current database #}
{{ adapter.database() }}

{# Create a relation object #}
{% set my_relation = api.Relation.create(
    database='analytics',
    schema='finance',
    identifier='fct_trades'
) %}

{# Run a query during compilation (use sparingly) #}
{% set results = run_query('SELECT DISTINCT symbol FROM ref_symbols') %}
{% for row in results.rows %}
    '{{ row[0] }}'{{ "," if not loop.last }}
{% endfor %}
```

---

## YAML Schema Reference

### `schema.yml` — Models

```yaml
version: 2

models:
  - name: fct_index_performance
    description: >
      Daily index performance metrics calculated from constituent weights
      and price returns. One row per index per calculation date.
    docs:
      show: true
      node_color: "#1A73E8"
    access: public
    group: finance_core
    config:
      materialized: incremental
      unique_key: [index_code, calc_date]
      schema: finance
      tags: [daily, critical]
      meta:
        owner: quant_team
        sla: 06:00 UTC
    constraints:
      - type: not_null
        columns: [index_code, calc_date]
      - type: primary_key
        columns: [index_code, calc_date]
    tests:
      - dbt_utils.unique_combination_of_columns:
          combination_of_columns: [index_code, calc_date]
    columns:
      - name: index_code
        description: "Bloomberg index ticker (e.g., SPX, NDX)"
        data_type: varchar
        constraints:
          - type: not_null
        tests:
          - not_null
          - relationships:
              to: ref('dim_index')
              field: index_code
      - name: calc_date
        description: "Calculation date (business day)"
        data_type: date
        tests:
          - not_null
      - name: index_level
        description: "Closing index level"
        data_type: float
        tests:
          - not_null
          - dbt_utils.accepted_range:
              min_value: 0
              inclusive: false
      - name: daily_return
        description: "Daily total return as a decimal (0.01 = 1%)"
        data_type: float
      - name: ytd_return
        description: "Year-to-date total return as a decimal"
        data_type: float

  - name: dim_security
    description: "Security master dimension with SCD Type 2 history"
    config:
      materialized: table
      tags: [dimension]
    versions:
      - v: 1
        defined_in: dim_security_v1
      - v: 2
        defined_in: dim_security_v2
    latest_version: 2
```

### `schema.yml` — Sources

```yaml
version: 2

sources:
  - name: bloomberg
    description: "Bloomberg raw market data feeds"
    database: raw_db
    schema: bloomberg_raw
    loader: airbyte
    loaded_at_field: _loaded_at
    freshness:
      warn_after:
        count: 6
        period: hour
      error_after:
        count: 12
        period: hour
    meta:
      vendor: Bloomberg LP
      data_classification: market_data
    tags: [source, bloomberg]
    tables:
      - name: prices
        description: "End-of-day price data for all securities"
        loaded_at_field: price_date   # override source-level setting
        freshness:
          warn_after: {count: 1, period: day}
          error_after: {count: 2, period: day}
        columns:
          - name: isin
            description: "International Securities Identification Number"
            tests:
              - not_null
              - unique
          - name: price_date
            tests: [not_null]
          - name: close_price
            tests: [not_null]
        tests:
          - dbt_utils.unique_combination_of_columns:
              combination_of_columns: [isin, price_date]

      - name: index_compositions
        description: "Daily index constituent weights"
        identifier: idx_compositions   # actual table name differs from source name
        columns:
          - name: index_code
            tests: [not_null]
          - name: isin
            tests: [not_null]
          - name: weight
            tests:
              - not_null
              - dbt_utils.accepted_range:
                  min_value: 0
                  max_value: 1
                  inclusive: true
```

### `schema.yml` — Exposures

```yaml
version: 2

exposures:
  - name: index_performance_dashboard
    description: "Tableau dashboard showing daily index performance for portfolio managers"
    type: dashboard          # dashboard, notebook, analysis, ml, application
    maturity: high           # high, medium, low
    url: "https://tableau.firm.com/views/IndexPerformance"
    owner:
      name: Quant Analytics Team
      email: quant-analytics@firm.com
    depends_on:
      - ref('fct_index_performance')
      - ref('dim_index')
      - ref('dim_security')

  - name: risk_attribution_notebook
    description: "Python notebook for factor risk attribution analysis"
    type: notebook
    maturity: medium
    owner:
      name: Risk Team
      email: risk@firm.com
    depends_on:
      - ref('fct_factor_exposures')
      - ref('fct_index_performance')

  - name: portfolio_analytics_app
    description: "Internal web application for portfolio construction"
    type: application
    maturity: high
    url: "https://portfolio-analytics.firm.internal"
    owner:
      name: Engineering
      email: engineering@firm.com
    depends_on:
      - ref('mart_portfolio_summary')
      - source('bloomberg', 'prices')
```

### Built-in Generic Tests

| Test | Arguments | Description |
|------|-----------|-------------|
| `not_null` | `where` (optional) | Column has no NULL values |
| `unique` | `where` (optional) | Column has no duplicate values |
| `accepted_values` | `values`, `quote` (bool), `where` | Column only contains values from the list |
| `relationships` | `to`, `field`, `where` | Foreign key integrity check |

#### Full syntax examples — Built-in Generic Tests

```yaml
columns:
  - name: status
    tests:
      - not_null:
          where: "trade_date >= '2024-01-01'"
      - unique:
          where: "is_active = 1"
      - accepted_values:
          values: ['OPEN', 'CLOSED', 'CANCELLED', 'SETTLED']
          quote: true
  - name: index_code
    tests:
      - relationships:
          to: ref('dim_index')
          field: index_code
          where: "calc_date >= '2024-01-01'"
```

### `dbt-utils` Common Tests

| Test | Description |
|------|-------------|
| `dbt_utils.unique_combination_of_columns` | Composite unique key check |
| `dbt_utils.accepted_range` | Numeric value within `min_value`/`max_value` bounds |
| `dbt_utils.not_empty_string` | Column is not null and not an empty string |
| `dbt_utils.at_least_one` | At least one row satisfies the condition |
| `dbt_utils.equal_rowcount` | Two models have the same row count |
| `dbt_utils.fewer_rows_than` | Model has fewer rows than a reference model |
| `dbt_utils.not_constant` | Column has more than one distinct value |
| `dbt_utils.not_null_proportion` | Fraction of non-null values exceeds threshold |
| `dbt_utils.relationships_where` | Relationships test with filter conditions on both models |
| `dbt_utils.mutually_exclusive_ranges` | Date or numeric ranges do not overlap |

### `dbt-expectations` Common Tests

| Test | Description |
|------|-------------|
| `dbt_expectations.expect_column_values_to_be_between` | Values between `min_value` and `max_value` |
| `dbt_expectations.expect_column_values_to_match_regex` | Values match a regex pattern |
| `dbt_expectations.expect_column_values_to_be_in_set` | Values in an allowed set |
| `dbt_expectations.expect_table_row_count_to_be_between` | Row count within bounds |
| `dbt_expectations.expect_column_mean_to_be_between` | Column mean within bounds |
| `dbt_expectations.expect_column_pair_values_to_be_equal` | Two columns are equal |

---

## Materialization Config Reference

### Common Config Options (All Materializations)

| Key | Type | Description |
|-----|------|-------------|
| `materialized` | string | `table`, `view`, `incremental`, `ephemeral`, `materialized_view` |
| `schema` | string | Custom schema suffix (appended to `target.schema`) |
| `alias` | string | Override the table/view name in the database |
| `database` | string | Override the database (not supported on all adapters) |
| `tags` | list | Labels for node selection and documentation |
| `meta` | dict | Arbitrary metadata (surfaced in `manifest.json` and docs) |
| `enabled` | bool | Whether the model is included in the DAG (default: `true`) |
| `docs.show` | bool | Whether the model appears in `dbt docs` site |
| `docs.node_color` | string | Color in the lineage graph (hex or CSS color) |
| `pre_hook` | string/list | SQL to run before the model executes |
| `post_hook` | string/list | SQL to run after the model executes |
| `grants` | dict | Column/table-level grant definitions |
| `contract.enforced` | bool | Whether the model contract (column types/constraints) is enforced |
| `access` | string | `public`, `protected`, `private` |
| `group` | string | Logical group for access control |
| `persist_docs` | dict | Persist descriptions to the database (`{relation: true, columns: true}`) |
| `on_schema_change` | string | See incremental section |

### `table` and `view`

```yaml
{{ config(
    materialized='table',    # or 'view'
    schema='finance',
    alias='dim_security_master',
    tags=['dimension', 'daily'],
    pre_hook="TRUNCATE TABLE {{ this }}",
    post_hook=[
        "GRANT SELECT ON {{ this }} TO reporting_role",
        "UPDATE audit_log SET last_built = GETDATE() WHERE object_name = '{{ this.identifier }}'"
    ],
    persist_docs={"relation": true, "columns": true}
) }}
```

### `ephemeral`

Ephemeral models are compiled as CTEs inline into their dependants. They do not create a database object.

```yaml
{{ config(materialized='ephemeral') }}
```

### `incremental`

| Key | Type | Options / Description |
|-----|------|-----------------------|
| `unique_key` | string or list | Column(s) that identify a unique row |
| `incremental_strategy` | string | `append`, `merge`, `delete+insert`, `insert_overwrite` (adapter-dependent) |
| `on_schema_change` | string | `ignore`, `fail`, `append_new_columns`, `sync_all_columns` |
| `incremental_predicates` | list | Extra WHERE clauses applied to the target table during merge (performance optimization) |
| `merge_exclude_columns` | list | Columns to exclude from the UPDATE part of a merge |
| `merge_update_columns` | list | Columns to include in the UPDATE part of a merge (mutually exclusive with `merge_exclude_columns`) |
| `full_refresh` | bool | If `false`, prevents `--full-refresh` from rebuilding this model |

#### `incremental_strategy` support by adapter

| Strategy | SQL Server | BigQuery | Notes |
|----------|-----------|----------|-------|
| `append` | Yes | Yes | No deduplication |
| `merge` | Yes | Yes | Requires `unique_key` |
| `delete+insert` | Yes | No | Delete matching rows then insert |
| `insert_overwrite` | No | Yes | Overwrites entire partitions |

```yaml
{{ config(
    materialized='incremental',
    unique_key=['index_code', 'calc_date'],
    incremental_strategy='merge',
    on_schema_change='sync_all_columns',
    incremental_predicates=[
        "DBT_INTERNAL_DEST.calc_date >= DATEADD(day, -7, GETDATE())"
    ],
    merge_update_columns=['index_level', 'daily_return', 'ytd_return']
) }}
```

### BigQuery-Specific Config

| Key | Type | Description |
|-----|------|-------------|
| `partition_by` | dict | Partition configuration (see below) |
| `cluster_by` | string or list | Clustering columns (up to 4) |
| `require_partition_filter` | bool | Require a partition filter on every query |
| `partition_expiration_days` | int | Auto-expire partitions after N days |
| `labels` | dict | BigQuery resource labels (key-value pairs) |
| `maximum_bytes_billed` | int | Abort query if bytes billed would exceed this |
| `enable_refresh` | bool | Enable automatic refresh of materialized views |
| `refresh_interval_minutes` | int | Materialized view refresh interval |
| `hours_to_expiration` | int | Table expiration time in hours |
| `kms_key_name` | string | Customer-managed encryption key |
| `copy_partitions` | bool | Use copy-based partition overwrite strategy |
| `merge_update_columns` | list | Columns to update during merge |

#### `partition_by` dict fields

| Key | Type | Values / Description |
|-----|------|---------------------|
| `field` | string | Column to partition on |
| `data_type` | string | `date`, `timestamp`, `datetime`, `int64` |
| `granularity` | string | For date/timestamp: `hour`, `day`, `month`, `year` |
| `range` | dict | For `int64`: `{start, end, interval}` |

```yaml
{{ config(
    materialized='incremental',
    incremental_strategy='insert_overwrite',
    partition_by={
        'field': 'calc_date',
        'data_type': 'date',
        'granularity': 'day'
    },
    cluster_by=['index_code', 'symbol'],
    require_partition_filter=true,
    labels={
        'team': 'quant',
        'environment': env_var('ENV', 'dev')
    },
    maximum_bytes_billed=10000000000
) }}
```

### SQL Server-Specific Config

| Key | Type | Description |
|-----|------|-------------|
| `as_columnstore` | bool | Create as a clustered columnstore index (table materialization) |
| `index` | list | Non-clustered index definitions |
| `file_format` | string | File format for external tables |
| `location_root` | string | Location root for external tables |

```yaml
{{ config(
    materialized='table',
    as_columnstore=true,
    post_hook="CREATE NONCLUSTERED INDEX ix_symbol ON {{ this }} (symbol) INCLUDE (calc_date, close_price)"
) }}
```

---

## `profiles.yml` Reference

The `profiles.yml` file lives at `~/.dbt/profiles.yml` by default (override with `--profiles-dir`).

### Top-Level Structure

```yaml
profile_name:
  target: dev          # default target name
  outputs:
    dev:
      type: adapter_type
      # ... connection fields
    prod:
      type: adapter_type
      # ... connection fields
```

### SQL Server Target (`dbt-sqlserver`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Must be `sqlserver` |
| `driver` | string | Yes | ODBC driver name (e.g., `ODBC Driver 18 for SQL Server`) |
| `server` | string | Yes | Hostname or IP of the SQL Server instance |
| `port` | int | Yes | Port (default `1433`) |
| `database` | string | Yes | Target database name |
| `schema` | string | Yes | Default schema |
| `user` | string | Conditional | SQL auth username |
| `password` | string | Conditional | SQL auth password |
| `windows_login` | bool | No | Use Windows Authentication (mutually exclusive with user/password) |
| `authentication` | string | No | Auth method: `sql`, `Windows`, `ActiveDirectoryPassword`, `ActiveDirectoryInteractive`, `ActiveDirectoryIntegrated`, `ActiveDirectoryServicePrincipal`, `ActiveDirectoryMSI`, `ActiveDirectoryDefault` |
| `tenant_id` | string | No | Azure AD tenant ID (required for some AAD auth methods) |
| `client_id` | string | No | Azure AD app client ID (service principal) |
| `client_secret` | string | No | Azure AD app client secret (service principal) |
| `trust_cert` | bool | No | Trust the server's SSL certificate (`TrustServerCertificate=Yes`) |
| `encrypt` | bool | No | Encrypt the connection (default: `true` for driver 18+) |
| `threads` | int | Yes | Max concurrent dbt threads |
| `schema_authorization` | string | No | Principal to authorize schema creation to |
| `retries` | int | No | Number of connection retry attempts |

```yaml
my_finance_project:
  target: dev
  outputs:
    dev:
      type: sqlserver
      driver: "ODBC Driver 18 for SQL Server"
      server: "{{ env_var('SQL_SERVER_HOST') }}"
      port: 1433
      database: analytics_dev
      schema: dbt_dev
      user: "{{ env_var('SQL_USER') }}"
      password: "{{ env_var('SQL_PASSWORD') }}"
      trust_cert: true
      encrypt: true
      threads: 4
      retries: 3

    prod:
      type: sqlserver
      driver: "ODBC Driver 18 for SQL Server"
      server: "{{ env_var('SQL_SERVER_HOST_PROD') }}"
      port: 1433
      database: analytics_prod
      schema: dbt_prod
      authentication: ActiveDirectoryServicePrincipal
      tenant_id: "{{ env_var('AZURE_TENANT_ID') }}"
      client_id: "{{ env_var('AZURE_CLIENT_ID') }}"
      client_secret: "{{ env_var('AZURE_CLIENT_SECRET') }}"
      trust_cert: false
      encrypt: true
      threads: 16
      retries: 3
```

### BigQuery Target (`dbt-bigquery`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Must be `bigquery` |
| `method` | string | Yes | Auth method: `oauth`, `service-account`, `service-account-json`, `oauth-secrets`, `impersonation` |
| `project` | string | Yes | GCP project ID |
| `dataset` | string | Yes | Default BigQuery dataset (maps to dbt schema) |
| `threads` | int | Yes | Max concurrent dbt threads |
| `keyfile` | path | Conditional | Path to service account JSON key file |
| `keyfile_json` | dict | Conditional | Inline service account JSON (use `env_var`) |
| `token` | string | Conditional | OAuth access token (`oauth-secrets` method) |
| `refresh_token` | string | Conditional | OAuth refresh token |
| `client_id` | string | Conditional | OAuth client ID |
| `client_secret` | string | Conditional | OAuth client secret |
| `token_uri` | string | No | OAuth token endpoint URI |
| `location` | string | No | BigQuery region/multi-region (e.g., `EU`, `US`, `europe-west2`) |
| `maximum_bytes_billed` | int | No | Hard cost cap in bytes; query aborted if exceeded |
| `timeout_seconds` | int | No | Query timeout in seconds |
| `retries` | int | No | Retry attempts on transient failures (default: `1`) |
| `priority` | string | No | Query priority: `interactive` (default), `batch` |
| `impersonate_service_account` | string | No | Service account email to impersonate |
| `job_creation_timeout_seconds` | int | No | Timeout for BigQuery job creation |
| `job_retry_deadline_seconds` | int | No | Total retry window for failed jobs |
| `gcs_bucket` | string | No | GCS bucket for loading seed files |
| `dataproc_region` | string | No | Dataproc region for Python models |
| `dataproc_cluster_name` | string | No | Dataproc cluster for Python models |
| `submission_method` | string | No | Python model execution: `serverless`, `cluster` |
| `execution_project` | string | No | GCP project to bill for queries (if different from `project`) |

```yaml
my_finance_project:
  target: dev
  outputs:
    dev:
      type: bigquery
      method: service-account
      project: data-platform-dev
      dataset: dbt_dev
      threads: 8
      keyfile: "{{ env_var('GOOGLE_APPLICATION_CREDENTIALS') }}"
      location: EU
      maximum_bytes_billed: 1000000000   # 1 GB cost cap for dev
      timeout_seconds: 300
      retries: 3
      priority: interactive

    prod:
      type: bigquery
      method: service-account-json
      project: data-platform-prod
      dataset: dbt_prod
      threads: 32
      keyfile_json: "{{ env_var('GCP_SA_KEY_JSON') | fromjson }}"
      location: EU
      maximum_bytes_billed: 100000000000  # 100 GB cost cap for prod
      timeout_seconds: 900
      retries: 5
      priority: interactive
      execution_project: billing-project-id
```

---

### dbt_project.yml Key Fields

```yaml
name: my_finance_project
version: "1.0.0"
config-version: 2

profile: my_finance_project

model-paths: ["models"]
analysis-paths: ["analyses"]
test-paths: ["tests"]
seed-paths: ["seeds"]
macro-paths: ["macros"]
snapshot-paths: ["snapshots"]
docs-paths: ["docs"]
asset-paths: ["assets"]

target-path: "target"
log-path: "logs"
packages-install-path: "dbt_packages"
clean-targets: ["target", "dbt_packages"]

require-dbt-version: [">=1.7.0", "<2.0.0"]

vars:
  calc_date: "{{ run_started_at.strftime('%Y-%m-%d') }}"
  environment: dev

on-run-start:
  - "SET NOCOUNT ON"
  - "{{ create_audit_log_entry() }}"

on-run-end:
  - "{{ update_audit_log_entry() }}"
  - "GRANT SELECT ON SCHEMA::{{ target.schema }} TO reporting_role"

dispatch:
  - macro_namespace: dbt_utils
    search_order: [my_finance_project, dbt_utils]

models:
  my_finance_project:
    +persist_docs:
      relation: true
      columns: true
    staging:
      +materialized: view
      +tags: [staging]
      +schema: staging
    intermediate:
      +materialized: ephemeral
      +tags: [intermediate]
    marts:
      +materialized: table
      +tags: [marts]
      +schema: finance
      finance:
        +tags: [finance, daily]

seeds:
  my_finance_project:
    +schema: reference_data
    +tags: [seed]
    +column_types:
      isin: varchar(12)
      cusip: varchar(9)

snapshots:
  my_finance_project:
    +schema: snapshots
    +strategy: timestamp
    +updated_at: updated_at

tests:
  my_finance_project:
    +store_failures: false
    +severity: error
```

---

## Snapshot Configuration

```jinja
{# snapshots/snap_dim_security.sql #}
{% snapshot snap_dim_security %}

{{ config(
    target_schema='snapshots',
    unique_key='isin',
    strategy='timestamp',     -- 'timestamp' or 'check'
    updated_at='updated_at',  -- for strategy='timestamp'
    -- check_cols=['name', 'sector', 'currency'],  -- for strategy='check'
    -- check_cols='all',  -- check all columns
    invalidate_hard_deletes=true
) }}

SELECT
    isin,
    security_name,
    sector,
    currency,
    exchange,
    updated_at
FROM {{ source('security_master', 'securities') }}

{% endsnapshot %}
```

#### Snapshot columns added by dbt

| Column | Description |
|--------|-------------|
| `dbt_scd_id` | Unique surrogate key for each version record |
| `dbt_updated_at` | Timestamp when this record was last evaluated |
| `dbt_valid_from` | Start of this record's validity period |
| `dbt_valid_to` | End of validity period (NULL = current record) |

---

### dbt Run Artifacts

| File | Contents |
|------|----------|
| `target/manifest.json` | Full project graph: all nodes, sources, macros, metadata |
| `target/run_results.json` | Results of the most recent invocation (status, timing, adapter response) |
| `target/catalog.json` | Database catalog: columns and stats for all relations (generated by `dbt docs generate`) |
| `target/sources.json` | Source freshness results (generated by `dbt source freshness`) |
| `target/partial_parse.msgpack` | Partial parse cache for faster re-parsing |
| `target/semantic_manifest.json` | MetricFlow semantic layer manifest |
| `logs/dbt.log` | Detailed run log |

---

### packages.yml Reference

```yaml
packages:
  - package: dbt-labs/dbt_utils
    version: [">=1.2.0", "<2.0.0"]

  - package: calogica/dbt_expectations
    version: [">=0.10.0", "<1.0.0"]

  - package: dbt-labs/audit_helper
    version: [">=0.9.0", "<1.0.0"]

  - package: dbt-labs/codegen
    version: [">=0.12.0", "<1.0.0"]

  # Private / git packages
  - git: "https://github.com/my-org/dbt-internal-utils.git"
    revision: "v1.3.0"    # tag, branch, or commit SHA

  # Local package
  - local: ../shared_dbt_macros
```

---

## Useful Macro Patterns

### Dynamic Schema Override

```jinja
{# macros/generate_schema_name.sql #}
{% macro generate_schema_name(custom_schema_name, node) -%}
    {%- set default_schema = target.schema -%}
    {%- if custom_schema_name is none -%}
        {{ default_schema }}
    {%- elif target.name == 'prod' -%}
        {{ custom_schema_name | trim }}
    {%- else -%}
        {{ default_schema }}_{{ custom_schema_name | trim }}
    {%- endif -%}
{%- endmacro %}
```

### Grant Select After Build

```jinja
{# macros/grant_select.sql #}
{% macro grant_select(schema, role) %}
    {% set sql %}
        GRANT SELECT ON ALL TABLES IN SCHEMA {{ schema }} TO {{ role }};
    {% endset %}
    {% do run_query(sql) %}
    {{ log("Granted SELECT on " ~ schema ~ " to " ~ role, info=true) }}
{% endmacro %}
```

### Column-Level Hashing (Pseudonymisation)

```jinja
{# macros/hash_pii.sql #}
{% macro hash_pii(column_name) %}
    {%- if target.name == 'dev' -%}
        SHA2(CAST({{ column_name }} AS VARCHAR), 256)
    {%- else -%}
        {{ column_name }}
    {%- endif -%}
{% endmacro %}
```

### Date Spine (SQL Server)

```jinja
{# macros/date_spine_sqlserver.sql #}
{% macro date_spine_sqlserver(start_date, end_date) %}
    WITH dates AS (
        SELECT CAST('{{ start_date }}' AS DATE) AS d
        UNION ALL
        SELECT DATEADD(day, 1, d)
        FROM dates
        WHERE d < CAST('{{ end_date }}' AS DATE)
    )
    SELECT d AS date_day FROM dates
    OPTION (MAXRECURSION 0)
{% endmacro %}
```

---

## Common Patterns

### Incremental with Partition Pruning (BigQuery)

```jinja
{{ config(
    materialized='incremental',
    incremental_strategy='insert_overwrite',
    partition_by={'field': 'calc_date', 'data_type': 'date', 'granularity': 'day'},
    cluster_by=['index_code']
) }}

SELECT
    index_code,
    calc_date,
    index_level,
    daily_return
FROM {{ source('bloomberg', 'index_levels') }}

{% if is_incremental() %}
    WHERE calc_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 3 DAY)
{% endif %}
```

### Incremental with Merge (SQL Server)

```jinja
{{ config(
    materialized='incremental',
    unique_key=['index_code', 'calc_date'],
    incremental_strategy='merge',
    on_schema_change='sync_all_columns',
    incremental_predicates=[
        "DBT_INTERNAL_DEST.calc_date >= DATEADD(day, -3, GETDATE())"
    ]
) }}

SELECT
    index_code,
    calc_date,
    index_level,
    CAST(daily_return AS FLOAT) AS daily_return
FROM {{ source('bloomberg', 'index_levels') }}

{% if is_incremental() %}
    WHERE calc_date >= CAST(DATEADD(day, -3, GETDATE()) AS DATE)
{% endif %}
```

### Environment-Conditional Source

```jinja
{% if target.name == 'prod' %}
    {{ source('bloomberg', 'prices') }}
{% else %}
    {{ ref('seed_sample_prices') }}
{% endif %}
```

### Dynamic Column Generation

```jinja
{% set currency_codes = ['USD', 'EUR', 'GBP', 'JPY', 'CHF'] %}

SELECT
    index_code,
    calc_date,
    base_level_usd
    {% for ccy in currency_codes if ccy != 'USD' %}
    , base_level_usd * {{ ccy }}_fx_rate AS base_level_{{ ccy | lower }}
    {% endfor %}
FROM {{ ref('int_index_levels_with_fx') }}
```

---

## Related

- [[moc-dbt]] — Full dbt section
- [[dbt-core-concepts]] — What dbt is and how it works
- [[dbt-cli-reference]] — Detailed CLI reference
- [dbt-transformation-layer](/14-Data-Architecture/Pipeline-Patterns/dbt-transformation-layer) — Foundational overview
