---
title: "16 - Performance Audit Playbook"
tags: [performance, sql, sql-server, tsql]
aliases: [SQL Server audit, performance audit, health check, DBA audit, instance audit]
description: "Production-first SQL Server performance audit playbook with live stoxx outputs for baseline configuration, memory, waits, I/O, query cache, index health, TempDB, blocking, statistics, file growth, and security."
parent: "[[domain-server-operations]]"
links:
  - "[[11-sargable-queries]]"
  - "[[10-merge-and-upsert]]"
  - "[[08-date-and-time-functions]]"
  - "[[12-execution-plans]]"
  - "[[19-query-store-regressions-and-plan-forcing]]"
  - "[[13-wait-stats-analysis]]"
  - "[[11-memory-and-buffer-pool]]"
  - "[[07-index-maintenance]]"
  - "[[07-pipeline-integration-and-devex]]"
  - "[[06-pit-integrity-logic]]"
created: 2026-03-22
updated: 2026-04-08
status: complete
---

# Performance Audit Playbook

This page is a production audit sequence, not a bag of disconnected DMV snippets. The goal is to move from instance context to workload signals, then to physical design, concurrency, capacity, and security. The queries are written in a production-facing form and the outputs below are real results from the current `stoxx` instance.

Run the phases in order. The first phase sets the confidence boundary for every later phase, especially when the instance has recently restarted and DMV history is short.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {
  'primaryColor': '#292e42',
  'primaryTextColor': '#c0caf5',
  'primaryBorderColor': '#565f89',
  'lineColor': '#565f89',
  'secondaryColor': '#1a1b26',
  'tertiaryColor': '#24283b',
  'noteTextColor': '#c0caf5',
  'noteBkgColor': '#292e42',
  'textColor': '#c0caf5',
  'fontSize': '14px'
}}}%%
flowchart TD
    A["Start audit"] --> B["Phase 1<br/>Baseline and confidence"]
    B --> C{"Uptime and config<br/>support strong conclusions?"}
    C --> Y1([YES])
    C --> N1([NO])
    Y1 --> D["Trust cumulative DMVs more"]
    N1 --> E["Add limited-history disclaimer<br/>and favor point-in-time checks"]
    D --> F["Memory and waits"]
    E --> F
    F --> G{"Pressure or instability<br/>visible?"}
    G --> Y2([YES])
    G --> N2([NO])
    Y2 --> H["Correlate with I/O, queries,<br/>indexes, TempDB, and blocking"]
    N2 --> I["Validate files, stats,<br/>security, and growth settings"]
    H --> J["Compile report"]
    I --> J

    classDef yesNode fill:#1f3b2d,stroke:#73d13d,stroke-width:2px,color:#c0caf5,font-weight:bold;
    classDef noNode fill:#4a1f24,stroke:#db4b4b,stroke-width:2px,color:#c0caf5,font-weight:bold;
    class Y1,Y2 yesNode;
    class N1,N2 noNode;
```

## Phase 1 | Instance Baseline

This phase establishes what can be trusted. Version determines available behavior and fixes. Uptime determines how much history DMVs and cumulative counters contain. Core configuration determines whether later symptoms come from workload problems, bad defaults, or both.

### Instance and database context

This subsection captures the engine baseline in one row, then checks the per-database defaults that most often distort a production audit.

#### Capture the instance baseline

The first query below is the audit anchor. It pulls version and patch metadata from `SERVERPROPERTY`, uptime and hardware-visible memory state from `sys.dm_os_sys_info`, and the instance-level configuration values that most strongly shape CPU and memory behavior.

> [!info]-
> This query combines three categories of information into one output row.
>
> - `SERVERPROPERTY('ProductVersion')`, `SERVERPROPERTY('Edition')`, and `SERVERPROPERTY('ProductLevel')` identify the engine build, edition, and patch branch. These affect available features and supported tuning advice.
> - `DATEDIFF(DAY, sqlserver_start_time, GETDATE())` measures how old the in-memory DMV history is. Wait stats, query stats, index-usage stats, and many counters are only meaningful in the context of uptime.
> - `cpu_count`, `physical_memory_kb`, `committed_kb`, and `committed_target_kb` come from `sys.dm_os_sys_info` and show the host-visible CPU count and SQL Server memory posture.
> - The scalar subqueries against `sys.configurations` retrieve the currently active values for `MAXDOP`, cost threshold, `max server memory`, and `optimize for ad hoc workloads`.
> - The result is intentionally one row so the audit can begin with a compact baseline snapshot that is easy to compare across environments.
>
> *Capture the SQL Server build, uptime, CPU and memory posture, and the core configuration values that govern parallelism, memory growth, and ad hoc plan caching.*
>
```sql
SELECT
    SERVERPROPERTY('ProductVersion') AS version,
    SERVERPROPERTY('Edition') AS edition,
    SERVERPROPERTY('ProductLevel') AS patch_level,
    DATEDIFF(DAY, sqlserver_start_time, GETDATE()) AS uptime_days,
    cpu_count AS logical_cpus,
    physical_memory_kb / 1024 AS physical_memory_mb,
    committed_kb / 1024 AS committed_mb,
    committed_target_kb / 1024 AS target_mb,
    (SELECT value_in_use FROM sys.configurations WHERE name = 'max degree of parallelism') AS maxdop,
    (SELECT value_in_use FROM sys.configurations WHERE name = 'cost threshold for parallelism') AS cost_threshold_for_parallelism,
    (SELECT value_in_use FROM sys.configurations WHERE name = 'max server memory (MB)') AS max_server_memory_mb,
    (SELECT value_in_use FROM sys.configurations WHERE name = 'optimize for ad hoc workloads') AS optimize_for_ad_hoc_workloads
FROM sys.dm_os_sys_info;
```

| version | edition | patch_level | uptime_days | logical_cpus | physical_memory_mb | committed_mb | target_mb | maxdop | cost_threshold_for_parallelism | max_server_memory_mb | optimize_for_ad_hoc_workloads |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `16.0.4236.2` | `Developer Edition (64-bit)` | `RTM` | 0 | 16 | 24732 | 5418 | 22824 | 0 | 5 | 2147483647 | 0 |

_This instance is running SQL Server 2022 on a fresh uptime boundary: `uptime_days = 0`. That immediately reduces the confidence of every cumulative DMV below. The configuration row also exposes three production issues before any workload analysis starts: `maxdop = 0` on a 16-logical-CPU host, `cost threshold for parallelism = 5`, and `max server memory (MB)` left at the effectively-unlimited default. `optimize for ad hoc workloads = 0` becomes relevant again in Phase 9, where ad hoc plans dominate cache memory._

> [!warning]
> The low uptime means Phases 3, 5, 6, 8, and 9 do not yet represent a full business cycle.
>
> [!success]
> Use the current outputs as point-in-time evidence, and repeat the cumulative phases after a representative workload window before making lasting configuration changes.
>
| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `uptime_days` | `0` | &#10060; | DMV and cumulative counter history started today. | Waits, cached-query rankings, and missing-index evidence are limited-history signals only. |
| `uptime_days` | `>= 7` | &#9989; | The instance has at least one week of history. | Cumulative DMVs are usually much more representative. |
| `maxdop` | `0` | &#10060; on larger servers | A single query can use all available schedulers, subject to optimizer choice. | Can amplify parallel overhead and distort wait patterns. |
| `cost_threshold_for_parallelism` | `5` | &#10060; on modern production systems | Very cheap statements can qualify for parallel plans. | Common source of unnecessary `CX*` waits and worker pressure. |
| `max_server_memory_mb` | `2147483647` | &#10060; | SQL Server is effectively uncapped. | The OS becomes the back-pressure mechanism instead of the configuration. |
| `optimize_for_ad_hoc_workloads` | `0` | Depends | First execution of an ad hoc statement stores a full plan. | Usually acceptable on well-parameterized workloads, but wasteful on ad hoc-heavy ones. |
| `committed_mb` vs `target_mb` | `5418` vs `22824` | &#9989; right now | SQL Server has room to grow under current workload. | The immediate issue is configuration hygiene, not current internal memory starvation. |

#### Review database inventory and risky defaults

The next query inspects `sys.databases`, which is where recovery model, compatibility level, RCSI, auto-shrink, and auto-stats settings are exposed for every database on the instance.

> [!info]-
> This query is a production inventory query, not a lab shortcut.
>
> - `state_desc` tells you whether the database is actually online and queryable.
> - `recovery_model_desc` matters for log reuse and backup-chain expectations.
> - `compatibility_level` determines optimizer behavior and whether modern IQP features are even available.
> - `is_read_committed_snapshot_on` indicates whether default `READ COMMITTED` readers use row-versioning instead of shared locks.
> - `is_auto_shrink_on`, `is_auto_create_stats_on`, and `is_auto_update_stats_on` surface database-level defaults that can quietly degrade performance if they are wrong.
>
> *Inventory database state, recovery model, compatibility level, RCSI, and auto-statistics defaults across the instance.*
>
```sql
SELECT
    name,
    state_desc,
    recovery_model_desc,
    compatibility_level,
    is_read_committed_snapshot_on AS rcsi,
    is_auto_shrink_on AS auto_shrink,
    is_auto_create_stats_on AS auto_stats,
    is_auto_update_stats_on AS auto_update_stats
