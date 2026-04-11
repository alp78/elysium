---
title: "10 - INSERT, UPDATE, DELETE, and OUTPUT Patterns"
tags: [sql-server, tsql, query-writing, dml]
aliases: [DML patterns, INSERT, UPDATE, DELETE, OUTPUT clause, BULK INSERT, SCOPE_IDENTITY, SEQUENCE, SELECT INTO, composable DML]
description: "Exhaustive T-SQL reference for SQL Server data modification: INSERT (VALUES, SELECT, EXEC, SELECT INTO, BULK INSERT, OPENROWSET), UPDATE (searched, FROM/JOIN, TOP, CTE, via view), DELETE (searched, joined, TOP, batched, TRUNCATE), the OUTPUT clause (INSERTED/DELETED, INTO, composable DML), identity and SEQUENCE semantics, transactions, error handling, concurrency, and performance."
created: 2026-04-11
updated: 2026-04-11
status: complete
---

# INSERT, UPDATE, DELETE, and OUTPUT Patterns

> [!abstract] Scope of this note
>
> This note owns the full surface of SQL Server **data modification** statements and the patterns built on top of them:
>
> - `INSERT` — `VALUES`, table value constructor, `INSERT ... SELECT`, `INSERT ... EXEC`, `INSERT ... DEFAULT VALUES`, `SELECT INTO`, `BULK INSERT`, `OPENROWSET(BULK ...)`
> - `UPDATE` — searched `UPDATE`, the T-SQL `UPDATE ... FROM ... JOIN` extension, `UPDATE` with CTE / TOP / subquery / view / file-based source
> - `DELETE` — searched `DELETE`, `DELETE ... FROM ... JOIN`, `DELETE TOP (n)`, batched deletes for large tables, `TRUNCATE TABLE` vs `DELETE`
> - `OUTPUT` — `INSERTED` and `DELETED` pseudo-tables, `OUTPUT ... INTO` a table variable or permanent table, audit trail patterns, composable DML (`INSERT ... SELECT FROM ( <dml with output> )`)
> - **Identity and SEQUENCE** semantics — `IDENTITY`, `SET IDENTITY_INSERT`, `SCOPE_IDENTITY()` vs `@@IDENTITY` vs `IDENT_CURRENT()`, `CREATE SEQUENCE`, `NEXT VALUE FOR`
> - **Transactional semantics** — implicit vs explicit transactions, `XACT_ABORT`, `TRY/CATCH`, Halloween protection
> - **Concurrency and locking** — `IX`/`X` locks on writes, `TABLOCK` for minimally logged bulk operations, `READPAST` for queue-pop patterns
> - **Performance** — minimally logged `INSERT ... SELECT`, batched large DML, row-by-row anti-patterns
>
> **Out of scope:**
>
> - `MERGE` / upsert patterns — see [[11-merge-and-upsert]]
> - Stored procedure wrapping, dynamic SQL, and structured error handling beyond the basic `TRY/CATCH` demo — see [[19-stored-procedures-dynamic-sql-and-error-handling]]
> - Locking internals, deadlocks, and race conditions — see [[16-blocking-and-locking]], [[17-deadlock-detection-and-prevention]], and [[18-race-conditions]]
> - Execution plans and SARGability analysis — see [[12-sargable-queries]] and [[13-execution-plans]]

## Demo Environment and Conventions

Every query in this note runs live against the `stoxx_db` database on the local SQL Server 2022 CU23 instance. `stoxx_db` contains a medallion layout with `bronze.*`, `silver.*`, and `gold.*` schemas populated with real-world stock and ESG data.

> [!info] Three reproducibility rules followed throughout
>
> - **Transactions with `ROLLBACK`.** Every destructive demo opens a transaction and rolls it back at the end, so the source tables return to their original state after the reader finishes. The `OUTPUT` clause still returns rows to the client during the transaction, so no data is lost from the demo.
> - **Table variables for captured output.** When a demo needs a destination for `OUTPUT INTO`, it uses a table variable (`DECLARE @audit TABLE (...)`) rather than creating a permanent table. Table variables disappear automatically at batch end.
> - **File-based demos use paths inside the container.** CSV source files for `BULK INSERT` and `OPENROWSET(BULK ...)` demos live at `/var/opt/mssql/data/demo_files/` inside the SQL Server Linux container. On a Windows host, the same files would be at a path like `C:\SQLData\demo_files\`.

### Conceptual model | SQL Server DML is always set-based and always transactional

Two invariants apply to every `INSERT`, `UPDATE`, and `DELETE` statement in SQL Server:

- **Set-based execution.** Each statement executes as a single logical operation against a *set* of rows (possibly empty, possibly millions), not as a loop over rows. The query optimizer produces one plan that modifies every qualifying row in one pass.
- **Implicit transactionality.** Every DML statement runs inside a transaction. If no explicit `BEGIN TRAN` is in effect, SQL Server wraps the statement in an auto-commit transaction that commits on success or rolls back on error. Once the statement begins, it either completes entirely or leaves the table unchanged — partial effects are never visible.

These two invariants drive every pattern in the rest of this note.

### DML statement comparison matrix

| Feature | `INSERT` | `UPDATE` | `DELETE` | `TRUNCATE` |
|---|---|---|---|---|
| Logs individual rows | ✅ | ✅ | ✅ | ❌ (page deallocations only) |
| Can fire triggers | ✅ (`AFTER INSERT`, `INSTEAD OF INSERT`) | ✅ (`AFTER UPDATE`, `INSTEAD OF UPDATE`) | ✅ (`AFTER DELETE`, `INSTEAD OF DELETE`) | ❌ |
| Can be rolled back in a transaction | ✅ | ✅ | ✅ | ✅ |
| Supports `OUTPUT` clause | ✅ | ✅ | ✅ | ❌ |
| Resets `IDENTITY` seed | ❌ | ❌ | ❌ | ✅ |
| Requires FK absence on target | ❌ | ❌ | ❌ | ✅ (cannot truncate FK-referenced table) |
| Takes schema-modification lock | ❌ | ❌ | ❌ | ✅ (`SCH-M`) |
| Minimally logged in `BULK_LOGGED`/`SIMPLE` | Only via `BULK INSERT`, `SELECT INTO`, or `INSERT ... SELECT` with `TABLOCK` on empty heap | ❌ | ❌ (always fully logged) | Always (only logs page deallocations) |

This matrix answers the first decision every engineer faces when touching data: which statement is the right tool? The sections below document every row of the matrix with a live example and its output.

---

## INSERT Patterns

`INSERT` adds new rows to a table. SQL Server offers six orthogonal input forms for the same statement: a literal value list, a multi-row table value constructor, a `SELECT` derived table, the result set of a stored procedure, `DEFAULT VALUES` for rows built entirely from defaults, and bulk forms (`BULK INSERT`, `OPENROWSET(BULK ...)`) that read from external files. Each form has a specific use case — choosing the right one matters far more for clarity than for raw performance at small row counts, and for raw performance once the row count grows into the thousands or millions.

### `INSERT ... VALUES` | single row with literal values

The simplest form of `INSERT` provides a value for each column in a literal list. When the target contains an `IDENTITY` column or a column with a default, those columns must be omitted from the column list and the value list so SQL Server can compute the correct value.

> [!info]- Clause-by-clause breakdown
>
> - `BEGIN TRAN` opens an explicit transaction so the insert can be rolled back at the end, leaving `bronze.dim_country` unchanged.
> - `INSERT INTO bronze.dim_country (country_name, iso_alpha2)` names the target table and the two columns that receive values. Both columns are `NOT NULL`, so both must be supplied.
> - `VALUES (N'Atlantis', 'ZZ')` provides the literal row. The `N` prefix marks the string as Unicode so it is directly compatible with the `nvarchar(200)` column.
> - The intermediate `SELECT` confirms the row is visible inside the transaction before the `ROLLBACK`.
> - `ROLLBACK` undoes the insert so the reader can re-run the demo later and get the same count.

*Insert a single country row into `bronze.dim_country` inside a transaction, verify it is present, then roll back.*

```sql
USE [stoxx_db];
GO

BEGIN TRAN;

INSERT INTO bronze.dim_country (country_name, iso_alpha2)
VALUES (N'Atlantis', 'ZZ');

SELECT country_name, iso_alpha2
FROM bronze.dim_country
WHERE iso_alpha2 = 'ZZ';

ROLLBACK;
```

| country_name | iso_alpha2 |
|---|---|
| Atlantis | ZZ |

*The single literal row is visible inside the transaction. `ROLLBACK` then undoes the insert so the table returns to its original 212-row state. This pattern — transactional insert followed by `SELECT` verification followed by `ROLLBACK` — is the safest way to experiment with DML against shared data without leaving traces.*

### `INSERT ... VALUES` with table value constructor | insert multiple rows in one statement

The Transact-SQL **table value constructor** lets a single `INSERT` statement supply many rows in one `VALUES` clause. Every row constructor must have the same number of values and the same column order. This is a single logical statement: it takes one table-level lock, writes one entry to the transaction log for each row, and either inserts every row or none of them.

> [!info]- Clause-by-clause breakdown
>
> - One `INSERT` statement targets `bronze.dim_country` with three row constructors separated by commas.
> - Every parenthesized tuple `(N'...', '...')` is one row and must match the column list in order.
> - SQL Server treats the whole statement as a single transaction unit — if any row violates a constraint, the entire `INSERT` fails and none of the rows are persisted.
> - The limit on rows per table value constructor is 1 000. Beyond that, split into multiple `INSERT` statements or use `INSERT ... SELECT FROM (VALUES ...) AS t(...)`.

*Insert three fictional countries at once using the table value constructor.*

```sql
USE [stoxx_db];
GO

BEGIN TRAN;

INSERT INTO bronze.dim_country (country_name, iso_alpha2)
VALUES
    (N'Atlantis', 'ZZ'),
    (N'Wakanda',  'XX'),
    (N'Genovia',  'QQ');

SELECT country_name, iso_alpha2
FROM bronze.dim_country
WHERE iso_alpha2 IN ('ZZ', 'XX', 'QQ')
ORDER BY iso_alpha2;

ROLLBACK;
```

| country_name | iso_alpha2 |
|---|---|
| Genovia | QQ |
| Wakanda | XX |
| Atlantis | ZZ |

*Three rows inserted in one round trip. The client message is `(3 rows affected)` — a single statement, not three. If any one of the rows had violated a constraint (for instance, a `NULL` in a `NOT NULL` column), all three would have been rejected together.*

> [!warning] 1 000-row hard limit on the table value constructor
>
> A single table value constructor can hold at most 1 000 row expressions. Attempting 1 001 or more raises error 10738: *"The number of row value expressions in the INSERT statement exceeds the maximum allowed number of 1000 row values."*

> [!success] Use `INSERT ... SELECT FROM (VALUES ...)` for bigger constants
>
> To insert more than 1 000 literal rows in one statement, wrap the table value constructor in a derived table and feed it to an `INSERT ... SELECT`. The 1 000-row cap does not apply to `SELECT`. This is the pattern used by script generators like `SSMS → Tasks → Generate Scripts → Data only`.

### `INSERT ... SELECT` | copy rows from another query

`INSERT ... SELECT` is the workhorse form for set-based ingestion from another table, view, or derived table. The `SELECT` can carry joins, filters, aggregates, `CASE` expressions, and window functions — anything a regular `SELECT` can do. The number and types of projected columns must match the `INSERT` column list.

> [!info]- Clause-by-clause breakdown
>
> - A `DECLARE @captured TABLE` table variable acts as a transient destination for the insert. Table variables belong to the batch and disappear automatically at `GO`.
> - `INSERT INTO @captured (signal_date, symbol, forward_pe)` names the three columns to populate.
> - `SELECT TOP (5) signal_date, symbol, forward_pe FROM silver.signals_daily WHERE forward_pe IS NOT NULL AND forward_pe BETWEEN 5 AND 25 ORDER BY signal_date DESC, symbol` reads five most recent rows meeting the filter.
> - The final `SELECT * FROM @captured` shows what ended up in the destination.

*Copy the five most recent rows from `silver.signals_daily` with a forward P/E between 5 and 25 into a table variable.*

```sql
USE [stoxx_db];
GO

