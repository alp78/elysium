---
title: "12 - SARGable Queries"
tags: [sql-server, tsql, query-writing, performance, sargable]
aliases: [SARGable, search argument, index seek, non-sargable, predicate, sarg]
description: "T-SQL reference for SARGable predicates on SQL Server 2022: the optimizer's Search ARGument rule, bare-column vs function-wrapped predicates, implicit conversion traps, half-open date ranges, composite-index left-prefix behavior, ISNULL vs COALESCE, catch-all parameter patterns, computed-column and filtered-index escape hatches, all validated empirically against a 671,550-row `stoxx` table via sys.dm_db_index_usage_stats seek/scan deltas."
created: 2026-03-22
updated: 2026-04-11
status: complete
---

# SARGable Queries

> [!abstract]- Summary
>
> SARGability is the query-writer’s main leverage over index access: this note defines the search-argument rule, shows its behavior empirically on a 671,550-row test table via seek and scan counter deltas, and maps the predicate rewrites that turn scans into seeks without changing schema.
>
> **Core SARGability rules**
> - covers the search-argument definition, seek versus scan evidence, and why predicate shape matters independently of index maintenance
>
> **Index-key alignment**
> - covers the composite-index left-prefix rule and the cases where a bare predicate still scans because it starts on a non-leftmost key
>
> **Predicate anti-patterns**
> - covers functions on indexed columns, arithmetic predicates, date-boundary rewrites, `ISNULL` versus `COALESCE`, and implicit conversion traps
>
> **Boolean and parameter patterns**
> - covers `OR`, `IN`, `EXISTS`, `NOT IN`, and the catch-all `@p IS NULL OR col = @p` shape with its parameterization consequences
>
> **Escape hatches**
> - covers computed columns and filtered indexes when a direct predicate rewrite is impossible or no longer clear enough
>
> **Operations and safety**
> - Warnings: a seek operator can still read most of an index, non-leftmost key predicates still scan, cross-type comparisons can force column-side conversion, `BETWEEN` is unsafe for datetime boundaries, `COALESCE` and catch-all predicates can defeat seeks, and filtered indexes require compile-time proof
> - Recommendations: keep the indexed column bare, move math and casts to the literal side, use half-open date ranges, align parameter types with column types, rewrite cross-column `OR` into `UNION ALL` when appropriate, and treat computed columns or filtered indexes as deliberate workload-specific exceptions

> [!note]- Glossary
>
> **SARGability**
> - The property of a predicate that allows SQL Server to use index key order to navigate directly to qualifying rows.
> - It matters because this note is about changing predicate shape so the optimizer can seek instead of scanning and post-filtering.
>
> > [!warning] This is a query-shape property
> >
> > SARGability is not something the index “has” by itself. The same index can seek or scan depending entirely on how the predicate is written.
>
> ---
>
> **Search argument**
> - The optimizer-friendly predicate shape where an indexed column is compared directly to a constant, parameter, or compile-time expression that does not reference the column.
> - It matters because this is the formal rule underneath the everyday advice to keep the indexed column bare.
>
> > [!info] The rule is structural, not stylistic
> >
> > SQL Server cares about whether the predicate can be transformed into an index navigation range. Small syntactic changes can break that transformation completely.
>
> ---
>
> **Index seek**
> - An access pattern where SQL Server uses index key order to jump to a relevant key range instead of reading every row in sequence.
> - It matters because seeks are the visible payoff of SARGable predicate writing.
>
> > [!warning] A seek is not automatically cheap
> >
> > A range seek with a weak predicate can still read most of the index. The operator name is evidence of plan shape, not proof of low cost.
>
> ---
>
> **Index scan**
> - An access pattern where SQL Server reads an entire index or a large part of it and evaluates filters row by row.
> - It matters because non-SARGable predicates most often force scans even when a seemingly relevant index exists.
>
> > [!warning] A scan can be logically correct and operationally expensive
> >
> > The engine is not failing when it scans; it is choosing the best plan available for the predicate shape it was given. Fixing the predicate is often what changes the choice.
>
> ---
>
> **Left-prefix rule**
> - The rule that a composite index can only seek efficiently starting from its leftmost key columns in order.
> - It matters because many authors assume a predicate on any indexed column should seek, even when that column is not the leading key.
>
> > [!warning] Bare is necessary, not sufficient
> >
> > A predicate can be perfectly bare and still scan if it starts at the wrong place in the composite key order. Index design and predicate shape have to line up.
>
> ---
>
> **Function-on-column predicate**
> - A filter that wraps the indexed column in a function such as `YEAR`, `LEFT`, `TRIM`, or `CAST`.
> - It matters because this is the most common way developers accidentally destroy seekability.
>
> > [!warning] The engine loses the raw key order
> >
> > Once the column is transformed row by row, the original index ordering no longer maps directly to the filtered value. SQL Server usually has to scan and evaluate the function for every row.
>
> ---
>
> **Implicit conversion**
> - An automatic type coercion SQL Server applies when a comparison mixes incompatible data types.
> - It matters because if the conversion lands on the column side, a seemingly simple predicate stops being SARGable.
>
> > [!warning] Parameter types can silently ruin a good predicate
> >
> > An `nvarchar` parameter compared to a `varchar` column is a classic example. The text looks harmless, but the hidden conversion can push work onto the indexed column.
>
> ---
>
> **Half-open date range**
> - A datetime filter written as `>= start AND < end` so the upper bound is exclusive.
> - It matters because it is both the safest correctness pattern for temporal filters and the SARGable alternative to many `YEAR`, `CAST`, or `BETWEEN` anti-patterns.
>
> > [!warning] Inclusive end points are two problems at once
> >
> > `BETWEEN` on datetime data is both precision-fragile and often harder to reason about. Half-open ranges solve the correctness issue and preserve seekability.
>
> ---
>
> **Catch-all predicate**
> - A parameterized filter pattern such as `(@p IS NULL OR col = @p)` that tries to support optional filtering in one static statement.
> - It matters because it is convenient in application code and notoriously bad for index usage without recompilation or dynamic SQL.
>
> > [!warning] Optionality defeats proof
> >
> > The optimizer cannot commit to one narrow access path when the predicate can mean “filter by this value” or “return everything.” That ambiguity is why catch-all forms usually scan.
>
> ---
>
> **Residual predicate**
> - A filter condition evaluated after an index access path has already located a broader row range.
> - It matters because some plan shapes look like seeks but still read too much data because the real filtering happens residually.
>
> > [!info] Seek plus residual can behave like a scan
> >
> > If the seek range is broad and the residual filter does the real elimination, the logical operator label can be misleadingly optimistic.
>
> ---
>
> **Computed column escape hatch**
> - The design pattern of materializing or defining the troublesome expression as a computed column and then indexing that expression result.
> - It matters because some business predicates cannot be rewritten cleanly to keep the base column bare.
>
> > [!warning] This is a schema trade-off
> >
> > A computed column index can recover seekability, but it adds storage, maintenance cost, and design complexity. It should solve an important repeated workload, not a one-off query.
>
> ---
>
> **Filtered index**
> - An index that stores only rows matching a fixed predicate defined at index-creation time.
> - It matters because it can make hot subsets extremely efficient, but only when the query shape proves the same filter at compile time.
>
> > [!warning] Matching the filter is a compile-time proof problem
> >
> > A parameter that happens to equal the filter literal at runtime is not enough. If the optimizer cannot prove the filter predicate during compilation, it may ignore the filtered index entirely.
>
> ---
>
> **Seek/scan counter delta**
> - The before-and-after change in `user_seeks` and `user_scans` from `sys.dm_db_index_usage_stats` used to show which access pattern a test query chose.
> - It matters because this note uses empirical DMV evidence instead of only verbal claims about what the optimizer “should” do.
>
> > [!info] Evidence of choice, not evidence of full cost
> >
> > Counter deltas show which operator family SQL Server used. They do not replace `STATISTICS IO`, timing, or full plan inspection when deeper cost analysis is required.

