---
title: "11 - MERGE and Upsert"
tags:
  - postgresql
  - query-optimization
  - sql
aliases:
  - PostgreSQL upsert
  - PostgreSQL on conflict
  - PostgreSQL merge
description: "PostgreSQL reference for insert-or-ignore, insert-or-update, MERGE in PostgreSQL 16, duplicate-source failure modes, and the practical choice between ON CONFLICT, MERGE, and explicit two-step upsert logic."
parent: "[[domain-postgresql-query-writing-and-optimization]]"
links:
  - "[[10-postgresql-insert-update-delete-patterns]]"
  - "[[12-postgresql-sargable-queries]]"
status: complete
---

# MERGE and Upsert

Upsert logic in PostgreSQL is first a uniqueness and concurrency problem, then a syntax choice. For the common "insert or update one target row by key" case, `INSERT ... ON CONFLICT` is the normal answer. PostgreSQL 16 also supports `MERGE`, but `MERGE` is broader, more restrictive in some ways, and not automatically the better choice. In particular, PostgreSQL `MERGE` has no `RETURNING` clause and no SQL Server-style `WHEN NOT MATCHED BY SOURCE`.

> [!abstract] Scope
>
> This note mirrors the SQL Server merge and upsert track with PostgreSQL equivalents. It covers `ON CONFLICT DO NOTHING`, `ON CONFLICT DO UPDATE`, PostgreSQL 16 `MERGE`, duplicate-source failure modes, and the explicit two-step upsert alternative.
>
> - **Simple upsert patterns** cover insert-or-ignore and insert-or-update with `ON CONFLICT`.
> - **`MERGE`** covers matched updates, insert branches, and matched deletes.
> - **Failure modes** cover duplicate source rows that try to affect the same target row twice.
> - **Practical guidance** compares `ON CONFLICT`, `MERGE`, and explicit update-plus-insert logic.

## `ON CONFLICT` as the Default Upsert Surface

If the business key is backed by a unique or primary-key constraint, PostgreSQL can resolve the insert-versus-update race at the constraint boundary. That is why `ON CONFLICT` is usually preferred for simple upsert paths.

### Insert-or-ignore and insert-or-update

`DO NOTHING` is the "insert only if missing" form. `DO UPDATE` is the true upsert form that updates the existing row when the key already exists.

#### Use `ON CONFLICT DO NOTHING` for idempotent insert-only loads

Use this pattern when duplicates should be ignored rather than updated. It is typically triggered by idempotent ingest, key-only deduplication, and "first writer wins" insert paths. The script is state-changing inside a transaction and rolls back at the end. Its purpose is to show the simplest PostgreSQL conflict-handling form.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | inserted row | text | Business key protected by the primary key. |
| `status_code` | inserted or existing row | text | Status stored for the symbol. |
| `composite_score` | inserted or existing row | numeric | Score stored for the symbol. |

*This transaction attempts to insert one existing key and one new key; `DO NOTHING` keeps the existing row untouched and inserts only the missing one.*

```sql
BEGIN;

CREATE TEMP TABLE note11_target (
    symbol text PRIMARY KEY,
    status_code text NOT NULL,
    composite_score numeric(10,4) NOT NULL
) ON COMMIT DROP;

INSERT INTO note11_target VALUES ('BNP.PA', 'ACTIVE', 0.5000);

INSERT INTO note11_target (symbol, status_code, composite_score)
VALUES
    ('BNP.PA', 'ACTIVE', 0.5967),
    ('TTE.PA', 'ACTIVE', 0.4954)
ON CONFLICT (symbol) DO NOTHING
RETURNING symbol, status_code, composite_score;

SELECT symbol, status_code, composite_score
FROM note11_target
ORDER BY symbol;

ROLLBACK;
```

```text
BEGIN
CREATE TABLE
INSERT 0 1
```

| symbol | status_code | composite_score |
|---|---|---:|
| TTE.PA | ACTIVE | 0.4954 |

```text
INSERT 0 1
```

| symbol | status_code | composite_score |
|---|---|---:|
| BNP.PA | ACTIVE | 0.5000 |
| TTE.PA | ACTIVE | 0.4954 |

