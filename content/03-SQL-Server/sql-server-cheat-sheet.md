---
type: reference
category: reference
technology: [sql-server]
tags: [reference, cheat-sheet, sql-server, t-sql]
aliases: [SQL Server cheat sheet, T-SQL quick reference, sqlcmd cheat sheet]
keywords: [sql server, cheat sheet, quick reference, sqlcmd, bcp, backup, restore, performance, blocking, deadlock, index, wait stats, memory, security, concurrency, dbcc]
description: "Exhaustive SQL Server CLI and T-SQL reference — sqlcmd, bcp, server info, space/size, active sessions, wait stats, memory, indexes, backup/restore, configuration, security, concurrency, and DBCC commands."
related:
  - "[[sqlcmd-connection-and-usage]]"
  - "[[essential-dba-queries]]"
  - "[[backup-types-and-strategy]]"
  - "[[restore-and-recovery]]"
  - "[[wait-stats-analysis]]"
  - "[[index-maintenance]]"
  - "[[memory-and-buffer-pool]]"
  - "[[performance-audit-playbook]]"
  - "[[index-types-and-strategy]]"
created: 2026-03-22
updated: 2026-03-23
status: stable
---

# SQL Server Cheat Sheet

The one page a DE/DBA bookmarks. Every section has copy-paste-ready queries. Financial domain context throughout (tables like `trades`, `positions`, `market_data`, `audit_log`).

---

## sqlcmd CLI

### Full Anatomy

```bash
sqlcmd -S server\instance -U sa -P 'P@ssw0rd' -d FinanceDB \
       -Q "SELECT @@VERSION" \
       -i /scripts/deploy.sql \
       -o /logs/deploy_output.txt \
       -s "," -w 300 -W -b
```

### All Flags Reference

| Flag | Long purpose | Example |
|------|-------------|---------|
| `-S` | Server/instance. Accepts `host`, `host,port`, `host\instance`, `tcp:host,port` | `-S prod-sql01,1433` |
| `-U` | SQL Server login username | `-U sa` |
| `-P` | Password (prefer env var `SQLCMDPASSWORD`) | `-P 'P@ss!'` |
| `-d` | Default database on connect | `-d FinanceDB` |
| `-Q` | Execute query then exit | `-Q "SELECT @@VERSION"` |
| `-q` | Execute query, stay in interactive mode | `-q "SELECT TOP 10 * FROM trades"` |
| `-i` | Input SQL script file | `-i /scripts/etl.sql` |
| `-o` | Output file for results | `-o /logs/results.txt` |
| `-s` | Column separator (default: space) | `-s ","` |
| `-w` | Screen width for output (1–65535) | `-w 300` |
| `-h` | Header rows interval; -1 = no headers | `-h -1` |
| `-W` | Remove trailing spaces from columns | `-W` |
| `-C` | Trust server certificate (bypass TLS validation) | `-C` |
| `-N` | Encrypt connection | `-N` |
| `-l` | Login timeout in seconds (default 8) | `-l 30` |
| `-t` | Query timeout in seconds | `-t 120` |
| `-b` | Exit with error code on SQL error | `-b` |
| `-e` | Echo input scripts to stdout | `-e` |
| `-m` | Error message level (0–24) | `-m 1` |
| `-v` | Scripting variables `name=value` | `-v env=prod` |
| `-r` | Redirect error messages to stderr (0 or 1) | `-r 1` |
| `-E` | Use Windows/AD (trusted) authentication | `-E` |
| `-A` | Connect via Dedicated Admin Connection (DAC) | `-A` |
| `-X` | Disable system commands (`!!`, `ED`, `QUIT`) | `-X` |
| `-k` | Strip/replace control characters in output | `-k 1` |
| `-y` | Variable-length column display width | `-y 0` |
| `-Y` | Fixed-length column display width | `-Y 30` |

### Common Patterns

```bash
# Windows auth
sqlcmd -S localhost -E -d FinanceDB -Q "SELECT DB_NAME()"

# IAP/SSH tunnel (forward 1433 → localhost:14330)
sqlcmd -S localhost,14330 -U sa -P "$SQLCMDPASSWORD" -d FinanceDB -C -b

# Run script, output CSV, suppress headers
sqlcmd -S prod-sql01 -E -d FinanceDB \
       -Q "SET NOCOUNT ON; SELECT trade_id, symbol, amount FROM trades WHERE settle_date = CAST(GETDATE() AS DATE)" \
       -s "," -h -1 -W \
       -o /data/trades_today.csv

# Run a file and exit on error
sqlcmd -S prod-sql01 -E -d FinanceDB -i /deploy/v2.5.sql -b -o /logs/v2.5.log

# Pass scripting variables
sqlcmd -S prod-sql01 -E -d FinanceDB \
       -v Schema=dbo TableName=trades \
       -i /scripts/reindex_table.sql

# Use inside script: $(MyVar)
# Inside .sql:  SELECT * FROM $(Schema).$(TableName)

# sqlcmd exit codes
# 0 = success, 1 = failure, -100 = error before exit value selection
```

---

## bcp CLI

### Full Anatomy

```bash
# Export table to flat file
bcp FinanceDB.dbo.trades out /data/trades.dat \
    -S prod-sql01 -T -c -t "," -r "\n"

# Import flat file into table
bcp FinanceDB.dbo.trades in /data/trades.dat \
    -S prod-sql01 -T -c -t "," -r "\n" -b 5000 -e /logs/bcp_errors.log

# Export query result
bcp "SELECT trade_id, symbol, notional FROM FinanceDB.dbo.trades WHERE trade_date = '2026-01-01'" \
    queryout /data/trades_20260101.csv \
    -S prod-sql01 -T -c -t ","
```

### All Flags Reference

| Flag | Purpose | Example |
|------|---------|---------|
| `-S` | Server name or DSN | `-S prod-sql01` |
| `-d` | Database name | `-d FinanceDB` |
| `-U` | Username (SQL auth) | `-U sa` |
| `-P` | Password | `-P 'P@ss!'` |
| `-T` | Trusted (Windows) auth | `-T` |
| `-c` | Character mode (text, recommended for portability) | `-c` |
| `-n` | Native SQL Server data types | `-n` |
| `-N` | Unicode chars, native for non-char types | `-N` |
| `-w` | Unicode character mode | `-w` |
| `-t` | Field terminator | `-t ","` |
| `-r` | Row terminator | `-r "\n"` |
| `-F` | First row to import/export (1-based) | `-F 2` |
| `-L` | Last row to import/export | `-L 1000` |
| `-b` | Batch size (rows per transaction) | `-b 10000` |
| `-e` | Error file path | `-e /logs/err.log` |
| `-m` | Max errors before abort | `-m 10` |
| `-f` | Format file path | `-f /fmt/trades.fmt` |
| `-x` | Generate XML format file (with `-f`) | `-x` |
| `-q` | Quoted identifiers for table/view names | `-q` |
| `-k` | Keep NULL values instead of defaults | `-k` |
| `-E` | Keep identity values from data file | `-E` |
| `-h` | Hints: `TABLOCK`, `ORDER(col)`, `ROWS_PER_BATCH=N` | `-h "TABLOCK"` |
| `-a` | Packet size (512–65535 bytes) | `-a 65535` |
| `-l` | Login timeout | `-l 30` |

### Format File Generation

```bash
# Generate non-XML format file
bcp FinanceDB.dbo.trades format nul -S prod-sql01 -T -c -t "," -f /fmt/trades.fmt

# Generate XML format file
bcp FinanceDB.dbo.trades format nul -S prod-sql01 -T -c -t "," -f /fmt/trades.xml -x
```

---

## Server Information

### Version and Edition

