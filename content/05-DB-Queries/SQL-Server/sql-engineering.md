---
title: "SQL Engineering"
tags: [sql-server, tsql, engineering]
aliases: [SQL engineering, SQL performance, transactions, error handling, indexing, temp tables, table variables, dynamic SQL, stored procedures]
description: "SQL Server T-SQL engineering patterns with executable examples — covers transactions, error handling, temp tables, dynamic SQL, stored procedures, and performance tuning."
parent: "[[domain-sql-server]]"
links:
  - "[[sql-fundamentals]]"
  - "[[sql-advanced]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# SQL for Data Engineering — Database Objects & Performance

> [!quote]
> "A database is only as good as the integrity constraints that protect it."
>
> — **C.J. Date**, *An Introduction to Database Systems* (2003)

> [!warning] Some Sections CREATE Database Objects
>
> All objects are created in a `demo` schema or use temp tables to avoid modifying the production stoxx schema.

> [!success] Safe Pattern
>
> All persistent objects in this notebook use a dedicated `demo` schema (`CREATE OR ALTER ... demo.object_name`) and are dropped in the Cleanup section at the end. Always use a non-production schema for experimental objects, and include a cleanup block to ensure idempotent re-runs.

```python
%load_ext sql
%config SqlMagic.displaycon = False
%config SqlMagic.displaylimit = 0
```

```python
%sql mssql+pyodbc://sa:EsgDev2026Pass1@localhost:1434/stoxx?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes&MARS_Connection=yes
```

```text
Connecting to 'mssql+pyodbc://sa:***@localhost:1434/stoxx?MARS_Connection=yes&TrustServerCertificate=yes&driver=ODBC+Driver+18+for+SQL+Server'
```