## What SARGable Means

The term **SARGable** is short for "Search ARGument able". It dates to early relational database literature and describes a predicate of the form `column operator expression` where the expression does **not** reference the column. That shape is the only form SQL Server's query optimizer can transform into an index seek. Any predicate that wraps the column in a function, passes it through arithmetic, or forces an implicit conversion on the column side fails this rule and degrades to an index scan.

### The Search ARGument rule

A predicate is SARGable when **all three** of these conditions hold:

1. The indexed column appears on one side of the comparison operator.
2. That side is not wrapped in a function, expression, or cast.
3. The other side can be resolved to a constant, parameter, or computed value at compile time without referencing the column.

When any condition fails, SQL Server cannot use the index's sort order to narrow the scan — it has to read every row, apply the expression, and filter the result.

### Measuring SARGability with sys.dm_db_index_usage_stats

Every demo in this note uses the same measurement technique: snapshot the `user_seeks` and `user_scans` counters for the target table's indexes before the test query, run the query, then read the counters again and return the delta. The DMV increments `user_seeks` once per seek-operator invocation and `user_scans` once per scan-operator invocation, regardless of how many rows were returned.

*Snapshot the NC index and clustered index counters, run a pure seek query, and return the delta.*

```sql
DECLARE @nc_seeks0 bigint, @nc_scans0 bigint, @cx_seeks0 bigint, @cx_scans0 bigint;
SELECT
    @nc_seeks0 = ISNULL(SUM(CASE WHEN index_id = 2 THEN user_seeks END), 0),
    @nc_scans0 = ISNULL(SUM(CASE WHEN index_id = 2 THEN user_scans END), 0),
    @cx_seeks0 = ISNULL(SUM(CASE WHEN index_id = 1 THEN user_seeks END), 0),
    @cx_scans0 = ISNULL(SUM(CASE WHEN index_id = 1 THEN user_scans END), 0)
FROM sys.dm_db_index_usage_stats
WHERE object_id = OBJECT_ID('dbo.demo_idxmaint_rowstore');

DECLARE @rc int = (SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore WHERE symbol = 'ASML.AS');

SELECT
    @rc AS row_count,
    ISNULL((SELECT SUM(CASE WHEN index_id = 2 THEN user_seeks END) FROM sys.dm_db_index_usage_stats WHERE object_id = OBJECT_ID('dbo.demo_idxmaint_rowstore')), 0) - @nc_seeks0 AS nc_seeks,
    ISNULL((SELECT SUM(CASE WHEN index_id = 2 THEN user_scans END) FROM sys.dm_db_index_usage_stats WHERE object_id = OBJECT_ID('dbo.demo_idxmaint_rowstore')), 0) - @nc_scans0 AS nc_scans,
    ISNULL((SELECT SUM(CASE WHEN index_id = 1 THEN user_seeks END) FROM sys.dm_db_index_usage_stats WHERE object_id = OBJECT_ID('dbo.demo_idxmaint_rowstore')), 0) - @cx_seeks0 AS cx_seeks,
    ISNULL((SELECT SUM(CASE WHEN index_id = 1 THEN user_scans END) FROM sys.dm_db_index_usage_stats WHERE object_id = OBJECT_ID('dbo.demo_idxmaint_rowstore')), 0) - @cx_scans0 AS cx_scans;
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 13470 | 1 | 0 | 0 | 0 |

The test query `WHERE symbol = 'ASML.AS'` returned 13,470 rows. The delta shows `nc_seeks = 1, nc_scans = 0` on the nonclustered index (index_id 2) and zero activity on the clustered index (index_id 1). This is the canonical SARGable signature: a single seek operator on the left-most key column returns the matching rows without touching the heap or the clustered index. Every subsequent demo in this note uses the same wrapper — rendered for brevity as just the test predicate and its `(row_count, nc_seeks, nc_scans, cx_seeks, cx_scans)` output row.

### Interpreting the seek and scan counters

The `user_seeks` and `user_scans` counters answer the question "did the optimizer pick a seek or a scan?" but they do **not** directly measure rows read or CPU. A seek can be efficient (point lookup returning 1 row) or wasteful (range seek returning 90% of the table with a residual filter). A scan is almost always wasteful on a large table, except when the query legitimately needs most of the rows. For this note, interpret the counters as binary evidence of the optimizer's choice, and pair them with the returned `row_count` to judge whether the choice was appropriate.

> [!warning] A "seek" is not always efficient
>
> Modern SQL Server's `user_seeks` counter increments any time the optimizer chose a Seek operator, including range seeks with residual predicates that end up reading most of the index. The later demo for the `<>` operator (Section 8) shows a seek counter of 1 but returns 658,080 out of 671,550 rows — effectively a full scan dressed as a seek. Use the counter as a decision indicator, not as a cost metric. Pair it with `SET STATISTICS IO ON` and `SET STATISTICS TIME ON` (covered in [[13-execution-plans]]) when you need actual cost numbers.

### When SARGability actually matters

SARGability only matters when an index exists on the column being filtered. Without an index, every query scans regardless of how the predicate is written. Before debugging SARGability, verify the column is indexed via `sys.indexes` + `sys.index_columns`.

### Target table indexes used throughout this note

*Inspect the indexes on `dbo.demo_idxmaint_rowstore` so every subsequent demo has a known index layout to reason against.*

```sql
SELECT
    i.name AS index_name,
    i.type_desc,
    COL_NAME(ic.object_id, ic.column_id) AS col,
    ic.key_ordinal,
    ic.is_included_column
FROM sys.indexes i
JOIN sys.index_columns ic
  ON ic.object_id = i.object_id AND ic.index_id = i.index_id
