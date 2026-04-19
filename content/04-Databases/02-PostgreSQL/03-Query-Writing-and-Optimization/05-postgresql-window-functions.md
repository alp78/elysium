---
title: "05 - Window Functions"
tags:
  - postgresql
  - query-optimization
  - sql
aliases:
  - PostgreSQL OVER clause
  - PostgreSQL ranking functions
  - PostgreSQL lag lead
  - PostgreSQL window frames
description: "PostgreSQL reference for the OVER clause, partitioned analytics, ranking functions, LAG and LEAD, frame-sensitive value functions, running and moving aggregates, named windows, and percentile-style analytics."
parent: "[[domain-postgresql-query-writing-and-optimization]]"
links:
  - "[[04-postgresql-common-table-expressions-and-temporary-objects]]"
  - "[[06-postgresql-numeric-and-aggregate-functions]]"
status: complete
---

# Window Functions

Window functions are PostgreSQL's row-preserving analytics surface. They let a query rank rows, compare each row to prior or later rows, and compute running or partition-wide aggregates without collapsing the underlying detail rows. The `OVER` clause is what makes that possible: it defines the partition, ordering, and optional frame that each function can see.

> [!abstract] Scope
>
> This note mirrors the SQL Server window-function track with PostgreSQL semantics. It covers the `OVER` clause, ranking functions, offset and value functions, frame-sensitive aggregate windows, the named `WINDOW` clause, and percentile-style analytics.
>
> - **Window fundamentals** show how `PARTITION BY` differs from `GROUP BY` and why window functions annotate rows instead of collapsing them.
> - **Ranking functions** cover `ROW_NUMBER`, `RANK`, and `DENSE_RANK` for deterministic selection and tie handling.
> - **Offset and value functions** cover `LAG`, `LEAD`, and the `LAST_VALUE` frame trap.
> - **Aggregate windows** cover running and moving calculations with explicit `ROWS` frames.
> - **Named windows and percentiles** cover reusable window specifications and PostgreSQL's `percentile_cont` ordered-set aggregate.

## Window Function Fundamentals

The defining property of a window function is that every input row survives. A plain aggregate with `GROUP BY` produces one row per group. A window function computes across a logical neighborhood of rows and returns one value per input row.

### `OVER`, `PARTITION BY`, and row preservation

Window functions turn aggregates and ranking operators into per-row annotations. The `PARTITION BY` clause controls where calculations reset, and the `ORDER BY` clause controls row sequence for ranking, offsets, and running frames.

#### Use `PARTITION BY` when every detail row must stay visible

Use this pattern when a report needs row-level detail plus group-level context in the same result. It is typically triggered by rankings, scorecards, and row-by-row diagnostics. The query is read-only. Its purpose is to show that a window aggregate broadcasts a partition-level value back onto every row instead of reducing the result set.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | `gold.scores_daily.symbol` | varchar | Symbol row that remains visible in the result. |
| `score_date` | `gold.scores_daily.score_date` | date | Current score date of the row. |
| `composite_score` | `gold.scores_daily.composite_score` | numeric | Current row's score value. |
| `avg_score_per_index` | `AVG(composite_score) OVER (PARTITION BY _index)` | numeric | Average score across the entire selected index partition. |

*This query keeps the latest USA score rows visible while attaching the partition-wide average score to each row.*

```sql
SELECT
    symbol,
    score_date,
    ROUND(composite_score::numeric, 4) AS composite_score,
    ROUND(AVG(composite_score) OVER (PARTITION BY _index)::numeric, 4) AS avg_score_per_index
FROM gold.scores_daily
WHERE score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
  AND _index = 'stoxx_usa_50'
ORDER BY composite_score DESC NULLS LAST
LIMIT 5;
```

