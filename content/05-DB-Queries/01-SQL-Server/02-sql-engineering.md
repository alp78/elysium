---
title: "02 - SQL Engineering"
tags: [sql-server, tsql, engineering]
aliases: [SQL engineering, SQL performance, transactions, error handling, indexing, temp tables, table variables, dynamic SQL, stored procedures]
description: "SQL Server T-SQL engineering patterns with executable examples — covers transactions, error handling, temp tables, dynamic SQL, stored procedures, and performance tuning."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# SQL Engineering

> [!quote]
> "A database is only as good as the integrity constraints that protect it."
>
> — **C.J. Date**, *An Introduction to Database Systems* (2003)

> [!abstract]- Summary
>
> SQL Engineering is the second notebook in this SQL Server query series for data engineering: it shifts from ad-hoc querying into reusable database objects, physical design choices, and operational pipeline patterns, all demonstrated in a disposable `demo` schema with explicit cleanup.
>
> **Reusable database objects**
> - covers views, stored procedures, inline table-valued functions, `TRY/CATCH` error handling, dynamic SQL boundaries, and the trade-offs between reusable query surfaces
>
> **Performance and physical design**
> - covers index strategy, covering indexes, execution plan reading, parameter sniffing, partitioning, and why scalar UDFs and non-SARGable access patterns degrade throughput
>
> **Pipeline state and intermediate data**
> - covers SCD Type 1 vs Type 2 dimensions, `LAG`-based gap detection, `ROW_NUMBER()` deduplication, temp-table materialization, and audit-column lineage patterns
>
> **Load and concurrency operations**
> - covers transaction isolation levels, reader-writer blocking behavior, bulk loading patterns, and safe object-lifecycle cleanup for notebook reruns
>
> **Operations and safety**
> - Warnings: object-creating sections, lab-only credentials, parameter sniffing, scalar UDF row-by-row execution, `MERGE` concurrency bugs, `NOLOCK` / `READ UNCOMMITTED`, Type 1 history loss, repeated CTE execution, and over-indexing
> - Recommendations table: 7 defaults covering object selection, guarded `TRY/CATCH`, sniffing mitigation, staging-load flow, RCSI for analytics, demo schema isolation, and audit columns
> - Troubleshooting: 6 failure modes covering unstable stored procedure performance, slow views, `MERGE` duplicate-key races, unindexed `#temp` tables, scalar-UDF timeouts, and missing partition elimination

