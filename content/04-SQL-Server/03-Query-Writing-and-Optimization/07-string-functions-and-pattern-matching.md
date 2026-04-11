---
title: "07 - String Functions and Pattern Matching"
tags: [sql-server, tsql, query-writing]
aliases: [text functions, pattern matching, CHARINDEX, PATINDEX, STRING_AGG, STRING_SPLIT, LIKE, COLLATE]
description: "T-SQL reference for SQL Server string functions, pattern matching, Unicode and collation handling, splitting and aggregation, identifier safety, and text parsing patterns backed by live `stoxx` database output."
created: 2026-04-08
updated: 2026-04-11
status: complete
---

# String Functions and Pattern Matching

> [!abstract] Scope of this note
>
> Text handling in T-SQL is deceptively dense. The same `varchar` column can silently change meaning across collations, truncate invisibly under Unicode rules, kill an index seek with a wrapper function, or round-trip incorrectly through a missing `N` prefix. This note is the authoritative reference for string-level T-SQL. It covers:
>
> - the `char`/`varchar`/`nchar`/`nvarchar` family with storage, padding, and Unicode rules
> - `LEN` vs `DATALENGTH` and the byte/character distinction
> - `CONCAT`, `CONCAT_WS`, `STRING_AGG`, and the legacy `STUFF + FOR XML PATH` aggregation pattern
> - `LEFT`, `RIGHT`, `SUBSTRING`, `STUFF`, `REPLACE`, `TRANSLATE`, `REVERSE`, `REPLICATE`, `SPACE`
> - `TRIM`, `LTRIM`, `RTRIM`, `LOWER`, `UPPER`, and the non-SARGable predicate traps
> - pattern matching with `CHARINDEX`, `PATINDEX`, `LIKE`, character classes, and `ESCAPE`
> - collation rules, case/accent sensitivity, and collation-conflict error 468
> - `STRING_SPLIT`, `QUOTENAME`, `STRING_ESCAPE`, and identifier safety for dynamic SQL
> - `ASCII`, `UNICODE`, `CHAR`, `NCHAR`, `SOUNDEX`, `DIFFERENCE`, and `FORMATMESSAGE`
>
> All examples execute against the live `stoxx` database. Every code cell is followed by its real result or, for trap demos, the real error block.

## String Types, Length, and Unicode

SQL Server exposes two character-type families: non-Unicode (`char`/`varchar`) and Unicode (`nchar`/`nvarchar`). Choosing the wrong family at schema-design time has storage, correctness, and index-seek consequences that are hard to reverse later. This section walks through the storage tradeoffs, the length/byte distinction, the Unicode literal rules, and the UTF-8 collation option added in SQL Server 2019.

### char, varchar, nchar, and nvarchar

The four character types differ along two axes: **fixed vs variable length** and **single-byte vs Unicode**. All four store their `n` argument as a **byte count**, not a character count — an easy source of confusion, especially with Unicode types where `nvarchar(10)` holds at most ten UCS-2 characters in 20 bytes.

| Type | Length rule | Encoding | `n` argument |
|---|---|---|---|
| `char(n)` | Fixed, always `n` bytes, space-padded | Non-Unicode (single code page) | Byte count, 1–8000 |
| `varchar(n)` / `varchar(max)` | Variable, up to `n` bytes (or ~2 GB for `max`) | Non-Unicode (or UTF-8 with `_UTF8` collation, SQL 2019+) | Byte count, 1–8000 or `max` |
| `nchar(n)` | Fixed, always `2*n` bytes, space-padded | Unicode (UCS-2/UTF-16) | Character count, 1–4000 |
| `nvarchar(n)` / `nvarchar(max)` | Variable, up to `2*n` bytes (or ~2 GB for `max`) | Unicode (UCS-2/UTF-16) | Character count, 1–4000 or `max` |

#### char vs varchar trailing-space padding

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

Three observations follow from this output:

- **`LEN()` ignores trailing spaces.** Both variables report length 5 even though the `char(10)` value actually contains `'hello     '` on disk.
- **`DATALENGTH()` reports actual bytes.** `char(10)` always consumes 10 bytes; `varchar(10)` consumes the 5 bytes needed for `'hello'` plus a small row-header overhead.
- **Concatenation exposes the padding.** Wrapping the variables in `'['` and `']'` makes the trailing spaces on the `char` side visible.

Reserve `char(n)` for truly fixed-width columns such as ISO currency codes (`char(3)`), ISO country codes (`char(2)`), or fixed-format identifiers. For every other column, use `varchar(n)`.

#### varchar vs nvarchar storage cost

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

`nvarchar` uses exactly twice the storage of `varchar` for the same ASCII content under UCS-2/UTF-16 encoding. On a 100-million-row table, a naive `nvarchar(100)` column over `varchar(100)` can cost an extra 100 GB — and the larger the row, the fewer rows per 8 KB page, compounding the cost on every index range scan.

> [!question] When to choose nvarchar over varchar
>
> Use `nvarchar` whenever the column can receive multilingual input (non-ASCII names, addresses, free-text fields) or whenever the data comes from an external system whose encoding contract is not guaranteed. Use `varchar` for columns that store strictly ASCII content by contract — ticker symbols, ISO codes, machine-generated identifiers, status enums.

#### N prefix required for Unicode literals

> [!danger] Missing N prefix silently loses characters
>
> When a string literal is written without the `N` prefix, SQL Server first parses it as a **non-Unicode** `varchar` using the database's default code page and only then implicitly converts it to `nvarchar` during assignment. If the literal contains characters not representable in that code page, they are replaced with `?` **before** the conversion happens — the Unicode characters never reach the `nvarchar` variable. No warning, no error, silent data loss.

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

Both variables are `nvarchar(10)` and both report length 3, but the bare `'日本語'` literal was converted to `???` by the `varchar`-to-`nvarchar` path under the database's `SQL_Latin1_General_CP1_CI_AS` code page, which does not represent Japanese characters. The `N'日本語'` form preserves them.

> [!success] Always prefix Unicode literals with N
>
> When the target column is `nchar`/`nvarchar`, always write `N'literal'`. There is no downside for ASCII-only strings, and it is the only safe way to preserve non-ASCII characters in the literal path. Enforce this in code review.

#### UTF-8 collations on varchar (SQL Server 2019+)

Since SQL Server 2019, `char`/`varchar` columns can opt into **UTF-8 encoding** by using a collation whose name ends in `_UTF8` (for example `Latin1_General_100_CI_AS_SC_UTF8`). Under a UTF-8 collation, a `varchar` column stores Unicode text but uses 1 byte per ASCII character, 2 bytes per most Latin accented characters, and 3 bytes per CJK character — typically smaller than UCS-2/UTF-16 for ASCII-dominant multilingual workloads. `nchar`/`nvarchar` remain UCS-2/UTF-16 regardless of collation; the UTF-8 option applies only to the `varchar` family.

The tradeoff is that some pre-existing UTF-8-unaware applications may not tolerate the variable-width encoding, and index-key size limits still count bytes, not characters. UTF-8 collations are a storage optimization for new schema on SQL Server 2019 and later, not a drop-in replacement for `nvarchar`.

### LEN and DATALENGTH

`LEN` and `DATALENGTH` both describe the "size" of a string but along different axes. Mixing them up is one of the most frequent source of bugs when porting schemas or sizing buffers.

| Function | Returns | Unit | Trailing spaces |
|---|---|---|---|
| `LEN(x)` | Character count | Characters | **Ignored** |
| `DATALENGTH(x)` | Byte count on disk | Bytes | Counted |

#### LEN ignores trailing spaces

*Call `LEN` and `DATALENGTH` on an ASCII literal with and without trailing spaces.*

```sql
SELECT
    LEN('abc')       AS len_abc,
    LEN('abc   ')    AS len_abc_trailing,
    DATALENGTH('abc')      AS bytes_abc,
    DATALENGTH('abc   ')   AS bytes_abc_trailing;
```

| len_abc | len_abc_trailing | bytes_abc | bytes_abc_trailing |
|---|---|---|---|
| 3 | 3 | 3 | 6 |

`LEN('abc   ')` returns `3` — the trailing spaces are deliberately excluded. `DATALENGTH('abc   ')` returns `6` — every byte is counted. If you need to detect whether a string has trailing whitespace (for example, to flag dirty input from a CSV file), use `DATALENGTH` — or `LEN(col + '|') - 1`, which prevents `LEN` from stripping the sentinel.

#### DATALENGTH on real nvarchar columns

*Return the five widest company long-names in `silver.index_dim` with their character count and byte count.*

```sql
SELECT TOP 5
    symbol,
    long_name,
    LEN(long_name)        AS chars,
    DATALENGTH(long_name) AS bytes
FROM silver.index_dim
WHERE is_current = 1 AND long_name IS NOT NULL
ORDER BY LEN(long_name) DESC;
```

| symbol | long_name | chars | bytes |
|---|---|---|---|
| MUV2.DE | Münchener Rückversicherungs-Gesellschaft Aktiengesellschaft in München | 70 | 140 |
| MC.PA | LVMH Moët Hennessy - Louis Vuitton, Société Européenne | 54 | 108 |
| RMS.PA | Hermès International Société en commandite par actions | 54 | 108 |
| BMW.DE | Bayerische Motoren Werke Aktiengesellschaft | 43 | 86 |
| IBM | International Business Machines Corporation | 43 | 86 |

`long_name` is declared `nvarchar(200)`, so each character uses 2 bytes under UCS-2/UTF-16. The `bytes` column is always exactly `2 × chars`. This formula holds for every `nvarchar` column regardless of content because UCS-2/UTF-16 is fixed-width for the Basic Multilingual Plane (characters outside the BMP take 4 bytes, but they are rare).

### Length and Unicode reference

| Function | Purpose | Returns `NULL` when | Notes |
|---|---|---|---|
| `LEN(x)` | Character count excluding trailing spaces | Input is `NULL` | Returns `0` for empty string, surfaces trailing-space surprise |
| `DATALENGTH(x)` | Byte count on disk | Input is `NULL` | Counts every byte, including trailing spaces and row overhead |
| `UNICODE(x)` | Code point of first character | Input is `NULL` | Use on `nvarchar`; returns 0–65535 for BMP |
| `NCHAR(n)` | Unicode character from code point | `n` out of range | Inverse of `UNICODE` |
| `ASCII(x)` | Code point of first byte | Input is empty/`NULL` | Returns 0–255; use on `varchar` only |
| `CHAR(n)` | Single-byte character from code point | `n` out of 0–255 | Inverse of `ASCII` |

