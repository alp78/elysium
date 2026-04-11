---
title: "05 - Window Functions"
tags: [sql, sql-server, tsql, over, partition-by, row-number, rank, lag, lead, running-total]
aliases: [OVER clause, analytic functions, ranking functions, LAG LEAD]
description: "T-SQL reference for the OVER clause, PARTITION BY, ORDER BY, ranking functions, LAG/LEAD, FIRST_VALUE/LAST_VALUE, running totals, moving averages, and window frames."
created: 2026-04-08
updated: 2026-04-08
status: complete
---

# Window Functions

Window functions compute values across a logical window of rows without collapsing the result to one row per group.

Use them when you need:

- ranking
- top N per group
- running totals
- moving averages
- prior-row and next-row comparisons
- group statistics while still keeping each original row

## OVER, PARTITION BY, and ORDER BY

### OVER clause

Every window function uses `OVER (...)`.

```sql
SELECT
    symbol,
    [date],
    [close],
    AVG([close]) OVER (PARTITION BY symbol) AS avg_close_per_symbol
FROM silver.eurostoxx50_ohlcv;
```

### PARTITION BY

`PARTITION BY` defines the logical group.

- similar to `GROUP BY` in grouping intent
- unlike `GROUP BY`, it keeps each original row

### ORDER BY inside OVER

`ORDER BY` inside the window defines sequence-sensitive behavior.

- required for ranking and row navigation functions
- usually required for running totals and moving windows

```sql
SELECT
    symbol,
    [date],
    [close],
    ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY [date] DESC) AS rn
FROM silver.eurostoxx50_ohlcv;
```

## ROW_NUMBER, RANK, DENSE_RANK, and NTILE

### ROW_NUMBER

`ROW_NUMBER()` gives a unique sequence within each partition.

```sql
SELECT
    symbol,
    [date],
    [close],
    ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY [date] DESC) AS rn
FROM silver.eurostoxx50_ohlcv;
```

Best use:

- latest row per key
- top N per group
- pagination in derived result sets

### RANK and DENSE_RANK

Use these when ties matter.

```sql
SELECT
    symbol,
    [date],
    volume,
    RANK() OVER (PARTITION BY symbol ORDER BY volume DESC) AS volume_rank,
    DENSE_RANK() OVER (PARTITION BY symbol ORDER BY volume DESC) AS volume_dense_rank
FROM silver.eurostoxx50_ohlcv;
```

Difference:

- `RANK()` leaves gaps after ties
- `DENSE_RANK()` does not leave gaps

### NTILE

`NTILE(n)` breaks the ordered partition into buckets.

```sql
SELECT
    symbol,
    [date],
    volume,
    NTILE(4) OVER (PARTITION BY symbol ORDER BY volume DESC) AS volume_quartile
FROM silver.eurostoxx50_ohlcv;
```

## LAG, LEAD, FIRST_VALUE, and LAST_VALUE

### LAG and LEAD

`LAG` looks backward and `LEAD` looks forward without a self join.

```sql
SELECT
    symbol,
    [date],
    [close],
    LAG([close]) OVER (PARTITION BY symbol ORDER BY [date]) AS prev_close,
    LEAD([close]) OVER (PARTITION BY symbol ORDER BY [date]) AS next_close
FROM silver.eurostoxx50_ohlcv;
```

Common uses:

- day-over-day change
- previous status comparison
- detecting gaps or reversals

### FIRST_VALUE and LAST_VALUE

These return a value from the start or end of the window frame.

```sql
SELECT
    symbol,
    [date],
    [close],
    FIRST_VALUE([close]) OVER
    (
        PARTITION BY symbol
        ORDER BY [date]
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS first_close,
    LAST_VALUE([close]) OVER
    (
        PARTITION BY symbol
        ORDER BY [date]
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS last_close
FROM silver.eurostoxx50_ohlcv;
```

Important gotcha:

- `LAST_VALUE` surprises many users if the frame is not widened beyond the current row.

## SUM OVER, AVG OVER, and Running Totals

### Running total

```sql
SELECT
    symbol,
    [date],
    volume,
    SUM(volume) OVER
    (
        PARTITION BY symbol
        ORDER BY [date]
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_volume
FROM silver.eurostoxx50_ohlcv;
```

### Moving average

```sql
SELECT
    symbol,
    [date],
    [close],
    AVG([close]) OVER
    (
        PARTITION BY symbol
        ORDER BY [date]
        ROWS BETWEEN 4 PRECEDING AND CURRENT ROW
    ) AS moving_avg_5
FROM silver.eurostoxx50_ohlcv;
```

## ROWS and RANGE Window Frames

### ROWS

`ROWS` counts physical rows relative to the current row.

Use it when you want a fixed number of neighboring rows.

### RANGE

`RANGE` groups peers with equal order-by values and has more subtle semantics.

Production rule:

- Prefer `ROWS` unless you explicitly need `RANGE`.
- `ROWS` is easier to reason about for running totals and moving windows.

## Top N Per Group

This is one of the most common practical window-function patterns.

```sql
;WITH ranked AS
(
    SELECT
        symbol,
        [date],
        [close],
        ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY [date] DESC) AS rn
    FROM silver.eurostoxx50_ohlcv
)
SELECT
    symbol,
    [date],
    [close]
FROM ranked
WHERE rn <= 3;
```

Use this instead of correlated `TOP (1)` subqueries when you need multiple rows per group or when the ranking logic must remain explicit.

## Practical Guidance

- Use window functions when you need both row-level detail and group-level context.
- Prefer them over self joins for prior/next row access.
- Add deterministic ordering inside the window.
- Be explicit about frames for running totals and `LAST_VALUE`.
- Use `ROW_NUMBER()` plus a CTE or derived table for top-N-per-group patterns.


