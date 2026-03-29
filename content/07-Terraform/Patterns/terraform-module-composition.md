---
type: concept
category: infrastructure
technology: [terraform]
tags: [infrastructure, terraform, iac]
aliases: [terraform modules, terraform module composition, multi-environment terraform, terraform workspaces, DRY terraform]
keywords: [terraform modules, module composition, multi-environment, dev staging prod, module source, module variables, module outputs, terraform workspaces, DRY infrastructure, environment promotion, reusable modules]
description: "How to use Terraform modules to create reusable, composable infrastructure for multiple environments (dev, staging, prod), avoiding copy-paste between configurations."
related:
  - "[[terraform-variables-and-outputs]]"
  - "[[terraform-plan-apply-destroy]]"
  - "[[terraform-resource-dependencies]]"
  - "[[hcl-syntax-basics]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Terraform Module Composition

Terraform modules are the primary mechanism for creating reusable, composable infrastructure. When you manage multiple environments (dev, staging, prod), modules prevent copy-paste between configurations and enable environment promotion.

### The Core Principle

> Never copy-paste `.tf` files between environments. Extract common patterns into modules. Promote from dev → staging → prod by applying the same module with different variables.

Without modules, you end up with nearly identical `dev/` and `prod/` directories that diverge over time. A bug fixed in `prod` may not get back-ported to `dev`. A new resource added to `dev` may never reach `prod`. Modules force the configurations to stay in sync.

---

## Module Basics

A module is just a directory of `.tf` files. The **root module** is the directory where you run `terraform apply`. **Child modules** are called with a `module` block:

```hcl
module "pipeline_env" {
  source     = "./modules/pipeline-env"
  env        = "prod"
  project_id = var.project_id
  region     = var.region
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| `source` | `"./modules/pipeline-env"` | Path to the module directory (relative to the calling `.tf` file). Can also be a Git URL or Terraform Registry address. |
| `env` | `"prod"` | An input variable that the module's `variables.tf` defines. Passed to the module. |
| `project_id`, `region` | From parent variables | Forwarded from the root module's own variables. |

---

## Module Directory Structure

```
infra/
├── main.tf                   # Root module — calls child modules
├── variables.tf              # Root input variables
├── outputs.tf                # Root outputs
├── terraform.tfvars          # Variable values (gitignored)
│
└── modules/
    ├── pipeline-env/         # Module for one environment's pipeline infra
    │   ├── main.tf           # Resources: Pub/Sub, BigQuery, Cloud Run job
    │   ├── variables.tf      # Input variables: env, project_id, region
    │   └── outputs.tf        # Outputs: job_name, dataset_ids
    │
    └── networking/           # Module for VPC + subnet + NAT
        ├── main.tf           # Resources: VPC, subnet, router, NAT
        ├── variables.tf      # Input: project_id, region, cidr
        └── outputs.tf        # Output: subnet_id, network_id
```

---

## Multi-Environment with Modules

### Root main.tf — calling the module for each environment

```hcl
# main.tf — root module
module "dev" {
  source     = "./modules/pipeline-env"
  env        = "dev"
  project_id = var.project_id
  region     = var.region
}

module "prod" {
  source     = "./modules/pipeline-env"
  env        = "prod"
  project_id = var.project_id
  region     = var.region
}
```

### Module variables.tf

```hcl
# modules/pipeline-env/variables.tf
variable "env" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "europe-west1"
}
```

### Module main.tf — parameterized by env

```hcl
# modules/pipeline-env/main.tf
resource "google_bigquery_dataset" "pipeline" {
  dataset_id    = "pipeline_${var.env}"
  friendly_name = "Pipeline — ${title(var.env)}"
  location      = "EU"
}

resource "google_pubsub_topic" "events" {
  name = "pipeline-events-${var.env}"

  labels = {
    environment = var.env
    managed-by  = "terraform"
  }
}

