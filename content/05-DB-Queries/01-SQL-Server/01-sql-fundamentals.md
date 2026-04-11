---
title: "01 - SQL Fundamentals"
tags: [sql-server, tsql, fundamentals]
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

This note is an executable T-SQL reference for data engineers working with SQL Server. It covers the core query patterns used in a medallion-architecture pipeline — from schema exploration and filtering through JOINs, window functions, CTEs, data quality gates, and bronze-to-gold transforms — all demonstrated against a live Euro Stoxx 50 OHLCV dataset.

## Key terms used in this note

| Term | Plain-English definition | Why it matters here | Common mistake / confusion |
|---|---|---|---|
| **T-SQL** | Transact-SQL — Microsoft's SQL dialect for SQL Server, extending ANSI SQL with procedural constructs (`DECLARE`, `IF`, `WHILE`), error handling (`TRY/CATCH`), and proprietary functions (`GETDATE`, `ISNULL`). | Every query in this note uses T-SQL syntax. BigQuery uses GoogleSQL with different keywords (`LIMIT` vs `TOP`, `IFNULL` vs `ISNULL`). | Assuming T-SQL is portable — `TOP N`, `[brackets]`, `GETDATE()`, and `IDENTITY` do not exist in BigQuery or PostgreSQL. |
| **Medallion architecture** | A data pipeline pattern with three layers: **bronze** (raw ingested data), **silver** (cleaned, enriched, typed), and **gold** (aggregated, scored, dashboard-ready). Each layer is implemented as a SQL Server schema in this database. | Queries in this note cross all three layers. Understanding which schema a table belongs to tells you how much you can trust its data. | Treating bronze data as production-ready — bronze may contain NULLs, duplicates, and type mismatches that silver transforms are designed to fix. |
| **OHLCV** | Open, High, Low, Close, Volume — the five standard fields in a financial price bar. Each row represents one trading day for one stock. | The primary fact table (`silver.eurostoxx50_ohlcv`) uses this schema. All aggregation, window function, and quality check examples query it. | Confusing `close` (last traded price of the day) with `adjusted close` (retroactively corrected for splits and dividends). This dataset uses unadjusted close. |
| **Schema (SQL Server)** | A namespace within a database that groups related tables, views, and procedures. In this database, schemas implement medallion layers (`bronze`, `silver`, `gold`). | Every table reference is schema-qualified (`silver.eurostoxx50_ohlcv`). Unqualified names default to `dbo`, which is not used here. | Confusing SQL Server schemas with BigQuery datasets — both are namespaces, but BigQuery datasets also control storage location and billing. |
| **Window function** | A function that computes a value for each row based on a set of related rows (the "window") defined by `PARTITION BY` and `ORDER BY`, without collapsing the result set. Examples: `ROW_NUMBER`, `LAG`, `AVG() OVER`. | Used for moving averages, daily returns, ranking, and deduplication throughout this note. | Expecting window functions to reduce row count like `GROUP BY` — they do not. Every input row produces exactly one output row. |
| **CTE (Common Table Expression)** | A named temporary result set defined with `WITH name AS (SELECT ...)` that exists only for the duration of the enclosing statement. CTEs are not materialized in SQL Server — the optimizer inlines them. | Used for chaining multi-step analytical queries (sector heatmaps, cross-index comparisons). | Assuming a CTE is computed once — SQL Server may re-execute the CTE logic for each reference in the outer query, multiplying cost. |
| **SARGable** | Search ARGument ABLE — a predicate written so the query optimizer can use an index seek instead of a full table scan. `WHERE date >= '2025-01-01'` is SARGable; `WHERE YEAR(date) = 2025` is not. | Directly affects query speed on indexed columns. Non-SARGable predicates force full scans even when a perfect index exists. | Wrapping an indexed column in a function (`YEAR()`, `CAST()`, `UPPER()`) — this silently disables the index without any error or warning. |
| **Covering index** | An index that includes all columns referenced by a query in its key or `INCLUDE` columns, allowing the query to be satisfied entirely from the index without accessing the base table (no key lookup). | Several queries in this note benefit from covering indexes on `(symbol, date) INCLUDE (close, volume)`. | Over-indexing — each additional index slows `INSERT`/`UPDATE`/`DELETE` operations. Only create covering indexes for the highest-frequency query patterns. |
| **Z-score** | A statistical measure: `(value - mean) / standard_deviation`. Indicates how many standard deviations a value is from the group mean. Positive = above average, negative = below. | The gold-layer scoring engine normalizes composite scores into z-scores for cross-stock comparison. | Interpreting z-scores as absolute quality — a z-score of +2 means "2 standard deviations above this group's mean," not "objectively good." The baseline depends entirely on the group. |
| **`ROW_NUMBER()`** | A window function that assigns a unique sequential integer (1, 2, 3, ...) to each row within a partition, ordered by the specified column. No ties — every row gets a different number. | The primary deduplication tool in this note: `WHERE rn = 1` keeps only the most recent or highest-priority row per key. | Confusing with `RANK()` (allows ties and gaps: 1, 2, 2, 4) or `DENSE_RANK()` (allows ties, no gaps: 1, 2, 2, 3). |
| **Gap-fill / `is_filled`** | A silver-layer transform that inserts synthetic rows for missing trading days (weekends, holidays) by forward-filling the previous day's close price. The `is_filled` flag marks these synthetic rows. | Quality checks and return calculations must account for gap-filled rows — including them in volume aggregates would be incorrect. | Treating gap-filled rows as real trading data — they have zero actual volume and a carried-forward price, not a market-determined price. |

