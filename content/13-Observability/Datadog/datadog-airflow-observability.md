---
title: "Datadog Airflow Observability"
tags: [monitoring, orchestration, observability, docker, airflow, datadog]
aliases: [Airflow Observability, Airflow StatsD Metrics, Airflow Datadog Dashboard]
description: "Airflow-specific observability for the project — how to enable StatsD metrics from Airflow containers, key metrics for scheduler health and DAG run tracking, the Airflow Orchestration dashboard, and recommended Datadog monitors."
parent: "[[domain-datadog-platform]]"
links:
  - "[[datadog-architecture-overview]]"
  - "[[datadog-agent-airflow-vm]]"
  - "[[datadog-agent-sql-vm]]"
  - "[[datadog-gcp-integration]]"
  - "[[datadog-sql-server-integration]]"
  - "[[datadog-custom-queries]]"
  - "[[datadog-log-management]]"
  - "[[datadog-sql-server-logs]]"
  - "[[datadog-apm-traces]]"
  - "[[datadog-dashboards]]"
  - "[[datadog-alerting]]"
  - "[[datadog-cost-optimization]]"
  - "[[datadog-troubleshooting]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Airflow Observability — StatsD Metrics and Dashboard

> [!quote]
> "Do you know what's better than debugging at 3 AM with really great tools? Not having to wake up at 3 AM."
>
> — **Liz Fong-Jones**

