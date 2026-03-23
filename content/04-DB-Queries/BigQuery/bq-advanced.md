---
type: reference
category: db-queries
technology: [bigquery, gcp]
tags: [sql, bigquery, gcp]
aliases: [BigQuery advanced, BigQuery window functions, BigQuery CTE, BigQuery JSON, BigQuery ML, BQML]
keywords: [window functions, cte, analytic functions, approximate aggregation, hll_count, approx_quantiles, pivot, unpivot, json_extract, json_value, geospatial, st_geogpoint, bqml, ml.predict, scripting, declare, loop, javascript udf]
description: "Advanced BigQuery SQL patterns with executable examples — covers window functions, approximate aggregation, scripting, JSON, geospatial, BQML, and JavaScript UDFs."
related:
  - "[[bq-fundamentals]]"
  - "[[bq-engineering]]"
  - "[[data-warehouse-architecture]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# BigQuery for Data Engineering - Advanced Patterns — Advanced Patterns

Advanced SQL techniques using the **stoxx** index database.
Prerequisite: SQL_01_Fundamentals.ipynb

Topics covered:
- Advanced Window Functions (PERCENT_RANK, CUME_DIST, FIRST_VALUE, running totals, frames)
- Recursive CTEs (date series, hierarchies)
- CROSS JOIN / CROSS APPLY / OUTER APPLY
- PIVOT / UNPIVOT
- MERGE (upsert)
- EXISTS vs IN vs JOIN
- Grouping Sets, ROLLUP, CUBE
- String Aggregation & Functions
- NULL Handling Patterns
- CASE Expression Patterns
- Set Operations (UNION, INTERSECT, EXCEPT)
- Date/Time Patterns & Calendar Tables
- Temp Tables vs Table Variables vs CTEs

## 0. Setup


```python
%load_ext sql
%config SqlMagic.displaycon = False
%config SqlMagic.displaylimit = 0
```

```python
%sql bigquery://bq-wh-nb
```

Connecting to &#x27;bigquery://bq-wh-nb&#x27;


## 1. Advanced Window Functions

### 1a. ROW_NUMBER for Deduplication

Assign a unique sequential number within each partition. The classic pattern for picking
one row per key (e.g., latest price per stock, or deduplicating loads).


```sql
%%sql
-- Pick the latest price per stock using ROW_NUMBER
-- rn=1 means the most recent date for each symbol
SELECT symbol, date, `close`, volume
FROM (
    SELECT symbol, date, `close`, volume,
           ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) AS rn
    FROM `bq-wh-nb.stoxx_silver.eurostoxx50_ohlcv`
) sub
WHERE rn = 1
ORDER BY `close` DESC
LIMIT 10
```

10 rows affected.

<table>
    <thead>
        <tr>
            <th>symbol</th>
            <th>date</th>
            <th>close</th>
            <th>volume</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>RMS.PA</td>
            <td>2026-03-12</td>
            <td>1906.0</td>
            <td>18681</td>
        </tr>
        <tr>
            <td>RHM.DE</td>
            <td>2026-03-12</td>
            <td>1551.5</td>
            <td>158741</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-12</td>
            <td>1190.8</td>
            <td>128223</td>
        </tr>
        <tr>
            <td>ADYEN.AS</td>
            <td>2026-03-12</td>
            <td>925.7</td>
            <td>27887</td>
        </tr>
        <tr>
            <td>ARGX.BR</td>
            <td>2026-03-12</td>
            <td>626.6</td>
            <td>14083</td>
        </tr>
        <tr>
            <td>MUV2.DE</td>
            <td>2026-03-12</td>
            <td>526.2</td>
            <td>86783</td>
        </tr>
        <tr>
            <td>MC.PA</td>
            <td>2026-03-12</td>
            <td>494.35</td>
            <td>171997</td>
        </tr>
        <tr>
            <td>OR.PA</td>
            <td>2026-03-12</td>
            <td>360.8</td>
            <td>82621</td>
        </tr>
        <tr>
            <td>ALV.DE</td>
            <td>2026-03-12</td>
            <td>348.7</td>
            <td>182426</td>
        </tr>
        <tr>
            <td>SAF.PA</td>
            <td>2026-03-12</td>
            <td>315.4</td>
            <td>160065</td>
        </tr>
    </tbody>
</table>



### 1b. PERCENT_RANK and CUME_DIST

- <small>`PERCENT_RANK()`</small>: relative rank as a percentage (0 to 1). Where does this stock sit vs peers?
- <small>`CUME_DIST()`</small>: cumulative distribution — fraction of rows with value ≤ current row.

Use case: "ASML is in the 90th percentile of composite scores."


```sql
%%sql
-- Percentile ranking of stocks by composite score
SELECT
    symbol,
    ROUND(composite_score, 4) AS score,
    composite_rank,
    ROUND(PERCENT_RANK() OVER (ORDER BY composite_score DESC), 3) AS pct_rank,
    ROUND(CUME_DIST() OVER (ORDER BY composite_score DESC), 3) AS cume_dist
FROM `bq-wh-nb.stoxx_gold.scores_daily`
WHERE _index = 'euro_stoxx_50'
  AND score_date = (SELECT MAX(score_date) FROM `bq-wh-nb.stoxx_gold.scores_daily` WHERE _index = 'euro_stoxx_50')
ORDER BY composite_rank
LIMIT 15
```

15 rows affected.

<table>
    <thead>
        <tr>
            <th>symbol</th>
            <th>score</th>
            <th>composite_rank</th>
            <th>pct_rank</th>
            <th>cume_dist</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>BNP.PA</td>
            <td>0.6796</td>
            <td>1</td>
            <td>0.0</td>
            <td>0.02</td>
        </tr>
        <tr>
            <td>VOW.DE</td>
            <td>0.5756</td>
            <td>2</td>
            <td>0.02</td>
            <td>0.04</td>
        </tr>
        <tr>
            <td>DTE.DE</td>
            <td>0.487</td>
            <td>3</td>
            <td>0.041</td>
            <td>0.06</td>
        </tr>
        <tr>
            <td>TTE.PA</td>
            <td>0.3913</td>
            <td>4</td>
            <td>0.061</td>
            <td>0.08</td>
        </tr>
        <tr>
            <td>ABI.BR</td>
            <td>0.3852</td>
            <td>5</td>
            <td>0.082</td>
            <td>0.1</td>
        </tr>
        <tr>
            <td>IFX.DE</td>
            <td>0.3487</td>
            <td>6</td>
            <td>0.102</td>
            <td>0.12</td>
        </tr>
        <tr>
            <td>SAN.MC</td>
            <td>0.3106</td>
            <td>7</td>
            <td>0.122</td>
            <td>0.14</td>
        </tr>
        <tr>
            <td>DG.PA</td>
            <td>0.2928</td>
            <td>8</td>
            <td>0.143</td>
            <td>0.16</td>
        </tr>
        <tr>
            <td>ISP.MI</td>
            <td>0.2852</td>
            <td>9</td>
            <td>0.163</td>
            <td>0.18</td>
        </tr>
        <tr>
            <td>BAYN.DE</td>
            <td>0.2724</td>
            <td>10</td>
            <td>0.184</td>
            <td>0.2</td>
        </tr>
        <tr>
            <td>ENI.MI</td>
            <td>0.2659</td>
            <td>11</td>
            <td>0.204</td>
            <td>0.22</td>
        </tr>
        <tr>
            <td>SU.PA</td>
            <td>0.2605</td>
            <td>12</td>
            <td>0.224</td>
            <td>0.24</td>
        </tr>
        <tr>
            <td>ENR.DE</td>
            <td>0.2557</td>
            <td>13</td>
            <td>0.245</td>
            <td>0.26</td>
        </tr>
        <tr>
            <td>AD.AS</td>
            <td>0.2367</td>
            <td>14</td>
            <td>0.265</td>
            <td>0.28</td>
        </tr>
        <tr>
            <td>SAP.DE</td>
            <td>0.2246</td>
            <td>15</td>
            <td>0.286</td>
            <td>0.3</td>
        </tr>
    </tbody>
</table>



### 1c. FIRST_VALUE and LAST_VALUE

- <small>`FIRST_VALUE(col)`</small>: first value in the window frame
- <small>`LAST_VALUE(col)`</small>: last value — **requires explicit frame** or it only sees up to current row

