---
type: index
category: github-actions
technology: [github-actions, gcp, docker, terraform, dbt]
tags: [ci-cd, terraform, docker, dbt, gcp, github-actions]
aliases: [GitHub Actions Index, CI/CD Index, GitHub Actions Section]
keywords: [github actions, ci/cd, workflows, automation, matrix builds, reusable workflows, deployment, cloud run, wif, workload identity, dbt, secrets, caching, runners, triggers]
description: "Index for the GitHub Actions section — workflow anatomy, CI/CD patterns, data engineering pipelines, deployment automation, and real-world workflow examples."
related:
  - "[[Dashboard]]"
  - "[[git-index]]"
  - "[[engineering-practice-index]]"
  - "[[terraform-index]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# GitHub Actions

GitHub Actions is the automation platform built into GitHub — it runs CI/CD pipelines, tests code on every pull request, builds and pushes Docker images, and deploys infrastructure. For data engineering teams, it is the glue between code reviews and production deployments.

## Workflow Foundations

| Note | Description |
|------|-------------|
| [[github-actions-fundamentals]] | Workflow anatomy, event triggers (push, pull_request, schedule, workflow_dispatch), runner types (ubuntu, self-hosted), secrets and variables, caching strategies, permissions |

## Patterns and Architecture

| Note | Description |
|------|-------------|
| [[github-actions-patterns]] | Matrix builds for multi-version testing, reusable workflows (workflow_call), composite actions, deployment patterns (environments, approvals, rollbacks) |

## Data Engineering Pipelines

| Note | Description |
|------|-------------|
| [[github-actions-data-engineering]] | Pipeline CI (lint, test, type-check), Cloud Run CD (build, push, deploy), dbt CI (compile, test, docs), Workload Identity Federation (WIF) for keyless GCP auth |

## Reference

| Note | Description |
|------|-------------|
| [[github-actions-ci-cd]] | General CI/CD reference — triggers, secrets, matrix builds, Cloud Run deploy, Terraform CI, troubleshooting |
| [[github-actions-workflows]] | Workflow examples — complete, copy-paste workflow definitions for common data engineering scenarios |

## Key Concepts

- **[[github-actions-fundamentals]]** — Start here to understand how workflows are structured
- **[[github-actions-patterns]]** — The reusable workflow and matrix build patterns used across large repos
- **[[github-actions-data-engineering]]** — Real pipeline CI/CD with Workload Identity Federation (no long-lived keys)
- **[[github-actions-workflows]]** — Ready-to-use workflow templates

## Cross-References

- **Git** — [[git-index]] for branching strategies that feed into CI triggers
- **Terraform** — [[terraform-registry-and-ci]] provisions the CI service account and Artifact Registry
- **Docker** — [[image-management]] for the build/push steps that Actions automates
- **GCP** — [[service-accounts-and-iam]] and Workload Identity Federation for keyless auth
- **Engineering Practice** — [[engineering-practice-index]] for broader engineering practices

> *This table renders in Obsidian via Dataview. On the web, browse the notes listed above or use the Explorer sidebar.*
