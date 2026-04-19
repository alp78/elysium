---
title: "05 - PostgreSQL Incremental Transforms"
tags:
  - postgresql
  - data-engineering
  - incremental
  - medallion
aliases:
  - Incremental transforms
  - PostgreSQL watermarks
  - Overlap window loading
description: "PostgreSQL incremental pipeline patterns for the live stoxx medallion schemas: watermarks, overlap windows, deterministic deduplication, incremental aggregate refresh, cadence validation, partition attach/detach, and materialized-view tradeoffs."
parent: "[[domain-applied-postgresql-pipelines]]"
links:
  - "[[04-postgresql-gold-transforms]]"
  - "[[06-postgresql-pit-integrity-logic]]"
status: complete
---

# PostgreSQL Incremental Transforms

Incremental transforms process only the slice that is new, late, or invalidated since the previous successful publish. In PostgreSQL that means making the same three decisions as in SQL Server, but with PostgreSQL-native tools: derive the right watermark, reread a bounded overlap when lateness exists, and refresh downstream aggregates without pretending every consumer table needs a full rebuild.

> [!abstract]- Summary
>
> This note mirrors the SQL Server incremental chapter against the live PostgreSQL `stoxx` lab. The current schema already exposes a clean real-world example: `silver.signals_daily` and `gold.scores_daily` are current through `2026-04-08`, while `gold.index_performance` still stops at `2026-04-07`, which makes the aggregation watermark visible instead of hypothetical.
>
> **Live baseline**
> - measures the current source and target date ranges in silver and gold
> - quantifies the real lag between silver daily signals and gold index performance
>
> **Watermark-driven loading**
> - covers target-derived watermarks, one-day overlap windows, deterministic deduplication, and explicit change tokens for mutable sources
> - replaces SQL Server `rowversion` with the PostgreSQL-safe pattern: use a real `updated_at` or another application-managed change marker
>
> **Incremental downstream refresh**
> - covers "newer than watermark" aggregation and short sliding-window recomputation when recent history can still change
>
> **Validation and advanced strategies**
> - covers cadence checks against the trading calendar, partition attach/detach as the PostgreSQL analogue to `SWITCH`, and materialized views as the nearest analogue to indexed views
>
> **Current recommendation**
> - keeps the `stoxx` environment on target-derived watermarks plus bounded overlap and simple aggregation tables, not on heavier physical tactics

> [!note]- Glossary
>
> **Incremental transform**
> - A pipeline step that recomputes only the slices affected since the previous successful publish.
> - It matters because the operational goal is not merely "do less work" but "do less work without missing valid changes."
>
> ---
>
> **Watermark**
> - The boundary between already-published data and data that still needs processing.
> - It matters because every incremental strategy starts by deciding where to resume safely.
>
> ---
>
> **Overlap window**
> - A deliberate reread of some already-processed recent slice so late or corrected rows still enter the pipeline.
> - It matters because monotonic `MAX(date)` logic alone fails as soon as valid rows can arrive late.
>
> ---
>
> **Deterministic deduplication**
> - A stable rule that chooses one surviving row when a reread slice contains duplicates or corrected copies.
> - It matters because overlap windows are safe only if the winner is chosen predictably.
>
> ---
>
> **Invalidated slice**
> - A previously published range that must be recomputed because later information proved the old output incomplete or wrong.
> - It matters because incremental work often needs to move backward in time, not only forward.
>
> ---
>
> **Cadence validation**
> - A check that expected business dates or market dates are present with no suspicious gaps.
> - It matters because a recent max date can still hide missing intermediate periods.
>
> ---
>
> **Partition-aligned replacement**
> - A strategy that replaces one whole partitioned slice instead of merging individual rows.
> - It matters because it is the heavier operational alternative when simpler watermark logic becomes insufficient.

## Live Baseline

Incremental design starts with real boundaries, not with theory. The current lab already exposes a useful split between fully current daily scores and a slightly lagging downstream aggregate.

### Measure the live date coverage of the main source and target datasets

| Field | Meaning |
|---|---|
| `dataset` | Pipeline dataset being inspected. |
| `min_date`, `max_date` | Current business-date coverage of that dataset. |
| `row_count` | Current row volume in that dataset. |

*This query shows the current date coverage and size of the main silver and gold datasets involved in incremental publishing.*

