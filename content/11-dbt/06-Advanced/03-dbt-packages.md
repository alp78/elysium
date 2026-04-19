---
title: "03 - dbt: Packages"
tags: [pipeline, dbt]
status: stable
updated: 2026-03-23
description: "dbt-utils, dbt-expectations, elementary, codegen, audit-helper, and writing custom packages for financial data pipelines"
---

# dbt: Packages

> [!quote]+
>
> "If I have seen further, it is by standing on the shoulders of giants."
>
> — **Isaac Newton**, letter to Robert Hooke (1675)

> [!abstract]- Summary
>
> dbt packages are reusable dbt projects that import shared macros, tests, models, and seeds into a project, and this note defines how to declare, lock, evaluate, and extend package dependencies so financial-data pipelines reuse mature building blocks without losing reproducibility or control.
>
> **Dependency declaration and reproducibility**
> - Uses `packages.yml` plus `dbt deps` to install Hub, Git, or local packages into `dbt_packages/`, and explains when `package-lock.yml` should be committed and checked in CI.
> - Treats version pinning as a production requirement rather than a convenience, especially for regulated or auditable reporting pipelines.
>
> **High-value package capabilities**
> - Covers `dbt_utils` for common macro primitives, `dbt_expectations` for richer data tests, `codegen` for YAML and base-model scaffolding, `audit_helper` for relation diffs during migrations, and Elementary for observability and anomaly detection.
> - Maps each package to concrete financial-data use cases such as surrogate keys, date spines, provider pivots, migration validation, and schema-change monitoring.
>
> **Internal package design**
> - Shows when domain-specific logic should graduate into a versioned internal package, including project structure, package metadata, generic tests, and private Git installation patterns.
> - Extends dependency management into upgrade workflow, CI validation, and semantic versioning for shared internal utilities.
>
> **Operations and safety**
> - Warnings: pin versions, protect private package credentials in CI, review lock-file drift, and avoid floating production dependencies that change behavior silently.
> - Recommendations table: the version-pinning strategy by environment is the note's core release-management rule.
> - Upgrade workflow: the note defines a 6-step package upgrade process from version bump through CI validation and deployment.

