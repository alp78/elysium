---
title: "03 - Joins, Subqueries, LATERAL, and Set Operators"
tags:
  - postgresql
  - query-optimization
  - sql
aliases:
  - PostgreSQL joins reference
  - EXISTS and NOT EXISTS
  - PostgreSQL LATERAL
  - UNION EXCEPT INTERSECT
description: "PostgreSQL reference for row-combination patterns: inner and outer joins, cross joins, self joins, semi-joins and anti-joins, scalar and correlated subqueries, LATERAL joins, set operators, and PostgreSQL pivot or unpivot equivalents."
parent: "[[domain-postgresql-query-writing-and-optimization]]"
links:
  - "[[02-postgresql-data-types-conversion-and-null-handling]]"
  - "[[04-postgresql-common-table-expressions-and-temporary-objects]]"
status: complete
---

# Joins, Subqueries, LATERAL, and Set Operators

PostgreSQL row-combination work is about preserving, multiplying, filtering, or reshaping rowsets deliberately. The language surface is similar to other SQL engines for core joins and subqueries, but two boundaries matter immediately in PostgreSQL: SQL Server `APPLY` patterns map to `LATERAL`, and SQL Server `PIVOT` or `UNPIVOT` work is usually written as conditional aggregates or `VALUES`-driven row expansion instead of dedicated keywords.

> [!abstract] Scope
>
> This note mirrors the SQL Server row-combination track with PostgreSQL equivalents. It covers join retention rules, correlated subqueries, semi-joins and anti-joins, `LATERAL` as the PostgreSQL analogue to `APPLY`, set operators, and row-to-column or column-to-row reshaping patterns.
>
> - **Join families** show how `INNER`, `LEFT`, `RIGHT`, and `FULL OUTER` joins control row preservation and why right-side predicates belong in the `ON` clause when the left side must survive.
> - **Cross joins and self joins** show deliberate row multiplication versus row-to-row comparison against the same base table.
> - **Semi-joins, anti-joins, and subqueries** show presence checks with `EXISTS`, absence checks with `NOT EXISTS`, and the row-cardinality boundary of scalar subqueries.
> - **`LATERAL`** covers PostgreSQL's row-wise derived-rowset pattern for per-parent top-N and optional derived lookups.
> - **Set operators and transpose patterns** cover `UNION`, `UNION ALL`, `EXCEPT`, `INTERSECT`, conditional aggregates, and `CROSS JOIN LATERAL (VALUES ...)`.

## Join Families

Join choice is fundamentally about match retention. `INNER JOIN` keeps only matched rows, `LEFT JOIN` preserves the left side, `RIGHT JOIN` preserves the right side, and `FULL OUTER JOIN` preserves both. PostgreSQL supports the full family, but production code is usually clearest when the driving rowset is written on the left and preserved with `LEFT JOIN`.

### Matching versus preserving rows

The critical question is not "can these tables be joined?" but "which side must survive if no match exists?" The live `stoxx` data makes that distinction easy to demonstrate because the index metadata table is small, stable, and easy to compare to the performance facts.

#### Join index metadata to the latest performance facts

Use this pattern when a query needs attributes from one table and measurements from another and unmatched rows have no business meaning. It is typically triggered by reporting, enrichment, or validation queries against a fact table that is expected to have a corresponding dimension entry. The query runs read-only against `bronze.dim_index` and `gold.index_performance`. Its purpose is to show the baseline matched-row pattern before outer-join preservation rules are introduced.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `index_key` | `bronze.dim_index.index_key` | varchar | Canonical index identifier used across the warehouse. |
| `display_name` | `bronze.dim_index.display_name` | varchar | Human-readable index label. |
| `perf_date` | `gold.index_performance.perf_date` | date | Performance date of the fact row. |
| `daily_return` | `gold.index_performance.daily_return` | double precision | Daily return captured for the index on that date. |

*This query inner-joins the current dimension surface to the latest index-performance rows.*

```sql
SELECT
    d.index_key,
    d.display_name,
    p.perf_date,
    ROUND(p.daily_return::numeric, 6) AS daily_return
FROM bronze.dim_index AS d
JOIN gold.index_performance AS p
  ON p._index = d.index_key
WHERE p.perf_date = (SELECT MAX(perf_date) FROM gold.index_performance)
ORDER BY d.index_key;
```

| index_key | display_name | perf_date | daily_return |
|---|---|---|---:|
| euro_stoxx_50 | Euro Stoxx 50 | 2026-04-07 | -0.007931 |
| oil_20 | Oil & Gas 20 | 2026-04-07 | 0.006887 |
| stoxx_asia_50 | STOXX Asia/Pacific 50 | 2026-04-07 | 0.005919 |
| stoxx_usa_50 | STOXX USA 50 | 2026-04-07 | 0.000962 |

