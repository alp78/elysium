---
type: concept
category: terraform
technology: [terraform, gcp, gcs]
tags: [infrastructure, terraform, gcp]
aliases: [terraform provider, terraform backend, GCS backend, terraform GCS, google provider, remote state backend]
keywords: [terraform provider, hashicorp google, backend gcs, remote state, state file, tfstate, gcs bucket, pessimistic constraint, version constraint, provider configuration, terraform init]
description: "How to configure the Terraform Google provider and GCS remote state backend — version constraints, project defaults, and why remote state matters."
related: [hcl-syntax-basics, terraform-state-management, terraform-variables-and-outputs, terraform-plan-apply-destroy]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Terraform Providers and Backend

The provider block tells Terraform which cloud platform to manage, and the backend block tells it where to store its state file. Together, they form the foundation of every Terraform configuration.

## Provider and Backend Configuration

#### provider "google" + backend "gcs" — main.tf full configuration
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

provider "google" {
  project = var.project_id
  region  = var.region
}
```

## The `terraform` Block

The top-level configuration block. Not a resource — it tells Terraform about itself.

| Field | Value | Meaning |
|-------|-------|---------|
| `required_version` | `>= 1.5` | Minimum Terraform CLI version. Prevents running with an older binary that might not support the syntax used here. |

## The `required_providers` Block

Declares external provider plugins that Terraform must download before it can manage resources.

| Field | Value | Meaning |
|-------|-------|---------|
| `source` | `hashicorp/google` | The official Google Cloud provider, published in the Terraform Registry by HashiCorp. Terraform downloads this plugin automatically on `terraform init`. |
| `version` | `~> 6.0` | **Pessimistic constraint** — allows `6.x` but not `7.0`. The `~>` operator permits only the rightmost digit to increment: `6.0`, `6.1`, `6.99` are all valid, but `7.0` is not. This prevents breaking changes from a major version bump while still receiving minor updates. |

> [!tip] Version Constraint Operators
> - `= 6.0.0` — exact version only
> - `>= 1.5` — any version 1.5 or higher
> - `~> 6.0` — pessimistic: allows 6.x, blocks 7.0
> - `>= 5.0, < 7.0` — range constraint

## The `backend "gcs"` Block

Tells Terraform to store its **state file** remotely in a Google Cloud Storage bucket instead of on disk.

| Field | Value | Meaning |
|-------|-------|---------|
| `bucket` | `data-pipeline-tf-state` | The GCS bucket name. This bucket must exist before `terraform init` — Terraform does not create it. It holds `terraform.tfstate`, the JSON file that maps every resource in these `.tf` files to its real GCP counterpart. |
| `prefix` | `terraform/state` | A path prefix inside the bucket. The actual state file is stored at `terraform/state/default.tfstate`. Using a prefix allows multiple Terraform configurations to share one bucket without colliding. |

> [!warning] The Backend Bucket Must Exist First
> The `backend` block is **exclusively** for storing the `.tfstate` file. It has nothing to do with providers, resources, or any other Terraform concept. The GCS bucket must be created manually (or by a separate Terraform config) before running `terraform init`.

### Why Remote State?

If the state file is local, only one machine can run `terraform apply`. With GCS backend, the state is centralized and locked during operations — preventing concurrent modifications. It also means the state survives if your laptop dies.

#### Backend configuration variant — alternative naming pattern
```hcl
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

## The `provider "google"` Block

Configures the Google provider with default values applied to all resources.

| Field | Value | Meaning |
|-------|-------|---------|
| `project` | `var.project_id` | The GCP project ID (e.g., `data-platform-prod`). Every resource is created in this project unless overridden. References the variable defined in `variables.tf`. |
| `region` | `var.region` | Default region for regional resources. Set to `europe-west1` (Belgium) by default. Individual resources can override this. |

## Related

- [[hcl-syntax-basics]] — The language these blocks are written in
- [[terraform-state-management]] — Deep dive on the state file the backend stores
- [[terraform-variables-and-outputs]] — The variables referenced by `var.project_id` and `var.region`
- [[terraform-plan-apply-destroy]] — The workflow that uses the provider and backend

## References

- [Terraform GCS Backend Documentation](https://developer.hashicorp.com/terraform/language/settings/backends/gcs)
- [Google Provider Documentation](https://registry.terraform.io/providers/hashicorp/google/latest/docs)
