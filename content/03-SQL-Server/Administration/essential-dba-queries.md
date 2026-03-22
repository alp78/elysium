---
type: reference
category: sql-server
technology: [sql-server]
tags: [reference, sql-server, dba, dmv, monitoring, diagnostics]
aliases: [DBA queries, SQL Server diagnostics, DMV queries, sys.dm_exec_sessions, sys.dm_exec_requests]
keywords: [DBA queries, DMV, dynamic management views, server version, database size, active connections, running queries, blocking chains, kill session, wait stats, page life expectancy, sys.dm_exec_sessions, sys.dm_exec_requests, sys.dm_os_wait_stats]
description: "Essential T-SQL diagnostic queries for SQL Server DBAs: server version, database sizes, active connections, currently running queries, blocking chains, and wait statistics."
related: [sqlcmd-connection-and-usage, wait-stats-analysis, blocking-and-locking, performance-audit-playbook]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Essential DBA Queries

These T-SQL queries are the diagnostic toolkit for operating SQL Server in production. Keep them in a script you can run in seconds during an incident. They map to Dynamic Management Views (DMVs) — real-time system tables that expose the internals of the running SQL Server instance.

---

## Server Version and Edition

```sql
-- Server version and edition
SELECT @@VERSION;
-- Shows: SQL Server 2022 Developer Edition, OS, build number
```

---

## Database Sizes

```sql
-- All database sizes
SELECT name, size * 8 / 1024 AS size_mb
FROM sys.master_files
WHERE type_desc = 'ROWS'
ORDER BY size DESC;
-- size is in 8KB pages → multiply by 8 and divide by 1024 for MB
```

---

## Active Connections

```sql
-- Active connections (who's connected right now?)
SELECT login_name, program_name, COUNT(*) AS connections
FROM sys.dm_exec_sessions
WHERE is_user_process = 1
GROUP BY login_name, program_name
ORDER BY connections DESC;
-- program_name shows the application: "Python", "Microsoft JDBC", ".Net SqlClient", etc.
-- Spike in connections often precedes performance problems
```

---

## Currently Running Queries

```sql
-- Currently running queries (what's consuming CPU right now?)
SELECT r.session_id, r.status, r.command,
       r.total_elapsed_time / 1000 AS elapsed_sec,
       r.cpu_time / 1000 AS cpu_sec,
       r.reads AS logical_reads,
       SUBSTRING(st.text, 1, 200) AS query_text
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) st
WHERE r.session_id > 50    -- exclude system sessions
ORDER BY r.total_elapsed_time DESC;
-- status: running, suspended (waiting for resource), sleeping
-- If a query has high elapsed_time but low cpu_time, it's WAITING (not computing)
```

> [!tip] Suspended Status
> A query with high `elapsed_time` but low `cpu_time` is not using CPU — it is WAITING for a resource (lock, disk, memory). This is the key to diagnosing whether a problem is compute-bound or I/O-bound.

---

## Kill a Stuck Session

```sql
-- Kill a stuck session (last resort)
KILL 82;
-- Terminates session 82 and rolls back any open transaction
-- ⚠️ ALWAYS check what the session is doing first (query above)
-- Killing a long-running transaction means rolling it back — which can take LONGER
```

> [!warning] Kill With Caution
> Killing a session with a long-running open transaction will roll back all of its work. The rollback may take longer than the original operation. Always check elapsed time and reads before killing.

---

## The Diagnostic Five (Run These First)

Run all five queries during any performance incident to identify the root cause quickly.

### 1. Top Waits — What Is SQL Server Waiting On?

```sql
SELECT TOP 10 wait_type, wait_time_ms / 1000 AS wait_sec, waiting_tasks_count,
    CAST(100.0 * wait_time_ms / SUM(wait_time_ms) OVER () AS DECIMAL(5,1)) AS pct
FROM sys.dm_os_wait_stats
WHERE wait_type NOT IN (
    'SLEEP_TASK','LAZYWRITER_SLEEP','WAITFOR','BROKER_RECEIVE_WAITFOR',
    'CLR_AUTO_EVENT','DISPATCHER_QUEUE_SEMAPHORE','XE_DISPATCHER_WAIT',
    'BROKER_EVENTHANDLER','SQLTRACE_BUFFER_FLUSH','HADR_FILESTREAM_IOMGR_IOCOMPLETION')
AND waiting_tasks_count > 0
ORDER BY wait_time_ms DESC;
-- INTERPRETATION:
-- PAGEIOLATCH_* = disk I/O waits (solution: faster disk, more memory, index tuning)
-- LCK_M_* = lock waits (solution: shorter transactions, better isolation levels)
-- CXPACKET = parallelism waits (often benign; check MAXDOP settings)
-- SOS_SCHEDULER_YIELD = CPU pressure (solution: more CPU or optimize queries)
-- WRITELOG = transaction log writes slow (solution: faster disk for log file)
```

