---
title: "01 - SELECT and Query Basics"
tags:
  - postgresql
  - query-optimization
  - sql
aliases:
  - PostgreSQL SELECT basics
  - LIMIT and OFFSET
  - DISTINCT ON
description: "Core PostgreSQL query-shaping reference for clause order, alias visibility, projection, ordering, LIMIT/OFFSET, DISTINCT ON, GROUP BY, FILTER, and first-pass EXPLAIN interpretation."
parent: "[[domain-postgresql-query-writing-and-optimization]]"
links:
  - "[[01-postgresql-server-configuration]]"
  - "[[01-postgresql-storage-and-schema-surface]]"
  - "[[02-postgresql-data-types-conversion-and-null-handling]]"
status: complete
---

# SELECT and Query Basics

PostgreSQL query writing starts with clause semantics, not just syntax order. The live `stoxx` database makes it possible to teach that boundary on real market data: output aliases appear late, `ORDER BY` and `LIMIT` only make sense with deterministic sort keys, PostgreSQL adds features such as `DISTINCT ON` and aggregate `FILTER`, and the planner will only be as selective as the available indexes and statistics allow.

> [!abstract]- Summary
>
> This note mirrors the SQL Server query-basics track, but with PostgreSQL semantics and PostgreSQL-specific operators. The goal is to establish the core query surface before later notes move deeper into joins, windows, CTEs, indexing strategy, and `EXPLAIN (ANALYZE, BUFFERS)`.
>
> **Logical processing and alias visibility**
> - shows why a `SELECT` alias can be reused in `ORDER BY` but not directly in `WHERE`, and how to promote the computation into a derived table when earlier filtering must see it
>
> **Core query shape**
> - covers explicit projection, deterministic ordering, `LIMIT`, `OFFSET`, and PostgreSQL's `DISTINCT ON` pattern for "latest row per key" queries
>
> **Aggregation**
> - covers `GROUP BY`, `HAVING`, and PostgreSQL's `FILTER` syntax for conditional aggregates without forcing a `CASE` expression into every aggregate
>
> **Planner baseline**
> - grounds the first `EXPLAIN` reading on a real table from the migrated dataset and shows that current plans are shaped by the fact that the table has only a surrogate-key primary index, not a business-key index on `symbol` and `date`

## Logical Query Processing

The practical rule is simple: clauses can only reference objects that already exist at their stage of query evaluation. PostgreSQL follows the standard logical pattern of building row sources, filtering, grouping, projecting, ordering, and only then trimming the final rowset with `LIMIT` and `OFFSET`.

### Alias visibility and clause order

This subsection makes the evaluation-order boundary concrete. The same computed alias is legal in `ORDER BY`, illegal in `WHERE`, and safe again once it has been promoted into a derived table.

#### Reuse a computed alias in `ORDER BY`

Use this pattern whenever a computed expression belongs in the final output and the result must be ordered by that same computation. It is typically triggered by ranked reporting, top-N slices, or any query where a calculation should both be displayed and used as the sort key. The query runs read-only against `silver.stoxxusa50_ohlcv`. Its purpose is to show that `ORDER BY` can see a `SELECT` alias because the output column already exists by the time sorting happens.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | `silver.stoxxusa50_ohlcv.symbol` | varchar | Equity ticker. |
| `date` | `silver.stoxxusa50_ohlcv.date` | date | Trading date. |
| `close` | `silver.stoxxusa50_ohlcv.close` | double precision | Closing price. |
| `volume` | `silver.stoxxusa50_ohlcv.volume` | bigint | Daily traded volume. |
| `notional` | computed `close * volume` | numeric-like expression | Closing notional used for ranking. |

*This query ranks AAPL trading days by computed notional and orders directly by the `SELECT` alias.*

```sql
SELECT
    symbol,
    date,
    close,
    volume,
    close * volume AS notional
FROM silver.stoxxusa50_ohlcv
WHERE symbol = 'AAPL'
ORDER BY notional DESC, date DESC
LIMIT 5;
```

