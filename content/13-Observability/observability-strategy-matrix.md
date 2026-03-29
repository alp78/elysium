---
type: reference
category: observability
technology: [datadog, gcp, cloud-monitoring, cloud-logging]
tags: [observability, monitoring, alerting, dashboards, sla, datadog, gcp, cloud-monitoring, cloud-logging, sql-server, airflow, bigquery, cloud-run, pubsub, firestore, pipeline, on-call]
aliases: [monitoring strategy, what to monitor, observability matrix]
keywords: [metrics, logs, traces, alerts, dashboards, freshness, data quality, SLA, dead man switch, on-call]
description: "What to monitor for every component: metrics, logs, alerts, dashboards — the strategy layer above tool configuration."
related:
  - "[[observability-index]]"
  - "[[observability-deep-dive]]"
  - "[[gcp-pipeline-health-and-sla]]"
  - "[[gcp-cloud-monitoring-deep-dive]]"
  - "[[datadog-alerting]]"
  - "[[datadog-dashboards]]"
  - "[[five-pillars-of-data-engineering]]"
created: 2026-03-29
updated: 2026-03-29
status: complete
---

# Observability Strategy Matrix

This page answers **what to monitor** for every component in the Elysium data platform. It does not cover how to configure any tool — every cell in the matrix links to the implementation page that does.

## The Three Pillars Applied to Data Pipelines

