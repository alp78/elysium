---
title: "04 - Roles, Users, and Privileges"
tags:
  - postgresql
  - security
  - authorization
aliases:
  - PostgreSQL roles and privileges
  - PostgreSQL security model
description: "Professional guide to PostgreSQL roles, login roles, non-login roles, grants, schema privileges, default privileges, and least-privilege access design."
parent: "[[domain-postgresql-server-operations]]"
links:
  - "[[02-psql-connection-and-usage]]"
  - "[[03-postgresql-authentication]]"
  - "[[05-postgresql-scheduling-and-pg-cron]]"
status: draft
---

# Roles, Users, and Privileges

This note is the PostgreSQL equivalent of the SQL Server users, logins, roles, and permissions note, but PostgreSQL collapses much of that model into a single role system. The operational challenge is therefore different: keep login roles narrow, keep most privileges in non-login roles, grant at the right scope, and make inheritance plus default privileges deliberate enough that access stays least-privilege and debuggable.

> [!abstract]- Summary
>
> PostgreSQL authorization is a design problem across identity, scope, membership, ownership, and auditability. This note establishes how login roles, non-login roles, predefined roles, database privileges, schema privileges, object privileges, and default privileges interact so access models stay least-privilege, attributable, and maintainable under production pressure.
>
> **Identity boundaries**
> - clarifies the difference between authenticating as a login role and inheriting capabilities from non-login roles
> - keeps infrastructure reachability, PostgreSQL authentication, and object-level authorization as separate boundaries
>
> **Principal and role model**
> - explains `LOGIN` versus `NOLOGIN`, role membership, inheritance, `SET ROLE`, `PUBLIC`, and predefined roles
>
> **Permission design**
> - covers database `CONNECT`, schema `USAGE` and `CREATE`, table privileges, role-based grants, and default privileges for future objects
>
> **Operational patterns**
> - maps least-privilege designs for application runtimes, pipelines, read-only analytics, and administration without normalizing superuser sprawl
>
> **Operations and safety**
> - Warnings: running applications as `postgres`, granting broad predefined roles casually, and confusing ownership with grants all widen blast radius
> - Recommendations: use login roles for identity, non-login roles for capability, grant at schema scope where appropriate, and design default privileges before object creation starts

> [!note]- Glossary
>
> **Role**
> - PostgreSQL's unified security principal type.
> - It matters because PostgreSQL does not maintain a separate "login" and "group" catalog model the way some other engines do.
>
> ---
>
> **Login role**
> - A role with the `LOGIN` attribute.
> - It matters because only login roles can start sessions directly.
>
> ---
>
> **Non-login role**
> - A role with `NOLOGIN`, typically used as a capability bundle.
> - It matters because this is the cleanest PostgreSQL equivalent of a custom group or access role.
>
> ---
>
> **Privilege**
> - A permission on a PostgreSQL object such as `CONNECT`, `USAGE`, `SELECT`, or `EXECUTE`.
> - It matters because role membership alone does not explain access unless the actual granted privileges are also understood.
>
> ---
>
> **Default privilege**
> - A rule that determines the initial grants applied to future objects created by a role.
> - It matters because PostgreSQL authorization gets expensive fast if every new table requires manual privilege repair.
>
> ---
>
> **`PUBLIC`**
> - The implicit group that includes every role.
> - It matters because some PostgreSQL object types grant privileges to `PUBLIC` by default.

## The Security Model in One Sentence

A PostgreSQL **login role** gets you into the cluster. A PostgreSQL **non-login role** groups capabilities. **Privileges** authorize actions on databases, schemas, tables, sequences, functions, and other objects. **Membership** is how one role receives the capabilities of another role.

## Identity Boundaries

PostgreSQL access is easiest to reason about when the boundaries are separated cleanly:

- the login role proves identity
- non-login roles carry business or operational capability
- grants define scope
- ownership defines who can alter or drop the object

### PostgreSQL | security | why login and capability should usually be separate

Using one broad login role for both authentication and object access is convenient at first and expensive later. Separate the identity role from the privilege role so the access model can be audited and changed without rotating every application credential.

