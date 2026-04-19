---
title: "03 - SQL Advanced"
tags: [sql-server, tsql, advanced]
aliases: [SQL advanced, window functions, CTE, common table expression, PIVOT, UNPIVOT, JSON, recursive CTE, ROW_NUMBER, RANK, LAG, LEAD]
description: "Advanced SQL Server T-SQL patterns with executable examples — covers window functions, CTEs, PIVOT/UNPIVOT, JSON, CROSS APPLY, and recursive queries."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# SQL Advanced

> [!quote]+
> "Thinking in sets, rather than row by row, is perhaps the most important skill a SQL programmer can develop."
>
> — **Joe Celko**, *SQL for Smarties* (1995)

> [!abstract]- Summary
>
> SQL Advanced is the third notebook in this SQL Server query series for data engineering: it collects the higher-leverage T-SQL patterns that solve ranking, recursion, reshaping, anti-joins, multi-level aggregation, and calendar-aware pipeline logic once the foundational query shapes are already in place.
>
> **Advanced window semantics**
> - covers ranking functions, `PERCENT_RANK`, `CUME_DIST`, `FIRST_VALUE`, `LAST_VALUE`, running totals, and the `ROWS` vs `RANGE` frame rules that control correctness
>
> **Recursion, lateral logic, and reshaping**
> - covers recursive CTEs for date-series generation, `CROSS APPLY` / `OUTER APPLY` for lateral evaluation, and `PIVOT` / `UNPIVOT` versus CASE-based reshaping
>
> **Set-based merge and exclusion patterns**
> - covers `MERGE` upserts, `EXISTS` / `NOT EXISTS`, the `NOT IN` null trap, and multi-level aggregation with `GROUPING SETS`, `ROLLUP`, and `CUBE`
>
> **Data shaping utilities**
> - covers string aggregation and parsing, null handling with `COALESCE`, `ISNULL`, and `NULLIF`, set operations such as `UNION ALL`, `INTERSECT`, and `EXCEPT`, calendar-table arithmetic, and the CTE vs `#temp` vs `@table` decision framework
>
> **Operations and safety**
> - Warnings: lab-only credentials, `LAST_VALUE` default frames, `RANGE` vs `ROWS`, recursion limits, `NOT IN` with nulls, `MERGE` concurrency bugs, Cartesian explosion from `CROSS JOIN`, and `UNION` deduplication cost
> - Recommendations table: 8 defaults covering anti-joins, lateral joins, date-series generation, portable pivoting, grouping semantics, null-safe arithmetic, temp-table materialization, and calendar-aware business-day logic
> - Troubleshooting: 7 failure modes covering recursion limit errors, incorrect `LAST_VALUE`, null-poisoned `NOT IN`, sparse pivot output, subtotal nulls in grouping sets, unexpected row loss with `CROSS APPLY`, and moving-average warm-up windows

> [!note]- Glossary
>
> **Recursive CTE**
> - A common table expression whose recursive member references the CTE itself so the query can iterate from an anchor set until a stop condition is reached.
> - It matters because the note uses recursive CTEs for date-series generation and other bounded iterative logic without dropping into cursors or loops.
>
> > [!warning] Recursion has a ceiling
> >
> > SQL Server defaults recursive CTE execution to 100 iterations. Anything longer, such as a yearly date series, needs an explicit `MAXRECURSION` override.
>
> ---
>
> **`CROSS APPLY`**
> - A lateral operator that runs a correlated inner query for each outer row and returns only rows where that inner query produced results.
> - It matters because the note uses it for top-N-per-group and other row-wise subquery patterns that ordinary joins express poorly.
>
> > [!warning] Not the same as `CROSS JOIN`
> >
> > `CROSS APPLY` evaluates a correlated subquery per outer row. `CROSS JOIN` blindly multiplies two sets and can explode cardinality even when no lateral logic is required.
>
> ---
>
> **`OUTER APPLY`**
> - A lateral operator like `CROSS APPLY` that preserves the outer row even when the correlated inner query returns nothing.
> - It matters because optional enrichments in the note need left-join behavior while still benefiting from lateral evaluation.
>
> > [!info] Left join for correlated logic
> >
> > `OUTER APPLY` is useful when the inner logic depends on each outer row but missing matches should still remain visible. That makes it the lateral equivalent of `LEFT JOIN`.
>
> ---
>
> **`PIVOT` / `UNPIVOT`**
> - SQL Server reshaping operators that turn row values into columns or columns back into rows.
> - It matters because the note compares native pivot syntax with more portable CASE-based aggregation for reporting and export-oriented transformations.
>
> > [!warning] Native pivot wants fixed columns
> >
> > SQL Server `PIVOT` requires the output column list at compile time. If categories are dynamic, the solution usually becomes dynamic SQL or a different reshape strategy.
>
> ---
>
> **`GROUPING SETS` / `ROLLUP` / `CUBE`**
> - Extensions to `GROUP BY` that produce multiple subtotal levels from a single scan instead of separate aggregate queries unioned together.
> - It matters because the note uses them to generate detailed rows, subtotals, and grand totals in one set-oriented pass.
>
> > [!warning] Subtotal nulls need labels
> >
> > Grouping operators often emit `NULL` in subtotal rows. Without `GROUPING()` or `GROUPING_ID()`, those subtotal markers are easy to confuse with genuine null data values.
>
> ---
>
> **`NOT EXISTS` vs `NOT IN`**
> - Two exclusion patterns where `NOT EXISTS` performs a null-safe correlated anti-join and `NOT IN` fails closed if the subquery output contains any null.
> - It matters because the note treats null-safe anti-joins as a correctness boundary, not just a style preference.
>
> > [!danger] Nullable `NOT IN` lies silently
> >
> > A nullable subquery column can make `NOT IN` return zero rows without any error. `NOT EXISTS` is the safer default whenever nullability is possible.
>
> ---
>
> **`FIRST_VALUE()` / `LAST_VALUE()`**
> - Window functions that expose the first or last value visible inside the current window frame.
> - It matters because the note uses them for anchored calculations and explicitly shows why `LAST_VALUE()` needs a different frame from most running-window patterns.
>
> > [!warning] Default frame breaks `LAST_VALUE()`
> >
> > Without an explicit frame that reaches forward, `LAST_VALUE()` often returns the current row rather than the actual partition tail. The function is correct; the frame is wrong.
>
> ---
>
> **Window frame / `ROWS` vs `RANGE`**
> - The window-frame clause defines which ordered rows a window function can see, with `ROWS` counting physical row positions and `RANGE` grouping peers that share the same sort value.
> - It matters because moving averages, running totals, and peer-sensitive calculations in the note change meaning depending on the chosen frame semantics.
>
> > [!warning] Defaults are rarely what you mean
> >
> > SQL Server's default frame is value-based, not always row-based. If duplicate sort keys exist, omitting the frame clause can produce subtly wrong analytical results.
>
> ---
>
> **`NULLIF()` safe division**
> - A defensive arithmetic pattern that converts a zero denominator to `NULL` before division so a query avoids divide-by-zero failures.
> - It matters because ratio-based analytics in the note run against real data that can contain zeros and nulls.
>
> > [!info] BigQuery names it differently
> >
> > BigQuery exposes the same idea as `SAFE_DIVIDE()`. The note calls out the translation so the protective intent survives across engines even when the syntax changes.
>
> ---
>
> **Trading calendar**
> - A reference table or logical calendar that marks valid business dates and lets queries reason about trading days instead of plain civil dates.
> - It matters because the note's business-day arithmetic and date-series examples need holiday-aware logic that `DATEADD()` alone cannot provide.
>
> > [!warning] Calendar math is not business math
> >
> > Adding one day with `DATEADD(DAY, 1, ...)` ignores weekends and holidays. Finance pipelines need an explicit trading calendar to stay operationally correct.
>
> ---
>
> **Set operation**
> - A relational operator that combines or compares complete result sets, such as `UNION ALL`, `UNION`, `INTERSECT`, or `EXCEPT`.
> - It matters because the note uses set operations both for correctness patterns and for choosing between deduplicating and non-deduplicating combination strategies.
>
> > [!warning] Deduplication is work
> >
> > `UNION` performs duplicate elimination, which usually means sorting or hashing. When duplicates are acceptable or impossible by design, `UNION ALL` is the cheaper and more explicit choice.
>
> ---
>
> **Temporary-object strategy**
> - The decision about whether intermediate logic should stay inline as a CTE, materialize into `#temp`, or live in a table variable.
> - It matters because the note closes by comparing those options as a performance and maintainability trade-off rather than treating them as interchangeable syntax.
>
> > [!info] Materialize when reuse is real
> >
> > If an intermediate result is referenced multiple times or needs its own index, a temp table usually beats a repeatedly inlined CTE. The strategy choice is about workload shape, not personal style.
>
> ---
>
> **Semi-join / anti-join**
> - Logical join patterns that answer "does a match exist?" or "does no match exist?" without multiplying rows the way a regular join can.
> - It matters because the note's `EXISTS` and `NOT EXISTS` sections depend on understanding that these operators test relationship existence rather than projecting matched rows.
>
> > [!info] Presence, not projection
> >
> > A semi-join asks whether at least one related row exists; it does not return all matching child rows. That mental model helps explain why `EXISTS` often reads cleaner than a join-plus-dedup workaround.

