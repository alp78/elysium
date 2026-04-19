---
title: "02 - dbt: Snapshots and SCD"
tags: [data-modeling, pipeline, dbt]
status: stable
updated: 2026-03-23
description: "SCD Type 2 snapshots with timestamp and check strategies, PIT queries, ESG audit trails, and gotchas for financial data pipelines"
---

# dbt: Snapshots and SCD

> [!quote]+
>
> "The ability to visualize something as abstract as a set of data in a concrete and tangible way is the secret of understandability."
>
> — **Ralph Kimball**, *The Data Warehouse Toolkit* (2013)

> [!abstract]- Summary
>
> dbt snapshots implement SCD Type 2 history by closing changed rows and opening new versions over time, and this note defines the snapshot strategies, metadata columns, point-in-time query patterns, ESG and index-history use cases, and destructive edge cases required to preserve reproducible historical state in financial pipelines.
>
> **Snapshot mechanics and strategy choice**
> - Explains how dbt snapshots compare the source against a `unique_key`, generate `dbt_scd_id`, `dbt_valid_from`, `dbt_valid_to`, and `dbt_updated_at`, and notes that SQL snapshot blocks remain supported while YAML-based snapshot definitions are the newer recommended pattern.
> - Compares `timestamp` and `check` strategies, including reliable `updated_at` usage, explicit `check_cols`, and a decision matrix for high-volume or append-style sources.
>
> **Production snapshot patterns**
> - Builds full snapshots for index constituents and ESG ratings, with source keys, tracked business columns, metadata fields, tags, post-hooks, and hard-delete behavior configured for the data domain.
> - Emphasizes that membership, weights, and provider scores must remain historically reconstructible for audit, regulatory, and portfolio-analysis use cases.
>
> **Point-in-time reconstruction**
> - Uses PIT filters and PIT joins to rebuild historical constituent sets, sector weights, and portfolio or index performance as of a specific date.
> - Distinguishes pipeline metadata timestamps from business-effective dates and shows when source `effective_date` or `provider_updated_at` must drive business logic.
>
> **Operations and safety**
> - Warnings: deduplicate `unique_key` in the source, never treat `dbt_valid_from` as business time, avoid `check_cols = 'all'` on wide sources, and treat snapshot rebuilds and config migrations as manual history-affecting operations.
> - Preventive checklist: the gotchas section defines 6 major failure modes and the concrete mitigations for each.
> - Runtime sequence: snapshots belong in a dedicated pipeline step between freshness checks and downstream model builds.

