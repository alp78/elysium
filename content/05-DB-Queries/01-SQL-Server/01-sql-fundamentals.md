---
title: "01 - SQL Fundamentals"
tags: [sql-server, tsql, fundamentals]
aliases: [SQL fundamentals, T-SQL basics, SQL queries, SELECT, JOIN, WHERE, GROUP BY]
description: "SQL Server T-SQL fundamentals with executable examples and cell outputs — covers SELECT, filtering, joins, aggregation, subqueries, and set operations."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# SQL Fundamentals

> [!quote]
> "At the heart of every large or small database is the relational model, quietly making sense of chaos."
>
> — **C.J. Date**, *An Introduction to Database Systems* (2003)

> [!abstract]- Summary
>
> SQL Fundamentals is the first notebook in this SQL Server query series for data engineering: it uses a live Euro Stoxx 50 medallion dataset to establish how T-SQL explores schemas, shapes rowsets, joins layers, computes analytics, and turns raw market facts into checked silver and gold outputs.
>
> **Schema and dataset foundations**
> - covers schema exploration across `bronze`, `silver`, and `gold`, plus the OHLCV tables and dimensional context used throughout the note
>
> **Core query shaping**
> - covers `SELECT`, filtering, sorting, SQL Server vs BigQuery syntax differences, and `GROUP BY` / `HAVING` placement for per-stock and per-period summaries
>
> **Relational and analytical patterns**
> - covers cross-layer `JOIN` design, duplicate-safe join patterns, window functions such as `LAG`, `LEAD`, `ROW_NUMBER`, `RANK`, and `NTILE`, and chained CTE / subquery composition
>
> **Quality and medallion transforms**
> - covers `UNION ALL` quality gates, daily return calculations, gap-fill handling, z-score normalization, and bronze-to-silver-to-gold query anatomy
>
> **Operations and safety**
> - Warnings: lab-only credentials, `SELECT *`, `TOP` without `ORDER BY`, functions on indexed columns, `FLOAT` equality, non-unique or null join keys, row-preserving window functions, synthetic gap-filled rows, and repeated CTE execution
> - Recommendations table: 8 defaults covering covering indexes, SARGable predicates, safe division, `ROW_NUMBER` tie-breaking, quality gates, data types, isolation level, and `HAVING` vs `WHERE`
> - Troubleshooting: 7 failure modes covering unexpected empty results, slow indexed queries, duplicate-expanding joins, incorrect moving averages, first-row `LAG()` nulls, stale quality checks, and uneven `NTILE()` buckets

