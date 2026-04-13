---
title: "10 - INSERT, UPDATE, DELETE, and OUTPUT Patterns"
tags: [sql-server, tsql, query-writing, dml]
aliases: [DML patterns, INSERT, UPDATE, DELETE, OUTPUT clause, BULK INSERT, SCOPE_IDENTITY, SEQUENCE, SELECT INTO, composable DML]
description: "Production reference for SQL Server data modification: INSERT (VALUES, SELECT, EXEC, SELECT INTO, BULK INSERT, OPENROWSET), UPDATE (searched, FROM/JOIN, TOP, CTE, view), DELETE (searched, joined, TOP, batched, TRUNCATE), the OUTPUT clause (INSERTED/DELETED, audit trail, composable DML), identity and SEQUENCE semantics, transactions, error handling, concurrency, and performance."
created: 2026-04-11
updated: 2026-04-11
status: complete
---

# INSERT, UPDATE, DELETE, and OUTPUT Patterns

> [!abstract]- Summary
>
> T-SQL data modification is a set-based, transactional surface: every application write, ETL load, cleanup job, and corrective fix ultimately resolves to `INSERT`, `UPDATE`, `DELETE`, or `OUTPUT`, and this note maps the safe patterns, logging behavior, identity rules, and decision boundaries for each.
>
> **Conceptual model**
> - establishes the shared invariants for DML: set-based execution, implicit transactionality, and the statement-level comparison between `INSERT`, `UPDATE`, `DELETE`, and `TRUNCATE`
>
> **Insert patterns**
> - covers literal-row inserts, multi-row table value constructors, `INSERT ... SELECT`, `INSERT ... EXEC`, `SELECT INTO`, bulk load forms, and the cases where minimal logging is available
>
> **Identity and sequence semantics**
> - covers `IDENTITY`, `SCOPE_IDENTITY()`, `@@IDENTITY`, `IDENT_CURRENT`, and `SEQUENCE` behavior around row creation and key retrieval
>
> **Update and delete patterns**
> - covers searched DML, joined updates and deletes, deterministic `TOP (N)` patterns, batching, and `TRUNCATE` versus row-logged delete behavior
>
> **The `OUTPUT` clause**
> - covers `INSERTED` and `DELETED` row images, audit capture, composable DML, and destructive-read queue patterns
>
> **Transactions and performance**
> - covers error handling, `XACT_ABORT`, Halloween protection, minimal logging boundaries, batching large DML, and row-by-row anti-patterns
>
> **Operations and safety**
> - Warnings: missing `WHERE` clauses can affect every row, `@@IDENTITY` leaks across trigger scope, `SELECT INTO` omits production constraints, nondeterministic joined updates can pick arbitrary source rows, `OUTPUT` can emit rows before rollback, and cursor-style RBAR DML destroys throughput
> - Recommendations: prefer set-based DML, use explicit transactions for risky changes, use `SCOPE_IDENTITY()`, pre-aggregate joined update sources to one row per target key, batch very large modifications, and choose `TRUNCATE` only when its lock, trigger, and FK semantics are acceptable

> [!note]- Glossary
>
> **Data modification language**
> - The T-SQL statement family that changes stored data, primarily `INSERT`, `UPDATE`, `DELETE`, and related features such as `OUTPUT` and `TRUNCATE`.
> - It matters because the note is not about query-only logic; it is about the write surface that changes persistent state and therefore carries higher operational risk.
>
> > [!warning] Write operations change more than rows
> >
> > DML affects transaction log growth, locking, triggers, and downstream consumers. Treating it like “just another query” is how routine maintenance turns into outages.
>
> ---
>
> **Set-based execution**
> - The rule that a DML statement logically operates on the entire qualifying rowset at once rather than looping row by row.
> - It matters because correct SQL Server write patterns are expressed as one statement over a set, not as procedural per-row code.
>
> > [!info] SQL Server optimizes the set, not the loop
> >
> > A single statement gives the optimizer freedom to choose an efficient plan. Row-by-row loops surrender that advantage and multiply overhead.
>
> ---
>
> **Implicit transaction**
> - The statement-level transaction SQL Server creates automatically when DML runs outside an explicit `BEGIN TRAN`.
> - It matters because every data change is atomic even when the author does not write explicit transaction control.
>
> > [!warning] Autocommit is still transactional
> >
> > A successful statement commits in full and a failed statement rolls back in full. The absence of explicit `BEGIN TRAN` does not mean the change is non-transactional.
>
> ---
>
> **Table value constructor**
> - The multi-row `VALUES (...), (...), ...` syntax that supplies several literal rows to one `INSERT` statement.
> - It matters because it is the cleanest insert form for small fixed row batches before bulk or staging patterns become necessary.
>
> > [!warning] Practical limits still apply
> >
> > The constructor is convenient, but it is not a bulk-load substitute. Large literal batches become awkward quickly and have engine limits that staging patterns avoid.
>
> ---
>
> **`SELECT INTO`**
> - The statement form that creates a new table from a query result and loads it in the same operation.
> - It matters because it is fast for staging and analysis, but dangerous when mistaken for a production table-creation workflow.
>
> > [!warning] Structure is copied, not governance
> >
> > `SELECT INTO` does not recreate primary keys, foreign keys, defaults, checks, indexes, or triggers. It is a convenience for transient tables, not a substitute for designed schema.
>
> ---
>
> **Minimal logging**
> - A reduced-logging write path available only for certain bulk-oriented operations under specific recovery-model and table-shape conditions.
> - It matters because bulk loads can be dramatically faster and lighter on the log when the engine is allowed to take this path.
>
> > [!warning] Recovery model is part of the contract
> >
> > Many authors remember `TABLOCK` and forget the recovery-model requirement. In `FULL` recovery, the hoped-for minimal logging often does not happen.
>
> ---
>
> **`BULK INSERT` / `OPENROWSET(BULK ...)`**
> - SQL Server’s file-ingest surfaces for loading or reading external data into a table or query.
> - It matters because they are the canonical high-volume entry points for CSV and other external file formats in DML workflows.
>
> > [!info] Load surface and analysis surface differ
> >
> > `BULK INSERT` is focused on loading tables. `OPENROWSET(BULK ...)` can also participate in query pipelines where the file data must be filtered or reshaped first.
>
> ---
>
> **`SCOPE_IDENTITY()`**
> - The function that returns the most recent identity value generated in the current session and current scope.
> - It matters because it is the safe default for discovering the key assigned by an `INSERT` in application and procedural code.
>
> > [!warning] Scope is the reason this is safe
> >
> > `@@IDENTITY` can be polluted by trigger activity in the same session. `SCOPE_IDENTITY()` avoids that cross-scope leakage and should be the normal choice.
>
> ---
>
> **`SEQUENCE`**
> - A schema-level object that generates ordered numeric values independently of any single table.
> - It matters because it decouples number generation from one target table and supports patterns where several tables or statements need the same allocator.
>
> > [!warning] Sequence consumption is outside row insert success
> >
> > Once a sequence value is taken, gaps are possible if the statement rolls back or skips a row. That is normal behavior, not a defect.
>
> ---
>
> **`OUTPUT` clause**
> - The DML extension that returns row images from the `INSERTED` and `DELETED` pseudo-tables during `INSERT`, `UPDATE`, and `DELETE`.
> - It matters because it is the built-in mechanism for audit capture, destructive reads, and composable DML pipelines without triggers.
>
> > [!warning] Emitted rows do not prove commit
> >
> > `OUTPUT` can stream rows even if the enclosing statement later fails and rolls back. Treat captured rows as tentative until the transaction has committed.
>
> ---
>
> **`INSERTED` / `DELETED` pseudo-tables**
> - The transient row images SQL Server exposes during DML to represent the after-state and before-state of affected rows.
> - It matters because `OUTPUT` and DML triggers both depend on these logical rowsets to inspect what changed.
>
> > [!info] Row images are set-shaped too
> >
> > These are not single-row variables. A statement that affects many rows populates `INSERTED` and `DELETED` with many rows.
>
> ---
>
> **Halloween protection**
> - The optimizer safeguard that prevents an update or delete from repeatedly requalifying rows as it modifies the same data it is scanning.
> - It matters because write plans often contain extra spool or blocking operators specifically to preserve correctness during self-referential DML.
>
> > [!info] Extra work can be correctness work
> >
> > Not every spool in a DML plan is a performance smell. Some exist because the engine must prevent a row from being modified twice by one statement.
>
> ---
>
> **Batched DML**
> - The pattern of splitting a very large modification into repeated smaller statements, typically using `TOP (N)` and a loop.
> - It matters because large one-shot updates or deletes can explode the transaction log, escalate locks, and hold resources for too long.
>
> > [!warning] One giant transaction is rarely the safest option
> >
> > Even when SQL Server can finish a huge statement, the operational side effects may be unacceptable. Batching trades some simplicity for far better control.
>
> ---
>
> **`TRUNCATE TABLE`**
> - The deallocation-oriented table-clearing statement that removes all rows without logging one delete record per row.
> - It matters because it is often the fastest way to empty a table, but its semantics differ materially from `DELETE`.
>
> > [!warning] Faster does not mean equivalent
> >
> > `TRUNCATE` resets identity values, does not fire delete triggers, and cannot be used when foreign-key rules disallow it. It should be chosen for its semantics, not just its speed.