```sql
-- Full version string
SELECT @@VERSION;

-- Structured version info
SELECT
    SERVERPROPERTY('ProductVersion')   AS product_version,   -- e.g. 16.0.4003.1
    SERVERPROPERTY('ProductLevel')     AS product_level,     -- RTM, SP1, CU14...
    SERVERPROPERTY('ProductUpdateLevel') AS cu_level,
    SERVERPROPERTY('Edition')          AS edition,           -- Enterprise, Developer...
    SERVERPROPERTY('EngineEdition')    AS engine_edition,    -- 3=Enterprise, 4=Express...
    SERVERPROPERTY('Collation')        AS collation,
    SERVERPROPERTY('IsClustered')      AS is_clustered,
    SERVERPROPERTY('IsHadrEnabled')    AS is_hadr,
    SERVERPROPERTY('IsFullTextInstalled') AS is_fulltext,
    SERVERPROPERTY('ServerName')       AS server_name,
    SERVERPROPERTY('InstanceName')     AS instance_name,
    SERVERPROPERTY('ComputerNamePhysicalNetBIOS') AS physical_host;

-- Quick identity globals
SELECT @@SERVERNAME AS server_name, @@SERVICENAME AS service_name,
       @@SPID AS current_spid, @@LANGUAGE AS language,
       @@MAX_CONNECTIONS AS max_connections;
```

### All Databases

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

### Database Files

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

### Instance Configuration

```sql
-- All sp_configure options
EXEC sp_configure 'show advanced options', 1;
RECONFIGURE;
EXEC sp_configure;

-- Key settings only
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

### Database Size Summary

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

### Table Sizes — Current Database

```sql
-- sp_spaceused per table
EXEC sp_spaceused 'dbo.trades';      -- single table
EXEC sp_spaceused;                   -- whole database

-- All tables ranked by total size
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

### Row Counts via Partition Stats (Fast)

```sql
SELECT
    OBJECT_SCHEMA_NAME(object_id)   AS schema_name,
    OBJECT_NAME(object_id)          AS table_name,
    SUM(row_count)                  AS total_rows
FROM sys.dm_db_partition_stats
WHERE index_id IN (0, 1)          -- heap or clustered
GROUP BY object_id
ORDER BY total_rows DESC;
```

### Index Sizes

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

### Transaction Log Space Usage

```sql
-- Current log space for all databases
DBCC SQLPERF(LOGSPACE);

-- Log reuse wait reason (why log can't be truncated)
SELECT name, log_reuse_wait_desc FROM sys.databases ORDER BY name;

-- Log VLF count (high VLF count = log fragmented)
-- Run in the target database context
DBCC LOGINFO;
```

### TempDB Usage

```sql
-- TempDB space by session
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

-- TempDB file sizes and free space
USE tempdb;
SELECT
    name,
    file_id,
    CAST(size * 8.0 / 1024 AS DECIMAL(10,2))                        AS size_mb,
    CAST(FILEPROPERTY(name, 'SpaceUsed') * 8.0 / 1024 AS DECIMAL(10,2)) AS used_mb,
    CAST((size - FILEPROPERTY(name, 'SpaceUsed')) * 8.0 / 1024 AS DECIMAL(10,2)) AS free_mb
FROM sys.database_files;
USE FinanceDB;
```

### Disk Free Space (Volume Stats)

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

## Active Sessions and Blocking

### Full Running Requests

```sql
SELECT
    r.session_id,
    r.status,                        -- running, suspended, sleeping, background
    r.blocking_session_id,
    r.wait_type,
    r.wait_time / 1000.0             AS wait_sec,
    r.total_elapsed_time / 1000.0    AS elapsed_sec,
    r.cpu_time / 1000.0              AS cpu_sec,
    r.logical_reads,
    r.writes,
    r.granted_query_memory / 128.0   AS granted_mem_mb,
    r.dop,
    r.row_count,
    r.percent_complete,
    r.estimated_completion_time / 1000.0 AS est_completion_sec,
    r.command,
    r.database_id,
    DB_NAME(r.database_id)           AS database_name,
    r.open_transaction_count,
    r.transaction_isolation_level,
    CASE r.transaction_isolation_level
        WHEN 0 THEN 'Unspecified'
        WHEN 1 THEN 'ReadUncommitted'
        WHEN 2 THEN 'ReadCommitted'
        WHEN 3 THEN 'Repeatable'
        WHEN 4 THEN 'Serializable'
        WHEN 5 THEN 'Snapshot'
        ELSE 'Unknown'
    END                              AS isolation_level_name,
    t.text                           AS sql_text,
    SUBSTRING(t.text,
        (r.statement_start_offset/2) + 1,
        ((CASE r.statement_end_offset WHEN -1 THEN DATALENGTH(t.text)
          ELSE r.statement_end_offset END - r.statement_start_offset)/2) + 1
    )                                AS current_statement,
    qp.query_plan
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle)    t
CROSS APPLY sys.dm_exec_query_plan(r.plan_handle) qp
WHERE r.session_id > 50
  AND r.session_id <> @@SPID
ORDER BY r.total_elapsed_time DESC;
```

### Session Details

```sql
SELECT
    s.session_id,
    s.login_name,
    s.host_name,
    s.program_name,
    s.status,
    s.cpu_time,
    s.memory_usage * 8              AS memory_kb,
    s.total_elapsed_time / 1000.0   AS elapsed_sec,
    s.last_request_start_time,
    s.last_request_end_time,
    s.reads,
    s.writes,
    s.logical_reads,
    s.open_transaction_count,
    s.transaction_isolation_level,
    s.deadlock_priority,
    s.row_count,
    s.database_id,
    DB_NAME(s.database_id)          AS database_name,
    s.client_interface_name,
    s.auth_scheme,
    s.is_user_process
FROM sys.dm_exec_sessions s
WHERE s.is_user_process = 1
ORDER BY s.cpu_time DESC;
```

### Blocking Chain (Recursive CTE)

```sql
WITH blocking_chain AS (
    -- Anchor: sessions that are blocking but not themselves blocked
    SELECT
        r.session_id,
        r.blocking_session_id,
        r.wait_type,
        r.wait_time / 1000.0         AS wait_sec,
        r.status,
        t.text                        AS sql_text,
        CAST(0 AS INT)                AS depth,
        CAST(r.session_id AS VARCHAR(1000)) AS chain
    FROM sys.dm_exec_requests r
    CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
    WHERE r.blocking_session_id = 0
      AND r.session_id IN (
          SELECT blocking_session_id FROM sys.dm_exec_requests
          WHERE blocking_session_id > 0
      )

    UNION ALL

    -- Recursive: blocked sessions
    SELECT
        r.session_id,
        r.blocking_session_id,
        r.wait_type,
        r.wait_time / 1000.0,
        r.status,
        t.text,
        bc.depth + 1,
        CAST(bc.chain + ' -> ' + CAST(r.session_id AS VARCHAR(10)) AS VARCHAR(1000))
    FROM sys.dm_exec_requests r
    CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
    JOIN blocking_chain bc ON bc.session_id = r.blocking_session_id
)
SELECT
    REPLICATE('  ', depth) + CAST(session_id AS VARCHAR) AS session_tree,
    blocking_session_id,
    wait_type,
    wait_sec,
    status,
    chain,
    LEFT(sql_text, 200)     AS sql_text_snippet
FROM blocking_chain
ORDER BY chain;
```

### Kill a Session

```sql
-- Identify before killing
SELECT session_id, login_name, host_name, program_name, status
FROM sys.dm_exec_sessions WHERE session_id = 72;

KILL 72;            -- kill session
KILL 72 WITH STATUSONLY;  -- check progress of KILL (rollback %)
```

---

## Wait Stats

### Top Waits — Excluding Idle

