---
tags: [pipeline, dbt]
type: cheat-sheet
technology: [dbt]
status: stable
updated: 2026-03-23
description: "CLI commands, node selection, flags, output interpretation"
related:
  - "[dbt-core-concepts](/11-dbt/Foundations/dbt-core-concepts)"
  - "[dbt-project-structure](/11-dbt/Foundations/dbt-project-structure)"
  - "[dbt-testing-framework](/11-dbt/Quality/dbt-testing-framework)"
---

# dbt: CLI Reference

Complete reference for the dbt command-line interface. All examples are oriented toward a financial data platform running index, OHLCV, ESG, and corporate action models. For a condensed quick-reference version, see [dbt-cheat-sheet](/11-dbt/dbt-cheat-sheet).

---

### Core Commands Overview

| Command | What it does |
|---|---|
| `dbt run` | Materialise models |
| `dbt test` | Execute schema and singular tests |
| `dbt build` | run + test + seed + snapshot in DAG order |
| `dbt compile` | Render Jinja → SQL, write to target/compiled/ |
| `dbt debug` | Validate connection and config |
| `dbt deps` | Install packages from packages.yml |
| `dbt seed` | Load CSV seeds into the warehouse |
| `dbt snapshot` | Execute snapshot blocks |
| `dbt docs generate` | Build the documentation manifest |
| `dbt docs serve` | Serve docs on localhost:8080 |
| `dbt source freshness` | Check source table staleness |
| `dbt ls` | List nodes matching a selector |
| `dbt clean` | Delete target/ and dbt_packages/ |
| `dbt retry` | Re-run the last failed invocation |

---

### dbt run

Materialise one or more models into the warehouse.

```bash
# Run everything
dbt run

# Run a single model
dbt run --select stg_market_data__daily_prices

# Run a model and all its downstream dependants
dbt run --select stg_market_data__daily_prices+

# Run a model and all its upstream parents
dbt run --select +fct_index_performance

# Run a model with both parents and children
dbt run --select +fct_index_performance+

# Run all models in a directory
dbt run --select staging/market_data

# Run models with a specific tag
dbt run --select tag:daily

# Run only models modified since the last production run (state-aware)
dbt run --select state:modified+ --state ./prod_artifacts

# Exclude a subtree
dbt run --select marts/ --exclude fct_composite_scores

# Pass runtime variables
dbt run --select fct_index_performance --vars '{"lookback_days": 7}'

# Target a non-default environment
dbt run --target prod

# Parallelism
dbt run --threads 8

# Stop immediately on first failure (CI-friendly)
dbt run --fail-fast

# Full refresh of an incremental model (rebuild from scratch)
dbt run --select fct_index_performance --full-refresh
```

---

### dbt test

```bash
# Test everything
dbt test

# Test only models in the performance mart
dbt test --select marts/performance

# Test a single model
dbt test --select fct_index_performance

# Test only schema (YAML-defined) tests
dbt test --select test_type:generic

# Test only singular (custom SQL) tests
dbt test --select test_type:singular

# Run tests tagged "critical"
dbt test --select tag:critical

# Store failed rows in the warehouse for inspection
dbt test --store-failures

# Continue even after failures (collect all results)
dbt test --no-fail-fast
```

---

### dbt build

`dbt build` is the recommended command for CI/CD. It runs seeds, snapshots, models, and tests in DAG-topological order, so a model is tested before its downstream models execute.

```bash
# Full build
dbt build

# Build only the ESG subgraph
dbt build --select +fct_composite_scores

# Build only changed nodes and downstream (slim CI pattern)
dbt build --select state:modified+ --defer --state ./prod_artifacts

# Build with full refresh for incremental models
dbt build --full-refresh --select tag:incremental
```

> [!TIP] build vs run + test
> `dbt build` guarantees that if `stg_esg__scores` tests fail, the downstream `int_esg_normalized` will never execute. `dbt run && dbt test` runs all models first, so failures propagate into downstream data before you discover them.

---

### dbt compile

Renders Jinja templates to plain SQL without executing anything. Useful for debugging macro output.

