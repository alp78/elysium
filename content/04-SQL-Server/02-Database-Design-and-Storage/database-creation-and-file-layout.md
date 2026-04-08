---
title: "Database Creation and File Layout"
tags:
  - sql-server
  - database
  - create-database
  - file-layout
  - mdf
  - ndf
  - ldf
  - autogrowth
  - recovery-model
  - compatibility-level
aliases:
  - CREATE DATABASE
  - MDF NDF LDF
  - database files
  - database options
description: "Reference for CREATE DATABASE, file sizing, autogrowth, filegroups, recovery model, compatibility level, Query Store, and database-level defaults in SQL Server."
parent: "[[domain-database-design-and-storage]]"
links:
  - "[[schemas-tables-and-constraints]]"
  - "[[keys-defaults-identity-and-sequences]]"
  - "[[sql-server-schema-layering]]"
  - "[[storage-internals]]"
  - "[[sql-server-change-tracking]]"
created: 2026-04-08
updated: 2026-04-08
status: complete
---

# Database Creation and File Layout

This note owns the first structural decisions made before tables and indexes even exist:

- where the data file and log file live
- how large they start
- how they grow
- which database-level options become the default operating surface for every object created later

Instance settings live in [[server-configuration]]. This note is about database-scoped design.

## CREATE DATABASE and File Layout

### Data files (`.mdf`, `.ndf`) and log files (`.ldf`)

SQL Server separates persistent storage into two fundamentally different file types:

- **data files** store pages for tables, indexes, metadata, and internal structures
- **log files** store the transaction log and must be sized for recovery-model and write-volume requirements, not just raw data size

The production mistake is to think of the log file as a sidecar. It is not. Many operational failures are really log-sizing or log-backup failures.

### Initial size and autogrowth

Treat autogrowth as a safety net, not as the primary sizing mechanism.

- pre-size data files and log files to an expected short-term steady state
- use fixed-size autogrowth, not percentage growth, so growth events stay predictable
- size the log for the largest expected burst of fully logged work plus backup cadence
- review instant file initialization separately from log growth: log growth still zero-initializes

*This example creates a database with explicit data-file and log-file sizes and fixed autogrowth instead of percentage-based defaults.*

```sql
CREATE DATABASE analytics_core
ON PRIMARY
(
    NAME = analytics_core_data,
    FILENAME = '/var/opt/mssql/data/analytics_core_data.mdf',
    SIZE = 2048MB,
    FILEGROWTH = 256MB
)
LOG ON
(
    NAME = analytics_core_log,
    FILENAME = '/var/opt/mssql/data/analytics_core_log.ldf',
    SIZE = 1024MB,
    FILEGROWTH = 256MB
);
```

### Filegroups

For many estates, the correct answer is still a single primary filegroup plus the log file. Add extra filegroups only when they support a concrete operational outcome:

- partitioning and archive movement
- piecemeal restore strategy
- large object isolation
- a deliberate administrative boundary

Extra filegroups without a real lifecycle or restore reason usually add complexity without operational value.

## Database-Level Settings After Creation

### Recovery model, compatibility level, and Query Store

These are not cosmetic defaults. They define how the database recovers and how the optimizer behaves.

- `RECOVERY FULL` is required for log backups and point-in-time restore
- `COMPATIBILITY_LEVEL` controls optimizer and language behavior by SQL Server version surface
- `QUERY_STORE = ON` gives you persisted runtime and plan history for regression management

*This batch applies the most common database-scoped production defaults immediately after creation.*

```sql
ALTER DATABASE analytics_core SET RECOVERY FULL;
ALTER DATABASE analytics_core SET COMPATIBILITY_LEVEL = 160;
ALTER DATABASE analytics_core SET QUERY_STORE = ON;
ALTER DATABASE analytics_core SET QUERY_STORE
(
    OPERATION_MODE = READ_WRITE,
    QUERY_CAPTURE_MODE = AUTO,
    WAIT_STATS_CAPTURE_MODE = ON
);
```

### Snapshot isolation and RCSI

Read behavior is a database decision, not an instance decision.

- `ALLOW_SNAPSHOT_ISOLATION ON` permits explicit snapshot isolation
- `READ_COMMITTED_SNAPSHOT ON` changes default read committed to use row versioning instead of shared-lock reads

Use these deliberately. They reduce reader-writer blocking, but they push versioning cost into `tempdb`.

*This batch enables the two database-level row-versioning options that are most often evaluated for mixed read/write workloads.*

```sql
ALTER DATABASE analytics_core SET ALLOW_SNAPSHOT_ISOLATION ON;
ALTER DATABASE analytics_core SET READ_COMMITTED_SNAPSHOT ON;
```

### Page verify, containment, and auto options

The options below shape correctness and operational behavior:

- `PAGE_VERIFY CHECKSUM` should be the default for corruption detection
- `AUTO_CLOSE` should stay off for production databases
- `AUTO_SHRINK` should stay off for production databases
- containment should be enabled only when there is a real portability or tenant-isolation reason

*This batch applies the safest default posture for page verification and the two most important auto options.*

```sql
ALTER DATABASE analytics_core SET PAGE_VERIFY CHECKSUM;
ALTER DATABASE analytics_core SET AUTO_CLOSE OFF;
ALTER DATABASE analytics_core SET AUTO_SHRINK OFF;
```

## Production Database Baseline Example

The production sequence is:

1. create the database with explicit file names, sizes, and growth settings
2. set recovery model, compatibility level, and Query Store
3. decide whether RCSI or snapshot isolation is part of the workload contract
4. verify page verification and disable unsafe auto options
5. create schemas, tables, keys, constraints, and indexes against that baseline

## Related

- [[server-configuration]] for instance-level settings, TempDB, and Linux host checks
- [[schemas-tables-and-constraints]] for `CREATE SCHEMA`, `CREATE TABLE`, and constraint design
- [[keys-defaults-identity-and-sequences]] for key generation and default-value behavior
- [[storage-internals]] for the physical consequences of file and log design