```sql
SELECT 'silver.signals_daily' AS dataset,
       MIN(signal_date) AS min_date,
       MAX(signal_date) AS max_date,
       COUNT(*) AS row_count
FROM silver.signals_daily
UNION ALL
SELECT 'gold.scores_daily',
       MIN(score_date),
       MAX(score_date),
       COUNT(*)
FROM gold.scores_daily
UNION ALL
SELECT 'silver.stoxxusa50_ohlcv',
       MIN(date),
       MAX(date),
       COUNT(*)
FROM silver.stoxxusa50_ohlcv
WHERE NOT is_filled
UNION ALL
SELECT 'gold.index_performance',
       MIN(perf_date),
       MAX(perf_date),
       COUNT(*)
FROM gold.index_performance
ORDER BY dataset;
```

```text
         dataset         |  min_date  |  max_date  | row_count
-------------------------+------------+------------+-----------
 gold.index_performance  | 2021-01-05 | 2026-04-07 |      5351
 gold.scores_daily       | 2026-03-04 | 2026-04-08 |       635
 silver.signals_daily    | 2026-03-04 | 2026-04-08 |       635
 silver.stoxxusa50_ohlcv | 2021-01-04 | 2026-04-07 |     66000
(4 rows)
```

This is already enough to drive a design choice. `gold.scores_daily` is current through the same date as `silver.signals_daily`, so a daily full-slice replace is fine there. `gold.index_performance` stops one day earlier, so it is a real incremental target rather than a toy example.

### Quantify the current silver-to-gold freshness gap

The next query is appropriate when an operator needs to know whether downstream aggregates are actually behind their silver inputs and by how much. It is triggered by routine monitoring, by a late-run incident, or before implementing an incremental aggregate refresh. The query is read-only against silver and gold. Its purpose is to turn "gold feels behind" into a concrete by-index gap measurement.

#### Measure the current lag between `silver.signals_daily` and `gold.index_performance`

| Field | Meaning |
|---|---|
| `silver_max_signal_date` | Latest daily source date per index. |
| `max_perf_date` | Latest published performance date per index. |
| `silver_rows_newer_than_gold_perf` | Count of silver rows beyond the current gold watermark. |

*This query shows the live lag between silver daily signals and gold index performance by index.*

```sql
SELECT s._index,
       MAX(s.signal_date) AS silver_max_signal_date,
       g.max_perf_date,
       SUM(CASE WHEN s.signal_date > g.max_perf_date THEN 1 ELSE 0 END) AS silver_rows_newer_than_gold_perf
FROM silver.signals_daily AS s
JOIN (
    SELECT _index, MAX(perf_date) AS max_perf_date
    FROM gold.index_performance
    GROUP BY _index
) AS g
  ON g._index = s._index
GROUP BY s._index, g.max_perf_date
ORDER BY s._index;
```

```text
    _index     | silver_max_signal_date | max_perf_date | silver_rows_newer_than_gold_perf
---------------+------------------------+---------------+----------------------------------
 euro_stoxx_50 | 2026-04-08             | 2026-04-07    |                               50
 oil_20        | 2026-04-08             | 2026-04-07    |                               19
 stoxx_asia_50 | 2026-04-08             | 2026-04-07    |                               50
 stoxx_usa_50  | 2026-04-08             | 2026-04-07    |                               50
(4 rows)
```

Every index currently has one newer silver date waiting beyond the gold performance watermark. That is the ideal incremental case: publish the missing slice, not five years of history.

## Watermark-Driven Incremental Loads

The safest default is to derive the watermark from the target that actually represents published truth. When lateness exists, reread a small overlap window and deduplicate deterministically before writing.

### Derive the overlap window from the current target watermark

This query is appropriate when an operator needs to convert a current target watermark into a reread boundary that tolerates late arrivals. It is triggered before an incremental publish starts. The query is read-only. Its purpose is to show how much source data a one-day overlap would reread per index today.

#### Compute a one-day overlap window from `gold.index_performance`

| Field | Meaning |
|---|---|
| `current_perf_watermark` | Latest currently published performance date per index. |
| `overlap_start_date` | Reread boundary chosen as one day before the watermark. |
| `silver_rows_in_overlap` | Number of silver rows that would be reconsidered under that overlap rule. |

*This query derives a one-day overlap window from the current gold performance watermark.*

