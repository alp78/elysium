---
title: "Server Configuration"
tags:
  - sql-server
  - administration
  - configuration
aliases:
  - SQL Server configuration
  - max server memory
  - TempDB configuration
  - RCSI
description: "Production SQL Server configuration baselines for memory, parallelism, recovery model, RCSI, heap prevention, TempDB, and Linux host settings, grounded on the current stoxx instance."
parent: "[[domain-server-operations]]"
links:
  - "[[essential-dba-queries]]"
  - "[[memory-and-buffer-pool]]"
  - "[[backup-types-and-strategy]]"
  - "[[restore-and-recovery]]"
  - "[[sql-server-agent-jobs]]"
  - "[[index-maintenance]]"
created: 2026-03-22
updated: 2026-04-08
status: complete
---

# Server Configuration

This note focuses on the configuration settings that decide whether a SQL Server instance behaves predictably in production. The defaults shipped by the product are not a production baseline. The point is not to change everything. The point is to verify the settings that materially affect stability, memory pressure, transaction-log behavior, blocking, TempDB allocation, and operational access.

The live outputs in this note come from the current `stoxx` instance, which is:

- SQL Server 2022 CU23
- Developer Edition
- Linux-hosted engine
- 16 visible CPUs
- approximately 24.7 GB physical memory on the host

---

## Instance Baseline

Start by checking the small set of instance-level settings that most often separate a safe production build from a lab default.

### High-Impact Instance Settings

This subsection focuses on the settings that most directly affect memory pressure, parallelism, backup behavior, ad hoc plan-cache waste, emergency access, and Agent availability.

#### Current configuration values for the settings that matter first

> [!info]-
> This query reads `sys.configurations`, the instance-wide catalog for `sp_configure` settings.
>
> - `value` is the configured value stored in metadata.
> - `value_in_use` is the effective running value. For dynamic settings, it usually matches `value` immediately after `RECONFIGURE`. For restart-required settings, it may differ until the instance restarts.
> - `is_dynamic = 1` means the change can take effect without an engine restart.
> - `is_advanced = 1` means the setting is hidden until `show advanced options` is enabled.
>
> The current filter intentionally selects only the settings that most often need review on a new or inherited production instance.
>
> *This query shows the effective values of the instance settings that usually need explicit production decisions rather than product defaults.*
>
```sql
SELECT
    name,
    value,
    value_in_use,
    is_dynamic,
    is_advanced
FROM sys.configurations
WHERE name IN
(
    'Agent XPs',
    'backup compression default',
    'contained database authentication',
    'cost threshold for parallelism',
    'max degree of parallelism',
    'max server memory (MB)',
    'min server memory (MB)',
    'optimize for ad hoc workloads',
    'remote admin connections'
)
ORDER BY name;
```

| name | value | value_in_use | is_dynamic | is_advanced |
|---|---:|---:|---:|---:|
| Agent XPs | 0 | 0 | 1 | 1 |
| backup compression default | 0 | 0 | 1 | 0 |
| contained database authentication | 0 | 0 | 1 | 0 |
| cost threshold for parallelism | 5 | 5 | 1 | 1 |
| max degree of parallelism | 0 | 0 | 1 | 1 |
| max server memory (MB) | 2147483647 | 2147483647 | 1 | 1 |
| min server memory (MB) | 0 | 16 | 1 | 1 |
| optimize for ad hoc workloads | 0 | 0 | 1 | 1 |
| remote admin connections | 0 | 0 | 1 | 0 |

