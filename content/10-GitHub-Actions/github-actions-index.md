---
type: index
category: github-actions
technology: [github-actions, gcp, docker, terraform, dbt]
tags: [ci-cd, terraform, docker, dbt, gcp, github-actions]
aliases: [GitHub Actions Index, CI/CD Index, GitHub Actions Section]
keywords: [github actions, ci/cd, workflows, automation, matrix builds, reusable workflows, deployment, cloud run, wif, workload identity, dbt, secrets, caching, runners, triggers]
description: "Index for the GitHub Actions section — workflow anatomy, CI/CD patterns, data engineering pipelines, deployment automation, and real-world workflow examples."
related:
  - "[[index|Elysium]]"
  - "[[git-index]]"
  - "[[dataops-index]]"
  - "[[terraform-index]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# GitHub Actions

GitHub Actions is the automation platform built into GitHub — it runs CI/CD pipelines, tests code on every pull request, builds and pushes Docker images, and deploys infrastructure. For data engineering teams, it is the glue between code reviews and production deployments.

### Workflow Foundations

> [!info] Workflow Anatomy and Triggers
>
> [[github-actions-fundamentals]] — Workflow anatomy, event triggers (`push`, `pull_request`, `schedule`, `workflow_dispatch`), runner types (`ubuntu-latest`, self-hosted), secrets and variables, caching strategies, permissions.

> [!bug] Common Trigger Anti-Pattern
>
> Using `on: push` without path filters runs the workflow on EVERY push to EVERY file. A README typo triggers a 10-minute CI pipeline. Always scope triggers: `on: push: paths: ['src/**', 'tests/**']`. See [[github-actions-patterns#Path Filtering (Skip Unaffected Jobs)]].

### Patterns and Architecture

> [!example] Reusable Patterns and Matrix Builds
>
> [[github-actions-patterns]] — Matrix builds for multi-version testing, reusable workflows (`workflow_call`), composite actions, deployment patterns (environments, approval gates, rollbacks).

> [!failure] Matrix Explosion Anti-Pattern
>
> A `matrix: {python: [3.10, 3.11, 3.12], os: [ubuntu, windows, macos]}` creates 9 jobs. Add `node: [18, 20]` and it's 18 jobs. Each job has cold-start overhead (~30s) and consumes runner minutes. Only matrix the dimensions that actually differ in behavior — most data pipelines only need one OS and one Python version.

### Data Engineering Pipelines

> [!success] Pipeline CI/CD for Data Teams
>
> [[github-actions-data-engineering]] — Pipeline CI (lint, test, type-check), Cloud Run CD (build, push, deploy), dbt CI (compile, test, docs), Workload Identity Federation (WIF) for keyless GCP auth.

> [!danger] Secrets in Workflow Logs
>
> `echo ${{ secrets.SA_PASSWORD }}` prints the secret to the workflow log — GitHub masks it, but only if the exact string appears. Substring matches, base64-encoded versions, or secrets embedded in JSON payloads are NOT masked. Never echo secrets. Never pass them as command-line arguments (visible in `ps`). Use environment variables or file-based injection.

### Reference

> [!quote] Workflow Templates and CI/CD Reference
>
> - [[github-actions-ci-cd]] — General CI/CD reference: triggers, secrets, matrix builds, Cloud Run deploy, Terraform CI, troubleshooting
> - [[github-actions-workflows]] — Complete, copy-paste workflow definitions for common data engineering scenarios

> [!question] Which Workflow File to Start From?
>
> - **First CI pipeline?** → Start with [[github-actions-fundamentals]] for the anatomy, then copy a template from [[github-actions-workflows]]
> - **Multi-environment deploy?** → [[github-actions-patterns#Multi-Environment Deployment]]
> - **dbt in CI?** → [[github-actions-data-engineering]]
> - **Keyless GCP auth?** → [[github-actions-data-engineering]] (WIF section)

### Key Concepts

> [!abstract] Reading Order
>
> 1. **[[github-actions-fundamentals]]** — Start here: how workflows are structured
> 2. **[[github-actions-patterns]]** — Reusable workflow and matrix build patterns for large repos
> 3. **[[github-actions-data-engineering]]** — Real pipeline CI/CD with Workload Identity Federation (no long-lived keys)
> 4. **[[github-actions-workflows]]** — Ready-to-use workflow templates

### Cross-References

- **Git** — [[git-index]] for branching strategies that feed into CI triggers
- **Terraform** — [[terraform-registry-and-ci]] provisions the CI service account and Artifact Registry
- **Docker** — [[image-management]] for the build/push steps that Actions automates
- **GCP** — [[service-accounts-and-iam]] and Workload Identity Federation for keyless auth
- **DataOps** — [[dataops-index]] for DataOps principles and team practices

> *This table renders in Obsidian via Dataview. On the web, browse the notes listed above or use the Explorer sidebar.*
