---
title: "02 - sqlcmd Connection and Usage"
tags:
  - sql-server
  - administration
  - sqlcmd
aliases:
  - sqlcmd
  - SQL Server command-line client
description: "Production sqlcmd usage for connection testing, authentication, encryption, script and variable execution, exit-code handling, delimited output, and Dedicated Admin Connection, grounded on the local stoxx instance."
created: 2026-03-22
updated: 2026-04-11
status: complete
---

# sqlcmd Connection and Usage

`sqlcmd` is the primary SQL Server command-line client for automation and emergency operations. It gives you a direct, scriptable path into SQL Server without SSMS, which makes it the tool of record for backup scripts, restore drills, health checks, deployments, and last-mile diagnostics whenever you need an exact exit code and a reproducible command line. This note covers the six operational surfaces that matter most in production: identifying the installed client, authenticating safely, shaping encryption, running scripts with variables, trapping errors with correct exit codes, and reaching the server through the Dedicated Admin Connection when the normal workload endpoint is unresponsive. Every command is captured live against the local `stoxx` Developer-Edition instance running in Docker.

> [!abstract] What this note covers
>
> - **Client identification.** Classic ODBC `sqlcmd` vs `go-sqlcmd`, plus the PowerShell `Invoke-Sqlcmd` alternative.
> - **Authentication.** SQL auth, `SQLCMDPASSWORD` env var, Windows integrated, Microsoft Entra ID (`-G`), and Always Encrypted (`-g`).
> - **Encryption.** `-N s|m|o` strict/mandatory/optional modes, certificate trust (`-C`), and hostname-in-certificate override (`-F`).
> - **Script execution.** Inline `-Q`, file `-i`, SQLCMD interactive commands (`:r`, `:setvar`, `:Listvar`, `:Connect`, `:!!`).
> - **Error handling.** `-b` fail-fast, `-V` severity floor, `-r 0|1` stderr routing, and `$LASTEXITCODE` verification.
> - **Output shaping.** `-s` delimiter, `-W` trim, `-h -1` headerless, `-y`/`-Y` column widths, `-o` file redirect.
> - **Dedicated Admin Connection.** Local-only DAC listener, `remote admin connections` sp_configure, Docker-exec pattern, and `sys.dm_exec_connections.endpoint_id = 1` verification.

---

## Current Environment

Before automating anything against a SQL Server host, confirm which `sqlcmd` variant is actually installed and which PowerShell alternatives exist. The command surface is similar between variants but not identical, and writing automation for the wrong client is a common cause of flag-mismatch incidents on hand-over.

> [!abstract] Identify the client before writing automation
>
> - **Two sqlcmd binaries.** Classic ODBC `sqlcmd` ships with SQL Server tooling; `go-sqlcmd` is a standalone cross-platform rewrite.
> - **PowerShell alternative.** `Invoke-Sqlcmd` from the legacy `SQLPS` module (ships with SQL Server) or the modern `SqlServer` module (PowerShell Gallery).
> - **Version matters.** Flags and defaults change between releases — `-N` default shifted from `o` to `m` in SQL Server 2025, `go-sqlcmd` ignores `-I`/`-M`/`-R` entirely, and Microsoft Entra flows require recent ODBC drivers.
> - **Goal of this section.** Capture the exact binary, variant, and module state of the current host so later automation knows which flag surface to rely on.

> [!info] Two sqlcmd variants coexist in the Microsoft ecosystem
>
> Microsoft ships two different binaries under the name `sqlcmd`:
>
> - **`sqlcmd` (ODBC)** — the legacy, platform-aligned client that ships with SQL Server, the Microsoft Command Line Utilities, and the `mssql-tools` package on Linux. It uses the Microsoft ODBC driver and implements the historical `-?` flag surface.
> - **`sqlcmd` (Go)** — also known as `go-sqlcmd`. A standalone cross-platform tool based on the `go-mssqldb` driver, distributed independently of SQL Server. It adds modern subcommands (`--help`), new Microsoft Entra flows (`--authentication-method`), vertical output (`--vertical`), and several breaking changes from the ODBC flag surface.
>
> On a given host you can have both installed; the one first on `PATH` wins. Check the binary *before* writing automation, not after.

### SQL Server | sqlcmd | client variants

This subsection verifies which client is installed on the current machine, decodes the banner to confirm the variant, and captures the full flag surface for reference.

#### Identify the installed sqlcmd binary

**When to run:** during initial environment validation, or after installing or upgrading SQL Server tooling.
**Trigger:** a new workstation, new build agent, or a ticket that reports "works on my machine" behavior diverging between two hosts.
**Context:** runs in any OS shell. Read-only. No permissions required.
**Purpose:** determine whether this host ships the ODBC `sqlcmd` or the Go `go-sqlcmd`, and record the exact version for reproducible automation.

> [!info]- How to read the banner
>
> The `-?` banner tells you three things the command line does not:
>
> - **Copyright line.** `Microsoft (R) SQL Server Command Line Tool` with a `Version x.y.z.w NT` string indicates the classic ODBC client. `Version: 1.x.y` (short form, no `NT` suffix) indicates `go-sqlcmd`.
> - **Usage block shape.** The ODBC client emits one-line grouped flag clusters ending with `[-? show syntax summary]`. `go-sqlcmd` emits a `--help` menu with subcommands (`install`, `create`, `query`, etc.) when invoked with `--help`, and prints an ODBC-compatible banner when invoked with `-?`.
> - **Flag availability.** Some flags exist only on one variant (`--vertical`, `--authentication-method`, `--driver-logging-level` for Go; `-R`, `-I`, `-M` for ODBC-only behavior).
>
> *This command prints the installed sqlcmd banner and flag surface.*
>
```powershell
sqlcmd -?
```

```text
Microsoft (R) SQL Server Command Line Tool
Version 17.0.1000.7 NT
Copyright (C) 2025 Microsoft Corporation. All rights reserved.

usage: Sqlcmd            [-U login id]          [-P password]
  [-S server]            [-H hostname]          [-E trusted connection]
  [-N[s|m|o] Encrypt Connection]
  [-C Trust Server Certificate]
  [-F Hostname in certificate]
  [-d use database name] [-l login timeout]     [-t query timeout]
  [-h headers]           [-s colseparator]      [-w screen width]
  [-a packetsize]        [-e echo input]        [-I Enable Quoted Identifiers]
  [-c cmdend]            [-L[c] list servers[clean output]]
  [-q "cmdline query"]   [-Q "cmdline query" and exit]
  [-m errorlevel]        [-V severitylevel]     [-W remove trailing spaces]
  [-u unicode output]    [-r[0|1] msgs to stderr]
  [-i inputfile]         [-o outputfile]        [-z new password]
  [-f <codepage> | i:<codepage>[,o:<codepage>]] [-Z new password and exit]
  [-k[1|2] remove[replace] control characters]
  [-y variable length type display width]
  [-Y fixed length type display width]
  [-p[1] print statistics[colon format]]
  [-R use client regional setting]
  [-K application intent]
  [-M multisubnet failover]
  [-b On error batch abort]
  [-v var = "value"...]  [-A dedicated admin connection]
  [-X[1] disable commands, startup script, environment variables [and exit]]
  [-x disable variable substitution]
  [-j Print raw error messages]
  [-g enable column encryption]
  [-G use Microsoft Entra ID for authentication]
  [-? show syntax summary]
```

*This is the classic Microsoft `sqlcmd` (ODBC) client, version `17.0.1000.7 NT`, shipped as part of the Microsoft Command Line Utilities 17. Automation written against this host should assume ODBC semantics — in particular, the `-N` flag takes a single-character suboption (`s`/`m`/`o`) and `-I` enables quoted identifiers (Go ignores `-I` because quoted identifiers are always on).*

#### Compare classic sqlcmd (ODBC) vs go-sqlcmd

**When to run:** before porting automation between hosts, when investigating a flag that behaves differently across two hosts, or before adopting a new Microsoft Entra authentication method on Azure SQL.
**Trigger:** a script that works on one host fails on another with "`Unknown Option`" or unexpected encryption behavior.
**Context:** reference material, not a command. Applies to both Windows and Linux operators.
**Purpose:** avoid mixing flags from the two variants in the same script.

