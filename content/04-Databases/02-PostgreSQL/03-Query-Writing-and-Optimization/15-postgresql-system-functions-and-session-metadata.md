---
title: "15 - System Functions and Session Metadata"
tags:
  - postgresql
  - query-optimization
  - sql
aliases:
  - PostgreSQL session metadata
  - PostgreSQL system functions
  - PostgreSQL session context
description: "PostgreSQL reference for row-count and transaction-state helpers, role and permission identity, regclass and regtype metadata functions, session-level custom GUC context, and catalog-join patterns for diagnostics."
parent: "[[domain-postgresql-query-writing-and-optimization]]"
links:
  - "[[14-postgresql-wait-events-and-session-analysis]]"
  - "[[16-postgresql-blocking-and-locking]]"
status: complete
---

# System Functions and Session Metadata

PostgreSQL exposes the same general categories of helper surface as SQL Server, but the idioms differ. There is no family of `@@` globals. Row-count capture is mostly a PL/pgSQL concern, session identity is split across `current_user`, `session_user`, and `current_role`, object metadata is anchored on OIDs and `reg*` casts, and the closest equivalent to `SESSION_CONTEXT` is usually a custom GUC read through `current_setting()`.

> [!abstract] Scope
>
> This note mirrors the SQL Server metadata-helper chapter with PostgreSQL equivalents. It covers row-count and transaction-state helpers, server and connection metadata, role and privilege identity, object-name resolution through `regclass` and catalog functions, custom session context through `set_config()` and `current_setting()`, and the catalog-join patterns that make these helpers operationally useful.
>
> - **Session-state helpers** cover `GET DIAGNOSTICS ... ROW_COUNT`, `FOUND`, `pg_backend_pid()`, and transaction-id helpers.
> - **Server and connection metadata** cover `version()`, `current_database()`, search-path helpers, backend start time, and connection-address functions.
> - **Security and identity** cover `current_user`, `session_user`, `current_role`, `SET ROLE`, and privilege-check helpers.
> - **Object and schema metadata** cover `to_regclass`, `to_regnamespace`, `to_regtype`, `format_type`, and idempotent DDL probes.
> - **Session context** covers custom GUCs as the PostgreSQL analogue to `SESSION_CONTEXT`, including row-level-security integration.

## Session-State Helpers

PostgreSQL does not expose session-state globals like `@@ROWCOUNT`. The equivalent patterns are split between plain SQL functions and PL/pgSQL diagnostics.

### Row counts belong to PL/pgSQL diagnostics, not global variables

`GET DIAGNOSTICS ... ROW_COUNT` and `FOUND` are the nearest equivalents to `@@ROWCOUNT`, but they are PL/pgSQL features rather than bare SQL expressions.

```sql
BEGIN;

CREATE TEMP TABLE note15_rowcount_demo (
    id integer,
    v integer
) ON COMMIT DROP;

INSERT INTO note15_rowcount_demo
VALUES (1, 10), (2, 20), (3, 30);

DO $$
DECLARE
    rc bigint;
    matched boolean;
BEGIN
    UPDATE note15_rowcount_demo
    SET v = v + 1
    WHERE id <= 2;

    GET DIAGNOSTICS rc = ROW_COUNT;
    matched := FOUND;

    RAISE NOTICE 'row_count=% found=%', rc, matched;
END $$;

ROLLBACK;
```

```text
NOTICE:  row_count=2 found=t
```

This is the PostgreSQL pattern to remember:

- `ROW_COUNT` captures the number of rows affected by the immediately preceding SQL statement inside PL/pgSQL.
- `FOUND` tells you whether that statement matched at least one row.
- Neither feature exists as a general-purpose global outside procedural code.

### Backend PID and transaction id replace `@@SPID` and transaction globals

```sql
BEGIN;

SELECT txid_current_if_assigned() AS xid_before_write;

CREATE TEMP TABLE note15_xid_demo (id integer) ON COMMIT DROP;
INSERT INTO note15_xid_demo VALUES (1);

SELECT
    txid_current_if_assigned() AS xid_after_write,
    txid_current() AS xid_current;

ROLLBACK;
```

| xid_before_write |
|---|
|  |

| xid_after_write | xid_current |
|---:|---:|
| 1189 | 1189 |

Before the write, no transaction id had been assigned yet. After the write, both helpers report the current xid. Pair that with `pg_backend_pid()` when you need session-anchored diagnostics.

## Server, Database, and Connection Metadata

The PostgreSQL equivalents to `SERVERPROPERTY`, `DATABASEPROPERTYEX`, and `CONNECTIONPROPERTY` are more composable: plain functions, `current_setting()`, and a handful of built-in metadata helpers.

