---
title: "MERGE and Upsert"
tags: [sql, sql-server, tsql, merge, upsert, output-clause, holdlock, insert-update-delete]
aliases: [MERGE, upsert patterns, atomic upsert, OUTPUT $action]
description: "T-SQL reference for SQL Server upsert patterns, MERGE syntax, OUTPUT $action, HOLDLOCK safety, deduplicated source requirements, and transaction-safe write patterns."
parent: "[[domain-query-writing-and-optimization]]"
links:
  - "[[stored-procedures-dynamic-sql-and-error-handling]]"
  - "[[race-conditions]]"
  - "[[sql-server-loading-patterns]]"
created: 2026-03-22
updated: 2026-04-08
status: complete
---

# MERGE and Upsert

This note owns the T-SQL language side of upsert and refresh logic:

- insert-if-not-exists patterns
- update-then-insert patterns
- `MERGE` syntax and clauses
- `OUTPUT $action`
- transaction-safe write habits

It does not own medallion-layer strategy, SCD2 architecture, or concurrency deep dives.

## Upsert Patterns Before MERGE

### INSERT WHERE NOT EXISTS

```sql
INSERT INTO dbo.target_table (business_key, payload)
SELECT s.business_key, s.payload
FROM dbo.source_table AS s
WHERE NOT EXISTS
(
    SELECT 1
    FROM dbo.target_table AS t
    WHERE t.business_key = s.business_key
);
```

This is clear and often sufficient when only inserts are needed.

### UPDATE then INSERT

```sql
UPDATE t
SET t.payload = s.payload
FROM dbo.target_table AS t
JOIN dbo.source_table AS s
    ON t.business_key = s.business_key;

INSERT INTO dbo.target_table (business_key, payload)
SELECT s.business_key, s.payload
FROM dbo.source_table AS s
WHERE NOT EXISTS
(
    SELECT 1
    FROM dbo.target_table AS t
    WHERE t.business_key = s.business_key
);
```

This is often easier to reason about than `MERGE` when the logic is simple and the operation types need different handling.

### Delete and insert refresh

For slice refreshes such as "rebuild one business date," delete-and-insert is often clearer than upsert semantics.

## MERGE Syntax And Clauses

### MERGE basic shape

```sql
MERGE dbo.target_table AS target
USING dbo.source_table AS source
    ON target.business_key = source.business_key
WHEN MATCHED THEN
    UPDATE SET target.payload = source.payload
WHEN NOT MATCHED BY TARGET THEN
    INSERT (business_key, payload)
    VALUES (source.business_key, source.payload);
```

`MERGE` allows inserts, updates, and optional deletes in one statement.

### WHEN MATCHED, WHEN NOT MATCHED BY TARGET, and WHEN NOT MATCHED BY SOURCE

| Clause | Meaning |
|---|---|
| `WHEN MATCHED` | Row exists in both source and target |
| `WHEN NOT MATCHED BY TARGET` | Source row is new and should be inserted |
| `WHEN NOT MATCHED BY SOURCE` | Target row is absent from source and may need delete or status change |

Use `WHEN NOT MATCHED BY SOURCE` carefully. It is only appropriate when the source represents the full comparison set for the business rule.

## OUTPUT $action

Use the `OUTPUT` clause when you need to know what the `MERGE` actually did.

```sql
MERGE dbo.target_table AS target
USING dbo.source_table AS source
    ON target.business_key = source.business_key
WHEN MATCHED THEN
    UPDATE SET target.payload = source.payload
WHEN NOT MATCHED BY TARGET THEN
    INSERT (business_key, payload)
    VALUES (source.business_key, source.payload)
OUTPUT
    $action AS merge_action,
    inserted.business_key;
```

This is the cleanest way to separate inserted, updated, and deleted row counts instead of relying on total `@@ROWCOUNT`.

## MERGE Safety Rules

### Semicolon requirement

> [!warning]
> `MERGE` requires a terminating semicolon.

Always end the statement with `;`.

### Deduplicate the source first

> [!danger]
> `MERGE` assumes one source row per target key. Duplicate source rows can fail or produce unstable behavior.

If the source may contain duplicates, deduplicate before the `MERGE`.

```sql
;WITH src AS
(
    SELECT *,
           ROW_NUMBER() OVER (PARTITION BY business_key ORDER BY load_ts DESC) AS rn
    FROM dbo.source_table
)
MERGE dbo.target_table AS target
USING
(
    SELECT business_key, payload
    FROM src
    WHERE rn = 1
) AS source
    ON target.business_key = source.business_key
WHEN MATCHED THEN
    UPDATE SET target.payload = source.payload
WHEN NOT MATCHED BY TARGET THEN
    INSERT (business_key, payload)
    VALUES (source.business_key, source.payload);
```

### HOLDLOCK for concurrent upsert safety

> [!warning]
> Concurrent upserts can race on the "not matched" check.

When `MERGE` is used as a true upsert against shared keys, add `WITH (HOLDLOCK)` on the target if the workload requires serialization of the not-matched decision.

```sql
MERGE dbo.target_table WITH (HOLDLOCK) AS target
USING dbo.source_table AS source
    ON target.business_key = source.business_key
WHEN MATCHED THEN
    UPDATE SET target.payload = source.payload
WHEN NOT MATCHED BY TARGET THEN
    INSERT (business_key, payload)
    VALUES (source.business_key, source.payload);
```

Concurrency theory and blocking consequences belong in [[race-conditions]] and [[blocking-and-locking]].

## When Not To Use MERGE

Prefer explicit `UPDATE` + `INSERT` or delete-and-insert when:

- the logic is simple
- each operation type needs different auditing
- debugging and operational clarity matter more than single-statement compactness
- the source is not guaranteed to be deduplicated or stable

`MERGE` is strongest when the one-statement declarative shape is genuinely valuable, not when it is used just because "upsert" sounds like `MERGE`.

## Transactions And Error Handling

For multi-step refresh logic around `MERGE`:

- `SET XACT_ABORT ON`
- use `TRY...CATCH`
- own the transaction boundary explicitly when multiple statements must succeed together
- use `OUTPUT $action` for auditability

## Scope Boundary

This note owns T-SQL upsert syntax and statement-level safety patterns.

It does not own:

- bronze/silver/gold load strategy
- SCD2 warehouse design
- full race-condition theory
- RCSI internals

Those belong in Patterns and Concurrency.

## Related

- [[stored-procedures-dynamic-sql-and-error-handling]]
- [[race-conditions]]
- [[sql-server-loading-patterns]]

