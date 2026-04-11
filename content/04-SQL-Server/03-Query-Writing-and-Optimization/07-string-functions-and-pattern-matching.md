---
title: "07 - String Functions and Pattern Matching"
tags: [sql, sql-server, tsql, string-functions, like, charindex, patindex, string-agg, string-split, unicode]
aliases: [text functions, pattern matching, CHARINDEX, PATINDEX, STRING_AGG, STRING_SPLIT]
description: "T-SQL reference for SQL Server string functions, pattern matching, Unicode handling, collation-sensitive comparisons, and text-splitting and aggregation functions."
created: 2026-04-08
updated: 2026-04-08
status: complete
---

# String Functions and Pattern Matching

Text handling in T-SQL is not just about formatting. String choices affect:

- correctness under collation rules
- Unicode safety
- matching behavior
- query performance

## CONCAT, CONCAT_WS, and STRING_AGG

### CONCAT and CONCAT_WS

Use `CONCAT` or `CONCAT_WS` to build strings without brittle manual null handling.

```sql
SELECT
    CONCAT(symbol, ' @ ', CONVERT(char(10), [date], 23)) AS label,
    CONCAT_WS(' | ', symbol, index_name, country_code) AS compact_label
FROM silver.index_dim
WHERE is_current = 1;
```

Why they matter:

- They are clearer than repeated `+`.
- They handle `NULL` more safely than plain string concatenation.

### STRING_AGG

`STRING_AGG` concatenates multiple row values into one string.

```sql
SELECT
    region,
    STRING_AGG(symbol, ', ') WITHIN GROUP (ORDER BY symbol) AS symbol_list
FROM silver.index_dim
WHERE is_current = 1
GROUP BY region;
```

Use it for compact reporting, audit summaries, and human-readable lists. Avoid it as a substitute for proper relational design.

## LEFT, RIGHT, SUBSTRING, STUFF, REPLACE, and TRANSLATE

### LEFT, RIGHT, and SUBSTRING

These extract slices from strings.

```sql
SELECT
    symbol,
    LEFT(symbol, 4) AS prefix,
    RIGHT(symbol, 2) AS suffix,
    SUBSTRING(symbol, 1, 4) AS first_four
FROM silver.eurostoxx50_ohlcv;
```

Performance caution:

- Wrapping indexed columns in these functions inside `WHERE` or `JOIN` predicates can make the query non-SARGable.

### STUFF, REPLACE, and TRANSLATE

- `STUFF` inserts or removes a section inside a string.
- `REPLACE` replaces one substring with another.
- `TRANSLATE` maps character-by-character substitutions.

```sql
SELECT
    REPLACE(symbol, '.', '_') AS symbol_safe,
    TRANSLATE(symbol, '.-', '__') AS symbol_normalized;
```

## LEN, DATALENGTH, TRIM, LTRIM, and RTRIM

### LEN vs DATALENGTH

These are not the same.

| Function | Meaning |
|---|---|
| `LEN(x)` | Character count excluding trailing spaces |
| `DATALENGTH(x)` | Number of bytes used to store the value |

This difference matters for Unicode and fixed-width storage.

### TRIM, LTRIM, and RTRIM

Use them when cleaning inbound text, but avoid putting them directly on indexed columns in predicates.

```sql
SELECT
    TRIM(symbol) AS clean_symbol
FROM staging.raw_symbols;
```

## LOWER, UPPER, COLLATE, and Case Sensitivity

### LOWER and UPPER

These normalize presentation or comparison text, but can break index seeks if used on search columns in predicates.

### COLLATE

`COLLATE` changes comparison and sort behavior for an expression.

```sql
SELECT *
FROM #CaseExample
WHERE Name = 'John' COLLATE Latin1_General_CS_AS;
```

Use `COLLATE` when:

- joining across different collations
- forcing case-sensitive or case-insensitive comparison
- solving one targeted comparison problem

Do not scatter `COLLATE` everywhere as a workaround for inconsistent database design.

## CHARINDEX, PATINDEX, LIKE, and ESCAPE

### CHARINDEX and PATINDEX

- `CHARINDEX` searches for a substring.
- `PATINDEX` searches with wildcard patterns.

```sql
SELECT
    symbol,
    CHARINDEX('.', symbol) AS dot_position,
    PATINDEX('%[0-9]%', symbol) AS first_digit_position
FROM staging.raw_symbols;
```

### LIKE and ESCAPE

`LIKE` is the core wildcard operator.

```sql
SELECT
    symbol
FROM silver.eurostoxx50_ohlcv
WHERE symbol LIKE 'ASM%';
```

Wildcard rules:

- `'abc%'` is a prefix search and can be SARGable
- `'%abc'` and `'%abc%'` are usually not SARGable
- `_` matches one character
- `%` matches zero or more characters

Use `ESCAPE` when the pattern contains literal wildcard characters.

## STRING_SPLIT and QUOTENAME

### STRING_SPLIT

`STRING_SPLIT` turns a delimited string into rows.

```sql
SELECT value
FROM STRING_SPLIT('SX5E,SPX,NKY', ',');
```

Use cases:

- app-supplied short filter lists
- parsing admin parameters
- quick rowset expansion

Do not design core relational storage around comma-delimited lists.

### QUOTENAME

`QUOTENAME` safely wraps identifiers.

```sql
SELECT QUOTENAME('silver.eurostoxx50_ohlcv');
```

Use it whenever dynamic SQL must incorporate object names.

## VARCHAR, NVARCHAR, and Unicode

### VARCHAR vs NVARCHAR

| Type | Use |
|---|---|
| `varchar` | Non-Unicode text where the source contract is truly non-Unicode |
| `nvarchar` | Unicode text, multilingual content, safer default for externally sourced text |

Practical rule:

- If text can contain non-ASCII or multilingual characters, use `nvarchar`.
- Match parameter types to column types to avoid implicit conversions.

## Practical Guidance

- Prefer `CONCAT`, `CONCAT_WS`, and `STRING_AGG` over brittle manual concatenation.
- Use `LEN` for characters and `DATALENGTH` for bytes.
- Keep string-cleaning functions out of indexed predicates whenever possible.
- Use prefix `LIKE` patterns when search behavior permits.
- Use `QUOTENAME` for dynamic object names, never manual bracket-building.


