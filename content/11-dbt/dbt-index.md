---
tags: [pipeline, sql, airflow, dbt, bigquery, github-actions]
type: index
technology: [dbt, sql-server, bigquery, airflow, github-actions]
status: stable
updated: 2026-03-23
---

# dbt — SQL Transformation Layer

dbt (data build tool) is the transformation layer in the ELT pipeline. It does not extract or load — it transforms data already in the warehouse using SQL, adding software engineering practices (version control, testing, documentation, CI/CD) to SQL-based analytics. In this stack, dbt targets both SQL Server (via dbt-sqlserver adapter) and BigQuery (via dbt-bigquery adapter), orchestrated by Airflow, tested in GitHub Actions CI, and monitored via Datadog.

For a concise code-heavy overview, see [[dbt-transformation-layer]]. This section expands on every aspect of dbt for the financial index and ESG data platform.

### dbt Foundations

| Note | Description |
|------|-------------|
| [[dbt-core-concepts]] | What dbt is, compilation architecture, DAG, materializations, profiles, packages |
| [[dbt-project-structure]] | Project layout, naming conventions, config inheritance, multi-adapter setup |
| [[dbt-cli-reference]] | CLI commands, node selection syntax, flags, output interpretation |

### dbt Modeling

| Note | Description |
|------|-------------|
| [[dbt-staging-models]] | 1:1 with source, rename/cast only, source freshness checks |
| [[dbt-intermediate-models]] | Business logic, joins, window functions — the silver layer |
| [[dbt-mart-models]] | Consumption-ready facts and dimensions — the gold layer |
| [[dbt-materializations]] | View, table, incremental, ephemeral, snapshot — deep dive and decision matrix |

### dbt Quality

| Note | Description |
|------|-------------|
| [[dbt-testing-framework]] | Schema tests, dbt-utils, dbt-expectations, custom tests, store-failures |
| [[dbt-data-contracts-implementation]] | Model contracts, access levels, versioning, breaking change detection |

### dbt Advanced Topics

| Note | Description |
|------|-------------|
| [[dbt-macros-and-jinja]] | Jinja2 for dbt, writing macros, dispatch, hooks, domain-specific macros |
| [[dbt-packages]] | dbt-utils, dbt-expectations, elementary, dbt-codegen, dbt-audit-helper |
| [[dbt-snapshots-and-scd]] | SCD Type 2 via snapshots, timestamp vs check strategy, PIT queries |

### dbt Adapters

| Note | Description |
|------|-------------|
| [[dbt-sqlserver-adapter]] | SQL Server adapter config, T-SQL differences, post-hook indexes, limitations |
| [[dbt-bigquery-adapter]] | BigQuery adapter config, partitioning, clustering, cost control, slot estimation |
| [[dbt-cross-adapter-patterns]] | Dispatch macros for cross-adapter SQL, migration guide |

### dbt Operations

| Note | Description |
|------|-------------|
| [[dbt-airflow-integration]] | BashOperator vs Cosmos vs CloudRunJob, DAG examples, variable passing |
| [[dbt-ci-cd]] | GitHub Actions CI/CD, slim builds, manifest management, pre-commit hooks |
| [[dbt-documentation-and-lineage]] | dbt docs, exposures, catalog integration, regulatory traceability |
| [[dbt-observability]] | Datadog metrics, elementary package, artifact parsing, alerting |
| [[dbt-performance-tuning]] | Identifying slow models, adapter-specific tuning, thread optimization |
| [[dbt-troubleshooting]] | Compilation errors, runtime errors, test failures, common error table |

### dbt Reference

| Note | Description |
|------|-------------|
| [[dbt-cheat-sheet]] | CLI commands, Jinja syntax, materialization config, test declarations |

### dbt Key Concepts

1. [[dbt-core-concepts]] — Start here: what dbt is, how it compiles, the DAG
2. [[dbt-project-structure]] — How to organize a dbt project for the financial data platform
3. [[dbt-materializations]] — When to use view, table, incremental, snapshot
4. [[dbt-testing-framework]] — Testing strategy for data quality
5. [[dbt-airflow-integration]] — Running dbt in production via Airflow

### dbt When to Use What

| Approach | Best For | Avoid When |
|----------|---------|------------|
| **dbt** | SQL transforms, testing, documentation, lineage | Complex Python logic, API calls, ML |
| **Raw SQL (stored procedures)** | Performance-critical, SQL Server-specific features (MERGE, temporal tables) | Team collaboration, testing, CI/CD |
| **Python transforms** | Non-SQL logic, API enrichment, ML feature engineering | Simple aggregations that SQL handles |
| **Stored procedures** | Legacy compatibility, complex transactions, cursor-based processing | New development, cross-warehouse portability |

## Cross-References

- [[sql-server-index]] — dbt-sqlserver adapter, T-SQL tuning for dbt models
- [[gcp-index]] — BigQuery adapter, cost optimization, slot management
- [[orchestration-index]] — Running dbt in Airflow DAGs
- [[github-actions-index]] — dbt CI/CD workflows
- [[docker-index]] — Containerized dbt execution
- [[observability-index]] — Monitoring dbt runs in Datadog
- [[terraform-index]] — Infrastructure for warehouses dbt targets
- [[data-architecture-index]] — Medallion architecture, data modeling
- [[financial-domain-index]] — Domain context for all dbt model examples
- [[engineering-practice-index]] — DataOps practices for dbt
- [[programming-languages-index]] — Python for dbt-core and custom Python models
