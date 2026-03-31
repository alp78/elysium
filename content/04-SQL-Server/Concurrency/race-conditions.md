---
type: concept
category: sql-server
technology: [sql-server, python, airflow]
tags: [python, sql, airflow, sql-server, tsql]
aliases: [race condition, lost update, phantom insert, dirty read, concurrent write, data corruption]
keywords: [race condition, lost update, phantom insert, dirty read, concurrent write, data corruption, serialization, atomic operation, MERGE, isolation level, READ COMMITTED, SERIALIZABLE, RCSI, Airflow max_active_runs, transaction, unique constraint, check-then-insert, read-then-write, overlapping pipeline, pipeline race condition]
description: "SQL Server race conditions in data pipelines: the four common patterns (lost update, phantom insert, dirty read, overlapping truncate-reload), detection queries, and five prevention strategies including Airflow serialization, atomic SQL operations, transactions, and unique constraints. Includes a complete data pipeline audit."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Race Conditions

> [!quote]
> "A race condition is like a ticking time bomb — the system works perfectly until the day it doesn't, and by then the damage is done."
> — **Leslie Lamport**, ACM interview

A race condition occurs when two or more processes access shared data concurrently, and the final result depends on the timing of their execution. Unlike [deadlocks](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/deadlock-detection-and-prevention) (where processes get stuck), both processes complete — but the data ends up wrong.

```
Process A:  READ balance → 100     WRITE balance → 50  (100 - 50)
Process B:       READ balance → 100      WRITE balance → 50  (100 - 50)
→ Both read 100, both subtract 50, both write 50
→ Expected: 0  |  Actual: 50  |  Lost update!
```

Race conditions are more dangerous than deadlocks because:
- **Silent**: No error is raised — the application completes normally
- **Intermittent**: Only happens when timing aligns, making reproduction difficult
- **Hard to detect**: Data looks plausible but is subtly wrong
- **Cumulative**: Errors compound over time without anyone noticing

---

### Race Condition vs. Deadlock

| | Race Condition | Deadlock |
|---|---|---|
| **Outcome** | Wrong data, both processes complete | No result, processes stuck |
| **Detection** | Hard — requires data validation or auditing | Easy — SQL Server auto-detects (error 1205) |
| **Symptoms** | Duplicate rows, lost updates, stale reads | Frozen queries, timeout errors |
| **Fix** | Serialization, transactions, atomic operations | Lock ordering, RCSI, retry logic |
| **Danger level** | High — silent corruption | Medium — loud failure |

---

## Common Race Condition Patterns in Data Pipelines

### Pattern 1: Lost Update (Read-Then-Write)

Two processes read the same row, compute a new value, and write it back. The second write overwrites the first.

```sql
-- Process A                          -- Process B
SELECT val FROM t WHERE id = 1
-- val = 10                           SELECT val FROM t WHERE id = 1
                                      -- val = 10
UPDATE t SET val = 15 WHERE id = 1
                                      UPDATE t SET val = 20 WHERE id = 1
-- A's update is lost!
```

#### UPDATE SET counter += 1 — fix lost update with atomic operation

```sql
UPDATE t SET val = val + 5 WHERE id = 1
```

No gap between read and write — the lock is held for the duration of the single statement.

### Pattern 2: Phantom Insert (Check-Then-Insert)

Two processes check if a row exists, both find it doesn't, both insert — causing duplicates or primary key violations.

```sql
-- Process A                          -- Process B
IF NOT EXISTS (SELECT 1 FROM t
    WHERE symbol = 'ASML')            IF NOT EXISTS (SELECT 1 FROM t
INSERT INTO t (symbol) VALUES ('ASML')     WHERE symbol = 'ASML')
                                      INSERT INTO t (symbol) VALUES ('ASML')
-- Duplicate or PK violation!
```

#### MERGE WHEN NOT MATCHED — fix phantom insert with atomic upsert

```sql
MERGE INTO t AS target
USING (SELECT 'ASML' AS symbol) AS source
    ON target.symbol = source.symbol
WHEN NOT MATCHED THEN
    INSERT (symbol) VALUES (source.symbol);
```

