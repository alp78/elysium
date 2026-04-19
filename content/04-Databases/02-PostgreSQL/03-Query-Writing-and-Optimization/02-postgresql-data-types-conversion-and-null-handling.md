---
title: "02 - Data Types, Conversion, and Null Handling"
tags:
  - postgresql
  - query-optimization
  - sql
aliases:
  - PostgreSQL type conversion
  - PostgreSQL null handling
  - COALESCE and NULLIF
description: "PostgreSQL reference for core data types, explicit casting, type resolution, null semantics, COALESCE/NULLIF/CASE behavior, and collation-aware comparison."
parent: "[[domain-postgresql-query-writing-and-optimization]]"
links:
  - "[[01-postgresql-query-surface-and-planner-basics]]"
  - "[[01-postgresql-storage-and-schema-surface]]"
status: complete
---

# Data Types, Conversion, and Null Handling

Type correctness in PostgreSQL is a runtime behavior issue as much as a schema-design issue. Data type choice affects arithmetic, temporal interpretation, aggregate return types, text comparison, and whether bad input fails early or silently turns into the wrong value. PostgreSQL is often stricter than SQL Server about implicit conversion, which is usually a benefit, but only if the author understands where casts, collations, and null semantics actually matter.

> [!abstract]- Summary
>
> This note mirrors the SQL Server conversion/null-handling track with PostgreSQL equivalents. The key PostgreSQL differences are that casts are explicit and visible through `CAST()` or `::`, aggregate return types differ by input type, there is no built-in `TRY_CAST`, and comparison semantics are shaped by both null logic and collation rules.
>
> **Core data types**
> - grounds the note on the live `stoxx` schema and then shows how PostgreSQL treats integer, numeric, date, timestamp, and timestamptz values differently
>
> **Explicit conversion**
> - covers direct casts, formatting functions, hard failures on invalid input, and safe guarded conversion patterns for text that may not be numeric
>
> **Null and fallback semantics**
> - covers three-valued logic, aggregate behavior with nulls, `COALESCE`, `NULLIF`, and `IS DISTINCT FROM`
>
> **Conditional and collation behavior**
> - covers `CASE` result-type resolution and the way PostgreSQL collation choice changes text comparison and ordering

## Core PostgreSQL Data Type Families

PostgreSQL exposes a broad set of built-in types, but the most important operational split is still simple: numeric, text, temporal, boolean, and specialty types. The live `stoxx` schema already shows that most market-data tables rely on just a few of these families.

### Live type surface from the current schema

Before discussing casts or null behavior, it helps to anchor the note on real table definitions rather than generic examples.

#### Inspect the current column types of a real market-data table

Use this query during schema review, migration validation, or before writing conversions against an existing table whose column types are not yet familiar. It is typically triggered by onboarding into a new dataset or by a query bug that suggests the author assumed the wrong type. The query reads `information_schema.columns`. It is read-only. Its purpose is to show the exact PostgreSQL types and nullability of one representative silver-layer table.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `column_name` | `information_schema.columns.column_name` | text | Column name in ordinal order. |
| `data_type` | `information_schema.columns.data_type` | text | PostgreSQL type family of the column. |
| `is_nullable` | `information_schema.columns.is_nullable` | text | Whether the column can contain null values. |

*This query inspects the live column types of `silver.stoxxusa50_ohlcv`.*

```sql
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'silver'
  AND table_name = 'stoxxusa50_ohlcv'
ORDER BY ordinal_position;
```

| column_name | data_type | is_nullable |
|---|---|---|
| id | integer | NO |
| symbol | character varying | NO |
| date | date | NO |
| open | double precision | YES |
| high | double precision | YES |
| low | double precision | YES |
| close | double precision | YES |
| adj_close | double precision | YES |
| volume | bigint | YES |
| dividends | double precision | YES |
| stock_splits | double precision | YES |
| is_filled | boolean | NO |

This table already shows the main type families that drive most of the chapter: text identifiers, date keys, approximate numeric market measures, bigint volume, and boolean flags. It also shows a practical null boundary: prices and volume are nullable here, so aggregates and arithmetic must be written with null behavior in mind.

### Numeric and temporal behavior

PostgreSQL's operators do not all preserve the same result type. Integer arithmetic stays integer unless the author promotes it, and aggregate return types change according to the input family.

#### Integer division truncates, numeric division preserves scale

