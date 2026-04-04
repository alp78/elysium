---
tags: [sql, sql-server, tsql]
aliases: [SQL fundamentals, T-SQL basics, SQL queries, SELECT, JOIN, WHERE, GROUP BY]
description: "SQL Server T-SQL fundamentals with executable examples and cell outputs — covers SELECT, filtering, joins, aggregation, subqueries, and set operations."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# SQL for Data Engineering

> [!quote]
> "At the heart of every large or small database is the relational model, quietly making sense of chaos."
>
> — **C.J. Date**, *An Introduction to Database Systems* (2003)

```python
%load_ext sql
%config SqlMagic.displaycon = False
%config SqlMagic.displaylimit = 0
```

```python
%sql mssql+pyodbc://sa:EsgDev2026Pass1@localhost:1434/stoxx?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes&MARS_Connection=yes
```

Connecting to &#x27;mssql+pyodbc://sa:***@localhost:1434/stoxx?TrustServerCertificate=yes&amp;driver=ODBC+Driver+18+for+SQL+Server&#x27;

> [!danger] Lab-Only Credentials
>
> The connection string above contains a plaintext password for a local lab environment. In production, credentials are stored in GCP Secret Manager and fetched at runtime — never hardcoded. See [secrets-management > Access from Python](https://alp78.github.io/elysium/06-GCP/Security/secrets-management#access-from-python).

> [!success] Safe Pattern
>
> In production, retrieve the connection string from GCP Secret Manager at runtime: `secretmanager.SecretManagerServiceClient().access_secret_version(name=...)`. Never hardcode passwords in notebooks, scripts, or source control. Use environment variables or secret injection via Cloud Run / GKE secrets.

## Schema Exploration

### Schema Exploration — List All Tables

First thing in any database — see what's there. The medallion layers (bronze/silver/gold) are schemas.


```sql
-- List all tables by schema (bronze / silver / gold)
-- This is the first thing you do in any new database
SELECT TOP 15
    s.name AS [schema],
    t.name AS [table],
    p.rows AS row_count
FROM sys.tables t
JOIN sys.schemas s ON t.schema_id = s.schema_id
JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0, 1)
ORDER BY s.name, t.name
```

<table>
    <thead>
        <tr>
            <th>schema</th>
            <th>table</th>
            <th>row_count</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>bronze</td>
            <td>dim_country</td>
            <td>212</td>
        </tr>
        <tr>
            <td>bronze</td>
            <td>dim_index</td>
            <td>4</td>
        </tr>
        <tr>
            <td>bronze</td>
            <td>eurostoxx50_ohlcv</td>
            <td>50</td>
        </tr>
        <tr>
            <td>bronze</td>
            <td>index_dim</td>
            <td>169</td>
        </tr>
        <tr>
            <td>bronze</td>
            <td>oil20_ohlcv</td>
            <td>19</td>
        </tr>
</table>



### Schema Exploration — Inspect Column Types

Check data types before writing queries — `float` vs `int` vs `varchar` changes how you aggregate and join.


```sql
-- Inspect columns of a specific table
-- Always check data types before writing queries
SELECT TOP 15
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH AS max_len,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'silver' AND TABLE_NAME = 'eurostoxx50_ohlcv'
ORDER BY ORDINAL_POSITION
```

<table>
    <thead>
        <tr>
            <th>COLUMN_NAME</th>
            <th>DATA_TYPE</th>
            <th>max_len</th>
            <th>IS_NULLABLE</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>id</td>
            <td>int</td>
            <td>None</td>
            <td>NO</td>
        </tr>
        <tr>
            <td>symbol</td>
            <td>varchar</td>
            <td>20</td>
            <td>NO</td>
        </tr>
        <tr>
            <td>date</td>
            <td>date</td>
            <td>None</td>
            <td>NO</td>
        </tr>
        <tr>
            <td>open</td>
            <td>float</td>
            <td>None</td>
            <td>YES</td>
        </tr>
        <tr>
            <td>high</td>
            <td>float</td>
            <td>None</td>
            <td>YES</td>
        </tr>
</table>



## SELECT, Filtering & Sorting

> [!tip]- SQL Server vs BigQuery Syntax
>
> | Concept | SQL Server | BigQuery |
> |---|---|---|
> | Row limit | `TOP N` (before columns) | `LIMIT N` (end of query) |
> | Reserved words | `[close]`, `[open]` | `` `close` ``, `` `open` `` |
> | Current timestamp | `GETDATE()` / `SYSUTCDATETIME()` | `CURRENT_TIMESTAMP()` |
> | String concatenation | `+` or `CONCAT()` | `CONCAT()` or `\|\|` |
> | Null replacement | `ISNULL(expr, default)` | `IFNULL(expr, default)` |
> | Auto-increment | `IDENTITY(1,1)` | No equivalent — use `GENERATE_UUID()` |
> | Temp tables | `#temp` (session-scoped) | `CREATE TEMP TABLE` (script-scoped) |
> | Table path | `schema.table` | `` `project.dataset.table` `` |
>
> For the full cross-platform comparison including Python and C#, see [05_py_aggregation_reshaping](https://alp78.github.io/elysium/03-Dataframes/Dataframes-Python/05_py_aggregation_reshaping) and [05_cs_aggregation_reshaping](https://alp78.github.io/elysium/03-Dataframes/Dataframes-CSharp/05_cs_aggregation_reshaping).

### SELECT, Filtering & Sorting — Basic SELECT with WHERE

The fundamental query: pick columns, filter rows, sort results. `TOP N` limits output (SQL Server). PostgreSQL uses `LIMIT N`.

> [!warning] TOP without ORDER BY is non-deterministic
>
> `SELECT TOP 10 * FROM table` returns an ARBITRARY 10 rows — not the first 10, not the newest 10. The engine picks whichever rows it finds first based on the execution plan. Always pair `TOP` with `ORDER BY` unless you genuinely don't care which rows you get.

> [!success] Safe Pattern
>
> Always pair `TOP N` with `ORDER BY` to get a deterministic result: `SELECT TOP 10 ... ORDER BY date DESC`. If you only need to check whether any row exists (e.g., in an `IF EXISTS` guard), use `SELECT TOP 1 1 FROM ...` with no `ORDER BY` — that is the one case where order genuinely doesn't matter.

```sql
-- Latest 10 trading days for ASML
-- Basic SELECT with WHERE, ORDER BY, TOP
SELECT TOP 10
    symbol,
    date,
    [open],
    high,
    low,
    [close],
    volume
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'ASML.AS'
ORDER BY date DESC
```

<table>
    <thead>
        <tr>
            <th>symbol</th>
            <th>date</th>
            <th>open</th>
            <th>high</th>
            <th>low</th>
            <th>close</th>
            <th>volume</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-12</td>
            <td>1194.8</td>
            <td>1202.2</td>
            <td>1187.8</td>
            <td>1190.8</td>
            <td>128223</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-11</td>
            <td>1188.4</td>
            <td>1210.8</td>
            <td>1174.0</td>
            <td>1198.8</td>
            <td>562904</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-10</td>
            <td>1188.4</td>
            <td>1208.4</td>
            <td>1172.2</td>
            <td>1200.0</td>
            <td>800815</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-09</td>
            <td>1072.0</td>
            <td>1147.6</td>
            <td>1060.2</td>
            <td>1147.6</td>
            <td>689086</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-06</td>
            <td>1186.0</td>
            <td>1192.6</td>
            <td>1112.8</td>
            <td>1147.0</td>
            <td>857271</td>
        </tr>
</table>



### SELECT & Filtering — Multi-Condition WHERE

Combine conditions with `AND` / `OR`. Use `ABS()` for absolute values. This finds high-volume days with large price swings — potential breakout or crash days.

> [!warning] FLOAT is approximate — ROUND() can surprise
>
> `FLOAT` stores binary approximations. `ROUND(3.145, 2)` on a `FLOAT` column may return `3.14` instead of `3.15`. For financial calculations or exact comparisons, use `DECIMAL(18, 4)`. OHLCV prices stored as `FLOAT` are acceptable for analytics but not for accounting.

> [!success] Safe Pattern
>
> Use `DECIMAL(18, 4)` or `DECIMAL(18, 8)` for financial values that require exact arithmetic (NAV, index weights, fees). Use `FLOAT` only for analytics columns (daily returns, z-scores, volatility) where a sub-penny binary approximation error is acceptable. Never use `=` to compare `FLOAT` columns — use `ABS(a - b) < 0.0001` instead.

```sql
-- Filter with multiple conditions
-- Find high-volume days where price moved more than 3%
SELECT TOP 15
    symbol,
    date,
    [close],
    volume,
    ROUND(([close] - [open]) / [open] * 100, 2) AS daily_move_pct
FROM silver.eurostoxx50_ohlcv
WHERE volume > 5000000                       -- high volume
  AND ABS(([close] - [open]) / [open]) > 0.03  -- >3% move
  AND date >= '2025-01-01'
ORDER BY ABS(([close] - [open]) / [open]) DESC
```

<table>
    <thead>
        <tr>
            <th>symbol</th>
            <th>date</th>
            <th>close</th>
            <th>volume</th>
            <th>daily_move_pct</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>IFX.DE</td>
            <td>2025-04-10</td>
            <td>25.78</td>
            <td>11549391</td>
            <td>-13.78</td>
        </tr>
        <tr>
            <td>ENR.DE</td>
            <td>2025-04-07</td>
            <td>48.56</td>
            <td>8552960</td>
            <td>13.59</td>
        </tr>
        <tr>
            <td>SAN.MC</td>
            <td>2025-04-07</td>
            <td>5.243</td>
            <td>120129181</td>
            <td>12.87</td>
        </tr>
        <tr>
            <td>SAN.MC</td>
            <td>2025-04-10</td>
            <td>5.662</td>
            <td>63808362</td>
            <td>-11.14</td>
        </tr>
        <tr>
            <td>DSY.PA</td>
            <td>2026-02-16</td>
            <td>15.96</td>
            <td>7671987</td>
            <td>-10.81</td>
        </tr>
</table>



## Aggregation (GROUP BY)

### Aggregation GROUP BY — Aggregate by Stock

`GROUP BY` collapses rows into groups. Aggregate functions (`AVG`, `COUNT`, `SUM`, `MIN`, `MAX`) summarize each group. This ranks stocks by average trading volume — a liquidity measure.


```sql
-- Average daily volume by stock (top 10 most liquid)
-- GROUP BY + aggregate functions: AVG, COUNT, MIN, MAX
SELECT TOP 10
    symbol,
    COUNT(*) AS trading_days,
    ROUND(AVG(CAST(volume AS FLOAT)), 0) AS avg_volume,
    ROUND(AVG([close]), 2) AS avg_close,
    MIN(date) AS first_date,
    MAX(date) AS last_date
FROM silver.eurostoxx50_ohlcv
GROUP BY symbol
ORDER BY avg_volume DESC
```

<table>
    <thead>
        <tr>
            <th>symbol</th>
            <th>trading_days</th>
            <th>avg_volume</th>
            <th>avg_close</th>
            <th>first_date</th>
            <th>last_date</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>ISP.MI</td>
            <td>1321</td>
            <td>87588601.0</td>
            <td>3.15</td>
            <td>2021-01-04</td>
            <td>2026-03-12</td>
        </tr>
        <tr>
            <td>SAN.MC</td>
            <td>1329</td>
            <td>41770987.0</td>
            <td>4.43</td>
            <td>2021-01-04</td>
            <td>2026-03-12</td>
        </tr>
        <tr>
            <td>ENEL.MI</td>
            <td>1321</td>
            <td>24678699.0</td>
            <td>6.82</td>
            <td>2021-01-04</td>
            <td>2026-03-12</td>
        </tr>
        <tr>
            <td>BBVA.MC</td>
            <td>1329</td>
            <td>16654457.0</td>
            <td>8.65</td>
            <td>2021-01-04</td>
            <td>2026-03-12</td>
        </tr>
        <tr>
            <td>UCG.MI</td>
            <td>1321</td>
            <td>13903710.0</td>
            <td>28.46</td>
            <td>2021-01-04</td>
            <td>2026-03-12</td>
        </tr>
</table>

> [!tip] WHERE vs HAVING Filter Placement
>
> `WHERE volume > 1000000` removes rows BEFORE grouping — fewer rows to aggregate, faster query. `HAVING AVG(volume) > 1000000` computes the average for every group, then discards groups that don't qualify. Put filters in `WHERE` whenever possible; use `HAVING` only for conditions on aggregate results.

### Aggregation GROUP BY — Aggregate by Time Period

Group by `YEAR(date), MONTH(date)` to build time-series summaries. Shows monthly high/low/average price and total volume — the basis for monthly performance reports.

> [!warning] Functions on columns kill SARGability
>
> `WHERE YEAR(date) = 2025` cannot use an index on `date` — the engine evaluates `YEAR()` on every row. Rewrite as `WHERE date >= '2025-01-01' AND date < '2026-01-01'`. Functions in `GROUP BY` are fine (no index needed). Functions in `WHERE` are the problem. See [sargable-queries](https://alp78.github.io/elysium/04-SQL-Server/T-SQL/sargable-queries).

> [!success] Safe Pattern
>
> Replace any function-on-column `WHERE` predicate with a range: `WHERE date >= '2025-01-01' AND date < '2026-01-01'` instead of `WHERE YEAR(date) = 2025`. For string patterns, use `WHERE symbol LIKE 'ASML%'` rather than `WHERE LEFT(symbol, 4) = 'ASML'`. This allows the engine to seek directly into the index rather than scanning every row.


```sql
-- Monthly performance summary for ASML
-- GROUP BY with date functions: YEAR, MONTH
SELECT TOP 15
    YEAR(date) AS yr,
    MONTH(date) AS mo,
    COUNT(*) AS days,
    ROUND(MIN([close]), 2) AS month_low,
    ROUND(MAX([close]), 2) AS month_high,
    ROUND(AVG([close]), 2) AS avg_close,
    SUM(volume) AS total_volume
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'ASML.AS' AND date >= '2025-01-01'
GROUP BY YEAR(date), MONTH(date)
ORDER BY yr, mo
```

<table>
    <thead>
        <tr>
            <th>yr</th>
            <th>mo</th>
            <th>days</th>
            <th>month_low</th>
            <th>month_high</th>
            <th>avg_close</th>
            <th>total_volume</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>2025</td>
            <td>1</td>
            <td>22</td>
            <td>646.6</td>
            <td>748.1</td>
            <td>714.71</td>
            <td>19121187</td>
        </tr>
        <tr>
            <td>2025</td>
            <td>2</td>
            <td>20</td>
            <td>678.6</td>
            <td>737.9</td>
            <td>713.04</td>
            <td>15276962</td>
        </tr>
        <tr>
            <td>2025</td>
            <td>3</td>
            <td>21</td>
            <td>606.0</td>
            <td>690.3</td>
            <td>656.58</td>
            <td>17508550</td>
        </tr>
        <tr>
            <td>2025</td>
            <td>4</td>
            <td>20</td>
            <td>550.0</td>
            <td>619.7</td>
            <td>581.0</td>
            <td>22544929</td>
        </tr>
        <tr>
            <td>2025</td>
            <td>5</td>
            <td>21</td>
            <td>601.5</td>
            <td>686.6</td>
            <td>650.18</td>
            <td>13112045</td>
        </tr>
</table>



## JOINs Across Medallion Layers

> [!danger] JOINs Multiply Rows on Duplicates
>
> JOINs silently multiply rows when keys have duplicates.
> A `JOIN` on a non-unique key produces a Cartesian product for those keys. If
> `silver.index_dim` has 2 rows for `ASML.AS` and OHLCV has 1,331 rows, the result has
> 2,662 rows for ASML — silently doubling your data with no error. Always verify row
> counts after a JOIN: `SELECT COUNT(*) FROM result` vs expected.

> [!success] Safe Pattern
>
> Before joining, verify the join key is unique on the "one" side: `SELECT symbol, COUNT(*) FROM silver.index_dim WHERE is_current = 1 GROUP BY symbol HAVING COUNT(*) > 1`. If duplicates exist, use a subquery with `ROW_NUMBER()` to deduplicate before joining, or add `AND d.is_current = 1` to restrict to the current row.

> [!warning] NULL Keys Break LEFT JOINs
>
> LEFT JOIN with NULL keys — rows disappear silently.
> `NULL = NULL` returns `FALSE` in SQL, not `TRUE`. If join keys contain NULLs, those
> rows never match. Use `COALESCE(key, 'UNKNOWN')` or `IS NOT DISTINCT FROM` (SQL Server
> doesn't support this — use `WHERE key1 = key2 OR (key1 IS NULL AND key2 IS NULL)`).

> [!success] Safe Pattern
>
> If the join key can be NULL, use `COALESCE(key, '')` on both sides: `ON COALESCE(a.symbol, '') = COALESCE(b.symbol, '')`. Alternatively, filter out NULLs before joining with `WHERE key IS NOT NULL`. After a LEFT JOIN, check whether expected matches were lost: `SELECT COUNT(*) WHERE right_side_column IS NULL` should be close to zero if the join key is meant to be populated.

### JOIN Across Medallion Layers — OHLCV + Dimension (Silver)

`JOIN` combines rows from two tables on a matching key. Here we join price data (silver OHLCV) with company metadata (silver dimension) to get the latest price + sector + country for each stock.

The subquery with `ROW_NUMBER()` picks only the most recent price per symbol.


```sql
-- JOIN silver OHLCV with silver dimension (company info)
-- Get latest price + sector + country for each stock
SELECT TOP 15
    d.symbol,
    d.short_name,
    d.sector,
    d.country,
    p.[close] AS last_close,
    p.date AS last_date,
    p.volume
FROM silver.index_dim d
JOIN (
    -- Subquery: get the latest price per symbol
    SELECT symbol, [close], date, volume,
           ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) AS rn
    FROM silver.eurostoxx50_ohlcv
) p ON d.symbol = p.symbol AND p.rn = 1
WHERE d._index = 'euro_stoxx_50' AND d.is_current = 1
ORDER BY p.[close] DESC
```

<table>
    <thead>
        <tr>
            <th>symbol</th>
            <th>short_name</th>
            <th>sector</th>
            <th>country</th>
            <th>last_close</th>
            <th>last_date</th>
            <th>volume</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>RMS.PA</td>
            <td>HERMES INTL</td>
            <td>Consumer Cyclical</td>
            <td>France</td>
            <td>1906.0</td>
            <td>2026-03-12</td>
            <td>18681</td>
        </tr>
        <tr>
            <td>RHM.DE</td>
            <td>RHEINMETALL AG</td>
            <td>Industrials</td>
            <td>Germany</td>
            <td>1551.5</td>
            <td>2026-03-12</td>
            <td>158741</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>ASML HOLDING</td>
            <td>Technology</td>
            <td>Netherlands</td>
            <td>1190.8</td>
            <td>2026-03-12</td>
            <td>128223</td>
        </tr>
        <tr>
            <td>ADYEN.AS</td>
            <td>ADYEN</td>
            <td>Technology</td>
            <td>Netherlands</td>
            <td>925.7</td>
            <td>2026-03-12</td>
            <td>27887</td>
        </tr>
        <tr>
            <td>ARGX.BR</td>
            <td>ARGENX SE</td>
            <td>Healthcare</td>
            <td>Netherlands</td>
            <td>626.6</td>
            <td>2026-03-12</td>
            <td>14083</td>
        </tr>
</table>



### JOIN Across Medallion Layers — Gold Scores + Dimension (Cross-Layer)

The gold layer has pre-computed composite scores. We join with the dimension table to add human-readable names and sector labels — this is what a dashboard query looks like.


```sql
-- JOIN gold scores with dimension for a complete stock dashboard view
SELECT TOP 15
    s.composite_rank AS [rank],
    s.symbol,
    d.short_name,
    d.sector,
    ROUND(s.composite_score, 4) AS score,
    ROUND(s.relative_value_score, 3) AS value,
    ROUND(s.momentum_score, 3) AS momentum,
    ROUND(s.sentiment_score, 3) AS sentiment,
    s.current_price,
    ROUND(s.index_weight * 100, 2) AS weight_pct
FROM gold.scores_daily s
JOIN silver.index_dim d ON s.symbol = d.symbol AND d._index = s._index AND d.is_current = 1
WHERE s._index = 'euro_stoxx_50'
  AND s.score_date = (SELECT MAX(score_date) FROM gold.scores_daily WHERE _index = 'euro_stoxx_50')
ORDER BY s.composite_rank
```

<table>
    <thead>
        <tr>
            <th>rank</th>
            <th>symbol</th>
            <th>short_name</th>
            <th>sector</th>
            <th>score</th>
            <th>value</th>
            <th>momentum</th>
            <th>sentiment</th>
            <th>current_price</th>
            <th>weight_pct</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>1</td>
            <td>BNP.PA</td>
            <td>BNP PARIBAS ACT.A</td>
            <td>Financial Services</td>
            <td>0.6796</td>
            <td>1.497</td>
            <td>0.46</td>
            <td>0.081</td>
            <td>87.44</td>
            <td>1.94</td>
        </tr>
        <tr>
            <td>2</td>
            <td>VOW.DE</td>
            <td>VOLKSWAGEN AG</td>
            <td>Consumer Cyclical</td>
            <td>0.5756</td>
            <td>1.028</td>
            <td>-0.382</td>
            <td>1.081</td>
            <td>92.85</td>
            <td>0.93</td>
        </tr>
        <tr>
            <td>3</td>
            <td>DTE.DE</td>
            <td>DEUTSCHE TELEKOM AG</td>
            <td>Communication Services</td>
            <td>0.487</td>
            <td>0.226</td>
            <td>0.706</td>
            <td>0.529</td>
            <td>32.55</td>
            <td>3.13</td>
        </tr>
        <tr>
            <td>4</td>
            <td>TTE.PA</td>
            <td>TOTALENERGIES</td>
            <td>Energy</td>
            <td>0.3913</td>
            <td>0.585</td>
            <td>1.307</td>
            <td>-0.719</td>
            <td>69.8</td>
            <td>2.95</td>
        </tr>
        <tr>
            <td>5</td>
            <td>ABI.BR</td>
            <td>AB INBEV</td>
            <td>Consumer Defensive</td>
            <td>0.3852</td>
            <td>0.251</td>
            <td>0.537</td>
            <td>0.368</td>
            <td>62.76</td>
            <td>2.43</td>
        </tr>
</table>



## Window Functions

> [!warning] Window Functions Keep All Rows
>
> Window functions do NOT reduce row count — unlike GROUP BY.
> `AVG(close) OVER (PARTITION BY symbol)` adds a column to every row without collapsing.
> Forgetting this and expecting aggregated output is the most common window function
> mistake. If you want one row per group, use GROUP BY. If you want the aggregate on
> every row alongside the detail, use OVER().

> [!success] Safe Pattern
>
> Use `GROUP BY` when you want one output row per group (e.g., average volume per stock). Use `OVER (PARTITION BY ...)` when you want the aggregate attached to every detail row (e.g., a running total or the partition average alongside each row for normalization). If the query is slow, wrap the window function in an outer SELECT with `WHERE` to filter after the window computation.

### Window Functions — Moving Averages (SMA)

A **moving average** smooths price data over N days. Used for trend detection:
- **SMA 30** (short-term): responsive to recent price action
- **SMA 90** (long-term): filters out noise
- Price above SMA = bullish momentum. Below = bearish.

`AVG() OVER (ROWS BETWEEN N PRECEDING AND CURRENT ROW)` — the window slides forward one row at a time.


```sql
-- Moving averages: SMA 30 and SMA 90
-- OVER (PARTITION BY symbol ORDER BY date ROWS BETWEEN 29 PRECEDING AND CURRENT ROW)
--   ↑ group by stock    ↑ sort by date   ↑ sliding window of 30 rows
SELECT TOP 15
    symbol,
    date,
    ROUND([close], 2) AS [close],
    ROUND(AVG([close]) OVER (
        PARTITION BY symbol ORDER BY date
        ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
    ), 2) AS sma_30,
    ROUND(AVG([close]) OVER (
        PARTITION BY symbol ORDER BY date
        ROWS BETWEEN 89 PRECEDING AND CURRENT ROW
    ), 2) AS sma_90
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'ASML.AS'
ORDER BY date DESC
```

<table>
    <thead>
        <tr>
            <th>symbol</th>
            <th>date</th>
            <th>close</th>
            <th>sma_30</th>
            <th>sma_90</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-12</td>
            <td>1190.8</td>
            <td>1204.41</td>
            <td>1052.59</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-11</td>
            <td>1198.8</td>
            <td>1204.45</td>
            <td>1049.65</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-10</td>
            <td>1200.0</td>
            <td>1204.31</td>
            <td>1046.53</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-09</td>
            <td>1147.6</td>
            <td>1204.89</td>
            <td>1043.62</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-06</td>
            <td>1147.0</td>
            <td>1205.91</td>
            <td>1041.08</td>
        </tr>
</table>



### Window Functions — LAG / LEAD Compare Rows

**LAG(col, N)** returns the value from N rows **before** the current row.
**LEAD(col, N)** returns the value from N rows **after**.

Use cases:
- **Daily returns**: `(close - LAG(close)) / LAG(close)`
- **Gap detection**: `DATEDIFF(DAY, LAG(date), date)` — if >1, there was a holiday/weekend
- **Trend direction**: compare today vs yesterday


```sql
-- LAG: get previous row's value within each stock's time series
-- LAG([close]) OVER (PARTITION BY symbol ORDER BY date)
--   ↑ previous close    ↑ within each stock  ↑ in date order
SELECT TOP 15
    symbol,
    date,
    ROUND([close], 2) AS [close],
    ROUND(LAG([close]) OVER (PARTITION BY symbol ORDER BY date), 2) AS prev_close,
    ROUND(
        ([close] - LAG([close]) OVER (PARTITION BY symbol ORDER BY date))
        / LAG([close]) OVER (PARTITION BY symbol ORDER BY date) * 100,
    2) AS daily_return_pct,
    DATEDIFF(DAY,
        LAG(date) OVER (PARTITION BY symbol ORDER BY date),
        date
    ) AS days_gap  -- >1 means weekend or holiday
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'ASML.AS'
ORDER BY date DESC
```

<table>
    <thead>
        <tr>
            <th>symbol</th>
            <th>date</th>
            <th>close</th>
            <th>prev_close</th>
            <th>daily_return_pct</th>
            <th>days_gap</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-12</td>
            <td>1190.8</td>
            <td>1198.8</td>
            <td>-0.67</td>
            <td>1</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-11</td>
            <td>1198.8</td>
            <td>1200.0</td>
            <td>-0.1</td>
            <td>1</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-10</td>
            <td>1200.0</td>
            <td>1147.6</td>
            <td>4.57</td>
            <td>1</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-09</td>
            <td>1147.6</td>
            <td>1147.0</td>
            <td>0.05</td>
            <td>3</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-06</td>
            <td>1147.0</td>
            <td>1186.0</td>
            <td>-3.29</td>
            <td>1</td>
        </tr>
</table>



### Window Functions — RANK / DENSE_RANK / NTILE Ranking

- **RANK()**: assigns rank with gaps (1, 2, 2, 4)
- **DENSE_RANK()**: no gaps (1, 2, 2, 3)
- **ROW_NUMBER()**: unique, no ties (1, 2, 3, 4)
- **NTILE(N)**: divide rows into N equal buckets (quartiles, deciles)

This is the core of the gold scoring engine — rank stocks by composite score.


```sql
-- Rank stocks by YTD return
-- Use self-join on pre-computed boundary dates (no subquery inside aggregate)
WITH bounds AS (
    -- First and last trading date of the year (single row)
    SELECT
        MIN(CASE WHEN YEAR(date) = YEAR(GETDATE()) THEN date END) AS first_date,
        MAX(date) AS last_date
    FROM silver.eurostoxx50_ohlcv
),
ytd AS (
    SELECT
        f.symbol,
        ROUND((l.[close] - f.[close]) / NULLIF(f.[close], 0), 4) AS ytd_return
    FROM silver.eurostoxx50_ohlcv f
    JOIN silver.eurostoxx50_ohlcv l ON f.symbol = l.symbol
    JOIN bounds b ON f.date = b.first_date AND l.date = b.last_date
)
SELECT TOP 10
    symbol,
    ytd_return,
    RANK() OVER (ORDER BY ytd_return DESC) AS rank_best,
    RANK() OVER (ORDER BY ytd_return ASC) AS rank_worst,
    NTILE(4) OVER (ORDER BY ytd_return DESC) AS quartile
FROM ytd
ORDER BY rank_best
```

<table>
    <thead>
        <tr>
            <th>symbol</th>
            <th>ytd_return</th>
            <th>rank_best</th>
            <th>rank_worst</th>
            <th>quartile</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>ENI.MI</td>
            <td>0.3042</td>
            <td>1</td>
            <td>50</td>
            <td>1</td>
        </tr>
        <tr>
            <td>ENR.DE</td>
            <td>0.2508</td>
            <td>2</td>
            <td>49</td>
            <td>1</td>
        </tr>
        <tr>
            <td>TTE.PA</td>
            <td>0.2437</td>
            <td>3</td>
            <td>48</td>
            <td>1</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>0.2073</td>
            <td>4</td>
            <td>47</td>
            <td>1</td>
        </tr>
        <tr>
            <td>AD.AS</td>
            <td>0.1772</td>
            <td>5</td>
            <td>46</td>
            <td>1</td>
        </tr>
</table>



## CTEs & Subqueries

### CTEs & Subqueries — Sector Heatmap

A **CTE** (`WITH name AS (SELECT ...)`) is a named temporary result set. Chaining CTEs makes complex queries readable — each step has a name.

This builds a sector heatmap: average score, best/worst rank per sector.


```sql
-- CTE (Common Table Expression) — readable multi-step queries
-- Build a sector heatmap: avg composite score by sector
WITH latest_scores AS (
    SELECT s.symbol, s.composite_score, s.relative_value_score,
           s.momentum_score, s.sentiment_score, s.composite_rank,
           s.current_price, s.index_weight, d.sector, d.short_name
    FROM gold.scores_daily s
    JOIN silver.index_dim d ON s.symbol = d.symbol AND d._index = s._index AND d.is_current = 1
    WHERE s._index = 'euro_stoxx_50'
      AND s.score_date = (SELECT MAX(score_date) FROM gold.scores_daily WHERE _index = 'euro_stoxx_50')
),
sector_stats AS (
    SELECT 
        sector,
        COUNT(*) AS stocks,
        ROUND(AVG(composite_score), 4) AS avg_score,
        ROUND(AVG(relative_value_score), 4) AS avg_value,
        ROUND(AVG(momentum_score), 4) AS avg_momentum,
        MIN(composite_rank) AS best_rank,
        MAX(composite_rank) AS worst_rank
    FROM latest_scores
    GROUP BY sector
)
SELECT * FROM sector_stats
ORDER BY avg_score DESC
```

<table>
    <thead>
        <tr>
            <th>sector</th>
            <th>stocks</th>
            <th>avg_score</th>
            <th>avg_value</th>
            <th>avg_momentum</th>
            <th>best_rank</th>
            <th>worst_rank</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>Communication Services</td>
            <td>1</td>
            <td>0.487</td>
            <td>0.226</td>
            <td>0.7064</td>
            <td>3</td>
            <td>3</td>
        </tr>
        <tr>
            <td>Energy</td>
            <td>2</td>
            <td>0.3286</td>
            <td>0.5744</td>
            <td>1.6426</td>
            <td>4</td>
            <td>11</td>
        </tr>
        <tr>
            <td>Healthcare</td>
            <td>4</td>
            <td>0.0812</td>
            <td>-0.07</td>
            <td>-0.3722</td>
            <td>10</td>
            <td>32</td>
        </tr>
        <tr>
            <td>Technology</td>
            <td>5</td>
            <td>0.0522</td>
            <td>0.0128</td>
            <td>-0.6536</td>
            <td>6</td>
            <td>47</td>
        </tr>
        <tr>
            <td>Industrials</td>
            <td>10</td>
            <td>0.0504</td>
            <td>0.0</td>
            <td>-0.0204</td>
            <td>8</td>
            <td>43</td>
        </tr>
</table>



### CTEs & Subqueries — Chained CTEs Cross-Index Comparison

Multiple CTEs chained together. Compares YTD performance, volatility, and valuation across all 4 indices — the kind of query an index provider runs daily.


```sql
-- Chained CTEs: cross-index performance comparison
-- Compare latest performance metrics across all 4 indices
WITH latest_perf AS (
    SELECT *,
           ROW_NUMBER() OVER (PARTITION BY _index ORDER BY perf_date DESC) AS rn
    FROM gold.index_performance
)
SELECT 
    p._index,
    d.display_name,
    p.perf_date,
    ROUND(p.ytd_return * 100, 2) AS ytd_pct,
    ROUND(p.rolling_30d_return * 100, 2) AS ret_30d_pct,
    ROUND(p.rolling_30d_volatility * 100, 2) AS vol_30d_pct,
    p.stocks_count,
    ROUND(p.avg_pe, 1) AS avg_pe,
    ROUND(p.avg_dividend_yield * 100, 2) AS div_yield_pct
FROM latest_perf p
JOIN bronze.dim_index d ON p._index = d.index_key
WHERE p.rn = 1
ORDER BY ytd_pct DESC
```

<table>
    <thead>
        <tr>
            <th>_index</th>
            <th>display_name</th>
            <th>perf_date</th>
            <th>ytd_pct</th>
            <th>ret_30d_pct</th>
            <th>vol_30d_pct</th>
            <th>stocks_count</th>
            <th>avg_pe</th>
            <th>div_yield_pct</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>oil_20</td>
            <td>Oil & Gas 20</td>
            <td>2026-03-11</td>
            <td>27.7</td>
            <td>15.33</td>
            <td>21.93</td>
            <td>19</td>
            <td>16.1</td>
            <td>3.28</td>
        </tr>
        <tr>
            <td>stoxx_asia_50</td>
            <td>STOXX Asia/Pacific 50</td>
            <td>2026-03-12</td>
            <td>5.45</td>
            <td>2.68</td>
            <td>23.3</td>
            <td>50</td>
            <td>15.8</td>
            <td>1.96</td>
        </tr>
        <tr>
            <td>stoxx_usa_50</td>
            <td>STOXX USA 50</td>
            <td>2026-03-11</td>
            <td>3.71</td>
            <td>0.6</td>
            <td>13.32</td>
            <td>50</td>
            <td>20.8</td>
            <td>1.42</td>
        </tr>
        <tr>
            <td>euro_stoxx_50</td>
            <td>Euro Stoxx 50</td>
            <td>2026-03-12</td>
            <td>-2.39</td>
            <td>-2.08</td>
            <td>18.06</td>
            <td>50</td>
            <td>14.0</td>
            <td>2.9</td>
        </tr>
</table>



## Data Quality Checks

### Data Quality Checks

Every pipeline needs quality gates. `UNION ALL` stacks multiple checks into one result. Run this after every load — if any check returns non-zero, investigate before promoting to gold.


> [!tip] UNION ALL Quality Gate Pattern
>
> Stack multiple checks into one result set with `UNION ALL`. Each check returns a named row with an issue count. Run after every load — any non-zero value needs investigation before promoting to gold.

```sql
-- Structural checks: NULLs and invalid values
SELECT 'null_prices' AS check_name,
       COUNT(*) AS issues
FROM silver.eurostoxx50_ohlcv
WHERE [close] IS NULL OR [open] IS NULL

UNION ALL

SELECT 'negative_prices', COUNT(*)
FROM silver.eurostoxx50_ohlcv
WHERE [close] < 0 OR [open] < 0

UNION ALL

SELECT 'high_lt_low', COUNT(*)
FROM silver.eurostoxx50_ohlcv
WHERE high < low
```

```sql
-- Operational checks: gap-fill count and freshness
SELECT 'gap_filled_rows' AS check_name,
       COUNT(*) AS issues
FROM silver.eurostoxx50_ohlcv
WHERE is_filled = 1

UNION ALL

SELECT 'days_since_update',
       DATEDIFF(DAY, MAX(date), GETDATE())
FROM silver.eurostoxx50_ohlcv
```

<table>
    <thead>
        <tr>
            <th>check_name</th>
            <th>issues</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>null_prices</td>
            <td>0</td>
        </tr>
        <tr>
            <td>negative_prices</td>
            <td>0</td>
        </tr>
        <tr>
            <td>high_lt_low</td>
            <td>0</td>
        </tr>
        <tr>
            <td>gap_filled_rows</td>
            <td>6</td>
        </tr>
        <tr>
            <td>days_since_update</td>
            <td>10</td>
        </tr>
</table>



## Bronze → Silver → Gold Transforms

> [!tip] Related pattern
>
> The SQL that creates and populates the bronze tables queried here is covered in [bronze-layer-loading](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/bronze-layer-loading), which walks through the ingestion pipeline that feeds this medallion architecture.

### Bronze → Silver → Gold Transforms — Daily Returns

The silver transform adds computed columns to raw data. Here, `LAG()` computes daily returns from the price time series. The `is_filled` flag marks gap-filled rows (weekends/holidays).


```sql
-- Example: how the bronze → silver transform works
-- Silver adds daily returns and detects gap-filled rows
SELECT TOP 10
    symbol,
    date,
    ROUND([close], 2) AS [close],
    ROUND(
        ([close] - LAG([close]) OVER (PARTITION BY symbol ORDER BY date))
        / NULLIF(LAG([close]) OVER (PARTITION BY symbol ORDER BY date), 0),
    4) AS daily_return,
    is_filled
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'ASML.AS'
ORDER BY date DESC
```

<table>
    <thead>
        <tr>
            <th>symbol</th>
            <th>date</th>
            <th>close</th>
            <th>daily_return</th>
            <th>is_filled</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-12</td>
            <td>1190.8</td>
            <td>-0.0067</td>
            <td>False</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-11</td>
            <td>1198.8</td>
            <td>-0.001</td>
            <td>False</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-10</td>
            <td>1200.0</td>
            <td>0.0457</td>
            <td>False</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-09</td>
            <td>1147.6</td>
            <td>0.0005</td>
            <td>False</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-06</td>
            <td>1147.0</td>
            <td>-0.0329</td>
            <td>False</td>
        </tr>
</table>



### Bronze → Silver → Gold Transforms — Z-Score Normalization

The gold transform normalizes scores across the index using z-scores: `(value - mean) / stddev`. Stocks are then ranked by composite score. This is the core of any index scoring engine.


```sql
-- Example: how the gold scoring works
-- Z-score normalization within index → composite rank
WITH base AS (
    SELECT symbol, composite_score,
           AVG(composite_score) OVER () AS mean_score,
           STDEV(composite_score) OVER () AS std_score
    FROM gold.scores_daily
    WHERE _index = 'euro_stoxx_50'
      AND score_date = (SELECT MAX(score_date) FROM gold.scores_daily WHERE _index = 'euro_stoxx_50')
)
SELECT TOP 10
    symbol,
    ROUND(composite_score, 4) AS raw_score,
    ROUND((composite_score - mean_score) / NULLIF(std_score, 0), 2) AS z_score,
    DENSE_RANK() OVER (ORDER BY composite_score DESC) AS [rank]
FROM base
ORDER BY [rank]
```

<table>
    <thead>
        <tr>
            <th>symbol</th>
            <th>raw_score</th>
            <th>z_score</th>
            <th>rank</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>BNP.PA</td>
            <td>0.6796</td>
            <td>2.08</td>
            <td>1</td>
        </tr>
        <tr>
            <td>VOW.DE</td>
            <td>0.5756</td>
            <td>1.76</td>
            <td>2</td>
        </tr>
        <tr>
            <td>DTE.DE</td>
            <td>0.487</td>
            <td>1.48</td>
            <td>3</td>
        </tr>
        <tr>
            <td>TTE.PA</td>
            <td>0.3913</td>
            <td>1.18</td>
            <td>4</td>
        </tr>
        <tr>
            <td>ABI.BR</td>
            <td>0.3852</td>
            <td>1.16</td>
            <td>5</td>
        </tr>
</table>