```sql
-- Baseline: top 20 waits, excluding benign idle waits
SELECT TOP 20
    wait_type,
    wait_time_ms / 1000.0                           AS wait_sec,
    (wait_time_ms - signal_wait_time_ms) / 1000.0   AS resource_wait_sec,
    signal_wait_time_ms / 1000.0                    AS signal_wait_sec,
    waiting_tasks_count,
    CASE WHEN waiting_tasks_count = 0 THEN 0
         ELSE wait_time_ms / waiting_tasks_count
    END                                             AS avg_wait_ms,
    100.0 * wait_time_ms / SUM(wait_time_ms) OVER() AS pct_total
FROM sys.dm_os_wait_stats
WHERE wait_type NOT IN (
    -- Idle / benign waits to exclude
    'SLEEP_TASK', 'SLEEP_SYSTEMTASK', 'SLEEP_DBSTARTUP', 'SLEEP_DBTASK',
    'SLEEP_TEMPDBSTARTUP', 'SLEEP_MASTERDBREADY', 'SLEEP_MASTERMDREADY',
    'SLEEP_MASTERUPGRADED', 'SLEEP_MSDBSTARTUP', 'SLEEP_BUFFERPOOL_HELPLW',
    'SLEEP_COMMTARGET', 'SLEEP_WORKER',
    'LAZYWRITER_SLEEP', 'LOGMGR_QUEUE', 'ONDEMAND_TASK_QUEUE',
    'REQUEST_FOR_DEADLOCK_SEARCH', 'RESOURCE_QUEUE', 'SERVER_IDLE_CHECK',
    'HADR_FILESTREAM_IOMGR_IOCOMPLETION', 'HADR_WORK_QUEUE',
    'BROKER_TO_FLUSH', 'BROKER_TASK_STOP', 'BROKER_EVENTHANDLER',
    'BROKER_TRANSMITTER', 'BROKER_RECEIVE_WAITFOR', 'BROKER_SERVICE_NAME',
    'CHECKPOINT_QUEUE', 'DBMIRROR_EVENTS_QUEUE', 'SQLTRACE_INCREMENTAL_FLUSH_SLEEP',
    'WAIT_XTP_OFFLINE_CKPT_NEW_LOG', 'XE_TIMER_EVENT', 'XE_DISPATCHER_WAIT',
    'DISPATCHER_QUEUE_SEMAPHORE', 'SQLTRACE_BUFFER_FLUSH',
    'CLR_AUTO_EVENT', 'CLR_MANUAL_EVENT', 'CLR_SEMAPHORE',
    'DBMIRROR_WORKER_QUEUE', 'WAITFOR', 'WAIT_XTP_HOST_WAIT',
    'REDO_THREAD_PENDING_WORK', 'DIRTY_PAGE_POLL',
    'HADR_CLUSAPI_CALL', 'HADR_FILESTREAM_IOMGR_IOCOMPLETION',
    'HADR_LOGCAPTURE_WAIT', 'HADR_NOTIFICATION_DEQUEUE', 'HADR_TIMER_TASK',
    'HADR_TRANSPORT_DBRLIST', 'HADR_WORK_POOL',
    'FT_IFTS_SCHEDULER_IDLE_WAIT', 'FT_IFTSHC_MUTEX',
    'SNI_HTTP_ACCEPT', 'SP_SERVER_DIAGNOSTICS_SLEEP',
    'SQLTRACE_WAIT_ENTRIES', 'WAIT_DONE',
    'DBMIRRORING_CMD', 'PREEMPTIVE_OS_WAITFORSINGLEOBJECT'
)
ORDER BY wait_time_ms DESC;
```

### Per-Query Wait Stats

```sql
-- Wait stats for currently executing requests
SELECT
    r.session_id,
    r.wait_type,
    r.wait_time / 1000.0    AS wait_sec,
    r.last_wait_type,
    t.text                  AS sql_text
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
WHERE r.session_id > 50
  AND r.wait_type IS NOT NULL
ORDER BY r.wait_time DESC;
```

### Reset Wait Stats Baseline

```sql
-- WARNING: clears cumulative wait stats — do after baselining
DBCC SQLPERF('sys.dm_os_wait_stats', CLEAR);
```

### Common Wait Types — Quick Reference

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

---

## Memory and Buffer Pool

### Page Life Expectancy (PLE)

```sql
-- PLE per NUMA node (target: >= 300 for 4 GB buffer pool baseline; scale linearly)
SELECT
    object_name,
    counter_name,
    instance_name,
    cntr_value                  AS ple_seconds
FROM sys.dm_os_performance_counters
WHERE counter_name = 'Page life expectancy'
  AND object_name LIKE '%Buffer%'
ORDER BY object_name;
```

### Buffer Pool Usage by Database

```sql
SELECT
    DB_NAME(bd.database_id)                             AS database_name,
    COUNT(*) * 8.0 / 1024                              AS buffer_pool_mb,
    SUM(CAST(bd.is_modified AS INT)) * 8.0 / 1024      AS dirty_pages_mb,
    COUNT(*) - SUM(CAST(bd.is_modified AS INT))        AS clean_pages
FROM sys.dm_os_buffer_descriptors bd
WHERE bd.database_id <> 32767   -- exclude resource DB
GROUP BY bd.database_id
ORDER BY buffer_pool_mb DESC;
```

### Memory Clerks (Top Consumers)

```sql
SELECT TOP 20
    type,
    name,
    SUM(pages_kb) / 1024.0      AS pages_mb,
    SUM(virtual_memory_reserved_kb) / 1024.0 AS vm_reserved_mb,
    SUM(virtual_memory_committed_kb) / 1024.0 AS vm_committed_mb
FROM sys.dm_os_memory_clerks
GROUP BY type, name
ORDER BY pages_mb DESC;
```

### Plan Cache Stats

```sql
-- Overall cache by object type
SELECT
    objtype         AS plan_type,
    COUNT(*)        AS plan_count,
    SUM(size_in_bytes) / 1048576.0  AS cache_mb,
    SUM(usecounts)  AS total_use_count,
    AVG(usecounts)  AS avg_use_count
FROM sys.dm_exec_cached_plans
GROUP BY objtype
ORDER BY cache_mb DESC;

-- Single-use plans wasting memory (optimize for ad hoc workloads target)
SELECT
    COUNT(*)                        AS single_use_plans,
    SUM(size_in_bytes) / 1048576.0  AS wasted_mb
FROM sys.dm_exec_cached_plans
WHERE usecounts = 1
  AND objtype = 'Adhoc';

-- Top 20 most expensive cached plans by total logical reads
SELECT TOP 20
    total_logical_reads / execution_count   AS avg_logical_reads,
    total_logical_reads,
    execution_count,
    total_elapsed_time / execution_count / 1000.0 AS avg_elapsed_ms,
    total_elapsed_time / 1000.0             AS total_elapsed_ms,
    t.text                                  AS sql_text,
    qp.query_plan
FROM sys.dm_exec_cached_plans cp
CROSS APPLY sys.dm_exec_sql_text(cp.plan_handle)  t
CROSS APPLY sys.dm_exec_query_plan(cp.plan_handle) qp
WHERE cp.objtype IN ('Proc', 'Adhoc', 'Prepared')
ORDER BY total_logical_reads DESC;
```

### Memory Management Commands

```sql
-- Flush plan cache (ALL databases — use with caution on production)
DBCC FREEPROCCACHE;

-- Flush plan cache for a specific plan handle
DBCC FREEPROCCACHE(<plan_handle>);

-- Flush plan cache for a specific SQL handle
DBCC FLUSHPROCINDB(<database_id>);

-- Drop clean buffer pool pages (use in dev/test only — causes cold cache on prod)
DBCC DROPCLEANBUFFERS;

-- Check max server memory
SELECT name, value_in_use FROM sys.configurations
WHERE name = 'max server memory (MB)';

-- Set max server memory (leave ~10-15% for OS)
EXEC sp_configure 'max server memory (MB)', 28672;  -- 28 GB on 32 GB server
RECONFIGURE;
```

---

## Index Operations

### Index Metadata

```sql
-- All indexes for a table
SELECT
    i.index_id,
    i.name              AS index_name,
    i.type_desc,
    i.is_unique,
    i.is_primary_key,
    i.is_unique_constraint,
    i.fill_factor,
    i.is_disabled,
    i.allow_page_locks,
    i.allow_row_locks,
    i.has_filter,
    i.filter_definition,
    STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal)
        FILTER (WHERE ic.is_included_column = 0)  AS key_columns,
    STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal)
        FILTER (WHERE ic.is_included_column = 1)  AS included_columns
FROM sys.indexes i
JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
JOIN sys.columns c        ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE i.object_id = OBJECT_ID('dbo.trades')
GROUP BY i.index_id, i.name, i.type_desc, i.is_unique, i.is_primary_key,
         i.is_unique_constraint, i.fill_factor, i.is_disabled,
         i.allow_page_locks, i.allow_row_locks, i.has_filter, i.filter_definition
ORDER BY i.index_id;
```

### Index Usage Stats (Since Last Restart)

