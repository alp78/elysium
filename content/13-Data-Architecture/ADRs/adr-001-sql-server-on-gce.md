---
tags: [adr, sql-server, gcp]
type: reference
status: accepted
updated: 2026-03-23
---

# ADR-001: SQL Server on Compute Engine

## Status
Accepted | 2026-03-23

## Context
The platform needs a relational database for the medallion pipeline (bronze/silver/gold), index calculation, and corporate action processing. Options: SQL Server on GCE, Cloud SQL for SQL Server, or migrate to PostgreSQL.

## Decision
Run SQL Server 2022 Developer Edition on Linux on a Compute Engine VM.

**Why:**
- Full control over configuration (TDE, Always On AG, Query Store, system-versioned temporal tables)
- No per-core licensing cost (Developer Edition on Linux is free for non-production)
- Direct disk access for performance tuning (SSD, snapshot scheduling)
- T-SQL expertise on the team; stored procedures and MERGE patterns already written
- Cloud SQL for SQL Server lacks: TDE with customer-managed keys, system-versioned temporal tables, fine-grained Query Store control

## Consequences
- **Easier:** Full DBA control, any SQL Server feature available, no managed-service limitations
- **Harder:** Self-managed backups, patching, HA configuration, no automatic failover without Pacemaker
- **Operational cost:** Requires on-call for SQL Server VM issues

## Alternatives Considered
- **Cloud SQL for SQL Server:** Managed, but missing TDE/CMEK, temporal tables, limited version control. Higher cost for equivalent specs.
- **PostgreSQL:** Fully managed, lower cost, but requires rewriting all T-SQL, losing MERGE, no direct equivalent of Query Store.
- **BigQuery only:** Not suitable for OLTP workloads or MERGE-heavy medallion pattern.

## Related
- [[sql-server-index]]
- [[high-availability-overview]]
- [[tde-encryption]]
