---
title: "02 - Storage Internals"
tags:
  - postgresql
  - storage-internals
  - wal
  - temp-files
aliases:
  - PostgreSQL heap storage
  - relation forks
  - HOT updates
description: "Production PostgreSQL storage-internals baseline for block size, relation forks, WAL visibility, temporary work files, and HOT update behavior, grounded on the live stoxx database."
parent: "[[domain-postgresql-database-design-and-storage]]"
links:
  - "[[01-postgresql-storage-and-schema-surface]]"
  - "[[03-postgresql-schemas-tables-and-constraints]]"
status: complete
---

# Storage Internals

Storage internals explain why the same SQL can behave differently as relation files grow, WAL volume accumulates, pages lose free space, and update chains start leaving dead tuples behind. In PostgreSQL the important physical units are blocks, relation forks, WAL records, free-space tracking, visibility tracking, and heap-only tuple behavior. The live `stoxx` database is small enough to inspect directly, which makes it a useful baseline for turning those concepts into operational signals instead of leaving them at the level of abstract engine theory.

> [!abstract]- Summary
>
> PostgreSQL storage internals are built around heap relations, separate relation forks, cluster-wide WAL, and MVCC tuple versioning. This note mirrors the SQL Server storage-internals track with PostgreSQL equivalents: blocks instead of pages-as-a-public-API concept, relation forks instead of filegroups, WAL and temp-file counters instead of per-database log files and `tempdb`, and HOT updates instead of heap forwarding records.
>
> **Core model**
> - confirms the live PostgreSQL block size and inspects the main, free-space-map, and visibility-map forks of a real silver table
>
> **WAL and temporary work files**
> - surfaces the current WAL position, durability switches, cumulative WAL statistics, and the current database's temp-file counters
>
> **Mutation costs**
> - demonstrates that PostgreSQL updates create new tuple versions, not in-place rewrites, and shows how fillfactor and available page space determine whether updates qualify as HOT

> [!note]- Glossary
>
> **Block**
> - The basic 8 KB physical unit used by PostgreSQL for heap and index storage.
> - It matters because relation sizes, buffer-cache activity, and most on-disk storage behavior are ultimately expressed in blocks.
>
> > [!info] Block size is a build-time constant
> >
> > Most PostgreSQL builds use 8 KB blocks, and the current `stoxx-postgres` cluster follows that default.
>
> ---
>
> **Relation fork**
> - A separate physical file associated with one relation, such as the main fork, free space map (`_fsm`), or visibility map (`_vm`).
> - It matters because one logical table can have several physical storage files serving different purposes.
>
> > [!info] Tables are not only one file
> >
> > The main heap file holds tuples, but PostgreSQL also tracks free space and page visibility in separate forks alongside it.
>
> ---
>
> **Write-ahead logging (WAL)**
> - The durability rule and log stream through which PostgreSQL records changes before dirty pages are flushed to data files.
> - It matters because PostgreSQL durability, crash recovery, replication, and much of large-load behavior all depend on WAL pressure.
>
> > [!info] WAL is cluster-wide
> >
> > PostgreSQL does not have one transaction-log file per database. One cluster-wide WAL stream serves all databases in the instance.
>
> ---
>
> **Temporary work file**
> - A file PostgreSQL creates when a sort, hash, materialization, or similar operation exceeds memory and spills to disk.
> - It matters because PostgreSQL has no `tempdb` database. Temp-file pressure shows up through temp-file counters, logging, and filesystem usage instead.
>
> > [!info] Temp work is a runtime side effect
> >
> > Temporary files are produced by execution behavior, not by application schema design alone.
>
> ---
>
> **HOT update**
> - A heap-only tuple update where PostgreSQL can place the new row version on the same page without creating new index entries.
> - It matters because HOT updates reduce index churn and cleanup overhead, but they only happen when page space and index-column rules permit them.
>
> > [!info] Fillfactor makes HOT more likely, not guaranteed
> >
> > Lowering fillfactor leaves page space available for future row versions, but PostgreSQL still needs the updated row to fit and the indexed columns to stay unchanged.
>
> ---

## Core Model

The first storage question is not "how many rows are in the table?" but "what physical units and files does PostgreSQL use to represent it?" Blocks and relation forks answer that directly.

### Blocks and relation forks

This subsection establishes the physical units that every later storage and performance discussion depends on.