| symbol | date | close | volume | notional |
|---|---|---:|---:|---:|
| AAPL | 2024-09-20 | 228.2 | 318679900 | 72722753180 |
| AAPL | 2024-06-21 | 207.49 | 241805100 | 50172140199 |
| AAPL | 2024-06-12 | 213.07 | 198134300 | 42216475301 |
| AAPL | 2025-09-19 | 245.5 | 163741300 | 40198489150 |
| AAPL | 2025-12-19 | 273.67 | 144632000 | 39581439440 |

The query works because `ORDER BY` sees the projected column list, including `notional`. That makes alias reuse in `ORDER BY` a safe readability improvement when the computed value already belongs in the output.

#### Do not reference that alias directly from `WHERE`

Use this example as a boundary marker during query review, not as a production pattern. It is typically triggered by an engineer trying to avoid repeating an expression inside an earlier clause. The query is read-only, but it fails at parse/bind time. Its purpose is to show the exact PostgreSQL error that appears when `WHERE` tries to reference a `SELECT` alias that has not been produced yet.

*This query fails because `WHERE` cannot see the output alias `notional`.*

```sql
SELECT
    symbol,
    close * volume AS notional
FROM silver.stoxxusa50_ohlcv
WHERE notional > 40000000000
LIMIT 5;
```

```text
ERROR:  column "notional" does not exist
LINE 4: WHERE notional > 40000000000
              ^
```

The failure is not specific to this table. `WHERE` operates before output aliases exist, so the fix is to repeat the expression or to move the computation into a subquery, derived table, or CTE that creates a real column boundary.

#### Promote the computation into a derived table when earlier filtering must see it

Use this pattern when the same computed value must be both filtered and returned, and repeating the expression inline would hurt readability or maintainability. It is typically triggered by complex ranking, financial calculations, or reusable derived metrics. The query remains read-only. Its purpose is to turn the computed alias into a real column of a derived table so the outer `WHERE` can safely use it.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | inner query output | varchar | Ticker carried out of the derived table. |
| `date` | inner query output | date | Trading date carried out of the derived table. |
| `notional` | inner query output | numeric-like expression | Computed measure made visible to the outer query. |

*This query makes `notional` filterable by creating it inside a derived table first.*

```sql
SELECT
    symbol,
    date,
    notional
FROM
(
    SELECT
        symbol,
        date,
        close * volume AS notional
    FROM silver.stoxxusa50_ohlcv
    WHERE symbol = 'AAPL'
) AS q
WHERE notional > 40000000000
ORDER BY notional DESC, date DESC
LIMIT 5;
```

| symbol | date | notional |
|---|---|---:|
| AAPL | 2024-09-20 | 72722753180 |
| AAPL | 2024-06-21 | 50172140199 |
| AAPL | 2024-06-12 | 42216475301 |
| AAPL | 2025-09-19 | 40198489150 |

The outer query now sees `notional` as an actual input column, not as a late output alias. That is the clean PostgreSQL equivalent of "calculate once, filter later" without violating clause order.

## Core Query Shape

Once alias visibility is clear, the next task is shaping the rowset predictably. In PostgreSQL that means explicit projection, stable `ORDER BY`, careful `LIMIT` and `OFFSET`, and knowing when `DISTINCT ON` is a better fit than a more complicated grouping or window-expression pattern.

### Projection, ordering, and row limiting

The point of these examples is not the syntax itself but the operational rule behind it: if the result order matters, the query must state a deterministic ordering before it applies `LIMIT` or `OFFSET`.

#### Return a deterministic top slice with `LIMIT`

Use this pattern when a query needs the first N rows of a business-defined order, not just any N rows the planner happens to produce. It is typically triggered by recent-activity dashboards, preview queries, and validation checks in notebooks or shell sessions. The query is read-only. Its purpose is to demonstrate the correct order-first, limit-second posture on a real table.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | `silver.stoxxusa50_ohlcv.symbol` | varchar | Equity ticker. |
| `date` | `silver.stoxxusa50_ohlcv.date` | date | Trading date. |
| `close` | `silver.stoxxusa50_ohlcv.close` | double precision | Closing price. |

