---
title: "MOC: GitHub Actions"
tags:
  - moc
  - github-actions
  - ci-cd
---

# MOC: GitHub Actions

GitHub Actions automates build, test, and deployment workflows triggered by repository events. These notes cover everything from YAML workflow anatomy and trigger configuration through production-grade CI/CD patterns for data engineering teams deploying to GCP.

## Workflow Fundamentals — Syntax, Triggers, and Core Mechanics

How GitHub Actions works: workflow file structure, event triggers, runners, jobs, steps, secrets, caching, artifacts, and concurrency controls.

* [[github-actions-fundamentals]] — workflow YAML anatomy, trigger events (push, PR, schedule, dispatch), runners, jobs and steps, secrets management, caching with actions/cache, artifacts, and concurrency groups

* [[github-actions-ci-cd]] — connecting triggers to Git events, monitoring runs with the GitHub CLI (gh run list/view/watch), secrets management at repo and org level, and common CI/CD trigger patterns for data teams

* [[github-actions-workflows]] — end-to-end CI/CD workflow structure for data engineering, Workload Identity Federation for keyless GCP auth, Docker build-and-push to Artifact Registry, Cloud Run deployment, and matrix testing

## CI/CD Patterns and Data Engineering — Advanced Workflows and Automation

Reusable patterns for production pipelines: matrix builds, composite actions, environment protection, Terraform automation, dbt CI, data quality gates, and troubleshooting common problems.

* [[github-actions-patterns]] — matrix builds across Python versions and OS, reusable workflows with workflow_call, composite actions, environment protection rules, Terraform plan/apply automation, Docker build patterns, monorepo path filters, release automation, and cost optimization

* [[github-actions-data-engineering]] — Python pipeline CI (lint + test), Cloud Run CD, dbt CI with slim builds, BigQuery dry-run SQL validation, Airflow DAG import checks, data quality gates with Great Expectations, Workload Identity Federation setup, Slack notifications, and cost monitoring

* [[github-actions-problems]] — 20 production problems ranked by severity including supply chain attacks via pull_request_target, secret exposure, workflow injection, YAML untestability, cache misses, runner inconsistencies, matrix explosion, and action pinning strategies
