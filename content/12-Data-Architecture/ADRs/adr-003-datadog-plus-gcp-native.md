---
tags: [adr, datadog, gcp, observability]
type: reference
status: accepted
updated: 2026-03-23
---

# ADR-003: Dual Observability — Datadog + GCP Native

## Status
Accepted | 2026-03-23

## Context
The platform needs monitoring across SQL Server VMs, Airflow, Cloud Run, BigQuery, and Pub/Sub. Options: Datadog only, GCP Cloud Monitoring only, or both.

## Decision
Use both Datadog (for SQL Server and Airflow deep monitoring) and GCP Cloud Monitoring (for GCP-native services).

**Why:**
- Datadog provides superior SQL Server integration (wait stats, query plans, custom queries, APM)
- GCP Cloud Monitoring is free for GCP metrics and integrates natively with Cloud Run, BigQuery, Pub/Sub
- Datadog APM provides end-to-end trace correlation across Python pipelines
- GCP alerts on infrastructure are simpler and cheaper via Cloud Monitoring

## Consequences
- **Easier:** Best-of-breed monitoring for each component
- **Harder:** Two dashboards, two alert systems, potential alert fatigue
- **Cost:** Datadog adds ~$30-50/month; justified by SQL Server deep integration

## Alternatives Considered
- **Datadog only:** Covers everything but GCP-native metrics require extra integration
- **GCP only:** Free and native but lacks SQL Server deep integration and APM
- **Prometheus + Grafana:** Flexible but requires managing another stack

## Related
- [[observability-index]]
- [[datadog-architecture-overview]]
