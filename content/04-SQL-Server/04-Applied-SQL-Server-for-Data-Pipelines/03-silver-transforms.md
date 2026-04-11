---
title: "03 - Silver Transforms"
tags: [sql, sql-server, tsql, medallion-project]
aliases: [Silver Layer, Silver Transforms, Bronze to Silver, SCD2 Transform, Silver DDL, Cleaned Layer, Gap Fill, Forward Fill]
description: "Complete SQL patterns for the example silver layer — covers SCD Type 2 dimension tracking, OHLCV gap-filling against the trading calendar, daily and quarterly signal upserts, and unique index design for deduplication."
created: 2026-03-22
updated: 2026-04-04
status: complete
---

> [!abstract] Medallion Project — Financial Index Pipeline
>
> This page documents the implementation of a specific financial data pipeline
> (STOXX/yfinance stock index scoring system) on SQL Server. For the general
> patterns and alternative approaches, see the [moc-sql-server > Patterns](https://alp78.github.io/elysium/04-SQL-Server/moc-sql-server#patterns)
> section. For the architectural theory behind bronze/silver/gold layering,
> see [medallion-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/medallion-architecture).

# Silver Transforms

> [!quote]
> "The most important motivation for the research work that resulted in the relational model was the objective of providing a sharp and clear boundary between the logical and physical aspects of database management."
>
> — **Edgar F. Codd**, *A Relational Model of Data for Large Shared Data Banks* (1970)

The silver layer cleans, deduplicates, and historicizes the raw data from [bronze](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/bronze-layer-loading). Where bronze is ephemeral (truncated each run), silver is permanent — it accumulates history across every pipeline run. In dbt terminology, silver corresponds to [intermediate models](https://alp78.github.io/elysium/11-dbt/Modeling/dbt-intermediate-models) that sit between staging and mart layers.

**Pipeline flow:** [Bronze](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/bronze-layer-loading) → Python transforms → Silver tables → [Gold scoring](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/gold-transforms)

Key improvements silver makes over bronze:

- **[SCD Type 2](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/data-warehouse-architecture)** on dimensions — tracks attribute changes over time
- **One row per symbol per date** — deduplication via UNIQUE indexes
- **Gap-filled OHLCV** — forward-fills missing trading days using the [trading calendar](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/bronze-layer-loading#bronzetradingcalendar)
- **Validation gates** — a [data-quality-framework](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/data-quality-framework) between bronze and silver ensures data integrity before promotion
- **Full history retained** — silver accumulates across runs; bronze is wiped each run

---

## Silver DDL

Silver tables enforce constraints that bronze deliberately omits. Where bronze accepts whatever the source sends (duplicates, corrections, late-arriving data), silver enforces **one authoritative row per entity per time period** through `UNIQUE` indexes. Silver also adds temporal tracking columns (`valid_from`, `valid_to`, `is_current`) for dimensions that change over time. All silver DDL lives in `db/ddl/silver_schema.sql` and follows the same idempotent `IF NOT EXISTS` pattern described in [bronze-layer-loading](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/bronze-layer-loading#idempotent-database-and-schema-creation).

### silver.index_dim — SCD Type 2 Dimension

Tracks company attribute changes (sector, name, etc.) over time. When an attribute changes, the old row is closed and a new row is inserted — history is never overwritten.

> [!info] SCD Type 2 Pattern
>
> SCD Type 2 (Slowly Changing Dimension Type 2) preserves history by closing old records and inserting new ones. The `valid_to = NULL` + `is_current = 1` pattern is the standard implementation in SQL Server. See [idempotent-pipeline-design](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design) for general data pipeline patterns. For dbt's declarative approach to the same SCD2 logic, see [dbt-snapshots-and-scd](https://alp78.github.io/elysium/11-dbt/Advanced/dbt-snapshots-and-scd).

#### CREATE TABLE silver.index_dim — SCD Type 2 with valid_from, valid_to, is_current

The table mirrors all attribute columns from `bronze.index_dim` (company name, sector, industry, exchange metadata, etc.) and adds three SCD2 temporal columns: `valid_from` (UTC timestamp when this version became active, defaults to `SYSUTCDATETIME()`), `valid_to` (`NULL` while the row is current; set to the closure timestamp when a new version replaces it), and `is_current` (a `BIT` flag — `1` for the active record, `0` for historical). The `UNIQUE` filtered index on `(_index, symbol) WHERE is_current = 1` guarantees that at most one active row exists per stock per index — a constraint that would be impossible with a regular unique index because historical rows share the same `(_index, symbol)` pair.

```sql
CREATE TABLE silver.index_dim (
    id                      INT IDENTITY(1,1) PRIMARY KEY,
    _index                  VARCHAR(20)     NOT NULL,
    symbol                  VARCHAR(20)     NOT NULL,

    long_name               NVARCHAR(200),
    short_name              NVARCHAR(100),
    sector                  NVARCHAR(100),
    -- ... (all bronze attribute columns) ...
    price_data_start        DATE,

    valid_from              DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
    valid_to                DATETIME2       NULL,
    is_current              BIT             NOT NULL DEFAULT 1
);
GO

CREATE UNIQUE INDEX UX_silver_index_dim_current
    ON silver.index_dim (_index, symbol) WHERE is_current = 1;
GO
```

> [!info] Filtered Unique Index
>
> The `WHERE is_current = 1` clause creates a **filtered index** — a SQL Server feature (introduced in SQL Server 2008) that indexes only the rows matching a predicate. The index is physically smaller than a full-table index because it excludes all historical rows, which reduces storage, maintenance cost, and B-tree depth. Uniqueness is enforced only on the filtered subset: active rows must have unique `(_index, symbol)` pairs, but historical (closed) rows are free to share the same pair because they represent different time periods. This is what makes SCD Type 2 work without violating uniqueness constraints.

#### SCD Type 2 example — silver.index_dim state after attribute change

| _index | symbol | sector | valid_from | valid_to | is_current |
|--------|--------|--------|------------|----------|------------|
| market_index | ASML.AS | Technology | 2024-01-15 | 2025-06-01 | 0 |
| market_index | ASML.AS | Semiconductors | 2025-06-01 | NULL | 1 |

### silver.signals_daily — Deduplicated Daily Signals

Silver signals preserve the full history of daily trading signals across every pipeline run. Bronze `signals_daily` is truncated and reloaded 3x daily, so it only ever holds the latest snapshot. The silver transform upserts each bronze row into this table, keyed by `(_index, symbol, signal_date)` — inserting new dates and updating existing ones if values changed. The `signal_date` column is derived from bronze's `DATETIME2 timestamp` by casting it to `DATE`, collapsing intraday snapshots into a single daily record.

> [!info] Deduplication Strategy
>
> The `UNIQUE` index on `(_index, symbol, signal_date)` enforces exactly one row per stock per date per index. Any attempt to insert a duplicate key raises a constraint violation — the upsert logic in the transform prevents this by checking existence first.

#### CREATE TABLE silver.signals_daily — UNIQUE constraint on (symbol, date)

The table carries the same 15 value columns as `bronze.signals_daily` (see [bronze DDL](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/bronze-layer-loading#bronzesignalsdaily--daily-trading-signals) for column definitions). `signal_date` replaces bronze's `timestamp` column — a `DATE` rather than `DATETIME2` because silver stores one consolidated row per calendar day.

```sql
CREATE TABLE silver.signals_daily (
    id                      INT IDENTITY(1,1) PRIMARY KEY,
    _index                  VARCHAR(20)     NOT NULL,
    symbol                  VARCHAR(20)     NOT NULL,
    signal_date             DATE            NOT NULL,

    current_price           FLOAT,
    forward_pe              FLOAT,
    -- ... (all 15 value columns) ...
    upside_potential         FLOAT
);
GO

CREATE UNIQUE INDEX IX_silver_signals_daily_symbol_date
    ON silver.signals_daily (_index, symbol, signal_date);
GO
```

### silver.signals_quarterly — Deduplicated Quarterly Signals

Quarterly fundamentals (profitability ratios, capital structure, governance scores) change only when companies publish earnings, but the pipeline refreshes bronze daily. The silver transform ensures that each `(_index, symbol, as_of_date)` combination appears exactly once — new quarters are inserted, and existing rows are updated if the source corrected a previously reported value.

#### CREATE TABLE silver.signals_quarterly — UNIQUE constraint on (symbol, quarter)

Same deduplication pattern as daily signals: a `UNIQUE` index on `(_index, symbol, as_of_date)` prevents duplicate quarterly snapshots. The `as_of_date` column carries the quarter-end date from the source, not the ingestion date.

```sql
CREATE TABLE silver.signals_quarterly (
    id                      INT IDENTITY(1,1) PRIMARY KEY,
    _index                  VARCHAR(20)     NOT NULL,
    symbol                  VARCHAR(20)     NOT NULL,
    as_of_date              DATE            NOT NULL,

    -- Same columns as bronze (gross_margins through esg_populated)
    gross_margins           FLOAT,
    -- ...
    esg_populated           BIT
);
GO

CREATE UNIQUE INDEX IX_silver_signals_quarterly_symbol_date
    ON silver.signals_quarterly (_index, symbol, as_of_date);
GO
```

---

## SCD Type 2 Transform — Index Dimensions

File: `ingestion/transforms/transform_index_dim.py`

This is the most sophisticated transform in the pipeline. It implements the SCD Type 2 (Slowly Changing Dimension Type 2) pattern, which preserves the full history of dimension attribute changes rather than overwriting them. The transform loads both the bronze snapshot and silver's current rows into Python dictionaries, compares every attribute for each `(_index, symbol)` pair, and applies one of three actions:

- **New symbols** (in bronze but not in silver): INSERT with `is_current = 1`, `valid_from = now`
- **Changed attributes** (same symbol, different attribute values): close the old silver row (`valid_to = now`, `is_current = 0`), then INSERT a new row with the updated attributes
- **Removed symbols** (in silver but not in bronze): close the old row — the stock has been removed from the index

The close-then-insert sequence must execute in this order: closing the old row first frees the `UNIQUE` filtered index slot, allowing the new row's `is_current = 1` to satisfy the constraint.

#### SELECT bronze.index_dim — SCD2 step 1: read full bronze snapshot

The transform reads every column from `bronze.index_dim` — the complete, latest snapshot of all stock metadata as fetched from yfinance. This query returns one row per `(_index, symbol)` pair.

```sql
SELECT _index, symbol, long_name, short_name, sector, sector_key,
       industry, industry_key, country, city, website,
       long_business_summary, exchange, full_exchange_name,
       exchange_timezone_name, exchange_timezone_short,
       currency, financial_currency, quote_type, market,
       range_start, price_data_start
FROM bronze.index_dim
```

#### SELECT silver WHERE is_current = 1 — SCD2 step 2: read active rows

Only active (`is_current = 1`) rows are loaded — historical rows are irrelevant for comparison. Python builds a dictionary keyed by `(_index, symbol)` with the full attribute tuple as the value, enabling O(1) lookups during the comparison phase.

```sql
SELECT _index, symbol, long_name, short_name, sector, sector_key,
       -- ... same columns ...
       range_start, price_data_start
FROM silver.index_dim
WHERE is_current = 1
```

Python compares each `(_index, symbol)` pair attribute-by-attribute. If any attribute differs between bronze and silver:

#### UPDATE SET is_current = 0, valid_to — SCD2 step 3a: close old record

The `UPDATE` sets `valid_to` to the current UTC timestamp (marking when this version of the data stopped being current) and flips `is_current` to `0`. The `WHERE is_current = 1` guard ensures only the active row is closed — historical rows are never modified.

```sql
UPDATE silver.index_dim
SET valid_to = SYSUTCDATETIME(),
    is_current = 0
WHERE _index = ? AND symbol = ?
  AND is_current = 1
```

#### INSERT new version — SCD2 step 3b: insert with is_current = 1

The new row inherits `valid_from = SYSUTCDATETIME()` and `is_current = 1` from column defaults. `valid_to` remains `NULL`, indicating this version is still active. The filtered unique index now accepts this row because the previous active row was already closed in step 3a.

```sql
INSERT INTO silver.index_dim (
    _index, symbol, long_name, short_name, sector, ...
) VALUES (?, ?, ?, ?, ?, ...)
```


---

## Upsert — Daily Signals

File: `ingestion/transforms/transform_signals_daily.py`

Bronze holds only today's snapshot (truncated each run). This transform preserves history in silver by upserting: insert new dates, update changed values, skip unchanged rows. The upsert is implemented in Python (not T-SQL `MERGE`) for the same portability and testability reasons as the bronze merge strategy — see [bronze loading patterns](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/bronze-layer-loading#loading-patterns-json--bronze) for the rationale. The quarterly signals transform (`transform_signals_quarterly.py`) follows an identical pattern, keyed by `(_index, symbol, as_of_date)` instead.

#### SELECT silver signals — upsert step 1: load existing for comparison

The transform reads all existing silver rows into a Python dictionary keyed by `(_index, symbol, signal_date)`. `CONVERT(VARCHAR(10), signal_date, 120)` formats the date as a `'YYYY-MM-DD'` string for use as a dictionary key. The value tuple contains all 15 signal columns, enabling a full attribute-by-attribute comparison with the bronze snapshot.

```sql
SELECT _index,
       symbol,
       CONVERT(VARCHAR(10), signal_date, 120),
       current_price, forward_pe, price_to_book, ev_to_ebitda,
       dividend_yield, market_cap, beta,
       fifty_two_week_change, sandp_52_week_change,
       fifty_day_average, two_hundred_day_average, dist_from_52_week_high,
       target_median_price, recommendation_mean, upside_potential
FROM silver.signals_daily
```

#### SELECT bronze snapshot — upsert step 2: read today's source data

`CAST(timestamp AS DATE)` truncates the bronze `DATETIME2` timestamp to a `DATE`, collapsing multiple intraday fetches (09:00, 17:00, 22:00 UTC) into a single calendar date. If bronze was fetched multiple times today, only the latest snapshot survives the truncate-reload, so this cast is safe — there is exactly one row per `(_index, symbol)` in bronze at any given time.

```sql
SELECT _index,
       symbol,
       CAST(timestamp AS DATE) AS signal_date,
       current_price, forward_pe, price_to_book, ev_to_ebitda,
       dividend_yield, market_cap, beta,
       fifty_two_week_change, sandp_52_week_change,
       fifty_day_average, two_hundred_day_average, dist_from_52_week_high,
       target_median_price, recommendation_mean, upside_potential
FROM bronze.signals_daily
```

Python compares each `(_index, symbol, date)` key against the silver dictionary and applies one of three actions:

#### INSERT / UPDATE / SKIP — upsert step 3: compare and apply changes

**Step 3a — INSERT:** If the `(_index, symbol, signal_date)` key does not exist in silver, this is a new date. The row is inserted, and `id` and `_ingested_at` are auto-populated. **Step 3b — UPDATE:** If the key exists but any of the 15 value columns differ (the market moved between fetches, or a correction arrived), the existing row is updated in place. **Step 3c — SKIP:** If the key exists and all values are identical, no write is needed. Skipping unchanged rows avoids unnecessary transaction log growth and I/O.

```sql
INSERT INTO silver.signals_daily (
    _index, symbol, signal_date, current_price, forward_pe, ...
) VALUES (?, ?, ?, ?, ?, ...)

UPDATE silver.signals_daily
SET current_price = ?, forward_pe = ?, price_to_book = ?, ...
WHERE _index = ? AND symbol = ? AND signal_date = ?
```

#### Upsert run output — inserted, updated, skipped counts

A typical run output showing 50 new rows, 45 updates (values changed since last fetch), and 5 unchanged rows skipped:

```text
records_inserted=50  records_updated=45  records_unchanged=5
```


---

## OHLCV Gap-Fill Transform

File: `ingestion/transforms/transform_ohlcv.py`

The OHLCV transform uses the [trading calendar](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/bronze-layer-loading#bronzetradingcalendar) to detect gaps — dates where the exchange was open but no price data arrived from the source. Gaps occur when yfinance data is incomplete (API timeouts, exchange-level reporting delays, or stocks that were halted). Without gap-filling, downstream analytics would incorrectly interpret missing dates as zero returns, distorting moving averages, volatility calculations, and scoring. The transform forward-fills each gap with the most recent real closing price — a standard financial data practice that assumes no price change on days where data is missing.

#### NOT EXISTS trading_calendar — identify OHLCV data gaps

The gap-detection query uses a `NOT EXISTS` anti-join pattern: for each trading day in the calendar (where `is_trading_day = 1`), it checks whether a corresponding row exists in silver OHLCV. If no match is found, that date is a gap. `NOT EXISTS` is preferred over `LEFT JOIN ... WHERE IS NULL` because SQL Server's query optimizer can short-circuit evaluation — it stops scanning the inner table as soon as it finds a single matching row, making it more efficient for correlated subqueries against large tables.

```sql
SELECT c.date
FROM bronze.trading_calendar c
WHERE c.exchange_code = ?
  AND c.is_trading_day = 1
  AND c.date BETWEEN ? AND ?
  AND NOT EXISTS (
      SELECT 1
      FROM silver.index_europe_ohlcv o
      WHERE o.symbol = ?
        AND o.date = c.date
  )
```

#### INSERT is_filled = 1 — forward-fill missing OHLCV rows

For each gap date, the transform inserts a synthetic row by copying the most recent real closing price (the `MAX(date)` row where `is_filled = 0`). All four price columns (`[open]`, `high`, `low`, `[close]`) are set to the prior day's `[close]` because there was no actual trading — using the close as a flat line is the standard forward-fill convention. Volume is set to `0` (no shares traded), dividends and stock splits to `0`, and `is_filled = 1` marks the row as synthetic so downstream queries can distinguish it from real market data.

```sql
INSERT INTO silver.index_europe_ohlcv (
    symbol, date, [open], high, low, [close], adj_close, volume,
    dividends, stock_splits, is_filled
)
SELECT symbol,
       ?,
       [close],
       [close],
       [close],
       [close],
       adj_close,
       0,
       0, 0,
       1
FROM silver.index_europe_ohlcv
WHERE symbol = ?
  AND date = (SELECT MAX(date) FROM silver.index_europe_ohlcv
              WHERE symbol = ? AND date < ? AND is_filled = 0)
```

> [!warning] Stale Forward-Fill Issue
>
> If `is_filled = 1` rows accumulate beyond today's date, they block new real data from being inserted (UNIQUE constraint). Run the cleanup query and re-run the pipeline to fix:
> ```sql
> DELETE FROM silver.index_europe_ohlcv WHERE date > CAST(GETDATE() AS DATE) AND is_filled = 1;
> ```
> See common pipeline errors for details.

> [!success] Fix: Delete Future-Dated Filled Rows
>
> Run the cleanup query for all OHLCV tables, then re-run the pipeline. Real data will re-insert cleanly because the UNIQUE constraint is no longer blocked:
> ```sql
> DELETE FROM silver.index_europe_ohlcv WHERE date > CAST(GETDATE() AS DATE) AND is_filled = 1;
> DELETE FROM silver.index_asia_ohlcv   WHERE date > CAST(GETDATE() AS DATE) AND is_filled = 1;
> DELETE FROM silver.index_usa_ohlcv    WHERE date > CAST(GETDATE() AS DATE) AND is_filled = 1;
> ```
> To prevent recurrence, ensure the gap-fill loop is bounded by `date <= CAST(GETDATE() AS DATE)` before inserting any forward-filled row.

#### SELECT COUNT gaps — verify gap-fill completeness (should return 0)

After the gap-fill loop completes, this validation query checks for forward-filled rows dated in the future. A non-zero result means the gap-fill loop overshot — it created synthetic rows for dates that have not occurred yet. `GETDATE()` returns the server's local date/time; `CAST(... AS DATE)` strips the time component for a clean date comparison.

```sql
SELECT COUNT(*) FROM silver.index_europe_ohlcv
WHERE is_filled = 1 AND date > CAST(GETDATE() AS DATE)
```

---

### Silver Index Design

Every silver table uses a `UNIQUE` index as its primary deduplication mechanism. These indexes serve double duty: they enforce data integrity (no duplicate rows can be inserted) and they accelerate the upsert lookups that every transform performs (the query optimizer uses an index seek instead of a table scan to check whether a key already exists).

| Table | Index | Purpose |
|-------|-------|---------|
| `silver.index_dim` | `UNIQUE (_index, symbol) WHERE is_current=1` | Enforce one active record per stock (filtered — see [DDL section above](#silver-ddl)) |
| `silver.signals_daily` | `UNIQUE (_index, symbol, signal_date)` | Prevent duplicate daily rows |
| `silver.signals_quarterly` | `UNIQUE (_index, symbol, as_of_date)` | Prevent duplicate quarterly rows |
| `silver.{ohlcv}` | `UNIQUE (symbol, date)` | Prevent duplicate price rows |

---

### Key SQL Techniques Used in Silver Transforms

The following table summarizes the T-SQL patterns and SQL Server features used across all silver transforms. Each technique appears in multiple transforms and is explained in detail in the sections above.

| Technique | Where | Why |
|-----------|-------|-----|
| `CONVERT(VARCHAR(10), date, 120)` | Date normalization | Consistent 'YYYY-MM-DD' format for Python dict keys |
| `CAST(timestamp AS DATE)` | Signal date extraction | Truncate DATETIME2 to date for upsert key |
| Parameterized queries (`?`) | All transforms | Prevent SQL injection in all loaders |
| `IF NOT EXISTS ... CREATE TABLE` | All DDL | Idempotent schema creation — safe to run multiple times |
| Filtered unique index (`WHERE is_current=1`) | SCD2 | Uniqueness only on active records; historical duplicates allowed |
| `SYSUTCDATETIME()` | SCD2 timestamps | UTC timestamp for `valid_from` / `valid_to` |

---

## Useful Data Freshness Queries

These diagnostic queries help verify that the pipeline is running correctly and silver data is up to date. They are typically run manually in SSMS or via a monitoring script after a pipeline run completes.

#### SELECT MAX(date) WHERE is_filled = 0 — check silver OHLCV freshness

Returns the most recent real (non-forward-filled) OHLCV date for each index. If this date is more than one trading day behind the current date, the pipeline may have failed to fetch or load new price data. The `WHERE is_filled = 0` filter excludes synthetic rows so the result reflects actual market data, not gap-fill artifacts. `UNION ALL` combines results from all three per-index OHLCV tables into a single result set.

```sql
SELECT 'euro' AS idx, MAX(date) AS latest FROM silver.index_europe_ohlcv WHERE is_filled = 0
UNION ALL SELECT 'asia', MAX(date) FROM silver.index_asia_ohlcv WHERE is_filled = 0
UNION ALL SELECT 'usa', MAX(date) FROM silver.index_usa_ohlcv WHERE is_filled = 0
```

#### sys.partitions rows — row counts across all silver tables

A fast way to check approximate row counts without running `COUNT(*)` on each table. `sys.partitions` is a system catalog view that stores row count metadata for each partition of each table. The `index_id IN (0,1)` filter selects either the heap (0) or clustered index (1) — these hold the actual data rows. Row counts from this view may be slightly stale (updated by background statistics), but they are sufficient for monitoring.

```sql
SELECT s.name AS [schema], t.name AS [table], p.rows
FROM sys.tables t
JOIN sys.schemas s ON t.schema_id = s.schema_id
JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0,1)
WHERE s.name = 'silver'
ORDER BY t.name
```

#### DELETE WHERE is_filled = 1 — cleanup stale forward-filled rows (emergency)

Emergency cleanup for the stale forward-fill issue described in the OHLCV Gap-Fill section above. This deletes all synthetic rows dated after today, then the pipeline is re-run to regenerate correct gap-fills bounded by the current date.

```sql
DELETE FROM silver.index_europe_ohlcv WHERE date > CAST(GETDATE() AS DATE) AND is_filled = 1;
DELETE FROM silver.index_asia_ohlcv WHERE date > CAST(GETDATE() AS DATE) AND is_filled = 1;
DELETE FROM silver.index_usa_ohlcv  WHERE date > CAST(GETDATE() AS DATE) AND is_filled = 1;
```

---

### Related Notes

- [bronze-layer-loading](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/bronze-layer-loading) — upstream: raw data loading patterns and DDL
- [gold-transforms](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/gold-transforms) — downstream: aggregations, scoring, and dashboard-ready views
- [medallion-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/medallion-architecture) — architectural context for all three layers
- [idempotent-pipeline-design](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design) — general idempotent data pipeline patterns including SCD
- [dbt-snapshots-and-scd](https://alp78.github.io/elysium/11-dbt/Advanced/dbt-snapshots-and-scd) — dbt's declarative approach to the same SCD2 logic
- [data-quality-framework](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/data-quality-framework) — validation gates between bronze and silver

