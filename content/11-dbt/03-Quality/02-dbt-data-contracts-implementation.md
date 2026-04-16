---
title: "02 - dbt: Data Contracts Implementation"
tags: [pipeline, dbt]
status: stable
updated: 2026-03-23
description: "Model contracts, access levels, versioning, and breaking-change detection for financial data pipelines"
---

# dbt: Data Contracts Implementation

> [!quote]+
>
> "With a sufficient number of users of an API, it does not matter what you promise in the contract: all observable behaviors of your system will be depended on by somebody."
>
> Source: Hyrum Wright

> [!abstract]- Summary
>
> Explains how dbt turns data contracts into build-time enforcement for published models by combining schema declarations, access levels, versioning, CI checks, and deprecation rules so downstream consumers can rely on stable model interfaces.
>
> **Contract enforcement model**
> - Defines what a dbt data contract is, how `contract.enforced: true` works, and why declared columns plus `data_type` move YAML from passive documentation into active build guards
> - Explains contract enforcement as a compile-time interface check that stops unstable model shape from reaching the warehouse or downstream consumers
>
> **Access, ownership, and versioning**
> - Covers access levels, groups, public versus protected models, and versioned model publication so teams can decide who may depend on a model and how breaking changes are rolled out safely
> - Shows how access control and versioning turn marts into explicit consumer-facing APIs rather than accidental internal implementation details
>
> **CI detection and lifecycle management**
> - Covers breaking-change detection in CI, source-freshness checks in the contract workflow, full annotated contract examples, and deprecation of older model versions so contract evolution stays reviewable and operationally safe
> - Connects contract implementation to dbt Mesh-style sharing, where stability is enforced not just socially but through project metadata and CI gates
>
> **Operations and safety**
> - Warnings: mismatched `data_type` declarations, overexposed public models, breaking changes without versioning, CI that checks contracts too late, and relying on naming conventions alone to enforce layer boundaries
> - Recommendations: contract only the models that are real interfaces, combine access levels with ownership groups, version before breaking consumers, and push change detection into CI before deployment

