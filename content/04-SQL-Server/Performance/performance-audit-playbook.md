---
title: "Performance Audit Playbook"
tags: [performance, sql, sql-server, tsql]
aliases: [SQL Server audit, performance audit, health check, DBA audit, instance audit]
description: "Step-by-step SQL Server performance audit playbook covering 11 phases: instance overview, memory pressure, wait statistics, IO performance, expensive queries, index health, TempDB, blocking and deadlocks, statistics and plan quality, database sizes, and security. Includes all diagnostic queries and a post-pipeline health check script."
parent: "[[domain-query-craft]]"
links:
  - "[[sargable-queries]]"
  - "[[merge-and-upsert]]"
  - "[[date-and-time-functions]]"
  - "[[execution-plans]]"
  - "[[query-plan-analysis]]"
  - "[[wait-stats-analysis]]"
  - "[[memory-and-buffer-pool]]"
  - "[[index-maintenance]]"
  - "[[pipeline-integration-and-devex]]"
  - "[[pit-integrity-logic]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Performance Audit Playbook

> [!quote]
> "Measurement is the first step that leads to control and eventually to improvement. If you can't measure something, you can't understand it. If you can't understand it, you can't control it."
>
> — **H. James Harrington**

A step-by-step methodology for auditing any SQL Server instance from scratch. Each phase includes the diagnostic queries, how to interpret the output, what "good" and "bad" look like, and what to do when you find problems. Run through the phases in order — earlier phases often explain findings in later ones.

---

## Phase 1: Instance Overview

**Purpose:** Understand what you're working with before diving into diagnostics. Version determines available features, uptime determines how much data the DMVs have accumulated, and configuration reveals common misconfigurations.

### Key Terms — DMV, MAXDOP, Cost Threshold
- **DMV (Dynamic Management View):** System views that expose internal SQL Server state — memory usage, query stats, wait times. DMV data resets on restart, so short uptime means limited historical data.
- **MAXDOP (Max Degree of Parallelism):** How many CPU cores a single query can use. Default 0 = unlimited = all cores.
- **Cost Threshold for Parallelism:** The estimated query cost (in arbitrary units) above which SQL Server considers parallel execution. Default 5 is Microsoft's documented starting point, not a recommendation — on modern servers it is widely considered too low. Too low → excessive `CXPACKET`/`CXCONSUMER` waits, many plans running in parallel unnecessarily. Too high → `SOS_SCHEDULER_YIELD` dominates, CPU-heavy queries can't exploit parallelism. Raise incrementally (Microsoft example: 20) and observe a full business cycle before adjusting again.

### Version and Edition

SQL Server version determines which DMVs, features, and fixes are available. Running an old version without cumulative updates (CUs) means running with known bugs, security vulnerabilities, and performance regressions that Microsoft has already fixed. Before interpreting any diagnostic output, confirm the version — some DMV columns, behaviors, and optimizer features differ between SQL Server 2016, 2019, and 2022.

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

All DMV-based diagnostics (wait stats, query stats, index usage stats, buffer pool data) accumulate from the last restart. A server that restarted this morning has only hours of wait data — the top wait type might be an anomaly from the startup process, not the steady-state workload. Uptime sets the confidence level for everything that follows.

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

Physical hardware sets the ceiling for all performance. The number of logical CPUs determines the parallelism ceiling; physical memory determines how much data fits in the buffer pool. The key metric here is `committed_mb` vs `target_mb`: `target_mb` is what SQL Server wants to use (its configured max memory), while `committed_mb` is what the OS has actually granted. A persistent gap means the OS is under pressure and is not delivering the memory SQL Server expects.

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

SQL Server ships with several defaults that are appropriate for a development installation but harmful in production. These six settings have the highest impact and are the most commonly misconfigured. `sys.configurations` returns both the configured value (what was set) and `value_in_use` (what SQL Server is actually running with) — these can differ if a setting was changed but the instance has not been restarted or `RECONFIGURE` was not run.

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
| `max degree of parallelism` | 0 (all cores) | 0 on a server with > 8 cores — single queries hog all CPUs | Single NUMA ≤ 8 cores: number of logical processors. Single NUMA > 8 cores: 8. Multi-NUMA: 8 per NUMA node or fewer. |
| `cost threshold for parallelism` | 5 | 5 is too low — tiny queries go parallel unnecessarily | 25–50 for OLTP, 10–25 for mixed workloads |
| `optimize for ad hoc workloads` | 0 (off) | Off — every unique query gets a full plan cached, bloating plan cache | 1 (on) — only caches full plan on second execution |

> [!info] SQL Server 2019/2022 — MAXDOP and Parallelism Intelligence
>
> **SQL Server 2019:** Setup automatically calculates and applies the recommended MAXDOP value based on core count. Instances upgraded from older versions may still have MAXDOP = 0 and need manual adjustment.
>
> **SQL Server 2022:** Introduces **DOP Feedback** (part of Intelligent Query Processing). For repeating queries, the engine monitors elapsed time and waits, then automatically adjusts the degree of parallelism across executions — raising DOP if the query benefits from it, lowering it if parallel overhead hurts. Requires database compatibility level 160 and Query Store enabled. No configuration needed; the engine self-tunes within the MAXDOP ceiling.
>
> **Per-database MAXDOP (all modern versions):** `sp_configure` sets the instance-wide ceiling, but MAXDOP can be overridden per-database with `ALTER DATABASE SCOPED CONFIGURATION SET MAXDOP = N`. In Availability Groups, primary and secondary read workloads can be differentiated: `ALTER DATABASE SCOPED CONFIGURATION FOR SECONDARY SET MAXDOP = 4` allows the secondary to use more parallelism for read queries while the primary stays conservative for OLTP writes. Check `sys.database_scoped_configurations` to audit per-database overrides.

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

A survey of all databases on the instance exposes database-level settings that can silently degrade performance or safety. Recovery model determines what restore options are available and whether the transaction log grows unboundedly. RCSI (Read Committed Snapshot Isolation) controls whether readers take shared locks. Auto-shrink is the single most damaging default setting that is sometimes accidentally left enabled after a migration or restore.

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

