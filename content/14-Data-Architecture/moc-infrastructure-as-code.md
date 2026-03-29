---
type: index
category: data-architecture
technology: [terraform, gcp, github-actions]
tags: [data-architecture, architecture, terraform, gcp, github-actions]
aliases: [Infrastructure as Code MOC, IaC MOC, Terraform MOC]
keywords: [infrastructure as code, iac, terraform, gcp, provisioning, networking, compute, iam, cloud run, ci/cd, deployment]
description: "Map of Content for Infrastructure as Code — Terraform fundamentals, GCP resource provisioning, patterns, and CI/CD integration."
related:
  - "[[index|Elysium]]"
  - "[[terraform-cheat-sheet]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
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

- the destroy and rebuild runbook — Terraform destroy and rebuild workflow
- the fresh project setup runbook — From-scratch GCP project provisioning
- cost reference — Infrastructure cost breakdown

## CI/CD Integration

- [[github-actions-workflows]] — Terraform in CI/CD pipelines
- [[github-actions-ci-cd]] — project-specific deployment workflows
