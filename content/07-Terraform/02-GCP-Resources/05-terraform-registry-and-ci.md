---
title: "05 - Terraform: Registry and CI"
tags: [terraform, gcp, artifact-registry, ci-cd]
aliases: [terraform Artifact Registry, terraform CI service account, docker registry terraform, cleanup policies terraform]
description: "Terraform configuration for GCP Artifact Registry (Docker image storage with cleanup policies) and the CI/CD service account used by GitHub Actions to push images and deploy Cloud Run services."
parent: "[[domain-gcp-resources]]"
links:
  - "[[01-terraform-networking]]"
  - "[[02-terraform-compute]]"
  - "[[03-terraform-iam-and-secrets]]"
  - "[[04-terraform-cloud-run]]"
created: 2026-03-22
updated: 2026-04-05
status: complete
---

# Terraform Artifact Registry and CI Service Account

> [!quote]
> "Winning developers means earning their trust over many years through great software."
>
> — **Mitchell Hashimoto**, HashiConf talk

This note covers `registry.tf` and `ci.tf` — the Docker image registry and the GitHub Actions CI/CD service account that pushes images to it.

## Artifact Registry

Artifact Registry is GCP's container image storage service, the successor to the deprecated Container Registry. Docker images are pushed here by GitHub Actions and pulled by Cloud Run at deployment time. This section covers the Terraform resource that provisions the repository and its automated cleanup policies.

> [!info] Assumed Variables and Prerequisites
>
> - `var.region` — GCP region (e.g., `europe-west1`)
> - `var.project_id` — GCP project ID
> - Required API: `artifactregistry.googleapis.com`
> - Required IAM role for the Terraform service account: `roles/artifactregistry.admin`

### google_artifact_registry_repository

Provisions a Docker image repository in Artifact Registry. Cloud Run services and jobs pull images from this repository at deploy time, so co-locating the registry in the same region as Cloud Run minimizes pull latency.

The `format` argument is immutable — changing it forces resource replacement. The `location` and `repository_id` arguments are also immutable; changing either one destroys the existing repository and creates a new one.

```hcl
resource "google_artifact_registry_repository" "data-pipeline" {
  location      = var.region
  repository_id = "data-pipeline"
  format        = "DOCKER"

  cleanup_policies {
    id     = "keep-latest-5"
    action = "KEEP"

    most_recent_versions {
      keep_count = 5
    }
  }

  cleanup_policies {
    id     = "delete-untagged"
    action = "DELETE"

    condition {
      tag_state = "UNTAGGED"
    }
  }
}
```

| Argument | Required | Description |
|---|---|---|
| `location` | Yes | GCP region for image storage. Co-locate with Cloud Run to minimize pull latency. Immutable — changing forces replacement. |
| `repository_id` | Yes | Unique repository name within the project. Forms the registry path: `<region>-docker.pkg.dev/<project>/<repository_id>/`. Immutable — changing forces replacement. |
| `format` | Yes | Repository format: `DOCKER`, `MAVEN`, `NPM`, `PYTHON`, `APT`, `YUM`, `GO`. Immutable. |
| `cleanup_policies` | No | Automated lifecycle rules for image retention and deletion. Multiple policies can coexist. |
| `cleanup_policy_dry_run` | No | Set to `true` to log which images would be affected by cleanup policies without actually deleting them. Use this to validate policies before enforcement. Default: `false`. |

> [!danger] Force-Replacement Triggers
>
> Changing `location`, `repository_id`, or `format` destroys the repository and all its images, then creates a new empty repository. This is **permanent data loss** — deleted images cannot be recovered.

> [!success] Protect with Lifecycle Rules
>
> Add `lifecycle { prevent_destroy = true }` to production registries. If a replacement is genuinely needed, first push all images to the new repository, update all Cloud Run references, then remove the old resource from state with `terraform state rm` before deleting it from config.

#### Cleanup Policies

Two policies work together to prevent unbounded storage growth. Without cleanup policies, every CI push accumulates permanently.

| Policy | Action | Rule | Effect |
|--------|--------|------|--------|
| `keep-latest-5` | `KEEP` | `keep_count = 5` | Retains the 5 most recent image versions per tag. Older versions become candidates for deletion. |
| `delete-untagged` | `DELETE` | `tag_state = UNTAGGED` | Deletes images that have no tag (e.g., after a newer image takes the `latest` tag, the old one becomes untagged). Prevents orphaned layers from consuming storage. |

