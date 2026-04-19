---
title: "02 - psql Connection and Usage"
tags:
  - postgresql
  - administration
  - connectivity
aliases:
  - psql
  - PostgreSQL command-line client
description: "Production psql usage for connection testing, connection strings, script execution, exit-code handling, output shaping, and local recovery access, grounded on the current stoxx-postgres lab."
parent: "[[domain-postgresql-server-operations]]"
links:
  - "[[01-postgresql-server-configuration]]"
  - "[[03-postgresql-authentication]]"
  - "[[04-roles-users-and-privileges]]"
  - "[[01-postgresql-storage-and-schema-surface]]"
  - "[[01-postgresql-query-surface-and-planner-basics]]"
  - "[[01-postgresql-loading-patterns-and-idempotency]]"
status: draft
---

# psql Connection and Usage

This note is the PostgreSQL equivalent of the SQL Server chapter's `sqlcmd` note. The operational purpose is the same: make the command-line client predictable enough that automation, health checks, one-off diagnostics, and emergency access all behave the same way every time. The current lab uses the `stoxx-postgres` container as both the server and the installed client surface, so every captured example uses `docker exec ... psql` rather than assuming a separate Windows `psql.exe` is present on the host.

> [!abstract]- Summary
>
> Covers production `psql` usage as the scriptable PostgreSQL command-line surface for automation, incident response, and repeatable query capture outside GUI tools such as pgAdmin. Every example is grounded on the current `stoxx-postgres` PostgreSQL 16.13 lab, and the note exists to make the operational boundary explicit: know where the client actually runs, how it reaches the server, which authentication path is active, how scripts stop or continue on errors, how output is shaped for downstream tools, and which local-only recovery paths exist when the normal session path is not the one you should trust.
>
> **Current Environment**
> - identify the installed `psql` client, the host-to-container port mapping, the current database target, and the fact that the workstation currently has no host-native `psql` on `PATH`
> - capture the database list and server identity that later PostgreSQL notes will assume
>
> **Authentication And Connection**
> - use direct socket connections, TCP libpq connection strings, `PGPASSWORD`, `.pgpass`, `sslmode`, `application_name`, and `connect_timeout` deliberately rather than by inherited default
> - inspect the current `pg_hba.conf` surface so it is clear why this lab allows loopback trust and why that behavior is not the production baseline
>
> **Script And Variable Execution**
> - run one-off diagnostics with `-c`, saved scripts with `-f`, connection metadata with `\conninfo`, and reusable variables with `\set` and `-v`
>
> **Error Handling And Exit Codes**
> - distinguish default continue-after-error behavior from `ON_ERROR_STOP`, understand the documented `psql` exit codes, and use `-1` when a whole non-interactive run must commit or roll back as one unit
>
> **Output Shaping**
> - emit aligned tables for humans, CSV for file-oriented automation, and delimiter-separated tuples for shell pipelines
> - use `-A`, `-F`, `-t`, `--csv`, `-x`, and `-P` so later note outputs can be captured in the right shape the first time
>
> **Local Admin Access**
> - use `docker exec -u postgres` and `pg_ctl status` for the local-container equivalent of "break glass and get onto the box"
> - treat PostgreSQL single-user mode as an offline recovery surface, not as a second everyday session path

> [!note]- Glossary
>
> **`psql`**
> - The standard PostgreSQL interactive terminal and scripting client.
> - It matters because it is the command-line surface the rest of this PostgreSQL chapter will rely on for reproducible execution and output capture.
>
> ---
>
> **libpq**
> - PostgreSQL's core client library, used by `psql` and many application drivers.
> - It matters because connection strings, environment variables such as `PGHOST` and `PGPASSWORD`, and client-side `sslmode` behavior are defined by libpq semantics rather than by `psql` alone.
>
> ---
>
> **Connection string**
> - A libpq key-value connection specification such as `host=127.0.0.1 port=5432 dbname=stoxx user=postgres`.
> - It matters because it is the cleanest way to make non-default host, port, timeout, and TLS behavior explicit in automation.
>
> ---
>
> **`PGPASSWORD`**
> - The libpq environment variable that supplies a password without embedding it directly inside the visible command string.
> - It matters because it is commonly used in disposable labs and CI jobs, even though PostgreSQL documentation recommends password files over environment variables for stronger security boundaries.
>
> ---
>
> **`.pgpass`**
> - The PostgreSQL password file that lets libpq retrieve credentials non-interactively.
> - It matters because it is the preferred non-prompt path once local trust is removed and scheduled jobs still need unattended access.
>
> ---
>
> **`sslmode`**
> - The libpq connection option that controls whether the client prefers, requires, or verifies TLS.
> - It matters because connection success, encryption, and certificate validation depend on the client mode just as much as on server-side `ssl = on`.
>
> ---
>
> **`ON_ERROR_STOP`**
> - A `psql` variable that tells non-interactive runs to stop immediately on the first SQL error instead of continuing.
> - It matters because `psql` does not fail fast by default when reading scripts, and silent continuation is operationally unsafe in automation.
>
> ---
>
> **`-1` / `--single-transaction`**
> - The `psql` option that wraps all `-c` and `-f` work in one explicit transaction.
> - It matters because it gives file-driven DDL and DML runs a clear all-or-nothing boundary when the statements themselves are transaction-safe.
>
> ---
>
> **Single-user mode**
> - A `postgres --single` server start mode intended for bootstrapping and disaster recovery, not normal client work.
> - It matters because PostgreSQL does not have a Dedicated Admin Connection equivalent; the closest emergency surfaces are local OS-user access and offline single-user startup.

## Current Environment

Before writing automation against PostgreSQL, confirm where the client actually lives, which server endpoint it is reaching, and whether the workstation has a native client at all. The current lab is container-first: the database server listens on port `5432` inside the container, the workstation reaches it on `localhost:5434`, and every captured `psql` example in this note was executed from inside `stoxx-postgres`.

