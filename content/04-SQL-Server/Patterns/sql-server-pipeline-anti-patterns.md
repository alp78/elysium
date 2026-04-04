---
title: "SQL Server Pipeline Anti-Patterns"
tags:
  - sql-server
  - tsql
  - data-engineering
  - patterns
  - anti-patterns
  - performance
  - data-quality
aliases: [Anti-Patterns, Pipeline Mistakes, SQL Server Gotchas, Common Mistakes]
description: "A dedicated anti-pattern reference for SQL Server data pipelines — 20+ mistakes that cause incidents, data quality issues, or performance crises, with the fix for each."
created: 2026-03-29
updated: 2026-04-04
status: complete
---

# SQL Server Pipeline Anti-Patterns — Mistakes That Cost Hours

> [!quote]
> "There is no code so big, twisted, or complex that maintenance can't make it worse."
>
> — **Gerald Weinberg**, *The Psychology of Computer Programming* (1971)

Every anti-pattern here has been seen in production. Each one looked reasonable at the time. Each one caused an incident, a data quality issue, or a performance crisis.

Each anti-pattern follows the same structure: what it looks like, why people do it, what goes wrong, and the fix.

---

## Loading Anti-Patterns

Mistakes in how data enters SQL Server — wrong method, wrong transaction scope, or wrong assumptions about what the loader does silently.

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

> [!success] Use `fast_executemany = True` for all bulk inserts
>
> Set `cursor.fast_executemany = True` before `executemany()`. This batches all rows into a single network call, reducing 100K round-trips to one and cutting load time from ~45s to ~1.2s.

### Loading Directly to Production — no staging, no validation

> [!danger] No Rollback Path
>
> When a corrupt CSV lands directly in the table your dashboard reads, the only fix is to DELETE the bad data and re-run the pipeline — while the dashboard shows garbage.

**Why people do it:** staging tables feel like "extra work" for small pipelines.

