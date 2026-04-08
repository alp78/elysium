---
title: "Essential DBA Queries"
tags:
  - sql-server
  - administration
  - dba
aliases:
  - SQL Server health check queries
  - SQL Server production triage queries
  - DBA query pack
description: "Production-facing SQL Server queries for server identity, database state, files, active requests, waits, backups, and capacity checks, with live output from the stoxx instance."
parent: "[[domain-server-operations]]"
links:
  - "[[server-configuration]]"
  - "[[backup-types-and-strategy]]"
  - "[[restore-and-recovery]]"
  - "[[sql-server-agent-jobs]]"
  - "[[sqlcmd-connection-and-usage]]"
  - "[[memory-and-buffer-pool]]"
  - "[[wait-stats-analysis]]"
  - "[[execution-plans]]"
created: 2026-04-08
updated: 2026-04-08
status: complete
---

# Essential DBA Queries

This note is the production query pack for first-response SQL Server administration. The goal is not to show every DMV in the product. The goal is to give a short set of queries that answer the operational questions a DBA needs first: what server this is, what databases exist, whether files and logs are healthy, what is running now, what has been waiting, and whether backups have actually happened.

All result tables in this note were captured from the current `stoxx` instance:

- SQL Server 2022 CU23
- Developer Edition
- Linux container on Ubuntu 22.04.5 LTS
- current date: April 8, 2026

---

## Baseline

Start with identity and scope. Before changing anything, confirm the exact build, edition, host, clustering state, HA state, and database inventory on the instance you are looking at.

### Server Identity

This subsection answers a simple but critical operational question: which server am I actually connected to, and what engine am I dealing with?

#### Engine build, edition, host, and clustering state

[!info]-
This query returns two result sets.

- The first result set returns `@@VERSION`, which is the raw version banner emitted by the engine. It includes the SQL Server major version, cumulative update, build number, edition, platform, and OS distribution string.
- The second result set breaks the same identity information into structured fields using `SERVERPROPERTY(...)`, which is the better format for dashboards, runbooks, and automated checks.
- `product_version`, `product_level`, and `cu_level` identify the exact build you are troubleshooting.
- `edition` and `engine_edition` identify licensing and product family. `EngineEdition = 3` means a boxed SQL Server instance, not Azure SQL Database or Managed Instance.
- `collation` matters for string comparison behavior and cross-database interoperability.
- `is_clustered` and `is_hadr` tell you whether Windows failover clustering or Always On availability groups are in play.
- `server_name` and `physical_host` help verify whether you connected to the intended instance and host.

*This query establishes the exact SQL Server build, edition, platform, and HA posture of the instance before any deeper diagnostics.*

```sql
SELECT @@VERSION AS version_string;

SELECT
    SERVERPROPERTY('ProductVersion') AS product_version,
    SERVERPROPERTY('ProductLevel') AS product_level,
    SERVERPROPERTY('ProductUpdateLevel') AS cu_level,
    SERVERPROPERTY('Edition') AS edition,
    SERVERPROPERTY('EngineEdition') AS engine_edition,
    SERVERPROPERTY('Collation') AS collation,
    SERVERPROPERTY('IsClustered') AS is_clustered,
    SERVERPROPERTY('IsHadrEnabled') AS is_hadr,
    SERVERPROPERTY('ServerName') AS server_name,
    SERVERPROPERTY('ComputerNamePhysicalNetBIOS') AS physical_host;
```

| version_string |
|---|
| Microsoft SQL Server 2022 (RTM-CU23) (KB5078297) - 16.0.4236.2 (X64) Jan 22 2026 17:50:56 Copyright (C) 2022 Microsoft Corporation Developer Edition (64-bit) on Linux (Ubuntu 22.04.5 LTS) \<X64\> |

<!-- result-set-separator -->

| product_version | product_level | cu_level | edition | engine_edition | collation | is_clustered | is_hadr | server_name | physical_host |
|---|---|---|---|---:|---|---:|---:|---|---|
| 16.0.4236.2 | RTM | CU23 | Developer Edition (64-bit) | 3 | SQL_Latin1_General_CP1_CI_AS | 0 | 0 | 9b9b89176e4b | 8482aae8ad0a |

*This instance is SQL Server 2022 CU23 on Linux, running Developer Edition. `engine_edition = 3` confirms a regular SQL Server engine, not Azure SQL Database or Managed Instance. `is_clustered = 0` and `is_hadr = 0` mean there is no Windows failover cluster and no Always On availability group configured on this instance, so recovery and failover procedures must be evaluated as standalone-instance operations unless another HA layer exists outside SQL Server.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `product_level` | `RTM` + current `cu_level` populated | &#9989; | Base release with cumulative update layering | Check `cu_level`, not `product_level` alone, to know patch currency |
| `cu_level` | `CU23` | &#9989; | Current cumulative update level reported by the engine | The instance is patched well beyond early SQL Server 2022 builds |
| `engine_edition` | `3` | &#9989; | Standalone SQL Server engine family | Normal on-prem or IaaS SQL Server behavior applies |
| `engine_edition` | `5`, `8` | &#10060; in this context | Azure SQL Database or Managed Instance families | T-SQL surface, HA, and operational assumptions differ |
| `is_clustered` | `0` | &#9989; for this instance | Not part of a WSFC cluster | No cluster-managed failover path exists here |
| `is_clustered` | `1` | Context dependent | Instance is cluster-aware | File placement, service ownership, and failover procedures must account for clustering |
| `is_hadr` | `0` | &#9989; for this instance | Availability Groups are not enabled | AG backup offload and replica-based recovery procedures do not apply |
| `is_hadr` | `1` | Context dependent | Availability Groups feature is enabled | Check replica topology, preferred backup replica, and failover mode |

