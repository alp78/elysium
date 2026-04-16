---
title: "01 - dbt: Testing Framework"
tags: [pipeline, testing, dbt]
status: stable
updated: 2026-03-23
description: "Schema tests dbt-utils dbt-expectations custom tests"
---

# dbt: Testing Framework

> [!quote] Tests need operational context
>
> "Without observability, it's just chaos. Why do people invest so much in staging testing tooling, when they cannot tell if the system is healthy in the first place?"
>
> Source: Charity Majors | charity.wtf (2018)

> [!abstract]- Summary
>
> Explains dbt's testing system as the warehouse-side quality layer for a project, covering built-in tests, package-provided generic tests, custom singular and generic tests, failure storage, severity handling, and test-coverage strategy by model layer.
>
> **Test categories and warehouse assertions**
> - Defines the major dbt test categories - built-in generic, `dbt_utils`, `dbt-expectations`, singular SQL tests, and custom generic macros - and shows where each is declared and what kinds of quality rules each fits best
> - Connects dbt testing to structural constraints, business-rule enforcement, and statistical or distributional checks that run against materialized relations in the warehouse
>
> **Reusable and custom test patterns**
> - Covers compound uniqueness, accepted ranges, expression-based assertions, table-level expectations, custom SQL assertions, and reusable macro-based test logic so teams can move from basic integrity checks to domain-specific guarantees
> - Explains when to favor package tests versus writing singular or generic custom logic as the project grows in complexity
>
> **Execution behavior and coverage strategy**
> - Covers `--store-failures`, warn-versus-error severity, and recommended test coverage by staging, intermediate, and mart layers so failures are both actionable and aligned to the right point in the DAG
> - Positions dbt tests as a key part of broader data-quality enforcement alongside contracts and observability, not as isolated YAML decoration
>
> **Operations and safety**
> - Warnings: weak coverage on critical marts, overusing heavyweight tests in fast feedback paths, storing failures without a cleanup plan, and treating warning severity as harmless on business-critical rules
> - Recommendations: match test type to failure surface, keep generic checks reusable, store failed rows when debugging, and distribute coverage intentionally across staging, intermediate, and mart layers

