---
title: "04 - Gold Transforms"
tags:
  - postgresql
  - data-engineering
  - etl
  - medallion
aliases:
  - PostgreSQL gold layer
  - Gold transforms
  - PostgreSQL scoring tables
description: "PostgreSQL gold-layer patterns for the live stoxx medallion pipeline: refreshable consumer tables, factor-score logic, cap-weighted index performance, and dashboard-facing queries."
parent: "[[domain-applied-postgresql-pipelines]]"
links:
  - "[[03-postgresql-silver-transforms]]"
  - "[[05-postgresql-incremental-transforms]]"
status: complete
---

# Gold Transforms

Gold is the consumer contract of the PostgreSQL pipeline. Nothing in this layer should require the dashboard, API, or downstream analyst to reconstruct core business logic from silver. The goal is to publish already-scored, already-ranked, and already-aggregated outputs that can be read directly and refreshed safely.

> [!abstract]- Summary
>
> This note mirrors the SQL Server gold chapter against the live PostgreSQL `stoxx` lab. The gold schema already contains real daily scores, quarterly scores, and index-performance history, so the note can show both the live consumer tables and the PostgreSQL-native refresh patterns that should protect them.
>
> **Gold contract**
> - inventories the live gold tables, row counts, and index posture
> - makes the current migration gap explicit: the populated gold tables still expose only surrogate-key indexes, so business-key uniqueness is a design requirement rather than an enforced fact today
>
> **Scoring logic**
> - shows how PostgreSQL window functions can reproduce sector-relative z-scores
> - documents the stored quality, health-flag, and governance outputs already present in `gold.scores_quarterly`
>
> **Refresh logic**
> - covers latest-date anchoring, silver joins, moving-average calculations, and delete-plus-insert refresh windows for daily scores and index performance
>
> **Consumer layer**
> - demonstrates the exact kinds of queries a dashboard or API can run directly against gold without rebuilding the scoring logic
>
> **Operational posture**
> - closes with freshness checks and bounded cleanup patterns for future-dated rows

> [!note]- Glossary
>
> **Gold layer**
> - The consumer-facing layer where metrics, scores, ranks, and aggregates are stored in presentation-ready form.
> - It matters because schema drift or refresh mistakes in gold become visible to users immediately.
>
> ---
>
> **Presentation contract**
> - The promise that a gold table will keep exposing stable columns, stable semantics, and current enough data for downstream consumers.
> - It matters because breaking a gold contract usually breaks dashboards, not only internal batch jobs.
>
> ---
>
> **Factor score**
> - A derived metric summarizing one analytical theme such as value, momentum, quality, or sentiment.
> - It matters because gold compresses many raw silver attributes into a smaller set of dashboard-friendly signals.
>
> ---
>
> **Z-score**
> - A normalized measure that expresses how far a value sits above or below the peer-group mean in standard deviations.
> - It matters because gold uses relative scoring rather than raw-value comparisons for many signals.
>
> ---
>
> **Refresh window**
> - The explicit slice of gold data that is deleted and recomputed on each run.
> - It matters because idempotent gold publishing depends on replacing a known boundary rather than appending blindly.
>
> ---
>
> **Cap-weighted return**
> - An aggregate return where each constituent's contribution is weighted by market capitalization.
> - It matters because the index-performance table is meant to behave like a portfolio surface rather than like a simple equal-weight average.
>
> ---
>
> **Consumer query**
> - A query shaped to be returned directly to a dashboard, chart, or API with little or no further transformation.
> - It matters because gold is supposed to remove read-time complexity from consumers.

## Gold Table DDL

Gold tables are denormalized on purpose. They trade some refresh cost for much simpler reads. In PostgreSQL the physical contract should be simple: one unique business key per consumer grain and bounded refresh windows that can be rerun without drift.

### Live gold surface

This inventory query is appropriate during migration review, first consumer onboarding, or any gold-layer incident where the operator needs to confirm what tables exist and how much data they currently hold. It is read-only against `information_schema` and `pg_stat_user_tables`. Its purpose is to establish the live consumer surface before discussing scoring logic.

#### Inspect the current gold tables and row counts

| Field | Meaning |
|---|---|
| `table_name` | Gold table name. |
| `approx_rows` | Approximate live row count from `pg_stat_user_tables.n_live_tup`. |

*This query inventories the current gold tables and their approximate row volumes.*

```sql
SELECT relname AS table_name,
       n_live_tup AS approx_rows
FROM pg_stat_user_tables
WHERE schemaname = 'gold'
ORDER BY relname;
```

```text
    table_name     | approx_rows
-------------------+-------------
 index_performance |        5351
 scores_daily      |         635
 scores_quarterly  |         176
(3 rows)
```

The current gold surface is compact and clearly consumer-oriented: one table for daily cross-sectional scores, one for quarterly quality and governance outputs, and one for time-series index performance.

The next check matters because a consumer table is only idempotent if PostgreSQL can enforce its business grain. It is triggered during DDL review or after any migration that touched indexes. The query is read-only against `pg_indexes`. Its purpose is to show whether gold currently enforces consumer business keys or only surrogate IDs.

#### Inspect the current gold index posture

| Field | Meaning |
|---|---|
| `tablename` | Gold table owning the index. |
| `indexname` | Index name. |
| `indexdef` | Full PostgreSQL index definition. |

*This query shows every live gold index currently defined in PostgreSQL.*

```sql
SELECT tablename,
       indexname,
       indexdef
FROM pg_indexes
WHERE schemaname = 'gold'
ORDER BY tablename, indexname;
```

```text
     tablename     |       indexname        |                                       indexdef
-------------------+------------------------+---------------------------------------------------------------------------------------
 index_performance | index_performance_pkey | CREATE UNIQUE INDEX index_performance_pkey ON gold.index_performance USING btree (id)
 scores_daily      | scores_daily_pkey      | CREATE UNIQUE INDEX scores_daily_pkey ON gold.scores_daily USING btree (id)
 scores_quarterly  | scores_quarterly_pkey  | CREATE UNIQUE INDEX scores_quarterly_pkey ON gold.scores_quarterly USING btree (id)
(3 rows)
```

As in silver, the migrated lab currently exposes only primary-key indexes. The business grains are distinct in the data today, but PostgreSQL is not yet enforcing `(_index, symbol, score_date)`, `(_index, symbol, as_of_date)`, or `(_index, perf_date)` at the table level. Gold should not depend on "the current data happens to be clean."

