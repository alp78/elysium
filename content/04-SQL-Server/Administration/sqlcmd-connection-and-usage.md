---
type: how-to
category: sql-server
technology: [sql-server]
tags: [sql]
aliases: [sqlcmd, go-sqlcmd, mssql-tools, Invoke-Sqlcmd, sql server command line]
keywords: [sqlcmd, sql server command line, mssql-tools18, connection flags, -S -U -P -d -C, execute query, script file, CSV export, PowerShell Invoke-Sqlcmd, go-sqlcmd, IAP tunnel, TDS, ODBC]
description: "How to connect to SQL Server from the command line using sqlcmd, including all common flags, inline queries, script execution, and CSV export in both Linux and PowerShell."
related: [essential-dba-queries, server-configuration, backup-types-and-strategy]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# sqlcmd Connection and Usage

`sqlcmd` is the primary command-line interface for SQL Server, used for connecting, executing ad-hoc queries, running script files, and exporting results. Understanding every flag and output option is essential for scripting production operations and incident response.

## go-sqlcmd vs Classic sqlcmd

Microsoft ships two versions of `sqlcmd`:

- **Classic sqlcmd** (`/opt/mssql-tools18/bin/sqlcmd`): requires ODBC driver, more flags, established — this is what ships with `mssql-tools18` on Linux
- **go-sqlcmd** (just `sqlcmd` if installed separately): no ODBC dependency, modern features, prompts for password securely

> [!tip] Use go-sqlcmd When Available
> `go-sqlcmd` is the future. It has the same flag syntax but adds features like `--help` and secure password prompting. Install it if available on your platform.

---

## Connecting — The First Step in Every Database Operation

The connection command encodes everything: which server, which credentials, which database, and how to handle TLS. Getting this wrong is the most common reason for "cannot connect" errors.

#### sqlcmd -S -U -P -d — connect to SQL Server (Linux)

```bash
# Full connection with all common flags
/opt/mssql-tools18/bin/sqlcmd \
  -S 10.132.0.2,1433 \
  -U sa \
  -P "$SA_PASSWORD" \
  -d analytics_db \
  -C \
  -l 30
```

> [!info] `sqlcmd` connection flags
> - `-S` — server (IP,port — note the **comma**, not colon)
> - `-U` — username | `-P` — password (from env var, not hardcoded)
> - `-d` — default database (avoids `USE` on every session)
> - `-C` — trust server certificate (required for self-signed certs on Linux)
> - `-l 30` — login timeout in seconds (default 15 — increase for slow networks)

```bash
# Execute a query inline and exit
sqlcmd -S 10.132.0.2 -U sa -P "$SA_PASSWORD" -d analytics_db -C \
  -Q "SELECT COUNT(*) AS total_rows FROM dbo.market_data"
# -Q (uppercase) = execute and exit
# -q (lowercase) = execute and stay in interactive mode

# Execute a SQL script file
sqlcmd -S 10.132.0.2 -U sa -P "$SA_PASSWORD" -d analytics_db -C -i /path/to/script.sql
# -i = input file
# Use case: running migration scripts, maintenance procedures

# Output to CSV
sqlcmd -S 10.132.0.2 -U sa -P "$SA_PASSWORD" -d analytics_db -C \
  -Q "SELECT symbol, date, close FROM dbo.market_data WHERE _index = 'market_index'" \
  -s "," -W -o output.csv
# -s "," = column separator (comma)
# -W = remove trailing whitespace from each column
# -o = output file
```

#### Invoke-Sqlcmd — connect to SQL Server (PowerShell)

```powershell
# Using the SqlServer module (recommended for PowerShell workflows)
Invoke-Sqlcmd -ServerInstance "10.132.0.2" -Database "analytics_db" `
    -Username "sa" -Password $env:SA_PASSWORD `
    -TrustServerCertificate `
    -Query "SELECT COUNT(*) AS total_rows FROM dbo.market_data"
# Returns DataRow objects — pipe to Format-Table, Export-Csv, etc.

# Windows Authentication (domain-joined machine)
Invoke-Sqlcmd -ServerInstance "SQLSERVER01" -Database "analytics_db" `
    -Query "SELECT @@VERSION"
# Uses your Windows credentials — no username/password needed

# Export query results to CSV
Invoke-Sqlcmd -ServerInstance "10.132.0.2" -Database "analytics_db" `
    -Username "sa" -Password $env:SA_PASSWORD -TrustServerCertificate `
    -Query "SELECT * FROM dbo.instrument_tickers" |
    Export-Csv -Path tickers.csv -NoTypeInformation
```