### PostgreSQL | psql | client baseline

This subsection verifies the exact `psql` build shipped in the lab container and confirms the database, role, server version, and data directory that later notes will inherit. The commands are read-only and belong at the very start of any new PostgreSQL workstation or lab validation.

#### Identify the installed psql binary

Run this as the first client check on any new PostgreSQL host, container, or automation runner. The trigger is simple: if the `psql` build is unknown, every later assumption about flags, help topics, and client behavior is weaker than it should be. The command runs in a shell, is read-only, and requires only the ability to execute the client binary. Its purpose is to pin the client version before any scripted behavior is trusted.

*This command prints the exact `psql` client version available inside the live lab container.*

```powershell
docker exec stoxx-postgres psql --version
```

```text
psql (PostgreSQL) 16.13 (Debian 16.13-1.pgdg13+1)
```

The lab is using the PostgreSQL 16 client that ships in the official Debian-based image, which is the right baseline for a chapter whose server is also PostgreSQL 16.13. That version alignment matters because later client behaviors such as `--csv`, `--help=options`, and the exact help text surface are versioned with the client, not with the host OS.

#### Confirm the current database, role, server version, and data directory

Run this immediately after the first successful connection, or any time there is a risk that you are on the wrong instance, database, or role. It is usually triggered by a new terminal session, a recent rebuild, or a suspicion that the connection target changed underneath automation. The command runs through `psql`, is read-only, and needs only a valid login path. Its purpose is to prove the identity of the current server and database before a state-changing step is even considered.

| Output field | Source expression | Unit / type | Meaning |
|---|---|---|---|
| `database_name` | `current_database()` | `name` | The database currently bound to this session. |
| `role_name` | `current_user` | `name` | The effective SQL role for permission checks in this session. |
| `server_version` | `current_setting('server_version')` | `text` | The server's advertised PostgreSQL version string. |
| `server_port` | `current_setting('port')` | `text` | The server-side listener port inside the current runtime. |
| `data_directory` | `current_setting('data_directory')` | `text` | The server's active cluster data directory. |

*This command confirms the live session target rather than assuming the right database and cluster were reached.*

```powershell
docker exec stoxx-postgres psql -U postgres -d stoxx -P pager=off -c "SELECT current_database() AS database_name, current_user AS role_name, current_setting('server_version') AS server_version, current_setting('port') AS server_port, current_setting('data_directory') AS data_directory;"
```

```text
 database_name | role_name |         server_version          | server_port |      data_directory      
---------------+-----------+---------------------------------+-------------+--------------------------
 stoxx         | postgres  | 16.13 (Debian 16.13-1.pgdg13+1) | 5432        | /var/lib/postgresql/data
(1 row)
```

The session is attached to the intended `stoxx` database as the `postgres` superuser. The important boundary here is the port distinction: the server itself is listening on `5432` inside the container, but the host entry point that later notes will use from Windows is `localhost:5434`.

| Flag | Syntax | Description |
|---|---|---|
| `-V` | `psql -V` | Print the client version and exit. |
| `-U` | `psql -U postgres` | Connect as the named database role instead of the OS user name. |
| `-d` | `psql -d stoxx` | Connect to the named database. |
| `-P` | `psql -P pager=off` | Set a `\pset` printing option from the command line. |
| `-c` | `psql -c "SELECT ..."` | Execute one SQL command string or one backslash command and then exit. |

### PostgreSQL | psql | PowerShell and Docker entry paths

This subsection makes the current workstation boundary explicit. The Windows host can reach the server through Docker port forwarding, but the host currently does not have a native `psql` binary on `PATH`, so the practical operational path is `docker exec` into the database container.

#### Show the host-to-container port mapping

Run this whenever the server is containerized and the host-side connection target matters to scripts, notebooks, or other client tools. It is typically triggered by a new container build, a bind-port change, or a documentation pass that needs the actual workstation entry point. The command runs in Docker, is read-only, and needs only permission to inspect the container. Its purpose is to prove which host port forwards to PostgreSQL's internal listener.

*This command shows how Docker maps the container's PostgreSQL listener to the Windows host.*

```powershell
docker port stoxx-postgres 5432
```

```text
0.0.0.0:5434
[::]:5434
```

The practical workstation target is `localhost:5434`, not `localhost:5432`. That distinction must be carried into any future host-side `psql`, application connection string, or notebook kernel that reaches the container over TCP rather than through `docker exec`.

#### Check whether the Windows host already has a native psql client

Run this before writing host-native instructions or assuming `psql.exe` is directly available in PowerShell. It is usually triggered by workstation onboarding or by the decision to move from container-executed commands to host-executed commands. The command runs in PowerShell, is read-only, and needs no special privileges. Its purpose is to make the local tooling boundary explicit instead of relying on an unverified assumption about `PATH`.

*This command reports whether the Windows host can run `psql` directly without entering the container first.*

```powershell
if (Get-Command psql -ErrorAction SilentlyContinue) { Get-Command psql | Select-Object Source, Version | Format-Table -AutoSize | Out-String } else { 'psql not found on host PATH' }
```

```text
psql not found on host PATH
```

On this workstation the only installed client surface is the one inside `stoxx-postgres`. That is why the PostgreSQL chapter should currently prefer `docker exec stoxx-postgres psql ...` for live captures instead of publishing host-native `psql` commands that would fail immediately on the same machine.

#### List the databases visible from the current lab client

Run this after client installation or after any restore or rebuild where the cluster contents may have changed. It is typically triggered by basic sanity checking, database creation work, or confirming that the target database exists before attempting a scripted connection. The command runs through `psql`, is read-only, and needs only a role that can connect to the cluster. Its purpose is to prove which databases the current client can enumerate right now.

*This command lists the databases that the current `psql` client can see in the containerized cluster.*

```powershell
docker exec stoxx-postgres psql -U postgres -lqt
```