The business-grain validation query is appropriate whenever the operator needs to prove that the current contents are still unique by consumer key even if the physical constraint is missing. It is triggered by migration audits, suspicious duplicate outputs, or before adding the missing indexes. The query is read-only. Its purpose is to compare current row counts with business-key distinct counts and to capture the latest published date per table.

#### Compare live row counts with gold business keys

| Field | Meaning |
|---|---|
| `total_rows` | Total rows currently stored in the gold table. |
| `distinct_business_keys` | Distinct rows at the intended business grain. |
| `latest_*_date` | Most recent published consumer date in that table. |

*This query proves that the current gold tables are unique by business key today, even though the unique indexes are not yet present.*

```sql
SELECT COUNT(*) AS total_rows,
       COUNT(DISTINCT (_index, symbol, score_date)) AS distinct_business_keys,
       MAX(score_date) AS latest_score_date
FROM gold.scores_daily;

SELECT COUNT(*) AS total_rows,
       COUNT(DISTINCT (_index, symbol, as_of_date)) AS distinct_business_keys,
       MAX(as_of_date) AS latest_as_of_date
FROM gold.scores_quarterly;

SELECT COUNT(*) AS total_rows,
       COUNT(DISTINCT (_index, perf_date)) AS distinct_business_keys,
       MAX(perf_date) AS latest_perf_date
FROM gold.index_performance;
```

```text
 total_rows | distinct_business_keys | latest_score_date
------------+------------------------+-------------------
        635 |                    635 | 2026-04-08
(1 row)

 total_rows | distinct_business_keys | latest_as_of_date
------------+------------------------+-------------------
        176 |                    176 | 2026-02-28
(1 row)

 total_rows | distinct_business_keys | latest_perf_date
------------+------------------------+------------------
       5351 |                   5351 | 2026-04-07
(1 row)
```

The current data is clean at the intended grain, which is good news operationally. It is still not enough. A consumer contract should be protected by PostgreSQL, not only by pipeline discipline.

### Recommended gold uniqueness contract

The following transaction-scoped DDL is appropriate when documenting or validating the intended PostgreSQL gold contract without mutating the live lab tables. Each block is state-changing inside the session but rolled back at the end. Its purpose is to show the three business-key indexes gold should rely on.

#### Create gold contract tables with the correct business-key indexes

| Field | Meaning |
|---|---|
| `tablename` | Temporary gold contract table. |
| `indexname` | Primary-key or business-key index name. |
| `indexdef` | Physical index definition that enforces the consumer grain. |

*This transaction creates simplified gold tables and proves the unique index shape each one should carry.*

```sql
BEGIN;

CREATE TEMP TABLE note04_scores_daily_contract (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    _index text NOT NULL,
    symbol text NOT NULL,
    score_date date NOT NULL,
    sector text,
    relative_value_score double precision,
    momentum_score double precision,
    sentiment_score double precision,
    composite_score double precision,
    _scored_at timestamp NOT NULL DEFAULT clock_timestamp()
);

CREATE UNIQUE INDEX note04_scores_daily_contract_uq
    ON note04_scores_daily_contract (_index, symbol, score_date);

CREATE TEMP TABLE note04_scores_quarterly_contract (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    _index text NOT NULL,
    symbol text NOT NULL,
    as_of_date date NOT NULL,
    quality_score double precision,
    governance_score double precision,
    health_flags_count smallint,
    health_risk_level text,
    _scored_at timestamp NOT NULL DEFAULT clock_timestamp()
);

CREATE UNIQUE INDEX note04_scores_quarterly_contract_uq
    ON note04_scores_quarterly_contract (_index, symbol, as_of_date);

CREATE TEMP TABLE note04_index_performance_contract (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    _index text NOT NULL,
    perf_date date NOT NULL,
    daily_return double precision,
    cumulative_factor double precision,
    rolling_30d_return double precision,
    rolling_90d_return double precision,
    ytd_return double precision,
    _computed_at timestamp NOT NULL DEFAULT clock_timestamp()
);

CREATE UNIQUE INDEX note04_index_performance_contract_uq
    ON note04_index_performance_contract (_index, perf_date);

SELECT tablename,
       indexname,
       indexdef
FROM pg_indexes
WHERE tablename IN (
    'note04_scores_daily_contract',
    'note04_scores_quarterly_contract',
    'note04_index_performance_contract'
)
ORDER BY tablename, indexname;

ROLLBACK;
```

```text
BEGIN
CREATE TABLE
CREATE INDEX
CREATE TABLE
CREATE INDEX
CREATE TABLE
CREATE INDEX
             tablename             |               indexname                |                                                                   indexdef
-----------------------------------+----------------------------------------+----------------------------------------------------------------------------------------------------------------------------------------------
 note04_index_performance_contract | note04_index_performance_contract_pkey | CREATE UNIQUE INDEX note04_index_performance_contract_pkey ON pg_temp.note04_index_performance_contract USING btree (id)
 note04_index_performance_contract | note04_index_performance_contract_uq   | CREATE UNIQUE INDEX note04_index_performance_contract_uq ON pg_temp.note04_index_performance_contract USING btree (_index, perf_date)
 note04_scores_daily_contract      | note04_scores_daily_contract_pkey      | CREATE UNIQUE INDEX note04_scores_daily_contract_pkey ON pg_temp.note04_scores_daily_contract USING btree (id)
 note04_scores_daily_contract      | note04_scores_daily_contract_uq        | CREATE UNIQUE INDEX note04_scores_daily_contract_uq ON pg_temp.note04_scores_daily_contract USING btree (_index, symbol, score_date)
 note04_scores_quarterly_contract  | note04_scores_quarterly_contract_pkey  | CREATE UNIQUE INDEX note04_scores_quarterly_contract_pkey ON pg_temp.note04_scores_quarterly_contract USING btree (id)
 note04_scores_quarterly_contract  | note04_scores_quarterly_contract_uq    | CREATE UNIQUE INDEX note04_scores_quarterly_contract_uq ON pg_temp.note04_scores_quarterly_contract USING btree (_index, symbol, as_of_date)
(6 rows)

ROLLBACK
```

Those three unique indexes are the practical gold contract. They keep each refresh slice replaceable, make duplicates impossible at the consumer grain, and give PostgreSQL a deterministic conflict target if the refresh strategy ever evolves from delete-plus-insert to upsert.

## Gold Analytics Logic

Gold scoring logic takes silver facts and turns them into relative judgements. PostgreSQL can express much of that logic directly with window functions and deterministic formulas even if the production pipeline still performs some orchestration in Python.

### Relative scoring with window functions

