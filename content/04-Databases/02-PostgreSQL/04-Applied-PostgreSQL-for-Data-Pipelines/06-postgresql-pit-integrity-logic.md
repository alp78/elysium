---
title: "06 - Point-in-Time Integrity Logic"
tags:
  - postgresql
  - data-engineering
  - temporal-data
  - medallion
aliases:
  - PIT integrity
  - Point-in-time logic
  - Effective-dated joins
description: "PostgreSQL point-in-time integrity patterns for the live stoxx medallion schemas: snapshot facts, effective-dated rows, correction-aware history, weight closure, temporal joins, and reconciliation gates."
parent: "[[domain-applied-postgresql-pipelines]]"
links:
  - "[[05-postgresql-incremental-transforms]]"
  - "[[07-postgresql-pipeline-integration-and-devex]]"
status: complete
---

# Point-in-Time Integrity Logic

Point-in-time logic is not one problem. In the `stoxx` pipeline it appears as dated snapshot facts, effective-dated reference rows, and correction-aware history where the question is not only "what was true on that business date?" but also "what did the system know when it published that answer?" PostgreSQL can model all three, but only if the time surface is chosen explicitly.

> [!abstract]- Summary
>
> This note mirrors the SQL Server PIT chapter against the live PostgreSQL `stoxx` lab. The current environment already contains two useful real surfaces: `gold.scores_daily` as a published snapshot fact table and `silver.index_dim` as a structurally effective-dated table that has not yet accumulated historical versions. Where the live lab does not yet contain correction history, the note uses transaction-scoped PostgreSQL demos to document the correct model.
>
> **Time-surface separation**
> - distinguishes snapshot facts, effective-dated rows, and correction-aware system history
> - makes the current lab state explicit so PIT queries do not over-claim what the live tables can answer today
>
> **Effective-dated and snapshot logic**
> - covers direct snapshot retrieval from `gold.scores_daily`
> - covers the current valid-time shape of `silver.index_dim`
>
> **Bi-temporal correction handling**
> - replaces SQL Server system-versioned temporal tables with an application-managed PostgreSQL history pattern
>
> **Integrity gates**
> - covers weight closure, temporal alignment of quarterly and daily facts, and reconciliation checks across gold surfaces
>
> **Operational posture**
> - keeps PIT logic audit-focused: choose the right time model first, then tune the join shape and gate publication with reconciliation queries

> [!note]- Glossary
>
> **Point-in-time answer**
> - A result that claims to describe what was true for a specific business date or publication moment.
> - It matters because a PIT answer is only trustworthy if the system can reproduce it later.
>
> ---
>
> **Snapshot fact**
> - A published table keyed directly by a snapshot date, where filtering on that date returns the historical answer.
> - It matters because some PIT questions are best answered directly from gold rather than reconstructed from effective-dated rows.
>
> ---
>
> **Effective-dated row**
> - A row with validity boundaries such as `valid_from` and `valid_to`.
> - It matters because PIT joins need explicit business-valid periods whenever current-state reference data can change over time.
>
> ---
>
> **Transaction time**
> - The period during which a version of a row existed in the database as recorded system knowledge.
> - It matters because later corrections must not erase what the system previously knew.
>
> ---
>
> **Bi-temporal model**
> - A design that tracks both valid time and transaction time.
> - It matters because one timeline cannot answer both "what was true then?" and "what did we know then?" safely.
>
> ---
>
> **Half-open interval**
> - A date or timestamp range written as `>= start AND < end`.
> - It matters because adjacent historical versions stay non-overlapping and deterministic.
>
> ---
>
> **Reconciliation gate**
> - A validation query that checks whether PIT outputs still satisfy counts, date alignment, or weight rules before publication.
> - It matters because temporal results can look plausible while still being wrong.

## Effective-Dated Constituent Lists

The first PIT decision is always: are you reading a published snapshot or reconstructing history from effective-dated reference rows? The live PostgreSQL lab currently has both shapes, but only one of them is fully historical in practice.

