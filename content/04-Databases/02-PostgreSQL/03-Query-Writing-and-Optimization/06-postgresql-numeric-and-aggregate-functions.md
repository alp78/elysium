---
title: "06 - Numeric and Aggregate Functions"
tags:
  - postgresql
  - query-optimization
  - sql
aliases:
  - PostgreSQL aggregates
  - PostgreSQL math functions
  - PostgreSQL grouping sets
  - PostgreSQL FILTER aggregates
description: "PostgreSQL reference for aggregate semantics, count and summary functions, statistical aggregates, conditional aggregation, ratio safety, scalar math functions, and multi-level grouping with ROLLUP and GROUPING SETS."
parent: "[[domain-postgresql-query-writing-and-optimization]]"
links:
  - "[[05-postgresql-window-functions]]"
  - "[[07-postgresql-string-functions-and-pattern-matching]]"
status: complete
---

# Numeric and Aggregate Functions

Aggregate queries are where PostgreSQL turns rowsets into measurements. The most important boundaries are not the function names themselves but the semantics around null handling, grouping grain, conditional aggregation, numeric safety, and subtotal labeling. PostgreSQL also has a few notable differences from SQL Server in this area: `count(*)` already returns `bigint`, core PostgreSQL does not include a built-in `approx_count_distinct`, and the native `FILTER` clause often expresses conditional aggregation more cleanly than `CASE`.

> [!abstract] Scope
>
> This note mirrors the SQL Server aggregate and numeric-function track with PostgreSQL equivalents. It covers aggregate semantics, count and summary functions, statistical aggregates, conditional and ratio patterns, scalar math, and multi-level grouping.
>
> - **Aggregate semantics** cover null treatment, grouped grain, and the difference between row counts and non-null counts.
> - **Summary and statistical aggregates** cover `SUM`, `AVG`, `MIN`, `MAX`, `stddev_samp`, and `stddev_pop`.
> - **Conditional and ratio patterns** cover the PostgreSQL-native `FILTER` clause and divide-by-zero protection with `NULLIF`.
> - **Scalar math** covers rounding, truncation, powers, roots, and random versus cryptographic random values.
> - **Multi-level grouping** covers `ROLLUP`, `GROUPING SETS`, and `GROUPING(...)` for subtotal labeling.

## Aggregate Semantics

Before choosing a specific function, it is critical to know what counts as an input row, what happens to `NULL`, and whether the result is supposed to preserve detail or collapse it to grouped output.

### Null treatment and count semantics

Every PostgreSQL aggregate except `count(*)` ignores null input values. That rule affects counts, averages, and every metric derived from them.

#### Aggregates ignore `NULL` unless the query counts rows explicitly

Use this baseline when teaching aggregate semantics or debugging surprising counts and averages. It is typically triggered by completeness analysis and null-sensitive metrics. The query is read-only. Its purpose is to show the universal null-handling rule in one compact result.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `count_star` | `COUNT(*)` | bigint | Counts all rows, including rows whose value is `NULL`. |
| `count_v` | `COUNT(v)` | bigint | Counts only rows where `v` is not `NULL`. |
| `sum_v` | `SUM(v)` | integer | Sum of non-null values only. |
| `avg_v` | `AVG(v)` | numeric | Mean of non-null values only. |
| `min_v` | `MIN(v)` | integer | Minimum non-null value. |
| `max_v` | `MAX(v)` | integer | Maximum non-null value. |

*This query applies the core aggregates to a five-row input that contains two nulls.*

```sql
SELECT
    COUNT(*) AS count_star,
    COUNT(v) AS count_v,
    SUM(v) AS sum_v,
    AVG(v) AS avg_v,
    MIN(v) AS min_v,
    MAX(v) AS max_v
FROM (VALUES (10), (20), (NULL), (30), (NULL)) AS t(v);
```

| count_star | count_v | sum_v | avg_v | min_v | max_v |
|---:|---:|---:|---:|---:|---:|
| 5 | 3 | 60 | 20.0000000000000000 | 10 | 30 |