## Conceptual Model

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

This matrix answers the first decision every engineer faces when touching data: which statement is the right tool? The sections below document every row of the matrix with a concrete example and its output captured from the `stoxx_db` database.

---

## INSERT Patterns

`INSERT` adds new rows to a table. SQL Server offers six orthogonal input forms for the same statement: a literal value list, a multi-row table value constructor, a `SELECT` derived table, the result set of a stored procedure, `DEFAULT VALUES` for rows built entirely from defaults, and bulk forms (`BULK INSERT`, `OPENROWSET(BULK ...)`) that read from external files. Each form has a specific use case — choosing the right one matters far more for clarity than for raw performance at small row counts, and for raw performance once the row count grows into the thousands or millions.

### `INSERT ... VALUES` | single row with literal values

The simplest form of `INSERT` provides a value for each column in a literal list. When the target contains an `IDENTITY` column or a column with a default, those columns must be omitted from the column list and the value list so SQL Server can compute the correct value.

> [!info]- Clause-by-clause breakdown
>
> - `INSERT INTO bronze.dim_country (country_name, iso_alpha2)` names the target table and the two columns that receive values. Both columns are `NOT NULL`, so both must be supplied.
> - `VALUES (N'Atlantis', 'ZZ')` provides the literal row. The `N` prefix marks the string as Unicode so it is directly compatible with the `nvarchar(200)` column.

*Insert a single country row into `bronze.dim_country`.*

```sql
USE [stoxx_db];
GO

INSERT INTO bronze.dim_country (country_name, iso_alpha2)
VALUES (N'Atlantis', 'ZZ');

SELECT country_name, iso_alpha2
FROM bronze.dim_country
WHERE iso_alpha2 = 'ZZ';
```

| country_name | iso_alpha2 |
|---|---|
| Atlantis | ZZ |

*One row inserted, verified by the follow-up `SELECT`. The `INSERT` returns `(1 rows affected)` to the client and increments any row-count metric tied to the statement.*

### `INSERT ... VALUES` with table value constructor | insert multiple rows in one statement

The Transact-SQL **table value constructor** lets a single `INSERT` statement supply many rows in one `VALUES` clause. Every row constructor must have the same number of values and the same column order. This is a single logical statement: it takes one table-level lock, writes one entry to the transaction log for each row, and either inserts every row or none of them.

> [!info]- Clause-by-clause breakdown
>
> - One `INSERT` statement targets `bronze.dim_country` with three row constructors separated by commas.
> - Every parenthesized tuple `(N'...', '...')` is one row and must match the column list in order.
> - SQL Server treats the whole statement as a single transaction unit — if any row violates a constraint, the entire `INSERT` fails and none of the rows are persisted.
> - The limit on rows per table value constructor is 1 000. Beyond that, split into multiple `INSERT` statements or use `INSERT ... SELECT FROM (VALUES ...) AS t(...)`.

*Insert three fictional countries in one statement using the table value constructor.*

```sql
USE [stoxx_db];
GO

INSERT INTO bronze.dim_country (country_name, iso_alpha2)
VALUES
    (N'Wakanda', 'WK'),
    (N'Genovia', 'GV'),
    (N'Narnia',  'NN');

SELECT country_name, iso_alpha2
FROM bronze.dim_country
WHERE iso_alpha2 IN ('WK', 'GV', 'NN')
ORDER BY iso_alpha2;
```

| country_name | iso_alpha2 |
|---|---|
| Genovia | GV |
| Narnia | NN |
| Wakanda | WK |

*Three rows inserted in one round trip. The client receives `(3 rows affected)` — a single statement, not three. If any one of the rows had violated a constraint (for instance, a `NULL` in a `NOT NULL` column), all three would have been rejected together.*

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
> - `INSERT INTO dbo.insert_log (target_table, new_id)` names the destination and the two non-default columns.
> - `SELECT 'silver.signals_daily', id` projects a constant table name and the identity column of the source rows.
> - `FROM silver.signals_daily WHERE symbol = 'SAP.DE'` selects the five SAP.DE rows.
> - `dbo.insert_log` has `log_id` (identity) and `logged_at` / `logged_by` columns with defaults, so they are not named in the column list and are populated automatically.

*Log every SAP.DE signal id into the audit table `dbo.insert_log`.*

```sql
USE [stoxx_db];
GO

INSERT INTO dbo.insert_log (target_table, new_id)
SELECT 'silver.signals_daily', id
FROM silver.signals_daily
WHERE symbol = 'SAP.DE';

SELECT log_id, target_table, new_id, logged_at
FROM dbo.insert_log
ORDER BY log_id DESC;
```

| log_id | target_table | new_id | logged_at |
|---:|---|---:|---|
| 4 | silver.signals_daily | 3006 | 2026-04-11 11:30:59.566 |
| 3 | silver.signals_daily | 5 | 2026-04-11 11:30:59.566 |
| 2 | silver.signals_daily | 2025 | 2026-04-11 11:30:59.566 |
| 1 | silver.signals_daily | 1006 | 2026-04-11 11:30:59.566 |

*Every SAP.DE signal id is now recorded in `dbo.insert_log` with the logging timestamp and logging principal populated from defaults. This is the standard pattern for write-time logging inside an application transaction: a single `INSERT ... SELECT` replaces any row-by-row logging loop.*

> [!tip] Match destination columns by position, not by name
>
> `INSERT ... SELECT` matches projected columns to the destination column list by **position**, not by name. A mismatched order causes either a conversion error or, worse, silently loads data into the wrong column. Always spell out both column lists explicitly.

### `INSERT ... EXEC` | load rows from a stored procedure or dynamic SQL result set

`INSERT ... EXEC` captures the result set returned by a stored procedure (or a dynamic SQL batch) and inserts it into a table. The destination columns must be compatible with the shape of the result set. This pattern is the canonical way to persist the output of a report procedure or a system DMV query.

> [!info]- Clause-by-clause breakdown
>
> - A temp table `#db_list` is created with the three columns `sp_databases` returns.
> - `INSERT INTO #db_list ... EXEC sys.sp_databases` captures the result set of the system stored procedure directly into the temp table.
> - `sp_databases` is a system procedure that returns `DATABASE_NAME`, `DATABASE_SIZE`, and `REMARKS`.
> - Temp tables are used here because an `INSERT ... EXEC` cannot target a table variable reliably across all result-set shapes.

*Capture the result of `sys.sp_databases` into a temp table.*

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

SELECT TOP (5) database_name, database_size
FROM #db_list
ORDER BY database_size DESC;

DROP TABLE #db_list;
```

| database_name | database_size |
|---|---:|
| stoxx | 1720320 |
| stoxx_db | 1048576 |
| tempdb | 73728 |
| msdb | 16960 |
| model | 16384 |

*`sp_databases` returns one row per online database with its size in KB. The `INSERT ... EXEC` form works with any procedure that returns a tabular result set — including undocumented procs and dynamic SQL built with `sp_executesql`.*

> [!warning] `INSERT ... EXEC` cannot be nested
>
> If procedure A is being called with `INSERT ... EXEC` and procedure A itself tries another `INSERT ... EXEC`, SQL Server raises error 8164: *"An INSERT EXEC statement cannot be nested."* This limitation is the main reason `sp_executesql` and table-valued parameters (TVPs) exist as alternatives for result-set passing between procedures.

### `INSERT ... DEFAULT VALUES` | rely entirely on defaults

`INSERT ... DEFAULT VALUES` inserts a new row where every column takes its default value. For columns without a default but declared `NULL`, the inserted value is `NULL`. For `IDENTITY` columns, the next identity value is produced. The form is mainly useful for append-only header tables where the default constraints define everything the row needs.

> [!info]- Clause-by-clause breakdown
>
> - A temp table `#pings` has an `IDENTITY` primary key and a `datetime2` default of `SYSUTCDATETIME()`, plus a third column with a literal string default. Every column has an automatic value source.
> - Three consecutive `INSERT INTO #pings DEFAULT VALUES` statements each produce one row whose every column comes from the corresponding default or identity mechanism.

