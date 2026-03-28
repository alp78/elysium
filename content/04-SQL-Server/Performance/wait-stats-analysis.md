---
type: reference
category: sql-server
technology: [sql-server]
tags: [performance, sql]
aliases: [wait stats, wait statistics, sys.dm_os_wait_stats, PAGEIOLATCH, WRITELOG, LCK_M, CXPACKET, SOS_SCHEDULER_YIELD, RESOURCE_SEMAPHORE, wait type interpretation]
keywords: [wait stats, wait statistics, sys.dm_os_wait_stats, PAGEIOLATCH_SH, PAGEIOLATCH_EX, WRITELOG, PAGELATCH, LCK_M_X, LCK_M_S, CXPACKET, CXCONSUMER, SOS_SCHEDULER_YIELD, RESOURCE_SEMAPHORE, ASYNC_NETWORK_IO, signal wait, resource wait, idle waits, benign waits, DBCC SQLPERF, wait type, performance diagnosis, query plan, page life expectancy, buffer pool, I/O latency, disk throughput]
description: "How to read SQL Server wait statistics (sys.dm_os_wait_stats) to diagnose performance problems: the complete filtered wait query, signal vs. resource wait interpretation, common wait type meanings for pipeline workloads, I/O latency benchmarks, and Query Store setup for regression detection."
related: [essential-dba-queries, memory-and-buffer-pool, io-latency-analysis, blocking-and-locking, execution-plans, performance-audit-playbook]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Wait Stats Analysis

Wait statistics are the single most important diagnostic for SQL Server performance problems. They answer: "What is SQL Server spending its time waiting on?" Every time a session cannot proceed immediately, it records a wait. Analyzing the cumulative waits across the instance tells you exactly which resource is the bottleneck — disk, memory, CPU, or locks. For a structured process that incorporates these queries into a repeatable audit, see [[performance-audit-playbook]].

---

## System Health Dashboard — First Check

Run this single query first during any performance incident to get a bird's-eye view:

```sql
-- Quick health check: CPU, memory, IO, connections
SELECT
    (SELECT cpu_count FROM sys.dm_os_sys_info) AS logical_cpus,
    (SELECT physical_memory_kb / 1024 FROM sys.dm_os_sys_info) AS physical_memory_mb,
    (SELECT committed_kb / 1024 FROM sys.dm_os_sys_info) AS committed_memory_mb,
    (SELECT cntr_value FROM sys.dm_os_performance_counters
     WHERE counter_name = 'Page life expectancy'
       AND object_name LIKE '%Buffer Manager%') AS page_life_expectancy_sec,
    (SELECT cntr_value FROM sys.dm_os_performance_counters
     WHERE counter_name = 'Buffer cache hit ratio'
       AND object_name LIKE '%Buffer Manager%') AS buffer_cache_hit_ratio,
    (SELECT cntr_value FROM sys.dm_os_performance_counters
     WHERE counter_name = 'Batch Requests/sec'
       AND object_name LIKE '%SQL Statistics%') AS batch_requests_sec,
    (SELECT COUNT(*) FROM sys.dm_exec_sessions WHERE is_user_process = 1) AS user_sessions,
    (SELECT COUNT(*) FROM sys.dm_exec_requests WHERE status = 'running') AS active_queries;
```

#### sys.dm_os_wait_stats — interpretation thresholds