DECLARE @captured TABLE (
    signal_date DATE,
    symbol      VARCHAR(20),
    forward_pe  FLOAT
);

INSERT INTO @captured (signal_date, symbol, forward_pe)
SELECT TOP (5)
    signal_date,
    symbol,
    forward_pe
FROM silver.signals_daily
WHERE forward_pe IS NOT NULL
  AND forward_pe BETWEEN 5 AND 25
ORDER BY signal_date DESC, symbol;

SELECT * FROM @captured ORDER BY signal_date DESC, symbol;
```

| signal_date | symbol | forward_pe |
|---|---|---:|
| 2026-04-08 | 1299.HK | 12.879697999999999 |
| 2026-04-08 | 1810.HK | 15.738319000000001 |
| 2026-04-08 | 2269.HK | 18.445307 |
| 2026-04-08 | 3382.T | 19.342813 |
| 2026-04-08 | 4063.T | 19.937525000000001 |

*The destination table variable holds exactly the rows projected by the `SELECT`. No user-visible column in `silver.signals_daily` has changed. This is how analytics pipelines copy curated data between layers of the medallion architecture, and it is the set-based counterpart to row-at-a-time cursor loops.*

> [!tip] Match destination columns by position, not by name
>
> `INSERT ... SELECT` matches projected columns to the destination column list by **position**, not by name. A mismatched order causes either a conversion error or, worse, silently loads data into the wrong column. Always spell out both column lists explicitly.

### `INSERT ... EXEC` | load rows from a stored procedure or dynamic SQL result set

`INSERT ... EXEC` captures the result set returned by a stored procedure (or a dynamic SQL batch) and inserts it into a table. The destination columns must be compatible with the shape of the result set. This pattern is the canonical way to persist the output of a report procedure or a system DMV query.

> [!info]- Clause-by-clause breakdown
>
> - A temp table `#db_list` is created with the two columns the query returns.
> - `INSERT INTO #db_list ... EXEC sys.sp_databases` captures the result set of the system stored procedure `sp_databases` directly into the temp table.
> - `sp_databases` is a system procedure that returns `DATABASE_NAME`, `DATABASE_SIZE`, and `REMARKS`. The target column list selects just the two of interest.
> - Temp tables are used here because an `INSERT ... EXEC` cannot target a table variable reliably across all result-set shapes.

*Capture the result of `sys.sp_databases` into a temp table to get a tabular view of every database on the instance.*

```sql
USE [stoxx_db];
GO

IF OBJECT_ID('tempdb..#db_list') IS NOT NULL DROP TABLE #db_list;

CREATE TABLE #db_list (
    database_name SYSNAME,
    database_size INT,
    remarks       VARCHAR(254) NULL
);

INSERT INTO #db_list (database_name, database_size, remarks)
EXEC sys.sp_databases;

SELECT TOP (5) database_name, database_size FROM #db_list ORDER BY database_size DESC;

DROP TABLE #db_list;
```

| database_name | database_size |
|---|---:|
| stoxx | 1720320 |
| stoxx_db | 1048576 |
| tempdb | 73728 |
| msdb | 16960 |
| model | 16384 |

*`sp_databases` returns one row per online database with its size in KB. The `INSERT ... EXEC` form is valuable because it works with any procedure that returns a tabular result set — including undocumented procs and dynamic SQL built with `sp_executesql`.*

> [!warning] `INSERT ... EXEC` cannot be nested
>
> If procedure A is being called with `INSERT ... EXEC` and procedure A itself tries another `INSERT ... EXEC`, SQL Server raises error 8164: *"An INSERT EXEC statement cannot be nested."* This limitation is the main reason `sp_executesql` and table-valued parameters (TVPs) exist as alternatives for result-set passing between procedures.

### `INSERT ... DEFAULT VALUES` | rely entirely on defaults

`INSERT ... DEFAULT VALUES` inserts a new row where every column takes its default value. For columns without a default but declared `NULL`, the inserted value is `NULL`. For `IDENTITY` columns, the next identity value is produced. The form is mainly useful for append-only header tables where the default constraints define everything the row needs.

> [!info]- Clause-by-clause breakdown
>
> - A temp table `#pings` has an `IDENTITY` primary key and a `datetime2` default of `SYSUTCDATETIME()`, plus a third column with a literal string default. Every column has an automatic value source.
> - Three consecutive `INSERT INTO #pings DEFAULT VALUES` statements each produce one row whose every column comes from the corresponding default or identity mechanism.
> - The final `SELECT` shows the three rows with their generated values side by side.

*Insert three rows into a temp table purely from defaults using `DEFAULT VALUES`.*

```sql
USE [stoxx_db];
GO

IF OBJECT_ID('tempdb..#pings') IS NOT NULL DROP TABLE #pings;

CREATE TABLE #pings (
    ping_id   INT IDENTITY(1,1) PRIMARY KEY,
    ping_at   DATETIME2(3)  NOT NULL CONSTRAINT df_pings_at DEFAULT SYSUTCDATETIME(),
    source    VARCHAR(20)   NOT NULL CONSTRAINT df_pings_src DEFAULT 'demo'
);

INSERT INTO #pings DEFAULT VALUES;
INSERT INTO #pings DEFAULT VALUES;
INSERT INTO #pings DEFAULT VALUES;

SELECT * FROM #pings ORDER BY ping_id;

DROP TABLE #pings;
```

| ping_id | ping_at | source |
|---:|---|---|
| 1 | 2026-04-11 04:10:33.120 | demo |
| 2 | 2026-04-11 04:10:33.120 | demo |
| 3 | 2026-04-11 04:10:33.120 | demo |

*Three rows are produced, each with a fresh `IDENTITY` value, the current UTC timestamp (close enough between inserts that they appear identical at millisecond granularity), and the literal `'demo'` string. `DEFAULT VALUES` is the only way to insert a row without naming any columns explicitly.*

### `SELECT ... INTO` | create a new table and insert rows in one statement

`SELECT INTO` is a shortcut that creates a brand-new table (permanent or temporary) from the result of a `SELECT` and populates it in one step. The destination must not exist already. The new table inherits column names and data types from the source projection but **does not** inherit indexes, constraints, defaults, or filegroup placement.

> [!info]- Clause-by-clause breakdown
>
> - `SELECT ... INTO #top_signals` creates a temp table named `#top_signals` and inserts every row returned by the query into it.
> - The projected columns (`symbol`, `signal_date`, `forward_pe`, `beta`) become the columns of the new table with their source types.
> - Because the source columns are all nullable, the new temp table's columns are also nullable. Constraints are not copied.
> - `SELECT COUNT(*) FROM #top_signals` reports how many rows landed.

*Create a temp table holding the 100 highest-beta rows from `silver.signals_daily` using `SELECT INTO`.*

```sql
USE [stoxx_db];
GO

IF OBJECT_ID('tempdb..#top_signals') IS NOT NULL DROP TABLE #top_signals;

SELECT TOP (100)
    symbol,
    signal_date,
    forward_pe,
    beta
INTO #top_signals
FROM silver.signals_daily
WHERE beta IS NOT NULL
ORDER BY beta DESC;

SELECT COUNT(*) AS rows_loaded FROM #top_signals;
SELECT TOP (3) * FROM #top_signals ORDER BY beta DESC;

DROP TABLE #top_signals;
```

| rows_loaded |
|---:|
| 100 |

| symbol | signal_date | forward_pe | beta |
|---|---|---:|---:|
| NVDA | 2026-03-12 | 17.232882 | 2.375 |
| NVDA | 2026-03-07 | 16.553408000000001 | 2.375 |
| NVDA | 2026-03-04 | 17.143456 | 2.375 |

*`SELECT INTO` produces a fresh temp table in one statement — there is no separate `CREATE TABLE`. It is convenient for ad-hoc analysis and staging but should not replace `INSERT INTO` into a table designed intentionally.*

> [!warning] `SELECT INTO` strips constraints, defaults, and indexes
>
> The destination of `SELECT INTO` is a minimally defined table. It contains no primary key, no foreign keys, no defaults, no check constraints, no indexes, and no trigger bindings. Identity is preserved only if the source projection includes an `IDENTITY` column directly — otherwise the new table has no identity. For anything beyond a throwaway analysis, create the target with `CREATE TABLE` first and then `INSERT ... SELECT`.

> [!success] Use `SELECT INTO` for minimally logged heap staging
>
> `SELECT INTO` into a permanent empty table (or a temp table) can be minimally logged in `BULK_LOGGED` or `SIMPLE` recovery, similar to `BULK INSERT`. This makes it a legitimate fast-path for multi-million-row ETL staging, provided the staging table's lack of constraints is acceptable for the next step of the pipeline.

### `BULK INSERT` | load a flat file into a table

`BULK INSERT` reads a delimited or fixed-width flat file from a filesystem path accessible to the SQL Server service account and inserts its rows into a target table. The file path is resolved from the perspective of the SQL Server process — not the client machine — which is critical on containerized or clustered installations. `BULK INSERT` is the lowest-ceremony way to load CSV data without deploying external tools.

> [!info]- Clause-by-clause breakdown
>
> - `BULK INSERT bronze.dim_country` names the destination table. The table must exist already with a compatible schema.
> - `FROM '/var/opt/mssql/data/demo_files/dim_country.csv'` is the path **inside the SQL Server container**. On Windows, the path would be `N'C:\...'`.
> - `WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0d0a', TABLOCK)` specifies: modern CSV format (SQL Server 2017+), skip the header row, comma delimiter, Windows CRLF row terminator (the CSV files in this demo were produced on Windows), and take a full table lock for minimally logged insert speed.
> - Row terminator encoding matters: `0x0a` is a Unix `\n`, `0x0d0a` is a Windows `\r\n`. Picking the wrong one causes the trailing `\r` character to be parsed as part of the last column and produces bulk load truncation errors (msg 4863).
> - On a Windows-hosted SQL Server, the optional `CODEPAGE='65001'` parameter forces UTF-8 interpretation of the source bytes. This parameter is **not** supported on SQL Server for Linux (error 16202) and must be omitted in containerized Linux environments.
> - The enclosing `BEGIN TRAN ... ROLLBACK` ensures the 212 existing rows in `bronze.dim_country` are preserved after the demo — the rollback undoes every row the bulk load added.

*Bulk-load `dim_country.csv` into `bronze.dim_country` inside a rollback-protected transaction.*