> [!success] Disable auto_shrink immediately and set fixed-size file growth
>
> `ALTER DATABASE [db] SET AUTO_SHRINK OFF;` — then pre-size the data file to its expected steady-state and set growth to a fixed value (e.g., 256 MB) so autogrow events are infrequent and predictable.

- `auto_stats = 0` or `auto_update_stats = 0` — SQL Server can't optimize queries without current statistics. Enable: `ALTER DATABASE [db] SET AUTO_CREATE_STATISTICS ON; ALTER DATABASE [db] SET AUTO_UPDATE_STATISTICS ON;`
- `RCSI = 0` on an OLTP database — readers block writers. Consider enabling for mixed read/write workloads.
- `recovery_model = FULL` but no log backups — the transaction log will grow forever until the disk fills up.

---

## Phase 2: Memory Pressure

**Purpose:** Determine if SQL Server has enough memory. Memory pressure is the most common performance problem — when data doesn't fit in the buffer pool, every query must read from disk (1000x slower).

### Key Terms — Buffer Pool, PLE, Cache Hit Ratio
- **Buffer pool:** SQL Server's main data cache — holds data pages in RAM so they don't need to be read from disk every time.
- **Page Life Expectancy (PLE):** Average time (in seconds) a data page stays in the buffer pool before being evicted. Higher = better. If pages are evicted quickly, queries must re-read them from disk.
- **Buffer cache hit ratio:** Percentage of page reads satisfied from the buffer pool (RAM) vs. disk. Should be > 99%.

### Buffer Pool by Database

When the total buffer pool is smaller than the combined working set of all databases, SQL Server must continuously evict pages from one database to make room for another. Knowing which database consumes the most buffer pool reveals where the contention originates. A single database with a large analytical workload (full scans) can flush the entire buffer pool and degrade every other database on the instance.

```sql
SELECT DB_NAME(database_id) AS db,
       COUNT(*) * 8 / 1024 AS buffer_pool_mb
FROM sys.dm_os_buffer_descriptors
GROUP BY database_id
ORDER BY buffer_pool_mb DESC;
```

**Interpretation:** Shows how much of the buffer pool each database occupies. If one database dominates and others get almost nothing, those other databases will have slow queries (every read goes to disk).

### Page Life Expectancy (PLE)

PLE measures how long the average data page survives in the buffer pool before SQL Server evicts it to make room for a new page. A healthy server with sufficient memory holds pages for thousands of seconds; an underpowered server with constant eviction pressure shows PLEs in the hundreds. Watch for PLE drops: a sudden steep decline while no queries are running usually indicates an index rebuild or a large table scan flushing hot pages out of the cache.

> [!info] PLE on Multi-NUMA Systems
>
> On servers with multiple NUMA nodes (typically systems with 2+ physical CPU sockets), SQL Server maintains a separate buffer pool per NUMA node and reports a PLE for each. The counter `object_name LIKE '%Buffer Manager%'` returns the aggregate; the per-node counters appear as `Buffer Node`. A server with two NUMA nodes where one node shows PLE 50 and the other shows PLE 2000 has a NUMA imbalance — cross-NUMA memory access is slow. In this case, the aggregate PLE is misleading.

```sql
SELECT cntr_value AS PLE_seconds
FROM sys.dm_os_performance_counters
WHERE counter_name = 'Page life expectancy'
  AND object_name LIKE '%Buffer Manager%';
```

#### Page Life Expectancy — healthy vs critical thresholds

> [!info] Interpreting PLE — Community Formula vs Official Guidance
>
> Microsoft's official documentation does not prescribe a fixed numeric PLE threshold. Official guidance: "A higher, growing value is best. A sudden dip indicates significant churn of data in and out of the buffer pool."
>
> The formula behind the 300-second rule: **300 seconds × (buffer pool GB ÷ 4)**. On a 4 GB buffer pool (the era when the rule was coined), 300s is the baseline. On a 100 GB buffer pool, the expected baseline is 7,500 seconds — and any PLE below that warrants investigation even if it is well above 300. The absolute number is less important than stability and trend.
>
> Two root causes for low PLE have different fixes: (1) under-provisioned memory where the working data set doesn't fit — add RAM or cap `max server memory` correctly; (2) non-optimized queries doing large scans that flush hot pages out of cache — add covering indexes (Phase 6). The second is more common and should be investigated first.

| PLE | Status |
|-----|--------|
| > 1000 seconds | Healthy — pages stay in memory a long time |
| 300–1000 seconds | Acceptable for busy servers |
| < 300 seconds | Possible memory pressure — pages being evicted frequently, queries hitting disk |
| Volatile / drops suddenly | A large scan (table scan or index rebuild) is flushing the buffer pool |

#### Low PLE remediation — increase memory or add indexes
1. Increase `max server memory` if the OS has headroom
2. Find queries doing table scans (Phase 5) and add indexes
3. Check if index rebuilds are running during peak hours — schedule them off-peak

### Buffer Cache Hit Ratio

The buffer cache hit ratio is a cumulative average: the percentage of all page reads since startup that were served from RAM rather than disk. A value near 100% is expected and healthy — cold starts or large one-off scans will temporarily pull it down. Because it is cumulative, a single large table scan early in the server's life can permanently depress the ratio even if the last 24 hours were perfectly healthy. Use PLE (above) as the more sensitive real-time signal; use the hit ratio as a long-term trend indicator.

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

SQL Server divides its memory among internal consumers called memory clerks — each clerk manages a specific category of allocation. When total memory usage is high or growing unexpectedly, the clerks table pinpoints whether the pressure comes from the buffer pool (data cache), plan cache, memory grants, or something else. Each clerk type points to a different remediation path.

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

Before executing operations that require large amounts of working memory (sorts, hash joins, bulk inserts), SQL Server must request a memory grant — a pre-allocation of a fixed amount from the query workspace memory pool. If the pool is exhausted, the request queues until another query releases its grant. A row in this query with `grant_time IS NULL` means the query is suspended and has not yet started executing.

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

### Key Terms — SQLOS, Task States, Wait Categories

