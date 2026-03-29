---
type: how-to
category: data-engineering
technology: [sql-server, python]
tags: [python, sql, sql-server, tsql]
aliases: [Silver Layer, Silver Transforms, Bronze to Silver, SCD2 Transform, Silver DDL, Cleaned Layer, Gap Fill, Forward Fill]
keywords: [silver layer, medallion architecture, SCD Type 2, slowly changing dimensions, deduplication, gap fill, forward fill, is_filled, trading calendar, upsert, unique index, filtered index, valid_from, valid_to, is_current, OHLCV transform, signals daily, signals quarterly, index_dim SCD2, upserting, insert or update, parameterized queries, silver schema]
description: "Complete SQL patterns for the example silver layer — covers SCD Type 2 dimension tracking, OHLCV gap-filling against the trading calendar, daily and quarterly signal upserts, and unique index design for deduplication."
related: [bronze-layer-loading, gold-transforms, medallion-architecture, data-warehouse-architecture]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Silver Transforms

The silver layer cleans, deduplicates, and historicizes the raw data from [[bronze-layer-loading|bronze]]. Where bronze is ephemeral (truncated each run), silver is permanent — it accumulates history across every pipeline run. In dbt terminology, silver corresponds to [[dbt-intermediate-models|intermediate models]] that sit between staging and mart layers.

**Pipeline flow:** [[bronze-layer-loading|Bronze]] → Python transforms → Silver tables → [[gold-transforms|Gold scoring]]

Key improvements silver makes over bronze:

- **[[data-warehouse-architecture|SCD Type 2]]** on dimensions — tracks attribute changes over time
- **One row per symbol per date** — deduplication via UNIQUE indexes
- **Gap-filled OHLCV** — forward-fills missing trading days using the [[bronze-layer-loading#bronze.trading_calendar|trading calendar]]
- **Validation gates** — a [[data-quality-framework]] between bronze and silver ensures data integrity before promotion
- **Full history retained** — silver accumulates across runs; bronze is wiped each run

---

## Silver DDL

File: `db/ddl/silver_schema.sql`

### silver.index_dim — SCD Type 2 Dimension

Tracks company attribute changes (sector, name, etc.) over time. When an attribute changes, the old row is closed and a new row is inserted — history is never overwritten.

> [!info] SCD Type 2 Pattern
> SCD Type 2 (Slowly Changing Dimension Type 2) preserves history by closing old records and inserting new ones. The `valid_to = NULL` + `is_current = 1` pattern is the standard implementation in SQL Server. See [[idempotent-pipeline-design]] for general data pipeline patterns. For dbt's declarative approach to the same SCD2 logic, see [[dbt-snapshots-and-scd]].

#### CREATE TABLE silver.index_dim — SCD Type 2 with valid_from, valid_to, is_current

```sql
-- Slowly Changing Dimension Type 2: tracks attribute changes over time.
-- When a stock's sector, name, or other attribute changes, the old row is
-- "closed" (valid_to set, is_current=0) and a new row is inserted.

CREATE TABLE silver.index_dim (
    id                      INT IDENTITY(1,1) PRIMARY KEY,
    _index                  VARCHAR(20)     NOT NULL,
    symbol                  VARCHAR(20)     NOT NULL,

    -- Same attribute columns as bronze.index_dim
    long_name               NVARCHAR(200),
    short_name              NVARCHAR(100),
    sector                  NVARCHAR(100),
    -- ... (all bronze columns) ...
    price_data_start        DATE,

    -- SCD2 temporal columns
    valid_from              DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
    valid_to                DATETIME2       NULL,            -- NULL = still current
    is_current              BIT             NOT NULL DEFAULT 1  -- 1 = active record
);
GO

-- Filtered unique index: enforce ONE current record per (_index, symbol)
-- WHERE is_current = 1 means the uniqueness only applies to active rows;
-- historical (closed) rows can have duplicates.
CREATE UNIQUE INDEX UX_silver_index_dim_current
    ON silver.index_dim (_index, symbol) WHERE is_current = 1;
GO
```


#### SCD Type 2 example — silver.index_dim state after attribute change

| _index | symbol | sector | valid_from | valid_to | is_current |
|--------|--------|--------|------------|----------|------------|
| market_index | ASML.AS | Technology | 2024-01-15 | 2025-06-01 | 0 |
| market_index | ASML.AS | Semiconductors | 2025-06-01 | NULL | 1 |

### silver.signals_daily — Deduplicated Daily Signals

One row per `(_index, symbol, signal_date)` — no duplicates. Bronze gets truncated every run; silver preserves the full history.

#### CREATE TABLE silver.signals_daily — UNIQUE constraint on (symbol, date)

```sql
-- One row per (_index, symbol, signal_date) — no duplicates.
-- Bronze gets truncated every run; silver preserves the full history.

CREATE TABLE silver.signals_daily (
    id                      INT IDENTITY(1,1) PRIMARY KEY,
    _index                  VARCHAR(20)     NOT NULL,
    symbol                  VARCHAR(20)     NOT NULL,
    signal_date             DATE            NOT NULL,        -- bronze timestamp cast to DATE

    -- Same value columns as bronze (current_price through upside_potential)
    current_price           FLOAT,
    forward_pe              FLOAT,
    -- ... (all 15 value columns) ...
    upside_potential         FLOAT
);
GO

-- UNIQUE: prevents duplicate rows for the same stock on the same day
CREATE UNIQUE INDEX IX_silver_signals_daily_symbol_date
    ON silver.signals_daily (_index, symbol, signal_date);
GO
```

### silver.signals_quarterly — Deduplicated Quarterly Signals

#### CREATE TABLE silver.signals_quarterly — UNIQUE constraint on (symbol, quarter)

```sql
-- Same pattern: one row per (_index, symbol, as_of_date)
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

This is the most sophisticated transform. It compares every attribute between bronze and silver, and:
- **New symbols**: INSERT with `is_current = 1`
- **Changed attributes**: close old row, insert new row
- **Removed symbols**: close old row

#### SELECT bronze.index_dim — SCD2 step 1: read full bronze snapshot

```sql
-- transform_index_dim.py (lines 40-43)

SELECT _index, symbol, long_name, short_name, sector, sector_key,
       industry, industry_key, country, city, website,
       long_business_summary, exchange, full_exchange_name,
       exchange_timezone_name, exchange_timezone_short,
       currency, financial_currency, quote_type, market,
       range_start, price_data_start
FROM bronze.index_dim
```

#### SELECT silver WHERE is_current = 1 — SCD2 step 2: read active rows

```sql
-- transform_index_dim.py (lines 51-54)

SELECT _index, symbol, long_name, short_name, sector, sector_key,
       -- ... same columns ...
       range_start, price_data_start
FROM silver.index_dim
WHERE is_current = 1    -- only active records
```

Python compares each `(index, symbol)` pair. If attributes changed:

#### UPDATE SET is_current = 0, valid_to — SCD2 step 3a: close old record

```sql
-- transform_index_dim.py (lines 131-134)

UPDATE silver.index_dim
SET valid_to = SYSUTCDATETIME(),   -- timestamp when this version ended
    is_current = 0                  -- no longer the active record
WHERE _index = ? AND symbol = ?
  AND is_current = 1
```

#### INSERT new version — SCD2 step 3b: insert with is_current = 1

```sql
-- transform_index_dim.py (lines 124-126)

INSERT INTO silver.index_dim (
    _index, symbol, long_name, short_name, sector, ...
) VALUES (?, ?, ?, ?, ?, ...)
-- DEFAULT: valid_from = SYSUTCDATETIME(), is_current = 1
```


---

## Upsert — Daily Signals

File: `ingestion/transforms/transform_signals_daily.py`

Bronze holds only today's snapshot (truncated each run). This transform preserves history in silver by upserting: insert new dates, update changed values, skip unchanged.

#### SELECT silver signals — upsert step 1: load existing for comparison

```sql
-- transform_signals_daily.py (lines 41-44)

SELECT _index,
       symbol,
       CONVERT(VARCHAR(10), signal_date, 120),  -- date as 'YYYY-MM-DD' string
       current_price, forward_pe, price_to_book, ev_to_ebitda,
       dividend_yield, market_cap, beta,
       fifty_two_week_change, sandp_52_week_change,
       fifty_day_average, two_hundred_day_average, dist_from_52_week_high,
       target_median_price, recommendation_mean, upside_potential
FROM silver.signals_daily
```

#### SELECT bronze snapshot — upsert step 2: read today's source data

```sql
-- transform_signals_daily.py (lines 51-54)

SELECT _index,
       symbol,
       CAST(timestamp AS DATE) AS signal_date,   -- truncate timestamp to date
       current_price, forward_pe, price_to_book, ev_to_ebitda,
       dividend_yield, market_cap, beta,
       fifty_two_week_change, sandp_52_week_change,
       fifty_day_average, two_hundred_day_average, dist_from_52_week_high,
       target_median_price, recommendation_mean, upside_potential
FROM bronze.signals_daily
```

Python compares each `(_index, symbol, date)` key:

#### INSERT / UPDATE / SKIP — upsert step 3: compare and apply changes

```sql
-- Step 3a: INSERT if this date doesn't exist in silver yet
INSERT INTO silver.signals_daily (
    _index, symbol, signal_date, current_price, forward_pe, ...
) VALUES (?, ?, ?, ?, ?, ...)

-- Step 3b: UPDATE if the date exists but values changed (market moved)
UPDATE silver.signals_daily
SET current_price = ?, forward_pe = ?, price_to_book = ?, ...
WHERE _index = ? AND symbol = ? AND signal_date = ?

-- Step 3c: SKIP if values are identical (no market movement since last fetch)
```

#### Upsert run output — inserted, updated, skipped counts

```
records_inserted=50  records_updated=45  records_unchanged=5
```


---

## OHLCV Gap-Fill Transform

File: `ingestion/transforms/transform_ohlcv.py`

The OHLCV transform uses the [[bronze-layer-loading#bronze.trading_calendar|trading calendar]] to detect gaps — dates where the exchange was open but no price data arrived. These gaps are forward-filled from the previous day's close.

#### LEFT JOIN trading_calendar — identify OHLCV data gaps

```sql
-- Find trading days with no OHLCV row in silver (i.e., gaps)
SELECT c.date
FROM bronze.trading_calendar c
WHERE c.exchange_code = ?         -- e.g. 'AMS' for Amsterdam
  AND c.is_trading_day = 1        -- exchange was open this day
  AND c.date BETWEEN ? AND ?      -- within the OHLCV date range
  AND NOT EXISTS (
      SELECT 1
      FROM silver.index_europe_ohlcv o
      WHERE o.symbol = ?
        AND o.date = c.date
  )
```

#### INSERT is_filled = 1 — forward-fill missing OHLCV rows

```sql
-- For each gap date, insert the previous day's prices
INSERT INTO silver.index_europe_ohlcv (
    symbol, date, [open], high, low, [close], adj_close, volume,
    dividends, stock_splits, is_filled
)
SELECT symbol,
       ?,             -- gap date
       [close],       -- forward-fill: use prior close as open/high/low/close
       [close],
       [close],
       [close],
       adj_close,
       0,             -- volume = 0 for filled rows
       0, 0,
       1              -- is_filled = 1: marks this as synthetic, not real data
FROM silver.index_europe_ohlcv
WHERE symbol = ?
  AND date = (SELECT MAX(date) FROM silver.index_europe_ohlcv
              WHERE symbol = ? AND date < ? AND is_filled = 0)
```

> [!warning] Stale Forward-Fill Issue
> If `is_filled = 1` rows accumulate beyond today's date, they block new real data from being inserted (UNIQUE constraint). Run the cleanup query and re-run the pipeline to fix:
> ```sql
> DELETE FROM silver.index_europe_ohlcv WHERE date > CAST(GETDATE() AS DATE) AND is_filled = 1;
> ```
> See common pipeline errors for details.

#### SELECT COUNT gaps — verify gap-fill completeness (should return 0)

```sql
SELECT COUNT(*) FROM silver.index_europe_ohlcv
WHERE is_filled = 1 AND date > CAST(GETDATE() AS DATE)
```

---

### Silver Index Design

| Table | Index | Purpose |
|-------|-------|---------|
| `silver.index_dim` | `UNIQUE (_index, symbol) WHERE is_current=1` | Enforce one active record per stock |
| `silver.signals_daily` | `UNIQUE (_index, symbol, signal_date)` | Prevent duplicate daily rows |
| `silver.signals_quarterly` | `UNIQUE (_index, symbol, as_of_date)` | Prevent duplicate quarterly rows |
| `silver.{ohlcv}` | `UNIQUE (symbol, date)` | Prevent duplicate price rows |

> [!tip] Filtered Unique Index
> The `WHERE is_current = 1` on `UX_silver_index_dim_current` is a SQL Server **filtered index**. Uniqueness only applies to active rows — historical (closed) rows can have duplicate `(_index, symbol)` pairs because they represent different time periods. This is what makes SCD Type 2 work without violating uniqueness.

---

### Key SQL Techniques Used in Silver Transforms

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

#### SELECT MAX(date) WHERE is_filled = 0 — check silver OHLCV freshness

```sql
SELECT 'euro' AS idx, MAX(date) AS latest FROM silver.index_europe_ohlcv WHERE is_filled = 0
UNION ALL SELECT 'asia', MAX(date) FROM silver.index_asia_ohlcv WHERE is_filled = 0
UNION ALL SELECT 'usa', MAX(date) FROM silver.index_usa_ohlcv WHERE is_filled = 0
```

#### sys.partitions rows — row counts across all silver tables

```sql
SELECT s.name AS [schema], t.name AS [table], p.rows
FROM sys.tables t
JOIN sys.schemas s ON t.schema_id = s.schema_id
JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0,1)
WHERE s.name = 'silver'
ORDER BY t.name
```

#### DELETE WHERE is_filled = 1 — cleanup stale forward-filled rows (emergency)

```sql
-- Delete forward-filled rows beyond today
DELETE FROM silver.index_europe_ohlcv WHERE date > CAST(GETDATE() AS DATE) AND is_filled = 1;
DELETE FROM silver.index_asia_ohlcv WHERE date > CAST(GETDATE() AS DATE) AND is_filled = 1;
DELETE FROM silver.index_usa_ohlcv  WHERE date > CAST(GETDATE() AS DATE) AND is_filled = 1;

-- Then re-run pipeline to rebuild:
-- gcloud run jobs execute analytics-pipeline --region=europe-west1
```

---

### Related Notes

- [[bronze-layer-loading]] — upstream: raw data loading patterns and DDL
- [[gold-transforms]] — downstream: aggregations, scoring, and dashboard-ready views
- [[medallion-architecture]] — architectural context
- [[idempotent-pipeline-design]] — general idempotent data pipeline patterns including SCD
- the data pipeline steps — pipeline steps that drive these transforms
- common pipeline errors — troubleshooting stale forward-fills and stuck OHLCV data