## Concatenation and Aggregation

Building a single string from multiple values is one of the most common string operations, and it is the one where T-SQL has changed most over the past decade. The `+` operator is the legacy approach but has a catastrophic null-handling trap. `CONCAT` (SQL Server 2012+) and `CONCAT_WS` (SQL Server 2017+) fix it. `STRING_AGG` (SQL Server 2017+) replaces the older `STUFF + FOR XML PATH` pattern for row-to-string aggregation.

### CONCAT and CONCAT_WS

`CONCAT` accepts any number of arguments and returns them joined as a single string with implicit `NULL → ''` coercion. `CONCAT_WS` adds a leading "with separator" argument that is inserted between every non-null value.

#### Plus operator null propagation trap

> [!danger] Any + NULL returns NULL under default ANSI_NULLS
>
> The `+` string concatenation operator follows three-valued logic: `expr + NULL = NULL` for any `expr`. A single NULL anywhere in the chain collapses the entire result to `NULL`. Since the default `SET CONCAT_NULL_YIELDS_NULL ON` behavior cannot be reliably changed at the session level (and is deprecated for change), `+` is unsafe whenever any input could be `NULL`.

*Compare `+` and `CONCAT` when one input is `NULL`.*

```sql
SELECT
    'A' + NULL + 'B'   AS plus_result,
    CONCAT('A', NULL, 'B') AS concat_result;
```

| plus_result | concat_result |
|---|---|
| NULL | AB |

The `+` form collapses to `NULL` because `'A' + NULL` evaluates to `NULL` and the rest of the chain inherits it. `CONCAT` coerces each `NULL` argument to the empty string and returns `'AB'`.

> [!success] Use CONCAT for all new code
>
> `CONCAT` is the default choice for new T-SQL. It handles `NULL` safely, implicitly converts numeric and date arguments to string, and is shorter to read than chained `+` calls. The only reason to still write `+` is when you deliberately want `NULL` propagation — in that case an explicit `NULLIF` or `CASE` expresses the intent more clearly.

#### CONCAT and CONCAT_WS on real columns

*Build a human-readable label and a pipe-separated compact label from `silver.index_dim`.*

```sql
SELECT TOP 5
    symbol,
    CONCAT(symbol, ' — ', sector) AS labelled,
    CONCAT_WS(' | ', symbol, sector, industry, country) AS compact_label
FROM silver.index_dim
WHERE is_current = 1
ORDER BY symbol;
```

| symbol | labelled | compact_label |
|---|---|---|
| 0388.HK | 0388.HK — Financial Services | 0388.HK \| Financial Services \| Financial Data & Stock Exchanges \| Hong Kong |
| 1299.HK | 1299.HK — Financial Services | 1299.HK \| Financial Services \| Insurance - Life \| Hong Kong |
| 1810.HK | 1810.HK — Technology | 1810.HK \| Technology \| Consumer Electronics \| China |
| 2269.HK | 2269.HK — Healthcare | 2269.HK \| Healthcare \| Biotechnology \| China |
| 3382.T | 3382.T — Consumer Defensive | 3382.T \| Consumer Defensive \| Grocery Stores \| Japan |

`CONCAT` repeats the separator explicitly on every call; `CONCAT_WS` takes the separator once as the first argument and inserts it between every non-null subsequent value. For a four-column label `CONCAT_WS` is both shorter and safer because it skips any `NULL` column automatically.

#### CONCAT_WS skips NULL values

*Compare `CONCAT_WS` and manual `CONCAT` against a NULL-laden argument list.*

```sql
SELECT
    CONCAT_WS(' | ', 'A', NULL, 'B', NULL, 'C') AS concat_ws_result,
    CONCAT('A', ' | ', NULL, ' | ', 'B')        AS concat_manual;
```

| concat_ws_result | concat_manual |
|---|---|
| A \| B \| C | A \|  \| B |

`CONCAT_WS` skips the `NULL` values **and** the separators adjacent to them, producing the clean `A | B | C`. `CONCAT` coerces each `NULL` to the empty string but keeps every separator, leaving the ugly `A |  | B` with a visible orphan separator. Always use `CONCAT_WS` when building delimited strings from columns that can be `NULL`.

### STRING_AGG

`STRING_AGG` collapses multiple row values into a single string within each `GROUP BY` group. It replaces the older `STUFF + FOR XML PATH` pattern for row-to-string aggregation and supports an optional `WITHIN GROUP (ORDER BY ...)` clause to control the order of the concatenated values.

#### STRING_AGG with WITHIN GROUP ORDER BY

*List every symbol in `silver.index_dim` by sector, sorted alphabetically within each group.*

```sql
SELECT TOP 5
    sector,
    STRING_AGG(symbol, ', ') WITHIN GROUP (ORDER BY symbol) AS symbols,
    COUNT(*) AS n_symbols
FROM silver.index_dim
WHERE is_current = 1
GROUP BY sector
ORDER BY sector;
```

| sector | symbols | n_symbols |
|---|---|---|
| Basic Materials | 4063.T, AI.PA, BAS.DE, BHP.AX, LIN, RIO.AX | 6 |
| Communication Services | 6098.T, 7974.T, 9432.T, 9433.T, 9984.T, DTE.DE, GOOGL, META, NFLX, TLS.AX, TMUS, VZ | 12 |
| Consumer Cyclical | 4661.T, 7203.T, 7267.T, 9983.T, ADS.DE, AMZN, BMW.DE, HD, ITX.MC, MBG.DE, MC.PA, MCD, PRX.AS, RACE.MI, RMS.PA, TSLA, VOW.DE, WES.AX | 18 |
| Consumer Defensive | 3382.T, ABI.BR, AD.AS, BN.PA, COST, KO, OR.PA, PEP, PG, PM, WMT, WOW.AX | 12 |
| Energy | BKR, BP, COP, CVX, CVX, DVN, ENB, ENI.MI, EOG, EQNR, HAL, KMI, MPC, OXY, PSX, SHEL, SLB, TTE, TTE.PA, VLO, WDS.AX, WMB, XOM, XOM | 24 |

Without `WITHIN GROUP (ORDER BY symbol)`, the order of concatenated values is undefined — SQL Server can return them in any order it likes, and that order can change between executions. Always specify the ordering explicitly unless the aggregation is genuinely unordered.

#### STRING_AGG skips NULL values

*Aggregate a row constructor containing two NULL values.*

```sql
SELECT
    STRING_AGG(v, ',') AS agg_result
FROM (VALUES ('A'), (NULL), ('B'), (NULL), ('C')) AS t(v);
```

| agg_result |
|---|
| A,B,C |

`STRING_AGG` silently skips `NULL` values — it does not insert the separator for them, so the output has no orphan commas. This matches the `CONCAT_WS` behavior and differs from the `STUFF + FOR XML PATH` pattern, which requires explicit `WHERE col IS NOT NULL` filtering to avoid injecting empty items.

#### STRING_AGG 8000-byte truncation trap

> [!failure] STRING_AGG aggregation result exceeded 8000 bytes
>
> When `STRING_AGG` is called over a non-`max` character type, the result is materialized as `varchar(8000)` or `nvarchar(4000)`. If the total aggregated length exceeds that limit, SQL Server raises error 9829 and aborts the query. This is easy to miss in development with small row counts and fatal in production.

*Aggregate 80 copies of a 100-character string, exceeding the `varchar(8000)` limit.*

```sql
SELECT LEN(STRING_AGG(REPLICATE('x', 100), ',')) AS truncated_len
FROM (VALUES (1),(2),(3),(4),(5),(6),(7),(8),(9),(10),
             (11),(12),(13),(14),(15),(16),(17),(18),(19),(20),
             (21),(22),(23),(24),(25),(26),(27),(28),(29),(30),
             (31),(32),(33),(34),(35),(36),(37),(38),(39),(40),
             (41),(42),(43),(44),(45),(46),(47),(48),(49),(50),
             (51),(52),(53),(54),(55),(56),(57),(58),(59),(60),
             (61),(62),(63),(64),(65),(66),(67),(68),(69),(70),
             (71),(72),(73),(74),(75),(76),(77),(78),(79),(80))
     AS t(i);
```

```text
Msg 9829
STRING_AGG aggregation result exceeded the limit of 8000 bytes. Use LOB types to avoid result truncation.
```

The error message is unusually clear — the fix is in the message itself. Cast the expression to `varchar(max)` or `nvarchar(max)` **inside** the aggregate so `STRING_AGG` produces a LOB result.

> [!success] Cast to varchar(max) to bypass the 8000-byte limit
>
> Wrap the expression being aggregated in `CAST(... AS nvarchar(max))`. The cast runs once per row with negligible overhead and promotes the aggregate's output type to LOB, lifting the 8000-byte ceiling to ~2 GB.

*Aggregate the same 80 values with an explicit `nvarchar(max)` cast.*

```sql
SELECT DATALENGTH(STRING_AGG(CAST(REPLICATE('x', 100) AS nvarchar(max)), ',')) AS agg_bytes
FROM (VALUES (1),(2),(3),(4),(5),(6),(7),(8),(9),(10),
             (11),(12),(13),(14),(15),(16),(17),(18),(19),(20),
             (21),(22),(23),(24),(25),(26),(27),(28),(29),(30),
             (31),(32),(33),(34),(35),(36),(37),(38),(39),(40),
             (41),(42),(43),(44),(45),(46),(47),(48),(49),(50),
             (51),(52),(53),(54),(55),(56),(57),(58),(59),(60),
             (61),(62),(63),(64),(65),(66),(67),(68),(69),(70),
             (71),(72),(73),(74),(75),(76),(77),(78),(79),(80))
     AS t(i);
```

| agg_bytes |
|---|
| 16158 |