```sql
USE [stoxx_db];
GO

BEGIN TRAN;

SELECT COUNT(*) AS rows_before FROM bronze.dim_country;

BULK INSERT bronze.dim_country
FROM '/var/opt/mssql/data/demo_files/dim_country.csv'
WITH (
    FORMAT          = 'CSV',
    FIRSTROW        = 2,
    FIELDTERMINATOR = ',',
    ROWTERMINATOR   = '0x0d0a',
    TABLOCK
);

SELECT COUNT(*) AS rows_after FROM bronze.dim_country;

ROLLBACK;

SELECT COUNT(*) AS rows_after_rollback FROM bronze.dim_country;
```

| rows_before |
|---:|
| 212 |

| rows_after |
|---:|
| 424 |

| rows_after_rollback |
|---:|
| 212 |

*Before the bulk insert, 212 country rows exist. The CSV contains 212 rows of the same reference data, so after the load the table holds 424 rows. `ROLLBACK` restores the original 212 rows. In real pipelines, the staging target would be empty so the post-load count would equal the CSV row count — the same pattern applies.*

> [!warning] File path is resolved on the SQL Server machine
>
> `BULK INSERT` does **not** read files from the client. It reads from the filesystem seen by the SQL Server service account. On a Linux container this means the path must exist inside the container and the `mssql` user must have read access. On Windows, the SQL Server service account must be able to reach the path and have `NTFS read` permission on the file.

> [!success] Grant `ADMINISTER BULK OPERATIONS` to the bulk loader
>
> Regular users cannot run `BULK INSERT`. The loading principal needs either the `bulkadmin` server role or the `ADMINISTER BULK OPERATIONS` server permission. Grant the minimum by creating a dedicated load login with `ADMINISTER BULK OPERATIONS` and no other privileges, then use that login for ETL jobs only.

### `OPENROWSET(BULK ...)` | read a flat file as a virtual rowset inside a query

`OPENROWSET(BULK ...)` turns a flat file into a rowset that can participate in any `SELECT`, `INSERT ... SELECT`, `UPDATE ... FROM`, or `DELETE ... FROM` statement. It is strictly more powerful than `BULK INSERT`: the rows can be filtered, joined, projected, or transformed on their way into the target table. `OPENROWSET(BULK ...)` also supports JSON and XML via `SINGLE_CLOB`/`SINGLE_NCLOB` and, with SQL Server 2017+, the `FORMAT='CSV'` option.

> [!info]- Clause-by-clause breakdown
>
> - `OPENROWSET(BULK '...', FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0d0a')` reads the CSV as a virtual table using the modern 2017+ CSV parser. The Windows CRLF row terminator matches the file's actual bytes.
> - `WITH (country_name NVARCHAR(200), iso_alpha2 CHAR(2))` supplies an inline schema — without it, SQL Server would return the rowset as a single `BulkColumn` wide column.
> - `AS src` gives the rowset an alias so its columns can be referenced in the outer query.
> - `WHERE src.iso_alpha2 COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT IN (SELECT iso_alpha2 FROM bronze.dim_country)` skips countries that already exist. The explicit `COLLATE` clause is mandatory in this environment because `OPENROWSET(BULK ...)` returns character columns in the server-level collation (`SQL_Latin1_General_CP1_CI_AS`), while `bronze.dim_country.iso_alpha2` uses the database-level UTF-8 collation (`Latin1_General_100_CI_AS_SC_UTF8`). Comparing them without the `COLLATE` forces a collation-conflict error (msg 468).
> - The same `COLLATE` clause is also applied in the projected column list so the `INSERT` target column accepts the value directly.

*Use `OPENROWSET(BULK ...)` to load only the country rows that are not already in the target table, resolving the collation mismatch explicitly.*

```sql
USE [stoxx_db];
GO

BEGIN TRAN;

INSERT INTO bronze.dim_country (country_name, iso_alpha2)
SELECT
    src.country_name,
    src.iso_alpha2 COLLATE Latin1_General_100_CI_AS_SC_UTF8 AS iso_alpha2
FROM OPENROWSET(
        BULK '/var/opt/mssql/data/demo_files/dim_country.csv',
        FORMAT          = 'CSV',
        FIRSTROW        = 2,
        FIELDTERMINATOR = ',',
        ROWTERMINATOR   = '0x0d0a'
    )
    WITH (
        country_name NVARCHAR(200),
        iso_alpha2   CHAR(2)
    ) AS src
WHERE src.iso_alpha2 COLLATE Latin1_General_100_CI_AS_SC_UTF8
      NOT IN (SELECT iso_alpha2 FROM bronze.dim_country);

SELECT @@ROWCOUNT AS rows_inserted;

ROLLBACK;
```

| rows_inserted |
|---:|
| 0 |

*The anti-join filter eliminates every row in the file because all 212 ISO codes already exist in `bronze.dim_country`. In a true staging load, the same query would insert only genuinely new countries. This is the key architectural difference from `BULK INSERT`, which would blindly append all 212 rows as duplicates unless a `WHERE` clause could be pre-applied — which it cannot in the `BULK INSERT` statement itself.*

> [!warning] OPENROWSET(BULK ...) inherits the server collation, not the database collation
>
> Character columns returned by `OPENROWSET(BULK ...)` always take the **server-level default collation**, not the collation of the target database. On instances where the database uses a modern UTF-8 collation but the server default is still the legacy `SQL_Latin1_General_CP1_CI_AS`, any string comparison between the loaded rowset and a database column raises error 468 (collation conflict). The fix is an explicit `COLLATE` clause on each side of every string comparison and on each projected column going into the target table.

> [!success] Wrap OPENROWSET BULK in a view or inline TVF with pre-applied COLLATE
>
> If you load the same file often, wrap the `OPENROWSET(BULK ...)` expression in an inline table-valued function that applies `COLLATE DATABASE_DEFAULT` to every string column. Callers then receive correctly collated rows and no longer need to repeat `COLLATE` on every predicate.

> [!info] Parquet reading requires an external data source
>
> SQL Server 2022 added `OPENROWSET(BULK ... FORMAT='PARQUET')` but only through `CREATE EXTERNAL DATA SOURCE` backed by Azure Blob Storage or S3-compatible storage. Local parquet file reading is not supported directly by T-SQL. For local parquet ingestion, convert to CSV first with `duckdb` or `pandas`, or stand up a MinIO/Azurite container exposing the parquet files as an S3/Blob endpoint.

---

## Identity and SEQUENCE

Every insert into a table with an auto-generated key relies on either the `IDENTITY` column property or a `SEQUENCE` object. The two mechanisms solve the same problem — producing unique monotonic integers — but with very different scoping, atomicity, and observability guarantees. The `silver.signals_daily` table already has an `IDENTITY(1,1)` primary-key-style column on `id`, so every demo below runs against a real table.

### `IDENTITY` | auto-increment a column on every insert

`IDENTITY(seed, increment)` is a column property that makes SQL Server generate the next value automatically every time a new row is inserted. The engine maintains a per-table counter (`IDENT_CURRENT`) that is independent of transactions: a failed or rolled-back `INSERT` still advances the counter, producing gaps. This is by design and cannot be disabled.

> [!info]- Clause-by-clause breakdown
>
> - The `INSERT` omits the `id` column entirely because it is an `IDENTITY` column — the engine will supply the value.
> - Immediately after the insert, three functions are called in order: `SCOPE_IDENTITY()`, `@@IDENTITY`, and `IDENT_CURRENT('silver.signals_daily')`. In this simple scenario (no triggers, no concurrent writers) all three return the same value.
> - `ROLLBACK` undoes the row insertion **but does not reset the identity counter** — the value 3171 is permanently burned.

*Insert one row into `silver.signals_daily`, capture the generated identity value via three different functions, then roll back.*

```sql
USE [stoxx_db];
GO

BEGIN TRAN;

INSERT INTO silver.signals_daily
    (_index, symbol, signal_date, current_price, forward_pe, price_to_book,
     ev_to_ebitda, dividend_yield, market_cap, beta, fifty_two_week_change,
     sandp_52_week_change, fifty_day_average, two_hundred_day_average,
     dist_from_52_week_high, target_median_price, recommendation_mean, upside_potential)
VALUES
    ('demo_index', 'TEST.XX', '2026-04-11', 100.0, 15.0, 2.0, 10.0, 0.03,
     1000000000, 1.0, 0.1, 0.05, 99.0, 95.0, 0.02, 110.0, 2.0, 0.1);

DECLARE
    @new_id_scope   INT = SCOPE_IDENTITY(),
    @new_id_at      INT = @@IDENTITY,
    @new_id_current INT = IDENT_CURRENT('silver.signals_daily');

SELECT
    @new_id_scope   AS scope_identity,
    @new_id_at      AS at_identity,
    @new_id_current AS ident_current;

ROLLBACK;
```

| scope_identity | at_identity | ident_current |
|---:|---:|---:|
| 3171 | 3171 | 3171 |

*All three functions return 3171, the identity value the engine generated for the new row. The differences between them only become visible when a trigger inserts into a second identity table, or when another session inserts into the same table concurrently — both edge cases that regularly trip up production systems.*

### `SCOPE_IDENTITY()` vs `@@IDENTITY` vs `IDENT_CURRENT()` | how they differ

| Function | Scope | Session | Use when |
|---|---|---|---|
| `SCOPE_IDENTITY()` | Current scope (batch, stored procedure, trigger) | Current session | **Default choice** for retrieving the identity of the row you just inserted. Immune to trigger interference. |
| `@@IDENTITY` | Any scope in the current session (including triggers) | Current session | Almost never the right answer. Can return the identity value a trigger inserted into a different table. |
| `IDENT_CURRENT('table')` | Any scope | Any session (global) | Only when you need the most recent identity for a specific table globally, knowing it may have been generated by a concurrent session. |

> [!danger] `@@IDENTITY` is unsafe when triggers are involved
>
> If an `AFTER INSERT` trigger on table A writes to table B and table B has its own identity column, `@@IDENTITY` returns the identity from table B (the trigger's insert), not from table A (the user's insert). Applications that use `@@IDENTITY` to "get the ID of the row I just inserted" silently break the first day a trigger is added. `SCOPE_IDENTITY()` is scoped to the calling batch and ignores trigger inserts.

> [!success] Default to `SCOPE_IDENTITY()` in application code
>
> Use `SCOPE_IDENTITY()` as the standard pattern to retrieve the identity of a newly inserted row. Reserve `@@IDENTITY` for rare cases where you explicitly want trigger-inserted identities, and reserve `IDENT_CURRENT()` for diagnostics and monitoring scripts where cross-session visibility is desired.

### `SET IDENTITY_INSERT` | override the auto-generated value

`SET IDENTITY_INSERT <table> ON` lets a session insert explicit values into an identity column. Only one table per session can have `IDENTITY_INSERT` turned on at any time. When the override is in effect, the explicit value list must include the identity column, and the session must have `ALTER` permission on the table.

> [!info]- Clause-by-clause breakdown
>
> - `SET IDENTITY_INSERT silver.signals_daily ON` enables explicit identity values for this table in this session only.
> - The `INSERT` now includes `id` in the column list and supplies `999999` as its value.
> - `SET IDENTITY_INSERT silver.signals_daily OFF` disables the override so subsequent inserts resume auto-generation.
> - The surrounding `BEGIN TRAN ... ROLLBACK` means the row never persists, but the identity counter's watermark still advances if the explicit value is higher than the current seed — in this case the value 999999 is above the current seed, so the next natural identity value would become 1000000 after commit. The rollback undoes this as well.

