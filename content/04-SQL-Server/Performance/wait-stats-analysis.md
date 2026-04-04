---
tags: [performance, sql, sql-server, tsql]
aliases: [wait stats, wait statistics, sys.dm_os_wait_stats, PAGEIOLATCH, WRITELOG, LCK_M, CXPACKET, SOS_SCHEDULER_YIELD, RESOURCE_SEMAPHORE, wait type interpretation]
description: "How to read SQL Server wait statistics (sys.dm_os_wait_stats) to diagnose performance problems: the complete filtered wait query, signal vs. resource wait interpretation, common wait type meanings for pipeline workloads, I/O latency benchmarks, and Query Store setup for regression detection."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Wait Stats Analysis

> [!quote]
> "In God we trust. All others must bring data."
>
> — **W. Edwards Deming**, management philosophy (attributed)

Wait statistics are the single most important diagnostic for SQL Server performance problems. They answer: "What is SQL Server spending its time waiting on?" Every time a session cannot proceed immediately, it records a wait. Analyzing the cumulative waits across the instance tells you exactly which resource is the bottleneck — disk, memory, CPU, or locks. For a structured process that incorporates these queries into a repeatable audit, see [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/Performance/performance-audit-playbook).

---

## System Health Dashboard — First Check

Before drilling into wait statistics, a single multi-metric query gives the overall instance health picture. It draws from three DMVs: `sys.dm_os_sys_info` (static hardware facts: CPU count, physical RAM, committed memory), `sys.dm_os_performance_counters` (the same counters exposed by Windows Performance Monitor — updated in real time by SQL Server's internal counters), and `sys.dm_exec_sessions` / `sys.dm_exec_requests` (currently connected sessions and actively running queries). Together they answer whether the instance is memory-starved, CPU-saturated, or idle — before spending time on deeper analysis.

### Quick health snapshot — sys.dm_os_sys_info and sys.dm_os_performance_counters

`sys.dm_os_sys_info` returns one row with static facts about the host: logical CPU count, physical and committed memory in kilobytes. `sys.dm_os_performance_counters` returns one row per counter and requires filtering by `counter_name` and `object_name`; the `LIKE '%Buffer Manager%'` pattern matches regardless of the named instance prefix. `sys.dm_exec_sessions` counts all connections where `is_user_process = 1` (excludes system background sessions). `sys.dm_exec_requests` shows requests currently executing or waiting.

```sql
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

### Health metric interpretation thresholds

Each metric has a clear diagnostic meaning. **Page Life Expectancy (PLE)** measures how long, in seconds, a data page stays in the buffer pool before being evicted — a falling PLE means SQL Server is reading the same pages from disk repeatedly because RAM cannot hold the working set. **Buffer Cache Hit Ratio** is the percentage of logical reads (page requests) satisfied from the buffer pool without a physical disk read; values below 90% indicate the working set exceeds available RAM. **Batch Requests/sec** is a workload volume indicator — a sudden 10× spike usually means a runaway query or connection storm, not normal growth. **Active queries** exceeding vCPU count indicates CPU queueing, where more tasks are ready to run than there are schedulers to run them.

| Metric | Healthy | Investigate |
|--------|---------|-------------|
| Page Life Expectancy | > 300s | < 60s (memory pressure, buffer pool churning) |
| Buffer Cache Hit Ratio | > 95% | < 90% (data doesn't fit in memory) |
| Batch Requests/sec | Baseline-dependent | Sudden 10× spike = runaway query |
| Active queries | < vCPU count | > 4× vCPU count = queueing |

---

## Top Waits Query — The Primary Diagnostic

`sys.dm_os_wait_stats` is an instance-level DMV that accumulates wait statistics since the last SQL Server restart (or since `DBCC SQLPERF('sys.dm_os_wait_stats', CLEAR)` was last run). It is the primary diagnostic surface for the SQLOS cooperative scheduler. Every time a worker thread cannot proceed — because a disk page is not in memory, a lock is held by another session, a memory grant is not available, or a CPU scheduler slot is full — SQL Server records the wait type and the time spent waiting. This is not sampling: every wait is recorded deterministically, making `sys.dm_os_wait_stats` authoritative rather than approximate.

The SQLOS scheduler runs each worker through three states: **RUNNING** (actively using a CPU quantum), **SUSPENDED** (blocked on a resource — disk, lock, memory, network), and **RUNNABLE** (resource is available, but waiting for a CPU slot). The time spent in SUSPENDED state is the **resource wait**. The time spent in RUNNABLE state is the **signal wait**. Both are accumulated in `sys.dm_os_wait_stats`.

> [!info] Per-Session Wait Breakdown (SQL Server 2016+)
>
> `sys.dm_exec_session_wait_stats` surfaces the same wait type breakdown as `sys.dm_os_wait_stats`, but scoped to individual sessions. It is ideal for diagnosing why a specific stored procedure is slow without correlating against instance-level waits. The data is reset when a session opens or when a pooled connection is returned to the pool.

### sys.dm_os_wait_stats — top waits query with benign exclusions

This query filters out benign idle waits and returns only the waits that represent real work waiting on resources. The exclude list is comprehensive — every wait type in it is a background process or idle wait that provides no diagnostic value.

```sql
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

### signal_wait_ms vs resource_wait_ms — CPU pressure indicator

The query derives `resource_wait_ms` as `wait_time_ms - signal_wait_time_ms`. These two components have opposite diagnostic meanings:

- **resource_wait_ms** — time spent in SUSPENDED state, waiting for the actual resource (disk, lock, memory). This is the primary bottleneck indicator — the resource listed in `wait_type` is what is limiting throughput.
- **signal_wait_ms** — time spent in RUNNABLE state after the resource became available, waiting for a CPU scheduler slot. A `signal_wait_ms` above 10–15% of `wait_time_ms` indicates CPU pressure — sessions are ready to run but cannot get a quantum. This is distinct from the underlying resource wait and points to CPU saturation rather than I/O or lock contention.

> [!info] SQL Server 2022 — Permission Change
>
> Querying `sys.dm_os_wait_stats` in SQL Server 2022 requires the `VIEW SERVER PERFORMANCE STATE` permission (previously `VIEW SERVER STATE`). Existing monitoring accounts may need this permission re-granted after an upgrade to 2022.

#### DBCC SQLPERF — reset cumulative stats for clean baseline

`DBCC SQLPERF('sys.dm_os_wait_stats', CLEAR)` resets all cumulative counters to zero. Use this before a focused troubleshooting window to get a clean baseline for the incident period rather than reading noise from months of accumulated waits. Do not run in production during normal operations — the history is destroyed and cannot be recovered. A safer alternative is a delta snapshot: capture wait stats into a temp table at T0, run the workload, then compute the difference at T+N without clearing.

```sql
DBCC SQLPERF('sys.dm_os_wait_stats', CLEAR);
```

---

### Wait Type Interpretation for Pipeline Workloads

Each wait type maps to a specific bottleneck category. The action column gives the first remediation step; deeper per-type analysis is in the sections above. `CXPACKET` and `CXCONSUMER` are only actionable when they dominate the top waits list — if they rank below other wait types, fix those first and parallelism waits will typically shrink as a side effect.

| Wait Type | Meaning | Action |
|-----------|---------|--------|
| `PAGEIOLATCH_SH/EX` | Reading data pages from disk (buffer pool miss) | Add RAM, increase buffer pool, or speed up disks |
| `WRITELOG` | Transaction log write latency | Move log to dedicated pd-ssd, check disk IOPS, batch writes |
| `PAGELATCH_EX/SH` | TempDB allocation contention | Add TempDB data files (1 per vCPU, up to 8) |
| `LCK_M_X/LCK_M_S` | Lock contention between sessions | Review isolation levels, batch sizes, indexing |
| `CXPACKET` | Parallel producer thread synchronization (post SQL 2016 SP2) | Check MAXDOP, cost threshold for parallelism, statistics freshness |
| `CXCONSUMER` | Parent thread waiting for parallel child to produce rows (normal overhead) | Only act if dominant; usually resolves when underlying bottleneck is fixed |
| `SOS_SCHEDULER_YIELD` | CPU pressure (queries voluntarily yielding scheduler after 4ms quantum) | Optimize queries, increase vCPUs |
| `RESOURCE_SEMAPHORE` | Memory grant queue (queries waiting for RAM for sort/hash) | Reduce query memory grants, increase RAM |
| `ASYNC_NETWORK_IO` | Client not consuming results fast enough | Check Airflow worker network, Python cursor fetchsize |

> [!info] CXPACKET / CXCONSUMER Version Split
>
> Prior to SQL Server 2016 SP2, all parallelism synchronization was reported as `CXPACKET`, making it impossible to distinguish actionable producer-side stalls from normal consumer-side overhead. From SQL Server 2016 SP2 / 2017 CU3 onward: `CXPACKET` narrows to producer-thread and Exchange Iterator port synchronization waits only; `CXCONSUMER` covers the parent thread waiting for rows from child threads and is generally benign. SQL Server 2022 further introduces `CXSYNC_PORT` and `CXSYNC_CONSUMER` for Exchange Iterator port synchronization, making `CXPACKET` strictly a producer-thread wait. When analyzing CXPACKET in SQL Server 2022, these two new wait types must also be examined. A high `cost threshold for parallelism` (default: 5, recommended 50+) prevents trivial queries from going parallel and reduces all three wait types.

> [!info] WRITELOG — Multiple Log Writer Threads
>
> `WRITELOG` indicates a thread is waiting for a transaction log flush to complete. Every `COMMIT` is synchronous — the log record must be written to disk before the transaction is acknowledged. SQL Server 2016 introduced up to 4 parallel Log Writer threads; SQL Server 2019 extended this to up to 8 Log Writer threads and also allows regular worker threads to write log directly, bypassing the Log Writer queue entirely. Persistent `WRITELOG` waits in SQL Server 2019+ that survive log file separation are more likely caused by excessive VLFs (Virtual Log Files) from suboptimal autogrowth settings or by too many micro-transactions (each auto-commit triggers a flush — use explicit `BEGIN TRAN / COMMIT` batching to reduce flush frequency).

> [!tip] Datadog Monitoring
>
> These same wait types can be tracked continuously via [datadog-sql-server-integration](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-sql-server-integration), which surfaces `PAGEIOLATCH`, `LCK_M`, and other waits as Datadog metrics. For custom DMV-based queries exposed through Datadog, see [datadog-custom-queries](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-custom-queries).

> [!info] High Signal Waits = CPU Bottleneck
>
> If `signal_wait_sec` exceeds 10–15% of `wait_sec`, the bottleneck is CPU scheduler pressure — sessions are ready to run but cannot get a CPU quantum. Values below 10% are typical for healthy workloads. This is distinct from `SOS_SCHEDULER_YIELD`, which indicates queries are actively running but voluntarily yielding their 4 ms time slice after failing to complete, a sign of CPU-intensive query patterns rather than scheduler saturation.

---

## Top Resource-Consuming Queries

`sys.dm_exec_query_stats` accumulates execution statistics for every query plan currently cached in the plan cache. It is the complement to `sys.dm_os_wait_stats`: wait stats tell you *what* the instance is waiting on; query stats tell you *which query* is causing it. The three queries below join `sys.dm_exec_query_stats` with `sys.dm_exec_sql_text` (to retrieve the SQL text from the plan cache by `sql_handle`) and `sys.dm_exec_query_plan` (to retrieve the XML execution plan by `plan_handle`). Plans are evicted from cache under memory pressure, so these queries reflect current cached plans only — Query Store (see below) provides historical data that survives cache eviction and restarts.

### Top CPU Consumers

`total_worker_time` accumulates CPU microseconds across all executions of this plan. Divided by 1000 it gives milliseconds. `avg_cpu_ms` = `total_worker_time / execution_count / 1000` normalizes for query frequency: a query called 100,000 times with 1 ms each contributes more total CPU than a query called 10 times with 500 ms each, but the latter is the one to optimize for single-execution cost.

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

**Logical reads** are page reads satisfied from the buffer pool (memory) — they are free in terms of disk I/O but still consume CPU for buffer latch acquisition. **Physical reads** (`avg_physical_reads`) are the subset that required a disk read because the page was not in the buffer pool. A query with high logical reads but zero physical reads is a candidate for indexing improvements, not disk upgrades. A query with high physical reads relative to logical reads indicates the working set exceeds the buffer pool and the query is causing cache eviction for other workloads.

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

`sys.dm_exec_requests` shows requests that are currently executing or waiting. Unlike `sys.dm_exec_query_stats` (which is historical/cumulative), this is a real-time snapshot. The key columns: `total_elapsed_time` is wall-clock time in microseconds since the request started; `cpu_time` is CPU microseconds consumed so far; `logical_reads` and `writes` are running totals for the current execution. `wait_type` and `wait_time` show what the request is currently blocked on — matching this against the top wait stats query confirms which query is driving a specific wait type.

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

`sys.dm_io_virtual_file_stats(database_id, file_id)` returns per-file I/O statistics accumulated since the last SQL Server restart. Passing `NULL` for both parameters returns all files across all databases. The key computed columns are `avg_read_latency_ms` and `avg_write_latency_ms`, derived by dividing cumulative stall time (`io_stall_read_ms`, `io_stall_write_ms`) by the corresponding operation count (`num_of_reads`, `num_of_writes`). `NULLIF` prevents division-by-zero for files that have had no reads or writes since startup. The `sys.master_files` join resolves the database and file IDs to human-readable names and physical paths.

> [!warning] Cumulative Averages Can Mask Recent Degradation
>
> Because `io_stall` columns are cumulative since restart, a server that ran fine for months and then hit I/O contention 2 hours ago will show a healthy-looking average. For incident investigation, compare `avg_read_latency_ms` against current wait stat results: if `PAGEIOLATCH_SH` is high in wait stats but file latency looks normal, the disk may have been replaced or the I/O pattern changed recently.

> [!success] Use sys.dm_io_virtual_file_stats with Delta Snapshots During Incidents
>
> Capture a snapshot of the query results at T0 and T+5 minutes, then compute per-file deltas: `(io_stall_T1 - io_stall_T0) / (num_reads_T1 - num_reads_T0)`. This gives the average latency *during the incident window* without relying on the historical cumulative baseline.

### sys.dm_io_virtual_file_stats — per-database file I/O query

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

### Latency thresholds for SSD-backed GCP pd-ssd

| File Type | Acceptable | Warning | Critical |
|-----------|-----------|---------|----------|
| Data (.mdf/.ndf) | < 5ms | 5–15ms | > 15ms |
| Log (.ldf) | < 2ms | 2–5ms | > 5ms |
| TempDB | < 2ms | 2–5ms | > 5ms |

> [!warning] Log Latency Is the Most Impactful
>
> Every COMMIT waits for the log flush to complete (synchronous fsync). `avg_write_latency_ms` on the `.ldf` file directly adds to every transaction's response time. The log file must be on the fastest available disk — separate from the data files when possible.

> [!success] Safe Pattern — Dedicated pd-ssd for the Log File
>
> Place the `.ldf` file on a dedicated GCP `pd-ssd` persistent disk, separate from the `.mdf` data files. Target `avg_write_latency_ms < 2ms`. If `WRITELOG` dominates wait stats despite fast disks, reduce transaction frequency by batching pipeline writes (e.g., bulk-insert staging rows then single MERGE commit) instead of row-by-row commits.

---

## TempDB Contention Detection

TempDB is a shared workspace used by all sessions for temp tables, table variables, hash join/sort spill buffers, row version stores (for snapshot isolation), and cursor data. When many sessions allocate temp objects simultaneously, they contend on three special allocation tracking pages inside TempDB — PFS, GAM, and SGAM — which manifests as `PAGELATCH_EX` or `PAGELATCH_SH` waits with `resource_description` values of `2:1:1`, `2:1:2`, or `2:1:3`.

**PFS (Page Free Space)** — page `2:1:1` (and every 8,088th page thereafter). Each PFS byte tracks the free space percentage of one data page. Every allocation updates the relevant PFS byte, making this page a write hot-spot under concurrent allocation workloads.

**GAM (Global Allocation Map)** — page `2:1:2`. Each bit tracks whether a uniform extent (8 contiguous pages) is allocated. Scanning and updating the GAM is required for every new extent allocation.

**SGAM (Shared Global Allocation Map)** — page `2:1:3`. Each bit tracks whether a mixed extent (containing pages from multiple objects) has a free page. Small object allocations (under 8 pages) must scan the SGAM to find available mixed extents.

All three pages are update-latched (`PAGELATCH_EX`) during allocation and share-latched (`PAGELATCH_SH`) during scanning. Under high concurrency, these latches become the serialization point for all TempDB object creation.

> [!info] SQL Server 2019+ — Reduced PFS, GAM, SGAM Contention
>
> SQL Server 2019 changed PFS page updates from exclusive latches to shared latches in all databases (not just TempDB), eliminating most PFS contention without requiring additional data files. SQL Server 2022 extended shared-latch updates to GAM and SGAM pages as well. On SQL Server 2019+ the traditional "1 TempDB data file per vCPU" rule of thumb is less critical for PFS, but multiple data files still distribute GAM/SGAM contention and provide round-robin allocation balance. On SQL Server 2016 and earlier, trace flag `-T1118` eliminates SGAM contention by forcing uniform extent allocation; this behavior is built-in from SQL Server 2016 onward.

> [!info] SQL Server 2019 — Memory-Optimized TempDB Metadata
>
> SQL Server 2019 introduced the **Memory-Optimized TempDB Metadata** feature, which moves system table rows for temp tables (`#temp_table` catalog entries) into in-memory OLTP structures. This eliminates the lock and latch contention on `tempdb.sys.objects` and related system tables that occurs when thousands of temp tables are created and dropped per second. Enable with: `ALTER SERVER CONFIGURATION SET MEMORY_OPTIMIZED TEMPDB_METADATA = ON`. Requires a SQL Server restart. Check with `SELECT SERVERPROPERTY('IsTempdbMetadataMemoryOptimized')`.

### TempDB per-file I/O distribution — check for uneven load

This query uses `sys.dm_io_virtual_file_stats(2, NULL)` — the `2` is the fixed `database_id` for TempDB, `NULL` returns all files. Uneven distribution (one file with significantly higher read/write counts or stall than others) indicates that proportional fill is not balancing load, usually because data files are not the same size. All TempDB data files must be equal in size for SQL Server's proportional fill algorithm to distribute allocations evenly across them.

```sql
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
FROM sys.dm_io_virtual_file_stats(2, NULL) fs
JOIN sys.master_files f ON fs.database_id = f.database_id AND fs.file_id = f.file_id
ORDER BY f.file_id;
```

### sys.dm_os_waiting_tasks — identify PFS/GAM/SGAM page latch contention

`sys.dm_os_waiting_tasks` shows tasks currently in a SUSPENDED state. The `resource_description` column for `PAGELATCH_*` waits uses the format `database_id:file_id:page_id`. A `resource_description` of `2:1:1` is the TempDB PFS page; `2:1:2` is GAM; `2:1:3` is SGAM. Any page address in TempDB following the pattern `2:1:N` where N is a multiple of 8,088 is also a PFS page.

```sql
SELECT
    session_id,
    wait_type,
    wait_duration_ms,
    resource_description
FROM sys.dm_os_waiting_tasks
WHERE wait_type LIKE 'PAGELATCH%'
  AND resource_description LIKE '2:%'
ORDER BY wait_duration_ms DESC;
```

### ALTER DATABASE tempdb ADD FILE — add data files to distribute allocation

Adding TempDB data files distributes PFS/GAM/SGAM contention across multiple allocation pages — each file has its own PFS/GAM/SGAM pages, so concurrent allocations can proceed in parallel across files. The target is one data file per logical CPU, up to a maximum of 8 files (additional files beyond 8 do not provide further improvement). All files must be the same initial size and autogrowth increment; otherwise SQL Server's proportional fill algorithm will direct most allocations to the largest file, defeating the purpose.

```sql
SELECT name, physical_name, size * 8 / 1024 AS size_mb
FROM sys.master_files WHERE database_id = 2;
```

```sql
ALTER DATABASE tempdb ADD FILE (
    NAME = tempdev2, FILENAME = '/sqltempdb/tempdev2.ndf', SIZE = 1024MB, FILEGROWTH = 256MB);
ALTER DATABASE tempdb ADD FILE (
    NAME = tempdev3, FILENAME = '/sqltempdb/tempdev3.ndf', SIZE = 1024MB, FILEGROWTH = 256MB);
ALTER DATABASE tempdb ADD FILE (
    NAME = tempdev4, FILENAME = '/sqltempdb/tempdev4.ndf', SIZE = 1024MB, FILEGROWTH = 256MB);
```

> [!warning] All TempDB Data Files Must Be the Same Size
>
> If files are different sizes, SQL Server's proportional fill writes more to larger files, concentrating I/O and negating the distribution benefit of multiple files. After adding new files, resize all existing files to match before relying on even distribution.

> [!success] Size All TempDB Files Equally on Creation
>
> Set `SIZE` and `FILEGROWTH` identically for all TempDB data files. After adding files, verify with `SELECT name, size * 8 / 1024 AS size_mb FROM sys.master_files WHERE database_id = 2` before putting the server back under load.

---

## Query Store — Regression Detection

Query Store, introduced in SQL Server 2016, is a built-in plan and performance history store that persists to disk inside each database. Unlike `sys.dm_exec_query_stats` (which lives in the plan cache and is lost on restart, plan eviction, or cache flush), Query Store retains runtime statistics and execution plan history across restarts. This makes it the primary tool for detecting performance regressions caused by plan changes — where a query was fast yesterday and slow today because the optimizer chose a different plan after a statistics update or index rebuild.

Query Store tracks three entities per query: the **query text** (`sys.query_store_query_text`), the **execution plans** (`sys.query_store_plan`, multiple plans per query are retained), and the **runtime statistics** (`sys.query_store_runtime_stats`, aggregated per plan per time interval). From SQL Server 2017 onward, `sys.query_store_wait_stats` adds per-plan, per-interval wait category breakdowns — enabling attribution of `PAGEIOLATCH`, `LCK_M`, or `RESOURCE_SEMAPHORE` waits to specific queries and plans, not just instance-level totals.

> [!info] SQL Server 2022 — WAIT_STATS_CAPTURE_MODE Enabled by Default
>
> In SQL Server 2022, `WAIT_STATS_CAPTURE_MODE = ON` is the default for all new databases. In SQL Server 2016–2019, it must be explicitly enabled. Additionally, SQL Server 2022 changes the permission required to read Query Store DMVs from `VIEW SERVER STATE` to `VIEW SERVER PERFORMANCE STATE` — monitoring accounts may need re-granting.

### ALTER DATABASE SET QUERY_STORE — enable and configure Query Store

The `INTERVAL_LENGTH_MINUTES = 30` setting controls how often runtime stats are aggregated into a new time interval — shorter intervals give finer granularity for incident investigation but increase storage consumption. `MAX_PLANS_PER_QUERY = 200` sets the cap on how many distinct plans Query Store retains per query; once reached, the worst-performing plan is evicted. `SIZE_BASED_CLEANUP_MODE = AUTO` allows Query Store to purge old data automatically when it approaches `MAX_STORAGE_SIZE_MB`.

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

### sys.query_store_runtime_stats — find regressed queries vs 7-day baseline

This query uses a CTE pattern to compare the last 24 hours of execution statistics against a 7-day baseline window. `regression_factor` is `recent_avg_ms / baseline_avg_ms` — a value of 3.5 means the query now runs 3.5× slower than its 7-day average. The `WHERE r.recent_avg_ms > b.baseline_avg_ms * 2` filter limits results to queries that have at least doubled in execution time, and `r.recent_executions > 5` excludes one-off outliers. `avg_duration` in `sys.query_store_runtime_stats` is in microseconds; dividing by 1000 gives milliseconds.

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

### sp_query_store_force_plan — force a known-good plan for regressed query

When the regression query identifies a query that regressed after a plan change (identifiable by `regression_factor` and a change in `recent_reads` vs `baseline_reads`), `sp_query_store_force_plan` pins the optimizer to a specific plan by its `plan_id`. The optimizer will use the forced plan regardless of statistics changes, index rebuilds, or cardinality estimate updates — until the plan is unforced with `sp_query_store_unforce_plan`. Forcing is a temporary fix; the root cause (stale statistics, parameter sniffing, or missing index) should still be resolved. To identify the best plan, compare `avg_duration` and `avg_logical_io_reads` across all plans for the query — the plan with the lowest values for the target workload pattern is the one to force.

```sql
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

## Common Wait Types — Quick Reference

Quick reference for the most common wait types. For deep analysis of each wait type with resolution steps, see the sections above.

| Wait Type | Meaning | Typical Cause |
|-----------|---------|---------------|
| `PAGEIOLATCH_SH/EX` | Waiting for data page read from disk | Missing indexes, I/O bottleneck |
| `WRITELOG` | Waiting for log buffer flush | Slow log disk, high transaction rate |
| `LCK_M_*` | Lock contention | Blocking, missing indexes |
| `CXPACKET` / `CXCONSUMER` | Parallel query skew | MAXDOP, statistics stale |
| `SOS_SCHEDULER_YIELD` | CPU pressure, context switching | High CPU load |
| `RESOURCE_SEMAPHORE` | Memory grant waiting | Large sorts/hashes, low server memory |
| `ASYNC_NETWORK_IO` | Client not consuming results fast enough | Chatty app, slow client |
| `IO_COMPLETION` | Non-data I/O (sort spills, etc.) | TempDB I/O |
| `PAGELATCH_EX` | In-memory page latch contention | Hot pages (e.g., last page inserts) |
| `THREADPOOL` | No free workers | Blocked workers, max worker threads hit |

### Related

- [essential-dba-queries](https://alp78.github.io/elysium/04-SQL-Server/Administration/essential-dba-queries) — quick diagnostic queries run during incidents
- [memory-and-buffer-pool](https://alp78.github.io/elysium/04-SQL-Server/Performance/memory-and-buffer-pool) — Page Life Expectancy, buffer pool pressure details
- [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/Performance/performance-audit-playbook) — full structured audit including disk I/O metrics
- [blocking-and-locking](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/blocking-and-locking) — `LCK_M_*` wait type analysis
- [execution-plans](https://alp78.github.io/elysium/04-SQL-Server/Performance/execution-plans) — reading plans to find the root cause of high waits
- [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/Performance/performance-audit-playbook) — structured process using these wait stat queries