Use case: compare every day's close to the first close of the year (YTD return).


```sql
%%sql
-- Compare each day to first close of the year
-- FIRST_VALUE gets Jan 2 close; every row computes YTD return from it
SELECT
    symbol, date,
    ROUND(`close`, 2) AS `close`,
    ROUND(FIRST_VALUE(`close`) OVER (
        PARTITION BY symbol ORDER BY date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ), 2) AS first_close_ytd,
    ROUND((`close` - FIRST_VALUE(`close`) OVER (
        PARTITION BY symbol ORDER BY date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )) / FIRST_VALUE(`close`) OVER (
        PARTITION BY symbol ORDER BY date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) * 100, 2) AS ytd_return_pct
FROM `bq-wh-nb.stoxx_silver.eurostoxx50_ohlcv`
WHERE symbol = 'ASML.AS' AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM CURRENT_DATE())
ORDER BY date DESC
LIMIT 15
```

15 rows affected.

<table>
    <thead>
        <tr>
            <th>symbol</th>
            <th>date</th>
            <th>close</th>
            <th>first_close_ytd</th>
            <th>ytd_return_pct</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-12</td>
            <td>1190.8</td>
            <td>986.3</td>
            <td>20.73</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-11</td>
            <td>1198.8</td>
            <td>986.3</td>
            <td>21.55</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-10</td>
            <td>1200.0</td>
            <td>986.3</td>
            <td>21.67</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-09</td>
            <td>1147.6</td>
            <td>986.3</td>
            <td>16.35</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-06</td>
            <td>1147.0</td>
            <td>986.3</td>
            <td>16.29</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-05</td>
            <td>1186.0</td>
            <td>986.3</td>
            <td>20.25</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-04</td>
            <td>1199.8</td>
            <td>986.3</td>
            <td>21.65</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-03</td>
            <td>1161.8</td>
            <td>986.3</td>
            <td>17.79</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-02</td>
            <td>1210.4</td>
            <td>986.3</td>
            <td>22.72</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-02-27</td>
            <td>1233.4</td>
            <td>986.3</td>
            <td>25.05</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-02-26</td>
            <td>1232.4</td>
            <td>986.3</td>
            <td>24.95</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-02-25</td>
            <td>1288.4</td>
            <td>986.3</td>
            <td>30.63</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-02-24</td>
            <td>1263.4</td>
            <td>986.3</td>
            <td>28.09</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-02-23</td>
            <td>1249.2</td>
            <td>986.3</td>
            <td>26.66</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-02-20</td>
            <td>1255.6</td>
            <td>986.3</td>
            <td>27.3</td>
        </tr>
    </tbody>
</table>



### 1d. Running Totals and Cumulative Sums

<small>`SUM() OVER (ORDER BY date ROWS UNBOUNDED PRECEDING)`</small> — cumulative sum from the first row to current.
Use case: cumulative volume, cumulative return, running P&L.


```sql
%%sql
-- Cumulative volume for ASML in 2025
SELECT
    symbol, date, volume,
    SUM(volume) OVER (
        PARTITION BY symbol ORDER BY date
        ROWS UNBOUNDED PRECEDING
    ) AS cumulative_volume
FROM `bq-wh-nb.stoxx_silver.eurostoxx50_ohlcv`
WHERE symbol = 'ASML.AS' AND EXTRACT(YEAR FROM date) = 2025
ORDER BY date DESC
LIMIT 15
```

15 rows affected.

<table>
    <thead>
        <tr>
            <th>symbol</th>
            <th>date</th>
            <th>volume</th>
            <th>cumulative_volume</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>ASML.AS</td>
            <td>2025-12-31</td>
            <td>156048</td>
            <td>182666418</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2025-12-30</td>
            <td>402093</td>
            <td>182510370</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2025-12-29</td>
            <td>380628</td>
            <td>182108277</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2025-12-24</td>
            <td>59585</td>
            <td>181727649</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2025-12-23</td>
            <td>258272</td>
            <td>181668064</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2025-12-22</td>
            <td>375622</td>
            <td>181409792</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2025-12-19</td>
            <td>1248215</td>
            <td>181034170</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2025-12-18</td>
            <td>747507</td>
            <td>179785955</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2025-12-17</td>
            <td>761812</td>
            <td>179038448</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2025-12-16</td>
            <td>641634</td>
            <td>178276636</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2025-12-15</td>
            <td>526973</td>
            <td>177635002</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2025-12-12</td>
            <td>564160</td>
            <td>177108029</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2025-12-11</td>
            <td>465132</td>
            <td>176543869</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2025-12-10</td>
            <td>380308</td>
            <td>176078737</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2025-12-09</td>
            <td>333490</td>
            <td>175698429</td>
        </tr>
    </tbody>
</table>



### 1e. Window Frame Deep Dive

The frame clause controls which rows the function sees:

| Frame | Meaning |
|-------|--------|
| <small>`ROWS BETWEEN 29 PRECEDING AND CURRENT ROW`</small> | Exactly 30 rows (SMA-30) |
| <small>`ROWS UNBOUNDED PRECEDING`</small> | All rows from start to current (running total) |
| <small>`ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`</small> | Entire partition |
| <small>`RANGE BETWEEN ...`</small> | Based on **values** not row count (treats ties together) |

**Default** (no frame): <small>`RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`</small> — beware, this groups ties!


```sql
%%sql
-- ROWS vs RANGE: ROWS counts physical rows, RANGE groups by value
-- For SMA, always use ROWS (precise count)
SELECT
    symbol, date, `close`,
    -- ROWS: exactly 5 rows
    ROUND(AVG(`close`) OVER (
        PARTITION BY symbol ORDER BY date ROWS BETWEEN 4 PRECEDING AND CURRENT ROW
    ), 2) AS sma_5_rows,
    -- Full partition average (all rows)
    ROUND(AVG(`close`) OVER (
        PARTITION BY symbol
    ), 2) AS avg_all,
    -- Rolling 30-day volatility
    ROUND(STDDEV(`close`) OVER (
        PARTITION BY symbol ORDER BY date ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
    ), 2) AS vol_30d
FROM `bq-wh-nb.stoxx_silver.eurostoxx50_ohlcv`
WHERE symbol = 'ASML.AS'
ORDER BY date DESC
LIMIT 10
```

10 rows affected.

<table>
    <thead>
        <tr>
            <th>symbol</th>
            <th>date</th>
            <th>close</th>
            <th>sma_5_rows</th>
            <th>avg_all</th>
            <th>vol_30d</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-12</td>
            <td>1190.8</td>
            <td>1176.84</td>
            <td>671.35</td>
            <td>35.97</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-11</td>
            <td>1198.8</td>
            <td>1175.88</td>
            <td>671.35</td>
            <td>35.95</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-10</td>
            <td>1200.0</td>
            <td>1176.08</td>
            <td>671.35</td>
            <td>35.98</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-09</td>
            <td>1147.6</td>
            <td>1168.44</td>
            <td>671.35</td>
            <td>36.06</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-06</td>
            <td>1147.0</td>
            <td>1181.0</td>
            <td>671.35</td>
            <td>34.79</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-05</td>
            <td>1186.0</td>
            <td>1198.28</td>
            <td>671.35</td>
            <td>33.41</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-04</td>
            <td>1199.8</td>
            <td>1207.56</td>
            <td>671.35</td>
            <td>33.66</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-03</td>
            <td>1161.8</td>
            <td>1225.28</td>
            <td>671.35</td>
            <td>34.96</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-02</td>
            <td>1210.4</td>
            <td>1245.6</td>
            <td>671.35</td>
            <td>36.1</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-02-27</td>
            <td>1233.4</td>
            <td>1253.36</td>
            <td>671.35</td>
            <td>39.19</td>
        </tr>
    </tbody>
</table>



## 2. Recursive CTEs

### 2a. Date Series Generation

A **recursive CTE** has an anchor (starting row) and a recursive member that references itself.
Classic use: generate a continuous date sequence to detect missing trading days.


