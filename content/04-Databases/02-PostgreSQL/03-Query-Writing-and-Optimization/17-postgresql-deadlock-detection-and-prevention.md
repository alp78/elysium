---
title: "17 - Deadlock Detection and Prevention"
tags:
  - postgresql
  - query-optimization
  - performance
  - sql
aliases:
  - PostgreSQL deadlocks
  - PostgreSQL deadlock detection
  - PostgreSQL 40P01
description: "PostgreSQL reference for deadlock detection, server-log capture, deterministic deadlock reproduction, survivor-versus-victim outcomes, and the design practices that prevent lock-order cycles."
parent: "[[domain-postgresql-query-writing-and-optimization]]"
links:
  - "[[16-postgresql-blocking-and-locking]]"
  - "[[18-postgresql-race-conditions]]"
status: complete
---

# Deadlock Detection and Prevention

A deadlock is not slow blocking. It is a circular wait that PostgreSQL resolves by aborting one participant so the other can continue. In core PostgreSQL the authoritative artifact is the server log entry, not a deadlock graph store. Operationally that means the workflow is: reproduce or capture the cycle, read the log evidence, identify the lock-order inversion, and then fix the design rather than pretending a retry loop solved the cause.

> [!abstract] Scope
>
> This note mirrors the SQL Server deadlock chapter with PostgreSQL's detection and capture model. It covers the difference between blocking and circular wait, the runtime settings that shape detection, deterministic reproduction, survivor-versus-victim outcome analysis, and the main prevention strategies.
>
> - **Fundamentals** cover deadlock versus ordinary blocking and the PostgreSQL detection boundary.
> - **Capture** covers the runtime settings and the fact that core PostgreSQL records deadlocks in logs.
> - **Reproduction** covers a two-table deadlock and the visible victim-versus-survivor outcome.
> - **Prevention** covers access order, access-path discipline, short transactions, and retry posture.

## Deadlock Fundamentals

Ordinary blocking is linear: session B waits for session A, and session B can continue if session A finishes. A deadlock is circular: each participant holds something the other needs, so nobody can move forward without intervention.

PostgreSQL detects that cycle after `deadlock_timeout` elapses, chooses a victim, aborts it, and lets the other participant continue. The application-visible error class is the PostgreSQL deadlock condition rather than a SQL Server `1205` number.

## Detection Surface in PostgreSQL

Core PostgreSQL does not maintain a Query Store-like deadlock archive or a graph repository. The immediate detection and capture surface is the live server log.

```sql
SELECT
    current_setting('deadlock_timeout') AS deadlock_timeout,
    current_setting('log_lock_waits') AS log_lock_waits,
    current_setting('logging_collector') AS logging_collector,
    current_setting('log_destination') AS log_destination;
```

| deadlock_timeout | log_lock_waits | logging_collector | log_destination |
|---|---|---|---|
| 1s | off | off | stderr |

These settings explain the current lab behavior:

- PostgreSQL waits one second before running deadlock detection.
- Long lock waits are not being logged proactively because `log_lock_waits` is off.
- Logging is going to `stderr`, so in this Docker lab the deadlock evidence appears in `docker logs stoxx-postgres`.

> [!warning] Core PostgreSQL relies on logs, not a deadlock graph store
>
> If deadlock retention matters, make sure log shipping, log collection, or external monitoring keeps those entries durable. Core PostgreSQL does not persist a structured deadlock history for you.

## Deterministic Deadlock Reproduction

The classic two-object inversion still works: session 1 locks table A then reaches for table B, while session 2 locks table B then reaches for table A.

### Build the disposable demo tables

```sql
DROP TABLE IF EXISTS demo_stc.note17_deadlock_a;
DROP TABLE IF EXISTS demo_stc.note17_deadlock_b;

CREATE TABLE demo_stc.note17_deadlock_a (
    id integer PRIMARY KEY,
    note text NOT NULL
);

CREATE TABLE demo_stc.note17_deadlock_b (
    id integer PRIMARY KEY,
    note text NOT NULL
);

INSERT INTO demo_stc.note17_deadlock_a
VALUES (1, 'seed_a');

INSERT INTO demo_stc.note17_deadlock_b
VALUES (1, 'seed_b');
```

### Session 1: update A, pause, then update B

```sql
BEGIN;
UPDATE demo_stc.note17_deadlock_a
SET note = 's1'
WHERE id = 1;
SELECT pg_sleep(2);
UPDATE demo_stc.note17_deadlock_b
SET note = 's1'
WHERE id = 1;
COMMIT;
```

### Session 2: update B, pause, then update A

