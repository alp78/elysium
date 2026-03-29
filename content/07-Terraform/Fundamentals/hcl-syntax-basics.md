---
type: concept
category: terraform
technology: [terraform, hcl]
tags: [infrastructure, terraform, iac]
aliases: [HCL, HashiCorp Configuration Language, HCL syntax, terraform syntax, tf syntax]
keywords: [hcl, hashicorp configuration language, terraform syntax, blocks, arguments, resource block, terraform name, gcp name, file naming, tf files, declarative, infrastructure as code]
description: "HCL (HashiCorp Configuration Language) syntax fundamentals — blocks, arguments, resource naming, file organization, and the difference between Terraform-internal and GCP names."
related: [terraform-providers-and-backend, terraform-variables-and-outputs, terraform-plan-apply-destroy]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# HCL Syntax Basics

HashiCorp Configuration Language (HCL) is a declarative language designed by HashiCorp specifically for infrastructure-as-code. Unlike imperative scripts (bash, Python), you describe _what_ you want and Terraform figures out _how_ to create it. HCL files use the `.tf` extension.

### Blocks and Arguments

HCL has two structural elements:

- **Block** — a container with a type, optional labels, and a body in braces. Example: `resource "google_compute_network" "main" { ... }`. This is a `resource` block with type `google_compute_network` and Terraform-internal name `main`.
- **Argument** — a key-value pair inside a block. Example: `name = "data-pipeline-vpc"`. Sets one property of the resource.

Blocks can be nested. For example, a `resource` block may contain a `template` block, which contains a `containers` block, which contains `env` blocks.

### File Naming and Organization

Terraform merges **all** `.tf` files in a directory into a single configuration. File names have **no impact** on behavior — you could rename `network.tf` to `dodo.tf` and everything would still work. Files are split purely for human readability and organization.

A typical file layout for a GCP project:

| File | Resources | Purpose |
|------|-----------|---------|
| `main.tf` | `terraform`, `provider` | Provider version, GCS backend |
| `variables.tf` | 6 variables | Inputs: project, region, zone, passwords, labels |
| `network.tf` | VPC, subnet, router, NAT, 5 firewall rules | Network isolation and traffic control |
| `compute.tf` | 2 GCE instances | SQL Server VM + Airflow VM |
| `iam.tf` | 3 service accounts, 8 IAM bindings, 4 conditional Datadog bindings | Identity and access management |
| `secrets.tf` | 2 secrets, 2 secret versions | Database password + Datadog API key |
| `registry.tf` | 1 Artifact Registry repository | Docker image storage with cleanup |
| `run.tf` | 1 Cloud Run service, 2 Cloud Run jobs, 1 IAM binding, locals | Dashboard + pipeline + setup |
| `ci.tf` | 1 service account, 4 IAM bindings | GitHub Actions deployment permissions |
| `outputs.tf` | 6 outputs | URLs and IPs for provisioned resources |

## Terraform Name vs GCP Name

Every resource has two names:

#### resource "type" "name" — Terraform-internal name vs GCP name
```hcl
resource "google_compute_firewall" "allow_sql" {   # "allow_sql" = Terraform-internal name
  name = "allow-sql-from-airflow"                          # "allow-sql-from-airflow" = actual name in GCP
}
```

| Name | Where it lives | Used for |
|------|---------------|----------|
| `"allow_sql"` | Terraform only | Referencing this resource in other `.tf` files (e.g., `google_compute_firewall.allow_sql.id`) |
| `"allow-sql-from-airflow"` | GCP | What appears in the Console, `gcloud` commands, and API calls |

They don't have to match.

### Block Types

The `variable` and `output` blocks below are covered in depth in [[terraform-variables-and-outputs]], which extends HCL syntax with parameterization, type constraints, and validation rules.

The most common block types in Terraform:

| Block Type | Purpose | Example |
|------------|---------|---------|
| `terraform` | Top-level configuration — version constraints, backend | `terraform { required_version = ">= 1.5" }` |
| `provider` | Configures a cloud provider | `provider "google" { project = var.project_id }` |
| `resource` | Declares an infrastructure object | `resource "google_compute_network" "main" { ... }` |
| `variable` | Declares an input parameter | `variable "project_id" { type = string }` |
| `output` | Exposes a value after apply | `output "url" { value = resource.uri }` |
| `locals` | Defines computed values | `locals { sql_ip = resource.network_interface[0].network_ip }` |
| `data` | Reads existing infrastructure (not created by this config) | `data "google_project" "current" {}` |

### Declarative vs Imperative

Terraform is declarative: you describe the desired end state, and Terraform computes the steps to reach it. This is fundamentally different from imperative tools like bash scripts or Ansible playbooks, which describe the sequence of actions to perform.

**Declarative (Terraform):** "There should be a VM named data-pipeline-sql with these properties."
**Imperative (bash):** "Run `gcloud compute instances create data-pipeline-sql ...` with these flags."

The declarative approach means Terraform can determine whether a resource already exists, needs updating, or needs to be recreated — and it can handle all three cases automatically.

## Related

- [[terraform-providers-and-backend]] — Configuring where Terraform connects and stores state
- [[terraform-variables-and-outputs]] — Parameterizing HCL with variables, locals, and outputs
- [[terraform-plan-apply-destroy]] — The workflow that turns HCL into real infrastructure
- [[terraform-state-management]] — How Terraform tracks what it has created

## References

- [HCL Native Syntax Specification](https://github.com/hashicorp/hcl/blob/main/hclsyntax/spec.md)
- [Terraform Configuration Language](https://developer.hashicorp.com/terraform/language)