```sql
WITH watermark AS (
    SELECT _index,
           MAX(perf_date) AS current_perf_watermark,
           MAX(perf_date) - 1 AS overlap_start_date
    FROM gold.index_performance
    GROUP BY _index
)
SELECT w._index,
       w.current_perf_watermark,
       w.overlap_start_date,
       COUNT(*) FILTER (WHERE s.signal_date >= w.overlap_start_date) AS silver_rows_in_overlap
FROM watermark AS w
JOIN silver.signals_daily AS s
  ON s._index = w._index
GROUP BY w._index, w.current_perf_watermark, w.overlap_start_date
ORDER BY w._index;
```

```text
    _index     | current_perf_watermark | overlap_start_date | silver_rows_in_overlap
---------------+------------------------+--------------------+------------------------
 euro_stoxx_50 | 2026-04-07             | 2026-04-06         |                     50
 oil_20        | 2026-04-07             | 2026-04-06         |                     19
 stoxx_asia_50 | 2026-04-07             | 2026-04-06         |                     50
 stoxx_usa_50  | 2026-04-07             | 2026-04-06         |                     50
(4 rows)
```

The overlap is intentionally small because the current lag is small. That is the right operational posture: start with the smallest reread window that absorbs observed lateness, then widen only when real corrections prove it necessary.

### Deduplicate reread slices before publish

The dedup step is appropriate whenever an overlap window or mutable source can surface more than one candidate row for the same business key. It is triggered before the target insert or upsert. The transaction below is state-changing only inside a scratch scope. Its purpose is to show the stable tie-break rule: choose the newest raw event per business key and date.

#### Deduplicate a reread daily snapshot with `ROW_NUMBER()`

| Field | Meaning |
|---|---|
| `source_ts` | Raw arrival or event timestamp used as the tie-breaker. |
| `current_price` | Example mutable value that differs between duplicate candidates. |

*This transaction keeps only the latest raw row for each `(_index, symbol, signal_date)` key.*

```sql
BEGIN;

CREATE TEMP TABLE note05_bronze_daily_demo (
    _index text NOT NULL,
    symbol text NOT NULL,
    signal_date date NOT NULL,
    source_ts timestamp NOT NULL,
    current_price double precision NOT NULL
);

INSERT INTO note05_bronze_daily_demo (_index, symbol, signal_date, source_ts, current_price)
VALUES
    ('stoxx_usa_50', 'AAPL', DATE '2026-04-08', '2026-04-08 08:00:00', 200.00),
    ('stoxx_usa_50', 'AAPL', DATE '2026-04-08', '2026-04-08 09:30:00', 201.25),
    ('stoxx_usa_50', 'MSFT', DATE '2026-04-08', '2026-04-08 08:15:00', 300.50);

SELECT _index,
       symbol,
       signal_date,
       source_ts,
       current_price
FROM (
    SELECT _index,
           symbol,
           signal_date,
           source_ts,
           current_price,
           ROW_NUMBER() OVER (
               PARTITION BY _index, symbol, signal_date
               ORDER BY source_ts DESC
           ) AS rn
    FROM note05_bronze_daily_demo
) AS ranked
WHERE rn = 1
ORDER BY symbol;

ROLLBACK;
```

```text
BEGIN
CREATE TABLE
INSERT 0 3
    _index    | symbol | signal_date |      source_ts      | current_price
--------------+--------+-------------+---------------------+---------------
 stoxx_usa_50 | AAPL   | 2026-04-08  | 2026-04-08 09:30:00 |        201.25
 stoxx_usa_50 | MSFT   | 2026-04-08  | 2026-04-08 08:15:00 |         300.5
(2 rows)

ROLLBACK
```

This is what makes an overlap window safe. Reread the slice on purpose, then make one deterministic winner row survive before the target write happens.

### Use an explicit change token when a mutable source cannot trust a date watermark

SQL Server's `rowversion` does not have a direct PostgreSQL equivalent suitable as a durable cross-run pipeline boundary. PostgreSQL exposes system columns such as `xmin`, but those are MVCC implementation details, not a stable application contract. The reliable PostgreSQL pattern is to persist a real change token such as `updated_at`, a monotonic ingest timestamp, or a source-side change table.

#### Read a mutable source with an explicit `updated_at` watermark

| Field | Meaning |
|---|---|
| `updated_at` | Application-managed change timestamp used as the incremental boundary. |
| `payload` | Example mutable column showing the newer version of the row. |

