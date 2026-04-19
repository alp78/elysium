---
title: "18 - Race Conditions"
tags:
  - postgresql
  - query-optimization
  - concurrency
  - sql
aliases:
  - PostgreSQL race conditions
  - PostgreSQL lost update
  - PostgreSQL write skew
  - PostgreSQL serialization failure
description: "PostgreSQL guide to race conditions, including lost update, duplicate check-then-insert, non-repeatable reads, phantom behavior, write skew, optimistic version checks, advisory locks, and the controlled failures produced by SERIALIZABLE."
parent: "[[domain-postgresql-query-writing-and-optimization]]"
links:
  - "[[17-postgresql-deadlock-detection-and-prevention]]"
  - "[[19-postgresql-functions-dynamic-sql-and-error-handling]]"
status: complete
---

# Race Conditions

Race conditions are the concurrency bugs that hurt most because the workload often reports success while the data ends up wrong. PostgreSQL changes the shape of those races in important ways: dirty reads are not available at all, `REPEATABLE READ` is snapshot isolation rather than SQL Server-style lock-based repeatable read, `SERIALIZABLE` uses SSI and raises `40001`, and coarse critical sections are usually expressed with advisory locks or unique constraints rather than lock hints.

> [!abstract] Scope
>
> This note mirrors the SQL Server race-condition chapter with PostgreSQL semantics. It covers the main anomaly patterns, the isolation levels that matter in PostgreSQL, atomic and constraint-backed fixes, optimistic version checks, and coarse serialization with advisory locks.
>
> - **Isolation model** covers PostgreSQL's actual anomaly surface, including the fact that `READ UNCOMMITTED` behaves like `READ COMMITTED`.
> - **Standard anomalies** cover lost update, duplicate check-then-insert, non-repeatable read, phantom behavior, and write skew.
> - **Controlled failures** cover `SERIALIZABLE` failures and optimistic version-check misses.
> - **Serialization tools** cover unique constraints, `ON CONFLICT`, and advisory locks.

## Isolation Levels in PostgreSQL

The names look familiar, but PostgreSQL's behavior differs from SQL Server's in two important ways:

- `READ UNCOMMITTED` is accepted syntactically but behaves like `READ COMMITTED`.
- `REPEATABLE READ` is snapshot isolation and already prevents non-repeatable reads and phantoms inside one transaction.

| Isolation level | Dirty read | Non-repeatable read | Phantom | Lost update | Write skew |
|---|---|---|---|---|---|
| `READ UNCOMMITTED` | Prevented in practice | Possible | Possible | Possible | Possible |
| `READ COMMITTED` | Prevented | Possible | Possible | Possible with stale read-then-write logic | Possible |
| `REPEATABLE READ` | Prevented | Prevented | Prevented for one transaction snapshot | Same-row write conflicts become stronger, but set-level write skew is still possible | Possible |
| `SERIALIZABLE` | Prevented | Prevented | Prevented | Prevented by aborting unsafe schedules | Prevented by `40001` serialization failures |

The practical consequence is that PostgreSQL `REPEATABLE READ` is already much stronger than the lock-based SQL Server level of the same name, but it still does not protect shared business invariants from write skew.

## Lost Update

### Demonstration: stale read-then-write logic silently drops one change

The disposable table starts at quantity `100`:

```sql
DROP TABLE IF EXISTS demo_stc.note18_lost_update;

CREATE TABLE demo_stc.note18_lost_update (
    id integer PRIMARY KEY,
    qty integer NOT NULL
);

INSERT INTO demo_stc.note18_lost_update
VALUES (1, 100);
```

Session 1 reads `100`, waits, then writes back `90`:

```sql
BEGIN;
SELECT qty FROM demo_stc.note18_lost_update WHERE id = 1;
SELECT pg_sleep(2);
UPDATE demo_stc.note18_lost_update SET qty = 90 WHERE id = 1;
COMMIT;
```

Session 2 reads the same `100`, waits, then writes back `80`:

```sql
BEGIN;
SELECT qty FROM demo_stc.note18_lost_update WHERE id = 1;
SELECT pg_sleep(2);
UPDATE demo_stc.note18_lost_update SET qty = 80 WHERE id = 1;
COMMIT;
```

Final state:

```sql
SELECT id, qty
FROM demo_stc.note18_lost_update;
```

| id | qty |
|---:|---:|
| 1 | 80 |

One decrement was silently lost. The serialized expectation was `70`, but the stale write from the second session overwrote the first result.

### Fix: express the delta atomically in SQL