*Insert three rows into a temp table purely from defaults.*

```sql
USE [stoxx_db];
GO

IF OBJECT_ID('tempdb..#pings') IS NOT NULL DROP TABLE #pings;

CREATE TABLE #pings (
    ping_id  INT IDENTITY(1,1) PRIMARY KEY,
    ping_at  DATETIME2(3) NOT NULL CONSTRAINT df_pings_at DEFAULT SYSUTCDATETIME(),
    source   VARCHAR(20)  NOT NULL CONSTRAINT df_pings_src DEFAULT 'app-1'
);

INSERT INTO #pings DEFAULT VALUES;
INSERT INTO #pings DEFAULT VALUES;
INSERT INTO #pings DEFAULT VALUES;

SELECT * FROM #pings ORDER BY ping_id;

DROP TABLE #pings;
```

| ping_id | ping_at | source |
|---:|---|---|
| 1 | 2026-04-11 11:31:12.226 | app-1 |
| 2 | 2026-04-11 11:31:12.226 | app-1 |
| 3 | 2026-04-11 11:31:12.231 | app-1 |

*Three rows produced, each with a fresh `IDENTITY` value, the current UTC timestamp, and the literal default string. `DEFAULT VALUES` is the only way to insert a row without naming any columns explicitly.*

### `SELECT ... INTO` | create a new table and insert rows in one statement

`SELECT INTO` is a shortcut that creates a brand-new table (permanent or temporary) from the result of a `SELECT` and populates it in one step. The destination must not exist already. The new table inherits column names and data types from the source projection but **does not** inherit indexes, constraints, defaults, or filegroup placement.

> [!info]- Clause-by-clause breakdown
>
> - `SELECT ... INTO #top_signals` creates a temp table named `#top_signals` and inserts every row returned by the query into it.
> - The projected columns (`symbol`, `signal_date`, `forward_pe`, `beta`) become the columns of the new table with their source types.
> - Because the source columns are all nullable, the new temp table's columns are also nullable. Constraints are not copied.

*Create a temp table holding the 100 highest-beta rows from `silver.signals_daily`.*

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

*`SELECT INTO` produces a fresh temp table in one statement — there is no separate `CREATE TABLE`. It is convenient for ad-hoc analysis and staging but should not replace a deliberately designed target.*

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
> - `FROM '/var/opt/mssql/imports/dim_country.csv'` is the filesystem path on the SQL Server host. On a Windows-hosted SQL Server, the equivalent path would be `N'E:\SQLImports\dim_country.csv'` or any other directory the SQL Server service account can read.
> - `WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0d0a', TABLOCK)` specifies: modern CSV format (SQL Server 2017+), skip the header row, comma delimiter, Windows CRLF row terminator, and take a full table lock for minimally logged insert speed.
> - Row terminator encoding matters: `0x0a` is a Unix `\n`, `0x0d0a` is a Windows `\r\n`. Picking the wrong one causes the trailing `\r` character to be parsed as part of the last column and produces bulk load truncation errors (msg 4863).
> - On a Windows-hosted SQL Server, the optional `CODEPAGE='65001'` parameter forces UTF-8 interpretation of the source bytes. This parameter is **not** supported on SQL Server for Linux (error 16202) and must be omitted in containerized Linux environments.

*Bulk-load `dim_country.csv` into `bronze.dim_country`.*

```sql
USE [stoxx_db];
GO

BULK INSERT bronze.dim_country
FROM '/var/opt/mssql/imports/dim_country.csv'
WITH (
    FORMAT          = 'CSV',
    FIRSTROW        = 2,
    FIELDTERMINATOR = ',',
    ROWTERMINATOR   = '0x0d0a',
    TABLOCK
);

SELECT COUNT(*) AS rows_now FROM bronze.dim_country;
```

| rows_now |
|---:|
| 428 |

*Before the bulk load, `bronze.dim_country` held 216 rows (the original 212 plus the four literal inserts earlier in this section). The CSV contains 212 rows which are appended to the table without deduplication, producing 428 rows total. The equivalent statement on a Windows-hosted SQL Server uses a Windows drive letter path and identical `WITH` options. The `CODEPAGE='65001'` parameter can be added on Windows when the source file uses UTF-8 and the target column collation is also UTF-8.*

*Windows parallel example (syntax only):*

```sql
BULK INSERT bronze.dim_country
FROM N'E:\SQLImports\dim_country.csv'
WITH (
    FORMAT          = 'CSV',
    FIRSTROW        = 2,
    FIELDTERMINATOR = ',',
    ROWTERMINATOR   = '0x0d0a',
    CODEPAGE        = '65001',
    TABLOCK
);
```

> [!warning] File path is resolved on the SQL Server machine
>
> `BULK INSERT` does **not** read files from the client. It reads from the filesystem seen by the SQL Server service account. On a Linux container this means the path must exist inside the container or on a volume mounted into it. On Windows, the SQL Server service account must be able to reach the path and have `NTFS read` permission on the file.

> [!success] Grant `ADMINISTER BULK OPERATIONS` to the bulk loader
>
> Regular users cannot run `BULK INSERT`. The loading principal needs either the `bulkadmin` server role or the `ADMINISTER BULK OPERATIONS` server permission. Grant the minimum by creating a dedicated load login with `ADMINISTER BULK OPERATIONS` and no other privileges, then use that login for ETL jobs only.

### `OPENROWSET(BULK ...)` | read a flat file as a virtual rowset inside a query

`OPENROWSET(BULK ...)` turns a flat file into a rowset that can participate in any `SELECT`, `INSERT ... SELECT`, `UPDATE ... FROM`, or `DELETE ... FROM` statement. It is strictly more powerful than `BULK INSERT`: the rows can be filtered, joined, projected, or transformed on their way into the target table. `OPENROWSET(BULK ...)` also supports JSON and XML via `SINGLE_CLOB`/`SINGLE_NCLOB` and, with SQL Server 2017+, the `FORMAT='CSV'` option.

> [!info]- Clause-by-clause breakdown
>
> - `OPENROWSET(BULK '...', FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0d0a')` reads the CSV as a virtual table using the modern 2017+ CSV parser.
> - `WITH (country_name NVARCHAR(200), iso_alpha2 CHAR(2))` supplies an inline schema — without it, SQL Server would return the rowset as a single `BulkColumn` wide column.
> - `AS src` gives the rowset an alias so its columns can be referenced in the outer query.
> - `WHERE src.iso_alpha2 COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT IN (SELECT iso_alpha2 FROM bronze.dim_country)` skips countries that already exist. The explicit `COLLATE` clause is mandatory here because `OPENROWSET(BULK ...)` returns character columns in the server-level collation (`SQL_Latin1_General_CP1_CI_AS`), while `bronze.dim_country.iso_alpha2` uses the database-level UTF-8 collation (`Latin1_General_100_CI_AS_SC_UTF8`). Comparing them without the `COLLATE` forces a collation-conflict error (msg 468).
> - The same `COLLATE` clause is also applied in the projected column list so the `INSERT` target column accepts the value directly.

*Load only the country rows from the CSV that are not already in the target table.*

```sql
USE [stoxx_db];
GO

INSERT INTO bronze.dim_country (country_name, iso_alpha2)
SELECT
    src.country_name,
    src.iso_alpha2 COLLATE Latin1_General_100_CI_AS_SC_UTF8 AS iso_alpha2
FROM OPENROWSET(
        BULK '/var/opt/mssql/imports/dim_country.csv',
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
```

| rows_inserted |
|---:|
| 0 |

*The anti-join filter eliminates every row in the file because every ISO code in the file already exists in `bronze.dim_country` (twice, after the bulk load above). In a true staging load where the target starts empty, the same query would insert exactly the new countries. This is the key architectural difference from `BULK INSERT`, which blindly appends every row in the file.*

*On a Windows-hosted SQL Server, the same query reads from a local path such as `N'E:\SQLImports\dim_country.csv'`. The `FORMAT='CSV'`, `FIRSTROW`, field terminator, and row terminator options are identical.*