*This query returns the first five rows from a deterministic descending date order.*

```sql
SELECT
    symbol,
    date,
    close
FROM silver.stoxxusa50_ohlcv
WHERE date >= DATE '2026-04-01'
ORDER BY date DESC, symbol
LIMIT 5;
```

| symbol | date | close |
|---|---|---:|
| AAPL | 2026-04-07 | 253.5 |
| ABBV | 2026-04-07 | 206.37 |
| AMAT | 2026-04-07 | 354.31 |
| AMD | 2026-04-07 | 221.53 |
| AMZN | 2026-04-07 | 213.77 |

The deterministic part is `ORDER BY date DESC, symbol`, not the `LIMIT 5`. Without that sort key, PostgreSQL would still return five rows, but there would be no guaranteed meaning to which five arrived.

#### Paginate with `OFFSET`, but treat deep offsets as a convenience pattern

Use `OFFSET` when the data slice is modest and the requirement is simple page navigation rather than high-performance deep traversal. It is typically triggered by admin consoles, ad-hoc exploration, or small report pages. The query is read-only. Its purpose is to show that PostgreSQL can paginate this way, while reminding the reader that skipped rows still have to be processed inside the server.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | `silver.stoxxusa50_ohlcv.symbol` | varchar | Equity ticker. |
| `date` | `silver.stoxxusa50_ohlcv.date` | date | Trading date. |
| `close` | `silver.stoxxusa50_ohlcv.close` | double precision | Closing price. |

*This query skips the first ten rows of the ordered slice and returns the next five.*

```sql
SELECT
    symbol,
    date,
    close
FROM silver.stoxxusa50_ohlcv
WHERE date >= DATE '2026-04-01'
ORDER BY date DESC, symbol
LIMIT 5
OFFSET 10;
```

| symbol | date | close |
|---|---|---:|
| COST | 2026-04-07 | 1013.21 |
| CRM | 2026-04-07 | 182.96 |
| CSCO | 2026-04-07 | 80.68 |
| CVX | 2026-04-07 | 201.54 |
| GE | 2026-04-07 | 288.6 |

This is a clean demonstration of the syntax, but it is not the best long-range pagination strategy. PostgreSQL still computes the skipped rows, so deep offsets eventually become wasteful. Later notes should introduce keyset pagination when result sets get large or volatile.

#### Use `DISTINCT ON` for "latest row per key" queries

Use this PostgreSQL-specific pattern when the real question is "give me the first ordered row for each key" and the key is explicit in the query. It is typically triggered by latest-status lookups, one-row-per-symbol snapshots, or deduplicated event feeds. The query is read-only. Its purpose is to show a PostgreSQL feature that often replaces more verbose window-function or grouped-subquery patterns.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | `silver.stoxxusa50_ohlcv.symbol` | varchar | Deduplication key. |
| `date` | `silver.stoxxusa50_ohlcv.date` | date | Row-selection order within each symbol. |
| `close` | `silver.stoxxusa50_ohlcv.close` | double precision | Returned measure from the selected row. |

*This query returns the latest row per symbol by using `DISTINCT ON (symbol)` with the correct ordering.*

```sql
SELECT DISTINCT ON (symbol)
    symbol,
    date,
    close
FROM silver.stoxxusa50_ohlcv
ORDER BY symbol, date DESC
LIMIT 5;
```

| symbol | date | close |
|---|---|---:|
| AAPL | 2026-04-07 | 253.5 |
| ABBV | 2026-04-07 | 206.37 |
| AMAT | 2026-04-07 | 354.31 |
| AMD | 2026-04-07 | 221.53 |
| AMZN | 2026-04-07 | 213.77 |

The crucial rule is that the `ORDER BY` must begin with the `DISTINCT ON` key and then express which row wins within each key. Here that means "group by symbol, then keep the newest date first."

## Aggregation and Conditional Projection

