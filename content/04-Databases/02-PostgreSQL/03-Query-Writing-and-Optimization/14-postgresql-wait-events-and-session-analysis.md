---
title: "14 - Wait Events and Session Analysis"
tags:
  - postgresql
  - query-optimization
  - performance
  - sql
aliases:
  - PostgreSQL wait events
  - pg_stat_activity waits
  - pg_blocking_pids
description: "PostgreSQL reference for real-time wait events, lock-wait triage, pg_stat_activity, pg_blocking_pids, pg_locks, pg_stat_database, pg_stat_io, and the practical limits of core PostgreSQL versus SQL Server-style cumulative wait stats."
parent: "[[domain-postgresql-query-writing-and-optimization]]"
links:
  - "[[13-postgresql-execution-plans]]"
  - "[[15-postgresql-system-functions-and-session-metadata]]"
status: complete
---

# Wait Events and Session Analysis

SQL Server's cumulative wait-stats DMV has no direct core PostgreSQL twin. PostgreSQL exposes waits differently: current waits live in `pg_stat_activity`, lock chains are resolved through `pg_blocking_pids()` and `pg_locks`, and cumulative storage activity lives in statistics views such as `pg_stat_database` and `pg_stat_io`. The operational goal is the same, but the workflow is more real-time and more session-oriented.

> [!abstract] Scope
>
> This note mirrors the SQL Server wait-stats chapter with PostgreSQL's actual observability surface. It covers baseline database counters, real-time wait-event inventory, blocking-chain diagnosis, cumulative I/O context, and the extension gap between core PostgreSQL and SQL Server's persisted per-query diagnostics.
>
> - **Health baseline** covers `pg_stat_database` as the confidence boundary for cumulative counters.
> - **Current waits** covers `pg_stat_activity`, because PostgreSQL waits are primarily a live-session surface.
> - **Blocking analysis** covers `pg_blocking_pids()`, `pg_locks`, and a real lock-wait capture from the lab.
> - **Correlated diagnostics** covers temp activity, backend I/O context, and the absence of `pg_stat_statements` in the current lab.

## Health Baseline — First Check

Start with one row from `pg_stat_database` before interpreting any cumulative counters. Unlike `pg_stat_activity`, these values accumulate over time and need context.

```sql
SELECT
    datname,
    numbackends,
    xact_commit,
    xact_rollback,
    blks_read,
    blks_hit,
    temp_files,
    pg_size_pretty(temp_bytes) AS temp_bytes,
    deadlocks,
    stats_reset
FROM pg_stat_database
WHERE datname = 'stoxx';
```

| datname | numbackends | xact_commit | xact_rollback | blks_read | blks_hit | temp_files | temp_bytes | deadlocks | stats_reset |
|---|---:|---:|---:|---:|---:|---:|---|---:|---|
| stoxx | 1 | 3272 | 76 | 11858 | 1056133 | 3 | 15 MB | 1 |  |

This row already tells a useful story:

- `numbackends = 1` means the snapshot was taken in a quiet moment.
- `temp_files = 3` and `temp_bytes = 15 MB` confirm that at least some spill or temp work has happened since stats began accumulating.
- `deadlocks = 1` proves the database has already seen at least one deadlock event in the current stats window.

> [!warning] PostgreSQL wait context is split across views
>
> There is no single core view that plays the exact role of `sys.dm_os_wait_stats`. PostgreSQL separates live waits, lock state, cumulative database counters, and I/O accounting into different views. Treat the first pass as a correlation exercise, not a one-query answer.

## Current Wait Inventory

`pg_stat_activity` is the primary wait surface because it shows what sessions are waiting on right now. If there is no current incident, it may legitimately return nothing interesting.

```sql
SELECT
    wait_event_type,
    wait_event,
    state,
    COUNT(*) AS sessions
FROM pg_stat_activity
WHERE datname = 'stoxx'
GROUP BY wait_event_type, wait_event, state
ORDER BY sessions DESC, wait_event_type NULLS LAST, wait_event NULLS LAST;
```

| wait_event_type | wait_event | state | sessions |
|---|---|---|---:|
|  |  | active | 1 |

At capture time, the only visible session was the observer itself and it was not waiting on anything. That is a normal result. PostgreSQL wait analysis becomes useful when a session is actually blocked or stalled.

