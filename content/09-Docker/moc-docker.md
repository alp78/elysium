---
title: "MOC: Docker"
tags:
  - moc
  - docker
  - containers
---

# MOC: Docker

Docker packages every pipeline stage, database, and monitoring agent into isolated containers with their own dependencies. This MOC covers the full Docker workflow from building images through running containers to orchestrating multi-service stacks.

## Images & Builds — Dockerfile, Multi-Stage Builds, and Registry Operations

How to create optimized container images, tag them for deployment, and push them to GCP Artifact Registry.

* [[image-management]] — Dockerfile instructions, building with cache and multi-stage patterns, tagging strategies, pushing to Artifact Registry, inspecting layers and image size, and cleaning up disk usage

## Container Operations — Running, Inspecting, Debugging, and Composing

Day-to-day container management: launching containers, reading logs, debugging crashes, and orchestrating multi-container stacks for local development and production.

* [[container-lifecycle]] — docker run with all key flags, listing and filtering containers, start/stop/kill/pause lifecycle, logs, exec for debugging, file copying, inspection, and cleanup with prune

* [[docker-compose]] — compose file structure with a full Airflow + PostgreSQL + Redis example, lifecycle commands (up/down/start/stop/restart), scaling, logs, exec, config overrides, and system cleanup

* [[docker-cheat-sheet]] — exhaustive CLI reference for Docker and Docker Compose covering container lifecycle, image management, volumes, networks, Dockerfile instructions, and system cleanup

## Cross-References

- [[terraform-cloud-run]] — Terraform provisions Cloud Run services that run Docker images
- [[github-actions-ci-cd]] — CI/CD pipelines that build and push Docker images on merge
- [[datadog-agent-airflow-vm]] — Datadog agent runs as a Docker container on the Airflow VM