> [!warning]- Authentication identity and capability should not collapse into one broad role
>
> PostgreSQL allows a single login role to own objects, grant rights, and hold broad predefined roles. That works technically, but it destroys least-privilege design quickly once more than one workload or operator is involved.
>
> > [!danger] One broad login role makes every credential a high-blast-radius secret
> >
> > When the login role itself owns objects and carries wide privileges, every leaked password or reused connection string is automatically a privilege escalation event.
> >
> > ```sql
> > CREATE ROLE app_runtime LOGIN CREATEDB CREATEROLE;
> > ```
>
> > [!success] Use a narrow login role and grant it one or more non-login roles
> >
> > This keeps authentication identity stable while the capability model stays modular and reviewable.
> >
> > ```sql
> > CREATE ROLE app_runtime LOGIN;
> > CREATE ROLE app_reader NOLOGIN;
> > GRANT app_reader TO app_runtime;
> > ```

## Core Definitions

### PostgreSQL | security | login roles and non-login roles

PostgreSQL documentation is explicit that `CREATE USER` is just an alias for `CREATE ROLE` where `LOGIN` is assumed by default. The practical result is simple:

- **use `LOGIN` roles for identities that start sessions**
- **use `NOLOGIN` roles for grouped capabilities**

### PostgreSQL | security | privileges and ownership

When an object is created, PostgreSQL assigns it an owner. The owner implicitly has full control over that object, while other roles need explicit grants or membership in the owning role. Ownership is therefore stronger than ordinary grants and should be used deliberately, not casually.

### PostgreSQL | security | PUBLIC and default grants

`PUBLIC` is the implicit group of all roles. PostgreSQL documentation also makes an important distinction about built-in defaults:

- tables and schemas do **not** grant privileges to `PUBLIC` by default
- databases grant `CONNECT` and `TEMPORARY` to `PUBLIC` by default
- functions and procedures grant `EXECUTE` to `PUBLIC` by default unless changed

## Role Types and Effective Access

### PostgreSQL | pg_roles | cluster role inventory

The live cluster inventory is the fastest way to see whether the current PostgreSQL estate is still simple or has already accumulated role sprawl.

#### Inventory the current roles and their core attributes

Run this at the start of any PostgreSQL authorization review, or whenever a team claims "there are only a few roles here." It is typically triggered by first privilege audit, least-privilege redesign, or role cleanup work. The query runs in a SQL session, is read-only, and needs access to `pg_roles`. Its purpose is to separate login roles, administrative roles, replication roles, and predefined capability roles before any grant design is discussed.

| Output field | Source column | Unit / type | Meaning |
|---|---|---|---|
| `rolname` | `pg_roles.rolname` | `name` | The PostgreSQL role name. |
| `rolsuper` | `pg_roles.rolsuper` | `boolean` | Whether the role bypasses all normal permission checks. |
| `rolcreaterole` | `pg_roles.rolcreaterole` | `boolean` | Whether the role can create and manage other roles. |
| `rolcreatedb` | `pg_roles.rolcreatedb` | `boolean` | Whether the role can create databases. |
| `rolcanlogin` | `pg_roles.rolcanlogin` | `boolean` | Whether the role can authenticate directly. |
| `rolreplication` | `pg_roles.rolreplication` | `boolean` | Whether the role can start replication sessions. |
| `rolbypassrls` | `pg_roles.rolbypassrls` | `boolean` | Whether the role bypasses row-level security. |

*This query inventories the live role surface of the current cluster.*

```sql
SELECT
    rolname,
    rolsuper,
    rolcreaterole,
    rolcreatedb,
    rolcanlogin,
    rolreplication,
    rolbypassrls
FROM pg_roles
ORDER BY rolname;
```

```text
           rolname           | rolsuper | rolcreaterole | rolcreatedb | rolcanlogin | rolreplication | rolbypassrls 
-----------------------------+----------+---------------+-------------+-------------+----------------+--------------
 pg_checkpoint               | f        | f             | f           | f           | f              | f
 pg_create_subscription      | f        | f             | f           | f           | f              | f
 pg_database_owner           | f        | f             | f           | f           | f              | f
 pg_execute_server_program   | f        | f             | f           | f           | f              | f
 pg_monitor                  | f        | f             | f           | f           | f              | f
 pg_read_all_data            | f        | f             | f           | f           | f              | f
 pg_read_all_settings        | f        | f             | f           | f           | f              | f
 pg_read_all_stats           | f        | f             | f           | f           | f              | f
 pg_read_server_files        | f        | f             | f           | f           | f              | f
 pg_signal_backend           | f        | f             | f           | f           | f              | f
 pg_stat_scan_tables         | f        | f             | f           | f           | f              | f
 pg_use_reserved_connections | f        | f             | f           | f           | f              | f
 pg_write_all_data           | f        | f             | f           | f           | f              | f
 pg_write_server_files       | f        | f             | f           | f           | f              | f
 postgres                    | t        | t             | t           | t           | t              | t
(15 rows)
```

