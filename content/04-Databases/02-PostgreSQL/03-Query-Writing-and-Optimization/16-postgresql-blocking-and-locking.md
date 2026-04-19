---
title: "16 - Blocking and Locking"
tags:
  - postgresql
  - query-optimization
  - performance
  - sql
aliases:
  - PostgreSQL locking
  - PostgreSQL blocking
  - PostgreSQL MVCC blocking
description: "PostgreSQL reference for MVCC-aware blocking triage, relation and row lock behavior, blocker-chain capture, timeout settings, and the practical differences from SQL Server such as no lock escalation and nonblocking readers under read committed."
parent: "[[domain-postgresql-query-writing-and-optimization]]"
links:
  - "[[15-postgresql-system-functions-and-session-metadata]]"
  - "[[17-postgresql-deadlock-detection-and-prevention]]"
status: complete
---

# Blocking and Locking

Blocking in PostgreSQL still means lock incompatibility, but the concurrency model is different from classic SQL Server pessimistic `READ COMMITTED`. PostgreSQL uses MVCC by default, so ordinary readers do not wait on uncommitted row updates. Writer-versus-writer conflicts, explicit locking clauses, metadata locks, and long transactions still block, and those are the incidents this note is built to diagnose.

> [!abstract] Scope
>
> This note mirrors the SQL Server blocking chapter with PostgreSQL locking semantics. It covers the fixed triage order, the difference between MVCC readers and conflicting writers, the relation and row lock modes that matter in practice, live blocker-chain capture, timeout settings, and the PostgreSQL-specific fact that lock escalation is not part of the model.
>
> - **Triage sequence** covers the order of operations during a live blocking incident.
> - **Lock semantics** covers MVCC defaults, relation lock modes, row-level write conflicts, and explicit row-lock clauses.
> - **Live capture** covers blocker snapshots, lock inventories, and recursive blocker-chain walks.
> - **Safety posture** covers `lock_timeout`, `statement_timeout`, `idle_in_transaction_session_timeout`, and deadlock posture.

## Triage Sequence

When a PostgreSQL session is "stuck," use this order:

1. Confirm whether it is actually waiting on a lock in `pg_stat_activity`.
2. Identify the blocker with `pg_blocking_pids()`.
3. Capture the blocker and victim SQL before terminating anything.
4. Inspect `pg_locks` to see the held versus requested lock state.
5. Decide whether the problem is a legitimate long transaction, an access-pattern issue, or an explicit locking design choice.

The important discipline is the same as in SQL Server: optimize or cancel the head blocker, not the victims.

## MVCC Changes Reader/Writer Behavior

PostgreSQL's default isolation level is still called `read committed`, but ordinary reads use MVCC snapshots instead of shared locks on data rows. That changes the basic blocking picture.

```sql
SELECT
    current_setting('default_transaction_isolation') AS default_transaction_isolation,
    current_setting('transaction_isolation') AS transaction_isolation,
    current_setting('lock_timeout') AS lock_timeout,
    current_setting('statement_timeout') AS statement_timeout,
    current_setting('idle_in_transaction_session_timeout') AS idle_in_transaction_session_timeout,
    current_setting('deadlock_timeout') AS deadlock_timeout;
```

| default_transaction_isolation | transaction_isolation | lock_timeout | statement_timeout | idle_in_transaction_session_timeout | deadlock_timeout |
|---|---|---|---|---|---|
| read committed | read committed | 0 | 0 | 0 | 1s |

The defaults tell you two things immediately:

- The session is using PostgreSQL's normal MVCC-backed `read committed` behavior.
- No finite timeout is protecting the session from waiting forever on locks or sitting forever in an idle transaction.

> [!info] No lock escalation in the SQL Server sense
>
> PostgreSQL does not implement SQL Server-style lock escalation from many row locks to a table lock. Broad blocking still happens, but it comes from the statements and lock modes chosen, not from a background escalator promoting row locks to a table lock.

## Reader Versus Writer, Then Writer Versus Writer

The same disposable table can show the two concurrency facts that matter most:

- an ordinary reader does not block behind an uncommitted writer
- a second writer on the same row does block

### Setup the disposable concurrency table