All four current index dimension rows matched a latest performance row, so the join returned one row per index. That is the simplest join case: the query is not trying to preserve missing dimension members or surface data gaps. It is only returning the intersection of both rowsets.

#### Keep the driving rowset outer by pushing right-side filters into `ON`

Use this pattern when the left-side rowset is the thing that must survive, even if the right side is absent. It is typically triggered by reconciliation work, exception reporting, or "show me all requested keys, with data when available" queries. The query is read-only. Its purpose is to make the most common outer-join bug visible: a right-side filter in `WHERE` silently collapses a `LEFT JOIN` into matched rows only.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `index_key` | inline `VALUES` rowset | text | Candidate key that should remain visible even if no fact row exists. |
| `perf_date` | `gold.index_performance.perf_date` | date | Latest fact date when a matching row is present. |

> [!danger] Right-side `WHERE` filters erase outer rows
>
> A `LEFT JOIN` only preserves the left side until the `WHERE` clause runs. If `WHERE` references a right-side column, every unmatched left row carries `NULL` into that predicate and is filtered away.

*This query is logically broken because the `WHERE` predicate removes the unmatched `crypto_10` row.*

```sql
WITH candidate(index_key) AS (
    VALUES ('euro_stoxx_50'), ('oil_20'), ('crypto_10')
)
SELECT
    c.index_key,
    p.perf_date
FROM candidate AS c
LEFT JOIN gold.index_performance AS p
  ON p._index = c.index_key
WHERE p.perf_date = (SELECT MAX(perf_date) FROM gold.index_performance)
ORDER BY c.index_key;
```

| index_key | perf_date |
|---|---|
| euro_stoxx_50 | 2026-04-07 |
| oil_20 | 2026-04-07 |

The unmatched key disappeared entirely, so the result no longer behaves like an outer join. The join itself preserved `crypto_10`; the later `WHERE` clause removed it.

> [!success] Put nullable-side predicates in `ON`
>
> Keep predicates that define match eligibility on the nullable side inside the `ON` clause. The join will then decide whether the right side matches, while the left side still survives when it does not.

*This corrected query preserves the candidate key list and only restricts which right-side rows may match.*

```sql
WITH candidate(index_key) AS (
    VALUES ('euro_stoxx_50'), ('oil_20'), ('crypto_10')
)
SELECT
    c.index_key,
    p.perf_date
FROM candidate AS c
LEFT JOIN gold.index_performance AS p
  ON p._index = c.index_key
 AND p.perf_date = (SELECT MAX(perf_date) FROM gold.index_performance)
ORDER BY c.index_key;
```

| index_key | perf_date |
|---|---|
| crypto_10 |  |
| euro_stoxx_50 | 2026-04-07 |
| oil_20 | 2026-04-07 |

This result preserves the requested keys and expresses the real business meaning: two keys have current facts and one does not. That is what `LEFT JOIN` is for.

#### Reconcile expected versus observed keys with `FULL OUTER JOIN`

Use `FULL OUTER JOIN` when both sides matter and the query must surface "present in both", "present only on the left", and "present only on the right" in one pass. It is typically triggered by reconciliation after a load, feed-coverage checks, or migration validation. The query is read-only. Its purpose is to show the cleanest PostgreSQL pattern for four-state reconciliation.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `index_key` | `COALESCE(e.index_key, o.index_key)` | text | Unified business key from either side of the comparison. |
| `match_state` | computed `CASE` expression | text | Reconciliation state: matched, expected only, or observed only. |

*This query compares an expected key list to the latest observed fact keys and classifies every key state.*

```sql
WITH expected(index_key) AS (
    VALUES ('euro_stoxx_50'), ('oil_20'), ('frontier_15')
),
observed(index_key) AS (
    SELECT _index
    FROM gold.index_performance
    WHERE perf_date = (SELECT MAX(perf_date) FROM gold.index_performance)
)
SELECT
    COALESCE(e.index_key, o.index_key) AS index_key,
    CASE
        WHEN e.index_key IS NOT NULL AND o.index_key IS NOT NULL THEN 'matched'
        WHEN e.index_key IS NOT NULL THEN 'expected_only'
        ELSE 'observed_only'
    END AS match_state
FROM expected AS e
FULL OUTER JOIN observed AS o
  ON o.index_key = e.index_key
ORDER BY index_key;
```

