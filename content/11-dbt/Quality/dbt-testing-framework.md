---
tags: [pipeline, testing, dbt]
type: reference
technology: [dbt]
status: stable
updated: 2026-03-23
description: "Schema tests dbt-utils dbt-expectations custom tests"
---

# dbt: Testing Framework

> [!quote]
> "Without observability, it's just chaos. Why do people invest so much in staging testing tooling, when they cannot tell if the system is healthy in the first place?"
> — **Charity Majors**, charity.wtf (2018)

dbt's testing system is the primary mechanism for asserting data quality, implementing a key layer of the [data-quality-framework](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/data-quality-framework). Tests run against materialised relations in the warehouse, covering structural constraints, business rules, and statistical expectations. When paired with [data-contracts](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/data-contracts), these tests enforce guarantees that downstream consumers can depend on. This note covers all four test categories: built-in generic, dbt-utils, dbt-expectations, and custom tests.

---

### dbt Test Categories

| Category | Defined in | Examples |
|---|---|---|
| Built-in generic | YAML (schema tests) | `not_null`, `unique`, `accepted_values`, `relationships` |
| dbt-utils generic | YAML | `unique_combination_of_columns`, `accepted_range` |
| dbt-expectations generic | YAML | `expect_column_values_to_be_between`, `expect_table_row_count_to_be_between` |
| Singular (custom SQL) | `.sql` files in `tests/` | `assert_weights_sum_to_100`, `assert_no_negative_prices` |
| Custom generic | Macros in `macros/` | Re-usable parameterised test logic |

---

### dbt Built-in Generic Tests

Declared directly in `.yml` files alongside model or source definitions.

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

### assert_no_negative_prices

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

### dbt --store-failures

When `--store-failures` is active, dbt writes the failing rows from every failed test into a dedicated schema instead of just reporting a count.

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

> [!TIP] Store-failures in CI
> Enable `--store-failures` in CI runs so that when a test fails, the exact bad rows are available for debugging without re-running the pipeline. Pair with `--severity warn` for non-critical checks so the pipeline continues while failures are logged.

---

### dbt Test severity: warn vs error

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