| symbol | score_date | composite_score | avg_score_per_index |
|---|---|---:|---:|
| MU | 2026-04-08 | 1.3617 | 0.0091 |
| AMD | 2026-04-08 | 0.5408 | 0.0091 |
| AVGO | 2026-04-08 | 0.5251 | 0.0091 |
| AMZN | 2026-04-08 | 0.4947 | 0.0091 |
| NVDA | 2026-04-08 | 0.4905 | 0.0091 |

Five detail rows remained five output rows. The index-wide average is attached to each row as context, which is exactly what a window function is for.

#### Contrast `PARTITION BY` with `GROUP BY`

Use this comparison when a query author needs to decide whether the result should keep detail rows or reduce to one row per group. It is typically triggered during refactors from self-join aggregates to window logic. The query is read-only. Its purpose is to show the row-collapse boundary explicitly.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `_index` | `gold.scores_daily._index` | varchar | Grouping key of the aggregate result. |
| `avg_score_per_index` | `AVG(composite_score)` | numeric | Average score of the grouped result. |
| `row_count` | `COUNT(*)` | bigint | Number of rows collapsed into the grouped output row. |

*This grouped query returns one row for the whole USA scoring slice instead of preserving the 50 symbol rows.*

```sql
SELECT
    _index,
    ROUND(AVG(composite_score)::numeric, 4) AS avg_score_per_index,
    COUNT(*) AS row_count
FROM gold.scores_daily
WHERE score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
  AND _index = 'stoxx_usa_50'
GROUP BY _index;
```

| _index | avg_score_per_index | row_count |
|---|---:|---:|
| stoxx_usa_50 | 0.0091 | 50 |

The average is the same number as in the windowed query, but the result shape is completely different. `GROUP BY` keeps one row for the group. The windowed version keeps one row per symbol.

## Ranking and Positional Functions

Ranking functions assign row positions inside each partition. They depend entirely on the `ORDER BY` inside `OVER`, so tie-breakers must be deliberate whenever the chosen winner matters.

### Deterministic selection and tie handling

`ROW_NUMBER` forces one unique winner per ordered partition. `RANK` and `DENSE_RANK` preserve ties but number them differently.

#### Use `ROW_NUMBER` for top-N-per-group and deduplication

Use `ROW_NUMBER` when the query must choose exactly one winning row or the first N rows inside each partition. It is typically triggered by latest-row selection, deduplication, and top-per-group reporting. The query is read-only. Its purpose is to show the standard PostgreSQL ranking pattern for one row per sector.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | `gold.scores_daily.symbol` | varchar | Winning symbol returned for the sector partition. |
| `sector` | `gold.scores_daily.sector` | varchar | Partition key that resets the row numbering. |
| `composite_score` | `gold.scores_daily.composite_score` | numeric | Score that drives the ordering inside the sector. |
| `rn` | `ROW_NUMBER() OVER (...)` | bigint | Unique position within each sector partition. |

*This query ranks the latest USA score rows within each sector and keeps only the first row from each partition.*

```sql
WITH ranked AS (
    SELECT
        symbol,
        sector,
        ROUND(composite_score::numeric, 4) AS composite_score,
        ROW_NUMBER() OVER (
            PARTITION BY sector
            ORDER BY composite_score DESC NULLS LAST, symbol
        ) AS rn
    FROM gold.scores_daily
    WHERE score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
      AND _index = 'stoxx_usa_50'
)
SELECT
    symbol,
    sector,
    composite_score,
    rn
FROM ranked
WHERE rn = 1
ORDER BY sector;
```

| symbol | sector | composite_score | rn |
|---|---|---:|---:|
| LIN | Basic Materials | 0.0372 | 1 |
| GOOGL | Communication Services | 0.1797 | 1 |
| AMZN | Consumer Cyclical | 0.4947 | 1 |
| PM | Consumer Defensive | 0.2359 | 1 |
| CVX | Energy | 0.1630 | 1 |
| BAC | Financial Services | 0.4082 | 1 |
| MRK | Healthcare | 0.3329 | 1 |
| RTX | Industrials | 0.2106 | 1 |
| MU | Technology | 1.3617 | 1 |