*Insert a row into `silver.signals_daily` with an explicit identity value of 999999.*

```sql
USE [stoxx_db];
GO

BEGIN TRAN;

SET IDENTITY_INSERT silver.signals_daily ON;

INSERT INTO silver.signals_daily
    (id, _index, symbol, signal_date, current_price, forward_pe, price_to_book,
     ev_to_ebitda, dividend_yield, market_cap, beta, fifty_two_week_change,
     sandp_52_week_change, fifty_day_average, two_hundred_day_average,
     dist_from_52_week_high, target_median_price, recommendation_mean, upside_potential)
VALUES
    (999999, 'demo_index', 'TEST.XX', '2026-04-11', 100.0, 15.0, 2.0, 10.0, 0.03,
     1000000000, 1.0, 0.1, 0.05, 99.0, 95.0, 0.02, 110.0, 2.0, 0.1);

SET IDENTITY_INSERT silver.signals_daily OFF;

SELECT id, symbol, signal_date
FROM silver.signals_daily
WHERE id = 999999;

ROLLBACK;
```

| id | symbol | signal_date |
|---:|---|---|
| 999999 | TEST.XX | 2026-04-11 |

*With `IDENTITY_INSERT` on, the explicit value 999999 is accepted. After the rollback, the identity counter that was temporarily moved above 999999 is also rolled back to its pre-transaction position — unlike natural identity generation, values set via `IDENTITY_INSERT` inside a rolled-back transaction do not permanently advance the counter.*

> [!warning] Only one table per session can have IDENTITY_INSERT ON
>
> Attempting to turn `IDENTITY_INSERT` on for a second table in the same session while it is still on for the first raises error 7705. Always explicitly turn it off before enabling it on another table.

### `CREATE SEQUENCE` + `NEXT VALUE FOR` | table-independent counters

A `SEQUENCE` is a standalone database object that produces monotonic integers independent of any table. Unlike `IDENTITY`, a sequence can be read by multiple tables, can be sampled without inserting a row (`NEXT VALUE FOR`), supports bulk allocation via `sp_sequence_get_range`, and can wrap at the maximum value with `CYCLE`. SQL Server caches sequence values per session for performance, which means gaps are possible after a server restart.

> [!info]- Clause-by-clause breakdown
>
> - `CREATE SEQUENCE dbo.demo_order_no AS BIGINT START WITH 1000 INCREMENT BY 1 CACHE 50` creates a sequence starting at 1000 with a cache of 50 values per allocation batch.
> - Each `INSERT` statement uses `NEXT VALUE FOR dbo.demo_order_no` directly in the `VALUES` list to consume the next sequence value. This is the most explicit and widely supported pattern.
> - `NEXT VALUE FOR` can also be used in `SELECT` projections, `UPDATE SET` clauses, or as a `DEFAULT` expression on a persistent table (but not on a temp table default expression in all versions).
> - `DROP SEQUENCE` cleans up after the demo.

*Create a sequence and use `NEXT VALUE FOR` directly in three `INSERT` statements to draw consecutive values.*

```sql
USE [stoxx_db];
GO

IF OBJECT_ID('dbo.demo_order_no','SO') IS NOT NULL DROP SEQUENCE dbo.demo_order_no;
GO

CREATE SEQUENCE dbo.demo_order_no
    AS BIGINT
    START WITH 1000
    INCREMENT BY 1
    CACHE 50;
GO

IF OBJECT_ID('tempdb..#orders') IS NOT NULL DROP TABLE #orders;
CREATE TABLE #orders (
    order_no BIGINT NOT NULL,
    symbol   VARCHAR(20) NOT NULL,
    qty      INT NOT NULL
);

INSERT INTO #orders (order_no, symbol, qty)
VALUES (NEXT VALUE FOR dbo.demo_order_no, 'SAP.DE', 100);

INSERT INTO #orders (order_no, symbol, qty)
VALUES (NEXT VALUE FOR dbo.demo_order_no, 'SIE.DE', 200);

INSERT INTO #orders (order_no, symbol, qty)
VALUES (NEXT VALUE FOR dbo.demo_order_no, 'ASML.AS', 50);

SELECT * FROM #orders ORDER BY order_no;

DROP TABLE #orders;
DROP SEQUENCE dbo.demo_order_no;
```

| order_no | symbol | qty |
|---:|---|---:|
| 1000 | SAP.DE | 100 |
| 1001 | SIE.DE | 200 |
| 1002 | ASML.AS | 50 |

*The sequence produces 1000, 1001, 1002 across three inserts. Unlike `IDENTITY`, the same sequence could feed multiple tables simultaneously, or be sampled ahead of time with a bare `SELECT NEXT VALUE FOR dbo.demo_order_no` without any insert happening at all.*

> [!info] `IDENTITY` vs `SEQUENCE` decision
>
> Use `IDENTITY` for the common case of a single-table auto-generated primary key — simpler to create, easier for tooling, and the surrounding ecosystem assumes it. Use `SEQUENCE` when you need cross-table uniqueness (e.g., a shared event_id across ten audit tables), when you must allocate a block of numbers before the insert happens (e.g., for a parent-then-children parent-id pattern without round trips), or when you want explicit control over caching, cycling, or minimum/maximum bounds.

---

## UPDATE Patterns

`UPDATE` modifies existing rows in place. Its surface is smaller than `INSERT`'s but its pitfalls are larger: the T-SQL `UPDATE ... FROM ... JOIN` extension is non-deterministic when the join is ambiguous, `UPDATE` with `TOP` selects rows in an arbitrary order unless an outer `ORDER BY` controls it, and a missing `WHERE` clause quietly updates every row of the table. Every demo in this section wraps the update in a transaction and rolls it back so the reader can re-run the demo from the same starting state.

### Searched `UPDATE` | single-table update with a predicate

The standard `UPDATE` form sets one or more columns for every row matching a `WHERE` predicate. If `WHERE` is omitted, every row is updated — there is no safety net. SQL Server takes exclusive (`X`) locks on the affected rows and intent exclusive (`IX`) locks on the enclosing page and table for the duration of the transaction.

> [!info]- Clause-by-clause breakdown
>
> - `UPDATE silver.signals_daily` names the target table directly.
> - `SET upside_potential = 0.25` assigns a literal value to one column. Multiple columns can be set in a single `SET` clause by separating them with commas.
> - `WHERE symbol = 'SAP.DE' AND signal_date = '2026-04-08'` restricts the update to exactly one row. Both columns participate in the existing heap scan — no index is involved because the silver tables are pure heaps.

*Set the `upside_potential` of a single row to a fixed value, verify the change, then roll back.*

```sql
USE [stoxx_db];
GO

BEGIN TRAN;

UPDATE silver.signals_daily
SET upside_potential = 0.25
WHERE symbol      = 'SAP.DE'
  AND signal_date = '2026-04-08';

SELECT symbol, signal_date, upside_potential
FROM silver.signals_daily
WHERE symbol      = 'SAP.DE'
  AND signal_date = '2026-04-08';

ROLLBACK;
```

| symbol | signal_date | upside_potential |
|---|---|---:|
| SAP.DE | 2026-04-08 | 0.25 |

*One row updated, verified with a `SELECT`, then undone by `ROLLBACK`. The locking sequence is `IX` on the table → `IX` on the page → `X` on the row → release at `ROLLBACK`. No other session can read this row during the transaction unless it has `NOLOCK` set (strongly discouraged) or the database is in `READ_COMMITTED_SNAPSHOT ON` mode, in which case readers see the pre-update version from the version store.*

> [!danger] `UPDATE` without `WHERE` updates every row
>
> Running `UPDATE silver.signals_daily SET upside_potential = 0.25` **without** a `WHERE` clause modifies every one of the 635 rows in the table. There is no SQL Server safeguard against this. The only defenses are (1) opening every `UPDATE` in an explicit transaction so you can `ROLLBACK` on discovery, (2) writing the `SELECT` form of the predicate first and only converting it to `UPDATE` once the row count is confirmed, and (3) using tooling (SSMS → Tools → Options → Query Execution → SET ROWCOUNT or the IntelliSense `UPDATE` safeguard).

### `UPDATE ... FROM ... JOIN` | T-SQL extension for joined updates

The T-SQL `UPDATE ... FROM ... JOIN` extension lets an update use another table as a data source for both the predicate and the new column values. This is the most common way to propagate reference data, synchronize lookup columns, or apply derived calculations that require joining to dimensional tables.

> [!info]- Clause-by-clause breakdown
>
> - `UPDATE sd` targets the alias `sd` (`silver.signals_daily`) — not the table name directly. When a `FROM` clause is present, the aliased form is clearer because it matches the alias used downstream.
> - `SET sd.current_price = sd.current_price * 1.05` increases the `current_price` by 5%. The same alias appears on both sides of the assignment.
> - `FROM gold.scores_daily sd` names the primary source of rows to update and aliases it.
> - `JOIN bronze.dim_country dc ON dc.country_name = sd.country` joins the scores to the country dimension.
> - `WHERE dc.iso_alpha2 = 'DE' AND sd.score_date = '2026-03-04'` restricts the scope to German stocks on a specific date.

*Apply a 5% price bump to all German stocks on 2026-03-04 by joining `gold.scores_daily` to `bronze.dim_country`.*

```sql
USE [stoxx_db];
GO

BEGIN TRAN;

UPDATE sd
SET sd.current_price = sd.current_price * 1.05
FROM gold.scores_daily AS sd
JOIN bronze.dim_country AS dc ON dc.country_name = sd.country
WHERE dc.iso_alpha2 = 'DE'
  AND sd.score_date = '2026-03-04';

SELECT TOP (5)
    symbol,
    country,
    current_price
FROM gold.scores_daily
WHERE country    = 'Germany'
  AND score_date = '2026-03-04'
ORDER BY symbol;

ROLLBACK;
```

| symbol | country | current_price |
|---|---|---:|
| ADS.DE | Germany | 148.89000000000001 |
| ALV.DE | Germany | 376.94999999999999 |
| BAS.DE | Germany | 48.457500000000003 |
| BAYN.DE | Germany | 39.270000000000003 |
| BMW.DE | Germany | 86.772000000000006 |

*Sixteen German scores were updated in one statement — the join to `bronze.dim_country` provided the ISO code filter without needing a hard-coded country list. This is the canonical pattern for applying a lookup-driven transformation to a fact table.*

> [!warning] Non-deterministic UPDATE with multi-match joins
>
> If the join produces multiple source rows for the same target row, SQL Server picks **one** of them arbitrarily and uses its columns for the update. The picked row is not guaranteed to be stable across runs or plans. Microsoft's own best-practice guidance flags this as undefined behavior. Detecting the condition up front requires a `SELECT COUNT(*) OVER (PARTITION BY <target_key>)` check in the source query or a `GROUP BY` rewrite.