WHERE i.object_id = OBJECT_ID('dbo.demo_idxmaint_rowstore')
ORDER BY i.index_id, ic.key_ordinal;
```

| index_name | type_desc | col | key_ordinal | is_included_column |
|---|---|---|---|---|
| CIX_demo_idxmaint_row_guid | CLUSTERED | row_guid | 1 | False |
| IX_demo_idxmaint_symbol_date | NONCLUSTERED | close | 0 | True |
| IX_demo_idxmaint_symbol_date | NONCLUSTERED | volume | 0 | True |
| IX_demo_idxmaint_symbol_date | NONCLUSTERED | symbol | 1 | False |
| IX_demo_idxmaint_symbol_date | NONCLUSTERED | date | 2 | False |
| IX_demo_idxmaint_symbol_date | NONCLUSTERED | batch_no | 3 | False |

Two indexes exist. The clustered index (`CIX_demo_idxmaint_row_guid`, `index_id = 1`) is keyed on a `uniqueidentifier` — essentially random — so clustered seeks are never efficient here. The nonclustered `IX_demo_idxmaint_symbol_date` (`index_id = 2`) has three key columns in order (`symbol`, `date`, `batch_no`) and two include columns (`close`, `volume`). The key order matters enormously: predicates on `symbol` can seek, predicates on `(symbol, date)` can seek deeper, and — as the next section demonstrates — predicates on `date` **alone** cannot use this index at all.

### SARGable operators reference

| Operator | SARGable on indexed column? | Notes |
|---|---|---|
| `=` | Yes | Single-point or range-start seek |
| `>`, `>=`, `<`, `<=` | Yes | Range seek from the boundary |
| `BETWEEN a AND b` | Yes | Equivalent to `>= a AND <= b` — closed range |
| `IN (list)` | Yes | Multi-point seek if list is small; may convert to scan for very long lists |
| `IS NULL`, `IS NOT NULL` | Yes | With an index supporting null keys |
| `LIKE 'prefix%'` | Yes | Prefix-only; see [[07-string-functions-and-pattern-matching]] |
| `LIKE '%contains%'` | **No** | Leading wildcard cannot seek |
| `<>`, `!=`, `NOT =` | Marginally | May report as seek but effectively scans most of the index |
| `OR` across same column | Yes | Usually rewritten to `IN` |
| `OR` across different columns | **No** | Forces scan |
| `EXISTS (correlated subquery)` | Inherited | SARGability depends on the subquery's predicates |
| `NOT IN (non-null list)` | Yes | Becomes a range seek with exclusions |
| `NOT IN (subquery with NULL)` | **No** (and **incorrect**) | Semantic trap; see Section 8 |

## Composite Index Left-Prefix Rule

When an index has more than one key column, the optimizer can only seek by them in left-to-right order. A predicate on the leftmost key alone can seek. A predicate on the leftmost key plus the next key can seek deeper. A predicate on the second or third key alone **cannot seek** — the optimizer must either scan the index or pick a different index. This is the most commonly misunderstood rule in SARGability because the column **looks** indexed in `sys.indexes`, yet a predicate on it still scans.

### Seeking the leftmost key

The first position in the composite index `(symbol, date, batch_no)` is `symbol`. Any predicate that constrains `symbol` can use the index as a seek starting point.

### symbol alone seeks via the leftmost key

*Filter on symbol, the leftmost key of IX_demo_idxmaint_symbol_date.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore WHERE symbol = 'ASML.AS';
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 13470 | 1 | 0 | 0 | 0 |

A single seek returns 13,470 rows out of 671,550 (about 2% of the table) in one index operator. The optimizer navigates directly to the first `ASML.AS` key and streams out every row with that symbol value.

### symbol + date seeks deeper into the composite

*Add a date-range predicate, keeping symbol as the leftmost anchor.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore
WHERE symbol = 'ASML.AS' AND [date] >= '2025-01-01' AND [date] < '2026-01-01';
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 2550 | 1 | 0 | 0 | 0 |

Adding the date range narrows the result from 13,470 to 2,550 rows and the query is still one seek. The optimizer seeks to `('ASML.AS', '2025-01-01')` and streams forward until the date exceeds `2026-01-01`. This is an ideal SARGable query: both conditions ride the composite key order.

### Full composite point lookup

*Constrain all three key columns for a single-row seek.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore
WHERE symbol = 'ASML.AS' AND [date] = '2025-06-16' AND batch_no = 5;
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 1 | 1 | 0 | 0 | 0 |

A single-row point lookup — the cheapest query possible against this index. Filling in every key column from leftmost to rightmost is the SARGable ideal.

### Skipping the leftmost key forces a scan

The reverse case — a predicate on a non-leftmost key with no constraint on the columns to its left — cannot use this index as a seek. The optimizer either scans the whole index or scans a different one.

### date alone cannot seek

> [!warning] Date-only predicates scan an index that starts with symbol
>
> Even though `date` is a key column of `IX_demo_idxmaint_symbol_date`, filtering only on `date` forces a scan. The index is sorted primarily by `symbol`, so the `date = X` rows for different symbols are scattered across the entire index in non-contiguous locations. There is no seek entry point without a `symbol` value.

*Filter on date only.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore
WHERE [date] >= '2025-01-01' AND [date] < '2026-01-01';
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 126980 | 0 | 1 | 0 | 0 |

The query returned 126,980 rows (about 19% of the table) via a full scan of the NC index. The date-range predicate was applied as a residual filter after the scan read every row. The returned row count is identical to the seek version with `symbol = 'ASML.AS'` added — the difference is the access method.

> [!success] Add a leading-column predicate, or add a separate index starting on date
>
> Two fixes exist. Either add a `symbol` (or any leading-key) predicate so the query becomes left-prefix compatible, or create a second nonclustered index starting with `date` as the leftmost key. The second option is the right choice when date-only queries are frequent and the extra index's maintenance cost is justified.

### batch_no alone cannot seek

*Filter on batch_no, the rightmost key.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore WHERE batch_no = 5;
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 67155 | 0 | 1 | 0 | 0 |

Same result: a full NC index scan. The rightmost key column is the worst case for left-prefix seekability — it has both the leading-column constraints and the middle-column constraints unsatisfied. A predicate on `batch_no` alone can only seek if `batch_no` is the leftmost key of some other index.

### Composite index left-prefix reference

| Predicate shape | Can seek `(symbol, date, batch_no)`? | Reason |
|---|---|---|
| `symbol = X` | Yes | Leftmost key exact match |
| `symbol LIKE 'X%'` | Yes | Leftmost prefix range seek |
| `symbol = X AND date = Y` | Yes | Two-column left-prefix seek |
| `symbol = X AND date >= Y AND date < Z` | Yes | Second-column range seek inside a first-column equality |
| `symbol = X AND date = Y AND batch_no = Z` | Yes | Three-column point lookup |
| `symbol = X AND batch_no = Z` | Partial | Seeks on symbol, residual-filters batch_no |
| `date = Y` | **No** | Non-leftmost key; no seek entry point |
| `batch_no = Z` | **No** | Non-leftmost key; no seek entry point |
| `date = Y AND batch_no = Z` | **No** | Neither column is the leftmost key |

## Functions on Indexed Columns

Wrapping an indexed column in any function — `LEFT`, `SUBSTRING`, `UPPER`, `TRIM`, `CAST`, `YEAR`, `DATEADD`, even a no-op `+ 0` — converts the predicate into an expression that the optimizer cannot invert at seek time. The column value has to be read and the function has to be evaluated on each row. The fix is always the same shape: rewrite the predicate so the column is bare on one side and the function (if any) acts on the literal or parameter on the other side.

### String functions on indexed columns

SARGability rewrites for string functions are mostly documented in [[07-string-functions-and-pattern-matching]]. This section covers the core rewrites again from the SARGability measurement angle, with empirical seek/scan evidence.

### LEFT on an indexed column scans

> [!warning] LEFT(col, n) = 'prefix' forces a scan
>
> `LEFT(symbol, 3)` wraps the indexed column in a function. SQL Server cannot map the result back to a key-range on `symbol` without evaluating the expression on every row.

*Filter by the first three characters of symbol using `LEFT`.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore WHERE LEFT(symbol, 3) = 'ASM';
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 13470 | 0 | 1 | 0 | 0 |

The result is identical to the `symbol = 'ASML.AS'` demo (13,470 rows — only ASML.AS starts with `ASM` in this dataset) but the access path is a full NC index scan instead of a seek.

> [!success] Rewrite as a prefix LIKE
>
> `col LIKE 'prefix%'` is the canonical SARGable prefix-search form. The optimizer maps it to a key range `['prefix', 'prefiq')` and seeks directly.

*Rewrite with `LIKE 'prefix%'`.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore WHERE symbol LIKE 'ASM%';
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 13470 | 1 | 0 | 0 | 0 |

Identical result set, but `nc_seeks = 1, nc_scans = 0`. This is the highest-leverage string SARGability rewrite: a two-character change from `LEFT(col, n) = 'x'` to `col LIKE 'x%'` flips a scan into a seek.

### SUBSTRING has no direct rewrite

*Filter on the first three characters using `SUBSTRING`.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore WHERE SUBSTRING(symbol, 1, 3) = 'ASM';
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 13470 | 0 | 1 | 0 | 0 |

When `SUBSTRING` starts at position 1, it behaves like `LEFT` — rewrite as `LIKE 'prefix%'`. When `SUBSTRING` starts at a non-leading position (for example extracting characters 3-5), no prefix-LIKE rewrite is possible; the column needs a computed-column index on the expression (see Section 11).

### RIGHT on an indexed column cannot be rewritten

> [!warning] Suffix searches cannot be SARGable without a dedicated index
>
> `RIGHT(col, n)` extracts the tail of the string. No `LIKE` pattern can express a suffix efficiently because `LIKE '%.AS'` has a leading wildcard, which is always non-SARGable. The only fix is a computed column holding `RIGHT(col, n)` indexed separately.

*Filter on the last two characters of symbol.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore WHERE RIGHT(symbol, 2) = 'AS';
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 80820 | 0 | 1 | 0 | 0 |

The query scanned the full NC index and returned 80,820 rows (roughly 12% of the table — all symbols ending in `.AS`, the Euronext Amsterdam suffix). There is no single-query rewrite that seeks; the escape hatch is the computed-column pattern in Section 11.

### UPPER on a case-insensitive column is redundant and scans

> [!warning] UPPER/LOWER in predicates is double damage
>
> Under a case-insensitive collation (the `stoxx` database default), `WHERE UPPER(col) = 'X'` is functionally **redundant** — `col = 'X'` already matches all casings. Wrapping the column in `UPPER` adds no correctness benefit and removes the seek.

*Redundant UPPER wrapper.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore WHERE UPPER(symbol) = 'ASML.AS';
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 13470 | 0 | 1 | 0 | 0 |

> [!success] Remove the wrapper entirely
>
> Rely on the collation's case-insensitivity. The equality comparison matches `Apple`, `APPLE`, `apple`, and `aPpLe` natively under `SQL_Latin1_General_CP1_CI_AS`.

*Plain equality, same result, seek.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore WHERE symbol = 'ASML.AS';
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 13470 | 1 | 0 | 0 | 0 |

### Defensive concatenation `col + ''` also scans

> [!warning] col + '' is a silent SARGability killer
>
> Some codebases append an empty string to defensively coerce a value for display. On the column side of a predicate this is a function wrapper like any other, and it forces a scan.

*Concatenate empty string onto symbol in the predicate.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore WHERE symbol + '' = 'ASML.AS';
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 13470 | 0 | 1 | 0 | 0 |

Same row count, full scan. The only fix is to delete the `+ ''` entirely. Defensive coercions belong in the projection (`SELECT col + '' AS display`), never in the predicate.

### LIKE pattern families

`LIKE` is the only pattern-matching operator that can sometimes seek. Its SARGability depends entirely on what the pattern looks like at its left edge.

### Leading-wildcard LIKE scans

*Contains pattern.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore WHERE symbol LIKE '%ASM%';
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 13470 | 0 | 1 | 0 | 0 |

*Suffix pattern.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore WHERE symbol LIKE '%AS';
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 80820 | 0 | 1 | 0 | 0 |

Both patterns start with `%`, so both scan. Same row counts as the `%ASM%` and `RIGHT(symbol, 2) = 'AS'` demos above — proving semantic equivalence.

### Character-class prefix still seeks

*Pattern starts with a character class, not a wildcard.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore WHERE symbol LIKE '[A-C]%';
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 215150 | 1 | 0 | 0 | 0 |

A character class at position 1 is still a bounded set, so the optimizer can seek across the ranges `['A', 'B')`, `['B', 'C')`, and `['C', 'D')`. The DMV shows `nc_seeks = 1` even though the query returned 32% of the table. The seek operator walked three key ranges end-to-end.

### String-function SARGability reference

| Anti-pattern | Rewrite | Notes |
|---|---|---|
| `LEFT(col, n) = 'x'` | `col LIKE 'x%'` | Canonical prefix rewrite |
| `SUBSTRING(col, 1, n) = 'x'` | `col LIKE 'x%'` | Only if start = 1 |
| `SUBSTRING(col, k, n) = 'x'` for `k > 1` | **Computed column + index** | No direct rewrite |
| `RIGHT(col, n) = 'x'` | **Computed column + index** | Or store a reversed copy |
| `UPPER(col) = 'X'` / `LOWER(col) = 'x'` | `col = 'X'` (assuming CI collation) | Drop the wrapper entirely |
| `TRIM(col) = 'x'` | Clean data at ingest; query raw | See [[07-string-functions-and-pattern-matching]] |
| `col + '' = 'x'` | `col = 'x'` | Remove the concatenation |
| `CHARINDEX(substr, col) > 0` | `col LIKE '%substr%'` (still non-SARGable but clearer) | No SARGable form exists |
| `col LIKE '%x%'` / `'%x'` | **Full-text index** | Leading-wildcard cannot seek |

### Date functions on indexed columns

The SARGability rules for date functions mirror the string rules: wrapping a date column in `YEAR`, `MONTH`, `DATEDIFF`, or `CAST(... AS date)` forces a scan, while half-open range predicates on the raw column can seek.

> [!info] Date functions and the composite-index left-prefix rule interact
>
> In the `stoxx` demo table, `date` is the **second** key column of `IX_demo_idxmaint_symbol_date`. Every date-only predicate in this section scans regardless of whether it is SARGable in isolation, because the leftmost key (`symbol`) is unconstrained. To isolate the function-on-column effect, pair each date predicate with a `symbol = 'ASML.AS'` anchor — that restores the left-prefix seekability so the function wrapping becomes the only remaining SARGability question.

### YEAR(date) = 2025 scans

> [!warning] YEAR() on a date column is always non-SARGable
>
> `YEAR(col) = 2025` looks like a constant-time expression, but the optimizer cannot rewrite it into a range predicate automatically — it must evaluate `YEAR()` on every row.

*Anti-pattern: wrap the date column in YEAR.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore WHERE YEAR([date]) = 2025;
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 126980 | 0 | 1 | 0 | 0 |

> [!success] Rewrite as a half-open date range anchored on the leftmost key
>
> Convert `YEAR(col) = 2025` to `col >= '2025-01-01' AND col < '2026-01-01'`, and add the leftmost-key anchor so the composite index can seek the whole predicate.

*SARGable rewrite with symbol anchor.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore
WHERE symbol = 'ASML.AS' AND [date] >= '2025-01-01' AND [date] < '2026-01-01';
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 2550 | 1 | 0 | 0 | 0 |

A single seek returns 2,550 rows for ASML.AS in 2025. The rewrite carries two compounding wins: it removes the `YEAR` wrapper **and** uses the leftmost key. Together they turn a 126,980-row scan into a 2,550-row seek.

### MONTH(date) = 1 also scans

*Filter on the month of the year.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore WHERE MONTH([date]) = 1;
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 63950 | 0 | 1 | 0 | 0 |

`MONTH(date) = 1` is harder to rewrite than `YEAR` because "January of any year" spans many discrete ranges: `[2018-01-01, 2018-02-01)`, `[2019-01-01, 2019-02-01)`, etc. The SARGable rewrite is either a computed column on `MONTH(date)` with an index, or an `OR`-of-ranges if the year set is small. See Section 11 for the computed-column escape hatch.

### DATEDIFF rolling windows

> [!warning] DATEDIFF(DAY, col, now) forces the function to evaluate per row
>
> `DATEDIFF(DAY, col, SYSUTCDATETIME()) <= 30` wraps the column in `DATEDIFF`. Even though the second argument is `SYSUTCDATETIME()` (constant per query), the first argument is the column, which makes the whole expression a function on the column.

*Anti-pattern: DATEDIFF from column to now.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore
WHERE DATEDIFF(DAY, [date], '2026-04-01') <= 30;
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 12500 | 0 | 1 | 0 | 0 |

> [!success] Move DATEADD to the literal side
>
> Rewrite `DATEDIFF(DAY, col, ref) <= n` as `col >= DATEADD(DAY, -n, ref)`. The column becomes bare; the `DATEADD` arithmetic is a constant that the optimizer folds at compile time.

*Rewrite with DATEADD on the literal side, anchored on symbol for a real seek.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore
WHERE symbol = 'ASML.AS' AND [date] >= DATEADD(DAY, -30, '2026-04-01');
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 250 | 1 | 0 | 0 | 0 |

The rewrite seeks — `nc_seeks = 1`. Without the `symbol` anchor the rewritten predicate would still scan (date is non-leftmost), but the function-on-column fix is still worth making because it's a prerequisite: the leftmost-anchor fix only works on a bare column.

### BETWEEN vs half-open range

`BETWEEN a AND b` is equivalent to `col >= a AND col <= b` — a **closed** range on both ends. For `date`-only columns (where the value is whole-day only), `BETWEEN '2025-01-01' AND '2025-12-31'` covers all of 2025 correctly. For `datetime` or `datetime2` columns, the same pattern **silently drops rows** on December 31 after midnight because `'2025-12-31'` is interpreted as `'2025-12-31 00:00:00.000'`.

### Closed BETWEEN silently drops end-of-day rows on datetime columns

> [!failure] BETWEEN '2025-01-01' AND '2025-12-31' misses most of Dec 31 on datetime columns
>
> A `datetime2` value like `'2025-12-31 14:30:00'` is greater than `'2025-12-31 00:00:00'`, so it falls **outside** the closed range. Any query that uses `BETWEEN` with whole-day boundaries against a sub-day-precision column silently undercounts on the last day.

*Closed BETWEEN against a date-only column (the stoxx `date` column has day precision, so this is safe here — but the pattern is dangerous by default).*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore
WHERE symbol = 'ASML.AS' AND [date] BETWEEN '2025-01-01' AND '2025-12-31';
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 2550 | 1 | 0 | 0 | 0 |

> [!success] Use half-open range with strict upper bound
>
> Write `col >= 'start' AND col < 'end'` where `'end'` is the first moment of the day **after** the period ends. This is correct for `date`, `datetime`, and `datetime2` without any modification and conveys intent unambiguously.

### Half-open range covers every row correctly

*Half-open range covering all of 2025.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore
WHERE symbol = 'ASML.AS' AND [date] >= '2025-01-01' AND [date] < '2026-01-01';
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 2550 | 1 | 0 | 0 | 0 |

Same 2,550 rows, same single seek. On the `date` column both are correct; on a `datetime2` column the half-open version is the only one that always returns the right answer. **Default to half-open ranges** — they are always correct, always SARGable, and always self-documenting.

### Date-function SARGability reference

| Anti-pattern | Rewrite | Notes |
|---|---|---|
| `YEAR(col) = Y` | `col >= 'Y-01-01' AND col < 'Y+1-01-01'` | Half-open year range |
| `MONTH(col) = M` | Computed column `MONTH(col)` + index | No direct rewrite across years |
| `DAY(col) = D` | Computed column `DAY(col)` + index | No direct rewrite |
| `CAST(col AS date) = @d` | `col >= @d AND col < DATEADD(DAY, 1, @d)` | Removes datetime → date cast |
| `DATEDIFF(DAY, col, ref) <= n` | `col >= DATEADD(DAY, -n, ref)` | Move DATEADD to the literal side |
| `DATEADD(DAY, n, col) >= ref` | `col >= DATEADD(DAY, -n, ref)` | Subtract the offset, not add |
| `col BETWEEN a AND b` (datetime col) | `col >= a AND col < end_plus_one` | Half-open eliminates end-of-day trap |

## Arithmetic and Expression Predicates

Arithmetic on a column — `col * 1.2`, `col + 0`, `col - offset` — is a function wrapper just like `UPPER` or `LEFT`. The optimizer cannot invert arithmetic at seek time; it must read the row, evaluate the expression, and filter. The rewrite pattern is always the same: move the arithmetic to the literal/parameter side so the column stays bare.

### Move math to the literal side

### close * 1.2 > 100 scans

> [!warning] Arithmetic on the column side prevents seeks
>
> `close * 1.2 > 100` wraps the column. Even if the expression is algebraically trivial (divide both sides by 1.2), the optimizer does not perform this rewrite automatically.

*Anti-pattern: multiply column by a constant.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore WHERE [close] * 1.2 > 100;
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 317340 | 0 | 1 | 0 | 0 |

> [!success] Rewrite algebraically so the column is bare
>
> Divide both sides: `close > 100 / 1.2`. The right-hand side is a compile-time constant and the column is the bare left-hand side.

*Move the constant to the right side.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore WHERE [close] > 100 / 1.2;
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 317340 | 0 | 1 | 0 | 0 |

Both versions return 317,340 rows, but **both scan** — the rewrite is correct in principle, but in this specific table `close` is an **include column** of `IX_demo_idxmaint_symbol_date`, not a key column. Include columns provide data for covering queries but cannot drive a seek. The rewrite is still worth doing because it is a prerequisite: if an index were created on `close` in the future, only the bare-column form would benefit from it.

### No-op arithmetic still kills seeks

Even "do-nothing" arithmetic like `col + 0` or `col * 1` wraps the column in an expression the optimizer cannot invert.

### batch_no + 0 still scans

*No-op addition.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore WHERE batch_no + 0 = 5;
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 67155 | 0 | 1 | 0 | 0 |

### Plain batch_no = 5 also scans (non-leftmost key)

*Same predicate without the `+ 0`.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore WHERE batch_no = 5;
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 67155 | 0 | 1 | 0 | 0 |

Both versions scan — but for different reasons. The `+ 0` version scans because of the function wrapper. The plain version scans because `batch_no` is the third key column of the composite index, not the leftmost. This demonstrates an important principle: **SARGability is necessary but not sufficient**. A bare column predicate is still a scan if no index supports the key order.

### ISNULL vs COALESCE: an optimizer-rewrite asymmetry

This is one of the most subtle and least-documented SARGability findings on SQL Server 2022: **`ISNULL(col, default) = value` is rewritten to a seek** when the optimizer can prove that the `default` cannot match `value`, but **`COALESCE(col, default) = value` is not rewritten** in the same way, even when the same proof is available.

### ISNULL seeks when the fallback is unreachable

*`ISNULL(symbol, '')` against a non-empty target value.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore WHERE ISNULL(symbol, '') = 'ASML.AS';
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 13470 | 1 | 0 | 0 | 0 |

The optimizer rewrites `ISNULL(symbol, '') = 'ASML.AS'` to effectively `symbol = 'ASML.AS'` because `'' = 'ASML.AS'` is false, so the `NULL` branch can never match. The seek counter increments — **a function-wrapped column still seeks** on SQL Server 2022 in this specific case.

### COALESCE does not get rewritten

> [!warning] COALESCE and ISNULL are not interchangeable for SARGability
>
> `COALESCE` is an ANSI-standard synonym for `CASE WHEN col IS NOT NULL THEN col ELSE default END`. The `CASE` wrapping prevents the same rewrite path that the simpler `ISNULL` enjoys. Result: identical semantics, different access method.

*COALESCE with the same unreachable fallback.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore WHERE COALESCE(symbol, '') = 'ASML.AS';
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 13470 | 0 | 1 | 0 | 0 |

Identical row count, identical semantic meaning — **different access method**. `COALESCE` scans, `ISNULL` seeks. For performance-critical predicates, prefer `ISNULL` when the column is of a single type. For portable ANSI code or when you need more than two arguments, use `COALESCE` but accept the scan and plan an index design that compensates.

> [!success] Rewrite as null-safe OR or split with UNION ALL
>
> The fully-portable SARGable rewrite is to handle the null-branch explicitly: `WHERE col = value OR (col IS NULL AND default = value)`. The optimizer can push `col = value` through an index seek and evaluate the null-branch separately.

*Null-safe OR rewrite.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore
WHERE symbol = 'ASML.AS' OR (symbol IS NULL AND '' = 'ASML.AS');
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 13470 | 1 | 0 | 0 | 0 |

Same row count, seek back. The rewrite is slightly more verbose but portable across SQL Server versions and ANSI-compatible.

## Inequality and NOT Predicates

Inequality operators (`<>`, `!=`, `NOT =`) and the negated predicate `NOT col = X` are the worst category for SARGability. The optimizer may technically pick a Seek operator for them, but the seek walks the entire index minus a narrow excluded range — effectively a scan with extra steps.

### <> and NOT = report as seeks but read most of the index

> [!warning] <> is a "seek" in name only
>
> `WHERE col <> X` is converted into two range seeks: `col < X` and `col > X`. The DMV increments `user_seeks = 1` because a seek operator was used, but the combined range covers everything except the single value `X`. On a large table this is as expensive as a full scan.

### <> inequality on the leftmost key

*Inequality on the leftmost key.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore WHERE symbol <> 'ASML.AS';
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 658080 | 1 | 0 | 0 | 0 |

`nc_seeks = 1` but the result is 658,080 out of 671,550 rows (98% of the table). The "seek" read nearly everything.

### NOT = behaves identically to <>

*NOT = on the same column.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore WHERE NOT symbol = 'ASML.AS';
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 658080 | 1 | 0 | 0 | 0 |

Identical behavior: `NOT col = value` is optimized into the same pair of range seeks as `col <> value`. Neither form is "SARGable" in the practical sense. The fix is to redesign the query — most `<>` predicates are filtering out a small known set of values and can be rewritten as `col IN (small set)` on a different column, or the filter can be moved to a different query entirely.

## Implicit Conversions

Implicit conversions silently kill seeks by applying the conversion to the **column** side of the predicate instead of the parameter/literal side. This happens whenever the parameter has **higher type precedence** than the column. The `nvarchar` vs `varchar` case is by far the most common in real codebases — ORMs and application frameworks often default to `nvarchar` parameters because strings in .NET and Java are Unicode by default.

Full type-precedence rules live in [[02-data-types-conversion-and-null-handling]]. The SARGability-relevant slice: `nvarchar` > `varchar`, `numeric` > `int`, `datetime2` > `datetime`, `float` > `decimal`.

### The nvarchar parameter vs varchar column trap

> [!danger] ORM frameworks default to nvarchar parameters and silently scan
>
> Every .NET `SqlParameter` with type `string` uses `NVARCHAR` by default. When that parameter is compared against a `varchar` column, SQL Server applies `CONVERT_IMPLICIT(nvarchar, col)` to the column side — converting every row's value at read time — which makes the query non-SARGable. This is the single most common SARGability bug in production systems using Entity Framework or similar.

### nvarchar parameter against varchar column scans

*nvarchar parameter against a varchar column — scans.*

```sql
DECLARE @p nvarchar(20) = N'ASML.AS';
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore WHERE symbol = @p;
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 13470 | 0 | 1 | 0 | 0 |