```text
ROLLBACK
```

Only the missing row was inserted. The existing `BNP.PA` row remained unchanged because the conflict handler explicitly chose to do nothing.

#### Use `ON CONFLICT DO UPDATE` for the common single-key upsert

Use this pattern when the requirement is "insert if missing, otherwise update the existing row." It is typically triggered by dimension refreshes, cache tables, and current-state synchronization. The script is state-changing inside a transaction and rolls back at the end. Its purpose is to show the canonical PostgreSQL upsert form.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | inserted or updated row | text | Business key protected by the target primary key. |
| `status_code` | direct insert value or `EXCLUDED` update value | text | Final status stored after conflict resolution. |
| `composite_score` | direct insert value or `EXCLUDED` update value | numeric | Final score stored after conflict resolution. |

*This transaction updates an existing key and inserts a missing key in one `ON CONFLICT DO UPDATE` statement.*

```sql
BEGIN;

CREATE TEMP TABLE note11_target (
    symbol text PRIMARY KEY,
    status_code text NOT NULL,
    composite_score numeric(10,4) NOT NULL
) ON COMMIT DROP;

INSERT INTO note11_target VALUES
    ('BNP.PA', 'STALE', 0.5000),
    ('TTE.PA', 'STALE', 0.4000);

INSERT INTO note11_target (symbol, status_code, composite_score)
VALUES
    ('BNP.PA', 'ACTIVE', 0.5967),
    ('ENI.MI', 'ACTIVE', 0.4807)
ON CONFLICT (symbol) DO UPDATE
SET status_code = EXCLUDED.status_code,
    composite_score = EXCLUDED.composite_score
RETURNING symbol, status_code, composite_score;

SELECT symbol, status_code, composite_score
FROM note11_target
ORDER BY symbol;

ROLLBACK;
```

```text
BEGIN
CREATE TABLE
INSERT 0 2
```

| symbol | status_code | composite_score |
|---|---|---:|
| BNP.PA | ACTIVE | 0.5967 |
| ENI.MI | ACTIVE | 0.4807 |

```text
INSERT 0 2
```

| symbol | status_code | composite_score |
|---|---|---:|
| BNP.PA | ACTIVE | 0.5967 |
| ENI.MI | ACTIVE | 0.4807 |
| TTE.PA | STALE | 0.4000 |

```text
ROLLBACK
```

This is the normal PostgreSQL upsert. The `EXCLUDED` pseudo-table represents the proposed inserted row that lost the uniqueness race and is now feeding the update.

## `MERGE` in PostgreSQL 16

`MERGE` is broader than `ON CONFLICT` because it can update, insert, delete, or do nothing depending on the matched state and clause order. It is useful when the source rowset is batch-shaped and the workflow genuinely needs more than a single-key insert-or-update rule.

### Match once, then route to one action

PostgreSQL `MERGE` evaluates the join to produce candidate change rows, decides once whether each row is matched or not matched, and then executes the first qualifying `WHEN` clause for that candidate row.

#### Use `MERGE` for batch update-plus-insert workflows

Use this pattern when a source batch should update matching target rows and insert non-matching source rows. It is typically triggered by staging-table reconciliation and batch refreshes. The script is state-changing inside a transaction and rolls back at the end. Its purpose is to show the basic PostgreSQL 16 merge shape.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | target row after merge | text | Business key of the merged row. |
| `status_code` | target row after merge | text | Final status after merge processing. |
| `composite_score` | target row after merge | numeric | Final score after merge processing. |

*This transaction updates one existing row and inserts one new row through a single `MERGE` statement.*

```sql
BEGIN;

CREATE TEMP TABLE note11_target (
    symbol text PRIMARY KEY,
    status_code text NOT NULL,
    composite_score numeric(10,4) NOT NULL
) ON COMMIT DROP;

INSERT INTO note11_target VALUES
    ('BNP.PA', 'STALE', 0.5000),
    ('TTE.PA', 'STALE', 0.4000);

MERGE INTO note11_target AS t
USING (
    VALUES
        ('BNP.PA', 'ACTIVE', 0.5967::numeric),
        ('ENI.MI', 'ACTIVE', 0.4807::numeric)
) AS s(symbol, status_code, composite_score)
ON s.symbol = t.symbol
WHEN MATCHED THEN
    UPDATE SET status_code = s.status_code,
               composite_score = s.composite_score
WHEN NOT MATCHED THEN
    INSERT (symbol, status_code, composite_score)
    VALUES (s.symbol, s.status_code, s.composite_score);

SELECT symbol, status_code, composite_score
FROM note11_target
ORDER BY symbol;

ROLLBACK;
```

