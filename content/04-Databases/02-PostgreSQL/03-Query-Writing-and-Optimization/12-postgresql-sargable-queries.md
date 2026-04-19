---
title: "12 - Sargable Queries"
tags:
  - postgresql
  - query-optimization
  - sql
aliases:
  - PostgreSQL sargable predicates
  - PostgreSQL indexable predicates
  - PostgreSQL expression indexes
description: "PostgreSQL reference for indexable predicate shape, composite-index left-prefix behavior, function-wrapped columns, date-range rewrites, expression indexes, partial indexes, and generic-plan catch-all pitfalls."
parent: "[[domain-postgresql-query-writing-and-optimization]]"
links:
  - "[[11-postgresql-merge-and-upsert]]"
  - "[[13-postgresql-execution-plans]]"
status: complete
---

# Sargable Queries

PostgreSQL documentation does not lean on the SQL Server term "SARGable," but the planner still rewards the same core idea: keep indexed columns in a form that can become an `Index Cond` instead of a row-by-row `Filter`. In PostgreSQL the practical signal is not a seek counter DMV. It is the combination of `EXPLAIN (ANALYZE, BUFFERS)`, the chosen scan node, and whether the predicate survived as an index condition.

> [!abstract] Scope
>
> This note mirrors the SQL Server SARGability track with PostgreSQL planner terminology and PostgreSQL escape hatches. It covers the bare-column rule, composite-index left-prefix behavior, function and cast anti-patterns, date-range rewrites, `OR` and catch-all predicate behavior, and expression or partial indexes when direct rewrites are not enough.
>
> - **Predicate shape** covers `Index Cond` versus `Filter` and the difference between indexable and non-indexable predicates.
> - **Index-key alignment** covers why a good predicate can still scan when it starts on the wrong column of a composite index.
> - **Rewrite patterns** cover function-wrapped columns, arithmetic predicates, date extraction, and column-side casts.
> - **PostgreSQL-specific escape hatches** cover expression indexes, partial indexes, and generic-plan catch-all risks.

## What Sargable Means in PostgreSQL

In PostgreSQL, a predicate is "sargable" in the useful day-to-day sense when the planner can turn it into an `Index Cond` on a usable index. That can surface as an `Index Scan`, `Index Only Scan`, or `Bitmap Index Scan` plus `Bitmap Heap Scan`. When the predicate has to be evaluated after reading rows, it falls back to `Filter`, and once that happens PostgreSQL often has no better option than a `Seq Scan`.

### Demo table and indexes used throughout this note

The examples below use a transaction-scoped temp table built from the live `stoxx` OHLCV data. Run this setup once in a single session, then reuse the temp table and end the session with `ROLLBACK`.

```sql
BEGIN;

CREATE TEMP TABLE note12_price_demo AS
SELECT
    symbol::text AS symbol,
    date AS price_date,
    close,
    volume,
    src
FROM (
    SELECT symbol, date, close, volume, 'euro_stoxx_50'::text AS src
    FROM silver.eurostoxx50_ohlcv
    UNION ALL
    SELECT symbol, date, close, volume, 'stoxx_usa_50'::text AS src
    FROM silver.stoxxusa50_ohlcv
    UNION ALL
    SELECT symbol, date, close, volume, 'stoxx_asia_50'::text AS src
    FROM silver.stoxxasia50_ohlcv
    UNION ALL
    SELECT symbol, date, close, volume, 'oil_20'::text AS src
    FROM silver.oil20_ohlcv
) s;

CREATE INDEX note12_price_demo_symbol_date_idx
    ON note12_price_demo (symbol, price_date);

CREATE INDEX note12_price_demo_close_idx
    ON note12_price_demo (close);

CREATE INDEX note12_price_demo_volume_idx
    ON note12_price_demo (volume);

ANALYZE note12_price_demo;

SELECT
    COUNT(*) AS total_rows,
    COUNT(DISTINCT symbol) AS distinct_symbols,
    MIN(price_date) AS min_date,
    MAX(price_date) AS max_date
FROM note12_price_demo;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname LIKE 'pg_temp%'
  AND tablename = 'note12_price_demo'
ORDER BY indexname;
```