> [!success] Match the parameter type to the column type
>
> Declare the parameter as `varchar(20)` to match the column. No conversion is needed on either side and the seek happens.

### Matched varchar parameter seeks

*Matched varchar parameter — seeks.*

```sql
DECLARE @p varchar(20) = 'ASML.AS';
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore WHERE symbol = @p;
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 13470 | 1 | 0 | 0 | 0 |

Identical row count, different access method. For .NET callers the fix is to explicitly set `SqlParameter.SqlDbType = SqlDbType.VarChar`, not `NVarChar`. For ORMs, consult the mapping configuration — EF Core supports `HasColumnType("varchar(20)")` on string properties.

### CAST on the column side is always wrong

> [!warning] CAST(col AS otherType) always scans
>
> An explicit `CAST` on the column is the explicit version of the implicit-conversion trap. It wraps the column in a function and forces per-row evaluation. The fix is either to drop the cast if the types are compatible or to move the cast to the parameter side.

### Explicit CAST of the column scans

*Explicit CAST of the column.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore WHERE CAST(symbol AS nvarchar(20)) = N'ASML.AS';
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 13470 | 0 | 1 | 0 | 0 |

> [!success] Move the cast to the literal side
>
> `symbol = CAST(N'ASML.AS' AS varchar(20))` leaves the column bare and casts the constant at compile time.

### CAST on the literal side seeks

*CAST the literal.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore WHERE symbol = CAST(N'ASML.AS' AS varchar(20));
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 13470 | 1 | 0 | 0 | 0 |

Matched behavior — the literal-side cast happens once at compile time, the column stays indexable, the seek succeeds.

### Implicit conversion reference

| Pattern | Conversion direction | SARGable? |
|---|---|---|
| `varchar_col = 'literal'` | None | Yes |
| `varchar_col = N'literal'` | Column → nvarchar | **No** |
| `varchar_col = @nvarchar_param` | Column → nvarchar | **No** |
| `varchar_col = @varchar_param` | None | Yes |
| `int_col = '123'` | Literal → int | Yes |
| `varchar_col = 123` | Column → int | **No** (may also fail) |
| `datetime_col = @date_param` | Param → datetime | Yes |
| `date_col = @datetime_param` | Column → datetime | **No** |
| `CAST(col AS type) = val` | Column wrapped | **No** |
| `col = CAST(val AS coltype)` | Literal wrapped | Yes |

See [[02-data-types-conversion-and-null-handling]] for the full type-precedence table and implicit-conversion rules. Check execution plans for the yellow warning triangle labeled "Type conversion in expression ... may affect CardinalityEstimate in query plan choice" — that warning is the optimizer telling you a SARGability-killing implicit conversion happened.

## OR, IN, EXISTS, and Catch-All Predicates

Multi-value and multi-column predicates introduce SARGability variations that depend on whether the values target the **same** indexed column or different columns, whether the list is short enough to drive multi-point seeks, and — for catch-all parameter patterns — whether the optimizer can simplify the predicate at compile time.

### IN and OR on the same column

Short `IN` lists are optimized into multi-point seeks. An `OR` chain on the same column is semantically equivalent to `IN` and gets the same treatment.

### Short IN list seeks

*IN with four values, each of which matches the leftmost key.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore
WHERE symbol IN ('ASML.AS', 'SAP.DE', 'MC.PA', 'OR.PA');
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 53810 | 1 | 0 | 0 | 0 |

A single seek operator returns 53,810 rows across the four symbol groups. The optimizer converts the `IN` list to a multi-point seek, visiting each value independently and streaming the matching rows out.

### OR chain on the same column is equivalent

*Same predicate as an OR chain.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore
WHERE symbol = 'ASML.AS' OR symbol = 'SAP.DE' OR symbol = 'MC.PA' OR symbol = 'OR.PA';
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 53810 | 1 | 0 | 0 | 0 |

Identical row count, identical seek. Use `IN` for readability — the optimizer treats them the same.

### OR across different columns scans

When an `OR` predicate references **different** columns, the optimizer cannot merge the ranges into a single seek because the two branches target different index key orders. One branch might seek a symbol-based index; the other branch might seek a different index; combining them usually forces a scan.

> [!warning] OR across different columns defeats the seek
>
> `symbol = 'ASML.AS' OR batch_no = 99` asks the optimizer to combine results from two different index access paths. Unless both columns are indexed and the row overlap is small, the optimizer picks a full scan.

### symbol OR batch_no scans

*OR across two different columns.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore
WHERE symbol = 'ASML.AS' OR batch_no = 99;
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 13470 | 0 | 1 | 0 | 0 |

> [!success] Split into two SELECTs unioned with UNION ALL
>
> The SARGable rewrite is `SELECT ... WHERE symbol = 'ASML.AS' UNION ALL SELECT ... WHERE batch_no = 99 AND symbol <> 'ASML.AS'`. Each branch is a clean SARGable predicate, and `UNION ALL` combines them without deduplication overhead. The second branch's extra `<> 'ASML.AS'` predicate prevents double-counting rows that match both conditions.

### NOT IN correctness trap

`NOT IN` is semantically equivalent to a series of `<>` comparisons chained with `AND`. This has two problems: the `<>` pattern is barely SARGable (Section 7), and `NOT IN` with a subquery that **might** return `NULL` produces **incorrect** results.

> [!danger] NOT IN with a NULL in the list returns zero rows
>
> Under three-valued logic, `x NOT IN (a, b, NULL)` evaluates to `x <> a AND x <> b AND x <> NULL`. The last comparison returns `UNKNOWN`, which propagates through the `AND` and makes the whole expression `UNKNOWN` — so no row ever matches. A subquery that could return even one `NULL` value turns the entire `NOT IN` into an empty result set.

### NOT IN with a non-null list

*Non-null NOT IN works correctly.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore WHERE symbol NOT IN ('ASML.AS', 'SAP.DE');
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 644680 | 1 | 0 | 0 | 0 |

The DMV reports a seek (1, 0) but the row count (644,680 out of 671,550 — 96%) reveals that the "seek" walked almost the entire index. Same pattern as `<>`.

> [!success] Use NOT EXISTS for subquery exclusion
>
> Replace `col NOT IN (SELECT ...)` with `NOT EXISTS (SELECT 1 FROM ... WHERE sub.col = outer.col)`. `NOT EXISTS` is null-safe by design: a `NULL` in the subquery does not poison the outer result. The SARGability is comparable and the correctness is guaranteed.

### NOT EXISTS is the null-safe rewrite

*NOT EXISTS using a VALUES subquery.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore
WHERE NOT EXISTS (SELECT 1 FROM (VALUES ('ASML.AS'), ('SAP.DE')) AS x(v) WHERE x.v = symbol);
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 644680 | 0 | 1 | 0 | 0 |

Same row count (644,680) but this time the optimizer chose a scan with a residual filter rather than a range seek. Performance is comparable on a table of this size; the correctness win is the main reason to prefer `NOT EXISTS` over `NOT IN`.

### Catch-all parameter queries

The pattern `WHERE (@p IS NULL OR col = @p)` is the classic "one query, many optional filters" design — the caller passes `NULL` to disable the filter and a concrete value to apply it. SQL Server's optimizer handles this pattern badly because at compile time it does not know whether `@p` is `NULL` or not, so it has to produce a plan that works for both branches. The result is almost always a full scan.

> [!warning] Catch-all WHERE @p IS NULL OR col = @p almost always scans
>
> The optimizer cannot produce a seek-based plan for a predicate whose shape depends on a variable's value. It picks a scan as the safe choice, and once the scan plan is cached, every subsequent execution reuses it — even when `@p` is a concrete value that would have seeked in a simple query.

### Catch-all with a concrete parameter scans

*Catch-all with a concrete parameter value.*

```sql
DECLARE @p varchar(20) = 'ASML.AS';
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore WHERE (@p IS NULL OR symbol = @p);
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 13470 | 0 | 1 | 0 | 0 |

