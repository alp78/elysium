---
type: how-to
category: sql-server
technology: [sql-server]
tags: [performance, sql, sql-server, tsql]
aliases: [SQL Server audit, performance audit, health check, DBA audit, instance audit]
keywords: [performance audit, health check, wait stats, PLE, page life expectancy, buffer cache hit ratio, IO latency, missing indexes, unused indexes, blocking, deadlocks, stale statistics, plan cache, ad hoc plans, implicit conversion, TempDB, auto_shrink, MAXDOP, max server memory, cost threshold, RCSI, log reuse wait, sysadmin members, guest access, DMV, post-pipeline health check]
description: "Step-by-step SQL Server performance audit playbook covering 11 phases: instance overview, memory pressure, wait statistics, IO performance, expensive queries, index health, TempDB, blocking and deadlocks, statistics and plan quality, database sizes, and security. Includes all diagnostic queries and a post-pipeline health check script."
related: [wait-stats-analysis, execution-plans, index-types-and-strategy, deadlock-detection-and-prevention, storage-internals, sargable-queries]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Performance Audit Playbook

A step-by-step methodology for auditing any SQL Server instance from scratch. Each phase includes the diagnostic queries, how to interpret the output, what "good" and "bad" look like, and what to do when you find problems. Run through the phases in order — earlier phases often explain findings in later ones.

---

## Phase 1: Instance Overview

**Purpose:** Understand what you're working with before diving into diagnostics. Version determines available features, uptime determines how much data the DMVs have accumulated, and configuration reveals common misconfigurations.

#### DMV, MAXDOP, Cost Threshold — key terms for instance audit
- **DMV (Dynamic Management View):** System views that expose internal SQL Server state — memory usage, query stats, wait times. DMV data resets on restart, so short uptime means limited historical data.
- **MAXDOP (Max Degree of Parallelism):** How many CPU cores a single query can use. Default 0 = unlimited = all cores.
- **Cost Threshold for Parallelism:** The estimated query cost (in arbitrary units) above which SQL Server considers parallel execution. Default 5 is almost always too low.

### Version and Edition

```sql
SELECT @@VERSION;
SELECT SERVERPROPERTY('ProductVersion') AS Version,
       SERVERPROPERTY('Edition') AS Edition,
       SERVERPROPERTY('ProductLevel') AS PatchLevel;
```

#### @@VERSION, SERVERPROPERTY — version and patch level check
- **Good:** Latest CU (Cumulative Update) installed, edition matches workload needs
- **Bad:** Running RTM with no patches, Enterprise features needed but running Standard
- **Action:** If more than 2 CUs behind, recommend patching in the next maintenance window

> [!info] Edition Limits
>
> Standard edition: 128 GB RAM max, 24 cores. Express edition: 1.4 GB RAM, 1 socket. Ensure the edition matches workload requirements before tuning anything else.

### Uptime

```sql
SELECT sqlserver_start_time,
       DATEDIFF(DAY, sqlserver_start_time, GETDATE()) AS uptime_days
FROM sys.dm_os_sys_info;
```

#### sys.dm_os_sys_info sqlserver_start_time — uptime interpretation
- **Good:** Uptime > 7 days — DMVs have representative data
- **Bad:** Uptime < 1 day — all DMV-based findings need a disclaimer ("based on limited data since last restart")
- **Action:** If recently restarted, ask why. Frequent restarts are a red flag (memory leaks, patching without planning, crashes).

### Hardware

```sql
SELECT cpu_count AS logical_cpus,
       hyperthread_ratio,
       physical_memory_kb / 1024 AS physical_memory_mb,
       committed_kb / 1024 AS committed_mb,
       committed_target_kb / 1024 AS target_mb,
       max_workers_count
FROM sys.dm_os_sys_info;
```