### Inspect whether the live reference table is truly historical

This query is appropriate when an operator needs to determine whether `silver.index_dim` is currently a real valid-time history table or only a current-state surface with valid-time columns present. It is triggered before any PIT join design that depends on historical dimension versions. The query is read-only against `silver.index_dim`. Its purpose is to test whether the table currently contains both open and closed versions.

#### Measure the current valid-time posture of `silver.index_dim`

| Field | Meaning |
|---|---|
| `current_rows` | Rows currently marked active. |
| `historical_rows` | Rows already closed with `is_current = false`. |
| `min_valid_from`, `max_valid_from` | Current spread of validity start timestamps. |

*This query checks whether the live reference table already contains historical versions or only current rows.*

```sql
SELECT COUNT(*) AS current_rows,
       COUNT(*) FILTER (WHERE NOT is_current) AS historical_rows,
       MIN(valid_from) AS min_valid_from,
       MAX(valid_from) AS max_valid_from
FROM silver.index_dim;
```

```text
 current_rows | historical_rows |       min_valid_from       |       max_valid_from
--------------+-----------------+----------------------------+----------------------------
          169 |               0 | 2026-03-04 22:11:36.189862 | 2026-03-12 12:09:52.879912
(1 row)
```

The table is structurally ready for effective-dated logic, but the live data is not historical yet. There are no closed rows. That means `silver.index_dim` is safe for current descriptive context, but it cannot yet answer "which sector did this stock have last year?" without additional historization.

### Inspect the current valid-time shape

The sample-row query is appropriate after the aggregate posture check has shown that the table is current-state only. It is triggered when the operator needs to verify the actual row shape rather than trust the aggregate summary. The query is read-only. Its purpose is to show that `valid_to` is still open and `is_current` is still true across representative rows.

#### Inspect representative effective-dated rows from the live dimension table

| Field | Meaning |
|---|---|
| `valid_from` | When the current row version became active in the silver dimension. |
| `valid_to` | Closure time of the row version, if any. |
| `is_current` | Whether the row is currently active. |

*This query samples live rows from `silver.index_dim` to show the current valid-time shape directly.*

```sql
SELECT _index,
       symbol,
       valid_from,
       valid_to,
       is_current
FROM silver.index_dim
ORDER BY symbol
LIMIT 5;
```

```text
    _index     | symbol  |         valid_from         | valid_to | is_current
---------------+---------+----------------------------+----------+------------
 stoxx_asia_50 | 0388.HK | 2026-03-04 22:11:36.30016  |          | t
 stoxx_asia_50 | 1299.HK | 2026-03-04 22:11:36.263401 |          | t
 stoxx_asia_50 | 1810.HK | 2026-03-04 22:11:36.328825 |          | t
 stoxx_asia_50 | 2269.HK | 2026-03-04 22:11:36.328825 |          | t
 stoxx_asia_50 | 3382.T  | 2026-03-04 22:11:36.316571 |          | t
(5 rows)
```

Every sampled row is still open-ended. That is consistent with the aggregate result above: PIT reconstruction from reference history is a future capability of this table, not a current live fact.

### Pull a published PIT snapshot directly from the daily score table

When the business question is "what did the pipeline publish on this score date?", the right answer usually comes straight from the published snapshot fact rather than from a temporal reconstruction. This query is appropriate for dashboard replay, daily publication review, or historical comparison of already-published gold outputs. It is read-only against `gold.scores_daily`. Its purpose is to show the simplest PIT surface in the current lab.

#### Read the published daily score snapshot for `2026-04-08`

| Field | Meaning |
|---|---|
| `score_date` | Published daily snapshot date. |
| `composite_score` | Consumer-facing total score for the stock on that date. |
| `composite_rank` | Rank within the index on that published date. |

*This query reads one published PIT snapshot directly from `gold.scores_daily`.*

