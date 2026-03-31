---
type: reference
category: sql-server
technology: [sql-server, t-sql, bigquery]
tags: [performance, sql, bigquery, sql-server, tsql]
aliases: [PIT, point-in-time, effective-dated, bi-temporal, as-of query, weight normalization, constituent list, rebalancing, index reconstitution, SCD Type 2, temporal join]
keywords: [point-in-time, PIT query, effective date, expiry date, bi-temporal, valid time, transaction time, system versioning, temporal table, weight normalization, residual distribution, rounding error, constituent membership, rebalancing, reconstitution, free float, capping factor, index divisor, covering index, columnstore, LAST_VALUE IGNORE NULLS, forward fill, ESG temporal alignment, reconciliation, audit, EU BMR]
description: "Point-in-Time data integrity patterns for stock index calculation and ESG scoring — covers effective-dated constituent lists, weight normalization to exactly 1.00000000, bi-temporal modeling, and performance tuning for large-scale price/ESG joins."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Point-in-Time Data Integrity

> [!quote]
> "In financial computing, the answer is not approximately right — it is exactly right, or it is wrong."
>
> — **Patrick Burns**

> [!danger] Why This Matters
>
> A stock index provider must answer: "What were the exact constituents, weights, and ESG scores of Index X on Date Y?" with full audit trail. Getting this wrong means publishing incorrect index levels — a regulatory and reputational catastrophe under EU BMR.

---

## Effective-Dated Constituent Lists

Index constituents change at every quarterly rebalancing and on corporate action events (mergers, delistings, spin-offs). A naive `SELECT * FROM constituents WHERE index_code = 'X'` returns the current state, not the historical state.

### T-SQL: SCD Type 2 for Constituent Membership

```sql
CREATE TABLE dbo.index_constituent_history (
    constituent_id    INT IDENTITY PRIMARY KEY,
    index_code        VARCHAR(20)    NOT NULL,
    instrument_isin   CHAR(12)       NOT NULL,
    effective_date    DATE           NOT NULL,
    expiry_date       DATE           NOT NULL DEFAULT '9999-12-31',
    weight_pct        DECIMAL(18,10) NOT NULL,
    free_float_factor DECIMAL(8,6),
    capping_factor    DECIMAL(8,6)   DEFAULT 1.000000,
    change_reason     VARCHAR(50),    -- REBALANCE, IPO_ADD, MERGER_REMOVE, DELIST
    loaded_at         DATETIME2(3)   DEFAULT SYSUTCDATETIME(),

    CONSTRAINT uq_constituent
        UNIQUE (index_code, instrument_isin, effective_date)
);

-- Covering index for PIT queries
CREATE NONCLUSTERED INDEX ix_pit_lookup
    ON dbo.index_constituent_history (index_code, effective_date, expiry_date)
    INCLUDE (instrument_isin, weight_pct, free_float_factor, capping_factor);
```

### PIT Query: "Who was in the index on a given date?"

```sql
-- Point-in-time constituent lookup
DECLARE @as_of_date DATE = '2025-06-15';

SELECT
    index_code,
    instrument_isin,
    weight_pct,
    free_float_factor,
    capping_factor,
    change_reason
FROM dbo.index_constituent_history
WHERE index_code = 'EURO_STOXX_50'
  AND effective_date <= @as_of_date
  AND expiry_date   >  @as_of_date;
```

> [!warning] Boundary Convention
>
> Use half-open intervals: `effective_date <= X AND expiry_date > X`. This prevents double-counting on transition dates. The convention means a constituent is "in" on its effective_date and "out" on its expiry_date.

### BigQuery: PIT with DATE Ranges

```sql
-- BigQuery equivalent using Standard SQL
SELECT
    index_code,
    instrument_isin,
    weight_pct,
    free_float_factor,
    capping_factor
FROM `analytics.index_constituent_history`
WHERE index_code = 'EURO_STOXX_50'
  AND effective_date <= DATE '2025-06-15'
  AND expiry_date    >  DATE '2025-06-15';
```

For deduplication when multiple records overlap (data quality issue):

```sql
SELECT * FROM (
    SELECT *,
        ROW_NUMBER() OVER (
            PARTITION BY index_code, instrument_isin
            ORDER BY effective_date DESC, loaded_at DESC
        ) AS rn
    FROM `analytics.index_constituent_history`
    WHERE index_code = 'EURO_STOXX_50'
      AND effective_date <= DATE '2025-06-15'
      AND expiry_date    >  DATE '2025-06-15'
)
WHERE rn = 1;
```

---

## Bi-Temporal Model

Two independent time axes:

| Axis | Columns | Question Answered |
|------|---------|-------------------|
| **Valid time** | `valid_from`, `valid_to` | When was this fact true in the real world? |
| **Transaction time** | `recorded_at`, `superseded_at` | When did we know about it in our system? |

