---
title: "06 - PostgreSQL Index Types and Strategy"
tags:
  - postgresql
  - indexing
  - performance
description: "Production guide to PostgreSQL index design: B-tree, partial, expression, GIN, GiST, and BRIN strategy, grounded in the live stoxx index surface and a disposable catalog-backed demo of multiple index families."
parent: "[[domain-postgresql-database-design-and-storage]]"
links:
  - "[[05-postgresql-schema-layering]]"
  - "[[07-postgresql-index-maintenance]]"
status: complete
---

# PostgreSQL Index Types and Strategy

PostgreSQL index design starts with access patterns, not with a universal "add an index" instinct. The engine gives you several real index families, each built for a different shape of predicate or data distribution. The hardest mistake is importing SQL Server habits too literally: PostgreSQL tables are heaps, so indexes are always separate structures, and specialized families such as GIN, GiST, and BRIN matter much earlier than they do on many SQL Server estates.

> [!abstract]- Summary
>
> This note mirrors the SQL Server index-strategy chapter, but the PostgreSQL version centers on the native index families and what problem each one solves:
>
> - **Current baseline**
>   - shows the live `stoxx` index surface, which is mostly B-tree primary keys today
> - **Core families**
>   - covers B-tree, partial, expression, GIN, GiST, and BRIN indexes
> - **Design guidance**
>   - emphasizes predicate shape, sort order, selectivity, and maintenance cost instead of generic missing-index folklore
> - **Operational strategy**
>   - closes with rules for choosing the smallest useful index set

## Current Baseline In `stoxx`

### PostgreSQL | current index surface | inspect what the database already uses

#### Read the live index inventory before expanding it

Run this at the start of any index design review. It is typically triggered by slow-query analysis or migration work. The query is read-only. Its purpose is to show the current index family choices already present in the database.

```sql
SELECT schemaname,
       tablename,
       indexname,
       indexdef
FROM pg_indexes
WHERE schemaname IN ('bronze','silver','gold')
ORDER BY schemaname, tablename, indexname
LIMIT 20;
```

| schemaname | tablename | indexname | indexdef |
|---|---|---|---|
| `bronze` | `dim_country` | `dim_country_pkey` | `CREATE UNIQUE INDEX dim_country_pkey ON bronze.dim_country USING btree (country_name)` |
| `bronze` | `trading_calendar` | `trading_calendar_pkey` | `CREATE UNIQUE INDEX trading_calendar_pkey ON bronze.trading_calendar USING btree (date, exchange_code)` |
| `silver` | `eurostoxx50_ohlcv` | `eurostoxx50_ohlcv_pkey` | `CREATE UNIQUE INDEX eurostoxx50_ohlcv_pkey ON silver.eurostoxx50_ohlcv USING btree (id)` |

The live baseline is straightforward: the current design leans almost entirely on B-tree primary keys. That is normal for a small lab. It also means the chapter needs to show the other families explicitly rather than pretending the existing schema already uses them.

## Choose The Right Index Family

### PostgreSQL | family demo | create one table that can host multiple index families

#### Use a disposable table to compare definitions, not just theory

Use this when teaching or reviewing which family belongs to which predicate class. It is typically triggered by design discussions that use vague terms like "advanced index." The demo is state-changing but isolated to temporary objects inside one transaction and rolled back. Its purpose is to show the real DDL shape for each family.

```sql
BEGIN;

CREATE TEMP TABLE note06_index_demo (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  symbol text NOT NULL,
  trade_date date NOT NULL,
  active boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL,
  valid_window daterange NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX note06_btree_idx
  ON note06_index_demo (symbol, trade_date DESC);

CREATE INDEX note06_partial_idx
  ON note06_index_demo (trade_date)
  WHERE active;

CREATE INDEX note06_expr_idx
  ON note06_index_demo ((lower(symbol)));

CREATE INDEX note06_gin_idx
  ON note06_index_demo USING gin (payload);

CREATE INDEX note06_gist_idx
  ON note06_index_demo USING gist (valid_window);

CREATE INDEX note06_brin_idx
  ON note06_index_demo USING brin (created_at);

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname LIKE 'pg_temp_%'
  AND tablename = 'note06_index_demo'
ORDER BY indexname;

ROLLBACK;
```

| indexname | indexdef |
|---|---|
| `note06_brin_idx` | `CREATE INDEX note06_brin_idx ON pg_temp.note06_index_demo USING brin (created_at)` |
| `note06_btree_idx` | `CREATE INDEX note06_btree_idx ON pg_temp.note06_index_demo USING btree (symbol, trade_date DESC)` |
| `note06_expr_idx` | `CREATE INDEX note06_expr_idx ON pg_temp.note06_index_demo USING btree (lower(symbol))` |
| `note06_gin_idx` | `CREATE INDEX note06_gin_idx ON pg_temp.note06_index_demo USING gin (payload)` |
| `note06_gist_idx` | `CREATE INDEX note06_gist_idx ON pg_temp.note06_index_demo USING gist (valid_window)` |
| `note06_partial_idx` | `CREATE INDEX note06_partial_idx ON pg_temp.note06_index_demo USING btree (trade_date) WHERE active` |

That one result set is the practical PostgreSQL index map:

| Family | Best fit |
|---|---|
| B-tree | equality, range, order-by, and most standard OLTP predicates |
| Partial | filtered hot subset such as `WHERE active` |
| Expression | queries that repeatedly apply the same deterministic function |
| GIN | containment and membership on documents, arrays, and full-text search |
| GiST | ranges, geometric or proximity-style searches, and extensible operator classes |
| BRIN | very large append-friendly tables where physical order tracks the predicate column |

## Design Rules

### PostgreSQL | B-tree first, specialization second | keep the choice tied to predicates

#### Solve the query shape you actually have

Use these rules in design review:

| If the query pattern is... | Prefer... |
|---|---|
| equality and ordered range scans | B-tree |
| mostly one hot subset of rows | partial B-tree |
| repeated function-wrapped predicate such as `lower(email)` | expression index |
| JSONB containment or array membership | GIN |
| range overlap or exclusion semantics | GiST |
| huge time-ordered tables with coarse pruning opportunities | BRIN |

## Strategy Warnings

### PostgreSQL | indexing anti-patterns | avoid expensive structures without a query-shaped reason

#### Every index taxes writes, WAL, vacuum, and backups

| Anti-pattern | Why it hurts |
|---|---|
| adding indexes only because `idx_scan = 0` feels suspicious | quiet tables can still need their primary keys and constraints |
| using GIN or GiST without the matching operator class need | specialized indexes are not prestige features |
| indexing function-wrapped predicates without stabilizing the exact expression | the planner only uses the expression index when the predicate matches |
| choosing BRIN on data with poor physical locality | a bad BRIN is cheap, but not useful |

## Practical Recommendation For `stoxx`

### PostgreSQL | current recommendation | keep the baseline simple and add specialization deliberately

#### Expand from B-tree only where the workload proves the need

The current lab is still appropriately simple: mostly primary-key B-trees, very small tables, and modest data size. The next index work should be workload-shaped, not taxonomy-shaped:

| Potential need | Candidate family |
|---|---|
| case-insensitive lookups on text keys | expression B-tree |
| JSONB attribute containment | GIN |
| large date-ordered append tables at much bigger scale | BRIN |
| heavily queried active subset | partial B-tree |

Next: [[07-postgresql-index-maintenance]] turns design into lifecycle operations: bloat detection, `REINDEX`, `VACUUM`, fillfactor, statistics refresh, and how PostgreSQL maintenance differs from SQL Server rebuild/reorganize habits.