This z-score query is appropriate when validating score math, debugging suspicious ranks, or porting helper code into pure SQL. It is usually triggered by a need to prove how a raw metric becomes a relative score inside one peer group. The query is read-only against live silver inputs. Its purpose is to show PostgreSQL's direct equivalent of the helper-style z-score logic described in the SQL Server chapter.

#### Compute a sector-relative P/E z-score

| Field | Meaning |
|---|---|
| `forward_pe` | Raw valuation multiple from the latest daily signal snapshot. |
| `sector` | Peer group used for normalization. |
| `pe_zscore` | Inverted z-score so cheaper-than-peers stocks score positively. |

*This query computes a live sector-relative P/E z-score from the latest silver daily signals.*

```sql
WITH latest_signals AS (
    SELECT s._index,
           s.symbol,
           s.forward_pe,
           d.sector
    FROM silver.signals_daily AS s
    JOIN silver.index_dim AS d
      ON d._index = s._index
     AND d.symbol = s.symbol
     AND d.is_current
    WHERE s.signal_date = (SELECT MAX(signal_date) FROM silver.signals_daily)
      AND s._index = 'stoxx_usa_50'
      AND s.forward_pe IS NOT NULL
      AND d.sector IS NOT NULL
)
SELECT _index,
       symbol,
       sector,
       forward_pe,
       ROUND(((-1 * (forward_pe - AVG(forward_pe) OVER (PARTITION BY _index, sector))) /
              NULLIF(STDDEV_SAMP(forward_pe) OVER (PARTITION BY _index, sector), 0))::numeric, 4) AS pe_zscore
FROM latest_signals
ORDER BY sector, symbol
LIMIT 8;
```

```text
    _index    | symbol |         sector         | forward_pe | pe_zscore
--------------+--------+------------------------+------------+-----------
 stoxx_usa_50 | LIN    | Basic Materials        |  25.374872 |
 stoxx_usa_50 | GOOGL  | Communication Services |  22.745144 |   -0.7818
 stoxx_usa_50 | META   | Communication Services |  15.988805 |    0.2408
 stoxx_usa_50 | NFLX   | Communication Services |  25.645483 |   -1.2209
 stoxx_usa_50 | TMUS   | Communication Services | 14.2676735 |    0.5014
 stoxx_usa_50 | VZ     | Communication Services |   9.252616 |    1.2605
 stoxx_usa_50 | AMZN   | Consumer Cyclical      |  22.758656 |    0.4688
 stoxx_usa_50 | HD     | Consumer Cyclical      |   19.54512 |    0.5317
(8 rows)
```

`VZ` scores positively because its forward P/E is cheaper than its communication-services peers. `NFLX` scores negatively because it is expensive relative to the same group. `LIN` shows a `NULL` z-score because the sample has only one Basic Materials row in that slice; a standard deviation does not exist for a one-row peer group.

### Rules-based quality and governance logic

The stored quarterly scores are appropriate for audit and explanation because they already expose the derived outputs consumers see. They are typically queried after a score refresh, during score-review discussions, or when a user asks why a company sits in a given quality or governance bucket. The query is read-only against `gold.scores_quarterly`. Its purpose is to connect the stored composite scores to the underlying normalized components and health flags.

#### Inspect quality-score components and health flags

| Field | Meaning |
|---|---|
| `gross_margin_zscore`, `roe_zscore`, `leverage_zscore`, `fcf_yield_zscore` | Normalized component scores feeding the quality composite. |
| `quality_score` | Composite quarterly quality score. |
| `health_flags_count` | Number of rules-based warning flags currently active. |
| `health_risk_level` | Human-readable label derived from the flag count. |

*This query samples the live quarterly quality outputs already published to gold.*

```sql
SELECT symbol,
       gross_margin_zscore,
       roe_zscore,
       leverage_zscore,
       fcf_yield_zscore,
       quality_score,
       health_flags_count,
       health_risk_level
FROM gold.scores_quarterly
WHERE _index = 'stoxx_usa_50'
ORDER BY as_of_date DESC, quality_rank ASC NULLS LAST, symbol
LIMIT 5;
```

```text
 symbol | gross_margin_zscore  |      roe_zscore      |   leverage_zscore    |   fcf_yield_zscore   |     quality_score      | health_flags_count | health_risk_level
--------+----------------------+----------------------+----------------------+----------------------+------------------------+--------------------+-------------------
 ORCL   |   0.5062297961437854 |   0.3377248163718944 |   -3.201200612141664 |  -2.2241701569379746 |    -0.9242972596252258 |                  2 | warning
 MU     | -0.10223387286044042 | -0.12063031304040832 |   0.5586902815096021 | -0.37836090387907223 |    0.37676795094110876 |                  0 | healthy
 COST   |  -1.5049978400160173 | -0.45662084834053895 |   0.9348127107438877 |  -0.4147813395340961 |    -0.5187361890535951 |                  0 | healthy
 AVGO   |    1.184708373995533 |  -0.2872486579201342 | -0.07805218063436006 |  -0.0963749046087062 |     0.2746397745133976 |                  0 | healthy
 HD     |  -0.3647510527079572 |   1.1472751050248278 |  -1.1534831933760348 |   0.7694549666450695 | -0.0015641126874695432 |                  2 | warning
(5 rows)
```

This is the practical gold pattern: statistical scores and rules-based flags live side by side. A stock can have reasonable normalized profitability but still carry enough warning flags to land in a `warning` bucket.

The governance formula check is appropriate when validating that stored score columns still match the intended business logic. It is triggered by code changes, migration work, or suspicious score drift. The query is read-only against `gold.scores_quarterly`. Its purpose is to prove that the stored governance score still matches the inverted average ISS risk pattern.

#### Compare the stored governance score with the formula

| Field | Meaning |
|---|---|
| `overall_risk` through `shareholder_rights_risk` | Raw ISS-style risk inputs, where lower is better. |
| `computed_governance_score` | `10 - avg(risk columns)` recalculated inline. |
| `governance_score` | Stored gold output. |

*This query recomputes the governance score from raw risk inputs and compares it with the stored gold value.*

```sql
SELECT symbol,
       overall_risk,
       audit_risk,
       board_risk,
       compensation_risk,
       shareholder_rights_risk,
       ROUND((10 - ((overall_risk + audit_risk + board_risk + compensation_risk + shareholder_rights_risk) / 5.0))::numeric, 2) AS computed_governance_score,
       governance_score
FROM gold.scores_quarterly
WHERE governance_score IS NOT NULL
ORDER BY as_of_date DESC, symbol
LIMIT 5;
```