| Metric | Healthy | Investigate |
|--------|---------|-------------|
| Page Life Expectancy | > 300s | < 60s (memory pressure, buffer pool churning) |
| Buffer Cache Hit Ratio | > 95% | < 90% (data doesn't fit in memory) |
| Batch Requests/sec | Baseline-dependent | Sudden 10x spike = runaway query |
| Active queries | < vCPU count | > 4× vCPU count = queueing |

---

## Top Waits Query — The Primary Diagnostic

This query filters out benign idle waits and returns only the waits that represent real work waiting on resources. The exclude list is comprehensive — every wait type in it is a background process or idle wait that provides no diagnostic value.

```sql
-- Top 10 waits by cumulative time (excludes idle/benign waits)
WITH waits AS (
    SELECT
        wait_type,
        wait_time_ms,
        signal_wait_time_ms,
        wait_time_ms - signal_wait_time_ms AS resource_wait_ms,
        waiting_tasks_count,
        100.0 * wait_time_ms / SUM(wait_time_ms) OVER () AS pct_total
    FROM sys.dm_os_wait_stats
    WHERE wait_type NOT IN (
        'BROKER_EVENTHANDLER', 'BROKER_RECEIVE_WAITFOR', 'BROKER_TASK_STOP',
        'BROKER_TO_FLUSH', 'BROKER_TRANSMITTER', 'CHECKPOINT_QUEUE',
        'CHKPT', 'CLR_AUTO_EVENT', 'CLR_MANUAL_EVENT', 'CLR_SEMAPHORE',
        'DBMIRROR_DBM_EVENT', 'DBMIRROR_EVENTS_QUEUE', 'DBMIRROR_WORKER_QUEUE',
        'DBMIRRORING_CMD', 'DIRTY_PAGE_POLL', 'DISPATCHER_QUEUE_SEMAPHORE',
        'EXECSYNC', 'FSAGENT', 'FT_IFTS_SCHEDULER_IDLE_WAIT',
        'FT_IFTSHC_MUTEX', 'HADR_CLUSAPI_CALL', 'HADR_FILESTREAM_IOMGR_IOCOMPLETION',
        'HADR_LOGCAPTURE_WAIT', 'HADR_NOTIFICATION_DEQUEUE',
        'HADR_TIMER_TASK', 'HADR_WORK_QUEUE', 'KSOURCE_WAKEUP',
        'LAZYWRITER_SLEEP', 'LOGMGR_QUEUE', 'MEMORY_ALLOCATION_EXT',
        'ONDEMAND_TASK_QUEUE', 'PARALLEL_REDO_DRAIN_WORKER',
        'PARALLEL_REDO_LOG_CACHE', 'PARALLEL_REDO_TRAN_LIST',
        'PARALLEL_REDO_WORKER_SYNC', 'PARALLEL_REDO_WORKER_WAIT_WORK',
        'PREEMPTIVE_OS_FLUSHFILEBUFFERS', 'PREEMPTIVE_XE_GETTARGETSTATE',
        'PVS_PREALLOCATE', 'PWAIT_ALL_COMPONENTS_INITIALIZED',
        'PWAIT_DIRECTLOGCONSUMER_GETNEXT', 'QDS_PERSIST_TASK_MAIN_LOOP_SLEEP',
        'QDS_ASYNC_QUEUE', 'QDS_CLEANUP_STALE_QUERIES_TASK_MAIN_LOOP_SLEEP',
        'QDS_SHUTDOWN_QUEUE', 'REDO_THREAD_PENDING_WORK',
        'REQUEST_FOR_DEADLOCK_SEARCH', 'RESOURCE_QUEUE',
        'SERVER_IDLE_CHECK', 'SLEEP_BPOOL_FLUSH', 'SLEEP_DBSTARTUP',
        'SLEEP_DCOMSTARTUP', 'SLEEP_MASTERDBREADY', 'SLEEP_MASTERMDREADY',
        'SLEEP_MASTERUPGRADED', 'SLEEP_MSDBSTARTUP', 'SLEEP_SYSTEMTASK',
        'SLEEP_TASK', 'SLEEP_TEMPDBSTARTUP', 'SNI_HTTP_ACCEPT',
        'SOS_WORK_DISPATCHER', 'SP_SERVER_DIAGNOSTICS_SLEEP',
        'SQLTRACE_BUFFER_FLUSH', 'SQLTRACE_INCREMENTAL_FLUSH_SLEEP',
        'SQLTRACE_WAIT_ENTRIES', 'VDI_CLIENT_OTHER',
        'WAIT_FOR_RESULTS', 'WAITFOR', 'WAITFOR_TASKSHUTDOWN',
        'WAIT_XTP_CKPT_CLOSE', 'WAIT_XTP_HOST_WAIT',
        'WAIT_XTP_OFFLINE_CKPT_NEW_LOG', 'WAIT_XTP_RECOVERY',
        'XE_BUFFERMGR_ALLPROCESSED_EVENT', 'XE_DISPATCHER_JOIN',
        'XE_DISPATCHER_WAIT', 'XE_TIMER_EVENT'
    )
      AND wait_time_ms > 0
)
SELECT TOP 10
    wait_type,
    waiting_tasks_count AS wait_count,
    CAST(wait_time_ms / 1000.0 AS DECIMAL(18,1)) AS wait_sec,
    CAST(resource_wait_ms / 1000.0 AS DECIMAL(18,1)) AS resource_wait_sec,
    CAST(signal_wait_time_ms / 1000.0 AS DECIMAL(18,1)) AS signal_wait_sec,
    CAST(pct_total AS DECIMAL(5,1)) AS pct_of_total
FROM waits
ORDER BY wait_time_ms DESC;
```

#### signal_wait_ms vs resource_wait_ms — CPU pressure indicator

- **resource_wait_ms** — time waiting for the actual resource (disk, lock, memory). This is the problem.
- **signal_wait_ms** — time waiting to be rescheduled on a CPU after the resource became available. High signal waits indicate CPU pressure.

#### DBCC SQLPERF('sys.dm_os_wait_stats', CLEAR) — reset for clean baseline

```sql
DBCC SQLPERF('sys.dm_os_wait_stats', CLEAR);
```

---

## Wait Type Interpretation for Pipeline Workloads

| Wait Type | Meaning | Action |
|-----------|---------|--------|
| `PAGEIOLATCH_SH/EX` | Reading data pages from disk (buffer pool miss) | Add RAM, increase buffer pool, or speed up disks |
| `WRITELOG` | Transaction log write latency | Move log to dedicated pd-ssd, check disk IOPS |
| `PAGELATCH_EX/SH` | TempDB allocation contention | Add TempDB data files (1 per vCPU, up to 8) |
| `LCK_M_X/LCK_M_S` | Lock contention between sessions | Review isolation levels, batch sizes, indexing |
| `CXPACKET/CXCONSUMER` | Parallelism skew | Check MAXDOP setting, statistics freshness |
| `SOS_SCHEDULER_YIELD` | CPU pressure (queries yielding scheduler) | Optimize queries, increase vCPUs |
| `RESOURCE_SEMAPHORE` | Memory grant queue (queries waiting for RAM) | Reduce query memory grants, increase RAM |
| `ASYNC_NETWORK_IO` | Client not consuming results fast enough | Check Airflow worker network, Python cursor fetchsize |

> [!tip] Related pattern: Datadog monitoring
> These same wait types can be tracked continuously via [[datadog-sql-server-integration]], which surfaces `PAGEIOLATCH`, `LCK_M`, and other waits as Datadog metrics. For custom DMV-based queries exposed through Datadog, see [[datadog-custom-queries]].

> [!info] High Signal Waits = CPU Bottleneck
> If `signal_wait_sec` is a significant fraction of `wait_sec`, the bottleneck is CPU — sessions are waiting to be scheduled even after their resource is available. This is distinct from `SOS_SCHEDULER_YIELD` which indicates queries are running but actively yielding their time slice.

---

## Top Resource-Consuming Queries

### Top CPU Consumers

```sql
SELECT TOP 15
    qs.total_worker_time / 1000 AS total_cpu_ms,
    qs.execution_count,
    qs.total_worker_time / qs.execution_count / 1000 AS avg_cpu_ms,
    qs.total_logical_reads / qs.execution_count AS avg_logical_reads,
    qs.total_logical_writes / qs.execution_count AS avg_logical_writes,
    SUBSTRING(st.text, (qs.statement_start_offset / 2) + 1,
        ((CASE qs.statement_end_offset
            WHEN -1 THEN DATALENGTH(st.text)
            ELSE qs.statement_end_offset
        END - qs.statement_start_offset) / 2) + 1) AS query_text,
    qp.query_plan
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
CROSS APPLY sys.dm_exec_query_plan(qs.plan_handle) qp
ORDER BY qs.total_worker_time DESC;
```

### Top IO Consumers

```sql
SELECT TOP 15
    qs.total_logical_reads + qs.total_logical_writes AS total_io,
    qs.execution_count,
    (qs.total_logical_reads + qs.total_logical_writes) / qs.execution_count AS avg_io,
    qs.total_physical_reads / NULLIF(qs.execution_count, 0) AS avg_physical_reads,
    SUBSTRING(st.text, (qs.statement_start_offset / 2) + 1,
        ((CASE qs.statement_end_offset
            WHEN -1 THEN DATALENGTH(st.text)
            ELSE qs.statement_end_offset
        END - qs.statement_start_offset) / 2) + 1) AS query_text
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
ORDER BY total_io DESC;
```

### Currently Running Long Queries

```sql
SELECT
    r.session_id,
    r.status,
    r.command,
    r.wait_type,
    r.wait_time,
    r.cpu_time,
    r.logical_reads,
    r.writes,
    r.total_elapsed_time / 1000 AS elapsed_sec,
    SUBSTRING(st.text, (r.statement_start_offset / 2) + 1,
        ((CASE r.statement_end_offset
            WHEN -1 THEN DATALENGTH(st.text)
            ELSE r.statement_end_offset
        END - r.statement_start_offset) / 2) + 1) AS current_statement,
    s.login_name,
    s.host_name,
    s.program_name
FROM sys.dm_exec_requests r
JOIN sys.dm_exec_sessions s ON r.session_id = s.session_id
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) st
WHERE s.is_user_process = 1
ORDER BY r.total_elapsed_time DESC;
```

---

## Database File I/O Latency

```sql
SELECT
    DB_NAME(fs.database_id) AS database_name,
    f.name AS file_name,
    f.type_desc,
    f.physical_name,
    fs.num_of_reads,
    fs.num_of_writes,
    fs.io_stall_read_ms / NULLIF(fs.num_of_reads, 0) AS avg_read_latency_ms,
    fs.io_stall_write_ms / NULLIF(fs.num_of_writes, 0) AS avg_write_latency_ms,
    fs.num_of_bytes_read / 1024 / 1024 AS total_read_mb,
    fs.num_of_bytes_written / 1024 / 1024 AS total_write_mb
FROM sys.dm_io_virtual_file_stats(NULL, NULL) fs
JOIN sys.master_files f ON fs.database_id = f.database_id AND fs.file_id = f.file_id
ORDER BY (fs.io_stall_read_ms + fs.io_stall_write_ms) DESC;
```

#### sys.dm_io_virtual_file_stats — latency thresholds for SSD-backed GCP pd-ssd

| File Type | Acceptable | Warning | Critical |
|-----------|-----------|---------|----------|
| Data (.mdf/.ndf) | < 5ms | 5–15ms | > 15ms |
| Log (.ldf) | < 2ms | 2–5ms | > 5ms |
| TempDB | < 2ms | 2–5ms | > 5ms |

> [!warning] Log Latency Is the Most Impactful
> Every COMMIT waits for the log flush to complete (synchronous fsync). `avg_write_latency_ms` on the `.ldf` file directly adds to every transaction's response time. The log file must be on the fastest available disk — separate from the data files when possible.

---

## TempDB Contention Detection

TempDB allocation page contention (`PAGELATCH_EX/SH` on pages `2:1:1`, `2:1:2`, `2:1:3`) is a common bottleneck when multiple sessions allocate temp objects simultaneously.

#### sys.dm_io_virtual_file_stats — TempDB per-file I/O distribution

```sql
-- TempDB file IO stats (per file — look for uneven distribution)
SELECT
    f.name AS file_name,
    f.physical_name,
    fs.num_of_reads,
    fs.num_of_writes,
    fs.num_of_bytes_read / 1024 / 1024 AS read_mb,
    fs.num_of_bytes_written / 1024 / 1024 AS write_mb,
    fs.io_stall_read_ms,
    fs.io_stall_write_ms,
    fs.io_stall_read_ms / NULLIF(fs.num_of_reads, 0) AS avg_read_stall_ms,
    fs.io_stall_write_ms / NULLIF(fs.num_of_writes, 0) AS avg_write_stall_ms
FROM sys.dm_io_virtual_file_stats(2, NULL) fs  -- database_id 2 = tempdb
JOIN sys.master_files f ON fs.database_id = f.database_id AND fs.file_id = f.file_id
ORDER BY f.file_id;
```

#### sys.dm_exec_requests PAGELATCH — check PFS/GAM/SGAM contention

```sql
-- Check for PFS/GAM/SGAM page contention
SELECT
    session_id,
    wait_type,
    wait_duration_ms,
    resource_description  -- Look for '2:1:1' (PFS), '2:1:2' (GAM), '2:1:3' (SGAM)
FROM sys.dm_os_waiting_tasks
WHERE wait_type LIKE 'PAGELATCH%'
  AND resource_description LIKE '2:%'
ORDER BY wait_duration_ms DESC;
```

#### ALTER DATABASE tempdb ADD FILE — add data files per vCPU to fix contention

```sql
-- Check current TempDB files
SELECT name, physical_name, size * 8 / 1024 AS size_mb
FROM sys.master_files WHERE database_id = 2;

-- Add files (example for 4 vCPUs, if you have only 1 file)
ALTER DATABASE tempdb ADD FILE (
    NAME = tempdev2, FILENAME = '/sqltempdb/tempdev2.ndf', SIZE = 1024MB, FILEGROWTH = 256MB);
ALTER DATABASE tempdb ADD FILE (
    NAME = tempdev3, FILENAME = '/sqltempdb/tempdev3.ndf', SIZE = 1024MB, FILEGROWTH = 256MB);
ALTER DATABASE tempdb ADD FILE (
    NAME = tempdev4, FILENAME = '/sqltempdb/tempdev4.ndf', SIZE = 1024MB, FILEGROWTH = 256MB);

-- All TempDB data files MUST be the same size for proportional fill to work
```

---

## Query Store — Regression Detection

Query Store persists execution plans and performance metrics across restarts, enabling before/after comparison and plan forcing.

#### ALTER DATABASE SET QUERY_STORE — enable and configure Query Store

```sql
ALTER DATABASE analytics_db SET QUERY_STORE = ON;
ALTER DATABASE analytics_db SET QUERY_STORE (
    OPERATION_MODE = READ_WRITE,
    MAX_STORAGE_SIZE_MB = 500,
    INTERVAL_LENGTH_MINUTES = 30,
    DATA_FLUSH_INTERVAL_SECONDS = 600,
    STALE_QUERY_THRESHOLD_DAYS = 30,
    SIZE_BASED_CLEANUP_MODE = AUTO,
    QUERY_CAPTURE_MODE = AUTO,
    MAX_PLANS_PER_QUERY = 200,
    WAIT_STATS_CAPTURE_MODE = ON
);

-- Verify configuration
SELECT
    desired_state_desc,
    actual_state_desc,
    current_storage_size_mb,
    max_storage_size_mb,
    stale_query_threshold_days,
    query_capture_mode_desc
FROM sys.database_query_store_options;
```

#### sys.query_store_runtime_stats — find regressed queries vs 7-day baseline

```sql
WITH recent AS (
    SELECT
        q.query_id,
        qt.query_sql_text,
        AVG(rs.avg_duration) / 1000.0 AS recent_avg_ms,
        AVG(rs.avg_cpu_time) / 1000.0 AS recent_avg_cpu_ms,
        AVG(rs.avg_logical_io_reads) AS recent_avg_reads,
        SUM(rs.count_executions) AS recent_executions
    FROM sys.query_store_runtime_stats rs
    JOIN sys.query_store_plan p ON rs.plan_id = p.plan_id
    JOIN sys.query_store_query q ON p.query_id = q.query_id
    JOIN sys.query_store_query_text qt ON q.query_text_id = qt.query_text_id
    WHERE rs.last_execution_time > DATEADD(HOUR, -24, GETUTCDATE())
    GROUP BY q.query_id, qt.query_sql_text
),
baseline AS (
    SELECT
        q.query_id,
        AVG(rs.avg_duration) / 1000.0 AS baseline_avg_ms,
        AVG(rs.avg_cpu_time) / 1000.0 AS baseline_avg_cpu_ms,
        AVG(rs.avg_logical_io_reads) AS baseline_avg_reads
    FROM sys.query_store_runtime_stats rs
    JOIN sys.query_store_plan p ON rs.plan_id = p.plan_id
    JOIN sys.query_store_query q ON p.query_id = q.query_id
    WHERE rs.last_execution_time BETWEEN DATEADD(DAY, -7, GETUTCDATE())
                                     AND DATEADD(HOUR, -24, GETUTCDATE())
    GROUP BY q.query_id
)
SELECT TOP 20
    r.query_id,
    LEFT(r.query_sql_text, 200) AS query_text,
    r.recent_executions,
    CAST(b.baseline_avg_ms AS DECIMAL(10,1)) AS baseline_ms,
    CAST(r.recent_avg_ms AS DECIMAL(10,1)) AS recent_ms,
    CAST(r.recent_avg_ms / NULLIF(b.baseline_avg_ms, 0) AS DECIMAL(5,1)) AS regression_factor,
    CAST(r.recent_avg_reads AS INT) AS recent_reads,
    CAST(b.baseline_avg_reads AS INT) AS baseline_reads
FROM recent r
JOIN baseline b ON r.query_id = b.query_id
WHERE r.recent_avg_ms > b.baseline_avg_ms * 2
  AND r.recent_executions > 5
ORDER BY r.recent_avg_ms / NULLIF(b.baseline_avg_ms, 0) DESC;
```

#### sp_query_store_force_plan — force a known-good plan for regressed query

```sql
-- List available plans for a specific query
SELECT
    p.plan_id,
    p.query_id,
    p.is_forced_plan,
    rs.avg_duration / 1000.0 AS avg_ms,
    rs.avg_logical_io_reads AS avg_reads,
    rs.count_executions,
    rs.last_execution_time
FROM sys.query_store_plan p
JOIN sys.query_store_runtime_stats rs ON p.plan_id = rs.plan_id
WHERE p.query_id = @query_id  -- replace with actual query_id
ORDER BY rs.avg_duration;

-- Force the best plan
EXEC sp_query_store_force_plan @query_id = @query_id, @plan_id = @plan_id;

-- Unforce when no longer needed
-- EXEC sp_query_store_unforce_plan @query_id = @query_id, @plan_id = @plan_id;
```

---

## Related

- [[essential-dba-queries]] — quick diagnostic queries run during incidents
- [[memory-and-buffer-pool]] — Page Life Expectancy, buffer pool pressure details
- [[performance-audit-playbook]] — full structured audit including disk I/O metrics
- [[blocking-and-locking]] — `LCK_M_*` wait type analysis
- [[execution-plans]] — reading plans to find the root cause of high waits
- [[performance-audit-playbook]] — structured process using these wait stat queries