```sql
SELECT _index,
       symbol,
       score_date,
       ROUND(composite_score::numeric, 4) AS composite_score,
       composite_rank
FROM gold.scores_daily
WHERE score_date = DATE '2026-04-08'
ORDER BY _index, composite_rank, symbol
LIMIT 8;
```

```text
    _index     | symbol  | score_date | composite_score | composite_rank
---------------+---------+------------+-----------------+----------------
 euro_stoxx_50 | BNP.PA  | 2026-04-08 |          0.5967 |              1
 euro_stoxx_50 | TTE.PA  | 2026-04-08 |          0.4954 |              2
 euro_stoxx_50 | ENI.MI  | 2026-04-08 |          0.4807 |              3
 euro_stoxx_50 | VOW.DE  | 2026-04-08 |          0.4606 |              4
 euro_stoxx_50 | DTE.DE  | 2026-04-08 |          0.3805 |              5
 euro_stoxx_50 | IFX.DE  | 2026-04-08 |          0.3587 |              6
 euro_stoxx_50 | ISP.MI  | 2026-04-08 |          0.3354 |              7
 euro_stoxx_50 | BAYN.DE | 2026-04-08 |          0.3276 |              8
(8 rows)
```

This is the simplest PIT answer in the vault: no temporal join is required because the gold snapshot is already the published answer for that day.

### Track one constituent across published snapshots

This query is appropriate when the operator wants to see how one constituent moved across already-published daily snapshots. It is triggered by rank-change reviews, backtest debugging, or point-in-time consumer comparisons. The query is read-only against `gold.scores_daily`. Its purpose is to show how a snapshot fact table exposes historical evolution cleanly.

#### Track `AAPL` across published daily score snapshots

| Field | Meaning |
|---|---|
| `composite_score` | Published composite score on that date. |
| `composite_rank` | Published rank on that date. |

*This query tracks one constituent across the currently loaded daily score snapshots.*

```sql
SELECT _index,
       symbol,
       score_date,
       ROUND(composite_score::numeric, 4) AS composite_score,
       composite_rank
FROM gold.scores_daily
WHERE symbol = 'AAPL'
ORDER BY score_date;
```

```text
    _index    | symbol | score_date | composite_score | composite_rank
--------------+--------+------------+-----------------+----------------
 stoxx_usa_50 | AAPL   | 2026-03-04 |         -0.2921 |             42
 stoxx_usa_50 | AAPL   | 2026-03-07 |         -0.2865 |             42
 stoxx_usa_50 | AAPL   | 2026-03-12 |         -0.2553 |             39
 stoxx_usa_50 | AAPL   | 2026-04-08 |         -0.2483 |             40
(4 rows)
```

This is the snapshot-fact view of PIT history: what the system published for `AAPL` on each loaded score date is immediately available without reconstructing anything from dimension validity periods.

## Bi-Temporal Model

Core PostgreSQL does not provide the SQL Server system-versioned temporal-table feature. The nearest reliable analogue is an application-managed history table or audit-trigger pattern that stores both business-valid dates and transaction-time columns such as `sys_from` and `sys_to`.

### Inspect both recorded versions of a corrected row

This demo is appropriate when the pipeline needs to preserve what the system knew before a later correction arrived. It is triggered by audit, backfill explanation, or regulatory replay requirements. The transaction is state-changing only inside the demo scope. Its purpose is to show the minimum PostgreSQL bi-temporal pattern: one valid-time interval with two system-time versions.

#### Read both row versions from an application-managed bi-temporal history table

| Field | Meaning |
|---|---|
| `weight_pct` | Published weight value. |
| `valid_from`, `valid_to` | Business-valid interval of the constituent record. |
| `sys_from`, `sys_to` | Transaction-time interval describing when that version was what the system knew. |

*This transaction creates two system-time versions of the same valid-time row and returns both versions.*

