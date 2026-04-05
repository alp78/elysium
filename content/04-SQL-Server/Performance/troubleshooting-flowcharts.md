---
title: "Troubleshooting Flowcharts"
tags: [sql, sql-server, tsql]
aliases: [SQL Server troubleshooting, why is it slow, pipeline failed, disk space emergency, should I add an index, decision tree, troubleshooting guide]
description: "Visual troubleshooting flowcharts for SQL Server: diagnosing slowness via wait stats, pipeline failure root cause analysis, the index decision tree, and disk space emergency recovery steps."
parent: "[[domain-server-operations]]"
links:
  - "[[server-configuration]]"
  - "[[sqlcmd-connection-and-usage]]"
  - "[[essential-dba-queries]]"
  - "[[sql-server-agent-jobs]]"
  - "[[backup-types-and-strategy]]"
  - "[[restore-and-recovery]]"
  - "[[finops-cost-optimization]]"
  - "[[high-availability-overview]]"
  - "[[always-on-availability-groups]]"
  - "[[sql-server-problems]]"
created: 2026-03-22
updated: 2026-04-04
status: complete
---

# Troubleshooting Flowcharts

> [!quote]
> "The most effective debugging tool is still careful thought, coupled with judiciously placed print statements."
>
> — **Brian Kernighan**, *Unix for Beginners* (1979)