### T-SQL: System-Versioned Temporal Table

```sql
CREATE TABLE dbo.constituent_bitemporal (
    constituent_id    INT IDENTITY PRIMARY KEY,
    index_code        VARCHAR(20)    NOT NULL,
    instrument_isin   CHAR(12)       NOT NULL,
    weight_pct        DECIMAL(18,10) NOT NULL,
    free_float_factor DECIMAL(8,6),
    valid_from        DATE           NOT NULL,
    valid_to          DATE           NOT NULL DEFAULT '9999-12-31',

    -- System-versioning columns (transaction time)
    sys_start         DATETIME2(7) GENERATED ALWAYS AS ROW START NOT NULL,
    sys_end           DATETIME2(7) GENERATED ALWAYS AS ROW END   NOT NULL,

    PERIOD FOR SYSTEM_TIME (sys_start, sys_end)
)
WITH (SYSTEM_VERSIONING = ON (
    HISTORY_TABLE = dbo.constituent_bitemporal_history
));
```

### Bi-Temporal Query: "What did we know on Date Y about the index on Date X?"

```sql
-- Valid time: index composition on 2025-06-15
-- Transaction time: as known on 2025-06-20 (before a late correction arrived)
SELECT
    index_code,
    instrument_isin,
    weight_pct,
    valid_from,
    valid_to,
    sys_start,
    sys_end
FROM dbo.constituent_bitemporal
FOR SYSTEM_TIME AS OF '2025-06-20T23:59:59'
WHERE index_code = 'EURO_STOXX_50'
  AND valid_from <= '2025-06-15'
  AND valid_to   >  '2025-06-15';
```

> [!tip] Regulatory Use
>
> EU BMR requires you to reproduce any published index level exactly as it was calculated at the time. Bi-temporal modeling lets you answer: "Given what we knew on publication date, was our calculation correct?" — even if the underlying data was later corrected.

---

## Weight Normalization

After applying free-float factors and capping, constituent weights must sum to exactly **1.00000000** (8 decimal places). Rounding errors accumulate across 50+ constituents.

### T-SQL: Normalization with Residual Distribution

```sql
DECLARE @calc_date DATE = '2026-03-22';
DECLARE @index_code VARCHAR(20) = 'EURO_STOXX_50';
DECLARE @max_weight DECIMAL(8,6) = 0.100000;  -- 10% cap

WITH raw_weights AS (
    SELECT
        c.instrument_isin,
        p.close_price * c.shares_outstanding * c.free_float_factor AS free_float_mcap
    FROM dbo.index_constituent_history c
    JOIN dbo.daily_prices p
        ON p.instrument_isin = c.instrument_isin
       AND p.price_date = @calc_date
    WHERE c.index_code = @index_code
      AND c.effective_date <= @calc_date
      AND c.expiry_date   >  @calc_date
),
with_raw_pct AS (
    SELECT
        instrument_isin,
        free_float_mcap,
        free_float_mcap / SUM(free_float_mcap) OVER () AS raw_weight
    FROM raw_weights
),
capped AS (
    SELECT
        instrument_isin,
        CASE
            WHEN raw_weight > @max_weight THEN @max_weight
            ELSE raw_weight
        END AS capped_weight
    FROM with_raw_pct
),
normalized AS (
    SELECT
        instrument_isin,
        capped_weight / SUM(capped_weight) OVER () AS norm_weight
    FROM capped
),
rounded AS (
    SELECT
        instrument_isin,
        CAST(ROUND(norm_weight, 10) AS DECIMAL(18,10)) AS rounded_weight,
        ROW_NUMBER() OVER (ORDER BY norm_weight DESC) AS rn,
        COUNT(*) OVER () AS total_constituents
    FROM normalized
)
SELECT
    instrument_isin,
    CASE
        -- Assign residual to the largest constituent
        WHEN rn = 1
        THEN rounded_weight
             + (CAST(1.0000000000 AS DECIMAL(18,10))
                - SUM(rounded_weight) OVER ())
        ELSE rounded_weight
    END AS final_weight
FROM rounded
ORDER BY final_weight DESC;
```

> [!danger] The Residual Rule
>
> Always assign the rounding residual to the **largest** constituent. This minimizes the relative impact. A 0.0000000001 residual on a 9.8% weight is negligible; on a 0.1% weight it would be material.

### Validation: Weight Sum Check

```sql
-- This query MUST return 'PASS' or the index is not published
SELECT
    index_code,
    calc_date,
    COUNT(*) AS constituent_count,
    SUM(final_weight) AS weight_sum,
    ABS(SUM(final_weight) - 1.0000000000) AS deviation,
    CASE
        WHEN ABS(SUM(final_weight) - 1.0000000000) < 0.0000000001
        THEN 'PASS'
        ELSE 'FAIL — HALT PUBLICATION'
    END AS validation_status
FROM dbo.index_weights_daily
WHERE calc_date = @calc_date
GROUP BY index_code, calc_date;
```

