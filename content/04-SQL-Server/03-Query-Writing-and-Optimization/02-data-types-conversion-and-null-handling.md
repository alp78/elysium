---
title: "02 - Data Types, Conversion, and Null Handling"
tags: [sql-server, tsql, query-writing]
aliases: [type conversion, null handling, CAST CONVERT, TRY_CAST, COALESCE, CASE]
description: "T-SQL reference for SQL Server data types, precedence and implicit conversion, CAST/CONVERT/TRY_CAST/TRY_CONVERT/PARSE/FORMAT, three-valued logic and NULL semantics, ISNULL/COALESCE/NULLIF, CASE/IIF/CHOOSE, and collation."
created: 2026-04-08
updated: 2026-04-11
status: complete
---

# Data Types, Conversion, and Null Handling

> [!abstract]- Summary
>
> Type correctness in T-SQL is a runtime behavior problem as much as a schema design problem: data type choice, explicit and implicit conversion, NULL semantics, conditional expressions, and collation rules all determine whether a query returns the right value, uses the right index, and fails visibly when bad input arrives.
>
> **Core data type families**
> - catalogs the exact numeric, approximate numeric, character, temporal, binary, and specialty types with their storage sizes, ranges, and intended use boundaries
>
> **Explicit conversion functions**
> - covers `CAST`, `CONVERT`, `TRY_CAST`, `TRY_CONVERT`, `PARSE`, and `FORMAT`, including where formatting belongs and where tolerant conversion is appropriate
>
> **Type precedence and implicit conversion**
> - explains how SQL Server picks a common type, when silent coercion changes semantics, and how column-side conversion can defeat index seeks
>
> **Null and fallback semantics**
> - covers `NULL`, three-valued logic, safe null predicates, concatenation behavior, and the distinct roles of `ISNULL`, `COALESCE`, and `NULLIF`
>
> **Conditional expressions**
> - compares `CASE`, `IIF`, and `CHOOSE`, including branch typing rules, aggregate evaluation traps, and practical defaults
>
> **Collation and comparison semantics**
> - covers case and accent sensitivity, tempdb collation conflicts, and `_UTF8` collations for `varchar` storage
>
> **Operations and safety**
> - Warnings: `SUM(int)` overflows at `int_max`, integer division truncates, `= NULL` is never correct, `ISNULL` can truncate to the first argument's type, implicit conversion can move work onto the indexed column, and collation mismatches raise error 468
> - Recommendations: prefer `datetime2(n)` over `datetime`, `decimal(p,s)` over `float` for deterministic arithmetic, explicit conversion over silent coercion, `TRY_` conversion at ingestion boundaries, `COLLATE DATABASE_DEFAULT` for mixed-collation comparisons, `N'...'` for Unicode literals, and `bigint` aggregation for large totals

> [!note]- Glossary
>
> **Data type family**
> - A category of SQL Server types that share storage and behavioral characteristics, such as exact numeric, temporal, or character data.
> - It matters because choosing the correct family is the first constraint on precision, range, comparison behavior, and storage cost.
>
> > [!info] Families are design-level choices
> >
> > Most conversion and null-handling bugs start with the wrong family selection, not the wrong syntax. The type family defines the space of safe operations later in the query.
>
> ---
>
> **Exact vs approximate numeric type**
> - Exact numeric types preserve stored values precisely, while approximate types use floating-point representation and allow rounding error.
> - It matters because counts, keys, and money usually need reproducible exactness, while `float` and `real` belong to scientific or statistical workloads.
>
> > [!warning] Approximation leaks into equality
> >
> > Floating-point values can compare unexpectedly because the stored binary value is only an approximation. That makes them poor defaults for finance and key-like logic.
>
> ---
>
> **`decimal(p,s)`**
> - The fixed-precision, fixed-scale numeric type where `p` defines total digits and `s` defines digits after the decimal point.
> - It matters because it is the standard SQL Server choice for deterministic arithmetic and financial values that must not drift.
>
> > [!warning] Precision and scale are contract terms
> >
> > Choosing `decimal` is not enough by itself. Poor `p` and `s` choices still cause rounding, overflow, or needless storage bloat.
>
> ---
>
> **`datetime2(n)`**
> - The modern SQL Server timestamp type with configurable fractional-second precision and a wider, cleaner range than legacy `datetime`.
> - It matters because it is the recommended default temporal type for new schema and avoids the rounding quirks of `datetime`.
>
> > [!info] Legacy compatibility is not a quality signal
> >
> > `datetime` exists for backward compatibility. New design should start from `datetime2` unless an integration contract forces the older type.
>
> ---
>
> **Explicit conversion**
> - A deliberate type change written in the query, usually through `CAST` or `CONVERT`.
> - It matters because explicit conversion makes type intent visible and prevents SQL Server from choosing a coercion path you did not mean.
>
> > [!warning] Conversion location affects performance
> >
> > Converting the literal or parameter side is often safe. Converting the indexed column side frequently destroys SARGability and changes the access path.
>
> ---
>
> **`TRY_CAST` / `TRY_CONVERT`**
> - Tolerant conversion functions that return `NULL` instead of raising an error when a cast fails.
> - It matters because they are useful at ingestion edges where malformed data is expected but dangerous when silent failure would hide a true data-quality problem.
>
> > [!warning] Null-on-failure can mask bad data
> >
> > These functions are for controlled boundaries, not for core logic that should fail loudly. A quiet `NULL` can propagate farther than an exception.
>
> ---
>
> **Type precedence**
> - The SQL Server ranking that decides which type wins when an expression mixes different data types.
> - It matters because precedence controls the implicit conversion direction, which in turn affects both correctness and seekability.
>
> > [!warning] SQL Server chooses, not the author
> >
> > If mixed types appear in an expression, SQL Server resolves them using precedence rules whether you planned for it or not. Explicit casts remove that ambiguity.
>
> ---
>
> **Implicit conversion**
> - An automatic type change SQL Server applies when operands do not already share a common type.
> - It matters because silent conversion can raise runtime errors, alter comparison semantics, or move function work onto the indexed column.
>
> > [!warning] Hidden conversion is still real work
> >
> > Implicit conversion is invisible in the text, but not in the plan. It is one of the classic reasons a simple predicate stops seeking.
>
> ---
>
> **`NULL`**
> - The marker for missing, unknown, or inapplicable data rather than a concrete value.
> - It matters because SQL Server treats `NULL` with distinct logical and arithmetic semantics that affect filters, expressions, and aggregates.
>
> > [!warning] `NULL` is not zero or empty string
> >
> > Treating `NULL` like an ordinary value leads to wrong predicates and accidental data masking. It means the value is absent, not merely blank.
>
> ---
>
> **Three-valued logic**
> - The boolean model where expressions can evaluate to TRUE, FALSE, or UNKNOWN when `NULL` participates.
> - It matters because predicates involving `NULL` do not behave like ordinary two-valued comparisons, especially in `WHERE` and `JOIN` conditions.
>
> > [!warning] UNKNOWN filters out rows
> >
> > In `WHERE`, only TRUE keeps a row. FALSE and UNKNOWN both discard it, which is why `= NULL` and nullable `NOT IN` patterns produce surprising results.
>
> ---
>
> **`ISNULL`**
> - A two-argument SQL Server function that replaces a `NULL` expression with a fallback value and reports the first argument's data type.
> - It matters because it is concise for single fallback logic but has different typing and nullability behavior from `COALESCE`.
>
> > [!warning] First-argument typing can truncate
> >
> > If the first argument is a short string type, SQL Server converts the fallback to that same width. The replacement value can be silently shortened.
>
> ---
>
> **`COALESCE`**
> - The standard SQL expression that returns the first non-null value from a list of candidates.
> - It matters because it is the most flexible cascading fallback construct and follows standard type-precedence rules rather than `ISNULL`'s narrower behavior.
>
> > [!info] Best when fallback is a sequence
> >
> > `COALESCE` expresses “try these sources in order.” It is often clearer than nested `CASE` when the logic is just a fallback chain.
>
> ---
>
> **`NULLIF`**
> - A function that returns `NULL` when its two arguments are equal and otherwise returns the first argument.
> - It matters because it is the cleanest guard for patterns like divide-by-zero protection and sentinel-to-null normalization.
>
> > [!info] Small function, large safety value
> >
> > `NULLIF(x, 0)` is one of the simplest ways to convert a runtime error boundary into a controlled null result that later logic can handle explicitly.
>
> ---
>
> **`CASE`**
> - The primary T-SQL conditional expression for returning different values based on ordered boolean tests or discrete matches.
> - It matters because it is the default tool for conditional projection, bucketing, labeling, and safe query-side branching.
>
> > [!warning] Branches still share one result type
> >
> > SQL Server resolves a common output type across every branch. Mixed branch types can force coercion or fail before the reader notices the mismatch.
>
> ---
>
> **Collation**
> - The rule set that defines how SQL Server compares and sorts character data, including case, accent, kana, and width sensitivity.
> - It matters because string equality, ordering, indexing behavior, and cross-database joins all depend on the chosen collation.
>
> > [!warning] Comparison semantics are configuration, not intuition
> >
> > Whether `'A'` equals `'a'` or accented characters sort together is not universal. The collation decides, and mixed sources can disagree.
>
> ---
>
> **`_UTF8` collation**
> - A Windows collation variant that allows `char` and `varchar` columns to store Unicode text using UTF-8 encoding.
> - It matters because it changes the old “use `nvarchar` for all Unicode” decision and introduces real storage tradeoffs by language mix.
>
> > [!warning] UTF-8 is not automatically smaller
> >
> > ASCII-heavy text often benefits, but CJK-heavy text can consume more space than UTF-16 `nvarchar`. Encoding choice should follow the actual character distribution.

## Core SQL Server Data Type Families

SQL Server exposes roughly thirty built-in data types grouped into seven families. The table below is the quick-reference summary; the subsections that follow give the storage sizes, ranges, and gotchas for each family.

| Family | Common types | Primary use |
|---|---|---|
| **Exact numeric** | `bit`, `tinyint`, `smallint`, `int`, `bigint`, `decimal`/`numeric`, `money`/`smallmoney` | Counts, keys, financial arithmetic |
| **Approximate numeric** | `real`, `float` | Scientific computing where small rounding errors are acceptable |
| **Character (non-Unicode)** | `char(n)`, `varchar(n)`, `varchar(max)` | ASCII or single-code-page text |
| **Character (Unicode)** | `nchar(n)`, `nvarchar(n)`, `nvarchar(max)` | Unicode text (UCS-2/UTF-16, or UTF-8 with `_UTF8` collations) |
| **Date / time** | `date`, `time(n)`, `smalldatetime`, `datetime`, `datetime2(n)`, `datetimeoffset(n)` | Temporal values |
| **Binary** | `binary(n)`, `varbinary(n)`, `varbinary(max)` | Raw binary payloads |
| **Specialty** | `uniqueidentifier`, `rowversion`, `xml`, `hierarchyid`, `geography`, `geometry`, `sql_variant`, `json` (SQL 2025+), `vector` (SQL 2025+) | Specialized scenarios |

### Exact numeric types

**Exact** numeric types store their values without loss of precision. Every `tinyint`, `int`, `decimal(p,s)` value you insert is the exact value you retrieve — no IEEE-754 approximation. Exact types are the correct default for counts, identifiers, quantities, money, and anything where reproducibility matters.

| Type | Storage | Value range |
|---|---|---|
| `bit` | 1 byte (packed; multiple bits share a byte) | `0`, `1`, or `NULL` |
| `tinyint` | 1 byte | 0 to 255 (unsigned) |
| `smallint` | 2 bytes | −32,768 to 32,767 |
| `int` | 4 bytes | −2,147,483,648 to 2,147,483,647 |
| `bigint` | 8 bytes | −9.2 × 10¹⁸ to 9.2 × 10¹⁸ |
| `decimal(p,s)` / `numeric(p,s)` | 5–17 bytes (varies by `p`) | Up to 38 digits of precision |
| `money` | 8 bytes | −922,337,203,685,477.5808 to +922,337,203,685,477.5807 (fixed 4-decimal scale) |
| `smallmoney` | 4 bytes | −214,748.3648 to +214,748.3647 |

#### Integer type ranges at a glance

*Return the maximum positive value representable by each integer type.*

```sql
SELECT
    CAST(255        AS tinyint)  AS tinyint_max,
    CAST(32767      AS smallint) AS smallint_max,
    CAST(2147483647 AS int)      AS int_max,
    CAST(9223372036854775807 AS bigint) AS bigint_max;
```

| tinyint_max | smallint_max | int_max | bigint_max |
|---|---|---|---|
| 255 | 32767 | 2147483647 | 9223372036854775807 |

`tinyint` is unsigned (0–255), which is unusual — every other integer type is signed. `int` is the default integer type in SQL Server and is almost always the right choice for counts and identifiers. Reach for `bigint` only when values can exceed ~2.1 billion.

#### SUM over int column can overflow silently

> [!danger] SUM(int) overflows at 2.1 billion
>
> `SUM` over an `int` expression produces an `int` result. If the cumulative total exceeds `int_max`, SQL Server raises error 8115 at runtime. The query aborts and no rows are returned. This is especially dangerous for long-running aggregation jobs where the overflow only surfaces after the query has already been scheduled and observed to "work" on smaller windows.

*Trigger an arithmetic overflow by summing NVDA volume as `int`.*

```sql
SELECT SUM(CAST(volume AS int)) AS sum_int
FROM dbo.stock_prices
WHERE symbol = 'NVDA';
```