> [!info]- Glossary
>
> **dbt package**
> - A reusable dbt project that can contribute macros, tests, models, seeds, or other project assets to another dbt project.
> - It matters here because packages are the main mechanism the note uses to share mature logic across financial-data pipelines.
>
> > [!info] Reuse unit above a macro
> >
> > A package is a versioned dependency boundary, not just a file copy convenience. Once a project depends on one, release management and compatibility become part of the design.
>
> ---
>
> **`packages.yml`**
> - The dbt dependency manifest that declares which external, Git, or local packages a project should install.
> - It matters here because package source, version range, and installation mode are all controlled from this file.
>
> > [!warning] Source of dependency truth
> >
> > If this file is loose or inconsistent, environments will resolve different package sets. Keep it intentional and review it like application dependency code.
>
> ---
>
> **`dbt deps`**
> - The dbt command that resolves and installs project dependencies into the local package directory.
> - It matters here because every package workflow in the note starts with dependency resolution and installation.
>
> > [!warning] Resolution can drift
> >
> > Running `dbt deps` against floating constraints can produce different installed code over time. That is exactly why lock files and pinning matter.
>
> ---
>
> **`dbt_packages/`**
> - The local directory where dbt stores installed package code after dependency resolution.
> - It matters here because it is the runtime source of imported macros and tests during parse, compile, and run phases.
>
> > [!info] Generated dependency cache
> >
> > Treat this as installed dependency output, not hand-edited project code. The dependency definition belongs upstream in manifest and lock files.
>
> ---
>
> **`package-lock.yml`**
> - The lock file that records the exact resolved dependency versions for a dbt project.
> - It matters here because CI and production need deterministic dependency graphs rather than open-ended semver resolution.
>
> > [!warning] Commit the resolved graph
> >
> > Without the lock file in version control, reproducibility collapses back to whatever the registry serves at install time. For production, that is operationally weak.
>
> ---
>
> **Version pinning**
> - The practice of constraining dependencies to exact versions or tightly bounded ranges instead of broad floating constraints.
> - It matters here because shared macro behavior can change underneath a pipeline even when project SQL stays unchanged.
>
> > [!danger] Silent behavior drift
> >
> > Floating dependencies are effectively unreviewed code changes arriving through installation. In regulated or audited pipelines, that is an avoidable risk.
>
> ---
>
> **`dbt_utils`**
> - A foundational dbt package that provides cross-project helper macros for common modeling tasks.
> - It matters here because it supplies the core reusable primitives that many financial-data projects need before any domain-specific package is necessary.
>
> > [!info] Baseline toolkit
> >
> > Start here for standard helpers such as surrogate keys, date spines, and pivots before inventing local versions that the community package already maintains.
>
> ---
>
> **`dbt_expectations`**
> - A dbt package that ports Great Expectations-style tests into dbt macros with richer assertions and messages.
> - It matters here because the note uses it to express nuanced financial-data quality rules beyond the native dbt test set.
>
> > [!info] Expressive quality layer
> >
> > This package is most valuable when data rules need more precision than basic `not_null` or `unique` tests can provide.
>
> ---
>
> **`codegen`**
> - The `dbt-labs/codegen` package that generates source YAML, model YAML, and base-model scaffolds from existing warehouse objects.
> - It matters here because wide raw financial feeds make manual schema authoring slow and error-prone.
>
> > [!warning] Scaffold, then review
> >
> > Generated YAML accelerates setup, but it is not finished documentation. Descriptions, tests, and domain constraints still need human review.
>
> ---
>
> **`audit_helper`**
> - A dbt package that compares relations and column values to identify differences between two model outputs.
> - It matters here because migration and refactor work needs row- and column-level validation before replacing a trusted production model.
>
> > [!warning] Comparison before cutover
> >
> > Refactors that skip relation diffing tend to discover mismatches too late. Use this as a release gate when model behavior is being replaced.
>
> ---
>
> **Elementary**
> - A dbt observability package that adds anomaly detection, schema-change tracking, and reporting on top of dbt artifacts and tests.
> - It matters here because the note treats observability as a dependency-managed extension of the transformation stack rather than a separate platform concern.
>
> > [!info] Observability package layer
> >
> > Elementary does not replace dbt tests; it complements them by watching for abnormal behavior over time and surfacing it operationally.
>
> ---
>
> **Custom internal package**
> - A private package maintained by the organization to share domain-specific macros, tests, and supporting assets across multiple dbt projects.
> - It matters here because financial calculations, holiday seeds, and custom tests often deserve a stable internal dependency once reuse becomes widespread.
>
> > [!warning] Shared maintenance commitment
> >
> > Publishing internal helpers as a package creates an internal API. Once other projects depend on it, upgrade discipline and changelogs become part of the job.
>
> ---
>
> **Private Git package**
> - A package installed directly from a private Git repository instead of from dbt Hub.
> - It matters here because internal utilities are frequently distributed this way and require secure CI authentication to install.
>
> > [!danger] CI secret boundary
> >
> > Package installation credentials become part of the supply chain. Use scoped deploy keys or tightly scoped machine credentials instead of broad personal tokens.
>
> ---
>
> **Semantic version tag**
> - A Git tag or version label that communicates the intended compatibility level of a package release.
> - It matters here because internal packages need stable release references that consumers can pin and upgrade deliberately.
>
> > [!info] Release contract marker
> >
> > A clean version tag gives dependent projects something reviewable to pin. It is much easier to reason about than a moving branch reference.
>
> ---
>
> **Upgrade workflow**
> - The repeatable process for changing package versions, reinstalling dependencies, validating builds, regenerating the lock file, and promoting the change through review.
> - It matters here because safe package management is not just about choosing a version; it is about controlling the full change path into production.
>
> > [!warning] Treat dependency bumps as code changes
> >
> > Macro-signature or behavior changes can break models even when project SQL is untouched. Run the full build and review the lock-file delta before merging.

## `packages.yml` and `dbt deps`

Declare packages in `packages.yml` at the project root. Run `dbt deps` to install them into `dbt_packages/`.

```yaml
# packages.yml

packages:
  # dbt Hub packages (semver-pinned)
  - package: dbt-labs/dbt_utils
    version: 1.3.3

  - package: metaplane/dbt_expectations
    version: 0.10.10

  - package: godatadriven/dbt_date
    version: 0.17.1

  - package: dbt-labs/codegen
    version: 0.14.0

  - package: dbt-labs/audit_helper
    version: 0.12.2

  - package: elementary-data/elementary
    version: 0.22.1

  # Git packages (for packages not on dbt Hub)
  - git: "https://github.com/your-org/dbt-financial-utils.git"
    revision: v0.3.1

  # Local package (for monorepo setups)
  # - local: ../shared-dbt-package
```

```bash
dbt deps                          # Install all packages
dbt deps --upgrade                # Refresh ranged or Git-based dependencies
dbt deps --lock                   # Write package-lock.yml (dbt 1.7+)
```