```sql
%%sql
-- Generate all dates in March 2026, then check which are missing from OHLCV
WITH RECURSIVE dates AS (
    -- Anchor: first date
    SELECT CAST('2026-03-01' AS DATE) AS dt
    UNION ALL
    -- Recursive: add one day
    SELECT DATE_ADD(dt, INTERVAL 1 DAY) FROM dates WHERE dt < '2026-03-31'
)
SELECT
    d.dt AS calendar_date,
    o.symbol,
    o.`close`,
    CASE WHEN o.symbol IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM dates d
LEFT JOIN `bq-wh-nb.stoxx_silver.eurostoxx50_ohlcv` o ON d.dt = o.date AND o.symbol = 'ASML.AS'
ORDER BY d.dt
LIMIT 15
```

15 rows affected.

<table>
    <thead>
        <tr>
            <th>calendar_date</th>
            <th>symbol</th>
            <th>close</th>
            <th>status</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>2026-03-01</td>
            <td>None</td>
            <td>None</td>
            <td>MISSING</td>
        </tr>
        <tr>
            <td>2026-03-02</td>
            <td>ASML.AS</td>
            <td>1210.4</td>
            <td>OK</td>
        </tr>
        <tr>
            <td>2026-03-03</td>
            <td>ASML.AS</td>
            <td>1161.8</td>
            <td>OK</td>
        </tr>
        <tr>
            <td>2026-03-04</td>
            <td>ASML.AS</td>
            <td>1199.8</td>
            <td>OK</td>
        </tr>
        <tr>
            <td>2026-03-05</td>
            <td>ASML.AS</td>
            <td>1186.0</td>
            <td>OK</td>
        </tr>
        <tr>
            <td>2026-03-06</td>
            <td>ASML.AS</td>
            <td>1147.0</td>
            <td>OK</td>
        </tr>
        <tr>
            <td>2026-03-07</td>
            <td>None</td>
            <td>None</td>
            <td>MISSING</td>
        </tr>
        <tr>
            <td>2026-03-08</td>
            <td>None</td>
            <td>None</td>
            <td>MISSING</td>
        </tr>
        <tr>
            <td>2026-03-09</td>
            <td>ASML.AS</td>
            <td>1147.6</td>
            <td>OK</td>
        </tr>
        <tr>
            <td>2026-03-10</td>
            <td>ASML.AS</td>
            <td>1200.0</td>
            <td>OK</td>
        </tr>
        <tr>
            <td>2026-03-11</td>
            <td>ASML.AS</td>
            <td>1198.8</td>
            <td>OK</td>
        </tr>
        <tr>
            <td>2026-03-12</td>
            <td>ASML.AS</td>
            <td>1190.8</td>
            <td>OK</td>
        </tr>
        <tr>
            <td>2026-03-13</td>
            <td>None</td>
            <td>None</td>
            <td>MISSING</td>
        </tr>
        <tr>
            <td>2026-03-14</td>
            <td>None</td>
            <td>None</td>
            <td>MISSING</td>
        </tr>
        <tr>
            <td>2026-03-15</td>
            <td>None</td>
            <td>None</td>
            <td>MISSING</td>
        </tr>
    </tbody>
</table>



## 3. CROSS JOIN / CROSS APPLY / OUTER APPLY

### 3a. CROSS JOIN: Build a Complete Grid

<small>`CROSS JOIN`</small> = cartesian product. Every row from A paired with every row from B.
Use case: generate all (symbol, date) combinations to find missing data.


```sql
%%sql
-- Cross join symbols x trading calendar → find dates with no bronze data
-- Silver is gap-filled, so we check bronze instead
WITH symbols AS (
    SELECT DISTINCT symbol FROM `bq-wh-nb.stoxx_bronze.eurostoxx50_ohlcv`
),
cal AS (
    SELECT DISTINCT date
    FROM `bq-wh-nb.stoxx_bronze.trading_calendar`
    WHERE exchange_code = 'AMS' AND is_trading_day = TRUE
      AND date >= '2026-03-01' AND date <= '2026-03-21'
)
SELECT
    s.symbol, c.date,
    CASE WHEN o.`close` IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM symbols s
CROSS JOIN cal c
LEFT JOIN `bq-wh-nb.stoxx_silver.eurostoxx50_ohlcv` o ON s.symbol = o.symbol AND c.date = o.date
ORDER BY s.symbol, c.date
LIMIT 15
```

15 rows affected.

<table>
    <thead>
        <tr>
            <th>symbol</th>
            <th>date</th>
            <th>status</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>ABI.BR</td>
            <td>2026-03-02</td>
            <td>OK</td>
        </tr>
        <tr>
            <td>ABI.BR</td>
            <td>2026-03-03</td>
            <td>OK</td>
        </tr>
        <tr>
            <td>ABI.BR</td>
            <td>2026-03-04</td>
            <td>OK</td>
        </tr>
        <tr>
            <td>ABI.BR</td>
            <td>2026-03-05</td>
            <td>OK</td>
        </tr>
        <tr>
            <td>ABI.BR</td>
            <td>2026-03-06</td>
            <td>OK</td>
        </tr>
        <tr>
            <td>ABI.BR</td>
            <td>2026-03-09</td>
            <td>OK</td>
        </tr>
        <tr>
            <td>ABI.BR</td>
            <td>2026-03-10</td>
            <td>OK</td>
        </tr>
        <tr>
            <td>ABI.BR</td>
            <td>2026-03-11</td>
            <td>OK</td>
        </tr>
        <tr>
            <td>ABI.BR</td>
            <td>2026-03-12</td>
            <td>OK</td>
        </tr>
        <tr>
            <td>ABI.BR</td>
            <td>2026-03-13</td>
            <td>MISSING</td>
        </tr>
        <tr>
            <td>ABI.BR</td>
            <td>2026-03-16</td>
            <td>MISSING</td>
        </tr>
        <tr>
            <td>ABI.BR</td>
            <td>2026-03-17</td>
            <td>MISSING</td>
        </tr>
        <tr>
            <td>ABI.BR</td>
            <td>2026-03-18</td>
            <td>MISSING</td>
        </tr>
        <tr>
            <td>ABI.BR</td>
            <td>2026-03-19</td>
            <td>MISSING</td>
        </tr>
        <tr>
            <td>ABI.BR</td>
            <td>2026-03-20</td>
            <td>MISSING</td>
        </tr>
    </tbody>
</table>



### 3b. CROSS APPLY: Top-N Per Group

<small>`CROSS APPLY`</small> is a lateral join — it runs a subquery **for each row** of the outer table.
Like a correlated subquery, but returns multiple rows. Use case: top 3 highest-volume days per stock.


```sql
%%sql
-- Top 3 highest-volume days per stock (BigQuery: use window function instead of CROSS APPLY)
SELECT symbol, short_name, date, volume, `close`
FROM (
    SELECT d.symbol, d.short_name, o.date, o.volume, o.`close`,
           ROW_NUMBER() OVER (PARTITION BY d.symbol ORDER BY o.volume DESC) AS rn
    FROM `bq-wh-nb.stoxx_silver.index_dim` d
    JOIN `bq-wh-nb.stoxx_silver.eurostoxx50_ohlcv` o ON d.symbol = o.symbol
    WHERE d._index = 'euro_stoxx_50' AND d.is_current = TRUE
) sub
WHERE rn <= 3
ORDER BY symbol, volume DESC
LIMIT 15

```

15 rows affected.