*This transaction shows the PostgreSQL-safe replacement for a `rowversion` boundary: read rows newer than the last committed `updated_at` watermark.*

```sql
BEGIN;

CREATE TEMP TABLE note05_mutable_source_demo (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    business_key text NOT NULL,
    payload text NOT NULL,
    updated_at timestamp NOT NULL
);

INSERT INTO note05_mutable_source_demo (business_key, payload, updated_at)
VALUES
    ('alpha', 'v1', '2026-04-08 08:00:00'),
    ('beta',  'v1', '2026-04-08 08:05:00'),
    ('alpha', 'v2', '2026-04-08 09:15:00');

SELECT business_key,
       payload,
       updated_at
FROM note05_mutable_source_demo
WHERE updated_at > TIMESTAMP '2026-04-08 08:30:00'
ORDER BY updated_at;

ROLLBACK;
```

```text
BEGIN
CREATE TABLE
INSERT 0 3
 business_key | payload |     updated_at
--------------+---------+---------------------
 alpha        | v2      | 2026-04-08 09:15:00
(1 row)

ROLLBACK
```

The important point is architectural, not syntactic: PostgreSQL pipelines should not treat MVCC internals as a business change token. If the source is mutable, store an explicit boundary column or capture changes through logical decoding or application-side CDC.

### Collapse wide-row comparisons with a stable hash signature

The hash-signature pattern is appropriate when a transform must compare many columns and the expensive part is not reading the rows but deciding whether anything materially changed. It is triggered by dimension-style comparisons where wide attribute lists would otherwise create noisy SQL. The transaction below is state-changing only in a scratch scope. Its purpose is to show how PostgreSQL can collapse a wide-row comparison into a single signature check.

#### Compare two row versions with one MD5 signature

| Field | Meaning |
|---|---|
| `source_name` | Which side of the comparison the row came from. |
| `row_signature` | Stable hash across the selected business columns. |

*This transaction hashes bronze and silver-style rows so a change becomes a simple signature mismatch.*

```sql
BEGIN;

CREATE TEMP TABLE note05_hash_demo (
    source_name text NOT NULL,
    _index text NOT NULL,
    symbol text NOT NULL,
    sector text,
    country text
);

INSERT INTO note05_hash_demo (source_name, _index, symbol, sector, country)
VALUES
    ('bronze', 'stoxx_usa_50', 'AAPL', 'Technology', 'United States'),
    ('silver', 'stoxx_usa_50', 'AAPL', 'Technology', 'United States'),
    ('bronze', 'stoxx_usa_50', 'MSFT', 'Technology', 'United States'),
    ('silver', 'stoxx_usa_50', 'MSFT', 'AI Infrastructure', 'United States');

SELECT source_name,
       _index,
       symbol,
       md5(concat_ws('|', coalesce(_index, ''), coalesce(symbol, ''), coalesce(sector, ''), coalesce(country, ''))) AS row_signature
FROM note05_hash_demo
ORDER BY symbol, source_name;

ROLLBACK;
```

```text
BEGIN
CREATE TABLE
INSERT 0 4
 source_name |    _index    | symbol |          row_signature
-------------+--------------+--------+----------------------------------
 bronze      | stoxx_usa_50 | AAPL   | 82ef50b348641d4f564d770920af260a
 silver      | stoxx_usa_50 | AAPL   | 82ef50b348641d4f564d770920af260a
 bronze      | stoxx_usa_50 | MSFT   | fd35dc7f0f4c0bcbe504e819c5a00bf4
 silver      | stoxx_usa_50 | MSFT   | e848d4607a9571c89fdd110f4d6a051b
(4 rows)

ROLLBACK
```

`AAPL` matches because the selected attributes are identical on both sides. `MSFT` differs because one attribute changed, so the signatures diverge. This is the PostgreSQL equivalent of using a stable comparison signature to reduce wide-row diff logic.

## Incremental Aggregation Refresh

Aggregates inherit upstream lateness. A safe incremental aggregate strategy must answer two questions: which brand-new dates need processing, and how much recent history must be recomputed when corrections can revise recent slices.

### Aggregate only the dates newer than the current gold watermark

This query is appropriate when the downstream aggregate is strictly append-forward or when a first pass wants to see the minimal new slice before any overlap is considered. It is triggered by the current gold watermark. The query is read-only against silver and gold. Its purpose is to show exactly which silver dates are newer than the existing gold performance output.

