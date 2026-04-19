---
title: "03 - PostgreSQL Schemas, Tables, and Constraints"
tags:
  - postgresql
  - schema-design
  - storage
description: "Production-facing guide to PostgreSQL schemas, table design, nullability, generated columns, identity columns, heap-table reality, table variants, and constraint enforcement, grounded in the live stoxx database."
parent: "[[domain-postgresql-database-design-and-storage]]"
links:
  - "[[02-postgresql-storage-internals]]"
  - "[[04-postgresql-keys-defaults-identity-and-sequences]]"
status: complete
---

# PostgreSQL Schemas, Tables, and Constraints

PostgreSQL table design starts with namespaces and ownership, not with filegroups or clustered-table choices. The default table is a heap relation. Indexes are added on top of it. Constraints are real schema objects with their own catalog entries. The live `stoxx` database makes those boundaries visible enough to treat design as an operational decision instead of only a modeling exercise.

> [!abstract]- Summary
>
> This note mirrors the SQL Server schemas-and-constraints chapter, but translates it into PostgreSQL's actual design surface:
>
> - **Schemas and ownership**
>   - covers namespaces, owners, and the current medallion-style footprint in `stoxx`
> - **CREATE TABLE contract**
>   - walks through types, nullability, defaults, generated columns, and identity columns from a live disposable demo
> - **Heap-table reality**
>   - explains that PostgreSQL tables are heaps by default, with indexes layered on top rather than the table being the clustered index
> - **Constraint semantics**
>   - shows primary key, unique, foreign key, and check constraints as catalog-backed objects
> - **Table variants**
>   - replaces SQL Server temporal and memory-optimized variants with PostgreSQL's unlogged, temporary, partitioned, materialized, and foreign-table design options

## Schemas, Namespaces, And Ownership

### PostgreSQL | schema model | inspect the current namespace footprint

#### Read schemas as ownership and naming boundaries

Run this when reviewing naming discipline, medallion layering, or privilege boundaries. It is typically triggered during initial database design or after drift accumulates in a shared database. The query is read-only. Its purpose is to show which non-system schemas actually exist and who owns them.

```sql
SELECT nspname AS schema_name,
       nspowner::regrole AS owner_name
FROM pg_namespace
WHERE nspname NOT LIKE 'pg_%'
  AND nspname <> 'information_schema'
ORDER BY nspname;
```

| schema_name | owner_name |
|---|---|
| `bronze` | `postgres` |
| `dbo` | `postgres` |
| `demo_stc` | `postgres` |
| `gold` | `postgres` |
| `public` | `pg_database_owner` |
| `silver` | `postgres` |

The important PostgreSQL read is that `public` is owned by the database owner role abstraction, while the medallion schemas are explicitly owned by `postgres` in this lab. That makes schema ownership an operational control surface, not only a naming convention.

### PostgreSQL | schema layering | measure where tables actually live

#### Verify that layer meaning is visible in the real database

Run this after a database has accumulated objects and the question becomes whether the intended layer model is still legible. It is typically triggered by onboarding, design review, or permission work. The query is read-only. Its purpose is to show schema density and size together so "layering" stays tied to real objects.

```sql
SELECT schemaname,
       COUNT(*) AS tables,
       pg_size_pretty(SUM(pg_total_relation_size(format('%I.%I', schemaname, tablename)::regclass))) AS total_size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog','information_schema')
GROUP BY schemaname
ORDER BY COUNT(*) DESC, schemaname;
```

| schemaname | tables | total_size |
|---|---|---|
| `bronze` | `12` | `3376 kB` |
| `silver` | `7` | `31 MB` |
| `demo_stc` | `6` | `200 kB` |
| `gold` | `3` | `1344 kB` |
| `dbo` | `2` | `16 kB` |

This is the schema-layering story in one table: `silver` holds fewer tables but materially more data, `bronze` owns the broader raw footprint, and `gold` is small and derived. PostgreSQL schemas are doing real organizational work here.

## CREATE TABLE, Types, And Nullability

### PostgreSQL | table contract | inspect columns, defaults, identity, and generated values

#### Capture the table contract from the catalogs instead of from memory

