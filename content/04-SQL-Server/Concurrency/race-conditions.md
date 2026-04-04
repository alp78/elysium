---
title: "Race Conditions"
tags: [sql-server, tsql]
aliases: [race condition, lost update, phantom insert, dirty read, concurrent write, data corruption]
description: "SQL Server race conditions in data pipelines: the four common patterns (lost update, phantom insert, dirty read, overlapping truncate-reload), detection queries, and five prevention strategies including Airflow serialization, atomic SQL operations, transactions, and unique constraints. Includes a complete data pipeline audit."
created: 2026-03-22
updated: 2026-04-04
status: complete
---

# Race Conditions

> [!quote]
> "A race condition is like a ticking time bomb — the system works perfectly until the day it doesn't, and by then the damage is done."
>
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

> [!tip] Race Condition vs Deadlock
>
> | | Race Condition | Deadlock |
> |---|---|---|
> | **Outcome** | Wrong data, both processes complete | No result, processes stuck |
> | **Detection** | Hard — requires data validation or auditing | Easy — SQL Server auto-detects (error 1205) |
> | **Symptoms** | Duplicate rows, lost updates, stale reads | Frozen queries, timeout errors |
> | **Fix** | Serialization, transactions, atomic operations | Lock ordering, RCSI, retry logic |
> | **Danger level** | High — silent corruption | Medium — loud failure |

---

## Common Race Condition Patterns in Data Pipelines

Four patterns account for the vast majority of race conditions in data pipelines. Each pattern follows the same structure: two sessions interleave operations on the same data, and because the gap between steps is unprotected by locks, the second session acts on a stale view of reality. The patterns differ in which operation creates the gap (read, check, or delete) and in which data anomaly results (overwrite, duplicate, phantom, or loss).

### Pattern 1: Lost Update (Read-Then-Write)

Two processes read the same row, compute a new value, and write it back. The second write overwrites the first.

#### Step 1 | Session A | Read current value

Session A reads `val` for `id = 1` under the default READ COMMITTED isolation level. The shared (S) lock taken for the SELECT is released immediately after the read completes — it is not held until the end of a transaction. Session A now holds `val = 10` in application memory.

```sql
SELECT val FROM t WHERE id = 1;
```

#### Step 2 | Session B | Read the same value

Before Session A writes anything back, Session B reads the same row. Because A's shared lock was already released, B acquires its own shared lock without blocking. Both sessions now hold an in-memory copy of `val = 10`.

```sql
SELECT val FROM t WHERE id = 1;
```

> [!info] Shared Lock Behavior Under READ COMMITTED
>
> Under READ COMMITTED (SQL Server's default), shared locks are released as soon as the SELECT statement finishes — not when the transaction ends. This means another session can read and modify the same row in the gap between Session A's read and write. REPEATABLE READ would hold the S lock until transaction end, preventing this interleaving.

#### Step 3 | Session A | Write computed value

Session A computes `10 + 5 = 15` in application code and writes it back. An exclusive (X) lock is acquired on the row for the UPDATE.

```sql
UPDATE t SET val = 15 WHERE id = 1;
```

#### Step 4 | Session B | Overwrite with stale computation

Session B computes `10 + 10 = 20` using its stale copy of `val = 10` — unaware that the value is now 15. Session B's UPDATE acquires an exclusive lock (waiting for A's lock to release if still held) and writes 20, overwriting A's update entirely.

```sql
UPDATE t SET val = 20 WHERE id = 1;
```

> [!danger] Lost Update
>
> The final value is 20 instead of the correct 25 (10 + 5 + 10). Session A's write is silently overwritten because both sessions computed their new value from the same stale read of 10. No error is raised — the application reports success for both operations.

> [!success] Fix — Use Atomic Update Expressions
>
> Replace the read-then-write pattern with a single UPDATE statement that computes the new value inline. The exclusive lock held for the duration of the UPDATE prevents any interleaving.

#### Atomic UPDATE — fix lost update by eliminating the read-write gap

The database engine reads and writes in a single atomic step. No other session can read or modify the value between the read and write phases.

```sql
UPDATE t SET val = val + 5 WHERE id = 1;
```