> [!info]- Glossary
>
> **Snapshot**
> - A dbt construct that stores changing source records as a historical table instead of overwriting each entity with only its latest state.
> - It matters here because the entire note is about preserving auditable temporal history for financial entities that change over time.
>
> > [!info] Historical state capture
> >
> > A snapshot is not just another model materialization. It is a long-lived history table whose operational semantics differ from ordinary tables and incrementals.
>
> ---
>
> **SCD Type 2**
> - A slowly changing dimension pattern that keeps prior row versions by closing old records and inserting new active ones when attributes change.
> - It matters here because dbt snapshots implement this pattern directly for index membership, weights, ESG ratings, and similar changing dimensions.
>
> > [!warning] History, not overwrite
> >
> > The point of SCD2 is to preserve what was true at a given time. If downstream logic still queries only the latest row, the extra complexity buys nothing.
>
> ---
>
> **`unique_key`**
> - The snapshot configuration field that identifies which source rows represent the same logical entity across time.
> - It matters here because every change-detection and history boundary in the snapshot depends on choosing the right entity grain.
>
> > [!warning] Grain defines history
> >
> > A bad `unique_key` creates the wrong history forever. Choose the business entity carefully before the snapshot table becomes operationally important.
>
> ---
>
> **`dbt_scd_id`**
> - The surrogate identifier dbt assigns to each stored snapshot row version.
> - It matters here because it uniquely distinguishes historical versions of the same logical entity inside the snapshot table.
>
> > [!info] Version row identity
> >
> > This is not the business key. Use it to distinguish stored versions, not to replace the entity identity represented by `unique_key`.
>
> ---
>
> **`dbt_valid_from` / `dbt_valid_to`**
> - The snapshot metadata columns that mark when a stored row version became active and when it stopped being active in snapshot history.
> - It matters here because every PIT filter in the note uses these boundaries to decide which version was active at a given point.
>
> > [!danger] Pipeline time boundary
> >
> > These timestamps record when dbt processed change, not necessarily when the business change became effective. Treat them as snapshot-system validity unless the pipeline timing matches business timing exactly.
>
> ---
>
> **`dbt_updated_at`**
> - A snapshot metadata column recording when dbt last touched a given snapshot row.
> - It matters here because it supports operational auditing and helps distinguish snapshot processing activity from business-effective change columns.
>
> > [!info] Operational metadata only
> >
> > This field is useful for pipeline diagnosis, not for business-date analytics. Keep that separation clear in downstream logic.
>
> ---
>
> **`timestamp` strategy**
> - A snapshot mode where dbt uses a reliable source `updated_at` column to decide when a row has changed.
> - It matters here because it is the preferred option for high-volume sources with trustworthy upstream change timestamps.
>
> > [!warning] Source clock quality matters
> >
> > This strategy is only as good as the upstream timestamp discipline. If the source fails to update the timestamp consistently, history gaps become invisible.
>
> ---
>
> **`check` strategy**
> - A snapshot mode where dbt hashes selected columns and treats hash differences as row changes.
> - It matters here because it is the fallback when no trustworthy source change timestamp exists.
>
> > [!warning] More expensive and noisier
> >
> > `check` is flexible, but careless column selection can create unnecessary compute and spurious version churn. Use it deliberately rather than as the default.
>
> ---
>
> **`check_cols`**
> - The explicit list of columns dbt should compare when using the `check` strategy.
> - It matters here because it determines which source changes are treated as meaningful enough to create new historical versions.
>
> > [!warning] Avoid `all` on wide tables
> >
> > Hashing every column in a wide source is expensive and often semantically wrong. Exclude noisy metadata and retain only business-significant fields.
>
> ---
>
> **`hard_deletes`**
> - The current snapshot config that controls how dbt handles source rows that disappear, with modes such as `ignore`, `invalidate`, and `new_record`.
> - It matters here because membership tables such as index constituents often need removals to appear as ended or explicitly deleted history, not as still-open records.
>
> > [!warning] Correctness versus cost
> >
> > `hard_deletes: invalidate` replaces the legacy `invalidate_hard_deletes = true`, and `hard_deletes: new_record` adds explicit delete rows. Large snapshot tables need conscious performance planning before you enable either mode.
>
> ---
>
> **Point-in-time query**
> - A query that reconstructs which snapshot rows were active at a chosen timestamp or business date.
> - It matters here because historical portfolio and benchmark reconstruction depends on this filtering pattern.
>
> > [!info] Standard pattern worth centralizing
> >
> > PIT logic is easy to get subtly wrong. Standardize the predicate or macro so every downstream consumer applies the same active-row rules.
>
> ---
>
> **Business effective date**
> - The source-system date or timestamp indicating when a change is considered true in the business domain, independent of when the pipeline processed it.
> - It matters here because financial analytics often need to answer what was true on the market or provider date, not merely when dbt ingested the change.
>
> > [!danger] Do not substitute pipeline metadata
> >
> > Weekend delays, outages, and backfills make pipeline timestamps diverge from business truth. Preserve source effective dates explicitly when history needs to be analytically correct.
>
> ---
>
> **Snapshot rebuild / migration**
> - The manual process of backing up, altering, or recreating a snapshot table when you need to change snapshot configs or repair history.
> - It matters here because snapshot tables are long-lived history assets, and major changes require deliberate warehouse migrations rather than casual rebuild habits.
>
> > [!danger] Destructive history reset
> >
> > Treat any snapshot rebuild as a planned migration with backup and review, not as normal maintenance. On snapshots, convenience and safety are in direct conflict.
>
> ---
>
> **Snapshot config migration**
> - The dbt-supported process of carefully updating snapshot tables and configs when adopting newer snapshot features or changing the stored schema.
> - It matters here because additive schema evolution is common in provider feeds, and current dbt docs recommend explicit migration steps rather than assuming snapshots auto-adapt.
>
> > [!warning] Only solves additive change
> >
> > New snapshot configs such as `hard_deletes` and YAML-defined snapshots are best introduced through staged migration. Dropped columns or changed business grain still need planned warehouse work.
>
> ---
>
> **Snapshot pipeline step**
> - The dedicated pipeline stage where `dbt snapshot` runs before downstream models and tests consume historical state.
> - It matters here because the note positions snapshots as a specific DAG phase rather than as an incidental side task inside general model builds.
>
> > [!info] Ordering is part of correctness
> >
> > If snapshots run too late or inconsistently, downstream models consume the wrong history state. Placement in the DAG is an operational requirement, not a stylistic preference.

