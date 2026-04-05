---
title: "SQL Server Incremental Transforms"
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
description: "Building SQL Server transforms that process data incrementally — watermark-based loading, partition SWITCH, window functions at scale, gap detection, forward-fill, pre-computed aggregation tables, and indexed views."
parent: "[[domain-pipeline-patterns]]"
links:
  - "[[sql-server-loading-patterns]]"
  - "[[sql-server-schema-layering]]"
  - "[[sql-server-change-tracking]]"
  - "[[sql-server-pipeline-anti-patterns]]"
  - "[[bronze-layer-loading]]"
  - "[[silver-transforms]]"
  - "[[gold-transforms]]"
created: 2026-03-29
updated: 2026-04-04
status: complete
---

# SQL Server Incremental Transforms — Processing Only What Changed

> [!quote]
> "Do not process data you do not need. The fastest byte is the one you never touch."
>
> — **Michael Stonebraker**, ACM interview

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

> [!success] Overlap Window + Deduplication
>
> Subtract an overlap window from the watermark (e.g., 1 day for daily batches, 7 days for sources with weekly corrections) and pair with a `NOT EXISTS` or `UNIQUE` constraint check so re-processed rows are skipped rather than duplicated. Size the window to match the maximum expected lateness of your source.

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

**Table partitioning** splits a large table into physically separate segments (partitions) based on a range column — typically a date. Each partition is an independent unit of storage that can be loaded, truncated, backed up, and switched independently. This enables incremental processing at the partition level: load new data into a staging table, validate it, then `SWITCH` the staging table into the target partition.

The `SWITCH` operation is instantaneous because it is a **metadata-only operation** — it reassigns page ownership from the staging table to the target partition by updating internal allocation pointers. No rows are copied, moved, or re-indexed. A 100-row staging table switches as fast as a 100M-row one.

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
-- Partition number comes from the partition function: $PARTITION.pf_monthly('2025-03-15') returns 3
TRUNCATE TABLE silver.signals_daily
    WITH (PARTITIONS (3));    -- SQL Server 2016+ (per-partition TRUNCATE)

-- Step 4: SWITCH — instant, metadata-only
ALTER TABLE staging.signals_daily
    SWITCH TO silver.signals_daily PARTITION 3;
