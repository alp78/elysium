---
tags: [data-modeling, pipeline, dbt]
type: reference
technology: [dbt]
status: stable
updated: 2026-03-23
description: "SCD Type 2 snapshots with timestamp and check strategies, PIT queries, ESG audit trails, and gotchas for financial data pipelines"
---

# dbt: Snapshots and SCD

> [!quote]
> "The ability to visualize something as abstract as a set of data in a concrete and tangible way is the secret of understandability."
> — **Ralph Kimball**

dbt snapshots implement **Slowly Changing Dimension Type 2 (SCD2)**: when a row changes, the old version is closed with an end timestamp and a new version is inserted with the current timestamp. Every historical state of the data is preserved. In financial data pipelines this is non-negotiable — index constituent weights, ESG ratings, and benchmark definitions change frequently and must be reproducible as of any historical point in time. For the broader SQL Server implementation of these patterns, see [silver-transforms](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/silver-transforms).

---

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

The **current record** for any `unique_key` value is always the row where `dbt_valid_to is null`.

### File Placement

Snapshots live in the `snapshots/` directory (configurable in `dbt_project.yml`). They use `.sql` extension with a `{% snapshot %}` block.

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
    invalidate_hard_deletes = true
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
    invalidate_hard_deletes   = true,

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

ESG ratings change as providers update their models and as companies disclose new data. For funds with ESG mandates, regulators may require evidence of what rating a constituent had at the time of a portfolio decision. This is analogous to how [index-maintenance-and-corporate-actions](https://alp78.github.io/elysium/18-Financial-Domain/Market-Analysis/index-maintenance-and-corporate-actions) tracks dimension changes for corporate actions like splits and mergers through SCD Type 2 history.

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
    invalidate_hard_deletes = false   -- Keep history even if provider drops coverage
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

#### ESG Snapshot Audit — show full rating history for a specific ISIN

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

### `dbt snapshot --full-refresh` Wipes History

**`dbt snapshot --full-refresh` drops and recreates the snapshot table, destroying all historical SCD2 data.** Unlike models where `--full-refresh` is a routine operation, on snapshots it is destructive.

- Never run `dbt snapshot --full-refresh` in production without explicit intent and a backup.
- Protect snapshot tables with warehouse-level delete prevention or a pre-flight check.
- In `dbt_project.yml`, you can make snapshots unable to be full-refreshed via a custom check in a pre-hook.

> [!warning] Full-refresh on incremental models upstream
> If an incremental model that feeds a snapshot is full-refreshed and re-seeded from a different date, the snapshot will receive "new" rows that look like changes and create spurious SCD2 records. Always full-refresh incrementals and their downstream snapshots together, or avoid full-refresh in production.

### Hard Deletes Not Handled by Default

When a constituent is removed from an index, the source row disappears. By default, dbt does **not** close the snapshot record — the `dbt_valid_to` stays null, and the constituent appears to be still active.

**Solution:** Set `invalidate_hard_deletes = true` in the snapshot config. dbt will then close records whose `unique_key` values are absent from the latest source query.

```sql
{{
  config(
    ...
    invalidate_hard_deletes = true
  )
}}
```

> [!note] Hard delete invalidation overhead
>
> When `invalidate_hard_deletes` is enabled, dbt runs an additional query to find keys present in the snapshot but absent from the source. For very large snapshot tables this adds meaningful query time. Consider partitioning the snapshot table by a date column and filtering accordingly.

> [!danger] Pipeline time vs business time
>
> This is the single most misunderstood aspect of dbt snapshots. `dbt_valid_from` does NOT contain the business effective date -- it contains when the pipeline last ran. If your pipeline runs Monday through Friday but misses Saturday/Sunday, weekend changes all get stamped with Monday's timestamp. PIT queries using `dbt_valid_from` will show incorrect results for weekend dates. Always store and query on the source `effective_date` for business-logic PIT joins.

### Snapshot Timestamps Use `current_timestamp`

The `dbt_valid_from` and `dbt_valid_to` are set to `current_timestamp` at the time `dbt snapshot` runs — not the `effective_date` or `provider_updated_at` from the source. This means:

- If you run the snapshot daily, gaps between runs are not backdated.
- If the pipeline is delayed for 3 days and then runs, the 3 days of "missing" changes will all get a `dbt_valid_from` of today.

**Implication:** `dbt_valid_from` is the *pipeline ingestion timestamp*, not the *business effective date*. Store `effective_date` or `provider_updated_at` as source columns and use those for business-logic PIT queries. Use `dbt_valid_from` only for pipeline-level auditing.

### Schema Changes Break Snapshots

If you add or remove columns from the snapshot's select query, dbt will raise an error on the next run because the snapshot table's DDL does not match the query output.

#### Resolution — 7.5 Schema Changes Break Snapshots

1. Add the column to the warehouse table manually (`alter table ... add column`), then run `dbt snapshot`.
2. Or drop and recreate — but this destroys history (see §7.2).
3. Use `on_schema_change = 'append_new_columns'` in the config to allow new columns to be added automatically (existing rows get null for the new column).

```sql
{{
  config(
    ...
    on_schema_change = 'append_new_columns'
  )
}}
```

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

# DANGEROUS: destroys history
# dbt snapshot --full-refresh
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

- [silver-transforms](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/silver-transforms)
- [pit-integrity-logic](https://alp78.github.io/elysium/04-SQL-Server/Performance/pit-integrity-logic)
- [eu-bmr-benchmark-regulation](https://alp78.github.io/elysium/eu-bmr-benchmark-regulation)
- [dbt-testing-framework](https://alp78.github.io/elysium/11-dbt/Quality/dbt-testing-framework)
- [dbt-core-concepts](https://alp78.github.io/elysium/11-dbt/Foundations/dbt-core-concepts)
- [dbt-data-contracts-implementation](https://alp78.github.io/elysium/11-dbt/Quality/dbt-data-contracts-implementation)
