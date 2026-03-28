---
type: concept
category: sql-server
technology: [sql-server]
tags: [sql]
aliases: [SQL Server locking, lock manager, isolation level, lock escalation, shared lock, exclusive lock, blocking chain, intent lock]
keywords: [blocking, locking, shared lock, exclusive lock, update lock, intent lock, IX, IS, SIX, lock escalation, lock granularity, row lock, page lock, table lock, isolation level, READ COMMITTED, REPEATABLE READ, SERIALIZABLE, READ UNCOMMITTED, RCSI, Read Committed Snapshot Isolation, version store, blocking chain, head blocker, XACT_ABORT, HOLDLOCK, NOLOCK, WITH UPDLOCK, deadlock, LCK_M, sys.dm_tran_locks, lock compatibility matrix]
description: "SQL Server lock types, lock granularity hierarchy, lock compatibility matrix, isolation levels, and RCSI. Includes blocking chain detection, lock escalation prevention, and how each CRUD operation interacts with the lock manager."
related: [deadlock-detection-and-prevention, race-conditions, merge-and-upsert, storage-internals, wait-stats-analysis, performance-audit-playbook]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Blocking and Locking

SQL Server uses locks to coordinate concurrent access to data. Every read and write acquires locks automatically based on the isolation level and the type of operation. Understanding lock types, lock granularity, and isolation levels is essential for diagnosing blocking and designing concurrent-safe pipelines.

---

## Lock Types

SQL Server's lock manager tracks all acquired locks in memory and uses a compatibility matrix to decide whether a new lock request can be granted immediately or must wait.

```
                LOCK COMPATIBILITY MATRIX

  Requested →    S (Shared)    U (Update)    X (Exclusive)
  Held ↓
  S (Shared)        ✓              ✓              ✗
  U (Update)        ✓              ✗              ✗
  X (Exclusive)     ✗              ✗              ✗

  S = SELECT (read)
  U = first phase of UPDATE (find the row)
  X = second phase of UPDATE, INSERT, DELETE (modify the row)
```

#### S, X, U, IS, IX, Sch-M — lock type descriptions and compatibility

| Lock type | Mode | Who holds it | Blocks |
|---|---|---|---|
| **S (Shared)** | Read | Any SELECT | Blocks X (other writers) |
| **U (Update)** | Read + intent to modify | UPDATE during seek phase | Blocks other U and X |
| **X (Exclusive)** | Write | INSERT, UPDATE (modify phase), DELETE | Blocks all S, U, X |
| **IS (Intent Shared)** | Table/page intent | Table/page level for a row S lock below | Minimal blocking |
| **IX (Intent Exclusive)** | Table/page intent | Table/page level for a row X lock below | Blocks S on table |
| **SIX (Shared + Intent Exclusive)** | Read + will write | Aggregation-then-update operations | Heavy |

> [!info] Why Intent Locks Exist
> SQL Server uses intent locks (IS, IX) at the page and table level to signal that a finer-grained lock exists below. This allows a session wanting to lock the entire table to quickly detect whether any rows are already locked — without scanning every row.

---

## Lock Granularity

SQL Server can lock at different levels of granularity. The lock manager chooses the most appropriate level based on the operation type and number of rows affected.

```
  ROW lock (RID or KEY)     — least blocking, most overhead per lock
       ▼
  PAGE lock                 — locks all rows on an 8 KB page
       ▼
  EXTENT lock               — locks 8 contiguous pages (64 KB)
       ▼
  TABLE lock                — locks entire table, maximum blocking
       ▼
  DATABASE lock             — used for schema changes, restores
```

#### Row, page, table — lock granularity in practice

- Small INSERTs, UPDATEs, DELETEs → row locks (KEY locks in B-tree indexes)
- Large bulk operations → may escalate to page then table locks
- DDL (ALTER TABLE, CREATE INDEX) → table or database locks
- Schema changes → schema stability (Sch-S) or schema modification (Sch-M) locks

---

## Lock Escalation