> [!danger] Lab-Only Credentials
>
> The connection string above contains a plaintext password for a local lab environment. In production, credentials are stored in GCP Secret Manager and fetched at runtime — never hardcoded. See [secrets-management > Access from Python](https://alp78.github.io/elysium/06-GCP/Security/secrets-management#access-from-python).

> [!success] Safe Pattern
>
> In production, retrieve the connection string from GCP Secret Manager at runtime: `secretmanager.SecretManagerServiceClient().access_secret_version(name=...)`. Never hardcode passwords in notebooks, scripts, or source control. Use environment variables or secret injection via Cloud Run / GKE secrets.

The demo schema isolates all objects created in this file from the production `stoxx` schemas. The `IF NOT EXISTS` guard makes this idempotent — safe to re-run.

```sql
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



## Views

SQL Server views encapsulate reusable queries as named database objects. They simplify complex query logic for consumers while centralizing maintenance — when the underlying table structure changes, only the view definition needs updating. SQL Server expands a view inline at query time: the optimizer merges the view definition with the outer query into a single execution plan, so a well-written view carries no extra cost over writing the query directly. Indexed views (created with `SCHEMABINDING`) pre-compute and persist the result set, trading storage for instant read access on expensive aggregations.

> [!info] Cross-Engine: Views
>
> **SQL Server** expands views inline — no performance penalty vs. writing the query directly. Indexed views persist pre-computed results for expensive aggregations. **BigQuery** supports logical views (inline) and materialized views (with a configurable refresh schedule). **Firestore** has no view concept — queries always run against raw document collections; reuse is achieved through query abstraction in application code.

### Regular Views — Simplify Complex Queries

A view is a saved query. It doesn't store data — it runs the query every time you SELECT from it.
Use case: wrap the "latest price per stock" pattern so downstream queries are simple.


```sql
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




Once the view is created, the `ROW_NUMBER` deduplication logic is hidden — consumers write a simple `SELECT` against the view.

```sql
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



### Views — Cross-Layer Dashboard View

Join multiple tables into a single business-friendly view. Dashboards query this instead of raw tables.


```sql
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



## Stored Procedures

Stored procedures encapsulate reusable T-SQL logic as named database objects with optional input/output parameters. SQL Server compiles and caches the execution plan on first execution — subsequent calls reuse the cached plan, eliminating parse and optimization overhead. This plan caching comes with a trade-off: **parameter sniffing** means the optimizer builds the plan around the first set of parameter values it sees. A plan optimized for a small result set (`@top_n = 5`) can perform catastrophically when the same SP is called with a large result set (`@top_n = 10000`), because the plan was compiled with row estimates tuned to the original parameters. See the parameter sniffing callout in the section below.

> [!info] Cross-Engine: Stored Procedures
>
> **SQL Server** stored procedures are compiled, parameterized objects with plan caching, output parameters, and full ACID transaction support. **BigQuery** supports scripting procedures (`CREATE PROCEDURE`) introduced in 2021, but there is no plan caching — every call incurs full query compilation. **Firestore** delegates server-side logic to Cloud Functions, which run outside the database engine entirely.

> [!tip] Related pattern
>
> The [dbt-sqlserver-adapter](https://alp78.github.io/elysium/11-dbt/Adapters/dbt-sqlserver-adapter) generates parameterized queries and materialization logic similar to these stored procedures, providing a version-controlled alternative to hand-written SPs.

### Stored Procedures — Basic SP with Parameters

A stored procedure is precompiled SQL that lives in the database.
Use case: pipeline steps as SPs — each step has consistent parameters and error handling.

> [!danger] Dynamic SQL is an injection vector
>
> `EXEC('SELECT * FROM ' + @tableName)` is vulnerable to SQL injection if `@tableName` comes from user input. Always use `sp_executesql` with parameterized queries for values. For dynamic object names, validate against `sys.tables` / `sys.columns` before building the string.

> [!success] Safe Pattern
>
> Use `sp_executesql` with typed parameters for all variable values: `EXEC sp_executesql N'SELECT ... WHERE symbol = @sym', N'@sym VARCHAR(20)', @sym = @input`. For dynamic object names (table/column names), always validate the input against `sys.tables` or `sys.columns` before concatenating it into SQL — never trust caller input directly.

```sql
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



### Stored Procedures — Error Handling with TRY/CATCH

Production SPs wrap logic in `TRY/CATCH` with explicit transactions. If anything fails, the entire operation rolls back — no partial loads. The `@@TRANCOUNT > 0` guard before `ROLLBACK` is essential: if the error occurred outside an open transaction (e.g., in a trigger), calling `ROLLBACK` unconditionally would raise an additional error.

> [!warning] Parameter Sniffing
>
> SQL Server sniffs parameter values on first SP execution and optimizes the plan for those specific values. A plan compiled for `@top_n = 5` may perform catastrophically when called with `@top_n = 10000` — the optimizer chose a nested loops join expecting 5 rows, but now processes 10,000. Plan cache invalidation (after an index rebuild or `sp_recompile`) resets the sniffed values.

> [!success] Mitigations
>
> Three options in order of preference: (1) `OPTION (RECOMPILE)` on the statement — recompiles every call using the actual parameter values, best for plans that vary dramatically by input; (2) `OPTION (OPTIMIZE FOR (@param UNKNOWN))` — uses average statistics rather than the sniffed value; (3) reassign to a local variable inside the SP (`DECLARE @local = @param`) — prevents sniffing but may produce suboptimal plans for all inputs.

```sql
CREATE OR ALTER PROCEDURE demo.sp_load_scores
    @index_key NVARCHAR(50),
    @rows_loaded INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET @rows_loaded = 0;
    
    BEGIN TRY
        BEGIN TRANSACTION;
        
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



## User-Defined Functions

SQL Server supports three types of user-defined functions: scalar functions (return a single value), inline table-valued functions (iTVFs, return a table via a single `SELECT`), and multi-statement table-valued functions (MSTVFs, build a result set row by row). **iTVFs are the only type the optimizer can inline and parallelize** — always prefer them. Scalar UDFs and MSTVFs force row-by-row execution and disable parallelism. SQL Server 2019 introduced scalar UDF inlining, but many patterns remain ineligible (functions with `TRY/CATCH`, `RAND`, `NEWID`, recursion, or side effects); verify with `sys.sql_modules.is_inlineable = 1`.

> [!danger] Scalar UDFs Kill Performance
>
> Scalar UDFs Force Row-by-Row Execution.
> T-SQL scalar UDFs (non-inlineable) disable parallelism and force SQL Server to call the function once per row. A simple scalar UDF on a 10M-row table can turn a 2-second query into a 2-minute query. Always use inline table-valued functions (iTVFs) instead -- the optimizer can fold them into the outer query plan. SQL Server 2019+ has "scalar UDF inlining," but many patterns are still not eligible.

> [!success] Safe Pattern
>
> Replace scalar UDFs with inline table-valued functions (`RETURNS TABLE AS RETURN (SELECT ...)`). The optimizer can fold an iTVF into the outer query plan and parallelize it. If you must retain a scalar UDF, verify it qualifies for SQL Server 2019+ scalar UDF inlining by checking `sys.sql_modules.is_inlineable = 1` and test with `SET STATISTICS IO, TIME ON` to confirm the plan is not row-by-row.

### User-Defined Functions — Inline Table-Valued Function

An **iTVF** is like a parameterized view — the optimizer inlines it into the outer query.
Always prefer iTVFs over scalar UDFs or multi-statement TVFs.


```sql
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




The iTVF is called in the `FROM` clause exactly like a table — the optimizer inlines it into the outer query plan.

```sql
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



## Indexes

Index selection is the single highest-leverage performance decision in SQL Server. The right index can turn a multi-second table scan into a sub-millisecond seek; the wrong index imposes unnecessary write overhead on every `INSERT`, `UPDATE`, and `DELETE`. Index design for data pipelines requires balancing read-query patterns (equality filters, range scans, analytical aggregations) against write throughput. See [index-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/index-types-and-strategy) for columnstore internals, fragmentation maintenance, and missing index DMV analysis.

> [!tip] Covering Indexes for Pipeline Queries
>
> A covering index includes all columns needed by a query in the index leaf pages, eliminating key lookups back to the clustered index. For the `fn_price_history` pattern — `WHERE symbol = @symbol AND date BETWEEN @from AND @to`, selecting `symbol, date, open, high, low, close, volume` — a covering index `(symbol, date) INCLUDE (open, high, low, close, volume)` satisfies the entire query from the index alone. Use `sys.dm_db_missing_index_details` to identify queries that would benefit from a covering index.

### Indexes — Types and When to Use Each

The table below summarizes SQL Server index types and their primary use cases for time-series financial data. Index selection depends on the dominant query pattern for each table.

| Type | What | When |
|------|------|------|
| **Clustered** | Physical row order. One per table. | PK (symbol, date) for time-series |
| **Non-clustered** | Separate B-tree pointing to rows. | Filter/sort columns (sector, _index) |
| **Covering** | Includes extra columns in leaf. | Avoids key lookups for SELECT columns |
| **Filtered** | Index only subset of rows. | `WHERE is_current = 1` on dims |
| **Columnstore** | Columnar storage, batch processing. | Analytical aggregations on OHLCV |

The query below inspects existing indexes on the `silver.eurostoxx50_ohlcv` table using catalog views. `STRING_AGG` aggregates the key column names in ordinal order to show the composite key layout.

```sql
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



### Indexes — Design Principles for Data Pipelines

Query-pattern-first design: identify the three or four most common predicates and projections for each table before creating any index.

1. **Equality columns first** in composite keys: `WHERE _index = 'X' AND date >= '2026-01-01'` → index on `(_index, date)`
2. **Include columns** to avoid lookups: `INCLUDE (close, volume)` if you SELECT those
3. **Don't over-index**: each index slows writes. Monitor with `sys.dm_db_index_usage_stats`
4. **Filtered indexes** for hot subsets: `WHERE is_current = 1` on dimension tables

> [!info] Redundancy Note
>
> This section covers index usage patterns for query tuning. For full index internals — B-tree structure, columnstore encodings, fragmentation mechanics, and automated maintenance scripts — see [index-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/index-types-and-strategy) in Chapter 04.

## Slowly Changing Dimensions (SCD)

The MERGE patterns used for SCD Type 2 below are a key building block for [idempotent-pipeline-design](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design), where every load can be safely re-run without duplicating or corrupting data.

### Slowly Changing Dimensions — SCD Type 1 Overwrite

Simply UPDATE the row. History is lost. Use when you don't care about old values.
Example: fix a typo in a company name.


```sql
SELECT TOP 5 symbol, short_name, sector, is_current
INTO #scd_demo
FROM silver.index_dim
WHERE _index = 'euro_stoxx_50' AND is_current = 1;

UPDATE #scd_demo SET sector = 'Information Technology' WHERE symbol = 'ASML.AS';
SELECT * FROM #scd_demo
```

```text
5 rows affected.
```

```text
1 rows affected.
```

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



### Slowly Changing Dimensions — SCD Type 2 History Tracking

Expire the old row (`is_current=0, valid_to=NOW`) and insert a new row (`is_current=1`).
This is how `silver.index_dim` works — it has `valid_from`, `valid_to`, `is_current` columns.


```sql
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



## Gap Detection & Gap Filling

Time-series data in financial pipelines frequently contains gaps: missing trading days due to market holidays, exchange closures, or ingestion failures. Detecting and classifying these gaps is a prerequisite for accurate signal computation — undetected gaps produce incorrect rolling averages, momentum scores, and drawdown calculations. SQL Server provides two primary techniques: the **LAG/DATEDIFF approach** (detect a gap by comparing each row's date to the previous row's date within the same symbol partition) and the classical **islands-and-gaps pattern** (use `ROW_NUMBER` minus the date value to assign the same group number to consecutive days, then find the spaces between groups).

### Gap Detection & Gap Filling — Detect Gaps with LAG

Uses `LAG()` to compare each trading date to the previous date for the same symbol. A gap larger than 3 calendar days (accounting for weekends) signals a missing trading session or ingestion failure.


```sql
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



## Deduplication Strategies

Duplicate rows in source data are one of the most common data quality issues in financial pipelines: broker feeds retry failed deliveries, ETL jobs re-run after failures, and `UNION` operations occasionally double-count rows. SQL Server's `ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...)` window function is the standard deduplication tool — assign rank 1 to the row to keep within each duplicate group, then delete or exclude the rest. The `ORDER BY` clause controls which duplicate survives: highest volume, latest ingestion timestamp, or most complete record.

### Deduplication Strategies — ROW_NUMBER Pattern

Assigns `ROW_NUMBER()` within each `(symbol, date)` group ordered by descending volume. Rows with `rn = 1` are the canonical records; rows with `rn > 1` are duplicates to remove. The `COUNT(*) OVER` window simultaneously flags which keys have multiple rows, so you can isolate only the affected dates for inspection.


The CTE simulates a duplicate by `UNION ALL`-ing the same latest-date row with a slightly modified close and volume. `ROW_NUMBER()` partitioned by `(symbol, date)` and ordered by descending volume assigns `rn = 1` to the row with the highest volume (the tie-breaking rule). `COUNT(*) OVER` counts how many copies exist per key — the outer `WHERE copies > 1` isolates only the duplicated dates for inspection.

```sql
WITH raw_data AS (
    SELECT symbol, date, [close], volume, 'original' AS source
    FROM silver.eurostoxx50_ohlcv
    WHERE symbol = 'ASML.AS' AND date >= '2026-03-10'
    UNION ALL
    SELECT symbol, date, [close] + 0.5, volume + 999, 'duplicate'
    FROM silver.eurostoxx50_ohlcv
    WHERE symbol = 'ASML.AS' AND date = (SELECT MAX(date) FROM silver.eurostoxx50_ohlcv WHERE symbol = 'ASML.AS')
),
numbered AS (
    SELECT *,
           ROW_NUMBER() OVER (PARTITION BY symbol, date ORDER BY volume DESC) AS rn,
           COUNT(*) OVER (PARTITION BY symbol, date) AS copies
    FROM raw_data
)
SELECT TOP 10 symbol, date, ROUND([close], 2) AS [close], volume, source, rn, copies
FROM numbered
WHERE copies > 1
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



## Execution Plans & Query Optimization

SQL Server's cost-based optimizer compiles a query into an execution plan that specifies the physical operations (seeks, scans, joins, sorts) and their estimated costs. The plan is cached and reused for subsequent identical queries. Use `SET STATISTICS IO, TIME ON` to measure actual logical reads and elapsed time; query `sys.dm_exec_query_stats` to identify the most expensive cached plans. Understanding the common anti-patterns below — non-sargable predicates, implicit type conversions, missing indexes — is the first step in pipeline performance tuning.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {
  'primaryColor': '#292e42',
  'primaryTextColor': '#c0caf5',
  'primaryBorderColor': '#565f89',
  'lineColor': '#565f89',
  'secondaryColor': '#1a1b26',
  'tertiaryColor': '#24283b',
  'noteTextColor': '#c0caf5',
  'noteBkgColor': '#292e42',
  'textColor': '#c0caf5',
  'fontSize': '14px'
}}}%%
flowchart TD
    A[T-SQL Query Submitted] --> B[Parse & Tokenize]
    B --> C[Bind / Algebrize]
    C --> D{Plan Cache Lookup}
    D -->|Cache Hit| E[Reuse Cached Plan]
    D -->|Cache Miss| F[Optimization Phase]
    F --> G{Trivial Plan?}
    G -->|Yes - single table\nno joins/aggs| H[Use Trivial Plan\nno cost estimation]
    G -->|No| I[Cost-Based Optimization\nestimate rows + cost per op]
    I --> J[Select Lowest-Cost Plan\ncached for reuse]
    H --> K[Execute Plan]
    J --> K
    E --> K
    K --> L[Return Result Set]

    style A fill:#1a1b26,stroke:#565f89,color:#c0caf5
    style D fill:#292e42,stroke:#bb9af7,color:#c0caf5
    style F fill:#292e42,stroke:#7aa2f7,color:#c0caf5
    style I fill:#24283b,stroke:#7aa2f7,color:#c0caf5
    style K fill:#1a1b26,stroke:#9ece6a,color:#c0caf5
    style L fill:#1a1b26,stroke:#9ece6a,color:#c0caf5
