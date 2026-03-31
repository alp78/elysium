---
type: concept
category: observability
technology: [datadog, gcp, sql-server, airflow, cloud-run]
tags: [monitoring, observability, sql, airflow, datadog, gcp]
aliases: [Datadog Overview, the data pipeline project Observability, Datadog Architecture]
keywords: [datadog, observability, monitoring, metrics, logs, traces, APM, three pillars, data-pipeline, EU region, datadoghq.eu, agent, GCP integration, Cloud Run, infrastructure, DogStatsD]
description: "Architecture overview of Datadog monitoring for the data platform — two agents (Airflow VM + SQL VM) plus GCP Integration cover metrics, logs, and traces across the full stack."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Datadog Architecture Overview

> [!quote]
> "No complex system is ever fully healthy."
> — **Cindy Sridharan**, *Distributed Systems Observability* (2018)

Datadog monitoring for the data platform uses two agents and one GCP Integration to deliver full observability — metrics, logs, and traces — across every component from the SQL Server VM to ephemeral Cloud Run jobs.

**Datadog Region: EU (`datadoghq.eu`) | GCP Region: europe-west1 | Agents: 2 (Airflow VM + SQL VM)**

---

### Datadog Infrastructure Topology

```mermaid
flowchart TD
    subgraph VM1["GCE VM: data-pipeline-airflow (e2-medium, COS)"]
        subgraph NET["Docker network: airflow-net"]
            PG["airflow-postgres<br/>postgres:16-alpine"]
            WEB["airflow-webserver<br/>airflow:2.10.5 · port 8080"]
            SCHED["airflow-scheduler<br/>airflow:2.10.5 · LocalExecutor"]
            TRIG["airflow-triggerer<br/>airflow:2.10.5"]
            DD1["dd-agent<br/>gcr.io/datadoghq/agent:7"]
        end
    end

    subgraph VM2["GCE VM: data-pipeline-sql (e2-small, Ubuntu 22.04)"]
        SQL["SQL Server 2022 Developer<br/>systemd"]
        DD2["datadog-agent<br/>systemd package"]
    end

    subgraph CR["Cloud Run Job: data-pipeline-pipeline"]
        TRACE["ddtrace-run<br/>auto-instruments pyodbc, requests"]
    end

    subgraph DDEU["Datadog EU (datadoghq.eu)"]
        INFRA["Infrastructure<br/>VM CPU, RAM, disk"]
        LOGS["Logs<br/>Airflow containers + SQL errorlog"]
        APM["APM<br/>Pipeline traces + SQL queries"]
        GCP["GCP Integration<br/>Cloud Run job metrics"]
    end

    DD1 -->|"Docker socket: logs + metrics"| NET
    DD1 -->|"/proc, /sys: host metrics"| VM1
    TRACE -->|"port 8126 via VPC"| DD1
    DD2 -->|"SQL integration"| SQL

    DD1 --> DDEU
    DD2 --> DDEU
    CR --> DDEU

    style VM1 fill:#1a1a2e,stroke:#7aa2f7,color:#fff
    style VM2 fill:#1a1a2e,stroke:#7aa2f7,color:#fff
    style CR fill:#1a1a2e,stroke:#bb9af7,color:#fff
    style DDEU fill:#1a1a2e,stroke:#9ece6a,color:#fff
    style NET fill:#1a1a2e,stroke:#22d3ee,color:#fff
    style DD1 fill:#1a1a2e,stroke:#e0af68,color:#fff
    style DD2 fill:#1a1a2e,stroke:#e0af68,color:#fff
    style TRACE fill:#1a1a2e,stroke:#bb9af7,color:#fff
```

---

### What Gets Monitored by Datadog