```text
 symbol | overall_risk | audit_risk | board_risk | compensation_risk | shareholder_rights_risk | computed_governance_score | governance_score
--------+--------------+------------+------------+-------------------+-------------------------+---------------------------+------------------
 ORCL   |            9 |          1 |         10 |                10 |                       5 |                      3.00 |                3
 MU     |            3 |          1 |          8 |                 6 |                       1 |                      6.20 |              6.2
 COST   |            1 |          7 |          2 |                 4 |                       1 |                      7.00 |                7
 AVGO   |            8 |          3 |          2 |                10 |                       3 |                      4.80 |              4.8
 HD     |            1 |          3 |          4 |                 3 |                       1 |                      7.60 |              7.6
(5 rows)
```

The stored and recomputed values agree exactly in the sample, which is the right audit outcome. Governance becomes easy to explain because the gold table stores both the final score and the raw ingredients that produced it.

## Daily Scores Transform

The daily scores refresh turns the latest silver signal date into a ready-to-read consumer slice. The key PostgreSQL ideas are straightforward: anchor the run to one date, join in the current dimension metadata, compute rolling price features with window functions, and replace only the target gold date.

#### Find the latest signal date

| Field | Meaning |
|---|---|
| `latest_signal_date` | Silver date the daily score refresh should anchor to. |

*This query finds the current silver date that the gold daily score refresh should publish.*

```sql
SELECT MAX(signal_date) AS latest_signal_date
FROM silver.signals_daily;
```

```text
 latest_signal_date
--------------------
 2026-04-08
(1 row)
```

This date anchor is the simplest and safest daily refresh boundary in the current lab. It tells the publisher exactly which slice to replace and gives the freshness check a concrete expected result.

The dimension join is appropriate immediately after the refresh date has been chosen and before any score calculation begins. It is triggered by the need to enrich raw signals with stable classification metadata such as sector, country, and display name. The query is read-only against silver tables. Its purpose is to build the denormalized working set gold will score and publish.

#### Join the latest signals with current dimension metadata

| Field | Meaning |
|---|---|
| `signal_date` | Refresh date selected for scoring. |
| `current_price`, `forward_pe` | Example signal metrics used downstream in scoring. |
| `sector`, `country`, `short_name` | Consumer-facing context pulled from the current dimension row. |

*This query builds the latest daily scoring surface from live silver signals and current dimension rows.*

```sql
SELECT s._index,
       s.symbol,
       s.signal_date,
       s.current_price,
       s.forward_pe,
       d.sector,
       d.country,
       d.short_name
FROM silver.signals_daily AS s
JOIN silver.index_dim AS d
  ON d._index = s._index
 AND d.symbol = s.symbol
 AND d.is_current
WHERE s.signal_date = (SELECT MAX(signal_date) FROM silver.signals_daily)
ORDER BY s._index, s.symbol
LIMIT 5;
```

```text
    _index     |  symbol  | signal_date | current_price | forward_pe |       sector       |   country   |           short_name
---------------+----------+-------------+---------------+------------+--------------------+-------------+---------------------------------
 euro_stoxx_50 | ABI.BR   | 2026-04-08  |         61.62 |  14.687275 | Consumer Defensive | Belgium     | AB INBEV
 euro_stoxx_50 | AD.AS    | 2026-04-08  |         41.69 |  14.029243 | Consumer Defensive | Netherlands | KONINKLIJKE AHOLD DELHAIZE N.V.
 euro_stoxx_50 | ADS.DE   | 2026-04-08  |        130.85 |  11.179433 | Consumer Cyclical  | Germany     | adidas AG
 euro_stoxx_50 | ADYEN.AS | 2026-04-08  |         844.2 |  17.690842 | Technology         | Netherlands | ADYEN
 euro_stoxx_50 | AI.PA    | 2026-04-08  |         181.5 |  23.064634 | Basic Materials    | France      | AIR LIQUIDE
(5 rows)
```

The moving-average window query is appropriate when validating technical indicators, checking chart math, or deciding whether those features should be precomputed upstream rather than recomputed by every consumer. It is triggered by scoring logic reviews and dashboard debugging. The query is read-only against the live OHLCV table. Its purpose is to show that PostgreSQL window functions can publish chart-ready features directly from silver.

#### Compute SMA 30/90 and recent price changes from OHLCV

| Field | Meaning |
|---|---|
| `sma_30_close`, `sma_90_close` | Rolling average close prices over 30 and 90 rows. |
| `day_change_pct`, `five_day_change_pct`, `ytd_change_pct` | Price changes already shaped for consumer use. |

*This query computes chart-ready moving averages and return metrics for `AAPL` directly from silver OHLCV data.*

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
           ) AS sma_90_close,
           ROUND(100.0 * (close / LAG(close, 1) OVER (PARTITION BY symbol ORDER BY date) - 1)::numeric, 4) AS day_change_pct,
           ROUND(100.0 * (close / LAG(close, 5) OVER (PARTITION BY symbol ORDER BY date) - 1)::numeric, 4) AS five_day_change_pct,
           ROUND(100.0 * (close / FIRST_VALUE(close) OVER (
               PARTITION BY symbol, date_trunc('year', date)
               ORDER BY date
               ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
           ) - 1)::numeric, 4) AS ytd_change_pct
    FROM silver.stoxxusa50_ohlcv
    WHERE symbol = 'AAPL'
)
SELECT symbol,
       date,
       close,
       ROUND(sma_30_close::numeric, 4) AS sma_30_close,
       ROUND(sma_90_close::numeric, 4) AS sma_90_close,
       day_change_pct,
       five_day_change_pct,
       ytd_change_pct
FROM price_window
ORDER BY date DESC
LIMIT 5;
```

```text
 symbol |    date    | close  | sma_30_close | sma_90_close | day_change_pct | five_day_change_pct | ytd_change_pct
--------+------------+--------+--------------+--------------+----------------+---------------------+----------------
 AAPL   | 2026-04-07 |  253.5 |     257.1783 |     264.5704 |        -2.0706 |              2.7855 |        -6.4610
 AAPL   | 2026-04-06 | 258.86 |     257.6010 |     264.8196 |         1.1488 |              4.0434 |        -4.4832
 AAPL   | 2026-04-02 | 255.92 |     257.7917 |     264.9599 |         0.1134 |              1.1981 |        -5.5681
 AAPL   | 2026-04-01 | 255.63 |     257.9470 |     265.0747 |         0.7250 |              1.1915 |        -5.6751
 AAPL   | 2026-03-31 | 253.79 |     258.2377 |     265.2183 |         2.9031 |              0.8544 |        -6.3540
