---
title: "19 - Stored Procedures, Dynamic SQL, and Error Handling"
tags: [sql, sql-server, tsql, stored-procedures, dynamic-sql, sp-executesql, try-catch, throw, raiserror, transactions, xact-abort, xact-state, save-tran, quotename, sql-injection, parameter-sniffing, nocount, output-parameter, execute-as]
aliases: [procedure reference, sp_executesql, TRY CATCH, THROW, XACT_ABORT, XACT_STATE, SAVE TRAN]
description: "T-SQL reference for variables and assignment traps, control-of-flow, stored procedures and parameters, dynamic SQL with sp_executesql and injection defenses, TRY...CATCH, THROW vs RAISERROR, transaction nesting, SAVE TRAN, XACT_STATE, XACT_ABORT, security context, and a full production procedure template."
created: 2026-04-08
updated: 2026-04-11
status: complete
---

# Stored Procedures, Dynamic SQL, and Error Handling

T-SQL is a set-based language with a procedural layer on top: variables, control-of-flow, stored procedures, dynamic SQL, transaction control, and structured error handling. This layer is where the "production grade" part of a database codebase lives — the guarantees that a write either commits cleanly or rolls back atomically, the isolation between business logic and the caller's privileges, the resilience against malformed input or injection attempts. This note covers every piece of that procedural layer in order, with tested demos for each one, and ends with a complete production procedure template that every write procedure in the codebase should follow.

Every demo in this note runs against the local `stoxx` database and shows its real output.

## Variables and Assignment

> [!abstract] DECLARE, SET, SELECT assignment
>
> Every T-SQL batch or procedure body can declare local variables with `DECLARE @name type [= initializer]`. Variables are scoped to the batch (or to the procedure body when declared inside one) and can be assigned with two different statements: `SET` and `SELECT`. They look interchangeable but have two behavioural differences that cause some of the most common silent bugs in T-SQL — so understanding the distinction before writing any procedural code is essential.

### DECLARE

*Every variable must be declared with a type, optionally with an inline initializer.*

#### Typed declaration with initializer

*Combine DECLARE and initial assignment in one statement.*

```sql
DECLARE @symbol varchar(20) = 'ASML.AS';
DECLARE @latest_date date;
SELECT @latest_date = MAX([date])
FROM silver.eurostoxx50_ohlcv
WHERE symbol = @symbol;
SELECT @symbol AS symbol, @latest_date AS latest_date;
```

| symbol | latest_date |
|---|---|
| ASML.AS | 2026-04-07 |

> [!info]- DECLARE anatomy
>
> - `DECLARE @name type` — introduces a new variable in the current batch.
> - `= <initializer>` — optional inline assignment, equivalent to a subsequent `SET @name = <expr>`.
> - Variables are not nullable by default but the initial value is `NULL` unless an initializer is provided.
> - The name is lexical to the batch: variables declared inside a stored procedure are not visible to the caller, and variables declared in the caller are not visible inside a called procedure.

### SET vs SELECT assignment

*Two statements that assign to a variable — with different behaviour on multi-row and no-row sources.*

#### SELECT assignment — multi-row silent bug

*`SELECT @v = col FROM t` returns whichever row the engine processes last, with no warning.*

```sql
DECLARE @v varchar(20);
SELECT @v = symbol FROM silver.eurostoxx50_ohlcv WHERE [date] = '2026-04-07';
SELECT @v AS last_row_wins_silently;
```

| last_row_wins_silently |
|---|
| WKL.AS |

The query matched 50 rows (one per symbol in the Euro Stoxx 50), and `@v` ended up holding `WKL.AS` — the last row the engine processed. There is no error, no warning, and no guarantee about which row wins. The next time you run this on a different version of SQL Server, with different indexing, or at a different moment in the optimizer's cache lifetime, you might get a different value.

#### SET assignment — multi-row error

*`SET @v = (SELECT col FROM t)` is a scalar subquery and errors on multi-row results.*

```sql
DECLARE @v varchar(20);
SET @v = (SELECT symbol FROM silver.eurostoxx50_ohlcv WHERE [date] = '2026-04-07');
SELECT @v;
```

```text
('21000', '[21000] [Microsoft][ODBC Driver 18 for SQL Server][SQL Server]Subquery returned more than 1 value. This is not permitted when the subquery follows =, !=, <, <= , >, >= or when the subquery is used as an expression. (512) (SQLExecDirectW)')
```

Error 512 is the correct behaviour: when your intent is "assign a single scalar to a variable" and the source returns more than one row, you want to know immediately, not silently use the last one.

#### SELECT assignment — no-row silent bug

*`SELECT @v = col FROM t WHERE 1=0` leaves `@v` at its previous value.*

```sql
DECLARE @v varchar(20) = 'INITIAL';
SELECT @v = symbol FROM silver.eurostoxx50_ohlcv WHERE 1 = 0;
SELECT @v AS value_after_no_match;
```

| value_after_no_match |
|---|
| INITIAL |

The `WHERE 1 = 0` predicate matches zero rows. With `SELECT` assignment, `@v` stays at `'INITIAL'` — the value it was initialized to. This is catastrophic in a loop or a sequence of variable assignments: if the first pass finds a match and the second pass does not, `@v` silently carries the stale value from the first pass.

#### SET assignment — no-row yields NULL

*`SET @v = (SELECT ... WHERE 1=0)` correctly returns `NULL`.*

```sql
DECLARE @v varchar(20) = 'INITIAL';
SET @v = (SELECT symbol FROM silver.eurostoxx50_ohlcv WHERE 1 = 0);
SELECT @v AS value_after_no_match;
```

| value_after_no_match |
|---|
| NULL |

The scalar subquery returned no rows, so the expression evaluates to `NULL`, and `SET` assigns that `NULL` to `@v`. This is the semantically correct outcome — if the query returned no match, the variable should reflect the absence, not a stale prior value.

> [!failure] SELECT-assignment has two silent traps
>
> - **Multi-row source**: the last row processed wins, non-deterministically. No error, no warning.
> - **No-row source**: the variable keeps its previous value. No error, no warning.
> - Both bugs survive unit tests that use single-row fixtures.
> - Both bugs appear the day a production dataset contains more or fewer matching rows than expected.

> [!success] Use SET for single-value assignment
>
> - `SET @v = (SELECT col FROM t WHERE id = @id)` errors on multi-row and yields `NULL` on no-row.
> - The intent is clear to any reader: "I expect exactly one or zero rows; anything else is a bug".
> - Reserve `SELECT @v = col FROM t` for cases where you specifically want the behaviour "assign once per row in the result set", which is rare.