The difference between `count(*)` and `count(v)` is the number of nulls in `v`. That same null-skipping rule is why `avg_v` is `60 / 3`, not `60 / 5`.

#### Measure missingness with `COUNT(*) - COUNT(column)`

Use this pattern when the query needs a completeness metric rather than a simple row count. It is typically triggered by feed audits, data-quality checks, and column-population monitoring. The query is read-only. Its purpose is to show the simplest exact missingness formula on live warehouse data.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `total_rows` | `COUNT(*)` | bigint | Total rows in the selected slice. |
| `non_null_yield_rows` | `COUNT(yield_zscore)` | bigint | Rows where `yield_zscore` is populated. |
| `null_yield_rows` | `COUNT(*) - COUNT(yield_zscore)` | bigint | Rows where `yield_zscore` is missing. |

*This query measures how many latest Euro Stoxx 50 score rows are missing `yield_zscore`.*

```sql
SELECT
    COUNT(*) AS total_rows,
    COUNT(yield_zscore) AS non_null_yield_rows,
    COUNT(*) - COUNT(yield_zscore) AS null_yield_rows
FROM gold.scores_daily
WHERE score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
  AND _index = 'euro_stoxx_50';
```

| total_rows | non_null_yield_rows | null_yield_rows |
|---:|---:|---:|
| 50 | 48 | 2 |

Two rows in the current Euro Stoxx 50 slice have no `yield_zscore`. That is an exact missingness count, not an inferred estimate.

#### `COUNT(DISTINCT ...)` answers a different question from row count

Use `COUNT(DISTINCT ...)` when the business question is about the number of unique values, not the number of rows. It is typically triggered by cardinality checks, dimensionality summaries, and coverage analysis. The query is read-only. Its purpose is to show the distinction between raw row volume and unique-value volume.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `distinct_sectors` | `COUNT(DISTINCT sector)` | bigint | Number of unique sector values in the selected slice. |
| `total_rows` | `COUNT(*)` | bigint | Total rows in the selected slice. |

*This query counts how many distinct sectors appear in the latest USA scoring slice.*

```sql
SELECT
    COUNT(DISTINCT sector) AS distinct_sectors,
    COUNT(*) AS total_rows
FROM gold.scores_daily
WHERE score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
  AND _index = 'stoxx_usa_50';
```

| distinct_sectors | total_rows |
|---:|---:|
| 9 | 50 |

There are 50 rows in the slice but only 9 distinct sector values. PostgreSQL computes this exactly in core SQL. If an approximate distinct count is required for very large-scale telemetry, that is typically an extension decision rather than a built-in function choice.

## Summary and Statistical Aggregates

Once the grouping grain is correct, summary functions turn the rowset into totals, means, extrema, and variation measures. In PostgreSQL, these are ordinary aggregates with well-defined return types and null-skipping semantics.

### `SUM`, `AVG`, `MIN`, `MAX`, and the standard-deviation family

These functions answer straightforward measurement questions, but they still need correct types and correct grain.

#### Summarize one live price slice with totals, extrema, and volatility

Use this pattern when the workload needs a compact statistical summary over a bounded slice. It is typically triggered by QA checks, exploratory analysis, and notebook or ETL validation. The query is read-only. Its purpose is to show the core summary functions together on a real trading slice.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `sum_volume` | `SUM(volume)` | numeric | Total traded volume across the slice. |
| `avg_close` | `AVG(close)` | numeric | Mean close price across the slice. |
| `min_close` | `MIN(close)` | numeric | Lowest close in the slice. |
| `max_close` | `MAX(close)` | numeric | Highest close in the slice. |
| `stddev_samp_close` | `STDDEV_SAMP(close)` | numeric | Sample standard deviation of close prices. |
| `stddev_pop_close` | `STDDEV_POP(close)` | numeric | Population standard deviation of close prices. |