FROM sys.databases
ORDER BY name;
```

| name | state_desc | recovery_model_desc | compatibility_level | rcsi | auto_shrink | auto_stats | auto_update_stats |
|---|---|---|---:|---:|---:|---:|---:|
| `master` | `ONLINE` | `SIMPLE` | 160 | 0 | 0 | 1 | 1 |
| `model` | `ONLINE` | `FULL` | 160 | 0 | 0 | 1 | 1 |
| `msdb` | `ONLINE` | `SIMPLE` | 160 | 0 | 0 | 1 | 1 |
| `stoxx` | `ONLINE` | `FULL` | 160 | 0 | 0 | 1 | 1 |
| `tempdb` | `ONLINE` | `SIMPLE` | 160 | 0 | 0 | 1 | 1 |

_The database-level defaults are mostly healthy: all databases are online, `compatibility_level = 160`, `auto_shrink = 0`, and automatic statistics are enabled. The operational questions are narrower. `stoxx` is in `FULL` recovery model, so later log-reuse findings must be evaluated in that context. `rcsi = 0` is not automatically wrong, but on mixed read/write workloads it usually deserves an explicit decision rather than being left implicit._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `state_desc` | `ONLINE` | &#9989; | Database is available for normal access. | Baseline healthy state. |
| `state_desc` | Anything else | &#10060; | Restore, recovery, offline, suspect, or transitional state. | Performance findings may be secondary to a more serious availability problem. |
| `compatibility_level` | `160` | &#9989; | SQL Server 2022 database compatibility level. | Modern optimizer and IQP features can be used. |
| `rcsi` | `0` | Depends | Default read-committed behavior still uses locking, not row-versioning. | On busy OLTP systems, reader/writer blocking deserves special attention. |
| `rcsi` | `1` | Depends | `READ COMMITTED` uses row versions. | Reduces reader/writer blocking, but increases `tempdb` version-store use. |
| `auto_shrink` | `0` | &#9989; | Auto-shrink is disabled. | Avoids shrink/regrow churn and fragmentation. |
| `auto_shrink` | `1` | &#10060; | Database can shrink itself automatically. | Strong operational anti-pattern; usually disable immediately. |
| `auto_stats` / `auto_update_stats` | `1` | &#9989; | Automatic statistics creation and refresh are enabled. | Sensible default for most workloads. |
| `recovery_model_desc` | `FULL` | Depends | Full recovery chain expected. | Log reuse must be interpreted with backup and restore policy in mind. |

## Phase 2 | Memory and Buffer Pool

This phase checks whether the instance is actually under memory pressure, how the buffer pool is distributed, and whether any query is currently waiting for a memory grant. For deeper clerk-level analysis and process-memory detail, use [[11-memory-and-buffer-pool]] after this phase.

### Working-set and memory-pressure checks

These queries answer three different questions: who owns the buffer pool, whether page churn is high, and whether any query is blocked waiting for workspace memory.

#### Measure buffer-pool ownership by database

> [!info]-
> `sys.dm_os_buffer_descriptors` exposes one row per data page currently cached in the buffer pool.
>
> - `database_id` is translated with `DB_NAME` so the result is readable without a join.
> - `COUNT(*) * 8 / 1024` converts cached pages into megabytes because SQL Server pages are 8 KB each.
> - Grouping by database shows whether one database is dominating the cache and pushing other workloads out of RAM.
> - The `NULL` database row represents pages that are not associated with a user database in the normal way, such as free buffers or internal allocations.
>
> *Measure how much of the buffer pool is currently occupied by each database.*
>
```sql
SELECT
    DB_NAME(database_id) AS db_name,
    COUNT(*) * 8 / 1024 AS buffer_pool_mb
FROM sys.dm_os_buffer_descriptors
GROUP BY database_id
ORDER BY buffer_pool_mb DESC;
```

| db_name | buffer_pool_mb |
|---|---:|
| `stoxx` | 689 |
| `tempdb` | 197 |
| `NULL` | 24 |
| `model_msdb` | 4 |
| `msdb` | 4 |
| `model_replicatedmaster` | 3 |
| `master` | 2 |
| `model` | 0 |

_`stoxx` owns most of the useful cache, which is expected on a single-user-database instance. `tempdb` at `197 MB` is noticeable but not alarming. Nothing in this distribution suggests a multi-database cache fight. The more important point is scale: the instance is using well under 1 GB of data cache on a host that exposes far more memory, so the current buffer-pool shape does not indicate pressure by itself._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `db_name` | User database dominates | Depends | Most cache belongs to the main workload database. | Usually normal on single-tenant instances. |
| `db_name` | `tempdb` unusually large | Depends | Temp objects, spills, or version-store activity are consuming cache. | Correlate with Phase 7 before calling it a problem. |
| `db_name` | `NULL` small | &#9989; | Minor internal or unassigned buffer usage. | Normal. |
| `buffer_pool_mb` | Concentrated in one DB with healthy PLE | &#9989; | Working set is stable in memory. | Not a standalone concern. |
| `buffer_pool_mb` | One DB dominates while others thrash | &#10060; context-dependent | One workload may be flushing others from cache. | Validate with low PLE, scans, and I/O waits before acting. |

#### Check Page Life Expectancy by buffer node

> [!info]-
> `sys.dm_os_performance_counters` exposes both the aggregate `Buffer Manager` PLE and per-node `Buffer Node` PLE.
>
> - `counter_name = 'Page life expectancy'` filters to the exact metric.
> - `object_name LIKE '%Buffer%'` returns both the aggregate object and any per-node counters.
> - Comparing node-level values is important on NUMA systems because a healthy aggregate can hide one starved node.
>
> *Check how long pages remain in memory at both the aggregate and per-node level.*
>
```sql
SELECT
    object_name,
    counter_name,
    instance_name,
    cntr_value AS ple_seconds
FROM sys.dm_os_performance_counters
WHERE counter_name = 'Page life expectancy'
  AND object_name LIKE '%Buffer%'
ORDER BY object_name, instance_name;
```

| object_name | counter_name | instance_name | ple_seconds |
|---|---|---|---:|
| `SQLServer:Buffer Manager` | `Page life expectancy` |  | 18007 |
| `SQLServer:Buffer Node` | `Page life expectancy` | `000` | 18007 |

_This is a healthy point-in-time PLE result. `18007` seconds is roughly five hours, which means cached pages are not churning out quickly. The matching aggregate and node-level values also show there is no visible NUMA imbalance in this environment. On this host, low PLE is not the bottleneck to chase first._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `ple_seconds` | High and stable | &#9989; | Pages remain in memory for a long time. | Memory pressure is unlikely right now. |
| `ple_seconds` | Persistently low | &#10060; | Pages are being evicted quickly. | Correlate with scans, I/O, grants, and memory cap before concluding root cause. |
| `instance_name` | Aggregate and node values similar | &#9989; | No obvious node skew. | NUMA-local pressure is not visible. |
| `instance_name` | One node much lower than others | &#10060; | One buffer node is under disproportionate churn. | Investigate NUMA locality, scheduler skew, and workload placement. |

#### Check pending memory grants

> [!info]-
> `sys.dm_exec_query_memory_grants` shows queries that requested workspace memory for sorts, hashes, and similar operators.
>
> - `grant_time IS NULL` filters to requests that are still waiting rather than already granted.
> - `requested_memory_kb` and `granted_memory_kb` are converted to megabytes for operational readability.
> - `wait_time_ms / 1000.0` exposes how long the request has already been waiting.
> - Zero rows is a meaningful healthy state.
>
> *Check whether any query is currently waiting for a memory grant rather than executing.*
>
```sql
SELECT
    session_id,
    requested_memory_kb / 1024 AS requested_mb,
    granted_memory_kb / 1024 AS granted_mb,
    wait_time_ms / 1000.0 AS wait_sec
FROM sys.dm_exec_query_memory_grants
WHERE grant_time IS NULL;
```

```text
session_id|requested_mb|granted_mb|wait_sec
----------|------------|----------|--------