```text
Msg 8115, Level 16, State 2
Arithmetic overflow error converting expression to data type int.
```

NVDA's cumulative volume across the 2016–2026 dataset exceeds one trillion shares, well beyond the `int` max of 2.1 billion.

> [!success] Cast to bigint before aggregating
>
> If the per-row values fit in `int` but the sum might not, cast to `bigint` inside the aggregate. The cast happens once per row, the running total is maintained in `bigint`, and no overflow occurs. `volume` in `dbo.stock_prices` is already stored as `bigint`, so the cast is defensive against any future column-type change.

*Cast each row to `bigint` before summing.*

```sql
SELECT SUM(CAST(volume AS bigint)) AS sum_bigint
FROM dbo.stock_prices
WHERE symbol = 'NVDA';
```

| sum_bigint |
|---|
| 1146777998700 |

NVDA traded roughly 1.15 trillion shares over the ten-year window. The `bigint` container holds the value with room to spare.

#### Integer division truncates toward zero

> [!warning] `5 / 2 = 2`, not `2.5`
>
> When both operands of `/` are integer types, SQL Server performs integer division and truncates the result toward zero. There is no warning, no rounding, no promotion to a fractional type. Mixing in a `decimal` or `float` literal forces the higher-precedence type and gives the expected fractional answer.

*Four division expressions showing integer, decimal, and float behaviors.*

```sql
SELECT
    5 / 2                          AS int_division,
    5.0 / 2                        AS decimal_division,
    CAST(5 AS decimal(10,4)) / 2   AS explicit_decimal_division,
    CAST(5 AS float) / CAST(2 AS float) AS float_division;
```

| int_division | decimal_division | explicit_decimal_division | float_division |
|---|---|---|---|
| 2 | 2.500000 | 2.500000 | 2.5 |

Only the first column is "wrong" — and it is wrong by SQL Server's rules, not by a bug. The remaining three columns all return 2.5 because at least one operand is a fractional type, triggering the implicit conversion rules described in `## Type Precedence and Implicit Conversions`.

> [!success] Force fractional division with a decimal literal
>
> Write `column * 1.0 / denominator` or `CAST(column AS decimal(18,6)) / denominator` when computing ratios from integer columns. Prefer `decimal` over `float` for deterministic reproducibility.

#### decimal(p, s): precision and scale

`decimal(p, s)` (and its ANSI synonym `numeric(p, s)`) is the exact fractional type:

- **`p`** (precision) — total number of digits, 1 to 38
- **`s`** (scale) — digits to the right of the decimal point, 0 to `p`

Storage grows with precision: 5 bytes for `p` ≤ 9, 9 bytes for `p` ≤ 19, 13 bytes for `p` ≤ 28, 17 bytes for `p` = 38. Default is `decimal(18, 0)` when precision/scale are omitted.

*Three decimal declarations showing how precision and scale affect the stored value.*

```sql
SELECT
    CAST(123.456789 AS decimal(18,4)) AS dec_18_4,
    CAST(123.456789 AS decimal(10,2)) AS dec_10_2,
    CAST(123.456789 AS decimal(38,6)) AS dec_38_6;
```

| dec_18_4 | dec_10_2 | dec_38_6 |
|---|---|---|
| 123.4568 | 123.46 | 123.456789 |

All three columns hold the same source number but with different scales. `decimal(18,4)` keeps four decimal digits and rounds half-away-from-zero (`.456789` → `.4568`). `decimal(10,2)` rounds to two decimals (`.46`). `decimal(38,6)` has enough scale to hold all six source digits losslessly.

#### decimal precision overflow

> [!failure] Value does not fit in the target precision
>
> When the integer portion of a value is too large for the target precision, SQL Server raises error 8115 — the same error code as `int` overflow. `decimal(6,2)` has precision 6 and scale 2, so at most 4 digits can be left of the decimal point. `1234567.89` has 7 digits left of the point and cannot fit.

*Overflow a `decimal(6,2)` target.*

```sql
SELECT CAST(1234567.89 AS decimal(6,2)) AS too_small;
```

```text
Msg 8115, Level 16, State 8
Arithmetic overflow error converting numeric to data type numeric.
```

> [!success] Use `TRY_CAST` to convert on a best-effort basis
>
> If the conversion is speculative — for example parsing text from a staging table — use `TRY_CAST` or `TRY_CONVERT`, which return `NULL` on failure instead of aborting the statement. See the `TRY_CAST and TRY_CONVERT` subsection under `## CAST, CONVERT, TRY_CAST, and TRY_CONVERT`.

#### money and smallmoney

`money` is a legacy fixed-scale decimal type with exactly 4 decimal digits. It is stored in 8 bytes and its range is about −922 trillion to +922 trillion. `smallmoney` is its 4-byte cousin with a much smaller range.

`money` was once marketed for storing currency amounts, but modern T-SQL code should prefer `decimal(19, 4)` or `decimal(38, 6)`. `money` has several quirks: it cannot be multiplied by another `money` (returns `decimal`), its precision is fixed at 4 which is insufficient for some currencies, and arithmetic with `money` can lose precision in intermediate steps. Treat it as a legacy type to read from existing schemas but not to create new columns with.

### Approximate numeric types: real and float

`real` (4 bytes, IEEE-754 single precision, ~7 significant digits) and `float(n)` (default `float(53)` = 8 bytes, IEEE-754 double precision, ~15 significant digits) are **approximate** numeric types. Values are stored in binary floating point, which cannot exactly represent most decimal fractions.

#### The IEEE-754 approximation trap

> [!danger] `0.1 + 0.2 ≠ 0.3` in float arithmetic
>
> The decimal value 0.1 has no exact binary representation — it is a repeating fraction in base 2, just like 1/3 is a repeating fraction in base 10. `float` rounds the representation to the nearest 53-bit binary value, introducing a tiny error. When you add two rounded values, the errors compound. For financial math, ordering, or equality comparison of amounts, this is catastrophic.

*Show that `float(0.1) + float(0.2)` is not equal to `float(0.3)`.*

```sql
SELECT
    CAST(0.1 AS float) + CAST(0.2 AS float)                           AS float_sum,
    CAST(0.1 AS decimal(10,4)) + CAST(0.2 AS decimal(10,4))           AS decimal_sum,
    CASE
        WHEN CAST(0.1 AS float) + CAST(0.2 AS float) = CAST(0.3 AS float)
        THEN 'equal'
        ELSE 'not equal'
    END AS float_equality_test;
```

| float_sum | decimal_sum | float_equality_test |
|---|---|---|
| 0.30000000000000004 | 0.3000 | not equal |

The `float_sum` column shows the canonical floating-point artifact: `0.1 + 0.2` produces `0.30000000000000004` because neither 0.1 nor 0.2 has an exact binary representation. The `decimal_sum` column shows the safe behavior: `decimal(10,4)` stores each input exactly and the sum is exactly `0.3000`.

> [!success] Prefer decimal for money and determinism
>
> Use `float`/`real` only for scientific, statistical, or modeling workloads where the slight approximation is acceptable in exchange for the wide dynamic range. For any financial amount, price, quantity, or value that must round-trip through equality comparison, use `decimal(p, s)` with a precision that bounds the worst-case magnitude and a scale that matches the business requirement (typically 2 for currencies, 4 for FX rates, 6–10 for scientific instruments).

### Character types: char, varchar, varchar(max)

SQL Server has two character-type families: non-Unicode (`char`/`varchar`) and Unicode (`nchar`/`nvarchar`). This subsection covers the non-Unicode family; the next covers the Unicode family.

- **`char(n)`** — fixed length, exactly `n` bytes regardless of the actual string length. Shorter strings are space-padded to the full length. Trailing spaces are preserved on read.
- **`varchar(n)`** — variable length, up to `n` bytes. Storage uses 2 bytes of overhead plus the actual string length.
- **`varchar(max)`** — variable length up to ~2 GB. Values up to 8000 bytes are stored in-row; larger values spill to LOB storage (off-row), which is slower to read.

`n` is a **byte count**, not a character count — this is a common confusion. For non-Unicode types it often coincides with character count because most ASCII characters are single-byte, but with UTF-8 collations (`_UTF8` suffix) a single character can take 1–4 bytes.

#### char vs varchar: storage and trailing spaces

*Compare a `char(10)` and a `varchar(10)` holding the same 5-character string.*

```sql
DECLARE @c char(10)    = 'hello';
DECLARE @v varchar(10) = 'hello';
SELECT
    LEN(@c)                  AS len_char,
    LEN(@v)                  AS len_varchar,
    DATALENGTH(@c)           AS bytes_char,
    DATALENGTH(@v)           AS bytes_varchar,
    '[' + @c + ']'           AS padded_char,
    '[' + @v + ']'           AS padded_varchar;
```

| len_char | len_varchar | bytes_char | bytes_varchar | padded_char | padded_varchar |
|---|---|---|---|---|---|
| 5 | 5 | 10 | 5 | [hello     ] | [hello] |

Three key observations:

- **`LEN()` ignores trailing spaces.** Both columns report length 5 even though `char(10)` actually stores `'hello     '` (5 letters + 5 trailing spaces).
- **`DATALENGTH()` reports actual bytes on disk.** `char(10)` always consumes 10 bytes. `varchar(10)` consumes only the 5 bytes needed for `'hello'`.
- **Concatenation exposes the padding.** Wrapping the variables in `'['` and `']'` shows the trailing spaces on the `char` side and no padding on the `varchar` side.

Choose `char(n)` only for truly fixed-width columns (e.g. currency codes `CHAR(3)`, ISO country codes `CHAR(2)`, fixed-format identifiers). For everything else, use `varchar(n)` — fixed-width padding is a storage penalty for no benefit.

### Unicode character types: nchar, nvarchar

The Unicode family stores characters outside the 256-value limit of a single code page. Before SQL Server 2019, `nchar`/`nvarchar` always used UCS-2/UTF-16 encoding at 2 bytes per character. Since SQL Server 2019, `varchar`/`char` columns can opt into UTF-8 encoding by using a collation with the `_UTF8` suffix, but `nchar`/`nvarchar` remain UCS-2/UTF-16.

- **`nchar(n)`** — fixed length, exactly `2*n` bytes. `n` counts **byte-pairs**, not characters.
- **`nvarchar(n)`** — variable length, up to `2*n` bytes.
- **`nvarchar(max)`** — variable length up to ~2 GB.

#### varchar vs nvarchar: storage difference

*Compare a `varchar(10)` and an `nvarchar(10)` storing the same 5-character ASCII string.*

```sql
DECLARE @a varchar(10)  = 'hello';
DECLARE @b nvarchar(10) = N'hello';
SELECT
    DATALENGTH(@a) AS bytes_varchar,
    DATALENGTH(@b) AS bytes_nvarchar,
    LEN(@a)        AS chars_varchar,
    LEN(@b)        AS chars_nvarchar;
```

| bytes_varchar | bytes_nvarchar | chars_varchar | chars_nvarchar |
|---|---|---|---|
| 5 | 10 | 5 | 5 |

Both variables hold the same five characters, but `nvarchar` uses exactly twice the storage. This 2× storage cost is the tradeoff for Unicode support under UCS-2/UTF-16. On a 100-million-row table, a naively chosen `nvarchar(100)` over `varchar(100)` can cost 100 GB of extra storage.

#### N prefix is required for Unicode literals

> [!danger] Missing `N` prefix silently loses characters
>
> When you write a string literal without the `N` prefix, SQL Server first parses it as a **non-Unicode** `varchar` using the database's default code page, and only then implicitly converts it to `nvarchar` during assignment. If the literal contains characters that are not representable in the database code page, they are replaced with `?` **before** the conversion happens — the Unicode characters never reach the `nvarchar` variable. There is no warning.

*Assign a Japanese literal with and without the `N` prefix.*

```sql
DECLARE @with_n    nvarchar(10) = N'日本語';
DECLARE @without_n nvarchar(10) = '日本語';
SELECT
    @with_n            AS with_N_prefix,
    @without_n         AS without_N_prefix,
    LEN(@with_n)       AS chars_with_n,
    LEN(@without_n)    AS chars_without_n;
```

| with_N_prefix | without_N_prefix | chars_with_n | chars_without_n |
|---|---|---|---|
| 日本語 | ??? | 3 | 3 |

The `N'日本語'` literal preserves the three Japanese characters. The bare `'日本語'` literal is first parsed as `varchar` under the database's default code page (which on this server does not include Japanese), converting each non-representable character to `?` before assignment. Both columns have `LEN() = 3` because both variables are `nvarchar(10)` holding three characters, but the values are completely different.

> [!success] Always prefix Unicode literals with `N`
>
> Rule of thumb: when the target column is `nchar`/`nvarchar`, always write `N'literal'`. This has no downside for ASCII-only strings and is the only way to preserve non-ASCII characters in the literal path.

### Date and time types

SQL Server has six date/time types with different precision, range, and storage tradeoffs:

| Type | Storage | Range | Precision |
|---|---|---|---|
| `date` | 3 bytes | 0001-01-01 to 9999-12-31 | 1 day |
| `time(n)` | 3–5 bytes | 00:00:00 to 23:59:59.9999999 | 100 ns (`n=7`) down to 1 s (`n=0`) |
| `smalldatetime` | 4 bytes | 1900-01-01 to 2079-06-06 | 1 minute |
| `datetime` (legacy) | 8 bytes | 1753-01-01 to 9999-12-31 | 3.33 ms (rounds to `.000`/`.003`/`.007` increments) |
| `datetime2(n)` | 6–8 bytes | 0001-01-01 to 9999-12-31 | 100 ns (`n=7`, default) down to 1 s (`n=0`) |
| `datetimeoffset(n)` | 8–10 bytes | 0001-01-01 to 9999-12-31 | 100 ns, plus time-zone offset |