*This query summarizes six recent AAPL rows from the USA silver OHLCV table.*

```sql
SELECT
    ROUND(SUM(volume)::numeric, 0) AS sum_volume,
    ROUND(AVG(close)::numeric, 4) AS avg_close,
    ROUND(MIN(close)::numeric, 2) AS min_close,
    ROUND(MAX(close)::numeric, 2) AS max_close,
    ROUND(STDDEV_SAMP(close)::numeric, 6) AS stddev_samp_close,
    ROUND(STDDEV_POP(close)::numeric, 6) AS stddev_pop_close
FROM silver.stoxxusa50_ohlcv
WHERE symbol = 'AAPL'
  AND date BETWEEN DATE '2026-03-30' AND DATE '2026-04-07';
```

| sum_volume | avg_close | min_close | max_close | stddev_samp_close | stddev_pop_close |
|---:|---:|---:|---:|---:|---:|
| 250543961 | 254.0550 | 246.63 | 258.86 | 4.112317 | 3.754015 |

The sample and population standard deviations differ because the sample form divides by `n - 1` while the population form divides by `n`. That distinction matters when the selected rows are treated as a sample from a broader process instead of the full population of interest.

## Conditional Aggregation and Ratio Safety

Many analytical queries need several segmented metrics out of the same grouped scan. PostgreSQL's `FILTER` clause is often the cleanest way to express that intent.

### Segment rows inside the aggregate, then protect the denominator

The two recurring patterns are conditional counts or sums and safe ratios built from those grouped results.

#### Use `FILTER` for conditional counts and sums

Use `FILTER` when the query needs several related aggregates over the same grouped rowset but with different conditions. It is typically triggered by score distributions, status dashboards, and segmented totals. The query is read-only. Its purpose is to show the PostgreSQL-native alternative to repeated `SUM(CASE ...)` patterns.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `sector` | `gold.scores_daily.sector` | varchar | Grouping key of the current summary row. |
| `sector_rows` | `COUNT(*)` | bigint | Total rows in the sector group. |
| `positive_rows` | `COUNT(*) FILTER (WHERE composite_score > 0)` | bigint | Sector rows with positive scores. |
| `non_positive_rows` | `COUNT(*) FILTER (WHERE composite_score <= 0)` | bigint | Sector rows with zero or negative scores. |

*This query counts positive and non-positive latest USA scores per sector in one grouped pass.*

```sql
SELECT
    sector,
    COUNT(*) AS sector_rows,
    COUNT(*) FILTER (WHERE composite_score > 0) AS positive_rows,
    COUNT(*) FILTER (WHERE composite_score <= 0) AS non_positive_rows
FROM gold.scores_daily
WHERE score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
  AND _index = 'stoxx_usa_50'
GROUP BY sector
HAVING COUNT(*) >= 3
ORDER BY positive_rows DESC, sector
LIMIT 8;
```

| sector | sector_rows | positive_rows | non_positive_rows |
|---|---:|---:|---:|
| Technology | 15 | 10 | 5 |
| Communication Services | 5 | 4 | 1 |
| Financial Services | 9 | 2 | 7 |
| Healthcare | 5 | 2 | 3 |
| Industrials | 3 | 2 | 1 |
| Consumer Cyclical | 4 | 1 | 3 |
| Consumer Defensive | 6 | 1 | 5 |

This is the same logical job that many SQL Server notes express with `SUM(CASE WHEN ...)`, but PostgreSQL makes the condition part of the aggregate itself. The intent is easier to scan, especially when many segmented metrics are side by side.

#### Protect ratios with `NULLIF`

Use `NULLIF` when a grouped denominator might be zero and a safe null result is preferable to a runtime error. It is typically triggered by percentages, conversion rates, and per-group shares. The query is read-only. Its purpose is to show the standard divide-by-zero guard in PostgreSQL aggregate work.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `sector` | `gold.scores_daily.sector` | varchar | Grouping key of the current ratio row. |
| `sector_rows` | `COUNT(*)` | bigint | Total rows in the denominator group. |
| `positive_rows` | filtered `COUNT(*)` | bigint | Numerator: positive-score rows. |
| `positive_share` | guarded division | numeric | Positive rows divided by total rows, with zero denominators converted to `NULL`. |