Use this query when the workload mixes integer and decimal arithmetic or when a result "looks rounded down" and the author needs to verify whether integer math is the reason. It is typically triggered by percentage calculations, per-unit ratios, or test queries that unexpectedly lose fractional values. The query evaluates pure expressions only. It is read-only. Its purpose is to show that PostgreSQL keeps integer arithmetic in the integer domain unless at least one operand is promoted.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `int_division` | expression `5 / 2` | integer | Integer division result. |
| `numeric_division` | expression `5::numeric / 2` | numeric | Fraction-preserving division result. |
| `int_division_type` | `pg_typeof(5 / 2)` | regtype | Resolved type of the integer expression. |
| `numeric_division_type` | `pg_typeof(5::numeric / 2)` | regtype | Resolved type of the promoted expression. |

*This query contrasts integer division with explicitly promoted numeric division.*

```sql
SELECT
    5 / 2 AS int_division,
    5::numeric / 2 AS numeric_division,
    pg_typeof(5 / 2) AS int_division_type,
    pg_typeof(5::numeric / 2) AS numeric_division_type;
```

| int_division | numeric_division | int_division_type | numeric_division_type |
|---:|---:|---|---|
| 2 | 2.5000000000000000 | integer | numeric |

The result is exact but easy to misuse: `5 / 2` does not round, it truncates because both operands are integers. The fix is not a formatting function. The fix is to promote the arithmetic into `numeric` or another type that can represent the required scale.

#### `SUM(bigint)` returns `numeric`

Use this query when auditing aggregate return types, especially in analytical queries that accumulate large bigint volumes or identifiers. It is typically triggered by a type mismatch downstream, by application code expecting a bigint sum, or by a migration from engines that return different aggregate types. The query runs read-only against the live silver OHLCV table. Its purpose is to show PostgreSQL's actual aggregate result type for a bigint input.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `sum_volume` | `SUM(volume)` | numeric | Aggregate total of AAPL volume. |
| `sum_volume_type` | `pg_typeof(SUM(volume))` | regtype | PostgreSQL type returned by the aggregate. |

*This query shows the return type PostgreSQL chooses when summing a bigint column.*

```sql
SELECT
    SUM(volume) AS sum_volume,
    pg_typeof(SUM(volume)) AS sum_volume_type
FROM silver.stoxxusa50_ohlcv
WHERE symbol = 'AAPL';
```

| sum_volume | sum_volume_type |
|---:|---|
| 90707802006 | numeric |

This is an important PostgreSQL difference from engines that overflow or stay in the original integer domain. `SUM(bigint)` becomes `numeric`, which is safer for correctness but still means downstream code should not blindly assume the original column type survives aggregation.

#### Distinguish `date`, `timestamp`, and `timestamptz`

Use this query when the pipeline needs to be explicit about whether a value represents only a calendar date, a local timestamp with no time-zone semantics, or an absolute moment in time. It is typically triggered by ingestion design, batch watermark handling, or timestamp-formatting bugs. The query evaluates typed literals only. It is read-only. Its purpose is to make the three most common temporal types visually distinct.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `date_type` | `pg_typeof('2026-04-07'::date)` | regtype | Type of a pure date value. |
| `timestamp_type` | `pg_typeof('2026-04-07 23:29:57'::timestamp)` | regtype | Type of a timestamp without time zone. |
| `timestamptz_type` | `pg_typeof('2026-04-07 23:29:57+00'::timestamptz)` | regtype | Type of an absolute timestamp with time zone semantics. |

*This query shows the three temporal types most relevant to the PostgreSQL chapter.*

```sql
SELECT
    pg_typeof('2026-04-07'::date) AS date_type,
    pg_typeof('2026-04-07 23:29:57'::timestamp) AS timestamp_type,
    pg_typeof('2026-04-07 23:29:57+00'::timestamptz) AS timestamptz_type;
```

| date_type | timestamp_type | timestamptz_type |
|---|---|---|
| date | timestamp without time zone | timestamp with time zone |

The distinction matters operationally. A market date such as `2026-04-07` is not the same kind of fact as an ingestion instant such as `2026-04-07 23:29:57+00`. Mixing those concepts too early is a reliable way to create replay and watermark mistakes.

## Explicit Conversion

PostgreSQL exposes direct casts through both `CAST()` and the `::` shorthand. Unlike some other systems, it does not include a built-in `TRY_CAST`, so tolerant conversion has to be designed deliberately rather than assumed.

### Casts and formatting functions

The main operational question is whether the conversion should fail loudly, or whether the workload should stage and validate the input before attempting the cast.

#### Cast and format date/time values explicitly

