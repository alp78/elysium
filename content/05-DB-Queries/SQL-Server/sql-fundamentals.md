---
type: reference
category: db-queries
technology: [sql-server, t-sql]
tags: [sql]
aliases: [SQL fundamentals, T-SQL basics, SQL queries, SELECT, JOIN, WHERE, GROUP BY]
keywords: [sql, t-sql, select, join, inner join, left join, where, group by, having, order by, subquery, union, aggregate, count, sum, avg, distinct, null, like, between, in, case, coalesce]
description: "SQL Server T-SQL fundamentals with executable examples and cell outputs — covers SELECT, filtering, joins, aggregation, subqueries, and set operations."
related:
  - "[[sql-advanced]]"
  - "[[sql-engineering]]"
  - "[[sargable-queries]]"
  - "[[merge-and-upsert]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# SQL for Data Engineering

Hands-on SQL using the **stoxx** index database (SQL Server).
Medallion architecture: Bronze (raw) → Silver (cleaned) → Gold (analytics). For the database objects and performance patterns that build on these fundamentals, continue to [[sql-engineering]].

Topics covered:
- Connection & Schema Exploration
- SELECT, filtering, sorting, aggregation
- JOINs across medallion layers
- Window Functions (ranking, moving averages, lag/lead)
- CTEs & Subqueries
- Bronze → Silver → Gold transformations
- Data Quality Checks
- Performance (indexes, execution plans)

```python
%load_ext sql
%config SqlMagic.displaycon = False
%config SqlMagic.displaylimit = 0
```

```python
%sql mssql+pyodbc://sa:EsgDev2026Pass1@localhost:1434/stoxx?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes&MARS_Connection=yes
```

Connecting to &#x27;mssql+pyodbc://sa:***@localhost:1434/stoxx?TrustServerCertificate=yes&amp;driver=ODBC+Driver+18+for+SQL+Server&#x27;


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
        <tr>
            <td>bronze</td>
            <td>pulse</td>
            <td>40</td>
        </tr>
        <tr>
            <td>bronze</td>
            <td>pulse_tickers</td>
            <td>40</td>
        </tr>
        <tr>
            <td>bronze</td>
            <td>signals_daily</td>
            <td>169</td>
        </tr>
        <tr>
            <td>bronze</td>
            <td>signals_quarterly</td>
            <td>169</td>
        </tr>
        <tr>
            <td>bronze</td>
            <td>stoxxasia50_ohlcv</td>
            <td>50</td>
        </tr>
        <tr>
            <td>bronze</td>
            <td>stoxxusa50_ohlcv</td>
            <td>50</td>
        </tr>
        <tr>
            <td>bronze</td>
            <td>trading_calendar</td>
            <td>29335</td>
        </tr>
        <tr>
            <td>gold</td>
            <td>index_performance</td>
            <td>5281</td>
        </tr>
        <tr>
            <td>gold</td>
            <td>scores_daily</td>
            <td>466</td>
        </tr>
        <tr>
            <td>gold</td>
            <td>scores_quarterly</td>
            <td>170</td>
        </tr>
    </tbody>
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
        <tr>
            <td>low</td>
            <td>float</td>
            <td>None</td>
            <td>YES</td>
        </tr>
        <tr>
            <td>close</td>
            <td>float</td>
            <td>None</td>
            <td>YES</td>
        </tr>
        <tr>
            <td>adj_close</td>
            <td>float</td>
            <td>None</td>
            <td>YES</td>
        </tr>
        <tr>
            <td>volume</td>
            <td>bigint</td>
            <td>None</td>
            <td>YES</td>
        </tr>
        <tr>
            <td>dividends</td>
            <td>float</td>
            <td>None</td>
            <td>YES</td>
        </tr>
        <tr>
            <td>stock_splits</td>
            <td>float</td>
            <td>None</td>
            <td>YES</td>
        </tr>
        <tr>
            <td>is_filled</td>
            <td>bit</td>
            <td>None</td>
            <td>NO</td>
        </tr>
    </tbody>