*This is a lab-default configuration, not a production baseline. The most important problems are `max server memory (MB) = 2147483647`, which leaves SQL Server effectively uncapped, `cost threshold for parallelism = 5`, which is the overly permissive product default, `max degree of parallelism = 0`, which defers the decision entirely to SQL Server defaults, and `optimize for ad hoc workloads = 0`, which allows more plan-cache waste from single-use ad hoc plans. `backup compression default = 0` means backups do not compress unless the command explicitly asks for it. `remote admin connections = 0` means the DAC is local-only. `Agent XPs = 0` aligns with the current instance state where Agent is not enabled.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `name` | `max server memory (MB)` with a finite cap | &#9989; | SQL Server memory ceiling is explicit | Prevents the engine from consuming nearly all host memory |
| `name` | `max server memory (MB) = 2147483647` | &#10060; | Effectively uncapped | High risk of OS memory starvation |
| `name` | `cost threshold for parallelism = 5` | &#10060; in most production systems | Product default | Parallel plans are considered too cheaply |
| `name` | `max degree of parallelism = 0` | Watch | Product default behavior | May be acceptable in limited cases, but should be a deliberate decision |
| `name` | `optimize for ad hoc workloads = 1` | &#9989; for ad hoc-heavy estates | Store plan stub on first execution | Reduces plan-cache waste from one-off queries |
| `name` | `backup compression default = 1` | &#9989; in most estates | Backups compress unless overridden | Reduces backup size and storage cost |
| `name` | `remote admin connections = 1` | Context dependent | DAC accessible remotely | Useful for remote incident response, but widen access carefully |
| `value` vs `value_in_use` | Different | Watch | Configured and effective values diverge | Restart or `RECONFIGURE` requirement may still be pending |

### CPU And Memory Context

Configuration values are not meaningful without the host context they run in. This subsection shows how much CPU and target memory SQL Server sees.

#### CPU count and current committed versus target memory

> [!info]-
> This query reads `sys.dm_os_sys_info`.
>
> - `cpu_count` is the number of visible logical CPUs.
> - `scheduler_count` is the number of visible SQLOS schedulers.
> - `committed_mb` is the memory SQL Server currently has committed.
> - `committed_target_mb` and `visible_target_mb` represent the current target memory the engine believes it can use.
>
> These values are the context for `max degree of parallelism` and `max server memory`. Without them, a configuration value has no operational scale.
>
> *This query shows the CPU footprint and the memory target SQL Server is currently aiming for on this host.*
>
```sql
SELECT
    sqlserver_start_time,
    cpu_count,
    scheduler_count,
    committed_kb / 1024 AS committed_mb,
    committed_target_kb / 1024 AS committed_target_mb,
    visible_target_kb / 1024 AS visible_target_mb
FROM sys.dm_os_sys_info;
```

| sqlserver_start_time | cpu_count | scheduler_count | committed_mb | committed_target_mb | visible_target_mb |
|---|---:|---:|---:|---:|---:|
| 2026-04-08 08:42:34.510 | 16 | 16 | 5402 | 22824 | 22824 |

*SQL Server currently sees 16 logical CPUs and a memory target of about 22.8 GB, while only about 5.4 GB is committed at this moment. That combination matters: the engine is allowed to grow much larger than its current usage, and because `max server memory` is effectively uncapped, SQL Server could continue expanding toward the host-visible target unless external pressure stops it. This is exactly the kind of instance where a production memory cap should be deliberate, not left at the product default.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `cpu_count` | `16` | Context | Visible logical CPU count | Useful for MAXDOP and TempDB sizing decisions |
| `scheduler_count` | Close to `cpu_count` | &#9989; | Expected scheduler visibility | Normal engine scheduling surface |
| `committed_mb` | Far below `committed_target_mb` | Context | SQL Server is not yet using all target memory | Memory is available for workload growth |
| `committed_mb` | Near `committed_target_mb` | Watch | Engine is near its target | Normal on busy instances, but check OS headroom |

### Recommended Configuration Actions

The current baseline calls for a small number of concrete changes before this instance can be called production-safe.

#### Set a memory cap, backup compression, and ad hoc plan protection

> [!warning]
> Do not copy these values blindly between servers. `max server memory (MB)` must be sized against the real host memory, other resident processes, and HA tooling. A bad memory cap can starve either SQL Server or the operating system.
>
> [!success]
> Use these commands as a pattern, then adjust the numeric memory value for the actual server. On this host, a cap in the high teens of GB would be a more realistic starting point than leaving the engine uncapped.
>
> [!info]-
> This batch enables advanced options, then changes three settings that are usually safe production improvements on SQL Server estates:
>
> - `max server memory (MB)` sets an explicit memory ceiling.
> - `backup compression default` makes compression the default behavior for full, differential, and log backups unless a backup command overrides it.
> - `optimize for ad hoc workloads` reduces plan-cache waste by storing a stub on first execution of one-off ad hoc batches.
>
> All three settings are dynamic and take effect after `RECONFIGURE`.
>
> *This batch applies the most common first-round production configuration corrections for memory governance, backup storage efficiency, and ad hoc plan-cache hygiene.*
>
```sql
EXEC sp_configure 'show advanced options', 1;
RECONFIGURE;

EXEC sp_configure 'max server memory (MB)', 18432;
EXEC sp_configure 'backup compression default', 1;
EXEC sp_configure 'optimize for ad hoc workloads', 1;
RECONFIGURE;
```

