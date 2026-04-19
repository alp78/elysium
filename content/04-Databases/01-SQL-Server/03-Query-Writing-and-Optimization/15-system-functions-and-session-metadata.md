---
title: "15 - System Functions and Session Metadata"
tags: [sql-server, tsql, query-writing]
aliases: [system functions, session metadata, ROWCOUNT, TRANCOUNT, SPID, SERVERPROPERTY, DATABASEPROPERTYEX, CONNECTIONPROPERTY, OBJECT_ID, PARSENAME, SESSION_CONTEXT, CONTEXT_INFO, ORIGINAL_LOGIN, row-level security]
description: "T-SQL reference for SQL Server session-variable-style functions and metadata helpers: @@ROWCOUNT/@@TRANCOUNT/@@SPID/@@ERROR/@@NESTLEVEL, SERVERPROPERTY/DATABASEPROPERTYEX/CONNECTIONPROPERTY, principal identity functions (SUSER_SNAME, USER_NAME, CURRENT_USER, SESSION_USER, SYSTEM_USER, ORIGINAL_LOGIN), permission check helpers (IS_SRVROLEMEMBER, IS_ROLEMEMBER, HAS_PERMS_BY_NAME), object and schema metadata (OBJECT_ID, OBJECT_NAME, SCHEMA_ID, OBJECTPROPERTY, COLUMNPROPERTY, TYPE_NAME, PARSENAME), idempotent DDL patterns, CONTEXT_INFO and SESSION_CONTEXT with the @read_only flag and Row-Level Security integration, legacy server counters, and DMV joining patterns."
created: 2026-04-08
updated: 2026-04-11
status: complete
---

# System Functions and Session Metadata

> [!abstract]- Summary
>
> T-SQL exposes a second layer of built-ins that report execution state rather than business data: this note catalogs the session-state functions, metadata helpers, identity functions, and context stores that tell a batch who it is, where it is running, what just happened, and how to join that information to DMVs safely.
>
> **Session-state helpers**
> - covers `@@ROWCOUNT`, `@@TRANCOUNT`, `@@ERROR`, `@@NESTLEVEL`, `@@SPID`, and the capture-order traps that make these functions easy to misuse
>
> **Server, database, and connection properties**
> - covers `@@VERSION`, `SERVERPROPERTY`, `DATABASEPROPERTYEX`, `CONNECTIONPROPERTY`, `CURRENT_REQUEST_ID`, and `CURRENT_TRANSACTION_ID`
>
> **Security and identity surface**
> - covers principal-identity functions, `EXECUTE AS` behavior, permission checks, and the distinction between session identity, effective user, and original login
>
> **Object and schema metadata**
> - covers `DB_ID`, `OBJECT_ID`, `SCHEMA_ID`, `OBJECTPROPERTY`, `COLUMNPROPERTY`, `TYPE_NAME`, `PARSENAME`, and idempotent DDL patterns built on them
>
> **Session context and legacy counters**
> - covers `CONTEXT_INFO`, `SESSION_CONTEXT`, the `@read_only` flag, Row-Level Security integration, and older `@@` counters that still help with quick probes
>
> **DMV joining patterns**
> - covers how `OBJECT_ID`, `DB_ID`, `SCHEMA_ID`, and `@@SPID` bridge these helpers into practical DMV queries
>
> **Operations and safety**
> - Warnings: `@@ROWCOUNT` and `@@ERROR` are clobbered by later statements, most identity functions follow `EXECUTE AS`, `host_name` and `program_name` are client-supplied, `SERVERPROPERTY` / `DATABASEPROPERTYEX` return `sql_variant`, and missing session-context setup can silently break RLS behavior
> - Recommendations: capture volatile `@@` values immediately, use `ORIGINAL_LOGIN()` for audit identity, cast property functions explicitly, use `SESSION_CONTEXT` with `@read_only = 1` for security-critical session keys, and pair `OBJECT_ID` with `DB_ID` in DMV filters

> [!note]- Glossary
>
> **Session-state function**
> - A built-in function that reports information about the current session or immediately preceding statement rather than data from user tables.
> - It matters because this note is about the execution environment around a query, not the business rows the query processes.
>
> > [!warning] State functions are often volatile
> >
> > Many of these values change from statement to statement. If the code needs a stable copy, it must capture the value immediately.
>
> ---
>
> **`@@ROWCOUNT`**
> - The function that returns how many rows the previous statement affected or returned.
> - It matters because branching on “did anything change?” is a common stored-procedure pattern, and this function is easy to clobber accidentally.
>
> > [!warning] One intervening statement destroys the evidence
> >
> > `SELECT`, `PRINT`, variable assignment, and many other statements overwrite `@@ROWCOUNT`. The defensive pattern is to copy it into a local variable immediately.
>
> ---
>
> **`@@TRANCOUNT`**
> - The function that returns the current nesting depth of explicit transactions in the session.
> - It matters because transaction-sensitive procedures often need to know whether they are running inside an outer transaction before deciding how to commit or roll back.
>
> > [!warning] Nesting depth is not independent transaction scope
> >
> > SQL Server does not create fully independent nested transactions for each `BEGIN TRAN`. `@@TRANCOUNT` counts nesting, but rollback behavior is still broader than many authors expect.
>
> ---
>
> **`@@SPID`**
> - The session identifier of the current connection.
> - It matters because it is the simplest anchor for joining the current session to DMVs and live diagnostic views.
>
> > [!info] Stable session handle, not business identity
> >
> > `@@SPID` tells you which session you are, not who the real user is. It is excellent for diagnostics and useless as an audit identity by itself.
>
> ---
>
> **`sql_variant` property function**
> - A property-returning function such as `SERVERPROPERTY` or `DATABASEPROPERTYEX` whose result is typed as `sql_variant`.
> - It matters because many client libraries and query patterns handle `sql_variant` awkwardly unless the value is cast explicitly.
>
> > [!warning] Mixed-type metadata needs explicit casting
> >
> > `sql_variant` is flexible for the engine and inconvenient for consumers. Casting the result to the expected type avoids downstream decoding and comparison problems.
>
> ---
>
> **Effective user**
> - The security principal SQL Server treats as current for permission checks at the moment a statement runs.
> - It matters because many identity functions report the effective context, which can differ from the original login under `EXECUTE AS`.
>
> > [!warning] “Who is running this?” has more than one answer
> >
> > Session user, current user, original login, and system user can diverge under impersonation. The correct function depends on whether the question is about permissions or accountability.
>
> ---
>
> **`ORIGINAL_LOGIN()`**
> - The function that returns the login that originally authenticated the session, regardless of later `EXECUTE AS` impersonation.
> - It matters because audit trails should record the real actor, not the temporarily impersonated principal.
>
> > [!info] This is the audit-safe login identity
> >
> > Most other identity helpers answer “who am I now?” `ORIGINAL_LOGIN()` answers “who started this session?” That difference is critical for trustworthy auditing.
>
> ---
>
> **Permission check helper**
> - A built-in such as `IS_SRVROLEMEMBER`, `IS_ROLEMEMBER`, or `HAS_PERMS_BY_NAME` that tests privileges without attempting the protected action itself.
> - It matters because procedures often need to branch safely on permissions before deciding what code path to run.
>
> > [!warning] Membership is not identical to effective permission
> >
> > Roles, ownership chains, explicit denies, and impersonation can complicate the picture. Permission-check helpers are useful, but they should be interpreted in context.
>
> ---
>
> **`OBJECT_ID` / `DB_ID` pair**
> - The common metadata key pair used to identify one database object unambiguously in catalog and DMV queries.
> - It matters because many DMVs are database-scoped or object-scoped, and using only one side of the pair can broaden the result set incorrectly.
>
> > [!info] Filtering discipline prevents misleading DMV reads
> >
> > `OBJECT_ID` alone is often not enough in cross-database DMV work. Pairing it with `DB_ID` makes the target explicit and keeps the diagnostic scope honest.
>
> ---
>
> **Idempotent DDL pattern**
> - A defensive DDL pattern that checks metadata first so a create, drop, or alter operation can be re-run safely.
> - It matters because deployment scripts and maintenance routines need object-existence checks that do not accidentally target the wrong object type.
>
> > [!warning] Type code matters
> >
> > `OBJECT_ID(N'name')` without an object-type code is weaker than it looks. A type code such as `'U'` or `'P'` prevents unrelated objects with the same name from matching.
>
> ---
>
> **`CONTEXT_INFO`**
> - The legacy session-scoped 128-byte binary blob available for storing small amounts of caller-defined context.
> - It matters because older codebases still use it, but it is more rigid and less expressive than `SESSION_CONTEXT`.
>
> > [!warning] Legacy compatibility is its main remaining value
> >
> > `CONTEXT_INFO` still works, but its fixed binary shape and awkward ergonomics make it a poor default for new security or routing logic.
>
> ---
>
> **`SESSION_CONTEXT`**
> - The key-value session storage surface that lets code set and read named context entries for the current session.
> - It matters because it is the modern way to attach application or security metadata to a session and is especially useful with Row-Level Security.
>
> > [!warning] Security-sensitive keys should be read-only
> >
> > Without the `@read_only` flag, later code in the same session can overwrite a context value. That is unsafe for tenant or security-bound identifiers.
>
> ---
>
> **DMV joining pattern**
> - The practice of using system functions and metadata helpers as join keys into dynamic management views for diagnostics.
> - It matters because many of the note’s helpers are most valuable when they serve as the glue between a session, an object, and the DMV rows that describe them.
>
> > [!info] These functions become more useful in combination
> >
> > `@@SPID`, `OBJECT_ID`, `DB_ID`, and identity helpers are not just standalone probes. Their real operational value is how they anchor precise DMV queries.

## @@ Session Variables — the Legacy State Helpers

T-SQL carries a family of session-state functions prefixed with `@@` that date to the earliest releases of Sybase SQL Server. They are **not** user variables (you cannot assign to them with `SET`) and they are **not** DMVs (they are session-scoped, not server-scoped). They are functions that return a snapshot of some piece of session state at the instant they are read — which is exactly what makes them error-prone, because the state they expose is **clobbered by every subsequent statement**.

### @@ROWCOUNT — the previous statement's row count

`@@ROWCOUNT` returns the number of rows affected by the **previous statement** executed in the current batch. It is the canonical way to branch on "did any rows actually change?" — a `TRY/CATCH` block reports errors but not zero-row successes, so `IF @@ROWCOUNT = 0` is the idiom for detecting a `WHERE` clause that matched nothing.

#### Basic read

*Update two of three rows in a table variable and read `@@ROWCOUNT`.*

```sql
DECLARE @t TABLE (id int, v int);
INSERT INTO @t (id, v) VALUES (1, 10), (2, 20), (3, 30);
UPDATE @t SET v = v + 1 WHERE id <= 2;
SELECT @@ROWCOUNT AS rows_updated;
```

| rows_updated |
|---|
| 2 |

The `UPDATE` matched rows with `id = 1` and `id = 2`, so `@@ROWCOUNT` returns `2` immediately after the statement. The preceding `INSERT` is irrelevant — `@@ROWCOUNT` only reflects the **most recent** statement. If the `UPDATE` matched zero rows, `@@ROWCOUNT` would be `0` and the code could branch accordingly (`IF @@ROWCOUNT = 0 RAISERROR(...)`).

#### @@ROWCOUNT is clobbered by every statement