Use this when designing a new table or reviewing whether an existing table contract is precise enough. It is typically triggered during model review, migration, or DDL code review. The demo is state-changing but isolated to temporary tables inside one transaction and rolled back at the end. Its purpose is to show how PostgreSQL records type, nullability, defaults, generated columns, and identity behavior.

```sql
BEGIN;

CREATE TEMP TABLE note03_parent (
  id int PRIMARY KEY,
  code text UNIQUE,
  amount numeric(10,2) CHECK (amount >= 0),
  created_at timestamptz DEFAULT now(),
  amount_bucket text GENERATED ALWAYS AS (
    CASE WHEN amount >= 100 THEN 'large' ELSE 'small' END
  ) STORED
);

CREATE TEMP TABLE note03_child (
  id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parent_id int NOT NULL REFERENCES note03_parent(id),
  note text DEFAULT 'pending'
);

SELECT c.relname AS table_name,
       a.attname AS column_name,
       format_type(a.atttypid, a.atttypmod) AS data_type,
       a.attnotnull AS not_null,
       a.attidentity AS identity_kind,
       a.attgenerated AS generated_kind,
       pg_get_expr(d.adbin, d.adrelid) AS default_expr
FROM pg_class AS c
JOIN pg_attribute AS a
  ON a.attrelid = c.oid
 AND a.attnum > 0
 AND NOT a.attisdropped
LEFT JOIN pg_attrdef AS d
  ON d.adrelid = a.attrelid
 AND d.adnum = a.attnum
WHERE c.relname IN ('note03_parent','note03_child')
ORDER BY c.relname, a.attnum;

ROLLBACK;
```

| table_name | column_name | data_type | not_null | identity_kind | generated_kind | default_expr |
|---|---|---|---|---|---|---|
| `note03_child` | `id` | `integer` | `t` | `a` |  |  |
| `note03_child` | `parent_id` | `integer` | `t` |  |  |  |
| `note03_child` | `note` | `text` | `f` |  |  | `'pending'::text` |
| `note03_parent` | `id` | `integer` | `t` |  |  |  |
| `note03_parent` | `code` | `text` | `f` |  |  |  |
| `note03_parent` | `amount` | `numeric(10,2)` | `f` |  |  |  |
| `note03_parent` | `created_at` | `timestamp with time zone` | `f` |  |  | `now()` |
| `note03_parent` | `amount_bucket` | `text` | `f` |  | `s` | `CASE WHEN (amount >= (100)::numeric) THEN 'large'::text ELSE 'small'::text END` |

Three PostgreSQL-specific signals matter here:

| Column signal | Meaning |
|---|---|
| `identity_kind = 'a'` | `GENERATED ALWAYS AS IDENTITY` is in use on `note03_child.id` |
| `generated_kind = 's'` | stored generated column, not a virtual expression |
| `default_expr` populated | default is a true catalog-backed expression, not only a UI-side convenience |

## Constraints

### PostgreSQL | constraint catalog | read the real enforcement objects

#### Inspect primary key, unique, foreign key, and check constraints together

Run this when you need to prove which rules are actually enforced by the engine. It is typically triggered during model review, troubleshooting, or migration mapping. The query is part of the same rolled-back demo context as the previous section. Its purpose is to show constraint definitions as PostgreSQL stores them in `pg_constraint`.

```sql
BEGIN;

CREATE TEMP TABLE note03_parent (
  id int PRIMARY KEY,
  code text UNIQUE,
  amount numeric(10,2) CHECK (amount >= 0)
);

CREATE TEMP TABLE note03_child (
  id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parent_id int NOT NULL REFERENCES note03_parent(id)
);

SELECT conrelid::regclass::text AS table_name,
       conname,
       contype,
       pg_get_constraintdef(oid) AS constraint_def
FROM pg_constraint
WHERE conrelid::regclass::text IN ('note03_parent','note03_child')
ORDER BY conrelid::regclass::text, conname;

ROLLBACK;
```

