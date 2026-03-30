---
type: concept
category: gcp
technology: [gcp, gcloud]
tags: [infrastructure, api, gcp, gcloud]
aliases: [GCP projects, GCP APIs, gcloud services, enable API, project listing]
keywords: [gcp projects, project list, gcloud projects list, enable API, gcloud services enable, bigquery API, cloud run API, pubsub API, compute API, service activation, API enablement, data engineering APIs]
description: "How to list GCP projects, inspect project metadata, and enable or verify the APIs required for data engineering workloads including BigQuery, Cloud Run, Pub/Sub, and Compute Engine."
related: [gcloud-authentication, gcloud-configurations, gcloud-output-formatting, dataset-and-table-management, cloud-run-jobs-vs-services]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# GCP Projects and APIs

GCP projects are the fundamental organizational unit for resources, billing, and access control. Every resource — VMs, BigQuery datasets, Cloud Run jobs, GCS buckets — lives inside a project. APIs must be explicitly enabled per project before the corresponding services can be used; an `API not enabled` error is always the result of a missing `gcloud services enable` call.

### Why GCP Projects and APIs Matter

A common failure mode when setting up a new GCP project is running `gcloud run jobs execute` or `bq query` only to receive an error that the API is disabled. Knowing which APIs to enable upfront — and how to verify what is currently enabled — eliminates this class of errors. Projects also serve as the billing boundary and the IAM scope for [[service-accounts-and-iam|service account]] permissions.

### Listing and Describing GCP Projects

```bash
# List all projects you have access to
gcloud projects list
# Shows: PROJECT_ID, NAME, PROJECT_NUMBER

# Describe a project (metadata, labels, lifecycle state)
gcloud projects describe data-platform-prod
```

### Listing and Enabling GCP APIs

```bash
# List enabled APIs (what services are activated?)
gcloud services list --enabled
# Shows: NAME, TITLE
# If an API is not enabled, gcloud commands for that service return errors
# You MUST enable APIs before using them

# Enable an API
gcloud services enable bigquery.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable pubsub.googleapis.com
gcloud services enable compute.googleapis.com
# Enable multiple at once:
gcloud services enable bigquery.googleapis.com run.googleapis.com pubsub.googleapis.com
```

### Common GCP APIs for Data Engineering

| API | Service |
|---|---|
| `bigquery.googleapis.com` | BigQuery |
| `run.googleapis.com` | Cloud Run |
| `pubsub.googleapis.com` | Pub/Sub |
| `compute.googleapis.com` | Compute Engine |
| `storage.googleapis.com` | Cloud Storage (usually enabled by default) |
| `logging.googleapis.com` | Cloud Logging |
| `monitoring.googleapis.com` | Cloud Monitoring |
| `secretmanager.googleapis.com` | Secret Manager |
| `artifactregistry.googleapis.com` | Artifact Registry (Docker images) |

> [!tip] Enable All APIs at Once
>
> Enable All Data Engineering APIs at Once.
> When bootstrapping a new project, enable all required APIs in one command to avoid hitting disabled-API errors one by one during setup:
> ```bash
> gcloud services enable \
>   bigquery.googleapis.com \
>   run.googleapis.com \
>   pubsub.googleapis.com \
>   compute.googleapis.com \
>   storage.googleapis.com \
>   logging.googleapis.com \
>   monitoring.googleapis.com \
>   secretmanager.googleapis.com \
>   artifactregistry.googleapis.com
> ```

> [!warning] APIs Are Per-Project
>
> Enabling an API in your dev project does not enable it in prod. Every project must have APIs enabled independently. When setting up a new environment (dev → staging → prod), API enablement must be repeated — or automated with [Terraform](/07-Terraform/moc-terraform).

### GCP API Lifecycle States

A project's `lifecycleState` field (visible in `gcloud projects describe`) indicates whether the project is `ACTIVE`, `DELETE_REQUESTED`, or `DELETE_IN_PROGRESS`. Deleting a project is a 30-day soft delete — resources are retained but inaccessible, and the project can be restored within that window.

## Related

- [gcloud-authentication](/06-GCP/Core/gcloud-authentication) — Authentication must be established before project and API commands work
- [[gcloud-configurations]] — Use named configurations to target the right project automatically
- [[gcloud-output-formatting]] — Use `--format` and `--filter` to extract project IDs into scripts
- [[service-accounts-and-iam]] — Service accounts live within projects; IAM bindings are project-scoped
- [[dataset-and-table-management]] — Requires `bigquery.googleapis.com` to be enabled
- [[cloud-run-jobs-vs-services]] — Requires `run.googleapis.com` to be enabled

## References

- [GCP Services list](https://cloud.google.com/terms/services)
- [API enablement documentation](https://cloud.google.com/service-usage/docs/enable-disable)