> [!note]- Glossary
>
> **View**
> - A named query stored in the database that exposes a virtual table-shaped interface without persisting separate data by default.
> - It matters because views are the lightest reusable abstraction in this note for sharing query logic across dashboards, notebooks, and downstream SQL objects.
>
> > [!warning] Views are not caches
> >
> > A regular view reruns its underlying query whenever it is referenced. Only indexed views persist results, and they carry strict design rules plus write-time maintenance cost.
>
> ---
>
> **Stored procedure**
> - A named T-SQL program stored in the database, usually parameterized and capable of control flow, transactions, and error handling.
> - It matters because the note uses stored procedures for multi-step pipeline behavior that needs encapsulation, plan reuse, and a stable execution surface.
>
> > [!warning] Cached plans can mislead
> >
> > The first parameter values seen by a procedure can shape its cached plan. That makes stored procedures operationally convenient but performance-sensitive when input sizes vary wildly.
>
> ---
>
> **Inline table-valued function**
> - A function that returns a table from a single `SELECT` expression and can usually be inlined by the optimizer into the calling query.
> - It matters because iTVFs give the note a parameterized, reusable alternative to views without the row-by-row penalty of scalar functions.
>
> > [!info] Parameterized view mental model
> >
> > An iTVF behaves much closer to a reusable query template than to a procedural routine. That is why it often optimizes well and stays composable in larger statements.
>
> ---
>
> **Execution plan**
> - The physical operator tree SQL Server chooses to execute a statement, including scans, seeks, joins, sorts, memory grants, and row estimates.
> - It matters because plan reading is the note's main diagnostic lens for explaining why one version of a query is fast and another is not.
>
> > [!warning] Estimated is not actual
> >
> > Estimated plans show what the optimizer predicted. Real troubleshooting often depends on the actual plan and runtime counters such as `STATISTICS IO` and `STATISTICS TIME`.
>
> ---
>
> **SCD Type 1 / Type 2**
> - Two slowly changing dimension strategies: Type 1 overwrites prior values, while Type 2 closes the old row and inserts a new version with validity metadata.
> - It matters because the note shows how dimensional corrections change analytical history depending on whether the pipeline preserves or destroys prior states.
>
> > [!danger] Type 1 rewrites history
> >
> > If an attribute affects calculations, a Type 1 update can silently change historical outputs. Type 2 exists precisely to avoid that loss of analytical truth.
>
> ---
>
> **`MERGE`**
> - A T-SQL statement that combines match detection and data modification so one command can insert, update, or delete against a target table from a source dataset.
> - It matters because the note positions `MERGE` as a compact upsert pattern for incremental pipeline loads.
>
> > [!warning] Concurrency needs locking
> >
> > SQL Server `MERGE` has known race and correctness issues under concurrent access. If it is used at all, the target should be protected with `WITH (HOLDLOCK)` and tested carefully.
>
> ---
>
> **Transaction isolation level**
> - The rule set that governs how one transaction can see data modified by other concurrent transactions.
> - It matters because the note compares isolation levels to decide when analytics should block writers, read row versions, or avoid unsafe dirty-read shortcuts.
>
> > [!warning] `NOLOCK` is not harmless
> >
> > `READ UNCOMMITTED` can read rows twice, miss rows, or return rolled-back data. It is a correctness trade-off, not a free speed boost.
>
> ---
>
> **Temp table / `#temp`**
> - A session-scoped table stored in `tempdb` that supports indexes, statistics, and reuse across multiple statements in the same session.
> - It matters because the note recommends temp tables when intermediate results must be referenced repeatedly or tuned with their own indexes.
>
> > [!info] Materialization is sometimes the optimization
> >
> > Recomputing a complex CTE several times can be more expensive than writing it once to `#temp`. Materialization is not just a convenience; it can be the performance fix.
>
> ---
>
> **Table variable / `@table`**
> - A table-shaped variable scoped to the batch, procedure, or function that stores rows without behaving like a fully statistics-driven temp table.
> - It matters because the note contrasts table variables with temp tables to show why the simpler syntax often loses on anything but tiny rowsets.
>
> > [!warning] Cardinality guesses stay tiny
> >
> > SQL Server often optimizes table variables as if they contain about one row. That guess can wreck join choices and memory grants once the real row count grows.
>
> ---
>
> **Covering index**
> - An index whose key and included columns satisfy a query without forcing additional lookups to the base table.
> - It matters because many of the note's dashboard and pipeline reads become cheaper when the access path already contains the projected and filtered columns.
>
> > [!warning] Read wins become write tax
> >
> > Covering an important query can help latency dramatically, but every extra index still has to be maintained during data modification. The right answer depends on workload frequency, not on elegance.
>
> ---
>
> **Partition elimination**
> - The optimizer's ability to skip whole physical partitions when a predicate proves they cannot contain qualifying rows.
> - It matters because partitioning only pays off when queries filter on the partition key in a form the optimizer can actually exploit.
>
> > [!warning] Functions defeat pruning
> >
> > If the filter wraps the partition column in `YEAR()` or another function, SQL Server usually cannot eliminate partitions efficiently. The same anti-pattern also harms ordinary index seeks.
>
> ---
>
> **Parameter sniffing**
> - SQL Server's plan-caching behavior where the first parameter values used during compilation influence the shape of the cached plan reused later.
> - It matters because stored procedure performance in this note can swing sharply depending on whether the compiled-for inputs resemble typical runtime inputs.
>
> > [!warning] Recompile is not free
> >
> > `OPTION (RECOMPILE)` can fix a bad cached plan, but it also forces new optimization work on every execution. Use it deliberately on the statements that actually vary by input shape.
>
> ---
>
> **Demo schema**
> - A non-production SQL Server schema used to isolate experimental tables, views, and procedures from the main application objects.
> - It matters because the note intentionally creates objects during examples and needs those objects to stay safe to rerun and easy to clean up.
>
> > [!info] Isolation helps idempotence
> >
> > Putting notebook objects under `demo` makes cleanup straightforward and reduces the risk of colliding with real pipeline assets. It is an operational pattern, not just a naming choice.
>
> ---
>
> **RCSI / `READ_COMMITTED_SNAPSHOT`**
> - A database setting that changes `READ COMMITTED` behavior to use row versions so readers stop blocking writers and vice versa.
> - It matters because the recommendations section presents RCSI as the lowest-friction way to improve analytical read concurrency across an entire database.
>
> > [!warning] It is a database-level choice
> >
> > RCSI is not a per-query hint. Enabling it changes read semantics for the database and should be treated as an operational decision that needs environment-level review.

