---
type: index
category: gcp
technology: [gcp]
tags: [infrastructure, gcp]
aliases: [GCP Index, Google Cloud Platform, GCP Overview]
keywords: [gcp, google cloud platform, cloud services, gcloud, compute engine, bigquery, pub/sub, cloud run, gcs, iam, logging, monitoring, firestore, nosql, real-time]
description: "Central navigation hub for all Google Cloud Platform notes covering gcloud CLI, Compute Engine, BigQuery, Firestore, Pub/Sub, Cloud Run, Cloud Storage, IAM, and Cloud Logging."
related: [gcloud-authentication, vm-lifecycle, dataset-and-table-management, cloud-run-jobs-vs-services, gcs-object-operations, service-accounts-and-iam, cloud-logging]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Google Cloud Platform (GCP)

This section covers every GCP service used in daily data engineering work: the gcloud CLI, Compute Engine VMs, BigQuery, Firestore, Pub/Sub messaging, Cloud Run serverless containers, Cloud Storage, IAM security, and Cloud Logging/Monitoring. Each note is an atomic, searchable reference covering one concept or procedure.

### Core — gcloud CLI

The gcloud CLI is the single binary that talks to every GCP API. These notes cover authentication, project management, output formatting, and API enablement.

- [[gcloud-authentication]] — OAuth2 login, Application Default Credentials (ADC), service account auth, credential search order
- [[gcloud-configurations]] — Named configuration sets for multi-project workflows (dev/staging/prod)
- [[gcloud-output-formatting]] — `--format`, `--filter`, value/table/CSV/JSON extraction, server-side filtering
- [[gcp-projects-and-apis]] — Project management, API enablement, common data engineering APIs

### Compute — Virtual Machines

Compute Engine VMs host self-managed services like SQL Server and Airflow. These notes cover the full VM lifecycle.

- [[vm-lifecycle]] — Start, stop, reset, resize, machine type families, right-sizing strategies
- [[vm-ssh-and-file-transfer]] — SSH via IAP tunnel, remote commands, SCP file transfer, permission gotchas
- [[disks-and-snapshots]] — Disk management, snapshot creation/restore, disk resizing, serial console debugging

### BigQuery — Serverless Data Warehouse

BigQuery scans petabytes in seconds at $5/TB. These notes cover table management, cost-optimized querying, data loading, and job management.

- [[dataset-and-table-management]] — Datasets, tables, schemas, partitioning, clustering, deletion
- [[querying-and-cost-optimization]] — Ad-hoc queries, dry runs, destination tables, cost optimization, time travel
- [[data-loading-and-export]] — CSV/Parquet/JSON loading from GCS, Hive partitioning, export with compression
- [[job-management]] — Job listing, inspection, cancellation

### Serverless — Cloud Run and Pub/Sub

Cloud Run runs Docker containers without server management. Pub/Sub decouples pipeline stages with asynchronous messaging.

- [[cloud-run-jobs-vs-services]] — Jobs (batch/ETL) vs Services (HTTP), comparison table, execution, configuration
- [[pubsub-topics-and-subscriptions]] — Topic/subscription creation, pull vs push, ack deadlines, dead letter queues
- [[pubsub-messaging]] — Publishing messages with attributes, pulling, backlog monitoring, ordering guarantees

### Firestore — Real-Time NoSQL Database

Firestore is a serverless document database for real-time state management, configuration stores, and event-driven pipeline patterns.

- [[firestore-data-model-and-operations]] — Data model, CRUD, queries, real-time listeners, Terraform provisioning, performance limits
- [[real-time-nosql-pipelines]] — Architecture patterns: pipeline state store, config-driven pipelines, Firestore triggers, CDC, Pub/Sub+Dataflow streaming

### Storage — Cloud Storage (GCS)

GCS is the connective tissue of every GCP data pipeline: raw data landing zone, intermediate storage, backups, and export staging.

- [[gcs-object-operations]] — Copy, sync, move, delete, metadata inspection, parallel transfers
- [[gcs-buckets-and-lifecycle]] — Bucket creation, storage classes, lifecycle rules, versioning, cost trade-offs

### Security — IAM and Service Accounts

IAM controls who can do what in GCP. These notes cover service account management, role bindings, and data exfiltration prevention.

- [[service-accounts-and-iam]] — Creating service accounts, key management, IAM bindings, roles, Workload Identity
- [[vpc-service-controls]] — Data exfiltration prevention, perimeter setup, ingress/egress policies, debugging denials
- [[secrets-management]] — GCP Secret Manager, Airflow integration, rotation procedures, Workload Identity Federation

### Logging — Cloud Logging and Monitoring

Observability tools for debugging pipeline failures and capacity planning.

- [[cloud-logging]] — Filter language, severity levels, time ranges, text search, resource filtering, log tailing
- [[cloud-monitoring-metrics]] — Metric types, CPU/disk/network monitoring, useful data engineering metrics, alerting
- [[bigquery-problems]] — BigQuery error scenarios and solutions

### Cost Management — FinOps

Understanding and controlling GCP costs across every service. Essential reading before provisioning any production infrastructure.

- [[gcp-billing-and-pricing]] — How every GCP service is billed: pricing models, billing units, free tiers, cost formulas, discount tiers (SUD, CUD, Spot), master pricing summary table
- [[gcp-cost-monitoring-and-budgets]] — Billing export to BigQuery, budget alerts with auto-shutdown, anomaly detection, optimization strategies per service, weekly review checklist, cost dashboard SQL
- [[gcp-total-cost-of-ownership]] — 4 reference architectures with precise cost breakdowns: small batch ($7/mo), SQL Server + Airflow ($222/mo), production ($898/mo), enterprise ($7,183/mo), GCP vs AWS vs Azure comparison, hidden costs checklist

See also: [[gcloud-cheat-sheet]]

### Key Concepts for GCP Data Engineering

Start with these if you are new to GCP data engineering:

1. [[gcloud-authentication]] — Understand the two types of credentials before anything else
2. [[gcloud-configurations]] — Set up named configs for each project environment
3. [[service-accounts-and-iam]] — Every pipeline needs a properly scoped service account
4. [[querying-and-cost-optimization]] — The single most impactful cost control in GCP
5. [[vpc-service-controls]] — Non-negotiable for financial or sensitive data

## Cross-References

- [[terraform-index|Terraform]] — Infrastructure-as-code for all GCP resources (see [[terraform-networking]], [[terraform-compute]])
- [[orchestration-index|Orchestration]] — Airflow DAGs that trigger Cloud Run jobs and query BigQuery
- [[sql-server-index|SQL Server]] — SQL Server on Compute Engine VMs, backup to GCS
- [[observability-index|Observability]] — Datadog monitoring, dashboards, and alerting

### dbt
- [[dbt-bigquery-adapter]] — BigQuery adapter configuration and cost optimization
