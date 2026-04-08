---
title: "Wait Stats Analysis"
tags: [performance, sql, sql-server, tsql]
aliases: [wait stats, wait statistics, sys.dm_os_wait_stats, PAGEIOLATCH, WRITELOG, LCK_M, CXPACKET, SOS_SCHEDULER_YIELD, RESOURCE_SEMAPHORE, wait type interpretation]
description: "Production-first SQL Server wait-stats analysis with live stoxx outputs for health baselines, actionable waits, signal-vs-resource wait ratios, persisted heavy queries, file latency, TempDB distribution, and Query Store regressions."
parent: "[[domain-query-craft]]"
links:
  - "[[execution-plans]]"
  - "[[query-store-regressions-and-plan-forcing]]"
  - "[[memory-and-buffer-pool]]"
  - "[[index-maintenance]]"
  - "[[performance-audit-playbook]]"
  - "[[pipeline-integration-and-devex]]"
  - "[[pit-integrity-logic]]"
  - "[[troubleshooting-flowcharts]]"
created: 2026-03-22
updated: 2026-04-08
status: complete
---

# Wait Stats Analysis

Wait statistics answer the most important production triage question in SQL Server: what is the engine spending time waiting on right now, and which resource family should you investigate first?

This note is the deep-dive companion to [[troubleshooting-flowcharts]] and [[performance-audit-playbook]]. The queries below are production-facing, and the outputs are real results from the current `stoxx` instance. That matters because cumulative waits, file stalls, and Query Store evidence are only as trustworthy as the uptime window that produced them.

## System Health Dashboard — First Check

Before diving into wait families, start with one health row that establishes the confidence boundary for every cumulative metric that follows.

### Quick health snapshot — sys.dm_os_sys_info and sys.dm_os_performance_counters

[!info]-
This query combines host facts, memory state, uptime, buffer-pool health, and current activity.

- `logical_cpus`, `physical_memory_mb`, and `committed_memory_mb` come from `sys.dm_os_sys_info`.
- `uptime_minutes` is critical context for all cumulative DMVs.
- `page_life_expectancy_sec` is the buffer-pool residency signal.
- `buffer_cache_hit_ratio_pct` is calculated correctly from the ratio and base counters, not from the raw ratio counter alone.
- `user_sessions` and `active_requests` show how much live activity exists while you are troubleshooting.

*Capture the current health baseline before interpreting cumulative waits.*

```sql
WITH bchr AS (
    SELECT
        SUM(CASE WHEN counter_name = 'Buffer cache hit ratio' THEN cntr_value END) AS ratio_value,
        SUM(CASE WHEN counter_name = 'Buffer cache hit ratio base' THEN cntr_value END) AS base_value
    FROM sys.dm_os_performance_counters
    WHERE object_name LIKE '%Buffer Manager%'
      AND counter_name IN ('Buffer cache hit ratio', 'Buffer cache hit ratio base')
)
SELECT
    cpu_count AS logical_cpus,
    physical_memory_kb / 1024 AS physical_memory_mb,
    committed_kb / 1024 AS committed_memory_mb,
    DATEDIFF(MINUTE, sqlserver_start_time, GETDATE()) AS uptime_minutes,
    (SELECT cntr_value
     FROM sys.dm_os_performance_counters
     WHERE counter_name = 'Page life expectancy'
       AND object_name LIKE '%Buffer Manager%') AS page_life_expectancy_sec,
    CAST((
        SELECT CASE
            WHEN base_value > 0 THEN ratio_value * 100.0 / base_value
        END
        FROM bchr
    ) AS decimal(9,2)) AS buffer_cache_hit_ratio_pct,
    (SELECT COUNT(*) FROM sys.dm_exec_sessions WHERE is_user_process = 1) AS user_sessions,
    (SELECT COUNT(*) FROM sys.dm_exec_requests WHERE session_id > 50) AS active_requests
FROM sys.dm_os_sys_info;
```

| logical_cpus | physical_memory_mb | committed_memory_mb | uptime_minutes | page_life_expectancy_sec | buffer_cache_hit_ratio_pct | user_sessions | active_requests |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 16 | 24732 | 5404 | 369 | 22165 | 100.00 | 3 | 12 |

_The instance is not showing broad memory distress right now. `PLE = 22165` and `buffer_cache_hit_ratio_pct = 100.00` are both strong. The important caveat is `uptime_minutes = 369`: all cumulative waits, file latencies, and cached-query rankings are only a few hours old, so they are useful for current triage but not yet a full-cycle baseline._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `uptime_minutes` | Low | Depends | Cumulative history is young. | Use waits and file stats as incident-window evidence, not long-term trend proof. |
| `page_life_expectancy_sec` | Very high | &#9989; | Pages are staying in memory a long time. | No strong current signal of broad buffer-pool churn. |
| `buffer_cache_hit_ratio_pct` | Near `100` | &#9989; | Logical reads are mostly satisfied from cache. | Disk misses are not the first explanation to assume. |
| `active_requests` | Non-zero | Depends | There is live activity while you troubleshoot. | Good time to correlate waits with current requests and Query Store. |