## What this note covers

- **Schema exploration** — listing tables, inspecting column types across medallion layers
- **SELECT, filtering, sorting** — basic queries, multi-condition WHERE, SQL Server vs BigQuery syntax differences
- **Aggregation (GROUP BY)** — per-stock and per-period summaries, WHERE vs HAVING placement
- **JOINs across medallion layers** — silver-to-silver and silver-to-gold cross-layer joins, duplicate-safe join patterns
- **Window functions** — moving averages (SMA), LAG/LEAD for daily returns, RANK/NTILE for stock ranking
- **CTEs and subqueries** — sector heatmaps, chained CTEs for cross-index comparison
- **Data quality checks** — structural and operational validation gates using UNION ALL
- **Bronze → silver → gold transforms** — daily return computation, z-score normalization, composite ranking

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
Connecting to 'mssql+pyodbc://sa:***@localhost:1434/stoxx?TrustServerCertificate=yes&driver=ODBC+Driver+18+for+SQL+Server'
```

> [!danger] Lab-Only Credentials
>
> The connection string above contains a plaintext password for a local lab environment. In production, credentials are stored in GCP Secret Manager and fetched at runtime — never hardcoded. See [secrets-management > Access from Python](https://alp78.github.io/elysium/06-GCP/Security/secrets-management#access-from-python).

> [!success] Safe Pattern
>
> In production, retrieve the connection string from GCP Secret Manager at runtime: `secretmanager.SecretManagerServiceClient().access_secret_version(name=...)`. Never hardcode passwords in notebooks, scripts, or source control. Use environment variables or secret injection via Cloud Run / GKE secrets.

This file is the first of three in the SQL Server query cookbook, progressing from fundamentals through engineering patterns to advanced techniques.

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
flowchart LR
    F["<b>Fundamentals</b><br/>SELECT · JOINs · Aggregation<br/>Window Functions · CTEs"]
    E["<b>Engineering</b><br/>Views · Stored Procedures<br/>Indexes · Transactions · SCD"]
    A["<b>Advanced</b><br/>Recursive CTEs · PIVOT<br/>MERGE · APPLY · GROUPING SETS"]
    F --> E --> A

    style F fill:#292e42,stroke:#7aa2f7,stroke-width:2px,color:#c0caf5
    style E fill:#1a1b26,stroke:#565f89,stroke-width:1px,color:#c0caf5
    style A fill:#1a1b26,stroke:#565f89,stroke-width:1px,color:#c0caf5
```

## Schema Exploration

SQL Server exposes database metadata through system catalog views (`sys.tables`, `sys.schemas`, `sys.columns`) and the ANSI-standard `INFORMATION_SCHEMA` views. Querying these is always the first step when working with an unfamiliar database — understanding what tables exist, how they are organized across schemas (which map to medallion layers in this architecture), and what data types each column uses.

### Schema Exploration — List All Tables