```text
 postgres  | postgres | UTF8     | libc            | en_US.utf8 | en_US.utf8 |            |           | 
 stoxx     | postgres | UTF8     | libc            | en_US.utf8 | en_US.utf8 |            |           | 
 template0 | postgres | UTF8     | libc            | en_US.utf8 | en_US.utf8 |            |           | =c/postgres          +
           |          |          |                 |            |            |            |           | postgres=CTc/postgres
 template1 | postgres | UTF8     | libc            | en_US.utf8 | en_US.utf8 |            |           | =c/postgres          +
           |          |          |                 |            |            |            |           | postgres=CTc/postgres
```

The cluster is the expected minimal shape: the working `stoxx` database, the administrative `postgres` database, and the two standard templates. That small inventory is useful because later restore and backup notes can reason from a clean cluster baseline rather than from an estate with many unrelated databases.

| Flag | Syntax | Description |
|---|---|---|
| `-l` | `psql -l` | List the databases available in the cluster and exit. |
| `-q` | `psql -q` | Suppress startup noise and informational chatter. |
| `-t` | `psql -t` | Return tuples only, removing headers and footers from aligned output. |

## Authentication And Connection

`psql` connection behavior is a combination of client flags, libpq connection options, server-side `pg_hba.conf`, and server-side SSL configuration. A connection that "just works" on one host can fail on another because any one of those layers changed, so the safe pattern is to make host, port, database, role, timeout, and TLS expectations explicit.

### PostgreSQL | psql | connection strings and current authentication surface

This subsection shows the current lab's connection surface first and only then uses that surface to demonstrate explicit TCP connection strings. The current environment is intentionally convenient for a disposable lab, but that convenience should be documented as a lab condition rather than mistaken for PostgreSQL's general default.

#### Inspect the current listen, socket, and SSL settings

Run this before troubleshooting reachability or publishing any connection instructions. It is typically triggered by a new server build, a port-forwarding change, or confusion about why one client path uses a socket while another uses TCP. The command runs through `psql`, is read-only, and needs only a valid login path. Its purpose is to surface the server settings that explain which transport paths are even possible.

| Output field | Source expression | Unit / type | Meaning |
|---|---|---|---|
| `listen_addresses` | `current_setting('listen_addresses')` | `text` | The network interfaces on which PostgreSQL accepts TCP connections. |
| `port` | `current_setting('port')` | `text` | The server-side listener port. |
| `ssl_enabled` | `current_setting('ssl')` | `text` | Whether PostgreSQL server-side SSL is enabled. |
| `socket_dirs` | `current_setting('unix_socket_directories')` | `text` | The directory path used for Unix-domain sockets. |

*This command shows the active transport surface of the running PostgreSQL server.*

```powershell
docker exec stoxx-postgres psql -U postgres -d stoxx -P pager=off --csv -c "SELECT current_setting('listen_addresses') AS listen_addresses, current_setting('port') AS port, current_setting('ssl') AS ssl_enabled, current_setting('unix_socket_directories') AS socket_dirs;"
```

```text
listen_addresses,port,ssl_enabled,socket_dirs
*,5432,off,/var/run/postgresql
```

The server is listening on all container interfaces, on port `5432`, with Unix-domain sockets in `/var/run/postgresql`, and server-side SSL is currently disabled. That last fact becomes operationally important as soon as the client sets `sslmode=require` or anything stricter.

#### Show why loopback connections work without an interactive password in this lab

Run this when a lab connection succeeds more easily than expected and you need to prove whether the behavior comes from `pg_hba.conf` rather than from a hidden credential source. It is usually triggered by environment review, authentication debugging, or hardening work that needs a before-and-after baseline. The command runs against a system view, is read-only, and needs enough privileges to inspect server configuration metadata. Its purpose is to reveal the active authentication rules instead of inferring them from client symptoms.

| Output field | Source column | Unit / type | Meaning |
|---|---|---|---|
| `line_number` | `pg_hba_file_rules.line_number` | `integer` | The line number in `pg_hba.conf` that produced this rule. |
| `type` | `pg_hba_file_rules.type` | `text` | The rule class such as `local` or `host`. |
| `database` | `pg_hba_file_rules.database` | `text[]` | The database target list covered by the rule. |
| `user_name` | `pg_hba_file_rules.user_name` | `text[]` | The role target list covered by the rule. |
| `address` | `pg_hba_file_rules.address` | `text` | The client address range covered by a host rule. |
| `auth_method` | `pg_hba_file_rules.auth_method` | `text` | The authentication method PostgreSQL will apply if the rule matches. |

*This command reads the effective `pg_hba.conf` rules that explain the current lab's login behavior.*

```powershell
docker exec stoxx-postgres psql -U postgres -d stoxx -P pager=off -c "SELECT line_number, type, database, user_name, address, auth_method FROM pg_hba_file_rules ORDER BY line_number;"
```

```text
 line_number | type  |   database    | user_name |  address  |  auth_method  
-------------+-------+---------------+-----------+-----------+---------------
         117 | local | {all}         | {all}     |           | trust
         119 | host  | {all}         | {all}     | 127.0.0.1 | trust
         121 | host  | {all}         | {all}     | ::1       | trust
         124 | local | {replication} | {all}     |           | trust
         125 | host  | {replication} | {all}     | 127.0.0.1 | trust
         126 | host  | {replication} | {all}     | ::1       | trust
         128 | host  | {all}         | {all}     | all       | scram-sha-256
(7 rows)
```

The reason local socket and loopback TCP sessions connect so easily is visible directly in the rules: the lab allows `trust` for local and loopback paths, while all other network addresses fall through to `scram-sha-256`. That is a deliberate chapter-lab convenience, not a claim that production PostgreSQL should behave this way.