```text
BEGIN
CREATE TABLE
INSERT 0 2
MERGE 2
```

| symbol | status_code | composite_score |
|---|---|---:|
| BNP.PA | ACTIVE | 0.5967 |
| ENI.MI | ACTIVE | 0.4807 |
| TTE.PA | STALE | 0.4000 |

```text
ROLLBACK
```

Operationally this ends in the same state as the earlier `ON CONFLICT DO UPDATE` example. The difference is that `MERGE` starts from a source rowset joined to the target, not from a uniqueness conflict raised during `INSERT`.

#### `MERGE` can delete matched rows, but not "missing from source" rows

Use this pattern when the source explicitly marks matched target rows for deletion or suppression. It is typically triggered by batch logic where a source row carries state that determines whether the target survives. The script is state-changing inside a transaction and rolls back at the end. Its purpose is to show the delete branch that PostgreSQL `MERGE` does support.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | target row after merge | text | Remaining business key after merge processing. |
| `active` | target row after merge | boolean | Surviving active flag in the target. |

*This transaction deletes one matched row because the source explicitly says it should not be kept.*

```sql
BEGIN;

CREATE TEMP TABLE note11_target (
    symbol text PRIMARY KEY,
    active boolean NOT NULL
) ON COMMIT DROP;

INSERT INTO note11_target VALUES
    ('BNP.PA', true),
    ('TTE.PA', true),
    ('ENI.MI', true);

MERGE INTO note11_target AS t
USING (
    VALUES
        ('BNP.PA', true),
        ('TTE.PA', false)
) AS s(symbol, keep_row)
ON s.symbol = t.symbol
WHEN MATCHED AND NOT s.keep_row THEN
    DELETE
WHEN MATCHED THEN
    DO NOTHING
WHEN NOT MATCHED THEN
    INSERT (symbol, active)
    VALUES (s.symbol, s.keep_row);

SELECT symbol, active
FROM note11_target
ORDER BY symbol;

ROLLBACK;
```

```text
BEGIN
CREATE TABLE
INSERT 0 3
MERGE 1
```

| symbol | active |
|---|---|
| BNP.PA | true |
| ENI.MI | true |

```text
ROLLBACK
```

This is an important PostgreSQL difference from SQL Server: there is no `WHEN NOT MATCHED BY SOURCE` branch. If the business rule is "delete target rows absent from the source," PostgreSQL needs a separate anti-join delete step outside `MERGE`.

## Failure Modes and Practical Alternatives

The sharp edges are mostly about source cardinality and statement choice. `MERGE` is not a license to ignore deduplication.

### Duplicate source keys and the explicit two-step option

If more than one source row tries to affect the same target row, PostgreSQL `MERGE` raises an error. For simpler workloads, an explicit update plus insert pair is often easier to reason about anyway.

#### Duplicate source rows break `MERGE`

Use this example as a correctness boundary when preparing staging data for merge. It is typically triggered by source feeds that may carry duplicate business keys. The script is state-changing but ends with rollback after the error. Its purpose is to show the exact PostgreSQL error when two source rows try to update the same target row.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | source business key | text | Duplicated key that causes two candidate change rows to target the same existing row. |
| `composite_score` | source value | numeric | Competing source values for the same target key. |

*This transaction fails because two source rows both match the same target row in one `MERGE`.*

```sql
BEGIN;

CREATE TEMP TABLE note11_target (
    symbol text PRIMARY KEY,
    status_code text NOT NULL,
    composite_score numeric(10,4) NOT NULL
) ON COMMIT DROP;

INSERT INTO note11_target VALUES ('BNP.PA', 'STALE', 0.5000);

MERGE INTO note11_target AS t
USING (
    VALUES
        ('BNP.PA', 'ACTIVE', 0.5967::numeric),
        ('BNP.PA', 'ACTIVE', 0.7000::numeric)
) AS s(symbol, status_code, composite_score)
ON s.symbol = t.symbol
WHEN MATCHED THEN
    UPDATE SET composite_score = s.composite_score;

ROLLBACK;
```