*This query turns the positive-row counts into sector shares while protecting the denominator explicitly.*

```sql
SELECT
    sector,
    COUNT(*) AS sector_rows,
    COUNT(*) FILTER (WHERE composite_score > 0) AS positive_rows,
    ROUND((COUNT(*) FILTER (WHERE composite_score > 0))::numeric / NULLIF(COUNT(*), 0), 4) AS positive_share
FROM gold.scores_daily
WHERE score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
  AND _index = 'stoxx_usa_50'
GROUP BY sector
HAVING COUNT(*) >= 3
ORDER BY positive_share DESC, sector
LIMIT 8;
```

| sector | sector_rows | positive_rows | positive_share |
|---|---:|---:|---:|
| Communication Services | 5 | 4 | 0.8000 |
| Industrials | 3 | 2 | 0.6667 |
| Technology | 15 | 10 | 0.6667 |
| Healthcare | 5 | 2 | 0.4000 |
| Consumer Cyclical | 4 | 1 | 0.2500 |
| Financial Services | 9 | 2 | 0.2222 |
| Consumer Defensive | 6 | 1 | 0.1667 |

Every denominator in this slice is non-zero, so the guard did not fire. The important point is that the safety boundary is encoded in the query rather than assumed from the current data.

## Scalar Math Functions

Analytical SQL is rarely pure aggregation. PostgreSQL also provides a wide numeric function surface for rounding, truncation, roots, powers, and pseudo-random or cryptographic random values.

### Row-wise numeric transformations

These functions operate per row or per expression, not across groups, but they often appear directly next to grouped metrics.

#### Apply common scalar math functions explicitly

Use this pattern when a query needs deterministic numeric transformation rather than grouped reduction. It is typically triggered by formatting, bucketing, scientific transforms, and synthetic-test calculations. The query is read-only. Its purpose is to show several core math operators side by side with their actual PostgreSQL outputs.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `abs_value` | `ABS(...)` | numeric | Absolute value of the input. |
| `sign_value` | `SIGN(...)` | numeric | Sign of the input: negative, zero, or positive. |
| `ceil_value` | `CEIL(...)` | numeric | Smallest integer not less than the input. |
| `floor_value` | `FLOOR(...)` | numeric | Largest integer not greater than the input. |
| `round_2dp` | `ROUND(..., 2)` | numeric | Rounded value at two decimal places. |
| `trunc_2dp` | `TRUNC(..., 2)` | numeric | Truncated value at two decimal places. |
| `sqrt_value` | `SQRT(...)` | numeric | Square root of the input. |
| `power_value` | `POWER(...)` | numeric | Exponentiation result. |

*This query demonstrates the core row-wise math functions that appear most often in analytical SQL.*

```sql
SELECT
    ABS(-12.345::numeric) AS abs_value,
    SIGN(-12.345::numeric) AS sign_value,
    CEIL(12.345::numeric) AS ceil_value,
    FLOOR(12.345::numeric) AS floor_value,
    ROUND(12.345::numeric, 2) AS round_2dp,
    TRUNC(12.345::numeric, 2) AS trunc_2dp,
    SQRT(144.0) AS sqrt_value,
    POWER(1.05, 3) AS power_value;
```

| abs_value | sign_value | ceil_value | floor_value | round_2dp | trunc_2dp | sqrt_value | power_value |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 12.345 | -1 | 13 | 12 | 12.35 | 12.34 | 12.000000000000000 | 1.1576250000000000 |

`ROUND` and `TRUNC` are often confused. The result makes the difference explicit: `12.345` rounds to `12.35` but truncates to `12.34`.

#### Distinguish pseudo-random from cryptographic random values