> [!warning]- Loopback trust is a lab-only convenience
>
> The current container intentionally allows `trust` on `local`, `127.0.0.1`, and `::1` so the chapter can run repeatable `psql` examples without interactive password prompts. That is convenient for a disposable single-user lab, but it is not the right authentication shape for shared hosts, shared networks, or any environment where network reachability should not equal database access.
>
> > [!danger] Widening trust turns reachability into access
> >
> > A broad `trust` rule removes credential verification completely. On any routable address range, that means the only thing protecting the database is network isolation.
> >
> > ```conf
> > host all all all trust
> > ```
>
> > [!success] Keep trust local or switch to password auth
> >
> > For disposable local labs, keeping `trust` limited to sockets and loopback is a reasonable tradeoff. For anything broader, require `scram-sha-256` or another deliberate authentication method.
> >
> > ```conf
> > local all all trust
> > host  all all 127.0.0.1/32 trust
> > host  all all ::1/128      trust
> > host  all all all          scram-sha-256
> > ```

#### Connect over TCP with an explicit libpq connection string

Run this when the goal is to make the connection target explicit in automation instead of relying on implicit socket defaults. It is typically triggered by host-to-container access, connection troubleshooting, or any script that should survive changes to `PGHOST`, `PGPORT`, or the current OS user name. The command runs through `psql`, is read-only, and needs a valid login path. Its purpose is to demonstrate the clean libpq pattern for naming host, port, database, role, timeout, and application identity in one place.

| Output field | Source expression | Unit / type | Meaning |
|---|---|---|---|
| `application_name` | `current_setting('application_name')` | `text` | The client-supplied application identity visible in server views and logs. |
| `client_addr` | `inet_client_addr()` | `inet` | The client IP address seen by the server for this session. |

*This command connects over TCP with an explicit libpq connection string and stamps the session with an application name.*

```powershell
docker exec stoxx-postgres bash -lc 'export PGPASSWORD="$POSTGRES_PASSWORD"; psql "host=127.0.0.1 port=5432 dbname=stoxx user=postgres application_name=psql_note02_connect_demo connect_timeout=3" -P pager=off -c "SELECT current_setting(''"'"'application_name'"'"''"'"') AS application_name, inet_client_addr() AS client_addr;"'
```

```text
     application_name     | client_addr 
--------------------------+-------------
 psql_note02_connect_demo | 127.0.0.1
(1 row)
```

The important part is not the query but the connection string shape. `host=127.0.0.1` forces TCP instead of the default local socket, `connect_timeout=3` bounds how long automation waits for reachability, and `application_name` makes the session identifiable in activity views and logs.

| Flag | Syntax | Description |
|---|---|---|
| `-h` | `psql -h 127.0.0.1` | Connect over TCP to the named host, or use a socket directory if the argument begins with a slash. |
| `-p` | `psql -p 5432` | Connect to the named TCP port or socket file extension. |
| `-U` | `psql -U postgres` | Use the named PostgreSQL role for login. |
| `-d` | `psql -d stoxx` | Connect to the named database. |
| `-w` | `psql -w` | Never prompt for a password, which is important for unattended jobs. |
| `-W` | `psql -W` | Force an early password prompt even if the server might not require one. |

### PostgreSQL | psql | password files and transport security

This subsection covers the client-side security boundary rather than the server-side role model. The lab still allows local trust, but the documented safe pattern needs to explain what happens once a password or TLS requirement enters the picture.

#### Verify the current TCP connection's SSL state

Run this when you need proof of whether a TCP client is actually using TLS rather than assuming encryption from the mere fact that a network connection succeeded. It is usually triggered by transport hardening, connection debugging, or a change to `sslmode`. The command runs through `psql`, is read-only, and needs a valid login path. Its purpose is to show what the server sees for the current session's SSL state.

| Output field | Source expression | Unit / type | Meaning |
|---|---|---|---|
| `client_addr` | `inet_client_addr()` | `inet` | The remote address seen by the server for this session. |
| `client_port` | `inet_client_port()` | `integer` | The client-side source port for the TCP session. |
| `using_ssl` | `pg_stat_ssl.ssl` | `boolean` | Whether this backend is using SSL/TLS. |

*This command opens a TCP session with libpq's default `sslmode=prefer` behavior and shows whether the current session actually negotiated SSL.*

```powershell
docker exec stoxx-postgres bash -lc 'export PGPASSWORD="$POSTGRES_PASSWORD"; psql "host=127.0.0.1 port=5432 dbname=stoxx user=postgres sslmode=prefer" -P pager=off -c "SELECT inet_client_addr() AS client_addr, inet_client_port() AS client_port, ssl.ssl AS using_ssl FROM pg_stat_ssl AS ssl WHERE ssl.pid = pg_backend_pid();"'
```

```text
 client_addr | client_port | using_ssl 
-------------+-------------+-----------
 127.0.0.1   |       36194 | f
(1 row)
```

The session is definitely TCP because `inet_client_addr()` and `inet_client_port()` are populated, but it is not encrypted because the server has `ssl = off`. That is fully consistent with libpq's documented default `sslmode=prefer`: try SSL first, then fall back to plain TCP if SSL is unavailable.

#### See how sslmode=require fails when server SSL is off

Run this any time the client has been told to require TLS and you want the failure mode to be explicit rather than inferred. It is typically triggered by hardening work, a new certificate rollout, or a suspicion that the client is silently falling back to plaintext. The command runs through `psql`, is read-only, and needs only the ability to attempt a connection. Its purpose is to show the exact connection failure and exit code that automation will see when TLS is mandatory but unavailable.

*This command requires SSL on a server that currently has `ssl = off`, then prints the resulting process exit code.*

```powershell
docker exec stoxx-postgres bash -lc 'export PGPASSWORD="$POSTGRES_PASSWORD"; psql "host=127.0.0.1 port=5432 dbname=stoxx user=postgres sslmode=require" -c "SELECT 1;"'; Write-Output "EXIT_CODE=$LASTEXITCODE"
```

```text
EXIT_CODE=2
psql: error: connection to server at "127.0.0.1", port 5432 failed: server does not support SSL, but SSL was required
```