#### Find the silver dates that are newer than `gold.index_performance`

| Field | Meaning |
|---|---|
| `signal_date` | Source date beyond the current gold watermark. |
| `rows_to_process` | Number of silver rows that would feed the incremental aggregate for that date. |

*This query returns only the silver dates that sit beyond the current gold performance watermark.*

```sql
WITH gold_watermark AS (
    SELECT _index,
           MAX(perf_date) AS max_perf_date
    FROM gold.index_performance
    GROUP BY _index
)
SELECT s._index,
       s.signal_date,
       COUNT(*) AS rows_to_process
FROM silver.signals_daily AS s
JOIN gold_watermark AS g
  ON g._index = s._index
WHERE s.signal_date > g.max_perf_date
GROUP BY s._index, s.signal_date
ORDER BY s._index, s.signal_date;
```

```text
    _index     | signal_date | rows_to_process
---------------+-------------+-----------------
 euro_stoxx_50 | 2026-04-08  |              50
 oil_20        | 2026-04-08  |              19
 stoxx_asia_50 | 2026-04-08  |              50
 stoxx_usa_50  | 2026-04-08  |              50
(4 rows)
```

This is the cleanest possible incremental aggregate case: one missing date, one batch of source rows per index, no need to touch older history unless late corrections exist.

### Recompute a short sliding window when recent history can still change

The sliding-window query is appropriate when recent dates can still be revised by late arrivals or corrected weights. It is triggered by known source lateness or by a conservative operational choice to reread a recent band. The query is read-only against the live gold table. Its purpose is to show the kind of recent window a rolling refresh would touch.

#### Inspect the recent performance window that would be eligible for recompute

| Field | Meaning |
|---|---|
| `daily_return_pct` | Daily return already published for the recent window. |
| `cumulative_return_pct` | Current cumulative return through that date. |

*This query shows the recent index-performance rows that a short sliding-window refresh would revisit.*

```sql
SELECT _index,
       perf_date,
       ROUND((100 * daily_return)::numeric, 4) AS daily_return_pct,
       ROUND((100 * (cumulative_factor - 1))::numeric, 4) AS cumulative_return_pct
FROM gold.index_performance
WHERE perf_date >= DATE '2026-04-01'
ORDER BY _index, perf_date DESC
LIMIT 12;
```

```text
    _index     | perf_date  | daily_return_pct | cumulative_return_pct
---------------+------------+------------------+-----------------------
 euro_stoxx_50 | 2026-04-07 |          -0.7931 |               97.5476
 euro_stoxx_50 | 2026-04-02 |          -0.4797 |               99.1270
 euro_stoxx_50 | 2026-04-01 |           2.4924 |              100.0867
 oil_20        | 2026-04-07 |           0.6887 |              215.8942
 oil_20        | 2026-04-06 |           0.3619 |              213.7335
 oil_20        | 2026-04-02 |           1.0636 |              212.6021
 oil_20        | 2026-04-01 |          -2.6515 |              209.3124
 stoxx_asia_50 | 2026-04-07 |           0.5919 |               95.6358
 stoxx_asia_50 | 2026-04-06 |          -0.0408 |               94.4847
 stoxx_asia_50 | 2026-04-03 |           0.8319 |               94.5641
 stoxx_asia_50 | 2026-04-02 |          -1.3068 |               92.9588
 stoxx_asia_50 | 2026-04-01 |           3.7944 |               95.5137
(12 rows)
```

A short sliding window is the right compromise when new information can revise recent history but full-history recomputation would be wasteful. The window length should be driven by observed lateness, not by guesswork.

## Window Functions on Incremental Datasets

Incremental pipelines often still need full-partition window functions. The operational question is not whether window functions are allowed, but whether the source table has the right ordering support and whether the reread scope is bounded sensibly.

### Inspect the current window-supporting index posture

This query is appropriate before scaling any rolling analytics on OHLCV history. It is triggered by moving-average, lag, or volatility calculations that depend on efficient `(symbol, date)` ordering. The query is read-only against `pg_indexes`. Its purpose is to show whether the current live table already carries the supporting index.

#### Inspect the live index posture on `silver.eurostoxx50_ohlcv`

| Field | Meaning |
|---|---|
| `indexname` | Existing index name on the table. |
| `indexdef` | Physical definition of that index. |