(5 rows)
```

The write step is appropriate once the full daily scoring slice has been validated. It is triggered by a ready-to-publish scoring batch. The example below is state-changing only inside a transaction-scoped demo. Its purpose is to show the idempotent gold rule: delete the target date, then insert the recomputed slice.

#### Refresh one daily scoring date idempotently

| Field | Meaning |
|---|---|
| `score_date` | Gold daily slice being replaced. |
| `composite_score` | Example published score after the refresh. |

*This transaction deletes one score date and reinserts the refreshed rows for that same date.*

```sql
BEGIN;

CREATE TEMP TABLE note04_scores_daily_demo (
    _index text NOT NULL,
    symbol text NOT NULL,
    score_date date NOT NULL,
    composite_score double precision NOT NULL
);

CREATE UNIQUE INDEX note04_scores_daily_demo_uq
    ON note04_scores_daily_demo (_index, symbol, score_date);

INSERT INTO note04_scores_daily_demo (_index, symbol, score_date, composite_score)
VALUES
    ('stoxx_usa_50', 'AAPL', DATE '2026-04-08', 0.10),
    ('stoxx_usa_50', 'MSFT', DATE '2026-04-08', 0.20),
    ('stoxx_usa_50', 'AAPL', DATE '2026-04-07', 0.05);

DELETE FROM note04_scores_daily_demo
WHERE score_date = DATE '2026-04-08';

INSERT INTO note04_scores_daily_demo (_index, symbol, score_date, composite_score)
VALUES
    ('stoxx_usa_50', 'AAPL', DATE '2026-04-08', 0.35),
    ('stoxx_usa_50', 'MSFT', DATE '2026-04-08', 0.40);

SELECT _index,
       symbol,
       score_date,
       composite_score
FROM note04_scores_daily_demo
ORDER BY score_date, symbol;

ROLLBACK;
```

```text
BEGIN
CREATE TABLE
CREATE INDEX
INSERT 0 3
DELETE 2
INSERT 0 2
    _index    | symbol | score_date | composite_score
--------------+--------+------------+-----------------
 stoxx_usa_50 | AAPL   | 2026-04-07 |            0.05
 stoxx_usa_50 | AAPL   | 2026-04-08 |            0.35
 stoxx_usa_50 | MSFT   | 2026-04-08 |             0.4
(3 rows)

ROLLBACK
```

This is the simplest reliable gold refresh pattern for a date-partitioned consumer slice. If the scoring code is rerun, the published date is replaced rather than duplicated.

## Quarterly Scores Transform

Quarterly scoring is slower-moving than daily scoring, but the logic is the same: choose the authoritative source row per business key, pull the extra daily attributes needed for the model, and publish one durable gold row per `(_index, symbol, as_of_date)`.

The quarterly anchor query is appropriate when the transform needs the most recent fundamental row per stock or when an operator needs to verify that the quarterly source is still advancing. It is triggered before quality and governance scoring begins. The query is read-only against `silver.signals_quarterly`. Its purpose is to select one authoritative quarterly row per stock without duplicate periods.

#### Get the latest quarterly row per stock

| Field | Meaning |
|---|---|
| `as_of_date` | Most recent quarterly publication date per business key. |
| `gross_margins`, `debt_to_equity`, `overall_risk` | Example inputs later used in quality and governance scoring. |

*This query uses PostgreSQL `DISTINCT ON` to select the latest quarterly row for each stock.*

```sql
SELECT DISTINCT ON (_index, symbol)
       _index,
       symbol,
       as_of_date,
       gross_margins,
       debt_to_equity,
       overall_risk
FROM silver.signals_quarterly
ORDER BY _index, symbol, as_of_date DESC
LIMIT 5;
```

```text
    _index     |  symbol  | as_of_date | gross_margins | debt_to_equity | overall_risk
---------------+----------+------------+---------------+----------------+--------------
 euro_stoxx_50 | ABI.BR   | 2025-12-31 |       0.55932 |         75.033 |            7
 euro_stoxx_50 | AD.AS    | 2025-12-28 |    0.26544002 |        129.743 |            1
 euro_stoxx_50 | ADS.DE   | 2025-12-31 |        0.5161 |         90.678 |            7
 euro_stoxx_50 | ADYEN.AS | 2025-12-31 |       0.68093 |          4.775 |            2
 euro_stoxx_50 | AI.PA    | 2025-12-31 |    0.64175004 |         50.657 |            2
(5 rows)
```

`DISTINCT ON` is the PostgreSQL-native equivalent of the "latest row per key" pattern often expressed with correlated subqueries or `ROW_NUMBER()` filters in SQL Server. It is concise and deterministic when the `ORDER BY` clause matches the grouping intent.

The daily enrichment query is appropriate once the latest quarterly row has been identified and the scoring logic needs current market context such as market cap or beta. It is triggered by quality-score computation, especially when ratios like free-cash-flow yield need a market value denominator. The query is read-only. Its purpose is to merge the slower quarterly signal with the latest daily market attributes.

#### Join latest market cap and beta from daily signals

| Field | Meaning |
|---|---|
| `as_of_date` | Quarterly source date. |
| `signal_date` | Latest available daily snapshot date. |
| `market_cap`, `beta` | Daily attributes reused by the quarterly scoring model. |

*This query joins the latest quarterly row per stock to the latest daily market-cap and beta snapshot.*

```sql
WITH latest_quarterly AS (
    SELECT DISTINCT ON (_index, symbol)
           _index,
           symbol,
           as_of_date
    FROM silver.signals_quarterly
    ORDER BY _index, symbol, as_of_date DESC
),
latest_daily AS (
    SELECT DISTINCT ON (_index, symbol)
           _index,
           symbol,
           signal_date,
           market_cap,
           beta
    FROM silver.signals_daily
    ORDER BY _index, symbol, signal_date DESC
)
SELECT q._index,
       q.symbol,
       q.as_of_date,
       d.signal_date,
       d.market_cap,
       d.beta
FROM latest_quarterly AS q
JOIN latest_daily AS d
  ON d._index = q._index
 AND d.symbol = q.symbol
ORDER BY q._index, q.symbol
LIMIT 5;
```

```text
    _index     |  symbol  | as_of_date | signal_date |  market_cap  | beta