The aggregate now returns 16,158 bytes (80 × 100 characters × 2 bytes per `nvarchar` character, plus 79 single-byte commas coerced up to `nvarchar`). No truncation and no error. On modern SQL Server (2017+), the `CAST ... AS nvarchar(max)` is the canonical defensive wrapper for any `STRING_AGG` whose row count or per-row size is not tightly bounded.

### Legacy pattern: STUFF and FOR XML PATH

Before `STRING_AGG` shipped in SQL Server 2017, the canonical row-to-string aggregation used a correlated subquery returning an XML fragment, consumed by the `.value()` XPath method, with a leading separator stripped by `STUFF`. This pattern is still ubiquitous in legacy codebases and you will encounter it in any pre-2017 production stored procedure.

#### Pre-2017 STUFF + FOR XML PATH aggregation

*Reproduce the `STRING_AGG` output from the previous section using the legacy pattern.*

```sql
SELECT TOP 5
    sector,
    STUFF((
        SELECT ', ' + d2.symbol
        FROM silver.index_dim AS d2
        WHERE d2.sector = d1.sector AND d2.is_current = 1
        ORDER BY d2.symbol
        FOR XML PATH(''), TYPE
    ).value('.', 'nvarchar(max)'), 1, 2, '') AS symbols
FROM silver.index_dim AS d1
WHERE d1.is_current = 1
GROUP BY sector
ORDER BY sector;
```

| sector | symbols |
|---|---|
| Basic Materials | 4063.T, AI.PA, BAS.DE, BHP.AX, LIN, RIO.AX |
| Communication Services | 6098.T, 7974.T, 9432.T, 9433.T, 9984.T, DTE.DE, GOOGL, META, NFLX, TLS.AX, TMUS, VZ |
| Consumer Cyclical | 4661.T, 7203.T, 7267.T, 9983.T, ADS.DE, AMZN, BMW.DE, HD, ITX.MC, MBG.DE, MC.PA, MCD, PRX.AS, RACE.MI, RMS.PA, TSLA, VOW.DE, WES.AX |
| Consumer Defensive | 3382.T, ABI.BR, AD.AS, BN.PA, COST, KO, OR.PA, PEP, PG, PM, WMT, WOW.AX |
| Energy | BKR, BP, COP, CVX, CVX, DVN, ENB, ENI.MI, EOG, EQNR, HAL, KMI, MPC, OXY, PSX, SHEL, SLB, TTE, TTE.PA, VLO, WDS.AX, WMB, XOM, XOM |

> [!info]- Clause-by-clause walkthrough
>
> 1. `FOR XML PATH(''), TYPE` returns the correlated subquery's rows as an untyped XML fragment with no wrapping element name.
> 2. `.value('.', 'nvarchar(max)')` extracts the fragment's text content as an `nvarchar(max)` string with XML-entity decoding applied — this step is critical because `&`, `<`, `>` would otherwise arrive as `&amp;`, `&lt;`, `&gt;` in the output.
> 3. `STUFF(x, 1, 2, '')` replaces the first 2 characters (the leading `', '` separator) with an empty string, leaving `'4063.T, AI.PA, ...'` with no leading comma.
> 4. The outer `GROUP BY sector` and the correlation predicate `d2.sector = d1.sector` scope each subquery invocation to one sector.

The output is identical to the `STRING_AGG` version, but the pattern is verbose, silently encodes/decodes XML entities, and is significantly slower on large inputs. Use it **only** to maintain pre-2017 code; every new aggregation should use `STRING_AGG`.

### REPLICATE and SPACE

`REPLICATE(str, n)` returns `str` concatenated `n` times. `SPACE(n)` returns a string of `n` spaces and is a shorthand for `REPLICATE(' ', n)`. Both are commonly used for fixed-width padding in reports and file exports.

#### Pad to fixed width with REPLICATE and SPACE

*Left-pad a symbol to 6 characters with zeros, and right-pad it to 10 characters with spaces.*

```sql
SELECT TOP 5
    symbol,
    REPLICATE('0', 6 - LEN(symbol)) + symbol AS padded_left,
    symbol + SPACE(10 - LEN(symbol)) + '|'    AS padded_right
FROM dbo.dim_symbol
WHERE is_current = 1
ORDER BY symbol;
```

| symbol | padded_left | padded_right |
|---|---|---|
| ALV.DE | ALV.DE | ALV.DE    \| |
| BAS.DE | BAS.DE | BAS.DE    \| |
| DTE.DE | DTE.DE | DTE.DE    \| |
| SAP.DE | SAP.DE | SAP.DE    \| |
| SIE.DE | SIE.DE | SIE.DE    \| |

In this dataset every `dbo.dim_symbol` row already has a 6-character symbol, so the left-pad adds zero zeros and leaves the value unchanged. The right-pad demo is more visible: the trailing `|` sentinel sits at column 11 for every row, proving that each symbol was extended to exactly 10 characters regardless of its original length. For genuine left-zero-padding on variable-width inputs, prefer `FORMAT(val, 'D6')` or `RIGHT('000000' + val, 6)` because `REPLICATE('0', 6 - LEN(val))` errors if `LEN(val) > 6`.

### Concatenation and aggregation reference

| Function | Introduced | NULL handling | Use case |
|---|---|---|---|
| `a + b` | Always | Propagates `NULL` | Legacy code only |
| `CONCAT(...)` | 2012 | Coerces `NULL` → `''` | General string concatenation |
| `CONCAT_WS(sep, ...)` | 2017 | Skips `NULL` values entirely | Delimited strings from possibly-null columns |
| `STRING_AGG(x, sep)` | 2017 | Skips `NULL` values entirely | Row-to-string aggregation over a group |
| `STUFF((... FOR XML PATH(''))...)` | Legacy | Depends on implementation | Pre-2017 alternative to `STRING_AGG` |
| `REPLICATE(s, n)` | Always | Returns `NULL` on `NULL` input | Fixed-width padding, repeated markers |
| `SPACE(n)` | Always | Returns `NULL` on `NULL` `n` | Shorthand for `REPLICATE(' ', n)` |

## Extraction and Substitution

This section covers the slice-and-dice functions: extracting substrings, inserting or removing sections, replacing patterns, and reversing strings. Most of these functions are 1-indexed (the first character is position 1, not 0), and most are non-SARGable when used inside `WHERE` or `JOIN` predicates on indexed columns.

### LEFT, RIGHT, and SUBSTRING

The three slicing functions return a portion of a string:

- `LEFT(x, n)` returns the leftmost `n` characters.
- `RIGHT(x, n)` returns the rightmost `n` characters.
- `SUBSTRING(x, start, length)` returns `length` characters starting at position `start` (1-indexed).

All three accept both `varchar` and `nvarchar` inputs and return the same type as the input.

#### Slice a ticker symbol into root and exchange suffix

*Extract the ticker root (before the dot) and exchange suffix (after the dot) for symbols that contain a dot.*

```sql
SELECT TOP 5
    symbol,
    LEFT(symbol, 2)            AS first_two,
    RIGHT(symbol, 2)           AS last_two,
    SUBSTRING(symbol, 1, CHARINDEX('.', symbol + '.') - 1) AS ticker_root,
    CASE WHEN CHARINDEX('.', symbol) > 0
         THEN SUBSTRING(symbol, CHARINDEX('.', symbol) + 1, 10)
         ELSE '' END AS exchange_suffix
FROM silver.index_dim
WHERE is_current = 1 AND symbol LIKE '%.%'
ORDER BY symbol;
```

| symbol | first_two | last_two | ticker_root | exchange_suffix |
|---|---|---|---|---|
| 0388.HK | 03 | HK | 0388 | HK |
| 1299.HK | 12 | HK | 1299 | HK |
| 1810.HK | 18 | HK | 1810 | HK |
| 2269.HK | 22 | HK | 2269 | HK |
| 3382.T | 33 | .T | 3382 | T |

Two subtleties are visible in the output:

- `LEFT(symbol, 2)` and `RIGHT(symbol, 2)` ignore the dot position — they take exactly two characters. `RIGHT('3382.T', 2)` returns `.T` because the dot is the second-to-last character, not the last.
- The `ticker_root` column uses a `+ '.'` trick so that `CHARINDEX` always finds a dot, even on symbols that have none. Without the trick, `CHARINDEX('.', 'AAPL')` returns `0` and `SUBSTRING('AAPL', 1, -1)` raises error 537.

#### Non-SARGable SUBSTRING in WHERE clause

> [!warning] Wrapping an indexed column in SUBSTRING kills the seek
>
> When an indexed column is passed to `LEFT`, `RIGHT`, or `SUBSTRING` inside a `WHERE` or `JOIN` predicate, SQL Server cannot use the index's sort order to locate matching rows. The optimizer must scan every row, apply the function, then filter. On a large table this turns a millisecond seek into a multi-second scan.

*Count symbols whose first 3 characters equal `'ASM'` using a non-SARGable `SUBSTRING` predicate.*

```sql
SELECT COUNT(*) AS n_matching
FROM silver.index_dim
WHERE SUBSTRING(symbol, 1, 3) = 'ASM';
```

| n_matching |
|---|
| 1 |

The result is correct — one row in `silver.index_dim` starts with `ASM` — but this query performs a full scan even though `symbol` may be indexed.

> [!success] Rewrite as a SARGable prefix LIKE
>
> Replace `SUBSTRING(col, 1, n) = 'prefix'` with `col LIKE 'prefix%'`. The `LIKE` prefix pattern is SARGable: the optimizer can seek directly to the range `['ASM', 'ASN')` and return only the matching rows. The same rule applies to `LEFT(col, n) = 'prefix'`.
>
> ```sql
> SELECT COUNT(*)
> FROM silver.index_dim
> WHERE symbol LIKE 'ASM%';
> ```

### STUFF

`STUFF(source, start, length, replacement)` deletes `length` characters starting at position `start` and inserts `replacement` at that position. It is the canonical "replace a middle slice" function and is also used in the legacy `FOR XML PATH` aggregation pattern to strip the leading separator.

#### Replace, insert, and mask with STUFF

*Show three distinct uses of `STUFF` on short literals.*

```sql
SELECT
    STUFF('ASML.AS', 5, 1, '::')         AS stuffed,
    STUFF('2026-04-11', 5, 0, '/')        AS insert_slash,
    STUFF('secret-token', 3, 6, '******') AS masked;
```