*This query shows the current index posture on the live Euro STOXX OHLCV table.*

```sql
SELECT indexname,
       indexdef
FROM pg_indexes
WHERE schemaname = 'silver'
  AND tablename = 'eurostoxx50_ohlcv'
ORDER BY indexname;
```

```text
       indexname        |                                        indexdef
------------------------+-----------------------------------------------------------------------------------------
 eurostoxx50_ohlcv_pkey | CREATE UNIQUE INDEX eurostoxx50_ohlcv_pkey ON silver.eurostoxx50_ohlcv USING btree (id)
(1 row)
```

The live table currently lacks the ideal `(symbol, date)` support index. That does not stop the query from working, but it does mean larger rolling-window workloads will depend more heavily on sequential scans and sorting than they should.

#### Compute 30-day and 90-day moving averages on the live OHLCV history

| Field | Meaning |
|---|---|
| `sma_30_close`, `sma_90_close` | Rolling average closes over 30 and 90 rows. |

*This query computes live rolling averages for `ASML.AS` from the Euro STOXX OHLCV history.*

```sql
WITH price_window AS (
    SELECT symbol,
           date,
           close,
           AVG(close) OVER (
               PARTITION BY symbol
               ORDER BY date
               ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
           ) AS sma_30_close,
           AVG(close) OVER (
               PARTITION BY symbol
               ORDER BY date
               ROWS BETWEEN 89 PRECEDING AND CURRENT ROW
           ) AS sma_90_close
    FROM silver.eurostoxx50_ohlcv
    WHERE symbol = 'ASML.AS'
)
SELECT symbol,
       date,
       close,
       ROUND(sma_30_close::numeric, 4) AS sma_30_close,
       ROUND(sma_90_close::numeric, 4) AS sma_90_close
FROM price_window
ORDER BY date DESC
LIMIT 5;
```

```text
 symbol  |    date    | close  | sma_30_close | sma_90_close
---------+------------+--------+--------------+--------------
 ASML.AS | 2026-04-07 | 1113.8 |    1185.4000 |    1103.3656
 ASML.AS | 2026-04-02 |   1161 |    1190.1267 |    1100.5489
 ASML.AS | 2026-04-01 | 1187.6 |    1192.7000 |    1097.1911
 ASML.AS | 2026-03-31 | 1119.2 |    1194.6067 |    1093.2622
 ASML.AS | 2026-03-30 |   1112 |    1197.2733 |    1090.7133
(5 rows)
```

## Gap Detection And Cadence Validation

Fresh incremental logic still needs completeness checks. Dense market-history datasets should be validated against an expected calendar. Sparse snapshot feeds should not be judged by dense-series rules.

### Validate a dense market-history series against the trading calendar

The trading-calendar check is appropriate when a market-history table is supposed to be dense on trading days. It is triggered by freshness reviews, missing-data incidents, or after a gap-fill run. The query is read-only against the live trading calendar and OHLCV table. Its purpose is to prove whether the recent market series for one symbol is missing any expected trading dates.

#### Verify that `ASML.AS` has no missing Amsterdam trading days in the recent window

| Field | Meaning |
|---|---|
| `missing_trading_days` | Count of expected Amsterdam trading days with no real OHLCV row. |
| `first_missing_day`, `last_missing_day` | Bounds of the missing range if any gaps exist. |

*This query checks the recent `ASML.AS` series against the Amsterdam trading calendar.*

```sql
WITH expected_days AS (
    SELECT date
    FROM bronze.trading_calendar
    WHERE exchange_code = 'AMS'
      AND is_trading_day
      AND date BETWEEN DATE '2026-02-01' AND DATE '2026-04-07'
),
missing_days AS (
    SELECT e.date
    FROM expected_days AS e
    WHERE NOT EXISTS (
        SELECT 1
        FROM silver.eurostoxx50_ohlcv AS o
        WHERE o.symbol = 'ASML.AS'
          AND o.date = e.date
          AND NOT o.is_filled
    )
)
SELECT COUNT(*) AS missing_trading_days,
       MIN(date) AS first_missing_day,
       MAX(date) AS last_missing_day
FROM missing_days;
```

```text
 missing_trading_days | first_missing_day | last_missing_day
----------------------+-------------------+------------------
                    0 |                   |
(1 row)
```

`0` is the healthy answer for a dense market-history table. A sparse snapshot feed would not be expected to pass this test, which is why cadence validation must respect the source contract.