```sql
SELECT
    version() AS version,
    current_database() AS current_database,
    current_schema() AS current_schema,
    current_schemas(true) AS search_path_schemas,
    pg_backend_pid() AS backend_pid,
    pg_is_in_recovery() AS in_recovery,
    current_setting('TimeZone') AS timezone,
    pg_postmaster_start_time() AS postmaster_start_time,
    pg_conf_load_time() AS conf_load_time,
    inet_client_addr() AS client_addr,
    inet_server_addr() AS server_addr,
    inet_client_port() AS client_port,
    inet_server_port() AS server_port;
```

| version | current_database | current_schema | search_path_schemas | backend_pid | in_recovery | timezone | postmaster_start_time | conf_load_time | client_addr | server_addr | client_port | server_port |
|---|---|---|---|---:|---|---|---|---|---|---|---|---|
| PostgreSQL 16.13 (Debian 16.13-1.pgdg13+1) on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit | stoxx | public | {pg_catalog,public} | 5953 | f | Etc/UTC | 2026-04-18 23:55:01.079878+00 | 2026-04-18 23:55:01.059987+00 |  |  |  |  |

The null `inet_*` values are real and meaningful here: the session was connected over a local Unix socket inside the container, so there is no TCP client or server address to report.

## Principals, Roles, and Permission Checks

PostgreSQL distinguishes the authenticated session identity from the currently active role. That is the key mental model behind `session_user`, `current_user`, and `current_role`.

```sql
SELECT
    current_user,
    session_user,
    current_role,
    current_setting('role') AS role_setting,
    current_setting('is_superuser') AS is_superuser,
    has_schema_privilege(current_user, 'gold', 'USAGE') AS has_gold_usage,
    has_table_privilege(current_user, 'gold.scores_daily', 'SELECT') AS has_scores_select,
    pg_has_role(current_user, 'pg_read_all_data', 'MEMBER') AS member_pg_read_all_data;
```

| current_user | session_user | current_role | role_setting | is_superuser | has_gold_usage | has_scores_select | member_pg_read_all_data |
|---|---|---|---|---|---|---|---|
| postgres | postgres | postgres | none | on | t | t | t |

### `SET ROLE` changes the effective user, not the session owner

```sql
BEGIN;

CREATE ROLE note15_demo_role NOLOGIN;
GRANT note15_demo_role TO postgres;

SELECT
    current_user AS before_current_user,
    session_user AS before_session_user,
    current_role AS before_current_role;

SET ROLE note15_demo_role;

SELECT
    current_user AS after_current_user,
    session_user AS after_session_user,
    current_role AS after_current_role;

RESET ROLE;
ROLLBACK;
```

| before_current_user | before_session_user | before_current_role |
|---|---|---|
| postgres | postgres | postgres |

| after_current_user | after_session_user | after_current_role |
|---|---|---|
| note15_demo_role | postgres | note15_demo_role |

This is the PostgreSQL equivalent to the "effective user versus original login" distinction:

- `session_user` stays anchored to the authenticated session.
- `current_user` and `current_role` follow `SET ROLE`.
- Audit and security logic must be clear about which identity it actually needs.

## Database, Schema, and Object Metadata

PostgreSQL metadata helpers are centered on object OIDs and `reg*` coercions rather than SQL Server-style integer ID functions. In practice that is cleaner because the textual and object forms can be interconverted directly.

```sql
SELECT
    to_regclass('gold.scores_daily') AS scores_daily_regclass,
    to_regnamespace('gold') AS gold_regnamespace,
    to_regtype('numeric') AS numeric_regtype,
    pg_typeof(now()) AS now_type;
```

| scores_daily_regclass | gold_regnamespace | numeric_regtype | now_type |
|---|---|---|---|
| gold.scores_daily | gold | numeric | timestamp with time zone |

For column-level inspection, use the catalog plus formatting helpers:

```sql
SELECT
    a.attname AS column_name,
    format_type(a.atttypid, a.atttypmod) AS formatted_type,
    col_description(a.attrelid, a.attnum) AS column_comment
FROM pg_attribute AS a
WHERE a.attrelid = 'gold.scores_daily'::regclass
  AND a.attnum > 0
  AND NOT a.attisdropped
ORDER BY a.attnum
LIMIT 6;
```

| column_name | formatted_type | column_comment |
|---|---|---|
| id | integer |  |
| _index | character varying(20) |  |
| symbol | character varying(20) |  |
| score_date | date |  |
| sector | character varying(100) |  |
| pe_zscore | double precision |  |

### `to_regclass()` is the normal idempotent DDL probe

```sql
BEGIN;

SELECT to_regclass('pg_temp.note15_idempotent_demo') AS before_create;

CREATE TEMP TABLE note15_idempotent_demo (id integer) ON COMMIT DROP;

SELECT to_regclass('pg_temp.note15_idempotent_demo') AS after_create;

ROLLBACK;
```

| before_create |
|---|
|  |

| after_create |
|---|
| note15_idempotent_demo |

