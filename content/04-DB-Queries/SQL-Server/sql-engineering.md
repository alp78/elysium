---
type: reference
category: db-queries
technology: [sql-server, t-sql]
tags: [reference, db-queries, sql-server, t-sql, engineering, performance, indexing, transactions, error-handling]
aliases: [SQL engineering, SQL performance, transactions, error handling, indexing, temp tables, table variables, dynamic SQL, stored procedures]
keywords: [transactions, error handling, try catch, temp tables, table variables, dynamic sql, stored procedures, user defined functions, indexing, query hints, set statistics, execution plan, deadlock, isolation level, snapshot]
description: "SQL Server T-SQL engineering patterns with executable examples — covers transactions, error handling, temp tables, dynamic SQL, stored procedures, and performance tuning."
related:
  - "[[sql-fundamentals]]"
  - "[[sql-advanced]]"
  - "[[wait-stats-analysis]]"
  - "[[index-maintenance]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# SQL for Data Engineering — Database Objects & Performance

Database engineering patterns using the **stoxx** index database.
Prerequisite: SQL_01_Fundamentals.ipynb, SQL_02_Advanced.ipynb

Topics covered:
- Views (regular, indexed)
- Stored Procedures (parameters, error handling, transactions)
- User-Defined Functions (scalar, table-valued)
- Indexes (clustered, non-clustered, columnstore, filtered)
- Constraints (PK, FK, CHECK, UNIQUE, DEFAULT)
- Slowly Changing Dimensions (SCD Type 1 & 2)
- MERGE for Incremental Loads
- Gap Detection & Gap Filling
- Deduplication Strategies
- Execution Plans & Query Optimization
- Transaction Isolation Levels
- Bulk Loading Patterns
- Data Lineage & Audit Columns
- Partitioning Strategies

> **Note**: Some sections CREATE database objects. All objects are created in a `demo` schema
> or use temp tables to avoid modifying the production stoxx schema.

## 0. Setup


```python
%load_ext sql
%config SqlMagic.displaycon = False
%config SqlMagic.displaylimit = 0
```

```python
%sql mssql+pyodbc://sa:EsgDev2026Pass1@localhost:1434/stoxx?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes&MARS_Connection=yes
```

Connecting to &#x27;mssql+pyodbc://sa:***@localhost:1434/stoxx?MARS_Connection=yes&amp;TrustServerCertificate=yes&amp;driver=ODBC+Driver+18+for+SQL+Server&#x27;



```sql
%%sql
-- Create a demo schema for our objects (idempotent)
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'demo')
    EXEC('CREATE SCHEMA demo');
```

<table>
    <thead>
        <tr>
        </tr>
    </thead>
    <tbody>
    </tbody>
</table>



## 1. Views

### 1a. Regular Views — Simplify Complex Queries

A view is a saved query. It doesn't store data — it runs the query every time you SELECT from it.
Use case: wrap the "latest price per stock" pattern so downstream queries are simple.


```sql
%%sql
-- Create a view that always returns the latest price per stock
CREATE OR ALTER VIEW demo.v_latest_prices AS
SELECT symbol, date, [open], high, low, [close], volume
FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) AS rn
    FROM silver.eurostoxx50_ohlcv
) sub
WHERE rn = 1;
```

<table>
    <thead>
        <tr>
        </tr>
    </thead>
    <tbody>
    </tbody>
</table>