> [!warning] Some Sections CREATE Database Objects
>
> All objects are created in a `demo` schema or use temp tables to avoid modifying the production stoxx schema.

> [!success] Safe Pattern
>
> All persistent objects in this notebook use a dedicated `demo` schema (`CREATE OR ALTER ... demo.object_name`) and are dropped in the Cleanup section at the end. Always use a non-production schema for experimental objects, and include a cleanup block to ensure idempotent re-runs.

*Load the jupysql extension and configure display settings for notebook SQL execution.*

```python
%load_ext sql
%config SqlMagic.displaycon = False
%config SqlMagic.displaylimit = 0
```

*Connect to the local SQL Server stoxx database via ODBC.*

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

*Create the demo schema if it does not already exist (idempotent).*

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

#### Create a view wrapping ROW_NUMBER deduplication logic

*Create a view that returns the most recent OHLCV row per stock using ROW_NUMBER deduplication.*

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

#### Query the view with a simple SELECT

*Query the view — the complex dedup logic is now hidden behind a simple SELECT.*

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

#### Create a cross-layer dashboard view

*Create a cross-layer dashboard view joining gold scores with silver dimension metadata.*

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

#### Query the dashboard view for the latest rankings

*Query the dashboard view for the latest Euro Stoxx 50 scores ordered by rank.*

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

#### Create a parameterized top-N stored procedure

*Create a parameterized stored procedure that returns the top N stocks by composite rank for a given index.*

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

#### Execute the stored procedure for Euro Stoxx 50

*Execute the stored procedure for the Euro Stoxx 50 index, returning the top 5 stocks.*

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

#### Create an SP with TRY/CATCH, transaction, and OUTPUT parameter

*Create an SP with TRY/CATCH error handling, explicit transaction, and an OUTPUT parameter for row count.*

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

#### Create an inline table-valued function for price history

*Create an inline table-valued function that returns OHLCV data for a given symbol and date range.*

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

#### Call the iTVF from a SELECT statement

*Call the iTVF for ASML March 2026 data — the optimizer inlines it into the outer query plan.*

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

Index selection is the single highest-leverage performance decision in SQL Server. The right index can turn a multi-second table scan into a sub-millisecond seek; the wrong index imposes unnecessary write overhead on every `INSERT`, `UPDATE`, and `DELETE`. Index design for data pipelines requires balancing read-query patterns (equality filters, range scans, analytical aggregations) against write throughput. See [index-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/index-types-and-strategy) for columnstore internals, fragmentation maintenance, and missing index DMV analysis.

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

#### Inspect existing indexes on a table via catalog views

*Inspect existing indexes on the OHLCV table: name, type, uniqueness, and key columns.*

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
> This section covers index usage patterns for query tuning. For full index internals — B-tree structure, columnstore encodings, fragmentation mechanics, and automated maintenance scripts — see [index-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/index-types-and-strategy) in Chapter 04.

## Slowly Changing Dimensions (SCD)

The MERGE patterns used for SCD Type 2 below are a key building block for [idempotent-pipeline-design](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design), where every load can be safely re-run without duplicating or corrupting data.

### Slowly Changing Dimensions — SCD Type 1 Overwrite

Simply UPDATE the row. History is lost. Use when you don't care about old values.
Example: fix a typo in a company name.