```sql
BEGIN;

CREATE TEMP TABLE note06_bitemporal_demo (
    _index text NOT NULL,
    symbol text NOT NULL,
    weight_pct numeric(18,10) NOT NULL,
    valid_from date NOT NULL,
    valid_to date NOT NULL,
    sys_from timestamp NOT NULL,
    sys_to timestamp
);

INSERT INTO note06_bitemporal_demo (_index, symbol, weight_pct, valid_from, valid_to, sys_from, sys_to)
VALUES
    ('euro_stoxx_50', 'ASML.AS', 0.0911568723, DATE '2026-03-04', DATE '9999-12-31', TIMESTAMP '2026-04-08 14:34:29.875666', TIMESTAMP '2026-04-08 14:34:30.882161'),
    ('euro_stoxx_50', 'ASML.AS', 0.0886452600, DATE '2026-03-04', DATE '9999-12-31', TIMESTAMP '2026-04-08 14:34:30.882161', NULL);

SELECT _index,
       symbol,
       weight_pct,
       valid_from,
       valid_to,
       sys_from,
       sys_to
FROM note06_bitemporal_demo
ORDER BY sys_from;

ROLLBACK;
```

```text
BEGIN
CREATE TABLE
INSERT 0 2
    _index     | symbol  |  weight_pct  | valid_from |  valid_to  |          sys_from          |           sys_to
---------------+---------+--------------+------------+------------+----------------------------+----------------------------
 euro_stoxx_50 | ASML.AS | 0.0911568723 | 2026-03-04 | 9999-12-31 | 2026-04-08 14:34:29.875666 | 2026-04-08 14:34:30.882161
 euro_stoxx_50 | ASML.AS | 0.0886452600 | 2026-03-04 | 9999-12-31 | 2026-04-08 14:34:30.882161 |
(2 rows)

ROLLBACK
```

The business-valid period did not change. Only transaction time changed. That is exactly the reason a second timeline exists: the corrected row should not erase what the system previously knew.

### Ask what the system knew before the correction

This query is appropriate when the audit question is about system knowledge, not just business validity. It is triggered by "what would the system have answered before the correction landed?" The transaction is read-only inside the demo data created above. Its purpose is to prove that a transaction-time cutoff returns the original published answer.

#### Reconstruct the row as the system knew it just before the correction

| Field | Meaning |
|---|---|
| `as_of_system_time` | Transaction-time cutoff used for the replay. |
| `weight_pct` | Version of the row that was still current at that system time. |

*This query asks the bi-temporal demo what the system knew immediately before the corrected version became current.*

```sql
BEGIN;

CREATE TEMP TABLE note06_bitemporal_demo (
    _index text NOT NULL,
    symbol text NOT NULL,
    weight_pct numeric(18,10) NOT NULL,
    valid_from date NOT NULL,
    valid_to date NOT NULL,
    sys_from timestamp NOT NULL,
    sys_to timestamp
);

INSERT INTO note06_bitemporal_demo (_index, symbol, weight_pct, valid_from, valid_to, sys_from, sys_to)
VALUES
    ('euro_stoxx_50', 'ASML.AS', 0.0911568723, DATE '2026-03-04', DATE '9999-12-31', TIMESTAMP '2026-04-08 14:34:29.875666', TIMESTAMP '2026-04-08 14:34:30.882161'),
    ('euro_stoxx_50', 'ASML.AS', 0.0886452600, DATE '2026-03-04', DATE '9999-12-31', TIMESTAMP '2026-04-08 14:34:30.882161', NULL);

SELECT TIMESTAMP '2026-04-08 14:34:30.882160' AS as_of_system_time,
       _index,
       symbol,
       weight_pct,
       valid_from,
       valid_to
FROM note06_bitemporal_demo
WHERE sys_from <= TIMESTAMP '2026-04-08 14:34:30.882160'
  AND COALESCE(sys_to, TIMESTAMP '9999-12-31 23:59:59') > TIMESTAMP '2026-04-08 14:34:30.882160';

ROLLBACK;
```