The extra `symbol` tie-breaker is what makes the selection deterministic if two rows share the same score. Without it, the winning row inside a tie could vary.

#### Distinguish `ROW_NUMBER`, `RANK`, and `DENSE_RANK` when ties matter

Use this comparison when tied values are part of the business meaning and the query author needs to decide whether later ranks should skip numbers or stay contiguous. It is typically triggered by leaderboards, percentiles, and audit queries that must explain tie handling clearly. The query is read-only. Its purpose is to show the exact numbering differences on a compact tied dataset.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | inline sample rowset | text | Label of the sample row. |
| `composite_score` | inline sample rowset | numeric | Score used for ordering and tie formation. |
| `row_number` | `ROW_NUMBER() OVER (...)` | bigint | Unique sequential numbering. |
| `rank_value` | `RANK() OVER (...)` | bigint | Tie-preserving rank with gaps after ties. |
| `dense_rank_value` | `DENSE_RANK() OVER (...)` | bigint | Tie-preserving rank without gaps. |

*This query shows how the three ranking functions number the same tied score set differently.*

```sql
WITH sample(symbol, composite_score) AS (
    VALUES
        ('alpha', 0.90::numeric),
        ('bravo', 0.90::numeric),
        ('charlie', 0.75::numeric),
        ('delta', 0.60::numeric)
)
SELECT
    symbol,
    composite_score,
    ROW_NUMBER() OVER (ORDER BY composite_score DESC, symbol) AS row_number,
    RANK() OVER (ORDER BY composite_score DESC) AS rank_value,
    DENSE_RANK() OVER (ORDER BY composite_score DESC) AS dense_rank_value
FROM sample
ORDER BY composite_score DESC, symbol;
```

| symbol | composite_score | row_number | rank_value | dense_rank_value |
|---|---:|---:|---:|---:|
| alpha | 0.90 | 1 | 1 | 1 |
| bravo | 0.90 | 2 | 1 | 1 |
| charlie | 0.75 | 3 | 3 | 2 |
| delta | 0.60 | 4 | 4 | 3 |

The tie between `alpha` and `bravo` is what reveals the difference. `RANK` leaves a gap after the tie group. `DENSE_RANK` does not. `ROW_NUMBER` ignores tie semantics and simply assigns unique positions.

## Offset and Frame-Sensitive Value Functions

Offset functions compare a row to earlier or later rows in the ordered partition. Value functions such as `LAST_VALUE` are especially sensitive to frame definitions, which is why explicit frames are safer than defaults.

### Previous-row, next-row, and last-row semantics

These functions are usually simpler and clearer than self joins, but only if the ordering inside the window specification is complete and deliberate.

#### Use `LAG` and `LEAD` for prior-row and next-row comparisons

Use this pattern when each row must see the previous or next row in the same ordered series. It is typically triggered by day-over-day change, state-transition, and gap analysis. The query is read-only. Its purpose is to show the standard PostgreSQL alternative to self-join look-back logic.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `perf_date` | `gold.index_performance.perf_date` | date | Ordered date axis of the return series. |
| `daily_return` | `gold.index_performance.daily_return` | numeric | Return on the current row. |
| `prev_return` | `LAG(daily_return)` | numeric | Return from the prior ordered row in the same partition. |
| `next_return` | `LEAD(daily_return)` | numeric | Return from the next ordered row in the same partition. |

*This query looks backward and forward across the recent STOXX USA 50 return series.*

```sql
SELECT
    perf_date,
    ROUND(daily_return::numeric, 6) AS daily_return,
    ROUND(LAG(daily_return) OVER (ORDER BY perf_date)::numeric, 6) AS prev_return,
    ROUND(LEAD(daily_return) OVER (ORDER BY perf_date)::numeric, 6) AS next_return
FROM gold.index_performance
WHERE _index = 'stoxx_usa_50'
  AND perf_date BETWEEN DATE '2026-04-01' AND DATE '2026-04-07'
ORDER BY perf_date;
```

