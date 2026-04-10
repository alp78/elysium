---
title: "02 - Data Types, Conversion, and Null Handling"
tags: [sql, sql-server, tsql, data-types, cast, convert, try-convert, null, case, coalesce, isnull]
aliases: [type conversion, null handling, CAST CONVERT, TRY_CAST, COALESCE, CASE]
description: "T-SQL reference for SQL Server data types, type precedence, CAST and CONVERT, TRY_CAST and TRY_CONVERT, PARSE, NULL semantics, CASE, ISNULL, COALESCE, NULLIF, IIF, and CHOOSE."
parent: "[[domain-query-writing-and-optimization]]"
links:
  - "[[07-string-functions-and-pattern-matching]]"
  - "[[08-date-and-time-functions]]"
  - "[[11-sargable-queries]]"
created: 2026-04-08
updated: 2026-04-08
status: complete
---

# Data Types, Conversion, and Null Handling

Many T-SQL bugs are not syntax bugs. They come from:

- the wrong data type
- silent implicit conversions
- misunderstood null semantics
- presentation formatting mixed into business logic

## Core SQL Server Data Type Families

### Numeric, character, date/time, binary, and uniqueidentifier

| Family | Common types | Main use |
|---|---|---|
| Exact numeric | `bit`, `tinyint`, `smallint`, `int`, `bigint`, `decimal`, `numeric` | Counts, keys, monetary-safe arithmetic |
| Approximate numeric | `real`, `float` | Scientific or approximate calculations |
| Character | `char`, `varchar` | Non-Unicode text |
| Unicode character | `nchar`, `nvarchar` | Unicode and multilingual text |
| Date/time | `date`, `time`, `datetime2`, `datetimeoffset` | Temporal values |
| Binary | `binary`, `varbinary` | Raw binary payloads |
| Identifier | `uniqueidentifier` | GUID-based identifiers |

Practical rule:

- Prefer `decimal` over `float` for financial or deterministic numeric logic.
- Prefer `datetime2` over legacy `datetime` for new schema.
- Match parameter types to column types.

## CAST, CONVERT, TRY_CAST, and TRY_CONVERT

### CAST and CONVERT

Use `CAST` and `CONVERT` for explicit type conversion.

```sql
SELECT
    CAST([close] AS decimal(18,4)) AS close_price,
    CONVERT(char(10), [date], 23) AS iso_date
FROM silver.eurostoxx50_ohlcv;
```

Use `CAST` when style codes are not needed. Use `CONVERT` when SQL Server style formatting matters.

### TRY_CAST and TRY_CONVERT

These return `NULL` instead of throwing on conversion failure.

```sql
SELECT
    TRY_CONVERT(int, raw_value) AS raw_value_int
FROM staging.raw_feed;
```

Use them at ingestion boundaries and data-quality cleanup steps. Do not quietly rely on them in core business joins unless `NULL` on failure is truly the intended behavior.

### PARSE and TRY_PARSE

`PARSE` uses CLR and culture-aware parsing.

Practical rule:

- Prefer `CAST`/`CONVERT`/`TRY_CONVERT` for routine SQL Server work.
- Reserve `PARSE`/`TRY_PARSE` for culture-specific text ingestion when simpler conversions cannot express the rule.

## Type Precedence and Implicit Conversions

SQL Server chooses a data type when expressions mix types. That choice can:

- change comparison semantics
- throw conversion errors
- destroy index-seekability

Examples:

- `nvarchar` parameter compared to `varchar` column
- string literal compared to numeric column
- mismatched date/time types in predicates

Production rule:

- Make conversions explicit and put them on the parameter or literal side, not the indexed column side.

## NULL, Three-Valued Logic, and Safe Null Handling

### NULL is not a value

`NULL` means unknown or missing, not zero or empty string.

Rules:

- `= NULL` is wrong
- `<> NULL` is wrong
- use `IS NULL` and `IS NOT NULL`

### ISNULL and COALESCE

Use both to substitute a fallback value, but know the difference.

```sql
SELECT
    ISNULL(country_code, 'UNK') AS country_code_fallback,
    COALESCE(country_code, region_code, 'UNK') AS resolved_code
FROM silver.index_dim;
```

Practical guidance:

- `ISNULL` is SQL Server-specific and takes exactly two arguments.
- `COALESCE` is standard SQL and can evaluate several expressions.
- Prefer `COALESCE` when cascading fallbacks are needed.

### NULLIF

`NULLIF(a, b)` returns `NULL` when `a = b`, otherwise `a`.

```sql
SELECT
    numerator / NULLIF(denominator, 0.0) AS safe_ratio
FROM dbo.metrics;
```

This is the standard divide-by-zero protection pattern.

## CASE, IIF, and CHOOSE

### CASE

`CASE` is the primary conditional expression in T-SQL.

```sql
SELECT
    symbol,
    CASE
        WHEN volume >= 5000000 THEN 'high'
        WHEN volume >= 1000000 THEN 'medium'
        ELSE 'low'
    END AS volume_band
FROM silver.eurostoxx50_ohlcv;
```

Prefer `CASE` for clarity and portability.

### IIF and CHOOSE

- `IIF` is shorthand for a two-branch condition.
- `CHOOSE` picks by ordinal position.

Use them sparingly. `CASE` is usually clearer in production code, especially once logic becomes more than one line.

## Collation and Comparison Semantics

`COLLATE` affects:

- case sensitivity
- accent sensitivity
- width sensitivity
- kana sensitivity
- sort order

This matters in text comparisons, joins, and orderings. For one-off expression-level control, use `COLLATE` on the expression. For systemic behavior, fix schema and database design instead of scattering expression-level overrides.

## Practical Guidance

- Prefer explicit conversion over relying on implicit type precedence.
- Use `TRY_CONVERT` at ingestion edges, not as a blanket runtime crutch.
- Use `IS NULL` and `IS NOT NULL` for null checks.
- Use `NULLIF` for divide-by-zero protection.
- Prefer `CASE` over nested `IIF` once logic becomes nontrivial.
- Match application parameter types to table column types to avoid hidden conversions.

## Related

- [[07-string-functions-and-pattern-matching]]
- [[08-date-and-time-functions]]
- [[11-sargable-queries]]