```text
BEGIN
CREATE TABLE
INSERT 0 2
     as_of_system_time     |    _index     | symbol  |  weight_pct  | valid_from |  valid_to
---------------------------+---------------+---------+--------------+------------+------------
 2026-04-08 14:34:30.88216 | euro_stoxx_50 | ASML.AS | 0.0911568723 | 2026-03-04 | 9999-12-31
(1 row)

ROLLBACK
```

This is the audit answer snapshot facts alone cannot provide. Business-valid time says the row was still valid. Transaction time says which version of that row the system actually knew before the correction replaced it.

## Weight Normalization

Weight closure is a publication gate, not a cosmetic check. A constituent list can be historically correct and still be unusable if the weights do not reconcile.

#### Validate weight closure across the loaded daily snapshots

| Field | Meaning |
|---|---|
| `weight_sum` | Sum of `index_weight` for the published snapshot. |
| `constituents` | Number of rows contributing to that weight sum. |

*This query validates that the current daily score snapshots still close to a total weight of 1.0.*

```sql
SELECT _index,
       score_date,
       ROUND(SUM(index_weight)::numeric, 8) AS weight_sum,
       COUNT(*) AS constituents
FROM gold.scores_daily
GROUP BY _index, score_date
ORDER BY score_date DESC, _index
LIMIT 12;
```

```text
    _index     | score_date | weight_sum | constituents
---------------+------------+------------+--------------
 euro_stoxx_50 | 2026-04-08 | 1.00000000 |           50
 oil_20        | 2026-04-08 | 1.00000000 |           19
 stoxx_asia_50 | 2026-04-08 | 1.00000000 |           50
 stoxx_usa_50  | 2026-04-08 | 1.00000000 |           50
 euro_stoxx_50 | 2026-03-12 | 1.00000000 |           50
 oil_20        | 2026-03-12 | 1.00000000 |           19
 stoxx_asia_50 | 2026-03-12 | 1.00000000 |           50
 stoxx_usa_50  | 2026-03-12 | 1.00000000 |           50
 euro_stoxx_50 | 2026-03-07 | 1.00000000 |           50
 stoxx_asia_50 | 2026-03-07 | 1.00000000 |           50
 stoxx_usa_50  | 2026-03-07 | 1.00000000 |           50
 euro_stoxx_50 | 2026-03-04 | 1.00000000 |           49
(12 rows)
```

Every loaded snapshot in this sample closes exactly to `1.00000000`, which is the correct PIT posture. Membership and weighting are internally consistent in the published daily surface shown here.

## Performance Tuning for Large-Scale PIT Joins

PIT logic is expensive when the query shape ignores time grain. The common `stoxx` pattern is to align a daily gold snapshot with the latest quarterly row known on or before that same daily date.

### Align quarterly rows to a daily snapshot with `LEFT JOIN LATERAL`

`LEFT JOIN LATERAL` is the PostgreSQL analogue of SQL Server `OUTER APPLY`. This query is appropriate when one daily row must find the most recent quarterly row at or before the same business date. It is triggered by daily-versus-quarterly enrichment. The query is read-only against gold. Its purpose is to perform a real as-of join instead of an ambiguous ordinary key join.

#### Join each daily score row to the latest quarterly row known on or before that date

| Field | Meaning |
|---|---|
| `score_date` | Daily PIT snapshot date. |
| `as_of_date` | Most recent quarterly row selected for that daily date. |
| `daily_score`, `quarterly_quality` | Example daily and quarterly metrics aligned on a PIT-safe boundary. |

*This query uses `LEFT JOIN LATERAL` to align each daily row with the latest known quarterly row for the same constituent.*