## Top Waits Query — The Primary Diagnostic

`sys.dm_os_wait_stats` is still the primary instance-level bottleneck surface. The key production skill is not memorizing every wait type. It is separating actionable waits from background engine housekeeping, then grouping the actionable waits into resource families.

### sys.dm_os_wait_stats — top waits query with benign exclusions

[!info]-
This is the core production wait query for the note.

- The exclusion list removes background queue, idle, and housekeeping waits that do not explain user-facing slowness.
- `wait_sec` is total elapsed wait time for the family since startup.
- `resource_wait_sec` is the non-CPU part of the wait.
- `signal_wait_sec` is scheduler delay after the resource became available.
- `waiting_tasks_count` distinguishes a few long waits from many short waits.

*Return the top actionable waits on the current instance.*

```sql
WITH waits AS (
    SELECT
        wait_type,
        wait_time_ms / 1000.0 AS wait_sec,
        (wait_time_ms - signal_wait_time_ms) / 1000.0 AS resource_wait_sec,
        signal_wait_time_ms / 1000.0 AS signal_wait_sec,
        waiting_tasks_count
    FROM sys.dm_os_wait_stats
    WHERE wait_type NOT IN (
        'BROKER_EVENTHANDLER','BROKER_RECEIVE_WAITFOR','BROKER_TASK_STOP',
        'BROKER_TO_FLUSH','BROKER_TRANSMITTER','CHECKPOINT_QUEUE','CHKPT',
        'CLR_AUTO_EVENT','CLR_MANUAL_EVENT','CLR_SEMAPHORE',
        'DBMIRROR_DBM_EVENT','DBMIRROR_EVENTS_QUEUE','DBMIRROR_WORKER_QUEUE',
        'DBMIRRORING_CMD','DIRTY_PAGE_POLL','DISPATCHER_QUEUE_SEMAPHORE',
        'EXECSYNC','FSAGENT','FT_IFTS_SCHEDULER_IDLE_WAIT','FT_IFTSHC_MUTEX',
        'HADR_CLUSAPI_CALL','HADR_FILESTREAM_IOMGR_IOCOMPLETION',
        'HADR_LOGCAPTURE_WAIT','HADR_NOTIFICATION_DEQUEUE','HADR_TIMER_TASK',
        'HADR_WORK_QUEUE','KSOURCE_WAKEUP','LAZYWRITER_SLEEP','LOGMGR_QUEUE',
        'MEMORY_ALLOCATION_EXT','ONDEMAND_TASK_QUEUE','PARALLEL_REDO_DRAIN_WORKER',
        'PARALLEL_REDO_LOG_CACHE','PARALLEL_REDO_TRAN_LIST','PARALLEL_REDO_WORKER_SYNC',
        'PARALLEL_REDO_WORKER_WAIT_WORK','PREEMPTIVE_OS_FLUSHFILEBUFFERS',
        'PREEMPTIVE_XE_GETTARGETSTATE','PWAIT_ALL_COMPONENTS_INITIALIZED',
        'PWAIT_DIRECTLOGCONSUMER_GETNEXT','PWAIT_EXTENSIBILITY_CLEANUP_TASK',
        'QDS_ASYNC_QUEUE','QDS_CLEANUP_STALE_QUERIES_TASK_MAIN_LOOP_SLEEP',
        'QDS_PERSIST_TASK_MAIN_LOOP_SLEEP','QDS_SHUTDOWN_QUEUE',
        'REDO_THREAD_PENDING_WORK','REQUEST_FOR_DEADLOCK_SEARCH','RESOURCE_QUEUE',
        'SERVER_IDLE_CHECK','SLEEP_BPOOL_FLUSH','SLEEP_DBSTARTUP',
        'SLEEP_DCOMSTARTUP','SLEEP_MASTERDBREADY','SLEEP_MASTERMDREADY',
        'SLEEP_MASTERUPGRADED','SLEEP_MSDBSTARTUP','SLEEP_SYSTEMTASK',
        'SLEEP_TASK','SLEEP_TEMPDBSTARTUP','SNI_HTTP_ACCEPT',
        'SOS_WORK_DISPATCHER','SP_SERVER_DIAGNOSTICS_SLEEP',
        'SQLTRACE_BUFFER_FLUSH','SQLTRACE_INCREMENTAL_FLUSH_SLEEP',
        'SQLTRACE_WAIT_ENTRIES','WAIT_FOR_RESULTS','WAITFOR',
        'WAITFOR_TASKSHUTDOWN','WAIT_XTP_RECOVERY','WAIT_XTP_HOST_WAIT',
        'WAIT_XTP_OFFLINE_CKPT_NEW_LOG','WAIT_XTP_CKPT_CLOSE',
        'XE_DISPATCHER_JOIN','XE_DISPATCHER_WAIT','XE_TIMER_EVENT'
    )
)
SELECT TOP (10)
    wait_type,
    wait_sec,
    resource_wait_sec,
    signal_wait_sec,
    waiting_tasks_count
FROM waits
WHERE wait_sec > 0
ORDER BY wait_sec DESC;
```

