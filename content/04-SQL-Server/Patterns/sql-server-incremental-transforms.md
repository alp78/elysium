---
title: "SQL Server Incremental Transforms"
type: reference
category: data-engineering
technology: [sql-server]
tags:
  - sql-server
  - tsql
  - data-engineering
  - patterns
  - incremental
  - window-functions
  - partitioning
  - performance
aliases: [Incremental Transforms, Watermark Loading, Partition SWITCH, Gap Fill, Pre-computed Aggregations, Indexed Views]
keywords: [incremental transforms, watermark, high-water mark, partition switch, window functions, ROW_NUMBER, RANK, DENSE_RANK, moving average, gap detection, forward fill, pre-computed aggregation, indexed view, materialized view, SCHEMABINDING, ROWS BETWEEN, RANGE BETWEEN, incremental processing]
description: "Building SQL Server transforms that process data incrementally — watermark-based loading, partition SWITCH, window functions at scale, gap detection, forward-fill, pre-computed aggregation tables, and indexed views."
created: 2026-03-29
updated: 2026-03-29
status: complete
---

# SQL Server Incremental Transforms — Processing Only What Changed

> [!quote]
> "We should forget about small efficiencies, say about 97% of the time: premature optimization is the root of all evil."
> — **Donald Knuth**

Full-table recomputation is fine at 10K rows. At 100M rows it takes hours and costs real money. Incremental transforms process only new or changed data on each run. For the theory behind idempotent incremental processing, see [idempotent-pipeline-design](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design). For orchestrating incremental loads with Airflow, see [airflow-dag-patterns](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-dag-patterns).

---

## Watermark-Based Incremental Loading