#### Simulate an SCD Type 1 overwrite on a temp table

*Simulate an SCD Type 1 overwrite: copy 5 rows into a temp table, then UPDATE ASML's sector in place.*

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

#### Query SCD Type 2 validity ranges

*Query SCD Type 2 history: show valid_from/valid_to ranges for Euro Stoxx 50 dimension rows.*

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

#### Detect calendar gaps with LAG and DATEDIFF

*Detect time-series gaps: compare each date to the previous date using LAG and flag gaps > 3 days.*

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

#### Identify duplicates with ROW_NUMBER and tie-breaking

*Simulate a duplicate row and identify it using ROW_NUMBER with volume-based tie-breaking.*

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
    G -->|Yes - single table<br/>no joins/aggs| H[Use Trivial Plan<br/>no cost estimation]
    G -->|No| I[Cost-Based Optimization<br/>estimate rows + cost per op]
    I --> J[Select Lowest-Cost Plan<br/>cached for reuse]
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

#### Compare non-SARGable vs SARGable predicates

*Compare non-SARGable (function-on-column) vs SARGable (range) predicates — same result, different plans.*

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

#### Check data freshness across all medallion layers

*Check data freshness across all four medallion layers — the latest timestamp per layer.*

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

Table partitioning divides a large table's data into physically separate segments based on a column value range (typically a date). SQL Server's partition elimination allows the query optimizer to skip entire partitions that cannot satisfy the `WHERE` clause predicate — equivalent to a physical shard filter at the storage level. Partitioning also enables instant data archival via `SWITCH`: moving an entire partition between tables is a metadata-only operation requiring no row movement. See [partitioning-strategies](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/partitioning-strategies) for full implementation details including partition functions, schemes, sliding windows, and maintenance scripts.

### Partitioning Strategies — When to Partition

Partition large tables (millions of rows) by a date column for:

- **Faster queries**: partition elimination skips irrelevant months/years
- **Easier maintenance**: rebuild one partition, not the whole table
- **Instant archival**: SWITCH old partitions to archive table

The OHLCV tables (~65K rows each) are too small to benefit. In production with 100M+ rows, partition by year or month.

The schema below shows how a partition function and scheme would be defined — for reference only; do not run in the lab environment.

#### Define a yearly partition function and scheme

*Define a yearly partition function and scheme for a partitioned OHLCV table (reference only — not executed in lab).*

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

Drop all objects created in the `demo` schema by this notebook. Running the cleanup leaves the database in its original state and makes the notebook safe to re-run from a clean slate.

### Demo object cleanup

Every view, stored procedure, and function created earlier must be dropped in reverse dependency order before the schema itself can be removed.

#### Drop all demo objects and the demo schema

*Drop all demo objects and the demo schema to leave the database clean.*

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


## Warnings

The table below lists the highest-impact production pitfalls associated with the database objects and patterns covered in this note. Each entry corresponds to a warning or danger callout earlier in the page.

| Topic | Warning |
|---|---|
| **Parameter sniffing** | An SP's cached plan is optimized for the first parameter values. A plan compiled for 5 rows can be catastrophic for 10,000 rows. Monitor with `sys.dm_exec_query_stats`. |
| **Scalar UDFs** | Non-inlineable scalar UDFs disable parallelism and force row-by-row execution. A simple scalar UDF on 10M rows can turn a 2-second query into a 2-minute query. |
| **MERGE concurrency bugs** | Microsoft has documented multiple bugs: missing rows, duplicate key violations, incorrect results under concurrent access. Always add `WITH (HOLDLOCK)` on the target. |
| **NOLOCK / READ UNCOMMITTED** | Can return rows twice, skip rows, or read rolled-back data during page splits. Never use for counts, sums, or any calculation where accuracy matters. |
| **SCD Type 1 in financial pipelines** | Destroys history permanently. A sector change applied via Type 1 retroactively alters historical portfolio returns without any audit trail. |
| **CTE re-execution** | A CTE referenced 3 times runs 3 times. Check the execution plan for repeated subtrees — switch to `#temp` if cost is significant. |
| **Over-indexing** | Each index slows INSERT/UPDATE/DELETE. Monitor index usage with `sys.dm_db_index_usage_stats` and drop unused indexes. |

