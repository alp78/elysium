---
title: "18 - PostgreSQL System Catalog And Stats Reference"
tags:
  - postgresql
  - reference
  - catalogs
description: "Chapter reference for the PostgreSQL system catalogs, statistics views, and helper functions used across the PostgreSQL chapter, with purpose summaries and cross-links to the notes where each surface matters operationally."
parent: "[[domain-postgresql-server-operations]]"
links:
  - "[[17-postgresql-finops-cost-optimization]]"
status: complete
---

# PostgreSQL System Catalog And Stats Reference

This page is the PostgreSQL analogue to the SQL Server DMV reference, but the shape is different because PostgreSQL spreads its metadata across system catalogs, statistics views, configuration views, and helper functions. The goal is not to memorize every `pg_*` object. The goal is to know which surface answers which class of operational question.

> [!abstract]- Summary
>
> This reference groups the chapter's main metadata surfaces into six operator-friendly buckets:
>
> - **Activity and runtime**
>   - current sessions, waits, database-level counters, and prepared statements
> - **Memory and I/O**
>   - settings, buffer/cache views, backend memory, and I/O counters
> - **Storage and schema**
>   - table, index, namespace, attribute, and type metadata
> - **Locking and concurrency**
>   - lock inventory, blocking helpers, and deadlock signals
> - **Replication and recovery**
>   - standby health, slot retention, WAL generation, and archiver state
> - **Security and configuration**
>   - roles, `pg_hba.conf` parsing, TLS session evidence, and extension surfaces

## Quick-Lookup Index

| Object | Class | Primary purpose | Main notes |
|---|---|---|---|
| `pg_stat_activity` | statistics view | current sessions, waits, and running SQL | [[06-essential-postgresql-dba-queries]], [[14-postgresql-problems]], [[15-postgresql-troubleshooting-flowcharts]] |
| `pg_stat_database` | statistics view | per-database counters for temp files, deadlocks, time spent | [[11-postgresql-memory-and-buffer-cache]], [[14-postgresql-problems]] |
| `pg_prepared_statements` | statistics view | prepared statements visible to the current database | [[16-postgresql-performance-audit-playbook]] |
| `pg_settings` | configuration view | live GUC values and sources | [[01-postgresql-server-configuration]], [[13-postgresql-encryption-at-rest-and-in-transit]] |
| `pg_stat_io` | statistics view | read/write/extend/hit counters by backend and object class | [[11-postgresql-memory-and-buffer-cache]], [[16-postgresql-performance-audit-playbook]] |
| `pg_stat_bgwriter` | statistics view | checkpoint and background-write counters | [[11-postgresql-memory-and-buffer-cache]] |
| `pg_backend_memory_contexts` | statistics view | memory contexts for the current backend | [[11-postgresql-memory-and-buffer-cache]] |
| `pg_buffercache` | extension view | shared-buffer contents | [[11-postgresql-memory-and-buffer-cache]] |
| `pg_stat_user_tables` | statistics view | row estimates, dead tuples, maintenance timestamps | [[14-postgresql-problems]], [[15-postgresql-troubleshooting-flowcharts]] |
| `pg_stat_user_indexes` | statistics view | index scan and tuple-read counters | [[16-postgresql-performance-audit-playbook]], [[17-postgresql-finops-cost-optimization]] |
| `pg_class` | catalog | relation metadata | [[02-postgresql-storage-internals]], [[18-postgresql-system-catalog-and-stats-reference]] |
| `pg_namespace` | catalog | schema metadata | [[01-postgresql-storage-and-schema-surface]] |
| `pg_attribute` | catalog | column metadata | [[01-postgresql-storage-and-schema-surface]] |
| `pg_type` | catalog | data type metadata | [[02-postgresql-data-types-conversion-and-null-handling]] |
| `pg_database` | catalog | database-level metadata and `datfrozenxid` | [[14-postgresql-problems]], [[16-postgresql-performance-audit-playbook]] |
| `pg_locks` | system view | current lock inventory | [[14-postgresql-problems]] |
| `pg_blocking_pids()` | function | direct blocker lookup for a backend | [[14-postgresql-problems]], [[15-postgresql-troubleshooting-flowcharts]] |
| `pg_stat_replication` | statistics view | primary-side standby status and lag | [[10-postgresql-streaming-replication-and-failover]], [[15-postgresql-troubleshooting-flowcharts]] |
| `pg_replication_slots` | system view | slot state and WAL retention boundary | [[07-postgresql-backup-types-and-strategy]], [[14-postgresql-problems]] |
| `pg_stat_wal` | statistics view | WAL generation counters | [[07-postgresql-backup-types-and-strategy]] |
| `pg_stat_archiver` | statistics view | WAL archive success and failure counts | [[07-postgresql-backup-types-and-strategy]] |
| `pg_stat_ssl` | statistics view | live TLS session evidence | [[13-postgresql-encryption-at-rest-and-in-transit]] |
| `pg_hba_file_rules` | system view | parsed `pg_hba.conf` rules | [[03-postgresql-authentication]], [[13-postgresql-encryption-at-rest-and-in-transit]] |
| `pg_roles` | catalog view | role attributes and privilege surface | [[04-roles-users-and-privileges]], [[16-postgresql-performance-audit-playbook]] |
| `pg_extension` | catalog | installed extensions | [[05-postgresql-scheduling-and-pg-cron]], [[13-postgresql-encryption-at-rest-and-in-transit]] |
| `pg_available_extensions` | catalog view | installable extension inventory | [[12-postgresql-audit-logging]], [[16-postgresql-performance-audit-playbook]] |
| `pg_relation_size()` | function | heap size of one relation | [[15-postgresql-troubleshooting-flowcharts]], [[17-postgresql-finops-cost-optimization]] |
| `pg_indexes_size()` | function | index bytes for one relation | [[15-postgresql-troubleshooting-flowcharts]], [[17-postgresql-finops-cost-optimization]] |
| `pg_total_relation_size()` | function | total bytes for relation plus indexes and TOAST | [[15-postgresql-troubleshooting-flowcharts]], [[17-postgresql-finops-cost-optimization]] |
| `pg_database_size()` | function | total bytes for a database | [[16-postgresql-performance-audit-playbook]], [[17-postgresql-finops-cost-optimization]] |
| `pg_relation_filepath()` | function | relative file path beneath the cluster directory | [[13-postgresql-encryption-at-rest-and-in-transit]] |
| `pg_wal_lsn_diff()` | function | byte difference between WAL positions | [[14-postgresql-problems]] |

