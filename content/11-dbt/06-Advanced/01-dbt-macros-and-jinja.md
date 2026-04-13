---
title: "01 - dbt: Macros and Jinja"
tags: [pipeline, dbt]
status: stable
updated: 2026-03-23
description: "Jinja2 fundamentals, writing macros, dbt-utils patterns, dispatch, hooks, and anti-patterns for financial data pipelines"
---

# dbt: Macros and Jinja

> [!quote]
> "A programming language is for thinking of programs, not for expressing programs you've already thought of."
>
> — **Paul Graham**, *Hackers & Painters* (2004)

> [!abstract]- Summary
>
> dbt macros turn Jinja into a compile-time programming layer for SQL, and this note defines the templating, reusable macro, package, hook, and guardrail patterns needed to keep financial-data transformations DRY without confusing compile-time abstractions with warehouse-time execution.
>
> **Jinja and macro fundamentals**
> - Explains the three Jinja delimiters, the roles of `var()`, `env_var()`, filters, loops, and conditionals, and the difference between scalar runtime variables and reusable macros.
> - Frames macros as the primary reuse mechanism for repeated financial calculations such as z-scores, weighted averages, factor exposures, and cap-weighted returns.
>
> **Reusable macro design**
> - Builds custom finance macros such as `z_score`, `weighted_average`, and `cap_weighted_return`, then extends reuse with `dbt_utils` helpers including surrogate keys, date spines, pivots, and `star` expansion.
> - Shows how dynamic SQL generation can stay adapter-agnostic when macro interfaces are stable and SQL fragments remain narrow.
>
> **Cross-adapter and introspection patterns**
> - Uses dispatch macros to hide adapter-specific SQL differences and `run_query()` plus `agate.Table` results to discover metadata during execution.
> - Requires `{% if execute %}` guards so introspection macros still parse and compile safely outside full runs.
>
> **Hooks, audit logging, and safe design**
> - Covers model-level `pre_hook` and `post_hook`, run-level `on-run-start` and `on-run-end`, grant and audit-log macros, and packaged utility patterns such as schema overrides, grants, pseudonymisation, and SQL Server date spines.
> - Warnings: distinguish compile time from run time, guard all `run_query()` calls, keep macro dependencies shallow, and treat the anti-pattern checklist as the operational boundary.
> - Recommendations table: the anti-pattern section and useful macro patterns form the note's safe implementation guide.