```sql
WITH latest_quarterly AS (
    SELECT DISTINCT ON (_index, symbol)
           _index,
           symbol,
           as_of_date,
           quality_score
    FROM gold.scores_quarterly
    ORDER BY _index, symbol, as_of_date DESC
),
latest_daily AS (
    SELECT _index,
           symbol,
           score_date,
           composite_score
    FROM gold.scores_daily
    WHERE score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
      AND _index = 'euro_stoxx_50'
)
SELECT d._index,
       d.symbol,
       d.score_date,
       q.as_of_date,
       ROUND(d.composite_score::numeric, 4) AS daily_score,
       ROUND(q.quality_score::numeric, 4) AS quarterly_quality
FROM latest_daily AS d
LEFT JOIN latest_quarterly AS q
  ON q._index = d._index
 AND q.symbol = d.symbol
ORDER BY d.symbol
LIMIT 8;
```

```text
    _index     |  symbol  | score_date | as_of_date | daily_score | quarterly_quality
---------------+----------+------------+------------+-------------+-------------------
 euro_stoxx_50 | ABI.BR   | 2026-04-08 | 2025-12-31 |      0.2948 |            0.2247
 euro_stoxx_50 | AD.AS    | 2026-04-08 | 2025-12-28 |      0.1518 |           -0.4759
 euro_stoxx_50 | ADS.DE   | 2026-04-08 | 2025-12-31 |     -0.0471 |           -0.2506
 euro_stoxx_50 | ADYEN.AS | 2026-04-08 | 2025-12-31 |      0.1478 |            0.3634
 euro_stoxx_50 | AI.PA    | 2026-04-08 | 2025-12-31 |      0.1554 |            0.0661
 euro_stoxx_50 | AIR.PA   | 2026-04-08 | 2025-12-31 |      0.0013 |           -0.5671
 euro_stoxx_50 | ALV.DE   | 2026-04-08 | 2025-12-31 |     -0.2293 |           -0.1168
 euro_stoxx_50 | ARGX.BR  | 2026-04-08 | 2025-12-31 |     -0.0719 |            0.2045
(8 rows)
```

The time predicate is the critical part. A plain key join would be ambiguous once quarterly history accumulates. PIT joins must always say which version is valid for the requested snapshot date.

### Check alignment coverage across loaded daily snapshots

This query is appropriate when the operator needs to know whether the PIT join coverage is complete or whether some daily rows currently lack a matching quarterly context. It is triggered by publication gating or reconciliation. The query is read-only. Its purpose is to turn a temporal join into a measurable pass/fail coverage check.

#### Measure quarterly alignment coverage for `euro_stoxx_50`

| Field | Meaning |
|---|---|
| `daily_rows` | Daily rows published for that snapshot date. |
| `rows_with_quarterly_match` | Rows that found a quarterly PIT match. |
| `unmatched_rows` | Daily rows still missing quarterly alignment. |

*This query checks whether every loaded Euro STOXX daily snapshot row has a matching quarterly PIT row.*

```sql
WITH aligned AS (
    SELECT d.score_date,
           COUNT(*) AS daily_rows,
           COUNT(q.as_of_date) AS rows_with_quarterly_match
    FROM gold.scores_daily AS d
    LEFT JOIN LATERAL (
        SELECT q.as_of_date
        FROM gold.scores_quarterly AS q
        WHERE q._index = d._index
          AND q.symbol = d.symbol
          AND q.as_of_date <= d.score_date
        ORDER BY q.as_of_date DESC
        LIMIT 1
    ) AS q ON true
    WHERE d._index = 'euro_stoxx_50'
    GROUP BY d.score_date
)
SELECT score_date,
       daily_rows,
       rows_with_quarterly_match,
       daily_rows - rows_with_quarterly_match AS unmatched_rows
FROM aligned
ORDER BY score_date;
```

```text
 score_date | daily_rows | rows_with_quarterly_match | unmatched_rows
------------+------------+---------------------------+----------------
 2026-03-04 |         49 |                        49 |              0
 2026-03-07 |         50 |                        50 |              0
 2026-03-12 |         50 |                        50 |              0
 2026-04-08 |         50 |                        50 |              0
(4 rows)
```

