---
title: "06 - Connecting to GCP Resources"
type: concept
category: foundations
technology: [bash, powershell, gcp, bigquery, sql-server, airflow]
tags: [shell, gcp, networking]
aliases: [GCP connectivity, gcloud compute ssh, bq query, Cloud Run, Airflow IAP, Datadog agent, connection matrix]
keywords: [GCP connectivity, gcloud compute ssh, gcloud compute scp, bq query, bigquery client, Cloud Run, Airflow webserver, Datadog agent, IAP tunnel, pymssql, pyodbc, sqlcmd, SSMS, Invoke-Sqlcmd, GCS, BigQuery API, connection matrix, service account, application default credentials]
description: "Complete guide to connecting to every GCP resource type: SSH to Compute Engine VMs, SQL Server via IAP tunnel, BigQuery direct API, Cloud Run HTTPS, Airflow webserver, and Datadog agent. Includes a connection quick reference matrix."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Connecting to GCP Resources

> [!quote]
> "The interesting thing about cloud computing is that we've redefined cloud computing to include everything that we already do."
>
> — **Larry Ellison**, Oracle analyst conference (2008)

> [!abstract]- Summary
> GCP resources fall into three connectivity categories: IAP-tunneled VMs (SSH, SQL Server, Airflow), localhost-only services reachable only inside an SSH session (Datadog Agent), and Google-managed HTTPS API services requiring no tunnel (BigQuery, Cloud Run, Cloud Storage). This note provides exact commands for all categories from both Linux and PowerShell.
>
> **Compute Engine SSH access** — `gcloud compute ssh` with automatic IAP tunneling and OS Login key management; `gcloud compute scp` for file transfers.
>
> **SQL Server via IAP tunnel** — `gcloud compute start-iap-tunnel` → `sqlcmd` / SSMS / `pymssql`; comma syntax `127.0.0.1,1435` for all SQL Server clients except `pymssql`.
>
> **BigQuery direct API access** — no tunnel, no port; `bq` CLI and `google-cloud-bigquery` Python client authenticate via ADC or `gcloud auth`; `--use_legacy_sql=false` required.
>
> **Cloud Run HTTPS endpoints** — public or IAM-protected `*.run.app` endpoints; `gcloud auth print-identity-token` for private services.
>
> **Airflow on Compute Engine** — IAP tunnel to port 8080 then browser; Airflow REST API health endpoint verifiable via `curl` or `Invoke-RestMethod`.
>
> **Datadog Agent diagnostics** — agent binds to `127.0.0.1` only; must SSH into the VM to run `datadog-agent status`; ports 5000, 5001, 8126.
>
> **Connection quick reference matrix** — table of all resource types with protocol, tunnel requirement, local command, and port.