```sql
%%sql
-- Now the complex ROW_NUMBER pattern is hidden behind a simple SELECT
SELECT TOP 10 * FROM demo.v_latest_prices ORDER BY [close] DESC
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
            <td>RMS.PA</td>
            <td>2026-03-12</td>
            <td>1900.0</td>
            <td>1918.5</td>
            <td>1894.0</td>
            <td>1906.0</td>
            <td>18681</td>
        </tr>
        <tr>
            <td>RHM.DE</td>
            <td>2026-03-12</td>
            <td>1536.0</td>
            <td>1588.0</td>
            <td>1535.0</td>
            <td>1551.5</td>
            <td>158741</td>
        </tr>
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
            <td>ADYEN.AS</td>
            <td>2026-03-12</td>
            <td>920.7</td>
            <td>933.4</td>
            <td>917.3</td>
            <td>925.7</td>
            <td>27887</td>
        </tr>
        <tr>
            <td>ARGX.BR</td>
            <td>2026-03-12</td>
            <td>629.0</td>
            <td>631.6</td>
            <td>625.6</td>
            <td>626.6</td>
            <td>14083</td>
        </tr>
        <tr>
            <td>MUV2.DE</td>
            <td>2026-03-12</td>
            <td>524.4</td>
            <td>528.8</td>
            <td>523.6</td>
            <td>526.2</td>
            <td>86783</td>
        </tr>
        <tr>
            <td>MC.PA</td>
            <td>2026-03-12</td>
            <td>495.3</td>
            <td>497.4</td>
            <td>491.6</td>
            <td>494.35</td>
            <td>171997</td>
        </tr>
        <tr>
            <td>OR.PA</td>
            <td>2026-03-12</td>
            <td>361.1</td>
            <td>362.3</td>
            <td>357.8</td>
            <td>360.8</td>
            <td>82621</td>
        </tr>
        <tr>
            <td>ALV.DE</td>
            <td>2026-03-12</td>
            <td>349.6</td>
            <td>351.6</td>
            <td>347.9</td>
            <td>348.7</td>
            <td>182426</td>
        </tr>
        <tr>
            <td>SAF.PA</td>
            <td>2026-03-12</td>
            <td>319.3</td>
            <td>320.2</td>
            <td>314.9</td>
            <td>315.4</td>
            <td>160065</td>
        </tr>
    </tbody>
</table>



### 1b. View for Cross-Layer Dashboard

Join multiple tables into a single business-friendly view. Dashboards query this instead of raw tables.


```sql
%%sql
-- Dashboard view: scores + company info + latest price
CREATE OR ALTER VIEW demo.v_stock_dashboard AS
SELECT
    s.composite_rank AS [rank],
    s.symbol,
    d.short_name,
    d.sector,
    d.country,
    s.current_price,
    ROUND(s.composite_score, 4) AS composite_score,
    ROUND(s.relative_value_score, 3) AS value_score,
    ROUND(s.momentum_score, 3) AS momentum_score,
    ROUND(s.index_weight * 100, 2) AS weight_pct,
    s._index,
    s.score_date
FROM gold.scores_daily s
JOIN silver.index_dim d ON s.symbol = d.symbol AND d._index = s._index AND d.is_current = 1;
```

<table>
    <thead>
        <tr>
        </tr>
    </thead>
    <tbody>
    </tbody>
</table>




```sql
%%sql
-- Use the dashboard view
SELECT TOP 10 * FROM demo.v_stock_dashboard
WHERE _index = 'euro_stoxx_50'
  AND score_date = (SELECT MAX(score_date) FROM gold.scores_daily WHERE _index = 'euro_stoxx_50')