---------------+----------+------------+-------------+--------------+-------
 euro_stoxx_50 | ABI.BR   | 2025-12-31 | 2026-04-08  | 119697252352 | 0.788
 euro_stoxx_50 | AD.AS    | 2025-12-28 | 2026-04-08  |  36865093632 | 0.369
 euro_stoxx_50 | ADS.DE   | 2025-12-31 | 2026-04-08  |  23206109184 | 1.196
 euro_stoxx_50 | ADYEN.AS | 2025-12-31 | 2026-04-08  |  26623275008 | 1.833
 euro_stoxx_50 | AI.PA    | 2025-12-31 | 2026-04-08  | 104725069824 | 0.655
(5 rows)
```

This is the practical quarterly-gold join pattern: slow-moving fundamentals remain keyed by their own reporting date, but the model can still borrow the newest daily market context when it computes consumer scores.

## Index Performance Transform

The index-performance publisher turns constituent closes and market-cap weights into one portfolio-like time series per index. In PostgreSQL the important decisions are to validate the dynamic OHLCV source surface, find the current gold boundary, and replace only the recent recompute window when corrections are possible.

The source-existence check is appropriate before any dynamic SQL or table-selection logic runs. It is triggered by index-specific performance jobs that need to verify the expected OHLCV table exists. The query is read-only. Its purpose is to fail early if the pipeline is about to query a market table that does not exist.

#### Check that the source OHLCV table exists

| Field | Meaning |
|---|---|
| `ohlcv_table` | Registered relation name returned by PostgreSQL if the table exists. |

*This query proves that the live USA OHLCV source table exists before any performance query runs.*

```sql
SELECT to_regclass('silver.stoxxusa50_ohlcv') AS ohlcv_table;
```

```text
       ohlcv_table
-------------------------
 silver.stoxxusa50_ohlcv
(1 row)
```

The incremental boundary query is appropriate after the source surface is known and before the publisher decides which dates need recomputation. It is triggered by every recurring performance refresh. The query is read-only against gold. Its purpose is to identify the current latest published performance date.

#### Find the latest computed performance date

| Field | Meaning |
|---|---|
| `latest_perf_date` | Latest date already published in `gold.index_performance`. |

*This query finds the current high-water mark of the gold performance table.*

```sql
SELECT MAX(perf_date) AS latest_perf_date
FROM gold.index_performance;
```

```text
 latest_perf_date
------------------
 2026-04-07
(1 row)
```

The input inspection query is appropriate when debugging aggregation math or verifying that the right price and weight inputs are feeding the publisher. It is triggered during validation of cap-weighted return logic. The query is read-only against silver. Its purpose is to show the raw close series and the latest market-cap weights that the aggregate logic depends on.

#### Read the close series and latest market-cap weights

| Field | Meaning |
|---|---|
| `close` | Constituent close price feeding the return calculation. |
| `market_cap` | Weight proxy for cap-weighted aggregation. |
| `beta` | Example risk attribute often carried into performance context or related analytics. |

*These queries sample the close-price stream for `AAPL` and the latest market-cap leaders in the USA index.*

```sql
SELECT symbol,
       date,
       close
FROM silver.stoxxusa50_ohlcv
WHERE symbol = 'AAPL'
ORDER BY date DESC
LIMIT 5;

SELECT _index,
       symbol,
       signal_date,
       market_cap,
       beta
FROM silver.signals_daily
WHERE signal_date = (SELECT MAX(signal_date) FROM silver.signals_daily)
  AND _index = 'stoxx_usa_50'
ORDER BY market_cap DESC NULLS LAST
LIMIT 5;
```

```text
 symbol |    date    | close
--------+------------+--------
 AAPL   | 2026-04-07 |  253.5
 AAPL   | 2026-04-06 | 258.86
 AAPL   | 2026-04-02 | 255.92
 AAPL   | 2026-04-01 | 255.63
 AAPL   | 2026-03-31 | 253.79
(5 rows)

    _index    | symbol | signal_date |  market_cap   | beta
--------------+--------+-------------+---------------+-------
 stoxx_usa_50 | NVDA   | 2026-04-08  | 4328720695296 | 2.335
 stoxx_usa_50 | AAPL   | 2026-04-08  | 3725924237312 | 1.109
 stoxx_usa_50 | GOOGL  | 2026-04-08  | 3695149580288 | 1.128
 stoxx_usa_50 | MSFT   | 2026-04-08  | 2766999912448 | 1.107
 stoxx_usa_50 | AMZN   | 2026-04-08  | 2294804119552 | 1.383
(5 rows)
```

The refresh-window pattern is appropriate when late fixes or recent data movement make full-history recomputation unnecessary but a pure append unsafe. It is triggered by rolling recompute logic. The transaction below is state-changing only inside a demo scope. Its purpose is to show the gold performance rule: delete the recent window and replace it in full.

#### Refresh a rolling performance window idempotently

| Field | Meaning |
|---|---|
| `perf_date` | Published performance date in the rolling window. |
| `daily_return` | Recomputed value after the refresh. |

*This transaction deletes a recent performance window and inserts the recomputed replacement rows.*

```sql
BEGIN;

CREATE TEMP TABLE note04_index_perf_demo (
    _index text NOT NULL,
    perf_date date NOT NULL,
    daily_return double precision NOT NULL
);

CREATE UNIQUE INDEX note04_index_perf_demo_uq
    ON note04_index_perf_demo (_index, perf_date);

INSERT INTO note04_index_perf_demo (_index, perf_date, daily_return)
VALUES
    ('stoxx_usa_50', DATE '2026-04-04', 0.0010),
    ('stoxx_usa_50', DATE '2026-04-05', 0.0020),
    ('stoxx_usa_50', DATE '2026-04-06', 0.0030),
    ('stoxx_usa_50', DATE '2026-04-07', 0.0040);

DELETE FROM note04_index_perf_demo
WHERE perf_date >= DATE '2026-04-06';

INSERT INTO note04_index_perf_demo (_index, perf_date, daily_return)
VALUES
    ('stoxx_usa_50', DATE '2026-04-06', 0.0035),
    ('stoxx_usa_50', DATE '2026-04-07', 0.0045);

SELECT _index,
       perf_date,
       daily_return
FROM note04_index_perf_demo
ORDER BY perf_date;

ROLLBACK;
```

```text
BEGIN
CREATE TABLE
CREATE INDEX
INSERT 0 4
DELETE 2
INSERT 0 2
    _index    | perf_date  | daily_return
--------------+------------+--------------
 stoxx_usa_50 | 2026-04-04 |        0.001
 stoxx_usa_50 | 2026-04-05 |        0.002
 stoxx_usa_50 | 2026-04-06 |       0.0035
 stoxx_usa_50 | 2026-04-07 |       0.0045