> [!note]- Glossary
> **IAP (Identity-Aware Proxy)**
> - Google's zero-trust proxy that authenticates the caller's Google identity before forwarding TCP traffic to a private GCE VM. Requires no VPN or public IP on the VM side — IAP validates the caller's IAM permissions at the Google control plane before forwarding any packet.
> - Required for every connectivity pattern in this note that targets a VM without a public IP: SSH, SQL Server, Airflow, and Datadog all route through IAP.
> >
> > [!info] Cross-platform parity
> >
> > IAP tunneling works identically from bash and PowerShell via the same `gcloud compute ssh` and `gcloud compute start-iap-tunnel` commands.
>
> ---
>
> `gcloud compute ssh`
> - GCP CLI command that manages SSH key distribution automatically and opens a terminal session to a GCE VM; adds `--tunnel-through-iap` to route through IAP when the VM has no public IP.
> - The primary tool for interactive shell access and remote one-off command execution on Compute Engine VMs; eliminates manual SSH key management.
> >
> > [!info] Remote command flag
> >
> > The `--command` flag executes a one-liner on the VM and streams output back without opening an interactive shell — useful for health checks and diagnostics.
>
> ---
>
> `gcloud compute scp`
> - Secure file-copy wrapper that uses the same IAP-tunneled SSH channel as `gcloud compute ssh`; remote paths use `instance-name:/path/on/vm` syntax; add `--recurse` for directories.
> - The standard way to move files to and from GCE VMs without manually configuring SSH keys or opening additional firewall rules.
> >
> > [!info] Trailing-slash semantics
> >
> > Follows standard `scp` behavior: `source/` copies the directory's contents; `source` (no trailing slash) copies the directory itself. This distinction is a common source of transfer errors.
>
> ---
>
> `gcloud compute start-iap-tunnel`
> - Opens a TCP forwarding tunnel through IAP between a local port (`--local-host-port`) and a port on the target VM; runs as a foreground process and closes when killed.
> - Required for non-SSH services running on private VMs (SQL Server port 1433, Airflow port 8080); allows any local client to connect as if the service were running on localhost.
> >
> > [!info] Background execution
> >
> > Run with `&` on Linux or in a separate terminal on PowerShell, then connect any client to the local port. The tunnel must stay alive for the duration of the client session.
>
> ---
>
> `gsutil` / `gcloud storage`
> - CLI tools for Google Cloud Storage; `gsutil` is the legacy tool with per-object threading; `gcloud storage` is the modern replacement with parallel composite transfers by default.
> - The standard interface for uploading, downloading, syncing, and managing lifecycle policies on GCS buckets from both Linux and PowerShell.
> >
> > [!warning] Destructive rsync flag
> >
> > `gsutil rsync -d` permanently deletes destination-only objects. GCS has no recycle bin. Always preview with `-n` (dry-run) before running with `-d`.
>
> ---
>
> **Service account**
> - A GCP non-human identity of the form `name@project.iam.gserviceaccount.com` used by VMs, Cloud Run services, and pipelines to authenticate to GCP APIs; granted IAM roles the same way as a user account.
> - VMs authenticate to BigQuery, GCS, and other services through their attached service account; the role set on this account is the effective permission boundary for the workload.
> >
> > [!warning] Default account is over-privileged
> >
> > The Compute Engine default service account carries the Editor role. Always attach a custom service account with only the roles the workload needs.
>
> ---
>
> **Application Default Credentials (ADC)**
> - A credential-resolution chain used by all Google client libraries and the `bq` CLI; on a developer workstation ADC is populated via `gcloud auth application-default login`; on GCE it resolves automatically from the attached service account.
> - Allows the same application code to authenticate both locally and in production without any code changes — only the credential source changes between environments.
> >
> > [!info] Implicit resolution
> >
> > Client libraries call ADC implicitly. No credentials need to be passed in code — the library discovers the right source (workstation login or attached service account) at runtime.
>
> ---
>
> **TDS (Tabular Data Stream)**
> - The wire protocol used by SQL Server for client-server communication, running on port 1433; SQL Server clients express the server address as `host,port` (comma) rather than the Unix `host:port` convention.
> - Defines how all SQL Server clients in this note connect through the IAP tunnel: the local tunnel port (`127.0.0.1,1435`) must be expressed with comma syntax in every connection string.
> >
> > [!info] pymssql exception
> >
> > `sqlcmd`, SSMS, pyodbc, and SQLAlchemy all use comma syntax. `pymssql` is the sole exception: it takes `server` and `port` as separate keyword arguments.
>
> ---
>
> `sqlcmd`
> - Microsoft's command-line SQL Server client; accepts `-S host,port` for server, `-U` / `-P` for credentials, `-d` for database, and `-Q` to run a query and exit; available on Linux via the `mssql-tools` package.
> - The primary tool for verifying SQL Server connectivity through the IAP tunnel and running ad-hoc queries from both Linux and PowerShell.
> >
> > [!info] PowerShell equivalent
> >
> > `Invoke-Sqlcmd` is the PowerShell cmdlet equivalent, part of the `SqlServer` module; accepts the same `host,port` syntax via `-ServerInstance`.
>
> ---
>
> `pymssql` / `pyodbc`
> - Python libraries for connecting to SQL Server; `pymssql` wraps FreeTDS and takes `server` and `port` as separate arguments; `pyodbc` uses an ODBC DSN string with comma syntax; SQLAlchemy supports both via connection URL.
> - Used in Python pipelines to query SQL Server through the IAP tunnel on the same local port exposed by `gcloud compute start-iap-tunnel`.
> >
> > [!info] Production driver recommendation
> >
> > Prefer `pyodbc` with the ODBC Driver 18 for SQL Server in production; `pymssql` is simpler for scripts but is less actively maintained.
>
> ---
>
> **Identity token vs Access token**
> - An identity token (JWT produced by `gcloud auth print-identity-token`) asserts the caller's identity and is consumed by Cloud Run's IAM invoker check; an access token (from `gcloud auth print-access-token`) proves IAM permissions and is consumed by Google API services such as BigQuery and GCS.
> - Choosing the wrong token type is the most common authentication error when calling Cloud Run: Cloud Run requires an identity token in the `Authorization: Bearer` header, not an access token.
> >
> > [!danger] Token type mismatch
> >
> > Sending an access token to a Cloud Run `Authorization: Bearer` header fails the invoker check silently — the service returns 403. Always use `gcloud auth print-identity-token` for Cloud Run.
>
> ---
>
> `bq` CLI
> - The BigQuery command-line tool, part of the Google Cloud SDK; sends queries as HTTPS requests to `bigquery.googleapis.com`; standard SQL mode must be enabled explicitly with `--use_legacy_sql=false`.
> - The standard way to run ad-hoc BigQuery queries, inspect datasets, and export results from both Linux and PowerShell without writing Python client code.
> >
> > [!info] Backtick escaping by shell
> >
> > In bash, fully-qualified table names must be escaped as `` \` `` inside double-quoted strings. In PowerShell, use double backticks ` `` ` to produce a literal backtick character.

Every GCP resource has different connectivity patterns. This note provides the exact commands for connecting to each resource type you will encounter in data engineering, from both Linux and PowerShell, with the expected output so you can debug when things go wrong.

The connectivity model for GCP resources falls into three categories: resources you SSH into (Compute Engine VMs), resources that require an IAP tunnel before you can connect (SQL Server, Airflow, PostgreSQL on private VMs), and Google-managed services that expose HTTPS API endpoints directly (BigQuery, Cloud Run, Cloud Storage).

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {'primaryColor': '#292e42','primaryTextColor': '#c0caf5','primaryBorderColor': '#565f89','lineColor': '#565f89','secondaryColor': '#1a1b26','tertiaryColor': '#24283b','noteTextColor': '#c0caf5','noteBkgColor': '#292e42','textColor': '#c0caf5','fontSize': '14px'}}}%%
flowchart LR
    Dev["Developer<br>Workstation"]

    subgraph IAP["IAP-Protected (Private VMs)"]
        SSH["GCE VM<br>SSH port 22"]
        SQL["SQL Server<br>TDS port 1433"]
        Airflow["Airflow<br>HTTP port 8080"]
        DD["Datadog Agent<br>localhost only"]
    end

    subgraph API["Google-Managed APIs (HTTPS/443)"]
        BQ["BigQuery<br>bigquery.googleapis.com"]
        CR["Cloud Run<br>*.run.app"]
        GCS["Cloud Storage<br>storage.googleapis.com"]
    end

    Dev -->|"gcloud compute ssh<br>(IAP automatic)"| SSH
    Dev -->|"gcloud start-iap-tunnel<br>then sqlcmd / SSMS"| SQL
    Dev -->|"gcloud start-iap-tunnel<br>then browser"| Airflow
    SSH -->|"SSH then<br>datadog-agent status"| DD
    Dev -->|"bq / Python client<br>(IAM only)"| BQ
    Dev -->|"curl / Invoke-RestMethod<br>(identity token)"| CR
    Dev -->|"gsutil / Python client<br>(IAM only)"| GCS
```