| perf_date | daily_return | prev_return | next_return |
|---|---:|---:|---:|
| 2026-04-01 | 0.006127 |  | 0.000955 |
| 2026-04-02 | 0.000955 | 0.006127 | 0.004856 |
| 2026-04-06 | 0.004856 | 0.000955 | 0.000962 |
| 2026-04-07 | 0.000962 | 0.004856 |  |

The first row has no predecessor and the last row has no successor, so PostgreSQL returns `NULL` for those offsets. That nullability is normal and should be handled explicitly when downstream calculations depend on a default value.

#### `LAST_VALUE` needs an explicit whole-partition frame

Use this pattern when a query needs the true final value in the partition, not merely the last value visible inside the default running frame. It is typically triggered by end-of-period baselines, drawdown reference points, and comparisons against the final row. The query is read-only. Its purpose is to make the default-frame trap visible with real output.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `perf_date` | `gold.index_performance.perf_date` | date | Ordered row within the partition. |
| `daily_return` | `gold.index_performance.daily_return` | numeric | Current row's return value. |
| `last_value_default_frame` | `LAST_VALUE(...) OVER (ORDER BY perf_date)` | numeric | Last value in the default running frame, which ends at the current row. |
| `last_value_full_partition` | `LAST_VALUE(...) OVER (... ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)` | numeric | True last value of the full partition. |

*This query contrasts PostgreSQL's default `LAST_VALUE` frame with an explicit whole-partition frame.*

```sql
SELECT
    perf_date,
    ROUND(daily_return::numeric, 6) AS daily_return,
    ROUND(LAST_VALUE(daily_return) OVER (
        ORDER BY perf_date
    )::numeric, 6) AS last_value_default_frame,
    ROUND(LAST_VALUE(daily_return) OVER (
        ORDER BY perf_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    )::numeric, 6) AS last_value_full_partition
FROM gold.index_performance
WHERE _index = 'stoxx_usa_50'
  AND perf_date BETWEEN DATE '2026-04-01' AND DATE '2026-04-07'
ORDER BY perf_date;
```

| perf_date | daily_return | last_value_default_frame | last_value_full_partition |
|---|---:|---:|---:|
| 2026-04-01 | 0.006127 | 0.006127 | 0.000962 |
| 2026-04-02 | 0.000955 | 0.000955 | 0.000962 |
| 2026-04-06 | 0.004856 | 0.004856 | 0.000962 |
| 2026-04-07 | 0.000962 | 0.000962 | 0.000962 |

The default frame ends at the current row, so the "last" value is often just the current row itself. When the business meaning is "final value in the partition," the frame must be widened explicitly.

## Aggregate Windows and Frames

Windowed aggregates become running, moving, or whole-partition calculations depending on their frame. In PostgreSQL, explicit `ROWS` frames are the safest default when row-by-row movement matters.

### Running and moving calculations

The difference between a running total and a moving average is not the aggregate function. It is the frame definition.

#### Use an explicit `ROWS` frame for running aggregates

Use this pattern when the calculation should accumulate from the start of the partition up to the current row. It is typically triggered by running totals, cumulative returns, and running maxima or minima. The query is read-only. Its purpose is to show the canonical running-frame pattern.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `perf_date` | `gold.index_performance.perf_date` | date | Ordered row inside the return series. |
| `daily_return` | `gold.index_performance.daily_return` | numeric | Current return contribution. |
| `running_return_sum` | `SUM(daily_return) OVER (ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)` | numeric | Cumulative sum up to the current row. |

*This query computes a running sum of recent STOXX USA 50 daily returns.*

```sql
SELECT
    perf_date,
    ROUND(daily_return::numeric, 6) AS daily_return,
    ROUND(SUM(daily_return) OVER (
        ORDER BY perf_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )::numeric, 6) AS running_return_sum
FROM gold.index_performance
WHERE _index = 'stoxx_usa_50'
  AND perf_date BETWEEN DATE '2026-04-01' AND DATE '2026-04-07'
ORDER BY perf_date;
```

