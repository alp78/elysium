---
title: "04 - PostgreSQL Keys, Defaults, Identity, and Sequences"
tags:
  - postgresql
  - schema-design
  - keys
description: "Reference guide to PostgreSQL natural and surrogate key strategy, composite keys, identity columns, sequences, default expressions, UUID generation, and the operational boundary where xmin is not a rowversion substitute."
parent: "[[domain-postgresql-database-design-and-storage]]"
links:
  - "[[03-postgresql-schemas-tables-and-constraints]]"
  - "[[05-postgresql-schema-layering]]"
status: complete
---

# PostgreSQL Keys, Defaults, Identity, and Sequences

PostgreSQL gives you more than one way to generate row identity, and that is exactly why design discipline matters. Identity columns, standalone sequences, natural keys, composite keys, UUID defaults, and application-managed tokens all solve different problems. The mistake is to treat them as interchangeable just because each can produce unique values.

> [!abstract]- Summary
>
> This note mirrors the SQL Server identity-and-sequences chapter, but adapts it to PostgreSQL's real primitives:
>
> - **Row identity strategy**
>   - natural, surrogate, and composite keys still matter before any generator is chosen
> - **Identity columns**
>   - PostgreSQL supports standard `GENERATED ... AS IDENTITY` columns and should prefer them over legacy `serial` syntax for new design
> - **Standalone sequences**
>   - remain valuable when multiple tables, batch numbers, or business-visible counters need controlled allocation
> - **Defaults and generated values**
>   - defaults are expressions in the catalog, not only constants
> - **UUIDs and change tokens**
>   - PostgreSQL can generate UUIDs cleanly, but it has no direct SQL Server `rowversion` equivalent you should treat as a business contract

## Row Identity Strategy

### PostgreSQL | key strategy | choose the key before you choose the generator

#### Start with business identity, not with syntax

Run this design check before writing any DDL. It is typically triggered by new table design or migration from another engine. The context is conceptual rather than query-driven. Its purpose is to stop teams from choosing identity syntax first and only later discovering that the table actually needed a natural or composite contract.

| Key style | Best use | PostgreSQL read |
|---|---|---|
| Natural key | stable business identifier already exists | still the cleanest choice when the value is genuinely immutable |
| Surrogate key | business key is wide, mutable, or operationally awkward | common default for fact-like and integration-heavy tables |
| Composite key | the row is naturally identified by multiple columns together | use when the combination is the real contract, not because surrogate keys feel fashionable |

## Identity Columns

### PostgreSQL | existing sequence surface | inspect what the database already uses

#### Read current sequences before adding more generators

Run this at the start of a database design review so you know whether the existing model already leans on identity or sequence-backed allocation. It is typically triggered during schema review, migration, or cleanup of inconsistent key patterns. The query is read-only. Its purpose is to show how many sequences already exist and what contracts they imply.

```sql
SELECT schemaname,
       sequencename,
       data_type,
       start_value,
       min_value,
       max_value,
       increment_by,
       cycle,
       cache_size
FROM pg_sequences
WHERE schemaname NOT IN ('pg_catalog','information_schema')
ORDER BY schemaname, sequencename;
```

| schemaname | sequencename | data_type | start_value | min_value | max_value | increment_by | cycle | cache_size |
|---|---|---|---|---|---|---|---|---|
| `bronze` | `eurostoxx50_ohlcv_id_seq` | `integer` | `1` | `1` | `2147483647` | `1` | `f` | `1` |
| `gold` | `index_performance_id_seq` | `integer` | `1` | `1` | `2147483647` | `1` | `f` | `1` |
| `silver` | `stoxxusa50_ohlcv_id_seq` | `integer` | `1` | `1` | `2147483647` | `1` | `f` | `1` |

The full live result contains twenty non-system sequences. The important read is not the exact count; it is that sequence-backed surrogate keys are already a normal pattern across the medallion schemas.

### PostgreSQL | identity columns and `RETURNING` | capture generated values safely

#### Use standards-based identity and fetch generated values in the same statement

Use this when the table wants one engine-generated surrogate key per inserted row. It is typically triggered by row-identity design for new operational tables. The demo is state-changing but isolated to temporary objects inside one transaction and rolled back. Its purpose is to show the clean PostgreSQL pattern: `GENERATED ALWAYS AS IDENTITY` for the primary key and `INSERT ... RETURNING` to get the value back without racing another session.

```sql
BEGIN;

CREATE TEMP SEQUENCE note04_batch_seq
  START WITH 1000
  INCREMENT BY 10
  CACHE 5;

CREATE TEMP TABLE note04_identity_demo (
  id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  natural_code text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  note_uuid uuid DEFAULT gen_random_uuid(),
  batch_no bigint DEFAULT nextval('note04_batch_seq')
);

INSERT INTO note04_identity_demo (natural_code)
VALUES ('A-001'), ('A-002')
RETURNING id, natural_code, created_at, note_uuid, batch_no;

ROLLBACK;
```