> [!info]- Error number 512 and the concatenation idiom
>
> When `SET @v = (SELECT ...)` encounters a multi-row result, the engine raises error **512** ("Subquery returned more than 1 value"). The one case where `SELECT @v = col FROM t` is genuinely correct is the legacy string-accumulation idiom: `SELECT @csv = @csv + ',' + name FROM tags` — a pattern that has been replaced by `STRING_AGG` in SQL Server 2017+.

## Control-of-Flow

> [!abstract] Procedural flow on top of a set-based language
>
> T-SQL includes the usual imperative building blocks: `IF`/`ELSE`, `BEGIN`/`END` blocks, `WHILE` loops with `BREAK` and `CONTINUE`, `WAITFOR` delays, and `GOTO` labels. These are rarely the right tool for data transformation — a set-based `CASE` expression or a window function will almost always outperform a loop — but they are the right tool for conditional logic inside procedures (validate inputs, branch on state) and for controlled batch processing (delete or rebuild in chunks to avoid long blocks).

### IF and BEGIN/END

*Conditional branching inside a batch or procedure.*

#### Simple branch

*A plain `IF` / `ELSE` over a variable's value.*

```sql
DECLARE @count int;
SELECT @count = COUNT(*) FROM silver.eurostoxx50_ohlcv;
IF @count > 0
    SELECT 'has data' AS branch, @count AS row_count;
ELSE
    SELECT 'empty' AS branch, @count AS row_count;
```

| branch | row_count |
|---|---|
| has data | 67155 |

> [!info]- IF/ELSE anatomy
>
> - `IF <boolean>` — executes the following single statement when true.
> - `ELSE` — executes the following single statement when false; optional.
> - For more than one statement in either branch, wrap the statements in `BEGIN ... END`.
> - There is no `ELSEIF` / `ELIF` keyword; chain `ELSE IF ...` with nested blocks or (better) restructure as a `CASE` expression or a lookup table.

### WHILE loops

*Repeat a block of statements while a condition is true.*

#### Batched deletion

*The one place `WHILE` is legitimately better than a set-based operation — splitting a huge `DELETE` into controlled batches to avoid long locks or log growth.*

```sql
IF OBJECT_ID('tempdb..#sandbox') IS NOT NULL DROP TABLE #sandbox;
CREATE TABLE #sandbox (id int IDENTITY(1,1), payload varchar(10));
INSERT INTO #sandbox (payload)
SELECT TOP (100) 'row' FROM sys.all_objects;

DECLARE @batches int = 0;
WHILE EXISTS (SELECT 1 FROM #sandbox)
BEGIN
    DELETE TOP (25) FROM #sandbox;
    SET @batches = @batches + 1;
END;

SELECT @batches AS batches_run, COUNT(*) AS rows_left FROM #sandbox;
DROP TABLE #sandbox;
```

| batches_run | rows_left |
|---|---|
| 4 | 0 |

100 rows divided into batches of 25 → four iterations. The loop exits when the `EXISTS` check returns false. In production, the batch size would be tuned to the table's row length and the target lock-duration window, and the loop body would typically `COMMIT` between iterations so log truncation can proceed.

> [!tip] When a WHILE loop is actually justified
>
> - **Batched cleanup**: `DELETE TOP (N)` in a loop to avoid multi-minute table locks on huge tables.
> - **Batched index maintenance**: rebuild partitions one at a time.
> - **Polling an external signal**: `WHILE NOT EXISTS (SELECT ... FROM queue)` — usually better expressed as Service Broker or an outside scheduler.
> - **Administrative scripts**: one-off migrations, data fixups.
>
> For almost any transformation inside a reporting query, a `WHILE` loop is the wrong answer — a `CASE` expression, window function, or CTE will be faster and clearer.

### WAITFOR

*Pause execution for a specified duration or until a specified wall-clock time.*

#### WAITFOR DELAY

*Sleep for one second, then report elapsed milliseconds.*

```sql
DECLARE @start datetime2 = SYSDATETIME();
WAITFOR DELAY '00:00:01';
SELECT DATEDIFF(MILLISECOND, @start, SYSDATETIME()) AS elapsed_ms;
```

| elapsed_ms |
|---|
| 1017 |

`WAITFOR DELAY` takes a `time` literal as an interval — one second here. The measured elapsed is slightly above 1000 ms due to scheduler granularity. `WAITFOR TIME '03:00:00'` is the alternate form — block until the server wall clock hits that time.

> [!warning] WAITFOR holds the session
>
> - The calling session is blocked for the entire duration.
> - Worker thread remains allocated.
> - Connection pool in the client keeps the connection checked out.
> - Use sparingly, never inside high-frequency code paths, and never with durations longer than seconds.

> [!failure] IF without BEGIN/END controls only one statement
>
> `IF @a > 0 SELECT 'a'; SELECT 'b';` executes the second `SELECT` unconditionally — `IF` binds only to the immediately following single statement. The fix is `IF @a > 0 BEGIN SELECT 'a'; SELECT 'b'; END;`. For the same reason, `GOTO` has no place in modern T-SQL: `TRY...CATCH` replaces `GOTO error_handler`, and `IF/ELSE` with `BEGIN/END` replaces every other pattern `GOTO` was used for.

## Stored Procedures

> [!abstract] Named, parameterized, plan-cached units of T-SQL
>
> A stored procedure is a named block of T-SQL stored in the database and invoked by name with `EXEC`. It has a stable signature (parameters, default values, OUTPUT parameters, RETURN code), is cached in the plan cache so repeated invocations reuse the same execution plan, and is the natural unit for exposing write operations as an API with explicit contracts. Stored procedures also enforce the principle of least privilege: a user can be granted `EXECUTE` on a procedure without any access to the underlying tables.

### CREATE or ALTER PROCEDURE

*Define or redefine a procedure in a single statement.*

#### Basic procedure with OUTPUT parameter

*A procedure that looks up the latest close for a given symbol and returns it in an `OUTPUT` parameter with a `RETURN` code.*

```sql
CREATE PROCEDURE dbo.usp_get_latest_close
    @symbol varchar(20),
    @latest_close decimal(18,4) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP (1) @latest_close = [close]
    FROM silver.eurostoxx50_ohlcv
    WHERE symbol = @symbol
    ORDER BY [date] DESC;
    RETURN 0;
END;
```

Calling it:

```sql
DECLARE @close decimal(18,4);
DECLARE @rc int;
EXEC @rc = dbo.usp_get_latest_close @symbol = 'ASML.AS', @latest_close = @close OUTPUT;
SELECT @rc AS return_code, @close AS latest_close;
```

| return_code | latest_close |
|---|---|
| 0 | 1113.8000 |

> [!info]- Procedure signature anatomy
>
> - `CREATE PROCEDURE <schema>.<name>` — schema-qualify the procedure name; `dbo` is the default schema.
> - `CREATE OR ALTER PROCEDURE` (SQL 2016+) creates or replaces in one statement — prefer it over `IF EXISTS DROP ... CREATE ...`.
> - Parameters have `@name type` syntax; add `= default` for an optional parameter; add `OUTPUT` to return a value to the caller.
> - `AS BEGIN ... END` wraps the body; the `BEGIN`/`END` are optional but make multi-statement bodies easier to read.
> - `RETURN <int>` exits the procedure with a status code; `0` conventionally means success.

### Parameter defaults and named arguments

*Optional parameters with defaults let callers omit values they do not care about.*

#### Procedure with default parameters

*"Top N symbols by close on a given date" — both parameters have defaults so the simplest invocation is `EXEC dbo.usp_top_symbols;`.*

```sql
CREATE PROCEDURE dbo.usp_top_symbols
    @top_n int = 3,
    @asof date = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF @asof IS NULL
        SELECT @asof = MAX([date]) FROM silver.eurostoxx50_ohlcv;
    SELECT TOP (@top_n) symbol, [close]
    FROM silver.eurostoxx50_ohlcv
    WHERE [date] = @asof
    ORDER BY [close] DESC;
END;
```

#### Call with defaulted arguments

*Both parameters default — the procedure uses `@top_n = 3` and the table's max date.*

```sql
EXEC dbo.usp_top_symbols;
```

| symbol | close |
|---|---|
| RMS.PA | 1648.5 |
| RHM.DE | 1531.0 |
| ASML.AS | 1113.8 |

#### Call with named arguments

*Override both defaults using named argument syntax.*

```sql
EXEC dbo.usp_top_symbols @top_n = 4, @asof = '2026-04-07';
```

| symbol | close |
|---|---|
| RMS.PA | 1648.5 |
| RHM.DE | 1531.0 |
| ASML.AS | 1113.8 |
| ADYEN.AS | 844.2 |

> [!tip] Prefer named arguments
>
> - `EXEC proc @a = 1, @b = 2` is self-documenting.
> - `EXEC proc 1, 2` is compact but breaks when the signature changes (e.g., a new parameter inserted in the middle).
> - Named form is resilient to reordering and defaults.
> - Use named form in every stored-procedure call — the tiny verbosity cost pays for itself the first time a signature evolves.

### SET NOCOUNT ON

*Suppress the "N rows affected" message that every statement emits by default.*

#### Why every production procedure starts with NOCOUNT ON

*The first line of every production stored procedure should be `SET NOCOUNT ON;`.*

SQL Server sends a `DONE_IN_PROC` TDS message after every statement inside a procedure by default, containing the row count. This generates network traffic, adds latency, and confuses some client libraries that count result sets or rows. `SET NOCOUNT ON` suppresses these messages for the duration of the procedure call.

> [!success] SET NOCOUNT ON is always the first statement
>
> - Reduces network chatter between the server and the client.
> - Prevents certain ORM clients from mistaking `DONE_IN_PROC` messages for additional result sets.
> - Has no observable effect on `@@ROWCOUNT` inside the procedure — that variable still updates normally.
> - Put it immediately after `AS BEGIN` in every new procedure.

## Dynamic SQL

> [!abstract] Queries assembled at runtime
>
> Dynamic SQL is any query built as a string at runtime and executed later. It is necessary when the query shape itself depends on user input — for example, when the caller chooses the table, the column list, or the sort order at call time. T-SQL offers two execution mechanisms: `EXEC(@sql)` which takes a plain string, and `sys.sp_executesql` which takes a parameterized string plus a parameter declaration list. The first is dangerous — it offers no injection protection and pollutes the plan cache with one plan per distinct string. The second is safe, performant, and the only form that should appear in new code.

### EXEC(@sql) — the legacy shape

*Execute a query stored in an `nvarchar` variable — simple, dangerous, obsolete.*

#### Basic EXEC

*Execute a hardcoded string; works fine for operational scripts that do not accept user input.*

```sql
DECLARE @sql nvarchar(max) = N'SELECT TOP (2) symbol, [close] FROM silver.eurostoxx50_ohlcv WHERE [date] = ''2026-04-07'' ORDER BY symbol;';
EXEC (@sql);
```

| symbol | close |
|---|---|
| ABI.BR | 61.62 |
| AD.AS | 41.69 |

This works but has no mechanism for parameters — every runtime value must be embedded directly into the string, doubling single quotes, and the assembled string becomes a unique plan cache entry every time a different value is substituted.

### The SQL injection trap

*Concatenating user input into a dynamic SQL string is the single most common cause of production SQL injection vulnerabilities.*

#### Attacker input escapes the predicate

*Watch what happens when a user-supplied string contains the closing quote and a comment marker.*

```sql
DECLARE @user_input varchar(100) = 'ASML.AS'' OR 1=1 --';
DECLARE @sql nvarchar(max);
SET @sql = N'SELECT TOP (3) symbol, [close] FROM silver.eurostoxx50_ohlcv WHERE symbol = ''' + @user_input + N''' AND [date] = ''2026-04-07'' ORDER BY symbol;';
SELECT @sql AS assembled_sql;
EXEC (@sql);
```

| assembled_sql |
|---|
| SELECT TOP (3) symbol, [close] FROM silver.eurostoxx50_ohlcv WHERE symbol = 'ASML.AS' OR 1=1 --' AND [date] = '2026-04-07' ORDER BY symbol; |