#### Set parallelism defaults deliberately

> [!warning]
> Do not treat `MAXDOP = 8` and `cost threshold for parallelism = 50` as universal truth. They are common starting points, not magical constants.
>
> [!success]
> Use them as a starting baseline, then validate with wait stats, CPU pressure, and actual plan behavior. If the server has a different NUMA layout or workload class, tune from evidence rather than dogma.
>
> [!info]-
> This batch sets the two instance-level parallelism defaults that are most often left at unsafe product defaults:
>
> - `max degree of parallelism` limits how many schedulers a single parallel plan can use.
> - `cost threshold for parallelism` controls how expensive a query must appear before the optimizer even considers a parallel plan.
>
> The shipped default of `5` for cost threshold is usually too low on modern hardware.
>
> *This batch sets an explicit starting baseline for SQL Server parallelism instead of relying on the product defaults.*
>
```sql
EXEC sp_configure 'show advanced options', 1;
RECONFIGURE;

EXEC sp_configure 'max degree of parallelism', 8;
EXEC sp_configure 'cost threshold for parallelism', 50;
RECONFIGURE;
```

---

## Database Defaults

Some of the highest-impact settings are not instance-level at all. Recovery model and RCSI are per-database decisions, and heap prevention is a schema-design guard rather than a server knob.

### Recovery Model And RCSI

This subsection verifies the database-level defaults that matter most for backup strategy and reader-writer blocking behavior.

#### Current recovery model, compatibility level, RCSI, and log-reuse state for `stoxx`

> [!info]-
> This query pulls the key database-level flags from `sys.databases` for the main workload database.
>
> - `recovery_model_desc` drives the backup chain and PITR capability.
> - `compatibility_level` controls optimizer behavior and T-SQL compatibility surface.
> - `is_read_committed_snapshot_on` shows whether read committed uses row versioning.
> - `log_reuse_wait_desc` tells you why the log cannot currently reuse inactive virtual log files.
>
> *This query checks the production-relevant database defaults for the primary workload database instead of assuming the instance baseline is enough.*
>
```sql
SELECT
    name,
    recovery_model_desc,
    compatibility_level,
    is_read_committed_snapshot_on,
    log_reuse_wait_desc
FROM sys.databases
WHERE name = 'stoxx';
```

| name | recovery_model_desc | compatibility_level | is_read_committed_snapshot_on | log_reuse_wait_desc |
|---|---|---:|---:|---|
| stoxx | FULL | 160 | 0 | ACTIVE_TRANSACTION |

*`stoxx` is correctly on compatibility level 160 and deliberately in `FULL` recovery model, but `is_read_committed_snapshot_on = 0` means the database still uses locking-based read committed semantics. In a mixed read/write production workload, that leaves ordinary reader-writer blocking in place unless the application explicitly uses other isolation levels. `log_reuse_wait_desc = ACTIVE_TRANSACTION` means the current log reuse issue is transactional, not proof that log backups are missing at this exact moment.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `recovery_model_desc` | `FULL` | Context dependent | PITR-capable recovery model | Pair with actual log backups, not just intention |
| `is_read_committed_snapshot_on` | `0` | Watch | Shared-lock read committed semantics | Reader-writer blocking remains possible |
| `is_read_committed_snapshot_on` | `1` | &#9989; for many mixed workloads | Row-versioned read committed | Reduces blocking without application query changes |
| `log_reuse_wait_desc` | `ACTIVE_TRANSACTION` | Watch | Open transaction prevents reuse | Investigate transaction scope and blocking |

#### Enable Read Committed Snapshot Isolation

