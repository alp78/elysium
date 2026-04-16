---
title: "06 - Numeric and Aggregate Functions"
tags: [sql-server, tsql, query-writing]
aliases: [math functions, aggregate reference, COUNT SUM AVG, ROLLUP CUBE GROUPING SETS, conditional aggregation, OPENROWSET aggregates, CSV JSON XML aggregates]
description: "T-SQL reference for SQL Server aggregate functions (COUNT/COUNT_BIG/COUNT DISTINCT/APPROX_COUNT_DISTINCT/CHECKSUM_AGG, SUM/AVG/MIN/MAX, STDEV/STDEVP/VAR/VARP), scalar math (ABS/SIGN/CEILING/FLOOR/ROUND, POWER/SQUARE/SQRT/LOG/LOG10/EXP, trigonometric family, RAND/CRYPT_GEN_RANDOM), NULL handling, HAVING semantics, conditional aggregation with CASE, divide-by-zero protection with NULLIF, multi-level grouping (ROLLUP/CUBE/GROUPING SETS, GROUPING/GROUPING_ID), and aggregating directly over external CSV/JSON/XML files via OPENROWSET."
created: 2026-04-08
updated: 2026-04-11
status: complete
---

# Numeric and Aggregate Functions

> [!abstract]- Summary
>
> Aggregate queries are where T-SQL turns rowsets into measurements: this note covers the semantics that govern grouped results, the numeric and statistical functions that compute them, and the safety rules that keep totals, ratios, and subtotals correct on real workloads and external files.
>
> **Aggregate semantics**
> - covers null handling across aggregates, logical processing order, `WHERE` versus `HAVING`, and the empty-grain `GROUP BY ()` pattern
>
> **Count and summary functions**
> - covers `COUNT(*)`, `COUNT(column)`, `COUNT(DISTINCT)`, `COUNT_BIG`, `APPROX_COUNT_DISTINCT`, `CHECKSUM_AGG`, `SUM`, `AVG`, `MIN`, `MAX`, `STDEV`, `STDEVP`, `VAR`, and `VARP`
>
> **Conditional and ratio patterns**
> - covers `SUM(CASE WHEN ...)`, filtered averages, divide-by-zero protection with `NULLIF`, decimal promotion, and percent-of-total logic
>
> **Scalar math layer**
> - covers rounding, truncation, powers, logarithms, trigonometry, and the difference between `RAND()` and `CRYPT_GEN_RANDOM`
>
> **Multi-level grouping**
> - covers `ROLLUP`, `CUBE`, `GROUPING SETS`, `GROUPING`, and `GROUPING_ID` for subtotal and cube-style output
>
> **External and windowed aggregation**
> - covers direct aggregation over CSV, JSON, and XML via `OPENROWSET(BULK ...)` and cross-references running totals and percent-of-total via window aggregates
>
> **Operations and safety**
> - Warnings: `SUM(int)` can overflow, `AVG(int)` truncates, `COUNT(*)` and `COUNT(column)` answer different questions, `float` aggregates are order-sensitive, denominator zero must be guarded, subtotal `NULL`s are ambiguous without `GROUPING`, and local parquet is out of scope
> - Recommendations: cast to `bigint` or `decimal` when needed, keep row predicates in `WHERE` and aggregate predicates in `HAVING`, prefer conditional aggregation over many `PIVOT` cases, use `COUNT_BIG` for reusable large-table paths, and pre-shred JSON or XML before grouped analysis

> [!note]- Glossary
>
> **Aggregate**
> - A function that consumes a set of input rows and returns one summary value for that set.
> - It matters because the note’s first half is about how aggregates behave before the author worries about which specific function to call.
>
> > [!info] Semantics come before function choice
> >
> > The same aggregate can produce a correct or incorrect answer depending on grouping, null treatment, and filter placement. Syntax alone does not guarantee the intended measurement.
>
> ---
>
> **Grouped rowset**
> - A result shape where rows have been collapsed according to the `GROUP BY` keys before the `SELECT` list is produced.
> - It matters because grouped queries change row grain, which determines what can be selected and what later aggregates can mean.
>
> > [!warning] Grouping changes legal projection
> >
> > After grouping, each output column must either come from the grouping key or be reduced by an aggregate. Mixing detail columns into grouped output is not valid.
>
> ---
>
> **`HAVING`**
> - The clause that filters groups after aggregation has already been computed.
> - It matters because aggregate predicates belong there, while row predicates belong in `WHERE`.
>
> > [!warning] Same filter verb, different stage
> >
> > Moving a row predicate from `WHERE` into `HAVING` is often legal but wasteful. It forces SQL Server to aggregate rows that should have been eliminated earlier.
>
> ---
>
> **`COUNT(*)` / `COUNT(column)`**
> - Two related count forms where `COUNT(*)` counts rows and `COUNT(column)` counts only non-null values in the specified expression.
> - It matters because confusing them leads directly to wrong completeness, missingness, and row-count metrics.
>
> > [!warning] These are not interchangeable
> >
> > The difference between `COUNT(*)` and `COUNT(col)` is the number of nulls in `col`. Use that difference deliberately instead of assuming both represent row count.
>
> ---
>
> **`COUNT_BIG`**
> - The count aggregate that returns a `bigint` instead of an `int`.
> - It matters because reusable analytical code should not assume row counts always fit inside 2.1 billion.
>
> > [!info] Same semantics, wider return type
> >
> > `COUNT_BIG` is not a different counting rule. It is the same operation with a safer return type for very large tables and long-lived code paths.
>
> ---
>
> **`APPROX_COUNT_DISTINCT`**
> - A probabilistic aggregate that estimates the number of distinct values with bounded error instead of computing the exact cardinality.
> - It matters because large-scale monitoring and exploratory analysis often need fast cardinality estimates more than exact reconciliation.
>
> > [!warning] Approximation is a product choice
> >
> > The speed gain is real, but the result is not exact. Use it where a bounded estimate is acceptable, not where auditability depends on the exact number.
>
> ---
>
> **Conditional aggregation**
> - The pattern of placing a `CASE` expression inside an aggregate to compute filtered counts, sums, or averages in one grouped pass.
> - It matters because it replaces many awkward post-processing queries and a large share of static pivot-style reporting.
>
> > [!info] Filter inside the aggregate
> >
> > `SUM(CASE WHEN ... THEN value END)` is often the cleanest way to derive multiple segmented metrics from one grouped scan.
>
> ---
>
> **`NULLIF` guard**
> - A divide-by-zero protection pattern that turns a zero denominator into `NULL` before division occurs.
> - It matters because ratios and percentages are routine in analytical SQL, and denominator safety must be deliberate.
>
> > [!warning] Arithmetic errors abort the statement
> >
> > Without a guard, divide-by-zero raises an error and stops the query. `NULLIF(denom, 0)` converts that failure boundary into a controlled null result.
>
> ---
>
> **Scalar math function**
> - A numeric function that operates on each row independently rather than across a group, such as `ROUND`, `LOG10`, or `SQRT`.
> - It matters because analytical SQL often combines grouped metrics with row-wise transformations in the same statement.
>
> > [!warning] Row-wise math still obeys type rules
> >
> > Rounding, truncation, logarithms, and trigonometric functions all inherit the data type and scale of their inputs. Type choice still shapes the result.
>
> ---
>
> **`ROLLUP`**
> - A grouping extension that produces hierarchical subtotals and a grand total by progressively removing keys from the right side of the grouping list.
> - It matters because it is the standard way to ask for detail plus subtotal output in one grouped query.
>
> > [!info] Hierarchy comes from key order
> >
> > `ROLLUP` is not just “more totals.” The order of grouping keys defines which subtotal levels SQL Server emits.
>
> ---
>
> **`CUBE`**
> - A grouping extension that returns subtotals for every combination of the listed grouping keys.
> - It matters because it is powerful for multidimensional analysis but expands result size far more aggressively than `ROLLUP`.
>
> > [!warning] Combinations grow quickly
> >
> > Each added dimension multiplies the number of subtotal combinations. `CUBE` should be used only when every cross-combination subtotal is truly required.
>
> ---
>
> **`GROUPING SETS`**
> - A grouping feature that lets the author specify the exact subtotal combinations to compute instead of accepting the full hierarchy or cube.
> - It matters because it is often the most precise and efficient way to request only the subtotal levels the report actually needs.
>
> > [!info] Explicit beats implicit when requirements are selective
> >
> > `GROUPING SETS` avoids the extra subtotal rows that `ROLLUP` or `CUBE` would generate when the desired combinations are only a subset.
>
> ---
>
> **`GROUPING` / `GROUPING_ID`**
> - Helper functions that identify whether a `NULL` in grouped output is a real source value or a subtotal marker introduced by grouping extensions.
> - It matters because subtotal rows are otherwise indistinguishable from real null-valued data.
>
> > [!warning] Null alone is ambiguous
> >
> > A subtotal marker and a real source `NULL` render the same way in the result. Label subtotal rows with `GROUPING` metadata instead of guessing from the raw columns.
>
> ---
>
> **Window aggregate**
> - An aggregate function used with `OVER (...)` so it computes across partitions or frames without collapsing the input rows.
> - It matters because percent-of-total and running-total patterns belong to this boundary between grouped and row-preserving analytics.
>
> > [!info] Same math, different row behavior
> >
> > `SUM(x)` collapses rows. `SUM(x) OVER (...)` preserves them. That distinction is why window aggregates are treated as a bridge to the window-functions note.
>
> ---
>
> **`OPENROWSET(BULK ...)`**
> - The SQL Server entry point for reading external files such as CSV, JSON, or XML directly inside a query.
> - It matters because the note shows how to apply aggregates before a full ingest pipeline exists, provided the source is in a supported format and is shaped correctly first.
>
> > [!warning] External aggregation still needs shaping
> >
> > Flat CSV can often be aggregated directly, but JSON and XML usually need shredding before grouping. Unsupported formats such as local parquet require a different ingestion path.

## Aggregate Semantics and NULL Handling

Before reaching for a specific function, it helps to internalize four rules that apply to every T-SQL aggregate: how `NULL` is treated, what the empty-grain aggregate means, how `WHERE` and `HAVING` differ, and the logical order in which clauses are processed. Skipping these rules is the single most common source of "correct syntax, wrong answer" bugs in analytical SQL.

### NULL handling across all aggregates

Every T-SQL aggregate **except `COUNT(*)`** ignores `NULL` values in its input. This is SQL-standard behavior, but it is easy to forget because the NULLs are discarded silently — there is no warning and no diagnostic row count telling you that five of the ten input rows were skipped.

#### Every aggregate except COUNT(*) ignores NULL

Use this tiny rowset to show that null inputs are skipped silently.

*Apply all six core aggregates to a 5-row input containing two `NULL` values.*

```sql
SELECT
    COUNT(*)     AS count_star,
    COUNT(v)     AS count_v,
    SUM(v)       AS sum_v,
    AVG(v)       AS avg_v,
    MIN(v)       AS min_v,
    MAX(v)       AS max_v
FROM (VALUES (10), (20), (NULL), (30), (NULL)) AS t(v);
```

| count_star | count_v | sum_v | avg_v | min_v | max_v |
|---|---|---|---|---|---|
| 5 | 3 | 60 | 20 | 10 | 30 |

Five key observations from this single row:

- **`COUNT(*)` returns 5** — the total number of rows, including the two with `NULL` in `v`. `COUNT(*)` is the only aggregate that counts rows without looking at any specific column.
- **`COUNT(v)` returns 3** — the number of rows where `v` is not null. The difference between `COUNT(*)` and `COUNT(col)` is the null-count of that column.
- **`SUM(v)` returns 60** — the two `NULL` rows are skipped; `10 + 20 + 30 = 60`. The SUM is **not** `NULL` just because some inputs were null.
- **`AVG(v)` returns 20** — the arithmetic mean of the three non-null values (`60 / 3 = 20`), not `60 / 5 = 12`. `NULL` values are excluded from both the numerator and the denominator.
- **`MIN` and `MAX`** ignore `NULL` and return the smallest/largest non-null value.

#### AVG treats NULL as missing, not zero

> [!warning] Never use AVG to compute "mean including missing-as-zero"
>
> Because `AVG` excludes `NULL` values from the denominator as well as the numerator, it reports the mean of the **non-null** subset, not the mean of all rows. If the business meaning of a `NULL` is "zero" (or "no activity"), the correct form is `AVG(COALESCE(col, 0))` or `SUM(col) / COUNT(*)` — either forces every row to participate in the denominator.

> [!success] Choose NULL semantics explicitly
>
> Use plain `AVG(col)` only when `NULL` means "missing and should be excluded". If `NULL` means "zero", encode that business rule directly with `AVG(COALESCE(col, 0))` or an explicit `SUM(...) / COUNT(*)` expression so every row participates in the denominator by design.

*Contrast the two interpretations on the same 5-row input.*

```sql
SELECT
    AVG(v)                             AS avg_ignoring_null,
    AVG(COALESCE(v, 0))                AS avg_treating_null_as_zero
FROM (VALUES (10), (20), (NULL), (30), (NULL)) AS t(v);
```

| avg_ignoring_null | avg_treating_null_as_zero |
|---|---|
| 20 | 12 |

The same five rows produce two very different averages: `20` if `NULL` means "missing and should be excluded", `12` if `NULL` means "zero activity and should count toward the mean". Neither answer is universally correct — the right choice depends on what `NULL` represents in the source data. Decide explicitly; never rely on the default behavior when the two interpretations diverge.

### Logical processing order: WHERE runs before GROUP BY, HAVING runs after