| index_key | match_state |
|---|---|
| euro_stoxx_50 | matched |
| frontier_15 | expected_only |
| oil_20 | matched |
| stoxx_asia_50 | observed_only |
| stoxx_usa_50 | observed_only |

The result exposes all reconciliation states in a single query. `frontier_15` is missing from the observed set, while `stoxx_asia_50` and `stoxx_usa_50` arrived even though they were not part of the expected list. This is exactly the kind of difference map that is awkward with separate `LEFT JOIN` queries but natural with `FULL OUTER JOIN`.

## Cross Joins and Self Joins

Not every multi-table query is a lookup. Some queries deliberately multiply rows to create combinations, while others compare one row to another row from the same base table. PostgreSQL handles both patterns with standard SQL syntax; the operational difference is whether the multiplication is intentional.

### Deliberate row multiplication versus row-to-row comparison

`CROSS JOIN` creates a Cartesian product. A self join reuses the same base table twice under different aliases to create two logical roles. Both are valid tools, but both need clear intent because they can expand row counts quickly.

#### Generate every combination of recent dates and selected indexes

Use `CROSS JOIN` when every row on one side should pair with every row on the other. It is typically triggered by grid generation, calendar expansion, test harnesses, or backfill scaffolding. The query is read-only. Its purpose is to show deliberate Cartesian multiplication on live warehouse metadata rather than an accidental missing predicate.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `date` | `bronze.trading_calendar.date` | date | Trading date selected from the recent calendar window. |
| `index_key` | `bronze.dim_index.index_key` | varchar | Selected index identifier. |

*This query multiplies three recent NMS trading dates by two chosen indexes to form a six-row grid.*

```sql
WITH recent_days AS (
    SELECT date
    FROM bronze.trading_calendar
    WHERE exchange_code = 'NMS'
      AND is_trading_day
    ORDER BY date DESC
    LIMIT 3
),
chosen_indexes AS (
    SELECT index_key
    FROM bronze.dim_index
    WHERE index_key IN ('euro_stoxx_50', 'stoxx_usa_50')
)
SELECT
    d.date,
    i.index_key
FROM recent_days AS d
CROSS JOIN chosen_indexes AS i
ORDER BY d.date DESC, i.index_key;
```

| date | index_key |
|---|---|
| 2027-03-12 | euro_stoxx_50 |
| 2027-03-12 | stoxx_usa_50 |
| 2027-03-11 | euro_stoxx_50 |
| 2027-03-11 | stoxx_usa_50 |
| 2027-03-10 | euro_stoxx_50 |
| 2027-03-10 | stoxx_usa_50 |

The row-count rule is explicit: `3 recent days x 2 index keys = 6 output rows`. That formula is what makes a `CROSS JOIN` safe. If the multiplication is not intentional, it is usually a bug.

#### Compare each trading day to the same symbol seven days earlier

Use a self join when one table must play two logical roles in the same query. It is typically triggered by point-in-time comparison, hierarchy traversal, or prior-period analysis. The query is read-only against `silver.stoxxusa50_ohlcv`. Its purpose is to show the classic row-to-row comparison pattern on a real market-data series.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | `cur.symbol` | varchar | Equity ticker carried from the current-row side. |
| `date` | `cur.date` | date | Current trading date. |
| `current_close` | `cur.close` | numeric projection | Current close price rounded for display. |
| `prev_close` | `prev.close` | numeric projection | Close price exactly seven calendar days earlier. |
| `seven_day_change` | `cur.close - prev.close` | numeric projection | Difference between the current and prior close. |

*This query self-joins AAPL rows to the same table seven days earlier to calculate a rolling price delta.*

```sql
SELECT
    cur.symbol,
    cur.date,
    ROUND(cur.close::numeric, 2) AS current_close,
    ROUND(prev.close::numeric, 2) AS prev_close,
    ROUND((cur.close - prev.close)::numeric, 2) AS seven_day_change
FROM silver.stoxxusa50_ohlcv AS cur
JOIN silver.stoxxusa50_ohlcv AS prev
  ON prev.symbol = cur.symbol
 AND prev.date = cur.date - INTERVAL '7 day'
WHERE cur.symbol = 'AAPL'
  AND cur.date >= DATE '2026-02-02'
ORDER BY cur.date
LIMIT 5;
```

| symbol | date | current_close | prev_close | seven_day_change |
|---|---|---:|---:|---:|
| AAPL | 2026-02-02 | 270.01 | 255.41 | 14.60 |
| AAPL | 2026-02-03 | 269.48 | 258.27 | 11.21 |
| AAPL | 2026-02-04 | 276.49 | 256.44 | 20.05 |
| AAPL | 2026-02-05 | 275.91 | 258.28 | 17.63 |
| AAPL | 2026-02-06 | 278.12 | 259.48 | 18.64 |