| wait_type | wait_sec | resource_wait_sec | signal_wait_sec | waiting_tasks_count |
|---|---:|---:|---:|---:|
| `LCK_M_IX` | 92.048000 | 92.048000 | 0.000000 | 3 |
| `CXPACKET` | 90.310000 | 83.483000 | 6.827000 | 165388 |
| `LCK_M_SCH_S` | 89.425000 | 89.425000 | 0.000000 | 2 |
| `CXSYNC_PORT` | 59.243000 | 59.095000 | 0.148000 | 1366 |
| `LCK_M_U` | 56.662000 | 56.662000 | 0.000000 | 12 |
| `LATCH_EX` | 32.878000 | 30.731000 | 2.147000 | 51133 |
| `LCK_M_X` | 22.324000 | 22.321000 | 0.003000 | 157 |
| `RESERVED_MEMORY_ALLOCATION_EXT` | 20.288000 | 20.288000 | 0.000000 | 1534067 |
| `CXCONSUMER` | 8.785000 | 8.541000 | 0.244000 | 2939 |
| `PREEMPTIVE_OS_AUTHENTICATIONOPS` | 5.708000 | 5.708000 | 0.000000 | 5512 |

_The current wait picture is not storage-led. The strongest actionable families are locking (`LCK_M_*`) and parallelism (`CXPACKET`, `CXSYNC_PORT`, `CXCONSUMER`). That means the next moves are blocking analysis and plan-review work, not disk expansion or blanket memory tuning._

| Wait family | Watch | What it usually means | First next step |
|---|---|---|---|
| `LCK_M_*` | &#10060; | Sessions are blocked by other sessions. | Inspect blockers and transaction scope. |
| `CXPACKET`, `CXCONSUMER`, `CXSYNC_PORT` | Depends | Parallel plan coordination or skew. | Check plan shape, `MAXDOP`, and cost threshold. |
| `PAGEIOLATCH_*`, `WRITELOG` | &#10060; when dominant | Data-file or log-file I/O latency. | Correlate with file-latency DMV output. |
| `SOS_*` with high signal waits | &#10060; | CPU scheduler pressure. | Validate CPU saturation and expensive queries. |

### signal_wait_ms vs resource_wait_ms — CPU pressure indicator

[!info]-
This aggregate view answers a different question from the top-waits query.

- `signal_wait_pct` is the share of actionable wait time spent waiting for CPU after the resource was granted.
- `resource_wait_pct` is the share spent actually blocked on resources.
- A high signal percentage points toward scheduler pressure; a low signal percentage means the problem is mostly the underlying resource families themselves.

*Quantify how much of the current actionable wait profile is CPU scheduling pressure versus resource blocking.*