The query returned the correct 13,470 rows but via a full NC index scan. This is the canonical catch-all penalty.

> [!success] Use OPTION (RECOMPILE) in stored procedures, or dynamic SQL
>
> Two production-grade fixes exist:
>
> - **`OPTION (RECOMPILE)`** forces SQL Server to compile a fresh plan for every execution, substituting the actual parameter value into the predicate. With `@p = 'ASML.AS'`, the predicate simplifies at compile time to `('ASML.AS' IS NULL OR symbol = 'ASML.AS')` → `symbol = 'ASML.AS'`, which seeks. With `@p = NULL`, it simplifies to `TRUE`, which scans. Each execution gets the optimal plan for its specific parameter value, at the cost of compilation overhead on every call. Works reliably in stored procedures where `@p` is a true parameter, less reliably with local variables.
> - **Dynamic SQL** builds the predicate at runtime, `sp_executesql` parameterizes only the branches that are actually present, and the optimizer sees a clean predicate. This is the traditional fix for catch-all patterns with many optional filters.

### OPTION (RECOMPILE) with a local variable is not a silver bullet

*Same predicate with OPTION (RECOMPILE) — note that local variable semantics differ from true stored-procedure parameters.*

```sql
DECLARE @p varchar(20) = 'ASML.AS';
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore
WHERE (@p IS NULL OR symbol = @p) OPTION (RECOMPILE);
```