> [!tip] Validate Before Enforcing
>
> Set `cleanup_policy_dry_run = true` when first adding cleanup policies. Artifact Registry will log which images would be affected in Cloud Logging without actually deleting them. Once satisfied, set it back to `false` to enable enforcement. With daily deployments and a 5-version retention window, storage stays bounded to approximately 5× the image size per repository.

#### Lifecycle Meta-Arguments

Production registries should be protected from accidental deletion. The `prevent_destroy` meta-argument causes Terraform to error if a plan would destroy the repository.

```hcl
resource "google_artifact_registry_repository" "data-pipeline" {
  location      = var.region
  repository_id = "data-pipeline"
  format        = "DOCKER"

  lifecycle {
    prevent_destroy = true
  }
}
```

#### Registry Path Structure

The `locals.registry` value in `run.tf` computes the full registry path from the repository attributes:

```text
europe-west1-docker.pkg.dev/data-platform-prod/data-pipeline
```

Images are referenced as:
- `europe-west1-docker.pkg.dev/data-platform-prod/data-pipeline/pipeline:latest`
- `europe-west1-docker.pkg.dev/data-platform-prod/data-pipeline/dashboard:latest`

> [!todo] Import Existing Artifact Registry Repository
>
> To bring an existing repository under Terraform management:
>
> **CLI import (all Terraform versions):**
> ```bash
> terraform import google_artifact_registry_repository.data-pipeline projects/data-platform-prod/locations/europe-west1/repositories/data-pipeline
> ```
>
> **Declarative import (Terraform 1.5+):**
> ```hcl
> import {
>   to = google_artifact_registry_repository.data-pipeline
>   id = "projects/data-platform-prod/locations/europe-west1/repositories/data-pipeline"
> }
> ```

---

## CI/CD Service Account

A dedicated service account for GitHub Actions with narrowly scoped permissions. This account can push Docker images and deploy Cloud Run revisions, but cannot access databases, read secrets, or modify IAM policies. Its credentials are stored as a GitHub Actions secret (`GCP_SA_KEY`).

