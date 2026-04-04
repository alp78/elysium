---
tags: [performance, sql, bigquery, sql-server, tsql]
aliases: [PIT, point-in-time, effective-dated, bi-temporal, as-of query, weight normalization, constituent list, rebalancing, index reconstitution, SCD Type 2, temporal join]
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

> [!success] Correct Approach — SCD Type 2 with Full Audit Trail
>
> Use SCD Type 2 effective-dated tables with `effective_date` / `expiry_date` columns and bi-temporal modeling to capture both valid time and transaction time. Run automated weight-sum validation (`ABS(SUM - 1.0) < 1E-9`) before every publication. Store `change_reason` on every row to satisfy the EU BMR audit trail requirement.

---

## Effective-Dated Constituent Lists

Index constituents change at every quarterly rebalancing and on corporate action events (mergers, delistings, spin-offs). A naive `SELECT * FROM constituents WHERE index_code = 'X'` returns the current state, not the historical state.

### T-SQL: SCD Type 2 for Constituent Membership

**SCD Type 2** (Slowly Changing Dimension Type 2) is a data warehousing pattern that preserves the complete history of changes to a record by inserting a **new row** for each change instead of overwriting the existing one. Each row carries an `effective_date` (the date the row became the current truth) and an `expiry_date` (the date it was superseded). An open-ended record — the one currently active — uses the sentinel value `'9999-12-31'` as `expiry_date`, indicating no defined end.

The table below implements this pattern for index constituents. Every membership event — quarterly rebalancing, IPO addition, merger removal, or delisting — inserts a new row with the updated `effective_date`. The prior row's `expiry_date` is set to that same date, closing the old record. This produces an immutable, append-only audit trail: no historical record is ever modified after it is written.

Key design decisions:
- `DECIMAL(18,10)` for `weight_pct` and factors — exact base-10 fixed-point arithmetic avoids the IEEE 754 rounding errors inherent in `FLOAT` or `REAL`.
- The `UNIQUE (index_code, instrument_isin, effective_date)` constraint prevents duplicate membership records for the same security on the same effective date, which would corrupt PIT queries.
- `change_reason` captures the business event that triggered the row (`REBALANCE`, `IPO_ADD`, `MERGER_REMOVE`, `DELIST`) — required for EU BMR audit trail.

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

CREATE NONCLUSTERED INDEX ix_pit_lookup
    ON dbo.index_constituent_history (index_code, effective_date, expiry_date)
    INCLUDE (instrument_isin, weight_pct, free_float_factor, capping_factor);
```

### PIT Query: "Who was in the index on a given date?"

A PIT (point-in-time) query reconstructs the exact membership of a table at a specific historical date. It scans the SCD Type 2 rows and returns only those whose validity window contains the target date: the row must have started on or before the target date (`effective_date <= @as_of_date`) and must not yet have expired (`expiry_date > @as_of_date`). Any date outside a row's `[effective_date, expiry_date)` interval is invisible to the query.

This is the foundational query for every historical calculation: back-tests, index level reconstructions, and regulatory audits all begin with a PIT constituent lookup to establish which securities were active and at what weights.

```sql
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

> [!success] Safe Pattern — Consistent Half-Open Interval
>
> Enforce the `effective_date <= @as_of_date AND expiry_date > @as_of_date` convention in all queries and stored procedures. Document it in the code and use a check constraint or unit test to verify that no two active rows for the same `(index_code, instrument_isin)` overlap on any given date.

### BigQuery: PIT with DATE Ranges

BigQuery does not provide a native system-versioned temporal table feature comparable to SQL Server's `SYSTEM_VERSIONING = ON`. The SCD Type 2 pattern with explicit `effective_date`/`expiry_date` columns is therefore the standard approach on BigQuery as well. The PIT predicate is identical in logic; BigQuery's `DATE` type (a calendar date with no time component) maps directly to SQL Server's `DATE`, so the half-open interval convention transfers without change.

When multiple overlapping rows exist for the same `(index_code, instrument_isin)` — a data quality failure — `ROW_NUMBER()` with `ORDER BY effective_date DESC, loaded_at DESC` surfaces the latest-loaded, latest-effective record and the outer `WHERE rn = 1` discards duplicates.