## Snapshot Mechanics

### How dbt Snapshots Work

1. dbt runs the snapshot's `select` query against the source.
2. For each row, dbt checks whether it already exists in the snapshot table (using `unique_key`).
3. If the row is **new**: insert with `dbt_valid_from = current_timestamp`, `dbt_valid_to = null`.
4. If the row **changed** (determined by strategy): close the old record (`dbt_valid_to = current_timestamp`), insert a new open record.
5. If the row is **unchanged**: do nothing.
6. If the row **disappeared** from the source: dbt does **not** automatically close it (a gotcha — see §7).

### Generated Metadata Columns

| Column | Type | Description |
| ------ | ---- | ----------- |
| `dbt_scd_id` | varchar | Surrogate key unique to each snapshot row |
| `dbt_updated_at` | timestamp | When dbt last touched this row |
| `dbt_valid_from` | timestamp | When this version of the row became active |
| `dbt_valid_to` | timestamp | When this version ended (null = currently active) |

If you use `hard_deletes: new_record`, dbt also adds `dbt_is_deleted` so explicit delete events appear as their own snapshot rows.

By default, the **current record** for any `unique_key` value is the row where `dbt_valid_to is null`. If you adopt `dbt_valid_to_current`, use that configured sentinel instead of `NULL` in PIT helpers.

### File Placement

Snapshots still commonly live in the `snapshots/` directory (configurable in `dbt_project.yml`). SQL files with `{% snapshot %}` blocks are still supported, but current dbt docs recommend YAML-defined snapshot configs for new work in dbt Core v1.9+ / Latest.

```
snapshots/
  snap_index_constituents.sql
  snap_esg_scores.sql
  snap_index_definitions.sql
```

---

### Snapshot Strategy: timestamp

Use `timestamp` when the source table has a reliable `updated_at` column maintained by the upstream system.

```sql
-- snapshots/snap_index_constituents.sql

{% snapshot snap_index_constituents %}

{{
  config(
    target_schema = 'snapshots',
    unique_key    = 'constituent_snapshot_key',
    strategy      = 'timestamp',
    updated_at    = 'provider_updated_at',
    hard_deletes = 'invalidate'
  )
}}

select
    -- Surrogate key: one record per index + constituent combination
    index_id || '|' || constituent_id   as constituent_snapshot_key,

    index_id,
    constituent_id,
    isin,
    sedol,
    company_name,
    country_iso2,
    currency_iso3,
    gics_sector_code,
    gics_industry_code,

    -- The fields that change over time
    weight_pct,
    shares_outstanding,
    market_cap_usd,
    free_float_factor,
    foreign_inclusion_factor,

    -- Effective date of this weight (from provider)
    effective_date,

    -- Upstream timestamp — drives change detection
    provider_updated_at,

    -- Pipeline metadata
    _source_system,
    _ingested_at

from {{ source('index_provider_raw', 'raw_constituent_weights') }}
where effective_date >= '2000-01-01'   -- Exclude pre-history bootstrap data

{% endsnapshot %}
```

> [!note] Unique key granularity
>
> The `unique_key` determines what counts as "one entity" across time. Here it is `index_id || '|' || constituent_id` — so a security's membership in a specific index is tracked as one entity. If the same security appears in multiple indices, each index-constituent pair gets its own SCD2 history.

---

## Strategy: `check`

Use `check` when the source has no reliable `updated_at` column. dbt hashes the specified columns and detects changes by comparing hashes.