| total_rows | distinct_symbols | min_date | max_date |
|---:|---:|---|---|
| 223110 | 167 | 2021-01-04 | 2026-04-07 |

| indexname | indexdef |
|---|---|
| note12_price_demo_close_idx | CREATE INDEX note12_price_demo_close_idx ON pg_temp.note12_price_demo USING btree (close) |
| note12_price_demo_symbol_date_idx | CREATE INDEX note12_price_demo_symbol_date_idx ON pg_temp.note12_price_demo USING btree (symbol, price_date) |
| note12_price_demo_volume_idx | CREATE INDEX note12_price_demo_volume_idx ON pg_temp.note12_price_demo USING btree (volume) |

The key design choice is intentional. There is an index on `(symbol, price_date)`, but no standalone `price_date` index yet. That lets the early examples separate "good predicate shape" from "good key alignment."

### A bare equality predicate becomes an `Index Cond`

The simplest indexable form is still the most important one: keep the indexed column bare and compare it directly to a value that PostgreSQL can resolve without touching the column.

```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT count(*)
FROM note12_price_demo
WHERE symbol = 'AAPL';
```

```text
Aggregate (actual time=0.157..0.158 rows=1 loops=1)
  Buffers: local hit=4 read=20
  ->  Bitmap Heap Scan on note12_price_demo (actual time=0.046..0.121 rows=1320 loops=1)
        Recheck Cond: (symbol = 'AAPL'::text)
        Heap Blocks: exact=16
        Buffers: local hit=4 read=20
        ->  Bitmap Index Scan on note12_price_demo_symbol_date_idx (actual time=0.042..0.042 rows=1320 loops=1)
              Index Cond: (symbol = 'AAPL'::text)
              Buffers: local read=8
Planning Time: 0.040 ms
Execution Time: 0.171 ms
```

This is the PostgreSQL version of the classic "seekable" pattern. The key evidence is the `Bitmap Index Scan` plus the `Index Cond`. The planner is using key order on `symbol`; it is not reading all 223,110 rows and then filtering afterward.

### Matching more of the composite key narrows the access path

Once the predicate starts on the leftmost key, PostgreSQL can keep narrowing the index range as more key columns line up.

```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT count(*)
FROM note12_price_demo
WHERE symbol = 'AAPL'
  AND price_date >= DATE '2026-01-01'
  AND price_date < DATE '2026-02-01';
```

```text
Aggregate (actual time=0.010..0.010 rows=1 loops=1)
  Buffers: local hit=4
  ->  Bitmap Heap Scan on note12_price_demo (actual time=0.007..0.008 rows=20 loops=1)
        Recheck Cond: ((symbol = 'AAPL'::text) AND (price_date >= '2026-01-01'::date) AND (price_date < '2026-02-01'::date))
        Heap Blocks: exact=1
        Buffers: local hit=4
        ->  Bitmap Index Scan on note12_price_demo_symbol_date_idx (actual time=0.005..0.005 rows=20 loops=1)
              Index Cond: ((symbol = 'AAPL'::text) AND (price_date >= '2026-01-01'::date) AND (price_date < '2026-02-01'::date))
              Buffers: local hit=3
Planning Time: 0.042 ms
Execution Time: 0.020 ms
```

The predicate stayed fully inside `Index Cond`, and the qualifying rowset fell from 1,320 rows to 20. That is exactly what good composite-key alignment is supposed to do.

### A full composite point lookup becomes a direct index scan

```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT close
FROM note12_price_demo
WHERE symbol = 'AAPL'
  AND price_date = DATE '2026-04-07';
```