### Pattern 2: Phantom Insert (Check-Then-Insert)

Two processes check if a row exists, both find it doesn't, both insert — causing duplicates or primary key violations.

#### Step 1 | Session A | Check for existing row

Session A checks whether `'ASML'` exists in the table. Under READ COMMITTED, the shared lock on the scanned range is released immediately after the read. Session A sees zero rows and decides to insert.

```sql
SELECT 1 FROM t WHERE symbol = 'ASML';
```

#### Step 2 | Session B | Check for the same row

Session B executes the same existence check before Session A performs its insert. Because A's shared lock was already released, B reads freely and also finds no matching row. Both sessions now believe `'ASML'` does not exist.

```sql
SELECT 1 FROM t WHERE symbol = 'ASML';
```

> [!info] Key-Range Locking and SERIALIZABLE
>
> Under READ COMMITTED, SQL Server does not take key-range locks — it only locks rows it actually reads. The "gap" where `'ASML'` would be inserted is unprotected. Under SERIALIZABLE isolation, a key-range lock would cover this gap, blocking Session B's check until Session A commits or rolls back.

#### Step 3 | Session A | Insert the new row

Believing the row does not exist, Session A inserts `'ASML'`. The insert succeeds and acquires an exclusive lock on the new row.

```sql
INSERT INTO t (symbol) VALUES ('ASML');
```

#### Step 4 | Session B | Attempt duplicate insert

Session B also believes the row does not exist (based on its stale check) and attempts the same insert. Without a unique constraint, this creates a silent duplicate. With a unique constraint, it fails with error 2627.

```sql
INSERT INTO t (symbol) VALUES ('ASML');
```

> [!danger] Phantom Insert
>
> Without a unique constraint, both inserts succeed and the table contains two `'ASML'` rows — silent data corruption. With a unique constraint, the second insert fails with error 2627 (unique constraint violation), which is the correct behavior: loud failure prevents corruption. The root cause is the gap between the existence check and the INSERT — two separate statements with no lock continuity.

> [!success] Fix — Use MERGE for Atomic Upsert
>
> MERGE combines the existence check and insert into a single atomic statement. The engine holds locks across both the check and the write phase, eliminating the gap that allows phantom inserts.

#### MERGE WHEN NOT MATCHED — fix phantom insert with atomic upsert

The MERGE statement combines the existence check and the insert into a single statement. However, under the default READ COMMITTED isolation level, MERGE does not acquire range locks — meaning two concurrent MERGE statements can both evaluate the `WHEN NOT MATCHED` branch for the same key and both attempt an INSERT. If a unique constraint exists, the second insert fails with error 2627; without one, a silent duplicate is created.

To make MERGE truly safe under concurrency, add the `HOLDLOCK` table hint. HOLDLOCK is equivalent to SERIALIZABLE isolation on the target table — it holds range locks that block other sessions from inserting into the gap until the MERGE completes.

```sql
MERGE INTO t WITH (HOLDLOCK) AS target
USING (SELECT 'ASML' AS symbol) AS source
    ON target.symbol = source.symbol
WHEN NOT MATCHED THEN
    INSERT (symbol) VALUES (source.symbol);
```

> [!warning] MERGE Is Not Atomic Under Concurrent Inserts Without HOLDLOCK
>
> Under READ COMMITTED, two concurrent MERGE statements can both pass the `WHEN NOT MATCHED` check and both INSERT the same key — producing a unique constraint violation (error 2627) or a silent duplicate if no constraint exists. This is documented in the official Microsoft MERGE reference. Always add `WITH (HOLDLOCK)` to the target table when using MERGE as an upsert under concurrent load.

> [!success] Safe MERGE Pattern
>
> `MERGE INTO target WITH (HOLDLOCK)` acquires SERIALIZABLE-level range locks on the target, blocking concurrent sessions from inserting into the same key range. Combined with a unique constraint as a safety net, this eliminates phantom insert races entirely.