| perf_date | daily_return | running_return_sum |
|---|---:|---:|
| 2026-04-01 | 0.006127 | 0.006127 |
| 2026-04-02 | 0.000955 | 0.007082 |
| 2026-04-06 | 0.004856 | 0.011938 |
| 2026-04-07 | 0.000962 | 0.012899 |

Because the frame grows row by row, the cumulative sum never decreases in row coverage even though the input values themselves vary.

#### Shrink the frame for moving calculations

Use a bounded frame when each row should see only a fixed-size neighborhood instead of the full partition prefix. It is typically triggered by moving averages, rolling volatility, and short-horizon smoothing. The query is read-only. Its purpose is to show that a moving metric is a frame choice, not a different function family.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `perf_date` | `gold.index_performance.perf_date` | date | Ordered row inside the time series. |
| `daily_return` | `gold.index_performance.daily_return` | numeric | Current return on the row. |
| `two_row_moving_avg` | `AVG(daily_return) OVER (ROWS BETWEEN 1 PRECEDING AND CURRENT ROW)` | numeric | Average over the current row and the immediately preceding row. |

*This query computes a two-row moving average across the recent return series.*

```sql
SELECT
    perf_date,
    ROUND(daily_return::numeric, 6) AS daily_return,
    ROUND(AVG(daily_return) OVER (
        ORDER BY perf_date
        ROWS BETWEEN 1 PRECEDING AND CURRENT ROW
    )::numeric, 6) AS two_row_moving_avg
FROM gold.index_performance
WHERE _index = 'stoxx_usa_50'
  AND perf_date BETWEEN DATE '2026-04-01' AND DATE '2026-04-07'
ORDER BY perf_date;
```

| perf_date | daily_return | two_row_moving_avg |
|---|---:|---:|
| 2026-04-01 | 0.006127 | 0.006127 |
| 2026-04-02 | 0.000955 | 0.003541 |
| 2026-04-06 | 0.004856 | 0.002905 |
| 2026-04-07 | 0.000962 | 0.002909 |

The first row only has one visible row in its frame, so the moving average equals the current value. Every later row averages the current return with the immediately previous return.

## Named Windows and Percentile Analytics

PostgreSQL supports the `WINDOW` clause, which lets a query define reusable window specifications once and reference them from multiple functions. PostgreSQL also provides ordered-set aggregates such as `percentile_cont`, but unlike some SQL Server examples they are usually written as grouped aggregates rather than as window functions.

### Reuse the window specification, then compute distribution cut points

This section covers two adjacent ideas: keeping window definitions aligned with a named window, and computing medians or other percentiles with ordered-set aggregates.

#### Reuse a named window specification across multiple functions

Use a named window when several functions share the same partition or ordering and the query would otherwise repeat the specification several times. It is typically triggered by report-style queries that rank and summarize the same partition together. The query is read-only. Its purpose is to show PostgreSQL's reusable `WINDOW` syntax.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | `gold.scores_daily.symbol` | varchar | Symbol row in the latest USA scoring slice. |
| `sector` | `gold.scores_daily.sector` | varchar | Sector partition reused by both named windows. |
| `composite_score` | `gold.scores_daily.composite_score` | numeric | Score used both for ordering and for sector average calculation. |
| `sector_row_number` | `ROW_NUMBER() OVER w` | bigint | Position of the row inside the ordered sector partition. |
| `sector_avg_score` | `AVG(composite_score) OVER w_all` | numeric | Average score of the full sector partition. |

*This query reuses named window specifications so ranking and averaging stay aligned by sector.*