## PowerShell / Linux | Compute Engine | SSH access

`gcloud compute ssh` wraps standard SSH with automatic IAP tunneling and OS Login key management. It connects you to a Compute Engine VM over port 22 through Google's Identity-Aware Proxy, meaning the VM itself does not need a public IP address. The first connection may take 10–30 seconds while gcloud propagates your SSH public key to VM metadata.

### PowerShell / Linux | gcloud compute ssh | interactive and remote commands

Use `gcloud compute ssh` for both interactive shells and one-off remote command execution. The `--tunnel-through-iap` flag routes the SSH connection through IAP, which is required for VMs with no external IP.

#### Open an interactive SSH session on a GCE VM

```bash
gcloud compute ssh data-pipeline-sql --zone=europe-west1-b --tunnel-through-iap
```

#### Run a single remote command without opening an interactive shell

The `--command` flag executes a shell command on the VM and streams its output back to your terminal. This is useful for health checks and quick diagnostics without starting a full session.

```bash
gcloud compute ssh data-pipeline-sql --zone=europe-west1-b --tunnel-through-iap \
    --command="free -h && df -h && ss -tlnp"
```

> [!warning] Common SSH connection errors
>
> - **"Permission denied"** — SSH key not propagated yet. Run `gcloud compute os-login ssh-keys add` or wait for metadata sync.
> - **"Connection timed out"** — VM is stopped, or the firewall blocks `35.235.240.0/20` on port 22.
> - **"Could not fetch resource"** — wrong zone, wrong instance name, or the VM has been deleted.