> [!important] Always pin versions in production
>
> Floating version ranges (`>=1.0.0`) are acceptable for development. For production pipelines serving regulatory reporting, pin to an exact version or a narrow range and commit `package-lock.yml` to version control. This prevents silent upgrades from changing macro behaviour between deployments.

### dbt package-lock.yml — dependency lock file

Available in dbt Core 1.7+. Records the exact resolved version of every package and its dependencies.

```yaml
# package-lock.yml (generated — do not edit manually)
packages:
  - package: dbt-labs/dbt_utils
    version: 1.3.3
    install-prerelease: false
  - package: metaplane/dbt_expectations
    version: 0.10.10
```

Commit this file. CI should run `dbt deps` and fail the job if `package-lock.yml` changes unexpectedly after dependency resolution.

---

## dbt-utils

The foundational utility package. Provides general-purpose macros used across every dbt project.

### dbt-utils — Most Used Macros in Financial Pipelines

| Macro | Use case |
| ----- | -------- |
| `generate_surrogate_key` | Composite surrogate keys for fact tables |
| `date_spine` | Complete date series for time-series gap detection |
| `pivot` | ESG provider rows → columns |
| `star` | Select all except raw metadata columns |
| `expression_is_true` | Generic SQL expression tests |
| `not_constant` | Verify price/weight columns are not degenerate |
| `sequential_values` | Verify no gaps in a sequence (date series, row numbers) |
| `get_column_values` | Macro-time column value discovery |
| `union_relations` | Union multiple similarly-structured source tables |

### dbt-utils union_relations — multi-provider source merging

When multiple index providers deliver constituent data in the same schema:

```sql
-- models/staging/stg_index_constituents.sql

{{
  dbt_utils.union_relations(
    relations = [
      ref('stg_msci__constituents'),
      ref('stg_ftse__constituents'),
      ref('stg_russell__constituents')
    ],
    include   = ['index_id', 'constituent_id', 'weight', 'price_date', 'provider_id']
  )
}}
```

### dbt-utils get_column_values — dynamic column lists at macro time

```sql
{% set index_families = dbt_utils.get_column_values(
    table  = ref('dim_index'),
    column = 'index_family',
    order_by = 'index_family'
) %}

select
    price_date,
{% for family in index_families %}
    sum(case when index_family = '{{ family }}'
             then cap_weighted_return end)
        as return_{{ family | lower | replace('-', '_') }}
    {%- if not loop.last %},{% endif %}
{% endfor %}
from {{ ref('fct_index_daily_return') }}
group by 1
```

---

## dbt-expectations

Port of Great Expectations to dbt tests. Provides 50+ test macros with richer failure messages than native dbt tests.

### dbt-expectations — key tests for financial data quality

```yaml
models:
  - name: fct_index_performance
    columns:
      - name: weight_bop
        tests:
          # Weights must be between 0 and 1
          - dbt_expectations.expect_column_values_to_be_between:
              min_value: 0
              max_value: 1
              strictly: false

          # No constituent should dominate an index (>40% is suspect)
          - dbt_expectations.expect_column_values_to_be_between:
              min_value: 0
              max_value: 0.4
              config:
                severity: warn

      - name: total_return_usd
        tests:
          # Returns outside ±50% on a single day are almost certainly data errors
          - dbt_expectations.expect_column_values_to_be_between:
              min_value: -0.5
              max_value: 0.5
              config:
                severity: warn

          # Return should not be null for business days
          - dbt_expectations.expect_column_values_to_not_be_null:
              row_condition: "price_date in (select calendar_date from {{ ref('dim_trading_calendar') }} where is_business_day)"

      - name: esg_score
        tests:
          - dbt_expectations.expect_column_values_to_be_between:
              min_value: 0
              max_value: 100

    tests:
      # Row count should not drop more than 5% day-over-day
      - dbt_expectations.expect_table_row_count_to_be_between:
          min_value: 5000
          max_value: 50000

      # Weight sum per index per day should be ~1.0
      - dbt_expectations.expect_column_sum_to_be_between:
          column_name: weight_bop
          min_value: 0.98
          max_value: 1.02
          group_by: [index_id, price_date]
```

---

## dbt-codegen

Generates YAML schema stubs from existing tables or already-materialised models. Eliminates manual typing of column definitions for wide tables (ESG raw data often has 80+ columns).

### dbt-codegen — generate source YAML from database

```bash
# Generate source YAML for a raw schema
dbt run-operation generate_source \
  --args '{
    "schema_name": "raw_esg",
    "database_name": "analytics",
    "generate_columns": true,
    "include_descriptions": true
  }'
```

Output (paste into `sources.yml`):