| row_count | nc_seeks | nc_scans | cx_seeks | cx_scans |
|---|---|---|---|---|
| 13470 | 0 | 1 | 0 | 0 |

`OPTION (RECOMPILE)` alone is **not a silver bullet**. This demo uses a local `DECLARE @p` variable, not a true parameter, and the optimizer does not always perform the same constant-folding simplification it would for an `sp_executesql` parameter or a stored-procedure parameter. The takeaway: always measure the actual behavior in the exact call context the query will run under in production. Dynamic SQL remains the most reliable fix for catch-all patterns with multiple optional filters — see [[19-stored-procedures-dynamic-sql-and-error-handling]] for the full treatment.

## Computed Column Escape Hatch

When a SARGability-killing function cannot be rewritten — for example a suffix search via `RIGHT(col, n)` — the escape hatch is a **persisted computed column** indexed on the expression itself. SQL Server stores the computed value on disk, maintains it on every insert and update, and uses the index to seek on the expression when it appears in a predicate.

### Building and using a computed-column index

The workflow is: add a `PERSISTED` computed column, create a nonclustered index on it, run the original function-wrapped query and verify it now seeks, then clean up.

### Creating the computed column and its index

*Add a `PERSISTED` computed column holding the last two characters of `symbol`, then build a nonclustered index on it.*