The most common incremental pattern: store the maximum processed value after each run, start the next run from there. For a full definition of watermarks — what they are, where to store them, their lifecycle, and anti-patterns — see [sql-server-loading-patterns > Watermarks — The Foundation of Incremental Loading](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-loading-patterns#watermarks--the-foundation-of-incremental-loading).

### High-Water Mark — load only new data

> [!info] Watermark Pattern
>
> The watermark is the last successfully processed value — a date, ID, or timestamp. Each run reads only data newer than the watermark. Store the watermark in a control table, pipeline metadata, or an Airflow Variable. See [sql-server-loading-patterns > Where Watermarks Are Stored](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-loading-patterns#where-watermarks-are-stored) for trade-offs of each storage approach.

```sql
-- Step 1: Read current watermark
DECLARE @watermark DATE = (
    SELECT MAX(signal_date) FROM silver.signals_daily
    WHERE _index = @key
);

-- Step 2: Load everything newer than the watermark
INSERT INTO silver.signals_daily (...)
SELECT ...
FROM bronze.signals_daily
WHERE _index = @key
  AND CAST(timestamp AS DATE) > @watermark;
```

### Watermark Storage Options

> [!tip] Where to Store the Watermark
>
> Choose based on your orchestration layer. The control table approach keeps the watermark inside the database; Airflow Variables keep it in the orchestrator.

| Storage | Pros | Cons |
|---------|------|------|
| Control table in DB | Self-contained, queryable, transactional | Extra table to maintain |
| Airflow Variable | Centralized config, visible in UI | Requires Airflow access |
| Pipeline output file | Simple, no DB dependency | Fragile, easy to lose |
| Derived from target (`MAX(date)`) | No storage needed | Requires target scan each run |

**Choose control table when:** you want the watermark transactional with the load (update watermark and insert data in the same transaction — if the load fails, the watermark doesn't advance). Best for SQL-driven pipelines.

**Choose Airflow Variable when:** Airflow is the orchestrator and you want watermarks visible/editable in the Airflow UI. Use `Variable.get()` / `Variable.set()` in your Python operator. Good for pipelines where reprocessing means changing the variable.

**Choose derived `MAX(date)` when:** the target table has a reliable date column and is small enough for the `MAX()` scan to be cheap (<10M rows). Simplest approach — no extra state to maintain. This is what the Medallion-Project uses for most transforms.

### Late-Arriving Data — overlap window mitigation

> [!warning] Late-Arriving Data
>
> Data that arrives after the watermark has advanced will be silently missed. This is especially common with timezone-shifted sources, retroactive corrections, and batch files that arrive out of order.

```sql
-- Mitigation: subtract an overlap window from the watermark
DECLARE @safe_watermark DATE = DATEADD(DAY, -1, @watermark);

-- Load with overlap, then deduplicate
INSERT INTO silver.signals_daily (...)
SELECT ...
FROM bronze.signals_daily
WHERE CAST(timestamp AS DATE) > @safe_watermark
  AND NOT EXISTS (
      SELECT 1 FROM silver.signals_daily t
      WHERE t._index = b._index
        AND t.symbol = b.symbol
        AND t.signal_date = CAST(b.timestamp AS DATE)
  );
```

---

## Partition-Based Incremental Processing

Process one partition at a time: load staging, validate, `SWITCH` into production. The `SWITCH` operation is instantaneous — a metadata operation with zero data movement.

### Partition SWITCH — instant partition replacement

> [!info] SWITCH Requirements
>
> Both tables must have identical schemas, identical indexes, be in the same filegroup, and the staging table must have a `CHECK` constraint matching the target partition boundary. See [partitioning-strategies](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/partitioning-strategies) for partition function and scheme DDL.

```sql
-- Step 1: Load into staging (aligned with March 2025 partition)
TRUNCATE TABLE staging.signals_daily;
-- ... bulk load March 2025 data into staging ...

-- Step 2: Add CHECK constraint matching the partition boundary
ALTER TABLE staging.signals_daily
    ADD CONSTRAINT CK_march_2025
    CHECK (signal_date >= '2025-03-01' AND signal_date < '2025-04-01');

-- Step 3: Clear the target partition (if reprocessing)
TRUNCATE TABLE silver.signals_daily
    WITH (PARTITIONS (3));    -- SQL Server 2016+

-- Step 4: SWITCH — instant, metadata-only
ALTER TABLE staging.signals_daily
    SWITCH TO silver.signals_daily PARTITION 3;
```

> [!warning] SWITCH Exclusive Lock
>
> `SWITCH` requires a brief schema modification lock (Sch-M) on both tables. If concurrent queries hold shared locks, `SWITCH` waits. Schedule partition switches during low-traffic windows or use `LOCK_TIMEOUT` to fail fast instead of blocking.

---

## Window Function Transforms at Scale

Window functions compute moving averages, running totals, z-scores, and rankings without self-joins. They're the backbone of gold-layer analytics.

### Moving Average — AVG() OVER with ROWS BETWEEN

> [!info] Window Frame Syntax
>
> `ROWS BETWEEN N PRECEDING AND CURRENT ROW` defines a physical window of exactly N+1 rows. The `PARTITION BY` resets the window for each group. Ensure the clustered index matches `PARTITION BY + ORDER BY` for optimal performance.

```sql
-- 30-day and 90-day simple moving averages
SELECT symbol,
       date,
       [close],
       AVG([close]) OVER (
           PARTITION BY symbol ORDER BY date
           ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
       ) AS sma_30,
       AVG([close]) OVER (
           PARTITION BY symbol ORDER BY date
           ROWS BETWEEN 89 PRECEDING AND CURRENT ROW
       ) AS sma_90
FROM silver.index_europe_ohlcv
WHERE [close] IS NOT NULL;
```

### Ranking Functions — ROW_NUMBER, RANK, DENSE_RANK, NTILE

> [!info] Ranking Function Differences
>
> `ROW_NUMBER` assigns unique sequential numbers (no ties). `RANK` leaves gaps after ties. `DENSE_RANK` has no gaps. `NTILE(N)` divides rows into N equal buckets.

```sql
-- Rank stocks by composite score within each index
SELECT symbol,
       composite_score,
       ROW_NUMBER() OVER (
           PARTITION BY _index ORDER BY composite_score DESC
       ) AS composite_rank,
       NTILE(5) OVER (
           PARTITION BY _index ORDER BY composite_score DESC
       ) AS quintile    -- 1 = top 20%, 5 = bottom 20%
FROM gold.scores_daily
WHERE score_date = @date;
```

### ROWS BETWEEN vs RANGE BETWEEN — critical difference

> [!warning] ROWS vs RANGE
>
> `ROWS BETWEEN` counts physical rows — deterministic and predictable. `RANGE BETWEEN` groups rows with the same `ORDER BY` value (ties) into a single logical position — different results with duplicate values. Always use `ROWS` unless you specifically need tie-grouping behavior.

### Window Function Performance

> [!tip] Index Strategy for Window Functions
>
> Window functions need sorted input. If the clustered index matches `PARTITION BY + ORDER BY`, the engine reads sequentially with no sort. If it doesn't, SQL Server spills to TempDB for the sort — which can be orders of magnitude slower on large tables.

- **Ideal index:** `CREATE CLUSTERED INDEX IX ON ohlcv (symbol, date)` for `PARTITION BY symbol ORDER BY date`
- **Memory grants:** large windows (89+ preceding rows) over millions of partitions request large memory grants. If the grant is insufficient, hash and sort operations spill to TempDB
- **When to compute in SQL vs pandas:** SQL is better for simple aggregates over sorted data (SMA, running totals). Pandas is better for complex row-wise logic, multi-column transforms, and z-score computation across groups

---

## Gap Detection and Forward-Fill

Detect missing dates in time series data and fill them from the last known value.

### Gap Detection — reference calendar LEFT JOIN

> [!info] Trading Calendar Pattern
>
> A reference calendar table lists all dates when the exchange was open. LEFT JOIN against your data: missing dates are gaps that need filling.

```sql
-- Find trading days with no price data
SELECT c.date AS gap_date
FROM bronze.trading_calendar c
WHERE c.exchange_code = @exchange
  AND c.is_trading_day = 1
  AND c.date BETWEEN @start_date AND @end_date
  AND NOT EXISTS (
      SELECT 1 FROM silver.index_europe_ohlcv o
      WHERE o.symbol = @symbol AND o.date = c.date
  );
```

### Forward-Fill — carry last known value into gaps

> [!info] Forward-Fill Strategy
>
> For each gap date, copy the most recent real (non-filled) price data. Mark filled rows with `is_filled = 1` so they can be distinguished from real data in analytics.

```sql
-- Insert forward-filled row for a gap date
INSERT INTO silver.index_europe_ohlcv (
    symbol, date, [open], high, low, [close],
    adj_close, volume, dividends, stock_splits, is_filled
)
SELECT @symbol, @gap_date,
       [close], [close], [close], [close],  -- fill OHLC with prior close
       adj_close, 0, 0, 0,
       1    -- is_filled = 1: synthetic, not real data
FROM silver.index_europe_ohlcv
WHERE symbol = @symbol
  AND date = (
      SELECT MAX(date) FROM silver.index_europe_ohlcv
      WHERE symbol = @symbol AND date < @gap_date AND is_filled = 0
  );
```

### Forward-Fill with LAST_VALUE — SQL Server 2022+

> [!tip] LAST_VALUE with IGNORE NULLS
>
> SQL Server 2022 added `IGNORE NULLS` to `LAST_VALUE`, enabling gap-fill in a single window function. Before 2022, use the subquery approach above.

```sql
-- SQL Server 2022+: fill NULLs with the last non-null value
SELECT date,
       LAST_VALUE([close]) IGNORE NULLS OVER (
           PARTITION BY symbol ORDER BY date
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       ) AS filled_close
FROM silver.index_europe_ohlcv;
```

### Forward-Fill Gotchas

> [!warning] Edge Cases in Gap-Fill
>
> Forward-fill can create misleading data if not bounded properly.

- **Gaps at the start:** no prior value exists to fill from. Leave these as NULL or skip the stock until real data arrives
- **Stale fills beyond today:** if the fill logic runs ahead of the current date, it creates future-dated synthetic rows. These block real data from being inserted (UNIQUE constraint). Clean up with: `DELETE WHERE date > GETDATE() AND is_filled = 1`
- **Always mark fills:** the `is_filled BIT` column is essential. Without it, filled rows are indistinguishable from real data — corrupting aggregations that should only count real observations

---

## Pre-Computed Aggregation Tables

Materialized aggregations for dashboard performance. Gold tables that pre-join and pre-aggregate silver data so dashboards never scan raw tables.

### Pre-Computed Aggregation — truncate and rebuild vs incremental

> [!info] Refresh Strategy
>
> Choose based on table size and staleness tolerance. Small aggregations (<1M rows) are fast to rebuild from scratch. Large aggregations need incremental refresh with a date filter.

```sql
-- Incremental refresh: delete recent window, recompute, insert
DELETE FROM gold.index_performance
WHERE _index = @key AND perf_date >= DATEADD(DAY, -7, @max_date);

INSERT INTO gold.index_performance (...)
SELECT _index, date, ...
FROM silver.signals_daily s
JOIN silver.index_europe_ohlcv o ON ...
WHERE date >= DATEADD(DAY, -7, @max_date);
```

### Covering Indexes for Dashboard Queries

> [!tip] Covering Index Pattern
>
> Create a non-clustered index that includes all columns the dashboard queries. The query is satisfied entirely from the index — no bookmark lookups, no table scan.

```sql
-- Covering index for "latest scores by index" dashboard query
CREATE NONCLUSTERED INDEX IX_scores_daily_dashboard
    ON gold.scores_daily (_index, score_date DESC)
    INCLUDE (symbol, composite_score, composite_rank,
             relative_value_score, momentum_score, sentiment_score);
```

---

## Indexed Views vs Aggregation Tables

SQL Server's answer to materialized views. The engine automatically maintains the indexed view on every DML — zero staleness, but with DML overhead.

### CREATE INDEXED VIEW — auto-maintained aggregation

> [!info] Indexed View Requirements
>
> Indexed views require `SCHEMABINDING` (view is locked to the exact table schema), a unique clustered index, and no `OUTER JOIN`, subqueries, or non-deterministic functions.

```sql
CREATE VIEW gold.vw_daily_avg_scores
WITH SCHEMABINDING
AS
SELECT _index,
       score_date,
       COUNT_BIG(*) AS stock_count,    -- required for indexed views
       AVG(composite_score) AS avg_composite,
       AVG(relative_value_score) AS avg_value
FROM dbo.scores_daily    -- must use two-part name with SCHEMABINDING
GROUP BY _index, score_date;
GO

CREATE UNIQUE CLUSTERED INDEX IX_vw_daily_avg
    ON gold.vw_daily_avg_scores (_index, score_date);
```

### Indexed View Trade-offs

> [!warning] DML Overhead
>
> Every INSERT, UPDATE, or DELETE on the source table must update the indexed view. For high-write staging tables, this overhead can be severe. Use indexed views only for small, frequently-queried aggregations on stable data.

| Feature | Indexed View | Aggregation Table |
|---------|-------------|-------------------|
| Staleness | Zero — auto-maintained | Controlled — refresh on your schedule |
| DML overhead | On every source write | None until refresh |
| Flexibility | Restricted (no OUTER JOIN, no subqueries) | Unlimited SQL |
| Best for | Small, stable, frequently queried | Large, complex, batch-refreshed |

**Choose indexed views when:** the aggregation is simple (COUNT, SUM, AVG with GROUP BY), the source table has low write volume, and the dashboard needs zero-staleness. Example: daily count of stocks per sector — small result set, rarely changes mid-day.

**Choose aggregation tables when:** the aggregation involves OUTER JOINs, subqueries, window functions, or complex business logic that indexed views can't express. Also when the source is high-write (staging tables, bronze loads) — the DML overhead of maintaining an indexed view during bulk loads is prohibitive. The Medallion-Project's `gold.index_performance` and `gold.scores_daily` are aggregation tables refreshed by [Airflow](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-dag-patterns).

**Choose neither when:** the query is already fast enough on the base table with a covering index. Pre-compute only when profiling shows the aggregation query as a bottleneck — premature materialization adds maintenance cost for no gain.

---

## Anti-Patterns

### Full-Table Recomputation Every Run

Recomputing all gold tables from scratch on every pipeline run wastes CPU, locks tables, and makes the pipeline slower as data grows. Use watermark-based or partition-based incremental processing.

### No Watermark Storage

If the pipeline doesn't know where it left off, every run either reprocesses everything (wasteful) or starts from an arbitrary point (misses data). Always persist the watermark — in a control table, Airflow Variable, or derived from the target with `MAX(date)`.

### Window Functions Without a Supporting Index

If the clustered index doesn't match the `PARTITION BY + ORDER BY`, the engine sorts the entire table in memory. On a 100M-row table, this spills to TempDB and can take 10x longer than an indexed scan.

### Gap-Fill Without Marking Filled Rows

Without `is_filled = 1`, you can't distinguish real market data from synthetic forward-fills. Aggregations that count observations (`COUNT(*)`) or compute averages include fake data, silently distorting results.

### Incremental Load Without Deduplication

Overlapping watermark windows (the late-arriving data mitigation) create duplicate rows if the target has no UNIQUE constraint and the INSERT doesn't check `NOT EXISTS`. Always pair overlap windows with deduplication.

### Indexed View on a High-Write Table

Every INSERT into a staging table that feeds an indexed view pays the view maintenance cost — even if the staging data is temporary. Drop the view before bulk loads, or use a separate aggregation table with batch refresh.

---

## Medallion-Project Reference

> [!example]- Medallion-Project: OHLCV gap-fill and index performance
>
> **Gap-fill (silver):** The OHLCV transform joins against `bronze.trading_calendar` to detect missing trading days, then forward-fills from the last real close price. Filled rows are marked `is_filled = 1`. See [silver-transforms](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/silver-transforms) for the full gap-fill logic.
>
> **Incremental index performance (gold):** `transform_index_performance.py` is incremental — it finds `MAX(perf_date)` in gold, deletes the last 7 days (for late-arriving signals), then recomputes only the new window. See [gold-transforms](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/gold-transforms) for the 7-day refresh window implementation.