(0 rows affected)
```

_No query is currently queued for memory. That is the desired result. It means there is no visible `RESOURCE_SEMAPHORE` style grant backlog at capture time. On a pressured system, even a few waiting rows matter because grant starvation can stall otherwise efficient queries._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| Result set | No rows | &#9989; | No query is waiting for a memory grant right now. | Memory grants are not a live bottleneck. |
| `requested_mb` | Large and growing | &#10060; if paired with waits | Query wants a large workspace memory allocation. | Investigate joins, sorts, estimates, DOP, and stats quality. |
| `granted_mb` | `0` with waiting row | &#10060; | Grant not yet issued. | Query is blocked before execution can proceed. |
| `wait_sec` | Increasing | &#10060; | The queue is not draining quickly. | Correlate with `RESOURCE_SEMAPHORE`, memory cap, and expensive parallel plans. |

## Phase 3 | Wait Statistics

Wait stats are instance-level evidence about where SQL Server has spent time waiting for resources. They do not identify the root cause by themselves. Use them to choose the next branch of investigation, then confirm with the phase that matches the dominant wait family.

### Top cumulative waits

#### Capture the top cumulative waits

> [!warning]
> Wait statistics are cumulative since startup, and this instance restarted on `2026-04-08`. Short uptime and recent admin activity can dominate the top rows.
>
> [!success]
> Use the top waits to choose where to investigate next, not as a standalone verdict. If uptime is short, repeat this phase after a full workload window or compare deltas between snapshots instead of lifetime totals.
>
> [!info]-
> This query reads `sys.dm_os_wait_stats` and removes the most common benign background waits so the output is dominated by actionable waits.
>
> - `wait_time_ms / 1000.0` and `signal_wait_time_ms / 1000.0` convert the cumulative wait totals into seconds.
> - `waiting_tasks_count` shows how many tasks have contributed to each wait type.
> - `pct` expresses each wait type as a percentage of the remaining wait-time total after filtering.
> - The explicit exclusion list removes common idle/background waits that would otherwise crowd out real workload signals.
> - `signal_sec` is especially important. High signal wait relative to total wait implies runnable tasks are waiting on CPU scheduling rather than on external resources.
>
> *Rank the most significant cumulative waits after excluding common idle and housekeeping waits.*
>
```sql
WITH waits AS (
    SELECT
        wait_type,
        wait_time_ms / 1000.0 AS wait_sec,
        signal_wait_time_ms / 1000.0 AS signal_sec,
        waiting_tasks_count AS waiting_count,
        100.0 * wait_time_ms / SUM(wait_time_ms) OVER () AS pct
    FROM sys.dm_os_wait_stats
    WHERE wait_type NOT IN (
        'SLEEP_TASK', 'LAZYWRITER_SLEEP', 'WAITFOR', 'BROKER_RECEIVE_WAITFOR',
        'BROKER_EVENTHANDLER', 'CLR_AUTO_EVENT', 'CLR_MANUAL_EVENT',
        'DISPATCHER_QUEUE_SEMAPHORE', 'XE_DISPATCHER_WAIT', 'DIRTY_PAGE_POLL',
        'HADR_FILESTREAM_IOMGR_IOCOMPLETION', 'SP_SERVER_DIAGNOSTICS_SLEEP',
        'QDS_PERSIST_TASK_MAIN_LOOP_SLEEP', 'QDS_CLEANUP_STALE_QUERIES_TASK_MAIN_LOOP_SLEEP',
        'QDS_ASYNC_QUEUE', 'SQLTRACE_INCREMENTAL_FLUSH_SLEEP', 'CHECKPOINT_QUEUE',
        'FT_IFTS_SCHEDULER_IDLE_WAIT', 'XE_TIMER_EVENT', 'LOGMGR_QUEUE',
        'REQUEST_FOR_DEADLOCK_SEARCH', 'RESOURCE_QUEUE', 'SERVER_IDLE_CHECK',
        'SQLTRACE_BUFFER_FLUSH', 'WAIT_XTP_OFFLINE_CKPT_NEW_LOG', 'BROKER_TO_FLUSH',
        'BROKER_TASK_STOP', 'DBMIRRORING_CMD', 'PREEMPTIVE_OS_PIPEOPS',
        'PREEMPTIVE_XE_GETTARGETSTATE', 'ONDEMAND_TASK_QUEUE',
        'SOS_WORK_DISPATCHER', 'PWAIT_EXTENSIBILITY_CLEANUP_TASK'
    )
      AND waiting_tasks_count > 0
)
SELECT TOP (10)
    wait_type,
    CAST(wait_sec AS decimal(18,1)) AS wait_sec,
    CAST(signal_sec AS decimal(18,1)) AS signal_sec,
    waiting_count,
    CAST(pct AS decimal(10,2)) AS pct
FROM waits
ORDER BY wait_sec DESC;
```

| wait_type | wait_sec | signal_sec | waiting_count | pct |
|---|---:|---:|---:|---:|
| `LCK_M_IX` | 92.0 | 0.0 | 3 | 17.97 |
| `CXPACKET` | 90.3 | 6.8 | 165388 | 17.63 |
| `LCK_M_SCH_S` | 89.4 | 0.0 | 2 | 17.46 |
| `CXSYNC_PORT` | 59.0 | 0.1 | 1235 | 11.52 |
| `LCK_M_U` | 56.7 | 0.0 | 12 | 11.06 |
| `LATCH_EX` | 31.0 | 2.0 | 48077 | 6.05 |
| `LCK_M_X` | 22.3 | 0.0 | 73 | 4.35 |
| `RESERVED_MEMORY_ALLOCATION_EXT` | 20.3 | 0.0 | 1526727 | 3.96 |
| `PREEMPTIVE_OS_FLUSHFILEBUFFERS` | 9.1 | 0.0 | 14696 | 1.77 |
| `CXCONSUMER` | 8.1 | 0.2 | 2580 | 1.58 |

_The raw ranking is dominated by recent blocking and parallelism, not by a long-lived production pattern. The `LCK_M_*` waits are consistent with the blocking demos and maintenance work already run on this fresh instance. `CXPACKET`, `CXSYNC_PORT`, and `CXCONSUMER` also fit the baseline configuration from Phase 1: `MAXDOP = 0` and `cost threshold for parallelism = 5` encourage parallel plans too easily. The low signal component within `CXPACKET` means this is more about parallel coordination overhead than pure CPU starvation. If this same pattern survives a full business cycle, the next audit branch is parallelism tuning plus blocking analysis, not storage._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `wait_type` | `LCK_M_*` | Depends | Lock waits. The exact suffix indicates lock mode. | Correlate with Phase 8 and identify the head blocker before tuning anything else. |
| `wait_type` | `CXPACKET`, `CXCONSUMER`, `CXSYNC_PORT` | Depends | Parallel exchange and synchronization waits. | Validate with `MAXDOP`, cost threshold, skew, and actual parallel query plans. |
| `wait_type` | `PAGEIOLATCH_*` | &#10060; if sustained | Data-page I/O waits. | Jump to Phase 4 and buffer-pool checks. |
| `signal_sec` | Small fraction of `wait_sec` | &#9989; relative to CPU | Most wait time is resource wait, not scheduler wait. | CPU starvation is not the primary interpretation of this snapshot. |
| `signal_sec` | More than about 25% of total wait | &#10060; | Runnable tasks are spending a high share of time waiting to get CPU. | Investigate CPU pressure, runnable queues, and aggressive parallelism. |
| `pct` | One family dominates | Depends | A small number of waits consume most cumulative time. | Use that family to choose the next investigative phase. |

## Phase 4 | I/O Performance

I/O latency determines how expensive physical reads and writes are when the buffer pool cannot absorb the workload. The goal in this phase is not just to find slow files, but to separate storage latency from query-shape problems such as scans, spills, or unnecessary writes.

### File-level latency

#### Measure average read and write stall by file

> [!info]-
> `sys.dm_io_virtual_file_stats(NULL, NULL)` returns cumulative I/O counters for every file on the instance.
>
> - Joining `sys.master_files` adds file names, logical database mapping, and file type.
> - `avg_read_ms` divides cumulative read stall by read count.
> - `avg_write_ms` divides cumulative write stall by write count.
> - `size_on_disk_bytes` is converted to MB so file size can be read without mental conversion.
> - These are lifetime averages since startup, so they are excellent for identifying obviously bad storage but weaker for short spike analysis.
>
> *Measure cumulative average read and write latency per database file.*
>
```sql
SELECT TOP (10)
    DB_NAME(fs.database_id) AS db_name,
    f.type_desc AS file_type,
    f.physical_name,
    fs.num_of_reads,
    fs.num_of_writes,
    CAST(CASE WHEN fs.num_of_reads > 0 THEN fs.io_stall_read_ms * 1.0 / fs.num_of_reads END AS decimal(18,2)) AS avg_read_ms,
    CAST(CASE WHEN fs.num_of_writes > 0 THEN fs.io_stall_write_ms * 1.0 / fs.num_of_writes END AS decimal(18,2)) AS avg_write_ms,
    CAST(fs.size_on_disk_bytes / 1024.0 / 1024.0 AS decimal(18,2)) AS size_mb