> [!note]- Glossary
>
> **T-SQL**
> - Microsoft SQL Server's dialect of SQL, adding server-specific syntax, built-in functions, and procedural constructs on top of ANSI SQL.
> - It matters because every executable example in this note is written in T-SQL, and several patterns differ from GoogleSQL or PostgreSQL equivalents.
>
> > [!warning] Dialect portability trap
> >
> > `TOP`, bracketed identifiers, `GETDATE()`, and `IDENTITY` are not portable defaults. Queries that run in SQL Server often need explicit rewrites before they work in BigQuery or PostgreSQL.
>
> ---
>
> **Medallion architecture**
> - A layered pipeline design that separates raw ingestion (`bronze`), cleaned and typed records (`silver`), and business-ready aggregates or scores (`gold`).
> - It matters because the note's queries move across those layers, and the schema a table lives in signals how trustworthy and transformed its data already is.
>
> > [!warning] Bronze is not curated
> >
> > Raw-layer data can still contain duplicates, nulls, and type issues. Reading bronze tables as if they were analysis-ready bypasses the exact validation and enrichment work the later sections demonstrate.
>
> ---
>
> **OHLCV**
> - The standard market-bar fields Open, High, Low, Close, and Volume, stored as one row per symbol per trading day.
> - It matters because the core fact tables in the note use this shape, and every aggregate, window, and transform example assumes that row model.
>
> > [!info] Close is unadjusted
> >
> > The dataset uses raw close prices rather than adjusted closes. That means splits or dividends are not retroactively baked into the `close` column.
>
> ---
>
> **Schema**
> - A namespace inside a SQL Server database that groups tables, views, procedures, and other objects under a shared qualifier.
> - It matters because every query in the note is schema-qualified, and `bronze`, `silver`, and `gold` are implemented as schemas rather than separate databases.
>
> > [!warning] Namespace does not equal dataset
> >
> > SQL Server schemas resemble BigQuery datasets conceptually, but they do not carry the same storage-location and billing semantics. Treat them as object namespaces, not as a full platform equivalent.
>
> ---
>
> **Window function**
> - A function evaluated over a related set of rows defined by `PARTITION BY` and `ORDER BY` while still returning one output row per input row.
> - It matters because the note relies on window functions for moving averages, daily returns, ranking, and deduplication without collapsing the underlying detail rows.
>
> > [!warning] Windows do not aggregate away rows
> >
> > A window calculation annotates each row; it does not shrink the result to one row per group. If you expect row collapse, you need `GROUP BY` or a post-filter such as `WHERE rn = 1`.
>
> ---
>
> **CTE**
> - A common table expression defined with `WITH name AS (...)` that names an intermediate query result for the duration of a single statement.
> - It matters because the note uses CTEs to stage multi-step logic such as sector heatmaps and cross-index comparisons without creating permanent objects.
>
> > [!warning] CTEs are not cached tables
> >
> > SQL Server usually inlines a CTE into the outer query. If the outer query references that logic multiple times, the engine may repeat the work instead of materializing it once.
>
> ---
>
> **SARGable**
> - A predicate shape that lets the optimizer match a filter to an index seek or another efficient access path instead of scanning and post-filtering rows.
> - It matters because the performance of date, symbol, and quality filters in this note depends on keeping predicates index-friendly.
>
> > [!warning] Functions hide indexes
> >
> > Wrapping the indexed column side of a predicate with `YEAR()`, `CAST()`, `UPPER()`, or similar functions often disables seeks. Rewrite the constant or the range instead.
>
> ---
>
> **Covering index**
> - An index whose key and included columns together satisfy a query without forcing an extra lookup to the base table.
> - It matters because many of the note's analytical reads can be served efficiently from an index on `(symbol, date)` plus included price and volume columns.
>
> > [!warning] Coverage has write cost
> >
> > Every additional included or keyed column makes the index heavier to maintain on `INSERT`, `UPDATE`, and `DELETE`. A covering index is useful only when the read pattern is frequent enough to justify that cost.
>
> ---
>
> **Z-score**
> - A normalized value computed as `(value - mean) / standard_deviation`, showing how far a result sits above or below its peer-group average.
> - It matters because the gold-layer scoring examples convert raw metrics into comparable standardized scores before ranking stocks.
>
> > [!info] Relative, not absolute
> >
> > A high z-score only means the row is high relative to its comparison group. Change the group and the same raw value can produce a different z-score.
>
> ---
>
> **`ROW_NUMBER()`**
> - A window ranking function that assigns a unique sequential integer to each row inside a partition according to the specified ordering.
> - It matters because the note uses it as the deterministic row-picker for deduplication and latest-row selection patterns.
>
> > [!warning] Ties need a rule
> >
> > If the `ORDER BY` inside `ROW_NUMBER()` is not fully deterministic, repeated executions can choose different rows as `rn = 1`. Add a stable tie-breaker when correctness depends on a single winner.
>
> ---
>
> **Gap fill / `is_filled`**
> - A transform that inserts synthetic rows for missing trading days by carrying forward the prior close and marking the generated record with `is_filled = 1`.
> - It matters because return logic and quality checks must distinguish real market observations from continuity rows added for calendar completeness.
>
> > [!danger] Synthetic rows skew metrics
> >
> > Gap-filled records are not trades. If they are counted as real observations in volume sums or return logic, downstream analytics become silently wrong.
>
> ---
>
> **`UNION ALL` quality gate**
> - A validation pattern that stacks multiple checks into one result set so a pipeline step can report all failures in a single query execution.
> - It matters because the note uses this shape to verify freshness, nulls, duplicates, and transform invariants after bronze-to-silver and silver-to-gold loads.
>
> > [!info] Pipeline-friendly output
> >
> > `UNION ALL` preserves every failing check as its own row. That makes it easy to drive notebook inspection or automated "fail the load if any row returns" logic.
>
> ---
>
> **SNAPSHOT isolation**
> - A row-versioning isolation mode that lets readers see a transactionally consistent snapshot without blocking concurrent writers.
> - It matters because the note's recommendations position snapshot-style reads as the safer default for analytical queries against actively loaded tables.
>
> > [!warning] Default reads still block
> >
> > SQL Server defaults to `READ COMMITTED`, which can block readers behind writers. Snapshot behavior only appears when the database is configured to support it and the workload opts into that model.
>
> ---
>
> **`NTILE()`**
> - A window function that distributes ordered rows into a fixed number of buckets as evenly as possible.
> - It matters because the note uses it for ranking and segmentation patterns where approximate quantile buckets are more useful than exact percentile math.
>
> > [!info] Buckets are rarely equal
> >
> > `NTILE()` balances row counts as evenly as it can, but remainders still have to go somewhere. Uneven bucket sizes are expected behavior, not a bug.
>
> ---
>
> **`NULLIF()` safe division**
> - A defensive expression pattern that converts a zero denominator to `NULL` before division so the statement does not raise a divide-by-zero error.
> - It matters because ratio and return calculations in the note depend on safe arithmetic over imperfect financial data.
>
> > [!warning] Ratios need guardrails
> >
> > Zero and null denominators are common in real datasets. If division is not protected, a single bad row can fail the query or silently distort results depending on expression type and settings.
>
> ---
>
> **Cross-layer join**
> - A join that combines tables from different medallion layers, such as enriching a silver fact table with gold scores or dimensional metadata.
> - It matters because many examples in the note are not simple same-layer lookups; they assemble analytical context by joining differently curated objects.
>
> > [!warning] Join cardinality matters
> >
> > Cross-layer joins are only safe when the dimensional side is genuinely one-to-one for the key and time grain in use. If not, row counts inflate and downstream aggregates become unreliable.

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

### Schema Exploration | List All Tables

This query joins `sys.tables`, `sys.schemas`, and `sys.partitions` to list every table with its schema name and row count. The medallion layers (bronze, silver, gold) are implemented as SQL Server schemas. The filter `index_id IN (0, 1)` targets heaps (0) and clustered indexes (1) to avoid double-counting rows from non-clustered indexes.

#### List all tables with row counts per medallion schema

First step when connecting to an unfamiliar database or verifying that a pipeline deployment created the expected tables. It is typically triggered by initial database orientation, post-deployment verification, or onboarding a new team member. Read-only T-SQL query against system catalog views. No permissions beyond `VIEW DEFINITION` required. Safe to run in production. Produce a complete inventory of tables across all medallion-layer schemas with their row counts, confirming the expected bronze/silver/gold structure exists and is populated.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `schema` | `sys.schemas.name` | sysname | The schema (namespace) the table belongs to — maps to a medallion layer in this architecture. |
| `table` | `sys.tables.name` | sysname | The table name within its schema. |
| `row_count` | `sys.partitions.rows` | bigint | Approximate row count from the partition metadata. Exact after a statistics update; may lag slightly after large bulk loads. |

> [!info]- Clause-by-clause breakdown
>
> | Clause | What it does |
> |---|---|
> | `FROM sys.tables t` | Starts from the catalog of all user tables in the current database. |
> | `JOIN sys.schemas s ON t.schema_id = s.schema_id` | Resolves the numeric `schema_id` to a human-readable schema name. |
> | `JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0, 1)` | Joins partition metadata. `index_id = 0` = heap (no clustered index), `index_id = 1` = clustered index. Filtering to these two avoids double-counting rows that also appear in non-clustered index partitions. |
> | `ORDER BY s.name, t.name` | Alphabetical by schema then table — groups medallion layers together. |

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