```

> [!warning] SWITCH Exclusive Lock
>
> `SWITCH` requires a brief schema modification lock (Sch-M) on both tables. If concurrent queries hold shared locks, `SWITCH` waits. Schedule partition switches during low-traffic windows or use `LOCK_TIMEOUT` to fail fast instead of blocking.

> [!success] Minimise SWITCH Lock Contention
>
> **Option 1 — `LOCK_TIMEOUT`:** fail fast and retry at a low-traffic time:
> ```sql
> SET LOCK_TIMEOUT 5000;   -- fail after 5 seconds if locks are held
> ALTER TABLE staging.signals_daily SWITCH TO silver.signals_daily PARTITION 3;
> SET LOCK_TIMEOUT -1;     -- restore default (wait indefinitely)
> ```
> **Option 2 — `WAIT_AT_LOW_PRIORITY` (SQL Server 2014+):** wait at low priority for a duration, then choose an action if the lock isn't acquired:
> ```sql
> ALTER TABLE staging.signals_daily
>     SWITCH TO silver.signals_daily PARTITION 3
>     WITH (WAIT_AT_LOW_PRIORITY (MAX_DURATION = 1 MINUTES, ABORT_AFTER_WAIT = SELF));
>     -- SELF = abort the SWITCH if lock not acquired; BLOCKERS = kill blocking sessions; NONE = keep waiting
> ```
> `WAIT_AT_LOW_PRIORITY` is preferred in production because it does not block other operations while waiting — `LOCK_TIMEOUT` acquires a normal-priority lock that can itself become a blocker. Schedule partition switches in an off-peak Airflow window task (e.g., 03:00 UTC) to avoid contention entirely.

---

## Window Function Transforms at Scale

A **window function** operates on a set of rows (the "window") related to the current row and returns a value for each row without collapsing the result set. Unlike `GROUP BY` — which reduces many rows into one summary row per group — window functions preserve every input row and attach a computed value alongside it. This makes them essential for calculations that need both the individual row and its context: moving averages, running totals, rankings, z-scores, and lead/lag comparisons. They eliminate the need for correlated subqueries and self-joins, which are orders of magnitude slower on large tables.

### Moving Average — AVG() OVER with ROWS BETWEEN

> [!info] Window Frame Syntax
>
> `ROWS BETWEEN N PRECEDING AND CURRENT ROW` defines a physical window of exactly N+1 rows (N preceding rows plus the current row itself). For a 30-day moving average, use `29 PRECEDING` because 29 + 1 (current) = 30 rows. The `PARTITION BY` clause resets the window for each group — the moving average for stock A never bleeds into stock B. Ensure the clustered index matches `PARTITION BY + ORDER BY` for optimal performance.

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

> [!success] Always Prefer ROWS BETWEEN
>
> Default to `ROWS BETWEEN N PRECEDING AND CURRENT ROW` for all moving averages and running totals. Reserve `RANGE BETWEEN` only for the specific case where you need ties treated as a single logical period (e.g., summing all rows on the same date). When in doubt, validate with a test set that contains duplicate `ORDER BY` values.

### Window Function Performance

> [!tip] Index Strategy for Window Functions
>
> Window functions need sorted input. If the clustered index matches `PARTITION BY + ORDER BY`, the engine reads sequentially with no sort. If it doesn't, SQL Server spills to TempDB for the sort — which can be orders of magnitude slower on large tables.

- **Ideal index:** `CREATE CLUSTERED INDEX IX ON ohlcv (symbol, date)` for `PARTITION BY symbol ORDER BY date`
- **Memory grants:** large windows (89+ preceding rows) over millions of partitions request large memory grants. If the grant is insufficient, hash and sort operations **spill to TempDB** — the engine writes intermediate results to disk instead of keeping them in memory, which can make the operation 10–100x slower. Detect spills in execution plans (look for `Sort Warning` icons on sort/hash operators) or via `sys.dm_exec_query_stats` (`total_spills` column, SQL Server 2016 SP2 / 2017 CU3+)
- **Memory grant feedback:** SQL Server can automatically adjust memory grants based on runtime feedback — batch mode in 2017 (compat level 140), row mode in 2019 (compat level 150), and persisted in Query Store in 2022 (survives cache evictions and server restarts, uses 90th percentile of historical grants). If you're on 2022+, ensure Query Store is enabled to benefit from persistent grant correction
- **When to compute in SQL vs pandas:** SQL is better for simple aggregates over sorted data (SMA, running totals). Pandas is better for complex row-wise logic, multi-column transforms, and z-score computation across groups

---

## Gap Detection and Forward-Fill

Missing dates in time series data silently corrupt downstream calculations. A `ROWS BETWEEN 29 PRECEDING AND CURRENT ROW` window function assumes 30 contiguous trading days — but if 5 dates are missing, the window actually spans 35 calendar days, producing an incorrect moving average. Rankings, z-scores, and return calculations are equally affected. Gap detection identifies these missing dates; forward-fill propagates the last known value into the gaps so downstream calculations operate on a complete, continuous series.

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

> [!success] Safe Gap-Fill Guard Rails
>
> - Bound the fill loop: `AND c.date <= CAST(GETDATE() AS DATE)` in the trading calendar query prevents future-dated synthetic rows from being generated.
> - On initial load, skip symbols with no prior real data rather than filling from nothing — insert NULL rows only when there is a valid prior close to propagate.
> - Add `is_filled = 1` to every forward-fill `INSERT` and exclude `is_filled = 1` rows from any aggregation that counts real observations (e.g., `WHERE is_filled = 0` in the freshness check).

---

## Pre-Computed Aggregation Tables

A **pre-computed aggregation table** stores the results of expensive `GROUP BY`, `JOIN`, and window function queries in a permanent table so that dashboards read pre-calculated results instead of running the aggregation on every query. This is the gold-layer pattern: silver tables hold cleaned, row-level data; gold tables hold the aggregated, business-ready summaries that power dashboards. Without pre-computation, a dashboard query that joins 3 silver tables and computes rankings across 100M rows would run on every page load — pre-computation runs it once (on a schedule) and serves the result from a small, indexed table.

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

A **covering index** is a non-clustered index that contains all the columns a query needs — both the filter/sort columns (in the index key) and the output columns (in the `INCLUDE` clause). When a query is fully covered, the optimizer reads only the index and never touches the base table, eliminating **bookmark lookups** (also called key lookups: the expensive operation where the engine finds a row in the index but then has to jump back to the clustered index to retrieve the remaining columns).

> [!tip] Covering Index Pattern
>
> `INCLUDE` columns are stored in the leaf level of the index but are not part of the sort key — they add no overhead to the B-tree traversal and keep the index key narrow. Place filter and sort columns in the key; place output-only columns in `INCLUDE`.

```sql
-- Covering index for "latest scores by index" dashboard query
CREATE NONCLUSTERED INDEX IX_scores_daily_dashboard
    ON gold.scores_daily (_index, score_date DESC)
    INCLUDE (symbol, composite_score, composite_rank,
             relative_value_score, momentum_score, sentiment_score);