> [!note]- Glossary
>
> **Jinja2**
> - The templating language dbt uses to generate SQL before sending statements to the warehouse.
> - It matters here because every macro, loop, filter, hook expression, and conditional in the note is evaluated by Jinja during compilation rather than by the database engine directly.
>
> > [!warning] Compile-time language
> >
> > Jinja feels embedded inside SQL, but it does not execute SQL expressions. Confusing Jinja evaluation with warehouse execution is the fastest way to write broken macros.
>
> ---
>
> **Macro**
> - A reusable dbt function written in Jinja that returns SQL fragments, strings, or side-effect statements.
> - It matters here because macros are the mechanism the note uses to standardize repeated financial calculations and operational hooks.
>
> > [!info] Reuse boundary
> >
> > Macros work best as small, composable generators. When they absorb full business transformations, testing and code review both get worse.
>
> ---
>
> **`{{ ... }}`**
> - The Jinja expression delimiter that renders a value into the compiled SQL text.
> - It matters here because refs, macro calls, and rendered literals use this syntax throughout dbt models and hooks.
>
> > [!info] Text substitution surface
> >
> > Expressions emit text into compiled SQL. If what you emit is invalid for the target adapter, the warehouse sees the invalid result exactly as rendered.
>
> ---
>
> **`{% ... %}`**
> - The Jinja statement delimiter used for control flow, assignment, loops, and macro definitions.
> - It matters here because macro bodies, `if execute` guards, loops, and hook logic all depend on statement blocks rather than rendered expressions.
>
> > [!warning] No direct SQL output
> >
> > Statement blocks control generation but do not print SQL by themselves. Assuming they behave like `{{ ... }}` produces confusing compile results.
>
> ---
>
> **`var()`**
> - A dbt helper that reads project or CLI-supplied variables with an optional default.
> - It matters here because the note treats variables as runtime configuration inputs rather than as substitutes for reusable SQL logic.
>
> > [!info] Externalized parameter
> >
> > Use `var()` for environment- or run-specific values, not for hiding logic that ought to remain explicit in model code.
>
> ---
>
> **`env_var()`**
> - A dbt helper that reads environment variables from the OS process running dbt.
> - It matters here because credentials, environment names, and secret-backed configuration belong outside project code and inside process environment state.
>
> > [!danger] Secret exposure surface
> >
> > `env_var()` is safer than hardcoding secrets in repo files, but the secret still exists in the runtime environment. Scope CI and shell environments carefully.
>
> ---
>
> **`dbt_utils`**
> - A shared dbt package providing commonly used cross-database macros and helper patterns.
> - It matters here because the note uses it as the default source of reusable primitives before recommending custom macro implementations.
>
> > [!info] Prefer existing primitives
> >
> > Start with the shared package before writing bespoke helpers. Custom macros should cover domain-specific gaps, not recreate standard utilities.
>
> ---
>
> **Dispatch macro**
> - A macro pattern that routes a generic macro call to an adapter-specific implementation while preserving a stable interface.
> - It matters here because adapter portability for expressions such as safe division depends on moving syntax differences out of model SQL.
>
> > [!warning] Stable contract required
> >
> > Dispatch is only useful when every override means the same thing semantically. If overrides drift into different business rules, the abstraction is lying.
>
> ---
>
> **`adapter.dispatch()`**
> - The dbt helper that resolves which macro implementation should be used for the active adapter.
> - It matters here because it is the compile-time mechanism behind portable macro calls across BigQuery, SQL Server, and other warehouses.
>
> > [!info] Adapter selection point
> >
> > Resolution happens before query execution. That makes dispatch ideal for portability, but it also means namespace and override mistakes fail early in compile or run preparation.
>
> ---
>
> **`run_query()`**
> - A dbt macro helper that executes SQL during dbt execution and returns the results as an `agate.Table`.
> - It matters here because introspection patterns in the note use it to discover providers, columns, or metadata before rendering final SQL.
>
> > [!warning] Execution-phase only
> >
> > `run_query()` is not safe during parse-only phases. Unguarded calls slow automation and can break commands that should never touch the warehouse.
>
> ---
>
> **`execute`**
> - A dbt/Jinja boolean that tells a macro whether dbt is currently executing statements or only parsing and compiling.
> - It matters here because all `run_query()` patterns in the note need `if execute` guards to remain safe during parse and compile commands.
>
> > [!warning] Mandatory guardrail
> >
> > Forgetting this guard is one of the most common macro mistakes. It turns harmless compilation into accidental warehouse access or parser errors.
>
> ---
>
> **`agate.Table`**
> - The lightweight Python table object returned by `run_query()` that exposes query results to Jinja macros.
> - It matters here because introspection macros pull values out of its columns to generate dynamic SQL.
>
> > [!info] Compile-time result container
> >
> > This is a Jinja-side object, not a warehouse table. Treat it as temporary metadata used to render SQL, not as a persistent runtime dataset.
>
> ---
>
> **`pre_hook` / `post_hook`**
> - Model-level dbt config hooks that run SQL before or after a model materializes.
> - It matters here because grant statements, audit logging, index creation, and maintenance commands attach to models through these hooks.
>
> > [!warning] Side effects need discipline
> >
> > Hooks change state outside the model's select statement. Keep them deterministic and idempotent so repeated runs do not create unpredictable warehouse state.
>
> ---
>
> **`on-run-start` / `on-run-end`**
> - Project-level hooks that run once at the beginning or end of a dbt invocation.
> - It matters here because pipeline-wide audit logging, setup, and teardown belong at run scope rather than on individual models.
>
> > [!warning] Different scope than model hooks
> >
> > These hooks execute once per invocation, not once per model. Putting model-specific assumptions here usually creates misleading audit rows or duplicated work.
>
> ---
>
> **Idempotence**
> - The property that rerunning the same dbt command produces the same logical result without unintended side effects.
> - It matters here because macros that introspect changing metadata or emit non-deterministic SQL can make incremental models and hooks unsafe across reruns.
>
> > [!warning] Re-run safety matters
> >
> > A macro that returns different SQL on identical reruns undermines reproducibility. Cache introspection results and avoid hidden state in macro design.
>
> ---
>
> **Compile time vs run time**
> - The distinction between dbt rendering Jinja into SQL and the warehouse later executing the rendered SQL.
> - It matters here because nearly every anti-pattern in the note comes from crossing that boundary incorrectly.
>
> > [!danger] Core mental model boundary
> >
> > If this distinction is blurred, macros, hooks, and dynamic SQL all become difficult to reason about. Treat compile time as code generation and run time as warehouse execution.

> [!example] Macro Design Scope
>
> > [!success] Controlled Reuse
> >
> > - Use macros when the same SQL fragment, audit hook, or adapter abstraction repeats often enough that copy-paste would create maintenance drift across models or projects.
> > - Keep macro interfaces narrow and explicit when generating finance calculations, hooks, or cross-adapter SQL so reviewers can still understand the compiled behavior.
>
> > [!failure] Opaque Logic
> >
> > - Avoid burying core business transformations inside deep macro stacks that make the real SQL hard to review, test, or debug.
> > - Do not let macros generate non-idempotent side effects or depend on brittle environment-name branching when straightforward model SQL would be clearer and safer.

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

> [!success] Standard execute guard pattern
> Wrap every `run_query()` call in `{% if execute %}...{% else %}{{ return([]) }}{% endif %}`. The `else` branch returns a safe empty default so macros that call this helper also receive a valid type during parse/compile without crashing.

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

> [!success] Safe macro design principles
> Keep macros as thin SQL fragment generators. Business logic belongs in model SQL where it is version-controlled and testable. Use `{% if execute %}` guards around all `run_query()` calls. Prefer `var('is_production', false)` over `target.name` string comparisons. Ensure macros that call `run_query()` cache results in a Jinja variable so they are evaluated only once per compile pass.

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

---

## Useful Macro Patterns

Production-tested macro snippets for common cross-project needs.

### Dynamic Schema Override

Override dbt's default schema naming so prod uses the custom schema directly while dev prefixes it.

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

Post-hook macro to grant read access on a schema after models are built.

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

Hash PII columns in dev but leave them readable in prod.

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

Generate a continuous date range using a recursive CTE — useful for gap-filling time series.

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