This is the correct failure. The client did not silently downgrade the transport once `sslmode=require` was declared. In production, the stronger pattern is usually `sslmode=verify-full` plus a trusted root CA, because that verifies both encryption and server identity. The current lab cannot demonstrate that yet because the server is intentionally running without SSL.

## Script And Variable Execution

`psql` is both an interactive client and a non-interactive script runner. The right choice depends on whether the work is a one-off probe, a staged file, or a reusable batch with parameter substitution and meta-commands.

### PostgreSQL | psql | inline and file execution

This subsection shows the two primary non-interactive execution paths: `-c` for short diagnostics and `-f` for saved scripts. The safe boundary is to move into files as soon as the logic deserves version control, repeatability, or line-numbered error reporting.

#### Execute a one-off diagnostic with -c

Run this when the query is small, self-contained, and unlikely to be reused beyond the current check. It is typically triggered by quick health probes, inventory checks, and simple fact gathering during a troubleshooting session. The command runs through `psql`, is read-only in this example, and needs only a valid login path. Its purpose is to show the lightest-weight non-interactive execution form.

*This command runs a short SQL diagnostic inline and then exits immediately.*

```powershell
docker exec stoxx-postgres psql -U postgres -d stoxx -P pager=off -c "SELECT current_database() AS db_name, current_user AS role_name;"
```

```text
 db_name | role_name 
---------+-----------
 stoxx   | postgres
(1 row)
```

`-c` is the right tool when the SQL is short enough to stay readable on one line and the command does not need `psql` meta-commands. PostgreSQL documentation is explicit that each SQL string passed to `-c` is sent as one request, which matters when later automation mixes multiple statements or relies on transaction boundaries.

#### Execute a saved SQL script with -f

Run this when the logic deserves a file boundary, line-numbered errors, or multiple statements that should not live inside one long shell string. It is typically triggered by maintenance scripts, bootstrap routines, and any command that has graduated from ad-hoc diagnostics into repeatable operational work. The command runs through `psql`, is read-only in this example, and needs only a valid login path. Its purpose is to show the file-driven execution path that later backup, restore, and admin notes will use.

> [!info]- Script contents used for the live capture
>
> The file `/tmp/psql_note02_demo.sql` was staged inside the container for this note. Its contents are:
>
> ```sql
> SELECT current_database() AS database_name, current_user AS role_name;
> SELECT schemaname, tablename
> FROM pg_tables
> WHERE schemaname IN ('bronze','silver','gold')
> ORDER BY schemaname, tablename
> LIMIT 6;
> ```

*This command executes a saved SQL script with `-f` and returns both result sets in sequence.*

```powershell
docker exec stoxx-postgres psql -U postgres -d stoxx -P pager=off -f /tmp/psql_note02_demo.sql
```

```text
 database_name | role_name 
---------------+-----------
 stoxx         | postgres
(1 row)

 schemaname |     tablename     
------------+-------------------
 bronze     | dim_country
 bronze     | dim_index
 bronze     | eurostoxx50_ohlcv
 bronze     | index_dim
 bronze     | oil20_ohlcv
 bronze     | pulse
(6 rows)
```

`-f` is the better long-form boundary because `psql` can then report line numbers when the script fails, and the SQL itself can live in version control instead of in shell quoting. That is materially safer once the batch is longer than a simple diagnostic query.

| Flag | Syntax | Description |
|---|---|---|
| `-c` | `psql -c "SELECT ..."` | Execute one SQL command string or one backslash command and exit. |
| `-f` | `psql -f script.sql` | Execute commands from a file rather than from standard input. |
| `-X` | `psql -X` | Skip `~/.psqlrc`, which is safer for deterministic automation. |
| `-q` | `psql -q` | Suppress extra chatter for cleaner scripted output. |
| `-P` | `psql -P pager=off` | Set printing options from the command line for non-interactive runs. |

### PostgreSQL | psql | variables and meta-commands

This subsection covers the features that make `psql` more than a thin SQL pipe: backslash commands for client-side inspection and `\set` or `-v` variables for parameterized batches.

#### Show current connection metadata with \conninfo

Run this when session context matters more than query output, especially after a reconnect, a host change, or a shift from socket to TCP access. It is typically triggered by connection debugging or by a script that must prove which transport path is currently active. The command runs through `psql`, is read-only, and needs only a valid login path. Its purpose is to ask the client itself how it is connected instead of guessing from shell context.

*This command feeds the `\conninfo` meta-command into `psql` and prints the current connection path.*

```powershell
docker exec stoxx-postgres bash -lc "printf '\\conninfo\n' | psql -U postgres -d stoxx -P pager=off"
```

```text
You are connected to database "stoxx" as user "postgres" via socket in "/var/run/postgresql" at port "5432".
```

That single line is high-value operationally: it proves the session is using a Unix-domain socket, not TCP, which means client-side `sslmode` is irrelevant for this particular connection path and loopback `pg_hba.conf` rules are not what admitted the session.

#### Parameterize a batch with \set variables

Run this when a short batch needs a reusable parameter without hard-coding the same literal in several places. It is typically triggered by inventory scripts, repeatable demos, and operational commands that should stay human-readable while still accepting a few inputs. The command runs through `psql`, is read-only in this example, and needs only a valid login path. Its purpose is to demonstrate the client-side variable mechanism that later file-based scripts can reuse.

*This command feeds a small parameterized batch into `psql`, using `\set` to control the row limit.*

```powershell
@'
\set show_limit 3
SELECT symbol, date, close
FROM silver.stoxxusa50_ohlcv
ORDER BY date DESC, symbol
LIMIT :show_limit;
'@ | docker exec -i stoxx-postgres psql -U postgres -d stoxx -P pager=off
```

```text
 symbol |    date    | close  
--------+------------+--------
 AAPL   | 2026-04-07 |  253.5
 ABBV   | 2026-04-07 | 206.37
 AMAT   | 2026-04-07 | 354.31
(3 rows)
```