```sql
ALTER TABLE dbo.demo_idxmaint_rowstore
    ADD exchange_suffix AS RIGHT(symbol, 2) PERSISTED;

CREATE NONCLUSTERED INDEX IX_demo_idxmaint_exchange_suffix
    ON dbo.demo_idxmaint_rowstore(exchange_suffix)
    INCLUDE (symbol);
```

```text
computed_column_and_index_created
```

The `PERSISTED` keyword stores the computed value on disk; the index can then reference the column directly. Without `PERSISTED`, the computed expression would be re-evaluated on every access and the index would be less useful. The `INCLUDE (symbol)` clause makes the index covering for queries that select `symbol` alongside the suffix filter.

### Query seeks via the computed-column index

> [!info]- What changes when the optimizer sees the computed column
>
> - When a predicate contains `RIGHT(symbol, 2) = 'AS'`, the optimizer inspects the catalog of computed columns on `demo_idxmaint_rowstore`.
> - It finds `exchange_suffix AS RIGHT(symbol, 2)` and recognizes that the predicate matches the stored expression.
> - It rewrites the predicate internally to `exchange_suffix = 'AS'` and uses `IX_demo_idxmaint_exchange_suffix` as the seek target.
> - The caller does **not** need to reference `exchange_suffix` — the rewrite happens automatically whenever the predicate expression matches the computed-column definition exactly.

*Same `RIGHT` predicate that previously scanned — now seeks via the new index.*

```sql
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore WHERE RIGHT(symbol, 2) = 'AS';
```

| row_count | computed_idx_seeks | computed_idx_scans |
|---|---|---|
| 80820 | 1 | 0 |

The `IX_demo_idxmaint_exchange_suffix` index seeks. The function wrapper that was fatal to SARGability in Section 3 is now the **reason** the query is fast — SQL Server recognized the expression and mapped it to the persisted computed column's index.

### Dropping the computed column and its index

*Clean up the demo artifacts.*

```sql
DROP INDEX IX_demo_idxmaint_exchange_suffix ON dbo.demo_idxmaint_rowstore;
ALTER TABLE dbo.demo_idxmaint_rowstore DROP COLUMN exchange_suffix;
```

```text
computed_column_and_index_dropped
```

Computed columns have a few constraints worth knowing: they must be deterministic and precise to be indexed, non-deterministic expressions like `GETDATE()` cannot be persisted, and any change to the underlying column triggers a recomputation. Consult Microsoft's [Indexes on Computed Columns](https://learn.microsoft.com/en-us/sql/relational-databases/indexes/indexes-on-computed-columns) reference before adopting the pattern for production tables.

