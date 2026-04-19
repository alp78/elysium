---
title: "08 - PostgreSQL Pipeline Anti-Patterns"
tags:
  - postgresql
  - data-engineering
  - anti-patterns
  - medallion
aliases:
  - Pipeline anti-patterns
  - PostgreSQL pipeline mistakes
description: "Fast reference of recurring PostgreSQL pipeline anti-patterns, grounded in live stoxx sanity checks and linked corrective paths."
parent: "[[domain-applied-postgresql-pipelines]]"
links:
  - "[[07-postgresql-pipeline-integration-and-devex]]"
status: complete
---

# PostgreSQL Pipeline Anti-Patterns

This note is the fast production checklist for failure modes that repeatedly show up in PostgreSQL data pipelines. It is intentionally not the deepest loading, PIT, or concurrency lab. It is the short reference for mistakes that create silent corruption, stale data, blocking, or avoidable performance collapse, with live `stoxx` sanity checks at the top and corrective paths to the deeper notes already built in this chapter.

> [!abstract]- Summary
>
> PostgreSQL anti-patterns in data pipelines usually fail silently before they fail loudly. They often look convenient on tiny datasets or when only one operator touches the system. The point of this note is to surface the recurring failure classes quickly and connect them to the right corrective path.
>
> **Live sanity checks**
> - verifies the current layer separation, bronze metadata coverage, and the presence or absence of the SCD2 protection the chapter has been recommending
>
> **Loading and modeling failures**
> - covers partial refreshes, missing transactions, weak provenance, and schema drift
>
> **Query, history, and operations failures**
> - covers unstable query shapes, history loss, missing temporal protections, and concurrency habits that turn pipeline work into incidents

> [!note]- Glossary
>
> **Pipeline anti-pattern**
> - A design or operating choice that feels expedient now but predictably creates correctness, observability, or performance problems as the system grows.
>
> ---
>
> **Schema separation**
> - The use of bronze, silver, and gold schemas instead of collapsing everything into one default namespace.
>
> ---
>
> **Operational metadata**
> - Columns such as `_index` or `_ingested_at` that give rows provenance and replay scope.
>
> ---
>
> **Silent failure mode**
> - A problem that leaves the process apparently successful while publishing stale, duplicated, or incomplete data.

## Live Sanity Checks

Before diagnosing anti-patterns in the abstract, verify which core protections the current lab already has and which ones it still lacks.

### Verify schema separation exists

| Field | Meaning |
|---|---|
| `schema_name` | Pipeline schema being counted. |
| `table_count` | Number of base tables in that schema. |

*This query counts the current pipeline tables by schema.*

```sql
SELECT table_schema AS schema_name,
       COUNT(*) AS table_count
FROM information_schema.tables
WHERE table_type = 'BASE TABLE'
  AND table_schema IN ('bronze', 'silver', 'gold', 'public')
GROUP BY table_schema
ORDER BY table_schema;
```

```text
 schema_name | table_count
-------------+-------------
 bronze      |          12
 gold        |           3
 silver      |           7
(3 rows)
```

The current environment does have explicit bronze, silver, and gold schemas, which is the right architectural direction. The anti-pattern here is not "everything is collapsed already"; it is letting new objects drift outside those layer boundaries later.

### Verify bronze metadata columns exist

| Field | Meaning |
|---|---|
| `metadata_columns` | Which of `_index` and `_ingested_at` are currently present on the bronze table. |

*This query shows which bronze tables currently expose the key provenance columns `_index` and `_ingested_at`.*

```sql
SELECT table_name,
       string_agg(column_name, ', ' ORDER BY ordinal_position) AS metadata_columns
FROM information_schema.columns
WHERE table_schema = 'bronze'
  AND column_name IN ('_index', '_ingested_at')
GROUP BY table_name
ORDER BY table_name;
```

```text
    table_name     |   metadata_columns
-------------------+----------------------
 eurostoxx50_ohlcv | _ingested_at
 index_dim         | _index, _ingested_at
 oil20_ohlcv       | _ingested_at
 pulse             | _index, _ingested_at
 pulse_tickers     | _index, _ingested_at
 signals_daily     | _index, _ingested_at
 signals_quarterly | _index, _ingested_at
 stoxxasia50_ohlcv | _ingested_at
 stoxxusa50_ohlcv  | _ingested_at
(9 rows)
```

This is mostly healthy: the core bronze tables do carry load-time provenance, and the business-sliced ones also carry `_index`. The anti-pattern to avoid is letting future bronze tables land without those same provenance boundaries.

### Verify SCD2 protection exists where history is intended