Use this query when converting typed values for output formatting or parsing text into a typed timestamp with a known pattern. It is typically triggered by export logic, audit display formatting, or staged parsing of raw feed strings. The query evaluates pure expressions only. It is read-only. Its purpose is to show two common PostgreSQL tools: `to_char()` for formatting and `to_timestamp()` for pattern-driven parsing.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `date_as_text` | `to_char(DATE ..., 'YYYY-MM-DD')` | text | Formatted text rendering of a date. |
| `parsed_timestamp` | `to_timestamp(text, format)` | timestamptz | Parsed timestamp value based on the supplied template. |

*This query formats a date as text and parses a timestamp string using an explicit template.*

```sql
SELECT
    to_char(DATE '2026-04-07', 'YYYY-MM-DD') AS date_as_text,
    to_timestamp('2026-04-07 23:29:57', 'YYYY-MM-DD HH24:MI:SS') AS parsed_timestamp;
```

| date_as_text | parsed_timestamp |
|---|---|
| 2026-04-07 | 2026-04-07 23:29:57+00 |

The safe pattern is explicit in both directions: keep formatting at the edge where text is actually needed, and parse external text with a declared template instead of relying on ambiguous free-form input rules.

#### Invalid casts fail immediately

Use this example as a deliberate failure boundary when documenting ingestion behavior or testing how the engine reacts to malformed data. It is typically triggered by source-quality review or by a migration from systems that offer tolerant conversion functions. The query is read-only, but it fails at execution time. Its purpose is to show that PostgreSQL will reject malformed input rather than quietly return null for an invalid cast.

*This query fails because the text literal is not a valid integer.*

```sql
SELECT 'abc'::integer;
```

```text
ERROR:  invalid input syntax for type integer: "abc"
LINE 1: SELECT 'abc'::integer;
               ^
```

This is usually the correct default behavior. If malformed input is expected at an ingestion edge, the safe pattern is to validate or stage it explicitly rather than to hope for an implicit tolerant cast that PostgreSQL does not provide.

#### Guard text-to-integer conversion explicitly

Use this pattern when raw text may or may not be numeric and the workload needs a controlled null result instead of a hard exception. It is typically triggered by raw-feed staging, CSV ingestion, or lightly structured landing tables. The query uses a small inline dataset. It is read-only. Its purpose is to show a PostgreSQL-native guarded conversion pattern using a regular-expression check before the cast.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `txt` | inline test data | text | Raw input string. |
| `parsed_value` | guarded cast | integer | Parsed integer when the input matches the numeric rule, otherwise null. |

*This query guards the cast so only digit-only text is converted to integer.*

```sql
WITH src(txt) AS
(
    VALUES ('123'),
           ('abc')
)
SELECT
    txt,
    CASE
        WHEN txt ~ '^[0-9]+$' THEN txt::integer
    END AS parsed_value
FROM src
ORDER BY txt;
```

| txt | parsed_value |
|---|---:|
| 123 | 123 |
| abc |  |

This is the PostgreSQL substitute for a built-in `TRY_CAST` pattern when the input shape is simple enough to validate upfront. For more complex ingestion, a staging table plus validation queries is usually clearer than embedding large parsing rules inside one expression.

## NULL, Fallback, and Conditional Semantics

PostgreSQL follows standard three-valued logic: comparisons involving null do not become true or false unless the operator is specifically designed to handle nulls differently.

### Comparisons, aggregates, and fallback operators

The main boundary here is that null-aware logic requires null-aware syntax. Equality, distinctness, aggregate counting, and fallback all behave differently once nulls are involved.

#### Compare nulls safely with `IS NULL` and `IS DISTINCT FROM`

Use this query whenever null comparison behavior is under review, or when a bug suggests the author assumed that `NULL = NULL` would be true. It is typically triggered by filter debugging, join logic review, or correctness notes. The query evaluates expressions only. It is read-only. Its purpose is to show the exact truth-table outcomes of ordinary equality versus null-aware operators.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `null_equals_null` | `NULL = NULL` | boolean | Ordinary equality result with two null operands. |
| `null_is_null` | `NULL IS NULL` | boolean | Null test for a missing value. |
| `one_equals_null` | `1 = NULL` | boolean | Ordinary equality result with one null operand. |
| `one_is_distinct_from_null` | `1 IS DISTINCT FROM NULL` | boolean | Null-aware distinctness result. |

*This query shows how PostgreSQL evaluates equality and distinctness when null participates.*

```sql
SELECT
    NULL = NULL AS null_equals_null,
    NULL IS NULL AS null_is_null,
    1 = NULL AS one_equals_null,
    1 IS DISTINCT FROM NULL AS one_is_distinct_from_null;
```