ORDER BY [rank]
```

<table>
    <thead>
        <tr>
            <th>rank</th>
            <th>symbol</th>
            <th>short_name</th>
            <th>sector</th>
            <th>country</th>
            <th>current_price</th>
            <th>composite_score</th>
            <th>value_score</th>
            <th>momentum_score</th>
            <th>weight_pct</th>
            <th>_index</th>
            <th>score_date</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>1</td>
            <td>BNP.PA</td>
            <td>BNP PARIBAS ACT.A</td>
            <td>Financial Services</td>
            <td>France</td>
            <td>87.44</td>
            <td>0.6796</td>
            <td>1.497</td>
            <td>0.46</td>
            <td>1.94</td>
            <td>euro_stoxx_50</td>
            <td>2026-03-12</td>
        </tr>
        <tr>
            <td>2</td>
            <td>VOW.DE</td>
            <td>VOLKSWAGEN AG</td>
            <td>Consumer Cyclical</td>
            <td>Germany</td>
            <td>92.85</td>
            <td>0.5756</td>
            <td>1.028</td>
            <td>-0.382</td>
            <td>0.93</td>
            <td>euro_stoxx_50</td>
            <td>2026-03-12</td>
        </tr>
        <tr>
            <td>3</td>
            <td>DTE.DE</td>
            <td>DEUTSCHE TELEKOM AG</td>
            <td>Communication Services</td>
            <td>Germany</td>
            <td>32.55</td>
            <td>0.487</td>
            <td>0.226</td>
            <td>0.706</td>
            <td>3.13</td>
            <td>euro_stoxx_50</td>
            <td>2026-03-12</td>
        </tr>
        <tr>
            <td>4</td>
            <td>TTE.PA</td>
            <td>TOTALENERGIES</td>
            <td>Energy</td>
            <td>France</td>
            <td>69.8</td>
            <td>0.3913</td>
            <td>0.585</td>
            <td>1.307</td>
            <td>2.95</td>
            <td>euro_stoxx_50</td>
            <td>2026-03-12</td>
        </tr>
        <tr>
            <td>5</td>
            <td>ABI.BR</td>
            <td>AB INBEV</td>
            <td>Consumer Defensive</td>
            <td>Belgium</td>
            <td>62.76</td>
            <td>0.3852</td>
            <td>0.251</td>
            <td>0.537</td>
            <td>2.43</td>
            <td>euro_stoxx_50</td>
            <td>2026-03-12</td>
        </tr>
        <tr>
            <td>6</td>
            <td>IFX.DE</td>
            <td>INFINEON TECHNOLOGIES AG</td>
            <td>Technology</td>
            <td>Germany</td>
            <td>40.735</td>
            <td>0.3487</td>
            <td>0.084</td>
            <td>0.302</td>
            <td>1.06</td>
            <td>euro_stoxx_50</td>
            <td>2026-03-12</td>
        </tr>
        <tr>
            <td>7</td>
            <td>SAN.MC</td>
            <td>BANCO SANTANDER S.A.</td>
            <td>Financial Services</td>
            <td>Spain</td>
            <td>9.617</td>
            <td>0.3106</td>
            <td>-0.037</td>
            <td>0.45</td>
            <td>2.78</td>
            <td>euro_stoxx_50</td>
            <td>2026-03-12</td>
        </tr>
        <tr>
            <td>8</td>
            <td>DG.PA</td>
            <td>VINCI</td>
            <td>Industrials</td>
            <td>France</td>
            <td>129.9</td>
            <td>0.2928</td>
            <td>0.957</td>
            <td>0.489</td>
            <td>1.43</td>
            <td>euro_stoxx_50</td>
            <td>2026-03-12</td>
        </tr>
        <tr>
            <td>9</td>
            <td>ISP.MI</td>
            <td>INTESA SANPAOLO</td>
            <td>Financial Services</td>
            <td>Italy</td>
            <td>5.204</td>
            <td>0.2852</td>
            <td>0.553</td>
            <td>-0.208</td>
            <td>1.8</td>
            <td>euro_stoxx_50</td>
            <td>2026-03-12</td>
        </tr>
        <tr>
            <td>10</td>
            <td>BAYN.DE</td>
            <td>Bayer AG</td>
            <td>Healthcare</td>
            <td>Germany</td>
            <td>39.475</td>
            <td>0.2724</td>
            <td>0.349</td>
            <td>0.642</td>
            <td>0.77</td>
            <td>euro_stoxx_50</td>
            <td>2026-03-12</td>
        </tr>
    </tbody>
</table>



## 2. Stored Procedures

### 2a. Basic SP with Parameters

A stored procedure is precompiled SQL that lives in the database.
Use case: pipeline steps as SPs — each step has consistent parameters and error handling.


```sql
%%sql
-- SP: get top N stocks by composite score for a given index
CREATE OR ALTER PROCEDURE demo.sp_top_stocks
    @index_key NVARCHAR(50),
    @top_n INT = 10
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT TOP (@top_n)
        [rank], symbol, short_name,
        composite_score AS score,
        current_price
    FROM demo.v_stock_dashboard
    WHERE _index = @index_key
      AND score_date = (
          SELECT MAX(score_date) FROM gold.scores_daily WHERE _index = @index_key
      )
    ORDER BY [rank];
