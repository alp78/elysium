---
tags: [reference, dbt]
type: reference
technology: [dbt]
status: stable
updated: 2026-03-23
description: "dbt-utils, dbt-expectations, elementary, codegen, audit-helper, and writing custom packages for financial data pipelines"
related:
  - "[[dbt-macros-and-jinja]]"
  - "[[dbt-testing-framework]]"
  - "[[dbt-observability]]"
---

# dbt: Packages

dbt packages are importable dbt projects containing macros, models, seeds, and tests. They are the primary mechanism for sharing reusable logic across projects. For financial data pipelines processing index constituent data, ESG scores, and pricing feeds, a small set of well-chosen packages eliminates thousands of lines of boilerplate.

---

## 1. `packages.yml` and `dbt deps`

Declare packages in `packages.yml` at the project root. Run `dbt deps` to install them into `dbt_packages/`.

```yaml
# packages.yml

packages:
  # dbt Hub packages (semver-pinned)
  - package: dbt-labs/dbt_utils
    version: [">=1.3.0", "<2.0.0"]

  - package: calogica/dbt_expectations
    version: [">=0.10.0", "<1.0.0"]

  - package: calogica/dbt_date
    version: [">=0.10.0", "<1.0.0"]

  - package: dbt-labs/dbt_codegen
    version: [">=0.12.0", "<1.0.0"]

  - package: dbt-labs/audit_helper
    version: [">=0.11.0", "<1.0.0"]

  - package: elementary-data/elementary
    version: [">=0.14.0", "<1.0.0"]

  # Git packages (for packages not on dbt Hub)
  - git: "https://github.com/your-org/dbt-financial-utils.git"
    revision: v0.3.1

  # Local package (for monorepo setups)
  # - local: ../shared-dbt-package
```

```bash
dbt deps                          # Install all packages
dbt deps --upgrade                # Check for newer compatible versions
dbt deps --lock                   # Write packages.lock.yml (dbt 1.7+)
```

> [!important] Always pin versions in production
> Floating version ranges (`>=1.0.0`) are acceptable for development. For production pipelines serving regulatory reporting, pin to an exact version or a narrow range and commit `packages.lock.yml` to version control. This prevents silent upgrades from changing macro behaviour between deployments.

### 1.1 `packages.lock.yml`

Available in dbt Core 1.7+. Records the exact resolved version of every package and its dependencies.

```yaml
# packages.lock.yml (generated — do not edit manually)
packages:
  - package: dbt-labs/dbt_utils
    version: 1.3.0
    install-prerelease: false
  - package: calogica/dbt_expectations
    version: 0.10.4
```

Commit this file. CI should run `dbt deps --check` to verify the lock file is up to date.

---

## 2. dbt-utils

The foundational utility package. Provides general-purpose macros used across every dbt project.

### 2.1 Most Used in Financial Pipelines

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

### 2.2 `union_relations` for Multi-Provider Sources

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

### 2.3 `get_column_values` at Macro Time

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

## 3. dbt-expectations

Port of Great Expectations to dbt tests. Provides 50+ test macros with richer failure messages than native dbt tests.

### 3.1 Key Tests for Financial Data

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

## 4. dbt-codegen

Generates YAML schema stubs from existing tables or already-materialised models. Eliminates manual typing of column definitions for wide tables (ESG raw data often has 80+ columns).

### 4.1 Generate Source YAML

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

### 4.2 Generate Model YAML

```bash
# Generate schema YAML for an already-run model
dbt run-operation generate_model_yaml \
  --args '{"model_names": ["stg_msci__esg_scores", "fct_index_performance"]}'
```

### 4.3 Generate Base Models

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
> 1. Load raw data into warehouse.
> 2. Run `generate_source` → paste into `sources.yml`.
> 3. Run `generate_base_model` → paste into `stg_provider__table.sql`.
> 4. Run `generate_model_yaml` after `dbt run` → paste into model YAML.
> 5. Add descriptions, tests, and constraints manually.

---

## 5. dbt-audit-helper

Compares two relations and surfaces differences. Essential when migrating a legacy transformation to dbt, or promoting a refactored model to replace an existing one.

### 5.1 `compare_relations`

Compares all rows between two tables and categorises differences:

```bash
dbt run-operation audit_helper.compare_relations \
  --args '{
    "a_relation": "analytics.marts.fct_index_performance",
    "b_relation": "analytics.marts.fct_index_performance_new",
    "primary_key": "performance_key",
    "columns_to_compare": [
      "weight_bop",
      "total_return_usd",
      "contribution_to_return",
      "esg_score"
    ]
  }'
```

Result categories:

| Status | Meaning |
| ------ | ------- |
| `identical` | Row exists in both, all compared columns match |
| `in_a_only` | Row exists in old table only (deleted) |
| `in_b_only` | Row exists in new table only (added) |
| `in_both_and_different` | Row exists in both but at least one column differs |

### 5.2 `compare_column_values`

For numeric columns, shows a frequency distribution of differences — useful for spotting systematic rounding errors in return calculations:

```bash
dbt run-operation audit_helper.compare_column_values \
  --args '{
    "a_relation": "analytics.marts.fct_index_performance",
    "b_relation": "analytics.marts.fct_index_performance_v2",
    "primary_key": "performance_key",
    "column_to_compare": "total_return_usd"
  }'
```

### 5.3 Migration Validation Workflow

```bash
# 1. Build the new model alongside the old one (different name)
dbt run --select fct_index_performance_refactored

# 2. Compare against production
dbt run-operation audit_helper.compare_relations \
  --args '{"a_relation": "..prod..fct_index_performance", "b_relation": "..dev..fct_index_performance_refactored", ...}'

# 3. Investigate specific column discrepancies
dbt run-operation audit_helper.compare_column_values \
  --args '{"column_to_compare": "contribution_to_return", ...}'

# 4. When identical, rename and swap
```

---

## 6. Elementary

Elementary adds data observability — anomaly detection, schema change tracking, and a data observability UI — on top of dbt's test framework.

### 6.1 Setup

```yaml
# packages.yml
- package: elementary-data/elementary
  version: [">=0.14.0", "<1.0.0"]
```

```bash
dbt deps
dbt run --select elementary  # Materialises elementary monitoring tables
```

### 6.2 Anomaly Detection Tests

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

### 6.3 Schema Change Tracking

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

### 6.4 Running the Elementary Report

```bash
# Generate HTML observability report
edr report

# Send Slack alert for any anomalies from the last run
edr send-report --slack-webhook $SLACK_WEBHOOK_URL
```

---

## 7. Writing a Custom Package: `dbt-financial-utils`

When domain-specific macros and tests accumulate, extract them into a versioned internal package.

### 7.1 Package Structure

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

### 7.2 `dbt_project.yml` for the Package

```yaml
# dbt-financial-utils/dbt_project.yml

name: dbt_financial_utils
version: "0.3.1"
config-version: 2

require-dbt-version: [">=1.6.0", "<2.0.0"]

# Declare dependencies this package requires
# (consumers must also install these)
```

### 7.3 Generic Test: `weights_sum_to_one`

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

**Usage in consumer projects:**

```yaml
models:
  - name: fct_index_performance
    tests:
      - dbt_financial_utils.weights_sum_to_one:
          column_name: weight_bop
          group_by_columns: [index_id, price_date]
          tolerance: 0.005
```

### 7.4 Installing a Private Git Package

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
> Use a deploy key or machine account token. Set `GITHUB_TOKEN` as an environment variable and reference it in the git URL:
> `https://$GITHUB_TOKEN@github.com/your-org/dbt-financial-utils.git`

---

## 8. Version Pinning Strategy

| Environment | Strategy | Rationale |
| ----------- | -------- | --------- |
| Development | Range (`>=1.3.0, <2.0.0`) | Flexibility to test upgrades |
| CI / Staging | Exact (`1.3.0`) via lock file | Reproducible builds |
| Production | Exact via lock file, reviewed upgrade PRs | Zero surprise upgrades |
| Custom internal package | Git tag (`v0.3.1`) | Semantic versioning with changelogs |

**Upgrade workflow:**

1. Update `packages.yml` to the new version.
2. Run `dbt deps` locally.
3. Run `dbt build` — fix any macro signature changes.
4. Run `dbt deps --lock` to regenerate `packages.lock.yml`.
5. Open a PR. CI validates the full build.
6. Merge and deploy.

---

## Related

- [[dbt-macros-and-jinja]]
- [[dbt-testing-framework]]
- [[dbt-observability]]
- [[dbt-data-contracts-implementation]]
- [[dbt-core-concepts]]