The live cluster still has one direct login role, `postgres`, and a set of predefined non-login roles. That is operationally useful because it makes the distinction between authentication roles and capability roles visible immediately.

### PostgreSQL | predefined roles | why they are useful and dangerous

Predefined roles are PostgreSQL's answer to many "common capability bundles" that other engines implement through fixed monitoring or server roles. They are powerful because they prevent ad-hoc superuser grants, but they are still privileged and should be granted intentionally.

Important examples in PostgreSQL 16 include:

- `pg_monitor` for monitoring visibility
- `pg_read_all_data` for global read access without object-by-object grants
- `pg_write_all_data` for global write access
- `pg_signal_backend` for cancel or terminate powers
- `pg_read_server_files`, `pg_write_server_files`, and `pg_execute_server_program` for server-file and process access

## Privilege Scope

PostgreSQL privileges live at several levels, and least-privilege design depends on granting at the narrowest scope that still matches the workload.

### PostgreSQL | database and schema privileges | current scope surface

Database-level access and schema-level access are the two gates every role usually hits before table-level permissions matter. A role that cannot `CONNECT` to the database or `USAGE` a schema will not get very far regardless of table grants.

#### Inspect the current schema ownership and ACL surface

Run this when you need to understand how the current database is partitioned before designing or reviewing grants. It is typically triggered by first security review, schema cleanup, or privilege troubleshooting. The query runs in a SQL session, is read-only, and needs access to `pg_namespace`. Its purpose is to show who owns each important schema and whether explicit ACL entries already exist.

| Output field | Source expression | Unit / type | Meaning |
|---|---|---|---|
| `schema_name` | `pg_namespace.nspname` | `name` | The schema name. |
| `owner_role` | `pg_namespace.nspowner::regrole` | `regrole` | The role that owns the schema. |
| `nspacl` | `pg_namespace.nspacl` | `aclitem[]` | The explicit ACL array stored on the schema, if any. |

*This query inspects the live schema ownership and ACL surface for the main business schemas.*

```sql
SELECT
    nspname AS schema_name,
    nspowner::regrole AS owner_role,
    nspacl
FROM pg_namespace
WHERE nspname IN ('bronze', 'silver', 'gold', 'demo_stc', 'public')
ORDER BY nspname;
```

```text
 schema_name |    owner_role     |                            nspacl                             
-------------+-------------------+---------------------------------------------------------------
 bronze      | postgres          | 
 demo_stc    | postgres          | 
 gold        | postgres          | 
 public      | pg_database_owner | {pg_database_owner=UC/pg_database_owner,=U/pg_database_owner}
 silver      | postgres          | 
(5 rows)
```

The application schemas are all owned by `postgres` and have no explicit ACL array stored, which means the privilege state is still largely owner-driven. The `public` schema is the exception: it is owned by `pg_database_owner`, and its ACL shows `=U`, which means `PUBLIC` has `USAGE` on that schema.

#### Inspect the live table-privilege surface on representative tables

Run this after schema review when the next question is which roles currently hold object privileges on representative tables. It is typically triggered by access troubleshooting, privilege cleanup, or a need to prove that only owners currently hold rights. The query runs in a SQL session, is read-only, and uses `information_schema.table_privileges` for a privilege-oriented view. Its purpose is to show which principals actually hold table privileges today on representative bronze, silver, and gold tables.

| Output field | Source column | Unit / type | Meaning |
|---|---|---|---|
| `grantee` | `information_schema.table_privileges.grantee` | `sql_identifier` | The role receiving the privilege. |
| `table_schema` | `information_schema.table_privileges.table_schema` | `sql_identifier` | The schema containing the table. |
| `table_name` | `information_schema.table_privileges.table_name` | `sql_identifier` | The table or view name. |
| `privilege_type` | `information_schema.table_privileges.privilege_type` | `character_data` | The granted privilege such as `SELECT` or `UPDATE`. |

*This query shows the current table-level privilege surface on representative business tables.*

```sql
SELECT
    grantee,
    table_schema,
    table_name,
    privilege_type
FROM information_schema.table_privileges
WHERE table_schema IN ('bronze', 'silver', 'gold')
  AND table_name IN ('index_dim', 'stoxxusa50_ohlcv', 'scores_daily')
ORDER BY grantee, table_schema, table_name, privilege_type;
```

