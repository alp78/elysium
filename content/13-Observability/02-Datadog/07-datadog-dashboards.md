---
title: "07 - Datadog Dashboards"
tags: [monitoring, observability, sql, airflow, datadog, gcp]
aliases: [Pipeline Watch Dashboard, SQL Server DBA Dashboard, Datadog Dashboards, Airflow Dashboard]
description: "Step-by-step instructions for building the Pipeline Watch and SQL Server DBA dashboards in Datadog, plus the Airflow Orchestration Dashboard — covering all widgets, metrics, and layout tips."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Datadog Dashboards

> [!quote]+
> "The real key to modern infrastructure isn't perfect automation, but correlation — linking downstream effects back to upstream causes."
>
> — **Kelsey Hightower**, tweet (2019)

> [!abstract]- Summary
>
> This note turns raw Datadog telemetry into operator views: it organizes Cloud Run, SQL Server, and Airflow signals into dashboards that surface current health, capacity pressure, and failure indicators quickly enough for a human to triage the platform without digging through every metric namespace manually.
>
> **Pipeline watch design**
> - Builds the main cross-platform dashboard from Cloud Run job metrics, SQL VM host metrics, and SQL Server engine counters so the whole pipeline can be scanned in one place.
> - Uses sectioned widget groups to keep the runtime path readable from ingestion trigger to database state.
>
> **SQL Server DBA view**
> - Adds a database-focused dashboard for deadlocks, connections, batch rate, waits, and buffer-pool signals that matter to the SQL operating surface.
> - Separates DBA triage from broad pipeline status so deeper engine diagnosis does not clutter the cross-system board.
>
> **Airflow orchestration board**
> - Collects scheduler and task metrics into an orchestration-specific board tuned for DAG health and concurrency behavior.
> - Shows how Airflow observability becomes usable when metric families are grouped into an intentional layout rather than viewed one by one.
>
> **Dashboarding practice**
> - Treats widget choice, section headers, and query scope as part of observability design rather than as cosmetic UI work.
> - When to use: the signals already exist and the next task is to assemble them into dashboards that support real triage.

> [!note]- Glossary
>
> **dashboard**
> - A Datadog page that arranges related widgets into an operational view of a system.
> - It matters here because the note is about turning telemetry into a scan path that humans can actually use.
>
> > [!info] Human triage surface
> >
> > A good dashboard reduces lookup time by making the investigation order obvious.
>
> ---
>
> **timeseries widget**
> - A chart widget that shows how a metric changes over time.
> - It matters here because trend direction often matters more than a single point for CPU, waits, or DAG duration.
>
> > [!tip] Shape beats snapshot
> >
> > Troubleshooting usually depends on slope, spikes, and persistence rather than one isolated value.
>
> ---
>
> **query value widget**
> - A widget that highlights the current or aggregated value of one metric query.
> - It matters here because deadlocks, cache ratio, and similar headline signals benefit from a direct current-state readout.
>
> > [!info] Fast state read
> >
> > Use this when the operator first needs the answer, not the full time history.
>
> ---
>
> **section header**
> - A text widget or heading block used to separate related groups of dashboard widgets.
> - It matters here because the large dashboards in this note depend on visual grouping to stay readable.
>
> > [!tip] Layout is part of meaning
> >
> > Grouping widgets by system layer gives the viewer a natural left-to-right or top-to-bottom investigation path.
>
> ---
>
> **metric namespace**
> - The prefix family that identifies where a Datadog metric comes from, such as SQL Server or Cloud Run.
> - It matters here because building mixed dashboards requires pulling from multiple namespaces without confusing their semantics.
>
> > [!info] Know the source family
> >
> > Cross-system dashboards only work when the author knows which provider or integration each metric belongs to.
>
> ---
>
> **tag filter**
> - The query condition that limits a widget to a specific host, job, service, or environment.
> - It matters here because shared metric names become useful only after the right resource tags narrow the scope.
>
> > [!tip] Scope before interpretation
> >
> > Bad filters create misleading dashboards even when the underlying metrics are accurate.
>
> ---
>
> **triage board**
> - A dashboard designed to answer what is broken, where, and how badly in the first minutes of an incident.
> - It matters here because the main Pipeline Watch dashboard is meant to drive the first-pass investigation sequence.
>
> > [!info] First-stop dashboard
> >
> > A triage board is not an archive of every metric; it is a fast path to the next diagnostic question.
>
> ---
>
> **capacity signal**
> - A metric that reveals saturation or headroom, such as CPU, memory, connections, or pool usage.
> - It matters here because many dashboard widgets in the note are there to explain slowdown before outright failure occurs.
>
> > [!tip] Pressure before outage
> >
> > Capacity signals often move first and tell you which subsystem is about to become the incident center.