| Field | Meaning |
|---|---|
| `indexname` | Current index on `silver.index_dim`. |
| `indexdef` | Physical definition of that index. |

*This query checks whether `silver.index_dim` currently has the business-key partial unique index that proper SCD2 history requires.*

```sql
SELECT tablename,
       indexname,
       indexdef
FROM pg_indexes
WHERE schemaname = 'silver'
  AND tablename = 'index_dim'
ORDER BY indexname;
```

```text
 tablename |   indexname    |                                indexdef
-----------+----------------+-------------------------------------------------------------------------
 index_dim | index_dim_pkey | CREATE UNIQUE INDEX index_dim_pkey ON silver.index_dim USING btree (id)
(1 row)
```

This is a live anti-pattern, not a hypothetical one. The table has SCD2 columns, but the partial unique index that would prevent duplicate current rows is still missing. The corrective path is [[03-postgresql-silver-transforms]].

## Loading Anti-Patterns

### Row-by-row client inserts for large batches

Sending one insert per row from the client turns a batch load into a chatty OLTP workload. In PostgreSQL, prefer `COPY`, batched inserts, or `execute_values`-style batching when the volume is large enough to matter.

### Loading directly into the published table

Writing raw input straight into silver or gold removes the validation boundary. Stage or bronze first, validate, then publish. The corrective paths are [[01-postgresql-loading-patterns-and-idempotency]] and [[02-postgresql-bronze-layer-loading]].

### Multi-step loads with no explicit transaction

This is one of the easiest ways to create partial refresh state. If the process dies after the delete but before the insert, the target is empty or incomplete.

| Field | Meaning |
|---|---|
| `rows_after_delete_before_reinsert` | Target row count during the unsafe gap between delete and reinsert. |

*This transaction demonstrates the unsafe moment created by a delete-plus-insert sequence that is not protected as one publish unit.*

```sql
BEGIN;
CREATE TEMP TABLE note08_partial_state_demo (id integer PRIMARY KEY, batch_value text NOT NULL);
INSERT INTO note08_partial_state_demo VALUES (1, 'before');
DELETE FROM note08_partial_state_demo;
SELECT COUNT(*) AS rows_after_delete_before_reinsert FROM note08_partial_state_demo;
ROLLBACK;
```

```text
BEGIN
CREATE TABLE
INSERT 0 1
DELETE 1
 rows_after_delete_before_reinsert
-----------------------------------
                                 0
(1 row)

ROLLBACK
```

The anti-pattern is not the delete itself. The anti-pattern is letting the target become visible in this partial state. The corrective path is to publish inside one explicit transaction and keep the replacement slice bounded.

### Using surrogate identities as cross-system business keys

PostgreSQL identity columns are local table mechanics, not cross-system business truth. If bronze, silver, and gold are joined by local surrogate IDs instead of stable business keys, replay and reconciliation become fragile.

## Schema And Modeling Anti-Patterns

### Everything in one schema

Putting raw, transformed, and consumer tables together weakens privileges, lineage, and debugging boundaries. The current lab avoided that. Keep it that way.

### Missing metadata columns in bronze

Rows without provenance are hard to purge, replay, or scope to a business slice. The live bronze checks above show the current standard; new tables should match it.

### No run ledger or control-table layer

If the pipeline has no durable record of what ran, for which slice, and with what outcome, operators are forced to infer execution history from data state alone. That is a weak audit boundary.

### Automatic schema evolution with no review gate

Letting runtime code create or alter tables opportunistically turns every recurring run into a release event. The corrective path is [[07-postgresql-pipeline-integration-and-devex]].

### Unbounded text by default

Using `text` for every field without thought creates wider rows, weaker constraints, and sloppier interfaces. PostgreSQL allows wide text easily; that is not a reason to stop modeling bounded business attributes precisely.

## Query And Performance Anti-Patterns

### `SELECT *` in ETL

`SELECT *` makes schema drift and payload widening invisible until they become downstream breakage. Persistent ETL should name the columns it actually owns.

### Implicit type conversions in predicates

Casting the column side of a predicate or relying on implicit coercion makes index use less reliable and hides data-quality mismatches. The corrective path is [[12-postgresql-sargable-queries]].

### Expecting weak isolation to fix blocking

PostgreSQL does not use SQL Server `NOLOCK`, and `READ UNCOMMITTED` does not produce dirty reads the way many SQL Server users expect. Blocking problems must be solved with transaction design, batching, indexing, and timeout posture, not by pretending isolation can be disabled. The corrective paths are [[16-postgresql-blocking-and-locking]] and [[18-postgresql-race-conditions]].

