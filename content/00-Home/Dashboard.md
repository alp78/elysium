---
type: index
category: navigation
technology: []
tags: [index, navigation, home]
aliases: [Home, Main Dashboard, Start Here, Index]
keywords: [dashboard, home, index, navigation, start here, overview, data engineering, knowledge base]
description: "Central dashboard and entry point for the Elysium data engineering knowledge base. Navigate to any section, browse by technology, or search."
related: []
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Elysium — Data Engineering Knowledge Base

Welcome to Elysium, a structured knowledge base for practicing data engineers covering SQL Server, Google Cloud Platform, Python, Terraform, Docker, Git, Airflow, Datadog, data architecture, financial domain knowledge, and AI-assisted engineering.

## Start Here

- [[five-pillars-of-data-engineering]] — The mindset framework behind this vault
- [[tag-index]] — Browse by technology, pattern, or type
- [[glossary]] — Look up any term

---

## Sections

### Core Tools and Languages

| # | Section | Description | Index |
|---|---------|-------------|-------|
| 01 | **Shell** | Text processing (grep/awk/sed), file ops, scripting, processes, networking | [[shell-index]] |
| 02 | **Programming Languages** | Python and C# paired references (16 topics), comparison tables | [[programming-languages-index]] |
| 03 | **SQL Server** | Administration, T-SQL, storage, performance, concurrency, security, HA | [[sql-server-index]] |
| 04 | **DB Queries** | SQL Server, BigQuery, Firestore — executable query reference with outputs | [[db-queries-index]] |

### Cloud Platform and Infrastructure

| # | Section | Description | Index |
|---|---------|-------------|-------|
| 05 | **GCP** | Compute, BigQuery, Firestore, Storage, Pub/Sub, Cloud Run, IAM, Cost Management | [[gcp-index]] |
| 06 | **Terraform** | HCL, state, GCP resources, patterns, block library | [[terraform-index]] |
| 07 | **Docker** | Container lifecycle, Compose, image management | [[docker-index]] |

### Development Workflow

| # | Section | Description | Index |
|---|---------|-------------|-------|
| 08 | **Git** | Version control, branching, merging, PRs, troubleshooting | [[git-index]] |
| 09 | **GitHub Actions** | CI/CD workflows, deployment patterns, data engineering automation | [[github-actions-index]] |

### Data Pipeline

| # | Section | Description | Index |
|---|---------|-------------|-------|
| 10 | **dbt** | SQL transformation layer: modeling, testing, CI/CD, adapters | [[dbt-index]] |
| 11 | **Orchestration** | Airflow, Linux/Windows/GCP scheduling | [[orchestration-index]] |
| 12 | **Observability** | Datadog, GCP-native monitoring, data lineage, pipeline health | [[observability-index]] |
| 13 | **Data Architecture** | Architectures, data modeling, pipeline patterns, APIs, decision frameworks | [[data-architecture-index]] |

### Operations

| # | Section | Description | Index |
|---|---------|-------------|-------|
| 14 | **Runbooks** | On-call guide, incident response, 10 operational runbooks | [[runbooks-index]] |

### Domain and Practice

| # | Section | Description | Index |
|---|---------|-------------|-------|
| 15 | **Engineering Practice** | Leadership, DataOps, data team organization, self-service platforms | [[engineering-practice-index]] |
| 16 | **AI and Prompts** | Prompt engineering, model-specific patterns, LLM pipelines | [[ai-and-prompts-index]] |
| 17 | **Financial Domain** | Metrics, scoring, financial encyclopedia, market analysis | [[financial-domain-index]] |

---

## Start Here

- [[common-tasks]] — "How do I...?" quick routing guide
- [[on-call-guide]] — On-call first responder guide
- [[golden-rules-of-data-engineering]] — Decision-making principles

## Quick Access — Cheat Sheets

- [[gcloud-cheat-sheet]] | [[sql-server-cheat-sheet]] | [[terraform-cheat-sheet]] | [[docker-cheat-sheet]] | [[git-cheat-sheet]] | [[dbt-cheat-sheet]]

---

## Maps of Content

- [[moc-data-pipeline-lifecycle]] — Ingestion → transformation → orchestration → monitoring
- [[moc-infrastructure-as-code]] — Terraform + GCP + CI/CD woven together
- [[moc-patterns]] — Every reusable pattern in the vault, grouped by concern
- [[adr-index]] — Architecture Decision Records

---

## Quick Access

> The Dataview queries below work in Obsidian with the Dataview plugin. On the Quartz site, use the static tables.

### Runbooks

See [[runbooks-index]] for the complete list. Key runbooks:

| Runbook | Severity | Trigger |
|---------|----------|---------|
| [[index-calculation-failure]] | Sev1 | Pipeline fails before publication |
| [[esg-circuit-breaker-fired]] | Sev2 | ESG quality gate halts publication |
| [[sql-server-disk-full]] | Sev1 | VM disk at >95% |
| [[data-restatement-procedure]] | Sev1 | Published values need correction |
| [[on-call-guide]] | — | First-responder guide |

### How-To Guides

| Guide | Description |
|-------|-------------|
| [[common-tasks]] | Task-oriented routing to detailed notes |
| [[secrets-management]] | GCP Secret Manager, rotation, Airflow integration |
| [[scenario-based-decision-guide]] | "I need to X — use this" |

### Architecture Decisions

See [[adr-index]] for all ADRs.

### Troubleshooting

| Note | Technology |
|------|-----------|
| [[datadog-troubleshooting]] | Datadog agent and APM |
| [[airflow-troubleshooting]] | Airflow scheduler and DAGs |
| [[troubleshooting-flowcharts]] | SQL Server diagnostic flowcharts |

---

## Vault Info