```

### Execution Plans & Query Optimization — Common Anti-Patterns

The following patterns prevent SQL Server from using indexes efficiently. Each forces a table scan where an index seek would suffice, often increasing query cost by orders of magnitude on large tables.

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| `WHERE YEAR(date) = 2025` | Function on column prevents index seek | `WHERE date >= '2025-01-01' AND date < '2026-01-01'` |
| `SELECT *` | Reads all columns, can't use covering index | Select only needed columns |
| `WHERE col = NULL` | Always FALSE (NULL != NULL) | `WHERE col IS NULL` |
| Implicit conversion | VARCHAR compared to NVARCHAR causes scan | Match data types in predicates |
| Missing index | Table scan on large table | Add non-clustered index on filter columns |


Both queries return the same count, but the non-sargable version (`YEAR(date) = 2025`) wraps the column in a function, preventing the index seek — SQL Server must evaluate `YEAR()` for every row. The sargable version (`date >= '2025-01-01' AND date < '2026-01-01'`) expresses the same filter as a range predicate the index can seek directly.

```sql
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



## Transaction Isolation Levels

SQL Server's transaction isolation levels control how reads interact with concurrent writes — the trade-off between data consistency and blocking. The default `READ COMMITTED` blocks readers when a writer holds a row lock. For analytics reads in a data pipeline, `SNAPSHOT` isolation provides point-in-time consistency with no blocking by reading row versions stored in tempdb. **Read Committed Snapshot Isolation (RCSI)** extends snapshot behavior automatically to all `READ COMMITTED` statements database-wide — enable it with `ALTER DATABASE stoxx SET READ_COMMITTED_SNAPSHOT ON` — eliminating reader/writer blocking without changing any application code.