> [!info]- Glossary
>
> **dbt test**
> - The dbt execution surface that runs schema and singular tests against selected relations in the warehouse.
> - It matters here because the note is about how dbt turns quality assertions into executable checks rather than passive documentation.
>
> > [!info] Warehouse-side validation
> >
> > dbt tests execute against actual modeled data, not just YAML metadata. That is what makes them useful as operational guardrails instead of static annotations.
>
> ---
>
> **Built-in generic test**
> - A reusable dbt test declared in YAML, such as `not_null`, `unique`, `accepted_values`, or `relationships`.
> - It matters here because these are the fastest path to enforcing common structural constraints across many models.
>
> > [!info] Default integrity layer
> >
> > Built-in generic tests should usually be exhausted before writing custom SQL. They cover a surprising amount of core model hygiene with very little code.
>
> ---
>
> **`dbt_utils`**
> - A widely used dbt package that adds reusable macros and generic tests beyond the built-in set.
> - It matters here because many practical quality rules, such as compound uniqueness or value ranges, are easiest to express through `dbt_utils` tests.
>
> > [!warning] Package dependency, not native behavior
> >
> > A project that relies on `dbt_utils` tests must manage package installation and versioning consistently. Missing or drifting packages surface as confusing test-name failures.
>
> ---
>
> **`dbt-expectations`**
> - A dbt package that brings richer expectation-style tests, often inspired by Great Expectations patterns.
> - It matters here because it expands dbt from simple integrity checks into broader statistical and table-level assertions.
>
> > [!info] Higher-level expectation layer
> >
> > `dbt-expectations` is most valuable when the project needs richer semantic checks but still wants them to live in the dbt test surface.
>
> ---
>
> **Singular test**
> - A custom SQL file in `tests/` that returns failing rows when a business rule is violated.
> - It matters here because singular tests are the escape hatch for domain-specific assertions that do not fit cleanly into generic YAML syntax.
>
> > [!warning] SQL ownership required
> >
> > Singular tests are powerful, but they are also custom SQL assets that need review, maintenance, and clear ownership like any other transformation logic.
>
> ---
>
> **Generic test**
> - A parameterized reusable test, often backed by a macro, that can be applied to many models or columns through YAML.
> - It matters here because reusable generic tests are how teams scale repeated data-quality rules without duplicating singular SQL everywhere.
>
> > [!info] Reuse for repeated rules
> >
> > Once the same assertion appears in multiple singular tests, it is often a sign that the logic should become a generic test macro instead.
>
> ---
>
> **`relationships` test**
> - A built-in generic test that validates referential integrity by checking whether values in one field exist in another relation.
> - It matters here because it is one of the main ways dbt catches broken joins and orphan keys in modeled warehouse data.
>
> > [!warning] Dependency timing matters
> >
> > Relationship failures do not always mean the data is bad. They can also reveal refresh-order or latency mismatches between related models.
>
> ---
>
> **`unique_combination_of_columns`**
> - A `dbt_utils` generic test that verifies compound uniqueness across multiple columns.
> - It matters here because model grain is often multi-column, and single-column uniqueness tests are not enough for many analytical tables.
>
> > [!info] Grain-level uniqueness check
> >
> > This test is often the right way to encode true row grain in analytical models where uniqueness comes from keys plus date or other context columns.
>
> ---
>
> **`accepted_range`**
> - A generic test that constrains numeric values to an allowed minimum and maximum interval.
> - It matters here because many financial and analytical quality rules start as simple boundary checks on prices, weights, scores, or returns.
>
> > [!warning] Sanity check, not full semantics
> >
> > Range tests catch obvious bad values quickly, but they do not prove a metric is semantically correct. They are a floor, not the full quality story.
>
> ---
>
> **`--store-failures`**
> - A dbt option that persists failing test rows to warehouse tables for later inspection.
> - It matters here because debugging is much faster when engineers can inspect the exact bad rows instead of only seeing a failure count.
>
> > [!warning] Failure data needs housekeeping
> >
> > Stored failures are useful, but they also create extra relations and can accumulate sensitive or noisy records if cleanup is ignored.
>
> ---
>
> **Severity**
> - The dbt test outcome policy, typically `warn` or `error`, that controls whether a failing test blocks the run.
> - It matters here because severity is how teams encode whether a rule is informational, degradational, or pipeline-stopping.
>
> > [!warning] Wrong severity changes operational meaning
> >
> > A critical business rule marked as warn is effectively optional in CI. Treat severity as a deployment policy choice, not just formatting.
>
> ---
>
> **Test coverage strategy**
> - The deliberate distribution of test types across staging, intermediate, and mart layers based on what each layer is responsible for.
> - It matters here because the note closes by showing that not every layer should own the same kind of test.
>
> > [!info] Put the check where the contract lives
> >
> > Structural checks belong early, business-rule checks belong where the rule is introduced, and consumer-facing guarantees belong on published marts.
>
> ---
>
> **Data contract**
> - A schema-level promise about columns, types, and allowed structure that downstream consumers can rely on.
> - It matters here because dbt tests often work alongside contracts to enforce both data quality and interface stability.
>
> > [!info] Tests and contracts are complementary
> >
> > Contracts protect shape; tests protect content and behavior. Strong quality programs usually need both layers working together.

## dbt Test Categories

| Category | Defined in | Examples |
|---|---|---|
| Built-in generic | YAML (schema tests) | `not_null`, `unique`, `accepted_values`, `relationships` |
| dbt-utils generic | YAML | `unique_combination_of_columns`, `accepted_range` |
| dbt-expectations generic | YAML | `expect_column_values_to_be_between`, `expect_table_row_count_to_be_between` |
| Singular (custom SQL) | `.sql` files in `tests/` | `assert_weights_sum_to_100`, `assert_no_negative_prices` |
| Custom generic | Macros in `macros/` | Re-usable parameterised test logic |

