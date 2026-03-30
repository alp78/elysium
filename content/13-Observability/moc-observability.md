---
title: "MOC: Observability"
tags:
  - moc
  - observability
  - monitoring
  - datadog
---

# MOC: Observability

Observability for the Elysium data platform spans three layers: Datadog agents for infrastructure and application monitoring, GCP-native services for cloud telemetry and lineage, and a strategy layer that ties monitoring decisions to business outcomes. This MOC groups all 22 pages by monitoring concern so you can navigate from platform setup through pipeline health to compliance.

## Datadog Platform Setup — Agents, Integrations, and Cost

Architecture decisions, agent installation, and integration configuration for the Datadog observability stack. Start with the architecture overview, then follow the agent setup pages for each VM.

* [[datadog-architecture-overview]] — how two agents and one GCP integration deliver metrics, logs, and traces across the full stack topology

* [[datadog-agent-airflow-vm]] — deploying dd-agent as a Docker container on Container-Optimized OS, covering startup scripts, autodiscovery labels, and DogStatsD

* [[datadog-agent-sql-vm]] — installing the Datadog Agent via systemd on Ubuntu, automated bootstrap, and the dd_agent SQL login

* [[datadog-gcp-integration]] — pulling Cloud Run job metrics from Google Cloud Monitoring into Datadog via service account and API integration

* [[datadog-sql-server-integration]] — ODBC connection setup, conf.yaml reference, and the built-in DMV metrics collected every 15 seconds

* [[datadog-cost-optimization]] — agent RAM overhead on each VM, trial vs paid pricing, and how to cleanly disable all Datadog components

* [[datadog-cost-reference]] — SaaS pricing breakdown by host count, log volume, and APM trace volume for the two-VM platform

* [[datadog-troubleshooting]] — diagnosing agent not appearing, missing APM traces, no logs, COS filesystem constraints, ghost hosts, and CRLF issues

## Datadog Dashboards, Alerts, and Instrumentation — Actionable Signals

Turning raw telemetry into dashboards, monitors, and traced pipeline runs. These pages assume the agents are already running.

* [[datadog-dashboards]] — building the Pipeline Watch, SQL Server DBA, and Airflow Orchestration dashboards widget by widget

* [[datadog-alerting]] — configuring monitors for SQL Server deadlock detection, Airflow scheduler health, task failure alerts, and pool starvation warnings

* [[datadog-custom-queries]] — writing custom DMV queries that surface connections-by-login and deadlock counts as tagged Datadog metrics

* [[datadog-apm-traces]] — how ddtrace auto-instruments pyodbc and requests, creating per-step flame graphs with log-to-trace correlation

* [[datadog-airflow-observability]] — enabling StatsD metrics from Airflow containers, key scheduler and DAG run metrics, and the Airflow dashboard

* [[datadog-log-management]] — SQL Server errorlog file tailing on the SQL VM and Docker socket autodiscovery for Airflow container logs

* [[datadog-sql-server-logs]] — logs.yaml setup, dd-agent mssql group permissions, and verifying that SQL Server errorlog entries flow to Log Explorer

## GCP-Native Monitoring — Cloud Monitoring, Logging, Trace, and Lineage

GCP-native observability tools that complement or replace Datadog, including pipeline health SLAs and data governance through lineage and cataloging.

* [[gcp-cloud-monitoring-deep-dive]] — metric types, MQL queries, alerting policies, uptime checks, SLOs, custom metrics, Ops Agent SQL Server config, and Datadog feature-parity comparison

* [[gcp-cloud-trace-and-logging]] — structured logging, Log Explorer queries, log-based metrics, log routing to BigQuery, OpenTelemetry tracing, span instrumentation, and trace-log correlation

* [[gcp-pipeline-health-and-sla]] — data freshness checks, row count validation, SLA definition and measurement, alerting triage decision trees, on-call runbooks, and self-healing automation

* [[gcp-data-lineage-and-catalog]] — Dataplex governance, Data Catalog tag templates, Lineage API for column-level tracking, OpenLineage integration, data quality scans, and impact analysis

## Observability Strategy — What to Monitor and Why

The conceptual layer connecting tool configuration to monitoring philosophy, data quality frameworks, and financial compliance obligations.

* [[observability-strategy-matrix]] — per-component monitoring matrix defining which metrics, logs, alerts, and dashboards apply to every platform service

* [[observability-deep-dive]] — the three pillars applied to data pipelines, custom DataDog metrics for pipeline health, data freshness tracking, lineage implementation, data catalog tooling, and drift detection

* [[compliance-and-auditability]] — end-to-end audit trails for index calculation, corporate action processing, EU BMR obligations, restatement procedures, and continuous compliance monitoring