> [!info] Cross-Engine: Isolation Levels
>
> **SQL Server** implements all ANSI isolation levels plus `SNAPSHOT` (optimistic, row-versioned via tempdb) and RCSI. **BigQuery** uses serializable isolation for multi-statement transactions by default; single statements are always atomic and isolated. **Firestore** transactions are serializable and limited to 500 documents per transaction; reads outside a transaction use strong consistency by default for server-side reads, eventual consistency for mobile/web clients.

### Transaction Isolation Levels — Guide for Data Engineering

Each isolation level is a commitment about which read anomalies the engine prevents. Higher levels prevent more anomalies but increase blocking — lower levels scale better but may return stale or inconsistent reads.

| Level | Dirty Reads | Non-Repeatable | Phantoms | Use Case |
|-------|------------|----------------|----------|----------|
| READ UNCOMMITTED | Yes | Yes | Yes | Stale-tolerant dashboards, quick counts |
| READ COMMITTED (default) | No | Yes | Yes | Most pipeline reads |
| REPEATABLE READ | No | No | Yes | Financial calculations |
| SERIALIZABLE | No | No | No | Critical writes (score computation) |
| SNAPSHOT | No | No | No | Analytics reads (no blocking, uses tempdb) |

**Recommendation for pipelines**: READ COMMITTED for writes, SNAPSHOT for reads.