## Recommendations

Standing guidance for designing, writing, and operating the database objects covered above. Apply these as defaults unless a specific workload has a documented reason to deviate.

| Area | Recommendation |
|---|---|
| **View vs SP vs iTVF** | Use views for static logic, iTVFs for parameterized reads, SPs for multi-step procedural logic with transactions. |
| **Error handling** | Always use `TRY/CATCH` with `@@TRANCOUNT > 0` guard before `ROLLBACK`. Without the guard, rolling back a non-existent transaction raises an additional error. |
| **Parameter sniffing mitigation** | Use `OPTION (RECOMPILE)` on specific statements (not the whole SP) for plans that genuinely vary by input. Use `OPTIMIZE FOR UNKNOWN` for stable average behavior. |
| **Bulk loading** | Load to staging table → validate with quality checks → MERGE to target → truncate staging. Drop non-clustered indexes before large loads, rebuild after. |
| **Isolation for analytics** | Enable RCSI (`ALTER DATABASE stoxx SET READ_COMMITTED_SNAPSHOT ON`) to eliminate reader/writer blocking database-wide without changing application code. |
| **Demo schema pattern** | Always create experimental objects in a dedicated schema (`demo`). Include a cleanup block at the end to ensure idempotent re-runs. |
| **Audit columns** | Every pipeline table should have `_ingested_at` (bronze), `_scored_at` (gold), and `is_filled` / `is_current` flags for lineage tracking. |

## Troubleshooting

Symptoms you will encounter when a database object or query misbehaves, mapped to the most likely cause and the fix that resolves it in practice.

| Symptom | Likely cause | Fix |
|---|---|---|
| SP runs fast the first time, slow on subsequent calls | Parameter sniffing — plan cached for atypical first values | Add `OPTION (RECOMPILE)` or `WITH RECOMPILE` on the SP, or use `sp_recompile` to flush the plan. |
| View query is unexpectedly slow | View references a CTE or subquery that is re-evaluated, or the base table lacks an index on the filter column | Check the execution plan. Add a covering index on the most-used predicate columns. |
| MERGE raises duplicate key violation | Race condition between MATCHED check and INSERT under concurrent access | Add `WITH (HOLDLOCK)` on the target table in the MERGE statement, or switch to explicit INSERT/UPDATE in a transaction with `UPDLOCK`. |
| `#temp` table query slow despite small size | Missing index on the join/filter column in the temp table | Add `CREATE INDEX ix ON #temp (key_col)` after populating the temp table. |
| Scalar UDF causes query timeout | UDF is non-inlineable — forces row-by-row execution | Rewrite as an iTVF or inline the logic directly into the query. Check `sys.sql_modules.is_inlineable`. |
| Partition elimination not working | WHERE clause uses a function on the partition column, or the filter column doesn't match the partition function | Rewrite as a range predicate on the raw partition column. Verify with execution plan's "Actual Partition Count". |

## Cross-references

Related notes that extend or depend on the patterns covered here.

- [index-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/index-types-and-strategy) — full index internals, columnstore, fragmentation maintenance, missing index DMV analysis
- [partitioning-strategies](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/partitioning-strategies) — partition functions, schemes, sliding windows, maintenance scripts
- [sargable-queries](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/sargable-queries) — deep dive on SARGable vs non-SARGable predicates
- [idempotent-pipeline-design](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design) — how MERGE fits into re-runnable load strategies
- [bronze-layer-loading](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/bronze-layer-loading) — ingestion pipeline feeding the medallion architecture
- [silver-transforms](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/silver-transforms) — production daily return and gap-fill transforms
- [gold-transforms](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/gold-transforms) — production z-score normalization and composite ranking
- [dbt-sqlserver-adapter](https://alp78.github.io/elysium/11-dbt/Adapters/dbt-sqlserver-adapter) — dbt alternative to hand-written stored procedures
- [secrets-management](https://alp78.github.io/elysium/06-GCP/Security/secrets-management) — production credential management (GCP Secret Manager)
