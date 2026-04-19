---
title: "19 - Functions, Dynamic SQL, and Error Handling"
tags:
  - postgresql
  - query-optimization
  - sql
  - plpgsql
aliases:
  - PostgreSQL procedures
  - PostgreSQL dynamic SQL
  - PostgreSQL exception handling
description: "PostgreSQL reference for PL/pgSQL variables and assignment semantics, functions and procedures, dynamic EXECUTE with format and USING, exception diagnostics, savepoints, aborted transactions, and SECURITY DEFINER execution."
parent: "[[domain-postgresql-query-writing-and-optimization]]"
links:
  - "[[18-postgresql-race-conditions]]"
  - "[[20-postgresql-plan-caching-regressions-and-remediation]]"
status: complete
---

# Functions, Dynamic SQL, and Error Handling

PostgreSQL's procedural layer is PL/pgSQL rather than T-SQL. The moving parts are different, but the production concerns are the same: how variables are assigned, how reusable modules are exposed, how dynamic SQL is parameterized safely, how errors are surfaced, what happens to the surrounding transaction after failure, and how security context changes when code runs with elevated rights.

> [!abstract] Scope
>
> This note mirrors the SQL Server procedural-programming chapter with PostgreSQL equivalents. It covers PL/pgSQL variables, `SELECT INTO` versus `SELECT INTO STRICT`, reusable functions and procedures, dynamic `EXECUTE ... USING`, exception diagnostics, savepoints, aborted-transaction behavior, and `SECURITY DEFINER`.
>
> - **Procedural basics** cover variable declaration, assignment semantics, and the main traps around non-strict row capture.
> - **Modules** cover the difference between functions and procedures plus basic invocation patterns.
> - **Dynamic SQL** covers safe identifier assembly and value parameterization.
> - **Error and transaction handling** covers exception blocks, diagnostics, savepoints, and what PostgreSQL does after a statement error.
> - **Security context** covers `GRANT EXECUTE` and `SECURITY DEFINER`.

## Variables and Assignment

PL/pgSQL variables live inside a `DECLARE` block and are assigned with `:=`, `SELECT ... INTO`, or function calls. The main trap is that non-strict `SELECT ... INTO` does not protect you from multi-row surprises.

### Non-strict `SELECT ... INTO` silently takes the first row

```sql
DO $$
DECLARE
    v_symbol text;
BEGIN
    SELECT symbol INTO v_symbol
    FROM silver.eurostoxx50_ohlcv
    WHERE date = DATE '2026-04-07';

    RAISE NOTICE 'non_strict_first_row=%', v_symbol;
END $$;
```

```text
NOTICE:  non_strict_first_row=ASML.AS
```

The query matched many rows, but the variable ended up with only one of them. That is the PL/pgSQL equivalent of a silent assignment trap.

### `INTO STRICT` raises instead of hiding the bug

```sql
DO $$
DECLARE
    v_symbol text;
    v_state text;
    v_msg text;
BEGIN
    BEGIN
        SELECT symbol INTO STRICT v_symbol
        FROM silver.eurostoxx50_ohlcv
        WHERE date = DATE '2026-04-07';
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS
            v_state = RETURNED_SQLSTATE,
            v_msg = MESSAGE_TEXT;
        RAISE NOTICE 'strict_sqlstate=% message=%', v_state, v_msg;
    END;
END $$;
```

```text
NOTICE:  strict_sqlstate=P0003 message=query returned more than one row
```

If your intent is scalar assignment, `STRICT` is the safer default.

## Functions and Procedures

PostgreSQL has both:

- **functions** return a value and can be used inside SQL expressions
- **procedures** are invoked with `CALL` and are the only server-side modules that can manage transaction control directly

### A simple SQL function for reusable scalar logic

```sql
CREATE OR REPLACE FUNCTION demo_stc.note19_latest_close(p_symbol text)
RETURNS double precision
LANGUAGE sql
AS $$
    SELECT close
    FROM silver.stoxxusa50_ohlcv
    WHERE symbol = p_symbol
    ORDER BY date DESC
    LIMIT 1;
$$;

SELECT demo_stc.note19_latest_close('AAPL') AS latest_close;
```

| latest_close |
|---:|
| 253.5 |

### A procedure can expose an explicit unit of work

```sql
CREATE TABLE demo_stc.note19_proc_demo (
    symbol text PRIMARY KEY,
    status text NOT NULL
);

INSERT INTO demo_stc.note19_proc_demo
VALUES ('AAPL', 'NEW');

CREATE OR REPLACE PROCEDURE demo_stc.note19_mark_reviewed(
    IN p_symbol text,
    INOUT p_rows_updated integer
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE demo_stc.note19_proc_demo
    SET status = 'REVIEWED'
    WHERE symbol = p_symbol;

    GET DIAGNOSTICS p_rows_updated = ROW_COUNT;
END;
$$;

CALL demo_stc.note19_mark_reviewed('AAPL', NULL);

SELECT symbol, status
FROM demo_stc.note19_proc_demo;
```

| p_rows_updated |
|---:|
| 1 |

| symbol | status |
|---|---|
| AAPL | REVIEWED |

Operationally, procedures are where PostgreSQL gets closest to the SQL Server "stored procedure as API entrypoint" model.

## Dynamic SQL

Dynamic SQL in PostgreSQL uses `EXECUTE`. Values belong in `USING`; identifiers belong in `format()` with `%I` after validation.