> [!warning] NOLOCK Can Return Wrong Data
>
> READ UNCOMMITTED (NOLOCK) Can Return Wrong Data.
> `NOLOCK` / `READ UNCOMMITTED` can read rows that are being moved by a page split, causing the same row to appear twice or not at all in the result. It can also read uncommitted data that is later rolled back. Never use NOLOCK for counts, sums, or any calculation where accuracy matters -- even for "approximate" dashboards, the error can be larger than expected.

> [!success] Safe Pattern
>
> Use `SNAPSHOT` isolation for analytics reads instead of `NOLOCK`: `SET TRANSACTION ISOLATION LEVEL SNAPSHOT`. SNAPSHOT provides point-in-time read consistency with no blocking, using row versions from tempdb rather than dirty reads. Enable it at the database level with `ALTER DATABASE stoxx SET ALLOW_SNAPSHOT_ISOLATION ON`.

## Bulk Loading Patterns

Bulk data loading is the performance-critical path for bronze-layer ingestion and silver-layer transforms. SQL Server provides several insertion strategies spanning orders of magnitude in throughput — from simple `INSERT INTO ... SELECT` to minimally-logged `BULK INSERT` from flat files. The choice depends on data source (query result vs. file), load size, recovery model (`FULL` vs. `SIMPLE`/`BULK_LOGGED`), and whether you need checkpointing for loads that exceed available transaction log space.

