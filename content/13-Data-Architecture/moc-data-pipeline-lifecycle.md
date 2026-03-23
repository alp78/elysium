---
type: index
category: data-architecture
technology: [python, sql-server, airflow, datadog, gcp]
tags: [architecture, pipeline, python, sql, airflow, datadog, gcp]
aliases: [Data Pipeline Lifecycle MOC, Pipeline Lifecycle, data pipeline overview]
keywords: [data pipeline, lifecycle, ingestion, transformation, orchestration, monitoring, end to end, medallion, bronze, silver, gold]
description: "Map of Content tracing a data pipeline from ingestion through transformation, loading, orchestration, and monitoring — linking all relevant vault notes along the way."
related:
  - "[[index|Elysium]]"
  - "[[five-pillars-of-data-engineering]]"
  - "[[medallion-architecture]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# MOC: Data Pipeline Lifecycle

This map traces a data pipeline end-to-end, from raw data ingestion to monitoring in production. Follow the links to dive deep into any stage.

## 1. Design and Architecture

Before writing code, establish the foundational patterns:

- [[five-pillars-of-data-engineering]] — Reliability, observability, efficiency, security, operability
- [[medallion-architecture]] — Bronze/silver/gold layer design
- [[idempotent-pipeline-design]] — Safe re-runs and backfills
- [[etl-vs-elt]] — When to transform outside vs inside the warehouse

## 2. Infrastructure Provisioning

Set up the compute, storage, and networking:

- [[hcl-syntax-basics]] — Terraform language fundamentals
- [[terraform-plan-apply-destroy]] — Provisioning workflow
- [[terraform-networking]] — VPC, firewall, NAT
- [[terraform-compute]] — VM instances for SQL Server and Airflow
- [[terraform-cloud-run]] — Serverless containers for dashboards

## 3. Data Ingestion (Bronze Layer)

Extract raw data from sources and land it in the bronze layer:

- [[python-virtual-environments]] — Isolated Python runtime
- [[python-pipeline-execution]] — Running extraction scripts
- [[bronze-layer-loading]] — JSON to bronze tables
- the pipeline steps — project-specific pipeline step reference

## 4. Data Transformation (Silver Layer)

Clean, deduplicate, and enrich data:

- [[silver-transforms]] — Deduplication, SCD Type 2, data cleaning
- [[merge-and-upsert]] — T-SQL MERGE patterns
- [[sargable-queries]] — Writing queries that use indexes effectively

## 5. Analytics and Aggregation (Gold Layer)

Produce business-ready datasets:

- [[gold-transforms]] — Scoring, aggregation, analytics
- [[daily-signal-scores]] — Momentum, value, sentiment signals
- [[quarterly-signal-scores]] — Quarterly fundamentals-based signals

## 6. Orchestration

Schedule and manage pipeline execution:

- [[linux-scheduling|cron and crontab]] — Simple scheduling for lightweight tasks
- the Airflow DAGs — Airflow DAGs for complex pipelines
- [[docker-compose]] — Container orchestration for Airflow workers

## 7. Monitoring and Observability

Ensure the pipeline is healthy and performing:

- [[datadog-apm-traces]] — Trace pipeline execution with ddtrace
- [[datadog-dashboards]] — Pipeline Watch and DBA dashboards
- [[wait-stats-analysis]] — SQL Server performance monitoring
- [[cloud-logging]] — GCP log analysis

## 8. Operations and Recovery

Keep the system running day-to-day:

- [[backup-types-and-strategy]] — SQL Server backup strategy
- the pause and resume runbook — Cost-saving infrastructure shutdowns
- the destroy and rebuild runbook — Full rebuild from Terraform
- [[deadlock-detection-and-prevention]] — Handling concurrency issues
