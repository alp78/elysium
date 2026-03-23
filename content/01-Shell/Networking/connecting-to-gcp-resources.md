---
type: concept
category: foundations
technology: [bash, powershell, gcp, bigquery, sql-server, airflow]
tags: [shell, bash, sql, airflow, bigquery, gcp]
aliases: [GCP connectivity, gcloud compute ssh, bq query, Cloud Run, Airflow IAP, Datadog agent, connection matrix]
keywords: [GCP connectivity, gcloud compute ssh, gcloud compute scp, bq query, bigquery client, Cloud Run, Airflow webserver, Datadog agent, IAP tunnel, pymssql, pyodbc, sqlcmd, SSMS, Invoke-Sqlcmd, GCS, BigQuery API, connection matrix, service account, application default credentials]
description: "Complete guide to connecting to every GCP resource type: SSH to Compute Engine VMs, SQL Server via IAP tunnel, BigQuery direct API, Cloud Run HTTPS, Airflow webserver, and Datadog agent. Includes a connection quick reference matrix."
related: ["[[iap-tunneling]]", "[[connectivity-testing]]", "[[firewalls]]", "[[socket-inspection]]" ]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Connecting to GCP Resources — A Complete Guide by Service Type

Every GCP resource has different connectivity patterns. This note provides the exact commands for connecting to each resource type you will encounter in data engineering, from both Linux and PowerShell, with the expected output so you can debug when things go wrong.

## Compute Engine VMs (SSH)

The VM is your most direct resource — you SSH into it, run commands, and transfer files.

**Linux:**

```bash
# Interactive SSH (through IAP — no public IP needed)
gcloud compute ssh data-pipeline-sql --zone=europe-west1-b --tunnel-through-iap
# Expected: drops you into a bash prompt on the VM
# If slow (>10s): first-time key propagation, or IAP handshake delay

# Run a command remotely without interactive session
gcloud compute ssh data-pipeline-sql --zone=europe-west1-b --tunnel-through-iap \
    --command="free -h && df -h && ss -tlnp"
# Expected output:
#               total        used        free      shared  buff/cache   available
# Mem:          7.7Gi       4.2Gi       1.1Gi       0.0Ki       2.4Gi       3.2Gi
# Filesystem      Size  Used Avail Use% Mounted on
# /dev/sda1        97G   32G   61G  35% /
# State   Recv-Q  Send-Q   Local Address:Port   Peer Address:Port  Process
# LISTEN  0       128      0.0.0.0:1433          0.0.0.0:*          users:(("sqlservr"...))

# If connection fails:
# "Permission denied" → your SSH key isn't propagated: gcloud compute os-login ssh-keys add
# "Connection timed out" → VM is stopped, or firewall blocks 35.235.240.0/20 on port 22
# "Could not fetch resource" → wrong zone, wrong instance name, or VM deleted
```

**PowerShell:**

```powershell
# Same gcloud commands work identically
gcloud compute ssh data-pipeline-sql --zone=europe-west1-b --tunnel-through-iap
gcloud compute ssh data-pipeline-sql --zone=europe-west1-b --tunnel-through-iap `
    --command="free -h && df -h"

# For file transfer
gcloud compute scp .\local-file.py data-pipeline-sql:/tmp/ --zone=europe-west1-b --tunnel-through-iap
gcloud compute scp data-pipeline-sql:/tmp/output.csv .\local\ --zone=europe-west1-b --tunnel-through-iap
```

## SQL Server on Compute Engine (via IAP Tunnel)

SQL Server on a private GCE VM requires a two-step connection: open the IAP tunnel, then connect through it.

**Linux — Manual tunnel + sqlcmd:**

```bash
# Step 1: Open tunnel (in a dedicated terminal or background)
gcloud compute start-iap-tunnel data-pipeline-sql 1433 \
    --local-host-port=127.0.0.1:1435 \
    --zone=europe-west1-b &
# Expected output:
# Testing if tunnel connection works.
# Listening on port [1435].
# The & puts it in background — the tunnel stays open

# Step 2: Connect with sqlcmd through the tunnel
sqlcmd -S 127.0.0.1,1435 -U sa -P "$SA_PASSWORD" -d analytics_db
# -S 127.0.0.1,1435 = server,port (note: COMMA not colon for SQL Server)
# Expected: 1> prompt (T-SQL interactive mode)

# Quick test query
sqlcmd -S 127.0.0.1,1435 -U sa -P "$SA_PASSWORD" -d analytics_db -Q "SELECT @@VERSION" -W
# Expected: Microsoft SQL Server 2022 (RTM-CU...) - 16.0.4...