## Activity And Runtime

### PostgreSQL | `pg_stat_activity` | current session and wait surface

`pg_stat_activity` is the first-response view for live incidents. It answers who is connected, what each backend is running, whether the backend is waiting, and which application name to blame before looking anywhere deeper.

### PostgreSQL | `pg_stat_database` | cumulative counters by database

Use `pg_stat_database` for database-level consequences rather than live session state: deadlocks, temp files, temp bytes, total session time, and related cumulative counters.

### PostgreSQL | `pg_prepared_statements` | prepared-plan visibility

This view matters when debugging generic-versus-custom plan behavior or auditing prepared statement usage. A zero-row result is itself meaningful: there may simply be no prepared statements active in the current database context.

## Memory And I/O

### PostgreSQL | `pg_settings` | live configuration state

`pg_settings` is the single authoritative in-engine surface for current configuration values, their units, their change context, and their source. It is used repeatedly because every audit or hardening claim should be backed by this view instead of by remembered config files.

### PostgreSQL | `pg_stat_io` | backend-type and object-class I/O

`pg_stat_io` is PostgreSQL's modern I/O accounting view. It breaks I/O into backend types such as `client backend` and `checkpointer`, and into object classes such as `relation` and `temp relation`.

### PostgreSQL | `pg_stat_bgwriter` | checkpoint and background-writer behavior

This view exposes checkpoint timing and buffer-write counters. Use it when asking whether write pressure is being absorbed cleanly or whether checkpoints are too frequent for the workload.

### PostgreSQL | `pg_backend_memory_contexts` and `pg_buffercache`

These two surfaces divide PostgreSQL memory into backend-local and shared-buffer perspectives. `pg_backend_memory_contexts` is per-session. `pg_buffercache` requires an extension and exposes shared-buffer contents.

## Storage And Schema

### PostgreSQL | `pg_class` and `pg_namespace` | relations and schemas

`pg_class` is the central relation catalog: tables, indexes, materialized views, sequences, and more. `pg_namespace` resolves schema names. Most relation-introspection queries start with these two catalogs together.

### PostgreSQL | `pg_attribute` and `pg_type` | columns and data types