| stuffed | insert_slash | masked |
|---|---|---|
| ASML::AS | 2026/-04-11 | se******oken |

Three different patterns in one call:

- **Replace.** `STUFF('ASML.AS', 5, 1, '::')` deletes 1 character starting at position 5 (the dot) and inserts `::` in its place.
- **Insert (length = 0).** `STUFF('2026-04-11', 5, 0, '/')` deletes 0 characters at position 5 and inserts `/`, splicing it in without removing anything. The `-04-11` tail is pushed right.
- **Mask.** `STUFF('secret-token', 3, 6, '******')` deletes 6 characters from position 3 and inserts 6 asterisks, producing a censored version suitable for logging.

### REPLACE and TRANSLATE

`REPLACE(source, old, new)` replaces every occurrence of `old` with `new`. `TRANSLATE(source, chars, replacements)` maps each character of `chars` to the same-index character of `replacements` — it is a one-pass character-by-character substitution that avoids the nested-`REPLACE` anti-pattern.

#### REPLACE vs TRANSLATE on ticker symbols

*Normalize dots and dashes in ticker symbols to underscores using three different approaches.*

```sql
SELECT TOP 5
    symbol,
    REPLACE(symbol, '.', '_')                AS replaced,
    TRANSLATE(symbol, '.-', '__')            AS translated,
    REPLACE(REPLACE(symbol, '.', '_'), '-', '_') AS chained_replace
FROM silver.index_dim
WHERE is_current = 1 AND symbol LIKE '%.%'
ORDER BY symbol;
```

| symbol | replaced | translated | chained_replace |
|---|---|---|---|
| 0388.HK | 0388_HK | 0388_HK | 0388_HK |
| 1299.HK | 1299_HK | 1299_HK | 1299_HK |
| 1810.HK | 1810_HK | 1810_HK | 1810_HK |
| 2269.HK | 2269_HK | 2269_HK | 2269_HK |
| 3382.T | 3382_T | 3382_T | 3382_T |

All three columns produce the same result, but the approaches differ:

- `REPLACE` handles one substitution at a time.
- `TRANSLATE` handles an arbitrary number of 1:1 character mappings in a single call. The second argument (`'.-'`) lists the source characters; the third argument (`'__'`) lists the target characters. Lengths must match or SQL Server raises error 9828.
- `REPLACE(REPLACE(...))` is the pre-SQL-2017 idiom for multi-character substitution — functional but unreadable once you chain three or more levels.

Use `TRANSLATE` whenever the substitution is strictly 1:1. Use `REPLACE` when the old/new tokens have different lengths (for example `REPLACE(x, 'foo', 'barbaz')`).

### REVERSE

`REVERSE(x)` returns the characters of `x` in reverse order. It is occasionally useful for right-anchored searches (`CHARINDEX('.', REVERSE(symbol))` returns the position of the last dot counted from the right) and for finding the last segment of a hierarchical path.

#### Reverse a ticker symbol

*Return each symbol and its reverse.*

```sql
SELECT TOP 5
    symbol,
    REVERSE(symbol) AS reversed
FROM dbo.dim_symbol
WHERE is_current = 1
ORDER BY symbol;
```

| symbol | reversed |
|---|---|
| ALV.DE | ED.VLA |
| BAS.DE | ED.SAB |
| DTE.DE | ED.ETD |
| SAP.DE | ED.PAS |
| SIE.DE | ED.EIS |

`REVERSE` operates on the character level, not the byte level — under Unicode it correctly handles multi-byte BMP characters. It does **not** handle combining marks or surrogate pairs intelligently; for those, a CLR or application-layer implementation is required. For ASCII and single-code-point accented characters, `REVERSE` is safe.

### Extraction and substitution reference

| Function | Returns | Non-SARGable in predicates | Notes |
|---|---|---|---|
| `LEFT(x, n)` | Leftmost `n` characters | Yes | Replace with `LIKE 'prefix%'` when filtering |
| `RIGHT(x, n)` | Rightmost `n` characters | Yes | No SARGable alternative — redesign the column |
| `SUBSTRING(x, start, len)` | `len` characters starting at `start` (1-indexed) | Yes | Use for middle-slice extraction |
| `STUFF(x, start, len, new)` | `x` with `len` characters at `start` replaced by `new` | Yes | `len = 0` inserts without deleting |
| `REPLACE(x, old, new)` | `x` with every `old` replaced by `new` | Yes | Single-token substitution |
| `TRANSLATE(x, chars, repl)` | `x` with each char in `chars` mapped to the same-index char in `repl` | Yes | 1:1 character mapping, lengths must match |
| `REVERSE(x)` | `x` reversed character-by-character | Yes | Useful for right-anchored searches |

## Trimming and Case

Cleaning inbound text and normalizing case are the two most common string-preparation operations at ingestion boundaries. Both families have the same performance trap: wrapping an indexed column in `TRIM`, `LOWER`, or `UPPER` inside a `WHERE` or `JOIN` predicate makes the query non-SARGable and forces a full scan.

### TRIM, LTRIM, and RTRIM

Modern SQL Server (2017+) offers a single `TRIM` function that accepts an optional character set argument. The legacy `LTRIM` and `RTRIM` functions remain for backward compatibility and now also accept a character set argument as of SQL Server 2022.

| Function | Default behavior | Custom character set (2017+ / 2022+) |
|---|---|---|
| `TRIM(x)` | Removes leading **and** trailing whitespace | `TRIM('chars' FROM x)` removes any of `chars` from both ends |
| `LTRIM(x)` | Removes leading whitespace | `LTRIM(x, 'chars')` removes any of `chars` from the left (SQL 2022+) |
| `RTRIM(x)` | Removes trailing whitespace | `RTRIM(x, 'chars')` removes any of `chars` from the right (SQL 2022+) |

#### TRIM defaults to whitespace on both sides

*Compare `TRIM`, `LTRIM`, and `RTRIM` on a string with leading and trailing spaces.*

```sql
SELECT
    '[' + TRIM('  hello  ')                  + ']' AS trimmed,
    '[' + LTRIM('  hello  ')                 + ']' AS ltrimmed,
    '[' + RTRIM('  hello  ')                 + ']' AS rtrimmed;
```

| trimmed | ltrimmed | rtrimmed |
|---|---|---|
| [hello] | [hello  ] | [  hello] |

The sentinel brackets make the result unambiguous: `TRIM` strips both sides, `LTRIM` strips only the leading spaces, `RTRIM` strips only the trailing spaces. For historical reasons, both `LTRIM` and `RTRIM` default to the ASCII space character (U+0020) only — they do **not** strip tab, newline, or other whitespace characters. To strip all whitespace-class characters, pass them explicitly as a character set (SQL 2017+ for `TRIM`, SQL 2022+ for `LTRIM`/`RTRIM`).

#### TRIM with an explicit character set

*Strip punctuation from one string and leading/trailing zeros from another.*

```sql
SELECT
    TRIM('.,;' FROM '...apple,,') AS trim_punct,
    TRIM('0'   FROM '000042000')  AS trim_zero;
```

| trim_punct | trim_zero |
|---|---|
| apple | 42 |

The `FROM` keyword is mandatory in the explicit-charset form. The first argument is a set of characters (not a sequence), so `TRIM('.,;' FROM '...apple,,')` removes any leading or trailing occurrence of `.`, `,`, or `;` — not the literal string `'.,;'`. The second call strips leading and trailing zeros, which is a useful canonicalization for numeric strings imported from fixed-width files.

> [!warning] TRIM on an indexed column is non-SARGable
>
> `WHERE TRIM(col) = 'abc'` forces a full scan because the optimizer cannot invert the function at seek time. The fix is to **clean the data at ingestion** and never write untrimmed values to the column, so production queries can filter on the raw column without any function wrapper.

> [!success] Trim at ingest, query raw
>
> Add `TRIM` to the `INSERT`/`UPDATE` path (or to a computed column with `PERSISTED`), not to the `SELECT`. Once the stored values are guaranteed-clean, the `WHERE` predicate becomes `WHERE col = 'abc'`, which is fully SARGable against any index on `col`.

### LOWER and UPPER

`LOWER(x)` and `UPPER(x)` return `x` converted to the corresponding case using the rules of the string's collation. Under a case-insensitive collation (the default on most SQL Server installations), they are idempotent with respect to equality comparison — `'Apple' = 'apple'` is already true — so their main role is **presentation formatting**, not equality normalization.

#### Normalize country names to upper or lower case

*Return each distinct country in `silver.index_dim` with its upper- and lower-cased forms.*

```sql
SELECT TOP 5
    country,
    UPPER(country) AS country_upper,
    LOWER(country) AS country_lower
FROM silver.index_dim
WHERE is_current = 1
GROUP BY country
ORDER BY country;
```

| country | country_upper | country_lower |
|---|---|---|
| Australia | AUSTRALIA | australia |
| Belgium | BELGIUM | belgium |
| Canada | CANADA | canada |
| China | CHINA | china |
| Finland | FINLAND | finland |

The functions are straightforward for ASCII input. For Unicode input, the case mapping depends on the collation's locale — for example, the Turkish dotted/dotless `I` rules under a `Turkish_CI_AS` collation differ from the Latin rules under `Latin1_General_CI_AS`. Never assume `UPPER(x) = UPPER(y)` is equivalent to the case-insensitive comparison for non-Latin scripts.

> [!warning] LOWER/UPPER in a predicate kills the seek
>
> Under the default case-insensitive collation, `WHERE LOWER(col) = 'apple'` is **functionally redundant** — the equality already ignores case — and it makes the query non-SARGable by wrapping `col`. Remove the function entirely.

> [!success] Let the collation handle case sensitivity
>
> Trust the collation's case-insensitivity for equality comparisons: `WHERE col = 'apple'` matches `'Apple'`, `'APPLE'`, and `'aPpLe'` under `SQL_Latin1_General_CP1_CI_AS`. Only add `LOWER`/`UPPER` when the collation itself is case-sensitive **and** you need case-insensitive behavior for one specific comparison — in that case prefer the `COLLATE` clause described in the next section.

### Trimming and case reference

