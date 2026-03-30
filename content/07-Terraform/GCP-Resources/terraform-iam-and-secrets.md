---
type: reference
category: infrastructure
technology: [terraform, gcp]
tags: [security, infrastructure, terraform, iac, gcp]
aliases: [terraform IAM, terraform service accounts, terraform Secret Manager, GCP IAM bindings terraform, google_service_account]
keywords: [google_service_account, google_project_iam_member, google_secret_manager_secret, IAM bindings, service account, least privilege, secret manager, secret version, roles, secretAccessor, run.invoker, artifactregistry.writer, conditional resources, Datadog, count]
description: "Terraform configuration for GCP IAM service accounts, IAM role bindings, and Secret Manager secrets. Covers the least-privilege pattern with one service account per workload, resource-level vs project-level bindings, and conditional Datadog resources."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Terraform IAM and Secrets

> [!quote]
> "Give an agent raw cloud access and you get the same thing you get when you hand a developer raw Terraform — well-intentioned decisions made without context."
> — **Kelsey Hightower**

This note covers `iam.tf`, `secrets.tf`, and the IAM portions of `ci.tf` — the service accounts, IAM bindings, and Secret Manager secrets that implement least-privilege access across the example infrastructure.

### Design Principle: One Service Account Per Workload

A **service account** is a non-human identity that a workload runs as. Each workload gets its own service account with the minimum permissions it needs (**least privilege**). For the underlying GCP IAM concepts -- roles, policies, and the principal hierarchy -- see [service-accounts-and-iam](https://alp78.github.io/elysium/06-GCP/Security/service-accounts-and-iam). This is the standard GCP pattern -- one service account per service. The service accounts themselves have **no permissions by default**; they only gain access through explicit IAM bindings.

> [!info] Resource vs Project IAM
>
> Resource-Level vs Project-Level IAM.
> `data-pipeline-pipeline` and `data-pipeline-dashboard` appear to have "no roles" in the GCP Console's project IAM page, but they have resource-level bindings on specific secrets (visible under each secret's Permissions tab, not the project-level IAM page). This is intentional and more secure — they can only access their specific secrets, not any other project resources.

---

## Service Accounts — iam.tf

### Core Service Accounts

```hcl
resource "google_service_account" "pipeline" {
  account_id   = "data-pipeline-pipeline"
  display_name = "the data pipeline project Pipeline"
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| `account_id` | `data-pipeline-pipeline` | Creates the email `data-pipeline-pipeline@<project>.iam.gserviceaccount.com`. Must be 6-30 characters, lowercase letters, digits, and hyphens. |
| `display_name` | `the data pipeline project Pipeline` | Human-readable name shown in the GCP console. |

#### google_service_account — three core SAs: pipeline, airflow, dashboard

| Account | Used by | Purpose |
|---------|---------|---------|
| `data-pipeline-pipeline` | Cloud Run pipeline job + SQL VM | Runs data pipeline, accesses database password in Secret Manager |
| `data-pipeline-dashboard` | Cloud Run dashboard service | Runs Blazor app, accesses database password in Secret Manager |
| `data-pipeline-airflow` | Airflow GCE VM | Triggers Cloud Run jobs, views logs |

---

## IAM Bindings

IAM bindings connect a **member** (service account) to a **role** (set of permissions) on a **resource** (project, secret, etc.).

There are two scopes for IAM bindings:

| Scope | Resource type | Example | Visible in |
|-------|--------------|---------|------------|
| **Project-level** | `google_project_iam_member` | `roles/run.invoker` for Airflow | IAM → Permissions page |
| **Resource-level** | `google_secret_manager_secret_iam_member` | `roles/secretmanager.secretAccessor` for pipeline on a specific secret | Secret Manager → secret → Permissions tab |

Resource-level bindings are more restrictive (apply only to one resource, not the whole project) and don't show up on the project IAM page — you have to look at the specific resource's permissions.

### Secret Access Bindings

```hcl
resource "google_secret_manager_secret_iam_member" "pipeline_secret" {
  secret_id = google_secret_manager_secret.db_password.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.pipeline.email}"
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| `secret_id` | `...db_password.id` | The specific secret this binding applies to. Not project-wide — only this one secret. |
| `role` | `roles/secretmanager.secretAccessor` | Allows reading secret versions. Cannot create, delete, or modify secrets. |
| `member` | `serviceAccount:data-pipeline-pipeline@...` | The `serviceAccount:` prefix is required IAM syntax. Other prefixes include `user:` for humans and `group:` for Google Groups. |

