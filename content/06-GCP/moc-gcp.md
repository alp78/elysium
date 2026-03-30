---
title: "MOC: GCP"
tags:
  - moc
  - gcp
  - google-cloud
  - cloud
---

# MOC: GCP

This map covers the full GCP stack for data engineering: CLI foundations, data services (BigQuery, GCS, Firestore), compute and serverless runtimes, security and identity, and cost governance. Pages are ordered as a reading path within each domain, starting from foundational concepts and progressing toward operational depth.

## Core CLI and Project Setup — gcloud Foundations

The gcloud CLI is the control plane for everything in GCP. Start here to understand authentication, project switching, and output formatting before working with any individual service.

* [[gcloud-authentication]] — OAuth2 login flows, Application Default Credentials vs gcloud auth, service account activation, and the credential search order that client libraries follow

* [[gcloud-configurations]] — named configurations for multi-project switching (dev/staging/prod), setting default region and zone, and avoiding accidental production changes

* [[gcp-projects-and-apis]] — project listing and metadata, enabling required APIs (BigQuery, Cloud Run, Pub/Sub, Compute), and the API-not-enabled error pattern

* [[gcloud-output-formatting]] — --format and --filter flags for scriptable output (table, JSON, CSV, value), server-side filtering, field projection, and service account impersonation for permission testing

* [[gcloud-cheat-sheet]] — exhaustive single-page CLI reference for gcloud, bq, and gcloud storage commands across all GCP services

## Data Services — BigQuery, Cloud Storage, and Firestore

The analytical warehouse (BigQuery), object storage layer (GCS), and document store (Firestore) form the data backbone. BigQuery pages cover the full lifecycle from schema creation through cost-aware querying to production troubleshooting.

* [[dataset-and-table-management]] — creating datasets and tables with bq CLI, schema inspection, partitioning strategies, clustering columns, views, materialized views, and the decisions that cannot be changed after creation

* [[data-loading-and-export]] — loading CSV, Parquet, Avro, and JSON from GCS into BigQuery, hive-partitioned directory layouts, exporting tables back to GCS, and time travel for recovering corrupted data

* [[querying-and-cost-optimization]] — running queries with bq, dry runs for cost estimation, partition pruning, columnar scanning costs, parameterized queries, destination tables, caching behavior, and INFORMATION_SCHEMA for cost auditing

* [[job-management]] — listing, inspecting, and canceling BigQuery jobs, reading bytes processed and error details, and using job history as a cost and audit trail

* [[bigquery-problems]] — 25 production problems ranked by severity including full-table scan cost explosions, DML concurrency limits, FLOAT64 precision loss, partition pruning failures, schema evolution breaks, and silent materialized view staleness

* [[gcs-buckets-and-lifecycle]] — creating buckets with storage classes (Standard/Nearline/Coldline/Archive), lifecycle rules for automatic cost-tiering, versioning, uniform bucket-level access, and data residency controls

* [[gcs-object-operations]] — listing, copying, syncing, moving, and deleting GCS objects with gcloud storage, parallel composite uploads for large files, incremental rsync patterns, and the irreversibility of recursive delete without versioning

* [[firestore-data-model-and-operations]] — Native mode vs Datastore mode, document/collection/subcollection model, Python SDK CRUD and queries, real-time listeners, batch writes, transactions, composite indexes, and the Firestore vs BigQuery vs Bigtable decision matrix

* [[real-time-nosql-pipelines]] — event-driven pipeline patterns with Firestore triggers, change data capture via Cloud Functions and Eventarc, Pub/Sub and Dataflow streaming integration, pipeline state stores, config-driven behavior, and batch vs real-time decision framework

## Compute and Serverless — VMs, Cloud Run, and Pub/Sub

Stateful VMs for self-managed workloads (SQL Server, Airflow) and serverless containers (Cloud Run) for ephemeral pipeline stages. Pub/Sub provides the asynchronous messaging layer that decouples producers from consumers.