(4 rows)

ROLLBACK
```

## Dashboard Consumption Queries

These queries represent the real point of gold: consumers should be able to read directly from the gold tables and get stable shapes, already-computed metrics, and bounded result sets.

#### Read the latest performance snapshot for every index

| Field | Meaning |
|---|---|
| `daily_return_pct` | Latest daily return expressed in percent. |
| `cumulative_return_pct` | Since-inception cumulative return derived from `cumulative_factor`. |
| `stocks_count` | Number of constituents contributing to that day's index calculation. |

*This query returns the latest performance row per index in a dashboard-friendly shape.*

```sql
SELECT DISTINCT ON (_index)
       _index,
       perf_date,
       ROUND((100 * daily_return)::numeric, 4) AS daily_return_pct,
       ROUND((100 * (cumulative_factor - 1))::numeric, 4) AS cumulative_return_pct,
       stocks_count
FROM gold.index_performance
ORDER BY _index, perf_date DESC;
```

```text
    _index     | perf_date  | daily_return_pct | cumulative_return_pct | stocks_count
---------------+------------+------------------+-----------------------+--------------
 euro_stoxx_50 | 2026-04-07 |          -0.7931 |               97.5476 |           45
 oil_20        | 2026-04-07 |           0.6887 |              215.8942 |           19
 stoxx_asia_50 | 2026-04-07 |           0.5919 |               95.6358 |           46
 stoxx_usa_50  | 2026-04-07 |           0.0962 |              174.0263 |           50
(4 rows)
```

#### Read a historical performance series for one index

| Field | Meaning |
|---|---|
| `rolling_30d_return_pct` | Rolling 30-day return published for the charting surface. |

*This query returns the recent performance history for one index without any extra downstream computation.*

```sql
SELECT _index,
       perf_date,
       ROUND((100 * daily_return)::numeric, 4) AS daily_return_pct,
       ROUND((100 * (cumulative_factor - 1))::numeric, 4) AS cumulative_return_pct,
       ROUND((100 * rolling_30d_return)::numeric, 4) AS rolling_30d_return_pct
FROM gold.index_performance
WHERE _index = 'stoxx_usa_50'
ORDER BY perf_date DESC
LIMIT 5;
```

```text
    _index    | perf_date  | daily_return_pct | cumulative_return_pct | rolling_30d_return_pct
--------------+------------+------------------+-----------------------+------------------------
 stoxx_usa_50 | 2026-04-07 |           0.0962 |              174.0263 |                -1.3545
 stoxx_usa_50 | 2026-04-06 |           0.4856 |              173.7630 |                -2.8302
 stoxx_usa_50 | 2026-04-02 |           0.0955 |              172.4401 |                -2.8546
 stoxx_usa_50 | 2026-04-01 |           0.6127 |              172.1801 |                -3.1828
 stoxx_usa_50 | 2026-03-31 |           2.6635 |              170.5227 |                -3.2348
(5 rows)
```

#### Read the latest daily factor scores for one index

| Field | Meaning |
|---|---|
| `composite_score` | Consumer-facing summary score for ranking. |
| `relative_value_score`, `momentum_score`, `sentiment_score` | Component scores that explain the composite. |
| `composite_rank` | Current rank within the index slice. |

*This query returns the highest-ranked live daily scores for the USA index.*

```sql
SELECT _index,
       symbol,
       score_date,
       ROUND(composite_score::numeric, 4) AS composite_score,
       composite_rank,
       ROUND(relative_value_score::numeric, 4) AS relative_value_score,
       ROUND(momentum_score::numeric, 4) AS momentum_score,
       ROUND(sentiment_score::numeric, 4) AS sentiment_score
FROM gold.scores_daily
WHERE _index = 'stoxx_usa_50'
  AND score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
ORDER BY composite_rank, symbol
LIMIT 5;
```

```text
    _index    | symbol | score_date | composite_score | composite_rank | relative_value_score | momentum_score | sentiment_score
--------------+--------+------------+-----------------+----------------+----------------------+----------------+-----------------
 stoxx_usa_50 | MU     | 2026-04-08 |          1.3617 |              1 |               1.3250 |         1.6506 |          1.1095
 stoxx_usa_50 | AMD    | 2026-04-08 |          0.5408 |              2 |               0.2422 |         0.7801 |          0.6002
 stoxx_usa_50 | AVGO   | 2026-04-08 |          0.5251 |              3 |              -0.0844 |         0.2562 |          1.4034
 stoxx_usa_50 | AMZN   | 2026-04-08 |          0.4947 |              4 |               0.6682 |        -0.1554 |          0.9713
 stoxx_usa_50 | NVDA   | 2026-04-08 |          0.4905 |              5 |              -0.0744 |         0.0082 |          1.5377
(5 rows)
```

#### Read the latest quarterly quality and governance slice

| Field | Meaning |
|---|---|
| `quality_rank`, `governance_rank` | Published ranks at the quarterly consumer grain. |
| `health_flags_count`, `health_risk_level` | Rules-based health summary for immediate consumption. |

*This query returns the live quarterly gold slice for the USA index.*

```sql
SELECT _index,
       symbol,
       as_of_date,
       ROUND(quality_score::numeric, 4) AS quality_score,
       quality_rank,
       ROUND(governance_score::numeric, 4) AS governance_score,
       governance_rank,
       health_flags_count,
       health_risk_level
FROM gold.scores_quarterly
WHERE _index = 'stoxx_usa_50'
ORDER BY as_of_date DESC, quality_rank ASC NULLS LAST, symbol
LIMIT 5;
```

```text
    _index    | symbol | as_of_date | quality_score | quality_rank | governance_score | governance_rank | health_flags_count | health_risk_level
--------------+--------+------------+---------------+--------------+------------------+-----------------+--------------------+-------------------
 stoxx_usa_50 | ORCL   | 2026-02-28 |       -0.9243 |           49 |           3.0000 |              19 |                  2 | warning
 stoxx_usa_50 | MU     | 2026-02-26 |        0.3768 |           12 |           6.2000 |               7 |                  0 | healthy
 stoxx_usa_50 | COST   | 2026-02-15 |       -0.5187 |           42 |           7.0000 |               4 |                  0 | healthy
 stoxx_usa_50 | AVGO   | 2026-02-01 |        0.2746 |           15 |           4.8000 |              13 |                  0 | healthy
 stoxx_usa_50 | HD     | 2026-02-01 |       -0.0016 |           23 |           7.6000 |               3 |                  2 | warning