```sql
SELECT
    OBJECT_SCHEMA_NAME(ius.object_id)   AS schema_name,
    OBJECT_NAME(ius.object_id)          AS table_name,
    i.name                              AS index_name,
    i.type_desc,
    ius.user_seeks,
    ius.user_scans,
    ius.user_lookups,
    ius.user_updates,
    ius.user_seeks + ius.user_scans + ius.user_lookups AS total_reads,
    ius.last_user_seek,
    ius.last_user_scan,
    ius.last_user_update
FROM sys.dm_db_index_usage_stats ius
JOIN sys.indexes i ON ius.object_id = i.object_id AND ius.index_id = i.index_id
WHERE ius.database_id = DB_ID()
ORDER BY total_reads DESC;

-- Unused indexes (never read, but updated on every DML — pure overhead)
SELECT
    OBJECT_SCHEMA_NAME(ius.object_id)   AS schema_name,
    OBJECT_NAME(ius.object_id)          AS table_name,
    i.name                              AS index_name,
    ius.user_seeks, ius.user_scans, ius.user_lookups,
    ius.user_updates                    AS writes_maintaining_index
FROM sys.dm_db_index_usage_stats ius
JOIN sys.indexes i ON ius.object_id = i.object_id AND ius.index_id = i.index_id
WHERE ius.database_id = DB_ID()
  AND ius.user_seeks = 0
  AND ius.user_scans = 0
  AND ius.user_lookups = 0
  AND i.type_desc <> 'HEAP'
  AND i.is_primary_key = 0
  AND i.is_unique = 0
ORDER BY ius.user_updates DESC;
```

### Index Fragmentation

```sql
-- LIMITED mode is fast (reads only page header); SAMPLED/DETAILED are slower
SELECT
    OBJECT_SCHEMA_NAME(ips.object_id)       AS schema_name,
    OBJECT_NAME(ips.object_id)              AS table_name,
    i.name                                  AS index_name,
    ips.index_id,
    ips.index_type_desc,
    ips.partition_number,
    ips.alloc_unit_type_desc,
    ips.index_depth,
    ips.index_level,
    ips.page_count,
    ips.avg_fragmentation_in_percent,
    ips.avg_page_space_used_in_percent,
    ips.record_count,
    ips.avg_record_size_in_bytes,
    CASE
        WHEN ips.avg_fragmentation_in_percent < 5    THEN 'OK'
        WHEN ips.avg_fragmentation_in_percent < 30   THEN 'REORGANIZE'
        ELSE                                              'REBUILD'
    END AS recommended_action
FROM sys.dm_db_index_physical_stats(
    DB_ID(),    -- database_id  (NULL = all databases)
    NULL,       -- object_id    (NULL = all tables)
    NULL,       -- index_id     (NULL = all indexes)
    NULL,       -- partition_number (NULL = all)
    'LIMITED'   -- mode: LIMITED | SAMPLED | DETAILED
) ips
JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
WHERE ips.index_id > 0          -- exclude heaps
  AND ips.page_count > 100      -- ignore tiny indexes
ORDER BY ips.avg_fragmentation_in_percent DESC;
```

### Missing Index Suggestions

```sql
-- Missing indexes ranked by potential impact
SELECT TOP 20
    mid.database_id,
    DB_NAME(mid.database_id)                AS database_name,
    OBJECT_SCHEMA_NAME(mid.object_id, mid.database_id) AS schema_name,
    OBJECT_NAME(mid.object_id, mid.database_id)        AS table_name,
    migs.avg_total_user_cost *
        migs.avg_user_impact *
        (migs.user_seeks + migs.user_scans)             AS improvement_measure,
    migs.unique_compiles,
    migs.user_seeks,
    migs.user_scans,
    migs.avg_total_user_cost                            AS avg_cost_without_index,
    migs.avg_user_impact,                               -- % improvement expected
    mid.equality_columns,
    mid.inequality_columns,
    mid.included_columns,
    'CREATE INDEX IX_' + OBJECT_NAME(mid.object_id, mid.database_id)
        + '_' + REPLACE(ISNULL(mid.equality_columns,''), ', ', '_')
        + ' ON ' + mid.statement
        + ' (' + ISNULL(mid.equality_columns, '')
        + CASE WHEN mid.inequality_columns IS NOT NULL
               THEN CASE WHEN mid.equality_columns IS NOT NULL THEN ', ' ELSE '' END
                    + mid.inequality_columns ELSE '' END + ')'
        + CASE WHEN mid.included_columns IS NOT NULL
               THEN ' INCLUDE (' + mid.included_columns + ')' ELSE '' END
        AS create_statement
FROM sys.dm_db_missing_index_details mid
JOIN sys.dm_db_missing_index_groups mig  ON mid.index_handle = mig.index_handle
JOIN sys.dm_db_missing_index_group_stats migs ON mig.index_group_handle = migs.group_handle
WHERE mid.database_id = DB_ID()
ORDER BY improvement_measure DESC;
```

### ALTER INDEX — Full Syntax

```sql
-- Rebuild a single index (offline by default, online with ONLINE=ON)
ALTER INDEX IX_trades_symbol ON dbo.trades
REBUILD WITH (
    FILLFACTOR = 80,
    PAD_INDEX = ON,
    SORT_IN_TEMPDB = ON,
    STATISTICS_NORECOMPUTE = OFF,
    ALLOW_ROW_LOCKS = ON,
    ALLOW_PAGE_LOCKS = ON,
    ONLINE = ON,                    -- Enterprise only; keeps table accessible
    MAXDOP = 4,                     -- limit parallelism
    DATA_COMPRESSION = PAGE         -- NONE | ROW | PAGE
);

-- Rebuild all indexes on a table
ALTER INDEX ALL ON dbo.trades REBUILD WITH (ONLINE = ON, MAXDOP = 4);

-- Reorganize (online, always; good for 5-30% fragmentation)
ALTER INDEX IX_trades_symbol ON dbo.trades
REORGANIZE WITH (LOB_COMPACTION = ON);

-- Disable an index (DML still possible; reads use table scan)
ALTER INDEX IX_trades_symbol ON dbo.trades DISABLE;

-- Enable / re-enable (must rebuild to re-enable)
ALTER INDEX IX_trades_symbol ON dbo.trades REBUILD;
```

### CREATE and DROP INDEX

```sql
-- Nonclustered index with included columns and filter
CREATE NONCLUSTERED INDEX IX_trades_symbol_date
    ON dbo.trades (symbol ASC, trade_date DESC)
    INCLUDE (notional, currency, trader_id)
    WHERE trade_status = 'ACTIVE'           -- filtered index
    WITH (
        FILLFACTOR = 80,
        PAD_INDEX = ON,
        SORT_IN_TEMPDB = ON,
        ONLINE = ON,
        DATA_COMPRESSION = PAGE,
        MAXDOP = 4
    )
    ON [PRIMARY];                           -- filegroup

-- Clustered index
CREATE CLUSTERED INDEX CIX_trades_trade_id
    ON dbo.trades (trade_id ASC)
    WITH (ONLINE = ON);

-- Unique index
CREATE UNIQUE NONCLUSTERED INDEX UIX_trades_external_ref
    ON dbo.trades (external_reference)
    WHERE external_reference IS NOT NULL;

-- Drop index
DROP INDEX IF EXISTS IX_trades_symbol_date ON dbo.trades;
```

### UPDATE STATISTICS

```sql
-- Table-level update (all stats, full scan)
UPDATE STATISTICS dbo.trades WITH FULLSCAN;

-- Single stat object
UPDATE STATISTICS dbo.trades IX_trades_symbol WITH FULLSCAN;

-- Sample-based (default: auto-sample; specify SAMPLE N PERCENT or ROWS)
UPDATE STATISTICS dbo.trades WITH SAMPLE 30 PERCENT;

-- All tables in current database
EXEC sp_updatestats;               -- incremental: only changed tables
```

---

## Backup and Restore

### BACKUP DATABASE — Full Syntax