```sql
-- snapshots/snap_esg_scores.sql

{% snapshot snap_esg_scores %}

{{
  config(
    target_schema = 'snapshots',
    unique_key    = 'esg_snapshot_key',
    strategy      = 'check',
    check_cols    = [
      'composite_score',
      'environmental_score',
      'social_score',
      'governance_score',
      'esg_rating_category',
      'controversy_level'
    ]
  )
}}

select
    esg_provider_id || '|' || isin   as esg_snapshot_key,

    esg_provider_id,
    isin,
    constituent_id,

    -- Scores that we want to track changes in
    composite_score,
    environmental_score,
    social_score,
    governance_score,
    esg_rating_category,          -- e.g. AAA, AA, A, BBB, BB, B, CCC
    controversy_level,            -- 0–5 scale

    -- Descriptive columns (not in check_cols — changes here don't create new SCD2 rows)
    company_name,
    country_iso2,
    primary_sector,

    -- Pipeline metadata
    data_as_of_date,
    _ingested_at

from {{ source('esg_providers_raw', 'raw_esg_ratings') }}

{% endsnapshot %}
```

> [!warning] check_cols all is expensive
>
> Setting `check_cols = 'all'` compares every column. For wide ESG tables with 80+ columns, this creates a very large hash and adds significant compute. Explicitly list the columns that represent meaningful business changes.

> [!success] Enumerate check_cols explicitly
>
> Define `check_cols` as a YAML list containing only the columns that represent a meaningful business change (scores, flags, ratings). Exclude metadata columns like `_ingested_at`, `_loaded_at`, and `company_name` that change frequently but do not affect business logic. This keeps the hash small and prevents spurious SCD2 row creation.

### `timestamp` vs `check` Decision Matrix

| Criterion | Use `timestamp` | Use `check` |
| --------- | --------------- | ----------- |
| Source has `updated_at` | Yes | No |
| Source `updated_at` is reliable | Yes | No |
| Need to track all changes | Either | `check` |
| Source is high-volume | Prefer `timestamp` (faster) | Acceptable |
| Source is append-only | No | Yes (detect new rows) |

---

### Full Example: snap_constituents — Index Membership and Weights

This is a complete, production-ready snapshot tracking which securities are in each index, their weights, and key descriptive attributes. Entries appear and disappear as indices are rebalanced.

```sql
-- snapshots/snap_constituents.sql

{% snapshot snap_constituents %}

{{
  config(
    target_database           = target.database,
    target_schema             = 'snapshots',
    unique_key                = 'constituent_snapshot_key',
    strategy                  = 'timestamp',
    updated_at                = 'provider_updated_at',
    hard_deletes              = 'invalidate',

    -- Snapshot-specific materialisation options
    tags                      = ['snapshots', 'index-data'],
    post_hook = [
      "grant select on {{ this }} to role reporting_role",
      "grant select on {{ this }} to role risk_readers"
    ]
  )
}}

with source as (

    select * from {{ source('index_provider_raw', 'raw_constituent_weights') }}

),

cleaned as (

    select
        -- Surrogate key (entity identity across time)
        md5(
            coalesce(index_id, '') || '|' ||
            coalesce(constituent_id, '')
        )                                   as constituent_snapshot_key,

        -- Identity
        index_id,
        constituent_id,
        isin,
        sedol,
        ric,

        -- Descriptive (changes rarely; still captured)
        company_name,
        country_iso2,
        currency_iso3,
        gics_sector_code,
        gics_sector_name,
        gics_industry_group_code,
        gics_industry_group_name,

        -- Quantitative (changes at each rebalance)
        weight_pct,
        shares_outstanding,
        market_cap_local,
        market_cap_usd,
        free_float_factor,
        foreign_inclusion_factor,

        -- Effective date from provider (business date of the weight)
        effective_date,

        -- Timestamp driving change detection
        provider_updated_at,

        -- Source lineage
        'index_provider' || '_' || index_provider_id   as _source_system,
        _ingested_at

    from source
    where constituent_id is not null
      and index_id       is not null

)

select * from cleaned

{% endsnapshot %}
```

After running `dbt snapshot`, the table `snapshots.snap_constituents` contains a full audit trail of every weight change for every constituent in every index since the pipeline started.

---

## Point-in-Time (PIT) Queries on Snapshot Tables

The core query pattern: filter to records that were active at a specific point in time.

