---
title: "03 - Datadog Agent: Airflow VM"
tags: [monitoring, orchestration, observability, docker, airflow, datadog, gcp]
aliases: [DD Agent Airflow, Datadog Airflow VM, dd-agent COS]
description: "How to set up the Datadog Agent as a Docker container on the example Airflow VM (Container-Optimized OS), covering startup script, autodiscovery labels, StatsD metrics, and memory budget."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Datadog Agent: Airflow VM

> [!quote]
> "Monitoring is a verb, not a noun. It is the action of observing and checking the behavior of a system over time."
>
> — **Greg Poirier**, Monitorama 2016

> [!abstract]- Summary
>
> This note covers the Airflow VM as the opposite operating model from the SQL host: the VM runs Container-Optimized OS, so Datadog is deployed as a Docker container with host mounts, autodiscovery labels, and DogStatsD enabled to collect both container signals and Airflow's own orchestration metrics.
>
> **Agent architecture on COS**
> - Explains how the Airflow VM hosts the Datadog container, what host paths and sockets must be mounted, and why this differs from the package-based SQL VM installation.
> - Treats the agent as part of the VM bootstrap so container, host, and Docker-engine telemetry start flowing immediately.
>
> **Autodiscovery and StatsD**
> - Shows how Docker labels configure service checks automatically and how Airflow emits StatsD metrics that the local agent receives and forwards.
> - Connects platform mechanics to the later Airflow observability note so infrastructure setup and metric meaning stay separate.
>
> **Verification and cleanup**
> - Covers metric-flow validation, the Datadog Airflow integration toggle, and stale-container cleanup when an old agent instance keeps conflicting with the intended setup.
> - Keeps verification focused on what the VM is actually forwarding rather than on dashboard assumptions.
>
> **Sizing and operations**
> - Ends with the agent memory budget, the Terraform startup-script shape, and the management commands used on the Airflow VM.
> - When to use: the goal is to understand the containerized agent deployment model for COS-hosted Airflow.

> [!note]- Glossary
>
> **Container-Optimized OS**
> - Google's minimal host OS for container workloads, designed around Docker rather than general package management.
> - It matters here because the Airflow VM cannot use the same agent installation pattern as the Ubuntu SQL VM.
>
> > [!info] Host model drives install model
> >
> > On COS, the agent needs to run as a container because the host is intentionally not a general-purpose package environment.
>
> ---
>
> **Docker autodiscovery**
> - The Datadog mechanism that reads container labels to discover and configure integrations automatically.
> - It matters here because PostgreSQL and Airflow-related checks are attached through labels instead of manual host-side config files.
>
> > [!tip] Config rides with containers
> >
> > Autodiscovery keeps service monitoring aligned with the container definition instead of a separate static host inventory.
>
> ---
>
> **DogStatsD**
> - Datadog's StatsD-compatible UDP listener that accepts application-emitted metrics.
> - It matters here because Airflow publishes scheduler and task metrics through this path.
>
> > [!info] Application metrics ingress
> >
> > Host metrics explain resource usage; DogStatsD is how the application tells Datadog what the scheduler is doing.
>
> ---
>
> **Docker socket mount**
> - A bind mount of the Docker engine socket into the Datadog container.
> - It matters here because the agent uses it to discover containers and collect container logs and metadata.
>
> > [!info] Container visibility hinge
> >
> > Without the socket, the agent can still exist but loses most of the orchestration context that makes the Airflow VM useful to monitor.
>
> ---
>
> **Host mounts**
> - The `/proc`, `/sys`, and related host paths made visible inside the Datadog container.
> - It matters here because system metrics on COS come from mounted host state rather than from a native package install.
>
> > [!tip] Container agent, host data
> >
> > Those mounts are what let a containerized agent describe the VM it sits on.
>
> ---
>
> **StatsD verification**
> - The set of checks used to prove Airflow metrics are reaching DogStatsD and then Datadog.
> - It matters here because a working agent does not automatically prove the application metric pipeline is healthy.
>
> > [!info] Two-step proof
> >
> > First prove emission into DogStatsD, then prove indexed arrival in Datadog.
>
> ---
>
> **stale `dd-agent` container**
> - An older or duplicate Datadog container that keeps running after the intended bootstrap changes have been applied.
> - It matters here because duplicate agents can confuse collection results and waste scarce VM memory.
>
> > [!tip] Clean old runtime state
> >
> > On small hosts, leaving dead configurations running is both a debugging problem and a capacity problem.
>
> ---
>
> **memory budget**
> - The portion of VM memory intentionally reserved for the Datadog agent container and its checks.
> - It matters here because the Airflow VM is resource-constrained and observability overhead competes with the scheduler and webserver.
>
> > [!info] Monitoring has a footprint
> >
> > Instrumentation that starves the orchestrator defeats the purpose of observing it.