```sql
WITH waits AS (
    SELECT
        wait_time_ms,
        signal_wait_time_ms
    FROM sys.dm_os_wait_stats
    WHERE wait_type NOT IN (
        'BROKER_EVENTHANDLER','BROKER_RECEIVE_WAITFOR','BROKER_TASK_STOP',
        'BROKER_TO_FLUSH','BROKER_TRANSMITTER','CHECKPOINT_QUEUE','CHKPT',
        'CLR_AUTO_EVENT','CLR_MANUAL_EVENT','CLR_SEMAPHORE',
        'DBMIRROR_DBM_EVENT','DBMIRROR_EVENTS_QUEUE','DBMIRROR_WORKER_QUEUE',
        'DBMIRRORING_CMD','DIRTY_PAGE_POLL','DISPATCHER_QUEUE_SEMAPHORE',
        'EXECSYNC','FSAGENT','FT_IFTS_SCHEDULER_IDLE_WAIT','FT_IFTSHC_MUTEX',
        'HADR_CLUSAPI_CALL','HADR_FILESTREAM_IOMGR_IOCOMPLETION',
        'HADR_LOGCAPTURE_WAIT','HADR_NOTIFICATION_DEQUEUE','HADR_TIMER_TASK',
        'HADR_WORK_QUEUE','KSOURCE_WAKEUP','LAZYWRITER_SLEEP','LOGMGR_QUEUE',
        'MEMORY_ALLOCATION_EXT','ONDEMAND_TASK_QUEUE','PARALLEL_REDO_DRAIN_WORKER',
        'PARALLEL_REDO_LOG_CACHE','PARALLEL_REDO_TRAN_LIST','PARALLEL_REDO_WORKER_SYNC',
        'PARALLEL_REDO_WORKER_WAIT_WORK','PREEMPTIVE_OS_FLUSHFILEBUFFERS',
        'PREEMPTIVE_XE_GETTARGETSTATE','PWAIT_ALL_COMPONENTS_INITIALIZED',
        'PWAIT_DIRECTLOGCONSUMER_GETNEXT','PWAIT_EXTENSIBILITY_CLEANUP_TASK',
        'QDS_ASYNC_QUEUE','QDS_CLEANUP_STALE_QUERIES_TASK_MAIN_LOOP_SLEEP',
        'QDS_PERSIST_TASK_MAIN_LOOP_SLEEP','QDS_SHUTDOWN_QUEUE',
        'REDO_THREAD_PENDING_WORK','REQUEST_FOR_DEADLOCK_SEARCH','RESOURCE_QUEUE',
        'SERVER_IDLE_CHECK','SLEEP_BPOOL_FLUSH','SLEEP_DBSTARTUP',
        'SLEEP_DCOMSTARTUP','SLEEP_MASTERDBREADY','SLEEP_MASTERMDREADY',
        'SLEEP_MASTERUPGRADED','SLEEP_MSDBSTARTUP','SLEEP_SYSTEMTASK',
        'SLEEP_TASK','SLEEP_TEMPDBSTARTUP','SNI_HTTP_ACCEPT',
        'SOS_WORK_DISPATCHER','SP_SERVER_DIAGNOSTICS_SLEEP',
        'SQLTRACE_BUFFER_FLUSH','SQLTRACE_INCREMENTAL_FLUSH_SLEEP',
        'SQLTRACE_WAIT_ENTRIES','WAIT_FOR_RESULTS','WAITFOR',
        'WAITFOR_TASKSHUTDOWN','WAIT_XTP_RECOVERY','WAIT_XTP_HOST_WAIT',
        'WAIT_XTP_OFFLINE_CKPT_NEW_LOG','WAIT_XTP_CKPT_CLOSE',
        'XE_DISPATCHER_JOIN','XE_DISPATCHER_WAIT','XE_TIMER_EVENT'
    )
)
SELECT
    CAST(SUM(signal_wait_time_ms) * 100.0 / NULLIF(SUM(wait_time_ms), 0) AS decimal(9,2)) AS signal_wait_pct,
    CAST((SUM(wait_time_ms) - SUM(signal_wait_time_ms)) * 100.0 / NULLIF(SUM(wait_time_ms), 0) AS decimal(9,2)) AS resource_wait_pct
FROM waits;
```

| signal_wait_pct | resource_wait_pct |
|---:|---:|
| 2.20 | 97.80 |

_Only `2.20%` of the current actionable wait profile is signal wait time. That means scheduler pressure is not the dominant story. The bottleneck is mostly in the resource families themselves, which matches the current lock-heavy wait list._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `signal_wait_pct` | Below `10` | &#9989; | CPU scheduler delay is a small part of total actionable waits. | Focus on the underlying wait families first. |
| `signal_wait_pct` | Above `10-15` | &#10060; | Sessions are ready to run but cannot get CPU time fast enough. | Investigate CPU saturation and runnable pressure. |
| `resource_wait_pct` | Dominant | Depends | Most time is spent waiting on external resources or locks. | Use wait-family meaning to choose the next diagnostic surface. |

### Wait Type Interpretation for Pipeline Workloads

| Wait type or family | Usual meaning | First question to ask | First linked note |
|---|---|---|---|
| `LCK_M_*` | Blocking or lock serialization | Who is the blocker and how long is the transaction open? | [[execution-plans]] |
| `PAGEIOLATCH_*` | Data page had to be read from disk | Is this storage latency or a cache-coverage problem? | [[memory-and-buffer-pool]] |
| `WRITELOG` | Commit or log flush latency | Is the log file slow or is the workload committing too often? | [[performance-audit-playbook]] |
| `CXPACKET`, `CXSYNC_PORT`, `CXCONSUMER` | Parallel plan coordination and skew | Is the plan going parallel for good reason, and is work balanced? | [[execution-plans]] |
| `RESOURCE_SEMAPHORE`, `RESERVED_MEMORY_ALLOCATION_EXT` | Memory grant pressure or reservation pressure | Are queries asking for large grants, or is memory capped badly? | [[memory-and-buffer-pool]] |
| `PAGELATCH_*` in TempDB contexts | Allocation or metadata contention | Are TempDB files balanced, and is concurrency too allocation-heavy? | [[index-maintenance]] |
| `ASYNC_NETWORK_IO` | Client is consuming rows slowly | Is the consumer fetching too much or too slowly? | [[pipeline-integration-and-devex]] |

## Top Resource-Consuming Queries

Wait families tell you which resource is hurting. The next step is to find which persisted query patterns are likely contributing to that pain.

On a short-uptime or admin-heavy instance, plan-cache top-N lists are often noisy. Query Store is a more stable surface because it persists runtime rows across cache eviction.

### Persisted heavy business queries from Query Store

[!info]-
This query surfaces persisted business-table queries from Query Store instead of relying on the volatile plan cache.

- `weighted_avg_duration_ms` is a weighted average across Query Store runtime rows, using execution count as the weight.
- `weighted_avg_logical_reads` shows average buffer-pool work per execution.
- `executions` tells you how often the pattern ran across the retained Query Store intervals.
- The filter keeps the focus on statements touching `silver` or `gold` tables and excludes demo-heavy Query Store rows.