# Debug from the VM side (SSH in and check)
gcloud compute ssh data-pipeline-sql --zone=europe-west1-b --tunnel-through-iap \
    --command="ss -tlnp | grep 1433 && echo '---' && ss -tnp | grep 1433"
# Expected:
# LISTEN  0  128  0.0.0.0:1433  0.0.0.0:*  users:(("sqlservr",pid=1234,fd=5))
# ---
# ESTAB  0  0  10.0.0.3:1433  10.0.0.24:56434
```

**Python — pymssql through IAP tunnel:**

```python
# pymssql uses host and port as separate arguments
import pymssql
conn = pymssql.connect(
    server="127.0.0.1",   # local end of the IAP tunnel
    port="1435",           # local tunnel port (NOT 1433)
    user="sa",
    password=os.environ["SA_PASSWORD"],
    database="analytics_db",
    as_dict=True
)
# NOTE: pymssql uses server + port separately
# pyodbc uses "SERVER=127.0.0.1,1435" (comma syntax, like SSMS)
# SQLAlchemy uses "mssql+pyodbc://sa:pass@127.0.0.1,1435/analytics_db"
```

**PowerShell — SSMS or Invoke-Sqlcmd through IAP tunnel:**

```powershell
# Step 1: Open tunnel (in a separate PowerShell window)
gcloud compute start-iap-tunnel data-pipeline-sql 1433 `
    --local-host-port=0.0.0.0:1435 `
    --zone=europe-west1-b
# Expected: "Listening on port [1435]."

# Step 2a: Connect via SSMS
# Server name: 127.0.0.1,1435
# Authentication: SQL Server Authentication
# Login: sa
# Password: (your password)
# Note: SSMS uses COMMA between host and port: 127.0.0.1,1435

# Step 2b: Connect via PowerShell
Invoke-Sqlcmd -ServerInstance "127.0.0.1,1435" -Database "analytics_db" `
    -Username "sa" -Password $env:SA_PASSWORD `
    -TrustServerCertificate -Query "SELECT COUNT(*) AS cnt FROM gold.scores_daily"
# Expected:
# cnt
# ---
# 891
```

## BigQuery (Direct API — No Tunnel Needed)

BigQuery is a serverless service — there is no server to connect to. You authenticate with `gcloud` and queries go directly to the BigQuery API over HTTPS. No IAP, no tunnels, no port management.

**Linux:**

```bash
# Interactive query
bq query --use_legacy_sql=false \
    "SELECT COUNT(*) AS row_count FROM \`data-platform-prod.data-pipeline.signals_daily\`"
# Expected:
# +----------+
# | row_count|
# +----------+
# |     1135 |
# +----------+

# Query to JSON (for scripting)
bq query --use_legacy_sql=false --format=json \
    "SELECT symbol, trade_date FROM \`data-platform-prod.data-pipeline.signals_daily\` LIMIT 3"

# List datasets
bq ls data-platform-prod:
# Expected:
#   datasetId
# -----------
#   data-pipeline

# List tables in a dataset
bq ls data-platform-prod:data-pipeline

# Debug: check authentication
gcloud auth list
# The active account must have BigQuery Data Viewer or BigQuery User role
```

**Python — google-cloud-bigquery:**

```python
from google.cloud import bigquery
client = bigquery.Client(project="data-platform-prod")
# No host, no port, no tunnel — uses Application Default Credentials
# Credentials come from: gcloud auth application-default login (local)
# or: service account key / Workload Identity (production)

df = client.query("SELECT * FROM data-pipeline.signals_daily LIMIT 10").to_dataframe()
```

**PowerShell:**

```powershell
# Same bq commands — gcloud CLI is cross-platform
bq query --use_legacy_sql=false `
    "SELECT COUNT(*) FROM ``data-platform-prod.data-pipeline.signals_daily``"
# Note: backtick escaping in PowerShell requires double backticks ``
```

> [!info] Why BigQuery Doesn't Need a Tunnel
> BigQuery has no "server" running on a VM. It's a multi-tenant API endpoint at `bigquery.googleapis.com`. Your query is sent as an HTTPS request, BigQuery allocates compute on the fly, runs the query, and returns results. The only "firewall" is IAM: does your account have the `bigquery.jobs.create` permission?

## Cloud Run Services (HTTPS — No Tunnel Needed)

Cloud Run services expose an HTTPS endpoint. You call them like any API.