### Airflow Permissions (Project-Level)

```hcl
resource "google_project_iam_member" "airflow_run_invoker" {
  project = var.project_id
  role    = "roles/run.invoker"
  member  = "serviceAccount:${google_service_account.airflow.email}"
}
```

| Role | What it allows |
|------|----------------|
| `roles/run.invoker` | Execute (invoke) Cloud Run services and jobs. Airflow uses this to trigger pipeline runs via `CloudRunExecuteJobOperator`. |
| `roles/run.developer` | Deploy new revisions of Cloud Run services/jobs. Needed because the Airflow operator updates job overrides (passing `--step` arguments). |
| `roles/logging.viewer` | Read logs from Cloud Logging. Allows Airflow to display Cloud Run job logs in its UI. |

### Multi-Environment IAM Pattern

For broader deployments, a service account per workload type receives only the roles it needs:

```hcl
# iam.tf — one service account per workload
resource "google_service_account" "pipeline_runner" {
  account_id   = "pipeline-runner"
  display_name = "Pipeline Runner"
  description  = "Used by Airflow DAGs and Cloud Run pipeline containers"
}

resource "google_service_account" "dashboard" {
  account_id   = "dashboard-reader"
  display_name = "Dashboard Read-Only"
  description  = "Used by Blazor dashboard — read access only"
}

resource "google_service_account" "pubsub_invoker" {
  account_id   = "pubsub-invoker"
  display_name = "Pub/Sub Push Invoker"
}

# Grant specific roles — never roles/editor or roles/owner
resource "google_project_iam_member" "pipeline_bq_editor" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.pipeline_runner.email}"
}

resource "google_project_iam_member" "dashboard_bq_viewer" {
  project = var.project_id
  role    = "roles/bigquery.dataViewer"
  member  = "serviceAccount:${google_service_account.dashboard.email}"
}

resource "google_project_iam_member" "pipeline_gcs_writer" {
  project = var.project_id
  role    = "roles/storage.objectCreator"
  member  = "serviceAccount:${google_service_account.pipeline_runner.email}"
}
```

---

### Conditional Datadog Resources

The Datadog service account is only created if a Datadog API key is provided:

```hcl
resource "google_service_account" "datadog" {
  count        = var.dd_api_key != "" ? 1 : 0
  account_id   = "data-pipeline-datadog"
  display_name = "Datadog GCP Integration"
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| `count` | `var.dd_api_key != "" ? 1 : 0` | **Conditional resource creation** — Terraform's way of saying "if/else." When `dd_api_key` is empty, `count = 0` and this resource (plus all Datadog IAM bindings) is not created at all. When set, `count = 1` creates it. |

The Datadog service account gets three read-only roles:

| Role | What it allows |
|------|----------------|
| `roles/monitoring.viewer` | Read Cloud Monitoring metrics (CPU, memory, disk). |
| `roles/compute.viewer` | Read Compute Engine metadata (VM names, zones, machine types). |
| `roles/cloudasset.viewer` | Read Cloud Asset Inventory (resource discovery across the project). |

> [!info] No Write or Admin Roles
>
> The Datadog integration can only observe — it cannot modify any resource. This is the correct least-privilege posture for a monitoring integration.

See [terraform-conditional-resources](https://alp78.github.io/elysium/07-Terraform/Patterns/terraform-conditional-resources) for the full pattern.

---

## Secret Manager — secrets.tf

### The Two-Level Structure

Secret Manager uses a **two-level structure**: the **secret** (a named container) and one or more **versions** (the actual values). For the operational side of working with secrets -- rotation, access auditing, and application integration patterns -- see [secrets-management](https://alp78.github.io/elysium/06-GCP/Security/secrets-management). This is why there are two Terraform resources per secret — one for the container, one for the value. The container defines the name and replication policy; the version holds the actual sensitive data. You can have multiple versions (e.g., after rotating a password) and Cloud Run references `version = "latest"` to always get the newest one.

### Secret Container

```hcl
resource "google_secret_manager_secret" "db_password" {
  secret_id = "data-pipeline-db-password"

  replication {
    auto {}
  }
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| `secret_id` | `data-pipeline-db-password` | Name of the secret in GCP. Used by Cloud Run to reference it: `secret = "data-pipeline-db-password"`. |
| `replication.auto` | `{}` | **Automatic replication** — GCP replicates the secret data across multiple regions for durability. The alternative `user_managed` lets you specify exact regions, which is useful for data residency requirements. |

### Secret Version

```hcl
resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = var.db_password
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| `secret` | `...db_password.id` | The parent secret this version belongs to. |
| `secret_data` | `var.db_password` | The actual password value. Terraform stores this in state (encrypted in the GCS backend). Cloud Run reads it at container startup via `value_source.secret_key_ref`. |

### Conditional Datadog Secret

```hcl
resource "google_secret_manager_secret_version" "dd_api_key" {
  count       = var.dd_api_key != "" ? 1 : 0
  secret      = google_secret_manager_secret.dd_api_key.id
  secret_data = var.dd_api_key
}
```

The secret container (`dd_api_key`) is always created, but the **version** (the actual key value) is only created when `dd_api_key` is provided. This means the secret exists as a placeholder even when Datadog is disabled — avoiding a Terraform error if you later enable it.

---

## CI/CD Service Account — ci.tf

A dedicated service account for GitHub Actions. Its JSON key is stored as a GitHub Actions secret (`GCP_SA_KEY`).

```hcl
resource "google_service_account" "ci" {
  account_id   = "data-pipeline-ci"
  display_name = "the data pipeline project CI/CD (GitHub Actions)"
}
```

### CI IAM Bindings

```hcl
resource "google_project_iam_member" "ci_registry" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.ci.email}"
}