*Find persisted business-query patterns that consume meaningful time or logical reads.*

```sql
SELECT TOP (10)
    LEFT(REPLACE(REPLACE(qt.query_sql_text, CHAR(13), ' '), CHAR(10), ' '), 160) AS query_text,
    CAST(
        SUM(rs.avg_duration * rs.count_executions)
        / NULLIF(SUM(rs.count_executions), 0)
        / 1000.0 AS decimal(18,3)
    ) AS weighted_avg_duration_ms,
    CAST(
        SUM(rs.avg_logical_io_reads * rs.count_executions)
        / NULLIF(SUM(rs.count_executions), 0) AS decimal(18,2)
    ) AS weighted_avg_logical_reads,
    SUM(rs.count_executions) AS executions
FROM sys.query_store_query_text AS qt
JOIN sys.query_store_query AS q
  ON qt.query_text_id = q.query_text_id
JOIN sys.query_store_plan AS p
  ON q.query_id = p.query_id
JOIN sys.query_store_runtime_stats AS rs
  ON p.plan_id = rs.plan_id
WHERE (qt.query_sql_text LIKE '%silver.%' OR qt.query_sql_text LIKE '%gold.%')
  AND qt.query_sql_text NOT LIKE '%demo[_]%'
  AND qt.query_sql_text NOT LIKE '%sys.query_store_%'
GROUP BY qt.query_sql_text
ORDER BY weighted_avg_duration_ms DESC;
```

| query_text | weighted_avg_duration_ms | weighted_avg_logical_reads | executions |
|---|---:|---:|---:|
| `SELECT * FROM silver.eurostoxx50_ohlcv ORDER BY symbol, date` | 142.750 | 797.00 | 1 |
| `WITH ranked AS ( SELECT symbol, date, [close], ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC)` | 141.990 | 631.60 | 5 |
| `SELECT TOP 15 d.symbol, d.short_name, t.date, t.volume, t.[close] FROM silver.index_dim d CROSS APPLY ( SELECT TOP 3 date, volume, [close] FROM` | 132.265 | 155290.00 | 1 |
| `SELECT * FROM silver.stoxxusa50_ohlcv ORDER BY symbol, date` | 119.266 | 764.00 | 1 |
| `SELECT symbol, date, [close], LAG([close]) OVER (PARTITION BY symbol ORDER BY date) AS prev FROM silver.eurostoxx50_ohlcv` | 110.349 | 836.67 | 3 |
| `SELECT symbol, date, [close], LAG([close]) OVER (PARTITION BY symbol ORDER BY date) FROM silver.eurostoxx50_ohlcv` | 102.517 | 858.00 | 2 |
| `WITH ranked AS ( SELECT symbol, date, [close], ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC)` | 80.801 | 2079.00 | 5 |
| `SELECT symbol, date, [open], high, low, [close], volume FROM silver.eurostoxx50_ohlcv` | 71.514 | 761.00 | 5 |
| `WITH ranked AS ( SELECT symbol, date, [close], ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC)` | 63.197 | 2021.60 | 5 |
| `WITH ranked AS ( SELECT symbol, date, [close], ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC)` | 61.828 | 2022.00 | 5 |

_The current persisted heavy-query surface is dominated by wide ordered scans and window-function patterns over the OHLCV tables. One cross-apply pattern against `silver.index_dim` stands out for logical reads: `155290.00` reads per execution is a real plan-review candidate even though it executed only once._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `weighted_avg_duration_ms` | High | Depends | Average elapsed time for the persisted pattern. | Prioritize when combined with meaningful execution count or user impact. |
| `weighted_avg_logical_reads` | Very high | &#10060; | Query is touching many buffer-pool pages. | Good candidate for plan review, indexing, or shape reduction. |
| `executions` | Low | Depends | Query ran only a few times in the retained window. | High cost may still matter for batch jobs, but not all low-frequency statements need indexing. |

## Database File I/O Latency

If waits suggest storage pressure, the next step is to verify file-level latency directly instead of assuming the disk layer is guilty.

### sys.dm_io_virtual_file_stats — per-database file I/O query

[!info]-
This query reads cumulative file I/O stats across the instance.

- `avg_read_latency_ms` and `avg_write_latency_ms` are averages since startup.
- `total_read_mb` and `total_write_mb` show the volume of traffic each file has handled.
- Sorting by cumulative stall puts the hottest files first.

Because the instance uptime is still short, these file latencies are useful for the current window.

*Check which files are seeing the highest cumulative I/O stall and what their average latencies look like.*