> [!success] Force determinism with a CTE that pre-aggregates the source
>
> When the source might produce multiple rows per target, wrap it in a CTE that aggregates to at most one row per target key (e.g., `GROUP BY`, `ROW_NUMBER() = 1`, or `MAX(...)`). Then join the `UPDATE` to the CTE. The update becomes deterministic and the error mode shifts from "silent wrong answer" to "compile-time visible intent".

### `UPDATE` with CTE | scope-limited updates through a named subquery

A CTE (common table expression) can be the target of an `UPDATE` statement, or it can be used as a derived source that drives the update. The most common use case is computing a set of rows with ranking or aggregation before applying the modification.

> [!info]- Clause-by-clause breakdown
>
> - `WITH latest AS (SELECT symbol, MAX(signal_date) FROM silver.signals_daily GROUP BY symbol)` computes the latest signal date per symbol.
> - `UPDATE sd SET sd.upside_potential = 0.99 FROM silver.signals_daily sd JOIN latest l ON l.symbol = sd.symbol AND l.latest_date = sd.signal_date WHERE sd.symbol IN ('SAP.DE','SIE.DE')` updates only the latest row for those two symbols.
> - Without the CTE, the same update would require a correlated subquery in the `WHERE` clause, which is less readable and often slower.

*Update only the most recent signal row for SAP.DE and SIE.DE using a CTE to identify the latest date per symbol.*

```sql
USE [stoxx_db];
GO

BEGIN TRAN;

WITH latest AS (
    SELECT symbol, MAX(signal_date) AS latest_date
    FROM silver.signals_daily
    GROUP BY symbol
)
UPDATE sd
SET sd.upside_potential = 0.99
FROM silver.signals_daily AS sd
JOIN latest AS l
    ON l.symbol      = sd.symbol
   AND l.latest_date = sd.signal_date
WHERE sd.symbol IN ('SAP.DE', 'SIE.DE');

SELECT symbol, signal_date, upside_potential
FROM silver.signals_daily
WHERE symbol IN ('SAP.DE', 'SIE.DE')
  AND upside_potential = 0.99;

ROLLBACK;
```

| symbol | signal_date | upside_potential |
|---|---|---:|
| SAP.DE | 2026-04-08 | 0.98999999999999999 |
| SIE.DE | 2026-04-08 | 0.98999999999999999 |

*Exactly two rows are updated — the latest date per symbol for SAP.DE and SIE.DE. Float representation shows 0.99 as 0.98999999999999999; use `decimal(p,s)` instead of `float` for columns where exact equality matters. The `WHERE sd.symbol IN (...)` clause pushes the filter down before the join, so the CTE is effectively evaluated only for the two relevant symbols.*

### `UPDATE TOP (n)` | bounded update without a predictable order

`UPDATE TOP (n)` modifies at most `n` rows. In isolation, `TOP (n)` without an `ORDER BY` is **non-deterministic**: SQL Server is free to pick any `n` rows satisfying the `WHERE` predicate. This is a common footgun for ETL scripts that assume a time-ordered selection.

> [!info]- Clause-by-clause breakdown
>
> - `UPDATE TOP (2) silver.signals_daily SET recommendation_mean = 1.0 WHERE symbol = 'SAP.DE'` asks SQL Server to update at most two SAP.DE rows.
> - Since `UPDATE` does not accept `ORDER BY` directly, the engine picks two rows based on whatever access path the optimizer chose. On subsequent runs, the same two rows are likely but not guaranteed.

*Update at most two rows matching the predicate and return the count.*

```sql
USE [stoxx_db];
GO

BEGIN TRAN;

UPDATE TOP (2) silver.signals_daily
SET recommendation_mean = 1.0
WHERE symbol = 'SAP.DE';

SELECT COUNT(*) AS rows_affected
FROM silver.signals_daily
WHERE symbol              = 'SAP.DE'
  AND recommendation_mean = 1.0;

ROLLBACK;
```

| rows_affected |
|---:|
| 2 |

*Two rows were updated, but the identity of those two rows depends on the plan. For deterministic bounded updates, use a derived table with `ORDER BY` as the source of a join.*

> [!warning] `UPDATE TOP (n)` selection is non-deterministic
>
> `UPDATE TOP (n)` without an accompanying subquery with `ORDER BY` picks rows in an unspecified order. Identical runs on the same data can update different rows if the plan changes, so this form should never be used for time-ordered batch processing, leader elections, or any logic that requires stable selection.

> [!success] Deterministic bounded updates with a subquery + `ORDER BY`
>
> The supported pattern is to write the bounded source query explicitly: `UPDATE sd SET ... FROM silver.signals_daily sd INNER JOIN (SELECT TOP (100) id FROM silver.signals_daily WHERE symbol = 'SAP.DE' ORDER BY signal_date DESC) t ON t.id = sd.id;`. The inner `ORDER BY` produces a stable selection of the 100 most recent rows, and the outer `UPDATE` modifies only those.

### `UPDATE` with correlated subquery in `SET` | compute new values from aggregates

A correlated subquery inside the `SET` clause computes a new value for each row from an aggregate or another table. This form is more portable than `UPDATE ... FROM ... JOIN` (it works on standards-compliant databases too) but is often slower because the engine may materialize the subquery per row.

> [!info]- Clause-by-clause breakdown
>
> - `UPDATE silver.signals_daily SET target_median_price = ( SELECT AVG(sd2.target_median_price) FROM silver.signals_daily sd2 WHERE sd2._index = silver.signals_daily._index )` recomputes the target price as the index-average.
> - The subquery references the outer table via `silver.signals_daily._index`, making it correlated. For each row being updated, SQL Server computes (or caches) the per-index average.
> - `WHERE symbol = 'SAP.DE'` restricts the update to four rows, so the subquery is evaluated at most four times.

*Replace the `target_median_price` of each SAP.DE row with the average target price of all rows in the same index.*

```sql
USE [stoxx_db];
GO

BEGIN TRAN;

UPDATE silver.signals_daily
SET target_median_price = (
    SELECT AVG(sd2.target_median_price)
    FROM silver.signals_daily sd2
    WHERE sd2._index = silver.signals_daily._index
)
WHERE symbol = 'SAP.DE';

SELECT symbol, signal_date, target_median_price
FROM silver.signals_daily
WHERE symbol = 'SAP.DE'
ORDER BY signal_date;

ROLLBACK;
```

| symbol | signal_date | target_median_price |
|---|---|---:|
| SAP.DE | 2026-03-04 | 301.04887365326641 |
| SAP.DE | 2026-03-07 | 301.04887365326641 |
| SAP.DE | 2026-03-12 | 301.04887365326641 |
| SAP.DE | 2026-04-08 | 301.04887365326641 |

*All four SAP.DE rows now hold the same value (the euro_stoxx_50 index average), computed once per row but typically factored out by the optimizer into a scalar aggregate subtree. The same operation could be written with `UPDATE ... FROM ... JOIN` against a CTE of pre-aggregated averages for better readability at higher volumes.*

### `UPDATE ... SET @var = column = expression` | update a row and capture old/new value in one statement

SQL Server supports a composite assignment syntax: `SET @variable = column = expression`. This assigns the expression to the column (the update) and to the variable (the capture) in one step, allowing a single statement to both modify a row and remember its final value. Use this only when modifying one row — with multi-row updates, the variable holds the last-assigned row's value, which is non-deterministic.

*Update a single row, capturing the old and new price into two variables for logging.*

```sql
USE [stoxx_db];
GO

BEGIN TRAN;

DECLARE @old_price FLOAT, @new_price FLOAT;

UPDATE silver.signals_daily
SET
    @old_price = current_price,
    @new_price = current_price = current_price * 1.10
WHERE symbol      = 'SAP.DE'
  AND signal_date = '2026-04-08';

SELECT @old_price AS old_price, @new_price AS new_price;

ROLLBACK;
```

| old_price | new_price |
|---:|---:|
| 145.22 | 159.74200000000002 |

*The first assignment `@old_price = current_price` captures the pre-update value. The chained `@new_price = current_price = current_price * 1.10` writes the new value to the column and simultaneously captures it into `@new_price`. For multi-row updates, prefer the `OUTPUT` clause (see next section) — it captures every affected row's before/after values deterministically.*

---

## DELETE Patterns

`DELETE` removes rows from a table. Like `UPDATE`, a missing `WHERE` clause removes every row — but unlike `UPDATE`, there is a faster alternative (`TRUNCATE TABLE`) when every row should go. The choice between `DELETE` and `TRUNCATE` is driven by recoverability requirements, trigger firing behavior, foreign key presence, and identity seed behavior, all documented in the decision matrix near the bottom of this section.

### Searched `DELETE` | remove rows matching a predicate

The standard `DELETE` form removes every row matching a `WHERE` predicate. The rowcount is returned to the client as `@@ROWCOUNT` and via the `(N rows affected)` message. Deleted rows are exclusively locked for the duration of the transaction and written to the transaction log — `DELETE` is always fully logged regardless of recovery model.

> [!info]- Clause-by-clause breakdown
>
> - `DELETE FROM silver.signals_daily` names the target and uses the optional `FROM` keyword — `DELETE silver.signals_daily` without `FROM` is equivalent syntax.
> - `WHERE symbol = 'SAP.DE' AND signal_date = '2026-03-04'` restricts the delete to exactly one row.
> - Verification query shows the remaining row count for the symbol.
> - `ROLLBACK` undoes the delete so the four original SAP.DE rows remain after the demo.

*Delete one specific row and verify the change inside the transaction.*

```sql
USE [stoxx_db];
GO

BEGIN TRAN;

DELETE FROM silver.signals_daily
WHERE symbol      = 'SAP.DE'
  AND signal_date = '2026-03-04';

SELECT @@ROWCOUNT AS deleted_rows;

SELECT COUNT(*) AS remaining_sap_de
FROM silver.signals_daily
WHERE symbol = 'SAP.DE';

ROLLBACK;

SELECT COUNT(*) AS after_rollback
FROM silver.signals_daily
WHERE symbol = 'SAP.DE';
```

| deleted_rows |
|---:|
| 1 |

| remaining_sap_de |
|---:|
| 3 |

| after_rollback |
|---:|
| 4 |

*One row deleted, three SAP.DE rows remain during the transaction, and the `ROLLBACK` restores all four. The pattern demonstrates that `DELETE` is fully transactional and that `@@ROWCOUNT` reflects the actual number of rows modified by the last statement.*

### `DELETE ... FROM ... JOIN` | delete rows by joining to another table

T-SQL extends `DELETE` with a `FROM` clause that can join additional tables. The target table appears twice: once as the target of `DELETE` and once as a (usually aliased) row source in the `FROM` clause. This form is the most compact way to delete rows based on a condition expressed against a related dimension.

> [!info]- Clause-by-clause breakdown
>
> - `DELETE sd FROM silver.signals_daily sd` names the target via its alias.
> - `WHERE NOT EXISTS (SELECT 1 FROM bronze.trading_calendar tc WHERE tc.date = sd.signal_date AND tc.is_trading_day = 1)` is an anti-semi-join: delete signal rows whose date is not a trading day in any exchange calendar.
> - The anti-semi-join pattern with `NOT EXISTS` is usually faster and more deterministic than `LEFT JOIN ... WHERE t2.key IS NULL`, and it handles `NULL` correctly without tripping three-valued logic pitfalls.

*Delete every `silver.signals_daily` row whose date is not a trading day in `bronze.trading_calendar`.*