The table appears twice, but the aliases make the roles distinct: `cur` is the current trading day and `prev` is the seven-days-prior anchor. That is the operational essence of a self join.

## Semi-Joins, Anti-Joins, and Subqueries

Many business questions are not "bring me columns from both sides" questions. They are presence, absence, or row-wise comparison questions. PostgreSQL answers those most clearly with `EXISTS`, `NOT EXISTS`, scalar subqueries with guaranteed cardinality, and correlated subqueries where an outer row needs its own comparison set.

### Presence and absence tests

Semi-joins return left-side rows when a related row exists. Anti-joins return left-side rows only when no related row exists. These patterns are about truth tests, not enrichment, so `EXISTS` and `NOT EXISTS` are usually clearer than join-plus-deduplication workarounds.

#### Use `EXISTS` when only row presence matters

Use `EXISTS` when the question is "does at least one related row exist?" and the query does not need right-side columns. It is typically triggered by gating logic, validation queries, and membership checks. The query is read-only. Its purpose is to show the clean semi-join pattern on the warehouse index dimension.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `index_key` | `bronze.dim_index.index_key` | varchar | Dimension key returned only when at least one current score row exists. |

*This query returns only those dimension keys that have at least one score row on the latest scoring date.*

```sql
SELECT
    d.index_key
FROM bronze.dim_index AS d
WHERE EXISTS (
    SELECT 1
    FROM gold.scores_daily AS s
    WHERE s._index = d.index_key
      AND s.score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
)
ORDER BY d.index_key;
```

| index_key |
|---|
| euro_stoxx_50 |
| oil_20 |
| stoxx_asia_50 |
| stoxx_usa_50 |

`EXISTS` stops at the logical question of presence. It does not multiply rows by the number of matches, and it does not need a `DISTINCT` cleanup step afterward.

#### Use `NOT EXISTS` for absence checks

Use `NOT EXISTS` when the business question is "which requested keys do not have a related row?" It is typically triggered by reconciliation, exception queues, and load-gap checks. The query is read-only. Its purpose is to show the standard PostgreSQL anti-join idiom.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `index_key` | inline `VALUES` rowset | text | Candidate key returned only when no current performance row exists. |

*This query returns requested keys that do not appear in the latest performance snapshot.*

```sql
WITH candidate(index_key) AS (
    VALUES ('euro_stoxx_50'), ('oil_20'), ('crypto_10'), ('frontier_15')
)
SELECT
    c.index_key
FROM candidate AS c
WHERE NOT EXISTS (
    SELECT 1
    FROM gold.index_performance AS p
    WHERE p._index = c.index_key
      AND p.perf_date = (SELECT MAX(perf_date) FROM gold.index_performance)
)
ORDER BY c.index_key;
```

| index_key |
|---|
| crypto_10 |
| frontier_15 |

This query expresses absence directly. That makes it safer than `NOT IN` patterns that can be derailed by nullable right-side values.

### Scalar and correlated subqueries

Subqueries are still useful in PostgreSQL, but the operational rule is strict: a scalar subquery must return at most one row for each outer row. If it returns zero rows, PostgreSQL yields `NULL`. If it returns more than one row, PostgreSQL raises an error.

#### A scalar subquery can safely return one derived value per outer row

Use a scalar subquery when one outer row needs one derived value and that value is naturally computed inside a compact inner query. It is typically triggered by lookup-style projections or per-row metadata rollups. The query is read-only. Its purpose is to show a safe scalar subquery that guarantees one row through `MAX(...)`.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `_index` | `gold.index_performance._index` | varchar | Index key from the outer row. |
| `perf_date` | `gold.index_performance.perf_date` | date | Latest performance date of the outer row. |
| `latest_score_date` | scalar subquery over `gold.scores_daily` | date | Most recent score date available for the same index. |

*This query decorates each latest performance row with the most recent score date for that index.*

```sql
SELECT
    p._index,
    p.perf_date,
    (
        SELECT MAX(s.score_date)
        FROM gold.scores_daily AS s
        WHERE s._index = p._index
    ) AS latest_score_date
FROM gold.index_performance AS p
WHERE p.perf_date = (SELECT MAX(perf_date) FROM gold.index_performance)
ORDER BY p._index;
```

| _index | perf_date | latest_score_date |
|---|---|---|
| euro_stoxx_50 | 2026-04-07 | 2026-04-08 |
| oil_20 | 2026-04-07 | 2026-04-08 |
| stoxx_asia_50 | 2026-04-07 | 2026-04-08 |
| stoxx_usa_50 | 2026-04-07 | 2026-04-08 |