| null_equals_null | null_is_null | one_equals_null | one_is_distinct_from_null |
|---|---|---|---|
|  | `t` |  | `t` |

The blank results are null, not false. That is why `IS NULL`, `IS NOT NULL`, and sometimes `IS DISTINCT FROM` are the right tools when null-aware logic must be unambiguous.

#### Aggregates ignore null inputs except `COUNT(*)`

Use this query when aggregate output looks smaller than the row count or when the author needs to prove whether null rows are being ignored by a specific aggregate. It is typically triggered by QA checks, profile queries, or data-quality review. The query uses an inline dataset. It is read-only. Its purpose is to contrast `COUNT(*)` with aggregates that ignore null inputs.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `count_star` | `COUNT(*)` | bigint | Counts every row. |
| `count_x` | `COUNT(x)` | bigint | Counts only non-null values of `x`. |
| `sum_x` | `SUM(x)` | integer-like aggregate result | Sum over non-null values only. |
| `avg_x` | `AVG(x)` | numeric | Average over non-null values only. |

*This query contrasts row counting with null-ignoring aggregate behavior.*

```sql
WITH v(x) AS
(
    VALUES (1),
           (NULL),
           (3)
)
SELECT
    COUNT(*) AS count_star,
    COUNT(x) AS count_x,
    SUM(x) AS sum_x,
    AVG(x) AS avg_x
FROM v;
```

| count_star | count_x | sum_x | avg_x |
|---:|---:|---:|---:|
| 3 | 2 | 4 | 2.0000000000000000 |

This is the expected and desirable behavior, but it has to be remembered explicitly. `COUNT(*)` answers "how many rows", while `COUNT(x)` answers "how many non-null values of x".

#### Use `COALESCE` and `NULLIF` for safe fallback and divide-by-zero guards

Use this pattern when the query needs a fallback chain, or when a denominator value of zero should become a controlled null boundary rather than a runtime exception. It is typically triggered by reporting expressions, ingestion cleanup, or defensive arithmetic. The query evaluates pure expressions only. It is read-only. Its purpose is to show PostgreSQL's standard fallback and nullification tools in one place.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `fallback_value` | `COALESCE(...)` | text | First non-null text value. |
| `fallback_type` | `pg_typeof(COALESCE(...))` | regtype | Resolved result type of the fallback expression. |
| `nullif_nonzero` | `NULLIF(10, 0)` | integer | First value preserved because it is not equal to the second. |
| `safe_division` | `25 / NULLIF(5, 0)` | integer | Division protected by a zero guard. |

*This query shows PostgreSQL's two main fallback and nullification primitives.*

```sql
SELECT
    COALESCE(NULL::text, NULL::text, 'fallback') AS fallback_value,
    pg_typeof(COALESCE(NULL::text, NULL::text, 'fallback')) AS fallback_type,
    NULLIF(10, 0) AS nullif_nonzero,
    25 / NULLIF(5, 0) AS safe_division;
```

| fallback_value | fallback_type | nullif_nonzero | safe_division |
|---|---|---:|---:|
| fallback | text | 10 | 5 |

`COALESCE` is the right tool for ordered fallback. `NULLIF` is the right tool for turning one sentinel value into null, especially when the sentinel is zero in a denominator.

### `CASE` result typing

Conditional logic is easy to read and easy to misuse if the author forgets that PostgreSQL still has to resolve one common result type for the whole expression.

#### Mixed `CASE` branches resolve to a common type

Use this query when a conditional expression is mixing integer, numeric, text, or timestamp branches and the result type matters to downstream code. It is typically triggered by computed columns, bucketing logic, or query review where the output type is not obvious from the text. The query evaluates expressions only. It is read-only. Its purpose is to show that PostgreSQL promotes mixed branches to a common compatible type.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `case_int` | integer-only `CASE` | integer | Result of a same-type conditional expression. |
| `case_int_type` | `pg_typeof(...)` | regtype | Resolved type of the integer-only case. |
| `case_mixed` | integer-plus-numeric `CASE` | numeric | Result of a mixed-type conditional expression. |
| `case_mixed_type` | `pg_typeof(...)` | regtype | Resolved type of the mixed case. |

*This query shows how PostgreSQL resolves the output type of `CASE` expressions.*