For idempotent DDL, this is the PostgreSQL equivalent of checking `OBJECT_ID(...) IS NULL` before creating an object.

## Session Context Storage

PostgreSQL has no direct equivalent to SQL Server `SESSION_CONTEXT` with immutable read-only keys. The nearest operational analogue is a custom GUC set with `set_config()` or `SET`, then read back with `current_setting(..., true)`.

```sql
BEGIN;

SELECT set_config('app.tenant_id', 'tenant_a', false) AS tenant_set;
SELECT current_setting('app.tenant_id', true) AS tenant_visible;

RESET app.tenant_id;
SELECT current_setting('app.tenant_id', true) AS tenant_after_reset;

ROLLBACK;
```

| tenant_set |
|---|
| tenant_a |

| tenant_visible |
|---|
| tenant_a |

| tenant_after_reset |
|---|
|  |

This pattern is flexible, but it carries an important caveat: PostgreSQL does not provide a SQL Server-style `@read_only = 1` flag for custom session keys. If the same session can run untrusted code paths later, the setting can be overwritten.

### Custom GUCs integrate cleanly with row-level security

The closest PostgreSQL equivalent to "set session context, then let RLS read it" is a policy built on `current_setting('app.tenant_id', true)`. The demo below used a disposable role and table that were dropped after capture.

Without a tenant key, the role sees nothing:

```sql
SET ROLE note15_rls_role;

SELECT
    current_user,
    session_user,
    current_setting('app.tenant_id', true) AS tenant_id,
    count(*) AS visible_rows
FROM demo_stc.note15_orders;

RESET ROLE;
```

| current_user | session_user | tenant_id | visible_rows |
|---|---|---|---:|
| note15_rls_role | postgres |  | 0 |

With `tenant_a`, only tenant A rows are visible:

```sql
SET ROLE note15_rls_role;
SELECT set_config('app.tenant_id', 'tenant_a', false);

SELECT
    current_user,
    session_user,
    current_setting('app.tenant_id', true) AS tenant_id,
    count(*) AS visible_rows
FROM demo_stc.note15_orders;

RESET ROLE;
```

| current_user | session_user | tenant_id | visible_rows |
|---|---|---|---:|
| note15_rls_role | postgres | tenant_a | 2 |

With `tenant_b`, the policy exposes only tenant B rows:

```sql
SET ROLE note15_rls_role;
SELECT set_config('app.tenant_id', 'tenant_b', false);

SELECT order_id, tenant_id, amount
FROM demo_stc.note15_orders
ORDER BY order_id;

RESET ROLE;
```

| order_id | tenant_id | amount |
|---:|---|---:|
| 3 | tenant_b | 200.00 |

That is the PostgreSQL RLS pattern to remember:

- Store tenant or security context in a custom GUC.
- Read it inside the policy with `current_setting(..., true)`.
- Treat the setting as mutable unless the application architecture prevents later overwrite.

## Catalog and Stats Joining Patterns

These helpers become most valuable when they anchor catalog and statistics queries safely.

### Join the current backend to `pg_stat_activity`

```sql
SELECT
    pid,
    usename,
    application_name,
    state,
    wait_event_type,
    wait_event,
    backend_start
FROM pg_stat_activity
WHERE pid = pg_backend_pid();
```

| pid | usename | application_name | state | wait_event_type | wait_event | backend_start |
|---:|---|---|---|---|---|---|
| 6121 | postgres | psql | active |  |  | 2026-04-19 01:29:00.040964+00 |

This is the PostgreSQL equivalent of anchoring DMV inspection on `@@SPID`.

### Join one relation cleanly into statistics views

```sql
SELECT
    relid::regclass AS relation_name,
    seq_scan,
    idx_scan,
    n_live_tup,
    last_analyze
FROM pg_stat_user_tables
WHERE relid = 'gold.scores_daily'::regclass;
```

| relation_name | seq_scan | idx_scan | n_live_tup | last_analyze |
|---|---:|---:|---:|---|
| gold.scores_daily | 94 | 0 | 635 |  |

The relation is identified unambiguously through the regclass cast rather than through a name-only string comparison.

## Practical Guidance

- Use `GET DIAGNOSTICS ... ROW_COUNT` and `FOUND` inside PL/pgSQL instead of looking for a global `@@ROWCOUNT` analogue.
- Use `pg_backend_pid()` whenever a diagnostic query needs to anchor itself to the current session.
- Distinguish `session_user` from `current_user` before writing audit or impersonation-sensitive code.
- Prefer `to_regclass`, `to_regnamespace`, and `to_regtype` over manual catalog joins when existence or type resolution is the only goal.
- Use custom GUCs for session metadata only when the application can control who is allowed to overwrite them later.
- Use regclass casts directly in stats-view filters so object targeting stays precise.

The disposable RLS demo objects used for capture were removed after validation: `demo_stc.note15_orders` was dropped and `note15_rls_role` was revoked and dropped.