> [!danger] Any statement between the DML and the read clobbers @@ROWCOUNT
>
> `@@ROWCOUNT` is **per statement**, not per DML. Every statement resets it — including `SELECT`, `IF`, `PRINT`, `DECLARE`, and assignment expressions. If even one intervening statement runs between the `UPDATE` and the `SELECT @@ROWCOUNT`, the DML row count is lost and you get the count of whatever the intervening statement affected. This is the single most common bug with `@@ROWCOUNT` in production procedures.

*Run an `UPDATE` that affects 2 rows, then a `SELECT *` of the table (3 rows), then read `@@ROWCOUNT`.*

```sql
DECLARE @t TABLE (id int, v int);
INSERT INTO @t (id, v) VALUES (1, 10), (2, 20), (3, 30);
UPDATE @t SET v = v + 1 WHERE id <= 2;
SELECT * FROM @t;
SELECT @@ROWCOUNT AS rowcount_after_select;
```

| rowcount_after_select |
|---|
| 3 |

`@@ROWCOUNT` reports `3` — the row count of the intervening `SELECT *`, not the `2` rows that the `UPDATE` actually modified. The `UPDATE`'s row count has been overwritten and cannot be recovered. Any downstream `IF @@ROWCOUNT = 0 RAISERROR(...)` check now tests against the wrong value and produces subtle, intermittent bugs — "intermittent" because the bug only surfaces when the `UPDATE` happens to match zero rows while the `SELECT *` happens to return some.

> [!success] Capture `@@ROWCOUNT` into a local variable immediately after the DML
>
> The defensive idiom is `DECLARE @rc int = @@ROWCOUNT;` on the line **immediately** after the DML statement. Any number of subsequent statements can then reference `@rc` safely — it is a normal local variable and is not affected by `@@ROWCOUNT` clobbering.

*Capture `@@ROWCOUNT` into `@rc`, run an intervening `SELECT`, then read the captured value.*

```sql
DECLARE @t TABLE (id int, v int);
INSERT INTO @t (id, v) VALUES (1, 10), (2, 20), (3, 30);
UPDATE @t SET v = v + 1 WHERE id <= 2;
DECLARE @rc int = @@ROWCOUNT;
SELECT * FROM @t;
SELECT @rc AS captured_rowcount;
```

| captured_rowcount |
|---|
| 2 |

`@rc` was captured from `@@ROWCOUNT` on the line immediately after the `UPDATE` and holds the correct value `2`, even though the intervening `SELECT * FROM @t` would otherwise have clobbered `@@ROWCOUNT` to `3`. Use this pattern in every stored procedure that needs to branch on DML row counts — it is both defensive against future edits (a new intervening statement cannot break the count) and more readable (the captured name documents intent).

### SET ROWCOUNT (deprecated)