```sql
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

**Bi-temporal modeling** is an extension of SCD Type 2 that tracks **two independent time dimensions simultaneously**. SCD Type 2 only records *when a fact was true in the real world* (valid time). Bi-temporal modeling adds a second axis: *when the system became aware of the fact* (transaction time). These two axes are orthogonal — a data vendor can correct a historical weight three days after publication, and the two are not the same event.

This distinction matters acutely in regulated financial publishing. Under EU BMR, an index provider must prove that a specific index level was calculated correctly using the data that was actually available at the time of publication — not the corrected data that arrived later. SCD Type 2 alone cannot answer this question: once a record is updated, the "as-known-at-publication" state is gone. Bi-temporal modeling preserves both states permanently.

The two axes answer different categories of question:
- **Valid time query**: "What were the index constituents on date X?" — filters on `valid_from`/`valid_to`.
- **Transaction time query**: "What did our system know on date Y about the index on date X?" — filters on both `sys_start`/`sys_end` and `valid_from`/`valid_to`. This is the regulatory reproducibility query.

> [!tip] Connection to look-ahead bias
>
> In backtesting and algorithmic trading, **look-ahead bias** refers to using data that would not have been available at the time a trading decision was made — for example, an ESG score corrected by the vendor three days after its initial publication. A bi-temporal model is the technical solution to look-ahead-free analysis: querying with `FOR SYSTEM_TIME AS OF <publication_date>` guarantees that only data known at that moment is included. Any backtest or index history reconstruction that queries the current state of the data (without transaction-time filtering) is implicitly look-ahead-biased and will produce results that cannot be reproduced in a live environment.

Two independent time axes:

| Axis | Columns | Question Answered |
|------|---------|-------------------|
| **Valid time** | `valid_from`, `valid_to` | When was this fact true in the real world? |
| **Transaction time** | `recorded_at`, `superseded_at` | When did we know about it in our system? |

### T-SQL: System-Versioned Temporal Table

SQL Server's **system-versioned temporal tables** implement the transaction time axis automatically. When `SYSTEM_VERSIONING = ON`, the engine attaches two `datetime2(7)` period columns — `sys_start` and `sys_end` — and a linked history table. On every `UPDATE` or `DELETE`, the engine copies the prior row version to the history table with `sys_end` set to the transaction start time, then writes the new version to the current table with `sys_start` set to the same transaction time. This happens at the storage layer; the application issues normal DML and versioning is transparent.

Three rules govern the period columns:
1. `GENERATED ALWAYS AS ROW START/END` — their values are set by the engine and cannot be overridden by the application.
2. `PERIOD FOR SYSTEM_TIME (sys_start, sys_end)` — registers the pair as the system-time period. Without this declaration the versioning cannot be enabled.
3. The history table (`dbo.constituent_bitemporal_history`) is append-only while `SYSTEM_VERSIONING = ON`. Direct `UPDATE`, `DELETE`, or `TRUNCATE` on the history table requires temporarily disabling versioning.

> [!info] History Table Indexing for Analytical Workloads
>
> The default auto-created history table index is a clustered B-tree rowstore on `(sys_end, sys_start)`. For PIT queries spanning long date ranges, Microsoft recommends replacing this with a **clustered columnstore index (CCI)**. History rows are insert-only — never updated in place — making CCI compression and batch-mode scanning highly effective. On large history tables, a CCI provides up to 10× compression and significantly faster range-scan performance over `FOR SYSTEM_TIME AS OF` queries.

> [!danger] Long-running transactions cause tempdb version store bloat
>
> SQL Server stores row versions for temporal tables in the `tempdb` version store. A transaction that remains open — for example, a batch ETL job holding a single large transaction — prevents the engine from cleaning up superseded row versions, causing `tempdb` to grow unboundedly. The key performance counters to monitor are `Version Store Size (KB)`, `Version Generation rate (KB/s)`, `Version Cleanup rate (KB/s)`, and `Longest Transaction Running Time` in `sys.dm_os_performance_counters`. A version store that grows during batch loads indicates transactions are not being committed promptly.

> [!success] Commit frequently and monitor version store counters
>
> Batch inserts or updates against system-versioned temporal tables should commit every 10,000–50,000 rows rather than holding a single large transaction open. For bulk historical loads where versioning is not needed, temporarily set `SYSTEM_VERSIONING = OFF`, load in batches, then re-enable with `SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.constituent_bitemporal_history, DATA_CONSISTENCY_CHECK = ON)`.

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

`FOR SYSTEM_TIME AS OF <timestamp>` is SQL Server's native PIT syntax for system-versioned temporal tables. Internally, the engine rewrites the query as a **UNION** of the current table and the history table, applying the filter `sys_start <= @point AND sys_end > @point` to both sides. This makes the clause SARGable — the `(sys_end, sys_start)` index on the history table is used directly. The engine also automatically excludes zero-duration rows (`sys_start = sys_end`), which can arise when multiple DML statements hit the same key within a single transaction.

In the bi-temporal query below, `FOR SYSTEM_TIME AS OF` filters the transaction time axis (what the system knew as of the publication date), while the explicit `valid_from`/`valid_to` predicates filter the valid time axis (what the business fact was on the target date). Combining both axes answers the regulatory question precisely.

> [!warning] Period columns store UTC — never apply time zone conversion to the column itself
>
> Wrapping a period column in `AT TIME ZONE` (e.g., `sys_start AT TIME ZONE 'Central European Time'`) defeats SARGability and forces a full scan of both the current and history tables. Always convert the **input parameter** to UTC instead: `@local_time AT TIME ZONE 'Central European Time' AT TIME ZONE 'UTC'`.

> [!success] Safe Pattern — Convert the parameter, not the column
>
> Pass UTC timestamps directly to `FOR SYSTEM_TIME AS OF`. If the source time is local, convert it before the query: `CAST(@local_time AT TIME ZONE 'Central European Time' AT TIME ZONE 'UTC' AS datetime2)`.

```sql
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