- **SQLOS (SQL Server Operating System):** The internal scheduling layer embedded inside SQL Server. At startup, SQLOS creates one scheduler per logical CPU and allocates a pool of worker threads to each scheduler. All queries and background tasks run on those workers — the OS does not schedule SQL Server queries directly.
- **Cooperative scheduling:** Unlike the OS, SQLOS does not preempt tasks by force. Instead, every worker voluntarily yields the CPU after approximately 4 milliseconds. When a worker yields, it emits a `SOS_SCHEDULER_YIELD` wait. High `SOS_SCHEDULER_YIELD` counts indicate CPU saturation — the workers are yielding because they are competing for a limited number of scheduler slots.
- **Task states:** Every task in SQL Server transitions through three states:
  - **RUNNING** — the task is actively executing on a CPU core right now.
  - **RUNNABLE** — the task is ready to run but waiting for a free scheduler slot. This is a *signal wait* — accumulated in `signal_wait_time_ms`.
  - **SUSPENDED** — the task is waiting for a resource other than CPU (a lock, a page from disk, a log write). This is a *resource wait*.
- **Wait categories — three types, only one is a bottleneck signal:**
  - **Resource waits** — a thread needs something held or busy: a lock, a data page, a log flush. These reflect real bottlenecks and are the main target of wait analysis.
  - **Queue waits** — a thread is idle, waiting for work to arrive (e.g., Lazy Writer, Deadlock Monitor, Log Writer). These are benign background waits; the Top Waits query below filters them out.
  - **External waits** — a thread is waiting for something outside SQL Server: a linked server call, an extended stored procedure. Not always a SQL Server problem.

