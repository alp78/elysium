---
type: index
category: docker
technology: [docker]
tags: [docker]
aliases: [Docker Index, Docker Section, Containers Index]
keywords: [docker, containers, docker compose, image management, container lifecycle, dockerfile, multi-stage build, artifact registry]
description: "Index for all Docker notes covering container lifecycle management, Docker Compose orchestration, and image building and registry operations."
related:
  - "[[index|Elysium]]"
  - "[[terraform-cloud-run]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Docker

Docker packages applications into containers — lightweight, portable units that include everything needed to run: code, runtime, libraries, and configuration. For data engineering, Docker is how pipeline code ships from a developer's laptop to Cloud Run, Airflow, or any orchestrator.

## Notes

| Note | Description |
|------|-------------|
| [[container-lifecycle]] | Run, stop, start, restart, logs, exec, stats, inspect — full container management |
| [[docker-compose]] | Multi-container orchestration with `docker compose up/down`, rebuild, log tailing, cleanup |
| [[image-management]] | Building images, multi-stage Dockerfiles, tagging, pushing to Artifact Registry |

See also: [[docker-cheat-sheet]]

## Key Concepts

- **[[container-lifecycle]]** — Understand the full lifecycle before debugging production containers
- **[[image-management]]** — Multi-stage builds are essential for keeping pipeline images small
- **[[docker-compose]]** — The local development equivalent of Cloud Run + Airflow

## Cross-References

- **Terraform** — [[terraform-cloud-run]] provisions Cloud Run services that run Docker images
- **CI/CD** — [[github-actions-ci-cd]] builds and pushes Docker images on merge
- **the data pipeline project** — the project architecture shows how Docker containers flow through the pipeline
- **Observability** — [[datadog-agent-airflow-vm]] runs the Datadog agent as a Docker container

> *This table renders in Obsidian via Dataview. On the web, browse the notes listed above or use the Explorer sidebar.*