END;
```

<table>
    <thead>
        <tr>
        </tr>
    </thead>
    <tbody>
    </tbody>
</table>




```sql
%%sql
EXEC demo.sp_top_stocks @index_key = 'euro_stoxx_50', @top_n = 5
```

<table>
    <thead>
        <tr>
            <th>rank</th>
            <th>symbol</th>
            <th>short_name</th>
            <th>score</th>
            <th>current_price</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>1</td>
            <td>BNP.PA</td>
            <td>BNP PARIBAS ACT.A</td>
            <td>0.6796</td>
            <td>87.44</td>
        </tr>
        <tr>
            <td>2</td>
            <td>VOW.DE</td>
            <td>VOLKSWAGEN AG</td>
            <td>0.5756</td>
            <td>92.85</td>
        </tr>
        <tr>
            <td>3</td>
            <td>DTE.DE</td>
            <td>DEUTSCHE TELEKOM AG</td>
            <td>0.487</td>
            <td>32.55</td>
        </tr>
        <tr>
            <td>4</td>
            <td>TTE.PA</td>
            <td>TOTALENERGIES</td>
            <td>0.3913</td>
            <td>69.8</td>
        </tr>
        <tr>
            <td>5</td>
            <td>ABI.BR</td>
            <td>AB INBEV</td>
            <td>0.3852</td>
            <td>62.76</td>
        </tr>
    </tbody>
</table>



### 2b. SP with Error Handling (TRY/CATCH)

Production SPs wrap logic in <small>`TRY/CATCH`</small> with explicit transactions.
If anything fails, the entire operation rolls back — no partial loads.


```sql
%%sql
-- SP with transaction + error handling
CREATE OR ALTER PROCEDURE demo.sp_load_scores
    @index_key NVARCHAR(50),
    @rows_loaded INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET @rows_loaded = 0;
    
    BEGIN TRY
        BEGIN TRANSACTION;
        
        -- Simulate a load: count rows that would be processed
        SELECT @rows_loaded = COUNT(*)
        FROM gold.scores_daily
        WHERE _index = @index_key;
        
        COMMIT TRANSACTION;
        PRINT 'Load completed: ' + CAST(@rows_loaded AS VARCHAR) + ' rows';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        
        DECLARE @msg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @sev INT = ERROR_SEVERITY();
        RAISERROR(@msg, @sev, 1);
    END CATCH
END;
```

<table>
    <thead>
        <tr>
        </tr>
    </thead>
    <tbody>
    </tbody>
</table>



## 3. User-Defined Functions

### 3a. Inline Table-Valued Function (Best Performance)

An **iTVF** is like a parameterized view — the optimizer inlines it into the outer query.
Always prefer iTVFs over scalar UDFs or multi-statement TVFs.


```sql
%%sql
-- iTVF: get price history for a symbol within a date range
CREATE OR ALTER FUNCTION demo.fn_price_history(
    @symbol VARCHAR(20),
    @from_date DATE,
    @to_date DATE
)
RETURNS TABLE
AS RETURN (
    SELECT symbol, date, [open], high, low, [close], volume
    FROM silver.eurostoxx50_ohlcv
    WHERE symbol = @symbol AND date BETWEEN @from_date AND @to_date
);
```

<table>
    <thead>
        <tr>
        </tr>
    </thead>
    <tbody>
    </tbody>
</table>




```sql
%%sql
-- Use the function like a table
SELECT TOP 10 * FROM demo.fn_price_history('ASML.AS', '2026-03-01', '2026-03-31')
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
    </tbody>
</table>



## 4. Indexes

### Index Types & When to Use

| Type | What | When |
|------|------|------|
| **Clustered** | Physical row order. One per table. | PK (symbol, date) for time-series |
| **Non-clustered** | Separate B-tree pointing to rows. | Filter/sort columns (sector, _index) |
| **Covering** | Includes extra columns in leaf. | Avoids key lookups for SELECT columns |
| **Filtered** | Index only subset of rows. | <small>`WHERE is_current = 1`</small> on dims |
| **Columnstore** | Columnar storage, batch processing. | Analytical aggregations on OHLCV |


```sql
%%sql
-- Inspect existing indexes on silver.eurostoxx50_ohlcv
SELECT
    i.name AS index_name,
    i.type_desc,
    i.is_unique,
    STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS columns
FROM sys.indexes i
JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE i.object_id = OBJECT_ID('silver.eurostoxx50_ohlcv')
GROUP BY i.name, i.type_desc, i.is_unique
ORDER BY i.type_desc
```