This query joins `sys.tables`, `sys.schemas`, and `sys.partitions` to list every table with its schema name and row count. The medallion layers (bronze, silver, gold) are implemented as SQL Server schemas. The filter `index_id IN (0, 1)` targets heaps (0) and clustered indexes (1) to avoid double-counting rows from non-clustered indexes.

#### List all tables with row counts per medallion schema

*List all tables across medallion-layer schemas with their row counts.*

```sql
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

The `INFORMATION_SCHEMA.COLUMNS` view is the ANSI-standard metadata interface — portable across SQL Server, PostgreSQL, and MySQL. It exposes column names, data types, maximum lengths, and nullability. Check data types before writing queries — `float` vs `int` vs `varchar` changes how you aggregate and join. The alternative `sys.columns` view is SQL Server-specific but exposes additional details like computed column definitions and default constraints.

#### Inspect column names, types, and nullability with INFORMATION_SCHEMA

*Inspect column names, data types, and nullability for the silver OHLCV table.*

```sql
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

`SELECT` is the workhorse of T-SQL — pick columns, filter with `WHERE`, sort with `ORDER BY`, and limit rows with `TOP`. The subsections below cover basic filtering, multi-condition predicates, and the subtle syntax differences between SQL Server and BigQuery that trip up pipeline engineers working across both engines.

> [!info]- SQL Server vs BigQuery Syntax
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

> [!danger] Avoid SELECT * in production code
>
> `SELECT *` reads every column from the table, preventing the optimizer from using covering indexes (which satisfy the query from the index alone without a key lookup to the base table). It also breaks queries silently when columns are added, removed, or reordered. In BigQuery, `SELECT *` on a large table scans every column — and BigQuery charges per byte scanned.

> [!success] Safe Pattern
>
> Always list the columns you need explicitly: `SELECT symbol, date, [close], volume FROM ...`. This enables covering index scans, reduces I/O, and makes the query's data contract explicit. Use `SELECT *` only for ad-hoc exploration in SSMS or notebooks, never in production code or stored procedures.

### SELECT, Filtering & Sorting — Basic SELECT with WHERE

The fundamental query: pick columns, filter rows, sort results. `TOP N` limits output (SQL Server). PostgreSQL uses `LIMIT N`.

> [!warning] TOP without ORDER BY is non-deterministic
>
> `SELECT TOP 10 * FROM table` returns an ARBITRARY 10 rows — not the first 10, not the newest 10. The engine picks whichever rows it finds first based on the execution plan. Always pair `TOP` with `ORDER BY` unless you genuinely don't care which rows you get.

> [!success] Safe Pattern
>
> Always pair `TOP N` with `ORDER BY` to get a deterministic result: `SELECT TOP 10 ... ORDER BY date DESC`. If you only need to check whether any row exists (e.g., in an `IF EXISTS` guard), use `SELECT TOP 1 1 FROM ...` with no `ORDER BY` — that is the one case where order genuinely doesn't matter.

#### Retrieve the 10 most recent ASML trading days

*Retrieve the 10 most recent ASML trading days with full OHLCV columns.*

```sql
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



### SELECT, Filtering & Sorting — Multi-Condition WHERE

Combine conditions with `AND` / `OR`. Use `ABS()` for absolute values. This query finds high-volume days (over 5 million shares) with price swings exceeding 3% — potential breakout or crash days.

> [!warning] FLOAT is approximate — ROUND() can surprise
>
> `FLOAT` stores binary approximations. `ROUND(3.145, 2)` on a `FLOAT` column may return `3.14` instead of `3.15`. For financial calculations or exact comparisons, use `DECIMAL(18, 4)`. OHLCV prices stored as `FLOAT` are acceptable for analytics but not for accounting.

> [!success] Safe Pattern
>
> Use `DECIMAL(18, 4)` or `DECIMAL(18, 8)` for financial values that require exact arithmetic (NAV, index weights, fees). Use `FLOAT` only for analytics columns (daily returns, z-scores, volatility) where a sub-penny binary approximation error is acceptable. Never use `=` to compare `FLOAT` columns — use `ABS(a - b) < 0.0001` instead.

#### Find high-volume days with large intraday price swings

*Find high-volume days with price swings exceeding 3% — potential breakout or crash events.*

```sql
SELECT TOP 15
    symbol,
    date,
    [close],
    volume,
    ROUND(([close] - [open]) / [open] * 100, 2) AS daily_move_pct
