---
title: "01 - SELECT and Query Basics"
tags: [sql, sql-server, tsql, select, where, order-by, group-by, having, top, distinct]
aliases: [SELECT basics, query basics, projection and filtering, SQL query clauses]
description: "Core T-SQL query-shaping reference for SELECT, FROM, WHERE, ORDER BY, TOP, DISTINCT, GROUP BY, HAVING, CASE, and pagination patterns."
parent: "[[domain-query-writing-and-optimization]]"
links:
  - "[[03-joins-subqueries-and-apply]]"
  - "[[05-window-functions]]"
  - "[[06-numeric-and-aggregate-functions]]"
  - "[[02-data-types-conversion-and-null-handling]]"
  - "[[11-sargable-queries]]"
created: 2026-04-08
updated: 2026-04-08
status: complete
---

# SELECT and Query Basics

This note owns the core shape of a T-SQL query:

- how rows enter the query
- how columns are projected
- how rows are filtered
- how results are grouped and ordered
- how result size is limited or paged

It does not own join internals, window functions, or performance diagnostics. Those live in sibling notes.

## SELECT, FROM, WHERE, and ORDER BY

### SELECT list and column aliases

The `SELECT` list decides which columns or expressions appear in the result.

- Use explicit column names in production code.
- Alias computed expressions when the result is consumed by code, reports, or downstream SQL.
- Avoid `SELECT *` in application queries, views, and procedures because schema drift changes result shape unexpectedly.

```sql
SELECT
    symbol,
    [date],
    [close] AS close_price
FROM silver.eurostoxx50_ohlcv;
```

### FROM clause and table sources

The `FROM` clause decides where rows come from.

- base tables
- views
- derived tables
- common table expressions
- table-valued functions
- joins and `APPLY`

For readability, alias tables once and use the alias consistently.

```sql
SELECT
    o.symbol,
    o.[date],
    o.[close]
FROM silver.eurostoxx50_ohlcv AS o;
```

### WHERE clause and row filtering

`WHERE` filters rows before grouping.

- Use `WHERE` for row-level filters.
- Use `HAVING` only for group-level filters after aggregation.
- Keep predicates simple and SARGable when filtering indexed tables. See [[11-sargable-queries]].

```sql
SELECT
    symbol,
    [date],
    [close]
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'ASML.AS'
  AND [date] >= '2025-01-01'
  AND [date] < '2025-04-01';
```

### ORDER BY and deterministic ordering

`ORDER BY` is the only clause that guarantees result order.

- Without `ORDER BY`, SQL Server is free to return rows in any order.
- Always add a deterministic tie-breaker for pagination and top-N queries.
- `ORDER BY` belongs at the outermost query unless a subquery, CTE, or view also uses `TOP` or `OFFSET/FETCH`.

```sql
SELECT TOP (20)
    symbol,
    [date],
    [close]
FROM silver.eurostoxx50_ohlcv
ORDER BY [date] DESC, symbol ASC;
```

## TOP, WITH TIES, OFFSET, and FETCH

### TOP

`TOP` limits the number of rows returned.

- Use `TOP (n)` with `ORDER BY`.
- Treat `TOP` without `ORDER BY` as nondeterministic sampling, not business logic.

```sql
SELECT TOP (10)
    symbol,
    [date]
FROM silver.eurostoxx50_ohlcv
ORDER BY [date] DESC, symbol ASC;
```

### TOP WITH TIES

`WITH TIES` returns additional rows that match the last ordered value.

```sql
SELECT TOP (5) WITH TIES
    symbol,
    volume
FROM silver.eurostoxx50_ohlcv
ORDER BY volume DESC;
```

Use `WITH TIES` when "top 5 including ties" is the real business rule. Do not use it when the caller expects an exact row count.

### OFFSET and FETCH pagination

`OFFSET` and `FETCH` implement ordered pagination.

```sql
SELECT
    symbol,
    [date],
    [close]
FROM silver.eurostoxx50_ohlcv
ORDER BY [date] DESC, symbol ASC
OFFSET 50 ROWS
FETCH NEXT 25 ROWS ONLY;
```

Production guidance:

- Always include a stable tie-breaker in the `ORDER BY`.
- Prefer keyset pagination for very deep pages when latency matters.
- `OFFSET/FETCH` is simple for APIs and UIs, but later pages become more expensive because SQL Server must still walk past prior rows.

## DISTINCT, GROUP BY, and HAVING

### DISTINCT