When a single transaction holds more than **5,000 row/page locks** on one table, SQL Server automatically escalates to a **table lock** to save memory. This can cause unexpected blocking — any other session trying to access that table must wait.

```sql
-- See current locks on the analytics database
SELECT
    resource_type,
    resource_description,
    request_mode,          -- S, U, X, IS, IX, SIX
    request_status,        -- GRANT, WAIT, CONVERT
    request_session_id,
    OBJECT_NAME(resource_associated_entity_id) AS table_name
FROM sys.dm_tran_locks
WHERE resource_database_id = DB_ID('analytics_db')
  AND resource_type IN ('KEY', 'PAGE', 'OBJECT')
ORDER BY request_session_id;
```

#### ALTER TABLE SET LOCK_ESCALATION = DISABLE — prevent table-level escalation

```sql
-- Prevent escalation on a specific table (use with caution)
ALTER TABLE gold.index_performance SET (LOCK_ESCALATION = DISABLE);
```

> [!warning] LOCK_ESCALATION = DISABLE Has Risks
> Disabling escalation means SQL Server maintains all row-level locks indefinitely, consuming significant lock manager memory during large batch operations. Only use this when escalation-caused blocking is a confirmed problem, not preemptively.

---

## How Each CRUD Operation Acquires Locks

| Operation | Lock sequence |
|---|---|
| `SELECT` (default READ COMMITTED) | Acquire S lock on each row/page as read → release immediately after reading. Under RCSI: no locks, uses version store. |
| `SELECT ... WITH (HOLDLOCK)` | Acquire S lock → hold until end of transaction (serializable behavior). |
| `INSERT` | Acquire IX on table → IX on page → X on new row. All held until COMMIT. |
| `UPDATE` | Acquire IX on table → IU on page → U on row (during seek) → convert U to X (during modify). All held until COMMIT. |
| `DELETE` | Same as UPDATE — U lock during seek, convert to X for the ghost operation. |
| `MERGE` | Combination: U or X on matched rows, X on inserted rows. All held until COMMIT. |

**Key insight:** Unlike SELECT (which releases S locks as soon as it moves past each row under READ COMMITTED), INSERT/UPDATE/DELETE hold their X locks until COMMIT. A long-running write transaction locks rows for its entire duration.

---

## Isolation Levels

The isolation level controls what a transaction can see when other transactions are active. Higher isolation = fewer anomalies = more blocking.

| Isolation Level | Dirty Reads | Non-Repeatable Reads | Phantom Reads | Blocking |
|---|---|---|---|---|
| **READ UNCOMMITTED** | Yes (reads uncommitted) | Yes | Yes | Least |
| **READ COMMITTED** (default) | No | Yes | Yes | Low |
| **READ COMMITTED + RCSI** | No | Snapshot | Snapshot | Very low (no reader S locks) |
| **REPEATABLE READ** | No | No | Yes | Medium |
| **SERIALIZABLE** | No | No | No | High |
| **SNAPSHOT** | No | No | No | Medium (uses version store) |

#### Dirty read, non-repeatable read, phantom — isolation anomaly definitions

- **Dirty read:** Reading uncommitted data that may later be rolled back
- **Non-repeatable read:** Reading the same row twice in a transaction returns different values (another transaction committed a change in between)
- **Phantom read:** A range query returns different rows on second execution (another transaction inserted or deleted rows in the range)

---

## Read Committed Snapshot Isolation (RCSI)

RCSI is the most important concurrency improvement for mixed read/write workloads. It eliminates reader-writer blocking entirely by giving readers a snapshot of the data from the version store (in TempDB) rather than taking shared locks. The [[server-configuration]] page covers the full RCSI setup alongside other non-negotiable instance settings.

#### RCSI behavior — readers never block writers, writers never block readers
- `SELECT` statements do NOT acquire S locks → cannot block `INSERT`/`UPDATE`/`DELETE`
- `INSERT`/`UPDATE`/`DELETE` still acquire X locks → can still block each other
- Readers see the last committed version of each row, never a mid-transaction state

