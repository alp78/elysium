---
type: reference
category: sql-server
technology: [sql-server]
tags: [sql, sql-server, tsql, dba, tempdb, transaction-log, disk-space, index-size, sys-configurations, SERVERPROPERTY]
aliases: [DBA queries, SQL Server diagnostics, DMV queries, sys.dm_exec_sessions, sys.dm_exec_requests]
keywords: [DBA queries, DMV, dynamic management views, server version, database size, active connections, running queries, blocking chains, kill session, wait stats, page life expectancy, sys.dm_exec_sessions, sys.dm_exec_requests, sys.dm_os_wait_stats, SERVERPROPERTY, sys.databases, sys.master_files, sys.configurations, sp_spaceused, sys.dm_db_partition_stats, index sizes, transaction log, VLF, TempDB, disk free space, sys.dm_os_volume_stats]
description: "Essential T-SQL diagnostic queries for SQL Server DBAs: server version, database sizes, active connections, currently running queries, blocking chains, wait statistics, space and size analysis, transaction log health, TempDB monitoring, and disk capacity."
created: 2026-03-22
updated: 2026-03-30
status: complete
---

# Essential DBA Queries

> [!quote]
> "You can't manage what you can't measure, and you can't measure what you can't see."
>
> — **Brent Ozar**, brentozar.com

These T-SQL queries are the diagnostic toolkit for operating SQL Server in production. Keep them in a script you can run in seconds during an incident. They map to Dynamic Management Views (DMVs) — real-time system tables that expose the internals of the running SQL Server instance.

---

## Server Information

These queries answer the first questions on any incident or onboarding: what version is this server, what databases exist, how large are they, and what configuration is in effect. Run them when connecting to an unfamiliar instance or diagnosing capacity issues.

### SERVERPROPERTY() — Version, Edition, and Instance Identity

> [!info] Two Ways to Check Version
>
> `@@VERSION` returns a free-text string useful for quick checks. `SERVERPROPERTY` returns structured fields you can compare programmatically — use it when you need to branch logic by edition or build number.

```sql
SELECT @@VERSION;
```

```sql
SELECT
    SERVERPROPERTY('ProductVersion')   AS product_version,
    SERVERPROPERTY('ProductLevel')     AS product_level,
    SERVERPROPERTY('ProductUpdateLevel') AS cu_level,
    SERVERPROPERTY('Edition')          AS edition,
    SERVERPROPERTY('EngineEdition')    AS engine_edition,
    SERVERPROPERTY('Collation')        AS collation,
    SERVERPROPERTY('IsClustered')      AS is_clustered,
    SERVERPROPERTY('IsHadrEnabled')    AS is_hadr,
    SERVERPROPERTY('IsFullTextInstalled') AS is_fulltext,
    SERVERPROPERTY('ServerName')       AS server_name,
    SERVERPROPERTY('InstanceName')     AS instance_name,
    SERVERPROPERTY('ComputerNamePhysicalNetBIOS') AS physical_host;
```

> [!tip] Quick Identity Globals
>
> These globals are useful in scripts that need to log which server and session they ran on.

```sql
SELECT @@SERVERNAME AS server_name, @@SERVICENAME AS service_name,
       @@SPID AS current_spid, @@LANGUAGE AS language,
       @@MAX_CONNECTIONS AS max_connections;
```

---

### sys.databases — All Databases on the Instance

> [!abstract] What This Shows
>
> Every database on the instance with its recovery model, compatibility level, and key flags. The `log_reuse_wait_desc` column is especially important — it tells you why the transaction log cannot be truncated.

```sql
SELECT
    database_id,
    name,
    state_desc,
    recovery_model_desc,
    compatibility_level,
    collation_name,
    is_read_only,
    is_auto_shrink_on,
    is_auto_close_on,
    is_broker_enabled,
    is_cdc_enabled,
    log_reuse_wait_desc,
    create_date
FROM sys.databases
ORDER BY name;
```

---

### sys.master_files — Database File Locations and Sizes

> [!abstract] What This Shows
>
> Physical file paths, current size, max size, and growth settings for every data and log file across all databases. Use this to verify file placement (data and log on separate drives) and catch unlimited auto-growth settings.