FROM silver.eurostoxx50_ohlcv
WHERE volume > 5000000
  AND ABS(([close] - [open]) / [open]) > 0.03
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

`GROUP BY` collapses rows sharing common values into summary rows, evaluated after `WHERE` filtering. SQL Server chooses between two physical operators — **stream aggregate** (efficient when input is pre-sorted by the grouping key via an index) and **hash match aggregate** (builds a hash table in memory, spills to tempdb if it exceeds the memory grant). Pairing `GROUP BY` with a covering index on the grouping columns avoids a separate sort step. See [index-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/index-types-and-strategy) for index design guidance.

### Aggregation GROUP BY — Aggregate by Stock

`GROUP BY` collapses rows into groups. Aggregate functions (`AVG`, `COUNT`, `SUM`, `MIN`, `MAX`) summarize each group. This query ranks stocks by average daily trading volume — a standard liquidity measure. The `CAST(volume AS FLOAT)` prevents integer overflow on large volume sums before the average is computed.

#### Rank stocks by average daily trading volume

*Rank Euro Stoxx 50 stocks by average daily trading volume across the full history.*

```sql
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
> `WHERE YEAR(date) = 2025` cannot use an index on `date` — the engine evaluates `YEAR()` on every row. Rewrite as `WHERE date >= '2025-01-01' AND date < '2026-01-01'`. Functions in `GROUP BY` are fine (no index needed). Functions in `WHERE` are the problem. See [sargable-queries](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/sargable-queries).

> [!success] Safe Pattern
>
> Replace any function-on-column `WHERE` predicate with a range: `WHERE date >= '2025-01-01' AND date < '2026-01-01'` instead of `WHERE YEAR(date) = 2025`. For string patterns, use `WHERE symbol LIKE 'ASML%'` rather than `WHERE LEFT(symbol, 4) = 'ASML'`. This allows the engine to seek directly into the index rather than scanning every row.

#### Build a monthly time-series summary per stock

*Build a monthly time-series summary for ASML: high, low, average close, and total volume per month.*

```sql
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

A `JOIN` combines rows from two or more tables based on a related column. In the medallion architecture, joins connect fact tables (OHLCV prices in silver) with dimension tables (company metadata) and pre-computed analytics (gold scores). SQL Server's optimizer evaluates three physical join operators — **nested loop** (best for small outer inputs with an indexed inner table), **hash match** (best for large unsorted inputs), and **merge join** (best when both inputs are pre-sorted on the join key). The operator choice depends on table sizes, available indexes, and estimated cardinalities.

> [!info] Cross-engine note
>
> SQL Server extends standard JOINs with `CROSS APPLY` and `OUTER APPLY` (lateral joins that run a correlated subquery per outer row). BigQuery supports standard JOINs but has no APPLY equivalent — use correlated subqueries or `UNNEST` instead. Firestore has no server-side joins at all — denormalize data or perform client-side joins.

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

> [!info]- Query anatomy — latest price per stock with dimension metadata
>
> | Clause | What it does |
> |---|---|
> | `ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) AS rn` | Assigns `rn = 1` to the most recent trading day per symbol. Ties are impossible because `(symbol, date)` is unique. |
> | `JOIN (...) p ON d.symbol = p.symbol AND p.rn = 1` | Joins the dimension table to only the latest-price row per stock, avoiding duplicate rows. |
> | `WHERE d._index = 'euro_stoxx_50' AND d.is_current = 1` | Restricts to current Euro Stoxx 50 members (SCD Type 2 filter). |
> | `ORDER BY p.[close] DESC` | Sorts by price descending — highest-priced stocks first. |

#### Join latest price per stock with company dimension metadata

*Join the latest price per stock (via ROW_NUMBER deduplication) with company metadata from the dimension table.*