```sql
USE [stoxx_db];
GO

BEGIN TRAN;

DELETE sd
FROM silver.signals_daily AS sd
WHERE NOT EXISTS (
    SELECT 1
    FROM bronze.trading_calendar AS tc
    WHERE tc.date           = sd.signal_date
      AND tc.is_trading_day = 1
);

SELECT @@ROWCOUNT AS deleted_non_trading;

ROLLBACK;
```

| deleted_non_trading |
|---:|
| 150 |

*Out of 635 rows in `silver.signals_daily`, 150 had signal dates that did not match any trading-day entry in `bronze.trading_calendar`. The `ROLLBACK` keeps all 635 in place. In a real ETL pipeline, this pattern is used to enforce referential integrity against a date dimension when the source data layer is not constrained.*

### `DELETE TOP (n)` | bounded delete without a guaranteed order

`DELETE TOP (n)` removes at most `n` rows matching the predicate. Like `UPDATE TOP`, the selection is non-deterministic without a subquery containing `ORDER BY`. The primary legitimate use of `DELETE TOP` is as the delete step of a batched loop — that use case is shown later in this section.

*Delete at most 10 signal rows whose symbol starts with a digit.*

```sql
USE [stoxx_db];
GO

BEGIN TRAN;

DELETE TOP (10) FROM silver.signals_daily
WHERE symbol LIKE '0%';

SELECT @@ROWCOUNT AS deleted_rows;

ROLLBACK;
```

| deleted_rows |
|---:|
| 4 |

*Only 4 rows match the `symbol LIKE '0%'` predicate in the entire table, so the `TOP (10)` bound is never reached. When the predicate matches more than `n` rows, `TOP (n)` picks any `n` of them — the specific ones chosen depend on the physical plan.*

### Batched `DELETE` | remove millions of rows without blocking the log

When a `DELETE` needs to remove millions of rows from a busy table, a single `DELETE` statement holds row locks for the entire operation, fills up the transaction log, and can escalate to a table lock that blocks every other session. The canonical fix is a **batched loop** that deletes a small chunk at a time, commits each iteration, and stops when no rows remain. This keeps the log footprint small, gives the log backup process time to truncate between batches, and lets blocked sessions get a turn between chunks.

> [!info]- Clause-by-clause breakdown
>
> - `DECLARE @iter INT, @chunk INT, @total_deleted INT, @last_rows INT` sets up the loop counters.
> - `WHILE 1 = 1` is an infinite loop broken out of via `BREAK`.
> - `DELETE TOP (@chunk) FROM silver.signals_daily WHERE market_cap < 50000000000 OR market_cap IS NULL` removes up to `@chunk` rows matching the predicate.
> - `SET @last_rows = @@ROWCOUNT` captures the row count **immediately** after the `DELETE`, before any other statement touches `@@ROWCOUNT`. This is critical: statements like `IF`, `SET`, and `SELECT` all reset `@@ROWCOUNT` to their own value, so reading `@@ROWCOUNT` later in the loop body returns the wrong number.
> - `IF @last_rows = 0 BREAK` exits the loop when the `DELETE` affected no rows (all qualifying rows are gone).
> - A safety cap `IF @iter > 20 BREAK` prevents an infinite loop if the predicate is somehow self-replenishing.

*Delete all low-market-cap signal rows in chunks of 25, tracking total deleted rows via a captured `@@ROWCOUNT`.*

```sql
USE [stoxx_db];
GO

BEGIN TRAN;

DECLARE
    @iter          INT = 0,
    @chunk         INT = 25,
    @total_deleted INT = 0,
    @last_rows     INT;

WHILE 1 = 1
BEGIN
    DELETE TOP (@chunk) FROM silver.signals_daily
    WHERE market_cap < 50000000000
       OR market_cap IS NULL;

    SET @last_rows = @@ROWCOUNT;

    IF @last_rows = 0 BREAK;

    SET @total_deleted += @last_rows;
    SET @iter          += 1;

    IF @iter > 20 BREAK;  -- safety valve
END

SELECT @iter AS batches, @total_deleted AS total_deleted;

ROLLBACK;
```

| batches | total_deleted |
|---:|---:|
| 3 | 62 |

*Three batches of 25, 25, and 12 rows remove 62 rows in total. At production scale, the `@chunk` value is typically between 1 000 and 10 000, and each batch is committed with `COMMIT; BEGIN TRAN;` (or the loop runs without an outer transaction at all). The combination of small chunks and frequent commits lets log backups keep up with the log growth.*

> [!danger] `@@ROWCOUNT` is reset by every statement
>
> `@@ROWCOUNT` reflects the row count of the **most recently executed statement**, including `IF`, `SELECT`, `SET`, and implicit statements inside control flow. Reading `@@ROWCOUNT` after any such statement returns a number unrelated to the DML you care about. The fix is to capture `@@ROWCOUNT` into a local variable on the line immediately after the DML statement and reference the variable everywhere else.

> [!success] Pattern: `DECLARE @rc INT; DELETE ...; SET @rc = @@ROWCOUNT;`
>
> Every batched or conditional DML pattern should capture `@@ROWCOUNT` into a dedicated variable on the next line. Treat `@@ROWCOUNT` as a volatile register that is overwritten on every statement.

### `TRUNCATE TABLE` | remove every row at maximum speed

`TRUNCATE TABLE` removes every row from a table by deallocating its pages. It is faster than `DELETE` without a `WHERE` clause, uses minimal transaction log space, and resets the identity counter to its seed value. It does **not** fire `DELETE` triggers, does **not** work on tables referenced by a foreign key, and does **not** work on tables participating in indexed views, system-versioned temporal tables, or replication.

> [!info]- Clause-by-clause breakdown
>
> - `TRUNCATE TABLE #scratch` removes every row from the temp table by releasing its allocation units.
> - Inside a transaction, `TRUNCATE` is fully rollback-able: the allocation pages are marked for deallocation in the logical phase but not actually returned to the engine until after the commit (the physical phase).

*Truncate a temp table inside a transaction and confirm that `ROLLBACK` restores the rows.*

```sql
USE [stoxx_db];
GO

IF OBJECT_ID('tempdb..#scratch') IS NOT NULL DROP TABLE #scratch;

SELECT symbol, signal_date, current_price
INTO #scratch
FROM silver.signals_daily
WHERE symbol = 'SAP.DE';

SELECT COUNT(*) AS before_truncate FROM #scratch;

BEGIN TRAN;
    TRUNCATE TABLE #scratch;
    SELECT COUNT(*) AS during_truncate FROM #scratch;
ROLLBACK;

SELECT COUNT(*) AS after_rollback FROM #scratch;

DROP TABLE #scratch;
```

| before_truncate |
|---:|
| 4 |

| during_truncate |
|---:|
| 0 |

| after_rollback |
|---:|
| 4 |

*Inside the transaction the table is empty, but the `ROLLBACK` restores all four rows because the page deallocations were still in the logical phase and had not yet been physically released. Once the `COMMIT` happens, `TRUNCATE` releases the pages immediately for tables smaller than 128 extents, or deferred to a background process for larger tables.*

> [!warning] `TRUNCATE TABLE` cannot fire `DELETE` triggers
>
> `TRUNCATE` removes rows by deallocating pages without touching individual rows, so there is no row-level event for trigger binding to observe. Any audit trail or cascade implemented via `AFTER DELETE` or `INSTEAD OF DELETE` triggers will silently miss truncations. If full audit coverage is required, replace `TRUNCATE` with a logged `DELETE` + trigger, or add the `TRUNCATE` event to a database-level DDL trigger (which can see the event even though row-level triggers cannot).

### `DELETE` vs `TRUNCATE TABLE` decision matrix

| Requirement | `DELETE` | `TRUNCATE` |
|---|---|---|
| Fires row-level triggers | ✅ | ❌ |
| Resets `IDENTITY` seed | ❌ | ✅ |
| Logs one record per row | ✅ | ❌ (only page deallocations) |
| Works on FK-referenced tables | ✅ | ❌ |
| Works on indexed views | ✅ | ❌ |
| Works on system-versioned temporal tables | ✅ | ❌ |
| Supports `WHERE` to remove a subset | ✅ | ❌ |
| Can fire database-level DDL trigger | ❌ | ✅ (via `TRUNCATE_TABLE` event) |
| Rollback-able inside a transaction | ✅ | ✅ |
| Supports `OUTPUT` clause | ✅ | ❌ |
| Required permission | `DELETE` on the table | `ALTER` on the table |

---

## The OUTPUT Clause

The `OUTPUT` clause returns information about every row affected by an `INSERT`, `UPDATE`, `DELETE`, or `MERGE` statement. It exposes two virtual pseudo-tables — `INSERTED` and `DELETED` — that mirror the behavior of the same-named pseudo-tables inside triggers. `OUTPUT` is the cleanest way to capture before/after values for an audit trail, to return identity values for freshly inserted rows, to build queue-like dequeue operations, and to compose DML statements into higher-level workflows.

### `INSERTED` and `DELETED` pseudo-tables | which rows are visible from which statement

| Statement | `INSERTED.*` visible | `DELETED.*` visible |
|---|---|---|
| `INSERT` | ✅ new row values | ❌ (no pre-image — raises error if referenced) |
| `UPDATE` | ✅ new row values | ✅ pre-image values |
| `DELETE` | ❌ | ✅ row values as they existed before the delete |
| `MERGE` | ✅ for `INSERT`/`UPDATE` actions | ✅ for `UPDATE`/`DELETE` actions |

Rows returned by `OUTPUT` are **not ordered**. SQL Server does not guarantee that the order of rows in the `OUTPUT` result matches any particular sequence — not primary key order, not insertion order, not the order of the underlying scan. Any consumer that depends on ordering must either sort the captured rows after the fact or use the `OUTPUT INTO` form to capture them and then `SELECT ... ORDER BY`.

### `UPDATE ... OUTPUT` | return before/after values directly to the client

The simplest use of `OUTPUT` on an `UPDATE` returns the pre-image and post-image of every affected row as a result set. The client sees the result set immediately, and the calling application can use it for confirmation messages, diffing, or forwarding to downstream systems.

> [!info]- Clause-by-clause breakdown
>
> - `UPDATE silver.signals_daily SET current_price = current_price * 1.10` increases the price by 10%.
> - `OUTPUT INSERTED.symbol, INSERTED.signal_date, DELETED.current_price AS old_price, INSERTED.current_price AS new_price` projects four columns: identifying key (from INSERTED, though these columns are unchanged), the old price (from DELETED), and the new price (from INSERTED).
> - `WHERE symbol = 'SAP.DE'` restricts the update to the four SAP.DE rows.

*Apply a 10% price bump to every SAP.DE row and return a before/after delta for each affected row.*

```sql
USE [stoxx_db];
GO

BEGIN TRAN;

UPDATE silver.signals_daily
SET current_price = current_price * 1.10
OUTPUT
    INSERTED.symbol,
    INSERTED.signal_date,
    DELETED.current_price  AS old_price,
    INSERTED.current_price AS new_price
WHERE symbol = 'SAP.DE';

ROLLBACK;
```