```text
ERROR:  MERGE command cannot affect row a second time
HINT:  Ensure that not more than one source row matches any one target row.
```

This is the staging-table rule in one line: deduplicate the source to one row per target key before `MERGE` runs.

#### The explicit update-plus-insert pattern stays clear and predictable

Use this pattern when the workflow is a basic insert-or-update batch and there is no genuine need for `MERGE` clause routing. It is typically triggered by warehouse staging loads and operational upsert paths where clarity is more valuable than single-statement compactness. The script is state-changing inside a transaction and rolls back at the end. Its purpose is to show the practical alternative that many teams still prefer.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | final target row | text | Business key after the two-step reconciliation. |
| `status_code` | final target row | text | Final state after update and insert phases. |
| `composite_score` | final target row | numeric | Final score after update and insert phases. |

*This transaction first updates matching keys, then inserts only the missing keys from the source table.*

```sql
BEGIN;

CREATE TEMP TABLE note11_target (
    symbol text PRIMARY KEY,
    status_code text NOT NULL,
    composite_score numeric(10,4) NOT NULL
) ON COMMIT DROP;

INSERT INTO note11_target VALUES
    ('BNP.PA', 'STALE', 0.5000),
    ('TTE.PA', 'STALE', 0.4000);

CREATE TEMP TABLE note11_source (
    symbol text PRIMARY KEY,
    status_code text NOT NULL,
    composite_score numeric(10,4) NOT NULL
) ON COMMIT DROP;

INSERT INTO note11_source VALUES
    ('BNP.PA', 'ACTIVE', 0.5967),
    ('ENI.MI', 'ACTIVE', 0.4807);

UPDATE note11_target AS t
SET status_code = s.status_code,
    composite_score = s.composite_score
FROM note11_source AS s
WHERE s.symbol = t.symbol;

INSERT INTO note11_target (symbol, status_code, composite_score)
SELECT s.symbol, s.status_code, s.composite_score
FROM note11_source AS s
WHERE NOT EXISTS (
    SELECT 1
    FROM note11_target AS t
    WHERE t.symbol = s.symbol
);

SELECT symbol, status_code, composite_score
FROM note11_target
ORDER BY symbol;

ROLLBACK;
```

```text
BEGIN
CREATE TABLE
INSERT 0 2
CREATE TABLE
INSERT 0 2
UPDATE 1
INSERT 0 1
```

| symbol | status_code | composite_score |
|---|---|---:|
| BNP.PA | ACTIVE | 0.5967 |
| ENI.MI | ACTIVE | 0.4807 |
| TTE.PA | STALE | 0.4000 |

```text
ROLLBACK
```

This reaches the same target state as the earlier basic `MERGE`, but the update and insert phases are explicit and independently inspectable.

## Practical Rules

Choose the simplest statement family that matches the actual business rule.

| Need | PostgreSQL pattern | Why |
|---|---|---|
| Insert only if missing | `ON CONFLICT DO NOTHING` | Simple, idempotent insert-or-ignore. |
| Insert or update one row by unique key | `ON CONFLICT DO UPDATE` | Default PostgreSQL upsert surface. |
| Batch insert and update from a source rowset | `MERGE` or explicit two-step upsert | Use `MERGE` only when its clause routing adds real value. |
| Delete matched rows based on source state | `MERGE ... WHEN MATCHED ... DELETE` | Supported in PostgreSQL 16. |
| Delete target rows absent from the source | Separate anti-join `DELETE` | PostgreSQL 16 has no `WHEN NOT MATCHED BY SOURCE`. |
| Need captured modified rows | Prefer `ON CONFLICT ... RETURNING` or two-step DML | PostgreSQL `MERGE` has no `RETURNING`. |
| Source may contain duplicate business keys | Deduplicate before `MERGE` | Duplicate source matches raise an error. |