```sql
-- Full backup with all common options
BACKUP DATABASE FinanceDB
TO DISK = '/var/opt/mssql/backup/FinanceDB_full_20260323.bak'
WITH
    NAME = 'FinanceDB Full Backup 2026-03-23',
    DESCRIPTION = 'Weekly full backup before EOD processing',
    COMPRESSION,                -- reduces size; uses more CPU
    CHECKSUM,                   -- compute and verify checksum
    STOP_ON_ERROR,              -- stop on checksum error (default: CONTINUE_AFTER_ERROR)
    INIT,                       -- overwrite existing media set
    -- NOINIT,                  -- append to existing media set
    FORMAT,                     -- create new media set
    STATS = 10,                 -- progress every 10%
    SKIP,                       -- skip media header expiry check
    REWIND,                     -- rewind tape after backup
    BLOCKSIZE = 65536,          -- optimal for modern disk (64 KB)
    BUFFERCOUNT = 64,
    MAXTRANSFERSIZE = 4194304;  -- 4 MB

-- Striped backup (split across multiple files — faster)
BACKUP DATABASE FinanceDB
TO DISK = '/backup/FinanceDB_1.bak',
   DISK = '/backup/FinanceDB_2.bak',
   DISK = '/backup/FinanceDB_3.bak',
   DISK = '/backup/FinanceDB_4.bak'
WITH COMPRESSION, CHECKSUM, INIT, STATS = 5;

-- Differential backup
BACKUP DATABASE FinanceDB
TO DISK = '/var/opt/mssql/backup/FinanceDB_diff_20260323.bak'
WITH DIFFERENTIAL, COMPRESSION, CHECKSUM, INIT, STATS = 10;

-- Copy-only backup (does not affect log chain or differential baseline)
BACKUP DATABASE FinanceDB
TO DISK = '/var/opt/mssql/backup/FinanceDB_copyonly.bak'
WITH COPY_ONLY, COMPRESSION, CHECKSUM, INIT;
```

### BACKUP LOG — Transaction Log

```sql
-- Standard log backup (tail of log)
BACKUP LOG FinanceDB
TO DISK = '/var/opt/mssql/backup/FinanceDB_log_20260323_1400.trn'
WITH COMPRESSION, CHECKSUM, INIT, STATS = 10;

-- Tail-log backup before restore (marks DB in restoring state)
BACKUP LOG FinanceDB
TO DISK = '/var/opt/mssql/backup/FinanceDB_tail_log.trn'
WITH NORECOVERY, COMPRESSION, CHECKSUM, INIT;
```

### RESTORE DATABASE — Full Syntax

```sql
-- Step 1: Inspect backup file before restoring
RESTORE HEADERONLY FROM DISK = '/backup/FinanceDB_full_20260323.bak';
RESTORE FILELISTONLY FROM DISK = '/backup/FinanceDB_full_20260323.bak';
RESTORE VERIFYONLY FROM DISK = '/backup/FinanceDB_full_20260323.bak' WITH CHECKSUM;

-- Step 2: Restore full backup (WITH NORECOVERY if logs follow)
RESTORE DATABASE FinanceDB
FROM DISK = '/backup/FinanceDB_full_20260323.bak'
WITH
    NORECOVERY,                 -- keep in restoring state for log restores
    REPLACE,                    -- overwrite existing database
    STATS = 10,
    MOVE 'FinanceDB'      TO '/var/opt/mssql/data/FinanceDB.mdf',
    MOVE 'FinanceDB_log'  TO '/var/opt/mssql/data/FinanceDB_log.ldf';

-- Step 3: Restore differential (if any)
RESTORE DATABASE FinanceDB
FROM DISK = '/backup/FinanceDB_diff_20260323.bak'
WITH NORECOVERY, STATS = 10;

-- Step 4: Restore each log backup in order
RESTORE LOG FinanceDB
FROM DISK = '/backup/FinanceDB_log_20260323_1200.trn'
WITH NORECOVERY, STATS = 10;

RESTORE LOG FinanceDB
FROM DISK = '/backup/FinanceDB_log_20260323_1400.trn'
WITH NORECOVERY, STATS = 10;

-- Step 5: Point-in-time (STOPAT)
RESTORE LOG FinanceDB
FROM DISK = '/backup/FinanceDB_log_20260323_1400.trn'
WITH STOPAT = '2026-03-23 13:45:00', RECOVERY;

-- Step 6: Bring database online (if not using STOPAT in last step)
RESTORE DATABASE FinanceDB WITH RECOVERY;

-- Restore to different name / server (database rename)
RESTORE DATABASE FinanceDB_DR
FROM DISK = '/backup/FinanceDB_full_20260323.bak'
WITH RECOVERY, REPLACE, STATS = 10,
    MOVE 'FinanceDB'     TO '/var/opt/mssql/data/FinanceDB_DR.mdf',
    MOVE 'FinanceDB_log' TO '/var/opt/mssql/data/FinanceDB_DR_log.ldf';
```

### Backup History Queries

```sql
-- Recent backup history for a database
SELECT TOP 30
    bs.database_name,
    bs.type                         AS backup_type,  -- D=Full, I=Diff, L=Log
    CASE bs.type
        WHEN 'D' THEN 'Full'
        WHEN 'I' THEN 'Differential'
        WHEN 'L' THEN 'Log'
        WHEN 'F' THEN 'File/FileGroup'
        ELSE bs.type
    END                             AS backup_type_desc,
    bs.backup_start_date,
    bs.backup_finish_date,
    DATEDIFF(SECOND, bs.backup_start_date, bs.backup_finish_date) AS duration_sec,
    bs.backup_size / 1048576.0      AS backup_size_mb,
    bs.compressed_backup_size / 1048576.0 AS compressed_mb,
    bs.has_bulk_logged_data,
    bs.is_copy_only,
    bs.recovery_model,
    bmf.physical_device_name        AS backup_file
FROM msdb.dbo.backupset bs
JOIN msdb.dbo.backupmediafamily bmf ON bs.media_set_id = bmf.media_set_id
WHERE bs.database_name = 'FinanceDB'
ORDER BY bs.backup_finish_date DESC;

-- Check if database was recently backed up (alert if not)
SELECT
    d.name,
    MAX(bs.backup_finish_date)      AS last_full_backup,
    DATEDIFF(HOUR, MAX(bs.backup_finish_date), GETDATE()) AS hours_since_backup
FROM sys.databases d
LEFT JOIN msdb.dbo.backupset bs
    ON d.name = bs.database_name AND bs.type = 'D'
WHERE d.name NOT IN ('tempdb')
GROUP BY d.name
HAVING MAX(bs.backup_finish_date) IS NULL
    OR DATEDIFF(HOUR, MAX(bs.backup_finish_date), GETDATE()) > 25
ORDER BY hours_since_backup DESC;
```

---

## Configuration

### ALTER DATABASE SET Options