### Window functions without ordering support

The current Euro STOXX OHLCV table still has only its surrogate-key primary key, not the ideal `(symbol, date)` support index. Large rolling windows will scale poorly until that changes. The corrective path is [[05-postgresql-incremental-transforms]].

### Client-side list processing instead of set-based SQL

Pulling large candidate sets into application code just to filter, deduplicate, or rank them usually wastes bandwidth and CPU while hiding logic from the database execution surface.

## History And Change-Capture Anti-Patterns

### Overwriting history in place

If a correction overwrites the only stored row, the system loses the ability to explain what it previously published. The corrective path is [[06-postgresql-pit-integrity-logic]].

### SCD2 with no partial unique index

This is already visible in the live lab. `silver.index_dim` has `valid_from`, `valid_to`, and `is_current`, but no partial unique index on the current business key. That means the history model is structurally incomplete.

### Comparing nullable columns with `=`

Null-sensitive change detection should use `IS DISTINCT FROM`, not naïve equality predicates. Otherwise rows can appear unchanged when `NULL` transitions actually matter.

### Comparing floating-point values with raw equality

Pipeline decisions on financial ratios and weights should not depend on exact binary-equality checks unless that choice is truly intended. Use tolerances or cast to fixed-point when the business rule is decimal.

### Using `xmin` as business time

`xmin` is an MVCC implementation detail, not a business-valid or publication-valid timestamp. Treating it as business time is a PostgreSQL-specific anti-pattern. Use explicit valid-time and transaction-time columns instead.

## Concurrency And Operations Anti-Patterns

### Long-running write transactions during the business day

Long writes delay cleanup, retain old row versions, and widen the blast radius of any mistake. Break big publishes into bounded slices and keep the write window intentional.

### Blind upserts with no conflict guard

`INSERT ... ON CONFLICT DO UPDATE` is powerful, but blindly updating every conflict can rewrite unchanged rows, generate avoidable WAL, and hide whether data really changed. Guard updates with `IS DISTINCT FROM` where that distinction matters.

### No retry logic for deadlocks or serialization failures

Transient deadlocks and `40001` serialization failures are part of normal database life. Pipeline code that treats them as terminal surprises instead of retryable outcomes is brittle.

### Ignoring write-path posture

The write path is where PostgreSQL-specific operational debt shows up first: autovacuum disabled, no idle-transaction timeout, overly aggressive checkpoints, or growing deadlock counts.

| Field | Meaning |
|---|---|
| `autovacuum` | Whether automatic vacuuming is enabled. |
| `idle_in_transaction_session_timeout` | Timeout protecting the system from forgotten idle transactions. |
| `max_wal_size`, `checkpoint_timeout` | Core write-path pressure settings. |
| `deadlocks` | Deadlock count recorded for the database. |

*This query shows the current write-path posture of the live `stoxx` PostgreSQL lab.*

```sql
SELECT current_setting('autovacuum') AS autovacuum,
       current_setting('idle_in_transaction_session_timeout') AS idle_in_transaction_session_timeout,
       current_setting('max_wal_size') AS max_wal_size,
       current_setting('checkpoint_timeout') AS checkpoint_timeout,
       (SELECT deadlocks FROM pg_stat_database WHERE datname = 'stoxx') AS deadlocks;
```

```text
 autovacuum | idle_in_transaction_session_timeout | max_wal_size | checkpoint_timeout | deadlocks
------------+-------------------------------------+--------------+--------------------+-----------
 on         | 0                                   | 1GB          | 5min               |         2
(1 row)
```

The good news is that autovacuum is on. The bad news is that `idle_in_transaction_session_timeout` is still `0`, which leaves the system unprotected against forgotten idle transactions. The recorded deadlock count also proves that retry-aware pipeline code is not optional.

## Current Recommendation For `stoxx`

Use this note as a checklist, not as a substitute for the deeper chapter notes.

- Keep bronze, silver, and gold boundaries explicit.
- Keep provenance columns mandatory in bronze.
- Add the missing business-key and partial unique indexes the earlier notes identified.
- Publish in bounded transactions.
- Treat historical correctness and change capture as first-class design problems, not as afterthoughts.
- Treat `application_name`, session metadata, and lightweight SQL-side monitoring as part of the pipeline contract.

### Corrective paths

- [[01-postgresql-loading-patterns-and-idempotency]]
- [[03-postgresql-silver-transforms]]
- [[04-postgresql-gold-transforms]]
- [[05-postgresql-incremental-transforms]]
- [[06-postgresql-pit-integrity-logic]]
- [[07-postgresql-pipeline-integration-and-devex]]