The [Airflow VM Datadog agent](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-agent-airflow-vm) covers the infrastructure layer (VM CPU, container metrics). This note covers **Airflow-specific observability** — DAG run metrics, task execution tracking, scheduler health, and the purpose-built Airflow Orchestration dashboard. Understanding [Airflow's architecture](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-core-concepts) (scheduler, executor, DAG bag) is essential context for interpreting these metrics correctly.

---

### How StatsD Metrics Flow from Airflow to Datadog

Airflow emits internal metrics via **StatsD** — a lightweight protocol that sends UDP packets with metric names and values. The Datadog agent receives these on port 8125 and forwards them to the Datadog platform.

```
┌──────────────────┐     StatsD (UDP:8125)     ┌──────────────┐     HTTPS     ┌─────────┐
│ airflow-scheduler │ ──────────────────────────► │   dd-agent   │ ────────────► │ Datadog │
│ airflow-webserver │                            │ (port 8125)  │              │  Cloud  │
│ airflow-triggerer │                            └──────────────┘              └─────────┘
└──────────────────┘
    All on airflow-net Docker network
```

---

### Enabling StatsD in Airflow Docker Compose

Add these environment variables to the shared `AIRFLOW_ENV` array in `infra/scripts/airflow-startup.sh`:

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

The Datadog agent must have `DD_DOGSTATSD_NON_LOCAL_TRAFFIC=true` (already set in the startup script) to accept StatsD from other containers.

---

### Deploying the StatsD Configuration Change

After modifying the startup script locally:

```bash
# 1. Push updated script to VM metadata
gcloud compute instances add-metadata data-pipeline-airflow --zone=europe-west1-b \
  --metadata-from-file startup-script=infra/scripts/airflow-startup.sh

# 2. SSH into the VM
gcloud compute ssh data-pipeline-airflow --zone=europe-west1-b --tunnel-through-iap

# 3. Force-recreate containers (the startup script skips running containers)
sudo docker rm -f airflow-scheduler airflow-webserver airflow-triggerer

# 4. Re-run the startup script from metadata
curl -sf -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/instance/attributes/startup-script" | sudo bash
```

---

## Verifying Metrics Flow

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

Go to **Integrations → Airflow → Install**. This activates the default Airflow dashboard and metric parsing rules.

> [!info] Data Observability Limitation
> Datadog's "Data Observability" product (monitoring data quality, freshness, schema changes) only supports managed Airflow platforms (Cloud Composer, MWAA, Astronomer, Kubernetes). For self-hosted Airflow on a GCE VM, the StatsD integration described here is the standard approach.

---

## Key Metrics Reference

Airflow 2.10 embeds the DAG ID and task ID directly in the metric name (not as tags). The naming pattern is:

```
airflow.<category>.<dag_id>.<task_id>.<metric>.<aggregation>
```

### Scheduler Health

| Metric | Type | What It Tells You |
|--------|------|-------------------|
| `airflow.scheduler_heartbeat` | Counter | Is the scheduler alive? Stops incrementing if scheduler is dead |
| `airflow.scheduler.scheduler_loop_duration.avg` | Gauge | How long each scheduler loop takes (µs). High values = scheduler overloaded |
| `airflow.scheduler.tasks.executable` | Gauge | Number of tasks ready to be sent to the executor |
| `airflow.scheduler.tasks.starving` | Gauge | Tasks that can't run because all pool slots are full |
| `airflow.scheduler.orphaned_tasks.adopted` | Counter | Tasks recovered after a scheduler restart |
| `airflow.dag_processing.total_parse_time` | Gauge | Total time to parse all DAG files (seconds). Spikes indicate broken DAG files |
| `airflow.dag_processing.import_errors` | Gauge | Number of DAG files with import errors |
| `airflow.dagbag_size` | Gauge | Total number of DAGs loaded |

### DAG Run Performance

| Metric | Type | What It Tells You |
|--------|------|-------------------|
| `airflow.dagrun.duration.success.pipeline_pulse.avg` | Gauge | Average successful run duration for pipeline_pulse (µs) |
| `airflow.dagrun.duration.success.pipeline_tickers.avg` | Gauge | Average successful run duration for pipeline_tickers (µs) |
| `airflow.dagrun.schedule_delay.pipeline_pulse.avg` | Gauge | Time between scheduled run time and actual start (µs). High = scheduler backlog |
| `airflow.dagrun.dependency_check.pipeline_pulse.avg` | Gauge | Time spent checking task dependencies (µs) |
| `airflow.dagrun.pipeline_pulse.first_task_scheduling_delay.avg` | Gauge | Delay before the first task in a DAG run starts |

### Task Execution

| Metric | Type | What It Tells You |
|--------|------|-------------------|
| `airflow.dag.pipeline_pulse.fetch_and_load_pulse.duration.avg` | Gauge | Average task execution time (µs) |
| `airflow.dag.pipeline_pulse.fetch_and_load_pulse.queued_duration.avg` | Gauge | Time spent waiting in the queue before execution (µs) |
| `airflow.ti.finish.pipeline_pulse.fetch_and_load_pulse.success` | Counter | Number of successful task completions |
| `airflow.ti.finish.pipeline_pulse.fetch_and_load_pulse.failed` | Counter | Number of failed task completions |
| `airflow.ti_successes` | Counter | Total task successes across all DAGs |
| `airflow.operator_successes_CloudRunExecuteJobOperator` | Counter | Successes by operator type |
| `airflow.task.cpu_usage.pipeline_pulse.fetch_and_load_pulse` | Gauge | CPU usage of the task process |
| `airflow.task.mem_usage.pipeline_pulse.fetch_and_load_pulse` | Gauge | Memory usage of the task process |

### Pool and Executor

| Metric | Type | What It Tells You |
|--------|------|-------------------|
| `airflow.executor.open_slots` | Gauge | Available executor capacity |
| `airflow.executor.running_tasks` | Gauge | Currently executing tasks |
| `airflow.executor.queued_tasks` | Gauge | Tasks waiting for an executor slot |
| `airflow.pool.open_slots.default_pool` | Gauge | Available slots in the default pool |
| `airflow.pool.running_slots.default_pool` | Gauge | Occupied slots in the default pool |
| `airflow.pool.starving_tasks.default_pool` | Gauge | Tasks that can't run because the pool is full |

### Triggerer

| Metric | Type | What It Tells You |
|--------|------|-------------------|
| `airflow.triggerer_heartbeat` | Counter | Is the triggerer alive? |
| `airflow.triggers.running` | Gauge | Number of active triggers (deferrable operators waiting) |
| `airflow.triggers.blocked_main_thread` | Counter | Triggers that blocked the async event loop (performance issue) |

---

### Airflow Orchestration Dashboard in Datadog

A custom dashboard definition is stored at `infra/datadog/airflow_dashboard.json`. To import it:

1. In Datadog → **Dashboards → New Dashboard** → name it "Airflow" → click **New Dashboard** (grid layout)
2. Inside the dashboard, click the gear icon → **Import Dashboard JSON**
3. Paste the contents of `infra/datadog/airflow_dashboard.json`

The dashboard contains 11 widgets:

| Widget | Type | Metric(s) |
|--------|------|-----------|
| Scheduler Heartbeat | Counter | `airflow.scheduler_heartbeat` |
| DAG Bag Size | Counter | `airflow.dagbag_size` |
| Running Tasks | Counter | `airflow.executor.running_tasks` |
| Open Slots | Counter | `airflow.executor.open_slots` |
| Successes vs Failures | Bar chart | `airflow.ti.finish.*.success` / `*.failed` |
| DAG Run Duration | Line chart | `airflow.dagrun.duration.success.*.avg` per DAG |
| Task Queued Duration (p95) | Line chart | `airflow.dag.*.queued_duration.95percentile` |
| DAG Parse Time | Line chart | `airflow.dag_processing.total_parse_time` |
| Pool Slots | Area chart | `airflow.pool.open_slots` / `used_slots` |
| Scheduler Loop | Line chart | `airflow.scheduler.tasks.executable` / `starving` / `loop_duration` |
| Container Logs | Log stream | Live logs from scheduler, webserver, triggerer |

> [!info] Metric Units
> Airflow emits durations in **microseconds**. To display as seconds in Datadog, edit the widget → Y-axis → set unit to `microsecond` and Datadog auto-formats (e.g., 56,000,000 µs → 56s).

---

### Recommended Airflow Monitors in Datadog

Create these in **Monitors → New Monitor → Metric**:

| Monitor | Metric | Condition | Severity |
|---------|--------|-----------|----------|
| Scheduler Down | `airflow.scheduler_heartbeat` | No data for 5 min | P1 (Critical) |
| DAG Parse Error | `airflow.dag_processing.import_errors` | > 0 for 5 min | P2 (High) |
| Task Failure | `airflow.ti.finish.*.failed` | > 0 within 15 min | P2 (High) |
| Pool Starvation | `airflow.pool.starving_tasks.default_pool` | > 0 for 10 min | P3 (Medium) |
| DAG Duration Anomaly | `airflow.dagrun.duration.success.pipeline_pulse.avg` | > 2x baseline for 3 consecutive runs | P3 (Medium) |
| Queued Duration Spike | `airflow.dag.*.queued_duration.95percentile` | > 60,000,000 (60s) | P4 (Low) |
| Triggerer Down | `airflow.triggerer_heartbeat` | No data for 5 min | P3 (Medium) |

---

### Limitations of Self-Hosted Airflow Observability

> [!tip] Related pattern
> When Datadog metrics reveal task failures or scheduler anomalies, the [airflow-troubleshooting](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-troubleshooting) guide provides targeted diagnostic steps for common failure modes like import errors, pool exhaustion, and zombie task recovery.

| Capability | Available? | Alternative |
|------------|-----------|-------------|
| StatsD metrics (DAG runs, tasks, scheduler) | Yes | — |
| Container logs (scheduler, webserver, triggerer) | Yes | — |
| APM traces for DAG tasks | No (tasks run on Cloud Run, not on the Airflow VM) | Instrument the pipeline container with ddtrace |
| Data Observability (row counts, freshness, schema) | No (requires managed Airflow) | Emit custom StatsD metrics from pipeline code |
| DAG code-level profiling | No | Use Airflow's built-in task duration metrics |

---

## Related Notes

- [datadog-architecture-overview](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-architecture-overview) — full observability architecture
- [datadog-agent-airflow-vm](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-agent-airflow-vm) — agent infrastructure including StatsD config
- [datadog-dashboards](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-dashboards) — Pipeline Watch dashboard (covers Cloud Run + SQL VM metrics)
- the Airflow DAGs — DAG structure and what each DAG does
- the startup scripts — startup script where StatsD env vars are set
