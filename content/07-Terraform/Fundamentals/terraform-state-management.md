---
type: concept
category: infrastructure
technology: [terraform, gcp]
tags: [infrastructure, terraform, iac, gcp]
aliases: [terraform state, terraform.tfstate, remote state, state locking, terraform backend, GCS backend]
keywords: [terraform state, tfstate, remote state, state file, GCS backend, state locking, terraform state commands, terraform state list, terraform state show, terraform state mv, terraform state rm, force-unlock, backend gcs, state bucket]
description: "How Terraform state works, why remote state in GCS is essential, how state locking prevents concurrent applies, and the terraform state subcommands for safe state manipulation."
related:
  - "[[terraform-providers-and-backend]]"
  - "[[terraform-plan-apply-destroy]]"
  - "[[terraform-variables-and-outputs]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Terraform State Management

Terraform state is the source of truth that maps your `.tf` configuration to real GCP resources. Understanding how state works, how to protect it, and how to safely manipulate it is critical for production infrastructure management.

### What Is the State File?

The state file (`terraform.tfstate`) is a JSON document that maps every resource in your `.tf` files to its real GCP counterpart (resource IDs, IPs, URIs, etc.). When you run `terraform plan`, Terraform:

1. Reads the current state (remote or local)
2. Reads the GCP API to see what actually exists
3. Computes the diff between your `.tf` files and the current state
4. Shows what will change

> [!warning] The State File Is Sacred
>
> If you lose the state file, Terraform doesn't know what exists and will try to recreate everything — causing duplicates, conflicts, and potentially destroying running services. Always use remote state. Never delete the state file.

---

## Remote State in GCS

The `backend "gcs"` block in `main.tf` stores state remotely in Google Cloud Storage:

```hcl
terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }

  backend "gcs" {
    bucket = "data-pipeline-tf-state"
    prefix = "terraform/state"
  }
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| `bucket` | `data-pipeline-tf-state` | The GCS bucket name. This bucket must exist **before** `terraform init` — Terraform does not create it. |
| `prefix` | `terraform/state` | A path prefix inside the bucket. The actual state file is stored at `terraform/state/default.tfstate`. Using a prefix allows multiple Terraform configurations to share one bucket without colliding. |

**Why remote state?**
- If the state file is local, only one machine can run `terraform apply`
- With GCS backend, the state is centralized and locked during operations — preventing concurrent modifications
- The state survives if your laptop dies
- The GCS bucket access controls protect sensitive values stored in state (passwords, connection strings)

> [!info] GCS Bucket Must Pre-exist
>
> Create the state bucket manually (or via a separate bootstrap Terraform config) before running `terraform init`. The GCS backend cannot create its own bucket.

> [!warning] No Concurrent Applies
>
> Never Run Concurrent `terraform apply` on the Same State.
> Even with GCS locking, two engineers running `terraform plan` simultaneously can both see the same "clean" state, then apply conflicting changes. The second apply may overwrite the first's changes or corrupt state. Use CI/CD pipelines (GitHub Actions, Cloud Build) as the single point of entry for `terraform apply` in shared environments.

```bash
# Create the state bucket (run once, before terraform init)
gcloud storage buckets create gs://data-pipeline-tf-state \
  --location=europe-west1 \
  --uniform-bucket-level-access
```

---

## State Locking

GCS backend supports automatic state locking during operations. When `terraform plan` or `terraform apply` runs, Terraform acquires a lock on the state file. Other operations attempting to run simultaneously will fail with a lock error.

```text
Error acquiring the state lock
Lock Info:
  ID:        abc-123-def
  Path:      gs://data-pipeline-tf-state/terraform/state/default.tflock
  Operation: OperationTypePlan
  Who:       user@machine
  Created:   2026-03-22 14:00:00
```

#### State Locking — terraform force-unlock after crashed apply

```bash
# Force-unlock the state (use with caution — verify no other apply is running first)
terraform force-unlock <LOCK_ID>
# Replace <LOCK_ID> with the ID shown in the error message above
```

> [!warning] Force-Unlock Carefully
>
> Only force-unlock if you are certain no other `terraform apply` is running. Unlocking while an apply is in progress can corrupt the state file.

---

## terraform state Commands

Use `terraform state` subcommands to inspect and manipulate state without modifying real infrastructure.

### Inspecting State

```bash
# List all resources managed by Terraform
terraform -chdir=infra state list

# Show details of a specific resource in state
terraform -chdir=infra state show google_cloud_run_v2_service.dashboard