| schema | table | row_count |
|---|---|---|
| bronze | dim_country | 212 |
| bronze | dim_index | 4 |
| bronze | eurostoxx50_ohlcv | 50 |
| bronze | index_dim | 169 |
| bronze | oil20_ohlcv | 19 |

The output confirms the three-layer medallion structure. The bronze layer contains raw ingested tables: `dim_country` (212 country reference rows), `dim_index` (4 index definitions), `eurostoxx50_ohlcv` (50 rows — this is the raw daily batch, not the full history), `index_dim` (169 current and historical index membership rows), and `oil20_ohlcv` (19 raw Oil & Gas 20 rows). Silver and gold tables (not shown in this truncated view) contain the cleaned and analytical outputs respectively.

### Schema Exploration | Inspect Column Types

The `INFORMATION_SCHEMA.COLUMNS` view is the ANSI-standard metadata interface — portable across SQL Server, PostgreSQL, and MySQL. It exposes column names, data types, maximum lengths, and nullability. Check data types before writing queries — `float` vs `int` vs `varchar` changes how you aggregate and join. The alternative `sys.columns` view is SQL Server-specific but exposes additional details like computed column definitions and default constraints.

#### Inspect column names, types, and nullability with INFORMATION_SCHEMA

After identifying a table in the schema inventory, before writing any queries against it. It is typically triggered by need to verify column data types (e.g., is `close` stored as `float` or `decimal`?), check nullability constraints, or confirm column naming conventions. Read-only query against the ANSI-standard `INFORMATION_SCHEMA.COLUMNS` view. No special permissions required. Portable across SQL Server, PostgreSQL, and MySQL. Enumerate column names, data types, maximum lengths, and nullability for a specific table — the prerequisite for writing correct `SELECT`, `JOIN`, and `WHERE` clauses.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `COLUMN_NAME` | `INFORMATION_SCHEMA.COLUMNS.COLUMN_NAME` | nvarchar | The column name as defined in the `CREATE TABLE` statement. |
| `DATA_TYPE` | `INFORMATION_SCHEMA.COLUMNS.DATA_TYPE` | nvarchar | The SQL Server data type (`int`, `varchar`, `float`, `date`, etc.). Does not include precision/scale — check `NUMERIC_PRECISION` and `NUMERIC_SCALE` for decimal types. |
| `max_len` | `INFORMATION_SCHEMA.COLUMNS.CHARACTER_MAXIMUM_LENGTH` | int | Maximum character length for string types (`varchar`, `nvarchar`). `None` (NULL) for non-string types. |
| `IS_NULLABLE` | `INFORMATION_SCHEMA.COLUMNS.IS_NULLABLE` | varchar(3) | `YES` if the column allows NULLs, `NO` if it has a `NOT NULL` constraint. |

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

| COLUMN_NAME | DATA_TYPE | max_len | IS_NULLABLE |
|---|---|---|---|
| id | int | None | NO |
| symbol | varchar | 20 | NO |
| date | date | None | NO |
| open | float | None | YES |
| high | float | None | YES |

The `silver.eurostoxx50_ohlcv` table uses `int` for the surrogate key (`id`), `varchar(20)` for ticker symbols, `date` for trading dates, and `float` for all OHLCV price columns. The three key columns (`id`, `symbol`, `date`) are `NOT NULL`; price columns (`open`, `high`, `low`, `close`) allow NULLs to accommodate gap-filled rows where only the carried-forward `close` is populated.

| Column | Value | Meaning | Implication |
|---|---|---|---|
| `IS_NULLABLE` | `NO` | Column has a `NOT NULL` constraint — every row must have a value. | Safe to use in `JOIN` keys and `WHERE` predicates without NULL guards. |
| `IS_NULLABLE` | `YES` | Column allows NULL values. | Must use `IS NULL` / `IS NOT NULL` for comparisons. Aggregates (`AVG`, `SUM`) silently skip NULLs. `JOIN` on this column may lose rows. |

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

### SELECT, Filtering & Sorting | Basic SELECT with WHERE

The fundamental query: pick columns, filter rows, sort results. `TOP N` limits output (SQL Server). PostgreSQL uses `LIMIT N`.

> [!warning] TOP without ORDER BY is non-deterministic
>
> `SELECT TOP 10 * FROM table` returns an ARBITRARY 10 rows — not the first 10, not the newest 10. The engine picks whichever rows it finds first based on the execution plan. Always pair `TOP` with `ORDER BY` unless you genuinely don't care which rows you get.

> [!success] Safe Pattern
>
> Always pair `TOP N` with `ORDER BY` to get a deterministic result: `SELECT TOP 10 ... ORDER BY date DESC`. If you only need to check whether any row exists (e.g., in an `IF EXISTS` guard), use `SELECT TOP 1 1 FROM ...` with no `ORDER BY` — that is the one case where order genuinely doesn't matter.

#### Retrieve the 10 most recent ASML trading days

Whenever you need to inspect the most recent price data for a specific stock — verifying that today's data loaded, checking the latest close, or confirming the date range available. It is typically triggered by ad-hoc exploration, post-load verification, or building a quick price snapshot for a single symbol. Read-only T-SQL query against the silver OHLCV table. No special permissions. Deterministic with `ORDER BY date DESC`. Retrieve the most recent OHLCV rows for a single stock, sorted by date descending, to inspect current price levels and trading activity.

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

| symbol | date | open | high | low | close | volume |
|---|---|---|---|---|---|---|
| ASML.AS | 2026-03-12 | 1194.8 | 1202.2 | 1187.8 | 1190.8 | 128223 |
| ASML.AS | 2026-03-11 | 1188.4 | 1210.8 | 1174.0 | 1198.8 | 562904 |
| ASML.AS | 2026-03-10 | 1188.4 | 1208.4 | 1172.2 | 1200.0 | 800815 |
| ASML.AS | 2026-03-09 | 1072.0 | 1147.6 | 1060.2 | 1147.6 | 689086 |
| ASML.AS | 2026-03-06 | 1186.0 | 1192.6 | 1112.8 | 1147.0 | 857271 |