`pg_attribute` describes columns; `pg_type` describes the types those columns use. Together they underpin schema documentation and data-type analysis.

### PostgreSQL | `pg_database` | database identity, size context, and freeze age

Beyond listing databases, `pg_database` matters operationally because of fields such as `datfrozenxid`, which let operators reason about transaction-ID age and wraparound posture.

### PostgreSQL | `pg_stat_user_tables` and `pg_stat_user_indexes`

These are the practical table and index health views for most audits. They expose scan counts, tuple estimates, dead tuples, and maintenance timestamps without forcing direct catalog joins for every routine question.

## Locking And Concurrency

### PostgreSQL | `pg_locks` | current lock inventory

Use `pg_locks` when you need the raw lock objects, lock modes, and granted-versus-waiting state. It is more detailed and less readable than `pg_stat_activity`, so most triage starts with activity and drops to `pg_locks` only when necessary.

### PostgreSQL | `pg_blocking_pids()` | direct blocker lookup

This helper function is the quickest way to map a waiting backend to its blockers. It is one of the most useful concurrency functions in the chapter because it removes guesswork from blocking analysis.

### PostgreSQL | `pg_stat_database.deadlocks`

There is no separate deadlock-history catalog in core PostgreSQL comparable to some SQL Server surfaces. The cumulative `deadlocks` counter in `pg_stat_database` is the simplest in-engine signal that deadlocks are occurring at all.

## Replication And Recovery

### PostgreSQL | `pg_stat_replication` | primary-side standby view

This is the first view to open on a primary when checking standby health. If it returns zero rows, the current primary has no connected standby. If it returns rows, `state`, `sync_state`, and lag columns become the routing surface.

### PostgreSQL | `pg_replication_slots` | slot retention boundary

This view matters because slots can force WAL retention long after normal checkpoints would have recycled old segments. It is central to both backup and runaway-disk investigations.

### PostgreSQL | `pg_stat_wal` and `pg_stat_archiver`

Use `pg_stat_wal` for generation behavior and `pg_stat_archiver` for archive success/failure history. Together they tell you whether a PITR-capable environment is generating the right history and shipping it reliably.

## Security And Configuration

### PostgreSQL | `pg_roles` | role attributes and admin surface

`pg_roles` is the readable role inventory. It exposes superuser, createdb, createrole, replication, and login capability in one place.

### PostgreSQL | `pg_hba_file_rules` | parsed authentication policy

This view turns `pg_hba.conf` from text into queryable rows. It is the cleanest way to confirm whether rules are `host`, `hostssl`, or something else without hand-parsing the file.

### PostgreSQL | `pg_stat_ssl` | transport encryption proof

Use `pg_stat_ssl` to verify whether a specific backend is using TLS and which protocol and cipher were negotiated. It is the final server-side proof that a client really connected over TLS.

### PostgreSQL | `pg_extension` and `pg_available_extensions`

These two views answer different questions. `pg_available_extensions` asks what could be installed. `pg_extension` asks what is installed right now in the database.

## Helper Functions And Size Utilities

### PostgreSQL | size functions

Use these as the standard size toolkit:

| Function | Primary use |
|---|---|
| `pg_relation_size()` | heap bytes only |
| `pg_indexes_size()` | index bytes only |
| `pg_total_relation_size()` | heap + indexes + TOAST |
| `pg_database_size()` | database total |

### PostgreSQL | path and WAL helpers

Use these when moving from logical metadata to physical consequences:

| Function | Primary use |
|---|---|
| `pg_relation_filepath()` | map a relation to its relative file path in the cluster |
| `pg_wal_lsn_diff()` | calculate retained or generated WAL distance between LSNs |
| `pg_blocking_pids()` | resolve blockers for a waiting backend |

## Appendix — Supporting Catalogs Worth Remembering

| Object | Why it matters later |
|---|---|
| `pg_index` | index definition details beyond scan counters |
| `pg_constraint` | primary keys, unique constraints, checks, and foreign keys |
| `pg_inherits` | partition and inheritance relationships |
| `pg_proc` | function and procedure metadata |
| `pg_collation` | collation inventory and text-sorting behavior |
| `pg_sequences` | readable sequence metadata |

## Related

- [[06-essential-postgresql-dba-queries]]
- [[10-postgresql-streaming-replication-and-failover]]
- [[11-postgresql-memory-and-buffer-cache]]
- [[16-postgresql-performance-audit-playbook]]