| Source | Method | Data |
|--------|--------|------|
| Airflow VM | DD Agent (system checks) | CPU, RAM, disk, network, I/O |
| Airflow containers | DD Agent (Docker autodiscovery) | Per-container logs, CPU, memory |
| PostgreSQL | DD Agent (Postgres check via labels) | Connections, query metrics |
| SQL Server VM | DD Agent (system checks) | CPU, RAM, disk, network, I/O |
| SQL Server database | DD Agent (sqlserver check) | Connections, buffer pool, waits, query stats |
| SQL Server errorlog | DD Agent (file tailing) | Errors, failed logins, checkpoints |
| Pipeline steps | ddtrace APM | Per-step traces with duration, SQL queries |
| Cloud Run jobs | GCP Integration | Execution count, CPU, memory — compare with [GCP-native Cloud Monitoring](https://alp78.github.io/elysium/06-GCP/Logging/cloud-monitoring-metrics) for metrics that remain outside Datadog |

---

### Three Pillars of Observability in Datadog

| Pillar | What | How it gets to Datadog |
|--------|------|------------------------|
| **Metrics** | Numeric time series (CPU %, memory, request count) | Agent collects from host + Docker; GCP Integration pulls from Cloud Monitoring API |
| **Logs** | Structured text from containers + errorlog | Agent reads Docker stdout via socket; tails SQL Server errorlog |
| **Traces** | Request-level spans with timing | `ddtrace-run` instruments Python code; traces route through Agent on port 8126 |

All three converge in Datadog by sharing the `service` tag (e.g., `data-pipeline-pipeline`) and trace correlation IDs (`dd.trace_id`, `dd.span_id`) for log-to-trace linking. This three-pillar approach is an implementation of the conceptual framework described in [observability-deep-dive](https://alp78.github.io/elysium/13-Observability/Monitoring/observability-deep-dive), applied specifically to the project's GCP-hosted stack.

> [!info] Log-to-Trace Correlation
> When `LOG_FORMAT=json` is set on the Cloud Run Job and the JSON logger injects `dd.trace_id` / `dd.span_id`, you can click directly from a log line in Datadog's Log Explorer to the corresponding APM flame graph. See [datadog-apm-traces](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-apm-traces) for the logger implementation.

---

## Prerequisites

1. **Datadog EU account** at `datadoghq.eu` (14-day trial is sufficient)
2. **API key** (32 characters) from Organization Settings > API Keys
3. **Application key** (40 characters) from Organization Settings > Application Keys
4. All existing the data pipeline project infrastructure deployed via Terraform

> [!tip] API Key vs Application Key
> The API key (32 chars) is used to **send** data (metrics, logs, traces) to Datadog. The Application key (40 chars) is used to **read** data from Datadog's API (listing hosts, creating dashboards). The Agent and ddtrace only need the API key.

### Terraform Variable

The `dd_api_key` variable is defined in `infra/variables.tf`:

```hcl
variable "dd_api_key" {
  description = "Datadog API key (leave empty to disable agent)"
  type        = string
  sensitive   = true
  default     = ""
}
```

Set it in `infra/terraform.tfvars` (git-ignored):

```hcl
dd_api_key = "<your-32-char-api-key>"
```

All Datadog resources are conditional on `var.dd_api_key != ""`. Setting it to empty disables everything.

#### Apply Terraform

```powershell
terraform -chdir=infra apply
```

This creates/updates:

- VM metadata with `dd-api-key` on both VMs (read by startup scripts)
- Firewall rule `data-pipeline-allow-apm` (port 8126 from VPC subnet)
- Datadog service account `data-pipeline-datadog` with viewer roles
- Cloud Run Job env vars for APM (`DD_SERVICE`, `DD_ENV`, `DD_TRACE_AGENT_URL`, `DD_API_KEY`)

---

## GCP Integration Setup

The GCP Integration enables Datadog to pull metrics from Cloud Run, Compute Engine, and other GCP services via the Cloud Monitoring API. This is how Cloud Run job metrics (CPU, memory, execution count) appear in Datadog — since Cloud Run jobs are ephemeral, no agent runs inside them.

### Setup Steps

1. In Datadog, go to **Integrations > Google Cloud Platform**
2. Choose **Manual** setup method
3. Enter the service account email:
   ```
   data-pipeline-datadog@data-platform-prod.iam.gserviceaccount.com
   ```
4. When prompted for "Generate Principal", use the SA impersonation flow
5. Enable **GCE Automuting** (auto-mutes monitors when VM is stopped)
6. Enable **Resource Collection** (discovers GCP resources in Datadog)
7. Save the integration

> [!info] Service Account Permissions
> The Datadog SA has `monitoring.viewer`, `compute.viewer`, and `cloudasset.viewer` roles — it can read metrics but cannot modify any GCP resources.

### Terraform Resources

The service account is created conditionally in `infra/iam.tf`:

```hcl
resource "google_service_account" "datadog" {
  count        = var.dd_api_key != "" ? 1 : 0
  account_id   = "data-pipeline-datadog"
  display_name = "Datadog Integration"
}
```

### Verify Integration

After setup, go to **Infrastructure > Host Map** in Datadog. You should see GCE VMs listed. Cloud Run metrics appear under **Cloud > GCP > Cloud Run**.

---

> [!warning] Agent resource overhead
>
> The Datadog Agent consumes approximately 1-2% CPU and 200-400 MB RAM continuously. On an e2-small (2 vCPU, 2 GB RAM) running SQL Server, the agent takes 10-20% of available memory. If SQL Server starts experiencing memory pressure (buffer cache hit ratio dropping below 99%), investigate agent overhead before resizing the VM. Use `systemctl stop datadog-agent` temporarily to confirm.

### Disabling Datadog Agents and Integration

When the trial ends or you want to remove Datadog:

1. Set `dd_api_key = ""` in `terraform.tfvars`
2. Run `terraform apply` — conditional resources are destroyed
3. SSH into Airflow VM and remove the agent: `docker rm -f dd-agent`
4. SSH into SQL VM and stop the agent: `sudo systemctl disable datadog-agent && sudo systemctl stop datadog-agent`
5. Revert Dockerfile entrypoint:
   ```dockerfile
   ENTRYPOINT ["python", "utils/run_pipeline.py"]
   ```
6. Remove `ddtrace>=2.10.0` from `requirements.txt`
7. Rebuild and push the pipeline image
8. The logger and run_pipeline trace code no-ops automatically (`ImportError` guard)

One `terraform apply` + one image rebuild cleans up everything.

---

## Related

- [datadog-agent-airflow-vm](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-agent-airflow-vm) — Agent setup on Container-Optimized OS
- [datadog-agent-sql-vm](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-agent-sql-vm) — Agent setup on Ubuntu with systemd
- [datadog-sql-server-integration](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-sql-server-integration) — SQL Server integration configuration
- [datadog-apm-traces](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-apm-traces) — APM tracing and Python instrumentation
- [datadog-dashboards](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-dashboards) — Pipeline Watch and DBA dashboards
- [datadog-troubleshooting](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-troubleshooting) — Common issues and fixes
- [datadog-cost-optimization](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-cost-optimization) — Pricing breakdown
- the project architecture — Full the data pipeline project system architecture
- the GCP resources — GCP resources managed by Terraform