```sql
SELECT TOP (10)
    DB_NAME(fs.database_id) AS database_name,
    f.name AS file_name,
    f.type_desc,
    f.physical_name,
    fs.num_of_reads,
    fs.num_of_writes,
    CAST(fs.io_stall_read_ms / NULLIF(fs.num_of_reads, 0) AS decimal(18,2)) AS avg_read_latency_ms,
    CAST(fs.io_stall_write_ms / NULLIF(fs.num_of_writes, 0) AS decimal(18,2)) AS avg_write_latency_ms,
    CAST(fs.num_of_bytes_read / 1024.0 / 1024 AS decimal(18,2)) AS total_read_mb,
    CAST(fs.num_of_bytes_written / 1024.0 / 1024 AS decimal(18,2)) AS total_write_mb
FROM sys.dm_io_virtual_file_stats(NULL, NULL) AS fs
JOIN sys.master_files AS f
  ON fs.database_id = f.database_id
 AND fs.file_id = f.file_id
ORDER BY (fs.io_stall_read_ms + fs.io_stall_write_ms) DESC;
```

| database_name | file_name | type_desc | physical_name | num_of_reads | num_of_writes | avg_read_latency_ms | avg_write_latency_ms | total_read_mb | total_write_mb |
|---|---|---|---|---:|---:|---:|---:|---:|---:|
| `tempdb` | `tempdev2` | `ROWS` | `/var/opt/mssql/data/tempdb2.ndf` | 842 | 9358 | 1.00 | 3.00 | 51.73 | 584.41 |
| `tempdb` | `tempdev7` | `ROWS` | `/var/opt/mssql/data/tempdb7.ndf` | 798 | 8395 | 1.00 | 3.00 | 49.05 | 524.16 |
| `tempdb` | `tempdev4` | `ROWS` | `/var/opt/mssql/data/tempdb4.ndf` | 841 | 8382 | 1.00 | 2.00 | 51.63 | 523.36 |
| `tempdb` | `tempdev8` | `ROWS` | `/var/opt/mssql/data/tempdb8.ndf` | 843 | 9223 | 1.00 | 2.00 | 51.85 | 575.88 |
| `tempdb` | `tempdev` | `ROWS` | `/var/opt/mssql/data/tempdb.mdf` | 829 | 9280 | 0.00 | 2.00 | 51.37 | 578.95 |
| `tempdb` | `tempdev3` | `ROWS` | `/var/opt/mssql/data/tempdb3.ndf` | 1032 | 9996 | 0.00 | 1.00 | 63.78 | 624.16 |
| `stoxx` | `stoxx_log` | `LOG` | `/var/opt/mssql/data/stoxx_log.ldf` | 1722 | 97574 | 0.00 | 0.00 | 271.52 | 5023.94 |
| `tempdb` | `tempdev6` | `ROWS` | `/var/opt/mssql/data/tempdb6.ndf` | 809 | 8393 | 1.00 | 2.00 | 49.45 | 524.03 |
| `tempdb` | `tempdev5` | `ROWS` | `/var/opt/mssql/data/tempdb5.ndf` | 812 | 8397 | 1.00 | 1.00 | 49.92 | 524.29 |
| `stoxx` | `stoxx` | `ROWS` | `/var/opt/mssql/data/stoxx.mdf` | 1695 | 9387 | 0.00 | 1.00 | 29.38 | 2985.34 |

_The current file-latency surface does not support a storage-blame hypothesis. The `stoxx` data and log files are both sub-millisecond, and even the busiest TempDB files are still in the low single-digit millisecond range. If users complain of slowness right now, the stronger explanation is concurrency or query shape, not raw disk latency._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `avg_read_latency_ms < 5` | Fast reads | &#9989; | Read path is healthy for general SSD-backed workloads. | Storage is unlikely to be the first bottleneck. |
| `avg_write_latency_ms < 2` on log | Fast commits | &#9989; | Log flushes are fast. | `WRITELOG` would be less likely to dominate. |
| `avg_write_latency_ms > 5` on log | &#10060; | Slow commit path. | Investigate log placement, flush rate, and storage health. |

## TempDB Contention Detection

TempDB waits are not only about raw disk speed. They are also about whether concurrency is piling onto the same allocation paths.

### TempDB per-file I/O distribution — check for uneven load

[!info]-
This query checks whether TempDB activity is reasonably distributed across the data files.

- `num_of_writes` and `write_mb` show write distribution.
- `avg_write_stall_ms` shows whether one file is becoming materially slower than others.
- Uneven write counts can signal file-size imbalance or other allocation skew.

*Check whether TempDB I/O is balanced across the current data files.*

```sql
SELECT
    f.name AS file_name,
    f.physical_name,
    fs.num_of_reads,
    fs.num_of_writes,
    CAST(fs.num_of_bytes_read / 1024.0 / 1024 AS decimal(18,2)) AS read_mb,
    CAST(fs.num_of_bytes_written / 1024.0 / 1024 AS decimal(18,2)) AS write_mb,
    CAST(fs.io_stall_read_ms / NULLIF(fs.num_of_reads, 0) AS decimal(18,2)) AS avg_read_stall_ms,
    CAST(fs.io_stall_write_ms / NULLIF(fs.num_of_writes, 0) AS decimal(18,2)) AS avg_write_stall_ms
FROM sys.dm_io_virtual_file_stats(2, NULL) AS fs
JOIN tempdb.sys.database_files AS f
  ON fs.file_id = f.file_id
ORDER BY fs.num_of_writes DESC;
```