</table>



## SELECT, Filtering & Sorting

### SELECT, Filtering & Sorting — Basic SELECT with WHERE

The fundamental query: pick columns, filter rows, sort results. `TOP N` limits output (SQL Server). PostgreSQL uses `LIMIT N`.


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
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-05</td>
            <td>1198.6</td>
            <td>1220.0</td>
            <td>1183.0</td>
            <td>1186.0</td>
            <td>778081</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-04</td>
            <td>1171.0</td>
            <td>1210.8</td>
            <td>1167.6</td>
            <td>1199.8</td>
            <td>714587</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-03</td>
            <td>1186.6</td>
            <td>1187.4</td>
            <td>1144.0</td>
            <td>1161.8</td>
            <td>941945</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-02</td>
            <td>1192.8</td>
            <td>1231.4</td>
            <td>1180.0</td>
            <td>1210.4</td>
            <td>871267</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-02-27</td>
            <td>1234.8</td>
            <td>1239.8</td>
            <td>1201.6</td>
            <td>1233.4</td>
            <td>1010698</td>
        </tr>
    </tbody>
</table>



### SELECT & Filtering — Multi-Condition WHERE

Combine conditions with `AND` / `OR`. Use `ABS()` for absolute values. This finds high-volume days with large price swings — potential breakout or crash days.


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
        <tr>
            <td>ENR.DE</td>
            <td>2025-03-10</td>
            <td>50.56</td>
            <td>9304250</td>
            <td>-10.2</td>
        </tr>
        <tr>
            <td>UCG.MI</td>
            <td>2025-04-07</td>
            <td>42.65</td>
            <td>27894767</td>
            <td>9.08</td>
        </tr>
        <tr>
            <td>BNP.PA</td>
            <td>2025-04-10</td>
            <td>67.23</td>
            <td>7709559</td>
            <td>-8.69</td>
        </tr>
        <tr>
            <td>BNP.PA</td>
            <td>2025-10-20</td>
            <td>69.1</td>
            <td>13072979</td>
            <td>-8.63</td>
        </tr>
        <tr>
            <td>BAYN.DE</td>
            <td>2025-08-06</td>
            <td>24.975</td>
            <td>8866224</td>
            <td>-8.5</td>
        </tr>
        <tr>
            <td>ISP.MI</td>
            <td>2025-04-10</td>
            <td>4.1325</td>
            <td>142718056</td>
            <td>-8.17</td>
        </tr>
        <tr>
            <td>SAP.DE</td>
            <td>2026-01-29</td>
            <td>164.62</td>
            <td>15846791</td>
            <td>-8.03</td>
        </tr>
        <tr>
            <td>DSY.PA</td>
            <td>2025-07-24</td>
            <td>29.31</td>
            <td>6132486</td>
            <td>-7.97</td>
        </tr>
        <tr>
            <td>BBVA.MC</td>
            <td>2025-04-04</td>
            <td>11.36</td>
            <td>28042404</td>
            <td>-7.75</td>
        </tr>
        <tr>
            <td>UCG.MI</td>
            <td>2025-04-04</td>
            <td>43.865</td>
            <td>27283463</td>
            <td>-7.65</td>
        </tr>
    </tbody>
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
        <tr>
            <td>ENI.MI</td>
            <td>1321</td>
            <td>12976208.0</td>
            <td>13.4</td>
            <td>2021-01-04</td>
            <td>2026-03-12</td>
        </tr>
        <tr>
            <td>INGA.AS</td>
            <td>1331</td>
            <td>12803589.0</td>
            <td>14.04</td>
            <td>2021-01-04</td>
            <td>2026-03-12</td>
        </tr>
        <tr>
            <td>IBE.MC</td>
            <td>1329</td>
            <td>12034835.0</td>
            <td>12.26</td>
            <td>2021-01-04</td>
            <td>2026-03-12</td>
        </tr>
        <tr>
            <td>DTE.DE</td>
            <td>1324</td>
            <td>7575084.0</td>
            <td>22.43</td>
            <td>2021-01-04</td>
            <td>2026-03-12</td>
        </tr>
        <tr>
            <td>NDA-FI.HE</td>
            <td>1306</td>
            <td>5375454.0</td>
            <td>10.85</td>
            <td>2021-01-04</td>
            <td>2026-03-12</td>
        </tr>
    </tbody>