| Function | Version | Behavior |
|---|---|---|
| `TRIM(x)` | 2017 | Strip leading and trailing whitespace (U+0020 only) |
| `TRIM('chars' FROM x)` | 2017 | Strip any of `chars` from both ends |
| `LTRIM(x)` | Always | Strip leading whitespace |
| `LTRIM(x, 'chars')` | 2022 | Strip any of `chars` from the left |
| `RTRIM(x)` | Always | Strip trailing whitespace |
| `RTRIM(x, 'chars')` | 2022 | Strip any of `chars` from the right |
| `LOWER(x)` | Always | Convert to lower case using the expression's collation |
| `UPPER(x)` | Always | Convert to upper case using the expression's collation |

## Pattern Matching: CHARINDEX, PATINDEX, and LIKE

T-SQL has three primary pattern-matching primitives: `CHARINDEX` for literal substring search, `PATINDEX` for wildcard pattern search inside an expression, and `LIKE` for wildcard pattern matching inside a predicate. The three overlap but are not interchangeable — `LIKE` is the only one that can be SARGable against an index, and only when the pattern starts with a literal prefix.

### CHARINDEX

`CHARINDEX(needle, haystack [, start])` returns the 1-based position of the first occurrence of `needle` in `haystack`, or `0` if not found. The optional `start` argument sets the starting position, allowing successive calls to walk through multiple occurrences.

#### Find substring positions with and without a start offset

*Find the dot position and the first/second occurrence of `'A'` in every symbol containing `A`.*

```sql
SELECT TOP 5
    symbol,
    CHARINDEX('.', symbol)        AS dot_pos,
    CHARINDEX('A', symbol)        AS first_a,
    CHARINDEX('A', symbol, 2)     AS second_a_search
FROM silver.index_dim
WHERE is_current = 1 AND symbol LIKE '%A%'
ORDER BY symbol;
```

| symbol | dot_pos | first_a | second_a_search |
|---|---|---|---|
| AAPL | 0 | 1 | 2 |
| ABBV | 0 | 1 | 0 |
| ABI.BR | 4 | 1 | 0 |
| AD.AS | 3 | 1 | 4 |
| ADS.DE | 4 | 1 | 0 |

Three behaviors are visible:

- `CHARINDEX('.', 'AAPL') = 0` — the dot is not present, so the function returns 0, not `NULL`. Every `CHARINDEX` caller must treat 0 as "not found", not as an error.
- `CHARINDEX('A', 'AAPL', 2) = 2` — starting the search at position 2 finds the second `A` of `AAPL` at position 2.
- `CHARINDEX('A', 'ABBV', 2) = 0` — `ABBV` has only one `A` (at position 1), so the search starting at position 2 returns 0.

The 3-argument form is the canonical way to walk through multiple occurrences of a substring: call it repeatedly, passing `previous_result + 1` as the start offset, until it returns 0.

### PATINDEX

`PATINDEX(pattern, expression)` returns the 1-based position of the first match of a wildcard pattern inside an expression, or 0 if not found. Unlike `CHARINDEX`, the pattern argument supports the same wildcards as `LIKE`: `%`, `_`, `[]`, `[^]`. This makes `PATINDEX` the function of choice for locating the first occurrence of a character class (first digit, first non-letter, first uppercase character, etc.).

#### PATINDEX with character classes

*Find the first digit, first non-alphanumeric, and anchored-start `[A-C]` match in every symbol.*

```sql
SELECT TOP 5
    symbol,
    PATINDEX('%[0-9]%', symbol)    AS first_digit,
    PATINDEX('%[^A-Z0-9.]%', symbol) AS first_odd_char,
    PATINDEX('[A-C]%', symbol)     AS starts_with_a_to_c
FROM silver.index_dim
WHERE is_current = 1
ORDER BY symbol;
```

| symbol | first_digit | first_odd_char | starts_with_a_to_c |
|---|---|---|---|
| 0388.HK | 1 | 0 | 0 |
| 1299.HK | 1 | 0 | 0 |
| 1810.HK | 1 | 0 | 0 |
| 2269.HK | 1 | 0 | 0 |
| 3382.T | 1 | 0 | 0 |

All five rows start with a digit, so `first_digit` is 1 everywhere. None of them contains a character outside `[A-Z0-9.]`, so `first_odd_char` is 0 everywhere. None of them starts with a letter in `[A-C]`, so the anchored `[A-C]%` pattern returns 0 — note the absence of a leading `%`, which means the match must start at position 1.

### LIKE

`LIKE` is the workhorse wildcard comparison operator. It accepts the same pattern syntax as `PATINDEX`, supports the `ESCAPE` clause for literal wildcard characters, and — critically — is the **only** pattern-matching primitive that can use an index seek, and only when the pattern starts with a literal prefix.

| Pattern element | Meaning |
|---|---|
| `%` | Match zero or more characters |
| `_` | Match exactly one character |
| `[abc]` | Match any one character in the set |
| `[a-z]` | Match any one character in the range |
| `[^abc]` / `[^a-z]` | Match any one character **not** in the set/range |
| `ESCAPE '\'` | Treat the next character literally (escape wildcards) |

#### Prefix LIKE is SARGable

*Find every symbol whose symbol starts with `AS`.*

```sql
SELECT symbol, sector
FROM silver.index_dim
WHERE is_current = 1 AND symbol LIKE 'AS%';
```

| symbol | sector |
|---|---|
| ASML.AS | Technology |

A pattern like `'AS%'` — literal characters followed by a trailing `%` — is **SARGable**. The optimizer can convert it to an index range seek over `['AS', 'AT')` and return only the matching rows without scanning the rest of the table. This is the single most important `LIKE` optimization, and the reason prefix searches should always use `LIKE`, never `LEFT(col, n) = 'prefix'`.

#### Character class and negated character class

*Return the first five symbols starting with a letter in `[A-C]`, and the first five starting with a character **outside** `[A-Z]`.*

```sql
SELECT TOP 5 symbol
FROM silver.index_dim
WHERE is_current = 1 AND symbol LIKE '[A-C]%'
ORDER BY symbol;
```

| symbol |
|---|
| AAPL |
| ABBV |
| ABI.BR |
| AD.AS |
| ADS.DE |

*Same pattern, negated.*

```sql
SELECT TOP 5 symbol
FROM silver.index_dim
WHERE is_current = 1 AND symbol LIKE '[^A-Z]%'
ORDER BY symbol;
```

| symbol |
|---|
| 0388.HK |
| 1299.HK |
| 1810.HK |
| 2269.HK |
| 3382.T |

The negated class `[^A-Z]` matches symbols starting with a digit (or any other non-uppercase-letter character). Character classes preserve the prefix-SARGability rule: `LIKE '[A-C]%'` can still use an index seek because the first character is constrained to a finite range. `LIKE '%[A-C]'` (leading wildcard) cannot.

#### ESCAPE clause for literal wildcards

*Find every string that contains a literal `%` character.*

```sql
SELECT v
FROM (VALUES
    ('100% pure'),
    ('ordinary'),
    ('50% off')
) AS t(v)
WHERE v LIKE '%[%]%' ESCAPE '\';
```

| v |
|---|
| 100% pure |
| 50% off |