---

## dbt Built-in Generic Tests

Declared directly in `.yml` files alongside model or source definitions.

*This YAML example shows how column-level integrity checks and model-level grain checks live next to the resource they protect.*

```yaml
# models/staging/market_data/_staging_market_data.yml
version: 2

models:
  - name: stg_market_data__daily_prices
    columns:

      - name: security_id
        tests:
          - not_null
          # unique test — fails if any security_id appears more than once
          # (not appropriate here since a security trades every day; see combination test below)

      - name: price_date
        tests:
          - not_null

      - name: close_price
        tests:
          - not_null

      - name: action_type
        tests:
          - accepted_values:
              values: ['DIVIDEND', 'SPLIT', 'SPINOFF', 'MERGER', 'RIGHTS']
              # quote: false  — use when values are numeric

    tests:
      # Compound uniqueness: the grain of the model
      - dbt_utils.unique_combination_of_columns:
          combination_of_columns:
            - security_id
            - price_date
            - exchange_code

  - name: stg_market_data__corporate_actions
    columns:
      - name: corporate_action_key
        tests:
          - not_null
          - unique
      - name: security_id
        tests:
          - not_null
          # Referential integrity: every security must exist in the securities dimension
          - relationships:
              to: ref('dim_constituents')
              field: security_id
              config:
                severity: warn    # warn because new securities may precede dim refresh
```

---

## dbt-utils Generic Tests

Install via `packages.yml`:

*This package declaration pins the shared test library so generic test names and macros resolve consistently across environments.*

```yaml
packages:
  - package: dbt-labs/dbt_utils
    version: [">=1.1.0", "<2.0.0"]
```

### dbt-utils test — unique_combination_of_columns

```yaml
tests:
  - dbt_utils.unique_combination_of_columns:
      combination_of_columns:
        - index_id
        - price_date
```

Generates a hash of the column combination and checks for duplicates. More efficient than a surrogate key uniqueness check at scale.

### dbt-utils test — accepted_range

```yaml
columns:
  - name: close_price
    tests:
      - dbt_utils.accepted_range:
          min_value: 0
          inclusive: false   # strictly greater than 0

  - name: weight
    tests:
      - dbt_utils.accepted_range:
          min_value: 0
          max_value: 1
          inclusive: true

  - name: esg_score
    tests:
      - dbt_utils.accepted_range:
          min_value: 0
          max_value: 100

  - name: daily_simple_return
    tests:
      - dbt_utils.accepted_range:
          min_value: -0.5
          max_value:  0.5
          config:
            severity: warn   # flag extreme returns without failing the pipeline
```

### dbt-utils test — expression_is_true

Tests that a SQL expression evaluates to true for every row.

```yaml
tests:
  - dbt_utils.expression_is_true:
      expression: "high_price >= low_price"
  - dbt_utils.expression_is_true:
      expression: "close_price <= high_price * 1.001"
      config:
        severity: warn
```

---

## dbt-expectations Generic Tests

Install:

*This package declaration adds expectation-style tests for richer statistical and table-level assertions than the built-in set covers on its own.*

```yaml
packages:
  - package: calogica/dbt_expectations
    version: [">=0.10.0", "<1.0.0"]
```

### dbt-expectations — row count and statistical tests