### Database Inventory

This subsection answers which databases exist, what recovery models they use, whether snapshot-based read semantics are enabled, and what currently prevents log reuse.

#### Database state, recovery model, compatibility level, and log reuse blockers

[!info]-
This query reads `sys.databases`, which is the instance-wide catalog view for database metadata.

- `database_id` identifies each database internally.
- `state_desc` shows whether the database is online and usable.
- `recovery_model_desc` determines log-backup behavior and point-in-time restore capability.
- `compatibility_level` controls optimizer and language-surface behavior for the database.
- `is_read_committed_snapshot_on` shows whether read committed uses row versioning instead of shared locks.
- `is_cdc_enabled` confirms whether Change Data Capture is enabled.
- `log_reuse_wait_desc` explains why the transaction log cannot currently truncate reusable VLFs.
- `create_date` helps identify recently created databases, tempdb recreation, or lab residue.

*This query inventories every database on the instance and surfaces the recovery, compatibility, snapshot-isolation, CDC, and transaction-log reuse state that drive backup, restore, and concurrency behavior.*

```sql
SELECT
    database_id,
    name,
    state_desc,
    recovery_model_desc,
    compatibility_level,
    is_read_committed_snapshot_on,
    is_cdc_enabled,
    log_reuse_wait_desc,
    create_date
FROM sys.databases
ORDER BY name;
```

| database_id | name | state_desc | recovery_model_desc | compatibility_level | is_read_committed_snapshot_on | is_cdc_enabled | log_reuse_wait_desc | create_date |
|---:|---|---|---|---:|---:|---:|---|---|
| 1 | master | ONLINE | SIMPLE | 160 | 0 | 0 | NOTHING | 2003-04-08 09:13:36.390 |
| 3 | model | ONLINE | FULL | 160 | 0 | 0 | NOTHING | 2003-04-08 09:13:36.390 |
| 4 | msdb | ONLINE | SIMPLE | 160 | 0 | 0 | NOTHING | 2026-01-22 20:22:25.730 |
| 5 | stoxx | ONLINE | FULL | 160 | 0 | 0 | ACTIVE_TRANSACTION | 2026-03-04 22:11:32.887 |
| 2 | tempdb | ONLINE | SIMPLE | 160 | 0 | 0 | NOTHING | 2026-04-08 08:42:36.190 |

*The instance is simple from an administrative standpoint: all databases are online, all are already at compatibility level 160, and CDC is disabled everywhere. The meaningful production signal is `stoxx`: it is in `FULL` recovery model and its current `log_reuse_wait_desc` is `ACTIVE_TRANSACTION`, which means the log is not waiting for a backup at this moment but is being held open by at least one active transaction. `is_read_committed_snapshot_on = 0` across the instance means reader-writer blocking protection through RCSI is not currently enabled in any of these databases.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `state_desc` | `ONLINE` | &#9989; | Database is accessible and usable | Normal operating state |
| `state_desc` | `RESTORING`, `RECOVERING`, `RECOVERY_PENDING`, `SUSPECT`, `OFFLINE` | &#10060; | Database is unavailable, incomplete, or damaged | Recovery or incident handling is required before normal workload use |
| `recovery_model_desc` | `FULL` | Context dependent | Log backups supported and required for PITR | Pair with scheduled log backups and log-chain monitoring |
| `recovery_model_desc` | `SIMPLE` | Context dependent | Log truncates at checkpoint; no log backups | Suitable for reproducible or low-RPO databases only |
| `recovery_model_desc` | `BULK_LOGGED` | Watch carefully | Minimal logging for some bulk operations | PITR is limited for log backups containing bulk-logged changes |
| `compatibility_level` | `160` | &#9989; | SQL Server 2022 compatibility behavior | Latest optimizer surface for SQL Server 2022 |
| `is_read_committed_snapshot_on` | `0` | Watch | Classic read committed locking semantics | Reader-writer blocking is still possible |
| `is_read_committed_snapshot_on` | `1` | &#9989; for OLTP/reporting concurrency | Read committed uses row versioning | Readers no longer take shared locks against writers |
| `is_cdc_enabled` | `0` | Context dependent | CDC not enabled | Downstream change harvesting must use other patterns |
| `is_cdc_enabled` | `1` | Context dependent | CDC enabled | Check capture and cleanup jobs and retention |
| `log_reuse_wait_desc` | `NOTHING` | &#9989; | No current blocker to log reuse | Normal healthy state |
| `log_reuse_wait_desc` | `ACTIVE_TRANSACTION` | Watch | One or more transactions still hold log space | Investigate open transactions before shrinking or blaming backups |
| `log_reuse_wait_desc` | `LOG_BACKUP` | &#10060; under FULL/BULK_LOGGED | Log backup is required before reuse | Usually indicates missing or failing log backup cadence |