The scalar query is safe because `MAX(...)` collapses any matching score rows to one value. That is the core cardinality safeguard for scalar subqueries.

#### A scalar subquery that finds no rows yields `NULL`

Use this pattern when the absence of a related row is meaningful and a nullable scalar result is acceptable. It is typically triggered by optional metadata lookups or audit queries where "missing" is itself a useful state. The query is read-only. Its purpose is to show PostgreSQL's zero-row scalar behavior explicitly.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `index_key` | inline `VALUES` rowset | text | Candidate key being checked. |
| `latest_perf_date` | scalar subquery over `gold.index_performance` | date | Latest performance date when one exists; otherwise `NULL`. |

*This query shows that a scalar subquery returns `NULL` when no matching rows exist.*

```sql
WITH candidate(index_key) AS (
    VALUES ('euro_stoxx_50'), ('crypto_10')
)
SELECT
    c.index_key,
    (
        SELECT MAX(p.perf_date)
        FROM gold.index_performance AS p
        WHERE p._index = c.index_key
    ) AS latest_perf_date
FROM candidate AS c
ORDER BY c.index_key;
```

| index_key | latest_perf_date |
|---|---|
| crypto_10 |  |
| euro_stoxx_50 | 2026-04-07 |

That `NULL` is not an error. It is PostgreSQL's normal result for "no scalar value could be produced."

#### A scalar subquery that returns multiple rows fails

Use this example as a correctness boundary during review or debugging. It is typically triggered when a query author assumes uniqueness that the data does not actually enforce. The query is read-only, but it fails at execution time. Its purpose is to show the exact PostgreSQL error when a scalar position receives more than one row.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | `gold.scores_daily.symbol` | varchar | Equity ticker returned by the inner query. The problem is that many rows satisfy the filter. |

*This query fails because the inner query produces many symbols, not one scalar value.*

```sql
SELECT (
    SELECT symbol
    FROM gold.scores_daily
    WHERE _index = 'euro_stoxx_50'
      AND score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
);
```

```text
ERROR:  more than one row returned by a subquery used as an expression
```

When that error appears, the fix is to aggregate, limit with deterministic ordering, or redesign the query so the outer expression no longer expects a scalar.

#### Use a correlated subquery when each row needs its own comparison set

Use a correlated subquery when every outer row must be compared to a value derived from rows in the same logical group. It is typically triggered by per-group baselines, threshold checks, or classification work. The query is read-only. Its purpose is to compare each latest score to the average score of its own index on the same scoring date.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | `gold.scores_daily.symbol` | varchar | Equity ticker in the selected scoring slice. |
| `_index` | `gold.scores_daily._index` | varchar | Index grouping key used by the correlated subquery. |
| `composite_score` | `gold.scores_daily.composite_score` | double precision | Current score of the row being evaluated. |
| `index_avg` | correlated `AVG(...)` subquery | numeric | Average composite score of all rows in the same index and score date. |

*This query compares each top Euro Stoxx 50 score to the average score of its own scoring slice.*

```sql
SELECT
    s.symbol,
    s._index,
    ROUND(s.composite_score::numeric, 4) AS composite_score,
    ROUND((
        SELECT AVG(s2.composite_score)::numeric
        FROM gold.scores_daily AS s2
        WHERE s2._index = s._index
          AND s2.score_date = s.score_date
    ), 4) AS index_avg
FROM gold.scores_daily AS s
WHERE s.score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
  AND s._index = 'euro_stoxx_50'
ORDER BY s.composite_score DESC NULLS LAST
LIMIT 5;
```

| symbol | _index | composite_score | index_avg |
|---|---|---:|---:|
| BNP.PA | euro_stoxx_50 | 0.5967 | 0.0200 |
| TTE.PA | euro_stoxx_50 | 0.4954 | 0.0200 |
| ENI.MI | euro_stoxx_50 | 0.4807 | 0.0200 |
| VOW.DE | euro_stoxx_50 | 0.4606 | 0.0200 |
| DTE.DE | euro_stoxx_50 | 0.3805 | 0.0200 |

The inner query is correlated because it depends on the outer row's `_index` and `score_date`. That per-row dependency is what makes the comparison group-specific.

## `LATERAL` as PostgreSQL's `APPLY` Analogue