### Measure sparse-cadence gaps before calling them defects

The sparse-cadence query is appropriate for snapshot-style feeds such as `silver.signals_daily`, where rows arrive on selected dates rather than on every market day. It is triggered by a need to understand whether large date jumps are expected or suspicious. The query is read-only. Its purpose is to measure the observed gaps rather than assuming dense cadence.

#### Measure date jumps inside `silver.signals_daily`

| Field | Meaning |
|---|---|
| `gap_days` | Number of days since the previous published signal for that stock. |

*This query surfaces the largest observed date jumps in the live silver daily-signal history.*

```sql
WITH daily_marks AS (
    SELECT _index,
           symbol,
           signal_date,
           signal_date - LAG(signal_date) OVER (PARTITION BY _index, symbol ORDER BY signal_date) AS gap_days
    FROM silver.signals_daily
)
SELECT _index,
       symbol,
       signal_date,
       gap_days
FROM daily_marks
WHERE gap_days IS NOT NULL
ORDER BY gap_days DESC, _index, symbol
LIMIT 10;
```

```text
    _index     |  symbol  | signal_date | gap_days
---------------+----------+-------------+----------
 euro_stoxx_50 | ABI.BR   | 2026-04-08  |       27
 euro_stoxx_50 | AD.AS    | 2026-04-08  |       27
 euro_stoxx_50 | ADS.DE   | 2026-04-08  |       27
 euro_stoxx_50 | ADYEN.AS | 2026-04-08  |       27
 euro_stoxx_50 | AI.PA    | 2026-04-08  |       27
 euro_stoxx_50 | AIR.PA   | 2026-04-08  |       27
 euro_stoxx_50 | ALV.DE   | 2026-04-08  |       27
 euro_stoxx_50 | ARGX.BR  | 2026-04-08  |       27
 euro_stoxx_50 | ASML.AS  | 2026-04-08  |       27
 euro_stoxx_50 | BAS.DE   | 2026-04-08  |       27
(10 rows)
```

This is exactly why cadence validation must start from the source contract. A 27-day jump would be alarming for OHLCV, but it is simply the current publication cadence of this snapshot-style signal history.

## Partition-Aligned Replacement

SQL Server's `ALTER TABLE ... SWITCH` does not exist in PostgreSQL. The nearest operational analogue is declarative partitioning plus `DETACH PARTITION` and `ATTACH PARTITION`, usually after validating a staging table that already matches the target partition boundary.

#### Replace one partition with `DETACH` and `ATTACH`

| Field | Meaning |
|---|---|
| `partition_name` | Physical partition now serving the target date range. |
| `daily_return` | Values visible after the partition replacement. |

*This transaction swaps a monthly partition by detaching the old partition and attaching a validated staging table in its place.*

```sql
BEGIN;

CREATE TEMP TABLE note05_partitioned_target (
    _index text NOT NULL,
    perf_date date NOT NULL,
    daily_return double precision NOT NULL
) PARTITION BY RANGE (perf_date);

CREATE TEMP TABLE note05_target_2026_04 PARTITION OF note05_partitioned_target
FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TEMP TABLE note05_stage_2026_04 (
    LIKE note05_partitioned_target INCLUDING ALL
);

INSERT INTO note05_target_2026_04 (_index, perf_date, daily_return)
VALUES ('stoxx_usa_50', DATE '2026-04-02', 0.0010);

INSERT INTO note05_stage_2026_04 (_index, perf_date, daily_return)
VALUES
    ('stoxx_usa_50', DATE '2026-04-02', 0.0015),
    ('stoxx_usa_50', DATE '2026-04-03', 0.0020);

ALTER TABLE note05_partitioned_target DETACH PARTITION note05_target_2026_04;
ALTER TABLE note05_partitioned_target ATTACH PARTITION note05_stage_2026_04
FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

SELECT tableoid::regclass AS partition_name,
       _index,
       perf_date,
       daily_return
FROM note05_partitioned_target
ORDER BY perf_date;

ROLLBACK;
```

```text
BEGIN
CREATE TABLE
CREATE TABLE
CREATE TABLE
INSERT 0 1
INSERT 0 2
ALTER TABLE
ALTER TABLE
    partition_name    |    _index    | perf_date  | daily_return
----------------------+--------------+------------+--------------
 note05_stage_2026_04 | stoxx_usa_50 | 2026-04-02 |       0.0015
 note05_stage_2026_04 | stoxx_usa_50 | 2026-04-03 |        0.002
(2 rows)

ROLLBACK
```

