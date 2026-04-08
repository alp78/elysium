---
title: "MOC: SQL Server"
tags:
  - moc
  - sql-server
  - tsql
  - database
---

# MOC: SQL Server

SQL Server from instance administration through query optimization to
pipeline construction — covering operations, storage internals, T-SQL craft,
performance tuning, security, and the medallion pipeline implementation.
Expand any section to browse page contents.

> [!guide]+ Server Operations
>
> [[domain-server-operations]]
>
> Instance administration from configuration and connectivity through backup strategy, high availability, and production troubleshooting.

> [!guide]+ Storage Internals
>
> [[domain-storage-internals]]
>
> Physical storage from page anatomy and WAL mechanics through index structures, compression, and table partitioning.

> [!guide]+ Query Craft and Performance
>
> [[domain-query-craft]]
>
> T-SQL query writing and performance tuning from SARGability and execution plans through wait stats, memory diagnostics, and pipeline integration.

> [!guide]+ Concurrency and Security
>
> [[domain-concurrency-and-security]]
>
> Authentication hardening, encryption at rest, audit logging, and concurrency control from lock mechanics through deadlock prevention.

> [!guide]+ Pipeline Patterns
>
> [[domain-pipeline-patterns]]
>
> Medallion pipeline implementation from loading strategies and schema layering through change tracking, incremental transforms, and bronze-silver-gold layers.

## Cross-References

- [DB Queries](https://alp78.github.io/elysium/05-DB-Queries/moc-db-queries) — SQL Server query notebooks with executable examples
- [GCP](https://alp78.github.io/elysium/06-GCP/moc-gcp) — SQL Server VMs on Compute Engine
- [Terraform](https://alp78.github.io/elysium/07-Terraform/moc-terraform) — Provisioning SQL Server infrastructure
- [Data Architecture](https://alp78.github.io/elysium/14-Data-Architecture/moc-data-architecture) — Medallion architecture theory
- [25_py_functional_pipeline](https://alp78.github.io/elysium/02-Programming-Languages/Python/25_py_functional_pipeline) — Python pipeline using SQL Server as the persistence layer
