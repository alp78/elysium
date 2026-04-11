---
title: "01 - Observability Strategy Matrix"
tags: [observability, monitoring, alerting, dashboards, sla, datadog, gcp, cloud-monitoring, cloud-logging, sql-server, airflow, bigquery, cloud-run, pubsub, firestore, pipeline, on-call]
aliases: [monitoring strategy, what to monitor, observability matrix]
description: "What to monitor for every component: metrics, logs, alerts, dashboards — the strategy layer above tool configuration."
created: 2026-03-29
updated: 2026-03-29
status: complete
---

# Observability Strategy Matrix

> [!quote]
> "I'll start with observability tools only — if you know which tools look but don't touch, you can diagnose problems without introducing new ones."
>
> — **Brendan Gregg**, *Systems Performance* (2013)
>
> "Distributed systems are pathologically unpredictable. It's impossible to predict the myriad states of partial failure various parts of the system might end up in."
>
> — **Cindy Sridharan**, *Distributed Systems Observability* (2018)

This page answers **what to monitor** for every component in the Elysium data platform. It does not cover how to configure any tool — every cell in the matrix links to the implementation page that does.

## The Three Pillars Applied to Data Pipelines

The three pillars from [observability-deep-dive > The Three Pillars (Metrics, Logs, Traces) Applied to Data Pipelines](https://alp78.github.io/elysium/13-Observability/Monitoring/observability-deep-dive#the-three-pillars-metrics-logs-traces-applied-to-data-pipelines) map directly to triage workflow:

- **Metrics** tell you *something is wrong* — a number crossed a threshold
- **Logs** tell you *what is wrong* — the error message, the stack trace, the failed query
- **Traces** tell you *where in the pipeline it went wrong* — which task, which service, which hop introduced the delay or failure

> [!tip] Investigation Order
>
> Start every investigation with metrics (cheap, pre-aggregated), drill into logs (verbose, expensive), and use traces only when the failure spans multiple services.

## Master Monitoring Matrix — Per Component

---

### SQL Server

Dashboard: **DBA Dashboard** | Config: [datadog-sql-server-integration > Built-in SQL Server Metrics Collected by Datadog](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-sql-server-integration#built-in-sql-server-metrics-collected-by-datadog), [gcp-cloud-monitoring-deep-dive > Ops Agent: SQL Server Configuration](https://alp78.github.io/elysium/13-Observability/GCP-Native/gcp-cloud-monitoring-deep-dive#ops-agent-sql-server-configuration)

> [!note] Key Metrics
>
> - **Buffer cache hit ratio** — percentage of pages served from memory vs disk. Below 95% means the buffer pool is too small or queries are scanning too much data
> - **Page Life Expectancy (PLE)** — seconds a page stays in the buffer pool before eviction. Below 300s indicates memory pressure
> - **Wait stats** — top wait types (PAGEIOLATCH = disk bottleneck, LCK_M = lock contention, CXPACKET = parallelism overhead)
> - **Deadlocks/sec** — count of deadlock victims. Any value > 0 needs investigation
> - **Disk %** — percentage of disk capacity used. SQL Server crashes when full
> - **CPU %** — sustained high CPU indicates query inefficiency or under-provisioned VM
> - **Active connections** — connection pool saturation indicator
> - **Batch requests/sec** — workload throughput baseline

> [!abstract] Key Logs
>
> - **Error log (severity >= 16)** — SQL Server errors that affect user sessions. Severity 16 = user error, 17+ = resource/system issues
> - **Slow queries (>5s)** — queries exceeding duration threshold, captured via Extended Events or Datadog deep database monitoring
> - **Deadlock XML** — full deadlock graph from `system_health` session, shows which queries and resources were involved
> - **Login failures** — failed authentication attempts. Spikes may indicate brute-force attacks or misconfigured connection strings

> [!warning] Alert Conditions
>
> - **PLE < 300s** — P2: memory pressure is evicting pages faster than they're being read. Queries will slow as disk I/O increases
> - **Disk > 85%** — P1: SQL Server will crash if the disk fills. Transaction log growth, TempDB spills, or backup files are common causes
> - **Deadlocks > 0/min** — P2: transactions are being killed. Pipeline MERGE operations may fail and need retry logic
> - **CPU > 90% sustained 5min** — P2: queries are CPU-bound. Check for missing indexes, implicit conversions, or parameter sniffing

> [!success] Response patterns for SQL Server alerts
>
> - **PLE low**: check buffer pool size and identify large table scans via `sys.dm_exec_query_stats`; add indexes or increase VM memory
> - **Disk > 85%**: shrink or archive old backup files; verify TempDB auto-growth is not runaway; resize disk online with `resize2fs` if on Linux
> - **Deadlocks**: capture the deadlock graph from `system_health` XEvent session; add `WITH (NOLOCK)` to read-heavy queries or reorder update sequences in MERGE logic
> - **CPU high**: run `sys.dm_exec_requests` to find the blocking query; check for implicit type conversions or missing covering indexes

---

### Airflow

Dashboard: **Pipeline Watch** | Config: [datadog-airflow-observability > Key Metrics Reference](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-airflow-observability#key-metrics-reference), [datadog-dashboards > Airflow Orchestration Dashboard](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-dashboards#airflow-orchestration-dashboard)

> [!note] Key Metrics
>
> - **DAG duration** — end-to-end time per DAG run. Baseline drift indicates data volume growth or infrastructure degradation
> - **Task failure rate** — percentage of tasks ending in FAILED state after all retries exhausted
> - **Scheduler heartbeat lag** — seconds since the scheduler last reported alive. Gap = scheduler is down
> - **DAG parse time** — seconds to parse all DAG files. Above 30s means too many DAGs or expensive module-level imports
> - **Pool utilization** — percentage of pool slots in use. 100% = tasks are queuing
> - **Zombie tasks** — tasks marked as running but with no active process. Indicates worker crashes

> [!abstract] Key Logs
>
> - **Task stdout/stderr** — output from each task's execution. First place to look for transform errors, SQL failures, API timeouts
> - **Scheduler logs** — DAG parsing errors, scheduling decisions, heartbeat status
> - **Executor logs** — worker allocation, task state transitions, resource exhaustion

> [!warning] Alert Conditions
>
> - **SLA miss** — P1: pipeline didn't complete within its defined SLA window. Data freshness is at risk
> - **Task failure after retries** — P2: a task exhausted all retry attempts. Manual investigation needed
> - **Heartbeat > 60s** — P1: scheduler is down. No new tasks will be scheduled until it recovers
> - **Parse time > 30s** — P3: slow DAG parsing delays scheduling. Usually caused by expensive imports at module level

> [!success] Response patterns for Airflow alerts
>
> - **SLA miss**: check task logs for the failed or slow task; verify upstream dependencies completed; trigger a manual backfill if data is recoverable
> - **Task failure after retries**: inspect the final task log for the root exception; fix the root cause before manually clearing the failed task instance
> - **Heartbeat > 60s**: SSH to the Airflow VM and check `systemctl status airflow-scheduler`; restart the scheduler service and monitor for recurrence
> - **Parse time > 30s**: move expensive imports inside task functions rather than at module level; reduce the number of active DAG files if the DAG folder has grown large

---

### BigQuery

Dashboard: **Cost + Performance** | Config: [gcp-cloud-monitoring-deep-dive > BigQuery](https://alp78.github.io/elysium/13-Observability/GCP-Native/gcp-cloud-monitoring-deep-dive#bigquery), [gcp-cloud-monitoring-deep-dive > INFORMATION_SCHEMA Queries for Job-Level Monitoring](https://alp78.github.io/elysium/13-Observability/GCP-Native/gcp-cloud-monitoring-deep-dive#informationschema-queries-for-job-level-monitoring)

> [!note] Key Metrics
>
> - **Bytes scanned/query** — direct cost driver at $6.25/TB. The single most important cost metric
> - **Slot utilization** — percentage of available slots in use. High utilization = queries queue
> - **Query count** — total queries per period. Baseline for anomaly detection
> - **Error rate** — percentage of queries failing. Non-zero needs investigation
> - **Duration p50/p95/p99** — query latency distribution. p99 drift indicates growing tables or missing partitions

> [!abstract] Key Logs
>
> - **Audit logs (BigQueryAuditMetadata)** — every query executed, who ran it, bytes scanned, cost. The authoritative cost analysis source
> - **Job failures** — queries that failed with errors. Check for quota exceeded, syntax errors, permission issues

> [!warning] Alert Conditions
>
> - **Bytes scanned > threshold** — P3: a query is scanning more data than expected. Likely a missing partition filter or `SELECT *`
> - **Failed queries > 0** — P3: investigate immediately. Common causes: DML quota exceeded, table deleted, permission revoked
> - **Duration p99 > 5min** — P3: slowest queries are degrading. Check for unpartitioned tables or slot starvation

> [!success] Response patterns for BigQuery alerts
>
> - **Bytes over threshold**: find the offending query in `INFORMATION_SCHEMA.JOBS_BY_PROJECT` ordered by `total_bytes_processed`; add a `WHERE DATE(_PARTITIONTIME) = ...` filter or enable `require_partition_filter` on the table
> - **Failed queries**: check the `error_result` field in `INFORMATION_SCHEMA.JOBS`; for quota errors, reduce scheduling concurrency; for permission errors, audit IAM role assignments
> - **p99 duration high**: identify unpartitioned tables being full-scanned; add partition and cluster keys, or purchase additional slot capacity if slot starvation is the cause

---

### Cloud Run

Dashboard: **Service Health** | Config: [gcp-cloud-monitoring-deep-dive > Built-in Metrics for Cloud Run Services](https://alp78.github.io/elysium/13-Observability/GCP-Native/gcp-cloud-monitoring-deep-dive#built-in-metrics-for-cloud-run-services)

> [!note] Key Metrics
>
> - **Request count** — total requests per period. Baseline for capacity planning
> - **Latency p50/p95/p99** — response time distribution. p99 captures cold-start impact
> - **Error rate (5xx)** — percentage of server errors. Any sustained rate > 1% is a problem
> - **Cold starts** — count of instances starting from zero. High rate = min-instances too low
> - **Instance count** — active container instances. Correlate with request count for efficiency
> - **Memory %** — container memory utilization. Above 90% risks OOM kills

> [!abstract] Key Logs
>
> - **Stdout/stderr from container** — application logs. First place to look for errors
> - **Crash logs** — container exit with non-zero code. OOM, unhandled exceptions, timeout

> [!warning] Alert Conditions
>
> - **Error rate > 1%** — P2: sustained server errors affecting users or downstream consumers
> - **Latency p99 > 10s** — P3: slowest requests are unacceptably slow. Check for cold starts or upstream dependency issues
> - **Memory > 90%** — P2: close to OOM kill. Increase memory allocation or fix memory leaks
> - **OOM kills > 0** — P1: container is being killed for exceeding memory. Data loss possible if writes are in progress

> [!success] Response patterns for Cloud Run alerts
>
> - **Error rate > 1%**: check container stdout/stderr logs via `gcloud logging read`; look for unhandled exceptions or upstream dependency timeouts; redeploy previous revision if a recent deploy is the cause
> - **Latency p99 high**: check cold start frequency and set `--min-instances=1` for latency-sensitive services; profile the slowest requests with Cloud Trace
> - **Memory > 90%**: increase `--memory` on the service revision; profile heap allocation if a memory leak is suspected
> - **OOM kills**: set `--min-instances=1` to reduce churn; increase `--memory`; verify the pipeline checkpoints progress so a restart does not reprocess already-written data

---

### Pub/Sub

Dashboard: **Messaging Health** | Config: [gcp-cloud-monitoring-deep-dive > Pub/Sub](https://alp78.github.io/elysium/13-Observability/GCP-Native/gcp-cloud-monitoring-deep-dive#pubsub)

> [!note] Key Metrics
>
> - **Unacked message count (backlog)** — messages delivered but not acknowledged. Growing backlog = consumer can't keep up
> - **Oldest unacked age** — age of the oldest unacknowledged message. Shows how far behind the consumer is
> - **Publish/pull latency** — time to publish or pull a message. Spikes indicate Pub/Sub service issues
> - **Dead letter count** — messages moved to DLQ after max delivery attempts. Non-zero = systematic processing failure

> [!abstract] Key Logs
>
> - **DLQ messages** — messages that failed processing repeatedly. Contains the original payload and error context
> - **Subscription errors** — delivery failures, acknowledgement timeouts, permission issues

> [!warning] Alert Conditions
>
> - **Backlog > threshold** — P2: consumer is falling behind. Common causes: consumer crash, slow processing, insufficient concurrency
> - **Oldest unacked > 5min** — P2: messages are aging. If retention window is short, data loss is imminent
> - **DLQ > 0** — P2: messages are failing permanently. Investigate the DLQ for error patterns

> [!success] Response patterns for Pub/Sub alerts
>
> - **Backlog growing**: check the consumer Cloud Run service for crash loops; increase `--max-instances` and `--concurrency` to scale out processing; verify acknowledgement deadlines are long enough for slow messages
> - **Oldest unacked > 5min**: increase the subscription's message retention duration immediately to prevent expiry; scale up consumers in parallel; if messages have expired, replay from the source if available
> - **DLQ > 0**: pull a sample from the DLQ to read the original payload and error; fix the consumer bug; republish DLQ messages after the fix is deployed

---

### Cloud Storage (GCS)

Dashboard: **Storage Dashboard** | Config: [gcp-cloud-monitoring-deep-dive > Cloud Storage](https://alp78.github.io/elysium/13-Observability/GCP-Native/gcp-cloud-monitoring-deep-dive#cloud-storage)

> [!note] Key Metrics
>
> - **Object count** — total objects per bucket. Sudden drops indicate accidental deletion
> - **Total bytes** — storage volume per bucket. Tracks growth for capacity and cost planning
> - **Request count by type** — Class A (writes) vs Class B (reads). Unusual write spikes may indicate runaway pipeline

> [!abstract] Key Logs
>
> - **Access logs** — who accessed which objects. Useful for audit and debugging access issues
> - **Lifecycle actions** — objects transitioned to Nearline/Coldline/Archive or deleted by lifecycle rules

> [!warning] Alert Conditions
>
> - **Unexpected deletes** — P2: object count dropped without a known lifecycle rule or pipeline action. Possible accidental deletion
> - **Object count anomaly** — P3: sudden spike or drop outside normal growth patterns

> [!success] Response patterns for GCS alerts
>
> - **Unexpected deletes**: check Cloud Audit Logs for `storage.objects.delete` events in the affected bucket; if accidental, restore from a versioned bucket (enable object versioning on all landing-zone buckets); identify the IAM principal that issued the delete and restrict permissions if necessary
> - **Object count anomaly**: correlate with pipeline run history; a spike may indicate a runaway write loop — check Cloud Run job execution counts and add a maximum-objects-per-run guard to the pipeline

---

### Firestore

Dashboard: **Real-Time Store** | Config: [gcp-cloud-monitoring-deep-dive > Firestore](https://alp78.github.io/elysium/13-Observability/GCP-Native/gcp-cloud-monitoring-deep-dive#firestore)

> [!note] Key Metrics
>
> - **Read/write ops/sec** — operation throughput. Baseline for cost projection ($0.06/100K reads, $0.18/100K writes)
> - **Active connections** — concurrent client connections. Spikes indicate consumer issues
> - **Document count** — total documents. Unexpected growth may indicate a write loop

> [!abstract] Key Logs
>
> - **Security rule denials** — requests blocked by Firestore security rules. May indicate misconfigured rules or unauthorized access
> - **Quota warnings** — approaching operation or storage quotas

> [!warning] Alert Conditions
>
> - **Write rate > 80% quota** — P2: approaching the per-document write limit (1 write/sec). Contention will cause latency spikes
> - **Security denials > 0** — P3: investigate whether rules are too restrictive or an unauthorized client is probing

> [!success] Response patterns for Firestore alerts
>
> - **Write rate near quota**: batch writes using `WriteBatch` instead of individual document writes; distribute heartbeat state across multiple documents keyed by pipeline name to avoid hotspotting on a single document
> - **Security denials**: check Cloud Audit Log for the denied request's principal and resource path; update security rules to permit legitimate access or revoke the client's credentials if unauthorized

---

### GCE VMs

Dashboard: **VM Health** | Config: [datadog-agent-sql-vm](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-agent-sql-vm), [gcp-cloud-monitoring-deep-dive > Compute Engine VMs](https://alp78.github.io/elysium/13-Observability/GCP-Native/gcp-cloud-monitoring-deep-dive#compute-engine-vms)

> [!note] Key Metrics
>
> - **CPU %** — processor utilization. Sustained > 90% indicates under-provisioned VM or runaway process
> - **Memory %** — RAM utilization. High memory + swap activity = performance degradation
> - **Disk %** — disk capacity used. SQL Server and Airflow VMs are the highest risk
> - **IOPS** — disk operations per second. High IOPS + high latency = disk bottleneck
> - **Network I/O** — bytes in/out. Spikes during pipeline runs are normal; sustained spikes are not

> [!abstract] Key Logs
>
> - **Syslog** — OS-level events: service starts/stops, kernel warnings, SSH logins
> - **OOM kills** — kernel killed a process for exceeding available memory. Check `dmesg` for the victim
> - **systemd failures** — services that failed to start or crashed. SQL Server and Airflow run as systemd services

> [!warning] Alert Conditions
>
> - **CPU > 90% sustained 10min** — P2: VM is compute-bound. Right-size or optimize the workload
> - **Disk > 85%** — P1: disk filling up. SQL Server transaction logs, TempDB, or backup files are common culprits
> - **OOM detected** — P1: a process was killed for memory. Data corruption possible if SQL Server was the victim
> - **Service stopped** — P1: SQL Server or Airflow systemd service is down. Pipeline is blocked

> [!success] Response patterns for GCE VM alerts
>
> - **CPU > 90%**: identify the top process with `top` or `htop`; for SQL Server, run `sys.dm_exec_requests` to find the high-CPU query; right-size the VM machine type if the workload is consistently high
> - **Disk > 85%**: run `df -h` to identify the full partition; archive or delete old backup files; resize the disk with `gcloud compute disks resize` followed by `resize2fs`
> - **OOM**: check `dmesg | grep -i "killed process"` for the victim; increase VM memory or fix the memory-leaking process; verify SQL Server data consistency after an OOM kill
> - **Service stopped**: run `systemctl restart airflow-scheduler` or `systemctl restart mssql-server`; check `journalctl -u <service>` for the failure reason before restarting

---

### The Data Pipeline

Dashboard: **Data Quality** | Config: [gcp-pipeline-health-and-sla > Data Freshness Monitoring](https://alp78.github.io/elysium/13-Observability/GCP-Native/gcp-pipeline-health-and-sla#data-freshness-monitoring), [datadog-custom-queries](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-custom-queries)

> [!note] Key Metrics
>
> - **Data freshness** — time since the last successful pipeline run updated the target tables. The primary SLA metric
> - **Row count/run** — rows processed per pipeline execution. Baseline for anomaly detection (±20% = investigate)
> - **Schema drift** — columns added, removed, or type-changed since last run. Catches upstream API changes
> - **Duplicate rate** — percentage of duplicate rows in target tables. Non-zero after dedup = logic bug

> [!abstract] Key Logs
>
> - **Transform logs** — output from each pipeline stage. Includes row counts, timing, validation results
> - **Validation gate results** — PASS/FAIL for each quality check. The first place to look when data quality degrades

> [!warning] Alert Conditions
>
> - **Stale data > SLA** — P1: pipeline hasn't updated within the defined freshness window. Dashboard is showing old data
> - **Row count anomaly (>20%)** — P2: sudden increase (bad join explosion) or decrease (filter bug, missing source data)
> - **Schema change detected** — P3: upstream schema changed. Contract tests should have caught this — investigate why they didn't
> - **Duplicates > 0** — P2: deduplication logic failed. MERGE key mismatch or race condition in concurrent loads

> [!success] Response patterns for data pipeline alerts
>
> - **Stale data**: check Cloud Run job execution history for the pipeline; if no execution exists, verify the Cloud Scheduler trigger fired; re-trigger manually with `gcloud run jobs execute` after identifying the root cause
> - **Row count anomaly**: compare today's count against the 7-day average in BigQuery `__TABLES__` or the `pipeline_freshness` table; for spikes, check for duplicate loads; for drops, check for missing source partitions
> - **Schema change**: run `check_schema_drift()` against the current table and the reference schema JSON; if a column was renamed upstream, update the reference schema and pipeline mapping; add a contract test to catch this earlier
> - **Duplicates**: identify the duplicate key values with the duplicate detection query; re-run the MERGE with the correct natural key; verify the dedup logic covers all load concurrency scenarios

## Alert Severity Framework

> [!info] Severity Determines Response
>
> Every alert in [datadog-alerting > Deadlock Alert Monitor](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-alerting#deadlock-alert-monitor) and [gcp-cloud-monitoring-deep-dive > Alerting Policies](https://alp78.github.io/elysium/13-Observability/GCP-Native/gcp-cloud-monitoring-deep-dive#alerting-policies) must map to exactly one of these levels.

| Severity | Response Time | Notification Channel | Example Conditions |
|---|---|---|---|
| **P1 — Critical** | 15 min, 24/7 page | PagerDuty phone call + Slack `#incidents` | Pipeline down, data loss risk, SLA breach imminent, deadlocks blocking production |
| **P2 — High** | 30 min during business hours | PagerDuty alert + Slack `#alerts` | Task failure after retries, CPU > 90% sustained, disk > 85%, DLQ messages detected |
| **P3 — Medium** | 4 hours | Slack `#alerts` | Latency degradation (p99 drift), row count anomaly (>20%), slot utilization high |
| **P4 — Low** | Next business day | Slack `#monitoring-info` | Schema drift detected, cost anomaly, cold start frequency increase, login failures |

> [!warning] Alert Fatigue from Over-Paging
>
> Avoid making everything P1. If on-call gets paged for P3 issues, alert fatigue sets in and real P1s get ignored. Review severity assignments quarterly.

> [!success] Enforce the severity framework in your alerting tool
>
> Assign PagerDuty phone-call urgency only to P1 monitors. Map P2 to PagerDuty alert (no phone call outside business hours). Map P3 and P4 to Slack only. Schedule a quarterly severity review meeting: pull alert history, count false-positive P1 pages, and downgrade any alert that has never required immediate action. This keeps the on-call rotation sustainable and P1 responses fast.

## Dashboard Strategy

> [!info] Five Platform Dashboards
>
> Each has a clear audience and refresh cadence. Implementation details live in [datadog-dashboards > Pipeline Watch Dashboard](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-dashboards#pipeline-watch-dashboard), [datadog-dashboards > SQL Server DBA Dashboard](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-dashboards#sql-server-dba-dashboard), and [gcp-cloud-monitoring-deep-dive > Dashboards](https://alp78.github.io/elysium/13-Observability/GCP-Native/gcp-cloud-monitoring-deep-dive#dashboards).

| Dashboard | Audience | Key Panels | Refresh | Tool |
|---|---|---|---|---|
| **Pipeline Watch** | Data engineers, on-call | DAG status, task durations, SLA tracker, freshness gauges | 1 min | Datadog |
| **DBA Dashboard** | Data engineers, DBAs | PLE, buffer cache, waits, deadlocks, query duration, disk/CPU | 1 min | Datadog |
| **Cost Dashboard** | Engineering leads | BigQuery bytes scanned, slot-hours, Cloud Run invocations, GCS storage growth | 1 hour | GCP Console |
| **Data Quality** | Data engineers, analysts | Freshness SLA, row counts, duplicate rate, schema change log | 5 min | Datadog |
| **Service Health** | Platform team, on-call | Cloud Run latency/errors, Pub/Sub backlog, Firestore ops, GCE VM health | 1 min | GCP Console |

> [!tip] Dashboards Link to Runbooks
>
> Every dashboard should have a "last updated" indicator and a link to the relevant runbook. If a panel turns red, the viewer should know exactly which runbook to open without searching.

## Datadog vs GCP-Native — When to Use Which

> [!info] Datadog vs GCP Decision
>
> Full feature comparison lives at [gcp-cloud-monitoring-deep-dive > Cloud Monitoring vs Datadog — Comprehensive Comparison Table](https://alp78.github.io/elysium/13-Observability/GCP-Native/gcp-cloud-monitoring-deep-dive#cloud-monitoring-vs-datadog--comprehensive-comparison-table). This table gives the short decision framework.

| Scenario | Use Datadog | Use GCP-Native | Rationale |
|---|---|---|---|
| SQL Server on GCE | Yes | Agent for collection only | Datadog has richer SQL Server dashboards and query-level metrics |
| Airflow DAG monitoring | Yes | No | Datadog Airflow integration provides DAG/task-level metrics out of the box |
| BigQuery cost tracking | No | Yes | INFORMATION_SCHEMA is free and gives job-level detail Datadog cannot match |
| Cloud Run / Pub/Sub / GCS | Optional | Yes | Built-in GCP metrics are zero-config and have no per-host cost |
| Cross-service alerting | Yes | Backup only | Datadog composite monitors can correlate metrics across SQL Server, Airflow, and GCP services in a single alert |
| Audit and compliance logs | No | Yes | Cloud Audit Logs are the system of record; Datadog should not be the only copy |

> [!warning] Single Alert Source per Metric
>
> Running both tools on the same metric is acceptable for redundancy, but alerting should fire from **one** tool only. Duplicate alerts from Datadog and GCP for the same condition cause confusion and double-paging.

> [!success] Designate a primary alerting tool per metric category
>
> Use the decision table above to assign alerting ownership: Datadog owns SQL Server and Airflow alerts; GCP Cloud Monitoring owns Cloud Run, Pub/Sub, GCS, and Firestore alerts. Disable the secondary tool's alerting policies (keep the metric collection active for redundancy). Document the ownership in each alert's description field so on-call engineers know where to look.

## Anti-Patterns

> [!danger] Observability Anti-Patterns
>
> These patterns silently degrade your observability posture. Audit for them quarterly.
>
> - **Metric without an alert** — collecting data nobody looks at wastes money and creates false confidence
> - **Alert without a runbook** — an alert that fires with no documented response is just noise that trains the team to ignore pages
> - **Dashboard without an owner** — unowned dashboards rot; panels break, thresholds drift, and nobody notices
> - **Logs without structure** — free-text logs that require regex to parse are unsearchable at scale; always use structured JSON logging
> - **Threshold from a guess** — alert thresholds must come from baseline data, not intuition; run a component for two weeks before setting static thresholds
> - **Monitoring only the happy path** — if you only track success counts, a silent failure (zero rows, no errors) will never fire an alert; always monitor for the *absence* of expected events
> - **Single-tool dependency** — if Datadog goes down and you have no GCP-native alerts, you are blind; critical P1 alerts should exist in both systems

> [!success] Quarterly observability posture checklist
>
> Run a 30-minute audit against this list each quarter: (1) list all custom metrics and confirm each has a linked alert; (2) list all alerts and confirm each has a runbook URL in the description; (3) list all dashboards and confirm each has a named owner and a "last verified" date; (4) review a sample of pipeline logs and confirm JSON structure is consistent; (5) review alert history and recalibrate thresholds that fired zero or more than 10 times in the quarter; (6) verify at least one P1 alert exists in both Datadog and GCP-native for each critical component.
