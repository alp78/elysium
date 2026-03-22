---
tags: [adr, airflow, gcp]
type: reference
status: accepted
updated: 2026-03-23
---

# ADR-002: Self-Hosted Airflow on Docker Compose

## Status
Accepted | 2026-03-23

## Context
The platform needs a pipeline orchestrator for 10-20 DAGs with dependencies, retries, and scheduling. Options: self-hosted Airflow, Cloud Composer, or Cloud Scheduler + Cloud Run.

## Decision
Run Airflow on Docker Compose on a dedicated Compute Engine VM.

**Why:**
- Cloud Composer minimum ~$300/month; self-hosted on e2-standard-2 is ~$50/month
- Full control over Airflow version, plugins, and Python dependencies
- Docker Compose simplifies deployment: scheduler, webserver, worker in one stack
- Team has Docker expertise; configuration is version-controlled

## Consequences
- **Easier:** Low cost, full control, fast iteration
- **Harder:** Self-managed upgrades, no auto-scaling, single-VM SPOF
- **Migration path:** Can move to Cloud Composer if team grows or DAGs exceed 50+

## Alternatives Considered
- **Cloud Composer:** Fully managed but minimum ~$300/month, slow environment updates, opinionated dependency management
- **Cloud Scheduler + Cloud Run:** Simple and serverless but no DAG dependency graph, no retry logic, no UI

## Related
- [[orchestration-index]]
- [[airflow-core-concepts]]
- [[airflow-deployment]]