ASML's most recent trading days show prices in the 1,147–1,200 range. The March 9 session opened at 1,072 and closed at 1,147.6 — a significant intraday rally of ~7%. Volume on that day (689K) was elevated compared to the quiet March 12 session (128K), suggesting the rally was driven by active institutional participation.

### SELECT, Filtering & Sorting | Multi-Condition WHERE

Combine conditions with `AND` / `OR`. Use `ABS()` for absolute values. This query finds high-volume days (over 5 million shares) with price swings exceeding 3% — potential breakout or crash days.

> [!warning] FLOAT is approximate — ROUND() can surprise
>
> `FLOAT` stores binary approximations. `ROUND(3.145, 2)` on a `FLOAT` column may return `3.14` instead of `3.15`. For financial calculations or exact comparisons, use `DECIMAL(18, 4)`. OHLCV prices stored as `FLOAT` are acceptable for analytics but not for accounting.

> [!success] Safe Pattern
>
> Use `DECIMAL(18, 4)` or `DECIMAL(18, 8)` for financial values that require exact arithmetic (NAV, index weights, fees). Use `FLOAT` only for analytics columns (daily returns, z-scores, volatility) where a sub-penny binary approximation error is acceptable. Never use `=` to compare `FLOAT` columns — use `ABS(a - b) < 0.0001` instead.

#### Find high-volume days with large intraday price swings

When screening for breakout or crash days — sessions with extreme intraday price movement on high volume. It is typically triggered by market event analysis, anomaly detection, or building a dataset of high-impact trading days for signal backtesting. Read-only T-SQL query against `silver.eurostoxx50_ohlcv`. Combines three `WHERE` conditions with `AND`. The `ABS()` function on the computed expression is acceptable in `WHERE` because it operates on an expression, not a bare indexed column. Identify trading sessions where volume exceeded 5 million shares and the open-to-close price swing exceeded 3% — potential breakout or crash events worth further investigation.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | `silver.eurostoxx50_ohlcv.symbol` | varchar(20) | Ticker symbol identifying the stock and exchange (e.g., `ASML.AS` = ASML on Amsterdam). |
| `date` | `silver.eurostoxx50_ohlcv.date` | date | The trading session date. |
| `close` | `silver.eurostoxx50_ohlcv.close` | float | The last traded price of the day. |
| `volume` | `silver.eurostoxx50_ohlcv.volume` | bigint | Total shares traded during the session. |
| `daily_move_pct` | Computed: `([close] - [open]) / [open] * 100` | float | Intraday percentage change from open to close. Positive = price rose; negative = price fell. |

> [!info]- Clause-by-clause breakdown
>
> | Clause | What it does |
> |---|---|
> | `WHERE volume > 5000000` | Filters to high-liquidity sessions only — excludes thinly traded days where large percentage swings are common but not meaningful. |
> | `AND ABS(([close] - [open]) / [open]) > 0.03` | Requires the absolute open-to-close move to exceed 3%. `ABS()` captures both rallies (positive) and sell-offs (negative). |
> | `AND date >= '2025-01-01'` | Limits to recent data. This is a SARGable range predicate on the indexed `date` column. |
> | `ORDER BY ABS(([close] - [open]) / [open]) DESC` | Largest absolute moves first — the most extreme events appear at the top. |

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

| symbol | date | close | volume | daily_move_pct |
|---|---|---|---|---|
| IFX.DE | 2025-04-10 | 25.78 | 11549391 | -13.78 |
| ENR.DE | 2025-04-07 | 48.56 | 8552960 | 13.59 |
| SAN.MC | 2025-04-07 | 5.243 | 120129181 | 12.87 |
| SAN.MC | 2025-04-10 | 5.662 | 63808362 | -11.14 |
| DSY.PA | 2026-02-16 | 15.96 | 7671987 | -10.81 |

The results reveal extreme single-day events: Infineon (IFX.DE) dropped 13.78% on April 10, 2025 with 11.5M shares traded, while Siemens Energy (ENR.DE) rallied 13.59% three days earlier on April 7 with 8.5M shares. Banco Santander (SAN.MC) appears twice — a +12.87% rally on April 7 followed by a -11.14% reversal on April 10, with volume exceeding 120M and 63M respectively, characteristic of a volatile cluster around a macro event.

## Aggregation (GROUP BY)

`GROUP BY` collapses rows sharing common values into summary rows, evaluated after `WHERE` filtering. SQL Server chooses between two physical operators — **stream aggregate** (efficient when input is pre-sorted by the grouping key via an index) and **hash match aggregate** (builds a hash table in memory, spills to tempdb if it exceeds the memory grant). Pairing `GROUP BY` with a covering index on the grouping columns avoids a separate sort step. See [index-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/index-types-and-strategy) for index design guidance.

### Aggregation GROUP BY | Aggregate by Stock

`GROUP BY` collapses rows into groups. Aggregate functions (`AVG`, `COUNT`, `SUM`, `MIN`, `MAX`) summarize each group. This query ranks stocks by average daily trading volume — a standard liquidity measure. The `CAST(volume AS FLOAT)` prevents integer overflow on large volume sums before the average is computed.

#### Rank stocks by average daily trading volume

When building a liquidity ranking across the index — identifying which stocks are the most and least actively traded. It is typically triggered by index rebalancing analysis, liquidity screening, or sizing trade execution assumptions. Read-only T-SQL query. Groups all rows by `symbol` across the full OHLCV history. The `CAST(volume AS FLOAT)` prevents integer overflow when summing large volume values before averaging. Produce a per-stock summary of average daily volume, average close price, and date range — a standard liquidity profile for the index.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | `silver.eurostoxx50_ohlcv.symbol` | varchar(20) | Ticker symbol (grouping key). |
| `trading_days` | Computed: `COUNT(*)` | int | Number of rows (trading sessions) for this stock in the dataset. |
| `avg_volume` | Computed: `AVG(CAST(volume AS FLOAT))` | float | Mean daily trading volume across all sessions. Cast to `FLOAT` before averaging to prevent integer overflow. |
| `avg_close` | Computed: `AVG([close])` | float | Mean closing price across all sessions — a rough price-level indicator. |
| `first_date` | Computed: `MIN(date)` | date | Earliest trading date in the dataset for this stock. |
| `last_date` | Computed: `MAX(date)` | date | Most recent trading date — useful for detecting stale or incomplete data. |

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