Zero unmatched rows is exactly what a PIT publication gate should demand here. If this count were non-zero, the daily score slice would be historically incomplete even if the query itself still returned rows.

### Inspect the actual index surface on the PIT join tables

The index inspection is appropriate before scaling PIT joins or diagnosing unexpectedly slow historical alignment queries. It is triggered by performance reviews and by temporal-join work. The query is read-only against `pg_indexes`. Its purpose is to show whether the current physical design already supports PIT key-and-time joins well.

#### Inspect the current index surface on `silver.index_dim`, `gold.scores_daily`, and `gold.scores_quarterly`

| Field | Meaning |
|---|---|
| `indexname` | Existing index name on the PIT join table. |
| `indexdef` | Physical definition of that index. |

*This query shows the current live index surface on the main PIT join tables.*

```sql
SELECT indexname,
       indexdef
FROM pg_indexes
WHERE schemaname IN ('silver', 'gold')
  AND tablename IN ('index_dim', 'scores_daily', 'scores_quarterly')
ORDER BY schemaname, tablename, indexname;
```

```text
       indexname       |                                      indexdef
-----------------------+-------------------------------------------------------------------------------------
 scores_daily_pkey     | CREATE UNIQUE INDEX scores_daily_pkey ON gold.scores_daily USING btree (id)
 scores_quarterly_pkey | CREATE UNIQUE INDEX scores_quarterly_pkey ON gold.scores_quarterly USING btree (id)
 index_dim_pkey        | CREATE UNIQUE INDEX index_dim_pkey ON silver.index_dim USING btree (id)
(3 rows)
```

The current live posture again shows only surrogate-key indexes. PIT joins will eventually want business-key plus date support, especially once `silver.index_dim` actually accumulates history and once gold slices grow further.

## Reconciliation Queries

PIT integrity is not complete until the historical surfaces reconcile with each other at the publication boundary.

#### Compare shared snapshot dates across `gold.scores_daily` and `gold.index_performance`

| Field | Meaning |
|---|---|
| `daily_rows` | Daily score rows published for that date. |
| `perf_rows_same_date` | Matching performance rows published on the same date for the same index. |

*This query checks whether the USA daily-score publication dates line up with same-date performance rows.*

```sql
SELECT d.score_date,
       COUNT(*) AS daily_rows,
       COUNT(p.perf_date) AS perf_rows_same_date
FROM gold.scores_daily AS d
LEFT JOIN gold.index_performance AS p
  ON p._index = d._index
 AND p.perf_date = d.score_date
WHERE d._index = 'stoxx_usa_50'
GROUP BY d.score_date
ORDER BY d.score_date;
```

```text
 score_date | daily_rows | perf_rows_same_date
------------+------------+---------------------
 2026-03-04 |         48 |                  48
 2026-03-07 |         50 |                   0
 2026-03-12 |         50 |                  50
 2026-04-08 |         50 |                   0
(4 rows)
```

This is a useful reconciliation signal, not a universal failure. A zero count can mean a real lag in the performance publisher rather than broken daily scores. PIT reconciliation matters precisely because it tells the operator which time surfaces are aligned and which ones are still intentionally or unintentionally behind.

### Production rules

- Use direct snapshot filtering when the question is about what gold published on a known date.
- Treat `silver.index_dim` as current-state reference data until it actually accumulates closed historical rows.
- Use half-open intervals and business-key uniqueness as soon as effective-dated history begins.
- Model correction audit with application-managed system-time columns or audit tables; core PostgreSQL has no direct system-versioned temporal-table feature.
- Gate PIT publication with weight closure, alignment coverage, and cross-surface reconciliation queries.

### Related notes

- [[05-postgresql-incremental-transforms]] for the bounded refresh logic that feeds PIT-safe outputs.
- [[07-postgresql-pipeline-integration-and-devex]] for the orchestration and developer workflow that turns these checks into repeatable pipeline behavior.
