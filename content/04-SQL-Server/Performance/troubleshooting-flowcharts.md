---
type: reference
category: sql-server
technology: [sql-server]
tags: [sql, sql-server, tsql]
aliases: [SQL Server troubleshooting, why is it slow, pipeline failed, disk space emergency, should I add an index, decision tree, troubleshooting guide]
keywords: [troubleshooting, flowchart, PAGEIOLATCH, WRITELOG, LCK_M, blocking, deadlock, disk full, slow query, pipeline failed, index decision, CXPACKET, SOS_SCHEDULER_YIELD, MEMORY_ALLOCATION_EXT, buffer pool, pd-standard, pd-ssd, mdf full, ldf full, SHRINKFILE, BACKUP LOG, connection refused, login failed, constraint violation, wait stats, dm_os_wait_stats]
description: "Visual troubleshooting flowcharts for SQL Server: diagnosing slowness via wait stats, pipeline failure root cause analysis, the index decision tree, and disk space emergency recovery steps."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Troubleshooting Flowcharts

> [!quote]
> "The most effective debugging tool is still careful thought, coupled with judiciously placed print statements."
> — **Brian Kernighan**, *Unix for Beginners* (1979)

Four decision trees for the most common SQL Server problems: slowness, pipeline failures, indexing decisions, and disk space emergencies. Start with the relevant flowchart, then follow references to deeper notes for each resolution path. To practice applying these flowcharts to realistic scenarios, work through [sql-server-problems](https://alp78.github.io/elysium/04-SQL-Server/sql-server-problems).

---

## Flowchart 1: "Why Is It Slow?" — The Master Flowchart

Start here when users report slowness or pipeline runs are taking longer than usual. The first step is always [wait statistics](https://alp78.github.io/elysium/04-SQL-Server/Performance/wait-stats-analysis).

```
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

#### sys.dm_os_wait_stats — the first query to run for slow pipelines

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

Start here when an Airflow task turns red.

```
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

#### nc, ss, gcloud firewall-rules — connection refused/timeout quick checks

```bash
# Is SQL Server running?
sudo systemctl status mssql-server

# Restart if stopped
sudo systemctl start mssql-server

# Is the IAP tunnel open? (if connecting remotely)
gcloud compute start-iap-tunnel analytics-sql-01 1433 --local-host-port=localhost:1433 --zone=europe-west1-b
```

#### sys.sql_logins is_disabled — login failed, check disabled accounts

```sql
-- Check if login is disabled
SELECT name, is_disabled, is_locked_out
FROM sys.server_principals
WHERE name = 'your_login_name';

-- Check recent login failures in the error log
EXEC xp_readerrorlog 0, 1, N'Login failed';
```

#### Data integrity errors — duplicate key, constraint violation, type mismatch

- **Duplicate key:** The MERGE or INSERT logic doesn't properly handle existing rows. See [merge-and-upsert](https://alp78.github.io/elysium/04-SQL-Server/T-SQL/merge-and-upsert).
- **NULL constraint violation:** Source data has NULLs in a NOT NULL column. Add validation in the bronze loader.
- **FK violation:** Load parent tables before child tables. Bronze layer should load `stock_dim` before `daily_ohlcv`.

---

## Flowchart 3: "Should I Add an Index?" — Index Decision Tree

```
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

#### sys.dm_db_missing_index_details — quick index checks

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

```
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

#### ALTER DATABASE MODIFY FILE — data file (.mdf) full, grow or add files

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

#### BACKUP LOG, DBCC SHRINKFILE — log file (.ldf) full recovery

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

#### du, find, journalctl — OS disk full Linux cleanup

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
