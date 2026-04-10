---
title: "06 - Numeric and Aggregate Functions"
tags: [sql, sql-server, tsql, numeric-functions, aggregate-functions, count, sum, avg, round]
aliases: [math functions, aggregate reference, COUNT SUM AVG]
description: "T-SQL reference for SQL Server numeric functions, aggregate functions, rounding, ratios, divide-by-zero protection, and common analytical math patterns."
parent: "[[domain-query-writing-and-optimization]]"
links:
  - "[[01-select-and-query-basics]]"
  - "[[05-window-functions]]"
  - "[[02-data-types-conversion-and-null-handling]]"
created: 2026-04-08
updated: 2026-04-08
status: complete
---

# Numeric and Aggregate Functions

This note covers numeric calculation patterns that appear in ordinary T-SQL:

- aggregate functions
- scalar math functions
- ratios and percentages
- rounding rules
- divide-by-zero protection

## COUNT, COUNT_BIG, SUM, AVG, MIN, and MAX

### COUNT and COUNT_BIG

```sql
SELECT
    COUNT(*) AS row_count,
    COUNT_BIG(*) AS row_count_big
FROM silver.eurostoxx50_ohlcv;
```

Guidance:

- `COUNT(*)` counts rows.
- `COUNT(column)` counts non-null values in that column.
- `COUNT_BIG` is the bigint version for very large rowsets.

### SUM, AVG, MIN, and MAX

```sql
SELECT
    symbol,
    SUM(volume) AS total_volume,
    AVG([close]) AS avg_close,
    MIN([close]) AS min_close,
    MAX([close]) AS max_close
FROM silver.eurostoxx50_ohlcv
GROUP BY symbol;
```

Always confirm the business grain before aggregating. The wrong grouping level produces correct syntax and wrong numbers.

## ABS, SIGN, CEILING, FLOOR, and ROUND

### ABS and SIGN

```sql
SELECT
    ABS(-12.5) AS absolute_value,
    SIGN(-12.5) AS sign_value;
```

### CEILING, FLOOR, and ROUND

```sql
SELECT
    CEILING(12.34) AS rounded_up,
    FLOOR(12.34) AS rounded_down,
    ROUND(12.3456, 2) AS rounded_two_decimals;
```

Use cases:

- `CEILING` for upper bucket boundaries
- `FLOOR` for lower bucket boundaries
- `ROUND` for controlled presentation or business rounding

Do not round too early in multi-step calculations if later steps need full precision.

## POWER, SQUARE, SQRT, LOG, and EXP

```sql
SELECT
    POWER(2.0, 3.0) AS power_value,
    SQUARE(3.0) AS square_value,
    SQRT(16.0) AS square_root,
    LOG(100.0) AS natural_log,
    EXP(2.0) AS exp_value;
```

These functions are common in scoring, normalization, and analytics logic. Keep the output type in mind, especially when mixing integers and decimals.

## Percentages, Ratios, and Divide-by-Zero Safety

### Safe ratio pattern

```sql
SELECT
    numerator / NULLIF(denominator, 0.0) AS safe_ratio
FROM dbo.metrics;
```

This avoids runtime divide-by-zero failures and returns `NULL` instead.

### Percentage pattern

```sql
SELECT
    symbol,
    100.0 * volume / NULLIF(SUM(volume) OVER (PARTITION BY symbol), 0.0) AS pct_of_symbol_volume
FROM silver.eurostoxx50_ohlcv;
```

Use a decimal literal such as `100.0` when fractional precision is required. Integer arithmetic silently truncates.

## Aggregate Semantics That Matter

| Pattern | Meaning | Main caution |
|---|---|---|
| `COUNT(*)` | Count all rows | Includes rows where columns are null |
| `COUNT(col)` | Count non-null values | Ignores nulls |
| `AVG(int_col)` | Average integer values | Type and scale matter |
| `SUM(decimal_col)` | Sum decimal values | Prefer exact numeric types for financial logic |
| `MIN` / `MAX` | Lowest / highest value | Works on dates and strings too, not only numerics |

## Practical Guidance

- Use exact numeric types for money, ratios, and business-critical math.
- Protect divisions with `NULLIF`.
- Delay rounding until the business rule actually requires rounded output.
- Keep row grain and group grain explicit before aggregating.
- Use window aggregates when you need group context without collapsing rows.

## Related

- [[01-select-and-query-basics]]
- [[05-window-functions]]
- [[02-data-types-conversion-and-null-handling]]