```text
Index Scan using note12_price_demo_symbol_date_idx on note12_price_demo (actual time=0.009..0.010 rows=1 loops=1)
  Index Cond: ((symbol = 'AAPL'::text) AND (price_date = '2026-04-07'::date))
  Buffers: local hit=1 read=3
Planning:
  Buffers: shared hit=25, local read=3
Planning Time: 0.109 ms
Execution Time: 0.021 ms
```

At this point the planner no longer needs a bitmap path. The predicate is narrow enough that a direct `Index Scan` is cheaper.

## Composite Index Left-Prefix Rule

Bare predicates are necessary, but not sufficient. PostgreSQL still has to start from the leftmost column of the B-tree. If the index is `(symbol, price_date)`, then a predicate on `price_date` alone does not line up with the index order.

```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT count(*)
FROM note12_price_demo
WHERE price_date = DATE '2026-04-07';
```

```text
Aggregate (actual time=7.463..7.463 rows=1 loops=1)
  Buffers: local hit=287 read=1761
  ->  Seq Scan on note12_price_demo (actual time=2.589..7.455 rows=165 loops=1)
        Filter: (price_date = '2026-04-07'::date)
        Rows Removed by Filter: 222945
        Buffers: local hit=287 read=1761
Planning Time: 0.026 ms
Execution Time: 7.473 ms
```

`price_date = ...` is written in a perfectly indexable shape, but it still scans because the available index starts on `symbol`. This is the main operational trap with composite indexes: predicate shape and key order both have to cooperate.

> [!warning] Bare is not enough
>
> A predicate can be perfectly well written and still scan if the relevant index begins on a different column. In PostgreSQL, "good predicate" and "usable access path" are separate checks.

## Functions, Arithmetic, and Column-Side Casts

Any function, arithmetic expression, or explicit cast applied to the indexed column changes the value PostgreSQL sees at planning time. Once that happens, the plain B-tree on the base column often stops being usable.

### Wrapping the indexed column in a function forces row-by-row evaluation

```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT count(*)
FROM note12_price_demo
WHERE lower(symbol) = 'aapl';
```

```text
Aggregate (actual time=21.306..21.307 rows=1 loops=1)
  Buffers: local hit=23 read=2025
  ->  Seq Scan on note12_price_demo (actual time=6.586..21.270 rows=1320 loops=1)
        Filter: (lower(symbol) = 'aapl'::text)
        Rows Removed by Filter: 221790
        Buffers: local hit=23 read=2025
Planning Time: 0.030 ms
Execution Time: 21.318 ms
```

The planner cannot use the plain `(symbol, price_date)` index here because the indexed value is no longer `symbol`; it is `lower(symbol)` computed row by row.

### Move arithmetic to the literal side

```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT count(*)
FROM note12_price_demo
WHERE close * 1.05 > 200;
```

```text
Aggregate (actual time=11.526..11.527 rows=1 loops=1)
  Buffers: local read=2048
  ->  Seq Scan on note12_price_demo (actual time=0.027..9.461 rows=84899 loops=1)
        Filter: ((close * '1.05'::double precision) > '200'::double precision)
        Rows Removed by Filter: 138211
        Buffers: local read=2048
Planning:
  Buffers: shared hit=3
Planning Time: 0.056 ms
Execution Time: 11.537 ms
```

Rewrite the same business rule so the base column stays bare:

```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT count(*)
FROM note12_price_demo
WHERE close > 200 / 1.05;
```

```text
Aggregate (actual time=8.304..8.304 rows=1 loops=1)
  Buffers: local read=1122
  ->  Bitmap Heap Scan on note12_price_demo (actual time=2.049..6.216 rows=84899 loops=1)
        Recheck Cond: (close > '190.47619047619048'::double precision)
        Heap Blocks: exact=887
        Buffers: local read=1122
        ->  Bitmap Index Scan on note12_price_demo_close_idx (actual time=1.993..1.993 rows=84899 loops=1)
              Index Cond: (close > '190.47619047619048'::double precision)
              Buffers: local read=235
Planning:
  Buffers: shared hit=3
Planning Time: 0.052 ms
Execution Time: 8.316 ms
```

