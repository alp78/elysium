---
tags: [pipeline, dbt]
type: reference
technology: [dbt]
status: stable
updated: 2026-03-23
description: "Jinja2 fundamentals, writing macros, dbt-utils patterns, dispatch, hooks, and anti-patterns for financial data pipelines"
---

# dbt: Macros and Jinja

> [!quote]
> "Any fool can write code that a computer can understand. Good programmers write code that humans can understand."
> — **Martin Fowler**

Jinja2 is the templating layer that makes dbt SQL dynamic. Macros are reusable Jinja functions that live in the `macros/` directory and are compiled into plain SQL before execution. In financial data pipelines — where the same calculation pattern (z-score normalisation, cap-weighted return, factor exposure) is applied across dozens of index families and ESG providers — macros are the primary DRY mechanism.

---

## Jinja2 Fundamentals

dbt uses three Jinja delimiters:

| Delimiter   | Purpose                           | Example                          |
| ----------- | --------------------------------- | -------------------------------- |
| `{{ ... }}` | **Expression** — renders a value  | `{{ ref('dim_security') }}`      |
| `{% ... %}` | **Statement** — control flow      | `{% if target.name == 'prod' %}` |
| `{# ... #}` | **Comment** — stripped at compile | `{# TODO: add currency filter #}` |

### Variables and Filters

```sql
-- var() reads from dbt_project.yml or --vars CLI flag
{% set cutoff_date = var('performance_cutoff_date', '2020-01-01') %}

select *
from {{ ref('fct_index_performance') }}
where price_date >= '{{ cutoff_date }}'

-- Jinja filters transform values inline
{{ 'msci_world' | upper }}          -- MSCI_WORLD
{{ columns | join(', ') }}          -- col_a, col_b, col_c
{{ some_list | length }}            -- 3
```

### Control Flow

```sql
{% set providers = ['MSCI', 'SUSTAINALYTICS', 'ISS'] %}

select
    constituent_id,
    price_date,
{% for provider in providers %}
    max(case when esg_provider_id = '{{ provider }}'
             then composite_score end)
        as esg_score_{{ provider | lower }}
    {%- if not loop.last %},{% endif %}
{% endfor %}
from {{ ref('int_esg_scores_unpivoted') }}
group by 1, 2
```

### Macros vs Variables

- **`var()`** — project-wide scalar values passed at runtime.
- **`env_var()`** — reads OS environment variables (credentials, environment names).
- **Macros** — functions that accept arguments and return SQL fragments or strings.

---

## Writing Custom Macros

Place macro files in `macros/`. Each file can hold multiple macros. Use subdirectories for organisation (`macros/finance/`, `macros/utils/`).

### `z_score` — Cross-Sectional Normalisation

ESG and factor data often requires cross-sectional z-score normalisation: subtract the mean and divide by the standard deviation across all constituents on a given date.

```sql
-- macros/finance/z_score.sql

{% macro z_score(column, partition_by=None) %}
{#-
  Computes a z-score for `column`.
  If partition_by is provided, statistics are computed within each partition
  (e.g. partition_by='index_id, price_date' for cross-sectional z-scores).
-#}
{% if partition_by %}
    (
        {{ column }}
        - avg({{ column }}) over (partition by {{ partition_by }})
    )
    / nullif(
        stddev_pop({{ column }}) over (partition by {{ partition_by }}),
        0
    )
{% else %}
    ({{ column }} - avg({{ column }}) over ())
    / nullif(stddev_pop({{ column }}) over (), 0)
{% endif %}
{% endmacro %}
```

#### Usage — 2.1 z_score — Cross-Sectional Normalisation

```sql
select
    index_id,
    constituent_id,
    price_date,
    composite_score,
    {{ z_score('composite_score', partition_by='index_id, price_date') }}
        as esg_z_score
from {{ ref('int_esg_scores_latest') }}
```

### `weighted_average` — Capital-Weighted Metrics

