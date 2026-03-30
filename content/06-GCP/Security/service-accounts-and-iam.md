---
type: concept
category: gcp
technology: [gcp, iam, security]
tags: [security, infrastructure, gcp, iam]
aliases: [GCP service accounts, IAM bindings, GCP IAM roles, least privilege GCP, service account keys, Workload Identity, IAM policy, gcloud iam]
keywords: [service account, IAM, identity and access management, least privilege, roles, bindings, gcloud iam service-accounts create, gcloud projects add-iam-policy-binding, roles/bigquery.dataEditor, roles/storage.objectAdmin, roles/run.invoker, key file, Workload Identity, custom roles, service account email, roles/bigquery.jobUser, test permissions, remove role]
description: "How to create GCP service accounts, generate and rotate keys, grant minimum IAM roles for data pipeline workloads, and verify permissions — implementing least-privilege access as the baseline security standard."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Service Accounts and IAM — Securing the Pipeline

> [!quote]
> "Amateurs hack systems, professionals hack people."
> — **Bruce Schneier**

Every GCP resource is protected by Identity and Access Management (IAM). Your pipeline's service account needs precisely the right permissions — too few and the pipeline fails, too many and a compromised credential becomes a security disaster. The principle of least privilege is not a nice-to-have; it is the single most important security practice in cloud engineering. Most tutorials grant `roles/editor` or `roles/owner` to service accounts — this is wrong. These roles grant access to everything in the project: compute, storage, IAM, billing, all of it.

### GCP Service Accounts — Machine Identities

Service accounts are identities for applications and pipelines, not humans. Every Cloud Run job, VM, and automated script should use a service account, not a human's credentials.

```bash
# List service accounts in the project
gcloud iam service-accounts list
# Shows: email, display name, disabled status

# Create a service account for the pipeline
gcloud iam service-accounts create data-pipeline-pipeline \
  --display-name="the data pipeline project Pipeline Service Account" \
  --description="Runs ETL jobs on Cloud Run, reads/writes SQL Server and BigQuery"

# The email follows the pattern: <name>@<project>.iam.gserviceaccount.com
# data-pipeline-pipeline@PROJECT_ID.iam.gserviceaccount.com
```

### Service Account Key Files — Local Development Only

```bash
# Generate a key file (for local development ONLY)
gcloud iam service-accounts keys create key.json \
  --iam-account=data-pipeline-pipeline@data-platform-prod.iam.gserviceaccount.com
# Delete a key (rotate keys every 90 days)
gcloud iam service-accounts keys list --iam-account=data-pipeline-pipeline@...
gcloud iam service-accounts keys delete <KEY_ID> --iam-account=data-pipeline-pipeline@...
```

> [!warning] Key Files Are Permanent Credentials
>
> A service account key file (`key.json`) does not expire and grants the same access as the service account itself. A single leak in a git commit — even one later removed from history — can result in permanent unauthorized access. In production on GCP (VMs, Cloud Run), use the metadata server for automatic credentials instead. Key files are only justified for local development against GCP APIs.

### IAM Bindings — Granting Roles to Service Accounts