```sql
-- Recovery model
ALTER DATABASE FinanceDB SET RECOVERY FULL;          -- Full
ALTER DATABASE FinanceDB SET RECOVERY BULK_LOGGED;   -- Bulk-logged
ALTER DATABASE FinanceDB SET RECOVERY SIMPLE;        -- Simple (no log backups)

-- Compatibility level
ALTER DATABASE FinanceDB SET COMPATIBILITY_LEVEL = 160;  -- SQL 2022=160, 2019=150, 2017=140

-- Automatic options
ALTER DATABASE FinanceDB SET AUTO_SHRINK OFF;        -- Never use AUTO_SHRINK
ALTER DATABASE FinanceDB SET AUTO_CLOSE OFF;
ALTER DATABASE FinanceDB SET AUTO_UPDATE_STATISTICS ON;
ALTER DATABASE FinanceDB SET AUTO_UPDATE_STATISTICS_ASYNC ON;  -- async updates
ALTER DATABASE FinanceDB SET AUTO_CREATE_STATISTICS ON;

-- Page verify
ALTER DATABASE FinanceDB SET PAGE_VERIFY CHECKSUM;   -- recommended (CHECKSUM > TORN_PAGE_DETECTION)

-- Parameterization
ALTER DATABASE FinanceDB SET PARAMETERIZATION FORCED;   -- or SIMPLE (default)

-- Snapshot isolation
ALTER DATABASE FinanceDB SET READ_COMMITTED_SNAPSHOT ON;    -- enables RCSI
ALTER DATABASE FinanceDB SET ALLOW_SNAPSHOT_ISOLATION ON;   -- enables SI level

-- Query store
ALTER DATABASE FinanceDB SET QUERY_STORE = ON;
ALTER DATABASE FinanceDB SET QUERY_STORE (
    OPERATION_MODE = READ_WRITE,
    CLEANUP_POLICY = (STALE_QUERY_THRESHOLD_DAYS = 30),
    DATA_FLUSH_INTERVAL_SECONDS = 900,
    INTERVAL_LENGTH_MINUTES = 60,
    MAX_STORAGE_SIZE_MB = 1024,
    QUERY_CAPTURE_MODE = AUTO,
    SIZE_BASED_CLEANUP_MODE = AUTO
);

-- Accelerated Database Recovery (SQL 2019+)
ALTER DATABASE FinanceDB SET ACCELERATED_DATABASE_RECOVERY = ON;

-- Misc
ALTER DATABASE FinanceDB SET QUOTED_IDENTIFIER ON;
ALTER DATABASE FinanceDB SET ANSI_NULLS ON;
ALTER DATABASE FinanceDB SET ANSI_WARNINGS ON;
ALTER DATABASE FinanceDB SET CONCAT_NULL_YIELDS_NULL ON;
ALTER DATABASE FinanceDB SET TRUSTWORTHY OFF;        -- keep OFF unless required
ALTER DATABASE FinanceDB SET DB_CHAINING OFF;
ALTER DATABASE FinanceDB SET CURSOR_CLOSE_ON_COMMIT OFF;
ALTER DATABASE FinanceDB SET CURSOR_DEFAULT LOCAL;
```

### sp_configure Recommended Settings

```sql
EXEC sp_configure 'show advanced options', 1; RECONFIGURE;

-- Max server memory: leave 10-20% for OS (on 64 GB server, set to ~54 GB)
EXEC sp_configure 'max server memory (MB)', 55296; RECONFIGURE;

-- Min server memory: prevent SQL from releasing too much to OS
EXEC sp_configure 'min server memory (MB)', 4096; RECONFIGURE;

-- MAXDOP: for OLTP typically 1-4; for data warehouse up to num_physical_cores_per_socket
EXEC sp_configure 'max degree of parallelism', 4; RECONFIGURE;

-- Cost threshold for parallelism: raise from default 5 to 35-50
EXEC sp_configure 'cost threshold for parallelism', 50; RECONFIGURE;

-- Optimize for ad hoc workloads: reduces plan cache pollution from single-use plans
EXEC sp_configure 'optimize for ad hoc workloads', 1; RECONFIGURE;

-- Backup compression default: reduces backup size/time at cost of CPU
EXEC sp_configure 'backup compression default', 1; RECONFIGURE;

-- Remote admin connections: allow DAC from remote host
EXEC sp_configure 'remote admin connections', 1; RECONFIGURE;

-- Priority boost: NEVER enable — causes CPU starvation
EXEC sp_configure 'priority boost', 0; RECONFIGURE;

-- Lightweight pooling (fibers): NEVER enable
EXEC sp_configure 'lightweight pooling', 0; RECONFIGURE;
```

### TempDB Configuration

```sql
-- TempDB: one data file per logical CPU (up to 8), equal size, no auto-grow
-- Check current TempDB files
SELECT file_id, name, physical_name,
       size * 8 / 1024 AS size_mb, growth, is_percent_growth
FROM tempdb.sys.database_files;

-- Add TempDB data files (run in tempdb context)
USE tempdb;
ALTER DATABASE tempdb MODIFY FILE (NAME = tempdev, SIZE = 4096MB, FILEGROWTH = 512MB);
ALTER DATABASE tempdb ADD FILE (NAME = tempdev2, FILENAME = '/var/opt/mssql/tempdb/tempdev2.ndf', SIZE = 4096MB, FILEGROWTH = 512MB);
ALTER DATABASE tempdb ADD FILE (NAME = tempdev3, FILENAME = '/var/opt/mssql/tempdb/tempdev3.ndf', SIZE = 4096MB, FILEGROWTH = 512MB);
ALTER DATABASE tempdb ADD FILE (NAME = tempdev4, FILENAME = '/var/opt/mssql/tempdb/tempdev4.ndf', SIZE = 4096MB, FILEGROWTH = 512MB);
USE FinanceDB;

-- TempDB trace flags for pre-2016 (enable T1117 and T1118 for uniform growth)
-- SQL 2016+ handles this automatically via ALTER DATABASE ... MODIFY FILE
```

---

## Security

### Logins and Users

```sql
-- Create SQL login
CREATE LOGIN finance_etl WITH PASSWORD = 'P@ssw0rd!', DEFAULT_DATABASE = FinanceDB,
    CHECK_POLICY = ON, CHECK_EXPIRATION = ON;

-- Create Windows login
CREATE LOGIN [CORP\svc_etl] FROM WINDOWS WITH DEFAULT_DATABASE = FinanceDB;

-- Create database user from login
USE FinanceDB;
CREATE USER finance_etl FOR LOGIN finance_etl;
CREATE USER [CORP\svc_etl] FOR LOGIN [CORP\svc_etl];

-- Create contained database user (no server login required)
CREATE USER finance_readonly WITH PASSWORD = 'R3adOnly!';

-- Modify login
ALTER LOGIN finance_etl WITH PASSWORD = 'N3wP@ss!', DEFAULT_DATABASE = FinanceDB;
ALTER LOGIN finance_etl DISABLE;
ALTER LOGIN finance_etl ENABLE;

-- Drop
DROP USER finance_etl;
DROP LOGIN finance_etl;

-- Add to server role
ALTER SERVER ROLE sysadmin          ADD MEMBER finance_etl;   -- full instance admin
ALTER SERVER ROLE serveradmin       ADD MEMBER finance_etl;
ALTER SERVER ROLE securityadmin     ADD MEMBER finance_etl;
ALTER SERVER ROLE bulkadmin         ADD MEMBER finance_etl;
ALTER SERVER ROLE dbcreator         ADD MEMBER finance_etl;
ALTER SERVER ROLE processadmin      ADD MEMBER finance_etl;
ALTER SERVER ROLE diskadmin         ADD MEMBER finance_etl;
ALTER SERVER ROLE setupadmin        ADD MEMBER finance_etl;
ALTER SERVER ROLE public            ADD MEMBER finance_etl;

-- Add to database role
ALTER ROLE db_owner           ADD MEMBER finance_etl;
ALTER ROLE db_datareader      ADD MEMBER finance_etl;
ALTER ROLE db_datawriter      ADD MEMBER finance_etl;
ALTER ROLE db_ddladmin        ADD MEMBER finance_etl;
ALTER ROLE db_securityadmin   ADD MEMBER finance_etl;
ALTER ROLE db_backupoperator  ADD MEMBER finance_etl;
ALTER ROLE db_denydatareader  ADD MEMBER finance_etl;
ALTER ROLE db_denydatawriter  ADD MEMBER finance_etl;
```

### GRANT / DENY / REVOKE

```sql
-- Common object-level permissions
GRANT SELECT ON dbo.trades         TO finance_readonly;
GRANT INSERT, UPDATE, DELETE ON dbo.trades TO finance_etl;
GRANT EXECUTE ON dbo.usp_settle_trade TO finance_app;
GRANT SELECT ON SCHEMA::dbo        TO finance_readonly;    -- entire schema
GRANT VIEW DEFINITION ON dbo.trades TO finance_readonly;

-- Deny overrides grant (even if granted via role)
DENY SELECT ON dbo.audit_log TO finance_readonly;

-- Revoke removes a previous grant or deny
REVOKE SELECT ON dbo.trades FROM finance_readonly;

-- Database-level permissions
GRANT CREATE TABLE  TO finance_etl;
GRANT CREATE VIEW   TO finance_etl;
GRANT VIEW DATABASE STATE TO finance_etl;  -- see DMVs
GRANT ALTER ANY SCHEMA TO finance_etl;

-- Server-level permissions
GRANT VIEW SERVER STATE TO finance_etl;    -- see server DMVs
GRANT ALTER ANY LOGIN   TO finance_admin;
GRANT CONTROL SERVER    TO finance_admin;  -- equivalent to sysadmin

-- Impersonation
GRANT IMPERSONATE ON USER::finance_etl TO finance_admin;
```

