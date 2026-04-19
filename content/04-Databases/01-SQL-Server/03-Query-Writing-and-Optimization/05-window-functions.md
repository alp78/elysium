---
title: "05 - Window Functions"
tags: [sql-server, tsql, query-writing]
aliases: [OVER clause, analytic functions, ranking functions, LAG LEAD, running totals, moving averages, PERCENTILE_CONT, window frames]
description: "T-SQL reference for window functions: the OVER clause, PARTITION BY vs GROUP BY, ranking (ROW_NUMBER/RANK/DENSE_RANK/NTILE/PERCENT_RANK/CUME_DIST), offset and value functions (LAG/LEAD/FIRST_VALUE/LAST_VALUE), aggregate windows (SUM/AVG/MIN/MAX/STDEV OVER), ROWS/RANGE/GROUPS frame semantics, named WINDOW clause, percentile functions, and common patterns (top-N per group, running totals, drawdown, gaps-and-islands, deduplication, sessionization)."
created: 2026-04-08
updated: 2026-04-11
status: complete
---

# Window Functions

> [!abstract]- Summary
>
> Window functions are the T-SQL language surface for computing partition-aware analytics without collapsing the underlying rows: this note defines the `OVER` clause, the ranking, offset, aggregate, and percentile families built on top of it, and the frame semantics that make running, moving, and peer-aware calculations correct.
>
> **Window fundamentals**
> - covers `OVER`, `PARTITION BY`, `ORDER BY`, the contrast with `GROUP BY`, and the rule that window functions annotate rows instead of reducing them
>
> **Ranking and positional functions**
> - covers `ROW_NUMBER`, `RANK`, `DENSE_RANK`, `NTILE`, `PERCENT_RANK`, and `CUME_DIST` for ordered row comparison and segmentation
>
> **Offset and aggregate windows**
> - covers `LAG`, `LEAD`, `FIRST_VALUE`, `LAST_VALUE`, plus aggregate windows such as `SUM`, `AVG`, `MIN`, `MAX`, and `STDEV` over partitions and frames
>
> **Frame semantics**
> - explains `ROWS`, `RANGE`, and `GROUPS`, the default-frame trap, and why explicit whole-partition or running frames matter for correctness
>
> **Applied patterns**
> - covers top-N per group, running totals, moving averages, drawdown, gaps-and-islands, sessionization, and deterministic deduplication
>
> **SQL Server 2022 and percentile features**
> - covers named `WINDOW` clauses and percentile functions such as `PERCENTILE_CONT`
>
> **Operations and safety**
> - Warnings: missing tie-breakers make ranking nondeterministic, default frames break `LAST_VALUE`, wide sorts on unsupported indexes are expensive, and stacked `DISTINCT` / `GROUP BY` often hides a `ROW_NUMBER` problem
> - Recommendations: prefer window functions over self joins and correlated aggregate subqueries, specify frames explicitly when order matters, use unique tie-breakers in ranking, and switch to plain `GROUP BY` when one row per group is the real target

> [!note]- Glossary
>
> **Window function**
> - A function evaluated over a logical set of rows related to the current row while still returning one output row per input row.
> - It matters because the note’s core idea is preserving detail rows while attaching analytical context to each one.
>
> > [!info] Analytics without row collapse
> >
> > A window function answers questions like ranking or running totals without forcing a `GROUP BY`. That is what makes it so useful in reporting and pipeline logic.
>
> ---
>
> **`OVER` clause**
> - The syntax block that defines the partition, ordering, and optional frame for a window function.
> - It matters because the function name alone is not enough; the `OVER` clause defines which rows each calculation can see.
>
> > [!warning] Function semantics live in the window spec
> >
> > `SUM(col)` and `SUM(col) OVER (...)` are radically different operations. The `OVER` clause is what turns an aggregate into a row-preserving analytical computation.
>
> ---
>
> **Partition**
> - The subset of rows identified by `PARTITION BY` that forms the logical group for a window calculation.
> - It matters because partitions define where running totals reset, where rankings restart, and which rows count as peers for a calculation.
>
> > [!warning] Partitioning is not grouping
> >
> > `PARTITION BY` creates logical groups for a window function, but it does not reduce the result to one row per group the way `GROUP BY` does.
>
> ---
>
> **Frame**
> - The ordered subset of a partition visible to the current row when a window function supports frame semantics.
> - It matters because running and moving calculations depend on the frame, not just on the partition.
>
> > [!warning] The default frame is easy to forget
> >
> > If an ordered window uses the default frame, SQL Server may evaluate over a peer-aware prefix rather than the whole partition. That changes functions like `LAST_VALUE` in non-obvious ways.
>
> ---
>
> **Peer group**
> - A set of rows within an ordered partition that tie on the `ORDER BY` values of the window specification.
> - It matters because ranking with ties and `RANGE` / `GROUPS` frames operate on peer semantics rather than row positions alone.
>
> > [!info] Equal sort keys are a logical group
> >
> > Peer rows often behave together for ranking and framing. If the ordering is not unique, the peer group may be larger than the author expects.
>
> ---
>
> **`ROW_NUMBER`**
> - The ranking function that assigns a unique sequential number to each row inside a partition according to the specified order.
> - It matters because it is the standard tool for deterministic top-N-per-group queries and deduplication.
>
> > [!warning] Determinism needs a tie-breaker
> >
> > If the ordering columns are not unique, which row gets `1` can vary. Add a stable unique tie-breaker when the chosen survivor matters.
>
> ---
>
> **`RANK` / `DENSE_RANK`**
> - Ranking functions that assign the same rank to tied rows, with `RANK` leaving gaps and `DENSE_RANK` keeping rank numbers contiguous.
> - It matters because they are the right choice when ties are part of the meaning and should not be broken arbitrarily.
>
> > [!info] Same ties, different numbering
> >
> > Both functions preserve ties. The difference is whether later ranks skip numbers after a tie group.
>
> ---
>
> **`LAG` / `LEAD`**
> - Offset functions that return a value from a previous or following row in the same ordered partition.
> - It matters because they replace many self joins and make prior-row / next-row comparison patterns direct and readable.
>
> > [!warning] Offset logic depends on sort correctness
> >
> > If the partition order is wrong or incomplete, the “previous” or “next” row is wrong too. Offset functions are only as sound as the `ORDER BY` that drives them.
>
> ---
>
> **`FIRST_VALUE` / `LAST_VALUE`**
> - Value functions that return the first or last visible value within the current frame.
> - It matters because they look simple but are highly sensitive to frame definition, especially `LAST_VALUE`.
>
> > [!warning] `LAST_VALUE` is the classic frame trap
> >
> > Without an explicit whole-partition frame, `LAST_VALUE` often returns the last value in the current frame prefix, not the last row in the partition.
>
> ---
>
> **Running frame**
> - A frame that starts at the partition boundary and ends at the current row, commonly written with `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`.
> - It matters because running totals, cumulative maxima, and drawdown calculations rely on this exact visibility rule.
>
> > [!info] Running means prefix, not whole partition
> >
> > A running frame grows row by row through the partition. It is different from a whole-partition frame, which exposes all rows at every position.
>
> ---
>
> **`ROWS` / `RANGE` / `GROUPS`**
> - The three frame units that define whether a frame advances by physical row count, by ordered value peers, or by peer groups.
> - It matters because choosing the wrong unit changes which rows are included in each calculation.
>
> > [!warning] Frame unit changes semantics
> >
> > `ROWS` is usually the safest and most explicit choice. `RANGE` and `GROUPS` are valuable, but only when peer-aware behavior is genuinely intended.
>
> ---
>
> **Named `WINDOW` clause**
> - The SQL Server 2022 feature that lets a query define a reusable window specification once and reference it from multiple window functions.
> - It matters because repeated partition and order specifications become easier to read and maintain when factored into a named window.
>
> > [!info] Reuse the specification, not the result
> >
> > The named window does not materialize anything. It just removes duplication in the window definition so related calculations stay aligned.
>
> ---
>
> **`PERCENTILE_CONT`**
> - A percentile window function that returns a continuous interpolated percentile value within an ordered distribution.
> - It matters because medians and percentile cut points are common analytics that cannot be expressed cleanly with plain ranking alone.
>
> > [!warning] Continuous percentile can interpolate
> >
> > The returned value may not match any actual row value. That is expected behavior for continuous percentile calculation, not an error.
>
> ---
>
> **Deduplication by ranking**
> - The pattern of assigning row numbers inside each key partition and keeping only the winning row.
> - It matters because many awkward `DISTINCT` plus `GROUP BY` queries are really attempts to express this exact survivorship rule.
>
> > [!warning] Make the survivor rule explicit
> >
> > If the query keeps one row per key, the ordering must explain why that row wins. `ROW_NUMBER` makes that choice visible in a way ad hoc deduplication does not.

## Window Function Fundamentals

A window function differs from a plain aggregate in one critical way: it **does not collapse rows**. A `GROUP BY` query folds every group into a single row; a window function leaves every input row in the result set and annotates each one with a value computed over a surrounding set of rows — the **window**. The window is described by the `OVER` clause, which has three parts: the partition (which rows are peers), the ordering (what sequence they appear in), and the frame (which subset of the partition is visible from the current row).

All window functions share this shape:

```sql
<function>(<args>) OVER (
    [ PARTITION BY <partition_columns> ]
    [ ORDER BY    <order_columns> ]
    [ <frame>                       ]
)
```

The three clauses are optional in different combinations depending on the function, but the `OVER` keyword itself is required. Without `OVER`, SQL Server parses the expression as a regular scalar or aggregate function and returns a syntax error (or collapses rows under `GROUP BY`).

### The OVER clause