<table>
    <thead>
        <tr>
            <th>symbol</th>
            <th>short_name</th>
            <th>date</th>
            <th>volume</th>
            <th>close</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>ABI.BR</td>
            <td>AB INBEV</td>
            <td>2022-02-28</td>
            <td>12441786</td>
            <td>55.14</td>
        </tr>
        <tr>
            <td>ABI.BR</td>
            <td>AB INBEV</td>
            <td>2024-06-21</td>
            <td>9762601</td>
            <td>55.06</td>
        </tr>
        <tr>
            <td>ABI.BR</td>
            <td>AB INBEV</td>
            <td>2025-05-30</td>
            <td>9526994</td>
            <td>62.04</td>
        </tr>
        <tr>
            <td>AD.AS</td>
            <td>KONINKLIJKE AHOLD DELHAIZE N.V.</td>
            <td>2021-05-27</td>
            <td>11080485</td>
            <td>24.0</td>
        </tr>
        <tr>
            <td>AD.AS</td>
            <td>KONINKLIJKE AHOLD DELHAIZE N.V.</td>
            <td>2021-03-19</td>
            <td>10565045</td>
            <td>23.5</td>
        </tr>
        <tr>
            <td>AD.AS</td>
            <td>KONINKLIJKE AHOLD DELHAIZE N.V.</td>
            <td>2021-02-17</td>
            <td>8898178</td>
            <td>23.04</td>
        </tr>
        <tr>
            <td>ADS.DE</td>
            <td>adidas AG</td>
            <td>2022-11-04</td>
            <td>4104049</td>
            <td>114.04</td>
        </tr>
        <tr>
            <td>ADS.DE</td>
            <td>adidas AG</td>
            <td>2023-02-10</td>
            <td>3554497</td>
            <td>139.26</td>
        </tr>
        <tr>
            <td>ADS.DE</td>
            <td>adidas AG</td>
            <td>2025-07-30</td>
            <td>3145116</td>
            <td>174.9</td>
        </tr>
        <tr>
            <td>ADYEN.AS</td>
            <td>ADYEN</td>
            <td>2023-08-17</td>
            <td>922065</td>
            <td>898.4</td>
        </tr>
        <tr>
            <td>ADYEN.AS</td>
            <td>ADYEN</td>
            <td>2023-11-09</td>
            <td>802956</td>
            <td>958.8</td>
        </tr>
        <tr>
            <td>ADYEN.AS</td>
            <td>ADYEN</td>
            <td>2026-02-12</td>
            <td>758895</td>
            <td>903.3</td>
        </tr>
        <tr>
            <td>AI.PA</td>
            <td>AIR LIQUIDE</td>
            <td>2023-06-16</td>
            <td>3921992</td>
            <td>152.6727</td>
        </tr>
        <tr>
            <td>AI.PA</td>
            <td>AIR LIQUIDE</td>
            <td>2022-06-17</td>
            <td>2721708</td>
            <td>117.6364</td>
        </tr>
        <tr>
            <td>AI.PA</td>
            <td>AIR LIQUIDE</td>
            <td>2021-03-19</td>
            <td>2564930</td>
            <td>112.1901</td>
        </tr>
    </tbody>
</table>



### 3c. OUTER APPLY: Optional Lateral Join

Like <small>`CROSS APPLY`</small> but keeps the outer row even if the inner returns nothing (like LEFT JOIN).
Use case: latest score per stock — some stocks may not have scores yet.


```sql
%%sql
-- Latest score per stock (BigQuery: LEFT JOIN + ROW_NUMBER instead of OUTER APPLY)
SELECT d.symbol, d.short_name, d.sector,
       s.composite_score, s.composite_rank, s.score_date
FROM (
    SELECT * FROM `bq-wh-nb.stoxx_silver.index_dim`
    WHERE _index = 'euro_stoxx_50' AND is_current = TRUE
) d
LEFT JOIN (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY symbol, _index ORDER BY score_date DESC) AS rn
    FROM `bq-wh-nb.stoxx_gold.scores_daily`
) s ON d.symbol = s.symbol AND d._index = s._index AND s.rn = 1
ORDER BY s.composite_rank
LIMIT 15

```

15 rows affected.

<table>
    <thead>
        <tr>
            <th>symbol</th>
            <th>short_name</th>
            <th>sector</th>
            <th>composite_score</th>
            <th>composite_rank</th>
            <th>score_date</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>BNP.PA</td>
            <td>BNP PARIBAS ACT.A</td>
            <td>Financial Services</td>
            <td>0.6795985859619491</td>
            <td>1</td>
            <td>2026-03-12</td>
        </tr>
        <tr>
            <td>VOW.DE</td>
            <td>VOLKSWAGEN AG</td>
            <td>Consumer Cyclical</td>
            <td>0.5756100520413311</td>
            <td>2</td>
            <td>2026-03-12</td>
        </tr>
        <tr>
            <td>DTE.DE</td>
            <td>DEUTSCHE TELEKOM AG</td>
            <td>Communication Services</td>
            <td>0.4870486370039222</td>
            <td>3</td>
            <td>2026-03-12</td>
        </tr>
        <tr>
            <td>TTE.PA</td>
            <td>TOTALENERGIES</td>
            <td>Energy</td>
            <td>0.3912872052761238</td>
            <td>4</td>
            <td>2026-03-12</td>
        </tr>
        <tr>
            <td>ABI.BR</td>
            <td>AB INBEV</td>
            <td>Consumer Defensive</td>
            <td>0.38521031359211527</td>
            <td>5</td>
            <td>2026-03-12</td>
        </tr>
        <tr>
            <td>IFX.DE</td>
            <td>INFINEON TECHNOLOGIES AG</td>
            <td>Technology</td>
            <td>0.34870425939827027</td>
            <td>6</td>
            <td>2026-03-12</td>
        </tr>
        <tr>
            <td>SAN.MC</td>
            <td>BANCO SANTANDER S.A.</td>
            <td>Financial Services</td>
            <td>0.31063282435584555</td>
            <td>7</td>
            <td>2026-03-12</td>
        </tr>
        <tr>
            <td>DG.PA</td>
            <td>VINCI</td>
            <td>Industrials</td>
            <td>0.2927510733352998</td>
            <td>8</td>
            <td>2026-03-12</td>
        </tr>
        <tr>
            <td>ISP.MI</td>
            <td>INTESA SANPAOLO</td>
            <td>Financial Services</td>
            <td>0.28518257395318697</td>
            <td>9</td>
            <td>2026-03-12</td>
        </tr>
        <tr>
            <td>BAYN.DE</td>
            <td>Bayer AG</td>
            <td>Healthcare</td>
            <td>0.27238567872715413</td>
            <td>10</td>
            <td>2026-03-12</td>
        </tr>
        <tr>
            <td>ENI.MI</td>
            <td>ENI</td>
            <td>Energy</td>
            <td>0.26585319812965214</td>
            <td>11</td>
            <td>2026-03-12</td>
        </tr>
        <tr>
            <td>SU.PA</td>
            <td>SCHNEIDER ELECTRIC SE</td>
            <td>Industrials</td>
            <td>0.26054541395799025</td>
            <td>12</td>
            <td>2026-03-12</td>
        </tr>
        <tr>
            <td>ENR.DE</td>
            <td>Siemens Energy AG</td>
            <td>Industrials</td>
            <td>0.2557010167774651</td>
            <td>13</td>
            <td>2026-03-12</td>
        </tr>
        <tr>
            <td>AD.AS</td>
            <td>KONINKLIJKE AHOLD DELHAIZE N.V.</td>
            <td>Consumer Defensive</td>
            <td>0.2366886690741862</td>
            <td>14</td>
            <td>2026-03-12</td>
        </tr>
        <tr>
            <td>SAP.DE</td>
            <td>SAP SE</td>
            <td>Technology</td>
            <td>0.22456076202341446</td>
            <td>15</td>
            <td>2026-03-12</td>
        </tr>
    </tbody>
</table>



## 4. PIVOT / UNPIVOT

### 4a. PIVOT: Rows to Columns

Turn row values into column headers. Classic use: monthly close prices as columns.


```sql
%%sql
-- BigQuery PIVOT: monthly average close prices as columns
SELECT * FROM (
    SELECT symbol, EXTRACT(MONTH FROM date) AS mo, `close`
    FROM `bq-wh-nb.stoxx_silver.eurostoxx50_ohlcv`
    WHERE symbol = 'ASML.AS' AND EXTRACT(YEAR FROM date) = 2025
)
PIVOT (AVG(`close`) FOR mo IN (1 AS Jan, 2 AS Feb, 3 AS Mar, 4 AS Apr, 5 AS May))

```

1 rows affected.

<table>
    <thead>
        <tr>
            <th>symbol</th>
            <th>Jan</th>
            <th>Feb</th>
            <th>Mar</th>
            <th>Apr</th>
            <th>May</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>ASML.AS</td>
            <td>714.7136363636364</td>
            <td>713.04</td>
            <td>656.5809523809523</td>
            <td>581.0</td>
            <td>650.1809523809522</td>
        </tr>
    </tbody>
</table>



### 4b. Manual Pivot with CASE (Portable)

<small>`PIVOT`</small> is BigQuery specific. The portable equivalent uses <small>`CASE`</small> inside aggregates.
Works in any SQL engine (BigQuery, PostgreSQL, etc.).