```sql
-- macros/finance/weighted_average.sql

{% macro weighted_average(value_col, weight_col, partition_by) %}
{#-
  Computes a weighted average of `value_col` using `weight_col` as weights,
  partitioned by `partition_by`. Returns null when sum of weights is zero.
-#}
    sum({{ value_col }} * {{ weight_col }}) over (partition by {{ partition_by }})
    / nullif(
        sum({{ weight_col }}) over (partition by {{ partition_by }}),
        0
    )
{% endmacro %}
```

#### Usage — 2.2 weighted_average — Capital-Weighted Metrics

```sql
select
    index_id,
    price_date,
    constituent_id,
    weight_bop,
    composite_score,
    {{ weighted_average('composite_score', 'weight_bop', 'index_id, price_date') }}
        as index_weighted_avg_esg
from {{ ref('int_esg_scores_latest') }}
```

### `cap_weighted_return` — Index Return Calculation

```sql
-- macros/finance/cap_weighted_return.sql

{% macro cap_weighted_return(
    return_col,
    weight_col,
    group_by_cols,
    source_relation
) %}
{#-
  Aggregates constituent returns into an index-level cap-weighted return.
  group_by_cols: comma-separated string of grouping columns.
-#}
select
    {{ group_by_cols }},
    sum({{ return_col }} * {{ weight_col }})  as cap_weighted_return,
    sum({{ weight_col }})                     as total_weight,
    count(*)                                  as constituent_count
from {{ source_relation }}
group by {{ group_by_cols }}
{% endmacro %}
```

**Usage** (called inside a model via `run_query` or as a CTE block):

```sql
-- models/marts/finance/fct_index_daily_return.sql
with weighted as (
    {{ cap_weighted_return(
        return_col      = 'total_return_usd',
        weight_col      = 'weight_bop',
        group_by_cols   = 'index_id, price_date',
        source_relation = ref('fct_index_performance')
    ) }}
)

select
    index_id,
    price_date,
    cap_weighted_return,
    total_weight,
    constituent_count
from weighted
```

---

## dbt-utils Macros

