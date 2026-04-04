---
tags: [infrastructure, terraform, iac, gcp]
aliases: [terraform Artifact Registry, terraform CI service account, docker registry terraform, cleanup policies terraform]
description: "Terraform configuration for GCP Artifact Registry (Docker image storage with cleanup policies) and the CI/CD service account used by GitHub Actions to push images and deploy Cloud Run services."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Terraform Artifact Registry and CI Service Account

> [!quote]
> "Winning developers means earning their trust over many years through great software."
>
> — **Mitchell Hashimoto**, HashiConf talk

This note covers `registry.tf` and `ci.tf` — the Docker image registry and the GitHub Actions CI/CD service account that pushes images to it.

## Artifact Registry — registry.tf

**Artifact Registry** is GCP's container image storage (successor to Container Registry). Docker images are pushed here by GitHub Actions and pulled by Cloud Run.

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

### Repository Fields

| Field | Value | Meaning |
|-------|-------|---------|
| `location` | `var.region` | `europe-west1`. Images are stored close to where they run (Cloud Run in the same region), minimizing pull latency. |
| `repository_id` | `data-pipeline` | Creates the registry path `europe-west1-docker.pkg.dev/<project>/data-pipeline/`. Images are pushed as `data-pipeline/pipeline:latest` and `data-pipeline/dashboard:latest`. |
| `format` | `DOCKER` | This repository stores Docker/OCI container images. Other formats include `MAVEN`, `NPM`, `PYTHON`. |

### Cleanup Policies

Two policies work together to prevent unbounded storage growth:

| Policy | Action | Rule | Effect |
|--------|--------|------|--------|
| `keep-latest-5` | `KEEP` | `keep_count = 5` | Retains the 5 most recent image versions per tag. Older versions become candidates for deletion. |
| `delete-untagged` | `DELETE` | `tag_state = UNTAGGED` | Deletes images that have no tag (e.g., after a newer image takes the `latest` tag, the old one becomes untagged). Prevents orphaned layers from consuming storage. |

> [!tip] Prevent Storage Bloat
>
> Without cleanup policies, every CI push accumulates permanently. With daily deployments and a 5-version retention window, storage stays bounded to approximately 5× the image size per repository.

### Registry Path Structure

The `locals.registry` value in `run.tf` computes the full registry path:

```
europe-west1-docker.pkg.dev/data-platform-prod/data-pipeline
```

Images are referenced as:
- `europe-west1-docker.pkg.dev/data-platform-prod/data-pipeline/pipeline:latest`
- `europe-west1-docker.pkg.dev/data-platform-prod/data-pipeline/dashboard:latest`

---

## CI/CD Service Account — ci.tf

A dedicated service account for GitHub Actions. Its JSON key is stored as a GitHub Actions secret (`GCP_SA_KEY`).

```hcl
resource "google_service_account" "ci" {
  account_id   = "data-pipeline-ci"
  display_name = "the data pipeline project CI/CD (GitHub Actions)"
}
```

### IAM Bindings

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

| Role | What it allows |
|------|----------------|
| `roles/iam.serviceAccountUser` | **Act as** another service account. When GitHub Actions deploys a Cloud Run job or service, it must specify which service account the workload runs as. This role allows CI to assign those identities without gaining their permissions. |

> [!info] Least Privilege Chain
>
> The CI account can push images and update deployments, but it cannot access the database, read secrets, or trigger pipeline runs. It can only assign existing service accounts to Cloud Run workloads. See [terraform-iam-and-secrets](https://alp78.github.io/elysium/07-Terraform/GCP-Resources/terraform-iam-and-secrets) for the full IAM design.

---

### gcloud Verification Commands

```bash
# List repositories
gcloud artifacts repositories list --location=europe-west1

# List Docker images in the registry
gcloud artifacts docker images list europe-west1-docker.pkg.dev/data-platform-prod/data-pipeline

# List tags for an image
gcloud artifacts docker tags list europe-west1-docker.pkg.dev/data-platform-prod/data-pipeline/pipeline
gcloud artifacts docker tags list europe-west1-docker.pkg.dev/data-platform-prod/data-pipeline/dashboard
```

---

## GitHub Actions Workflow Integration

The CI service account is used in GitHub Actions workflows that authenticate with GCP:

```yaml
steps:
  - uses: google-github-actions/auth@v2
    with:
      credentials_json: ${{ secrets.GCP_SA_KEY }}
```

The `credentials_json` field receives the full JSON content of the CI service account key. The action uses it to authenticate with GCP for deployments.

#### GitHub Actions secrets — GCP_SA_KEY, GCP_PROJECT_ID, TF_VAR_ variables

| Secret name | What it contains | Used by |
|------------|-----------------|---------|
| `GCP_SA_KEY` | Service account key JSON (entire file contents) | `google-github-actions/auth` for GCP authentication |
| `DD_API_KEY` | Datadog API key | Pipeline containers for APM/log shipping |
| `DB_PASSWORD` | Database SA password | Pipeline and dashboard containers |

For the full GitHub Actions CI/CD workflow setup, see [github-actions-ci-cd](https://alp78.github.io/elysium/10-GitHub-Actions/github-actions-ci-cd).

For Docker image build and push operations, see [image-management](https://alp78.github.io/elysium/09-Docker/image-management).

## Related

- [terraform-iam-and-secrets](https://alp78.github.io/elysium/07-Terraform/GCP-Resources/terraform-iam-and-secrets) — how the CI service account's permissions are structured
- [terraform-cloud-run](https://alp78.github.io/elysium/07-Terraform/GCP-Resources/terraform-cloud-run) — the Cloud Run services that pull images from this registry
- [github-actions-ci-cd](https://alp78.github.io/elysium/10-GitHub-Actions/github-actions-ci-cd) — the GitHub Actions workflows that use the CI service account
- [image-management](https://alp78.github.io/elysium/09-Docker/image-management) — docker tag, push, and build commands for the registry

## References

- [google_artifact_registry_repository](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/artifact_registry_repository)
- [Artifact Registry cleanup policies](https://cloud.google.com/artifact-registry/docs/repositories/cleanup-policy)
- [google-github-actions/auth](https://github.com/google-github-actions/auth)
