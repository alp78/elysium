---
title: "01 - SELECT and Query Basics"
tags: [sql-server, tsql, query-writing]
aliases: [SELECT basics, query basics, projection and filtering, SQL query clauses]
description: "Core T-SQL query-shaping reference for logical processing order, SARGability, SELECT/FROM/WHERE/ORDER BY, TOP/OFFSET/FETCH, DISTINCT/GROUP BY/HAVING, CASE, and common predicate operators."
created: 2026-04-08
updated: 2026-04-11
status: complete
---

# SELECT and Query Basics

> [!abstract] Scope of this note
>
> This note owns the core shape of a T-SQL `SELECT` statement:
>
> - how rows enter the query (`FROM`)
> - how rows are filtered before grouping (`WHERE`)
> - how results are collapsed and filtered by group (`GROUP BY`, `HAVING`)
> - how columns are projected (`SELECT`, aliases, `DISTINCT`)
> - how results are ordered (`ORDER BY`)
> - how result size is limited or paged (`TOP`, `OFFSET`/`FETCH`)
> - how conditional values are produced (`CASE`)
> - how common predicates are expressed (`IN`, `NOT IN`, `BETWEEN`, `LIKE`, `IS NULL`, `EXISTS`)
>
> It also defines two foundational concepts that govern every clause in a `SELECT` statement: the **logical processing order** that determines clause evaluation, and the **SARGability** rules that determine whether predicates can use indexes.
>
> Join internals, window functions, and performance diagnostics live in sibling notes under `03-Query-Writing-and-Optimization`.

## Logical Processing Order

SQL Server does not evaluate a `SELECT` statement in the order its clauses are written. It evaluates them in a fixed **logical processing order**, also called the binding order. This order determines which objects (tables, columns, aliases) are visible to each subsequent clause. Understanding it explains several of the most common "why doesn't this work?" errors in T-SQL, including why `WHERE` cannot reference a `SELECT` alias and why `HAVING` exists at all.

### Canonical evaluation sequence