```yaml
# Applied at model level in the tests: block
models:
  - name: fct_index_performance
    tests:
      # Ensure daily performance table always has data
      - dbt_expectations.expect_table_row_count_to_be_between:
          min_value: 100
          max_value: 10000

      # Column-level statistical test: median daily return should be near zero
      - dbt_expectations.expect_column_median_to_be_between:
          column_name: index_daily_return
          min_value: -0.005
          max_value:  0.005
          config:
            severity: warn

  - name: stg_esg__scores
    tests:
      # Ensure ESG score distribution is plausible
      - dbt_expectations.expect_column_mean_to_be_between:
          column_name: esg_score
          min_value: 20
          max_value: 80
          config:
            severity: warn

    columns:
      - name: isin
        tests:
          # ISIN is always exactly 12 characters
          - dbt_expectations.expect_column_value_lengths_to_equal:
              value: 12

      - name: score_date
        tests:
          # No future-dated ESG scores
          - dbt_expectations.expect_column_values_to_be_between:
              min_value: "'2000-01-01'"
              max_value: "current_date()"

      - name: provider_code
        tests:
          # Must match known providers
          - dbt_expectations.expect_column_values_to_match_regex:
              regex: "^(MSCI|SUSTAINALYTICS|ISS|REFINITIV)$"
```

### dbt-expectations — expect_column_pair relationship

```yaml
tests:
  # High price must always be >= low price
  - dbt_expectations.expect_column_pair_values_A_to_be_greater_than_B:
      column_A: high_price
      column_B: low_price
      or_equal: true
```

---

## Custom Singular Tests

Singular tests are plain SQL files in the `tests/` directory. A test passes when the query returns **zero rows**. Any returned row represents a failure.

> [!danger] Empty tables pass singular tests
>
> A singular test that queries an empty table returns zero rows and passes -- even though no data was validated. This is the most common false-positive in dbt testing. Always pair singular tests with a `dbt_expectations.expect_table_row_count_to_be_between` test to ensure the source table actually has data. Otherwise a broken ingestion pipeline produces an empty table that passes all quality checks.

> [!success] Fix: guard every singular test with a row-count test
>
> Add `dbt_expectations.expect_table_row_count_to_be_between` with a meaningful `min_value` to the same model. This ensures the pipeline fails visibly when no data was loaded, preventing a false-positive pass on an empty table.

### assert_no_negative_prices

*This singular test returns the exact offending rows and columns when price fields contain non-positive values that should never leave staging.*

```sql
-- tests/assert_no_negative_prices.sql
-- Fails if any OHLCV price column is negative or zero.
-- Applies to the staging layer where we expect raw data to be clean enough for downstream use.

select
    security_id,
    price_date,
    exchange_code,
    'close_price'                    as failing_column,
    cast(close_price as varchar(50)) as failing_value
from {{ ref('stg_market_data__daily_prices') }}
where close_price <= 0

union all

select
    security_id,
    price_date,
    exchange_code,
    'open_price',
    cast(open_price as varchar(50))
from {{ ref('stg_market_data__daily_prices') }}
where open_price <= 0

union all

select
    security_id,
    price_date,
    exchange_code,
    'high_price',
    cast(high_price as varchar(50))
from {{ ref('stg_market_data__daily_prices') }}
where high_price <= 0
```

### assert_weights_sum_to_100

*This singular test validates that constituent weights remain close to a full portfolio weight on recent rebalance dates.*

```sql
-- tests/assert_weights_sum_to_100.sql
-- Fails if any index's constituent weights do not sum to approximately 1.0
-- on any given effective_date (allowing ±1% tolerance for rounding).

with weight_sums as (

    select
        index_id,
        effective_date,
        sum(weight)   as total_weight,
        count(*)      as constituent_count

    from {{ ref('stg_market_data__index_constituents') }}
    -- Only check the most recent rebalance dates to avoid checking stale historical snapshots
    where effective_date >= dateadd(month, -3, current_date())
    group by index_id, effective_date

)

select
    index_id,
    effective_date,
    total_weight,
    constituent_count
from weight_sums
where total_weight < 0.99
   or total_weight > 1.01
```

### assert_no_future_dated_prices

*This singular test catches ingestion and timezone bugs by returning any price rows dated beyond the warehouse's current date.*

```sql
-- tests/assert_no_future_dated_prices.sql
-- Fails if any price observation is dated after today.
-- Catches ingestion pipeline bugs where timezone handling introduces future dates.

select
    security_id,
    price_date,
    _ingested_at
from {{ ref('stg_market_data__daily_prices') }}
where price_date > current_date()
```

