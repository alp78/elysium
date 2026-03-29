---
type: how-to
category: infrastructure
technology: [terraform, gcp]
tags: [infrastructure, terraform, iac, gcp]
aliases: [terraform workflow, terraform apply, terraform plan, terraform destroy, terraform init, terraform import]
keywords: [terraform init, terraform plan, terraform apply, terraform destroy, terraform import, terraform state, tfplan, plan output, apply workflow, infrastructure deployment, terraform -chdir]
description: "The core Terraform workflow: init, plan, apply, destroy, and importing existing resources into state. Includes the -chdir flag, targeted applies, and state inspection commands."
related:
  - "[[terraform-state-management]]"
  - "[[terraform-variables-and-outputs]]"
  - "[[hcl-syntax-basics]]"
  - "[[terraform-providers-and-backend]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Terraform Plan, Apply, and Destroy

The Terraform core workflow is declarative: you describe infrastructure in `.tf` files, and Terraform computes a diff against current state, shows you a plan, and applies only what changed. Understanding each step — including when to use targeted applies, how to import existing resources, and how to inspect state — is essential for safe infrastructure management. For a condensed quick-reference of all Terraform commands, see [[terraform-cheat-sheet]].

## How terraform apply Works

Before diving into commands, understanding the apply sequence prevents surprises:

1. **Parse** — merges all `.tf` files in the directory into one configuration
2. **Build dependency graph** — analyzes resource references (e.g., `google_compute_network.main.id`) to determine creation order
3. **Plan** — compares desired state (`.tf` files) with current state (`.tfstate`) and computes a diff
4. **Apply** — creates, updates, or deletes resources. Independent resources are created **in parallel**; dependent resources wait for their dependencies
5. **Update state** — writes the new state to the backend (GCS bucket)

---

## Core Commands

### Initialize — Download Providers and Set Up Backend

```bash
# Initialize (download providers, set up backend)
terraform init
# Run once after cloning the repo or adding new providers
# Downloads: GCP provider, creates .terraform/ directory
```

Run `init` once after:
- Cloning a repository for the first time
- Adding a new provider to `required_providers`
- Changing the backend configuration

```bash
# Using -chdir to run from any directory (common in scripts)
terraform -chdir=infra init
```

### Plan — Preview Changes Without Applying

```bash
# Plan (preview changes without applying)
terraform plan -out=tfplan
# Shows: what will be created, modified, or destroyed
# -out = save the plan to a file (for applying the exact same plan)
# ALWAYS review the plan before applying. Look for:
# - Resources being destroyed (is this intentional?)
# - Changes to production resources (is this safe?)
# - New resources (will this increase the bill?)
```

> [!warning] Always Review the Plan
> Never run `terraform apply` without first reviewing `terraform plan`. Terraform can and will destroy production resources if the configuration changes. Look specifically for lines beginning with `-` (destroy) and `~` (update in-place).

#### Plan output symbols — +create, ~update, -destroy, -/+replace

| Symbol | Meaning |
|--------|---------|
| `+` | Resource will be created |
| `-` | Resource will be destroyed |
| `~` | Resource will be updated in-place |
| `-/+` | Resource will be destroyed and recreated |

### Apply — Execute the Plan

```bash
# Apply (execute the plan)
terraform apply tfplan
# Creates/modifies/destroys resources to match the configuration
# Only apply after reviewing the plan
# Best practice: always manual terraform apply, never through CI

# Apply without a saved plan (shows plan interactively, requires confirmation)
terraform apply
```

> [!info] For the data pipeline project
> The data pipeline project applies Terraform changes **manually** — there is no automated `terraform apply` in CI/CD. CI/CD only handles application code (Docker images, Cloud Run deployments). Infrastructure changes are deliberate, reviewed, and applied by hand.

#### terraform apply -target — apply only specific resources

```bash
# Apply specific resource only
terraform -chdir=infra apply -target=google_compute_instance.airflow
# Useful when: adding a new resource to an existing config without touching everything else
# Use with caution: can create inconsistencies if dependencies are missed
```

### Destroy — Tear Down Resources

```bash
# Destroy (tear down all resources)
terraform destroy
# ⚠️ DESTROYS EVERYTHING in the current Terraform state
# Only use for: dev environments, cleanup, starting fresh

# Destroy a specific resource only
terraform destroy -target=google_compute_instance.airflow
```

> [!warning] Destroy is Permanent
> `terraform destroy` will remove all GCP resources managed by this configuration — VMs, Cloud Run services, firewall rules, service accounts, and secrets. There is no undo. For production, set `deletion_protection = true` on critical resources.

---

### State Inspection Commands

```bash
# View current state
terraform state list                    # all managed resources
terraform state show google_compute_instance.project_sql  # details of one resource

# List all managed resources
terraform -chdir=infra state list

# Show details of a specific resource in state
terraform -chdir=infra state show google_cloud_run_v2_service.dashboard

# Preview changes without applying
terraform -chdir=infra plan

# Validate configuration syntax
terraform -chdir=infra validate

# Show current state summary
terraform -chdir=infra show

# View all outputs
terraform -chdir=infra output

# View a specific output
terraform -chdir=infra output dashboard_url
```

---

## Importing Existing Resources

When a resource was created outside of Terraform (manually in the GCP Console, via `gcloud`, or by another tool), you can bring it under Terraform management without recreating it:

```bash
# Import existing resources (bring manually-created resources under Terraform)
terraform import google_compute_instance.project_sql projects/data-platform-prod/zones/europe-west1-b/instances/data-pipeline-sql
# Adds the existing VM to Terraform state without recreating it

# Import a Cloud Run service
terraform -chdir=infra import google_cloud_run_v2_service.dashboard \
  projects/<project>/locations/europe-west1/services/data-pipeline-dashboard
```

#### terraform import — import existing GCP resources into state
1. Write the resource block in your `.tf` files (Terraform needs to know the resource type and Terraform name)
2. Run `terraform import` with the GCP resource ID
3. Run `terraform plan` — Terraform will show what diffs exist between your `.tf` configuration and the actual resource
4. Update your `.tf` file to match (removing diffs)
5. Run `terraform plan` again — should show "No changes"

---

### Common Issues and Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `Resource already exists (409)` | Resource was created outside Terraform | `terraform import` to bring it under management |
| `deletion_protection` error | Trying to destroy a protected resource | Set `deletion_protection = false` in `.tf`, apply, then destroy |
| `provenance` error on Cloud Run | Docker image built with BuildKit provenance | Build with `--provenance=false` flag |
| `Permission denied` on apply | Terraform service account lacks roles | Check `gcloud auth list`, ensure correct account is active |
| State lock error | Another `terraform apply` is running | Wait, or force-unlock with `terraform force-unlock <LOCK_ID>` |

---

### Multi-Environment Patterns — Modules

For managing dev, staging, and prod environments, extract common patterns into modules:

```hcl
module "pipeline_env" {
  source     = "./modules/pipeline-env"
  env        = "prod"
  project_id = var.project_id
  region     = var.region
}
```

Each module encapsulates Pub/Sub topics, BigQuery datasets, service accounts, and IAM bindings for one environment. Promote from dev → staging → prod by applying the same module with different variables. Never copy-paste `.tf` files between environments.

See [[terraform-module-composition]] for module design patterns.

---

## GCP Resources from Chapter 21

The following patterns cover additional GCP resources commonly managed with Terraform:

#### google_pubsub_topic, google_pubsub_subscription — Pub/Sub resources

```hcl
# pubsub.tf — event-driven messaging for pipeline orchestration
resource "google_pubsub_topic" "pipeline_events" {
  name = "pipeline-events"

  message_retention_duration = "604800s"  # 7 days
  message_storage_policy {
    allowed_persistence_regions = [var.region]
  }
}

resource "google_pubsub_topic" "dead_letter" {
  name = "pipeline-events-dead-letter"
}

resource "google_pubsub_subscription" "pipeline_push" {
  name  = "pipeline-events-push"
  topic = google_pubsub_topic.pipeline_events.id

  push_config {
    push_endpoint = google_cloud_run_v2_service.pipeline_handler.uri
    oidc_token {
      service_account_email = google_service_account.pubsub_invoker.email
    }
  }

  ack_deadline_seconds       = 60
  message_retention_duration = "604800s"

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dead_letter.id
    max_delivery_attempts = 5
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "300s"
  }
}
```

#### google_bigquery_dataset, google_bigquery_table — BigQuery resources

```hcl
# bigquery.tf — data warehouse layer
resource "google_bigquery_dataset" "bronze" {
  dataset_id    = "bronze"
  friendly_name = "Bronze Layer — Raw Data"
  location      = "EU"

  default_table_expiration_ms    = null  # no auto-expiration
  default_partition_expiration_ms = null

  access {
    role          = "WRITER"
    special_group = "projectWriters"
  }
  access {
    role          = "READER"
    user_by_email = google_service_account.dashboard.email
  }
}

resource "google_bigquery_dataset" "silver" {
  dataset_id    = "silver"
  friendly_name = "Silver Layer — Cleaned Data"
  location      = "EU"
}

resource "google_bigquery_dataset" "gold" {
  dataset_id    = "gold"
  friendly_name = "Gold Layer — Business-Ready"
  location      = "EU"
}

resource "google_bigquery_table" "daily_ohlcv" {
  dataset_id          = google_bigquery_dataset.silver.dataset_id
  table_id            = "daily_ohlcv"
  deletion_protection = true

  time_partitioning {
    type  = "DAY"
    field = "trade_date"
  }

  clustering = ["index_key", "symbol"]

  schema = file("schemas/daily_ohlcv.json")
}
```

#### provider "google" + backend "gcs" — main.tf root module configuration

```hcl
# main.tf — root module
terraform {
  required_version = ">= 1.6"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  backend "gcs" {
    bucket = "data-pipeline-terraform-state"
    prefix = "prod"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

variable "project_id" {
  description = "GCP project ID"
  type        = string
  default     = "data-platform-prod"
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "europe-west1"
}
```

## Related

- [[terraform-state-management]] — remote state, locking, and state manipulation commands
- [[terraform-variables-and-outputs]] — how variables are defined and consumed
- [[terraform-module-composition]] — multi-environment module patterns
- [[terraform-providers-and-backend]] — the backend "gcs" configuration
- [[terraform-resource-dependencies]] — how Terraform orders resource creation

## References

- [Terraform CLI Commands](https://developer.hashicorp.com/terraform/cli/commands)
- [Terraform import](https://developer.hashicorp.com/terraform/cli/import)