#### Confirm the PostgreSQL block size

Use this query when translating storage guidance into physical units, reading relation-size output, or validating assumptions about page-level reasoning before moving deeper into buffer or I/O analysis. It is typically triggered by storage-baseline work or by an engineer coming from another engine who wants to confirm PostgreSQL's physical grain. The query reads one server setting through `current_setting()`. It is read-only. Its purpose is to prove the current cluster's block size rather than assuming the default.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `block_size_bytes` | `current_setting('block_size')` | integer | Physical block size used by the server. |
| `block_size_pretty` | `pg_size_pretty()` | text | Human-readable rendering of the block size. |

*This query confirms the physical block size used by the current PostgreSQL cluster.*

```sql
SELECT
    current_setting('block_size')::int AS block_size_bytes,
    pg_size_pretty(current_setting('block_size')::bigint) AS block_size_pretty;
```

| block_size_bytes | block_size_pretty |
|---:|---|
| 8192 | 8192 bytes |

This cluster uses the standard PostgreSQL 8 KB block size. That is the physical grain behind heap and index storage, just as 8 KB pages are the public baseline in SQL Server storage discussions.

#### Inspect the relation forks of a real silver table

Use this query when the goal is to connect one logical relation to its physical files, or when a storage discussion needs to explain why PostgreSQL tracks free space and visibility separately from the main heap. It is typically triggered by catalog forensics, relation-size review, or storage internals teaching. The query reads `pg_class` and relation-size functions. It is read-only. Its purpose is to show the live main, FSM, and VM fork footprint of one real table.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `relation_name` | `oid::regclass` | regclass | Schema-qualified relation name. |
| `main_fork_path` | `pg_relation_filepath(oid)` | text | Relative path of the main relation fork. |
| `main_fork_size` | `pg_relation_size(oid, 'main')` | text | Heap or index data fork size. |
| `fsm_fork_size` | `pg_relation_size(oid, 'fsm')` | text | Free space map fork size. |
| `vm_fork_size` | `pg_relation_size(oid, 'vm')` | text | Visibility map fork size. |

*This query inspects the current physical forks of `silver.stoxxusa50_ohlcv`.*

```sql
SELECT
    oid::regclass AS relation_name,
    pg_relation_filepath(oid) AS main_fork_path,
    pg_size_pretty(pg_relation_size(oid, 'main')) AS main_fork_size,
    pg_size_pretty(pg_relation_size(oid, 'fsm')) AS fsm_fork_size,
    pg_size_pretty(pg_relation_size(oid, 'vm')) AS vm_fork_size
FROM pg_class
WHERE oid = 'silver.stoxxusa50_ohlcv'::regclass;
```

| relation_name | main_fork_path | main_fork_size | fsm_fork_size | vm_fork_size |
|---|---|---|---|---|
| silver.stoxxusa50_ohlcv | base/16384/24872 | 8000 kB | 24 kB | 8192 bytes |

The main fork holds the actual heap rows. The FSM fork records where free space remains available, and the visibility map tracks which pages are all-visible or all-frozen for vacuum and index-only-scan purposes. That is why one logical table already spans multiple physical files even though it looks like one object in SQL.

## Write-Ahead Logging And Temporary Work Files

In PostgreSQL the durability path is WAL, and the temporary-work path is temp files on disk. Those are the two runtime storage surfaces that matter most when writes or large queries start stressing the engine.

### WAL position and cumulative pressure

The live outputs below establish the current cluster's WAL position and the amount of WAL activity accumulated since the current statistics reset.

#### Inspect the current WAL position and durability switches

Use this query when confirming the current WAL mode of the cluster, before reasoning about replication readiness, or while teaching how PostgreSQL protects data pages with full-page images. It is typically triggered by storage-baseline review or WAL troubleshooting. The query reads current settings and the current WAL insert location. It is read-only. Its purpose is to surface the current durability posture in one row.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `current_wal_lsn` | `pg_current_wal_lsn()` | pg_lsn | Current write-ahead log position. |
| `wal_level` | `current_setting('wal_level')` | text | Level of WAL detail produced by the server. |
| `full_page_writes` | `current_setting('full_page_writes')` | text | Whether PostgreSQL writes full page images after checkpoints to protect against torn pages. |
| `wal_compression` | `current_setting('wal_compression')` | text | Whether full-page images are compressed in WAL. |