Install via `packages.yml` (see [dbt-packages](https://alp78.github.io/elysium/11-dbt/Advanced/dbt-packages)). The most useful macros for financial pipelines:

### dbt-utils surrogate_key — deterministic hash key from columns

Generates a deterministic hash key from one or more columns, handling nulls consistently.

```sql
select
    {{ dbt_utils.generate_surrogate_key([
        'index_id',
        'constituent_id',
        'price_date'
    ]) }} as performance_key,
    index_id,
    constituent_id,
    price_date
from source_table
```

> [!note] MD5 vs SHA256
> `generate_surrogate_key` uses MD5 by default. For compliance-sensitive pipelines where key collision probability matters (very unlikely but auditable), use `dbt_utils.generate_surrogate_key` with a custom hash function via dispatch.

### dbt-utils date_spine — generate continuous date series

Generates a complete calendar table — essential for ensuring no trading days are missing in time-series performance data.

```sql
-- models/marts/finance/dim_trading_calendar.sql
with spine as (
    {{ dbt_utils.date_spine(
        datepart = "day",
        start_date = "'2000-01-01'",
        end_date = "current_date + interval '1 year'"
    ) }}
)

select
    date_day                                            as calendar_date,
    extract(year  from date_day)::int                  as calendar_year,
    extract(month from date_day)::int                  as calendar_month,
    extract(dow   from date_day)::int                  as day_of_week,
    date_day not in (select holiday_date
                     from {{ ref('seed_market_holidays') }})
    and extract(dow from date_day) not in (0, 6)       as is_business_day
from spine
```

### dbt-utils pivot — rows to columns transformation

Rotates ESG provider rows into columns without hardcoding provider names.

```sql
-- models/marts/finance/fct_esg_scores_wide.sql

{% set providers_query %}
    select distinct esg_provider_id
    from {{ ref('int_esg_scores_unpivoted') }}
    order by 1
{% endset %}

{% set providers = run_query(providers_query).columns[0].values() %}

select
    constituent_id,
    price_date,
    {{ dbt_utils.pivot(
        column  = 'esg_provider_id',
        values  = providers,
        agg     = 'max',
        then_value = 'composite_score',
        prefix  = 'esg_score_',
        suffix  = '',
        quote_identifiers = False
    ) }}
from {{ ref('int_esg_scores_unpivoted') }}
group by 1, 2
```

### dbt-utils star — select all columns except specified

Selects all columns from a relation except a specified exclusion list — useful when staging tables need to drop raw provider internal IDs.

```sql
select
    {{ dbt_utils.star(
        from        = ref('raw_esg_scores'),
        except      = ['_fivetran_id', '_fivetran_synced', 'internal_batch_id']
    ) }}
from {{ ref('raw_esg_scores') }}
```

---

## Dispatch Macros for Cross-Adapter Compatibility

`adapter.dispatch()` lets you write adapter-specific macro implementations that are resolved at compile time based on the active adapter (BigQuery, Snowflake, SQL Server, DuckDB, etc.).

### Pattern

```
macros/
  finance/
    safe_divide.sql          ← default fallback
    bigquery__safe_divide.sql
    sqlserver__safe_divide.sql
```

#### Default (ANSI-compatible)

```sql
-- macros/finance/safe_divide.sql
{% macro safe_divide(numerator, denominator) %}
    {{ return(adapter.dispatch('safe_divide', 'my_project')(numerator, denominator)) }}
{% endmacro %}

{% macro default__safe_divide(numerator, denominator) %}
    case when {{ denominator }} = 0 or {{ denominator }} is null
         then null
         else {{ numerator }} / {{ denominator }}::numeric
    end
{% endmacro %}
```

**BigQuery override** (uses native `SAFE_DIVIDE`):

```sql
-- macros/finance/bigquery__safe_divide.sql
{% macro bigquery__safe_divide(numerator, denominator) %}
    safe_divide({{ numerator }}, {{ denominator }})
{% endmacro %}
```

**SQL Server override** (no `::` cast syntax):

```sql
-- macros/finance/sqlserver__safe_divide.sql
{% macro sqlserver__safe_divide(numerator, denominator) %}
    case when {{ denominator }} = 0 or {{ denominator }} is null
         then null
         else cast({{ numerator }} as float) / cast({{ denominator }} as float)
    end
{% endmacro %}
```

#### Usage in a model (adapter-agnostic)

```sql
select
    index_id,
    price_date,
    {{ safe_divide('active_return_usd', 'tracking_error') }} as information_ratio
from {{ ref('int_portfolio_analytics') }}
```

> [!tip] Dispatch namespace registration
>
> Register custom dispatch namespaces so dbt searches your project before packages:
> ```yaml
> dispatch:
>   - macro_namespace: dbt_utils
>     search_order: [my_project, dbt_utils]
> ```

---

## `run_query()` for Introspection

`run_query()` executes SQL during compilation and returns an `agate.Table`. Use it to dynamically discover column names, provider lists, or schema metadata.

### Dynamic Column Discovery

```sql
-- macros/utils/get_column_values.sql
{% macro get_esg_providers(schema, table) %}

{% set query %}
    select distinct esg_provider_id
    from {{ schema }}.{{ table }}
    where esg_provider_id is not null
    order by 1
{% endset %}

{% if execute %}
    {% set results = run_query(query) %}
    {% set providers = results.columns[0].values() %}
    {{ return(providers) }}
{% else %}
    {{ return([]) }}
{% endif %}

{% endmacro %}
```

> [!warning] Execute guard required
>
> `run_query()` only works during the execution phase, not during parsing. Always wrap in `{% if execute %}` to prevent errors during `dbt parse` or `dbt compile`.

---

## Pre-hook and Post-hook Patterns

Hooks run SQL before or after a model materialises. Common uses: permissions grants, audit logging, index creation.

### Model-Level Hooks

```yaml
# models/marts/finance/_finance__models.yml
models:
  - name: fct_index_performance
    config:
      pre_hook:
        - "{{ log_model_start(this) }}"
      post_hook:
        - "grant select on {{ this }} to role reporting_role"
        - "grant select on {{ this }} to role esg_data_consumers"
        - "{{ log_model_end(this) }}"
```

### Grant Macro

```sql
-- macros/utils/grant_select.sql
{% macro grant_select(node, roles) %}
{% for role in roles %}
    grant select on {{ node }} to role {{ role }};
{% endfor %}
{% endmacro %}
```

```yaml
post_hook: "{{ grant_select(this, ['reporting_role', 'risk_readers']) }}"
```

### Table Statistics Update (Snowflake)

```yaml
models:
  - name: fct_index_performance
    config:
      post_hook:
        - "alter table {{ this }} cluster by (price_date, index_id)"
```

---

## `on-run-start` and `on-run-end` Hooks

These run once per `dbt run` invocation, not per model. Ideal for pipeline-level audit logging, watermark management, and environment-level setup.

```yaml
# dbt_project.yml

on-run-start:
  - "{{ create_audit_log_table() }}"
  - "{{ log_run_start(run_started_at, invocation_id) }}"

on-run-end:
  - "{{ log_run_end(run_started_at, invocation_id, results) }}"
  - "call sp_update_freshness_metadata()"
```

#### Audit log macro

```sql
-- macros/utils/log_run_start.sql
{% macro log_run_start(run_started_at, invocation_id) %}

    insert into {{ target.schema }}.dbt_run_log
        (invocation_id, run_started_at, target_name, command)
    values (
        '{{ invocation_id }}',
        '{{ run_started_at }}',
        '{{ target.name }}',
        '{{ invocation_args_dict.get("which", "unknown") }}'
    )

{% endmacro %}
```

> [!note] Results variable in on-run-end
>
> The `results` variable is available only in `on-run-end`. It is a list of `Result` objects with `.node.name`, `.status`, `.execution_time`, and `.message`. Use it to write per-model run statistics to an audit table.

---

### Jinja and Macro Anti-Patterns

> [!danger] Anti-patterns to avoid

**1. Logic in macros instead of models**
Macros are for reusable SQL *fragments*, not entire transformation logic. Complex business rules (constituent eligibility, factor construction) belong in model SQL where they are testable and documented.

**2. Skipping the `execute` guard in `run_query`**
Without `{% if execute %}`, the query runs during `dbt parse`, which fires on every `dbt` command including `dbt debug` and `dbt deps`. This dramatically slows CI.

**3. Hardcoding target names**
```sql
-- Bad
{% if target.name == 'prod_us' or target.name == 'prod_eu' %}

-- Better: use a custom variable
{% if var('is_production', false) %}
```

**4. Macros that generate different SQL on re-runs**
Any macro that calls `run_query` to discover column values must return the same result on re-runs for incremental models to be idempotent. Cache results in a variable at compile time.

**5. Circular macro dependencies**
If `macro_a` calls `macro_b` and `macro_b` calls `macro_a`, dbt will raise a Jinja recursion error. Keep macros shallow and composable.

**6. Using `{% set %}` inside compiled SQL expressions**
Jinja `{% set %}` runs at compile time. Assigning a value with `{% set x = some_sql_column %}` does not execute SQL — it sets a compile-time string. Confusing compile-time and run-time is the most common Jinja mistake.

---

## Related

- [dbt-packages](https://alp78.github.io/elysium/11-dbt/Advanced/dbt-packages)
- [dbt-core-concepts](https://alp78.github.io/elysium/11-dbt/Foundations/dbt-core-concepts)
- [dbt-cross-adapter-patterns](https://alp78.github.io/elysium/11-dbt/Adapters/dbt-cross-adapter-patterns)
- [dbt-data-contracts-implementation](https://alp78.github.io/elysium/11-dbt/Quality/dbt-data-contracts-implementation)
- [dbt-testing-framework](https://alp78.github.io/elysium/11-dbt/Quality/dbt-testing-framework)