## Pipeline Watch Dashboard

A custom dashboard gathering all useful metrics to monitor during pipeline runs.

### Create the Dashboard

1. Go to **Dashboards > New Dashboard**
2. Name it **Pipeline Watch**
3. Choose **Screenboard** layout (free-form, not grid)

### Adding Section Headers

Use **Notes & Links** widgets as section headers:

1. Click **+ Add Widget** → **Notes & Links**
2. Enter markdown for the header, e.g.:

```markdown
   ## Cloud Run Job
```

3. Style: set background color to match your theme, make text bold
4. Drag to span the full width

> [!tip] Screenboard Layout
> Drag the Notes & Links section headers to span the full width. Place Query Value widgets in a row at the top of each section. Stack Timeseries widgets in a 2-column grid below. The screenboard editor can be buggy — dragging widgets near edges may push others down. Save frequently.

---

### Section 1: Cloud Run Job

#### Widget: Pipeline Runs (Query Value)

| Setting | Value |
|---------|-------|
| Type | Query Value |
| Metric | `sum:gcp.run.job.completed_execution_count{job_name:data-pipeline-pipeline}.as_count()` |
| Aggregator | sum |
| Title | Pipeline Runs |

#### Widget: DAG Task Executions (Query Value)

| Setting | Value |
|---------|-------|
| Type | Query Value |
| Metric | `sum:gcp.run.job.completed_execution_count{job_name:data-pipeline-*}.as_count()` |
| Aggregator | sum |
| Title | DAG Task Executions |

> [!info] data-pipeline-pipeline vs data-pipeline-*
> `data-pipeline-pipeline` is the main job. Each Airflow DAG task (pipeline-daily, data-pipeline-pipeline, etc.) runs as a separate Cloud Run job. Using `job_name:data-pipeline-*` captures all task executions.

#### Widget: DAG Task Duration (Timeseries, bars)

| Setting | Value |
|---------|-------|
| Type | Timeseries (bars) |
| Source | APM Metrics |
| Metric | Total Time |
| Service | `data-pipeline-pipeline` |
| Operation | `pipeline.step` |
| Group By | `resource_name` |
| Title | DAG Task Duration |

This breaks down each pipeline step by name and shows how long each took. The steps that load into the [gold layer](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/gold-transforms) are typically the most resource-intensive, since they run aggregation logic and write final business-ready tables.

#### Widget: Pipeline Peak CPU (Query Value)

| Setting | Value |
|---------|-------|
| Type | Query Value |
| Metric | `avg:gcp.run.container.cpu.utilizations.avg{job_name:data-pipeline-pipeline}` |
| Aggregator | max |
| Title | Pipeline Peak CPU |

#### Widget: Pipeline Peak Memory (Query Value)

| Setting | Value |
|---------|-------|
| Type | Query Value |
| Metric | `avg:gcp.run.container.memory.usage{job_name:data-pipeline-pipeline}` |
| Aggregator | max |
| Title | Pipeline Peak Memory |

> [!warning] Correct Metric Name
> Use `gcp.run.container.memory.usage` (not `utilizations`). Cloud Run jobs are ephemeral (1-2 min runtime), so timeseries charts show tiny blips — Query Value with `max` aggregator is better.

> [!success] Correct Widget Config
> Set metric to `avg:gcp.run.container.memory.usage{job_name:data-pipeline-pipeline}`, type **Query Value**, aggregator **max**. This shows peak memory used during the job's short execution window rather than a nearly-invisible timeseries blip.

---

### Section 2: SQL Server VM

#### Widget: SQL VM — Available Memory (Query Value)

| Setting | Value |
|---------|-------|
| Type | Query Value |
| Metric | `avg:system.mem.usable{host:data-pipeline-sql}` |
| Aggregator | last |
| Title | SQL VM — Available Memory |

#### Widget: SQL VM — Memory (Timeseries)

| Setting | Value |
|---------|-------|
| Type | Timeseries |
| Query 1 | `avg:system.mem.used{host:data-pipeline-sql}` |
| Query 2 | `avg:system.mem.usable{host:data-pipeline-sql}` |
| Title | SQL VM — Memory |

#### Widget: SQL VM — CPU (Timeseries)

| Setting | Value |
|---------|-------|
| Type | Timeseries |
| Query 1 | `avg:system.cpu.user{host:data-pipeline-sql}` |
| Query 2 | `avg:system.cpu.system{host:data-pipeline-sql}` |
| Query 3 | `avg:system.cpu.iowait{host:data-pipeline-sql}` |
| Title | SQL VM — CPU |