*This query surfaces the current WAL position and the most important durability switches of the cluster.*

```sql
SELECT
    pg_current_wal_lsn() AS current_wal_lsn,
    current_setting('wal_level') AS wal_level,
    current_setting('full_page_writes') AS full_page_writes,
    current_setting('wal_compression') AS wal_compression;
```

| current_wal_lsn | wal_level | full_page_writes | wal_compression |
|---|---|---|---|
| 0/455F5E8 | replica | on | off |

The cluster is in a normal durable posture: `wal_level = replica` keeps physical-replication and PITR features available, and `full_page_writes = on` protects against torn-page hazards after checkpoints. `wal_compression = off` means full-page images are not being compressed in the current baseline.

#### Measure cumulative WAL generation since the current statistics reset

Use this query when checking whether large writes are generating meaningful WAL volume, after a bulk load, or during capacity and replication review. It is typically triggered by performance analysis or by an operational note that needs concrete WAL counters rather than generic statements about logging cost. The query reads `pg_stat_wal`. It is read-only. Its purpose is to expose how much WAL the cluster has generated since the current statistics reset.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `wal_records` | `pg_stat_wal.wal_records` | bigint | Number of WAL records generated. |
| `wal_fpi` | `pg_stat_wal.wal_fpi` | bigint | Number of full-page images written into WAL. |
| `wal_bytes` | `pg_stat_wal.wal_bytes` | text | Human-readable volume of WAL written. |
| `wal_buffers_full` | `pg_stat_wal.wal_buffers_full` | bigint | Number of times WAL buffers filled before being written out. |
| `stats_reset` | `pg_stat_wal.stats_reset` | timestamptz | Time when the WAL statistics were last reset. |

*This query reports cumulative WAL activity for the current cluster.*

```sql
SELECT
    wal_records,
    wal_fpi,
    pg_size_pretty(wal_bytes) AS wal_bytes,
    wal_buffers_full,
    stats_reset
FROM pg_stat_wal;
```

| wal_records | wal_fpi | wal_bytes | wal_buffers_full | stats_reset |
|---:|---:|---|---:|---|
| 307966 | 164 | 44 MB | 1141 | 2026-04-18 20:37:33.679131+00 |

This baseline already proves that the cluster is not idle from a durability perspective. About `44 MB` of WAL has been generated since the current stats reset. That is modest, but it is enough to make the point that even a small lab accumulates WAL quickly under migration, demo, and analysis work.

### Temporary work files instead of `tempdb`

PostgreSQL does not centralize temporary workload into a `tempdb` database. Instead, it creates temp files when query operators spill or need on-disk intermediate state.

#### Inspect temp-file counters for the current database

Use this query when investigating sort or hash spills, or when trying to prove that a workload is exceeding memory and materializing temporary files on disk. It is typically triggered by slow-query review, spill diagnostics, or storage-baseline teaching. The query reads `pg_stat_database`. It is read-only. Its purpose is to show whether the current database has already produced temp files and how much data those files contained.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `datname` | `pg_stat_database.datname` | name | Database name. |
| `temp_files` | `pg_stat_database.temp_files` | bigint | Number of temporary files created by this database. |
| `temp_bytes` | `pg_stat_database.temp_bytes` | text | Human-readable volume written to temp files. |
| `deadlocks` | `pg_stat_database.deadlocks` | bigint | Number of detected deadlocks. |
| `checksum_failures` | `pg_stat_database.checksum_failures` | bigint | Number of checksum failures, when checksums are enabled. |

*This query shows the current temp-file footprint of the `stoxx` database.*

```sql
SELECT
    datname,
    temp_files,
    pg_size_pretty(temp_bytes) AS temp_bytes,
    deadlocks,
    checksum_failures
FROM pg_stat_database
WHERE datname = 'stoxx';
```

| datname | temp_files | temp_bytes | deadlocks | checksum_failures |
|---|---:|---|---:|---|
| stoxx | 1 | 1888 kB | 0 |  |

Even this small lab has already created at least one temp file, totaling about `1888 kB`. That is the PostgreSQL equivalent of saying "a query already spilled beyond memory and touched the temp-work path." It is not inherently a problem, but it is a concrete signal that temp-file monitoring belongs in the operational toolkit.

## Mutation Costs

The key PostgreSQL difference from in-place-update engines is that updates create new tuple versions. The question then becomes whether PostgreSQL can keep that new version on the same page as a HOT update or whether it has to pay more index and cleanup cost.