### Inspect Principals

```sql
-- Server logins
SELECT
    name, type_desc, is_disabled,
    create_date, modify_date,
    default_database_name,
    is_policy_checked, is_expiration_checked
FROM sys.server_principals
WHERE type IN ('S','U','G')   -- SQL, Windows user, Windows group
ORDER BY name;

-- Database users
SELECT
    dp.name         AS user_name,
    dp.type_desc,
    sp.name         AS login_name,
    dp.create_date,
    dp.modify_date,
    dp.default_schema_name,
    dp.authentication_type_desc
FROM sys.database_principals dp
LEFT JOIN sys.server_principals sp ON dp.sid = sp.sid
WHERE dp.type NOT IN ('R')      -- exclude roles
ORDER BY dp.name;

-- Effective permissions for a user
EXECUTE AS USER = 'finance_etl';
SELECT * FROM fn_my_permissions(NULL, 'DATABASE');
REVERT;

-- Who has sysadmin?
SELECT name FROM sys.server_principals
WHERE IS_SRVROLEMEMBER('sysadmin', name) = 1;

-- Object-level permissions
SELECT
    USER_NAME(dp.grantee_principal_id)  AS principal,
    dp.permission_name,
    dp.state_desc,                       -- GRANT, DENY, REVOKE
    OBJECT_NAME(dp.major_id)            AS object_name,
    SCHEMA_NAME(o.schema_id)            AS schema_name
FROM sys.database_permissions dp
JOIN sys.objects o ON dp.major_id = o.object_id
WHERE dp.class = 1    -- object-level
ORDER BY principal, object_name;
```

### Audit Setup (Server Audit)

```sql
-- Create server audit (writes to file)
CREATE SERVER AUDIT FinanceAudit
TO FILE (
    FILEPATH = '/var/opt/mssql/audit/',
    MAXSIZE = 100 MB,
    MAX_ROLLOVER_FILES = 5,
    RESERVE_DISK_SPACE = OFF
)
WITH (ON_FAILURE = CONTINUE, QUEUE_DELAY = 1000);

ALTER SERVER AUDIT FinanceAudit WITH (STATE = ON);

-- Audit database-level logins and schema changes
CREATE DATABASE AUDIT SPECIFICATION FinanceDB_Audit
FOR SERVER AUDIT FinanceAudit
ADD (SCHEMA_OBJECT_CHANGE_GROUP),
ADD (SELECT ON dbo.audit_log BY finance_etl),
ADD (DATABASE_LOGOUT_GROUP),
ADD (FAILED_DATABASE_AUTHENTICATION_GROUP)
WITH (STATE = ON);

-- Read audit log
SELECT * FROM sys.fn_get_audit_file('/var/opt/mssql/audit/FinanceAudit*', NULL, NULL);
```

---

## Concurrency

### Transaction Control

```sql
-- Basic transaction
BEGIN TRANSACTION;
    UPDATE dbo.positions SET quantity = quantity - 100 WHERE position_id = 42;
    UPDATE dbo.trades    SET status = 'SETTLED'          WHERE trade_id = 99;
COMMIT TRANSACTION;

-- With error handling
BEGIN TRY
    BEGIN TRANSACTION;
        -- work
        COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;    -- re-raise error
END CATCH;

-- SET XACT_ABORT: auto-rollback on error (recommended for all stored procedures)
SET XACT_ABORT ON;

-- Savepoint
BEGIN TRANSACTION;
    SAVE TRANSACTION sp1;
    -- work
    ROLLBACK TRANSACTION sp1;   -- rollback to savepoint only
COMMIT TRANSACTION;

-- Named transaction
BEGIN TRANSACTION settle_trade;
COMMIT TRANSACTION settle_trade;
ROLLBACK TRANSACTION settle_trade;

-- Check open transactions
SELECT @@TRANCOUNT;
```

### Isolation Levels

```sql
-- Session-level
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;  -- dirty reads allowed
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;    -- default (blocking reads)
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;   -- prevent non-repeatable reads
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;      -- no phantom reads; highest blocking
SET TRANSACTION ISOLATION LEVEL SNAPSHOT;          -- row-versioning; no blocking reads

-- Enable RCSI (Read Committed Snapshot Isolation) — requires ALTER DATABASE
ALTER DATABASE FinanceDB SET READ_COMMITTED_SNAPSHOT ON;
-- After enabling, READ COMMITTED uses row versioning instead of shared locks
```

### Lock Hints (Table Hints)

| Hint | Effect | Use Case |
|------|--------|----------|
| `WITH (NOLOCK)` | Read uncommitted; no shared locks | Dirty reads — use cautiously; may miss rows |
| `WITH (READPAST)` | Skip locked rows | Queue processing patterns |
| `WITH (UPDLOCK)` | Shared + update lock on read | Lock row before UPDATE to prevent deadlock |
| `WITH (HOLDLOCK)` | Hold shared lock until end of transaction | Prevent phantom reads in a query |
| `WITH (TABLOCK)` | Table-level shared lock | Bulk operations; prevents concurrent updates |
| `WITH (TABLOCKX)` | Exclusive table lock | Full table exclusive access |
| `WITH (ROWLOCK)` | Hint for row-level locking | Reduce lock escalation |
| `WITH (PAGLOCK)` | Page-level locking | Between row and table |
| `WITH (XLOCK)` | Exclusive lock | Exclusive read for update purposes |
| `WITH (READCOMMITTEDLOCK)` | Force lock-based read committed | Override RCSI for specific query |

```sql
-- Example usage
SELECT * FROM dbo.trades WITH (NOLOCK) WHERE trade_date = '2026-03-23';
SELECT * FROM dbo.trades WITH (UPDLOCK, ROWLOCK) WHERE trade_id = 99;
```

### Lock and Open Transaction Inspection

```sql
-- Current locks
SELECT
    tl.request_session_id   AS session_id,
    OBJECT_NAME(tl.resource_associated_entity_id) AS object_name,
    tl.resource_type,
    tl.request_mode,
    tl.request_status,
    tl.request_lifetime,
    t.text                  AS sql_text
FROM sys.dm_tran_locks tl
JOIN sys.dm_exec_requests r  ON tl.request_session_id = r.session_id
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
WHERE tl.resource_database_id = DB_ID()
  AND tl.request_status = 'WAIT'
ORDER BY tl.request_session_id;

-- Open transactions
DBCC OPENTRAN;                   -- oldest open transaction

SELECT
    s.session_id,
    s.login_name,
    s.host_name,
    at.transaction_begin_time,
    DATEDIFF(SECOND, at.transaction_begin_time, GETDATE()) AS open_sec,
    at.transaction_type,
    at.transaction_state
FROM sys.dm_tran_active_transactions at
JOIN sys.dm_tran_session_transactions st ON at.transaction_id = st.transaction_id
JOIN sys.dm_exec_sessions s              ON st.session_id = s.session_id
ORDER BY open_sec DESC;
```

### Deadlock Capture

```sql
-- Enable deadlock trace to SQL error log (persistent across restart with T1222)
DBCC TRACEON(1222, -1);   -- verbose deadlock info
DBCC TRACEON(1204, -1);   -- older format (less detail than 1222)

-- Extended Events: system_health session already captures deadlocks
-- Read deadlock graphs from system_health ring buffer
SELECT
    xdr.value('@timestamp', 'datetime2')    AS deadlock_time,
    xdr.query('.')                          AS deadlock_graph
FROM (
    SELECT CAST(target_data AS XML) AS target_data
    FROM sys.dm_xe_session_targets t
    JOIN sys.dm_xe_sessions s ON t.event_session_address = s.address
    WHERE s.name = 'system_health'
      AND t.target_name = 'ring_buffer'
) AS data
CROSS APPLY target_data.nodes('//RingBufferTarget/event[@name="xml_deadlock_report"]') AS xdt(xdr)
ORDER BY deadlock_time DESC;

-- Minimum latency deadlock monitoring with Extended Events
CREATE EVENT SESSION [DeadlockMonitor] ON SERVER
ADD EVENT sqlserver.xml_deadlock_report
ADD TARGET package0.ring_buffer (SET max_memory = 51200)
WITH (MAX_DISPATCH_LATENCY = 5 SECONDS);
ALTER EVENT SESSION [DeadlockMonitor] ON SERVER STATE = START;
```