| file_name | physical_name | num_of_reads | num_of_writes | read_mb | write_mb | avg_read_stall_ms | avg_write_stall_ms |
|---|---|---:|---:|---:|---:|---:|---:|
| `tempdev3` | `/var/opt/mssql/data/tempdb3.ndf` | 1032 | 9996 | 63.78 | 624.16 | 0.00 | 1.00 |
| `tempdev2` | `/var/opt/mssql/data/tempdb2.ndf` | 842 | 9358 | 51.73 | 584.41 | 1.00 | 3.00 |
| `tempdev` | `/var/opt/mssql/data/tempdb.mdf` | 829 | 9280 | 51.37 | 578.95 | 0.00 | 2.00 |
| `tempdev8` | `/var/opt/mssql/data/tempdb8.ndf` | 843 | 9223 | 51.85 | 575.88 | 1.00 | 2.00 |
| `tempdev5` | `/var/opt/mssql/data/tempdb5.ndf` | 812 | 8397 | 49.92 | 524.29 | 1.00 | 1.00 |
| `tempdev7` | `/var/opt/mssql/data/tempdb7.ndf` | 798 | 8395 | 49.05 | 524.16 | 1.00 | 3.00 |
| `tempdev6` | `/var/opt/mssql/data/tempdb6.ndf` | 809 | 8393 | 49.45 | 524.03 | 1.00 | 2.00 |
| `tempdev4` | `/var/opt/mssql/data/tempdb4.ndf` | 841 | 8382 | 51.63 | 523.36 | 1.00 | 2.00 |
| `templog` | `/var/opt/mssql/data/templog.ldf` | 11 | 1107 | 0.98 | 60.66 | 0.00 | 1.00 |

_TempDB activity is reasonably balanced across the eight data files. `tempdev3` is somewhat busier than the others, but the write distribution is still close enough that there is no obvious single-file hotspot. Combined with the low file-latency numbers, this is not a current TempDB emergency signal._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `num_of_writes` | Similar across data files | &#9989; | Allocation and spill activity is spreading across files. | TempDB file layout is behaving reasonably. |
| `num_of_writes` | One file far above the rest | &#10060; | Possible skew or unequal file sizing. | Review TempDB file sizes and allocation pattern. |
| `avg_write_stall_ms` | Low single digits | &#9989; | TempDB write latency is healthy. | TempDB wait complaints are more likely concurrency-related than storage-related. |

## Query Store — Regression Detection

Wait families tell you what hurts. Query Store helps answer whether a changed plan is part of why it started hurting.

### Query Store regression candidates

[!info]-
This query looks for Query Store statements with more than one persisted plan and compares the best and worst weighted average durations.

- `plan_count > 1` is the minimum sign that plan variability exists.
- `best_avg_ms` and `worst_avg_ms` show the spread between persisted plans.
- `regression_factor` is the ratio of worst to best average duration.
- The sample text is intentionally truncated; the handoff for full plan work is [[query-store-regressions-and-plan-forcing]].

*Find persisted Query Store statements whose alternative plans differ materially in average duration.*

```sql
WITH recent_plans AS (
    SELECT
        q.query_id,
        qt.query_sql_text,
        p.plan_id,
        CAST(
            SUM(rs.avg_duration * rs.count_executions)
            / NULLIF(SUM(rs.count_executions), 0)
            / 1000.0 AS decimal(18,3)
        ) AS weighted_avg_duration_ms
    FROM sys.query_store_query_text AS qt
    JOIN sys.query_store_query AS q
      ON qt.query_text_id = q.query_text_id
    JOIN sys.query_store_plan AS p
      ON q.query_id = p.query_id
    JOIN sys.query_store_runtime_stats AS rs
      ON p.plan_id = rs.plan_id
    WHERE qt.query_sql_text NOT LIKE '%demo[_]%'
      AND qt.query_sql_text NOT LIKE '%qs_force_demo%'
    GROUP BY q.query_id, qt.query_sql_text, p.plan_id
),
multi_plan AS (
    SELECT
        query_id,
        MIN(weighted_avg_duration_ms) AS best_avg_ms,
        MAX(weighted_avg_duration_ms) AS worst_avg_ms,
        COUNT(*) AS plan_count
    FROM recent_plans
    GROUP BY query_id
    HAVING COUNT(*) > 1
)
SELECT TOP (10)
    m.query_id,
    m.plan_count,
    m.best_avg_ms,
    m.worst_avg_ms,
    CAST(m.worst_avg_ms / NULLIF(m.best_avg_ms, 0) AS decimal(18,2)) AS regression_factor,
    LEFT(REPLACE(REPLACE(MIN(r.query_sql_text), CHAR(13), ' '), CHAR(10), ' '), 140) AS sample_query_text
FROM multi_plan AS m
JOIN recent_plans AS r
  ON m.query_id = r.query_id
GROUP BY m.query_id, m.plan_count, m.best_avg_ms, m.worst_avg_ms
ORDER BY regression_factor DESC, m.worst_avg_ms DESC;
```