`SET ROWCOUNT n` is a session-level statement that causes SQL Server to stop processing **after the first `n` rows** of every subsequent query in the session. It was the original way to implement "top N" semantics before the `TOP (n)` clause was added to `SELECT`, `UPDATE`, `DELETE`, and `INSERT`. It remains in the language for backward compatibility but is **deprecated for DML**: as of SQL Server 2012 the official [SET ROWCOUNT reference](https://learn.microsoft.com/en-us/sql/t-sql/statements/set-rowcount-transact-sql) notes that using `SET ROWCOUNT` to limit `INSERT`, `UPDATE`, and `DELETE` statements no longer has any effect and will be removed in a future version.

> [!warning] Never use `SET ROWCOUNT` to limit DML — use `TOP (n)` instead
>
> `SET ROWCOUNT` is session-scoped and persists until the session ends or the setting is reset to `0`. Leaving it set and running subsequent queries produces truncated, silently incorrect results in unrelated code paths. `TOP (n)` on the specific statement is explicit, local, and survives the deprecation cutoff. See the `### UPDATE TOP (n)` and `### DELETE TOP (n)` subsections of [10-insert-update-delete-patterns](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/10-insert-update-delete-patterns#update-top-n-bounded-update-without-a-predictable-order) for the modern equivalents.

> [!success] Bound only the target statement
>
> Apply `TOP (n)` on the `UPDATE`, `DELETE`, or `INSERT` that actually needs the row cap. The limit then lives inside the statement text, does not leak into later work on the same session, and keeps the row budget visible to both the reader and the optimizer.

### @@ERROR — legacy error code (superseded by TRY/CATCH)

`@@ERROR` returns the error number of the **previous statement**, or `0` if that statement completed without error. Like `@@ROWCOUNT`, it is clobbered by every subsequent statement. Before SQL Server 2005 it was the only way to detect errors in T-SQL, and procedures were littered with `IF @@ERROR <> 0 GOTO error_handler` after every DML statement. Modern code uses `TRY/CATCH` and the `ERROR_NUMBER()` / `ERROR_MESSAGE()` / `ERROR_SEVERITY()` / `ERROR_LINE()` / `ERROR_PROCEDURE()` / `ERROR_STATE()` functions instead.

*Run a `1/0` divide-by-zero inside a `TRY/CATCH` block and compare `ERROR_NUMBER()` with `@@ERROR`.*

```sql
DECLARE @legacy_err int, @tc_err int, @tc_msg nvarchar(200);
BEGIN TRY
    SELECT 1 / 0 AS will_fail;
END TRY
BEGIN CATCH
    SET @tc_err  = ERROR_NUMBER();
    SET @tc_msg  = ERROR_MESSAGE();
    SET @legacy_err = @@ERROR;
END CATCH;
SELECT @tc_err AS trycatch_number,
       @tc_msg AS trycatch_message,
       @legacy_err AS at_at_error_after_catch;
```

| trycatch_number | trycatch_message | at_at_error_after_catch |
|---|---|---|
| 8134 | Divide by zero error encountered. | 0 |

The divide-by-zero raises error 8134, which `TRY/CATCH` captures cleanly via `ERROR_NUMBER()`. Inside the `CATCH` block, `@@ERROR` reads as **`0`** — not `8134` — because the last statement before the `SET @legacy_err = @@ERROR;` line was the successful `SET @tc_msg = ...` assignment. This is exactly why `@@ERROR` is unreliable: by the time you read it, some assignment statement has usually already clobbered it back to `0`. Full error-handling coverage belongs to [19-stored-procedures-dynamic-sql-and-error-handling](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/19-stored-procedures-dynamic-sql-and-error-handling); use `TRY/CATCH` + `ERROR_*()` in every new procedure and reserve `@@ERROR` for reading legacy code.

### @@TRANCOUNT — transaction nesting depth

`@@TRANCOUNT` returns the current **nesting depth** of explicit transactions in the session. It is `0` outside any transaction, `1` inside a single `BEGIN TRAN`, and increments with every nested `BEGIN TRAN`. A matching `COMMIT` decrements it; a `ROLLBACK` **without a named save point** unconditionally sets it to `0` regardless of depth — which is the main reason "nested transactions" in SQL Server are a misleading concept.

*Nest three `BEGIN TRAN` / `COMMIT` pairs and read `@@TRANCOUNT` at each depth.*

```sql
DECLARE @d1 int, @d2 int, @d3 int, @d0 int;
BEGIN TRAN;
    SET @d1 = @@TRANCOUNT;
    BEGIN TRAN;
        SET @d2 = @@TRANCOUNT;
        BEGIN TRAN;
            SET @d3 = @@TRANCOUNT;
        COMMIT;
    COMMIT;
COMMIT;
SET @d0 = @@TRANCOUNT;
SELECT @d1 AS depth_1, @d2 AS depth_2, @d3 AS depth_3, @d0 AS depth_final;
```

| depth_1 | depth_2 | depth_3 | depth_final |
|---|---|---|---|
| 1 | 2 | 3 | 0 |

Three `BEGIN TRAN` calls bring the depth to `3`; three matching `COMMIT` calls bring it back to `0`. Critical nuance: only the **outermost** `COMMIT` actually commits the transaction. Every inner `COMMIT` simply decrements `@@TRANCOUNT` without flushing anything. This is why "nested transactions" in SQL Server do not behave like nested transactions in other systems — the inner `COMMIT` is effectively a no-op, and a `ROLLBACK` anywhere in the nesting unwinds the entire outer transaction. For real nested transaction semantics, use `SAVE TRANSACTION <name>` and `ROLLBACK TRAN <name>`; see [19-stored-procedures-dynamic-sql-and-error-handling](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/19-stored-procedures-dynamic-sql-and-error-handling) for the full treatment.

### @@NESTLEVEL — stored procedure nesting depth

`@@NESTLEVEL` returns the current stored procedure nesting depth, independent of `@@TRANCOUNT`. It is `0` in ad-hoc batch code, `1` inside a top-level procedure, `2` inside a procedure called from another procedure, and so on up to the hard limit of **32**. Exceeding 32 raises error 217 "Maximum stored procedure, function, trigger, or view nesting level exceeded (limit 32)".

*Read `@@NESTLEVEL` in an ad-hoc batch with no active procedure.*

```sql
SELECT @@NESTLEVEL AS current_nest_level;
```

| current_nest_level |
|---|
| 0 |

Outside any procedure, function, or trigger, the level is `0`. Inside a procedure called from another procedure called from another procedure, it would be `3`. Use `@@NESTLEVEL` in recursive procedures as a stop condition, and in shared logging procedures to decide whether to emit a "top-level call" banner (`IF @@NESTLEVEL = 1`) or just a continuation line.

### @@SPID — current session id

`@@SPID` returns the current **session id**, a `smallint` that uniquely identifies the session on this server instance. Every row in `sys.dm_exec_sessions`, `sys.dm_exec_requests`, and the rest of the session-scoped DMVs carries a `session_id` column that matches this value. It is the primary key for joining DMV rows back to the current session or to another session you are investigating.

*Read the current session's SPID.*

```sql
SELECT @@SPID AS current_spid;
```

| current_spid |
|---|
| 55 |

Session `55` on this instance. A non-sysadmin session reads only its own row when it queries `sys.dm_exec_sessions WHERE session_id = @@SPID`; a sysadmin can pass arbitrary SPIDs to inspect other sessions. User sessions typically get values `>= 50`; values `< 50` are system sessions (CHECKPOINT, lazy writer, service broker, etc.). System SPIDs are visible in `sys.dm_os_workers` and `sys.dm_exec_sessions` when connected as sysadmin.

### Identity retrieval functions (pointer)

`SCOPE_IDENTITY()`, `@@IDENTITY`, and `IDENT_CURRENT('table_name')` are session-scoped functions that return the last identity value generated by an `INSERT`. All three have distinct semantics and different traps. They are fully documented with worked demos in the `### SCOPE_IDENTITY() vs @@IDENTITY vs IDENT_CURRENT()` subsection of [10-insert-update-delete-patterns](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/10-insert-update-delete-patterns#scope-identity-vs-identity-vs-ident-current-how-they-differ).

The short rule, repeated here for reference:

- **`OUTPUT INSERTED.id`** — always preferred for capturing new identity values in one round trip; no clobber risk.
- **`SCOPE_IDENTITY()`** — second choice; returns the last identity from the current scope (not polluted by triggers).
- **`@@IDENTITY`** — avoid in application code; returns the last identity from **any** scope, including `AFTER INSERT` triggers on unrelated tables.
- **`IDENT_CURRENT('schema.table')`** — table-level metadata across sessions; never use for capturing your own insert's identity because another session's insert can intervene.

## Session and Connection Identity

The second family of helpers describes **what this session is connected to** — the server version, the database state, the network transport, and the identifiers that join this session to DMV rows. Every production diagnostic query begins with one of these functions.

### @@VERSION — product version string

`@@VERSION` returns a single `nvarchar` string containing the product name, version, build, edition, OS, and compile date. It is the quickest read for "what server am I on?" but for anything more than a banner, prefer `SERVERPROPERTY` for structured access.

*Return the first 80 characters of `@@VERSION`.*

```sql
SELECT LEFT(@@VERSION, 80) AS version_header;
```

| version_header |
|---|
| Microsoft SQL Server 2022 (RTM-CU23) (KB5078297) - 16.0.4236.2 (X64) |

SQL Server 2022 on x64, at Cumulative Update 23, build `16.0.4236.2`. The full string also includes the OS, memory configuration, and edition — but for programmatic reads, split the needed values out via `SERVERPROPERTY` rather than parsing this string.

### SERVERPROPERTY — structured server metadata

`SERVERPROPERTY(property)` returns a `sql_variant` with the named server-level property. The Microsoft [SERVERPROPERTY reference](https://learn.microsoft.com/en-us/sql/t-sql/functions/serverproperty-transact-sql) lists roughly 50 properties; the table below covers the ones that appear in every production diagnostic script.

| Property | Meaning | Typical use |
|---|---|---|
| `ProductVersion` | Build version string (`16.0.xxxx.y`) | Match against cumulative-update compatibility tables |
| `ProductLevel` | `RTM`, `SP1`, `SP2`, `CTP` | Distinguish preview builds from release builds |
| `ProductUpdateLevel` | Cumulative update name (`CU23`, `CU10`) | Patch level for support case reporting |
| `Edition` | Full edition string (`Developer Edition (64-bit)`) | Feature availability gate |
| `EngineEdition` | Integer: `1`=Personal, `2`=Standard, `3`=Enterprise/Developer, `4`=Express, `5`=Azure SQL DB, `6`=Azure Synapse, `8`=Azure Managed Instance | Programmatic feature gate |
| `MachineName` | Windows machine name (`NULL` on Azure SQL DB) | Diagnostic banner |
| `ServerName` | Network-addressable server name | Log header |
| `InstanceName` | Named-instance suffix (`NULL` for default instance) | Multi-instance scripts |
| `Collation` | Server default collation | Cross-database comparison guard |
| `IsClustered` | `1` = Windows failover cluster, `0` = standalone | HA topology check |
| `IsHadrEnabled` | `1` = Always On AG feature enabled | Rules out read-replica deployments |
| `IsIntegratedSecurityOnly` | `1` = Windows auth only (no SQL logins) | Compliance reporting |
| `LicenseType` | `PER_SEAT`, `PER_PROCESSOR`, `DISABLED` (Developer/Evaluation) | License audit |
| `ProcessID` | `sqlservr.exe` OS process id | Correlate with OS perfmon |

`SERVERPROPERTY` returns `sql_variant`, which many client drivers (including pyodbc via ODBC Driver 18) cannot decode directly. Wrap every call in `CAST(... AS <target_type>)` for robust cross-client retrieval.

*Catalog the 12 most useful server properties with explicit casts.*

```sql
SELECT
    CAST(SERVERPROPERTY('ProductVersion')          AS nvarchar(50))  AS product_version,
    CAST(SERVERPROPERTY('ProductLevel')            AS nvarchar(50))  AS product_level,
    CAST(SERVERPROPERTY('Edition')                 AS nvarchar(100)) AS edition,
    CAST(SERVERPROPERTY('EngineEdition')           AS int)           AS engine_edition,
    CAST(SERVERPROPERTY('MachineName')             AS nvarchar(50))  AS machine_name,
    CAST(SERVERPROPERTY('ServerName')              AS nvarchar(100)) AS server_name,
    CAST(SERVERPROPERTY('Collation')               AS nvarchar(100)) AS default_collation,
    CAST(SERVERPROPERTY('IsClustered')             AS int)           AS is_clustered,
    CAST(SERVERPROPERTY('IsHadrEnabled')           AS int)           AS is_hadr_enabled,
    CAST(SERVERPROPERTY('IsIntegratedSecurityOnly') AS int)          AS is_integrated_security_only,
    CAST(SERVERPROPERTY('LicenseType')             AS nvarchar(20))  AS license_type,
    CAST(SERVERPROPERTY('ProcessID')               AS int)           AS process_id;
```

| product_version | product_level | edition | engine_edition | machine_name | server_name | default_collation | is_clustered | is_hadr_enabled | is_integrated_security_only | license_type | process_id |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 16.0.4236.2 | RTM | Developer Edition (64-bit) | 3 | 8482aae8ad0a | 9b9b89176e4b | SQL_Latin1_General_CP1_CI_AS | 0 | 0 | 0 | DISABLED | 552 |

SQL Server 2022 Developer Edition (`EngineEdition = 3` matches Enterprise/Developer), build `16.0.4236.2`, running in a Linux container (the cryptic `8482aae8ad0a` machine name is the Docker container short id, which surfaces as `MachineName`). Windows failover clustering and Always On AG are both off (`is_clustered = 0`, `is_hadr_enabled = 0`), mixed-mode authentication is allowed (`is_integrated_security_only = 0`), and the license reports `DISABLED` — the expected value for Developer Edition, which has no runtime license enforcement. The server-level default collation is `SQL_Latin1_General_CP1_CI_AS`, which is the legacy SQL collation installed by default on SQL Server 2022 containers; new databases created without an explicit `COLLATE` clause inherit it unless overridden.

> [!warning] `SERVERPROPERTY` returns `sql_variant` — always CAST
>
> Without an explicit `CAST`, many client drivers raise `ODBC SQL type -16 is not yet supported` when decoding the column. The `sql_variant` type carries the target type internally, but drivers that only support a subset of SQL types return a parsing error instead of the underlying value. Always wrap `SERVERPROPERTY` calls in `CAST(... AS <target>)` — use `nvarchar(100)` for strings, `int` for boolean/integer properties.

> [!success] Cast metadata at projection time
>
> Treat `SERVERPROPERTY`, `DATABASEPROPERTYEX`, and `CONNECTIONPROPERTY` as typed metadata readers, not as display strings. Cast each requested property to the concrete type you expect in the `SELECT` list so client drivers receive stable values and downstream expressions never inherit `sql_variant`.

### DATABASEPROPERTYEX — database-level metadata

`DATABASEPROPERTYEX('db_name', 'property')` returns a `sql_variant` with a property of the named database. It replaces the older `DATABASEPROPERTY` (which is missing several newer properties). Unlike `SERVERPROPERTY`, it takes an explicit database name as the first argument — so a diagnostic query running in `master` can probe any online database without switching context.

The most commonly used properties are listed in the following table.

| Property | Meaning | Expected values |
|---|---|---|
| `Collation` | Database default collation | Full collation name (e.g. `Latin1_General_100_CI_AS_SC_UTF8`) |
| `Recovery` | Recovery model | `FULL`, `BULK_LOGGED`, `SIMPLE` |
| `Version` | Internal database version number | Integer that tracks engine upgrades |
| `Status` | Current database state | `ONLINE`, `OFFLINE`, `RESTORING`, `RECOVERING`, `RECOVERY_PENDING`, `SUSPECT`, `EMERGENCY` |
| `UserAccess` | Access restriction level | `MULTI_USER`, `SINGLE_USER`, `RESTRICTED_USER` |
| `IsAutoShrink` | Auto-shrink enabled | `0` (disabled, the correct default) / `1` (enabled, anti-pattern) |
| `IsReadOnly` | Database is read-only | `0` / `1` |
| `IsInStandBy` | Standby log-shipping target | `0` / `1` |
| `LastGoodCheckDbTime` | Last successful `DBCC CHECKDB` | Datetime string (or `Jan  1 1900 12:00AM` if never run) |

*Catalog nine common database properties for `stoxx` with explicit casts.*

```sql
SELECT
    CAST(DATABASEPROPERTYEX('stoxx','Collation')         AS nvarchar(100)) AS coll,
    CAST(DATABASEPROPERTYEX('stoxx','Recovery')          AS nvarchar(50))  AS recovery,
    CAST(DATABASEPROPERTYEX('stoxx','Version')           AS int)           AS internal_version,
    CAST(DATABASEPROPERTYEX('stoxx','Status')            AS nvarchar(50))  AS db_status,
    CAST(DATABASEPROPERTYEX('stoxx','UserAccess')        AS nvarchar(50))  AS user_access,
    CAST(DATABASEPROPERTYEX('stoxx','IsAutoShrink')      AS int)           AS is_auto_shrink,
    CAST(DATABASEPROPERTYEX('stoxx','IsReadOnly')        AS int)           AS is_read_only,
    CAST(DATABASEPROPERTYEX('stoxx','IsInStandBy')       AS int)           AS is_in_standby,
    CAST(DATABASEPROPERTYEX('stoxx','LastGoodCheckDbTime') AS nvarchar(50)) AS last_good_dbcc;
```

| coll | recovery | internal_version | db_status | user_access | is_auto_shrink | is_read_only | is_in_standby | last_good_dbcc |
|---|---|---|---|---|---|---|---|---|
| SQL_Latin1_General_CP1_CI_AS | FULL | 957 | ONLINE | MULTI_USER | 0 | NULL | 0 | Jan  1 1900 12:00AM |

`stoxx` is a `FULL` recovery model database at internal version `957` (SQL Server 2022 databases), `ONLINE` and `MULTI_USER`, with auto-shrink disabled (the correct production value) and no read-only restriction. `LastGoodCheckDbTime` is `Jan  1 1900 12:00AM` — the sentinel for "`DBCC CHECKDB` has never succeeded on this database in its recorded history". On any production database this value should be no older than a week; a sentinel value here is a red flag worth investigating as part of any baseline audit.

> [!warning] `IsAutoShrink = 1` is an anti-pattern
>
> Auto-shrink schedules a background job that periodically shrinks the database file when free space crosses a threshold. It is one of the most notorious performance anti-patterns in SQL Server — it causes massive index fragmentation, I/O spikes, and performance collapses that are invisible in most monitoring dashboards. Modern hardware has no reason to enable it. If a diagnostic query returns `is_auto_shrink = 1` on any production database, disable it immediately with `ALTER DATABASE <db> SET AUTO_SHRINK OFF`.

> [!success] Disable auto-shrink and size deliberately
>
> Keep data and log files sized for expected steady-state growth, configure autogrowth in fixed chunks, and shrink only after exceptional one-time space returns such as archive purges or filegroup moves. The normal production posture is `AUTO_SHRINK OFF` plus deliberate capacity management.

### CONNECTIONPROPERTY — current connection transport metadata

`CONNECTIONPROPERTY(property)` returns metadata about the **current connection** — transport protocol, authentication scheme, IP addresses, and port. It is the canonical way to confirm "am I connected via TCP or via a named pipe", "which IP is the client", and "which auth scheme actually authenticated me". Like `SERVERPROPERTY`, it returns `sql_variant` and needs an explicit `CAST` for robust client retrieval.

| Property | Meaning |
|---|---|
| `net_transport` | Logical transport: `TCP`, `Named pipe`, `Shared memory`, `VIA`, `Session` |
| `protocol_type` | Protocol family: `TSQL`, `SOAP`, `Service Broker` |
| `auth_scheme` | Authentication scheme: `SQL`, `NTLM`, `Kerberos`, `Digest`, `Basic`, `DPA` |
| `local_net_address` | Server-side IP address accepting the connection |
| `local_tcp_port` | Server-side TCP port accepting the connection |
| `client_net_address` | Client-side IP address |
| `physical_net_transport` | Physical transport (exposes `SSL` suffix when encrypted) |

*Read seven connection properties for the current connection.*

```sql
SELECT
    CAST(CONNECTIONPROPERTY('net_transport')          AS nvarchar(40)) AS net_transport,
    CAST(CONNECTIONPROPERTY('protocol_type')          AS nvarchar(40)) AS protocol_type,
    CAST(CONNECTIONPROPERTY('auth_scheme')            AS nvarchar(40)) AS auth_scheme,
    CAST(CONNECTIONPROPERTY('local_net_address')      AS nvarchar(48)) AS local_net_address,
    CAST(CONNECTIONPROPERTY('local_tcp_port')         AS int)          AS local_tcp_port,
    CAST(CONNECTIONPROPERTY('client_net_address')     AS nvarchar(48)) AS client_net_address,
    CAST(CONNECTIONPROPERTY('physical_net_transport') AS nvarchar(40)) AS physical_net_transport;
```

| net_transport | protocol_type | auth_scheme | local_net_address | local_tcp_port | client_net_address | physical_net_transport |
|---|---|---|---|---|---|---|
| TCP | TSQL | SQL | 172.19.0.2 | 1433 | 172.19.0.1 | TCP |

The current connection uses TCP transport (the universal default), the T-SQL protocol, and SQL Server authentication (`auth_scheme = SQL` as opposed to `NTLM`/`Kerberos` for Windows auth). The server IP `172.19.0.2` is the Docker container address inside the project network; the client IP `172.19.0.1` is the Docker bridge gateway. The local TCP port `1433` is the instance's listening port **inside** the container (the host port `1434` is mapped by Docker to this internal port). `physical_net_transport` reads plain `TCP` with no `SSL` suffix, confirming that this connection was opened with encryption disabled (`Encrypt=no` in the connection string).

### CURRENT_REQUEST_ID and CURRENT_TRANSACTION_ID

`CURRENT_REQUEST_ID()` (SQL Server 2019+) returns an integer that uniquely identifies the current **request** within the session. A session can execute multiple sequential requests — for example, a long-lived connection that runs thousands of RPC calls — each with its own request id that joins cleanly back to `sys.dm_exec_requests.request_id`. `CURRENT_TRANSACTION_ID()` returns the `bigint` transaction id that joins back to `sys.dm_tran_active_transactions.transaction_id`, useful for deadlock analysis and long-running-transaction triage.

*Return the current request id and transaction id.*

```sql
SELECT
    CURRENT_REQUEST_ID()      AS current_request_id,
    CURRENT_TRANSACTION_ID()  AS current_transaction_id;
```

| current_request_id | current_transaction_id |
|---|---|
| 0 | 119200 |

The request id is `0` because this is the first (and only) request on this session; in a long-lived connection that has executed 5,000 queries, it would be a small integer matching the sequential request counter. The transaction id `119200` is a monotonically increasing `bigint` server-wide; it joins directly to `sys.dm_tran_active_transactions` and `sys.dm_tran_session_transactions` to inspect lock holdings, wait state, and transaction duration.

## Principals and Security Identity

T-SQL has **nine** built-in functions that return some form of "who is running this code". They look redundant but each one means something different, and picking the wrong one produces auditing bugs that are hard to detect in testing but trivially exploitable in production. This section documents all nine, their `EXECUTE AS` behavior, and the permission-check helpers that go with them.

### The nine principal functions

| Function | Return | Scope | EXECUTE AS behavior |
|---|---|---|---|
| `SUSER_SNAME()` | `nvarchar(128)` | **Server** login name | Follows impersonation |
| `SUSER_NAME()` | `nvarchar(128)` | **Server** login name (synonym of `SUSER_SNAME` for current session) | Follows impersonation |
| `SUSER_ID()` | `int` | **Server** login id (`sys.server_principals.principal_id`) | Follows impersonation |
| `USER_NAME()` | `nvarchar(128)` | **Database** user name | Follows impersonation |
| `USER_ID()` | `int` | **Database** user id (`sys.database_principals.principal_id`) | Follows impersonation |
| `CURRENT_USER` | `sysname` | Database user (niladic function — no parentheses) | Follows impersonation |
| `SESSION_USER` | `sysname` | Database user (another niladic synonym) | Follows impersonation |
| `SYSTEM_USER` | `sysname` | Server login (niladic synonym of `SUSER_SNAME`) | Follows impersonation |
| `ORIGINAL_LOGIN()` | `sysname` | **Server** login that opened the connection | **Ignores** impersonation |

The nine-function catalog splits into three concepts:

- **Server-level principal** — identified by login; returned by `SUSER_SNAME`, `SUSER_NAME`, `SUSER_ID`, `SYSTEM_USER`, and `ORIGINAL_LOGIN`. A login is a server-wide identity tied to an authentication method.
- **Database-level principal** — identified by user; returned by `USER_NAME`, `USER_ID`, `CURRENT_USER`, `SESSION_USER`. A user is a database-local identity **mapped** to a login. The same login can map to different user names in different databases.
- **Impersonation resistance** — every function except `ORIGINAL_LOGIN()` follows `EXECUTE AS`. `ORIGINAL_LOGIN()` always returns the login that opened the connection, regardless of any impersonation that has happened since. This is the only function safe for auditing.

*Read all nine functions in one row.*

```sql
SELECT
    SUSER_SNAME()      AS suser_sname,
    SUSER_NAME()       AS suser_name,
    SUSER_ID()         AS suser_id,
    USER_NAME()        AS user_name,
    USER_ID()          AS user_id,
    CURRENT_USER       AS current_user_niladic,
    SESSION_USER       AS session_user_niladic,
    SYSTEM_USER        AS system_user_niladic,
    ORIGINAL_LOGIN()   AS original_login;
```

| suser_sname | suser_name | suser_id | user_name | user_id | current_user_niladic | session_user_niladic | system_user_niladic | original_login |
|---|---|---|---|---|---|---|---|---|
| sa | sa | 1 | dbo | 1 | dbo | dbo | sa | sa |

This session connected as server login `sa`, which is mapped to the database user `dbo` in the current database (`stoxx`). The five login-level functions all return `sa`, while the four database-level functions all return `dbo`. `SUSER_ID() = 1` is the server principal id of `sa` (always `1` for `sa`); `USER_ID() = 1` happens to coincide because `dbo` is also principal id `1` in each database by convention, but that is not a general rule — it is a coincidence of the `dbo` principal. The three niladic functions (`CURRENT_USER`, `SESSION_USER`, `SYSTEM_USER`) have no parentheses because they predate the function syntax — they were inherited from the ANSI SQL-92 standard, which defines them as reserved identifiers rather than functions.

### ORIGINAL_LOGIN is the only function safe for auditing

> [!danger] `SUSER_SNAME()` and `SYSTEM_USER` return the **impersonated** principal under EXECUTE AS
>
> Once `EXECUTE AS LOGIN = 'other_login'` or `EXECUTE AS USER = 'other_user'` is active, every login-identity function **except `ORIGINAL_LOGIN()`** returns the impersonated identity, not the real caller. Auditing logic that logs `SUSER_SNAME()` as "who made this change" records the impersonated identity and hides the real actor. An attacker with `IMPERSONATE` rights can now launder any destructive action through the impersonated principal and the audit trail will blame the wrong party.

> [!success] Use `ORIGINAL_LOGIN()` in every audit trail
>
> `ORIGINAL_LOGIN()` always returns the login that opened the connection, regardless of any `EXECUTE AS` in effect. Every `OUTPUT INTO dbo.audit_*` pattern should capture `ORIGINAL_LOGIN()` rather than `SUSER_SNAME()` so the audit row records the real actor — even if the DML was routed through an impersonation for schema-permission reasons.

### Permission check helpers

Three functions probe whether the current principal has a specific permission. They all return `int` with `1 = yes`, `0 = no`, `NULL = unknown or error`.

| Function | Checks |
|---|---|
| `IS_SRVROLEMEMBER('role_name' [, 'login'])` | Server-role membership (e.g. `sysadmin`, `securityadmin`, `serveradmin`, `processadmin`, `public`) |
| `IS_ROLEMEMBER('role_name' [, 'user'])` | Database-role membership (e.g. `db_owner`, `db_datareader`, `db_datawriter`, `db_securityadmin`) |
| `HAS_PERMS_BY_NAME('object', 'class', 'permission')` | Direct permission check on a specific securable |

`IS_SRVROLEMEMBER` and `IS_ROLEMEMBER` take an optional second argument to check **another** login/user's membership; without it, they check the current principal.

*Check six distinct permissions for the current principal on `silver.eurostoxx50_ohlcv`.*

```sql
SELECT
    IS_SRVROLEMEMBER('sysadmin')                         AS is_sysadmin,
    IS_SRVROLEMEMBER('public')                           AS is_public,
    IS_ROLEMEMBER('db_owner')                            AS is_db_owner,
    IS_ROLEMEMBER('db_datareader')                       AS is_db_datareader,
    HAS_PERMS_BY_NAME(N'silver.eurostoxx50_ohlcv',
                      'OBJECT', 'SELECT')                AS can_select_ohlcv,
    HAS_PERMS_BY_NAME(N'silver.eurostoxx50_ohlcv',
                      'OBJECT', 'DELETE')                AS can_delete_ohlcv;
```

| is_sysadmin | is_public | is_db_owner | is_db_datareader | can_select_ohlcv | can_delete_ohlcv |
|---|---|---|---|---|---|
| 1 | 1 | 1 | 1 | 1 | 1 |

Every check returns `1` because the current connection is `sa` — the canonical sysadmin login which is implicitly a member of every role and holds every permission on every securable. On a hardened production login the results would differ: a read-only reporting login would see `is_sysadmin = 0`, `is_db_datareader = 1`, `can_select_ohlcv = 1`, `can_delete_ohlcv = 0`. This pattern is the idiomatic way to write "degrade gracefully if the caller lacks permission `X`" logic without relying on `TRY/CATCH` to catch the permission-denied error after the fact.

## Database and Object Metadata

The object-metadata family translates between **names** (strings an engineer types) and **ids** (integers that DMVs store). `OBJECT_ID('silver.eurostoxx50_ohlcv')` converts a two-part name into an `object_id`; `OBJECT_NAME(object_id)` reverses the lookup. Every DMV join against `sys.objects`, `sys.indexes`, `sys.partitions`, or `sys.dm_db_*` eventually passes through these functions — without them, the DMV surface is an opaque integer soup. The functions chain cleanly: `SCHEMA_ID('silver')` → `SCHEMA_NAME(SCHEMA_ID('silver'))` → `'silver'`.

### DB_NAME, DB_ID, OBJECT_ID, SCHEMA_ID and their inverses

*Translate names to ids and back for the current database, a named database, a schema, and an object.*

```sql
SELECT
    DB_NAME() AS current_db,
    DB_ID()   AS current_db_id,
    DB_ID(N'stoxx_db') AS stoxx_db_id,
    OBJECT_ID(N'silver.eurostoxx50_ohlcv') AS ohlcv_object_id,
    OBJECT_NAME(OBJECT_ID(N'silver.eurostoxx50_ohlcv')) AS object_name,
    OBJECT_SCHEMA_NAME(OBJECT_ID(N'silver.eurostoxx50_ohlcv')) AS object_schema,
    SCHEMA_ID(N'silver') AS silver_schema_id,
    SCHEMA_NAME(SCHEMA_ID(N'silver')) AS silver_schema_name;
```

| current_db | current_db_id | stoxx_db_id | ohlcv_object_id | object_name | object_schema | silver_schema_id | silver_schema_name |
|---|---|---|---|---|---|---|---|
| stoxx | 5 | 6 | 1493580359 | eurostoxx50_ohlcv | silver | 6 | silver |

The current database is `stoxx` (id `5`); the sibling `stoxx_db` is id `6`. The two-part name `silver.eurostoxx50_ohlcv` resolves to object id `1493580359` — an int in the stable `1..2^31-1` range that is assigned at `CREATE` time and never changes for the lifetime of the object. `OBJECT_NAME(1493580359)` reverses the lookup and returns `'eurostoxx50_ohlcv'`; `OBJECT_SCHEMA_NAME(1493580359)` returns `'silver'`. The chained `SCHEMA_NAME(SCHEMA_ID(N'silver'))` round-trips cleanly — `SCHEMA_ID` and `SCHEMA_NAME` are exact inverses.

`OBJECT_ID` accepts an optional second argument that **filters by object type**: `OBJECT_ID(N'silver.eurostoxx50_ohlcv', 'U')` only returns an id if the object is a user table (`U`). The full object-type-code table is given in the `### Idempotent DDL patterns` subsection below.

### OBJECTPROPERTY — boolean object metadata

`OBJECTPROPERTY(object_id, property)` returns boolean metadata about the object — whether it is a table vs a view, whether it has a primary key, whether it has any trigger of each type. The Microsoft [OBJECTPROPERTY reference](https://learn.microsoft.com/en-us/sql/t-sql/functions/objectproperty-transact-sql) lists over 100 properties; the table below covers the dozen most used in diagnostic scripts.

| Property | Meaning |
|---|---|
| `IsTable` | `1` for any table (user, system, temp) |
| `IsUserTable` | `1` for user tables only — the defensive form |
| `IsView` | `1` for views |
| `IsProcedure` | `1` for stored procedures |
| `IsScalarFunction` | `1` for scalar functions |
| `IsTableFunction` | `1` for multi-statement TVFs |
| `IsInlineFunction` | `1` for inline TVFs |
| `HasPrimaryKey` | `1` if any primary key is defined (returns `NULL` in recent versions — use `sys.indexes.is_primary_key` instead) |
| `HasIndex` | `1` if any index is defined (same `NULL` quirk) |
| `IsIndexed` | `1` if the table has at least one index |
| `HasInsertTrigger` | `1` if any `AFTER INSERT` or `INSTEAD OF INSERT` trigger exists |
| `HasUpdateTrigger` | `1` if any update trigger exists |
| `HasDeleteTrigger` | `1` if any delete trigger exists |
| `TableHasIdentity` | `1` if any column has an `IDENTITY` property |

*Read eight boolean properties for `silver.eurostoxx50_ohlcv`.*

```sql
SELECT
    OBJECTPROPERTY(OBJECT_ID(N'silver.eurostoxx50_ohlcv'), 'IsTable')           AS is_table,
    OBJECTPROPERTY(OBJECT_ID(N'silver.eurostoxx50_ohlcv'), 'IsUserTable')       AS is_user_table,
    OBJECTPROPERTY(OBJECT_ID(N'silver.eurostoxx50_ohlcv'), 'HasPrimaryKey')     AS has_primary_key,
    OBJECTPROPERTY(OBJECT_ID(N'silver.eurostoxx50_ohlcv'), 'HasIndex')          AS has_index,
    OBJECTPROPERTY(OBJECT_ID(N'silver.eurostoxx50_ohlcv'), 'HasInsertTrigger')  AS has_insert_trigger,
    OBJECTPROPERTY(OBJECT_ID(N'silver.eurostoxx50_ohlcv'), 'HasUpdateTrigger')  AS has_update_trigger,
    OBJECTPROPERTY(OBJECT_ID(N'silver.eurostoxx50_ohlcv'), 'TableHasIdentity')  AS table_has_identity,
    OBJECTPROPERTY(OBJECT_ID(N'silver.eurostoxx50_ohlcv'), 'IsIndexed')         AS is_indexed;
```

| is_table | is_user_table | has_primary_key | has_index | has_insert_trigger | has_update_trigger | table_has_identity | is_indexed |
|---|---|---|---|---|---|---|---|
| 1 | 1 | NULL | NULL | 0 | 0 | 1 | 1 |

`silver.eurostoxx50_ohlcv` is a user table (`is_table = 1`, `is_user_table = 1`) with an identity column (`id`), no triggers, and at least one index (`is_indexed = 1`). The `NULL` values for `HasPrimaryKey` and `HasIndex` are a known quirk in recent SQL Server versions — these specific properties return `NULL` instead of a boolean. The reliable replacements are `sys.indexes.is_primary_key = 1` (for "has PK") and `EXISTS(SELECT 1 FROM sys.indexes WHERE object_id = @oid AND index_id > 0)` (for "has any index"). Prefer those over `HasPrimaryKey`/`HasIndex` in new code.

### COL_NAME, COL_LENGTH, COLUMNPROPERTY — column-level metadata

The column-level helpers mirror `OBJECT_ID`/`OBJECTPROPERTY` for individual columns:

- **`COL_NAME(object_id, column_ordinal)`** — returns the column name at the given 1-based ordinal. Useful for walking the columns of an unknown table in dynamic SQL.
- **`COL_LENGTH('schema.table', 'column')`** — returns the maximum defined length in **bytes** (not characters).
- **`COLUMNPROPERTY(object_id, 'column', property)`** — boolean properties: `IsIdentity`, `IsComputed`, `AllowsNull`, `IsRowGuidCol`, `ColumnId`.

*Walk the first three columns of `silver.eurostoxx50_ohlcv` and probe two properties of the `id` and `volume` columns.*

```sql
SELECT
    COL_NAME(OBJECT_ID(N'silver.eurostoxx50_ohlcv'), 1) AS col_1,
    COL_NAME(OBJECT_ID(N'silver.eurostoxx50_ohlcv'), 2) AS col_2,
    COL_NAME(OBJECT_ID(N'silver.eurostoxx50_ohlcv'), 3) AS col_3,
    COL_LENGTH(N'silver.eurostoxx50_ohlcv', 'symbol')   AS symbol_bytes,
    COLUMNPROPERTY(OBJECT_ID(N'silver.eurostoxx50_ohlcv'), 'id',     'IsIdentity') AS id_is_identity,
    COLUMNPROPERTY(OBJECT_ID(N'silver.eurostoxx50_ohlcv'), 'volume', 'AllowsNull') AS volume_nullable;
```

| col_1 | col_2 | col_3 | symbol_bytes | id_is_identity | volume_nullable |
|---|---|---|---|---|---|
| id | symbol | date | 20 | 1 | 1 |

The first three columns in ordinal order are `id`, `symbol`, `date`. `symbol` is defined as `varchar(20)` — 20 bytes. The `id` column carries the `IDENTITY` property (`id_is_identity = 1`) and the `volume` column is nullable (`volume_nullable = 1`). For a schema audit over many columns, the idiomatic pattern is to join `sys.columns` instead of calling `COLUMNPROPERTY` in a loop — `COLUMNPROPERTY` is best for one-off lookups or when generating dynamic SQL that must decide per column whether to emit an `IDENTITY_INSERT` block.

### TYPE_NAME and TYPE_ID

`TYPE_NAME(type_id)` and `TYPE_ID('type_name')` translate between SQL Server's internal type-id integers and their T-SQL type names. Every column in `sys.columns`, `sys.parameters`, and `sys.types` stores a `user_type_id` and `system_type_id`; `TYPE_NAME` converts those integers into readable strings for generated-SQL scripts.

*Map three type ids to names and three names to ids.*

```sql
SELECT
    TYPE_NAME(56)  AS type_56,
    TYPE_NAME(231) AS type_231,
    TYPE_NAME(167) AS type_167,
    TYPE_ID('int')      AS id_int,
    TYPE_ID('nvarchar') AS id_nvarchar,
    TYPE_ID('decimal')  AS id_decimal;
```

| type_56 | type_231 | type_167 | id_int | id_nvarchar | id_decimal |
|---|---|---|---|---|---|
| int | nvarchar | varchar | 56 | 231 | 106 |

Type id `56` is `int`, `231` is `nvarchar`, `167` is `varchar`, `106` is `decimal`. These integers are stable across versions and appear everywhere in DMV output — knowing the common mappings (`56 = int`, `127 = bigint`, `167 = varchar`, `231 = nvarchar`, `106 = decimal`, `61 = datetime`, `42 = datetime2`, `36 = uniqueidentifier`) is a time-saver when reading raw DMV output without a JOIN to `sys.types`.

### PARSENAME — parsing four-part names

`PARSENAME(object_name, part)` extracts one of the four segments of a fully qualified T-SQL name. The parts are numbered from right to left:

- **`part = 1`** — object name
- **`part = 2`** — schema name
- **`part = 3`** — database name
- **`part = 4`** — server (linked-server) name

`PARSENAME` takes the name as a plain string, so it works on any dot-separated string, not just T-SQL identifiers — see the IP address trick below.

*Parse a fully qualified four-part name.*

```sql
DECLARE @n sysname = N'prod_server.stoxx.silver.eurostoxx50_ohlcv';
SELECT
    PARSENAME(@n, 4) AS server_part,
    PARSENAME(@n, 3) AS database_part,
    PARSENAME(@n, 2) AS schema_part,
    PARSENAME(@n, 1) AS object_part;
```

| server_part | database_part | schema_part | object_part |
|---|---|---|---|
| prod_server | stoxx | silver | eurostoxx50_ohlcv |

The four segments split cleanly. Missing segments return `NULL` — `PARSENAME(N'schema.object', 4)` returns `NULL` because there is no server-level prefix. This is the canonical way for dynamic SQL to normalize a caller-supplied object name: split it into parts, default missing parts with `COALESCE(..., 'dbo')` or `DB_NAME()`, and rebuild the qualified form with `QUOTENAME(...)` on each segment.

#### PARSENAME as an IP address parser

*Split an IPv4 address into its four octets using `PARSENAME`.*

```sql
SELECT
    PARSENAME('10.20.30.40', 4) AS octet_1,
    PARSENAME('10.20.30.40', 3) AS octet_2,
    PARSENAME('10.20.30.40', 2) AS octet_3,
    PARSENAME('10.20.30.40', 1) AS octet_4;
```

| octet_1 | octet_2 | octet_3 | octet_4 |
|---|---|---|---|
| 10 | 20 | 30 | 40 |

Because `PARSENAME` splits on literal `.` without requiring the parts to be valid T-SQL identifiers, it doubles as a zero-dependency IPv4 parser. This is not strictly what the function was designed for, but the trick has been part of the T-SQL repertoire since SQL Server 2000 and shows up in audit-log and geolocation queries. For IPv6 or anything more complex, fall back to `STRING_SPLIT` or `PARSENAME` applied per segment.

### Idempotent DDL patterns using OBJECT_ID

The most common everyday use of `OBJECT_ID` is writing **idempotent DDL**: `IF OBJECT_ID(...) IS NOT NULL DROP ...` guards let a deployment script be re-run without errors. The second argument of `OBJECT_ID` is a two-character type code that filters the lookup to objects of that exact type.

*Probe two tables and confirm one exists while the other does not.*

```sql
SELECT
    CASE WHEN OBJECT_ID(N'silver.eurostoxx50_ohlcv','U') IS NOT NULL
         THEN 'exists' ELSE 'missing' END AS ohlcv_table,
    CASE WHEN OBJECT_ID(N'silver.does_not_exist','U') IS NOT NULL
         THEN 'exists' ELSE 'missing' END AS fake_table;
```

| ohlcv_table | fake_table |
|---|---|
| exists | missing |

The `'U'` filter restricts the lookup to **user tables** — so a view with the same name would not match, and an object-doesn't-exist case returns `NULL`. The full object-type catalog is documented below.

*Count objects in the current database by type using `sys.objects`.*

```sql
SELECT TOP (10) type, type_desc, COUNT(*) AS cnt
FROM sys.objects
GROUP BY type, type_desc
ORDER BY type_desc;
```

| type | type_desc | cnt |
|---|---|---|
| D  | DEFAULT_CONSTRAINT | 38 |
| IT | INTERNAL_TABLE | 36 |
| PK | PRIMARY_KEY_CONSTRAINT | 33 |
| SQ | SERVICE_QUEUE | 3 |
| S  | SYSTEM_TABLE | 72 |
| U  | USER_TABLE | 41 |

The `type` column is the two-character code used by the second argument of `OBJECT_ID`. The most frequently used codes are listed in the table below.

| Code | `type_desc` | Meaning |
|---|---|---|
| `U`  | `USER_TABLE` | User table |
| `V`  | `VIEW` | View |
| `P`  | `SQL_STORED_PROCEDURE` | Stored procedure |
| `PC` | `CLR_STORED_PROCEDURE` | CLR stored procedure |
| `FN` | `SQL_SCALAR_FUNCTION` | T-SQL scalar function |
| `IF` | `SQL_INLINE_TABLE_VALUED_FUNCTION` | Inline TVF |
| `TF` | `SQL_TABLE_VALUED_FUNCTION` | Multi-statement TVF |
| `TR` | `SQL_TRIGGER` | Trigger |
| `SN` | `SYNONYM` | Synonym |
| `SO` | `SEQUENCE_OBJECT` | Sequence |
| `D`  | `DEFAULT_CONSTRAINT` | Default constraint |
| `C`  | `CHECK_CONSTRAINT` | Check constraint |
| `PK` | `PRIMARY_KEY_CONSTRAINT` | Primary key constraint |
| `UQ` | `UNIQUE_CONSTRAINT` | Unique constraint |
| `F`  | `FOREIGN_KEY_CONSTRAINT` | Foreign key constraint |
| `S`  | `SYSTEM_TABLE` | System base table |
| `IT` | `INTERNAL_TABLE` | Engine-internal table |
| `SQ` | `SERVICE_QUEUE` | Service Broker queue |

The idiomatic idempotent-DDL block uses the appropriate code per object:

```sql
IF OBJECT_ID(N'dbo.audit_price_changes','U')   IS NOT NULL DROP TABLE dbo.audit_price_changes;
IF OBJECT_ID(N'dbo.v_active_positions','V')    IS NOT NULL DROP VIEW  dbo.v_active_positions;
IF OBJECT_ID(N'dbo.sp_rebalance','P')          IS NOT NULL DROP PROCEDURE dbo.sp_rebalance;
IF OBJECT_ID(N'dbo.fn_tenant_filter','IF')     IS NOT NULL DROP FUNCTION dbo.fn_tenant_filter;
IF OBJECT_ID(N'dbo.seq_order_id','SO')         IS NOT NULL DROP SEQUENCE dbo.seq_order_id;
```

Using the type code is defensive: it guards against accidentally dropping a **different** object that happens to share the name (for example, a view named `dbo.v_active_positions` that was later replaced by a table of the same name in a botched migration). Without the type filter, `IF OBJECT_ID(N'dbo.v_active_positions') IS NOT NULL DROP VIEW dbo.v_active_positions` would raise an error because `DROP VIEW` cannot drop a table.

## Session Context Storage

SQL Server has two distinct mechanisms for storing arbitrary key/value state per session: the legacy `CONTEXT_INFO` binary blob and the modern `SESSION_CONTEXT` key/value store. Both let application code tag a session with metadata (pipeline run id, request correlation id, tenant id) that downstream procedures, triggers, and security predicates can read. `SESSION_CONTEXT` is strictly better for new code; `CONTEXT_INFO` survives in legacy systems and still surfaces in DMV output (`sys.dm_exec_sessions.context_info`).

### CONTEXT_INFO — legacy 128-byte blob

`CONTEXT_INFO` is a single `varbinary(128)` slot per session. It was introduced in SQL Server 2000 and is the oldest way to carry per-session application state. Write with `SET CONTEXT_INFO <varbinary>`, read with `CONTEXT_INFO()`. The single value is always exactly 128 bytes — writing a shorter value right-pads with zeros, writing a longer value raises an error.

*Set a 16-byte payload and read it back as a 128-byte blob.*

```sql
DECLARE @payload varbinary(128) = 0xDEADBEEFCAFEBABE;
SET CONTEXT_INFO @payload;
SELECT CONTEXT_INFO() AS context_info_bytes;
```

| context_info_bytes |
|---|
| 0xdeadbeefcafebabe000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000 |

The 8-byte payload `0xDEADBEEFCAFEBABE` is right-padded with `0x00` bytes to fill the full 128-byte slot. Reading `CONTEXT_INFO()` returns the whole buffer; the consumer is responsible for trimming and decoding the meaningful prefix. In practice, applications that used `CONTEXT_INFO` encoded multiple fields into the 128 bytes (a 16-byte correlation GUID, an 8-byte tenant id, a 32-byte user name, etc.), which is painful to maintain and error-prone.

`CONTEXT_INFO` surfaces in `sys.dm_exec_sessions.context_info` — every session's current value is visible to any user with `VIEW SERVER STATE`. This is convenient for live diagnostics ("which session is currently running pipeline run X?") but also means `CONTEXT_INFO` is **not confidential** and should not carry secrets.

> [!info] `SESSION_CONTEXT` supersedes `CONTEXT_INFO`
>
> `SESSION_CONTEXT` (SQL Server 2016+) provides named keys with arbitrary `sql_variant` values and up to 256 KB total per session. It supersedes `CONTEXT_INFO` for every new use case. The only reason to keep using `CONTEXT_INFO` is if you are maintaining code that already depends on it or you need to interop with a client library that only reads the legacy slot.

### SESSION_CONTEXT and sp_set_session_context

`SESSION_CONTEXT` (SQL Server 2016+) is a **key/value store** scoped to the current session. The value type is `sql_variant`, so each key can hold any native SQL type: `int`, `bigint`, `nvarchar`, `varbinary`, `uniqueidentifier`, `datetime2`, etc. Write with `EXEC sys.sp_set_session_context @key, @value [, @read_only]`, read with `SESSION_CONTEXT(@key)`. The total storage budget is 256 KB per session — large enough to hold every piece of per-session metadata a typical application might carry.

*Set two keys and read them back, casting the `sql_variant` values to `nvarchar` for display.*

```sql
EXEC sys.sp_set_session_context @key = N'pipeline_run_id', @value = N'20260411T143000Z';
EXEC sys.sp_set_session_context @key = N'tenant_id',       @value = N'tenant_A';

SELECT
    CAST(SESSION_CONTEXT(N'pipeline_run_id') AS nvarchar(100)) AS pipeline_run_id,
    CAST(SESSION_CONTEXT(N'tenant_id')       AS nvarchar(100)) AS tenant_id;
```

| pipeline_run_id | tenant_id |
|---|---|
| 20260411T143000Z | tenant_A |

Two keys set, two keys read. The values survive across all subsequent statements in the session until either the session ends, another `sp_set_session_context` call overwrites them, or a matching `sp_set_session_context @value = NULL` clears them. Connection pooling is transparent: a pooled connection retains its session context across reuses unless the client explicitly resets it via `sp_reset_connection` (which clears `SESSION_CONTEXT` alongside `CONTEXT_INFO` and all other session state).

### The @read_only flag — immutable session keys

`sp_set_session_context` accepts an optional third argument `@read_only`. When set to `1`, the key becomes **immutable for the lifetime of the session**: any subsequent `sp_set_session_context` call on the same key raises error 15664 and the value cannot be changed. This is the mechanism that makes `SESSION_CONTEXT` safe for Row-Level Security: the application sets the tenant id once at login, flags it read-only, and even malicious T-SQL running in the same session cannot rewrite it to see another tenant's data.

> [!success] Use `@read_only = 1` for any session-context key that drives security policy
>
> An RLS predicate that reads `SESSION_CONTEXT(N'tenant_id')` is only as strong as the guarantee that the value cannot be rewritten after it is set. `@read_only = 1` is that guarantee: once set, the key is locked for the session, and any attempt to overwrite it raises error 15664 at the T-SQL layer before the write has any effect. Always flag security-critical session-context keys as read-only at the point of login.

*Set a key as read-only, read it back, then try to overwrite it and observe the error.*

```sql
EXEC sys.sp_set_session_context @key = N'immutable_key',
                                @value = N'first_value',
                                @read_only = 1;

SELECT CAST(SESSION_CONTEXT(N'immutable_key') AS nvarchar(100)) AS before_overwrite;

EXEC sys.sp_set_session_context @key = N'immutable_key',
                                @value = N'second_value';
```

```text
Msg 15664, Level 16, State 1
Cannot set key 'immutable_key' in the session context.
The key has been set as read_only for this session.
```

The first `SELECT` succeeds and returns `first_value`. The second `sp_set_session_context` call raises error 15664 and aborts — the key is locked for the remainder of the session. Even an attacker with `EXECUTE` permission on arbitrary T-SQL cannot rewrite the key, which makes it a trustworthy basis for security predicates. The key can only be cleared by closing the session or (for pooled connections) calling `sp_reset_connection`.

### Row-Level Security integration with SESSION_CONTEXT

The canonical production use of `SESSION_CONTEXT` is **Row-Level Security (RLS)**: a security policy attaches a **predicate function** to a table, the predicate function reads `SESSION_CONTEXT(N'tenant_id')`, and the engine automatically filters every query against the table to only rows whose `tenant_id` matches the session context. The filtering is invisible to the caller — application code does not need to add `WHERE tenant_id = @session_tenant` to every query. The engine enforces it at the execution-plan level.

The four-part pattern is:

1. **Table** with a tenant-discriminator column (`tenant_id`, `customer_id`, `region_id`, etc.).
2. **Predicate function** — an inline table-valued function that returns 1 row when the caller should see the row, 0 rows otherwise. The function reads `SESSION_CONTEXT(...)` and typically includes a sysadmin bypass via `IS_SRVROLEMEMBER('sysadmin')`.
3. **Security policy** — a schema object that binds the predicate function to the table, with `FILTER PREDICATE` (for `SELECT`) and/or `BLOCK PREDICATE` (for `INSERT`/`UPDATE`/`DELETE`).
4. **Login flow** — the application sets the session context key with `@read_only = 1` immediately after opening the connection, before any query runs.

#### Build the test scenario: tenant-partitioned orders table

*Create an orders table with a `tenant_id` column and seed it with 6 rows across two tenants. Grant SELECT to a non-sysadmin user.*

```sql
CREATE TABLE dbo.tenant_orders
(
    order_id     int IDENTITY(1,1) PRIMARY KEY,
    tenant_id    varchar(20) NOT NULL,
    symbol       varchar(20) NOT NULL,
    quantity     int         NOT NULL,
    placed_at    datetime2(3) NOT NULL CONSTRAINT DF_tenant_orders DEFAULT SYSUTCDATETIME()
);

INSERT INTO dbo.tenant_orders (tenant_id, symbol, quantity) VALUES
    ('tenant_A', 'ASML.AS', 100),
    ('tenant_A', 'MC.PA',    50),
    ('tenant_A', 'SAP.DE',   75),
    ('tenant_B', 'SIE.DE',   30),
    ('tenant_B', 'ALV.DE',   40),
    ('tenant_B', 'ADYEN.AS', 10);

GRANT SELECT ON dbo.tenant_orders TO tenant_app_user;

SELECT tenant_id, COUNT(*) AS n FROM dbo.tenant_orders GROUP BY tenant_id ORDER BY tenant_id;
```

| tenant_id | n |
|---|---|
| tenant_A | 3 |
| tenant_B | 3 |

Six rows total, three per tenant. The `tenant_app_user` is a non-sysadmin database user mapped to the `tenant_app` login — it represents the application's runtime identity. The tenant-id column is a plain varchar; any RLS implementation uses an existing partitioning column and does not require a specific data type.

#### Create the predicate function

> [!info]- Clause-by-clause breakdown
>
> - `RETURNS TABLE` — the function is an **inline TVF** (`IF` object type). Inline TVFs are inlined into the outer query plan, so the predicate adds zero runtime overhead beyond the extra `WHERE` clause it effectively synthesizes. Scalar functions cannot be used as predicates — the engine requires an inline TVF for performance.
> - `WITH SCHEMABINDING` — binds the function to the schema it references. Required for RLS predicate functions so the referenced columns cannot be dropped out from under the policy.
> - `SELECT 1 AS fn_result WHERE ...` — returns 1 row when the predicate evaluates to true, 0 rows otherwise. The engine treats "function returned 1 row" as "this row is visible to the caller" and "function returned 0 rows" as "filter this row out".
> - `@tenant_id = CAST(SESSION_CONTEXT(N'tenant_id') AS varchar(20))` — the tenant match. The `SESSION_CONTEXT` read returns `sql_variant`, which must be cast to a comparable type before equality testing.
> - `OR IS_SRVROLEMEMBER('sysadmin') = 1` — the sysadmin bypass. Without it, even sa would be unable to see rows during maintenance. Production predicates usually replace this with a specific "service account" check (e.g. `OR ORIGINAL_LOGIN() = 'etl_service'`) to scope the bypass narrowly.

*Create the predicate function that reads `SESSION_CONTEXT(N'tenant_id')`.*

```sql
CREATE FUNCTION dbo.fn_tenant_filter(@tenant_id varchar(20))
RETURNS TABLE
WITH SCHEMABINDING
AS
RETURN
(
    SELECT 1 AS fn_result
    WHERE @tenant_id = CAST(SESSION_CONTEXT(N'tenant_id') AS varchar(20))
       OR IS_SRVROLEMEMBER('sysadmin') = 1
);
```

#### Create the security policy

*Create the security policy that binds the predicate function to the orders table as a filter predicate.*

```sql
CREATE SECURITY POLICY dbo.tenant_rls_policy
ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.tenant_orders
WITH (STATE = ON);
```

`ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id)` binds the function to `dbo.tenant_orders` and passes the table's `tenant_id` column as the argument. `WITH (STATE = ON)` activates the policy immediately. Multiple `FILTER PREDICATE` and `BLOCK PREDICATE` clauses can be added to the same policy for different tables; a single policy typically owns every table in a given RLS domain.

#### Verify that sa still sees all rows via the sysadmin bypass

*Read the table as the current sa session. The predicate's `IS_SRVROLEMEMBER('sysadmin') = 1` branch returns true, so all 6 rows are visible regardless of the tenant_id session context.*

```sql
EXEC sys.sp_set_session_context @key = N'tenant_id', @value = NULL;

SELECT order_id, tenant_id, symbol, quantity
FROM dbo.tenant_orders
ORDER BY order_id;
```

| order_id | tenant_id | symbol | quantity |
|---|---|---|---|
| 1 | tenant_A | ASML.AS | 100 |
| 2 | tenant_A | MC.PA | 50 |
| 3 | tenant_A | SAP.DE | 75 |
| 4 | tenant_B | SIE.DE | 30 |
| 5 | tenant_B | ALV.DE | 40 |
| 6 | tenant_B | ADYEN.AS | 10 |

The session context tenant id is `NULL`, but the sysadmin bypass in the predicate short-circuits the check and returns every row. This is the expected behavior for administrative sessions during maintenance — a sysadmin can always see the full table, which is critical for backup, ETL jobs, and break-glass troubleshooting.

#### Read as tenant_A under EXECUTE AS

*Impersonate the non-sysadmin `tenant_app_user` and read the table with the tenant context set to `tenant_A`.*

```sql
EXEC sys.sp_set_session_context @key = N'tenant_id', @value = N'tenant_A';

EXECUTE AS USER = 'tenant_app_user';

SELECT order_id, tenant_id, symbol, quantity
FROM dbo.tenant_orders
ORDER BY order_id;

REVERT;
```

| order_id | tenant_id | symbol | quantity |
|---|---|---|---|
| 1 | tenant_A | ASML.AS | 100 |
| 2 | tenant_A | MC.PA | 50 |
| 3 | tenant_A | SAP.DE | 75 |

Only the three `tenant_A` rows are returned. The `tenant_B` rows are invisible to the impersonated session — they are filtered out **by the engine**, not by an application `WHERE` clause. The query text is `SELECT ... FROM dbo.tenant_orders` with no tenant filter, and the engine silently wraps every read in the predicate function. This is the defining property of RLS: **the application code does not need to carry the tenant filter anywhere**, and it is impossible for a buggy or malicious query to bypass it.

#### Read as tenant_B

*Same pattern for tenant_B — one sp_set_session_context call and the view of the table changes completely.*

```sql
EXEC sys.sp_set_session_context @key = N'tenant_id', @value = N'tenant_B';

EXECUTE AS USER = 'tenant_app_user';

SELECT order_id, tenant_id, symbol, quantity
FROM dbo.tenant_orders
ORDER BY order_id;

REVERT;
```

| order_id | tenant_id | symbol | quantity |
|---|---|---|---|
| 4 | tenant_B | SIE.DE | 30 |
| 5 | tenant_B | ALV.DE | 40 |
| 6 | tenant_B | ADYEN.AS | 10 |

Only the three `tenant_B` rows now. Switching tenants is a single `sp_set_session_context` call — the predicate function re-reads the session context on every row of every query, so there is no stale cache. Note that in a production application the tenant key should be set with `@read_only = 1` at connection-open time and **never** rewritten during the session. A connection pool that reuses the same connection across tenants must call `sp_reset_connection` between tenants to clear the session context.

#### Read with no tenant context set — the implicit-deny case

*Non-sysadmin with no tenant_id in session context. The predicate function returns 0 rows (neither the tenant match nor the sysadmin bypass succeeds), so every row is filtered out.*

```sql
EXEC sys.sp_set_session_context @key = N'tenant_id', @value = NULL;

EXECUTE AS USER = 'tenant_app_user';

SELECT order_id, tenant_id, symbol, quantity
FROM dbo.tenant_orders
ORDER BY order_id;

REVERT;
```

`(0 rows)`

The result set is empty. This is the **implicit deny** pattern: if the predicate function returns 0 rows for every row, the caller sees an empty table. A non-sysadmin connection that forgets to set the session context key reads nothing — no error, no warning, just zero rows. This is exactly the desired behavior for a security boundary: failures default to denial rather than accidental disclosure.

> [!danger] Implicit deny can masquerade as a bug
>
> The empty result set from a forgotten session-context key is easy to misdiagnose as "the table is broken" or "the query has an error". Zero rows here are a security success, not proof that the policy failed; the failure is that the caller never initialized its tenant identity.
>
> [!success] Initialize tenant context at login
>
> Set the tenant key immediately after opening the connection, before any application query runs, and log that initialization in telemetry. A helper such as `sp_begin_session_as_tenant @tenant_id` keeps the pattern explicit, centralizes auditing, and makes the "forgot to set the key" failure mode observable.

For the full Row-Level Security theory — predicate composition, block predicates for INSERT/UPDATE/DELETE, performance tuning, and the security-boundary analysis — see the dedicated RLS coverage in the concurrency chapter (notes 16–18).

## Legacy Server Counters

T-SQL exposes a family of `@@` counters that predate the DMV system. They return cumulative server-level statistics since the last SQL Server service restart. Every one of them has a modern DMV replacement that exposes more detail, per-database breakdowns, and more accurate units — but the legacy counters remain useful for quick probes in scripts that cannot assume `VIEW SERVER STATE` permission.

*Read nine legacy server counters in one row.*

```sql
SELECT
    @@CONNECTIONS    AS connections_since_start,
    @@CPU_BUSY       AS cpu_busy_ticks,
    @@IO_BUSY        AS io_busy_ticks,
    @@PACK_RECEIVED  AS packets_received,
    @@PACK_SENT      AS packets_sent,
    @@TOTAL_ERRORS   AS total_errors,
    @@TOTAL_READ     AS total_disk_reads,
    @@TOTAL_WRITE    AS total_disk_writes,
    @@TIMETICKS      AS microseconds_per_tick;
```

| connections_since_start | cpu_busy_ticks | io_busy_ticks | packets_received | packets_sent | total_errors | total_disk_reads | total_disk_writes | microseconds_per_tick |
|---|---|---|---|---|---|---|---|---|
| 3181 | 1478 | 632 | 5365 | 10629 | 0 | 10596 | 6145 | 31250 |

The counter catalog with units and DMV replacements:

| Counter | Unit | Meaning | Modern DMV replacement |
|---|---|---|---|
| `@@CONNECTIONS` | connections | Total attempted connections since startup | `sys.dm_exec_connections` (live), `sys.dm_os_performance_counters` (rate) |
| `@@CPU_BUSY` | CPU ticks (`@@TIMETICKS` µs each) | Cumulative CPU busy time | `sys.dm_os_ring_buffers` (SCHEDULER_MONITOR), `sys.dm_os_sys_info.cpu_ticks` |
| `@@IO_BUSY` | CPU ticks | Cumulative I/O busy time | `sys.dm_io_virtual_file_stats` (per file) |
| `@@PACK_RECEIVED` | packets | Network packets received since startup | `sys.dm_os_performance_counters` (`SQL Statistics` / `Network packets received/sec`) |
| `@@PACK_SENT` | packets | Network packets sent since startup | same |
| `@@TOTAL_ERRORS` | errors | Disk write errors (not application errors) since startup | `sys.dm_io_virtual_file_stats` |
| `@@TOTAL_READ` | reads | Physical disk reads since startup | `sys.dm_io_virtual_file_stats.num_of_reads` |
| `@@TOTAL_WRITE` | writes | Physical disk writes since startup | `sys.dm_io_virtual_file_stats.num_of_writes` |
| `@@TIMETICKS` | µs per tick | Resolution of the server's internal clock (usually 31.25 ms = 31,250 µs) | Not superseded — this is a constant |

`@@TIMETICKS = 31250` means each tick on this instance is 31,250 microseconds (31.25 ms), so `@@CPU_BUSY * 31250 / 1_000_000 = 46 seconds` of cumulative CPU busy time since startup (1,478 ticks × 31.25 ms). On a well-maintained production system most of these counters are eclipsed by DMV coverage; use them when you need a one-line server health probe that works from any read-only login without DMV permissions.

### Language and version counters

A second group of `@@` variables returns locale and build-specific metadata.

*Read five locale and build counters.*

```sql
SELECT
    @@LANGUAGE          AS language_name,
    @@LANGID            AS language_id,
    @@DATEFIRST         AS first_day_of_week,
    @@DBTS              AS db_timestamp,
    @@MICROSOFTVERSION  AS internal_build_number;
```

| language_name | language_id | first_day_of_week | db_timestamp | internal_build_number |
|---|---|---|---|---|
| us_english | 0 | 7 | 0x000000000004eb50 | 268439692 |

- **`@@LANGUAGE`** — the current session language (`us_english`). Affects `DATENAME()`, `SET DATEFORMAT`, error message language, etc. Set per session with `SET LANGUAGE`.
- **`@@LANGID`** — the language id. `0` = `us_english`, `1` = `German`, `2` = `French`, etc. Joins to `sys.syslanguages.langid`.
- **`@@DATEFIRST`** — the first day of the week for `DATEPART(weekday, ...)`. `7` = Sunday (US default), `1` = Monday (ISO / EU default). Set with `SET DATEFIRST 1`.
- **`@@DBTS`** — the current database's timestamp / rowversion value. Every `rowversion`/`timestamp` column in the database uses a monotonically increasing `binary(8)` from this counter, incremented on every row change. Use it to detect "has the database been modified since X" without touching any user table.
- **`@@MICROSOFTVERSION`** — an internal build number (different from the `@@VERSION` string). Primarily used by tooling that compares against specific build ranges.

## DMV Joining Patterns

The practical payoff of every function documented so far is **joining user table names to DMV rows**. DMVs use `object_id`, `database_id`, and `session_id` as keys — integers that are meaningless without `OBJECT_ID()`, `DB_ID()`, and `@@SPID` to translate them. This section shows three canonical joining patterns you will reuse in every production diagnostic script.

### Pattern 1: index usage stats for one table

*Query `sys.dm_db_index_usage_stats` filtered to a specific table using `DB_ID()` and `OBJECT_ID()`, joined to `sys.indexes` for the human-readable index name.*

```sql
SELECT TOP 5
    i.name AS index_name,
    s.user_seeks,
    s.user_scans,
    s.user_lookups,
    s.user_updates,
    s.last_user_seek,
    s.last_user_scan
FROM sys.dm_db_index_usage_stats AS s
JOIN sys.indexes AS i
    ON i.object_id = s.object_id
   AND i.index_id  = s.index_id
WHERE s.database_id = DB_ID()
  AND s.object_id   = OBJECT_ID(N'silver.eurostoxx50_ohlcv')
ORDER BY s.user_seeks + s.user_scans + s.user_lookups DESC;
```

| index_name | user_seeks | user_scans | user_lookups | user_updates | last_user_seek | last_user_scan |
|---|---|---|---|---|---|---|
| PK__eurostox__3213E83FDF67D274 | 0 | 47 | 55 | 1 | NULL | 2026-04-11 12:31:23.887 |
| IX_silver_eurostoxx50_ohlcv_symbol_date | 51 | 42 | 0 | 0 | 2026-04-11 12:31:23.89 | 2026-04-11 12:44:03.873 |

Two indexes on `silver.eurostoxx50_ohlcv`: the auto-named primary key (`PK__eurostox__...`) and the explicit composite index `IX_silver_eurostoxx50_ohlcv_symbol_date`. The PK has been scanned 47 times and looked up 55 times but never seeked directly — typical pattern for a clustered PK on `id` that gets scanned whenever the query filter is not on `id`. The `IX_*` composite index has been **seeked** 51 times, indicating that queries filtering on `(symbol, [date])` are using it efficiently.

The `DB_ID()` + `OBJECT_ID(N'schema.table')` filter is the canonical entry point. Every `sys.dm_db_*` DMV joins on `(database_id, object_id)` and this filter pair narrows the result to a single table. On a multi-tenant server with hundreds of databases, the `DB_ID()` filter is essential — without it, `sys.dm_db_index_usage_stats` returns rows from every database you can see.

### Pattern 2: current session state

*Query `sys.dm_exec_sessions` filtered to the current session via `@@SPID`.*

```sql
SELECT
    s.session_id,
    s.login_name,
    s.host_name,
    s.program_name,
    s.login_time,
    s.status,
    s.open_transaction_count
FROM sys.dm_exec_sessions AS s
WHERE s.session_id = @@SPID;
```

| session_id | login_name | host_name | program_name | login_time | status | open_transaction_count |
|---|---|---|---|---|---|---|
| 55 | sa | ELYSIUM | Python | 2026-04-11 12:44:03.863 | running | 0 |

Session `55` belongs to login `sa`, connected from host `ELYSIUM`, identified as `Python` via the client-supplied `APP_NAME`. Login time is `2026-04-11 12:44:03.863` (just now), status is `running`, and zero open transactions. Use this pattern as the first diagnostic step whenever a procedure needs to log "what is my session's current state" — it returns in a single row with no lock, no wait, and no server-scope permission requirement beyond the default `VIEW SERVER STATE`.

> [!warning] `host_name` and `program_name` are client labels
>
> The `host_name` column in `sys.dm_exec_sessions` is whatever the client's TDS driver chose to send at connection time. A Python client can set it to any arbitrary string via the `APP=` or `WSID=` parameters, and `program_name` comes from `APPLICATIONNAME=` or the driver default. Treat both fields as operator hints, not as trustworthy identity evidence. `login_name` is server-authenticated, but for audit trails under impersonation the safer anchor is still `ORIGINAL_LOGIN()`.
>
> [!success] Audit from server-side evidence
>
> Use `ORIGINAL_LOGIN()` for the authenticated principal and `client_net_address` from `CONNECTIONPROPERTY` or the connection DMVs for the network trace. Those values belong in authorization decisions and durable audit trails; `host_name` and `program_name` belong in troubleshooting notes only.

### Pattern 3: index list with OBJECTPROPERTY join

*Combine `sys.indexes` with `OBJECTPROPERTY` to list every index on a table along with a check that the parent is a user table.*

```sql
SELECT TOP 5
    i.name        AS index_name,
    i.type_desc,
    i.is_unique,
    i.is_primary_key,
    OBJECTPROPERTY(i.object_id, 'IsUserTable') AS parent_is_user_table
FROM sys.indexes AS i
WHERE i.object_id = OBJECT_ID(N'silver.eurostoxx50_ohlcv')
ORDER BY i.index_id;
```

| index_name | type_desc | is_unique | is_primary_key | parent_is_user_table |
|---|---|---|---|---|
| PK__eurostox__3213E83FDF67D274 | CLUSTERED | 1 | 1 | 1 |
| IX_silver_eurostoxx50_ohlcv_symbol_date | NONCLUSTERED | 1 | 0 | 1 |

Two indexes: the clustered PK (`is_primary_key = 1`, `CLUSTERED`) on `id`, and a **unique** non-clustered composite index on `(symbol, date)` (`is_unique = 1`). Both are parented by a user table (`OBJECTPROPERTY(...'IsUserTable') = 1`). The `PK__*` auto-generated name format signals that the primary key was created without an explicit `CONSTRAINT` name — a common anti-pattern that makes the PK hard to reference in `DROP` and `ALTER` statements. Prefer `CONSTRAINT PK_<schema>_<table> PRIMARY KEY (...)` in every `CREATE TABLE` so the constraint has a deterministic name.

This pattern — combining `sys.indexes` with `OBJECTPROPERTY` — is the idiomatic way to filter the index catalog to indexes on **user tables only**, excluding system tables, internal tables, and service broker queues that `sys.indexes` also covers.

## Practical Guidance

A condensed checklist of habits derived from the rules and traps covered above.

- **Capture `@@ROWCOUNT` immediately** after any DML into a local variable. The clobbering trap is the single most common bug with `@@ROWCOUNT` in production procedures. See the `### @@ROWCOUNT` subsection.
- **Never use `SET ROWCOUNT`** to limit DML — it is deprecated. Use `TOP (n)` on the specific statement.
- **Prefer `TRY/CATCH` and `ERROR_NUMBER()`** over `@@ERROR`. `@@ERROR` is per-statement and gets clobbered by the very assignment statements you write to capture it. See [19-stored-procedures-dynamic-sql-and-error-handling](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/19-stored-procedures-dynamic-sql-and-error-handling).
- **Use `ORIGINAL_LOGIN()` in every audit trail**. Every other identity function follows `EXECUTE AS` impersonation — only `ORIGINAL_LOGIN()` is immune and records the real actor.
- **Wrap `SERVERPROPERTY`, `DATABASEPROPERTYEX`, and `CONNECTIONPROPERTY` in `CAST`**. They return `sql_variant`, which many ODBC drivers cannot decode directly.
- **Check `IsAutoShrink = 0`** in every baseline audit. Auto-shrink is a performance anti-pattern and should never be enabled on production databases.
- **Check `LastGoodCheckDbTime`** as a `DBCC CHECKDB` recency probe. A sentinel value (`Jan  1 1900 12:00AM`) indicates the database has never been successfully checked and needs immediate attention.
- **Use `IF OBJECT_ID(N'...', '<code>') IS NOT NULL`** for idempotent DDL, with the object-type code (`U`, `V`, `P`, `IF`, etc.) to defend against accidental drops of the wrong object type.
- **Use `SESSION_CONTEXT` with `@read_only = 1`** for any security-critical session metadata. The flag makes the key immutable for the session and prevents overwrites by application or malicious code.
- **Call `sp_set_session_context` at connection open** for RLS-bound keys. Forgetting to set the key produces an implicit-deny empty result set that is easy to misdiagnose as a bug.
- **Pair `OBJECT_ID` and `DB_ID`** as the filter pair for every `sys.dm_db_*` query. Without `DB_ID()` the results span every visible database; without `OBJECT_ID()` the results span every object in the filtered database.
- **Trust `@@SPID` for session identity**, `CONNECTIONPROPERTY('client_net_address')` for the source IP, and `ORIGINAL_LOGIN()` for the real login. Never trust `host_name` or `program_name` — both are client-supplied and spoofable.
- **Use `PARSENAME`** to split four-part object names defensively in dynamic SQL. The `QUOTENAME(PARSENAME(...))` chain is the safest way to rebuild qualified names from caller input.

## Cross-references

- [10-insert-update-delete-patterns](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/10-insert-update-delete-patterns) — `SCOPE_IDENTITY`, `@@IDENTITY`, `IDENT_CURRENT`, `OUTPUT INTO` audit trails with `ORIGINAL_LOGIN()`.
- [11-merge-and-upsert](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/11-merge-and-upsert) — `@@TRANCOUNT` semantics under explicit transactions; `OUTPUT $action` routed to audit sinks.
- [19-stored-procedures-dynamic-sql-and-error-handling](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/19-stored-procedures-dynamic-sql-and-error-handling) — full `TRY/CATCH` + `ERROR_*()` coverage that supersedes `@@ERROR`; `SAVE TRANSACTION` for real nested-transaction semantics.
- [02-data-types-conversion-and-null-handling](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/02-data-types-conversion-and-null-handling) — `sql_variant`, `CAST`/`CONVERT` rules for the `SERVERPROPERTY` / `DATABASEPROPERTYEX` return-type handling.
- [13-execution-plans](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/13-execution-plans), [14-wait-stats-analysis](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/14-wait-stats-analysis), [20-query-store-regressions-and-plan-forcing](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/20-query-store-regressions-and-plan-forcing) — DMV queries that use the `OBJECT_ID` / `DB_ID` / `@@SPID` joining patterns from the `## DMV Joining Patterns` section.
- Concurrency chapter (notes 16–18) — full Row-Level Security theory, block predicates, performance tuning, and the security-boundary analysis beyond the operational SESSION_CONTEXT + RLS pattern shown here.
