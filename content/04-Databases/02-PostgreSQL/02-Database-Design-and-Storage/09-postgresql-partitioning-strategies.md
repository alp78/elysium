---
title: "09 - PostgreSQL Partitioning Strategies"
tags:
  - postgresql
  - partitioning
  - storage
description: "Production guide to PostgreSQL declarative partitioning: when it helps, how range partitions route rows, how pruning appears in plans, and how attach/detach workflows differ from SQL Server partition schemes."
parent: "[[domain-postgresql-database-design-and-storage]]"
links:
  - "[[08-postgresql-toast-and-compression]]"
  - "[[10-postgresql-change-tracking-and-history-patterns]]"
status: complete
---

# PostgreSQL Partitioning Strategies

PostgreSQL partitioning is table-native and declarative. You partition a parent table by range, list, or hash, and PostgreSQL routes rows into child partitions. That is a simpler surface than SQL Server partition functions and schemes, but it also changes what "metadata-only movement" and retention workflows look like.

> [!abstract]- Summary
>
> This note mirrors the SQL Server partitioning chapter, but translates it into PostgreSQL's declarative model:
>
> - **Current baseline**
>   - confirms that the live `stoxx` database currently has no partitioned user tables
> - **Reproducible demo**
>   - builds a disposable range-partitioned price table with January, February, and default partitions
> - **Routing and pruning**
>   - shows which partition each row lands in and how `EXPLAIN` prunes to the relevant partition
> - **Operational guidance**
>   - covers detach/drop retention flows and when not to partition

## Current Baseline In `stoxx`

### PostgreSQL | current partition posture | verify whether partitioning is already in use

#### Check for partitioned tables before designing around them

Run this before proposing a partition strategy so you know whether the current schema already uses declarative partitioning. It is typically triggered by retention design or large-table review. The query is read-only. Its purpose is to identify user-visible partitioned parents.

```sql
SELECT n.nspname AS schema_name,
       c.relname AS relation_name,
       c.relkind
FROM pg_class AS c
JOIN pg_namespace AS n
  ON n.oid = c.relnamespace
WHERE c.relkind = 'p'
  AND n.nspname NOT IN ('pg_catalog','information_schema')
ORDER BY n.nspname, c.relname;
```

| schema_name | relation_name | relkind |
|---|---|---|
| *(0 rows)* |  |  |

The current live database is not using partitioned tables today. That is a valid baseline, not a deficiency by itself.

## Reproducible Partition Demo

### PostgreSQL | range partitioning | route rows into monthly partitions

#### Build a disposable parent and child set to show the real catalog model

Use this when introducing PostgreSQL partitioning or when reviewing retention workflows. It is typically triggered by large time-series tables or date-based purge requirements. The demo is state-changing but disposable; it creates a parent table, two monthly partitions, and a default partition, then cleans them back out. Its purpose is to show routing and catalog hierarchy directly.

```sql
DROP TABLE IF EXISTS demo_stc.note09_prices_parent CASCADE;

CREATE TABLE demo_stc.note09_prices_parent (
  id bigint GENERATED ALWAYS AS IDENTITY,
  trade_date date NOT NULL,
  symbol text NOT NULL,
  close numeric(10,2) NOT NULL,
  PRIMARY KEY (trade_date, id)
) PARTITION BY RANGE (trade_date);

CREATE TABLE demo_stc.note09_prices_2026_01
  PARTITION OF demo_stc.note09_prices_parent
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE demo_stc.note09_prices_2026_02
  PARTITION OF demo_stc.note09_prices_parent
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE demo_stc.note09_prices_default
  PARTITION OF demo_stc.note09_prices_parent DEFAULT;

INSERT INTO demo_stc.note09_prices_parent (trade_date, symbol, close)
VALUES
  ('2026-01-15','STOXX50',5100.12),
  ('2026-02-18','STOXX50',5155.77),
  ('2026-04-03','STOXX50',5201.44);

SELECT tableoid::regclass::text AS landed_in,
       trade_date,
       symbol,
       close
FROM demo_stc.note09_prices_parent
ORDER BY trade_date;
```

| landed_in | trade_date | symbol | close |
|---|---|---|---|
| `demo_stc.note09_prices_2026_01` | `2026-01-15` | `STOXX50` | `5100.12` |
| `demo_stc.note09_prices_2026_02` | `2026-02-18` | `STOXX50` | `5155.77` |
| `demo_stc.note09_prices_default` | `2026-04-03` | `STOXX50` | `5201.44` |

The routing logic is exactly what the range boundaries say it should be. PostgreSQL does the partition choice at insert time, and the `tableoid` makes the landing place explicit.

### PostgreSQL | partition hierarchy and pruning | inspect the tree and plan shape

#### Read the partition tree from the catalog and verify pruning in the plan

Run this after building or inheriting a partitioned table so you can confirm both structure and optimizer behavior. It is typically triggered during performance review or retention design. The queries are read-only against the demo objects. Their purpose is to show the partition tree and prove that a targeted predicate hits only the needed child.

```sql
SELECT relid::regclass::text AS relation_name,
       parentrelid::regclass::text AS parent_name,
       level,
       isleaf
FROM pg_partition_tree('demo_stc.note09_prices_parent');
```

| relation_name | parent_name | level | isleaf |
|---|---|---|---|
| `demo_stc.note09_prices_parent` |  | `0` | `f` |
| `demo_stc.note09_prices_2026_01` | `demo_stc.note09_prices_parent` | `1` | `t` |
| `demo_stc.note09_prices_2026_02` | `demo_stc.note09_prices_parent` | `1` | `t` |
| `demo_stc.note09_prices_default` | `demo_stc.note09_prices_parent` | `1` | `t` |

```sql
EXPLAIN (COSTS OFF)
SELECT *
FROM demo_stc.note09_prices_parent
WHERE trade_date = DATE '2026-02-18';
```

```text
Bitmap Heap Scan on note09_prices_2026_02 note09_prices_parent
  Recheck Cond: (trade_date = '2026-02-18'::date)
  ->  Bitmap Index Scan on note09_prices_2026_02_pkey
        Index Cond: (trade_date = '2026-02-18'::date)
```

This is the pruning proof the note needs. PostgreSQL planned directly against the February partition, not against all children.

## Operational Patterns

### PostgreSQL | detach and drop | use partition lifecycle for retention windows

#### Think in child tables, not partition functions

In PostgreSQL the common retention flow is:

| Step | Why |
|---|---|
| create the next child partition ahead of time | keep inserts deterministic |
| detach an old partition when it ages out | separate it from the parent cleanly |
| drop or archive the detached child table | enforce the retention boundary |

The demo followed that pattern by detaching `note09_prices_default`, dropping it, and then dropping the parent tree.

## When Not To Partition

### PostgreSQL | partitioning limits | avoid solving the wrong problem

#### Partitioning is a management and pruning tool, not a magic performance switch

| Bad reason to partition | Better response |
|---|---|
| table is only moderately large | fix indexes, stats, and query shape first |
| deletes are rare and retention is simple | ordinary indexing may be enough |
| team wants "future proofing" | only add partitioning when a real lifecycle or pruning boundary exists |

Next: [[10-postgresql-change-tracking-and-history-patterns]] replaces SQL Server temporal, CDC, and CT features with the PostgreSQL equivalents that actually carry row-history and change-capture workloads.