### 2. Memory — Does SQL Server Have Enough?

```sql
SELECT physical_memory_kb / 1024 AS physical_mb,
       committed_kb / 1024 AS committed_mb,
       (SELECT cntr_value FROM sys.dm_os_performance_counters
        WHERE counter_name = 'Page life expectancy' AND object_name LIKE '%Buffer Manager%') AS PLE_sec
FROM sys.dm_os_sys_info;
-- PLE > 300 = healthy (pages stay in memory)
-- PLE < 60 = memory pressure (SQL Server evicting data constantly = slow queries)
```

### 3. I/O Latency — Is the Disk Fast Enough?

```sql
SELECT DB_NAME(fs.database_id) AS db, f.type_desc,
       CASE WHEN fs.num_of_reads > 0 THEN fs.io_stall_read_ms / fs.num_of_reads END AS avg_read_ms,
       CASE WHEN fs.num_of_writes > 0 THEN fs.io_stall_write_ms / fs.num_of_writes END AS avg_write_ms
FROM sys.dm_io_virtual_file_stats(NULL,NULL) fs
JOIN sys.master_files f ON fs.database_id = f.database_id AND fs.file_id = f.file_id
ORDER BY (fs.io_stall_read_ms + fs.io_stall_write_ms) DESC;
-- avg_read_ms < 5 = excellent (SSD), < 20 = acceptable (HDD), > 50 = problem
-- avg_write_ms < 5 = excellent, > 20 = log file should be on faster storage
```

### 4. Blocking — Who's Waiting for Whom?

```sql
SELECT r.session_id AS blocked, r.blocking_session_id AS blocker,
       r.wait_type, r.wait_time / 1000 AS wait_sec,
       SUBSTRING(st.text, 1, 100) AS blocked_query
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) st
WHERE r.blocking_session_id > 0;
-- If blocking chains are frequent, your transactions are holding locks too long
-- Fix: shorter transactions, RCSI (Read Committed Snapshot Isolation)
```

### 5. Deadlocks — How Many Since Restart?

```sql
SELECT cntr_value AS total_deadlocks FROM sys.dm_os_performance_counters
WHERE counter_name = 'Number of Deadlocks/sec' AND instance_name = '_Total';
-- This is a CUMULATIVE counter (resets on restart)
-- If growing: review the deadlock Extended Events trace in the SQL Server tuning guide
```

---

## System Health Dashboard (Single Query)

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

---

## Check for Heaps (Tables Without Clustered Indexes)

```sql
-- Check for heaps (tables without clustered indexes)
SELECT SCHEMA_NAME(t.schema_id) + '.' + t.name AS table_name, p.rows
FROM sys.tables t
JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id = 0
WHERE p.rows > 0
ORDER BY p.rows DESC;
-- If ANY silver/gold table appears here, fix it immediately.
```

> [!warning] Heaps Are Dangerous
> A table without a clustered index forces every query into a full table scan. In silver and gold layers, every table must have a clustered index. See [[index-types-and-strategy]] for the correct clustered key selection.

---

## Check Backup History

```sql
-- Show all backups ever taken, most recent first
SELECT
    database_name,
    type = CASE type
        WHEN 'D' THEN 'Full'
        WHEN 'I' THEN 'Differential'
        WHEN 'L' THEN 'Log'
    END,
    backup_start_date,
    backup_finish_date,
    CAST(backup_size / 1024.0 / 1024.0 AS DECIMAL(10,2)) AS size_mb
FROM msdb.dbo.backupset
WHERE database_name = 'analytics_db'
ORDER BY backup_start_date DESC;

-- Check if any SQL Agent jobs are configured for backups
SELECT j.name, j.enabled, s.freq_type, s.freq_interval,
       ja.run_date, ja.run_time
FROM msdb.dbo.sysjobs j
LEFT JOIN msdb.dbo.sysjobschedules js ON j.job_id = js.job_id
LEFT JOIN msdb.dbo.sysschedules s ON js.schedule_id = s.schedule_id
LEFT JOIN (
    SELECT job_id, MAX(run_date) AS run_date, MAX(run_time) AS run_time
    FROM msdb.dbo.sysjobhistory
    GROUP BY job_id
) ja ON j.job_id = ja.job_id;
-- If this returns nothing, there is no automated backup. Set one up.
```

> [!info] No Built-In Scheduler
> SQL Server has no built-in backup scheduler. If backups are happening, something external is doing it — a SQL Agent job, cron, or Airflow DAG.

---

## Related

- [[sqlcmd-connection-and-usage]] — running these queries from the command line
- [[wait-stats-analysis]] — deep dive into wait type interpretation
- [[blocking-and-locking]] — understanding blocking chains and lock types
- [[performance-audit-playbook]] — interpreting disk I/O latency metrics
- [[memory-and-buffer-pool]] — Page Life Expectancy and buffer pool health
- [[performance-audit-playbook]] — full structured audit using these queries