| id | natural_code | created_at | note_uuid | batch_no |
|---|---|---|---|---|
| `1` | `A-001` | `2026-04-19 00:16:50.385708+00` | `33fcc515-8ab5-4546-b7ea-3bf5e72b2470` | `1000` |
| `2` | `A-002` | `2026-04-19 00:16:50.385708+00` | `0d9b8831-9103-4b2c-92e6-ef1421ecb116` | `1010` |

The safe read is simple:

| Signal | Meaning |
|---|---|
| `id` increments by 1 | identity column owns row identity |
| `RETURNING` returns both rows immediately | no need for a second query that could race |
| `batch_no` increments by 10 | independent sequence contract can coexist with identity |
| `note_uuid` populated by default | UUID generation is just another default expression surface |

Identity values, like sequence values, can have gaps. Rollbacks, caching, and crashes can all burn values. If the business requirement is "strictly gapless invoice numbers," identity is the wrong tool.

## Standalone Sequences

### PostgreSQL | sequence metadata | inspect the contract behind an independent sequence

#### Read the sequence options explicitly when they matter to the business

Run this when a sequence is part of batch numbering, invoice allocation, or any contract that is more visible than an internal surrogate key. It is typically triggered by schema review or post-incident for skipped values. The demo query below is part of the same temporary sequence created above. Its purpose is to show the options that shape allocation and the difference between current cached state and the next visible value.

```sql
BEGIN;

CREATE TEMP SEQUENCE note04_batch_seq
  START WITH 1000
  INCREMENT BY 10
  CACHE 5;

SELECT schemaname,
       sequencename,
       start_value,
       increment_by,
       cache_size,
       cycle
FROM pg_sequences
WHERE sequencename = 'note04_batch_seq';

SELECT last_value, is_called
FROM note04_batch_seq;

ROLLBACK;
```

| schemaname | sequencename | start_value | increment_by | cache_size | cycle |
|---|---|---|---|---|---|
| `pg_temp_3` | `note04_batch_seq` | `1000` | `10` | `5` | `f` |

| last_value | is_called |
|---|---|
| `1040` | `t` |

`last_value = 1040` after only two inserted rows is the operational reminder that cached sequences allocate ahead. PostgreSQL is optimizing allocation, not promising that every intermediate value became a committed row.

## Defaults, UUIDs, And Generated Values

### PostgreSQL | default expressions | use defaults for row-local generation, not for hidden business logic

#### Keep default expressions deterministic and easy to reason about

Defaults are best for timestamps, UUIDs, sequence calls, and simple fill values. They are not a substitute for multi-row business rules. The live demo above already shows three solid default patterns in one table: `now()`, `gen_random_uuid()`, and `nextval(...)`.

`pgcrypto` is already installed in `stoxx`:

```sql
SELECT extname, extversion
FROM pg_extension
WHERE extname = 'pgcrypto';
```

| extname | extversion |
|---|---|
| `pgcrypto` | `1.3` |

That makes `gen_random_uuid()` a valid default in this lab today. Without the extension, the function would not exist.

## `xmin` And Change Tokens

### PostgreSQL | no direct `rowversion` equivalent | do not build business contracts on `xmin`

#### Separate internal MVCC metadata from application-facing change tracking

This is the key conceptual difference from the SQL Server source note. PostgreSQL exposes `xmin`, but it is an internal transaction identifier for MVCC visibility rules, not a durable business token contract. It can be useful for debugging and concurrency reasoning. It is a poor substitute for an explicit version column, update timestamp, or formal change-capture design.

Use these replacements instead:

| Need | Better PostgreSQL pattern |
|---|---|
| optimistic concurrency token | explicit `bigint` or `uuid` version column updated by the application or trigger |
| change feed for downstream systems | logical decoding, audit tables, or application event logging |
| row freshness for warehouse history | explicit `updated_at`, SCD2 pattern, or dbt snapshot |

## Practical Selection Rules

### PostgreSQL | key and generator rules | choose the smallest tool that matches the contract

#### Prefer clarity over cleverness

| Requirement | Recommended PostgreSQL choice |
|---|---|
| simple surrogate key for one table | `GENERATED ALWAYS AS IDENTITY` |
| one allocator shared across multiple tables or batch concepts | standalone `SEQUENCE` |
| globally unique identifier without coordination | UUID default such as `gen_random_uuid()` |
| strict business identity | natural or composite key with explicit constraints |
| change detection | explicit versioning pattern, not `xmin` |

Next: [[05-postgresql-schema-layering]] widens the lens from per-table identity design to database-wide organization: medallion schemas, source-scoped staging, control-plane schemas, and how PostgreSQL schema ownership shapes permission boundaries.
