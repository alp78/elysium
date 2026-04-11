---
title: "03 - Joins, Subqueries, and APPLY"
tags: [sql-server, tsql, query-writing]
aliases: [JOIN reference, EXISTS and subqueries, CROSS APPLY, OUTER APPLY, set operators, anti-join, semi-join, PIVOT]
description: "T-SQL reference for row-combination patterns: INNER/LEFT/RIGHT/FULL OUTER JOIN, CROSS JOIN and self joins, anti-joins and semi-joins, scalar and correlated subqueries, EXISTS/NOT EXISTS, CROSS APPLY and OUTER APPLY, UNION/UNION ALL/EXCEPT/INTERSECT set operators, and PIVOT/UNPIVOT transposition."
created: 2026-04-08
updated: 2026-04-11
status: complete
---

# Joins, Subqueries, and APPLY

> [!abstract] Scope of this note
>
> This note owns every row-combination pattern in T-SQL:
>
> - **Joins** — `INNER JOIN`, `LEFT OUTER JOIN`, `RIGHT OUTER JOIN`, `FULL OUTER JOIN`, `CROSS JOIN`, and self joins.
> - **Anti-joins and semi-joins** — `NOT EXISTS`, `LEFT JOIN ... WHERE IS NULL`, `EXISTS`, and the trap comparisons between them.
> - **Subqueries** — scalar, row-valued, and table-valued; correlated vs non-correlated; the error 512 "multi-row scalar subquery" trap.
> - **APPLY operators** — `CROSS APPLY` and `OUTER APPLY` for row-wise derived sets, per-row top-N, and table-valued functions.
> - **Set operators** — `UNION`, `UNION ALL`, `EXCEPT`, `INTERSECT` with precedence rules and the duplicate-preservation contrast.
> - **`PIVOT` and `UNPIVOT`** — transposing rows to columns and columns to rows, with the `CROSS APPLY (VALUES ...)` modern alternative.
>
> Physical join operators (nested loops, merge join, hash match, adaptive join) and performance tuning belong to the query-plan sibling note. Window functions belong to the window-functions sibling note and are referenced here where they replace a correlated subquery pattern.

## INNER JOIN, LEFT JOIN, RIGHT JOIN, and FULL OUTER JOIN