Read the assembled SQL carefully: the attacker's `'` closes the intended `symbol` literal, `OR 1=1` turns the predicate into a tautology, and `--` comments out the rest of the query including the `[date]` filter. The procedure was supposed to return prices for a single symbol on one day; it now returns **every row** in the table (truncated to the `TOP (3)` the query imposed). A real attack could use `; DROP TABLE` or `; SELECT * FROM sys.tables` or worse.

> [!danger] Never concatenate user input into dynamic SQL
>
> The classic anti-pattern is:
>
> - Code takes a user-supplied value.
> - Builds `'... WHERE col = ''' + @user_value + ''''` by string concatenation.
> - Hands the string to `EXEC(@sql)`.
>
> An attacker can close the literal, inject arbitrary SQL, and run it with the calling principal's full privileges. This is not a theoretical concern — SQL injection remains in the OWASP Top 10 every year, and the root cause is almost always a database procedure that does exactly what the snippet above does.

### sp_executesql — the safe shape

*`sys.sp_executesql` takes a parameterized query plus a declaration string for the parameters, and substitutes values at execution time — the same way a compiled stored procedure handles its parameters.*

#### Parameterized execution

*Rewrite the same query with `sp_executesql` and named parameters.*

```sql
DECLARE @sql nvarchar(max) = N'SELECT TOP (3) symbol, [close] FROM silver.eurostoxx50_ohlcv WHERE symbol = @symbol AND [date] = @asof ORDER BY symbol;';
EXEC sys.sp_executesql
     @sql,
     N'@symbol varchar(20), @asof date',
     @symbol = 'ASML.AS', @asof = '2026-04-07';
```

| symbol | close |
|---|---|
| ASML.AS | 1113.8 |

> [!info]- sp_executesql anatomy
>
> - **First argument** — the parameterized SQL text as an `nvarchar`; parameters are named with `@` prefixes.
> - **Second argument** — a declaration list, in the same form used in a procedure signature: `N'@p1 type1, @p2 type2 OUTPUT, ...'`.
> - **Remaining arguments** — the parameter values, bound by name: `@p1 = value`, `@p2 = @outvar OUTPUT`.
> - The parameterized string is compiled into a plan that is cached and reused across different parameter values — exactly like a stored procedure.

#### Injection-proof by construction

*The same attacker input passed as a parameter value cannot escape the query shape.*

```sql
DECLARE @user_input varchar(100) = 'ASML.AS'' OR 1=1 --';
DECLARE @sql nvarchar(max) = N'SELECT TOP (3) symbol, [close] FROM silver.eurostoxx50_ohlcv WHERE symbol = @symbol AND [date] = @asof ORDER BY symbol;';
EXEC sys.sp_executesql
     @sql,
     N'@symbol varchar(100), @asof date',
     @symbol = @user_input, @asof = '2026-04-07';
```

```text
(0 rows)
```

The attacker's full string is passed as the literal value of `@symbol` — and there is no symbol in the table named `ASML.AS' OR 1=1 --`, so the predicate matches zero rows. The query shape is immutable; the attacker can only vary the value, never the structure.

> [!success] sp_executesql is the only dynamic-SQL execution primitive you should use
>
> - **Injection-proof**: parameter values cannot escape their placeholder position.
> - **Plan-cache friendly**: the same parameterized text compiles to one plan, reused across value permutations.
> - **Readable**: parameter names show up in the query text, matching the signature declaration.
> - **Supports OUTPUT parameters**: the calling code can receive scalars back from the dynamic SQL.

### OUTPUT parameters from dynamic SQL

*Dynamic SQL can set an `OUTPUT` parameter in the caller just like a stored procedure does.*

#### Capture a count from dynamic SQL

*The dynamic query assigns the count to an `OUTPUT` parameter, which the caller reads after the call.*

```sql
DECLARE @sql nvarchar(max) = N'SELECT @cnt = COUNT(*) FROM silver.eurostoxx50_ohlcv WHERE symbol = @symbol;';
DECLARE @cnt int;
EXEC sys.sp_executesql
     @sql,
     N'@symbol varchar(20), @cnt int OUTPUT',
     @symbol = 'ASML.AS', @cnt = @cnt OUTPUT;
SELECT @cnt AS row_count_for_asml;
```

| row_count_for_asml |
|---|
| 1347 |

This is the only way to get a scalar result out of dynamic SQL back into the outer batch — the dynamic query's local variables are not visible to the caller, but an `OUTPUT` parameter crosses the boundary cleanly.

### Dynamic identifiers with QUOTENAME

*Object names (schema, table, column) cannot be parameterized — they must be part of the query text. Build them dynamically with `QUOTENAME` to prevent injection.*

#### Safe identifier assembly

*Dynamically target any schema-qualified table by name, with `QUOTENAME` on every identifier.*

```sql
DECLARE @schema sysname = N'silver';
DECLARE @table sysname = N'eurostoxx50_ohlcv';
DECLARE @sql nvarchar(max) =
    N'SELECT TOP (3) symbol, [close] FROM '
    + QUOTENAME(@schema) + N'.' + QUOTENAME(@table)
    + N' WHERE [date] = @asof ORDER BY symbol;';
EXEC sys.sp_executesql @sql, N'@asof date', @asof = '2026-04-07';
```

| symbol | close |
|---|---|
| ABI.BR | 61.62 |
| AD.AS | 41.69 |
| ADS.DE | 130.85 |

`QUOTENAME('silver')` returns `[silver]`, `QUOTENAME('eurostoxx50_ohlcv')` returns `[eurostoxx50_ohlcv]`. Any attempt to inject a closing bracket or a semicolon into the identifier gets re-escaped inside the square brackets and becomes part of the identifier, not a separate statement.

#### Belt-and-suspenders: validate against sys.tables

*Even with `QUOTENAME`, the safest pattern is to reject any identifier that does not exist in `sys.tables`.*

```sql
DECLARE @schema sysname = N'silver';
DECLARE @table  sysname = N'eurostoxx50_ohlcv';
SELECT
    CASE WHEN EXISTS (
        SELECT 1 FROM sys.tables t
        JOIN sys.schemas s ON s.schema_id = t.schema_id
        WHERE s.name = @schema AND t.name = @table
    ) THEN 'approved' ELSE 'rejected' END AS validation;
```

| validation |
|---|
| approved |

If the validation returns `rejected`, raise an error and do not execute the dynamic SQL at all. This closes the narrow remaining window where an attacker with partial control of a valid identifier could reach a table they should not see.

> [!info]- Returning values from dynamic SQL
>
> To return a scalar value from a dynamic SQL string back to the outer batch, declare an `OUTPUT` parameter in the `sp_executesql` parameter declaration list and pass the outer variable as that parameter with the `OUTPUT` keyword. `QUOTENAME('foo]bar')` returns `[foo]]bar]` — the inner `]` is doubled to escape itself inside the brackets, which prevents `foo]; DROP TABLE x; --` from becoming a statement separator.

## TRY/CATCH and Error Information

> [!abstract] Structured error handling
>
> `TRY...CATCH` is the modern T-SQL error-handling primitive: a block that catches most runtime errors and lets you inspect them via seven `ERROR_*` functions, decide what to do, and either re-raise or swallow. It replaces the pre-2005 pattern of checking `@@ERROR` after every statement. It does not catch **every** error — compile errors, severity-10-and-below informational messages, and severity-20+ connection-terminating errors all bypass it — but it catches the overwhelming majority of errors production code needs to handle.

### Basic TRY/CATCH

*A `TRY` block followed by a `CATCH` block — runtime errors inside `TRY` jump to `CATCH`.*

#### Divide-by-zero caught with full error info

*Inside the `CATCH`, all seven `ERROR_*` functions return information about the caught error.*

```sql
BEGIN TRY
    DECLARE @x int = 1 / 0;
END TRY
BEGIN CATCH
    SELECT
        ERROR_NUMBER()   AS err_num,
        ERROR_SEVERITY() AS sev,
        ERROR_STATE()    AS st,
        ERROR_LINE()     AS ln,
        ERROR_PROCEDURE() AS proc_name,
        ERROR_MESSAGE()  AS msg;
END CATCH;
```

| err_num | sev | st | ln | proc_name | msg |
|---|---|---|---|---|---|
| 8134 | 16 | 1 | 3 | NULL | Divide by zero error encountered. |

> [!info]- The seven ERROR_* functions
>
> - `ERROR_NUMBER()` — the server error number (`int`).
> - `ERROR_SEVERITY()` — the severity level (0–25).
> - `ERROR_STATE()` — the state number, distinguishes different occurrences of the same error.
> - `ERROR_LINE()` — the line number in the batch or procedure where the error occurred.
> - `ERROR_PROCEDURE()` — the fully-qualified procedure name, or `NULL` for an ad-hoc batch.
> - `ERROR_MESSAGE()` — the error message text with substitution arguments interpolated.
> - `XACT_STATE()` — strictly speaking not an `ERROR_*` function, but indispensable inside `CATCH` (covered in the Transactions section below).

### What TRY/CATCH catches and what it does not

*Severity 10 informational messages do not trigger the `CATCH` block.*

#### Severity 10 falls through

*`RAISERROR` with severity 10 is an informational print, not an error — `TRY/CATCH` ignores it.*

```sql
BEGIN TRY
    RAISERROR('informational only', 10, 1) WITH NOWAIT;
    SELECT 'TRY body continued' AS status;
END TRY
BEGIN CATCH
    SELECT 'caught' AS status;
END CATCH;
```

| status |
|---|
| TRY body continued |

The `TRY` body ran to completion — the `RAISERROR` with severity 10 emitted an informational message but did not cause an error, so the `SELECT` executed normally and the `CATCH` block was never entered.

> [!warning] TRY/CATCH is not universal
>
> Errors that **bypass** a `TRY/CATCH`:
>
> - **Compile errors** inside the batch — the batch never starts running, so neither `TRY` nor `CATCH` executes.
> - **Severity 0–10** — informational messages, not errors.
> - **Severity 20–25** — connection-terminating errors (hardware failure, attention processing); the client connection dies and the `CATCH` never runs.
> - **Errors in a separate batch** — a `GO`-separated batch that errors does not propagate to a `TRY` in a different batch.
> - **Attention events** (client-side cancel) — SQL Server stops the current statement immediately, outside of `TRY/CATCH` semantics.

### @@ROWCOUNT and legacy @@ERROR

*Pre-2005 code checked `@@ERROR` after every statement; `@@ROWCOUNT` is still useful for detecting "how many rows did that write affect?".*

#### @@ROWCOUNT after UPDATE

*`@@ROWCOUNT` returns the row count of the most recent statement.*

```sql
IF OBJECT_ID('tempdb..#t') IS NOT NULL DROP TABLE #t;
CREATE TABLE #t (n int);
INSERT INTO #t VALUES (1),(2),(3),(4),(5);
UPDATE #t SET n = n * 10 WHERE n > 2;
SELECT @@ROWCOUNT AS rows_affected;
DROP TABLE #t;
```

| rows_affected |
|---|
| 3 |

> [!tip] @@ROWCOUNT is a fragile variable — capture it immediately
>
> - `@@ROWCOUNT` is reset by every subsequent statement, including `IF` checks and variable assignments.
> - Capture it into a local variable on the next line if you need to reference it later: `DECLARE @affected int = @@ROWCOUNT;`.
> - Avoid `IF @@ROWCOUNT = 0 ...` directly — the `IF` itself resets `@@ROWCOUNT` on the branch.

> [!info]- Four categories bypass TRY/CATCH
>
> `TRY...CATCH` does not catch: compile errors, severity 0–10 informational messages, severity 20–25 connection-terminating errors, and errors raised in a separate batch. Every `ERROR_*` function returns `NULL` when called outside a `CATCH` block.

## THROW and RAISERROR

> [!abstract] Raising errors from T-SQL
>
> `THROW` (SQL 2012+) and `RAISERROR` (all versions) are the two statements that raise errors from T-SQL code. `THROW` is simpler, cleaner, and the recommended default for new code — a bare `THROW;` inside a `CATCH` block re-raises the current error with its original number and severity, and `THROW number, message, state;` raises a custom error with a user-defined number ≥ 50000. `RAISERROR` remains common in legacy code for its format-string substitution (`%s`, `%d`) and options like `WITH NOWAIT` and `WITH LOG`.

### THROW — re-raising errors

*A bare `THROW` inside a `CATCH` re-raises the caught error with its original metadata intact.*

#### Bare THROW in CATCH

*Catch the error, inspect it if needed, then re-raise to let the caller handle it.*

```sql
BEGIN TRY
    DECLARE @x int = 1 / 0;
END TRY
BEGIN CATCH
    THROW;
END CATCH;
```

```text
('22012', '[22012] [Microsoft][ODBC Driver 18 for SQL Server][SQL Server]Divide by zero error encountered. (8134) (SQLExecDirectW)')
```

The caller sees the original error 8134 ("Divide by zero error encountered") unchanged. This is the idiomatic shape when a procedure catches an error only to roll back a transaction and then wants the caller to see the real failure.

### THROW — raising custom errors

*Custom errors use numbers 50000 and above.*

#### Custom error with number, message, and state

*The three arguments to `THROW` are error number, message, and state.*

```sql
THROW 60000, 'No price history found for supplied symbol.', 1;
```

```text
('42000', '[42000] [Microsoft][ODBC Driver 18 for SQL Server][SQL Server]No price history found for supplied symbol. (60000) (SQLExecDirectW)')
```

> [!info]- THROW anatomy
>
> - `THROW number, message, state` — number is ≥ 50000; message is a literal (no `printf`-style substitution); state is 1–255.
> - `THROW;` (no arguments, inside `CATCH`) — re-raises the current error.
> - The statement **before** `THROW` must be terminated with a semicolon — error 102 is "incorrect syntax near 'THROW'" when you forget.
> - `THROW` always has severity 16; you cannot raise a custom severity.

### RAISERROR — legacy with format substitution

*`RAISERROR` accepts a `printf`-style format string with `%s` / `%d` substitutions and a severity argument.*

#### RAISERROR with format arguments

*Embed a symbol name and row count into an error message via format specifiers.*

```sql
DECLARE @sym varchar(20) = 'XYZ.TEST';
DECLARE @cnt int = 0;
RAISERROR('Symbol %s returned %d rows.', 16, 1, @sym, @cnt);
```

```text
('42000', '[42000] [Microsoft][ODBC Driver 18 for SQL Server][SQL Server]Symbol XYZ.TEST returned 0 rows. (50000) (SQLExecDirectW)')
```

The format string is `'Symbol %s returned %d rows.'` with two substitution arguments `@sym` and `@cnt`. The final arguments after `severity, state` are the substitution values in order.

> [!warning] RAISERROR severity rules are confusing
>
> - Severity 0–10: informational, does **not** trigger `CATCH`.
> - Severity 11–16: user-raiseable error severities.
> - Severity 17–25: reserved for system errors; raising severities 19–25 requires `sysadmin` permission and `WITH LOG`.
> - Raising severity 20+ from ad-hoc code is almost always the wrong choice — it terminates the connection, bypasses `TRY/CATCH` on the client side, and is visible in the Windows event log.

> [!success] Prefer THROW for new code
>
> - **Simpler**: one statement, no severity juggling.
> - **Re-raise**: bare `THROW;` in a `CATCH` block preserves original error number, message, line, and procedure.
> - **Transparent**: `THROW` is atomic — it cannot be "caught and swallowed" by another layer without the caller noticing.
> - Use `RAISERROR` only when you need format-string substitution or `WITH LOG` / `WITH NOWAIT` options — wrap the format call in a string variable and `THROW` the result when possible.

## Transactions

> [!abstract] Atomicity, nesting, and XACT semantics
>
> A transaction is a unit of work that either fully commits or fully rolls back. T-SQL transactions are started with `BEGIN TRAN`, ended with `COMMIT` or `ROLLBACK`, and tracked by the session-level variable `@@TRANCOUNT`. SQL Server supports **nested** transactions in syntax but not in behaviour: nested `BEGIN TRAN` only increments `@@TRANCOUNT`, nested `COMMIT` only decrements it, and a single `ROLLBACK` undoes the outermost transaction regardless of how deep it was nested. Understanding `@@TRANCOUNT`, `XACT_STATE`, `SAVE TRAN`, and `SET XACT_ABORT ON` is mandatory before writing any procedure that performs a multi-step write.

### @@TRANCOUNT and nesting reality

*Every `BEGIN TRAN` increments `@@TRANCOUNT`; every `COMMIT` decrements it; only when the counter reaches zero is the work actually committed.*

#### Nesting increments and decrements the counter

*Observe `@@TRANCOUNT` at every point of a nested BEGIN/COMMIT sequence.*

```sql
DECLARE @tc0 int = @@TRANCOUNT;
BEGIN TRAN;
DECLARE @tc1 int = @@TRANCOUNT;
BEGIN TRAN;
DECLARE @tc2 int = @@TRANCOUNT;
COMMIT;
DECLARE @tc3 int = @@TRANCOUNT;
COMMIT;
DECLARE @tc4 int = @@TRANCOUNT;
SELECT
    @tc0 AS before,
    @tc1 AS after_outer_begin,
    @tc2 AS after_inner_begin,
    @tc3 AS after_inner_commit,
    @tc4 AS after_outer_commit;
```

| before | after_outer_begin | after_inner_begin | after_inner_commit | after_outer_commit |
|---|---|---|---|---|
| 0 | 1 | 2 | 1 | 0 |

The sequence `0 → 1 → 2 → 1 → 0` is the complete story: two `BEGIN TRAN`s push the counter to 2, the inner `COMMIT` decrements it to 1 (**the inner COMMIT does not commit anything**), and the outer `COMMIT` decrements it to 0 — at which point the engine actually commits the whole work atomically.

#### A single ROLLBACK discards everything

*`ROLLBACK` with no savepoint name resets `@@TRANCOUNT` to 0, regardless of depth.*

```sql
DECLARE @tc0 int = @@TRANCOUNT;
BEGIN TRAN;
BEGIN TRAN;
BEGIN TRAN;
DECLARE @tc_deep int = @@TRANCOUNT;
ROLLBACK;
DECLARE @tc_after int = @@TRANCOUNT;
SELECT
    @tc0       AS before,
    @tc_deep   AS at_depth_3,
    @tc_after  AS after_single_rollback;
```

| before | at_depth_3 | after_single_rollback |
|---|---|---|
| 0 | 3 | 0 |

Three `BEGIN TRAN`s bring `@@TRANCOUNT` to 3, but a single `ROLLBACK` drops it straight to 0. Everything done inside any of the three nested blocks is undone. **There is no such thing as "rolling back the innermost nested transaction" with an unqualified `ROLLBACK`** — use `SAVE TRAN` + `ROLLBACK TRAN savepoint_name` for that (shown below).

> [!failure] Nested BEGIN TRAN is a lie
>
> Reading "nested transactions" literally leads to wrong assumptions:
>
> - The inner `BEGIN TRAN` does not create a new independent transaction.
> - The inner `COMMIT` does not commit the inner work.
> - The inner `ROLLBACK` would undo **the entire outer transaction**, not just the inner changes.
> - The only real transaction is the outermost one; nested syntax is a compatibility feature.

### SAVE TRAN — partial rollback

*`SAVE TRAN name` creates a savepoint inside the current transaction; `ROLLBACK TRAN name` rolls back only the work done after that savepoint, leaving the transaction itself open.*

#### Partial rollback within a transaction

*Insert row 1, save a point, insert rows 2 and 3, roll back to the savepoint, insert row 4, commit.*

```sql
IF OBJECT_ID('tempdb..#t') IS NOT NULL DROP TABLE #t;
CREATE TABLE #t (n int);
BEGIN TRAN;
    INSERT INTO #t VALUES (1);
    SAVE TRAN sp1;
    INSERT INTO #t VALUES (2);
    INSERT INTO #t VALUES (3);
    ROLLBACK TRAN sp1;
    INSERT INTO #t VALUES (4);
COMMIT;
SELECT n FROM #t ORDER BY n;
DROP TABLE #t;
```

| n |
|---|
| 1 |
| 4 |

Row 1 was inserted before the savepoint and survives. Rows 2 and 3 were inserted after the savepoint and are rolled back when we `ROLLBACK TRAN sp1`. Row 4 is inserted after the rollback, still inside the outer transaction, and is committed along with row 1.

> [!info]- SAVE TRAN mechanics
>
> - `SAVE TRAN name` creates a named savepoint inside the current transaction.
> - `ROLLBACK TRAN name` rolls back only the work since the named savepoint — the transaction remains open.
> - Savepoints **do not** change `@@TRANCOUNT` (neither `SAVE TRAN` nor `ROLLBACK TRAN name` affect it).
> - Savepoints are cheap and ideal for "try step B; if it fails, skip to step C" within a single transaction.

### XACT_STATE — committable, none, or doomed

*`XACT_STATE()` returns `1` (active and committable), `0` (no transaction), or `-1` (active but uncommittable / "doomed"). The `-1` case is the important one: certain errors mark a transaction as doomed, meaning the only legal next action is `ROLLBACK`.*

#### XACT_STATE inside CATCH after a recoverable error

*A divide-by-zero error inside a transaction leaves the transaction committable — `XACT_STATE()` returns 1.*

```sql
BEGIN TRY
    BEGIN TRAN;
    DECLARE @x int = 1 / 0;
    COMMIT;
END TRY
BEGIN CATCH
    SELECT XACT_STATE() AS xact_state_in_catch, @@TRANCOUNT AS tc;
    IF @@TRANCOUNT > 0 ROLLBACK;
END CATCH;
```

| xact_state_in_catch | tc |
|---|---|
| 1 | 1 |

`XACT_STATE() = 1` means the transaction is still active and could be committed or rolled back. The defensive `IF @@TRANCOUNT > 0 ROLLBACK` guard cleans up before exiting the `CATCH` block.

### XACT_ABORT — the production default

*`SET XACT_ABORT ON` changes most runtime errors from "statement-level failures" (only the failing statement is rolled back) into "batch-level failures" (the entire transaction is rolled back and the batch is aborted).*

#### XACT_ABORT ON auto-rolls on constraint violation

*With `XACT_ABORT ON`, a `CHECK` constraint violation automatically rolls back the transaction; `XACT_STATE()` inside `CATCH` returns `-1` (doomed).*

```sql
IF OBJECT_ID('tempdb..#t') IS NOT NULL DROP TABLE #t;
CREATE TABLE #t (n int NOT NULL CHECK (n > 0));
SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRAN;
    INSERT INTO #t VALUES (5);
    INSERT INTO #t VALUES (-1);
    COMMIT;
END TRY
BEGIN CATCH
    SELECT @@TRANCOUNT AS tc_after_err, XACT_STATE() AS xs;
END CATCH;
SELECT n FROM #t ORDER BY n;
DROP TABLE #t;
```

| tc_after_err | xs |
|---|---|
| 1 | -1 |

The second `INSERT` violated the `CHECK (n > 0)` constraint. With `XACT_ABORT ON`, the transaction became doomed (`XACT_STATE() = -1`) — `@@TRANCOUNT` is still 1 (there is still an active transaction), but the only legal action is `ROLLBACK`. The final `SELECT n FROM #t` returned zero rows because the constraint violation rolled back both inserts (including the `5` that would have succeeded).

> [!success] Set XACT_ABORT ON by default in write procedures
>
> - Without it, many errors leave the transaction in a half-committed state that is hard to reason about.
> - With it, **any** error inside a transaction dooms the transaction, ensuring that incomplete work cannot accidentally commit.
> - Pair with `BEGIN TRY ... END TRY BEGIN CATCH IF @@TRANCOUNT > 0 ROLLBACK; THROW; END CATCH` for predictable failure semantics.
> - Put it as the second line of every write procedure, right after `SET NOCOUNT ON`.

## Security Context and Ownership

> [!abstract] GRANT EXECUTE and ownership chaining
>
> Stored procedures are the primary mechanism for least-privilege access control in SQL Server. You grant `EXECUTE` on a procedure, and the caller can run it — without needing any direct access to the tables the procedure reads or writes. This works through **ownership chaining**: if the procedure and its referenced tables have the same owner (typically `dbo`), SQL Server checks permissions at the procedure level only, not again on each table. Dynamic SQL breaks ownership chaining because the runtime-assembled string is a new batch with its own permission context — so if you use dynamic SQL inside a procedure that reads restricted tables, you need either `EXECUTE AS` or explicit grants on the tables for the calling user.

### GRANT EXECUTE

*Grant a principal the right to execute a procedure without granting them access to the underlying tables.*

#### Least-privilege pattern

*Ownership chaining lets a low-privilege user invoke a procedure that reads or writes tables they cannot access directly.*

Conceptually, the pattern is:

```sql
-- Assume dbo owns both the table and the procedure:
-- GRANT EXECUTE ON dbo.usp_get_latest_close TO analyst;
-- -- no GRANT SELECT on silver.eurostoxx50_ohlcv to analyst
-- -- analyst can still EXEC the procedure successfully
```

Inside the procedure's body, when it does `SELECT ... FROM silver.eurostoxx50_ohlcv`, SQL Server sees that both the procedure and the table share the same owner (`dbo` → `silver` → `dbo`) and authorizes the read against the procedure's permission context, not the analyst's.

> [!info]- Ownership chaining rules
>
> - Both the procedure and its referenced object must share the same owner.
> - The chain is evaluated statically — the optimizer can see the direct table references at compile time.
> - Ownership chaining works across schemas as long as the owning principal is the same.
> - It is **broken** by dynamic SQL, cross-database references with different owners, and impersonation (`EXECUTE AS` other user).

### When dynamic SQL breaks chaining

*A dynamic query assembled from identifiers is a new batch evaluated in the caller's permission context.*

#### Workaround: EXECUTE AS

*Put `EXECUTE AS OWNER` in the procedure signature to run the procedure's body with the owner's permissions, re-establishing access to the referenced tables.*

```sql
-- Conceptual example:
-- CREATE PROCEDURE dbo.usp_dynamic_report
--     @schema sysname, @table sysname
-- WITH EXECUTE AS OWNER
-- AS
-- BEGIN
--     ...sp_executesql body that references @schema.@table dynamically...
-- END;
```

With `WITH EXECUTE AS OWNER`, the dynamic SQL runs under the procedure owner's (typically `dbo`'s) permission context, restoring access to the underlying tables even though ownership chaining no longer applies. This is the standard pattern for procedures that must use dynamic SQL to access restricted tables.

> [!warning] EXECUTE AS should be the last resort
>
> - Use it when you genuinely need dynamic SQL and the underlying tables are restricted.
> - Prefer static SQL with `IF` branching when the query shape is predictable.
> - Prefer explicit grants to a dedicated application role when the set of readable tables is small.
> - `EXECUTE AS OWNER` elevates every call to the owner's privilege — audit the procedure body carefully, because any new table reference inherits the elevation.

## Production Procedure Template

> [!abstract] The skeleton every write procedure should follow
>
> A production-grade write procedure combines everything in this note: `NOCOUNT` and `XACT_ABORT`, explicit parameter validation, a `TRY...CATCH` wrapping a `BEGIN TRAN / COMMIT`, a `CATCH` that rolls back if needed and re-raises with `THROW`. The template below is the shape every new write procedure in the codebase should follow — the ingredients are the safety guards, and the body is the domain-specific work you are writing.

### The template

*Create an event-log table, a procedure that writes to it with every guard in place, call it with both valid and invalid input, observe the success path and the failure path.*

#### Setup — event log table

*A simple `demo_event_log` table with an identity primary key and a default UTC timestamp.*

```sql
IF OBJECT_ID('dbo.demo_event_log', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.demo_event_log
    (
        id int IDENTITY(1,1) PRIMARY KEY,
        symbol varchar(20) NOT NULL,
        note nvarchar(200) NOT NULL,
        logged_at datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;
```

#### Procedure definition

*Every production guard in a single template.*

```sql
CREATE PROCEDURE dbo.usp_log_event
    @symbol varchar(20),
    @note   nvarchar(200)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @symbol IS NULL OR LEN(@symbol) = 0
        THROW 60001, '@symbol is required.', 1;

    BEGIN TRY
        BEGIN TRAN;

        INSERT INTO dbo.demo_event_log (symbol, note)
        VALUES (@symbol, @note);

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH;
END;
```

#### Success path

*Call with valid input; the row is inserted and the procedure returns cleanly.*

```sql
EXEC dbo.usp_log_event @symbol = 'ASML.AS', @note = N'proc template demo';
SELECT TOP (3) id, symbol, note, logged_at
FROM dbo.demo_event_log
ORDER BY id DESC;
```

| id | symbol | note | logged_at |
|---|---|---|---|
| 1 | ASML.AS | proc template demo | 2026-04-11 12:31:23.944 |

#### Failure path

*Call with a NULL symbol; the parameter validation throws custom error 60001.*

```sql
EXEC dbo.usp_log_event @symbol = NULL, @note = N'will fail';
```

```text
('42000', '[42000] [Microsoft][ODBC Driver 18 for SQL Server][SQL Server]@symbol is required. (60001) (SQLExecDirectW)')
```

The parameter validation fires before any transaction starts, so there is no rollback needed — the `THROW` exits the procedure cleanly and the caller sees the custom error.

> [!info]- Template element checklist
>
> - `SET NOCOUNT ON;` — suppress `DONE_IN_PROC` messages.
> - `SET XACT_ABORT ON;` — ensure any runtime error inside the transaction dooms it.
> - **Parameter validation first** — validate arguments before opening a transaction or doing any work; throw custom errors ≥ 50000 for bad input.
> - `BEGIN TRY ... END TRY` wrapping the real work — the transaction lives inside here.
> - `BEGIN TRAN; ...; COMMIT;` — explicit transaction so `@@TRANCOUNT` and `XACT_STATE` behave predictably.
> - `BEGIN CATCH IF @@TRANCOUNT > 0 ROLLBACK; THROW; END CATCH` — always the same shape: conditional rollback, then re-raise.
> - No `RAISERROR` for re-raising — a bare `THROW;` preserves the original error metadata.
> - No `RETURN <code>` for error reporting — the caller should see the real error, not a return code.

## Practical Guidance

> [!tip] Defaults for new code
>
> - **Variable assignment**: `SET @v = (SELECT ... WHERE pk = @id)` for single-scalar lookups; reserve `SELECT @v = col FROM t` for set-wise accumulation patterns.
> - **Procedures**: `CREATE OR ALTER`; `SET NOCOUNT ON`; `SET XACT_ABORT ON`; named arguments at every call site; OUTPUT parameters for scalars; result sets for tabular output.
> - **Return codes**: reserved for success/failure status, not diagnostics. Errors should `THROW`, not `RETURN -1`.
> - **Dynamic SQL**: `sys.sp_executesql` with named parameters, never `EXEC(@sql)` with concatenated values. `QUOTENAME` on every dynamic identifier. Validate against `sys.tables` / `sys.columns` when possible.
> - **Error handling**: `TRY/CATCH` as the default structured pattern; `THROW` for raising and re-raising; `RAISERROR` only for format-string substitution or `WITH LOG`.
> - **Transactions**: explicit `BEGIN TRAN / COMMIT / ROLLBACK` inside a `TRY/CATCH`; `SET XACT_ABORT ON`; `XACT_STATE()` guard inside `CATCH` when partial rollback is a possibility; `SAVE TRAN` for controlled partial rollbacks.
> - **Security**: grant `EXECUTE` on procedures, not `SELECT`/`INSERT`/`UPDATE`/`DELETE` on tables; use `EXECUTE AS OWNER` only when dynamic SQL requires it.

> [!warning] Production-grade checklist
>
> Before shipping any write procedure:
>
> - Is `SET NOCOUNT ON` the first line inside `BEGIN`?
> - Is `SET XACT_ABORT ON` the second?
> - Are all parameters validated before the transaction starts?
> - Does the write happen inside a `BEGIN TRY ... COMMIT` pair?
> - Does the `CATCH` block have `IF @@TRANCOUNT > 0 ROLLBACK; THROW;`?
> - Are any dynamic SQL calls using `sp_executesql` with parameters, not concatenation?
> - If dynamic SQL is used, are all identifiers passed through `QUOTENAME`?
> - If the procedure is granted to low-privilege users, does ownership chaining carry permissions all the way through, or does it need `WITH EXECUTE AS OWNER`?