```sql
-- Check RCSI status
SELECT name, is_read_committed_snapshot_on
FROM sys.databases WHERE name = 'analytics_db';

-- Enable RCSI (requires no other active connections to the database)
ALTER DATABASE analytics_db SET READ_COMMITTED_SNAPSHOT ON;
```

> [!warning] RCSI Requires a Maintenance Window
> Enabling RCSI requires that no other connections are active on the database at the time the ALTER DATABASE statement runs. On a production database, run this during a maintenance window. The operation converts all existing transactions to use versioning — it can take seconds to minutes depending on active workload.

#### RCSI version store — TempDB space usage and monitoring

When RCSI is enabled, every UPDATE and DELETE generates a version record in TempDB's version store. The version store grows during long-running transactions and is cleaned up when no active snapshot read needs the old version. Monitor with:

```sql
SELECT SUM(version_store_reserved_page_count) * 8 / 1024 AS version_store_mb
FROM sys.dm_db_file_space_usage;
-- Run this in the context of tempdb
```

If the version store is large (> 1 GB), look for long-running transactions that are preventing cleanup:

```sql
SELECT * FROM sys.dm_tran_active_snapshot_database_transactions
ORDER BY elapsed_time_seconds DESC;
```

---

## Detecting Blocking Chains

#### sys.dm_exec_requests blocking_session_id — active blocking chains

```sql
SELECT r.session_id AS blocked,
       r.blocking_session_id AS blocker,
       r.wait_type,
       r.wait_time / 1000 AS wait_sec,
       SUBSTRING(st.text, 1, 200) AS blocked_query
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) st
WHERE r.blocking_session_id > 0
ORDER BY r.wait_time DESC;
```

#### sys.dm_exec_sql_text — find what the head blocker is running

```sql
SELECT s.session_id, s.login_name, s.program_name,
       s.last_request_start_time,
       SUBSTRING(st.text, 1, 200) AS blocker_query
FROM sys.dm_exec_sessions s
CROSS APPLY sys.dm_exec_sql_text(s.most_recent_sql_handle) st
WHERE s.session_id = <blocker_session_id>;
```

#### Blocking chain interpretation — transient vs significant vs cascading
- **0 rows:** No blocking right now — good
- **Rows with wait_sec < 5:** Transient blocking — normal under load
- **Rows with wait_sec > 30:** Significant blocking — a long-running transaction is holding locks
- **Chains (A blocks B, B blocks C):** One session cascading to many — find the head blocker (the session_id that appears as `blocker` but not as `blocked`). When blocking becomes circular, it escalates to a [[deadlock-detection-and-prevention|deadlock]].

#### Blocking common causes — forgotten transactions, long pipelines, index rebuilds

| Cause | Fix |
|---|---|
| Open transaction from SSMS (user forgot to COMMIT) | `COMMIT`/`ROLLBACK`, or `KILL <session_id>` |
| Long-running pipeline step holding X locks | Break into smaller transactions; enable RCSI |
| Index rebuild running (holds Sch-M lock briefly) | Schedule rebuilds during off-peak hours |
| Lock escalation on a large UPDATE | Process in smaller batches (5,000 rows at a time) |
| Missing RCSI on mixed read/write database | `ALTER DATABASE db SET READ_COMMITTED_SNAPSHOT ON` |

---

## Locking Hints (Use Sparingly)

SQL Server allows explicit lock hints in queries. Use these only when you know exactly what you're doing — they override the optimizer's lock choice.