---

## Connecting Through IAP Tunnel (GCP)

When the SQL Server VM has no public IP, all access goes through an Identity-Aware Proxy (IAP) TCP tunnel.

#### gcloud compute start-iap-tunnel — Step 1: open IAP tunnel

```powershell
gcloud compute start-iap-tunnel analytics-sql 1433 --local-host-port=0.0.0.0:1435 --zone=europe-west1-b
```

> [!warning] Windows Gotcha
> Use `0.0.0.0:1435` rather than `localhost:1435` or `127.0.0.1:1435`. Using a specific address may bind to only one IP version, causing connection timeouts in sqlcmd/SSMS.

#### sqlcmd -S localhost — Step 2: connect through the IAP tunnel

```powershell
# Get the SA password from Secret Manager
gcloud secrets versions access latest --secret=analytics-db-password

# Connect through the tunnel (note: SQL Server uses comma, not colon)
sqlcmd -S 127.0.0.1,1435 -U sa -P 'YourPassword' -C -d analytics_db
```

#### SSMS through IAP tunnel — connection dialog settings

| Setting | Value |
|---------|-------|
| **Server name** | `127.0.0.1,1435` |
| **Authentication** | SQL Server Authentication |
| **Login** | `sa` |
| **Trust server certificate** | Yes |

---

## Scripted Connection Testing

The try/catch pattern using `&&` and `||`:

```bash
# Try to connect; exit with clear error message if it fails
sqlcmd -S 10.132.0.2 -U sa -P "$DB_PASS" -d analytics_db -Q "SELECT 1" > /dev/null 2>&1 \
  && echo "Database connection OK" \
  || { echo "FATAL: Cannot connect to database" >&2; exit 1; }
```

---

## Automated Backup Script Using sqlcmd

```bash
# Automated backup-to-GCS script (run via cron)
#!/usr/bin/env bash
set -euo pipefail
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="/var/opt/mssql/backup/mydb_full_${DATE}.bak"
sqlcmd -S localhost -U sa -P "$SA_PASSWORD" -C -Q "BACKUP DATABASE analytics_db TO DISK = '${BACKUP_PATH}' WITH COMPRESSION, CHECKSUM"
gcloud storage cp "${BACKUP_PATH}" gs://analytics-db-backups/daily/
rm "${BACKUP_PATH}"  # remove local copy after upload
```

---

## Flag Quick Reference

| Flag | Purpose | Example |
|------|---------|---------|
| `-S` | Server (IP,port — comma-separated) | `-S 10.132.0.2,1433` |
| `-U` | Username | `-U sa` |
| `-P` | Password | `-P "$SA_PASSWORD"` |
| `-d` | Default database | `-d analytics_db` |
| `-C` | Trust server certificate (self-signed) | `-C` |
| `-l` | Login timeout in seconds | `-l 30` |
| `-Q` | Execute query and exit | `-Q "SELECT @@VERSION"` |
| `-q` | Execute query and stay interactive | `-q "SELECT 1"` |
| `-i` | Input script file | `-i migration.sql` |
| `-o` | Output file | `-o results.txt` |
| `-s` | Column separator | `-s ","` |
| `-W` | Remove trailing whitespace | `-W` |
| `-h` | Header row interval (-1 = no headers) | `-h -1` |

> [!warning] Never Hardcode Passwords
> `sqlcmd -S 10.132.0.2 -U sa -P 'MyPassword123'` — the password is visible in the process list.
> Always use environment variables: `sqlcmd -S 10.132.0.2 -U sa -P "$SA_PASSWORD"`

---

## Dedicated Admin Connection (DAC)

Port 1431 is the Dedicated Admin Connection — an emergency-only connection that bypasses normal resource limits. Used when the server is so overloaded that normal connections are rejected.

```bash
# Connect via DAC (localhost only)
sqlcmd -S admin:localhost -U sa
```

## Related

- [[essential-dba-queries]] — queries to run after connecting
- [[server-configuration]] — configuring max memory, RCSI, recovery models
- [[backup-types-and-strategy]] — using sqlcmd for backup operations
- [[restore-and-recovery]] — RESTORE commands