**The fix:** always load to staging first, validate (row count, NULL rates, schema check), then promote. See [sql-server-loading-patterns > Staging Table + Swap](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-loading-patterns#staging-table--swap) for the swap pattern.

> [!success] Load to staging, validate, then swap atomically
>
> Load into `stg.*`, run row count and NULL checks, then rename or `INSERT INTO ... SELECT` into the production table inside a transaction. A failed validation aborts before production data is touched.

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

> [!success] Wrap every multi-step load in `BEGIN TRANSACTION … COMMIT`
>
> A transaction guarantees that either all steps succeed or none do. If the process dies mid-run, SQL Server rolls back automatically, leaving the table in its previous clean state.

### Silent Truncation with bcp — data loss without warning

> [!danger] bcp Silently Truncates Data
>
> If a CSV field exceeds the column width (e.g., 25-char string into `VARCHAR(20)`), bcp cuts the data without any error or warning. You only discover this when downstream queries return truncated values.

**Why people do it:** bcp is the fastest loader and the truncation is invisible.

**The fix:** validate data lengths before loading, or use `-e error_file` with `-m 0` (zero tolerance for errors). Always spot-check loaded data against source. See [sql-server-loading-patterns > bcp Gotchas](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-loading-patterns#bcp-gotchas).

> [!success] Use `-m 0 -e error_file` and pre-validate column lengths
>
> Run `bcp` with `-m 0` to fail on the first truncation error, and `-e err.log` to capture rejected rows. Pre-check source data with `MAX(LEN(column))` against the target column width before loading.

### IDENTITY as a Business Key — breaks on truncate and differs per environment

> [!warning] IDENTITY Values Are Not Stable
>
> IDENTITY resets on TRUNCATE, has gaps after rollbacks, and differs between dev/staging/prod. Any system that stores or references the IDENTITY value externally breaks when the table is rebuilt.

**The fix:** use natural keys (symbol + date) or deterministic surrogate keys (hash of business columns) for anything shared externally. Reserve IDENTITY for internal-only surrogate keys. See [idempotent-pipeline-design](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design).

> [!success] Use deterministic surrogate keys for anything shared externally
>
> Replace external IDENTITY references with a hash key derived from business columns (e.g., `HASHBYTES('SHA2_256', symbol + CAST(date AS VARCHAR))`). The key is stable across environments, survives TRUNCATE, and has no gaps.

---

## Schema Anti-Patterns

Mistakes in table design and organization that make debugging harder, permissions impossible, and bulk loads slower.

### Everything in dbo — no isolation, no permissions

> [!warning] Default Schema Trap
>
> `dbo` (database owner) is SQL Server's default schema — every table created without an explicit `CREATE TABLE myschema.tablename` lands in `dbo` automatically. Mixing raw, cleaned, and gold tables in a single schema makes layer-specific permissions impossible and forces naming-convention prefixes (`raw_`, `stg_`, `dim_`) as a poor substitute for real isolation.

**The fix:** use schema-per-layer (`bronze`, `silver`, `gold`). See [sql-server-schema-layering](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-schema-layering).

> [!success] Create explicit schemas for each pipeline layer
>
> `CREATE SCHEMA bronze; CREATE SCHEMA silver; CREATE SCHEMA gold;` — then always qualify table names. Schema-level `GRANT SELECT ON SCHEMA::gold` replaces dozens of table-level grants.

### VARCHAR(MAX) for Everything — memory and performance waste

> [!warning] VARCHAR(MAX) Allocation
>
> `bcp` and `SqlBulkCopy` allocate memory based on the declared column width. `VARCHAR(MAX)` = 2GB allocation per row during bulk load, even if the actual data is 20 characters. This causes out-of-memory errors on large loads.

**The fix:** size columns to realistic maximums. `VARCHAR(20)` for tickers, `NVARCHAR(200)` for company names, `VARCHAR(500)` for URLs.

> [!success] Size columns to realistic maximums, not `VARCHAR(MAX)`
>
> Audit actual data lengths with `SELECT MAX(LEN(col)) FROM source_table` before creating the DDL. Use `VARCHAR(MAX)` only for genuinely unbounded free-text fields that cannot fit in `VARCHAR(4000)` or less.

### Missing Metadata Columns — impossible to debug

> [!warning] No _ingested_at, No Debugging
>
> Without `_ingested_at` and `_source_file` in bronze tables, you cannot determine when a row arrived, trace bad data to its source, or verify pipeline freshness.

**The fix:** add `_ingested_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()` and `_source_file VARCHAR(500)` to every bronze table. Cost: ~16 bytes per row. Value: hours saved debugging.

> [!success] Add `_ingested_at` and `_source_file` to every bronze table
>
> Include `_ingested_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()` and `_source_file VARCHAR(500)` in every bronze DDL. These two columns cost ~16 bytes per row and make bad data traceable to its exact source file and load time.

### No Schema Separation Between Layers

Keeping bronze, silver, and gold tables in the same schema with naming prefixes (`raw_signals`, `clean_signals`, `rpt_signals`) provides no security isolation and makes `GRANT` statements table-by-table instead of schema-level.

**The fix:** one schema per layer. `GRANT SELECT ON SCHEMA::gold` covers all gold tables automatically. See [sql-server-schema-layering > Cross-Schema Security](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-schema-layering#cross-schema-security).

---

## Query Anti-Patterns

Mistakes in how queries are written that kill index performance, introduce dirty reads, or force row-by-row processing instead of set-based operations.

### SELECT * in ETL Pipelines — breaks on schema change

> [!warning] SELECT * Is Fragile
>
> When someone adds a column to the source table, `SELECT *` starts returning an extra column. If the INSERT has explicit columns, the column count mismatch throws an error. If it doesn't, the wrong data goes into the wrong column.

**The fix:** always list columns explicitly in ETL queries: `SELECT col1, col2, col3 FROM ...`

> [!success] Always list columns explicitly in ETL `SELECT` and `INSERT` statements
>
> `SELECT col1, col2, col3 FROM ...` is immune to schema additions. If a new column appears in the source, the ETL continues to select only the columns it knows about, and any mismatch surfaces as a clear error rather than silent data corruption.

### Implicit Type Conversions in WHERE Clauses — kills indexes

> [!warning] Implicit Conversion = Table Scan
>
> An **implicit type conversion** occurs when SQL Server encounters a comparison between two different data types (e.g., a `VARCHAR` column compared to an `INT` literal) and must automatically convert one to the other. Because the conversion is applied to every row in the column — not to the literal — the engine cannot use the index's **B-tree** (the balanced tree structure that stores index keys in sorted order, enabling binary-search-like navigation from root → intermediate → leaf pages) to navigate directly to matching values. `WHERE varchar_column = 123` converts every row's `varchar_column` to `INT`, forcing a full table scan. The **execution plan** (the step-by-step recipe the optimizer builds to execute a query — viewable in SSMS with `SET STATISTICS XML ON` or `Ctrl+M`) shows a `CONVERT_IMPLICIT` warning.

**The fix:** match types exactly. `WHERE varchar_column = '123'`. See [sargable-queries](https://alp78.github.io/elysium/04-SQL-Server/T-SQL/sargable-queries) for the full list of index-killing patterns.

> [!success] Match parameter types to column types — quote strings, cast numerics
>
> Use `WHERE varchar_column = '123'` (not `= 123`) and ensure pyodbc sends `VARCHAR` parameters, not `NVARCHAR`. Check for `CONVERT_IMPLICIT` warnings in execution plans to catch remaining mismatches.

### NOLOCK as a "Performance Fix" — dirty reads in production

> [!danger] NOLOCK Reads Uncommitted Data
>
> `WITH (NOLOCK)` / `READ UNCOMMITTED` can read rows from transactions that will roll back, partially written pages, or rows that are being moved by an index rebuild. For dashboards and reports, this means displaying data that never actually existed. In severe cases, SQL Server raises **error 605** (severity 12) — a formal dirty-read corruption event where a transaction reads a row that never existed in the database.

**Why people do it:** it "fixes" blocking without changing the application.

**The fix:** enable **RCSI (Read Committed Snapshot Isolation)** — a database-level setting that stores row versions in **TempDB's** version store. TempDB is SQL Server's shared system database used for temporary tables, sort spills, hash spills, and row versioning — it is recreated empty on every server restart. Readers see the last committed version of each row without taking shared locks, eliminating reader/writer blocking without risking dirty reads. See [blocking-and-locking](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/blocking-and-locking) for the RCSI setup.

> [!success] Enable RCSI for consistent reads without `NOLOCK`
>
> `ALTER DATABASE analytics_db SET READ_COMMITTED_SNAPSHOT ON;` — readers see a consistent snapshot of committed data with no shared locks, eliminating blocking without risking dirty reads.

### Cursor-Based ETL — row-by-row processing in T-SQL

> [!warning] Cursors Are Row-by-Row
>
> A `DECLARE CURSOR` / `FETCH NEXT` loop processes one row at a time, defeating SQL Server's **set-based** query optimizer. Set-based processing means the engine evaluates entire sets of rows in a single operation, choosing optimal strategies (hash joins, merge joins, parallelism across CPU cores) based on the data volume and available indexes. A cursor forces sequential, single-row processing — the optimizer cannot parallelize or batch the work. A 1M-row cursor transform can be 100x slower than the equivalent set-based query.

**Why it's so much slower (measured):** updating 100 rows one at a time in a `WHILE` loop requires ~200 page reads and 100 separate execution plans. The equivalent set-based `UPDATE ... WHERE id <= 100` requires ~5 reads and 1 plan. SQL Server reads data in 8 KB pages — row-by-row iteration incurs full page reads for every individual operation regardless of row size. A common cursor variant is using `SCOPE_IDENTITY()` in a loop to capture generated keys — replace with `INSERT ... OUTPUT INSERTED.id INTO @temp` to retrieve all keys in a single set operation.

**The fix:** rewrite as a single set-based INSERT/UPDATE with JOINs, window functions, or CTEs.

> [!success] Replace cursors with set-based `INSERT … SELECT` or window functions
>
> Rewrite cursor logic as a single `INSERT INTO target SELECT … FROM source JOIN …` statement. SQL Server processes the entire set in one optimized operation, using parallelism and index seeks instead of row-by-row loops.

> [!info] Why set-based matters: how the optimizer chooses join strategies
>
> When you write a set-based `JOIN`, the query optimizer picks the most efficient **physical join operator** based on data volume, available indexes, and memory:
>
> - **Nested Loop Join:** for each row in the outer (smaller) table, seeks into the inner table's index. Best when the outer set is small and the inner table has a supporting index. Cost: `O(outer × index_seek)`. Zero startup cost, no memory grant needed, and the only join type that works for non-equijoins (range conditions, `CROSS JOIN`).
> - **Merge Join:** reads both inputs sorted on the join key and walks them in parallel. Requires both sides pre-sorted (from a clustered index or an explicit sort). Best for large, pre-sorted datasets. Cost: `O(n + m)` — linear. Caveat: if both inputs have duplicate join keys (**many-to-many**), the engine materializes duplicates into a worktable in TempDB, adding I/O overhead.
> - **Hash Join:** builds a hash table in memory from the smaller input (the "build" side), then probes it with the larger input. This is a **blocking operator** during the build phase — no results flow until the entire build side is hashed. Requires a **memory grant** proportional to the build side's size; if the build side exceeds the grant, the hash table **spills to TempDB** (grace hash → recursive hash), degrading performance dramatically. Best for large unsorted datasets where no index exists on the join key.
>
> A cursor bypasses all three strategies — it forces the equivalent of a nested loop with no index seek (a full scan per row), which is the worst possible execution path. The optimizer cannot choose a better strategy because it never sees the full set.

### Non-SARGable Date Filters — index-killing date functions

A predicate is **SARGable** (Search ARGument able) when it can be evaluated using an index seek — the engine navigates the B-tree directly to the matching rows. Wrapping a column in a function (`YEAR(date)`, `CAST(date AS DATE)`, `ISNULL(col, 0)`) makes the predicate non-SARGable because the function output is not stored in the index.

> [!warning] Functions on Columns Prevent Index Seeks
>
> `WHERE YEAR(signal_date) = 2025` applies `YEAR()` to every row, converting an index seek into a full table scan. The engine cannot use the `signal_date` index because it stores date values, not the output of `YEAR()`.

**The fix:** use range predicates. `WHERE signal_date >= '2025-01-01' AND signal_date < '2026-01-01'`. See [sargable-queries](https://alp78.github.io/elysium/04-SQL-Server/T-SQL/sargable-queries) for more examples.

> [!success] Use range predicates instead of functions in `WHERE` clauses
>
> `WHERE signal_date >= '2025-01-01' AND signal_date < '2026-01-01'` is SARGable — SQL Server can navigate the B-tree index directly to the matching date range instead of scanning the whole table.

---

## Change Tracking Anti-Patterns

Mistakes in how data history is managed — overwriting instead of versioning, missing integrity constraints, and incorrect comparisons on NULLable or floating-point columns.

### Overwriting History in Place — destroyed audit trail

> [!danger] UPDATE Destroys History
>
> `UPDATE dim_stock SET sector = 'New' WHERE symbol = 'ASML'` overwrites the old sector value. You can never answer "what sector was ASML in last quarter?"

**The fix:** use SCD Type 2 (close old row, insert new row) or temporal tables. See [sql-server-change-tracking](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-change-tracking).

> [!success] Use SCD Type 2 or temporal tables to preserve full history
>
> SCD2: `UPDATE SET valid_to = GETUTCDATE(), is_current = 0` on the old row, then `INSERT` a new row with the updated value and `valid_to = '9999-12-31'`. Temporal tables (`SYSTEM_VERSIONING = ON`) handle this automatically at the engine level.

### SCD2 Without Filtered Unique Index — duplicate current rows

> [!danger] Silent Duplicate Active Rows
>
> Without `CREATE UNIQUE INDEX ... WHERE is_current = 1`, a bug in the close/insert logic creates two rows with `is_current = 1` for the same key. JOINs return duplicates; dashboard shows wrong data.

**The fix:** always create a filtered unique index on the active key columns. See [sql-server-change-tracking > SCD2 Schema](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-change-tracking#scd2-schema).

> [!success] Add a filtered unique index on the active key to enforce SCD2 integrity
>
> `CREATE UNIQUE INDEX UX_dim_stock_current ON dim_stock (symbol) WHERE is_current = 1;` — SQL Server rejects the INSERT if a duplicate active row already exists, surfacing bugs in the close/insert logic immediately rather than silently.

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

> [!success] Use `ISNULL(col, sentinel)` or `IS DISTINCT FROM` for NULLable comparisons
>
> `WHERE ISNULL(old_sector, '___NULL___') <> ISNULL(new_sector, '___NULL___')` correctly detects all four cases: value-to-value, NULL-to-value, value-to-NULL, and NULL-to-NULL (no change). On SQL Server 2022+, `IS DISTINCT FROM` is cleaner.

### Comparing Floating-Point Values for Equality — false change detection

> [!warning] Float Equality Fails
>
> `3.14` stored as `FLOAT` may become `3.1400000000000001`. A direct `<>` comparison flags this as a "change" and triggers an unnecessary SCD2 close/insert.

**The fix:** round to fixed precision (`ROUND(val, 4)`) or use epsilon comparison (`ABS(old - new) < 0.0001`).

> [!success] Use `DECIMAL`/`NUMERIC` for financial values, or compare with epsilon
>
> Store monetary and ratio values as `DECIMAL(18,6)` instead of `FLOAT` to eliminate representation errors. For existing `FLOAT` columns, detect real changes with `ABS(old_val - new_val) > 0.0001` instead of `<>`.

---

## Concurrency Anti-Patterns

Mistakes that cause blocking, deadlocks, or race conditions — usually from misunderstanding how SQL Server's lock manager and isolation levels interact with long-running pipeline operations.

### Long-Running Transactions During Business Hours

> [!warning] Lock Escalation
>
> **Lock escalation** occurs when either of two thresholds is reached: (1) a single statement acquires more than **5,000 locks on a single table reference** (checked every 1,250 newly acquired locks), or (2) lock memory exceeds **24% of the buffer pool**. SQL Server replaces row/page locks with a single **table-level lock** (never a page-level lock — escalation always goes directly to table). A transform that processes millions of rows in a single transaction triggers this, converting row locks into an exclusive table lock that blocks every other query — including dashboard reads.

**The fix:** batch large transforms into chunks (e.g., 10K rows per transaction). Or schedule heavy transforms during off-hours. See [blocking-and-locking](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/blocking-and-locking) for lock escalation thresholds.

> [!success] Batch large transforms into chunks of 10K rows or fewer
>
> Process updates in a `WHILE` loop with `TOP (10000)` per transaction and a short `COMMIT` between each batch. This keeps the row lock count below the 5,000-lock escalation threshold and releases locks frequently, allowing concurrent dashboard reads. For partitioned tables, set `ALTER TABLE SET (LOCK_ESCALATION = AUTO)` — this escalates to partition-level locks instead of table-level, allowing concurrent writes to different partitions. Monitor escalation pressure with `sys.dm_db_index_operational_stats` (`index_lock_promotion_attempt_count`, `index_lock_promotion_count`).

### MERGE Without Proper Locking Hints — race conditions

> [!danger] Concurrent MERGE = Duplicate Inserts
>
> Two concurrent MERGE statements can both evaluate `WHEN NOT MATCHED` for the same key and both INSERT — creating duplicates. MERGE does not take an exclusive lock on "not found" keys by default.

**The fix:** add `WITH (HOLDLOCK)` on the target table, or serialize MERGE operations. `HOLDLOCK` is equivalent to `SERIALIZABLE` isolation for that table reference — it holds range locks on the matched key set until the end of the transaction, preventing phantom inserts by other sessions. See [race-conditions](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/race-conditions) for the full analysis.

> [!success] Add `WITH (HOLDLOCK)` to the MERGE target table
>
> `MERGE silver.signals_daily WITH (HOLDLOCK) AS target USING …` �� `HOLDLOCK` acquires **range locks** on the matched key range. A range lock covers both existing key values and the gaps between them in the B-tree index, preventing **phantom inserts** — rows that appear in a range between two reads of the same query because another session inserted them into the gap. Without range locks, a concurrent session can insert a new key between the MERGE's "not found" check and its INSERT, creating the duplicate.

### No Retry Logic for Deadlocks — pipeline fails on transient errors

> [!warning] Deadlocks Are Normal
>
> A **deadlock** occurs when two transactions each hold a lock the other needs, forming a circular wait that can never resolve on its own. SQL Server's lock monitor detects this within 5 seconds and kills one transaction (the "deadlock victim", chosen by cost) so the other can proceed. Without retry logic, the killed pipeline run fails permanently instead of retrying on the next attempt.

**The fix:** catch error 1205 and retry with exponential backoff (3 attempts, 1s/2s/4s delay). See [deadlock-detection-and-prevention](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/deadlock-detection-and-prevention) for C# and Python retry patterns.

> [!success] Catch error 1205 and retry with exponential backoff
>
> Wrap the database call in a retry loop that catches `pyodbc.Error` with SQL state `40001` (deadlock victim) and retries up to 3 times with delays of 1s, 2s, and 4s. Most deadlocks resolve on the first retry. To diagnose recurring deadlocks, query the **system_health** Extended Events session (enabled by default on every instance) — it captures deadlock graphs automatically via the `xml_deadlock_report` event, accessible in SSMS under Management → Extended Events → Sessions → system_health. No upfront tracing configuration needed.

---

## Performance Anti-Patterns

Mistakes that turn fast queries into slow ones — usually from missing indexes, stale statistics, or unnecessary recomputation.

### Window Functions Without Supporting Indexes — TempDB spill

> [!warning] Sort Spill = 10x Slower
>
> `ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date)` without a clustered index on `(symbol, date)` forces a full sort. On a 100M-row table, the sort spills to TempDB disk.

**The fix:** ensure the clustered index matches `PARTITION BY + ORDER BY`. See [sql-server-incremental-transforms > Window Function Performance](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-incremental-transforms#window-function-performance).

> [!success] Align the clustered index key order with `PARTITION BY` + `ORDER BY`
>
> `CREATE CLUSTERED INDEX CIX_signals ON silver.signals_daily (symbol, date)` satisfies `ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date)` without a sort operator. The optimizer reads pre-ordered pages directly, eliminating the TempDB spill.

### Full-Table Aggregation That Could Be Incremental

Recomputing gold tables from all of silver on every run is wasteful once the table exceeds ~1M rows. If only the last 7 days changed, only recompute the last 7 days.

**The fix:** use watermark-based or partition-based incremental processing. See [sql-server-incremental-transforms](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-incremental-transforms).

### Missing Statistics on Filtered Indexes

**Statistics** are metadata objects that describe the distribution of values in an index or column — essentially a histogram of how data is spread. The query optimizer reads statistics to estimate how many rows a predicate will return (**cardinality estimation**), which determines the execution plan. Stale statistics mean wrong cardinality estimates, which mean wrong plans (e.g., a full scan when a seek would be faster). Filtered indexes (e.g., `WHERE is_current = 1`) have their own separate statistics that only reflect the filtered subset. If these are stale or missing, the optimizer underestimates cardinality for queries against the filtered index and chooses a suboptimal plan.

**The fix:** `UPDATE STATISTICS silver.index_dim UX_silver_index_dim_current` after significant data changes. Or enable auto-stats: `ALTER DATABASE SET AUTO_UPDATE_STATISTICS ON`.

### Parameter Sniffing in ETL Stored Procedures — wrong plan for the wrong batch size

**Parameter sniffing** is SQL Server's behavior of reading the actual parameter values passed to a stored procedure at the time of **first compilation** and building an execution plan optimized for those specific values. The plan is then cached and reused for all subsequent executions, regardless of what parameters they pass.

> [!danger] Plan Compiled for 10 Rows, Executed for 10 Million
>
> A staging load stored proc first compiled for a small batch (10 rows) produces a nested loop plan. A later full-load call with 10M rows reuses that plan — nested loops on 10M rows is catastrophically slow. Conversely, if first compiled during a full load, the hash join plan wastes memory grants on every subsequent small incremental call.

This is especially common in medallion-architecture pipelines where the same stored proc handles both small incremental loads and large backfills.

> [!success] Use `OPTION (RECOMPILE)` on variable-volume ETL statements
>
> For batch ETL stored procedures where data volume varies significantly between runs, add `OPTION (RECOMPILE)` to the critical `INSERT` or `MERGE` statement. This forces the optimizer to build a fresh plan using the current parameter values on every execution — eliminating the risk of a cached plan optimized for the wrong batch size. The per-execution compile cost is negligible for batch jobs that run minutes apart.
>
> On SQL Server 2022+ (compat level 160), **Parameter Sensitive Plan (PSP) Optimization** handles this automatically: the optimizer creates multiple plan variants (one per cardinality range) and routes each execution to the correct variant at runtime. Enable Query Store to monitor variant selection.

### Too Many Indexes on High-Write Staging Tables

Every index on a staging table must be maintained on every INSERT during the bulk load. A staging table with 5 non-clustered indexes is 5x more expensive to load than one with zero.

**The fix:** drop indexes on staging tables before bulk load, recreate after. Or use a **heap** — a table with no clustered index, where rows are stored in no particular order. Heaps are faster for bulk inserts (no B-tree maintenance) but slower for reads (no sort order to exploit). This makes them ideal for staging tables that are always truncated and reloaded.