```sql
%%sql
-- Same result using CASE — works everywhere
SELECT
    symbol,
    ROUND(AVG(CASE WHEN EXTRACT(MONTH FROM date) = 1 THEN `close` END), 2) AS Jan,
    ROUND(AVG(CASE WHEN EXTRACT(MONTH FROM date) = 2 THEN `close` END), 2) AS Feb,
    ROUND(AVG(CASE WHEN EXTRACT(MONTH FROM date) = 3 THEN `close` END), 2) AS Mar,
    ROUND(AVG(CASE WHEN EXTRACT(MONTH FROM date) = 6 THEN `close` END), 2) AS Jun,
    ROUND(AVG(CASE WHEN EXTRACT(MONTH FROM date) = 9 THEN `close` END), 2) AS Sep,
    ROUND(AVG(CASE WHEN EXTRACT(MONTH FROM date) = 12 THEN `close` END), 2) AS Dec
FROM `bq-wh-nb.stoxx_silver.eurostoxx50_ohlcv`
WHERE symbol = 'ASML.AS' AND EXTRACT(YEAR FROM date) = 2025
GROUP BY symbol
```

1 rows affected.

<table>
    <thead>
        <tr>
            <th>symbol</th>
            <th>Jan</th>
            <th>Feb</th>
            <th>Mar</th>
            <th>Jun</th>
            <th>Sep</th>
            <th>Dec</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>ASML.AS</td>
            <td>714.71</td>
            <td>713.04</td>
            <td>656.58</td>
            <td>670.05</td>
            <td>732.09</td>
            <td>924.72</td>
        </tr>
    </tbody>
</table>



### 4c. UNPIVOT: Columns to Rows

The reverse — turn multiple score columns into rows for easier comparison/charting.


```sql
%%sql
-- BigQuery UNPIVOT: turn score columns into rows
SELECT symbol, score_type, ROUND(score_value, 4) AS score_value
FROM (
    SELECT symbol, relative_value_score, momentum_score, sentiment_score
    FROM `bq-wh-nb.stoxx_gold.scores_daily`
    WHERE _index = 'euro_stoxx_50'
      AND score_date = (SELECT MAX(score_date) FROM `bq-wh-nb.stoxx_gold.scores_daily` WHERE _index = 'euro_stoxx_50')
)
UNPIVOT (score_value FOR score_type IN (relative_value_score, momentum_score, sentiment_score))
ORDER BY symbol, score_type
LIMIT 15

```

15 rows affected.

<table>
    <thead>
        <tr>
            <th>symbol</th>
            <th>score_type</th>
            <th>score_value</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>ABI.BR</td>
            <td>momentum_score</td>
            <td>0.5375</td>
        </tr>
        <tr>
            <td>ABI.BR</td>
            <td>relative_value_score</td>
            <td>0.2506</td>
        </tr>
        <tr>
            <td>ABI.BR</td>
            <td>sentiment_score</td>
            <td>0.3676</td>
        </tr>
        <tr>
            <td>AD.AS</td>
            <td>momentum_score</td>
            <td>1.1629</td>
        </tr>
        <tr>
            <td>AD.AS</td>
            <td>relative_value_score</td>
            <td>0.6959</td>
        </tr>
        <tr>
            <td>AD.AS</td>
            <td>sentiment_score</td>
            <td>-1.1487</td>
        </tr>
        <tr>
            <td>ADS.DE</td>
            <td>momentum_score</td>
            <td>-1.1665</td>
        </tr>
        <tr>
            <td>ADS.DE</td>
            <td>relative_value_score</td>
            <td>0.1075</td>
        </tr>
        <tr>
            <td>ADS.DE</td>
            <td>sentiment_score</td>
            <td>0.8679</td>
        </tr>
        <tr>
            <td>ADYEN.AS</td>
            <td>momentum_score</td>
            <td>-1.9782</td>
        </tr>
        <tr>
            <td>ADYEN.AS</td>
            <td>relative_value_score</td>
            <td>0.2557</td>
        </tr>
        <tr>
            <td>ADYEN.AS</td>
            <td>sentiment_score</td>
            <td>1.9606</td>
        </tr>
        <tr>
            <td>AI.PA</td>
            <td>momentum_score</td>
            <td>0.2252</td>
        </tr>
        <tr>
            <td>AI.PA</td>
            <td>relative_value_score</td>
            <td>-0.2525</td>
        </tr>
        <tr>
            <td>AI.PA</td>
            <td>sentiment_score</td>
            <td>0.2165</td>
        </tr>
    </tbody>
</table>



## 5. MERGE (Upsert)

### 5a. MERGE Syntax

The <small>`MERGE`</small> statement does INSERT, UPDATE, and DELETE in one atomic operation.
This is the core of incremental pipeline loads — "upsert" new data, update changed rows.

**Syntax**: <small>`MERGE target USING source ON join_key WHEN MATCHED THEN UPDATE WHEN NOT MATCHED THEN INSERT`</small>


```sql
%%sql
-- BigQuery MERGE example (conceptual — uses real table reference pattern)
-- In BigQuery, MERGE works on permanent tables, not temp tables in %%sql magic.
-- Syntax is the same as SQL Server:
--
-- MERGE `project.dataset.target` AS t
-- USING `project.dataset.staging` AS s
-- ON t.symbol = s.symbol AND t.date = s.date
-- WHEN MATCHED THEN UPDATE SET t.close = s.close, t.volume = s.volume
-- WHEN NOT MATCHED THEN INSERT (symbol, date, close, volume)
--     VALUES (s.symbol, s.date, s.close, s.volume);

-- Demo: show staging-like data that would be merged
SELECT 'DEMO.XX' AS symbol, DATE '2026-03-20' AS date, 100.0 AS `close`, 1000000 AS volume
UNION ALL
SELECT 'DEMO.XX', DATE '2026-03-21', 102.5, 1200000

```

2 rows affected.

<table>
    <thead>
        <tr>
            <th>symbol</th>
            <th>date</th>
            <th>close</th>
            <th>volume</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>DEMO.XX</td>
            <td>2026-03-20</td>
            <td>100.0</td>
            <td>1000000</td>
        </tr>
        <tr>
            <td>DEMO.XX</td>
            <td>2026-03-21</td>
            <td>102.5</td>
            <td>1200000</td>
        </tr>
    </tbody>
</table>



## 6. EXISTS vs IN vs JOIN

### 6a. EXISTS (Semi-Join)

<small>`WHERE EXISTS (SELECT 1 FROM ... WHERE ...)`</small> — returns TRUE if the subquery finds **any** row.
Stops at the first match (efficient). Use for "does a related row exist?" questions.


```sql
%%sql
-- Stocks that have gold scores (EXISTS = semi-join)
SELECT d.symbol, d.short_name, d.sector
FROM `bq-wh-nb.stoxx_silver.index_dim` d
WHERE d._index = 'euro_stoxx_50' AND d.is_current = TRUE
  AND EXISTS (
      SELECT 1 FROM `bq-wh-nb.stoxx_gold.scores_daily` g
      WHERE g.symbol = d.symbol AND g._index = d._index
  )
ORDER BY d.symbol
LIMIT 15
```

15 rows affected.

