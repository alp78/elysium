---
title: "20 - Plan Caching, Regressions, and Remediation"
tags:
  - postgresql
  - query-optimization
  - performance
  - sql
aliases:
  - PostgreSQL plan regressions
  - PostgreSQL generic vs custom plans
  - PostgreSQL plan cache
description: "PostgreSQL guide to plan-cache regressions, prepared statements, generic versus custom plans, `plan_cache_mode`, prepared-statement inspection, and the practical remediation ladder when core PostgreSQL has no Query Store plan forcing."
parent: "[[domain-postgresql-query-writing-and-optimization]]"
links:
  - "[[19-postgresql-functions-dynamic-sql-and-error-handling]]"
status: complete
---

# Plan Caching, Regressions, and Remediation

SQL Server solves plan regressions with Query Store history and plan forcing. Core PostgreSQL does not. PostgreSQL's comparable operational problem is usually plan caching around prepared statements: the same statement can run well with a custom plan, then degrade badly when a generic plan is reused for a parameter-sensitive workload. The remediation surface is correspondingly different: rewrite the SQL, improve statistics or indexing, change plan-cache policy for the session, or drop and reprepare. There is no built-in historical force-plan workflow to lean on.

> [!abstract] Scope
>
> This note mirrors the SQL Server Query Store regression chapter with PostgreSQL's actual plan-cache surface. It covers what core PostgreSQL has and does not have, how prepared statements are inspected, how generic and custom plans diverge, and the practical remediation ladder when a cached plan is no longer safe.
>
> - **Foundations** cover the absence of Query Store-style plan forcing in core PostgreSQL.
> - **Prepared-statement inspection** covers `pg_prepared_statements` and `plan_cache_mode`.
> - **Regression demonstration** covers the same prepared statement running well with a custom plan and badly with a generic plan.
> - **Remediation** covers SQL rewrites, `ANALYZE`, deallocation, and temporary `force_custom_plan` use.

## What Core PostgreSQL Has, and What It Does Not

PostgreSQL does have:

- a session-visible prepared-statement catalog
- generic and custom plan modes
- `EXPLAIN (ANALYZE, BUFFERS)` for direct plan comparison

Core PostgreSQL does not have:

- a built-in Query Store history
- built-in per-query plan forcing
- built-in persisted query hints

The current lab reflects that directly:

```sql
SELECT current_setting('plan_cache_mode') AS plan_cache_mode;

SELECT extname
FROM pg_extension
WHERE extname IN ('pg_stat_statements', 'pg_hint_plan')
ORDER BY extname;
```

| plan_cache_mode |
|---|
| auto |

```text
 extname
---------
(0 rows)
```

`plan_cache_mode = auto` means PostgreSQL may choose either a custom or generic plan depending on its heuristics. The empty extension result means this lab has neither persistent query history from `pg_stat_statements` nor hinting from `pg_hint_plan`.

## Prepared Statements Are the Main Core Inspection Surface

The demo below prepares one parameter-sensitive catch-all statement against a temp table built from the live `stoxx` OHLCV data.

```sql
BEGIN;

CREATE TEMP TABLE note20_price_demo AS
SELECT
    symbol::text AS symbol,
    date AS price_date,
    close,
    volume
FROM (
    SELECT symbol, date, close, volume FROM silver.eurostoxx50_ohlcv
    UNION ALL
    SELECT symbol, date, close, volume FROM silver.stoxxusa50_ohlcv
    UNION ALL
    SELECT symbol, date, close, volume FROM silver.stoxxasia50_ohlcv
    UNION ALL
    SELECT symbol, date, close, volume FROM silver.oil20_ohlcv
) s;

CREATE INDEX note20_price_demo_symbol_date_idx
    ON note20_price_demo (symbol, price_date);

ANALYZE note20_price_demo;

PREPARE note20_catch_all(text) AS
SELECT count(*)
FROM note20_price_demo
WHERE $1 IS NULL OR symbol = $1;

SELECT
    name,
    parameter_types,
    from_sql,
    statement
FROM pg_prepared_statements
WHERE name = 'note20_catch_all';
```

| name | parameter_types | from_sql | statement |
|---|---|---|---|
| note20_catch_all | {text} | t | PREPARE note20_catch_all(text) AS SELECT count(*) FROM note20_price_demo WHERE $1 IS NULL OR symbol = $1; |