`DISTINCT` removes duplicate result rows.

```sql
SELECT DISTINCT symbol
FROM silver.eurostoxx50_ohlcv
ORDER BY symbol;
```

Use `DISTINCT` only when duplicate elimination is truly part of the requirement. If duplicates appear unexpectedly, first ask whether the join or grouping logic is wrong.

### GROUP BY

`GROUP BY` collapses multiple rows into one row per grouping key.

```sql
SELECT
    symbol,
    COUNT(*) AS row_count,
    MIN([date]) AS first_date,
    MAX([date]) AS last_date
FROM silver.eurostoxx50_ohlcv
GROUP BY symbol;
```

Rules:

- Every selected column must either appear in `GROUP BY` or be wrapped in an aggregate.
- Group only on the real business grain.
- Grouping by too many columns often reproduces the original rowset instead of summarizing it.

### HAVING

`HAVING` filters groups after aggregation.

```sql
SELECT
    symbol,
    COUNT(*) AS row_count
FROM silver.eurostoxx50_ohlcv
GROUP BY symbol
HAVING COUNT(*) >= 1000;
```

Use `WHERE` for row filters and `HAVING` for aggregate filters. Do not move ordinary row conditions into `HAVING` unless the query truly requires post-aggregation logic.

## CASE, Conditional Projection, and Sorting Logic

### CASE expression

`CASE` is the core conditional expression in T-SQL.

- use it in `SELECT`
- use it in `ORDER BY`
- use it in grouped conditional aggregates
- do not use it to simulate control-of-flow between separate statements

```sql
SELECT
    symbol,
    volume,
    CASE
        WHEN volume >= 5000000 THEN 'high'
        WHEN volume >= 1000000 THEN 'medium'
        ELSE 'low'
    END AS volume_band
FROM silver.eurostoxx50_ohlcv;
```

### Conditional aggregation

```sql
SELECT
    symbol,
    SUM(CASE WHEN volume >= 1000000 THEN 1 ELSE 0 END) AS high_volume_days,
    SUM(CASE WHEN [close] >= [open] THEN 1 ELSE 0 END) AS up_days
FROM silver.eurostoxx50_ohlcv
GROUP BY symbol;
```

This pattern is usually clearer and more portable than multiple subqueries.

## Common Operators In Everyday Queries

### IN, NOT IN, BETWEEN, LIKE, IS NULL, and EXISTS

| Construct | Best use | Main caution |
|---|---|---|
| `IN` | Matching against a short list of values | Fine for positive membership tests |
| `NOT IN` | Exclusion against a trusted non-null set | `NULL` in the subquery changes semantics |
| `BETWEEN` | Inclusive range checks | Inclusive on both ends; avoid for datetime day windows |
| `LIKE 'abc%'` | Prefix matching | Leading wildcard `%abc` is not SARGable |
| `IS NULL` / `IS NOT NULL` | True null checks | Never use `= NULL` or `<> NULL` |
| `EXISTS` | Semi-joins and existence checks | Usually clearer than joining just to test existence |

Practical rule:

- For datetime ranges, prefer `>= start AND < next_boundary` instead of `BETWEEN`, because `BETWEEN` is inclusive and easy to misuse with time components.
- For exclusion subqueries, prefer `NOT EXISTS` over `NOT IN` when `NULL` values are possible.

## Query Writing Habits That Prevent Problems

### Use explicit column lists

Avoid:

```sql
SELECT *
FROM silver.eurostoxx50_ohlcv;
```

Prefer:

```sql
SELECT
    symbol,
    [date],
    [open],
    [high],
    [low],
    [close],
    volume
FROM silver.eurostoxx50_ohlcv;
```

### Make row limits deterministic

Avoid:

```sql
SELECT TOP (10) *
FROM silver.eurostoxx50_ohlcv;
```

Prefer:

```sql
SELECT TOP (10)
    symbol,
    [date],
    [close]
FROM silver.eurostoxx50_ohlcv
ORDER BY [date] DESC, symbol ASC;
```

### Filter early, aggregate late

Push row filters into `WHERE` whenever possible, then group the reduced rowset. This improves clarity and often reduces work.

## Related

- [[03-joins-subqueries-and-apply]]
- [[04-common-table-expressions-and-temporary-objects]]
- [[05-window-functions]]
- [[06-numeric-and-aggregate-functions]]
- [[02-data-types-conversion-and-null-handling]]
- [[11-sargable-queries]]