> [!info]- Glossary
>
> **Data contract**
> - A declared promise about a model's columns, types, and interface shape that dbt can enforce during builds.
> - It matters here because the note is about making model schemas enforceable and publishable rather than merely documented.
>
> > [!warning] Interface, not just documentation
> >
> > Once a contract is enforced, schema drift becomes a build failure instead of a downstream surprise. That is a deliberate operational boundary, not a metadata nicety.
>
> ---
>
> **`contract.enforced: true`**
> - A dbt config that tells dbt to reject a model build when the produced schema does not match the declared contract.
> - It matters here because this flag is what turns a model's YAML declaration into an active build-time gate.
>
> > [!warning] Strictness is the point
> >
> > Enforced contracts are supposed to fail loudly when model shape changes. If a model changes frequently, contract it later or version it before consumers depend on it.
>
> ---
>
> **`data_type`**
> - The adapter-specific type declaration for a contracted model column.
> - It matters here because contract enforcement compares actual output types to declared types, so type precision is part of interface stability.
>
> > [!warning] Adapter types still matter
> >
> > Even with dbt normalization, warehouses differ in type names and behavior. Type declarations should match the actual adapter semantics, not generic intuition.
>
> ---
>
> **Build-time enforcement**
> - The practice of catching schema mismatches during dbt compilation and build execution before downstream data is published.
> - It matters here because the note frames contracts as proactive failure boundaries rather than post-hoc debugging tools.
>
> > [!info] Stop drift before publish
> >
> > Catching shape changes at build time is much cheaper than discovering them after dashboards, APIs, or regulatory feeds have already consumed the wrong schema.
>
> ---
>
> **Access level**
> - A dbt model config that controls which other models or projects may reference a model.
> - It matters here because contracts are strongest when they are paired with explicit rules about who is allowed to depend on the model.
>
> > [!warning] Visibility is part of stability
> >
> > A stable interface still becomes risky if every model can depend on it freely. Access settings limit blast radius when the contract evolves.
>
> ---
>
> **`private` / `protected` / `public`**
> - The main dbt access modes that restrict refs to a group, a project, or downstream projects respectively.
> - It matters here because the note uses them to distinguish internal implementation models from shared, consumer-facing interfaces.
>
> > [!warning] Public means wider promise
> >
> > Making a model public is not just changing a flag. It signals that outside projects may now treat the model as a supported dependency.
>
> ---
>
> **Group**
> - A dbt ownership and scoping construct used to organize models and enforce some access-level boundaries.
> - It matters here because groups connect contract enforcement to accountable teams rather than leaving model interfaces ownerless.
>
> > [!info] Ownership metadata with teeth
> >
> > Groups are useful because they are more than labels: they help make access and responsibility explicit at the project level.
>
> ---
>
> **Model version**
> - A numbered published variant of a model that lets a new breaking schema coexist with an older supported interface.
> - It matters here because versioning is the safe path for evolving contracted marts without forcing a big-bang migration on all consumers.
>
> > [!warning] Breaking changes need a runway
> >
> > If consumers already depend on a model, replacing it in place is often operationally reckless. Versioning creates a migration window instead of a sudden outage.
>
> ---
>
> **`latest_version`**
> - The dbt metadata field that declares which version of a model should be considered the current default.
> - It matters here because version management only works cleanly when one version is clearly designated as the preferred interface.
>
> > [!info] Default interface marker
> >
> > `latest_version` helps new consumers land on the right interface without requiring every ref to specify a version manually.
>
> ---
>
> **Breaking change**
> - A schema or interface modification that invalidates existing downstream assumptions, such as removing a column or changing a type incompatibly.
> - It matters here because the note's CI workflow is explicitly about catching these changes before they land.
>
> > [!warning] Observable behavior is depended on
> >
> > Consumers often depend on more than what the model owner intended. Treat any externally visible shape change as potentially breaking until proven otherwise.
>
> ---
>
> **Breaking-change detection in CI**
> - The automated comparison and validation workflow that checks whether a proposed model change violates current contractual expectations before merge.
> - It matters here because contract enforcement is strongest when paired with pre-merge detection rather than left until a production run fails.
>
> > [!info] Earlier failure, lower blast radius
> >
> > CI is the right place to surface contract drift because reviewers can still stop or version the change before consumers are exposed.
>
> ---
>
> **dbt Mesh**
> - An architectural pattern where multiple dbt projects share certified, versioned, contract-enforced models across project boundaries.
> - It matters here because public, contract-enforced models are the building blocks for cross-project consumption without tightly coupling transformation logic.
>
> > [!warning] Shared interfaces need higher discipline
> >
> > Once models cross project boundaries, sloppy naming, weak ownership, and unversioned breaking changes stop being local problems and become platform issues.
>
> ---
>
> **Deprecation**
> - The controlled retirement process for an older model version after consumers have had time to migrate.
> - It matters here because versioning only solves breaking change management if old versions are eventually phased out in a planned, visible way.
>
> > [!info] Versioning needs an exit plan
> >
> > Keeping every version forever avoids immediate breakage but creates permanent complexity. Deprecation is how the interface lifecycle stays manageable.

## What Is a dbt Data Contract?

A **data contract** is a schema declaration on a model that dbt enforces during `dbt run`. When `contract.enforced: true` is set, dbt will:

1. Compile the model SQL.
2. Introspect the actual column list and data types produced.
3. Raise a compilation error if the output does not match the declared columns exactly.

This transforms YAML schema files from documentation into active guardrails.

> [!info] Contracts are build-time, not content-quality checks
>
> Contract enforcement fires before SQL is executed in the warehouse. A mismatched column type or missing column stops the build immediately, but contracts only protect interface shape. They do not prove the published values are semantically correct, which is why tests and observability still matter.

---

## Enabling a dbt Data Contract

Add the `contract` block to the model's config in YAML. The model must also declare every column with its `data_type`.

*This YAML contract turns a mart schema into an enforceable interface by declaring every published column and its adapter-specific type explicitly.*