---

## DBCC Commands

### Integrity Checks

```sql
-- Full database consistency check (can be I/O-intensive on large DBs)
DBCC CHECKDB ('FinanceDB');
DBCC CHECKDB ('FinanceDB') WITH NO_INFOMSGS, ALL_ERRORMSGS;
DBCC CHECKDB ('FinanceDB') WITH PHYSICAL_ONLY;       -- faster; skips logical checks
DBCC CHECKDB ('FinanceDB') WITH DATA_PURITY;         -- check column values in range
DBCC CHECKDB ('FinanceDB') WITH ESTIMATEONLY;        -- estimate tempdb needed

-- Single table
DBCC CHECKTABLE ('dbo.trades');
DBCC CHECKTABLE ('dbo.trades') WITH PHYSICAL_ONLY;
DBCC CHECKTABLE ('dbo.trades') WITH ALL_ERRORMSGS, NO_INFOMSGS;

-- Check catalog consistency
DBCC CHECKCATALOG ('FinanceDB');

-- Check allocations
DBCC CHECKALLOC ('FinanceDB');
```

### Shrink (Use with Caution)

```sql
-- CAUTION: Shrinking databases causes index fragmentation and may affect performance.
-- Only use for one-time space reclamation after large data deletes. Never auto-shrink.

-- Shrink database (reclaim free space)
DBCC SHRINKDATABASE ('FinanceDB', 10);    -- 10% free space target

-- Shrink a specific file
DBCC SHRINKFILE ('FinanceDB_log', 256);   -- shrink log to 256 MB
DBCC SHRINKFILE ('FinanceDB', 10240);     -- shrink data file to 10 GB
DBCC SHRINKFILE ('FinanceDB', EMPTYFILE); -- move all data out (for file removal)

-- After shrink: always rebuild indexes to fix fragmentation
ALTER INDEX ALL ON dbo.trades REBUILD;
```

### Cache Management

```sql
-- Flush entire plan cache (causes compile storm; avoid on prod)
DBCC FREEPROCCACHE;

-- Flush plan for a specific handle (safer)
DECLARE @plan_handle VARBINARY(64);
SELECT @plan_handle = plan_handle FROM sys.dm_exec_cached_plans
WHERE usecounts = 1 AND size_in_bytes > 1000000
ORDER BY size_in_bytes DESC;  -- example: largest single-use plan
DBCC FREEPROCCACHE (@plan_handle);

-- Drop clean buffer pages (dev/test only)
DBCC DROPCLEANBUFFERS;

-- Free system cache entries
DBCC FREESYSTEMCACHE ('ALL');
DBCC FREESESSIONCACHE;
```

### Statistics and Plan Info

```sql
-- Show index statistics histogram, density, header
DBCC SHOW_STATISTICS ('dbo.trades', 'IX_trades_symbol');
DBCC SHOW_STATISTICS ('dbo.trades', 'IX_trades_symbol') WITH HISTOGRAM;
DBCC SHOW_STATISTICS ('dbo.trades', 'IX_trades_symbol') WITH DENSITY_VECTOR;
DBCC SHOW_STATISTICS ('dbo.trades', 'IX_trades_symbol') WITH STAT_HEADER;

-- Show what SQL is in a session's input buffer
DBCC INPUTBUFFER (72);    -- session_id = 72
```

### Log and Wait Stats Reset

```sql
DBCC SQLPERF (LOGSPACE);                           -- log space usage
DBCC SQLPERF ('sys.dm_os_wait_stats', CLEAR);      -- reset wait stats baseline
DBCC SQLPERF ('sys.dm_os_latch_stats', CLEAR);     -- reset latch stats
```

### Trace Flags

```sql
-- Enable trace flag globally (persists for session / instance)
DBCC TRACEON (3226, -1);      -- -1 = global; no -1 = current session only

-- Disable trace flag
DBCC TRACEOFF (3226, -1);

-- Check active trace flags
DBCC TRACESTATUS (-1);        -- -1 = all global; omit for session flags

-- Enable at startup: add -T<flag> to SQL Server startup parameters
-- Example in mssql.conf or SQL Server Configuration Manager: -T3226

-- Common Trace Flags Reference
-- T1117  Pre-2016: uniform auto-grow for ALL files in filegroup (TempDB multi-file)
-- T1118  Pre-2016: force uniform extent allocations (eliminate SGAM contention)
-- T1204  Deadlock information in error log (older, less verbose than T1222)
-- T1222  Deadlock information in error log (verbose XML format; preferred)
-- T2371  Lower auto-update statistics threshold to sqrt(1000 * table_rows)
-- T3226  Suppress successful backup messages in error log
-- T4199  Enable all query optimizer fixes for current compat level
-- T7412  Lightweight query execution statistics profiling infrastructure
-- T8048  Partition memory objects to per-CPU (high-NUMA, high-concurrency servers)
-- T9481  Force legacy cardinality estimator (pre-SQL 2014)
```

### Miscellaneous DBCC

```sql
-- Rebuild all indexes on a table (older syntax)
DBCC DBREINDEX ('dbo.trades', '', 80);   -- '' = all indexes, 80 = fill factor

-- Update usage counters (fix sp_spaceused inaccuracies)
DBCC UPDATEUSAGE ('FinanceDB');
DBCC UPDATEUSAGE ('FinanceDB', 'dbo.trades');

-- Force checkpoint
CHECKPOINT;
CHECKPOINT 5;   -- target checkpoint completion within 5 seconds

-- Flush dirty log pages to disk
DBCC FLUSHPROCINDB (DB_ID('FinanceDB'));  -- flush plan cache for one database

-- Set table as read-only (testing)
DBCC SETREPCHECKS;

-- Page inspection (advanced; use only for forensics)
-- DBCC PAGE (database_id, file_id, page_id, print_option)
-- print_option: 0=header only, 1=header+data rows, 2=header+buffer, 3=header+full row data
DBCC TRACEON (3604);   -- redirect output to client (required before DBCC PAGE)
DBCC PAGE ('FinanceDB', 1, 305, 3);
DBCC TRACEOFF (3604);
```

---

## Quick-Reference: Key DMVs

| DMV | Purpose |
|-----|---------|
| `sys.dm_exec_requests` | Currently executing requests |
| `sys.dm_exec_sessions` | All connected sessions |
| `sys.dm_exec_sql_text` | SQL text for a sql_handle |
| `sys.dm_exec_query_plan` | XML execution plan for a plan_handle |
| `sys.dm_exec_cached_plans` | Plan cache entries |
| `sys.dm_os_wait_stats` | Cumulative wait statistics |
| `sys.dm_os_buffer_descriptors` | Buffer pool pages by database |
| `sys.dm_os_memory_clerks` | Memory consumers |
| `sys.dm_os_performance_counters` | PLE, batch requests/sec, etc. |
| `sys.dm_os_volume_stats` | Disk free space |
| `sys.dm_io_virtual_file_stats` | I/O per database file |
| `sys.dm_db_index_physical_stats` | Index fragmentation |
| `sys.dm_db_index_usage_stats` | Index seeks/scans/lookups/updates |
| `sys.dm_db_partition_stats` | Row counts and page counts |
| `sys.dm_db_missing_index_details` | Missing index suggestions |
| `sys.dm_tran_locks` | Current lock holders and waiters |
| `sys.dm_tran_active_transactions` | Open transactions |
| `sys.dm_db_session_space_usage` | TempDB usage per session |
| `sys.dm_exec_procedure_stats` | Stored proc execution stats |
| `sys.dm_exec_query_stats` | Query-level execution stats |

---

## Related

- [[sqlcmd-connection-and-usage]]
- [[essential-dba-queries]]
- [[backup-types-and-strategy]]
- [[restore-and-recovery]]
- [[wait-stats-analysis]]
- [[index-maintenance]]
- [[index-types-and-strategy]]
- [[memory-and-buffer-pool]]
- [[performance-audit-playbook]]