> [!success] Verify before connecting
>
> Run `gcloud compute instances list` to confirm the VM name, zone, and status (`RUNNING`) before attempting SSH. For firewall issues, confirm the allow-ingress rule for `35.235.240.0/20` on port 22 is attached to the VM's network.

### PowerShell / Linux | gcloud compute scp | file transfer

`gcloud compute scp` transfers files between your local machine and a GCE VM using the same IAP-tunneled SSH channel. The remote path uses the format `instance-name:/path/on/vm`.

#### Upload a local file to the VM

```bash
gcloud compute scp ./local-file.py data-pipeline-sql:/tmp/ \
    --zone=europe-west1-b --tunnel-through-iap
```

#### Download a file from the VM to local

```bash
gcloud compute scp data-pipeline-sql:/tmp/output.csv ./local/ \
    --zone=europe-west1-b --tunnel-through-iap
```

#### Upload a local file to the VM (PowerShell)

```powershell
gcloud compute scp .\local-file.py data-pipeline-sql:/tmp/ `
    --zone=europe-west1-b --tunnel-through-iap
```

#### Download a file from the VM to local (PowerShell)

```powershell
gcloud compute scp data-pipeline-sql:/tmp/output.csv .\local\ `
    --zone=europe-west1-b --tunnel-through-iap
```

| Flag | Syntax | Description |
|---|---|---|
| `--zone` | `--zone=europe-west1-b` | Zone of the target instance (required) |
| `--tunnel-through-iap` | `--tunnel-through-iap` | Route SSH through IAP; required for VMs with no public IP |
| `--command` | `--command="<shell-cmd>"` | Execute a single command on the VM and return output |
| `--ssh-flag` | `--ssh-flag="-L 5432:localhost:5432"` | Pass arbitrary flags to the underlying SSH client |
| `--project` | `--project=my-project-123` | Override the active gcloud project |
| `--recurse` | `--recurse` | (scp only) Recursively copy a directory |

## PowerShell / Linux | SQL Server on Compute Engine | IAP tunnel

SQL Server runs on a private GCE VM and listens on TDS port 1433. Because the VM has no public IP, access requires a two-step process: open an IAP tunnel that forwards a local port to the VM's port 1433, then connect through that local port using any SQL Server client.

### PowerShell / Linux | gcloud start-iap-tunnel | open tunnel to SQL Server

The `gcloud compute start-iap-tunnel` command creates a TCP forwarding tunnel through IAP. While the tunnel process runs, any connection to `127.0.0.1:1435` (the local port) is transparently forwarded to port 1433 on the target VM.

#### Open the IAP tunnel in the background (Linux)

Run the tunnel in a background process so the terminal remains available for the sqlcmd connection step.

```bash
gcloud compute start-iap-tunnel data-pipeline-sql 1433 \
    --local-host-port=127.0.0.1:1435 --zone=europe-west1-b &
```

#### Open the IAP tunnel in a separate window (PowerShell)

In PowerShell, start the tunnel in a new window to keep it running while you work in the current session.

```powershell
gcloud compute start-iap-tunnel data-pipeline-sql 1433 `
    --local-host-port=0.0.0.0:1435 `
    --zone=europe-west1-b
```

```text
Listening on port [1435].
```

> [!warning] SQL Server uses a comma separator for port in the connection string
>
> `sqlcmd -S 127.0.0.1,1435` uses a **comma** between host and port — this is SQL Server's convention inherited from the TDS protocol. Using a colon (`127.0.0.1:1435`) will fail to parse correctly.

> [!success] Always use comma syntax for SQL Server host:port
>
> Correct form: `127.0.0.1,1435` in sqlcmd, SSMS, and pyodbc connection strings. Only `pymssql` takes host and port as separate arguments.

### PowerShell / Linux | sqlcmd | connect and query through tunnel

`sqlcmd` is the SQL Server command-line client. After the IAP tunnel is open, connect to the local forwarding port as if SQL Server were running locally.

#### Open an interactive sqlcmd session (Linux)

```bash
sqlcmd -S 127.0.0.1,1435 -U sa -P "$SA_PASSWORD" -d analytics_db
```

#### Run a quick one-off query to verify the connection (Linux)

```bash
sqlcmd -S 127.0.0.1,1435 -U sa -P "$SA_PASSWORD" -d analytics_db \
    -Q "SELECT @@VERSION" -W
```

```text
Microsoft SQL Server 2019 (RTM-CU18) 15.0.4261.1 (X64)
```