```sql
DROP TABLE IF EXISTS demo_stc.note16_mvcc_demo;

CREATE TABLE demo_stc.note16_mvcc_demo (
    id integer PRIMARY KEY,
    note text NOT NULL
);

INSERT INTO demo_stc.note16_mvcc_demo (id, note)
VALUES (1, 'seed'), (2, 'seed');
```

### Session A updates one row and leaves the transaction open

```sql
BEGIN;
UPDATE demo_stc.note16_mvcc_demo
SET note = 'locker'
WHERE id = 1;
SELECT pg_sleep(30);
```

### A plain reader still sees the old committed row immediately

```sql
SELECT id, note
FROM demo_stc.note16_mvcc_demo
WHERE id = 1;
```

| id | note |
|---:|---|
| 1 | seed |

This is the key MVCC result. The reader is not blocked, and it does not see the uncommitted value `locker`. It sees the last committed row version.

### A second writer on the same row blocks

```sql
BEGIN;
UPDATE demo_stc.note16_mvcc_demo
SET note = 'writer'
WHERE id = 1;
```

The second `UPDATE` cannot proceed until the first transaction ends, so this is the real blocking case.

## Live Blocking Snapshot

### `pg_stat_activity` identifies the blocker and the waiting writer

```sql
SELECT
    pid,
    application_name,
    state,
    wait_event_type,
    wait_event,
    pg_blocking_pids(pid) AS blocking_pids
FROM pg_stat_activity
WHERE datname = 'stoxx'
  AND application_name IN ('note16-locker', 'note16-writer')
ORDER BY application_name;
```

| pid | application_name | state | wait_event_type | wait_event | blocking_pids |
|---:|---|---|---|---|---|
| 6311 | note16-locker | active | Timeout | PgSleep | {} |
| 6334 | note16-writer | active | Lock | transactionid | {6311} |

The writer is blocked on the locker's transaction id, which is the normal PostgreSQL pattern for conflicting row updates.

### `pg_locks` shows the granted and waiting lock state

```sql
SELECT
    a.application_name,
    l.locktype,
    COALESCE(l.relation::regclass::text, '') AS relation_name,
    l.mode,
    l.granted
FROM pg_locks AS l
JOIN pg_stat_activity AS a
  ON a.pid = l.pid
WHERE a.application_name IN ('note16-locker', 'note16-writer')
  AND (
      l.relation = 'demo_stc.note16_mvcc_demo'::regclass
      OR l.locktype = 'transactionid'
  )
ORDER BY a.application_name, l.granted DESC, l.locktype, l.mode;
```

| application_name | locktype | relation_name | mode | granted |
|---|---|---|---|---|
| note16-locker | relation | demo_stc.note16_mvcc_demo | RowExclusiveLock | t |
| note16-locker | transactionid |  | ExclusiveLock | t |
| note16-writer | relation | demo_stc.note16_mvcc_demo | RowExclusiveLock | t |
| note16-writer | transactionid |  | ExclusiveLock | t |
| note16-writer | tuple | demo_stc.note16_mvcc_demo | ExclusiveLock | t |
| note16-writer | transactionid |  | ShareLock | f |

The waiting row is again the final one: an ungranted `ShareLock` on the blocking transaction id.

### A recursive blocker-chain walk stays simple in PostgreSQL

```sql
WITH RECURSIVE chain AS (
    SELECT
        pid,
        application_name,
        pg_blocking_pids(pid) AS blocking_pids,
        0 AS depth
    FROM pg_stat_activity
    WHERE datname = 'stoxx'
      AND application_name = 'note16-writer'

    UNION ALL

    SELECT
        a.pid,
        a.application_name,
        pg_blocking_pids(a.pid) AS blocking_pids,
        c.depth + 1 AS depth
    FROM chain AS c
    JOIN LATERAL unnest(c.blocking_pids) AS b(blocking_pid)
      ON true
    JOIN pg_stat_activity AS a
      ON a.pid = b.blocking_pid
)
SELECT pid, application_name, blocking_pids, depth
FROM chain
ORDER BY depth;
```

| pid | application_name | blocking_pids | depth |
|---:|---|---|---:|
| 6334 | note16-writer | {6311} | 0 |
| 6311 | note16-locker | {} | 1 |

