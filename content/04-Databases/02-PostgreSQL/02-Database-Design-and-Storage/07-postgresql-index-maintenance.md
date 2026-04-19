---
title: "07 - PostgreSQL Index Maintenance"
tags:
  - postgresql
  - indexing
  - maintenance
description: "Production-oriented guide to PostgreSQL index maintenance: bloat signals, dead tuples, `VACUUM`, `ANALYZE`, `REINDEX`, fillfactor, and how PostgreSQL maintenance differs from SQL Server rebuild/reorganize habits."
parent: "[[domain-postgresql-database-design-and-storage]]"
links:
  - "[[06-postgresql-index-types-and-strategy]]"
  - "[[08-postgresql-toast-and-compression]]"
status: complete
---

# PostgreSQL Index Maintenance

PostgreSQL index maintenance is not a rename of SQL Server rebuild/reorganize habits. The engine's real maintenance story is dead tuples, table and index bloat, `VACUUM`, `ANALYZE`, and `REINDEX`. The goal is to keep access paths dense enough and statistics fresh enough without pretending that every storage issue is "fragmentation" in the SQL Server sense.

> [!abstract]- Summary
>
> This note mirrors the SQL Server maintenance chapter, but translates it into PostgreSQL's actual operational surfaces:
>
> - **Baseline**
>   - confirms autovacuum and statistics defaults plus the current health of user tables in `stoxx`
> - **Bloat and free space**
>   - explains why PostgreSQL maintenance is about dead tuples and sparse pages rather than leaf-order fragmentation alone
> - **Maintenance demo**
>   - uses `pgstattuple`, `pgstatindex`, `REINDEX`, and `VACUUM (ANALYZE)` on a disposable table to show what changes and what does not
> - **Operational guidance**
>   - closes with fillfactor, cadence, and anti-pattern rules

## Reproducible Baseline

### PostgreSQL | cluster maintenance defaults | confirm the starting posture

#### Read the database context and maintenance defaults first

Run this before diagnosing bloat so you know whether the cluster is relying on autovacuum and what the default statistics target is. It is typically triggered during health review or before proposing manual maintenance. The query is read-only. Its purpose is to establish the baseline maintenance contract.

```sql
SELECT current_database() AS database_name,
       pg_postmaster_start_time() AS postmaster_start,
       current_setting('autovacuum') AS autovacuum_on,
       current_setting('default_statistics_target') AS default_statistics_target;
```

| database_name | postmaster_start | autovacuum_on | default_statistics_target |
|---|---|---|---|
| `stoxx` | `2026-04-18 23:55:01.079878+00` | `on` | `100` |

### PostgreSQL | table-maintenance baseline | inspect dead tuples and analyze freshness

#### Check whether user tables already look neglected

Run this before talking about `REINDEX` or fillfactor changes. It is typically triggered by slow-query review or general health audits. The query is read-only. Its purpose is to show whether dead tuples and maintenance timestamps already indicate trouble.

```sql
SELECT schemaname,
       relname,
       n_live_tup,
       n_dead_tup,
       last_vacuum,
       last_autovacuum,
       last_analyze,
       last_autoanalyze
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC, n_live_tup DESC
LIMIT 10;
```

| schemaname | relname | n_live_tup | n_dead_tup | last_vacuum | last_autovacuum | last_analyze | last_autoanalyze |
|---|---|---|---|---|---|---|---|
| `silver` | `eurostoxx50_ohlcv` | `67155` | `0` |  | `2026-04-18 20:39:30.784519+00` |  | `2026-04-18 20:39:30.839016+00` |
| `silver` | `stoxxusa50_ohlcv` | `66000` | `0` |  | `2026-04-18 20:39:30.996572+00` |  | `2026-04-18 20:39:31.058322+00` |
| `silver` | `stoxxasia50_ohlcv` | `64875` | `0` |  | `2026-04-18 20:39:30.911588+00` |  | `2026-04-18 20:39:30.970592+00` |

The live baseline is healthy. That matters because it means any manual maintenance in this lab is instructional rather than corrective.

## Why Bloat Matters

### PostgreSQL | maintenance model | reason about sparse pages, not only "fragmentation"

#### Treat bloat as a write-path and cache-efficiency problem