#### Verify SQL Server is listening on the VM before connecting

If the tunnel is open but the connection fails, SSH into the VM and confirm that `sqlservr` is actively bound to port 1433.

```bash
gcloud compute ssh data-pipeline-sql --zone=europe-west1-b --tunnel-through-iap \
    --command="ss -tlnp | grep 1433"
```

```text
LISTEN 0  128  0.0.0.0:1433  0.0.0.0:*  users:(("sqlservr",pid=1234,fd=12))
```

#### Connect and run a query via Invoke-Sqlcmd (PowerShell)

```powershell
Invoke-Sqlcmd -ServerInstance "127.0.0.1,1435" -Database "analytics_db" `
    -Username "sa" -Password $env:SA_PASSWORD `
    -TrustServerCertificate -Query "SELECT COUNT(*) AS cnt FROM gold.scores_daily"
```

```text
cnt
---
891
```

| Flag | Syntax | Description |
|---|---|---|
| `-S` | `-S 127.0.0.1,1435` | Server and port (comma-separated — SQL Server convention) |
| `-U` | `-U sa` | SQL Server login username |
| `-P` | `-P "$SA_PASSWORD"` | Password (use env var to avoid shell history exposure) |
| `-d` | `-d analytics_db` | Database to connect to on login |
| `-Q` | `-Q "SELECT @@VERSION"` | Execute query, print result, and exit |
| `-W` | `-W` | Remove trailing spaces from column output |
| `-o` | `-o output.txt` | Redirect output to a file |

### PowerShell / Linux | pymssql | Python connection through IAP tunnel

`pymssql` is a Python library that connects to SQL Server using the TDS protocol. It takes host and port as separate arguments, unlike pyodbc and SQLAlchemy which use the comma syntax in the connection string.

#### Connect to SQL Server and query through the tunnel (Python)

Extract the inline notes on driver syntax differences so they are explicit for comparison:

- `pymssql`: `server="127.0.0.1", port="1435"` — separate arguments
- `pyodbc`: `"SERVER=127.0.0.1,1435"` — comma syntax in the DSN string
- `SQLAlchemy`: `"mssql+pyodbc://sa:pass@127.0.0.1,1435/analytics_db"` — comma syntax in the URL

```python
import pymssql
import os

conn = pymssql.connect(
    server="127.0.0.1",
    port="1435",
    user="sa",
    password=os.environ["SA_PASSWORD"],
    database="analytics_db",
    as_dict=True
)
```

## PowerShell / Linux | BigQuery | direct API access

BigQuery is a serverless, multi-tenant analytics service. There is no server running on a VM — you do not need an IAP tunnel, a port, or a hostname. Every query is sent as an HTTPS request to `bigquery.googleapis.com`. BigQuery allocates compute resources on demand, executes the query, and returns results. The only access control is IAM: the calling identity must have the `bigquery.jobs.create` permission (typically granted via the BigQuery User or BigQuery Data Viewer role).

### PowerShell / Linux | bq | CLI queries and dataset inspection

The `bq` CLI is part of the Google Cloud SDK and is available on both Linux and PowerShell. It sends queries directly to the BigQuery API. The `--use_legacy_sql=false` flag is required for all queries — without it, `bq` defaults to legacy SQL, which has different syntax and limitations.

#### Count rows in a BigQuery table (Linux)

Backtick-delimited fully-qualified table names (`project.dataset.table`) must be escaped as `\`` in bash to prevent shell interpretation.

```bash
bq query --use_legacy_sql=false \
    "SELECT COUNT(*) AS row_count FROM \`data-platform-prod.data-pipeline.signals_daily\`"
```

```text
+----------+
| row_count|
+----------+
|   1482930|
+----------+
```

#### Export query output as JSON for scripting (Linux)

```bash
bq query --use_legacy_sql=false --format=json \
    "SELECT symbol, trade_date FROM \`data-platform-prod.data-pipeline.signals_daily\` LIMIT 3"
```

```text
[{"symbol":"AAPL","trade_date":"2024-12-31"},{"symbol":"MSFT","trade_date":"2024-12-31"},{"symbol":"GOOGL","trade_date":"2024-12-31"}]
```

#### List all datasets in a project (Linux)

```bash
bq ls data-platform-prod:
```

#### List all tables in a dataset (Linux)

```bash
bq ls data-platform-prod:data-pipeline
```

#### Debug authentication before running queries (Linux)