> [!warning]
> Enabling RCSI is a database-wide behavioral change. It requires exclusive access to the database during the `ALTER DATABASE` statement, and it shifts read consistency to TempDB-backed row versioning.
>
> [!success]
> Use RCSI when the workload suffers from ordinary reader-writer blocking and the application expects statement-level committed reads rather than dirty reads. Monitor version-store growth in TempDB afterward.
>
> [!info]-
> `READ_COMMITTED_SNAPSHOT ON` changes the meaning of the default read committed isolation level for that database:
>
> - readers stop taking shared locks for ordinary reads
> - writers continue taking exclusive locks
> - readers see the last committed row version as of statement start
>
> This is one of the highest-leverage concurrency settings available for OLTP and mixed reporting workloads.
>
> *This command enables statement-level row-versioned read committed semantics for the database.*
>
```sql
ALTER DATABASE stoxx
SET READ_COMMITTED_SNAPSHOT ON;
```

### Heap Prevention

Heap prevention is not a cosmetic preference. Permanent silver and gold tables should not be left as heaps unless there is a very specific and justified design reason.

#### Check for heap tables in `silver` and `gold`

> [!info]-
> This query looks for user tables in `silver` and `gold` that do not have a clustered index (`index_id = 1`).
>
> - If it returns rows, those tables are heaps.
> - If it returns no rows, the schema already satisfies the clustered-index guardrail for those layers.
>
> *This query checks whether any permanent `silver` or `gold` tables are currently deployed as heaps.*
>
```sql
SELECT
    OBJECT_SCHEMA_NAME(t.object_id, DB_ID()) AS schema_name,
    t.name AS table_name
FROM sys.tables AS t
LEFT JOIN sys.indexes AS i
    ON i.object_id = t.object_id
   AND i.index_id = 1
WHERE OBJECT_SCHEMA_NAME(t.object_id, DB_ID()) IN ('silver', 'gold')
  AND i.object_id IS NULL
ORDER BY schema_name, table_name;
```

| Result |
|---|
| No rows returned |

*This is the outcome you want for these layers. No `silver` or `gold` heap tables were found, which means the permanent analytical layers already satisfy the basic clustered-index guardrail. That does not prove every clustered key is well chosen, but it does eliminate the most obvious heap-related scan and forwarded-record risk.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `Result` | `No rows returned` | &#9989; | No heaps found in the scoped schemas | The schema satisfies the "no permanent heaps in silver/gold" guardrail |
| `schema_name`, `table_name` rows present | Any row | &#10060; | A table exists without a clustered index | Review table design and add a clustered index unless there is a justified exception |

---

## TempDB

TempDB configuration is one of the few engine-level areas where file layout still matters materially for concurrency and operational stability.

### File Layout

This subsection verifies the number of TempDB files, their size parity, and their growth pattern.

#### Current TempDB data-file and log-file layout

> [!info]-
> This query reads `tempdb.sys.database_files`.
>
> - Data-file count and size parity matter because proportional fill distributes allocations based on free space.
> - Equal file sizes and equal fixed autogrowth increments are the standard baseline.
> - Percentage growth is undesirable for TempDB because growth events become larger over time.
>
> *This query verifies whether TempDB is laid out with equal-sized data files and fixed-size growth increments.*
>
```sql
SELECT
    file_id,
    name,
    type_desc,
    physical_name,
    CAST(size * 8.0 / 1024 AS decimal(12,2)) AS size_mb,
    growth,
    is_percent_growth
FROM tempdb.sys.database_files
ORDER BY file_id;
```

| file_id | name | type_desc | physical_name | size_mb | growth | is_percent_growth |
|---:|---|---|---|---:|---:|---:|
| 1 | tempdev | ROWS | /var/opt/mssql/data/tempdb.mdf | 328.00 | 8192 | 0 |
| 2 | templog | LOG | /var/opt/mssql/data/templog.ldf | 72.00 | 8192 | 0 |
| 3 | tempdev2 | ROWS | /var/opt/mssql/data/tempdb2.ndf | 328.00 | 8192 | 0 |
| 4 | tempdev3 | ROWS | /var/opt/mssql/data/tempdb3.ndf | 328.00 | 8192 | 0 |
| 5 | tempdev4 | ROWS | /var/opt/mssql/data/tempdb4.ndf | 328.00 | 8192 | 0 |
| 6 | tempdev5 | ROWS | /var/opt/mssql/data/tempdb5.ndf | 328.00 | 8192 | 0 |
| 7 | tempdev6 | ROWS | /var/opt/mssql/data/tempdb6.ndf | 328.00 | 8192 | 0 |
| 8 | tempdev7 | ROWS | /var/opt/mssql/data/tempdb7.ndf | 328.00 | 8192 | 0 |
| 9 | tempdev8 | ROWS | /var/opt/mssql/data/tempdb8.ndf | 328.00 | 8192 | 0 |

