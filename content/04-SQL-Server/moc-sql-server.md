---
title: "MOC: SQL Server"
tags:
  - moc
  - sql-server
  - t-sql
  - database
---

# MOC: SQL Server

This map covers SQL Server 2022 on Linux (GCP Compute Engine) from the perspective of a data engineer who owns the full stack: provisioning, security, performance tuning, pipeline loading, and the medallion architecture that sits on top. Pages are grouped by role so you can navigate by what you need to do, not by where the file lives.

## Administration & High Availability — Standing Up and Operating the Instance

Everything required to provision, configure, back up, restore, and keep a SQL Server instance running in production. Starts with initial setup and ends with multi-replica high availability.

* [[server-configuration]] — max server memory, RCSI, TempDB tuning, recovery models, and Linux OS settings (swappiness, THP, I/O scheduler) for SQL Server on GCP

* [[sqlcmd-connection-and-usage]] — connecting via classic sqlcmd and go-sqlcmd, all common flags (-S -U -P -d -C), inline queries, script execution, and CSV export

* [[sql-server-agent-jobs]] — enabling Agent on Linux, creating jobs and schedules, built-in CDC/backup agents, and a five-way comparison of Agent vs Airflow vs cron vs Cloud Scheduler vs Cloud Functions

* [[essential-dba-queries]] — DMV diagnostic toolkit for incidents: server version, database sizes, active connections, running queries, blocking chains, and cumulative wait statistics

* [[backup-types-and-strategy]] — full, differential, transaction log, and copy-only backups, the 3-2-1 rule, recovery model selection, and an automated GCS backup script

* [[restore-and-recovery]] — full restore, point-in-time recovery (PITR) with log replaying, and restoring to a new database for side-by-side comparison

* [[finops-cost-optimization]] — GCP disk snapshot schedules, application-consistent snapshots with SUSPEND_FOR_SNAPSHOT_BACKUP, committed use discounts vs spot instances, and right-sizing VMs

* [[high-availability-overview]] — HA architecture for SQL Server 2022 on Linux GCP: Always On AG setup with Pacemaker/Corosync, monitoring DMVs, failover operations, read-only routing, and GCP Internal Load Balancer configuration

* [[always-on-availability-groups]] — step-by-step AG deployment, synchronous vs asynchronous commit, RPO/RTO targets, planned and forced failover, certificate authentication, and troubleshooting five common AG issues


## Security & Compliance — Locking Down Access and Meeting Audit Requirements

Identity layers, encryption at rest, and audit trails required for regulatory compliance (EU BMR, SOC 2, GDPR).

* [[sql-server-authentication]] — three-layer identity hardening: GCP IAM service account with minimal roles, dedicated SQL logins with least-privilege schema permissions, TLS 1.2 enforcement, firewall rules, and a quarterly security review checklist

* [[tde-encryption]] — enabling Transparent Data Encryption with GCP Cloud KMS key protection, the encryption key hierarchy (SMK/DMK/certificate/DEK), critical certificate backup to GCS, disaster recovery restore procedure, and performance impact benchmarks

* [[audit-logging]] — setting up SQL Server Audit on Linux: server and database audit specifications, querying .sqlaudit files, detecting brute-force login attempts, forwarding events to GCP Cloud Logging and BigQuery, and running quarterly compliance reviews

## Storage & Indexing — How Data Lives on Disk and How Queries Find It

The physical layer: pages, extents, B-trees, columnstore, compression, partitioning, and ongoing index maintenance. Understanding these internals is the prerequisite for every performance investigation.

* [[storage-internals]] — the 8 KB page and 64 KB extent model, .mdf/.ldf file architecture, page anatomy (header, row offset array), write-ahead logging and checkpoints, CRUD mechanics at the page level, page splits, tempdb consumers, and the buffer pool

* [[index-types-and-strategy]] — clustered, nonclustered, covering, filtered, and columnstore indexes with creation syntax, the decision tree for choosing the right type, anti-patterns (GUID clustered keys, over-indexing), and statistics management

* [[index-maintenance]] — detecting fragmentation with sys.dm_db_index_physical_stats, REORGANIZE vs REBUILD thresholds, fill factor guidance, online rebuilds, and an automated maintenance script for pipeline workloads

* [[partitioning-strategies]] — partition functions and schemes, partition elimination for query performance, SWITCH for millisecond archiving and loading, the sliding window pattern, and when partitioning is worth the overhead (10M+ row threshold)

* [[table-compression]] — row vs page compression mechanics, estimating savings with sp_estimate_data_compression_savings, applying compression with online rebuilds, and guidance for gold-layer financial time-series tables

## Performance & Concurrency — Finding Bottlenecks and Resolving Contention

The diagnostic loop: wait stats reveal the category, execution plans reveal the query, and concurrency analysis reveals the contention pattern. Includes the audit playbook, troubleshooting flowcharts, and the production problems catalog.

* [[sargable-queries]] — SARGable vs non-SARGable predicates, the fundamental rule (no functions on the column side), implicit conversion traps, and fix strategies that turn full scans into index seeks

* [[wait-stats-analysis]] — reading sys.dm_os_wait_stats to diagnose bottlenecks, the filtered wait query, signal vs resource wait interpretation, common wait types for pipeline workloads (PAGEIOLATCH, WRITELOG, LCK_M, CXPACKET), and Query Store setup