The row count is identical, but the access path is not. The rewrite lets PostgreSQL use `note12_price_demo_close_idx` because the comparison is now against the raw indexed `close` value.

### Column-side casts are the PostgreSQL version of the conversion trap

SQL Server notes usually warn about implicit conversions on the column side. PostgreSQL is less prone to the classic `nvarchar` versus `varchar` trap because string literals begin as `unknown` and are often coerced to the column type. The real PostgreSQL hazard is simpler: if you cast the column, you have still wrapped the column.

```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT count(*)
FROM note12_price_demo
WHERE close::numeric(12,2) > 190.48;
```

```text
Aggregate (actual time=64.125..64.127 rows=1 loops=1)
  Buffers: local read=1600
  ->  Seq Scan on note12_price_demo (actual time=0.021..61.712 rows=84898 loops=1)
        Filter: ((close)::numeric(12,2) > 190.48)
        Rows Removed by Filter: 138212
        Buffers: local read=1600
Planning:
  Buffers: shared hit=8, local read=1
Planning Time: 0.107 ms
Execution Time: 64.148 ms
```

The literal-side equivalent preserves the index:

```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT count(*)
FROM note12_price_demo
WHERE close > 190.48::double precision;
```

```text
Aggregate (actual time=21.213..21.214 rows=1 loops=1)
  Buffers: local hit=8 read=927
  ->  Bitmap Heap Scan on note12_price_demo (actual time=3.082..18.259 rows=84898 loops=1)
        Recheck Cond: (close > '190.48'::double precision)
        Heap Blocks: exact=700
        Buffers: local hit=8 read=927
        ->  Bitmap Index Scan on note12_price_demo_close_idx (actual time=3.023..3.024 rows=84898 loops=1)
              Index Cond: (close > '190.48'::double precision)
              Buffers: local read=235
Planning:
  Buffers: shared hit=3
Planning Time: 0.099 ms
Execution Time: 21.241 ms
```

In practice the rule is still the old one: if a cast has to exist, put it on the constant or parameter side, not on the indexed column.

## Date Functions and Half-Open Ranges

Date rewrites only pay off when an index exists on the date column being filtered. The next example adds that missing access path and then compares a function-wrapped predicate with a range predicate against the same indexed column.

```sql
CREATE INDEX note12_price_demo_date_idx
    ON note12_price_demo (price_date);

ANALYZE note12_price_demo;

EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT count(*)
FROM note12_price_demo
WHERE EXTRACT(YEAR FROM price_date) = 2026;
```

```text
CREATE INDEX
ANALYZE
Aggregate (actual time=15.201..15.203 rows=1 loops=1)
  Buffers: local read=2048
  ->  Seq Scan on note12_price_demo (actual time=0.089..14.909 rows=10956 loops=1)
        Filter: (EXTRACT(year FROM price_date) = '2026'::numeric)
        Rows Removed by Filter: 212154
        Buffers: local read=2048
Planning:
  Buffers: shared hit=14, local read=1
Planning Time: 0.090 ms
Execution Time: 15.217 ms
```

Even with a direct index on `price_date`, `EXTRACT(YEAR FROM price_date)` scans because the column is still wrapped in an expression.

Rewrite the same intent as a half-open range:

```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT count(*)
FROM note12_price_demo
WHERE price_date >= DATE '2026-01-01'
  AND price_date < DATE '2027-01-01';
```

```text
Aggregate (actual time=1.048..1.048 rows=1 loops=1)
  Buffers: local hit=130 read=150
  ->  Bitmap Heap Scan on note12_price_demo (actual time=0.149..0.777 rows=10956 loops=1)
        Recheck Cond: ((price_date >= '2026-01-01'::date) AND (price_date < '2027-01-01'::date))
        Heap Blocks: exact=268
        Buffers: local hit=130 read=150
        ->  Bitmap Index Scan on note12_price_demo_date_idx (actual time=0.130..0.131 rows=10956 loops=1)
              Index Cond: ((price_date >= '2026-01-01'::date) AND (price_date < '2027-01-01'::date))
              Buffers: local hit=2 read=10
Planning:
  Buffers: shared hit=3, local hit=1 read=2
Planning Time: 0.077 ms
Execution Time: 1.062 ms
```