```yaml
# models/marts/finance/_finance__models.yml

models:
  - name: fct_index_performance
    config:
      contract:
        enforced: true
    description: >
      Daily performance attribution for each index constituent.
      This is the canonical performance fact table for reporting.
    columns:
      - name: performance_key
        data_type: varchar
        description: Surrogate key (index_id + constituent_id + price_date).
        constraints:
          - type: not_null
          - type: primary_key

      - name: index_id
        data_type: varchar
        description: Unique identifier for the benchmark index (e.g. MSCI_WORLD).
        constraints:
          - type: not_null

      - name: constituent_id
        data_type: varchar
        description: ISIN or internal security identifier.
        constraints:
          - type: not_null

      - name: price_date
        data_type: date
        description: Business date for this performance observation.
        constraints:
          - type: not_null

      - name: weight_bop
        data_type: numeric
        description: Constituent weight at beginning of period (decimal, 0–1).

      - name: total_return_local
        data_type: numeric
        description: Total return in local currency for the period.

      - name: total_return_usd
        data_type: numeric
        description: Total return converted to USD using WM/Reuters 4pm fix.

      - name: contribution_to_return
        data_type: numeric
        description: Weight × return. Sums to index total return across all rows.

      - name: esg_score
        data_type: numeric
        description: Composite ESG score at price_date (0–100 scale).

      - name: esg_provider_id
        data_type: varchar
        description: Source ESG data provider (MSCI, Sustainalytics, ISS).

      - name: loaded_at
        data_type: timestamp
        description: Pipeline load timestamp (UTC).
```

> [!info] Supported data types
>
> Data types must match your adapter's native types. In BigQuery use `FLOAT64` rather than `FLOAT`; in Snowflake use `NUMBER` or `FLOAT`. dbt normalizes some common aliases, but nested and adapter-specific types still need to match the warehouse you actually build against.

---

## Model Access Levels

Access levels control which other models can `ref()` a given model. They enforce a clear layered architecture without relying on naming conventions alone.

| Level       | Who can `ref()` it                                 | Typical use                             |
| ----------- | -------------------------------------------------- | --------------------------------------- |
| `private`   | Models in the **same subdirectory / group**        | Intermediate staging helpers            |
| `protected` | Models in the **same dbt project** (default)       | Shared intermediate models across teams |
| `public`    | Any project, including **downstream mesh projects** | Stable mart / fact tables               |

### Declaring Access

*This config block uses access levels to distinguish internal implementation models from stable interfaces other teams or projects may depend on.*

```yaml
models:
  - name: int_index_constituents_enriched
    config:
      access: private       # Only usable by models in the same group

  - name: dim_security
    config:
      access: protected     # Available within this project only

  - name: fct_index_performance
    config:
      access: public        # Exposed to all downstream dbt Mesh projects
      contract:
        enforced: true
```

### Model Groups

Groups pair with access levels to provide ownership metadata and restrict private models.

*This ownership metadata ties access control to a named team so public and private boundaries are accountable instead of implied by naming alone.*

```yaml
# models/marts/finance/_groups.yml

groups:
  - name: index_analytics
    owner:
      name: Index Engineering
      email: index-eng@example.com
```

```yaml
models:
  - name: int_cap_weight_calc
    config:
      group: index_analytics
      access: private
```

Attempting to `ref('int_cap_weight_calc')` from outside the `index_analytics` group raises a compile-time error.

> [!tip] Access plus contracts together enable Mesh
>
> Public, contract-enforced models are the building blocks of dbt Mesh. They let multiple dbt projects share certified data without tightly coupling their transformation logic.

---

## Model Versions

Model versioning lets you publish a new breaking schema while keeping the old version live for existing consumers — no big-bang migrations.

### Declaring Versions

*This version declaration publishes a new contract without forcing every consumer to migrate on the same day.*

```yaml
# models/marts/finance/_finance__models.yml

models:
  - name: fct_index_performance
    latest_version: 2
    config:
      contract:
        enforced: true
      access: public

    versions:
      - v: 1
        config:
          alias: fct_index_performance_v1   # Materialized under this name
        defined_in: fct_index_performance_v1 # Points to the v1 SQL file

      - v: 2
        # Uses the default file: fct_index_performance.sql
```

dbt creates two separate materialisations: `fct_index_performance_v1` and `fct_index_performance` (the v2 current version).

### Version SQL Files

*This file layout keeps legacy and current SQL implementations side by side while the YAML metadata decides which version is the default interface.*