The active account must have `bigquery.jobs.create` on the target project. If queries fail with "Access Denied," verify which account is active.

```bash
gcloud auth list
```

```text
   Credentialed Accounts
ACTIVE  ACCOUNT
*       user@example.com

To set the active account, run:
    $ gcloud config set account `ACCOUNT`
```

#### Run a BigQuery query from PowerShell

In PowerShell, backtick is the escape character, so fully-qualified table names require double backticks to produce a literal backtick in the string passed to `bq`.

```powershell
bq query --use_legacy_sql=false `
    "SELECT COUNT(*) FROM ``data-platform-prod.data-pipeline.signals_daily``"
```

| Flag | Syntax | Description |
|---|---|---|
| `--use_legacy_sql` | `--use_legacy_sql=false` | Use standard SQL (required; legacy SQL is the default) |
| `--format` | `--format=json` | Output format: `json`, `csv`, `pretty`, `sparse` |
| `--max_rows` | `--max_rows=1000` | Maximum number of rows returned (default: 100) |
| `--location` | `--location=EU` | BigQuery processing region |
| `--project_id` | `--project_id=my-project-123` | Override the active project |
| `--nouse_cache` | `--nouse_cache` | Bypass cached query results |

### PowerShell / Linux | google-cloud-bigquery | Python client

The `google-cloud-bigquery` Python library queries BigQuery using Application Default Credentials (ADC). On a developer workstation, ADC is configured by running `gcloud auth application-default login`. In production, ADC resolves automatically from the Workload Identity or service account attached to the compute resource.

#### Query BigQuery and load results into a DataFrame (Python)

```python
from google.cloud import bigquery

client = bigquery.Client(project="data-platform-prod")

df = client.query(
    "SELECT * FROM data-pipeline.signals_daily LIMIT 10"
).to_dataframe()
```

## PowerShell / Linux | Cloud Run | HTTPS endpoint access

Cloud Run services expose an HTTPS endpoint at a `*.run.app` domain. Calling a Cloud Run service is identical to calling any REST API. Services can be public (accessible without authentication) or private (require an identity token in the `Authorization` header).

### PowerShell / Linux | gcloud + curl | authenticate and call Cloud Run

A Google identity token (produced by `gcloud auth print-identity-token`) proves who the caller is — it is a short-lived JWT scoped to the caller's identity. This is distinct from an access token, which proves what a service account or user is permitted to do. Cloud Run uses identity tokens to enforce its IAM invoker policy.

#### Retrieve the service URL (Linux)

```bash
gcloud run services describe data-pipeline-pipeline \
    --region=europe-west1 \
    --format="value(status.url)"
```

```text
https://data-pipeline-pipeline-abc123-ew.a.run.app
```

#### Call an authenticated Cloud Run service (Linux)

```bash
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
    https://data-pipeline-pipeline-abc123-ew.a.run.app/health
```

```text
{"status":"healthy"}
```

#### Call a public Cloud Run service with no authentication (Linux)

```bash
curl https://data-pipeline-dashboard-abc123-ew.a.run.app
```

#### Retrieve the service URL and call an authenticated endpoint (PowerShell)

```powershell
$token = gcloud auth print-identity-token
$url = gcloud run services describe data-pipeline-pipeline `
    --region=europe-west1 --format="value(status.url)"
Invoke-RestMethod -Uri "$url/health" -Headers @{Authorization = "Bearer $token"}
```

| Flag | Syntax | Description |
|---|---|---|
| `--region` | `--region=europe-west1` | Region where the Cloud Run service is deployed |
| `--format` | `--format="value(status.url)"` | Extract a specific field from the resource description |
| `--platform` | `--platform=managed` | Target managed Cloud Run (default; use `gke` for Cloud Run on GKE) |

## PowerShell / Linux | Airflow on Compute Engine | IAP tunnel to port 8080

Airflow's webserver runs on port 8080 inside the VM and is not exposed publicly. The connection pattern is identical to SQL Server: open an IAP tunnel forwarding a local port to the VM's port 8080, then open the Airflow UI in a browser pointing at the local tunnel endpoint.

### PowerShell / Linux | gcloud start-iap-tunnel | open tunnel to Airflow

#### Open the IAP tunnel to Airflow (Linux)

```bash
gcloud compute start-iap-tunnel data-pipeline-airflow 8080 \
    --local-host-port=127.0.0.1:8080 \
    --zone=europe-west1-b
```

Once the tunnel is running, open `http://localhost:8080` in a browser and log in with your Airflow credentials.

