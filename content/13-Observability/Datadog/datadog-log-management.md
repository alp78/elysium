---
type: how-to
category: observability
technology: [datadog, sql-server, airflow, docker]
tags: [monitoring, observability, sql, docker, airflow, datadog]
aliases: [Log Collection, SQL Server Log Collection, Datadog Logs, errorlog, log tailing]
keywords: [datadog log collection, SQL server errorlog, log tailing, logs.yaml, file tailing, source sqlserver, dd-agent mssql group, bytes read, start_position beginning, container logs, docker autodiscovery, DD_LOGS_ENABLED, DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL, Live Tail, Log Explorer]
description: "How to configure Datadog log collection for the data platform — SQL Server errorlog file tailing on the SQL VM and Docker container log collection on the Airflow VM."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Datadog Log Management

> [!quote]
> "The most effective debugging tool is still careful thought, coupled with judiciously placed print statements."
> — **Brian Kernighan**

Log collection for the data platform uses two separate mechanisms: **file tailing** for the SQL Server errorlog (on the SQL VM), and **Docker socket autodiscovery** for Airflow container logs (on the Airflow VM).

> [!warning] Logs Require Separate Config
> The Datadog Agent collects SQL Server metrics automatically via the [SQL Server integration](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-sql-server-integration), but **log collection requires a separate config file** (`logs.yaml`). Metrics and logs are configured independently.

---

## SQL Server Errorlog Collection

### Configure the Log Source

SSH into the SQL VM and write the log config file:

```bash
gcloud compute ssh data-pipeline-sql --zone=europe-west1-b --tunnel-through-iap

sudo mkdir -p /etc/datadog-agent/conf.d/sqlserver.d
sudo tee /etc/datadog-agent/conf.d/sqlserver.d/logs.yaml <<EOF
logs:
  - type: file
    path: /var/opt/mssql/log/errorlog
    service: data-pipeline-sql
    source: sqlserver
EOF

sudo chown -R dd-agent:dd-agent /etc/datadog-agent/conf.d/sqlserver.d/
sudo usermod -aG mssql dd-agent
sudo systemctl restart datadog-agent
```

> [!info] Why usermod to mssql group
>
> The SQL Server errorlog file is owned by the `mssql` user. The Datadog agent runs as `dd-agent` — adding it to the `mssql` group grants read access to the log file without changing file permissions.

### Verify Log Collection

```bash
sudo datadog-agent status | grep -A 10 "Integrations" | grep -A 5 "sqlserver"
```

Expected: `Status: OK` and `Inputs: /var/opt/mssql/log/errorlog`.

### What Gets Logged

SQL Server only writes to its error log on significant events — startups, failed logins, errors, backups, checkpoints. A simple `SELECT` does **not** generate an error log entry. For capturing query-level activity for compliance purposes, configure [SQL Server audit logging](https://alp78.github.io/elysium/04-SQL-Server/Security/audit-logging) separately from the errorlog.

#### To force test entries

```bash
SA_PWD=$(curl -s -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/instance/attributes/sa-password")

# Force a checkpoint (writes to errorlog)
/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$SA_PWD" -C -Q "CHECKPOINT"

# Or trigger a failed login (guaranteed log entry)
/opt/mssql-tools18/bin/sqlcmd -S localhost -U fakeuser -P "wrong" -C -Q "SELECT 1" 2>/dev/null
```

Logs should appear in **Datadog > Logs > Explorer** within 1-2 minutes, filterable by `host:data-pipeline-sql`.

### If Bytes Read Stays at 0

The agent tails from the end of the file by default. To force it to read existing content:

```yaml
logs:
  - type: file
    path: /var/opt/mssql/log/errorlog
    service: data-pipeline-sql
    source: sqlserver
    start_position: beginning
```

Restart the agent after editing.

---

## Airflow Container Log Collection

Container logs on the Airflow VM are collected automatically via the Docker socket — no separate config file needed. This is enabled by two environment variables on the dd-agent container:

```bash
-e DD_LOGS_ENABLED=true \
-e DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL=true \
-v /var/run/docker.sock:/var/run/docker.sock:ro \
```

With `DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL=true`, the agent collects stdout/stderr from **all** Docker containers on the host.

### Airflow Container Log Source Tagging

Container-specific log source (for Datadog's built-in log parsing pipelines) is configured via Docker autodiscovery labels:

```bash
# On airflow-postgres:
-l com.datadoghq.ad.logs='[{"source":"postgresql","service":"airflow-postgres"}]'

# On airflow-webserver, scheduler, triggerer:
-l com.datadoghq.ad.logs='[{"source":"airflow","service":"airflow-<component>"}]'
```

The `source` field maps to Datadog's built-in log parsing pipelines — `airflow` activates Airflow-specific parsing, `postgresql` activates Postgres parsing.

### Viewing Airflow Container Logs in Datadog

In Datadog: **Logs > Explorer** → filter by:
- `source:airflow` — all Airflow container logs
- `service:airflow-scheduler` — scheduler logs only
- `host:data-pipeline-airflow` — everything from the Airflow VM

---

### Viewing Logs in Datadog Log Explorer

> [!tip] Use Live Tail for Real-Time Logs
> In Datadog, use **Logs > Live Tail** (not Log Explorer) to see logs in real time. New accounts may show an onboarding wizard — Live Tail bypasses it.

- **Logs > Explorer** — searchable, filterable log history
- **Logs > Live Tail** — real-time log streaming without needing to wait for indexing
- Filter by `host:data-pipeline-sql` for SQL Server logs, `host:data-pipeline-airflow` for container logs

---

### Cloud Run Pipeline Logs in Datadog

> [!warning] Cloud Run logs not in Datadog
>
> Cloud Run job logs go to **GCP Cloud Logging** (see [cloud-logging](https://alp78.github.io/elysium/06-GCP/Logging/cloud-logging) for the full GCP logging setup), not through dd-agent. They are not available in Datadog's Log Explorer. View them via gcloud:

```powershell
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=data-pipeline-pipeline" --limit=50 --format="table(timestamp,textPayload)"
```

The `LOG_FORMAT=json` env var on the Cloud Run Job formats logs as JSON, which enables log-to-trace correlation when viewed in APM — but those logs remain in GCP Cloud Logging, not Datadog.

---

### Log Collection Config File Locations

| File | Purpose |
|------|---------|
| `/etc/datadog-agent/conf.d/sqlserver.d/logs.yaml` | SQL Server errorlog file tailing |
| Docker labels on containers | Airflow and Postgres container log source tagging |

---

## Related

- [datadog-agent-sql-vm](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-agent-sql-vm) — SQL VM agent install and management
- [datadog-agent-airflow-vm](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-agent-airflow-vm) — Airflow VM agent with Docker socket access
- [datadog-apm-traces](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-apm-traces) — Log-to-trace correlation via `dd.trace_id`
- [datadog-troubleshooting](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-troubleshooting) — "No Logs in Datadog" section
- [server-configuration](https://alp78.github.io/elysium/04-SQL-Server/Administration/server-configuration) — SQL Server VM and errorlog location