Four decision trees for the most common SQL Server problems: slowness, pipeline failures, indexing decisions, and disk space emergencies. Start with the relevant flowchart, then follow references to deeper notes for each resolution path. To practice applying these flowcharts to realistic scenarios, work through [sql-server-problems](https://alp78.github.io/elysium/04-SQL-Server/sql-server-problems).

---

## Flowchart 1: "Why Is It Slow?" — The Master Flowchart

When a task executes in SQL Server, it moves between three scheduler states: **RUNNING** (actively executing on a CPU core), **RUNNABLE** (ready to execute but waiting for a CPU quantum — the thread is queued on the scheduler), and **SUSPENDED** (blocked on an external resource — disk I/O, a lock, a latch, network, or memory). A *wait* is recorded every time a task enters SUSPENDED or RUNNABLE. SQL Server accumulates these events in `sys.dm_os_wait_stats`, making the cumulative wait type distribution the single most informative signal about what is limiting throughput.

Start here when users report slowness or pipeline runs are taking longer than usual. The first step is always [wait statistics](https://alp78.github.io/elysium/04-SQL-Server/Performance/wait-stats-analysis): identify which wait type dominates by running the query below, then follow the corresponding branch of the flowchart to the specific resolution.

```text
                            ┌──────────────────────┐
                            │   "IT'S SLOW!"       │
                            └──────────┬───────────┘
                                       │
                            ┌──────────▼───────────┐
                            │ Check Wait Stats      │
                            │ (see query below)     │
                            └──────────┬───────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
    ┌─────────▼────────┐    ┌─────────▼────────┐    ┌─────────▼────────┐
    │ Top wait:        │    │ Top wait:        │    │ Top wait:        │
    │ PAGEIOLATCH_*    │    │ WRITELOG         │    │ LCK_M_*          │
    │ (Disk I/O)       │    │ (Log writes)     │    │ (Blocking)       │
    └─────────┬────────┘    └─────────┬────────┘    └─────────┬────────┘
              │                        │                        │
    ┌─────────▼────────┐    ┌─────────▼────────┐    ┌─────────▼────────┐
    │ Buffer pool hit  │    │ Check disk       │    │ Find the blocker │
    │ ratio < 99%?     │    │ latency for .ldf │    │ sp_who2          │
    └────┬────────┬────┘    └────┬────────┬────┘    │ or dm_exec_      │
      YES│        │NO         HIGH│      LOW│        │ requests         │
    ┌────▼────┐ ┌─▼────────┐ ┌───▼──────┐ ┌▼──────┐└────────┬─────────┘
    │ Add     │ │ Missing  │ │ Disk is  │ │ Too   │         │
    │ more    │ │ indexes? │ │ pd-      │ │ many  │  ┌──────▼─────────┐
    │ RAM     │ │ (scan    │ │ standard?│ │ small │  │ Long-running   │
    │         │ │ instead  │ │          │ │ trans-│  │ transaction?   │
    │ Upgrade │ │ of seek) │ │ Upgrade  │ │ action│  └──┬──────────┬──┘
    │ VM size │ │          │ │ to       │ │ COMMIT│   YES│          │NO
    └─────────┘ │ Run DMV: │ │ pd-ssd   │ │ more │  ┌───▼────┐ ┌──▼──────────┐
                │ missing  │ │ or pd-   │ │ often│  │ Kill   │ │ Lock        │
                │ indexes  │ │ balanced │ │      │  │ or wait│ │ escalation? │
                │ query    │ └──────────┘ └──────┘  │ for it │ │ Batch your  │
                └──────────┘                        └────────┘ │ deletes     │
                                                               └─────────────┘

              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
    ┌─────────▼────────┐    ┌─────────▼────────┐    ┌─────────▼────────┐
    │ Top wait:        │    │ Top wait:        │    │ Top wait:        │
    │ CXPACKET /       │    │ SOS_SCHEDULER_   │    │ MEMORY_          │
    │ CXCONSUMER       │    │ YIELD            │    │ ALLOCATION_EXT   │
    │ (Parallelism)    │    │ (CPU pressure)   │    │ (Memory)         │
    └─────────┬────────┘    └─────────┬────────┘    └─────────┬────────┘
              │                        │                        │
    ┌─────────▼────────┐    ┌─────────▼────────┐    ┌─────────▼────────┐
    │ Usually harmless │    │ Find CPU-heavy   │    │ Check max server │
    │ Check if MAXDOP  │    │ queries:         │    │ memory setting   │
    │ is set correctly │    │ dm_exec_query_   │    │                  │
    │                  │    │ stats sorted by  │    │ Page life        │
    │ MAXDOP = cores/2 │    │ total_worker_    │    │ expectancy < 300?│
    │ or cost threshold│    │ time             │    │                  │
    │ = 25-50          │    │                  │    │ → Add RAM or     │
    └──────────────────┘    │ → Add missing    │    │   reduce max     │
                            │   indexes        │    │   server memory  │
                            │ → Upgrade VM CPU │    │   to leave room  │
                            └──────────────────┘    │   for OS         │
                                                    └──────────────────┘
```

### Wait statistics diagnostic queries

The queries below support the flowchart: the first identifies which wait type dominates; the table maps each wait type to its root cause and resolution path.

#### sys.dm_os_wait_stats — the first query to run for slow pipelines

`sys.dm_os_wait_stats` is a server-scoped DMV (Dynamic Management View) that accumulates wait statistics for all completed waits since the SQL Server instance started or since the counters were last cleared with `DBCC SQLPERF('sys.dm_os_wait_stats', CLEAR)`. It captures waits that have already finished — for currently active waits, use `sys.dm_os_waiting_tasks`.

The four columns that matter for diagnosis:

- **`wait_time_ms`** — total elapsed wait time in milliseconds, *inclusive* of signal wait time. It is not a pure resource wait measure on its own.
- **`signal_wait_time_ms`** — time (ms) the thread spent in the RUNNABLE queue after the resource was granted but before it could get a CPU scheduler quantum. Signal waits measure CPU scheduling pressure, not I/O or lock contention. If `signal_wait_time_ms` exceeds 10–15% of `wait_time_ms` across all wait types, the server is CPU-bound.
- **Resource wait time** = `wait_time_ms - signal_wait_time_ms` — time the thread was actually SUSPENDED, blocked on a resource. This is the diagnostic column for all non-CPU bottlenecks.
- **`waiting_tasks_count`** — total number of times this wait type was entered. Divide `wait_time_ms` by `waiting_tasks_count` to compute the average wait duration per event, which distinguishes high-frequency short waits from rare catastrophic waits.

The `WHERE` clause below excludes benign system background waits — idle worker sleep loops, XE timer events, Service Broker internals, and HADR file stream operations — that would otherwise dominate the output without indicating a real workload bottleneck.

```sql
-- Top 10 wait types (filtered for noise)
SELECT TOP 10
    wait_type,
    wait_time_ms / 1000 AS wait_sec,
    (wait_time_ms - signal_wait_time_ms) / 1000 AS resource_wait_sec,
    signal_wait_time_ms / 1000 AS signal_wait_sec,
    waiting_tasks_count,
    CASE
        WHEN wait_type LIKE 'PAGEIOLATCH%' THEN '→ Disk I/O (buffer pool miss)'
        WHEN wait_type = 'WRITELOG' THEN '→ Log write latency'
        WHEN wait_type LIKE 'LCK_M%' THEN '→ Blocking (lock contention)'
        WHEN wait_type IN ('CXPACKET','CXCONSUMER') THEN '→ Parallelism (usually OK)'
        WHEN wait_type = 'SOS_SCHEDULER_YIELD' THEN '→ CPU pressure'
        WHEN wait_type LIKE 'MEMORY%' THEN '→ Memory pressure'
        WHEN wait_type = 'PAGELATCH_UP' THEN '→ tempdb contention'
        WHEN wait_type LIKE 'ASYNC_NETWORK%' THEN '→ Slow client consuming results'
        ELSE '→ Research this wait type'
    END AS diagnosis
FROM sys.dm_os_wait_stats
WHERE wait_type NOT IN (
    'CLR_SEMAPHORE','LAZYWRITER_SLEEP','RESOURCE_QUEUE','SQLTRACE_BUFFER_FLUSH',
    'WAITFOR','XE_TIMER_EVENT','CHECKPOINT_QUEUE','FT_IFTS_SCHEDULER_IDLE_WAIT',
    'SP_SERVER_DIAGNOSTICS_SLEEP','BROKER_TO_FLUSH','BROKER_TASK_STOP',
    'HADR_FILESTREAM_IOMGR_IOCOMPLETION','DIRTY_PAGE_POLL','SLEEP_TASK'
)
ORDER BY wait_time_ms DESC;
```

#### Wait type diagnosis — PAGEIOLATCH, LCK_M, CXPACKET resolution guide

Each wait type surfaces a specific bottleneck layer. `PAGEIOLATCH_SH` (shared) occurs on read operations: the buffer pool needs a data page that is not cached in RAM and must wait for the disk I/O to complete. `PAGEIOLATCH_EX` (exclusive) occurs on page modifications — typically sort spills to tempdb or bulk load operations. Both indicate the same root cause: insufficient buffer pool cache coverage, forcing disk reads. `WRITELOG` is distinct and applies only to transaction log writes (`.ldf` file), not data page I/O.

`CXPACKET` and `CXCONSUMER` are parallel query synchronization waits. `CXPACKET` is recorded on the query coordinator thread waiting for a parallel worker thread to finish its partition; `CXCONSUMER` is recorded on the worker threads consuming rows from another thread. These waits are benign when threads finish within milliseconds of each other, but indicate skew when one thread processes far more rows than others (often caused by a non-uniform partition key distribution).

| Wait Type | Root Cause | Resolution |
|---|---|---|
| `PAGEIOLATCH_SH / PAGEIOLATCH_EX` | Buffer pool miss — reading from disk because data isn't cached | Add RAM; add covering indexes to reduce scan volume; move to pd-ssd |
| `WRITELOG` | Transaction log write latency | Move .ldf to dedicated pd-ssd; reduce transaction frequency |
| `LCK_M_S / LCK_M_X / LCK_M_IX` | Lock contention — queries blocked on each other | Enable [RCSI](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/blocking-and-locking#read-committed-snapshot-isolation-rcsi); add indexes; shorten transactions |
| `CXPACKET / CXCONSUMER` | Parallel query thread skew | Check MAXDOP setting; set to `cores/2` or use cost threshold 25-50 |
| `SOS_SCHEDULER_YIELD` | CPU saturation | Find CPU-heavy queries via `dm_exec_query_stats`; add missing indexes |
| `MEMORY_ALLOCATION_EXT` | Memory pressure / pending grants | Check `max server memory`; check [PLE](https://alp78.github.io/elysium/04-SQL-Server/Performance/memory-and-buffer-pool#page-life-expectancy); add RAM |
| `PAGELATCH_UP` | TempDB contention on PFS/GAM/SGAM pages | Add TempDB data files = number of CPU cores |

---

## Flowchart 2: "Pipeline Failed" — Data Pipeline Troubleshooting

When an Airflow task fails with a SQL Server error, the failure almost always falls into one of six categories: connection or network failure (SQL Server unreachable), deadlock (SQL Server error 1205 — two sessions blocked each other and one was chosen as the victim), query timeout (the query ran longer than the pipeline's `command_timeout` setting), disk space exhaustion, authentication failure (error 18456), or data integrity constraint violation. Each category has a different first diagnostic step and a different resolution path.

Start here when an Airflow task turns red. Check the Airflow task logs first to identify the error class, then follow the corresponding branch.

```text
                            ┌──────────────────────┐
                            │  PIPELINE FAILED     │
                            │  (Airflow task red)   │
                            └──────────┬───────────┘
                                       │
                            ┌──────────▼───────────┐
                            │ Check Airflow task    │
                            │ logs first            │
                            └──────────┬───────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
    ┌─────────▼────────┐    ┌─────────▼────────┐    ┌─────────▼────────┐
    │ Connection       │    │ Deadlock /        │    │ Timeout          │
    │ refused / timeout│    │ error 1205        │    │ (query ran       │
    │                  │    │                   │    │  too long)       │
    └─────────┬────────┘    └─────────┬────────┘    └─────────┬────────┘
              │                        │                        │
    ┌─────────▼────────┐    ┌─────────▼────────┐    ┌─────────▼────────┐
    │ Is SQL Server    │    │ Which tables?     │    │ Check wait stats │
    │ running?         │    │ Check deadlock    │    │ during the run   │
    │                  │    │ graph in XEvents  │    │                  │
    │ sudo systemctl   │    │                   │    │ Was it blocking? │
    │ status mssql-    │    │ Fix: add retry    │    │ Was disk slow?   │
    │ server           │    │ logic to pipeline │    │ Missing index?   │
    │                  │    │ (see deadlocks)   │    │                  │
    │ Is IAP tunnel    │    │                   │    │ See "Why slow?"  │
    │ open?            │    │ Fix: reorder      │    │ flowchart above  │
    │                  │    │ operations to     │    │                  │
    │ Is VPC firewall  │    │ prevent deadlock  │    │ Consider:        │
    │ rule correct?    │    │ (ch 7.6)          │    │ - batch smaller  │
    └──────────────────┘    └──────────────────┘    │ - add indexes    │
                                                    │ - increase       │
                                                    │   timeout        │
                                                    └──────────────────┘
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
    ┌─────────▼────────┐    ┌─────────▼────────┐    ┌─────────▼────────┐
    │ Disk full        │    │ Login failed      │    │ Data integrity   │
    │                  │    │                   │    │ error            │
    └─────────┬────────┘    └─────────┬────────┘    └─────────┬────────┘
              │                        │                        │
    ┌─────────▼────────┐    ┌─────────▼────────┐    ┌─────────▼────────┐
    │ Which disk?      │    │ Wrong password?   │    │ Constraint       │
    │                  │    │ Account locked?   │    │ violation?       │
    │ .mdf full:       │    │ sa disabled?      │    │                  │
    │ → SHRINKFILE or  │    │                   │    │ Duplicate key?   │
    │   add .ndf       │    │ Check:            │    │ → MERGE logic    │
    │                  │    │ SELECT name,      │    │   needs fixing   │
    │ .ldf full:       │    │ is_disabled       │    │                  │
    │ → BACKUP LOG     │    │ FROM sys.server_  │    │ NULL violation?  │
    │   then SHRINKFILE│    │ principals        │    │ → Source data    │
    │                  │    │                   │    │   quality issue  │
    │ OS disk full:    │    │ Check error log:  │    │                  │
    │ → Clean logs,    │    │ /var/opt/mssql/   │    │ FK violation?    │
    │   old backups    │    │ log/errorlog      │    │ → Load order     │
    └──────────────────┘    └──────────────────┘    │   wrong (load    │
                                                    │   parent first)  │
                                                    └──────────────────┘
```

### Connection and authentication failure diagnostics

The commands and queries below support the left and center branches of the flowchart: verifying SQL Server is running and reachable, and diagnosing login failures.

#### nc, ss, gcloud firewall-rules — connection refused/timeout quick checks

A "connection refused" or "connection timeout" error means the pipeline's network path to SQL Server is broken at one of three layers: the SQL Server process is not running, the IAP tunnel is not open, or a VPC firewall rule is blocking port 1433.

**IAP (Identity-Aware Proxy) tunnel** is a GCP service that creates an authenticated, encrypted TCP tunnel from a local port on the connecting machine to a private GCP VM's port, without requiring a public IP address or VPN. SQL Server on GCP runs on a private VM (no external IP); the IAP tunnel maps `localhost:1433` on the Airflow worker or developer machine to the VM's internal `1433` port. If the tunnel is not open or was disconnected, all connections fail immediately with "connection refused."

```bash
# Is SQL Server running?
sudo systemctl status mssql-server

# Restart if stopped
sudo systemctl start mssql-server

# Is the IAP tunnel open? (if connecting remotely)
gcloud compute start-iap-tunnel analytics-sql-01 1433 --local-host-port=localhost:1433 --zone=europe-west1-b
```

#### sys.sql_logins is_disabled — login failed, check disabled accounts

"Login failed" errors surface as SQL Server error **18456**. The two most common causes are a disabled login (`is_disabled = 1`) and a locked-out SQL login after repeated failed authentication attempts. `sys.server_principals` covers all server-level principals — both SQL logins and Windows accounts. `xp_readerrorlog` is an extended stored procedure that reads directly from the SQL Server error log file on disk; it always captures login failures with the exact login name, timestamp, and source IP, even when Windows Event Log access is restricted.

```sql
-- Check if login is disabled
SELECT name, is_disabled, is_locked_out
FROM sys.server_principals
WHERE name = 'your_login_name';

-- Check recent login failures in the error log
EXEC xp_readerrorlog 0, 1, N'Login failed';
```

### Data integrity failure diagnostics

#### Data integrity errors — duplicate key, constraint violation, type mismatch

Constraint violations surface in Airflow logs as specific SQL Server error numbers: **2627** (unique key constraint — a row with this key already exists), **547** (foreign key or check constraint violation — the referenced parent row doesn't exist, or the value fails a `CHECK` predicate), **515** (NOT NULL constraint — the source column contains `NULL` in a column defined as `NOT NULL`). Identifying the error number narrows the diagnosis immediately.

- **Duplicate key:** The MERGE or INSERT logic doesn't properly handle existing rows. See [merge-and-upsert](https://alp78.github.io/elysium/04-SQL-Server/T-SQL/merge-and-upsert).
- **NULL constraint violation:** Source data has NULLs in a NOT NULL column. Add validation in the bronze loader.
- **FK violation:** Load parent tables before child tables. Bronze layer should load `stock_dim` before `daily_ohlcv`.

---

## Flowchart 3: "Should I Add an Index?" — Index Decision Tree

Adding an index is not always the right answer to a slow query. Every index improves read performance for the specific access pattern it covers, but adds write overhead to every `INSERT`, `UPDATE`, and `DELETE` on that table — SQL Server must update the index B-tree structure on every row modification. For a table with frequent writes and many indexes, the cumulative maintenance cost can slow down the entire pipeline.

The decision hinges on the execution plan operator: a **table scan** or **clustered index scan** reads every row in the table; a **nonclustered index seek** jumps directly to matching rows via the B-tree; a **key lookup** occurs when an index seek finds matching rows but the query also needs columns not included in the index, forcing an additional access back to the clustered index per row.

Use this flowchart when a query is identified as slow and you want to determine whether an index would help, or whether the bottleneck is elsewhere (RAM shortage, blocking, or a plan regression).

```text
                     ┌──────────────────────────┐
                     │ Query is slow. Should I   │
                     │ add an index?             │
                     └────────────┬──────────────┘
                                  │
                     ┌────────────▼──────────────┐
                     │ Check execution plan:      │
                     │ Is there a TABLE SCAN or   │
                     │ CLUSTERED INDEX SCAN?      │
                     └────────┬───────────┬──────┘
                           YES│           │NO
                     ┌────────▼────────┐  │
                     │ How many rows   │  │
                     │ does the scan   │  ┌────────▼────────┐
                     │ return vs total?│  │ Already using   │
                     └───┬─────────┬───┘  │ an index seek?  │
                     <5% │         │>30%  │                 │
                  ┌──────▼──────┐ │      │ Check for KEY   │
                  │ YES: create │ │      │ LOOKUP in plan  │
                  │ nonclustered│ │      └──┬──────────┬───┘
                  │ index on    │ │       YES│          │NO
                  │ WHERE cols  │ │  ┌──────▼──────┐   │
                  └─────────────┘ │  │ Add INCLUDE │   │
                                  │  │ columns to  │ ┌─▼────────────┐
                     ┌────────────▼┐ │ make it     │ │ Query is     │
                     │ Scan is OK: │ │ covering    │ │ already      │
                     │ most of the │ └─────────────┘ │ optimal.     │
                     │ table is    │                  │ Problem is   │
                     │ needed.     │                  │ elsewhere.   │
                     │             │                  │ Check RAM,   │
                     │ Consider:   │                  │ disk, locks. │
                     │ • Columnstore│                 └──────────────┘
                     │   for analytics
                     │ • Partitioning
                     │   for date ranges
                     └─────────────┘

  BEFORE CREATING: check existing indexes!
  ┌─────────────────────────────────────────────────────┐
  │ • Is there already an index on these columns?       │
  │   → Maybe just add INCLUDE columns to it            │
  │ • Will this index slow down writes?                 │
  │   → Each index adds overhead to INSERT/UPDATE/DELETE│
  │ • Is this a one-time query or a repeated pattern?   │
  │   → Don't index for ad-hoc queries                  │
  │ • Table has < 1000 rows?                            │
  │   → Scan is fine, don't bother indexing             │
  └─────────────────────────────────────────────────────┘
```

### Index analysis queries

The two queries below support the decision tree: the first surfaces the optimizer's index suggestions ranked by expected benefit; the second identifies existing indexes that consume write overhead but are never accessed for reads.

#### sys.dm_db_missing_index_details — quick index checks

`sys.dm_db_missing_index_details` records index suggestions generated by the query optimizer during plan compilation. It does not proactively scan tables — it only captures suggestions for queries that have actually executed. The suggestions reset on SQL Server restart and are not persisted to disk (SQL Server 2022 can persist them to Query Store).

The `improvement_measure` expression (`avg_total_user_cost × avg_user_impact × (user_seeks + user_scans)`) is a composite priority score with three factors:

- **`avg_total_user_cost`** — optimizer-estimated cost of the affected queries *without* the index (in optimizer cost units). Higher means more expensive queries.
- **`avg_user_impact`** — estimated percentage cost reduction if the index were created (e.g., `80.0` means queries would cost approximately 80% less). Range: 0–100.
- **`(user_seeks + user_scans)`** — total number of times the optimizer determined this index could have been used. Multiplies the benefit by frequency.

The product has no absolute unit — it is only meaningful relative to other rows in the same result set, sorted descending to rank candidates by expected total benefit. Treat suggestions with `improvement_measure < 10` as negligible.

The second query identifies *zombie indexes*: indexes with high `user_updates` (write overhead on every INSERT/UPDATE/DELETE) but zero `user_seeks` and `user_scans` (never used for reads). These are candidates for removal after verifying they are not required for uniqueness constraints.

```sql
-- What does the optimizer think is missing?
SELECT TOP 10
    migs.avg_total_user_cost * migs.avg_user_impact * (migs.user_seeks + migs.user_scans) AS improvement_measure,
    mid.statement AS table_name,
    mid.equality_columns,
    mid.inequality_columns,
    mid.included_columns
FROM sys.dm_db_missing_index_details mid
JOIN sys.dm_db_missing_index_groups mig ON mid.index_handle = mig.index_handle
JOIN sys.dm_db_missing_index_group_stats migs ON mig.index_group_handle = migs.group_handle
WHERE mid.database_id = DB_ID()
ORDER BY improvement_measure DESC;

-- Is the existing index being used or just wasting write overhead?
SELECT
    OBJECT_NAME(s.object_id) AS table_name,
    i.name AS index_name,
    s.user_seeks,
    s.user_scans,
    s.user_lookups,
    s.user_updates  -- write overhead
FROM sys.dm_db_index_usage_stats s
JOIN sys.indexes i ON s.object_id = i.object_id AND s.index_id = i.index_id
WHERE s.database_id = DB_ID()
  AND OBJECTPROPERTY(s.object_id, 'IsUserTable') = 1
  AND s.user_seeks = 0
  AND s.user_scans = 0
ORDER BY s.user_updates DESC;
-- user_seeks=0, user_scans=0, high user_updates = index never used but slowing writes
```

---

## Flowchart 4: "Disk Space Emergency" — Storage Recovery

SQL Server uses three distinct storage spaces, each with its own growth behavior and recovery procedure:

- **Data files** (`.mdf` primary + `.ndf` secondary): store tables, indexes, and all user data. Grow as rows are inserted; space is only reclaimed by deleting rows and running `DBCC SHRINKFILE`, or by adding a secondary `.ndf` file on a different disk.
- **Transaction log file** (`.ldf`): records every data modification for crash recovery, point-in-time restore, and replication. The log grows when SQL Server cannot truncate (reuse) its inactive portion — most commonly because log backups are not being taken under the FULL recovery model, or because an active transaction holds old log records open.
- **OS disk**: hosts the SQL Server binaries, error logs, temporary files, and apt/yum cache. Exhaustion here does not directly block SQL Server writes to data/log files, but can prevent error log rotation and cause `sp_cycle_errorlog` failures.

Diagnosing which file or disk is full is always the first step — the resolution for each is completely different.

```text
                     ┌──────────────────────────┐
                     │ ALERT: Disk space low    │
                     │ or database cannot grow  │
                     └────────────┬──────────────┘
                                  │
                     ┌────────────▼──────────────┐
                     │ Which file is full?        │
                     │ SELECT * FROM              │
                     │ sys.database_files          │
                     └───┬────────────┬──────┬───┘
                         │            │      │
              ┌──────────▼──┐  ┌─────▼────┐ ┌▼───────────────┐
              │ .mdf data   │  │ .ldf log │ │ OS disk /      │
              │ file full   │  │ file full│ │ root partition │
              └──────┬──────┘  └────┬─────┘ └───────┬────────┘
                     │              │                │
              ┌──────▼──────┐ ┌────▼──────────┐ ┌───▼────────────┐
              │ 1. Check for│ │ Recovery model│ │ Clean up:      │
              │    unused   │ │ is FULL and   │ │ - Old backups  │
              │    indexes  │ │ log not backed│ │ - SQL errorlogs│
              │    (drop)   │ │ up?           │ │ - /tmp files   │
              │             │ │               │ │ - Apt cache    │
              │ 2. Rebuild  │ │ YES → BACKUP  │ │                │
              │    indexes  │ │ LOG, then     │ │ sp_cycle_      │
              │    (reclaim)│ │ SHRINKFILE    │ │ errorlog to    │
              │             │ │               │ │ rotate logs    │
              │ 3. Archive  │ │ NO → Check    │ │                │
              │    old data │ │ for long-     │ │ Extend disk:   │
              │    (DELETE  │ │ running       │ │ gcloud compute │
              │    + SHRINK)│ │ transaction   │ │ disks resize   │
              │             │ │ holding log   │ │ + growpart +   │
              │ 4. Add .ndf │ │ open          │ │ resize2fs/     │
              │    file on  │ │               │ │ xfs_growfs     │
              │    new disk │ │ KILL the      │ └────────────────┘
              └─────────────┘ │ session or    │
                              │ wait for it   │
                              └───────────────┘
```

### Data file recovery

When the `.mdf` or an `.ndf` file is full, SQL Server cannot allocate new pages and all `INSERT` and `UPDATE` operations fail with error 1105 ("Could not allocate space"). Options: add a secondary `.ndf` file on a different disk (preferred — no fragmentation), run `DBCC SHRINKFILE` to reclaim allocated-but-empty space inside the file (a last resort — causes index fragmentation), or archive and delete old data then reclaim space.

#### ALTER DATABASE MODIFY FILE — data file (.mdf) full, grow or add files

SQL Server stores all data in 8 KB pages grouped into 64 KB extents. `sys.database_files` reports file sizes in *pages* (8 KB each) — the query below converts to MB by multiplying by `8/1024`. The three derived columns show: `size_mb` (total disk space allocated to the file), `used_mb` (space occupied by actual data pages), and `free_mb` (allocated space inside the file not yet used by data — `DBCC SHRINKFILE` can reclaim this). If `free_mb ≈ 0` and `size_mb` is at the disk limit, you must either add a new `.ndf` file on a different disk or expand the underlying disk volume.

```sql
-- Check file sizes and free space
SELECT
    name,
    size * 8 / 1024 AS size_mb,
    FILEPROPERTY(name, 'SpaceUsed') * 8 / 1024 AS used_mb,
    (size - FILEPROPERTY(name, 'SpaceUsed')) * 8 / 1024 AS free_mb
FROM sys.database_files
WHERE type_desc = 'ROWS';

-- Add a secondary data file (.ndf) on a different disk to expand data capacity
ALTER DATABASE analytics_db ADD FILE (
    NAME = 'analytics_data2',
    FILENAME = '/data2/analytics_data2.ndf',
    SIZE = 10240MB,
    FILEGROWTH = 1024MB
);
```

### Log file recovery

When the `.ldf` log file is full, all write operations fail with error 9002 ("The transaction log for database is full"). The log cannot be truncated (its inactive portion reused) until the specific impediment recorded in `log_reuse_wait_desc` is resolved. Taking a log backup alone does not always fix it — you must address the root cause first.

#### BACKUP LOG, DBCC SHRINKFILE — log file (.ldf) full recovery

`log_reuse_wait_desc` in `sys.databases` reports what is preventing log truncation at the last checkpoint. Key values:

- **`LOG_BACKUP`**: under the FULL recovery model, the log cannot truncate until a log backup is taken. The log grows indefinitely between backups. Fix: take a `BACKUP LOG` immediately, then schedule log backups every 15 minutes going forward.
- **`ACTIVE_TRANSACTION`**: an open or deferred transaction spans log records that cannot be discarded. The log grows until the transaction commits or rolls back, regardless of how many log backups are taken. Use `DBCC OPENTRAN` to find the oldest active transaction and its `session_id`, then either wait for it to complete or kill it with `KILL <session_id>`.
- **`CHECKPOINT`**: transient — a checkpoint has not yet occurred since the last truncation point. Resolves automatically within seconds. If it persists, run `CHECKPOINT` manually.
- **`REPLICATION`**: the Log Reader Agent (transactional replication) or CDC log reader has not consumed log records up to the truncation point. The agent must be running and caught up. Log backups alone will not free space.
- **`AVAILABILITY_REPLICA`**: an Always On AG secondary replica has not applied log records up to the truncation point. Check replica synchronization lag.
- **`XTP_CHECKPOINT`**: an In-Memory OLTP (Hekaton) checkpoint is required — triggered when the log has grown more than 1.5 GB since the last XTP checkpoint. SQL Server 2014+.

```sql
-- Check why the log cannot be reused
SELECT log_reuse_wait_desc FROM sys.databases WHERE name = 'analytics_db';
-- LOG_BACKUP = waiting for a log backup → BACKUP LOG to free space
-- ACTIVE_TRANSACTION = open transaction holding the log → find and kill it

-- Take a log backup to free log space
BACKUP LOG analytics_db TO DISK = '/var/opt/mssql/backup/mydb_log_emergency.bak';

-- After the backup, shrink the log file (only if it's unusually large)
USE analytics_db;
DBCC SHRINKFILE (mydb_log, 1024);  -- shrink to 1 GB minimum
```

> [!warning] SHRINKFILE Is a Last Resort
>
> Shrinking and then letting the log grow again causes log file fragmentation. The correct long-term fix is to take log backups regularly (every 15 minutes for FULL recovery model) to prevent the log from growing in the first place. See [backup-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/Administration/backup-types-and-strategy).

> [!success] Safe Pattern — Scheduled Log Backups Prevent Growth
>
> Configure a SQL Server Agent job (or Airflow DAG) to run `BACKUP LOG analytics_db TO DISK = '...'` every 15 minutes under the FULL recovery model. This keeps the active log portion small and eliminates emergency SHRINKFILE situations. Right-size the initial `.ldf` allocation to the expected steady-state size so it never needs to auto-grow under load.

### OS disk cleanup

#### du, find, journalctl — OS disk full Linux cleanup

When the OS disk (typically `/dev/sda1`, mounted at `/`) is full, SQL Server may still write to its data and log files (if they live on a separate disk), but cannot write new error log entries or create temporary files. The most common OS disk consumers on a SQL Server Linux host are: accumulated SQL Server error logs under `/var/opt/mssql/log/`, OS package cache (`/var/cache/apt/`), and large files in `/tmp`. Run `du` to identify the top consumers before deleting anything.

```bash
# Find large files consuming OS disk
du -sh /var/opt/mssql/log/*
du -sh /var/log/*
du -sh /tmp/*

# Rotate SQL Server error logs (creates a new log file, archives the old one)
# Run from sqlcmd or SSMS:
# EXEC sp_cycle_errorlog;

# Apt cache cleanup
sudo apt-get clean

# Extend the OS disk without downtime (GCP persistent disk supports online resize)
gcloud compute disks resize analytics-sql-root --size=100 --zone=europe-west1-b
# Then extend the partition and filesystem (while online):
sudo growpart /dev/sda 1
sudo resize2fs /dev/sda1       # ext4
# sudo xfs_growfs /             # XFS
```

---

### Related

- [wait-stats-analysis](https://alp78.github.io/elysium/04-SQL-Server/Performance/wait-stats-analysis) — full wait type reference with diagnostic queries
- [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/Performance/performance-audit-playbook) — systematic 11-phase audit covering all dimensions of performance
- [blocking-and-locking](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/blocking-and-locking) — diagnosing and resolving LCK_M_* waits
- [deadlock-detection-and-prevention](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/deadlock-detection-and-prevention) — error 1205 handling, retry logic, prevention patterns
- [index-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/index-types-and-strategy) — comprehensive index selection and creation guide
- [index-maintenance](https://alp78.github.io/elysium/04-SQL-Server/Performance/index-maintenance) — fragmentation analysis and scheduled rebuild/reorganize
- [memory-and-buffer-pool](https://alp78.github.io/elysium/04-SQL-Server/Performance/memory-and-buffer-pool) — PLE, buffer cache hit ratio, and memory clerk analysis
- [backup-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/Administration/backup-types-and-strategy) — log backup strategy to prevent .ldf from filling up