<table>
    <thead>
        <tr>
            <th>index_name</th>
            <th>type_desc</th>
            <th>is_unique</th>
            <th>columns</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>PK__eurostox__3213E83FDF67D274</td>
            <td>CLUSTERED</td>
            <td>True</td>
            <td>id</td>
        </tr>
        <tr>
            <td>IX_silver_eurostoxx50_ohlcv_symbol_date</td>
            <td>NONCLUSTERED</td>
            <td>True</td>
            <td>symbol, date</td>
        </tr>
    </tbody>
</table>



### Index Design Principles

1. **Equality columns first** in composite keys: <small>`WHERE _index = 'X' AND date >= '2026-01-01'`</small> → index on <small>`(_index, date)`</small>
2. **Include columns** to avoid lookups: <small>`INCLUDE (close, volume)`</small> if you SELECT those
3. **Don't over-index**: each index slows writes. Monitor with <small>`sys.dm_db_index_usage_stats`</small>
4. **Filtered indexes** for hot subsets: <small>`WHERE is_current = 1`</small> on dimension tables

## 5. Slowly Changing Dimensions (SCD)

### 5a. SCD Type 1 — Overwrite

Simply UPDATE the row. History is lost. Use when you don't care about old values.
Example: fix a typo in a company name.


```sql
%%sql
-- SCD Type 1: just overwrite (demo with temp table)
SELECT TOP 5 symbol, short_name, sector, is_current
INTO #scd_demo
FROM silver.index_dim
WHERE _index = 'euro_stoxx_50' AND is_current = 1;

-- Type 1: overwrite the sector
UPDATE #scd_demo SET sector = 'Information Technology' WHERE symbol = 'ASML.AS';
SELECT * FROM #scd_demo
```

5 rows affected.



1 rows affected.

<table>
    <thead>
        <tr>
            <th>symbol</th>
            <th>short_name</th>
            <th>sector</th>
            <th>is_current</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>ASML.AS</td>
            <td>ASML HOLDING</td>
            <td>Information Technology</td>
            <td>True</td>
        </tr>
        <tr>
            <td>MC.PA</td>
            <td>LVMH</td>
            <td>Consumer Cyclical</td>
            <td>True</td>
        </tr>
        <tr>
            <td>RMS.PA</td>
            <td>HERMES INTL</td>
            <td>Consumer Cyclical</td>
            <td>True</td>
        </tr>
        <tr>
            <td>OR.PA</td>
            <td>L'OREAL</td>
            <td>Consumer Defensive</td>
            <td>True</td>
        </tr>
        <tr>
            <td>SAP.DE</td>
            <td>SAP SE</td>
            <td>Technology</td>
            <td>True</td>
        </tr>
    </tbody>
</table>



### 5b. SCD Type 2 — History Tracking

Expire the old row (<small>`is_current=0, valid_to=NOW`</small>) and insert a new row (<small>`is_current=1`</small>).
This is how <small>`silver.index_dim`</small> works — it has <small>`valid_from`</small>, <small>`valid_to`</small>, <small>`is_current`</small> columns.


```sql
%%sql
-- SCD Type 2: the silver.index_dim already implements this
-- Show the SCD columns
SELECT TOP 10
    symbol, short_name, sector,
    is_current,
    CAST(valid_from AS DATE) AS valid_from,
    CAST(valid_to AS DATE) AS valid_to
FROM silver.index_dim
WHERE _index = 'euro_stoxx_50'
ORDER BY symbol, valid_from
```