```text
models/
  marts/
    finance/
      fct_index_performance_v1.sql   ← v1 (legacy schema)
      fct_index_performance.sql      ← v2 (current / latest)
      _finance__models.yml
```

**v1 SQL** (legacy — no ESG columns):

*This legacy version preserves the original consumer-facing schema while newer versions evolve independently.*

```sql
-- models/marts/finance/fct_index_performance_v1.sql
{{
  config(
    materialized = 'incremental',
    unique_key   = 'performance_key',
    on_schema_change = 'fail'
  )
}}

select
    {{ dbt_utils.generate_surrogate_key(['index_id', 'constituent_id', 'price_date']) }}
        as performance_key,
    index_id,
    constituent_id,
    price_date,
    weight_bop,
    total_return_local,
    total_return_usd,
    weight_bop * total_return_usd as contribution_to_return,
    loaded_at
from {{ ref('int_index_constituents_enriched') }}
```

**v2 SQL** (adds ESG columns):

*This current version extends the published contract with ESG attributes while keeping the older version available for controlled migration.*

```sql
-- models/marts/finance/fct_index_performance.sql
{{
  config(
    materialized = 'incremental',
    unique_key   = 'performance_key',
    on_schema_change = 'fail'
  )
}}

select
    {{ dbt_utils.generate_surrogate_key(['index_id', 'constituent_id', 'price_date']) }}
        as performance_key,
    index_id,
    constituent_id,
    price_date,
    weight_bop,
    total_return_local,
    total_return_usd,
    weight_bop * total_return_usd as contribution_to_return,
    esg.composite_score                as esg_score,
    esg.provider_id                    as esg_provider_id,
    p.loaded_at
from {{ ref('int_index_constituents_enriched') }} p
left join {{ ref('int_esg_scores_latest') }}     esg
    using (constituent_id, price_date)
```

### Referencing Specific Versions

Consumers pin to a version to opt in to upgrades explicitly:

*These refs show how downstream projects can stay on a stable contract version or opt into the latest interface intentionally.*

```sql
-- Pin to stable v1 until migration is complete
select * from {{ ref('fct_index_performance', v=1) }}

-- Opt in to v2
select * from {{ ref('fct_index_performance', v=2) }}

-- Always use latest (v=2 today)
select * from {{ ref('fct_index_performance') }}
```

---

## Breaking Change Detection in CI

Use `dbt state:modified` with the `--select` flag in your CI pipeline to catch contract violations before they reach production.

### CI Workflow (GitHub Actions)

*This CI workflow compares the branch state to a production manifest so contract-breaking changes fail before they reach deployment.*

```yaml
# .github/workflows/dbt-ci.yml

name: dbt CI

on:
  pull_request:
    branches: [main]

jobs:
  dbt-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install dbt
        run: pip install dbt-bigquery==1.8.*

      - name: Download production manifest
        run: |
          gsutil cp gs://my-dbt-artifacts/manifest.json ./prod-manifest/manifest.json

      - name: dbt compile (new state)
        run: dbt compile --target prod

      - name: Check for breaking contract changes
        run: |
          dbt build \
            --select "state:modified+" \
            --defer \
            --state ./prod-manifest \
            --target prod
```

`state:modified+` runs only models that changed in this PR, plus all downstream dependents — catching cascading contract breaks without rebuilding the entire project. For the full quality context in which these contract checks operate, see [data-quality-framework](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/data-quality-framework).

### Catching Column Removals

If a PR removes `esg_score` from `fct_index_performance`, the contract check fails:

```text
Compilation Error in model fct_index_performance
  Contract breach: column 'esg_score' is declared in the contract
  but was not found in the model's SQL output.
  Contract enforced: true
```

The PR is blocked until the column is restored or the contract YAML is updated and the version is bumped.

> [!warning] Breaking schema changes
>
> Removing a declared column or changing its data type is always a breaking change regardless of version. To remove a column gracefully: publish a new version, deprecate the old one, give consumers a migration window, then delete the old version.

> [!success] Safe pattern: version-bump before removal
>
> Increment `latest_version`, define the new schema in the new version, set a `deprecation_date` on the old version, and notify consumers. Only delete the old version SQL file and YAML entry once no `ref(..., v=N)` calls to it remain in downstream projects.