### Storage Footprint

This subsection answers how large databases and files are, where growth pressure is likely to hit first, and whether tempdb was configured with the usual equal-size multi-file pattern.

#### Database sizes by data file, log file, and total footprint

[!info]-
This query aggregates `sys.master_files` at the database level.

- `data_size_mb` sums all row-data files (`type = 0`).
- `log_size_mb` sums all transaction log files (`type = 1`).
- `total_size_mb` is the combined allocated size, not used space.
- This is an allocation view, not a logical row-count or used-space view. It tells you how much storage SQL Server currently owns on disk.

*This query summarizes the allocated data-file and log-file footprint of every database so you can identify where storage pressure will show up first.*

```sql
SELECT
    d.name AS database_name,
    CAST(SUM(CASE WHEN mf.type = 0 THEN mf.size END) * 8.0 / 1024 AS decimal(12,2)) AS data_size_mb,
    CAST(SUM(CASE WHEN mf.type = 1 THEN mf.size END) * 8.0 / 1024 AS decimal(12,2)) AS log_size_mb,
    CAST(SUM(mf.size) * 8.0 / 1024 AS decimal(12,2)) AS total_size_mb
FROM sys.databases AS d
JOIN sys.master_files AS mf
    ON mf.database_id = d.database_id
GROUP BY d.name
ORDER BY total_size_mb DESC;
```

| database_name | data_size_mb | log_size_mb | total_size_mb |
|---|---:|---:|---:|
| stoxx | 712.00 | 968.00 | 1680.00 |
| tempdb | 64.00 | 8.00 | 72.00 |
| msdb | 15.31 | 1.25 | 16.56 |
| model | 8.00 | 8.00 | 16.00 |
| master | 4.69 | 2.00 | 6.69 |

*`stoxx` dominates the instance footprint at 1.64 GB allocated, and its log is larger than its data allocation. That is not automatically a problem, but it means log-management discipline matters more here than raw data-file growth. `tempdb` is modest in current allocated size, so tempdb contention would be a concurrency design problem rather than a pure file-size problem on this instance right now.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `data_size_mb` | Larger than `log_size_mb` | Common | Data footprint exceeds log footprint | Typical for steady-state OLTP or analytics databases |
| `log_size_mb` | Larger than `data_size_mb` | Watch | Log allocation exceeds data allocation | Check recovery model, backup cadence, and long transactions |
| `total_size_mb` | Rising steadily with stable row counts | Watch | Space is being allocated faster than data growth explains | Check log reuse, index maintenance, or fragmentation side effects |

#### TempDB file layout and growth settings

[!info]-
This query reads `tempdb.sys.database_files`, which is the current registered file layout for tempdb.

- `file_id` identifies each file within tempdb.
- `type_desc` distinguishes data files from the log file.
- `size_mb` converts SQL Server's 8 KB page count into megabytes.
- `growth` and `is_percent_growth` show whether autogrowth is fixed-size or percentage-based.
- The main thing to look for is equal-size data files with fixed-size growth increments.

*This query verifies tempdb file count, file sizes, and autogrowth behavior so you can spot misaligned or percentage-growth tempdb layouts immediately.*

```sql
SELECT
    file_id,
    name,
    type_desc,
    physical_name,
    CAST(size * 8.0 / 1024 AS decimal(12,2)) AS size_mb,
    growth,
    is_percent_growth
FROM tempdb.sys.database_files
ORDER BY file_id;
```

| file_id | name | type_desc | physical_name | size_mb | growth | is_percent_growth |
|---:|---|---|---|---:|---:|---:|
| 1 | tempdev | ROWS | /var/opt/mssql/data/tempdb.mdf | 328.00 | 8192 | 0 |
| 2 | templog | LOG | /var/opt/mssql/data/templog.ldf | 72.00 | 8192 | 0 |
| 3 | tempdev2 | ROWS | /var/opt/mssql/data/tempdb2.ndf | 328.00 | 8192 | 0 |
| 4 | tempdev3 | ROWS | /var/opt/mssql/data/tempdb3.ndf | 328.00 | 8192 | 0 |
| 5 | tempdev4 | ROWS | /var/opt/mssql/data/tempdb4.ndf | 328.00 | 8192 | 0 |
| 6 | tempdev5 | ROWS | /var/opt/mssql/data/tempdb5.ndf | 328.00 | 8192 | 0 |
| 7 | tempdev6 | ROWS | /var/opt/mssql/data/tempdb6.ndf | 328.00 | 8192 | 0 |
| 8 | tempdev7 | ROWS | /var/opt/mssql/data/tempdb7.ndf | 328.00 | 8192 | 0 |
| 9 | tempdev8 | ROWS | /var/opt/mssql/data/tempdb8.ndf | 328.00 | 8192 | 0 |