```sql
SELECT
    d.name                          AS database_name,
    mf.file_id,
    mf.type_desc,
    mf.name                         AS logical_name,
    mf.physical_name,
    mf.state_desc,
    CAST(mf.size * 8.0 / 1024 AS DECIMAL(12,2))       AS size_mb,
    CAST(mf.max_size * 8.0 / 1024 AS DECIMAL(12,2))   AS max_size_mb,
    mf.growth,
    mf.is_percent_growth
FROM sys.master_files mf
JOIN sys.databases d ON d.database_id = mf.database_id
ORDER BY d.name, mf.file_id;
```

---

### sys.configurations — Instance Configuration Settings

> [!abstract] What This Shows
>
> Key instance-level settings that control memory allocation, parallelism, and backup behavior. Compare `value` (configured) vs `value_in_use` (active) — a mismatch means a `RECONFIGURE` or restart is pending.

```sql
EXEC sp_configure 'show advanced options', 1;
RECONFIGURE;
```

```sql
SELECT name, value, value_in_use, minimum, maximum, description, is_advanced
FROM sys.configurations
WHERE name IN (
    'max server memory (MB)',
    'min server memory (MB)',
    'max degree of parallelism',
    'cost threshold for parallelism',
    'optimize for ad hoc workloads',
    'backup compression default',
    'remote admin connections',
    'contained database authentication',
    'default trace enabled'
)
ORDER BY name;
```

---

## Space and Size

### Database Size Summary — Data vs Log Breakdown

> [!abstract] What This Shows
>
> Total allocated size per database, split into data files and log files. This is the first query to run when investigating capacity — it tells you whether data or log growth is consuming space.

```sql
SELECT
    d.name                                                          AS database_name,
    SUM(CASE WHEN mf.type = 0 THEN mf.size END) * 8.0 / 1024      AS data_size_mb,
    SUM(CASE WHEN mf.type = 1 THEN mf.size END) * 8.0 / 1024      AS log_size_mb,
    SUM(mf.size) * 8.0 / 1024                                      AS total_size_mb
FROM sys.databases d
JOIN sys.master_files mf ON d.database_id = mf.database_id
GROUP BY d.name
ORDER BY total_size_mb DESC;
```

---

### Table Sizes — Current Database

Two approaches: `sp_spaceused` for a quick single-table check, or the DMV query for a ranked view of all tables.

#### sp_spaceused — Quick Single-Table Size Check

```sql
EXEC sp_spaceused 'dbo.trades';
```

```sql
EXEC sp_spaceused;
```

#### sys.allocation_units — All Tables Ranked by Size

```sql
SELECT
    s.name                                              AS schema_name,
    t.name                                              AS table_name,
    SUM(a.total_pages)  * 8.0 / 1024                   AS total_mb,
    SUM(a.used_pages)   * 8.0 / 1024                   AS used_mb,
    SUM(a.data_pages)   * 8.0 / 1024                   AS data_mb,
    SUM(p.rows)                                         AS row_count
FROM sys.tables t
JOIN sys.schemas s          ON t.schema_id = s.schema_id
JOIN sys.indexes i          ON t.object_id = i.object_id AND i.index_id IN (0,1)
JOIN sys.partitions p       ON i.object_id = p.object_id AND i.index_id = p.index_id
JOIN sys.allocation_units a ON p.partition_id = a.container_id
GROUP BY s.name, t.name
ORDER BY total_mb DESC;
```

---

### dm_db_partition_stats — Fast Row Counts Without Scanning

Faster than `COUNT(*)` — reads metadata instead of scanning data.

```sql
SELECT
    OBJECT_SCHEMA_NAME(object_id)   AS schema_name,
    OBJECT_NAME(object_id)          AS table_name,
    SUM(row_count)                  AS total_rows
FROM sys.dm_db_partition_stats
WHERE index_id IN (0, 1)
GROUP BY object_id
ORDER BY total_rows DESC;
```

---

### Index Sizes — Space Consumed per Index

> [!abstract] What This Shows
>
> Total and used space for every index on every table. Use this to find oversized indexes that waste disk and slow down writes.

```sql
SELECT
    OBJECT_SCHEMA_NAME(i.object_id)             AS schema_name,
    OBJECT_NAME(i.object_id)                    AS table_name,
    i.name                                      AS index_name,
    i.type_desc,
    SUM(a.total_pages) * 8.0 / 1024            AS total_mb,
    SUM(a.used_pages)  * 8.0 / 1024            AS used_mb
FROM sys.indexes i
JOIN sys.partitions p       ON i.object_id = p.object_id AND i.index_id = p.index_id
JOIN sys.allocation_units a ON p.partition_id = a.container_id
GROUP BY i.object_id, i.name, i.type_desc
ORDER BY total_mb DESC;
```