| query_id | plan_count | best_avg_ms | worst_avg_ms | regression_factor | sample_query_text |
|---:|---:|---:|---:|---:|---|
| 249 | 2 | 0.326 | 3.484 | 10.69 | `DELETE b FROM bronze.stoxxusa50_ohlcv b INNER JOIN ( SELECT symbol, MAX(date) AS max_date FROM bronze.stoxxu` |
| 235 | 2 | 0.443 | 3.175 | 7.17 | `DELETE b FROM bronze.stoxxasia50_ohlcv b INNER JOIN ( SELECT symbol, MAX(date) AS max_date FROM bronze.stoxx` |
| 228 | 2 | 0.448 | 3.124 | 6.97 | `DELETE b FROM bronze.eurostoxx50_ohlcv b INNER JOIN ( SELECT symbol, MAX(date) AS max_date FROM bronze.euros` |
| 2766 | 2 | 0.265 | 0.763 | 2.88 | `(@_msparam_0 nvarchar(4000),@_msparam_1 nvarchar(4000),@_msparam_2 nvarchar(4000),@_msparam_3 nvarchar(4000))SELECT clmns.name AS` |
| 1881 | 5 | 7.295 | 13.641 | 1.87 | `UPDATE STATISTICS [silver].[eurostoxx50_ohlcv]` |
| 1879 | 4 | 10.190 | 15.723 | 1.54 | `UPDATE STATISTICS [silver].[stoxxasia50_ohlcv]` |
| 1880 | 4 | 10.215 | 14.922 | 1.46 | `UPDATE STATISTICS [silver].[stoxxusa50_ohlcv]` |
| 549 | 2 | 2.501 | 2.793 | 1.12 | `(@P1 nvarchar(6))SELECT date FROM bronze.trading_calendar WHERE exchange_code = @P1 AND is_trading_day = 1` |

_There are real multi-plan candidates in the live Query Store history. The strongest ones are the bronze OHLCV cleanup deletes, where the worst persisted plan is about `7x` to `11x` slower than the best one. That does not prove the current wait profile is caused by plan regression, but it is strong enough to justify a pivot into the dedicated Query Store regression note if those statements are part of the incident window._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `plan_count > 1` | Multiple persisted plans | Depends | The query has experienced plan variation. | Regression is possible, not guaranteed. |
| `regression_factor >= 2` | Material spread | &#10060; | Worst persisted plan is at least twice as slow as the best one. | Strong candidate for plan comparison and forcing review. |
| `regression_factor` near `1` | Low spread | &#9989; or neutral | Plans are similar in average duration. | Focus elsewhere unless other evidence contradicts it. |

## Common Wait Types — Quick Reference

| Wait type | What it usually means | First thing to verify |
|---|---|---|
| `LCK_M_X`, `LCK_M_U`, `LCK_M_SCH_S`, `LCK_M_IX` | Blocking or metadata serialization | Blocking chain and transaction scope |
| `CXPACKET`, `CXCONSUMER`, `CXSYNC_PORT` | Parallel-plan coordination or skew | Actual plan shape and parallelism settings |
| `PAGEIOLATCH_*` | Data pages not already in cache | File latency and memory pressure |
| `WRITELOG` | Commit or log flush delay | Log latency and commit frequency |
| `PAGELATCH_*` | In-memory latch contention, often TempDB allocation | TempDB file layout and concurrency pattern |
| `RESOURCE_SEMAPHORE` | Queries waiting for memory grants | Memory grants and max server memory |
| `ASYNC_NETWORK_IO` | Client fetching too slowly | Consumer-side fetch and result handling |

## Related

### Companion notes

- [[troubleshooting-flowcharts]]
- [[performance-audit-playbook]]
- [[execution-plans]]
- [[query-store-regressions-and-plan-forcing]]
- [[memory-and-buffer-pool]]
- [[pipeline-integration-and-devex]]

### Official references

- [sys.dm_os_wait_stats](https://learn.microsoft.com/en-us/sql/relational-databases/system-dynamic-management-views/sys-dm-os-wait-stats-transact-sql?view=sql-server-ver17)
- [sys.dm_io_virtual_file_stats](https://learn.microsoft.com/en-us/sql/relational-databases/system-dynamic-management-views/sys-dm-io-virtual-file-stats-transact-sql?view=sql-server-ver17)
- [sys.dm_os_volume_stats](https://learn.microsoft.com/en-us/sql/relational-databases/system-dynamic-management-views/sys-dm-os-volume-stats-transact-sql?view=sql-server-ver17)
- [Query Store runtime statistics](https://learn.microsoft.com/en-us/sql/relational-databases/system-catalog-views/sys-query-store-runtime-stats-transact-sql?view=sql-server-ver17)