*This is the pattern you usually want to see: eight equal-sized tempdb data files with fixed-size autogrowth and one separate log file. The equal 328 MB allocation means proportional fill can distribute work evenly. `is_percent_growth = 0` across the board is also correct for tempdb, because percentage growth causes increasingly large and less predictable growth events as files get bigger.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `type_desc` | `ROWS` | &#9989; for tempdb data files | TempDB data file | Used for version store, worktables, temp objects |
| `type_desc` | `LOG` | &#9989; for one file | TempDB transaction log file | Separate log growth behavior from data-file growth |
| `is_percent_growth` | `0` | &#9989; | Fixed-size autogrowth | Predictable growth events |
| `is_percent_growth` | `1` | &#10060; | Percentage growth | Growth events become larger and less predictable over time |
| `size_mb` | Equal across all data files | &#9989; | Balanced proportional fill | Better allocation distribution |
| `size_mb` | Unequal across data files | &#10060; | One or more files will be favored | Tempdb concurrency benefit is weakened |

---

## Workload

These queries answer what is happening right now: who is connected, which requests are active, whether blocking exists, and what cumulative waits have dominated since startup.

### Sessions and Requests

This subsection surfaces live user connectivity and the current request picture that drives most incident triage.

#### User sessions currently connected to the instance

[!info]-
This query uses `sys.dm_exec_sessions` to inventory current user sessions.

- The first result set is the total count of user sessions.
- The second result set shows the ten most recent user sessions and identifies the login, host, client program, session status, and default database.
- `is_user_process = 1` filters out SQL Server internal system sessions.
- `program_name` is often the fastest way to distinguish SSMS, `sqlcmd`, application pools, JDBC clients, and ETL tools.

*This query shows how many user sessions exist right now and which clients created them.*

```sql
SELECT COUNT(*) AS user_session_count
FROM sys.dm_exec_sessions
WHERE is_user_process = 1;

SELECT TOP (10)
    session_id,
    login_name,
    host_name,
    program_name,
    status,
    database_id
FROM sys.dm_exec_sessions
WHERE is_user_process = 1
ORDER BY login_time DESC;
```

| user_session_count |
|---:|
| 4 |

<!-- result-set-separator -->

| session_id | login_name | host_name | program_name | status | database_id |
|---:|---|---|---|---|---:|
| 57 | sa | ELYSIUM | SQLCMD | running | 1 |
| 56 | sa | ELYSIUM | SQLCMD | sleeping | 1 |
| 53 | sa | ELYSIUM | SQLCMD | running | 1 |
| 73 | sa | ELYSIUM | SQL Server Management Studio | sleeping | 1 |

*The instance has only four user sessions, so there is no sign of broad connection pressure. The important operational signal is client identity: this server is currently being accessed almost entirely through `sqlcmd`, with one SSMS session. That matters during incident triage because the client tool often explains why a session is sleeping, why a transaction might still be open, and which operational runbook or script is generating activity.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `status` | `running` | Context dependent | Session currently has work on a scheduler | Normal if an active query or batch is executing |
| `status` | `sleeping` | Context dependent | Session is connected but idle between requests | Usually harmless unless it holds an open transaction |
| `program_name` | `SQLCMD`, `SQL Server Management Studio` | &#9989; in this capture | Human-operated tooling | Activity is likely administrative, not application traffic |

#### Production request triage with blocking, waits, and current statement text

[!info]-
This query joins the two core live-workload DMVs:

- `sys.dm_exec_requests` provides one row per currently executing request.
- `sys.dm_exec_sessions` adds login, host, and client-application identity.
- `DB_NAME(r.database_id)` resolves the target database.
- `wait_type`, `wait_time`, `cpu_time`, and `total_elapsed_time` describe what the request is currently waiting on and how long it has been active.
- `logical_reads`, `reads`, and `writes` show the request's current I/O footprint.
- `blocking_session_id` links a blocked request to its blocker.
- `sys.dm_exec_sql_text(r.sql_handle)` returns the batch text, and the statement offsets extract the exact currently running statement rather than the whole batch.

This is the production version of a live-request observer query. It is appropriate for blocking, waiting, and "what is running right now" triage because it includes enough identity and resource fields to be actionable.

*This query surfaces live user requests with the exact current statement, wait, timing, I/O footprint, and blocking relationship needed for production triage.*

```sql
SELECT
    r.session_id,
    DB_NAME(r.database_id) AS database_name,
    s.login_name,
    s.host_name,
    s.program_name,
    r.status,
    r.command,
    r.wait_type,
    r.wait_time AS wait_time_ms,
    r.cpu_time AS cpu_time_ms,
    r.total_elapsed_time AS elapsed_time_ms,
    r.logical_reads,
    r.reads,
    r.writes,
    r.blocking_session_id,
    LEFT(REPLACE(REPLACE(LTRIM(SUBSTRING(
        st.text,
        (r.statement_start_offset / 2) + 1,
        CASE
            WHEN r.statement_end_offset = -1 THEN (DATALENGTH(st.text) - r.statement_start_offset) / 2 + 1
            ELSE (r.statement_end_offset - r.statement_start_offset) / 2 + 1
        END
    )), CHAR(13), ' '), CHAR(10), ' '), 160) AS running_statement
FROM sys.dm_exec_requests AS r
JOIN sys.dm_exec_sessions AS s
    ON r.session_id = s.session_id
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) AS st
WHERE r.session_id <> @@SPID
  AND s.is_user_process = 1
ORDER BY r.total_elapsed_time DESC, r.session_id;
```