```sql
SELECT
    symbol,
    sector,
    ROUND(composite_score::numeric, 4) AS composite_score,
    ROW_NUMBER() OVER w AS sector_row_number,
    ROUND(AVG(composite_score) OVER w_all::numeric, 4) AS sector_avg_score
FROM gold.scores_daily
WHERE score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
  AND _index = 'stoxx_usa_50'
WINDOW
    w AS (PARTITION BY sector ORDER BY composite_score DESC NULLS LAST, symbol),
    w_all AS (PARTITION BY sector)
ORDER BY sector, sector_row_number
LIMIT 8;
```

| symbol | sector | composite_score | sector_row_number | sector_avg_score |
|---|---|---:|---:|---:|
| LIN | Basic Materials | 0.0372 | 1 | 0.0372 |
| GOOGL | Communication Services | 0.1797 | 1 | 0.0086 |
| META | Communication Services | 0.1584 | 2 | 0.0086 |
| VZ | Communication Services | 0.0945 | 3 | 0.0086 |
| TMUS | Communication Services | 0.0610 | 4 | 0.0086 |
| NFLX | Communication Services | -0.4505 | 5 | 0.0086 |
| AMZN | Consumer Cyclical | 0.4947 | 1 | -0.2134 |
| MCD | Consumer Cyclical | -0.1666 | 2 | -0.2134 |

The `WINDOW` clause does not materialize anything. It simply keeps repeated partition definitions consistent and easier to review.

#### Use `percentile_cont` for median-style distribution cuts

Use this pattern when the business question is about distribution cut points rather than row numbering. It is typically triggered by medians, percentile thresholds, and score-distribution summaries. The query is read-only. Its purpose is to show PostgreSQL's ordered-set aggregate form of percentile analytics.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `sector` | `gold.scores_daily.sector` | varchar | Sector group for the percentile calculation. |
| `median_score` | `percentile_cont(0.5) WITHIN GROUP (ORDER BY composite_score)` | numeric | Continuous median of sector composite scores. |
| `sector_rows` | `COUNT(*)` | bigint | Number of rows contributing to the median. |

*This query computes sector medians for the latest USA score slice by using PostgreSQL's ordered-set aggregate syntax.*

```sql
SELECT
    sector,
    ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY composite_score)::numeric, 4) AS median_score,
    COUNT(*) AS sector_rows
FROM gold.scores_daily
WHERE score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
  AND _index = 'stoxx_usa_50'
  AND composite_score IS NOT NULL
GROUP BY sector
HAVING COUNT(*) >= 3
ORDER BY median_score DESC, sector
LIMIT 6;
```

| sector | median_score | sector_rows |
|---|---:|---:|
| Technology | 0.2698 | 15 |
| Communication Services | 0.0945 | 5 |
| Industrials | 0.0058 | 3 |
| Healthcare | -0.1155 | 5 |
| Financial Services | -0.1170 | 9 |
| Consumer Defensive | -0.1478 | 6 |

`percentile_cont` can interpolate between row values, so the returned median is a distribution statistic, not necessarily one of the original input values. In PostgreSQL this belongs with analytical SQL, even though the syntax is an ordered-set aggregate instead of an `OVER`-driven window function.

## Practical Rules

Use window functions when the result must keep the detail row and attach analytical context to it. Switch back to `GROUP BY` when one row per group is the real target.

| Need | PostgreSQL pattern | Why |
|---|---|---|
| Keep detail rows plus group context | Window aggregate with `OVER` | Preserves one output row per input row. |
| Pick one winning row per partition | `ROW_NUMBER()` with a deterministic tie-breaker | Makes survivorship explicit. |
| Preserve ties in ranking | `RANK()` or `DENSE_RANK()` | Choose gap or no-gap semantics deliberately. |
| Compare to prior or next row | `LAG()` / `LEAD()` | Replaces self joins cleanly. |
| Get the true last row's value | Explicit whole-partition frame | Avoids the `LAST_VALUE` default-frame trap. |
| Running metric | `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` | Gives a row-by-row growing frame. |
| Moving metric | Bounded `ROWS` frame | Restricts visibility to a fixed neighborhood. |
| Reuse the same window specification | `WINDOW` clause | Reduces duplication and drift between functions. |
