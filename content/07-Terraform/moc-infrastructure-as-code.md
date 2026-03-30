---
title: "MOC: Infrastructure as Code"
tags:
  - moc
  - terraform
  - gcp
  - github-actions
---

# MOC: Infrastructure as Code

This map connects all Terraform and IaC content, from HCL basics to production GCP resource management.

## Foundations

- [[hcl-syntax-basics]] — Blocks, arguments, file naming
- [[terraform-providers-and-backend]] — Provider config, GCS remote state
- [[terraform-variables-and-outputs]] — Input variables and output values
- [[terraform-plan-apply-destroy]] — Core workflow (init, plan, apply, destroy)
- [[terraform-state-management]] — Remote state, locking, importing

## GCP Resources

Each file in the Terraform configuration manages a specific domain:

- [[terraform-networking]] — VPC, subnet, Cloud NAT, firewall rules
- [[terraform-compute]] — SQL Server VM, Airflow VM, startup scripts
- [[terraform-iam-and-secrets]] — Service accounts, IAM bindings, Secret Manager
- [[terraform-cloud-run]] — Dashboard service, pipeline job, setup job
- [[terraform-registry-and-ci]] — Artifact Registry, CI/CD service account

## Patterns

- [[terraform-conditional-resources]] — count, for_each, toggle patterns
- [[terraform-resource-dependencies]] — Dependency graph and references
- [[terraform-module-composition]] — Multi-environment module patterns

## Operations

- [[environment-management-strategy]] — Dev/staging/prod topology and promotion workflow

## CI/CD Integration

- [[github-actions-workflows]] — Terraform in CI/CD pipelines
- [[github-actions-ci-cd]] — Project-specific deployment workflows