This is client-side substitution, not server-side prepared-parameter binding. That distinction matters because `\set` is excellent for small operational scripts, but application code should still use driver parameters rather than string substitution.

| Flag | Syntax | Description |
|---|---|---|
| `-v` | `psql -v name=value` | Set a `psql` variable from the command line. |
| `-a` | `psql -a` | Echo all nonempty input lines from a script. |
| `-e` | `psql -e` | Echo SQL commands sent to the server. |
| `-E` | `psql -E` | Echo the SQL generated by backslash inspection commands such as `\d`. |
| `-L` | `psql -L session.log` | Write all session output to a log file as well as standard output. |

## Error Handling And Exit Codes

`psql` is safe in automation only when its failure boundary is explicit. PostgreSQL documentation defines the key exit-code split clearly: normal success returns `0`, fatal client or connection problems return `1` or `2` depending on the case, and script termination caused by `ON_ERROR_STOP` returns `3`.

| Exit code | Meaning | When it appears in practice |
|---|---|---|
| `0` | Normal success | The command connected, executed, and did not hit a fatal client-side failure. |
| `1` | Fatal `psql`/script failure | A non-connection failure stopped the run, such as a failed single-transaction batch. |
| `2` | Connection failure | `psql` could not establish the session it was asked to open. |
| `3` | Script stopped by `ON_ERROR_STOP` | A non-interactive script hit a SQL error and `psql` was explicitly told to stop immediately. |

### PostgreSQL | psql | fail-fast behavior

This subsection demonstrates the exact default and fail-fast behaviors that scheduled jobs depend on. The distinction is not academic: a script that continues after an early error can leave the database in a partially applied state while still looking superficially successful from the shell.

#### See the default continue-after-error behavior

Run this when validating how `psql` behaves on errors before wiring it into automation. It is typically triggered by the first draft of a script runner, by a production-hardening review, or by a suspicion that a job kept going after an early failure. The command runs through `psql`, is read-only in the sense that it only executes selects here, and needs only a valid login path. Its purpose is to prove that the default non-interactive behavior is continuation, not fail-fast.

*This command sends three statements to `psql`, with an error in the middle, and then prints the process exit code seen by PowerShell.*

```powershell
@'
SELECT 1 AS before_error;
SELECT 1/0;
SELECT 2 AS after_error;
'@ | docker exec -i stoxx-postgres psql -U postgres -d stoxx -P pager=off; Write-Output "EXIT_CODE=$LASTEXITCODE"
```

```text
 before_error 
--------------
            1
(1 row)

 after_error 
-------------
           2
(1 row)

EXIT_CODE=0
ERROR:  division by zero
```

The middle statement failed, but `psql` kept processing the rest of the script and the process still exited `0`. That is exactly why unattended jobs should not rely on default behavior when partial execution would be unsafe.

#### Stop immediately on the first SQL error with ON_ERROR_STOP

Run this as soon as a non-interactive script can no longer tolerate partial progress. It is typically triggered by maintenance automation, deployment scripts, or multi-step admin tasks where "continue after error" is operationally wrong. The command runs through `psql`, is read-only in this example, and needs only a valid login path. Its purpose is to convert SQL errors into immediate script termination with a documented non-zero exit code.

*This command repeats the same three-statement batch, but enables `ON_ERROR_STOP` so the run aborts at the first error.*

```powershell
@'
SELECT 1 AS before_error;
SELECT 1/0;
SELECT 2 AS after_error;
'@ | docker exec -i stoxx-postgres psql -U postgres -d stoxx -v ON_ERROR_STOP=1 -P pager=off; Write-Output "EXIT_CODE=$LASTEXITCODE"
```

```text
 before_error 
--------------
            1
(1 row)

EXIT_CODE=3
ERROR:  division by zero
```

This is the correct automation boundary. The second query fails, the third query is never executed, and the process exits with `3`, which PostgreSQL documentation reserves for `ON_ERROR_STOP`-driven script termination.

#### Wrap a non-interactive run in one transaction with -1

Run this when a batch should either apply completely or roll back completely, and when every statement in the batch is valid inside a transaction block. It is typically triggered by bootstrap scripts, schema changes, and small maintenance routines where half-applied state is unacceptable. The command runs through `psql`, is state-changing by design, and therefore belongs only in controlled admin workflows. Its purpose is to demonstrate how `-1` gives a file-driven run an all-or-nothing boundary.

*This command starts a single-transaction batch that creates a demo table, inserts one row, then deliberately violates the primary key and verifies that the whole batch rolled back.*

```powershell
docker exec stoxx-postgres psql -U postgres -d stoxx -v ON_ERROR_STOP=1 -1 -c "DROP TABLE IF EXISTS demo_stc.psql_tx_demo; CREATE TABLE demo_stc.psql_tx_demo(id int primary key); INSERT INTO demo_stc.psql_tx_demo VALUES (1); INSERT INTO demo_stc.psql_tx_demo VALUES (1);"; Write-Output "EXIT_CODE=$LASTEXITCODE"; docker exec stoxx-postgres psql -U postgres -d stoxx -P pager=off -c "SELECT to_regclass('demo_stc.psql_tx_demo') AS regclass_name, COUNT(*) FILTER (WHERE table_schema = 'demo_stc' AND table_name = 'psql_tx_demo') AS table_exists FROM information_schema.tables WHERE table_schema = 'demo_stc' AND table_name = 'psql_tx_demo';"
```

```text
DROP TABLE
CREATE TABLE
INSERT 0 1
EXIT_CODE=1
 regclass_name | table_exists 
---------------+--------------
               |            0
(1 row)

NOTICE:  table "psql_tx_demo" does not exist, skipping
ERROR:  duplicate key value violates unique constraint "psql_tx_demo_pkey"
DETAIL:  Key (id)=(1) already exists.
```

Even though the table was created and the first insert succeeded temporarily, the duplicate-key failure caused the entire `-1` batch to roll back. The follow-up query proves that no table remains. That is the right behavior for schema and data-change bundles that should never land partially.