PostgreSQL does not implement SQL Server `CROSS APPLY` or `OUTER APPLY`. The operational equivalent is `LATERAL`, which lets a right-side subquery reference columns from the left-side row currently being processed. `CROSS JOIN LATERAL` behaves like `CROSS APPLY`, and `LEFT JOIN LATERAL ... ON TRUE` behaves like `OUTER APPLY`.

### Row-wise derived rowsets

Use `LATERAL` when a derived right-side rowset depends on the current left-side row and the query would otherwise become awkward or repetitive. The classic cases are per-parent top-N, row-wise expansion, and optional derived lookups.

#### Return the top scored symbols for each selected index

Use `CROSS JOIN LATERAL` when each left-side row should produce one or more derived right-side rows and left rows with no derived result can be discarded. It is typically triggered by top-N-per-group work, row-wise ranking, and parameterized subqueries. The query is read-only. Its purpose is to show the PostgreSQL pattern that replaces SQL Server `CROSS APPLY`.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `index_key` | `bronze.dim_index.index_key` | varchar | Left-side parent key. |
| `symbol` | `gold.scores_daily.symbol` | varchar | Symbol returned by the row-wise top-N subquery. |
| `composite_score` | `gold.scores_daily.composite_score` | double precision | Score used to rank symbols within the index. |
| `composite_rank` | `gold.scores_daily.composite_rank` | smallint | Existing rank value from the scoring table. |

*This query runs a per-index top-two scoring query by using `LATERAL` to bind the inner query to each outer index row.*

```sql
SELECT
    i.index_key,
    top_scores.symbol,
    ROUND(top_scores.composite_score::numeric, 4) AS composite_score,
    top_scores.composite_rank
FROM bronze.dim_index AS i
CROSS JOIN LATERAL (
    SELECT
        s.symbol,
        s.composite_score,
        s.composite_rank
    FROM gold.scores_daily AS s
    WHERE s._index = i.index_key
      AND s.score_date = (
          SELECT MAX(score_date)
          FROM gold.scores_daily
          WHERE _index = i.index_key
      )
    ORDER BY s.composite_score DESC NULLS LAST
    LIMIT 2
) AS top_scores
WHERE i.index_key IN ('euro_stoxx_50', 'stoxx_usa_50')
ORDER BY i.index_key, top_scores.composite_score DESC;
```

| index_key | symbol | composite_score | composite_rank |
|---|---|---:|---:|
| euro_stoxx_50 | BNP.PA | 0.5967 | 1 |
| euro_stoxx_50 | TTE.PA | 0.4954 | 2 |
| stoxx_usa_50 | MU | 1.3617 | 1 |
| stoxx_usa_50 | AMD | 0.5408 | 2 |

The inner subquery is evaluated in the context of each outer `index_key`. That row-wise dependency is the defining feature of `LATERAL`.

#### Preserve left rows when the row-wise lookup is optional

Use `LEFT JOIN LATERAL ... ON TRUE` when the left-side rowset must survive even if the row-wise lookup finds nothing. It is typically triggered by optional metadata, optional latest-state lookups, or coverage reporting. The query is read-only. Its purpose is to show PostgreSQL's outer-preserving `LATERAL` pattern.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `index_key` | inline `VALUES` rowset | text | Requested key that must remain visible. |
| `perf_date` | row-wise lookup from `gold.index_performance` | date | Latest performance date if present. |
| `daily_return` | row-wise lookup from `gold.index_performance` | numeric | Rounded daily return if present. |

*This query keeps the requested key list and only fills in the latest performance row when one exists.*

```sql
WITH candidate(index_key) AS (
    VALUES ('euro_stoxx_50'), ('oil_20'), ('crypto_10')
)
SELECT
    c.index_key,
    latest.perf_date,
    latest.daily_return
FROM candidate AS c
LEFT JOIN LATERAL (
    SELECT
        p.perf_date,
        ROUND(p.daily_return::numeric, 6) AS daily_return
    FROM gold.index_performance AS p
    WHERE p._index = c.index_key
    ORDER BY p.perf_date DESC
    LIMIT 1
) AS latest
  ON TRUE
ORDER BY c.index_key;
```

| index_key | perf_date | daily_return |
|---|---|---:|
| crypto_10 |  |  |
| euro_stoxx_50 | 2026-04-07 | -0.007931 |
| oil_20 | 2026-04-07 | 0.006887 |

This is the closest PostgreSQL equivalent to SQL Server `OUTER APPLY`: the left row remains visible, and the derived right-side columns become `NULL` when no row qualifies.

## Set Operators

Set operators combine complete rowsets branch by branch rather than matching rows side by side. PostgreSQL supports the standard operators `UNION`, `UNION ALL`, `EXCEPT`, and `INTERSECT`. The main operational decisions are whether duplicates should be preserved and whether the comparison is about concatenation, difference, or overlap.

