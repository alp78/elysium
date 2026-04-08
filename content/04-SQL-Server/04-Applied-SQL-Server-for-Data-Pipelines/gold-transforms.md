---
title: "Gold Transforms"
tags: [sql, sql-server, tsql, medallion-project]
aliases: [Gold Layer, Gold Transforms, Silver to Gold, Gold DDL, Scoring Tables, Pre-computed Analytics, Factor Scores]
description: "Complete SQL and Python patterns for the example gold layer — covers all gold table DDL, z-score computation, financial health flags, governance scoring, cap-weighted index performance, moving average CTEs, and dashboard consumption queries."
parent: "[[domain-applied-sql-server-pipelines]]"
links:
  - "[[sql-server-loading-patterns]]"
  - "[[sql-server-schema-layering]]"
  - "[[sql-server-change-tracking]]"
  - "[[sql-server-incremental-transforms]]"
  - "[[sql-server-pipeline-anti-patterns]]"
  - "[[bronze-layer-loading]]"
  - "[[silver-transforms]]"
created: 2026-03-22
updated: 2026-04-04
status: complete
---

> [!abstract] Medallion Project — Financial Index Pipeline
>
> This page documents the implementation of a specific financial data pipeline
> (STOXX/yfinance stock index scoring system) on SQL Server. For the general
> patterns and alternative approaches, see the [moc-sql-server > Patterns](https://alp78.github.io/elysium/04-SQL-Server/moc-sql-server#patterns)
> section. For the architectural theory behind bronze/silver/gold layering,
> see [medallion-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/medallion-architecture).

# Gold Transforms

> [!quote]
> "The gold layer is the contract with your consumers. If the schema changes without warning, every dashboard, API, and downstream pipeline breaks."
>
> — **Maxime Beauchemin**, creator of Apache Airflow and Superset

The gold layer contains pre-computed analytics scores ready for dashboard consumption. No raw data lives here — only derived metrics with z-scores, ranks, health flags, and performance calculations. All gold transforms read from [silver](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/silver-transforms) and write to gold tables. In dbt, the equivalent role is served by [mart models](https://alp78.github.io/elysium/11-dbt/Modeling/dbt-mart-models) that expose business-ready datasets.

**Pipeline flow:** [Silver](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/silver-transforms) → Python + pandas → Gold tables → Blazor dashboard

> [!info] Gold Layer Role
>
> Gold is the presentation layer. Data in gold is denormalized, scored, ranked, and ready to display. No joins required for the dashboard — every query returns display-ready values. Gold tables are refreshed on every pipeline run; stale rows are deleted and replaced.

---

## Gold Table DDL

Gold tables are denormalized and consumption-ready — a single `SELECT *` returns everything the dashboard needs, with no joins. Each table follows a `DELETE + INSERT` refresh pattern: stale rows for the target date are deleted, then new scored rows are inserted. This makes every pipeline run idempotent — re-running produces the same result. All gold DDL lives in `db/ddl/gold_schema.sql` and uses the same `IF NOT EXISTS` idempotent pattern as bronze and silver.

### gold.scores_daily — Factor Scores

Stores relative value, momentum, sentiment, and composite factor scores for each stock per day. Also includes SMA-based price metrics computed from OHLCV.

#### CREATE TABLE gold.scores_daily — factor scores DDL

The table stores four factor score groups plus OHLCV-derived price metrics. **Relative value** z-scores measure how cheap a stock is relative to its sector peers — `pe_zscore`, `pb_zscore`, and `ev_ebitda_zscore` are inverted (multiplied by -1) so that lower valuations produce positive scores; `yield_zscore` is not inverted because higher dividend yield is already desirable. `relative_value_score` is the row-wise average of the four z-scores, and `relative_value_rank` ranks stocks within the index (1 = cheapest). **Momentum** captures trend strength: `relative_strength` (52-week return minus benchmark return), SMA ratios (price divided by 50-day and 200-day moving averages — above 1.0 means the price is above its average), and distance from 52-week high. **Analyst sentiment** includes `implied_upside` ((target price / current price) - 1), `recommendation_mean` (1 = Strong Buy through 5 = Strong Sell), and a `price_falling_analysts_bullish` divergence flag (`BIT`) that fires when the price is declining but analysts remain bullish. **Composite** is the equal-weighted average of value, momentum, and sentiment scores. The OHLCV-derived columns (SMA 30/90, price changes, `index_weight` as market cap divided by sum of all market caps) are denormalized here to avoid joins in dashboard queries. `_scored_at` records when the scoring pipeline ran.

```sql
CREATE TABLE gold.scores_daily (
    id                          INT IDENTITY(1,1) PRIMARY KEY,
    _index                      VARCHAR(20)     NOT NULL,
    symbol                      VARCHAR(20)     NOT NULL,
    score_date                  DATE            NOT NULL,
    sector                      NVARCHAR(100),

    pe_zscore                   FLOAT,
    pb_zscore                   FLOAT,
    ev_ebitda_zscore            FLOAT,
    yield_zscore                FLOAT,
    relative_value_score        FLOAT,
    relative_value_rank         SMALLINT,

    relative_strength           FLOAT,
    sma_50_ratio                FLOAT,
    sma_200_ratio               FLOAT,
    dist_from_52w_high          FLOAT,
    momentum_score              FLOAT,
    momentum_rank               SMALLINT,

    implied_upside              FLOAT,
    recommendation_mean         FLOAT,
    price_falling_analysts_bullish BIT,
    sentiment_score             FLOAT,
    sentiment_rank              SMALLINT,

    composite_score             FLOAT,
    composite_rank              SMALLINT,

    sma_30_close                FLOAT,
    sma_90_close                FLOAT,
    market_cap                  BIGINT,
    index_weight                FLOAT,
    short_name                  NVARCHAR(200),
    country                     NVARCHAR(100),
    currency                    VARCHAR(10),
    current_price               FLOAT,
    day_change_pct              FLOAT,
    five_day_change_pct         FLOAT,
    ytd_change_pct              FLOAT,

    _scored_at                  DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE UNIQUE INDEX UX_gold_scores_daily
    ON gold.scores_daily (_index, symbol, score_date);
GO
```

### gold.scores_quarterly — Quality & Governance Scores

Stores quality z-scores, financial health flags, and governance (ISS) scores. Updated once per pipeline run using the latest quarterly data.

#### CREATE TABLE gold.scores_quarterly — quarterly factor scores DDL

The table stores three score groups. **Quality / Moat** z-scores measure profitability and capital efficiency within the sector: `gross_margin_zscore`, `roe_zscore` (return on equity), `operating_margin_zscore`, and `leverage_zscore` (inverted: lower debt-to-equity = positive score). `fcf_yield` is free cash flow divided by market cap — a metric that measures how much cash a company generates relative to its price; `fcf_yield_zscore` is its sector-normalized z-score. `quality_score` averages these into a composite, and `quality_rank` ranks within the index. **Financial health flags** are binary alerts (stored as `BIT`) that fire when a stock breaches predefined thresholds: `flag_liquidity` (current ratio below 1.0), `flag_leverage` (debt-to-equity above 200%), `flag_cashburn` (negative free cash flow), and `flag_double_decline` (both revenue and earnings growth negative simultaneously). `health_flags_count` (`TINYINT`, 0–4) totals the active flags, and `health_risk_level` maps the count to a text label: `'healthy'` (0), `'watch'` (1), `'warning'` (2), `'critical'` (3+). **Governance** stores the raw ISS risk scores (1–10, lower = better) and computes `governance_score` as `10 - avg(risk scores)` so that higher values mean better governance. `governance_vs_quality` measures the gap between governance and quality scores, surfacing stocks where good financials are paired with poor governance (or vice versa).

```sql
CREATE TABLE gold.scores_quarterly (
    id                          INT IDENTITY(1,1) PRIMARY KEY,
    _index                      VARCHAR(20)     NOT NULL,
    symbol                      VARCHAR(20)     NOT NULL,
    as_of_date                  DATE            NOT NULL,
    sector                      NVARCHAR(100),

    gross_margin_zscore         FLOAT,
    roe_zscore                  FLOAT,
    operating_margin_zscore     FLOAT,
    leverage_zscore             FLOAT,
    fcf_yield                   FLOAT,
    fcf_yield_zscore            FLOAT,
    quality_score               FLOAT,
    quality_rank                SMALLINT,

    flag_liquidity              BIT,
    flag_leverage               BIT,
    flag_cashburn               BIT,
    flag_double_decline         BIT,
    health_flags_count          TINYINT,
    health_risk_level           VARCHAR(10),

    overall_risk                FLOAT,
    audit_risk                  FLOAT,
    board_risk                  FLOAT,
    compensation_risk           FLOAT,
    shareholder_rights_risk     FLOAT,
    governance_score            FLOAT,
    governance_rank             SMALLINT,
    beta                        FLOAT,
    governance_vs_quality       FLOAT,

    _scored_at                  DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE UNIQUE INDEX UX_gold_scores_quarterly
    ON gold.scores_quarterly (_index, symbol, as_of_date);
GO
```

### gold.index_performance — Index Time Series

Stores cap-weighted index performance metrics: daily returns, rolling returns, volatility, and cross-sectional aggregates (avg PE, avg PB, etc.).

#### CREATE TABLE gold.index_performance — cap-weighted returns DDL

This table stores one row per index per trading day, tracking index-level performance. **Cap-weighted returns** weight each stock's daily return by its market capitalization — larger companies have more influence on the index return, which is the standard methodology used by real-world indices like the S&P 500 and STOXX Europe 600. `daily_return` is the weighted average daily return across all stocks. `cumulative_factor` is the running product `(1 + r1)(1 + r2)...` from day one — multiplying any base value by this factor gives the total return since inception. Rolling returns (30-day, 90-day) and `ytd_return` are computed from cumulative factors over their respective windows. `rolling_30d_volatility` is the annualized standard deviation of daily returns over a 30-day window — a measure of how much the index fluctuates. **Cross-sectional aggregates** summarize the index's composition on each date: `stocks_count` (how many stocks had valid returns), and cap-weighted averages of P/E, P/B, and dividend yield.

```sql
CREATE TABLE gold.index_performance (
    id                          INT IDENTITY(1,1) PRIMARY KEY,
    _index                      VARCHAR(20)     NOT NULL,
    perf_date                   DATE            NOT NULL,

    daily_return                FLOAT,
    cumulative_factor           FLOAT,
    rolling_30d_return          FLOAT,
    rolling_90d_return          FLOAT,
    ytd_return                  FLOAT,
    rolling_30d_volatility      FLOAT,

    stocks_count                SMALLINT,
    avg_pe                      FLOAT,
    avg_pb                      FLOAT,
    avg_dividend_yield          FLOAT,
    avg_market_cap              BIGINT,

    _computed_at                DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE UNIQUE INDEX UX_gold_index_performance
    ON gold.index_performance (_index, perf_date);
GO
```

---

## Gold Analytics Logic

A z-score (also called a standard score) measures how many standard deviations a value lies from the mean of its group. The formula is `z = (value - group_mean) / group_std_dev`. A z-score of `+1.5` means the value is 1.5 standard deviations above the group average; `-2.0` means 2 standard deviations below. Z-scores are the foundation of all gold scoring because they make different metrics (P/E ratios, margins, yields) comparable on a common scale regardless of their original units or ranges.

All z-score computation and composite scoring happens in Python/pandas, not SQL. The helper functions live in `transforms/_gold_utils.py`. SQL is used only for data retrieval and the final write-back. For the pandas equivalents of the window functions used below (groupby, rolling averages, rank), see [05_py_aggregation_reshaping](https://alp78.github.io/elysium/03-Dataframes/Dataframes-Python/05_py_aggregation_reshaping).

### Z-Score by Group (`_gold_utils.py`)

#### zscore_by_group — standardize a column within sector/industry groups

The function computes z-scores within groups (e.g., within each sector of an index). `group_cols` defines the grouping — typically `['_index', 'sector']` so that a Technology stock's P/E is compared only to other Technology stocks in the same index. `min_peers` (default 3) prevents unstable z-scores in small groups: if a sector has fewer than 3 stocks with non-null values, the z-score would be statistically meaningless, so it returns `NaN`. The `fallback_cols` parameter (e.g., `['_index']`) provides a wider grouping — if the sector is too small, the function falls back to computing the z-score across the entire index instead of returning `NaN`.

```python
def zscore_by_group(df, col, group_cols, min_peers=3, fallback_cols=None):
    def _z(s):
        valid = s.dropna()
        if len(valid) < min_peers:
            return pd.Series(np.nan, index=s.index)
        return (s - s.mean()) / s.std()

    result = df.groupby(group_cols)[col].transform(_z)

    if fallback_cols is not None:
        mask = result.isna() & df[col].notna()
        if mask.any():
            fallback = df.groupby(fallback_cols)[col].transform(_z)
            result = result.where(~mask, fallback)

    return result
```

### Score Computation Logic

#### Relative Value score — inverted P/E, P/B z-scores (cheap = positive)

Valuation ratios like P/E are "lower is cheaper," but the scoring system uses "higher is better." The negation (`-`) inverts the z-score so that cheap stocks (low P/E relative to peers) get positive scores. Dividend yield is the exception — higher yield is already desirable, so it is not inverted. `nanmean` computes the row-wise average, ignoring `NaN` values so that a stock missing one ratio still gets a composite score from the remaining three.

```python
df['pe_zscore']        = -zscore_by_group(df, 'forward_pe', ['_index', 'sector'])
df['pb_zscore']        = -zscore_by_group(df, 'price_to_book', ['_index', 'sector'])
df['ev_ebitda_zscore'] = -zscore_by_group(df, 'ev_to_ebitda', ['_index', 'sector'])
df['yield_zscore']     =  zscore_by_group(df, 'dividend_yield', ['_index', 'sector'])
df['relative_value_score'] = nanmean(pe_z, pb_z, ev_z, yield_z)
```

#### Financial Health Flags — rules-based quality score (no z-scores)

Health flags are binary (pass/fail) thresholds, not z-scores. Each flag fires when a stock breaches a fixed financial threshold. These thresholds are standard financial analysis heuristics: a current ratio below 1.0 means the company cannot cover its short-term obligations, debt-to-equity above 200% indicates heavy leverage, negative free cash flow means the company is consuming more cash than it generates, and simultaneous declines in both revenue and earnings signal a deteriorating business. The `health_risk_level` string maps flag counts to dashboard-ready severity labels.

```python
df['flag_liquidity']      = current_ratio < 1
df['flag_leverage']       = debt_to_equity > 200
df['flag_cashburn']       = free_cashflow < 0
df['flag_double_decline'] = (earnings_growth < 0) & (revenue_growth < 0)
df['health_flags_count']  = sum of above 4 flags (0-4)
df['health_risk_level']   = {0: 'healthy', 1: 'watch', 2: 'warning', 3+: 'critical'}
```

#### Governance Score — inverted ISS scale (higher = better)

ISS (Institutional Shareholder Services) scores governance risk on a 1–10 scale where lower is better. The pipeline inverts this by subtracting the average risk score from 10, so that higher `governance_score` values mean better governance — consistent with all other gold scores where higher is better.

```python
avg_risk = nanmean(overall_risk, audit_risk, board_risk, compensation_risk, shareholder_rights_risk)
governance_score = 10.0 - avg_risk
```

---

## Daily Scores Transform

File: `ingestion/transforms/transform_scores_daily.py`

This transform is the most complex in the pipeline. It reads the latest daily signals from silver, joins them with stock metadata from the SCD2 dimension, computes SMA and price change metrics from OHLCV via SQL window functions, then runs all z-score and composite scoring logic in pandas before writing the results to `gold.scores_daily`. The transform runs once per pipeline execution and scores all stocks for the most recent signal date.

### Step 1: Find the Latest Signal Date

#### SELECT MAX(signal_date) — anchor date for all scoring

The transform first determines the most recent date for which silver has signal data. All subsequent queries filter to this single date, ensuring every stock is scored against the same point in time.

```sql
SELECT MAX(signal_date) FROM silver.signals_daily
```

**Result:** `2025-03-05`

### Step 2: Pull Signals Joined with Stock Metadata

#### JOIN signals + index_dim — pull latest signals with stock metadata

This query joins `silver.signals_daily` with `silver.index_dim` to combine trading signals (prices, ratios, analyst targets) with company metadata (sector, name, country, currency). The `d.is_current = 1` filter ensures only the active SCD2 dimension record is used — if a stock recently changed sector, this join picks up the new sector classification. The `WHERE s.signal_date = ?` restricts to the anchor date from Step 1. All 15 signal columns plus 4 dimension columns are pulled into a pandas DataFrame for scoring.

```sql
SELECT s._index,
       s.symbol,
       s.signal_date,
       s.current_price,
       s.forward_pe,
       s.price_to_book,
       s.ev_to_ebitda,
       s.dividend_yield,
       s.market_cap,
       s.beta,
       s.fifty_two_week_change,
       s.sandp_52_week_change,
       s.fifty_day_average,
       s.two_hundred_day_average,
       s.dist_from_52_week_high,
       s.target_median_price,
       s.recommendation_mean,
       s.upside_potential,
       d.sector,
       d.short_name,
       d.country,
       d.currency
FROM silver.signals_daily s
JOIN silver.index_dim d
    ON s._index = d._index
   AND s.symbol = d.symbol
   AND d.is_current = 1
WHERE s.signal_date = ?
```

#### Sample result — signals joined with stock dimension

| _index | symbol | signal_date | forward_pe | price_to_book | sector | country |
|--------|--------|-------------|-----------|--------------|--------|---------|
| market_index | ASML.AS | 2025-03-05 | 28.5 | 22.1 | Technology | Netherlands |
| market_index | MC.PA | 2025-03-05 | 25.3 | 8.4 | Consumer Cyclical | France |
| market_index | SAN.PA | 2025-03-05 | 6.8 | 0.5 | Financial Services | France |

### Step 3: Compute SMA 30/90 and Price Changes from OHLCV

The most complex SQL in the transform — a three-CTE query that uses window functions to compute moving averages and period returns in a single pass, avoiding multiple table scans. This query runs once per index (e.g., against `silver.index_europe_ohlcv`).

#### CTE with AVG() OVER — 30/90-day SMA, daily/5-day/YTD price changes

The `ranked` CTE computes all per-row metrics in a single scan: `ROW_NUMBER()` assigns `rn=1` to the most recent date per symbol (used in the final `WHERE` to select only the latest row); `AVG() OVER (ROWS BETWEEN N PRECEDING AND CURRENT ROW)` computes N-day simple moving averages as a sliding window over the preceding N rows; `COUNT()` over the same window tracks how many rows actually fell within the window (a stock with only 20 days of history would have `cnt_30 = 20`, not 30); `LAG()` retrieves the close price from 1 and 5 trading days ago for change-percentage calculations.

The `ytd` CTE finds the last trading day on or before January 1st of the current year using `DATEFROMPARTS(YEAR(GETDATE()), 1, 1)` — this is the YTD reference date. The `ytd_price` CTE joins back to `ranked` to get the actual close price on that reference date. The final `SELECT` uses `CASE WHEN cnt >= N` guards to return `NULL` if the window has insufficient data (a stock with only 10 days of history should not report a 30-day SMA). Division-by-zero is guarded by `CASE WHEN prev_close > 0`.

```sql
WITH ranked AS (
    SELECT symbol,
           date,
           [close],

           ROW_NUMBER() OVER (
               PARTITION BY symbol ORDER BY date DESC
           ) AS rn,

           AVG([close]) OVER (
               PARTITION BY symbol ORDER BY date
               ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
           ) AS sma_30,

           AVG([close]) OVER (
               PARTITION BY symbol ORDER BY date
               ROWS BETWEEN 89 PRECEDING AND CURRENT ROW
           ) AS sma_90,

           COUNT([close]) OVER (
               PARTITION BY symbol ORDER BY date
               ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
           ) AS cnt_30,

           COUNT([close]) OVER (
               PARTITION BY symbol ORDER BY date
               ROWS BETWEEN 89 PRECEDING AND CURRENT ROW
           ) AS cnt_90,

           LAG([close], 1) OVER (PARTITION BY symbol ORDER BY date) AS prev_close,
           LAG([close], 5) OVER (PARTITION BY symbol ORDER BY date) AS close_5d_ago

    FROM silver.index_europe_ohlcv
    WHERE [close] IS NOT NULL
),

ytd AS (
    SELECT symbol,
           MAX(CASE WHEN rn = 1 THEN [close] END) AS latest_close,
           MAX(CASE WHEN date <= DATEFROMPARTS(YEAR(GETDATE()), 1, 1)
                THEN date END) AS ytd_date
    FROM ranked
    GROUP BY symbol
),

ytd_price AS (
    SELECT y.symbol,
           r.[close] AS ytd_close
    FROM ytd y
    JOIN ranked r ON y.symbol = r.symbol AND r.date = y.ytd_date
)

SELECT r.symbol,
       CASE WHEN cnt_30 >= 30 THEN sma_30 END AS sma_30_close,
       CASE WHEN cnt_90 >= 90 THEN sma_90 END AS sma_90_close,
       CASE WHEN prev_close > 0
            THEN (r.[close] - prev_close) / prev_close
       END AS day_change_pct,
       CASE WHEN close_5d_ago > 0
            THEN (r.[close] - close_5d_ago) / close_5d_ago
       END AS five_day_change_pct,
       CASE WHEN yp.ytd_close > 0
            THEN (r.[close] - yp.ytd_close) / yp.ytd_close
       END AS ytd_change_pct
FROM ranked r
LEFT JOIN ytd_price yp ON r.symbol = yp.symbol
WHERE r.rn = 1
```

#### Sample result — SMA and price change metrics

| symbol | sma_30_close | sma_90_close | day_change_pct | five_day_change_pct | ytd_change_pct |
|--------|-------------|-------------|----------------|--------------------|----|
| ASML.AS | 685.20 | 702.15 | -0.012 | 0.034 | 0.087 |
| MC.PA | 835.40 | 812.90 | 0.005 | -0.008 | 0.045 |


### Step 4: Write to gold.scores_daily

#### DELETE + INSERT by date — refresh daily factor scores

The write uses a `DELETE + INSERT` pattern rather than an upsert: all existing rows for the target `score_date` are deleted, then the freshly scored DataFrame is bulk-inserted. This is simpler and faster than row-by-row comparison for a date-partitioned table where every row changes on every run. The pattern is idempotent — re-running the transform for the same date produces identical results.

```sql
DELETE FROM gold.scores_daily WHERE score_date = ?

INSERT INTO gold.scores_daily (
    _index, symbol, score_date, sector,
    pe_zscore, pb_zscore, ev_ebitda_zscore, yield_zscore,
    relative_value_score, relative_value_rank,
    relative_strength, sma_50_ratio, sma_200_ratio, dist_from_52w_high,
    momentum_score, momentum_rank,
    implied_upside, recommendation_mean, price_falling_analysts_bullish,
    sentiment_score, sentiment_rank,
    composite_score, composite_rank,
    sma_30_close, sma_90_close,
    market_cap, index_weight,
    short_name, country, current_price,
    day_change_pct, five_day_change_pct, ytd_change_pct, currency
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```

---

## Quarterly Scores Transform

File: `ingestion/transforms/transform_scores_quarterly.py`

This transform scores stocks on quality (profitability, capital efficiency), financial health (threshold-based flags), and governance (ISS risk scores). It reads the most recent quarterly fundamentals from silver, joins them with market cap and beta from daily signals, then computes z-scores and health flags in pandas before writing to `gold.scores_quarterly`.

### Step 1: Get Latest Quarterly Data Per Stock

#### Correlated subquery MAX(quarter) — most recent quarter per stock

The correlated subquery `WHERE q.as_of_date = (SELECT MAX(q2.as_of_date) ...)` selects only the most recent quarter for each `(_index, symbol)` pair. This is simpler than a `ROW_NUMBER()` approach when you only need the maximum value of one column. The join with `silver.index_dim` (filtered to `is_current = 1`) adds the stock's current sector classification for within-sector z-score grouping.

```sql
SELECT q._index,
       q.symbol,
       q.as_of_date,
       q.gross_margins,
       q.operating_margins,
       q.return_on_equity,
       q.revenue_growth,
       q.earnings_growth,
       q.debt_to_equity,
       q.current_ratio,
       q.free_cashflow,
       q.overall_risk,
       q.audit_risk,
       q.board_risk,
       q.compensation_risk,
       q.shareholder_rights_risk,
       d.sector
FROM silver.signals_quarterly q
JOIN silver.index_dim d
    ON q._index = d._index
   AND q.symbol = d.symbol
   AND d.is_current = 1
WHERE q.as_of_date = (
    SELECT MAX(q2.as_of_date)
    FROM silver.signals_quarterly q2
    WHERE q2._index = q._index
      AND q2.symbol = q.symbol
)
```


### Step 2: Get Latest Market Cap and Beta from Daily Signals

#### JOIN market_cap + beta — FCF yield and risk-adjusted return inputs

Market cap and beta are daily-frequency metrics (they change with the stock price), not quarterly. This separate query pulls them from the latest daily signal row so the quarterly transform can compute `fcf_yield` (free cash flow divided by market cap — a metric unavailable from quarterly data alone) and include `beta` in the gold output.

```sql
SELECT s._index,
       s.symbol,
       s.market_cap,
       s.beta
FROM silver.signals_daily s
WHERE s.signal_date = (
    SELECT MAX(s2.signal_date)
    FROM silver.signals_daily s2
    WHERE s2._index = s._index
      AND s2.symbol = s.symbol
)
```

---

## Index Performance Transform

File: `ingestion/transforms/transform_index_performance.py`

Unlike the daily and quarterly score transforms (which fully replace the target date), the index performance transform is **incremental** — it only processes dates newer than the last computed date. Additionally, it refreshes the last 7 days to account for late-arriving daily signals that may have corrected prices. The cap-weighted return calculation happens in pandas: each stock's daily return is multiplied by its market cap weight, then summed across all stocks to produce the index-level daily return.

### Step 1: Check OHLCV Table Exists

#### sys.tables existence check — verify dynamic table before querying

Because OHLCV tables are created dynamically per index (see [bronze DDL](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/bronze-layer-loading#dynamic-ohlcv-tables)), the transform must verify the table exists before querying it. If a new index was configured but `setup_index.py` has not yet run, this check prevents a runtime error.

```sql
SELECT 1
FROM sys.tables t
JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE s.name = ?
  AND t.name = ?
```

### Step 2: Find Latest Computed Date

#### SELECT MAX(perf_date) — incremental boundary for new dates only

Returns the most recent date already computed in gold for this index. The transform will process only dates after this boundary (minus 7 days for the refresh window). On the first run, this returns `NULL` and the transform processes the entire history.

```sql
SELECT MAX(perf_date)
FROM gold.index_performance
WHERE _index = ?
```

### Step 3: Pull OHLCV Close Prices

#### SELECT close — all prices for cap-weighted daily returns

Retrieves the full adjusted close price history for all stocks in the index. Rows with `NULL` close prices (from forward-filled rows with no real data) are excluded. The Python code computes daily returns as `(close_today - close_yesterday) / close_yesterday` using pandas `pct_change()`.

```sql
SELECT symbol,
       date,
       [close]
FROM silver.index_europe_ohlcv
WHERE [close] IS NOT NULL
ORDER BY symbol, date
```

### Step 4: Pull Market Cap and Fundamentals

#### SELECT market_cap, fundamentals — inputs for cap-weighted aggregation

Market cap is the weight in the cap-weighted return formula: `index_return = SUM(stock_return * market_cap) / SUM(market_cap)`. The valuation ratios (`forward_pe`, `price_to_book`, `dividend_yield`) are used to compute cross-sectional averages — the index-level average P/E, P/B, and yield on each date. Stocks with `NULL` or zero market cap are excluded to avoid division-by-zero in the weighting.

```sql
SELECT symbol,
       CAST(signal_date AS DATE) AS sig_date,
       market_cap,
       forward_pe,
       price_to_book,
       dividend_yield
FROM silver.signals_daily
WHERE _index = ?
  AND market_cap IS NOT NULL
  AND market_cap > 0
ORDER BY symbol, signal_date
```

### Step 5: Delete Refresh Window + Insert New Data

#### DELETE + INSERT rolling 7 days — refresh index performance window

The 7-day refresh window ensures that late-arriving signal corrections (market cap updates, price adjustments) propagate into the index performance calculation. Rows from `max_existing_date - 7` onward are deleted, then the full set of new and refreshed rows is inserted.

```sql
DELETE FROM gold.index_performance
WHERE _index = ?
  AND perf_date >= ?

INSERT INTO gold.index_performance (
    _index, perf_date, daily_return, cumulative_factor,
    rolling_30d_return, rolling_90d_return, ytd_return,
    rolling_30d_volatility, stocks_count,
    avg_pe, avg_pb, avg_dividend_yield, avg_market_cap
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```


---

## Dashboard Consumption Queries

The Blazor dashboard reads gold tables through C# repository classes using Dapper (a lightweight .NET micro-ORM that maps SQL result sets directly to C# objects). All queries use parameterized SQL with `@Param` syntax (Dapper's convention for named parameters) to prevent SQL injection. Because gold tables are denormalized, every dashboard query is a simple `SELECT` against a single table — no joins required at consumption time. The `@Index IS NULL OR _index = @Index` pattern makes parameters optional: passing `NULL` returns data for all indexes.

### Latest Index Performance Snapshot (Overview Page)

#### ROW_NUMBER() PARTITION BY _index — most recent performance per index

Maps to `IndexPerformanceRepository.GetLatestSnapshotAsync()` — returns one row per index with the most recent performance data. The subquery finds the maximum `perf_date` per index, and the outer query joins back to retrieve the full row. This is preferred over `ROW_NUMBER()` here because the query needs only one row per group and the subquery approach is more readable.

```sql
SELECT p._index AS [Index],
       p.perf_date AS PerfDate,
       p.daily_return AS DailyReturn,
       p.cumulative_factor AS CumulativeFactor,
       p.rolling_30d_return AS Rolling30dReturn,
       p.rolling_90d_return AS Rolling90dReturn,
       p.ytd_return AS YtdReturn,
       p.rolling_30d_volatility AS Rolling30dVolatility,
       p.stocks_count AS StocksCount,
       p.avg_pe AS AvgPe,
       p.avg_pb AS AvgPb,
       p.avg_dividend_yield AS AvgDividendYield,
       p.avg_market_cap AS AvgMarketCap
FROM gold.index_performance p
INNER JOIN (
    SELECT _index, MAX(perf_date) AS max_date
    FROM gold.index_performance
    GROUP BY _index
) latest
    ON p._index = latest._index
   AND p.perf_date = latest.max_date
ORDER BY p._index
```


### Historical Performance Time Series (Line Charts)

#### SELECT WHERE _index = @idx AND perf_date BETWEEN — full time series query

Maps to `IndexPerformanceRepository.GetPerformanceAsync()` — returns the complete performance time series for line chart rendering. All three parameters (`@Index`, `@From`, `@To`) are optional: passing `NULL` for any parameter removes that filter, returning all indexes and/or the full date range. Column aliases use PascalCase to match C# property naming conventions for automatic Dapper mapping.

```sql
SELECT _index AS [Index],
       perf_date AS PerfDate,
       daily_return AS DailyReturn,
       cumulative_factor AS CumulativeFactor,
       rolling_30d_return AS Rolling30dReturn,
       rolling_90d_return AS Rolling90dReturn,
       ytd_return AS YtdReturn,
       rolling_30d_volatility AS Rolling30dVolatility,
       stocks_count AS StocksCount,
       avg_pe AS AvgPe, avg_pb AS AvgPb,
       avg_dividend_yield AS AvgDividendYield,
       avg_market_cap AS AvgMarketCap
FROM gold.index_performance
WHERE (@Index IS NULL OR _index = @Index)
  AND (@From IS NULL OR perf_date >= @From)
  AND (@To IS NULL OR perf_date <= @To)
ORDER BY _index, perf_date
```

### Latest Daily Scores (Radar Chart, Signal Tables, Donut Chart)

#### CTE MAX(score_date) — latest factor scores for all stocks in an index

Maps to `ScoresRepository.GetDailyScoresAsync()` — returns all factor scores, ranks, and denormalized metadata for every stock in an index, as of the most recent scoring date. The CTE `max_dates` isolates the latest `score_date` per index, then the main query joins on both `_index` and `score_date` to retrieve the full row set. Results are ordered by `index_weight DESC` so that the largest stocks appear first in the dashboard table.

```sql
WITH max_dates AS (
    SELECT _index, MAX(score_date) AS max_date
    FROM gold.scores_daily
    WHERE @Index IS NULL OR _index = @Index
    GROUP BY _index
)
SELECT sd._index AS [Index], sd.symbol AS Symbol,
       sd.score_date AS ScoreDate, sd.sector AS Sector,
       sd.pe_zscore AS PeZscore, sd.pb_zscore AS PbZscore,
       sd.ev_ebitda_zscore AS EvEbitdaZscore, sd.yield_zscore AS YieldZscore,
       sd.relative_value_score AS RelativeValueScore,
       sd.relative_value_rank AS RelativeValueRank,
       sd.relative_strength AS RelativeStrength,
       sd.sma_50_ratio AS Sma50Ratio,
       sd.sma_200_ratio AS Sma200Ratio,
       sd.dist_from_52w_high AS DistFrom52wHigh,
       sd.momentum_score AS MomentumScore,
       sd.momentum_rank AS MomentumRank,
       sd.implied_upside AS ImpliedUpside,
       sd.recommendation_mean AS RecommendationMean,
       sd.price_falling_analysts_bullish AS PriceFallingAnalystsBullish,
       sd.sentiment_score AS SentimentScore,
       sd.sentiment_rank AS SentimentRank,
       sd.composite_score AS CompositeScore,
       sd.composite_rank AS CompositeRank,
       sd.sma_30_close AS Sma30Close, sd.sma_90_close AS Sma90Close,
       sd.market_cap AS MarketCap, sd.index_weight AS IndexWeight,
       sd.short_name AS ShortName, sd.country AS Country,
       sd.currency AS Currency, sd.current_price AS CurrentPrice,
       sd.day_change_pct AS DayChangePct,
       sd.five_day_change_pct AS FiveDayChangePct,
       sd.ytd_change_pct AS YtdChangePct
FROM gold.scores_daily sd
INNER JOIN max_dates md
    ON sd._index = md._index
   AND sd.score_date = md.max_date
ORDER BY sd._index, sd.index_weight DESC
```


### Latest Quarterly Scores (Quality & Governance)

#### ROW_NUMBER() PARTITION BY symbol — deduplicate to one row per stock

Maps to `ScoresRepository.GetQuarterlyScoresAsync()`. Unlike the daily scores query (which uses a CTE with `MAX`), this uses `ROW_NUMBER() OVER (PARTITION BY _index, symbol ORDER BY as_of_date DESC)` to assign `rn = 1` to the most recent quarter per stock, then filters `WHERE rn = 1`. This approach is preferred here because different stocks may have different latest `as_of_date` values (earnings release dates vary), so a single `MAX(as_of_date)` per index would miss stocks with older reporting dates.

```sql
WITH latest AS (
    SELECT *,
           ROW_NUMBER() OVER (
               PARTITION BY _index, symbol
               ORDER BY as_of_date DESC
           ) AS rn
    FROM gold.scores_quarterly
    WHERE @Index IS NULL OR _index = @Index
)
SELECT _index AS [Index], symbol AS Symbol,
       as_of_date AS AsOfDate, sector AS Sector,
       gross_margin_zscore AS GrossMarginZscore,
       roe_zscore AS RoeZscore,
       operating_margin_zscore AS OperatingMarginZscore,
       leverage_zscore AS LeverageZscore,
       fcf_yield AS FcfYield, fcf_yield_zscore AS FcfYieldZscore,
       quality_score AS QualityScore, quality_rank AS QualityRank,
       flag_liquidity AS FlagLiquidity, flag_leverage AS FlagLeverage,
       flag_cashburn AS FlagCashburn, flag_double_decline AS FlagDoublDecline,
       health_flags_count AS HealthFlagsCount,
       health_risk_level AS HealthRiskLevel,
       overall_risk AS OverallRisk, audit_risk AS AuditRisk,
       board_risk AS BoardRisk, compensation_risk AS CompensationRisk,
       shareholder_rights_risk AS ShareholderRightsRisk,
       governance_score AS GovernanceScore, governance_rank AS GovernanceRank,
       beta AS Beta, governance_vs_quality AS GovernanceVsQuality
FROM latest
WHERE rn = 1
ORDER BY _index, quality_rank
```


### OHLCV Chart with Server-Side Moving Averages (Stock Explorer)

#### AVG() OVER ROWS BETWEEN — server-side SMA correct at date boundaries

Maps to `StockRepository.GetOhlcvAsync()` — computes SMA 30/90 via SQL window functions so the chart renders moving average lines without client-side recalculation. The `adj_ratio` (`adj_close / [close]`) converts raw OHLC prices to split-adjusted values: if a stock split 2:1, historical raw prices are halved but `adj_close` is retroactively corrected — multiplying `[open]`, `high`, and `low` by this ratio aligns all price columns to the adjusted scale. The `CASE WHEN cnt >= N` guards return `NULL` for SMAs with insufficient data points, preventing the chart from drawing misleading averages at the start of the series.

```sql
WITH cte AS (
    SELECT symbol, date,
           [open], high, low, [close], adj_close, volume,

           CASE WHEN [close] <> 0
                THEN adj_close / [close]
                ELSE 1
           END AS adj_ratio,

           AVG(adj_close) OVER (
               ORDER BY date ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
           ) AS sma_30,

           AVG(adj_close) OVER (
               ORDER BY date ROWS BETWEEN 89 PRECEDING AND CURRENT ROW
           ) AS sma_90,

           COUNT(adj_close) OVER (ORDER BY date ROWS BETWEEN 29 PRECEDING AND CURRENT ROW) AS cnt_30,
           COUNT(adj_close) OVER (ORDER BY date ROWS BETWEEN 89 PRECEDING AND CURRENT ROW) AS cnt_90

    FROM silver.index_europe_ohlcv
    WHERE symbol = @Symbol
      AND adj_close IS NOT NULL
)
SELECT symbol AS Symbol,
       date AS Date,
       [open] * adj_ratio AS [Open],
       high * adj_ratio AS High,
       low * adj_ratio AS Low,
       adj_close AS [Close],
       [close] AS RawClose,
       adj_close AS AdjClose,
       volume AS Volume,
       CASE WHEN cnt_30 >= 30 THEN sma_30 END AS Sma30,
       CASE WHEN cnt_90 >= 90 THEN sma_90 END AS Sma90
FROM cte
WHERE (@From IS NULL OR date >= @From)
  AND (@To IS NULL OR date <= @To)
ORDER BY date
```


---

### Key SQL Techniques Used in Gold Transforms

The following table summarizes the T-SQL patterns and SQL Server features used across gold transforms and dashboard queries. Window functions are the dominant pattern — they compute aggregates over sliding windows without collapsing the result set, enabling SMA, LAG, and ROW_NUMBER calculations in a single query pass.

| Technique | Where | Why |
|-----------|-------|-----|
| `ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...)` | Latest-row queries | Get the most recent record per group without subquery |
| `AVG() OVER (ROWS BETWEEN N PRECEDING AND CURRENT ROW)` | SMA computation | Moving averages computed entirely in SQL — no client-side loop |
| `LAG(col, N) OVER (ORDER BY date)` | Price changes | Previous-day and 5-day-ago close for change % calculation |
| `CASE WHEN cnt >= N THEN value END` | SMA validation | Only output MA if we have enough data points |
| Correlated subquery (`WHERE date = (SELECT MAX ...)`) | Latest per group | Simpler than ROW_NUMBER when you only need the max date |
| `DATEFROMPARTS(YEAR(GETDATE()), 1, 1)` | YTD calculation | First day of current year for YTD reference price |
| Parameterized queries (`@Param`) | Dashboard queries | Prevent SQL injection — all Dapper queries are parameterized |
| `DELETE + INSERT` | scores_daily, scores_quarterly | Replace scores for a specific date (idempotent re-scoring) |
| 7-day refresh window | index_performance | Handles late-arriving signals without full recompute |

---

## Gold Freshness Checks

These diagnostic queries verify that gold data is up to date after a pipeline run. If the maximum dates are stale, the upstream silver transforms or the gold transforms themselves may have failed.

#### SELECT MAX(score_date), MAX(perf_date) — gold freshness check

Returns the most recent scoring date and performance date for each index. Both should match (or be within one trading day of) the current date after a successful pipeline run.

```sql
SELECT _index, MAX(score_date) FROM gold.scores_daily GROUP BY _index
SELECT _index, MAX(perf_date) FROM gold.index_performance GROUP BY _index
```

#### DELETE WHERE perf_date > today — cleanup future-dated gold rows

If the pipeline accidentally computed performance for future dates (e.g., due to a timezone mismatch), this cleanup removes those rows. After cleanup, re-run the pipeline to recompute correctly.

```sql
DELETE FROM gold.index_performance WHERE perf_date > CAST(GETDATE() AS DATE);
```

---

### Related Notes

- [silver-transforms](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/silver-transforms) — upstream: cleaned data that feeds all gold transforms
- [bronze-layer-loading](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/bronze-layer-loading) — raw data layer and DDL conventions
- [medallion-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/medallion-architecture) — architectural context for all three layers
- [05_py_aggregation_reshaping](https://alp78.github.io/elysium/03-Dataframes/Dataframes-Python/05_py_aggregation_reshaping) — pandas groupby, rolling, and rank equivalents of the SQL window functions used here
- [dbt-mart-models](https://alp78.github.io/elysium/11-dbt/Modeling/dbt-mart-models) — dbt's declarative approach to the same gold-layer role