### HOT updates, dead tuples, and fillfactor

The following demo creates a small table with `fillfactor = 70`, updates half the rows, and then reads the user-table statistics to see how many updates qualified as HOT.

#### Create and mutate a fillfactor-aware demo table

Use this demo when explaining why fillfactor exists and why PostgreSQL update cost depends on available page space. It is typically triggered by storage-internals teaching or by a workload that performs frequent updates on non-indexed columns. The statements create a reusable demo table in `demo_stc`, populate it, update half the rows, and then return the resulting row counts. The purpose is to establish a concrete update workload before reading the HOT counters.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `total_rows` | `COUNT(*)` | bigint | Number of rows present after the demo load. |
| `updated_rows` | `COUNT(*) FILTER (...)` | bigint | Number of rows carrying the widened updated payload. |

*This demo seeds a table with free space and then widens half the rows to create update churn.*

```sql
DROP TABLE IF EXISTS demo_stc.storage_hot_demo;

CREATE TABLE demo_stc.storage_hot_demo
(
    id integer PRIMARY KEY,
    payload text
)
WITH (fillfactor = 70);

INSERT INTO demo_stc.storage_hot_demo
SELECT
    g,
    repeat('x', 40)
FROM generate_series(1, 200) AS g;

UPDATE demo_stc.storage_hot_demo
SET payload = repeat('y', 60)
WHERE id <= 100;

SELECT
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (WHERE payload = repeat('y', 60)) AS updated_rows
FROM demo_stc.storage_hot_demo;
```

| total_rows | updated_rows |
|---:|---:|
| 200 | 100 |

The demo establishes exactly 200 rows and updates 100 of them. That is enough to produce visible tuple-version churn without creating a large or dangerous sandbox object.

#### Measure HOT and non-HOT updates after the mutation

Use this query immediately after the demo write workload, or after any real workload where the question is whether PostgreSQL managed to keep many updates HOT. It is typically triggered by bloat analysis, fillfactor review, or storage teaching. The query reads `pg_stat_user_tables`. It is read-only. Its purpose is to show how many inserted and updated tuples were recorded, how many of those updates were HOT, and how many dead tuples now exist.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `schemaname` | `pg_stat_user_tables.schemaname` | name | Schema that owns the table. |
| `relname` | `pg_stat_user_tables.relname` | name | Table name. |
| `n_tup_ins` | `pg_stat_user_tables.n_tup_ins` | bigint | Number of inserted tuples. |
| `n_tup_upd` | `pg_stat_user_tables.n_tup_upd` | bigint | Number of updated tuples. |
| `n_tup_hot_upd` | `pg_stat_user_tables.n_tup_hot_upd` | bigint | Number of HOT updates. |
| `n_dead_tup` | `pg_stat_user_tables.n_dead_tup` | bigint | Estimated number of dead tuples waiting for cleanup. |

*This query reads the live HOT-update counters for the demo table after the mutation workload.*

```sql
SELECT
    schemaname,
    relname,
    n_tup_ins,
    n_tup_upd,
    n_tup_hot_upd,
    n_dead_tup
FROM pg_stat_user_tables
WHERE schemaname = 'demo_stc'
  AND relname = 'storage_hot_demo';
```

| schemaname | relname | n_tup_ins | n_tup_upd | n_tup_hot_upd | n_dead_tup |
|---|---|---:|---:|---:|---:|
| demo_stc | storage_hot_demo | 200 | 100 | 48 | 100 |

Only `48` of the `100` updates qualified as HOT. That is the real lesson: a lower fillfactor improves the odds, but it does not guarantee that every update stays on-page. The remaining updates still created non-HOT row versions and left `100` dead tuples behind for later cleanup.

### What this means operationally

- Relation size alone is not the whole story. PostgreSQL also maintains FSM and visibility metadata in separate forks that matter for free-space reuse and vacuum behavior.
- WAL is always part of the write path for normal durable tables. Large loads should be evaluated for WAL volume, not just row count.
- Temp-file counters are the PostgreSQL equivalent of "temporary work touched disk". They matter any time sorts or hashes exceed memory.
- HOT updates are a probabilistic optimization shaped by fillfactor, page space, and indexed-column rules. They reduce update cost when they happen, but they do not remove the need to watch dead tuples and vacuum behavior.