| symbol | signal_date | old_price | new_price |
|---|---|---:|---:|
| SAP.DE | 2026-03-07 | 172.74000000000001 | 190.01400000000004 |
| SAP.DE | 2026-03-12 | 166.58000000000001 | 183.23800000000003 |
| SAP.DE | 2026-03-04 | 167.38 | 184.11800000000002 |
| SAP.DE | 2026-04-08 | 145.22 | 159.74200000000002 |

*Four rows were updated and four rows were returned to the client — one result set per affected row, all in a single round trip. No separate `SELECT` is needed after the update to verify the change. The row order in the output is not guaranteed to match the `signal_date` order; if the reader needs it ordered, either sort client-side or use the `OUTPUT INTO` pattern below.*

### `OUTPUT ... INTO` table variable | capture affected rows into a server-side collection

`OUTPUT ... INTO` sends the captured rows into a table variable (`@captured`), a temp table (`#captured`), or a permanent table. The rows are available to subsequent statements in the same batch, which enables multi-step workflows where a DML statement and the audit or follow-up logic must share the same definition of "affected rows".

> [!info]- Clause-by-clause breakdown
>
> - `DECLARE @audit TABLE (...)` creates a table variable whose shape matches the columns being captured.
> - `UPDATE silver.signals_daily SET current_price = current_price * 0.95` applies a 5% cut.
> - `OUTPUT INSERTED.symbol, INSERTED.signal_date, DELETED.current_price, INSERTED.current_price, SYSUTCDATETIME() INTO @audit` populates the table variable with five columns: two keys, two prices, and a client-side timestamp.
> - Note that `SYSUTCDATETIME()` in the `OUTPUT` list is **not** a reference to any pseudo-table column — it is a scalar expression evaluated per output row. This is how audit timestamps enter the captured set without needing a trigger.
> - `SELECT * FROM @audit` returns the captured rows to the client. The DML and the reporting query see exactly the same set of rows.

*Apply a 5% price cut to two specific rows and capture every change plus a UTC timestamp into a table variable.*

```sql
USE [stoxx_db];
GO

BEGIN TRAN;

DECLARE @audit TABLE (
    symbol      VARCHAR(20),
    signal_date DATE,
    old_price   FLOAT,
    new_price   FLOAT,
    changed_at  DATETIME2(3)
);

UPDATE silver.signals_daily
SET current_price = current_price * 0.95
OUTPUT
    INSERTED.symbol,
    INSERTED.signal_date,
    DELETED.current_price,
    INSERTED.current_price,
    SYSUTCDATETIME()
INTO @audit
WHERE symbol IN ('ASML.AS', 'MC.PA')
  AND signal_date = '2026-04-08';

SELECT * FROM @audit;

ROLLBACK;
```

| symbol | signal_date | old_price | new_price | changed_at |
|---|---|---:|---:|---|
| ASML.AS | 2026-04-08 | 1113.8 | 1058.1099999999999 | 2026-04-11 04:19:58.547 |
| MC.PA | 2026-04-08 | 466.85000000000002 | 443.50749999999999 | 2026-04-11 04:19:58.547 |

*Two rows captured with pre-image, post-image, and a per-row timestamp. This pattern replaces `AFTER UPDATE` triggers for audit workloads: it is explicit, visible in the source code, and does not add hidden runtime behavior.*

> [!warning] Target of `OUTPUT INTO` has tight restrictions
>
> The destination table of `OUTPUT INTO` cannot have enabled triggers, cannot participate on either side of a foreign key, and cannot have `CHECK` constraints or enabled rules. Table variables and temp tables satisfy all these restrictions naturally. A permanent audit table is valid only if it has no triggers, no FKs, and no constraints beyond `NOT NULL`.

### `DELETE ... OUTPUT` | capture removed rows before they disappear

`DELETE` with `OUTPUT DELETED.*` returns every row that was just removed. This is the canonical pattern for "destructive read" queue-pop operations, where a consumer claims a message by deleting it from the queue table and immediately processing the returned row.

*Delete the oldest SAP.DE signal and return its full row.*

```sql
USE [stoxx_db];
GO

BEGIN TRAN;

DELETE FROM silver.signals_daily
OUTPUT
    DELETED.id,
    DELETED.symbol,
    DELETED.signal_date,
    DELETED.current_price
WHERE symbol      = 'SAP.DE'
  AND signal_date = '2026-03-04';

ROLLBACK;
```

| id | symbol | signal_date | current_price |
|---:|---|---|---:|
| 5 | SAP.DE | 2026-03-04 | 167.38 |

*The deleted row is returned as a result set in the same round trip as the `DELETE`. In a queue scenario, the consumer would wrap this in a transaction, process the message, and then commit — guaranteeing exactly-once semantics as long as the consumer handles its own idempotency.*

> [!tip] `DELETE TOP (1) ... WITH (READPAST) OUTPUT DELETED.*` is the canonical queue pop
>
> For queue-like workloads, combine `DELETE TOP (1)` (one message at a time), the `READPAST` table hint (skip rows currently locked by other consumers), and `OUTPUT DELETED.*` (return the claimed message). This pattern supports multiple concurrent consumers without deadlocks and without needing an application-level queue manager.

### Composable DML | chain a DML statement's `OUTPUT` into another `INSERT`

The **composable DML** form wraps a DML statement with an `OUTPUT` clause in parentheses and uses it as a rowset source for an outer `INSERT` statement. This lets a single batch move rows atomically from one table to another: the inner `DELETE` (or `UPDATE` or `MERGE`) produces the rows, and the outer `INSERT` persists them elsewhere.

> [!info]- Clause-by-clause breakdown
>
> - `INSERT INTO @archive (...) SELECT src.* FROM (...) AS src` reads from a derived table named `src`.
> - The derived table is `(DELETE FROM silver.signals_daily OUTPUT DELETED.* WHERE symbol = 'SAP.DE')` — a `DELETE` with an `OUTPUT` clause, wrapped in parentheses.
> - The outer `INSERT` captures every row the `DELETE` removed and inserts it into `@archive` in one atomic operation. If the outer insert fails for any reason, the delete is rolled back as well.
> - This pattern is the only supported way to achieve transactional "move to archive" semantics without `MERGE` and without manual compensation logic.

*Move all SAP.DE rows from `silver.signals_daily` into an archive table variable in one composable DML statement.*

```sql
USE [stoxx_db];
GO

BEGIN TRAN;

DECLARE @archive TABLE (
    id            INT,
    symbol        VARCHAR(20),
    signal_date   DATE,
    current_price FLOAT
);

INSERT INTO @archive (id, symbol, signal_date, current_price)
SELECT src.id, src.symbol, src.signal_date, src.current_price
FROM (
    DELETE FROM silver.signals_daily
    OUTPUT
        DELETED.id,
        DELETED.symbol,
        DELETED.signal_date,
        DELETED.current_price
    WHERE symbol = 'SAP.DE'
) AS src;

SELECT * FROM @archive;

ROLLBACK;
```

| id | symbol | signal_date | current_price |
|---:|---|---|---:|
| 1006 | SAP.DE | 2026-03-07 | 172.74000000000001 |
| 2025 | SAP.DE | 2026-03-12 | 166.58000000000001 |
| 5 | SAP.DE | 2026-03-04 | 167.38 |
| 3006 | SAP.DE | 2026-04-08 | 145.22 |

*All four SAP.DE rows were deleted from the source and inserted into the archive table variable in one statement. The `DELETE` and `INSERT` are atomic: either both succeed or both are rolled back. The outer `INSERT` can include a `WHERE` clause on the derived table to filter which of the affected rows actually land in the archive — for instance, archiving only the rows whose `current_price` exceeded some threshold.*

> [!warning] Composable DML target has severe restrictions
>
> The target of the **outer** `INSERT` in a composable DML statement cannot be a view or remote table, cannot have triggers, cannot participate in foreign key relationships, and cannot participate in replication. The **inner** DML statement cannot be nested further (no composable DML inside composable DML), cannot contain a `WITH` clause, cannot target remote tables or partitioned views, and cannot be a cursor-based `UPDATE`/`DELETE`. These restrictions make composable DML strictly a tool for dedicated staging/archive tables, not for general application schemas.

> [!danger] `OUTPUT` rows are returned even if the statement fails
>
> Per Microsoft: *"An UPDATE, INSERT, or DELETE statement that has an OUTPUT clause will return rows to the client even if the statement encounters errors and is rolled back."* This means a client that reads the `OUTPUT` result set and uses it for business logic can act on rows that were never actually persisted. Always check for errors (or use `XACT_ABORT ON` + `TRY/CATCH`) before trusting `OUTPUT` results, and never treat `OUTPUT` as the sole commit signal.

### `MERGE` and `OUTPUT $action` | pointer

`MERGE` statements can use `OUTPUT` with a special `$action` column that returns `'INSERT'`, `'UPDATE'`, or `'DELETE'` for each affected row, identifying which merge branch produced the row. See [[11-merge-and-upsert]] for the full treatment.

---

## Transactions, Errors, and Halloween Protection

All SQL Server DML runs inside a transaction, but the behavior of that transaction under errors depends on three settings: `XACT_ABORT`, `SET IMPLICIT_TRANSACTIONS`, and the presence of `TRY/CATCH` blocks. Incorrect combinations leave partial changes committed, dangling open transactions, or swallow errors that should have surfaced.

### Explicit transactions | `BEGIN TRAN`, `COMMIT`, `ROLLBACK`

An **explicit transaction** is opened with `BEGIN TRAN`, closed with `COMMIT TRAN`, and aborted with `ROLLBACK TRAN`. Every DML statement between the `BEGIN` and the `COMMIT` is part of the same transaction, and either all of them commit or none of them do. Explicit transactions are the right default for any multi-statement operation that must be atomic.

*Atomically update two symbols in one transaction, commit both, and verify.*

```sql
USE [stoxx_db];
GO

BEGIN TRAN;

UPDATE silver.signals_daily
SET current_price = current_price * 1.02
WHERE symbol = 'ASML.AS' AND signal_date = '2026-04-08';

UPDATE silver.signals_daily
SET current_price = current_price * 1.02
WHERE symbol = 'MC.PA'   AND signal_date = '2026-04-08';

ROLLBACK;  -- demo: roll back so state is preserved
```

*Both updates are part of the same transaction. A `COMMIT` at the end would persist both; `ROLLBACK` undoes both. There is no state in which only the ASML.AS update is persisted but the MC.PA update is not.*

### `TRY/CATCH` + `XACT_ABORT` | standard error-handling envelope

SQL Server's structured error handling consists of three pieces: `SET XACT_ABORT ON` forces the whole transaction to roll back on any run-time error (instead of silently continuing), the `TRY/CATCH` block catches the error so the client sees a controlled response, and `XACT_STATE()` reports whether the transaction is still active, doomed, or already rolled back.

> [!info]- Clause-by-clause breakdown
>
> - `SET XACT_ABORT ON` is the single most important switch for DML reliability. With it off, a deadlock victim or a check-constraint violation leaves the transaction active; with it on, any such error triggers an automatic rollback and the transaction is doomed (XACT_STATE = -1).
> - `BEGIN TRAN` opens the transaction.
> - `BEGIN TRY ... END TRY` surrounds the statements that might fail.
> - The first `UPDATE` succeeds and updates 4 ASML.AS rows.
> - The second `UPDATE` intentionally divides by zero to trigger error 8134.
> - Control transfers to `BEGIN CATCH ... END CATCH`.
> - `IF XACT_STATE() <> 0 ROLLBACK` rolls back the transaction if it is still active (state 1) or doomed (state -1). Skipping this step leaves the connection in an open transaction that blocks every other session.
> - The final `SELECT` returns the captured error information to the client.