> [!abstract] Join family overview
>
> The Microsoft [Joins (SQL Server)](https://learn.microsoft.com/en-us/sql/relational-databases/performance/joins) reference defines five logical join types:
>
> - `[ INNER ] JOIN` — returns only rows where the `ON` condition matches.
> - `LEFT [ OUTER ] JOIN` — returns all rows from the left side plus matching right-side rows; unmatched right-side columns are `NULL`.
> - `RIGHT [ OUTER ] JOIN` — the mirror of `LEFT JOIN`. Kept in the language for completeness; idiomatic T-SQL prefers `LEFT JOIN` with the tables written in the opposite order.
> - `FULL [ OUTER ] JOIN` — returns all rows from both sides; unmatched columns are `NULL` on whichever side is missing.
> - `CROSS JOIN` — the Cartesian product of both sides. No `ON` clause. Covered in the next H2 section.
>
> The `OUTER` keyword is optional in `LEFT`, `RIGHT`, and `FULL` — `LEFT JOIN` and `LEFT OUTER JOIN` are synonyms. The `INNER` keyword is optional too — a bare `JOIN` is an `INNER JOIN`. Use the explicit forms in production code so the reader doesn't have to guess the author's intent.
>
> The table below summarizes the retention rules:
>
> | Join type | Left rows kept when no match | Right rows kept when no match |
> |---|---|---|
> | `INNER JOIN` | No | No |
> | `LEFT OUTER JOIN` | Yes, with NULL right columns | No |
> | `RIGHT OUTER JOIN` | No | Yes, with NULL left columns |
> | `FULL OUTER JOIN` | Yes, with NULL right columns | Yes, with NULL left columns |
> | `CROSS JOIN` | All-to-all; no match concept | All-to-all |

### INNER JOIN

`INNER JOIN` keeps only rows where the `ON` condition evaluates to `TRUE`. Rows where the condition is `FALSE` or `UNKNOWN` (the latter happens when either side is `NULL`) are discarded from both sides. It is the default join type in business queries and the correct choice whenever unmatched rows carry no meaning.

#### Basic INNER JOIN between dimension and fact

*Join every symbol in the symbol dimension to its row in the ESG dashboard to enrich it with sector and rating.*

```sql
SELECT TOP (5)
    d.symbol,
    e.sector,
    e.esgrating
FROM dbo.dim_symbol AS d
INNER JOIN dbo.esg_dash AS e
    ON d.symbol = e.symbol
ORDER BY d.symbol;
```

| symbol | sector | esgrating |
|---|---|---|
| A | Health Care | Low |
| AAPL | Information Technology | Low |
| ABBV | Health Care | Low |
| ABNB | Consumer Discretionary | Low |
| ABT | Health Care | Low |

The `ON d.symbol = e.symbol` predicate keeps only rows where both sides have a matching symbol. In this dataset every `dim_symbol` row has a corresponding `esg_dash` row, so the `INNER JOIN` output matches the `dim_symbol` row count of 500. If a symbol existed in `dim_symbol` but not in `esg_dash`, `INNER JOIN` would silently drop it — use `LEFT JOIN` if the dimension side must be preserved.

#### Multi-column ON clause and self-join

The `ON` clause can contain arbitrary Boolean expressions, not just single-column equalities. Multi-column joins, range joins (`<`, `>`, `BETWEEN`), and expression-based joins (`DATEADD`, `LEFT`, etc.) are all supported.

> [!info]- Clause-by-clause walkthrough
>
> 1. `FROM dbo.stock_prices AS cur` — alias the "current day" copy of the table.
> 2. `INNER JOIN dbo.stock_prices AS prev` — alias the "7-days-prior" copy of the same table; this is a self-join.
> 3. `ON cur.symbol = prev.symbol AND prev.trade_date = DATEADD(day, -7, cur.trade_date)` — two-part join condition: match on symbol **and** on the 7-day-prior trade date.
> 4. `WHERE cur.symbol = 'AAPL' AND cur.trade_date >= '2026-02-01'` — restrict the output to AAPL's February 2026 rows.
> 5. `ORDER BY cur.trade_date` — chronological order.
>
> Because this is an `INNER JOIN`, days where the 7-day-prior date is **not** a trading day (for example if `2026-01-01` was a market holiday) are silently dropped. If those rows must be preserved with `NULL` on the prior side, switch to `LEFT JOIN`.

*Self-join `stock_prices` to itself with a 7-day offset to compute each day's 7-day change.*

```sql
SELECT TOP (5)
    cur.symbol,
    cur.trade_date,
    cur.close_price AS current_close,
    prev.close_price AS prev_close,
    cur.close_price - prev.close_price AS day_change
FROM dbo.stock_prices AS cur
INNER JOIN dbo.stock_prices AS prev
    ON cur.symbol = prev.symbol
   AND prev.trade_date = DATEADD(day, -7, cur.trade_date)
WHERE cur.symbol = 'AAPL'
  AND cur.trade_date >= '2026-02-01'
ORDER BY cur.trade_date;
```

| symbol | trade_date | current_close | prev_close | day_change |
|---|---|---|---|---|
| AAPL | 2026-02-02 | 269.76 | 255.17 | 14.59 |
| AAPL | 2026-02-03 | 269.23 | 258.03 | 11.20 |
| AAPL | 2026-02-04 | 276.23 | 256.20 | 20.03 |
| AAPL | 2026-02-05 | 275.65 | 258.04 | 17.61 |
| AAPL | 2026-02-06 | 277.86 | 259.24 | 18.62 |

Five consecutive trading days in early February 2026, each showing AAPL's close price and the close price exactly 7 calendar days prior. AAPL was in a strong uptrend that week — the 7-day change was positive for every row shown, ranging from $11.20 to $20.03 per share.

#### Ambiguous column error 209

> [!failure] Unqualified column names raise error 209 when the column exists in more than one joined table
>
> When the same column name exists in two or more tables in a join, SQL Server cannot unambiguously resolve an unqualified reference to that column in the `SELECT` list, `WHERE` clause, or anywhere else. It raises error 209 "Ambiguous column name".

*Trigger error 209 by selecting `symbol` without qualifying which table it comes from.*

```sql
SELECT
    symbol,
    trade_date,
    sector
FROM dbo.stock_prices
INNER JOIN dbo.esg_dash
    ON dbo.stock_prices.symbol = dbo.esg_dash.symbol;
```

```text
Msg 209, Level 16, State 1
Ambiguous column name 'symbol'.
```

Both `dbo.stock_prices` and `dbo.esg_dash` contain a column named `symbol`, so the unqualified `SELECT symbol` cannot be bound to either one. The error is raised even though the two columns always hold the same value because of the `ON` condition — the binder does not perform that analysis.

> [!success] Alias every table and qualify every column
>
> The idiomatic fix is twofold: alias every table source on its first appearance, and qualify every column reference with the alias. This removes ambiguity, keeps column references short, and survives any future schema change that adds the same column name to another table in the query.

*Qualified-alias fix with filter conditions on both sides of the join.*

```sql
SELECT TOP (5)
    s.symbol,
    s.trade_date,
    e.sector
FROM dbo.stock_prices AS s
INNER JOIN dbo.esg_dash AS e
    ON s.symbol = e.symbol
WHERE s.trade_date = '2026-02-12'
  AND e.sector = 'Information Technology'
ORDER BY s.symbol;
```

| symbol | trade_date | sector |
|---|---|---|
| AAPL | 2026-02-12 | Information Technology |
| ACN | 2026-02-12 | Information Technology |
| ADBE | 2026-02-12 | Information Technology |
| ADI | 2026-02-12 | Information Technology |
| ADSK | 2026-02-12 | Information Technology |

Every column reference now carries its table alias (`s.symbol`, `s.trade_date`, `e.sector`), so the binder knows exactly which column to resolve. The query also filters by trade date and sector to produce a small, meaningful rowset: the Information Technology sector symbols with their 2026-02-12 trading data.

### LEFT JOIN

`LEFT [ OUTER ] JOIN` returns every row from the left side, plus any matching rows from the right side. Unmatched left-side rows are still returned, but the right-side columns are filled with `NULL`. This is the correct join type when the **left** side is the required driving set — typically a dimension table or a base fact table that must appear in the result regardless of whether a matching row exists on the right.

The `OUTER` keyword is optional. `LEFT JOIN` and `LEFT OUTER JOIN` are exact synonyms.

#### Basic LEFT JOIN with every dim_symbol row preserved

*Left-join `dim_symbol` to `esg_dash` to enrich every symbol with its ESG score (even symbols with no ESG data would appear with NULL columns).*

```sql
SELECT TOP (5)
    d.symbol,
    e.sector,
    e.totalesgscore
FROM dbo.dim_symbol AS d
LEFT JOIN dbo.esg_dash AS e
    ON d.symbol = e.symbol
ORDER BY d.symbol;
```

| symbol | sector | totalesgscore |
|---|---|---|
| A | Health Care | 10.0 |
| AAPL | Information Technology | 15.2 |
| ABBV | Health Care | 18.6 |
| ABNB | Consumer Discretionary | 16.0 |
| ABT | Health Care | 16.8 |

In this dataset every `dim_symbol` row has a matching `esg_dash` row, so the `LEFT JOIN` output is identical to what an `INNER JOIN` would produce. The moment a symbol is added to `dim_symbol` without a matching `esg_dash` entry, the two join types diverge: `INNER JOIN` silently drops it, `LEFT JOIN` keeps it with `NULL` ESG columns.

#### LEFT JOIN + WHERE on right side silently becomes INNER JOIN

> [!danger] The single most common LEFT JOIN bug
>
> Applying a filter to the right-side table in the `WHERE` clause silently converts a `LEFT JOIN` back into an `INNER JOIN`. The reason is logical processing order: the `LEFT JOIN` runs first and produces matching rows plus unmatched left-side rows with `NULL` on the right. Then `WHERE` runs — and a predicate like `WHERE e.sector = 'X'` evaluates to `UNKNOWN` for every row where `e.sector` is `NULL` (from the unmatched left-side rows), which `WHERE` filters out. The net result is that every unmatched left-side row is silently discarded.

*Broken query: the `WHERE e.sector = 'Information Technology'` predicate converts the `LEFT JOIN` into an effective `INNER JOIN`.*

```sql
SELECT TOP (5)
    d.symbol,
    e.sector
FROM dbo.dim_symbol AS d
LEFT JOIN dbo.esg_dash AS e
    ON d.symbol = e.symbol
WHERE e.sector = 'Information Technology'
ORDER BY d.symbol;
```

| symbol | sector |
|---|---|
| AAPL | Information Technology |
| ACN | Information Technology |
| ADBE | Information Technology |
| ADI | Information Technology |
| ADSK | Information Technology |

The output looks "correct" — 5 tech companies — which is exactly what makes the bug so dangerous. The author probably expected to see all 500 `dim_symbol` rows with sector filled in only for tech symbols and `NULL` for everyone else. Instead they got 69 rows (tech only) and silently lost 431 non-tech rows.

The row-count query below makes the damage visible side-by-side:

*Compare the three row counts: base dimension, trap query, correct query.*

```sql
SELECT
    (SELECT COUNT(*) FROM dbo.dim_symbol) AS dim_symbol_count,
    (SELECT COUNT(*)
     FROM dbo.dim_symbol AS d
     LEFT JOIN dbo.esg_dash AS e ON d.symbol = e.symbol
     WHERE e.sector = 'Information Technology') AS trap_row_count,
    (SELECT COUNT(*)
     FROM dbo.dim_symbol AS d
     LEFT JOIN dbo.esg_dash AS e
         ON d.symbol = e.symbol
        AND e.sector = 'Information Technology') AS correct_row_count;
```

| dim_symbol_count | trap_row_count | correct_row_count |
|---|---|---|
| 500 | 69 | 500 |

`dim_symbol` has 500 rows. The trap query returns 69 — the 69 Information Technology sector symbols — and silently loses the other 431. The correct query returns all 500 `dim_symbol` rows with `sector` populated only for the 69 tech symbols and `NULL` for the remaining 431.

> [!success] Move right-side filters into the ON clause
>
> When filtering the right side of a `LEFT JOIN`, the predicate belongs in the `ON` clause, not `WHERE`. Predicates in `ON` are applied **during** the join; they only affect which right-side rows are considered for matching — unmatched left-side rows still pass through with `NULL`. Predicates in `WHERE` are applied **after** the join and treat all rows the same.
>
> The rule of thumb: **predicates on the outer (preserved) side go in `WHERE`; predicates on the inner (nullable) side go in `ON`.**

*Correct form: filter on the right side moved into the `ON` clause.*

```sql
SELECT TOP (5)
    d.symbol,
    e.sector
FROM dbo.dim_symbol AS d
LEFT JOIN dbo.esg_dash AS e
    ON d.symbol = e.symbol
   AND e.sector = 'Information Technology'
ORDER BY d.symbol;
```

| symbol | sector |
|---|---|
| A | NULL |
| AAPL | Information Technology |
| ABBV | NULL |
| ABNB | NULL |
| ABT | NULL |

All five shown rows are from `dim_symbol` sorted alphabetically. Only `AAPL` has a non-null `sector` because it is the only Information Technology symbol in the top 5 alphabetically. The other four rows show `NULL` in the sector column — exactly what the author originally intended. The full result set has 500 rows, 69 with sector populated and 431 with `NULL`.

#### Nullability after LEFT JOIN

A column defined as `NOT NULL` in the base table can appear as `NULL` in the result set of a `LEFT JOIN` whenever the join produces an unmatched right-side row. This is the most common way `NULL` values enter queries that never stored `NULL` in the source data. Downstream logic that references the column must handle `NULL` defensively. See [02-data-types-conversion-and-null-handling](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/02-data-types-conversion-and-null-handling#null-introduction-via-left-join) for the full treatment.

### RIGHT JOIN

`RIGHT [ OUTER ] JOIN` is the exact mirror of `LEFT JOIN` — it preserves the right-side rows instead of the left-side rows. The `OUTER` keyword is again optional. Functionally, any `RIGHT JOIN` can be rewritten as a `LEFT JOIN` with the two tables swapped, and that rewrite is usually more readable because it matches the "left-to-right, preserved first" reading pattern.

#### RIGHT JOIN as a mirror of LEFT JOIN

*Right-join `esg_dash` to `dim_symbol`, preserving the 500 `dim_symbol` rows on the right side.*

```sql
SELECT TOP (5)
    e.symbol,
    e.sector,
    d.symbol AS dim_symbol
FROM dbo.esg_dash AS e
RIGHT JOIN dbo.dim_symbol AS d
    ON d.symbol = e.symbol
ORDER BY d.symbol;
```

| symbol | sector | dim_symbol |
|---|---|---|
| A | Health Care | A |
| AAPL | Information Technology | AAPL |
| ABBV | Health Care | ABBV |
| ABNB | Consumer Discretionary | ABNB |
| ABT | Health Care | ABT |

This produces the same rowset as `dbo.dim_symbol LEFT JOIN dbo.esg_dash ON ...` — both preserve the 500 `dim_symbol` rows. The `RIGHT JOIN` form forces the reader to mentally swap the table order to understand which side is preserved, which is why it is considered less readable.

> [!tip] Prefer LEFT JOIN with tables written in the opposite order
>
> Any `A RIGHT JOIN B ON ...` can be rewritten as `B LEFT JOIN A ON ...` with identical results. The rewritten form puts the preserved table first, which is the natural reading order. Reserve `RIGHT JOIN` for the rare case where swapping the tables would make the `ON` clause or the downstream `WHERE`/`ORDER BY` significantly harder to read.

### FULL OUTER JOIN

`FULL [ OUTER ] JOIN` preserves rows from **both** sides. Matched rows return both sides' columns; unmatched left-side rows return left columns with `NULL` right columns; unmatched right-side rows return `NULL` left columns with right columns populated. It is the correct join type for **reconciliation** and **diff-style** queries where the result must show what is present on one side but missing from the other.

#### FULL OUTER JOIN with all four match states

*Full-outer-join two inline VALUES rowsets that overlap partially.*

```sql
SELECT
    a.symbol AS left_symbol,
    b.symbol AS right_symbol
FROM (VALUES ('AAPL'), ('MSFT'), ('NVDA'), ('TSLA')) AS a(symbol)
FULL OUTER JOIN (VALUES ('MSFT'), ('NVDA'), ('GOOG')) AS b(symbol)
    ON a.symbol = b.symbol;
```

| left_symbol | right_symbol |
|---|---|
| AAPL | NULL |
| MSFT | MSFT |
| NVDA | NVDA |
| TSLA | NULL |
| NULL | GOOG |

The output shows all three possible match states:

- **Matched rows** — `MSFT` and `NVDA` appear on both sides.
- **Only-in-left rows** — `AAPL` and `TSLA` appear in `a` but not in `b`, so `right_symbol` is `NULL`.
- **Only-in-right rows** — `GOOG` appears in `b` but not in `a`, so `left_symbol` is `NULL`.

#### Reconciliation pattern: find rows that exist in one set but not the other

A common use of `FULL OUTER JOIN` is reconciliation — identifying rows present in one source but missing from another. The idiom is to add a `WHERE` clause that keeps only the unmatched rows on either side.

*Return only the rows that appear in exactly one of the two sets.*

```sql
SELECT
    a.symbol AS only_in_set_a,
    b.symbol AS only_in_set_b
FROM (VALUES ('AAPL'), ('MSFT'), ('NVDA'), ('TSLA')) AS a(symbol)
FULL OUTER JOIN (VALUES ('MSFT'), ('NVDA'), ('GOOG')) AS b(symbol)
    ON a.symbol = b.symbol
WHERE a.symbol IS NULL
   OR b.symbol IS NULL;
```

| only_in_set_a | only_in_set_b |
|---|---|
| AAPL | NULL |
| TSLA | NULL |
| NULL | GOOG |

Three rows remain: `AAPL` and `TSLA` are in set `a` only; `GOOG` is in set `b` only. The two matched rows (`MSFT`, `NVDA`) are excluded by the `IS NULL` predicates. This pattern is the set-based equivalent of comparing two lists for differences — far faster than shuttling both sets through application code.

### Multi-table joins and ON clause ordering

When a single query contains multiple joins, the order matters for outer joins but not for inner joins. Inner joins are **commutative** and **associative** — `A INNER JOIN B INNER JOIN C` produces the same result regardless of how you parenthesize it or in what order you write the tables. Outer joins are **not**: `A LEFT JOIN B LEFT JOIN C` can produce different results depending on whether `C` joins to `A` or to `B`.

The rule of thumb: when mixing inner and outer joins in the same query, use parentheses to explicitly group the joins whose semantics you care about, or split the query into a CTE so each stage's semantics are obvious. The default left-to-right evaluation order is rarely what a non-author reader expects.

## CROSS JOIN and Self Joins

> [!abstract] Cartesian products and same-table joins
>
> This section covers two joins that do not fit the standard "left ↔ right with `ON` predicate" shape:
>
> - **`CROSS JOIN`** — returns every combination of left and right rows (the Cartesian product). Has no `ON` clause. Produces `left_rows × right_rows` output rows. Useful for calendar scaffolding and test grids; dangerous when accidentally created by forgetting the `ON` clause on an `INNER JOIN`.
> - **Self join** — joins a table to itself using different aliases. Covered by all the normal join types (`INNER`, `LEFT`, etc.), but gets its own subsection because the idioms and use cases are distinct: comparing adjacent rows, finding pairs within the same set, and computing row-to-row differences.

### CROSS JOIN

`CROSS JOIN` is the most basic join type: it pairs every left row with every right row, producing `m × n` output rows where `m` is the left row count and `n` is the right row count. Unlike every other join type it has no `ON` clause — the two sides are combined unconditionally.

`CROSS JOIN` is useful for deliberate scaffolding scenarios:

- **Calendar expansion** — generate a dense `(date, key)` rowset for every day and every dimension member.
- **Test grids** — enumerate all combinations of parameter values for a parameterized test suite.
- **Dimension combinations** — produce every possible `(sector, region, year)` triple before joining to a sparse fact table and filling gaps with aggregates of 0.

It is **dangerous** when created accidentally: forgetting the `ON` clause on an `INNER JOIN` silently produces a Cartesian product with hundreds of thousands or millions of rows. Modern T-SQL flags an `INNER JOIN` without `ON` as a parse error, but the old comma-join syntax (`FROM t1, t2 WHERE ...`) does not, which is one of several reasons to avoid the comma syntax entirely.

#### Deliberate CROSS JOIN for calendar expansion

*Generate a rowset of every `(date, symbol)` combination for two dates and three symbols.*

```sql
SELECT
    c.calendar_date,
    d.symbol
FROM (VALUES
    (CAST('2025-01-02' AS date)),
    (CAST('2025-01-03' AS date))
) AS c(calendar_date)
CROSS JOIN (VALUES ('AAPL'), ('MSFT'), ('NVDA')) AS d(symbol)
ORDER BY c.calendar_date, d.symbol;
```

| calendar_date | symbol |
|---|---|
| 2025-01-02 | AAPL |
| 2025-01-02 | MSFT |
| 2025-01-02 | NVDA |
| 2025-01-03 | AAPL |
| 2025-01-03 | MSFT |

... (truncated to 5 rows)

Two dates × three symbols = six total output rows (five shown). The output has one row per `(date, symbol)` combination regardless of whether actual trading data exists for that combination. This pattern is foundational for building gap-filled time series: generate the full `(date, symbol)` grid with `CROSS JOIN`, then `LEFT JOIN` the sparse fact table, then fill the missing fact values with `0` or `NULL` as the business requires.

#### CROSS JOIN row count formula

*Confirm that `CROSS JOIN` produces exactly `left_rows × right_rows` output rows.*

```sql
SELECT
    (SELECT COUNT(*) FROM (VALUES (1),(2),(3),(4),(5)) AS a(v)) AS left_rows,
    (SELECT COUNT(*) FROM (VALUES (10),(20),(30)) AS b(v))      AS right_rows,
    (SELECT COUNT(*)
     FROM (VALUES (1),(2),(3),(4),(5)) AS a(v)
     CROSS JOIN (VALUES (10),(20),(30)) AS b(v))                AS cross_join_rows;
```

| left_rows | right_rows | cross_join_rows |
|---|---|---|
| 5 | 3 | 15 |

5 × 3 = 15. The formula is unconditional and exact: for any `CROSS JOIN`, the output row count is the product of the input row counts.

#### Accidental Cartesian product

> [!danger] A CROSS JOIN between two large tables is a disaster
>
> The row count grows **multiplicatively**. A join between two 1-million-row tables without an `ON` clause produces 1 trillion rows, which will either exhaust memory, fill tempdb, or time out — whichever comes first. Most of the time the author intended an `INNER JOIN` and forgot the `ON` clause. Modern T-SQL catches the `INNER JOIN` form at parse time, but the legacy comma-join syntax (`FROM t1, t2 WHERE t1.id = t2.id`) silently produces a Cartesian product when the author forgets the `WHERE` predicate.

*Compare the correct `INNER JOIN` row count to the accidental Cartesian product row count on two real tables.*

```sql
SELECT
    (SELECT COUNT(*) FROM dbo.dim_symbol)  AS dim_rows,
    (SELECT COUNT(*) FROM dbo.esg_dash)    AS esg_rows,
    (SELECT COUNT(*)
     FROM dbo.dim_symbol AS d
     INNER JOIN dbo.esg_dash AS e
         ON d.symbol = e.symbol)            AS correct_joined_rows,
    (SELECT COUNT(*)
     FROM dbo.dim_symbol AS d
     CROSS JOIN dbo.esg_dash AS e)          AS cartesian_rows;
```

| dim_rows | esg_rows | correct_joined_rows | cartesian_rows |
|---|---|---|---|
| 500 | 500 | 495 | 250000 |

Each table has 500 rows. The correct `INNER JOIN` with `ON d.symbol = e.symbol` produces 495 rows — meaning 5 symbols in one table have no match in the other (a data-quality note unrelated to the join itself). The accidental `CROSS JOIN` produces 500 × 500 = 250,000 rows, which is 505× more than the intended result. On a production-size pair of tables the same mistake scales to millions or billions of rows.

> [!success] Always use explicit INNER JOIN with ON in production code
>
> T-SQL's explicit `INNER JOIN t2 ON ...` syntax makes the join predicate syntactically required — omitting it is a parse error. Never use the legacy comma-join form (`FROM t1, t2 WHERE ...`); it hides the join predicate in the `WHERE` clause where it is easy to forget and easy to overlook during review.

### Self joins

A **self join** is a join between a table and itself, using two different aliases. Self joins are used whenever the business question is about relationships **within** a single row set rather than between two tables: "each row's value compared to a previous row's", "pairs of rows that share some key", "hierarchies where children and parents live in the same table".

All the normal join types (`INNER`, `LEFT`, `RIGHT`, `FULL`) work with self joins. The only structural requirement is that the two references to the same table must have distinct aliases so the optimizer can tell them apart.

#### Row-to-row comparison (7-day price change)

The classic self-join pattern is comparing a row to a related row in the same table — for example, comparing each day's closing price to the price 7 days earlier. Using `LEFT JOIN` rather than `INNER JOIN` ensures that rows without a prior match are still returned with `NULL` on the prior side, instead of silently vanishing.

> [!info]- Clause-by-clause walkthrough
>
> 1. `FROM dbo.stock_prices AS cur` — alias the table as "current".
> 2. `LEFT JOIN dbo.stock_prices AS prev` — alias the same table again as "prior".
> 3. `ON prev.symbol = cur.symbol` — match on the same symbol (a self join would be nonsense without this — otherwise every symbol would be compared to every other symbol for the same date).
> 4. `AND prev.trade_date = DATEADD(day, -7, cur.trade_date)` — find the row that is exactly 7 calendar days earlier.
> 5. `WHERE cur.symbol = 'AAPL' AND cur.trade_date >= '2026-01-05'` — restrict to AAPL's early-January-2026 trading days.
> 6. `ORDER BY cur.trade_date` — chronological output.

*Self-join `stock_prices` to itself with a 7-day offset; use `LEFT JOIN` to preserve days where the prior date is not a trading day.*

```sql
SELECT TOP (5)
    cur.symbol,
    cur.trade_date,
    cur.close_price AS current_close,
    prev.close_price AS close_7d_prior
FROM dbo.stock_prices AS cur
LEFT JOIN dbo.stock_prices AS prev
    ON prev.symbol = cur.symbol
   AND prev.trade_date = DATEADD(day, -7, cur.trade_date)
WHERE cur.symbol = 'AAPL'
  AND cur.trade_date >= '2026-01-05'
ORDER BY cur.trade_date;
```

| symbol | trade_date | current_close | close_7d_prior |
|---|---|---|---|
| AAPL | 2026-01-05 | 267.01 | 273.50 |
| AAPL | 2026-01-06 | 262.11 | 272.82 |
| AAPL | 2026-01-07 | 260.09 | 271.61 |
| AAPL | 2026-01-08 | 258.80 | NULL |
| AAPL | 2026-01-09 | 259.13 | 270.76 |

The `2026-01-08` row shows `NULL` for `close_7d_prior`. The date exactly 7 days earlier is `2026-01-01` — New Year's Day — when the US equity market was closed. There is no `stock_prices` row for AAPL on that date, the `ON` clause finds no match, and the `LEFT JOIN` fills the prior side with `NULL`. This is exactly the behavior the query author wanted: market holidays produce a `NULL` change rather than silently vanishing from the output. Had this been an `INNER JOIN`, the `2026-01-08` row would have been dropped from the result entirely.

> [!tip] Prefer LAG() window function for adjacent-row comparison
>
> T-SQL's `LAG(col, n)` window function computes the same "value N rows earlier" result as a self join without the overhead of materializing two copies of the table and without the market-holiday complication. For rows that need the **previous trading day** (not a fixed calendar offset), `LAG(close_price, 1) OVER (PARTITION BY symbol ORDER BY trade_date)` is both simpler and faster. See the window functions sibling note for the full treatment.

#### Pair comparison (spread between two symbols on the same day)

Another common self-join pattern is finding pairs of rows that share a key and comparing their values. The trick is to add an inequality (`<` or `>`) on the join key to avoid producing both `(A, B)` and `(B, A)` as separate rows.

*Self-join `stock_prices` on the same trade date to compare AAPL and MSFT closes day by day.*

```sql
SELECT TOP (5)
    a.trade_date,
    a.symbol   AS sym_a,
    b.symbol   AS sym_b,
    a.close_price - b.close_price AS spread
FROM dbo.stock_prices AS a
INNER JOIN dbo.stock_prices AS b
    ON a.trade_date = b.trade_date
   AND a.symbol < b.symbol
WHERE a.symbol = 'AAPL'
  AND b.symbol = 'MSFT'
  AND a.trade_date >= '2026-02-01'
ORDER BY a.trade_date;
```

| trade_date | sym_a | sym_b | spread |
|---|---|---|---|
| 2026-02-02 | AAPL | MSFT | -153.61 |
| 2026-02-03 | AAPL | MSFT | -141.98 |
| 2026-02-04 | AAPL | MSFT | -137.96 |
| 2026-02-05 | AAPL | MSFT | -118.02 |
| 2026-02-06 | AAPL | MSFT | -123.28 |

The `a.symbol < b.symbol` predicate ensures each symbol pair appears only once — without it, the query would also return `(MSFT, AAPL)` rows, doubling the output and producing positive mirror-image spreads. The result shows AAPL's close price minus MSFT's close price on each trading day of early February 2026; all values are negative because MSFT traded $118 to $154 higher than AAPL on every day of the window.

## Anti-Joins and Semi-Joins

> [!abstract] Filtered joins that do not multiply rows
>
> A **semi-join** returns rows from the left side that have **at least one** matching row on the right side. Unlike `INNER JOIN`, it does not duplicate left-side rows when the right side has multiple matches. The left-side row is returned once if any match exists, zero times otherwise.
>
> An **anti-join** returns rows from the left side that have **no** matching rows on the right side. It is the exact complement of a semi-join.
>
> The terms come from formal relational algebra; T-SQL does not have dedicated `SEMI JOIN` or `ANTI JOIN` keywords, but it has three idiomatic ways to express each concept:
>
> | Pattern | Semi-join idiom | Anti-join idiom |
> |---|---|---|
> | `EXISTS` subquery | `WHERE EXISTS (SELECT 1 FROM ...)` | `WHERE NOT EXISTS (SELECT 1 FROM ...)` |
> | `IN` / `NOT IN` | `WHERE col IN (SELECT ...)` | `WHERE col NOT IN (SELECT ...)` ⚠️ NULL trap |
> | Outer join + null test | *(not idiomatic for semi-join)* | `LEFT JOIN ... WHERE right IS NULL` |
> | Set operator | `INTERSECT` | `EXCEPT` |
>
> Microsoft's execution plans explicitly label these operators: `EXCEPT` appears as a **Left Anti Semi Join** and `INTERSECT` as a **Left Semi Join** in the showplan output. Both `EXISTS`/`NOT EXISTS` usually compile to the same physical plans as their set-operator equivalents.

### Semi-join with EXISTS

`EXISTS (subquery)` returns `TRUE` if the subquery returns at least one row, regardless of what the subquery's columns contain. This is the canonical way to express a semi-join in T-SQL: the subquery answers "does a matching row exist?" and the outer query keeps the left-side row when the answer is yes.

#### EXISTS basic pattern

*Return the dimension rows whose symbol has at least one trade in February 2026.*

```sql
SELECT TOP (5) d.symbol
FROM dbo.dim_symbol AS d
WHERE EXISTS
(
    SELECT 1
    FROM dbo.stock_prices AS p
    WHERE p.symbol = d.symbol
      AND p.trade_date >= '2026-02-01'
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

Each `dim_symbol` row appears at most once in the output, even though the inner `stock_prices` table has dozens of matching rows per symbol for February 2026. That is the defining property of a semi-join: left-side rows are not duplicated by right-side multiplicity.

The `SELECT 1` inside `EXISTS` is a convention. The subquery's column list is irrelevant — `EXISTS` only checks whether rows are returned, not what they contain. `SELECT *`, `SELECT 1`, and `SELECT p.symbol` are all equivalent inside an `EXISTS` subquery, and the optimizer compiles them identically. Prefer `SELECT 1` as the clearest statement of intent: "I only care whether any row exists".

#### Semi-join anti-pattern: INNER JOIN + DISTINCT

> [!warning] INNER JOIN + DISTINCT is a semi-join written the hard way
>
> Before `EXISTS` was a universal idiom, developers often expressed "left rows that have matching right rows" by writing an `INNER JOIN` and then applying `DISTINCT` to remove the duplicates introduced by the multiplication. This works but is worse on every axis: it is harder to read (the author's intent is obscured), slower in most cases (the join materializes all the duplicates before `DISTINCT` removes them), and brittle to future changes (adding a column to the `SELECT` list can re-introduce duplicates in surprising ways).

*`DISTINCT` anti-pattern producing the same rowset as the `EXISTS` query above.*

```sql
SELECT DISTINCT TOP (5) d.symbol
FROM dbo.dim_symbol AS d
INNER JOIN dbo.stock_prices AS p
    ON p.symbol = d.symbol
WHERE p.trade_date >= '2026-02-01'
ORDER BY d.symbol;
```

| symbol |
|---|
| A |
| AAPL |
| ABBV |
| ABNB |
| ABT |

The result is identical to the `EXISTS` form above. The cost is not: without `DISTINCT`, each `dim_symbol` row would be duplicated once per matching `stock_prices` row (potentially hundreds of times per symbol). The join has to materialize all those duplicates before the `DISTINCT` operator collapses them, whereas `EXISTS` can short-circuit as soon as the first match is found for each left-side row.

> [!success] Use EXISTS for semi-joins
>
> `EXISTS` is more readable, more efficient, and more robust against changes to the `SELECT` list. Use it whenever the business question is "left rows that have at least one match on the right" — regardless of whether the right side has any columns the outer query needs.

### Anti-join with NOT EXISTS

`NOT EXISTS (subquery)` returns `TRUE` when the subquery returns zero rows. It is the canonical way to express an anti-join in T-SQL and the safest option by default — unlike `NOT IN`, it is immune to the NULL-propagation trap documented in [01-select-and-query-basics](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/01-select-and-query-basics#not-in) and [02-data-types-conversion-and-null-handling](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/02-data-types-conversion-and-null-handling).

#### NOT EXISTS basic pattern

*Find the symbols from a candidate list that do not appear in `dbo.dim_symbol`.*

```sql
SELECT symbol
FROM (VALUES ('AAPL'), ('MSFT'), ('NVDA'), ('FAKESYM'), ('NOTREAL')) AS t(symbol)
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
| NOTREAL |

Out of the five candidate symbols, `AAPL`, `MSFT`, and `NVDA` are all present in `dbo.dim_symbol` — they are filtered out by the `NOT EXISTS`. The remaining two (`FAKESYM`, `NOTREAL`) are not in the dimension table and are returned. This is the canonical "find rows from A that are missing from B" query shape.

### Anti-join with LEFT JOIN + IS NULL

The second anti-join idiom uses a `LEFT JOIN` followed by a `WHERE right_col IS NULL` predicate. It leverages the fact that `LEFT JOIN` fills the right-side columns with `NULL` when no match is found; filtering on `IS NULL` then keeps only the unmatched rows.

*Same anti-join expressed with `LEFT JOIN ... IS NULL`.*

```sql
SELECT t.symbol
FROM (VALUES ('AAPL'), ('MSFT'), ('NVDA'), ('FAKESYM'), ('NOTREAL')) AS t(symbol)
LEFT JOIN dbo.dim_symbol AS d
    ON d.symbol = t.symbol
WHERE d.symbol IS NULL;
```

| symbol |
|---|
| FAKESYM |
| NOTREAL |

The output is identical to the `NOT EXISTS` version. The two forms usually produce the same execution plan in modern SQL Server, but `NOT EXISTS` is recommended as the more self-documenting form — it says "I want the rows where no match exists" directly, whereas `LEFT JOIN ... IS NULL` requires the reader to reconstruct the intent from the combination of the outer join and the null test.

> [!warning] LEFT JOIN + IS NULL is fragile if the right-side column is nullable
>
> The `IS NULL` test assumes that the column being tested is `NOT NULL` in the base table, so any `NULL` in the result can only come from an unmatched `LEFT JOIN`. If the base column is itself nullable, the `IS NULL` test may return matched rows where the column happened to be `NULL` in the data, producing incorrect results. The standard workaround is to test on a primary key or other guaranteed-non-null column — but this requires the author to know which columns are nullable, which is exactly the kind of fragile assumption `NOT EXISTS` avoids.

### Anti-join with EXCEPT

The third idiom uses the `EXCEPT` set operator. As noted in the abstract above, Microsoft's execution plans label `EXCEPT` as a "Left Anti Semi Join" — it is a set-level anti-join that operates on entire rowsets rather than single-column filters.

*Same anti-join expressed with `EXCEPT`.*

```sql
SELECT symbol
FROM (VALUES ('AAPL'), ('MSFT'), ('NVDA'), ('FAKESYM'), ('NOTREAL')) AS t(symbol)
EXCEPT
SELECT symbol
FROM dbo.dim_symbol;
```

| symbol |
|---|
| FAKESYM |
| NOTREAL |

Again identical output. `EXCEPT` has two advantages over `NOT EXISTS` in specific cases:

- **Multi-column anti-joins** — `EXCEPT` naturally handles the "rows from A not in B" question when A and B have multiple columns, whereas `NOT EXISTS` requires the author to write out each column in the correlation clause.
- **Implicit deduplication** — `EXCEPT` is inherently distinct-based, so it removes duplicates from the left side automatically. `NOT EXISTS` preserves duplicates.

The drawback is that `EXCEPT` requires the two sides to have identical column counts and compatible types, and it operates on **full rowsets** rather than correlated per-row lookups. For a simple single-column anti-join, `NOT EXISTS` is usually more idiomatic; for multi-column set-level anti-joins, `EXCEPT` is worth reaching for. See the `## UNION, UNION ALL, EXCEPT, and INTERSECT` section below for the full treatment of set operators.

## Subqueries, EXISTS, and Correlated Subqueries

> [!abstract] Subquery taxonomy
>
> A **subquery** is a `SELECT` statement nested inside another statement. T-SQL supports three flavors based on what the subquery returns:
>
> - **Scalar subquery** — returns at most one row and one column. Used anywhere a scalar value is expected (`SELECT` list, `WHERE` predicate, computed column). Returning more than one row raises error 512 at runtime.
> - **Row subquery** — returns at most one row with multiple columns. Compared against a row value constructor with `(a, b, c) = (SELECT ...)`.
> - **Table subquery** — returns an entire rowset. Used in `FROM` (as a derived table) or as the right side of an `IN`, `ANY`, `ALL`, or `EXISTS` predicate.
>
> A subquery is **correlated** when it references columns from the outer query, and **non-correlated** (or "self-contained") when it does not. Correlated subqueries are conceptually evaluated once per outer row, though the optimizer often rewrites them into joins or APPLY operators for efficient execution. `EXISTS` is the most common form of correlated subquery.
>
> This section covers scalar subqueries (including the error 512 trap), correlated subqueries, and `EXISTS`/`NOT EXISTS`. Table subqueries used as derived tables are covered in the [FROM clause section of 01-select-and-query-basics](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/01-select-and-query-basics#from-clause-and-table-sources).

### Scalar subquery

A **scalar subquery** is a subquery that appears where a single scalar value is expected — typically in the `SELECT` list, in a `WHERE` predicate, or in a computed column definition. SQL Server requires the subquery to return **at most one row and one column**. Returning zero rows produces `NULL` (not an error), but returning more than one row raises error 512 and aborts the statement.

#### Scalar subquery in the SELECT list

*Use a scalar subquery to fetch each symbol's latest trade date from the fact table.*

```sql
SELECT TOP (5)
    d.symbol,
    (
        SELECT MAX(p.trade_date)
        FROM dbo.stock_prices AS p
        WHERE p.symbol = d.symbol
    ) AS latest_trade_date
FROM dbo.dim_symbol AS d
ORDER BY d.symbol;
```

| symbol | latest_trade_date |
|---|---|
| A | 2026-02-12 |
| AAPL | 2026-02-12 |
| ABBV | 2026-02-12 |
| ABNB | 2026-02-12 |
| ABT | 2026-02-12 |

The scalar subquery runs once per outer row, returning the single scalar value `MAX(p.trade_date)` for the correlated `d.symbol`. The `MAX()` aggregate guarantees at most one row is returned regardless of how many matching rows exist in `stock_prices`. Every symbol in this dataset has `2026-02-12` as its latest trade date — every S&P 500 constituent traded on the last day of the data window.

> [!tip] Scalar subqueries in the SELECT list are compiled as APPLY
>
> The SQL Server optimizer rewrites scalar subqueries in the `SELECT` list as `OUTER APPLY` during query compilation. The execution plan for the query above will show an `OUTER APPLY` operator rather than the textual scalar subquery — the two forms are semantically equivalent but APPLY is how the engine actually runs the query.

#### Scalar subquery returning zero rows returns NULL

When a scalar subquery matches no rows, SQL Server returns `NULL` rather than raising an error. This is the intended behavior and is useful for "lookup a value if it exists, otherwise use NULL" patterns.

*Scalar subquery that finds no matching rows — result is `NULL`, not an error.*

```sql
SELECT
    'test' AS label,
    (SELECT p.close_price
     FROM dbo.stock_prices AS p
     WHERE p.symbol = 'NONEXISTENT'
       AND p.trade_date = '2025-01-02') AS should_be_null;
```

| label | should_be_null |
|---|---|
| test | NULL |

The subquery searches for a symbol that does not exist in the table and returns zero rows. The outer query's `should_be_null` column is populated with `NULL`. This is the same behavior the scalar subquery would produce if the `close_price` column itself were `NULL` in the matched row — a subtle ambiguity that callers should handle with explicit `ISNULL` or `COALESCE` when the distinction matters.

#### Scalar subquery returning multiple rows: error 512

> [!failure] Error 512 — "Subquery returned more than 1 value"
>
> When a scalar subquery returns more than one row, SQL Server raises error 512 and aborts. The error message explicitly mentions that the subquery was used "as an expression" or after a comparison operator — both cases require a scalar value.

*Scalar subquery that returns multiple rows — triggers error 512.*

```sql
SELECT
    'test' AS label,
    (SELECT p.close_price
     FROM dbo.stock_prices AS p
     WHERE p.symbol = 'AAPL') AS multi_row;
```

```text
Msg 512, Level 16, State 1
Subquery returned more than 1 value. This is not permitted when the subquery
follows =, !=, <, <= , >, >= or when the subquery is used as an expression.
```

The subquery matches thousands of AAPL rows. Because the outer context requires a single scalar value, SQL Server cannot pick one and raises the error.

> [!success] Add an aggregate or use TOP (1) with ORDER BY
>
> Two idiomatic fixes:
>
> - Wrap the subquery in an aggregate like `MAX`, `MIN`, `SUM`, or `AVG` — the aggregate collapses many rows to one and guarantees scalar semantics.
> - Use `TOP (1) ... ORDER BY` inside the subquery to deterministically pick one row.
>
> The second form requires `ORDER BY` for determinism; without it, SQL Server picks whichever row the execution plan returns first, which is not reproducible.

*Fix: wrap the subquery in `MAX` to collapse the rowset to a single scalar.*

```sql
SELECT
    'test' AS label,
    (SELECT MAX(p.close_price)
     FROM dbo.stock_prices AS p
     WHERE p.symbol = 'AAPL') AS max_close;
```

| label | max_close |
|---|---|
| test | 285.92 |

The `MAX` aggregate returns a single value for AAPL's all-time highest close price in this dataset. The query succeeds.

### Correlated subquery

A **correlated subquery** is a subquery that references columns from the outer query. Conceptually it runs once per outer row, recomputing its result based on the correlated column values. In practice, the SQL Server optimizer often rewrites correlated subqueries as joins or APPLY operators so the inner query only executes once per **distinct** value of the correlation key — but the logical semantics are still "one execution per outer row".

Correlated subqueries are the foundation of `EXISTS` and `NOT EXISTS`, which are themselves special-case correlated subqueries that only test for row existence rather than computing a value.

#### Correlated subquery to compare a row to its own group average

*Find AAPL trading days where the close was above AAPL's own all-time average.*

> [!info]- Clause-by-clause walkthrough
>
> 1. `FROM dbo.stock_prices AS s` — the outer query iterates over AAPL's rows.
> 2. `WHERE s.symbol = 'AAPL'` — restrict the outer scan to AAPL only.
> 3. `WHERE s.close_price > (SELECT AVG(s3.close_price) FROM dbo.stock_prices AS s3 WHERE s3.symbol = s.symbol)` — for each outer row, compute the average close price of rows sharing the same symbol. The correlation is `s3.symbol = s.symbol`. Because we already filter to AAPL in the outer `WHERE`, the inner `AVG` is effectively "AVG of AAPL".
> 4. The `SELECT` list projects a second correlated scalar subquery so the reader can see the per-row average alongside the close price.

```sql
SELECT TOP (5)
    s.symbol,
    s.trade_date,
    s.close_price,
    (
        SELECT AVG(s2.close_price)
        FROM dbo.stock_prices AS s2
        WHERE s2.symbol = s.symbol
    ) AS avg_close_for_symbol
FROM dbo.stock_prices AS s
WHERE s.symbol = 'AAPL'
  AND s.close_price >
  (
      SELECT AVG(s3.close_price)
      FROM dbo.stock_prices AS s3
      WHERE s3.symbol = s.symbol
  )
ORDER BY s.trade_date;
```

| symbol | trade_date | close_price | avg_close_for_symbol |
|---|---|---|---|
| AAPL | 2020-08-21 | 120.75 | 116.917805 |
| AAPL | 2020-08-24 | 122.19 | 116.917805 |
| AAPL | 2020-08-25 | 121.19 | 116.917805 |
| AAPL | 2020-08-26 | 122.84 | 116.917805 |
| AAPL | 2020-08-27 | 121.37 | 116.917805 |

The five earliest AAPL trading days where the close price exceeded AAPL's all-time average of $116.92. August 2020 was the first time AAPL sustained a price significantly above its long-term mean — prior years had lower prices that pulled the average down. The `avg_close_for_symbol` column shows `116.917805` in every row, confirming the inner query returns the same value for every AAPL row (a non-surprising result of correlating on a single symbol).

> [!tip] Window functions usually replace correlated subqueries
>
> The pattern above — "compare each row to an aggregate over the same partition" — is the canonical window function use case. Rewriting the query with `AVG(close_price) OVER (PARTITION BY symbol)` computes the same per-symbol average with a single pass over the data, without the repeated subquery execution. The window function form is both more efficient and more concise. Use correlated subqueries when the inner computation is too complex for a window function, or when the partition key does not match the existing `PARTITION BY` syntax. See the window functions sibling note for details.

### EXISTS and NOT EXISTS

`EXISTS (subquery)` and `NOT EXISTS (subquery)` are the canonical T-SQL forms for semi-joins and anti-joins respectively. They were covered in depth in the `## Anti-Joins and Semi-Joins` section above — refer to that section for the full treatment including comparisons against `IN`/`NOT IN`, `INNER JOIN + DISTINCT`, `LEFT JOIN + IS NULL`, and `EXCEPT`/`INTERSECT`.

The short version:

- `EXISTS` is a correlated subquery that returns `TRUE` as soon as the first matching inner row is found, and `FALSE` otherwise. The optimizer short-circuits the inner query execution at the first match, making `EXISTS` significantly more efficient than an equivalent `COUNT(*) > 0` pattern.
- `NOT EXISTS` returns `TRUE` when the subquery returns zero rows. It is the safest anti-join idiom because it is immune to the `NULL`-propagation trap that affects `NOT IN`.
- The column list inside `EXISTS (SELECT ... FROM ...)` is irrelevant — `SELECT *`, `SELECT 1`, `SELECT NULL`, and `SELECT col` all compile identically. Prefer `SELECT 1` as the clearest statement of intent.

## CROSS APPLY and OUTER APPLY

> [!abstract] Row-wise derived rowsets with left-side correlation
>
> The `APPLY` operator is SQL Server's equivalent of the ANSI SQL `LATERAL` join. It joins each row of the left-side table source to a right-side derived rowset that **can reference columns from the left side**. This is the distinguishing feature: a plain `INNER JOIN` against a derived table cannot correlate to the outer query, while `APPLY` can.
>
> `APPLY` comes in two flavors, analogous to `INNER`/`LEFT` join:
>
> - **`CROSS APPLY`** — keeps the left row only if the right-side rowset returns at least one row. Rows where the right side is empty are dropped.
> - **`OUTER APPLY`** — keeps the left row even when the right-side rowset is empty. In that case, the right-side columns are filled with `NULL`.
>
> Canonical use cases for `APPLY`:
>
> - **Per-row top-N** — "get the most recent trade per symbol" using `TOP (n) ... ORDER BY` inside the APPLY subquery.
> - **Table-valued functions with left-side arguments** — `CROSS APPLY dbo.SomeTVF(left.col)`.
> - **Unnesting wide columns into rows** — `CROSS APPLY (VALUES (...), (...), (...))` as a modern replacement for `UNPIVOT`.
> - **Any correlated subquery that returns more than one column** — a scalar subquery can return only one column per outer row; APPLY can return a whole row.

### Why APPLY exists

The most important thing to understand about `APPLY` is **why it exists** as a distinct operator from `INNER JOIN` + derived table. Consider the query "for each symbol in `dim_symbol`, return the single most recent row from `stock_prices`". With a plain `INNER JOIN`, the natural attempt is:

```sql
-- THIS DOES NOT WORK
SELECT d.symbol, sub.latest_close
FROM dbo.dim_symbol AS d
INNER JOIN (
    SELECT TOP (1) close_price AS latest_close
    FROM dbo.stock_prices
    WHERE symbol = d.symbol  -- error: d.symbol not visible here
    ORDER BY trade_date DESC
) AS sub
    ON 1 = 1;
```

The derived table cannot reference `d.symbol` because SQL's scoping rules do not allow a subquery in `FROM` to see columns from sibling tables in the same `FROM`. `APPLY` removes exactly that restriction: the right-side subquery of `APPLY` **is** allowed to reference columns from the left-side table source.

### CROSS APPLY for per-row top-N

The canonical `CROSS APPLY` pattern is "get the top N rows from a related table for each outer row". It replaces what would otherwise require a self-join with `ROW_NUMBER()`, a correlated scalar subquery, or an impossible derived-table query.

> [!info]- Clause-by-clause walkthrough
>
> 1. `FROM dbo.dim_symbol AS d` — outer driver with one row per symbol.
> 2. `CROSS APPLY ( SELECT TOP (1) ... )` — for each `d.symbol`, evaluate the right-side subquery.
> 3. Inside the subquery: `SELECT TOP (1) p.trade_date, p.close_price FROM dbo.stock_prices AS p WHERE p.symbol = d.symbol ORDER BY p.trade_date DESC` — this is the key correlation: `p.symbol = d.symbol` references the outer table. `TOP (1) ... ORDER BY trade_date DESC` picks the latest-date row for that symbol.
> 4. `AS x` — alias the subquery result; columns are accessible as `x.trade_date` and `x.close_price` in the outer `SELECT` list.

*Find each symbol's latest trade date and close price.*

```sql
SELECT TOP (5)
    d.symbol,
    x.latest_date,
    x.latest_close
FROM dbo.dim_symbol AS d
CROSS APPLY
(
    SELECT TOP (1)
        p.trade_date  AS latest_date,
        p.close_price AS latest_close
    FROM dbo.stock_prices AS p
    WHERE p.symbol = d.symbol
    ORDER BY p.trade_date DESC
) AS x
ORDER BY d.symbol;
```

| symbol | latest_date | latest_close |
|---|---|---|
| A | 2026-02-12 | 124.88 |
| AAPL | 2026-02-12 | 261.73 |
| ABBV | 2026-02-12 | 227.50 |
| ABNB | 2026-02-12 | 115.96 |
| ABT | 2026-02-12 | 111.47 |

Every symbol's latest trading day is `2026-02-12` (the last day in the dataset), with its closing price. The `CROSS APPLY` subquery runs once per outer row in the logical model, though the optimizer typically rewrites this into a single pass with a backward index scan.

### CROSS APPLY vs OUTER APPLY: the difference when right side is empty

The distinction between `CROSS APPLY` and `OUTER APPLY` is visible only when the right-side subquery returns **zero rows** for some outer rows. `CROSS APPLY` drops those outer rows from the result (like `INNER JOIN`); `OUTER APPLY` keeps them with `NULL` columns on the right (like `LEFT JOIN`).

#### CROSS APPLY drops unmatched left rows

*Query a hand-crafted list of symbols, one of which (`FAKESYM`) does not exist in `stock_prices`.*

```sql
WITH SymbolList AS
(
    SELECT symbol FROM (VALUES ('AAPL'), ('MSFT'), ('FAKESYM'), ('NVDA')) AS t(symbol)
)
SELECT
    s.symbol,
    x.latest_close
FROM SymbolList AS s
CROSS APPLY
(
    SELECT TOP (1) p.close_price AS latest_close
    FROM dbo.stock_prices AS p
    WHERE p.symbol = s.symbol
    ORDER BY p.trade_date DESC
) AS x
ORDER BY s.symbol;
```

| symbol | latest_close |
|---|---|
| AAPL | 261.73 |
| MSFT | 401.84 |
| NVDA | 186.94 |

Only three rows are returned. `FAKESYM` is missing from the output because the `CROSS APPLY` subquery returned zero rows for that symbol (no `stock_prices` rows match), and `CROSS APPLY` drops the outer row when the subquery is empty. This mirrors `INNER JOIN` behavior.

#### OUTER APPLY keeps unmatched left rows with NULL

*Same query with `OUTER APPLY` instead of `CROSS APPLY`.*

```sql
WITH SymbolList AS
(
    SELECT symbol FROM (VALUES ('AAPL'), ('MSFT'), ('FAKESYM'), ('NVDA')) AS t(symbol)
)
SELECT
    s.symbol,
    x.latest_close
FROM SymbolList AS s
OUTER APPLY
(
    SELECT TOP (1) p.close_price AS latest_close
    FROM dbo.stock_prices AS p
    WHERE p.symbol = s.symbol
    ORDER BY p.trade_date DESC
) AS x
ORDER BY s.symbol;
```

| symbol | latest_close |
|---|---|
| AAPL | 261.73 |
| FAKESYM | NULL |
| MSFT | 401.84 |
| NVDA | 186.94 |

Four rows are returned. `FAKESYM` now appears with `NULL` in the `latest_close` column because `OUTER APPLY` preserves the outer row even when the subquery is empty. This mirrors `LEFT JOIN` behavior: the driving set is preserved, and the right side is nullable.

Use `OUTER APPLY` whenever the driving set (left side) must appear in the output regardless of match status — typically when the outer query represents a mandatory dimension, a required report row, or an "all customers" view.

### CROSS APPLY (VALUES ...) for column unnesting

A powerful and under-used `APPLY` idiom is `CROSS APPLY (VALUES (...), (...), ...)` — combining `CROSS APPLY` with the `VALUES` row constructor to unnest a wide row into multiple narrow rows. This is the modern T-SQL replacement for `UNPIVOT` (covered in the `## PIVOT and UNPIVOT` section below) and it is more flexible because it supports arbitrary expressions and type mixing on the right side.

*Transpose a single OHLC row into four rows (`open`, `high`, `low`, `close`) using `CROSS APPLY (VALUES ...)`.*

```sql
SELECT TOP (5)
    s.symbol,
    s.trade_date,
    x.metric_name,
    x.metric_value
FROM dbo.stock_prices AS s
CROSS APPLY (VALUES
    ('open',  s.open_price),
    ('high',  s.high_price),
    ('low',   s.low_price),
    ('close', s.close_price)
) AS x(metric_name, metric_value)
WHERE s.symbol = 'AAPL'
  AND s.trade_date = '2026-02-12'
ORDER BY x.metric_name;
```

| symbol | trade_date | metric_name | metric_value |
|---|---|---|---|
| AAPL | 2026-02-12 | close | 261.73 |
| AAPL | 2026-02-12 | high | 275.72 |
| AAPL | 2026-02-12 | low | 260.18 |
| AAPL | 2026-02-12 | open | 275.59 |

A single source row (AAPL's 2026-02-12 OHLC) is transposed into four narrow rows, one per OHLC metric. The `VALUES` row constructor builds an inline 4-row table referencing the outer columns (`s.open_price`, `s.high_price`, etc.), and `CROSS APPLY` joins each outer row to that derived 4-row set. The result is a "tall" or "narrow" projection of the same data. Use this pattern for reporting queries that need to stack multiple columns into rows for grouping, charting, or pivot operations. It is almost always preferable to `UNPIVOT` because it handles heterogeneous types and arbitrary expressions cleanly.

## UNION, UNION ALL, EXCEPT, and INTERSECT

> [!abstract] Set operators combine rowsets
>
> Set operators take two or more `SELECT` statements and combine their rowsets into a single output:
>
> - **`UNION ALL`** — appends rows from both sides, keeping every duplicate. No sorting or hashing. Fastest.
> - **`UNION`** — appends rows from both sides, then removes duplicates. Equivalent to `UNION ALL` followed by `DISTINCT`. Adds a distinct-sort or hash-aggregate step.
> - **`EXCEPT`** — returns distinct rows from the left side that do not appear on the right side. Internally a left anti semi join.
> - **`INTERSECT`** — returns distinct rows that appear in both sides. Internally a left semi join.
>
> Compatibility rules (from the Microsoft [UNION reference](https://learn.microsoft.com/en-us/sql/t-sql/language-elements/set-operators-union-transact-sql)):
>
> - Every `SELECT` in the set operation must return the **same number of columns**.
> - Corresponding columns must be **compatible** through implicit conversion. Type precedence determines the result column type (see [02-data-types-conversion-and-null-handling](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/02-data-types-conversion-and-null-handling#type-precedence-and-implicit-conversions)).
> - Result **column names** are taken from the first `SELECT` in the chain.
> - `ORDER BY` is allowed only at the **outermost** query — not on individual `SELECT`s inside the chain.
> - Precedence when chaining: parentheses win; then `INTERSECT`; then `UNION` / `EXCEPT` evaluated left-to-right.
>
> `EXCEPT` and `INTERSECT` treat `NULL` values as equal for deduplication purposes, the same as `GROUP BY` and `DISTINCT`.

### UNION ALL vs UNION: row-count comparison

The single most important distinction between `UNION ALL` and `UNION` is duplicate handling. `UNION ALL` is a pure stream append — every row from both sides survives. `UNION` adds an implicit distinct step that removes duplicate rows before the final output.

The performance difference is significant: `UNION ALL` is `O(n)` in the total row count, while `UNION` is `O(n log n)` (sort-based dedup) or `O(n)` with a large memory footprint (hash-based dedup). Always prefer `UNION ALL` unless deduplication is part of the requirement.

#### Dramatic row-count comparison on stock_prices + stock_prices_ex

The local database has two near-duplicate price tables. `dbo.stock_prices` has 1,222,191 rows; `dbo.stock_prices_ex` has 1,344,411 rows (the same 500 symbols with some duplicate `(symbol, date)` tuples). Computing `UNION ALL` and `UNION` of the two reveals the practical impact.

*Row counts for both tables and for their `UNION ALL` and `UNION` combinations.*

```sql
SELECT
    (SELECT COUNT(*) FROM dbo.stock_prices)                                       AS stock_prices_rows,
    (SELECT COUNT(*) FROM dbo.stock_prices_ex)                                    AS stock_prices_ex_rows,
    (SELECT COUNT(*) FROM (
        SELECT symbol, trade_date, close_price FROM dbo.stock_prices
        UNION ALL
        SELECT symbol, trade_date, close_price FROM dbo.stock_prices_ex
    ) u)                                                                          AS union_all_rows,
    (SELECT COUNT(*) FROM (
        SELECT symbol, trade_date, close_price FROM dbo.stock_prices
        UNION
        SELECT symbol, trade_date, close_price FROM dbo.stock_prices_ex
    ) u)                                                                          AS union_rows;
```

| stock_prices_rows | stock_prices_ex_rows | union_all_rows | union_rows |
|---|---|---|---|
| 1222191 | 1344411 | 2566602 | 1466539 |

`UNION ALL` returns 2,566,602 rows — exactly the sum of the two source tables (1,222,191 + 1,344,411). No duplicate removal, no sorting.

`UNION` returns 1,466,539 rows — a distinct-based dedup collapses 1,100,063 duplicate rows. The cost: SQL Server has to sort or hash the 2.57M intermediate rowset before returning the 1.47M distinct result. On this dataset the difference is about 1.5 seconds vs under 0.3 seconds.

#### Single-row duplicate inspection

The aggregate comparison hides what the duplicate rows actually look like. Filtering to a specific `(symbol, date)` makes it visible.

*Filter `UNION ALL` to a single AAPL day — returns two identical rows because both tables contain it.*

```sql
SELECT TOP (5) symbol, trade_date, close_price
FROM
(
    SELECT symbol, trade_date, close_price FROM dbo.stock_prices
    UNION ALL
    SELECT symbol, trade_date, close_price FROM dbo.stock_prices_ex
) u
WHERE symbol = 'AAPL' AND trade_date = '2025-01-02'
ORDER BY close_price;
```

| symbol | trade_date | close_price |
|---|---|---|
| AAPL | 2025-01-02 | 242.53 |
| AAPL | 2025-01-02 | 242.53 |

Two rows. Identical values — both tables have AAPL's 2025-01-02 close of $242.53. `UNION ALL` preserves the duplicate.

*Same filter with `UNION` instead — the duplicate is collapsed.*

```sql
SELECT TOP (5) symbol, trade_date, close_price
FROM
(
    SELECT symbol, trade_date, close_price FROM dbo.stock_prices
    UNION
    SELECT symbol, trade_date, close_price FROM dbo.stock_prices_ex
) u
WHERE symbol = 'AAPL' AND trade_date = '2025-01-02'
ORDER BY close_price;
```

| symbol | trade_date | close_price |
|---|---|---|
| AAPL | 2025-01-02 | 242.53 |

One row. `UNION`'s distinct step removed the duplicate.

> [!tip] Prefer UNION ALL as the default
>
> Use `UNION ALL` unless duplicate removal is explicitly part of the requirement. If the author knows the sources cannot produce duplicates (for example, combining results from mutually exclusive `WHERE` conditions), `UNION ALL` is always correct and always faster.

### Column count and type compatibility

Set operators require every `SELECT` in the chain to return the same number of columns. Column counts must match exactly; column **names** don't have to match (the result takes names from the first `SELECT`); column **types** must be compatible, resolved by the data type precedence rules.

#### Column count mismatch error 205

> [!failure] "All queries combined using a UNION, INTERSECT or EXCEPT operator must have an equal number of expressions"
>
> Error 205 is raised at parse time when the `SELECT` lists have different column counts. The error message names the operator family but is identical for `UNION`, `UNION ALL`, `EXCEPT`, and `INTERSECT`.

*Trigger error 205 by mismatching column counts across a `UNION`.*

```sql
SELECT symbol, trade_date FROM dbo.stock_prices
UNION
SELECT symbol FROM dbo.dim_symbol;
```

```text
Msg 205, Level 16, State 1
All queries combined using a UNION, INTERSECT or EXCEPT operator must have
an equal number of expressions in their target lists.
```

The left `SELECT` returns two columns; the right returns one. The parser rejects the statement before execution begins.

> [!success] Pad the shorter side with a NULL or constant
>
> To align a 1-column and 2-column query, pad the shorter side with a `NULL` or a constant expression: `SELECT symbol, CAST(NULL AS date) FROM dbo.dim_symbol`. This makes the column counts match. Always label the padded column with an alias to keep the result readable.

### EXCEPT

`EXCEPT` returns distinct rows from the left query that do not appear in the right query. It is the set-level anti-join operator covered in the `## Anti-Joins and Semi-Joins` section above. Microsoft's execution plans label it as **Left Anti Semi Join**.

*Return the symbols in set `a` but not in set `b`.*

```sql
SELECT symbol
FROM (VALUES ('AAPL'), ('MSFT'), ('NVDA'), ('TSLA')) AS a(symbol)
EXCEPT
SELECT symbol
FROM (VALUES ('MSFT'), ('NVDA')) AS b(symbol);
```

| symbol |
|---|
| AAPL |
| TSLA |

`MSFT` and `NVDA` appear on both sides and are removed. `AAPL` and `TSLA` appear only on the left and are returned.

#### EXCEPT deduplicates the left side automatically

> [!info] EXCEPT is distinct-based
>
> `EXCEPT` returns **distinct** rows from the left query, not all matching rows. If the left side has duplicate rows, they collapse to a single row in the output regardless of how many copies the right side matches. This is different from `LEFT JOIN ... WHERE IS NULL`, which preserves left-side duplicates.

*Show the deduplication behavior: left side has `(1, 2, 2, 3, 3, 3)`; right side removes `{2}`; output is `(1, 3)`, not `(1, 3, 3)`.*

```sql
SELECT v
FROM (VALUES (1), (2), (2), (3), (3), (3)) AS t(v)
EXCEPT
SELECT v FROM (VALUES (2)) AS s(v);
```

| v |
|---|
| 1 |
| 3 |

The six-row left input becomes a two-row output. The three `3` values collapse to a single `3`, and both `2` values are removed entirely. `EXCEPT ALL` (which would preserve duplicates) is in the ANSI SQL standard but is **not supported** in T-SQL — SQL Server only implements the distinct form.

### INTERSECT

`INTERSECT` returns distinct rows that appear in **both** query results. It is the set-level semi-join operator; execution plans label it as **Left Semi Join**.

*Return symbols that appear in both sets.*

```sql
SELECT symbol
FROM (VALUES ('AAPL'), ('MSFT'), ('NVDA'), ('TSLA')) AS a(symbol)
INTERSECT
SELECT symbol
FROM (VALUES ('MSFT'), ('NVDA'), ('GOOG')) AS b(symbol);
```

| symbol |
|---|
| MSFT |
| NVDA |

Only `MSFT` and `NVDA` are in both input sets. `AAPL`, `TSLA`, and `GOOG` are each unique to one side and are excluded.

Like `EXCEPT`, `INTERSECT` is distinct-based. T-SQL does not support `INTERSECT ALL`.

### Set operator precedence

When chaining multiple set operators in a single query, SQL Server evaluates them in this order:

1. Parentheses (explicit grouping always wins)
2. `INTERSECT`
3. `UNION` and `EXCEPT` (evaluated left-to-right)

The practical consequence: `A UNION B INTERSECT C` is parsed as `A UNION (B INTERSECT C)`, not `(A UNION B) INTERSECT C`. This matches standard mathematical precedence where `∩` binds tighter than `∪` and `−`, but it can surprise authors who expect strict left-to-right evaluation.

*Demonstrate the precedence rule: `INTERSECT` binds tighter than `UNION`.*

```sql
SELECT v FROM (VALUES (1), (2), (3)) AS a(v)
UNION
SELECT v FROM (VALUES (4), (5)) AS b(v)
INTERSECT
SELECT v FROM (VALUES (4), (6), (7)) AS c(v);
```

| v |
|---|
| 1 |
| 2 |
| 3 |
| 4 |

Step-by-step evaluation:

- `(4, 5) INTERSECT (4, 6, 7) = {4}` (the only common value; `INTERSECT` runs first)
- `(1, 2, 3) UNION {4} = {1, 2, 3, 4}` (then the `UNION`)

If the author intended `((1,2,3) UNION (4,5)) INTERSECT (4,6,7)`, the result would be `{4}` instead of `{1, 2, 3, 4}`. Explicit parentheses make the intent unambiguous:

```sql
(SELECT v FROM (VALUES (1), (2), (3)) AS a(v)
 UNION
 SELECT v FROM (VALUES (4), (5)) AS b(v))
INTERSECT
SELECT v FROM (VALUES (4), (6), (7)) AS c(v);
```

> [!tip] Always parenthesize mixed set operator chains
>
> When combining `UNION`/`UNION ALL`/`EXCEPT`/`INTERSECT` in a single query, use explicit parentheses to make the evaluation order obvious to the reader. Relying on the precedence rule is correct but not readable.

## PIVOT and UNPIVOT

> [!abstract] Transposing rows and columns
>
> `PIVOT` and `UNPIVOT` are two relational operators that transpose data between "tall" (normalized) and "wide" (denormalized) shapes:
>
> - **`PIVOT`** — turns distinct values in one column into multiple output columns, running an aggregate per combination. Wide-format reporting output from narrow-format source data.
> - **`UNPIVOT`** — the inverse: turns multiple columns into rows, producing one output row per source column. Narrow-format output from wide-format source data.
>
> Both operators have significant limitations:
>
> - `PIVOT` requires the `IN` list (the output column names) to be **hard-coded** at parse time. Dynamic pivots require generating the SQL at runtime and executing it with `sp_executesql`.
> - `PIVOT` requires an aggregate function. Simple "just transpose" operations must use an aggregate like `MAX` or `MIN` on a value that only has one row per `(grouping key, pivot key)` combination.
> - `UNPIVOT` requires all unpivoted columns to have **compatible types**, because they must all fit into the single output `value_column`.
> - Both operators are harder to read than equivalent `CASE`-based conditional aggregation (for `PIVOT`) or `CROSS APPLY (VALUES ...)` (for `UNPIVOT`).
>
> The Microsoft [Using PIVOT and UNPIVOT](https://learn.microsoft.com/en-us/sql/t-sql/queries/from-using-pivot-and-unpivot) reference documents the full syntax. The subsections below cover the canonical patterns with their idiomatic alternatives.

### PIVOT

The `PIVOT` operator has three structural parts inside the `FROM` clause:

1. A **source query** that produces the input rowset. Only the columns referenced by the pivot and aggregate are kept; every other column becomes an implicit grouping key.
2. The **aggregate function and value column** (`SUM(volume)`) that computes the cell value for each output column.
3. The **pivot column and IN list** (`FOR trade_year IN ([2023], [2024], [2025], [2026])`) that lists the distinct values of the pivot column that become output column names.

#### Basic PIVOT: volume by year and symbol

> [!info]- Clause-by-clause walkthrough
>
> 1. `SELECT * FROM ( ... ) AS src` — wrap the source query in a derived table. Only the columns `symbol`, `trade_year`, and `volume` are projected; anything else would become an implicit grouping key and produce one row per combination.
> 2. `PIVOT ( SUM(volume) FOR trade_year IN ([2023], [2024], [2025], [2026]) ) AS p` — aggregate `volume` into four new columns named `[2023]` through `[2026]`, one per distinct value in the hard-coded list.
> 3. The implicit grouping key is `symbol` — every column from the source that is not named in the aggregate or pivot clauses becomes a grouping column.
> 4. Output columns are `symbol`, `[2023]`, `[2024]`, `[2025]`, `[2026]`. Integer pivot values require square-bracket escaping because they are not legal column-name identifiers.

*Pivot AAPL, MSFT, and NVDA volume by year.*

```sql
SELECT *
FROM
(
    SELECT symbol, YEAR(trade_date) AS trade_year, volume
    FROM dbo.stock_prices
    WHERE symbol IN ('AAPL', 'MSFT', 'NVDA')
) AS src
PIVOT
(
    SUM(volume)
    FOR trade_year IN ([2023], [2024], [2025], [2026])
) AS p
ORDER BY symbol;
```

| symbol | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|
| AAPL | 14805886900 | 14390908500 | 13543944600 | 1584057000 |
| MSFT | 6919274400 | 5187829000 | 5548360400 | 1125992000 |
| NVDA | 118389365000 | 95051652300 | 55187738800 | 4972955600 |

Three output rows (one per symbol), four pivoted year columns. NVDA's annual volume is about an order of magnitude higher than AAPL or MSFT, reflecting both the share-split history (NVDA's 10-for-1 split in June 2024 inflates the per-share volume) and the extraordinary retail trading activity around the AI theme. The 2026 values are smaller than prior years because the 2026 window in the dataset ends at 2026-02-12 — only 6 weeks of data.

#### PIVOT IN list must be hard-coded

> [!warning] PIVOT does not support dynamic column lists
>
> The `IN` list in a `PIVOT` clause must be a **literal list of values** at parse time. You cannot write `FOR trade_year IN (SELECT DISTINCT YEAR(trade_date) FROM stock_prices)` — the parser rejects it. This is the single biggest limitation of `PIVOT`: any report whose column list changes over time (e.g. "show me the last N years") requires generating the SQL string at runtime and executing it with `sp_executesql`.

> [!success] Use conditional aggregation instead when the column list can be hard-coded
>
> For the common case of a hard-coded column list, `SUM(CASE WHEN ... THEN ... ELSE 0 END) AS [label]` is usually clearer than `PIVOT`. The author writes one expression per output column, which is both more obvious and more flexible (you can use different aggregates per column, reference multiple source columns, apply different filters, etc.).

*Conditional aggregation equivalent of the PIVOT query above.*

```sql
SELECT
    symbol,
    SUM(CASE WHEN YEAR(trade_date) = 2023 THEN volume ELSE 0 END) AS [2023],
    SUM(CASE WHEN YEAR(trade_date) = 2024 THEN volume ELSE 0 END) AS [2024],
    SUM(CASE WHEN YEAR(trade_date) = 2025 THEN volume ELSE 0 END) AS [2025],
    SUM(CASE WHEN YEAR(trade_date) = 2026 THEN volume ELSE 0 END) AS [2026]
FROM dbo.stock_prices
WHERE symbol IN ('AAPL', 'MSFT', 'NVDA')
GROUP BY symbol
ORDER BY symbol;
```

| symbol | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|
| AAPL | 14805886900 | 14390908500 | 13543944600 | 1584057000 |
| MSFT | 6919274400 | 5187829000 | 5548360400 | 1125992000 |
| NVDA | 118389365000 | 95051652300 | 55187738800 | 4972955600 |

Output is **identical** to the `PIVOT` version. The conditional aggregation form is more verbose but more readable — each output column's logic is explicit in its own `SUM(CASE ...)` expression. It also scales better: adding a new column only requires adding one expression, whereas `PIVOT` requires editing the hard-coded `IN` list inside the operator syntax.

For the full treatment of conditional aggregation see the [CASE conditional projection section of 01-select-and-query-basics](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/01-select-and-query-basics#case-conditional-projection-and-sorting-logic).

#### Dynamic PIVOT outline

When the pivot column list cannot be hard-coded (for example, "show me one column per year for all years present in the data"), the only option is to build the SQL string dynamically and execute it with `sp_executesql`. The pattern is:

1. Query the distinct pivot values: `SELECT DISTINCT YEAR(trade_date) FROM ... ORDER BY 1`.
2. Concatenate the values into a bracketed comma-separated list using `STRING_AGG`: `'[2023],[2024],[2025],[2026]'`.
3. Build the full `PIVOT` query as a string that embeds the generated column list.
4. Execute the string with `EXEC sp_executesql @sql`.

This pattern is error-prone (SQL injection if the pivot values come from user input) and harder to optimize than a static query. Prefer conditional aggregation whenever the column set is known at parse time, and reserve dynamic `PIVOT` for truly runtime-driven column lists.

### UNPIVOT

`UNPIVOT` is the structural inverse of `PIVOT`: it takes multiple columns and turns them into rows. The source query supplies a wide row; `UNPIVOT` emits one output row per source column, where each output row carries the source column's name (in the `pivot_column`) and its value (in the `value_column`).

#### UNPIVOT basic pattern

*Unpivot the four OHLC columns from a single AAPL row into four narrow rows.*

```sql
SELECT TOP (8) symbol, trade_date, price_type, price_value
FROM
(
    SELECT
        symbol,
        trade_date,
        open_price,
        high_price,
        low_price,
        close_price
    FROM dbo.stock_prices
    WHERE symbol = 'AAPL'
      AND trade_date = '2026-02-12'
) AS src
UNPIVOT
(
    price_value FOR price_type IN (open_price, high_price, low_price, close_price)
) AS unp;
```

| symbol | trade_date | price_type | price_value |
|---|---|---|---|
| AAPL | 2026-02-12 | open_price | 275.59 |
| AAPL | 2026-02-12 | high_price | 275.72 |
| AAPL | 2026-02-12 | low_price | 260.18 |
| AAPL | 2026-02-12 | close_price | 261.73 |

One source row (AAPL's 2026-02-12 OHLC) becomes four narrow output rows. The `price_type` column contains the source column **name** as a string (`'open_price'`, `'high_price'`, etc.), and `price_value` contains the numeric value.

`UNPIVOT` has two significant limitations:

- **Compatible types required.** All columns in the `IN` list must share a common type because they all flow into the single `value_column`. Unpivoting a mix of `decimal`, `int`, and `varchar` columns requires pre-casting them in the source query to a common type like `nvarchar(50)`.
- **NULL values disappear.** Rows where the source column was `NULL` are **not** emitted by `UNPIVOT` — they are silently filtered out. This is documented Microsoft behavior and is a common source of bugs when the unpivoted columns contain nullable data.

#### CROSS APPLY (VALUES ...) alternative

The modern T-SQL replacement for `UNPIVOT` is `CROSS APPLY (VALUES ...)`. It handles mixed types cleanly, does not drop `NULL` rows, and allows arbitrary expressions on the right side. See the `### CROSS APPLY (VALUES ...) for column unnesting` subsection above for the full explanation.

*The same unpivot expressed with `CROSS APPLY (VALUES ...)` — notice the cleaner labels and deterministic ordering.*

```sql
SELECT
    s.symbol,
    s.trade_date,
    x.price_type,
    x.price_value
FROM dbo.stock_prices AS s
CROSS APPLY (VALUES
    ('open',  s.open_price),
    ('high',  s.high_price),
    ('low',   s.low_price),
    ('close', s.close_price)
) AS x(price_type, price_value)
WHERE s.symbol = 'AAPL'
  AND s.trade_date = '2026-02-12'
ORDER BY
    CASE x.price_type
        WHEN 'open' THEN 1
        WHEN 'high' THEN 2
        WHEN 'low' THEN 3
        WHEN 'close' THEN 4
    END;
```

| symbol | trade_date | price_type | price_value |
|---|---|---|---|
| AAPL | 2026-02-12 | open | 275.59 |
| AAPL | 2026-02-12 | high | 275.72 |
| AAPL | 2026-02-12 | low | 260.18 |
| AAPL | 2026-02-12 | close | 261.73 |

The output is the same four rows but the labels are cleaner (`open` instead of `open_price`), the author can impose a custom sort order with `CASE` in `ORDER BY`, and the pattern naturally handles `NULL` source values (they are emitted as `NULL` in the `price_value` column, unlike `UNPIVOT` which drops them). For any new code that needs to transpose columns into rows, prefer `CROSS APPLY (VALUES ...)` over `UNPIVOT`.

## Practical Join Rules

A short checklist of habits derived from the traps and rules covered above. Each item cross-references the relevant subsection.

- **Alias every table and qualify every column reference.** Prevents ambiguous-column error 209 and makes intent explicit. See the `#### Ambiguous column error 209` subsection.
- **Put right-side filters in the ON clause of a LEFT JOIN, not in WHERE.** Filtering the inner side in `WHERE` silently converts a `LEFT JOIN` into an `INNER JOIN`. See the `#### LEFT JOIN + WHERE on right side silently becomes INNER JOIN` subsection.
- **Always use explicit INNER JOIN with ON in production code.** Never rely on the legacy comma-join `FROM t1, t2 WHERE ...` form, which hides the join predicate and allows accidental Cartesian products. See the `#### Accidental Cartesian product` subsection.
- **Use EXISTS for semi-joins, NOT EXISTS for anti-joins.** `EXISTS`/`NOT EXISTS` are more readable and more efficient than `INNER JOIN + DISTINCT` or `LEFT JOIN + IS NULL`, and `NOT EXISTS` is immune to the `NOT IN` NULL-propagation trap. See the `## Anti-Joins and Semi-Joins` section.
- **Prefer window functions over correlated subqueries when the computation is a partition aggregate.** `AVG(col) OVER (PARTITION BY key)` replaces most correlated subqueries more efficiently. See the window functions sibling note.
- **Use CROSS APPLY for per-row top-N.** It is the canonical replacement for awkward `ROW_NUMBER()` CTE patterns and non-correlating derived tables. See the `### CROSS APPLY for per-row top-N` subsection.
- **Use OUTER APPLY when the driving set must be preserved.** `CROSS APPLY` silently drops left rows when the subquery returns zero rows. See the `### CROSS APPLY vs OUTER APPLY` subsection.
- **Prefer UNION ALL over UNION.** `UNION` adds a distinct-sort or hash-aggregate step. Use it only when deduplication is explicitly part of the requirement. See the `### UNION ALL vs UNION` subsection.
- **Use CROSS APPLY (VALUES ...) instead of UNPIVOT** for new code. It handles mixed types, preserves `NULL` rows, and is more flexible. See the `### CROSS APPLY (VALUES ...) for column unnesting` and `#### CROSS APPLY (VALUES ...) alternative` subsections.
- **Prefer conditional aggregation (`SUM(CASE WHEN ...)`) over PIVOT** when the output columns are known at parse time. Dynamic PIVOT is error-prone; static PIVOT is harder to read than the `SUM(CASE ...)` equivalent. See the `#### PIVOT IN list must be hard-coded` subsection.
- **Parenthesize mixed set operator chains** (`UNION`/`INTERSECT`/`EXCEPT`). Precedence defaults to `INTERSECT` first, which can surprise. See the `### Set operator precedence` subsection.
- **Match column counts and types across set operator branches.** Column count mismatch raises error 205 at parse time. See the `#### Column count mismatch error 205` subsection.