> [!warning] OPENROWSET(BULK ...) inherits the server collation, not the database collation
>
> Character columns returned by `OPENROWSET(BULK ...)` always take the **server-level default collation**, not the collation of the target database. On instances where the database uses a modern UTF-8 collation but the server default is still the legacy `SQL_Latin1_General_CP1_CI_AS`, any string comparison between the loaded rowset and a database column raises error 468 (collation conflict). The fix is an explicit `COLLATE` clause on each side of every string comparison and on each projected column going into the target table.

> [!success] Wrap OPENROWSET BULK in a view or inline TVF with pre-applied COLLATE
>
> If the same file is loaded often, wrap the `OPENROWSET(BULK ...)` expression in an inline table-valued function that applies `COLLATE DATABASE_DEFAULT` to every string column. Callers then receive correctly collated rows and no longer need to repeat `COLLATE` on every predicate.

> [!info] Parquet reading requires an external data source
>
> SQL Server 2022 added `OPENROWSET(BULK ... FORMAT='PARQUET')` but only through `CREATE EXTERNAL DATA SOURCE` backed by Azure Blob Storage or S3-compatible storage. Local parquet file reading is not supported directly by T-SQL. For local parquet ingestion, convert to CSV first with `duckdb` or `pandas`, or stand up a MinIO/Azurite container exposing the parquet files as an S3/Blob endpoint.

---

## Identity and SEQUENCE

Every insert into a table with an auto-generated key relies on either the `IDENTITY` column property or a `SEQUENCE` object. The two mechanisms solve the same problem — producing unique monotonic integers — but with very different scoping, atomicity, and observability guarantees. The `silver.signals_daily` table has an `IDENTITY(1,1)` primary-key-style column on `id`, so every query below runs against a real table.

### `IDENTITY` | auto-increment a column on every insert

`IDENTITY(seed, increment)` is a column property that makes SQL Server generate the next value automatically every time a new row is inserted. The engine maintains a per-table counter (`IDENT_CURRENT`) that is independent of transactions: a failed or rolled-back `INSERT` still advances the counter, producing gaps. This is by design and cannot be disabled.

> [!info]- Clause-by-clause breakdown
>
> - The `INSERT` omits the `id` column entirely because it is an `IDENTITY` column — the engine will supply the value.
> - Immediately after the insert, three functions are called in order: `SCOPE_IDENTITY()`, `@@IDENTITY`, and `IDENT_CURRENT('silver.signals_daily')`. In a simple single-threaded scenario with no triggers, all three return the same value.

*Insert one row into `silver.signals_daily` and capture the generated identity value via three different functions.*

```sql
USE [stoxx_db];
GO

INSERT INTO silver.signals_daily
    (_index, symbol, signal_date, current_price, forward_pe, price_to_book,
     ev_to_ebitda, dividend_yield, market_cap, beta, fifty_two_week_change,
     sandp_52_week_change, fifty_day_average, two_hundred_day_average,
     dist_from_52_week_high, target_median_price, recommendation_mean, upside_potential)
VALUES
    ('euro_stoxx_50', 'TEST.XX', '2026-04-11', 100.0, 15.0, 2.0, 10.0, 0.03,
     1000000000, 1.0, 0.1, 0.05, 99.0, 95.0, 0.02, 110.0, 2.0, 0.1);

DECLARE
    @new_id_scope   INT = SCOPE_IDENTITY(),
    @new_id_at      INT = @@IDENTITY,
    @new_id_current INT = IDENT_CURRENT('silver.signals_daily');

SELECT
    @new_id_scope   AS scope_identity,
    @new_id_at      AS at_identity,
    @new_id_current AS ident_current;
```

| scope_identity | at_identity | ident_current |
|---:|---:|---:|
| 1000999 | 1000999 | 1000999 |

*All three functions return 1000999, the identity value the engine generated for the new row. The differences between them only become visible when a trigger inserts into a second identity table, or when another session inserts into the same table concurrently.*

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
> - The `INSERT` now includes `id` in the column list and supplies `2000000` as its value.
> - `SET IDENTITY_INSERT silver.signals_daily OFF` disables the override so subsequent inserts resume auto-generation.
> - The explicit value 2000000 advances the identity counter past 2000000, so the next natural identity value will be 2000001 or higher.

*Insert a legacy row into `silver.signals_daily` with an explicit identity value of 2000000.*

```sql
USE [stoxx_db];
GO

SET IDENTITY_INSERT silver.signals_daily ON;

INSERT INTO silver.signals_daily
    (id, _index, symbol, signal_date, current_price, forward_pe, price_to_book,
     ev_to_ebitda, dividend_yield, market_cap, beta, fifty_two_week_change,
     sandp_52_week_change, fifty_day_average, two_hundred_day_average,
     dist_from_52_week_high, target_median_price, recommendation_mean, upside_potential)
VALUES
    (2000000, 'euro_stoxx_50', 'LEGACY.XX', '2020-01-01', 50.0, 12.0, 1.5, 8.0, 0.04,
     500000000, 0.8, 0.05, 0.02, 48.0, 45.0, 0.01, 55.0, 1.5, 0.05);

SET IDENTITY_INSERT silver.signals_daily OFF;

SELECT id, symbol, signal_date
FROM silver.signals_daily
WHERE id = 2000000;
```

| id | symbol | signal_date |
|---:|---|---|
| 2000000 | LEGACY.XX | 2020-01-01 |

*With `IDENTITY_INSERT` on, the explicit value 2000000 is accepted. This pattern is used to migrate rows from a legacy system while preserving their original primary keys, and to fill identity gaps after a one-time bulk delete.*

> [!warning] Only one table per session can have IDENTITY_INSERT ON
>
> Attempting to turn `IDENTITY_INSERT` on for a second table in the same session while it is still on for the first raises error 7705. Always explicitly turn it off before enabling it on another table.

### `CREATE SEQUENCE` + `NEXT VALUE FOR` | table-independent counters

A `SEQUENCE` is a standalone database object that produces monotonic integers independent of any table. Unlike `IDENTITY`, a sequence can be read by multiple tables, can be sampled without inserting a row (`NEXT VALUE FOR`), supports bulk allocation via `sp_sequence_get_range`, and can wrap at the maximum value with `CYCLE`. SQL Server caches sequence values per session for performance, which means gaps are possible after a server restart.

> [!info]- Clause-by-clause breakdown
>
> - `CREATE SEQUENCE dbo.seq_order_no AS BIGINT START WITH 1000 INCREMENT BY 1 CACHE 50` creates a sequence starting at 1000 with a cache of 50 values per allocation batch.
> - Each `INSERT` statement uses `NEXT VALUE FOR dbo.seq_order_no` directly in the `VALUES` list to consume the next sequence value.
> - `NEXT VALUE FOR` can also be used in `SELECT` projections, `UPDATE SET` clauses, or as a `DEFAULT` expression on a persistent table.
> - `DROP SEQUENCE` cleans up after the example.

*Create a sequence and use `NEXT VALUE FOR` directly in three `INSERT` statements to draw consecutive values.*

```sql
USE [stoxx_db];
GO

IF OBJECT_ID('dbo.seq_order_no','SO') IS NOT NULL DROP SEQUENCE dbo.seq_order_no;
GO

CREATE SEQUENCE dbo.seq_order_no
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
VALUES (NEXT VALUE FOR dbo.seq_order_no, 'SAP.DE', 100);

INSERT INTO #orders (order_no, symbol, qty)
VALUES (NEXT VALUE FOR dbo.seq_order_no, 'SIE.DE', 200);

INSERT INTO #orders (order_no, symbol, qty)
VALUES (NEXT VALUE FOR dbo.seq_order_no, 'ASML.AS', 50);

SELECT * FROM #orders ORDER BY order_no;

DROP TABLE #orders;
DROP SEQUENCE dbo.seq_order_no;
```

| order_no | symbol | qty |
|---:|---|---:|
| 1000 | SAP.DE | 100 |
| 1001 | SIE.DE | 200 |
| 1002 | ASML.AS | 50 |

*The sequence produces 1000, 1001, 1002 across three inserts. Unlike `IDENTITY`, the same sequence could feed multiple tables simultaneously, or be sampled ahead of time with a bare `SELECT NEXT VALUE FOR dbo.seq_order_no` without any insert happening at all.*