### Standard PIT Filter

```sql
-- "What were the MSCI World constituents and weights as of 2024-12-31?"

select
    index_id,
    constituent_id,
    isin,
    company_name,
    country_iso2,
    gics_sector_name,
    weight_pct
from snapshots.snap_constituents
where index_id = 'MSCI_WORLD'
  and dbt_valid_from <= '2024-12-31 23:59:59'
  and (dbt_valid_to   > '2024-12-31 23:59:59' or dbt_valid_to is null)
order by weight_pct desc
```

> [!tip] PIT filter as a macro
>
> Standardise this pattern in a macro to prevent off-by-one errors:
> ```sql
> -- macros/utils/pit_filter.sql
> {% macro pit_filter(snapshot_relation, as_of_timestamp) %}
>     {{ snapshot_relation }}
>     where dbt_valid_from <= '{{ as_of_timestamp }}'
>       and (dbt_valid_to   > '{{ as_of_timestamp }}' or dbt_valid_to is null)
> {% endmacro %}
> ```

### PIT Join: Reconstructing Historical Performance

Combine the constituent snapshot with historical price data to reconstruct index performance as if calculated historically:

```sql
-- models/marts/finance/fct_historical_index_return.sql
-- Reconstructs index returns using constituent weights as they existed at the time

with

-- Trading days to reconstruct (one row per business day)
trading_days as (
    select calendar_date
    from {{ ref('dim_trading_calendar') }}
    where is_business_day
      and calendar_date between '2023-01-01' and '2023-12-31'
),

-- PIT constituent weights: join each trading day to the active snapshot record
pit_weights as (
    select
        td.calendar_date,
        sc.index_id,
        sc.constituent_id,
        sc.isin,
        sc.weight_pct / 100.0   as weight_decimal,  -- Convert % to decimal
        sc.gics_sector_name
    from trading_days td
    cross join (
        select distinct index_id from snapshots.snap_constituents
    ) idx
    inner join snapshots.snap_constituents sc
        on  sc.index_id      = idx.index_id
        and sc.dbt_valid_from <= td.calendar_date
        and (sc.dbt_valid_to  > td.calendar_date or sc.dbt_valid_to is null)
),

-- Daily returns from pricing feed
daily_returns as (
    select
        price_date,
        isin,
        total_return_usd
    from {{ ref('stg_pricing__daily_returns') }}
),

-- Join weights to returns and compute contribution
contributions as (
    select
        pw.calendar_date                              as price_date,
        pw.index_id,
        pw.constituent_id,
        pw.isin,
        pw.gics_sector_name,
        pw.weight_decimal,
        dr.total_return_usd,
        pw.weight_decimal * dr.total_return_usd      as contribution_to_return
    from pit_weights pw
    left join daily_returns dr
        on  dr.isin       = pw.isin
        and dr.price_date = pw.calendar_date
)

select
    price_date,
    index_id,
    gics_sector_name,
    sum(weight_decimal)           as sector_weight,
    sum(contribution_to_return)   as sector_contribution,
    count(distinct constituent_id) as constituent_count
from contributions
group by 1, 2, 3
```

---

## Snapshot of ESG Scores for Audit Trail

