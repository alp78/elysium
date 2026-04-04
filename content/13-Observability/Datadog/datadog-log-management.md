---
tags: [monitoring, observability, sql, docker, airflow, datadog]
aliases: [Log Collection, SQL Server Log Collection, Datadog Logs, errorlog, log tailing]
description: "How to configure Datadog log collection for the data platform — SQL Server errorlog file tailing on the SQL VM and Docker container log collection on the Airflow VM."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Datadog Log Management

> [!quote]
> "The goal of an Observability team is not to collect logs, metrics, or traces. It is to build a culture of engineering based on facts and feedback."
>
> — **Cindy Sridharan**, *Distributed Systems Observability* (2018)

Log collection for the data platform uses two separate mechanisms: **file tailing** for the SQL Server errorlog (on the SQL VM), and **Docker socket autodiscovery** for Airflow container logs (on the Airflow VM).

> [!warning] Logs Require Separate Config
> The Datadog Agent collects SQL Server metrics automatically via the [SQL Server integration](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-sql-server-integration), but **log collection requires a separate config file** (`logs.yaml`). Metrics and logs are configured independently.

> [!success] Correct Setup
> Create `/etc/datadog-agent/conf.d/sqlserver.d/logs.yaml` with the file tailing config and ensure `logs_enabled: true` is set in `datadog.yaml`. See [datadog-sql-server-logs](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-sql-server-logs) for the full setup steps including the `mssql` group permission fix.

---

## SQL Server Errorlog Collection

SQL Server errorlog collection uses file tailing via a `logs.yaml` config on the SQL VM. The `dd-agent` user must be added to the `mssql` group for read access.

For the full setup (config file, permissions, verification, testing, and troubleshooting), see [datadog-sql-server-logs](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-sql-server-logs).

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

> [!success] Correct Approach for Cloud Run Logs
> Use `gcloud logging read` or the GCP Console Log Explorer to view Cloud Run job logs. Filter by `resource.type=cloud_run_job AND resource.labels.job_name=data-pipeline-pipeline`. Set `LOG_FORMAT=json` on the job so logs are structured and queryable via `jsonPayload` fields.

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