</table>



### Aggregation GROUP BY — Aggregate by Time Period

Group by `YEAR(date), MONTH(date)` to build time-series summaries. Shows monthly high/low/average price and total volume — the basis for monthly performance reports.


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
        <tr>
            <td>2025</td>
            <td>6</td>
            <td>21</td>
            <td>646.2</td>
            <td>694.5</td>
            <td>670.05</td>
            <td>13292850</td>
        </tr>
        <tr>
            <td>2025</td>
            <td>7</td>
            <td>23</td>
            <td>602.4</td>
            <td>706.1</td>
            <td>649.36</td>
            <td>17325416</td>
        </tr>
        <tr>
            <td>2025</td>
            <td>8</td>
            <td>21</td>
            <td>592.9</td>
            <td>660.2</td>
            <td>630.69</td>
            <td>10164549</td>
        </tr>
        <tr>
            <td>2025</td>
            <td>9</td>
            <td>22</td>
            <td>617.2</td>
            <td>828.1</td>
            <td>732.09</td>
            <td>15510433</td>
        </tr>
        <tr>
            <td>2025</td>
            <td>10</td>
            <td>23</td>
            <td>813.9</td>
            <td>937.5</td>
            <td>879.78</td>
            <td>16383868</td>
        </tr>
        <tr>
            <td>2025</td>
            <td>11</td>
            <td>20</td>
            <td>834.0</td>
            <td>926.5</td>
            <td>885.98</td>
            <td>12064891</td>
        </tr>
        <tr>
            <td>2025</td>
            <td>12</td>
            <td>21</td>
            <td>874.0</td>
            <td>963.4</td>
            <td>924.72</td>
            <td>10360738</td>
        </tr>
        <tr>
            <td>2026</td>
            <td>1</td>
            <td>21</td>
            <td>986.3</td>
            <td>1217.6</td>
            <td>1124.0</td>
            <td>16549130</td>
        </tr>
        <tr>
            <td>2026</td>
            <td>2</td>
            <td>20</td>
            <td>1140.6</td>
            <td>1288.4</td>
            <td>1213.73</td>
            <td>11528098</td>
        </tr>
        <tr>
            <td>2026</td>
            <td>3</td>
            <td>9</td>
            <td>1147.0</td>
            <td>1210.4</td>
            <td>1182.47</td>
            <td>6344179</td>
        </tr>
    </tbody>
</table>



