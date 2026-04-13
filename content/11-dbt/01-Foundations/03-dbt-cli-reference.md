---
title: "03 - dbt: CLI Reference"
tags: [pipeline, dbt]
status: stable
updated: 2026-03-23
description: "CLI commands, node selection, flags, output interpretation"
---

# dbt: CLI Reference

> [!quote]
> "Make it work, make it right, make it fast."
>
> — **Kent Beck**

> [!abstract]- Summary
>
> Explains the dbt command-line interface as an operational reference for running, testing, compiling, selecting, cleaning, and debugging models, with an emphasis on state-aware selection and CI-friendly execution patterns for a production warehouse project.
>
> **Core dbt commands**
> - Covers `dbt run`, `dbt test`, `dbt build`, `dbt compile`, `dbt debug`, `dbt deps`, `dbt seed`, `dbt snapshot`, docs commands, source freshness checks, node listing, cleanup, and retry behavior
> - Connects each command to what it changes in the warehouse or project state so the CLI can be used intentionally instead of as a memorized list of verbs
>
> **Selection and state-aware execution**
> - Explains selector syntax, graph operators, set operators, and key flags such as `--select`, `--exclude`, `--vars`, `--threads`, `--full-refresh`, `--defer`, and slim-CI state selection
> - Shows how node selection and deferred state turn the CLI into a precise execution surface for local debugging, targeted reruns, and CI optimization
>
> **Output interpretation and operating patterns**
> - Covers reading CLI output, using debug and compile as preflight tools, and distinguishing build-versus-run/test behavior so failures are localized to the right layer faster
> - Emphasizes CI/CD-oriented command choices that reduce unnecessary work and prevent downstream models from running after upstream failures
>
> **Operations and safety**
> - Warnings: running broad selectors against the wrong target, misunderstanding `build` versus `run && test`, rebuilding incrementals unintentionally, and using state or defer flags without the correct artifact context
> - Recommendations: default to the narrowest selector that answers the question, use `dbt debug` and `dbt compile` before expensive runs, prefer `dbt build` in CI, and treat selector syntax as a control surface rather than a convenience shortcut

