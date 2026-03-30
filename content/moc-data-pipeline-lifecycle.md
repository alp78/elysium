---
title: "MOC: Data Pipeline Lifecycle"
tags:
  - moc
  - pipeline
  - architecture
---

# MOC: Data Pipeline Lifecycle

This map traces a data pipeline end-to-end, from raw data ingestion to monitoring in production. Follow the links to dive deep into any stage.

## Design and Architecture

Before writing code, establish the foundational patterns:

- [[five-pillars-of-data-engineering]] — Reliability, observability, efficiency, security, operability
- [[golden-rules-of-data-engineering]] — 10 foundational principles for every design decision
- [[medallion-architecture]] — Bronze/silver/gold layer design
- [[functional-pipeline-architecture]] — Functional core/imperative shell, contract validation, quality gates, data provenance
- [[data-flow-architecture]] — Complete data movement topology: every source-destination pair, transfer methods, format selection
- [[idempotent-pipeline-design]] — Safe re-runs and backfills

## Infrastructure Provisioning

Set up the compute, storage, and networking:

- [[hcl-syntax-basics]] — Terraform language fundamentals
- [[terraform-plan-apply-destroy]] — Provisioning workflow
- [[terraform-networking]] — VPC, firewall, NAT
- [[terraform-compute]] — VM instances for SQL Server and Airflow
- [[terraform-cloud-run]] — Serverless containers for dashboards
- [[environment-management-strategy]] — Dev/staging/prod topology, tool-by-tool environment separation, promotion workflow

## Data Ingestion (Bronze Layer)

Extract raw data from sources and land it in the bronze layer:

- [[bronze-layer-loading]] — JSON to bronze tables
- [[serialization-formats]] — JSON/CSV/Parquet/Avro format selection for ingestion
- [[data-contracts]] — Schema + SLA agreements between producers and consumers
- [[rest-api-design-and-consumption]] — Consuming REST APIs: authentication, pagination, rate limiting

## Data Transformation (Silver Layer)

Clean, deduplicate, and enrich data:

- [[silver-transforms]] — Deduplication, SCD Type 2, data cleaning
- [[merge-and-upsert]] — T-SQL MERGE patterns
- [[dbt-transformation-layer]] — SQL-first transforms with dbt
- [[sargable-queries]] — Writing queries that use indexes effectively

## Analytics and Aggregation (Gold Layer)

Produce business-ready datasets:

- [[gold-transforms]] — Scoring, aggregation, analytics
- [[daily-signal-scores]] — Momentum, value, sentiment signals
- [[quarterly-signal-scores]] — Quarterly fundamentals-based signals

## Orchestration

Schedule and manage pipeline execution:

- [[linux-scheduling|cron and crontab]] — Simple scheduling for lightweight tasks
- [[airflow-dag-patterns]] — Airflow DAGs for complex pipelines
- [[docker-compose]] — Container orchestration for Airflow workers

## Quality and Reliability

Ensure the pipeline produces correct data and recovers from failures:

- [[data-quality-framework]] — Six quality dimensions, quality gates per medallion layer, quarantine pattern
- [[data-pipeline-testing-strategy]] — Testing pyramid: unit, integration, contract, quality, regression
- [[error-handling-and-retry-patterns]] — Error classification, retry strategies, circuit breaker, dead letter queue
- [[migration-idempotency-backfills]] — Migration strategies, backfill chunking, schema evolution

## Monitoring and Observability

Ensure the pipeline is healthy and performing:

- [[datadog-apm-traces]] — Trace pipeline execution with ddtrace
- [[datadog-dashboards]] — Pipeline Watch and DBA dashboards
- [[wait-stats-analysis]] — SQL Server performance monitoring
- [[cloud-logging]] — GCP log analysis

## Operations and Recovery

Keep the system running day-to-day:

- [[backup-types-and-strategy]] — SQL Server backup strategy
- [[deadlock-detection-and-prevention]] — Handling concurrency issues
