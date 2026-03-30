---
title: "MOC: dbt"
tags:
  - moc
  - dbt
  - sql
  - transformation
---

# MOC: dbt

dbt is the transformation layer in an ELT stack, compiling Jinja-templated SQL into executable queries against the warehouse. These notes cover the full lifecycle of a dbt project for financial data pipelines: from core concepts and project structure through modeling craft, data quality enforcement, adapter configuration, and production operations.

## Core dbt — Concepts, Project Layout, and CLI

What dbt is, how it compiles SQL, the DAG, project organisation, naming conventions, and the full CLI reference.

* [[dbt-core-concepts]] — what dbt is and is not, dbt Core vs dbt Cloud trade-offs, the compilation architecture (Jinja to SQL to warehouse), the DAG built from ref() calls, profiles, adapters, and packages

* [[dbt-project-structure]] — directory tree layout for a financial data platform, naming conventions (stg/int/fct/dim prefixes), config inheritance in dbt_project.yml, source declarations, multi-adapter dispatch, and the medallion architecture mapping

* [[dbt-cli-reference]] — every dbt command (run, test, build, compile, debug, deps, seed, snapshot, docs, source freshness, ls, clean, retry), node selection syntax, graph operators, flags, and output interpretation

* [[dbt-cheat-sheet]] — condensed quick-reference for CLI anatomy, global flags, command flags, and the most-used selection patterns

## Modeling Craft — Staging, Intermediate, Marts, and Materializations

How to structure the transformation DAG layer by layer: staging for rename-and-cast, intermediate for business logic, marts for consumption, and choosing the right materialization for each.

* [[dbt-staging-models]] — 1:1 mapping to source tables, rename-and-cast only, view materialization, source freshness checks, the stg_source__entity naming convention, and _sources.yml declaration patterns

* [[dbt-intermediate-models]] — business logic transforms in the silver layer, joining and enriching staging data, the int_verb_entity naming convention, materialization strategy (view vs table vs ephemeral), and keeping models single-concept

* [[dbt-mart-models]] — consumption-ready fact and dimension tables in the gold layer, grain definition, fct/dim naming, table or incremental materialization, full column documentation, and exposure registration for lineage

* [[dbt-materializations]] — deep dive into all five types (view, table, incremental, ephemeral, snapshot), when to use each, incremental strategies (append, merge, delete+insert), and the cost/freshness trade-offs of each choice

## Quality and Contracts — Testing, Data Contracts, and Expectations

Enforcing data quality at build time: schema tests, dbt-utils, dbt-expectations, singular tests, custom generics, and compile-time contract enforcement.

* [[dbt-testing-framework]] — the four test categories (built-in generic, dbt-utils, dbt-expectations, singular SQL), YAML test declarations, store_failures for debugging, severity levels, custom generic test macros, and testing strategies for financial data

* [[dbt-data-contracts-implementation]] — enabling contract enforcement on mart models, column-level data_type declarations, model access levels (public/protected/private), model versioning for breaking changes, and how contracts turn YAML schemas into active guardrails

## Advanced dbt — Macros, Packages, Snapshots, and Adapters

Extending dbt with Jinja macros, community packages, SCD Type 2 snapshots, and adapter-specific configuration for BigQuery and SQL Server.

* [[dbt-macros-and-jinja]] — Jinja2 delimiters and filters, variables with var(), control flow, writing reusable macros, the dispatch pattern for cross-adapter SQL, pre/post hooks, and common anti-patterns

* [[dbt-packages]] — packages.yml and dbt deps, dbt-utils (surrogate_key, pivot, unpivot), dbt-expectations for statistical tests, elementary for anomaly detection, codegen and audit_helper, and writing custom packages

* [[dbt-snapshots-and-scd]] — SCD Type 2 implementation with timestamp and check strategies, generated metadata columns (dbt_valid_from/to), point-in-time queries, ESG audit trails, hard-delete handling, and snapshot gotchas

* [[dbt-bigquery-adapter]] — installation and profiles.yml for BigQuery, partitioning and clustering config, incremental strategies (merge, insert_overwrite), slot estimation, cost labels, and BigQuery-specific SQL patterns

* [[dbt-sqlserver-adapter]] — installation with ODBC driver prerequisites, SQL auth profiles.yml, T-SQL differences from standard SQL, incremental strategy limitations, index post-hooks, and known adapter limitations

* [[dbt-cross-adapter-patterns]] — the dispatch macro pattern for adapter-conditional SQL, target.type conditional logic, a SQL Server vs BigQuery divergence reference table, cross-adapter testing strategy, and migration guide

## Operations — CI/CD, Airflow, Observability, Performance, and Troubleshooting

Running dbt in production: CI with slim builds, Airflow orchestration patterns, monitoring with artifacts and elementary, performance diagnosis, and systematic troubleshooting.

* [[dbt-ci-cd]] — GitHub Actions CI with slim builds and state:modified+ selectors, manifest diffing against production, Workload Identity Federation, sqlfluff pre-commit hooks, and CD via Docker rebuild or Git pull

* [[dbt-airflow-integration]] — three integration patterns (BashOperator, astronomer-cosmos per-model tasks, CloudRunJobOperator), trade-offs between granularity and complexity, and a full ESG pipeline DAG example

* [[dbt-observability]] — parsing run_results.json and manifest.json, shipping custom metrics to Datadog, elementary package for anomaly detection, Slack alerting on test failures, and artifact retention in GCS

* [[dbt-performance-tuning]] — identifying slow models from run_results.json, BigQuery and SQL Server adapter-specific tuning, thread configuration, incremental strategy optimization, and model refactoring with audit_helper

* [[dbt-troubleshooting]] — systematic diagnosis of compilation errors, Jinja syntax errors, runtime failures, test failures, incremental drift, snapshot corruption, and a reference table of common errors with causes and fixes

* [[dbt-documentation-and-lineage]] — dbt docs generate and serve, exposures for downstream system lineage, static hosting on GCS, Dataplex and DataHub integration, and regulatory traceability for EU BMR compliance

## When to Use What

| Approach | Best For | Avoid When |
|----------|---------|------------|
| **dbt** | SQL transforms, testing, documentation, lineage | Complex Python logic, API calls, ML |
| **Raw SQL (stored procedures)** | Performance-critical, SQL Server-specific features (MERGE, temporal tables) | Team collaboration, testing, CI/CD |
| **Python transforms** | Non-SQL logic, API enrichment, ML feature engineering | Simple aggregations that SQL handles |
| **Stored procedures** | Legacy compatibility, complex transactions, cursor-based processing | New development, cross-warehouse portability |

For a concise code-heavy overview, see [[dbt-transformation-layer]].

## Cross-References

- [[moc-sql-server|SQL Server]] — dbt-sqlserver adapter, T-SQL tuning for dbt models
- [[moc-gcp|GCP]] — BigQuery adapter, cost optimization, slot management
- [[moc-orchestration|Orchestration]] — running dbt in Airflow DAGs
- [[moc-github-actions|GitHub Actions]] — dbt CI/CD workflows
- [[moc-docker|Docker]] — containerized dbt execution
- [[moc-observability|Observability]] — monitoring dbt runs in Datadog
- [[moc-terraform|Terraform]] — infrastructure for warehouses dbt targets
- [[moc-data-architecture|Data Architecture]] — medallion architecture, data modeling
- [[financial-domain-index]] — domain context for all dbt model examples
- [[moc-dataops|DataOps]] — DataOps practices for dbt
- [[moc-programming-languages|Programming Languages]] — Python for dbt-core and custom Python models