```yaml
sources:
  - name: raw_esg
    database: analytics
    schema: raw_esg
    tables:
      - name: raw_msci_esg_scores
        columns:
          - name: isin
          - name: composite_score
          - name: environmental_score
          - name: social_score
          - name: governance_score
          - name: rating_date
          - name: _loaded_at
```

### dbt-codegen — generate model YAML from SQL

```bash
# Generate schema YAML for an already-run model
dbt run-operation generate_model_yaml \
  --args '{"model_names": ["stg_msci__esg_scores", "fct_index_performance"]}'
```

### dbt-codegen — generate base models from source tables

```bash
# Generate a staging model SQL file from a source table
dbt run-operation generate_base_model \
  --args '{
    "source_name": "raw_esg",
    "table_name": "raw_msci_esg_scores"
  }'
```

Produces:

```sql
with source as (
    select * from {{ source('raw_esg', 'raw_msci_esg_scores') }}
),

renamed as (
    select
        isin,
        composite_score,
        environmental_score,
        social_score,
        governance_score,
        rating_date,
        _loaded_at
    from source
)

select * from renamed
```

> [!tip] Codegen workflow
>
> 1. Load raw data into warehouse.
> 2. Run `generate_source` → paste into `sources.yml`.
> 3. Run `generate_base_model` → paste into `stg_provider__table.sql`.
> 4. Run `generate_model_yaml` after `dbt run` → paste into model YAML.
> 5. Add descriptions, tests, and constraints manually.

---

## dbt-audit-helper

Compares two relations and surfaces differences. Essential when migrating a legacy transformation to dbt, or promoting a refactored model to replace an existing one.

### dbt-audit-helper compare_and_classify_relation_rows — diff two models row by row

Use the current relation-comparison macro rather than the legacy `compare_relations` wrapper:

```sql
{% set old_relation = adapter.get_relation(
    database = 'analytics',
    schema = 'marts',
    identifier = 'fct_index_performance'
) %}

{% set new_relation = ref('fct_index_performance_new') %}

{{ audit_helper.compare_and_classify_relation_rows(
    a_relation = old_relation,
    b_relation = new_relation,
    primary_key_columns = ['performance_key'],
    columns = ['weight_bop', 'total_return_usd', 'contribution_to_return', 'esg_score']
) }}
```

This classifies rows into matching, missing, and different groups so refactors can be reviewed before cutover.

### dbt-audit-helper compare_column_values — column-level diff

For numeric columns, shows a frequency distribution of differences — useful for spotting systematic rounding errors in return calculations:

```sql
{% set old_query %}
    select * from analytics.marts.fct_index_performance
{% endset %}

{% set new_query %}
    select * from {{ ref('fct_index_performance_v2') }}
{% endset %}

{{ audit_helper.compare_column_values(
    a_query = old_query,
    b_query = new_query,
    primary_key = 'performance_key',
    column_to_compare = 'total_return_usd'
) }}
```

### dbt-audit-helper — migration validation workflow

1. Build the refactored model alongside the current production model under a different name.
2. Create a temporary audit model or singular test that calls `audit_helper.compare_and_classify_relation_rows`.
3. For mismatched numeric columns, add a follow-up audit query using `audit_helper.compare_column_values`.
4. Cut over only after the diff is understood and accepted.

---

## Elementary

Elementary adds data observability — anomaly detection, schema change tracking, and a data observability UI — on top of dbt's test framework.

### Elementary Setup

```yaml
# packages.yml
- package: elementary-data/elementary
  version: 0.22.1
```

```bash
dbt deps
dbt run --select elementary  # Materialises elementary monitoring tables
```

### Anomaly Detection Tests

Elementary's anomaly tests use historical baselines rather than fixed thresholds — critical for financial data where volumes and values change with market conditions.

```yaml
models:
  - name: fct_index_performance
    tests:
      # Detect unusual row count changes
      - elementary.volume_anomalies:
          timestamp_column: price_date
          config:
            severity: warn

      # Detect unusual proportion of null ESG scores
      - elementary.null_count_anomalies:
          column_name: esg_score
          timestamp_column: price_date
          config:
            severity: warn

      # Detect distribution shifts in index weights
      - elementary.all_columns_anomalies:
          column_anomalies:
            - average
            - standard_deviation
          timestamp_column: price_date
          config:
            severity: warn
```

### Schema Change Tracking

Elementary tracks DDL changes on monitored models and surfaces them in the observability UI and Slack alerts:

```yaml
models:
  - name: fct_index_performance
    tests:
      - elementary.schema_changes:
          config:
            severity: error   # Schema changes on public models are errors
```