* [[execution-plans]] — estimated vs actual plans in SSMS, reading the visual tree right-to-left, cost analysis, cardinality estimation errors, per-query wait stats, implicit conversions, parameter sniffing, and batch mode

* [[query-plan-analysis]] — capturing plans programmatically, plan operators (seek/scan/lookup/join), parameter sniffing diagnosis, Query Store setup for regression detection, and forcing plans with sp_query_store_force_plan

* [[memory-and-buffer-pool]] — how the buffer pool caches 8 KB pages, Page Life Expectancy and buffer cache hit ratio, memory clerks, memory grants, pending grant detection, and max server memory sizing rules for GCP VMs

* [[performance-audit-playbook]] — 11-phase step-by-step methodology: instance overview, memory pressure, wait stats, IO performance, expensive queries, index health, TempDB, blocking, statistics quality, database sizes, and security review

* [[troubleshooting-flowcharts]] — four decision trees for slowness (via wait stats), pipeline failure root cause, the index decision tree, and disk space emergency recovery

* [[blocking-and-locking]] — lock types (S, X, U, IS, IX), the compatibility matrix, lock granularity hierarchy, isolation levels (READ COMMITTED through SERIALIZABLE), RCSI, lock escalation prevention, and blocking chain detection

* [[deadlock-detection-and-prevention]] — circular wait mechanics, error 1205 handling, deadlock monitor thread, detection with DMVs and Extended Events, RCSI as the primary prevention strategy, and application-level retry logic in Python and C#

* [[race-conditions]] — four pipeline race patterns (lost update, phantom insert, dirty read, overlapping truncate-reload), detection queries, and five prevention strategies including Airflow serialization, atomic SQL operations, and unique constraints

* [[sql-server-problems]] — 25 production problems ranked by severity with root cause analysis, impact assessment, prevention protocols, and fix procedures covering performance, concurrency, data loading, backup, and operational issues

## Pipeline Patterns & Medallion Project — Loading, Transforming, and Serving Data

How data flows through SQL Server: loading methods, schema organization, change tracking, incremental processing, anti-patterns to avoid, and the bronze/silver/gold implementation of a financial index pipeline.

* [[sql-server-loading-patterns]] — every method of getting data into SQL Server benchmarked and compared: bcp, BULK INSERT, pyodbc fast_executemany, SqlBulkCopy, loading strategies (truncate-reload, staging swap, incremental, upsert), and minimal logging

* [[sql-server-schema-layering]] — organizing databases and schemas for layered architectures: schema-per-layer, schema-per-domain, separate databases, naming conventions, cross-schema security, and metadata columns

* [[merge-and-upsert]] — four load patterns (truncate-reload, read-then-INSERT/UPDATE, SCD Type 2 close-and-insert, delete-and-insert), the MERGE statement, transaction management with XACT_ABORT, and @@ROWCOUNT guards

* [[date-and-time-functions]] — ISO 8601 formats, DATETIME2 vs DATETIMEOFFSET selection, DATEADD/DATEDIFF/EOMONTH/DATETRUNC, AT TIME ZONE conversion, DST pitfalls, and cross-language patterns (T-SQL, Python, C#)

* [[sql-server-change-tracking]] — seven methods for capturing data history (manual SCD2, temporal tables, CDC, Change Tracking, triggers, dbt snapshots, audit columns) with a decision matrix and side-by-side comparisons

* [[sql-server-incremental-transforms]] — watermark-based loading, partition SWITCH, window functions at scale (ROW_NUMBER, moving averages), gap detection, forward-fill, pre-computed aggregation tables, and indexed views

* [[sql-server-pipeline-anti-patterns]] — 20+ production mistakes that cause incidents: row-by-row inserts, SELECT *, silent truncation, NOLOCK abuse, implicit conversions, float comparison, cursors in ETL, and the fix for each

* [[pipeline-integration-and-devex]] — tagging SQL queries with Airflow context for monitoring correlation, schema migration management with Flyway or a Python runner, and connection pool sizing for pymssql and ADO.NET

* [[pit-integrity-logic]] — point-in-time data integrity for stock index calculation: effective-dated constituent lists, SCD2 membership tracking, weight normalization to exactly 1.00000000, bi-temporal modeling, and performance tuning for large-scale temporal joins

* [[bronze-layer-loading]] — bronze table DDL for the financial index pipeline, idempotent schema creation, pyodbc connection setup, truncate-and-reload vs merge loading, and JSON-to-bronze data flow for OHLCV, signals, and dimension tables

* [[silver-transforms]] — SCD Type 2 dimension tracking, OHLCV gap-filling against the trading calendar, daily and quarterly signal upserts, unique index design for deduplication, and the validation gate between bronze and silver

* [[gold-transforms]] — gold table DDL, z-score computation by group, financial health flags, governance scoring, cap-weighted index performance, moving average CTEs (SMA 30/90), composite scoring and ranking, and dashboard-ready consumption queries

## Cross-References

- [[dbt-sqlserver-adapter]] — dbt SQL Server adapter configuration
- [[dbt-performance-tuning]] — Tuning dbt models on SQL Server