### BigQuery: Weight Normalization with NUMERIC

BigQuery's `NUMERIC` type provides 38 digits of precision (29 before decimal, 9 after), avoiding most rounding issues:

```sql
WITH raw AS (
    SELECT
        instrument_isin,
        CAST(free_float_mcap AS NUMERIC) AS mcap,
        CAST(free_float_mcap AS NUMERIC)
            / SUM(CAST(free_float_mcap AS NUMERIC)) OVER () AS raw_weight
    FROM `analytics.constituent_market_data`
    WHERE index_code = 'EURO_STOXX_50'
      AND price_date = '2026-03-22'
),
capped AS (
    SELECT *,
        LEAST(raw_weight, NUMERIC '0.1') AS capped_weight
    FROM raw
),
normalized AS (
    SELECT *,
        capped_weight / SUM(capped_weight) OVER () AS norm_weight
    FROM capped
),
rounded AS (
    SELECT *,
        ROUND(norm_weight, 10) AS rounded_weight,
        ROW_NUMBER() OVER (ORDER BY norm_weight DESC) AS rn
    FROM normalized
)
SELECT
    instrument_isin,
    IF(rn = 1,
       rounded_weight + (NUMERIC '1.0' - SUM(rounded_weight) OVER ()),
       rounded_weight
    ) AS final_weight
FROM rounded;
```

---

## Performance Tuning for Large-Scale Joins

### The Challenge

Joining 10 years of daily price history (~2.5M rows per 50-constituent index) with quarterly ESG scores (~200K rows) and effective-dated constituent lists requires careful optimization.

### T-SQL: Indexing Strategy

```sql
-- Price history: clustered on (instrument, date) for range scans
CREATE CLUSTERED INDEX ix_prices_pk
    ON dbo.daily_prices (instrument_isin, price_date);

-- Constituent history: covering index for PIT lookups
CREATE NONCLUSTERED INDEX ix_constituent_pit
    ON dbo.index_constituent_history
        (index_code, effective_date, expiry_date)
    INCLUDE (instrument_isin, weight_pct, free_float_factor);

-- ESG scores: covering index for temporal alignment
CREATE NONCLUSTERED INDEX ix_esg_temporal
    ON dbo.esg_scores
        (instrument_isin, score_date DESC)
    INCLUDE (vendor_code, normalized_score, carbon_intensity);

-- Columnstore for historical analytics (read-heavy analytical queries)
CREATE NONCLUSTERED COLUMNSTORE INDEX ixcs_prices_analytics
    ON dbo.daily_prices
        (instrument_isin, price_date, close_price, volume, adjusted_close);
```

### T-SQL: Materialized PIT + Forward-Filled ESG Join

```sql
-- Step 1: Materialize PIT constituents into a temp table
SELECT
    c.instrument_isin,
    c.weight_pct,
    c.free_float_factor
INTO #pit_constituents
FROM dbo.index_constituent_history c
WHERE c.index_code = @index_code
  AND c.effective_date <= @calc_date
  AND c.expiry_date   >  @calc_date;

-- Step 2: Get prices for PIT constituents only
SELECT
    p.instrument_isin,
    p.price_date,
    p.close_price,
    p.adjusted_close
INTO #pit_prices
FROM dbo.daily_prices p
JOIN #pit_constituents c ON c.instrument_isin = p.instrument_isin
WHERE p.price_date BETWEEN @start_date AND @calc_date;

-- Step 3: Forward-fill ESG scores (SQL Server lacks IGNORE NULLS)
SELECT
    pp.instrument_isin,
    pp.price_date,
    pp.close_price,
    pc.weight_pct,
    esg.normalized_score AS esg_score
FROM #pit_prices pp
JOIN #pit_constituents pc ON pc.instrument_isin = pp.instrument_isin
OUTER APPLY (
    -- Latest ESG score on or before this price date (forward-fill)
    SELECT TOP 1 normalized_score
    FROM dbo.esg_scores e
    WHERE e.instrument_isin = pp.instrument_isin
      AND e.score_date <= pp.price_date
    ORDER BY e.score_date DESC
) esg;
```

> [!tip] Why Temp Tables?
>
> Materializing the PIT constituent list first reduces the join fan-out. Without this, the optimizer may choose a nested loop across the full price history. With 2.5M price rows and 50 constituents, this reduces the working set by 99%.

### BigQuery: Optimized PIT Join