Use this pattern when a query needs a random sample, test data, or a cryptographically stronger random byte sequence. It is typically triggered by lab work, data generation, or token construction. The query is read-only. Its purpose is to show that PostgreSQL exposes both lightweight pseudo-random generation and stronger randomness through `pgcrypto`.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `pseudo_random` | `random()` | numeric | Fast pseudo-random value in the range `[0, 1)`. |
| `crypto_bytes_hex` | `encode(gen_random_bytes(4), 'hex')` | text | Four cryptographically generated bytes rendered as hex. |

*This query contrasts `random()` with `gen_random_bytes()` from `pgcrypto`.*

```sql
SELECT
    ROUND(random()::numeric, 6) AS pseudo_random,
    encode(gen_random_bytes(4), 'hex') AS crypto_bytes_hex;
```

| pseudo_random | crypto_bytes_hex |
|---:|---|
| 0.380646 | e399fa1c |

`random()` is appropriate for fast non-cryptographic use such as sampling. When the value must not be guessable, use a cryptographic source from `pgcrypto` instead.

## Multi-Level Grouping

PostgreSQL supports the same major grouping extensions used in enterprise SQL: `ROLLUP`, `CUBE`, and `GROUPING SETS`. The critical operational issue is subtotal labeling, because subtotal rows introduce `NULL` markers that can be confused with real source nulls.

### Hierarchical and explicit subtotal generation

`ROLLUP` produces hierarchical subtotal levels. `GROUPING SETS` lets the author name the exact subtotal combinations required. `GROUPING(...)` reveals whether a `NULL` in the output is a real value or a subtotal marker.

#### Label subtotal rows from `ROLLUP` with `GROUPING(...)`

Use `ROLLUP` when the report needs detail rows plus hierarchical subtotals and a grand total. It is typically triggered by management reporting and multidimensional summaries. The query is read-only. Its purpose is to show the subtotal rows and the grouping flags that identify them.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `country` | `gold.scores_daily.country` | varchar | Country dimension in the rollup hierarchy. |
| `sector` | `gold.scores_daily.sector` | varchar | Sector dimension nested beneath country. |
| `row_count` | `COUNT(*)` | bigint | Number of rows at the current grouping level. |
| `g_country` | `GROUPING(country)` | integer | `1` when `country` is a rollup-generated subtotal marker. |
| `g_sector` | `GROUPING(sector)` | integer | `1` when `sector` is a rollup-generated subtotal marker. |

*This query rolls up latest Euro Stoxx 50 rows by country and sector and exposes which nulls are subtotal markers.*

```sql
SELECT
    country,
    sector,
    COUNT(*) AS row_count,
    GROUPING(country) AS g_country,
    GROUPING(sector) AS g_sector
FROM gold.scores_daily
WHERE score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
  AND _index = 'euro_stoxx_50'
  AND country IN ('Germany', 'France', 'Netherlands')
GROUP BY ROLLUP(country, sector)
ORDER BY country NULLS LAST, sector NULLS LAST;
```

| country | sector | row_count | g_country | g_sector |
|---|---|---:|---:|---:|
| France | Basic Materials | 1 | 0 | 0 |
| France | Consumer Cyclical | 2 | 0 | 0 |
| France | Consumer Defensive | 2 | 0 | 0 |
| France | Energy | 1 | 0 | 0 |
| France | Financial Services | 2 | 0 | 0 |
| France | Healthcare | 2 | 0 | 0 |
| France | Industrials | 4 | 0 | 0 |
| France | Technology | 1 | 0 | 0 |
| France |  | 15 | 0 | 1 |
| Germany | Basic Materials | 1 | 0 | 0 |
| Germany | Communication Services | 1 | 0 | 0 |
| Germany | Consumer Cyclical | 4 | 0 | 0 |
| Germany | Financial Services | 3 | 0 | 0 |
| Germany | Healthcare | 1 | 0 | 0 |
| Germany | Industrials | 4 | 0 | 0 |
| Germany | Technology | 2 | 0 | 0 |
| Germany |  | 16 | 0 | 1 |
| Netherlands | Consumer Cyclical | 1 | 0 | 0 |
| Netherlands | Consumer Defensive | 1 | 0 | 0 |
| Netherlands | Financial Services | 1 | 0 | 0 |
| Netherlands | Healthcare | 1 | 0 | 0 |
| Netherlands | Industrials | 2 | 0 | 0 |
| Netherlands | Technology | 2 | 0 | 0 |
| Netherlands |  | 8 | 0 | 1 |
|  |  | 39 | 1 | 1 |