> [!info] `IDENTITY` vs `SEQUENCE` decision
>
> Use `IDENTITY` for the common case of a single-table auto-generated primary key — simpler to create, easier for tooling, and the surrounding ecosystem assumes it. Use `SEQUENCE` when you need cross-table uniqueness (e.g., a shared `event_id` across ten audit tables), when you must allocate a block of numbers before the insert happens (e.g., for a parent-then-children pattern without round trips), or when you want explicit control over caching, cycling, or minimum/maximum bounds.

---

## UPDATE Patterns

`UPDATE` modifies existing rows in place. Its surface is smaller than `INSERT`'s but its pitfalls are larger: the T-SQL `UPDATE ... FROM ... JOIN` extension is non-deterministic when the join is ambiguous, `UPDATE` with `TOP` selects rows in an arbitrary order unless an outer `ORDER BY` controls it, and a missing `WHERE` clause quietly updates every row of the table.

### Searched `UPDATE` | single-table update with a predicate

The standard `UPDATE` form sets one or more columns for every row matching a `WHERE` predicate. If `WHERE` is omitted, every row is updated — there is no safety net. SQL Server takes exclusive (`X`) locks on the affected rows and intent exclusive (`IX`) locks on the enclosing page and table for the duration of the transaction.

> [!info]- Clause-by-clause breakdown
>
> - `UPDATE silver.signals_daily` names the target table directly.
> - `SET upside_potential = 0.25` assigns a literal value to one column. Multiple columns can be set in a single `SET` clause by separating them with commas.
> - `WHERE symbol = 'SAP.DE' AND signal_date = '2026-04-08'` restricts the update to exactly one row.

*Set the `upside_potential` of a single row to a fixed value.*

```sql
USE [stoxx_db];
GO

UPDATE silver.signals_daily
SET upside_potential = 0.25
WHERE symbol      = 'SAP.DE'
  AND signal_date = '2026-04-08';

SELECT symbol, signal_date, upside_potential
FROM silver.signals_daily
WHERE symbol      = 'SAP.DE'
  AND signal_date = '2026-04-08';
```

| symbol | signal_date | upside_potential |
|---|---|---:|
| SAP.DE | 2026-04-08 | 0.25 |

*One row updated. The locking sequence is `IX` on the table → `IX` on the page → `X` on the row → release at commit. No other session can read this row during the transaction unless the database is in `READ_COMMITTED_SNAPSHOT ON` mode, in which case readers see the pre-update version from the version store.*

> [!danger] `UPDATE` without `WHERE` updates every row
>
> Running `UPDATE silver.signals_daily SET upside_potential = 0.25` **without** a `WHERE` clause modifies every row in the table. There is no SQL Server safeguard against this. The only defenses are (1) opening every ad-hoc `UPDATE` in an explicit transaction so an accidental update can be rolled back, (2) writing the `SELECT` form of the predicate first and only converting it to `UPDATE` once the row count is confirmed, and (3) using tooling (SSMS → Tools → Options → Query Execution → SET ROWCOUNT or the IntelliSense `UPDATE` safeguard).

### `UPDATE ... FROM ... JOIN` | T-SQL extension for joined updates

The T-SQL `UPDATE ... FROM ... JOIN` extension lets an update use another table as a data source for both the predicate and the new column values. This is the most common way to propagate reference data, synchronize lookup columns, or apply derived calculations that require joining to dimensional tables.

> [!info]- Clause-by-clause breakdown
>
> - `UPDATE sd` targets the alias `sd` (`gold.scores_daily`) — not the table name directly. When a `FROM` clause is present, the aliased form is clearer because it matches the alias used downstream.
> - `SET sd.current_price = sd.current_price * 1.05` increases the `current_price` by 5%. The same alias appears on both sides of the assignment.
> - `FROM gold.scores_daily sd` names the primary source of rows to update and aliases it.
> - `JOIN bronze.dim_country dc ON dc.country_name = sd.country` joins the scores to the country dimension.
> - `WHERE dc.iso_alpha2 = 'DE' AND sd.score_date = '2026-03-04'` restricts the scope to German stocks on a specific date.

*Apply a 5% price bump to all German stocks on 2026-03-04 by joining `gold.scores_daily` to `bronze.dim_country`.*

```sql
USE [stoxx_db];
GO

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
```

| symbol | country | current_price |
|---|---|---:|
| ADS.DE | Germany | 148.89000000000001 |
| ALV.DE | Germany | 376.94999999999999 |
| BAS.DE | Germany | 48.457500000000003 |
| BAYN.DE | Germany | 39.270000000000003 |
| BMW.DE | Germany | 86.772000000000006 |

*Sixteen German scores were updated in one statement — the join to `bronze.dim_country` provided the ISO code filter without a hard-coded country list. This is the canonical pattern for applying a lookup-driven transformation to a fact table.*

> [!warning] Non-deterministic UPDATE with multi-match joins
>
> If the join produces multiple source rows for the same target row, SQL Server picks **one** of them arbitrarily and uses its columns for the update. The picked row is not guaranteed to be stable across runs or plans. Microsoft's own best-practice guidance flags this as undefined behavior. Detecting the condition up front requires a `SELECT COUNT(*) OVER (PARTITION BY <target_key>)` check in the source query or a `GROUP BY` rewrite.

> [!success] Force determinism with a CTE that pre-aggregates the source
>
> When the source might produce multiple rows per target, wrap it in a CTE that aggregates to at most one row per target key (`GROUP BY`, `ROW_NUMBER() = 1`, or `MAX(...)`). Then join the `UPDATE` to the CTE. The update becomes deterministic and the error mode shifts from "silent wrong answer" to "compile-time visible intent".

### `UPDATE` with CTE | scope-limited updates through a named subquery

A CTE (common table expression) can be used as a derived source that drives an `UPDATE`. The most common use case is computing a set of rows with ranking or aggregation before applying the modification.

> [!info]- Clause-by-clause breakdown
>
> - `WITH latest AS (SELECT symbol, MAX(signal_date) FROM silver.signals_daily GROUP BY symbol)` computes the latest signal date per symbol.
> - `UPDATE sd SET sd.upside_potential = 0.99 FROM silver.signals_daily sd JOIN latest l ON l.symbol = sd.symbol AND l.latest_date = sd.signal_date WHERE sd.symbol IN ('SAP.DE','SIE.DE')` updates only the latest row for those two symbols.
> - Without the CTE, the same update would require a correlated subquery in the `WHERE` clause, which is less readable and often slower.

*Update only the most recent signal row for SAP.DE and SIE.DE.*

```sql
USE [stoxx_db];
GO

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
```

| symbol | signal_date | upside_potential |
|---|---|---:|
| SAP.DE | 2026-04-08 | 0.98999999999999999 |
| SIE.DE | 2026-04-08 | 0.98999999999999999 |

*Exactly two rows updated — the latest date per symbol for SAP.DE and SIE.DE. Float representation shows 0.99 as 0.98999999999999999; use `decimal(p,s)` instead of `float` for columns where exact equality matters. The `WHERE sd.symbol IN (...)` clause pushes the filter down before the join, so the CTE is effectively evaluated only for the two relevant symbols.*

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

UPDATE TOP (2) silver.signals_daily
SET recommendation_mean = 1.0
WHERE symbol = 'SAP.DE';

SELECT COUNT(*) AS rows_affected
FROM silver.signals_daily
WHERE symbol              = 'SAP.DE'
  AND recommendation_mean = 1.0;
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
> The supported pattern is `UPDATE sd SET ... FROM silver.signals_daily sd INNER JOIN (SELECT TOP (100) id FROM silver.signals_daily WHERE symbol = 'SAP.DE' ORDER BY signal_date DESC) t ON t.id = sd.id;`. The inner `ORDER BY` produces a stable selection of the 100 most recent rows, and the outer `UPDATE` modifies only those.

### `UPDATE` with correlated subquery in `SET` | compute new values from aggregates

A correlated subquery inside the `SET` clause computes a new value for each row from an aggregate or another table. This form is more portable than `UPDATE ... FROM ... JOIN` — it works on standards-compliant databases too — but is often slower because the engine may materialize the subquery per row.

> [!info]- Clause-by-clause breakdown
>
> - `UPDATE silver.signals_daily SET target_median_price = (SELECT AVG(sd2.target_median_price) FROM silver.signals_daily sd2 WHERE sd2._index = silver.signals_daily._index)` recomputes the target price as the index-average.
> - The subquery references the outer table via `silver.signals_daily._index`, making it correlated. For each row being updated, SQL Server computes (or caches) the per-index average.
> - `WHERE symbol = 'SAP.DE'` restricts the update to four rows, so the subquery is evaluated at most four times.