```bash
# Compile everything
dbt compile

# Compile one model and inspect the output
dbt compile --select int_daily_returns
# Output written to: target/compiled/financial_platform/models/intermediate/market_data/int_daily_returns.sql
```

---

### dbt debug

Validates that dbt can connect to the warehouse and that `dbt_project.yml` parses correctly.

```bash
dbt debug
# Checks: profiles.yml location, profile/target names, adapter connection,
#         dbt_project.yml validity, package versions
```

---

### dbt deps

Installs packages declared in `packages.yml`.

```bash
dbt deps
```

```yaml
# packages.yml
packages:
  - package: dbt-labs/dbt_utils
    version: [">=1.1.0", "<2.0.0"]
  - package: calogica/dbt_expectations
    version: [">=0.10.0", "<1.0.0"]
  - package: dbt-labs/audit_helper
    version: [">=0.11.0", "<1.0.0"]
```

---

### dbt seed

Loads CSV files from the `seeds/` directory into the warehouse.

```bash
# Load all seeds
dbt seed

# Load a specific seed
dbt seed --select ref_gics_sectors

# Force drop-and-recreate (useful after schema change)
dbt seed --full-refresh
```

Typical seeds for a financial platform:

| Seed | Purpose |
|---|---|
| `ref_gics_sectors.csv` | GICS sector / industry hierarchy |
| `ref_currency_codes.csv` | ISO 4217 currency codes and FX flags |
| `ref_index_metadata.csv` | Index names, base dates, provider codes |
| `ref_trading_calendar.csv` | Exchange trading days (holiday overrides) |

---

### dbt snapshot

Executes snapshot definitions to capture SCD Type 2 history.

```bash
# Run all snapshots
dbt snapshot

# Run a specific snapshot
dbt snapshot --select snap_index_constituents
```

```sql
-- snapshots/snap_index_constituents.sql
{% snapshot snap_index_constituents %}

{{ config(
    target_schema = 'snapshots',
    unique_key    = 'constituent_key',
    strategy      = 'timestamp',
    updated_at    = 'updated_at',
    invalidate_hard_deletes = true
) }}

select
    {{ dbt_utils.generate_surrogate_key(['index_id', 'security_id']) }} as constituent_key,
    index_id,
    security_id,
    weight,
    effective_date,
    updated_at
from {{ ref('stg_market_data__index_constituents') }}

{% endsnapshot %}
```

---

### dbt docs

```bash
# Generate the docs site (writes to target/catalog.json + manifest.json)
dbt docs generate

# Serve locally (default port 8080)
dbt docs serve

# Serve on a custom port
dbt docs serve --port 9090
```

Documentation is pulled from `description:` fields in `.yml` files and rendered with lineage graphs. Every model, source, column, and test is searchable.

---

### dbt source freshness

Checks whether source tables have been updated within the configured freshness window.

```bash
# Check all sources
dbt source freshness

# Check sources in the market_data source group only
dbt source freshness --select source:market_data

# Write results to a JSON file (useful for alerting pipelines)
dbt source freshness --output target/sources.json
```

Exit codes: `0` = pass, `1` = warn, `2` = error. Wire `2` into your alerting system.

---

### dbt ls (list)

List DAG nodes without executing anything.

```bash
# List all models
dbt ls --resource-type model

# List models in the marts layer
dbt ls --select marts/

# List all tests for a specific model
dbt ls --select stg_market_data__daily_prices --resource-type test

# List models that would be affected by a state:modified selector
dbt ls --select state:modified+ --state ./prod_artifacts

# Output as JSON for scripting
dbt ls --output json --select tag:daily
```

---

### dbt clean

Deletes compiled artifacts and installed packages. Run before a fresh `dbt deps`.

```bash
dbt clean
# Deletes: target/, dbt_packages/
```

---

### dbt retry

Re-runs the last failed invocation using the same selection and flags. Useful in CI when a transient network error causes a single model failure.

```bash
dbt retry
```

Internally, dbt reads `target/run_results.json` and re-queues all nodes that did not have status `success`.

---

## Node Selection Reference

### Selector Syntax