PostgreSQL updates and deletes leave behind old tuple versions until vacuum work makes that space reusable. Index maintenance matters because sparse leaf pages and accumulated stale entries increase read cost and storage cost. The operator question is not "is the index fragmented?" It is "is the structure dense enough and is the planner still seeing truthful statistics?"

## REINDEX And `VACUUM (ANALYZE)` Demo

### PostgreSQL | index-density reset | show what `REINDEX` actually fixes

#### Measure a disposable table before and after maintenance

Use this when teaching the difference between heap free space and index density. It is typically triggered by index bloat review or migration from SQL Server maintenance habits. The demo used a disposable table in `demo_stc`, updated indexed values, deleted rows, measured the result, ran `REINDEX`, then ran `VACUUM (ANALYZE)` before dropping the table. Its purpose is to show what improves and what does not.

Before maintenance, the demo looked like this:

```text
index_size_before = 352 kB
table_total_before = 2312 kB
tuple_count = 3500
dead_tuple_count = 0
free_percent = 50.47
avg_leaf_density = 28.97
leaf_fragmentation = 28.57
```

After `REINDEX INDEX demo_stc.note07_maint_symbol_idx;` and `VACUUM (ANALYZE) demo_stc.note07_maint_demo;`:

```text
tuple_count = 3500
dead_tuple_count = 0
free_percent = 50.47
avg_leaf_density = 86.17
leaf_fragmentation = 0
index_size_after = 128 kB
table_total_after = 2120 kB
```

And the catalog confirmed the table had been vacuumed and analyzed:

```sql
SELECT n_live_tup,
       n_dead_tup,
       last_analyze,
       last_vacuum
FROM pg_stat_user_tables
WHERE schemaname = 'demo_stc'
  AND relname = 'note07_maint_demo';
```

| n_live_tup | n_dead_tup | last_analyze | last_vacuum |
|---|---|---|---|
| `3500` | `0` | `2026-04-19 00:22:15.17753+00` | `2026-04-19 00:22:15.173614+00` |

This is the practical maintenance lesson:

| Observation | Meaning |
|---|---|
| index density jumped from about `29%` to `86%` | `REINDEX` rewrote the index into a denser structure |
| index size dropped from `352 kB` to `128 kB` | sparse pages were eliminated |
| heap `free_percent` stayed about `50%` | ordinary `VACUUM` makes heap space reusable, not returned to the OS |
| table total size dropped only modestly | fixing the index is not the same as compacting the heap |

## Fillfactor Guidance

### PostgreSQL | fillfactor | reserve page space only when update behavior justifies it

#### Use fillfactor as an update-pattern tool, not a ritual default

Lower fillfactor makes sense when a table or index is updated frequently enough that keeping room on pages reduces churn. It is not a blanket rule for every table. The cost of lower fillfactor is larger structures and more pages to read and cache.

## Production Cadence

### PostgreSQL | maintenance cadence | let autovacuum do the normal work, intervene deliberately

#### Keep manual maintenance for the cases the background worker does not solve

| Situation | Better action |
|---|---|
| ordinary OLTP churn, stats drifting normally | trust autovacuum and autoanalyze first |
| index has grown sparse or bloated | targeted `REINDEX` |
| planner estimates are stale after unusual change volume | manual `ANALYZE` |
| table must physically shrink and rewrite is acceptable | explicit table rewrite path, not blind routine maintenance |

## Anti-Patterns

### PostgreSQL | maintenance mistakes | avoid SQL Server habits that do not port cleanly

#### Use PostgreSQL's actual maintenance tools

| Anti-pattern | Why it hurts |
|---|---|
| scheduling blanket `REINDEX` for everything | unnecessary rewrite cost and lock risk |
| calling every storage issue "fragmentation" | hides the real tuple and bloat mechanics |
| expecting ordinary `VACUUM` to shrink files on disk | it reclaims space for reuse, not OS return |
| ignoring statistics freshness while chasing index rewrites | the planner may just need fresh stats |

Next: [[08-postgresql-toast-and-compression]] replaces the SQL Server row/page compression note with PostgreSQL's real storage-reduction surfaces: TOAST, column compression, storage attributes, and when compression does or does not change operational cost.