```sql
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

The gold layer has pre-computed composite scores. This join adds human-readable names and sector labels from the dimension table — the typical shape of a dashboard query. The `WHERE` clause uses a correlated scalar subquery (`SELECT MAX(score_date) ...`) to restrict results to the most recent scoring date without hardcoding a value. The optimizer evaluates this subquery once and caches the result.

> [!info]- Query anatomy — gold scores with dimension labels
>
> | Clause | What it does |
> |---|---|
> | `FROM gold.scores_daily s JOIN silver.index_dim d` | Connects pre-computed scores to human-readable company names and sectors. |
> | `ON s.symbol = d.symbol AND d._index = s._index AND d.is_current = 1` | Three-part join key: symbol match + same index + current dimension row only (SCD Type 2 filter). |
> | `WHERE s.score_date = (SELECT MAX(score_date) ...)` | Correlated scalar subquery — the optimizer evaluates this once and caches the result. Avoids hardcoding a date. |
> | `ORDER BY s.composite_rank` | Rank 1 = highest composite score (best stock by the scoring model). |

#### Join gold composite scores with dimension labels for a ranked dashboard

*Join gold-layer composite scores with dimension metadata to produce a ranked stock dashboard.*

```sql
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

Window functions compute a value for each row based on a related set of rows (the "window") without collapsing the result set like `GROUP BY`. SQL Server implements them using sort and segment operators in the execution plan — data is sorted by the `PARTITION BY` / `ORDER BY` columns, then streamed through computing each function. Large partitions may spill the sort to tempdb. For optimal performance, create a covering index matching the partition and order columns (e.g., `(symbol, date) INCLUDE (close, volume)` for per-stock time-series windows).

> [!info] Cross-engine note
>
> Window functions are available in both SQL Server and BigQuery (with near-identical syntax). Firestore has no window function support — aggregation queries added in 2023 cover `COUNT`, `SUM`, and `AVG` only at the collection level.

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

`AVG() OVER (ROWS BETWEEN N PRECEDING AND CURRENT ROW)` — the window slides forward one row at a time. The `OVER` clause has three parts: `PARTITION BY symbol` groups rows by stock, `ORDER BY date` establishes the time sequence within each group, and `ROWS BETWEEN 29 PRECEDING AND CURRENT ROW` defines a sliding window of exactly 30 rows (29 preceding + current).

#### Compute 30-day and 90-day SMAs with a sliding window

*Compute 30-day and 90-day simple moving averages for ASML's closing price.*

```sql
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

#### Calculate daily return percentage and detect calendar gaps

*Calculate daily return percentage and detect calendar gaps using LAG on close price and date.*

```sql
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
    ) AS days_gap
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

This is the core of the gold scoring engine — rank stocks by composite score. The query below uses a self-join on pre-computed boundary dates (first and last trading day of the year from a `bounds` CTE) to calculate YTD return per stock, then applies `RANK()` and `NTILE(4)` to rank and bucket the results into quartiles.

> [!info]- Query anatomy — YTD return ranking with CTE self-join
>
> | Step | CTE / clause | What it does |
> |---|---|---|
> | 1 | `bounds` CTE | Computes the year's first trading date (`MIN(CASE WHEN YEAR(date) = YEAR(GETDATE()) THEN date END)`) and the dataset's last date (`MAX(date)`) in a single scan. |
> | 2 | `ytd` CTE | Self-joins the OHLCV table: row `f` (first date) and row `l` (last date) for the same symbol. Computes `(last_close - first_close) / first_close` as the YTD return. `NULLIF(f.[close], 0)` prevents division by zero for delisted stocks with a zero opening price. |
> | 3 | Final SELECT | `RANK() OVER (ORDER BY ytd_return DESC)` ranks best performers (rank 1 = highest return). `NTILE(4)` divides all 50 stocks into 4 quartile buckets of ~13 stocks each. |

#### Rank stocks by YTD return and assign quartile buckets

*Compute YTD return per stock, then rank and assign quartile buckets using RANK and NTILE.*

```sql
WITH bounds AS (
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

A **Common Table Expression** (CTE) is a named temporary result set defined with `WITH name AS (SELECT ...)` that exists only for the duration of the enclosing statement. CTEs improve readability by breaking complex queries into named logical steps. Unlike temp tables, CTEs are not materialized in SQL Server — the optimizer inlines them into the outer query plan and may re-execute the CTE logic for each reference. For multi-step analytical queries like sector heatmaps or cross-index comparisons, chaining multiple CTEs reads top-to-bottom like a data pipeline.

> [!info] Cross-engine note
>
> Both SQL Server and BigQuery support CTEs including recursive CTEs (BigQuery caps recursion at 500 iterations by default). Firestore has no query composition mechanism — complex data retrieval requires multiple sequential SDK calls orchestrated in application code.

### CTEs & Subqueries — Sector Heatmap

A **CTE** (`WITH name AS (SELECT ...)`) is a named temporary result set. Chaining CTEs makes complex queries readable — each step has a name.

This builds a sector heatmap: average score, best/worst rank per sector.

#### Build a sector heatmap with chained CTEs

*Chain two CTEs to compute per-sector average scores and rank ranges from the latest gold scoring run.*

```sql
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