| Flag | Syntax | Description |
|---|---|---|
| `-v ON_ERROR_STOP=1` | `psql -v ON_ERROR_STOP=1` | Stop non-interactive processing immediately on the first SQL error. |
| `-1` | `psql -1 -f script.sql` | Wrap all `-c` and `-f` work in one explicit transaction. |
| `-s` | `psql -s` | Prompt before each command, which is useful for debugging scripts interactively. |
| `-b` | `psql -b` | Echo failed SQL commands to standard error. |

## Output Shaping

The same result set can be right or wrong depending on the consumer. Human readers usually want aligned output or expanded mode; shell pipelines want delimiter-separated rows without headers or footers; file-oriented automation often wants CSV.

### PostgreSQL | psql | delimited and machine-readable output

This subsection covers the output modes most likely to show up in automation, notebook capture, and quick shell pipelines.

#### Emit CSV output

Run this when the result set is meant to flow into a file, a parser, or another tool that already expects comma-separated values. It is typically triggered by export steps, notebook ingestion, or quick comparisons against spreadsheet-style outputs. The command runs through `psql`, is read-only here, and needs only a valid login path. Its purpose is to show the cleanest built-in machine-readable export format that `psql` offers without custom post-processing.

*This command emits the latest three rows from `silver.stoxxusa50_ohlcv` in CSV form.*

```powershell
docker exec stoxx-postgres bash -lc 'export PGPASSWORD="$POSTGRES_PASSWORD"; psql -w "host=127.0.0.1 port=5432 dbname=stoxx user=postgres application_name=psql_csv_demo" --csv -c "SELECT symbol, date, close FROM silver.stoxxusa50_ohlcv ORDER BY date DESC, symbol LIMIT 3;"'
```

```text
symbol,date,close
AAPL,2026-04-07,253.5
ABBV,2026-04-07,206.37
AMAT,2026-04-07,354.31
```

`--csv` is the lowest-friction option when the downstream consumer truly wants CSV. It is better than hand-assembling delimiters because quoting rules, commas inside values, and header handling stay delegated to the client.

#### Emit delimiter-separated rows without headers or footers

Run this when the output is meant for a shell pipeline rather than for a spreadsheet or a human reader. It is typically triggered by quick inspection, `xargs`-style processing, or scripts that want rows in a compact predictable form. The command runs through `psql`, is read-only here, and needs only a valid login path. Its purpose is to show the classic `-A` plus custom separator pattern.

*This command emits three rows in unaligned, pipe-separated, tuples-only form.*

```powershell
docker exec stoxx-postgres psql -U postgres -d stoxx -A -F '|' -t -c "SELECT symbol, date, close FROM silver.stoxxusa50_ohlcv ORDER BY date DESC, symbol LIMIT 3;"
```

```text
AAPL|2026-04-07|253.5
ABBV|2026-04-07|206.37
AMAT|2026-04-07|354.31
```

This is the right shape when a shell or another program is the next consumer. `-A` removes alignment padding, `-F` sets the delimiter, and `-t` removes headers and footers so the output is just row payload.

| Flag | Syntax | Description |
|---|---|---|
| `--csv` | `psql --csv` | Emit CSV output instead of aligned tables. |
| `-A` | `psql -A` | Switch to unaligned output mode. |
| `-F` | `psql -F '|'` | Set the field separator for unaligned output. |
| `-R` | `psql -R $'\0'` | Set the record separator for unaligned output. |
| `-t` | `psql -t` | Suppress headers and row-count footers. |

### PostgreSQL | psql | expanded and footer control

This subsection covers the human-reader modes that become useful once aligned tables start getting too wide or when the default footer is more noise than signal.

#### Use expanded mode for wide rows

Run this when a row has enough columns that aligned-table output is harder to read than a record-per-block layout. It is typically triggered by inspection of configuration rows, wide metadata output, or a single-row diagnostic result that needs visual clarity more than dense tabular formatting. The command runs through `psql`, is read-only, and needs only a valid login path. Its purpose is to show the built-in wide-row format instead of relying on manual reformatting.

*This command prints a single OHLCV row in expanded mode.*

```powershell
docker exec stoxx-postgres psql -U postgres -d stoxx -x -P pager=off -c "SELECT symbol, date, close, volume FROM silver.stoxxusa50_ohlcv ORDER BY date DESC, symbol LIMIT 1;"
```

```text
-[ RECORD 1 ]------
symbol | AAPL
date   | 2026-04-07
close  | 253.5
volume | 60820961
```

Expanded mode is better than horizontal scrolling once the row is conceptually "one object" rather than "many comparable rows". It is especially useful in admin notes where one backend, one setting row, or one lock row is being inspected closely.

#### Remove the footer while keeping aligned output

Run this when you still want aligned tables but do not want the `(n rows)` footer mixed into downstream capture or note rendering. It is typically triggered by documentation capture, markdown conversion, or a short aligned output that looks cleaner without the final count line. The command runs through `psql`, is read-only, and needs only a valid login path. Its purpose is to show that `psql` footer control does not require abandoning aligned output entirely.

*This command keeps aligned formatting but removes the default row-count footer.*

```powershell
docker exec stoxx-postgres bash -lc 'export PGPASSWORD="$POSTGRES_PASSWORD"; psql -w "host=127.0.0.1 port=5432 dbname=stoxx user=postgres" -P footer=off -c "SELECT schemaname, tablename FROM pg_tables WHERE schemaname = ''gold'' ORDER BY tablename;"'
```

```text
 schemaname |     tablename     
------------+-------------------
 gold       | index_performance
 gold       | scores_daily
 gold       | scores_quarterly
```

This is a good compromise when humans still need to read the result directly but the extra footer line would create cleanup work for the next tool or the next markdown capture step.