For all new schema, prefer `datetime2(n)` over `datetime`. It has wider range, configurable precision, smaller storage at low precision, and does not suffer the 3.33 ms rounding trap documented below.

#### datetime vs datetime2 precision

*Compare the same timestamp cast to four different date/time types.*

```sql
SELECT
    CONVERT(varchar(30), CAST('2025-01-15 12:34:56.123'     AS datetime),     121) AS as_datetime,
    CONVERT(varchar(30), CAST('2025-01-15 12:34:56.1234567' AS datetime2(0)), 121) AS as_datetime2_0,
    CONVERT(varchar(30), CAST('2025-01-15 12:34:56.1234567' AS datetime2(3)), 121) AS as_datetime2_3,
    CONVERT(varchar(30), CAST('2025-01-15 12:34:56.1234567' AS datetime2(7)), 121) AS as_datetime2_7;
```

| as_datetime | as_datetime2_0 | as_datetime2_3 | as_datetime2_7 |
|---|---|---|---|
| 2025-01-15 12:34:56.123 | 2025-01-15 12:34:56 | 2025-01-15 12:34:56.123 | 2025-01-15 12:34:56.1234567 |

`datetime2(n)` takes an optional precision digit: `0` stores whole seconds (6 bytes), `3` stores milliseconds (7 bytes), `7` (the default) stores 100 nanoseconds (8 bytes). Pick the lowest precision that meets the business requirement to save storage and index width.

#### datetime rounds to 3.33 ms increments

> [!danger] `datetime` cannot store arbitrary millisecond values
>
> The legacy `datetime` type stores time as 1/300-second ticks (about 3.33 ms per tick). Values written with millisecond precision are silently rounded to the nearest valid `datetime` tick. This means `.998` rounds to `.997`, and `.999` rounds **up** to the next whole second. Any system that writes millisecond-precision timestamps to a `datetime` column will see silent data corruption.

*Write three consecutive millisecond values to `datetime` and observe the rounding.*

```sql
SELECT
    CONVERT(varchar(30), CAST('2025-01-15 12:34:56.997' AS datetime), 121) AS ms_997,
    CONVERT(varchar(30), CAST('2025-01-15 12:34:56.998' AS datetime), 121) AS ms_998,
    CONVERT(varchar(30), CAST('2025-01-15 12:34:56.999' AS datetime), 121) AS ms_999;
```

| ms_997 | ms_998 | ms_999 |
|---|---|---|
| 2025-01-15 12:34:56.997 | 2025-01-15 12:34:56.997 | 2025-01-15 12:34:57.000 |

`.998` is rounded **down** to `.997`. `.999` crosses a boundary and rounds **up** to the next second, changing the wall-clock second from 56 to 57. Neither behavior is intuitive and neither is documented in any error message.

> [!success] Use `datetime2(3)` for millisecond-precision timestamps
>
> `datetime2(3)` stores full millisecond precision (1 ms granularity) in 7 bytes — one byte less than the 8-byte `datetime`. For new schema there is no reason to choose `datetime` over `datetime2(n)`.

#### date, time, and datetimeoffset

*Inspect the date-only, time-only, and offset-aware date/time types.*

```sql
SELECT
    CAST('2025-06-15' AS date)                                            AS date_only,
    CAST('14:30:45.1234567' AS time(7))                                   AS time_only,
    CONVERT(varchar(40),
            CAST('2025-06-15 14:30:45.1234567 +02:00' AS datetimeoffset),
            121)                                                          AS with_offset_str;
```

| date_only | time_only | with_offset_str |
|---|---|---|
| 2025-06-15 | 14:30:45.123456 | 2025-06-15 14:30:45.1234567 +02:00 |

`date` discards time-of-day entirely (3 bytes). `time(7)` discards the date entirely (5 bytes, up to 100 ns precision). `datetimeoffset(7)` adds a `±HH:MM` UTC offset to `datetime2(7)` (10 bytes total). Use `datetimeoffset` for global applications where the caller's time zone matters; use `datetime2` for local-only scheduling and logging.

#### Storage sizes at a glance

*Compute `DATALENGTH` for every date/time type at default precision.*

```sql
SELECT
    DATALENGTH(CAST('2025-01-15' AS date))                             AS bytes_date,
    DATALENGTH(CAST('12:34:56.1234567' AS time(7)))                    AS bytes_time7,
    DATALENGTH(CAST('2025-01-15 12:34:56' AS smalldatetime))           AS bytes_smalldatetime,
    DATALENGTH(CAST('2025-01-15 12:34:56.997' AS datetime))            AS bytes_datetime,
    DATALENGTH(CAST('2025-01-15 12:34:56.1234567' AS datetime2(7)))    AS bytes_datetime2_7,
    DATALENGTH(CAST('2025-01-15 12:34:56.1234567 +02:00' AS datetimeoffset)) AS bytes_datetimeoffset;
```

| bytes_date | bytes_time7 | bytes_smalldatetime | bytes_datetime | bytes_datetime2_7 | bytes_datetimeoffset |
|---|---|---|---|---|---|
| 3 | 5 | 4 | 8 | 8 | 10 |

Note that `datetime2(7)` occupies **8 bytes** — the same as legacy `datetime`, but with 10,000× the precision and 1000× the date range.

### Specialty and legacy types

Beyond the numeric, character, and date/time families, SQL Server supports several specialized and legacy types that are relevant to know about but rare in everyday query writing.

| Type | Storage | Use case |
|---|---|---|
| `uniqueidentifier` | 16 bytes | Globally unique identifiers (GUIDs) |
| `rowversion` (alias `timestamp`) | 8 bytes | Database-managed optimistic concurrency version |
| `xml` | up to 2 GB | XML documents with schema validation and XPath/XQuery support |
| `hierarchyid` | variable | Tree/hierarchy paths with ancestry operators |
| `geography`, `geometry` | variable | Geospatial data with spatial methods |
| `sql_variant` | up to 8016 bytes | Container for values of any scalar type |
| `json` | variable (SQL Server 2025+) | First-class JSON type; replaces `nvarchar(max) + ISJSON` |
| `vector` | variable (SQL Server 2025+) | Embeddings for similarity search (`float16`/`float32`) |

Legacy types that should not be used in new schema:

- **`text`, `ntext`, `image`** — deprecated; replaced by `varchar(max)`, `nvarchar(max)`, `varbinary(max)`. Do not create columns of these types. Read from existing ones only.
- **`timestamp`** — an ANSI name the `rowversion` type is exposed under, but `timestamp` is **not** a date/time type; it is a row-version counter. The naming confusion is unfortunate. Always prefer `rowversion` in new code.

#### uniqueidentifier (GUID)

*Generate a fresh GUID and measure its storage footprint.*

```sql
SELECT
    NEWID()              AS new_guid,
    DATALENGTH(NEWID())  AS bytes_guid;
```

| new_guid | bytes_guid |
|---|---|
| E1576ECD-9DF4-4055-B92C-8D9CC4904908 | 16 |

`uniqueidentifier` is stored in 16 bytes. The text form (36 characters with hyphens) is only a display representation; the on-disk value is binary. GUIDs are useful for distributed ID generation but are a poor choice for clustered index keys because their random distribution causes page-split churn. When a GUID is needed as a clustered key, use `NEWSEQUENTIALID()` instead of `NEWID()` to preserve insertion locality.

#### Inspecting column types of an existing table

*Use `INFORMATION_SCHEMA.COLUMNS` to enumerate the type of every column in `dbo.stock_prices`.*

```sql
SELECT
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    NUMERIC_PRECISION,
    NUMERIC_SCALE,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'dbo'
  AND TABLE_NAME   = 'stock_prices'
ORDER BY ORDINAL_POSITION;
```

| COLUMN_NAME | DATA_TYPE | CHARACTER_MAXIMUM_LENGTH | NUMERIC_PRECISION | NUMERIC_SCALE | IS_NULLABLE |
|---|---|---|---|---|---|
| symbol | varchar | 10 | NULL | NULL | NO |
| trade_date | date | NULL | NULL | NULL | NO |
| open_price | decimal | NULL | 10 | 2 | YES |
| high_price | decimal | NULL | 10 | 2 | YES |
| low_price | decimal | NULL | 10 | 2 | YES |

... (truncated to 5 rows)

`INFORMATION_SCHEMA.COLUMNS` is the portable SQL-standard view for column metadata. The alternative SQL Server-specific view is `sys.columns` (joined with `sys.types`), which exposes additional internal columns like collation, is_identity, and computed-column definition. Use the former for portability and the latter for full introspection.

## CAST, CONVERT, TRY_CAST, and TRY_CONVERT

