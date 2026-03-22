---
type: index
category: orchestration
technology: [airflow, python, gcp, linux, powershell]
tags: [index, orchestration, scheduling, airflow]
aliases: [Orchestration Index, Scheduling Index, Airflow Index, Pipeline Scheduling]
keywords: [orchestration, airflow, cron, scheduling, DAGs, automation, task scheduler, cloud scheduler, cloud composer, systemd timer, pipeline automation, workflow, data pipeline scheduling]
description: "Index for the Orchestration section — task scheduling on Linux (cron, systemd timers), Windows (Task Scheduler), and GCP (Cloud Scheduler, Workflows), plus comprehensive Apache Airflow coverage."
related:
  - "[[Dashboard]]"
  - "[[data-architecture-index]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Orchestration — Scheduling and Workflow Management

Orchestration is the control plane that decides **when** pipelines run, **in what order**, and **what happens when they fail**. This section covers scheduling at every level — from OS-level cron to managed cloud services to full DAG-based workflow engines.

## Scheduling

Platform-specific task scheduling — when you need to run commands on a timer.

| Note | Description |
|------|-------------|
| [[linux-scheduling]] | Cron, crontab, systemd timers, anacron, at/batch, SSH configuration, flock overlap prevention |
| [[windows-scheduling]] | Task Scheduler, schtasks, PowerShell ScheduledTasks module, event-based triggers |
| [[gcp-scheduling]] | Cloud Scheduler, Cloud Tasks, Cloud Workflows, Cloud Run Job triggers, Cloud Functions |

## Airflow

Apache Airflow — the industry-standard workflow orchestrator for data pipelines.

| Note | Description |
|------|-------------|
| [[airflow-core-concepts]] | Architecture, DAGs, operators, sensors, hooks, XComs, TaskFlow API, executors |
| [[airflow-dag-patterns]] | Task groups, dynamic DAGs, branching, trigger rules, idempotency, backfill, dataset scheduling |
| [[airflow-deployment]] | Docker Compose, self-hosted, Cloud Composer, MWAA, configuration, secrets, monitoring |
| [[airflow-troubleshooting]] | 13+ common errors with fixes, CLI debugging, log analysis, performance tuning |

## Key Concepts

- **[[linux-scheduling]]** — Start here if you just need to run something on a timer
- **[[airflow-core-concepts]]** — Start here if you need dependency-aware pipeline orchestration
- **[[gcp-scheduling]]** — Use Cloud Scheduler when you need managed cron without infrastructure

## Learning Path

1. [[linux-scheduling]] — Understand cron and systemd timers first
2. [[windows-scheduling]] — PowerShell equivalents for Windows environments
3. [[gcp-scheduling]] — Cloud-native scheduling without managing servers
4. [[airflow-core-concepts]] — Learn Airflow architecture and core abstractions
5. [[airflow-dag-patterns]] — Build real pipeline DAGs with branching and task groups
6. [[airflow-deployment]] — Deploy Airflow (Docker, Cloud Composer, or self-hosted)
7. [[airflow-troubleshooting]] — Debug when things go wrong

## When to Use What

| Scheduler | Best For | Complexity |
|-----------|----------|------------|
| **Cron** | Simple, single-machine tasks (backups, health checks) | Minimal |
| **Systemd Timers** | Linux services with dependency and logging needs | Low |
| **Task Scheduler** | Windows-based scheduled tasks | Low |
| **Cloud Scheduler** | Managed cron triggering Cloud Run/Pub/Sub | Low-Medium |
| **Cloud Workflows** | Lightweight multi-step serverless orchestration | Medium |
| **Airflow** | Complex pipelines with dependencies, retries, monitoring | High |
| **Cloud Composer** | Managed Airflow when you don't want to run infrastructure | High (managed) |

## Cross-References

- **Data Architecture** — [[data-architecture-index]] for pipeline patterns that Airflow orchestrates
- **Docker** — [[docker-compose]] for running Airflow locally
- **GCP** — [[cloud-run-jobs-vs-services]] for the serverless targets Airflow triggers
- **Observability** — [[datadog-airflow-observability]] for monitoring Airflow with Datadog
- **CI/CD** — [[github-actions-ci-cd]] for deploying DAGs automatically

```dataview
TABLE type, status, description
FROM "10-Orchestration"
WHERE type != "index"
SORT file.name ASC
```