<table>
    <thead>
        <tr>
            <th>symbol</th>
            <th>short_name</th>
            <th>sector</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>ABI.BR</td>
            <td>AB INBEV</td>
            <td>Consumer Defensive</td>
        </tr>
        <tr>
            <td>AD.AS</td>
            <td>KONINKLIJKE AHOLD DELHAIZE N.V.</td>
            <td>Consumer Defensive</td>
        </tr>
        <tr>
            <td>ADS.DE</td>
            <td>adidas AG</td>
            <td>Consumer Cyclical</td>
        </tr>
        <tr>
            <td>ADYEN.AS</td>
            <td>ADYEN</td>
            <td>Technology</td>
        </tr>
        <tr>
            <td>AI.PA</td>
            <td>AIR LIQUIDE</td>
            <td>Basic Materials</td>
        </tr>
        <tr>
            <td>AIR.PA</td>
            <td>AIRBUS SE</td>
            <td>Industrials</td>
        </tr>
        <tr>
            <td>ALV.DE</td>
            <td>Allianz SE</td>
            <td>Financial Services</td>
        </tr>
        <tr>
            <td>ARGX.BR</td>
            <td>ARGENX SE</td>
            <td>Healthcare</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>ASML HOLDING</td>
            <td>Technology</td>
        </tr>
        <tr>
            <td>BAS.DE</td>
            <td>BASF SE</td>
            <td>Basic Materials</td>
        </tr>
        <tr>
            <td>BAYN.DE</td>
            <td>Bayer AG</td>
            <td>Healthcare</td>
        </tr>
        <tr>
            <td>BBVA.MC</td>
            <td>BANCO BILBAO VIZCAYA ARGENTARIA</td>
            <td>Financial Services</td>
        </tr>
        <tr>
            <td>BMW.DE</td>
            <td>BAYERISCHE MOTOREN WERKE AG</td>
            <td>Consumer Cyclical</td>
        </tr>
        <tr>
            <td>BN.PA</td>
            <td>DANONE</td>
            <td>Consumer Defensive</td>
        </tr>
        <tr>
            <td>BNP.PA</td>
            <td>BNP PARIBAS ACT.A</td>
            <td>Financial Services</td>
        </tr>
    </tbody>
</table>



### 6b. NOT EXISTS (Anti-Join)

Find rows in A that have **no match** in B. More efficient than <small>`LEFT JOIN WHERE b.key IS NULL`</small> in most cases.


```sql
%%sql
-- Stocks in Euro Stoxx 50 but NOT in Oil & Gas 20 (different index)
-- Demonstrates NOT EXISTS as an anti-join
SELECT d.symbol, d.short_name, d.sector
FROM `bq-wh-nb.stoxx_silver.index_dim` d
WHERE d._index = 'euro_stoxx_50' AND d.is_current = TRUE
  AND NOT EXISTS (
      SELECT 1 FROM `bq-wh-nb.stoxx_silver.index_dim` o
      WHERE o.symbol = d.symbol AND o._index = 'oil_20' AND o.is_current = TRUE
  )
ORDER BY d.symbol
LIMIT 15
```

15 rows affected.

<table>
    <thead>
        <tr>
            <th>symbol</th>
            <th>short_name</th>
            <th>sector</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>ABI.BR</td>
            <td>AB INBEV</td>
            <td>Consumer Defensive</td>
        </tr>
        <tr>
            <td>AD.AS</td>
            <td>KONINKLIJKE AHOLD DELHAIZE N.V.</td>
            <td>Consumer Defensive</td>
        </tr>
        <tr>
            <td>ADS.DE</td>
            <td>adidas AG</td>
            <td>Consumer Cyclical</td>
        </tr>
        <tr>
            <td>ADYEN.AS</td>
            <td>ADYEN</td>
            <td>Technology</td>
        </tr>
        <tr>
            <td>AI.PA</td>
            <td>AIR LIQUIDE</td>
            <td>Basic Materials</td>
        </tr>
        <tr>
            <td>AIR.PA</td>
            <td>AIRBUS SE</td>
            <td>Industrials</td>
        </tr>
        <tr>
            <td>ALV.DE</td>
            <td>Allianz SE</td>
            <td>Financial Services</td>
        </tr>
        <tr>
            <td>ARGX.BR</td>
            <td>ARGENX SE</td>
            <td>Healthcare</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>ASML HOLDING</td>
            <td>Technology</td>
        </tr>
        <tr>
            <td>BAS.DE</td>
            <td>BASF SE</td>
            <td>Basic Materials</td>
        </tr>
        <tr>
            <td>BAYN.DE</td>
            <td>Bayer AG</td>
            <td>Healthcare</td>
        </tr>
        <tr>
            <td>BBVA.MC</td>
            <td>BANCO BILBAO VIZCAYA ARGENTARIA</td>
            <td>Financial Services</td>
        </tr>
        <tr>
            <td>BMW.DE</td>
            <td>BAYERISCHE MOTOREN WERKE AG</td>
            <td>Consumer Cyclical</td>
        </tr>
        <tr>
            <td>BN.PA</td>
            <td>DANONE</td>
            <td>Consumer Defensive</td>
        </tr>
        <tr>
            <td>BNP.PA</td>
            <td>BNP PARIBAS ACT.A</td>
            <td>Financial Services</td>
        </tr>
    </tbody>
</table>



## 7. Grouping Sets, ROLLUP, CUBE

### 7a. GROUPING SETS

Run multiple GROUP BY queries in one pass. Instead of UNION ALL of separate aggregations,
use <small>`GROUPING SETS`</small> — more efficient and readable.


```sql
%%sql
-- Aggregate scores by sector, by country, and overall — in one query
SELECT
    COALESCE(d.sector, '(all sectors)') AS sector,
    COALESCE(d.country, '(all countries)') AS country,
    COUNT(*) AS stocks,
    ROUND(AVG(s.composite_score), 4) AS avg_score
FROM `bq-wh-nb.stoxx_gold.scores_daily` s
JOIN `bq-wh-nb.stoxx_silver.index_dim` d ON s.symbol = d.symbol AND d._index = s._index AND d.is_current = TRUE
WHERE s._index = 'euro_stoxx_50'
  AND s.score_date = (SELECT MAX(score_date) FROM `bq-wh-nb.stoxx_gold.scores_daily` WHERE _index = 'euro_stoxx_50')
GROUP BY GROUPING SETS (
    (d.sector),
    (d.country),
    ()
)
ORDER BY GROUPING(d.sector), GROUPING(d.country), avg_score DESC
LIMIT 15
```

15 rows affected.

<table>
    <thead>
        <tr>
            <th>sector</th>
            <th>country</th>
            <th>stocks</th>
            <th>avg_score</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>Communication Services</td>
            <td>(all countries)</td>
            <td>1</td>
            <td>0.487</td>
        </tr>
        <tr>
            <td>Energy</td>
            <td>(all countries)</td>
            <td>2</td>
            <td>0.3286</td>
        </tr>
        <tr>
            <td>Healthcare</td>
            <td>(all countries)</td>
            <td>4</td>
            <td>0.0812</td>
        </tr>
        <tr>
            <td>Technology</td>
            <td>(all countries)</td>
            <td>5</td>
            <td>0.0522</td>
        </tr>
        <tr>
            <td>Industrials</td>
            <td>(all countries)</td>
            <td>10</td>
            <td>0.0504</td>
        </tr>
        <tr>
            <td>Financial Services</td>
            <td>(all countries)</td>
            <td>11</td>
            <td>-0.0095</td>
        </tr>
        <tr>
            <td>Basic Materials</td>
            <td>(all countries)</td>
            <td>2</td>
            <td>-0.0106</td>
        </tr>
        <tr>
            <td>Consumer Defensive</td>
            <td>(all countries)</td>
            <td>4</td>
            <td>-0.061</td>
        </tr>
        <tr>
            <td>Consumer Cyclical</td>
            <td>(all countries)</td>
            <td>9</td>
            <td>-0.1013</td>
        </tr>
        <tr>
            <td>Utilities</td>
            <td>(all countries)</td>
            <td>2</td>
            <td>-0.1017</td>
        </tr>
        <tr>
            <td>(all sectors)</td>
            <td>Belgium</td>
            <td>1</td>
            <td>0.3852</td>
        </tr>
        <tr>
            <td>(all sectors)</td>
            <td>Netherlands</td>
            <td>8</td>
            <td>0.0753</td>
        </tr>
        <tr>
            <td>(all sectors)</td>
            <td>Italy</td>
            <td>5</td>
            <td>0.0579</td>
        </tr>
        <tr>
            <td>(all sectors)</td>
            <td>France</td>
            <td>15</td>
            <td>-0.0061</td>
        </tr>
        <tr>
            <td>(all sectors)</td>
            <td>Spain</td>
            <td>4</td>
            <td>-0.0125</td>
        </tr>
    </tbody>
</table>



### 7b. ROLLUP — Hierarchical Subtotals

<small>`ROLLUP(a, b)`</small> = GROUP BY (a, b) + GROUP BY (a) + GROUP BY (). Subtotals roll up from right to left.