FROM sys.dm_io_virtual_file_stats(NULL, NULL) AS fs
JOIN sys.master_files AS f
  ON fs.database_id = f.database_id
 AND fs.file_id = f.file_id
ORDER BY (fs.io_stall_read_ms + fs.io_stall_write_ms) DESC;
```

| db_name | file_type | physical_name | num_of_reads | num_of_writes | avg_read_ms | avg_write_ms | size_mb |
|---|---|---|---:|---:|---:|---:|---:|
| `tempdb` | `ROWS` | `/var/opt/mssql/data/tempdb2.ndf` | 842 | 9358 | 1.10 | 3.69 | 328.00 |
| `tempdb` | `ROWS` | `/var/opt/mssql/data/tempdb7.ndf` | 798 | 8395 | 1.13 | 3.17 | 328.00 |
| `tempdb` | `ROWS` | `/var/opt/mssql/data/tempdb4.ndf` | 841 | 8382 | 1.08 | 2.91 | 328.00 |
| `tempdb` | `ROWS` | `/var/opt/mssql/data/tempdb8.ndf` | 843 | 9223 | 1.09 | 2.37 | 328.00 |
| `tempdb` | `ROWS` | `/var/opt/mssql/data/tempdb.mdf` | 829 | 9280 | 0.93 | 2.21 | 328.00 |
| `tempdb` | `ROWS` | `/var/opt/mssql/data/tempdb3.ndf` | 1032 | 9996 | 0.93 | 1.92 | 328.00 |
| `stoxx` | `LOG` | `/var/opt/mssql/data/stoxx_log.ldf` | 1722 | 96764 | 0.36 | 0.20 | 968.00 |
| `tempdb` | `ROWS` | `/var/opt/mssql/data/tempdb6.ndf` | 809 | 8393 | 1.12 | 2.03 | 328.00 |
| `tempdb` | `ROWS` | `/var/opt/mssql/data/tempdb5.ndf` | 812 | 8397 | 1.12 | 1.95 | 328.00 |
| `stoxx` | `ROWS` | `/var/opt/mssql/data/stoxx.mdf` | 1689 | 9387 | 0.26 | 1.01 | 712.00 |

_The storage profile is healthy. `tempdb` data files show the highest cumulative write latency, but they are still only in the low single-digit millisecond range. `stoxx` data-file reads and writes are both fast, and the log file is excellent at `0.20 ms` average writes. There is no storage-latency evidence here that would justify blaming disk for current performance findings._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `avg_read_ms` | Low single-digit ms | &#9989; | Physical reads are returning quickly. | Storage is unlikely to be the current bottleneck. |
| `avg_read_ms` | Sustained double-digit or worse | &#10060; | Reads are slow. | Correlate with `PAGEIOLATCH_*`, scans, and storage architecture. |
| `avg_write_ms` | Low single-digit ms | &#9989; | Writes are healthy. | Good sign for data and log throughput. |
| `avg_write_ms` | High on log file | &#10060; | Commit latency may be storage-bound. | Investigate log disk, synchronous replicas, or flush behavior. |
| `file_type` | `LOG` | Depends | Sequential write-heavy file. | Judge it mainly by write latency, not read latency. |
| `file_type` | `ROWS` | Depends | Data file handling mixed reads and writes. | Correlate with query shape and cache behavior. |

## Phase 5 | Expensive Cached Statements

This phase ranks cached statements by cumulative CPU and logical reads. It is useful for triage, but it is not a substitute for workload history. `sys.dm_exec_query_stats` only covers statements that are in cache and resets when plans leave cache or the instance restarts.

### Cache-based triage

#### Rank cached statements by cumulative CPU and logical reads

> [!warning]
> This instance has `uptime_days = 0`, so the ranking below is not representative of a normal production business cycle.
>
> [!success]
> Use this output to understand what happened since the restart, then validate long-lived hotspots with Query Store and application-level workload context before tuning.
>
> [!info]-
> This query reads `sys.dm_exec_query_stats`, which stores cumulative execution metrics per cached statement.
>
> - `execution_count` shows how many times the cached statement has executed.
> - `total_worker_time` and `total_elapsed_time` are converted from microseconds to milliseconds.
> - `total_logical_reads` is converted from 8 KB pages to MB for easier scale reasoning.
> - `avg_cpu_ms` and `avg_logical_read_mb` divide the cumulative totals by `execution_count` so a one-off heavy statement is not confused with a chronic medium-cost statement.
> - `sys.dm_exec_sql_text` provides the statement text, and `sys.dm_exec_plan_attributes` fills in the database context reliably.
>
> *Rank cached statements by cumulative CPU time, with logical-read and execution-count context.*
>
```sql
SELECT TOP (5)
    qs.execution_count,
    CAST(qs.total_worker_time / 1000.0 AS decimal(18,2)) AS total_cpu_ms,
    CAST(qs.total_worker_time / NULLIF(qs.execution_count, 0) / 1000.0 AS decimal(18,2)) AS avg_cpu_ms,
    CAST(qs.total_logical_reads * 8.0 / 1024 AS decimal(18,2)) AS total_logical_read_mb,
    CAST(qs.total_logical_reads * 8.0 / 1024 / NULLIF(qs.execution_count, 0) AS decimal(18,2)) AS avg_logical_read_mb,
    CAST(qs.total_elapsed_time / 1000.0 AS decimal(18,2)) AS total_elapsed_ms,
    COALESCE(DB_NAME(CONVERT(int, pa.value)), DB_NAME(st.dbid)) AS database_name,
    LEFT(REPLACE(REPLACE(LTRIM(st.text), CHAR(13), ' '), CHAR(10), ' '), 140) AS query_text
