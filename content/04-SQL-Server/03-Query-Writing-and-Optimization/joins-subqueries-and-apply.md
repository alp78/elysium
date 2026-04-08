---
title: "Joins, Subqueries, and APPLY"
tags: [sql, sql-server, tsql, joins, subqueries, exists, apply, union, intersect, except, pivot]
aliases: [JOIN reference, EXISTS and subqueries, CROSS APPLY, OUTER APPLY, set operators]
description: "T-SQL reference for INNER JOIN, OUTER JOIN, EXISTS, correlated subqueries, CROSS APPLY, OUTER APPLY, UNION, UNION ALL, EXCEPT, INTERSECT, and PIVOT patterns."
parent: "[[domain-query-writing-and-optimization]]"
links:
  - "[[select-and-query-basics]]"
  - "[[common-table-expressions-and-temporary-objects]]"
  - "[[window-functions]]"
  - "[[sargable-queries]]"
created: 2026-04-08
updated: 2026-04-08
status: complete
---

# Joins, Subqueries, and APPLY

This note owns row-combination patterns:

- joins between tables
- existence checks with subqueries
- row-wise derived sets with `CROSS APPLY` and `OUTER APPLY`
- set operators such as `UNION ALL`, `EXCEPT`, and `INTERSECT`

## INNER JOIN, LEFT JOIN, RIGHT JOIN, and FULL OUTER JOIN

### INNER JOIN

`INNER JOIN` keeps only matching rows from both sides.

```sql
SELECT
    s.symbol,
    s.[date],
    d.index_name
FROM silver.signals_daily AS s
JOIN silver.index_dim AS d
    ON s.index_code = d.index_code
WHERE d.is_current = 1;
```

Use `INNER JOIN` when unmatched rows should disappear from the result.

### LEFT JOIN

`LEFT JOIN` keeps all rows from the left side and adds matching right-side data when present.

```sql
SELECT
    d.index_code,
    d.index_name,
    p.score_date
FROM silver.index_dim AS d
LEFT JOIN gold.index_performance AS p
    ON d.index_code = p.index_code
WHERE d.is_current = 1;
```

Use `LEFT JOIN` when the left side is the required driving set.

### RIGHT JOIN and FULL OUTER JOIN

These are valid, but less common in production code.

- `RIGHT JOIN` is usually clearer when rewritten as `LEFT JOIN` with the tables reversed.
- `FULL OUTER JOIN` is useful for reconciliation and diff-style comparisons.

```sql
SELECT
    a.symbol AS left_symbol,
    b.symbol AS right_symbol
FROM staging.feed_a AS a
FULL OUTER JOIN staging.feed_b AS b
    ON a.symbol = b.symbol;
```

## CROSS JOIN and Self Join

### CROSS JOIN

`CROSS JOIN` returns the Cartesian product.

```sql
SELECT
    c.calendar_date,
    i.index_code
FROM dbo.calendar AS c
CROSS JOIN silver.index_dim AS i
WHERE i.is_current = 1;
```

Use it deliberately for calendar expansion, test grids, or dimensional scaffolding. Avoid accidental Cartesian products caused by missing join predicates.

### Self Join

Self joins let one row relate to another row in the same table.

```sql
SELECT
    cur.index_code,
    cur.index_name AS current_name,
    prev.index_name AS previous_name
FROM silver.index_dim AS cur
LEFT JOIN silver.index_dim AS prev
    ON cur.index_code = prev.index_code
   AND cur.valid_from = prev.valid_to
WHERE cur.is_current = 1;
```

## Subqueries, EXISTS, and Correlated Subqueries

### Scalar subquery

A scalar subquery must return at most one value.

```sql
SELECT
    index_code,
    (
        SELECT MAX(score_date)
        FROM gold.index_performance AS p
        WHERE p.index_code = d.index_code
    ) AS latest_score_date
FROM silver.index_dim AS d
WHERE d.is_current = 1;
```

Use this when exactly one derived value is needed per outer row.

### EXISTS and NOT EXISTS

`EXISTS` is often the cleanest way to express semi-joins.

```sql
SELECT
    d.index_code,
    d.index_name
FROM silver.index_dim AS d
WHERE d.is_current = 1
  AND EXISTS
  (
      SELECT 1
      FROM gold.index_performance AS p
      WHERE p.index_code = d.index_code
  );
```

Why `EXISTS` is important:

- It models existence directly.
- It avoids duplicate multiplication that can happen with joins.
- `NOT EXISTS` is safer than `NOT IN` when nulls are possible.