This is powerful, but it is heavier than the current `stoxx` workload needs. Use it only when a simple watermark or sliding-window refresh has already proven insufficient.

## Materialized Views Vs Aggregation Tables

PostgreSQL does not have SQL Server indexed views. The closest analogue is a materialized view, but it is still a different operational tradeoff: materialized views are refreshed explicitly, not maintained on every base-table write.

#### Refresh a materialized view after the base aggregate changes

| Field | Meaning |
|---|---|
| `avg_daily_return` | Materialized aggregate visible after refresh. |

*This transaction shows the PostgreSQL analogue to a small precomputed aggregate: a materialized view that is refreshed explicitly after the base table changes.*

```sql
BEGIN;

CREATE TABLE note05_sales_demo (
    perf_date date NOT NULL,
    daily_return double precision NOT NULL
);

INSERT INTO note05_sales_demo (perf_date, daily_return)
VALUES
    (DATE '2026-04-06', 0.0010),
    (DATE '2026-04-07', 0.0020);

CREATE MATERIALIZED VIEW note05_mv_demo AS
SELECT perf_date,
       AVG(daily_return) AS avg_daily_return
FROM note05_sales_demo
GROUP BY perf_date;

INSERT INTO note05_sales_demo (perf_date, daily_return)
VALUES (DATE '2026-04-07', 0.0040);

REFRESH MATERIALIZED VIEW note05_mv_demo;

SELECT perf_date,
       avg_daily_return
FROM note05_mv_demo
ORDER BY perf_date;

ROLLBACK;
```

```text
BEGIN
CREATE TABLE
INSERT 0 2
SELECT 2
INSERT 0 1
REFRESH MATERIALIZED VIEW
 perf_date  | avg_daily_return
------------+------------------
 2026-04-06 |            0.001
 2026-04-07 |            0.003
(2 rows)

ROLLBACK
```

Aggregation tables remain the better default for write-heavy pipeline flows because they keep the refresh boundary explicit and easy to reason about. Materialized views are useful only when the aggregate is small, stable, and operationally worth refreshing as its own object.

## Decision Guide

| Situation | PostgreSQL-first choice | Why |
|---|---|---|
| Target has a reliable published date | Derive watermark from the target | Simplest and hardest to desynchronize. |
| Source can arrive late | Add a bounded overlap window | Safer than pretending the source is perfectly forward-only. |
| Overlap can surface duplicates | Deduplicate with a stable tie-breaker | Keeps reruns reproducible. |
| Mutable source cannot trust a date watermark | Use explicit `updated_at` or CDC | No durable `rowversion` equivalent exists in PostgreSQL. |
| Aggregate is one date behind | Process only newer dates first | Lowest-cost incremental fix. |
| Recent history can still change | Recompute a short sliding window | Handles invalidated slices without full-history rebuilds. |
| One whole slice must be replaced atomically | Consider partition attach/detach | Heavier but clean when physical design is aligned. |
| Readers need a small precomputed aggregate | Consider a materialized view sparingly | PostgreSQL alternative to an indexed view, but with explicit refresh cost. |

## Anti-Patterns

- Advancing the stored watermark before the target commit succeeds.
- Using an overlap window without deterministic deduplication.
- Treating sparse snapshot feeds as if every missing calendar day were a defect.
- Running large rolling windows on OHLCV history without a supporting `(symbol, date)` index.
- Recomputing full-history aggregates when only one recent date changed.
- Reaching for partition attach/detach before a simpler watermark or sliding-window strategy has failed in production.

## Current Recommendation For `stoxx`

The current PostgreSQL fit is still the simple one. Derive daily and performance boundaries from the gold targets, reread a small overlap only where lateness is plausible, deduplicate deterministically, and keep aggregates in ordinary tables rather than in heavier physical structures. The live lab does not yet justify partition attach/detach or materialized-view-first design, but it does justify adding the missing business-key and window-supporting indexes before the workload grows.

### Related notes

- [[04-postgresql-gold-transforms]] for the gold tables that currently expose the live watermark lag.
- [[06-postgresql-pit-integrity-logic]] for the next layer of historical correctness once incremental movement is in place.