#### Verify Airflow is healthy via the REST API (Linux)

```bash
curl -s http://localhost:8080/api/v1/health | python -m json.tool
```

```text
{
    "metadatabase": {
        "status": "healthy"
    },
    "scheduler": {
        "status": "healthy"
    }
}
```

#### Open the IAP tunnel and launch the browser (PowerShell)

```powershell
gcloud compute start-iap-tunnel data-pipeline-airflow 8080 `
    --local-host-port=127.0.0.1:8080 `
    --zone=europe-west1-b
```

After the tunnel is running, open the browser automatically:

```powershell
Start-Process "http://localhost:8080"
```

#### Verify Airflow health via the REST API (PowerShell)

```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/health"
```

| Flag | Syntax | Description |
|---|---|---|
| `--local-host-port` | `--local-host-port=127.0.0.1:8080` | Local address and port to bind the tunnel on |
| `--zone` | `--zone=europe-west1-b` | Zone of the target instance |
| `--project` | `--project=my-project-123` | Override active project |

## PowerShell / Linux | Datadog Agent on Compute Engine | SSH-only access

The Datadog agent binds all its listeners to `127.0.0.1` (localhost), not to any externally reachable interface. There is no way to open an IAP tunnel to these ports from outside the VM — you must SSH into the VM first and run agent commands from within the SSH session.

The agent exposes three ports, all bound to `127.0.0.1`:

- **5000** — agent HTTP API (health, configuration, metadata)
- **5001** — agent IPC (internal process communication between agent components)
- **8126** — APM trace agent (receives application traces from instrumented services)

### PowerShell / Linux | gcloud compute ssh | Datadog agent diagnostics

#### Check agent status and active checks

```bash
gcloud compute ssh data-pipeline-sql --zone=europe-west1-b --tunnel-through-iap \
    --command="sudo datadog-agent status | head -30"
```

```text
Agent (running)
...
  Version: 7.50.0
  ...
  Active checks: sqlserver, disk, cpu, memory, network
```

#### Test connectivity from the agent to the Datadog intake endpoints

```bash
gcloud compute ssh data-pipeline-sql --zone=europe-west1-b --tunnel-through-iap \
    --command="sudo datadog-agent diagnose --include connectivity"
```

#### Verify all three agent ports are listening on localhost

A healthy agent shows all three ports (`5000`, `5001`, `8126`) bound to `127.0.0.1`.

```bash
gcloud compute ssh data-pipeline-sql --zone=europe-west1-b --tunnel-through-iap \
    --command="ss -tlnp | grep -E '(5000|5001|8126)'"
```

```text
LISTEN  0  128  127.0.0.1:5000   0.0.0.0:*  users:(("agent",pid=2345,fd=8))
LISTEN  0  128  127.0.0.1:5001   0.0.0.0:*  users:(("agent",pid=2345,fd=9))
LISTEN  0  128  127.0.0.1:8126   0.0.0.0:*  users:(("trace-agent",pid=2346,fd=5))
```

> [!tip] Pattern for localhost-only services
>
> Any service bound to `127.0.0.1` on a VM (Datadog, local databases, internal APIs) can only be reached by SSHing into the VM. IAP tunnels route traffic to the VM's network interface, not to localhost — so you cannot tunnel directly into a localhost-only listener.

## Connection quick reference matrix

The table below summarizes the connectivity model for every GCP resource type covered in this note. Use it as a first reference when diagnosing connection failures.

### Connection requirements by resource type

| Resource | Protocol | Needs Tunnel? | Local Command | Port |
|---|---|---|---|---|
| **GCE VM (SSH)** | SSH | IAP (automatic) | `gcloud compute ssh` | 22 |
| **SQL Server on GCE** | TDS | IAP tunnel | `gcloud start-iap-tunnel` → SSMS/sqlcmd | 1433 |
| **PostgreSQL on GCE** | PostgreSQL | IAP tunnel | `gcloud start-iap-tunnel` → psql | 5432 |
| **Airflow on GCE** | HTTP | IAP tunnel | `gcloud start-iap-tunnel` → browser | 8080 |
| **BigQuery** | HTTPS/API | No | `bq query` / Python client | 443 |
| **Cloud Run** | HTTPS | No | `curl` / browser | 443 |
| **Cloud Storage** | HTTPS/API | No | `gsutil` / Python client | 443 |
| **Datadog Agent** | HTTP | SSH into VM | `datadog-agent status` (on VM) | 5000/8126 |
| **Docker on GCE** | Unix socket | SSH into VM | `docker ps` (on VM) | N/A |