T-SQL evaluates a `SELECT` statement in a fixed logical order that does **not** match the order clauses appear in the written query. For aggregate queries, the relevant sequence is:

1. `FROM` — source tables and joins are materialized
2. `WHERE` — row-level filters applied; aggregates are **not** yet computed
3. `GROUP BY` — surviving rows are grouped by the grouping expressions
4. `HAVING` — group-level filters applied; aggregates **are** now available
5. `SELECT` — the projection list is evaluated
6. `ORDER BY` — final sort

The rule this enforces is operational: **row-level predicates belong in `WHERE`; aggregate-level predicates belong in `HAVING`**. Putting an aggregate inside `WHERE` raises error 147; putting a row-level predicate in `HAVING` is legal but forces SQL Server to aggregate first and discard later, which is usually slower and always less readable.

#### Aggregate in WHERE raises error 147

> [!failure] `WHERE COUNT(*) > N` is a parse-time error
>
> `WHERE` is evaluated before the `GROUP BY`/aggregate step, so aggregate functions cannot appear there. SQL Server raises error 147 "An aggregate may not appear in the WHERE clause..." The fix is to move the aggregate predicate into `HAVING`.

*Trigger error 147 by putting `COUNT(*)` inside `WHERE`.*

```sql
SELECT symbol, COUNT(*) AS trading_days
FROM silver.eurostoxx50_ohlcv
WHERE COUNT(*) > 1000
GROUP BY symbol;
```

```text
Msg 147, Level 15, State 1
An aggregate may not appear in the WHERE clause unless it is in a subquery
contained in a HAVING clause or a select list, and the column being aggregated
is an outer reference.
```

> [!success] Filter aggregates with HAVING; filter rows with WHERE
>
> `HAVING` is evaluated after `GROUP BY`, so aggregate references are legal there. Combine `WHERE` (row filter) and `HAVING` (group filter) in the same query whenever both levels of filtering are needed. This minimizes the number of rows entering the aggregate step and keeps the group filter semantically clear.

*Filter rows to 2025-onwards with `WHERE`, then filter groups with average close above €500 using `HAVING`.*

```sql
SELECT
    symbol,
    COUNT(*)        AS trading_days,
    AVG([close])    AS avg_close
FROM silver.eurostoxx50_ohlcv
WHERE [date] >= '2025-01-01'
GROUP BY symbol
HAVING AVG([close]) > 500
ORDER BY avg_close DESC;
```

| symbol | trading_days | avg_close |
|---|---|---|
| RMS.PA | 321 | 2246.4595015576324 |
| RHM.DE | 319 | 1538.5100313479625 |
| ADYEN.AS | 321 | 1412.9607476635515 |
| ASML.AS | 321 | 816.0451713395634 |
| ARGX.BR | 321 | 617.6990654205608 |

Five EuroStoxx 50 constituents whose average daily close price since 2025-01-01 exceeds €500. Hermès (`RMS.PA`) tops the list at roughly €2,246 — this is a single-share price, not a market-cap ranking, and reflects Hermès' deliberate low-split policy. `WHERE` discarded every row outside the date window before grouping, then `HAVING` discarded every group whose post-aggregation `AVG([close])` failed the €500 threshold. Only seven symbols pass both filters in the full result set.

### GROUP BY () — the empty-grain aggregate

`GROUP BY ()` explicitly requests a single grouping set with zero grouping columns, which produces exactly **one output row** covering the entire input. It is semantically equivalent to an aggregate query with no `GROUP BY` clause at all, but writing the empty parentheses explicitly makes the intent obvious and is required inside `GROUPING SETS` when the grand total is one of the requested groups.

*Collapse every row in `silver.eurostoxx50_ohlcv` into a single row with the row count and total traded volume.*

```sql
SELECT
    COUNT(*)    AS row_count,
    SUM(volume) AS total_volume
FROM silver.eurostoxx50_ohlcv
GROUP BY ();
```

| row_count | total_volume |
|---|---|
| 67155 | 398933707833 |

The whole silver-layer EuroStoxx 50 fact table is collapsed to one row: 67,155 rows and roughly 398.9 billion shares traded across the 50 constituents over the 2021–2026 window. Omitting the `GROUP BY` clause entirely would produce the same result, but the explicit `GROUP BY ()` communicates to the reader that the single-row output is intentional and not a missed grouping key.

## COUNT, COUNT_BIG, COUNT(DISTINCT), and APPROX_COUNT_DISTINCT

T-SQL has four distinct counting functions. Each has a different use case, a different result type, and a different performance profile. Using the wrong one is a common source of both overflow bugs and wasted memory in large-scale analytical queries. This section establishes the four variants, then adds `CHECKSUM_AGG` as the specialized "did anything change" helper.

### COUNT(*) vs COUNT(column)

`COUNT(*)` counts rows. `COUNT(column)` counts rows where `column` is not `NULL`. The difference is exactly the count of null values in that column, which makes this pair the idiomatic way to measure missingness without a separate `IS NULL` predicate.

#### Use COUNT(*) − COUNT(col) to measure column missingness

This count pair separates total rows from non-null rows in one pass.

*Count total rows, non-null beta rows, and derive the missing-beta count on `silver.signals_daily`.*

```sql
SELECT
    COUNT(*)                AS count_all_rows,
    COUNT(beta)             AS count_non_null_beta,
    COUNT(*) - COUNT(beta)  AS missing_beta_rows
FROM silver.signals_daily;
```

| count_all_rows | count_non_null_beta | missing_beta_rows |
|---|---|---|
| 635 | 625 | 10 |

`silver.signals_daily` has 635 signal rows in total, but only 625 have a non-null `beta` value — 10 rows are missing it (about 1.6%). This is the canonical pattern for data-quality dashboards: `COUNT(*) − COUNT(col)` is a single-pass, index-friendly missingness metric that does not require a second query or a `WHERE col IS NULL` filter. For multi-column missingness audits, repeat the expression per column in the same `SELECT` so the whole coverage profile comes back in one row.

### COUNT(DISTINCT column)

`COUNT(DISTINCT column)` counts the number of distinct non-null values in the column. It is the most expensive of the four variants because the engine must build a hash or sort every input value to deduplicate it — the work scales with the cardinality of the column, not the size of the input. On a 100-million-row table with 10 million distinct values, `COUNT(DISTINCT col)` can require gigabytes of memory or spill to `tempdb`.

*Measure the distinct-symbol and distinct-date cardinality of the EuroStoxx 50 fact table.*

```sql
SELECT
    COUNT(*)               AS total_rows,
    COUNT(DISTINCT symbol) AS distinct_symbols,
    COUNT(DISTINCT [date]) AS distinct_dates
FROM silver.eurostoxx50_ohlcv;
```

| total_rows | distinct_symbols | distinct_dates |
|---|---|---|
| 67155 | 50 | 1347 |

The 67,155 rows cover 50 distinct symbols and 1,347 distinct trading dates (roughly five full trading years). The grain of the table is one row per `(symbol, date)` pair — `50 × 1347 = 67,350`, within rounding distance of the actual 67,155, with the shortfall accounted for by symbol-specific suspensions, holidays, and partial coverage at index-boundary dates. `COUNT(DISTINCT)` is the right diagnostic when you want to confirm the grain of a fact table before writing aggregation queries against it.

### COUNT_BIG for very large rowsets

`COUNT` returns an `int`. On a table with more than 2,147,483,647 rows — two billion — `COUNT(*)` overflows with error 8115 "Arithmetic overflow error converting expression to data type int". `COUNT_BIG` is the `bigint` variant and has the same semantics otherwise.

*Use `COUNT_BIG(*)` to return a `bigint` row count.*

```sql
SELECT
    COUNT_BIG(*) AS row_count_big
FROM silver.eurostoxx50_ohlcv;
```

| row_count_big |
|---|
| 67155 |

At 67k rows this table is nowhere near the `int` limit, but the habit is worth forming for any analytical query that might eventually run against billion-row fact tables. The function call is no more expensive than `COUNT(*)` — the only difference is the output type. Prefer `COUNT_BIG` in reusable stored procedures and scheduled jobs where the underlying row count can grow over time.

### APPROX_COUNT_DISTINCT (SQL Server 2019+)