Multiple CTEs chained together, each building on the previous. This query compares YTD performance, rolling 30-day return and volatility, P/E ratio, and dividend yield across all 4 indices — the kind of cross-index comparison an index provider runs daily. The `ROW_NUMBER()` pattern in `latest_perf` picks the most recent date per index, avoiding repeated `MAX(date)` subqueries.

> [!info]- Query anatomy — cross-index comparison
>
> | Clause | What it does |
> |---|---|
> | `latest_perf` CTE with `ROW_NUMBER() OVER (PARTITION BY _index ORDER BY perf_date DESC)` | Assigns `rn = 1` to the most recent performance record per index — eliminates the need for repeated `MAX(perf_date)` subqueries. |
> | `JOIN bronze.dim_index d ON p._index = d.index_key` | Adds display names from the bronze dimension table. |
> | `WHERE p.rn = 1` | Keeps only the latest row per index. |
> | Output columns | `ytd_return`, `rolling_30d_return`, `rolling_30d_volatility` (all pre-computed in gold), plus `avg_pe` and `avg_dividend_yield` for valuation context. |

#### Compare key metrics across all four indices

*Compare YTD return, 30-day volatility, P/E, and dividend yield across all four indices using a ROW_NUMBER dedup CTE.*

```sql
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

Quality gates validate data integrity at each pipeline stage — catching NULLs, invalid values, and freshness delays before data is promoted downstream. Stacking multiple checks into a single `UNION ALL` result set gives a compact pass/fail summary that can be evaluated programmatically after every load.

### Data Quality Checks — Structural & Operational Validation

Every pipeline needs quality gates. The checks below are split into two categories: **structural** (NULLs, negative prices, impossible high/low values) and **operational** (gap-fill count, data freshness). `UNION ALL` stacks them into a single result set. Run this after every load — any non-zero value needs investigation before promoting to gold.


> [!tip] UNION ALL Quality Gate Pattern
>
> Stack multiple checks into one result set with `UNION ALL`. Each check returns a named row with an issue count. Run after every load — any non-zero value needs investigation before promoting to gold.

#### Run structural quality checks (NULLs, negatives, impossible values)

*Run structural quality checks: null prices, negative prices, and impossible high < low.*

```sql
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

#### Run operational freshness and gap-fill checks

*Run operational checks: count of gap-filled synthetic rows and days since last data update.*

```sql
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

The medallion architecture (bronze → silver → gold) is a progressive refinement pipeline. Bronze stores raw ingested data, silver adds computed columns and data cleansing (daily returns, gap-fill flags), and gold produces business-ready analytical outputs (z-score normalization, composite rankings). Each layer's transforms are idempotent — safe to re-run without duplicating data.

> [!tip] Related pattern
>
> The SQL that creates and populates the bronze tables queried here is covered in [bronze-layer-loading](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/bronze-layer-loading), which walks through the ingestion pipeline that feeds this medallion architecture.

### Bronze → Silver → Gold Transforms — Daily Returns

The silver transform adds computed columns to raw data. Here, `LAG()` computes daily returns from the price time series. The `is_filled` flag marks gap-filled rows (weekends/holidays).

#### Compute daily return with LAG and NULLIF safe division

*Compute daily return as a percentage change from the previous day's close using LAG with NULLIF safe-division.*

```sql
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

> [!info]- Query anatomy — z-score normalization
>
> | Clause | What it does |
> |---|---|
> | `AVG(composite_score) OVER ()` | Computes the mean composite score across all 50 stocks in the index (empty `OVER()` = whole result set as one partition). |
> | `STDEV(composite_score) OVER ()` | Computes the standard deviation across the same partition. |
> | `(composite_score - mean_score) / NULLIF(std_score, 0)` | Z-score formula: how many standard deviations each stock's score is from the mean. `NULLIF` prevents division by zero if all scores are identical. |
> | `DENSE_RANK() OVER (ORDER BY composite_score DESC)` | Ranks stocks without gaps — ties get the same rank, and the next rank is N+1 (not N+2 like `RANK`). |