This is the canonical rewrite for yearly, monthly, or rolling-window filters. The predicate stays on the raw indexed column, and the planner can turn it into a clean range condition.

> [!info] Timestamp boundaries
>
> The demo column here is `date`, but the same rewrite matters even more for `timestamp` and `timestamptz`. Half-open ranges avoid both function-wrapped scans and end-of-day correctness bugs.

## Boolean Shapes, `OR`, and Catch-All Predicates

Boolean predicates are where PostgreSQL diverges from the simplistic "any `OR` is bad" folklore. PostgreSQL can combine multiple B-tree branches with `BitmapOr` when the branches are independently indexable. The real danger is not the word `OR` by itself. It is ambiguous predicates that deny the planner a stable narrow path.

### `IN` and same-column `OR` both stay indexable

```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT count(*)
FROM note12_price_demo
WHERE symbol IN ('AAPL', 'MSFT', 'NVDA');
```

```text
Aggregate (actual time=0.495..0.496 rows=1 loops=1)
  Buffers: local hit=10 read=57
  ->  Bitmap Heap Scan on note12_price_demo (actual time=0.206..0.396 rows=3960 loops=1)
        Recheck Cond: (symbol = ANY ('{AAPL,MSFT,NVDA}'::text[]))
        Heap Blocks: exact=43
        Buffers: local hit=10 read=57
        ->  Bitmap Index Scan on note12_price_demo_symbol_date_idx (actual time=0.197..0.197 rows=3960 loops=1)
              Index Cond: (symbol = ANY ('{AAPL,MSFT,NVDA}'::text[]))
              Buffers: local hit=6 read=18
Planning:
  Buffers: shared hit=6
Planning Time: 0.054 ms
Execution Time: 0.517 ms
```

```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT count(*)
FROM note12_price_demo
WHERE symbol = 'AAPL'
   OR symbol = 'MSFT'
   OR symbol = 'NVDA';
```

```text
Aggregate (actual time=0.467..0.468 rows=1 loops=1)
  Buffers: local hit=67
  ->  Bitmap Heap Scan on note12_price_demo (actual time=0.175..0.360 rows=3960 loops=1)
        Recheck Cond: ((symbol = 'AAPL'::text) OR (symbol = 'MSFT'::text) OR (symbol = 'NVDA'::text))
        Heap Blocks: exact=43
        Buffers: local hit=67
        ->  BitmapOr (actual time=0.170..0.170 rows=0 loops=1)
              Buffers: local hit=24
              ->  Bitmap Index Scan on note12_price_demo_symbol_date_idx (actual time=0.047..0.047 rows=1320 loops=1)
                    Index Cond: (symbol = 'AAPL'::text)
              ->  Bitmap Index Scan on note12_price_demo_symbol_date_idx (actual time=0.079..0.079 rows=1320 loops=1)
                    Index Cond: (symbol = 'MSFT'::text)
              ->  Bitmap Index Scan on note12_price_demo_symbol_date_idx (actual time=0.043..0.043 rows=1320 loops=1)
                    Index Cond: (symbol = 'NVDA'::text)
Planning Time: 0.048 ms
Execution Time: 0.484 ms
```

`IN` is cleaner, but both forms remain indexable because each branch maps cleanly to the same indexed column.

### PostgreSQL can also combine different indexed columns with `BitmapOr`

```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT count(*)
FROM note12_price_demo
WHERE symbol = 'AAPL'
   OR volume > 100000000;
```