### `dbt source freshness` in CI

Pair contract checks with source freshness gates so the pipeline fails before running if upstream feeds are stale:

*This source configuration and command make upstream staleness part of the same CI gate that protects contracted downstream interfaces.*

```yaml
# sources.yml
sources:
  - name: index_provider_raw
    freshness:
      warn_after:  {count: 4,  period: hour}
      error_after: {count: 24, period: hour}
    loaded_at_field: _ingested_at
    tables:
      - name: raw_constituent_weights
      - name: raw_esg_scores
```

*This freshness command narrows the gate to the upstream source group the contracted marts depend on most directly.*

```bash
dbt source freshness --select source:index_provider_raw
```

---

## Full Annotated Contract: fct_index_performance

This consolidates all concepts: contract enforcement, public access, versioning, and column-level constraints.

*This end-to-end example combines access, contract enforcement, versioning, and column-level rules into one published mart definition.*

```yaml
models:
  - name: fct_index_performance
    description: >
      Public, contract-enforced fact table for daily index constituent performance.
      v1 is maintained for legacy consumers. v2 adds ESG columns.
      Breaking changes require a version bump and migration notice.
    latest_version: 2
    config:
      access: public
      contract:
        enforced: true
      materialized: incremental
      unique_key: performance_key
      on_schema_change: fail

    constraints:
      - type: primary_key
        columns: [performance_key]

    versions:
      - v: 1
        defined_in: fct_index_performance_v1
        config:
          alias: fct_index_performance_v1
      - v: 2

    columns:
      - name: performance_key
        data_type: varchar
        constraints: [{type: not_null}, {type: primary_key}]

      - name: index_id
        data_type: varchar
        constraints: [{type: not_null}]
        tests:
          - accepted_values:
              values: ['MSCI_WORLD', 'MSCI_EM', 'RUSSELL_1000', 'FTSE_100']

      - name: constituent_id
        data_type: varchar
        constraints: [{type: not_null}]

      - name: price_date
        data_type: date
        constraints: [{type: not_null}]
        tests:
          - not_null
          - dbt_utils.expression_is_true:
              expression: ">= '2000-01-01'"

      - name: weight_bop
        data_type: numeric
        tests:
          - dbt_utils.expression_is_true:
              expression: "between 0 and 1"

      - name: total_return_local
        data_type: numeric

      - name: total_return_usd
        data_type: numeric

      - name: contribution_to_return
        data_type: numeric

      - name: esg_score
        data_type: numeric
        description: "Only present in v2+. Null when ESG data unavailable."
        tests:
          - dbt_utils.expression_is_true:
              expression: "is null or (between 0 and 100)"

      - name: esg_provider_id
        data_type: varchar
        description: "Only present in v2+."
        tests:
          - accepted_values:
              values: ['MSCI', 'SUSTAINALYTICS', 'ISS', 'REFINITIV']
              quote: false
              where: "esg_provider_id is not null"

      - name: loaded_at
        data_type: timestamp
        constraints: [{type: not_null}]
```

---

## Deprecating a dbt Model Version

Once consumers have migrated away from v1, mark it deprecated before removing:

*This deprecation marker gives downstream teams a dated migration window before the legacy interface is physically removed.*

```yaml
versions:
  - v: 1
    defined_in: fct_index_performance_v1
    config:
      alias: fct_index_performance_v1
    deprecation_date: "2026-06-30"   # dbt emits a warning after this date

  - v: 2
```

dbt will print a deprecation warning for any `ref(..., v=1)` call after `2026-06-30`, giving teams a grace period before the model is physically removed.

---

## Related

- [dbt-testing-framework](https://alp78.github.io/elysium/11-dbt/Quality/dbt-testing-framework)
- [data-contracts](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/data-contracts)
- [dbt-core-concepts](https://alp78.github.io/elysium/11-dbt/Foundations/dbt-core-concepts)
- [dbt-macros-and-jinja](https://alp78.github.io/elysium/11-dbt/Advanced/dbt-macros-and-jinja)
- [dbt-packages](https://alp78.github.io/elysium/11-dbt/Advanced/dbt-packages)
