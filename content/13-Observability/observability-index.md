---
type: index
category: observability
technology: [datadog, sql-server, gcp]
tags: [monitoring, observability, sql, datadog, gcp]
aliases: [Observability Index, Monitoring Index]
keywords: [observability, monitoring, datadog, gcp, cloud-monitoring, cloud-logging, cloud-trace, APM, traces, metrics, logs, dashboards, alerting, SLA, pipeline-health, MQL, custom-metrics, log-analytics, distributed-tracing]
description: "Index for the Observability section — Datadog setup, GCP-native monitoring (Cloud Monitoring, Cloud Logging, Cloud Trace), pipeline health, SLA tracking, dashboards, alerting, and troubleshooting."
related:
  - "[[index|Elysium]]"
  - "[[five-pillars-of-data-engineering]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Observability

You cannot fix what you cannot see. Every system needs metrics (how much), logs (what happened), and traces (where did time go). See [[five-pillars-of-data-engineering|Pillar 2: Observability]].

### Strategy

| Note | Description |
|------|-------------|
| [[observability-strategy-matrix]] | **Start here** — what to monitor for every component: metrics, logs, alerts, dashboards, severity framework, deployment checklist |

### Datadog Notes

| Note | Description |
|------|-------------|
| [[datadog-architecture-overview]] | Integration overview, prerequisites, deployment topology |
| [[datadog-gcp-integration]] | GCP Cloud Monitoring API setup |
| [[datadog-agent-airflow-vm]] | Agent on Docker COS (Container-Optimized OS) |
| [[datadog-agent-sql-vm]] | Agent on Ubuntu systemd |
| [[datadog-sql-server-integration]] | SQL Server check configuration, custom metrics |
| [[datadog-custom-queries]] | Custom SQL queries surfaced in Datadog |
| [[datadog-apm-traces]] | ddtrace Python instrumentation |
| [[datadog-log-management]] | Log collection, parsing, and indexing |
| [[datadog-sql-server-logs]] | SQL Server error log and slow query log collection |
| [[datadog-airflow-observability]] | StatsD metrics, Airflow dashboards |
| [[datadog-dashboards]] | Pipeline Watch and DBA dashboards |
| [[datadog-alerting]] | Monitor definitions, thresholds, notification channels |
| [[datadog-troubleshooting]] | Agent management, troubleshooting, disabling |
| [[datadog-cost-optimization]] | Optimizing Datadog usage and spend |
| [[datadog-cost-reference]] | Datadog pricing tiers and feature costs |

### Monitoring Patterns and Deep Dives

| Note | Description |
|------|-------------|
| [[observability-deep-dive]] | Observability philosophy, the three pillars, and data pipeline monitoring patterns |

## GCP-Native Observability

Full-stack monitoring using only GCP-native tools — achieving Datadog-level visibility without third-party costs. These notes cover every GCP component used in data engineering: VMs, BigQuery, Cloud Run, Pub/Sub, GCS, Firestore, and Cloud Scheduler.

| Note | Description |
|------|-------------|
| [[gcp-cloud-monitoring-deep-dive]] | Metrics for every GCP component, MQL queries, Ops Agent for SQL Server, custom metrics, dashboards, alerting policies, uptime checks, SLIs/SLOs, full Datadog feature parity comparison |
| [[gcp-cloud-trace-and-logging]] | Structured logging, 20+ gcloud log queries, log-based metrics, log sinks to BigQuery, Log Analytics SQL, audit logs, OpenTelemetry distributed tracing, trace-log correlation, cost comparison |
| [[gcp-pipeline-health-and-sla]] | Data freshness monitoring (3 patterns), quality checks (row counts, nulls, schema drift, duplicates), SLA definition and tracking, dead man's switch, alert triage runbook, self-healing automation, monitoring setup checklist |
| [[gcp-data-lineage-and-catalog]] | Dataplex governance, Data Catalog tagging, business glossary, automatic + custom lineage (Lineage API, OpenLineage), column-level lineage, Dataplex data quality scans, impact analysis, tool comparison (Dataplex vs Atlas vs DataHub vs Collibra) |

**Also in the GCP section** (quick reference for individual services):
- [[cloud-logging]] — Log filter syntax, severity levels, resource filtering, log tailing
- [[cloud-monitoring-metrics]] — Metric types, CPU/disk/network, time-series fundamentals

### When to Use GCP-Native vs Datadog

| Scenario | Recommendation |
|----------|---------------|
| Budget-constrained / startup | GCP-native (free with GCP) |
| Multi-cloud or hybrid infrastructure | Datadog (single pane of glass) |
| Deep SQL Server monitoring | Datadog (richer OOTB metrics) |
| BigQuery / Pub/Sub / Cloud Run monitoring | GCP-native (better integration) |
| APM with auto-instrumentation | Datadog (ddtrace is more mature) |
| Long-term log analytics | GCP-native (BigQuery Log Analytics) |
| Compliance / audit logging | GCP-native (Cloud Audit Logs) |

### dbt
- [[dbt-observability]] — Monitoring dbt runs in Datadog and the elementary package