Aggregates are where row-grain changes become operationally important. PostgreSQL follows the same core rules as other relational systems, but it adds the `FILTER` clause, which often makes conditional aggregation clearer than embedding every condition inside `CASE`.

### `GROUP BY`, `HAVING`, and aggregate `FILTER`

The queries below show the two main questions engineers ask repeatedly: how to keep only sufficiently populated groups, and how to count conditioned subsets without obscuring the aggregate logic.

#### Keep only groups that satisfy a post-aggregation rule

Use this pattern when the query must first collapse rows by key and only then decide which groups remain interesting. It is typically triggered by completeness checks, rolling-window summaries, and threshold-based reporting. The query is read-only. Its purpose is to show the proper role of `HAVING`: it filters groups after `GROUP BY` has already changed the row grain.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | grouping key | varchar | Instrument ticker. |
| `avg_close` | `AVG(close)` | numeric | Average closing price over the filtered date window. |
| `days_in_window` | `COUNT(*)` | bigint | Number of qualifying trading days contributing to the average. |

*This query keeps only symbols with at least 25 rows in the March 2026 window and ranks them by average close.*

```sql
SELECT
    symbol,
    ROUND(AVG(close)::numeric, 2) AS avg_close,
    COUNT(*) AS days_in_window
FROM silver.stoxxusa50_ohlcv
WHERE date >= DATE '2026-03-01'
GROUP BY symbol
HAVING COUNT(*) >= 25
ORDER BY avg_close DESC, symbol
LIMIT 5;
```

| symbol | avg_close | days_in_window |
|---|---:|---:|
| COST | 993.99 | 26 |
| LLY | 949.86 | 26 |
| GS | 829.98 | 26 |
| CAT | 707.20 | 26 |
| META | 608.91 | 26 |

`HAVING COUNT(*) >= 25` is the key boundary here. The date predicate belongs in `WHERE` because it filters base rows, while the completeness rule belongs in `HAVING` because it only makes sense after the groups exist.

#### Use `FILTER` for explicit conditional aggregates

Use this PostgreSQL feature when a grouped query needs multiple counts or sums over different conditional slices of the same input. It is typically triggered by quality checks, KPI splits, and bucketed summary rows. The query is read-only. Its purpose is to demonstrate that PostgreSQL can express conditional aggregation directly on the aggregate itself instead of forcing a `CASE` expression into every count.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | grouping key | varchar | Instrument ticker. |
| `closes_at_or_above_300` | `COUNT(*) FILTER (WHERE close >= 300)` | bigint | Number of rows at or above the threshold. |
| `closes_below_300` | `COUNT(*) FILTER (WHERE close < 300)` | bigint | Number of rows below the threshold. |

*This query counts two conditional subsets per symbol by using aggregate `FILTER` clauses.*

```sql
SELECT
    symbol,
    COUNT(*) FILTER (WHERE close >= 300) AS closes_at_or_above_300,
    COUNT(*) FILTER (WHERE close < 300) AS closes_below_300
FROM silver.stoxxusa50_ohlcv
WHERE date >= DATE '2026-01-01'
GROUP BY symbol
ORDER BY closes_at_or_above_300 DESC, symbol
LIMIT 5;
```

| symbol | closes_at_or_above_300 | closes_below_300 |
|---|---:|---:|
| BRK-B | 65 | 0 |
| CAT | 65 | 0 |
| COST | 65 | 0 |
| GS | 65 | 0 |
| HD | 65 | 0 |

This is semantically the same idea many systems express through `SUM(CASE WHEN ... THEN 1 ELSE 0 END)`, but PostgreSQL's `FILTER` syntax is more direct when the aggregate logic is the real focus.

## Planner Baseline

Query writing and planning are not separate worlds. The predicates you write, the indexes that exist, and the statistics PostgreSQL has available all shape the plan. The current migrated table is a good teaching example because it shows a very common early-state reality: a surrogate-key primary index exists, but the business filter columns do not yet have a dedicated index.

### Current index reality and first-pass `EXPLAIN`

