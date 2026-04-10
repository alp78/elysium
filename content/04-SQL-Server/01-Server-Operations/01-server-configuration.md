---
title: "01 - Server Configuration"
tags:
  - sql-server
  - administration
  - configuration
aliases:
  - SQL Server configuration
  - max server memory
  - TempDB configuration
description: "Production SQL Server instance-configuration baselines for memory, parallelism, TempDB, and Linux host settings, grounded on the current stoxx instance."
parent: "[[domain-server-operations]]"
links:
  - "[[06-essential-dba-queries]]"
  - "[[11-memory-and-buffer-pool]]"
  - "[[07-backup-types-and-strategy]]"
  - "[[08-restore-and-recovery]]"
  - "[[05-sql-server-agent-jobs]]"
  - "[[01-database-creation-and-file-layout]]"
created: 2026-03-22
updated: 2026-04-08
status: complete
---

# Server Configuration

This note focuses on the instance-level settings that decide whether a SQL Server instance behaves predictably in production. The defaults shipped by the product are not a production baseline. The point is not to change everything. The point is to verify the settings that materially affect stability, memory pressure, parallelism, TempDB allocation, and operational access.

Database-scoped settings such as recovery model, compatibility level, Query Store, and row-versioned isolation live in [[01-database-creation-and-file-layout]]. Table-shape guardrails such as clustered-vs-heap decisions live in [[03-schemas-tables-and-constraints]].

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

Database-level defaults such as recovery model, compatibility level, Query Store, row-versioning, and heap-vs-clustered decisions are covered in [[01-database-creation-and-file-layout]] and [[03-schemas-tables-and-constraints]].

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

- [[06-essential-dba-queries]] for the live precheck queries used to validate these settings
- [[11-memory-and-buffer-pool]] for memory interpretation after setting a server memory cap
- [[07-backup-types-and-strategy]] for the operational consequences of the recovery model choice
- [[05-sql-server-agent-jobs]] for why `Agent XPs = 0` currently aligns with the instance state
- [[07-index-maintenance]] for the maintenance consequences of heap prevention and TempDB sizing