> [!info] MERGE Reference
>
> For full MERGE syntax and all four load patterns (truncate-reload, read-then-insert/update, SCD Type 2, delete-and-insert), see [merge-and-upsert](https://alp78.github.io/elysium/04-SQL-Server/T-SQL/merge-and-upsert).

### Pattern 3: Dirty Read (Reading Uncommitted Data)

Process A reads data that Process B has written but not yet committed. If B rolls back, A is working with data that never existed.

```sql
-- Process B                          -- Process A
BEGIN TRAN
UPDATE t SET val = 999 WHERE id = 1
                                      SELECT val FROM t WHERE id = 1
                                      -- val = 999 (uncommitted!)
ROLLBACK
                                      -- A now has phantom value 999
```

#### SET TRANSACTION ISOLATION LEVEL — fix dirty read with proper isolation

SQL Server's default isolation level (READ COMMITTED) prevents dirty reads. Process A would wait for B to commit or rollback before seeing the data. With RCSI enabled, A would see the pre-update snapshot instead — without any blocking.

### Pattern 4: Overlapping Truncate-Reload

Two processes both truncate and reload the same table. Depending on timing, one process's data gets deleted by the other's truncate.

```
Process A: DELETE FROM t WHERE _index='X'  →  INSERT 50 rows
Process B:     DELETE FROM t WHERE _index='X'  →  INSERT 50 rows
→ Process A's 50 rows are deleted by Process B's DELETE
→ Only Process B's data survives
```

**Fix — serialization (ensure only one process writes at a time).** See Strategy 1 below.

---

## How to Detect Race Conditions

Unlike deadlocks, SQL Server does not automatically detect race conditions. You must look for their symptoms.

#### GROUP BY HAVING COUNT > 1 — detect duplicate rows from phantom inserts

```sql
-- Find duplicate keys that shouldn't exist
SELECT _index, symbol, score_date, COUNT(*) AS cnt
FROM gold.scores_daily
GROUP BY _index, symbol, score_date
HAVING COUNT(*) > 1;
```

#### LAG() date gap detection — find missing rows from overlapping loads

```sql
-- Compare expected stock count vs actual
SELECT _index, COUNT(*) AS stock_count
FROM silver.index_dim
WHERE is_current = 1
GROUP BY _index;
-- Should match known index sizes (50 per index)
```

#### SELECT MAX(updated_at) — detect stale data from missed updates

```sql
-- Find rows where the signal date is older than expected
SELECT _index, MAX(signal_date) AS latest, GETDATE() AS now,
       DATEDIFF(HOUR, MAX(signal_date), GETDATE()) AS hours_stale
FROM silver.signals_daily
GROUP BY _index;
```

#### SELECT WHERE load_timestamp != expected — audit for missed load windows

```sql
SELECT _index, MIN(loaded_at) AS earliest, MAX(loaded_at) AS latest,
       DATEDIFF(SECOND, MIN(loaded_at), MAX(loaded_at)) AS spread_sec
FROM bronze.signals_daily
GROUP BY _index;
-- If spread is large, multiple processes may have written at different times
```

> [!tip] Add loaded_at to All Tables
>
> Add loaded_at Columns to All Pipeline Tables.
> Add `loaded_at DATETIME2 DEFAULT SYSUTCDATETIME()` to every bronze/silver/gold table. This column enables post-run validation and makes race condition detection trivial.

---

## Prevention Strategies

### Strategy 1: Serialization (Most Effective for Pipelines)

Ensure only one process writes to a given table at a time. This eliminates all race conditions by removing concurrency entirely.

#### Airflow max_active_runs=1 — prevent overlapping DAG runs

```python
with DAG(
    "pipeline_daily",
    max_active_runs=1,  # Prevents overlapping DAG runs
    catchup=False,
    ...
) as dag:
```

If a scheduled run is already active when the next trigger fires, Airflow queues the new run instead of starting it in parallel.

#### Airflow >> operator — enforce task execution order within a DAG run

```python
[ohlcv, signals_daily, signals_quarterly] >> gold_scores >> gold_performance
```

Gold transforms wait for all silver transforms to complete. No concurrent access to the same data. (`ohlcv`, `signals_daily`, and `signals_quarterly` run in parallel because they write to different tables.)

### Strategy 2: Atomic Operations (Combine Read + Write)

Replace multi-step read-then-write sequences with single SQL statements that hold locks for the entire operation.

#### UPDATE SET col = expression — atomic update with no read-modify-write gap

```sql
UPDATE accounts SET balance = balance - 50 WHERE id = 1
```

#### MERGE for upserts — atomic check + insert/update in one statement

```sql
MERGE INTO silver.signals_daily AS target
USING staging AS source
    ON target._index = source._index
    AND target.symbol = source.symbol
    AND target.signal_date = source.signal_date
WHEN MATCHED THEN UPDATE SET ...
WHEN NOT MATCHED THEN INSERT ...;
```

### Strategy 3: Transactions with Proper Isolation

Wrap read-then-write sequences in explicit transactions. The isolation level determines what concurrent readers/writers can see.

| Isolation Level | Dirty Reads | Non-Repeatable Reads | Phantom Inserts | Performance |
|---|---|---|---|---|
| READ UNCOMMITTED | Yes | Yes | Yes | Fastest |
| READ COMMITTED (default) | No | Yes | Yes | Good |
| READ COMMITTED + RCSI | No | Snapshot | Snapshot | Good (no reader locks) |
| REPEATABLE READ | No | No | Yes | Slower |
| SERIALIZABLE | No | No | No | Slowest |

For most pipeline workloads, **READ COMMITTED** (the default) is sufficient when combined with serialization and atomic operations.

### Strategy 4: Truncate-Reload in a Single Transaction

The DELETE + INSERT pattern used in bronze loaders must happen within a single transaction to be atomic:

```python
conn = get_connection()
cursor = conn.cursor()
try:
    cursor.execute("DELETE FROM bronze.signals_daily WHERE _index = ?", index_name)
    cursor.executemany("INSERT INTO bronze.signals_daily (...) VALUES (...)", rows)
    conn.commit()  # Both operations commit together — atomic swap
except Exception:
    conn.rollback()  # On failure, neither DELETE nor INSERT takes effect
    raise
```

If the process crashes between DELETE and INSERT without a transaction, the table is left empty. The explicit transaction ensures all-or-nothing behavior.

### Strategy 5: Unique Constraints as Safety Nets

Even with serialization, add unique constraints as a last line of defense. If a race condition does occur, the database rejects the duplicate instead of silently accepting it.

```sql
-- Prevent duplicate scores for the same stock on the same date
ALTER TABLE gold.scores_daily
    ADD CONSTRAINT UQ_scores_daily UNIQUE (_index, symbol, score_date);
```

> [!warning] Prefer Loud Failure
>
> Prefer Loud Failure Over Silent Corruption.
> A primary key violation is far better than silent data corruption — the application fails loudly and the problem is immediately visible. Add unique constraints to every table that should have unique rows.

---

## Pipeline Race Condition Audit

An audit of the example codebase showing which defenses are in place at each layer.

### Airflow DAGs — Serialization Layer

All three DAGs use `max_active_runs=1` to prevent overlapping runs:

| DAG | Schedule | `max_active_runs` | Risk if missing |
|-----|----------|-------------------|-----------------|
| `pipeline_daily` | 3x daily (09:00, 17:00, 22:00 UTC) | 1 | Manual trigger during scheduled run → double writes to bronze/silver/gold |
| `pipeline_pulse` | Every 5 minutes | 1 | Slow run overlaps next trigger → double DELETE on `bronze.pulse` |
| `pipeline_tickers` | Hourly | 1 | Same as above for `bronze.pulse_tickers` |

### Bronze Loaders — Atomic Truncate-Reload

All bronze loaders follow the same pattern: DELETE per index + bulk INSERT + single COMMIT.

| Loader | Table | Pattern | Transaction? |
|--------|-------|---------|-------------|
| `load_index_dim.py` | `bronze.index_dim` | DELETE + INSERT | Yes — single `conn.commit()` |
| `load_signals_daily.py` | `bronze.signals_daily` | DELETE + INSERT | Yes |
| `load_signals_quarterly.py` | `bronze.signals_quarterly` | DELETE + INSERT | Yes |
| `load_pulse.py` | `bronze.pulse` | DELETE + INSERT | Yes |
| `load_pulse_tickers.py` | `bronze.pulse_tickers` | DELETE + INSERT | Yes |
| `load_ohlcv.py` | `bronze.*_ohlcv` | Read existing keys → INSERT missing + UPDATE stale | Yes |

Every loader has `conn.rollback()` in the `except` block — if any step fails, the entire batch is rolled back. No partial writes.

> [!info] OHLCV Loader Theoretical Risk
>
> `load_ohlcv.py` fetches existing `(symbol, date)` keys into a Python set, then only inserts missing rows. There is a theoretical race window — if another process inserts the same key between the SELECT and INSERT, a primary key violation would occur. In practice, this is prevented by `max_active_runs=1` on the DAG, and a PK violation would fail loudly rather than corrupt data.

### Silver Transforms — SCD Type 2 in Single Transaction

`transform_index_dim.py` performs SCD Type 2 (Slowly Changing Dimensions): it reads both bronze and silver into memory, diffs them in Python, then writes all changes (close old rows, insert new rows) in a single transaction.

```python
# Simplified flow
bronze_map = fetch_all_bronze_rows()
silver_map = fetch_all_silver_current_rows()
for key in bronze_map:
    if key not in silver_map:        # New symbol
        insert_row(cursor, ...)
    elif has_changed(bronze, silver): # Changed attributes
        close_row(cursor, ...)       # SET is_current = 0
        insert_row(cursor, ...)      # New version with is_current = 1
for key in silver_map:
    if key not in bronze_map:        # Removed from index
        close_row(cursor, ...)
conn.commit()                        # All changes atomic
```

The entire diff + write sequence runs in one transaction. Protection: `max_active_runs=1` ensures this never runs concurrently.

### Gold Transforms — DELETE-by-Date + INSERT

`transform_scores_daily.py` deletes existing rows for the target date, then inserts recomputed scores — within a single transaction:

```python
cursor.execute("DELETE FROM gold.scores_daily WHERE score_date = ?", score_date)
cursor.executemany("INSERT INTO gold.scores_daily (...) VALUES (...)", rows)
conn.commit()
```

`transform_index_performance.py` uses incremental insert — it finds the latest existing date and only inserts newer rows. The DELETE scope is narrow to avoid overlap:

```sql
DELETE FROM gold.index_performance WHERE _index = ? AND perf_date > ?
```

### Dashboard — Read-Only (No Race Risk)

All four dashboard repositories (`ScoresRepository`, `StockRepository`, `PulseRepository`, `IndexPerformanceRepository`) only execute SELECT queries. The dashboard never writes to the database, so it cannot participate in a race condition.

The dashboard uses the `WithDeadlockRetryAsync` wrapper to handle the rare case where a SELECT is caught in a [deadlock](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/deadlock-detection-and-prevention) with a pipeline write.

---

### Remaining Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Manual Airflow trigger during scheduled run | Low | Double writes to bronze | `max_active_runs=1` prevents this |
| Two separate DAGs writing same table | None | N/A | Each DAG writes to different tables |
| Pipeline crash between DELETE and INSERT | Low | Empty table until next run | Transaction rollback undoes the DELETE |
| Dashboard reading during pipeline write | Every run | Momentary stale data | Acceptable — data refreshes in seconds |
| OHLCV duplicate insert from overlapping reads | Very low | PK violation (loud failure) | `max_active_runs=1` + PK constraint |

The data pipeline's primary defense is **serialization via Airflow** — `max_active_runs=1` on all DAGs, plus task dependencies within `pipeline_daily`. Combined with **atomic transactions** in every loader and transform, the codebase is well-protected against race conditions.

---

### Related

- [deadlock-detection-and-prevention](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/deadlock-detection-and-prevention) — the loudly-detected sibling of race conditions
- [blocking-and-locking](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/blocking-and-locking) — lock types, isolation levels, and blocking chains
- [merge-and-upsert](https://alp78.github.io/elysium/04-SQL-Server/T-SQL/merge-and-upsert) — atomic MERGE patterns that eliminate check-then-insert races
- [medallion-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/medallion-architecture) — pipeline structure that explains the DAG serialization context