## JOINs Across Medallion Layers

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
        <tr>
            <td>MUV2.DE</td>
            <td>MUENCHENER RUECKVERS.-GES. AG N</td>
            <td>Financial Services</td>
            <td>Germany</td>
            <td>526.2</td>
            <td>2026-03-12</td>
            <td>86783</td>
        </tr>
        <tr>
            <td>MC.PA</td>
            <td>LVMH</td>
            <td>Consumer Cyclical</td>
            <td>France</td>
            <td>494.35</td>
            <td>2026-03-12</td>
            <td>171997</td>
        </tr>
        <tr>
            <td>OR.PA</td>
            <td>L'OREAL</td>
            <td>Consumer Defensive</td>
            <td>France</td>
            <td>360.8</td>
            <td>2026-03-12</td>
            <td>82621</td>
        </tr>
        <tr>
            <td>ALV.DE</td>
            <td>Allianz SE</td>
            <td>Financial Services</td>
            <td>Germany</td>
            <td>348.7</td>
            <td>2026-03-12</td>
            <td>182426</td>
        </tr>
        <tr>
            <td>SAF.PA</td>
            <td>SAFRAN</td>
            <td>Industrials</td>
            <td>France</td>
            <td>315.4</td>
            <td>2026-03-12</td>
            <td>160065</td>
        </tr>
        <tr>
            <td>RACE.MI</td>
            <td>FERRARI</td>
            <td>Consumer Cyclical</td>
            <td>Italy</td>
            <td>292.3</td>
            <td>2026-03-12</td>
            <td>102906</td>
        </tr>
        <tr>
            <td>SU.PA</td>
            <td>SCHNEIDER ELECTRIC SE</td>
            <td>Industrials</td>
            <td>France</td>
            <td>254.65</td>
            <td>2026-03-12</td>
            <td>279961</td>
        </tr>
        <tr>
            <td>DB1.DE</td>
            <td>DEUTSCHE BOERSE AG</td>
            <td>Financial Services</td>
            <td>Germany</td>
            <td>237.9</td>
            <td>2026-03-12</td>
            <td>130157</td>
        </tr>
        <tr>
            <td>SIE.DE</td>
            <td>SIEMENS AG</td>
            <td>Industrials</td>
            <td>Germany</td>
            <td>223.75</td>
            <td>2026-03-12</td>
            <td>409494</td>
        </tr>
        <tr>
            <td>EL.PA</td>
            <td>ESSILORLUXOTTICA</td>
            <td>Healthcare</td>
            <td>France</td>
            <td>209.5</td>
            <td>2026-03-12</td>
            <td>172944</td>
        </tr>
    </tbody>
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
        <tr>
            <td>6</td>
            <td>IFX.DE</td>
            <td>INFINEON TECHNOLOGIES AG</td>
            <td>Technology</td>
            <td>0.3487</td>
            <td>0.084</td>
            <td>0.302</td>
            <td>0.661</td>
            <td>40.735</td>
            <td>1.06</td>
        </tr>
        <tr>
            <td>7</td>
            <td>SAN.MC</td>
            <td>BANCO SANTANDER S.A.</td>
            <td>Financial Services</td>
            <td>0.3106</td>
            <td>-0.037</td>
            <td>0.45</td>
            <td>0.519</td>
            <td>9.617</td>
            <td>2.78</td>
        </tr>
        <tr>
            <td>8</td>
            <td>DG.PA</td>
            <td>VINCI</td>
            <td>Industrials</td>
            <td>0.2928</td>
            <td>0.957</td>
            <td>0.489</td>
            <td>-0.568</td>
            <td>129.9</td>
            <td>1.43</td>
        </tr>
        <tr>
            <td>9</td>
            <td>ISP.MI</td>
            <td>INTESA SANPAOLO</td>
            <td>Financial Services</td>
            <td>0.2852</td>
            <td>0.553</td>
            <td>-0.208</td>
            <td>0.511</td>
            <td>5.204</td>
            <td>1.8</td>
        </tr>
        <tr>
            <td>10</td>
            <td>BAYN.DE</td>
            <td>Bayer AG</td>
            <td>Healthcare</td>
            <td>0.2724</td>
            <td>0.349</td>
            <td>0.642</td>
            <td>-0.174</td>
            <td>39.475</td>
            <td>0.77</td>
        </tr>
        <tr>
            <td>11</td>
            <td>ENI.MI</td>
            <td>ENI</td>
            <td>Energy</td>
            <td>0.2659</td>
            <td>0.564</td>
            <td>1.978</td>
            <td>-1.744</td>
            <td>21.365</td>
            <td>1.25</td>
        </tr>
        <tr>
            <td>12</td>
            <td>SU.PA</td>
            <td>SCHNEIDER ELECTRIC SE</td>
            <td>Industrials</td>
            <td>0.2605</td>
            <td>-0.224</td>
            <td>0.563</td>
            <td>0.443</td>
            <td>254.85</td>
            <td>2.85</td>
        </tr>
        <tr>
            <td>13</td>
            <td>ENR.DE</td>
            <td>Siemens Energy AG</td>
            <td>Industrials</td>
            <td>0.2557</td>
            <td>-1.323</td>
            <td>2.04</td>
            <td>0.05</td>
            <td>153.55</td>
            <td>2.61</td>
        </tr>
        <tr>
            <td>14</td>
            <td>AD.AS</td>
            <td>KONINKLIJKE AHOLD DELHAIZE N.V.</td>
            <td>Consumer Defensive</td>
            <td>0.2367</td>
            <td>0.696</td>
            <td>1.163</td>
            <td>-1.149</td>
            <td>41.04</td>
            <td>0.72</td>
        </tr>
        <tr>
            <td>15</td>
            <td>SAP.DE</td>
            <td>SAP SE</td>
            <td>Technology</td>
            <td>0.2246</td>
            <td>0.421</td>
            <td>-1.209</td>
            <td>1.461</td>
            <td>166.58</td>
            <td>3.87</td>
        </tr>
    </tbody>