FROM sys.dm_exec_query_stats AS qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) AS st
OUTER APPLY (
    SELECT TOP (1) value
    FROM sys.dm_exec_plan_attributes(qs.plan_handle)
    WHERE attribute = 'dbid'
) AS pa
ORDER BY qs.total_worker_time DESC;
```

| execution_count | total_cpu_ms | avg_cpu_ms | total_logical_read_mb | avg_logical_read_mb | total_elapsed_ms | database_name | query_text |
|---:|---:|---:|---:|---:|---:|---|---|
| 1 | 121593.26 | 121593.26 | 23900.75 | 23900.75 | 8668.30 | `stoxx` | `USE stoxx; SET NOCOUNT ON; INSERT INTO dbo.demo_idxmaint_rowstore (row_guid, batch_no, source_id, symbol, [date], [close], volume) SELECT TO` |
| 1 | 87324.78 | 87324.78 | 21610.52 | 21610.52 | 6167.01 | `stoxx` | `USE stoxx; SET NOCOUNT ON; DROP TABLE IF EXISTS dbo.demo_idxmaint_usage; CREATE TABLE dbo.demo_idxmaint_usage (     id int IDENTITY(1,1) NOT` |
| 1 | 56828.62 | 56828.62 | 1460.41 | 1460.41 | 4228.69 | `stoxx` | `USE stoxx; SET NOCOUNT ON; DROP TABLE IF EXISTS dbo.demo_idxmaint_splits; CREATE TABLE dbo.demo_idxmaint_splits (     row_guid uniqueidentif` |
| 1 | 3281.72 | 3281.72 | 25172.57 | 25172.57 | 2510.26 | `stoxx` | `USE stoxx; SET NOCOUNT ON; DROP TABLE IF EXISTS dbo.demo_idxmaint_rowstore; CREATE TABLE dbo.demo_idxmaint_rowstore (     row_guid uniqueide` |
| 1 | 3246.86 | 3246.86 | 25003.22 | 25003.22 | 2951.91 | `stoxx` | `USE stoxx; SET NOCOUNT ON; DROP TABLE IF EXISTS dbo.demo_idxmaint_rowstore; CREATE TABLE dbo.demo_idxmaint_rowstore (     row_guid uniqueide` |

_This ranking is real but not workload-representative. Every top row is a one-off administrative or demo statement executed after the restart, and each one has `execution_count = 1`. The correct interpretation is not "these are the application's worst queries"; it is "the current cache history is dominated by recent maintenance-style work." In a genuine production audit window, this phase should surface repeated business queries or recurring ETL statements, not setup DDL._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `execution_count` | `1` with very high totals | Depends | One-off expensive statement. | Different tuning priority from a fast statement executed millions of times. |
| `execution_count` | High | Depends | Repeated statement. | Even moderate per-execution cost can become a major workload tax. |
| `total_cpu_ms` | High | Depends | Statement consumed significant cumulative CPU since entering cache. | Good shortlist for deeper plan analysis. |
| `avg_cpu_ms` | High | Depends | Each execution is intrinsically expensive. | Look for plan shape, cardinality, or data-access issues. |
| `total_logical_read_mb` | High | Depends | Statement touched many cached pages cumulatively. | Often points to scans, wide lookups, or large intermediate work. |
| `avg_logical_read_mb` | High | Depends | Each execution reads a lot of data. | Strong candidate for index, predicate, or aggregation tuning. |

## Phase 6 | Index Health

Index health is not just fragmentation. The point of this phase is to determine whether physically meaningful indexes are degraded enough to matter and whether the data-access layer is likely to benefit from maintenance or design changes. For the full maintenance playbook, use [[07-index-maintenance]].

### Actionable physical-design signals

#### Check fragmentation on materially sized indexes

> [!info]-
> This query uses `sys.dm_db_index_physical_stats` in `LIMITED` mode to find materially sized clustered and nonclustered indexes.
>
> - `avg_fragmentation_in_percent` is the logical fragmentation metric most commonly used for B-tree maintenance decisions.
> - `page_count` is critical context because high fragmentation on a tiny index rarely matters.
> - Joining `sys.indexes` adds the human-readable index name and type.
> - The filter `OBJECT_NAME(ips.object_id) NOT LIKE 'demo_%'` keeps the result focused on real tables in this environment.
>
> *Find the most fragmented clustered and nonclustered indexes that are large enough to matter operationally.*
>
```sql
SELECT TOP (10)
    OBJECT_SCHEMA_NAME(ips.object_id) + '.' + OBJECT_NAME(ips.object_id) AS table_name,
    i.name AS index_name,
    i.type_desc,
    CAST(ips.avg_fragmentation_in_percent AS decimal(18,2)) AS avg_fragmentation_in_percent,
    ips.page_count
FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') AS ips
JOIN sys.indexes AS i
  ON ips.object_id = i.object_id
 AND ips.index_id = i.index_id
WHERE ips.index_id > 0
  AND i.type_desc IN ('CLUSTERED', 'NONCLUSTERED')
  AND ips.page_count >= 200
  AND OBJECT_NAME(ips.object_id) NOT LIKE 'demo_%'
ORDER BY ips.avg_fragmentation_in_percent DESC;
```

| table_name | index_name | type_desc | avg_fragmentation_in_percent | page_count |
|---|---|---|---:|---:|
| `silver.stoxxusa50_ohlcv` | `IX_silver_stoxxusa50_ohlcv_symbol_date` | `NONCLUSTERED` | 46.23 | 212 |
| `silver.stoxxasia50_ohlcv` | `IX_silver_stoxxasia50_ohlcv_symbol_date` | `NONCLUSTERED` | 41.81 | 232 |
| `silver.eurostoxx50_ohlcv` | `IX_silver_eurostoxx50_ohlcv_symbol_date` | `NONCLUSTERED` | 40.59 | 239 |
| `silver.stoxxusa50_ohlcv` | `PK__stoxxusa__3213E83FC84E3F24` | `CLUSTERED` | 1.50 | 734 |
| `silver.stoxxasia50_ohlcv` | `PK__stoxxasi__3213E83F66A8DE5E` | `CLUSTERED` | 0.54 | 738 |
| `silver.eurostoxx50_ohlcv` | `PK__eurostox__3213E83FDF67D274` | `CLUSTERED` | 0.52 | 766 |
| `silver.oil20_ohlcv` | `PK__oil20_oh__3213E83F544EB286` | `CLUSTERED` | 0.36 | 279 |

_The only nontrivial fragmentation is on the `symbol_date` nonclustered indexes for the `silver` OHLCV tables, where logical fragmentation is around `40-46%`. Even there, page counts are only about `212-239`, which keeps the urgency low. The clustered primary keys are healthy. This is a good example of why page count matters: not every percentage headline justifies immediate maintenance._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `avg_fragmentation_in_percent` | `< 10` | &#9989; | Low logical fragmentation. | Usually leave it alone. |
| `avg_fragmentation_in_percent` | `10-30` | Depends | Moderate fragmentation. | Context-dependent; often monitor or reorganize if the index is large and busy. |
| `avg_fragmentation_in_percent` | `> 30` | Depends | High logical fragmentation. | Consider maintenance only if page count and workload justify it. |
| `page_count` | `< 1000` | Depends | Small to modest index. | High fragmentation may still have little practical impact. |
| `page_count` | High | Depends | Larger physical structure. | Fragmentation and density matter more. |
| `type_desc` | `NONCLUSTERED` | Depends | Secondary access path. | Often the first place where fragmentation becomes visible. |
| `type_desc` | `CLUSTERED` | Depends | Table’s primary B-tree structure. | High fragmentation here affects the base row order and many access paths. |

## Phase 7 | TempDB Health

`tempdb` pressure shows up as space growth, version-store accumulation, spills, or allocation contention. This phase verifies current space consumption and whether the file layout follows the equal-size, fixed-growth pattern that avoids needless churn.

### Space and layout

#### Measure current `tempdb` space usage

> [!info]-
> `sys.dm_db_file_space_usage` returns page counts for major `tempdb` consumers.
>
> - `user_object_reserved_page_count` covers user-created temporary objects such as `#temp` tables.
> - `internal_object_reserved_page_count` covers engine worktables, hash/sort spill structures, and similar internal use.
> - `version_store_reserved_page_count` measures row-versioning use from snapshot-based features.
> - `unallocated_extent_page_count` shows currently free space.
> - Multiplying by 8 KB and dividing by 1024 converts the page counts to MB.
>
> *Measure the current `tempdb` footprint of user objects, internal objects, version store, and free space.*
>
```sql
USE tempdb;
SELECT
    SUM(user_object_reserved_page_count) * 8 / 1024.0 AS user_objects_mb,
    SUM(internal_object_reserved_page_count) * 8 / 1024.0 AS internal_objects_mb,
    SUM(version_store_reserved_page_count) * 8 / 1024.0 AS version_store_mb,
    SUM(unallocated_extent_page_count) * 8 / 1024.0 AS free_space_mb
FROM sys.dm_db_file_space_usage;
```

| user_objects_mb | internal_objects_mb | version_store_mb | free_space_mb |
|---:|---:|---:|---:|
| 1.500000 | 1.187500 | 0.000000 | 2618.125000 |

_`tempdb` is quiet right now. User objects and internal objects together consume less than `3 MB`, version store is `0 MB`, and more than `2.6 GB` is free. There is no space-pressure signal here, and there is no evidence of snapshot-version buildup at capture time._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `user_objects_mb` | Low | &#9989; | Temporary user objects are small right now. | No visible user-temp pressure. |
| `internal_objects_mb` | Low | &#9989; | Sort/hash spill structures are minimal right now. | No immediate spill-driven pressure signal. |
| `version_store_mb` | `0` | &#9989; | No meaningful row-version accumulation. | RCSI/SI or online operations are not consuming version space right now. |
| `version_store_mb` | Growing persistently | &#10060; | Version store is accumulating. | Investigate long snapshot readers, RCSI, and cleanup lag. |
| `free_space_mb` | High relative to file size | &#9989; | Files have headroom. | Current operations should not trigger immediate autogrowth. |

#### Review `tempdb` file layout and growth behavior

> [!info]-
> `tempdb.sys.database_files` shows the current file layout visible inside `tempdb`.
>
> - `size * 8 / 1024` converts current file size from pages to MB.
> - `growth * 8 / 1024` converts fixed-growth increments to MB when `is_percent_growth = 0`.
> - The important operational questions are whether data files are equally sized and whether growth is fixed rather than percentage-based.
>
> *Review `tempdb` file count, file-size symmetry, and growth settings.*
>
```sql
SELECT
    name,
    size * 8 / 1024 AS size_mb,
    growth * 8 / 1024 AS growth_mb,
    is_percent_growth
FROM tempdb.sys.database_files
ORDER BY file_id;
```

| name | size_mb | growth_mb | is_percent_growth |
|---|---:|---:|---:|
| `tempdev` | 328 | 64 | 0 |
| `templog` | 72 | 64 | 0 |
| `tempdev2` | 328 | 64 | 0 |
| `tempdev3` | 328 | 64 | 0 |
| `tempdev4` | 328 | 64 | 0 |
| `tempdev5` | 328 | 64 | 0 |
| `tempdev6` | 328 | 64 | 0 |
| `tempdev7` | 328 | 64 | 0 |
| `tempdev8` | 328 | 64 | 0 |

_This is a clean `tempdb` layout. The data files are equally sized, there are eight of them, and growth is a fixed `64 MB` rather than a percentage. That does not prove the file count is perfect for every workload, but it does eliminate the most common `tempdb` configuration mistakes from the audit._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| Data file sizes | Equal | &#9989; | Files can participate evenly. | Good baseline for reducing allocation skew. |
| Data file sizes | Unequal | &#10060; | One or more files may receive disproportionate activity. | Rebalance before diagnosing deeper `tempdb` contention. |
| `is_percent_growth` | `0` | &#9989; | Growth uses a fixed increment. | Predictable expansion behavior. |
| `is_percent_growth` | `1` | &#10060; | Growth is percentage-based. | Later growth events become increasingly large and unpredictable. |
| `growth_mb` | Moderate fixed increment | &#9989; | Growth step is operationally controlled. | Better than tiny frequent autogrowth events. |

## Phase 8 | Blocking and Deadlocks

Concurrency issues can look like CPU problems, I/O problems, or generic slowness. This phase checks for a live blocking chain first, then uses the deadlock counter only as a coarse triage signal.

### Current concurrency state

#### Check for active user blocking right now

> [!info]-
> This is the production-facing live-request query, not a minimal DMV snippet.
>
> - `sys.dm_exec_requests` provides the live request state.
> - `sys.dm_exec_sessions` adds login, host, and program identity.
> - `sys.dm_exec_sql_text` extracts the currently running statement text.
> - Statement offsets are used so the output shows the active statement, not the entire batch.
> - Filtering to `s.is_user_process = 1` removes background engine sessions.
> - Zero rows is meaningful: it means no other user request was executing at capture time.
>
> *Inspect currently active user requests, including waits, blocking session IDs, and the exact running statement.*
>
```sql
SELECT
    r.session_id,
    DB_NAME(r.database_id) AS database_name,
    s.login_name,
    s.host_name,
    s.program_name,
    r.status,
    r.command,
    r.wait_type,
    r.wait_time AS wait_time_ms,
    r.cpu_time AS cpu_time_ms,
    r.total_elapsed_time AS elapsed_time_ms,
    r.logical_reads,
    r.reads,
    r.writes,
    r.blocking_session_id,
    LEFT(REPLACE(REPLACE(LTRIM(SUBSTRING(
        st.text,
        (r.statement_start_offset / 2) + 1,
        CASE
            WHEN r.statement_end_offset = -1 THEN (DATALENGTH(st.text) - r.statement_start_offset) / 2 + 1
            ELSE (r.statement_end_offset - r.statement_start_offset) / 2 + 1
        END
    )), CHAR(13), ' '), CHAR(10), ' '), 160) AS running_statement
FROM sys.dm_exec_requests AS r
JOIN sys.dm_exec_sessions AS s
  ON r.session_id = s.session_id
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) AS st
WHERE r.session_id <> @@SPID
  AND s.is_user_process = 1
ORDER BY r.total_elapsed_time DESC, r.session_id;
```

```text
session_id|database_name|login_name|host_name|program_name|status|command|wait_type|wait_time_ms|cpu_time_ms|elapsed_time_ms|logical_reads|reads|writes|blocking_session_id|running_statement
----------|-------------|----------|---------|------------|------|-------|---------|------------|-----------|---------------|-------------|-----|------|-------------------|-----------------

(0 rows affected)
```

_There was no active user blocking at capture time. That is the correct result to see in a calm system. It does not prove blocking never happens, but it does mean the current point-in-time performance state is not explained by a live blocking chain._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| Result set | No rows | &#9989; | No other user request is active right now. | No live blocking or long-running user request is visible. |
| `status` | `suspended` with `blocking_session_id > 0` | &#10060; | Request is waiting on another session. | Find and resolve the head blocker first. |
| `wait_type` | `LCK_M_*` | &#10060; when paired with wait time | Lock wait is active right now. | Blocking is a live problem, not just a historical one. |
| `running_statement` | Long DDL or open transaction batch | Depends | Potential head-blocker workload. | Validate change windows and transaction scope. |

#### Check the deadlock counter carefully

> [!warning]
> `Number of Deadlocks/sec` is a performance counter, not a deadlock graph. A single snapshot can tell you that deadlock activity exists, but it does not tell you which objects or statements were involved.
>
> [!success]
> If this counter is non-zero or trending upward, collect deadlock graphs from `system_health` or a dedicated Extended Events session before recommending a fix.
>
> [!info]-
> This query reads the `_Total` deadlock counter from `sys.dm_os_performance_counters`.
>
> - It is useful as a coarse triage signal.
> - It is not a substitute for deadlock graphs.
> - The operational value is binary at first: zero means no current counter evidence, while a non-zero value means deeper deadlock collection is justified.
>
> *Check whether SQL Server is currently exposing a non-zero deadlock counter for the instance.*
>
```sql
SELECT
    object_name,
    counter_name,
    instance_name,
    cntr_value
FROM sys.dm_os_performance_counters
WHERE counter_name = 'Number of Deadlocks/sec'
  AND instance_name = '_Total';
```

| object_name | counter_name | instance_name | cntr_value |
|---|---|---|---:|
| `SQLServer:Locks` | `Number of Deadlocks/sec` | `_Total` | 1 |

_The counter is non-zero, so deadlock analysis is justified. That is all this query can prove safely. It does not show recurrence, business impact, or the deadlock graph itself. The correct next step is Extended Events, not immediate tuning speculation._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `cntr_value` | `0` | &#9989; | No deadlock counter evidence in the current snapshot. | No immediate deadlock follow-up from this counter alone. |
| `cntr_value` | `> 0` | &#10060; | Deadlock activity has been observed by the counter. | Collect real deadlock graphs before recommending a fix. |
| `instance_name` | `_Total` | Depends | Aggregate instance counter. | Good for quick triage, not root-cause analysis. |

## Phase 9 | Statistics and Plan Cache

The optimizer depends on current statistics and a healthy plan cache. This phase checks for stale statistics on real user tables, then measures whether ad hoc plan caching is consuming disproportionate memory.

### Optimization inputs and cache hygiene

#### Find user tables with the stalest statistics

> [!info]-
> `sys.dm_db_stats_properties` exposes the operational state of each statistics object.
>
> - `last_updated` is the last refresh timestamp for that statistics object.
> - `rows` is the cardinality used as the base for the current statistics object.
> - `modification_counter` is the change count SQL Server tracks for the leading column of the statistic.
> - `pct_modified` expresses the modification counter relative to `rows`, which makes small-table anomalies easy to spot.
> - The filter excludes demo tables so the output focuses on real user objects in this environment.
>
> *Rank user-table statistics objects by how many leading-column modifications have accumulated since the last update.*
>
```sql
SELECT TOP (10)
    OBJECT_SCHEMA_NAME(s.object_id) + '.' + OBJECT_NAME(s.object_id) AS table_name,
    s.name AS stat_name,
    sp.last_updated,
    sp.rows,
    sp.modification_counter,
    CAST(100.0 * sp.modification_counter / NULLIF(sp.rows, 0) AS decimal(10,2)) AS pct_modified
FROM sys.stats AS s
CROSS APPLY sys.dm_db_stats_properties(s.object_id, s.stats_id) AS sp
WHERE OBJECTPROPERTY(s.object_id, 'IsUserTable') = 1
  AND sp.modification_counter > 0
  AND OBJECT_NAME(s.object_id) NOT LIKE 'demo_%'
ORDER BY sp.modification_counter DESC;
```

| table_name | stat_name | last_updated | rows | modification_counter | pct_modified |
|---|---|---|---:|---:|---:|
| `dbo.gold_daily_summary` | `IX_gold_daily_date` | `2026-03-29 20:36:12.4333333` | 506 | 14674 | 2900.00 |
| `dbo.gold_daily_summary` | `_WA_Sys_00000003_69FBBC1F` | `2026-03-29 21:33:37.2400000` | 506 | 8602 | 1700.00 |

_This is an actionable finding. `dbo.gold_daily_summary` has statistics with modification counters far larger than the current row count, which means the statistics are badly out of date for the current data shape. On a table this small, the percentage values are extreme because a small denominator magnifies the ratio, but that does not weaken the conclusion. These statistics deserve refresh before blaming the optimizer for poor plan choices on this table._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `last_updated` | Old relative to write activity | &#10060; | Statistics have not been refreshed recently. | Candidate for manual update or improved stats maintenance. |
| `modification_counter` | High | Depends | Many leading-column changes since last update. | Statistics may no longer describe the data distribution well. |
| `pct_modified` | Very high | &#10060; | Change volume is large relative to the statistics row base. | Strong signal that estimates may drift badly. |
| `rows` | Small | Depends | Small denominator. | Percentage can look extreme quickly, but still indicates stale stats when modifications are large. |

#### Review plan-cache composition by plan type

> [!info]-
> `sys.dm_exec_cached_plans` shows what kinds of plans are occupying the cache.
>
> - `objtype` becomes `plan_type` so the output is readable.
> - `plan_count` shows how many cache entries exist per type.
> - `cache_mb` converts `size_in_bytes` to MB.
> - `total_use_count` and `avg_use_count` show whether the cache is full of reused plans or mostly one-off artifacts.
>
> *Measure how plan-cache memory is distributed across ad hoc, prepared, view, and stored-procedure plans.*
>
```sql
WITH plans AS (
    SELECT
        objtype AS plan_type,
        COUNT(*) AS plan_count,
        SUM(size_in_bytes) / 1048576.0 AS cache_mb,
        SUM(usecounts) AS total_use_count,
        AVG(CONVERT(float, usecounts)) AS avg_use_count
    FROM sys.dm_exec_cached_plans
    GROUP BY objtype
)
SELECT
    plan_type,
    plan_count,
    CAST(cache_mb AS decimal(18,2)) AS cache_mb,
    total_use_count,
    CAST(avg_use_count AS decimal(18,2)) AS avg_use_count
FROM plans
ORDER BY cache_mb DESC;
```

| plan_type | plan_count | cache_mb | total_use_count | avg_use_count |
|---|---:|---:|---:|---:|
| `Adhoc` | 340 | 55.90 | 2898 | 8.52 |
| `View` | 249 | 38.01 | 2305 | 9.26 |
| `Prepared` | 50 | 21.13 | 377 | 7.54 |
| `Proc` | 6 | 0.54 | 42 | 7.00 |

_The plan cache is dominated by ad hoc plans at `55.90 MB`, which is notable because Phase 1 already showed `optimize for ad hoc workloads = 0`. The average use count is not terrible, but the mix still says this instance leans heavily on ad hoc and view-based cached plans rather than on stored procedures. That is not automatically wrong, but it makes the single-use ad hoc check below more important._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `plan_type` | `Adhoc` dominates | Depends | Ad hoc statements occupy most cache memory. | Often a sign to review parameterization and ad hoc plan reuse. |
| `plan_type` | `Proc` dominates | Depends | Stored procedures own most cache memory. | Often expected in proc-heavy systems. |
| `cache_mb` | High on low-reuse plan types | &#10060; | Memory is tied up in plans with limited reuse value. | Consider `optimize for ad hoc workloads`, parameterization, or cache hygiene investigation. |
| `avg_use_count` | Low | &#10060; if cache_mb is high | Plans are not being reused much. | Plan cache may be acting more like a compilation staging area than a reuse asset. |

#### Quantify single-use ad hoc plan waste

> [!info]-
> This query narrows `sys.dm_exec_cached_plans` to the most suspicious cache pattern: `Adhoc` plans with `usecounts = 1`.
>
> - `single_use_plan_count` shows how many ad hoc plans have never been reused.
> - `single_use_cache_mb` measures how much cache memory those one-time plans occupy.
> - This output is especially valuable when `optimize for ad hoc workloads` is off.
>
> *Measure how much plan-cache memory is currently occupied by single-use ad hoc plans.*
>
```sql
SELECT
    objtype AS plan_type,
    COUNT(*) AS single_use_plan_count,
    CAST(SUM(CAST(size_in_bytes AS bigint)) / 1048576.0 AS decimal(18,2)) AS single_use_cache_mb
FROM sys.dm_exec_cached_plans
WHERE usecounts = 1
  AND objtype = 'Adhoc'
GROUP BY objtype;
```

| plan_type | single_use_plan_count | single_use_cache_mb |
|---|---:|---:|
| `Adhoc` | 318 | 53.12 |

_This is a real plan-cache hygiene issue. `318` single-use ad hoc plans consume `53.12 MB`, which is almost the entire ad hoc cache footprint from the previous query. On a larger production instance this pattern scales badly because memory is spent storing full plans that never earn reuse. The immediate recommendation is not to clear cache; it is to improve parameterization discipline and evaluate `optimize for ad hoc workloads`._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `single_use_plan_count` | High | &#10060; if paired with memory use | Many ad hoc plans were compiled once and never reused. | Wasted cache space and extra compilation overhead. |
| `single_use_cache_mb` | High | &#10060; | Meaningful memory is tied up in one-time plans. | Review ad hoc workload shape and cache strategy. |
| `plan_type` | `Adhoc` | Depends | Literal or dynamically generated statements. | Often benefits from better parameterization patterns. |

## Phase 10 | Database Files and Log Reuse

The point of this phase is to catch file-growth settings and log reuse blockers before they become outages. File growth should be predictable. Log reuse reasons should make operational sense for the recovery model and workload.

### Capacity and recovery signals

#### Review file sizes and growth increments

> [!info]-
> `sys.master_files` exposes file-level metadata for all databases.
>
> - `size` is converted from pages to MB.
> - `max_size_mb` preserves `UNLIMITED` explicitly when `max_size = -1`.
> - `growth_increment` renders either a fixed MB value or a percentage string depending on `is_percent_growth`.
> - `database_id <> 2` excludes `tempdb` here because Phase 7 already covers it with a more accurate current-layout query.
>
> *Review current file sizes, maximum sizes, and autogrowth style for non-tempdb databases.*
>
```sql
SELECT TOP (10)
    DB_NAME(database_id) AS database_name,
    name AS logical_name,
    type_desc,
    CAST(size * 8.0 / 1024 AS decimal(18,2)) AS size_mb,
    CASE
        WHEN max_size = -1 THEN 'UNLIMITED'
        ELSE CONVERT(varchar(50), CAST(max_size * 8.0 / 1024 AS decimal(18,2)))
    END AS max_size_mb,
    CASE
        WHEN is_percent_growth = 1 THEN CONCAT(growth, '%')
        ELSE CONCAT(CAST(growth * 8.0 / 1024 AS decimal(18,2)), ' MB')
    END AS growth_increment,
    is_percent_growth
FROM sys.master_files
WHERE database_id <> 2
ORDER BY size DESC;
```

| database_name | logical_name | type_desc | size_mb | max_size_mb | growth_increment | is_percent_growth |
|---|---|---|---:|---|---|---:|
| `stoxx` | `stoxx_log` | `LOG` | 968.00 | `2097152.00` | `64.00 MB` | 0 |
| `stoxx` | `stoxx` | `ROWS` | 712.00 | `UNLIMITED` | `64.00 MB` | 0 |
| `msdb` | `MSDBData` | `ROWS` | 15.31 | `UNLIMITED` | `10%` | 1 |
| `model` | `modellog` | `LOG` | 8.00 | `UNLIMITED` | `64.00 MB` | 0 |
| `model` | `modeldev` | `ROWS` | 8.00 | `UNLIMITED` | `64.00 MB` | 0 |
| `master` | `master` | `ROWS` | 4.69 | `UNLIMITED` | `10%` | 1 |
| `master` | `mastlog` | `LOG` | 2.00 | `UNLIMITED` | `10%` | 1 |
| `msdb` | `MSDBLog` | `LOG` | 1.25 | `2097152.00` | `10%` | 1 |

_The user database is configured sensibly: `stoxx` data and log both grow in fixed `64 MB` increments. The weaker pattern is on system databases, where `master` and `msdb` still use percentage growth. Those files are small now, but percentage growth is still less predictable operationally and is worth normalizing in hardened environments._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `growth_increment` | Fixed MB | &#9989; | Growth occurs in predictable chunks. | Easier capacity planning and less volatile growth behavior. |
| `growth_increment` | Percentage | &#10060; in most production cases | Growth size increases as the file grows. | Harder to predict and can create very large future autogrowth events. |
| `max_size_mb` | `UNLIMITED` | Depends | No explicit ceiling is enforced. | Fine only if monitoring and capacity discipline are strong. |
| `type_desc` | `LOG` | Depends | Log file. | Judge in context of recovery model and log reuse reasons. |

#### Check log reuse wait reasons

> [!info]-
> `sys.databases.log_reuse_wait_desc` explains why each database log cannot currently reuse inactive VLFs.
>
> - The value is instantaneous, not historical.
> - The same value can be perfectly normal or a serious problem depending on how long it persists.
> - The audit question is whether the value makes sense for the database role and current activity.
>
> *Check why each database log can or cannot currently reuse inactive log space.*
>
```sql
SELECT
    name,
    recovery_model_desc,
    log_reuse_wait_desc
FROM sys.databases
ORDER BY name;
```

| name | recovery_model_desc | log_reuse_wait_desc |
|---|---|---|
| `master` | `SIMPLE` | `NOTHING` |
| `model` | `FULL` | `NOTHING` |
| `msdb` | `SIMPLE` | `NOTHING` |
| `stoxx` | `FULL` | `ACTIVE_TRANSACTION` |
| `tempdb` | `SIMPLE` | `ACTIVE_TRANSACTION` |

_`stoxx` is the only production-relevant row here. In `FULL` recovery model, `ACTIVE_TRANSACTION` means log truncation is currently blocked by an open transaction, not by a missing backup. That can be harmless if it is brief, but if it persists and the log keeps growing, the next step is to identify the long transaction before blaming backups or storage. `tempdb` showing `ACTIVE_TRANSACTION` is normal more often than it is alarming because internal work can keep transactions active transiently._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `log_reuse_wait_desc` | `NOTHING` | &#9989; | No current blocker to log reuse. | Healthy steady state. |
| `log_reuse_wait_desc` | `ACTIVE_TRANSACTION` | Depends | An open transaction is preventing truncation. | Investigate only if persistent or paired with log growth pressure. |
| `log_reuse_wait_desc` | `LOG_BACKUP` | &#10060; in `FULL` | Log cannot truncate until backup occurs. | Backup discipline problem. |
| `recovery_model_desc` | `FULL` | Depends | Full recovery chain expected. | Log reuse must be interpreted with backup and restore policy in mind. |

## Phase 11 | Security Quick Check

Performance audits frequently expose security drift at the same time: overly broad sysadmin membership, enabled `sa`, or guest access patterns that should be explicit decisions. This phase is intentionally short and focused on fast, high-signal checks.

### Privilege surface

#### Review current sysadmin membership

> [!info]-
> This query joins `sys.server_principals` to `sys.server_role_members` and the `sysadmin` server role.
>
> - `login_name` identifies the principal with sysadmin rights.
> - `type_desc` distinguishes SQL logins, Windows logins, and Windows groups.
> - `is_disabled` tells you whether the login is enabled right now.
> - The audit goal is not merely enumeration; it is to decide whether each principal should still have that level of privilege.
>
> *List all principals that currently belong to the `sysadmin` server role.*
>
```sql
SELECT
    p.name AS login_name,
    p.type_desc,
    p.is_disabled
FROM sys.server_principals AS p
JOIN sys.server_role_members AS rm
  ON p.principal_id = rm.member_principal_id
JOIN sys.server_principals AS r
  ON rm.role_principal_id = r.principal_id
WHERE r.name = 'sysadmin'
ORDER BY p.name;
```

| login_name | type_desc | is_disabled |
|---|---|---:|
| `BUILTIN\Administrators` | `WINDOWS_GROUP` | 0 |
| `NT AUTHORITY\NETWORK SERVICE` | `WINDOWS_LOGIN` | 0 |
| `sa` | `SQL_LOGIN` | 0 |

_This is a real hardening concern. `sa` is enabled, `BUILTIN\Administrators` is sysadmin, and `NT AUTHORITY\NETWORK SERVICE` also has sysadmin rights. A production performance audit should not stop at pure query tuning when the privilege surface is this broad, because operational risk and unauthorized change risk are both elevated._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `type_desc` | `SQL_LOGIN` | Depends | SQL-authenticated login. | `sa` or other SQL logins at sysadmin level deserve explicit review. |
| `type_desc` | `WINDOWS_GROUP` | Depends | Group-based privilege. | Broad group membership can expand sysadmin access beyond what operators intend. |
| `type_desc` | `WINDOWS_LOGIN` | Depends | Individual Windows principal. | Service identities at sysadmin level should be justified explicitly. |
| `is_disabled` | `0` | &#10060; for unneeded privileged principals | Principal is enabled right now. | It can authenticate immediately with sysadmin rights. |
| `is_disabled` | `1` | &#9989; if privilege is retained only temporarily | Principal is disabled. | Lower immediate exposure, though membership should still be justified. |

#### Check whether `guest` has `CONNECT` in the current database

> [!info]-
> The `guest` user exists in user databases by default, but the important security question is whether it has `CONNECT`.
>
> - The `EXISTS` expression checks `sys.database_permissions` for a granted or grant-with-grant-option `CONNECT` permission on `guest`.
> - Returning `0` is the desired result for most production user databases.
>
> *Check whether the `guest` principal currently has `CONNECT` permission in `stoxx`.*
>
```sql
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM sys.database_permissions AS dp
            JOIN sys.database_principals AS pr
              ON dp.grantee_principal_id = pr.principal_id
            WHERE pr.name = 'guest'
              AND dp.permission_name = 'CONNECT'
              AND dp.state IN ('G', 'W')
        ) THEN 1 ELSE 0
    END AS guest_connect_granted;
```

| guest_connect_granted |
|---:|
| 0 |

_This is the correct result for a normal application database. `guest` exists, but it is not allowed to connect implicitly. That removes one common database-level hardening concern from the report._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `guest_connect_granted` | `0` | &#9989; | `guest` does not have `CONNECT`. | Normal hardened state for a user database. |
| `guest_connect_granted` | `1` | &#10060; | `guest` can connect implicitly. | Review immediately unless the database has a specific documented need. |

## Phase 12 | Compile the Report

The audit is only useful if it ends in a prioritized report. Each finding should state what was observed, how strong the evidence is, and what the next action should be. Separate confirmed problems from limited-history observations.

### Current-instance summary

| Area | Finding | Evidence | Priority | Next action |
|---|---|---|---|---|
| Baseline | Core defaults are not production-tuned. | `MAXDOP = 0`, cost threshold `= 5`, `max server memory = 2147483647`, `optimize for ad hoc workloads = 0`. | High | Set explicit memory cap, review `MAXDOP`, and raise cost threshold after a representative workload cycle. |
| Confidence boundary | DMV history is very short. | `uptime_days = 0`. | High | Re-run cumulative phases after a full business cycle before making long-term workload conclusions. |
| Memory | No live memory pressure is visible. | PLE `= 18007`; no pending memory grants. | Informational | Do not treat memory as the primary bottleneck right now. |
| Waits | Current waits are dominated by blocking and parallelism. | `LCK_M_*`, `CXPACKET`, `CXSYNC_PORT`, `CXCONSUMER`. | Medium | Validate after longer uptime; then tune blocking and parallelism if the pattern persists. |
| I/O | Storage latency is healthy. | Data and log files are low single-digit ms or better. | Informational | Do not blame storage first. |
| Indexes | Moderate nonclustered fragmentation exists on small-to-modest indexes. | `40-46%` fragmentation on `212-239` page indexes. | Low | Address during normal maintenance, not as an emergency. |
| Statistics | Real stale statistics exist on `dbo.gold_daily_summary`. | `modification_counter` far exceeds `rows`; `pct_modified` is extreme. | High | Refresh the relevant statistics and check affected plans. |
| Plan cache | Single-use ad hoc plans waste meaningful cache memory. | `318` plans using `53.12 MB`. | Medium | Review parameterization patterns and enable `optimize for ad hoc workloads` if appropriate. |
| TempDB | Layout is healthy and current usage is low. | Eight equal data files, fixed `64 MB` growth, low current consumption. | Informational | Keep current layout; revisit only if contention appears. |
| Blocking | No live user blocking was visible at capture time. | `sys.dm_exec_requests` returned no active user rows. | Informational | Monitor live when users report slowness. |
| Deadlocks | A deadlock signal exists but is not yet explained. | `Number of Deadlocks/sec = 1`. | Medium | Pull actual deadlock graphs from Extended Events before recommending a fix. |
| File growth | User database growth is sane; system databases still use percentage growth. | `stoxx` grows by fixed `64 MB`; `master` and `msdb` use `10%`. | Medium | Normalize system-database growth increments to fixed MB values. |
| Security | Privilege surface is too broad. | `sa` enabled; `BUILTIN\Administrators` and `NETWORK SERVICE` are sysadmin. | High | Review and reduce sysadmin membership. |

## Related

This playbook is the entry point. Use the focused notes below when one phase becomes the main diagnostic branch.

### Deep-dive notes

- [[11-memory-and-buffer-pool]]
- [[13-wait-stats-analysis]]
- [[12-execution-plans]]
- [[19-query-store-regressions-and-plan-forcing]]
- [[07-index-maintenance]]

### Official references

- [sys.dm_os_wait_stats](https://learn.microsoft.com/en-us/sql/relational-databases/system-dynamic-management-views/sys-dm-os-wait-stats-transact-sql?view=sql-server-ver17)
- [sys.dm_exec_query_stats](https://learn.microsoft.com/en-us/sql/relational-databases/system-dynamic-management-views/sys-dm-exec-query-stats-transact-sql?view=sql-server-ver17)
- [sys.dm_io_virtual_file_stats](https://learn.microsoft.com/en-us/sql/relational-databases/system-dynamic-management-views/sys-dm-io-virtual-file-stats-transact-sql?view=sql-server-ver17)
- [sys.dm_db_file_space_usage](https://learn.microsoft.com/en-us/sql/relational-databases/system-dynamic-management-views/sys-dm-db-file-space-usage-transact-sql?view=sql-server-ver17)
- [sys.dm_db_stats_properties](https://learn.microsoft.com/en-us/sql/relational-databases/system-dynamic-management-views/sys-dm-db-stats-properties-transact-sql?view=sql-server-ver17)
- [sys.dm_exec_cached_plans](https://learn.microsoft.com/en-us/sql/relational-databases/system-dynamic-management-views/sys-dm-exec-cached-plans-transact-sql?view=sql-server-ver17)