## Blocking and Lock-Wait Diagnosis

The cleanest way to show PostgreSQL wait events is with a deliberate lock chain. The setup below creates a disposable table and seeds two rows.

```sql
DROP TABLE IF EXISTS demo_stc.note14_lock_demo;

CREATE TABLE demo_stc.note14_lock_demo (
    id integer PRIMARY KEY,
    note text NOT NULL
);

INSERT INTO demo_stc.note14_lock_demo (id, note)
VALUES (1, 'seed'), (2, 'seed');

SELECT id, note
FROM demo_stc.note14_lock_demo
ORDER BY id;
```

| id | note |
|---:|---|
| 1 | seed |
| 2 | seed |

Use two concurrent sessions:

Session A holds the row lock.

```sql
BEGIN;
UPDATE demo_stc.note14_lock_demo
SET note = 'locker'
WHERE id = 1;
SELECT pg_sleep(30);
```

Session B tries to update the same row and becomes blocked.

```sql
BEGIN;
UPDATE demo_stc.note14_lock_demo
SET note = 'waiter'
WHERE id = 1;
```

### `pg_stat_activity` plus `pg_blocking_pids()` identifies the waiter and blocker

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
  AND application_name IN ('note14-locker', 'note14-waiter')
ORDER BY application_name;
```

| pid | application_name | state | wait_event_type | wait_event | blocking_pids |
|---:|---|---|---|---|---|
| 5626 | note14-locker | active | Timeout | PgSleep | {} |
| 5641 | note14-waiter | active | Lock | transactionid | {5626} |

This is the core PostgreSQL lock-wait diagnostic:

- The blocker is visible immediately as PID `5626`.
- The waiter is stalled on `wait_event_type = 'Lock'`.
- `wait_event = 'transactionid'` shows that the waiter is waiting for the blocking transaction to finish.

### Grouped wait events show the active incident shape

```sql
SELECT
    wait_event_type,
    wait_event,
    state,
    COUNT(*) AS sessions
FROM pg_stat_activity
WHERE datname = 'stoxx'
  AND application_name IN ('note14-locker', 'note14-waiter')
GROUP BY wait_event_type, wait_event, state
ORDER BY sessions DESC, wait_event_type, wait_event;
```

| wait_event_type | wait_event | state | sessions |
|---|---|---|---:|
| Lock | transactionid | active | 1 |
| Timeout | PgSleep | active | 1 |

During a real incident, this grouped view is often the fastest way to answer "is this a lock problem, an I/O problem, or something else?"

### `pg_locks` shows granted versus waiting lock state

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
WHERE a.application_name IN ('note14-locker', 'note14-waiter')
  AND (
      l.relation = 'demo_stc.note14_lock_demo'::regclass
      OR l.locktype = 'transactionid'
  )
ORDER BY a.application_name, l.granted DESC, l.locktype, l.mode;
```

| application_name | locktype | relation_name | mode | granted |
|---|---|---|---|---|
| note14-locker | relation | demo_stc.note14_lock_demo | RowExclusiveLock | t |
| note14-locker | transactionid |  | ExclusiveLock | t |
| note14-waiter | relation | demo_stc.note14_lock_demo | RowExclusiveLock | t |
| note14-waiter | transactionid |  | ExclusiveLock | t |
| note14-waiter | tuple | demo_stc.note14_lock_demo | ExclusiveLock | t |
| note14-waiter | transactionid |  | ShareLock | f |

The important row is the final one: the waiter has an ungranted `ShareLock` on the blocker's transaction id. That is the direct lock-wait proof behind the `wait_event = 'transactionid'` observation.

## I/O and Temp Activity Context

Lock waits are only one family. When the problem is storage-facing, PostgreSQL's nearest cumulative surface is `pg_stat_io`, backed by database-level counters such as `temp_files` and `temp_bytes`.

```sql
SELECT
    backend_type,
    object,
    context,
    reads,
    read_time,
    writes,
    write_time,
    extends,
    extend_time,
    fsyncs,
    fsync_time
FROM pg_stat_io
WHERE backend_type IN ('client backend', 'checkpointer', 'background writer')
ORDER BY backend_type, object, context;
```