```sql
CREATE OR REPLACE FUNCTION demo_stc.note19_dynamic_count(
    p_schema text,
    p_table text,
    p_symbol text
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
    v_count bigint;
BEGIN
    IF to_regclass(format('%I.%I', p_schema, p_table)) IS NULL THEN
        RAISE EXCEPTION 'target table %.% does not exist', p_schema, p_table;
    END IF;

    EXECUTE format(
        'SELECT count(*) FROM %I.%I WHERE symbol = $1',
        p_schema,
        p_table
    )
    INTO v_count
    USING p_symbol;

    RETURN v_count;
END;
$$;

SELECT demo_stc.note19_dynamic_count(
    'silver',
    'stoxxusa50_ohlcv',
    'AAPL'
) AS aapl_rows;
```

| aapl_rows |
|---:|
| 1320 |

This is the safe PostgreSQL shape:

- validate the identifier target first with `to_regclass`
- inject identifiers with `%I`
- pass values separately through `USING`

## Exception Handling and Diagnostics

PL/pgSQL uses `BEGIN ... EXCEPTION ... END` blocks instead of `TRY...CATCH`. The key diagnostic surface is `GET STACKED DIAGNOSTICS`.

```sql
DO $$
DECLARE
    v_state text;
    v_msg text;
    v_detail text;
BEGIN
    BEGIN
        PERFORM 1 / 0;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS
            v_state = RETURNED_SQLSTATE,
            v_msg = MESSAGE_TEXT,
            v_detail = PG_EXCEPTION_DETAIL;

        RAISE NOTICE 'sqlstate=% message=% detail=%',
            v_state,
            v_msg,
            COALESCE(v_detail, '<null>');
    END;
END $$;
```

```text
NOTICE:  sqlstate=22012 message=division by zero detail=
```

The important distinction from SQL Server is that PostgreSQL error handling is tightly tied to subtransactions. An exception block effectively creates a savepoint boundary.

## Transaction Behavior After Errors

This is one of the biggest operational differences from SQL Server. In PostgreSQL, an unhandled error inside a transaction leaves the transaction aborted until you explicitly roll it back.

```sql
BEGIN;

CREATE TEMP TABLE note19_abort_demo (
    id integer PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO note19_abort_demo VALUES (1);
INSERT INTO note19_abort_demo VALUES (1);
SELECT COUNT(*) FROM note19_abort_demo;

ROLLBACK;
```

```text
ERROR:  duplicate key value violates unique constraint "note19_abort_demo_pkey"
DETAIL:  Key (id)=(1) already exists.
ERROR:  current transaction is aborted, commands ignored until end of transaction block
```

There is no direct `XACT_STATE()` equivalent because PostgreSQL makes the state obvious: once the transaction is aborted, most subsequent statements are rejected until `ROLLBACK`.

### Savepoints are the real partial-rollback tool

```sql
BEGIN;

CREATE TEMP TABLE note19_savepoint_demo (
    id integer,
    note text
) ON COMMIT DROP;

INSERT INTO note19_savepoint_demo VALUES (1, 'before');

SAVEPOINT sp1;
INSERT INTO note19_savepoint_demo VALUES (2, 'rolled_back');
ROLLBACK TO SAVEPOINT sp1;

SELECT id, note
FROM note19_savepoint_demo
ORDER BY id;

ROLLBACK;
```

| id | note |
|---:|---|
| 1 | before |

That is the PostgreSQL equivalent of partial rollback. Nested transactions are not separate commit scopes; savepoints are.

## Security Context and `SECURITY DEFINER`

The PostgreSQL counterpart to ownership chaining plus `EXECUTE AS` is usually a carefully written `SECURITY DEFINER` function exposed through `GRANT EXECUTE`.

The captured demo created a protected table, granted execute on a `SECURITY DEFINER` function to a low-privilege role, and then switched into that role.

Under the role, the function succeeds:

```sql
SET ROLE note19_reader;
SELECT demo_stc.note19_secure_count() AS visible_via_function;
RESET ROLE;
```

| visible_via_function |
|---:|
| 2 |

Direct table access from the same role fails:

```text
ERROR:  permission denied for table note19_secure_demo
```

This is the operational point:

- the caller needs `EXECUTE` on the function
- the function runs with the definer's rights
- direct table rights do not need to be granted if the function is the intended API boundary

> [!warning] `SECURITY DEFINER` is powerful enough to be dangerous
>
> Always fix the search path inside security-definer code or schema-qualify every object reference. Elevated modules should be narrow, audited entrypoints, not generic convenience wrappers.

## Practical Procedure Template

The PostgreSQL production pattern is different in syntax but similar in intent:

1. Validate inputs before opening expensive work.
2. Prefer one atomic DML statement over read-then-write branching.
3. Use `EXCEPTION` blocks only where you actually need controlled recovery or diagnostic enrichment.
4. Use savepoints for partial rollback, not nested `BEGIN`.
5. Keep `SECURITY DEFINER` modules small and explicit.
6. Use `EXECUTE ... USING` plus `%I` identifier formatting for dynamic SQL.

The disposable objects used for this note were dropped after capture: `demo_stc.note19_proc_demo`, `demo_stc.note19_latest_close`, `demo_stc.note19_dynamic_count`, the secure-demo objects, and the helper role `note19_reader`.
