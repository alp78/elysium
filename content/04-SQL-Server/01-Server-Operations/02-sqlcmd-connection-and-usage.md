---
title: "02 - sqlcmd Connection and Usage"
tags:
  - sql-server
  - administration
  - sqlcmd
aliases:
  - sqlcmd
  - SQL Server command-line client
description: "Production sqlcmd usage for connection testing, inline queries, script execution, variables, error handling, and DAC access, grounded on the current environment."
parent: "[[domain-server-operations]]"
links:
  - "[[06-essential-dba-queries]]"
  - "[[07-backup-types-and-strategy]]"
  - "[[08-restore-and-recovery]]"
created: 2026-03-22
updated: 2026-04-08
status: complete
---

# sqlcmd Connection and Usage

`sqlcmd` is the primary SQL Server command-line client for automation and emergency operations. It matters because it gives you a direct, scriptable path into SQL Server without SSMS. That makes it the tool you use for backup scripts, restore drills, health checks, migrations, and last-mile diagnostics when you want an exact exit code and a reproducible command line.

---

## Current Environment

Start by checking which `sqlcmd` implementation is actually installed. The command surface is similar between variants, but not identical.

### Installed Client

#### Check the installed `sqlcmd` variant and core flag surface

> [!info]-
> This command prints the built-in help banner for the installed `sqlcmd` binary.
>
> - The banner identifies whether this is the classic Microsoft ODBC-based utility or the newer Go-based variant.
> - The usage lines show which flags the installed client supports.
> - In this environment, the current goal is not just to see the syntax. It is to identify which client you are automating against.
>
> *This command identifies the installed `sqlcmd` variant and shows the core connection and execution flags it supports.*
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
```

*This is the classic Microsoft `sqlcmd` client, not the newer Go-based utility. The version banner and the classic usage surface matter because flag behavior and documentation differ between the two variants. In practical terms, automation written for this environment should assume classic `sqlcmd` semantics unless the client is explicitly replaced.*

#### Check whether `Invoke-Sqlcmd` is available in PowerShell

> [!info]-
> `Invoke-Sqlcmd` belongs to the PowerShell `SqlServer` module, not to `sqlcmd` itself.
>
> - If it is installed, PowerShell can execute SQL directly and return objects instead of plain text.
> - If it is not installed, shell automation should use `sqlcmd` rather than assuming the PowerShell cmdlet exists.
>
> *This command checks whether the PowerShell `Invoke-Sqlcmd` cmdlet is installed on the current machine.*
>
```powershell
if (Get-Command Invoke-Sqlcmd -ErrorAction SilentlyContinue) {
    Get-Command Invoke-Sqlcmd | Select-Object Name, Source
} else {
    [pscustomobject]@{ Name = 'Invoke-Sqlcmd'; Source = 'Not installed' }
}
```

| Name | Source |
|---|---|
| Invoke-Sqlcmd | Not installed |

*`Invoke-Sqlcmd` is not installed here, so any documented PowerShell examples need to be treated as optional patterns rather than current local tooling. For automation on this machine, `sqlcmd` is the reliable baseline CLI.*

---

## Core Connection Patterns

These are the connection patterns that matter most operationally: proving connectivity, choosing the target database, and keeping the command deterministic in scripts.

### Basic Connectivity

#### Connect with SQL authentication and run a one-shot query

> [!info]-
> This is the most common automation pattern for `sqlcmd`:
>
> - `-S` selects the server and port
> - `-U` and `-P` provide SQL authentication
> - `-d` selects the default database
> - `-C` trusts the server certificate, which is often required in lab or self-signed environments
> - `-Q` executes a query and exits immediately
>
> The output of `SELECT DB_NAME()` is a simple but useful proof: it confirms both connectivity and database context.
>
> *This command opens a SQL-authenticated session, executes one query, and exits immediately.*
>
```powershell
sqlcmd -S localhost,1434 -U sa -P "EsgDev2026Pass1" -d master -C -Q "SELECT DB_NAME() AS current_database;"
```

| current_database |
|---|
| master |

*The command succeeded and the session defaulted to `master`, exactly as requested by `-d master`. This is the minimum viable connectivity test for scripted administration: it proves login success, network reachability, SQL execution, and database targeting in one short command.*

#### Run a query file instead of inline SQL

*This command executes the contents of a `.sql` file as a script instead of embedding the SQL directly in the shell command.*

```powershell
sqlcmd -S localhost,1434 -U sa -P "EsgDev2026Pass1" -d stoxx -C -i ".\scripts\health-check.sql"
```

---

## Variables And Error Handling

The two `sqlcmd` features that matter most in automation are variable substitution and fail-fast exit behavior.

### SQLCMD Variables

#### Pass a SQLCMD variable into a query

> [!warning]
> SQLCMD variable substitution is text substitution, not parameterization. Do not feed untrusted input into `$(...)` placeholders.
>
> [!success]
> Use SQLCMD variables for trusted automation inputs such as environment names, database names, or file paths controlled by the deployment process.
>
> [!info]-
> This pattern uses the `-v` flag to define a SQLCMD variable.
>
> - `-v dbname="stoxx"` defines the variable value
> - `$(dbname)` is replaced before SQL Server receives the query text
>
> This is useful for environment-specific scripts that should not hardcode one database name.
>
> *This command passes a SQLCMD variable and proves that the client substitutes it before sending the query to SQL Server.*
>
```powershell
sqlcmd -S localhost,1434 -U sa -P "EsgDev2026Pass1" -d master -C -b -W -s "|" -Q 'SET NOCOUNT ON; SELECT ''$(dbname)'' AS sqlcmd_variable_value;' -v dbname="stoxx"
```

| sqlcmd_variable_value |
|---|
| stoxx |

*The output confirms real SQLCMD substitution, not just a shell variable or a comment convention. SQL Server received the literal string `stoxx` because the `sqlcmd` client replaced `$(dbname)` before the batch was sent.*

### Exit Codes

#### Fail the shell command when SQL Server returns an error

> [!warning]
> Without `-b`, `sqlcmd` can print an error and still exit in a way that is too easy to mishandle in automation.
>
> [!success]
> Use `-b` in CI, deployment scripts, and operational automation so SQL errors stop the script immediately and propagate a failure exit code.
>
> *This command pattern makes `sqlcmd` terminate with an error status when a SQL batch fails.*
>
```powershell
sqlcmd -S localhost,1434 -U sa -P "EsgDev2026Pass1" -d stoxx -C -b -i ".\scripts\deploy.sql"
```

#### Why `-b` matters operationally

| Flag or pattern | Meaning |
|---|---|
| `-Q` | Execute one query and exit |
| `-i` | Read SQL from a script file |
| `-b` | Fail on SQL error instead of treating error text as a non-fatal console message |
| `-d` | Set the default database context |
| `-C` | Trust the TLS certificate |

---

## Output Shaping

Most automation either wants human-readable console output or machine-friendly delimited output. `sqlcmd` can do both, but only if the output flags are explicit.

### Delimited Output

#### Export a query result as delimiter-separated text

> [!info]-
> This pattern uses:
>
> - `-s` to choose the delimiter
> - `-W` to trim trailing spaces
> - `-o` to write to a file instead of stdout
>
> For automation, this is often enough when you need a quick flat export without object conversion.
>
> *This command writes a query result to a delimited output file suitable for downstream processing.*
>
```powershell
sqlcmd -S localhost,1434 -U sa -P "EsgDev2026Pass1" -d stoxx -C -Q "SELECT TOP (10) symbol, [date], [close] FROM silver.eurostoxx50_ohlcv ORDER BY [date] DESC;" -s "|" -W -o ".\exports\eurostoxx50_ohlcv.txt"
```

---

## Dedicated Admin Connection

The Dedicated Admin Connection exists for cases where ordinary connections are failing or the instance is too unhealthy to trust regular workload connectivity.

### DAC Pattern

#### Connect through the Dedicated Admin Connection with `sqlcmd`

> [!warning]
> The DAC is for emergency troubleshooting, not routine administration. It is intentionally limited and should be reserved for serious connectivity or workload pathologies.
>
> [!success]
> When you need it, connect to `master`, keep the workload light, and use only the DMVs required to understand the fault condition.
>
> [!info]-
> The `admin:` prefix tells `sqlcmd` to use the Dedicated Admin Connection endpoint.
>
> - DAC is local-only unless `remote admin connections` is enabled on the server
> - only one DAC session is allowed
> - connect to `master` so the session stays available even if another database is impaired
>
> *This command opens a Dedicated Admin Connection for emergency troubleshooting.*
>
```powershell
sqlcmd -S admin:localhost,1434 -U sa -P "EsgDev2026Pass1" -d master -C
```

---

## Related

- [[06-essential-dba-queries]] for the actual diagnostic queries to run once connected
- [[07-backup-types-and-strategy]] for one-shot backup automation patterns that typically use `sqlcmd`
- [[08-restore-and-recovery]] for scripted restore operations where `sqlcmd` is often the delivery vehicle