### Bulk Loading Strategies — Insert Method Comparison

Choose an insert strategy based on data source, batch size, and recovery model. Minimal logging (requires `SIMPLE` or `BULK_LOGGED` recovery model) is needed to achieve the fastest throughput with `INSERT ... WITH (TABLOCK)` and `BULK INSERT`.

| Strategy | Speed | When |
|----------|-------|------|
| `INSERT INTO ... SELECT` | Medium | Small-medium loads from staging |
| `INSERT ... WITH (TABLOCK)` | Fast | Minimal logging in SIMPLE/BULK_LOGGED |
| `BULK INSERT` | Fastest | Loading from CSV files on disk |
| Batched inserts (TOP N loop) | Controlled | Large loads with checkpoints |
| Drop indexes → load → rebuild | Fastest | Full table reloads |

**Pipeline pattern**: load to staging table → validate → MERGE to target → truncate staging.

## Data Lineage & Audit Columns

The stoxx database implements audit columns on every table to support data lineage tracking: when each row was ingested, computed, and last modified. These columns enable freshness checks (is the data stale?), replay detection (has this batch already been loaded?), and pipeline debugging (which layer introduced a discrepancy?). The query below checks the latest timestamp across all four layers of the medallion architecture to confirm a successful end-to-end pipeline run.

### Data Lineage & Audit — Standard Audit Columns

Every table in the stoxx database has audit columns:

| Column | Type | Purpose |
|--------|------|--------|
| `_ingested_at` | DATETIME2 | When the row was loaded (bronze) |
| `_scored_at` | DATETIME2 | When the score was computed (gold) |
| `_computed_at` | DATETIME2 | When the performance was calculated |
| `is_filled` | BIT | Whether the row was gap-filled (silver) |
| `is_current` | BIT | SCD Type 2 current flag (dimension) |


```sql
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



## Partitioning Strategies

Table partitioning divides a large table's data into physically separate segments based on a column value range (typically a date). SQL Server's partition elimination allows the query optimizer to skip entire partitions that cannot satisfy the `WHERE` clause predicate — equivalent to a physical shard filter at the storage level. Partitioning also enables instant data archival via `SWITCH`: moving an entire partition between tables is a metadata-only operation requiring no row movement. See [partitioning-strategies](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/partitioning-strategies) for full implementation details including partition functions, schemes, sliding windows, and maintenance scripts.

### Partitioning Strategies — When to Partition

Partition large tables (millions of rows) by a date column for:
- **Faster queries**: partition elimination skips irrelevant months/years
- **Easier maintenance**: rebuild one partition, not the whole table
- **Instant archival**: SWITCH old partitions to archive table

The OHLCV tables (~65K rows each) are too small to benefit. In production with 100M+ rows, partition by year or month.

The schema below shows how a partition function and scheme would be defined — for reference only; do not run in the lab environment.

```sql
CREATE PARTITION FUNCTION pf_yearly(DATE)
    AS RANGE RIGHT FOR VALUES ('2022-01-01', '2023-01-01', '2024-01-01', '2025-01-01', '2026-01-01');

CREATE PARTITION SCHEME ps_yearly
    AS PARTITION pf_yearly ALL TO ([PRIMARY]);

CREATE TABLE silver.ohlcv_partitioned (
    symbol VARCHAR(20), date DATE, [close] FLOAT, ...
) ON ps_yearly(date);
```

## Cleanup


```sql
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