| symbol | trading_days | avg_volume | avg_close | first_date | last_date |
|---|---|---|---|---|---|
| ISP.MI | 1321 | 87588601.0 | 3.15 | 2021-01-04 | 2026-03-12 |
| SAN.MC | 1329 | 41770987.0 | 4.43 | 2021-01-04 | 2026-03-12 |
| ENEL.MI | 1321 | 24678699.0 | 6.82 | 2021-01-04 | 2026-03-12 |
| BBVA.MC | 1329 | 16654457.0 | 8.65 | 2021-01-04 | 2026-03-12 |
| UCG.MI | 1321 | 13903710.0 | 28.46 | 2021-01-04 | 2026-03-12 |

The liquidity ranking reveals a strong inverse correlation between share price and volume: the three most-traded stocks (ISP.MI at 87.6M avg daily volume, SAN.MC at 41.8M, ENEL.MI at 24.7M) all have low share prices (EUR 3.15, 4.43, 6.82). This is typical in European markets where retail participation drives volume in low-priced financials and utilities. The Italian stocks (ISP.MI, UCG.MI, ENEL.MI) trade on the Milan exchange, which has 1,321 trading days vs 1,329 for Madrid (SAN.MC, BBVA.MC) — an 8-day difference reflecting different exchange holiday schedules.

> [!tip] WHERE vs HAVING Filter Placement
>
> `WHERE volume > 1000000` removes rows BEFORE grouping — fewer rows to aggregate, faster query. `HAVING AVG(volume) > 1000000` computes the average for every group, then discards groups that don't qualify. Put filters in `WHERE` whenever possible; use `HAVING` only for conditions on aggregate results.

### Aggregation GROUP BY | Aggregate by Time Period

Group by `YEAR(date), MONTH(date)` to build time-series summaries. Shows monthly high/low/average price and total volume — the basis for monthly performance reports.

> [!warning] Functions on columns kill SARGability
>
> `WHERE YEAR(date) = 2025` cannot use an index on `date` — the engine evaluates `YEAR()` on every row. Rewrite as `WHERE date >= '2025-01-01' AND date < '2026-01-01'`. Functions in `GROUP BY` are fine (no index needed). Functions in `WHERE` are the problem. See [sargable-queries](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/sargable-queries).

> [!success] Safe Pattern
>
> Replace any function-on-column `WHERE` predicate with a range: `WHERE date >= '2025-01-01' AND date < '2026-01-01'` instead of `WHERE YEAR(date) = 2025`. For string patterns, use `WHERE symbol LIKE 'ASML%'` rather than `WHERE LEFT(symbol, 4) = 'ASML'`. This allows the engine to seek directly into the index rather than scanning every row.

#### Build a monthly time-series summary per stock

When building periodic performance reports — monthly, quarterly, or yearly summaries of price range and trading activity. It is typically triggered by scheduled reporting, trend analysis, or comparing month-over-month price behavior for a stock. Read-only T-SQL query. Groups by `YEAR(date)` and `MONTH(date)` — these function calls in `GROUP BY` are acceptable (no index needed for grouping, only for filtering). The `WHERE` uses a SARGable range predicate on `date`. Produce a monthly time-series profile for a single stock: trading day count, price range (high/low), average close, and total volume — the foundation for monthly performance dashboards.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `yr` | Computed: `YEAR(date)` | int | Calendar year extracted from the trading date. |
| `mo` | Computed: `MONTH(date)` | int | Calendar month (1–12). |
| `days` | Computed: `COUNT(*)` | int | Number of trading sessions in the month. Typically 20–23 for European exchanges. |
| `month_low` | Computed: `MIN([close])` | float | Lowest closing price during the month. |
| `month_high` | Computed: `MAX([close])` | float | Highest closing price during the month. The spread `month_high - month_low` measures monthly volatility. |
| `avg_close` | Computed: `AVG([close])` | float | Mean closing price for the month. |
| `total_volume` | Computed: `SUM(volume)` | bigint | Total shares traded during the month across all sessions. |

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

| yr | mo | days | month_low | month_high | avg_close | total_volume |
|---|---|---|---|---|---|---|
| 2025 | 1 | 22 | 646.6 | 748.1 | 714.71 | 19121187 |
| 2025 | 2 | 20 | 678.6 | 737.9 | 713.04 | 15276962 |
| 2025 | 3 | 21 | 606.0 | 690.3 | 656.58 | 17508550 |
| 2025 | 4 | 20 | 550.0 | 619.7 | 581.0 | 22544929 |
| 2025 | 5 | 21 | 601.5 | 686.6 | 650.18 | 13112045 |

ASML's monthly profile shows a sharp drawdown from January (avg 714.71) through April (avg 581.0) — a ~19% decline. April also saw the highest total volume (22.5M) despite having only 20 trading days, indicating heavy selling pressure. The monthly high-low spread widened from ~101 in January to ~85 in April, but the range was shifted downward, confirming a sell-off rather than sideways volatility.

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

### JOIN Across Medallion Layers | OHLCV + Dimension (Silver)

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

When building a snapshot of current prices enriched with company metadata — the typical shape of a stock screener or dashboard query. It is typically triggered by dashboard refresh, end-of-day reporting, or building a denormalized export for downstream consumers. Read-only T-SQL query joining silver OHLCV (price facts) with silver dimension (company metadata). The inner subquery uses `ROW_NUMBER()` to pick only the latest price per symbol, preventing row multiplication. The `is_current = 1` filter enforces SCD Type 2 semantics on the dimension. Produce a single row per stock with the latest close price, trading date, volume, company name, sector, and country — ready for dashboard rendering or export.

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