| Syntax | Meaning |
|---|---|
| `model_name` | Exact model name |
| `+model_name` | Model + all ancestors |
| `model_name+` | Model + all descendants |
| `+model_name+` | Model + ancestors + descendants |
| `model_name+2` | Model + 2 levels downstream |
| `path/to/dir` | All models under that directory |
| `tag:tagname` | Models with that tag |
| `source:source_name` | Source nodes |
| `source:source_name.table_name` | Specific source table |
| `config.materialized:incremental` | Models with a config property |
| `state:modified` | Nodes changed vs --state artifacts |
| `state:modified+` | Changed nodes + their downstream |
| `state:new` | Nodes that didn't exist in --state |
| `exposure:exposure_name` | All models feeding an exposure |
| `metric:metric_name` | All models feeding a metric |

### Set Operators

```bash
# Union: run both subgraphs
dbt run --select staging/market_data staging/esg

# Intersection: models that match both selectors
dbt run --select "tag:daily,config.materialized:incremental"

# Difference (exclude)
dbt run --select marts/ --exclude fct_composite_scores+
```

---

### Key Flags Reference

| Flag | Commands | Purpose |
|---|---|---|
| `--select / -s` | all | Node selector |
| `--exclude` | all | Subtract nodes from selection |
| `--full-refresh` | run, build | Drop and recreate incrementals |
| `--vars` | run, test, build | Pass `{key: value}` dict as JSON string |
| `--target / -t` | all | Override profile target |
| `--threads` | run, test, build | Parallelism (overrides profile) |
| `--fail-fast` | run, test, build | Halt on first failure |
| `--store-failures` | test, build | Persist failed rows to warehouse |
| `--defer` | run, build | Use prod artifacts for unselected parents |
| `--state` | run, build, ls | Path to production artifacts directory |
| `--no-partial-parse` | all | Force full re-parse of project |
| `--profiles-dir` | all | Override default ~/.dbt location |
| `--project-dir` | all | Override project root directory |

---

### --defer and Slim CI Pattern

`--defer` lets developers run only their changed models in a dev environment, resolving unselected upstream `ref()` calls against the production schema instead of rebuilding everything.

```bash
# 1. In CI: download prod manifest
dbt run --target prod --select ... # or download from artifact storage

# 2. In feature branch CI job:
dbt build \
  --select state:modified+ \
  --defer \
  --state ./prod_artifacts \
  --target dev
```

This means a developer who only changes `int_esg_normalized` does not need to rebuild all of `stg_esg__scores` — dbt will resolve that ref against the production view.

---

### Reading CLI Output

```
Running with dbt=1.8.0
Found 42 models, 18 tests, 4 seeds, 2 snapshots, 5 sources

Concurrency: 8 threads (target='dev')

1 of 42 START sql view model silver.stg_market_data__daily_prices ......... [RUN]
1 of 42 OK created sql view model silver.stg_market_data__daily_prices ..... [OK in 1.23s]
...
14 of 42 START sql incremental model gold.fct_index_performance ............ [RUN]
14 of 42 OK created sql incremental model gold.fct_index_performance ........ [OK in 8.47s]
...
Finished running 42 models in 0 hours 2 minutes and 11.38 seconds (131.38s).

Completed successfully.

Done. PASS=42 WARN=0 ERROR=0 SKIP=0 TOTAL=42
```

| Status | Meaning |
|---|---|
| `OK` | Model materialised successfully |
| `ERROR` | SQL execution failed |
| `SKIP` | Skipped because an upstream node failed |
| `WARN` | Test severity=warn threshold crossed |
| `PASS` | Test passed |
| `FAIL` | Test failed (severity=error) |

> [!WARNING] SKIP propagation
> A single `ERROR` in a staging model will `SKIP` all downstream intermediates and marts. Always check the first error in the log — it is usually the root cause.

---

## Related
- [dbt-core-concepts](/11-dbt/Foundations/dbt-core-concepts)
- [dbt-project-structure](/11-dbt/Foundations/dbt-project-structure)
- [dbt-testing-framework](/11-dbt/Quality/dbt-testing-framework)