## How It Works

The startup script (`infra/scripts/airflow-startup.sh`) reads the API key from VM metadata and launches dd-agent on boot:

#### Read API key from GCE metadata

```bash
DD_API_KEY=$(curl -sf -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/instance/attributes/dd-api-key" || true)
```

#### If the key is present, launch dd-agent

```bash
docker run -d \
  --name dd-agent \
  --network airflow-net \
  --restart unless-stopped \
  --cgroupns host --pid host \
  -p 8126:8126 \
  -e DD_API_KEY="${DD_API_KEY}" \
  -e DD_SITE="datadoghq.eu" \
  -e DD_HOSTNAME="data-pipeline-airflow" \
  -e DD_LOGS_ENABLED=true \
  -e DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL=true \
  -e DD_APM_ENABLED=true \
  -e DD_APM_NON_LOCAL_TRAFFIC=true \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v /proc/:/host/proc/:ro \
  -v /sys/fs/cgroup/:/host/sys/fs/cgroup:ro \
  -v /var/lib/datadog-agent/run:/opt/datadog-agent/run:rw \
  gcr.io/datadoghq/agent:7
```

### Key Configuration Details

| Setting | Value | Why |
|---------|-------|-----|
| `--network airflow-net` | Shared Docker network | Enables container name DNS resolution (e.g., `dd-agent` resolves to the agent IP) |
| `-p 8126:8126` | Host port mapping | Exposes APM trace receiver to Cloud Run jobs over VPC |
| `DD_SITE=datadoghq.eu` | EU region | Routes all data to the EU Datadog region |
| `DD_APM_NON_LOCAL_TRAFFIC=true` | Accept remote traces | Required for Cloud Run → agent trace forwarding |
| `/var/lib/datadog-agent/run` | Writable state path | COS has a read-only `/opt` filesystem — must use `/var/lib` instead |
| Docker socket (read-only) | `docker.sock` | Enables container discovery and log collection |

> [!warning] COS Filesystem Constraint
> Container-Optimized OS has a read-only `/opt` filesystem. The standard Datadog volume mount `-v /opt/datadog-agent/run:/opt/datadog-agent/run:rw` will **fail silently** on COS. Always use `/var/lib/datadog-agent/run` on the host side. See [datadog-troubleshooting](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-troubleshooting) for the exact fix.

> [!success] Correct Volume Mount for COS
> Use `/var/lib/datadog-agent/run` as the host-side path: `-v /var/lib/datadog-agent/run:/opt/datadog-agent/run:rw`. This directory is writable on COS and persists across container restarts.

> [!tip] Startup Script Guard
> The agent launch is guarded by `|| echo "WARNING..."` so a failure doesn't block Airflow startup. If the agent fails to start, the Airflow containers still launch normally.

---

## Docker Autodiscovery Labels

Container log source tagging and the Postgres integration check are configured via Docker labels applied when containers are launched:

#### Docker Autodiscovery — airflow-postgres labels