```sql
%%sql
-- Volume by sector with subtotals and grand total
SELECT
    COALESCE(d.sector, '*** TOTAL ***') AS sector,
    COUNT(DISTINCT s.symbol) AS stocks,
    SUM(o.volume) AS total_volume,
    ROUND(AVG(CAST(o.volume AS FLOAT64)), 0) AS avg_daily_volume
FROM `bq-wh-nb.stoxx_silver.eurostoxx50_ohlcv` o
JOIN `bq-wh-nb.stoxx_silver.index_dim` d ON o.symbol = d.symbol AND d._index = 'euro_stoxx_50' AND d.is_current = TRUE
JOIN `bq-wh-nb.stoxx_gold.scores_daily` s ON o.symbol = s.symbol AND s._index = 'euro_stoxx_50'
WHERE o.date >= '2026-03-01'
  AND s.score_date = (SELECT MAX(score_date) FROM `bq-wh-nb.stoxx_gold.scores_daily` WHERE _index = 'euro_stoxx_50')
GROUP BY ROLLUP(d.sector)
ORDER BY GROUPING(d.sector), total_volume DESC
LIMIT 15
```

11 rows affected.

<table>
    <thead>
        <tr>
            <th>sector</th>
            <th>stocks</th>
            <th>total_volume</th>
            <th>avg_daily_volume</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>Financial Services</td>
            <td>11</td>
            <td>1494164521</td>
            <td>15092571.0</td>
        </tr>
        <tr>
            <td>Utilities</td>
            <td>2</td>
            <td>377718499</td>
            <td>20984361.0</td>
        </tr>
        <tr>
            <td>Energy</td>
            <td>2</td>
            <td>207171058</td>
            <td>11509503.0</td>
        </tr>
        <tr>
            <td>Industrials</td>
            <td>10</td>
            <td>125186950</td>
            <td>1390966.0</td>
        </tr>
        <tr>
            <td>Consumer Cyclical</td>
            <td>9</td>
            <td>112568697</td>
            <td>1389737.0</td>
        </tr>
        <tr>
            <td>Technology</td>
            <td>5</td>
            <td>105864747</td>
            <td>2352550.0</td>
        </tr>
        <tr>
            <td>Healthcare</td>
            <td>4</td>
            <td>69651794</td>
            <td>1934772.0</td>
        </tr>
        <tr>
            <td>Communication Services</td>
            <td>1</td>
            <td>59704910</td>
            <td>6633879.0</td>
        </tr>
        <tr>
            <td>Consumer Defensive</td>
            <td>4</td>
            <td>48013267</td>
            <td>1333702.0</td>
        </tr>
        <tr>
            <td>Basic Materials</td>
            <td>2</td>
            <td>42175147</td>
            <td>2343064.0</td>
        </tr>
        <tr>
            <td>*** TOTAL ***</td>
            <td>50</td>
            <td>2642219590</td>
            <td>5871599.0</td>
        </tr>
    </tbody>
</table>



## 8. String Aggregation & Functions

### 8a. STRING_AGG

Concatenate values from multiple rows into a single comma-separated string.
Use case: list all tickers in a sector as one field.


```sql
%%sql
-- Comma-separated list of symbols per sector
SELECT
    sector,
    COUNT(*) AS stocks,
    STRING_AGG(symbol, ', ' ORDER BY symbol) AS symbols
FROM `bq-wh-nb.stoxx_silver.index_dim`
WHERE _index = 'euro_stoxx_50' AND is_current = TRUE
GROUP BY sector
ORDER BY stocks DESC
LIMIT 10
```

10 rows affected.

<table>
    <thead>
        <tr>
            <th>sector</th>
            <th>stocks</th>
            <th>symbols</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>Financial Services</td>
            <td>11</td>
            <td>ALV.DE, BBVA.MC, BNP.PA, CS.PA, DB1.DE, INGA.AS, ISP.MI, MUV2.DE, NDA-FI.HE, SAN.MC, UCG.MI</td>
        </tr>
        <tr>
            <td>Industrials</td>
            <td>10</td>
            <td>AIR.PA, DG.PA, DHL.DE, ENR.DE, RHM.DE, SAF.PA, SGO.PA, SIE.DE, SU.PA, WKL.AS</td>
        </tr>
        <tr>
            <td>Consumer Cyclical</td>
            <td>9</td>
            <td>ADS.DE, BMW.DE, ITX.MC, MBG.DE, MC.PA, PRX.AS, RACE.MI, RMS.PA, VOW.DE</td>
        </tr>
        <tr>
            <td>Technology</td>
            <td>5</td>
            <td>ADYEN.AS, ASML.AS, DSY.PA, IFX.DE, SAP.DE</td>
        </tr>
        <tr>
            <td>Consumer Defensive</td>
            <td>4</td>
            <td>ABI.BR, AD.AS, BN.PA, OR.PA</td>
        </tr>
        <tr>
            <td>Healthcare</td>
            <td>4</td>
            <td>ARGX.BR, BAYN.DE, EL.PA, SAN.PA</td>
        </tr>
        <tr>
            <td>Utilities</td>
            <td>2</td>
            <td>ENEL.MI, IBE.MC</td>
        </tr>
        <tr>
            <td>Basic Materials</td>
            <td>2</td>
            <td>AI.PA, BAS.DE</td>
        </tr>
        <tr>
            <td>Energy</td>
            <td>2</td>
            <td>ENI.MI, TTE.PA</td>
        </tr>
        <tr>
            <td>Communication Services</td>
            <td>1</td>
            <td>DTE.DE</td>
        </tr>
    </tbody>
</table>



### 8b. String Parsing

Extract exchange suffix from ticker symbols (e.g., 'AS' from 'ASML.AS').


```sql
%%sql
-- Parse exchange from symbol: everything after the dot
SELECT
    symbol,
    LEFT(symbol, STRPOS(symbol, '.') - 1) AS ticker_only,
    SUBSTR(symbol, STRPOS(symbol, '.') + 1, LENGTH(symbol)) AS exchange,
    CONCAT(UPPER(LEFT(short_name, 1)), LOWER(SUBSTR(short_name, 2))) AS name_proper
FROM `bq-wh-nb.stoxx_silver.index_dim`
WHERE _index = 'euro_stoxx_50' AND is_current = TRUE
ORDER BY symbol
LIMIT 10
```

10 rows affected.

<table>
    <thead>
        <tr>
            <th>symbol</th>
            <th>ticker_only</th>
            <th>exchange</th>
            <th>name_proper</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>ABI.BR</td>
            <td>ABI</td>
            <td>BR</td>
            <td>Ab inbev</td>
        </tr>
        <tr>
            <td>AD.AS</td>
            <td>AD</td>
            <td>AS</td>
            <td>Koninklijke ahold delhaize n.v.</td>
        </tr>
        <tr>
            <td>ADS.DE</td>
            <td>ADS</td>
            <td>DE</td>
            <td>Adidas ag</td>
        </tr>
        <tr>
            <td>ADYEN.AS</td>
            <td>ADYEN</td>
            <td>AS</td>
            <td>Adyen</td>
        </tr>
        <tr>
            <td>AI.PA</td>
            <td>AI</td>
            <td>PA</td>
            <td>Air liquide</td>
        </tr>
        <tr>
            <td>AIR.PA</td>
            <td>AIR</td>
            <td>PA</td>
            <td>Airbus se</td>
        </tr>
        <tr>
            <td>ALV.DE</td>
            <td>ALV</td>
            <td>DE</td>
            <td>Allianz se</td>
        </tr>
        <tr>
            <td>ARGX.BR</td>
            <td>ARGX</td>
            <td>BR</td>
            <td>Argenx se</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>ASML</td>
            <td>AS</td>
            <td>Asml holding</td>
        </tr>
        <tr>
            <td>BAS.DE</td>
            <td>BAS</td>
            <td>DE</td>
            <td>Basf se</td>
        </tr>
    </tbody>
</table>



## 9. NULL Handling Patterns

### NULL Rules