* [[vm-lifecycle]] — listing and describing VMs, start/stop/reset operations, machine type resizing, scheduled start/stop windows for cost savings, and right-sizing using monitoring data

* [[vm-ssh-and-file-transfer]] — SSH through IAP tunnel without public IPs, running remote commands non-interactively, secure file copy with gcloud compute scp, and permission troubleshooting

* [[disks-and-snapshots]] — persistent disk management, incremental snapshots as an undo button before risky changes, disk resizing with filesystem expansion, snapshot restoration, and serial console for unbootable VMs

* [[cloud-run-jobs-vs-services]] — Jobs (batch ETL, run-to-completion) vs Services (HTTP endpoints), executing and updating jobs, memory and CPU configuration, timeout and retry settings, cold start mitigation, and multi-stage Docker builds for smaller images

* [[pubsub-topics-and-subscriptions]] — creating topics and subscriptions, pull vs push delivery models, acknowledgement deadlines, message retention, dead letter queues for poison messages, and the decoupling pattern for pipeline stages

* [[pubsub-messaging]] — publishing messages with attributes, consuming via pull with auto-ack, ordering keys for sequenced delivery, backlog monitoring for pipeline lag, at-least-once delivery semantics, and why consumers must be idempotent

## Security and Identity — IAM, Secrets, Perimeters

Every API call requires an identity with the right permissions. These pages cover the identity model, least-privilege IAM, secret storage, and network-level data exfiltration prevention.

* [[gcp-identity-and-connection-patterns]] — conceptual framework for GCP security: human vs machine identity, credential types (OAuth2, ADC, metadata server, WIF), authentication flows, trust chains, TLS certificates, KMS envelope encryption, and connection patterns across the full stack

* [[service-accounts-and-iam]] — creating service accounts, generating and rotating key files, granting minimum IAM roles for pipeline workloads (BigQuery, GCS, Cloud Run), testing permissions, removing roles, and why roles/editor is always wrong

* [[secrets-management]] — Secret Manager create/version/access lifecycle, IAM bindings for secret access, rotation patterns, accessing secrets from Terraform, Airflow, GitHub Actions, and Python, and audit logging for secret reads

* [[vpc-service-controls]] — data exfiltration threat model, creating access policies and service perimeters, ingress and egress rules, debugging VPC-SC violations (RESOURCES_NOT_IN_SAME_SERVICE_PERIMETER), and why even roles/owner cannot bypass the perimeter

## Cost and Operations — Billing, Monitoring, and Logging

Understanding what you spend and why things break. Billing export, budget alerts, TCO modeling, log queries, and metric time-series for capacity planning.

* [[gcp-billing-and-pricing]] — billing account structure, per-service pricing models (on-demand, slot-based, per-GB), free tier limits, sustained use discounts, committed use discounts, and pricing for BigQuery, Compute Engine, Cloud Run, GCS, Pub/Sub, and Firestore

* [[gcp-cost-monitoring-and-budgets]] — billing export to BigQuery, budget alert thresholds with Pub/Sub notifications, automated cost anomaly detection, right-sizing recommender, per-service optimization strategies, weekly FinOps review checklists, and Terraform budget resources

* [[gcp-total-cost-of-ownership]] — line-item TCO calculations for four reference architectures (small batch to enterprise scale), paused vs running cost comparisons, hidden costs checklist, multi-cloud cost comparisons, and realistic monthly budget planning

* [[cloud-logging]] — querying logs with gcloud logging read, filter language for severity, time range, resource type, and full-text content, real-time tailing, structured log entries, audit logs, and diagnosing 3 AM pipeline failures

* [[cloud-monitoring-metrics]] — listing metric descriptors, reading time-series data for CPU, disk, network, Cloud Run completions, Pub/Sub backlog, and BigQuery slot usage, and using historical metrics for capacity planning and right-sizing decisions