See [wait-stats-analysis](https://alp78.github.io/elysium/04-SQL-Server/Performance/wait-stats-analysis) for the full filtered wait stats query and the complete wait type interpretation table.

### Top Waits Query

The `sys.dm_os_wait_stats` DMV accumulates wait statistics since the last restart (or since the last explicit reset with `DBCC SQLPERF`). The raw view includes many benign background waits (idle loops, service broker housekeeping, etc.) that would otherwise dominate the results. The query below filters these out, computing each type's percentage of the total remaining wait time to surface only the waits that reflect real workload pressure.

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
| **LCK_M_U** | Waiting to acquire update locks — SQL Server takes an update lock before escalating to exclusive | Poorly optimized `UPDATE` / `DELETE` / `MERGE` statements scanning without proper indexes; often co-occurs with `PAGEIOLATCH` | Add covering indexes to eliminate row-by-row lookups; move large modifications to batch processing |
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

Because wait stats are cumulative since the last restart, pre-fix data mixes with post-fix data and makes it impossible to measure improvement. After implementing a change (adding an index, enabling RCSI, increasing memory), reset the counters so the next collection reflects only the post-fix workload.

```sql
DBCC SQLPERF('sys.dm_os_wait_stats', CLEAR);
```

Then re-run after a representative period (e.g., a full business day) to see if the fixes helped.

---

## Phase 4: IO Performance

**Purpose:** Determine if the storage subsystem is a bottleneck. Slow disk is often the root cause behind PAGEIOLATCH waits.

### Key Terms — Data Files, Log Files, IO Stall
- **Data file (.mdf/.ndf):** Stores the actual database pages (tables, indexes)
- **Log file (.ldf):** Sequential write-ahead log — every transaction is written here first
- **IO stall:** Time (in ms) that SQL Server spent waiting for IO operations to complete

### IO Latency by File

`sys.dm_io_virtual_file_stats` reports cumulative IO stall time (time spent waiting for IO operations) and total operation counts for every database file since the last restart. Dividing stall time by operation count gives average latency per operation. The query orders by total stall time (read + write combined) so the files that are the biggest IO bottleneck appear first. Comparing data file latency against log file latency often reveals whether the problem is on the storage for data pages or for the transaction log.

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

> [!success] Place the log file on a dedicated SSD and separate it from data files
>
> Move the `.ldf` file to its own disk (or its own GCP persistent disk) separate from `.mdf`. Log writes are sequential — a dedicated SSD delivers sub-2ms latency. Also batch multiple INSERTs into one transaction to reduce the number of log flushes per pipeline run.

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

`sys.dm_exec_query_stats` accumulates execution metrics per query plan in the plan cache. Because the cache resets on restart (and individual plans evict when unused), these results represent the workload since the last restart or plan eviction — not the last 24 hours. Sort by `total_worker_time` (cumulative CPU across all executions) to find the query that, in aggregate, has consumed the most CPU. High total with low execution count = one expensive query; high total with high execution count = a cheap query that runs thousands of times per hour.

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

Logical reads count page accesses from the buffer pool — each time a query requests a data page, whether it was in memory or read from disk. A query with 500,000 logical reads per execution is scanning a large fraction of the table on every call, regardless of whether the table fits in RAM. Sorting by total logical reads surfaces the queries putting the most pressure on the buffer pool and storage subsystem.

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

A query that runs 100,000 times per hour and takes only 1ms is often overlooked when sorting by total CPU, but it generates enormous cumulative pressure on locks, the plan cache, and network. High-frequency queries are also the highest-ROI target for optimization: a 0.1ms improvement on a query running 100K times/hour saves nearly 3 hours of CPU daily.

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

The three queries above identify the offending query text and its aggregate cost, but they do not explain why it is expensive. The execution plan is the next step — it shows the exact operators SQL Server used, how many rows it estimated vs. actually processed, and where it spent its time. Add the plan handle join to retrieve the plan XML, then open it in SSMS for graphical analysis.

1. **Get the [execution plan](https://alp78.github.io/elysium/04-SQL-Server/Performance/execution-plans):** Add `CROSS APPLY sys.dm_exec_query_plan(qs.plan_handle) qp` and inspect `qp.query_plan` in SSMS (click the XML to see the graphical plan)
2. **Look for:** Table Scans, Clustered Index Scans (yellow = warnings), thick arrows (many rows flowing), Sort operators (expensive)
3. **Common fixes:**
   - Table scan → add a covering index on the WHERE/JOIN columns
   - Key Lookup → add included columns to the existing index
   - Sort → add the ORDER BY columns to the index
   - Implicit conversion warning → fix the data types to match (see [sargable-queries](https://alp78.github.io/elysium/04-SQL-Server/T-SQL/sargable-queries))

---

## Phase 6: Index Health

**Purpose:** Indexes are the primary mechanism for avoiding expensive table scans. Missing indexes force full scans; unused indexes waste write overhead and disk space; fragmented indexes cause extra IO.

### Missing Indexes (DMV-Based Recommendations)

SQL Server's query optimizer tracks every query execution and records when it estimates that an index would have significantly improved a query's cost. These observations accumulate in the `sys.dm_db_missing_index_*` DMVs, ranked by an improvement score that combines the estimated cost savings with the number of executions. The score is not a percentage — it is an arbitrary internal unit; use it only for relative ranking, not absolute comparison across instances or restarts.

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

Every index imposes a maintenance cost: each INSERT, UPDATE, or DELETE must update all indexes on the affected table, not just the clustered index. An index that is never used for reads is pure overhead — it slows writes, consumes disk space, and the optimizer must consider it during query planning. This query identifies non-unique, non-primary-key indexes with zero read operations since the last restart. The `user_updates` column shows how much write overhead they are generating.

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

> [!success] Disable the index first, run a full business cycle, then drop if no complaints
>
> `ALTER INDEX IX_scores_old ON gold.scores DISABLE;` stops the write maintenance cost while keeping the index structure intact. After a month-end cycle passes without query errors, then `DROP INDEX IX_scores_old ON gold.scores;`.

### Index Fragmentation

Index fragmentation occurs when the logical order of index pages diverges from their physical order on disk. Every INSERT, UPDATE, or DELETE can cause page splits — SQL Server allocates a new page and moves half the data to maintain sorted order, leaving both pages half-full. Fragmentation degrades sequential scan performance (the OS must issue more random reads) and wastes space. The query uses `'LIMITED'` sampling mode, which reads only the index header pages and runs significantly faster than `'DETAILED'` (which reads all leaf pages).

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

Microsoft's official documentation recommends 5% as the lower threshold for action and 30% as the boundary between reorganize and rebuild. In practice, most DBAs use 10% as the lower bound to avoid maintenance overhead on lightly fragmented indexes.

| Fragmentation | Action | Command |
|---------------|--------|---------|
| < 5% | No action needed | — |
| 5–30% | Reorganize (online, interruptible, no new copy) | `ALTER INDEX [name] ON [table] REORGANIZE;` |
| > 30% | Rebuild (creates a new copy, removes all fragmentation) | `ALTER INDEX [name] ON [table] REBUILD WITH (ONLINE=ON, SORT_IN_TEMPDB=ON);` |

`ONLINE=ON` requires Enterprise/Developer Edition. `SORT_IN_TEMPDB=ON` offloads sort operations during the rebuild from the data filegroup to TempDB, which can improve rebuild speed when TempDB is on a separate, fast disk. Starting with SQL Server 2019, online index rebuilds are **resumable** — they can be paused and resumed, allowing log truncation mid-rebuild.

> [!info] SSDs Change the Calculus
>
> Fragmentation matters less on SSDs than spinning disks because random reads are fast. On SSD, you can raise the rebuild threshold to 50% or higher. The main benefit of defragmenting on SSD is reclaiming wasted space, not improving read performance.

---

## Phase 7: TempDB Health

**Purpose:** TempDB is shared by all databases — sorting, hashing, temp tables, RCSI version store, and spills all go here. A misconfigured TempDB causes contention that affects every query.

### Key Terms — Version Store, Spills, Allocation Contention
- **Version store:** When RCSI is enabled, SQL Server stores old row versions in TempDB so readers can see a snapshot without taking locks. If TempDB fills up, RCSI stops working.
- **Spill:** When a sort or hash operation runs out of its memory grant, it "spills" to TempDB — writing temp data to disk. Spills are slow.
- **PFS/GAM/SGAM contention:** Allocation pages at the front of each TempDB file. With only one file, all threads compete for the same allocation pages. Fix: multiple files of equal size.

### TempDB Space Usage

TempDB space is divided into four categories: user objects (explicit `#temp` tables and table variables created by queries), internal objects (SQL Server's own work areas — sort spills, hash spills, index build buffers), the version store (row version snapshots maintained by RCSI), and unallocated free space. Understanding which category is consuming space determines the correct remediation.

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

With a single TempDB data file, all allocations funnel through the same PFS/GAM/SGAM allocation pages — under heavy concurrent load, this creates a latch bottleneck where threads queue to update the allocation bitmaps. Adding multiple equally-sized data files distributes this contention: SQL Server uses proportional fill to spread writes across all files. The recommended configuration is one data file per CPU core, up to a maximum of eight.

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

> [!info] SQL Server 2016+ — Trace Flags T1117 and T1118 No Longer Needed
>
> Before SQL Server 2016, TempDB required two startup trace flags for correct behavior:
> - **T1117** — force all data files in a filegroup to grow simultaneously (so proportional fill stays balanced)
> - **T1118** — use uniform extent allocation instead of mixed-page allocation (reduces GAM/SGAM contention)
>
> Since SQL Server 2016, both behaviors are **the built-in default** for TempDB. `AUTOGROW_ALL_FILES` is permanently enabled for the TempDB PRIMARY filegroup. These trace flags are no longer required and have no effect if set. Additionally, SQL Server 2016+ setup automatically creates `min(logical processors, 8)` TempDB data files — check `sys.master_files` immediately after installation to confirm.
>
> **If `PAGELATCH` contention persists after setting 8 files:** increase in multiples of 4 (to 12, 16, …) up to the logical processor count. Most workloads are resolved by 8.

#### ALTER DATABASE tempdb ADD FILE — add one file per vCPU

```sql
ALTER DATABASE tempdb ADD FILE (NAME = 'tempdev2', FILENAME = '/var/opt/mssql/data/tempdb2.ndf', SIZE = 64MB, FILEGROWTH = 64MB);
ALTER DATABASE tempdb ADD FILE (NAME = 'tempdev3', FILENAME = '/var/opt/mssql/data/tempdb3.ndf', SIZE = 64MB, FILEGROWTH = 64MB);
ALTER DATABASE tempdb ADD FILE (NAME = 'tempdev4', FILENAME = '/var/opt/mssql/data/tempdb4.ndf', SIZE = 64MB, FILEGROWTH = 64MB);
```

> [!tip] Why Equal-Sized Files Matter
>
> SQL Server uses proportional fill — it writes to the file with the most free space. If files are different sizes, one file gets all the writes and contention returns. All TempDB data files must be the same size.

### PAGELATCH Contention Diagnosis (SQL Server 2019+)

When Phase 3 shows `PAGELATCH_EX` or `PAGELATCH_SH` as top waits and the server runs SQL Server 2019 or later, you can identify exactly which TempDB allocation pages are hot. `sys.dm_os_waiting_tasks` captures waiting tasks and their packed resource descriptions; `sys.fn_PageResCracker` decodes the resource description into database, file, and page identifiers; `sys.dm_db_page_info` then resolves the page ID to a human-readable page type. This pinpoints whether the contention is on PFS, GAM, or SGAM pages — which determines the fix.

```sql
SELECT wt.session_id,
       wt.wait_type,
       wt.wait_duration_ms,
       wt.resource_description,
       pi.page_type_desc
FROM sys.dm_os_waiting_tasks wt
CROSS APPLY sys.fn_PageResCracker(wt.resource_description) prc
CROSS APPLY sys.dm_db_page_info(prc.db_id, prc.file_id, prc.page_id, 'LIMITED') pi
WHERE wt.wait_type LIKE 'PAGELATCH%'
  AND wt.database_id = 2;  -- TempDB = database_id 2
```

#### page_type_desc — interpreting the hot page type

| page_type_desc | What it means | Fix |
|----------------|--------------|-----|
| `PFS` (Page Free Space) | Allocation bitmap hit — the most common TempDB contention pattern | Add more equally-sized TempDB data files (1 per CPU core, max 8) |
| `GAM` / `SGAM` | Global allocation map contention | Same fix: add TempDB data files |
| Any type, `database_id ≠ 2` | PAGELATCH contention outside TempDB — hot leaf page from sequential inserts | Use `OPTIMIZE_FOR_SEQUENTIAL_KEY = ON` on the index (SQL Server 2019+), or switch the clustered key away from a sequential value |

> [!info] PAGELATCH vs PAGEIOLATCH
>
> `PAGELATCH` waits are in-memory latch contention — threads competing to read or modify a page that is already in the buffer pool. Duration is typically microseconds to low milliseconds. `PAGEIOLATCH` waits are for pages not yet in the buffer pool — the IO has been issued and the thread is waiting for the disk to return the data. Duration reflects storage latency (ideally < 5 ms for data, < 1 ms for log). The two look similar but point to completely different bottlenecks.

> [!info] SQL Server 2019/2022 — TempDB Engine Improvements
>
> **Memory-Optimized TempDB Metadata (SQL Server 2019+):** Stores TempDB internal system tables (allocation bitmaps, object catalog) in non-durable memory-optimized (In-Memory OLTP) tables. This eliminates the system page latch contention at the engine level rather than distributing it across files. Enable with: `ALTER SERVER CONFIGURATION SET MEMORY_OPTIMIZED TEMPDB_METADATA = ON` (requires restart). Caveat: a single transaction cannot span memory-optimized tables across databases — this can break certain monitoring scripts that join TempDB system tables with other databases.
>
> **SQL Server 2022 — System Page Latch Concurrency Enhancements:** Structural engine change that allows concurrent GAM and SGAM page updates, reducing the serialization bottleneck even with a single TempDB data file. No configuration required — activates automatically on SQL Server 2022. Reduces but does not eliminate the need for multiple TempDB files under extreme allocation load.

---

## Phase 8: Blocking and Deadlocks

**Purpose:** Identify current blocking chains and historical deadlock frequency. Blocking reduces concurrency; deadlocks kill transactions.

> [!info] Full Deadlock Coverage
>
> For comprehensive deadlock detection, Extended Events setup, prevention patterns, and retry logic, see [deadlock-detection-and-prevention](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/deadlock-detection-and-prevention).

### Current Blocking Chains

A blocking chain forms when session A holds a lock that session B is waiting for. If B in turn holds a lock that C needs, all three form a chain — with A as the head blocker. Killing any non-head session only releases it temporarily; the chain rebuilds at the next execution. Identifying and resolving the head blocker is the only durable fix.

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

A deadlock occurs when two sessions each hold a lock the other needs and neither can proceed. SQL Server detects deadlocks automatically via its deadlock monitor (runs every 5 seconds) and kills the session with the least accumulated CPU cost — the "deadlock victim." The killed transaction rolls back and the error is returned to the application. This counter reports cumulative deadlocks since the last restart; the counter name says "/sec" but `cntr_value` is a running total, not a rate.

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

When a single statement accumulates more than 5,000 row or page locks, SQL Server automatically promotes them to a single coarser lock at the table level — this is lock escalation. The goal is to reduce lock manager memory pressure, but the side effect is that the table lock blocks all other sessions trying to access any row in that table. The performance counter reports cumulative escalations since restart; watch for a rising value alongside high `LCK_M_*` wait types from Phase 3.

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

Statistics are histograms that SQL Server's query optimizer reads to estimate how many rows a filter will return. When data changes significantly, the stored histogram no longer reflects the actual distribution — the optimizer's estimates become wrong, and the execution plan it chooses may be orders of magnitude less efficient than one built from accurate data.

SQL Server auto-updates statistics when the modification counter for a statistic's leading column crosses an auto-update threshold. The threshold formula depends on version and compatibility level:

- **Pre-SQL Server 2016 (or compat level < 130):** `500 + 20% of rows`. For a table with 10M rows, 2M changes required — statistics can become severely stale on large tables.
- **SQL Server 2016+ with compat level ≥ 130:** Dynamic threshold = `SQRT(1000 × rows)`. For a 10M-row table, this is `SQRT(10B) ≈ 100,000 changes` — much lower, meaning statistics update more frequently. This was previously only available via trace flag T2371.

The `modification_counter` column in `sys.dm_db_stats_properties` reports changes since the last statistics update. Dividing by `rows` gives the percentage modified.

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
- `pct_modified > 20%` — statistics are likely stale under the legacy threshold (compat level < 130). Under the dynamic threshold (2016+ / compat level ≥ 130), even 1–2% modification can trigger an update on very large tables — check `last_updated` to confirm.
- `last_updated` is weeks/months old on a frequently modified table — auto update stats may be disabled, or the table is below the trigger threshold

> [!info] SQL Server 2019+ — Diagnosing Statistics Refresh Blocking
>
> SQL Server 2019 added the `WAIT_ON_SYNC_STATISTICS_REFRESH` wait type, which accumulates when queries are blocked waiting for a synchronous statistics update to complete. The same sessions appear in `sys.dm_exec_requests` with `command = 'SELECT (STATMAN)'`. If these waits appear frequently, consider enabling `AUTO_UPDATE_STATISTICS_ASYNC ON` so statistics refresh in the background without blocking the query.
>
> SQL Server 2022 adds `ASYNC_STATS_UPDATE_WAIT_AT_LOW_PRIORITY` (a database-scoped configuration) which places the schema stability lock request for stats updates in a low-priority queue, further reducing blocking on actively-queried tables.

#### UPDATE STATISTICS WITH FULLSCAN — refresh stale statistics

```sql
-- Update statistics for a specific table (FULLSCAN = 100% row sample, most accurate)
UPDATE STATISTICS silver.signals_daily WITH FULLSCAN;

-- Update all statistics in the database (heavier, run off-peak)
EXEC sp_updatestats;
```

### Plan Cache Analysis

Every compiled query plan is stored in the plan cache so subsequent executions reuse the compiled plan instead of paying the compilation cost again. On OLTP systems that use a lot of ad-hoc SQL (non-parameterized queries), each unique query text generates a separate plan entry that is used exactly once — consuming memory for a plan that will never run again. This wastes memory that the buffer pool could otherwise use for data pages.

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

> [!warning] Plan Cache DMVs Have a Blind Spot
>
> `sys.dm_exec_cached_plans` and `sys.dm_exec_query_stats` only reflect plans currently in the cache. Plans evicted by memory pressure, manually flushed with `DBCC FREEPROCCACHE`, or simply never cached (one-time queries) are invisible. This means a query can be the worst performer in production yet not appear in any plan cache DMV. **Query Store** (SQL Server 2016+, enabled by default in 2022) fills this gap — it persists query performance history across cache evictions and restarts, making it the authoritative source for identifying historically bad queries.

#### sp_configure 'optimize for ad hoc workloads' — fix plan cache bloat

```sql
EXEC sp_configure 'optimize for ad hoc workloads', 1;
RECONFIGURE;
```

### Implicit Conversions (Plan-Affecting)

An implicit conversion occurs when a query compares two values of different data types and SQL Server must silently convert one of them to make the comparison work. When the conversion is applied to the column side of the expression (rather than the parameter), SQL Server cannot use the column's index — it must scan every row, apply the conversion, and then evaluate the filter. The `PlanAffectingConvert` warning in the XML execution plan is how SQL Server signals this condition; this query surfaces the highest-impact offenders from the plan cache.

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

See [sargable-queries > Implicit Conversions — The Silent Killer](https://alp78.github.io/elysium/04-SQL-Server/T-SQL/sargable-queries#implicit-conversions--the-silent-killer) for the Python fix.

### Parameter Sensitive Plan Optimization (SQL Server 2022)

Parameter sniffing is the behavior where SQL Server compiles an execution plan using the parameter values present at first execution and then reuses that plan for all subsequent executions — even when those later executions use parameter values with completely different data distributions. A plan optimized for `@customer_id = 1` (10 rows) will be catastrophically wrong when reused for `@customer_id = 99` (1 million rows), because the optimizer chose a nested-loop join that scales linearly with row count.

SQL Server 2022 introduces **Parameter Sensitive Plan (PSP) Optimization** — a feature that automatically detects non-uniform data distributions for parameterized statements and generates multiple distinct execution plans (one per selectivity range) for the same query. The correct plan variant is selected at runtime based on the actual parameter value.

PSP Optimization requires:
- SQL Server 2022 (or Azure SQL Database / Managed Instance)
- Database compatibility level 160
- Feature is on by default at compat level 160; no configuration needed

```sql
-- Check if PSP Optimization is active on the database
SELECT name,
       compatibility_level,
       is_query_store_on
FROM sys.databases
WHERE name = DB_NAME();

-- Disable at database level if causing issues (rare)
ALTER DATABASE SCOPED CONFIGURATION SET PARAMETER_SENSITIVE_PLAN_OPTIMIZATION = OFF;

-- Disable at query level
SELECT * FROM dbo.orders WHERE customer_id = @cid
OPTION (USE HINT('DISABLE_PARAMETER_SENSITIVE_PLAN'));
```

#### PSP Optimization — when to check it

| Symptom | Meaning | Action |
|---------|---------|--------|
| Query with `@param` runs fast sometimes, slow other times | Classic parameter sniffing | Upgrade to compat 160, PSP Optimization activates automatically |
| High plan cache count for the same query | PSP generating too many variants | Check Query Store for dispatcher plans; consider `DISABLE_PARAMETER_SENSITIVE_PLAN` hint |
| PSP not helping despite compat 160 | Parameter sniffing disabled (trace flag 4136, DISABLE_PARAMETER_SNIFFING hint, or `PARAMETER_SNIFFING = OFF`) | PSP automatically deactivates when sniffing is disabled; re-enable sniffing or use manual OPTIMIZE FOR hints |

> [!info] Query Store Required for Full Visibility
>
> PSP Optimization stores multiple plan variants in the plan cache. Query Store (on by default for new databases in SQL Server 2022) is the only way to see the plan history per parameter range, identify which variant is chosen at runtime, and force a specific variant if the automatic choice is wrong. Without Query Store, plan behavior for PSP-optimized queries is a black box.

### SQL Server 2022 Intelligent Query Processing — Feature Overview

PSP Optimization is one of several self-tuning features in the **Intelligent Query Processing (IQP)** suite introduced or extended in SQL Server 2022. All require Query Store in read-write mode; most also require compatibility level 160.

| IQP Feature | What it does | Requirement |
|-------------|-------------|-------------|
| **Parameter Sensitive Plan (PSP) Optimization** | Caches multiple plan variants per parameterized query — one per selectivity range. Selects the best variant at runtime. | compat 160 |
| **Cardinality Estimation (CE) Feedback** | Detects systematic CE model assumption errors (correlation, containment) for repeating queries and auto-corrects them. Corrections are persisted as Query Store hints so they survive plan cache eviction. | compat 160, QS read-write |
| **DOP Feedback** | Monitors elapsed time and waits for repeating parallel queries; automatically lowers or raises DOP to reduce overhead. Reverts if performance regresses. | compat 160, QS read-write |
| **Memory Grant Feedback — Percentile + Persistence** | Uses the percentile of recent memory grants (not just the last execution) to smooth out oscillating workloads. Persists the feedback to Query Store so it survives instance restarts. | QS enabled |
| **Optimized Plan Forcing** | Pre-caches expensive compilation steps for forced Query Store plans so that forced-plan recompilations are significantly cheaper. | QS enabled |

Before running a performance audit on a SQL Server 2022 instance, confirm that Query Store is enabled and set to `READ_WRITE` mode on all critical databases — without it, half the IQP features are inactive.

```sql
-- Check Query Store state across all user databases
SELECT name,
       compatibility_level,
       is_query_store_on,
       query_store_state_desc
FROM sys.databases
WHERE name NOT IN ('master','tempdb','model','msdb')
ORDER BY name;
```

---

## Phase 10: Database Sizes and Growth

**Purpose:** Understand how much disk space each database occupies, how fast it is growing, and whether autogrowth settings are safe. Unbounded log growth is one of the most common causes of production outages — a disk-full event stops all database writes immediately. This phase also identifies recovery model mismatches where a database in FULL recovery has no log backup schedule, causing the transaction log to grow until the disk is exhausted.

### File Sizes and Free Space

This query iterates across every database on the instance and reports the current allocated size, used space, free space, and autogrowth setting for each file. The `sp_MSforeachdb` procedure runs the inner query in the context of each database in turn, including system databases. Focus on: files approaching zero free space (autogrow is imminent), log files much larger than data files (log not being truncated), and any file with percentage-based autogrowth.

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

The transaction log grows continuously — SQL Server only reclaims space when it can overwrite earlier log records, a process called log truncation. In SIMPLE recovery, truncation happens automatically at every checkpoint. In FULL recovery, truncation only occurs after a log backup, because the unprocessed log records are needed to restore to a point in time. The `log_reuse_wait_desc` column shows exactly what is blocking truncation when the log is growing unexpectedly.

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

> [!success] Take an immediate log backup, then schedule regular log backups or switch to SIMPLE recovery
>
> Run `BACKUP LOG [db] TO DISK = N'/backup/db_log.bak';` to truncate the log now. Then either set up a SQL Agent job to back up the log every 15–60 minutes, or — if point-in-time recovery is not needed — `ALTER DATABASE [db] SET RECOVERY SIMPLE;` to allow automatic log truncation.

---

## Phase 11: Security Quick Check

**Purpose:** Identify obvious security risks. Not a full security audit, but catches the most common misconfigurations.

### Sysadmin Members

The `sysadmin` server role is the highest privilege level on a SQL Server instance — members have unrestricted access to every database, every object, and every server configuration. A login with `sysadmin` can read any table, drop any database, and change any setting without restriction. Production instances should have the minimum number of sysadmin members necessary: typically the SQL Server service account and named DBA accounts only.

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

The `guest` user is a built-in database principal that exists in every database. When `guest` has the `CONNECT` permission, any authenticated Windows or SQL login can access the database — even without an explicit user mapping. This is intentional for `master`, `tempdb`, and `msdb`, where guest access is required for normal SQL Server operation. On user databases, it is almost always a misconfiguration.

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

**Purpose:** Translate the raw diagnostic data from Phases 1–11 into a structured, prioritized report that non-technical stakeholders can act on. A good audit report separates findings by impact and urgency, proposes a concrete remediation sequence, and provides enough evidence (query output, thresholds, comparisons) that the DBA executing the fixes does not need to re-run the diagnostics. The report is the deliverable — everything else is methodology.

### Report Template

The report has two parts: an executive summary for stakeholders (overall health, top 3 actions) and a findings table for the DBA (every finding with its category, status, evidence, and a specific recommended action with a priority). Use the status colors consistently: RED = immediate action required, YELLOW = action recommended within a week, GREEN = no issue, monitor. Do not include findings from every phase — only phases where something actionable was found.

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

Every finding in the report is assigned a priority that determines its remediation timeline. Avoid the temptation to assign everything P1 — stakeholders will deprioritize the report if everything is marked urgent. Reserve P1 for conditions that are actively causing user-facing degradation or data risk right now.

| Priority | Meaning | Timeline |
|----------|---------|----------|
| **P1 — Immediate** | Active performance degradation or data risk | Fix today or within 24 hours |
| **P2 — This week** | Significant improvement opportunity | Schedule within 5 business days |
| **P3 — Next maintenance** | Minor optimization or housekeeping | Next scheduled maintenance window |
| **P4 — Monitor** | Not a problem yet but could become one | Add to monitoring, revisit in 30 days |

### Red Flags Checklist

A fast pre-flight scan: if any of these conditions are true, they are almost certainly P1 or P2 findings regardless of what the other phases show. Run this checklist at the start of every audit engagement to triage quickly before diving into the detailed phases.

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

A condensed diagnostic script designed to run in under 60 seconds after each daily pipeline execution. Unlike a full audit (Phases 1–12), this script is not exhaustive — it targets the six most time-sensitive signals that a pipeline run could disturb: long-running queries left behind, blocking chains, top wait types, per-file IO latency, stale statistics from high row-churn tables, and buffer pool memory health. Run it as a post-step in the pipeline job to catch regressions before the next business day begins.

### Diagnostic Script — Active Queries, Blocking, Waits, IO, Statistics, Memory

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

### Execution — Running the Script from the Pipeline

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

## DBCC and Trace Flag Reference

DBCC (Database Console Commands) are SQL Server's built-in maintenance and diagnostic commands. They operate at the storage engine level — below the query engine — and expose functionality that standard T-SQL DDL/DML cannot reach: physical page integrity checks, space reclamation, low-level page inspection, and trace flag control. During a performance audit, these commands are used to act on specific findings from earlier phases (fragmentation, space pressure, log file bloat) and to configure engine-level behaviors that affect the entire instance.

### DBCC SHRINKDATABASE — reclaim space after one-time data deletion

`DBCC SHRINKDATABASE` reduces the physical size of database files by moving allocated pages toward the front of the file and releasing the tail end back to the OS. The second argument is the target percentage of free space to leave in the file after shrinking. `DBCC SHRINKFILE` operates on a single file by name or ID, and its `EMPTYFILE` option moves all pages to other files in the same filegroup — useful before removing a data file from a filegroup.

> [!danger] Shrink Causes Massive Index Fragmentation
>
> DBCC SHRINKDATABASE causes massive index fragmentation. After shrinking, every index must be rebuilt — which grows the file again. Only shrink when reclaiming space from a one-time event (large data deletion, log backup catch-up). Never schedule regular shrinks.

> [!success] After any shrink, immediately rebuild all indexes to restore performance
>
> Run `ALTER INDEX ALL ON table REBUILD WITH (ONLINE = ON);` for every table in the shrunk database. Better still, avoid shrinking — pre-size files at deployment and only shrink as a one-time recovery action, never on a schedule.

```sql
-- Shrink database (reclaim free space)
DBCC SHRINKDATABASE ('FinanceDB', 10);    -- 10% free space target

-- Shrink a specific file
DBCC SHRINKFILE ('FinanceDB_log', 256);   -- shrink log to 256 MB
DBCC SHRINKFILE ('FinanceDB', 10240);     -- shrink data file to 10 GB
DBCC SHRINKFILE ('FinanceDB', EMPTYFILE); -- move all data out (for file removal)

-- After shrink: always rebuild indexes to fix fragmentation
ALTER INDEX ALL ON dbo.trades REBUILD;
```

### Trace Flags Reference — common flags and version defaults

Trace flags modify SQL Server's behavior at the engine level — they enable or disable specific behaviors, expose diagnostic output, or activate features that are off by default. Flags set with `-1` apply globally to all sessions; without `-1`, they apply only to the current session. On SQL Server 2016 and later with compatibility level 130+, many previously useful trace flags became the default behavior — enabling them on modern instances has no effect and is unnecessary.

> [!info] Most Trace Flags Are Obsolete in SQL Server 2016+
>
> Most of these trace flags are obsolete in SQL Server 2016+ because their behavior became the default. T1117 (uniform extent allocation) and T1118 (mixed extent removal) are default since 2016. T2371 (dynamic statistics threshold) is default since 2016. Check your version before enabling.

```sql
-- Enable trace flag globally
DBCC TRACEON (3226, -1);      -- -1 = global; no -1 = current session only

-- Disable trace flag
DBCC TRACEOFF (3226, -1);

-- Check active trace flags
DBCC TRACESTATUS (-1);        -- -1 = all global; omit for session flags
```

| Flag | Behavior | Notes |
|------|----------|-------|
| T1117 | Uniform auto-grow for ALL files in filegroup | Default since 2016 |
| T1118 | Force uniform extent allocations (eliminate SGAM contention) | Default since 2016 |
| T1204 | Deadlock information in error log (less verbose) | Older format |
| T1222 | Deadlock information in error log (verbose XML) | Preferred over T1204 |
| T2371 | Lower auto-update statistics threshold to `sqrt(1000 * rows)` | Default since 2016 |
| T3226 | Suppress successful backup messages in error log | Still useful on all versions |
| T4199 | Enable all query optimizer fixes for current compat level | Recommended for most workloads |
| T7412 | Lightweight query execution statistics profiling | Enables live query stats |
| T8048 | Partition memory objects to per-CPU | For high-NUMA, high-concurrency servers |
| T9481 | Force legacy cardinality estimator (pre-SQL 2014) | Use when CE 120+ causes regressions |

### DBCC PAGE — low-level page inspection for forensics

Low-level page inspection for forensics — rarely needed in daily operations but invaluable when diagnosing corruption or understanding storage internals.

```sql
-- DBCC PAGE (database_id, file_id, page_id, print_option)
-- print_option: 0=header only, 1=header+rows, 2=header+buffer, 3=header+full row data
DBCC TRACEON (3604);   -- redirect output to client (required before DBCC PAGE)
DBCC PAGE ('FinanceDB', 1, 305, 3);
DBCC TRACEOFF (3604);
```

### DMV Quick-Reference — Dynamic Management Views at a glance

The DMVs (Dynamic Management Views) are SQL Server's internal telemetry. They expose real-time data about sessions, queries, waits, memory, indexes, and I/O. All reset on restart unless noted.

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

### Related

- [wait-stats-analysis](https://alp78.github.io/elysium/04-SQL-Server/Performance/wait-stats-analysis) — full wait type catalog and interpretation
- [execution-plans](https://alp78.github.io/elysium/04-SQL-Server/Performance/execution-plans) — reading plans to diagnose the queries found in Phase 5
- [index-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/index-types-and-strategy) — index creation, maintenance, and strategy
- [deadlock-detection-and-prevention](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/deadlock-detection-and-prevention) — Phase 8 deep-dive
- [storage-internals](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/storage-internals) — buffer pool, log, and TempDB internals
- [sargable-queries](https://alp78.github.io/elysium/04-SQL-Server/T-SQL/sargable-queries) — fixing implicit conversions found in Phase 9