The point here is not that sequential scans are always wrong. It is that plan reading only makes sense when the reader also knows what access paths are actually available.

#### Inspect the current index surface of `silver.stoxxusa50_ohlcv`

Use this query before interpreting a plan or before assuming that PostgreSQL "should have used an index". It is typically triggered by plan review, slow-query triage, or a teaching step that needs to separate planner choice from index availability. The query reads `pg_indexes`. It is read-only. Its purpose is to show the current index definitions that the planner can consider.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `indexname` | `pg_indexes.indexname` | name | Name of the index. |
| `indexdef` | `pg_indexes.indexdef` | text | Full DDL definition of the index. |

*This query shows the current index surface of the main silver OHLCV table used in the examples above.*

```sql
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'silver'
  AND tablename = 'stoxxusa50_ohlcv'
ORDER BY indexname;
```

| indexname | indexdef |
|---|---|
| stoxxusa50_ohlcv_pkey | CREATE UNIQUE INDEX stoxxusa50_ohlcv_pkey ON silver.stoxxusa50_ohlcv USING btree (id) |

The only available index is the primary key on `id`. That means queries filtering by `symbol` and `date` have no dedicated business-key access path yet, so a sequential scan is the planner's expected baseline rather than evidence of planner failure.

#### Read the first `EXPLAIN` plan against the current table shape

Use this query when the goal is to understand how PostgreSQL intends to execute a filtered and ordered statement before changing anything. It is typically triggered by the first performance review of a query, by an index-design discussion, or by note writing that must connect SQL shape to plan shape. The statement is read-only and uses `EXPLAIN` without `ANALYZE`, so the underlying query is not executed. Its purpose is to show how PostgreSQL currently plans a business filter on a table that lacks a matching business-key index.

> [!info]- Plan nodes in this output
>
> - `Seq Scan` means PostgreSQL plans to read the table sequentially and apply the filter row by row.
> - `Sort` means the filtered rows must be sorted explicitly because no existing index already supplies the requested ordering.
> - `Limit` trims the sorted result down to the first five rows only after the earlier nodes have produced an ordered stream.
>
> *This `EXPLAIN` shows the current plan for a filtered and ordered slice of `silver.stoxxusa50_ohlcv`.*

```sql
EXPLAIN (COSTS ON)
SELECT
    symbol,
    date,
    close,
    volume
FROM silver.stoxxusa50_ohlcv
WHERE symbol = 'AAPL'
  AND date >= DATE '2025-01-01'
ORDER BY date DESC
LIMIT 5;
```

```text
Limit  (cost=1995.51..1995.53 rows=5 width=24)
  ->  Sort  (cost=1995.51..1996.34 rows=332 width=24)
        Sort Key: date DESC
        ->  Seq Scan on stoxxusa50_ohlcv  (cost=0.00..1990.00 rows=332 width=24)
              Filter: ((date >= '2025-01-01'::date) AND ((symbol)::text = 'AAPL'::text))
```

This is a healthy first plan for the current schema, not a surprise. PostgreSQL scans because no `symbol,date` index exists, sorts because no index provides `date DESC` order, and only then applies `LIMIT 5`. Later notes should revisit the same query after an index strategy exists, because only then does it become meaningful to ask whether the planner is missing an index-friendly access path.

## Query-Writing Habits That Prevent Problems

The safest baseline for PostgreSQL query authors is still simple and disciplined.

### Default habits for this chapter

- Always pair `LIMIT` or `OFFSET` with a deterministic `ORDER BY`, ideally with an explicit tie-breaker.
- Treat output aliases as late-stage names. If earlier clauses need them, create a derived table or CTE boundary.
- Prefer `DISTINCT ON` only when the grouping key and winning-row order are both explicit and easy to read.
- Keep row filters in `WHERE` and group filters in `HAVING`; do not move base-row predicates into `HAVING` just because the query already groups.
- Read `EXPLAIN` in the context of real index availability. A sequential scan on an unindexed business predicate is often the correct starting plan.
