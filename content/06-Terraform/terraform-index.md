---
type: index
category: terraform
technology: [terraform, gcp]
tags: [index, terraform, iac, gcp, infrastructure-as-code]
aliases: [Terraform section, Terraform index, IaC section]
keywords: [terraform, infrastructure as code, IaC, HCL, hashicorp, gcp terraform, terraform guide, terraform reference, declarative infrastructure]
description: "Central index for all Terraform notes covering HCL fundamentals, GCP resource provisioning, state management, and infrastructure patterns used in data engineering."
related: [gcp-projects-and-apis, cloud-run-jobs-vs-services, service-accounts-and-iam, terraform-networking]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Terraform — Infrastructure as Code

Terraform declares your infrastructure in `.tf` files that can be version-controlled, reviewed, and reproduced. Instead of clicking through the GCP Console, you write code that defines your VMs, networks, and services — and Terraform creates, updates, or destroys them to match. This section covers everything from HCL syntax to production GCP resource definitions drawn from a real project.

## Fundamentals

Core Terraform concepts, syntax, and workflow — start here if you are new to Terraform.

| Note | Description |
|------|-------------|
| [[hcl-syntax-basics]] | HashiCorp Configuration Language — blocks, arguments, resource naming, file organization |
| [[terraform-providers-and-backend]] | Configuring the Google provider, GCS remote state backend, and version constraints |
| [[terraform-variables-and-outputs]] | Input variables, locals, outputs, tfvars files, sensitive values, and the type system |
| [[terraform-plan-apply-destroy]] | The core workflow — init, plan, apply, destroy — plus state commands and import |
| [[terraform-state-management]] | State files, remote backends, locking, state mv/rm, and why state is sacred |

## GCP Resources

Per-resource-type notes with full HCL definitions, field explanations, and verification commands.

| Note | Description |
|------|-------------|
| [[terraform-networking]] | VPC, subnet, Cloud Router, Cloud NAT, firewall rules, IAP tunnels, and network topology |
| [[terraform-compute]] | GCE virtual machines — Airflow VM (COS) and SQL Server VM (Ubuntu), boot disks, startup scripts, shielded instances |
| [[terraform-iam-and-secrets]] | Service accounts, IAM bindings, Secret Manager secrets, replication policies, conditional Datadog resources |
| [[terraform-cloud-run]] | Cloud Run services and jobs — dashboard, pipeline, setup — VPC access, scaling, secret references |
| [[terraform-registry-and-ci]] | Artifact Registry Docker repository, cleanup policies, CI/CD service account for GitHub Actions |

## Block Library

Pre-built, copy-paste Terraform blocks for common GCP resource combinations. Each file covers a logical grouping of resources that are typically provisioned together.

| Note | Description |
|------|-------------|
| [[tf-foundation-and-networking]] | Provider, backend, VPC, subnets, NAT, firewalls, DNS |
| [[tf-compute-and-storage]] | VMs, instance templates, disks, snapshots, GCS buckets |
| [[tf-iam-secrets-serverless]] | Service accounts, IAM, secrets, Cloud Run, Functions, Scheduler, Pub/Sub |
| [[tf-data-services]] | BigQuery, Firestore, Dataflow, Cloud SQL, monitoring, billing |

## Patterns

Architectural patterns, dependency management, and module composition.

| Note | Description |
|------|-------------|
| [[terraform-conditional-resources]] | The `use_sql_vm` / `dd_api_key` conditional pattern for opt-in resources via count |
| [[terraform-resource-dependencies]] | How Terraform resolves implicit dependencies and the resource creation order |
| [[terraform-module-composition]] | Module structure, input/output contracts, reusable infrastructure patterns |

## Cross-References

- **GCP** — [[gcp-projects-and-apis]], [[service-accounts-and-iam]], [[cloud-run-jobs-vs-services]]
- **Docker** — [[container-lifecycle]] — Container images referenced in Cloud Run and Artifact Registry
- **CI/CD** — [[github-actions-ci-cd]] — The CI service account enables automated deployments
- **Observability** — [[datadog-architecture-overview]] — Conditional Datadog resources provisioned by Terraform
