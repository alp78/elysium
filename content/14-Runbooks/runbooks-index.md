---
tags: [index, runbooks]
type: index
technology: []
status: stable
updated: 2026-03-23
---

# Runbooks

Operational runbooks for the data platform. Each runbook is a step-by-step procedure for diagnosing and resolving a specific incident type, calibrated to the financial index and ESG data provider domain.

## Severity Definitions

| Severity | Definition | Response SLA | Example |
|----------|-----------|-------------|---------|
| **Sev1** | Index publication at risk | 15 minutes | Calculation pipeline failure, SQL Server disk full |
| **Sev2** | Data quality degraded but publication possible | 1 hour | ESG circuit breaker, BigQuery quota, missed corporate action |
| **Sev3** | Non-urgent operational issue | Next business day | Vendor file late, scheduled drill |

## Runbooks

| Runbook | Severity | Trigger |
|---------|----------|---------|
| [[index-calculation-failure]] | Sev1 | Daily index calculation pipeline fails before publication window |
| [[esg-circuit-breaker-fired]] | Sev2 | ESG normalization circuit breaker halts publication |
| [[sql-server-disk-full]] | Sev1 | SQL Server VM disk at >95% |
| [[bigquery-quota-exceeded]] | Sev2 | BigQuery slots exhausted or billing spike |
| [[airflow-scheduler-down]] | Sev1 | Airflow scheduler container not running |
| [[pubsub-dead-letter-backup]] | Sev2 | Dead letter topic accumulating messages |
| [[data-restatement-procedure]] | Sev1 | Published index values need correction |
| [[corporate-action-missed]] | Sev2 | Stock split/merger/dividend not applied |
| [[vendor-file-late-or-missing]] | Sev3 | Data vendor has not delivered by SLA |
| [[backup-restore-drill]] | Sev3 | Periodic backup validation (scheduled) |

## Getting Started

Start with [[on-call-guide]] for severity definitions, the first-5-minutes checklist, escalation matrix, and communication templates.

## Related

- [[observability-index]] — Monitoring and alerting setup
- [[compliance-and-auditability]] — EU BMR audit trail
- [[dataops-for-indices]] — Incident response framework
- [[esg-data-ingestion-framework]] — Circuit breaker details