For declarative, version-controlled IAM bindings, [terraform-iam-and-secrets](https://alp78.github.io/elysium/07-Terraform/GCP-Resources/terraform-iam-and-secrets) provides the Terraform equivalent of these `gcloud` commands.

> [!info] IAM Binding Parameters
>
> - `--member` identifies **who** receives the role: `serviceAccount:`, `user:`, or `group:` prefix followed by the email
> - `--role` identifies **what** they can do: a predefined or custom IAM role

```bash
# Grant a role to a service account
gcloud projects add-iam-policy-binding data-platform-prod \
  --member="serviceAccount:data-pipeline-pipeline@data-platform-prod.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataEditor"
# Minimum roles for a typical data pipeline service account:
gcloud projects add-iam-policy-binding data-platform-prod \
  --member="serviceAccount:data-pipeline-pipeline@data-platform-prod.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataEditor"        # read/write BQ tables
gcloud projects add-iam-policy-binding data-platform-prod \
  --member="serviceAccount:data-pipeline-pipeline@data-platform-prod.iam.gserviceaccount.com" \
  --role="roles/bigquery.jobUser"           # run BQ queries
gcloud projects add-iam-policy-binding data-platform-prod \
  --member="serviceAccount:data-pipeline-pipeline@data-platform-prod.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"        # read/write GCS objects
gcloud projects add-iam-policy-binding data-platform-prod \
  --member="serviceAccount:data-pipeline-pipeline@data-platform-prod.iam.gserviceaccount.com" \
  --role="roles/run.invoker"                # trigger Cloud Run jobs

# View all IAM bindings for the project
gcloud projects get-iam-policy data-platform-prod --format=yaml

# Remove a role
gcloud projects remove-iam-policy-binding data-platform-prod \
  --member="serviceAccount:data-pipeline-pipeline@data-platform-prod.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataEditor"
```

### Testing IAM Permissions

```bash
# Test permissions (does this service account have access?)
gcloud asset analyze-iam-policy \
  --organization=<org-id> \
  --identity="serviceAccount:data-pipeline-pipeline@data-platform-prod.iam.gserviceaccount.com" \
  --full-resource-name="//bigquery.googleapis.com/projects/data-platform-prod/datasets/project_data"
```

You can also test what a service account can see by impersonating it during `gcloud` commands (see [gcloud-output-formatting](https://alp78.github.io/elysium/06-GCP/Core/gcloud-output-formatting)).

### Minimum IAM Permission Set for a Data Pipeline

> [!tip] Least Privilege Reference
>
> The minimum permission set for a data pipeline service account:
> - BigQuery: `roles/bigquery.dataEditor` + `roles/bigquery.jobUser`
> - GCS: `roles/storage.objectAdmin` (on specific buckets, not the project)
> - Cloud Run: `roles/run.invoker` (to trigger jobs)
> - SQL Server: no IAM role needed — authentication is at the database level (see [sql-server-authentication](https://alp78.github.io/elysium/04-SQL-Server/Security/sql-server-authentication) for the parallel least-privilege patterns)
> - Secret Manager: `roles/secretmanager.secretAccessor` (to read credentials)

### Custom IAM Roles for Tighter Control

```bash
gcloud iam roles create projectPipelineRole --project=data-platform-prod \
  --title="the data pipeline project Pipeline Role" \
  --permissions="bigquery.tables.get,bigquery.tables.getData,bigquery.tables.updateData,bigquery.jobs.create,storage.objects.get,storage.objects.create"
```

Custom roles allow you to grant exactly the permissions needed and no more — finer-grained than any predefined role.

### ADC and the GCE Metadata Server

On GCE VMs and Cloud Run, credentials are provided automatically by the GCP metadata server — no key files needed. The credentials are refreshed automatically and scoped to the service account attached to the VM or Cloud Run job. See [gcloud-authentication](https://alp78.github.io/elysium/06-GCP/Core/gcloud-authentication) for the full ADC credential search order, including how to activate a service account via `gcloud auth activate-service-account`.

## Related

- [gcp-identity-and-connection-patterns](https://alp78.github.io/elysium/06-GCP/Security/gcp-identity-and-connection-patterns) — Complete identity model, credential types, connection patterns by scenario
- [gcloud-authentication](https://alp78.github.io/elysium/06-GCP/Core/gcloud-authentication) — ADC credential search order; when key files vs metadata server applies
- [vpc-service-controls](https://alp78.github.io/elysium/06-GCP/Security/vpc-service-controls) — VPC-SC restricts what IAM-permitted identities can do with data
- [cloud-run-jobs-vs-services](https://alp78.github.io/elysium/06-GCP/Serverless/cloud-run-jobs-vs-services) — Attach the pipeline service account to Cloud Run jobs
- [gcs-buckets-and-lifecycle](https://alp78.github.io/elysium/06-GCP/Storage/gcs-buckets-and-lifecycle) — Grant `roles/storage.objectAdmin` on specific buckets only
- [dataset-and-table-management](https://alp78.github.io/elysium/06-GCP/BigQuery/dataset-and-table-management) — BigQuery roles required for table access
- [gcp-projects-and-apis](https://alp78.github.io/elysium/06-GCP/Core/gcp-projects-and-apis) — IAM policies are project-scoped

## References

- [IAM roles for BigQuery](https://cloud.google.com/bigquery/docs/access-control)
- [Service accounts overview](https://cloud.google.com/iam/docs/service-account-overview)
- [Workload Identity](https://cloud.google.com/kubernetes-engine/docs/how-to/workload-identity)
