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
| 07 | **Git** | Version control, branching, merging, PRs, troubleshooting | [[git-index]] |
| 08 | **Docker** | Container lifecycle, Compose, image management | [[docker-index]] |
| 09 | **GitHub Actions** | CI/CD workflows, deployment patterns, data engineering automation | [[github-actions-index]] |

### Pipeline Operations

| # | Section | Description | Index |
|---|---------|-------------|-------|
| 10 | **Orchestration** | Airflow, Linux/Windows/GCP scheduling | [[orchestration-index]] |
| 11 | **Observability** | Datadog, GCP-native monitoring, data lineage, pipeline health | [[observability-index]] |
| 12 | **Data Architecture** | Architectures, data modeling, pipeline patterns, APIs, decision frameworks | [[data-architecture-index]] |

### Domain and Practice

| # | Section | Description | Index |
|---|---------|-------------|-------|
| 13 | **Financial Domain** | Metrics, scoring, financial encyclopedia, market analysis | [[financial-domain-index]] |
| 14 | **AI and Prompts** | Prompt engineering, model-specific patterns, LLM pipelines | [[ai-and-prompts-index]] |
| 15 | **Engineering Practice** | Leadership, DataOps, data team organization, self-service platforms | [[engineering-practice-index]] |

---

## Quick Access — Cheat Sheets

- [[gcloud-cheat-sheet]] | [[sql-server-cheat-sheet]] | [[terraform-cheat-sheet]] | [[docker-cheat-sheet]] | [[git-cheat-sheet]]

---

## Maps of Content

- [[moc-data-pipeline-lifecycle]] — Ingestion → transformation → orchestration → monitoring
- [[moc-infrastructure-as-code]] — Terraform + GCP + CI/CD woven together

---

## Dynamic Queries (Dataview)

### Notes Needing Review

```dataview
TABLE technology, type, updated
FROM ""
WHERE contains(tags, "#needs-review")
SORT updated DESC
```

### Recent How-To Guides

```dataview
TABLE technology, description
FROM ""
WHERE type = "how-to"
SORT updated DESC
LIMIT 10
```

### All Runbooks

```dataview
TABLE technology, severity, description
FROM ""
WHERE type = "runbook"
SORT severity DESC
```

### All Troubleshooting Notes

```dataview
TABLE technology, description
FROM ""
WHERE type = "troubleshooting"
SORT updated DESC
```

---

## Vault Info