The country subtotal rows have `g_sector = 1`, and the grand total has both flags set to `1`. That is how PostgreSQL distinguishes subtotal null markers from real null values.

#### Use `GROUPING SETS` when only specific subtotal levels are required

Use `GROUPING SETS` when the report needs a selective list of subtotal levels instead of the full hierarchy produced by `ROLLUP` or the full power set produced by `CUBE`. It is typically triggered by curated report layouts and cost-sensitive grouped output. The query is read-only. Its purpose is to show explicit subtotal selection.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `country` | `gold.scores_daily.country` | varchar | Country subtotal dimension when present. |
| `sector` | `gold.scores_daily.sector` | varchar | Sector subtotal dimension when present. |
| `row_count` | `COUNT(*)` | bigint | Number of rows in the requested grouping set. |

*This query requests only country totals, sector totals, and the grand total, skipping the country-sector detail combinations entirely.*

```sql
SELECT
    country,
    sector,
    COUNT(*) AS row_count
FROM gold.scores_daily
WHERE score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
  AND _index = 'euro_stoxx_50'
  AND country IN ('Germany', 'France', 'Netherlands')
GROUP BY GROUPING SETS ((country), (sector), ())
ORDER BY country NULLS LAST, sector NULLS LAST;
```

| country | sector | row_count |
|---|---|---:|
| France |  | 15 |
| Germany |  | 16 |
| Netherlands |  | 8 |
|  | Basic Materials | 2 |
|  | Communication Services | 1 |
|  | Consumer Cyclical | 7 |
|  | Consumer Defensive | 3 |
|  | Energy | 1 |
|  | Financial Services | 6 |
|  | Healthcare | 4 |
|  | Industrials | 10 |
|  | Technology | 5 |
|  |  | 39 |

This is the selective-subtotal case where `GROUPING SETS` is clearer than `ROLLUP`. The query asks only for the country totals, the sector totals, and the grand total, so that is all PostgreSQL returns.

## Practical Rules

Use grouped aggregates when the result should collapse to one row per group. Use window aggregates when the detail row must survive. Keep PostgreSQL-specific differences explicit rather than assuming SQL Server semantics transfer unchanged.

| Need | PostgreSQL pattern | Why |
|---|---|---|
| Count all rows | `COUNT(*)` | Counts rows regardless of nulls and already returns `bigint`. |
| Count populated values | `COUNT(column)` | Skips rows where the expression is null. |
| Exact unique-value count | `COUNT(DISTINCT column)` | Core PostgreSQL exact distinct counting. |
| Segmented aggregates in one pass | `FILTER (WHERE ...)` | Cleaner than repeating `CASE` inside each aggregate. |
| Safe ratio | `... / NULLIF(denominator, 0)` | Prevents divide-by-zero failures. |
| Summary dispersion | `STDDEV_SAMP`, `STDDEV_POP` | Choose sample or population semantics deliberately. |
| Fast non-crypto randomness | `random()` | Good for sampling and tests, not security. |
| Stronger random bytes | `gen_random_bytes()` | Use when unpredictability matters. |
| Hierarchical subtotals | `ROLLUP` plus `GROUPING(...)` | Produces detail, subtotals, and grand total with explicit labels. |
| Selective subtotal list | `GROUPING SETS` | Produces only the requested subtotal levels. |