#### Widget: SQL VM — System Load (Timeseries)

| Setting | Value |
|---------|-------|
| Type | Timeseries |
| Query 1 | `avg:system.load.1{host:data-pipeline-sql}` |
| Query 2 | `avg:system.load.5{host:data-pipeline-sql}` |
| Title | SQL VM — System Load |

#### Widget: SQL VM — Disk I/O Wait (Timeseries)

| Setting | Value |
|---------|-------|
| Type | Timeseries |
| Metric | `avg:system.io.await{host:data-pipeline-sql} by {device}` |
| Title | SQL VM — Disk I/O Wait |

#### Widget: SQL VM — Disk Utilization (Timeseries)

| Setting | Value |
|---------|-------|
| Type | Timeseries |
| Metric | `avg:system.io.util{host:data-pipeline-sql} by {device}` |
| Title | SQL VM — Disk Utilization |

#### Widget: SQL VM — Disk IOPS (Timeseries)

| Setting | Value |
|---------|-------|
| Type | Timeseries |
| Query 1 | `avg:system.io.r_s{host:data-pipeline-sql}` |
| Query 2 | `avg:system.io.w_s{host:data-pipeline-sql}` |
| Title | SQL VM — Disk IOPS |

#### Widget: SQL VM — Network (Timeseries)

| Setting | Value |
|---------|-------|
| Type | Timeseries |
| Query 1 | `avg:system.net.bytes_sent{host:data-pipeline-sql}` |
| Query 2 | `avg:system.net.bytes_rcvd{host:data-pipeline-sql}` |
| Title | SQL VM — Network |

---

### Section 3: SQL Server Database

#### Widget: SQL Server — Connections (Query Value)

| Setting | Value |
|---------|-------|
| Type | Query Value |
| Metric | `avg:sqlserver.stats.connections{host:data-pipeline-sql}` |
| Aggregator | last |
| Title | SQL Server — Connections |

#### Widget: SQL Server — Connections by Login (Top List)

| Setting | Value |
|---------|-------|
| Type | Top List |
| Metric | `max:sqlserver.sqlserver.connections.by_login{host:data-pipeline-sql}` |
| Aggregation | max by `login_name` |
| Reduce values in timeframe to | max |
| Title | SQL Server — Connections by Login |

> [!warning] Two Aggregation Steps Matter
> - **Spatial aggregation** (left side): `max by login_name` — groups by login and takes the peak per login
> - **Temporal aggregation** (right side): `reduce values in timeframe to max` — takes the peak value across the selected time window
>
> Using `sum` for either will inflate the numbers (sums every 15-second check interval). Always use `max` for both to see realistic connection counts.

> [!success] Correct Aggregation Setup
> In the Top List widget editor: spatial aggregation = **max by `login_name`**, temporal aggregation (reduce values) = **max**. This correctly shows the peak concurrent connection count per login over the selected timeframe without artificial inflation from polling intervals.

#### Widget: SQL Server — Buffer Cache Hit Ratio (Timeseries)

| Setting | Value |
|---------|-------|
| Type | Timeseries |
| Metric | `avg:sqlserver.buffer.cache_hit_ratio{host:data-pipeline-sql}` |
| Title | SQL Server — Buffer Cache Hit Ratio |

> [!tip] Buffer Cache Target
> Should stay above 99%. Drops below 95% indicate memory pressure.

#### Widget: SQL Server — Lock Waits (Timeseries)

| Setting | Value |
|---------|-------|
| Type | Timeseries |
| Metric | `avg:sqlserver.stats.lock_waits{host:data-pipeline-sql}` |
| Title | SQL Server — Lock Waits |

#### Widget: SQL Server — Batch Requests/sec (Timeseries)

| Setting | Value |
|---------|-------|
| Type | Timeseries |
| Metric | `avg:sqlserver.stats.batch_requests{host:data-pipeline-sql}` |
| Title | SQL Server — Batch Requests/sec |

#### Widget: SQL Server — Page Life Expectancy (Timeseries)

| Setting | Value |
|---------|-------|
| Type | Timeseries |
| Metric | `avg:sqlserver.buffer.page_life_expectancy{host:data-pipeline-sql}` |
| Title | SQL Server — Page Life Expectancy |

> [!tip] Page Life Expectancy Target
> Higher is better. Drops below 300 seconds indicate memory pressure and frequent page evictions.

#### Widget: SQL Server — Checkpoint Pages/sec (Timeseries)