The three pillars from [[observability-deep-dive#The Three Pillars (Metrics, Logs, Traces) Applied to Data Pipelines]] map directly to triage workflow:

- **Metrics** tell you *something is wrong* — a number crossed a threshold
- **Logs** tell you *what is wrong* — the error message, the stack trace, the failed query
- **Traces** tell you *where in the pipeline it went wrong* — which task, which service, which hop introduced the delay or failure

> [!tip] Investigation Order
>
> Start every investigation with metrics (cheap, pre-aggregated), drill into logs (verbose, expensive), and use traces only when the failure spans multiple services.

## Master Monitoring Matrix

> [!info] Per-Component Monitoring
>
> Each row is one component. **Config Links** point to the exact heading where that integration is configured — this page never duplicates setup instructions.

| Component | Key Metrics | Key Logs | Alert Conditions | Dashboard | Config Links |
|---|---|---|---|---|---|
| SQL Server | Buffer cache hit ratio, PLE, waits, deadlocks/sec, disk %, CPU %, active connections, batch requests/sec | Error log (severity >= 16), slow queries (>5s), deadlock XML, login failures | PLE < 300s, disk > 85%, deadlocks > 0/min, CPU > 90% 5min | DBA Dashboard | [[datadog-sql-server-integration#Built-in SQL Server Metrics Collected by Datadog]], [[gcp-cloud-monitoring-deep-dive#Ops Agent: SQL Server Configuration]] |
| Airflow | DAG duration, task failure rate, scheduler heartbeat lag, parse time, pool utilization, zombie tasks | Task stdout/stderr, scheduler logs, executor logs | SLA miss, task failure after retries, heartbeat > 60s, parse > 30s | Pipeline Watch | [[datadog-airflow-observability#Key Metrics Reference]], [[datadog-dashboards#Airflow Orchestration Dashboard]] |
| BigQuery | Bytes scanned/query, slot utilization, query count, error rate, duration p50/p95/p99 | Audit logs (BigQueryAuditMetadata), job failures | Bytes scanned > threshold, failed queries > 0, duration p99 > 5min | Cost + Performance | [[gcp-cloud-monitoring-deep-dive#BigQuery]], [[gcp-cloud-monitoring-deep-dive#INFORMATION_SCHEMA Queries for Job-Level Monitoring]] |
| Cloud Run | Request count, latency p50/p95/p99, error rate (5xx), cold starts, instance count, memory % | Stdout/stderr from container, crash logs | Error rate > 1%, latency p99 > 10s, memory > 90%, OOM kills > 0 | Service Health | [[gcp-cloud-monitoring-deep-dive#Built-in Metrics for Cloud Run Services]] |
| Pub/Sub | Unacked message count (backlog), oldest unacked age, publish/pull latency, dead letter count | DLQ messages, subscription errors | Backlog > threshold, oldest unacked > 5min, DLQ > 0 | Messaging Health | [[gcp-cloud-monitoring-deep-dive#Pub/Sub]], [[pubsub-dead-letter-backup]] |
| GCS | Object count, total bytes, request count by type | Access logs, lifecycle actions | Unexpected deletes, object count anomaly | Storage Dashboard | [[gcp-cloud-monitoring-deep-dive#Cloud Storage]] |
| Firestore | Read/write ops/sec, active connections, document count | Security rule denials, quota warnings | Write rate > 80% quota, security denials > 0 | Real-Time Store | [[gcp-cloud-monitoring-deep-dive#Firestore]] |
| GCE VMs | CPU %, memory %, disk %, IOPS, network I/O | Syslog, OOM kills, systemd failures | CPU > 90% 10min, disk > 85%, OOM detected, service stopped | VM Health | [[datadog-agent-sql-vm]], [[gcp-cloud-monitoring-deep-dive#Compute Engine VMs]] |
| The Pipeline | Data freshness, row count/run, schema drift, duplicate rate | Transform logs, validation gates | Stale data > SLA, row count anomaly (>20%), schema change, duplicates > 0 | Data Quality | [[gcp-pipeline-health-and-sla#Data Freshness Monitoring]], [[datadog-custom-queries]] |

## Alert Severity Framework

> [!info] Severity Determines Response
>
> Every alert in [[datadog-alerting#Deadlock Alert Monitor]] and [[gcp-cloud-monitoring-deep-dive#Alerting Policies]] must map to exactly one of these levels.

| Severity | Response Time | Notification Channel | Example Conditions |
|---|---|---|---|
| **P1 — Critical** | 15 min, 24/7 page | PagerDuty phone call + Slack `#incidents` | Pipeline down, data loss risk, SLA breach imminent, deadlocks blocking production |
| **P2 — High** | 30 min during business hours | PagerDuty alert + Slack `#alerts` | Task failure after retries, CPU > 90% sustained, disk > 85%, DLQ messages detected |
| **P3 — Medium** | 4 hours | Slack `#alerts` | Latency degradation (p99 drift), row count anomaly (>20%), slot utilization high |
| **P4 — Low** | Next business day | Slack `#monitoring-info` | Schema drift detected, cost anomaly, cold start frequency increase, login failures |

> [!warning] Alert Fatigue from Over-Paging
>
> Avoid making everything P1. If on-call gets paged for P3 issues, alert fatigue sets in and real P1s get ignored. Review severity assignments quarterly.

## Dashboard Strategy

> [!info] Five Platform Dashboards
>
> Each has a clear audience and refresh cadence. Implementation details live in [[datadog-dashboards#Pipeline Watch Dashboard]], [[datadog-dashboards#SQL Server DBA Dashboard]], and [[gcp-cloud-monitoring-deep-dive#Dashboards]].

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

## New Deployment Monitoring Checklist

> [!tip] Pre-Production Monitoring Checklist
>
> Before any new component goes to production, verify all ten items. See also [[gcp-pipeline-health-and-sla#Complete Monitoring Setup Checklist]] for the GCP-specific variant.
>
> - [ ] **Metrics** — key metrics are being emitted and visible in Datadog or Cloud Monitoring
> - [ ] **Logs** — structured logs are flowing to Cloud Logging with correct severity levels
> - [ ] **Alerts** — at least one P1 and one P2 alert exist with correct notification channels
> - [ ] **Dashboard** — component appears on the relevant dashboard with meaningful panels
> - [ ] **Runbook** — a runbook exists for every alert, linked from the alert description
> - [ ] **SLA** — freshness and availability SLAs are defined and tracked; see [[gcp-pipeline-health-and-sla#Data Freshness Monitoring]]
> - [ ] **On-call** — the component is assigned to an on-call rotation with escalation paths
> - [ ] **Data quality** — row count, schema, and duplicate checks are in place for any data output
> - [ ] **Dead man's switch** — a heartbeat monitor fires if the component stops reporting; see [[gcp-pipeline-health-and-sla#Dead Man's Switch (Heartbeat Monitoring)]]
> - [ ] **Cost** — expected cost baseline is documented; anomaly alert exists for >30% deviation

## Datadog vs GCP-Native — When to Use Which

> [!info] Datadog vs GCP Decision
>
> Full feature comparison lives at [[gcp-cloud-monitoring-deep-dive#Cloud Monitoring vs Datadog — Comprehensive Comparison Table]]. This table gives the short decision framework.

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