`APPROX_COUNT_DISTINCT` (SQL Server 2019+) is a HyperLogLog-based approximation of `COUNT(DISTINCT)`. The Microsoft [APPROX_COUNT_DISTINCT reference](https://learn.microsoft.com/en-us/sql/t-sql/functions/approx-count-distinct-transact-sql) guarantees an error bound of **at most 2% with 97% probability**, using constant memory regardless of input cardinality. On large input sets the speedup over exact `COUNT(DISTINCT)` is dramatic — tens to hundreds of times faster — at the cost of a small, bounded error.

*Compare exact and approximate distinct counts on a small input where both should return the same value.*

```sql
SELECT
    COUNT(DISTINCT symbol)        AS exact_distinct,
    APPROX_COUNT_DISTINCT(symbol) AS approx_distinct
FROM silver.eurostoxx50_ohlcv;
```

| exact_distinct | approx_distinct |
|---|---|
| 50 | 50 |

With only 50 distinct symbols the HyperLogLog estimate is exact — at small cardinalities the approximation error is effectively zero. On large tables with millions of distinct values, expect `APPROX_COUNT_DISTINCT` to differ from `COUNT(DISTINCT)` by up to 2%, which is acceptable for cardinality monitoring, sampling ratios, and dashboard-style counts but not for financial reconciliation or regulatory reporting. Use the exact form when the business caller needs a precise number; use the approximate form when the caller only needs a correct order of magnitude fast.

### CHECKSUM_AGG for change detection

`CHECKSUM_AGG` combines the `CHECKSUM` of each input value into a single 32-bit integer using XOR. It is the idiomatic way to detect whether a dataset has changed between two snapshots without comparing every row individually. It is **not** a cryptographic hash and is susceptible to ordering quirks and partial collisions — use it as a drift signal, not as a security primitive.

*Compute a stable checksum of ASML close prices since the start of 2026.*

```sql
SELECT
    CHECKSUM_AGG(CAST([close] * 1000 AS int)) AS price_checksum,
    COUNT(*)                                  AS rows_considered
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'ASML.AS'
  AND [date] >= '2026-01-01';
```

| price_checksum | rows_considered |
|---|---|
| 101356 | 66 |

`CHECKSUM_AGG` folded 66 `int`-cast close prices into a single 32-bit value (`101356`). Run the same query tomorrow — if the returned checksum is identical, nothing in the filtered window has changed; if it differs, at least one row has been inserted, updated, or deleted in that window. The cast to `int` is defensive: `CHECKSUM` over `float` can produce different checksums on logically-equal values because of floating-point representation, so bucket the float to a stable integer first. For production drift detection, prefer `HASHBYTES('SHA2_256', ...)` over a concatenated row shape when collision resistance matters — see the string-functions sibling note for the full treatment.

## SUM, AVG, MIN, MAX, and the Variance Family

`SUM`, `AVG`, `MIN`, and `MAX` are the four classical aggregates that collapse a numeric column into a single scalar. Each carries at least one non-obvious trap — integer overflow for `SUM`, integer truncation for `AVG`, collation sensitivity for `MIN`/`MAX` on strings, and ordering non-determinism for `float`. This section adds the variance family (`STDEV`, `STDEVP`, `VAR`, `VARP`) that is essential for any financial-analytics workload.

### SUM — basic form and return type

`SUM` returns the total of non-null input values. Its return type is derived from the input type using these rules:

- `SUM(int)` returns `int` (can overflow at 2.1 billion)
- `SUM(bigint)` returns `bigint` (can overflow at 9.2 × 10¹⁸)
- `SUM(decimal(p, s))` returns `decimal(38, s)` — precision is promoted to 38 to give arithmetic headroom, scale is preserved
- `SUM(float)` returns `float`, with the same IEEE-754 caveats as any other float arithmetic

#### Basic SUM with a defensive decimal cast

This cast keeps the arithmetic from inheriting narrow integer precision.

*Compare a raw `SUM(volume)` with a version that casts to `decimal(38,0)` for arithmetic headroom.*

```sql
SELECT
    SUM(volume)                        AS total_volume,
    SUM(CAST(volume AS decimal(38,0))) AS total_volume_decimal
FROM silver.eurostoxx50_ohlcv;
```

| total_volume | total_volume_decimal |
|---|---|
| 398933707833 | 398933707833 |

`volume` in `silver.eurostoxx50_ohlcv` is already stored as `bigint`, so both versions return the same value: roughly 398.9 billion shares traded across the 50 EuroStoxx constituents over the full 2021–2026 window. The cast to `decimal(38, 0)` is a defensive habit — it guarantees 38 digits of precision regardless of the source column type, which is useful in reusable code paths where the underlying column type may change over time.

### SUM over int silently overflows at 2.1 billion

> [!danger] SUM(int) aborts with error 8115 when the total exceeds 2,147,483,647
>
> `SUM` over an `int` expression returns an `int` result. If the cumulative total exceeds `int_max` (2,147,483,647), SQL Server raises error 8115 "Arithmetic overflow error converting expression to data type int" at runtime. The query aborts; no rows are returned. The danger is that the query can work fine for months on small windows (per-symbol or per-week) and then fail the first time it is run against a full-dataset window.

*Force the overflow by casting `volume` to `int` before summing across the full dataset.*

```sql
SELECT SUM(CAST(volume AS int)) AS volume_sum_int
FROM silver.eurostoxx50_ohlcv;
```

```text
Msg 8115, Level 16, State 2
Arithmetic overflow error converting expression to data type int.
```

The full-dataset total is ~398.9 billion shares, which far exceeds the `int` cap. Once the cumulative running sum crosses `int_max`, the aggregate engine raises 8115 and aborts the whole statement.

> [!success] Cast to bigint inside the aggregate
>
> The idiomatic fix is `SUM(CAST(col AS bigint))` — the cast happens once per row, the running total is maintained in `bigint`, and the result type is `bigint`. If the source column is already `bigint`, the cast is a no-op defensively protecting the query from any future schema change that narrows the column.

*The same query with an explicit `bigint` cast.*

```sql
SELECT SUM(CAST(volume AS bigint)) AS volume_sum_bigint
FROM silver.eurostoxx50_ohlcv;
```

| volume_sum_bigint |
|---|
| 398933707833 |

The `bigint` container (max 9.2 × 10¹⁸) holds 398 billion with 19 orders of magnitude to spare. See the `## Core SQL Server Data Type Families` section of [02-data-types-conversion-and-null-handling](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/02-data-types-conversion-and-null-handling#sum-over-int-column-can-overflow-silently) for the full type-promotion discussion.

### AVG over integer columns silently truncates

> [!warning] `AVG(int)` returns an `int` and truncates the fractional part
>
> `AVG` derives its result type from its input type the same way `SUM` does. `AVG(int)` returns `int`, so the average is computed as `SUM / COUNT` in integer arithmetic and the fractional part is discarded. This is rarely what a business caller wants — most "average" requests expect a fractional result. The fix is to cast the input column to a fractional type before averaging, or multiply by `1.0` to force type promotion.

> [!success] Force fractional averages with an explicit cast or `* 1.0`
>
> For any column whose natural average is non-integer, either cast the column inside `AVG` or multiply by a decimal literal. Both patterns are SARGable (they do not defeat indexes) and both produce a deterministic fractional result. Prefer the explicit `CAST(... AS decimal(p, s))` form when you want to pin the result precision; prefer `* 1.0` when the goal is concise and the downstream caller is tolerant of the default type promotion.

*Three `AVG` expressions on `stocks_count` (a `smallint` column) showing integer vs decimal behavior.*

```sql
SELECT
    AVG(stocks_count)                           AS avg_int_truncated,
    AVG(CAST(stocks_count AS decimal(10,4)))    AS avg_decimal,
    AVG(stocks_count * 1.0)                     AS avg_promoted
FROM gold.index_performance
WHERE _index = 'euro_stoxx_50';
```

| avg_int_truncated | avg_decimal | avg_promoted |
|---|---|---|
| 48 | 48.868499 | 48.868499 |

The `stocks_count` column on `gold.index_performance` holds the number of constituents with valid data on each perf-date — typically between 45 and 50 for the EuroStoxx 50. The true mean is roughly 48.87. The first column reports `48` because `AVG(smallint)` is computed in integer arithmetic and the fractional `.87` is silently truncated. The second column casts every input row to `decimal(10, 4)` before averaging, which forces `AVG` to return a `decimal`. The third column multiplies by `1.0` — a numeric literal — which triggers the same type promotion through the precedence rules documented in [02-data-types-conversion-and-null-handling](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/02-data-types-conversion-and-null-handling#integer-division-truncates-toward-zero).

### AVG on close prices with MIN and MAX per symbol

*Compute count, average, min, and max close price per symbol since 2025-01-01.*

```sql
SELECT TOP 5
    symbol,
    COUNT(*) AS days,
    CAST(AVG([close])      AS decimal(12,4)) AS avg_close,
    CAST(MIN([close])      AS decimal(12,4)) AS min_close,
    CAST(MAX([close])      AS decimal(12,4)) AS max_close
FROM silver.eurostoxx50_ohlcv
WHERE [date] >= '2025-01-01'
GROUP BY symbol
ORDER BY avg_close DESC;
```

| symbol | days | avg_close | min_close | max_close |
|---|---|---|---|---|
| RMS.PA | 321 | 2246.4595 | 1609.0000 | 2839.0000 |
| RHM.DE | 319 | 1538.5100 | 604.0000 | 1988.5000 |
| ADYEN.AS | 321 | 1412.9607 | 844.2000 | 1846.0000 |
| ASML.AS | 321 | 816.0452 | 550.0000 | 1288.4000 |
| ARGX.BR | 321 | 617.6991 | 460.4000 | 803.0000 |

The top five by 2025-onwards average close show wide intra-period ranges: Rheinmetall (`RHM.DE`) traded between €604 and €1,988.50, a 3.3× spread reflecting the 2025 European defence rally. The ASML range (€550 to €1,288) captures the semiconductor cycle drawdown. The `CAST(... AS decimal(12, 4))` wrapper around each float aggregate pins the display precision to four decimal places — on `float` inputs `AVG`/`MIN`/`MAX` would otherwise return the full 15-digit IEEE-754 representation, which is rarely what a business caller wants to see in a report.

### MIN and MAX on non-numeric types

`MIN` and `MAX` work on any type that has a total ordering defined, not just numerics. For `date` and `datetime2` columns, `MIN` returns the earliest value and `MAX` the latest. For `char`/`varchar`/`nchar`/`nvarchar` columns, `MIN` and `MAX` use the column collation to determine sort order — which means a case-insensitive collation can produce different "min string" results than a case-sensitive one.

*Use `MIN`/`MAX` on date and string columns in the same query.*

```sql
SELECT
    MIN([date])  AS earliest_date,
    MAX([date])  AS latest_date,
    MIN(symbol)  AS first_symbol_alpha,
    MAX(symbol)  AS last_symbol_alpha
FROM silver.eurostoxx50_ohlcv;
```

| earliest_date | latest_date | first_symbol_alpha | last_symbol_alpha |
|---|---|---|---|
| 2021-01-04 | 2026-04-07 | ABI.BR | WKL.AS |

The fact table covers trading days from 2021-01-04 to 2026-04-07, and alphabetically the 50 symbols span from `ABI.BR` (AB InBev) to `WKL.AS` (Wolters Kluwer). `MIN(date)` and `MAX(date)` are the idiomatic way to discover the coverage window of any time-series table without a separate `SELECT TOP 1 ... ORDER BY` query — they return in a single index seek on `date`, which is usually the leading column of the clustered index.

### The variance family: STDEV, STDEVP, VAR, VARP

T-SQL has four variance aggregates that are indispensable for any financial-analytics workload:

- **`STDEV(col)`** — **sample** standard deviation; divides by `(n − 1)`. Use for a sample drawn from a larger population.
- **`STDEVP(col)`** — **population** standard deviation; divides by `n`. Use when the input rows are the entire population.
- **`VAR(col)`** — sample variance; `STDEV`² semantically.
- **`VARP(col)`** — population variance; `STDEVP`² semantically.

All four return `float`. They ignore `NULL` like every other aggregate. On a sample of one row, `STDEV` and `VAR` return `NULL` (division by zero in the `n − 1` denominator); `STDEVP` and `VARP` return `0`.

#### STDEV/VAR versus STDEVP/VARP on three symbols

Use three symbols so the sample-versus-population split is easy to see.

*Compute mean, sample and population standard deviation, and both variances for three EuroStoxx symbols.*

```sql
SELECT
    symbol,
    COUNT(*)                                    AS n,
    CAST(AVG([close])      AS decimal(12,4))    AS mean_close,
    CAST(STDEV([close])    AS decimal(12,4))    AS sample_stdev,
    CAST(STDEVP([close])   AS decimal(12,4))    AS pop_stdev,
    CAST(VAR([close])      AS decimal(18,4))    AS sample_variance,
    CAST(VARP([close])     AS decimal(18,4))    AS pop_variance
FROM silver.eurostoxx50_ohlcv
WHERE symbol IN ('ASML.AS', 'MC.PA', 'SAP.DE')
  AND [date] >= '2025-01-01'
GROUP BY symbol
ORDER BY symbol;
```

| symbol | n | mean_close | sample_stdev | pop_stdev | sample_variance | pop_variance |
|---|---|---|---|---|---|---|
| ASML.AS | 321 | 816.0452 | 207.3478 | 207.0245 | 42993.0901 | 42859.1552 |
| MC.PA | 321 | 557.5456 | 79.2403 | 79.1168 | 6279.0260 | 6259.4652 |
| SAP.DE | 319 | 228.9661 | 34.2041 | 34.1505 | 1169.9223 | 1166.2548 |

Three observations:

- **Sample vs population standard deviation differ by a Bessel factor of √(n/(n−1)).** On `n = 321`, the multiplier is roughly 1.00156, so `STDEV` and `STDEVP` agree to three decimal places. On small samples (`n < 30`) the gap becomes visible and the choice matters.
- **The variance is the square of the standard deviation.** ASML: `207.3478² ≈ 42,993.09` — matches the `sample_variance` column to the fourth decimal. This is the internal consistency check that both columns use the same formula.
- **Price-level volatility is not return-level volatility.** These are standard deviations of the **raw price**, not of the daily return. ASML's ±€207 stdev reflects its multi-quarter trend; for a risk metric, compute `STDEV(daily_return)` on `gold.index_performance` or on a constituent-level return column instead.

The choice between `STDEV` and `STDEVP` depends on whether the input is treated as a sample (any finite window of historical observations drawn from an infinite stochastic process — the usual case for finance) or as a complete population (e.g., every possible outcome in a closed combinatorial space). For financial return series, `STDEV` is the standard choice because the realized series is one sample drawn from an unknown return-generating process.

### Float aggregation is order-sensitive

> [!warning] `SUM(float)` can return slightly different values across runs
>
> IEEE-754 `float` addition is not associative — `(a + b) + c` can differ from `a + (b + c)` in the last few bits. When SQL Server executes a parallel `SUM` plan, the order in which row groups are combined is not deterministic, so the exact last-bit representation of the sum can vary from one execution to the next. For dashboards and reports this is invisible; for reconciliation to external systems that compare bit-for-bit equality, it is catastrophic.

> [!success] Cast float to decimal before aggregating when determinism matters
>
> For any aggregate whose result must be reproducible, reconciled, or compared against an external system, cast the input to a `decimal(p, s)` with enough precision and scale to capture the source range. `decimal` arithmetic is exact and order-independent, so two executions of the same query always return the same bits. See the `### Approximate numeric types: real and float` subsection of [02-data-types-conversion-and-null-handling](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/02-data-types-conversion-and-null-handling#the-ieee-754-approximation-trap) for the full float-vs-decimal discussion.

*Compare a naïve `SUM(float)` with a `SUM` that first casts each row to `decimal(18, 10)`.*

```sql
SELECT
    SUM(daily_return)                               AS naive_sum,
    SUM(CAST(daily_return AS decimal(18,10)))       AS decimal_sum
FROM gold.index_performance
WHERE _index = 'euro_stoxx_50';
```

| naive_sum | decimal_sum |
|---|---|
| 0.773228215606107 | 0.7732282148 |

Both numbers represent the same underlying quantity — the naïve sum of 1,346 daily-return values for the euro_stoxx_50 index — but they are not bit-equal. The `float` version shows the full IEEE-754 double-precision representation (`0.773228215606107`), while the `decimal(18, 10)` version shows the deterministic fixed-point result (`0.7732282148`) with the final digits diverging at the 9th-decimal. On a single-threaded plan the `float` version is reproducible; on a parallel plan the last-bit ordering depends on how row groups are combined, and the sum can flicker across runs.

## Conditional Aggregation with CASE

`SUM(CASE WHEN ...)` and `COUNT(CASE WHEN ...)` are the single most important analytical pattern in T-SQL. They express "aggregate this column, but only for rows matching a condition" in one pass, without a self-join, without a correlated subquery, and without `PIVOT`. Most "report one column per year" and "count up-days vs down-days" requirements collapse to a conditional-aggregation query over a grouped source. This section documents the three canonical forms and contrasts them with the alternatives.

### SUM(CASE WHEN ...) — the filtered sum

The pattern is simple: `SUM(CASE WHEN predicate THEN value ELSE 0 END)`. Rows where the predicate is false contribute zero to the sum, so they effectively disappear from that aggregate column. The trick is that the same query can produce multiple filtered sums in parallel — one per `CASE` expression — all sharing the same `FROM` scan and `GROUP BY` step. This is more efficient than running one aggregate per year with separate queries and joining the results back together.

#### Volume per year per symbol via conditional aggregation

This grouped scan shows how one `CASE` per year replaces separate queries.

*One-pass volume per year for three EuroStoxx symbols, using `SUM(CASE WHEN YEAR(...) = ...)`.*

```sql
SELECT
    symbol,
    SUM(CASE WHEN YEAR([date]) = 2023 THEN volume ELSE 0 END) AS vol_2023,
    SUM(CASE WHEN YEAR([date]) = 2024 THEN volume ELSE 0 END) AS vol_2024,
    SUM(CASE WHEN YEAR([date]) = 2025 THEN volume ELSE 0 END) AS vol_2025
FROM silver.eurostoxx50_ohlcv
WHERE symbol IN ('ASML.AS', 'MC.PA', 'SAP.DE')
GROUP BY symbol
ORDER BY symbol;
```

| symbol | vol_2023 | vol_2024 | vol_2025 |
|---|---|---|---|
| ASML.AS | 155181095 | 157018303 | 182666418 |
| MC.PA | 92510388 | 97854292 | 132755882 |
| SAP.DE | 437544044 | 379948374 | 376074365 |

Three symbols, three year-columns, one pass over the fact table. ASML's annual volume grew from ~155M in 2023 to ~182M in 2025 (roughly +18%), reflecting the 2024–2025 semiconductor cycle. SAP's volume declined from ~437M to ~376M as the European software sector rotated out of favour. The same output shape is expressible with `PIVOT`, but the conditional-aggregation form scales better — adding a new column only requires adding one more `SUM(CASE ...)` expression, whereas `PIVOT` requires editing the hard-coded `IN` list inside the operator syntax. See the `### PIVOT` subsection of [03-joins-subqueries-and-apply](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/03-joins-subqueries-and-apply#pivot) for the direct comparison.

### COUNT(CASE WHEN ...) vs SUM(CASE WHEN ... THEN 1 ELSE 0 END)

There are three equivalent ways to count rows matching a predicate inside an aggregate query. They all return the same number, but they differ in readability and in how NULLs interact with the pattern:

- **`COUNT(CASE WHEN predicate THEN 1 END)`** — relies on `COUNT(column)` ignoring `NULL`; the `ELSE` branch is implicit `NULL`, which is skipped by `COUNT`.
- **`COUNT(NULLIF(expr, 0))`** — converts the "zero" case to `NULL` and relies on the same `COUNT` null-skipping behavior.
- **`SUM(CASE WHEN predicate THEN 1 ELSE 0 END)`** — the explicit form: every row contributes 0 or 1 to the sum.

All three are legitimate; the `COUNT(CASE ... THEN 1 END)` form is the most idiomatic and the most readable.

#### The three equivalent counting patterns side by side

This comparison puts three counting idioms on the same filtered input.

*Count "up days" (close > open) for ASML since 2025 using all three forms.*

```sql
SELECT
    COUNT(CASE WHEN [close] > [open] THEN 1 END)   AS up_days_case,
    COUNT(NULLIF(CAST(CASE WHEN [close] > [open] THEN 1 ELSE 0 END AS int), 0)) AS up_days_nullif,
    COUNT(*)                                       AS total_days,
    SUM(CASE WHEN [close] > [open] THEN 1 ELSE 0 END) AS up_days_sum
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'ASML.AS'
  AND [date] >= '2025-01-01';
```

| up_days_case | up_days_nullif | total_days | up_days_sum |
|---|---|---|---|
| 173 | 173 | 321 | 173 |

All three counting forms return the same value: 173 up-days out of 321 total trading days (about 53.9%) for ASML since the start of 2025. The `COUNT(CASE ... THEN 1 END)` form is shortest and most readable — when the `ELSE` branch is omitted, `CASE` returns implicit `NULL` on false rows, and `COUNT` ignores `NULL`, so the two mechanics compose naturally. The `SUM(CASE ... THEN 1 ELSE 0 END)` form is slightly more verbose but more explicit about the contribution of each row. The `NULLIF` form is rarely used for this purpose — it adds noise without readability gain.

### Conditional AVG — filtered averages

The same `CASE` pattern applied to `AVG` produces a filtered average. Because `AVG` ignores `NULL`, the pattern works even without an `ELSE` branch: rows failing the predicate contribute implicit `NULL`, which `AVG` discards from both the numerator and the denominator. The result is the mean of the subset where the predicate is true — not a zero-padded mean over all rows.

*Compute the average up-move and down-move size for three symbols since 2025.*

```sql
SELECT
    symbol,
    CAST(AVG(CASE WHEN [close] > [open] THEN [close] - [open] END) AS decimal(12,4)) AS avg_up_move,
    CAST(AVG(CASE WHEN [close] < [open] THEN [open] - [close] END) AS decimal(12,4)) AS avg_down_move
FROM silver.eurostoxx50_ohlcv
WHERE symbol IN ('ASML.AS', 'MC.PA', 'SAP.DE')
  AND [date] >= '2025-01-01'
GROUP BY symbol
ORDER BY symbol;
```

| symbol | avg_up_move | avg_down_move |
|---|---|---|
| ASML.AS | 12.4046 | 12.0068 |
| MC.PA | 6.4969 | 6.4486 |
| SAP.DE | 2.3685 | 3.0382 |

Three symbols, two filtered averages each. ASML up-moves average €12.40 and down-moves €12.01 — roughly symmetric around zero, which is expected for a liquid equity in a normal market regime. SAP shows slight asymmetry (€2.37 up vs €3.04 down), suggesting a modestly higher average daily-loss magnitude than average daily-gain over the window. Note that the `ELSE` branch is omitted in both expressions — false rows produce `NULL` and are excluded from the `AVG` by the usual aggregate null-skipping rule. Writing `ELSE 0` here would be wrong: it would pad the denominator with "no-move" rows and pull the average toward zero.

> [!tip] Omit the ELSE branch when computing filtered AVG
>
> For filtered `AVG`, the implicit `NULL` from a missing `ELSE` is the correct behavior — it excludes the row from both numerator and denominator. For filtered `SUM` and `COUNT`, the explicit `ELSE 0` / `ELSE 1` / omitted-ELSE distinction matters depending on whether you want zero-padding or null-skipping semantics. Always think about whether non-matching rows should participate in the denominator before choosing the form.

## Ratios, Percentages, and Divide-by-Zero Safety

Division in T-SQL has two separate traps: integer arithmetic silently truncates fractional results, and division by zero aborts the statement with error 8134. Any query that computes a ratio or percentage must guard against both. This section establishes the `NULLIF` safe-division pattern, the decimal-literal promotion trick, and the window-aggregate percent-of-total form.

### Division by zero raises error 8134

> [!failure] `... / 0` aborts the statement with error 8134
>
> T-SQL raises error 8134 "Divide by zero error encountered" whenever the denominator of a `/` expression evaluates to zero. The error is raised at runtime, not parse time, so a query that worked for months can suddenly abort the first time the denominator legitimately becomes zero (e.g., after a data-quality change or a new business condition).

Between January and June 2025, ASML had exactly 52 up-days in the filtered window, so `52 − 52 = 0` and the query fails with error 8134 at runtime.

*Force a divide-by-zero error by computing a ratio whose denominator evaluates to zero.*

```sql
SELECT
    symbol,
    SUM(volume) / (SUM(CASE WHEN [close] > [open] THEN 1 ELSE 0 END) - 52) AS ratio
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'ASML.AS'
  AND [date] BETWEEN '2025-01-01' AND '2025-06-01'
GROUP BY symbol;
```

```text
Msg 8134, Level 16, State 1
Divide by zero error encountered.
```

> [!success] Wrap the denominator in `NULLIF(..., 0)`
>
> `NULLIF(expr, val)` returns `NULL` when `expr = val`, and the original `expr` otherwise. Wrapping the denominator in `NULLIF(..., 0)` converts the zero case to `NULL`, which makes the entire division `NULL` (because `anything / NULL = NULL`). The query returns a `NULL` row instead of aborting, and downstream code can use `COALESCE` or `ISNULL` to decide how to display the result.

*Same query with the denominator protected by `NULLIF`.*

```sql
SELECT
    symbol,
    SUM(volume) AS total_volume,
    SUM(CASE WHEN [close] > [open] THEN 1 ELSE 0 END) AS up_days,
    SUM(volume) / NULLIF(SUM(CASE WHEN [close] > [open] THEN 1 ELSE 0 END), 0) AS volume_per_up_day
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'ASML.AS'
  AND [date] BETWEEN '2025-01-01' AND '2025-06-01'
GROUP BY symbol;
```

| symbol | total_volume | up_days | volume_per_up_day |
|---|---|---|---|
| ASML.AS | 87563673 | 52 | 1683916 |

ASML traded ~87.5M shares across the Jan–Jun 2025 window with 52 up-days, averaging ~1.68M shares per up-day. If a future window happened to contain zero up-days — unusual but possible for a small window in a strong bear market — the `NULLIF` guard would return `NULL` instead of aborting the query. See the `### NULLIF` subsection of [02-data-types-conversion-and-null-handling](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/02-data-types-conversion-and-null-handling#nullif) for the full treatment.

### Integer ratio truncation and decimal-literal promotion

> [!warning] Ratios between integer columns truncate to integer
>
> When both operands of `/` are integer types, T-SQL performs integer division and silently truncates the fractional part toward zero. `5 / 2 = 2`, not `2.5`. The most common place this bites is percentage calculations: `100 * 3 / 8` returns `37`, not `37.5`, because the intermediate `100 * 3 = 300` is still `int`, so `300 / 8` is integer division. The fix is to include at least one decimal literal or explicit cast to force type promotion.

> [!success] Use `100.0 * num / NULLIF(denom, 0)` as the canonical percentage expression
>
> The three-part pattern `decimal_literal * numerator / NULLIF(denominator, 0)` solves both traps in one expression. The leading decimal literal forces fractional arithmetic, the `NULLIF` guards against divide-by-zero, and the result type is `decimal` — exact, deterministic, and safe for downstream consumers. Prefer this form for every percentage computation in production code.

*Six ratio expressions showing integer truncation and the decimal-literal fix.*

```sql
SELECT
    5 / 2                               AS int_ratio,
    5.0 / 2                             AS decimal_literal,
    100 * 3 / 8                         AS percent_int,
    100.0 * 3 / 8                       AS percent_decimal,
    100 * 3 / NULLIF(8, 0)              AS nullif_int,
    100.0 * 3 / NULLIF(8, 0)            AS nullif_decimal;
```

| int_ratio | decimal_literal | percent_int | percent_decimal | nullif_int | nullif_decimal |
|---|---|---|---|---|---|
| 2 | 2.500000 | 37 | 37.500000 | 37 | 37.500000 |

Six columns, four different numerical types in the results:

- **`int_ratio = 2`** — pure integer division; `5/2 = 2.5` truncated to `2`.
- **`decimal_literal = 2.500000`** — the `5.0` literal promotes the expression to `decimal` and the correct fractional result is preserved. The trailing zeros reflect the default `decimal` scale.
- **`percent_int = 37`** — `100 * 3 / 8` is still pure integer arithmetic; `300/8 = 37.5` truncates to `37`. Off by half — a hidden 1.3% error on a percentage report.
- **`percent_decimal = 37.500000`** — one decimal literal (`100.0`) promotes the whole expression.
- **`nullif_int = 37`** — `NULLIF` does not help with truncation; it only protects against zero. Integer division still truncates.
- **`nullif_decimal = 37.500000`** — combining both patterns gives the correct, zero-safe result. This is the idiomatic form.

### Percent of total with window aggregation

The "percent of total" pattern needs two aggregates in the same result row: the per-group aggregate and the total across all groups. The cleanest expression uses a window aggregate inside the `SELECT` list — `SUM(SUM(volume)) OVER ()` computes the sum across all groups after grouping has been applied, without a second query or a self-join.

*Top 5 EuroStoxx symbols by 2025-onwards volume, with each symbol's share of the universe total.*

```sql
SELECT TOP 5
    symbol,
    SUM(volume) AS symbol_volume,
    SUM(SUM(volume)) OVER ()                                             AS total_volume,
    CAST(100.0 * SUM(volume) / NULLIF(SUM(SUM(volume)) OVER (), 0) AS decimal(8,4)) AS pct_of_total
FROM silver.eurostoxx50_ohlcv
WHERE [date] >= '2025-01-01'
GROUP BY symbol
ORDER BY symbol_volume DESC;
```

| symbol | symbol_volume | total_volume | pct_of_total |
|---|---|---|---|
| ISP.MI | 18936223275 | 74214451604 | 25.5155 |
| SAN.MC | 9682784201 | 74214451604 | 13.0470 |
| ENEL.MI | 7718764002 | 74214451604 | 10.4006 |
| ENI.MI | 3761895752 | 74214451604 | 5.0690 |
| BBVA.MC | 3457520224 | 74214451604 | 4.6588 |

The top five EuroStoxx 50 names by 2025-onwards volume are dominated by Italian and Spanish financials and utilities: Intesa Sanpaolo (`ISP.MI`) alone represents ~25.5% of the entire 50-constituent index volume, Santander (`SAN.MC`) another ~13%, and the top five combined account for roughly 58.7% of the total. This extreme concentration is characteristic of European equity indices where a handful of liquid mega-caps dominate the daily tape. The query achieves the percent-of-total in a single pass: `SUM(volume)` computes the per-symbol sum, `SUM(SUM(volume)) OVER ()` computes the grand total across all groups after grouping, and the outer `100.0 * ... / NULLIF(..., 0)` expression combines the safe-division pattern with the decimal-literal promotion.

For the full window-function treatment — including `PARTITION BY`, `ORDER BY`, and the `ROWS`/`RANGE` framing clauses — see the [05-window-functions](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/05-window-functions) sibling note.

## Scalar Math Functions

T-SQL includes a complete catalog of scalar math functions: sign and absolute value, rounding in three flavours, power and root, logarithm and exponential, the full trigonometric family, and two distinct random-number generators. This section documents each one with its type-promotion behavior, the traps that catch unwary callers, and the business contexts where each is typically used in data-engineering work.

### ABS and SIGN

`ABS(x)` returns the absolute value of `x`. `SIGN(x)` returns `-1` if `x < 0`, `0` if `x = 0`, and `+1` if `x > 0`. Both preserve the input type: `ABS(int)` returns `int`, `ABS(decimal(p, s))` returns `decimal(p, s)`, `ABS(float)` returns `float`. `SIGN` always returns the same type as its input — on `int` the result is one of `{-1, 0, 1}` as an `int`; on `float` it is `{-1.0, 0, 1.0}` as a `float`.

*Apply `ABS` and `SIGN` to positive, negative, and zero inputs.*

```sql
SELECT
    ABS(-12.5)  AS absolute_value,
    ABS(12.5)   AS already_positive,
    SIGN(-12.5) AS sign_negative,
    SIGN(0)     AS sign_zero,
    SIGN(42.0)  AS sign_positive;
```

| absolute_value | already_positive | sign_negative | sign_zero | sign_positive |
|---|---|---|---|---|
| 12.5 | 12.5 | -1.0 | 0 | 1.0 |

Both negative and positive inputs to `ABS` return the positive magnitude; `SIGN` returns the three-valued indicator. Note that `SIGN(0)` is `0` — it is neither positive nor negative. The most common analytical use of `SIGN` is to bucket rows by direction ("how many days went up, down, or were flat?") without the verbosity of a `CASE` expression — `SUM(SIGN(close - open))` returns a signed count in one pass.

### CEILING, FLOOR, and ROUND

`CEILING(x)` returns the smallest integer greater than or equal to `x`. `FLOOR(x)` returns the largest integer less than or equal to `x`. Both preserve the input type: `CEILING(decimal)` returns `decimal`, not `int`, with the fractional part forced to `.00...`. `ROUND(x, n)` rounds to `n` decimal places using the "round half away from zero" rule — the default mode in T-SQL.

A subtle detail that catches many readers: `FLOOR(-12.34) = -13`, not `-12`. "Floor" means "toward negative infinity," which for negative numbers is **further from zero**, not closer. `CEILING(-12.34) = -12` because ceiling goes toward positive infinity. `ROUND(-12.3456, 2) = -12.35` because "half away from zero" rounds the negative `.3456` away from zero (more negative).

*Apply `CEILING`, `FLOOR`, and `ROUND` to positive and negative inputs.*

```sql
SELECT
    CEILING(12.34)     AS ceil_pos,
    CEILING(-12.34)    AS ceil_neg,
    FLOOR(12.34)       AS floor_pos,
    FLOOR(-12.34)      AS floor_neg,
    ROUND(12.3456, 2)  AS round_half_away,
    ROUND(-12.3456, 2) AS round_neg_half_away;
```

| ceil_pos | ceil_neg | floor_pos | floor_neg | round_half_away | round_neg_half_away |
|---|---|---|---|---|---|
| 13 | -12 | 12 | -13 | 12.3500 | -12.3500 |

Six values, four distinct rounding directions. The key insight is that `CEILING` and `FLOOR` are directional relative to the number line, not the magnitude: `CEILING` always moves toward `+∞`, `FLOOR` always moves toward `−∞`. For bucket-boundary computations (e.g., "the start of the current minute" or "the upper bound of the current page"), be explicit about whether you want `FLOOR`/`CEILING` or the symmetric `ROUND`/truncation.

### ROUND's three-argument form: truncation mode

> [!info] `ROUND(value, length, function)` has a third argument that controls rounding vs truncation
>
> The Microsoft [ROUND reference](https://learn.microsoft.com/en-us/sql/t-sql/functions/round-transact-sql) documents a third argument called `function`:
>
> - **`0`** (default) — round to the specified length using the "half away from zero" rule. Omitting the argument is equivalent to passing `0`.
> - **`1`** — truncate to the specified length; the fractional digits beyond `length` are dropped, not rounded.
>
> Any nonzero value in the third argument activates truncation mode. The function name of "ROUND" is misleading when truncation mode is used — the operation is really a fixed-point truncation.

*Apply `ROUND` in default and truncation mode to two input values.*

```sql
SELECT
    ROUND(12.3456, 2)    AS round_default,
    ROUND(12.3456, 2, 0) AS round_mode_0,
    ROUND(12.3456, 2, 1) AS truncate_mode_1,
    ROUND(12.9999, 2, 0) AS round_9999_default,
    ROUND(12.9999, 2, 1) AS truncate_9999;
```

| round_default | round_mode_0 | truncate_mode_1 | round_9999_default | truncate_9999 |
|---|---|---|---|---|
| 12.3500 | 12.3500 | 12.3400 | 13.0000 | 12.9900 |

Two key contrasts:

- **`12.3456` → `12.35` vs `12.34`.** In default mode, the `56` in position 3–4 triggers rounding of the `.34` up to `.35`. In truncation mode, everything beyond position 2 is simply discarded, leaving `.34` unchanged.
- **`12.9999` → `13.00` vs `12.99`.** In default mode, the rounding cascades: the `99` in positions 3–4 rounds `.99` up to `1.00`, which propagates into the integer part, producing `13.00`. In truncation mode, the fractional tail is discarded and `12.99` is returned directly.

Use truncation mode (`function = 1`) when you need deterministic down-rounding — for example, when allocating shares to clients in a fund (fractional shares must be dropped, not rounded up) or when computing display values that must never exceed the true value. Use default mode (`function = 0`) when the business rule is "round to the nearest" with symmetric away-from-zero handling.

> [!info] SQL Server rounds half away from zero
>
> Many other systems (Python's `round()`, IEEE-754, and some financial-calculation libraries) default to "banker's rounding" — round half to even. T-SQL's `ROUND` uses "half away from zero" by default. `ROUND(0.5, 0) = 1` in T-SQL, but `round(0.5) = 0` in Python 3 (banker's rounding rounds to the nearest even integer on exact halves). If a downstream consumer expects banker's rounding, compute it explicitly with a `CASE` expression or apply the transformation in the application layer instead of relying on `ROUND`.

### POWER, SQUARE, and SQRT

`POWER(base, exponent)` returns `base^exponent`. `SQUARE(x)` is a convenience for `POWER(x, 2)`. `SQRT(x)` returns the non-negative square root; `SQRT` of a negative number raises error 3623 "An invalid floating point operation occurred", so guard negative inputs with `ABS` or a `CASE` expression.

The return type of `POWER` follows its first argument. This has a subtle consequence: `POWER(10.0, -2.0)` returns a `numeric(3, 1)` because `10.0` parses as `numeric(3, 1)` — and `numeric(3, 1)` cannot represent `0.01`, so the result is silently truncated to `0.0`. To get the full fractional answer, cast the base to `float` or to a wider decimal before calling `POWER`.

*Apply `POWER`, `SQUARE`, and `SQRT` to representative inputs.*

```sql
SELECT
    POWER(2.0, 10.0)  AS two_to_the_tenth,
    POWER(10.0, -2.0) AS ten_to_the_minus_two,
    SQUARE(7.0)       AS seven_squared,
    SQRT(144.0)       AS sqrt_144,
    SQRT(2.0)         AS sqrt_2;
```

| two_to_the_tenth | ten_to_the_minus_two | seven_squared | sqrt_144 | sqrt_2 |
|---|---|---|---|---|
| 1024.0 | 0.0 | 49.0 | 12.0 | 1.4142135623730951 |

Four expected results and one trap. `POWER(2.0, 10.0) = 1024` is correct. `SQUARE(7.0) = 49` is correct. `SQRT(144.0) = 12` is exact; `SQRT(2.0)` returns the full IEEE-754 double-precision approximation `1.4142135623730951`. The trap is `POWER(10.0, -2.0) = 0.0` — the mathematically correct answer is `0.01`, but `POWER` returns a `numeric` with the same precision and scale as its first argument, and `numeric(3, 1)` has only one decimal of scale, so `0.01` is truncated to `0.0`. Any analytical use of `POWER` with fractional results should cast the base to `float` first: `POWER(CAST(10 AS float), -2)` returns `0.01`.

### LOG, LOG10, and EXP

`LOG(x)` returns the **natural** logarithm (base `e`). `LOG(x, base)` returns the logarithm with an explicit base (SQL Server 2012+). `LOG10(x)` returns the base-10 logarithm. `EXP(x)` returns `e^x`. All four return `float` and use IEEE-754 arithmetic, which introduces the usual last-bit rounding noise on non-exact values.

*Apply the log/exp family to representative inputs.*

```sql
SELECT
    LOG(EXP(1.0))        AS log_e_of_e,
    LOG(100.0)           AS natural_log_100,
    LOG10(1000.0)        AS log10_1000,
    LOG(1000.0, 10.0)    AS log_base_10,
    EXP(1.0)             AS euler_number,
    EXP(0.05)            AS five_pct_growth_factor;
```

| log_e_of_e | natural_log_100 | log10_1000 | log_base_10 | euler_number | five_pct_growth_factor |
|---|---|---|---|---|---|
| 1.0 | 4.605170185988092 | 3.0 | 2.9999999999999996 | 2.718281828459045 | 1.0512710963760241 |

Six columns, two interesting observations:

- **`LOG10(1000) = 3.0` exactly, but `LOG(1000, 10) = 2.9999999999999996`.** Both call the same mathematical function but use different internal implementations — `LOG10` is hard-wired to the base-10 library routine, while `LOG(x, base)` is implemented as `LN(x) / LN(base)`, which introduces a last-bit rounding error. The difference is invisible for most use cases but surfaces the moment a downstream consumer does a bit-exact equality check. Prefer `LOG10(x)` over `LOG(x, 10)` whenever the base is 10.
- **`EXP(0.05) ≈ 1.0513`** — the continuous-compounding growth factor for a 5% rate. This is the canonical use of `EXP` in finance: converting continuously compounded log-returns into simple returns via `simple_return = EXP(log_return) - 1`. `LOG` in the opposite direction: `log_return = LOG(1 + simple_return)`.

### Trigonometric family

T-SQL includes the full trigonometric catalog: `SIN`, `COS`, `TAN`, their inverses `ASIN`, `ACOS`, `ATAN`, the two-argument `ATN2` (equivalent to `atan2` in most other languages — **note the name**: SQL Server uses `ATN2`, not `ATAN2`), and the angle-conversion helpers `DEGREES` and `RADIANS`. All trigonometric functions expect their inputs in **radians**, not degrees. `PI()` returns the constant `3.14159...` as a `float`.

> [!info] Trigonometric functions use radians
>
> Calling `SIN(30)` does **not** return `sin(30°) = 0.5`. It returns `sin(30 radians) ≈ -0.988`, because 30 radians is roughly 1,718 degrees. Always wrap degree inputs in `RADIANS(...)` before passing them to `SIN`/`COS`/`TAN`. Conversely, wrap radian outputs of inverse functions in `DEGREES(...)` when you need degree values.

*Apply the trigonometric family with explicit degree-to-radian conversions.*

```sql
SELECT
    PI()                       AS pi_value,
    DEGREES(PI())              AS pi_in_degrees,
    RADIANS(180.0)             AS pi_from_degrees,
    SIN(RADIANS(30.0))         AS sin_30,
    COS(RADIANS(60.0))         AS cos_60,
    TAN(RADIANS(45.0))         AS tan_45,
    ATN2(1.0, 1.0)             AS atn2_1_1,
    DEGREES(ATN2(1.0, 1.0))    AS atn2_in_degrees;
```

| pi_value | pi_in_degrees | pi_from_degrees | sin_30 | cos_60 | tan_45 | atn2_1_1 | atn2_in_degrees |
|---|---|---|---|---|---|---|---|
| 3.141592653589793 | 180.0 | 3.141592653589793116 | 0.49999999999999994 | 0.5000000000000001 | 0.9999999999999999 | 0.7853981633974483 | 45.0 |

Eight columns illustrating the full round-trip. `PI() = 3.14159...` is the standard double-precision representation of π. `DEGREES(PI()) = 180` exactly, and `RADIANS(180) = 3.14159...` back again — the conversions are inverses. `SIN(RADIANS(30))` returns `0.49999999999999994` instead of exactly `0.5` because the IEEE-754 representation of `π/6` is not exact, so neither is its sine. Similarly `COS(RADIANS(60)) ≈ 0.5` and `TAN(RADIANS(45)) ≈ 1.0` with last-bit rounding noise. `ATN2(1, 1)` returns `π/4` in radians (`0.7854`), which `DEGREES` converts back to exactly `45°`.

Practical uses of trigonometry in data-engineering work are relatively rare in fintech but common in geospatial computations: the haversine distance formula uses `SIN`, `COS`, and `ATN2` to compute great-circle distances between latitude/longitude pairs. See the `geography` data type discussion in the data-types sibling note for native SQL Server support that is usually more appropriate than hand-coded trigonometry.

### RAND and CRYPT_GEN_RANDOM

SQL Server has two random-number generators with very different semantics:

- **`RAND([seed])`** — a pseudorandom `float` in `[0, 1)`. Without a seed, `RAND()` uses the session's hidden state, which makes it **constant within a single query** (!) — calling `RAND()` twice in the same `SELECT` produces the same value on both call sites. With a seed argument, `RAND(seed)` always returns the same value for the same seed. This makes `RAND` useless for generating one-random-value-per-row — every row in the result receives the same number.
- **`CRYPT_GEN_RANDOM(length)`** — a cryptographically strong random `varbinary(length)`. It produces a genuinely different value on every call, including across rows in a single query. To use it as a random integer, cast the `varbinary` result: `CAST(CRYPT_GEN_RANDOM(4) AS int)` produces a 32-bit signed random integer.

*Demonstrate the session-scoped determinism of `RAND` and the per-call randomness of `CRYPT_GEN_RANDOM`.*

```sql
SELECT
    RAND(42)            AS rand_seeded,
    RAND(42)            AS rand_seeded_same_row,
    RAND()              AS rand_session,
    CAST(CRYPT_GEN_RANDOM(4) AS int) AS crypto_random_int;
```

| rand_seeded | rand_seeded_same_row | rand_session | crypto_random_int |
|---|---|---|---|
| 0.7143559450345097 | 0.7143559450345097 | 0.041009986028273604 | -1350904742 |

Four columns, three different behaviors. The two `RAND(42)` calls return identical values (`0.7143...`) because they share the same seed. The `RAND()` call returns a session-dependent value (`0.04101...`) that will be the same for every row if this query were run over a multi-row source. `CRYPT_GEN_RANDOM(4)` produces a fresh 4-byte value cast to `int` (`-1350904742`) — repeating the query produces a different number each time, and applying it inside a row-producing query would give a different value per row.

> [!success] Use `CRYPT_GEN_RANDOM` when you need per-row randomness
>
> For sampling, stratification, random-order sorting, or any use case where each row must receive an independent random value, use `CRYPT_GEN_RANDOM`. The classic pattern is `ORDER BY CAST(CRYPT_GEN_RANDOM(4) AS int)` for a random-order sample, or `WHERE ABS(CAST(CRYPT_GEN_RANDOM(4) AS int)) % 100 < 10` for a deterministic-probability 10% sample. Reserve `RAND(seed)` for repeatable lab demos where the same seed must always produce the same result.

## Multi-Level Grouping: ROLLUP, CUBE, and GROUPING SETS

A single `GROUP BY` clause produces one grouping level. Reports often require multiple levels in the same result: per-sector subtotals, per-country subtotals, and a grand total — all aligned into one rowset. T-SQL supports three extensions to `GROUP BY` that compute multiple grouping levels in a single query:

- **`ROLLUP(a, b, c)`** — hierarchical subtotals. Produces groups for `(a, b, c)`, `(a, b)`, `(a)`, and `()`.
- **`CUBE(a, b, c)`** — all possible combinations. Produces 2³ = 8 groups: `(a, b, c)`, `(a, b)`, `(a, c)`, `(b, c)`, `(a)`, `(b)`, `(c)`, `()`.
- **`GROUPING SETS((a, b), (c), ())`** — an explicit, author-specified list of grouping combinations. The most flexible of the three.

All three are syntactic sugar for running the same aggregate multiple times with different `GROUP BY` clauses and stacking the results with `UNION ALL` — but the query optimizer can often execute the multi-grouping form in a single pass over the input, which is much faster than the `UNION ALL` alternative on large tables.

The subtotal rows are marked by `NULL` in every column that was rolled up, which creates an ambiguity: a `NULL` in the output can mean either "this column was intentionally rolled up for a subtotal" or "this row had a real `NULL` value in the source column". The `GROUPING()` and `GROUPING_ID()` helper functions disambiguate the two cases.

### ROLLUP — hierarchical subtotals

`ROLLUP(d.sector, d.country)` produces three levels of grouping:

1. One row per `(sector, country)` pair — the detail level.
2. One row per `(sector)` with `country = NULL` — the sector subtotal.
3. One row with `sector = NULL` and `country = NULL` — the grand total.

The order of the columns inside `ROLLUP` matters: `ROLLUP(sector, country)` produces sector subtotals, while `ROLLUP(country, sector)` produces country subtotals. The "rollup" is always from right to left, collapsing the rightmost column first.

*Count current EuroStoxx 50 constituents by sector and country with hierarchical subtotals.*

```sql
SELECT
    d.sector,
    d.country,
    COUNT(*) AS constituents
FROM silver.index_dim AS d
WHERE d.is_current = 1
  AND d._index = 'euro_stoxx_50'
  AND d.sector IN ('Technology', 'Financial Services')
GROUP BY ROLLUP(d.sector, d.country)
ORDER BY
    GROUPING(d.sector),
    d.sector,
    GROUPING(d.country),
    d.country;
```

| sector | country | constituents |
|---|---|---|
| Financial Services | Finland | 1 |
| Financial Services | France | 2 |
| Financial Services | Germany | 3 |
| Financial Services | Italy | 2 |
| Financial Services | Netherlands | 1 |
| Financial Services | Spain | 2 |
| Financial Services | NULL | 11 |
| Technology | France | 1 |
| Technology | Germany | 2 |
| Technology | Netherlands | 2 |
| Technology | NULL | 5 |
| NULL | NULL | 16 |

Twelve rows broken into three groups:

- **Rows 1–6 and 8–10** are the detail level — one row per `(sector, country)` pair.
- **Rows 7 and 11** are the sector subtotals — `country = NULL` with a summed count (`11` Financial Services, `5` Technology).
- **Row 12** is the grand total — both columns `NULL`, count `16` = `11 + 5`.

The `ORDER BY` clause uses `GROUPING(...)` to push the subtotal and grand-total rows **after** their detail rows: `GROUPING(col)` returns `1` if the column was rolled up on that row and `0` otherwise, so ordering by `GROUPING(sector), sector, GROUPING(country), country` guarantees that detail rows come first, then sector subtotals, then the grand total. Without this explicit ordering, the subtotal rows would interleave with the detail rows and the report would be unreadable.

### CUBE — all combinations

`CUBE(d.sector, d.country)` produces every possible grouping combination: sector-only, country-only, `(sector, country)` pairs, and the grand total. On two columns that means `2² = 4` grouping levels. On three columns it would be `2³ = 8`. The result set is always a superset of `ROLLUP` — it includes the `ROLLUP` rows plus the "other direction" subtotals.

*Same data, but with `CUBE` instead of `ROLLUP` to add country subtotals.*

```sql
SELECT
    d.sector,
    d.country,
    COUNT(*) AS constituents
FROM silver.index_dim AS d
WHERE d.is_current = 1
  AND d._index = 'euro_stoxx_50'
  AND d.sector IN ('Technology', 'Financial Services')
GROUP BY CUBE(d.sector, d.country)
ORDER BY
    GROUPING(d.sector),
    d.sector,
    GROUPING(d.country),
    d.country;
```

| sector | country | constituents |
|---|---|---|
| Financial Services | Finland | 1 |
| Financial Services | France | 2 |
| Financial Services | Germany | 3 |
| Financial Services | Italy | 2 |
| Financial Services | Netherlands | 1 |
| Financial Services | Spain | 2 |
| Financial Services | NULL | 11 |
| Technology | France | 1 |
| Technology | Germany | 2 |
| Technology | Netherlands | 2 |
| Technology | NULL | 5 |
| NULL | Finland | 1 |
| NULL | France | 3 |
| NULL | Germany | 5 |
| NULL | Italy | 2 |
| NULL | Netherlands | 3 |
| NULL | Spain | 2 |
| NULL | NULL | 16 |

Eighteen rows instead of `ROLLUP`'s twelve — `CUBE` adds the six country subtotals (rows 12–17) that `ROLLUP(sector, country)` would not produce. Finland has 1 financial services constituent (no tech), France has 3 total (2 financial + 1 tech), Germany has 5 (3 financial + 2 tech), and so on. The grand total (row 18) is still `16` constituents across both sectors. Use `CUBE` when the report consumer needs to slice the same data by either dimension independently; use `ROLLUP` when only the hierarchical rollup direction matters.

### GROUPING SETS — explicit grouping combinations

`GROUPING SETS` gives full control over which grouping levels are computed, without the combinatorial explosion of `CUBE` or the right-to-left ordering constraint of `ROLLUP`. The author lists each grouping level explicitly as a tuple; the result set is exactly the union of those levels.

*Compute sector totals, country totals, and grand total only — skipping the detail-level `(sector, country)` rows.*

```sql
SELECT
    d.sector,
    d.country,
    COUNT(*) AS constituents
FROM silver.index_dim AS d
WHERE d.is_current = 1
  AND d._index = 'euro_stoxx_50'
  AND d.sector IN ('Technology', 'Financial Services')
GROUP BY GROUPING SETS ((d.sector), (d.country), ())
ORDER BY
    GROUPING(d.sector),
    d.sector,
    GROUPING(d.country),
    d.country;
```

| sector | country | constituents |
|---|---|---|
| Financial Services | NULL | 11 |
| Technology | NULL | 5 |
| NULL | Finland | 1 |
| NULL | France | 3 |
| NULL | Germany | 5 |
| NULL | Italy | 2 |
| NULL | Netherlands | 3 |
| NULL | Spain | 2 |
| NULL | NULL | 16 |

Nine rows: two sector subtotals, six country subtotals, and the grand total. The detail `(sector, country)` rows are omitted because `(sector, country)` is not in the explicit list. The empty tuple `()` at the end requests the grand-total row. This is the most efficient form when you only need the subtotals — `CUBE` would waste effort computing the detail rows that are then discarded.

### GROUPING and GROUPING_ID — labelling subtotal rows

`GROUPING(column)` returns `1` if the column was rolled up on the current row (meaning the `NULL` is a subtotal marker, not a real `NULL`), and `0` otherwise. `GROUPING_ID(col1, col2, ...)` packs multiple `GROUPING()` results into a single integer bitmap — bit `i` is set if column `i` was rolled up on the current row. The bitmap makes it easy to write a single `CASE` expression that labels every kind of row in one pass.

On two columns the bitmap has four possible values:

- `0` — both columns present (detail row)
- `1` — only `col2` rolled up (col1 subtotal)
- `2` — only `col1` rolled up (col2 subtotal)
- `3` — both rolled up (grand total)

#### Labelling every CUBE row with a human-readable tag

> [!info]- Clause-by-clause walkthrough
>
> 1. `GROUPING_ID(d.sector, d.country)` computes the 2-bit bitmap: `0` for detail, `1` for sector-level, `2` for country-level, `3` for grand total.
> 2. The outer `CASE` maps each bitmap value to a human-readable label, concatenating column values with `CONCAT` (which skips `NULL` arguments automatically).
> 3. `GROUP BY CUBE(d.sector, d.country)` requests all four grouping levels.
> 4. `ORDER BY GROUPING_ID(...), d.sector, d.country` sorts the detail rows first, then sector subtotals, then country subtotals, then the grand total — matching the bitmap order.

*Use `GROUPING_ID` and a `CASE` expression to label each row of a `CUBE` result.*

```sql
SELECT
    CASE GROUPING_ID(d.sector, d.country)
        WHEN 0 THEN CONCAT(d.sector, ' / ', d.country)
        WHEN 1 THEN CONCAT(d.sector, ' (sector subtotal)')
        WHEN 2 THEN CONCAT(d.country, ' (country subtotal)')
        WHEN 3 THEN 'GRAND TOTAL'
    END AS grouping_label,
    COUNT(*) AS constituents
FROM silver.index_dim AS d
WHERE d.is_current = 1
  AND d._index = 'euro_stoxx_50'
  AND d.sector IN ('Technology', 'Financial Services')
GROUP BY CUBE(d.sector, d.country)
ORDER BY GROUPING_ID(d.sector, d.country), d.sector, d.country;
```

| grouping_label | constituents |
|---|---|
| Financial Services / Finland | 1 |
| Financial Services / France | 2 |
| Financial Services / Germany | 3 |
| Financial Services / Italy | 2 |
| Financial Services / Netherlands | 1 |
| Financial Services / Spain | 2 |
| Technology / France | 1 |
| Technology / Germany | 2 |
| Technology / Netherlands | 2 |
| Financial Services (sector subtotal) | 11 |
| Technology (sector subtotal) | 5 |
| Finland (country subtotal) | 1 |
| France (country subtotal) | 3 |
| Germany (country subtotal) | 5 |
| Italy (country subtotal) | 2 |
| Netherlands (country subtotal) | 3 |
| Spain (country subtotal) | 2 |
| GRAND TOTAL | 16 |

Eighteen rows, each with a meaningful label: nine detail rows, two sector subtotals, six country subtotals, and one grand total. The `GROUPING_ID` value drives both the `CASE` expression in the `SELECT` list and the `ORDER BY` clause, so the rows are grouped by their level in the output and each level is self-labelled. This is the production pattern for any report that renders `ROLLUP`/`CUBE` output to a business consumer — without the labelling, the subtotal `NULL`s are ambiguous and the reader cannot tell which dimension was rolled up.

> [!warning] Real NULLs in source columns look identical to subtotal NULLs
>
> If the source column genuinely contains `NULL` values (e.g., a `country` column where some rows have unknown country), the `NULL` output can mean either "real NULL" or "subtotal marker". `GROUPING(column)` is the only way to disambiguate: if `GROUPING(col) = 1`, the row is a subtotal; if `GROUPING(col) = 0` and `col IS NULL`, the row is a real `NULL`. Never rely on `col IS NULL` alone to identify subtotal rows in a `ROLLUP`/`CUBE` result.

> [!success] Label subtotal rows with `GROUPING`
>
> Project `GROUPING(col)` or `GROUPING_ID(...)` into the result and use those flags in both the display label and the `ORDER BY`. That makes subtotal rows explicit, keeps real source `NULL`s distinguishable, and prevents report logic from silently misclassifying detail rows as rollups.

## Aggregating Over External Files (CSV, JSON, XML)

Every aggregate function in this note — `SUM`, `AVG`, `MIN`, `MAX`, `COUNT`, `STDEV`, conditional-`CASE` forms, `ROLLUP`/`CUBE`/`GROUPING SETS`, even window aggregates — applies equally to rowsets that originate in a file rather than a table. `OPENROWSET(BULK ...)` exposes a flat file, a JSON document, or an XML document as a virtual rowset that can be the source of any `SELECT`. This unlocks two concrete workflows: (1) validating an incoming file *before* loading it into a table, and (2) running one-off analytical queries against raw file data that has not yet been ingested into the warehouse.

This section covers the three file formats that T-SQL can read directly from a local filesystem path — CSV, JSON, and XML. See the Microsoft [OPENROWSET (Transact-SQL)](https://learn.microsoft.com/en-us/sql/t-sql/functions/openrowset-transact-sql) reference for the full option list, and the `BULK INSERT` and `OPENROWSET(BULK ...)` subsections of [10-insert-update-delete-patterns](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/10-insert-update-delete-patterns) for the ingestion-oriented variants of the same functions.

> [!info] File path is resolved on the SQL Server host, not the client
>
> `OPENROWSET(BULK ...)` reads the file from the SQL Server service account's filesystem, not the client's. On the `stoxx-db` Docker container used throughout this chapter, files must be placed in `/var/opt/mssql/imports/` (the canonical container-mounted directory). On a Windows-hosted SQL Server the equivalent path is any local directory the service account can read, typically `N'E:\SQLImports\filename.ext'`. The loading principal also needs the `ADMINISTER BULK OPERATIONS` server permission or the `bulkadmin` role — regular logins cannot run `OPENROWSET(BULK ...)`.

> [!info] Format coverage at a glance
>
> | Format | Access path | Native SQL Server support | Aggregates supported |
> |---|---|---|---|
> | **CSV** | `OPENROWSET(BULK '...', FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0d0a') WITH (...)` | Yes (SQL Server 2017+) | All — rowset behaves exactly like a table |
> | **JSON** | `OPENROWSET(BULK '...', SINGLE_CLOB)` + `CROSS APPLY OPENJSON(BulkColumn) WITH (...)` | Yes — via `OPENJSON` shredding | All — after the JSON array is expanded |
> | **XML** | `OPENROWSET(BULK '...', SINGLE_BLOB)` + `CAST(BulkColumn AS xml)` + `.nodes()` + `.value()` | Yes — via the `xml` type and XQuery methods | All, **except** XML methods cannot appear inside `GROUP BY` (error 4148) — pre-shred in a CTE |
>
> **Parquet is deliberately out of scope for this note.** SQL Server 2022 added `FORMAT='PARQUET'` to `OPENROWSET(BULK ...)`, but only via `CREATE EXTERNAL DATA SOURCE` backed by Azure Blob Storage or S3-compatible storage. Local parquet file reading is not supported directly by T-SQL. For local parquet files, convert to CSV/JSON with `duckdb` or `pandas` first, or stand up a MinIO/Azurite container to expose the parquet files over an S3/Blob endpoint.

### CSV: aggregate directly from a flat file

`OPENROWSET(BULK 'path', FORMAT='CSV', …)` with a `WITH(...)` column-schema clause parses each CSV row into a typed virtual row. Once declared, the rowset behaves identically to a table: every aggregate is legal, `GROUP BY`, `HAVING`, `ORDER BY`, and all three multi-level grouping extensions work without modification.

> [!info]- Clause-by-clause breakdown
>
> - `BULK '/var/opt/mssql/imports/eurostoxx50_ohlcv.csv'` — filesystem path as seen by the SQL Server service account inside the Docker container.
> - `FORMAT='CSV'` — SQL Server 2017+ modern CSV parser (the legacy parser is triggered by omitting `FORMAT`).
> - `FIRSTROW=2` — skip the header row.
> - `FIELDTERMINATOR=','` and `ROWTERMINATOR='0x0d0a'` — comma field separator and Windows CRLF row terminator. Using `0x0a` (Unix LF) on a CRLF file leaves the stray `\r` attached to the last column and triggers bulk-load truncation error 4863.
> - `WITH (id int, symbol varchar(20), [date] date, …)` — inline column schema. Without it, the result is a single wide `BulkColumn` text column. Reserved-like column names (`date`, `open`, `close`) need bracket quoting.

*Count rows, distinct symbols, and date range of the full `eurostoxx50_ohlcv.csv` in one pass.*

```sql
SELECT
    COUNT(*)                     AS row_count,
    COUNT(DISTINCT symbol)       AS distinct_symbols,
    MIN([date])                  AS first_date,
    MAX([date])                  AS last_date
FROM OPENROWSET(
    BULK '/var/opt/mssql/imports/eurostoxx50_ohlcv.csv',
    FORMAT = 'CSV',
    FIRSTROW = 2,
    FIELDTERMINATOR = ',',
    ROWTERMINATOR = '0x0d0a'
) WITH (
    id           int,
    symbol       varchar(20),
    [date]       date,
    [open]       float,
    [high]       float,
    [low]        float,
    [close]      float,
    adj_close    float,
    volume       bigint,
    dividends    float,
    stock_splits float,
    is_filled    varchar(10)
) AS src;
```

| row_count | distinct_symbols | first_date | last_date |
|---|---|---|---|
| 66355 | 50 | 2021-01-04 | 2026-03-12 |

The CSV contains 66,355 rows covering 50 distinct symbols between 2021-01-04 and 2026-03-12. Compare this to the on-disk `silver.eurostoxx50_ohlcv` table (67,155 rows ending on 2026-04-07) — the CSV is an older snapshot by about a month. Running the same `COUNT` / `COUNT DISTINCT` / `MIN` / `MAX` suite on both sides is the canonical "file vs table reconciliation" check: any discrepancy in row count, distinct-symbol count, or date range surfaces before the file is ingested, not after.

*Aggregate the same CSV by symbol — top 5 highest-priced symbols by average close.*

```sql
SELECT TOP (5)
    symbol,
    COUNT(*)       AS trading_days,
    AVG([close])   AS avg_close,
    SUM(volume)    AS total_volume
FROM OPENROWSET(
    BULK '/var/opt/mssql/imports/eurostoxx50_ohlcv.csv',
    FORMAT = 'CSV',
    FIRSTROW = 2,
    FIELDTERMINATOR = ',',
    ROWTERMINATOR = '0x0d0a'
) WITH (
    id           int,
    symbol       varchar(20),
    [date]       date,
    [open]       float,
    [high]       float,
    [low]        float,
    [close]      float,
    adj_close    float,
    volume       bigint,
    dividends    float,
    stock_splits float,
    is_filled    varchar(10)
) AS src
GROUP BY symbol
ORDER BY avg_close DESC;
```

| symbol | trading_days | avg_close | total_volume |
|---|---|---|---|
| RMS.PA | 1331 | 1761.555747558227 | 81633862 |
| ADYEN.AS | 1331 | 1545.9764087152519 | 110400463 |
| ASML.AS | 1331 | 671.348910593539 | 945070720 |
| MC.PA | 1331 | 662.4045078888057 | 557855567 |
| RHM.DE | 1324 | 544.6615332326281 | 308359744 |

Hermès (`RMS.PA`) leads at ~€1,762 average close, followed by Adyen (`ADYEN.AS`) at ~€1,546. All aggregates are computed against the file directly — no intermediate staging table, no temporary table, no external tool. This is the exact same `GROUP BY symbol` shape you would write against `silver.eurostoxx50_ohlcv`, with only the `FROM` clause swapped. When the file is the authoritative source, this pattern is faster than a full ingest because it skips the write path entirely. It is also the basis for any "pre-ingest diagnostic" query — `STDEV([close])`, `MIN([date])`/`MAX([date])`, missing-symbol counts, and so on.

### JSON: aggregate via OPENROWSET + OPENJSON

For JSON files, `OPENROWSET(BULK '…', SINGLE_CLOB)` returns the entire file content as a single `varchar(max)` column called `BulkColumn`. `CROSS APPLY OPENJSON(BulkColumn) WITH (...)` then shreds the top-level JSON array into a typed rowset; from there every aggregate flows through normally. The Microsoft [OPENJSON (Transact-SQL)](https://learn.microsoft.com/en-us/sql/t-sql/functions/openjson-transact-sql) reference covers the path-expression and column-schema syntax; [09-json-xml-and-semi-structured-data](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/09-json-xml-and-semi-structured-data) is the full sibling-note treatment.

*Count the index definitions and concatenate their display names from `dim_index.json`.*

```sql
SELECT
    COUNT(*)                                 AS idx_count,
    STRING_AGG(display_name, ' | ')          AS all_names
FROM OPENROWSET(
    BULK '/var/opt/mssql/imports/dim_index.json',
    SINGLE_CLOB
) AS src
CROSS APPLY OPENJSON(src.BulkColumn) WITH (
    index_key     varchar(50)  '$.index_key',
    display_name  varchar(100) '$.display_name',
    file_prefix   varchar(50)  '$.file_prefix',
    currency      nvarchar(10) '$.currency'
) AS j;
```

| idx_count | all_names |
|---|---|
| 4 | Euro Stoxx 50 \| Oil & Gas 20 \| STOXX Asia/Pacific 50 \| STOXX USA 50 |

The JSON file holds 4 index definitions. `COUNT(*)` aggregates the shredded rowset; `STRING_AGG` concatenates the `display_name` strings with a ` | ` separator. The `CROSS APPLY OPENJSON(...) WITH (...)` pattern is the idiomatic shape: `SINGLE_CLOB` gets the file as one `varchar(max)`, `CROSS APPLY OPENJSON` expands that single value into N rows matching the JSON array length, and the `WITH (...)` clause gives each expanded row typed columns. From there every construct from the previous sections of this note — `SUM`, `AVG`, `GROUP BY`, `ROLLUP`, window aggregates — applies without modification.

*Aggregate `SUM`/`AVG`/`MIN`/`MAX` over the `signals_daily.json` file, filtered to the EuroStoxx 50.*

```sql
SELECT
    COUNT(*)                               AS signal_count,
    SUM(market_cap)                        AS total_mcap,
    AVG(beta)                              AS avg_beta,
    MIN(forward_pe)                        AS min_pe,
    MAX(forward_pe)                        AS max_pe
FROM OPENROWSET(
    BULK '/var/opt/mssql/imports/signals_daily.json',
    SINGLE_CLOB
) AS src
CROSS APPLY OPENJSON(src.BulkColumn) WITH (
    symbol       varchar(20) '$.symbol',
    _index       varchar(20) '$._index',
    forward_pe   float       '$.forward_pe',
    market_cap   bigint      '$.market_cap',
    beta         float       '$.beta'
) AS j
WHERE j._index = 'euro_stoxx_50';
```

| signal_count | total_mcap | avg_beta | min_pe | max_pe |
|---|---|---|---|---|
| 149 | 15137339773952 | 0.7912176870748298 | 2.6177435 | 41.603306 |

The JSON file holds 149 EuroStoxx 50 signal rows — slightly fewer than the 199 currently in `silver.signals_daily` because the JSON export is an earlier snapshot. The aggregate shape is identical to what you would run against the silver table: `COUNT(*)`, `SUM(market_cap)`, `AVG(beta)`, `MIN`/`MAX` of `forward_pe`. Average beta is ~0.79, indicating the EuroStoxx 50 universe is slightly defensive on average relative to its own market. Minimum forward PE is ~2.6 (a deep-value outlier — likely an energy or banking name) and maximum is ~41.6 (a growth stock). Running these diagnostics against the raw file is the fastest path to a "does this export look sane" check before any ingest.

### XML: aggregate via .nodes() and .value()

XML files follow a different shredding path. `OPENROWSET(BULK '…', SINGLE_BLOB)` returns the file as `varbinary(max)`; the value is cast to `xml` and assigned to a variable. The `xml` type exposes `.nodes('xpath')` to produce one row per matching node and `.value('path', 'type')` to extract typed scalar values from each node. The resulting rowset is a normal table source that any aggregate can consume.

*Element-shaped XML: aggregate per-row metrics from `signals_sample.xml`.*

```sql
DECLARE @x xml;
SELECT @x = CAST(BulkColumn AS xml)
FROM OPENROWSET(
    BULK '/var/opt/mssql/imports/signals_sample.xml',
    SINGLE_BLOB
) AS src;

SELECT
    COUNT(*)                                          AS signal_count,
    SUM(n.value('market_cap[1]','bigint'))            AS total_mcap,
    AVG(n.value('beta[1]','float'))                   AS avg_beta,
    MIN(n.value('forward_pe[1]','float'))             AS min_pe,
    MAX(n.value('forward_pe[1]','float'))             AS max_pe
FROM @x.nodes('/signals/signal') AS t(n);
```

| signal_count | total_mcap | avg_beta | min_pe | max_pe |
|---|---|---|---|---|
| 12 | 2411000000000 | 1.0608333333333333 | 7.4 | 52.3 |

The XML file contains 12 `<signal>` elements. `.nodes('/signals/signal')` produces 12 rows with a column `n` of type `xml` (one per node); `.value('market_cap[1]', 'bigint')` extracts the first `<market_cap>` child element as a typed `bigint`. The `[1]` positional predicate is mandatory because `.value()` requires a **singleton** — XQuery expressions that could return more than one node are rejected. The aggregates then run against the extracted columns as if they were table columns: total mcap ~€2.41 T, average beta ~1.06, forward PE ranging from 7.4 (BNP Paribas) to 52.3 (Hermès).

> [!failure] XML methods are not allowed in GROUP BY — error 4148
>
> The `.value()` and `.nodes()` methods cannot appear directly inside a `GROUP BY` clause. Writing `GROUP BY n.value('sector[1]', 'varchar(50)')` raises error 4148 "XML methods are not allowed in a GROUP BY clause". The same rule applies to `ORDER BY` in some contexts and to window-function `PARTITION BY` clauses. The fix is to pre-shred the XML into a CTE or derived table whose columns are already typed and named, then `GROUP BY` those regular columns in the outer query.

*Aggregate per sector by pre-shredding the XML in a CTE.*

```sql
DECLARE @x xml;
SELECT @x = CAST(BulkColumn AS xml)
FROM OPENROWSET(
    BULK '/var/opt/mssql/imports/signals_sample.xml',
    SINGLE_BLOB
) AS src;

WITH shredded AS (
    SELECT
        n.value('sector[1]','varchar(50)')     AS sector,
        n.value('market_cap[1]','bigint')      AS market_cap,
        n.value('beta[1]','float')             AS beta
    FROM @x.nodes('/signals/signal') AS t(n)
)
SELECT
    sector,
    COUNT(*)                AS signals,
    SUM(market_cap)         AS total_mcap,
    AVG(beta)               AS avg_beta
FROM shredded
GROUP BY sector
ORDER BY total_mcap DESC;
```

| sector | signals | total_mcap | avg_beta |
|---|---|---|---|
| Consumer Discretionary | 2 | 581000000000 | 1.01 |
| Information Technology | 2 | 500000000000 | 1.2 |
| Health Care | 1 | 412000000000 | 0.61 |
| Consumer Staples | 2 | 357000000000 | 0.63 |
| Industrials | 2 | 294000000000 | 1.18 |

... (truncated to 5 rows)

The CTE pre-shreds the XML into three typed columns, and the outer `SELECT` aggregates them normally. The result shows 12 signals grouped across 7 sectors — Consumer Discretionary leads at ~€581 B total cap (driven by MC.PA Louis Vuitton and RMS.PA Hermès). This "shred in a CTE, aggregate in the outer query" pattern is the idiomatic way to combine XML rowsets with any aggregate-requiring clause — `GROUP BY`, `HAVING`, `ROLLUP`, window functions. The same workaround applies to `ROW_NUMBER() OVER (PARTITION BY n.value(...))` and similar shapes: pre-shred first, then layer the set operator on the pre-shredded columns.

*Attribute-shaped XML: aggregate close prices and volume from `eurostoxx_daily.xml`.*

```sql
DECLARE @x xml;
SELECT @x = CAST(BulkColumn AS xml)
FROM OPENROWSET(
    BULK '/var/opt/mssql/imports/eurostoxx_daily.xml',
    SINGLE_BLOB
) AS src;

SELECT
    @x.value('(/bars/@symbol)[1]','varchar(20)')  AS symbol,
    COUNT(*)                                      AS bars,
    MIN(n.value('@close','float'))                AS min_close,
    MAX(n.value('@close','float'))                AS max_close,
    AVG(n.value('@close','float'))                AS avg_close,
    SUM(n.value('@volume','bigint'))              AS total_volume
FROM @x.nodes('/bars/bar') AS t(n);
```

| symbol | bars | min_close | max_close | avg_close | total_volume |
|---|---|---|---|---|---|
| ASML.AS | 10 | 821.7 | 851.45 | 837.98 | 14838900 |

When XML uses attributes instead of child elements, the path expressions switch from `'field[1]'` to `'@field'`. The root-level `@symbol` attribute on `<bars>` is extracted once with `@x.value('(/bars/@symbol)[1]', 'varchar(20)')`. The per-`<bar>` attributes (`@date`, `@close`, `@volume`) are extracted inside the aggregates via `n.value('@close', 'float')`. The file contains 10 daily bars for ASML in February 2026, with close prices ranging from €821.70 to €851.45 and total traded volume of ~14.8 M shares. Attribute-shaped XML is typically more compact than element-shaped and is the natural fit for tabular data with a fixed column schema — the tradeoff is that attributes cannot have children or repeated values, so complex shapes must still use elements.

> [!tip] Prefer pre-shredding the file into a staging table for repeated queries
>
> All three patterns above read and parse the file on every execution. If the same file is queried multiple times (e.g., a daily pre-ingest validation that runs a suite of 10+ diagnostics), the parse-and-shred cost is wasted on every run after the first. For these workflows, do a one-time `INSERT INTO staging.table SELECT ... FROM OPENROWSET(...)` and run all subsequent queries against the staging table instead. The staging table is also SARGable against indexes, which the virtual `OPENROWSET` rowset never is.

## Window Aggregates (Cross-Reference)

Every aggregate function documented above can also be used as a **window aggregate** by adding an `OVER(...)` clause. The fundamental difference is that a regular aggregate collapses rows into groups, while a window aggregate computes the aggregate within a partition of rows and returns one result row per input row — the input row count is preserved. This makes window aggregates the correct tool for running totals, percent-of-total, moving averages, and any calculation that needs to reference per-group context without losing per-row detail.

This section gives two brief demonstrations to establish the pattern. Full framing (`ROWS`/`RANGE`), ordering semantics, the `LAG`/`LEAD` navigation functions, and the ranking family (`ROW_NUMBER`/`RANK`/`DENSE_RANK`/`NTILE`) belong to the dedicated [05-window-functions](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/05-window-functions) sibling note.

### Running total with SUM OVER

A running total accumulates a sum across a partition in a specified order. The pattern is `SUM(col) OVER (PARTITION BY key ORDER BY sort_col ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)`. The partition scopes the running total to a single entity (one symbol, one index, one customer), the order defines the accumulation direction (chronological, usually), and the frame clause specifies "everything up to and including the current row".

*Running sum of daily returns for the EuroStoxx 50 index starting 2026-01-01.*

```sql
SELECT TOP 5
    _index,
    perf_date,
    CAST(daily_return AS decimal(10,6))                                  AS daily_return,
    CAST(SUM(daily_return) OVER (
        PARTITION BY _index ORDER BY perf_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS decimal(12,6))                                                  AS running_return_sum
FROM gold.index_performance
WHERE _index = 'euro_stoxx_50'
  AND perf_date >= '2026-01-01'
ORDER BY perf_date;
```

| _index | perf_date | daily_return | running_return_sum |
|---|---|---|---|
| euro_stoxx_50 | 2026-01-02 | 0.007070 | 0.007070 |
| euro_stoxx_50 | 2026-01-05 | 0.006150 | 0.013220 |
| euro_stoxx_50 | 2026-01-06 | 0.001699 | 0.014918 |
| euro_stoxx_50 | 2026-01-07 | -0.003217 | 0.011702 |
| euro_stoxx_50 | 2026-01-08 | 0.000398 | 0.012100 |

Five consecutive trading days in early January 2026, each showing the daily return and the cumulative sum from the partition start. The running total on 2026-01-02 equals the first daily return (`0.007070`). On 2026-01-05 the running total is the sum of the first two rows (`0.007070 + 0.006150 = 0.013220`). On 2026-01-07 the running total drops from `0.014918` to `0.011702` because the daily return was negative (`-0.003217`). This is the correct way to build a cumulative-return chart from daily observations — one pass over the source, one row output per input row, no correlated subquery.

Note that `SUM(daily_return)` is **not** a proper cumulative-return metric in the financial sense. True cumulative return compounds multiplicatively: `∏(1 + daily_return) - 1`. The linear sum shown here is a first-order approximation that is only close to the compounded value when all `daily_return` values are small. For a production cumulative-return column, use `EXP(SUM(LOG(1 + daily_return))) - 1` or pre-compute the `cumulative_factor` column that `gold.index_performance` already exposes.

### Percent of total with SUM OVER ()

The second canonical window-aggregate pattern is the "percent of total" expression. `SUM(expr) OVER ()` — with no `PARTITION BY` and no `ORDER BY` — computes the sum across every row in the result set, which makes it trivial to express each row as a fraction of the whole.

*Top 5 EuroStoxx 50 symbols by 2026-onwards volume, with share of the universe total.*

```sql
SELECT TOP 5
    symbol,
    SUM(volume)                                                         AS symbol_volume,
    CAST(100.0 * SUM(volume) / SUM(SUM(volume)) OVER () AS decimal(6,3)) AS pct_of_universe
FROM silver.eurostoxx50_ohlcv
WHERE [date] >= '2026-01-01'
GROUP BY symbol
ORDER BY symbol_volume DESC;
```

| symbol | symbol_volume | pct_of_universe |
|---|---|---|
| ISP.MI | 3769576951 | 23.164 |
| SAN.MC | 2110617845 | 12.970 |
| ENEL.MI | 1795333971 | 11.032 |
| ENI.MI | 841083213 | 5.168 |
| BBVA.MC | 833430105 | 5.121 |

The top five by 2026-onwards volume again show extreme concentration: Intesa Sanpaolo alone represents 23.2% of the 50-constituent EuroStoxx volume, and the top five combined account for roughly 57.5% of the total universe. The key trick in this query is the nested aggregate: `SUM(SUM(volume)) OVER ()` — the inner `SUM(volume)` is the per-group aggregate from the `GROUP BY`, and the outer `SUM(...) OVER ()` sums those per-group values across all groups after grouping has been applied. This is legal only because the window aggregate runs after the `GROUP BY` step, not before.

## Practical Guidance

A condensed checklist of habits derived from the rules and traps above. Each item cross-references the relevant subsection.

- **Cast `int` columns to `bigint` before `SUM` on large datasets.** `SUM(int)` overflows silently at 2.1 billion. See the `### SUM over int silently overflows at 2.1 billion` subsection.
- **Cast integer columns inside `AVG` or multiply by `1.0`** whenever the natural mean is fractional. `AVG(int)` truncates. See the `### AVG over integer columns silently truncates` subsection.
- **Use `COUNT(*)` for row counts** and `COUNT(column)` for non-null counts. Use `COUNT(*) - COUNT(column)` to measure missingness. See the `### COUNT(*) vs COUNT(column)` subsection.
- **Prefer `COUNT_BIG` in reusable code paths** where the underlying table might grow beyond 2 billion rows.
- **Use `APPROX_COUNT_DISTINCT` for cardinality monitoring** on very large inputs where the 2%-error bound is acceptable. Use exact `COUNT(DISTINCT)` for reconciliation and regulatory reporting.
- **Cast `float` inputs to `decimal` before aggregating** when determinism matters. `SUM(float)` under a parallel plan can return slightly different values across runs. See the `### Float aggregation is order-sensitive` subsection.
- **Use `STDEV` for financial return series** (sample standard deviation, treats the observed history as a sample drawn from an unknown process). Reserve `STDEVP` for the rare case where the input rows genuinely are the full population.
- **Wrap denominators in `NULLIF(..., 0)`** to prevent divide-by-zero error 8134. Combine with a decimal-literal multiplier for the canonical percentage form `100.0 * num / NULLIF(denom, 0)`. See the `### Division by zero raises error 8134` and `### Integer ratio truncation and decimal-literal promotion` subsections.
- **Put row-level predicates in `WHERE`, aggregate-level predicates in `HAVING`.** `WHERE` runs before aggregation (and cannot reference aggregates — error 147); `HAVING` runs after. See the `### Logical processing order: WHERE runs before GROUP BY, HAVING runs after` subsection.
- **Prefer `SUM(CASE WHEN ...)` over `PIVOT`** when the output columns are known at parse time. Conditional aggregation is more flexible, scales linearly with new columns, and reads more cleanly. See the `### SUM(CASE WHEN ...) — the filtered sum` subsection.
- **Omit the `ELSE` branch when computing filtered `AVG`.** Implicit `NULL` excludes the row from both numerator and denominator — the correct behavior for a filtered mean. See the `### Conditional AVG — filtered averages` subsection.
- **Choose `ROLLUP` for hierarchical subtotals, `CUBE` for all combinations, and `GROUPING SETS` for explicit combinations only.** Prefer `GROUPING SETS` when you only need a subset of combinations — it is both more efficient and more readable. See the `## Multi-Level Grouping: ROLLUP, CUBE, and GROUPING SETS` section.
- **Use `GROUPING_ID` to label subtotal rows** in `ROLLUP`/`CUBE` output. Never rely on `col IS NULL` alone — real `NULL` values in the source column look identical to subtotal markers without the `GROUPING` disambiguation.
- **Prefer `LOG10(x)` over `LOG(x, 10)`** — the former is exact, the latter introduces last-bit rounding noise via its `LN(x)/LN(10)` internal implementation.
- **Always wrap degree inputs in `RADIANS(...)`** before passing them to `SIN`/`COS`/`TAN`. T-SQL trigonometric functions expect radians, not degrees, and SQL Server's two-argument arctangent is named `ATN2`, not `ATAN2`.
- **Use `CRYPT_GEN_RANDOM` when each row needs an independent random value.** `RAND()` is session-scoped and returns the same value for every row in a single query — it is useless for per-row sampling.
- **Prefer explicit truncation mode (`ROUND(x, n, 1)`)** when the business rule requires deterministic down-rounding. Default `ROUND` is "half away from zero", not banker's rounding.
- **Use a window aggregate (`SUM(...) OVER ()`)** for percent-of-total and running-total patterns instead of self-joins or correlated subqueries. See the `## Window Aggregates (Cross-Reference)` section and the [05-window-functions](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/05-window-functions) sibling note for the full treatment.
- **Aggregate directly over CSV/JSON/XML files with `OPENROWSET(BULK ...)`** for pre-ingest diagnostics and one-off analytical queries. Use `FORMAT='CSV'` with an inline `WITH(...)` schema for flat files, `SINGLE_CLOB + OPENJSON WITH(...)` for JSON, and `SINGLE_BLOB + CAST AS xml + .nodes()/.value()` for XML. Pre-shred XML into a CTE when you need `GROUP BY` or window functions over `.value()` results — XML methods are not allowed inside `GROUP BY` (error 4148). See the `## Aggregating Over External Files (CSV, JSON, XML)` section. Local parquet is not supported — use the external-data-source path in [10-insert-update-delete-patterns](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/10-insert-update-delete-patterns) or convert to CSV first.