```bash
-l com.datadoghq.ad.logs='[{"source":"postgresql","service":"airflow-postgres"}]'
-l com.datadoghq.ad.check_names='["postgres"]'
-l com.datadoghq.ad.init_configs='[{}]'
-l com.datadoghq.ad.instances='[{"host":"%%host%%","port":"5432","username":"airflow","password":"airflow"}]'
```

#### Docker Autodiscovery — airflow-webserver, scheduler, triggerer labels

```bash
-l com.datadoghq.ad.logs='[{"source":"airflow","service":"airflow-<component>"}]'
```

These labels tell the agent:

- Which log pipeline to use (`source` → Datadog's built-in log parsing for that technology)
- Which integration check to run (Postgres metrics collection)
- `%%host%%` resolves to the container's Docker IP at runtime — used for the Postgres connection

> [!info] Ghost Host Side Effect
> The Docker-internal PostgreSQL IP (e.g., `172.18.0.3`) also appears as a separate host in Datadog Infrastructure. This is normal — caused by Autodiscovery resolving `%%host%%` to the container's bridge IP. The ghost disappears after ~2 hours if not seen.

---

## StatsD — Airflow Metrics Collection

Airflow emits internal metrics via **StatsD** (UDP). The dd-agent receives these on port 8125 and forwards them to Datadog.

```
┌──────────────────┐     StatsD (UDP:8125)     ┌──────────────┐     HTTPS     ┌─────────┐
│ airflow-scheduler │ ──────────────────────────► │   dd-agent   │ ────────────► │ Datadog │
│ airflow-webserver │                            │ (port 8125)  │              │  Cloud  │
│ airflow-triggerer │                            └──────────────┘              └─────────┘
└──────────────────┘
    All on airflow-net Docker network
```

**Enable StatsD in Airflow** by adding these environment variables to the shared `AIRFLOW_ENV` array in `infra/scripts/airflow-startup.sh`:

```bash
AIRFLOW_ENV=(
  # ... existing variables ...
  -e AIRFLOW__METRICS__STATSD_ON=True
  -e AIRFLOW__METRICS__STATSD_HOST=dd-agent
  -e AIRFLOW__METRICS__STATSD_PORT=8125
  -e AIRFLOW__METRICS__STATSD_PREFIX=airflow
)
```

| Variable | Value | Purpose |
|----------|-------|---------|
| `STATSD_ON` | `True` | Enables StatsD metric emission from Airflow |
| `STATSD_HOST` | `dd-agent` | Docker container name of the Datadog agent (resolved via `airflow-net` network) |
| `STATSD_PORT` | `8125` | Default DogStatsD port on the Datadog agent |
| `STATSD_PREFIX` | `airflow` | All metrics are prefixed with `airflow.` (e.g., `airflow.dagrun.duration.success`) |

The Datadog agent must have `DD_DOGSTATSD_NON_LOCAL_TRAFFIC=true` to accept StatsD from other containers. Add this to the `docker run` command if not already present.

### Deploying StatsD Changes

After modifying the startup script locally:

```bash
# 1. Push updated script to VM metadata
gcloud compute instances add-metadata data-pipeline-airflow --zone=europe-west1-b --metadata-from-file startup-script=infra/scripts/airflow-startup.sh

# 2. SSH into the VM
gcloud compute ssh data-pipeline-airflow --zone=europe-west1-b --tunnel-through-iap

# 3. Force-recreate containers (the startup script skips running containers)
sudo docker rm -f airflow-scheduler airflow-webserver airflow-triggerer

# 4. Re-run the startup script from metadata
curl -sf -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/instance/attributes/startup-script" | sudo bash
```

### Verifying StatsD Metrics Flow

After the containers restart:

```bash
sudo docker exec dd-agent agent status | grep -A 10 DogStatsD
```

Expected output:

```
DogStatsD
=========
  Metric Packets: 3,451        ← metrics flowing
  Metric Parse Errors: 0
  Udp Bytes: 390,196
  Udp Packet Reading Errors: 0
```

Then in Datadog: **Metrics → Summary** → search `airflow` to confirm metrics are ingested.

### Enabling the Airflow Integration in Datadog

In Datadog: **Integrations → Airflow → Install**. This activates the default Airflow dashboard and metric parsing rules.

> [!info] Data Observability Limitation
> Datadog's "Data Observability" product (monitoring data quality, freshness, schema changes) only supports managed Airflow platforms (Cloud Composer, MWAA, Astronomer, Kubernetes). For self-hosted Airflow on a GCE VM, the StatsD integration described here is the standard approach.

---

### Stale dd-agent Container Cleanup

The startup script removes old containers before starting new ones, preventing port conflicts after VM reboot:

```bash
for c in airflow-webserver airflow-triggerer airflow-scheduler airflow-postgres dd-agent; do
  docker rm -f "$c" 2>/dev/null || true
done
```

---

### Datadog Agent Memory Budget on Airflow VM

The Airflow VM is an `e2-medium` (4 GB RAM). Memory allocation with dd-agent:

| Component | ~RAM |
|-----------|------|
| COS + Docker | 300 MB |
| PostgreSQL 16 | 100 MB |
| Webserver | 400 MB |
| Scheduler | 300 MB |
| Triggerer | 200 MB |
| dd-agent | 350 MB |
| **Total** | **~1,650 MB** |

Leaves ~2.35 GB headroom. Monitor via Datadog Infrastructure > Host Map.

---

### Terraform Configuration for Airflow VM Agent

In `infra/compute.tf`, the Airflow VM metadata passes the API key:

```hcl
resource "google_compute_instance" "airflow" {
  # ...
  metadata = {
    startup-script = replace(file("${path.module}/scripts/airflow-startup.sh"), "\r\n", "\n")
    dd-api-key     = var.dd_api_key
    enable-oslogin = "TRUE"
  }
}
```

> [!warning] Missing dd-api-key
> The `dd-api-key` metadata must be present on the Airflow VM. During infrastructure changes (e.g., Cloud SQL to SQL VM migration), this key can accidentally be omitted, causing dd-agent to not start. Always verify both VMs have `dd-api-key` in their metadata. This is the most common cause of missing APM traces — see [datadog-troubleshooting](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-troubleshooting).

> [!success] Verify and Restore the API Key
> Check that the key is present with `gcloud compute instances describe data-pipeline-airflow --zone=europe-west1-b --format="get(metadata.items)"`. If missing, re-add it: `gcloud compute instances add-metadata data-pipeline-airflow --zone=europe-west1-b --metadata dd-api-key=<your-key>`, then rerun the startup script or manually restart the agent.

---

### Agent Management Commands on Airflow VM

SSH into the VM first:

```powershell
gcloud compute ssh data-pipeline-airflow --zone=europe-west1-b --tunnel-through-iap
```

| Task | Command |
|------|---------|
| View agent logs | `docker logs dd-agent --tail 50` |
| Full agent status | `docker exec dd-agent agent status` |
| Quick health check | `docker exec dd-agent agent health` |
| Restart agent | `docker restart dd-agent` |
| Test APM port | `curl -s http://localhost:8126/info | head -5` |

---

## Related

- [datadog-architecture-overview](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-architecture-overview) — Full observability topology
- [datadog-apm-traces](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-apm-traces) — APM trace flow from Cloud Run through this agent
- [datadog-dashboards](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-dashboards) — Airflow Orchestration Dashboard and its metrics
- [datadog-alerting](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-alerting) — Recommended monitors for Airflow scheduler and tasks
- [datadog-troubleshooting](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-troubleshooting) — APM not appearing, no logs, COS filesystem issues
- the Airflow DAGs — the data pipeline project DAG structure and pipeline orchestration