*Replace the `target_median_price` of each SAP.DE row with the average target price of all rows in the same index.*

```sql
USE [stoxx_db];
GO

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
```

| symbol | signal_date | target_median_price |
|---|---|---:|
| SAP.DE | 2026-03-04 | 301.04887365326641 |
| SAP.DE | 2026-03-07 | 301.04887365326641 |
| SAP.DE | 2026-03-12 | 301.04887365326641 |
| SAP.DE | 2026-04-08 | 301.04887365326641 |

*All four SAP.DE rows now hold the same value — the euro_stoxx_50 index average — computed once per row but typically factored out by the optimizer into a scalar aggregate subtree. The same operation could be written with `UPDATE ... FROM ... JOIN` against a CTE of pre-aggregated averages for better readability at higher volumes.*

### `UPDATE ... SET @var = column = expression` | update a row and capture old/new value in one statement

SQL Server supports a composite assignment syntax: `SET @variable = column = expression`. This assigns the expression to the column (the update) and to the variable (the capture) in one step, allowing a single statement to both modify a row and remember its final value. Use this only when modifying one row — with multi-row updates, the variable holds the last-assigned row's value, which is non-deterministic.

*Update a single row, capturing the old and new price into two variables for logging.*

```sql
USE [stoxx_db];
GO

DECLARE @old_price FLOAT, @new_price FLOAT;

UPDATE silver.signals_daily
SET
    @old_price = current_price,
    @new_price = current_price = current_price * 1.10
WHERE symbol      = 'SAP.DE'
  AND signal_date = '2026-04-08';

SELECT @old_price AS old_price, @new_price AS new_price;
```

| old_price | new_price |
|---:|---:|
| 145.22 | 159.74200000000002 |

*The first assignment `@old_price = current_price` captures the pre-update value. The chained `@new_price = current_price = current_price * 1.10` writes the new value to the column and simultaneously captures it into `@new_price`. For multi-row updates, prefer the `OUTPUT` clause (see below) — it captures every affected row's before/after values deterministically.*

---

## DELETE Patterns

`DELETE` removes rows from a table. Like `UPDATE`, a missing `WHERE` clause removes every row — but unlike `UPDATE`, there is a faster alternative (`TRUNCATE TABLE`) when every row should go. The choice between `DELETE` and `TRUNCATE` is driven by recoverability requirements, trigger firing behavior, foreign key presence, and identity seed behavior, all documented in the decision matrix at the end of this section.

### Searched `DELETE` | remove rows matching a predicate

The standard `DELETE` form removes every row matching a `WHERE` predicate. The rowcount is returned to the client as `@@ROWCOUNT` and via the `(N rows affected)` message. Deleted rows are exclusively locked for the duration of the transaction and written to the transaction log — `DELETE` is always fully logged regardless of recovery model.

> [!info]- Clause-by-clause breakdown
>
> - `DELETE FROM silver.signals_daily` names the target and uses the optional `FROM` keyword — `DELETE silver.signals_daily` without `FROM` is equivalent syntax.
> - `WHERE symbol = 'SAP.DE' AND signal_date = '2026-03-04'` restricts the delete to exactly one row.

*Delete one specific row.*

```sql
USE [stoxx_db];
GO

DELETE FROM silver.signals_daily
WHERE symbol      = 'SAP.DE'
  AND signal_date = '2026-03-04';

SELECT @@ROWCOUNT AS deleted_rows;

SELECT COUNT(*) AS remaining_sap_de
FROM silver.signals_daily
WHERE symbol = 'SAP.DE';
```

| deleted_rows |
|---:|
| 1 |
| remaining_sap_de |
|---:|
| 3 |

*One row deleted, three SAP.DE rows remain. `@@ROWCOUNT` reflects the actual number of rows the last statement modified.*

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

DELETE sd
FROM silver.signals_daily AS sd
WHERE NOT EXISTS (
    SELECT 1
    FROM bronze.trading_calendar AS tc
    WHERE tc.date           = sd.signal_date
      AND tc.is_trading_day = 1
);

SELECT @@ROWCOUNT AS deleted_non_trading;
```

| deleted_non_trading |
|---:|
| 152 |

*152 rows removed because their `signal_date` did not match any trading-day entry in `bronze.trading_calendar`. In a real ETL pipeline, this pattern is used to enforce referential integrity against a date dimension when the source data layer is not constrained.*

### `DELETE TOP (n)` | bounded delete without a guaranteed order

`DELETE TOP (n)` removes at most `n` rows matching the predicate. Like `UPDATE TOP`, the selection is non-deterministic without a subquery containing `ORDER BY`. The primary legitimate use of `DELETE TOP` is as the delete step of a batched loop.

*Delete at most 10 signal rows whose symbol starts with a digit.*

```sql
USE [stoxx_db];
GO

DELETE TOP (10) FROM silver.signals_daily
WHERE symbol LIKE '0%';

SELECT @@ROWCOUNT AS deleted_rows;
```

| deleted_rows |
|---:|
| 3 |

*Three rows match the `symbol LIKE '0%'` predicate after the earlier anti-semi-join delete, so the `TOP (10)` bound is never reached. When the predicate matches more than `n` rows, `TOP (n)` picks any `n` of them — the specific ones chosen depend on the physical plan.*

### Batched `DELETE` | remove many rows without blocking the log

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
```

| batches | total_deleted |
|---:|---:|
| 2 | 47 |

*Two batches of 25 and 22 rows remove 47 rows in total. At production scale, the `@chunk` value is typically between 1 000 and 10 000, and each batch is committed with `COMMIT; BEGIN TRAN;` (or the loop runs without an outer transaction at all). The combination of small chunks and frequent commits lets log backups keep up with the log growth.*

> [!danger] `@@ROWCOUNT` is reset by every statement
>
> `@@ROWCOUNT` reflects the row count of the **most recently executed statement**, including `IF`, `SELECT`, `SET`, and implicit statements inside control flow. Reading `@@ROWCOUNT` after any such statement returns a number unrelated to the DML you care about. The fix is to capture `@@ROWCOUNT` into a local variable on the line immediately after the DML statement and reference the variable everywhere else.

> [!success] Pattern: `DECLARE @rc INT; DELETE ...; SET @rc = @@ROWCOUNT;`
>
> Every batched or conditional DML pattern should capture `@@ROWCOUNT` into a dedicated variable on the next line. Treat `@@ROWCOUNT` as a volatile register that is overwritten on every statement.

### `TRUNCATE TABLE` | remove every row at maximum speed

`TRUNCATE TABLE` removes every row from a table by deallocating its pages. It is faster than `DELETE` without a `WHERE` clause, uses minimal transaction log space, and resets the identity counter to its seed value. It does **not** fire `DELETE` triggers, does **not** work on tables referenced by a foreign key, and does **not** work on tables participating in indexed views, system-versioned temporal tables, or replication.

*Truncate a temp table populated from `silver.signals_daily` and confirm the row count drops to zero.*

```sql
USE [stoxx_db];
GO

IF OBJECT_ID('tempdb..#scratch') IS NOT NULL DROP TABLE #scratch;

SELECT symbol, signal_date, current_price
INTO #scratch
FROM silver.signals_daily
WHERE symbol = 'ASML.AS';

SELECT COUNT(*) AS before_truncate FROM #scratch;

TRUNCATE TABLE #scratch;

SELECT COUNT(*) AS after_truncate FROM #scratch;

DROP TABLE #scratch;
```

| before_truncate |
|---:|
| 3 |
| after_truncate |
|---:|
| 0 |

*Three rows in, zero rows out. `TRUNCATE` releases the pages immediately for tables smaller than 128 extents, or deferred to a background process for larger tables.*

> [!warning] `TRUNCATE TABLE` cannot fire `DELETE` triggers
>
> `TRUNCATE` removes rows by deallocating pages without touching individual rows, so there is no row-level event for trigger binding to observe. Any audit trail or cascade implemented via `AFTER DELETE` or `INSTEAD OF DELETE` triggers will silently miss truncations. If full audit coverage is required, replace `TRUNCATE` with a logged `DELETE` + trigger, or add the `TRUNCATE_TABLE` event to a database-level DDL trigger.

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