#### sys.dm_os_sys_info — hardware: CPUs, memory committed vs target
- **Good:** `committed_mb` ≈ `target_mb` (SQL Server has enough memory to use what it's configured for)
- **Bad:** `committed_mb` significantly below `target_mb` (OS is under memory pressure and can't give SQL Server what it wants)

### Key Instance Settings

```sql
SELECT name, value_in_use
FROM sys.configurations
WHERE name IN (
    'max degree of parallelism', 'cost threshold for parallelism',
    'max server memory (MB)', 'min server memory (MB)',
    'optimize for ad hoc workloads', 'max worker threads'
)
ORDER BY name;
```

#### sp_configure — recommended values for max memory, MAXDOP, cost threshold

| Setting | Default | Red flag | Recommended |
|---------|---------|----------|-------------|
| `max server memory (MB)` | 2147483647 (2 TB) | Left at default — SQL Server will consume all available RAM and starve the OS | Total RAM minus 1–4 GB (for OS + agents) |
| `max degree of parallelism` | 0 (all cores) | 0 on a server with > 8 cores — single queries hog all CPUs | 4–8, or half of logical cores (whichever is lower) |
| `cost threshold for parallelism` | 5 | 5 is too low — tiny queries go parallel unnecessarily | 25–50 for OLTP, 10–25 for mixed workloads |
| `optimize for ad hoc workloads` | 0 (off) | Off — every unique query gets a full plan cached, bloating plan cache | 1 (on) — only caches full plan on second execution |

#### sp_configure + RECONFIGURE — fix max memory, MAXDOP, cost threshold

```sql
-- Fix max memory (example: 2 GB VM, reserve 1 GB for OS)
EXEC sp_configure 'max server memory (MB)', 768;
RECONFIGURE;

-- Fix MAXDOP (example: 4 cores)
EXEC sp_configure 'max degree of parallelism', 2;
RECONFIGURE;

-- Fix cost threshold
EXEC sp_configure 'cost threshold for parallelism', 30;
RECONFIGURE;

-- Enable optimize for ad hoc
EXEC sp_configure 'optimize for ad hoc workloads', 1;
RECONFIGURE;
```

### Database Inventory

```sql
SELECT name, state_desc, recovery_model_desc,
       compatibility_level,
       is_read_committed_snapshot_on AS RCSI,
       is_auto_shrink_on AS auto_shrink,
       is_auto_create_stats_on AS auto_stats,
       is_auto_update_stats_on AS auto_update_stats
FROM sys.databases
ORDER BY name;
```

#### sys.databases — red flags: auto_shrink, auto_stats, RCSI disabled

> [!warning] auto_shrink = ON is Critical
>
> Auto-shrink causes massive fragmentation and CPU spikes. It shrinks the file, then the next insert grows it again, endlessly. Disable immediately: `ALTER DATABASE [db] SET AUTO_SHRINK OFF;`

- `auto_stats = 0` or `auto_update_stats = 0` — SQL Server can't optimize queries without current statistics. Enable: `ALTER DATABASE [db] SET AUTO_CREATE_STATISTICS ON; ALTER DATABASE [db] SET AUTO_UPDATE_STATISTICS ON;`
- `RCSI = 0` on an OLTP database — readers block writers. Consider enabling for mixed read/write workloads.
- `recovery_model = FULL` but no log backups — the transaction log will grow forever until the disk fills up.

---

## Phase 2: Memory Pressure

**Purpose:** Determine if SQL Server has enough memory. Memory pressure is the most common performance problem — when data doesn't fit in the buffer pool, every query must read from disk (1000x slower).

#### Buffer pool, PLE, cache hit ratio — key terms for memory audit
- **Buffer pool:** SQL Server's main data cache — holds data pages in RAM so they don't need to be read from disk every time.
- **Page Life Expectancy (PLE):** Average time (in seconds) a data page stays in the buffer pool before being evicted. Higher = better. If pages are evicted quickly, queries must re-read them from disk.
- **Buffer cache hit ratio:** Percentage of page reads satisfied from the buffer pool (RAM) vs. disk. Should be > 99%.

### Buffer Pool by Database

```sql
SELECT DB_NAME(database_id) AS db,
       COUNT(*) * 8 / 1024 AS buffer_pool_mb
FROM sys.dm_os_buffer_descriptors
GROUP BY database_id
ORDER BY buffer_pool_mb DESC;
```

**Interpretation:** Shows how much of the buffer pool each database occupies. If one database dominates and others get almost nothing, those other databases will have slow queries (every read goes to disk).

### Page Life Expectancy (PLE)

```sql
SELECT cntr_value AS PLE_seconds
FROM sys.dm_os_performance_counters
WHERE counter_name = 'Page life expectancy'
  AND object_name LIKE '%Buffer Manager%';
```

#### Page Life Expectancy — healthy vs critical thresholds

| PLE | Status |
|-----|--------|
| > 1000 seconds | Healthy — pages stay in memory a long time |
| 300–1000 seconds | Acceptable for busy servers |
| < 300 seconds | Memory pressure — pages being evicted frequently, queries hitting disk |
| Volatile / drops suddenly | A large scan (table scan or index rebuild) is flushing the buffer pool |

#### Low PLE remediation — increase memory or add indexes
1. Increase `max server memory` if the OS has headroom
2. Find queries doing table scans (Phase 5) and add indexes
3. Check if index rebuilds are running during peak hours — schedule them off-peak

### Buffer Cache Hit Ratio

```sql
SELECT cntr_value AS hit_ratio
FROM sys.dm_os_performance_counters
WHERE counter_name = 'Buffer cache hit ratio'
  AND object_name LIKE '%Buffer Manager%';
```

#### Buffer cache hit ratio — interpretation thresholds
- **> 99%:** Excellent — nearly all reads come from RAM
- **95–99%:** Acceptable — some disk reads, usually on first access
- **< 95%:** Problem — significant disk IO, performance is degraded
- **< 90%:** Critical — the database is larger than the buffer pool, most queries hit disk

### Memory Clerks (What Is Using Memory)

```sql
SELECT TOP 10 type AS clerk_type,
       pages_kb / 1024 AS memory_mb
FROM sys.dm_os_memory_clerks
ORDER BY pages_kb DESC;
```

#### sys.dm_os_memory_clerks — common clerks and what they mean

| Clerk | What it is | Concern |
|-------|-----------|---------|
| `MEMORYCLERK_SQLBUFFERPOOL` | Buffer pool (data cache) | Should be the largest by far |
| `CACHESTORE_SQLCP` | Plan cache (compiled query plans) | If > 20% of buffer pool, enable "optimize for ad hoc" |
| `MEMORYCLERK_SQLQUERYEXEC` | Memory grants (sorting, hashing) | If large, queries are doing big sorts — add indexes |
| `MEMORYCLERK_SQLCLR` | CLR objects | Should be small unless using CLR assemblies |
| `OBJECTSTORE_LOCK_MANAGER` | Lock memory | If large, many concurrent locks — check for blocking |

### Pending Memory Grants

```sql
SELECT session_id, requested_memory_kb / 1024 AS requested_mb,
       granted_memory_kb / 1024 AS granted_mb,
       wait_time_ms / 1000 AS wait_sec
FROM sys.dm_exec_query_memory_grants
WHERE grant_time IS NULL;
```

**Interpretation:** If rows appear, queries are **waiting for memory before they can execute**. This is a direct performance hit — queries are sitting idle waiting for RAM.
- **Good:** 0 rows (no one is waiting)
- **Bad:** Any rows — means memory is oversubscribed
- **Action:** Increase `max server memory`, reduce MAXDOP (parallel queries request more memory), or fix the queries requesting excessive memory grants (usually missing indexes causing large sorts)

---

## Phase 3: Wait Statistics

**Purpose:** This is the **single most important diagnostic**. Wait stats tell you exactly what SQL Server spends its time waiting on. Instead of guessing, you read what the engine itself is reporting as its bottleneck.

See [[wait-stats-analysis]] for the full filtered wait stats query and the complete wait type interpretation table.

### Top Waits Query

```sql
WITH waits AS (
    SELECT wait_type,
           wait_time_ms / 1000.0 AS wait_sec,
           signal_wait_time_ms / 1000.0 AS signal_sec,
           waiting_tasks_count AS count,
           100.0 * wait_time_ms / SUM(wait_time_ms) OVER () AS pct
    FROM sys.dm_os_wait_stats
    WHERE wait_type NOT IN (
        'SLEEP_TASK','LAZYWRITER_SLEEP','WAITFOR','BROKER_RECEIVE_WAITFOR',
        'BROKER_EVENTHANDLER','CLR_AUTO_EVENT','CLR_MANUAL_EVENT',
        'DISPATCHER_QUEUE_SEMAPHORE','XE_DISPATCHER_WAIT','DIRTY_PAGE_POLL',
        'HADR_FILESTREAM_IOMGR_IOCOMPLETION','SP_SERVER_DIAGNOSTICS_SLEEP',
        'QDS_PERSIST_TASK_MAIN_LOOP_SLEEP','QDS_CLEANUP_STALE_QUERIES_TASK_MAIN_LOOP_SLEEP',
        'SQLTRACE_INCREMENTAL_FLUSH_SLEEP','CHECKPOINT_QUEUE',
        'FT_IFTS_SCHEDULER_IDLE_WAIT','XE_TIMER_EVENT','LOGMGR_QUEUE',
        'REQUEST_FOR_DEADLOCK_SEARCH','RESOURCE_QUEUE',
        'SERVER_IDLE_CHECK','SQLTRACE_BUFFER_FLUSH','WAIT_XTP_OFFLINE_CKPT_NEW_LOG',
        'BROKER_TO_FLUSH','BROKER_TASK_STOP','DBMIRRORING_CMD',
        'PREEMPTIVE_OS_PIPEOPS','PREEMPTIVE_XE_GETTARGETSTATE',
        'ONDEMAND_TASK_QUEUE'
    )
    AND waiting_tasks_count > 0
)
SELECT TOP 10 wait_type,
       CAST(wait_sec AS DECIMAL(12,1)) AS wait_sec,
       CAST(signal_sec AS DECIMAL(12,1)) AS signal_sec,
       count,
       CAST(pct AS DECIMAL(5,1)) AS pct
FROM waits
ORDER BY wait_sec DESC;
```

### Wait Type Decision Table

| Top wait type | What it means | Root cause | Remediation |
|---------------|--------------|------------|-------------|
| **PAGEIOLATCH_SH / PAGEIOLATCH_EX** | Queries waiting for data pages to be read from disk | Not enough memory (pages evicted) or missing indexes (table scans) | Add RAM, add covering indexes, move to SSD |
| **CXPACKET / CXCONSUMER** | Parallel query threads waiting for each other | MAXDOP too high, or one thread scanning a skewed partition | Lower MAXDOP, increase cost threshold, update statistics |
| **LCK_M_S / LCK_M_X / LCK_M_IX** | Queries waiting to acquire locks (blocked by another session) | Long-running transactions, missing RCSI, table scans taking locks | Enable RCSI, shorten transactions, add indexes to reduce scan locks |
| **WRITELOG** | Waiting for transaction log writes to complete | Log file on slow disk, or very high transaction rate | Move log to faster disk (separate SSD), reduce transaction frequency |
| **SOS_SCHEDULER_YIELD** | Query ran out of its CPU quantum and must yield | CPU saturation — the server doesn't have enough CPU power | Find expensive queries (Phase 5), add indexes, scale up CPU |
| **ASYNC_NETWORK_IO** | SQL Server is waiting for the client to consume results | The application is fetching results slowly (not a SQL problem) | Fix the app — fetch results faster, use pagination, reduce result set size |
| **RESOURCE_SEMAPHORE** | Queries waiting for memory grants | Too many concurrent queries requesting large sorts/hashes | Increase memory, lower MAXDOP, add indexes to avoid sorts |
| **LATCH_EX / LATCH_SH** | Internal page latch contention (not user-level locks) | TempDB contention (single file), hot page inserts | Add TempDB files (1 per CPU core, max 8), use OPTIMIZE_FOR_SEQUENTIAL_KEY |
| **IO_COMPLETION** | Waiting for non-data IO operations (e.g., sorting to tempdb) | TempDB on slow disk, large sort spills | Move TempDB to SSD, add memory, fix queries that spill to disk |

#### Wait stats output — good vs bad examples

```
-- Good (low absolute numbers, WRITELOG on a small server is normal):
wait_type           wait_sec  signal_sec  count    pct
WRITELOG            12.3      0.1         5842     35.2
PAGEIOLATCH_SH      8.1       0.0         412      23.1
SOS_SCHEDULER_YIELD 5.2       5.2         18430    14.9

-- Bad (severe problems):
wait_type           wait_sec    signal_sec  count     pct
LCK_M_S             84521.3     0.2         3842      62.1
PAGEIOLATCH_SH      28410.0     0.1         142583    20.9
RESOURCE_SEMAPHORE   9841.2     0.0         284       7.2
-- Lock waits at 62% = severe blocking. Enable RCSI, increase memory, find blocking queries.
```

### Resetting Wait Stats (After Fixing Issues)

```sql
DBCC SQLPERF('sys.dm_os_wait_stats', CLEAR);
```

Then re-run after a representative period (e.g., a full business day) to see if the fixes helped.

---

## Phase 4: IO Performance

**Purpose:** Determine if the storage subsystem is a bottleneck. Slow disk is often the root cause behind PAGEIOLATCH waits.

#### .mdf, .ldf, IO stall — key terms for IO performance audit
- **Data file (.mdf/.ndf):** Stores the actual database pages (tables, indexes)
- **Log file (.ldf):** Sequential write-ahead log — every transaction is written here first
- **IO stall:** Time (in ms) that SQL Server spent waiting for IO operations to complete

### IO Latency by File

```sql
SELECT DB_NAME(fs.database_id) AS db,
       f.type_desc AS file_type,
       f.physical_name,
       fs.num_of_reads,
       fs.num_of_writes,
       CASE WHEN fs.num_of_reads > 0
            THEN fs.io_stall_read_ms / fs.num_of_reads END AS avg_read_ms,
       CASE WHEN fs.num_of_writes > 0
            THEN fs.io_stall_write_ms / fs.num_of_writes END AS avg_write_ms,
       fs.size_on_disk_bytes / 1024 / 1024 AS size_mb
FROM sys.dm_io_virtual_file_stats(NULL, NULL) fs
JOIN sys.master_files f
    ON fs.database_id = f.database_id AND fs.file_id = f.file_id
ORDER BY (fs.io_stall_read_ms + fs.io_stall_write_ms) DESC;
```

### IO Latency Thresholds

| Metric | Good | Acceptable | Problem | Critical |
|--------|------|-----------|---------|----------|
| avg read ms (data files) | < 5 ms | 5–10 ms | 10–20 ms | > 20 ms |
| avg write ms (data files) | < 5 ms | 5–10 ms | 10–20 ms | > 20 ms |
| avg write ms (log files) | < 2 ms | 2–5 ms | 5–10 ms | > 10 ms |

> [!warning] Log Files Are More Sensitive
>
> Every transaction must wait for the log write to complete before returning success. A 10ms log write latency means every INSERT/UPDATE/DELETE takes at least 10ms regardless of how fast the query itself runs.

#### High IO latency remediation — SSD, separate data/log, add indexes
- Move to SSD if on spinning disk (biggest single improvement possible)
- Separate data and log files onto different disks (prevents read/write contention)
- If on GCP: increase disk tier (pd-standard → pd-ssd → pd-balanced)
- Check if the VM itself is IO-throttled (cloud VMs have IOPS limits per disk size)

---

## Phase 5: Expensive Queries

**Purpose:** Find the queries consuming the most resources. Even on a perfectly configured server, a single bad query can dominate CPU, memory, and IO.

**Prioritization formula:** `Impact = avg_reads × execution_count`. Fix the queries with the highest impact first — a query doing 100K reads that runs 10,000 times is worse than a query doing 10M reads that runs once.

### Top Queries by CPU

```sql
SELECT TOP 10
    qs.total_worker_time / 1000 AS total_cpu_ms,
    qs.execution_count,
    qs.total_worker_time / qs.execution_count / 1000 AS avg_cpu_ms,
    qs.total_logical_reads / qs.execution_count AS avg_reads,
    qs.total_elapsed_time / qs.execution_count / 1000 AS avg_duration_ms,
    SUBSTRING(st.text, (qs.statement_start_offset/2)+1,
        ((CASE qs.statement_end_offset WHEN -1 THEN DATALENGTH(st.text)
          ELSE qs.statement_end_offset END - qs.statement_start_offset)/2)+1) AS query_text
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
ORDER BY qs.total_worker_time DESC;
```

### Top Queries by Logical Reads (IO Pressure)

```sql
SELECT TOP 10
    qs.total_logical_reads,
    qs.execution_count,
    qs.total_logical_reads / qs.execution_count AS avg_reads,
    qs.total_worker_time / qs.execution_count / 1000 AS avg_cpu_ms,
    SUBSTRING(st.text, (qs.statement_start_offset/2)+1,
        ((CASE qs.statement_end_offset WHEN -1 THEN DATALENGTH(st.text)
          ELSE qs.statement_end_offset END - qs.statement_start_offset)/2)+1) AS query_text
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
ORDER BY qs.total_logical_reads DESC;
```

### Top Queries by Execution Count (Most Frequent)

```sql
SELECT TOP 10
    qs.execution_count,
    qs.total_worker_time / qs.execution_count / 1000 AS avg_cpu_ms,
    qs.total_logical_reads / qs.execution_count AS avg_reads,
    SUBSTRING(st.text, (qs.statement_start_offset/2)+1,
        ((CASE qs.statement_end_offset WHEN -1 THEN DATALENGTH(st.text)
          ELSE qs.statement_end_offset END - qs.statement_start_offset)/2)+1) AS query_text
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
ORDER BY qs.execution_count DESC;
```

### What to Do with a Bad Query

1. **Get the [[execution-plans|execution plan]]:** Add `CROSS APPLY sys.dm_exec_query_plan(qs.plan_handle) qp` and inspect `qp.query_plan` in SSMS (click the XML to see the graphical plan)
2. **Look for:** Table Scans, Clustered Index Scans (yellow = warnings), thick arrows (many rows flowing), Sort operators (expensive)
3. **Common fixes:**
   - Table scan → add a covering index on the WHERE/JOIN columns
   - Key Lookup → add included columns to the existing index
   - Sort → add the ORDER BY columns to the index
   - Implicit conversion warning → fix the data types to match (see [[sargable-queries]])

---

## Phase 6: Index Health

**Purpose:** Indexes are the primary mechanism for avoiding expensive table scans. Missing indexes force full scans; unused indexes waste write overhead and disk space; fragmented indexes cause extra IO.

### Missing Indexes (DMV-Based Recommendations)

```sql
SELECT TOP 20
    ROUND(gs.avg_total_user_cost * gs.avg_user_impact *
          (gs.user_seeks + gs.user_scans), 0) AS improvement_score,
    DB_NAME(d.database_id) AS db,
    d.statement AS [table],
    d.equality_columns,
    d.inequality_columns,
    d.included_columns,
    gs.user_seeks,
    gs.user_scans
FROM sys.dm_db_missing_index_groups g
JOIN sys.dm_db_missing_index_group_stats gs ON g.index_group_handle = gs.group_handle
JOIN sys.dm_db_missing_index_details d ON g.index_handle = d.index_handle
ORDER BY improvement_score DESC;
```

#### sys.dm_db_missing_index_details — interpret equality, inequality, include columns
- `equality_columns` = columns used in `WHERE col = value` (these go in the index key)
- `inequality_columns` = columns used in `WHERE col > value` or `ORDER BY` (these go after equality columns)
- `included_columns` = columns selected but not filtered on (add as `INCLUDE`)

> [!tip] Don't Blindly Create Every Missing Index
>
> Look for overlaps — if two recommendations differ only in included columns, merge them into one index. Too many indexes slows down writes.

### Unused Indexes

```sql
SELECT OBJECT_SCHEMA_NAME(i.object_id) + '.' + OBJECT_NAME(i.object_id) AS [table],
       i.name AS index_name,
       i.type_desc,
       us.user_seeks, us.user_scans, us.user_lookups,
       us.user_updates,
       ps.used_page_count * 8 / 1024 AS index_size_mb
FROM sys.indexes i
JOIN sys.dm_db_index_usage_stats us
    ON i.object_id = us.object_id AND i.index_id = us.index_id
JOIN sys.dm_db_partition_stats ps
    ON i.object_id = ps.object_id AND i.index_id = ps.index_id
WHERE OBJECTPROPERTY(i.object_id, 'IsUserTable') = 1
  AND us.database_id = DB_ID()
  AND i.type_desc <> 'HEAP'
  AND i.is_primary_key = 0
  AND i.is_unique = 0
  AND us.user_seeks + us.user_scans + us.user_lookups = 0
ORDER BY us.user_updates DESC;
```

> [!warning] Verify Uptime Before Dropping
>
> Only Drop After Verifying Uptime > 7 Days.
> If the server restarted yesterday, the index might be used by a weekly job that hasn't run yet. An index with `user_updates = 48000` and `user_seeks = 0` is a good drop candidate: `DROP INDEX IX_scores_old ON gold.scores;`

### Index Fragmentation

```sql
SELECT OBJECT_SCHEMA_NAME(ips.object_id) + '.' + OBJECT_NAME(ips.object_id) AS [table],
       i.name AS index_name,
       ips.avg_fragmentation_in_percent AS frag_pct,
       ips.page_count,
       ips.record_count
FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
WHERE ips.page_count > 128
  AND ips.avg_fragmentation_in_percent > 10
ORDER BY ips.avg_fragmentation_in_percent DESC;
```

#### Fragmentation action thresholds — reorganize vs rebuild

| Fragmentation | Action | Command |
|---------------|--------|---------|
| < 10% | No action needed | — |
| 10–30% | Reorganize (online, lightweight) | `ALTER INDEX [name] ON [table] REORGANIZE;` |
| > 30% | Rebuild (heavier, can be online in Enterprise) | `ALTER INDEX [name] ON [table] REBUILD;` |

> [!info] SSDs Change the Calculus
>
> Fragmentation matters less on SSDs than spinning disks because random reads are fast. On SSD, you can raise the rebuild threshold to 50% or higher. The main benefit of defragmenting on SSD is reclaiming wasted space, not improving read performance.

---

## Phase 7: TempDB Health

**Purpose:** TempDB is shared by all databases — sorting, hashing, temp tables, RCSI version store, and spills all go here. A misconfigured TempDB causes contention that affects every query.

#### Version store, spills — key terms for TempDB audit
- **Version store:** When RCSI is enabled, SQL Server stores old row versions in TempDB so readers can see a snapshot without taking locks. If TempDB fills up, RCSI stops working.
- **Spill:** When a sort or hash operation runs out of its memory grant, it "spills" to TempDB — writing temp data to disk. Spills are slow.
- **PFS/GAM/SGAM contention:** Allocation pages at the front of each TempDB file. With only one file, all threads compete for the same allocation pages. Fix: multiple files of equal size.

### TempDB Space Usage

```sql
SELECT SUM(user_object_reserved_page_count) * 8 / 1024 AS user_objects_mb,
       SUM(internal_object_reserved_page_count) * 8 / 1024 AS internal_objects_mb,
       SUM(version_store_reserved_page_count) * 8 / 1024 AS version_store_mb,
       SUM(unallocated_extent_page_count) * 8 / 1024 AS free_mb
FROM sys.dm_db_file_space_usage;
```

#### TempDB red flags — version store growth, spills, contention
- `version_store_mb` very large → a long-running transaction is preventing version cleanup. Find it: `SELECT * FROM sys.dm_tran_active_snapshot_database_transactions ORDER BY elapsed_time_seconds DESC;`
- `internal_objects_mb` very large → queries are spilling to disk — find them in Phase 5 and add indexes
- `free_mb` near zero → TempDB is about to run out of space — add a file or grow the existing ones

### TempDB File Configuration

```sql
SELECT name, physical_name,
       size * 8 / 1024 AS size_mb,
       growth, is_percent_growth
FROM sys.master_files
WHERE database_id = 2;
```

#### TempDB file layout — multiple files, equal size, fixed growth
- **Good:** Multiple files (1 per CPU core, max 8), all the same size, fixed growth (e.g., 64 MB)
- **Bad:** Single file, percentage growth, or files of different sizes

#### ALTER DATABASE tempdb ADD FILE — add one file per vCPU

```sql
ALTER DATABASE tempdb ADD FILE (NAME = 'tempdev2', FILENAME = '/var/opt/mssql/data/tempdb2.ndf', SIZE = 64MB, FILEGROWTH = 64MB);
ALTER DATABASE tempdb ADD FILE (NAME = 'tempdev3', FILENAME = '/var/opt/mssql/data/tempdb3.ndf', SIZE = 64MB, FILEGROWTH = 64MB);
ALTER DATABASE tempdb ADD FILE (NAME = 'tempdev4', FILENAME = '/var/opt/mssql/data/tempdb4.ndf', SIZE = 64MB, FILEGROWTH = 64MB);
```

> [!tip] Why Equal-Sized Files Matter
>
> SQL Server uses proportional fill — it writes to the file with the most free space. If files are different sizes, one file gets all the writes and contention returns. All TempDB data files must be the same size.

---

## Phase 8: Blocking and Deadlocks

**Purpose:** Identify current blocking chains and historical deadlock frequency. Blocking reduces concurrency; deadlocks kill transactions.

> [!info] Full Deadlock Coverage
>
> For comprehensive deadlock detection, Extended Events setup, prevention patterns, and retry logic, see [[deadlock-detection-and-prevention]].

### Current Blocking Chains

```sql
SELECT r.session_id AS blocked,
       r.blocking_session_id AS blocker,
       r.wait_type,
       r.wait_time / 1000 AS wait_sec,
       SUBSTRING(st.text, 1, 200) AS blocked_query
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) st
WHERE r.blocking_session_id > 0;
```

#### sys.dm_exec_requests blocking_session_id — interpretation
- **0 rows:** No blocking right now — good
- **Rows with wait_sec < 5:** Transient blocking — normal under load
- **Rows with wait_sec > 30:** Significant blocking — a long-running transaction is holding locks
- **Chains (blocker A blocks B, B blocks C):** One session cascading to many — find the head blocker

#### sys.dm_exec_sessions + dm_exec_sql_text — find what head blocker is running

```sql
SELECT s.session_id, s.login_name, s.program_name,
       s.last_request_start_time,
       SUBSTRING(st.text, 1, 200) AS blocker_query
FROM sys.dm_exec_sessions s
CROSS APPLY sys.dm_exec_sql_text(s.most_recent_sql_handle) st
WHERE s.session_id = <blocker_session_id>;
```

#### Blocking common causes — open transactions, long pipelines, index rebuilds
- **Open transaction from SSMS:** User ran BEGIN TRAN and forgot to COMMIT. Solution: COMMIT/ROLLBACK, or `KILL <session_id>`
- **Long-running pipeline step:** Pipeline holding locks for minutes. Solution: break into smaller transactions, enable RCSI
- **Index rebuild running:** Online rebuild holds schema locks briefly. Solution: schedule rebuilds off-peak

### Deadlock Count

```sql
SELECT cntr_value AS deadlocks_total
FROM sys.dm_os_performance_counters
WHERE counter_name = 'Number of Deadlocks/sec'
  AND instance_name = '_Total';
```

#### Deadlock count interpretation — dm_os_performance_counters
- **0:** No deadlocks since restart — ideal
- **< 10:** Rare deadlocks — implement retry logic and monitor
- **> 100:** Frequent deadlocks — structural problem, investigate access order patterns

### Lock Escalation

```sql
SELECT cntr_value AS lock_escalations
FROM sys.dm_os_performance_counters
WHERE counter_name = 'Lock Escalations/sec'
  AND instance_name = '_Total';
```

**Key term:** Lock escalation occurs when SQL Server converts many fine-grained row locks into a single table lock. This reduces lock manager memory but blocks all other sessions trying to access the table.

**When it's a problem:** If you see both high lock escalations AND high `LCK_M_*` waits in Phase 3, escalation is causing blocking. Fix: break large UPDATE/DELETE operations into smaller batches (e.g., process 5000 rows at a time instead of 500K).

---

## Phase 9: Statistics and Plan Quality

**Purpose:** SQL Server's query optimizer creates execution plans based on statistics. If statistics are stale, the optimizer makes bad plans, and queries run orders of magnitude slower than they should.

### Stale Statistics

```sql
SELECT TOP 20
    OBJECT_SCHEMA_NAME(s.object_id) + '.' + OBJECT_NAME(s.object_id) AS [table],
    s.name AS stat_name,
    sp.last_updated,
    sp.rows,
    sp.modification_counter AS mods_since_update,
    CAST(100.0 * sp.modification_counter / NULLIF(sp.rows, 0) AS DECIMAL(5,1)) AS pct_modified
FROM sys.stats s
CROSS APPLY sys.dm_db_stats_properties(s.object_id, s.stats_id) sp
WHERE OBJECTPROPERTY(s.object_id, 'IsUserTable') = 1
  AND sp.modification_counter > 500
ORDER BY sp.modification_counter DESC;
```

#### sys.stats + dm_db_stats_properties — stale statistics interpretation
- `pct_modified > 20%` — statistics are definitely stale, optimizer is likely making bad plans
- `last_updated` is weeks/months old on a frequently modified table — auto update stats may be off

#### UPDATE STATISTICS WITH FULLSCAN — refresh stale statistics

```sql
-- Update statistics for a specific table
UPDATE STATISTICS silver.signals_daily WITH FULLSCAN;

-- Update all statistics in the database (heavier, run off-peak)
EXEC sp_updatestats;
```

### Plan Cache Analysis

```sql
SELECT objtype,
       COUNT(*) AS plan_count,
       SUM(CAST(size_in_bytes AS BIGINT)) / 1024 / 1024 AS total_mb,
       AVG(usecounts) AS avg_use_count
FROM sys.dm_exec_cached_plans
GROUP BY objtype
ORDER BY total_mb DESC;
```

#### sys.dm_exec_cached_plans objtype — plan cache composition

| objtype | What it is | Concern |
|---------|-----------|---------|
| `Adhoc` | Individual SQL statements | If count is high (>10K) with avg_use_count ≈ 1, plan cache is bloated with single-use plans. Enable "optimize for ad hoc workloads." |
| `Prepared` | Parameterized queries (sp_executesql) | Good — plans are reusable |
| `Proc` | Stored procedures | Good — plans are reusable |

#### sp_configure 'optimize for ad hoc workloads' — fix plan cache bloat

```sql
EXEC sp_configure 'optimize for ad hoc workloads', 1;
RECONFIGURE;
```

### Implicit Conversions (Plan-Affecting)

```sql
SELECT TOP 10
    qs.total_logical_reads,
    qs.execution_count,
    SUBSTRING(st.text, 1, 200) AS query_text
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
CROSS APPLY sys.dm_exec_query_plan(qs.plan_handle) qp
WHERE qp.query_plan.exist('//Warnings/PlanAffectingConvert') = 1
ORDER BY qs.total_logical_reads DESC;
```

**Why it matters:** An implicit conversion on a WHERE clause column prevents SQL Server from using an index seek. Instead, it scans the entire index and converts every single row. A query that should take 1ms takes 10 seconds.

#### Implicit conversion culprits — nvarchar vs varchar, pyodbc defaults
- Application sends `nvarchar` parameter but column is `varchar` → SQL Server converts every row in the column to nvarchar
- Python/ODBC sends all strings as `nvarchar` by default
- Comparing `int` column with `varchar` parameter

See [[sargable-queries#Implicit Conversions — The Silent Killer]] for the Python fix.

---

## Phase 10: Database Sizes and Growth

### File Sizes and Free Space

```sql
EXEC sp_MSforeachdb '
USE [?];
SELECT DB_NAME() AS db,
       f.name AS logical_name,
       f.type_desc,
       f.physical_name,
       f.size * 8 / 1024 AS size_mb,
       FILEPROPERTY(f.name, ''SpaceUsed'') * 8 / 1024 AS used_mb,
       (f.size - FILEPROPERTY(f.name, ''SpaceUsed'')) * 8 / 1024 AS free_mb,
       CASE WHEN f.is_percent_growth = 1
            THEN CAST(f.growth AS VARCHAR) + ''%''
            ELSE CAST(f.growth * 8 / 1024 AS VARCHAR) + '' MB'' END AS growth_setting
FROM sys.database_files f;
';
```

#### Database file growth red flags — percentage growth, low free space
- **Percentage growth:** A 10% growth on a 100 GB file = 10 GB allocation. Each growth event freezes the database while SQL Server zeros the new space. Use fixed growth (64–256 MB).
- **Free space near 0:** The file will autogrow soon — on a busy system this causes a pause.
- **Log file much larger than data file:** Log isn't being backed up (FULL recovery) or has grown due to a large transaction.

### Log Reuse Wait Reasons

```sql
SELECT name, log_reuse_wait_desc
FROM sys.databases
WHERE log_reuse_wait_desc <> 'NOTHING';
```

| Wait reason | Meaning | Action |
|-------------|---------|--------|
| `NOTHING` | Log space can be reused — healthy | No action |
| `LOG_BACKUP` | In FULL recovery but no log backups taken | Take a log backup immediately, or switch to SIMPLE if you don't need point-in-time recovery |
| `ACTIVE_TRANSACTION` | A long-running transaction is preventing log truncation | Find and resolve the transaction |
| `REPLICATION` | Log reader hasn't processed these records yet | Check replication agent |
| `DATABASE_MIRRORING` | Mirror hasn't acknowledged these records | Check mirror health |

> [!warning] LOG_BACKUP Without Backups
>
> LOG_BACKUP with No Backup Schedule is an Emergency.
> The log will grow until the disk fills up and the database stops accepting writes. If the disk is nearly full, this is a P1 incident.

---

## Phase 11: Security Quick Check

**Purpose:** Identify obvious security risks. Not a full security audit, but catches the most common misconfigurations.

### Sysadmin Members

```sql
SELECT sp.name AS login, sp.type_desc, sp.is_disabled
FROM sys.server_role_members rm
JOIN sys.server_principals sp ON rm.member_principal_id = sp.principal_id
JOIN sys.server_principals rp ON rm.role_principal_id = rp.principal_id
WHERE rp.name = 'sysadmin';
```

#### sys.server_principals — security check: sa enabled, sysadmin logins
- `sa` account enabled — should be disabled or renamed in production
- Application logins with sysadmin — applications should use the least privilege needed (e.g., `db_datareader`, `db_datawriter`)
- Unknown logins — ask who these belong to

### Guest Access

```sql
SELECT d.name AS db
FROM sys.databases d
WHERE EXISTS (
    SELECT 1 FROM sys.database_permissions dp
    JOIN sys.database_principals p ON dp.grantee_principal_id = p.principal_id
    WHERE p.name = 'guest' AND dp.permission_name = 'CONNECT'
    AND dp.state = 'G'
)
AND d.name NOT IN ('master', 'tempdb', 'msdb');
```

**If any rows return:** Guest access means any authenticated login can connect to these databases — even if they don't have explicit permission. Revoke: `USE [db]; REVOKE CONNECT FROM guest;`

---

## Phase 12: Compile the Report

### Report Template

```
SQL Server Performance Audit
Instance: <hostname>\<instance>
Date: <date>
Auditor: <name>
Uptime: <days> days (DMV data quality: high/medium/low)

EXECUTIVE SUMMARY
- Overall health: GREEN / YELLOW / RED
- Top 3 findings requiring immediate action
- Estimated performance improvement from recommended changes

FINDINGS

| # | Category | Status | Finding | Impact | Recommendation | Priority |
|---|----------|--------|---------|--------|----------------|----------|
| 1 | Config   | RED    | max memory at default (2 TB) | SQL Server consuming all RAM, OS unstable | Set to <X> MB | P1 - Immediate |
| 2 | Waits    | RED    | LCK_M_S at 62% of total waits | Severe blocking, users experiencing timeouts | Enable RCSI | P1 - Immediate |
| 3 | Index    | YELLOW | 5 missing indexes (score > 100K) | Table scans on frequently queried tables | Create top 3 indexes | P2 - This week |
| 4 | IO       | GREEN  | avg read 3ms, avg write 2ms | No IO bottleneck | No action | — |
| 5 | TempDB   | YELLOW | Single file, 4 cores | Potential allocation contention under load | Add 3 more files | P2 - This week |

APPENDIX
- Full wait stats output
- Top 20 queries by CPU
- Missing index recommendations with CREATE INDEX statements
- Stale statistics list
```

### Priority Definitions

| Priority | Meaning | Timeline |
|----------|---------|----------|
| **P1 — Immediate** | Active performance degradation or data risk | Fix today or within 24 hours |
| **P2 — This week** | Significant improvement opportunity | Schedule within 5 business days |
| **P3 — Next maintenance** | Minor optimization or housekeeping | Next scheduled maintenance window |
| **P4 — Monitor** | Not a problem yet but could become one | Add to monitoring, revisit in 30 days |

### Red Flags Checklist

- [ ] `auto_shrink = ON` on any database
- [ ] `max server memory` at default (2,147,483,647 MB)
- [ ] `MAXDOP = 0` on a server with > 8 cores
- [ ] `cost threshold for parallelism = 5` (default)
- [ ] No backups, or last backup > 24 hours old
- [ ] `sa` account enabled with weak password
- [ ] Statistics older than 30 days on active tables
- [ ] Single TempDB file on multi-core system
- [ ] FULL recovery model with no log backup schedule
- [ ] Auto-growth set to percentage (not fixed MB)
- [ ] Guest access enabled on user databases

---

## Post-Pipeline Health Check Script

Run this after each daily pipeline execution to catch issues early.

#### Post-pipeline health check — active queries, blocking, wait stats, IO, stale stats, memory

```sql
PRINT '=== 1. Active Long Queries ==='
SELECT session_id, total_elapsed_time/1000 AS sec, command,
       SUBSTRING(st.text, 1, 100) AS query
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) st
WHERE is_user_process = 1 AND total_elapsed_time > 60000;

PRINT '=== 2. Blocking Chains ==='
SELECT r.session_id AS blocked, r.blocking_session_id AS blocker,
       r.wait_type, r.wait_time/1000 AS wait_sec
FROM sys.dm_exec_requests r WHERE r.blocking_session_id > 0;

PRINT '=== 3. Top 5 Waits Since Last Clear ==='
SELECT TOP 5 wait_type, wait_time_ms/1000 AS wait_sec,
       waiting_tasks_count AS count
FROM sys.dm_os_wait_stats
WHERE wait_type NOT IN ('SLEEP_TASK','LAZYWRITER_SLEEP','WAITFOR',
      'BROKER_RECEIVE_WAITFOR','BROKER_EVENTHANDLER','CLR_AUTO_EVENT',
      'DISPATCHER_QUEUE_SEMAPHORE','XE_DISPATCHER_WAIT','DIRTY_PAGE_POLL',
      'HADR_FILESTREAM_IOMGR_IOCOMPLETION','SP_SERVER_DIAGNOSTICS_SLEEP',
      'QDS_PERSIST_TASK_MAIN_LOOP_SLEEP','QDS_CLEANUP_STALE_QUERIES_TASK_MAIN_LOOP_SLEEP',
      'SQLTRACE_INCREMENTAL_FLUSH_SLEEP','CHECKPOINT_QUEUE','FT_IFTS_SCHEDULER_IDLE_WAIT')
ORDER BY wait_time_ms DESC;

PRINT '=== 4. IO Latency by File ==='
SELECT DB_NAME(fs.database_id) AS db, f.type_desc,
       fs.io_stall_read_ms / NULLIF(fs.num_of_reads,0) AS avg_read_ms,
       fs.io_stall_write_ms / NULLIF(fs.num_of_writes,0) AS avg_write_ms
FROM sys.dm_io_virtual_file_stats(NULL,NULL) fs
JOIN sys.master_files f ON fs.database_id=f.database_id AND fs.file_id=f.file_id
WHERE fs.num_of_reads + fs.num_of_writes > 100
ORDER BY (fs.io_stall_read_ms + fs.io_stall_write_ms) DESC;

PRINT '=== 5. Stale Statistics ==='
SELECT TOP 10
    OBJECT_SCHEMA_NAME(s.object_id)+'.'+OBJECT_NAME(s.object_id) AS tbl,
    s.name AS stat, sp.modification_counter AS mods, sp.last_updated
FROM sys.stats s
CROSS APPLY sys.dm_db_stats_properties(s.object_id, s.stats_id) sp
WHERE sp.modification_counter > 500 AND OBJECTPROPERTY(s.object_id,'IsUserTable')=1
ORDER BY sp.modification_counter DESC;

PRINT '=== 6. Buffer Pool Memory ==='
SELECT
    physical_memory_kb/1024 AS physical_mb,
    committed_kb/1024 AS committed_mb,
    committed_target_kb/1024 AS target_mb,
    (SELECT cntr_value FROM sys.dm_os_performance_counters
     WHERE counter_name='Page life expectancy'
       AND object_name LIKE '%Buffer Manager%') AS PLE_sec
FROM sys.dm_os_sys_info;
```

#### sqlcmd -i health_check.sql — run health check from pipeline

Linux (bash on VM):

```bash
/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "EsgDev2026Pass1" -C -d analytics_db -i post_pipeline_health.sql
```

PowerShell (via IAP tunnel):

```powershell
# Assumes tunnel is open on localhost:1433
sqlcmd -S localhost,1433 -U sa -P "EsgDev2026Pass1" -C -d analytics_db -i post_pipeline_health.sql

# Or with Invoke-Sqlcmd
Invoke-Sqlcmd -ServerInstance "localhost,1433" -Username "sa" -Password "EsgDev2026Pass1" `
  -TrustServerCertificate -Database "analytics_db" -InputFile "post_pipeline_health.sql"
```

---

### Related

- [[wait-stats-analysis]] — full wait type catalog and interpretation
- [[execution-plans]] — reading plans to diagnose the queries found in Phase 5
- [[index-types-and-strategy]] — index creation, maintenance, and strategy
- [[deadlock-detection-and-prevention]] — Phase 8 deep-dive
- [[storage-internals]] — buffer pool, log, and TempDB internals
- [[sargable-queries]] — fixing implicit conversions found in Phase 9