`pg_prepared_statements` is not a regression-history tool, but it is the right place to confirm exactly what the session has prepared.

## Generic Versus Custom Plan Regression

The prepared statement is the same in both cases. Only the planner mode changes.

### Custom plan: selective parameter gets the indexed path

```sql
SET LOCAL plan_cache_mode = 'force_custom_plan';

EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
EXECUTE note20_catch_all('AAPL');
```

```text
Aggregate (actual time=0.170..0.170 rows=1 loops=1)
  Buffers: local hit=3 read=19
  ->  Bitmap Heap Scan on note20_price_demo (actual time=0.067..0.136 rows=1320 loops=1)
        Recheck Cond: (symbol = 'AAPL'::text)
        Heap Blocks: exact=14
        Buffers: local hit=3 read=19
        ->  Bitmap Index Scan on note20_price_demo_symbol_date_idx (actual time=0.061..0.061 rows=1320 loops=1)
              Index Cond: (symbol = 'AAPL'::text)
              Buffers: local read=8
Planning:
  Buffers: shared hit=8, local read=1
Planning Time: 0.117 ms
Execution Time: 0.184 ms
```

With the actual value visible at planning time, PostgreSQL simplifies the predicate and chooses the narrow bitmap-index path.

### Generic plan: the same statement degrades to a full scan

```sql
SET LOCAL plan_cache_mode = 'force_generic_plan';

EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
EXECUTE note20_catch_all('AAPL');
```

```text
Aggregate (actual time=8.240..8.241 rows=1 loops=1)
  Buffers: local hit=14 read=1586
  ->  Seq Scan on note20_price_demo (actual time=2.573..8.205 rows=1320 loops=1)
        Filter: (($1 IS NULL) OR (symbol = $1))
        Rows Removed by Filter: 221790
        Buffers: local hit=14 read=1586
Planning Time: 0.055 ms
Execution Time: 8.252 ms
```

This is the core PostgreSQL regression pattern:

- same prepared statement
- same parameter value
- radically different plan shape
- almost 45x difference in execution time in the captured run

The regression happened because the generic plan must preserve both meanings of the catch-all predicate instead of specializing for the selective `AAPL` branch.

## Remediation Ladder

### 1. Rewrite the SQL first

Catch-all predicates such as `$1 IS NULL OR symbol = $1` are regression bait. The cleanest fix is usually to split the logic:

- one statement for the unfiltered path
- one statement for the filtered path

That removes the ambiguity instead of trying to outsmart it later.

### 2. Keep statistics trustworthy

If the plan changed because the data distribution changed, `ANALYZE` is usually more durable than any session-level plan tweak. PostgreSQL's planner quality still depends on current statistics.

### 3. Use `force_custom_plan` only as a scoped mitigation

`SET LOCAL plan_cache_mode = 'force_custom_plan'` can be a useful session- or transaction-level mitigation when one known statement is obviously parameter-sensitive. It is not a replacement for correcting the query shape.

### 4. Drop and reprepare when the cached module itself is stale

Prepared statements are session objects. If the statement must be rebuilt, remove it explicitly:

```sql
DEALLOCATE note20_catch_all;

SELECT COUNT(*) AS prepared_after_deallocate
FROM pg_prepared_statements
WHERE name = 'note20_catch_all';
```

| prepared_after_deallocate |
|---:|
| 0 |

This is the PostgreSQL equivalent of saying "the cached statement handle is gone; the next execution must prepare again."

### 5. Accept that core PostgreSQL has no force-plan button

There is no built-in equivalent to `sp_query_store_force_plan`. If a plan is bad, the durable fixes are:

- better SQL shape
- better indexes
- better statistics
- better session-level preparation strategy

## Practical Guidance

- Treat prepared statements and `plan_cache_mode` as the main core plan-cache levers in PostgreSQL.
- Compare generic and custom plans before blaming the engine for a regression.
- Rewrite optional-filter catch-all SQL aggressively; it is a common generic-plan footgun.
- Use `ANALYZE` and `DEALLOCATE` as routine remediation tools, not exotic interventions.
- If historical workload ranking matters, install `pg_stat_statements`; core PostgreSQL does not give you Query Store for free.

The temp table and prepared statement used for the walkthrough were deallocated and rolled back after capture.