Two production tables back the examples in this section: `dbo.audit_price_changes` (a row-change audit trail with old/new values and the principal who made the change) and `dbo.archive_signals_daily` (a row archive on the `FG_Archive` filegroup for soft-deleted signal rows). Both tables are defined without triggers, without foreign keys, and without `CHECK` constraints because `OUTPUT INTO` cannot target tables that carry any of those.

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
> - `OUTPUT INSERTED.symbol, INSERTED.signal_date, DELETED.current_price AS old_price, INSERTED.current_price AS new_price` projects four columns: identifying key (from INSERTED, unchanged), the old price (from DELETED), and the new price (from INSERTED).
> - `WHERE symbol = 'ASML.AS'` restricts the update to the remaining ASML.AS rows.

*Apply a 10% price bump to every ASML.AS row and return a before/after delta for each affected row.*

```sql
USE [stoxx_db];
GO

UPDATE silver.signals_daily
SET current_price = current_price * 1.10
OUTPUT
    INSERTED.symbol,
    INSERTED.signal_date,
    DELETED.current_price  AS old_price,
    INSERTED.current_price AS new_price
WHERE symbol = 'ASML.AS';
```

| symbol | signal_date | old_price | new_price |
|---|---|---:|---:|
| ASML.AS | 2026-03-12 | 1191.2 | 1310.3200000000002 |
| ASML.AS | 2026-03-04 | 1199.8 | 1319.78 |
| ASML.AS | 2026-04-08 | 1113.8 | 1225.1800000000001 |

*Three rows were updated and three rows were returned to the client — one result set per affected row, in a single round trip. No separate `SELECT` is needed after the update to verify the change. The row order in the output is not guaranteed to match the `signal_date` order; if the caller needs it ordered, either sort client-side or use the `OUTPUT INTO` pattern below.*

### `OUTPUT ... INTO` audit table | capture affected rows into a persistent audit trail

`OUTPUT ... INTO` sends the captured rows into a persistent table that serves as an audit trail. The `dbo.audit_price_changes` table is designed specifically to be a valid `OUTPUT INTO` target: it has an `IDENTITY` primary key, default `changed_at` and `changed_by` columns, no triggers, no foreign keys, and no check constraints. The `OUTPUT` clause populates the `symbol`, `signal_date`, `old_price`, and `new_price` columns while the table defaults fill in the audit metadata automatically.

> [!info]- Clause-by-clause breakdown
>
> - `UPDATE silver.signals_daily SET current_price = current_price * 0.95` applies a 5% cut.
> - `OUTPUT INSERTED.symbol, INSERTED.signal_date, DELETED.current_price, INSERTED.current_price INTO dbo.audit_price_changes (symbol, signal_date, old_price, new_price)` writes one row to the audit table for every row modified.
> - The explicit column list on `INTO` skips the audit table's identity column (`audit_id`) and its default-populated columns (`changed_at`, `changed_by`), letting the engine fill them automatically.
> - `WHERE symbol = 'MC.PA' AND signal_date = '2026-04-08'` restricts the update to one specific row.

*Apply a 5% price cut to one MC.PA row and log the change to `dbo.audit_price_changes`.*

```sql
USE [stoxx_db];
GO

UPDATE silver.signals_daily
SET current_price = current_price * 0.95
OUTPUT
    INSERTED.symbol,
    INSERTED.signal_date,
    DELETED.current_price,
    INSERTED.current_price
INTO dbo.audit_price_changes (symbol, signal_date, old_price, new_price)
WHERE symbol      = 'MC.PA'
  AND signal_date = '2026-04-08';

SELECT TOP (5)
    audit_id, symbol, signal_date, old_price, new_price, changed_at, changed_by
FROM dbo.audit_price_changes
ORDER BY audit_id DESC;
```

| audit_id | symbol | signal_date | old_price | new_price | changed_at | changed_by |
|---:|---|---|---:|---:|---|---|
| 1 | MC.PA | 2026-04-08 | 466.85000000000002 | 443.50749999999999 | 2026-04-11 11:38:32.748 | sa |

*One row updated, one row logged. The audit table now has the full before/after trail for the price change, plus the UTC timestamp and the principal that made the change — all populated atomically inside the same `UPDATE` statement. This pattern replaces `AFTER UPDATE` triggers for audit workloads: it is explicit, visible in the source code, and does not add hidden runtime behavior.*

> [!warning] Target of `OUTPUT INTO` has tight restrictions
>
> The destination table of `OUTPUT INTO` cannot have enabled triggers, cannot participate on either side of a foreign key, and cannot have `CHECK` constraints or enabled rules. `dbo.audit_price_changes` was deliberately created without any of these so it can serve as an `OUTPUT INTO` target.

### `DELETE ... OUTPUT` | capture removed rows before they disappear

`DELETE` with `OUTPUT DELETED.*` returns every row that was just removed. This is the canonical pattern for "destructive read" queue-pop operations, where a consumer claims a message by deleting it from the queue table and immediately processing the returned row. The client sees the deleted row as the result set of the `DELETE` statement and can forward it to a downstream system.

*Delete one MC.PA row and return its full payload in the same round trip.*

```sql
USE [stoxx_db];
GO

DELETE FROM silver.signals_daily
OUTPUT
    DELETED.id,
    DELETED.symbol,
    DELETED.signal_date,
    DELETED.current_price
WHERE symbol      = 'MC.PA'
  AND signal_date = '2026-03-04';
```

| id | symbol | signal_date | current_price |
|---:|---|---|---:|
| 2 | MC.PA | 2026-03-04 | 507.39999999999998 |

*The deleted row is returned as a result set in the same round trip as the `DELETE`. In a queue scenario, the consumer would execute this as its single "claim and process" step — guaranteeing exactly-once semantics as long as the consumer handles its own idempotency.*

> [!tip] `DELETE TOP (1) ... WITH (READPAST) OUTPUT DELETED.*` is the canonical queue pop
>
> For queue-like workloads, combine `DELETE TOP (1)` (one message at a time), the `READPAST` table hint (skip rows currently locked by other consumers), and `OUTPUT DELETED.*` (return the claimed message). This pattern supports multiple concurrent consumers without deadlocks and without needing an application-level queue manager.

### Composable DML | chain a DML statement's `OUTPUT` into another `INSERT`

The **composable DML** form wraps a DML statement with an `OUTPUT` clause in parentheses and uses it as a rowset source for an outer `INSERT` statement. This moves rows atomically from one table to another: the inner `DELETE` (or `UPDATE` or `MERGE`) produces the rows, and the outer `INSERT` persists them elsewhere.

> [!info]- Clause-by-clause breakdown
>
> - `INSERT INTO dbo.archive_signals_daily (signal_id, _index, symbol, signal_date, current_price) SELECT src.id, src._index, src.symbol, src.signal_date, src.current_price FROM (...) AS src` reads from a derived table named `src`.
> - The derived table is `(DELETE FROM silver.signals_daily OUTPUT DELETED.id, DELETED._index, DELETED.symbol, DELETED.signal_date, DELETED.current_price WHERE symbol = 'MC.PA')` — a `DELETE` with an `OUTPUT` clause, wrapped in parentheses.
> - The outer `INSERT` captures every row the `DELETE` removed and inserts it into `dbo.archive_signals_daily` in one atomic operation. If the outer insert fails for any reason, the delete is rolled back as well.
> - `dbo.archive_signals_daily` lives on the `FG_Archive` filegroup — archived rows are physically relocated onto lower-cost storage as part of the move.
> - The archive table's identity column (`archive_id`) and default-populated columns (`archived_at`, `archived_by`) are skipped by the outer `INSERT` column list and filled in by the engine.

*Move every remaining MC.PA row from `silver.signals_daily` into `dbo.archive_signals_daily` in one composable DML statement.*

```sql
USE [stoxx_db];
GO

INSERT INTO dbo.archive_signals_daily (signal_id, _index, symbol, signal_date, current_price)
SELECT
    src.id,
    src._index,
    src.symbol,
    src.signal_date,
    src.current_price
FROM (
    DELETE FROM silver.signals_daily
    OUTPUT
        DELETED.id,
        DELETED._index,
        DELETED.symbol,
        DELETED.signal_date,
        DELETED.current_price
    WHERE symbol = 'MC.PA'
) AS src;

SELECT archive_id, signal_id, symbol, signal_date, current_price, archived_at, archived_by
FROM dbo.archive_signals_daily
ORDER BY archive_id;
```