| symbol | short_name | sector | country | last_close | last_date | volume |
|---|---|---|---|---|---|---|
| RMS.PA | HERMES INTL | Consumer Cyclical | France | 1906.0 | 2026-03-12 | 18681 |
| RHM.DE | RHEINMETALL AG | Industrials | Germany | 1551.5 | 2026-03-12 | 158741 |
| ASML.AS | ASML HOLDING | Technology | Netherlands | 1190.8 | 2026-03-12 | 128223 |
| ADYEN.AS | ADYEN | Technology | Netherlands | 925.7 | 2026-03-12 | 27887 |
| ARGX.BR | ARGENX SE | Healthcare | Netherlands | 626.6 | 2026-03-12 | 14083 |

The top 5 by price are dominated by luxury (Hermès at EUR 1,906), defense (Rheinmetall at EUR 1,551.5), and technology (ASML at EUR 1,190.8). All rows show `last_date = 2026-03-12`, confirming a complete data load for the most recent trading session. Volume varies dramatically — Hermès at 18.7K shares vs Rheinmetall at 158.7K — reflecting the price-volume inverse relationship typical of high-priced European equities.

### JOIN Across Medallion Layers | Gold Scores + Dimension (Cross-Layer)

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

When generating the daily stock ranking dashboard — the primary analytical output of the scoring engine. It is typically triggered after the gold scoring pipeline completes, or on demand for ad-hoc portfolio analysis. Read-only cross-layer T-SQL query joining `gold.scores_daily` with `silver.index_dim`. The scalar subquery `(SELECT MAX(score_date) ...)` dynamically targets the latest scoring date. The three-part join key (`symbol`, `_index`, `is_current = 1`) prevents row multiplication from SCD Type 2 history. Produce a ranked dashboard of all Euro Stoxx 50 stocks with composite score, sub-score breakdown (value, momentum, sentiment), current price, and index weight.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `rank` | `gold.scores_daily.composite_rank` | int | Overall rank within the index — 1 = highest composite score. |
| `score` | `gold.scores_daily.composite_score` | float | Weighted combination of value, momentum, and sentiment sub-scores. Range typically -1 to +1. |
| `value` | `gold.scores_daily.relative_value_score` | float | Sub-score measuring undervaluation relative to peers. Positive = cheap, negative = expensive. |
| `momentum` | `gold.scores_daily.momentum_score` | float | Sub-score measuring price trend strength. Positive = uptrend, negative = downtrend. |
| `sentiment` | `gold.scores_daily.sentiment_score` | float | Sub-score measuring analyst/market sentiment. Positive = bullish consensus. |
| `weight_pct` | Computed: `index_weight * 100` | float | The stock's weight in the index as a percentage. |

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

| rank | symbol | short_name | sector | score | value | momentum | sentiment | current_price | weight_pct |
|---|---|---|---|---|---|---|---|---|---|
| 1 | BNP.PA | BNP PARIBAS ACT.A | Financial Services | 0.6796 | 1.497 | 0.46 | 0.081 | 87.44 | 1.94 |
| 2 | VOW.DE | VOLKSWAGEN AG | Consumer Cyclical | 0.5756 | 1.028 | -0.382 | 1.081 | 92.85 | 0.93 |
| 3 | DTE.DE | DEUTSCHE TELEKOM AG | Communication Services | 0.487 | 0.226 | 0.706 | 0.529 | 32.55 | 3.13 |
| 4 | TTE.PA | TOTALENERGIES | Energy | 0.3913 | 0.585 | 1.307 | -0.719 | 69.8 | 2.95 |
| 5 | ABI.BR | AB INBEV | Consumer Defensive | 0.3852 | 0.251 | 0.537 | 0.368 | 62.76 | 2.43 |

BNP Paribas leads the ranking (score 0.6796) driven by an exceptionally strong value sub-score (1.497) — indicating deep undervaluation relative to peers. Volkswagen ranks #2 with the highest sentiment score (1.081) but negative momentum (-0.382), suggesting analysts are bullish despite a declining price trend. TotalEnergies (#4) shows the strongest momentum (1.307) but the worst sentiment (-0.719) — a classic divergence where price action and analyst consensus disagree. Deutsche Telekom (#3) carries the largest index weight (3.13%), making it the most impactful position in any index-tracking portfolio.

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

### Window Functions | Moving Averages (SMA)

A **moving average** smooths price data over N days. Used for trend detection:

- **SMA 30** (short-term): responsive to recent price action
- **SMA 90** (long-term): filters out noise
- Price above SMA = bullish momentum. Below = bearish.

`AVG() OVER (ROWS BETWEEN N PRECEDING AND CURRENT ROW)` — the window slides forward one row at a time. The `OVER` clause has three parts: `PARTITION BY symbol` groups rows by stock, `ORDER BY date` establishes the time sequence within each group, and `ROWS BETWEEN 29 PRECEDING AND CURRENT ROW` defines a sliding window of exactly 30 rows (29 preceding + current).

#### Compute 30-day and 90-day SMAs with a sliding window

When analyzing a stock's trend direction — whether it is trading above or below its short-term and long-term moving averages. It is typically triggered by technical analysis, signal generation for momentum scoring, or building a price chart overlay for a dashboard. Read-only T-SQL query against `silver.eurostoxx50_ohlcv`. Uses `AVG() OVER` with a sliding `ROWS BETWEEN N PRECEDING AND CURRENT ROW` frame. First 29/89 rows will have shorter windows — expected behavior. Attach a 30-day and 90-day SMA to each trading day row for a single stock, enabling trend detection by comparing current price to both averages.

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

| symbol | date | close | sma_30 | sma_90 |
|---|---|---|---|---|
| ASML.AS | 2026-03-12 | 1190.8 | 1204.41 | 1052.59 |
| ASML.AS | 2026-03-11 | 1198.8 | 1204.45 | 1049.65 |
| ASML.AS | 2026-03-10 | 1200.0 | 1204.31 | 1046.53 |
| ASML.AS | 2026-03-09 | 1147.6 | 1204.89 | 1043.62 |
| ASML.AS | 2026-03-06 | 1147.0 | 1205.91 | 1041.08 |

### Window Functions | LAG / LEAD Compare Rows