</table>



## Window Functions

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
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-05</td>
            <td>1186.0</td>
            <td>1206.95</td>
            <td>1038.42</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-04</td>
            <td>1199.8</td>
            <td>1206.63</td>
            <td>1035.33</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-03</td>
            <td>1161.8</td>
            <td>1205.13</td>
            <td>1031.94</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-02</td>
            <td>1210.4</td>
            <td>1204.4</td>
            <td>1028.89</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-02-27</td>
            <td>1233.4</td>
            <td>1201.4</td>
            <td>1025.11</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-02-26</td>
            <td>1232.4</td>
            <td>1199.19</td>
            <td>1021.29</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-02-25</td>
            <td>1288.4</td>
            <td>1196.43</td>
            <td>1017.59</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-02-24</td>
            <td>1263.4</td>
            <td>1189.62</td>
            <td>1013.0</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-02-23</td>
            <td>1249.2</td>
            <td>1184.26</td>
            <td>1008.72</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-02-20</td>
            <td>1255.6</td>
            <td>1178.83</td>
            <td>1004.54</td>
        </tr>
    </tbody>
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
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-05</td>
            <td>1186.0</td>
            <td>1199.8</td>
            <td>-1.15</td>
            <td>1</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-04</td>
            <td>1199.8</td>
            <td>1161.8</td>
            <td>3.27</td>
            <td>1</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-03</td>
            <td>1161.8</td>
            <td>1210.4</td>
            <td>-4.02</td>
            <td>1</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-02</td>
            <td>1210.4</td>
            <td>1233.4</td>
            <td>-1.86</td>
            <td>3</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-02-27</td>
            <td>1233.4</td>
            <td>1232.4</td>
            <td>0.08</td>
            <td>1</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-02-26</td>
            <td>1232.4</td>
            <td>1288.4</td>
            <td>-4.35</td>
            <td>1</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-02-25</td>
            <td>1288.4</td>
            <td>1263.4</td>
            <td>1.98</td>
            <td>1</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-02-24</td>
            <td>1263.4</td>
            <td>1249.2</td>
            <td>1.14</td>
            <td>1</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-02-23</td>
            <td>1249.2</td>
            <td>1255.6</td>
            <td>-0.51</td>
            <td>3</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-02-20</td>
            <td>1255.6</td>
            <td>1238.2</td>
            <td>1.41</td>
            <td>1</td>
        </tr>
    </tbody>
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
        <tr>
            <td>DTE.DE</td>
            <td>0.17</td>
            <td>6</td>
            <td>45</td>
            <td>1</td>
        </tr>
        <tr>
            <td>ABI.BR</td>
            <td>0.1537</td>
            <td>7</td>
            <td>44</td>
            <td>1</td>
        </tr>
        <tr>
            <td>DB1.DE</td>
            <td>0.0868</td>
            <td>8</td>
            <td>43</td>
            <td>1</td>
        </tr>
        <tr>
            <td>SU.PA</td>
            <td>0.0742</td>
            <td>9</td>
            <td>42</td>
            <td>1</td>
        </tr>
        <tr>
            <td>DG.PA</td>
            <td>0.0722</td>
            <td>10</td>
            <td>41</td>
            <td>1</td>
        </tr>
    </tbody>
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
        <tr>
            <td>Financial Services</td>
            <td>11</td>
            <td>-0.0095</td>
            <td>0.0533</td>
            <td>0.1602</td>
            <td>1</td>
            <td>50</td>
        </tr>
        <tr>
            <td>Basic Materials</td>
            <td>2</td>
            <td>-0.0106</td>
            <td>0.0741</td>
            <td>0.2632</td>
            <td>24</td>
            <td>36</td>
        </tr>
        <tr>
            <td>Consumer Defensive</td>
            <td>4</td>
            <td>-0.061</td>
            <td>0.0</td>
            <td>0.4017</td>
            <td>5</td>
            <td>49</td>
        </tr>
        <tr>
            <td>Consumer Cyclical</td>
            <td>9</td>
            <td>-0.1013</td>
            <td>0.0</td>
            <td>-0.4793</td>
            <td>2</td>
            <td>46</td>
        </tr>
        <tr>
            <td>Utilities</td>
            <td>2</td>
            <td>-0.1017</td>
            <td>0.2388</td>
            <td>0.6935</td>
            <td>25</td>
            <td>42</td>
        </tr>
    </tbody>
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
    </tbody>