| archive_id | signal_id | symbol | signal_date | current_price | archived_at | archived_by |
|---:|---:|---|---|---:|---|---|
| 1 | 2022 | MC.PA | 2026-03-12 | 494.39999999999998 | 2026-04-11 11:38:43.355 | sa |
| 2 | 3003 | MC.PA | 2026-04-08 | 443.50749999999999 | 2026-04-11 11:38:43.355 | sa |

*Two rows were deleted from the source and inserted into the archive in one statement. The `DELETE` and `INSERT` are atomic: either both succeed or both are rolled back. The archive table now holds the historical MC.PA data on the `FG_Archive` filegroup (lower-cost storage), while the `silver.signals_daily` table no longer contains any MC.PA rows. This is the canonical soft-delete / tiering pattern for ETL pipelines.*

> [!warning] Composable DML target has severe restrictions
>
> The target of the **outer** `INSERT` in a composable DML statement cannot be a view or remote table, cannot have triggers, cannot participate in foreign key relationships, and cannot participate in replication. The **inner** DML statement cannot be nested further (no composable DML inside composable DML), cannot contain a `WITH` clause, cannot target remote tables or partitioned views, and cannot be a cursor-based `UPDATE`/`DELETE`. These restrictions make composable DML strictly a tool for dedicated staging/archive tables.

> [!danger] `OUTPUT` rows are returned even if the statement fails
>
> Per Microsoft: *"An UPDATE, INSERT, or DELETE statement that has an OUTPUT clause will return rows to the client even if the statement encounters errors and is rolled back."* A client that reads the `OUTPUT` result set and uses it for business logic can act on rows that were never actually persisted. Always check for errors (or use `XACT_ABORT ON` + `TRY/CATCH`) before trusting `OUTPUT` results, and never treat `OUTPUT` as the sole commit signal.

### `MERGE` and `OUTPUT $action` | pointer

`MERGE` statements can use `OUTPUT` with a special `$action` column that returns `'INSERT'`, `'UPDATE'`, or `'DELETE'` for each affected row, identifying which merge branch produced the row. See [[11-merge-and-upsert]] for the full treatment.

> [!warning] `MERGE` has known concurrency issues
>
> Even with `HOLDLOCK` on the target, `MERGE` is susceptible to race conditions under concurrent inserts that can produce primary-key violations or silently skip intended actions. Microsoft KB articles document several well-known bugs in `MERGE` plan choice that were fixed over multiple cumulative updates. A common alternative is to run two separate statements inside one transaction: `UPDATE target SET ... FROM target JOIN staging ON key` to apply the changes to matching rows, then `INSERT INTO target SELECT ... FROM staging WHERE NOT EXISTS (SELECT 1 FROM target t WHERE t.key = staging.key)` to add the new rows. This pattern produces more predictable query plans, avoids the known `MERGE` concurrency bugs, and is easier to read and tune. See [[11-merge-and-upsert]] for the full trade-off analysis.

---

## Transactions, Errors, and Halloween Protection

All SQL Server DML runs inside a transaction, but the behavior of that transaction under errors depends on three settings: `XACT_ABORT`, `SET IMPLICIT_TRANSACTIONS`, and the presence of `TRY/CATCH` blocks. Incorrect combinations leave partial changes committed, dangling open transactions, or swallow errors that should have surfaced.

### Explicit transactions | `BEGIN TRAN`, `COMMIT`, `ROLLBACK`

An **explicit transaction** is opened with `BEGIN TRAN`, closed with `COMMIT TRAN`, and aborted with `ROLLBACK TRAN`. Every DML statement between the `BEGIN` and the `COMMIT` is part of the same transaction, and either all of them commit or none of them do. Explicit transactions are the right default for any multi-statement operation that must be atomic.

*Atomically update two symbols in one transaction and commit both at once.*

```sql
USE [stoxx_db];
GO

BEGIN TRAN;

UPDATE silver.signals_daily
SET current_price = current_price * 1.02
WHERE symbol = 'ALV.DE' AND signal_date = '2026-04-08';

UPDATE silver.signals_daily
SET current_price = current_price * 1.02
WHERE symbol = 'SIE.DE' AND signal_date = '2026-04-08';

COMMIT;
```

*Both updates are part of the same transaction. There is no state in which only the ALV.DE update is persisted but the SIE.DE update is not. If the second statement raised an error, the whole transaction would be in a `DOOMED` state (assuming `XACT_ABORT ON`) and a subsequent `ROLLBACK` would undo both.*

### `TRY/CATCH` + `XACT_ABORT` | standard error-handling envelope

SQL Server's structured error handling consists of three pieces: `SET XACT_ABORT ON` forces the whole transaction to roll back on any run-time error (instead of silently continuing), the `TRY/CATCH` block catches the error so the client sees a controlled response, and `XACT_STATE()` reports whether the transaction is still active, doomed, or already rolled back.

> [!info]- Clause-by-clause breakdown
>
> - `SET XACT_ABORT ON` is the single most important switch for DML reliability. With it off, a deadlock victim or a check-constraint violation leaves the transaction active; with it on, any such error triggers an automatic rollback and the transaction is doomed (XACT_STATE = -1).
> - `BEGIN TRAN` opens the transaction.
> - `BEGIN TRY ... END TRY` surrounds the statements that might fail.
> - The first `UPDATE` succeeds.
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
    WHERE symbol = 'NVDA';

    UPDATE silver.signals_daily
    SET current_price = current_price / 0
    WHERE symbol = 'SIE.DE';

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

*The first update affected NVDA rows, then the second update hit the divide-by-zero error and the whole transaction was rolled back by `XACT_ABORT`. After the `CATCH` block executes, `XACT_STATE() = 0` confirms the transaction is no longer open. A follow-up `SELECT MAX(current_price) FROM silver.signals_daily WHERE symbol = 'NVDA'` shows the pre-error price, proving the rollback restored the NVDA rows that had already been updated earlier in the transaction.*

> [!danger] `SET XACT_ABORT OFF` is the default and it is unsafe for DML
>
> With `XACT_ABORT OFF`, many runtime errors (divide by zero, arithmetic overflow, deadlock victim, some constraint violations) leave the transaction **active**. The next statement continues to execute as if nothing happened, and a `COMMIT` at the end persists an inconsistent state. The connection-level default depends on the driver: ODBC and SQLClient usually default to ON, OLE DB often defaults to OFF. Set it explicitly at the top of any batch that contains DML.

> [!success] Always begin DML batches with `SET XACT_ABORT ON; SET NOCOUNT ON;`
>
> `SET XACT_ABORT ON` makes transaction behavior predictable. `SET NOCOUNT ON` suppresses the "(N rows affected)" messages so the client protocol is not polluted with row-count metadata. Together they form the standard prolog for any production stored procedure or DML batch.

### Halloween Protection | why SQL Server adds a spool to some UPDATE plans

The **Halloween problem** occurs when an `UPDATE` statement modifies a column that is used in its own search predicate or join. Naïvely executed, the update would re-read rows it already updated and modify them again, producing endless work or wrong results. SQL Server detects this pattern and inserts a blocking spool (typically an eager spool) into the plan to materialize all affected rows before any updates are applied. This is **Halloween Protection**, and it is the reason many seemingly simple updates show a spool operator in their plan.

The term dates to 1976, when IBM researchers discovered the problem while testing System R on Halloween. The name stuck. The SQL Server optimizer flags the condition as `Halloween Protection Required` in its plan output.

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

### `NEWID()` as a clustered primary key | random inserts at end of table

A `uniqueidentifier` column populated with `NEWID()` produces random values, which means every insert lands at an arbitrary position in a clustered B-tree. The resulting page splits, fragmentation, and write amplification can reduce insert throughput by an order of magnitude on busy systems. Use `NEWSEQUENTIALID()` instead when the clustered key must be a GUID — it produces monotonically increasing values within the current boot session, eliminating the random-insert fragmentation without giving up the uniqueness guarantee. Better yet, use an `INT` or `BIGINT` `IDENTITY` for the clustered key and relegate the GUID to a non-clustered unique index if the application surface needs it.

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
| Build an audit trail without a trigger | `UPDATE ... OUTPUT ... INTO dbo.audit_*` persistent audit table |
| Destructive read / queue pop | `DELETE TOP (1) WITH (READPAST) ... OUTPUT DELETED.*` |
| Move rows between tables atomically | Composable DML: `INSERT ... SELECT ... FROM (DELETE ... OUTPUT DELETED.*) src` |
| Upsert (insert-or-update) | `MERGE` — see [[11-merge-and-upsert]] |

---
