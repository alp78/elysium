---
title: "14 - System Functions and Session Metadata"
tags: [sql, sql-server, tsql, system-functions, metadata-functions, session-context, scope-identity, rowcount]
aliases: [system function reference, session metadata ROWCOUNT, SCOPE_IDENTITY]
description: "T-SQL reference for SQL Server system functions and metadata helpers such as @@ROWCOUNT, @@TRANCOUNT, @@SPID, SCOPE_IDENTITY, IDENT_CURRENT, DB_NAME, OBJECT_ID, SESSION_CONTEXT, APP_NAME, HOST_NAME, ORIGINAL_LOGIN, and related helpers."
parent: "[[domain-query-writing-and-optimization]]"
links:
  - "[[18-stored-procedures-dynamic-sql-and-error-handling]]"
  - "[[08-date-and-time-functions]]"
created: 2026-04-08
updated: 2026-04-08
status: complete
---

# System Functions and Session Metadata

These helpers are the glue around real T-SQL code:

- row counts
- identity retrieval
- session metadata
- object and database metadata
- transaction state

## @@ROWCOUNT, @@TRANCOUNT, and @@SPID

### @@ROWCOUNT

`@@ROWCOUNT` returns the number of rows affected by the previous statement.

```sql
UPDATE silver.index_dim
SET is_current = 0
WHERE index_code = 'SX5E';

SELECT @@ROWCOUNT AS rows_updated;
```

Read it immediately after the statement it describes.

### @@TRANCOUNT

`@@TRANCOUNT` shows the current nesting depth of explicit transactions.

```sql
BEGIN TRAN;
SELECT @@TRANCOUNT AS tran_depth;
ROLLBACK;
```

### @@SPID

`@@SPID` returns the current session ID.

Use it for debugging, session tagging, and live-request correlation.

## SCOPE_IDENTITY, @@IDENTITY, and IDENT_CURRENT

### SCOPE_IDENTITY

Use `SCOPE_IDENTITY()` after an insert into an identity table when you need the last identity generated in the current scope.

### @@IDENTITY

Avoid `@@IDENTITY` in production logic because trigger activity can change what it returns.

### IDENT_CURRENT

`IDENT_CURRENT('table')` returns the last identity value generated for a table across sessions. It is metadata, not a safe per-session key retrieval method.

Practical rule:

- prefer `OUTPUT inserted.id`
- otherwise use `SCOPE_IDENTITY()`
- avoid `@@IDENTITY` for application logic

## DB_NAME, OBJECT_ID, COL_NAME, and metadata helpers

### DB_NAME and OBJECT_ID

```sql
SELECT
    DB_NAME() AS current_database,
    OBJECT_ID(N'silver.eurostoxx50_ohlcv') AS object_id_value;
```

These are common in dynamic SQL, metadata checks, and DMV filters.

### COLUMNPROPERTY and TYPE_NAME

These are useful when introspecting schema or building reusable deployment scripts.

## SESSION_CONTEXT, CONTEXT_INFO, APP_NAME, HOST_NAME, ORIGINAL_LOGIN, and SUSER_SNAME

### SESSION_CONTEXT

`SESSION_CONTEXT` stores and retrieves lightweight key/value metadata for the current session.

```sql
EXEC sys.sp_set_session_context @key = N'pipeline_run_id', @value = N'20260408T221500Z';

SELECT SESSION_CONTEXT(N'pipeline_run_id') AS pipeline_run_id;
```

This is the cleanest built-in option for tagging a session with application or pipeline context.

### APP_NAME, HOST_NAME, ORIGINAL_LOGIN, and SUSER_SNAME

These expose connection and security identity metadata.

```sql
SELECT
    APP_NAME() AS app_name,
    HOST_NAME() AS host_name,
    ORIGINAL_LOGIN() AS original_login,
    SUSER_SNAME() AS current_login;
```

Use them in auditing, troubleshooting, and procedure logging.

## Practical Guidance

- Read `@@ROWCOUNT` immediately.
- Use `SCOPE_IDENTITY()` or `OUTPUT inserted...`, not `@@IDENTITY`.
- Treat `IDENT_CURRENT` as table-level metadata, not session-safe identity retrieval.
- Use `SESSION_CONTEXT` for structured per-session tags instead of ad hoc temp tables or string parsing.
- Use metadata helpers such as `OBJECT_ID` and `DB_NAME` to make scripts idempotent and environment-aware.

## Related

- [[18-stored-procedures-dynamic-sql-and-error-handling]]
- [[08-date-and-time-functions]]