| table_name | conname | contype | constraint_def |
|---|---|---|---|
| `note03_child` | `note03_child_parent_id_fkey` | `f` | `FOREIGN KEY (parent_id) REFERENCES note03_parent(id)` |
| `note03_child` | `note03_child_pkey` | `p` | `PRIMARY KEY (id)` |
| `note03_parent` | `note03_parent_amount_check` | `c` | `CHECK ((amount >= (0)::numeric))` |
| `note03_parent` | `note03_parent_code_key` | `u` | `UNIQUE (code)` |
| `note03_parent` | `note03_parent_pkey` | `p` | `PRIMARY KEY (id)` |

The `contype` codes are the fast operator read: `p` for primary key, `u` for unique, `f` for foreign key, and `c` for check. PostgreSQL stores these as first-class catalog objects, which makes constraint auditing direct and reliable.

## Heap Tables And Physical Shape

### PostgreSQL | heap baseline | remember that tables are heaps unless you choose otherwise

#### Read table persistence and table kind from the relation catalog

Run this when translating storage assumptions from engines where the clustered index is the table. It is typically triggered by cross-platform migration or low-level design review. The query is read-only. Its purpose is to show that ordinary PostgreSQL tables are persistent heap relations by default.

```sql
SELECT relname,
       relkind,
       relpersistence,
       reltoastrelid::regclass AS toast_table
FROM pg_class
WHERE oid IN (
  'silver.eurostoxx50_ohlcv'::regclass,
  'gold.index_performance'::regclass
)
ORDER BY relname;
```

| relname | relkind | relpersistence | toast_table |
|---|---|---|---|
| `eurostoxx50_ohlcv` | `r` | `p` | `-` |
| `index_performance` | `r` | `p` | `-` |

`relkind = 'r'` means ordinary table. `relpersistence = 'p'` means persistent. This is the default physical shape in PostgreSQL. The table is the heap. The index is a separate structure on top of it. There is no SQL Server-style "clustered index as the table" decision here.

## Special Table Variants

### PostgreSQL | table variants | choose the right specialized table form

#### Replace SQL Server-specific table features with PostgreSQL-native variants

Use this decision map during design review when a requirement sounds like it came from another engine. The context is architectural. Its purpose is to map the operational need to the actual PostgreSQL feature family.

| Requirement | PostgreSQL variant | Operational read |
|---|---|---|
| skip WAL for disposable data | `UNLOGGED` table | faster writes, but truncates after crash and does not replicate safely like normal tables |
| session-scoped scratch space | `TEMP` table | isolated per session and dropped automatically |
| large time-sliced retention | partitioned table | declarative partitioning, not filegroup-backed partition schemes |
| precomputed query result | materialized view | refresh-managed, not automatically current |
| remote external data source | foreign table | PostgreSQL FDW surface, not a native local heap |

## Safe Evolution Patterns

### PostgreSQL | DDL evolution | prefer expand-migrate-contract over risky rewrites

#### Change contracts in a way application code can survive

The safe pattern is the same one that survives on every serious database platform:

| Step | Why |
|---|---|
| add the new nullable or default-backed column first | lets old and new code coexist |
| backfill or migrate in controlled batches | keeps locks and rewrite risk bounded |
| switch application reads and writes | moves the contract intentionally |
| remove the obsolete column later | avoids breaking code in the same deployment that introduced the new shape |

Column renames and type rewrites are especially risky because PostgreSQL may need table rewrites or application coordination even when the DDL looks small.

## Recommendations

### PostgreSQL | design rules | keep contracts explicit and storage assumptions correct

#### Use the engine you actually have

| Rule | Why |
|---|---|
| use schemas as namespace and permission boundaries | they are doing real organizational work in `stoxx` already |
| keep nullability intentional | nullable-by-accident columns become contract debt quickly |
| use generated columns for deterministic derived data only | they are stored and maintained by the engine, not free |
| treat identity and sequences as separate design tools | PostgreSQL gives both; choose deliberately |
| remember the table is a heap by default | index strategy is a second decision, not the table shape itself |

Next: [[04-postgresql-keys-defaults-identity-and-sequences]] narrows the design focus from general table contracts to row-identity strategy, defaults, identity columns, sequences, UUID generation, and PostgreSQL-specific key selection rules.