> [!abstract] Explicit conversion functions
>
> SQL Server exposes six explicit conversion functions. The first four are standard:
>
> - `CAST` — ANSI-standard explicit conversion. No style codes.
> - `CONVERT` — T-SQL-specific explicit conversion with optional style code for datetime, money, and binary formatting.
> - `TRY_CAST` — same as `CAST` but returns `NULL` on failure instead of raising an error.
> - `TRY_CONVERT` — same as `CONVERT` but returns `NULL` on failure instead of raising an error.
>
> Two additional functions cover culture-aware parsing and formatting:
>
> - `PARSE` / `TRY_PARSE` — CLR-based, culture-aware string-to-value parsing (slow).
> - `FORMAT` — CLR-based, .NET format-string-driven value-to-string formatting (slow).
>
> The Microsoft [CAST and CONVERT (Transact-SQL)](https://learn.microsoft.com/en-us/sql/t-sql/functions/cast-and-convert-transact-sql) reference documents the full syntax and all style codes. Key rules:
>
> - Prefer `CAST` for portable ANSI-compliant code.
> - Prefer `CONVERT` when a style code is required (for example, converting a `datetime` to `'yyyy-MM-dd'` with style 23).
> - Use `TRY_CAST` / `TRY_CONVERT` at ingestion boundaries where malformed input is expected; do not use them in core business logic where failure should be visible.
> - Reserve `PARSE` / `TRY_PARSE` for one-shot culture-specific text parsing; they are orders of magnitude slower than `CAST` / `CONVERT`.

### CAST: ANSI explicit conversion

`CAST(expression AS target_type)` is the ANSI-standard form. It takes an expression and a target type and returns the expression converted to that type. If the conversion is not possible, SQL Server raises an error and aborts the statement.

#### CAST columns to different target types

*Project four columns of `dbo.stock_prices`, each cast to a different target type.*

```sql
SELECT TOP (5)
    symbol,
    CAST(close_price AS int)           AS close_int,
    CAST(close_price AS decimal(18,6)) AS close_dec_18_6,
    CAST(trade_date  AS varchar(10))   AS date_as_str
FROM dbo.stock_prices
WHERE symbol = 'AAPL'
  AND trade_date >= '2025-01-01'
ORDER BY trade_date;
```

| symbol | close_int | close_dec_18_6 | date_as_str |
|---|---|---|---|
| AAPL | 242 | 242.530000 | 2025-01-02 |
| AAPL | 242 | 242.040000 | 2025-01-03 |
| AAPL | 243 | 243.670000 | 2025-01-06 |
| AAPL | 240 | 240.890000 | 2025-01-07 |
| AAPL | 241 | 241.380000 | 2025-01-08 |

Three conversions happen in the projection:

- `close_price` (`decimal(10,2)`) → `int` — the fractional part is truncated (toward zero). 242.53 becomes 242.
- `close_price` (`decimal(10,2)`) → `decimal(18,6)` — the scale is widened. Zero-padding is added to the right.
- `trade_date` (`date`) → `varchar(10)` — the date is serialized as `YYYY-MM-DD`, which happens to match the default style for `date` → string conversion.

### CONVERT: T-SQL explicit conversion with style codes

`CONVERT(target_type, expression, style_code)` is the SQL Server-specific form. Its primary advantage over `CAST` is the optional third argument — a style code that selects a specific formatting variant when converting `datetime`, `money`, `float`, or `binary` to or from a string.

#### datetime style codes

The following table shows the most commonly used `datetime` → `varchar` style codes. The full list (126 documented styles) is in the Microsoft [CAST and CONVERT (Transact-SQL)](https://learn.microsoft.com/en-us/sql/t-sql/functions/cast-and-convert-transact-sql) reference.

| Style code | Format | Example |
|---|---|---|
| `0` / `100` | Default (`Mon dd yyyy hh:miAM/PM`) | `Jun 15 2025 2:30PM` |
| `1` / `101` | US (`mm/dd/yyyy`) | `06/15/2025` |
| `103` | British/French (`dd/mm/yyyy`) | `15/06/2025` |
| `112` | ISO compact (`yyyymmdd`) | `20250615` |
| `120` | ODBC canonical (`yyyy-MM-dd hh:mi:ss`) | `2025-06-15 14:30:45` |
| `121` | ODBC canonical with ms (`yyyy-MM-dd hh:mi:ss.mmm`) | `2025-06-15 14:30:45.000` |
| `126` | ISO 8601 (`yyyy-MM-ddThh:mi:ss`) | `2025-06-15T14:30:45` |
| `127` | ISO 8601 with time zone `Z` | `2025-06-15T14:30:45Z` |

*Convert a single `datetime` value using seven different style codes.*

```sql
SELECT
    CONVERT(varchar(30), CAST('2025-06-15 14:30:45' AS datetime), 0)   AS style_0_default,
    CONVERT(varchar(30), CAST('2025-06-15 14:30:45' AS datetime), 101) AS style_101_usa,
    CONVERT(varchar(30), CAST('2025-06-15 14:30:45' AS datetime), 103) AS style_103_british,
    CONVERT(varchar(30), CAST('2025-06-15 14:30:45' AS datetime), 112) AS style_112_iso,
    CONVERT(varchar(30), CAST('2025-06-15 14:30:45' AS datetime), 120) AS style_120_odbc,
    CONVERT(varchar(30), CAST('2025-06-15 14:30:45' AS datetime), 121) AS style_121_odbc_ms,
    CONVERT(varchar(30), CAST('2025-06-15 14:30:45' AS datetime), 126) AS style_126_iso8601;
```

| style_0_default | style_101_usa | style_103_british | style_112_iso | style_120_odbc | style_121_odbc_ms | style_126_iso8601 |
|---|---|---|---|---|---|---|
| Jun 15 2025  2:30PM | 06/15/2025 | 15/06/2025 | 20250615 | 2025-06-15 14:30:45 | 2025-06-15 14:30:45.000 | 2025-06-15T14:30:45 |

Style `121` (ODBC canonical with milliseconds) is the recommended choice for logging and inter-system communication: it is unambiguous, sorts lexicographically, and matches the SQL Server default string representation for `datetime2`. Style `126` (ISO 8601) is the choice for JSON APIs and XML documents.

> [!warning] Styles below 100 are locale-dependent and nondeterministic
>
> Microsoft's [CAST and CONVERT reference](https://learn.microsoft.com/en-us/sql/t-sql/functions/cast-and-convert-transact-sql) flags most styles below 100 as nondeterministic: they depend on the session's language setting and can return different results on different servers. For anything machine-readable, use styles 120, 121, 126, or 127.

#### money style codes

*Format a money value using three style codes.*

```sql
SELECT
    CONVERT(varchar(20), CAST(1234567.89 AS money), 0) AS money_style_0,
    CONVERT(varchar(20), CAST(1234567.89 AS money), 1) AS money_style_1_grouped,
    CONVERT(varchar(20), CAST(1234567.89 AS money), 2) AS money_style_2_precise;
```

| money_style_0 | money_style_1_grouped | money_style_2_precise |
|---|---|---|
| 1234567.89 | 1,234,567.89 | 1234567.8900 |

Style 0 is the default (no commas, 2 decimals). Style 1 adds thousand separators. Style 2 shows the full 4-decimal internal precision of `money`. Prefer style 1 for human display and style 2 when the business requires full precision to be visible.

### TRY_CAST and TRY_CONVERT

`TRY_CAST` and `TRY_CONVERT` have identical syntax to `CAST` and `CONVERT` but return `NULL` instead of raising an error when the conversion fails. Use them at ingestion boundaries and for data-quality cleanup where malformed input is expected and should not abort the statement.

#### CAST failure raises an error

*Cast a non-numeric string to `int` using the strict form.*

```sql
SELECT CAST('abc' AS int) AS fail;
```

```text
Msg 245, Level 16, State 1
Conversion failed when converting the varchar value 'abc' to data type int.
```

The statement aborts at runtime. Error 245 is the generic conversion-failed error and it is raised for every impossible conversion — string to number, out-of-range date, overflowed decimal, etc.

> [!success] Use TRY_CAST when the input is untrusted
>
> If the input is user-provided, file-parsed, or comes from a staging table with data-quality issues, wrap the cast in `TRY_CAST`. The statement will not abort; invalid values become `NULL` and can be filtered, logged, or fixed downstream.

#### TRY_CAST returns NULL on failure

*Test `TRY_CAST` against six inputs with mixed validity.*

```sql
SELECT
    TRY_CAST('123' AS int)         AS good,
    TRY_CAST('abc' AS int)         AS bad_text,
    TRY_CAST('1.5' AS int)         AS bad_float,
    TRY_CAST(NULL  AS int)         AS null_input,
    TRY_CAST('2025-06-15' AS date) AS good_date,
    TRY_CAST('not-a-date' AS date) AS bad_date;
```

| good | bad_text | bad_float | null_input | good_date | bad_date |
|---|---|---|---|---|---|
| 123 | NULL | NULL | NULL | 2025-06-15 | NULL |

Six interpretations:

- `'123'` → `123` — a clean integer string.
- `'abc'` → `NULL` — not convertible.
- `'1.5'` → `NULL` — a decimal string cannot directly become `int`; the caller would need a two-step conversion (`TRY_CAST('1.5' AS decimal(10,2))` then cast to `int`).
- `NULL` → `NULL` — `NULL` input produces `NULL` output in any conversion function.
- `'2025-06-15'` → valid `date` value.
- `'not-a-date'` → `NULL`.

#### TRY_CONVERT with an explicit style code

`TRY_CONVERT` adds the optional style code argument to the `TRY_` family. This is the only way to safely parse a string-to-date conversion that requires an explicit format.

*Parse a date string in three different formats using the matching style code, then fail one mismatched case.*

```sql
SELECT
    TRY_CONVERT(date, '15/06/2025', 103) AS british_format,
    TRY_CONVERT(date, '06/15/2025', 101) AS us_format,
    TRY_CONVERT(date, '20250615',   112) AS iso_format,
    TRY_CONVERT(date, '15/06/2025', 101) AS mismatched_format;
```

| british_format | us_format | iso_format | mismatched_format |
|---|---|---|---|
| 2025-06-15 | 2025-06-15 | 2025-06-15 | NULL |

The first three columns all parse successfully — same target date, three input formats, three matching style codes. The fourth column tries to parse the British-format string `'15/06/2025'` using the US style code (`101 = mm/dd/yyyy`). Month 15 does not exist, the parse fails, and `TRY_CONVERT` returns `NULL` silently. A strict `CONVERT(date, '15/06/2025', 101)` would have raised error 241 and aborted.

### PARSE, TRY_PARSE, and FORMAT

`PARSE` / `TRY_PARSE` and `FORMAT` are CLR-based, culture-aware conversion functions. They are expressive but slow — typically 10× to 100× slower than the equivalent `CAST`/`CONVERT` — because each call pays the cost of the CLR boundary. Reserve them for one-shot ad-hoc formatting and for culture-specific parsing that `CONVERT` cannot express.

#### TRY_PARSE with a culture

*Parse a French-language date, an Italian date, and a US/German-formatted number.*

```sql
SELECT
    TRY_PARSE('15 juin 2025' AS date USING 'fr-FR')    AS french_date,
    TRY_PARSE('15 giugno 2025' AS date USING 'it-IT')  AS italian_date,
    TRY_PARSE('1,234.56' AS decimal(10,2) USING 'en-US') AS us_number,
    TRY_PARSE('1.234,56' AS decimal(10,2) USING 'de-DE') AS german_number;
```

| french_date | italian_date | us_number | german_number |
|---|---|---|---|
| 2025-06-15 | 2025-06-15 | 1234.56 | 1234.56 |

All four inputs are parsed according to their declared culture. The US-format and German-format numbers swap the role of the comma and the period (`1,234.56` in the US is `1.234,56` in Germany — same value, different thousand/decimal separators). `TRY_PARSE` handles both correctly because the culture tells the CLR parser how to interpret the delimiters.

#### FORMAT with a .NET format string

*Use `FORMAT` to render a date and a number in multiple cultures.*

```sql
SELECT
    FORMAT(CAST('2025-06-15' AS date), 'dddd, MMMM d, yyyy', 'en-US') AS us_long,
    FORMAT(CAST('2025-06-15' AS date), 'dddd, MMMM d, yyyy', 'fr-FR') AS french_long,
    FORMAT(1234567.89, 'C', 'en-US')                                   AS us_currency,
    FORMAT(1234567.89, 'C', 'de-DE')                                   AS german_currency,
    FORMAT(0.1257,     'P2', 'en-US')                                  AS us_percent;
```

| us_long | french_long | us_currency | german_currency | us_percent |
|---|---|---|---|---|
| Sunday, June 15, 2025 | dimanche, juin 15, 2025 | $1,234,567.89 | 1.234.567,89 € | 12.57% |

`FORMAT` uses standard .NET format strings: `'dddd, MMMM d, yyyy'` for a long date, `'C'` for the culture's currency format, `'P2'` for a percentage with 2 decimals. This is by far the most concise way to produce presentation-layer formatting — but because of the CLR call overhead, do not use it in hot paths or to format large result sets. For machine-readable output, stick with `CONVERT` style codes.

### String concatenation and NULL

String concatenation has two very different forms in T-SQL, and the difference matters for NULL handling:

- **`+` operator** — ANSI-style string concatenation. If **any** operand is `NULL`, the entire result is `NULL` (this follows the three-valued logic rule: anything combined with `NULL` is `NULL`). This is the historical T-SQL behavior.
- **`CONCAT(a, b, c, ...)`** — implicitly **skips** NULL operands, treating them as empty strings. This is the ANSI SQL:2008 behavior, introduced in SQL Server 2012.
- **`CONCAT_WS(separator, a, b, c, ...)`** — "concat with separator". Same NULL-skipping as `CONCAT`, and automatically inserts `separator` between non-null arguments.

#### `+`, CONCAT, and CONCAT_WS with a NULL argument

*Compare the three concatenation forms when one argument is `NULL`.*

```sql
SELECT
    'hello' + ' ' + NULL                   AS plus_with_null,
    CONCAT('hello', ' ', NULL, 'world')    AS concat_skips_null,
    CONCAT_WS(' ', 'hello', NULL, 'world') AS concat_ws_skips_null;
```

| plus_with_null | concat_skips_null | concat_ws_skips_null |
|---|---|---|
| NULL | hello world | hello world |

The `+` operator form is `NULL` because one operand is `NULL`. `CONCAT` skips the `NULL` argument entirely and produces `'hello world'`. `CONCAT_WS` does the same and also applies the separator `' '` between the two non-null arguments.

> [!warning] SET CONCAT_NULL_YIELDS_NULL OFF is deprecated
>
> Historically, the session setting `SET CONCAT_NULL_YIELDS_NULL OFF` made the `+` operator behave like `CONCAT` (treat NULL as empty string). This setting is deprecated and will be removed in a future SQL Server version — under current and future versions its behavior is always `ON`. Do not rely on it. Use `CONCAT` or `CONCAT_WS` when NULL-skipping is the intended behavior.

#### CONCAT auto-coerces non-string arguments

*Use `+` with an explicit cast vs `CONCAT` with automatic coercion.*

```sql
SELECT
    'AAPL ' + CAST(150 AS varchar(10)) AS explicit_cast,
    CONCAT('AAPL ', 150)               AS concat_auto_coerces;
```

| explicit_cast | concat_auto_coerces |
|---|---|
| AAPL 150 | AAPL 150 |

`CONCAT` implicitly converts every argument to `nvarchar`, which removes the need for explicit `CAST` calls around non-string arguments. `+` requires that both operands already be strings; mixing a string and a number raises a conversion error because the `int` side has higher type precedence and the engine tries to convert the string to `int`. This trap is covered in the next section.

## Type Precedence and Implicit Conversions

> [!abstract] How SQL Server chooses the common type
>
> When an operator combines expressions of different data types, SQL Server applies the **data type precedence** rules: the operand with lower precedence is implicitly converted to the higher-precedence type before the operator executes. If the conversion is not possible, the statement fails at runtime.
>
> Implicit conversion matters for three reasons:
>
> - **Correctness** — the engine's choice of common type can cause unexpected results or runtime errors (for example, `int + varchar` can fail or succeed depending on whether the varchar value parses as a number).
> - **Performance** — an implicit conversion on the indexed side of a predicate defeats index seeking (see `## SARGability` in the `01-select-and-query-basics` note).
> - **Portability** — different databases use different precedence rules, so queries that rely on implicit conversion are less portable than queries that use explicit `CAST`.

### Full precedence order

The Microsoft [Data type precedence (Transact-SQL)](https://learn.microsoft.com/en-us/sql/t-sql/data-types/data-type-precedence-transact-sql) reference defines the complete ranked list. Types are listed from highest precedence (top) to lowest (bottom).

| Rank | Type |
|---|---|
| 1 | user-defined data types (highest) |
| 2 | `json` (SQL Server 2025+) |
| 3 | `sql_variant` |
| 4 | `xml` |
| 5 | `datetimeoffset` |
| 6 | `datetime2` |
| 7 | `datetime` |
| 8 | `smalldatetime` |
| 9 | `date` |
| 10 | `time` |
| 11 | `float` |
| 12 | `real` |
| 13 | `decimal` / `numeric` |
| 14 | `money` |
| 15 | `smallmoney` |
| 16 | `bigint` |
| 17 | `int` |
| 18 | `smallint` |
| 19 | `tinyint` |
| 20 | `bit` |
| 21 | `ntext` (deprecated) |
| 22 | `text` (deprecated) |
| 23 | `image` (deprecated) |
| 24 | `timestamp` (`rowversion`) |
| 25 | `uniqueidentifier` |
| 26 | `nvarchar` (including `nvarchar(max)`) |
| 27 | `nchar` |
| 28 | `varchar` (including `varchar(max)`) |
| 29 | `char` |
| 30 | `varbinary` (including `varbinary(max)`) |
| 31 | `binary` (lowest) |

Two practical observations from this list:

- **`nvarchar` outranks `varchar`.** When a `varchar` column is compared to an `nvarchar` literal or parameter, the **column** is converted to `nvarchar` (not the other way around). That conversion happens row-by-row and defeats any index on the `varchar` column.
- **Numeric types outrank string types.** When a numeric value is combined with a string value (for example, `int + varchar`), SQL Server converts the **string** to the numeric type. If the string does not parse as a number, the statement fails.

### `int + varchar` fails when the varchar is not numeric

> [!failure] Non-numeric varchar cannot be implicitly converted to int
>
> When `int` and `varchar` are combined, the precedence rule says the `varchar` must be converted to `int`. If the string content is not a valid integer literal, error 245 is raised and the statement aborts.

*Add an `int` variable to a non-numeric `varchar` variable.*

```sql
DECLARE @v varchar(10) = 'abc';
DECLARE @i int = 5;
SELECT @i + @v AS int_plus_varchar;
```

```text
Msg 245, Level 16, State 1
Conversion failed when converting the varchar value 'abc' to data type int.
```

The `int` is never promoted to a string — that would be the lower-precedence direction. Instead the `varchar` is converted to `int`, which fails.

> [!success] Use CAST to drive the conversion in the direction you want
>
> If the intent is arithmetic (numeric addition), explicitly convert the string operand to `int` with `CAST(@v AS int)`. If the intent is string concatenation (the `+` operator's other role), explicitly convert the number operand to a string with `CAST(@i AS varchar(10))`. Never rely on implicit precedence when the two operands have different natural types.

*The same operation with an explicit cast — both implicit and explicit forms now succeed because the string is a valid integer literal.*

```sql
DECLARE @v varchar(10) = '5';
DECLARE @i int = 3;
SELECT @i + CAST(@v AS int) AS safe_add,
       @i + @v              AS implicit_coerce;
```

| safe_add | implicit_coerce |
|---|---|
| 8 | 8 |

Both columns produce 8 because `'5'` is a valid `int` literal and the implicit conversion succeeds. The explicit-cast form is still preferable because it documents the intent and survives data-quality changes — the day a non-numeric string appears in `@v`, only the implicit form breaks.

### Implicit conversion on the indexed side defeats seek

> [!danger] An `nvarchar` literal against a `varchar` column forces a conversion on every row
>
> The precedence rule says `varchar` must be converted to `nvarchar` when the two are compared. The conversion happens on the **column** side of the predicate — SQL Server wraps every stored `varchar` value in a `CONVERT(nvarchar, col)` expression before comparing. This defeats any index seek on the column and falls back to a scan, often with dramatic performance impact on large tables.

*Match forms: the predicate compares a `varchar` column to a `varchar` literal. SARGable.*

```sql
SELECT TOP (3) symbol, trade_date, close_price
FROM dbo.stock_prices
WHERE symbol = 'AAPL'
  AND trade_date >= '2025-01-01'
ORDER BY trade_date;
```

| symbol | trade_date | close_price |
|---|---|---|
| AAPL | 2025-01-02 | 242.53 |
| AAPL | 2025-01-03 | 242.04 |
| AAPL | 2025-01-06 | 243.67 |

*Mismatched forms: the same column compared to an `N'AAPL'` literal. The rows are identical, but the plan is forced to convert the column on every row before comparing.*

```sql
SELECT TOP (3) symbol, trade_date, close_price
FROM dbo.stock_prices
WHERE symbol = N'AAPL'
  AND trade_date >= '2025-01-01'
ORDER BY trade_date;
```

| symbol | trade_date | close_price |
|---|---|---|
| AAPL | 2025-01-02 | 242.53 |
| AAPL | 2025-01-03 | 242.04 |
| AAPL | 2025-01-06 | 243.67 |

The result rows are identical, but the two queries are not equivalent at the plan level. The first form seeks directly on the `symbol` index; the second form must convert every `varchar` value to `nvarchar` before comparing, which turns the seek into a scan. On a 1.2-million-row table this is a measurable performance difference; on a billion-row table it is catastrophic.

> [!success] Match parameter types to column types in application code
>
> The most common cause of this trap is ORM and client driver defaults. .NET's `SqlParameter` defaults to `SqlDbType.NVarChar` for any string, which mismatches against `varchar` columns in the database. Always pin the `SqlDbType` to the column type in the application code (`SqlDbType.VarChar` for `varchar` columns). Java JDBC has a similar default and similar fix via `setString` + `sendStringParametersAsUnicode=false`. See the `## SARGability` section of `01-select-and-query-basics` for the full treatment of SARG-breaking implicit conversions.

## NULL, Three-Valued Logic, and Safe Null Handling

> [!abstract] The three-valued logic model
>
> SQL Server uses **three-valued logic** for all comparisons and Boolean operations. Every logical expression evaluates to one of three values:
>
> - `TRUE` — the expression is known to be true
> - `FALSE` — the expression is known to be false
> - `UNKNOWN` — the expression cannot be evaluated because at least one operand is `NULL`
>
> `NULL` represents **unknown** or **missing** — not zero, not empty string, not a sentinel value. Two `NULL` values are not equal to each other under three-valued logic, because you cannot prove that two unknowns are the same unknown.
>
> This section covers:
>
> - the three-valued logic rules and truth tables
> - `ANSI_NULLS` and why `= NULL` never works
> - `NULL` propagation through arithmetic, string concatenation, and aggregate functions
> - `NULL` introduction via `LEFT JOIN` and `RIGHT JOIN`
> - `NULL` behavior in `UNIQUE` constraints

### NULL in comparisons and IS NULL / IS NOT NULL

Any comparison operator (`=`, `<>`, `<`, `>`, `<=`, `>=`, `IN`, `BETWEEN`, `LIKE`) involving `NULL` returns `UNKNOWN`. The `WHERE`, `HAVING`, and `ON` clauses keep only rows where the predicate is `TRUE` — `UNKNOWN` and `FALSE` rows are both excluded, which is why `= NULL` never returns any row even when `NULL` values exist in the data.

The only operators that do not return `UNKNOWN` on `NULL` operands are `IS NULL` and `IS NOT NULL`. They test whether a value is `NULL` and always return a real Boolean.

#### Comparing NULL to NULL and to a literal

*Run four CASE expressions that test how comparison operators behave against `NULL`.*

```sql
SELECT
    CASE WHEN NULL = NULL  THEN 'TRUE matched' ELSE 'not TRUE' END AS eq_null_null,
    CASE WHEN 1 = NULL     THEN 'TRUE matched' ELSE 'not TRUE' END AS eq_1_null,
    CASE WHEN NULL <> NULL THEN 'TRUE matched' ELSE 'not TRUE' END AS neq_null_null,
    CASE WHEN NULL IS NULL THEN 'TRUE matched' ELSE 'not TRUE' END AS is_null_null;
```

| eq_null_null | eq_1_null | neq_null_null | is_null_null |
|---|---|---|---|
| not TRUE | not TRUE | not TRUE | TRUE matched |

Three of the four comparisons return `UNKNOWN` and the `CASE` falls through to the `ELSE` branch. Only `IS NULL` produces a real `TRUE` — because it is designed to test for the `NULL` state rather than compare values.

#### `WHERE v = NULL` silently returns zero rows

> [!danger] `WHERE col = NULL` is a classic silent bug
>
> With `ANSI_NULLS ON` (the default and the only supported setting in modern SQL Server), any equality comparison against the literal `NULL` evaluates to `UNKNOWN` for every row, including rows where the column itself is `NULL`. `WHERE` filters out `UNKNOWN` rows, so the query returns zero rows — and gives no warning that the predicate is structurally wrong.

*Attempt to find `NULL` rows using the equality operator.*

```sql
SELECT v
FROM (VALUES (1), (NULL), (2)) AS t(v)
WHERE v = NULL;
```

```text
(0 rows)
```

The source rowset has a `NULL` value, but the query returns zero rows. The `= NULL` predicate is `UNKNOWN` for every row, including the `NULL` row, so nothing survives the `WHERE` filter.

> [!success] Use IS NULL to test for null
>
> `IS NULL` is the only operator that correctly identifies `NULL` values. It returns a real Boolean (`TRUE` or `FALSE`), not `UNKNOWN`.

*Find the `NULL` rows correctly.*

```sql
SELECT v
FROM (VALUES (1), (NULL), (2), (NULL)) AS t(v)
WHERE v IS NULL;
```

| v |
|---|
| NULL |
| NULL |

Both `NULL` rows are returned. For negation, use `IS NOT NULL` — do not write `NOT (v = NULL)` or `v <> NULL`; both are `UNKNOWN` and filtered out.

### NULL propagates through arithmetic

Every arithmetic and bitwise operator propagates `NULL`: if any operand is `NULL`, the result is `NULL`. This follows the same "unknown + anything = unknown" rule as comparisons.

*Show that four common arithmetic operations all produce `NULL` when one operand is `NULL`.*

```sql
SELECT
    1 + NULL    AS add_with_null,
    NULL * 0    AS mul_zero_null,
    10.0 / NULL AS div_by_null,
    -NULL       AS negate_null;
```

| add_with_null | mul_zero_null | div_by_null | negate_null |
|---|---|---|---|
| NULL | NULL | NULL | NULL |

The `NULL * 0` case is particularly counter-intuitive: from elementary math, `anything × 0 = 0`, but SQL Server does not reason about the value of the `NULL` operand — it only follows the propagation rule. Unknown × 0 = Unknown, because the calculation cannot commit to a result without knowing the unknown value.

### AND, OR, NOT truth tables with NULL

Boolean operators also follow three-valued logic. The truth tables below come from the Microsoft [Handling null values](https://learn.microsoft.com/en-us/sql/connect/ado-net/sql/handle-null-values) reference.

**AND truth table** — a three-valued AND returns `TRUE` only when both operands are `TRUE`; `FALSE` wins over `UNKNOWN`; two `UNKNOWN` values produce `UNKNOWN`.

| AND | TRUE | FALSE | UNKNOWN |
|---|---|---|---|
| **TRUE**    | TRUE    | FALSE | UNKNOWN |
| **FALSE**   | FALSE   | FALSE | FALSE   |
| **UNKNOWN** | UNKNOWN | FALSE | UNKNOWN |

**OR truth table** — returns `TRUE` if either operand is `TRUE`; `TRUE` wins over `UNKNOWN`; two `UNKNOWN` values produce `UNKNOWN`.

| OR | TRUE | FALSE | UNKNOWN |
|---|---|---|---|
| **TRUE**    | TRUE | TRUE    | TRUE    |
| **FALSE**   | TRUE | FALSE   | UNKNOWN |
| **UNKNOWN** | TRUE | UNKNOWN | UNKNOWN |

**NOT truth table** — `NOT UNKNOWN` is `UNKNOWN`.

| NOT | result |
|---|---|
| TRUE    | FALSE   |
| FALSE   | TRUE    |
| UNKNOWN | UNKNOWN |

*Verify three cases from the AND/OR tables using `bit` comparisons.*

```sql
SELECT
    CASE WHEN (CAST(1 AS bit) = 1 AND CAST(NULL AS bit) = 1) THEN 'T' ELSE 'F or U' END AS true_and_null,
    CASE WHEN (CAST(0 AS bit) = 1 AND CAST(NULL AS bit) = 1) THEN 'T' ELSE 'F or U' END AS false_and_null,
    CASE WHEN (CAST(1 AS bit) = 1 OR  CAST(NULL AS bit) = 1) THEN 'T' ELSE 'F or U' END AS true_or_null,
    CASE WHEN (CAST(0 AS bit) = 1 OR  CAST(NULL AS bit) = 1) THEN 'T' ELSE 'F or U' END AS false_or_null;
```

| true_and_null | false_and_null | true_or_null | false_or_null |
|---|---|---|---|
| F or U | F or U | T | F or U |

- `TRUE AND UNKNOWN` → `UNKNOWN` (shown as `F or U`)
- `FALSE AND UNKNOWN` → `FALSE` (shown as `F or U`)
- `TRUE OR UNKNOWN` → `TRUE` (shown as `T`)
- `FALSE OR UNKNOWN` → `UNKNOWN` (shown as `F or U`)

The combined `T`/`F or U` column labels collapse `FALSE` and `UNKNOWN` together because both branches of the `CASE` follow `THEN 'T'` only when the Boolean is strictly `TRUE`. This is consistent with how `WHERE` behaves — `UNKNOWN` and `FALSE` are both excluded.

### NULL in aggregate functions

Aggregate functions have their own NULL-handling rule: all aggregates except `COUNT(*)` **skip** `NULL` values. `COUNT(*)` counts every row (because it counts rows, not values). `COUNT(col)` counts only rows where `col` is not `NULL`. `SUM`, `AVG`, `MIN`, and `MAX` all skip `NULL` rows before computing.

*Run six aggregates over a set with two `NULL` rows.*

```sql
SELECT
    COUNT(*)                      AS count_star,
    COUNT(v)                      AS count_col_skips_null,
    SUM(v)                        AS sum_skips_null,
    AVG(CAST(v AS decimal(10,4))) AS avg_skips_null,
    MIN(v)                        AS min_skips_null,
    MAX(v)                        AS max_skips_null
FROM (VALUES (10), (20), (NULL), (30), (NULL)) AS t(v);
```

| count_star | count_col_skips_null | sum_skips_null | avg_skips_null | min_skips_null | max_skips_null |
|---|---|---|---|---|---|
| 5 | 3 | 60 | 20.000000 | 10 | 30 |

Five rows total; only three have non-null values (10, 20, 30). `COUNT(*)` returns 5 (every row), `COUNT(v)` returns 3 (non-null values). `SUM(v) = 60` and `AVG(v) = 20` — the average uses the non-null count of 3, not the row count of 5.

This NULL-skipping behavior is the reason `AVG(col)` often produces a different result from `SUM(col) / COUNT(*)`: the former divides by the non-null count, the latter divides by the row count. See the `COUNT variants` subsection of `01-select-and-query-basics` for additional coverage.

### NULL introduction via LEFT JOIN

`LEFT JOIN` (and `RIGHT JOIN` / `FULL OUTER JOIN`) introduces `NULL` values in the result set whenever the outer side has no matching row on the inner side. This is how `NULL` enters queries that never stored `NULL` in the base data.

*Use a `LEFT JOIN` against an impossible filter on the right side to force `NULL` columns in every row.*

```sql
SELECT TOP (5)
    d.symbol,
    e.sector,
    e.totalesgscore
FROM dbo.dim_symbol AS d
LEFT JOIN dbo.esg_dash AS e
    ON d.symbol = e.symbol
   AND e.sector = 'NonExistentSector'
ORDER BY d.symbol;
```

| symbol | sector | totalesgscore |
|---|---|---|
| A | NULL | NULL |
| AAPL | NULL | NULL |
| ABBV | NULL | NULL |
| ABNB | NULL | NULL |
| ABT | NULL | NULL |

The `d.symbol` column comes from `dbo.dim_symbol` where it is `NOT NULL`. The `e.sector` and `e.totalesgscore` columns come from `dbo.esg_dash` where both are also defined. But the `LEFT JOIN` condition (`e.sector = 'NonExistentSector'`) matches no row, so the right side contributes `NULL` for every row that survives from the left side.

The lesson: a column defined as `NOT NULL` in the base table can still produce `NULL` values in a query result as soon as an outer join is involved. This is relevant to any downstream logic that filters on `IS NULL` to detect "no match" — the classic anti-join pattern.

### UNIQUE constraint and NULL

SQL Server treats `NULL` values in `UNIQUE` constraints differently from the ANSI SQL standard. ANSI SQL says `UNIQUE` should allow any number of `NULL` values because `NULL <> NULL` (three-valued logic). SQL Server implements a stricter rule: at most **one** `NULL` is permitted in a `UNIQUE` constraint column, because for index purposes SQL Server treats NULLs as equal when checking uniqueness.

This discrepancy only matters when creating a `UNIQUE` constraint or a unique index; as a querying concern, the key consequence is that counting `NULL` values requires explicit `CASE` or `SUM` expressions because `COUNT(DISTINCT v)` skips `NULL` entirely.

*Count total rows, distinct non-null values, and `NULL` values in a sample set.*

```sql
SELECT
    COUNT(*)                                  AS total_rows,
    COUNT(DISTINCT v)                         AS distinct_non_null,
    SUM(CASE WHEN v IS NULL THEN 1 ELSE 0 END) AS null_count
FROM (VALUES (1), (2), (NULL), (NULL), (3), (1)) AS t(v);
```

| total_rows | distinct_non_null | null_count |
|---|---|---|
| 6 | 3 | 2 |

Six rows total. `COUNT(DISTINCT v)` returns 3 — the distinct non-null values `{1, 2, 3}`, skipping both `NULL` rows and the duplicate `1`. The `CASE`-based null count returns 2.

## ISNULL, COALESCE, and NULLIF

> [!abstract] Three fallback functions, three different use cases
>
> T-SQL has three functions for replacing or introducing `NULL` values:
>
> - **`ISNULL(check, replacement)`** — SQL Server-specific. Returns `check` if non-null, otherwise `replacement`. Takes exactly two arguments. Returns the type of the **first** argument.
> - **`COALESCE(a, b, c, ...)`** — ANSI-standard. Returns the first non-null expression in the list. Takes any number of arguments. Returns the highest-precedence type across all arguments.
> - **`NULLIF(a, b)`** — ANSI-standard. Returns `NULL` if `a = b`, otherwise `a`. The inverse of the first two: it **introduces** `NULL` rather than replacing it.
>
> The Microsoft [COALESCE (Transact-SQL)](https://learn.microsoft.com/en-us/sql/t-sql/language-elements/coalesce-transact-sql) reference documents five concrete differences between `ISNULL` and `COALESCE`:
>
> - **Evaluation count.** `ISNULL` is a built-in function evaluated once. `COALESCE` is rewritten as a `CASE` expression and can evaluate its arguments multiple times.
> - **Return type.** `ISNULL` returns the type of the first argument. `COALESCE` returns the highest-precedence type across all arguments.
> - **Nullability.** `ISNULL(col, non_null_literal)` is deterministically `NOT NULL`. `COALESCE(col, non_null_literal)` is always considered nullable by the optimizer (used to matter for computed column persistence).
> - **Validation rules.** `ISNULL` allows a literal `NULL` as the first argument (returns the type of the second). `COALESCE` requires at least one typed argument.
> - **Argument count.** `ISNULL` takes exactly 2 arguments. `COALESCE` takes 2 or more.

### ISNULL

`ISNULL(check, replacement)` returns `check` if it is not `NULL`, otherwise it returns `replacement`. The return type is always the type of the first argument, which can cause subtle bugs when `replacement` has a different length or scale.

#### ISNULL basic fallback

*Three calls showing the basic `ISNULL` behavior.*

```sql
SELECT
    ISNULL(NULL, 'fallback')     AS null_replaced,
    ISNULL('actual', 'fallback') AS not_null_kept,
    ISNULL(NULL, 0)              AS numeric_fallback;
```

| null_replaced | not_null_kept | numeric_fallback |
|---|---|---|
| fallback | actual | 0 |

When `check` is `NULL`, `replacement` is returned. When `check` has a value, `replacement` is ignored. The function is short-circuited: `replacement` is evaluated only when needed — a difference from `COALESCE` documented below.

#### ISNULL truncation trap: return type follows the first argument

> [!danger] ISNULL truncates the replacement to the length of the first argument
>
> The most common `ISNULL` bug is silent truncation. Because `ISNULL` returns the **type** of the first argument — including its length for `varchar`/`nvarchar` — the second argument is implicitly cast to that length, even if it is a literal that is too long. `ISNULL(varchar(2), 'UNK')` returns `'UN'`, not `'UNK'`, because the literal is truncated to length 2 to match the first argument's declared type.

*Show truncation: `ISNULL(varchar(2), 'UNK')` produces `'UN'`, not `'UNK'`.*

```sql
DECLARE @col varchar(2) = NULL;
SELECT
    ISNULL(@col, 'UNK')   AS isnull_truncated,
    COALESCE(@col, 'UNK') AS coalesce_full;
```

| isnull_truncated | coalesce_full |
|---|---|
| UN | UNK |

The `@col` variable has declared type `varchar(2)`. `ISNULL` preserves that type and implicitly casts the literal `'UNK'` (length 3) down to length 2, silently dropping the `'K'`. `COALESCE`, in contrast, follows the `CASE` expression rules and returns the highest-precedence type across all arguments — in this case `varchar(3)` from the `'UNK'` literal — so no truncation occurs.

> [!success] Use COALESCE when the fallback length can differ
>
> When the fallback value can be longer than the column's declared length, use `COALESCE`. It evaluates the common type across all arguments and preserves the longer length. If you must use `ISNULL` (for example for computed-column nullability — see below), explicitly widen the first argument with `CAST(@col AS varchar(10))` before passing it to `ISNULL`.

### COALESCE

`COALESCE(a, b, c, ...)` returns the first non-null expression from its argument list. The return type is the highest-precedence type across all arguments, following the same rules as `CASE`. The optimizer rewrites `COALESCE` as a `CASE WHEN ... THEN ... END` expression internally.

#### Cascading fallbacks with COALESCE

*Resolve a code column using three fallback columns and a final literal.*

```sql
SELECT
    symbol_code,
    region_code,
    country_code,
    COALESCE(symbol_code, region_code, country_code, 'UNK') AS resolved_code
FROM (VALUES
    (CAST('US'   AS varchar(10)), CAST('NA'    AS varchar(10)), CAST('USA'    AS varchar(10))),
    (NULL,                         CAST('EU'    AS varchar(10)), CAST('FRA'    AS varchar(10))),
    (NULL,                         NULL,                         CAST('BRA'    AS varchar(10))),
    (NULL,                         NULL,                         NULL)
) AS t(symbol_code, region_code, country_code);
```

| symbol_code | region_code | country_code | resolved_code |
|---|---|---|---|
| US | NA | USA | US |
| NULL | EU | FRA | EU |
| NULL | NULL | BRA | BRA |
| NULL | NULL | NULL | UNK |

Row-by-row walk-through:

- Row 1 — all four candidates non-null; `symbol_code` wins because it is first.
- Row 2 — `symbol_code` is `NULL`; fall through to `region_code` which is `'EU'`.
- Row 3 — both `symbol_code` and `region_code` are `NULL`; fall through to `country_code` which is `'BRA'`.
- Row 4 — all three columns are `NULL`; fall through to the literal `'UNK'`.

This is the canonical use case for `COALESCE`: express a priority-ordered list of fallbacks in a single readable expression rather than nesting multiple `ISNULL` calls or writing a long `CASE`.

#### COALESCE is a syntactic CASE

*Verify that `COALESCE(a, b, c)` produces the same result as the equivalent `CASE` expression.*

```sql
SELECT
    COALESCE(a, b, c) AS via_coalesce,
    CASE
        WHEN a IS NOT NULL THEN a
        WHEN b IS NOT NULL THEN b
        ELSE c
    END AS via_case
FROM (VALUES
    (1,    2,    3),
    (NULL, 20,   30),
    (NULL, NULL, 300)
) AS t(a, b, c);
```

| via_coalesce | via_case |
|---|---|
| 1 | 1 |
| 20 | 20 |
| 300 | 300 |

The two forms produce identical output for every input. The optimizer literally rewrites `COALESCE` as the `CASE` form before execution — this is not a heuristic, it is documented in the Microsoft reference.

> [!warning] COALESCE evaluates its arguments multiple times
>
> Because the `CASE` rewrite checks each argument twice (once with `IS NOT NULL`, once as the return value), a `COALESCE` expression that contains a subquery or a volatile function may execute that subquery **twice**. In a multi-user environment under `READ COMMITTED` isolation, the two evaluations can return different values — for example, `COALESCE((SELECT col FROM t WHERE id = 1), 0)` can return `0` even when the subquery non-deterministically produces a non-null value.

*Example from Microsoft docs — wrap the subquery in a derived table so it is evaluated exactly once.*

```sql
SELECT CASE WHEN x IS NOT NULL THEN x ELSE 1 END
FROM (SELECT (SELECT col FROM SomeTable WHERE id = 1) AS x) AS sub;
```

> [!success] Use ISNULL if the argument is a volatile subquery
>
> For the specific case of a fallback involving a subquery, prefer `ISNULL` over `COALESCE`. `ISNULL` is a built-in function and guarantees single evaluation of each argument.

#### COALESCE with all-NULL arguments

`COALESCE` requires at least one of its arguments to have a **determinable type** — typically via an explicit `CAST` or a non-null operand. A call like `COALESCE(NULL, NULL, NULL)` where every argument is the untyped literal `NULL` raises error 4127.

*Legal — one argument has an explicit type.*

```sql
SELECT COALESCE(CAST(NULL AS varchar(10)), NULL, NULL) AS typed_all_null;
```

| typed_all_null |
|---|
| NULL |

The first argument is `CAST(NULL AS varchar(10))`, which has a known type. The result is `NULL` of type `varchar(10)`.

> [!failure] All-NULL untyped COALESCE fails
>
> Without at least one typed argument, `COALESCE` cannot determine the result type and raises error 4127.

*Trigger error 4127.*

```sql
SELECT COALESCE(NULL, NULL, NULL) AS untyped_all_null;
```

```text
Msg 4127, Level 16, State 1
At least one of the arguments to COALESCE must be an expression that is not the NULL constant.
```

> [!success] Cast at least one argument explicitly
>
> If the caller genuinely needs a typed `NULL` result, cast the first argument: `COALESCE(CAST(NULL AS int), NULL)`. In practice this situation is rare; the usual fix is to replace the last argument with a non-null default.

#### Nullability: ISNULL is deterministic, COALESCE is not

A subtle but operationally important difference: the SQL Server optimizer treats the **result** of `ISNULL(col, non_null_constant)` as non-nullable (because the function is deterministic), but treats `COALESCE(col, non_null_constant)` as **potentially nullable** even though the last argument is a non-null literal. This matters in three places:

- **Computed columns.** A computed column based on `ISNULL(...)` can be marked `NOT NULL` and persisted; a computed column based on `COALESCE(...)` is always nullable.
- **Key and index constraints.** A `PRIMARY KEY` or `UNIQUE` constraint cannot be defined on a column whose nullability cannot be guaranteed.
- **Partition switching.** Source and target tables must match on nullability for partition switch operations. `ISNULL` preserves the `NOT NULL` guarantee; `COALESCE` does not.

For ordinary query writing this rarely matters. For schema design and ETL pipelines it is the reason the Microsoft [CTAS documentation](https://learn.microsoft.com/en-us/azure/synapse-analytics/sql-data-warehouse/sql-data-warehouse-develop-ctas) explicitly recommends `ISNULL` over `COALESCE` when preserving nullability is required.

### NULLIF

`NULLIF(a, b)` returns `NULL` if `a = b`, otherwise it returns `a`. It is the inverse of `ISNULL` and `COALESCE` — instead of replacing `NULL` with a value, it introduces `NULL` when a sentinel or zero value should be treated as missing. The optimizer rewrites `NULLIF(a, b)` as the equivalent `CASE WHEN a = b THEN NULL ELSE a END`.

#### NULLIF basic cases

*Test four inputs against the `NULLIF` behavior.*

```sql
SELECT
    NULLIF(5, 5)        AS equal_returns_null,
    NULLIF(5, 10)       AS unequal_returns_first,
    NULLIF('', '')      AS empty_string_to_null,
    NULLIF('value', '') AS non_empty_preserved;
```

| equal_returns_null | unequal_returns_first | empty_string_to_null | non_empty_preserved |
|---|---|---|---|
| NULL | 5 | NULL | value |

The four columns show the complete NULLIF behavior:

- `NULLIF(5, 5)` → `NULL` (the equal case)
- `NULLIF(5, 10)` → `5` (the unequal case, returns the first argument)
- `NULLIF('', '')` → `NULL` (empty-string to NULL is a common idiom)
- `NULLIF('value', '')` → `'value'` (non-empty string preserved)

#### NULLIF for divide-by-zero protection

The most common use of `NULLIF` is as the denominator of a division, to convert a zero divisor into `NULL` and thereby avoid the "divide by zero" error. Since any arithmetic with `NULL` returns `NULL`, the overall division result becomes `NULL` instead of raising an error.

*Protect a division from divide-by-zero using `NULLIF`.*

```sql
SELECT
    numerator,
    denominator,
    numerator / NULLIF(denominator, 0) AS safe_ratio
FROM (VALUES
    (100, 4),
    (50,  0),
    (75,  3),
    (200, 0),
    (10,  2)
) AS m(numerator, denominator);
```

| numerator | denominator | safe_ratio |
|---|---|---|
| 100 | 4 | 25 |
| 50 | 0 | NULL |
| 75 | 3 | 25 |
| 200 | 0 | NULL |
| 10 | 2 | 5 |

The three rows with non-zero denominators produce the correct quotient. The two rows with zero denominators produce `NULL` instead of raising error 8134 (divide by zero). This is the idiomatic T-SQL divide-by-zero guard and should be reflexive whenever a denominator can be zero.

#### NULLIF for sentinel-value cleanup

Another common use is converting "missing" sentinel values (`-1`, `0`, `'N/A'`, or similar) into `NULL` so that downstream aggregates and joins skip them cleanly.

*Convert `-1` sentinels into `NULL`.*

```sql
SELECT
    raw_value,
    NULLIF(raw_value, -1) AS cleaned
FROM (VALUES (10), (-1), (20), (-1), (30)) AS t(raw_value);
```

| raw_value | cleaned |
|---|---|
| 10 | 10 |
| -1 | NULL |
| 20 | 20 |
| -1 | NULL |
| 30 | 30 |

The two `-1` rows become `NULL` in the `cleaned` column. Aggregates like `AVG(cleaned)` will now skip them automatically and compute the average of the three real values instead.

#### NULLIF is a syntactic CASE

*Verify that `NULLIF(a, b)` produces the same result as the equivalent `CASE` expression.*

```sql
SELECT
    NULLIF(a, b)                           AS via_nullif,
    CASE WHEN a = b THEN NULL ELSE a END   AS via_case
FROM (VALUES (5, 5), (5, 10), (NULL, 5), (5, NULL)) AS t(a, b);
```

| via_nullif | via_case |
|---|---|
| NULL | NULL |
| 5 | 5 |
| NULL | NULL |
| 5 | 5 |

The four input pairs test all relevant combinations: equal non-null, unequal non-null, NULL-first, NULL-second. The two `NULL`-involving cases both return `NULL` because `NULL = anything` is `UNKNOWN`, which falls through the `CASE` — making `NULLIF` consistent with three-valued logic.

## CASE, IIF, and CHOOSE

> [!abstract] Three conditional expression functions
>
> T-SQL exposes three conditional expression functions, listed in order of flexibility:
>
> - **`CASE`** — the full general-purpose conditional expression. Supports any number of branches, arbitrary Boolean conditions (`searched CASE`) or equality tests (`simple CASE`), and is the ANSI-standard form. Covered in depth in [01-select-and-query-basics](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/01-select-and-query-basics#case-conditional-projection-and-sorting-logic).
> - **`IIF(condition, true_value, false_value)`** — a two-branch shorthand. Internally rewritten as a `CASE WHEN condition THEN true_value ELSE false_value END`. Familiar to users coming from Excel and SQL Server Reporting Services expressions.
> - **`CHOOSE(index, val_1, val_2, ..., val_n)`** — one-based indexed selection. Returns `val_index` or `NULL` if the index is out of range. Useful for translating an integer lookup key into a short enumerated list of values.
>
> This section covers `IIF` and `CHOOSE` (referring to the `01-select-and-query-basics` note for the full `CASE` treatment) and the single most common `CASE` evaluation trap: aggregate expressions inside `WHEN` clauses are evaluated before the `CASE` short-circuits.

### CASE

The `CASE` expression is covered in full detail in the `## CASE, Conditional Projection, and Sorting Logic` section of the [01-select-and-query-basics](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/01-select-and-query-basics) note. That note covers:

- **Simple CASE** (`CASE expr WHEN value THEN result WHEN value THEN result ... END`) — equality-only lookup form.
- **Searched CASE** (`CASE WHEN bool_expr THEN result WHEN bool_expr THEN result ... END`) — arbitrary Boolean conditions, the more flexible form.
- **CASE in ORDER BY** — for custom sort sequences that do not match any natural column order.
- **Conditional aggregation** — `SUM(CASE WHEN cond THEN 1 ELSE 0 END)` for counting rows that satisfy a condition inside a `GROUP BY`.
- **CASE branch type precedence trap** — when branches return different types, the highest-precedence type wins and the query can fail at runtime if a lower-precedence branch cannot be converted.

The rule of thumb is: use `CASE` whenever the logic has more than two branches, involves non-equality conditions, or needs to be portable to other SQL dialects. Fall back to `IIF` or `CHOOSE` only in the specific cases they were designed for.

### IIF

`IIF(condition, true_value, false_value)` is a two-branch shorthand for `CASE WHEN condition THEN true_value ELSE false_value END`. It takes exactly three arguments: a Boolean condition, a value to return when the condition is `TRUE`, and a value to return when the condition is `FALSE` or `UNKNOWN`.

The return type follows the same data-type precedence rules as `CASE`: the return type is the highest-precedence type across the two value arguments.

#### IIF basic usage

*Three `IIF` calls covering a basic boolean, a `NULL` check, and an integer branch.*

```sql
SELECT
    IIF(5 > 3, 'yes', 'no')        AS simple_bool,
    IIF(NULL IS NULL, 'is', 'not') AS null_check,
    IIF(1 = 2, 100, 200)           AS type_int;
```

| simple_bool | null_check | type_int |
|---|---|---|
| yes | is | 200 |

The three calls show the core behavior: `IIF(TRUE, a, b)` returns `a`, `IIF(FALSE, a, b)` returns `b`. Note that `NULL IS NULL` is a real Boolean expression (it returns `TRUE`), so the second call works correctly.

#### IIF on a real table

*Classify each trading day as UP or DOWN based on close vs open price.*

```sql
SELECT TOP (5)
    symbol,
    close_price,
    open_price,
    IIF(close_price >= open_price, 'UP', 'DOWN') AS day_direction
FROM dbo.stock_prices
WHERE symbol = 'AAPL'
  AND trade_date >= '2025-01-01'
ORDER BY trade_date;
```

| symbol | close_price | open_price | day_direction |
|---|---|---|---|
| AAPL | 242.53 | 247.58 | DOWN |
| AAPL | 242.04 | 242.04 | UP |
| AAPL | 243.67 | 242.98 | UP |
| AAPL | 240.89 | 241.66 | DOWN |
| AAPL | 241.38 | 240.61 | UP |

The `IIF(close_price >= open_price, 'UP', 'DOWN')` expression produces a two-value classification in a more compact form than the equivalent `CASE WHEN close_price >= open_price THEN 'UP' ELSE 'DOWN' END`. For truly two-branch logic this is the cleanest form.

> [!tip] Use IIF only for genuinely two-branch logic
>
> Nested `IIF` calls become unreadable fast. As soon as the logic has three or more branches, switch to `CASE` — it is clearer, more portable, and equivalent in performance (the optimizer rewrites `IIF` as `CASE` anyway).

### CHOOSE

`CHOOSE(index, val_1, val_2, ..., val_n)` returns the value at the given 1-based index, or `NULL` if the index is out of range (less than 1 or greater than the number of values). It is the T-SQL equivalent of Excel's `CHOOSE` and is primarily useful for translating a small integer key into a short enumerated list of string labels.

The return type follows the same data-type precedence rules as `CASE`: the return type is the highest-precedence type across all value arguments.

#### CHOOSE basic usage

*Pick by index, and show the out-of-range behavior.*

```sql
SELECT
    CHOOSE(1, 'first', 'second', 'third') AS pick_1,
    CHOOSE(3, 'first', 'second', 'third') AS pick_3,
    CHOOSE(0, 'first', 'second', 'third') AS pick_0_out_of_range,
    CHOOSE(5, 'first', 'second', 'third') AS pick_5_out_of_range;
```

| pick_1 | pick_3 | pick_0_out_of_range | pick_5_out_of_range |
|---|---|---|---|
| first | third | NULL | NULL |

Valid indexes return the corresponding value. Indexes 0 and 5 (both outside the `[1..3]` range) return `NULL` rather than raising an error.

#### CHOOSE for day-of-week labels

*Use `CHOOSE` with `DATEPART(weekday, ...)` to render human-readable day names.*

```sql
SELECT TOP (5)
    symbol,
    trade_date,
    DATEPART(weekday, trade_date) AS weekday_num,
    CHOOSE(DATEPART(weekday, trade_date),
           'Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday') AS day_name
FROM dbo.stock_prices
WHERE symbol = 'AAPL'
  AND trade_date >= '2025-01-01'
ORDER BY trade_date;
```

| symbol | trade_date | weekday_num | day_name |
|---|---|---|---|
| AAPL | 2025-01-02 | 5 | Thursday |
| AAPL | 2025-01-03 | 6 | Friday |
| AAPL | 2025-01-06 | 2 | Monday |
| AAPL | 2025-01-07 | 3 | Tuesday |
| AAPL | 2025-01-08 | 4 | Wednesday |

`DATEPART(weekday, ...)` returns an integer 1-to-7 (the exact mapping depends on the session's `DATEFIRST` setting; on this server Sunday = 1). `CHOOSE` translates that integer into the matching day-name string. The equivalent `CASE` expression would need seven `WHEN` branches and is harder to read.

> [!tip] CHOOSE is brittle if the index list grows
>
> `CHOOSE` is fine for fixed, short lists. If the list of values might grow or needs to be shared across multiple queries, store them in a lookup table and `JOIN` against it — that is more maintainable and produces better execution plans.

### CASE aggregate-first evaluation trap

> [!danger] Aggregates inside WHEN clauses evaluate before the CASE short-circuits
>
> A `CASE` expression normally stops evaluating at the first `WHEN` that matches. For example, `CASE WHEN x > 0 THEN 1 / x ELSE 0 END` is safe because the division only runs when `x > 0`. **But aggregate functions break this short-circuit.** When a `WHEN` clause references an aggregate like `MAX(1/value)` or `SUM(x/y)`, SQL Server computes the aggregate **before** evaluating the `CASE`, so the division happens over the full rowset including rows that would have been filtered out by an earlier `WHEN`. This rule is documented in the Microsoft [CASE (Transact-SQL)](https://learn.microsoft.com/en-us/sql/t-sql/language-elements/case-transact-sql) reference.

*Reproduction from the Microsoft docs — the divide-by-zero fires even though the earlier `WHEN` should catch it.*

```sql
WITH Data(value) AS
(
    SELECT 0
    UNION ALL
    SELECT 1
)
SELECT
    CASE
        WHEN MIN(value) <= 0 THEN 0
        WHEN MAX(1 / value) >= 100 THEN 1
    END AS result
FROM Data;
```

```text
Msg 8134, Level 16, State 1
Divide by zero error encountered.
```

The intuition is: "the first `WHEN` matches (0 is ≤ 0), so the second `WHEN` should never run". But `MAX(1/value)` is an aggregate — SQL Server computes it by iterating the entire rowset of `Data` before the `CASE` begins evaluation, and the `1/0` on the first row raises error 8134 before the `CASE` logic gets a chance to short-circuit.

> [!success] Protect aggregate expressions with NULLIF or filter first
>
> Two fixes are available:
>
> - Guard each risky expression individually: `MAX(1 / NULLIF(value, 0))` converts the zero denominator to `NULL`, which propagates cleanly through the aggregate.
> - Filter the source rowset before the `CASE` runs: `SELECT ... FROM Data WHERE value > 0` eliminates the zero row entirely.
>
> Microsoft's docs explicitly warn: "You should only depend on order of evaluation of the `WHEN` conditions for scalar expressions (including noncorrelated subqueries that return scalars), not for aggregate expressions."

## Collation and Comparison Semantics

> [!abstract] Collation governs all string comparison and sorting
>
> A **collation** is a set of rules that define how SQL Server compares, orders, and stores character data. It controls:
>
> - **Case sensitivity** (`CI` / `CS`) — whether `'apple' = 'Apple'`
> - **Accent sensitivity** (`AI` / `AS`) — whether `'café' = 'cafe'`
> - **Kana sensitivity** (`KI` / `KS`) — Japanese hiragana vs katakana
> - **Width sensitivity** (`WI` / `WS`) — half-width vs full-width characters (CJK)
> - **Sort order** — the locale-specific ordering of characters (e.g. Spanish `ñ` sorts after `n`, Swedish `å` sorts after `z`)
> - **Code page** — for non-Unicode (`varchar`) columns, which 256-character set is usable
> - **UTF-8 support** (`_UTF8` suffix) — whether `varchar`/`char` columns can store arbitrary Unicode using UTF-8 encoding
>
> Collation applies at four levels with cascading precedence: **server** → **database** → **column** → **expression**. Lower levels override higher levels. Expression-level `COLLATE` is the finest-grain control and is used to work around collation mismatches in specific comparisons without changing schema.
>
> The Microsoft [Collation and Unicode support](https://learn.microsoft.com/en-us/sql/relational-databases/collations/collation-and-unicode-support) reference documents the full system.

### Collation levels and discovery

SQL Server collation lives at four levels. When two values are compared, SQL Server picks a "winning" collation based on a precedence rule described in the Microsoft [Collation precedence](https://learn.microsoft.com/en-us/sql/t-sql/statements/collation-precedence-transact-sql) reference. If the two sides have incompatible explicit collations, the comparison fails with error 468.

#### Server-level and database-level default collation

*Query the server and current database collation.*

```sql
SELECT
    SERVERPROPERTY('Collation')                 AS server_collation,
    DATABASEPROPERTYEX(DB_NAME(), 'Collation')  AS database_collation;
```

| server_collation | database_collation |
|---|---|
| SQL_Latin1_General_CP1_CI_AS | SQL_Latin1_General_CP1_CI_AS |

The local `Elysium` instance uses `SQL_Latin1_General_CP1_CI_AS`:

- `SQL_` — a legacy "SQL collation" (as opposed to a Windows collation). SQL collations have different sort behavior for `varchar` vs `nvarchar`; modern installations should prefer Windows collations like `Latin1_General_100_CI_AS`.
- `Latin1_General` — Latin-1 alphabet, Western European locales.
- `CP1` — code page 1252 (Windows-1252 Western European).
- `CI` — case-insensitive.
- `AS` — accent-sensitive.

#### Column-level collation

Each `char`/`varchar`/`nchar`/`nvarchar` column has its own collation. If not specified at column creation time, the column inherits the database default.

*List the collation of every character column in `dbo.stock_prices`.*

```sql
SELECT
    COLUMN_NAME,
    COLLATION_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'dbo'
  AND TABLE_NAME   = 'stock_prices'
  AND COLLATION_NAME IS NOT NULL;
```

| COLUMN_NAME | COLLATION_NAME |
|---|---|
| symbol | SQL_Latin1_General_CP1_CI_AS |

`stock_prices` has only one character column (`symbol`), and it inherits the database default. Numeric and date columns have no collation. Changing a column's collation requires `ALTER TABLE ... ALTER COLUMN ... COLLATE ...`, which is a metadata operation on Windows collations but requires a full rebuild when code page changes.

### Case sensitivity: CI vs CS

The most common reason to override collation at the expression level is to switch between case-insensitive and case-sensitive comparison without changing the column's stored collation.

#### Case-insensitive default

*Compare `'apple'` against a set of case variants using the column's default collation.*

```sql
SELECT v
FROM (VALUES ('apple'), ('Apple'), ('APPLE'), ('banana')) AS t(v)
WHERE v = 'apple';
```

| v |
|---|
| apple |
| Apple |
| APPLE |

All three `'apple'` variants match because the database default collation is `CI` (case-insensitive). Only the literal `'banana'` is excluded.

#### Explicit case-sensitive comparison

*Override the comparison with `COLLATE Latin1_General_CS_AS` to force case-sensitive matching.*

```sql
SELECT v
FROM (VALUES ('apple'), ('Apple'), ('APPLE'), ('banana')) AS t(v)
WHERE v = 'apple' COLLATE Latin1_General_CS_AS;
```

| v |
|---|
| apple |

Only the exact match `'apple'` survives because the `CS` suffix forces case-sensitive comparison. This pattern is the fastest way to implement case-sensitive text search on a column whose default collation is case-insensitive — at the cost of defeating any index on the column (the collation override is a scalar function on the column, which is not SARGable).

### Accent sensitivity: AI vs AS

Accent sensitivity controls whether diacritic marks affect comparison: `'café'` vs `'cafe'`, `'naïve'` vs `'naive'`, `'über'` vs `'uber'`.

#### Accent-insensitive comparison

*Match `'cafe'` against three variants using `CI_AI` (case-insensitive + accent-insensitive).*

```sql
SELECT v
FROM (VALUES ('cafe'), ('café'), ('CAFÉ')) AS t(v)
WHERE v = 'cafe' COLLATE Latin1_General_CI_AI;
```

| v |
|---|
| cafe |
| café |
| CAFÉ |

All three rows match because `CI_AI` ignores both case and accents. The `é` and `É` are treated as equal to `e` for comparison purposes.

#### Accent-sensitive comparison

*The same data with `CI_AS` (case-insensitive but accent-**sensitive**).*

```sql
SELECT v
FROM (VALUES ('cafe'), ('café'), ('CAFÉ')) AS t(v)
WHERE v = 'cafe' COLLATE Latin1_General_CI_AS;
```

| v |
|---|
| cafe |

Only the exact accent-free `'cafe'` matches. The `'café'` and `'CAFÉ'` variants are now considered different strings. This is the correct behavior for content where accents carry meaning (French, Spanish, German, Italian text) and the wrong behavior for search boxes where users are expected to type without diacritics.

### Collation in ORDER BY

Sort order depends on the locale of the collation. Spanish sorts `ñ` as a distinct letter between `n` and `o`. Swedish sorts `å`, `ä`, `ö` at the end of the alphabet, after `z`. The Microsoft example below shows four Spanish place names sorted under a Latin-1 collation.

*Sort four Spanish place names using a case-sensitive, accent-sensitive Latin-1 collation.*

```sql
SELECT place
FROM (VALUES ('Chiapas'), ('Colima'), ('Cinco Rios'), ('California')) AS t(place)
ORDER BY place COLLATE Latin1_General_CS_AS_KS_WS ASC;
```

| place |
|---|
| California |
| Chiapas |
| Cinco Rios |
| Colima |

The expression-level `COLLATE` overrides whatever sort rules the column's own collation would have used. A traditional Spanish collation (`Traditional_Spanish_CI_AI`) would sort `Chiapas` and `Colima` before `Cinco Rios` because the historical `ch` digraph was treated as a single letter after `c` — this is the kind of locale-specific behavior that only a locale-aware collation can produce.

### Collation conflict errors and DATABASE_DEFAULT fix

When two expressions with different explicit collations are compared, SQL Server raises error 468 ("Cannot resolve collation conflict"). The collation precedence rule only auto-resolves when one side has an **explicit** collation and the other has an **implicit** collation — two explicit collations on either side produce a conflict that must be resolved by the caller.

#### Triggering a collation conflict

> [!failure] Two explicit collations on either side cannot be compared directly
>
> SQL Server raises error 468 at parse time. The error message includes both collations involved in the conflict so the caller can decide which one to keep.

*Force a conflict by applying two different explicit collations to the two sides of an equality comparison.*

```sql
SELECT v
FROM (VALUES ('apple')) AS t(v)
WHERE v COLLATE Latin1_General_CS_AS = v COLLATE French_CI_AS;
```

```text
Msg 468, Level 16, State 9
Cannot resolve the collation conflict between "French_CI_AS" and "Latin1_General_CS_AS"
in the equal to operation.
```

> [!success] Force both sides to the database default or a chosen collation
>
> The idiomatic fix is to wrap both sides in `COLLATE DATABASE_DEFAULT` (or any explicit collation both sides should use). This pushes both operands to the same collation and the comparison proceeds.

*Resolve the conflict by coercing both sides to `DATABASE_DEFAULT`.*

```sql
SELECT v
FROM (VALUES ('apple')) AS t(v)
WHERE (v COLLATE Latin1_General_CS_AS) COLLATE DATABASE_DEFAULT
    = (v COLLATE French_CI_AS)         COLLATE DATABASE_DEFAULT;
```

| v |
|---|
| apple |

Both explicit collations are overridden by the outer `COLLATE DATABASE_DEFAULT`, which uses the current database's default collation. The comparison now succeeds and the row is returned.

This trap most commonly appears when joining columns from a user database to temporary tables or `tempdb`-scoped objects. Temp tables inherit the **tempdb** collation, not the user database's collation, so a `JOIN` between `userDB.Schema.Tbl.col COLLATE userCollation` and `#tmp.col COLLATE tempdbCollation` raises error 468 unless one side is coerced.

### UTF-8 collations (SQL Server 2019+)

Since SQL Server 2019, Windows collations with the `_UTF8` suffix allow `char` and `varchar` columns to store arbitrary Unicode characters using UTF-8 encoding. This is fundamentally different from the older behavior: pre-2019, `varchar` was locked to a single 256-character code page, and any character outside that page was impossible to store without using `nvarchar`.

The storage tradeoff between UTF-8 and UTF-16 depends on the character distribution:

- **ASCII-heavy text** (English, tickers, codes) — `varchar(_UTF8)` is 1 byte per character; `nvarchar` is 2 bytes. Roughly 50% storage savings.
- **European Latin-script text with some accents** — `varchar(_UTF8)` is 1–2 bytes per character; `nvarchar` is 2 bytes. Smaller savings.
- **East Asian text (CJK)** — `varchar(_UTF8)` is 3 bytes per character; `nvarchar` is 2 bytes. **UTF-8 is worse** for CJK-heavy workloads.

### Discovering available collations

SQL Server ships with hundreds of collations. Use `sys.fn_helpcollations()` to list them.

*List the first five Latin1_General_100 collations.*

```sql
SELECT TOP (5) name, description
FROM sys.fn_helpcollations()
WHERE name LIKE 'Latin1_General_100%'
ORDER BY name;
```

| name | description |
|---|---|
| Latin1_General_100_BIN | Latin1-General-100, binary sort |
| Latin1_General_100_BIN2 | Latin1-General-100, binary code point comparison sort |
| Latin1_General_100_BIN2_UTF8 | Latin1-General-100, binary code point comparison sort, UTF8 |
| Latin1_General_100_CI_AI | Latin1-General-100, case-insensitive, accent-insensitive, kanatype-insensitive, width-insensitive |
| Latin1_General_100_CI_AI_KS | Latin1-General-100, case-insensitive, accent-insensitive, kanatype-sensitive, width-insensitive |

The `_100` in the name refers to collation **version 100**, introduced with SQL Server 2008 and updated in SQL Server 2017 (version 140 for some cultures). Newer versions have more accurate locale rules; prefer `_100` or higher over older unversioned collations (e.g. plain `Latin1_General_CI_AS`) in new schema.

## Practical Guidance

A short checklist of habits derived from the traps and rules covered above. Each item cross-references the relevant subsection.

- **Prefer explicit conversion** over relying on implicit type precedence. See the `## Type Precedence and Implicit Conversions` section and the worked `int + varchar` trap.
- **Use `TRY_CAST` / `TRY_CONVERT`** at ingestion boundaries where malformed input is expected. Do not use them in core business logic where conversion failure should be visible.
- **Use `IS NULL` / `IS NOT NULL`** for null checks. Never write `= NULL` or `<> NULL` — see the `## NULL, Three-Valued Logic, and Safe Null Handling` section.
- **Use `NULLIF(denominator, 0)`** to guard divisions against divide-by-zero errors. See the `### NULLIF` subsection.
- **Prefer `COALESCE` for cascading fallbacks**, `ISNULL` for single-argument fallback with guaranteed nullability. Mind the `ISNULL` truncation trap when the first argument is a short `varchar`. See the `## ISNULL, COALESCE, and NULLIF` section.
- **Match application parameter types to column types** to avoid hidden implicit conversions that defeat index seeks. See the `#### Implicit conversion on the indexed side defeats seek` subsection.
- **Prefer `datetime2(n)` over `datetime`** for all new schema. Use `datetime2(3)` for millisecond precision (7 bytes) instead of legacy `datetime` (8 bytes with 3.33 ms rounding).
- **Prefer `decimal(p, s)` over `float`** for any financial, deterministic, or equality-comparable amounts. Use `float` only for scientific workloads where the approximation is acceptable.
- **Cast `int` to `bigint` before aggregating** when the sum might exceed 2.1 billion. `SUM` inherits the operand type and overflows at `int_max`.
- **Always prefix Unicode literals with `N`** when the target column is `nchar`/`nvarchar`. Bare literals are parsed as `varchar` first and can silently lose non-ASCII characters.
- **Prefer `CONCAT` / `CONCAT_WS` over `+`** for string concatenation when NULL-skipping is desired. The `+` operator propagates `NULL`.
- **Use `CASE` by default** for conditional expressions; fall back to `IIF` only for two-branch logic and to `CHOOSE` only for small fixed indexed lookups.
- **Avoid aggregates inside CASE `WHEN` clauses** unless the aggregate expression is safe on every row. Aggregates are evaluated before the `CASE` short-circuits.
- **Resolve collation conflicts with `COLLATE DATABASE_DEFAULT`** when comparing strings from different sources (user database vs `tempdb`, server A vs server B).