---

### Transaction Log Space Usage — Log Size and VLF Health

> [!warning] High VLF Count Means Fragmented Log
>
> A high VLF (Virtual Log File) count means the transaction log has been grown in many small increments instead of pre-sized. This fragments the log and slows backup/restore operations. If `DBCC LOGINFO` returns hundreds of rows, consider shrinking and pre-sizing the log file. The `log_reuse_wait_desc` column explains why the log can't be truncated — common values: `ACTIVE_TRANSACTION` (long-running query), `LOG_BACKUP` (no log backup taken), `REPLICATION` (replication agent behind).

```sql
DBCC SQLPERF(LOGSPACE);
```

```sql
SELECT name, log_reuse_wait_desc
FROM sys.databases
ORDER BY name;
```

```sql
DBCC LOGINFO;
```

---

### TempDB Usage — Space Consumed per Session

> [!warning] TempDB Is a Shared Bottleneck
>
> TempDB is shared by all sessions. A single query spilling to TempDB (hash joins, sorts exceeding memory grant) can fill TempDB and block every other query on the server. Monitor TempDB space during large ETL runs. If TempDB runs out of space, SQL Server returns error 1105 and the offending query fails — but other sessions may also fail if they need TempDB space at that moment.

#### dm_db_session_space_usage — TempDB Allocation per Session

```sql
SELECT
    s.session_id,
    s.login_name,
    s.program_name,
    t.user_objects_alloc_page_count   * 8.0 / 1024 AS user_obj_mb,
    t.internal_objects_alloc_page_count * 8.0 / 1024 AS internal_obj_mb,
    t.user_objects_alloc_page_count + t.internal_objects_alloc_page_count AS total_pages
FROM sys.dm_db_session_space_usage t
JOIN sys.dm_exec_sessions s ON t.session_id = s.session_id
WHERE t.user_objects_alloc_page_count + t.internal_objects_alloc_page_count > 0
ORDER BY total_pages DESC;
```

#### TempDB File Sizes and Free Space

```sql
USE tempdb;
SELECT
    name,
    file_id,
    CAST(size * 8.0 / 1024 AS DECIMAL(10,2))                        AS size_mb,
    CAST(FILEPROPERTY(name, 'SpaceUsed') * 8.0 / 1024 AS DECIMAL(10,2)) AS used_mb,
    CAST((size - FILEPROPERTY(name, 'SpaceUsed')) * 8.0 / 1024 AS DECIMAL(10,2)) AS free_mb
FROM sys.database_files;
```

---

### dm_os_volume_stats — Disk Free Space per Volume