The Microsoft [SELECT (Transact-SQL)](https://learn.microsoft.com/en-us/sql/t-sql/queries/select-transact-sql) reference defines the following 11-step binding order for a `SELECT` statement. Each step produces a virtual rowset that feeds into the next.

> [!info] Logical processing order of a SELECT statement
>
> 1. `FROM`
> 2. `ON`
> 3. `JOIN`
> 4. `WHERE`
> 5. `GROUP BY`
> 6. `WITH CUBE` or `WITH ROLLUP`
> 7. `HAVING`
> 8. `SELECT`
> 9. `DISTINCT`
> 10. `ORDER BY`
> 11. `TOP`
>
> This is the **logical** order. The query optimizer may physically execute steps in a different order as long as the final result is preserved.

Two important consequences flow from this list:

- Any object the reader names in `SELECT` (for example a column alias or a computed expression) is produced at **step 8**, so it cannot be referenced in earlier clauses (`WHERE`, `GROUP BY`, `HAVING`) because those clauses run before the alias exists.
- `ORDER BY` runs at **step 10**, after `SELECT`, so it **can** reference aliases defined in the `SELECT` list.

### Aliases are only visible to clauses that run after SELECT

This subsection shows the direct, operational consequence of the binding order: the same alias can be used successfully in `ORDER BY` but fails in `WHERE`.

#### Reference a SELECT alias in ORDER BY

*The `ORDER BY` clause runs at step 10, after `SELECT` has produced the `notional` alias, so the reference resolves cleanly.*

```sql
SELECT TOP (5)
    symbol,
    trade_date,
    close_price * volume AS notional
FROM dbo.stock_prices
WHERE symbol = 'AAPL'
  AND trade_date >= '2025-01-01'
ORDER BY notional DESC;
```

| symbol | trade_date | notional |
|---|---|---|
| AAPL | 2025-09-19 | 40121530739.00 |
| AAPL | 2025-12-19 | 39543835120.00 |
| AAPL | 2025-04-09 | 36508544241.00 |
| AAPL | 2025-04-07 | 28991446421.00 |
| AAPL | 2025-09-22 | 26969192266.00 |

The result shows the five days in 2025 where AAPL had the highest closing notional (close price × volume). The `notional` alias is defined in `SELECT` and re-used in `ORDER BY` — both work because binding order allows it.

#### Reference a SELECT alias in WHERE (fails)

> [!failure] Alias reference from WHERE is rejected
>
> `WHERE` runs at step 4, long before `SELECT` at step 8, so the alias `notional` does not yet exist. SQL Server raises error 207 with "Invalid column name 'notional'".

*Attempt to filter on the `notional` alias from `WHERE`.*

```sql
SELECT
    symbol,
    trade_date,
    close_price * volume AS notional
FROM dbo.stock_prices
WHERE notional > 20000000000
  AND symbol = 'AAPL';
```

```text
Msg 207, Level 16, State 1
Invalid column name 'notional'.
```

> [!success] Repeat the expression instead of the alias
>
> The canonical fix is to repeat the full expression in `WHERE`, or to wrap the base query in a derived table / CTE and filter the outer query on the alias.

*Fix by re-writing the expression directly in `WHERE`.*

```sql
SELECT TOP (5)
    symbol,
    trade_date,
    close_price * volume AS notional
FROM dbo.stock_prices
WHERE close_price * volume > 20000000000
  AND symbol = 'AAPL'
ORDER BY trade_date DESC;
```

| symbol | trade_date | notional |
|---|---|---|
| AAPL | 2026-02-12 | 21165555467.00 |
| AAPL | 2026-02-04 | 25011438711.00 |
| AAPL | 2026-01-30 | 23965027016.00 |
| AAPL | 2025-12-19 | 39543835120.00 |
| AAPL | 2025-10-31 | 23253053606.00 |

### WHERE and HAVING are not interchangeable

`WHERE` and `HAVING` both filter, but they run at different stages and see different inputs:

- `WHERE` runs at step 4 — it filters individual **rows** before aggregation, and cannot reference aggregate functions because aggregation has not happened yet.
- `HAVING` runs at step 7 — it filters **groups** after `GROUP BY` has produced them, and can reference aggregates such as `COUNT(*)`, `SUM(...)`, `AVG(...)`.

The practical rule is: push row-level predicates into `WHERE` to reduce the rowset that `GROUP BY` has to aggregate, then use `HAVING` only for conditions that reference the aggregate values themselves.

#### Combine WHERE for row filter and HAVING for group filter

> [!info]- Clause-by-clause walkthrough
>
> 1. `FROM dbo.stock_prices` — scans the full fact table.
> 2. `WHERE trade_date >= '2025-01-01' AND trade_date < '2026-01-01'` — keeps only rows whose trade date falls inside 2025.
> 3. `GROUP BY symbol` — collapses the surviving rows into one row per symbol.
> 4. `HAVING COUNT(*) >= 250` — keeps only groups (symbols) that have 250 or more trading days in 2025. This predicate references the aggregate `COUNT(*)`, so it must live in `HAVING`, not `WHERE`.
> 5. `ORDER BY symbol` — sorts the final rowset alphabetically.
> 6. `TOP (5)` — returns the first five rows of the sorted result.

*Count 2025 trading days per symbol and keep only symbols with at least 250 days.*

```sql
SELECT TOP (5)
    symbol,
    COUNT(*) AS days_2025
FROM dbo.stock_prices
WHERE trade_date >= '2025-01-01'
  AND trade_date <  '2026-01-01'
GROUP BY symbol
HAVING COUNT(*) >= 250
ORDER BY symbol;
```

| symbol | days_2025 |
|---|---|
| A | 250 |
| AAPL | 250 |
| ABBV | 250 |
| ABNB | 250 |
| ABT | 250 |

The result confirms that every S&P 500 symbol in the dataset had exactly 250 trading days in calendar year 2025. The `WHERE` clause limited the scan to 2025 rows first; the `HAVING` clause filtered the per-symbol groups afterwards.

#### Aggregate in WHERE (fails)

> [!failure] Aggregates cannot appear in WHERE
>
> `WHERE` runs before `GROUP BY`, so the aggregate value does not exist yet. SQL Server raises error 147.

*Attempt to use `COUNT(*)` in `WHERE`.*

```sql
SELECT
    symbol,
    COUNT(*) AS days_2025
FROM dbo.stock_prices
WHERE COUNT(*) >= 250
GROUP BY symbol;
```

```text
Msg 147, Level 15, State 1
An aggregate may not appear in the WHERE clause unless it is in a subquery
contained in a HAVING clause or a select list, and the column being aggregated
is an outer reference.
```

> [!success] Move the aggregate filter to HAVING
>
> See the `HAVING COUNT(*) >= 250` example above. `HAVING` is the clause designed to filter on aggregate results.

## SARGability

**SARGable** is short for **Search ARGument-able**. A predicate is SARGable when SQL Server can transform it into an index seek — a direct navigation to a contiguous range of index key values — instead of scanning every row of the base table or index. A non-SARGable predicate forces a scan, which reads every row and evaluates the predicate row-by-row.

SARGability is not about the query returning correct results — both SARGable and non-SARGable versions of the same predicate produce the same rowset. It is about **how the optimizer can reach those rows**. On a small table this is invisible; on a multi-million-row table the difference is two to four orders of magnitude in CPU and logical reads.

### SARGable predicate patterns

The following operators and patterns are SARGable when applied to an indexed column with the column on the bare side of the comparison:

| Pattern | Example | Why it is SARGable |
|---|---|---|
| Equality | `symbol = 'AAPL'` | Single index key lookup |
| Range | `trade_date >= '2025-01-01' AND trade_date < '2026-01-01'` | Contiguous key range |
| `BETWEEN` | `trade_date BETWEEN '2025-01-01' AND '2025-12-31'` | Same range semantics as `>=` AND `<=` |
| `IN` (literal list) | `symbol IN ('AAPL','MSFT','NVDA')` | Multiple equality lookups |
| Prefix `LIKE` | `symbol LIKE 'AA%'` | Contiguous range of keys starting with `'AA'` |

#### Equality on an indexed column

*Seek for a single (symbol, trade_date) pair.*

```sql
SELECT
    symbol,
    trade_date,
    close_price
FROM dbo.stock_prices
WHERE symbol = 'AAPL'
  AND trade_date = '2025-01-02';
```

| symbol | trade_date | close_price |
|---|---|---|
| AAPL | 2025-01-02 | 242.53 |

The predicate is a clean equality on two leading columns of the clustered key — the optimizer can compute the exact row location without scanning.

#### Range on a date column

*Seek for one month of AAPL rows.*

```sql
SELECT TOP (5)
    symbol,
    trade_date,
    close_price
FROM dbo.stock_prices
WHERE symbol = 'AAPL'
  AND trade_date >= '2025-01-01'
  AND trade_date <  '2025-02-01'
ORDER BY trade_date;
```

| symbol | trade_date | close_price |
|---|---|---|
| AAPL | 2025-01-02 | 242.53 |
| AAPL | 2025-01-03 | 242.04 |
| AAPL | 2025-01-06 | 243.67 |
| AAPL | 2025-01-07 | 240.89 |
| AAPL | 2025-01-08 | 241.38 |

The half-open interval `>= start AND < next_boundary` is the canonical range pattern. It is SARGable and immune to the `BETWEEN` datetime boundary trap documented in the `WHERE` section below.

#### Prefix LIKE on a string column

*Seek for all symbols starting with `AA`.*

```sql
SELECT DISTINCT TOP (5) symbol
FROM dbo.stock_prices
WHERE symbol LIKE 'AA%'
ORDER BY symbol;
```

| symbol |
|---|
| AAPL |

A `LIKE` pattern with the wildcard only at the end is equivalent to a range scan between `'AA'` and `'AB'` (the next string greater than the prefix). The optimizer recognizes this and produces a seek.

### Non-SARGable traps

The following patterns defeat index seeking because the indexed column is wrapped in a function, a computation, or a type conversion. Each trap is shown with a paired safe rewrite.

#### Function on the indexed column

> [!warning] YEAR(trade_date) = 2025 forces an index scan
>
> Wrapping the column in any scalar function means SQL Server must evaluate the function on **every row** before it can test the predicate. No seek is possible on the underlying index. The same rule applies to any of the following wrappers:
>
> - `YEAR()`, `MONTH()`, `DAY()`, `DATEPART()` — date-part extraction
> - `CAST()`, `CONVERT()` — type conversion
> - `LEFT()`, `RIGHT()`, `SUBSTRING()`, `UPPER()`, `LOWER()` — string manipulation
> - `ISNULL()`, `COALESCE()` — null substitution
> - any user-defined scalar function

*Non-SARGable — function wraps the indexed column.*

```sql
SELECT TOP (5)
    symbol,
    trade_date,
    close_price
FROM dbo.stock_prices
WHERE symbol = 'AAPL'
  AND YEAR(trade_date) = 2025
ORDER BY trade_date;
```

| symbol | trade_date | close_price |
|---|---|---|
| AAPL | 2025-01-02 | 242.53 |
| AAPL | 2025-01-03 | 242.04 |
| AAPL | 2025-01-06 | 243.67 |
| AAPL | 2025-01-07 | 240.89 |
| AAPL | 2025-01-08 | 241.38 |

> [!success] Rewrite as an explicit half-open date range
>
> Move the computation off the column by expressing the year as a `trade_date >= '2025-01-01' AND trade_date < '2026-01-01'` range. The result is identical but now the optimizer can seek on the date index.

*SARGable rewrite.*

```sql
SELECT TOP (5)
    symbol,
    trade_date,
    close_price
FROM dbo.stock_prices
WHERE symbol = 'AAPL'
  AND trade_date >= '2025-01-01'
  AND trade_date <  '2026-01-01'
ORDER BY trade_date;
```

| symbol | trade_date | close_price |
|---|---|---|
| AAPL | 2025-01-02 | 242.53 |
| AAPL | 2025-01-03 | 242.04 |
| AAPL | 2025-01-06 | 243.67 |
| AAPL | 2025-01-07 | 240.89 |
| AAPL | 2025-01-08 | 241.38 |

#### Leading wildcard in LIKE

> [!warning] `LIKE '%PL'` forces a full scan
>
> A wildcard on the left side of the pattern means every possible prefix must be tested, so no contiguous index range exists. SQL Server falls back to a scan of the entire index (or base table).

*Non-SARGable — leading wildcard.*

```sql
SELECT DISTINCT TOP (5) symbol
FROM dbo.stock_prices
WHERE symbol LIKE '%PL'
ORDER BY symbol;
```

| symbol |
|---|
| AAPL |
| PPL |
| PYPL |
| TPL |

The query correctly returns every symbol whose ticker ends in `PL`, but it had to examine every distinct symbol in the table to do so.

> [!success] Use a prefix pattern whenever possible
>
> If the requirement allows it, restructure the column (for example store a reversed copy in a persisted computed column with its own index) or rewrite the query to use a prefix match. Prefix `LIKE` is SARGable.

*SARGable prefix form.*

```sql
SELECT DISTINCT TOP (5) symbol
FROM dbo.stock_prices
WHERE symbol LIKE 'AP%'
ORDER BY symbol;
```

| symbol |
|---|
| APA |
| APD |
| APH |
| APO |
| APP |

#### ISNULL or COALESCE wrapping the indexed column

> [!warning] `ISNULL(symbol, '') = 'AAPL'` defeats the index
>
> The same rule that applies to `YEAR()`, `CAST()`, and other scalar functions applies to `ISNULL` and `COALESCE`: once the column is inside a function call, the optimizer can no longer seek on the underlying index.

*Non-SARGable — `ISNULL` wraps the indexed column.*

```sql
SELECT TOP (5)
    symbol,
    trade_date,
    close_price
FROM dbo.stock_prices
WHERE ISNULL(symbol, '') = 'AAPL'
  AND trade_date >= '2025-01-01'
ORDER BY trade_date;
```

| symbol | trade_date | close_price |
|---|---|---|
| AAPL | 2025-01-02 | 242.53 |
| AAPL | 2025-01-03 | 242.04 |
| AAPL | 2025-01-06 | 243.67 |
| AAPL | 2025-01-07 | 240.89 |
| AAPL | 2025-01-08 | 241.38 |

> [!success] Test NULL explicitly with `OR symbol IS NULL`
>
> If the column is nullable and the caller genuinely wants rows where `symbol` is either `'AAPL'` or `NULL`, write `symbol = 'AAPL' OR symbol IS NULL`. Otherwise, drop the `ISNULL` wrapper entirely.

*SARGable rewrite.*

```sql
SELECT TOP (5)
    symbol,
    trade_date,
    close_price
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
| AAPL | 2025-01-07 | 240.89 |
| AAPL | 2025-01-08 | 241.38 |

#### Implicit conversion on the indexed side

> [!warning] Mixing `nvarchar` and `varchar` silently forces conversion on the column
>
> If a `varchar` indexed column is compared to an `N'literal'` or to an `nvarchar` parameter, SQL Server must implicitly convert the column to `nvarchar` because of data-type precedence. The conversion happens on the **column** side, which defeats the index just like an explicit `CAST()` would.

The practical rules to avoid implicit-conversion traps are:

- Match the parameter type to the column type in application code (`SqlDbType.VarChar`, not `NVarChar`, for `varchar` columns).
- Use plain `'literal'` (not `N'literal'`) when comparing to `varchar` columns.
- Align column types across join predicates — do not join a `varchar` column to an `nvarchar` column and expect the optimizer to seek.
- Watch for conversion warnings in the execution plan's root operator (`PlanAffectingConvert`).

## SELECT, FROM, WHERE, and ORDER BY

> [!abstract] Query shape essentials
>
> These four clauses shape every non-trivial `SELECT` statement:
>
> - `FROM` identifies the row sources.
> - `WHERE` filters rows before any grouping happens.
> - `SELECT` projects the final column list, optionally with computed expressions and aliases.
> - `ORDER BY` imposes a deterministic row order at the end.
>
> Each clause has specific rules about what it can reference and what traps to avoid.

### SELECT list and column aliases

The `SELECT` list decides which columns, expressions, and computed values appear in the query output. It is executed at step 8 of the logical processing order, which governs what the `SELECT` list can reference and what subsequent clauses can reference back from it.

#### Project columns with an explicit list

In production code, list the columns the caller actually needs rather than using `*`. An explicit list makes the contract between the query and its caller stable against schema drift, allows the optimizer to use narrower covering indexes, and reduces the amount of data SQL Server must copy into the result buffer.

*Project three columns by name and take the first five rows for inspection.*

```sql
SELECT TOP (5)
    symbol,
    trade_date,
    close_price
FROM dbo.stock_prices
ORDER BY symbol, trade_date;
```

| symbol | trade_date | close_price |
|---|---|---|
| A | 2016-02-12 | 33.44 |
| A | 2016-02-16 | 34.24 |
| A | 2016-02-17 | 34.97 |
| A | 2016-02-18 | 34.34 |
| A | 2016-02-19 | 34.57 |

The five rows shown are the earliest trading days for symbol `A` (Agilent Technologies) in the dataset.

#### Alias a computed expression

When the `SELECT` list contains an expression rather than a bare column, use `AS alias_name` to give the result column a stable name. Downstream consumers (ORMs, report builders, the `ORDER BY` clause of the same query) will reference the alias; without it, the column is named by whatever system name SQL Server assigns, which is unreliable.

*Compute the dollar notional (close price × volume) as a named output column.*

```sql
SELECT TOP (5)
    symbol,
    trade_date,
    close_price,
    volume,
    close_price * volume AS notional
FROM dbo.stock_prices
WHERE symbol = 'AAPL'
  AND trade_date >= '2025-01-01'
ORDER BY trade_date;
```

| symbol | trade_date | close_price | volume | notional |
|---|---|---|---|---|
| AAPL | 2025-01-02 | 242.53 | 55740700 | 13518791971.00 |
| AAPL | 2025-01-03 | 242.04 | 40244100 | 9740681964.00 |
| AAPL | 2025-01-06 | 243.67 | 45045600 | 10976261352.00 |
| AAPL | 2025-01-07 | 240.89 | 40856000 | 9841801840.00 |
| AAPL | 2025-01-08 | 241.38 | 37628900 | 9082863882.00 |

The `notional` column is a derived value that only exists in this query's result. It carries the data type resulting from the multiplication — in this case `decimal(38,2)` because `close_price` is `decimal` and `volume` is `bigint`.

#### SELECT alias cannot be reused in the same SELECT list

> [!failure] Alias reuse inside the SELECT list is rejected
>
> Unlike some other SQL dialects, SQL Server does **not** allow a column alias defined earlier in the same `SELECT` list to be referenced by a later expression in that same list. The entire `SELECT` list is bound in a single step, so all alias names become available only at the end of that step.

*Attempt to reuse the `notional` alias to compute a second derived column.*

```sql
SELECT TOP (5)
    symbol,
    close_price * volume AS notional,
    notional / 1000000 AS notional_millions
FROM dbo.stock_prices
WHERE symbol = 'AAPL'
ORDER BY trade_date DESC;
```

```text
Msg 207, Level 16, State 1
Invalid column name 'notional'.
```

> [!success] Use CROSS APPLY (VALUES ...) to define the alias once
>
> The idiomatic SQL Server fix is to compute the expression once inside a `CROSS APPLY (VALUES (expr)) AS x(alias)` construct, which makes the alias available to every later clause in the same statement. A derived table or CTE achieves the same result but requires more syntax.

*Reuse the `notional` value in a second projection via `CROSS APPLY`.*

```sql
SELECT TOP (5)
    s.symbol,
    s.trade_date,
    x.notional,
    x.notional / 1000000 AS notional_millions
FROM dbo.stock_prices AS s
CROSS APPLY (VALUES (s.close_price * s.volume)) AS x(notional)
WHERE s.symbol = 'AAPL'
ORDER BY s.trade_date DESC;
```

| symbol | trade_date | notional | notional_millions |
|---|---|---|---|
| AAPL | 2026-02-12 | 21165555467.00 | 21165.5554670000 |
| AAPL | 2026-02-11 | 14294840950.00 | 14294.8409500000 |
| AAPL | 2026-02-10 | 9408269992.00 | 9408.2699920000 |
| AAPL | 2026-02-09 | 12254478108.00 | 12254.4781080000 |
| AAPL | 2026-02-06 | 14018981724.00 | 14018.9817240000 |

The `x.notional` column is now a real output of the `CROSS APPLY` subquery and is visible to every subsequent expression in the main `SELECT` list.

#### SELECT * — avoid in production code

> [!warning] SELECT * is an anti-pattern in persistent code
>
> Using `SELECT *` in application queries, views, stored procedures, and any code that survives schema changes has three distinct costs:
>
> - **Schema drift.** Adding, removing, or re-ordering table columns silently changes the result shape, breaking downstream consumers that expect a fixed contract.
> - **Defeated covering indexes.** The optimizer cannot use a narrower covering index because every column must be returned — it is forced to read the full row from the base table.
> - **Wider row materialization.** The query materializes the full row width even when the caller only needs a subset of columns, wasting memory, CPU, and network bandwidth.
>
> The only legitimate uses for `SELECT *` are ad-hoc inspection at the SSMS prompt and the specific case of `EXISTS (SELECT * FROM ...)` where the column list is discarded by the optimizer.

*Ad-hoc inspection of the full row width — acceptable at the SSMS prompt, not in persistent code.*

```sql
SELECT TOP (5) *
FROM dbo.stock_prices
ORDER BY symbol, trade_date;
```

| symbol | trade_date | open_price | high_price | low_price | close_price | volume |
|---|---|---|---|---|---|---|
| A | 2016-02-12 | 33.09 | 33.45 | 32.80 | 33.44 | 3923600 |
| A | 2016-02-16 | 33.90 | 34.32 | 33.61 | 34.24 | 2903600 |
| A | 2016-02-17 | 32.52 | 35.21 | 32.08 | 34.97 | 5382300 |
| A | 2016-02-18 | 34.84 | 35.05 | 34.25 | 34.34 | 2231500 |
| A | 2016-02-19 | 34.14 | 34.72 | 34.02 | 34.57 | 2339400 |

> [!success] Enumerate the columns explicitly
>
> Replace the `*` with a named column list that returns exactly what the caller needs. See the `#### Project columns with an explicit list` example above.

### FROM clause and table sources

The `FROM` clause is the first step in the logical processing order. It names every row source the query will read from, and produces the initial virtual rowset that all subsequent clauses operate on. Valid row sources include:

- base tables and views
- table aliases (required any time a table appears more than once in the same query)
- derived tables — an inline subquery in parentheses followed by `AS alias`
- common table expressions (CTEs) declared in a preceding `WITH` clause
- table-valued functions
- joins (`INNER JOIN`, `LEFT JOIN`, etc.) and `APPLY` operators

For readability, alias every table once on its first appearance and use the alias consistently for every column reference.

#### Query a base table with an alias

*Read AAPL rows directly from `dbo.stock_prices` using a short alias.*

```sql
SELECT TOP (5)
    o.symbol,
    o.trade_date,
    o.close_price
FROM dbo.stock_prices AS o
WHERE o.symbol = 'AAPL'
ORDER BY o.trade_date DESC;
```

| symbol | trade_date | close_price |
|---|---|---|
| AAPL | 2026-02-12 | 261.73 |
| AAPL | 2026-02-11 | 275.50 |
| AAPL | 2026-02-10 | 273.68 |
| AAPL | 2026-02-09 | 274.62 |
| AAPL | 2026-02-06 | 277.86 |

The alias `o` stands in for the full table name. It is required if the same table is referenced more than once (self-join) and recommended otherwise because it keeps column references unambiguous and short.

#### Query a derived table

A **derived table** is a parenthesized `SELECT` used as a row source inside `FROM`. It is evaluated once per query and must be given an alias. Derived tables are useful when the outer query needs to filter or join against an already-aggregated rowset.

> [!info]- Clause-by-clause walkthrough
>
> 1. The inner `SELECT` groups `dbo.stock_prices` by `symbol` and computes the 2025 average close price per symbol.
> 2. The inner result is exposed as a derived table aliased `d`.
> 3. The outer `SELECT` filters that derived rowset for `avg_close > 500`, orders by average close descending, and returns the top 5.

*Find the five symbols with the highest average close price in 2025.*

```sql
SELECT TOP (5)
    d.symbol,
    d.avg_close
FROM
(
    SELECT
        symbol,
        AVG(close_price) AS avg_close
    FROM dbo.stock_prices
    WHERE trade_date >= '2025-01-01'
    GROUP BY symbol
) AS d
WHERE d.avg_close > 500
ORDER BY d.avg_close DESC;
```

| symbol | avg_close |
|---|---|
| NVR | 7564.488064 |
| BKNG | 5127.194731 |
| AZO | 3720.775913 |
| FICO | 1712.473225 |
| TDG | 1317.398207 |

The result shows the top five high-priced S&P 500 symbols in 2025. `NVR` averaged about $7,564, more than 40× the median S&P close price, reflecting its famously high nominal share price.

#### Query a CTE

A **common table expression** (CTE) is a named, temporary rowset declared in a `WITH` clause at the start of a statement. CTEs are functionally equivalent to derived tables for most cases but are easier to read when the same subquery is referenced more than once, or when the query has multiple levels of nested logic.

*Same top-5 query expressed with a CTE.*

```sql
WITH SymbolAvg AS
(
    SELECT
        symbol,
        AVG(close_price) AS avg_close
    FROM dbo.stock_prices
    WHERE trade_date >= '2025-01-01'
    GROUP BY symbol
)
SELECT TOP (5)
    symbol,
    avg_close
FROM SymbolAvg
WHERE avg_close > 500
ORDER BY avg_close DESC;
```

| symbol | avg_close |
|---|---|
| NVR | 7564.488064 |
| BKNG | 5127.194731 |
| AZO | 3720.775913 |
| FICO | 1712.473225 |
| TDG | 1317.398207 |

The output is identical to the derived-table version. Choose CTEs when the named intermediate result improves readability or when the same subquery needs to be referenced more than once; the SQL Server optimizer generally inlines non-recursive CTEs, so there is no performance difference between the two forms for simple cases.

### WHERE clause and row filtering

`WHERE` runs at step 4 of the logical processing order. It filters the virtual rowset produced by `FROM` and any joins, keeping only rows where the search condition evaluates to `TRUE`. Rows where the condition evaluates to `FALSE` or `UNKNOWN` (the result of comparisons involving `NULL`) are discarded.

Use `WHERE` for row-level filters. Aggregate filters belong in `HAVING` (see the `## DISTINCT, GROUP BY, and HAVING` section). Predicates on indexed columns should follow the SARGability rules from the `## SARGability` section.

#### Equality and range predicates

*Filter AAPL rows within a three-month window using equality and a half-open date range.*

```sql
SELECT TOP (5)
    symbol,
    trade_date,
    close_price
FROM dbo.stock_prices
WHERE symbol = 'AAPL'
  AND trade_date >= '2025-01-01'
  AND trade_date <  '2025-04-01'
ORDER BY trade_date;
```

| symbol | trade_date | close_price |
|---|---|---|
| AAPL | 2025-01-02 | 242.53 |
| AAPL | 2025-01-03 | 242.04 |
| AAPL | 2025-01-06 | 243.67 |
| AAPL | 2025-01-07 | 240.89 |
| AAPL | 2025-01-08 | 241.38 |

Three predicates are combined with `AND`: one equality on `symbol` and two half-open range bounds on `trade_date`. All three are SARGable as long as the symbol and date columns are indexed. The half-open pattern `>= start AND < end` avoids the `BETWEEN` datetime trap documented in the `## Common Operators In Everyday Queries` section.

#### Compound AND/OR with explicit parenthesization

T-SQL evaluates `AND` with higher precedence than `OR`, so `A OR B AND C` is read as `A OR (B AND C)`. When mixing the two, wrap each logical group in parentheses to make the intent explicit and prevent subtle bugs from precedence errors.

*Find AAPL or MSFT rows in 2025 where the close was above $400.*

```sql
SELECT TOP (5)
    symbol,
    trade_date,
    close_price
FROM dbo.stock_prices
WHERE (symbol = 'AAPL' OR symbol = 'MSFT')
  AND trade_date >= '2025-01-01'
  AND close_price > 400
ORDER BY trade_date, symbol;
```

| symbol | trade_date | close_price |
|---|---|---|
| MSFT | 2025-01-02 | 415.51 |
| MSFT | 2025-01-03 | 420.25 |
| MSFT | 2025-01-06 | 424.72 |
| MSFT | 2025-01-07 | 419.28 |
| MSFT | 2025-01-08 | 421.45 |

The first five matches all belong to MSFT because AAPL did not close above $400 in early 2025 — the extra predicate `close_price > 400` eliminates AAPL from the early 2025 sample entirely. The parentheses around `(symbol = 'AAPL' OR symbol = 'MSFT')` are essential: without them, the query would be parsed as `symbol = 'AAPL' OR (symbol = 'MSFT' AND trade_date >= '2025-01-01' AND close_price > 400)` and would return **every** AAPL row in the table regardless of the other filters.

> [!tip] `IN` is cleaner than long `OR` chains
>
> For any fixed list of values, prefer `WHERE symbol IN ('AAPL','MSFT','NVDA',...)` over a chain of `OR` predicates. See the `IN` entry in the `## Common Operators In Everyday Queries` section.

### ORDER BY and deterministic ordering

`ORDER BY` runs at step 10 of the logical processing order — after `SELECT` and `DISTINCT`. It is the only clause that can guarantee the order in which rows are returned. Without an `ORDER BY`, SQL Server is free to return rows in whatever order is convenient for the current execution plan, which can change between runs, between plan recompiles, and under parallelism.

Two rules follow from this:

- Every query whose caller cares about order must include an explicit `ORDER BY`.
- Every query that uses `TOP`, `OFFSET`, or `FETCH` must include an `ORDER BY` that uniquely identifies each row — a "tie-breaker" — otherwise the rows at the boundary of the requested range are not stable across executions.

The Microsoft [ORDER BY clause](https://learn.microsoft.com/en-us/sql/t-sql/queries/select-order-by-clause-transact-sql) reference documents the full syntax; the subsections below cover the patterns used in day-to-day query writing.

#### Sort by a single column, ascending and descending

The default sort direction is ascending (`ASC`). Use `DESC` to reverse it. `NULL` values are treated as the lowest possible value, so they sort first in `ASC` and last in `DESC`.

*Sort AAPL 2026 rows in chronological order.*

```sql
SELECT TOP (5)
    symbol,
    trade_date,
    close_price
FROM dbo.stock_prices
WHERE symbol = 'AAPL'
  AND trade_date >= '2026-01-01'
ORDER BY trade_date ASC;
```

| symbol | trade_date | close_price |
|---|---|---|
| AAPL | 2026-01-02 | 270.76 |
| AAPL | 2026-01-05 | 267.01 |
| AAPL | 2026-01-06 | 262.11 |
| AAPL | 2026-01-07 | 260.09 |
| AAPL | 2026-01-08 | 258.80 |

The `ASC` keyword is optional here because ascending is the default, but stating it explicitly is a readable habit — it removes any question about intent for readers unfamiliar with the default.

#### Multi-column sort with a tie-breaker

When the first sort key has duplicate values, the second key decides the order within each tie. This is essential for pagination and for any top-N query where the boundary row matters, because without a tie-breaker the order of tied rows is nondeterministic.

*Return the five most recent rows across all symbols, breaking ties by symbol alphabetically.*

```sql
SELECT TOP (5)
    symbol,
    trade_date,
    close_price
FROM dbo.stock_prices
ORDER BY trade_date DESC, symbol ASC;
```

| symbol | trade_date | close_price |
|---|---|---|
| A | 2026-02-12 | 124.88 |
| AAPL | 2026-02-12 | 261.73 |
| ABBV | 2026-02-12 | 227.50 |
| ABNB | 2026-02-12 | 115.96 |
| ABT | 2026-02-12 | 111.47 |

All five rows share the same `trade_date` (2026-02-12, the most recent trading day). The `symbol ASC` tie-breaker decides the order among them. Without the tie-breaker, SQL Server could return any five of the 500 symbols with the latest date, and the set could differ between runs.

#### Sort by a computed expression

`ORDER BY` can reference any expression, including computations the `SELECT` list never projects.

*Rank the 2026-02-12 rows by dollar notional (close × volume) descending, showing the five biggest names by traded value.*

```sql
SELECT TOP (5)
    symbol,
    trade_date,
    close_price,
    volume
FROM dbo.stock_prices
WHERE trade_date = '2026-02-12'
ORDER BY close_price * volume DESC;
```

| symbol | trade_date | close_price | volume |
|---|---|---|---|
| NVDA | 2026-02-12 | 186.94 | 189232900 |
| TSLA | 2026-02-12 | 417.07 | 61705600 |
| AAPL | 2026-02-12 | 261.73 | 80867900 |
| MU | 2026-02-12 | 413.97 | 45428900 |
| AMZN | 2026-02-12 | 199.60 | 83686500 |

NVDA was the biggest name by traded dollar value on 2026-02-12 — about $35 billion in notional, more than TSLA, AAPL, MU, and AMZN individually. The `notional` expression is never projected to the output columns but it still governs the sort order.

#### CASE in ORDER BY for custom sequences

The `CASE` expression lets you impose an explicit ordering that does not follow the natural sort of any base column. This is the canonical pattern for "these specific values first, then everything else alphabetically" requirements.

*Return NVDA, then AAPL, then MSFT, in that fixed priority order.*

```sql
SELECT TOP (3)
    symbol,
    trade_date,
    close_price
FROM dbo.stock_prices
WHERE symbol IN ('AAPL','MSFT','NVDA')
  AND trade_date = '2026-02-12'
ORDER BY
    CASE symbol
        WHEN 'NVDA' THEN 1
        WHEN 'AAPL' THEN 2
        WHEN 'MSFT' THEN 3
    END;
```

| symbol | trade_date | close_price |
|---|---|---|
| NVDA | 2026-02-12 | 186.94 |
| AAPL | 2026-02-12 | 261.73 |
| MSFT | 2026-02-12 | 401.84 |

The `CASE` assigns a synthetic sort key to each row: NVDA=1, AAPL=2, MSFT=3. The three rows come back in that order regardless of the alphabetical sort of the symbol column.

#### Sort by ordinal position (discouraged)

> [!warning] `ORDER BY 1, 2` is valid but fragile
>
> T-SQL accepts positive integers in the `ORDER BY` list as a shorthand for "the N-th column in the SELECT list". This shorthand is legal but brittle: if the `SELECT` list is ever reordered or a new column is inserted, the ordinal reference silently starts sorting by a different column. Reviewers also have to count columns to understand the intent.

*Legal but fragile: sort by the second column descending, then the first ascending.*

```sql
SELECT TOP (5)
    symbol,
    trade_date,
    close_price
FROM dbo.stock_prices
WHERE symbol = 'AAPL'
ORDER BY 2 DESC, 1 ASC;
```

| symbol | trade_date | close_price |
|---|---|---|
| AAPL | 2026-02-12 | 261.73 |
| AAPL | 2026-02-11 | 275.50 |
| AAPL | 2026-02-10 | 273.68 |
| AAPL | 2026-02-09 | 274.62 |
| AAPL | 2026-02-06 | 277.86 |

> [!success] Reference columns by name
>
> Replace `ORDER BY 2 DESC, 1 ASC` with `ORDER BY trade_date DESC, symbol ASC`. The named form is self-documenting and survives column re-ordering in the `SELECT` list.

## TOP, WITH TIES, OFFSET, and FETCH

> [!abstract] Row limiting and pagination
>
> T-SQL offers two row-limiting constructs:
>
> - `TOP` — limits the result to a fixed number (or percentage) of rows. Preferred for "give me the N biggest / newest / highest" use cases.
> - `OFFSET`/`FETCH` — sits on the `ORDER BY` clause and implements ordered pagination for APIs and UIs.
>
> Key rules:
>
> - The two constructs cannot be combined in the same query expression.
> - Both require an `ORDER BY` to be deterministic.
> - `TOP WITH TIES` and `OFFSET`/`FETCH` both **require** `ORDER BY` at the syntax level, not just for determinism.

### TOP

`TOP` limits the result set to the first N rows (or first N percent) of the ordered result. Without an `ORDER BY`, the "first" rows are whichever rows the execution plan returns first, which is nondeterministic and must not be relied on for business logic.

The Microsoft [TOP (Transact-SQL)](https://learn.microsoft.com/en-us/sql/t-sql/queries/top-transact-sql) reference documents the full syntax. Key rules:

- `TOP (n)` with parentheses is the modern form and is required when `n` is an expression or parameter.
- `TOP` cannot be combined with `OFFSET`/`FETCH` in the same query expression.
- `TOP` without `ORDER BY` is legal but nondeterministic.

#### TOP (n) with ORDER BY

*Return the five highest closing prices across all symbols for 2026-02-12.*

```sql
SELECT TOP (5)
    symbol,
    trade_date,
    close_price
FROM dbo.stock_prices
WHERE trade_date = '2026-02-12'
ORDER BY close_price DESC;
```

| symbol | trade_date | close_price |
|---|---|---|
| NVR | 2026-02-12 | 8096.16 |
| BKNG | 2026-02-12 | 4159.10 |
| AZO | 2026-02-12 | 3788.71 |
| KLAC | 2026-02-12 | 1450.85 |
| MTD | 2026-02-12 | 1357.92 |

The top five by close price are all nominally high-priced names: NVR trades above $8,000, BKNG above $4,000, and AZO above $3,700. These figures reflect raw share price, not market capitalization.

#### TOP (n) PERCENT

`TOP (n) PERCENT` returns the specified percentage of rows instead of a fixed count. The percentage is computed on the number of rows the query would return **before** the `TOP` is applied, so `TOP (1) PERCENT` on a 17,500-row result returns 175 rows.

*Return the top 1% of rows from 2026 by close price.*

```sql
SELECT TOP (1) PERCENT
    symbol,
    trade_date,
    close_price
FROM dbo.stock_prices
WHERE trade_date >= '2026-01-01'
ORDER BY close_price DESC;
```

| symbol | trade_date | close_price |
|---|---|---|
| NVR | 2026-02-11 | 8097.25 |
| NVR | 2026-02-12 | 8096.16 |
| NVR | 2026-02-10 | 8094.28 |
| NVR | 2026-02-05 | 8044.79 |
| NVR | 2026-02-04 | 8025.84 |

... (truncated to 5 rows)

All five visible rows belong to NVR, which dominates the top of the price distribution. In this dataset 2026 has roughly 15,500 rows, so 1 percent is about 155 rows — all the highest-priced NVR and BKNG days of the year. Use `TOP PERCENT` for "top quartile" or "top decile" style reporting where the absolute count of rows does not matter.

### WITH TIES

`WITH TIES` modifies `TOP (n)` so that any extra rows whose sort key matches the n-th row are also included. This makes the result potentially larger than `n` but guarantees that no tied row is arbitrarily excluded from "top n".

> [!info] WITH TIES requires ORDER BY
>
> The `WITH TIES` option is only valid when `ORDER BY` is present, because "tied with the n-th row" is only defined against an explicit sort order. SQL Server rejects `TOP (n) WITH TIES` without `ORDER BY` at parse time.

#### Show top N including tied values

*Return the top 3 rows by score, plus any extra rows tied with the 3rd row.*

```sql
SELECT TOP (3) WITH TIES
    score,
    label
FROM (VALUES
    (10, 'A'),
    (10, 'B'),
    (9,  'C'),
    (9,  'D'),
    (9,  'E'),
    (8,  'F')
) AS t(score, label)
ORDER BY score DESC;
```

| score | label |
|---|---|
| 10 | B |
| 10 | A |
| 9 | D |
| 9 | E |
| 9 | C |

The top 3 by `score DESC` would normally be the two rows with score 10 plus one row with score 9, for three rows total. Because rows C, D, and E are all tied at score 9, `WITH TIES` keeps all three, expanding the result from 3 to 5 rows. The ordering among the tied rows (D, E, C) is not guaranteed because there is no tie-breaker in the `ORDER BY`.

Use `WITH TIES` when the business rule is literally "top N including ties". Do not use it when the caller expects an exact row count — the expanded result set is unbounded in the worst case (if every row ties at the boundary, the entire table is returned).

#### WITH TIES requires ORDER BY (error demo)

> [!failure] TOP WITH TIES without ORDER BY is rejected at parse time
>
> SQL Server raises error 1062 before the query even begins execution.

*Attempt to use `WITH TIES` without an `ORDER BY` clause.*

```sql
SELECT TOP (3) WITH TIES
    symbol,
    close_price
FROM dbo.stock_prices;
```

```text
Msg 1062, Level 16, State 1
The TOP N WITH TIES clause is not allowed without a corresponding ORDER BY clause.
```

> [!success] Always specify an ORDER BY with WITH TIES
>
> The sort order is required both for WITH TIES to have meaning and for the result to be reproducible. See the WITH TIES demo above for the correct pattern.

### OFFSET and FETCH pagination

`OFFSET` and `FETCH` attach to the `ORDER BY` clause and implement ordered pagination. `OFFSET n ROWS` skips the first `n` rows of the ordered result; `FETCH NEXT m ROWS ONLY` returns the next `m` rows after the offset. Together they form the standard "page N of size M" query pattern.

Key rules from the Microsoft [ORDER BY clause](https://learn.microsoft.com/en-us/sql/t-sql/queries/select-order-by-clause-transact-sql) reference:

- `OFFSET` is part of `ORDER BY`. You cannot use `OFFSET` without `ORDER BY` — the parser rejects it.
- `FETCH` is optional. `OFFSET n ROWS` on its own skips the first `n` rows and returns every remaining row.
- `ROW` and `ROWS` are interchangeable, as are `FIRST` and `NEXT`. The canonical form is `OFFSET n ROWS FETCH NEXT m ROWS ONLY`.
- `OFFSET`/`FETCH` and `TOP` cannot coexist in the same query expression.
- Requires SQL Server 2012 (11.x) or later.

#### Offset-based pagination

*Retrieve the third page of a 5-row-per-page ordering of 2026-02-12 close prices.*

```sql
SELECT
    symbol,
    trade_date,
    close_price
FROM dbo.stock_prices
WHERE trade_date = '2026-02-12'
ORDER BY close_price DESC, symbol ASC
OFFSET 10 ROWS
FETCH NEXT 5 ROWS ONLY;
```

| symbol | trade_date | close_price |
|---|---|---|
| BLK | 2026-02-12 | 1055.63 |
| LLY | 2026-02-12 | 1038.27 |
| COST | 2026-02-12 | 998.86 |
| PH | 2026-02-12 | 982.21 |
| EQIX | 2026-02-12 | 957.87 |

These are rows 11 through 15 in the ordered 2026-02-12 close-price list. Ranks 1–10 (NVR, BKNG, AZO, KLAC, MTD, and five others) have been skipped by the offset.

> [!warning] Deep offsets become expensive and are not concurrency-safe
>
> The optimizer implements `OFFSET` by **scanning and discarding** the first `n` rows of the ordered result. On page 10 at 5 rows per page that is 50 discarded rows, which is cheap. On page 10,000 it is 50,000 discarded rows, which is not. Two concrete failure modes:
>
> - **Linear cost growth.** Interactive UIs that can jump to a deep page — for example a search-results screen with a "page 500" button — pay a cost proportional to the offset, not the page size.
> - **Concurrent-modification drift.** When the underlying rowset changes between page fetches (inserts or deletes at earlier offsets), `OFFSET`/`FETCH` can return duplicate rows on the next page or skip rows entirely. The offset is a *position* in a live result set, not a snapshot.

> [!success] Use keyset pagination for deep pages or concurrent workloads
>
> See the next subsection.

#### Keyset pagination alternative

**Keyset pagination** (also called "seek-based pagination") replaces the offset with a `WHERE` clause that remembers where the previous page ended. Instead of skipping N rows, the query asks SQL Server to resume from the first row that comes **after** a specific sort key, which can use an index seek directly. The Microsoft [Pagination - EF Core](https://learn.microsoft.com/en-us/ef/core/querying/pagination) documentation covers the pattern in depth.

Keyset pagination has two important properties:

- **Constant per-page cost.** The optimizer seeks directly to the starting key and reads `m` rows; the cost does not grow with the page number.
- **Concurrency-safe.** Inserting or deleting rows between pages cannot cause rows to be skipped or duplicated, because the resume key is an absolute position, not a relative offset.

It has one important limitation: it does not support random access. The reader can only navigate forward (or with a symmetric reverse query, backward) one page at a time. For "jump to page 50" UI requirements, use offset pagination and accept its limits.

The row-value syntax `WHERE (key_a, key_b) > (@last_a, @last_b)` is the idiomatic form for multi-column keyset pagination in most SQL dialects, but SQL Server's row-value support is limited and may not produce an index seek in every case. The portable rewrite uses an explicit `OR` chain over the compound key.

*Keyset page 1: first 5 rows, ordered by close_price DESC, symbol ASC.*

```sql
SELECT TOP (5)
    trade_date,
    symbol,
    close_price
FROM dbo.stock_prices
WHERE trade_date = '2026-02-12'
ORDER BY close_price DESC, symbol ASC;
```

| trade_date | symbol | close_price |
|---|---|---|
| 2026-02-12 | NVR | 8096.16 |
| 2026-02-12 | BKNG | 4159.10 |
| 2026-02-12 | AZO | 3788.71 |
| 2026-02-12 | KLAC | 1450.85 |
| 2026-02-12 | MTD | 1357.92 |

After reading page 1, the caller records the last row's sort key: `close_price = 900.70, symbol = 'COST'` (example values for illustration). The next page is produced by asking for rows that come strictly after that sort key.

*Keyset page 2: rows after the last sort key from page 1.*

```sql
SELECT TOP (5)
    trade_date,
    symbol,
    close_price
FROM dbo.stock_prices
WHERE trade_date = '2026-02-12'
  AND (close_price < 900.70
       OR (close_price = 900.70 AND symbol > 'COST'))
ORDER BY close_price DESC, symbol ASC;
```

| trade_date | symbol | close_price |
|---|---|---|
| 2026-02-12 | URI | 869.46 |
| 2026-02-12 | GEV | 816.56 |
| 2026-02-12 | REGN | 783.65 |
| 2026-02-12 | EME | 782.93 |
| 2026-02-12 | CAT | 758.29 |

The second page starts cleanly after `COST` at price 900.70 and continues down the ordered list. The same pattern scales indefinitely without the optimizer ever having to walk past previously returned rows.

#### OFFSET/FETCH requires ORDER BY (error demo)

> [!failure] OFFSET without ORDER BY is a parse error
>
> Because `OFFSET` is syntactically part of the `ORDER BY` clause, removing `ORDER BY` makes the `OFFSET` clause grammatically invalid. SQL Server raises errors 102 and 153.

*Attempt to use `OFFSET`/`FETCH` without an `ORDER BY` clause.*

```sql
SELECT
    symbol,
    close_price
FROM dbo.stock_prices
OFFSET 10 ROWS
FETCH NEXT 5 ROWS ONLY;
```

```text
Msg 102, Level 15, State 1
Incorrect syntax near '10'.
Msg 153, Level 15, State 2
Invalid usage of the option NEXT in the FETCH statement.
```

> [!success] Always attach OFFSET/FETCH to an ORDER BY
>
> Every paginated query must specify the sort order that defines which rows are "first", "next", and so on. Without the sort order, pagination has no meaning.

## DISTINCT, GROUP BY, and HAVING

> [!abstract] Deduplication and aggregation
>
> Three T-SQL constructs collapse or filter rowsets to remove duplicates or produce summary rows:
>
> - `DISTINCT` — step 9 in logical processing order. Eliminates duplicate result rows after projection.
> - `GROUP BY` — step 5. Collapses rows into one row per group and enables aggregate functions.
> - `HAVING` — step 7. Filters groups after aggregation has run.
>
> `GROUP BY` also supports advanced grouping extensions — `ROLLUP`, `CUBE`, and `GROUPING SETS` — that compute subtotals and grand totals in a single query.

### DISTINCT

`DISTINCT` removes duplicate rows from the `SELECT` output. It runs at step 9 of the logical processing order, after `SELECT` has projected the final column list, so two rows are considered duplicates only when every value in the projected column list matches. It is functionally equivalent to `GROUP BY` on every projected column with no aggregates.

Use `DISTINCT` only when duplicate elimination is genuinely part of the requirement. If duplicates appear unexpectedly in a query result, the right fix is usually to examine the join or the row grain — adding `DISTINCT` as a reflex hides data-model problems rather than fixing them.

#### Deduplicate a single column

*Return the first five distinct symbols in the table.*

```sql
SELECT DISTINCT TOP (5) symbol
FROM dbo.stock_prices
ORDER BY symbol;
```

| symbol |
|---|
| A |
| AAPL |
| ABBV |
| ABNB |
| ABT |

The query returns one row per unique symbol. Because `stock_prices` contains ~2500 rows per symbol, the underlying 1.2 million rows collapse to 500 distinct values (of which the first five are shown here).

#### DISTINCT treats NULL as one value

SQL Server's `DISTINCT` treats all `NULL` values as **equal** for deduplication purposes, collapsing them into a single row. This is different from how `NULL` behaves in three-valued logic comparisons, where `NULL = NULL` evaluates to `UNKNOWN`. The `DISTINCT` rule is explicit in the ANSI SQL standard and Microsoft's [GROUP BY (Transact-SQL)](https://learn.microsoft.com/en-us/sql/t-sql/queries/select-group-by-transact-sql) reference.

*Show that multiple NULL inputs collapse to one NULL in the DISTINCT output.*

```sql
SELECT DISTINCT v
FROM (VALUES
    (1), (2), (2), (NULL), (NULL), (3)
) AS t(v);
```

| v |
|---|
| NULL |
| 1 |
| 2 |
| 3 |

The source rowset has six rows: three distinct non-null values (1, 2, 3), one duplicate (2), and two NULLs. After `DISTINCT`, four rows remain — the three distinct non-nulls and a single NULL entry representing both of the input NULLs.

#### DISTINCT vs GROUP BY equivalence

For simple deduplication of the projected columns, `SELECT DISTINCT col1, col2, ...` and `SELECT col1, col2, ... GROUP BY col1, col2, ...` produce the same result and usually compile to the same execution plan. Prefer `DISTINCT` when the goal is literally "remove duplicate rows"; prefer `GROUP BY` when the query also includes aggregate functions or needs the grouping-extension features covered below.

*Equivalent rewrite of the DISTINCT query as a GROUP BY.*

```sql
SELECT symbol
FROM dbo.stock_prices
WHERE symbol IN ('AAPL','MSFT','NVDA','GOOG')
GROUP BY symbol
ORDER BY symbol;
```

| symbol |
|---|
| AAPL |
| GOOG |
| MSFT |
| NVDA |

Both the `DISTINCT` form and the `GROUP BY` form return the four distinct symbols. The `GROUP BY` form becomes more useful once the query adds aggregates — see the next subsection.

### GROUP BY

`GROUP BY` collapses multiple rows into one row per grouping key. Every column in the `SELECT` list must either appear in the `GROUP BY` list or be wrapped in an aggregate function (`COUNT`, `SUM`, `AVG`, `MIN`, `MAX`, and so on). If a grouping column contains `NULL` values, the Database Engine treats all NULLs as equal and collects them into a single group, following the same rule as `DISTINCT`.

Group only on the real business grain of the summary. Grouping by too many columns reproduces the original rowset instead of summarizing it, which defeats the purpose of the aggregation.

#### Basic grouping with aggregates

*Compute row count, first/last trade date, and average close price per symbol for 2025 onwards.*

```sql
SELECT TOP (5)
    symbol,
    COUNT(*)       AS row_count,
    MIN(trade_date) AS first_date,
    MAX(trade_date) AS last_date,
    AVG(close_price) AS avg_close
FROM dbo.stock_prices
WHERE trade_date >= '2025-01-01'
GROUP BY symbol
ORDER BY symbol;
```

| symbol | row_count | first_date | last_date | avg_close |
|---|---|---|---|---|
| A | 279 | 2025-01-02 | 2026-02-12 | 128.035089 |
| AAPL | 279 | 2025-01-02 | 2026-02-12 | 234.742795 |
| ABBV | 279 | 2025-01-02 | 2026-02-12 | 201.369713 |
| ABNB | 279 | 2025-01-02 | 2026-02-12 | 128.762688 |
| ABT | 279 | 2025-01-02 | 2026-02-12 | 126.640681 |

Every symbol has exactly 279 trading days between 2025-01-02 and 2026-02-12 — the same full trading-day range. The `avg_close` column is the mean daily close over that window. Because `avg_close` is an aggregate, it does not need to appear in `GROUP BY`; because `symbol` is not an aggregate, it does.

#### COUNT(*) vs COUNT(col) vs COUNT(1)

`COUNT` has three common forms with distinct semantics:

| Form | Counts | NULL handling |
|---|---|---|
| `COUNT(*)` | Every row in the group | Row is counted even if all columns are `NULL` |
| `COUNT(1)` | Every row in the group | Identical to `COUNT(*)` — the `1` is a non-null constant, not a column |
| `COUNT(col)` | Every row where `col IS NOT NULL` | `NULL` values in the column are skipped |
| `COUNT(DISTINCT col)` | Every distinct non-null value of `col` | `NULL` values in the column are skipped |

`COUNT(*)` and `COUNT(1)` are identical in behavior and performance — there is no optimization trick behind `COUNT(1)`, despite folklore that says otherwise. `COUNT(col)` is the form to use when the requirement is "how many rows have a value for this column".

*Compare the four COUNT variants on a set with NULLs and duplicates.*

```sql
SELECT
    COUNT(*)      AS count_star,
    COUNT(1)      AS count_one,
    COUNT(v)      AS count_col,
    COUNT(DISTINCT v) AS count_distinct
FROM (VALUES (1), (2), (2), (NULL), (NULL), (3)) AS t(v);
```

| count_star | count_one | count_col | count_distinct |
|---|---|---|---|
| 6 | 6 | 4 | 3 |

The source has six rows. `COUNT(*)` and `COUNT(1)` both return 6 (every row). `COUNT(v)` returns 4 because it skips the two NULL rows. `COUNT(DISTINCT v)` returns 3 because it collapses the duplicate `2` and skips NULLs, leaving `{1, 2, 3}`. `SUM` and `AVG` follow the same "skip NULLs" rule — `AVG(v)` on this set would return `(1+2+2+3)/4 = 2.00`, not `(1+2+2+3)/6`.

#### Grouping by multiple columns

When `GROUP BY` lists two or more columns, one result row is produced for each distinct combination of values in those columns.

*Count AAPL trading days grouped by year and month.*

```sql
SELECT TOP (5)
    YEAR(trade_date)  AS trade_year,
    MONTH(trade_date) AS trade_month,
    COUNT(*)          AS row_count
FROM dbo.stock_prices
WHERE symbol = 'AAPL'
  AND trade_date >= '2025-01-01'
GROUP BY YEAR(trade_date), MONTH(trade_date)
ORDER BY trade_year, trade_month;
```

| trade_year | trade_month | row_count |
|---|---|---|
| 2025 | 1 | 20 |
| 2025 | 2 | 19 |
| 2025 | 3 | 21 |
| 2025 | 4 | 21 |
| 2025 | 5 | 21 |

The result has one row per (year, month) combination. The counts reflect the number of US equity trading days in each calendar month — January 2025 has 20, February (a short month) has 19, March has 21, and so on.

#### ROLLUP for hierarchical subtotals

`GROUP BY ROLLUP (a, b, c)` computes the normal groupings plus subtotals at each level of the hierarchy and a grand total row. With `ROLLUP (year, month)` SQL Server produces: one row per (year, month), one row per year with `month = NULL`, and one grand-total row with both keys set to `NULL`. The Microsoft [GROUP BY (Transact-SQL)](https://learn.microsoft.com/en-us/sql/t-sql/queries/select-group-by-transact-sql) reference covers the semantics in detail.

> [!info] Use the modern `ROLLUP (...)` syntax
>
> The older `GROUP BY a, b WITH ROLLUP` form is deprecated and will be removed in a future SQL Server version. Always use `GROUP BY ROLLUP (a, b)`.

*Compute AAPL monthly volume for Q4 2025 with year-level and grand-total subtotal rows.*

```sql
SELECT
    YEAR(trade_date)  AS trade_year,
    MONTH(trade_date) AS trade_month,
    SUM(volume)       AS total_volume
FROM dbo.stock_prices
WHERE symbol = 'AAPL'
  AND trade_date >= '2025-10-01'
  AND trade_date <  '2026-01-01'
GROUP BY ROLLUP (YEAR(trade_date), MONTH(trade_date))
ORDER BY trade_year, trade_month;
```

| trade_year | trade_month | total_volume |
|---|---|---|
| NULL | NULL | 2899249200 |
| 2025 | NULL | 2899249200 |
| 2025 | 10 | 1097142200 |
| 2025 | 11 | 877578200 |
| 2025 | 12 | 924528800 |

The result contains five rows: three detail rows (one per month in Q4 2025), one year-level subtotal row (`trade_year = 2025, trade_month = NULL`, summing 1.097B + 877M + 924M = 2.899B), and one grand-total row (both keys `NULL`). Because the query window is restricted to Q4 2025 only, the year subtotal and the grand total happen to be the same value — with a wider window they would differ.

Distinguishing the subtotal `NULL`s from real `NULL` values in the data requires the `GROUPING()` function, covered two subsections below.

#### CUBE for all subgroup combinations

`GROUP BY CUBE (a, b)` computes every possible combination of groupings — `(a, b)`, `(a)`, `(b)`, and `()` (the grand total). For `n` grouping columns, CUBE produces `2^n` distinct grouping sets. Use it when the report needs subtotals along **every** axis of the data simultaneously.

*Total AAPL and MSFT volume grouped by symbol × year, with subtotals on every axis.*

```sql
SELECT
    symbol,
    YEAR(trade_date) AS trade_year,
    SUM(volume)      AS total_volume
FROM dbo.stock_prices
WHERE symbol IN ('AAPL','MSFT')
  AND trade_date >= '2025-01-01'
GROUP BY CUBE (symbol, YEAR(trade_date))
ORDER BY symbol, trade_year;
```

| symbol | trade_year | total_volume |
|---|---|---|
| NULL | NULL | 21802354000 |
| NULL | 2025 | 19092305000 |
| NULL | 2026 | 2710049000 |
| AAPL | NULL | 15128001600 |
| AAPL | 2025 | 13543944600 |

... (truncated to 5 rows)

The result rows shown include the grand total (`NULL, NULL`), the two year subtotals across both symbols (`NULL, 2025` and `NULL, 2026`), and the symbol-level subtotal for AAPL across both years (`AAPL, NULL`). The full result contains the two year × symbol detail rows plus these subtotal rows.

#### GROUPING SETS for explicit custom groupings

`GROUPING SETS` is the most flexible of the three extensions. It lets the query author specify exactly which grouping combinations to compute, rather than relying on the preset shapes of `ROLLUP` and `CUBE`. Both `ROLLUP` and `CUBE` are themselves shorthand for specific `GROUPING SETS` patterns.

*Compute the symbol × year detail rows, plus the symbol-level subtotals, plus the grand total — but not the year-level subtotals.*

```sql
SELECT
    symbol,
    YEAR(trade_date) AS trade_year,
    SUM(volume)      AS total_volume
FROM dbo.stock_prices
WHERE symbol IN ('AAPL','MSFT')
  AND trade_date >= '2025-01-01'
GROUP BY GROUPING SETS
(
    (symbol, YEAR(trade_date)),
    (symbol),
    ()
)
ORDER BY symbol, trade_year;
```

| symbol | trade_year | total_volume |
|---|---|---|
| NULL | NULL | 21802354000 |
| AAPL | NULL | 15128001600 |
| AAPL | 2025 | 13543944600 |
| AAPL | 2026 | 1584057000 |
| MSFT | NULL | 6674352400 |

... (truncated to 5 rows)

The result contains the symbol × year detail rows, the symbol-level subtotals (`AAPL, NULL` and `MSFT, NULL`), and the grand total (`NULL, NULL`). Compared to `CUBE`, this form **omits** the year-level subtotals (`NULL, 2025` and `NULL, 2026`) because they were not included in the `GROUPING SETS` list. This pattern is equivalent to `GROUP BY ROLLUP (symbol, YEAR(trade_date))`.

#### GROUPING() function to distinguish subtotal NULLs from data NULLs

Subtotal rows produced by `ROLLUP`, `CUBE`, or `GROUPING SETS` contain `NULL` in every column that is not part of their grouping key. This creates an ambiguity: a `NULL` in the output could mean "this is a subtotal row" or "this column genuinely contained `NULL` in the source data". The [GROUPING (Transact-SQL)](https://learn.microsoft.com/en-us/sql/t-sql/functions/grouping-transact-sql) function resolves the ambiguity by returning `1` for subtotal rows and `0` for detail rows.

*Use `GROUPING()` to label subtotal rows with human-readable text.*

```sql
SELECT
    CASE WHEN GROUPING(symbol)           = 1 THEN 'ALL SYMBOLS' ELSE symbol END AS symbol_label,
    CASE WHEN GROUPING(YEAR(trade_date)) = 1 THEN 'ALL YEARS'   ELSE CAST(YEAR(trade_date) AS varchar(10)) END AS year_label,
    SUM(volume) AS total_volume
FROM dbo.stock_prices
WHERE symbol IN ('AAPL','MSFT')
  AND trade_date >= '2025-01-01'
GROUP BY ROLLUP (symbol, YEAR(trade_date))
ORDER BY symbol, year_label;
```

| symbol_label | year_label | total_volume |
|---|---|---|
| ALL SYMBOLS | ALL YEARS | 21802354000 |
| AAPL | 2025 | 13543944600 |
| AAPL | 2026 | 1584057000 |
| AAPL | ALL YEARS | 15128001600 |
| MSFT | 2025 | 5548360400 |

... (truncated to 5 rows)

Subtotal rows now display as `ALL SYMBOLS` or `ALL YEARS` instead of `NULL`, making the report self-explanatory. `GROUPING()` can be called with any column that appears in the `GROUP BY` list and is valid in the `SELECT` list, `HAVING`, and `ORDER BY` clauses.

### HAVING

`HAVING` runs at step 7 of the logical processing order, immediately after `GROUP BY`. It filters entire groups based on conditions that reference aggregate functions (`COUNT(*)`, `SUM(...)`, `AVG(...)`, etc.) or columns that are in the grouping key. It is the only place in a `SELECT` statement where aggregates can appear inside a predicate.

The fundamental rule is: use `WHERE` for row-level predicates and `HAVING` for aggregate-level predicates. Moving a row predicate into `HAVING` when it could have been in `WHERE` forces SQL Server to aggregate rows it is about to throw away, which is wasteful.

#### Filter groups on an aggregate value

*Find symbols whose 2025 average close price is at least $500.*

```sql
SELECT TOP (5)
    symbol,
    AVG(close_price) AS avg_close,
    COUNT(*)         AS days
FROM dbo.stock_prices
WHERE trade_date >= '2025-01-01'
GROUP BY symbol
HAVING AVG(close_price) >= 500
ORDER BY avg_close DESC;
```

| symbol | avg_close | days |
|---|---|---|
| NVR | 7564.488064 | 279 |
| BKNG | 5127.194731 | 279 |
| AZO | 3720.775913 | 279 |
| FICO | 1712.473225 | 279 |
| TDG | 1317.398207 | 279 |

Only five S&P 500 symbols had a 2025 average close above $500: NVR, BKNG, AZO, FICO, and TDG. The `HAVING AVG(close_price) >= 500` predicate runs **after** the per-symbol average has been computed, so it filters groups rather than rows. A `WHERE close_price >= 500` clause would be incorrect because it would also exclude any individual low-price day from symbols whose average is above $500.

#### Do not move row predicates into HAVING

> [!warning] Moving a row predicate into HAVING is legal but wasteful
>
> SQL Server allows `HAVING` to reference any column that is in the `GROUP BY` list, not just aggregates. That means `HAVING symbol = 'AAPL'` is syntactically valid. But because `HAVING` runs after aggregation, this pattern forces the engine to aggregate every symbol in the table and then throw away every group except AAPL. The correct place for a row predicate is `WHERE`, which runs **before** `GROUP BY` and never materializes the unwanted groups in the first place.

*Anti-pattern: symbol filter placed in `HAVING` instead of `WHERE`.*

```sql
SELECT TOP (5)
    symbol,
    COUNT(*) AS days
FROM dbo.stock_prices
GROUP BY symbol
HAVING symbol = 'AAPL'
   AND COUNT(*) >= 1;
```

| symbol | days |
|---|---|
| AAPL | 2515 |

The result is correct — only AAPL's group survives — but SQL Server has had to compute `COUNT(*)` for all 500 symbols and then discard 499 of them.

> [!success] Push row predicates down into WHERE
>
> Rewrite the query as `WHERE symbol = 'AAPL' GROUP BY symbol HAVING COUNT(*) >= 1`. The `WHERE` clause filters `stock_prices` down to the AAPL rows before `GROUP BY` runs, so the engine aggregates only one symbol. The result is identical but the work is dramatically smaller.

## CASE, Conditional Projection, and Sorting Logic

> [!abstract] Conditional expressions
>
> `CASE` is the primary conditional expression in T-SQL. It evaluates a list of branches in order and returns the result of the first matching branch, or the `ELSE` value, or `NULL` if no branch matches and no `ELSE` is specified.
>
> `CASE` has two forms:
>
> - **simple** — compares a single expression to a list of values by equality
> - **searched** — evaluates arbitrary Boolean conditions
>
> Both forms can be used in any clause that accepts an expression, including `SELECT`, `WHERE`, `HAVING`, `ORDER BY`, and the inside of aggregate functions.
>
> This section covers:
>
> - the two forms
> - the use of `CASE` in `ORDER BY` for custom sort order
> - conditional counting inside aggregates
> - the data-type precedence trap that can cause `CASE` to raise a conversion error at runtime

### Searched CASE

The **searched CASE** form evaluates a list of Boolean expressions in order and returns the `THEN` value of the first branch whose Boolean expression evaluates to `TRUE`. It is the most flexible form and the most common in production code.

The Microsoft [CASE (Transact-SQL)](https://learn.microsoft.com/en-us/sql/t-sql/language-elements/case-transact-sql) reference documents the syntax. Key rules:

- Branches are evaluated in order. The first `TRUE` wins — subsequent branches are not evaluated.
- If no branch matches and no `ELSE` is specified, `CASE` returns `NULL`.
- The return type is determined by **data type precedence** across every `THEN` and `ELSE` expression — see the "type precedence trap" subsection below.
- `CASE` is an **expression**, not a statement. It cannot replace `IF` / `ELSE` for control-of-flow between statements; it only decides the value of a single expression.
- SQL Server allows up to 10 levels of `CASE` nesting inside a single expression.

#### Categorize a numeric value with searched CASE

*Bucket AAPL trading days by volume into high / medium / low bands.*

```sql
SELECT TOP (5)
    symbol,
    volume,
    CASE
        WHEN volume >= 100000000 THEN 'very high'
        WHEN volume >= 10000000  THEN 'high'
        WHEN volume >= 1000000   THEN 'medium'
        ELSE 'low'
    END AS volume_band
FROM dbo.stock_prices
WHERE symbol = 'AAPL'
  AND trade_date >= '2025-01-01'
ORDER BY trade_date;
```

| symbol | volume | volume_band |
|---|---|---|
| AAPL | 55740700 | high |
| AAPL | 40244100 | high |
| AAPL | 45045600 | high |
| AAPL | 40856000 | high |
| AAPL | 37628900 | high |

All five early-2025 AAPL trading days fall into the `high` band (between 10 million and 100 million shares). The branches are evaluated top-down: a row with volume 150 million would match the first branch and return `very high` without evaluating the remaining branches.

### Simple CASE

The **simple CASE** form compares a single expression to a list of literal values for equality. It is more compact than the searched form when the logic is a plain lookup, but it is limited to equality comparisons and cannot express ranges or compound conditions.

*Map a symbol to a human-readable company name.*

```sql
SELECT
    symbol,
    CASE symbol
        WHEN 'AAPL' THEN 'Apple'
        WHEN 'MSFT' THEN 'Microsoft'
        WHEN 'NVDA' THEN 'Nvidia'
        ELSE 'Other'
    END AS company
FROM (VALUES ('AAPL'), ('MSFT'), ('NVDA'), ('XOM')) AS t(symbol);
```

| symbol | company |
|---|---|
| AAPL | Apple |
| MSFT | Microsoft |
| NVDA | Nvidia |
| XOM | Other |

The simple form `CASE symbol WHEN 'AAPL' THEN ...` is equivalent to the searched form `CASE WHEN symbol = 'AAPL' THEN ...` but visually cleaner for equality-only mappings. Use the simple form for plain lookups and the searched form when any branch needs a range, a non-equality operator, or a compound Boolean.

### CASE in ORDER BY

`CASE` in `ORDER BY` produces a synthetic sort key, which is the canonical pattern for "these specific values first, then everything else" ordering requirements. See the `#### CASE in ORDER BY for custom sequences` subsection under `## SELECT, FROM, WHERE, and ORDER BY` for the full example. The cross-referenced query returns NVDA, AAPL, MSFT in that fixed priority order regardless of the alphabetical ordering of the symbol column.

### Conditional aggregation with CASE

Wrapping a `CASE` expression inside an aggregate function produces a **conditional count** or **conditional sum** — the aggregate only includes rows where the `CASE` branch matched. This pattern replaces what would otherwise require multiple correlated subqueries with a single `GROUP BY` pass over the data.

> [!info]- Conditional counting pattern
>
> Two idiomatic forms both count the rows in a group that satisfy a condition:
>
> - `SUM(CASE WHEN condition THEN 1 ELSE 0 END)` — adds 1 for matching rows and 0 for non-matching rows, so the sum equals the matching row count.
> - `COUNT(CASE WHEN condition THEN 1 END)` — relies on `COUNT` skipping `NULL` values from non-matching rows (where the `CASE` has no `ELSE` branch and therefore returns `NULL`).
>
> Both forms produce the same plan in most cases and are equivalent in result.

*Compute up-day / down-day / very-high-volume-day counts per symbol for 2025 onward.*

```sql
SELECT TOP (5)
    symbol,
    SUM(CASE WHEN close_price >= open_price THEN 1 ELSE 0 END) AS up_days,
    SUM(CASE WHEN close_price <  open_price THEN 1 ELSE 0 END) AS down_days,
    SUM(CASE WHEN volume >= 100000000 THEN 1 ELSE 0 END)       AS very_high_volume_days
FROM dbo.stock_prices
WHERE trade_date >= '2025-01-01'
GROUP BY symbol
ORDER BY symbol;
```

| symbol | up_days | down_days | very_high_volume_days |
|---|---|---|---|
| A | 137 | 142 | 0 |
| AAPL | 143 | 136 | 15 |
| ABBV | 152 | 127 | 0 |
| ABNB | 135 | 144 | 0 |
| ABT | 154 | 125 | 0 |

The result shows each symbol's 2025+ up-day and down-day counts in the same row. For the five symbols visible, `up_days + down_days` sums to 279 (the total number of trading days in the window), consistent with the per-symbol counts from the `GROUP BY` example earlier. Only AAPL had any days above the 100 million share threshold in this window — 15 such days out of 279.

### CASE branch type precedence trap

> [!danger] CASE branches must all reduce to a compatible type
>
> The return type of a `CASE` expression is determined by **data type precedence** across every `THEN` value and the `ELSE` value. If the branches return incompatible types (for example a `varchar` string and an `int` number), SQL Server picks the higher-precedence type according to the [Data type precedence](https://learn.microsoft.com/en-us/sql/t-sql/data-types/data-type-precedence-transact-sql) rules and attempts to convert every branch to that type. If any `THEN` value cannot be converted, the whole query fails at runtime with a conversion error — often in a way that is not obvious from reading the query text.

*Mixed-type branches: one string and two numbers — fails at runtime.*

```sql
SELECT
    v,
    CASE
        WHEN v < 10 THEN 'low'
        WHEN v < 20 THEN 5
        ELSE 100
    END AS mixed_branch
FROM (VALUES (5), (15), (25)) AS t(v);
```

```text
Msg 245, Level 16, State 1
Conversion failed when converting the varchar value 'low' to data type int.
```

The three branches return `varchar('low')`, `int(5)`, and `int(100)`. `int` has higher type precedence than `varchar`, so SQL Server tries to convert every branch result to `int`. The conversion of the literal `'low'` to `int` fails and the statement aborts.

> [!success] Return a consistent type from every branch
>
> Decide upfront what the `CASE` expression should return — a string label, a numeric code, or another well-defined type — and make every branch produce that type. If the branches genuinely need to mix categorical and numeric information, return them as separate columns instead of merging them into one.

*Safe rewrite: every branch returns a varchar.*

```sql
SELECT
    v,
    CASE
        WHEN v < 10 THEN 'low'
        WHEN v < 20 THEN 'medium'
        ELSE 'high'
    END AS v_band
FROM (VALUES (5), (15), (25)) AS t(v);
```

This form compiles and runs without a conversion error because all three branches return `varchar` values.

## Common Operators In Everyday Queries

> [!abstract] Predicate operators reference
>
> This section covers the six predicate constructs that appear in almost every T-SQL query:
>
> - `IN` — list or subquery membership
> - `NOT IN` — list or subquery non-membership (with a NULL trap)
> - `BETWEEN` — inclusive range (with a datetime trap)
> - `LIKE` — pattern matching with wildcards
> - `IS NULL` / `IS NOT NULL` — null tests
> - `EXISTS` / `NOT EXISTS` — semi-join existence tests
>
> Each construct has a canonical use case and one or more well-known traps. The first five are covered with concrete demos and paired warning/success callouts where a trap exists; `EXISTS`/`NOT EXISTS` are covered briefly because the sibling note on joins and subqueries owns the deeper treatment.

### IN

`IN` tests membership against a fixed list of values or a subquery. It is syntactic sugar for a chain of `OR`-ed equality comparisons: `col IN (a, b, c)` is equivalent to `col = a OR col = b OR col = c`. Use `IN` instead of long `OR` chains for readability. The Microsoft [IN (Transact-SQL)](https://learn.microsoft.com/en-us/sql/t-sql/language-elements/in-transact-sql) reference documents both forms.

#### IN with a static list

*Return the four named tech symbols on 2026-02-12.*

```sql
SELECT TOP (5)
    symbol,
    trade_date,
    close_price
FROM dbo.stock_prices
WHERE symbol IN ('AAPL', 'MSFT', 'NVDA', 'TSLA')
  AND trade_date = '2026-02-12'
ORDER BY symbol;
```

| symbol | trade_date | close_price |
|---|---|---|
| AAPL | 2026-02-12 | 261.73 |
| MSFT | 2026-02-12 | 401.84 |
| NVDA | 2026-02-12 | 186.94 |
| TSLA | 2026-02-12 | 417.07 |

`IN` against a literal list is SARGable — the optimizer evaluates each literal as a separate equality seek and unions the results. For very large lists (thousands of values), prefer loading the list into a temporary table or table variable and joining against it; SQL Server can raise errors 8623 or 8632 on extremely long `IN` lists.

#### IN with a subquery

*Return the five most expensive Information Technology sector symbols on 2026-02-12, joined from `esg_dash`.*

```sql
SELECT TOP (5)
    symbol,
    trade_date,
    close_price
FROM dbo.stock_prices
WHERE symbol IN
(
    SELECT symbol
    FROM dbo.esg_dash
    WHERE sector = 'Information Technology'
)
  AND trade_date = '2026-02-12'
ORDER BY close_price DESC;
```

| symbol | trade_date | close_price |
|---|---|---|
| KLAC | 2026-02-12 | 1450.85 |
| FICO | 2026-02-12 | 1337.64 |
| MPWR | 2026-02-12 | 1155.93 |
| TDY | 2026-02-12 | 646.30 |
| SNDK | 2026-02-12 | 630.29 |

The subquery returns the list of Information Technology sector symbols, which the outer query then filters on. This form is equivalent to a semi-join and is often rewritten by the optimizer as an `EXISTS`-style inner join.

### NOT IN

`NOT IN` tests non-membership against a fixed list or a subquery. It is syntactic sugar for a chain of `AND`-ed inequality comparisons: `col NOT IN (a, b, c)` is equivalent to `col <> a AND col <> b AND col <> c`. The equivalence matters because it exposes the `NULL` trap: if any right-hand value is `NULL`, the corresponding inequality evaluates to `UNKNOWN`, which propagates through `AND` and causes the whole predicate to fail.

#### NOT IN with a static non-null list

*Exclude AAPL and MSFT from a small VALUES set.*

```sql
SELECT TOP (5)
    symbol,
    close_price
FROM
(
    VALUES ('AAPL', 150.0),
           ('MSFT', 400.0),
           ('NVDA', 800.0),
           ('TSLA', 250.0),
           ('GOOG', 180.0)
) AS t(symbol, close_price)
WHERE symbol NOT IN ('AAPL', 'MSFT')
ORDER BY symbol;
```

| symbol | close_price |
|---|---|
| GOOG | 180.0 |
| NVDA | 800.0 |
| TSLA | 250.0 |

The result excludes AAPL and MSFT as expected. `NOT IN` against a literal list with no `NULL` values is safe and produces the intuitive result.

#### NOT IN with NULL in the subquery — silently wrong

> [!danger] NOT IN with any NULL on the right silently drops every row
>
> When the right-hand side of `NOT IN` contains even a single `NULL`, the entire predicate becomes `UNKNOWN` for every row on the left, and every row is excluded from the result. This is not a SQL Server quirk — it is the standard three-valued logic defined by the ANSI SQL specification. The query runs successfully, returns zero rows, and gives no warning that the data was silently filtered to nothing.

*Demo: excluding 'AAPL' via a subquery that also contains a NULL row — result is empty.*

```sql
SELECT symbol
FROM (VALUES ('AAPL'), ('MSFT'), ('NVDA')) AS t(symbol)
WHERE symbol NOT IN
(
    SELECT blocked_symbol
    FROM (VALUES ('AAPL'), (NULL)) AS b(blocked_symbol)
);
```

```text
(0 rows)
```

The expected result would have been `MSFT` and `NVDA` (the two symbols not on the block list). Instead every row is excluded because `MSFT NOT IN ('AAPL', NULL)` evaluates to `(MSFT <> 'AAPL') AND (MSFT <> NULL)`, which is `TRUE AND UNKNOWN`, which is `UNKNOWN`. The outer `WHERE` keeps only rows where the predicate is `TRUE`, so no rows survive.

> [!success] Use NOT EXISTS instead of NOT IN when NULLs are possible
>
> `NOT EXISTS` is immune to this trap because it uses a correlated subquery with explicit equality joins rather than an `IN` list. The predicate is `TRUE` whenever the subquery returns no matching rows and `FALSE` otherwise — no `UNKNOWN` results arise.

*Correct version using `NOT EXISTS`.*

```sql
SELECT t.symbol
FROM (VALUES ('AAPL'), ('MSFT'), ('NVDA')) AS t(symbol)
WHERE NOT EXISTS
(
    SELECT 1
    FROM (VALUES ('AAPL'), (NULL)) AS b(blocked_symbol)
    WHERE b.blocked_symbol = t.symbol
);
```

| symbol |
|---|
| MSFT |
| NVDA |

The result is the two symbols not on the block list, regardless of the `NULL` row. `NOT EXISTS` is the safer default for exclusion patterns even when the current data is known to be non-null, because data can change.

### BETWEEN

`BETWEEN a AND b` tests whether a value falls within a closed interval — **inclusive on both ends**. It is equivalent to `col >= a AND col <= b`. The Microsoft [BETWEEN (Transact-SQL)](https://learn.microsoft.com/en-us/sql/t-sql/language-elements/between-transact-sql) reference documents the semantics.

`BETWEEN` is safe and readable for integer ranges and date-only columns. It becomes dangerous with `datetime`/`datetime2` columns when the upper bound is specified as a midnight literal, because midnight is `00:00:00` — the predicate then excludes every event that happened later on the same day.

#### Integer range

*Select integers in the closed interval [5, 15].*

```sql
SELECT
    v
FROM (VALUES (1), (5), (10), (15), (20)) AS t(v)
WHERE v BETWEEN 5 AND 15;
```

| v |
|---|
| 5 |
| 10 |
| 15 |

Both boundary values (5 and 15) are included in the result. This is the intuitive behavior and the canonical use case for `BETWEEN`.

#### BETWEEN datetime boundary trap

> [!danger] `BETWEEN '2025-01-01' AND '2025-01-31'` on a datetime column silently drops most of January 31
>
> The literal `'2025-01-31'` is interpreted as `2025-01-31 00:00:00.000` — midnight at the start of the day. The predicate `event_ts <= '2025-01-31 00:00:00'` therefore excludes every event from 00:00:01 onward on January 31. The query runs, returns some rows for January 31, and silently drops the rest.

*Datetime BETWEEN that misses most of January 31.*

```sql
SELECT
    event_ts
FROM (VALUES
    (CAST('2025-01-31 00:00:00' AS datetime2)),
    (CAST('2025-01-31 08:30:00' AS datetime2)),
    (CAST('2025-01-31 23:59:59' AS datetime2)),
    (CAST('2025-02-01 00:00:00' AS datetime2))
) AS t(event_ts)
WHERE event_ts BETWEEN '2025-01-01' AND '2025-01-31';
```

| event_ts |
|---|
| 2025-01-31 00:00:00 |

Only the midnight row from January 31 is included. The 08:30 and 23:59:59 rows from the same day are silently excluded because their timestamps are greater than `2025-01-31 00:00:00.000`.

> [!success] Use half-open ranges for datetime filters
>
> Replace `BETWEEN start AND end_inclusive` with `>= start AND < next_period_start`. This form is unambiguous, matches the way humans naturally describe periods ("all of January 2025 = from Jan 1 to Feb 1"), and is fully SARGable.

*Half-open range that correctly includes every January 31 event.*

```sql
SELECT
    event_ts
FROM (VALUES
    (CAST('2025-01-31 00:00:00' AS datetime2)),
    (CAST('2025-01-31 08:30:00' AS datetime2)),
    (CAST('2025-01-31 23:59:59' AS datetime2)),
    (CAST('2025-02-01 00:00:00' AS datetime2))
) AS t(event_ts)
WHERE event_ts >= '2025-01-01'
  AND event_ts <  '2025-02-01';
```

| event_ts |
|---|
| 2025-01-31 00:00:00 |
| 2025-01-31 08:30:00 |
| 2025-01-31 23:59:59 |

All three January 31 events are now included; the February 1 midnight event is correctly excluded.

### LIKE

`LIKE` tests whether a string matches a simple pattern. T-SQL supports four wildcard characters:

| Wildcard | Matches |
|---|---|
| `%` | Zero or more characters |
| `_` | Exactly one character |
| `[ ]` | Any single character inside the brackets (character class) |
| `[^ ]` | Any single character **not** inside the brackets (negated class) |

#### Prefix match

*Find distinct symbols that start with `AA`.*

```sql
SELECT DISTINCT TOP (5) symbol
FROM dbo.stock_prices
WHERE symbol LIKE 'AA%'
ORDER BY symbol;
```

| symbol |
|---|
| AAPL |

A pattern with `%` only at the end is a prefix match and is SARGable — the optimizer translates it to a range scan between `'AA'` and `'AB'`. Leading wildcards (`'%AA'`) are **not** SARGable and force a full scan; see the `## SARGability` section for the trap and the recommended workarounds.

#### Single-character wildcard

*Match three-character strings that start with `A` and end with `C`.*

```sql
SELECT symbol
FROM (VALUES ('ABC'), ('ADC'), ('AXC'), ('AXYC')) AS t(symbol)
WHERE symbol LIKE 'A_C';
```

| symbol |
|---|
| ABC |
| ADC |
| AXC |

`_` matches exactly one character. The four-character string `'AXYC'` is excluded because it has two characters between the `A` and `C`.

#### Character class

*Match strings of the form `A1` or `A2` but not `A3` or `AX`.*

```sql
SELECT symbol
FROM (VALUES ('A1'), ('A2'), ('A3'), ('AX')) AS t(symbol)
WHERE symbol LIKE 'A[12]';
```

| symbol |
|---|
| A1 |
| A2 |

The `[12]` character class matches a single character that is either `1` or `2`. Ranges inside brackets are also legal — `[0-9]` matches a single digit, `[a-z]` matches a single lowercase letter, and `[^0-9]` matches any non-digit.

#### ESCAPE clause for literal wildcards

When the pattern must contain a literal `%` or `_` character, use the `ESCAPE` clause to declare an escape character that precedes any literal wildcard. Any character can be the escape character.

*Find rows whose value contains a literal percent sign.*

```sql
SELECT v
FROM (VALUES ('100%'), ('10%20'), ('abc'), ('a_b')) AS t(v)
WHERE v LIKE '%\%%' ESCAPE '\';
```

| v |
|---|
| 100% |
| 10%20 |

The pattern `'%\%%'` with `ESCAPE '\'` is read as "any prefix, a literal `%`, any suffix". The result correctly includes both `'100%'` and `'10%20'` and excludes `'abc'` and `'a_b'`.

### IS NULL and IS NOT NULL

`NULL` in SQL represents an unknown or missing value. Under the default `ANSI_NULLS ON` setting, any comparison involving `NULL` — including `col = NULL` and `col <> NULL` — evaluates to `UNKNOWN`, which is treated as `FALSE` by `WHERE`. The correct way to test for `NULL` is the explicit `IS NULL` or `IS NOT NULL` predicate, which returns a real Boolean. The Microsoft [Handling null values](https://learn.microsoft.com/en-us/sql/connect/ado-net/sql/handle-null-values) reference covers the full three-valued logic truth tables.

#### Test for NULL explicitly

*Label each value as NULL or NOT NULL using IS NULL.*

```sql
SELECT v, CASE WHEN v IS NULL THEN 'NULL' ELSE 'NOT NULL' END AS status
FROM (VALUES (1), (NULL), (2), (NULL)) AS t(v);
```

| v | status |
|---|---|
| 1 | NOT NULL |
| NULL | NULL |
| 2 | NOT NULL |
| NULL | NULL |

The `IS NULL` predicate correctly identifies the two NULL rows. The `CASE` expression converts the Boolean outcome to a human-readable label.

#### `= NULL` is silently wrong

> [!danger] `WHERE v = NULL` never returns rows when ANSI_NULLS is ON
>
> The equality operator `=` uses two-valued logic with `NULL` as an `UNKNOWN`, and `UNKNOWN` is filtered out by `WHERE`. Writing `WHERE v = NULL` is a common mistake among engineers coming from non-SQL languages. The query runs, returns zero rows, and gives no indication that the predicate is wrong.

*Query that silently returns zero rows because of `= NULL`.*

```sql
SELECT v
FROM (VALUES (1), (NULL), (2)) AS t(v)
WHERE v = NULL;
```

```text
(0 rows)
```

The source has a NULL row that the query clearly intended to find, but `v = NULL` evaluates to `UNKNOWN` for every row including the NULL one, so no rows are returned.

> [!success] Always use IS NULL / IS NOT NULL
>
> Replace `= NULL` with `IS NULL` and `<> NULL` with `IS NOT NULL`. These are the only forms that correctly handle NULL values under ANSI_NULLS ON (which is the default and cannot be disabled in new features of SQL Server).

### EXISTS and NOT EXISTS

`EXISTS` tests whether a subquery returns at least one row. It returns `TRUE` as soon as the first row is produced and short-circuits — the inner query does not need to enumerate all rows. `EXISTS` is the canonical way to express a **semi-join** (filter the outer query by whether a matching row exists in another set) and is usually clearer than joining tables just to test existence and then adding `DISTINCT` to eliminate the multiplication of rows.

Deeper coverage of `EXISTS`, correlated subqueries, and their relationship to joins lives in the sibling note on [joins, subqueries, and APPLY](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/03-joins-subqueries-and-apply). This subsection shows the core pattern and the `NOT EXISTS` variant.

#### EXISTS to test for matching rows

*Return dim_symbol rows that have at least one 2026 trading row in stock_prices.*

```sql
SELECT TOP (5) d.symbol
FROM dbo.dim_symbol AS d
WHERE EXISTS
(
    SELECT 1
    FROM dbo.stock_prices AS p
    WHERE p.symbol = d.symbol
      AND p.trade_date >= '2026-01-01'
)
ORDER BY d.symbol;
```

| symbol |
|---|
| A |
| AAPL |
| ABBV |
| ABNB |
| ABT |

The inner `SELECT 1` is a convention — the column list inside an `EXISTS` subquery is not used; only the existence of rows matters. `SELECT *`, `SELECT 1`, and `SELECT p.symbol` are all equivalent inside `EXISTS`. Every symbol in `dim_symbol` has matching 2026 data in `stock_prices`, so the first five rows alphabetically are returned.

#### NOT EXISTS to test for missing rows

*Find symbols from a candidate list that are not present in `dim_symbol`.*

```sql
SELECT symbol
FROM (VALUES ('AAPL'), ('MSFT'), ('NVDA'), ('FAKESYM')) AS t(symbol)
WHERE NOT EXISTS
(
    SELECT 1
    FROM dbo.dim_symbol AS d
    WHERE d.symbol = t.symbol
);
```

| symbol |
|---|
| FAKESYM |

`AAPL`, `MSFT`, and `NVDA` are all real S&P 500 symbols and have matching rows in `dim_symbol`, so they are excluded by the `NOT EXISTS`. Only `FAKESYM` remains. As documented in the `NOT IN` subsection above, `NOT EXISTS` is the safer default for exclusion patterns because it is immune to the `NULL`-propagation trap that can silently empty `NOT IN` result sets.

### Summary reference table

| Construct | Best use | Main caution |
|---|---|---|
| `IN` | Matching against a short list of values or a subquery | For very large lists (thousands), load into a temp table to avoid errors 8623/8632 |
| `NOT IN` | Exclusion against a **trusted non-null** set | Any `NULL` in the right-hand set silently empties the result |
| `BETWEEN` | **Integer** or **date-only** inclusive ranges | Inclusive on both ends; unsafe for `datetime`/`datetime2` day windows |
| `LIKE 'abc%'` | Prefix matching | Leading wildcard `%abc` is not SARGable |
| `LIKE 'A_C'` | Single-character positional match | Different from `%` (zero-or-more) |
| `LIKE 'A[0-9]'` | Character class match | Use `[^...]` for negated class |
| `LIKE '...\%...' ESCAPE '\'` | Literal `%` or `_` in the pattern | Any character can be the escape, but it must be declared |
| `IS NULL` / `IS NOT NULL` | True null tests | Never use `= NULL` or `<> NULL` |
| `EXISTS` | Positive semi-join / existence test | Column list inside the subquery is irrelevant |
| `NOT EXISTS` | Negative semi-join / exclusion | Preferred over `NOT IN` when NULLs are possible |

## Query Writing Habits That Prevent Problems

This section is a short checklist of habits covered in full detail elsewhere in the note. Each item links to the subsection that shows the concrete example and the safer alternative.

- **Use explicit column lists.** Never `SELECT *` in persistent code. See the `#### SELECT * — avoid in production code` subsection.
- **Make every row-limit deterministic.** Every `TOP`, `OFFSET`, or `FETCH` query must include an `ORDER BY` with a unique tie-breaker. See the `#### Multi-column sort with a tie-breaker` and `### OFFSET and FETCH pagination` subsections.
- **Filter early, aggregate late.** Push row predicates into `WHERE` before `GROUP BY`. See the `#### Do not move row predicates into HAVING` subsection.
- **Keep indexed columns bare in predicates.** Wrapping an indexed column in `YEAR()`, `CAST()`, `ISNULL()`, or similar defeats the index. See the `## SARGability` section.
- **Prefer half-open date ranges over `BETWEEN` for datetime columns.** See the `#### BETWEEN datetime boundary trap` subsection.
- **Use `NOT EXISTS` instead of `NOT IN` when the right-hand side can contain NULL.** See the `#### NOT IN with NULL in the subquery — silently wrong` subsection.
- **Test for NULL with `IS NULL` / `IS NOT NULL`, never `= NULL`.** See the `#### \`= NULL\` is silently wrong` subsection.
- **Match parameter types to column types.** Implicit conversion on the indexed side of a comparison defeats the index. See the `#### Implicit conversion on the indexed side` subsection.