| session_id | database_name | login_name | host_name | program_name | status | command | wait_type | wait_time_ms | cpu_time_ms | elapsed_time_ms | logical_reads | reads | writes | blocking_session_id | running_statement |
|---:|---|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| 53 | stoxx | sa | ELYSIUM | Microsoft SQL Server Management Studio - Query | suspended | UPDATE | LCK_M_IX | 21737 | 0 | 21737 | 0 | 0 | 0 | 56 | UPDATE [dbo].[dm_exec_requests_demo] set [payload] = [payload] WHERE [id]=@1 |
| 62 | stoxx | sa | ELYSIUM | Microsoft SQL Server Management Studio - Query | suspended | SELECT | LCK_M_SCH_S | 11584 | 0 | 11584 | 0 | 0 | 0 | 56 | SELECT payload FROM dbo.dm_exec_requests_demo WITH (UPDLOCK, HOLDLOCK) WHERE id = 1 |

*This is a live blocking snapshot. Both visible requests are waiting on session `56`, which means the blocker itself is not currently executing a request row in `sys.dm_exec_requests`; it is almost certainly a sleeping session holding locks inside an open transaction. Session `53` is blocked trying to acquire an intent exclusive lock (`LCK_M_IX`) for an `UPDATE`, while session `62` is blocked on schema stability (`LCK_M_SCH_S`) while issuing a locking `SELECT`. The practical next step in production is not to stare at the blocked rows longer; it is to investigate session `56` in `sys.dm_exec_sessions`, open transactions, and lock ownership, then decide whether the blocker should be allowed to finish, committed, or terminated.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `status` | `running` | &#9989; | Request is actively on CPU or progressing | Healthy for an active request |
| `status` | `suspended` | Watch | Request is waiting on a resource | Check `wait_type` to see what it is waiting on |
| `command` | `SELECT`, `UPDATE`, `INSERT`, `DELETE`, `BACKUP DATABASE`, `RESTORE DATABASE` | Context dependent | Current high-level operation | Use with `running_statement` for exact scope |
| `wait_type` | `NULL` | &#9989; for some running requests | No current wait recorded | Often means actively running on CPU |
| `wait_type` | `LCK_M_*` | &#10060; when prolonged | Lock wait | Investigate blocking chain and open transactions |
| `wait_type` | `PAGEIOLATCH_*` | Watch | Waiting on data page read from storage | Check storage latency and buffer-cache effectiveness |
| `wait_type` | `CXPACKET`, `CXSYNC_PORT`, `CXSYNC_CONSUMER` | Context dependent | Parallelism coordination waits | Evaluate alongside CPU pressure and plan shape |
| `blocking_session_id` | `0` | &#9989; | Not blocked by another session | Either running, waiting on non-blocking resources, or itself the blocker |
| `blocking_session_id` | nonzero | &#10060; | This request is blocked by another session | Investigate the blocker first |

### Waits

This subsection uses cumulative waits to answer what the instance has spent time waiting on since startup. This is a directional workload signal, not proof of root cause by itself.

#### Top cumulative waits since startup

[!info]-
This query reads `sys.dm_os_wait_stats` and filters out the usual idle or housekeeping waits that are not useful for first-response triage.

- `wait_time_ms` is the total wait time accumulated for that wait type since the last reset.
- `signal_wait_time_ms` is the CPU-runnable portion of the wait after the resource became available.
- `waiting_tasks_count` is the number of tasks that experienced that wait.
- `pct_of_total_waits` is the wait type's share of the filtered total, not of all waits in the instance.

Wait analysis is cumulative. It must always be read in the context of server uptime and recent maintenance or demo activity.

*This query ranks the most important cumulative waits on the instance so you can distinguish background noise from actual contention classes.*

```sql
WITH waits AS
(
    SELECT
        wait_type,
        wait_time_ms,
        signal_wait_time_ms,
        waiting_tasks_count
    FROM sys.dm_os_wait_stats
    WHERE wait_type NOT IN
    (
        'SLEEP_TASK','SLEEP_SYSTEMTASK','BROKER_TASK_STOP','BROKER_TO_FLUSH',
        'SQLTRACE_BUFFER_FLUSH','CLR_AUTO_EVENT','CLR_MANUAL_EVENT',
        'LAZYWRITER_SLEEP','RESOURCE_QUEUE','XE_TIMER_EVENT',
        'XE_DISPATCHER_WAIT','FT_IFTS_SCHEDULER_IDLE_WAIT',
        'BROKER_EVENTHANDLER','TRACEWRITE','LOGMGR_QUEUE',
        'CHECKPOINT_QUEUE','REQUEST_FOR_DEADLOCK_SEARCH',
        'BROKER_RECEIVE_WAITFOR','ONDEMAND_TASK_QUEUE',
        'DISPATCHER_QUEUE_SEMAPHORE','XE_DISPATCHER_JOIN'
    )
)
SELECT TOP (10)
    wait_type,
    wait_time_ms,
    signal_wait_time_ms,
    waiting_tasks_count,
    CAST(100.0 * wait_time_ms / SUM(wait_time_ms) OVER () AS decimal(6,2)) AS pct_of_total_waits
FROM waits
ORDER BY wait_time_ms DESC;
```

