---
title: "SQL Server Loading Patterns"
tags:
  - sql-server
  - tsql
  - data-engineering
  - patterns
  - bulk-loading
  - pyodbc
  - bcp
  - etl
aliases: [Loading Patterns, Bulk Loading, Data Ingestion SQL Server, fast_executemany, SqlBulkCopy, BULK INSERT, bcp]
description: "Every method of getting data into SQL Server — benchmarked and compared. Covers bcp, BULK INSERT, pyodbc fast_executemany, SqlBulkCopy, loading strategies (truncate-reload, staging swap, incremental, upsert), and minimal logging."
created: 2026-03-29
updated: 2026-03-29
status: complete
---

# SQL Server Loading Patterns — Getting Data In Efficiently

> [!quote]
> "The best performance improvement is the transition from the nonworking state to the working state."
>
> — **John Ousterhout**, *A Philosophy of Software Design* (2018)

Loading is the most performance-sensitive part of any pipeline. The wrong method turns a 30-second load into a 30-minute one. This page covers every loading method available in SQL Server with benchmarks, trade-offs, and gotchas. For Python-specific benchmarks, see [23_py_data_ingestion](https://alp78.github.io/elysium/02-Programming-Languages/Python/23_py_data_ingestion). For C# benchmarks, see [23_cs_data_ingestion](https://alp78.github.io/elysium/02-Programming-Languages/CSharp/23_cs_data_ingestion).

---

## Loading Methods Comparison

### Method Benchmark Table — throughput at 100K and 10M rows

> [!info] Benchmark Comparison
>
> Approximate throughput on a 4-core VM with SSD storage. Actual numbers vary with schema, data types, network latency, and indexing. Use these as relative comparisons, not absolutes.

| Method | Language | ~100K rows | ~10M rows | Transactional | Best For |
|--------|----------|-----------|-----------|---------------|----------|
| INSERT row-by-row | Any | 45s | Hours | Yes | Never in production |
| Parameterized `executemany` | Python | 12s | ~20min | Yes | Small loads <100K |
| pyodbc `fast_executemany` | Python | 1.2s | ~2min | Yes | Python pipelines |
| `bcp` utility | CLI | 0.8s | ~90s | No* | Bulk loads, any language |
| `BULK INSERT` | T-SQL | 0.7s | ~80s | Optional | SQL-driven loads |
| `SqlBulkCopy` | C# | 0.9s | ~100s | Yes | .NET pipelines |
| `OPENROWSET` | T-SQL | Varies | Varies | Yes | Ad-hoc external file reads |

*bcp uses `TABLOCK` for minimal logging — not transactional in the traditional sense.

### Which Loading Method for Which Scenario

> [!tip] Scenario-based selection
>
> The benchmark table shows throughput. Here is which method to choose based on your actual pipeline requirements.

**Daily batch pipeline (100K-1M rows, Python orchestrated):**
→ `pyodbc fast_executemany`. Already in your language, transactional, good enough throughput. Only switch to bcp if profiling shows loading as the bottleneck.

**Initial historical backfill (10M+ rows, one-time):**
→ `bcp` with format file. Fastest path. Accept the trade-offs (no transactions, encoding quirks) because you're running this once.

**Real-time micro-batches (1K rows every 5 minutes):**
→ `pyodbc fast_executemany` with small batch size. The overhead of spawning bcp for 1K rows exceeds the throughput gain.

**C# service writing to SQL Server:**
→ `SqlBulkCopy`. Native .NET, transactional, comparable to bcp throughput. Never use `SqlCommand.ExecuteNonQuery` in a loop.

**Cross-database load (BigQuery → SQL Server):**
→ Export from BigQuery to GCS as CSV/Parquet → `gcloud storage cp` to VM → `bcp` or `BULK INSERT`. There is no direct connector between BigQuery and SQL Server.

---

## Truncate-and-Reload

The simplest loading strategy: delete existing data, load fresh. Used when the source provides a complete snapshot on every run.

### TRUNCATE TABLE → INSERT — full refresh pattern

> [!info] When to Use Truncate-and-Reload
>
> Best for small tables (<1M rows), dimension tables, or snapshot data where history is preserved downstream (e.g., in silver). Bronze tables in a [medallion-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/medallion-architecture) are typically truncate-and-reload.

```sql
-- Step 1: Clear existing data for this partition key
BEGIN TRANSACTION;

DELETE FROM bronze.signals_daily
WHERE _index = @index_key;    -- scoped delete, not full truncate

-- Step 2: Bulk insert the fresh snapshot
INSERT INTO bronze.signals_daily (
    _index, symbol, timestamp, current_price, forward_pe, ...
) VALUES (?, ?, ?, ?, ?, ...);

COMMIT;
```

> [!warning] TRUNCATE vs DELETE
>
> `TRUNCATE TABLE` is faster (minimal logging, no row-by-row log entries) but requires `ALTER TABLE` permission, resets `IDENTITY`, and cannot be scoped with a `WHERE` clause. Use `DELETE` when you need to clear a subset (e.g., by `_index`). `TRUNCATE` cannot be rolled back in user transactions on all recovery models — see [idempotent-pipeline-design](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design) for details.

> [!success] Use Scoped DELETE Inside a Transaction
>
> For partition-key-scoped clears (e.g., clearing one index at a time), use `DELETE FROM table WHERE _index = @key` wrapped in `BEGIN TRANSACTION ... COMMIT`. This is fully rollback-safe, does not reset `IDENTITY`, and requires no elevated permissions. Reserve `TRUNCATE` for full-table resets on tables with no surrogate keys exposed downstream.

---

## Staging Table + Swap

Load into a staging table, validate, then swap with production. Provides zero-downtime loads with a validation gate.

### sp_rename Swap — fast rename approach

> [!info] Staging Swap Pattern
>
> Load completes invisibly in a staging table. Readers see the old data until the swap, which is near-instant.

```sql
-- Step 1: Load into staging (identical DDL to production)
TRUNCATE TABLE staging.signals_daily;
-- ... bulk load into staging.signals_daily ...

-- Step 2: Validate
IF (SELECT COUNT(*) FROM staging.signals_daily) < 100
    THROW 50001, 'Row count below threshold — aborting swap', 1;

-- Step 3: Swap (atomic rename)
EXEC sp_rename 'gold.signals_daily',    'signals_daily_old';
EXEC sp_rename 'staging.signals_daily', 'signals_daily';
EXEC sp_rename 'gold.signals_daily_old', 'signals_daily';  -- move old to staging
```

> [!warning] sp_rename Metadata Lock
>
> `sp_rename` takes a schema modification lock (Sch-M). Any concurrent queries on the table will block until the rename completes. For lock-free swaps, use partition `SWITCH` instead.

> [!success] Use Partition SWITCH for Lock-Free Swaps
>
> Replace the `sp_rename` approach with `ALTER TABLE staging.signals_daily SWITCH TO gold.signals_daily PARTITION N`. The `SWITCH` is a metadata-only operation with no data movement and no Sch-M lock on the production table during the copy phase. Only partition the table if you need this level of concurrency; otherwise, schedule `sp_rename` during a low-traffic window.

### Partition SWITCH — instant, zero-lock swap

> [!tip] Partition SWITCH for Zero-Downtime
>
> `SWITCH` is a metadata-only operation — no data moves. Requires matching indexes, same filegroup, and a `CHECK` constraint on the staging table that matches the partition boundary. See [partitioning-strategies](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/partitioning-strategies) for full `SWITCH` mechanics.

```sql
-- Staging table has CHECK constraint matching the target partition
ALTER TABLE staging.signals_daily
    ADD CONSTRAINT CK_staging_date
    CHECK (signal_date >= '2025-03-01' AND signal_date < '2025-04-01');

-- Instant swap: staging partition → production partition
ALTER TABLE staging.signals_daily
    SWITCH TO gold.signals_daily PARTITION 3;
```

---

## Watermarks — The Foundation of Incremental Loading

A watermark is a **persisted bookmark** that records how far a pipeline has processed. It answers the question: "where did I leave off last time?" Every incremental loading strategy — append, upsert, partition-based — depends on a reliable watermark. Without one, the pipeline either reprocesses everything (wasteful) or guesses where to start (dangerous). For the architectural theory behind idempotent incremental pipelines, see [idempotent-pipeline-design](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design). For how Airflow orchestrates watermark-driven loads, see [airflow-dag-patterns](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-dag-patterns).

### What a Watermark Is — definition and types

> [!info] Watermark Definition
>
> A watermark is a single value — a date, timestamp, integer ID, or LSN (Log Sequence Number) — that marks the boundary between "already processed" and "not yet processed" data. The pipeline reads only data **after** the watermark, processes it, then **advances** the watermark to the new boundary.

| Watermark Type | Column Example | Best For | Gotchas |
|----------------|----------------|----------|---------|
| **Date** | `signal_date`, `trade_date` | Daily batch pipelines, date-partitioned data | Late-arriving data below the date boundary |
| **Timestamp** | `_ingested_at`, `modified_at` | Near-real-time pipelines, event streams | Clock skew between source and destination |
| **Monotonic ID** | `IDENTITY`, `BIGINT` sequence | Append-only tables with no updates | Gaps after rollbacks, resets after TRUNCATE |
| **LSN** | `sys.fn_cdc_get_max_lsn()` | CDC-based change capture | Binary format, not human-readable |

**The watermark contract:** data at or before the watermark has been processed. Data after the watermark has not. The pipeline must advance the watermark only after a successful commit — never before.

### Where Watermarks Are Stored — four approaches

> [!tip] Storage Decision
>
> Choose based on transactional guarantees, visibility, and who owns the pipeline.

#### Control Table in the Database — transactional with the load

The most robust approach. The watermark update and the data INSERT happen in the same transaction — if the load fails, the watermark doesn't advance.

```sql
-- Control table DDL
CREATE TABLE meta.watermarks (
    pipeline_name   VARCHAR(100)  NOT NULL PRIMARY KEY,
    watermark_value VARCHAR(50)   NOT NULL,   -- stores date, timestamp, or ID as string
    watermark_type  VARCHAR(20)   NOT NULL,   -- 'date', 'timestamp', 'identity', 'lsn'
    updated_at      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_by      VARCHAR(100)  NOT NULL DEFAULT SYSTEM_USER
);
```

```sql
-- Usage: read watermark, load data, advance watermark — all in one transaction
BEGIN TRANSACTION;

DECLARE @wm DATE = (
    SELECT CAST(watermark_value AS DATE)
    FROM meta.watermarks
    WHERE pipeline_name = 'ohlcv_europe'
);

INSERT INTO silver.index_europe_ohlcv (symbol, date, ...)
SELECT symbol, date, ...
FROM bronze.index_europe_ohlcv
WHERE date > @wm
  AND NOT EXISTS (
      SELECT 1 FROM silver.index_europe_ohlcv t
      WHERE t.symbol = b.symbol AND t.date = b.date
  );

-- Advance watermark only after successful insert
UPDATE meta.watermarks
SET watermark_value = CONVERT(VARCHAR(10), GETDATE(), 120),
    updated_at = SYSUTCDATETIME()
WHERE pipeline_name = 'ohlcv_europe';

COMMIT;
```

#### Derived from Target Table — no storage, computed each run

The simplest approach. Query `MAX(date)` from the target table. No extra table to maintain, but requires a scan of the target each run.

```sql
-- Derived watermark — no control table needed
DECLARE @wm DATE = (
    SELECT MAX(date) FROM silver.index_europe_ohlcv
    WHERE is_filled = 0   -- only real data, not forward-filled rows
);
```

> [!warning] Derived Watermark Limitations
>
> If the target table is empty (first run, or after a truncate), `MAX()` returns `NULL`. Always handle the NULL case: `ISNULL(@wm, '1900-01-01')`. Also: if the target has millions of rows without a clustered index on the watermark column, the `MAX()` scan is expensive. Add a covering index.

> [!success] Seed the NULL Case and Index the Watermark Column
>
> Always seed the `NULL` result: `DECLARE @wm DATE = ISNULL((SELECT MAX(date) FROM silver.index_europe_ohlcv WHERE is_filled = 0), '1900-01-01')`. Ensure a clustered or covering index exists on the watermark column so `MAX()` is an index seek, not a full table scan.

#### Airflow Variable — orchestrator-managed

Store the watermark in Airflow's metadata database. Visible and editable in the Airflow UI. Good for pipelines where reprocessing means manually changing the variable.

```python
from airflow.models import Variable

# Read watermark
wm = Variable.get("ohlcv_europe_watermark", default_var="1900-01-01")

# ... load data where date > wm ...

# Advance watermark after successful load
Variable.set("ohlcv_europe_watermark", str(new_max_date))
```

> [!warning] Airflow Variable is not transactional
>
> `Variable.set()` commits immediately to Airflow's metadata DB. If the data load fails AFTER the variable is set, the watermark has advanced past data that was never loaded — causing a gap. Set the variable only after the database transaction commits.

> [!success] Advance Airflow Variable Only After Successful Commit
>
> Structure your Airflow operator so the DB transaction commits first, then `Variable.set()` is called in the same `try` block after a confirmed commit. Alternatively, use a control table in the same DB as the load target and update it inside the same transaction — this is the most reliable approach when using SQL Server as both source and target.

#### Pipeline Output File — simple but fragile

Write the watermark to a file on disk or in GCS. Used in simple scripts that don't have access to a database or orchestrator.

```python
# Read watermark from file
with open("/opt/pipeline/watermarks/ohlcv_europe.txt") as f:
    wm = f.read().strip()

# ... load data ...

# Write new watermark
with open("/opt/pipeline/watermarks/ohlcv_europe.txt", "w") as f:
    f.write(str(new_max_date))
```

> [!danger] File-Based Watermarks Are Fragile
>
> Files can be accidentally deleted, are not transactional, don't survive VM reimaging, and have no audit trail. Use only for throwaway scripts. For anything running in production, use a control table or Airflow Variable.

> [!success] Use a Control Table for Production Watermarks
>
> Create a `meta.watermarks` table in the same database as the pipeline target. Update the watermark inside the same `BEGIN TRANSACTION ... COMMIT` as the data load — if the load fails, the watermark is not advanced. This is atomic, survives VM reimaging, and provides a built-in audit trail via `updated_at` and `updated_by` columns.

### Watermark Lifecycle — from first run to steady state

> [!info] Watermark State Machine
>
> A watermark goes through a predictable lifecycle. Understanding each state prevents the most common watermark bugs.

| Phase | Watermark State | What Happens |
|-------|----------------|--------------|
| **First run** | NULL or seed value (`1900-01-01`) | Full load — everything from source is loaded. Watermark set to `MAX(date)` of loaded data |
| **Steady state** | Valid date/timestamp | Incremental load — only data after the watermark. Watermark advances after each successful run |
| **Backfill** | Manually reset to past date | Reprocesses historical data from the reset point. Must handle deduplication (UNIQUE constraint or `NOT EXISTS`) |
| **Recovery after failure** | Unchanged (load failed, watermark didn't advance) | Pipeline retries from the same watermark. Idempotent if target has UNIQUE constraint |
| **Table rebuild** | Must be reset or re-derived | After TRUNCATE or full rebuild, reset watermark to match the new state or let derived `MAX()` handle it |

#### Seed value for first run — handling NULL watermarks

```sql
-- Always handle the NULL case on first run
DECLARE @wm DATE = ISNULL(
    (SELECT CAST(watermark_value AS DATE)
     FROM meta.watermarks
     WHERE pipeline_name = 'ohlcv_europe'),
    '1900-01-01'   -- seed: load everything on first run
);
```

### Late-Arriving Data — the overlap window pattern

> [!warning] Late-Arriving Data
>
> Data that arrives after the watermark has advanced is silently missed. This is the most common watermark bug. Sources that cause this: timezone-shifted batch files, retroactive corrections, API responses with stale timestamps, and source systems that backfill data.

> [!success] Apply an Overlap Window with Deduplication
>
> Subtract an overlap window from the watermark (`DATEADD(DAY, -N, @wm)`) and pair every load with a `NOT EXISTS` check or rely on the target UNIQUE constraint to prevent duplicates. Size the window to your source's maximum expected lateness: 1 day for daily batches, 7 days for weekly corrections, 35 days for monthly restatements.

```sql
-- Mitigation: subtract an overlap window from the watermark
DECLARE @safe_wm DATE = DATEADD(DAY, -1, @wm);

-- Load with overlap, then deduplicate via NOT EXISTS
INSERT INTO silver.index_europe_ohlcv (symbol, date, ...)
SELECT symbol, date, ...
FROM bronze.index_europe_ohlcv b
WHERE b.date > @safe_wm
  AND NOT EXISTS (
      SELECT 1 FROM silver.index_europe_ohlcv t
      WHERE t.symbol = b.symbol AND t.date = b.date
  );
```

> [!tip] Choosing the overlap window size
>
> The overlap should match the maximum expected lateness of your source data. For daily yfinance fetches, 1 day is sufficient. For sources with weekly corrections (e.g., revised economic indicators), use 7 days. For sources with monthly restatements, use 35 days. Wider overlap = more rows re-checked each run, but the `NOT EXISTS` or `UNIQUE` constraint prevents duplicates.

### Watermark Maintenance — keeping them healthy

> [!info] Watermark Hygiene
>
> Watermarks are persistent state. Like any state, they can become stale, corrupted, or out of sync with reality. These maintenance practices prevent watermark-related incidents.

- **Audit trail:** the `updated_at` and `updated_by` columns in the control table show when the watermark last advanced and who/what changed it. Query this when debugging stale pipelines
- **Monitoring:** alert when a watermark hasn't advanced in longer than the expected pipeline frequency. A watermark stuck for 24 hours on a pipeline that runs every 6 hours means something is broken

#### SELECT stale watermarks — monitoring query

```sql
-- Watermarks that haven't advanced in 24+ hours
SELECT pipeline_name,
       watermark_value,
       updated_at,
       DATEDIFF(HOUR, updated_at, SYSUTCDATETIME()) AS hours_stale
FROM meta.watermarks
WHERE DATEDIFF(HOUR, updated_at, SYSUTCDATETIME()) > 24
ORDER BY hours_stale DESC;
```

- **Manual reset for backfill:** to reprocess historical data, UPDATE the watermark to a past date. The next pipeline run loads everything from that point forward. The target table's UNIQUE constraint prevents duplicates

#### UPDATE watermark — manual reset for backfill

```sql
-- Reset watermark to reprocess from March 1st
UPDATE meta.watermarks
SET watermark_value = '2025-03-01',
    updated_at = SYSUTCDATETIME(),
    updated_by = 'manual-backfill'
WHERE pipeline_name = 'ohlcv_europe';
```

- **Cleanup after table rebuild:** if you TRUNCATE or rebuild a target table, the watermark and the table are out of sync. Either reset the watermark to match (derive from `MAX(date)` in the rebuilt table) or delete the watermark row and let the next run do a full load
- **Version watermarks alongside schema:** when a schema migration changes the watermark column (e.g., renaming `date` to `trade_date`), the watermark query breaks. Include watermark maintenance in migration scripts

### Watermark Anti-Patterns

### Advancing watermark before committing the load — data gaps

> [!danger] Watermark Before Commit = Data Loss
>
> If you advance the watermark, then the INSERT fails, the watermark points past data that was never loaded. The next run skips that data forever. Always advance the watermark INSIDE the same transaction as the load, or AFTER the load transaction commits.

> [!success] Advance Watermark Inside the Same Transaction
>
> In T-SQL, place the `UPDATE meta.watermarks` statement at the end of the same `BEGIN TRANSACTION ... COMMIT` block as the `INSERT`. In Python, call `Variable.set()` or update the control table only after `conn.commit()` confirms the data load succeeded. Never advance the watermark in a `finally` block that runs regardless of success or failure.

### No deduplication with overlap windows — duplicate rows

If you use an overlap window (subtract N days from watermark) but the target table has no UNIQUE constraint and the INSERT has no `NOT EXISTS` check, every overlapping row is inserted again on every run. Within a week, you have 7 copies of each row in the overlap window.

### Using IDENTITY as watermark on a truncate-reload table — broken contract

`IDENTITY` values reset on `TRUNCATE`. If the source table is truncated and reloaded, the same IDENTITY value now points to a different row. Use a business date or timestamp column as the watermark, not IDENTITY. See [sql-server-pipeline-anti-patterns > IDENTITY as a Business Key](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-pipeline-anti-patterns#identity-as-a-business-key).

### No NULL handling on first run — pipeline crashes on empty table

`SELECT MAX(date)` on an empty table returns `NULL`. If the pipeline uses `WHERE date > @wm` without handling NULL, the comparison `date > NULL` is always FALSE — zero rows loaded, forever. Always wrap in `ISNULL(@wm, '1900-01-01')`.

### Watermark stored outside the load transaction — silent drift

An Airflow Variable, a file, or a separate database write is not transactional with the load. If the load succeeds but the watermark write fails (or vice versa), the watermark and the actual data drift apart. Prefer a control table in the same database as the target, updated in the same transaction.

---

## Incremental Append

Insert only rows newer than the last loaded row. Used for append-only data like logs, events, and OHLCV prices. Depends on a reliable watermark (defined above).

### High-Water Mark Load — append new data only

> [!info] Append Pattern
>
> Read the watermark, load everything after it, advance the watermark. The target table's UNIQUE constraint is the safety net against duplicates.

```sql
-- Step 1: Get the watermark (last loaded date)
DECLARE @wm DATE = ISNULL(
    (SELECT MAX(date) FROM silver.index_europe_ohlcv
     WHERE is_filled = 0),
    '1900-01-01'
);

-- Step 2: Load everything newer, deduplicate
INSERT INTO silver.index_europe_ohlcv (symbol, date, ...)
SELECT symbol, date, ...
FROM bronze.index_europe_ohlcv b
WHERE b.date > @wm
  AND NOT EXISTS (
      SELECT 1 FROM silver.index_europe_ohlcv t
      WHERE t.symbol = b.symbol AND t.date = b.date
  );
```

---

## Upsert (INSERT + UPDATE)

When source data contains both new rows and updates to existing rows. Three approaches, each with different trade-offs.

### Three Upsert Approaches — compared

> [!info] Upsert Strategy Decision
>
> Choose based on data volume and control requirements. For full MERGE syntax, see [merge-and-upsert](https://alp78.github.io/elysium/04-SQL-Server/T-SQL/merge-and-upsert). For idempotency guarantees, see [idempotent-pipeline-design](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design).

| Approach | Speed | Safety | Complexity | Best For |
|----------|-------|--------|------------|----------|
| DELETE + INSERT | Medium | High | Low | Small-medium tables, simple logic |
| MERGE | Fast | Medium (has gotchas) | Medium | Single-statement atomicity |
| Staging + separate INSERT/UPDATE | Fast | Highest | Higher | Large volumes, full control |

**Choose DELETE + INSERT when:** the target table is small (<1M rows), the logic is simple (one partition key), and you want maximum readability. This is what the Medallion-Project bronze loaders use.

**Choose MERGE when:** you need a single atomic statement that handles insert/update/delete in one pass, and you understand the locking gotchas (see [merge-and-upsert](https://alp78.github.io/elysium/04-SQL-Server/T-SQL/merge-and-upsert)). Best for medium-volume tables with a clear natural key.

**Choose Staging + separate INSERT/UPDATE when:** the volume is large (>1M rows), you want to separate insert and update logic for debugging, or you need to validate before committing. Most production pipelines at scale land here.

### DELETE + INSERT — simplest upsert

```sql
-- Delete existing rows for this key, then insert all rows
BEGIN TRANSACTION;

DELETE FROM silver.signals_daily
WHERE _index = @key AND signal_date = @date;

INSERT INTO silver.signals_daily (_index, symbol, signal_date, ...)
SELECT _index, symbol, signal_date, ...
FROM bronze.signals_daily
WHERE _index = @key;

COMMIT;
```

### Staging Table + Separate INSERT/UPDATE — maximum control

```sql
-- Step 1: Load source data into a staging table
-- Step 2: INSERT rows that don't exist in target
INSERT INTO silver.signals_daily (...)
SELECT s.* FROM staging.signals s
WHERE NOT EXISTS (
    SELECT 1 FROM silver.signals_daily t
    WHERE t._index = s._index
      AND t.symbol = s.symbol
      AND t.signal_date = s.signal_date
);

-- Step 3: UPDATE rows that exist but changed
UPDATE t
SET t.current_price = s.current_price, ...
FROM silver.signals_daily t
JOIN staging.signals s
    ON t._index = s._index
   AND t.symbol = s.symbol
   AND t.signal_date = s.signal_date
WHERE t.current_price <> s.current_price;  -- only update if changed
```

---

## pyodbc fast_executemany Deep Dive

The standard Python path for loading data into SQL Server. One configuration flag gives a 10x speedup.

### cursor.fast_executemany = True — batch mode activation

> [!abstract] How fast_executemany Works
>
> Without it, pyodbc sends one row per TDS network round-trip. With it, pyodbc batches all parameter arrays into a single TDS call. The speedup is proportional to network latency.

```python
# One line, 10x speedup — always enable for bulk loads
cursor.fast_executemany = True
cursor.executemany(
    "INSERT INTO bronze.signals_daily (...) VALUES (?, ?, ?, ...)",
    rows    # list of tuples — one tuple per row
)
conn.commit()
```

### fast_executemany Gotchas

> [!warning] NaN and None Handling
>
> pyodbc sends Python `float('nan')` as the string `"nan"`, not `NULL`. Convert explicitly before loading: `None if math.isnan(v) else v`. Similarly, `numpy.int64` is not a native Python type — cast to `int()` before passing to pyodbc.

> [!success] Sanitise Rows Before fast_executemany
>
> Apply a row-cleaning function before calling `executemany`: convert `float('nan')` → `None`, cast `numpy.int64` → `int`, and cast `numpy.float64` → `float`. A one-line list comprehension over the row tuple handles all three before the batch is sent to the driver.

- **Batch size:** 5,000-10,000 rows per `executemany` call is optimal. Too large = memory pressure on the driver; too small = round-trip overhead
- **Column type matching:** Python `float` maps to SQL `FLOAT`; Python `str` to `NVARCHAR`. Mismatches cause implicit conversions — see [sargable-queries](https://alp78.github.io/elysium/04-SQL-Server/T-SQL/sargable-queries) for why this kills performance
- **None vs NULL:** `None` becomes SQL `NULL` — correct. But `numpy.nan` does not — convert first

---

## bcp Deep Dive

The fastest path into SQL Server. `bcp` bypasses the query processor entirely and writes directly to data pages.

### bcp BULK LOAD — command-line syntax

> [!info] bcp Usage
>
> `bcp` is a command-line utility shipped with SQL Server. It reads flat files (CSV, TSV) and writes directly to tables. Fastest option for large loads from any language that can shell out.

```bash
# Load a CSV into bronze.signals_daily
bcp bronze.signals_daily in signals.csv \
    -S localhost,1434 \
    -U sa -P "$SA_PASSWORD" \
    -d analytics_db \
    -c -t "," \          # character mode, comma delimiter
    -F 2 \               # skip header row
    -e errors.log \      # error output file
    -b 10000             # batch size (rows per transaction)
```

### bcp Gotchas

> [!danger] Silent Truncation
>
> If a CSV field exceeds the target column width (e.g., 25-char string into `VARCHAR(20)`), bcp **silently truncates** the data. No error, no warning. Always validate row counts and spot-check loaded data.

> [!success] Pre-Validate String Lengths Before bcp
>
> Before running `bcp`, query the source data for any field that exceeds the target column's declared width: `SELECT MAX(LEN(field)) FROM staging_table`. Alternatively, use a format file with wider intermediate columns and apply length validation in a post-load check. Always compare source row count against loaded row count — a mismatch is the first signal of silent truncation.

> [!warning] Encoding and Date Formats
>
> bcp defaults to OEM codepage, not UTF-8. Use `-w` for Unicode data. Date parsing depends on the server's locale setting — `SET DATEFORMAT ymd` before load or use ISO 8601 format (`YYYY-MM-DD`) in source files.

> [!success] Use -w for Unicode and ISO 8601 Dates
>
> Always pass `-w` when loading files that contain non-ASCII characters (accented names, CJK characters). Standardise date columns to ISO 8601 (`YYYY-MM-DD`) in the source file to avoid locale-dependent parsing — this works regardless of `DATEFORMAT` setting on the server.

- **Format files:** `-c` (character/CSV), `-n` (native binary), `-w` (wide character/Unicode)
- **Error handling:** `-e error_file` logs bad rows, `-m max_errors` sets failure threshold
- **First-row skip:** `-F 2` skips the header row in CSVs
- **TABLOCK:** Add `-h "TABLOCK"` for minimal logging (5-10x faster, but blocks concurrent reads)

### bcp Complete Flag Reference

Every `bcp` flag in one table. The bullet list above covers the most common flags; this table is the full reference for advanced scenarios like format files, Unicode mode, identity preservation, and query hints.

| Flag | Purpose | Example |
|------|---------|---------|
| `-S` | Server name or DSN | `-S prod-sql01` |
| `-d` | Database name | `-d FinanceDB` |
| `-U` | Username (SQL auth) | `-U sa` |
| `-P` | Password | `-P 'P@ss!'` |
| `-T` | Trusted (Windows) auth | `-T` |
| `-c` | Character mode (text, recommended for portability) | `-c` |
| `-n` | Native SQL Server data types | `-n` |
| `-N` | Unicode chars, native for non-char types | `-N` |
| `-w` | Unicode character mode | `-w` |
| `-t` | Field terminator | `-t ","` |
| `-r` | Row terminator | `-r "\n"` |
| `-F` | First row to import/export (1-based) | `-F 2` |
| `-L` | Last row to import/export | `-L 1000` |
| `-b` | Batch size (rows per transaction) | `-b 10000` |
| `-e` | Error file path | `-e /logs/err.log` |
| `-m` | Max errors before abort | `-m 10` |
| `-f` | Format file path | `-f /fmt/trades.fmt` |
| `-x` | Generate XML format file (with `-f`) | `-x` |
| `-q` | Quoted identifiers for table/view names | `-q` |
| `-k` | Keep NULL values instead of defaults | `-k` |
| `-E` | Keep identity values from data file | `-E` |
| `-h` | Hints: `TABLOCK`, `ORDER(col)`, `ROWS_PER_BATCH=N` | `-h "TABLOCK"` |
| `-a` | Packet size (512–65535 bytes) | `-a 65535` |
| `-l` | Login timeout | `-l 30` |

### Format File Generation

A format file defines the column mapping between a flat file and a SQL Server table. Use it when column order differs, when you need to skip columns, or when importing into a table with an IDENTITY column. Generate once, reuse across loads.

#### bcp format nul — generate non-XML format file

```bash
bcp FinanceDB.dbo.trades format nul -S prod-sql01 -T -c -t "," -f /fmt/trades.fmt
```

#### bcp format nul -x — generate XML format file

```bash
bcp FinanceDB.dbo.trades format nul -S prod-sql01 -T -c -t "," -f /fmt/trades.xml -x
```

---

## SqlBulkCopy — C# Bulk Loading

The C# equivalent of bcp — high throughput with full transaction support. For detailed C# ingestion benchmarks, see [23_cs_data_ingestion](https://alp78.github.io/elysium/02-Programming-Languages/CSharp/23_cs_data_ingestion).

### SqlBulkCopy WriteToServer — .NET bulk load with transaction

> [!info] C# bulk loading
>
> `SqlBulkCopy` uses the same TDS bulk-load protocol as bcp. Use `SqlBulkCopyOptions.TableLock` for minimal logging on heaps. Wrap in a transaction for atomicity.

```csharp
using var connection = new SqlConnection(connectionString);
connection.Open();
using var transaction = connection.BeginTransaction();

using var bulkCopy = new SqlBulkCopy(
    connection, SqlBulkCopyOptions.TableLock, transaction)
{
    DestinationTableName = "bronze.signals_daily",
    BatchSize = 10_000,
    BulkCopyTimeout = 600   // seconds
};

// Map source columns to destination columns explicitly
bulkCopy.ColumnMappings.Add("Symbol", "symbol");
bulkCopy.ColumnMappings.Add("Date", "signal_date");
bulkCopy.ColumnMappings.Add("Price", "current_price");

bulkCopy.WriteToServer(dataTable);   // DataTable, IDataReader, or DataRow[]
transaction.Commit();
```

> [!warning] SqlBulkCopy silent truncation
>
> Like bcp, `SqlBulkCopy` silently truncates strings exceeding the destination column width. A 250-character company name loaded into `NVARCHAR(200)` is silently cut to 200 characters — no error, no warning. Validate string lengths before loading or set `bulkCopy.EnableStreaming = true` with a validating `IDataReader` wrapper.

> [!success] Validate String Widths Before SqlBulkCopy
>
> Before calling `WriteToServer`, iterate the `DataTable` columns and check `MaxLength` against the source data: any value exceeding the destination column's declared width should raise an exception rather than silently truncate. Alternatively, wrap a `DataTableReader` in an `IDataReader` implementation that throws on over-length strings, then pass that reader to `WriteToServer` with `EnableStreaming = true`.

---

## BULK INSERT — T-SQL Native Bulk Load

Same engine as `bcp` but called from T-SQL. Useful when the load is orchestrated by a stored procedure.

### BULK INSERT FROM — loading a CSV from T-SQL

> [!info] BULK INSERT
>
> Reads a file accessible to the SQL Server process (local disk or network share). Cannot read from client machines — the file must be on the server or a UNC path the service account can reach.

```sql
BULK INSERT bronze.signals_daily
FROM '/var/opt/mssql/data/signals.csv'
WITH (
    FIELDTERMINATOR = ',',
    ROWTERMINATOR = '\n',
    FIRSTROW = 2,           -- skip header
    TABLOCK,                -- minimal logging
    ERRORFILE = '/var/opt/mssql/data/signals_errors.log',
    MAXERRORS = 100
);
```

---

## Minimal Logging

Minimal logging skips detailed transaction log writes for bulk operations, giving 5-10x speedup on large loads.

### Minimal Logging Requirements — when it kicks in

> [!info] Minimal Logging Conditions
>
> All three conditions must be met: correct recovery model, `TABLOCK` hint, and specific table state. If any condition is missing, the load falls back to full logging.

| Condition | Requirement |
|-----------|-------------|
| Recovery model | `SIMPLE` or `BULK_LOGGED` |
| Locking hint | `TABLOCK` on the target table |
| Table state | Empty heap, or empty clustered index, or `SWITCH` into empty partition |

- **bcp with TABLOCK:** minimal logging automatically
- **`INSERT ... SELECT` with TABLOCK on a heap:** minimal logging if table is empty
- **`INSERT ... SELECT` into a table with clustered index + data:** NOT minimal logging
- **Impact:** 5-10x faster for large loads, but no point-in-time recovery until the next log backup completes

> [!warning] BULK_LOGGED Recovery Trade-off
>
> `BULK_LOGGED` allows minimal logging without losing transactional safety for non-bulk operations. However, if a log backup runs during the bulk operation, that backup contains the bulk-changed data extents — making it larger and non-restorable to a point within the bulk operation.

> [!success] Schedule Bulk Loads Outside Backup Windows
>
> When using `BULK_LOGGED`, coordinate bulk load schedules with your backup schedule so no log backup runs during the bulk operation. For databases with continuous log backup (e.g., every 15 minutes), switch to `SIMPLE` recovery model for the load window, run the bulk load, then switch back — or accept full logging with `FULL` recovery model if point-in-time recoverability during the load is required.

---

## Schema Migration CI/CD with GitHub Actions

### Automated SQL Server migration — IAP tunnel + sqlcmd

> [!info] Automated SQL Server schema deployment
>
> Run migration scripts against SQL Server as part of your CI/CD pipeline. The IAP tunnel connects GitHub Actions to your private GCP Compute Engine VM. See [github-actions-data-engineering](https://alp78.github.io/elysium/10-GitHub-Actions/github-actions-data-engineering) for more GCP CI/CD patterns.

```yaml
# .github/workflows/migrate-sql.yml
name: SQL Server Schema Migration
on:
  push:
    paths: ['db/migrations/**']

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Open IAP tunnel to SQL Server VM
        run: |
          gcloud compute start-iap-tunnel sql-vm 1433 \
            --local-host-port=127.0.0.1:1433 \
            --zone=europe-west1-b &
          sleep 5

      - name: Run migrations
        run: |
          for f in db/migrations/*.sql; do
            sqlcmd -S 127.0.0.1,1433 \
              -U sa -P "${{ secrets.SA_PASSWORD }}" \
              -d analytics_db -i "$f" -b
          done
```

> [!warning] Migration ordering
>
> `for f in db/migrations/*.sql` relies on lexicographic ordering. Prefix migration files with timestamps: `20260329_001_add_column.sql`. The `-b` flag tells `sqlcmd` to abort on error — without it, a failing migration continues silently and subsequent scripts may break on missing objects.

> [!success] Timestamp-Prefix Migrations and Enforce Abort on Error
>
> Name every migration file with a timestamp prefix (`YYYYMMDD_NNN_description.sql`) so lexicographic sort equals chronological order. Always pass `-b` to `sqlcmd` to abort on error, and check the exit code in the workflow step so the GitHub Actions job fails visibly rather than silently continuing with a broken schema.

---

## Anti-Patterns

### Row-by-Row INSERT in a Python Loop — the #1 performance killer

A `for row in data: cursor.execute("INSERT ...", row)` loop sends one network round-trip per row. At 100K rows, that's 100K round-trips instead of one. Always use `executemany` with `fast_executemany = True`.

### Loading Directly to Production — no staging, no validation

Without a staging step, a bad file (wrong schema, partial data, corrupt encoding) lands directly in the table your dashboard reads. Always load to staging first, validate, then promote.

### No Transaction Wrapper on Multi-Step Loads

A `DELETE` followed by `INSERT` without a transaction means a failure between the two leaves the table empty. Wrap multi-step loads in `BEGIN TRANSACTION ... COMMIT`.

### IDENTITY as a Business Key

`IDENTITY` values reset on `TRUNCATE`, have gaps on rollback, and differ between environments. Use natural keys or UUIDs for business identifiers; reserve `IDENTITY` for surrogate keys that are never exposed to users.

### VARCHAR Columns Wider Than Needed

`bcp` allocates memory per column's declared max width. A `VARCHAR(MAX)` column that stores 20-character strings wastes memory during bulk load and can cause out-of-memory errors with `bcp`.

### Missing Indexes on Staging Table Join Keys

When using MERGE or staging-based upsert, the join between staging and target becomes a full scan if the staging table has no index on the join columns. Add a non-clustered index on the key columns of the staging table.

---

## Medallion-Project Reference

> [!example]- Medallion-Project: JSON → pyodbc → bronze tables
>
> The financial index pipeline uses truncate-and-reload for most bronze tables and a Python-side merge (INSERT new + UPDATE changed) for OHLCV data:
>
> ```python
> # Bronze loader: truncate-and-reload with fast_executemany
> cursor.fast_executemany = True
> cursor.execute("DELETE FROM bronze.signals_daily WHERE _index = ?", key)
> cursor.executemany("INSERT INTO bronze.signals_daily (...) VALUES (?, ...)", rows)
> conn.commit()
> ```
>
> OHLCV uses an application-side merge: read existing keys into a dict, partition incoming rows into inserts vs updates, execute each batch separately. See [bronze-layer-loading](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/bronze-layer-loading) for the full implementation.


## Related
- [data-flow-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/data-flow-architecture) — complete data movement topology and transfer method decision matrix