*This TempDB layout is already in good shape. There are eight equal-sized data files, which is the usual starting point for a 16-CPU host, and every file uses fixed-size autogrowth. That means TempDB is not currently suffering from the classic single-file or uneven-growth layout mistake.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `type_desc` | `ROWS` on multiple equal files | &#9989; | Multiple TempDB data files exist | Better concurrency on TempDB allocations |
| `type_desc` | Single `ROWS` file only | &#10060; | Single TempDB data-file layout | Greater risk of allocation contention under concurrency |
| `is_percent_growth` | `0` | &#9989; | Fixed-size growth | Predictable growth events |
| `is_percent_growth` | `1` | &#10060; | Percentage-based growth | Increasingly large and less predictable growth operations |

#### Add TempDB files when the layout is undersized

> [!warning]
> Do not keep adding TempDB files just because "more must be better." Add files only when the current layout is actually undersized or contention evidence justifies it.
>
> [!success]
> When more files are warranted, keep all TempDB data files the same size and the same fixed autogrowth increment.
>
> *This command pattern adds one additional TempDB data file with the same size and growth behavior as the existing data files.*
>
```sql
ALTER DATABASE tempdb ADD FILE
(
    NAME = 'tempdev9',
    FILENAME = '/var/opt/mssql/data/tempdb9.ndf',
    SIZE = 328MB,
    FILEGROWTH = 64MB
);
```

---

## Linux Host Settings

The SQL Server instance in this environment runs on Linux, so there are a few host-level checks that still matter even though they are outside T-SQL.

### Host Checks

These commands must be run on the Linux host that runs SQL Server, not from SSMS.

#### Verify Linux memory and I/O settings on the SQL Server host

> [!warning]
> These are host-level commands. They do not run inside SQL Server and they should not be tested blindly on unrelated Linux machines.
>
> [!success]
> Run them only on the SQL Server host and treat them as verification commands first. Change values only when you understand the current host baseline and the platform standard for that fleet.
>
> [!info]-
> These commands check the three Linux host settings that most often matter for SQL Server behavior on Linux:
>
> - `vm.swappiness` controls how aggressively the kernel prefers swap activity
> - Transparent Huge Pages can introduce latency spikes
> - the block-device scheduler affects how SSD-backed storage requests are ordered
>
> *These commands verify the Linux host settings that most often matter to SQL Server latency and memory behavior on Linux.*
>
```bash
cat /proc/sys/vm/swappiness
cat /sys/kernel/mm/transparent_hugepage/enabled
cat /sys/block/sdb/queue/scheduler
```

#### Configure the Linux host baseline when needed

> [!warning]
> These changes affect the Linux host globally, not only SQL Server. They should be applied through the host configuration standard for the environment, not as ad hoc shell changes that drift from configuration management.
>
> [!success]
> Persist them through the host's normal configuration-management path so the settings survive reboot and remain auditable.
>
> *This command set shows the common Linux-host pattern for reducing swap aggressiveness, disabling THP, and using the `none` scheduler on SSD-backed devices.*
>
```bash
sudo sysctl vm.swappiness=1
echo never | sudo tee /sys/kernel/mm/transparent_hugepage/enabled
echo none | sudo tee /sys/block/sdb/queue/scheduler
```

---

## Related

- [[essential-dba-queries]] for the live precheck queries used to validate these settings
- [[memory-and-buffer-pool]] for memory interpretation after setting a server memory cap
- [[backup-types-and-strategy]] for the operational consequences of the recovery model choice
- [[sql-server-agent-jobs]] for why `Agent XPs = 0` currently aligns with the instance state
- [[index-maintenance]] for the maintenance consequences of heap prevention and TempDB sizing