| Setting | Value |
|---------|-------|
| Type | Timeseries |
| Metric | `avg:sqlserver.buffer.checkpoint_pages{host:data-pipeline-sql}` |
| Title | SQL Server — Checkpoint Pages/sec |

---

## SQL Server DBA Dashboard

A dedicated dashboard for SQL Server database administration — deadlock monitoring, blocking detection, buffer pool health, and connection tracking. Separate from Pipeline Watch. The financial metrics displayed here (such as deadlock counts during index calculation windows) complement the business-level views in [index-snapshot-metrics](https://alp78.github.io/elysium/17-Financial-Domain/Metrics-and-Scoring/index-snapshot-metrics).

### Create the Dashboard

1. Go to **Dashboards > New Dashboard**
2. Name it **SQL Server DBA**
3. Choose **Screenboard** layout (free-form)

### Widget 1: Deadlock Count (Query Value)

The most important widget — shows the total number of deadlocks detected.

1. **+ Add Widget** → **Query Value**
2. **Metric:** `sqlserver.deadlocks.total`
3. **Aggregation:** `sum`
4. **Timeframe:** Past 1 Hour
5. **Title:** "Deadlock Count"
6. **Conditional Formatting:**
   - Green background when value = 0
   - Red background when value > 0
7. Click **Save**

### Widget 2: Active Connections by Login (Timeseries)

Shows who is connected to SQL Server over time, broken down by login name and application.

1. **+ Add Widget** → **Timeseries**
2. **Metric:** `sqlserver.connections.by_login`
3. **Group by:** `login_name`, `program_name`
4. **Display:** Bars (stacked)
5. **Title:** "Active Connections by Login"
6. Click **Save**

### Widget 3: Batch Requests/sec (Timeseries)

Overall SQL Server throughput indicator.

1. **+ Add Widget** → **Timeseries**
2. **Metric:** `sqlserver.stats.batch_requests`
3. **Display:** Line
4. **Title:** "Batch Requests/sec"
5. Click **Save**

### Widget 4: Lock Waits/sec (Timeseries)

Tracks how often queries are waiting for locks. Spikes correlate with blocking and potential deadlocks.

1. **+ Add Widget** → **Timeseries**
2. **Metric:** `sqlserver.stats.lock_waits`
3. **Display:** Line
4. **Title:** "Lock Waits/sec"
5. Click **Save**

### Widget 5: Buffer Cache Hit Ratio (Query Value)

Should be > 99% for a healthy server. Low values indicate insufficient memory.

1. **+ Add Widget** → **Query Value**
2. **Metric:** `sqlserver.buffer.cache_hit_ratio`
3. **Title:** "Buffer Cache Hit %"
4. **Conditional Formatting:**
   - Green when value > 99
   - Yellow when value > 95
   - Red when value <= 95
5. Click **Save**

### Widget 6: Buffer Pool Size (Timeseries)

Tracks SQL Server's buffer pool memory usage over time.

1. **+ Add Widget** → **Timeseries**
2. **Metric:** `sqlserver.buffer.pool_size`
3. **Display:** Area
4. **Title:** "Buffer Pool (pages)"
5. Click **Save**

---

## Airflow Orchestration Dashboard

A custom dashboard definition is stored at `infra/datadog/airflow_dashboard.json`. To import it:

1. In Datadog → **Dashboards → New Dashboard** → name it "Airflow" → click **New Dashboard** (grid layout)
2. Inside the dashboard, click the gear icon (⚙️) → **Import Dashboard JSON**
3. Paste the contents of `infra/datadog/airflow_dashboard.json`

### Airflow Dashboard Widgets (11 total)

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

> [!info] Airflow Duration Units
> Airflow emits durations in **microseconds**. To display as seconds in Datadog, edit the widget → Y-axis → set unit to `microsecond` and Datadog auto-formats (e.g., 56,000,000 µs → 56s).

---

## Related

- [datadog-architecture-overview](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-architecture-overview) — Full observability topology
- [datadog-alerting](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-alerting) — Monitors and alert configurations
- [datadog-custom-queries](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-custom-queries) — Custom DMV metrics consumed by these dashboards
- [datadog-sql-server-integration](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-sql-server-integration) — Built-in SQL Server metrics
- [datadog-agent-airflow-vm](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-agent-airflow-vm) — StatsD source for Airflow metrics
- [datadog-gcp-integration](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-gcp-integration) — GCP Integration for Cloud Run metrics
- [essential-dba-queries](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/essential-dba-queries) — Manual DMV queries for deeper investigation