```bash
# Get the service URL
gcloud run services describe data-pipeline-pipeline --region=europe-west1 --format="value(status.url)"
# Expected: https://data-pipeline-pipeline-abc123-ew.a.run.app

# Call the service
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
    https://data-pipeline-pipeline-abc123-ew.a.run.app/health
# Expected: {"status":"healthy"}

# For services that require no auth (allUsers):
curl https://data-pipeline-dashboard-abc123-ew.a.run.app
```

```powershell
# PowerShell equivalent
$token = gcloud auth print-identity-token
$url = gcloud run services describe data-pipeline-pipeline --region=europe-west1 --format="value(status.url)"
Invoke-RestMethod -Uri "$url/health" -Headers @{Authorization = "Bearer $token"}
```

## Airflow Webserver on Compute Engine (via IAP Tunnel)

Airflow runs on port 8080 inside the VM. Same pattern as SQL Server: tunnel + connect.

```bash
# Open tunnel to Airflow
gcloud compute start-iap-tunnel data-pipeline-airflow 8080 \
    --local-host-port=127.0.0.1:8080 \
    --zone=europe-west1-b
# Then open browser: http://localhost:8080
# Login with your Airflow credentials

# Quick health check via CLI
curl -s http://localhost:8080/api/v1/health | python -m json.tool
# Expected:
# {
#     "metadatabase": {"status": "healthy"},
#     "scheduler": {"status": "healthy", "latest_scheduler_heartbeat": "2026-03-10T08:00:00+00:00"}
# }
```

```powershell
# PowerShell
gcloud compute start-iap-tunnel data-pipeline-airflow 8080 `
    --local-host-port=127.0.0.1:8080 `
    --zone=europe-west1-b
# Then: Start-Process "http://localhost:8080"

Invoke-RestMethod -Uri "http://localhost:8080/api/v1/health"
```

## Datadog Agent on Compute Engine

Datadog agent listens on localhost only — you must SSH into the VM to interact with it.

```bash
# SSH in and check agent status
gcloud compute ssh data-pipeline-sql --zone=europe-west1-b --tunnel-through-iap \
    --command="sudo datadog-agent status | head -30"
# Expected:
# Agent (running)
#   Version: 7.x.x
#   Status: Running
#   Checks: [sqlserver, disk, cpu, memory, network, ...]

# Check if agent can reach Datadog intake
gcloud compute ssh data-pipeline-sql --zone=europe-west1-b --tunnel-through-iap \
    --command="sudo datadog-agent diagnose --include connectivity"

# Verify agent ports from the VM
gcloud compute ssh data-pipeline-sql --zone=europe-west1-b --tunnel-through-iap \
    --command="ss -tlnp | grep -E '(5000|5001|8126)'"
# Expected:
# LISTEN  0  4096  127.0.0.1:5000   0.0.0.0:*   users:(("agent",pid=...))
# LISTEN  0  4096  127.0.0.1:5001   0.0.0.0:*   users:(("agent",pid=...))
# LISTEN  0  4096  127.0.0.1:8126   0.0.0.0:*   users:(("trace-agent",pid=...))
```

## Connection Quick Reference Matrix

| Resource | Protocol | Needs Tunnel? | Local Command | Port |
|----------|----------|---------------|---------------|------|
| **GCE VM (SSH)** | SSH | IAP (automatic) | `gcloud compute ssh` | 22 |
| **SQL Server on GCE** | TDS | IAP tunnel | `gcloud start-iap-tunnel` → SSMS/sqlcmd | 1433 |
| **PostgreSQL on GCE** | PostgreSQL | IAP tunnel | `gcloud start-iap-tunnel` → psql | 5432 |
| **Airflow on GCE** | HTTP | IAP tunnel | `gcloud start-iap-tunnel` → browser | 8080 |
| **BigQuery** | HTTPS/API | No | `bq query` / Python client | 443 |
| **Cloud Run** | HTTPS | No | `curl` / browser | 443 |
| **Cloud Storage** | HTTPS/API | No | `gsutil` / Python client | 443 |
| **Datadog Agent** | HTTP | SSH into VM | `datadog-agent status` (on VM) | 5000/8126 |
| **Docker on GCE** | Unix socket | SSH into VM | `docker ps` (on VM) | N/A |

> [!tip] The Pattern
> Anything running on a VM with no public IP requires an IAP tunnel (or SSH). Anything that's a Google-managed service (BigQuery, Cloud Run, GCS) uses HTTPS APIs directly — no tunnel, no port management, just IAM.

## Related
- [[iap-tunneling]] — deep dive into how IAP tunnels work and how to debug them
- [[firewalls]] — firewall rules required for IAP (`35.235.240.0/20`)
- [[socket-inspection]] — verify what's listening on the VM before connecting
- [[data-transfer]] — moving files to/from GCE VMs and GCS