> [!tip] The pattern
>
> Anything running on a VM with no public IP requires an IAP tunnel (or SSH). Anything that is a Google-managed service (BigQuery, Cloud Run, GCS) uses HTTPS APIs directly — no tunnel, no port management, just IAM.


> [!example] GCP CLI Access Fit
>
> > [!success] Appropriate
> >
> > - **SSH access to GCE VMs** -- `gcloud compute ssh` with automatic key management and optional IAP tunneling for private VMs.
> > - **File transfers to/from VMs** -- `gcloud compute scp` for quick file copies; `rsync` over IAP tunnel for large or incremental transfers.
> > - **GCS bucket operations** -- `gcloud storage cp` for uploads/downloads; `gsutil rsync` for directory synchronization.
> > - **Authentication setup** -- `gcloud auth login` for interactive sessions; service account activation for automated pipelines.
>
> > [!failure] Inappropriate
> >
> > - **Production data pipelines** -- use GCP client libraries (Python `google-cloud-storage`, C# `Google.Cloud.Storage.V1`) instead of CLI tools for production code.
> > - **Cross-cloud operations** -- `gcloud` is GCP-only. For multi-cloud, use Terraform, Pulumi, or cloud-agnostic SDKs.
> > - **Large-scale data movement** -- for TB-scale transfers, use Storage Transfer Service, Transfer Appliance, or BigQuery Data Transfer Service instead of CLI uploads.

## Warnings

> [!danger] `gsutil rsync -d` permanently deletes destination-only objects
>
> The `-d` flag removes objects in the destination that do not exist in the source. There is no GCS trash or recycle bin. Always preview with `gsutil rsync -n` (dry-run) first.

> [!warning] Default service accounts often have overly broad permissions
>
> The Compute Engine default service account has the Editor role. Follow least-privilege: create a custom service account with only the IAM roles your workload needs.

> [!warning] `gcloud compute ssh` requires the correct zone
>
> Without `--zone`, the command uses the default zone from `gcloud config`. If the VM is in a different zone, the command fails or connects to the wrong instance. Always specify `--zone` explicitly.

## Recommendations

| Scenario | Recommendation |
|---|---|
| SSH to a VM | `gcloud compute ssh <vm> --zone=<zone> --tunnel-through-iap` for private VMs. |
| Copy files to VM | `gcloud compute scp --zone=<zone> local_file <vm>:~/remote_path`. |
| Upload to GCS | `gcloud storage cp local_file gs://bucket/path/`. Use `-m` for parallel multi-file upload. |
| Sync directory to GCS | `gsutil rsync -r -n local_dir/ gs://bucket/path/` (dry-run first), then remove `-n`. |
| Get bearer token for APIs | `gcloud auth print-access-token` for one-off requests. Use client libraries for production. |
| Authenticate in CI/CD | `gcloud auth activate-service-account --key-file=key.json`. Prefer Workload Identity where available. |

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| SSH fails with "Could not fetch resource" | Wrong VM name or zone. | `gcloud compute instances list` to verify name and zone. |
| "Permission denied" on GCS operation | Service account lacks Storage Object Viewer/Creator role. | Grant the required role: `gcloud projects add-iam-policy-binding`. |
| `gsutil rsync` is very slow | Single-threaded by default for large files. | Use `gsutil -m rsync` for parallel operations, or switch to `gcloud storage` which parallelizes by default. |
| `gcloud auth print-access-token` returns expired token | Token TTL is 1 hour. | Re-run the command to get a fresh token. For long-running scripts, use client libraries that auto-refresh. |

## Cross-references
- [gcp-identity-and-connection-patterns](https://alp78.github.io/elysium/06-GCP/Security/gcp-identity-and-connection-patterns) — Security model behind these connections: trust chains, credential types, IAM requirements
- [iap-tunneling](https://alp78.github.io/elysium/01-Shell/Networking/iap-tunneling) — deep dive into how IAP tunnels work and how to debug them
- [firewalls](https://alp78.github.io/elysium/01-Shell/Networking/firewalls) — firewall rules required for IAP (`35.235.240.0/20`)
- [socket-inspection](https://alp78.github.io/elysium/01-Shell/Networking/socket-inspection) — verify what's listening on the VM before connecting
- [data-transfer](https://alp78.github.io/elysium/01-Shell/File-Operations/data-transfer) — moving files to/from GCE VMs and GCS