> [!note]- Glossary
>
> **`dbt run`**
> - The CLI command that materializes selected models into the warehouse.
> - It matters here because it is the direct execution entry point for most model builds and the baseline against which other commands are compared.
>
> > [!warning] Writes warehouse state
> >
> > `dbt run` changes relations in the active target. A broad selector or wrong target can materialize far more than intended.
>
> ---
>
> **`dbt test`**
> - The CLI command that executes schema and singular tests against selected resources.
> - It matters here because testing is a separate execution surface from model builds, and understanding that separation is essential when debugging failures.
>
> > [!info] Assertion layer
> >
> > `dbt test` validates data properties after relations exist. It does not replace compile-time validation or warehouse execution checks.
>
> ---
>
> **`dbt build`**
> - A composite command that runs seeds, snapshots, models, and tests in DAG order.
> - It matters here because it is the preferred CI entry point when upstream failure should stop downstream work automatically.
>
> > [!warning] More than run plus test
> >
> > `dbt build` is not just a convenience wrapper. Its DAG-aware execution semantics make it safer for CI than chaining `run` and `test` manually.
>
> ---
>
> **`dbt compile`**
> - The CLI command that renders Jinja into pure SQL without executing anything in the warehouse.
> - It matters here because compile is the fastest way to isolate Jinja and graph problems before burning warehouse time.
>
> > [!info] Cheap preflight check
> >
> > Compile failures point to dbt or Jinja layers, not warehouse runtime. Use it early when the question is "will this render" rather than "will this execute."
>
> ---
>
> **`dbt debug`**
> - The CLI command that validates project parsing, profile selection, and warehouse connectivity.
> - It matters here because many runtime failures are really target or credential problems that `dbt debug` can expose before a real run starts.
>
> > [!warning] Connection before execution
> >
> > If `dbt debug` is red, later model failures are often misleading noise. Fix profile and auth issues before troubleshooting model SQL.
>
> ---
>
> **`dbt deps`**
> - The CLI command that installs packages declared in `packages.yml`.
> - It matters here because package macros and tests change project behavior, and stale dependencies often explain missing macro or test-name errors.
>
> > [!warning] Project behavior depends on it
> >
> > A project that compiles on one machine can fail on another if package versions differ. Treat `deps` as part of environment setup, not as optional cleanup.
>
> ---
>
> **`dbt seed`**
> - The CLI command that loads CSV files from `seeds/` into warehouse tables.
> - It matters here because seeds are operational warehouse writes, and they often participate in CI, reference data bootstrapping, or environment setup.
>
> > [!info] Reference data loader
> >
> > Seeds are ideal for small, versioned lookup data. They are not a substitute for real ingestion pipelines or bulk data movement.
>
> ---
>
> **`dbt snapshot`**
> - The CLI command that executes snapshot definitions to record historical changes over time.
> - It matters here because snapshots change persistence and history semantics compared with ordinary model runs.
>
> > [!warning] History accumulates
> >
> > Snapshot runs add or update historical state rather than rebuilding a simple relation. Run them with the same care you would apply to any temporal data process.
>
> ---
>
> **Node selection**
> - The dbt selector system that chooses which resources commands act on, using model names, paths, tags, graph operators, and state expressions.
> - It matters here because nearly every CLI command becomes safe or dangerous based on selector scope.
>
> > [!warning] Scope is the real command
> >
> > In practice, `dbt run` without the right selector is a different operation from `dbt run --select ...`. Precision comes from selection more than from the base verb.
>
> ---
>
> **Graph operator**
> - A selector modifier such as `+` that expands selection to upstream parents, downstream children, or both.
> - It matters here because graph operators are what turn a single node into a dependency-aware subgraph execution.
>
> > [!warning] Expansion grows fast
> >
> > One extra `+` can change a local debug run into a large warehouse operation. Always read graph-expanding selectors as blast-radius multipliers.
>
> ---
>
> **State selection**
> - A selector mode that compares the current project to a saved set of artifacts and chooses only changed resources, often with `state:modified+`.
> - It matters here because state-aware selection is one of the main ways teams keep CI fast in larger dbt projects.
>
> > [!warning] Artifacts must match reality
> >
> > State selection is only trustworthy when the referenced artifacts really represent the comparison environment you think they do, such as the last production manifest.
>
> ---
>
> **`--defer`**
> - A dbt flag that lets unresolved upstream references point at objects from another environment's artifacts instead of rebuilding everything locally.
> - It matters here because slim CI and environment-aware testing often depend on deferring unchanged parents to production state.
>
> > [!warning] Environment substitution is intentional
> >
> > `--defer` changes what relation a ref resolves to. That is powerful, but only if the artifact source and target environment are explicit and trustworthy.
>
> ---
>
> **`--full-refresh`**
> - A flag that forces dbt to rebuild incremental models from scratch instead of using their incremental logic.
> - It matters here because it is one of the highest-cost and highest-impact CLI switches in normal dbt operation.
>
> > [!warning] Expensive by design
> >
> > Full refresh is the right fix for some drift and schema changes, but it can be costly and disruptive on large fact models if used casually.
>
> ---
>
> **`dbt ls`**
> - The CLI command that lists resources matching a selector without executing them.
> - It matters here because it is the safest way to validate selector scope before running a command that mutates warehouse state.
>
> > [!info] Dry-run for selection logic
> >
> > If you are unsure what a selector will hit, inspect it with `dbt ls` first. It is often the fastest way to prevent an unnecessarily broad run.
>
> ---
>
> **`dbt retry`**
> - The CLI command that re-runs the last failed invocation.
> - It matters here because retry is useful operationally, but only when you understand what previous state and selection it is actually replaying.
>
> > [!warning] Context matters
> >
> > Retry saves time only when the previous invocation context is still valid. If the target, code, or upstream state has changed, a fresh scoped command is usually safer.

> [!example] Execution Surface Fit
>
> > [!success] Appropriate
> >
> > - Use this note for day-to-day dbt development, warehouse preflight checks, targeted model reruns, CI troubleshooting, and state-aware execution in larger projects.
> > - Use it when selector scope, target choice, state artifacts, and command semantics are the real control surface for safe execution.
> > - Use it to narrow blast radius before running warehouse-mutating commands and to explain why the same base verb can behave very differently under different selectors and flags.
>
> > [!failure] Inappropriate
> >
> > - Do not use this note as a replacement for project-structure, modeling, or troubleshooting notes when the real question is about SQL design, architecture, or failure diagnosis rather than command behavior.
> > - Do not treat CLI verbs as the main decision; selector scope and target selection are often the more important risk controls.
> > - Do not run broad or deferred state commands unless the artifact context and environment mapping are explicit.

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

> [!success] Isolate the root cause before rerunning
> Scroll to the first `ERROR` entry in the log — subsequent `SKIP` lines are consequences, not causes. Fix the root model, then use `dbt retry` to re-run only the failed and skipped nodes without rebuilding the whole graph. In CI, use `dbt run --fail-fast` to stop immediately and surface the root error clearly.

---

## Related

- [dbt-core-concepts](https://alp78.github.io/elysium/11-dbt/Foundations/dbt-core-concepts)
- [dbt-project-structure](https://alp78.github.io/elysium/11-dbt/Foundations/dbt-project-structure)
- [dbt-testing-framework](https://alp78.github.io/elysium/11-dbt/Quality/dbt-testing-framework)