```sql
SELECT
    CASE WHEN true THEN 1 ELSE 2 END AS case_int,
    pg_typeof(CASE WHEN true THEN 1 ELSE 2 END) AS case_int_type,
    CASE WHEN true THEN 1 ELSE 2.5 END AS case_mixed,
    pg_typeof(CASE WHEN true THEN 1 ELSE 2.5 END) AS case_mixed_type;
```

| case_int | case_int_type | case_mixed | case_mixed_type |
|---:|---|---:|---|
| 1 | integer | 1 | numeric |

The important point is not the value `1`, but the resolved type. PostgreSQL had to choose one type that could represent both branches of the mixed expression, so it promoted the result to `numeric`.

## Collation and Comparison Semantics

Text comparison is not governed by intuition alone. PostgreSQL derives collation from the database default, from column definitions, or from explicit `COLLATE` clauses on an operation.

### Current collation surface of the live database

The current database is a useful baseline because it already exposes the default locale plus the built-in `C` and `POSIX` collations.

#### Inspect the database default collation and three common collation objects

Use this query when checking the text-comparison baseline of a database or when preparing to explain why the same literal comparison may behave differently under a different collation. It is typically triggered by sorting anomalies, text-comparison review, or migration planning. The query reads `pg_database` and `pg_collation`. It is read-only. Its purpose is to show the database locale together with the `default`, `C`, and `POSIX` collation objects.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `datcollate` | `pg_database.datcollate` | text | Database default collation locale. |
| `datctype` | `pg_database.datctype` | text | Database character-classification locale. |
| `collname` | `pg_collation.collname` | name | Collation object name. |
| `collprovider` | `pg_collation.collprovider` | char | Provider of the collation, such as `c` for libc or `d` for database default. |
| `collcollate` | `pg_collation.collcollate` | text | Underlying locale name when applicable. |

*This query shows the live database collation baseline together with the common built-in alternatives.*

```sql
SELECT
    d.datcollate,
    d.datctype,
    c.collname,
    c.collprovider,
    c.collcollate
FROM pg_database AS d
CROSS JOIN LATERAL
(
    SELECT
        collname,
        collprovider,
        collcollate
    FROM pg_collation
    WHERE collname IN ('default', 'C', 'POSIX')
    ORDER BY collname
) AS c
WHERE d.datname = current_database();
```

| datcollate | datctype | collname | collprovider | collcollate |
|---|---|---|---|---|
| en_US.utf8 | en_US.utf8 | C | c | C |
| en_US.utf8 | en_US.utf8 | POSIX | c | POSIX |
| en_US.utf8 | en_US.utf8 | default | d |  |

The current database default is `en_US.utf8`, but PostgreSQL also exposes explicit byte-oriented collation choices such as `C` and `POSIX`. That matters because one query can override the database default for a specific comparison or ordering operation.

#### Compare the default collation with explicit `C` collation behavior

Use this query when the author needs proof that collation changes comparison outcomes, not just sort presentation. It is typically triggered by case-sensitivity questions, locale-specific ordering issues, or performance experiments where `C` collation is being considered deliberately. The query evaluates pure text expressions only. It is read-only. Its purpose is to show that the same literal comparison can change truth value under a different collation.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `default_compare` | `'a' < 'B'` | boolean | Comparison under the database-default collation. |
| `c_compare` | explicit `COLLATE "C"` comparison | boolean | Comparison under byte-wise `C` collation rules. |
| `lower_a_umlaut` | `lower('Ä')` | text | Lowercase transformation under the database default locale. |

*This query compares the same literals under the default collation and under `C` collation.*

```sql
SELECT
    'a' < 'B' AS default_compare,
    ('a' COLLATE "C") < ('B' COLLATE "C") AS c_compare,
    lower('Ä') AS lower_a_umlaut;
```

| default_compare | c_compare | lower_a_umlaut |
|---|---|---|
| `t` | `f` | ä |

This is the operational proof that collation is not cosmetic. Under the current default locale, the comparison returns true. Under `C` collation, it returns false because ordering falls back to byte-wise code ordering.

## Practical Guidance

The safest PostgreSQL habits in this area are straightforward.

### Default habits for this chapter

- Promote arithmetic deliberately when fractional output matters; integer division will stay integer.
- Treat aggregate return types as their own contract. `SUM(bigint)` becomes `numeric`.
- Use explicit casts and formatting functions at the edge where text is actually needed.
- Do not assume a built-in tolerant cast exists. If malformed text is expected, validate it before casting or stage it separately.
- Use `IS NULL`, `IS NOT NULL`, or `IS DISTINCT FROM` when null-aware logic must be explicit.
- Assume collation can change both sort order and comparison results whenever text behavior matters.
