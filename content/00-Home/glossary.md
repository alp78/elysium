---
type: reference
category: navigation
technology: []
tags: [reference, navigation, glossary]
aliases: [Glossary, Terms, Definitions, Terminology]
keywords: [glossary, terms, definitions, terminology, acronyms, abbreviations, data engineering, sql server, gcp, terraform, python]
description: "Centralized glossary of all technical terms, acronyms, and abbreviations used across this knowledge base — from data engineering to financial domain concepts."
related:
  - "[[Dashboard]]"
  - "[[tag-index]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Glossary

## A

### ADC (Application Default Credentials)
The default credential chain used by Google Cloud client libraries. See [[gcloud-authentication]].

### ADR (Architecture Decision Record)
A document recording a significant architectural decision, its context, and consequences.

### Airflow
the Airflow DAGs — an orchestration platform for scheduling and monitoring data pipelines as DAGs (Directed Acyclic Graphs).

### APM (Application Performance Monitoring)
Tracking application performance through traces. See [[datadog-apm-traces]].

### Artifact Registry
GCP service for storing Docker images. See [[terraform-registry-and-ci]].

## B

### bcp (Bulk Copy Program)
[[sqlcmd-connection-and-usage|Command-line tool]] for high-speed bulk data transfer between SQL Server instances.

### BigQuery
Google Cloud's serverless data warehouse. See [[dataset-and-table-management]].

### Bronze Layer
The first layer of the [[medallion-architecture]] — raw data as received from sources. See [[bronze-layer-loading]].

### Buffer Pool
SQL Server's in-memory cache for data pages. See [[memory-and-buffer-pool]].

## C

### CDC (Change Data Capture)
A pattern for capturing incremental changes to source data.

### Cloud NAT
GCP's network address translation service for outbound-only internet access. See [[terraform-networking]].

### Cloud Run
GCP serverless container platform. See [[cloud-run-jobs-vs-services]].

### Clustered Index
The physical sort order of a table. Every table should have one. See [[index-types-and-strategy]].

### Conventional Commits
A commit message convention using prefixes (feat:, fix:, refactor:). See [[git-daily-workflow]].

## D

### DAG (Directed Acyclic Graph)
Airflow's pipeline definition — a graph of tasks with dependencies. See the Airflow DAGs.

### Datadog
Monitoring platform for metrics, logs, and traces. See [[datadog-architecture-overview]].

### ddtrace
Datadog's Python tracing library for APM instrumentation. See [[datadog-apm-traces]].

### Deadlock
A circular wait where two sessions each hold a lock the other needs. See [[deadlock-detection-and-prevention]].

### DMV (Dynamic Management View)
SQL Server system views for monitoring performance. See [[essential-dba-queries]].

## E

### ELT (Extract-Load-Transform)
Load raw data first, then transform inside the warehouse. See [[etl-vs-elt]].

### ETL (Extract-Transform-Load)
Transform data before loading into the warehouse. See [[etl-vs-elt]].

### Extended Events
SQL Server's lightweight event monitoring system. See [[deadlock-detection-and-prevention]].

## F

### flock
Linux utility for preventing overlapping cron job runs. See [[linux-scheduling|cron and crontab]].

## G

### GCE (Google Compute Engine)
GCP virtual machine service. See [[vm-lifecycle]].

### GCS (Google Cloud Storage)
GCP object storage. See [[gcs-object-operations]].

### Gold Layer
The final layer of the [[medallion-architecture]] — business-ready aggregated datasets. See [[gold-transforms]].

## H

### HCL (HashiCorp Configuration Language)
Terraform's declarative configuration language. See [[hcl-syntax-basics]].

### Heap
A SQL Server table without a clustered index. Every query scans every page. See [[storage-internals]].

## I

### IAM (Identity and Access Management)
GCP's access control system. See [[service-accounts-and-iam]].

### IAP (Identity-Aware Proxy)
GCP service for secure SSH tunneling to VMs without public IPs. See [[iap-tunneling]].

### Idempotent
A pipeline that produces the same result whether run once or many times. See [[idempotent-pipeline-design]].

## M

### Medallion Architecture
Bronze/silver/gold data layering pattern. See [[medallion-architecture]].

### MERGE
T-SQL statement for upsert operations (update if exists, insert if new). See [[merge-and-upsert]].

## O

### OHLCV
Open, High, Low, Close, Volume — standard financial time-series data format.

## P

### PLE (Page Life Expectancy)
How long a data page stays in the SQL Server buffer pool. Target: >300 seconds. See [[memory-and-buffer-pool]].

### Pub/Sub
GCP's asynchronous messaging service. See [[pubsub-topics-and-subscriptions]].

### pyodbc
Python library for connecting to SQL Server via ODBC. See [[bronze-layer-loading]].

## R

### RCSI (Read Committed Snapshot Isolation)
SQL Server isolation level that eliminates reader/writer blocking. See [[server-configuration]].

### Reflog
Git's undo history — records every HEAD movement. See [[git-recovery-and-undo]].

## S

### SARGable
"Search ARGument ABLE" — queries that can use indexes effectively. See [[sargable-queries]].

### SCD Type 2 (Slowly Changing Dimensions)
Historical dimension tracking that preserves previous values. See [[silver-transforms]].

### Silver Layer
The middle layer of the [[medallion-architecture]] — cleaned and deduplicated data. See [[silver-transforms]].

### sqlcmd
SQL Server command-line query tool. See [[sqlcmd-connection-and-usage]].

## T

### TDE (Transparent Data Encryption)
SQL Server encryption at rest. See [[tde-encryption]].

### Terraform
Infrastructure as Code tool by HashiCorp. See [[hcl-syntax-basics]].

### TempDB
SQL Server's system database for temporary objects and row versioning.

## V

### VPC (Virtual Private Cloud)
Isolated network within GCP. See [[terraform-networking]].

### VPC-SC (VPC Service Controls)
GCP perimeter security for preventing data exfiltration. See [[vpc-service-controls]].

## W

### Wait Stats
SQL Server's record of why queries are waiting. See [[wait-stats-analysis]].

## Z

### Z-Score
A cross-sectional standardization metric used in [[daily-signal-scores]] and [[quarterly-signal-scores]].
