---
tags: [architecture]
type: reference
technology: []
status: stable
updated: 2026-03-23
---

# Patterns — Map of Content

Every reusable pattern in the vault, grouped by concern. Use this as a starting point when designing a new pipeline or solving a recurring problem.

## Loading Patterns

- [[bronze-layer-loading]] — Truncate-reload and MERGE patterns for landing raw data
- [[data-loading-and-export]] — BigQuery data loading (CSV, JSON, Parquet, streaming)

## Transformation Patterns

- [[silver-transforms]] — SCD Type 2, upsert, gap-fill, data cleaning
- [[gold-transforms]] — Z-score computation, composite scoring, dashboard views
- [[dbt-transformation-layer]] — SQL-first transforms with dbt: staging, intermediate, marts
- [[medallion-architecture]] — Bronze/Silver/Gold layered processing pattern

## Reliability Patterns

- [[idempotent-pipeline-design]] — DELETE-INSERT, MERGE, staging table patterns for safe re-runs
- [[migration-idempotency-backfills]] — Strangler fig, chunked backfills, schema evolution
- [[esg-data-ingestion-framework]] — Circuit breaker pattern for anomaly detection
- [[data-quality-framework]] — Quality gates per medallion layer, quarantine pattern

## Orchestration Patterns

- [[airflow-dag-patterns]] — DAG design, task dependencies, XComs, sensors
- [[linux-scheduling]] — Cron, systemd timers, flock overlap prevention
- [[gcp-scheduling]] — Cloud Scheduler, Cloud Run triggers

## API Patterns

- [[rest-api-design-and-consumption]] — Pagination, rate limiting, authentication, error handling
- [[grpc-for-data-pipelines]] — Protobuf, streaming, high-throughput internal services
- [[graphql-for-data-access]] — Flexible queries, federation, N+1 prevention
- [[api-protocols-comparison]] — Decision framework: which protocol for which use case

## Data Modeling Patterns

- [[dimensional-modeling]] — Star schema, snowflake, bridge tables, factless facts
- [[data-modeling-patterns]] — 3NF, Data Vault, OBT, Activity Schema, time-series, graph

## Quality Patterns

- [[data-quality-framework]] — Quality dimensions, anomaly detection, Airflow integration
- [[data-contracts]] — Schema + SLA + semantics agreements between producers and consumers

## Deployment Patterns

- [[github-actions-patterns]] — Matrix builds, reusable workflows, environment protection
- [[github-actions-data-engineering]] — dbt CI, Terraform automation, Docker + Cloud Run deploy

## Security Patterns

- [[service-accounts-and-iam]] — GCP IAM roles, service account design
- [[vpc-service-controls]] — VPC-SC perimeters for data exfiltration prevention
- [[secrets-management]] — Secret Manager, rotation, Workload Identity Federation

## Cost Patterns

- [[gcp-cost-monitoring-and-budgets]] — Billing export, budget alerts, anomaly detection
- [[gcp-billing-and-pricing]] — Per-service pricing reference
- [[gcp-total-cost-of-ownership]] — TCO calculations for reference architectures

## Decision Patterns

- [[golden-rules-of-data-engineering]] — 10 foundational principles
- [[technology-selection-matrices]] — Which tool for which task
- [[scenario-based-decision-guide]] — "I have this need, what do I use?"

## Related

- [[data-architecture-index]] — Full architecture section index
- [[index|Elysium]] — Vault navigation hub
- [[moc-data-pipeline-lifecycle]] — Pipeline lifecycle MoC