resource "google_cloud_run_v2_job" "pipeline" {
  name     = "pipeline-${var.env}"
  location = var.region

  template {
    template {
      containers {
        image = "${var.region}-docker.pkg.dev/${var.project_id}/pipeline/runner:latest"

        env {
          name  = "ENV"
          value = var.env
        }

        env {
          name  = "BQ_DATASET"
          value = google_bigquery_dataset.pipeline.dataset_id
        }
      }
    }
  }
}
```

### Module outputs.tf

```hcl
# modules/pipeline-env/outputs.tf
output "job_name" {
  value = google_cloud_run_v2_job.pipeline.name
}

output "dataset_id" {
  value = google_bigquery_dataset.pipeline.dataset_id
}

output "topic_name" {
  value = google_pubsub_topic.events.name
}
```

### Accessing module outputs in root

```hcl
# root outputs.tf
output "prod_job_name" {
  value = module.prod.job_name
}

output "dev_dataset_id" {
  value = module.dev.dataset_id
}
```

---

### Environment Promotion Pattern

With modules, promoting infrastructure from dev to prod is a variable change:

```bash
# Apply dev environment
terraform apply -var="env=dev"

# Test and validate dev

# Apply prod environment (same code, different variable)
terraform apply -var="env=prod"
```

Or with separate workspace directories:

```
environments/
├── dev/
│   ├── main.tf     # calls module with env = "dev"
│   └── terraform.tfvars
└── prod/
    ├── main.tf     # calls module with env = "prod"
    └── terraform.tfvars
```

Each environment has its own state file, providing complete isolation.

---

### Terraform Registry Modules

Terraform modules can also be sourced from the public registry:

```hcl
module "gcs_buckets" {
  source  = "terraform-google-modules/cloud-storage/google"
  version = "~> 5.0"

  project_id = var.project_id
  names      = ["data-bronze", "data-silver", "data-gold"]
  location   = var.region
}
```

> [!tip] Use Community Modules Carefully
>
> Terraform Registry modules are useful for standard patterns (GCS buckets, VPCs) but add an external dependency. Pin to a version range (`~> 5.0`) to avoid unexpected breaking changes. For core infrastructure, writing your own modules gives you full understanding and control.

---

### When to Extract a Module

Extract code into a module when:
1. The same pattern appears in 2+ configurations
2. A group of resources forms a logical unit (e.g., "a pipeline environment" = BigQuery + Pub/Sub + Cloud Run)
3. You want to provide a stable interface to a complex configuration

> [!tip] Related pattern
>
> Module composition in Terraform mirrors [[18_py_designpatterns|software design patterns]] like facade (a module hides complexity behind a simple interface) and composition over inheritance (combining small modules rather than building monolithic configs).

Do NOT extract when:
- It's only used once
- The extraction adds complexity without reuse benefit
- The module's inputs/outputs would be nearly identical to the resource's own arguments

---

### Gotchas and Edge Cases

**Module refactoring destroys resources:** If you move resources into or out of a module, Terraform sees them as new resources (different addresses). Use `terraform state mv` to move them in state before running `apply`:

```bash
# Move a resource into a module without destroying it
terraform state mv google_bigquery_dataset.bronze module.dev.google_bigquery_dataset.pipeline
```

**Module source changes require `terraform init`:** Adding a new module or changing a module's `source` requires running `terraform init` again to download/update the module.

**Circular module references are not allowed:** Module A cannot call Module B if Module B calls Module A. Terraform will detect this and fail with an error.

## Related

- [[terraform-variables-and-outputs]] — module inputs and outputs use the same variable system
- [[terraform-plan-apply-destroy]] — the workflow for applying multi-environment configs
- [[terraform-state-management]] — each environment should have its own state
- [[terraform-resource-dependencies]] — dependencies within and across modules

## References

- [Terraform Modules](https://developer.hashicorp.com/terraform/language/modules)
- [Module Composition](https://developer.hashicorp.com/terraform/language/modules/develop/composition)
- [Terraform Registry](https://registry.terraform.io/)
