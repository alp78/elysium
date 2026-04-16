---
title: "11 - Datadog Log Management"
tags: [monitoring, observability, sql, docker, airflow, datadog]
aliases: [Log Collection, SQL Server Log Collection, Datadog Logs, errorlog, log tailing]
description: "How to configure Datadog log collection for the data platform — SQL Server errorlog file tailing on the SQL VM and Docker container log collection on the Airflow VM."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Datadog Log Management

> [!quote]+
> "The goal of an Observability team is not to collect logs, metrics, or traces. It is to build a culture of engineering based on facts and feedback."
>
> — **Cindy Sridharan**, *Distributed Systems Observability* (2018)

> [!abstract]- Summary
>
> This note covers the broad log-ingestion layer across the stack: Datadog tails the SQL Server errorlog, reads Airflow container stdout through Docker, and exposes those streams in Log Explorer so operators can correlate textual evidence with host metrics, traces, and dashboard anomalies during an incident.
>
> **Log sources**
> - Explains the two main ingestion patterns in the platform: file tailing for SQL Server and Docker-based container log collection for Airflow services.
> - Keeps the source-specific mechanics visible so missing logs can be debugged from the collector inward.
>
> **Tagging and navigation**
> - Shows how source and service tags shape the Airflow and SQL log streams and make them searchable inside Datadog.
> - Connects raw log ingestion to the operator experience in Log Explorer.
>
> **Cloud Run and viewing workflow**
> - Covers how logs are viewed in Datadog, including the Cloud Run pipeline path and the search patterns used to isolate the right stream quickly.
> - Treats log access as part of the same observability workflow as metrics and traces, not as a separate tool.
>
> **Config ownership**
> - Ends with the file locations that control log collection on the relevant hosts.
> - When to use: the team needs the stack-wide log collection model before diving into one specific source such as SQL Server errorlog tailing.

> [!note]- Glossary
>
> **log ingestion**
> - The process of collecting log lines from their source and forwarding them into Datadog.
> - It matters here because every later search, dashboard, or correlation flow depends on the ingestion path working first.
>
> > [!info] Collection before analysis
> >
> > If logs never enter Datadog, query syntax and dashboards are a distraction rather than a solution.
>
> ---
>
> **file tailing**
> - The pattern of reading new lines from a growing log file as they are appended.
> - It matters here because SQL Server logs arrive through this model rather than through container stdout.
>
> > [!tip] Source-specific mechanism
> >
> > File-based services need a different collection pattern than containerized processes.
>
> ---
>
> **container stdout**
> - The standard output stream emitted by a running container.
> - It matters here because Airflow service logs are captured from Docker output rather than from separate hand-managed files.
>
> > [!info] Natural container log source
> >
> > Modern container logging usually starts with stdout/stderr and only later branches into file handling if necessary.
>
> ---
>
> **service tag**
> - The tag that associates a log stream with one logical application or component.
> - It matters here because metrics, traces, and logs become much easier to correlate when they share service identity.
>
> > [!tip] Identity across signals
> >
> > Consistent service tagging is what turns separate telemetry products into one observability surface.
>
> ---
>
> **source tag**
> - The Datadog tag that labels the product or technology that produced a log stream.
> - It matters here because parsing and filtering behavior often depends on correct source labeling.
>
> > [!info] Parser hint
> >
> > The source tag is not just descriptive; it helps Datadog apply the right log treatment.
>
> ---
>
> **Log Explorer**
> - Datadog's interface for searching, filtering, and inspecting ingested logs.
> - It matters here because it is the primary operator surface for turning raw ingestion into usable incident evidence.
>
> > [!tip] Searchable evidence store
> >
> > Logs become operationally useful when they are queryable by tags, severity, and correlation IDs.
>
> ---
>
> **log retention cost**
> - The storage and indexing cost associated with keeping logs in Datadog over time.
> - It matters here because logging design is also a cost decision, not just a diagnostic one.
>
> > [!info] Visibility has a price
> >
> > High-volume logs need a purpose; otherwise they create bill without improving diagnosis.
>
> ---
>
> **config file location**
> - The host path that defines how a given log source is collected by the agent.
> - It matters here because troubleshooting starts by finding the owning config file for the affected log stream.
>
> > [!tip] Know the owner file
> >
> > Operational fixes are faster when each log source has an obvious configuration home.

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
- [server-configuration](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/server-configuration) — SQL Server VM and errorlog location