**LAG(col, N)** returns the value from N rows **before** the current row.
**LEAD(col, N)** returns the value from N rows **after**.

Use cases:

- **Daily returns**: `(close - LAG(close)) / LAG(close)`
- **Gap detection**: `DATEDIFF(DAY, LAG(date), date)` — if >1, there was a holiday/weekend
- **Trend direction**: compare today vs yesterday

#### Calculate daily return percentage and detect calendar gaps

When computing daily returns for momentum scoring or detecting missing trading days in the time series. It is typically triggered by silver-layer data validation, return calculation for the scoring pipeline, or auditing the gap-fill logic after ingestion. Read-only T-SQL query against `silver.eurostoxx50_ohlcv`. Uses `LAG()` three times in one SELECT — SQL Server evaluates each independently. A `days_gap > 1` indicates a weekend or holiday; `days_gap = 3` is a typical Friday-to-Monday gap. Produce daily return percentage and calendar gap size for each trading row, enabling both return-series construction and date-continuity validation.

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

| symbol | date | close | prev_close | daily_return_pct | days_gap |
|---|---|---|---|---|---|
| ASML.AS | 2026-03-12 | 1190.8 | 1198.8 | -0.67 | 1 |
| ASML.AS | 2026-03-11 | 1198.8 | 1200.0 | -0.1 | 1 |
| ASML.AS | 2026-03-10 | 1200.0 | 1147.6 | 4.57 | 1 |
| ASML.AS | 2026-03-09 | 1147.6 | 1147.0 | 0.05 | 3 |
| ASML.AS | 2026-03-06 | 1147.0 | 1186.0 | -3.29 | 1 |

### Window Functions | RANK / DENSE_RANK / NTILE Ranking

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

At the start of a new period (quarterly, annually) to benchmark stock performance and classify index members into performance quartiles. It is typically triggered by post-rebalancing analysis, performance attribution, or seeding the quartile field in the gold scoring output. Read-only T-SQL query using two chained CTEs and a self-join on `silver.eurostoxx50_ohlcv` to pair each stock's first and last price of the year. `NULLIF` prevents divide-by-zero for stocks with a zero opening price. Compute YTD return per stock and assign both a performance rank (best and worst) and a quartile bucket — the foundation for quartile-based factor analysis in the scoring engine.

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

| symbol | ytd_return | rank_best | rank_worst | quartile |
|---|---|---|---|---|
| ENI.MI | 0.3042 | 1 | 50 | 1 |
| ENR.DE | 0.2508 | 2 | 49 | 1 |
| TTE.PA | 0.2437 | 3 | 48 | 1 |
| ASML.AS | 0.2073 | 4 | 47 | 1 |
| AD.AS | 0.1772 | 5 | 46 | 1 |

## CTEs & Subqueries

A **Common Table Expression** (CTE) is a named temporary result set defined with `WITH name AS (SELECT ...)` that exists only for the duration of the enclosing statement. CTEs improve readability by breaking complex queries into named logical steps. Unlike temp tables, CTEs are not materialized in SQL Server — the optimizer inlines them into the outer query plan and may re-execute the CTE logic for each reference. For multi-step analytical queries like sector heatmaps or cross-index comparisons, chaining multiple CTEs reads top-to-bottom like a data pipeline.

> [!info] Cross-engine note
>
> Both SQL Server and BigQuery support CTEs including recursive CTEs (BigQuery caps recursion at 500 iterations by default). Firestore has no query composition mechanism — complex data retrieval requires multiple sequential SDK calls orchestrated in application code.

### CTEs & Subqueries | Sector Heatmap

A **CTE** (`WITH name AS (SELECT ...)`) is a named temporary result set. Chaining CTEs makes complex queries readable — each step has a name.

This builds a sector heatmap: average score, best/worst rank per sector.

#### Build a sector heatmap with chained CTEs

After the daily gold scoring pipeline completes, to summarize performance and scoring by sector for reporting or investment committee review. It is typically triggered by daily dashboard refresh, sector rotation analysis, or comparing sector-level momentum and value signals. Read-only T-SQL query using two chained CTEs. `latest_scores` joins `gold.scores_daily` with `silver.index_dim` to retrieve the most recent scoring day. `sector_stats` aggregates by sector. The `SELECT MAX(score_date)` scalar subquery is evaluated once by the optimizer. Produce a sector-level heatmap: stock count, average composite/value/momentum scores, and best-to-worst rank range — for identifying which sectors are scoring highest in the current market regime.

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

| sector | stocks | avg_score | avg_value | avg_momentum | best_rank | worst_rank |
|---|---|---|---|---|---|---|
| Communication Services | 1 | 0.487 | 0.226 | 0.7064 | 3 | 3 |
| Energy | 2 | 0.3286 | 0.5744 | 1.6426 | 4 | 11 |
| Healthcare | 4 | 0.0812 | -0.07 | -0.3722 | 10 | 32 |
| Technology | 5 | 0.0522 | 0.0128 | -0.6536 | 6 | 47 |
| Industrials | 10 | 0.0504 | 0.0 | -0.0204 | 8 | 43 |

### CTEs & Subqueries | Chained CTEs Cross-Index Comparison

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

When reviewing cross-index performance for a daily briefing or portfolio attribution — comparing YTD return, rolling volatility, valuation, and yield across all four tracked indices. It is typically triggered by daily or weekly cross-index reporting, index selection decisions, or benchmarking the Euro Stoxx 50 against peer indices. Read-only T-SQL query using a single CTE with `ROW_NUMBER()` to pick the latest performance record per index. Joins to `bronze.dim_index` for human-readable display names. No hardcoded dates. Produce a one-row-per-index comparison of YTD return, 30-day return and volatility, stock count, average P/E, and dividend yield — the key metrics for cross-index analysis in a single result set.

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