| backend_type | object | context | reads | read_time | writes | write_time | extends | extend_time | fsyncs | fsync_time |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| background writer | relation | normal |  |  | 0 | 0 |  |  | 0 | 0 |
| checkpointer | relation | normal |  |  | 7394 | 0 |  |  | 1051 | 0 |
| client backend | relation | bulkread | 935 | 0 | 0 | 0 |  |  |  |  |
| client backend | relation | bulkwrite | 0 | 0 | 0 | 0 | 8059 | 0 |  |  |
| client backend | relation | normal | 11005 | 0 | 0 | 0 | 1490 | 0 | 0 | 0 |
| client backend | relation | vacuum | 0 | 0 | 0 | 0 | 0 | 0 |  |  |
| client backend | temp relation | normal | 64976 | 0 | 8936 | 0 | 9398 | 0 |  |  |

This lab is revealing three useful facts:

- Client backends have done substantial `temp relation` I/O, which matches earlier spill-oriented plan work.
- The checkpointer has performed relation writes and fsyncs, so writeback activity is visible even without an incident running right now.
- Timing columns are `0` because `track_io_timing` is currently off, so this view is giving counts and topology rather than latency.

> [!info] `pg_stat_io` is PostgreSQL 16+
>
> If you are on an older PostgreSQL release, fall back to `pg_stat_database`, `track_io_timing`, `EXPLAIN (ANALYZE, BUFFERS)`, and operating-system storage metrics. The exact view surface changed materially in PostgreSQL 16.

## Heavy Queries and Regression History

SQL Server chapters can bridge waits to persisted top queries through Query Store. Core PostgreSQL does not do that by default. The usual extension for cumulative per-query statistics is `pg_stat_statements`, but it is not installed in this lab.

```sql
SELECT extname
FROM pg_extension
WHERE extname = 'pg_stat_statements';
```

```text
 extname
---------
(0 rows)
```

That absence matters operationally:

- You can still diagnose live incidents with `pg_stat_activity`, `pg_blocking_pids()`, `pg_locks`, and `EXPLAIN (ANALYZE, BUFFERS)`.
- You cannot rank historical top SQL by total time in this lab from core views alone.
- If durable query-level ranking or regression history is required, install `pg_stat_statements` and usually pair it with log capture or `auto_explain`.

This is the PostgreSQL equivalent of saying "the instance does not currently have Query Store-like history available."

## Common Wait Families — Quick Reference

| Wait surface | Typical meaning | First next step |
|---|---|---|
| `wait_event_type = 'Lock'` | Session is blocked by another transaction. | Use `pg_blocking_pids()` and inspect the blocker first. |
| `wait_event_type = 'LWLock'` | Contention on internal lightweight locks. | Check workload shape, buffer churn, WAL pressure, or catalog hotspots. |
| `wait_event_type = 'BufferPin'` | Another backend is holding a needed buffer pin. | Look for long-running cursors, scans, or VACUUM interactions. |
| `wait_event_type = 'IO'` | Backend is waiting on a storage-related operation. | Correlate with `pg_stat_io`, plan buffers, and storage telemetry. |
| `wait_event_type = 'Client'` | Backend is waiting on the client connection. | Usually not a server bottleneck by itself; inspect the application side. |
| `wait_event_type = 'Timeout'` | Backend is sleeping or waiting on a timer. | Check whether the query is intentionally sleeping, retrying, or timing out. |
| `wait_event_type = 'Activity'` | Background process is idle or waiting for work. | Often benign for background workers. |
| `deadlocks` in `pg_stat_database` | Deadlocks have occurred in the current stats window. | Inspect logs and review locking order and transaction scope. |

## Review Checklist and Cleanup

Use this order when PostgreSQL sessions are stalled:

1. Check `pg_stat_activity` for real current waits.
2. If the wait type is `Lock`, run `pg_blocking_pids()` immediately.
3. Use `pg_locks` to prove which lock is ungranted and on which relation or transaction.
4. Correlate temp-file or I/O suspicion with `pg_stat_database` and `pg_stat_io`.
5. Capture the blocked statement's plan with `EXPLAIN (ANALYZE, BUFFERS)` once the incident is reproducible safely.
6. If historical top-query ranking is needed, verify whether `pg_stat_statements` is installed before promising a query-history workflow.

The disposable blocking demo was cleaned up after capture by terminating the demo sessions and dropping `demo_stc.note14_lock_demo`.
