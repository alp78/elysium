---
type: how-to
category: data-engineering
technology: [sql-server, python]
tags: [python, sql, sql-server, tsql, medallion-project]
aliases: [Gold Layer, Gold Transforms, Silver to Gold, Gold DDL, Scoring Tables, Pre-computed Analytics, Factor Scores]
keywords: [gold layer, medallion architecture, z-score, zscore by group, factor scores, relative value, momentum, sentiment, quality score, governance score, health flags, index performance, cap-weighted, ROW_NUMBER, window functions, LAG, AVG OVER ROWS, CTE, SMA 30, SMA 90, moving average, composite score, composite rank, scores_daily, scores_quarterly, index_performance, dashboard ready, pre-computed, gold schema]
description: "Complete SQL and Python patterns for the example gold layer — covers all gold table DDL, z-score computation, financial health flags, governance scoring, cap-weighted index performance, moving average CTEs, and dashboard consumption queries."
created: 2026-03-22
updated: 2026-03-22
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

The gold layer contains pre-computed analytics scores ready for dashboard consumption. No raw data lives here — only derived metrics with z-scores, ranks, health flags, and performance calculations. All gold transforms read from [silver](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/silver-transforms) and write to gold tables. In dbt, the equivalent role is served by [mart models](https://alp78.github.io/elysium/11-dbt/Modeling/dbt-mart-models) that expose business-ready datasets.

**Pipeline flow:** [Silver](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/silver-transforms) → Python + pandas → Gold tables → Blazor dashboard

> [!info] Gold Layer Role
>
> Gold is the presentation layer. Data in gold is denormalized, scored, ranked, and ready to display. No joins required for the dashboard — every query returns display-ready values. Gold tables are refreshed on every pipeline run; stale rows are deleted and replaced.

---

## Gold Table DDL

File: `db/ddl/gold_schema.sql`

### gold.scores_daily — Factor Scores

Stores relative value, momentum, sentiment, and composite factor scores for each stock per day. Also includes SMA-based price metrics computed from OHLCV.

#### CREATE TABLE gold.scores_daily — factor scores DDL

```sql
CREATE TABLE gold.scores_daily (
    id                          INT IDENTITY(1,1) PRIMARY KEY,
    _index                      VARCHAR(20)     NOT NULL,
    symbol                      VARCHAR(20)     NOT NULL,
    score_date                  DATE            NOT NULL,
    sector                      NVARCHAR(100),

    -- Relative Value (z-scores, inverted: cheap = positive)
    pe_zscore                   FLOAT,           -- P/E z-score within sector
    pb_zscore                   FLOAT,           -- P/B z-score
    ev_ebitda_zscore            FLOAT,           -- EV/EBITDA z-score
    yield_zscore                FLOAT,           -- dividend yield z-score (not inverted)
    relative_value_score        FLOAT,           -- composite of above 4
    relative_value_rank         SMALLINT,        -- rank within index (1 = cheapest)

    -- Momentum
    relative_strength           FLOAT,           -- 52w return vs benchmark
    sma_50_ratio                FLOAT,           -- price / 50-day MA
    sma_200_ratio               FLOAT,           -- price / 200-day MA
    dist_from_52w_high          FLOAT,           -- how far below 52-week high
    momentum_score              FLOAT,
    momentum_rank               SMALLINT,

    -- Analyst Sentiment
    implied_upside              FLOAT,           -- (target / price) - 1
    recommendation_mean         FLOAT,           -- 1-5 scale
    price_falling_analysts_bullish BIT,          -- divergence flag
    sentiment_score             FLOAT,
    sentiment_rank              SMALLINT,

    -- Composite (average of value + momentum + sentiment)
    composite_score             FLOAT,
    composite_rank              SMALLINT,

    -- From OHLCV (computed via SQL window functions)
    sma_30_close                FLOAT,           -- 30-day moving average
    sma_90_close                FLOAT,           -- 90-day moving average
    market_cap                  BIGINT,
    index_weight                FLOAT,           -- market_cap / sum(market_cap)
    short_name                  NVARCHAR(200),
    country                     NVARCHAR(100),
    currency                    VARCHAR(10),
    current_price               FLOAT,
    day_change_pct              FLOAT,           -- daily price change %
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

```sql
CREATE TABLE gold.scores_quarterly (
    id                          INT IDENTITY(1,1) PRIMARY KEY,
    _index                      VARCHAR(20)     NOT NULL,
    symbol                      VARCHAR(20)     NOT NULL,
    as_of_date                  DATE            NOT NULL,
    sector                      NVARCHAR(100),

    -- Quality / Moat (z-scores within sector)
    gross_margin_zscore         FLOAT,
    roe_zscore                  FLOAT,
    operating_margin_zscore     FLOAT,
    leverage_zscore             FLOAT,           -- inverted: lower D/E = positive
    fcf_yield                   FLOAT,           -- free_cashflow / market_cap
    fcf_yield_zscore            FLOAT,
    quality_score               FLOAT,           -- composite of above
    quality_rank                SMALLINT,

    -- Financial Health Flags (binary alerts)
    flag_liquidity              BIT,             -- current ratio < 1
    flag_leverage               BIT,             -- D/E > 200%
    flag_cashburn               BIT,             -- FCF < 0
    flag_double_decline         BIT,             -- revenue AND margin both falling
    health_flags_count          TINYINT,         -- count of active flags (0-4)
    health_risk_level           VARCHAR(10),     -- 'healthy'/'watch'/'warning'/'critical'

    -- Governance (ISS risk, 1-10 scale)
    overall_risk                FLOAT,
    audit_risk                  FLOAT,
    board_risk                  FLOAT,
    compensation_risk           FLOAT,
    shareholder_rights_risk     FLOAT,
    governance_score            FLOAT,           -- 10 - avg(risk scores), higher = better
    governance_rank             SMALLINT,
    beta                        FLOAT,           -- from daily signals
    governance_vs_quality       FLOAT,           -- gap between governance and quality score

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

```sql
CREATE TABLE gold.index_performance (
    id                          INT IDENTITY(1,1) PRIMARY KEY,
    _index                      VARCHAR(20)     NOT NULL,
    perf_date                   DATE            NOT NULL,

    -- Cap-weighted returns
    daily_return                FLOAT,           -- weighted avg daily return across stocks
    cumulative_factor           FLOAT,           -- (1 + r1)(1 + r2)... product from day 1
    rolling_30d_return          FLOAT,           -- 30-day rolling total return
    rolling_90d_return          FLOAT,
    ytd_return                  FLOAT,           -- year-to-date cumulative return
    rolling_30d_volatility      FLOAT,           -- annualized 30-day rolling std dev

    -- Cross-sectional aggregates
    stocks_count                SMALLINT,        -- number of stocks with valid returns
    avg_pe                      FLOAT,           -- cap-weighted average P/E
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

Z-score computation and composite scoring happens in Python/pandas (not SQL). The helper functions live in `transforms/_gold_utils.py`. SQL is used for data retrieval and the final write-back. For the pandas equivalents of the window functions used below (groupby, rolling averages, rank), see [05_py_aggregation_reshaping](https://alp78.github.io/elysium/03-Dataframes/Dataframes-Python/05_py_aggregation_reshaping).

### Z-Score by Group (`_gold_utils.py`)

#### zscore_by_group — standardize a column within sector/industry groups

```python
# _gold_utils.py — computes z-scores within groups (e.g. within sector)

def zscore_by_group(df, col, group_cols, min_peers=3, fallback_cols=None):
    """
    Standardize a column within groups.
    - group_cols: e.g. ['_index', 'sector'] — z-score PE within sector
    - min_peers: need at least 3 stocks in a group (otherwise NaN)
    - fallback_cols: if group is too small, fall back to broader group (e.g. ['_index'])

    Formula: z = (value - group_mean) / group_std_dev
    """
    def _z(s):
        valid = s.dropna()
        if len(valid) < min_peers:
            return pd.Series(np.nan, index=s.index)
        return (s - s.mean()) / s.std()

    result = df.groupby(group_cols)[col].transform(_z)

    # If a sector has < 3 stocks, fall back to index-wide z-score
    if fallback_cols is not None:
        mask = result.isna() & df[col].notna()
        if mask.any():
            fallback = df.groupby(fallback_cols)[col].transform(_z)
            result = result.where(~mask, fallback)

    return result
```

### Score Computation Logic

#### Relative Value score — inverted P/E, P/B z-scores (cheap = positive)

```python
df['pe_zscore']        = -zscore_by_group(df, 'forward_pe', ['_index', 'sector'])   # inverted
df['pb_zscore']        = -zscore_by_group(df, 'price_to_book', ['_index', 'sector']) # inverted
df['ev_ebitda_zscore'] = -zscore_by_group(df, 'ev_to_ebitda', ['_index', 'sector'])  # inverted
df['yield_zscore']     =  zscore_by_group(df, 'dividend_yield', ['_index', 'sector']) # not inverted
df['relative_value_score'] = nanmean(pe_z, pb_z, ev_z, yield_z)  # row-wise average
```

#### Financial Health Flags — rules-based quality score (no z-scores)

```python
df['flag_liquidity']      = current_ratio < 1        # can't cover short-term debts
df['flag_leverage']       = debt_to_equity > 200      # over-leveraged (2x equity)
df['flag_cashburn']       = free_cashflow < 0          # burning cash
df['flag_double_decline'] = earnings_growth < 0 AND revenue_growth < 0  # both falling
df['health_flags_count']  = sum of above 4 flags (0-4)
df['health_risk_level']   = {0: 'healthy', 1: 'watch', 2: 'warning', 3+: 'critical'}
```

#### Governance Score — inverted ISS scale (higher = better)

```python
avg_risk = nanmean(overall_risk, audit_risk, board_risk, compensation_risk, shareholder_rights_risk)
governance_score = 10.0 - avg_risk    # higher = better governance (inverted from ISS scale)
```

---

## Daily Scores Transform

File: `ingestion/transforms/transform_scores_daily.py`

### Step 1: Find the Latest Signal Date

#### SELECT MAX(signal_date) — anchor date for all scoring

```sql
-- transform_scores_daily.py (line 36)

SELECT MAX(signal_date) FROM silver.signals_daily
```

**Result:** `2025-03-05`

### Step 2: Pull Signals Joined with Stock Metadata

#### JOIN signals + index_dim — pull latest signals with stock metadata

```sql
-- transform_scores_daily.py (lines 45-58)

SELECT s._index,                    -- e.g. 'market_index'
       s.symbol,                     -- e.g. 'ASML.AS'
       s.signal_date,               -- e.g. '2025-03-05'
       s.current_price,             -- current market price
       s.forward_pe,                -- forward P/E ratio
       s.price_to_book,             -- price-to-book
       s.ev_to_ebitda,              -- enterprise value / EBITDA
       s.dividend_yield,            -- annual yield
       s.market_cap,                -- market cap
       s.beta,                      -- systematic risk
       s.fifty_two_week_change,     -- 52-week return
       s.sandp_52_week_change,      -- benchmark 52-week return
       s.fifty_day_average,         -- 50-day SMA
       s.two_hundred_day_average,   -- 200-day SMA
       s.dist_from_52_week_high,    -- distance from 52w high (negative)
       s.target_median_price,       -- analyst target
       s.recommendation_mean,       -- 1=Strong Buy ... 5=Strong Sell
       s.upside_potential,          -- (target / price) - 1
       d.sector,                    -- from silver.index_dim
       d.short_name,                -- company short name
       d.country,                   -- country of incorporation
       d.currency                   -- trading currency
FROM silver.signals_daily s
JOIN silver.index_dim d
    ON s._index = d._index           -- same index
   AND s.symbol = d.symbol           -- same stock
   AND d.is_current = 1              -- only active dimension records
WHERE s.signal_date = ?              -- latest date only
```

#### Sample result — signals joined with stock dimension

| _index | symbol | signal_date | forward_pe | price_to_book | sector | country |
|--------|--------|-------------|-----------|--------------|--------|---------|
| market_index | ASML.AS | 2025-03-05 | 28.5 | 22.1 | Technology | Netherlands |
| market_index | MC.PA | 2025-03-05 | 25.3 | 8.4 | Consumer Cyclical | France |
| market_index | SAN.PA | 2025-03-05 | 6.8 | 0.5 | Financial Services | France |

### Step 3: Compute SMA 30/90 and Price Changes from OHLCV

The most complex SQL in the transform — uses window functions and CTEs to compute moving averages and period returns in a single query.

#### CTE with AVG() OVER — 30/90-day SMA, daily/5-day/YTD price changes

```sql
-- transform_scores_daily.py (lines 179-221)
-- Runs once per index (e.g. silver.index_europe_ohlcv)

WITH ranked AS (
    SELECT symbol,
           date,
           [close],                                              -- adjusted close price

           -- Row numbering: rn=1 is the most recent date per symbol
           ROW_NUMBER() OVER (
               PARTITION BY symbol ORDER BY date DESC
           ) AS rn,

           -- 30-day simple moving average (window of last 30 rows)
           AVG([close]) OVER (
               PARTITION BY symbol ORDER BY date
               ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
           ) AS sma_30,

           -- 90-day simple moving average
           AVG([close]) OVER (
               PARTITION BY symbol ORDER BY date
               ROWS BETWEEN 89 PRECEDING AND CURRENT ROW
           ) AS sma_90,

           -- Count of rows in the window (to validate we have enough data)
           COUNT([close]) OVER (
               PARTITION BY symbol ORDER BY date
               ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
           ) AS cnt_30,

           COUNT([close]) OVER (
               PARTITION BY symbol ORDER BY date
               ROWS BETWEEN 89 PRECEDING AND CURRENT ROW
           ) AS cnt_90,

           -- Previous day's close (for daily change %)
           LAG([close], 1) OVER (PARTITION BY symbol ORDER BY date) AS prev_close,

           -- Close from 5 trading days ago (for 5-day change %)
           LAG([close], 5) OVER (PARTITION BY symbol ORDER BY date) AS close_5d_ago

    FROM silver.index_europe_ohlcv
    WHERE [close] IS NOT NULL
),

-- Find the last trading day of the previous year for YTD calculation
ytd AS (
    SELECT symbol,
           MAX(CASE WHEN rn = 1 THEN [close] END) AS latest_close,
           MAX(CASE WHEN date <= DATEFROMPARTS(YEAR(GETDATE()), 1, 1)
                THEN date END) AS ytd_date
    FROM ranked
    GROUP BY symbol
),

-- Get the actual close price on the YTD reference date
ytd_price AS (
    SELECT y.symbol,
           r.[close] AS ytd_close
    FROM ytd y
    JOIN ranked r ON y.symbol = r.symbol AND r.date = y.ytd_date
)

-- Final output: only the most recent row per symbol
SELECT r.symbol,
       CASE WHEN cnt_30 >= 30 THEN sma_30 END AS sma_30_close,      -- NULL if < 30 days of data
       CASE WHEN cnt_90 >= 90 THEN sma_90 END AS sma_90_close,      -- NULL if < 90 days
       CASE WHEN prev_close > 0
            THEN (r.[close] - prev_close) / prev_close               -- daily change %
       END AS day_change_pct,
       CASE WHEN close_5d_ago > 0
            THEN (r.[close] - close_5d_ago) / close_5d_ago           -- 5-day change %
       END AS five_day_change_pct,
       CASE WHEN yp.ytd_close > 0
            THEN (r.[close] - yp.ytd_close) / yp.ytd_close           -- YTD change %
       END AS ytd_change_pct
FROM ranked r
LEFT JOIN ytd_price yp ON r.symbol = yp.symbol
WHERE r.rn = 1          -- most recent date only
```

#### Sample result — SMA and price change metrics

| symbol | sma_30_close | sma_90_close | day_change_pct | five_day_change_pct | ytd_change_pct |
|--------|-------------|-------------|----------------|--------------------|----|
| ASML.AS | 685.20 | 702.15 | -0.012 | 0.034 | 0.087 |
| MC.PA | 835.40 | 812.90 | 0.005 | -0.008 | 0.045 |


### Step 4: Write to gold.scores_daily

#### DELETE + INSERT by date — refresh daily factor scores

```sql
-- transform_scores_daily.py (line 240)

DELETE FROM gold.scores_daily WHERE score_date = ?   -- e.g. '2025-03-05'

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

### Step 1: Get Latest Quarterly Data Per Stock

#### Correlated subquery MAX(quarter) — most recent quarter per stock

```sql
-- transform_scores_quarterly.py (lines 38-53)

SELECT q._index,
       q.symbol,
       q.as_of_date,
       q.gross_margins,               -- gross profit / revenue
       q.operating_margins,           -- operating income / revenue
       q.return_on_equity,            -- net income / equity
       q.revenue_growth,              -- QoQ revenue change
       q.earnings_growth,             -- QoQ earnings change
       q.debt_to_equity,              -- total debt / equity (%)
       q.current_ratio,               -- current assets / current liabilities
       q.free_cashflow,               -- operating cash - capex
       q.overall_risk,                -- ISS governance risk (1-10)
       q.audit_risk,
       q.board_risk,
       q.compensation_risk,
       q.shareholder_rights_risk,
       d.sector                       -- from silver.index_dim
FROM silver.signals_quarterly q
JOIN silver.index_dim d
    ON q._index = d._index
   AND q.symbol = d.symbol
   AND d.is_current = 1               -- current dimension record only
WHERE q.as_of_date = (
    -- Correlated subquery: get the latest quarter for each stock
    SELECT MAX(q2.as_of_date)
    FROM silver.signals_quarterly q2
    WHERE q2._index = q._index
      AND q2.symbol = q.symbol
)
```


### Step 2: Get Latest Market Cap and Beta from Daily Signals

#### JOIN market_cap + beta — FCF yield and risk-adjusted return inputs

```sql
-- transform_scores_quarterly.py (lines 66-73)

SELECT s._index,
       s.symbol,
       s.market_cap,                  -- needed to compute FCF yield
       s.beta                         -- systematic risk
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

This transform is **incremental** — it only processes new dates, and refreshes the last 7 days for late-arriving signals.

### Step 1: Check OHLCV Table Exists

#### OBJECT_ID IS NOT NULL — existence check before querying dynamic table

```sql
-- transform_index_performance.py (lines 67-70)

SELECT 1
FROM sys.tables t
JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE s.name = ?       -- e.g. 'silver'
  AND t.name = ?       -- e.g. 'index_europe_ohlcv'
```

### Step 2: Find Latest Computed Date

#### SELECT MAX(perf_date) — incremental boundary for new dates only

```sql
-- transform_index_performance.py (lines 77-79)

SELECT MAX(perf_date)
FROM gold.index_performance
WHERE _index = ?       -- e.g. 'market_index'
```

### Step 3: Pull OHLCV Close Prices

#### SELECT close, LAG(close) — all prices for cap-weighted daily returns

```sql
-- transform_index_performance.py (lines 84-89)

SELECT symbol,
       date,
       [close]          -- adjusted close price
FROM silver.index_europe_ohlcv
WHERE [close] IS NOT NULL
ORDER BY symbol, date
```

### Step 4: Pull Market Cap and Fundamentals

#### SUM(market_cap * daily_return) / SUM(market_cap) — cap-weighted aggregation

```sql
-- transform_index_performance.py (lines 105-112)

SELECT symbol,
       CAST(signal_date AS DATE) AS sig_date,
       market_cap,                   -- for cap-weighted returns
       forward_pe,                   -- for cross-sectional avg PE
       price_to_book,               -- for avg PB
       dividend_yield               -- for avg yield
FROM silver.signals_daily
WHERE _index = ?
  AND market_cap IS NOT NULL
  AND market_cap > 0
ORDER BY symbol, signal_date
```

### Step 5: Delete Refresh Window + Insert New Data

#### DELETE + INSERT rolling 7 days — refresh index performance window

```sql
-- transform_index_performance.py (lines 262-265)

DELETE FROM gold.index_performance
WHERE _index = ?
  AND perf_date >= ?     -- max_existing - 7 days

INSERT INTO gold.index_performance (
    _index, perf_date, daily_return, cumulative_factor,
    rolling_30d_return, rolling_90d_return, ytd_return,
    rolling_30d_volatility, stocks_count,
    avg_pe, avg_pb, avg_dividend_yield, avg_market_cap
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```


---

## Dashboard Consumption Queries

The Blazor dashboard reads gold tables through C# repositories using Dapper. All queries use parameterized SQL (`@Index`, `@From`, `@To`) to prevent injection.

### Latest Index Performance Snapshot (Overview Page)

#### ROW_NUMBER() PARTITION BY _index — most recent performance per index

Maps to `IndexPerformanceRepository.GetLatestSnapshotAsync()` — returns one row per index with the most recent performance data.

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
    -- Subquery: find the latest date per index
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

Maps to `IndexPerformanceRepository.GetPerformanceAsync()` — full time series, optionally filtered by index and date range.

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
WHERE (@Index IS NULL OR _index = @Index)       -- optional index filter
  AND (@From IS NULL OR perf_date >= @From)     -- optional date range
  AND (@To IS NULL OR perf_date <= @To)
ORDER BY _index, perf_date
```

### Latest Daily Scores (Radar Chart, Signal Tables, Donut Chart)

#### CTE MAX(score_date) — latest factor scores for all stocks in an index

Maps to `ScoresRepository.GetDailyScoresAsync()` — latest scores for all stocks in an index (or all indices).

```sql
WITH max_dates AS (
    -- Find the latest score_date per index
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

Maps to `ScoresRepository.GetQuarterlyScoresAsync()` — deduplicates to one row per stock using the most recent quarter.

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

Maps to `StockRepository.GetOhlcvAsync()` — computes SMA 30/90 via SQL window functions to avoid client-side recalculation.

```sql
WITH cte AS (
    SELECT symbol, date,
           [open], high, low, [close], adj_close, volume,

           -- Adjustment ratio: converts raw OHLC to split-adjusted values
           CASE WHEN [close] <> 0
                THEN adj_close / [close]
                ELSE 1
           END AS adj_ratio,

           -- 30-day moving average of adjusted close
           AVG(adj_close) OVER (
               ORDER BY date ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
           ) AS sma_30,

           -- 90-day moving average
           AVG(adj_close) OVER (
               ORDER BY date ROWS BETWEEN 89 PRECEDING AND CURRENT ROW
           ) AS sma_90,

           -- Window row counts (for validation)
           COUNT(adj_close) OVER (ORDER BY date ROWS BETWEEN 29 PRECEDING AND CURRENT ROW) AS cnt_30,
           COUNT(adj_close) OVER (ORDER BY date ROWS BETWEEN 89 PRECEDING AND CURRENT ROW) AS cnt_90

    FROM silver.index_europe_ohlcv
    WHERE symbol = @Symbol
      AND adj_close IS NOT NULL
)
SELECT symbol AS Symbol,
       date AS Date,
       [open] * adj_ratio AS [Open],         -- split-adjusted open
       high * adj_ratio AS High,             -- split-adjusted high
       low * adj_ratio AS Low,               -- split-adjusted low
       adj_close AS [Close],                 -- adjusted close (used for charting)
       [close] AS RawClose,                  -- unadjusted close (used for tooltip)
       adj_close AS AdjClose,                -- same as Close (for explicit reference)
       volume AS Volume,
       CASE WHEN cnt_30 >= 30 THEN sma_30 END AS Sma30,   -- NULL if < 30 data points
       CASE WHEN cnt_90 >= 90 THEN sma_90 END AS Sma90    -- NULL if < 90 data points
FROM cte
WHERE (@From IS NULL OR date >= @From)
  AND (@To IS NULL OR date <= @To)
ORDER BY date
```


---

### Key SQL Techniques Used in Gold Transforms

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

#### SELECT MAX(score_date), MAX(perf_date) — gold freshness check

```sql
SELECT _index, MAX(score_date) FROM gold.scores_daily GROUP BY _index
SELECT _index, MAX(perf_date) FROM gold.index_performance GROUP BY _index
```

#### DELETE WHERE score_date < cutoff — cleanup stale gold rows

```sql
-- Delete stale gold rows if needed
DELETE FROM gold.index_performance WHERE perf_date > CAST(GETDATE() AS DATE);
```

Then re-run the pipeline to rebuild: `gcloud run jobs execute analytics-pipeline --region=europe-west1 --args='--from,14,--to,16'`

---

### Related Notes

- [silver-transforms](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/silver-transforms) — upstream: cleaned data that feeds all gold transforms
- [bronze-layer-loading](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/bronze-layer-loading) — raw data layer
- [medallion-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/medallion-architecture) — architectural context
- the pipeline steps — pipeline steps 14–16 drive gold transforms
- common pipeline errors — troubleshooting stuck index_performance and stale scores