> [!info] MERGE Reference
>
> For full MERGE syntax and all four load patterns (truncate-reload, read-then-insert/update, SCD Type 2, delete-and-insert), see [merge-and-upsert](https://alp78.github.io/elysium/04-SQL-Server/T-SQL/merge-and-upsert).

### Pattern 3: Dirty Read (Reading Uncommitted Data)

Process A reads data that Process B has written but not yet committed. If B rolls back, A is working with data that never existed.

#### Step 1 | Session B | Begin transaction and write uncommitted data

Session B begins an explicit transaction and updates the row. The exclusive (X) lock is held until the transaction ends (COMMIT or ROLLBACK) — not just until the statement finishes.

```sql
BEGIN TRAN;
UPDATE t SET val = 999 WHERE id = 1;
```

> [!info] Lock Duration in Explicit Transactions
>
> Inside an explicit `BEGIN TRAN` block, exclusive locks acquired by UPDATE or DELETE are held until `COMMIT` or `ROLLBACK`. This is true across all isolation levels. Whether this lock blocks *readers* depends on the reading session's isolation level.

#### Step 2 | Session A | Read uncommitted value

If Session A runs under READ UNCOMMITTED (or uses the `NOLOCK` hint), it bypasses the exclusive lock and reads the uncommitted value of 999. Under READ COMMITTED (the default), Session A would block here and wait for Session B to commit or roll back.

```sql
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
SELECT val FROM t WHERE id = 1;
```

#### Step 3 | Session B | Roll back the transaction

Session B decides to abort. The ROLLBACK undoes the UPDATE, restoring the original value. The exclusive lock is released. The value 999 never existed in committed state.

```sql
ROLLBACK;
```

#### Step 4 | Session A | Operate on phantom data

Session A is now using `val = 999` — a value that was never committed to the database. Any computations, reports, or downstream writes based on this value are incorrect.

> [!danger] Dirty Read
>
> Session A read and acted on data that was subsequently rolled back — the value 999 never existed in committed state. Any decisions or writes based on this read are silently wrong. This is especially dangerous in financial pipelines where a dirty read of a price or score feeds downstream calculations.

> [!success] Fix — Use READ COMMITTED or Higher
>
> SQL Server's default isolation level (READ COMMITTED) prevents dirty reads entirely. Session A blocks until Session B commits or rolls back, then reads the final committed value. With Read Committed Snapshot Isolation (RCSI) enabled at the database level, Session A reads the pre-update snapshot instead — no blocking and no dirty read.

### Pattern 4: Overlapping Truncate-Reload

Two processes both delete and reload the same partition of a table. Depending on timing, one process's freshly inserted data gets wiped by the other's delete.

#### Step 1 | Process A | Delete existing rows for index X

Process A begins its reload cycle by deleting all rows for `_index = 'X'`. Without an explicit transaction wrapping both DELETE and INSERT, the exclusive locks on the deleted rows are released after the statement completes.

```sql
DELETE FROM t WHERE _index = 'X';
```

#### Step 2 | Process A | Insert fresh data

Process A inserts 50 new rows for index X. The reload appears complete from A's perspective.

```sql
INSERT INTO t SELECT ... WHERE _index = 'X';
```

#### Step 3 | Process B | Delete rows for the same index

Process B starts its own reload cycle for the same index, slightly behind Process A. Its DELETE removes all rows for `_index = 'X'` — including the 50 rows that Process A just inserted.

```sql
DELETE FROM t WHERE _index = 'X';
```

#### Step 4 | Process B | Insert its own data

Process B inserts its own 50 rows. Only Process B's data survives in the table.

```sql
INSERT INTO t SELECT ... WHERE _index = 'X';
```

> [!danger] Data Loss From Overlapping Reload
>
> Process A's entire insert batch is silently deleted by Process B's DELETE. No error is raised. The table contains only Process B's data, which may be identical — masking the fact that a race condition occurred. If the two processes carried different data (e.g., different API response windows), the loss is undetectable without `loaded_at` timestamp auditing.

> [!success] Fix — Serialize or Wrap in a Transaction
>
> **Serialization**: Set `max_active_runs=1` on the Airflow DAG so only one reload process runs at a time. **Transaction wrapping**: Wrap both DELETE and INSERT in a single explicit transaction — the exclusive lock from the DELETE is held until COMMIT, blocking Process B's DELETE until Process A's INSERT completes. See Strategy 1 and Strategy 4 below.

---

## How to Detect Race Conditions

Unlike deadlocks, SQL Server does not automatically detect race conditions. You must look for their symptoms through data validation queries. Run these after pipeline completion or as part of a scheduled health check.

### Detection queries

Each query targets a specific race condition symptom. Run them after pipeline completion or on a schedule as a health check. A positive result does not always confirm a race — it flags an anomaly that warrants investigation.

#### Duplicate rows from phantom inserts

If the natural key should be unique, any duplicate indicates a race condition or missing constraint. This query groups by the expected unique key and reports rows with more than one occurrence.

```sql
SELECT _index, symbol, score_date, COUNT(*) AS cnt
FROM gold.scores_daily
GROUP BY _index, symbol, score_date
HAVING COUNT(*) > 1;
```

#### Missing rows from overlapping loads

Compare expected row counts against actual counts. If a truncate-reload race occurred, the count will be lower than expected because one process's DELETE wiped the other's INSERT.

```sql
SELECT _index, COUNT(*) AS stock_count
FROM silver.index_dim
WHERE is_current = 1
GROUP BY _index;
```

#### Stale data from missed updates

Check the freshness of signal dates per index. If `hours_stale` is unexpectedly high, a pipeline step may have been overwritten by a concurrent process carrying older data.

```sql
SELECT _index, MAX(signal_date) AS latest, GETDATE() AS now,
       DATEDIFF(HOUR, MAX(signal_date), GETDATE()) AS hours_stale
FROM silver.signals_daily
GROUP BY _index;
```

#### Load timestamp spread — audit for overlapping load windows

A large `spread_sec` value (seconds between the earliest and latest `loaded_at` within the same index) indicates that multiple processes wrote to the same partition at different times — a strong indicator of a race condition.

```sql
SELECT _index, MIN(loaded_at) AS earliest, MAX(loaded_at) AS latest,
       DATEDIFF(SECOND, MIN(loaded_at), MAX(loaded_at)) AS spread_sec
FROM bronze.signals_daily
GROUP BY _index;
```

> [!tip] Add loaded_at to All Pipeline Tables
>
> Add `loaded_at DATETIME2 DEFAULT SYSUTCDATETIME()` to every bronze/silver/gold table. This column enables post-run validation and makes race condition detection trivial — any table without it cannot be audited for timing-based anomalies.

---

## Prevention Strategies

Race conditions are prevented by eliminating the unprotected gap between read and write. The five strategies below are ordered from coarsest (remove concurrency entirely) to finest (let the database reject violations). In practice, pipeline workloads combine multiple strategies as defense-in-depth — serialization removes most risk, atomic operations close the remaining gaps, and unique constraints catch anything that slips through.

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

Wrap read-then-write sequences in explicit transactions. The isolation level determines what concurrent readers and writers can see, and which concurrency anomalies are prevented. SQL Server provides five isolation levels, split into two families: **pessimistic** (lock-based — READ UNCOMMITTED through SERIALIZABLE) and **optimistic** (version-based — RCSI and SNAPSHOT).

| Isolation Level | Dirty Reads | Non-Repeatable Reads | Phantom Inserts | Lock Behavior | Performance |
|---|---|---|---|---|---|
| READ UNCOMMITTED | Yes | Yes | Yes | No shared locks acquired | Fastest |
| READ COMMITTED (default) | No | Yes | Yes | S-locks acquired per statement, released immediately | Good |
| REPEATABLE READ | No | No | Yes | S-locks held until transaction end | Slower |
| SERIALIZABLE | No | No | No | Range locks held until transaction end | Slowest |
| SNAPSHOT | No | No | No | No read locks — reads from version store | Good (no reader-writer blocking) |

REPEATABLE READ is the minimum isolation level that prevents lost updates in a read-then-write pattern. Under READ COMMITTED, shared locks are released as soon as the SELECT finishes, leaving a window for another session to modify the same row before the UPDATE.

#### Set isolation level for a session

Under REPEATABLE READ, the shared lock acquired by the SELECT is held until COMMIT — no other session can UPDATE the row in the gap between the read and the write. This eliminates the lost update window that exists under READ COMMITTED.

```sql
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
BEGIN TRAN;
    SELECT val FROM t WHERE id = 1;
    UPDATE t SET val = val + 5 WHERE id = 1;
COMMIT;
```

> [!info] Read Committed Snapshot Isolation (RCSI)
>
> RCSI is a **database-level option** that changes how READ COMMITTED behaves. When enabled, SELECT statements no longer acquire shared (S) locks. Instead, readers see the last committed version of each row as of statement start, retrieved from the **version store** in tempdb. Writers do not block readers, and readers do not block writers — eliminating the most common source of blocking in OLTP and mixed pipeline workloads.
>
> Internally, SQL Server adds up to **14 bytes** to the end of each modified row (a transaction sequence number + a pointer to the version store chain). These bytes are added the first time a row is modified after RCSI is enabled and removed only when all version-based features are turned off.
>
> **Enable RCSI:**
> ```sql
> ALTER DATABASE MyDatabase SET READ_COMMITTED_SNAPSHOT ON;
> ```
> No session-level changes are needed — all existing READ COMMITTED sessions automatically switch to version-based reads.
>
> **tempdb impact:** The version store lives in tempdb (unless Accelerated Database Recovery is enabled, available from SQL Server 2019, which moves the version store into the user database). Long-running transactions are the primary cause of version store bloat. If tempdb runs out of space, read operations that need a version fail with error 3966 and the transaction is rolled back.
>
> RCSI is ON by default in Azure SQL Database but OFF by default in SQL Server on-premises and Azure SQL Managed Instance.

> [!tip] RCSI vs SNAPSHOT Isolation
>
> | | RCSI | SNAPSHOT |
> |---|---|---|
> | **Database option** | `READ_COMMITTED_SNAPSHOT ON` | `ALLOW_SNAPSHOT_ISOLATION ON` |
> | **Read consistency point** | Start of each **statement** | Start of the **transaction** |
> | **Session opt-in** | Automatic for all READ COMMITTED sessions | Explicit `SET TRANSACTION ISOLATION LEVEL SNAPSHOT` required |
> | **Update conflict** | None (last writer wins) | Raises error — snapshot transaction terminated |
> | **Use case** | General OLTP, mixed read/write workloads | Long-running reads needing transactional consistency |
>
> For pipeline workloads, RCSI is almost always the better choice — it eliminates reader-writer blocking with no application changes. SNAPSHOT isolation is useful for long-running reporting queries that need a consistent view across multiple statements.

For most pipeline workloads, **READ COMMITTED** (the default) is sufficient when combined with serialization and atomic operations. If reader-writer blocking becomes a bottleneck, enable RCSI at the database level.

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

This constraint prevents duplicate scores for the same stock on the same date. If a race condition causes a second insert with the same key combination, error 2627 fires instead of silently creating a duplicate row.

```sql
ALTER TABLE gold.scores_daily
    ADD CONSTRAINT UQ_scores_daily UNIQUE (_index, symbol, score_date);
```

> [!warning] Prefer Loud Failure Over Silent Corruption
>
> A primary key or unique constraint violation is far better than silent data corruption — the application fails loudly and the problem is immediately visible. Add unique constraints to every table that should have unique rows.

> [!success] Safe Pattern — Add Unique Constraints as Guardrails
>
> Add a unique constraint on the natural key of every table that participates in concurrent writes: `ALTER TABLE gold.scores_daily ADD CONSTRAINT UQ_scores_daily UNIQUE (_index, symbol, score_date);`. The constraint catches any race that slips past serialization or transaction wrapping, turning silent corruption into a loud, immediately visible error 2627.

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

## Related

- [deadlock-detection-and-prevention](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/deadlock-detection-and-prevention) — the loudly-detected sibling of race conditions
- [blocking-and-locking](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/blocking-and-locking) — lock types, isolation levels, and blocking chains
- [merge-and-upsert](https://alp78.github.io/elysium/04-SQL-Server/T-SQL/merge-and-upsert) — atomic MERGE patterns that eliminate check-then-insert races
- [medallion-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/medallion-architecture) — pipeline structure that explains the DAG serialization context