> [!danger] Full Disk Halts the Pipeline
>
> SQL Server stops accepting writes when the disk is full. The database goes read-only, transactions fail, and the pipeline halts. Monitor disk free space proactively — see [sql-server-disk-full](https://alp78.github.io/elysium/15-Runbooks/sql-server-disk-full) for the full runbook. As a rule of thumb, alert at 85% used, investigate at 90%, and treat 95% as a P1 incident.

```sql
SELECT DISTINCT
    vs.volume_mount_point,
    vs.logical_volume_name,
    CAST(vs.total_bytes / 1073741824.0 AS DECIMAL(10,2))     AS total_gb,
    CAST(vs.available_bytes / 1073741824.0 AS DECIMAL(10,2)) AS free_gb,
    CAST(100.0 * vs.available_bytes / vs.total_bytes AS DECIMAL(5,2)) AS pct_free
FROM sys.master_files mf
CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.file_id) vs
ORDER BY vs.volume_mount_point;
```

---

### Active Connections

```sql
-- Active connections (who's connected right now?)
SELECT login_name, program_name, COUNT(*) AS connections
FROM sys.dm_exec_sessions
WHERE is_user_process = 1
GROUP BY login_name, program_name
ORDER BY connections DESC;
```

> [!tip] Connection Spikes Signal Trouble
>
> `program_name` identifies the application: Python, Microsoft JDBC, .Net SqlClient, etc. A sudden spike in connections often precedes performance problems — check for connection leaks or runaway retry loops.

---

### Currently Running Queries

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
```

> [!tip] Suspended Status
>
> A query with high `elapsed_time` but low `cpu_time` is not using CPU — it is WAITING for a resource (lock, disk, memory). This is the key to diagnosing whether a problem is compute-bound or I/O-bound.

---

### Kill a Stuck Session

```sql
-- Kill a stuck session (last resort)
KILL 82;
```

> [!danger] Rollback Can Take Longer Than the Original Query
>
> Killing a session with an open transaction triggers a ROLLBACK — which can take longer than letting the query finish. A 2-hour INSERT that's 90% done will take ~1.8 hours to roll back. Always check what the session is doing first with the Running Queries query above.

---

## The Diagnostic Five (Run These First)

Run all five queries during any performance incident to identify the root cause quickly.

### Top Waits — What Is SQL Server Waiting On?

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
```

> [!info] Common Wait Types
>
> | Wait type | Meaning | Fix |
> |---|---|---|
> | `PAGEIOLATCH_*` | Disk I/O waits | Faster disk, more memory, index tuning |
> | `LCK_M_*` | Lock waits | Shorter transactions, RCSI |
> | `CXPACKET` | Parallelism waits | Often benign — check MAXDOP settings |
> | `SOS_SCHEDULER_YIELD` | CPU pressure | More CPU or optimize queries |
> | `WRITELOG` | Transaction log writes slow | Faster disk for log file |

### Memory — Does SQL Server Have Enough?

```sql
SELECT physical_memory_kb / 1024 AS physical_mb,
       committed_kb / 1024 AS committed_mb,
       (SELECT cntr_value FROM sys.dm_os_performance_counters
        WHERE counter_name = 'Page life expectancy' AND object_name LIKE '%Buffer Manager%') AS PLE_sec
FROM sys.dm_os_sys_info;
```

> [!info] Page Life Expectancy Thresholds
>
> PLE > 300 = healthy (pages stay in memory). PLE < 60 = memory pressure — SQL Server is evicting data pages constantly, which means every query pays the cost of reading from disk.

### I/O Latency — Is the Disk Fast Enough?

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

### Blocking — Who's Waiting for Whom?

```sql
SELECT r.session_id AS blocked, r.blocking_session_id AS blocker,
       r.wait_type, r.wait_time / 1000 AS wait_sec,
       SUBSTRING(st.text, 1, 100) AS blocked_query
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) st
WHERE r.blocking_session_id > 0;
```

> [!tip] Frequent Blocking Means Long Transactions
>
> If blocking chains appear regularly, your transactions are holding locks too long. Fix: shorter transactions and RCSI (Read Committed Snapshot Isolation), which lets readers proceed without waiting for writers.

### Deadlocks — How Many Since Restart?

```sql
SELECT cntr_value AS total_deadlocks FROM sys.dm_os_performance_counters
WHERE counter_name = 'Number of Deadlocks/sec' AND instance_name = '_Total';
```

> [!info] Cumulative Counter
>
> This counter is cumulative and resets on SQL Server restart. If the value is growing between checks, review the deadlock Extended Events trace to identify the competing queries.

---

### System Health Dashboard (Single Query)

Combines CPU, memory, I/O, and connection counts into a single row for a quick health snapshot.

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

---

### Check for Heaps (Tables Without Clustered Indexes)

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
>
> A table without a clustered index forces every query into a full table scan. In silver and gold layers, every table must have a clustered index. See [index-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/index-types-and-strategy) for the correct clustered key selection.

---

### Check Backup History

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
>
> SQL Server has no built-in backup scheduler. If backups are happening, something external is doing it — a SQL Agent job, cron, or Airflow DAG.

---

### Related

- [sqlcmd-connection-and-usage](https://alp78.github.io/elysium/04-SQL-Server/Administration/sqlcmd-connection-and-usage) — running these queries from the command line
- [wait-stats-analysis](https://alp78.github.io/elysium/04-SQL-Server/Performance/wait-stats-analysis) — deep dive into wait type interpretation
- [blocking-and-locking](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/blocking-and-locking) — understanding blocking chains and lock types
- [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/Performance/performance-audit-playbook) — interpreting disk I/O latency metrics and full structured audit
- [memory-and-buffer-pool](https://alp78.github.io/elysium/04-SQL-Server/Performance/memory-and-buffer-pool) — Page Life Expectancy and buffer pool health
- [sql-server-disk-full](https://alp78.github.io/elysium/15-Runbooks/sql-server-disk-full) — runbook for disk capacity incidents
- [index-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/index-types-and-strategy) — clustered key selection and index design