resource "google_project_iam_member" "ci_run" {
  project = var.project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.ci.email}"
}
```

| Role | What it allows |
|------|----------------|
| `roles/artifactregistry.writer` | Push (write) Docker images to Artifact Registry. Cannot delete images or modify repository settings. |
| `roles/run.developer` | Deploy new revisions to Cloud Run services and jobs. Cannot modify IAM or networking. |

### Act-As Binding

```hcl
resource "google_service_account_iam_member" "ci_act_as_pipeline" {
  service_account_id = google_service_account.pipeline.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.ci.email}"
}
```

| Role | What it allows |
|------|----------------|
| `roles/iam.serviceAccountUser` | **Act as** another service account. When GitHub Actions deploys a Cloud Run job, it must specify which service account the job runs as (`data-pipeline-pipeline`). This role allows the CI account to assign that identity without being able to use the pipeline account's permissions directly. The "Act As" bindings are visible in GCP under each target service account → Permissions → "Principals with access to this service account." |

> [!info] Least Privilege Chain
>
> The CI account can push images and update deployments, but it cannot access the database, read secrets, or trigger pipeline runs. It can only assign existing service accounts to Cloud Run workloads.

---

### gcloud Verification Commands

```bash
# List all service accounts
gcloud iam service-accounts list --filter="email~data-pipeline"

# View IAM policy for a specific service account (shows who can "Act As" it)
gcloud iam service-accounts get-iam-policy data-pipeline-pipeline@data-platform-prod.iam.gserviceaccount.com

# View project-level IAM bindings for a service account
gcloud projects get-iam-policy data-platform-prod --flatten="bindings[].members" \
  --filter="bindings.members:data-pipeline-airflow@data-platform-prod.iam.gserviceaccount.com" \
  --format="table(bindings.role)"

# List all secrets
gcloud secrets list --filter="name~data-pipeline"

# View secret versions
gcloud secrets versions list data-pipeline-db-password
gcloud secrets versions list data-pipeline-dd-api-key

# View who has access to a secret
gcloud secrets get-iam-policy data-pipeline-db-password

# Access the latest secret value (careful — prints to terminal)
gcloud secrets versions access latest --secret=data-pipeline-db-password
```

## Related

- [terraform-compute](https://alp78.github.io/elysium/07-Terraform/GCP-Resources/terraform-compute) — the VMs assigned service accounts
- [terraform-cloud-run](https://alp78.github.io/elysium/07-Terraform/GCP-Resources/terraform-cloud-run) — how secrets are injected into Cloud Run containers
- [terraform-conditional-resources](https://alp78.github.io/elysium/07-Terraform/Patterns/terraform-conditional-resources) — the `count` pattern for optional Datadog resources
- [terraform-registry-and-ci](https://alp78.github.io/elysium/07-Terraform/GCP-Resources/terraform-registry-and-ci) — the CI service account's primary use case

## References

- [google_service_account](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/google_service_account)
- [google_project_iam_member](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/google_project_iam_member)
- [google_secret_manager_secret](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/secret_manager_secret)
- [GCP IAM Roles](https://cloud.google.com/iam/docs/understanding-roles)