| Flag | Syntax | Description |
|---|---|---|
| `-x` | `psql -x` | Turn on expanded output mode. |
| `-P footer=off` | `psql -P footer=off` | Suppress the default row-count footer while keeping the chosen output format. |
| `-H` | `psql -H` | Emit HTML table output. |
| `-o` | `psql -o result.txt` | Write query output to a file or pipe. |

## Local Admin Access

SQL Server has a Dedicated Admin Connection. PostgreSQL does not have an exact DAC equivalent. The nearest operational alternatives are local OS-user access to the running cluster and offline single-user mode when the postmaster is not running and catalog-level recovery work is required.

### PostgreSQL | local admin | container and recovery paths

This subsection documents the two break-glass patterns that matter in this chapter's Docker lab: enter the container as the `postgres` OS user and inspect the live cluster, or use `postgres --single` only when the cluster is intentionally offline.

#### Check server status from inside the container as the postgres OS user

Run this when the normal SQL session path is not the question and the actual question is whether the postmaster is alive. It is typically triggered by a startup failure, a health-check discrepancy, or the need to prove the live data directory and process state before doing anything more invasive. The command runs in the container shell, is read-only, and must run as the unprivileged `postgres` OS user because PostgreSQL server-control tools refuse root. Its purpose is to verify that the postmaster is running from the server side rather than from a client symptom.

*This command uses `pg_ctl status` inside the container as the `postgres` OS user.*

```powershell
docker exec -u postgres stoxx-postgres bash -lc "/usr/lib/postgresql/16/bin/pg_ctl -D /var/lib/postgresql/data status"
```

```text
pg_ctl: server is running (PID: 1)
/usr/lib/postgresql/16/bin/postgres
```

That output proves the cluster is alive and identifies the postmaster binary currently serving the data directory. It is the PostgreSQL equivalent of checking the actual engine state before trusting any higher-level symptom.

#### See why single-user mode is an offline recovery path

Run this only when documenting or rehearsing disaster-recovery procedure boundaries. It is typically triggered by catalog-repair planning, not by ordinary troubleshooting, because single-user mode is not meant to coexist with a running multi-user postmaster. The command is state-capable in general, though this example only attempts a read. It must run as the `postgres` OS user and must target the data directory directly. Its purpose is to show the guardrail that prevents operators from treating single-user mode as a second normal connection path.

*This command attempts to start PostgreSQL in single-user mode while the normal postmaster is still running.*

```powershell
docker exec -u postgres stoxx-postgres bash -lc "printf 'SELECT current_database();\n' | /usr/lib/postgresql/16/bin/postgres --single -D /var/lib/postgresql/data stoxx"
```

```text
2026-04-18 21:44:24.612 UTC [4559] FATAL:  lock file "postmaster.pid" already exists
2026-04-18 21:44:24.612 UTC [4559] HINT:  Is another postmaster (PID 1) running in data directory "/var/lib/postgresql/data"?
```

This is the correct refusal. Single-user mode is an offline recovery tool. If the normal postmaster is already serving the cluster, PostgreSQL blocks the second startup by design. In real recovery work the multi-user server is stopped first, and only then is single-user mode considered.

| Flag | Syntax | Description |
|---|---|---|
| `docker exec -u postgres` | `docker exec -u postgres ...` | Run the command as the container's `postgres` OS user instead of as root. |
| `pg_ctl -D` | `pg_ctl -D /var/lib/postgresql/data status` | Point `pg_ctl` at the target data directory. |
| `postgres --single` | `postgres --single -D ... stoxx` | Start PostgreSQL in single-user mode against one database. |
| `postgres -D` | `postgres --single -D /var/lib/postgresql/data stoxx` | Specify the cluster data directory for direct server startup. |

## psql Flag Reference

This final section is the compact lookup surface once the behavior above is understood.

### Login and connection

| Flag | Syntax | Description |
|---|---|---|
| `-d` | `psql -d stoxx` | Connect to the named database. |
| `-h` | `psql -h 127.0.0.1` | Connect to the named host, or to a socket directory if the value begins with a slash. |
| `-p` | `psql -p 5432` | Connect to the named TCP port or socket file extension. |
| `-U` | `psql -U postgres` | Use the named PostgreSQL role for login. |
| `-w` | `psql -w` | Never prompt for a password. |
| `-W` | `psql -W` | Force an early password prompt. |
| `-X` | `psql -X` | Do not read `~/.psqlrc`, which is safer for deterministic automation. |

### Execution and scripting

| Flag | Syntax | Description |
|---|---|---|
| `-c` | `psql -c "SELECT 1"` | Execute one SQL string or one backslash command and exit. |
| `-f` | `psql -f script.sql` | Execute commands from a file. |
| `-v` | `psql -v name=value` | Set a `psql` variable from the command line. |
| `-1` | `psql -1 -f script.sql` | Wrap all `-c` and `-f` work in one transaction. |
| `-a` | `psql -a` | Echo all nonempty input lines from the script. |
| `-e` | `psql -e` | Echo SQL sent to the server. |
| `-E` | `psql -E` | Echo the SQL generated by internal backslash commands. |
| `-s` | `psql -s` | Prompt before each query in single-step mode. |
| `-S` | `psql -S` | End SQL commands at newline instead of semicolon. |

### Output formatting

| Flag | Syntax | Description |
|---|---|---|
| `--csv` | `psql --csv` | Emit CSV output. |
| `-A` | `psql -A` | Use unaligned output mode. |
| `-F` | `psql -F '|'` | Set the field separator for unaligned output. |
| `-R` | `psql -R '\0'` | Set the record separator for unaligned output. |
| `-t` | `psql -t` | Suppress headers and footers. |
| `-x` | `psql -x` | Turn on expanded output. |
| `-P` | `psql -P footer=off` | Set a `\pset` printing option such as footer control. |
| `-o` | `psql -o result.txt` | Write output to a file or pipe. |
| `-L` | `psql -L session.log` | Copy all session output to a log file. |
| `-q` | `psql -q` | Run quietly with less client chatter. |