<table>
    <thead>
        <tr>
            <th>symbol</th>
            <th>short_name</th>
            <th>sector</th>
            <th>is_current</th>
            <th>valid_from</th>
            <th>valid_to</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>ABI.BR</td>
            <td>AB INBEV</td>
            <td>Consumer Defensive</td>
            <td>True</td>
            <td>2026-03-04</td>
            <td>None</td>
        </tr>
        <tr>
            <td>AD.AS</td>
            <td>KONINKLIJKE AHOLD DELHAIZE N.V.</td>
            <td>Consumer Defensive</td>
            <td>True</td>
            <td>2026-03-04</td>
            <td>None</td>
        </tr>
        <tr>
            <td>ADS.DE</td>
            <td>adidas AG</td>
            <td>Consumer Cyclical</td>
            <td>True</td>
            <td>2026-03-04</td>
            <td>None</td>
        </tr>
        <tr>
            <td>ADYEN.AS</td>
            <td>ADYEN</td>
            <td>Technology</td>
            <td>True</td>
            <td>2026-03-04</td>
            <td>None</td>
        </tr>
        <tr>
            <td>AI.PA</td>
            <td>AIR LIQUIDE</td>
            <td>Basic Materials</td>
            <td>True</td>
            <td>2026-03-04</td>
            <td>None</td>
        </tr>
        <tr>
            <td>AIR.PA</td>
            <td>AIRBUS SE</td>
            <td>Industrials</td>
            <td>True</td>
            <td>2026-03-04</td>
            <td>None</td>
        </tr>
        <tr>
            <td>ALV.DE</td>
            <td>Allianz SE</td>
            <td>Financial Services</td>
            <td>True</td>
            <td>2026-03-04</td>
            <td>None</td>
        </tr>
        <tr>
            <td>ARGX.BR</td>
            <td>ARGENX SE</td>
            <td>Healthcare</td>
            <td>True</td>
            <td>2026-03-04</td>
            <td>None</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>ASML HOLDING</td>
            <td>Technology</td>
            <td>True</td>
            <td>2026-03-04</td>
            <td>None</td>
        </tr>
        <tr>
            <td>BAS.DE</td>
            <td>BASF SE</td>
            <td>Basic Materials</td>
            <td>True</td>
            <td>2026-03-04</td>
            <td>None</td>
        </tr>
    </tbody>
</table>



## 6. Gap Detection & Gap Filling

### 6a. Islands and Gaps

The classic SQL pattern: identify contiguous groups (islands) and missing periods (gaps)
in a time series. Uses the difference between ROW_NUMBER and the date to group consecutive days.


```sql
%%sql
-- Detect gaps in ASML trading data (days with no price)
-- LAG compares each date to the previous; gap > 3 calendar days = unusual
SELECT TOP 10
    symbol, date,
    LAG(date) OVER (PARTITION BY symbol ORDER BY date) AS prev_date,
    DATEDIFF(DAY, LAG(date) OVER (PARTITION BY symbol ORDER BY date), date) AS gap_days,
    CASE WHEN DATEDIFF(DAY, LAG(date) OVER (PARTITION BY symbol ORDER BY date), date) > 3
         THEN 'UNUSUAL GAP' ELSE 'normal' END AS status
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'ASML.AS' AND date >= '2025-01-01'
ORDER BY date DESC
```

<table>
    <thead>
        <tr>
            <th>symbol</th>
            <th>date</th>
            <th>prev_date</th>
            <th>gap_days</th>
            <th>status</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-12</td>
            <td>2026-03-11</td>
            <td>1</td>
            <td>normal</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-11</td>
            <td>2026-03-10</td>
            <td>1</td>
            <td>normal</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-10</td>
            <td>2026-03-09</td>
            <td>1</td>
            <td>normal</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-09</td>
            <td>2026-03-06</td>
            <td>3</td>
            <td>normal</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-06</td>
            <td>2026-03-05</td>
            <td>1</td>
            <td>normal</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-05</td>
            <td>2026-03-04</td>
            <td>1</td>
            <td>normal</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-04</td>
            <td>2026-03-03</td>
            <td>1</td>
            <td>normal</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-03</td>
            <td>2026-03-02</td>
            <td>1</td>
            <td>normal</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-02</td>
            <td>2026-02-27</td>
            <td>3</td>
            <td>normal</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-02-27</td>
            <td>2026-02-26</td>
            <td>1</td>
            <td>normal</td>
        </tr>
    </tbody>
</table>



## 7. Deduplication Strategies

### ROW_NUMBER Deduplication Pattern

The standard approach: assign <small>`ROW_NUMBER()`</small> within each duplicate group,
keep <small>`rn = 1`</small>, delete the rest.