#### Normalize composite scores to z-scores across the index

*Normalize composite scores to z-scores across the index and rank stocks by composite score.*

```sql
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



## When to Use SQL Server for Queries

SQL Server is the right tool when the workload matches its strengths: transactional concurrency, low-latency reads on well-indexed tables, and procedural logic that cannot be expressed as a single declarative query.

- **Transactional workloads** — SQL Server excels when queries run alongside concurrent writes that require row-level locking, ACID transactions, and immediate consistency. Pipelines that read-and-write in the same step (e.g., MERGE-based incremental loads) benefit from SQL Server's lock-based concurrency.
- **Sub-second latency** — indexed seeks on clustered and covering indexes deliver single-digit millisecond response times. Dashboard queries hitting the gold layer via a view or stored procedure can serve interactive UIs directly.
- **Complex procedural logic** — T-SQL stored procedures, cursors, and control flow (`IF`, `WHILE`, `TRY/CATCH`) support multi-step business logic that cannot be expressed in a single declarative query.
- **Existing SQL Server infrastructure** — when the organization already runs SQL Server for OLTP or reporting, adding analytical tables avoids introducing a new engine and its operational overhead.

## When Not to Use SQL Server for Queries

SQL Server is the wrong tool when the workload shape does not match its cost model or scaling limits. The scenarios below usually belong on BigQuery, Firestore, or another engine.

- **Petabyte-scale analytics** — SQL Server scales vertically (add CPU/RAM to one server). Once tables exceed hundreds of millions of rows and queries require full-table scans, BigQuery's distributed architecture is more cost-effective.
- **Ad-hoc exploration of unfamiliar data** — BigQuery's serverless model requires no index planning. SQL Server queries on un-indexed columns degrade to full table scans with no automatic parallelism beyond the server's CPU count.
- **Schema-less or hierarchical data** — document structures with nested objects, variable fields, and subcollections are a better fit for Firestore or a document database. Forcing them into relational tables adds complexity.
- **Cost-per-query billing** — SQL Server charges for infrastructure (VM/license), not per query. If you run only a few queries per day on a large dataset, the idle infrastructure cost is wasted; BigQuery's per-bytes-scanned model would be cheaper.

## Warnings

The table below lists the most common query anti-patterns that produce silent wrong results, degraded performance, or surprising behavior. Each entry corresponds to a pattern covered earlier in this note.

| Topic | Warning |
|---|---|
| **SELECT \*** | Reads every column, prevents covering index usage, breaks when columns change. In BigQuery, also increases cost per query. Always list columns explicitly. |
| **TOP without ORDER BY** | Returns arbitrary rows — the set is non-deterministic and changes between executions depending on the execution plan. |
| **Functions on indexed columns** | `WHERE YEAR(date) = 2025` or `WHERE UPPER(symbol) = 'ASML.AS'` disables index seeks. Rewrite as range predicates. |
| **FLOAT equality** | `WHERE close = 100.5` may fail due to binary approximation. Use `ABS(close - 100.5) < 0.0001` or store as `DECIMAL`. |
| **JOIN on non-unique keys** | Silently multiplies rows (Cartesian product for matching keys). Always verify row counts after a JOIN. |
| **NULL in JOIN keys** | `NULL = NULL` returns `FALSE`. Rows with NULL keys silently drop from INNER JOINs and fail to match in LEFT JOINs. |
| **Window functions keep all rows** | Unlike `GROUP BY`, window functions do not reduce row count. A common mistake is expecting aggregated output. |
| **Gap-filled rows in aggregates** | Rows with `is_filled = 1` have synthetic (forward-filled) prices and zero real volume. Including them in volume sums or return calculations produces incorrect results. |
| **CTE re-execution** | A CTE referenced multiple times in the same query may be executed multiple times. Materialize into a `#temp` table if performance matters. |

## Recommendations

Standing guidance for writing reliable SQL Server queries in this medallion pipeline. Apply these as defaults unless a specific query has a documented reason to deviate.