> [!warning] Never use FLOAT or REAL for financial weights
>
> `FLOAT` and `REAL` use IEEE 754 binary floating-point representation. Most decimal fractions — including 0.1 — cannot be represented exactly in base 2 (0.1 in binary is an infinite repeating fraction: 0.000110011…). Summing 50 `FLOAT` weights will produce a result like `0.9999999999999998` or `1.0000000000000002`, triggering a validation failure even when the weights are mathematically correct. A `DECIMAL(18,10)` is an exact base-10 fixed-point type: arithmetic is performed in base 10 and intermediate results are truncated to the specified precision — no hidden binary conversion occurs.

> [!success] Use DECIMAL(18,10) for all weight columns
>
> Declare all weight and factor columns as `DECIMAL(18,10)`. This gives 10 significant decimal places after the point, which is sufficient to represent a 0.0000000001 rounding residual on a weight. Use `CAST(ROUND(value, 10) AS DECIMAL(18,10))` explicitly at each normalization step to control where truncation occurs rather than letting SQL Server decide.

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

> [!success] Safe Pattern — Residual Assigned to Largest Constituent
>
> Use `ROW_NUMBER() OVER (ORDER BY norm_weight DESC)` to identify `rn = 1` and add `(1.0000000000 - SUM(rounded_weight) OVER ())` to that row only. After normalization, always run the weight-sum validation query and gate publication on a `'PASS'` result.

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

PIT workloads require indexes that serve three distinct access patterns simultaneously, and each demands a different design:

1. **Constituent lookup by date** — `WHERE index_code = X AND effective_date <= Y AND expiry_date > Y` — needs a covering nonclustered index with `(index_code, effective_date, expiry_date)` as the key and the payload columns in `INCLUDE`. The selectivity of `index_code` is low (few distinct values), so the index is narrowed by the date range.
2. **Price range scans per instrument** — `WHERE instrument_isin = X AND price_date BETWEEN A AND B` — needs a clustered index on `(instrument_isin, price_date)`. Clustering ensures that all rows for a given instrument are physically adjacent on disk, making multi-year date range scans sequential reads rather than random I/O.
3. **Analytical aggregations over historical data** — `GROUP BY`, `SUM`, `AVG` across millions of rows — benefits from a nonclustered columnstore index (NCCI). Columnstore stores data in compressed columnar format and processes aggregations with SIMD batch-mode execution, which is 10–100× faster than rowstore for read-heavy analytical queries.

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

Large-scale PIT joins fail when the query optimizer chooses a nested loop plan over the full price history before filtering by the constituent list. Without materialization, the optimizer may scan all 2.5M price rows for every constituent — an O(n × m) cross-product. The **materialization pattern** forces an explicit evaluation order that the optimizer cannot resequence:

1. Isolate the PIT constituent list into a temp table (`#pit_constituents`) — typically 50 rows. SQL Server builds statistics on the temp table, which the optimizer uses in subsequent steps.
2. Retrieve prices only for those 50 instruments — reducing the price working set from 2.5M to ~125K rows.
3. Apply the ESG forward-fill join against the already-reduced set.

SQL Server lacks `IGNORE NULLS` in window functions (unlike BigQuery's `LAST_VALUE(... IGNORE NULLS)`). The ESG forward-fill is implemented with `OUTER APPLY` + `TOP 1 ORDER BY score_date DESC`, which returns the most recent ESG score on or before the current price date for each instrument.

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

Reconciliation queries verify that the output of a calculation pipeline satisfies known mathematical invariants before results are published or propagated to downstream systems. Unlike application-level tests that check code logic, reconciliation queries run against the actual calculated data and act as a **hard publication gate** — a failed check halts the pipeline.

Three reconciliation checks are standard for index calculation systems:

1. **Weight sum validation** — the sum of all constituent weights for a given `(index_code, calc_date)` must equal exactly `1.0000000000` within a tolerance of `1E-9`. This is a binary pass/fail gate: even a single failing date blocks publication of the entire index history.
2. **Historical return verification** — daily returns derived from the calculated index level series must match the independently published return series within `1E-8`. A mismatch indicates rounding, data feed, or replication divergence.
3. **Cross-system reconciliation** — when SQL Server and BigQuery compute the same index independently, their daily levels must agree within `1E-5`. Larger divergences indicate a platform-specific defect: typically a floating-point type mismatch (`FLOAT` vs `NUMERIC`), a date boundary difference, or a data load gap.

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