When a new column is added or a type changes, Elementary records the change with a timestamp and can alert the data engineering team before downstream consumers are affected.

### Running the Elementary Report

```bash
# Generate HTML observability report
edr report

# Send Slack alert for any anomalies from the last run
edr send-report --slack-webhook $SLACK_WEBHOOK_URL
```

---

## Writing a Custom Package: `dbt-financial-utils`

When domain-specific macros and tests accumulate, extract them into a versioned internal package.

### Package Structure

```
dbt-financial-utils/
  dbt_project.yml
  packages.yml
  macros/
    finance/
      z_score.sql
      weighted_average.sql
      cap_weighted_return.sql
      safe_divide.sql
    testing/
      assert_weights_sum_to_one.sql
      assert_no_weekend_dates.sql
  tests/
    generic/
      weights_sum_to_one.sql
      no_future_dates.sql
  seeds/
    seed_market_holidays.csv
  README.md
```

### `dbt_project.yml` for the Package

```yaml
# dbt-financial-utils/dbt_project.yml

name: dbt_financial_utils
version: "0.3.1"
config-version: 2

require-dbt-version: [">=1.6.0", "<2.0.0"]

# Declare dependencies this package requires
# (consumers must also install these)
```

### Generic Test: `weights_sum_to_one`

Generic tests live in `tests/generic/` and are referenced like built-in tests.

```sql
-- dbt-financial-utils/tests/generic/weights_sum_to_one.sql
{% test weights_sum_to_one(model, column_name, group_by_columns, tolerance=0.001) %}

with weight_sums as (
    select
        {% for col in group_by_columns %}{{ col }},{% endfor %}
        sum({{ column_name }}) as total_weight
    from {{ model }}
    group by {% for col in group_by_columns %}{{ loop.index }}{% if not loop.last %},{% endif %}{% endfor %}
)

select *
from weight_sums
where abs(total_weight - 1.0) > {{ tolerance }}

{% endtest %}
```

#### Usage in consumer projects

```yaml
models:
  - name: fct_index_performance
    tests:
      - dbt_financial_utils.weights_sum_to_one:
          column_name: weight_bop
          group_by_columns: [index_id, price_date]
          tolerance: 0.005
```

### Installing a Private Git Package

```yaml
# Consumer project packages.yml
packages:
  - git: "https://github.com/your-org/dbt-financial-utils.git"
    revision: v0.3.1       # Pin to a git tag

  # Or pin to a specific commit SHA for maximum reproducibility
  # - git: "https://github.com/your-org/dbt-financial-utils.git"
  #   revision: "a1b2c3d4e5f6"
```

> [!warning] Private repos in CI
>
> Use a deploy key or machine account token. Set `GITHUB_TOKEN` as an environment variable and reference it in the git URL:
> `https://$GITHUB_TOKEN@github.com/your-org/dbt-financial-utils.git`

> [!success] Use a scoped deploy key per repo
>
> Create a read-only GitHub deploy key for the private package repository and store it as a CI secret (e.g., `DBT_PACKAGE_DEPLOY_KEY`). Configure the SSH agent in the CI pipeline step before running `dbt deps`. This avoids storing a personal access token and limits blast radius if the secret is rotated or exposed.

---

## Version Pinning Strategy

| Environment | Strategy | Rationale |
| ----------- | -------- | --------- |
| Development | Range (`>=1.3.0, <2.0.0`) | Flexibility to test upgrades |
| CI / Staging | Exact (`1.3.0`) via lock file | Reproducible builds |
| Production | Exact via lock file, reviewed upgrade PRs | Zero surprise upgrades |
| Custom internal package | Git tag (`v0.3.1`) | Semantic versioning with changelogs |

### Upgrade workflow

1. Update `packages.yml` to the new version.
2. Run `dbt deps` locally.
3. Run `dbt build` — fix any macro signature changes.
4. Run `dbt deps --lock` to regenerate `package-lock.yml`.
5. Open a PR. CI validates the full build.
6. Merge and deploy.

---

## Related

- [dbt-macros-and-jinja](https://alp78.github.io/elysium/11-dbt/Advanced/dbt-macros-and-jinja)
- [dbt-testing-framework](https://alp78.github.io/elysium/11-dbt/Quality/dbt-testing-framework)
- [dbt-observability](https://alp78.github.io/elysium/11-dbt/Operations/dbt-observability)
- [dbt-data-contracts-implementation](https://alp78.github.io/elysium/11-dbt/Quality/dbt-data-contracts-implementation)
- [dbt-core-concepts](https://alp78.github.io/elysium/11-dbt/Foundations/dbt-core-concepts)