| wait_type | wait_time_ms | signal_wait_time_ms | waiting_tasks_count | pct_of_total_waits |
|---|---:|---:|---:|---:|
| SOS_WORK_DISPATCHER | 1074759907 | 9477 | 136562 | 90.44 |
| HADR_FILESTREAM_IOMGR_IOCOMPLETION | 28276060 | 330 | 56389 | 2.38 |
| QDS_PERSIST_TASK_MAIN_LOOP_SLEEP | 28260773 | 33 | 472 | 2.38 |
| PWAIT_EXTENSIBILITY_CLEANUP_TASK | 28252135 | 28252135 | 102 | 2.38 |
| QDS_ASYNC_QUEUE | 28245499 | 27 | 429 | 2.38 |
| LCK_M_IX | 92048 | 0 | 3 | 0.01 |
| CXPACKET | 90310 | 6827 | 165388 | 0.01 |
| LCK_M_SCH_S | 89426 | 0 | 3 | 0.01 |
| CXSYNC_PORT | 59243 | 148 | 1366 | 0.00 |
| LCK_M_U | 56662 | 0 | 12 | 0.00 |

*The biggest numbers here are mostly background framework waits, not evidence of an overloaded production instance. `SOS_WORK_DISPATCHER`, Query Store queue waits, and extensibility cleanup waits dominate because this server has low uptime and very little sustained workload. The meaningful non-background waits in this snapshot are the lock waits (`LCK_M_IX`, `LCK_M_SCH_S`, `LCK_M_U`), which came from deliberately reproduced blocking, and a small amount of parallelism coordination (`CXPACKET`, `CXSYNC_PORT`). The right interpretation is not "the server has a lock crisis"; it is "the wait profile is currently too young and too influenced by lab activity to use as a historical performance baseline."*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `wait_time_ms` | High but mostly sleep/background waits | Context dependent | Cumulative wait volume | Always validate whether the wait is actionable or benign |
| `signal_wait_time_ms` | < 10% of `wait_time_ms` | &#9989; in many cases | Most wait time is resource wait, not CPU-runnable delay | CPU scheduling pressure is not dominant |
| `signal_wait_time_ms` | > 20-25% of `wait_time_ms` | Watch | More time is spent runnable but not scheduled | Often points toward CPU pressure |
| `wait_type` | `LCK_M_*` | Watch | Lock waits | Investigate blocking, transaction scope, and concurrency design |
| `wait_type` | `PAGEIOLATCH_*` | Watch | Storage reads into memory | Check I/O latency and working-set fit in memory |
| `wait_type` | `SOS_WORK_DISPATCHER`, `QDS_*_SLEEP` | Usually ignore for top-line triage | Background task or idle wait families | Not generally root-cause evidence for user-query slowness |

---

## Backups And Capacity

These queries answer whether backups actually exist, how much log space is in use, and where the largest objects live.

### Backup Evidence

This subsection answers whether `msdb` contains real backup and restore history that you can trust during recovery work.

#### Recent full backup history with compressed size

[!info]-
This query reads `msdb.dbo.backupset`, which is the canonical backup history table for SQL Server.

- `type = 'D'` means full database backup.
- `backup_size_mb` is the logical uncompressed size written by the backup operation.
- `compressed_backup_size_mb` is the actual physical size written to media when compression was used.
- `is_copy_only` shows whether the backup participated in the normal backup chain.
- `recovery_model` records the database recovery model at backup time.

*This query proves that recent full backups exist and shows whether they were compressed and copy-only.*

```sql
SELECT TOP (5)
    database_name,
    backup_start_date,
    backup_finish_date,
    type,
    CAST(backup_size / 1024.0 / 1024 AS decimal(12,2)) AS backup_size_mb,
    CAST(compressed_backup_size / 1024.0 / 1024 AS decimal(12,2)) AS compressed_backup_size_mb,
    is_copy_only,
    recovery_model
FROM msdb.dbo.backupset
ORDER BY backup_finish_date DESC;
```

| database_name | backup_start_date | backup_finish_date | type | backup_size_mb | compressed_backup_size_mb | is_copy_only | recovery_model |
|---|---|---|---|---:|---:|---:|---|
| admin_restore_demo | 2026-04-08 16:35:41.000 | 2026-04-08 16:35:41.000 | D | 2.90 | 0.47 | 0 | FULL |