| _index | display_name | perf_date | ytd_pct | ret_30d_pct | vol_30d_pct | stocks_count | avg_pe | div_yield_pct |
|---|---|---|---|---|---|---|---|---|
| oil_20 | Oil & Gas 20 | 2026-03-11 | 27.7 | 15.33 | 21.93 | 19 | 16.1 | 3.28 |
| stoxx_asia_50 | STOXX Asia/Pacific 50 | 2026-03-12 | 5.45 | 2.68 | 23.3 | 50 | 15.8 | 1.96 |
| stoxx_usa_50 | STOXX USA 50 | 2026-03-11 | 3.71 | 0.6 | 13.32 | 50 | 20.8 | 1.42 |
| euro_stoxx_50 | Euro Stoxx 50 | 2026-03-12 | -2.39 | -2.08 | 18.06 | 50 | 14.0 | 2.9 |

## Data Quality Checks

Quality gates validate data integrity at each pipeline stage — catching NULLs, invalid values, and freshness delays before data is promoted downstream. Stacking multiple checks into a single `UNION ALL` result set gives a compact pass/fail summary that can be evaluated programmatically after every load.

### Data Quality Checks | Structural & Operational Validation

Every pipeline needs quality gates. The checks below are split into two categories: **structural** (NULLs, negative prices, impossible high/low values) and **operational** (gap-fill count, data freshness). `UNION ALL` stacks them into a single result set. Run this after every load — any non-zero value needs investigation before promoting to gold.

> [!tip] UNION ALL Quality Gate Pattern
>
> Stack multiple checks into one result set with `UNION ALL`. Each check returns a named row with an issue count. Run after every load — any non-zero value needs investigation before promoting to gold.

#### Run structural quality checks (NULLs, negatives, impossible values)

Immediately after every bronze-to-silver load, before promoting data to gold. It is typically triggered by automated post-load validation step in the silver ingestion pipeline, or ad-hoc investigation when downstream anomalies are detected. Read-only T-SQL query stacking three `SELECT ... UNION ALL` checks against `silver.eurostoxx50_ohlcv`. Each check returns one named row with an issue count. Any non-zero result indicates a data integrity failure. Detect the three most critical structural defects — null prices (incomplete rows), negative prices (bad source data), and high < low (physically impossible OHLCV values) — in a single compact result set.

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

After every pipeline load, alongside the structural checks — or on demand when freshness alerts fire. It is typically triggered by scheduled post-load validation, SLA monitoring, or investigation of stale dashboard data. Read-only T-SQL query using `UNION ALL` against `silver.eurostoxx50_ohlcv`. `is_filled = 1` identifies synthetic gap-filled rows (weekends/holidays). `DATEDIFF(DAY, MAX(date), GETDATE())` measures data staleness in days. Count synthetic gap-filled rows (non-zero warrants review of the gap-fill logic) and measure days since the last data update (values > 1 on a trading day indicate a failed load).

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

| check_name | issues |
|---|---|
| null_prices | 0 |
| negative_prices | 0 |
| high_lt_low | 0 |
| gap_filled_rows | 6 |
| days_since_update | 10 |

## Bronze → Silver → Gold Transforms

The medallion architecture (bronze → silver → gold) is a progressive refinement pipeline. Bronze stores raw ingested data, silver adds computed columns and data cleansing (daily returns, gap-fill flags), and gold produces business-ready analytical outputs (z-score normalization, composite rankings). Each layer's transforms are idempotent — safe to re-run without duplicating data.

> [!tip] Related pattern
>
> The SQL that creates and populates the bronze tables queried here is covered in [bronze-layer-loading](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/bronze-layer-loading), which walks through the ingestion pipeline that feeds this medallion architecture.

### Bronze → Silver → Gold Transforms | Daily Returns

The silver transform adds computed columns to raw data. Here, `LAG()` computes daily returns from the price time series. The `is_filled` flag marks gap-filled rows (weekends/holidays).

#### Compute daily return with LAG and NULLIF safe division

When building or validating the silver-layer daily return column — the primary input to momentum scoring and volatility calculations. It is typically triggered by silver transform pipeline execution, or ad-hoc verification that LAG-based return computation is correct for a specific symbol. Read-only T-SQL query against `silver.eurostoxx50_ohlcv`. Uses `LAG()` twice in one SELECT — SQL Server evaluates each independently. `NULLIF(LAG([close]) ..., 0)` prevents divide-by-zero for delisted stocks. The `is_filled` flag identifies synthetic gap-fill rows where the return is meaningless. Compute the decimal daily return for each trading row and expose the `is_filled` flag — enabling the pipeline to exclude synthetic rows from return-series calculations.

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

| symbol | date | close | daily_return | is_filled |
|---|---|---|---|---|
| ASML.AS | 2026-03-12 | 1190.8 | -0.0067 | False |
| ASML.AS | 2026-03-11 | 1198.8 | -0.001 | False |
| ASML.AS | 2026-03-10 | 1200.0 | 0.0457 | False |
| ASML.AS | 2026-03-09 | 1147.6 | 0.0005 | False |
| ASML.AS | 2026-03-06 | 1147.0 | -0.0329 | False |

### Bronze → Silver → Gold Transforms | Z-Score Normalization

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

After the gold scoring pipeline computes composite scores, to normalize them for cross-stock comparison and produce the final ranked output. It is typically triggered by daily gold-layer pipeline execution, or ad-hoc validation that z-score normalization is working correctly after a scoring model change. Read-only T-SQL query using a CTE to compute partition-wide mean and standard deviation via `AVG() OVER ()` and `STDEV() OVER ()` (empty `OVER()` = whole result set). `NULLIF(std_score, 0)` guards against division by zero when all scores are identical. `DENSE_RANK()` produces a gap-free rank. Transform raw composite scores into z-scores (standard deviations from the index mean) and assign a dense rank — the final step of the gold scoring pipeline before results are written to the output table.

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

| symbol | raw_score | z_score | rank |
|---|---|---|---|
| BNP.PA | 0.6796 | 2.08 | 1 |
| VOW.DE | 0.5756 | 1.76 | 2 |
| DTE.DE | 0.487 | 1.48 | 3 |
| TTE.PA | 0.3913 | 1.18 | 4 |
| ABI.BR | 0.3852 | 1.16 | 5 |


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