The pattern `'%[%]%'` uses the character-class trick: `[%]` inside square brackets matches a literal `%`, so the whole pattern means "any prefix, then a literal `%`, then any suffix". The `ESCAPE '\'` clause is present for documentation — it declares that `\` would be the escape character if needed — and is not strictly required here because the character-class form already escapes the `%`. When the literal being matched would itself appear in a character class (for example a literal `[`), the `ESCAPE` clause with a backslash or other character becomes mandatory: `LIKE '\[%' ESCAPE '\'`.

#### Leading-wildcard LIKE is non-SARGable

> [!warning] Leading % disables index seeks
>
> A pattern like `'%abc'` or `'%abc%'` starts with a wildcard, which means every possible prefix matches. The optimizer cannot narrow the index range and must scan every row. On a 100-million-row table this is the difference between a millisecond query and a minute-long query.

> [!success] Restructure the query or add a full-text index
>
> Three viable alternatives for leading-wildcard searches:
>
> - **Prefix the data, not the query.** If the use case is "find strings ending in `.AS`", store an inverted copy (`REVERSE(symbol)`) as a computed column and filter with `REVERSE(symbol) LIKE 'SA.%'`.
> - **Add a full-text index.** SQL Server's full-text indexing supports `CONTAINS` and `FREETEXT` searches that operate on a word-level inverted index, not a sort order. This is the right tool for "find documents containing word X anywhere" searches.
> - **Accept the scan.** For infrequent queries on small tables, a scan is cheap. Don't over-engineer.

#### Trailing-space ANSI padding trap

> [!failure] LIKE 'abc' matches 'abc   ' because of ANSI padding
>
> When `SET ANSI_PADDING` is `ON` (the default, and effectively mandatory since SQL Server 2005), trailing spaces in a `varchar` value are preserved on disk but **ignored** by the `=` operator and by `LIKE` when the pattern has no trailing wildcard. This means `WHERE v LIKE 'abc'` matches `'abc'`, `'abc '`, `'abc   '`, and any other trailing-space variant — identical to `WHERE v = 'abc'`. It does **not** match `'abcd'`.

*Compare `LIKE 'abc'`, `LIKE 'abc%'`, and `= 'abc'` against three stored values.*

```sql
DECLARE @t TABLE (v varchar(10));
INSERT @t VALUES ('abc'), ('abc   '), ('abcd');
SELECT
    v,
    CASE WHEN v LIKE 'abc'  THEN 'YES' ELSE 'no' END AS like_abc,
    CASE WHEN v LIKE 'abc%' THEN 'YES' ELSE 'no' END AS like_abc_pct,
    CASE WHEN v  =   'abc'  THEN 'YES' ELSE 'no' END AS equal_abc
FROM @t
ORDER BY v;
```

| v | like_abc | like_abc_pct | equal_abc |
|---|---|---|---|
| abc | YES | YES | YES |
| abc    | YES | YES | YES |
| abcd | no | YES | no |

The second row (`'abc   '` with three trailing spaces) returns `YES` for both `LIKE 'abc'` and `= 'abc'` even though the stored value is clearly longer than the pattern. This is the ANSI padding rule — the trailing spaces are stripped from the comparison but preserved on disk. The third row returns `no` for `LIKE 'abc'` (no wildcard, must be equal) but `YES` for `LIKE 'abc%'` (the `%` matches `'d'`).

> [!success] Detect trailing spaces with DATALENGTH
>
> If you need to distinguish `'abc'` from `'abc   '`, compare `DATALENGTH` instead of using `LIKE` or `=`. `DATALENGTH('abc') = 3` but `DATALENGTH('abc   ') = 6`, so `WHERE DATALENGTH(v) > LEN(v)` flags every row with trailing whitespace.

### Pattern matching reference

| Operator / function | Use case | SARGable | Supports wildcards |
|---|---|---|---|
| `CHARINDEX(needle, haystack)` | Locate first position of a literal substring | No | No |
| `CHARINDEX(needle, haystack, start)` | Locate next occurrence after `start` | No | No |
| `PATINDEX(pattern, expression)` | Locate first position of a wildcard pattern | No | Yes (`%`, `_`, `[]`, `[^]`) |
| `LIKE 'prefix%'` | Prefix search | **Yes** (index seek possible) | Yes |
| `LIKE '%substring%'` | Contained-substring search | No | Yes |
| `LIKE '[A-C]%'` | Character-class prefix | **Yes** | Yes |
| `LIKE 'pattern' ESCAPE '\\'` | Match literal wildcard characters | Depends on prefix | Yes |
| `CONTAINS(col, 'word')` | Full-text word search (requires full-text index) | **Yes** (full-text) | Full-text syntax |

## Collation and Case/Accent Sensitivity

Collation controls two aspects of string handling: the **sort order** of characters (which affects `ORDER BY`, index key ordering, and range scans) and the **comparison rules** for equality (case sensitivity, accent sensitivity, kana sensitivity, width sensitivity). SQL Server applies collation at three levels — server, database, and column — and an expression can override the collation for a single comparison via the `COLLATE` clause.

### Inspecting collation

Before debugging a collation-related problem, find out which collation is actually in effect at each level. The default on most installations is `SQL_Latin1_General_CP1_CI_AS` — case-insensitive (`CI`), accent-sensitive (`AS`), under the Latin1 code page.

#### Database and server collation

*Return the current database's collation alongside the server default.*

```sql
SELECT
    DB_NAME()                                        AS db_name,
    CAST(DATABASEPROPERTYEX(DB_NAME(), 'Collation') AS varchar(128)) AS db_collation,
    CAST(SERVERPROPERTY('Collation') AS varchar(128)) AS server_collation;
```

| db_name | db_collation | server_collation |
|---|---|---|
| stoxx | SQL_Latin1_General_CP1_CI_AS | SQL_Latin1_General_CP1_CI_AS |

`SQL_Latin1_General_CP1_CI_AS` is the classic SQL Server default: case-insensitive, accent-sensitive, based on the Latin1 code page (CP1252) for `varchar` comparisons. This is the collation every untagged string literal inherits, which is why `'Apple' = 'apple'` evaluates to `TRUE` without any explicit `COLLATE` clause.

#### Column collation

*Return the per-column collation for the first five character columns of `silver.index_dim`.*

```sql
SELECT TOP 5
    c.name  AS column_name,
    t.name  AS type_name,
    c.max_length,
    c.collation_name
FROM sys.columns AS c
JOIN sys.types   AS t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('silver.index_dim')
  AND c.collation_name IS NOT NULL
ORDER BY c.column_id;
```

| column_name | type_name | max_length | collation_name |
|---|---|---|---|
| _index | varchar | 20 | SQL_Latin1_General_CP1_CI_AS |
| symbol | varchar | 20 | SQL_Latin1_General_CP1_CI_AS |
| long_name | nvarchar | 400 | SQL_Latin1_General_CP1_CI_AS |
| short_name | nvarchar | 200 | SQL_Latin1_General_CP1_CI_AS |
| sector | nvarchar | 200 | SQL_Latin1_General_CP1_CI_AS |

The `max_length` column reports bytes, not characters — that's why `nvarchar(200)` appears as `400` (2 bytes per UCS-2 character). The `collation_name` column shows that every column inherits the database collation; there is no per-column override in this table. When joining tables whose columns have different collation names, SQL Server raises error 468 unless one side is explicitly coerced.

### COLLATE clause

The `COLLATE` clause applied to an expression overrides its effective collation for that single evaluation. It is used for three distinct purposes: forcing a specific comparison semantic (case or accent sensitivity), resolving a collation conflict between two sides of a join, and explicit `ORDER BY` ordering when the default collation is unsuitable.

#### Force case sensitivity

*Compare `'Apple'` and `'apple'` under a case-insensitive collation and a case-sensitive collation.*

```sql
SELECT
    CASE WHEN 'Apple' = 'apple'
                        COLLATE Latin1_General_CI_AS THEN 'equal' ELSE 'not equal' END AS case_insensitive,
    CASE WHEN 'Apple' = 'apple'
                        COLLATE Latin1_General_CS_AS THEN 'equal' ELSE 'not equal' END AS case_sensitive;
```

| case_insensitive | case_sensitive |
|---|---|
| equal | not equal |

The `CI` (case-insensitive) suffix makes the comparison ignore case. The `CS` (case-sensitive) suffix makes it distinguish `A` from `a`. Both still respect accent sensitivity because both end in `AS`. The four sensitivity suffixes in order are `CS/CI`, `AS/AI` (accent sensitive/insensitive), `KS/KI` (kana sensitive/insensitive, for Japanese), and `WS/WI` (width sensitive/insensitive, for East-Asian half/full-width forms).

#### Force accent insensitivity

*Compare `café` and `cafe` under an accent-sensitive collation and an accent-insensitive collation.*

```sql
SELECT
    CASE WHEN N'café' = N'cafe'
                        COLLATE Latin1_General_CI_AS THEN 'equal' ELSE 'not equal' END AS accent_sensitive,
    CASE WHEN N'café' = N'cafe'
                        COLLATE Latin1_General_CI_AI THEN 'equal' ELSE 'not equal' END AS accent_insensitive;
```

| accent_sensitive | accent_insensitive |
|---|---|
| not equal | equal |

Under `CI_AS`, `é` and `e` are considered distinct characters, so the two strings are not equal. Under `CI_AI`, accents are stripped before comparison, so `café` and `cafe` compare as equal. Accent-insensitive collations are useful for user-facing search features ("find `cafe` and also `café`, `cafè`, `câfe`") but can mask real data-quality issues, so use them deliberately at the query level, not as a column default.

### Collation conflict error 468

Joining or comparing two string expressions with different collations raises error 468 unless one side is explicitly coerced. This subsection shows the failure mode first and then the canonical fix.

#### Trigger error 468 by joining CI_AS and CS_AS columns

> [!failure] Cannot resolve the collation conflict between the two columns
>
> When two string expressions with different explicit or implicit collations are compared (`=`, `<`, `JOIN ON`, `UNION`, etc.), SQL Server has no default rule for which side wins. It raises error 468 and aborts the statement. This typically occurs when joining a table from one database (with its own default collation) to a table in another database, or when joining a `CI_AS` column to a `CS_AS` column created under a stricter collation.

*Create two table variables with different collations and join them.*

```sql
DECLARE @a table (v varchar(10) COLLATE Latin1_General_CI_AS);
DECLARE @b table (v varchar(10) COLLATE Latin1_General_CS_AS);
INSERT @a VALUES ('Apple');
INSERT @b VALUES ('Apple');
SELECT a.v
FROM @a AS a
JOIN @b AS b ON a.v = b.v;
```

```text
Msg 468
Cannot resolve the collation conflict between "Latin1_General_CS_AS" and "Latin1_General_CI_AS" in the equal to operation.
```

The error message names both collations explicitly. The fix is to coerce one (or both) sides to a common collation in the `ON` clause. The most portable choice is `DATABASE_DEFAULT`, which resolves to whatever the current database's default collation is and avoids hard-coding a specific name.

> [!success] Coerce both sides with COLLATE DATABASE_DEFAULT
>
> Add `COLLATE DATABASE_DEFAULT` to the join predicate on both sides. This forces both expressions into the same collation at comparison time without changing the underlying storage. It is the standard fix for cross-database and cross-collation joins.

#### Fix error 468 with COLLATE DATABASE_DEFAULT

*Retry the join with both sides coerced to `DATABASE_DEFAULT`.*

```sql
DECLARE @a table (v varchar(10) COLLATE Latin1_General_CI_AS);
DECLARE @b table (v varchar(10) COLLATE Latin1_General_CS_AS);
INSERT @a VALUES ('Apple');
INSERT @b VALUES ('Apple');
SELECT a.v
FROM @a AS a
JOIN @b AS b ON a.v COLLATE DATABASE_DEFAULT = b.v COLLATE DATABASE_DEFAULT;
```

| v |
|---|
| Apple |

The join now succeeds because both sides are compared under the database's default collation (`SQL_Latin1_General_CP1_CI_AS` in `stoxx`), which is case-insensitive. The two `'Apple'` values match and the single expected row is returned. Note that the fix has a side effect: both columns are now wrapped in a function (`COLLATE`), making the join non-SARGable. For high-volume joins, the long-term fix is to align the column collations at schema-design time, not to rely on `COLLATE DATABASE_DEFAULT` at query time.

## Splitting and Identifier Safety

This section covers the three functions that turn delimited strings into rows and that safely wrap identifiers and user input for dynamic SQL: `STRING_SPLIT`, `QUOTENAME`, and `STRING_ESCAPE`. Using them correctly is the difference between a clean dynamic query and a SQL injection vulnerability.

### STRING_SPLIT

`STRING_SPLIT(input, separator [, enable_ordinal])` is a table-valued function that turns a single-character-delimited string into a one-column rowset. The optional `enable_ordinal` argument (SQL Server 2022+) adds a second column with the 1-based position of each item in the original string, preserving order.

#### Basic comma-delimited split

*Split a four-symbol CSV into rows.*

```sql
SELECT value
FROM STRING_SPLIT('ASML.AS,SAP.DE,MC.PA,OR.PA', ',');
```

| value |
|---|
| ASML.AS |
| SAP.DE |
| MC.PA |
| OR.PA |

Without the `enable_ordinal` argument, `STRING_SPLIT` returns a single `value` column. The row order is **not guaranteed** to match the input string order — SQL Server is free to return the rows in any order, and the optimizer can change that order between executions. Never rely on implicit ordering without specifying `enable_ordinal = 1` and an `ORDER BY ordinal`.

#### STRING_SPLIT with enable_ordinal (SQL Server 2022+)

*Split the same CSV with the `enable_ordinal` argument and order by position.*

```sql
SELECT value, ordinal
FROM STRING_SPLIT('ASML.AS,SAP.DE,MC.PA,OR.PA', ',', 1)
ORDER BY ordinal;
```

| value | ordinal |
|---|---|
| ASML.AS | 1 |
| SAP.DE | 2 |
| MC.PA | 3 |
| OR.PA | 4 |

The `ordinal` column makes the original input order explicit and stable. For any use case where the order matters — for example, parsing positional arguments, mapping to an array index in the caller, or preserving the user-supplied sequence — always enable the ordinal and order by it.

#### Join STRING_SPLIT output against a real table

*Use `STRING_SPLIT` to filter `silver.index_dim` by a caller-supplied symbol list.*

```sql
SELECT TOP 5
    d.symbol, d.sector
FROM silver.index_dim AS d
JOIN STRING_SPLIT('ASML.AS,SAP.DE,MC.PA,OR.PA', ',') AS s
  ON d.symbol = s.value
WHERE d.is_current = 1
ORDER BY d.symbol;
```

| symbol | sector |
|---|---|
| ASML.AS | Technology |
| MC.PA | Consumer Cyclical |
| OR.PA | Consumer Defensive |
| SAP.DE | Technology |

This is the canonical pattern for converting an application-supplied comma-delimited parameter into a relational filter. It avoids dynamic SQL (no string concatenation into an `IN` clause), stays SARGable against an index on `symbol`, and handles any reasonable number of symbols. The alternative — a table-valued parameter — is slightly more robust for very large lists, but `STRING_SPLIT` is perfect for app-supplied short filter lists up to a few hundred items.

### QUOTENAME

`QUOTENAME(name [, quote_char])` wraps an identifier in square brackets (the default) or in another quoting character, and escapes any embedded closing delimiters. It is the **only** safe way to interpolate an identifier into a dynamic SQL string — manual bracket-building is vulnerable to injection when the identifier contains a `]` character.

#### QUOTENAME with default and alternate quote characters

*Wrap identifiers in brackets, double quotes, and single quotes.*

```sql
SELECT
    QUOTENAME('Order Details')       AS bracketed,
    QUOTENAME('abc', '"')             AS double_quoted,
    QUOTENAME('isn''t', '''')         AS single_quoted;
```

| bracketed | double_quoted | single_quoted |
|---|---|---|
| [Order Details] | "abc" | 'isn''t' |

Three patterns in one call:

- Default: wrap in `[...]`.
- Alternate quote `"`: wrap in `"..."` for ANSI-quoted identifiers.
- Alternate quote `'`: wrap in `'...'` and double any embedded single quote — the canonical way to build a **literal** string inside dynamic SQL. `QUOTENAME('isn''t', '''')` returns `'isn''t'`, which when embedded in a dynamic SQL batch parses as the literal `isn't`.

#### QUOTENAME over 128 characters returns NULL

> [!failure] QUOTENAME silently returns NULL for identifiers longer than 128 characters
>
> SQL Server identifiers have a maximum length of 128 characters (the `sysname` type is `nvarchar(128)`). `QUOTENAME` cannot quote a longer input because the result would not be a valid identifier, so it returns `NULL` instead of raising an error. Any code that concatenates `QUOTENAME(x)` into a dynamic SQL string will silently produce `NULL`, which collapses the entire dynamic SQL to `NULL`, which runs no query at all — a silent, production-breaking failure mode.

*Call `QUOTENAME` with inputs of length 128 and 129.*

```sql
SELECT
    QUOTENAME(REPLICATE('x', 128)) AS len_128,
    QUOTENAME(REPLICATE('x', 129)) AS len_129_is_null;
```

| len_128 | len_129_is_null |
|---|---|
| [xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx] | NULL |

The 128-character input produces a valid bracketed identifier of 130 characters (128 content + 2 brackets). The 129-character input returns `NULL`. Any dynamic SQL builder that accepts caller-supplied identifier names must either validate length before calling `QUOTENAME` or explicitly check for `NULL` after.

> [!success] Validate identifier length or check for NULL after QUOTENAME
>
> Two defensive patterns work:
>
> - **Pre-validate.** Raise a clean error with `RAISERROR` or `THROW` if `LEN(@name) > 128` before calling `QUOTENAME`.
> - **Post-check.** After `SET @sql = 'SELECT * FROM ' + QUOTENAME(@name);`, verify `@sql IS NOT NULL` before `EXEC(@sql)`. A `NULL` `@sql` silently runs nothing.

### STRING_ESCAPE

`STRING_ESCAPE(text, type)` escapes special characters in a string according to the rules of a target format. The only currently supported `type` is `'json'`, which escapes `"`, `\`, newlines, tabs, and control characters using JSON escape sequences. It is the right tool for building JSON strings by hand when a full `FOR JSON` clause is overkill.

#### Escape a string for JSON output

*Escape a string containing double quotes and a tab character.*

```sql
SELECT STRING_ESCAPE('He said "hi"' + CHAR(9) + 'there', 'json') AS escaped;
```

| escaped |
|---|
| He said \"hi\"\tthere |

The two double quotes become `\"` and the tab character (`CHAR(9)`) becomes `\t`. The resulting string can be safely dropped between JSON string delimiters without producing invalid JSON. Under most circumstances you should let `FOR JSON PATH` handle escaping for you; reach for `STRING_ESCAPE` only when building a JSON fragment at the expression level.

### Splitting and identifier reference

| Function | Purpose | Version | Notes |
|---|---|---|---|
| `STRING_SPLIT(s, sep)` | Split a delimited string into rows | 2016 | No ordinal; order not guaranteed |
| `STRING_SPLIT(s, sep, 1)` | Split with 1-based `ordinal` column | 2022 | Use `ORDER BY ordinal` to preserve order |
| `QUOTENAME(id)` | Wrap identifier in `[...]` | Always | Returns `NULL` for lengths > 128 |
| `QUOTENAME(id, '"')` | Wrap in double quotes | Always | ANSI-quoted identifier form |
| `QUOTENAME(id, '''')` | Wrap in single quotes, double embedded `'` | Always | Safe literal escaping for dynamic SQL |
| `STRING_ESCAPE(s, 'json')` | Escape for JSON literal | 2016 | Only `'json'` type is supported |

## Character Code Utilities

T-SQL exposes a small family of functions for inspecting and constructing characters by their code-point value. They are essential for building control characters (newline, tab, form feed), for debugging encoding issues, and for implementing character-level transformations that the high-level string functions cannot express.

### ASCII, UNICODE, CHAR, and NCHAR

The four functions form two inverse pairs:

- `ASCII(x)` returns the code point (0–255) of the first byte of `x`. Its inverse is `CHAR(n)`, which returns the single-byte character with code point `n`.
- `UNICODE(x)` returns the Unicode code point (0–65535 for BMP) of the first character of an `nvarchar` expression. Its inverse is `NCHAR(n)`.

Use `UNICODE`/`NCHAR` for any input that may contain non-ASCII content; `ASCII`/`CHAR` silently truncate to a single byte under the string's code page.

#### Code points of ASCII and Unicode characters

*Return the ASCII and Unicode code points of `A`, `a`, `é`, and `日`.*

```sql
SELECT
    ASCII('A')     AS ascii_A,
    ASCII('a')     AS ascii_a,
    UNICODE(N'A')  AS unicode_A,
    UNICODE(N'é')  AS unicode_e_acute,
    UNICODE(N'日') AS unicode_nichi;
```

| ascii_A | ascii_a | unicode_A | unicode_e_acute | unicode_nichi |
|---|---|---|---|---|
| 65 | 97 | 65 | 233 | 26085 |

The uppercase and lowercase `A` differ by exactly 32 in their code points (`65` and `97`) — a consequence of ASCII's deliberate bit-flip encoding that lets `LOWER`/`UPPER` be implemented as a single bit toggle. `é` has Unicode code point 233 (Latin-1 Supplement). `日` (Japanese "sun/day") has code point 26085 (CJK Unified Ideographs), safely within the BMP.

#### Build characters from code points

*Return the characters corresponding to the code points from the previous query.*

```sql
SELECT
    CHAR(65)     AS char_65,
    CHAR(97)     AS char_97,
    NCHAR(233)   AS nchar_233,
    NCHAR(26085) AS nchar_26085;
```

| char_65 | char_97 | nchar_233 | nchar_26085 |
|---|---|---|---|
| A | a | é | 日 |

`CHAR` and `NCHAR` round-trip the `ASCII`/`UNICODE` values exactly. They are commonly used to insert control characters that cannot be typed as literals: `CHAR(9)` for tab, `CHAR(10)` for newline (LF), `CHAR(13)` for carriage return (CR), `CHAR(13) + CHAR(10)` for the Windows CRLF pair. Build multi-line strings by concatenating literals with `CHAR(13) + CHAR(10)`.

### SOUNDEX and DIFFERENCE

`SOUNDEX(x)` returns a 4-character phonetic hash of `x` using the classic Russell Soundex algorithm — an uppercase letter followed by three digits. Two strings with the same `SOUNDEX` code are considered phonetically similar, though the algorithm is English-centric and produces many false positives and negatives for other languages.

`DIFFERENCE(a, b)` compares the `SOUNDEX` codes of `a` and `b` and returns an integer from `0` (no similarity) to `4` (identical Soundex code). It is a quick-and-dirty phonetic similarity score.

#### Phonetic similarity with SOUNDEX and DIFFERENCE

*Compare three spelling variants of "Smith" phonetically.*

```sql
SELECT
    SOUNDEX('Smith')    AS sx_smith,
    SOUNDEX('Smyth')    AS sx_smyth,
    SOUNDEX('Schmidt')  AS sx_schmidt,
    DIFFERENCE('Smith', 'Smyth')   AS diff_smith_smyth,
    DIFFERENCE('Smith', 'Schmidt') AS diff_smith_schmidt,
    DIFFERENCE('Smith', 'Jones')   AS diff_smith_jones;
```

| sx_smith | sx_smyth | sx_schmidt | diff_smith_smyth | diff_smith_schmidt | diff_smith_jones |
|---|---|---|---|---|---|
| S530 | S530 | S530 | 4 | 3 | 2 |

Three observations:

- `Smith`, `Smyth`, and `Schmidt` all produce the same Soundex code `S530`, yet `DIFFERENCE('Smith','Schmidt')` is only 3. This is not a contradiction — `DIFFERENCE` is based on a sliding comparison of the first four Soundex digits, not on strict equality.
- `DIFFERENCE('Smith','Smyth') = 4` because the Soundex codes are literally identical.
- `DIFFERENCE('Smith','Jones') = 2` — the two names share some phonetic similarity despite being completely different words, which illustrates the false-positive weakness of the algorithm.

Use `SOUNDEX` and `DIFFERENCE` only for rough deduplication and fuzzy matching where false positives are acceptable. For serious fuzzy matching, use an external library or the SQL Server full-text thesaurus feature.

### FORMATMESSAGE

`FORMATMESSAGE(format_string, arg1, arg2, ...)` constructs a formatted string using `printf`-style placeholders (`%s`, `%d`, `%ld`) with argument substitution. It is primarily used for building error messages with `RAISERROR` and `THROW`, but is also handy for ad-hoc string formatting without dropping to `CONCAT` + `CAST`.

#### Build a printf-style error message

*Format a symbol + price + date message using positional arguments.*

```sql
SELECT FORMATMESSAGE('Symbol %s closed at %d cents (%s)', 'ASML.AS', 111380, '2026-04-07') AS msg;
```

| msg |
|---|
| Symbol ASML.AS closed at 111380 cents (2026-04-07) |

`%s` inserts a string, `%d` inserts a signed integer, `%ld` inserts a signed long (in practice the same as `%d` on SQL Server). Unlike C's `printf`, `FORMATMESSAGE` does not support `%f` for floating-point formatting — cast numbers to strings with `CAST(... AS varchar(N))` or `FORMAT` before passing them. The function is the right choice for message-building because it keeps the format separate from the data, which is easier to localize and audit than a chain of `CONCAT` calls.

### Character code reference

| Function | Input | Output | Notes |
|---|---|---|---|
| `ASCII(x)` | `varchar` | Code point 0–255 of first byte | Single-byte only |
| `CHAR(n)` | Integer 0–255 | Single-byte character | Inverse of `ASCII` |
| `UNICODE(x)` | `nvarchar` | Code point of first character | BMP-safe, 0–65535 |
| `NCHAR(n)` | Integer 0–1114111 | Unicode character | Inverse of `UNICODE`; supports supplementary plane |
| `SOUNDEX(x)` | `varchar` | 4-character phonetic hash | English-centric |
| `DIFFERENCE(a, b)` | Two strings | Integer 0–4 | Based on Soundex similarity |
| `FORMATMESSAGE(fmt, ...)` | Format + args | Formatted string | `%s`/`%d`/`%ld`, no `%f` |

## Practical Parsing: Ticker Symbols and ISO Codes

This section ties the preceding functions together with real examples on the `stoxx` database. The common thread is that all three demos decompose or categorize a string column (`symbol`, `country`, `iso_alpha2`) using functions from every earlier section — `LEFT`, `RIGHT`, `CHARINDEX`, `LEN`, `DATALENGTH`, `CASE`, and `GROUP BY`.

### Parse ticker root and exchange suffix

Yahoo Finance-style ticker symbols encode the exchange as a dot-suffix: `ASML.AS` is ASML on Euronext Amsterdam, `SAP.DE` is SAP on XETRA Frankfurt, `7203.T` is Toyota on the Tokyo Stock Exchange. US-listed symbols have no suffix. Parsing the root and suffix cleanly requires handling the presence/absence of the dot.

#### Split symbol into root and exchange suffix

*Return the ticker root and exchange suffix for every symbol that contains a dot.*

```sql
SELECT TOP 5
    symbol,
    LEFT(symbol, CHARINDEX('.', symbol) - 1) AS root,
    RIGHT(symbol, LEN(symbol) - CHARINDEX('.', symbol)) AS suffix
FROM silver.index_dim
WHERE is_current = 1 AND CHARINDEX('.', symbol) > 0
ORDER BY symbol;
```

| symbol | root | suffix |
|---|---|---|
| 0388.HK | 0388 | HK |
| 1299.HK | 1299 | HK |
| 1810.HK | 1810 | HK |
| 2269.HK | 2269 | HK |
| 3382.T | 3382 | T |

The `WHERE CHARINDEX('.', symbol) > 0` guard protects `LEFT(..., pos - 1)` from the `pos = 0` case that would produce `LEFT(..., -1)` and raise error 537. The `RIGHT(symbol, LEN(symbol) - pos)` expression takes everything after the dot: `LEN('3382.T') = 6`, `pos = 5`, so `RIGHT(symbol, 1) = 'T'`. The symbols without a dot (US tickers) are excluded from this query — they are counted in the next demo.

### Count symbols by exchange

Group the parsed suffixes to see how many symbols trade on each exchange. US tickers (no suffix) end up in the empty-string bucket.

#### Group symbols by exchange suffix

*Count symbols per exchange suffix in `silver.index_dim`, treating US tickers (no suffix) as an empty string.*

```sql
SELECT TOP 5
    CASE WHEN CHARINDEX('.', symbol) > 0
         THEN RIGHT(symbol, LEN(symbol) - CHARINDEX('.', symbol))
         ELSE '' END AS exchange_suffix,
    COUNT(*) AS n_symbols
FROM silver.index_dim
WHERE is_current = 1
GROUP BY CASE WHEN CHARINDEX('.', symbol) > 0
              THEN RIGHT(symbol, LEN(symbol) - CHARINDEX('.', symbol))
              ELSE '' END
ORDER BY n_symbols DESC;
```

| exchange_suffix | n_symbols |
|---|---|
|  | 69 |
| T | 33 |
| DE | 16 |
| PA | 16 |
| AX | 12 |

The top bucket with 69 rows is the empty-string suffix — those are US-listed symbols without a Yahoo-style exchange code. The Tokyo Stock Exchange (`.T`) is the second-largest with 33 symbols, followed by XETRA Frankfurt (`.DE`) and Euronext Paris (`.PA`) tied at 16, and the Australian Securities Exchange (`.AX`) at 12. The `CASE` expression appears twice — once in the `SELECT` and once in the `GROUP BY` — because SQL Server does not allow a `GROUP BY` to reference a column alias defined in the same `SELECT`.

### Fixed-width ISO country codes

The `bronze.dim_country` table uses a `char(2)` column for ISO 3166-1 alpha-2 country codes. This is the canonical case for `char(n)` over `varchar(n)`: every value is exactly 2 characters, fixed-width storage is efficient, and no trailing-space padding surprises the caller because every string fully uses its allotted width.

#### ISO codes stored as char(2)

*Return the first five countries with their ISO-2 code, character count, and byte count.*

```sql
SELECT TOP 5
    country_name,
    iso_alpha2,
    LEN(iso_alpha2)        AS len_iso,
    DATALENGTH(iso_alpha2) AS bytes_iso
FROM bronze.dim_country
ORDER BY iso_alpha2;
```

| country_name | iso_alpha2 | len_iso | bytes_iso |
|---|---|---|---|
| Andorra | AD | 2 | 2 |
| United Arab Emirates | AE | 2 | 2 |
| Afghanistan | AF | 2 | 2 |
| Antigua and Barbuda | AG | 2 | 2 |
| Anguilla | AI | 2 | 2 |

Both `LEN(iso_alpha2)` and `DATALENGTH(iso_alpha2)` return 2 for every row. This is the signature of a correctly-used `char(n)` column: the character count always equals the byte count and always equals `n`. If you see `LEN < DATALENGTH` on a `char` column, the column contains trailing spaces because the content is shorter than the declared width — a sign that the column should probably be `varchar(n)` instead.

## Practical Guidance

- **Prefer `CONCAT_WS` and `STRING_AGG` over manual `+` concatenation.** They skip `NULL` values automatically and produce cleaner delimited output with no orphan separators.
- **Wrap `STRING_AGG` in `CAST(... AS nvarchar(max))` for any aggregation whose total length is not tightly bounded.** The 8000-byte truncation error in production is avoidable by adopting the LOB cast as a default defensive pattern.
- **Use `LEN` for characters and `DATALENGTH` for bytes** — and remember that `LEN` silently ignores trailing spaces. When detecting dirty input, use `DATALENGTH` or the `LEN(col + '|')` sentinel trick.
- **Keep string-cleaning and case-folding functions out of indexed predicates.** `WHERE TRIM(col) = 'x'`, `WHERE LOWER(col) = 'x'`, and `WHERE SUBSTRING(col, 1, 3) = 'x'` all disable the index seek. Clean data at ingestion, not at query time.
- **Use prefix `LIKE` patterns (`'prefix%'`) when the search permits them** — they are the only wildcard form that can use an index seek. Leading-wildcard patterns always scan.
- **Always pair `STRING_SPLIT` with `enable_ordinal = 1` and `ORDER BY ordinal`** when order matters. The function does not preserve input order without the ordinal column.
- **Use `QUOTENAME` for every identifier interpolated into dynamic SQL**, and either validate the identifier length before calling it or check for `NULL` after. Never build `[...]` wrappers by hand.
- **Prefix every Unicode literal with `N`** when the target column is `nchar`/`nvarchar`. There is no downside for ASCII-only strings and it is the only way to preserve non-ASCII characters through the literal path.
- **Coerce collation with `COLLATE DATABASE_DEFAULT` on both sides of a cross-collation join** to resolve error 468. For high-volume joins, fix the root cause by aligning column collations at the schema level instead.
- **Prefer `TRANSLATE` over chained `REPLACE` calls** whenever the substitution is strictly 1:1 character-to-character.