*`msdb` currently contains backup history, but it is not yet a meaningful production retention history for `stoxx`. The only recorded full backup is the disposable restore-lab database `admin_restore_demo`. Operationally, that means backup plumbing works, but it does not prove that the primary workload database has an established, recent backup cadence. The compression ratio here is strong: 2.90 MB logical size to 0.47 MB written, roughly 6.2:1.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `type` | `D` | &#9989; here | Full database backup | Foundation for restore sequences |
| `type` | `I`, `L`, `F`, `P` | Context dependent | Differential, log, file/filegroup, partial backup | Use according to recovery design |
| `is_copy_only` | `0` | &#9989; here | Conventional backup | Participates normally in chain semantics |
| `is_copy_only` | `1` | Context dependent | Copy-only backup | Useful for ad hoc protection but does not replace regular cadence |
| `compressed_backup_size_mb` | Much smaller than `backup_size_mb` | &#9989; | Compression was effective | Lower backup storage and transfer cost |
| `compressed_backup_size_mb` | Close to `backup_size_mb` | Watch | Compression ineffective | Often means encrypted or already-compressed data |

#### Backup media path and physical backup file evidence

*This query joins backup history to media metadata so you can see the actual device path that SQL Server wrote to.*

```sql
SELECT TOP (5)
    bs.database_name,
    bmf.physical_device_name,
    CAST(bs.backup_size / 1024.0 / 1024 AS decimal(12,2)) AS backup_size_mb
FROM msdb.dbo.backupset AS bs
JOIN msdb.dbo.backupmediafamily AS bmf
    ON bmf.media_set_id = bs.media_set_id
ORDER BY bs.backup_finish_date DESC;
```

| database_name | physical_device_name | backup_size_mb |
|---|---|---:|
| admin_restore_demo | /var/opt/mssql/backup/admin_restore_demo_full.bak | 2.90 |

*The backup history is tied to a real disk file under `/var/opt/mssql/backup`. This is useful because `backupset` alone proves only that SQL Server thinks a backup operation occurred. The media-family join tells you where SQL Server wrote it, which is the first thing you need when a restore request arrives.*

### Log Space

This subsection answers whether the transaction log is close to filling and whether the current log footprint reflects recent backup activity or open transactions.

#### Current transaction log allocation and usage

[!info]-
This query reads `sys.dm_db_log_space_usage`, which reports current transaction log usage for databases in the instance.

- `total_log_size_mb` is the current allocated log file size.
- `used_log_space_mb` is the portion currently in use.
- `used_log_space_percent` is the same ratio expressed as a percentage.
- `log_since_last_backup_mb` shows how much log has been generated since the last log backup.

*This query shows whether a database is close to filling its log and whether log generation has outpaced recent backups.*

```sql
SELECT
    DB_NAME(database_id) AS database_name,
    CAST(total_log_size_in_bytes / 1024.0 / 1024.0 AS decimal(12,2)) AS total_log_size_mb,
    CAST(used_log_space_in_bytes / 1024.0 / 1024.0 AS decimal(12,2)) AS used_log_space_mb,
    CAST(used_log_space_in_percent AS decimal(6,2)) AS used_log_space_percent,
    CAST(log_space_in_bytes_since_last_backup / 1024.0 / 1024.0 AS decimal(12,2)) AS log_since_last_backup_mb
FROM sys.dm_db_log_space_usage;
```

| database_name | total_log_size_mb | used_log_space_mb | used_log_space_percent | log_since_last_backup_mb |
|---|---:|---:|---:|---:|
| stoxx | 967.99 | 587.45 | 60.69 | 570.89 |

*`stoxx` currently has a 968 MB log file, with about 587 MB in use, so the log is not full but it is materially occupied. The more important signal is `log_since_last_backup_mb = 570.89`, which means a substantial amount of log has accumulated since the last log backup for this database. In a FULL recovery database, that is a direct prompt to verify that a real log-backup cadence exists and that this is not just a lab or first-run environment with no regular log backup job yet.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `used_log_space_percent` | < 50% | &#9989; generally | Comfortable headroom remains | Continue monitoring with normal cadence |
| `used_log_space_percent` | 50-80% | Watch | Log is materially occupied | Verify log reuse blockers and backup cadence |
| `used_log_space_percent` | > 80-90% | &#10060; | Log is approaching exhaustion | Immediate investigation required before writes fail |
| `log_since_last_backup_mb` | Small and stable | &#9989; | Log backups are likely running regularly | Normal for healthy FULL recovery operations |
| `log_since_last_backup_mb` | Large and rising | &#10060; under FULL | Log has accumulated since last backup | Check missing or failing log backup job first |

### Capacity Hotspots

This subsection answers which tables and indexes currently dominate space consumption so you know where maintenance and storage work will matter most.

#### Largest tables by reserved space

*This query ranks tables by reserved space and row count so you can identify the objects that dominate the database footprint.*

```sql
SELECT TOP (10)
    OBJECT_SCHEMA_NAME(t.object_id) AS schema_name,
    t.name AS table_name,
    SUM(ps.row_count) AS row_count,
    CAST(SUM(ps.reserved_page_count) * 8.0 / 1024 AS decimal(12,2)) AS reserved_mb
FROM sys.dm_db_partition_stats AS ps
JOIN sys.tables AS t
    ON t.object_id = ps.object_id
WHERE ps.index_id IN (0, 1)
GROUP BY t.object_id, t.name
ORDER BY reserved_mb DESC, row_count DESC;
```