### Correlated subquery

A correlated subquery references columns from the outer query.

```sql
SELECT
    s.symbol,
    s.[date],
    s.[close]
FROM silver.eurostoxx50_ohlcv AS s
WHERE s.[close] >
(
    SELECT AVG(s2.[close])
    FROM silver.eurostoxx50_ohlcv AS s2
    WHERE s2.symbol = s.symbol
);
```

Correlated subqueries can be elegant, but they are not always the clearest or fastest option. Consider window functions when the same partition-level calculation is needed for many rows.

## CROSS APPLY and OUTER APPLY

### CROSS APPLY

`CROSS APPLY` joins each left-side row to a derived right-side result that can reference the left row.

```sql
SELECT
    d.index_code,
    x.latest_score_date,
    x.latest_score
FROM silver.index_dim AS d
CROSS APPLY
(
    SELECT TOP (1)
        p.score_date AS latest_score_date,
        p.index_score AS latest_score
    FROM gold.index_performance AS p
    WHERE p.index_code = d.index_code
    ORDER BY p.score_date DESC
) AS x
WHERE d.is_current = 1;
```

Best use cases:

- top 1 per parent row
- row-wise expansion from table-valued functions
- replacing awkward correlated subqueries with clearer row-wise logic

### OUTER APPLY

`OUTER APPLY` is the `LEFT JOIN` version of `CROSS APPLY`.

```sql
SELECT
    d.index_code,
    x.latest_score_date,
    x.latest_score
FROM silver.index_dim AS d
OUTER APPLY
(
    SELECT TOP (1)
        p.score_date AS latest_score_date,
        p.index_score AS latest_score
    FROM gold.index_performance AS p
    WHERE p.index_code = d.index_code
    ORDER BY p.score_date DESC
) AS x
WHERE d.is_current = 1;
```

Use `OUTER APPLY` when unmatched left-side rows must still appear.

## UNION, UNION ALL, EXCEPT, and INTERSECT

### UNION ALL

`UNION ALL` appends rowsets and keeps duplicates.

```sql
SELECT symbol, [date], [close]
FROM silver.eurostoxx50_ohlcv
UNION ALL
SELECT symbol, [date], [close]
FROM silver.stoxxusa50_ohlcv;
```

Prefer `UNION ALL` by default when duplicate removal is not part of the requirement.

### UNION

`UNION` appends rowsets and removes duplicates.

```sql
SELECT symbol
FROM silver.eurostoxx50_ohlcv
UNION
SELECT symbol
FROM silver.stoxxusa50_ohlcv;
```

`UNION` adds a distinct-sort or hashing step. Use it only when deduplication is required.

### EXCEPT

`EXCEPT` returns rows from the first query that do not appear in the second.

```sql
SELECT symbol
FROM silver.eurostoxx50_ohlcv
EXCEPT
SELECT symbol
FROM silver.stoxxusa50_ohlcv;
```

### INTERSECT

`INTERSECT` returns rows common to both queries.

```sql
SELECT symbol
FROM silver.eurostoxx50_ohlcv
INTERSECT
SELECT symbol
FROM silver.stoxxusa50_ohlcv;
```

## PIVOT and UNPIVOT

### PIVOT

`PIVOT` turns row values into columns.

```sql
SELECT *
FROM
(
    SELECT symbol, YEAR([date]) AS trade_year, volume
    FROM silver.eurostoxx50_ohlcv
) AS src
PIVOT
(
    SUM(volume)
    FOR trade_year IN ([2023], [2024], [2025])
) AS p;
```

`PIVOT` is useful for fixed-column reporting outputs, but conditional aggregation is often simpler and easier to maintain.

### UNPIVOT

`UNPIVOT` turns columns into rows. Use it when a wide source must become a normalized rowset before downstream processing.

## Practical Join Rules

- Join on matching data types whenever possible.
- Put the full join predicate in the `ON` clause.
- For outer joins, filters on the right table in the `WHERE` clause can turn the logic back into an inner join.
- Use `EXISTS` when the goal is existence, not row multiplication.
- Prefer `UNION ALL` unless you explicitly need duplicate removal.
- Use `APPLY` for row-wise top-N and correlated rowset expansion when it makes the logic clearer than nested subqueries.

## Related

- [[select-and-query-basics]]
- [[common-table-expressions-and-temporary-objects]]
- [[window-functions]]
- [[sargable-queries]]

