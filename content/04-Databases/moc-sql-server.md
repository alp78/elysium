---
title: "MOC: SQL Server"
tags:
  - moc
  - sql-server
  - tsql
  - database
---

# MOC: SQL Server

This chapter is organized around the three jobs people actually do with SQL Server in production:

1. operate and maintain the server
2. create and shape databases, tables, and storage structures
3. write and optimize queries

A fourth track collects the applied pipeline patterns built on top of those foundations.

> [!guide]+ Server Operations and Maintenance
>
> [[domain-server-operations]]
>
> Connectivity, instance configuration, backup and restore, security, high availability, audit, incident triage, and estate-level operational review.

> [!guide]+ Database Design, Tables, and Storage
>
> [[domain-database-design-and-storage]]
>
> Database creation, schema and table design, keys and constraints, change tracking, storage internals, index design, compression, partitioning, and maintenance.

> [!guide]+ Query Writing and Optimization
>
> [[domain-query-writing-and-optimization]]
>
> Core T-SQL reference, execution plans, Query Store, waits, blocking, deadlocks, race conditions, and production query optimization workflows.

> [!guide]+ Applied SQL Server for Data Pipelines
>
> [[domain-applied-sql-server-pipelines]]
>
> Loading patterns, incremental transforms, medallion implementation, pipeline anti-patterns, point-in-time integrity, and pipeline operability guidance.

## SQL Server Cross-References

- [DB Queries](https://alp78.github.io/elysium/05-DB-Queries/moc-db-queries) — SQL Server query notebooks with executable examples
- [GCP](https://alp78.github.io/elysium/06-GCP/moc-gcp) — SQL Server VMs on Compute Engine
- [Terraform](https://alp78.github.io/elysium/07-Terraform/moc-terraform) — Provisioning SQL Server infrastructure
- [Data Architecture](https://alp78.github.io/elysium/14-Data-Architecture/moc-data-architecture) — Medallion architecture theory
- [25_py_functional_pipeline](https://alp78.github.io/elysium/02-Programming-Languages/Python/25_py_functional_pipeline) — Python pipeline using SQL Server as the persistence layer