### assert_esg_scores_coverage

*This warning-level singular test highlights large-cap constituents missing recent ESG coverage without halting the entire build.*

```sql
-- tests/assert_esg_scores_coverage.sql
-- Warns if any large-cap index constituent is missing an ESG score
-- within the last 90 days. Uses severity: warn so pipeline does not fail.

with index_members as (

    select distinct security_id
    from {{ ref('stg_market_data__index_constituents') }}
    -- Only the largest indices that require ESG coverage
    where index_id in ('MSCI_ACWI', 'MSCI_WORLD', 'FTSE_ALL_WORLD')
      and effective_date >= dateadd(day, -30, current_date())

),

recent_esg as (

    select distinct security_id
    from {{ ref('stg_esg__scores') }}
    where score_date >= dateadd(day, -90, current_date())

)

-- Return constituents with no recent ESG score
select m.security_id
from index_members m
left join recent_esg e using (security_id)
where e.security_id is null
```

To attach severity to a singular test, configure it in `dbt_project.yml` or with a YAML test block:

```yaml
# dbt_project.yml
tests:
  financial_platform:
    assert_esg_scores_coverage:
      +severity: warn
```

---

## Custom Generic Tests

Generic tests are macros that can be applied to any model/column via YAML. They accept parameters.

### Generic test: assert_column_not_decreasing

Useful for cumulative adjustment factors that must be monotonically non-decreasing per security.

*This generic test macro turns a reusable monotonicity rule into parameterized SQL that can be attached to any ordered series.*

```sql
-- macros/tests/assert_column_not_decreasing.sql
{% test assert_column_not_decreasing(model, column_name, partition_by, order_by) %}

with ordered as (

    select
        {{ partition_by }}          as partition_key,
        {{ order_by }}              as order_key,
        {{ column_name }}           as value,
        lag({{ column_name }}) over (
            partition by {{ partition_by }}
            order by {{ order_by }}
        )                           as prev_value

    from {{ model }}

)

select *
from ordered
where prev_value is not null
  and value < prev_value

{% endtest %}
```

Apply in YAML:

*This YAML attachment applies the custom generic test to a specific model column and defines the partition and ordering context the macro expects.*

```yaml
models:
  - name: int_corporate_action_adjustments
    columns:
      - name: cumulative_adjustment_factor
        tests:
          - assert_column_not_decreasing:
              partition_by: security_id
              order_by: effective_date
```

### Generic test: assert_no_orphan_keys

*This macro-level test finds child keys that do not resolve to a declared parent relation, turning a repeated referential-integrity rule into reusable test logic.*

```sql
-- macros/tests/assert_no_orphan_keys.sql
{% test assert_no_orphan_keys(model, column_name, parent_model, parent_column) %}

select child.{{ column_name }}
from {{ model }} child
left join {{ parent_model }} parent
    on child.{{ column_name }} = parent.{{ parent_column }}
where parent.{{ parent_column }} is null

{% endtest %}
```

---

## dbt --store-failures

When `--store-failures` is active, dbt writes the failing rows from every failed test into a dedicated schema instead of just reporting a count.

*These commands enable persistent failure capture and then inspect the warehouse tables dbt writes for failed assertions.*

```bash
dbt test --store-failures

# Or configure persistently in dbt_project.yml:
tests:
  financial_platform:
    +store_failures: true
    +schema: test_failures
```

Tables are named after the test, e.g.:

```sql
-- Inspect why the weight test failed
select * from dbt_dev.test_failures.accepted_range_stg_market_data__index_constituents_weight_0_1

-- Inspect negative price failures
select * from dbt_dev.test_failures.assert_no_negative_prices
```

> [!tip] Store failures in CI
>
> Enable `--store-failures` in CI runs so that when a test fails, the exact bad rows are available for debugging without re-running the pipeline. Pair it with carefully chosen severity levels so non-critical checks can be investigated without blocking the whole pipeline.