*Wrap two updates in a `TRY/CATCH` block with `XACT_ABORT ON`; the second update fails and both updates are rolled back atomically.*

```sql
USE [stoxx_db];
GO

SET XACT_ABORT ON;

BEGIN TRAN;

BEGIN TRY
    UPDATE silver.signals_daily
    SET current_price = current_price * 1.05
    WHERE symbol = 'ASML.AS';

    UPDATE silver.signals_daily
    SET current_price = current_price / 0
    WHERE symbol = 'SAP.DE';

    COMMIT;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;

    SELECT
        ERROR_NUMBER()  AS err_no,
        ERROR_MESSAGE() AS err_msg,
        XACT_STATE()    AS xact_state;
END CATCH;
```

| err_no | err_msg | xact_state |
|---:|---|---:|
| 8134 | Divide by zero error encountered. | 0 |

*The first update affected 4 ASML.AS rows, then the second update hit the divide-by-zero error and the whole transaction was rolled back by `XACT_ABORT`. After the `CATCH` block executes, `XACT_STATE() = 0` confirms the transaction is no longer open. A follow-up `SELECT MAX(current_price) FROM silver.signals_daily WHERE symbol = 'ASML.AS'` shows the original maximum price, proving the rollback restored the ASML.AS rows that had already been updated earlier in the transaction.*

> [!danger] `SET XACT_ABORT OFF` is the default and it is unsafe for DML
>
> With `XACT_ABORT OFF`, many runtime errors (divide by zero, arithmetic overflow, deadlock victim, some constraint violations) leave the transaction **active**. The next statement continues to execute as if nothing happened, and a `COMMIT` at the end persists an inconsistent state. The connection-level default depends on the driver: ODBC and SQLClient usually default to ON, OLE DB often defaults to OFF. Set it explicitly at the top of any batch that contains DML.

> [!success] Always begin DML batches with `SET XACT_ABORT ON; SET NOCOUNT ON;`
>
> `SET XACT_ABORT ON` makes transaction behavior predictable. `SET NOCOUNT ON` suppresses the "(N rows affected)" messages so the client protocol is not polluted with row-count metadata. Together they form the standard prolog for any production stored procedure or DML batch.

### Halloween Protection | why SQL Server adds a spool to some UPDATE plans

The **Halloween problem** occurs when an `UPDATE` statement modifies a column that is used in its own search predicate or join. Naïvely executed, the update would re-read rows it already updated and modify them again, producing endless work or wrong results. SQL Server detects this pattern and inserts a blocking spool (typically an eager spool) into the plan to materialize all affected rows before any updates are applied. This is **Halloween Protection**, and it is the reason many seemingly simple updates show a spool operator in their plan.

*A canonical example: incrementing a key column that is part of an index used for the lookup.*

```sql
USE [stoxx_db];
GO

-- Conceptual example (not executed because silver.signals_daily has no index on market_cap):
-- UPDATE silver.signals_daily
-- SET market_cap = market_cap + 1
-- WHERE market_cap < 50000000000;
```

*In a plan for this statement, SQL Server would insert an eager spool just above the `UPDATE` operator. The spool reads every qualifying row into a worktable, then the update writes them back — decoupling the read from the write and preventing the "update visible to next seek" cascade. The cost is CPU and `tempdb` memory for the spool, but the correctness guarantee is non-negotiable.*

> [!info] Why it's called "Halloween"
>
> The term dates to 1976, when IBM researchers discovered the problem while testing System R on Halloween. The name stuck. The SQL Server optimizer flags the condition as `Halloween Protection Required` in its output.

---

## Performance Patterns

### Minimally logged operations | drop transaction log volume on bulk loads

Some DML patterns can be **minimally logged** instead of fully logged, recording only extent-level allocation pages instead of per-row log records. Minimal logging can drop log volume by 10× or more on large loads. It requires all of the following conditions:

- The database must be in `BULK_LOGGED` or `SIMPLE` recovery model (not `FULL`).
- The target table must be a heap (no clustered index) — or be partitioned with specific partition-switch patterns.
- The load statement must use one of the minimally logged forms: `BULK INSERT`, `INSERT ... SELECT ... WITH (TABLOCK)`, `SELECT INTO`, or `bcp` from a client tool.
- `TABLOCK` (or `BULK_UPDATE` lock) must be in effect on the target so the optimizer can use the minimally logged code path.
- If the target already contains rows, the target must either be empty or the `INSERT` must target a new partition/filegroup.

In `FULL` recovery (the default on `stoxx_db`), even `BULK INSERT` with `TABLOCK` is fully logged — the recovery model override is mandatory. Switching a production database to `BULK_LOGGED` is acceptable during maintenance windows but must be coupled with a log backup immediately after the bulk operation to preserve the log backup chain.

### Batching large DML | split a huge operation into manageable chunks

A single `DELETE` or `UPDATE` that affects millions of rows holds locks for the entire duration, balloons the transaction log, and can escalate to a full table lock. The canonical remediation is to loop with a bounded `TOP (n)` DML statement, commit after each chunk, and stop when `@@ROWCOUNT` reports zero. The batched delete pattern earlier in this note is the template; the same structure applies to batched `UPDATE` and batched `INSERT ... SELECT`.

| Chunk size | Typical workload fit |
|---:|---|
| 100–1 000 | Highly contended OLTP target |
| 1 000–10 000 | Standard OLTP cleanup, background jobs |
| 10 000–100 000 | Warehouse staging table, low-contention targets |
| > 100 000 | Usually unnecessary — diminishing returns and more log volume per batch |

### Row-by-row anti-pattern | "RBAR"

Processing DML row-at-a-time via a cursor or a `WHILE` loop over a key column is the most common performance anti-pattern in T-SQL. It multiplies per-row overhead (logging, locking, stats updates, trigger invocations) by the number of rows, turning a 200 ms set-based operation into a 20 minute cursor loop. The fix is always to rewrite the logic as a set-based `INSERT ... SELECT`, `UPDATE ... FROM ... JOIN`, or `MERGE`. The only legitimate row-at-a-time use cases are genuinely sequential algorithms (running totals before window functions existed, recursive graph traversal where a CTE is insufficient, external API calls that must happen per row) — and even then, batching into chunks of 100+ rows per iteration is usually preferable to true RBAR.

---

## Anti-Patterns

### `UPDATE` without `WHERE` | updates every row silently

Missing a `WHERE` clause produces a statement that compiles, executes without warning, and touches every row in the table. On a large table, this can be unrecoverable without a restore from backup. Guard against it by opening DML in an explicit transaction (`BEGIN TRAN`) and only committing after a row-count sanity check.

### `DELETE` without `WHERE` when `TRUNCATE` would do

When every row should be removed, `DELETE` without `WHERE` is slower than `TRUNCATE`, generates a log record per row, and leaves empty pages allocated on a heap unless a `TABLOCK` hint is used. Prefer `TRUNCATE TABLE` when FK, trigger, and identity-reset semantics permit it.

### `SELECT INTO` as a production table creation mechanism

`SELECT INTO` is fast but creates a table without primary key, foreign keys, check constraints, defaults, indexes, or triggers. Using it to materialize a production table guarantees the next developer has to add everything back by hand, usually after an incident. Reserve `SELECT INTO` for throwaway analysis and temp-table staging.

### `UPDATE` with non-deterministic `FROM ... JOIN`

When the source table joined to the update target has multiple matching rows per target row, SQL Server arbitrarily picks one. The picked row is stable on a particular plan but changes when statistics are updated, when new rows are added to the source, or when the plan is evicted from cache. Pre-aggregate the source with a CTE that produces at most one row per target key.

### `@@IDENTITY` in application code

`@@IDENTITY` returns the most recent identity value from **any scope in the current session**, including trigger-inserted rows in a completely unrelated table. Application code that calls `SELECT @@IDENTITY` after an `INSERT` to learn the new row's key breaks silently the first day an `AFTER INSERT` trigger with its own identity column is added. Use `SCOPE_IDENTITY()` unconditionally.

### Cursor loops for bulk DML

Cursor-based `FETCH ... DML` loops run the DML statement one row at a time, multiplying every per-statement cost by the row count. For any DML that can be expressed set-based (which is nearly all of it), the cursor form is 10× to 1000× slower. Replace cursors with set-based `INSERT ... SELECT`, `UPDATE ... FROM ... JOIN`, `DELETE ... FROM ... JOIN`, or `MERGE`.

### `OUTPUT` as the only success signal

`OUTPUT` rows are emitted to the client stream even when the statement fails and rolls back. Treating a non-empty `OUTPUT` result as proof of commit is unsafe. Pair `OUTPUT` with `XACT_ABORT ON` + `TRY/CATCH` and only act on captured rows after a successful `COMMIT`.

---

## Decision Guide

Use this table to choose the right DML tool for a given scenario.

| Scenario | Recommended statement |
|---|---|
| Insert one row with literal values | `INSERT ... VALUES (...)` |
| Insert 2–1 000 literal rows | `INSERT ... VALUES (...), (...), ...` (table value constructor) |
| Insert 1 000+ literal rows | `INSERT ... SELECT ... FROM (VALUES (...)) AS t(...)` |
| Insert from another table/view in the same DB | `INSERT ... SELECT` |
| Insert from another table in a different DB / instance | `INSERT ... SELECT` with three-part name, or `INSERT ... EXEC` with a linked server call |
| Insert from a stored procedure result | `INSERT ... EXEC` |
| Create a new table from a query (throwaway) | `SELECT ... INTO` |
| Create a new table from a query (production) | `CREATE TABLE ...` + `INSERT ... SELECT` |
| Load a CSV file | `BULK INSERT` (simple) or `OPENROWSET(BULK ...)` (with pre-filtering) |
| Update one row by key | `UPDATE ... WHERE <key>` |
| Update rows using a lookup | `UPDATE ... FROM ... JOIN` (with CTE for determinism) |
| Update rows based on an aggregate | `UPDATE` with CTE or correlated subquery in `SET` |
| Update rows deterministically bounded to `N` | `UPDATE` joined to a derived table with `SELECT TOP (N) ... ORDER BY` |
| Delete one row by key | `DELETE ... WHERE <key>` |
| Delete every row (no constraints in the way) | `TRUNCATE TABLE` |
| Delete every row (triggers / FKs) | `DELETE` without `WHERE` |
| Delete millions of rows without log blowup | `WHILE 1 = 1 BEGIN DELETE TOP (N) ... END` batched loop |
| Capture old/new values of an update | `UPDATE ... OUTPUT DELETED.col, INSERTED.col` |
| Build an audit trail without a trigger | `UPDATE ... OUTPUT ... INTO` audit table |
| Destructive read / queue pop | `DELETE TOP (1) WITH (READPAST) ... OUTPUT DELETED.*` |
| Move rows between tables atomically | Composable DML: `INSERT ... SELECT ... FROM (DELETE ... OUTPUT DELETED.*) src` |
| Upsert (insert-or-update) | `MERGE` — see [[11-merge-and-upsert]] |

---
