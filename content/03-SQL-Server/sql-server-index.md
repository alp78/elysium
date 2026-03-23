---
type: index
category: sql-server
technology: [sql-server]
tags: [sql]
aliases: [SQL Server Index, SQL Server Overview]
keywords: [sql server, index, administration, t-sql, performance, storage, concurrency, security, high availability, patterns, tuning]
description: "Index for the SQL Server section — administration, T-SQL patterns, storage internals, performance tuning, concurrency, security, high availability, and data pipeline patterns."
related: []
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# SQL Server

SQL Server 2022 on Linux (GCP Compute Engine) — administration, performance tuning, and data pipeline patterns for the [[medallion-architecture|medallion architecture]].

## Administration

Day-to-day operations, connection management, backup strategy, and cost optimization.

- [[sqlcmd-connection-and-usage]] — Connecting, flags, query execution, script files
- [[essential-dba-queries]] — Server version, database sizes, active connections, blocking
- [[backup-types-and-strategy]] — Full, differential, log, copy-only, 3-2-1 rule
- [[restore-and-recovery]] — Full restore, point-in-time recovery
- [[server-configuration]] — Max memory, RCSI, TempDB, recovery models
- [[finops-cost-optimization]] — GCP disk snapshots, committed use discounts, right-sizing

## T-SQL

SQL Server-specific query patterns and optimization.

- [[sargable-queries]] — SARGable patterns, what kills index usage
- [[merge-and-upsert]] — MERGE, upsert strategies, transaction management, XACT_ABORT
- [[date-and-time-functions]] — ISO 8601, date types, DATEADD/DATEDIFF, timezone conversion, DST pitfalls

## Storage and Indexes

How SQL Server stores data and the index strategies that make queries fast.

- [[storage-internals]] — Pages, extents, files, filegroups, CRUD mechanics
- [[index-types-and-strategy]] — Clustered, non-clustered, filtered, covering, columnstore
- [[index-maintenance]] — Fragmentation, rebuild vs reorganize, fill factor, statistics
- [[table-compression]] — PAGE vs ROW compression, sp_estimate_data_compression_savings, ONLINE rebuild
- [[partitioning-strategies]] — Partition functions and schemes, partition elimination, SWITCH for archiving

## Performance

Diagnosing and resolving performance problems.

- [[wait-stats-analysis]] — Top waits, PAGEIOLATCH, LCK_M, CXPACKET
- [[memory-and-buffer-pool]] — PLE, max server memory, buffer pool, DBCC FREEPROCCACHE
- [[query-plan-analysis]] — Execution plans, plan cache, parameter sniffing
- [[execution-plans]] — Estimated vs. actual plans, cardinality estimation, implicit conversions
- [[performance-audit-playbook]] — 11-phase audit: memory, IO, waits, indexes, TempDB, blocking, security
- [[pipeline-integration-and-devex]] — Query tagging, schema migrations, connection pooling, Datadog agent config
- [[troubleshooting-flowcharts]] — "Why slow?", "Pipeline failed", index decision tree, disk space emergency
- [[sql-server-problems]] — Common SQL Server error scenarios and solutions

## Concurrency

Handling concurrent access — deadlocks, race conditions, and isolation levels.

- [[deadlock-detection-and-prevention]] — Detection, Extended Events, RCSI prevention, retry logic
- [[race-conditions]] — UPDLOCK patterns, serializable isolation, safe concurrent access, data pipeline audit
- [[blocking-and-locking]] — Lock types (S/U/X/IS/IX), lock granularity, RCSI, blocking chain detection

## Security

Encryption, authentication, and audit logging.

- [[tde-encryption]] — Transparent Data Encryption with GCP Cloud KMS
- [[sql-server-authentication]] — Authentication modes, service accounts, TLS, firewall
- [[audit-logging]] — SQL Server Audit, brute-force detection, GCP Cloud Logging integration

## High Availability

Ensuring uptime and disaster recovery.

- [[high-availability-overview]] — HA options comparison, RTO/RPO, read-only routing
- [[always-on-availability-groups]] — AG setup on Linux/GCP, Pacemaker/Corosync, planned vs. forced failover

## Patterns

Data pipeline patterns built on SQL Server.

- [[medallion-architecture]] — Bronze/silver/gold layers, schema design
- [[bronze-layer-loading]] — JSON to bronze, parameterized queries, pyodbc, fast_executemany
- [[silver-transforms]] — Deduplication, SCD Type 2, gap-filling, MERGE
- [[gold-transforms]] — Analytics, scoring, pre-computed aggregations, window functions

See also: [[sql-server-cheat-sheet]]

## Cross-References - dbt

- [[dbt-sqlserver-adapter]] — dbt SQL Server adapter configuration
- [[dbt-performance-tuning]] — Tuning dbt models on SQL Server