| Area | Recommendation |
|---|---|
| **Index design** | Create a covering index on `(symbol, date) INCLUDE (close, volume, open, high, low)` for the OHLCV table. This satisfies most analytical queries from the index alone. |
| **SARGable predicates** | Always express date filters as ranges (`date >= ... AND date < ...`), never as functions (`YEAR(date) = ...`). |
| **Safe division** | Use `NULLIF(denominator, 0)` in every division to prevent divide-by-zero errors: `value / NULLIF(x, 0)`. |
| **ROW_NUMBER deduplication** | When picking one row per key, always specify an unambiguous `ORDER BY` in the `ROW_NUMBER` window. Ties produce non-deterministic results. |
| **Quality gates** | Run the UNION ALL quality check pattern after every bronze-to-silver or silver-to-gold load. Automate the check and fail the pipeline if any check returns non-zero. |
| **Data type awareness** | Use `DECIMAL(18, 4)` for financial values requiring exact arithmetic (NAV, weights, fees). Use `FLOAT` only for analytics columns where sub-penny approximation is acceptable. |
| **Isolation level** | Use `SNAPSHOT` isolation for analytical reads to avoid blocking writers. Default `READ COMMITTED` blocks readers when concurrent writes hold row locks. |
| **HAVING vs WHERE** | Place filters in `WHERE` (pre-aggregation) whenever possible. Use `HAVING` only for conditions on aggregate results — it evaluates after the full aggregation completes. |

## Troubleshooting

Symptoms you will encounter when a query misbehaves, mapped to the most likely cause and the fix that resolves it in practice.

| Symptom | Likely cause | Fix |
|---|---|---|
| Query returns 0 rows unexpectedly | `WHERE col = NULL` instead of `WHERE col IS NULL`, or `NOT IN` subquery contains NULLs | Replace with `IS NULL` / `IS NOT NULL`. Replace `NOT IN` with `NOT EXISTS`. |
| Query is slow on an indexed column | Non-SARGable predicate wrapping the column in a function | Rewrite as a range predicate. Check execution plan for "Index Scan" vs "Index Seek". |
| JOIN produces more rows than expected | Duplicate keys on the "one" side of the join | Verify uniqueness: `SELECT key, COUNT(*) FROM table GROUP BY key HAVING COUNT(*) > 1`. Deduplicate with `ROW_NUMBER` before joining. |
| Moving average looks wrong | Using `RANGE` frame instead of `ROWS` frame, or insufficient rows in early partitions | Use `ROWS BETWEEN N PRECEDING AND CURRENT ROW`. The first N-1 rows will have a shorter window — this is expected. |
| `daily_return` is NULL for the first row per symbol | `LAG()` returns NULL when there is no preceding row | Expected behavior. Filter with `WHERE daily_return IS NOT NULL` or use `COALESCE(LAG(close) OVER (...), close)` to default to the current close. |
| UNION ALL quality check shows `days_since_update > 1` | Pipeline did not run, or ran but failed before loading data | Check pipeline logs. Verify bronze `_ingested_at` timestamps. Re-run the ingestion job if the source data is available. |
| `NTILE(4)` assigns unequal group sizes | NTILE distributes rows as evenly as possible — with 50 rows, quartiles get 13, 13, 12, 12 rows | This is correct behavior. If you need equal-sized groups, use `PERCENT_RANK` ranges instead. |

## Cross-references

Related notes that extend or depend on the patterns covered here.

- [index-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/index-types-and-strategy) — full index internals, columnstore, fragmentation maintenance
- [sargable-queries](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/sargable-queries) — deep dive on SARGable vs non-SARGable predicates
- [bronze-layer-loading](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/bronze-layer-loading) — the ingestion pipeline that feeds the medallion architecture queried here
- [silver-transforms](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/silver-transforms) — production versions of the LAG-based daily return and gap-fill transforms
- [gold-transforms](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/gold-transforms) — production z-score normalization and composite ranking logic
- [secrets-management](https://alp78.github.io/elysium/06-GCP/Security/secrets-management) — production credential management (GCP Secret Manager)
- [01-bq-fundamentals](https://alp78.github.io/elysium/05-DB-Queries/BigQuery/bq-fundamentals) — BigQuery equivalent of every query pattern in this note
- [01-firestore-python](https://alp78.github.io/elysium/05-DB-Queries/Firestore/firestore-python) — Firestore NoSQL approach to the same data