| Hint | What it does | When to use |
|---|---|---|
| `WITH (NOLOCK)` = `READ UNCOMMITTED` | No locks on reads — can read dirty (uncommitted) data | Never in production — data quality is not guaranteed |
| `WITH (UPDLOCK)` | Take U lock instead of S lock on reads | When you know you'll update the row immediately after reading — prevents deadlocks |
| `WITH (HOLDLOCK)` = `SERIALIZABLE` | Hold S locks until end of transaction | When you need to prevent phantoms in a range scan |
| `WITH (ROWLOCK)` | Force row-level locking instead of page/table | When lock escalation is causing blocking on specific hot tables |
| `WITH (PAGLOCK)` | Force page-level locking | Rarely useful — SQL Server usually chooses correctly |
| `WITH (TABLOCK)` | Lock the entire table | Bulk INSERT with minimal logging (`INSERT ... WITH (TABLOCK)`) |

> [!warning] NOLOCK Is Not a Performance Optimization
> `WITH (NOLOCK)` (also written `READ UNCOMMITTED`) is sometimes used as a "performance hint" but it risks returning incorrect, inconsistent data — including rows that don't exist (from rolled-back transactions) or missing rows. Enable [[#Read Committed Snapshot Isolation (RCSI)|RCSI]] instead — it provides consistent reads without blocking and without dirty reads.

---

## Preventing Blocking with XACT_ABORT

Setting `XACT_ABORT ON` ensures that if any statement in a transaction fails (including a lock timeout), the entire transaction is automatically rolled back. Without this, a failed statement within a transaction leaves the transaction open and its locks held indefinitely.

```sql
SET XACT_ABORT ON;
BEGIN TRAN;
    UPDATE silver.signals_daily SET ... WHERE ...;
    UPDATE gold.scores_daily SET ... WHERE ...;
COMMIT;
-- If either UPDATE fails (deadlock, constraint, timeout), the transaction auto-rolls back
-- Without XACT_ABORT, a failed UPDATE leaves the transaction open and locks held
```

For pipeline code in Python/C#, always check that errors cause a `rollback()` call. The `XACT_ABORT ON` setting handles this at the T-SQL level for stored procedure and batch code. See [[merge-and-upsert#Transaction Management]] for complete patterns. In pipeline orchestration, [[race-conditions]] caused by concurrent tasks are a common source of unexpected blocking.

---

## Lock Monitoring Queries

#### sys.dm_tran_locks — see all current locks in a database

```sql
SELECT
    resource_type,
    resource_description,
    request_mode,
    request_status,
    request_session_id,
    OBJECT_NAME(resource_associated_entity_id) AS table_name
FROM sys.dm_tran_locks
WHERE resource_database_id = DB_ID('analytics_db')
ORDER BY request_session_id, resource_type;
```

#### dm_os_performance_counters Lock Escalations — check escalation rate

```sql
SELECT cntr_value AS lock_escalations
FROM sys.dm_os_performance_counters
WHERE counter_name = 'Lock Escalations/sec'
  AND instance_name = '_Total';
```

#### dm_os_performance_counters Number of Deadlocks/sec — check deadlock rate

```sql
SELECT cntr_value AS deadlocks_total
FROM sys.dm_os_performance_counters
WHERE counter_name = 'Number of Deadlocks/sec'
  AND instance_name = '_Total';
```

#### LCK_M_S, LCK_M_X, LCK_M_U — top lock-related wait types

```
LCK_M_S    — waiting for shared lock (reader waiting for a writer to release)
LCK_M_U    — waiting for update lock
LCK_M_X    — waiting for exclusive lock (writer waiting for readers or other writers)
LCK_M_IX   — waiting for intent exclusive lock
```

High `LCK_M_*` waits in [[wait-stats-analysis|sys.dm_os_wait_stats]] indicate systemic blocking — the most common fix is enabling RCSI.

---

## Related

- [[deadlock-detection-and-prevention]] — circular waits, Extended Events capture, retry logic
- [[race-conditions]] — silent data corruption from concurrent reads + writes
- [[merge-and-upsert]] — atomic MERGE patterns and transaction management with XACT_ABORT
- [[storage-internals]] — buffer pool and lock manager internals
- [[wait-stats-analysis]] — LCK_M_* wait types and server-wide blocking diagnosis
- [[performance-audit-playbook]] — Phase 8 (blocking) and how locking fits into a full audit