The behavioral deltas below are the ones that bite most often in real deployments. The full back-compat tracker lives on the [go-sqlcmd GitHub discussion](https://github.com/microsoft/go-sqlcmd/discussions/292).

| Topic | `sqlcmd` (ODBC) | `sqlcmd` (Go / `go-sqlcmd`) |
|---|---|---|
| Version probe | `sqlcmd -?` banner | `sqlcmd --version` prints short version (`Version: 1.8.2`) |
| `-N` default | `m` (mandatory) in SQL Server 2025; `o` (optional) in 2022 and earlier | Negotiates without validating cert if neither `-N` nor `-C` is supplied |
| `-I` (quoted identifiers) | Enables quoted identifiers | **Ignored.** Quoted identifiers are always on; use `SET QUOTED_IDENTIFIER OFF` in script if you need the legacy behavior |
| `-M` (multi-subnet failover) | Opt-in flag | **Ignored.** Multi-subnet failover is always enabled |
| `-R` (client regional settings) | Localizes numeric/currency/date columns to client locale | **Ignored.** Go runtime does not expose user locale |
| `-r` (stderr redirection) | `-r`, `-r0`, `-r1` all valid | Requires the explicit `0` or `1` argument |
| Microsoft Entra auth | `-G` alone (one method) | `-G` plus `--authentication-method` with six methods (`ActiveDirectoryDefault`, `ActiveDirectoryPassword`, `ActiveDirectoryIntegrated`, `ActiveDirectoryInteractive`, `ActiveDirectoryServicePrincipal`, `ActiveDirectoryManagedIdentity`) |
| Protocol selection | ODBC stack only | `lpc:` (shared memory, local), `np:` (named pipes), `tcp:` prefixes on the server name |
| Output format | Tabular only | `--vertical` prints one column per line; `SQLCMDFORMAT` scripting variable supported |
| `:EXIT(query)` | Query can span multiple lines | Must fit on one line |
| Always Encrypted (`-g`) | Supported (Windows cert store only) | Not yet implemented at full parity |
| Driver tracing | Not available | `--driver-logging-level 64` prints `go-mssqldb` traces |

### SQL Server | sqlcmd | PowerShell alternatives

The PowerShell `Invoke-Sqlcmd` cmdlet is the object-oriented alternative to `sqlcmd.exe`. It returns typed `DataRow` objects instead of text, integrates with PowerShell pipelines, and is often the better choice when the downstream consumer is itself PowerShell.

#### Check whether Invoke-Sqlcmd is available

**When to run:** during environment validation, or before writing a PowerShell-first automation that needs typed result sets.
**Trigger:** a PowerShell script that currently shells out to `sqlcmd.exe` and has to reparse text, or a new operator onboarding.
**Context:** runs in any PowerShell session. Read-only. No permissions required.
**Purpose:** determine which SQL PowerShell module is installed and whether `Invoke-Sqlcmd` is available at all.

> [!info]- Two modules provide Invoke-Sqlcmd
>
> Historically, SQL Server provided two different PowerShell modules, and at most one `Invoke-Sqlcmd` cmdlet wins on the session `PATH`:
>
> - **`SQLPS`** — the legacy module, shipped with SQL Server 2012 through 2019 tooling. It lives under `C:\Program Files\Microsoft SQL Server\<version>\Tools\PowerShell\Modules\SQLPS` and is auto-discoverable in Windows PowerShell 5.1. It is deprecated but still functional. It **does not** expose `-TrustServerCertificate`, `-AccessToken`, or modern Microsoft Entra flows.
> - **`SqlServer`** — the modern module, distributed through the PowerShell Gallery, maintained independently of the SQL Server release cadence. It supersedes `SQLPS` and adds `-TrustServerCertificate`, `-AccessToken`, `-Encrypt`, richer `-ApplicationIntent` handling, and Microsoft Entra authentication. Install with `Install-Module -Name SqlServer -Scope CurrentUser` and `Update-Module SqlServer` to stay current.
>
> *This command reports whether `Invoke-Sqlcmd` is installed and which module provides it.*
>
```powershell
if (Get-Command Invoke-Sqlcmd -ErrorAction SilentlyContinue) {
    Get-Command Invoke-Sqlcmd | Select-Object Name, Source, Version
} else {
    [pscustomobject]@{ Name = 'Invoke-Sqlcmd'; Source = 'Not installed' }
}
```

| Name | Source | Version |
|---|---|---|
| Invoke-Sqlcmd | SQLPS | 17.0 |

*`Invoke-Sqlcmd` is available on this host via the legacy `SQLPS` module. It is sufficient for SQL-authenticated local automation, but it lacks the `-TrustServerCertificate` switch that the modern `SqlServer` module exposes. For automation that needs to negotiate TLS explicitly, or to talk to Azure SQL with Microsoft Entra ID, install the modern module from the PowerShell Gallery.*

#### Install the modern SqlServer PowerShell module

**When to run:** when the current host only has `SQLPS`, or when Microsoft Entra, `-AccessToken`, or strict encryption is required from a PowerShell workflow.
**Trigger:** a ticket that needs `Invoke-Sqlcmd -TrustServerCertificate` or typed-object results for pipeline consumers, or a migration from plain-text `sqlcmd.exe` shell-outs.
**Context:** runs in Windows PowerShell 5.1 or PowerShell 7. Writes to the user's module path under `CurrentUser` scope (no admin privileges). The `SqlServer` module loads side-by-side with `SQLPS` and takes precedence when both are present.
**Purpose:** upgrade the session to the supported, actively-maintained SQL PowerShell module without affecting other users on the machine.

> [!tip] Prefer CurrentUser scope on shared hosts
>
> Installing to `-Scope CurrentUser` avoids touching the system module path, keeps the install auditable per user, and avoids requiring administrator rights. On build agents where module versions must be pinned, capture the installed version in a manifest after the install step.

*This command installs the modern `SqlServer` module from the PowerShell Gallery into the current user's module path.*

```powershell
Install-Module -Name SqlServer -Scope CurrentUser -AllowClobber -Force
Get-Module -ListAvailable -Name SqlServer |
    Select-Object Name, Version, ModuleBase |
    Format-Table -AutoSize
```

```text
Name      Version    ModuleBase
----      -------    ----------
SqlServer 22.x.x     C:\Users\<you>\Documents\PowerShell\Modules\SqlServer\22.x.x
```

*After installation, `Invoke-Sqlcmd` from the `SqlServer` module takes precedence over the legacy `SQLPS` version because the `CurrentUser` module path is resolved before the system-wide SQL Server tooling path. Subsequent sessions expose `-TrustServerCertificate`, `-AccessToken`, and the full modern parameter set.*

---

## Authentication And Connection

This section covers the three authentication modes you realistically meet on SQL Server: SQL logins, Windows integrated auth, and Microsoft Entra ID against Azure SQL Database. It also covers TLS encryption choices, because authentication and transport security are typically configured on the same command line.

> [!abstract] Authentication decision guide
>
> - **Local dev, CI lab, or disconnected development.** SQL authentication with `SQLCMDPASSWORD` env var. Never hardcode `-P` in scripts.
> - **Domain-joined Windows host against on-prem SQL Server.** Windows integrated auth (`-E`). Falls through Kerberos or NTLM automatically.
> - **Azure SQL Database / Managed Instance / Synapse.** Microsoft Entra ID (`-G`), with the specific method chosen via `--authentication-method` on go-sqlcmd or implicitly by the presence of `-U`/`-P` on ODBC `sqlcmd`.
> - **Always Encrypted columns.** Add `-g` on Windows where the master keys live in the Windows Certificate Store.

### SQL Server | sqlcmd | SQL authentication

SQL authentication is the simplest path to prove connectivity. Its footgun is credential exposure: hardcoding `-P "..."` leaks the password into shell history, process lists, CI logs, and any crash dumps the process generates. Every SQL-auth example in this section demonstrates the safe `SQLCMDPASSWORD` environment-variable pattern.

#### Connect with a SQL login and run a one-shot query

**When to run:** during routine automation, scripted health checks, backup scripts, or when proving connectivity to a newly-deployed instance.
**Trigger:** first-time connectivity check for a new server, a post-migration validation step, or the entry point of a deployment pipeline.
**Context:** runs in any shell. Read-only for the `SELECT DB_NAME()` probe. Requires a valid SQL login with at least `CONNECT` permission on the target database.
**Purpose:** prove login success, network reachability, SQL execution, and database targeting in one short command.

> [!warning] Hardcoding -P leaks credentials
>
> Passing `-P "<password>"` on the command line exposes the password to every process inspection tool on the host (`ps`, `Get-CimInstance Win32_Process`, CI log captures, crash dumps) and any shell history that records the command.
>
> - Any user on the host can read it from `/proc/<pid>/cmdline` (Linux) or via `Get-CimInstance` (Windows).
> - CI systems frequently dump command lines to build logs, which then get indexed by log aggregation tools.
> - Shell history (`~/.bash_history`, PowerShell `PSReadLine` history) persists the password across reboots.

> [!success] Pass the password through SQLCMDPASSWORD
>
> Set the `SQLCMDPASSWORD` environment variable before invoking `sqlcmd`. The client reads it automatically when `-U` is present but `-P` is not. The variable lives only inside the current process tree and never appears on the command line. See the next H4 for the full pattern.

> [!info]- Flag breakdown for the minimum viable connection
>
> - `-S localhost,1434` selects the server and TCP port. `localhost,1434` targets the Docker-mapped port on the host. Port separator is a comma, not a colon.
> - `-U sa` provides the SQL login name.
> - `-P "EsgDev2026Pass1"` is the legacy insecure form — it remains here only so the example is runnable end-to-end against a throwaway dev instance. Production automation must use `SQLCMDPASSWORD`.
> - `-d master` sets the default database context for the session.
> - `-C` instructs the client to trust the server certificate without validation. On the local Docker instance this is required because the server uses a self-signed certificate. In production, prefer `-N s` with a valid cert chain and drop `-C`.
> - `-Q "..."` executes one batch and exits immediately. The alternative `-q` executes the query and stays in interactive mode.
> - `SELECT DB_NAME()` is the cheapest possible side-effect-free probe that proves execution and database context.
>
> *This command opens a SQL-authenticated session, executes a probe query, and exits.*
>
```powershell
sqlcmd -S localhost,1434 -U sa -P "EsgDev2026Pass1" -d master -C -Q "SELECT DB_NAME() AS current_database;"
```

| current_database |
|---|
| master |

*Login succeeded and the session defaulted to `master`, exactly as requested by `-d master`. This is the minimum viable connectivity test for scripted administration: it proves login success, network reachability, TDS handshake, SQL execution, and database targeting in one short command. For production use, pair this with `-b` so that a login failure or query error propagates a non-zero exit code to the caller.*

#### Pass the password via SQLCMDPASSWORD

**When to run:** every time SQL authentication is needed from automation, deployment scripts, CI pipelines, or operator consoles that might leak command lines to logs.
**Trigger:** any script that currently hardcodes `-P`, or a security review flagging credential exposure.
**Context:** the env var is scoped to the current process and its children. In PowerShell use `$env:SQLCMDPASSWORD = '...'`; in bash, `export SQLCMDPASSWORD=...` or the inline `VAR=... command` form. Unset immediately after use in long-lived shells.
**Purpose:** keep the password out of process lists, command history, and CI logs while retaining the full automation flow.

> [!info]- How sqlcmd resolves the password
>
> When `-U` is supplied and `-P` is absent, `sqlcmd` consults these sources in order:
>
> - the `SQLCMDPASSWORD` environment variable of the current process;
> - the legacy `OSQLPASSWORD` environment variable (kept for backward compatibility with `osql`);
> - an interactive password prompt on stdin.
>
> If `-P` is supplied it always wins. Mixing `-E` (Windows integrated auth) with `-P` or `SQLCMDPASSWORD` raises an error. Special characters in passwords are safer inside the env var than on the command line, because shell quoting rules do not apply.
>
> *This command authenticates via `SQLCMDPASSWORD` without exposing the secret on the command line.*
>
```powershell
$env:SQLCMDPASSWORD = 'EsgDev2026Pass1'
sqlcmd -S localhost,1434 -U sa -d master -C -W -Q "SELECT SUSER_SNAME() AS logged_in_as, DB_NAME() AS current_db;"
Remove-Item Env:SQLCMDPASSWORD
```

| logged_in_as | current_db |
|---|---|
| sa | master |

*The probe returns the expected login and database without ever quoting the password on the command line. The trailing `Remove-Item Env:SQLCMDPASSWORD` clears the variable from the session so that a later invocation in the same shell does not reuse a stale credential. For CI, prefer to materialize the password from a secret store immediately before `sqlcmd` runs and overwrite the variable after.*

### SQL Server | sqlcmd | Windows and Entra authentication

Windows integrated authentication is the right default for domain-joined hosts talking to on-prem SQL Server because it avoids the password-handling surface entirely. Microsoft Entra ID is the right default for anything in Azure because it integrates with managed identity, MFA, and conditional access.

#### Connect with Windows integrated authentication

**When to run:** on domain-joined Windows hosts (or Linux hosts with properly configured Kerberos) talking to on-prem SQL Server, when the connecting principal has a mapped Windows login on the target instance.
**Trigger:** an automation that must run under a service account, a scheduled task, or any scenario where password handling is unacceptable.
**Context:** runs in any shell. The current Windows identity (or Kerberos ticket on Linux) is used. Requires a mapped login on the target server. Incompatible with `-U`, `-P`, `SQLCMDPASSWORD`, and `-G`.
**Purpose:** authenticate without presenting a password on the client side, using the existing OS-level identity.

> [!info]- What -E does and does not do
>
> - `-E` sets the connection to `Trusted_Connection=yes`, which means the client negotiates SSPI (Kerberos preferred, NTLM fallback) with the target server.
> - `-E` is the **default** mode if you invoke `sqlcmd` with neither `-U` nor `-E` — the explicit flag is kept here for clarity and because some automation tools set `-U` conditionally.
> - `-E` is **incompatible** with `-U`, `-P`, and `-G`; combining them raises an error.
> - On Linux and macOS, `-E` requires a Kerberos environment: a `krb5.conf` pointing at the domain KDC, a valid TGT from `kinit`, and the Microsoft ODBC Driver 17.6.1+.
>
> *This command connects with the current Windows identity and proves the authenticated principal.*
>
```powershell
sqlcmd -S <prod-sql-server> -E -d master -C -Q "SELECT SUSER_SNAME() AS windows_principal, ORIGINAL_LOGIN() AS original_login;"
```

```text
windows_principal                              original_login
---------------------------------------------- ----------------------------------------------
CONTOSO\svc_sqlcmd_ops                         CONTOSO\svc_sqlcmd_ops
```

*The result is not captured against the local `stoxx` Docker instance because that instance only accepts SQL authentication — the Linux container is not joined to any domain. The expected shape is shown above for a domain-joined host. `SUSER_SNAME()` returns the effective login; `ORIGINAL_LOGIN()` returns the pre-impersonation login, which matters when the session later runs `EXECUTE AS`.*

#### Connect to Azure SQL with Microsoft Entra ID

**When to run:** whenever the target is Azure SQL Database, Azure SQL Managed Instance, or Azure Synapse Analytics.
**Trigger:** a new Azure SQL automation workflow, a cloud migration, or a security audit that mandates managed identity instead of SQL logins.
**Context:** requires Microsoft Entra ID integration on the target (already enabled for Azure SQL). Requires an ODBC client new enough to support the `-G` flag (15.0.1000.34+ for interactive, 17.6.1+ for integrated on Linux). Login timeout must be set to at least 30 seconds (`-l 30`) because MFA and token acquisition take longer than a local TCP handshake.
**Purpose:** authenticate to Azure SQL without managing SQL passwords on the client.

> [!info]- Four common Entra flows and how to invoke them
>
> The same `-G` flag covers several authentication methods. The ODBC `sqlcmd` picks the method based on which additional flags you supply; the Go `sqlcmd` adds an explicit `--authentication-method` switch:
>
> - **Password flow.** `-G -U user@tenant.onmicrosoft.com -P <password>`. Works without MFA. Cleanly fails when MFA is enforced.
> - **Interactive flow.** `-G -U user@tenant.onmicrosoft.com` (no `-P`). Pops a browser window, supports MFA and conditional access. Not available on Linux or macOS.
> - **Integrated flow.** `-G` only (no `-U`, no `-P`). Uses the current Windows principal (or Linux Kerberos ticket) to acquire an Entra token.
> - **Managed identity flow (go-sqlcmd).** `--authentication-method ActiveDirectoryManagedIdentity`. On an Azure VM with a system-assigned or user-assigned identity, no credentials live on the client at all.
>
> The `-E` flag is **incompatible** with `-G`; do not mix them. The `-A` DAC flag is also incompatible with `-G`: DAC cannot be reached through an Entra token.
>
> *This command opens an interactive Entra login against an Azure SQL Database.*
>
```powershell
sqlcmd -S myserver.database.windows.net -d esg_prod -G -U alice@contoso.onmicrosoft.com -l 30 -N s -Q "SELECT CURRENT_USER AS current_user, DB_NAME() AS db;"
```

```text
current_user                                                                                      db
-------------------------------------------------------------------------------------------------- -----------
alice@contoso.onmicrosoft.com                                                                      esg_prod
```

*The result is illustrative rather than live-captured because there is no Azure SQL target in the stoxx lab environment. The important operational points are the `-l 30` login timeout (Entra acquisition is slower than a local socket handshake and the 8-second default will time out under MFA) and the `-N s` strict encryption flag (mandatory against Azure SQL; self-signed certs do not exist there).*

### SQL Server | sqlcmd | encryption and TLS

SQL Server 2025 (17.x) changed the default encryption posture of `sqlcmd`. Previously, `sqlcmd` defaulted to `-N o` (optional). Starting with 17.x the default is `-N m` (mandatory), which means the client requires an encrypted channel unless you opt out explicitly. This shift eliminates a common class of accidental plaintext connections but also breaks automation that was relying on the old default against servers with self-signed certificates.

#### Enforce strict encryption with `-N s`

**When to run:** on every connection to production — Azure SQL, an on-prem server with a CA-issued certificate, or any link that crosses an untrusted network segment.
**Trigger:** security review, TDS 8.0 rollout, compliance mandate, or a move from `TRUSTSERVERCERTIFICATE=true` patterns to strict validation.
**Context:** runs in any shell. Requires that the server certificate is valid and chains to a trusted root, that the hostname matches the certificate CN or SAN, and that the ODBC driver is new enough to speak TDS 8.0 (18.3+).
**Purpose:** force `sqlcmd` to abort the connection if the server cannot present a valid, trusted certificate for the target hostname.

> [!danger] Strict encryption breaks self-signed connections by design
>
> `-N s` disables the `-C` (trust without validation) escape hatch entirely. It also disables the legacy `TRUSTSERVERCERTIFICATE=true` connection-string option at the TDS-8.0 layer. Against the local Docker container — which presents a self-signed cert generated at container startup — `-N s` fails with an SSL provider error. This is the correct behavior and proves the flag is doing its job.

> [!success] Provision a trusted cert or use `-N m` with `-F`
>
> For production, deploy a CA-issued certificate to the SQL Server host and use `-N s` with no `-C`. For lab and test instances that must keep their self-signed cert, use `-N m` with an explicit `-F <hostname_in_certificate>` and drop `-C`. Never ship production automation with `-C` present — it silently disables the protection that TLS was meant to provide.

> [!info]- -N suboptions explained
>
> The `-N` flag takes a single-character suboption that maps to a named encryption posture. As of SQL Server 2025, the mapping is:
>
> - **`-N s` (strict)** — TDS 8.0. Encryption negotiated in the TLS layer before login. Certificate is validated. No plaintext login packet exists at any point.
> - **`-N m` (mandatory, default in 17.x+)** — TDS 7.x. Encryption negotiated during the pre-login handshake. Certificate is validated if the client presents one, but `-C` can disable validation. This is the safest default for generic environments.
> - **`-N o` (optional, default in 2022 and earlier)** — Encryption is negotiated only if the server offers it. If the server is unencrypted, the connection silently falls through to plaintext. Do not use in production.
>
> *This command attempts a strict-encryption connection against the self-signed container and expects failure.*
>
```powershell
sqlcmd -S localhost,1434 -U sa -P "EsgDev2026Pass1" -d master -N s -Q "SELECT 1 AS strict_encrypt_ok;"
```

```text
Sqlcmd: Error: Microsoft ODBC Driver 18 for SQL Server : SSL Provider: An existing connection was forcibly closed by the remote host.
Sqlcmd: Error: Microsoft ODBC Driver 18 for SQL Server : Client unable to establish connection.
```

*The connection is correctly refused because the client cannot validate the container's self-signed certificate against a trusted chain. This is not a broken configuration — it is the strict-encryption contract working as designed. Production automation targeting Azure SQL or a host with a CA-issued certificate would see `strict_encrypt_ok = 1` returned without error, because the certificate validates and no `-C` escape is needed.*

#### Validate the server certificate with `-F`

**When to run:** when the SQL Server hostname differs from the certificate CN or SAN — typically behind a DNS alias, a failover listener, or a multi-subnet Availability Group.
**Trigger:** a strict-encryption connection attempt fails with "certificate CN does not match server name," or during the initial rollout of a CA-issued cert behind a DNS alias.
**Context:** runs in any shell. Requires that the expected CN or SAN is known in advance (read from the cert with `openssl s_client -showcerts` or the Windows Certificate Store).
**Purpose:** tell `sqlcmd` to validate the certificate against a specific expected name instead of the connection-string hostname.

*This command connects through a DNS alias and validates the certificate against the underlying host name.*

```powershell
sqlcmd -S sql-prod-alias,1433 -U app_user -d esg_prod -N s -F sql-prod-01.corp.example.com -Q "SELECT @@SERVERNAME;"
```

*No live capture: the stoxx container is reached directly by host and does not have a separate alias. This pattern is critical for Availability Group listeners and multi-subnet failovers where the TCP connection goes to the listener name but the certificate is issued to the underlying node name.*

---

## Script And Variable Execution

Beyond the one-shot `-Q` query, `sqlcmd` runs on two very different models: non-interactive execution of a `.sql` file from the shell (via `-i`), and interactive execution of the `sqlcmd` REPL where SQLCMD-mode commands like `:r`, `:setvar`, `:Connect`, and `:!!` are available. Any `.sql` file passed to `-i` can contain the same SQLCMD-mode commands, which is how deployment tooling like SSDT and DACPACs chain multiple scripts into one run.

> [!abstract] Two execution models that share the same SQLCMD-mode grammar
>
> - **Non-interactive batch.** `sqlcmd -i script.sql` reads the file, executes it, and exits. Best for CI pipelines, cron jobs, and scheduled deployments. The script can use any SQLCMD-mode command (`:r`, `:setvar`, `$(var)`), but it cannot prompt for input.
> - **Interactive REPL.** `sqlcmd` with no `-Q` or `-i` enters the interactive prompt. SQLCMD-mode commands operate against the live session. Useful for exploratory diagnostics, DAC sessions, and ad-hoc recovery work.
> - **`-X` disables interactive escapes.** In hardened environments, add `-X` to block `:!!` shell-out, the startup script (`SQLCMDINI`), and environment-variable pass-through. Add `-X1` to also exit on first unsupported command instead of warning.

### SQL Server | sqlcmd | inline and file execution

#### Execute a script file with `-i`

**When to run:** every deployment, health check, or diagnostic that ships as a versioned `.sql` file rather than inline shell text.
**Trigger:** a CI/CD step that applies a migration, a scheduled health check, or a post-incident recovery playbook.
**Context:** runs in any shell. File paths are resolved relative to the current working directory. On Windows, backslashes require quoting. The `-i` flag can be repeated or comma-separated to run multiple files in order. Combine with `-b` in any pipeline that should halt on failure.
**Purpose:** execute a versioned SQL script end-to-end against the target server.

> [!info]- Setup steps for this demo
>
> This demo uses a tiny health-check script created in the operator's temp folder for reproducibility. In production, the same pattern is used with scripts checked into a repo and referenced by absolute path. The demo file contains two independent batches: a `SERVERPROPERTY` probe and a user-database count.
>
> *This command runs a versioned health-check script against the instance and captures both result sets.*
>
```powershell
sqlcmd -S localhost,1434 -U sa -P "EsgDev2026Pass1" -d master -C -W -s "|" -i "C:\Users\aperi\AppData\Local\Temp\sqlcmd-demo\health-check.sql"
```

```text
product_version|edition                   |product_level|server_name
---------------|--------------------------|-------------|------------
16.0.4236.2    |Developer Edition (64-bit)|RTM          |9b9b89176e4b

online_user_dbs
---------------
              2
```

*Both batches ran, separated by the blank line `sqlcmd` emits between result sets. The first batch returned the server identity and build level of the local container (`16.0.4236.2` = SQL Server 2022 RTM-CU23). The second batch counted online user databases (`2`: `stoxx` and `stoxx_db`). For a migration pipeline, wrap the same invocation in `-b` so that any `RAISERROR` with severity ≥ 11 halts the deployment and propagates a non-zero exit code.*

#### Include nested scripts with `:r`

**When to run:** when a deployment or migration script depends on shared setup logic — variable definitions, schema prerequisites, helper procedures — that live in a separate file.
**Trigger:** a DACPAC-style deployment pattern, a multi-environment script where only the variable file changes per environment, or a modular migration suite where each file handles one concern.
**Context:** runs inside a SQL file passed to `-i`, or in the interactive REPL. `:r` reads the referenced file relative to the startup directory of `sqlcmd`. Each `:r` adds the file's contents to the statement cache; execution happens when the next `GO` batch terminator is encountered.
**Purpose:** compose multiple SQL files into a single execution so that environment-specific variables and shared setup live in one place instead of being duplicated per deployment.

> [!info]- How :r interacts with SQLCMD variables
>
> In this demo, `main.sql` starts with `:r setvars.sql`. The included file contains `:setvar target_db stoxx` and `:setvar top_n 3`, which become available to the rest of the main script as `$(target_db)` and `$(top_n)`. The main script then uses those variables inside a `SELECT TOP ($(top_n)) ... FROM $(target_db).silver.eurostoxx50_ohlcv ...` query. The variable substitution happens on the client side before the batch is sent to SQL Server, which is why an invalid variable name produces a client-side error rather than a T-SQL parse error.
>
> The classic deployment pattern this enables: one `variables.<env>.sql` file per environment (dev, staging, prod) and one `deploy.sql` file that includes the right variables file with `:r` and then runs the migration. Only the variable file changes per environment.
>
> *This command runs a main script that `:r`-includes a variables file and substitutes the resulting variables into a query.*
>
```powershell
sqlcmd -S localhost,1434 -U sa -P "EsgDev2026Pass1" -d master -C -W -s "|" -i "C:\Users\aperi\AppData\Local\Temp\sqlcmd-demo\main.sql"
```

| symbol | date | close |
|---|---|---|
| ABI.BR | 2026-04-07 | 61.619999999999997 |
| AD.AS | 2026-04-07 | 41.689999999999998 |
| ADS.DE | 2026-04-07 | 130.84999999999999 |

*The included `setvars.sql` defined `target_db=stoxx` and `top_n=3`, both substituted into the main query before the batch was sent to SQL Server. The result shows three EuroStoxx 50 constituents at the most recent close date in the `silver` layer. The floating-point artifacts in the `close` column (`61.619999999999997` instead of `61.62`) are a property of the underlying `FLOAT` storage type surfacing through the default text renderer — use `CAST(... AS DECIMAL(18,6))` in the query if operational output needs clean fixed-point formatting.*

### SQL Server | sqlcmd | SQLCMD variables

#### Pass a variable with `-v`

**When to run:** whenever the same script must target different environments, databases, or data slices and the operator wants to parameterize a single run without editing files.
**Trigger:** a deployment script that is invoked per environment from a CI runner, or an ad-hoc recovery run that needs to parameterize a filter.
**Context:** runs in any shell. `-v` accepts `name="value"` pairs; variables are resolved at the client before the batch is sent to SQL Server. Values precedence is: `:setvar` > `-v` > shell env > user env > system env.
**Purpose:** parameterize a script without modifying its source.

> [!warning] Text substitution is not parameterization
>
> `sqlcmd` variable substitution is textual find-and-replace: the client finds every `$(name)` in the buffered batch and swaps it for the value before sending. Untrusted input fed into `$(...)` is a SQL injection vector, exactly like string-concatenating into T-SQL.
>
> - A value containing `'; DROP TABLE users; --` becomes part of the executed SQL.
> - Even "safe" inputs (database names, schema names) can collide with SQL keywords or contain characters that break the outer quoting.
> - There is no binding to a typed parameter — it's raw text.

> [!success] Use `-v` only for trusted deployment inputs
>
> Reserve `-v` for values controlled by the deployment process: environment names, database names, file paths generated by the pipeline, date strings from an orchestrator. For anything that originates from an end user, use proper parameterized T-SQL inside a stored procedure, called with `sp_executesql` and typed parameters.

> [!info]- The `$(...)` resolution path
>
> - `-v dbname="stoxx"` registers the variable in the client.
> - The batch text `SELECT '$(dbname)' AS ...` is scanned for `$(name)` tokens before send.
> - Each token is replaced with the registered value. If a token is unresolved and `-b` is set, the client aborts with error 138 ("variable not defined"); otherwise it leaves the literal text.
> - `SET NOCOUNT ON` suppresses the `(1 row affected)` row counter, which is noise in automation. `-s "|"` chooses the column delimiter and `-W` trims trailing whitespace.
>
> *This command defines a SQLCMD variable and proves the client substitutes it before the batch reaches SQL Server.*
>
```powershell
sqlcmd -S localhost,1434 -U sa -P "EsgDev2026Pass1" -d master -C -b -W -s "|" -Q 'SET NOCOUNT ON; SELECT ''$(dbname)'' AS sqlcmd_variable_value;' -v dbname="stoxx"
```

| sqlcmd_variable_value |
|---|
| stoxx |

*The output confirms real SQLCMD substitution, not a shell-level variable or a comment convention. SQL Server received the literal string `stoxx` because the client replaced `$(dbname)` before the batch was serialized to TDS. If the value had contained a single quote, the T-SQL string literal would have broken — this is the injection vector the `[!warning]` above describes.*

#### Set a variable inside a script with `:setvar`

**When to run:** when variables need to be set inside a script file instead of on the command line — typically for environment-specific variable files included via `:r`.
**Trigger:** a modular deployment structure where variables change per environment but the main script does not, or an interactive REPL session where the operator wants to set a variable mid-session.
**Context:** runs only in SQLCMD mode — inside a `.sql` file passed to `-i`, inside the interactive REPL, or inside an SSMS query window with SQLCMD mode enabled. Ignored by plain T-SQL tools.
**Purpose:** define SQLCMD variables programmatically from inside a script.

*This command file shows the `:setvar` usage captured in the setvars.sql demo file.*

```sql
:setvar target_db stoxx
:setvar top_n 3
```

*These two lines, included from `main.sql` via `:r setvars.sql`, register the `target_db` and `top_n` variables for the remainder of the batch. `:setvar` without a value clears the variable. Variable names are case-insensitive; values containing whitespace must be double-quoted (`:setvar message "hello world"`). The `:Listvar` command in an interactive session enumerates all currently-registered variables plus the reserved `SQLCMD*` set.*

---

## Error Handling And Exit Codes

`sqlcmd`'s default error handling is permissive: a SQL batch can raise an error, print an error message, and still exit with code `0`. That is a correct design choice for interactive usage — the operator sees the error and reacts — but it is an abject failure mode for automation, because the caller has no way to know the deployment just broke. The fix is the `-b` flag plus explicit severity and stderr routing flags. This section covers all four in the order they typically appear on a production command line.

> [!abstract] Four flags that turn sqlcmd into a reliable CI citizen
>
> - **`-b`** — exit with `ERRORLEVEL = 1` on any SQL error at severity 11 or above. Without `-b`, `sqlcmd` exits `0` even when the batch failed.
> - **`-V <severity>`** — raise the severity floor so low-severity `RAISERROR` progress messages do not fail the build.
> - **`-r 0|1`** — route error messages to `stderr`, so the shell caller can separate query output from error output at the stream level.
> - **Exit-code verification.** Read `$LASTEXITCODE` in PowerShell, `$?` in bash, or `%ERRORLEVEL%` in `cmd.exe` — and fail the step on any non-zero value.

### SQL Server | sqlcmd | fail-fast behavior

#### Fail the shell on SQL error with `-b`

**When to run:** on every invocation of `sqlcmd` from CI, deployment scripts, scheduled tasks, or any workflow where a downstream step must only run if the SQL step succeeded.
**Trigger:** writing any automation that runs `sqlcmd`, auditing an existing script that does not check exit codes, or a post-incident where a silent SQL error cascaded into broken state.
**Context:** runs in any shell. Makes `sqlcmd` exit with `ERRORLEVEL=1` on any SQL error with severity > 10, plus `1` for client-side problems like an unresolved `$(var)` when variable substitution fails.
**Purpose:** propagate SQL errors into process exit codes so that the shell can trap them.

> [!warning] Default sqlcmd swallows SQL errors silently
>
> Without `-b`, `sqlcmd` reports errors to stdout or stderr and then exits with code `0`. A CI pipeline reading only the exit code will cheerfully mark the step green even though the deployment failed.

> [!success] Always add `-b` in CI and deployment scripts
>
> `-b` makes severity-11-and-above errors set the exit code to `1`. Combined with `-V` (severity floor) and `-r 1` (route errors to stderr) you get a command line that fails loudly and distinguishes SQL output from SQL errors at the shell level.

> [!info]- How `-b` determines the exit code
>
> - Severity **10 or below** (informational) does not set the exit code regardless of `-b`.
> - Severity **11 or above** sets the exit code to `1` when `-b` is present.
> - If `-V <level>` is also set, errors below that severity are ignored — useful when you want to allow informational-ish warnings like `RAISERROR(..., 11, ...)` through.
> - Client-side failures (invalid file path, unresolved `$(var)`, login timeout, syntax error in the command line) always set the exit code to `1` independently of `-b`.
> - The Windows `cmd.exe` variable is `%ERRORLEVEL%`; the PowerShell variable is `$LASTEXITCODE`; the bash variable is `$?`. All three read the same underlying process exit code.
>
> *This command runs a script that deliberately raises a severity-16 error and proves the exit code.*
>
```powershell
sqlcmd -S localhost,1434 -U sa -P "EsgDev2026Pass1" -d stoxx -C -b -i "C:\Users\aperi\AppData\Local\Temp\sqlcmd-demo\deploy.sql"
$LASTEXITCODE
```

```text
step 1 ok
Msg 50000, Level 16, State 1, Server 9b9b89176e4b, Line 3
deploy step 2 failed
step 3 should not run under -b
1
```

*Three things to notice in the output. First, `step 1 ok` printed, confirming the batch began executing. Second, the `RAISERROR` at severity 16 produced an `Msg 50000, Level 16` line. Third, `step 3 should not run under -b` still printed — this is a common surprise. `-b` sets the **exit code** to `1` on batch completion, but it does not abort the current batch in the middle unless there is a `GO` boundary between statements. To truly stop at `RAISERROR`, place a `GO` before the dependent statements or raise a severity-20+ error that terminates the connection. The final `1` is the `$LASTEXITCODE` readout, confirming the propagation worked.*

#### Set the minimum severity floor with `-V`

**When to run:** when a deployment script intentionally uses low-severity `RAISERROR` calls for progress messages and those should not fail the build.
**Trigger:** a migration that emits `RAISERROR(..., 10, 1) WITH NOWAIT` for progress telemetry, or a script that uses low-severity warnings for non-fatal conditions.
**Context:** runs in any shell alongside `-b`. `-V` accepts a severity integer from 1 to 25; errors below that threshold are suppressed from the exit-code calculation.
**Purpose:** distinguish fatal from informational errors in the exit-code decision.

*This command combines `-b` and `-V 16` so only severity 16+ errors fail the shell.*

```powershell
sqlcmd -S localhost,1434 -U sa -P "EsgDev2026Pass1" -d stoxx -C -b -V 16 -i ".\deploy.sql"
```

*The `-V 16` floor means a `RAISERROR(..., 11, 1)` or `RAISERROR(..., 15, 1)` progress message inside `deploy.sql` is reported to stdout but does not fail the exit code. Severity 16, 17, 18, 19, 20 all still fail. This is the cleanest way to let legitimate progress output through without silencing real errors.*

#### Route errors to stderr with `-r 1`

**When to run:** when the caller needs to split `sqlcmd` output by stream — typically to capture query output on stdout and log errors to a separate file.
**Trigger:** a CI step that pipes `sqlcmd` stdout into `jq`, a file, or another process, and needs the errors to be captured separately.
**Context:** runs in any shell. `-r 0` sends only severity-11+ error messages to stderr. `-r 1` sends all error messages including `PRINT` output. Has no effect when combined with `-o` (which overrides the output destination entirely).
**Purpose:** separate query result output from error output at the shell stream level.

*This command routes all errors to stderr while leaving query output on stdout.*

```powershell
sqlcmd -S localhost,1434 -U sa -P "EsgDev2026Pass1" -d stoxx -C -b -r 1 -Q "PRINT 'this goes to stderr'; SELECT 1 AS ok;" 2> errors.log
```

*After this runs, `errors.log` contains the `PRINT` text (because `-r 1` widens error routing to include `PRINT`) and `stdout` contains the `SELECT 1` result. This stream-splitting pattern is useful for pipelines that pipe `sqlcmd` output into a downstream parser that would break on error text.*

---

## Output Shaping

Most `sqlcmd` automation either wants human-readable console output or machine-friendly delimited output. `sqlcmd` can produce both, but the output flags are surprisingly interlocked: the column separator (`-s`) interacts with trailing-space behavior (`-W`), header printing (`-h`), column widths (`-y`/`-Y`), and file redirection (`-o`).

> [!abstract] Output shaping flag set at a glance
>
> - **Delimiters.** `-s "<char>"` chooses a column separator; `-W` strips trailing padding so columns actually end at the separator; pair them in every delimited export.
> - **Headers.** `-h -1` removes the header row entirely; `-h 0` (default) keeps one header at the top; `-h N` repeats the header every N rows for very long result sets.
> - **Widths.** `-y <N>` caps variable-length columns (`VARCHAR`, `NVARCHAR`, `VARBINARY`, `XML`, UDTs); `-Y <N>` caps fixed-length columns; both accept `0` for unlimited with matching performance costs.
> - **Destination.** `-o <file>` redirects all output to a file, overwriting the previous file. `-o` overrides `-r` stderr routing, so combine them carefully.

### SQL Server | sqlcmd | delimited output

#### Export a query result to a delimited file

**When to run:** when an operational export is needed as flat text for downstream tooling — ETL pipelines, spreadsheets, ad-hoc analyses — and `bcp` or `BULK INSERT` is overkill.
**Trigger:** a request for a "quick dump" of a table or query, a diagnostics export for offline analysis, or a CI step that compares current output against a golden baseline.
**Context:** runs in any shell. Output is written to the file path in `-o`, overwriting any existing file. Paths with spaces must be quoted. The `-f` flag can set the output codepage if Unicode is required.
**Purpose:** produce a reproducible delimited file suitable for downstream text processing.

> [!info]- Flag interactions that matter for clean output
>
> - `-s "|"` sets the column separator. Without it you get space-padded columns which are hard to reparse.
> - `-W` trims trailing whitespace from each column. Without it, even with `-s`, every column still ends in padding characters.
> - `-h -1` suppresses the column header row and the separator line. `-h 0` keeps the header but prints it every page. Positive `-h N` prints the header every `N` rows.
> - `-o <path>` redirects all output to the file. `-o` overrides `-r` routing; all stdout goes to the file regardless.
> - `-y 0` sets unlimited `VARCHAR`/`NVARCHAR` display width. Use with extreme care — a single wide `VARCHAR(MAX)` column can explode the file size by orders of magnitude.
>
> *This command exports a top-5 EuroStoxx 50 slice as a pipe-delimited file with no header row.*
>
```powershell
sqlcmd -S localhost,1434 -U sa -P "EsgDev2026Pass1" -d stoxx -C -Q "SET NOCOUNT ON; SELECT TOP (5) symbol, [date], [close] FROM silver.eurostoxx50_ohlcv ORDER BY [date] DESC, symbol;" -s "|" -W -h-1 -o "C:\Users\aperi\AppData\Local\Temp\sqlcmd-demo\export.txt"
Get-Content "C:\Users\aperi\AppData\Local\Temp\sqlcmd-demo\export.txt"
```

```text
ABI.BR|2026-04-07|61.619999999999997
AD.AS|2026-04-07|41.689999999999998
ADS.DE|2026-04-07|130.84999999999999
ADYEN.AS|2026-04-07|844.20000000000005
AI.PA|2026-04-07|181.5
```

*Five rows, no headers, no separator line, no trailing whitespace. Ready for `Import-Csv -Delimiter '|'`, `pandas.read_csv(..., sep='|', header=None)`, or any other downstream parser. Note the `close` column is rendered with its raw `FLOAT` precision (`61.619999999999997` instead of `61.62`) — if the downstream consumer needs fixed decimal output, cast inside the query: `CAST([close] AS DECIMAL(18,6))`.*

#### Suppress column headers with `-h -1`

**When to run:** whenever downstream text processing treats the header row as a data row, or the output is being appended to a pre-existing file that already has a header.
**Trigger:** a downstream `awk`, `jq`, or `cut` pipeline that wrongly picks up the header row as data, or a CSV consumer that concatenates multiple `sqlcmd` exports into one file.
**Context:** runs in any shell as part of the standard output-shaping flag set.
**Purpose:** strip the column-name header and separator line from the output.

*This command omits the header line by passing `-h -1`.*

```powershell
sqlcmd -S localhost,1434 -U sa -P "EsgDev2026Pass1" -d master -C -h-1 -W -s "|" -Q "SET NOCOUNT ON; SELECT name, recovery_model_desc, state_desc FROM sys.databases WHERE database_id > 4 ORDER BY name;"
```

```text
stoxx|FULL|ONLINE
stoxx_db|FULL|ONLINE
```

*Two rows, no header, no separator. The `-h N` value has three meaningful forms: `-1` (no header at all), `0` (one header at the start, which is the default), or `N > 0` (repeat the header every N rows — useful when piping to a pager for very long result sets). Pair `-h -1` with `-s` and `-W` for clean delimited text.*

#### Control column widths with `-y` and `-Y`

**When to run:** when the default column widths truncate wide `VARCHAR` or `NVARCHAR` columns in a way that corrupts downstream parsing, or conversely when unbounded widths blow up the file size.
**Trigger:** a `SELECT` result where `XML`, `VARCHAR(MAX)`, or concatenated text columns are silently cut off at 256 characters.
**Context:** runs in any shell. `-y` (lowercase) controls **variable**-length type width (`VARCHAR`, `NVARCHAR`, `VARBINARY`, `XML`, UDTs). `-Y` (uppercase) controls **fixed**-length type width (`CHAR(n)`, `NCHAR(n)`, `VARCHAR(n)` where `n ≤ 8000`). Both accept `0` for unlimited.
**Purpose:** shape column widths so variable-length types render fully without truncation.

*This command widens variable-length columns to 8000 characters and fixed-length columns to 4000.*

```powershell
sqlcmd -S localhost,1434 -U sa -P "EsgDev2026Pass1" -d master -C -y 8000 -Y 4000 -Q "SELECT name, definition FROM sys.sql_modules WHERE object_id = OBJECT_ID(N'sys.sp_helpdb');"
```

*`-y` defaults to `256` and silently truncates wide `VARCHAR(MAX)` columns like `sys.sql_modules.definition`. Bumping to `8000` lets the full body of a stored procedure through. `-y 0` is unlimited but is dangerous: a single `VARCHAR(MAX)` column holding several megabytes will balloon the output file by the same amount, and wide terminals may wrap the output into unreadable chunks.*

---

## Dedicated Admin Connection

The Dedicated Admin Connection (DAC) is SQL Server's escape hatch for cases where the normal workload endpoint is too impaired to serve diagnostic queries — a wedged `tempdb`, a scheduler stall, a memory pressure event, or a schema-level lock that blocks every user session. The DAC listens on its own port, runs with its own scheduler, and guarantees one and only one diagnostic session at a time. It is intentionally narrow: connect to `master`, keep the workload light, and use only the DMVs required to understand the fault.

> [!abstract] DAC in one page
>
> - **Access method.** `sqlcmd -A` (ODBC only — Go `sqlcmd` does not yet support `-A`) or the `admin:` server prefix (`sqlcmd -S admin:<server>`).
> - **Listener.** Loopback only by default. `sp_configure 'remote admin connections', 1` enables remote access, but the DAC port must still be reachable from the client.
> - **Port.** Dynamic. Logged in the SQL Server error log at startup as "Dedicated admin connection support was established for listening locally on port <n>". On a fresh instance it is typically 1434 on the server's loopback interface (not to be confused with the SSRP browser port 1434, which is UDP).
> - **Session limit.** Exactly one concurrent DAC session per instance. A second attempt gets `error 17810 "Could not connect because the maximum number of 1 dedicated administrator connections already exists"`.
> - **Permissions.** Members of the `sysadmin` fixed server role only. Not accessible to `serveradmin`, `dbcreator`, or any other fixed role.
> - **Incompatibilities.** `-A` is mutually exclusive with `-G` (Microsoft Entra auth). DAC does not support Entra tokens.
> - **Workload restrictions.** No parallel queries. No `USE <db>` to a non-`master` database in extreme-pressure cases. Keep queries short and deterministic.

### SQL Server | sqlcmd | DAC operations

This subsection walks through the DAC lifecycle end-to-end: checking the current remote-DAC configuration, enabling it if required, locating the DAC port in the errorlog, establishing the session, and proving the connection is genuinely routed through the DAC endpoint (rather than the regular workload listener).

#### Check remote DAC configuration with sp_configure

**When to run:** before attempting a DAC session from a remote host, or during a routine server-configuration audit.
**Trigger:** a ticket that requires DAC access from an operator workstation, a post-migration server-configuration review, or a hardening checklist.
**Context:** runs against the regular workload endpoint. Read-only. Requires `VIEW SERVER STATE` (for `sys.configurations`) or membership in any role with `ALTER SETTINGS` permission.
**Purpose:** confirm whether the instance accepts DAC connections from remote clients or is restricted to local loopback only.

*This command reads the `remote admin connections` value from `sys.configurations`.*

```powershell
sqlcmd -S localhost,1434 -U sa -P "EsgDev2026Pass1" -d master -C -W -s "|" -Q "SELECT name, value, value_in_use, [description] FROM sys.configurations WHERE name = 'remote admin connections';"
```

| name | value | value_in_use | description |
|---|---|---|---|
| remote admin connections | 0 | 0 | Dedicated Admin Connections are allowed from remote clients |

*`value_in_use = 0` means only local clients can attach to the DAC. To allow operators on another host to reach the DAC, set `remote admin connections = 1` via `sp_configure` and `RECONFIGURE`. The configuration takes effect immediately — no SQL Server restart required. Note that on clustered SQL Server installations the DAC listener is off by default, so enabling `remote admin connections` is the recommended baseline for any clustered production instance.*

#### Enable remote DAC access

**When to run:** during instance initial hardening, after a cluster node failover where DAC may have been reset, or as the first step of an incident where you need DAC from an operator workstation.
**Trigger:** an incident playbook step that requires remote DAC access, or a new instance being onboarded to the operational standard.
**Context:** runs against the regular workload endpoint. Requires `ALTER SETTINGS` (implicit in `sysadmin` and `serveradmin`). The change is dynamic — no restart needed.
**Purpose:** enable DAC connections from remote hosts without restarting the instance.

*This command enables remote DAC access via `sp_configure`.*

```sql
EXEC sp_configure 'remote admin connections', 1;
RECONFIGURE;
```

*`RECONFIGURE` commits the configuration change. The DAC listener is refreshed without a service restart, and remote `sqlcmd -A` connections begin working immediately. This change should be baked into the instance's standard configuration so that every new cluster node inherits it; setting it once and losing it on failover is a classic "everything is fine until the incident" trap.*

#### Locate the DAC port in the SQL Server errorlog

**When to run:** before connecting through the DAC for the first time on a given instance, or whenever the port assignment might have changed (dynamic ports, container restart, instance rename).
**Trigger:** a planned DAC session, a restart of the instance, or a container recreate where the DAC listener was rebound.
**Context:** reads `/var/opt/mssql/log/errorlog` on Linux containers or `ERRORLOG` on Windows installations. Requires host-level read access to the errorlog file or `sys.xp_readerrorlog` via the regular endpoint.
**Purpose:** discover the actual TCP port the DAC listener bound to at startup.

*This command reads the DAC-announcement lines from the SQL Server errorlog via `docker exec`.*

```powershell
docker exec stoxx-db bash -c 'grep -i "dedicated admin" /var/opt/mssql/log/errorlog | tail -5'
```

```text
2026-04-11 11:24:46.03 Server      The maximum number of dedicated administrator connections for this instance is '1'
2026-04-11 11:24:46.92 Server      Dedicated admin connection support was established for listening locally on port 1434.
```

*Two lines that matter. The first confirms the instance-level cap of one concurrent DAC session. The second gives the DAC listener's port — `1434` on the container's loopback interface. A critical subtlety for containerized SQL Server: the Docker port mapping for `stoxx-db` is `1433 (container) -> 1434 (host)`, so the host's `localhost,1434` reaches the container's regular workload endpoint on `1433`. The container's DAC endpoint on port `1434` is not published. This means DAC from the host via `sqlcmd -S admin:localhost,1434` fails — the host has no route to the container's DAC port. The operational pattern for Dockerized SQL Server DAC is therefore to `docker exec` into the container and run `sqlcmd` against the container's own loopback, which is demonstrated next.*

#### Connect through the DAC endpoint via docker exec

**When to run:** during an incident where the regular workload endpoint is unresponsive and the instance is running inside a container, or for any planned DAC diagnostic on a containerized SQL Server.
**Trigger:** a scheduler stall, memory pressure event, or schema-lock deadlock on a containerized instance, or a planned capacity-audit DAC session.
**Context:** requires `docker exec` access to the host running the container, and `sysadmin` on the SQL Server instance inside. The DAC session is **local to the container** even though the operator is logged in on the host — which is exactly the isolation the DAC was designed for.
**Purpose:** establish a diagnostic DAC session on a containerized SQL Server where DAC port publishing is not available.

> [!warning] DAC is a narrow resource — coordinate before using it
>
> Only one DAC session per instance is permitted. Starting a second DAC session while one is already active fails with error 17810. In practice this means:
>
> - Close the DAC session as soon as the diagnostic query is done. Do not leave it idle.
> - Coordinate with the rest of the operations team before starting a DAC so two operators do not race.
> - Do not use the DAC for routine administration. It is designed for the pathological case.

> [!success] Reserve DAC for pathology and keep workload light
>
> Connect to `master`, avoid heavyweight joins or full scans, skip anything that would recompile plans. The DAC has its own scheduler and is intended to survive when everything else is stuck — asking it to run a complex query defeats the purpose.

> [!info]- Why the docker-exec form is required here
>
> The DAC port (`1434`) is bound on the container's loopback interface, not on `0.0.0.0`, so it is not reachable through any Docker host-port mapping. The classical `sqlcmd -S admin:localhost,1434` form from the host fails. Running `sqlcmd` **inside** the container removes the network-routing problem entirely — the client and the DAC listener share the same loopback interface. The `admin:` prefix on the server name is equivalent to passing `-A` in ODBC `sqlcmd`; either form triggers the DAC endpoint selection at connect time.
>
> *This command opens a DAC session inside the container and queries `sys.dm_exec_connections` to prove the session is routed through the DAC endpoint.*
>
```powershell
docker exec stoxx-db /opt/mssql-tools18/bin/sqlcmd -S "admin:127.0.0.1" -U sa -P "EsgDev2026Pass1" -d master -C -W -s "|" -Q "SELECT s.session_id, s.login_name, c.endpoint_id, CASE c.endpoint_id WHEN 1 THEN 'DAC' ELSE 'Regular' END AS endpoint_kind FROM sys.dm_exec_sessions s INNER JOIN sys.dm_exec_connections c ON s.session_id = c.session_id WHERE s.session_id = @@SPID;"
```

| session_id | login_name | endpoint_id | endpoint_kind |
|---|---|---|---|
| 55 | sa | 1 | DAC |

*The session is genuinely routed through the DAC endpoint. The signature is `endpoint_id = 1` in `sys.dm_exec_connections`: the DAC is always endpoint 1, and no other connection type ever uses that ID. `@@SPID = 55` is an ordinary user-session ID — DAC sessions do not use a reserved range. If `endpoint_id` came back as anything other than 1, the `admin:` prefix was ignored and the connection fell through to the regular workload listener (most commonly because the operator hit a non-DAC instance, or because the `sysadmin` check on the server rejected the DAC attempt and downgraded to a regular login).*

---

## sqlcmd Flag Reference

A comprehensive reference for every documented flag in the ODBC `sqlcmd` 17.x flag surface, grouped by functional area. Flags that differ meaningfully on `go-sqlcmd` are annotated inline. Use this table as the authoritative lookup for flags not exercised elsewhere in the note.

### Login and connection

| Flag | Syntax | Description |
|---|---|---|
| `-S` | `-S [<protocol>:]<server>[\<instance>][,<port>]` | Target server and instance. Port separator is a comma. `go-sqlcmd` accepts `lpc:`, `np:`, `tcp:` protocol prefixes. |
| `-U` | `-U <login>` | SQL authentication login name. Sets `SQLCMDUSER`. |
| `-P` | `-P <password>` | SQL authentication password. **Insecure** — prefer `SQLCMDPASSWORD` env var. |
| `-E` | `-E` | Use trusted connection (Windows integrated auth). Incompatible with `-U`, `-P`, `-G`. |
| `-G` | `-G` | Microsoft Entra authentication (Azure SQL only). `go-sqlcmd` adds `--authentication-method` for explicit flow selection. |
| `-A` | `-A` | Connect via the Dedicated Admin Connection. Equivalent to `admin:` prefix on the server name. ODBC only. |
| `-d` | `-d <db_name>` | Issue `USE <db_name>` at connect. Sets `SQLCMDDBNAME`. |
| `-l` | `-l <seconds>` | Login timeout. Default `8`. Recommend `≥30` for `-G`. Sets `SQLCMDLOGINTIMEOUT`. |
| `-t` | `-t <seconds>` | Query timeout. Default `0` (infinite). Sets `SQLCMDSTATTIMEOUT`. |
| `-H` | `-H <workstation>` | Override the workstation name reported in `sys.sysprocesses.hostname`. Sets `SQLCMDWORKSTATION`. |
| `-a` | `-a <bytes>` | TDS packet size. Default `4096`. Sets `SQLCMDPACKETSIZE`. |
| `-K` | `-K <intent>` | Application intent (`ReadOnly` / `ReadWrite`). Required for readable secondary replicas. |
| `-M` | `-M` | Multi-subnet failover (faster reconnect on AG listeners). ODBC only; `go-sqlcmd` enables it by default. |
| `-D` | `-D` | Interpret `-S` as a DSN name instead of a server name. Linux/macOS only. |
| `-z` / `-Z` | `-z <new_pwd>` / `-Z <new_pwd>` | Change SQL login password. `-Z` exits after the change. |

### Encryption and security

| Flag | Syntax | Description |
|---|---|---|
| `-N` | `-N [s\|m\|o]` | Encryption mode. `s` = strict (TDS 8.0), `m` = mandatory (default in 2025+), `o` = optional (default in 2022). |
| `-C` | `-C` | Trust the server certificate without validation. **Never use in production.** |
| `-F` | `-F <hostname_in_cert>` | Expected CN or SAN during cert validation. Use for DNS aliases and AG listeners. |
| `-g` | `-g` | Enable Always Encrypted (`Column Encryption Setting=Enabled`). Windows cert store only. |
| `-X` | `-X[1]` | Disable interactive shell-out (`:!!`, `ED`), `SQLCMDINI` startup script, and env-var pass-through. `-X1` exits on first unsupported command. |

### Input and output

| Flag | Syntax | Description |
|---|---|---|
| `-q` | `-q "<query>"` | Execute query then stay in interactive mode. |
| `-Q` | `-Q "<query>"` | Execute query then exit. |
| `-i` | `-i <file>[,<file2>...]` | Read script from one or more files. Causes sqlcmd to exit after execution. |
| `-o` | `-o <file>` | Redirect output to file instead of stdout. Overwrites existing file. |
| `-e` | `-e` | Echo input scripts to stdout (useful with `-i` to see what was executed). |
| `-f` | `-f <codepage>` or `i:<cp>[,o:<cp>]` | Input/output codepages. |
| `-u` | `-u` | Force Unicode output file (UTF-16 LE on ODBC, UTF-16 LE with BOM on Go). |
| `-r` | `-r [0\|1]` | Route error messages to stderr. `0` = severity ≥ 11, `1` = all errors including `PRINT`. |
| `-R` | `-R` | Apply client regional settings to numeric/currency/date columns. ODBC only; ignored by Go. |

### Query execution and output shaping

| Flag | Syntax | Description |
|---|---|---|
| `-c` | `-c "<terminator>"` | Batch terminator. Default `GO`. |
| `-I` | `-I` | Enable quoted identifiers. ODBC only; Go always has them on. |
| `-h` | `-h <N>` | Header printing: `-1` = no header, `0` = one header (default), `N > 0` = repeat every N rows. Sets `SQLCMDHEADERS`. |
| `-s` | `-s "<char>"` | Column separator. Default is space padding. Sets `SQLCMDCOLSEP`. |
| `-w` | `-w <width>` | Screen width for output. Default `80`. Sets `SQLCMDCOLWIDTH`. |
| `-W` | `-W` | Remove trailing spaces from each column. |
| `-y` | `-y <N>` | `SQLCMDMAXVARTYPEWIDTH` — width for variable-length types (default `256`, `0` = unlimited). |
| `-Y` | `-Y <N>` | `SQLCMDMAXFIXEDTYPEWIDTH` — width for fixed-length types (default `0` = unlimited). |
| `-k` | `-k [1\|2]` | Control character handling: `1` removes, `2` replaces with space. |
| `-p` | `-p [1]` | Print performance statistics per result set. `-p 1` emits colon-separated form for scripting. |
| `-L` | `-L [c]` | List SQL Server instances broadcasting on the local network. `c` strips the `Servers:` header. |
| `-v` | `-v name="value"` | Define a SQLCMD scripting variable for `$(name)` substitution. |
| `-x` | `-x` | Disable variable substitution. |
| `-b` | `-b` | Exit with `ERRORLEVEL=1` on SQL error (severity ≥ 11). |
| `-V` | `-V <severity>` | Suppress errors below the given severity from the exit-code calculation. |
| `-m` | `-m <level>` | Suppress error messages below the given severity from stdout/stderr. Sets `SQLCMDERRORLEVEL`. |
| `-j` | `-j` | Print raw (untranslated) error messages. |
| `-?` | `-?` | Display version and flag summary. |

### SQLCMD interactive commands

Usable inside a `.sql` file passed to `-i`, inside the interactive REPL, or inside an SSMS query window with SQLCMD mode enabled. Not usable from `-Q` or `-q` inline queries.

| Command | Syntax | Description |
|---|---|---|
| `GO` | `GO [<count>]` | Batch terminator. Optional repeat count executes the preceding batch N times. |
| `:r` | `:r <filename>` | Parse and execute an additional script file. Useful for modular deployments. |
| `:setvar` | `:Setvar <name> [ "<value>" ]` | Define a SQLCMD scripting variable. Omit the value to clear. |
| `:Listvar` | `:Listvar` | List all currently-set scripting variables. |
| `:Connect` | `:Connect <server>[\<instance>] [-l <timeout>] [-U <user> [-P <pwd>]] [-N[s\|m\|o]] [-F <host_in_cert>]` | Close current connection and open a new one. |
| `:On Error` | `:On Error [exit \| ignore]` | Set per-session error-handling policy. |
| `:Error` | `:Error <filename> \| stderr \| stdout` | Redirect error messages to a specific destination. |
| `:Out` | `:Out <filename> \| stderr \| stdout` | Redirect query output to a specific destination. |
| `:Perftrace` | `:Perftrace <filename> \| stderr \| stdout` | Redirect performance trace output. |
| `:Help` | `:Help` | Print the list of interactive commands. |
| `:List` | `:List` | Print the current batch buffer. |
| `:RESET` | `[:]RESET` | Clear the current batch buffer without executing it. |
| `:EXIT` / `:QUIT` | `[:]EXIT [(<query>)]` / `[:]QUIT` | Exit. `:EXIT(<query>)` runs the query and uses its first column value as the process exit code. |
| `:!!` | `[:]!! <shell_command>` | Shell out to the OS. Disabled by `-X`. |
| `:ED` | `[:]ED` | Launch `SQLCMDEDITOR` on the current batch. Disabled by `-X`. Not available in `go-sqlcmd`. |
| `:ServerList` | `:ServerList` | List local and broadcasting SQL Server instances. Not available in `go-sqlcmd`. |
| `:XML` | `:XML [ON \| OFF]` | Toggle XML streaming output mode. |

### SQLCMD scripting variables

Variables that `sqlcmd` reads from the environment at startup or exposes for use via `$(name)` substitution. Set any of these before invoking `sqlcmd` to control session behavior without adding flags to the command line.

| Variable | Related flag | Read/Write | Default |
|---|---|---|---|
| `SQLCMDUSER` | `-U` | R | `""` |
| `SQLCMDPASSWORD` | `-P` | — | `""` |
| `SQLCMDSERVER` | `-S` | R | `"DefaultLocalInstance"` |
| `SQLCMDWORKSTATION` | `-H` | R | computer name |
| `SQLCMDDBNAME` | `-d` | R | `""` |
| `SQLCMDLOGINTIMEOUT` | `-l` | R/W | `8` seconds |
| `SQLCMDSTATTIMEOUT` | `-t` | R/W | `0` (infinite) |
| `SQLCMDHEADERS` | `-h` | R/W | `0` |
| `SQLCMDCOLSEP` | `-s` | R/W | space |
| `SQLCMDCOLWIDTH` | `-w` | R/W | `0` |
| `SQLCMDPACKETSIZE` | `-a` | R | `4096` |
| `SQLCMDERRORLEVEL` | `-m` | R/W | `0` |
| `SQLCMDMAXVARTYPEWIDTH` | `-y` | R/W | `256` |
| `SQLCMDMAXFIXEDTYPEWIDTH` | `-Y` | R/W | `0` (unlimited) |
| `SQLCMDEDITOR` | — | R/W | `edit.com` |
| `SQLCMDINI` | — | R | `""` — path to a startup script auto-run on session open |
| `SQLCMDUSEAAD` | set by `-G` | — | `false` |

---
