---
title: "18 - Stored Procedures, Dynamic SQL, and Error Handling"
tags: [sql, sql-server, tsql, stored-procedures, dynamic-sql, sp-executesql, try-catch, throw, transactions]
aliases: [procedure reference, sp_executesql, TRY CATCH, THROW, XACT_ABORT]
description: "T-SQL reference for variables, control-of-flow, stored procedures, parameters, dynamic SQL with sp_executesql, TRY...CATCH, THROW, transactions, SAVE TRAN, and XACT_ABORT."
created: 2026-04-08
updated: 2026-04-08
status: complete
---

# Stored Procedures, Dynamic SQL, and Error Handling

This note owns the procedural side of T-SQL:

- variables and control-of-flow
- stored procedures and parameters
- dynamic SQL
- transaction control
- error handling

## DECLARE, SET, SELECT Assignment, and Control-of-Flow

### DECLARE and assignment

```sql
DECLARE @symbol varchar(50) = 'ASML.AS';
DECLARE @latest_date date;

SELECT
    @latest_date = MAX([date])
FROM silver.eurostoxx50_ohlcv
WHERE symbol = @symbol;
```

Use variables for procedure parameters, branching logic, and dynamic SQL assembly. Do not replace set-based operations with row-by-row variable loops unless procedural behavior is truly required.

### IF, ELSE, WHILE, BREAK, and CONTINUE

```sql
IF @latest_date IS NULL
BEGIN
    THROW 50000, 'No price history found for symbol.', 1;
END;
```

Prefer set-based logic over loops whenever possible. `WHILE` is valid, but often a signal that the task may be better expressed with sets, windows, or temp tables.

## CREATE PROCEDURE, EXEC, Parameters, OUTPUT, and RETURN

### Stored procedure template

```sql
CREATE OR ALTER PROCEDURE dbo.usp_get_latest_close
    @symbol varchar(50),
    @latest_close decimal(18,4) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (1)
        @latest_close = [close]
    FROM silver.eurostoxx50_ohlcv
    WHERE symbol = @symbol
    ORDER BY [date] DESC;

    RETURN 0;
END;
GO
```

Use:

- input parameters for caller-supplied values
- `OUTPUT` parameters for one or a few returned scalars
- result sets for tabular output
- `RETURN` codes for compact success/failure conventions, not full diagnostics

## TRY...CATCH, THROW, and RAISERROR

### TRY...CATCH

```sql
BEGIN TRY
    BEGIN TRAN;

    UPDATE silver.index_dim
    SET is_current = 0
    WHERE index_code = 'SX5E';

    COMMIT;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK;

    THROW;
END CATCH;
```

Use `TRY...CATCH` around multi-step writes that must commit or fail as a unit.

### THROW

Prefer `THROW` for modern error handling.

- It preserves the original error cleanly when used as bare `THROW;` inside `CATCH`.
- It is simpler and more consistent than legacy `RAISERROR` for most new code.

### RAISERROR

Legacy code often uses `RAISERROR`. It still exists, but new code should usually prefer `THROW` unless specific legacy formatting behavior is required.

## BEGIN TRAN, COMMIT, ROLLBACK, SAVE TRAN, and XACT_ABORT

### Explicit transaction control

```sql
BEGIN TRAN before_refresh;

-- work

COMMIT TRAN before_refresh;
```

### SAVE TRAN

`SAVE TRAN` creates a savepoint inside a transaction.

```sql
BEGIN TRAN;
SAVE TRAN before_step_2;
```

Use savepoints when a large transaction needs a partial rollback boundary, but keep the overall flow readable.

### XACT_ABORT

`SET XACT_ABORT ON;` forces many runtime errors to terminate and roll back the transaction automatically.

Production rule:

- For data-modification procedures, `SET XACT_ABORT ON;` is usually the safer default.
- Pair it with `TRY...CATCH` and explicit transaction handling for predictable failure semantics.

## Dynamic SQL and sp_executesql

### sp_executesql

Use `sp_executesql` for parameterized dynamic SQL.

```sql
DECLARE @sql nvarchar(max) =
N'
SELECT symbol, [date], [close]
FROM silver.eurostoxx50_ohlcv
WHERE symbol = @symbol
  AND [date] >= @start_date;
';

EXEC sys.sp_executesql
    @sql,
    N'@symbol varchar(50), @start_date date',
    @symbol = 'ASML.AS',
    @start_date = '2025-01-01';
```

Why `sp_executesql` matters:

- parameterization
- plan reuse
- safer value injection than string concatenation

### Safe dynamic object names

Object names cannot be parameterized like values. When you must build them dynamically, use `QUOTENAME`.

```sql
DECLARE @schema_name sysname = N'silver';
DECLARE @table_name sysname = N'eurostoxx50_ohlcv';
DECLARE @sql nvarchar(max);

SET @sql =
    N'SELECT TOP (10) * FROM '
    + QUOTENAME(@schema_name) + N'.' + QUOTENAME(@table_name)
    + N' ORDER BY [date] DESC;';

EXEC sys.sp_executesql @sql;
```

Never concatenate unchecked user input into executable SQL.

## Robust Procedure Template

Use this pattern for write procedures:

1. `SET NOCOUNT ON;`
2. `SET XACT_ABORT ON;`
3. validate parameters early
4. `BEGIN TRY`
5. begin transaction only if the procedure owns the unit of work
6. perform the write set
7. commit
8. `BEGIN CATCH`
9. roll back if needed
10. `THROW;`

## Practical Guidance

- Prefer set-based SQL over procedural loops.
- Use stored procedures for stable write contracts, operational entry points, and reusable business operations.
- Use `sp_executesql`, not `EXEC(@sql)` with concatenated values.
- Use `QUOTENAME` for dynamic identifiers.
- Prefer `THROW` over `RAISERROR` in new code.
- For multi-step writes, pair explicit transactions with `TRY...CATCH` and usually `XACT_ABORT ON`.