</table>



## Data Quality Checks

### Data Quality Checks

Every pipeline needs quality gates. `UNION ALL` stacks multiple checks into one result. Run this after every load — if any check returns non-zero, investigate before promoting to gold.


```sql
-- Data quality: find gaps, nulls, and anomalies
-- Essential for pipeline monitoring

-- 1. Check for NULL prices (should be zero)
SELECT 'null_prices' AS check_name,
       COUNT(*) AS issues
FROM silver.eurostoxx50_ohlcv
WHERE [close] IS NULL OR [open] IS NULL

UNION ALL

-- 2. Check for negative prices (should be zero)
SELECT 'negative_prices',
       COUNT(*)
FROM silver.eurostoxx50_ohlcv
WHERE [close] < 0 OR [open] < 0

UNION ALL

-- 3. Check for high < low (should be zero)
SELECT 'high_lt_low',
       COUNT(*)
FROM silver.eurostoxx50_ohlcv
WHERE high < low

UNION ALL

-- 4. Count gap-filled rows
SELECT 'gap_filled_rows',
       COUNT(*)
FROM silver.eurostoxx50_ohlcv
WHERE is_filled = 1

UNION ALL

-- 5. Check data freshness (days since last update)
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
    </tbody>
</table>



## Bronze → Silver → Gold Transforms

> [!tip] Related pattern
> The SQL that creates and populates the bronze tables queried here is covered in [[bronze-layer-loading]], which walks through the ingestion pipeline that feeds this medallion architecture.

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
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-05</td>
            <td>1186.0</td>
            <td>-0.0115</td>
            <td>False</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-04</td>
            <td>1199.8</td>
            <td>0.0327</td>
            <td>False</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-03</td>
            <td>1161.8</td>
            <td>-0.0402</td>
            <td>False</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-02</td>
            <td>1210.4</td>
            <td>-0.0186</td>
            <td>False</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-02-27</td>
            <td>1233.4</td>
            <td>0.0008</td>
            <td>False</td>
        </tr>
    </tbody>
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
        <tr>
            <td>IFX.DE</td>
            <td>0.3487</td>
            <td>1.05</td>
            <td>6</td>
        </tr>
        <tr>
            <td>SAN.MC</td>
            <td>0.3106</td>
            <td>0.93</td>
            <td>7</td>
        </tr>
        <tr>
            <td>DG.PA</td>
            <td>0.2928</td>
            <td>0.87</td>
            <td>8</td>
        </tr>
        <tr>
            <td>ISP.MI</td>
            <td>0.2852</td>
            <td>0.85</td>
            <td>9</td>
        </tr>
        <tr>
            <td>BAYN.DE</td>
            <td>0.2724</td>
            <td>0.81</td>
            <td>10</td>
        </tr>
    </tbody>
</table>