### Combining and comparing complete result sets

Every set-operator branch must project the same number of columns in compatible positions. Once that requirement is satisfied, the main difference is whether duplicates are preserved.

#### Prefer `UNION ALL` unless deduplication is a real requirement

Use `UNION ALL` when the query is concatenating compatible rowsets and duplicate preservation is correct or harmless. It is typically triggered by append-style reporting, staging union patterns, and audit comparisons across dates. The query is read-only. Its purpose is to show that `UNION` is not a free synonym for `UNION ALL`; it adds duplicate elimination work and changes row counts.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `union_all_rows` | count over `UNION ALL` branches | bigint | Row count when both branches are appended as-is. |
| `union_rows` | count over `UNION` branches | bigint | Row count after duplicate elimination. |

*This query compares the row counts produced by `UNION ALL` and `UNION` across two nearby performance dates.*

```sql
WITH latest AS (
    SELECT _index
    FROM gold.index_performance
    WHERE perf_date = DATE '2026-04-07'
),
prior AS (
    SELECT _index
    FROM gold.index_performance
    WHERE perf_date = DATE '2026-04-06'
)
SELECT
    (SELECT COUNT(*) FROM (SELECT _index FROM latest UNION ALL SELECT _index FROM prior) AS q) AS union_all_rows,
    (SELECT COUNT(*) FROM (SELECT _index FROM latest UNION SELECT _index FROM prior) AS q) AS union_rows;
```

| union_all_rows | union_rows |
|---:|---:|
| 7 | 4 |

The duplicate elimination collapsed the seven branch rows to four distinct index keys. That is the right behavior only when deduplication is part of the business requirement.

#### Use `EXCEPT` and `INTERSECT` for difference and overlap

Use `EXCEPT` when the goal is "left set minus right set" and `INTERSECT` when the goal is "only rows common to both sets." It is typically triggered by reconciliation, feed-difference checks, and membership comparisons. The queries are read-only. Their purpose is to express set logic directly instead of rebuilding it with joins.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `index_key` | candidate branch or fact branch | text | Business key being compared across both sets. |

*This query returns candidate keys that are absent from the latest observed performance set.*

```sql
WITH candidate(index_key) AS (
    VALUES ('euro_stoxx_50'), ('oil_20'), ('frontier_15')
)
SELECT index_key
FROM candidate
EXCEPT
SELECT _index
FROM gold.index_performance
WHERE perf_date = (SELECT MAX(perf_date) FROM gold.index_performance)
ORDER BY index_key;
```

| index_key |
|---|
| frontier_15 |

*This query returns only the candidate keys that overlap with the latest observed performance set.*

```sql
WITH candidate(index_key) AS (
    VALUES ('euro_stoxx_50'), ('oil_20'), ('frontier_15')
)
SELECT index_key
FROM candidate
INTERSECT
SELECT _index
FROM gold.index_performance
WHERE perf_date = (SELECT MAX(perf_date) FROM gold.index_performance)
ORDER BY index_key;
```

| index_key |
|---|
| euro_stoxx_50 |
| oil_20 |

These operators express the business question directly. `EXCEPT` is the missing-key view. `INTERSECT` is the shared-key view.

## Pivot and Unpivot Equivalents

PostgreSQL does not have SQL Server `PIVOT` and `UNPIVOT` keywords in core SQL. The operational replacement is usually simpler anyway: use conditional aggregates such as `FILTER` for row-to-column transposition, and use `CROSS JOIN LATERAL (VALUES ...)` for column-to-row expansion. When a fully dynamic cross-tab report is required, `tablefunc.crosstab()` is the extension-based alternative, but most pipeline SQL does not need it.

### Row-to-column and column-to-row reshaping

These patterns matter when analytical outputs need report-like shapes rather than normalized rowsets. The key is to keep the transformation explicit so column definitions and null behavior remain obvious.

#### Pivot rows into columns with conditional aggregates

Use conditional aggregates when a fixed set of output columns is known and the goal is to transpose grouped rows into one row per key. It is typically triggered by compact report output, side-by-side metric comparison, and notebook summary tables. The query is read-only. Its purpose is to show the PostgreSQL-native pivot pattern without any special keyword.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `perf_date` | `gold.index_performance.perf_date` | date | Grouping key that becomes one output row per date. |
| `euro_stoxx_50` | filtered aggregate on `daily_return` | numeric | Daily return for Euro Stoxx 50 on that date when present. |
| `stoxx_usa_50` | filtered aggregate on `daily_return` | numeric | Daily return for STOXX USA 50 on that date when present. |

