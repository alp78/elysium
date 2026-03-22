---
tags: [index, adr, data-architecture]
type: index
technology: []
status: stable
updated: 2026-03-23
---

# Architecture Decision Records

ADRs document significant architectural decisions with context, rationale, and consequences. They are immutable once accepted — if a decision changes, a new ADR supersedes the old one.

| ADR | Decision | Status |
|-----|----------|--------|
| [[adr-001-sql-server-on-gce]] | SQL Server on Compute Engine over Cloud SQL or PostgreSQL | Accepted |
| [[adr-002-self-hosted-airflow]] | Self-hosted Airflow over Cloud Composer | Accepted |
| [[adr-003-datadog-plus-gcp-native]] | Dual observability: Datadog + GCP native monitoring | Accepted |
| [[adr-004-medallion-over-data-vault]] | Medallion architecture over Data Vault 2.0 | Accepted |
| [[adr-005-python-csharp-dual-stack]] | Python + C# dual language stack | Accepted |

## Related

- [[golden-rules-of-data-engineering]] — Principles guiding these decisions
- [[technology-selection-matrices]] — Decision frameworks
- [[data-architecture-index]] — Full architecture section