# Show the full state file (formatted)
terraform -chdir=infra show
```

#### terraform state list — example output of managed resources

```text
google_artifact_registry_repository.data-pipeline
google_cloud_run_v2_job.pipeline
google_cloud_run_v2_job.setup
google_cloud_run_v2_service.dashboard
google_cloud_run_v2_service_iam_member.dashboard_public
google_compute_firewall.allow_apm
google_compute_firewall.allow_airflow_ui
google_compute_firewall.allow_iap
google_compute_firewall.allow_sql
google_compute_firewall.deny_all_ingress
google_compute_instance.airflow
google_compute_instance.sql
google_compute_network.main
google_compute_router.main
google_compute_router_nat.main
google_compute_subnetwork.main
google_iam_service_account.airflow
google_iam_service_account.pipeline
google_secret_manager_secret.db_password
google_secret_manager_secret_version.db_password
```

### Moving Resources in State

`terraform state mv` renames a resource in state without destroying and recreating it. Use this when refactoring `.tf` files (e.g., renaming a resource's Terraform-internal name):

```bash
# Rename a resource in state (does not touch the real GCP resource)
terraform state mv google_compute_instance.project_sql google_compute_instance.sql
# After this, your .tf file should use "sql" as the resource name
```

### Removing Resources from State

`terraform state rm` removes a resource from state without destroying the real GCP resource. Use this when you want Terraform to "forget" about a resource (e.g., moving it to a different Terraform config):

```bash
# Remove a resource from state (the real GCP resource is NOT deleted)
terraform state rm google_compute_instance.airflow
# After this, terraform plan will show the resource as "not in state"
# Subsequent apply will try to create it (unless you import it)
```

> [!warning] Never Edit State Manually
>
> Never edit `terraform.tfstate` directly in a text editor. Use `terraform state mv` and `terraform state rm` for all state manipulation. Manual edits corrupt the state and can cause all resources to be destroyed on the next apply.

> [!danger] State rm Then Apply Destroys Resources
>
> `terraform state rm` Followed by `terraform apply` Destroys Resources.
> If you `terraform state rm` a resource and then run `terraform apply`, Terraform sees the resource definition in your `.tf` files but not in state, so it tries to create a new one. If the resource already exists in GCP (which it does -- you just removed it from state), the apply either fails with a "resource already exists" error or, worse, creates a duplicate. Always pair `terraform state rm` with either removing the resource block from `.tf` files or immediately importing it back into a different state.

### Importing Existing Resources

When a resource was created outside Terraform, import it without recreating it:

```bash
# Import an existing GCE instance
terraform import google_compute_instance.project_sql \
  projects/data-platform-prod/zones/europe-west1-b/instances/data-pipeline-sql

# Import a Cloud Run service
terraform import google_cloud_run_v2_service.dashboard \
  projects/data-platform-prod/locations/europe-west1/services/data-pipeline-dashboard

# Import a Secret Manager secret
terraform import google_secret_manager_secret.db_password \
  projects/data-platform-prod/secrets/data-pipeline-db-password
```

After importing:
1. Run `terraform plan` — Terraform shows the diff between your `.tf` config and the actual resource
2. Update `.tf` to match the real resource (close diffs)
3. Run `terraform plan` again — should show "No changes"

---

### gcloud Verification After Apply

After `terraform apply`, verify the state reflects reality:

```bash
# Verify all outputs
terraform -chdir=infra output

# List all Terraform-managed resources
terraform -chdir=infra state list

# Show details of a specific resource
terraform -chdir=infra state show google_cloud_run_v2_service.dashboard

# Preview changes (should show "No changes" after a clean apply)
terraform -chdir=infra plan

# Validate configuration syntax
terraform -chdir=infra validate
```

---

### State Security

> [!danger] State Contains Secrets
>
> State File Contains Plaintext Secrets.
> Terraform stores all resource attributes in state -- including database passwords, API keys, and secret values passed via `google_secret_manager_secret_version`. Anyone with read access to the GCS state bucket can extract every secret in your infrastructure. Treat the state bucket with the same security as your secret manager: restrict access to the Terraform service account and human admins only, enable audit logging, and never download state files to local machines.

The state file contains sensitive values (passwords, connection strings, secret versions). Secure the GCS bucket:

1. **Restrict access** — only the Terraform service account and human administrators should have access to the state bucket
2. **Enable versioning** — GCS bucket versioning lets you recover a corrupted state file from a previous version
3. **Enable object encryption** — GCS encrypts at rest by default; optionally use CMEK for compliance requirements

```bash
# Enable versioning on the state bucket
gcloud storage buckets update gs://data-pipeline-tf-state --versioning

# Recover a previous state version (if the current state is corrupted)
gcloud storage objects list gs://data-pipeline-tf-state/terraform/state/ --all-versions
gcloud storage cp "gs://data-pipeline-tf-state/terraform/state/default.tfstate#<generation>" \
  gs://data-pipeline-tf-state/terraform/state/default.tfstate
```

---

### Terraform State Verification Commands

```bash
# View all outputs
terraform -chdir=infra output

# View a specific output
terraform -chdir=infra output dashboard_url

# List all resources managed by Terraform
terraform -chdir=infra state list

# Show details of a specific resource in state
terraform -chdir=infra state show google_cloud_run_v2_service.dashboard

# Preview changes without applying
terraform -chdir=infra plan

# Validate configuration syntax
terraform -chdir=infra validate
```

## Related

- [[terraform-providers-and-backend]] — backend "gcs" block configuration
- [[terraform-plan-apply-destroy]] — the workflow that reads and updates state
- [[terraform-variables-and-outputs]] — outputs extracted from state after apply

## References

- [Terraform State](https://developer.hashicorp.com/terraform/language/state)
- [GCS Backend](https://developer.hashicorp.com/terraform/language/backend/gcs)
- [terraform state commands](https://developer.hashicorp.com/terraform/cli/commands/state)