> [!info] Assumed Variables and Dependencies
>
> - `var.project_id` — GCP project ID
> - `google_service_account.pipeline` — Pipeline workload SA (defined in [terraform-iam-and-secrets](https://alp78.github.io/elysium/07-Terraform/GCP-Resources/terraform-iam-and-secrets))
> - `google_service_account.dashboard` — Dashboard workload SA (defined in [terraform-iam-and-secrets](https://alp78.github.io/elysium/07-Terraform/GCP-Resources/terraform-iam-and-secrets))
> - Required API: `iam.googleapis.com`
> - Required IAM role for the Terraform service account: `roles/iam.serviceAccountAdmin`

### google_service_account | CI Runner

Creates the service account identity that GitHub Actions authenticates as when deploying to GCP. The `account_id` is immutable — changing it forces replacement, which invalidates any existing keys or Workload Identity bindings.

```hcl
resource "google_service_account" "ci" {
  account_id   = "data-pipeline-ci"
  display_name = "the data pipeline project CI/CD (GitHub Actions)"
}
```

| Argument | Required | Description |
|---|---|---|
| `account_id` | Yes | Unique identifier within the project. Forms the email: `<account_id>@<project>.iam.gserviceaccount.com`. Immutable — changing forces replacement. |
| `display_name` | No | Human-readable label shown in the GCP console. Mutable. |

### google_project_iam_member | CI Registry and Cloud Run Access

Grants project-level IAM roles to the CI service account. Each `google_project_iam_member` resource adds a single role binding without overwriting existing bindings for that role (unlike `google_project_iam_binding` which is authoritative).

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

| Argument | Required | Description |
|---|---|---|
| `project` | Yes | GCP project to bind the role in. |
| `role` | Yes | IAM role to grant. Changing forces replacement (removes old binding, adds new one). |
| `member` | Yes | Identity receiving the role. Format: `serviceAccount:<email>`. Changing forces replacement. |

| Role | What It Allows |
|---|---|
| `roles/artifactregistry.writer` | Push (write) Docker images to Artifact Registry. Cannot delete images or modify repository settings. |
| `roles/run.developer` | Deploy new revisions to Cloud Run services and jobs. Cannot modify IAM or networking. |

### google_service_account_iam_member | Act-As Bindings

Grants the CI service account permission to **act as** the workload service accounts when deploying Cloud Run services and jobs. When GitHub Actions deploys a Cloud Run revision, it must specify which service account the workload runs as — the `roles/iam.serviceAccountUser` role on the target SA authorizes this without granting the CI account the target SA's own permissions.

```hcl
resource "google_service_account_iam_member" "ci_act_as_pipeline" {
  service_account_id = google_service_account.pipeline.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.ci.email}"
}

resource "google_service_account_iam_member" "ci_act_as_dashboard" {
  service_account_id = google_service_account.dashboard.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.ci.email}"
}
```

| Argument | Required | Description |
|---|---|---|
| `service_account_id` | Yes | The target service account (the one being "acted as"). Use the `name` attribute (projects/…/serviceAccounts/…) not the email. |
| `role` | Yes | IAM role to grant on the target service account. |
| `member` | Yes | The identity receiving the role. Format: `serviceAccount:<email>`. |

> [!info] Least Privilege Chain
>
> The CI account can push images and update deployments, but it cannot access the database, read secrets, or trigger pipeline runs. It can only assign existing service accounts to Cloud Run workloads. See [terraform-iam-and-secrets](https://alp78.github.io/elysium/07-Terraform/GCP-Resources/terraform-iam-and-secrets) for the full IAM design and [service-accounts-and-iam](https://alp78.github.io/elysium/06-GCP/Security/service-accounts-and-iam) for GCP IAM fundamentals.

## Verification

Use `gcloud` commands to verify the Terraform-provisioned resources match expectations.

### List repositories

```bash
gcloud artifacts repositories list --location=europe-west1
```

### List Docker images

```bash
gcloud artifacts docker images list europe-west1-docker.pkg.dev/data-platform-prod/data-pipeline
```

### List tags for pipeline image

```bash
gcloud artifacts docker tags list europe-west1-docker.pkg.dev/data-platform-prod/data-pipeline/pipeline
```

### List tags for dashboard image

```bash
gcloud artifacts docker tags list europe-west1-docker.pkg.dev/data-platform-prod/data-pipeline/dashboard
```

### Verify CI service account roles

```bash
gcloud projects get-iam-policy data-platform-prod --flatten="bindings[].members" --filter="bindings.members:data-pipeline-ci@" --format="table(bindings.role)"
```

---

## GitHub Actions Workflow Integration

The CI service account authenticates GitHub Actions workflows with GCP. There are two authentication methods: JSON key (legacy) and Workload Identity Federation (modern, keyless).

### JSON Key Authentication (Legacy)

The CI service account's JSON key is stored as a GitHub Actions secret and passed to the `google-github-actions/auth` action. This method works but carries security risks — the key is a long-lived credential that must be manually rotated and can be exfiltrated if the repository is compromised.

```yaml
steps:
  - uses: google-github-actions/auth@v2
    with:
      credentials_json: ${{ secrets.GCP_SA_KEY }}
```

> [!warning] Long-Lived Credentials
>
> JSON service account keys do not expire automatically. If the key leaks (e.g., through a compromised CI log, a forked repository, or a misconfigured workflow), an attacker gains persistent access until the key is manually revoked. Key rotation is a manual process with no built-in enforcement.

> [!success] Migrate to Workload Identity Federation
>
> Workload Identity Federation eliminates long-lived keys entirely. GitHub Actions exchanges a short-lived OIDC token for temporary GCP credentials — no secrets to rotate, no keys to leak. See the Workload Identity Federation section below.

### GitHub Actions Secrets

These secrets are configured in the GitHub repository settings and injected into workflow runs.

| Secret Name | What It Contains | Used By |
|---|---|---|
| `GCP_SA_KEY` | Service account key JSON (entire file contents) | `google-github-actions/auth` for GCP authentication |
| `DD_API_KEY` | Datadog API key | Pipeline containers for APM/log shipping |
| `DB_PASSWORD` | Database SA password | Pipeline and dashboard containers |

### Workload Identity Federation (Recommended)

Workload Identity Federation (WIF) allows GitHub Actions to authenticate with GCP without storing any long-lived credentials. GitHub's OIDC provider issues a short-lived token, which GCP exchanges for temporary service account credentials scoped to a single workflow run.

```hcl
resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github-actions"
  display_name              = "GitHub Actions"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-oidc"
  display_name                       = "GitHub OIDC"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
  }

  attribute_condition = "assertion.repository == 'your-org/your-repo'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}
```

```hcl
resource "google_service_account_iam_member" "ci_wif" {
  service_account_id = google_service_account.ci.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/your-org/your-repo"
}
```

The GitHub Actions workflow then authenticates without any JSON key:

```yaml
steps:
  - uses: google-github-actions/auth@v2
    with:
      workload_identity_provider: projects/<project-number>/locations/global/workloadIdentityPools/github-actions/providers/github-oidc
      service_account: data-pipeline-ci@data-platform-prod.iam.gserviceaccount.com
```

> [!tip] WIF Benefits
>
> - **No secrets to rotate** — tokens are issued per workflow run and expire automatically
> - **Repository-scoped** — the `attribute_condition` restricts authentication to a specific GitHub repository
> - **Audit trail** — each token exchange is logged in Cloud Audit Logs with the originating repository and workflow

For the full GitHub Actions CI/CD workflow setup, see [github-actions-ci-cd](https://alp78.github.io/elysium/10-GitHub-Actions/github-actions-ci-cd). For Docker image build and push operations, see [image-management](https://alp78.github.io/elysium/09-Docker/image-management).

## CI/CD Pipeline Architecture

This diagram shows how the Terraform resources in this file connect to form the deployment pipeline — from code push through image storage to Cloud Run deployment.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {
  'primaryColor': '#292e42',
  'primaryTextColor': '#c0caf5',
  'primaryBorderColor': '#565f89',
  'lineColor': '#565f89',
  'secondaryColor': '#1a1b26',
  'tertiaryColor': '#24283b',
  'noteTextColor': '#c0caf5',
  'noteBkgColor': '#292e42',
  'textColor': '#c0caf5',
  'fontSize': '14px'
}}}%%
flowchart LR
    A[Git Push] --> B[GitHub Actions]
    B -->|auth@v2<br>SA Key or WIF| C[CI Service Account]
    C -->|artifactregistry.writer| D[Artifact Registry]
    C -->|run.developer| E[Cloud Run Deploy]
    C -->|iam.serviceAccountUser| F[Workload SAs]
    D -->|docker pull| E
    G[Cleanup Policies] -->|keep 5 / delete untagged| D
    F -->|pipeline SA| H[Cloud Run Job]
    F -->|dashboard SA| I[Cloud Run Service]
```

## Related

**Terraform chapter:**
- [terraform-iam-and-secrets](https://alp78.github.io/elysium/07-Terraform/GCP-Resources/terraform-iam-and-secrets) — full IAM design and the workload service accounts this CI account acts as
- [terraform-cloud-run](https://alp78.github.io/elysium/07-Terraform/GCP-Resources/terraform-cloud-run) — Cloud Run services and jobs that pull images from this registry

**GCP services (Folder 06):**
- [service-accounts-and-iam](https://alp78.github.io/elysium/06-GCP/Security/service-accounts-and-iam) — GCP IAM fundamentals, role hierarchy, and service account best practices
- [secrets-management](https://alp78.github.io/elysium/06-GCP/Security/secrets-management) — Secret Manager for runtime secrets consumed by Cloud Run workloads
- [gcloud-authentication](https://alp78.github.io/elysium/06-GCP/Core/gcloud-authentication) — GCP authentication methods including Workload Identity Federation

**CI/CD and Docker:**
- [github-actions-ci-cd](https://alp78.github.io/elysium/10-GitHub-Actions/github-actions-ci-cd) — GitHub Actions workflows that use the CI service account
- [image-management](https://alp78.github.io/elysium/09-Docker/image-management) — Docker tag, push, and build commands for the registry

## References

- [google_artifact_registry_repository](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/artifact_registry_repository)
- [Artifact Registry cleanup policies](https://cloud.google.com/artifact-registry/docs/repositories/cleanup-policy)
- [google_service_account](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/google_service_account)
- [google_project_iam_member](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/google_project_iam_member)
- [Workload Identity Federation for GitHub Actions](https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)
- [google-github-actions/auth](https://github.com/google-github-actions/auth)
