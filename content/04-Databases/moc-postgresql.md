---
title: "MOC: PostgreSQL"
tags:
  - moc
  - postgresql
  - database
---

# MOC: PostgreSQL

This chapter mirrors the SQL Server chapter at the same operational depth, but it is grounded in PostgreSQL's own execution model: cluster initialization, configuration files, MVCC, WAL, autovacuum, query planning, replication, and pipeline-oriented loading patterns.

The working lab for this chapter is a dedicated Dockerized PostgreSQL 16 instance on `localhost:5434` with a migrated `stoxx` database that preserves the source schema names `bronze`, `silver`, `gold`, `dbo`, and `demo_stc`.

> [!guide]+ Server Operations and Maintenance
>
> [[domain-postgresql-server-operations]]
>
> Cluster layout, configuration files, service health, roles and authentication, backup and recovery, WAL behavior, replication, and operational triage.

> [!guide]+ Database Design, Tables, and Storage
>
> [[domain-postgresql-database-design-and-storage]]
>
> Schemas, tables, constraints, identity and sequence behavior, indexes, partitioning, storage internals, TOAST, and maintenance boundaries.

> [!guide]+ Query Writing and Optimization
>
> [[domain-postgresql-query-writing-and-optimization]]
>
> Core PostgreSQL query patterns, planner behavior, `EXPLAIN`, statistics, locking, MVCC side effects, deadlocks, and query-shape tuning.

> [!guide]+ Applied PostgreSQL for Data Pipelines
>
> [[domain-applied-postgresql-pipelines]]
>
> `COPY`, staged loads, idempotent publish patterns, incremental transforms, medallion-style modeling, and pipeline anti-patterns in PostgreSQL.

## PostgreSQL Cross-References

- [[moc-sql-server]] — the parallel SQL Server track for engine-to-engine comparison
- [DB Queries](https://alp78.github.io/elysium/05-DB-Queries/moc-db-queries) — executable SQL notebooks that should eventually gain a PostgreSQL sibling track
- [[moc-docker]] — container lifecycle and Compose patterns for the local PostgreSQL lab
- [[moc-data-architecture]] — medallion architecture and pipeline-pattern theory that the PostgreSQL pipeline notes will mirror