```sql
%%sql
-- Deduplication with ROW_NUMBER: detect and resolve duplicates
-- Simulated: UNION ALL the same rows to create duplicates in a CTE
WITH raw_data AS (
    -- Original rows
    SELECT symbol, date, [close], volume, 'original' AS source
    FROM silver.eurostoxx50_ohlcv
    WHERE symbol = 'ASML.AS' AND date >= '2026-03-10'
    UNION ALL
    -- Simulate duplicate: same key, slightly different values
    SELECT symbol, date, [close] + 0.5, volume + 999, 'duplicate'
    FROM silver.eurostoxx50_ohlcv
    WHERE symbol = 'ASML.AS' AND date = (SELECT MAX(date) FROM silver.eurostoxx50_ohlcv WHERE symbol = 'ASML.AS')
),
numbered AS (
    -- ROW_NUMBER: assign rn=1 to the row we want to keep (highest volume)
    SELECT *,
           ROW_NUMBER() OVER (PARTITION BY symbol, date ORDER BY volume DESC) AS rn,
           COUNT(*) OVER (PARTITION BY symbol, date) AS copies
    FROM raw_data
)
SELECT TOP 10 symbol, date, ROUND([close], 2) AS [close], volume, source, rn, copies
FROM numbered
WHERE copies > 1  -- only show the duplicated date
ORDER BY date DESC, rn
```

<table>
    <thead>
        <tr>
            <th>symbol</th>
            <th>date</th>
            <th>close</th>
            <th>volume</th>
            <th>source</th>
            <th>rn</th>
            <th>copies</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-12</td>
            <td>1191.3</td>
            <td>129222</td>
            <td>duplicate</td>
            <td>1</td>
            <td>2</td>
        </tr>
        <tr>
            <td>ASML.AS</td>
            <td>2026-03-12</td>
            <td>1190.8</td>
            <td>128223</td>
            <td>original</td>
            <td>2</td>
            <td>2</td>
        </tr>
    </tbody>
</table>



## 8. Execution Plans & Query Optimization

### Common Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| <small>`WHERE YEAR(date) = 2025`</small> | Function on column prevents index seek | <small>`WHERE date >= '2025-01-01' AND date < '2026-01-01'`</small> |
| <small>`SELECT *`</small> | Reads all columns, can't use covering index | Select only needed columns |
| <small>`WHERE col = NULL`</small> | Always FALSE (NULL != NULL) | <small>`WHERE col IS NULL`</small> |
| Implicit conversion | VARCHAR compared to NVARCHAR causes scan | Match data types in predicates |
| Missing index | Table scan on large table | Add non-clustered index on filter columns |


```sql
%%sql
-- Compare: both return the same count, but the sargable version is faster
-- BAD:  WHERE YEAR(date) = 2025  → function on column prevents index seek
-- GOOD: WHERE date >= ... AND date < ...  → index can seek directly
SELECT
    (SELECT COUNT(*) FROM silver.eurostoxx50_ohlcv
     WHERE YEAR(date) = 2025) AS bad_function_on_column,
    (SELECT COUNT(*) FROM silver.eurostoxx50_ohlcv
     WHERE date >= '2025-01-01' AND date < '2026-01-01') AS good_sargable
```

<table>
    <thead>
        <tr>
            <th>bad_function_on_column</th>
            <th>good_sargable</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>12698</td>
            <td>12698</td>
        </tr>
    </tbody>
</table>



## 9. Transaction Isolation Levels

### Isolation Level Guide for Data Engineering

| Level | Dirty Reads | Non-Repeatable | Phantoms | Use Case |
|-------|------------|----------------|----------|----------|
| READ UNCOMMITTED | Yes | Yes | Yes | Stale-tolerant dashboards, quick counts |
| READ COMMITTED (default) | No | Yes | Yes | Most pipeline reads |
| REPEATABLE READ | No | No | Yes | Financial calculations |
| SERIALIZABLE | No | No | No | Critical writes (score computation) |
| SNAPSHOT | No | No | No | Analytics reads (no blocking, uses tempdb) |

**Recommendation for pipelines**: READ COMMITTED for writes, SNAPSHOT for reads.

## 10. Bulk Loading Patterns

### Bulk Loading Strategies