```text
 grantee  | table_schema |    table_name    | privilege_type 
----------+--------------+------------------+----------------
 postgres | bronze       | index_dim        | DELETE
 postgres | bronze       | index_dim        | INSERT
 postgres | bronze       | index_dim        | REFERENCES
 postgres | bronze       | index_dim        | SELECT
 postgres | bronze       | index_dim        | TRIGGER
 postgres | bronze       | index_dim        | TRUNCATE
 postgres | bronze       | index_dim        | UPDATE
 postgres | bronze       | stoxxusa50_ohlcv | DELETE
 postgres | bronze       | stoxxusa50_ohlcv | INSERT
 postgres | bronze       | stoxxusa50_ohlcv | REFERENCES
 postgres | bronze       | stoxxusa50_ohlcv | SELECT
 postgres | bronze       | stoxxusa50_ohlcv | TRIGGER
 postgres | bronze       | stoxxusa50_ohlcv | TRUNCATE
 postgres | bronze       | stoxxusa50_ohlcv | UPDATE
 postgres | gold         | scores_daily     | DELETE
 postgres | gold         | scores_daily     | INSERT
 postgres | gold         | scores_daily     | REFERENCES
 postgres | gold         | scores_daily     | SELECT
 postgres | gold         | scores_daily     | TRIGGER
 postgres | gold         | scores_daily     | TRUNCATE
 postgres | gold         | scores_daily     | UPDATE
 postgres | silver       | index_dim        | DELETE
 postgres | silver       | index_dim        | INSERT
 postgres | silver       | index_dim        | REFERENCES
 postgres | silver       | index_dim        | SELECT
 postgres | silver       | index_dim        | TRIGGER
 postgres | silver       | index_dim        | TRUNCATE
 postgres | silver       | index_dim        | UPDATE
 postgres | silver       | stoxxusa50_ohlcv | DELETE
 postgres | silver       | stoxxusa50_ohlcv | INSERT
 postgres | silver       | stoxxusa50_ohlcv | REFERENCES
 postgres | silver       | stoxxusa50_ohlcv | SELECT
 postgres | silver       | stoxxusa50_ohlcv | TRIGGER
 postgres | silver       | stoxxusa50_ohlcv | TRUNCATE
 postgres | silver       | stoxxusa50_ohlcv | UPDATE
(35 rows)
```

The privilege surface is intentionally simple right now: only the owner holds object privileges. That is common in a single-user lab, but it also means there is not yet a reusable role-based access model in the database itself.

## Role-Based Design Patterns

### PostgreSQL | grants | build a login-role plus capability-role pattern

The cleanest default pattern in PostgreSQL is:

1. create one narrow login role per workload identity
2. create one or more `NOLOGIN` roles for capability
3. grant database, schema, and table privileges to the capability role
4. grant the capability role to the login role

#### Build a read pattern with a login role and a no-login role

Run this when designing the first real least-privilege access path for an application, analyst, or pipeline reader. It is typically triggered by service onboarding or by refactoring away from direct superuser use. The batch runs in a SQL session, is state-changing inside the transaction, and requires a sufficiently privileged administrator. Its purpose is to demonstrate the canonical PostgreSQL access pattern without leaving demo roles behind.

*This batch creates a login role, a non-login reader role, grants database, schema, and table access to the reader role, grants that role to the login role, and verifies the resulting effective permissions before rolling everything back.*

```sql
BEGIN;

CREATE ROLE demo_note04_app LOGIN PASSWORD 'DemoNote04!scram';
CREATE ROLE demo_note04_reader NOLOGIN;

GRANT CONNECT ON DATABASE stoxx TO demo_note04_app;
GRANT USAGE ON SCHEMA silver TO demo_note04_reader;
GRANT SELECT ON TABLE silver.stoxxusa50_ohlcv TO demo_note04_reader;
GRANT demo_note04_reader TO demo_note04_app;

SELECT
    has_database_privilege('demo_note04_app', 'stoxx', 'CONNECT') AS can_connect,
    has_schema_privilege('demo_note04_app', 'silver', 'USAGE') AS can_use_schema,
    has_table_privilege('demo_note04_app', 'silver.stoxxusa50_ohlcv', 'SELECT') AS can_select_table;

ROLLBACK;
```

