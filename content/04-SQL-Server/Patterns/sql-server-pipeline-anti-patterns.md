---
title: "SQL Server Pipeline Anti-Patterns"
type: reference
category: data-engineering
technology: [sql-server]
tags:
  - sql-server
  - tsql
  - data-engineering
  - patterns
  - anti-patterns
  - performance
  - data-quality
aliases: [Anti-Patterns, Pipeline Mistakes, SQL Server Gotchas, Common Mistakes]
keywords: [anti-patterns, row-by-row insert, SELECT star, silent truncation, cursor etl, NOLOCK, implicit conversion, identity business key, VARCHAR MAX, no staging, no transaction, deadlock, race condition, SCD2 duplicate, float comparison, window function spill]
description: "A dedicated anti-pattern reference for SQL Server data pipelines — 20+ mistakes that cause incidents, data quality issues, or performance crises, with the fix for each."
created: 2026-03-29
updated: 2026-03-29
status: complete
---

# SQL Server Pipeline Anti-Patterns — Mistakes That Cost Hours

Every anti-pattern here has been seen in production. Each one looked reasonable at the time. Each one caused an incident, a data quality issue, or a performance crisis.

Each anti-pattern follows the same structure: what it looks like, why people do it, what goes wrong, and the fix.

---

## Loading Anti-Patterns

### Row-by-Row INSERT in a Loop — the #1 performance killer

> [!danger] 100K Rows = 100K Network Round-Trips
>
> A Python `for` loop with `cursor.execute()` sends one INSERT per network round-trip. At 100K rows, this takes ~45 seconds vs ~1.2 seconds with `fast_executemany`.

```python
# BAD: row-by-row insert (45s for 100K rows)
for row in data:
    cursor.execute("INSERT INTO bronze.signals (...) VALUES (?, ...)", row)
```

**Why people do it:** it's the first pattern beginners learn; it works for 100 rows.

**The fix:** batch with `fast_executemany`. See [sql-server-loading-patterns](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-loading-patterns) for benchmarks.

```python
# GOOD: batch insert (1.2s for 100K rows)
cursor.fast_executemany = True
cursor.executemany("INSERT INTO bronze.signals (...) VALUES (?, ...)", rows)
```

### Loading Directly to Production — no staging, no validation

> [!danger] No Rollback Path
>
> When a corrupt CSV lands directly in the table your dashboard reads, the only fix is to DELETE the bad data and re-run the pipeline — while the dashboard shows garbage.

**Why people do it:** staging tables feel like "extra work" for small pipelines.