ESG ratings change as providers update their models and as companies disclose new data. For funds with ESG mandates, regulators may require evidence of what rating a constituent had at the time of a portfolio decision. This is analogous to how [index-maintenance-and-corporate-actions](https://alp78.github.io/elysium/17-Financial-Domain/Market-Analysis/index-maintenance-and-corporate-actions) tracks dimension changes for corporate actions like splits and mergers through SCD Type 2 history.

```sql
-- snapshots/snap_esg_scores.sql (production-ready)

{% snapshot snap_esg_scores %}

{{
  config(
    target_schema           = 'snapshots',
    unique_key              = 'esg_snapshot_key',
    strategy                = 'check',
    check_cols              = [
      'composite_score',
      'environmental_score',
      'social_score',
      'governance_score',
      'esg_rating_category',
      'esg_rating_outlook',
      'controversy_level',
      'is_ungc_non_compliant',
      'is_weapons_involved',
      'carbon_intensity_scope12'
    ],
    hard_deletes = 'ignore'   -- Keep history rows intact if provider stops coverage
  )
}}

select
    esg_provider_id || '|' || isin   as esg_snapshot_key,
    esg_provider_id,
    isin,
    constituent_id,

    -- Scores (tracked for changes)
    composite_score,
    environmental_score,
    social_score,
    governance_score,
    esg_rating_category,
    esg_rating_outlook,
    controversy_level,

    -- Exclusion flags (any change creates a new SCD2 record)
    is_ungc_non_compliant,
    is_weapons_involved,
    is_thermal_coal,
    is_tobacco,

    -- Emissions data (tracked)
    carbon_intensity_scope12,
    carbon_intensity_scope3,
    carbon_data_quality,

    -- Metadata (not tracked for changes)
    company_name,
    country_iso2,
    primary_sector,
    data_as_of_date,
    _ingested_at

from {{ source('esg_providers_raw', 'raw_esg_ratings') }}
where esg_provider_id in ('MSCI', 'SUSTAINALYTICS', 'ISS', 'REFINITIV')

{% endsnapshot %}
```

### ESG Snapshot Audit — show full rating history for a specific ISIN

```sql
select
    esg_provider_id,
    isin,
    esg_rating_category,
    composite_score,
    controversy_level,
    date(dbt_valid_from)   as valid_from,
    date(dbt_valid_to)     as valid_to,
    dbt_valid_to is null   as is_current
from snapshots.snap_esg_scores
where isin = 'US0378331005'      -- Apple Inc
order by esg_provider_id, dbt_valid_from
```

---

## Gotchas and Known Issues

> [!danger] Critical snapshot gotchas
>

> [!success] Preventive checklist
>
> Before deploying any snapshot: (1) deduplicate the source query on `unique_key`; (2) choose `hard_deletes` mode deliberately for membership-style sources; (3) treat snapshot rebuilds and config changes as manual migrations with backups; (4) store `effective_date` or `provider_updated_at` as source columns and use them — not `dbt_valid_from` — for business-logic PIT queries; (5) test schema/config changes in dev or staging before touching production history.

### Duplicate `unique_key` in Source

If the source query returns multiple rows with the same `unique_key` value, dbt will raise an error or produce unpredictable results depending on the adapter. Always deduplicate before the snapshot.

```sql
-- PROBLEM: raw table has duplicates
select
    index_id || '|' || constituent_id as constituent_snapshot_key,
    ...
from {{ source('raw', 'constituent_weights') }}
-- Could have duplicates if the provider sends multiple records per day

-- FIX: deduplicate in the snapshot query
with deduped as (
    select *,
           row_number() over (
               partition by index_id, constituent_id
               order by provider_updated_at desc
           ) as rn
    from {{ source('raw', 'constituent_weights') }}
)
select
    index_id || '|' || constituent_id as constituent_snapshot_key,
    ...
from deduped
where rn = 1
```

### Snapshot Rebuilds and Config Migrations Are Manual

Current dbt docs describe running snapshots with `dbt snapshot` or via `dbt build`; when you need to rebuild a snapshot table or adopt newer snapshot configs such as `hard_deletes`, treat that as a manual warehouse migration rather than as routine day-to-day maintenance.

- Back up the existing snapshot table before changing config semantics or stored columns.
- Test the new config in development or staging and inspect PIT results before promoting it.
- Review row-count and active-row diffs after the migration, because history semantics may change even when the SQL looks similar.

> [!warning] Full-refresh on incremental models upstream
>
> If an incremental model that feeds a snapshot is rebuilt from a different historical boundary, the snapshot can receive rows that look like new changes and create spurious SCD2 versions. Review snapshot impact explicitly whenever upstream rebuilds change the source history surface.

> [!success] Rebuild with review, not by habit
>
> When an upstream rebuild is necessary, branch the change, compare the resulting snapshot history against the current production table, and promote only after confirming the new source history is the one you want to preserve.

### Hard Deletes Not Handled by Default

When a constituent is removed from an index, the source row disappears. By default, dbt does **not** close the snapshot record — the `dbt_valid_to` stays null, and the constituent appears to be still active.

**Solution:** For new snapshots, use `hard_deletes: invalidate` to close records whose `unique_key` values disappear from the latest source query. Use `hard_deletes: new_record` when you need explicit delete rows rather than just closing the prior version.

```sql
{{
  config(
    ...
    hard_deletes = 'invalidate'
  )
}}
```

> [!note] Hard delete tracking overhead
>
> When `hard_deletes: invalidate` or `hard_deletes: new_record` is enabled, dbt does extra work to reconcile keys that disappeared from the source. For very large snapshot tables this adds meaningful query time, so plan storage layout and run cadence deliberately.

> [!danger] Pipeline time vs business time
>
> This is the single most misunderstood aspect of dbt snapshots. `dbt_valid_from` does NOT contain the business effective date -- it contains when the pipeline last ran. If your pipeline runs Monday through Friday but misses Saturday/Sunday, weekend changes all get stamped with Monday's timestamp. PIT queries using `dbt_valid_from` will show incorrect results for weekend dates. Always store and query on the source `effective_date` for business-logic PIT joins.

> [!success] Use source effective_date for PIT queries
>
> Always include `effective_date` (or `provider_updated_at`) as a column in the snapshot's `select` query. Build all business-logic PIT joins against this source column, not `dbt_valid_from`. Reserve `dbt_valid_from` / `dbt_valid_to` for pipeline-level audit queries only — for example, determining when dbt last processed a given record.

### Snapshot Timestamps Use `current_timestamp`

The `dbt_valid_from` and `dbt_valid_to` are set to `current_timestamp` at the time `dbt snapshot` runs — not the `effective_date` or `provider_updated_at` from the source. This means:

- If you run the snapshot daily, gaps between runs are not backdated.
- If the pipeline is delayed for 3 days and then runs, the 3 days of "missing" changes will all get a `dbt_valid_from` of today.

**Implication:** `dbt_valid_from` is the *pipeline ingestion timestamp*, not the *business effective date*. Store `effective_date` or `provider_updated_at` as source columns and use those for business-logic PIT queries. Use `dbt_valid_from` only for pipeline-level auditing.

### Schema Changes Break Snapshots

If you add or remove columns from the snapshot query, you may need to migrate the snapshot table and config together because current dbt snapshot docs recommend explicit migration steps for new snapshot features and shape changes.

#### Resolution — 7.5 Schema Changes Break Snapshots

1. Back up the existing snapshot table before changing schema or snapshot semantics.
2. Add required columns or migrate metadata columns in the warehouse first, following the current snapshot migration guidance.
3. Re-run `dbt snapshot` in a non-production environment and verify PIT behavior before promoting the migrated table.

### Snapshot Tables Are Not Versioned

Unlike models, snapshot tables have no native versioning in dbt. If the business definition of "constituent" changes (e.g. you start tracking ADRs separately), you cannot bump to `snap_constituents_v2` without manually migrating history. Plan snapshot schemas carefully and treat them as long-lived write-once append tables.

---

### Running dbt Snapshots

```bash
# Run all snapshots
dbt snapshot

# Run a specific snapshot
dbt snapshot --select snap_index_constituents

# Run snapshots with a specific target (e.g. prod)
dbt snapshot --target prod

# Run snapshots matching a tag
dbt snapshot --select tag:snapshots

# History-affecting rebuilds should be handled as manual warehouse migrations
# with a backup and review plan, not as a routine snapshot flag.
```

Snapshots are typically run in a separate step from `dbt run` in the pipeline DAG:

```
Ingest raw data
    → dbt source freshness (gate)
    → dbt snapshot          (capture SCD2 changes)
    → dbt run               (build staging, intermediate, mart models)
    → dbt test              (validate)
```

---

## Related

- [silver-transforms](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/silver-transforms)
- [pit-integrity-logic](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/pit-integrity-logic)
- [eu-bmr-benchmark-regulation](https://alp78.github.io/elysium/eu-bmr-benchmark-regulation)
- [dbt-testing-framework](https://alp78.github.io/elysium/11-dbt/Quality/dbt-testing-framework)
- [dbt-core-concepts](https://alp78.github.io/elysium/11-dbt/Foundations/dbt-core-concepts)
- [dbt-data-contracts-implementation](https://alp78.github.io/elysium/11-dbt/Quality/dbt-data-contracts-implementation)