The `OVER` clause is the bridge between a row-level query and a group-level computation. It tells SQL Server "for each row in the result, define this window, evaluate the function over it, and return one value". The function can be a ranking function, an offset/value function, an aggregate, or a percentile function.

#### Basic shape of a window function

*Return the closing price of SAP.DE alongside the per-symbol average close, computed across the entire partition.*

```sql
SELECT TOP (5)
    symbol,
    [date],
    [close],
    AVG([close]) OVER (PARTITION BY symbol) AS avg_close_per_symbol
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'SAP.DE' AND [date] >= '2026-03-30'
ORDER BY [date];
```

| symbol | date | close | avg_close_per_symbol |
|---|---|---|---|
| SAP.DE | 2026-03-30 | 147.02 | 147.38000000000002 |
| SAP.DE | 2026-03-31 | 146.9 | 147.38000000000002 |
| SAP.DE | 2026-04-01 | 148.86 | 147.38000000000002 |
| SAP.DE | 2026-04-02 | 148.9 | 147.38000000000002 |
| SAP.DE | 2026-04-07 | 145.22 | 147.38000000000002 |

Every row in the result retains its own `[date]` and `[close]` values, and every row also carries the partition-wide average (`147.38…`) as a new column. The average is computed once per partition and broadcast to all rows in that partition. The trailing `2` in `147.38000000000002` is a reminder that `[close]` is stored as `float` — see [[02-data-types-conversion-and-null-handling]] for why `float` is the wrong type for prices and how to convert back to `decimal` on the way out.

#### OVER with and without PARTITION BY

When `PARTITION BY` is omitted, the window spans the entire result set — every row is a peer. When `PARTITION BY <cols>` is present, the window is restricted to rows that share the same values in those columns. The function evaluates independently inside each partition, so rows in partition A never see rows in partition B.

The `OVER ()` form (empty parentheses) is valid T-SQL and means "one partition containing everything". It is useful when you want to compare a row to a global aggregate — for example `[close] / AVG([close]) OVER ()` to express every price as a fraction of the overall mean.

### PARTITION BY vs GROUP BY

`PARTITION BY` and `GROUP BY` both describe grouping, but they do it at different stages of query processing. `GROUP BY` is a row reduction — it runs before the `SELECT` list is projected and collapses the input to one row per group. `PARTITION BY` is part of the window specification, which runs **after** projection and keeps every input row. The two clauses can coexist in the same query; they are orthogonal.

#### PARTITION BY keeps every row

*Return every daily row for two symbols along with the per-symbol average close; each input row is preserved.*

```sql
SELECT TOP (5)
    symbol,
    [date],
    [close],
    AVG([close]) OVER (PARTITION BY symbol) AS avg_close
FROM silver.eurostoxx50_ohlcv
WHERE symbol IN ('SAP.DE','AIR.PA')
  AND [date] >= '2026-04-01'
ORDER BY symbol, [date];
```

| symbol | date | close | avg_close |
|---|---|---|---|
| AIR.PA | 2026-04-01 | 167.9 | 165.22 |
| AIR.PA | 2026-04-02 | 165.14 | 165.22 |
| AIR.PA | 2026-04-07 | 162.62 | 165.22 |
| SAP.DE | 2026-04-01 | 148.86 | 147.66 |
| SAP.DE | 2026-04-02 | 148.9 | 147.66 |

Six input rows produce six output rows. AIR.PA's three rows all carry `165.22` (the average of the three AIR.PA closes) and SAP.DE's rows carry `147.66` (the average of the three SAP.DE closes). Every individual `[date]` and `[close]` value survives into the result.

#### GROUP BY collapses to one row per group

*Same inputs and same average, but as a classic `GROUP BY` aggregate.*

```sql
SELECT
    symbol,
    AVG([close]) AS avg_close,
    COUNT(*) AS n_rows
FROM silver.eurostoxx50_ohlcv
WHERE symbol IN ('SAP.DE','AIR.PA')
  AND [date] >= '2026-04-01'
GROUP BY symbol
ORDER BY symbol;
```

| symbol | avg_close | n_rows |
|---|---|---|
| AIR.PA | 165.22 | 3 |
| SAP.DE | 147.66 | 3 |

Six input rows produce only two output rows — one per symbol. The per-symbol averages are the same numbers as in the previous query, but the individual daily rows no longer exist in the result set. If downstream logic needs both the daily detail **and** the aggregate, `GROUP BY` forces a second query or a self-join. `PARTITION BY` avoids both.

> [!tip] Use a window function whenever you need detail plus context in the same row
>
> If a query joins its own `GROUP BY` result back to the detail table just to decorate each row with a group-level number (average, max, count), replace the self-join with a window function. The window function runs in one pass over the data and avoids materializing the intermediate aggregate. This is the single most common use case and the most common missed optimization in legacy T-SQL.

### ORDER BY inside OVER

`ORDER BY` inside `OVER` serves two purposes depending on the function family:

- For **ranking functions** (`ROW_NUMBER`, `RANK`, `DENSE_RANK`, `NTILE`, `PERCENT_RANK`, `CUME_DIST`) the order determines the ranking sequence. It is mandatory — omitting it is a syntax error.
- For **offset functions** (`LAG`, `LEAD`, `FIRST_VALUE`, `LAST_VALUE`) the order determines what "previous" and "next" mean. It is mandatory.
- For **aggregate functions** (`SUM`, `AVG`, `COUNT`, `MIN`, `MAX`, `STDEV`, etc.) the order is optional but changes the semantics: with no `ORDER BY`, the aggregate covers the entire partition; with `ORDER BY`, the aggregate covers a **frame** that grows row by row (see [[#Window Frames: ROWS, RANGE, and GROUPS]]).

#### Ordering a ranking function

*Use `ORDER BY [date] DESC` to number SAP.DE's rows from the most recent backward.*

```sql
SELECT
    symbol,
    [date],
    [close],
    ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY [date] DESC) AS rn
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'SAP.DE'
  AND [date] >= '2026-04-01'
ORDER BY rn;
```

| symbol | date | close | rn |
|---|---|---|---|
| SAP.DE | 2026-04-07 | 145.22 | 1 |
| SAP.DE | 2026-04-02 | 148.9 | 2 |
| SAP.DE | 2026-04-01 | 148.86 | 3 |

`rn = 1` is always the newest row because the `ORDER BY [date] DESC` inside the window puts the latest date first. This is the building block for every "latest row per key" query.

## Ranking Functions

Ranking functions assign each row a position within its partition based on an order. They all require `ORDER BY` inside `OVER` and do not accept a frame clause. The four core functions differ in how they handle ties:

- **`ROW_NUMBER`** — every row gets a unique sequential number, ties are broken arbitrarily by the tie-break columns (or non-deterministically if none are provided).
- **`RANK`** — tied rows share the same rank, then leave a gap equal to the number of tied rows before the next distinct rank.
- **`DENSE_RANK`** — tied rows share the same rank, but the next distinct rank is always the immediate successor (no gaps).
- **`NTILE(n)`** — splits the partition into `n` approximately equal buckets and returns the bucket number (1 through `n`).

SQL Server also provides **`PERCENT_RANK`** and **`CUME_DIST`**, which return the row's relative position in the partition as a value between 0 and 1.

### ROW_NUMBER

`ROW_NUMBER()` assigns each row in the ordered partition a unique sequential integer starting at 1. It is the most frequently used window function in practice because it solves the "latest row per key", "first N per group", "paginate a ranked result", and "deduplicate" problems with a single CTE.

#### Latest row per key

*Return the most recent row for every EUROSTOXX50 symbol using `ROW_NUMBER` on descending date.*

```sql
;WITH latest AS (
    SELECT
        symbol,
        [date],
        [close],
        ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY [date] DESC) AS rn
    FROM silver.eurostoxx50_ohlcv
)
SELECT TOP (5) symbol, [date], [close]
FROM latest
WHERE rn = 1
ORDER BY symbol;
```

| symbol | date | close |
|---|---|---|
| ABI.BR | 2026-04-07 | 61.62 |
| AD.AS | 2026-04-07 | 41.69 |
| ADS.DE | 2026-04-07 | 130.85 |
| ADYEN.AS | 2026-04-07 | 844.2 |
| AI.PA | 2026-04-07 | 181.5 |

Every symbol's newest row is stamped `rn = 1` inside the CTE, and the outer `WHERE rn = 1` keeps only those rows. This pattern scales to any "most recent / highest / earliest per key" question by changing the `ORDER BY` column and direction. It is strictly more flexible than `SELECT TOP (1) ... ORDER BY ...` because it returns one row per key in a single pass, whereas `TOP (1)` would need to run once per key via `CROSS APPLY`.

#### Non-deterministic tiebreaker trap

> [!warning] ROW_NUMBER with a non-unique ORDER BY is non-deterministic
>
> When the `ORDER BY` columns inside `OVER` do not uniquely identify each row, SQL Server is free to assign `ROW_NUMBER` values in any order among the tied rows. The same query can return different `rn` values across executions, across replicas, or after a plan change. Queries that filter on `rn = 1` may return a *different* row on each run — leading to phantom data drift in downstream pipelines.

*Five rows have `[close] = 100` exactly. Ordered only by `[date]`, which is unique per symbol but not across all rows here, the ranking is still deterministic per partition — but if two rows in the **same** partition tied on `[date]`, `rn` would be non-deterministic.*

```sql
;WITH tied AS (
    SELECT
        symbol,
        [date],
        [close],
        ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY [date]) AS rn
    FROM silver.eurostoxx50_ohlcv
    WHERE [close] = 100
)
SELECT TOP (5) * FROM tied ORDER BY rn;
```

| symbol | date | close | rn |
|---|---|---|---|
| SAN.PA | 2022-05-16 | 100.0 | 1 |
| SAF.PA | 2021-12-16 | 100.0 | 1 |
| AIR.PA | 2021-03-12 | 100.0 | 1 |
| SGO.PA | 2025-03-17 | 100.0 | 1 |
| VOW.DE | 2024-09-24 | 100.0 | 1 |

Because the partition is `symbol`, every row here is the only `[close] = 100` in its own symbol and gets `rn = 1`. The risk is when two rows in the same partition share all `ORDER BY` values — the engine may pick either as rank 1.

> [!success] Always add a unique tiebreaker column to ORDER BY
>
> For any production `ROW_NUMBER` query, append a column that disambiguates ties. A monotonic `id`, a timestamp with sub-second precision, or any natural key works. Example: `ORDER BY signal_date DESC, id DESC`. The tiebreaker makes the ranking deterministic across executions and makes the CTE safe to materialize and filter on `rn = 1`.

### RANK and DENSE_RANK

`RANK` and `DENSE_RANK` differ from `ROW_NUMBER` only when ties exist. `RANK` leaves gaps after a tie — if three rows tie at rank 1, the next row is rank 4. `DENSE_RANK` removes the gaps — after a three-way tie at rank 1, the next row is rank 2. Use `RANK` when downstream logic expects "positional" ranks (the 4th row really is in the 4th position of the ordering); use `DENSE_RANK` when the rank value must count distinct ordering values.

#### RANK vs DENSE_RANK vs ROW_NUMBER with ties

*Compare the three functions on SAP.DE's 2025 trading days ordered by descending volume.*

```sql
SELECT TOP (6)
    symbol,
    [date],
    volume,
    RANK()       OVER (ORDER BY volume DESC) AS r,
    DENSE_RANK() OVER (ORDER BY volume DESC) AS dr,
    ROW_NUMBER() OVER (ORDER BY volume DESC) AS rn
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'SAP.DE'
  AND [date] BETWEEN '2025-01-01' AND '2025-12-31'
ORDER BY r;
```

| symbol | date | volume | r | dr | rn |
|---|---|---|---|---|---|
| SAP.DE | 2025-06-20 | 7942129 | 1 | 1 | 1 |
| SAP.DE | 2025-04-07 | 6895323 | 2 | 2 | 2 |
| SAP.DE | 2025-03-21 | 6042210 | 3 | 3 | 3 |
| SAP.DE | 2025-09-19 | 5436865 | 4 | 4 | 4 |
| SAP.DE | 2025-04-04 | 4883372 | 5 | 5 | 5 |
| SAP.DE | 2025-04-08 | 4029655 | 6 | 6 | 6 |

SAP.DE's daily volumes are all distinct in this window, so `RANK`, `DENSE_RANK`, and `ROW_NUMBER` agree. If two days tied for the top volume, `r` would show `1, 1, 3, ...`, `dr` would show `1, 1, 2, ...`, and `rn` would show `1, 2, 3, ...` — the same comparison that appears in every concurrency teaching slide. The intuition is: `ROW_NUMBER` is arbitrary on ties, `RANK` preserves the position count, `DENSE_RANK` preserves the distinct-value count.

### NTILE

`NTILE(n)` splits the partition into `n` approximately equal buckets and assigns each row the bucket number 1 through `n`. If the partition row count is not a multiple of `n`, the early buckets get one extra row. The ordering inside `OVER` determines which rows fall into the "first" bucket.

#### Quartile buckets

*Split SAP.DE's Q1 2026 trading days into four volume quartiles and show the highest-volume quartile (`volume_quartile = 1`).*

```sql
SELECT TOP (8)
    symbol,
    [date],
    volume,
    NTILE(4) OVER (PARTITION BY symbol ORDER BY volume DESC) AS volume_quartile
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'SAP.DE'
  AND [date] BETWEEN '2026-01-01' AND '2026-03-31'
ORDER BY volume DESC;
```

| symbol | date | volume | volume_quartile |
|---|---|---|---|
| SAP.DE | 2026-01-29 | 15846791 | 1 |
| SAP.DE | 2026-03-20 | 9373510 | 1 |
| SAP.DE | 2026-02-04 | 6228386 | 1 |
| SAP.DE | 2026-02-03 | 5539886 | 1 |
| SAP.DE | 2026-02-05 | 5467507 | 1 |
| SAP.DE | 2026-01-30 | 5332696 | 1 |
| SAP.DE | 2026-02-24 | 4602328 | 1 |
| SAP.DE | 2026-02-11 | 4581824 | 1 |

The top 8 rows all land in quartile 1, as expected given the `DESC` order. `NTILE` is the right function when a query needs to segment rows into **fixed-count** buckets regardless of the underlying value distribution — tile assignments in A/B tests, workload shards for parallel processing, or percentile buckets for cohort analysis. It is the wrong function when the bucket boundaries should follow value ranges (use `CASE WHEN` or `NTILE` on pre-bucketed values instead).

### PERCENT_RANK and CUME_DIST

Both return a fractional position in the ordered partition. `PERCENT_RANK()` is defined as `(rank - 1) / (row_count - 1)` and ranges from `0` for the first row to `1` for the last. `CUME_DIST()` is defined as `row_count_up_to_and_including_current / row_count` and ranges from `1/n` for the first row to `1` for the last. They answer slightly different questions: `PERCENT_RANK` is "what fraction of rows are strictly below me" and `CUME_DIST` is "what fraction of rows are at or below me".

#### Relative position of a close within its partition

*Show `PERCENT_RANK` and `CUME_DIST` for three SAP.DE rows ordered by ascending close.*

```sql
SELECT TOP (5)
    symbol,
    [date],
    [close],
    CAST(PERCENT_RANK() OVER (PARTITION BY symbol ORDER BY [close]) AS decimal(10,4)) AS pct_rank,
    CAST(CUME_DIST()    OVER (PARTITION BY symbol ORDER BY [close]) AS decimal(10,4)) AS cume_dist
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'SAP.DE'
  AND [date] >= '2026-04-01'
ORDER BY [close];
```

| symbol | date | close | pct_rank | cume_dist |
|---|---|---|---|---|
| SAP.DE | 2026-04-07 | 145.22 | 0.0000 | 0.3333 |
| SAP.DE | 2026-04-01 | 148.86 | 0.5000 | 0.6667 |
| SAP.DE | 2026-04-02 | 148.9 | 1.0000 | 1.0000 |

The lowest row (`145.22`) has `pct_rank = 0` and `cume_dist = 1/3 ≈ 0.333`. The middle row has `pct_rank = 0.5` (one of two rows strictly above it) and `cume_dist = 2/3`. The highest row has `pct_rank = 1` and `cume_dist = 1`. `PERCENT_RANK` is the canonical function for "this row is in the top X% of the partition" calculations; `CUME_DIST` is the canonical function for empirical CDF computation.

### Ranking function comparison table

| Function | Ties get same value | Leaves gaps after ties | Output range | ORDER BY required | Typical use |
|---|---|---|---|---|---|
| `ROW_NUMBER()` | No | N/A | 1..n (all unique) | Yes | Latest per key, pagination, dedup |
| `RANK()` | Yes | Yes | 1..n (can skip) | Yes | Leaderboards, positional rank |
| `DENSE_RANK()` | Yes | No | 1..k (k = distinct values) | Yes | Rank by distinct value count |
| `NTILE(n)` | No | N/A | 1..n (bucket number) | Yes | Fixed-count segmentation |
| `PERCENT_RANK()` | Same value on ties | N/A | 0.0..1.0 | Yes | Percentile position |
| `CUME_DIST()` | Same value on ties | N/A | (1/n)..1.0 | Yes | Empirical CDF |

## Offset and Value Functions

Offset and value functions read values from other rows within the window without a self-join. `LAG` reads a row N positions before the current row; `LEAD` reads a row N positions after. `FIRST_VALUE` returns the first value in the frame; `LAST_VALUE` returns the last. All four require `ORDER BY` inside `OVER`. `LAG` and `LEAD` do not accept a frame clause (they always read a single row at a fixed offset); `FIRST_VALUE` and `LAST_VALUE` do accept a frame — and the default frame is the source of the most common window-function trap in SQL Server (see [[#The LAST_VALUE default frame trap]]).

### LAG and LEAD

`LAG(<expression>, <offset>, <default>)` returns the value of `<expression>` from the row `offset` positions before the current row in the ordered partition. `LEAD` does the same for rows after. Both functions have two optional arguments:

- **`offset`** — how many rows to look back (for `LAG`) or forward (for `LEAD`). Defaults to 1.
- **`default`** — the value to return when the offset would fall outside the partition (no row exists at that position). Defaults to `NULL`.

#### Basic LAG/LEAD for previous and next row

*Read the prior and next daily close for SAP.DE across a five-trading-day window.*

```sql
SELECT TOP (5)
    symbol,
    [date],
    [close],
    LAG([close])  OVER (PARTITION BY symbol ORDER BY [date]) AS prev_close,
    LEAD([close]) OVER (PARTITION BY symbol ORDER BY [date]) AS next_close
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'SAP.DE'
  AND [date] BETWEEN '2026-03-30' AND '2026-04-07'
ORDER BY [date];
```

| symbol | date | close | prev_close | next_close |
|---|---|---|---|---|
| SAP.DE | 2026-03-30 | 147.02 | NULL | 146.9 |
| SAP.DE | 2026-03-31 | 146.9 | 147.02 | 148.86 |
| SAP.DE | 2026-04-01 | 148.86 | 146.9 | 148.9 |
| SAP.DE | 2026-04-02 | 148.9 | 148.86 | 145.22 |
| SAP.DE | 2026-04-07 | 145.22 | 148.9 | NULL |

The first row has `prev_close = NULL` because no row exists one position before it in the filtered partition. The last row has `next_close = NULL` for the same reason on the other side. If downstream logic divides by `prev_close` without guarding, the first row will trigger a divide-by-zero or a `NULL` propagation (see the day-over-day return example below for the `NULLIF` guard).

#### LAG with offset and default argument

*Look five rows back with `LAG([close], 5, 0.0)` to get the five-day prior close; the first five rows of the partition return `0.0` instead of `NULL`.*

```sql
SELECT TOP (5)
    symbol,
    [date],
    [close],
    LAG([close], 5, 0.0) OVER (PARTITION BY symbol ORDER BY [date]) AS close_5d_ago
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'SAP.DE'
  AND [date] >= '2021-01-04'
ORDER BY [date];
```

| symbol | date | close | close_5d_ago |
|---|---|---|---|
| SAP.DE | 2021-01-04 | 105.32 | 0.0 |
| SAP.DE | 2021-01-05 | 105.04 | 0.0 |
| SAP.DE | 2021-01-06 | 105.48 | 0.0 |
| SAP.DE | 2021-01-07 | 104.52 | 0.0 |
| SAP.DE | 2021-01-08 | 106.18 | 0.0 |

The first five rows of the partition return the default value `0.0` because there are fewer than five rows before them. The default argument is useful when the consumer expects a number rather than `NULL` — for example a dashboard chart that cannot plot `NULL` — but it can mask real data errors: in this case `0.0` is visually indistinguishable from a genuine zero close. Prefer `NULL` unless a specific downstream contract requires a sentinel.

#### Day-over-day return pattern

*Compute the day-over-day return as `([close] - LAG([close])) / LAG([close])` with a `NULLIF` guard.*

```sql
SELECT TOP (5)
    symbol,
    [date],
    [close],
    LAG([close]) OVER (PARTITION BY symbol ORDER BY [date]) AS prev_close,
    CAST( ([close] - LAG([close]) OVER (PARTITION BY symbol ORDER BY [date]))
          / NULLIF(LAG([close]) OVER (PARTITION BY symbol ORDER BY [date]), 0)
          AS decimal(10,6)) AS daily_return
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'SAP.DE'
  AND [date] >= '2026-04-01'
ORDER BY [date];
```

| symbol | date | close | prev_close | daily_return |
|---|---|---|---|---|
| SAP.DE | 2026-04-01 | 148.86 | NULL | NULL |
| SAP.DE | 2026-04-02 | 148.9 | 148.86 | 0.000269 |
| SAP.DE | 2026-04-07 | 145.22 | 148.9 | -0.024715 |

The `NULLIF(..., 0)` wrap prevents a divide-by-zero error if the previous close is exactly zero (impossible for equity closes but defensive coding). The first row's return is `NULL` because `LAG` returns `NULL` for the first row of the partition. SAP.DE dropped about 2.47% from `148.9` to `145.22` between April 2 and April 7. This is the canonical window-function replacement for a self-join on `DATEADD(day, -1, [date])`, and it is both more correct (it naturally handles missing days without introducing `LEFT JOIN` complexity) and faster (single pass over the table). See [[#Self-join vs LAG]] in the anti-patterns section.

### FIRST_VALUE and LAST_VALUE

`FIRST_VALUE(<expression>)` and `LAST_VALUE(<expression>)` return the value of the expression evaluated at the first or last row of the current **frame**, not the partition. This subtle difference is the source of the most common window-function bug in T-SQL.

#### The LAST_VALUE default frame trap

> [!danger] `LAST_VALUE` on the default frame always returns the current row
>
> When `OVER` contains `ORDER BY` but no explicit frame clause, SQL Server applies the default frame `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`. The current row *is* the last row of that frame, so `LAST_VALUE` returns the current row's value — not the last value in the partition. The query looks correct, compiles without warning, and produces a result that is silently wrong.

*Without an explicit frame, `LAST_VALUE([close])` returns each row's own close instead of the partition's last close.*

```sql
SELECT TOP (5)
    symbol,
    [date],
    [close],
    FIRST_VALUE([close]) OVER (PARTITION BY symbol ORDER BY [date]) AS fv_default_frame,
    LAST_VALUE([close])  OVER (PARTITION BY symbol ORDER BY [date]) AS lv_default_frame
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'SAP.DE'
  AND [date] >= '2026-04-01'
ORDER BY [date];
```

| symbol | date | close | fv_default_frame | lv_default_frame |
|---|---|---|---|---|
| SAP.DE | 2026-04-01 | 148.86 | 148.86 | 148.86 |
| SAP.DE | 2026-04-02 | 148.9 | 148.86 | 148.9 |
| SAP.DE | 2026-04-07 | 145.22 | 148.86 | 145.22 |

`fv_default_frame` correctly returns `148.86` (the first close of the partition) on every row because the default frame starts at `UNBOUNDED PRECEDING` and `148.86` *is* the first row. `lv_default_frame` returns a different value on every row (`148.86`, `148.9`, `148.9`, `145.22`) because the default frame ends at `CURRENT ROW`, making "the last value in the frame" equal to the current row's value. This is rarely what the author intended.

> [!success] Always specify an explicit frame for LAST_VALUE
>
> Write `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING` so the frame spans the whole partition. Then `FIRST_VALUE` returns the partition's first value and `LAST_VALUE` returns the partition's last value, which is what a reader expects by name.

#### Fixed frame with UNBOUNDED FOLLOWING

*Widen the frame to the entire partition so `LAST_VALUE` returns the last partition-wide close on every row.*

```sql
SELECT TOP (5)
    symbol,
    [date],
    [close],
    FIRST_VALUE([close]) OVER (
        PARTITION BY symbol
        ORDER BY [date]
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS first_close,
    LAST_VALUE([close]) OVER (
        PARTITION BY symbol
        ORDER BY [date]
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS last_close
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'SAP.DE'
  AND [date] >= '2026-04-01'
ORDER BY [date];
```

| symbol | date | close | first_close | last_close |
|---|---|---|---|---|
| SAP.DE | 2026-04-01 | 148.86 | 148.86 | 145.22 |
| SAP.DE | 2026-04-02 | 148.9 | 148.86 | 145.22 |
| SAP.DE | 2026-04-07 | 145.22 | 148.86 | 145.22 |

Every row now shows `148.86` as `first_close` and `145.22` as `last_close`. This is the correct shape for computing a partition-wide return as `(last_close - first_close) / first_close` directly inside a window expression.

> [!info] NTH_VALUE is not implemented in SQL Server
>
> Other database engines (PostgreSQL, Oracle) offer `NTH_VALUE(expression, n)` to read the Nth row of the frame. SQL Server does not implement this function. The workaround is `LAG(expression, n - 1) OVER (PARTITION BY ... ORDER BY ...)` if measuring backward from the current row, or a CTE that filters on `ROW_NUMBER() = n` for absolute position within the partition.

## Aggregate Window Functions

Any aggregate function (`SUM`, `AVG`, `COUNT`, `MIN`, `MAX`, `STDEV`, `VAR`, `STRING_AGG`, etc.) can be used as a window function by appending an `OVER` clause. The `OVER` clause is optional for aggregates — a plain `SUM(col)` in a `SELECT` is still a grouping aggregate. Once `OVER` is present, the function becomes a window function and the row-reduction behavior disappears.

The critical semantic split for aggregate window functions is whether `ORDER BY` is present inside `OVER`:

- **No `ORDER BY`** — the aggregate is computed across the entire partition. Every row in the partition sees the same value.
- **With `ORDER BY`** — the aggregate is computed across a **frame** that, by default, grows row by row. This produces running totals, expanding averages, and similar cumulative metrics.

### Aggregate without ORDER BY

With no `ORDER BY`, the aggregate function sees the full partition and returns a single value per partition, broadcast to every row. This is the shape for "partition totals" decoration — attaching group-level aggregates to every detail row without a join back to a `GROUP BY` query.

#### Whole-partition totals

*Return the partition-wide sum of volume, average close, and row count for each SAP.DE row.*

```sql
SELECT TOP (5)
    symbol,
    [date],
    [close],
    SUM(volume)  OVER (PARTITION BY symbol) AS total_volume,
    AVG([close]) OVER (PARTITION BY symbol) AS avg_close,
    COUNT(*)     OVER (PARTITION BY symbol) AS n_days
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'SAP.DE'
  AND [date] >= '2026-04-01'
ORDER BY [date];
```

| symbol | date | close | total_volume | avg_close | n_days |
|---|---|---|---|---|---|
| SAP.DE | 2026-04-01 | 148.86 | 7078829 | 147.66 | 3 |
| SAP.DE | 2026-04-02 | 148.9 | 7078829 | 147.66 | 3 |
| SAP.DE | 2026-04-07 | 145.22 | 7078829 | 147.66 | 3 |

All three rows see the same `total_volume`, `avg_close`, and `n_days`. The partition here contains three filtered rows, so `n_days = 3`. Without the `[date] >= '2026-04-01'` filter, `n_days` would be the full partition row count for SAP.DE (`1347` for the EUROSTOXX50 silver table). The filter is applied **before** the window function evaluates, which is a consequence of logical query order: `WHERE` runs before `SELECT` and window functions live in `SELECT`.

### Aggregate with ORDER BY

Adding `ORDER BY` inside `OVER` on an aggregate switches it from "whole partition" to "growing frame". Without an explicit frame clause, SQL Server applies the default `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`. This default looks like a simple running total, but the `RANGE` unit groups peer rows together in a surprising way — see [[#Window Frames: ROWS, RANGE, and GROUPS]] below.

#### Default frame is RANGE UNBOUNDED PRECEDING AND CURRENT ROW

*`SUM` with `ORDER BY [date]` produces a running volume. With distinct dates the result is identical to an explicit `ROWS` frame — but the default frame is `RANGE`, not `ROWS`.*

```sql
SELECT TOP (5)
    symbol,
    [date],
    volume,
    SUM(volume) OVER (PARTITION BY symbol ORDER BY [date]) AS running_volume_default
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'SAP.DE'
  AND [date] >= '2026-04-01'
ORDER BY [date];
```

| symbol | date | volume | running_volume_default |
|---|---|---|---|
| SAP.DE | 2026-04-01 | 3180299 | 3180299 |
| SAP.DE | 2026-04-02 | 1928056 | 5108355 |
| SAP.DE | 2026-04-07 | 1970474 | 7078829 |

Each row's `running_volume_default` accumulates the volume up to and including that row. With unique dates the default `RANGE` frame and an explicit `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` frame produce the same result. The divergence appears only when two rows share the same `ORDER BY` key — `RANGE` collapses them into a single peer group and gives every peer the same running value (see [[#ROWS vs RANGE with peer groups]]).

> [!warning] Default frame hides RANGE semantics
>
> A query written as `SUM(col) OVER (ORDER BY t)` without an explicit frame compiles to `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`. `RANGE` is the less-efficient frame unit on rowstore tables (SQL Server must compute peer groups on the fly) and it produces surprising results when `t` has ties. Production code should always specify `ROWS` explicitly for running totals unless the peer-grouping behavior is genuinely wanted.

> [!success] Append an explicit ROWS frame to running totals
>
> Write `SUM(col) OVER (PARTITION BY key ORDER BY t ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)`. The extra clause makes the intent explicit, avoids the peer-group trap on tied `t` values, and gives the optimizer permission to use the cheaper Window Aggregate operator.

#### Explicit ROWS frame for running totals

*The same running total with an explicit `ROWS` frame. The `ROWS` unit counts physical rows, not peer groups.*

```sql
SELECT TOP (5)
    symbol,
    [date],
    volume,
    SUM(volume) OVER (
        PARTITION BY symbol
        ORDER BY [date]
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_volume
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'SAP.DE'
  AND [date] >= '2026-04-01'
ORDER BY [date];
```

| symbol | date | volume | running_volume |
|---|---|---|---|
| SAP.DE | 2026-04-01 | 3180299 | 3180299 |
| SAP.DE | 2026-04-02 | 1928056 | 5108355 |
| SAP.DE | 2026-04-07 | 1970474 | 7078829 |

With distinct `[date]` values the output matches the default-frame query, but the engine now uses the `Window Aggregate` physical operator (cheaper than `Window Spool`) and the semantics are explicit for the reader. Make this the default in production code.

#### Moving average with N PRECEDING

*Compute a 20-trading-day simple moving average using `ROWS BETWEEN 19 PRECEDING AND CURRENT ROW`.*

```sql
SELECT TOP (5)
    symbol,
    [date],
    [close],
    CAST(AVG([close]) OVER (
        PARTITION BY symbol
        ORDER BY [date]
        ROWS BETWEEN 19 PRECEDING AND CURRENT ROW
    ) AS decimal(18,4)) AS ma_20d
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'SAP.DE'
  AND [date] >= '2026-03-10'
ORDER BY [date];
```

| symbol | date | close | ma_20d |
|---|---|---|---|
| SAP.DE | 2026-03-10 | 169.6 | 169.6000 |
| SAP.DE | 2026-03-11 | 165.44 | 167.5200 |
| SAP.DE | 2026-03-12 | 166.52 | 167.1867 |
| SAP.DE | 2026-03-13 | 166.44 | 167.0000 |
| SAP.DE | 2026-03-16 | 165.46 | 166.6920 |

The frame width is **20 rows** (the current row plus 19 preceding), so the first row's moving average is just its own value because there are zero preceding rows in the filtered partition. The second row averages 2 values, the third averages 3, and so on until the window reaches its full 20-row width on row 20. Downstream consumers that require a "full-window" result should filter on `ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY [date]) >= 20` or compute the moving average on a wider source window and then filter.

> [!info] N trading days, not N calendar days
>
> Because the `silver.eurostoxx50_ohlcv` table has one row per trading day (no rows on weekends or exchange holidays), `ROWS BETWEEN 19 PRECEDING AND CURRENT ROW` is a **20-trading-day** window, which translates to roughly 4 calendar weeks. For a calendar-day moving average, use `RANGE BETWEEN INTERVAL '19' DAY PRECEDING AND CURRENT ROW` — but SQL Server does not support interval-valued `RANGE` frames, so the workaround is to join against a calendar table and use `ROWS` on the padded result.

#### MIN/MAX/STDEV over a rolling window

*Compute rolling 20-day minimum, maximum, and standard deviation for SAP.DE's close.*

```sql
SELECT TOP (5)
    symbol,
    [date],
    [close],
    CAST(MIN([close])   OVER (PARTITION BY symbol ORDER BY [date] ROWS BETWEEN 19 PRECEDING AND CURRENT ROW) AS decimal(18,4)) AS min_20d,
    CAST(MAX([close])   OVER (PARTITION BY symbol ORDER BY [date] ROWS BETWEEN 19 PRECEDING AND CURRENT ROW) AS decimal(18,4)) AS max_20d,
    CAST(STDEV([close]) OVER (PARTITION BY symbol ORDER BY [date] ROWS BETWEEN 19 PRECEDING AND CURRENT ROW) AS decimal(18,4)) AS stdev_20d
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'SAP.DE'
  AND [date] >= '2026-03-10'
ORDER BY [date];
```

| symbol | date | close | min_20d | max_20d | stdev_20d |
|---|---|---|---|---|---|
| SAP.DE | 2026-03-10 | 169.6 | 169.6000 | 169.6000 | NULL |
| SAP.DE | 2026-03-11 | 165.44 | 165.4400 | 169.6000 | 2.9416 |
| SAP.DE | 2026-03-12 | 166.52 | 165.4400 | 169.6000 | 2.1586 |
| SAP.DE | 2026-03-13 | 166.44 | 165.4400 | 169.6000 | 1.8016 |
| SAP.DE | 2026-03-16 | 165.46 | 165.4400 | 169.6000 | 1.7055 |

`STDEV` returns `NULL` on the first row because the sample standard deviation of a single value is undefined (`n - 1 = 0` in the denominator). Use `STDEVP` for the population standard deviation if that row needs a number. Rolling `MIN` and `MAX` over a window are the building blocks for Bollinger bands, Donchian channels, and many other technical indicators.

## Window Frames: ROWS, RANGE, and GROUPS

A **frame** is the subset of the partition visible from the current row. The frame clause has three pieces:

- **Unit** — `ROWS`, `RANGE`, or `GROUPS` (SQL 2022+).
- **Start** — one of `UNBOUNDED PRECEDING`, `N PRECEDING`, or `CURRENT ROW`.
- **End** — one of `UNBOUNDED FOLLOWING`, `N FOLLOWING`, `CURRENT ROW`, or omitted (in which case it defaults to `CURRENT ROW`).

The full syntax is:

```sql
<unit> BETWEEN <start> AND <end>
```

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
flowchart LR
    UP["UNBOUNDED<br/>PRECEDING"]
    NP["N<br/>PRECEDING"]
    CR["CURRENT<br/>ROW"]
    NF["N<br/>FOLLOWING"]
    UF["UNBOUNDED<br/>FOLLOWING"]
    UP --> NP --> CR --> NF --> UF
    UP -. start .-> CR
    CR -. end .-> UF
```

### Frame unit: ROWS

`ROWS` counts physical rows in the ordered partition. `ROWS BETWEEN 4 PRECEDING AND CURRENT ROW` means "the current row plus the four rows directly before it in the `ORDER BY` sequence". Ties in the `ORDER BY` column do not affect `ROWS` — each tied row still counts as one. `ROWS` is the correct unit for most practical running totals and moving windows because it is deterministic and cheap.

### Frame unit: RANGE

`RANGE` groups rows by their `ORDER BY` value and treats all rows with the same value as a **peer group** that must be included or excluded together. `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` means "every row whose `ORDER BY` value is less than or equal to the current row's value", including every peer of the current row. With `RANGE`, the only supported boundaries in SQL Server are `UNBOUNDED PRECEDING`, `UNBOUNDED FOLLOWING`, and `CURRENT ROW` — numeric `N PRECEDING`/`N FOLLOWING` require an interval-valued `ORDER BY` column, which SQL Server does not support.

#### ROWS vs RANGE with peer groups

*A toy table with three tied values shows how `ROWS` and `RANGE` diverge.*

```sql
;WITH t AS (
    SELECT v FROM (VALUES (10),(20),(20),(20),(30),(40)) AS s(v)
)
SELECT
    v,
    SUM(v) OVER (ORDER BY v ROWS  BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS rows_running,
    SUM(v) OVER (ORDER BY v RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS range_running
FROM t
ORDER BY v;
```

| v | rows_running | range_running |
|---|---|---|
| 10 | 10 | 10 |
| 20 | 30 | 70 |
| 20 | 50 | 70 |
| 20 | 70 | 70 |
| 30 | 100 | 100 |
| 40 | 140 | 140 |

The three rows with `v = 20` are peers. Under `RANGE`, they are all assigned the same cumulative sum `70` (which is `10 + 20 + 20 + 20`) because the frame includes every peer. Under `ROWS`, each tied row has its own cumulative sum (`30`, `50`, `70`) because `ROWS` counts physical rows and walks through peers one by one. The behavior converges again at `v = 30` and `v = 40` because those values are unique.

> [!warning] RANGE is the default and can silently give wrong running totals
>
> When you write `SUM(col) OVER (ORDER BY t)` the frame defaults to `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`. If `t` has duplicate values (timestamps with low precision, non-unique dates, discretized metrics), every row with the same `t` gets the same cumulative sum — which is almost never what a "running total" query means.

> [!success] Always write ROWS for running totals
>
> Make `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` (or `ROWS UNBOUNDED PRECEDING` as shorthand) the unconditional default for running totals. Reach for `RANGE` only when peer grouping is genuinely wanted — which, in practice, is rare.

### Frame unit: GROUPS (SQL 2022+)

SQL Server 2022 added the `GROUPS` frame unit. `GROUPS` counts **peer groups** rather than rows or values — `GROUPS BETWEEN 2 PRECEDING AND CURRENT ROW` means "the current peer group plus the two peer groups before it". It sits between `ROWS` (counts individual rows) and `RANGE` (includes all peers of the current row without counting). `GROUPS` is the right unit for "the last N distinct values in the ordering", for example "the last 3 distinct days of data" in a table where each day has multiple rows.

### Frame boundaries

| Boundary | Meaning | Used as start | Used as end |
|---|---|---|---|
| `UNBOUNDED PRECEDING` | First row of partition | Yes | No |
| `N PRECEDING` | N rows/groups before current | Yes | Yes |
| `CURRENT ROW` | The current row itself | Yes | Yes |
| `N FOLLOWING` | N rows/groups after current | Yes | Yes |
| `UNBOUNDED FOLLOWING` | Last row of partition | No | Yes |

The start boundary must be on or before the end boundary. `BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` and `BETWEEN 2 PRECEDING AND 2 FOLLOWING` are valid; `BETWEEN CURRENT ROW AND UNBOUNDED PRECEDING` is not. Omitting the `BETWEEN ... AND ...` and writing just a start (e.g. `ROWS UNBOUNDED PRECEDING`) is shorthand for `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`.

> [!info] EXCLUDE clause is not supported in SQL Server
>
> ANSI SQL defines an `EXCLUDE` clause (`EXCLUDE CURRENT ROW`, `EXCLUDE GROUP`, `EXCLUDE TIES`, `EXCLUDE NO OTHERS`) for removing rows from the frame. SQL Server 2022 does not implement it. The only workaround is manual subtraction: compute the aggregate over the whole frame and subtract the current row, which works for `SUM` and `COUNT` but not for `MIN`, `MAX`, or `STDEV`.

### Frame decision table

| Goal | Frame |
|---|---|
| Running total / cumulative sum | `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` |
| Moving window of last N rows | `ROWS BETWEEN (N-1) PRECEDING AND CURRENT ROW` |
| Centered window of 2N+1 rows | `ROWS BETWEEN N PRECEDING AND N FOLLOWING` |
| Whole partition (for `LAST_VALUE`, global aggregates) | `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING` |
| Look ahead only | `ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING` |
| Peer-grouped running aggregate | `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` |

## Common Window-Function Patterns

These are the patterns that show up in day-to-day data engineering work. Every one of them can be expressed without window functions — and every one becomes either slower, less readable, or both when rewritten with self-joins and correlated subqueries.

### Top-N per group

The most common practical pattern: return the N highest or lowest rows for each group. There are two idiomatic T-SQL shapes — a `ROW_NUMBER` CTE and a `CROSS APPLY TOP (N)` subquery — and they are interchangeable for most cases. Pick the CTE when the ranking logic has ties or needs multiple rank columns; pick `CROSS APPLY` when the outer table is small and the per-row top-N query can use an index seek.

#### ROW_NUMBER CTE pattern

*Return the top-2 volume days for each of three SAP.DE/AIR.PA/AD.AS symbols using `ROW_NUMBER` in a CTE.*

```sql
;WITH ranked AS (
    SELECT
        symbol,
        [date],
        volume,
        ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY volume DESC) AS rn
    FROM silver.eurostoxx50_ohlcv
    WHERE symbol IN ('SAP.DE','AIR.PA','AD.AS')
)
SELECT symbol, [date], volume
FROM ranked
WHERE rn <= 2
ORDER BY symbol, rn;
```

| symbol | date | volume |
|---|---|---|
| AD.AS | 2021-05-27 | 11080485 |
| AD.AS | 2021-03-19 | 10565045 |
| AIR.PA | 2024-06-25 | 8026551 |
| AIR.PA | 2021-11-26 | 6274958 |
| SAP.DE | 2026-01-29 | 15846791 |
| SAP.DE | 2026-03-20 | 9373510 |

The CTE materializes `rn` for every row, and the outer query filters on `rn <= 2`. The plan is a single scan of the filtered partition with a Sort for the `ORDER BY volume DESC` and a Sequence Project for the ranking. The query scales linearly with the number of input rows regardless of how many symbols there are.

#### CROSS APPLY alternative

*Same result using `CROSS APPLY (SELECT TOP (2) ...)` against a three-row driver set.*

```sql
SELECT TOP (6)
    d.symbol,
    t.[date],
    t.volume
FROM (SELECT DISTINCT symbol FROM silver.eurostoxx50_ohlcv WHERE symbol IN ('SAP.DE','AIR.PA','AD.AS')) AS d
CROSS APPLY (
    SELECT TOP (2) [date], volume
    FROM silver.eurostoxx50_ohlcv AS o
    WHERE o.symbol = d.symbol
    ORDER BY volume DESC
) AS t
ORDER BY d.symbol, t.volume DESC;
```

| symbol | date | volume |
|---|---|---|
| AD.AS | 2021-05-27 | 11080485 |
| AD.AS | 2021-03-19 | 10565045 |
| AIR.PA | 2024-06-25 | 8026551 |
| AIR.PA | 2021-11-26 | 6274958 |
| SAP.DE | 2026-01-29 | 15846791 |
| SAP.DE | 2026-03-20 | 9373510 |

Same output, different plan shape. The `CROSS APPLY` version runs the inner `SELECT TOP (2)` once per driver row, so its cost is `O(drivers × cost_of_top_2)`. It wins when there is a covering index on `(symbol, volume DESC)` because each inner call is a 2-row index seek. It loses when the driver set is large and the inner cost dominates. See [[03-joins-subqueries-and-apply#CROSS APPLY for per-row top-N]] for the full discussion.

#### Top-1 per sector

*Join `silver.eurostoxx50_ohlcv` to `silver.index_dim` to compute the highest-volume symbol per sector on 2026-04-07.*

```sql
;WITH joined AS (
    SELECT
        d.sector,
        o.symbol,
        o.[date],
        o.volume
    FROM silver.eurostoxx50_ohlcv AS o
    INNER JOIN silver.index_dim AS d
        ON o.symbol = d.symbol AND d.is_current = 1
    WHERE o.[date] = '2026-04-07'
),
ranked AS (
    SELECT
        sector, symbol, volume,
        ROW_NUMBER() OVER (PARTITION BY sector ORDER BY volume DESC) AS rn
    FROM joined
)
SELECT TOP (6) sector, symbol, volume
FROM ranked
WHERE rn <= 1
ORDER BY volume DESC;
```

| sector | symbol | volume |
|---|---|---|
| Financial Services | ISP.MI | 67508558 |
| Utilities | ENEL.MI | 19323923 |
| Energy | ENI.MI | 13355374 |
| Communication Services | DTE.DE | 6188423 |
| Technology | IFX.DE | 4436118 |
| Consumer Cyclical | MBG.DE | 4185707 |

The join fans the fact table out with its sector dimension; the `PARTITION BY sector ORDER BY volume DESC` then picks the heaviest-volume symbol in each sector for that day. Intesa Sanpaolo (`ISP.MI`) led Financial Services on 2026-04-07 with 67 million shares, more than ten times the sector's Technology leader (`IFX.DE`). This shape generalizes to any "pick one row per category based on an ordering metric" question — simply change the `PARTITION BY` column and the `ORDER BY` expression.

### Running drawdown from peak

*Drawdown is the percentage decline from the highest close seen so far. Compute it with `MAX OVER` on an expanding frame.*

```sql
SELECT TOP (5)
    symbol,
    [date],
    [close],
    MAX([close]) OVER (
        PARTITION BY symbol
        ORDER BY [date]
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_peak,
    CAST( ([close] - MAX([close]) OVER (
            PARTITION BY symbol
            ORDER BY [date]
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW))
          / NULLIF(MAX([close]) OVER (
            PARTITION BY symbol
            ORDER BY [date]
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW), 0)
          AS decimal(10,6)) AS drawdown
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'SAP.DE'
  AND [date] >= '2026-04-01'
ORDER BY [date];
```

| symbol | date | close | running_peak | drawdown |
|---|---|---|---|---|
| SAP.DE | 2026-04-01 | 148.86 | 148.86 | 0.000000 |
| SAP.DE | 2026-04-02 | 148.9 | 148.9 | 0.000000 |
| SAP.DE | 2026-04-07 | 145.22 | 148.9 | -0.024715 |

`running_peak` tracks the highest close seen up to and including the current row. `drawdown` is the fractional decline from the peak: `(close - peak) / peak`. A value of `0` means the current row is at the peak; `-0.024715` means the current close is about 2.47% below the running peak. In a longer window, the drawdown column would go negative every time the price pulls back and return to zero each time a new high is set. Drawdown computation without window functions requires a self-join on "all prior rows" — quadratic in the number of rows.

### Gaps and islands

Given a sequence of rows with a yes/no flag (is the market up today?), find runs of consecutive rows with the same flag. The classic technique uses the difference of two `ROW_NUMBER` calls as a synthetic group key: one ranks all rows by date, the other ranks rows **within** each flag value. The difference is constant inside a streak and changes when the flag flips.

*Find SAP.DE's up-day streaks in late March and early April 2026.*

```sql
;WITH flagged AS (
    SELECT
        symbol,
        [date],
        [close],
        CASE WHEN [close] > LAG([close]) OVER (PARTITION BY symbol ORDER BY [date]) THEN 1 ELSE 0 END AS is_up
    FROM silver.eurostoxx50_ohlcv
    WHERE symbol = 'SAP.DE'
      AND [date] BETWEEN '2026-03-15' AND '2026-04-07'
),
streaks AS (
    SELECT
        symbol,
        [date],
        is_up,
        ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY [date])
          - ROW_NUMBER() OVER (PARTITION BY symbol, is_up ORDER BY [date]) AS grp
    FROM flagged
)
SELECT TOP (5)
    symbol,
    MIN([date]) AS streak_start,
    MAX([date]) AS streak_end,
    COUNT(*)    AS streak_len,
    is_up
FROM streaks
WHERE is_up = 1
GROUP BY symbol, grp, is_up
ORDER BY streak_len DESC, streak_start;
```

| symbol | streak_start | streak_end | streak_len | is_up |
|---|---|---|---|---|
| SAP.DE | 2026-04-01 | 2026-04-02 | 2 | 1 |
| SAP.DE | 2026-03-17 | 2026-03-17 | 1 | 1 |
| SAP.DE | 2026-03-23 | 2026-03-23 | 1 | 1 |
| SAP.DE | 2026-03-30 | 2026-03-30 | 1 | 1 |

The longest up-streak in the window is 2 trading days (April 1–2). The rest of the positive days are isolated single-day bumps. The `grp` column — the difference of the two `ROW_NUMBER` calls — is the group key that makes rows in the same streak share a value, enabling the final `GROUP BY grp, is_up`. This is the canonical gaps-and-islands technique and generalizes to any kind of run-length compression over an ordered column.

### Deduplication (latest row per key)

*Keep only the most recent `signal_date` row per symbol in the daily valuation signals table.*

```sql
;WITH ranked AS (
    SELECT
        symbol,
        signal_date,
        forward_pe,
        price_to_book,
        ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY signal_date DESC) AS rn
    FROM silver.signals_daily
    WHERE _index = 'euro_stoxx_50'
)
SELECT TOP (5) symbol, signal_date,
       CAST(forward_pe AS decimal(10,4)) AS forward_pe,
       CAST(price_to_book AS decimal(10,4)) AS price_to_book
FROM ranked
WHERE rn = 1
ORDER BY symbol;
```

| symbol | signal_date | forward_pe | price_to_book |
|---|---|---|---|
| ABI.BR | 2026-04-08 | 14.6873 | 1.5961 |
| AD.AS | 2026-04-08 | 14.0292 | 2.6046 |
| ADS.DE | 2026-04-08 | 11.1794 | 4.0475 |
| ADYEN.AS | 2026-04-08 | 17.6908 | 5.0371 |
| AI.PA | 2026-04-08 | 23.0646 | 4.0016 |

The same pattern as "latest row per key" under ranking functions, applied here to the valuation signals table. Every returned row is the newest `signal_date` for its symbol. The deduplication pattern replaces the `GROUP BY symbol HAVING signal_date = MAX(signal_date)` anti-pattern and its variants, which fail to break ties deterministically and fan rows out on equal-max dates.

### Sessionization

Break an event stream into sessions by detecting gaps larger than a threshold. `LAG` computes the time delta to the previous row; a `CASE` expression flags each new session with a `1` when the gap exceeds the threshold; a cumulative `SUM` over the flag turns those `1`s into a monotone session id.

*Session SAP.DE's 2026 rows into "trading sessions" separated by any gap longer than 7 calendar days. In this filtered window no such gap exists, so every row belongs to session 0.*

```sql
;WITH tagged AS (
    SELECT
        symbol,
        [date],
        [close],
        CASE
            WHEN DATEDIFF(day,
                LAG([date]) OVER (PARTITION BY symbol ORDER BY [date]),
                [date]) > 7
            THEN 1 ELSE 0
        END AS new_session
    FROM silver.eurostoxx50_ohlcv
    WHERE symbol = 'SAP.DE'
      AND [date] >= '2026-01-01'
),
sessioned AS (
    SELECT
        symbol,
        [date],
        [close],
        SUM(new_session) OVER (PARTITION BY symbol ORDER BY [date] ROWS UNBOUNDED PRECEDING) AS session_id
    FROM tagged
)
SELECT TOP (5) symbol, session_id, MIN([date]) AS session_start, MAX([date]) AS session_end, COUNT(*) AS n_days
FROM sessioned
GROUP BY symbol, session_id
ORDER BY session_id;
```

| symbol | session_id | session_start | session_end | n_days |
|---|---|---|---|---|
| SAP.DE | 0 | 2026-01-02 | 2026-04-07 | 66 |

All 66 SAP.DE rows from 2026 are compressed into a single session because no gap in the filtered trading calendar exceeds seven days. In a log-event table where the delta can be measured in minutes or seconds, the same pattern with `DATEDIFF(minute, ..., ...) > 30` splits user activity into 30-minute idle sessions. This is the canonical pattern for user-session analytics in clickstream, IoT telemetry, and transaction log compaction.

## Named Windows (SQL 2022+)

SQL Server 2022 introduced the `WINDOW` clause, which lets a query define a reusable window specification once and reference it by name in multiple `OVER` clauses. Before this feature, any query that used several window functions over the same partition and order had to repeat `(PARTITION BY symbol ORDER BY [date])` in every `OVER` — verbose, error-prone, and harder to audit.

*Define a named window `w = (PARTITION BY symbol ORDER BY [date])` and reference it from three window functions.*

```sql
SELECT TOP (5)
    symbol,
    [date],
    [close],
    ROW_NUMBER() OVER w AS rn,
    LAG([close]) OVER w AS prev_close,
    AVG([close]) OVER w AS running_avg
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'SAP.DE'
  AND [date] >= '2026-04-01'
WINDOW w AS (PARTITION BY symbol ORDER BY [date])
ORDER BY [date];
```

| symbol | date | close | rn | prev_close | running_avg |
|---|---|---|---|---|---|
| SAP.DE | 2026-04-01 | 148.86 | 1 | NULL | 148.86 |
| SAP.DE | 2026-04-02 | 148.9 | 2 | 148.86 | 148.88 |
| SAP.DE | 2026-04-07 | 145.22 | 3 | 148.9 | 147.66 |

All three window functions share the same partition and ordering through the named window `w`. The query is shorter, easier to maintain, and guarantees that all three functions see exactly the same specification — a bug-prone situation when the `PARTITION BY`/`ORDER BY` is repeated inline. Multiple named windows can be declared in the same `WINDOW` clause, and a named window can inherit from another via `WINDOW w2 AS (w ORDER BY ...)`.

> [!info] Named windows require compatibility level 160
>
> The `WINDOW` clause requires SQL Server 2022 (database engine version 16.x) and a database compatibility level of at least 160. On older instances — or on a 2022 instance with a lower compat level — the clause is a syntax error. Check with `SELECT @@VERSION` and `SELECT compatibility_level FROM sys.databases WHERE name = DB_NAME()`.

## Percentile Functions

`PERCENTILE_CONT` and `PERCENTILE_DISC` compute a percentile of a distribution. They are unusual among T-SQL window functions because they use the `WITHIN GROUP (ORDER BY ...)` clause instead of `OVER (ORDER BY ...)`, and they require an `OVER (PARTITION BY ...)` clause with **no** `ORDER BY` — the ordering goes inside `WITHIN GROUP`. They also can not be used as grouped aggregates; they are strictly window functions.

- **`PERCENTILE_CONT(p)`** — "continuous percentile" — interpolates between the two values bracketing the requested percentile. For a median on an even-sized sample, it returns the average of the two middle values.
- **`PERCENTILE_DISC(p)`** — "discrete percentile" — returns an actual value from the dataset. On an even-sized sample, it returns the lower of the two middle values.

### PERCENTILE_CONT and PERCENTILE_DISC

#### Computing medians per symbol

*Compute the median `[close]` per symbol in 2026 for three EUROSTOXX50 symbols with both the continuous and discrete variants.*

```sql
SELECT DISTINCT TOP (5)
    symbol,
    CAST(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY [close]) OVER (PARTITION BY symbol) AS decimal(18,4)) AS median_cont,
    CAST(PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY [close]) OVER (PARTITION BY symbol) AS decimal(18,4)) AS median_disc
FROM silver.eurostoxx50_ohlcv
WHERE symbol IN ('SAP.DE','AIR.PA','AD.AS')
  AND [date] >= '2026-01-01'
ORDER BY symbol;
```

| symbol | median_cont | median_disc |
|---|---|---|
| AD.AS | 39.7400 | 39.6900 |
| AIR.PA | 188.8900 | 188.2600 |
| SAP.DE | 170.5200 | 170.4800 |

For even-sized partitions the two medians differ because `PERCENTILE_CONT` interpolates between the two middle values while `PERCENTILE_DISC` picks the lower of the two. For odd-sized partitions both return the same value. Use `PERCENTILE_CONT` when the percentile must be on the continuous number line (financial metrics, latency analysis, quantile regression); use `PERCENTILE_DISC` when the percentile must be an actual observed value (picking a row to highlight, ensuring the result is reproducible to a specific sample).

> [!warning] PERCENTILE_CONT and PERCENTILE_DISC can be expensive
>
> These functions require a full sort of the partition and are often the most expensive operator in a plan that contains them. On large partitions they can dominate execution time and spill the Sort operator to tempdb.

> [!success] Use APPROX_PERCENTILE_CONT or pre-aggregate
>
> SQL Server 2022 introduced `APPROX_PERCENTILE_CONT` and `APPROX_PERCENTILE_DISC`, which trade exact answers for significant speedups via sketch-based estimation — the right choice when the partition is very large and sub-percent accuracy is acceptable. For repeated percentile computations on stable data, pre-aggregate the percentiles into a materialized table and join to it from the query path.

## Performance and Anti-Patterns

Window functions are not free. They run after `WHERE` and `GROUP BY` but before `ORDER BY` on the outer query, and they require the data to be sorted by the window specification. When the sort cannot be served by an existing index, SQL Server adds a Sort operator — which is blocking, memory-consuming, and often the hottest operator in the plan. Understanding when a window function wins over alternative patterns and when it loses to them is the difference between a clean optimization and a regression.

### Window operators and sort avoidance

The SQL Server optimizer uses two physical operators to evaluate window functions:

- **Window Aggregate** (introduced in SQL Server 2016 batch mode, available in row mode since 2019) — streams data through a single pass, highly efficient for `ROWS` frames. Used automatically on columnstore indexes and on rowstore with batch mode enabled.
- **Window Spool** — the legacy operator that buffers the current partition in a worktable (in tempdb if it exceeds 10 000 rows). Used for `RANGE` frames, non-streamable window functions, and older compatibility modes.

An index whose key matches the `PARTITION BY` columns followed by the `ORDER BY` columns eliminates the Sort that feeds the window operator, often cutting plan cost by an order of magnitude. For a query that runs `ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY [date] DESC)`, the ideal index is `INDEX ... (symbol, [date] DESC) INCLUDE (...)` where the `INCLUDE` list holds the output columns. Plan and index tuning for window-heavy workloads is covered in the execution-plan sibling note.

### Anti-patterns

These three patterns are the most common cases where legacy T-SQL reinvents a window function using older mechanisms. Each one compiles and runs — and each one is slower, harder to read, or silently wrong at the boundaries.

#### Self-join vs LAG

> [!failure] Self-join on DATEADD(day, -1, ...) is brittle and slow
>
> A query that self-joins `silver.eurostoxx50_ohlcv` to itself on `prev.[date] = DATEADD(day, -1, cur.[date])` produces a row only when *yesterday* is also a trading day. Weekends, holidays, and the first row of the partition are silently dropped. The plan scans the table twice and uses a Nested Loops or Merge Join — linear in the best case but often slower because both sides of the join read the full table.

*Self-join approach — misses the first trading day (April 1) because March 31 has a different symbol pattern in the filtered set.*

```sql
SELECT TOP (5)
    cur.symbol,
    cur.[date],
    cur.[close]  AS cur_close,
    prev.[close] AS prev_close
FROM silver.eurostoxx50_ohlcv AS cur
INNER JOIN silver.eurostoxx50_ohlcv AS prev
    ON cur.symbol = prev.symbol
   AND prev.[date] = DATEADD(day, -1, cur.[date])
WHERE cur.symbol = 'SAP.DE'
  AND cur.[date] >= '2026-04-01'
ORDER BY cur.[date];
```

| symbol | date | cur_close | prev_close |
|---|---|---|---|
| SAP.DE | 2026-04-01 | 148.86 | 146.9 |
| SAP.DE | 2026-04-02 | 148.9 | 148.86 |

Only two rows come back even though the `cur.[date] >= '2026-04-01'` filter should include three trading days. The April 7 row is missing because April 6 is not a trading day in this dataset (the previous trading day is April 2), so `DATEADD(day, -1, '2026-04-07') = '2026-04-06'` has no match. The INNER JOIN silently drops the row.

> [!success] Replace the self-join with LAG
>
> `LAG([close]) OVER (PARTITION BY symbol ORDER BY [date])` returns the previous row's value according to the ordered partition, regardless of calendar gaps. It never drops rows, it reads the table once, and it is a single line of code. See [[#Day-over-day return pattern]].

#### Correlated subquery vs MAX OVER

> [!failure] Correlated scalar subquery runs once per row
>
> A pattern like `(SELECT MAX(b.[close]) FROM silver.eurostoxx50_ohlcv AS b WHERE b.symbol = a.symbol)` is evaluated once per outer row. On a 67 000-row table, that is 67 000 index seeks. The optimizer can sometimes hoist the subquery into a single aggregate, but not always — and the shape of the query hides the cost from the reader.

*Correlated subquery to attach the per-symbol max close to every row.*

```sql
SELECT TOP (5)
    a.symbol,
    a.[date],
    a.[close],
    (SELECT MAX(b.[close]) FROM silver.eurostoxx50_ohlcv AS b WHERE b.symbol = a.symbol) AS max_close
FROM silver.eurostoxx50_ohlcv AS a
WHERE a.symbol = 'SAP.DE'
  AND a.[date] >= '2026-04-01'
ORDER BY a.[date];
```

| symbol | date | close | max_close |
|---|---|---|---|
| SAP.DE | 2026-04-01 | 148.86 | 280.3 |
| SAP.DE | 2026-04-02 | 148.9 | 280.3 |
| SAP.DE | 2026-04-07 | 145.22 | 280.3 |

The query returns the correct max (`280.3`) but repeats the subquery lookup on every outer row. On a multi-symbol version of the same query the plan would show one inner scan per distinct symbol.

> [!success] Replace the correlated subquery with MAX OVER
>
> `MAX([close]) OVER (PARTITION BY symbol)` reads the table once, computes all per-symbol maxima in a single window-aggregate pass, and broadcasts them to every row. It is always at least as fast as the correlated subquery and usually much faster on large partitions.

#### DISTINCT + GROUP BY when ROW_NUMBER was meant

> [!failure] Stacked DISTINCT and GROUP BY is not deduplication
>
> Queries that attempt "one row per symbol" with `SELECT DISTINCT symbol, max_date, ... FROM ... GROUP BY symbol HAVING ... = MAX(...)` often fan out on ties and are difficult to make deterministic. The intent is always a per-key ranking, but the shape hides it — a reader cannot tell which row survives the dedup.

> [!success] Use ROW_NUMBER with a unique tiebreaker
>
> Express deduplication as `ROW_NUMBER() OVER (PARTITION BY key ORDER BY rank_column DESC, unique_tiebreaker DESC)` in a CTE, then filter `WHERE rn = 1` in the outer query. The `ORDER BY` makes the survivorship rule explicit, the tiebreaker makes the choice deterministic, and a reader can trace exactly which row will be kept. See [[#Deduplication (latest row per key)]].

## Practical Guidance

The table below maps common analytical questions to the right window function. When multiple functions would work, pick the one with the shortest `OVER` clause and the cheapest frame.

| Question | Function | Frame |
|---|---|---|
| Latest row per key | `ROW_NUMBER() ... ORDER BY t DESC` then `WHERE rn = 1` | (no frame) |
| N-th highest per key | `ROW_NUMBER() ... ORDER BY metric DESC` then `WHERE rn = N` | (no frame) |
| Rank with ties | `RANK()` or `DENSE_RANK()` | (no frame) |
| Equal-count segmentation | `NTILE(n)` | (no frame) |
| Relative position (0..1) | `PERCENT_RANK()` or `CUME_DIST()` | (no frame) |
| Previous / next row value | `LAG(col)` / `LEAD(col)` | (no frame) |
| First / last value of partition | `FIRST_VALUE` / `LAST_VALUE` | `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING` |
| Running total | `SUM(col)` | `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` |
| Moving average of last N | `AVG(col)` | `ROWS BETWEEN (N-1) PRECEDING AND CURRENT ROW` |
| Rolling min / max / stdev | `MIN` / `MAX` / `STDEV` | `ROWS BETWEEN (N-1) PRECEDING AND CURRENT ROW` |
| Running peak / drawdown | `MAX(col)` | `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` |
| Whole-partition average as context | `AVG(col)` | (no ORDER BY, so implicit whole partition) |
| Median per partition | `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY col)` | `OVER (PARTITION BY key)` |

### When not to use window functions

Window functions are almost always the right answer — but not always.

- **One row per group is the final goal.** If the query truly needs one row per group and never refers to individual rows, use `GROUP BY` directly. A `ROW_NUMBER` CTE that keeps only `rn = 1` is fine, but stacking window functions on top of an already-grouped intermediate is wasted work.
- **The frame is the entire partition and the value is needed only once per partition.** Use `GROUP BY` with a join back to the detail table if the join is cheap, or compute the aggregate in a subquery referenced once per row.
- **The window function drives an index choice on a very large table and no supporting index exists.** A Sort operator on 10^9 rows is catastrophic. Either add the index or rewrite to a plan shape that avoids the sort — a loop over partitions, a batched procedure, or a columnstore table.
- **The peer-grouping semantics of `RANGE` are specifically wanted and cannot be expressed otherwise.** This is a genuine use case for `RANGE`; resist the reflex to rewrite it as `ROWS`.

### Related notes

- [[02-data-types-conversion-and-null-handling]] — `float` vs `decimal` for prices, `NULL` propagation through window aggregates, `NULLIF` for divide-by-zero guards.
- [[03-joins-subqueries-and-apply]] — `CROSS APPLY TOP (N)` as the alternative top-N-per-group shape, anti-joins and semi-joins that window functions often replace.
- [[04-common-table-expressions-and-temporary-objects]] — recursive CTEs and `WITH` chaining patterns that commonly wrap window-function queries.