```text
Aggregate (actual time=0.752..0.752 rows=1 loops=1)
  Buffers: shared hit=3, local hit=107 read=167
  ->  Bitmap Heap Scan on note12_price_demo (actual time=0.165..0.597 rows=6388 loops=1)
        Recheck Cond: ((symbol = 'AAPL'::text) OR (volume > 100000000))
        Heap Blocks: exact=248
        Buffers: shared hit=3, local hit=107 read=167
        ->  BitmapOr (actual time=0.149..0.149 rows=0 loops=1)
              Buffers: shared hit=3, local hit=8 read=18
              ->  Bitmap Index Scan on note12_price_demo_symbol_date_idx (actual time=0.027..0.027 rows=1320 loops=1)
                    Index Cond: (symbol = 'AAPL'::text)
              ->  Bitmap Index Scan on note12_price_demo_volume_idx (actual time=0.121..0.121 rows=5239 loops=1)
                    Index Cond: (volume > 100000000)
Planning:
  Buffers: shared hit=6
Planning Time: 0.042 ms
Execution Time: 0.763 ms
```

That does not mean every `OR` is cheap. It means PostgreSQL is capable of combining multiple indexable branches. Treat `OR` as a plan-shape question, not an automatic anti-pattern.

### Broad negative predicates still scan

```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT count(*)
FROM note12_price_demo
WHERE symbol <> 'AAPL';
```

```text
Aggregate (actual time=18.720..18.721 rows=1 loops=1)
  Buffers: local hit=128 read=1920
  ->  Seq Scan on note12_price_demo (actual time=0.006..12.457 rows=221790 loops=1)
        Filter: (symbol <> 'AAPL'::text)
        Rows Removed by Filter: 1320
        Buffers: local hit=128 read=1920
Planning:
  Buffers: shared hit=2
Planning Time: 0.027 ms
Execution Time: 18.732 ms
```

This is the same lesson as in SQL Server, just with PostgreSQL operator names. A negative predicate that returns nearly the whole table does not become efficient merely because an index exists.

### Catch-all predicates are stable only with a custom plan

The classic optional-filter pattern still causes trouble:

```sql
PREPARE note12_catch_all(text) AS
SELECT count(*)
FROM note12_price_demo
WHERE $1 IS NULL OR symbol = $1;
```

With a forced custom plan, PostgreSQL sees the concrete parameter and simplifies to the narrow branch:

```sql
SET plan_cache_mode = force_custom_plan;

EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
EXECUTE note12_catch_all('AAPL');
```

```text
Aggregate (actual time=0.173..0.174 rows=1 loops=1)
  Buffers: local hit=4 read=20
  ->  Bitmap Heap Scan on note12_price_demo (actual time=0.064..0.137 rows=1320 loops=1)
        Recheck Cond: (symbol = 'AAPL'::text)
        Heap Blocks: exact=16
        Buffers: local hit=4 read=20
        ->  Bitmap Index Scan on note12_price_demo_symbol_date_idx (actual time=0.059..0.059 rows=1320 loops=1)
              Index Cond: (symbol = 'AAPL'::text)
Planning Time: 0.091 ms
Execution Time: 0.192 ms
```

With a forced generic plan, PostgreSQL must keep both meanings alive and the statement falls back to a full scan:

```sql
SET plan_cache_mode = force_generic_plan;

EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
EXECUTE note12_catch_all('AAPL');
```

```text
Aggregate (actual time=8.288..8.289 rows=1 loops=1)
  Buffers: local hit=13 read=2035
  ->  Seq Scan on note12_price_demo (actual time=2.713..8.253 rows=1320 loops=1)
        Filter: (($1 IS NULL) OR (symbol = $1))
        Rows Removed by Filter: 221790
        Buffers: local hit=13 read=2035
Planning Time: 0.047 ms
Execution Time: 8.301 ms
```

This is PostgreSQL's closest analogue to the catch-all problem from SQL Server. If one statement must mean both "return everything" and "return one key," generic planning loses the narrow access path.

## Expression and Partial Index Escape Hatches