Reset the row to `100`, then let each session write its own delta instead of a precomputed constant:

```sql
UPDATE demo_stc.note18_lost_update
SET qty = 100
WHERE id = 1;
```

Session 1:

```sql
BEGIN;
UPDATE demo_stc.note18_lost_update
SET qty = qty - 10
WHERE id = 1;
COMMIT;
```

Session 2:

```sql
BEGIN;
UPDATE demo_stc.note18_lost_update
SET qty = qty - 20
WHERE id = 1;
COMMIT;
```

Final state:

```sql
SELECT id, qty
FROM demo_stc.note18_lost_update;
```

| id | qty |
|---:|---:|
| 1 | 70 |

Atomic DML is the first PostgreSQL race fix to reach for. It turns timing-sensitive application math into one statement the database can serialize correctly.

## Check-Then-Insert Duplicate

### Demonstration: application-side existence checks race without a unique constraint

The raceable table has no business-key protection:

```sql
DROP TABLE IF EXISTS demo_stc.note18_dup_demo;

CREATE TABLE demo_stc.note18_dup_demo (
    business_key text NOT NULL,
    payload text NOT NULL
);
```

Each session checks first, then inserts later based on the stale result:

Session 1:

```sql
BEGIN;
SELECT COUNT(*) AS existing_rows
FROM demo_stc.note18_dup_demo
WHERE business_key = 'alpha';

SELECT pg_sleep(2);

INSERT INTO demo_stc.note18_dup_demo (business_key, payload)
VALUES ('alpha', 'session1');
COMMIT;
```

Session 2:

```sql
BEGIN;
SELECT COUNT(*) AS existing_rows
FROM demo_stc.note18_dup_demo
WHERE business_key = 'alpha';

SELECT pg_sleep(2);

INSERT INTO demo_stc.note18_dup_demo (business_key, payload)
VALUES ('alpha', 'session2');
COMMIT;
```

Final state:

```sql
SELECT business_key, payload
FROM demo_stc.note18_dup_demo
ORDER BY payload;
```

| business_key | payload |
|---|---|
| alpha | session1 |
| alpha | session2 |

This is not a PostgreSQL bug. It is the inevitable result of asking the application to protect a business key that the database does not constrain.

### Fix: unique key plus `ON CONFLICT` turns the race into one safe statement

```sql
DROP TABLE IF EXISTS demo_stc.note18_upsert_demo;

CREATE TABLE demo_stc.note18_upsert_demo (
    business_key text PRIMARY KEY,
    update_count integer NOT NULL DEFAULT 0,
    last_payload text NOT NULL
);
```

Both sessions now use the same upsert:

```sql
INSERT INTO demo_stc.note18_upsert_demo (business_key, update_count, last_payload)
VALUES ('alpha', 1, 'session1')
ON CONFLICT (business_key) DO UPDATE
SET update_count = demo_stc.note18_upsert_demo.update_count + 1,
    last_payload = EXCLUDED.last_payload;
```

```sql
INSERT INTO demo_stc.note18_upsert_demo (business_key, update_count, last_payload)
VALUES ('alpha', 1, 'session2')
ON CONFLICT (business_key) DO UPDATE
SET update_count = demo_stc.note18_upsert_demo.update_count + 1,
    last_payload = EXCLUDED.last_payload;
```

Final state:

```sql
SELECT business_key, update_count, last_payload
FROM demo_stc.note18_upsert_demo;
```

| business_key | update_count | last_payload |
|---|---:|---|
| alpha | 2 | session2 |

The business key stayed unique and both successful touches were preserved in `update_count`.

## Dirty Read Is Not Available in PostgreSQL

SQL Server notes need a dirty-read demo because `READ UNCOMMITTED` and `NOLOCK` genuinely allow it. PostgreSQL does not. `READ UNCOMMITTED` is accepted as an isolation-level name, but it behaves like `READ COMMITTED`.

Setup:

```sql
DROP TABLE IF EXISTS demo_stc.note18_dirty_demo;

CREATE TABLE demo_stc.note18_dirty_demo (
    id integer PRIMARY KEY,
    qty integer NOT NULL
);

INSERT INTO demo_stc.note18_dirty_demo
VALUES (1, 100);
```

Writer session:

```sql
BEGIN;
UPDATE demo_stc.note18_dirty_demo
SET qty = 999
WHERE id = 1;
SELECT pg_sleep(5);
ROLLBACK;
```

Reader session:

```sql
BEGIN;
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
SHOW transaction_isolation;
SELECT qty
FROM demo_stc.note18_dirty_demo
WHERE id = 1;
ROLLBACK;
```

```text
BEGIN
SET
 transaction_isolation
-----------------------
 read uncommitted
```

| qty |
|---:|
| 100 |

After the writer rolls back, the committed row is still `100`:

```sql
SELECT id, qty
FROM demo_stc.note18_dirty_demo;
```

| id | qty |
|---:|---:|
| 1 | 100 |

The label says `read uncommitted`; the behavior does not permit dirty data.

## Non-Repeatable Read Under `READ COMMITTED`

PostgreSQL `READ COMMITTED` still allows a transaction to see different committed values on repeated reads.

Setup:

```sql
DROP TABLE IF EXISTS demo_stc.note18_nonrepeatable_demo;

CREATE TABLE demo_stc.note18_nonrepeatable_demo (
    id integer PRIMARY KEY,
    qty integer NOT NULL
);

INSERT INTO demo_stc.note18_nonrepeatable_demo
VALUES (1, 100);
```

Reader session:

```sql
BEGIN;
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
SELECT qty AS first_read
FROM demo_stc.note18_nonrepeatable_demo
WHERE id = 1;

SELECT pg_sleep(3);

SELECT qty AS second_read
FROM demo_stc.note18_nonrepeatable_demo
WHERE id = 1;
COMMIT;
```

Writer session between the two reads:

```sql
UPDATE demo_stc.note18_nonrepeatable_demo
SET qty = 150
WHERE id = 1;
```

Reader output:

```text
 first_read
------------
        100

 second_read
-------------
         150
```

Inside one transaction, the same row changed from `100` to `150`. That is a textbook non-repeatable read.

## Phantom Behavior in PostgreSQL `REPEATABLE READ`

This is where PostgreSQL diverges sharply from SQL Server. PostgreSQL `REPEATABLE READ` uses a stable transaction snapshot, so phantoms do not appear inside that transaction.

Setup:

```sql
DROP TABLE IF EXISTS demo_stc.note18_phantom_demo;

CREATE TABLE demo_stc.note18_phantom_demo (
    id integer PRIMARY KEY,
    category text NOT NULL
);

INSERT INTO demo_stc.note18_phantom_demo
VALUES
    (1, 'alpha'),
    (2, 'alpha');
```

Reader session:

```sql
BEGIN;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT COUNT(*) AS first_count
FROM demo_stc.note18_phantom_demo
WHERE category = 'alpha';

SELECT pg_sleep(3);

SELECT COUNT(*) AS second_count
FROM demo_stc.note18_phantom_demo
WHERE category = 'alpha';
COMMIT;
```

Concurrent writer:

```sql
INSERT INTO demo_stc.note18_phantom_demo
VALUES (3, 'alpha');
```

Reader output:

```text
 first_count
-------------
           2

 second_count
--------------
            2
```

After both transactions finish, the committed table does contain three rows:

```sql
SELECT COUNT(*) AS committed_count
FROM demo_stc.note18_phantom_demo
WHERE category = 'alpha';
```

| committed_count |
|---:|
| 3 |

The phantom existed in committed history, but not inside the reader's snapshot. That is normal PostgreSQL `REPEATABLE READ` behavior.

## Write Skew Under `REPEATABLE READ`

Snapshot isolation prevents many anomalies while still allowing write skew. The classic invariant is "at least one doctor must remain on call."

Setup:

```sql
DROP TABLE IF EXISTS demo_stc.note18_oncall_demo;

CREATE TABLE demo_stc.note18_oncall_demo (
    doctor text PRIMARY KEY,
    on_call boolean NOT NULL
);

INSERT INTO demo_stc.note18_oncall_demo
VALUES
    ('alice', true),
    ('bob', true);
```

### Demonstration: both doctors go off call under `REPEATABLE READ`

Each session sees two on-call doctors, waits, then turns off a different row:

```sql
BEGIN;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT COUNT(*) AS on_call_before
FROM demo_stc.note18_oncall_demo
WHERE on_call;

SELECT pg_sleep(2);

UPDATE demo_stc.note18_oncall_demo
SET on_call = false
WHERE doctor = 'alice';
COMMIT;
```

```sql
BEGIN;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT COUNT(*) AS on_call_before
FROM demo_stc.note18_oncall_demo
WHERE on_call;

SELECT pg_sleep(2);

UPDATE demo_stc.note18_oncall_demo
SET on_call = false
WHERE doctor = 'bob';
COMMIT;
```