This is the PostgreSQL blocker-chain equivalent of walking blocker-victim trees in SQL Server DMVs.

## Lock Modes That Matter

PostgreSQL exposes many relation lock modes, but only a few matter in day-to-day triage.

| Lock mode | Typical source | Operational meaning |
|---|---|---|
| `AccessShareLock` | Plain `SELECT` | Blocks only `AccessExclusiveLock`; ordinary reads coexist with almost everything. |
| `RowShareLock` | `SELECT ... FOR SHARE` or `FOR UPDATE` family | Signals explicit row-locking reads. |
| `RowExclusiveLock` | `INSERT`, `UPDATE`, `DELETE`, `MERGE` | The normal write-side relation lock; common in OLTP blocking incidents. |
| `ShareUpdateExclusiveLock` | `VACUUM`, `ANALYZE`, `CREATE INDEX CONCURRENTLY` | Protects maintenance work without fully shutting out readers. |
| `ShareLock` | `CREATE INDEX` | Stronger DDL-oriented protection. |
| `ExclusiveLock` | Some maintenance and explicit lock workflows | Blocks more concurrent writers and some readers. |
| `AccessExclusiveLock` | `ALTER TABLE`, `TRUNCATE`, `VACUUM FULL`, explicit `LOCK TABLE ... ACCESS EXCLUSIVE` | Blocks everything, including plain reads. |

For row-level explicit locking, the clauses to remember are:

| Clause | Typical use | Conflict profile |
|---|---|---|
| `FOR KEY SHARE` | Protect referenced keys | Weakest explicit row lock. |
| `FOR SHARE` | Stable read with row protection | Stronger than key share. |
| `FOR NO KEY UPDATE` | Update rows without changing key columns | Common write lock for updates. |
| `FOR UPDATE` | Strongest explicit row lock | Used when later modification must exclude competing lockers. |

## Session Safety Switches

Unattended ETL and admin sessions should not wait forever. PostgreSQL exposes the relevant guardrails as ordinary settings.

### Inspect the current timeout posture

```sql
SELECT
    current_setting('lock_timeout') AS lock_timeout,
    current_setting('statement_timeout') AS statement_timeout,
    current_setting('idle_in_transaction_session_timeout') AS idle_in_transaction_session_timeout;
```

| lock_timeout | statement_timeout | idle_in_transaction_session_timeout |
|---|---|---|
| 0 | 0 | 0 |

All three are effectively infinite at the session default captured here.

### Set finite safety defaults inside a transaction or batch

```sql
BEGIN;

SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
SET LOCAL idle_in_transaction_session_timeout = '60s';

SELECT
    current_setting('lock_timeout') AS lock_timeout,
    current_setting('statement_timeout') AS statement_timeout,
    current_setting('idle_in_transaction_session_timeout') AS idle_in_transaction_session_timeout;

ROLLBACK;
```

| lock_timeout | statement_timeout | idle_in_transaction_session_timeout |
|---|---|---|
| 2s | 30s | 1min |

`SET LOCAL` is the safe pattern for jobs and migration batches because the protection applies only for the current transaction scope.

## Lock-Related Posture

Core PostgreSQL does not maintain a SQL Server-style cumulative `LCK_M_%` wait ledger, so the closest persistent signal is the deadlock counter plus whatever current lock waits exist right now.

```sql
SELECT deadlocks
FROM pg_stat_database
WHERE datname = 'stoxx';
```

| deadlocks |
|---:|
| 1 |

Treat this as posture, not proof of a current incident. For live blocking, `pg_stat_activity` and `pg_locks` remain the primary surfaces.

## Practical Guidance

- Expect ordinary readers to keep running under MVCC while conflicting writers still queue.
- Treat a blocked writer as a transaction-design problem first, not a missing shared-lock hint problem.
- Look for the head blocker, then shorten that transaction or narrow its touched rowset.
- Remember that DDL can still create broad outages because `AccessExclusiveLock` blocks even plain reads.
- Use finite `lock_timeout` and `idle_in_transaction_session_timeout` values for unattended workloads.
- Do not look for lock escalation settings; PostgreSQL does not solve contention that way.

The disposable demo table `demo_stc.note16_mvcc_demo` and the helper sessions used for capture were removed after validation.