Sometimes the business predicate is correct as written and should stay that way. In PostgreSQL the first escape hatch is usually an expression index, not a computed column. The second is a partial index, which is the direct analogue to a SQL Server filtered index.

### Expression indexes restore indexability for stable derived predicates

If case-insensitive lookup on `lower(symbol)` is a real workload, index that exact expression:

```sql
CREATE INDEX note12_price_demo_lower_symbol_idx
    ON note12_price_demo ((lower(symbol)));

ANALYZE note12_price_demo;

EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT count(*)
FROM note12_price_demo
WHERE lower(symbol) = 'aapl';
```

```text
CREATE INDEX
ANALYZE
Aggregate (actual time=0.124..0.125 rows=1 loops=1)
  Buffers: local hit=3 read=16
  ->  Bitmap Heap Scan on note12_price_demo (actual time=0.022..0.090 rows=1320 loops=1)
        Recheck Cond: (lower(symbol) = 'aapl'::text)
        Heap Blocks: exact=16
        Buffers: local hit=3 read=16
        ->  Bitmap Index Scan on note12_price_demo_lower_symbol_idx (actual time=0.016..0.016 rows=1320 loops=1)
              Index Cond: (lower(symbol) = 'aapl'::text)
              Buffers: local read=3
Planning:
  Buffers: shared hit=8, local read=1
Planning Time: 0.092 ms
Execution Time: 0.140 ms
```

That is the correct PostgreSQL fix when the derived expression is the workload, not just an accidental anti-pattern.

### Partial indexes target proven hot subsets

This partial index stores only rows from 2026 onward:

```sql
CREATE INDEX note12_price_demo_partial_recent_idx
    ON note12_price_demo (symbol, price_date)
    WHERE price_date >= DATE '2026-01-01';

ANALYZE note12_price_demo;

EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT count(*)
FROM note12_price_demo
WHERE symbol = 'AAPL'
  AND price_date >= DATE '2026-01-01'
  AND price_date < DATE '2026-02-01';
```

```text
CREATE INDEX
ANALYZE
Aggregate (actual time=0.013..0.014 rows=1 loops=1)
  Buffers: local read=3
  ->  Bitmap Heap Scan on note12_price_demo (actual time=0.010..0.011 rows=20 loops=1)
        Recheck Cond: ((symbol = 'AAPL'::text) AND (price_date < '2026-02-01'::date) AND (price_date >= '2026-01-01'::date))
        Heap Blocks: exact=1
        Buffers: local read=3
        ->  Bitmap Index Scan on note12_price_demo_partial_recent_idx (actual time=0.006..0.006 rows=20 loops=1)
              Index Cond: ((symbol = 'AAPL'::text) AND (price_date < '2026-02-01'::date))
              Buffers: local read=2
Planning:
  Buffers: shared hit=14, local read=1
Planning Time: 0.118 ms
Execution Time: 0.027 ms
```

Partial indexes are powerful precisely because they are narrow and workload-specific. Use them when the subset is stable enough that PostgreSQL can prove the query implies the partial predicate.

## Review Checklist and Summary

Use this checklist before calling a PostgreSQL query "mysteriously slow":

- Keep the indexed column bare so the predicate can stay under `Index Cond` instead of `Filter`.
- Check left-prefix alignment on composite B-trees before blaming the planner.
- Move functions, arithmetic, and casts to the literal or parameter side whenever possible.
- Rewrite calendar logic as half-open ranges on the raw date or timestamp column.
- Do not assume `OR` is always bad; inspect whether PostgreSQL built a `BitmapOr`.
- Treat `<>`, `NOT`, and catch-all optional filters as broad-result predicates unless the plan proves otherwise.
- Use expression indexes when the derived expression is the real workload.
- Use partial indexes only for narrow, stable subsets that queries can prove at planning time.

When the note's session is complete, close it cleanly:

```sql
DEALLOCATE ALL;
RESET plan_cache_mode;
ROLLBACK;
```