| Expression | Result | Why |
|-----------|--------|-----|
| <small>`NULL = NULL`</small> | NULL (not TRUE!) | NULL is unknown, not a value |
| <small>`NULL + 5`</small> | NULL | Any arithmetic with NULL = NULL |
| <small>`AVG(col)`</small> | Ignores NULLs | Aggregates skip NULLs |
| <small>`COUNT(*)`</small> vs <small>`COUNT(col)`</small> | Different! | COUNT(*) counts rows, COUNT(col) skips NULLs |
| <small>`COALESCE(a, b, c)`</small> | First non-NULL | ANSI standard, N arguments |
| <small>`IFNULL(a, b)`</small> | a if not null, else b | BigQuery SQL only, 2 args, type of first arg |
| <small>`NULLIF(a, b)`</small> | NULL if a = b | Prevents divide-by-zero: <small>`x / NULLIF(y, 0)`</small> |


```sql
%%sql
-- NULL handling in practice: safe division, defaults, counting
SELECT
    symbol,
    forward_pe,
    -- COALESCE: use 'N/A' default if PE is null
    COALESCE(CAST(ROUND(forward_pe, 1) AS STRING), 'N/A') AS pe_display,
    -- NULLIF: safe division (denominator could be zero)
    ROUND(current_price / NULLIF(forward_pe, 0), 2) AS earnings_per_share,
    -- COUNT(*) vs COUNT(column)
    COUNT(*) OVER () AS total_rows,
    COUNT(forward_pe) OVER () AS rows_with_pe
FROM `bq-wh-nb.stoxx_silver.signals_daily`
WHERE _index = 'euro_stoxx_50'
ORDER BY forward_pe
LIMIT 10
```

10 rows affected.

<table>
    <thead>
        <tr>
            <th>symbol</th>
            <th>forward_pe</th>
            <th>pe_display</th>
            <th>earnings_per_share</th>
            <th>total_rows</th>
            <th>rows_with_pe</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>VOW.DE</td>
            <td>2.6177435</td>
            <td>2.6</td>
            <td>35.47</td>
            <td>149</td>
            <td>149</td>
        </tr>
        <tr>
            <td>VOW.DE</td>
            <td>3.4232497</td>
            <td>3.4</td>
            <td>27.93</td>
            <td>149</td>
            <td>149</td>
        </tr>
        <tr>
            <td>VOW.DE</td>
            <td>3.5628338</td>
            <td>3.6</td>
            <td>25.63</td>
            <td>149</td>
            <td>149</td>
        </tr>
        <tr>
            <td>BNP.PA</td>
            <td>6.7327175</td>
            <td>6.7</td>
            <td>12.83</td>
            <td>149</td>
            <td>149</td>
        </tr>
        <tr>
            <td>BNP.PA</td>
            <td>6.8096137</td>
            <td>6.8</td>
            <td>12.84</td>
            <td>149</td>
            <td>149</td>
        </tr>
        <tr>
            <td>MBG.DE</td>
            <td>6.8814898</td>
            <td>6.9</td>
            <td>7.95</td>
            <td>149</td>
            <td>149</td>
        </tr>
        <tr>
            <td>MBG.DE</td>
            <td>6.9037566</td>
            <td>6.9</td>
            <td>7.93</td>
            <td>149</td>
            <td>149</td>
        </tr>
        <tr>
            <td>BNP.PA</td>
            <td>6.9642887</td>
            <td>7</td>
            <td>12.83</td>
            <td>149</td>
            <td>149</td>
        </tr>
        <tr>
            <td>MBG.DE</td>
            <td>7.123044</td>
            <td>7.1</td>
            <td>7.93</td>
            <td>149</td>
            <td>149</td>
        </tr>
        <tr>
            <td>BMW.DE</td>
            <td>7.2557197</td>
            <td>7.3</td>
            <td>11.0</td>
            <td>149</td>
            <td>149</td>
        </tr>
    </tbody>
</table>



## 10. Set Operations

### UNION / INTERSECT / EXCEPT

- <small>`UNION ALL`</small>: stack result sets (keep duplicates) — fast
- <small>`UNION`</small>: stack + deduplicate — slower (sorts)
- <small>`INTERSECT`</small>: rows in both queries
- <small>`EXCEPT`</small>: rows in first query but not second


```sql
%%sql
-- EXCEPT DISTINCT: Euro Stoxx 50 symbols NOT in STOXX Asia 50
-- Set difference — finds members exclusive to one index
SELECT symbol FROM `bq-wh-nb.stoxx_silver.index_dim`
WHERE _index = 'euro_stoxx_50' AND is_current = TRUE
EXCEPT DISTINCT
SELECT symbol FROM `bq-wh-nb.stoxx_silver.index_dim`
WHERE _index = 'stoxx_asia_50' AND is_current = TRUE
ORDER BY symbol
LIMIT 15
```

15 rows affected.

<table>
    <thead>
        <tr>
            <th>symbol</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>ABI.BR</td>
        </tr>
        <tr>
            <td>AD.AS</td>
        </tr>
        <tr>
            <td>ADS.DE</td>
        </tr>
        <tr>
            <td>ADYEN.AS</td>
        </tr>
        <tr>
            <td>AI.PA</td>
        </tr>
        <tr>
            <td>AIR.PA</td>
        </tr>
        <tr>
            <td>ALV.DE</td>
        </tr>
        <tr>
            <td>ARGX.BR</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
        </tr>
        <tr>
            <td>BAS.DE</td>
        </tr>
        <tr>
            <td>BAYN.DE</td>
        </tr>
        <tr>
            <td>BBVA.MC</td>
        </tr>
        <tr>
            <td>BMW.DE</td>
        </tr>
        <tr>
            <td>BN.PA</td>
        </tr>
        <tr>
            <td>BNP.PA</td>
        </tr>
    </tbody>
</table>



## 11. Date & Calendar Table Patterns

### 11a. Business Day Arithmetic

Use the <small>`trading_calendar`</small> table to count trading days between dates.
Weekend/holiday-aware calculations are essential for financial data.


```sql
%%sql
-- Count trading days in Q1 2026 per exchange
SELECT
    exchange_code,
    SUM(CAST(is_trading_day AS INT)) AS trading_days,
    COUNT(*) AS calendar_days,
    ROUND(SUM(CAST(is_trading_day AS INT)) * 100.0 / COUNT(*), 1) AS pct_trading
FROM `bq-wh-nb.stoxx_bronze.trading_calendar`
WHERE year = 2026 AND quarter = 1
GROUP BY exchange_code
ORDER BY trading_days DESC
LIMIT 10
```

10 rows affected.

<table>
    <thead>
        <tr>
            <th>exchange_code</th>
            <th>trading_days</th>
            <th>calendar_days</th>
            <th>pct_trading</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>BRU</td>
            <td>63</td>
            <td>90</td>
            <td>70.0</td>
        </tr>
        <tr>
            <td>PAR</td>
            <td>63</td>
            <td>90</td>
            <td>70.0</td>
        </tr>
        <tr>
            <td>GER</td>
            <td>63</td>
            <td>90</td>
            <td>70.0</td>
        </tr>
        <tr>
            <td>MIL</td>
            <td>63</td>
            <td>90</td>
            <td>70.0</td>
        </tr>
        <tr>
            <td>MCE</td>
            <td>63</td>
            <td>90</td>
            <td>70.0</td>
        </tr>
        <tr>
            <td>AMS</td>
            <td>63</td>
            <td>90</td>
            <td>70.0</td>
        </tr>
        <tr>
            <td>ASX</td>
            <td>62</td>
            <td>90</td>
            <td>68.9</td>
        </tr>
        <tr>
            <td>HEL</td>
            <td>62</td>
            <td>90</td>
            <td>68.9</td>
        </tr>
        <tr>
            <td>NMS</td>
            <td>61</td>
            <td>90</td>
            <td>67.8</td>
        </tr>
        <tr>
            <td>NYQ</td>
            <td>61</td>
            <td>90</td>
            <td>67.8</td>
        </tr>
    </tbody>
</table>



## 12. Temp Tables vs Table Variables vs CTEs

### Decision Guide

| Feature | CTE | \#Temp Table | @Table Variable |
|---------|-----|-------------|----------------|
| Materialized? | No (re-evaluated) | Yes (on disk) | Yes (in memory*) |
| Indexes? | No | Yes | Limited |
| Scope | Single query | Session | Batch |
| Best for | Readability | Reuse, large sets | Small lookups (<100 rows) |
| Performance | Re-runs each ref | One-time compute | Fast for small sets |

**Rule of thumb**: start with CTE. If the query is slow and the CTE is referenced multiple times, materialize into \#temp.