| schema_name | table_name | row_count | reserved_mb |
|---|---|---:|---:|
| dbo | demo_idxmaint_rowstore | 671550 | 188.95 |
| dbo | demo_idxmaint_missing | 671550 | 94.07 |
| dbo | demo_idxmaint_splits | 100000 | 23.07 |
| dbo | demo_eurostoxx50_ohlcv | 67155 | 7.32 |
| silver | eurostoxx50_ohlcv | 67155 | 6.07 |
| silver | stoxxusa50_ohlcv | 66000 | 5.82 |
| silver | stoxxasia50_ohlcv | 64875 | 5.82 |
| silver | oil20_ohlcv | 25080 | 2.20 |
| dbo | demo_idxmaint_columnstore | 129716 | 2.13 |
| dbo | demo_idxmaint_usage | 50000 | 1.88 |

*The top space consumers are still disposable administration and maintenance demo tables in `dbo`, not business tables in `silver` or `gold`. That matters operationally because a size-ranking query can otherwise mislead you into tuning or backing up the wrong objects first. The largest real workload table currently visible here is `silver.eurostoxx50_ohlcv`, and even that is still small at about 6 MB reserved.*

#### Largest indexes by used space

*This query ranks indexes by used space so you can see whether the database footprint is dominated by clustered storage, nonclustered access paths, or columnstore structures.*

```sql
SELECT TOP (12)
    OBJECT_SCHEMA_NAME(i.object_id) AS schema_name,
    OBJECT_NAME(i.object_id) AS table_name,
    i.name AS index_name,
    i.type_desc,
    CAST(SUM(ps.used_page_count) * 8.0 / 1024 AS decimal(12,2)) AS used_mb
FROM sys.dm_db_partition_stats AS ps
JOIN sys.indexes AS i
    ON i.object_id = ps.object_id
   AND i.index_id = ps.index_id
WHERE i.object_id > 100
GROUP BY i.object_id, i.name, i.type_desc
ORDER BY used_mb DESC;
```

| schema_name | table_name | index_name | type_desc | used_mb |
|---|---|---|---|---:|
| dbo | demo_idxmaint_rowstore | CIX_demo_idxmaint_row_guid | CLUSTERED | 188.02 |
| dbo | demo_idxmaint_missing | PK_demo_idxmaint_missing | CLUSTERED | 93.88 |
| dbo | demo_idxmaint_rowstore | IX_demo_idxmaint_symbol_date | NONCLUSTERED | 34.84 |
| dbo | demo_idxmaint_splits | CIX_demo_idxmaint_splits | CLUSTERED | 22.95 |
| dbo | demo_eurostoxx50_ohlcv | CIX_demo_eurostoxx50_ohlcv | CLUSTERED | 6.24 |
| silver | eurostoxx50_ohlcv | PK__eurostox__3213E83FDF67D274 | CLUSTERED | 6.02 |
| silver | stoxxasia50_ohlcv | PK__stoxxasi__3213E83F66A8DE5E | CLUSTERED | 5.80 |
| silver | stoxxusa50_ohlcv | PK__stoxxusa__3213E83FC84E3F24 | CLUSTERED | 5.77 |
| sys | plan_persist_plan | plan_persist_plan_cidx | CLUSTERED | 2.80 |
| silver | oil20_ohlcv | PK__oil20_oh__3213E83F544EB286 | CLUSTERED | 2.20 |
| dbo | demo_idxmaint_columnstore | CCI_demo_idxmaint_columnstore | CLUSTERED COLUMNSTORE | 1.97 |
| silver | eurostoxx50_ohlcv | IX_silver_eurostoxx50_ohlcv_symbol_date | NONCLUSTERED | 1.88 |

*The index footprint is mostly clustered storage, which is typical. The main nonclustered index to care about in the real workload is `IX_silver_eurostoxx50_ohlcv_symbol_date`, which is small enough that maintenance costs are low but important enough to be relevant for query-shape discussions. The large `dbo.demo_*` indexes again confirm that this environment contains administration lab artifacts, so capacity reports should be read with that context in mind.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `type_desc` | `CLUSTERED` | Common | Base rowstore table storage | Usually the dominant footprint |
| `type_desc` | `NONCLUSTERED` | Context dependent | Secondary access path | Tune or drop only with workload evidence |
| `type_desc` | `CLUSTERED COLUMNSTORE` | Context dependent | Columnar compressed storage | Compression and analytics behavior differ from rowstore |

---

## Related

- [[server-configuration]] for the corrective configuration work that usually follows the baseline queries
- [[backup-types-and-strategy]] for interpreting recovery-model and log-backup findings
- [[restore-and-recovery]] for moving from backup evidence to actual restore execution
- [[sql-server-agent-jobs]] for scheduling the recurring checks and maintenance these queries often motivate
- [[wait-stats-analysis]] for deeper wait interpretation after the top-line instance snapshot
- [[execution-plans]] for query-level follow-up once the live-request query identifies a problematic statement