```sql
BEGIN;
UPDATE demo_stc.note17_deadlock_b
SET note = 's2'
WHERE id = 1;
SELECT pg_sleep(2);
UPDATE demo_stc.note17_deadlock_a
SET note = 's2'
WHERE id = 1;
COMMIT;
```

One of these sessions must lose. In the captured run, session 1 was the victim and session 2 committed.

### Survivor state proves which transaction was rolled back

```sql
SELECT 'a' AS table_name, id, note
FROM demo_stc.note17_deadlock_a
UNION ALL
SELECT 'b' AS table_name, id, note
FROM demo_stc.note17_deadlock_b
ORDER BY table_name;
```

| table_name | id | note |
|---|---:|---|
| a | 1 | s2 |
| b | 1 | s2 |

Both rows ended in state `s2`, which means the `s1` transaction was chosen as the victim and fully rolled back.

## Server-Log Capture

In core PostgreSQL, the server log is the closest equivalent to the SQL Server deadlock graph artifact. The captured lab run logged the circular wait directly:

```text
2026-04-19 01:35:07.532 UTC [6538] ERROR:  deadlock detected
2026-04-19 01:35:07.532 UTC [6538] DETAIL:  Process 6538 waits for ShareLock on transaction 1200; blocked by process 6545.
        Process 6545 waits for ShareLock on transaction 1199; blocked by process 6538.
        Process 6538: BEGIN; UPDATE demo_stc.note17_deadlock_a SET note = 's1' WHERE id = 1; SELECT pg_sleep(2); UPDATE demo_stc.note17_deadlock_b SET note = 's1' WHERE id = 1; COMMIT;
        Process 6545: BEGIN; UPDATE demo_stc.note17_deadlock_b SET note = 's2' WHERE id = 1; SELECT pg_sleep(2); UPDATE demo_stc.note17_deadlock_a SET note = 's2' WHERE id = 1; COMMIT;
2026-04-19 01:35:07.532 UTC [6538] HINT:  See server log for query details.
2026-04-19 01:35:07.532 UTC [6538] CONTEXT:  while updating tuple (0,1) in relation "note17_deadlock_b"
```

This log entry contains everything needed for root-cause work:

- the victim backend PID
- the two transactions in the cycle
- the lock type involved
- the full statements for both participants

That is enough to diagnose the cause without a separate graph visualizer.

### The database deadlock counter increments, but it is only a posture signal

```sql
SELECT deadlocks
FROM pg_stat_database
WHERE datname = 'stoxx';
```

| deadlocks |
|---:|
| 2 |

This counter tells you deadlocks have happened in the current stats window. It does not replace the log entry for forensic detail.

## Prevention Strategies

### Fix access order first

The demo deadlock existed only because the transactions touched the same objects in opposite order. The first structural fix is to force all code paths to acquire resources in the same order every time.

### Narrow the access path

Wide scans, inconsistent predicate shape, and hot-key updates widen the lock footprint and make accidental cycles easier to create. Deadlock prevention is often partly an indexing or plan-shape problem, not only a transaction-control problem.

### Keep transactions short

Interactive pauses, network calls, and long application logic between statements make it easier for a circular wait to form. PostgreSQL is not special here; long transactions are deadlock amplifiers in every engine.

### MVCC does not remove writer/writer deadlocks

MVCC helps ordinary readers avoid blocking behind writers, but it does not prevent two transactions from deadlocking while both write. If both sides need incompatible write locks, the cycle can still exist.

### PostgreSQL has no deadlock-priority knob

SQL Server can bias victim choice with `DEADLOCK_PRIORITY`. Core PostgreSQL does not offer an equivalent session-level priority setting. Prevention therefore focuses more heavily on access order, access path, and transaction scope.

## Retry Posture

Application retries belong only around replay-safe units of work. A deadlock retry can be correct for a short, idempotent transaction. It is unsafe as a blanket policy for workflows with external side effects or non-idempotent semantics.

The practical PostgreSQL rule is:

- retry only when the business operation is safe to replay
- keep the retry count low and bounded
- fix the cycle in the database design anyway

## Practical Guidance

- Treat the server log as the source of truth for deadlock diagnosis in core PostgreSQL.
- Reconstruct the cycle from the logged statements before changing indexes or isolation settings.
- Standardize object access order across procedures, jobs, and services.
- Keep write transactions short and avoid think time inside them.
- Do not assume MVCC solved deadlocks; it only removes many reader/writer edges.

The disposable demo tables `demo_stc.note17_deadlock_a` and `demo_stc.note17_deadlock_b` were dropped after validation.