## Filtered Index Escape Hatch

A **filtered index** is a nonclustered index that covers only a subset of the table's rows, defined by a `WHERE` clause in the index definition. The index is smaller, cheaper to maintain, and faster to seek — but only for queries whose predicates are compatible with the filter. Filtered indexes are the right tool when a large table has a hot subset that is queried far more often than the rest.

### Building and using a filtered index

Creating a filtered index is a three-step sequence: define the index with a `WHERE` predicate, verify that a matching query uses it, and confirm that a parameterized query does not.

### Creating the filtered index

*Create a filtered index covering only `symbol = 'ASML.AS'` rows.*

```sql
CREATE NONCLUSTERED INDEX IX_demo_idxmaint_filtered_asml
    ON dbo.demo_idxmaint_rowstore([date])
    INCLUDE ([close], volume)
    WHERE symbol = 'ASML.AS';
```

```text
filtered_index_created
```

The index is keyed on `date` (not `symbol`, because every row in the index already has `symbol = 'ASML.AS'` by construction). The `INCLUDE` clause makes the index covering for queries that select `close` and `volume` alongside the date filter. The `WHERE symbol = 'ASML.AS'` clause defines the subset — only 13,470 out of 671,550 rows are indexed, so the index is roughly 2% the size of a comparable unfiltered index.

### Matched query uses the filtered index

*Query with a literal that matches the filter predicate exactly, using an explicit index hint.*

```sql
SELECT COUNT(*)
FROM dbo.demo_idxmaint_rowstore WITH (INDEX(IX_demo_idxmaint_filtered_asml))
WHERE symbol = 'ASML.AS' AND [date] >= '2025-01-01';
```

| row_count | fi_seeks | fi_scans |
|---|---|---|
| 3210 | 1 | 0 |

The filtered index is used for a seek that returns 3,210 rows. The `WITH (INDEX(...))` hint forces the optimizer to use this index even when the composite `IX_demo_idxmaint_symbol_date` might have scored slightly better — in many real-world cases the filtered index is objectively cheaper because it is smaller, but the optimizer does not always pick it without a hint.

### Parameterized query fails to match the filter

> [!warning] A filtered index is only usable when the optimizer can prove the filter predicate at compile time
>
> The filter predicate `WHERE symbol = 'ASML.AS'` is a **literal**. When a query uses a parameter `@p = 'ASML.AS'`, the optimizer cannot prove at compile time that `@p` will always equal `'ASML.AS'`, so it refuses to use the filtered index (unless `OPTION (RECOMPILE)` is added). The query falls back to the larger composite index even though the two literal values are identical at runtime.

*Same predicate, but the value comes from a parameter instead of a literal.*

```sql
DECLARE @p varchar(20) = 'ASML.AS';
SELECT COUNT(*) FROM dbo.demo_idxmaint_rowstore WHERE symbol = @p AND [date] >= '2025-01-01';
```

| row_count | fi_seeks | fi_scans |
|---|---|---|
| 3210 | 0 | 0 |

Same result, but the filtered index was **not used at all** — both `fi_seeks` and `fi_scans` are 0. The optimizer chose the full composite index instead. This is the #1 reason filtered indexes fail in production: queries are parameterized, and the parameterization defeats the filter-match proof.

> [!success] Use literals, OPTION (RECOMPILE), or query-specific wrappers
>
> Three ways to make a filtered index usable with parameterized queries:
>
> - **Embed the literal** in a wrapper procedure or view that is specialized for one filter value. This is the cleanest solution when the set of possible values is small.
> - **`OPTION (RECOMPILE)`** lets the optimizer substitute the parameter value at compile time and re-check the filter match. Only viable when compilation cost is acceptable.
> - **Redesign the filter** to use a column or expression the optimizer can prove at compile time — for example, a computed `is_hot_symbol` bit column indexed separately.

### Dropping the filtered index

*Clean up the demo index.*

```sql
DROP INDEX IX_demo_idxmaint_filtered_asml ON dbo.demo_idxmaint_rowstore;
```

```text
filtered_index_dropped
```

## Review Checklist and Summary

Before calling a predicate "done", run through this checklist:

- [ ] **Is the indexed column bare?** No function wrapping (`LEFT`, `UPPER`, `YEAR`, `CAST`, `ISNULL`, `COALESCE`, `TRIM`), no arithmetic (`+ 0`, `* 1.2`), no concatenation (`col + ''`).
- [ ] **Does the predicate match the leftmost key of the relevant index?** A bare column on a non-leftmost key still scans.
- [ ] **Are the parameter types exactly compatible with the column types?** `nvarchar` parameter against `varchar` column → scan.
- [ ] **Is a prefix `LIKE` possible instead of `LEFT(col, n) = 'x'`?** Two-character rewrite flips scan to seek.
- [ ] **Is the date logic half-open (`>= start AND < end`), not closed `BETWEEN`?** Half-open is always correct and always SARGable.
- [ ] **Is the null-handling simple `ISNULL` rather than `COALESCE`?** SQL Server 2022 optimizer rewrites `ISNULL` for SARGability; `COALESCE` scans.
- [ ] **Are catch-all `(@p IS NULL OR col = @p)` patterns isolated to stored procedures with `OPTION (RECOMPILE)` or dynamic SQL?** They always scan otherwise.
- [ ] **Are `OR` branches on the same column or different columns?** Same-column OR seeks; cross-column OR scans — split with `UNION ALL`.
- [ ] **Is `NOT IN` used against a subquery that could return `NULL`?** Replace with `NOT EXISTS` for correctness.
- [ ] **If a rewrite is impossible, is a computed-column index or filtered index justified?** Both have measurable costs; use only when the query pattern is important enough.

### Master rewrite cheat sheet

| Anti-pattern | SARGable rewrite |
|---|---|
| `YEAR(col) = 2025` | `col >= '2025-01-01' AND col < '2026-01-01'` |
| `CAST(col AS date) = @d` | `col >= @d AND col < DATEADD(DAY, 1, @d)` |
| `DATEDIFF(DAY, col, ref) <= 30` | `col >= DATEADD(DAY, -30, ref)` |
| `col BETWEEN a AND b` (datetime) | `col >= a AND col < end_plus_one` |
| `LEFT(col, 3) = 'ASM'` | `col LIKE 'ASM%'` |
| `SUBSTRING(col, 1, 3) = 'ASM'` | `col LIKE 'ASM%'` |
| `UPPER(col) = 'X'` (CI collation) | `col = 'X'` |
| `TRIM(col) = 'x'` | Clean data at ingest, query raw |
| `col + '' = 'x'` | `col = 'x'` |
| `col * 1.2 > 100` | `col > 100 / 1.2` |
| `col + 0 = 5` | `col = 5` |
| `ISNULL(col, '') = 'x'` | Already seeks on SQL 2022 (prefer over `COALESCE`) |
| `COALESCE(col, '') = 'x'` | `col = 'x' OR (col IS NULL AND '' = 'x')` |
| `<>` / `NOT =` | Redesign query; use `IN` over small sets |
| `NOT IN (subquery with NULL)` | `NOT EXISTS (...)` |
| `varchar_col = N'literal'` | `varchar_col = 'literal'` |
| `varchar_col = @nvarchar_param` | Change parameter to `@varchar` |
| `CAST(col AS type) = val` | `col = CAST(val AS coltype)` |
| `symbol = X OR batch_no = Y` | `SELECT ... WHERE symbol = X UNION ALL SELECT ... WHERE batch_no = Y AND symbol <> X` |
| `(@p IS NULL OR col = @p)` | Dynamic SQL, or stored proc with `OPTION (RECOMPILE)` |
| `RIGHT(col, n) = 'x'` | Computed column on `RIGHT(col, n)` + index |
| `MONTH(col) = M` | Computed column on `MONTH(col)` + index |