```

---

## Indexed Views vs Aggregation Tables

A regular view is a saved query — it runs from scratch every time you `SELECT` from it. An **indexed view** (SQL Server's implementation of a materialized view) physically stores the query's result set on disk and automatically updates it when the underlying data changes. This gives you zero-staleness aggregations at the cost of additional write overhead on every `INSERT`, `UPDATE`, or `DELETE` that touches the base tables.

### CREATE INDEXED VIEW — auto-maintained aggregation

> [!info] Indexed View Requirements
>
> Indexed views require:
> - `WITH SCHEMABINDING` — binds the view to the exact table schema; prevents anyone from altering or dropping the base tables without first dropping the view
> - A unique clustered index on the view — this is what triggers materialization; without it the view is just a regular saved query
> - `COUNT_BIG(*)` in any grouped view — SQL Server uses this internally to maintain the aggregation incrementally (it needs the row count per group to correctly recompute `AVG` and `SUM` when rows are inserted or deleted)
> - Two-part table names (`schema.table`, not just `table`) in the view definition
> - Only `SUM` and `COUNT_BIG` aggregates are allowed. `AVG`, `MIN`, `MAX`, `STDEV`, `VAR`, `COUNT` (int), and CLR aggregates are prohibited — decompose `AVG` into `SUM / COUNT_BIG` manually
> - No `OUTER JOIN`, subqueries, `UNION`, `DISTINCT`, `TOP`, `ORDER BY`, window functions (`OVER`), non-deterministic functions (`GETDATE()`, `NEWID()`), or `FLOAT`/`REAL` in index key columns
> - Seven SET options must be active at view creation and during all DML: `ANSI_NULLS ON`, `ANSI_PADDING ON`, `ANSI_WARNINGS ON`, `ARITHABORT ON`, `CONCAT_NULL_YIELDS_NULL ON`, `NUMERIC_ROUNDABORT OFF`, `QUOTED_IDENTIFIER ON`
> - On Standard edition, the optimizer only uses the indexed view when you explicitly reference it with `WITH (NOEXPAND)`. Enterprise edition automatically matches queries to indexed views even when the query references the base tables.

```sql
CREATE VIEW gold.vw_daily_avg_scores
WITH SCHEMABINDING
AS
SELECT _index,
       score_date,
       COUNT_BIG(*) AS stock_count,
       SUM(ISNULL(composite_score, 0)) AS sum_composite,        -- AVG is prohibited;
       SUM(ISNULL(relative_value_score, 0)) AS sum_value         -- decompose into SUM / COUNT_BIG
FROM dbo.scores_daily    -- must use two-part name with SCHEMABINDING
GROUP BY _index, score_date;
-- Query the view: SELECT _index, score_date, sum_composite / stock_count AS avg_composite
--                 FROM gold.vw_daily_avg_scores WITH (NOEXPAND);  -- NOEXPAND required on Standard edition
GO

CREATE UNIQUE CLUSTERED INDEX IX_vw_daily_avg
    ON gold.vw_daily_avg_scores (_index, score_date);
```

### Indexed View Trade-offs

> [!warning] DML Overhead
>
> Every INSERT, UPDATE, or DELETE on the source table must update the indexed view. For high-write staging tables, this overhead can be severe. Use indexed views only for small, frequently-queried aggregations on stable data.

> [!success] Avoid Indexed Views on High-Write Tables
>
> For bulk-load scenarios (bronze/staging tables), use an aggregation table with scheduled batch refresh instead. Drop or avoid indexed views on any table that receives `fast_executemany` or `BULK INSERT` loads. Reserve indexed views for small, stable reference aggregations (e.g., daily stock counts per sector) where zero-staleness justifies the maintenance cost.

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

These are the most common mistakes in incremental transform implementations.

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

### Partition SWITCH Without a CHECK Constraint

The `SWITCH` statement fails with an error if the staging table lacks a `CHECK` constraint that matches the target partition boundary. This is a runtime failure that interrupts the pipeline. Always add the `CHECK` constraint before the `SWITCH` and verify the constraint range matches the partition function boundary exactly.

### Indexed View on a High-Write Table

Every INSERT into a staging table that feeds an indexed view pays the view maintenance cost — even if the staging data is temporary. Drop the view before bulk loads, or use a separate aggregation table with batch refresh.

---

## Medallion-Project Reference

> [!example]- Medallion-Project: OHLCV gap-fill and index performance
>
> **Gap-fill (silver):** The OHLCV transform joins against `bronze.trading_calendar` to detect missing trading days, then forward-fills from the last real close price. Filled rows are marked `is_filled = 1`. See [silver-transforms](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/silver-transforms) for the full gap-fill logic.
>
> **Incremental index performance (gold):** `transform_index_performance.py` is incremental — it finds `MAX(perf_date)` in gold, deletes the last 7 days (for late-arriving signals), then recomputes only the new window. See [gold-transforms](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/gold-transforms) for the 7-day refresh window implementation.