(5 rows)
```

#### Read chart-ready OHLCV with server-side moving averages

| Field | Meaning |
|---|---|
| `sma_30_close`, `sma_90_close` | Server-side moving averages ready for chart overlays. |
| `day_change_pct`, `five_day_change_pct`, `ytd_change_pct` | Precomputed price-change context for the chart or detail panel. |

*This query returns chart-ready OHLCV analytics for one symbol directly from PostgreSQL.*

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
           ) AS sma_90_close,
           ROUND(100.0 * (close / LAG(close, 1) OVER (PARTITION BY symbol ORDER BY date) - 1)::numeric, 4) AS day_change_pct,
           ROUND(100.0 * (close / LAG(close, 5) OVER (PARTITION BY symbol ORDER BY date) - 1)::numeric, 4) AS five_day_change_pct,
           ROUND(100.0 * (close / FIRST_VALUE(close) OVER (
               PARTITION BY symbol, date_trunc('year', date)
               ORDER BY date
               ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
           ) - 1)::numeric, 4) AS ytd_change_pct
    FROM silver.stoxxusa50_ohlcv
    WHERE symbol = 'AAPL'
)
SELECT symbol,
       date,
       close,
       ROUND(sma_30_close::numeric, 4) AS sma_30_close,
       ROUND(sma_90_close::numeric, 4) AS sma_90_close,
       day_change_pct,
       five_day_change_pct,
       ytd_change_pct
FROM price_window
ORDER BY date DESC
LIMIT 5;
```

```text
 symbol |    date    | close  | sma_30_close | sma_90_close | day_change_pct | five_day_change_pct | ytd_change_pct
--------+------------+--------+--------------+--------------+----------------+---------------------+----------------
 AAPL   | 2026-04-07 |  253.5 |     257.1783 |     264.5704 |        -2.0706 |              2.7855 |        -6.4610
 AAPL   | 2026-04-06 | 258.86 |     257.6010 |     264.8196 |         1.1488 |              4.0434 |        -4.4832
 AAPL   | 2026-04-02 | 255.92 |     257.7917 |     264.9599 |         0.1134 |              1.1981 |        -5.5681
 AAPL   | 2026-04-01 | 255.63 |     257.9470 |     265.0747 |         0.7250 |              1.1915 |        -5.6751
 AAPL   | 2026-03-31 | 253.79 |     258.2377 |     265.2183 |         2.9031 |              0.8544 |        -6.3540
(5 rows)
```

### Key PostgreSQL techniques used in gold transforms

| Technique | Where it matters | Why it fits gold |
|---|---|---|
| Business-key unique indexes | All gold tables | Protect the consumer grain and keep refreshes idempotent. |
| `DISTINCT ON` | Latest quarterly and latest daily lookups | Concise PostgreSQL-native latest-row-per-key selection. |
| Window functions | Z-scores, moving averages, returns | Push consumer-ready analytics into PostgreSQL instead of into the dashboard. |
| Delete-plus-insert refresh windows | Daily scores and index performance | Simple rerun-safe publishing for bounded slices. |
| `to_regclass()` | Dynamic source validation | Fails fast when the expected source relation does not exist. |
| Percent conversion at read time | Dashboard-facing queries | Keeps stored factors normalized while making consumer output legible. |

## Gold Freshness Checks

Gold freshness checks answer the only question consumers actually care about: "Is the published layer current enough to trust right now?" These checks belong after every run and during any incident review.

#### Check the latest published dates and scoring timestamps

| Field | Meaning |
|---|---|
| `latest_*_date` | Most recent business date published in the gold table. |
| `latest_*_scored_at`, `latest_perf_computed_at` | Most recent pipeline timestamp that wrote the table. |

*These queries show the latest business dates and write timestamps for each gold table.*

```sql
SELECT MAX(score_date) AS latest_daily_score_date,
       MAX(_scored_at) AS latest_daily_scored_at
FROM gold.scores_daily;

SELECT MAX(as_of_date) AS latest_quarterly_score_date,
       MAX(_scored_at) AS latest_quarterly_scored_at
FROM gold.scores_quarterly;

SELECT MAX(perf_date) AS latest_perf_date,
       MAX(_computed_at) AS latest_perf_computed_at
FROM gold.index_performance;
```

```text
 latest_daily_score_date |   latest_daily_scored_at
-------------------------+----------------------------
 2026-04-08              | 2026-04-07 23:33:05.409828
(1 row)

 latest_quarterly_score_date | latest_quarterly_scored_at
-----------------------------+----------------------------
 2026-02-28                  | 2026-04-07 23:33:05.512822
(1 row)

 latest_perf_date |  latest_perf_computed_at
------------------+----------------------------
 2026-04-07       | 2026-04-07 23:33:07.104171
(1 row)
```

These timestamps line up coherently: daily and quarterly scores were published on `2026-04-07` for the business slices visible in the lab, and index performance is current through `2026-04-07`. If one table lagged a different run or date, that would be a consumer-facing inconsistency.

#### Remove only future-dated gold rows during an emergency cleanup

| Field | Meaning |
|---|---|
| `perf_date` | Remaining published date after cleanup. |

*This transaction removes only future-dated gold rows and leaves the valid published slice intact.*

```sql
BEGIN;

CREATE TEMP TABLE note04_cleanup_demo (
    _index text NOT NULL,
    perf_date date NOT NULL
);

INSERT INTO note04_cleanup_demo (_index, perf_date)
VALUES
    ('stoxx_usa_50', CURRENT_DATE - 1),
    ('stoxx_usa_50', CURRENT_DATE + 1),
    ('stoxx_usa_50', CURRENT_DATE + 2);

DELETE FROM note04_cleanup_demo
WHERE perf_date > CURRENT_DATE;

SELECT _index,
       perf_date
FROM note04_cleanup_demo
ORDER BY perf_date;

ROLLBACK;
```

```text
BEGIN
CREATE TABLE
INSERT 0 3
DELETE 2
    _index    | perf_date
--------------+------------
 stoxx_usa_50 | 2026-04-18
(1 row)

ROLLBACK
```

This is the safe gold cleanup rule: delete only dates that should never have been published yet, then rerun the normal refresh. Broad deletes are dangerous in gold because they immediately remove consumer-visible history.

### Related notes

- [[03-postgresql-silver-transforms]] for the silver facts and transform rules that feed gold.
- [[05-postgresql-incremental-transforms]] for the next layer of publish-boundary and watermark discipline.