---

## dbt Test severity: warn vs error

*This YAML example shows how severity changes whether a failed assertion is only reported or becomes a hard pipeline stop.*

```yaml
columns:
  - name: daily_simple_return
    tests:
      - dbt_utils.accepted_range:
          min_value: -0.3
          max_value:  0.3
          config:
            # warn: dbt reports the failure but exits 0 (pipeline continues)
            severity: warn
            # error: dbt exits non-zero (pipeline fails) — the default
            # severity: error

  - name: close_price
    tests:
      - not_null:
          config:
            severity: error   # explicit; null prices must block downstream
```

Guidance by data type:

| Test type | Recommended severity |
|---|---|
| Null primary/foreign keys | `error` |
| Duplicate grain violations | `error` |
| Referential integrity | `warn` (upstream refresh timing) |
| Accepted range for prices | `error` |
| Statistical distribution checks | `warn` |
| ESG score coverage | `warn` |
| Source freshness | `error` for market data, `warn` for ESG |

---

> [!warning] Warn severity always exits 0
>
> A test with `severity: warn` will report failures in the dbt output but exit with code 0, meaning your CI pipeline treats it as a success. If you promote `warn` tests to detect real issues, add a post-run script that parses `run_results.json` and fails CI when warn-level failures exceed a threshold. Otherwise, warnings accumulate unnoticed.

> [!success] Fix: parse `run_results.json` in CI
>
> After `dbt test`, run a script that reads `target/run_results.json` and counts results with `status: "warn"`. Fail the CI step if the warn count exceeds an acceptable threshold, turning silent warnings into actionable gate failures.

## Test Coverage Strategy by Layer

### Staging

Focus: structural integrity of raw data.

- `not_null` on every identifier and date column
- `unique` or `unique_combination_of_columns` on the model grain
- `accepted_values` on categorical columns (action_type, currency_code)
- `accepted_range` on numeric columns (prices, volumes, weights)
- Referential integrity against seeds (e.g., currency codes against `ref_currency_codes`)

### Intermediate

Focus: calculation correctness.

- `accepted_range` on derived metrics (returns within ±50%)
- `expression_is_true` for invariants (high >= low, cumulative factor >= 0)
- Custom generic tests for monotonic/non-decreasing sequences

### Marts

Focus: consumer-facing contract enforcement.

- Grain uniqueness (`unique_combination_of_columns`) — **mandatory**
- Not-null on all dimension foreign keys
- `accepted_range` on KPIs with business-meaningful bounds
- Statistical distribution tests (`dbt_expectations`) with `severity: warn`
- Custom singular tests for domain-specific invariants (weights sum to 1)
- Relationship tests to dimension tables

```yaml
# Test coverage summary in _performance.yml
models:
  - name: fct_index_performance
    tests:
      - dbt_utils.unique_combination_of_columns:
          combination_of_columns: [index_id, price_date]      # grain — error
      - dbt_expectations.expect_table_row_count_to_be_between:
          min_value: 50                                        # warn if sparse
          config: {severity: warn}
    columns:
      - name: index_id
        tests: [not_null]
      - name: price_date
        tests: [not_null]
      - name: index_daily_return
        tests:
          - dbt_utils.accepted_range:
              min_value: -0.5
              max_value:  0.5
              config: {severity: warn}
      - name: total_weight_coverage
        tests:
          - dbt_utils.accepted_range:
              min_value: 0.95
              max_value: 1.05
              config: {severity: warn}
```

---

## Related

- [dbt-data-contracts-implementation](https://alp78.github.io/elysium/11-dbt/Quality/dbt-data-contracts-implementation)
- [dbt-project-structure](https://alp78.github.io/elysium/11-dbt/Foundations/dbt-project-structure)
- [data-quality-framework](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/data-quality-framework)
- [data-contracts](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/data-contracts)
- [data-pipeline-testing-strategy](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/data-pipeline-testing-strategy) — How dbt tests fit into the full testing pyramid for data engineering