| Strategy | Speed | When |
|----------|-------|------|
| <small>`INSERT INTO ... SELECT`</small> | Medium | Small-medium loads from staging |
| <small>`INSERT ... WITH (TABLOCK)`</small> | Fast | Minimal logging in SIMPLE/BULK_LOGGED |
| <small>`BULK INSERT`</small> | Fastest | Loading from CSV files on disk |
| Batched inserts (TOP N loop) | Controlled | Large loads with checkpoints |
| Drop indexes → load → rebuild | Fastest | Full table reloads |

**Pipeline pattern**: load to staging table → validate → MERGE to target → truncate staging.

## 11. Data Lineage & Audit Columns

### Standard Audit Columns

Every table in the stoxx database has audit columns:

| Column | Type | Purpose |
|--------|------|--------|
| <small>`_ingested_at`</small> | DATETIME2 | When the row was loaded (bronze) |
| <small>`_scored_at`</small> | DATETIME2 | When the score was computed (gold) |
| <small>`_computed_at`</small> | DATETIME2 | When the performance was calculated |
| <small>`is_filled`</small> | BIT | Whether the row was gap-filled (silver) |
| <small>`is_current`</small> | BIT | SCD Type 2 current flag (dimension) |


```sql
%%sql
-- Data freshness check: when was each table last updated?
SELECT 'bronze.eurostoxx50_ohlcv' AS [table], MAX(_ingested_at) AS last_update
FROM bronze.eurostoxx50_ohlcv
UNION ALL
SELECT 'silver.signals_daily', MAX(signal_date) FROM silver.signals_daily
WHERE _index = 'euro_stoxx_50'
UNION ALL
SELECT 'gold.scores_daily', MAX(score_date) FROM gold.scores_daily
WHERE _index = 'euro_stoxx_50'
UNION ALL
SELECT 'gold.index_performance', MAX(perf_date) FROM gold.index_performance
WHERE _index = 'euro_stoxx_50'
ORDER BY last_update DESC
```

<table>
    <thead>
        <tr>
            <th>table</th>
            <th>last_update</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>bronze.eurostoxx50_ohlcv</td>
            <td>2026-03-12 12:45:00.021478</td>
        </tr>
        <tr>
            <td>gold.index_performance</td>
            <td>2026-03-12 00:00:00</td>
        </tr>
        <tr>
            <td>gold.scores_daily</td>
            <td>2026-03-12 00:00:00</td>
        </tr>
        <tr>
            <td>silver.signals_daily</td>
            <td>2026-03-12 00:00:00</td>
        </tr>
    </tbody>
</table>



## 12. Partitioning Strategies

### When to Partition

Partition large tables (millions of rows) by a date column for:
- **Faster queries**: partition elimination skips irrelevant months/years
- **Easier maintenance**: rebuild one partition, not the whole table
- **Instant archival**: SWITCH old partitions to archive table

The OHLCV tables (~65K rows each) are too small to benefit. In production with 100M+ rows, partition by year or month.

<small>

```sql
-- Example: partition by year (conceptual — don't run)
CREATE PARTITION FUNCTION pf_yearly(DATE)
    AS RANGE RIGHT FOR VALUES ('2022-01-01', '2023-01-01', '2024-01-01', '2025-01-01', '2026-01-01');

CREATE PARTITION SCHEME ps_yearly
    AS PARTITION pf_yearly ALL TO ([PRIMARY]);

CREATE TABLE silver.ohlcv_partitioned (
    symbol VARCHAR(20), date DATE, [close] FLOAT, ...
) ON ps_yearly(date);
```

</small>

## 13. Cleanup


```sql
%%sql
-- Drop demo objects created in this notebook
DROP VIEW IF EXISTS demo.v_latest_prices;
DROP VIEW IF EXISTS demo.v_stock_dashboard;
DROP PROCEDURE IF EXISTS demo.sp_top_stocks;
DROP PROCEDURE IF EXISTS demo.sp_load_scores;
DROP FUNCTION IF EXISTS demo.fn_price_history;
DROP SCHEMA IF EXISTS demo;
SELECT 'Demo objects cleaned up' AS status
```

<table>
    <thead>
        <tr>
            <th>status</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>Demo objects cleaned up</td>
        </tr>
    </tbody>
</table>