Final state:

```sql
SELECT doctor, on_call
FROM demo_stc.note18_oncall_demo
ORDER BY doctor;
```

| doctor | on_call |
|---|---|
| alice | f |
| bob | f |

Neither transaction violated the invariant alone. Together they did.

### Fix: `SERIALIZABLE` turns unsafe schedules into `40001`

Reset both rows to `true`, then rerun the same logic under `SERIALIZABLE`. In the captured run, one transaction committed and the other failed with a serialization failure:

```sql
UPDATE demo_stc.note18_oncall_demo
SET on_call = true;
```

```text
ERROR:  40001: could not serialize access due to read/write dependencies among transactions
DETAIL:  Reason code: Canceled on identification as a pivot, during write.
HINT:  The transaction might succeed if retried.
```

Final state after the failed serializable run:

```sql
SELECT doctor, on_call
FROM demo_stc.note18_oncall_demo
ORDER BY doctor;
```

| doctor | on_call |
|---|---|
| alice | f |
| bob | t |

This is the PostgreSQL pattern for invariant protection: `SERIALIZABLE` does not quietly block forever. It allows concurrency, then aborts unsafe schedules with `40001`.

## Optimistic Concurrency with a Version Column

SQL Server reaches for `rowversion`. In PostgreSQL the common equivalent is an explicit version column checked in the `WHERE` clause.

Initial row:

```sql
CREATE TABLE demo_stc.note18_optimistic_demo (
    id integer PRIMARY KEY,
    status text NOT NULL,
    version_no integer NOT NULL
);

INSERT INTO demo_stc.note18_optimistic_demo
VALUES (1, 'OPEN', 1);
```

Both sessions capture `version_no = 1`, wait, then try to update only if the version still matches:

Session 1 output:

```text
 version_no
------------
          1

 UPDATE 1
```

Session 2 output:

```text
 version_no
------------
          1

 UPDATE 0
```

Final state:

```sql
SELECT id, status, version_no
FROM demo_stc.note18_optimistic_demo;
```

| id | status | version_no |
|---:|---|---:|
| 1 | FILLED_S1 | 2 |

The loser did not silently overwrite anything. It simply affected zero rows and can now surface a controlled concurrency miss to the application.

## Advisory Locks for Coarse Critical Sections

PostgreSQL's analogue to `sp_getapplock` is the advisory-lock family. Transaction-scoped advisory locks are often the cleanest way to serialize "one tenant reload" or "one business date close" when the protected resource is larger than a single row.

With one session already holding `pg_try_advisory_xact_lock(4242)`, a second contender sees:

```sql
SELECT pg_try_advisory_xact_lock(4242) AS got_lock;
```

| got_lock |
|---|
| f |

That is the PostgreSQL signal that the named critical section is already in use. If the work is queue-shaped rather than global, the row-level companion pattern is `FOR UPDATE SKIP LOCKED`.

## Retryable and Non-Retryable Outcomes

The main PostgreSQL concurrency outcomes to classify are:

| Outcome | SQLSTATE / signal | Typical meaning | Retry posture |
|---|---|---|---|
| Serialization failure | `40001` | `SERIALIZABLE` or SSI rejected an unsafe schedule. | Retry only if the unit of work is replay-safe. |
| Deadlock detected | `40P01` | Circular wait was detected and one participant was aborted. | Usually retryable for small idempotent transactions. |
| Lock not available | `55P03` | `NOWAIT` or a related lock-acquisition path failed immediately. | Retry only if the calling workflow is designed for it. |
| Unique violation | `23505` | Business key conflict hit the database constraint. | Usually handle explicitly rather than blind retry. |
| `UPDATE 0` optimistic miss | row-count signal | Version check or compare-and-swap failed. | Refresh state and re-evaluate intent before retrying. |

## Practical Guidance

- Use atomic DML first; it removes more races than any isolation-level change.
- Back every business key with a real unique constraint, then use `ON CONFLICT`.
- Remember that PostgreSQL does not give you dirty reads even if you ask for `READ UNCOMMITTED`.
- Treat PostgreSQL `REPEATABLE READ` as snapshot isolation, not as SQL Server's lock-based repeatable read.
- Use `SERIALIZABLE` when a multi-row invariant matters more than raw concurrency and you can tolerate `40001` retries.
- Prefer explicit version columns when the write cannot be collapsed into one atomic statement.
- Use advisory locks only when the true contention boundary is logical rather than row-shaped.

The disposable demo tables used for this note were removed after validation.