*This query pivots two index return series into separate output columns by using aggregate `FILTER` clauses.*

```sql
SELECT
    perf_date,
    ROUND((MAX(daily_return) FILTER (WHERE _index = 'euro_stoxx_50'))::numeric, 6) AS euro_stoxx_50,
    ROUND((MAX(daily_return) FILTER (WHERE _index = 'stoxx_usa_50'))::numeric, 6) AS stoxx_usa_50
FROM gold.index_performance
WHERE perf_date BETWEEN DATE '2026-04-02' AND DATE '2026-04-07'
GROUP BY perf_date
ORDER BY perf_date;
```

| perf_date | euro_stoxx_50 | stoxx_usa_50 |
|---|---:|---:|
| 2026-04-02 | -0.004797 | 0.000955 |
| 2026-04-03 |  |  |
| 2026-04-06 |  | 0.004856 |
| 2026-04-07 | -0.007931 | 0.000962 |

The `NULL` cells are informative: they mean no qualifying row existed for that index on that date. Unlike a hidden pivot operator, the aggregation logic and null behavior remain explicit in the query text.

#### Unpivot columns into rows with `CROSS JOIN LATERAL (VALUES ...)`

Use `VALUES` row expansion when a query needs to turn several named columns into repeated metric rows. It is typically triggered by metric audits, generic chart feeds, and compact attribute inspection. The query is read-only. Its purpose is to show the clean PostgreSQL replacement for SQL Server `UNPIVOT`.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `_index` | `gold.index_performance._index` | varchar | Business key carried from the source row. |
| `perf_date` | `gold.index_performance.perf_date` | date | Date of the source metric row. |
| `metric_name` | label column from `VALUES` | text | Human-readable metric label emitted by the row constructor. |
| `metric_value` | metric column from `VALUES` | numeric | Rounded metric value emitted by the row constructor. |

*This query turns three performance columns into a labeled rowset for one latest index row.*

```sql
SELECT
    p._index,
    p.perf_date,
    m.metric_name,
    m.metric_value
FROM (
    SELECT
        _index,
        perf_date,
        daily_return,
        rolling_30d_return,
        ytd_return
    FROM gold.index_performance
    WHERE _index = 'euro_stoxx_50'
      AND perf_date = (SELECT MAX(perf_date) FROM gold.index_performance)
) AS p
CROSS JOIN LATERAL (
    VALUES
        ('daily_return', ROUND(p.daily_return::numeric, 6)),
        ('rolling_30d_return', ROUND(p.rolling_30d_return::numeric, 6)),
        ('ytd_return', ROUND(p.ytd_return::numeric, 6))
) AS m(metric_name, metric_value)
ORDER BY m.metric_name;
```

| _index | perf_date | metric_name | metric_value |
|---|---|---|---:|
| euro_stoxx_50 | 2026-04-07 | daily_return | -0.007931 |
| euro_stoxx_50 | 2026-04-07 | rolling_30d_return | -0.069259 |
| euro_stoxx_50 | 2026-04-07 | ytd_return | -0.040304 |

This pattern is more flexible than `UNPIVOT` because it can mix arbitrary expressions, keep control over labels, and decide explicitly which columns should become rows.

## Reference Map

The operational translation from SQL Server to PostgreSQL is straightforward once the rowset role is clear.

| SQL Server concept | PostgreSQL analogue | Practical rule |
|---|---|---|
| `INNER`, `LEFT`, `RIGHT`, `FULL OUTER JOIN` | Same syntax | Prefer `LEFT JOIN` with the driving rowset written on the left. |
| `EXISTS` / `NOT EXISTS` | Same syntax | Use these for semi-joins and anti-joins instead of join-plus-deduplication patterns. |
| Scalar subquery | Same semantics | Guarantee at most one row, or PostgreSQL raises an error. |
| `CROSS APPLY` | `CROSS JOIN LATERAL` | Use when a derived rowset depends on the current outer row and unmatched rows may be dropped. |
| `OUTER APPLY` | `LEFT JOIN LATERAL ... ON TRUE` | Use when the outer row must survive even if the derived lookup returns nothing. |
| `UNION`, `UNION ALL`, `EXCEPT`, `INTERSECT` | Same standard operators | Prefer `UNION ALL` unless duplicate elimination is required. |
| `PIVOT` | Conditional aggregates with `FILTER` or `CASE` | Keep the transposition explicit in the query text. |
| `UNPIVOT` | `CROSS JOIN LATERAL (VALUES ...)` | Expand chosen columns into labeled rows with full expression control. |