```sql
-- BigQuery: partition + cluster + LAST_VALUE IGNORE NULLS
SELECT
    p.price_date,
    p.instrument_isin,
    p.close_price,
    c.weight_pct,
    LAST_VALUE(e.normalized_score IGNORE NULLS) OVER (
        PARTITION BY p.instrument_isin
        ORDER BY p.price_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS esg_score_forward_filled
FROM `analytics.daily_prices` p
JOIN `analytics.index_constituent_history` c
    ON c.index_code = 'EURO_STOXX_50'
   AND c.instrument_isin = p.instrument_isin
   AND c.effective_date <= p.price_date
   AND c.expiry_date   >  p.price_date
LEFT JOIN `analytics.esg_scores` e
    ON e.instrument_isin = p.instrument_isin
   AND e.score_date = p.price_date
WHERE p.price_date BETWEEN '2016-01-01' AND '2026-03-22'
ORDER BY p.price_date, p.instrument_isin;
```

> [!tip] BigQuery Optimization
>
> Partition `daily_prices` by `price_date` and cluster by `instrument_isin`. This turns a full-table scan into a partition-pruned scan, reducing bytes processed (and cost) by 90%+.

---

## Reconciliation Queries

### Daily Weight Sum Validation

```sql
-- Run after every calculation, before publication
SELECT
    calc_date,
    index_code,
    COUNT(*) AS n_constituents,
    SUM(final_weight) AS weight_sum,
    MIN(final_weight) AS min_weight,
    MAX(final_weight) AS max_weight,
    CASE
        WHEN ABS(SUM(final_weight) - 1.0) < 1E-9 THEN 'PASS'
        ELSE 'FAIL'
    END AS weight_check,
    CASE
        WHEN COUNT(*) BETWEEN 45 AND 55 THEN 'PASS'
        ELSE 'WARN — unexpected count'
    END AS count_check
FROM dbo.index_weights_daily
WHERE calc_date = @calc_date
GROUP BY calc_date, index_code;
```

### Historical Return Verification

```sql
-- Verify that calculated returns match the index level series
WITH levels AS (
    SELECT
        calc_date,
        index_level,
        LAG(index_level) OVER (ORDER BY calc_date) AS prev_level
    FROM dbo.index_levels_daily
    WHERE index_code = @index_code
      AND calc_date BETWEEN @start_date AND @end_date
)
SELECT
    calc_date,
    index_level,
    prev_level,
    (index_level - prev_level) / prev_level AS calculated_return,
    r.published_return,
    ABS((index_level - prev_level) / prev_level - r.published_return) AS return_diff,
    CASE
        WHEN ABS((index_level - prev_level) / prev_level - r.published_return) < 1E-8
        THEN 'MATCH'
        ELSE 'MISMATCH — INVESTIGATE'
    END AS status
FROM levels l
LEFT JOIN dbo.index_returns_daily r
    ON r.index_code = @index_code AND r.calc_date = l.calc_date
WHERE prev_level IS NOT NULL
ORDER BY calc_date;
```

### Cross-System Reconciliation (SQL Server vs BigQuery)

```sql
-- BigQuery side: export daily levels
SELECT calc_date, index_code, index_level
FROM `analytics.index_levels_daily`
WHERE index_code = 'EURO_STOXX_50'
  AND calc_date >= '2025-01-01';

-- Compare in Python
-- Load both results into DataFrames and compute max absolute difference
-- Threshold: < 0.00001 = PASS
```

```python
import pandas as pd

sql_levels = pd.read_sql("SELECT calc_date, index_level FROM dbo.index_levels_daily WHERE index_code = 'EURO_STOXX_50'", sql_conn)
bq_levels = bq_client.query("SELECT calc_date, index_level FROM analytics.index_levels_daily WHERE index_code = 'EURO_STOXX_50'").to_dataframe()

merged = sql_levels.merge(bq_levels, on='calc_date', suffixes=('_sql', '_bq'))
merged['diff'] = abs(merged['index_level_sql'] - merged['index_level_bq'])
max_diff = merged['diff'].max()

assert max_diff < 1e-5, f"Reconciliation FAILED: max diff = {max_diff}"
print(f"Reconciliation PASSED: max diff = {max_diff:.10f}")
```

---

### See Also

- [dimensional-modeling](https://alp78.github.io/elysium/14-Data-Architecture/Data-Modeling/dimensional-modeling) — Star schema design for index data warehouses
- [data-warehouse-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/data-warehouse-architecture) — SCD types and temporal modeling patterns
- [compliance-and-auditability](https://alp78.github.io/elysium/13-Observability/Monitoring/compliance-and-auditability) — EU BMR lineage and corporate action audit trail
- [index-maintenance-and-corporate-actions](https://alp78.github.io/elysium/18-Financial-Domain/Market-Analysis/index-maintenance-and-corporate-actions) — Corporate action types and their index impact
- [scoring-methodology](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/scoring-methodology) — Z-score and composite scoring for index signals