```text
BEGIN
CREATE ROLE
CREATE ROLE
GRANT
GRANT
GRANT
GRANT ROLE
 can_connect | can_use_schema | can_select_table 
-------------+----------------+------------------
 t           | t              | t
(1 row)

ROLLBACK
```

This is the PostgreSQL equivalent of "authenticate as one identity, authorize through a role". The login role proves who is connecting. The no-login role defines what that workload can do.

## Default Privileges

Granting on today's tables is not enough if tomorrow's tables will be created with the wrong defaults. PostgreSQL solves that with `ALTER DEFAULT PRIVILEGES`, which attaches grants to the object-creation future of a given owner role.

### PostgreSQL | default privileges | prepare future objects for least privilege

Default privileges are one of the most important differences between a hand-maintained privilege model and a durable one. Without them, every new table, sequence, or routine becomes a privilege drift event waiting to happen.

#### Define default SELECT privileges for future tables in one schema

Run this before a pipeline owner or schema owner starts creating objects that downstream readers should automatically see. It is typically triggered by initial schema design, migration automation, or repeated privilege drift after new object creation. The batch runs in a SQL session, is state-changing inside the transaction, and requires the ability to alter default privileges for the target role. Its purpose is to show how PostgreSQL encodes future grants so new objects do not start out inaccessible by accident.

| Output field | Source expression | Unit / type | Meaning |
|---|---|---|---|
| `default_for_role` | `pg_default_acl.defaclrole::regrole` | `regrole` | The role whose future objects are affected. |
| `in_schema` | `pg_default_acl.defaclnamespace::regnamespace` | `regnamespace` | The schema scope for the default privilege entry. |
| `defaclobjtype` | `pg_default_acl.defaclobjtype` | `char` | The object type code; `r` means tables and views. |
| `defaclacl` | `pg_default_acl.defaclacl` | `aclitem[]` | The ACL array applied to future objects of that type. |

*This batch defines a default `SELECT` grant for future tables created by a role in schema `silver`, inspects the catalog entry, and rolls the demo back.*

```sql
BEGIN;

CREATE ROLE demo_note04_owner LOGIN PASSWORD 'DemoNote04!scram';
CREATE ROLE demo_note04_reader2 NOLOGIN;

ALTER DEFAULT PRIVILEGES
FOR ROLE demo_note04_owner
IN SCHEMA silver
GRANT SELECT ON TABLES TO demo_note04_reader2;

SELECT
    defaclrole::regrole AS default_for_role,
    defaclnamespace::regnamespace AS in_schema,
    defaclobjtype,
    defaclacl
FROM pg_default_acl
WHERE defaclrole = 'demo_note04_owner'::regrole;

ROLLBACK;
```

```text
BEGIN
CREATE ROLE
CREATE ROLE
ALTER DEFAULT PRIVILEGES
 default_for_role  | in_schema | defaclobjtype |                 defaclacl                 
-------------------+-----------+---------------+-------------------------------------------
 demo_note04_owner | silver    | r             | {demo_note04_reader2=r/demo_note04_owner}
(1 row)

ROLLBACK
```

This is the difference between a privilege model that survives future schema growth and one that constantly requires manual repair.

## Recommended Design Rules

### PostgreSQL | authorization | practical least-privilege defaults

- use one login role per workload identity
- keep object privileges in `NOLOGIN` roles
- grant `CONNECT` deliberately; do not assume database access is the same as table access
- grant schema `USAGE` deliberately; it is the gate before object access
- use predefined roles only when their scope is exactly what you want
- decide default privileges before large-scale object creation begins
- avoid normal application work as `postgres`

## Additional Security Features

### PostgreSQL | security | row-level security and SECURITY DEFINER

PostgreSQL's closest equivalents to some higher-layer execution-context patterns are row-level security and `SECURITY DEFINER` functions.

- **row-level security** narrows which rows a role can see or modify even when table privileges exist
- **`SECURITY DEFINER`** lets a function execute with the privileges of its owner rather than those of the caller

Both are powerful. Both require careful ownership and search-path design. Neither should be introduced casually.

## Operational Anti-Patterns

- using `postgres` directly for applications, ETL runtimes, or BI tools
- granting `pg_read_all_data` or `pg_write_all_data` when a schema-scoped custom role would be enough
- granting table privileges directly to many login roles instead of using one capability role
- forgetting schema `USAGE` and then misdiagnosing access failures as missing table `SELECT`
- relying on manual grants for future objects instead of defining default privileges