*Load the jupysql extension and configure display settings for notebook SQL execution.*

```python
%load_ext sql
%config SqlMagic.displaycon = False
%config SqlMagic.displaylimit = 0
```

*Connect to the local SQL Server stoxx database via ODBC.*

```python
%sql mssql+pyodbc://sa:EsgDev2026Pass1@localhost:1434/stoxx?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes&MARS_Connection=yes
```

```text
Connecting to 'mssql+pyodbc://sa:***@localhost:1434/stoxx?MARS_Connection=yes&TrustServerCertificate=yes&driver=ODBC+Driver+18+for+SQL+Server'
```

> [!danger] Lab-Only Credentials
>
> The connection string above contains a plaintext password for a local lab environment. In production, credentials are stored in GCP Secret Manager and fetched at runtime — never hardcoded. See [secrets-management > Access from Python](https://alp78.github.io/elysium/06-GCP/Security/secrets-management#access-from-python).

> [!success] Safe Pattern
>
> In production, retrieve the connection string from GCP Secret Manager at runtime: `secretmanager.SecretManagerServiceClient().access_secret_version(name=...)`. Never hardcode passwords in notebooks, scripts, or source control. Use environment variables or secret injection via Cloud Run / GKE secrets.

## Advanced Window Functions

The window functions in this section are used extensively in the [silver-transforms](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/silver-transforms) and [gold-transforms](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/gold-transforms) layers of the medallion pipeline to produce cleaned and analytical datasets. For the foundational `RANK`, `DENSE_RANK`, `LAG`, `LEAD`, and `SUM() OVER` patterns, see [sql-fundamentals > Window Functions](https://alp78.github.io/elysium/05-DB-Queries/SQL-Server/sql-fundamentals#window-functions).

### Window Functions — ROW_NUMBER for Deduplication

Assigns a unique sequential integer within each partition, ordered by the specified column. The outer query filters to `rn = 1` to retain only the most recent row per symbol — the standard deduplication pattern for picking the latest record per key.

#### Pick the latest price per stock with ROW_NUMBER

*Pick the latest price per stock using ROW_NUMBER partitioned by symbol, ordered by date descending.*

```sql
SELECT TOP 10 symbol, date, [close], volume
FROM (
    SELECT symbol, date, [close], volume,
           ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) AS rn
    FROM silver.eurostoxx50_ohlcv
) sub
WHERE rn = 1
ORDER BY [close] DESC
```

<table>
<thead>
<tr>
<th>symbol</th>
<th>date</th>
<th>close</th>
<th>volume</th>
</tr>
</thead>
<tbody>
<tr>
<td>RMS.PA</td>
<td>2026-03-12</td>
<td>1906.0</td>
<td>18681</td>
</tr>
<tr>
<td>RHM.DE</td>
<td>2026-03-12</td>
<td>1551.5</td>
<td>158741</td>
</tr>
<tr>
<td>ASML.AS</td>
<td>2026-03-12</td>
<td>1190.8</td>
<td>128223</td>
</tr>
<tr>
<td>ADYEN.AS</td>
<td>2026-03-12</td>
<td>925.7</td>
<td>27887</td>
</tr>
<tr>
<td>ARGX.BR</td>
<td>2026-03-12</td>
<td>626.6</td>
<td>14083</td>
</tr>
</table>

### Window Functions — PERCENT_RANK and CUME_DIST

- `PERCENT_RANK()`: relative rank as a percentage (0 to 1). Where does this stock sit vs peers?
- `CUME_DIST()`: cumulative distribution — fraction of rows with value ≤ current row.

Use case: "ASML is in the 90th percentile of composite scores."

#### Compute percentile rank and cumulative distribution for composite scores

*Compute percentile rank and cumulative distribution for composite scores across the Euro Stoxx 50.*

```sql
SELECT TOP 15
    symbol,
    ROUND(composite_score, 4) AS score,
    composite_rank,
    ROUND(PERCENT_RANK() OVER (ORDER BY composite_score DESC), 3) AS pct_rank,
    ROUND(CUME_DIST() OVER (ORDER BY composite_score DESC), 3) AS cume_dist
FROM gold.scores_daily
WHERE _index = 'euro_stoxx_50'
  AND score_date = (SELECT MAX(score_date) FROM gold.scores_daily WHERE _index = 'euro_stoxx_50')
ORDER BY composite_rank
```

<table>
<thead>
<tr>
<th>symbol</th>
<th>score</th>
<th>composite_rank</th>
<th>pct_rank</th>
<th>cume_dist</th>
</tr>
</thead>
<tbody>
<tr>
<td>BNP.PA</td>
<td>0.6796</td>
<td>1</td>
<td>0.0</td>
<td>0.02</td>
</tr>
<tr>
<td>VOW.DE</td>
<td>0.5756</td>
<td>2</td>
<td>0.02</td>
<td>0.04</td>
</tr>
<tr>
<td>DTE.DE</td>
<td>0.487</td>
<td>3</td>
<td>0.041</td>
<td>0.06</td>
</tr>
<tr>
<td>TTE.PA</td>
<td>0.3913</td>
<td>4</td>
<td>0.061</td>
<td>0.08</td>
</tr>
<tr>
<td>ABI.BR</td>
<td>0.3852</td>
<td>5</td>
<td>0.082</td>
<td>0.1</td>
</tr>
</table>

### Window Functions — FIRST_VALUE and LAST_VALUE

- `FIRST_VALUE(col)`: first value in the window frame
- `LAST_VALUE(col)`: last value — **requires explicit frame** or it only sees up to current row

> [!danger] LAST_VALUE default frame trap
>
> Without an explicit frame, `LAST_VALUE()` uses `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` — it only sees rows up to the current row, making it identical to the current row's value. Always specify `ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING` when using `LAST_VALUE()`.

> [!success] Safe Pattern
>
> Always specify an explicit frame with `LAST_VALUE`: `LAST_VALUE(col) OVER (PARTITION BY x ORDER BY y ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING)`. For "last value in partition" scenarios, consider using `FIRST_VALUE` with a descending `ORDER BY` instead — it is less error-prone because the default frame works correctly for `FIRST_VALUE`.

`FIRST_VALUE` retrieves the first trading day's close for the year (the January opening price). Every subsequent row divides the current close by that anchor to compute the year-to-date return percentage.

#### Anchor YTD return to the first close with FIRST_VALUE

*Compute YTD return for each day by anchoring to the first close of the year via FIRST_VALUE.*

```sql
SELECT TOP 15
    symbol, date,
    ROUND([close], 2) AS [close],
    ROUND(FIRST_VALUE([close]) OVER (
        PARTITION BY symbol ORDER BY date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ), 2) AS first_close_ytd,
    ROUND(([close] - FIRST_VALUE([close]) OVER (
        PARTITION BY symbol ORDER BY date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )) / FIRST_VALUE([close]) OVER (
        PARTITION BY symbol ORDER BY date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) * 100, 2) AS ytd_return_pct
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'ASML.AS' AND YEAR(date) = YEAR(GETDATE())
ORDER BY date DESC
```

<table>
<thead>
<tr>
<th>symbol</th>
<th>date</th>
<th>close</th>
<th>first_close_ytd</th>
<th>ytd_return_pct</th>
</tr>
</thead>
<tbody>
<tr>
<td>ASML.AS</td>
<td>2026-03-12</td>
<td>1190.8</td>
<td>986.3</td>
<td>20.73</td>
</tr>
<tr>
<td>ASML.AS</td>
<td>2026-03-11</td>
<td>1198.8</td>
<td>986.3</td>
<td>21.55</td>
</tr>
<tr>
<td>ASML.AS</td>
<td>2026-03-10</td>
<td>1200.0</td>
<td>986.3</td>
<td>21.67</td>
</tr>
<tr>
<td>ASML.AS</td>
<td>2026-03-09</td>
<td>1147.6</td>
<td>986.3</td>
<td>16.35</td>
</tr>
<tr>
<td>ASML.AS</td>
<td>2026-03-06</td>
<td>1147.0</td>
<td>986.3</td>
<td>16.29</td>
</tr>
</table>

### Window Functions — Running Totals and Cumulative Sums

`SUM() OVER (ORDER BY date ROWS UNBOUNDED PRECEDING)` — cumulative sum from the first row to current.
Use case: cumulative volume, cumulative return, running P&L.

#### Compute cumulative volume with SUM OVER and ROWS UNBOUNDED PRECEDING

*Compute cumulative trading volume from the start of 2025 using SUM with ROWS UNBOUNDED PRECEDING.*

```sql
SELECT TOP 15
    symbol, date, volume,
    SUM(volume) OVER (
        PARTITION BY symbol ORDER BY date
        ROWS UNBOUNDED PRECEDING
    ) AS cumulative_volume
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'ASML.AS' AND YEAR(date) = 2025
ORDER BY date DESC
```

<table>
<thead>
<tr>
<th>symbol</th>
<th>date</th>
<th>volume</th>
<th>cumulative_volume</th>
</tr>
</thead>
<tbody>
<tr>
<td>ASML.AS</td>
<td>2025-12-31</td>
<td>156048</td>
<td>182666418</td>
</tr>
<tr>
<td>ASML.AS</td>
<td>2025-12-30</td>
<td>402093</td>
<td>182510370</td>
</tr>
<tr>
<td>ASML.AS</td>
<td>2025-12-29</td>
<td>380628</td>
<td>182108277</td>
</tr>
<tr>
<td>ASML.AS</td>
<td>2025-12-24</td>
<td>59585</td>
<td>181727649</td>
</tr>
<tr>
<td>ASML.AS</td>
<td>2025-12-23</td>
<td>258272</td>
<td>181668064</td>
</tr>
</table>

### Window Functions — Frame Deep Dive (ROWS BETWEEN, RANGE)

The frame clause controls which rows within the current partition a window function sees. It is specified after `ORDER BY` inside the `OVER` clause. The two frame units are `ROWS` (physical row count) and `RANGE` (logical value range, grouping ties together). Without an explicit frame clause, SQL Server defaults to `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` — a default that produces incorrect moving averages when the `ORDER BY` column has tied values.

| Frame | Meaning |
|-------|--------|
| `ROWS BETWEEN 29 PRECEDING AND CURRENT ROW` | Exactly 30 rows (SMA-30) |
| `ROWS UNBOUNDED PRECEDING` | All rows from start to current (running total) |
| `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING` | Entire partition |
| `RANGE BETWEEN ...` | Based on **values** not row count (treats ties together) |

**Default** (no frame): `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` — beware, this groups ties!

> [!warning] RANGE groups ties, ROWS counts physical rows
>
> If two rows have the same `ORDER BY` value, `RANGE` treats them as one logical position. `ROWS` counts them as separate physical rows. For moving averages (SMA-30, SMA-90), ALWAYS use `ROWS` — `RANGE` produces incorrect averages when dates have duplicates (multiple symbols on the same date).

> [!success] Safe Pattern
>
> Use `ROWS BETWEEN N PRECEDING AND CURRENT ROW` for all moving average calculations. Reserve `RANGE` only for scenarios where you explicitly need tie-grouping behavior (e.g., cumulative totals where tied ranks should share the same running total). When in doubt, `ROWS` is the safer, more predictable default.

The query demonstrates three `OVER` variants side by side: `sma_5_rows` uses `ROWS BETWEEN 4 PRECEDING AND CURRENT ROW` (exactly 5 physical rows), `avg_all` uses no frame clause (full-partition average for comparison), and `vol_30d` uses `ROWS BETWEEN 29 PRECEDING AND CURRENT ROW` (30-day rolling standard deviation as a volatility proxy).

#### Compare three window frame variants side by side

*Compare three frame variants: 5-row SMA, full-partition average, and 30-day rolling volatility.*

```sql
SELECT TOP 10
    symbol, date, [close],
    ROUND(AVG([close]) OVER (
        PARTITION BY symbol ORDER BY date ROWS BETWEEN 4 PRECEDING AND CURRENT ROW
    ), 2) AS sma_5_rows,
    ROUND(AVG([close]) OVER (
        PARTITION BY symbol
    ), 2) AS avg_all,
    ROUND(STDEV([close]) OVER (
        PARTITION BY symbol ORDER BY date ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
    ), 2) AS vol_30d
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'ASML.AS'
ORDER BY date DESC
```

<table>
<thead>
<tr>
<th>symbol</th>
<th>date</th>
<th>close</th>
<th>sma_5_rows</th>
<th>avg_all</th>
<th>vol_30d</th>
</tr>
</thead>
<tbody>
<tr>
<td>ASML.AS</td>
<td>2026-03-12</td>
<td>1190.8</td>
<td>1176.84</td>
<td>671.35</td>
<td>35.97</td>
</tr>
<tr>
<td>ASML.AS</td>
<td>2026-03-11</td>
<td>1198.8</td>
<td>1175.88</td>
<td>671.35</td>
<td>35.95</td>
</tr>
<tr>
<td>ASML.AS</td>
<td>2026-03-10</td>
<td>1200.0</td>
<td>1176.08</td>
<td>671.35</td>
<td>35.98</td>
</tr>
<tr>
<td>ASML.AS</td>
<td>2026-03-09</td>
<td>1147.6</td>
<td>1168.44</td>
<td>671.35</td>
<td>36.06</td>
</tr>
<tr>
<td>ASML.AS</td>
<td>2026-03-06</td>
<td>1147.0</td>
<td>1181.0</td>
<td>671.35</td>
<td>34.79</td>
</tr>
</table>

## Recursive CTEs

A recursive CTE consists of an **anchor member** (the starting row) and a **recursive member** that references the CTE itself. SQL Server executes the anchor once, then repeatedly applies the recursive member — appending new rows each iteration — until the recursive member produces no more rows or hits the `MAXRECURSION` limit (default: 100). Recursive CTEs are the standard pattern for generating continuous date sequences, traversing hierarchies (org charts, account trees), and computing graph paths without procedural loops.

> [!info] Cross-Engine: Recursive CTEs
>
> **SQL Server** caps recursion at 100 by default (`OPTION (MAXRECURSION N)` to override). **BigQuery** supports recursive CTEs (`WITH RECURSIVE`) with a default limit of 500 iterations. **Firestore** has no query language capable of recursion — hierarchical traversal must be done in application code.

### Recursive CTEs — Date Series Generation

A **recursive CTE** has an anchor member (the starting row) and a recursive member that references itself. The anchor provides the initial date; the recursive member extends the series by one day per iteration via `DATEADD(DAY, 1, dt)`. A `LEFT JOIN` to the OHLCV table then reveals which calendar dates have no price record for a given symbol.

> [!warning] SQL Server limits recursion to 100
>
> A recursive CTE exceeding 100 iterations fails with error 530. Override with `OPTION (MAXRECURSION N)` or `OPTION (MAXRECURSION 0)` for unlimited. A date series generating 365 rows needs `MAXRECURSION 366`. BigQuery caps at 500 iterations by default.

> [!success] Safe Pattern
>
> Add `OPTION (MAXRECURSION 0)` at the end of the statement whenever a recursive CTE is used to generate sequences longer than 100 rows (e.g., `OPTION (MAXRECURSION 0)` for a full-year date series). Set a specific limit (e.g., `MAXRECURSION 366`) rather than 0 in production to prevent runaway recursion from buggy CTEs.

#### Generate a date series and detect missing trading days

*Generate a continuous date series for March 2026, then LEFT JOIN to OHLCV to find missing trading days.*

```sql
WITH dates AS (
    SELECT CAST('2026-03-01' AS DATE) AS dt
    UNION ALL
    SELECT DATEADD(DAY, 1, dt) FROM dates WHERE dt < '2026-03-31'
)
SELECT TOP 15
    d.dt AS calendar_date,
    o.symbol,
    o.[close],
    CASE WHEN o.symbol IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM dates d
LEFT JOIN silver.eurostoxx50_ohlcv o ON d.dt = o.date AND o.symbol = 'ASML.AS'
ORDER BY d.dt
```

<table>
<thead>
<tr>
<th>calendar_date</th>
<th>symbol</th>
<th>close</th>
<th>status</th>
</tr>
</thead>
<tbody>
<tr>
<td>2026-03-01</td>
<td>None</td>
<td>None</td>
<td>MISSING</td>
</tr>
<tr>
<td>2026-03-02</td>
<td>ASML.AS</td>
<td>1210.4</td>
<td>OK</td>
</tr>
<tr>
<td>2026-03-03</td>
<td>ASML.AS</td>
<td>1161.8</td>
<td>OK</td>
</tr>
<tr>
<td>2026-03-04</td>
<td>ASML.AS</td>
<td>1199.8</td>
<td>OK</td>
</tr>
<tr>
<td>2026-03-05</td>
<td>ASML.AS</td>
<td>1186.0</td>
<td>OK</td>
</tr>
</table>

## CROSS JOIN / CROSS APPLY / OUTER APPLY

`CROSS JOIN` produces the Cartesian product of two tables — every row from A paired with every row from B. `CROSS APPLY` is a lateral join: it evaluates a correlated subquery for each row of the outer table and returns the inner results as additional rows, enabling `TOP N per group` patterns that `CROSS JOIN` alone cannot express. `OUTER APPLY` extends this with `LEFT JOIN` semantics — preserving outer rows even when the inner query returns nothing. Both `APPLY` operators are SQL Server-specific syntax.

> [!info] Cross-Engine: APPLY and Lateral Joins
>
> **SQL Server** uses `CROSS APPLY` and `OUTER APPLY` for lateral (per-row) subqueries. **BigQuery** achieves the same with `CROSS JOIN` + lateral subqueries or `UNNEST` for array columns — there is no `APPLY` keyword. **Firestore** has no join concept; multi-collection relationships require client-side joins or data denormalization.

### CROSS JOIN / CROSS APPLY — Build a Complete Grid

`CROSS JOIN` produces the Cartesian product: every row from A paired with every row from B. Use case: generate all (symbol, date) combinations to expose missing bronze data. The silver layer is gap-filled, so the check targets the bronze table directly.

#### Build a complete symbol x date grid with CROSS JOIN

*CROSS JOIN symbols with trading calendar dates, then LEFT JOIN to detect missing bronze price data.*

```sql
WITH symbols AS (
    SELECT DISTINCT symbol FROM bronze.eurostoxx50_ohlcv
),
cal AS (
    SELECT DISTINCT date
    FROM bronze.trading_calendar
    WHERE exchange_code = 'AMS' AND is_trading_day = 1
      AND date >= '2026-03-01' AND date <= '2026-03-21'
)
SELECT TOP 15
    s.symbol, c.date,
    CASE WHEN o.[close] IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM symbols s
CROSS JOIN cal c
LEFT JOIN silver.eurostoxx50_ohlcv o ON s.symbol = o.symbol AND c.date = o.date
ORDER BY s.symbol, c.date
```

<table>
<thead>
<tr>
<th>symbol</th>
<th>date</th>
<th>status</th>
</tr>
</thead>
<tbody>
<tr>
<td>ABI.BR</td>
<td>2026-03-02</td>
<td>OK</td>
</tr>
<tr>
<td>ABI.BR</td>
<td>2026-03-03</td>
<td>OK</td>
</tr>
<tr>
<td>ABI.BR</td>
<td>2026-03-04</td>
<td>OK</td>
</tr>
<tr>
<td>ABI.BR</td>
<td>2026-03-05</td>
<td>OK</td>
</tr>
<tr>
<td>ABI.BR</td>
<td>2026-03-06</td>
<td>OK</td>
</tr>
</table>

### CROSS APPLY / OUTER APPLY — Top-N Per Group

`CROSS APPLY` is a lateral join — it runs a subquery **for each row** of the outer table.
Like a correlated subquery, but returns multiple rows. Use case: top 3 highest-volume days per stock.

#### Retrieve the top 3 highest-volume days per stock with CROSS APPLY

*Use CROSS APPLY to retrieve the top 3 highest-volume trading days per stock.*

```sql
SELECT TOP 15
    d.symbol, d.short_name,
    t.date, t.volume, t.[close]
FROM silver.index_dim d
CROSS APPLY (
    SELECT TOP 3 date, volume, [close]
    FROM silver.eurostoxx50_ohlcv o
    WHERE o.symbol = d.symbol
    ORDER BY volume DESC
) t
WHERE d._index = 'euro_stoxx_50' AND d.is_current = 1
ORDER BY d.symbol, t.volume DESC
```

<table>
<thead>
<tr>
<th>symbol</th>
<th>short_name</th>
<th>date</th>
<th>volume</th>
<th>close</th>
</tr>
</thead>
<tbody>
<tr>
<td>ABI.BR</td>
<td>AB INBEV</td>
<td>2022-02-28</td>
<td>12441786</td>
<td>55.14</td>
</tr>
<tr>
<td>ABI.BR</td>
<td>AB INBEV</td>
<td>2024-06-21</td>
<td>9762601</td>
<td>55.06</td>
</tr>
<tr>
<td>ABI.BR</td>
<td>AB INBEV</td>
<td>2025-05-30</td>
<td>9526994</td>
<td>62.04</td>
</tr>
<tr>
<td>AD.AS</td>
<td>KONINKLIJKE AHOLD DELHAIZE N.V.</td>
<td>2021-05-27</td>
<td>11080485</td>
<td>24.0</td>
</tr>
<tr>
<td>AD.AS</td>
<td>KONINKLIJKE AHOLD DELHAIZE N.V.</td>
<td>2021-03-19</td>
<td>10565045</td>
<td>23.5</td>
</tr>
</table>

### OUTER APPLY — Optional Lateral Join

Like `CROSS APPLY` but keeps the outer row even if the inner returns nothing (like LEFT JOIN).
Use case: latest score per stock — some stocks may not have scores yet.

#### Get the latest score per stock with OUTER APPLY (NULL-safe)

*Use OUTER APPLY to get the latest score per stock, preserving stocks without scores (NULLs).*

```sql
SELECT TOP 15
    d.symbol, d.short_name, d.sector,
    s.composite_score, s.composite_rank, s.score_date
FROM silver.index_dim d
OUTER APPLY (
    SELECT TOP 1 composite_score, composite_rank, score_date
    FROM gold.scores_daily g
    WHERE g.symbol = d.symbol AND g._index = d._index
    ORDER BY score_date DESC
) s
WHERE d._index = 'euro_stoxx_50' AND d.is_current = 1
ORDER BY s.composite_rank
```

<table>
<thead>
<tr>
<th>symbol</th>
<th>short_name</th>
<th>sector</th>
<th>composite_score</th>
<th>composite_rank</th>
<th>score_date</th>
</tr>
</thead>
<tbody>
<tr>
<td>BNP.PA</td>
<td>BNP PARIBAS ACT.A</td>
<td>Financial Services</td>
<td>0.6795985859619491</td>
<td>1</td>
<td>2026-03-12</td>
</tr>
<tr>
<td>VOW.DE</td>
<td>VOLKSWAGEN AG</td>
<td>Consumer Cyclical</td>
<td>0.5756100520413311</td>
<td>2</td>
<td>2026-03-12</td>
</tr>
<tr>
<td>DTE.DE</td>
<td>DEUTSCHE TELEKOM AG</td>
<td>Communication Services</td>
<td>0.4870486370039222</td>
<td>3</td>
<td>2026-03-12</td>
</tr>
<tr>
<td>TTE.PA</td>
<td>TOTALENERGIES</td>
<td>Energy</td>
<td>0.3912872052761238</td>
<td>4</td>
<td>2026-03-12</td>
</tr>
<tr>
<td>ABI.BR</td>
<td>AB INBEV</td>
<td>Consumer Defensive</td>
<td>0.38521031359211527</td>
<td>5</td>
<td>2026-03-12</td>
</tr>
</table>

## PIVOT / UNPIVOT

`PIVOT` transforms row values into column headers — converting long-format data (one row per metric) into wide format (one column per metric). `UNPIVOT` does the reverse, normalizing wide tables back to long format for easier aggregation and charting. SQL Server's `PIVOT` operator requires a **static column list** known at query compile time; for dynamic column lists, use conditional aggregation with `CASE WHEN` instead — this is also the portable approach that works across SQL engines.

> [!info] Cross-Engine: PIVOT
>
> **SQL Server** `PIVOT` requires a static, hard-coded column list — dynamic column lists need dynamic SQL with `sp_executesql`. **BigQuery** has no `PIVOT` keyword (as of 2024 it does support PIVOT syntax); the portable alternative is `CASE WHEN` conditional aggregation, which works across BigQuery, PostgreSQL, and SQL Server. **Firestore** has no aggregation operators.

### PIVOT / UNPIVOT — Rows to Columns

Turn row values into column headers. Classic use: monthly close prices as columns.

#### Pivot monthly average close prices into columns

*PIVOT monthly average close prices into columns (Jan through May) for ASML in 2025.*

```sql
SELECT *
FROM (
    SELECT symbol, MONTH(date) AS mo, [close]
    FROM silver.eurostoxx50_ohlcv
    WHERE symbol = 'ASML.AS' AND YEAR(date) = 2025
) src
PIVOT (
    AVG([close]) FOR mo IN ([1],[2],[3],[4],[5])
) pvt
```

<table>
<thead>
<tr>
<th>symbol</th>
<th>1</th>
<th>2</th>
<th>3</th>
<th>4</th>
<th>5</th>
</tr>
</thead>
<tbody>
<tr>
<td>ASML.AS</td>
<td>714.7136363636364</td>
<td>713.04</td>
<td>656.5809523809525</td>
<td>581.0000000000001</td>
<td>650.1809523809522</td>
</tr>
</table>

### PIVOT — Manual Pivot with CASE (Portable)

`PIVOT` is SQL Server specific. The portable equivalent uses `CASE` inside aggregates.
Works in any SQL engine (BigQuery, PostgreSQL, etc.).

#### Portable CASE-based pivot without PIVOT syntax

*Portable CASE-based pivot: compute monthly averages without SQL Server PIVOT syntax.*

```sql
SELECT
    symbol,
    ROUND(AVG(CASE WHEN MONTH(date) = 1 THEN [close] END), 2) AS Jan,
    ROUND(AVG(CASE WHEN MONTH(date) = 2 THEN [close] END), 2) AS Feb,
    ROUND(AVG(CASE WHEN MONTH(date) = 3 THEN [close] END), 2) AS Mar,
    ROUND(AVG(CASE WHEN MONTH(date) = 6 THEN [close] END), 2) AS Jun,
    ROUND(AVG(CASE WHEN MONTH(date) = 9 THEN [close] END), 2) AS Sep,
    ROUND(AVG(CASE WHEN MONTH(date) = 12 THEN [close] END), 2) AS Dec
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'ASML.AS' AND YEAR(date) = 2025
GROUP BY symbol
```

<table>
<thead>
<tr>
<th>symbol</th>
<th>Jan</th>
<th>Feb</th>
<th>Mar</th>
<th>Jun</th>
<th>Sep</th>
<th>Dec</th>
</tr>
</thead>
<tbody>
<tr>
<td>ASML.AS</td>
<td>714.71</td>
<td>713.04</td>
<td>656.58</td>
<td>670.05</td>
<td>732.09</td>
<td>924.72</td>
</tr>
</table>

### UNPIVOT — Columns to Rows

The reverse — turn multiple score columns into rows for easier comparison/charting.

#### Unpivot score columns into rows for per-component analysis

*UNPIVOT three score columns (value, momentum, sentiment) into rows for per-component analysis.*

```sql
SELECT TOP 15 symbol, score_type, ROUND(score_value, 4) AS score_value
FROM (
    SELECT symbol, relative_value_score, momentum_score, sentiment_score
    FROM gold.scores_daily
    WHERE _index = 'euro_stoxx_50'
      AND score_date = (SELECT MAX(score_date) FROM gold.scores_daily WHERE _index = 'euro_stoxx_50')
) src
UNPIVOT (
    score_value FOR score_type IN (relative_value_score, momentum_score, sentiment_score)
) unpvt
ORDER BY symbol, score_type
```

<table>
<thead>
<tr>
<th>symbol</th>
<th>score_type</th>
<th>score_value</th>
</tr>
</thead>
<tbody>
<tr>
<td>ABI.BR</td>
<td>momentum_score</td>
<td>0.5375</td>
</tr>
<tr>
<td>ABI.BR</td>
<td>relative_value_score</td>
<td>0.2506</td>
</tr>
<tr>
<td>ABI.BR</td>
<td>sentiment_score</td>
<td>0.3676</td>
</tr>
<tr>
<td>AD.AS</td>
<td>momentum_score</td>
<td>1.1629</td>
</tr>
<tr>
<td>AD.AS</td>
<td>relative_value_score</td>
<td>0.6959</td>
</tr>
</table>

## MERGE (Upsert)

The `MERGE` statement performs INSERT, UPDATE, and DELETE in a single atomic operation against a target table, driven by a source dataset. It is the core tool for incremental pipeline loads — upsert new data, update changed rows, optionally delete rows absent from the source. See [idempotent-pipeline-design](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design) for how `MERGE` fits into a broader re-runnable load strategy.

> [!info] Cross-Engine: MERGE / Upsert
>
> **SQL Server** `MERGE` has known concurrency bugs (see callout below) — always add `WITH (HOLDLOCK)`. **BigQuery** `MERGE` is stable and widely used for incremental DML; it supports `WHEN NOT MATCHED BY SOURCE THEN DELETE` for full table synchronization. **Firestore** has no `MERGE` equivalent — use batched writes (up to 500 operations per batch) or transactions for atomic multi-document updates.

> [!warning] MERGE Has Concurrency Bugs
>
> MERGE Has Known Bugs in SQL Server.
> Microsoft has documented multiple concurrency bugs with MERGE that can cause missing rows, duplicate key violations, and incorrect results under concurrent access -- even with proper locking hints. For high-concurrency pipelines, consider using separate INSERT/UPDATE statements wrapped in a transaction instead. If using MERGE, always add `WITH (HOLDLOCK)` on the target table to prevent race conditions between the MATCHED check and the subsequent DML.

> [!success] Safe Pattern
>
> For high-concurrency pipelines, replace MERGE with an explicit INSERT/UPDATE pattern inside a transaction: `BEGIN TRAN; UPDATE target SET ... WHERE key = @key; IF @@ROWCOUNT = 0 INSERT INTO target ...; COMMIT`. Add `WITH (HOLDLOCK, UPDLOCK)` on the target table in the UPDATE to prevent race conditions. If you must use MERGE, always include `WITH (HOLDLOCK)` on the USING clause.

### MERGE (Upsert) — Syntax and Patterns

The `MERGE` statement does INSERT, UPDATE, and DELETE in one atomic operation.
This is the core of incremental pipeline loads — "upsert" new data, update changed rows.

**Syntax**: `MERGE target USING source ON join_key WHEN MATCHED THEN UPDATE WHEN NOT MATCHED THEN INSERT`

#### Create staging and target temp tables for the MERGE demo

*Create staging and target temp tables, then demonstrate the MERGE upsert pattern.*

```sql
CREATE TABLE #staging (
    symbol VARCHAR(20), date DATE, [close] FLOAT, volume BIGINT)
INSERT INTO #staging VALUES
    ('DEMO.XX', '2026-03-20', 100.0, 1000000),
    ('DEMO.XX', '2026-03-21', 102.5, 1200000)

CREATE TABLE #target (
    symbol VARCHAR(20), date DATE, [close] FLOAT, volume BIGINT)
```

#### Execute the MERGE upsert and verify the target

*Execute the MERGE: insert new rows, update matched rows, then verify the target contents.*

```sql
MERGE #target AS t
USING #staging AS s ON t.symbol = s.symbol AND t.date = s.date
WHEN MATCHED THEN
    UPDATE SET [close] = s.[close], volume = s.volume
WHEN NOT MATCHED THEN
    INSERT (symbol, date, [close], volume)
    VALUES (s.symbol, s.date, s.[close], s.volume);

SELECT * FROM #target
DROP TABLE #staging
DROP TABLE #target
```

```text
2 rows affected.
```

<table>
<thead>
<tr>
<th>symbol</th>
<th>date</th>
<th>close</th>
<th>volume</th>
</tr>
</thead>
<tbody>
<tr>
<td>DEMO.XX</td>
<td>2026-03-20</td>
<td>100.0</td>
<td>1000000</td>
</tr>
<tr>
<td>DEMO.XX</td>
<td>2026-03-21</td>
<td>102.5</td>
<td>1200000</td>
</tr>
</table>

## EXISTS vs IN vs JOIN

`EXISTS` checks whether a correlated subquery returns at least one row and **short-circuits at the first match** — it never reads more rows than necessary. `IN` with a subquery evaluates the full subquery result set and checks membership; it has a critical behavioral difference from `EXISTS` when the subquery can return `NULL`: `NOT IN` returns zero rows if any `NULL` is present in the subquery result, silently filtering out the entire outer query. `JOIN` as a semi-join alternative is generally equivalent to `EXISTS` but returns duplicate outer rows when the inner table has multiple matches.

> [!warning] NOT IN with NULLs Returns Zero Rows
>
> `NOT IN (SELECT key FROM t WHERE ...)` returns an empty result set if the subquery returns even one `NULL`. SQL Server evaluates `outer.key NOT IN (NULL, ...)` as `UNKNOWN`, which is treated as `FALSE` for filtering. This is one of the most common silent data bugs in T-SQL — the query runs successfully and returns no rows without any error.

> [!success] Safe Pattern
>
> Always use `NOT EXISTS` instead of `NOT IN` when the subquery column is nullable: `WHERE NOT EXISTS (SELECT 1 FROM t WHERE t.key = outer.key)`. `NOT EXISTS` is immune to the NULL trap and typically produces the same or better execution plan.

> [!info] Cross-Engine: EXISTS / NOT EXISTS
>
> `EXISTS` and `NOT EXISTS` are standard ANSI SQL and work identically in SQL Server and BigQuery. The `NOT IN` NULL trap applies equally to both engines. **Firestore** has no subquery support — multi-collection filtering must be done in application code or via collection group queries.

> [!question] Content Gap
>
> This section covers `EXISTS` semi-joins and `NOT EXISTS` anti-joins. The `IN` operator and `JOIN` as alternatives are not yet covered with dedicated examples — see the introductory text above for the key behavioral differences.

### EXISTS vs IN vs JOIN — Semi-Join with EXISTS

`WHERE EXISTS (SELECT 1 FROM ... WHERE ...)` — returns TRUE if the subquery finds **any** row.
Stops at the first match (efficient). Use for "does a related row exist?" questions.

#### Find index members that have at least one matching score (semi-join)

*Semi-join: find Euro Stoxx 50 members that have at least one gold-layer score.*

```sql
SELECT TOP 15 d.symbol, d.short_name, d.sector
FROM silver.index_dim d
WHERE d._index = 'euro_stoxx_50' AND d.is_current = 1
  AND EXISTS (
      SELECT 1 FROM gold.scores_daily g
      WHERE g.symbol = d.symbol AND g._index = d._index
  )
ORDER BY d.symbol
```

<table>
<thead>
<tr>
<th>symbol</th>
<th>short_name</th>
<th>sector</th>
</tr>
</thead>
<tbody>
<tr>
<td>ABI.BR</td>
<td>AB INBEV</td>
<td>Consumer Defensive</td>
</tr>
<tr>
<td>AD.AS</td>
<td>KONINKLIJKE AHOLD DELHAIZE N.V.</td>
<td>Consumer Defensive</td>
</tr>
<tr>
<td>ADS.DE</td>
<td>adidas AG</td>
<td>Consumer Cyclical</td>
</tr>
<tr>
<td>ADYEN.AS</td>
<td>ADYEN</td>
<td>Technology</td>
</tr>
<tr>
<td>AI.PA</td>
<td>AIR LIQUIDE</td>
<td>Basic Materials</td>
</tr>
</table>

### EXISTS vs IN vs JOIN — Anti-Join with NOT EXISTS

Find rows in A that have **no match** in B — the anti-join pattern. `NOT EXISTS` is more efficient than `LEFT JOIN WHERE b.key IS NULL` in most cases and avoids the NULL trap of `NOT IN`. The example finds Euro Stoxx 50 members that are not also constituents of the Oil & Gas 20 index.

#### Find Euro Stoxx 50 members not in Oil & Gas 20 (anti-join)

*Anti-join: find Euro Stoxx 50 members that are NOT in the Oil & Gas 20 index.*

```sql
SELECT TOP 15 d.symbol, d.short_name, d.sector
FROM silver.index_dim d
WHERE d._index = 'euro_stoxx_50' AND d.is_current = 1
  AND NOT EXISTS (
      SELECT 1 FROM silver.index_dim o
      WHERE o.symbol = d.symbol AND o._index = 'oil_20' AND o.is_current = 1
  )
ORDER BY d.symbol
```

<table>
<thead>
<tr>
<th>symbol</th>
<th>short_name</th>
<th>sector</th>
</tr>
</thead>
<tbody>
<tr>
<td>ABI.BR</td>
<td>AB INBEV</td>
<td>Consumer Defensive</td>
</tr>
<tr>
<td>AD.AS</td>
<td>KONINKLIJKE AHOLD DELHAIZE N.V.</td>
<td>Consumer Defensive</td>
</tr>
<tr>
<td>ADS.DE</td>
<td>adidas AG</td>
<td>Consumer Cyclical</td>
</tr>
<tr>
<td>ADYEN.AS</td>
<td>ADYEN</td>
<td>Technology</td>
</tr>
<tr>
<td>AI.PA</td>
<td>AIR LIQUIDE</td>
<td>Basic Materials</td>
</tr>
</table>

## Grouping Sets, ROLLUP, CUBE

`GROUPING SETS`, `ROLLUP`, and `CUBE` are extensions to `GROUP BY` that generate multiple aggregation levels in a single query pass — more efficient than `UNION ALL`-ing separate aggregations. `GROUPING SETS` specifies exactly which column combinations to aggregate. `ROLLUP(a, b)` generates hierarchical subtotals rolling up from right to left: `(a, b)`, `(a)`, `()`. `CUBE(a, b)` generates all possible combinations: `(a, b)`, `(a)`, `(b)`, `()`. Use `GROUPING()` or `GROUPING_ID()` to distinguish subtotal rows from actual data rows in the output — both return `1` for a NULL introduced by the grouping operation.

> [!info] Cross-Engine: GROUPING SETS / ROLLUP / CUBE
>
> All three operators (`GROUPING SETS`, `ROLLUP`, `CUBE`) are supported in both **SQL Server** and **BigQuery** (BigQuery added `ROLLUP` and `CUBE` support in 2023). **Firestore** has no aggregation operators beyond basic `count()`, `sum()`, and `avg()` introduced in 2023.

### Grouping Sets, ROLLUP, CUBE — GROUPING SETS

Run multiple GROUP BY queries in one pass. Instead of UNION ALL of separate aggregations,
use `GROUPING SETS` — more efficient and readable.

#### Aggregate by sector, by country, and overall with GROUPING SETS

*Compute aggregate scores grouped by sector, by country, and overall total — all in one pass.*

```sql
SELECT TOP 15
    COALESCE(d.sector, '(all sectors)') AS sector,
    COALESCE(d.country, '(all countries)') AS country,
    COUNT(*) AS stocks,
    ROUND(AVG(s.composite_score), 4) AS avg_score
FROM gold.scores_daily s
JOIN silver.index_dim d ON s.symbol = d.symbol AND d._index = s._index AND d.is_current = 1
WHERE s._index = 'euro_stoxx_50'
  AND s.score_date = (SELECT MAX(score_date) FROM gold.scores_daily WHERE _index = 'euro_stoxx_50')
GROUP BY GROUPING SETS (
    (d.sector),
    (d.country),
    ()
)
ORDER BY GROUPING(d.sector), GROUPING(d.country), avg_score DESC
```

<table>
<thead>
<tr>
<th>sector</th>
<th>country</th>
<th>stocks</th>
<th>avg_score</th>
</tr>
</thead>
<tbody>
<tr>
<td>Communication Services</td>
<td>(all countries)</td>
<td>1</td>
<td>0.487</td>
</tr>
<tr>
<td>Energy</td>
<td>(all countries)</td>
<td>2</td>
<td>0.3286</td>
</tr>
<tr>
<td>Healthcare</td>
<td>(all countries)</td>
<td>4</td>
<td>0.0812</td>
</tr>
<tr>
<td>Technology</td>
<td>(all countries)</td>
<td>5</td>
<td>0.0522</td>
</tr>
<tr>
<td>Industrials</td>
<td>(all countries)</td>
<td>10</td>
<td>0.0504</td>
</tr>
</table>

### Grouping Sets, ROLLUP, CUBE — ROLLUP Hierarchical Subtotals

`ROLLUP(a, b)` = GROUP BY (a, b) + GROUP BY (a) + GROUP BY (). Subtotals roll up from right to left.

#### Hierarchical subtotals per sector with ROLLUP

*ROLLUP by sector: per-sector volume totals plus a grand total row marked '*** TOTAL ***'.*

```sql
SELECT TOP 15
    COALESCE(d.sector, '*** TOTAL ***') AS sector,
    COUNT(DISTINCT s.symbol) AS stocks,
    SUM(o.volume) AS total_volume,
    ROUND(AVG(CAST(o.volume AS FLOAT)), 0) AS avg_daily_volume
FROM silver.eurostoxx50_ohlcv o
JOIN silver.index_dim d ON o.symbol = d.symbol AND d._index = 'euro_stoxx_50' AND d.is_current = 1
JOIN gold.scores_daily s ON o.symbol = s.symbol AND s._index = 'euro_stoxx_50'
WHERE o.date >= '2026-03-01'
  AND s.score_date = (SELECT MAX(score_date) FROM gold.scores_daily WHERE _index = 'euro_stoxx_50')
GROUP BY ROLLUP(d.sector)
ORDER BY GROUPING(d.sector), total_volume DESC
```

<table>
<thead>
<tr>
<th>sector</th>
<th>stocks</th>
<th>total_volume</th>
<th>avg_daily_volume</th>
</tr>
</thead>
<tbody>
<tr>
<td>Financial Services</td>
<td>11</td>
<td>1494164521</td>
<td>15092571.0</td>
</tr>
<tr>
<td>Utilities</td>
<td>2</td>
<td>377718499</td>
<td>20984361.0</td>
</tr>
<tr>
<td>Energy</td>
<td>2</td>
<td>207171058</td>
<td>11509503.0</td>
</tr>
<tr>
<td>Industrials</td>
<td>10</td>
<td>125186950</td>
<td>1390966.0</td>
</tr>
<tr>
<td>Consumer Cyclical</td>
<td>9</td>
<td>112568697</td>
<td>1389737.0</td>
</tr>
</table>

## String Aggregation & Functions

SQL Server 2017 introduced `STRING_AGG` as the standard way to concatenate row values into a delimited string — replacing the legacy `FOR XML PATH('')` hack. The string functions (`CHARINDEX`, `SUBSTRING`, `LEFT`, `RIGHT`, `REPLACE`, `STRING_SPLIT`) are used in financial pipelines to parse ticker symbols, normalize exchange codes, and transform text identifiers between source formats.

### String Aggregation — STRING_AGG

Concatenate values from multiple rows into a single comma-separated string.
Use case: list all tickers in a sector as one field.

#### Concatenate ticker symbols per sector with STRING_AGG

*Concatenate all ticker symbols per sector into a comma-separated string using STRING_AGG.*

```sql
SELECT TOP 10
    sector,
    COUNT(*) AS stocks,
    STRING_AGG(symbol, ', ') WITHIN GROUP (ORDER BY symbol) AS symbols
FROM silver.index_dim
WHERE _index = 'euro_stoxx_50' AND is_current = 1
GROUP BY sector
ORDER BY stocks DESC
```

<table>
<thead>
<tr>
<th>sector</th>
<th>stocks</th>
<th>symbols</th>
</tr>
</thead>
<tbody>
<tr>
<td>Financial Services</td>
<td>11</td>
<td>ALV.DE, BBVA.MC, BNP.PA, CS.PA, DB1.DE, INGA.AS, ISP.MI, MUV2.DE, NDA-FI.HE, SAN.MC, UCG.MI</td>
</tr>
<tr>
<td>Industrials</td>
<td>10</td>
<td>AIR.PA, DG.PA, DHL.DE, ENR.DE, RHM.DE, SAF.PA, SGO.PA, SIE.DE, SU.PA, WKL.AS</td>
</tr>
<tr>
<td>Consumer Cyclical</td>
<td>9</td>
<td>ADS.DE, BMW.DE, ITX.MC, MBG.DE, MC.PA, PRX.AS, RACE.MI, RMS.PA, VOW.DE</td>
</tr>
<tr>
<td>Technology</td>
<td>5</td>
<td>ADYEN.AS, ASML.AS, DSY.PA, IFX.DE, SAP.DE</td>
</tr>
<tr>
<td>Consumer Defensive</td>
<td>4</td>
<td>ABI.BR, AD.AS, BN.PA, OR.PA</td>
</tr>
</table>

### String Functions — Parsing with SPLIT, CHARINDEX, SUBSTRING

Extract exchange suffix from ticker symbols (e.g., 'AS' from 'ASML.AS').

#### Parse ticker symbols into code and exchange with CHARINDEX / SUBSTRING

*Parse ticker symbols into company code and exchange suffix using CHARINDEX and SUBSTRING.*

```sql
SELECT TOP 10
    symbol,
    LEFT(symbol, CHARINDEX('.', symbol) - 1) AS ticker_only,
    SUBSTRING(symbol, CHARINDEX('.', symbol) + 1, LEN(symbol)) AS exchange,
    UPPER(LEFT(short_name, 1)) + LOWER(SUBSTRING(short_name, 2, LEN(short_name))) AS name_proper
FROM silver.index_dim
WHERE _index = 'euro_stoxx_50' AND is_current = 1
ORDER BY symbol
```

<table>
<thead>
<tr>
<th>symbol</th>
<th>ticker_only</th>
<th>exchange</th>
<th>name_proper</th>
</tr>
</thead>
<tbody>
<tr>
<td>ABI.BR</td>
<td>ABI</td>
<td>BR</td>
<td>Ab inbev</td>
</tr>
<tr>
<td>AD.AS</td>
<td>AD</td>
<td>AS</td>
<td>Koninklijke ahold delhaize n.v.</td>
</tr>
<tr>
<td>ADS.DE</td>
<td>ADS</td>
<td>DE</td>
<td>Adidas ag</td>
</tr>
<tr>
<td>ADYEN.AS</td>
<td>ADYEN</td>
<td>AS</td>
<td>Adyen</td>
</tr>
<tr>
<td>AI.PA</td>
<td>AI</td>
<td>PA</td>
<td>Air liquide</td>
</tr>
</table>

## NULL Handling Patterns

SQL Server's three-valued logic (TRUE / FALSE / UNKNOWN) is the source of many silent data bugs in T-SQL. Any comparison or arithmetic involving `NULL` produces `NULL` (unknown) — not `FALSE` and not zero. Aggregates (`SUM`, `AVG`, `COUNT(col)`) silently ignore `NULL` rows, so `COUNT(col)` and `COUNT(*)` can return different totals for the same result set. In financial pipelines, the three key handling functions are `COALESCE` (ANSI standard, N arguments, returns the first non-`NULL`), `ISNULL` (T-SQL only, 2 arguments, output type follows the first argument), and `NULLIF` (returns `NULL` when two expressions are equal — used as the standard safe-division pattern: `x / NULLIF(denominator, 0)`).

### NULL Handling — Rules and COALESCE, ISNULL, NULLIF

The table below summarizes how `NULL` propagates through common SQL expressions and which functions to use in each scenario.

| Expression | Result | Why |
|-----------|--------|-----|
| `NULL = NULL` | NULL (not TRUE!) | NULL is unknown, not a value |
| `NULL + 5` | NULL | Any arithmetic with NULL = NULL |
| `AVG(col)` | Ignores NULLs | Aggregates skip NULLs |
| `COUNT(*)` vs `COUNT(col)` | Different! | COUNT(*) counts rows, COUNT(col) skips NULLs |
| `COALESCE(a, b, c)` | First non-NULL | ANSI standard, N arguments |
| `ISNULL(a, b)` | a if not null, else b | T-SQL only, 2 args, type of first arg |
| `NULLIF(a, b)` | NULL if a = b | Prevents divide-by-zero: `x / NULLIF(y, 0)` |

The query demonstrates three NULL-handling patterns: `COALESCE` formats `forward_pe` as `'N/A'` when the value is `NULL`; `NULLIF` prevents divide-by-zero when computing earnings per share; `COUNT(*)` counts all rows while `COUNT(forward_pe)` counts only rows where PE is not `NULL` — showing the difference between the two in the same result set.

#### Demonstrate COALESCE, NULLIF, and COUNT NULL behavior

*Demonstrate COALESCE for display defaults, NULLIF for safe division, and COUNT(*) vs COUNT(col) differences.*

```sql
SELECT TOP 10
    symbol,
    forward_pe,
    COALESCE(CAST(ROUND(forward_pe, 1) AS VARCHAR), 'N/A') AS pe_display,
    ROUND(current_price / NULLIF(forward_pe, 0), 2) AS earnings_per_share,
    COUNT(*) OVER () AS total_rows,
    COUNT(forward_pe) OVER () AS rows_with_pe
FROM silver.signals_daily
WHERE _index = 'euro_stoxx_50'
ORDER BY forward_pe
```

<table>
<thead>
<tr>
<th>symbol</th>
<th>forward_pe</th>
<th>pe_display</th>
<th>earnings_per_share</th>
<th>total_rows</th>
<th>rows_with_pe</th>
</tr>
</thead>
<tbody>
<tr>
<td>VOW.DE</td>
<td>2.6177435</td>
<td>2.6</td>
<td>35.47</td>
<td>149</td>
<td>149</td>
</tr>
<tr>
<td>VOW.DE</td>
<td>3.4232497</td>
<td>3.4</td>
<td>27.93</td>
<td>149</td>
<td>149</td>
</tr>
<tr>
<td>VOW.DE</td>
<td>3.5628338</td>
<td>3.6</td>
<td>25.63</td>
<td>149</td>
<td>149</td>
</tr>
<tr>
<td>BNP.PA</td>
<td>6.7327175</td>
<td>6.7</td>
<td>12.83</td>
<td>149</td>
<td>149</td>
</tr>
<tr>
<td>BNP.PA</td>
<td>6.8096137</td>
<td>6.8</td>
<td>12.84</td>
<td>149</td>
<td>149</td>
</tr>
</table>

## Set Operations

Set operations combine the results of two or more `SELECT` statements with matching column counts and compatible data types. `UNION ALL` stacks rows without deduplication and is the fastest option. `UNION` performs an implicit `DISTINCT` — it sorts the result to eliminate duplicates, adding cost; use it only when deduplication is required. `INTERSECT` returns only rows that appear in both result sets. `EXCEPT` returns rows from the first set not present in the second — functionally equivalent to a `NOT EXISTS` anti-join and typically more readable for index membership comparisons.

> [!info] Cross-Engine: Set Operations
>
> `UNION ALL`, `UNION`, `INTERSECT`, and `EXCEPT` are ANSI SQL and work identically in **SQL Server** and **BigQuery**. BigQuery uses `EXCEPT DISTINCT` (matching its `UNION DISTINCT` naming convention) — functionally the same as SQL Server's `EXCEPT`. **Firestore** has no set operations; multi-collection merging must be done in application code.

### Set Operations — UNION / INTERSECT / EXCEPT

- `UNION ALL`: stack result sets (keep duplicates) — fast
- `UNION`: stack + deduplicate — slower (sorts)
- `INTERSECT`: rows in both queries
- `EXCEPT`: rows in first query but not second

#### Find index difference with EXCEPT

*EXCEPT: find Euro Stoxx 50 symbols that are not in the Asia 50 index.*

```sql
SELECT TOP 5 symbol FROM silver.index_dim
WHERE _index = 'euro_stoxx_50' AND is_current = 1
EXCEPT
SELECT TOP 5 symbol FROM silver.index_dim
WHERE _index = 'stoxx_asia_50' AND is_current = 1
ORDER BY symbol
```

<table>
<thead>
<tr>
<th>symbol</th>
</tr>
</thead>
<tbody>
<tr>
<td>ABI.BR</td>
</tr>
<tr>
<td>AD.AS</td>
</tr>
<tr>
<td>ADS.DE</td>
</tr>
<tr>
<td>ADYEN.AS</td>
</tr>
<tr>
<td>AI.PA</td>
</tr>
</table>

## Date & Calendar Table Patterns

Financial date arithmetic cannot rely on `DATEADD` alone — markets observe holidays and early closes that `DATEADD(DAY, N, date)` has no awareness of. The `trading_calendar` table in the bronze layer maps every calendar date to exchange trading status, enabling business-day-aware calculations: counting trading days between two dates, finding the next or previous trading day, and detecting missing price data for a given exchange. For generating a continuous date spine to join against the calendar, use the recursive CTE date-series pattern described in the Recursive CTEs section above.

### Date & Calendar — Business Day Arithmetic

Use the `trading_calendar` table to count trading days between dates.
Weekend/holiday-aware calculations are essential for financial data.

#### Count trading days vs calendar days per exchange

*Count trading days vs calendar days per exchange in Q1 2026 using the trading_calendar table.*

```sql
SELECT TOP 10
    exchange_code,
    SUM(CAST(is_trading_day AS INT)) AS trading_days,
    COUNT(*) AS calendar_days,
    ROUND(SUM(CAST(is_trading_day AS INT)) * 100.0 / COUNT(*), 1) AS pct_trading
FROM bronze.trading_calendar
WHERE year = 2026 AND quarter = 1
GROUP BY exchange_code
ORDER BY trading_days DESC
```

<table>
<thead>
<tr>
<th>exchange_code</th>
<th>trading_days</th>
<th>calendar_days</th>
<th>pct_trading</th>
</tr>
</thead>
<tbody>
<tr>
<td>MCE</td>
<td>63</td>
<td>90</td>
<td>70.000000000000</td>
</tr>
<tr>
<td>GER</td>
<td>63</td>
<td>90</td>
<td>70.000000000000</td>
</tr>
<tr>
<td>AMS</td>
<td>63</td>
<td>90</td>
<td>70.000000000000</td>
</tr>
<tr>
<td>PAR</td>
<td>63</td>
<td>90</td>
<td>70.000000000000</td>
</tr>
<tr>
<td>BRU</td>
<td>63</td>
<td>90</td>
<td>70.000000000000</td>
</tr>
</table>

## Temp Tables vs Table Variables vs CTEs

CTEs, `#temp` tables, and `@table` variables are three ways to name and reuse intermediate result sets. The choice affects materialization, statistics availability, index support, and scope. CTEs are syntactic sugar — they are not materialized and re-execute on every reference in the same query. `#temp` tables are materialized to `tempdb`, support full index creation, and survive the duration of the session, making them suitable for large intermediate sets that are referenced more than once. `@table` variables are batch-scoped; they reside in memory for small sets but carry no full statistics — the optimizer assumes 1 row, producing poor plans when the variable holds more than ~100 rows.

> [!info] Cross-Engine: Temporary Storage
>
> **SQL Server** provides three mechanisms: CTEs (non-materialized, query-scoped), `#temp` tables (session-scoped in `tempdb` with full index support), and `@table` variables (batch-scoped, memory-optimized for small sets). **BigQuery** supports CTEs for intra-query reuse and `CREATE TEMP TABLE` in multi-statement scripts for materialized intermediate storage. **Firestore** has no concept of temporary tables or intermediate query storage.

### Temp Tables vs CTEs vs Table Variables — Decision Guide

The table below compares the three mechanisms across the dimensions that most affect query performance and pipeline design.

| Feature | CTE | \#Temp Table | @Table Variable |
|---------|-----|-------------|----------------|
| Materialized? | No (re-evaluated) | Yes (on disk) | Yes (in memory*) |
| Indexes? | No | Yes | Limited |
| Scope | Single query | Session | Batch |
| Best for | Readability | Reuse, large sets | Small lookups (<100 rows) |
| Performance | Re-runs each ref | One-time compute | Fast for small sets |

**Rule of thumb**: start with CTE. If the query is slow and the CTE is referenced multiple times, materialize into \#temp.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {
  'primaryColor': '#292e42',
  'primaryTextColor': '#c0caf5',
  'primaryBorderColor': '#565f89',
  'lineColor': '#565f89',
  'secondaryColor': '#1a1b26',
  'tertiaryColor': '#24283b',
  'noteTextColor': '#c0caf5',
  'noteBkgColor': '#292e42',
  'textColor': '#c0caf5',
  'fontSize': '14px'
}}}%%
flowchart TD
    A[Need intermediate<br/>result set?] --> B{Referenced more<br/>than once in query?}
    B -- No --> D[CTE<br/>Readability, single-use]
    B -- Yes --> C{Large set or<br/>needs an index?}
    C -- Yes --> E[#temp table<br/>Materialize into tempdb,<br/>add index on join key]
    C -- No --> F{Under ~100 rows?}
    F -- Yes --> G[@table variable<br/>Memory-resident,<br/>fast for tiny lookups]
    F -- No --> E
```

> [!warning] CTEs Re-execute Every Reference
>
> CTEs Are Not Materialized -- They Re-execute on Every Reference.
> A CTE referenced three times in one query runs three times. If the CTE itself contains expensive joins or aggregations, this silently triples execution time. Check the execution plan -- if you see the same subtree repeated, switch to a `#temp` table. Table variables (`@t`) avoid this but have limited statistics, which can cause bad plans on more than ~100 rows.

> [!success] Safe Pattern
>
> If a CTE is referenced more than once in a query, materialize it into a `#temp` table first: `SELECT ... INTO #my_cte FROM ...`, then reference `#my_cte` wherever needed. Add an index on the join or filter key with `CREATE INDEX ix ON #my_cte (key_col)` for queries over ~10,000 rows. Use CTEs only for readability when they are referenced exactly once.


## SQL Server SQL Advanced Warnings

The table below lists the highest-impact traps that silently produce wrong results or degraded performance. Each entry corresponds to a warning or danger callout earlier in this note.

| Topic | Warning |
|---|---|
| **`LAST_VALUE` default frame** | Without explicit `ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING`, `LAST_VALUE` returns the current row's value, not the partition's last value. |
| **`RANGE` vs `ROWS`** | `RANGE` groups tied ORDER BY values. For moving averages, always use `ROWS` to count physical rows. |
| **Recursive CTE MAXRECURSION** | Default is 100. A 365-day date series fails. Always specify `OPTION (MAXRECURSION N)`. |
| **`NOT IN` with NULLs** | Returns zero rows if the subquery contains any NULL. No error, no warning — just empty results. Always use `NOT EXISTS`. |
| **MERGE concurrency** | Known SQL Server bugs cause missing rows and duplicate key violations under concurrent access. Always use `WITH (HOLDLOCK)`. |
| **CROSS JOIN cost** | Produces N x M rows. Safe with small dimensions (50 x 20 = 1,000). Dangerous with large tables (10K x 10K = 100M). |
| **UNION without ALL** | Forces a deduplication sort. Expensive on large result sets. Use `UNION ALL` unless dedup is specifically needed. |

## SQL Server SQL Advanced Recommendations

Standing guidance for applying the advanced patterns covered above. Apply these as defaults unless a specific query has a documented reason to deviate.

| Area | Recommendation |
|---|---|
| **Anti-joins** | Always use `NOT EXISTS` over `NOT IN`. It is NULL-safe and typically produces the same or better execution plan. |
| **Lateral joins** | Use `CROSS APPLY` for top-N per group in SQL Server. Use `ROW_NUMBER` + subquery for the portable equivalent. |
| **Date series** | Use recursive CTEs with explicit `MAXRECURSION`. In BigQuery, use `GENERATE_DATE_ARRAY` instead. |
| **Pivoting** | Use CASE-based conditional aggregation for portability across SQL Server, BigQuery, and PostgreSQL. Reserve PIVOT syntax for SQL Server-only code. |
| **Multi-level aggregation** | Use `GROUPING SETS` to specify exactly which grouping combinations you need. Use `GROUPING()` to distinguish subtotal NULLs from data NULLs. |
| **NULL arithmetic** | Wrap every division in `NULLIF(denominator, 0)`. Use `COALESCE` for display defaults. Remember `COUNT(*)` counts all rows; `COUNT(col)` skips NULLs. |
| **Temp table materialization** | If a CTE is referenced more than once or the query is slow, materialize into `#temp` and add an index on the join key. |
| **Calendar arithmetic** | Always use the `trading_calendar` table for business-day calculations. `DATEADD(DAY, N, date)` has no awareness of holidays. |

## SQL Server SQL Advanced Troubleshooting

Symptoms you will encounter when one of these advanced patterns misbehaves, mapped to the most likely cause and the fix that resolves it in practice.

| Symptom | Likely cause | Fix |
|---|---|---|
| Recursive CTE fails with error 530 | Exceeded MAXRECURSION limit (default 100) | Add `OPTION (MAXRECURSION 0)` or a specific limit (e.g., 366 for a year). |
| `LAST_VALUE` returns the current row value | Missing explicit frame clause — default only sees up to current row | Add `ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING`. |
| `NOT IN` returns zero rows | Subquery contains NULLs | Replace with `NOT EXISTS (SELECT 1 FROM ... WHERE ...)`. |
| PIVOT returns NULL for some columns | Those month/category values don't exist in the data | Expected behavior — NULL means no data for that column value. Use `COALESCE(pvt.[1], 0)` to default to zero. |
| GROUPING SETS output has unexpected NULLs | Subtotal rows have NULL for non-grouped columns | Use `GROUPING(col)` to detect subtotal rows (returns 1 for subtotals, 0 for data). |
| CROSS APPLY returns fewer rows than expected | Some outer rows have no matching inner rows | Switch to `OUTER APPLY` to preserve outer rows with NULL inner columns. |
| Moving average looks wrong at partition start | First N-1 rows have a shorter window (fewer than N preceding rows exist) | Expected behavior. Filter to `date >= first_date + N days` to exclude warm-up period. |

## SQL Server SQL Advanced Cross-References

Related notes that extend or depend on the patterns covered here.

- [sargable-queries](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/03-Query-Writing-and-Optimization/sargable-queries) — SARGable predicate patterns for index usage
- [silver-transforms](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/silver-transforms) — production versions of LAG, gap-fill, and daily return patterns
- [gold-transforms](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/gold-transforms) — production z-score, ranking, and MERGE patterns
- [idempotent-pipeline-design](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design) — how MERGE fits into re-runnable pipeline strategies
- [03-bq-advanced](https://alp78.github.io/elysium/05-DB-Queries/BigQuery/bq-advanced) — BigQuery equivalents of every pattern in this note
- [05_py_aggregation_reshaping](https://alp78.github.io/elysium/03-Dataframes/Dataframes-Python/05_py_aggregation_reshaping) — DataFrame equivalents of PIVOT, window functions, and aggregation
- [05_cs_aggregation_reshaping](https://alp78.github.io/elysium/03-Dataframes/Dataframes-CSharp/05_cs_aggregation_reshaping) — C# LINQ equivalents
