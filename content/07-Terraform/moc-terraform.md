---
title: "MOC: Terraform"
tags:
  - moc
  - terraform
  - hcl
  - gcp
---

# MOC: Terraform

Terraform manages the entire GCP infrastructure for the data platform as declarative HCL code. This MOC organizes the section into three domains: the HCL language and core workflow, the GCP resources Terraform provisions, and the reusable patterns that keep configurations maintainable across environments.

## Language & Workflow — HCL Fundamentals and the Plan/Apply Lifecycle

The foundation: how HCL is structured, how providers and backends connect Terraform to GCP and remote state, and the full command lifecycle from init through destroy. Start here if you are new to Terraform.

* [[hcl-syntax-basics]] — blocks, arguments, resource naming, file organization, and the difference between Terraform-internal and GCP names

* [[terraform-providers-and-backend]] — configuring the Google provider, version constraints, and the GCS remote state backend

* [[terraform-variables-and-outputs]] — input variables with types and sensitivity, terraform.tfvars, locals for computed values, and output definitions

* [[terraform-state-management]] — what the state file tracks, remote state in GCS, state locking, and terraform state subcommands for inspection, moves, and removal

* [[terraform-plan-apply-destroy]] — the init/plan/apply/destroy workflow, plan output symbols, targeted applies, importing existing resources, and common error fixes

* [[terraform-cheat-sheet]] — exhaustive CLI reference for every Terraform command, flag, HCL built-in function, and common coding pattern

## GCP Resource Catalog — Networking, Compute, IAM, and Serverless

How each GCP resource type is declared in Terraform. Each page covers the resource blocks, field-by-field explanations, and gcloud verification commands for a production data engineering project. The Block Library pages provide standalone copy-pasteable snippets for rapid prototyping.

* [[terraform-networking]] — VPC, subnet, Cloud Router, Cloud NAT, and five firewall rules controlling SQL, Airflow UI, APM, IAP SSH, and deny-all ingress

* [[terraform-compute]] — GCE VM instances for Airflow (Container-Optimized OS, ephemeral public IP) and SQL Server (Ubuntu, SSD, no public IP), including startup scripts and shielded instance config

* [[terraform-iam-and-secrets]] — service accounts with least-privilege IAM bindings, resource-level vs project-level roles, Secret Manager two-level structure, and conditional Datadog resources

* [[terraform-cloud-run]] — Cloud Run services (dashboard with session affinity and VPC egress) and jobs (pipeline with double-nested template, secret injection, and retry config)

* [[terraform-registry-and-ci]] — Artifact Registry with cleanup policies, the CI/CD service account for GitHub Actions, and act-as IAM bindings

* [[tf-foundation-and-networking]] — block library of copy-pasteable snippets for provider/backend setup, VPC, subnets, Cloud NAT, firewall rules, static IPs, DNS, VPC peering, and Shared VPC

* [[tf-compute-and-storage]] — block library for GCE instances, disks, snapshots, instance templates, managed instance groups, autoscalers, GCS buckets, and bucket IAM

* [[tf-data-services]] — block library for BigQuery datasets, tables, routines, scheduled queries, Firestore databases, and Dataflow jobs

* [[tf-iam-secrets-serverless]] — block library for service accounts, IAM bindings, Secret Manager, Cloud Run v2, Cloud Functions, Cloud Scheduler, Pub/Sub, and Artifact Registry

## Patterns & Composition — Conditionals, Dependencies, Modules, and Problem Solving

Techniques for writing maintainable Terraform at scale: conditionally creating resources, understanding the dependency graph, extracting reusable modules for multi-environment deployments, and diagnosing production failures.

* [[terraform-conditional-resources]] — count for conditional creation, for_each for multiple instances, dynamic blocks, ternary patterns, and the index notation required for conditional references

* [[terraform-resource-dependencies]] — implicit dependencies from resource references, explicit depends_on, the dependency graph, nested attribute traversal, circular dependency resolution, and forced recreation cascades

* [[terraform-module-composition]] — module basics, directory structure, multi-environment patterns with dev/staging/prod, environment promotion, Terraform Registry modules, and when to extract a module

* [[terraform-problems]] — 25 production problems ranked by severity with root cause analysis, impact assessment, prevention protocols, and fix procedures for data engineering teams on GCP

## Cross-References

- [[gcp-projects-and-apis]] — Project management and API enablement that Terraform automates
- [[service-accounts-and-iam]] — Service accounts and IAM roles provisioned by Terraform
- [[cloud-run-jobs-vs-services]] — Cloud Run resources defined in Terraform configurations
- [[container-lifecycle]] — Container images referenced in Cloud Run and Artifact Registry
- [[github-actions-ci-cd]] — CI/CD pipelines that run terraform plan and apply
- [[datadog-architecture-overview]] — Conditional Datadog resources provisioned by Terraform