**The fix:** always load to staging first, validate (row count, NULL rates, schema check), then promote. See [sql-server-loading-patterns > Staging Table + Swap](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-loading-patterns#staging-table--swap) for the swap pattern.

### No Transaction Wrapper on Multi-Step Loads

> [!danger] Partial Load = Corrupt State
>
> A `DELETE` followed by `INSERT` without a transaction means a crash between the two leaves the table empty. Every multi-step load must be atomic.

```sql
-- BAD: no transaction
DELETE FROM silver.signals_daily WHERE _index = @key;
-- if crash here: table is empty, dashboard shows nothing
INSERT INTO silver.signals_daily (...) SELECT ... FROM bronze;

-- GOOD: atomic operation
BEGIN TRANSACTION;
DELETE FROM silver.signals_daily WHERE _index = @key;
INSERT INTO silver.signals_daily (...) SELECT ... FROM bronze;
COMMIT;
```

### Silent Truncation with bcp — data loss without warning

> [!danger] bcp Silently Truncates Data
>
> If a CSV field exceeds the column width (e.g., 25-char string into `VARCHAR(20)`), bcp cuts the data without any error or warning. You only discover this when downstream queries return truncated values.

**Why people do it:** bcp is the fastest loader and the truncation is invisible.

**The fix:** validate data lengths before loading, or use `-e error_file` with `-m 0` (zero tolerance for errors). Always spot-check loaded data against source. See [sql-server-loading-patterns > bcp Gotchas](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-loading-patterns#bcp-gotchas).

### IDENTITY as a Business Key — breaks on truncate and differs per environment

> [!warning] IDENTITY Values Are Not Stable
>
> IDENTITY resets on TRUNCATE, has gaps after rollbacks, and differs between dev/staging/prod. Any system that stores or references the IDENTITY value externally breaks when the table is rebuilt.

**The fix:** use natural keys (symbol + date) or deterministic surrogate keys (hash of business columns) for anything shared externally. Reserve IDENTITY for internal-only surrogate keys. See [idempotent-pipeline-design](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design).

---

## Schema Anti-Patterns

### Everything in dbo — no isolation, no permissions

> [!warning] Default Schema Trap
>
> Tables created without specifying a schema land in `dbo`. Mixing raw, cleaned, and gold tables in `dbo` makes layer-specific permissions impossible and forces `raw_`, `stg_`, `dim_` prefixes.

**The fix:** use schema-per-layer (`bronze`, `silver`, `gold`). See [sql-server-schema-layering](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-schema-layering).

### VARCHAR(MAX) for Everything — memory and performance waste

> [!warning] VARCHAR(MAX) Allocation
>
> `bcp` and `SqlBulkCopy` allocate memory based on the declared column width. `VARCHAR(MAX)` = 2GB allocation per row during bulk load, even if the actual data is 20 characters. This causes out-of-memory errors on large loads.

**The fix:** size columns to realistic maximums. `VARCHAR(20)` for tickers, `NVARCHAR(200)` for company names, `VARCHAR(500)` for URLs.

### Missing Metadata Columns — impossible to debug

> [!warning] No _ingested_at, No Debugging
>
> Without `_ingested_at` and `_source_file` in bronze tables, you cannot determine when a row arrived, trace bad data to its source, or verify pipeline freshness.

**The fix:** add `_ingested_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()` and `_source_file VARCHAR(500)` to every bronze table. Cost: ~16 bytes per row. Value: hours saved debugging.

### No Schema Separation Between Layers

Keeping bronze, silver, and gold tables in the same schema with naming prefixes (`raw_signals`, `clean_signals`, `rpt_signals`) provides no security isolation and makes `GRANT` statements table-by-table instead of schema-level.

**The fix:** one schema per layer. `GRANT SELECT ON SCHEMA::gold` covers all gold tables automatically. See [sql-server-schema-layering > Cross-Schema Security](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-schema-layering#cross-schema-security).

---

## Query Anti-Patterns

### SELECT * in ETL Pipelines — breaks on schema change

> [!warning] SELECT * Is Fragile
>
> When someone adds a column to the source table, `SELECT *` starts returning an extra column. If the INSERT has explicit columns, the column count mismatch throws an error. If it doesn't, the wrong data goes into the wrong column.

**The fix:** always list columns explicitly in ETL queries: `SELECT col1, col2, col3 FROM ...`

### Implicit Type Conversions in WHERE Clauses — kills indexes

> [!warning] Implicit Conversion = Table Scan
>
> `WHERE varchar_column = 123` forces SQL Server to convert every row's `varchar_column` to `INT` for comparison, preventing index seeks. The query plan shows a CONVERT_IMPLICIT warning.

**The fix:** match types exactly. `WHERE varchar_column = '123'`. See [sargable-queries](https://alp78.github.io/elysium/04-SQL-Server/T-SQL/sargable-queries) for the full list of index-killing patterns.

### NOLOCK as a "Performance Fix" — dirty reads in production

> [!danger] NOLOCK Reads Uncommitted Data
>
> `WITH (NOLOCK)` / `READ UNCOMMITTED` can read rows from transactions that will roll back, partially written pages, or rows that are being moved by an index rebuild. For dashboards and reports, this means displaying data that never actually existed.

**Why people do it:** it "fixes" blocking without changing the application.

**The fix:** enable RCSI (`ALTER DATABASE SET READ_COMMITTED_SNAPSHOT ON`). Readers get a consistent snapshot without blocking writers. See [blocking-and-locking](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/blocking-and-locking) for the RCSI setup.

### Cursor-Based ETL — row-by-row processing in T-SQL

> [!warning] Cursors Are Row-by-Row
>
> A DECLARE CURSOR / FETCH NEXT loop processes one row at a time, defeating SQL Server's set-based optimizer. A 1M-row cursor transform can be 100x slower than the equivalent set-based query.

**The fix:** rewrite as a single set-based INSERT/UPDATE with JOINs, window functions, or CTEs.

### Non-SARGable Date Filters — index-killing date functions

> [!warning] Functions on Columns Prevent Index Seeks
>
> `WHERE YEAR(signal_date) = 2025` applies `YEAR()` to every row, preventing an index seek on `signal_date`. The query scans the entire table.

**The fix:** use range predicates. `WHERE signal_date >= '2025-01-01' AND signal_date < '2026-01-01'`. See [sargable-queries](https://alp78.github.io/elysium/04-SQL-Server/T-SQL/sargable-queries) for more examples.

---

## Change Tracking Anti-Patterns

### Overwriting History in Place — destroyed audit trail

> [!danger] UPDATE Destroys History
>
> `UPDATE dim_stock SET sector = 'New' WHERE symbol = 'ASML'` overwrites the old sector value. You can never answer "what sector was ASML in last quarter?"

**The fix:** use SCD Type 2 (close old row, insert new row) or temporal tables. See [sql-server-change-tracking](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-change-tracking).

### SCD2 Without Filtered Unique Index — duplicate current rows

> [!danger] Silent Duplicate Active Rows
>
> Without `CREATE UNIQUE INDEX ... WHERE is_current = 1`, a bug in the close/insert logic creates two rows with `is_current = 1` for the same key. JOINs return duplicates; dashboard shows wrong data.

**The fix:** always create a filtered unique index on the active key columns. See [sql-server-change-tracking > SCD2 Schema](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-change-tracking#scd2-schema).

### Comparing NULLable Columns Without ISNULL — missed changes

> [!warning] NULL != NULL in SQL Server
>
> `WHERE old_sector <> new_sector` returns FALSE when both are NULL (they're "equal") and also returns FALSE when one is NULL and the other isn't. NULLable column comparisons silently skip changes.

```sql
-- BAD: misses NULL-to-value and value-to-NULL changes
WHERE old_sector <> new_sector

-- GOOD: handles NULLs correctly
WHERE ISNULL(old_sector, '___NULL___') <> ISNULL(new_sector, '___NULL___')

-- BETTER (SQL Server 2022+):
WHERE old_sector IS DISTINCT FROM new_sector
```

### Comparing Floating-Point Values for Equality — false change detection

> [!warning] Float Equality Fails
>
> `3.14` stored as `FLOAT` may become `3.1400000000000001`. A direct `<>` comparison flags this as a "change" and triggers an unnecessary SCD2 close/insert.

**The fix:** round to fixed precision (`ROUND(val, 4)`) or use epsilon comparison (`ABS(old - new) < 0.0001`).

---

## Concurrency Anti-Patterns

### Long-Running Transactions During Business Hours

> [!warning] Lock Escalation
>
> A transform that processes millions of rows in a single transaction can trigger lock escalation (>5,000 row locks → table lock), blocking every other query on the table — including dashboard reads.

**The fix:** batch large transforms into chunks (e.g., 10K rows per transaction). Or schedule heavy transforms during off-hours. See [blocking-and-locking](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/blocking-and-locking) for lock escalation thresholds.

### MERGE Without Proper Locking Hints — race conditions

> [!danger] Concurrent MERGE = Duplicate Inserts
>
> Two concurrent MERGE statements can both evaluate `WHEN NOT MATCHED` for the same key and both INSERT — creating duplicates. MERGE does not take an exclusive lock on "not found" keys by default.

**The fix:** add `WITH (HOLDLOCK)` on the target table, or serialize MERGE operations. See [race-conditions](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/race-conditions) for the full analysis.

### No Retry Logic for Deadlocks — pipeline fails on transient errors

> [!warning] Deadlocks Are Normal
>
> In a concurrent system, deadlocks happen. SQL Server kills one transaction (victim) and continues the other. Without retry logic, the killed pipeline run fails permanently instead of retrying.

**The fix:** catch error 1205 and retry with exponential backoff (3 attempts, 1s/2s/4s delay). See [deadlock-detection-and-prevention](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/deadlock-detection-and-prevention) for C# and Python retry patterns.

---

## Performance Anti-Patterns

### Window Functions Without Supporting Indexes — TempDB spill

> [!warning] Sort Spill = 10x Slower
>
> `ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date)` without a clustered index on `(symbol, date)` forces a full sort. On a 100M-row table, the sort spills to TempDB disk.

**The fix:** ensure the clustered index matches `PARTITION BY + ORDER BY`. See [sql-server-incremental-transforms > Window Function Performance](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-incremental-transforms#window-function-performance).

### Full-Table Aggregation That Could Be Incremental

Recomputing gold tables from all of silver on every run is wasteful once the table exceeds ~1M rows. If only the last 7 days changed, only recompute the last 7 days.

**The fix:** use watermark-based or partition-based incremental processing. See [sql-server-incremental-transforms](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-incremental-transforms).

### Missing Statistics on Filtered Indexes

Filtered indexes (e.g., `WHERE is_current = 1`) have their own statistics. If these statistics are stale or missing, the optimizer underestimates cardinality and chooses a bad plan (e.g., scan instead of seek).

**The fix:** `UPDATE STATISTICS silver.index_dim UX_silver_index_dim_current` after significant data changes. Or enable auto-stats: `ALTER DATABASE SET AUTO_UPDATE_STATISTICS ON`.

### Too Many Indexes on High-Write Staging Tables

Every index on a staging table must be maintained on every INSERT during the bulk load. A staging table with 5 non-clustered indexes is 5x more expensive to load than one with zero.

**The fix:** drop indexes on staging tables before bulk load, recreate after. Or use a heap (no clustered index) for staging tables that are always truncated and reloaded.
