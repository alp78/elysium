---
title: "14 - SQL Server Problems"
tags:
  - sql-server
  - tsql
status: stable
updated: 2026-04-11
description: "Catalog of 25 SQL Server production problems ranked by severity, with live diagnosis captures from the local stoxx instance, field-definition tables, value guides, and concrete fix procedures. Covers log and disk exhaustion, deadlocks, backup corruption, TDE recovery, parameter sniffing, blocking chains, stale statistics, tempdb latch contention, and operational debt on SQL Server 2022."
---

# SQL Server Problems

> [!quote]+
>
> "Everybody has a plan until they get punched in the mouth."
>
> — **Mike Tyson**

> [!abstract]- Summary
>
> SQL Server is the transactional backbone of the index-calculation platform. Bronze ingestion, silver cleaning, gold aggregation, and the API serving layer all depend on it, and on a self-managed Linux instance without a dedicated DBA the data engineering team owns performance tuning, backup strategy, concurrency management, and capacity planning. This catalog is organized around concrete production problems that have caused incidents or near-misses on comparable workloads, with each problem documented as a narrative plus command-level operations, live captures, field tables, and value guides.
>
> - **Severity and triage**
>   - frames the catalog through four severity bands and a symptom-first decision flow so incoming incidents map quickly to the right diagnostic branch
> - **Critical problems**
>   - covers data-loss and full-outage risks such as log exhaustion, disk exhaustion, deadlocks, corrupt backups, and lost TDE certificates
> - **High-severity problems**
>   - addresses degraded SLA and data-quality failures such as blocking chains, parameter sniffing, MERGE races, stale statistics, and related operational regressions
> - **Moderate and low-severity problems**
>   - captures the monitoring-heavy issues, recurring footguns, and technical debt patterns that erode reliability over time even when they do not wake on-call immediately
> - **Operational reference**
>   - ends with reference tables, a diagnostic decision flow, and related notes so responders can widen or narrow the investigation without leaving the series
> - **Reference environment**
>   - the narrative assumes a hypothetical SQL Server 2022 workload on Ubuntu 22.04, GCP Compute Engine (`n2-standard-8`, `500 GB` `pd-ssd`), with a `bronze -> silver -> gold` medallion architecture driven by Python `pyodbc`, a C# `Dapper` API, and Airflow under EU BMR deadlines; live captures are executed against the local `stoxx` SQL Server 2022 Developer Edition instance (`16.0.4236.2`, `SQL_Latin1_General_CP1_CI_AS`) via the `stoxx-queries` skill, with narrative object names rewritten to `stoxx` schemas where needed

> [!note]- Glossary
>
> - **Severity band**
>   - response-priority classification that maps a problem to the urgency and ownership of the fix
> - **Triage**
>   - first-response process of mapping symptoms to the most likely failure class and the first safe diagnostic query
> - **Blocking chain**
>   - set of sessions waiting behind a blocking head session that holds the needed lock
> - **Deadlock**
>   - circular lock dependency where SQL Server aborts one session as the victim to break the cycle
> - **Parameter sniffing**
>   - plan instability caused when a cached plan optimized for one parameter set performs poorly for another
> - **`log_reuse_wait_desc`**
>   - `sys.databases` field showing why SQL Server cannot currently truncate the transaction log
> - **VLF**
>   - virtual log file, the internal segment SQL Server uses to manage the transaction log
> - **TDE certificate chain**
>   - certificate and private-key backup path required to recover TDE-protected databases and backups elsewhere
> - **Stale statistics**
>   - outdated distribution metadata that leads the optimizer to bad row-count estimates and poor plans
> - **Tempdb latch contention**
>   - allocation or metadata latch pressure in `tempdb`, often visible as `PAGELATCH_*` waits
> - **Live capture**
>   - query output executed against the local lab instance instead of fabricated examples
> - **Fix procedure**
>   - ordered operational response that follows diagnosis and carries real state-changing risk if applied to the wrong cause

## Severity and triage

Every problem is tagged with one of four severity levels that map to a response cadence. The severity reflects the worst plausible outcome of the problem, not the average outcome.

| Severity | Count | Worst-case impact | Response window | Who decides |
|---|---|---|---|---|
| Critical | 5 | Data loss, regulatory breach, full pipeline down | Immediate, wake on-call | On-call DBA engineer |
| High | 8 | Data quality failure, degraded SLA, API latency spikes | Same day | Team lead |
| Moderate | 7 | Operational pain, workable with monitoring | Current sprint | Backlog grooming |
| Low | 5 | Technical debt, cosmetic, no immediate impact | Backlog | Tech debt week |

The triage flowchart below shows how an incoming symptom maps to the right class of problem and the first diagnostic query to run.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {
  'primaryColor': '#292e42',
  'primaryTextColor': '#c0caf5',
  'primaryBorderColor': '#565f89',
  'lineColor': '#565f89',
  'secondaryColor': '#1a1b26',
  'tertiaryColor': '#24283b',
  'noteTextColor': '#c0caf5',
  'noteBkgColor': '#292e42',
  'textColor': '#c0caf5',
  'fontSize': '14px'
}}}%%
flowchart TD
    sym[Incoming symptom<br/>from Airflow or API] --> cat{Symptom class?}
    cat -->|writes failing<br/>with error 9002| log[Transaction log full]
    cat -->|writes failing<br/>with OS error 112| disk[Data disk full]
    cat -->|error 1205 victim<br/>on retry loop| dlk[Deadlock during ETL]
    cat -->|restore fails<br/>on corrupt backup| bkp[Backup corruption]
    cat -->|restore fails<br/>with error 33111| tde[TDE certificate lost]
    cat -->|API latency spike<br/>under load| cnv[Implicit conversion]
    cat -->|plan changed<br/>overnight| snf[Parameter sniffing / regression]
    cat -->|LCK_M_U waits<br/>on pipeline sessions| blk[Blocking chain]
    cat -->|NOT MATCHED insert<br/>duplicates silver| mrg[MERGE race condition]
    cat -->|nothing acutely broken| obs[Run diagnostic playbook]

    log --> q1[Run: SELECT log_reuse_wait_desc<br/>FROM sys.databases]
    disk --> q2[Run: df -h + sys.master_files]
    dlk --> q3[Query system_health ring_buffer<br/>for xml_deadlock_report]
    bkp --> q4[RESTORE VERIFYONLY<br/>WITH CHECKSUM]
    tde --> q5[SELECT FROM master.sys.certificates<br/>+ BACKUP CERTIFICATE]
    cnv --> q6[Plan cache LIKE<br/>'%CONVERT_IMPLICIT%']
    snf --> q7[Query Store:<br/>sys.query_store_plan]
    blk --> q8[sys.dm_exec_requests<br/>WHERE blocking_session_id > 0]
    mrg --> q9[GROUP BY business_key<br/>HAVING COUNT(*) > 1]
    obs --> q10[06-essential-dba-queries]

    q1 --> yes1[YES]
    q1 --> no1[NO]
    yes1 -.->|action needed| fix[Apply fix procedure]
    no1 -.->|ruled out| cat

    classDef yesNode fill:#1f3b2d,stroke:#73d13d,color:#c0caf5
    classDef noNode fill:#4a1f24,stroke:#db4b4b,color:#c0caf5
    class yes1 yesNode
    class no1 noNode
```

The triage flowchart captures the decision path from symptom to first diagnostic query. Every symptom routes to one of the 25 H3 subsections below; if the first query rules the class out, fall back to `cat` and try the next branch, or reach for the general DBA playbook at [06-essential-dba-queries](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/01-Server-Operations/essential-dba-queries) for a wider scan.

## Critical — Data loss or pipeline outage

> [!abstract]- Summary
>
> These five problems are the ones that wake on-call. Each one can break the publication SLA or lose data outright if not fixed within minutes. The diagnostic queries are all read-only and safe to run from a second session even while the primary workload is failing. Every fix procedure assumes you have `sysadmin` or `db_owner` on the affected database; if you do not, stop and escalate before running `KILL`, `BACKUP LOG`, or `DBCC SHRINKFILE`.

### SQL Server | transaction log | full and write-blocking

A production database's transaction log grows until it fills the disk volume. SQL Server returns `Msg 9002: The transaction log for database 'X' is full due to 'LOG_BACKUP'`, every write aborts, and the pipeline halts. The root cause is always that SQL Server cannot reuse log Virtual Log Files (VLFs) because some operation is holding the active portion. The `log_reuse_wait_desc` column on `sys.databases` names the exact reason: `LOG_BACKUP` means no log backup has run since the log grew, `ACTIVE_TRANSACTION` means a session is holding `BEGIN TRAN` across the VLFs that need to turn over, `REPLICATION` means a replication agent has not consumed the log entries, `AVAILABILITY_REPLICA` means an Always On secondary has not acknowledged the LSN. Each reason has a distinct fix, and the wrong fix (e.g. shrinking on an `ACTIVE_TRANSACTION` hold) does nothing. Under `FULL` recovery model — required for point-in-time restore and most HA features — this chain is the single most common cause of write outages, and the fix window is typically minutes before the pipeline's upstream retries exhaust themselves.

The severity is maximum because every second spent full is a second of bronze ingestion, silver transform, and gold publication failing, and a prolonged outage is a BMR regulatory breach. The diagnostic queries below are read-only and cost nothing; the fix queries (`KILL`, `BACKUP LOG`, `DBCC SHRINKFILE`) are state-changing and must be sequenced carefully to avoid making the situation worse.

#### Audit the log reuse wait descriptor

At the start of any incident where a user database is throwing error 9002 or any session is waiting on log space. It is typically triggered by airflow surfacing `9002` in a `pyodbc.Error`, SQL Server Agent job failing with "transaction log is full", or a monitoring alert on `Percent Log Used` above 85%. T-SQL session against the primary instance. Read-only; safe from a second session while writes are still failing. Requires `VIEW SERVER STATE` to see databases the user does not own. Identify which database is stuck and what kind of hold is blocking log reuse, so you can pick the correct fix branch.

> [!info]- Query mechanics
>
> `sys.databases` exposes one row per database on the instance, including system databases. `database_id > 4` skips `master`, `tempdb`, `model`, `msdb`, which never exhibit user-managed log fullness. `log_reuse_wait_desc` is the enumerated reason SQL Server cannot truncate the log — see the domain table directly below for the full value set. `is_read_committed_snapshot_on` is a `bit` that is listed because some fix branches (e.g. `ACTIVE_TRANSACTION` holds from a snapshot isolation reader) depend on whether RCSI is enabled, changing the set of candidate blockers.

*Show recovery model, reuse-wait reason, and RCSI state for every user database on the instance.*

```sql
SELECT
    name AS database_name,
    recovery_model_desc,
    log_reuse_wait_desc,
    state_desc,
    is_read_committed_snapshot_on AS rcsi_on
FROM sys.databases
WHERE database_id > 4
ORDER BY name;
```

| Field | Source column | Type | Meaning |
|---|---|---|---|
| `database_name` | `sys.databases.name` | `sysname` | User-visible database name |
| `recovery_model_desc` | `sys.databases.recovery_model_desc` | `nvarchar(60)` | One of `FULL`, `BULK_LOGGED`, `SIMPLE`. `SIMPLE` cannot fill via log backup hold; `FULL`/`BULK_LOGGED` can |
| `log_reuse_wait_desc` | `sys.databases.log_reuse_wait_desc` | `nvarchar(60)` | Why the log cannot be truncated right now (enumerated domain below) |
| `state_desc` | `sys.databases.state_desc` | `nvarchar(60)` | `ONLINE`, `RESTORING`, `SUSPECT`, etc. A suspect database hides other symptoms |
| `rcsi_on` | `sys.databases.is_read_committed_snapshot_on` | `bit` | When `1`, version-store readers can hold log reuse as `ACTIVE_TRANSACTION` even on `SELECT` |

*Live capture against the local stoxx instance on 2026-04-11:*

| database_name | recovery_model_desc | log_reuse_wait_desc | state_desc | rcsi_on |
|---|---|---|---|---|
| stoxx | FULL | NOTHING | ONLINE | False |
| stoxx_backup | FULL | NOTHING | ONLINE | False |
| stoxx_db | FULL | NOTHING | ONLINE | True |

All three user databases on `stoxx` are in `FULL` recovery with `NOTHING` as the reuse-wait descriptor — this is the healthy state, meaning the log chain is intact and log backups are current. `NOTHING` as a reuse-wait value is counter-intuitive: it does not mean "no log activity", it means "no obstacle to reuse". A production instance showing `LOG_BACKUP` for 30+ minutes is already in trouble; `ACTIVE_TRANSACTION` for a few seconds is normal, for minutes is an incident. The full domain of possible values is shown below — these are the branches the fix procedure routes to.

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `log_reuse_wait_desc` | `NOTHING` | normal | No obstacle; the next checkpoint will clear inactive VLFs | Healthy state |
| `log_reuse_wait_desc` | `CHECKPOINT` | normal | Waiting on the next CHECKPOINT to flush dirty pages | Transient; fires every minute or so |
| `log_reuse_wait_desc` | `LOG_BACKUP` | critical | No `BACKUP LOG` has run since the log grew | Run `BACKUP LOG` now; then check the log backup job |
| `log_reuse_wait_desc` | `ACTIVE_BACKUP_OR_RESTORE` | watch | A `BACKUP`/`RESTORE` is in flight and holding the log | Wait for it, or investigate why it is slow |
| `log_reuse_wait_desc` | `ACTIVE_TRANSACTION` | critical | A session is holding `BEGIN TRAN` across VLFs that need to reuse | Identify via `sys.dm_tran_active_transactions` + kill if orphaned |
| `log_reuse_wait_desc` | `DATABASE_MIRRORING` | legacy | Deprecated; only seen on pre-2016 mirrored databases | Migrate to Availability Groups |
| `log_reuse_wait_desc` | `REPLICATION` | watch | Transactional replication agent has not consumed the log records | Check distributor; restart log reader agent |
| `log_reuse_wait_desc` | `DATABASE_SNAPSHOT_CREATION` | transient | Creating a database snapshot (`CREATE DATABASE ... AS SNAPSHOT`) | Short-lived, typically seconds |
| `log_reuse_wait_desc` | `LOG_SCAN` | transient | A log scanner (CDC, replication, AG redo) is reading log | Monitor, rarely persistent |
| `log_reuse_wait_desc` | `AVAILABILITY_REPLICA` | critical | An AG secondary has not acknowledged the LSN | Check `sys.dm_hadr_database_replica_states` for the lagging replica |
| `log_reuse_wait_desc` | `OLDEST_PAGE` | rare | Indirect checkpoint has not advanced past the oldest dirty page | Reduce `TARGET_RECOVERY_TIME_SEC` or investigate I/O stall |
| `log_reuse_wait_desc` | `XTP_CHECKPOINT` | rare | In-Memory OLTP checkpoint lag | Check memory-optimized filegroup health |

#### Measure current log space consumption

As the next step after the reuse-wait audit, to know whether you have minutes or seconds before the pipeline starts erroring. It is typically triggered by `log_reuse_wait_desc` returns anything other than `NOTHING`, or an automated log-usage alert fires above 70%. T-SQL session, read-only, negligible cost. `sys.dm_db_log_space_usage` returns one row per database the current session has permission to see. Decide whether the database has headroom to continue running while you investigate the reuse-wait hold, or whether you must take an emergency log backup immediately.

*Show allocated log size, used log, used percentage, and log bytes not yet captured by a log backup, per database.*

```sql
SELECT
    DB_NAME(database_id) AS database_name,
    CAST(total_log_size_in_bytes / 1024.0 / 1024.0 AS DECIMAL(12,2)) AS total_log_size_mb,
    CAST(used_log_space_in_bytes / 1024.0 / 1024.0 AS DECIMAL(12,2)) AS used_log_mb,
    CAST(used_log_space_in_percent AS DECIMAL(6,2)) AS used_log_pct,
    CAST(log_space_in_bytes_since_last_backup / 1024.0 / 1024.0 AS DECIMAL(12,2)) AS unbacked_log_mb
FROM sys.dm_db_log_space_usage
ORDER BY used_log_pct DESC;
```

| Field | Source column | Type | Meaning |
|---|---|---|---|
| `database_name` | `DB_NAME(database_id)` | `sysname` | Resolved name of the database |
| `total_log_size_mb` | `total_log_size_in_bytes / 1048576` | `decimal(12,2)` | Currently allocated log file size (after any auto-growth) |
| `used_log_mb` | `used_log_space_in_bytes / 1048576` | `decimal(12,2)` | Log bytes currently holding active or pending-truncation records |
| `used_log_pct` | `used_log_space_in_percent` | `decimal(6,2)` | Percent of allocated log that is in use |
| `unbacked_log_mb` | `log_space_in_bytes_since_last_backup / 1048576` | `decimal(12,2)` | Log bytes since the last `BACKUP LOG`, i.e. the exposure window if the database is lost now |

*Live capture against the local stoxx instance on 2026-04-11:*

| database_name | total_log_size_mb | used_log_mb | used_log_pct | unbacked_log_mb |
|---|---|---|---|---|
| stoxx | 1031.99 | 11.82 | 1.15 | 1.70 |

The stoxx log file is sized at 1 GB with 1.15% currently in use and only 1.7 MB unbacked since the most recent `BACKUP LOG` — this is a healthy baseline that confirms the log chain is functioning. In a production incident you would expect to see `used_log_pct` climbing monotonically toward 100% and `unbacked_log_mb` growing unbounded. The `used_log_pct` value has two distinct thresholds: above 85% is the point at which you should take manual action (emergency log backup, find the blocker); above 98% is the point at which writes begin failing.

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `used_log_pct` | `< 50` | normal | Healthy, routine workload | None |
| `used_log_pct` | `50 – 75` | watch | Approaching the boundary where a burst of writes could fill | Verify log backup schedule |
| `used_log_pct` | `75 – 85` | warning | Log backup job is failing or a long transaction is holding | Run `BACKUP LOG` and audit reuse-wait |
| `used_log_pct` | `> 85` | critical | Minutes until error 9002 | Emergency log backup now; identify blocker in parallel |
| `used_log_pct` | `> 98` | incident | Writes failing or about to fail | Kill blockers; backup; only shrink if disk is critical |
| `unbacked_log_mb` | `> 2 × normal` | warning | Log backup cadence has slipped | Inspect SQL Agent job history |

#### Audit database file allocation and growth policy

When the log-usage query shows `total_log_size_mb` is pinned at a low value but writes are still failing — indicating the log cannot grow further. It is typically triggered by error 9002 reported even though `used_log_pct` is below 100% (i.e. the log cannot autogrow), or autogrow is percent-based and causing unpredictable growth spikes. T-SQL session against the affected database's instance. Read-only against `sys.master_files`, negligible cost. Confirm the log file's `MAXSIZE` setting and `FILEGROWTH` policy, so you can decide whether to widen the ceiling or fix the autogrow profile.

*Show data and log file layout for the stoxx database, including max size and autogrow policy.*

```sql
SELECT
    DB_NAME(mf.database_id) AS database_name,
    mf.name AS logical_name,
    mf.type_desc,
    mf.size * 8 / 1024 AS allocated_mb,
    CAST(mf.max_size AS BIGINT) * 8 / 1024 AS max_size_mb,
    mf.growth * 8 / 1024 AS growth_mb,
    mf.is_percent_growth
FROM sys.master_files mf
WHERE mf.database_id = DB_ID('stoxx')
ORDER BY mf.type_desc, mf.name;
```

| Field | Source column | Type | Meaning |
|---|---|---|---|
| `database_name` | `DB_NAME(database_id)` | `sysname` | Resolved database name |
| `logical_name` | `sys.master_files.name` | `sysname` | Logical file name used in `ALTER DATABASE ... MODIFY FILE` |
| `type_desc` | `sys.master_files.type_desc` | `nvarchar(60)` | `ROWS` for data files, `LOG` for the transaction log, `FILESTREAM` for FileStream containers |
| `allocated_mb` | `size * 8 / 1024` | `int` | Current allocated size (`size` is in 8-KB pages) |
| `max_size_mb` | `max_size * 8 / 1024` | `bigint` | Maximum configured size; `0` = no growth, `-1` = unlimited up to disk |
| `growth_mb` | `growth * 8 / 1024` | `int` | Growth increment per autogrow event, in MB when `is_percent_growth = 0` |
| `is_percent_growth` | `sys.master_files.is_percent_growth` | `bit` | When `1`, `growth` is a percentage of current size — avoid in production |

*Live capture against the local stoxx instance on 2026-04-11:*

| database_name | logical_name | type_desc | allocated_mb | max_size_mb | growth_mb | is_percent_growth |
|---|---|---|---|---|---|---|
| stoxx | stoxx_log | LOG | 1032 | 2097152 | 64 | False |
| stoxx | stoxx | ROWS | 712 | 0 | 64 | False |

The stoxx log file currently sits at 1032 MB with a `max_size_mb` ceiling of 2 TB (`2097152 MB`, which is the SQL Server log file maximum) and a 64 MB growth increment — the growth is in absolute MB rather than percent, which is the correct production pattern. The data file shows `max_size_mb = 0`, meaning the data file has growth disabled entirely and will not autogrow: any insert that exceeds 712 MB of data allocation will fail with OS error 1105 until the ceiling is raised. This is the configured state of the demo instance and is intentionally conservative. On a real production database you want data files at `max_size = -1` (or an explicit ceiling below the disk size) and growth in fixed MB chunks of at least 256 MB to avoid autogrow thrashing on high-ingestion workloads.

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `max_size_mb` | `0` | warning | Growth disabled | File cannot autogrow; any alloc beyond `allocated_mb` fails |
| `max_size_mb` | `-1` | watch | Unlimited (up to disk) | OK for controlled environments, risky if disk has no alerting |
| `max_size_mb` | fixed value | normal | Explicit ceiling | Ideal if ceiling is below disk capacity with headroom |
| `is_percent_growth` | `False` | normal | Absolute growth increment | Predictable; prefer this in production |
| `is_percent_growth` | `True` | warning | Percent-based growth | Later autogrows take exponentially longer; avoid |
| `growth_mb` | `< 64` | warning | Growth increment too small | Autogrow fires too often, thrashing the workload |
| `growth_mb` | `64 – 1024` | normal | Reasonable for mid-size workloads | Match to expected write burst per autogrow interval |
| `growth_mb` | `> 4096` | watch | Large increment | Fine if disk is fast; pauses the workload during autogrow |

#### Identify sessions holding open transactions

When `log_reuse_wait_desc` returns `ACTIVE_TRANSACTION` and you need to find the specific session to kill or wait out. It is typically triggered by the reuse-wait audit names `ACTIVE_TRANSACTION` and log usage is climbing toward 85%. T-SQL session; requires `VIEW SERVER STATE`. Read-only, negligible cost, even on busy instances. List every session with an open transaction, the age of the transaction, and enough identifying metadata (login, host, program) to decide whether it is a legitimate long-running ETL batch or an orphaned pyodbc connection that must be killed.

*List every user session currently holding an open transaction, with transaction age in seconds.*

```sql
SELECT
    s.session_id,
    s.login_name,
    s.host_name,
    s.program_name,
    s.status,
    s.open_transaction_count,
    DATEDIFF(SECOND, t.transaction_begin_time, SYSUTCDATETIME()) AS tx_age_seconds,
    tst.is_user_transaction
FROM sys.dm_exec_sessions s
LEFT JOIN sys.dm_tran_session_transactions tst ON s.session_id = tst.session_id
LEFT JOIN sys.dm_tran_active_transactions t ON tst.transaction_id = t.transaction_id
WHERE s.is_user_process = 1
  AND s.open_transaction_count > 0;
```

| Field | Source column | Type | Meaning |
|---|---|---|---|
| `session_id` | `sys.dm_exec_sessions.session_id` | `smallint` | Session identifier (spid); pass to `KILL` |
| `login_name` | `sys.dm_exec_sessions.login_name` | `nvarchar(128)` | SQL or Windows login owning the session |
| `host_name` | `sys.dm_exec_sessions.host_name` | `nvarchar(128)` | Client host that opened the connection |
| `program_name` | `sys.dm_exec_sessions.program_name` | `nvarchar(128)` | Application string sent by the client driver |
| `status` | `sys.dm_exec_sessions.status` | `nvarchar(30)` | `running`, `sleeping`, `dormant`, `preconnect` |
| `open_transaction_count` | `sys.dm_exec_sessions.open_transaction_count` | `int` | Number of `BEGIN TRAN` nesting levels |
| `tx_age_seconds` | computed | `int` | Seconds since the transaction began (UTC-safe) |
| `is_user_transaction` | `sys.dm_tran_session_transactions.is_user_transaction` | `bit` | `1` = user-started, `0` = implicit/system |

*Live capture against the local stoxx instance on 2026-04-11:*

```text
(0 rows)
```

At capture time no session on `stoxx` had an open transaction, which is the healthy baseline. During an incident this query is the one that tells you which session to `KILL`: look for `status = sleeping` combined with `tx_age_seconds > 60` and a `program_name` matching a pipeline script (e.g. `Python`, `pyodbc`, `Dapper`), which is the signature of an orphaned transaction where the client has disconnected without committing. A `running` session with a short `tx_age_seconds` is legitimate in-flight work — do not kill it unless you have confirmed with the owning team.

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `status` | `running` | normal | Session is actively executing | Legitimate work; do not kill without confirmation |
| `status` | `sleeping` | watch | Session is idle between statements | Normal if `tx_age_seconds` is small |
| `status` | `sleeping` + `tx_age_seconds > 60` | warning | Idle session holding transaction open | Candidate for kill if no one claims it |
| `status` | `sleeping` + `tx_age_seconds > 600` | critical | Almost certainly orphaned | Kill after a 1-minute warning to Slack |
| `open_transaction_count` | `1` | normal | Single-level transaction | Usual case |
| `open_transaction_count` | `> 1` | watch | Nested `BEGIN TRAN` | Common in stored procs; matches `COMMIT`/`ROLLBACK` depth |

#### Take an emergency log backup to free VLF space

> [!danger] Emergency log backup during a live incident
>
> `BACKUP LOG` under `FULL` recovery is the correct fix for `log_reuse_wait_desc = LOG_BACKUP`, but it writes to disk and competes with the failing workload for I/O. Running it on the same volume that is almost full can push used space past the disk boundary and cause `BACKUP LOG` itself to fail. Always write the emergency backup to a **different** volume or a mounted network share, never the same volume as the log file.

> [!success] Routing emergency log backups off the data volume
>
> Configure `filelocation.defaultbackupdir` to a dedicated backup volume (e.g. `/backup/mssql`) so that any `BACKUP LOG` without an explicit `TO DISK` path lands on a volume with guaranteed headroom. For true emergencies, stream directly to a mounted GCS FUSE bucket (`gs://stoxx-sql-bucket/stoxx/log/`) — the backup will take longer but will not compete with the failing workload for local I/O.

After the reuse-wait audit has named `LOG_BACKUP`, and only after confirming the target backup path has free space. It is typically triggered by used_log_pct above 85% and the log backup job has not run for more than 30 minutes. T-SQL session via `sqlcmd`, `pyodbc`, or SSMS. State-changing: writes to disk. Requires `BACKUP DATABASE` permission on the target database. Free the VLFs holding already-committed log records so the log file can be reused, which is the only way to resolve error 9002 without shrinking or detaching.

*Run an emergency log backup of stoxx to the backup directory, using compression and checksum.*

```sql
BACKUP LOG stoxx
TO DISK = '/var/opt/mssql/backup/stoxx_log_emergency.trn'
WITH COMPRESSION, CHECKSUM, INIT,
     NAME = N'stoxx emergency log backup',
     STATS = 10;
```

> [!info] This cell is not live-captured from an incident
>
> The command is shown in its operationally-correct form, but running it during the refactor would have rotated the stoxx log backup chain used by other notes. Instead, the recent backup history of `stoxx` (including several routine log backups) is captured below from `msdb.dbo.backupset` as proof that the log chain is intact. During a real incident, capture the `BACKUP LOG` completion message from the session output into your runbook trail.

*Show the ten most recent backups of stoxx, with type, size, LSN range, and physical device.*

```sql
SELECT TOP 10
    bs.database_name,
    bs.type AS backup_type_code,
    CASE bs.type
        WHEN 'D' THEN 'Full'
        WHEN 'I' THEN 'Diff'
        WHEN 'L' THEN 'Log'
        WHEN 'F' THEN 'File'
        WHEN 'G' THEN 'FileDiff'
        WHEN 'P' THEN 'PartialFull'
        WHEN 'Q' THEN 'PartialDiff'
        ELSE 'Other'
    END AS backup_type,
    bs.backup_start_date,
    bs.backup_finish_date,
    CAST(bs.backup_size / 1024.0 / 1024.0 AS DECIMAL(12,2)) AS backup_size_mb,
    bs.first_lsn,
    bs.last_lsn,
    bs.database_backup_lsn,
    bmf.physical_device_name
FROM msdb.dbo.backupset bs
LEFT JOIN msdb.dbo.backupmediafamily bmf ON bs.media_set_id = bmf.media_set_id
WHERE bs.database_name = 'stoxx'
ORDER BY bs.backup_start_date DESC;
```

| Field | Source column | Type | Meaning |
|---|---|---|---|
| `database_name` | `msdb.dbo.backupset.database_name` | `sysname` | Database that was backed up |
| `backup_type_code` | `backupset.type` | `char(1)` | Raw single-character type code |
| `backup_type` | computed | `varchar(20)` | Decoded name from the type code enum |
| `backup_start_date` | `backupset.backup_start_date` | `datetime` | Local time the backup began |
| `backup_finish_date` | `backupset.backup_finish_date` | `datetime` | Local time the backup completed |
| `backup_size_mb` | `backupset.backup_size / 1048576` | `decimal(12,2)` | Uncompressed logical size of the backup |
| `first_lsn` | `backupset.first_lsn` | `numeric(25,0)` | First LSN captured in this backup |
| `last_lsn` | `backupset.last_lsn` | `numeric(25,0)` | Last LSN captured in this backup |
| `database_backup_lsn` | `backupset.database_backup_lsn` | `numeric(25,0)` | LSN of the full backup this log/diff backup chains from |
| `physical_device_name` | `msdb.dbo.backupmediafamily.physical_device_name` | `nvarchar(260)` | Disk path or URL of the backup media |

*Live capture against the local stoxx instance on 2026-04-11:*

| database_name | backup_type_code | backup_type | backup_start_date | backup_finish_date | backup_size_mb | first_lsn | last_lsn | database_backup_lsn | physical_device_name |
|---|---|---|---|---|---|---|---|---|---|
| stoxx | L | Log | 2026-04-11 16:32:21 | 2026-04-11 16:32:21 | 0.12 | 397000001750400001 | 397000001756800001 | 397000001744800001 | /var/opt/mssql/backup/stoxx_log_004.trn |
| stoxx | L | Log | 2026-04-11 16:32:19 | 2026-04-11 16:32:19 | 0.30 | 397000001700000001 | 397000001750400001 | 397000001744800001 | /var/opt/mssql/backup/stoxx_log_003.trn |
| stoxx | D | Full | 2026-04-11 16:31:07 | 2026-04-11 16:31:08 | 620.36 | 397000001744800001 | 397000001747200001 | 397000001732800001 | s3://storage.googleapis.com/stoxx-sql-bucket/stoxx/full/stoxx_full.bak |
| stoxx | D | Full | 2026-04-11 16:31:05 | 2026-04-11 16:31:06 | 598.13 | 397000001732800001 | 397000001735200001 | 397000001720800001 | /var/opt/mssql/backup/stoxx_encrypted.bak |
| stoxx | D | Full | 2026-04-11 16:30:48 | 2026-04-11 16:30:48 | 600.24 | 397000001720800001 | 397000001723200001 | 397000001668800001 | /var/opt/mssql/backup/stoxx_striped_1.bak |

The top two rows show consecutive log backups with contiguous LSN ranges (`last_lsn` of row 2 equals `first_lsn` of row 1), proving the log chain is unbroken — the defining property of a restorable backup sequence. In a real incident you would use this query to answer two questions at once: "when did the log chain last succeed" and "is each log backup's `database_backup_lsn` pointing at a full backup we still have." An `L` row whose `database_backup_lsn` points at a full that was deleted is an orphan and cannot be restored, which is a silent failure mode distinct from the `LOG_BACKUP` reuse-wait symptom.

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `backup_type_code` | `D` | reference | Full database backup | Base of any restore sequence |
| `backup_type_code` | `I` | reference | Differential, rolls up changes since last full | Shortens restore time vs applying all logs |
| `backup_type_code` | `L` | reference | Transaction log backup | Required for point-in-time recovery and log truncation |
| `backup_type_code` | `F` | reference | File-level backup | Used with filegroup restore, rare in analytics workloads |
| `backup_type_code` | `G` | reference | File differential | Paired with `F` |
| `backup_type_code` | `P` | reference | Partial full (filegroup subset) | Advanced pattern |
| `backup_type_code` | `Q` | reference | Partial differential | Paired with `P` |
| `last_lsn` of row N == `first_lsn` of row N-1 | equal | normal | Chain intact | Restorable sequence |
| `last_lsn` != `first_lsn` of next | gap | critical | Log chain broken | No point-in-time recovery between the gap LSNs |
| `database_backup_lsn` on a log row | matches a `D` row | normal | Log rolls forward from a known full | Valid restore path |
| `database_backup_lsn` on a log row | orphan | warning | Full backup missing | Log cannot be applied |

#### Terminate an orphaned session holding the log

> [!danger] Killing sessions during a live incident
>
> `KILL <spid>` immediately terminates the session and starts rolling back its transaction. The rollback can take as long as the original transaction's forward progress (linear in work done) and during rollback the session continues to hold locks and log space. Killing a session that has been doing bulk inserts for 20 minutes may take another 20 minutes to complete, and the log continues to grow during rollback. Only kill sessions where rollback is acceptable.

> [!success] Confirming rollback progress after KILL
>
> After running `KILL <spid>`, poll `KILL <spid> WITH STATUSONLY` every few seconds to see the rollback percentage. If the percentage is not advancing, the session is stuck in an undoable state (e.g. waiting on I/O from a failed volume) and the correct next step is a SQL Server service restart, not more aggressive kill commands. Never use `KILL WITH STATUSONLY` as the first step — it requires the session to already be in rollback.

Only after the open-transactions query has confirmed the session is orphaned (sleeping, long-lived, program name matches a known pipeline script) and the owning team has been notified. It is typically triggered by `log_reuse_wait_desc = ACTIVE_TRANSACTION`, `tx_age_seconds > 300`, session status `sleeping`. T-SQL session, `ALTER ANY CONNECTION` or `sysadmin` required. State-changing and irreversible for the target session. Release the log hold by forcing the orphaned session to roll back, after which `log_reuse_wait_desc` should drop back to `NOTHING` within one or two checkpoint intervals.

*Terminate the session holding the long-running transaction; replace 62 with the actual spid from the open-transactions query.*

```sql
KILL 62;
```

*Check rollback progress after the KILL fires.*

```sql
KILL 62 WITH STATUSONLY;
```

> [!info] This cell is not live-captured
>
> Running `KILL` against an active session on the stoxx instance would interrupt other teaching sessions, so the two commands are shown without captured output. The expected behavior is: `KILL 62` returns immediately with no result set, and `KILL 62 WITH STATUSONLY` returns a single-row result containing the rollback progress as a percentage and an estimated completion time.

#### Shrink the log file only as a last resort

> [!danger] DBCC SHRINKFILE fragments the log
>
> `DBCC SHRINKFILE` on the log file removes inactive VLFs and returns the space to the filesystem, but the resulting VLF layout is fragmented with many small VLFs. That fragmentation degrades future log write performance and makes the next autogrow event more expensive. Shrink the log only when disk space is critically low and you have already taken the emergency log backup; never automate log shrink.

> [!success] Regrow the log to its operational size immediately after shrink
>
> After an emergency shrink, use `ALTER DATABASE stoxx MODIFY FILE (NAME = stoxx_log, SIZE = 10240MB)` to regrow the log to its normal operational size in one allocation. This replaces the fragmented post-shrink VLFs with a clean VLF layout (16 or 32 VLFs depending on size) and prevents the fragmentation from persisting. Then schedule log backups every 15 minutes via `sp_add_schedule` so the log never fills again.

Only after `BACKUP LOG` has already succeeded and `used_log_pct` is still above 90% and the underlying disk is below the 5% free threshold. It is typically triggered by disk-level free space alert concurrent with the log fullness incident. T-SQL session against the affected database. State-changing, allocates no new pages but triggers file-level shrinking. Return freed VLF space to the operating system so the disk regains headroom, bridging until the regrow step restores a clean layout.

*Shrink the stoxx log file down to 1 GB; run only after a successful emergency log backup and only during a disk-space emergency.*

```sql
USE stoxx;
DBCC SHRINKFILE (stoxx_log, 1024);
```

*Regrow the log in a single allocation to the operational ceiling, which produces a clean VLF layout.*

```sql
ALTER DATABASE stoxx
MODIFY FILE (NAME = stoxx_log, SIZE = 10240MB);
```

> [!info] Not live-captured on stoxx
>
> Shrinking and regrowing the stoxx log would disturb other teaching notes, so these two DDL cells are shown without embedded output. Both commands return no rows on success; on failure, `DBCC SHRINKFILE` raises error 8985 if the target size is larger than the current used space and the shrink is a no-op.

---

### SQL Server | concurrent transactions | deadlock during ETL

Two pipeline sessions acquire locks on the same pair of objects in opposite order and SQL Server detects the cycle in its waits-for graph. The lock manager scans the waits-for graph every 5 seconds; when it finds a cycle, it picks the session with the lowest `DEADLOCK_PRIORITY` (or the cheapest rollback cost as a tiebreaker) as the victim, terminates that session's transaction, and returns error 1205 to its client. The surviving session continues to its commit. The canonical ETL pattern that produces this is: session 1 `UPDATE silver.index_constituents` acquires an X lock on row A, then tries to update row B in the same table or a related one; session 2 was already holding an X lock on B from its own update and is now waiting on A. Under `READ_COMMITTED` isolation (SQL Server default), writer-writer deadlocks are the common case; reader-writer deadlocks only happen when a `SELECT` holds locks across statements (via `SERIALIZABLE`, `REPEATABLE READ`, or explicit `HOLDLOCK` hints) or when the database has not enabled RCSI.

The severity is critical because a deadlock in the overnight pipeline produces a silent partial load — the victim's transaction rolls back cleanly, but the Airflow task's retry logic often masks the error, and the next run may succeed on stale upstream data. Without monitoring the `system_health` Extended Events session and inspecting the `xml_deadlock_report` payload, the engineering team has no record of what was happening at the time, and the incident is typically closed as "transient."

#### Reproduce a deadlock against stoxx to capture the symptoms

During note rewrites, post-mortem reproductions, or when teaching the deadlock pattern to new engineers. Never run against a production database. It is typically triggered by a production deadlock incident where the `system_health` ring buffer does not contain the event (ring buffer rotated) and you need a fresh captured example to compare against. `race_demo.py` with two concurrent sessions. Creates and drops throwaway `dbo.race_deadlock_a` and `dbo.race_deadlock_b` tables, both state-changing. Requires `db_owner` on `stoxx`. Prove that a writer-writer deadlock produces error 1205 at the client and a corresponding `xml_deadlock_report` event in the `system_health` ring buffer, and demonstrate that `DEADLOCK_PRIORITY LOW` deterministically selects the low-priority session as the victim.

> [!info]- Why two tables and opposite lock order
>
> The demo uses two tables rather than two rows in the same table because intra-table deadlocks often resolve via page-level lock escalation before the waits-for graph forms a cycle, which makes them hard to reproduce reliably on a small dataset. With two separate tables, each session acquires an X lock on its first table's row, waits a deterministic 2 seconds, then tries to acquire the other table's row — this gives the deadlock monitor enough time to observe the cycle in its 5-second scan. The `WAITFOR DELAY` timings are intentionally staggered (100 ms for S1, 500 ms for S2) so S1 always touches A first and S2 always touches B first, making the cycle deterministic rather than probabilistic.

*Session 1 sets low deadlock priority, begins a transaction, updates race_deadlock_a first, then tries to update race_deadlock_b after a 2-second wait.*

```sql
SET DEADLOCK_PRIORITY LOW;
BEGIN TRANSACTION;
WAITFOR DELAY '00:00:00.100';
UPDATE dbo.race_deadlock_a SET qty = qty - 10 WHERE id = 1;
WAITFOR DELAY '00:00:02';
UPDATE dbo.race_deadlock_b SET qty = qty - 10 WHERE id = 1;
SELECT 'session1_committed' AS outcome;
COMMIT;
```

*Session 2 keeps default deadlock priority, begins a transaction, updates race_deadlock_b first, then tries to update race_deadlock_a after a 2-second wait.*

```sql
SET DEADLOCK_PRIORITY NORMAL;
BEGIN TRANSACTION;
WAITFOR DELAY '00:00:00.500';
UPDATE dbo.race_deadlock_b SET qty = qty - 20 WHERE id = 1;
WAITFOR DELAY '00:00:02';
UPDATE dbo.race_deadlock_a SET qty = qty - 20 WHERE id = 1;
SELECT 'session2_committed' AS outcome;
COMMIT;
```

*Live captures from `race_demo.py` against the local stoxx instance on 2026-04-11. Session 1 (LOW) was chosen as the deadlock victim; session 2 (NORMAL) committed.*

Session 1 output:

```text
('40001', '[40001] [Microsoft][ODBC Driver 18 for SQL Server][SQL Server]Transaction (Process ID 56) was deadlocked on lock resources with another process and has been chosen as the deadlock victim. Rerun the transaction. (1205) (SQLMoreResults)')
```

Session 2 output:

| outcome |
|---|
| session2_committed |

Post-race state showing that session 1's update rolled back and session 2's updates (`-20` on both tables) are the only changes that took effect:

| stage | a_qty | b_qty |
|---|---|---|
| after_deadlock | 80 | 180 |

`race_deadlock_a` started at `100`; the final value `80` equals `100 − 20`, confirming that session 1's `−10` update rolled back with the rest of its transaction and only session 2's `−20` update persisted. Similarly `race_deadlock_b` went from `200` to `180`, again matching session 2's `−20` update with no trace of session 1. The deadlock monitor's choice was deterministic: `DEADLOCK_PRIORITY LOW` made session 1 the victim regardless of rollback-cost tiebreaker, and the `40001` SQL state with embedded `1205` is the exact shape every pyodbc driver surfaces on a deadlock kill.

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `DEADLOCK_PRIORITY` | `LOW` | option | Lowest priority; always the victim when paired with NORMAL or HIGH | Use on reports and dashboards |
| `DEADLOCK_PRIORITY` | `NORMAL` | default | Default for new sessions | No change needed |
| `DEADLOCK_PRIORITY` | `HIGH` | option | Highest priority; always survives when paired with NORMAL or LOW | Use on critical writers (batch loaders) |
| `DEADLOCK_PRIORITY` | `-10` to `10` | option | Numeric priority scale; `-5` = LOW, `0` = NORMAL, `5` = HIGH | Fine-grained control when more than two tiers are needed |
| Error number | `1205` | critical | Deadlock victim | Retry with exponential backoff |
| SQL state | `40001` | reference | Serialization failure (ANSI SQLSTATE) | Maps to retriable errors in most drivers |

#### Verify the deadlock is recorded in system_health ring buffer

Immediately after a deadlock incident has been observed by the client, or during a reproduction session to validate capture. It is typically triggered by error 1205 observed in a pyodbc.Error, Dapper SqlException, or SQL Agent job output. T-SQL session, read-only against the `system_health` Extended Events session. Requires `VIEW SERVER STATE`. Confirm that SQL Server captured the `xml_deadlock_report` event in the ring buffer so the deadlock graph can be extracted and analyzed offline.

> [!info]- system_health ring buffer mechanics
>
> `system_health` is an always-on Extended Events session that SQL Server starts automatically and never stops. Its ring buffer target keeps the most recent events in memory (roughly 5 MB by default), including every `xml_deadlock_report` that fires. When the ring buffer fills, oldest events are discarded. For production monitoring you should also configure a file target so deadlocks are not lost during restart or ring buffer rotation — see [16-deadlock-detection-and-prevention](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/03-Query-Writing-and-Optimization/deadlock-detection-and-prevention) for the setup.

*Count the xml_deadlock_report events currently in the system_health ring buffer.*

```sql
SELECT
    s.name AS session_name,
    CAST(CAST(t.target_data AS XML).value(
        'count(/RingBufferTarget/event[@name="xml_deadlock_report"])',
        'INT') AS INT) AS deadlock_events_in_ring
FROM sys.dm_xe_session_targets t
JOIN sys.dm_xe_sessions s ON t.event_session_address = s.address
WHERE s.name = 'system_health'
  AND t.target_name = 'ring_buffer';
```

| Field | Source column | Type | Meaning |
|---|---|---|---|
| `session_name` | `sys.dm_xe_sessions.name` | `nvarchar(60)` | Always `system_health` in this filter |
| `target_name` | `sys.dm_xe_session_targets.target_name` | `nvarchar(60)` | Extended Events target type; this query filters to `ring_buffer` |
| `deadlock_events_in_ring` | XQuery count over `target_data` XML | `int` | Number of `xml_deadlock_report` events currently in the ring buffer |

*Live capture against stoxx immediately after the deadlock reproduction above — the count of 1 corresponds to the single deadlock the race demo produced.*

| session_name | deadlock_events_in_ring |
|---|---|
| system_health | 1 |
| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `deadlock_events_in_ring` | `0` | normal | No deadlock in the current ring buffer window | Either no deadlocks, or ring buffer rotated |
| `deadlock_events_in_ring` | `1 – 5` | watch | A few deadlocks in the current window | Extract the graphs, compare lock orders |
| `deadlock_events_in_ring` | `> 10` | warning | Sustained deadlock rate | Redesign lock order in the affected stored procedures |
| `deadlock_events_in_ring` | `> 50` | critical | Storm pattern | Pipeline is looping on retry without fixing the cause |

#### Extract and inspect deadlock graph XML

After confirming the ring buffer has non-zero deadlock events, to extract the actual waits-for graph and identify the resources and stored procedures involved. It is typically triggered by follow-up step to the ring buffer count query above, usually during post-mortem analysis. T-SQL session, read-only. The result set is XML — open each row in SSMS or extract with a Python XML parser for offline inspection. Find which objects (tables, pages, rows, keys) each session was holding and requesting, and which stored procedures or ad-hoc queries are producing the conflicting lock orders.

*Extract the xml_deadlock_report events from the system_health ring buffer as an XML column, one row per event.*

```sql
SELECT
    event_xml.value('(event/@timestamp)[1]', 'datetime2(3)') AS event_utc,
    event_xml.query('event/data[@name="xml_report"]/value/deadlock') AS deadlock_graph
FROM (
    SELECT CAST(target_data AS XML) AS target_data_xml
    FROM sys.dm_xe_session_targets t
    JOIN sys.dm_xe_sessions s ON t.event_session_address = s.address
    WHERE s.name = 'system_health'
      AND t.target_name = 'ring_buffer'
) AS rb
CROSS APPLY target_data_xml.nodes(
    '/RingBufferTarget/event[@name="xml_deadlock_report"]'
) AS e(event_xml)
ORDER BY event_utc DESC;
```

| Field | Source column | Type | Meaning |
|---|---|---|---|
| `event_utc` | `@timestamp` attribute | `datetime2(3)` | UTC timestamp at which the deadlock fired |
| `deadlock_graph` | nested `<deadlock>` element | `xml` | Full XML deadlock graph: `<victim-list>`, `<process-list>`, `<resource-list>` with locks, SPIDs, input buffers, and isolation levels |

The `<process-list>` inside each `<deadlock>` element is the most important part: each `<process>` has an `@id`, `@spid`, `@isolationlevel`, `@transactionname`, and an `<inputbuf>` element containing the actual SQL text the session was running. Match each process's locks in `<resource-list>` against the `<victim-list>` to reconstruct the waits-for cycle. Microsoft's official reference for the deadlock graph schema lives in the `SQLEngine/xe_deadlock_report` documentation — do not invent fields from the XML; look them up.

#### Enable Read Committed Snapshot Isolation to remove reader-writer deadlocks

> [!warning] RCSI enabling is a database-wide isolation change
>
> `ALTER DATABASE ... SET READ_COMMITTED_SNAPSHOT ON` requires exclusive database access (`ALTER DATABASE ... SET SINGLE_USER WITH ROLLBACK IMMEDIATE` first, or a maintenance window). After enabling, every `READ COMMITTED` session reads from the row-version store in TempDB instead of acquiring shared locks. This changes the meaning of `READ COMMITTED` from statement-level locking to statement-level versioning, and it will expose any application that was relying on reader-writer blocking as a synchronization primitive.

> [!success] Pre-size tempdb before enabling RCSI on a high-write database
>
> Before enabling RCSI, pre-size tempdb to at least 4 × the largest transaction's data volume and monitor `sys.dm_tran_version_store_space_usage.reserved_space_kb` daily for the first two weeks. A busy pipeline that runs `UPDATE`-heavy transforms can grow the version store by tens of GB per hour, and if tempdb runs out of space the affected transactions fail with error 3958 or 3966. See [11-memory-and-buffer-pool](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/01-Server-Operations/memory-and-buffer-pool) for tempdb sizing guidance.

During a planned maintenance window on a database that has reader-writer deadlocks as a recurring symptom and where tempdb capacity has been pre-sized. It is typically triggered by multiple days of LCK_M_S or LCK_M_U deadlocks in the system_health ring buffer, or sustained blocking chain incidents from dashboard SELECT queries against the pipeline writer. T-SQL session, requires `ALTER DATABASE` permission. State-changing and requires exclusive access briefly. Flip the database's default `READ_COMMITTED` isolation from locking-based to version-based so writers no longer block readers and the reader-writer class of deadlocks becomes impossible.

*Take exclusive access, enable RCSI, return to multi-user mode. Must be run during a maintenance window — do not run against stoxx without explicit user approval.*

```sql
ALTER DATABASE stoxx SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
ALTER DATABASE stoxx SET READ_COMMITTED_SNAPSHOT ON;
ALTER DATABASE stoxx SET MULTI_USER;
```

*Verify RCSI is now active on stoxx.*

```sql
SELECT name, is_read_committed_snapshot_on, snapshot_isolation_state_desc
FROM sys.databases
WHERE name = 'stoxx';
```

> [!info] RCSI not enabled on stoxx during this refactor
>
> The `stoxx` database has `READ_COMMITTED_SNAPSHOT` intentionally disabled because enabling it would change the concurrency semantics for every other note that teaches deadlocks, blocking, and isolation levels against this instance. The sibling `stoxx_db` database has RCSI on and is the reference for any note that specifically teaches RCSI behavior. The DDL cells above are shown in their production-correct form but are not executed as part of this refactor.

#### Add deadlock retry logic to pipeline clients

During code review of any new Python or C# code that writes to SQL Server from the pipeline or API layer, and as a retroactive hardening step on existing code. It is typically triggered by first occurrence of a 1205 error in production logs, or routine code review on pipeline task PRs. Application code, not SQL. Python via `pyodbc`, C# via `Dapper` + `Polly`. Changes are idempotent: wrapping a block in retry logic does not affect correct behavior. Ensure that a deadlock victim retries the transaction instead of propagating the 1205 error to Airflow, which would mark the task failed and require manual intervention even when the retry would succeed.

*Python pyodbc wrapper that retries on error 1205 with exponential backoff, up to 3 attempts.*

```python
import logging
import time
import pyodbc


def execute_with_deadlock_retry(
    conn_str: str,
    sql: str,
    params: tuple = (),
    max_retries: int = 3,
    base_delay: float = 0.5,
) -> None:
    for attempt in range(max_retries):
        try:
            with pyodbc.connect(conn_str, autocommit=False) as conn:
                cursor = conn.cursor()
                cursor.execute(sql, params)
                conn.commit()
                return
        except pyodbc.Error as exc:
            is_deadlock = "1205" in str(exc)
            if is_deadlock and attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)
                logging.warning(
                    "Deadlock detected on attempt %d, retrying in %.2fs",
                    attempt + 1,
                    delay,
                )
                time.sleep(delay)
                continue
            raise
```

*C# Dapper wrapper using Polly's `Handle<SqlException>` to retry on error 1205 with exponential backoff.*

```csharp
using Polly;
using Polly.Retry;

AsyncRetryPolicy retryPolicy = Policy
    .Handle<SqlException>(ex => ex.Number == 1205)
    .WaitAndRetryAsync(
        retryCount: 3,
        sleepDurationProvider: attempt =>
            TimeSpan.FromMilliseconds(500 * Math.Pow(2, attempt)),
        onRetry: (exception, timeSpan, attempt, context) =>
            logger.LogWarning(
                "Deadlock victim, retry {Attempt} in {Delay}ms",
                attempt,
                timeSpan.TotalMilliseconds));

await retryPolicy.ExecuteAsync(async () =>
{
    using SqlConnection conn = new(connectionString);
    await conn.ExecuteAsync(sql, parameters);
});
```

> [!info] Client code cells are not live-captured
>
> Both the Python and C# code cells above describe the structure of deadlock-safe client code; they do not produce live output as part of this note because they would require a long-running Python or .NET process on the repo's test harness. The deadlock capture above (from `race_demo.py`) is the proof that the 1205 error is the actual shape that reaches the client on a real deadlock.

---

### SQL Server | data file | disk exhaustion during bulk load

The data volume hosting the ROWS filegroup reaches 100% capacity during an overnight bulk load. SQL Server tries to allocate a new extent, the autogrow event fires, the filesystem reports no free space, the autogrow fails, and every INSERT on the affected filegroup aborts with OS error 112 (disk full) or 1101 (could not allocate a new page). The pipeline halts, the Airflow DAG marks tasks failed, and because the gold layer has not been refreshed the morning publication uses yesterday's values. Common root causes include unexpected input volume (a new index universe onboarded without resizing estimates), log file growth eating into the same volume (if data and log share a disk — a configuration anti-pattern that still exists in 2026), tempdb runaway growth on the same volume, retention policies that never ran, or percent-based autogrow amplifying small input bursts into gigabyte allocations.

The severity is critical for the same reason as log fullness: every second spent full is a second of write failures and regulatory exposure. Unlike log fullness, data file fullness has a harder recovery path: you cannot simply `BACKUP LOG` to free space, and `DBCC SHRINKFILE` on data files fragments indexes and is strongly discouraged as a routine operation. The correct response is usually to widen the ceiling (raise `MAX_SIZE`), resize the underlying volume online, or archive cold partitions out of the hot filegroup.

#### Audit data file allocation and free space

During any disk-space incident on the SQL Server host, or as a weekly capacity-planning check. It is typically triggered by disk-level free space alert, OS error 112 in the pipeline log, or `sp_spaceused` showing a filegroup above 85% utilization. T-SQL session, read-only. `FILEPROPERTY` reads the file header and does not touch the file pages, so cost is negligible. Quantify allocated vs used vs free space per data file, so you can decide whether to widen the ceiling, resize the volume, or archive data.

*Show allocated MB, used MB, and free MB for every data and log file in the stoxx database.*

```sql
SELECT
    mf.name AS logical_name,
    mf.physical_name,
    mf.type_desc,
    mf.size * 8 / 1024 AS allocated_mb,
    CAST(FILEPROPERTY(mf.name, 'SpaceUsed') * 8 / 1024 AS INT) AS used_mb,
    CAST((mf.size - FILEPROPERTY(mf.name, 'SpaceUsed')) * 8 / 1024 AS INT) AS free_mb,
    CAST(mf.max_size AS BIGINT) * 8 / 1024 AS max_size_mb,
    mf.growth * 8 / 1024 AS growth_mb,
    mf.is_percent_growth
FROM sys.master_files mf
WHERE mf.database_id = DB_ID('stoxx')
ORDER BY mf.type_desc, mf.name;
```

| Field | Source column | Type | Meaning |
|---|---|---|---|
| `logical_name` | `sys.master_files.name` | `sysname` | Logical file name used in DDL |
| `physical_name` | `sys.master_files.physical_name` | `nvarchar(260)` | Absolute path on disk |
| `type_desc` | `sys.master_files.type_desc` | `nvarchar(60)` | `ROWS`, `LOG`, `FILESTREAM`, `FULLTEXT` |
| `allocated_mb` | `size * 8 / 1024` | `int` | Currently reserved from the filesystem, in MB |
| `used_mb` | `FILEPROPERTY('SpaceUsed') * 8 / 1024` | `int` | Used pages, in MB. `FILEPROPERTY` returns 8-KB pages |
| `free_mb` | `(size - FILEPROPERTY('SpaceUsed')) * 8 / 1024` | `int` | Unused pages still inside the allocated file, in MB |
| `max_size_mb` | `max_size * 8 / 1024` | `bigint` | Ceiling for autogrow; `0` = no growth, `-1` = unlimited |
| `growth_mb` | `growth * 8 / 1024` | `int` | Per-autogrow increment in MB when `is_percent_growth = 0` |
| `is_percent_growth` | `sys.master_files.is_percent_growth` | `bit` | `1` = `growth` is a percent; avoid in production |

> [!info] Query requires USE stoxx for FILEPROPERTY
>
> `FILEPROPERTY` is database-scoped and only returns values for files in the current database. Running the above query via a runner that connects to `stoxx` by default (as `run_queries.py` does) works as-is. Running it from `master` would return `NULL` for the `used_mb` and `free_mb` columns even though `sys.master_files` shows every file on the instance.

*Live capture against the local stoxx instance on 2026-04-11 via run_queries.py (which connects with `DATABASE=stoxx`, so FILEPROPERTY resolves):*

| logical_name | physical_name | type_desc | allocated_mb | used_mb | free_mb | max_size_mb | growth_mb | is_percent_growth |
|---|---|---|---|---|---|---|---|---|
| stoxx_log | /var/opt/mssql/data/stoxx_log.ldf | LOG | 1032 | 12 | 1019 | 2097152 | 64 | False |
| stoxx | /var/opt/mssql/data/stoxx.mdf | ROWS | 712 | 596 | 115 | 0 | 64 | False |

The stoxx data file is 83.7% full (596 MB used of 712 MB allocated) with 115 MB of headroom — already tight for a production workload and about to become a hard boundary. Note the `max_size_mb = 0` (growth disabled); any write that needs more than 115 MB of fresh allocation on the next autogrow attempt will fail with error 1105. The log file is at 1.2% used with 1 TB of ceiling, which is the opposite profile: over-provisioned on the log side, under-provisioned on the data side. A real production configuration should aim for 20–30% free on the data files at all times and have autogrow enabled with an explicit ceiling well below the disk capacity.

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `free_mb / allocated_mb` | `> 30%` | normal | Healthy headroom | No action |
| `free_mb / allocated_mb` | `15 – 30%` | watch | Approaching the planning threshold | Verify retention policy is running |
| `free_mb / allocated_mb` | `< 15%` | warning | File will autogrow soon | Confirm disk has capacity for the growth event |
| `free_mb / allocated_mb` | `< 5%` | critical | Autogrow window is closing | Raise the ceiling or archive data now |
| `max_size_mb` | `0` | warning | Growth disabled | Any write exceeding `free_mb` fails with error 1105 |
| `growth_mb` | `< 64` and `is_percent_growth = 0` | warning | Increment too small | Causes autogrow thrashing |
| `is_percent_growth = 1` | any | warning | Percent growth | Exponential growth, unpredictable pauses |

#### Identify the largest tables in a filegroup

After confirming the data file is near full, to decide which objects to archive, repartition, or move to a different filegroup. It is typically triggered by filegroup utilization above 85% and no obvious runaway table. T-SQL session, read-only. `sys.allocation_units` and `sys.partitions` are lightweight metadata reads; the query aggregates them and should return within seconds on instances with tens of thousands of objects. Produce a ranked list of tables by allocated page count, so you can target the biggest consumers with archive or compression operations first.

*List the top 10 largest tables in stoxx by total allocated MB, with used MB, index type, and row count.*

```sql
SELECT TOP 10
    SCHEMA_NAME(t.schema_id) + '.' + t.name AS table_name,
    SUM(a.total_pages) * 8 / 1024 AS total_mb,
    SUM(a.used_pages) * 8 / 1024 AS used_mb,
    SUM(a.data_pages) * 8 / 1024 AS data_mb,
    MAX(p.rows) AS row_count
FROM sys.tables t
JOIN sys.indexes i ON t.object_id = i.object_id
JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
JOIN sys.allocation_units a ON (
    (a.type IN (1, 3) AND a.container_id = p.hobt_id)
 OR (a.type = 2 AND a.container_id = p.partition_id)
)
WHERE t.is_ms_shipped = 0
GROUP BY t.schema_id, t.name
ORDER BY total_mb DESC;
```

| Field | Source column | Type | Meaning |
|---|---|---|---|
| `table_name` | `SCHEMA_NAME(schema_id) + '.' + sys.tables.name` | `nvarchar` | Two-part name of the base table |
| `total_mb` | `SUM(allocation_units.total_pages) * 8 / 1024` | `int` | Total allocated pages across rowstore, LOB, and row-overflow allocation units |
| `used_mb` | `SUM(allocation_units.used_pages) * 8 / 1024` | `int` | Pages actually in use (excludes internal fragmentation) |
| `data_mb` | `SUM(allocation_units.data_pages) * 8 / 1024` | `int` | Pages containing leaf rowstore data |
| `row_count` | `MAX(sys.partitions.rows)` | `bigint` | Approximate row count per partition; `MAX` collapses multi-partition tables |

*Live capture against the local stoxx instance on 2026-04-11, top 10 rows:*

| table_name | total_mb | used_mb | data_mb | row_count |
|---|---|---|---|---|
| dbo.demo_idxmaint_rowstore | 413 | 411 | 409 | 671550 |
| dbo.demo_idxmaint_missing | 94 | 93 | 93 | 671550 |
| dbo.demo_idxmaint_splits | 23 | 22 | 22 | 100000 |
| dbo.demo_eurostoxx50_ohlcv | 7 | 6 | 6 | 67155 |
| silver.eurostoxx50_ohlcv | 7 | 7 | 7 | 67155 |
| silver.stoxxasia50_ohlcv | 7 | 7 | 7 | 64875 |
| silver.stoxxusa50_ohlcv | 7 | 7 | 7 | 66000 |
| dbo.demo_idxmaint_usage | 4 | 4 | 4 | 50000 |
| dbo.demo_idxmaint_columnstore | 2 | 1 | 0 | 129716 |
| silver.oil20_ohlcv | 2 | 2 | 2 | 25080 |

`dbo.demo_idxmaint_rowstore` dominates at 413 MB — 58% of the entire `stoxx` data file footprint, leftover from another note's demo workload. The second-place `demo_idxmaint_missing` adds another 94 MB, bringing the two index-maintenance demo tables to 71% of the entire file. In a real incident this output is what tells you where the bytes are: look for one or two tables that together contain more than 50% of the filegroup, then decide whether they can be partitioned out to a cold filegroup, compressed (page or columnstore), or archived to blob storage. A healthy analytics database usually has a long-tail distribution where the top 10 tables account for 80–90% of storage; a flat distribution suggests demo or scratch objects that were never cleaned up.

#### Resize the underlying disk online via gcloud

> [!warning] Disk resize is the preferred fix over shrink-and-archive
>
> When the data volume is full but the database is still growing legitimately, the correct first move is to resize the disk, not to delete data or shrink the data file. GCE persistent disks support online resize (no VM restart, no downtime), and ext4 supports online `resize2fs`. Deleting data to make room is only the right call when retention policy has lapsed; shrinking a data file fragments every index in it and is appropriate only as a last resort after the emergency has passed.

> [!success] Match the disk growth to the filegroup growth trajectory
>
> Resize the disk to the next round size that gives at least 90 days of headroom at the current growth rate — not just enough to clear the immediate alert. Repeated small resize events waste operator time and leave the system in a state where every disk resize is visible as a production incident. After the resize, set an automated monitor on `sys.dm_io_virtual_file_stats` + filesystem free space and alert at 70%, 80%, and 90% utilization so the next resize is planned, not reactive.

During a disk-full incident or proactively when the data volume crosses 80% utilization with no retention job scheduled. It is typically triggered by filesystem alert on `/data/mssql`, or the data file audit above showing `free_mb < 15%` of `allocated_mb`. GCP Console or `gcloud` CLI on a workstation with `compute.disks.update` IAM permission. State-changing on the infrastructure layer. The disk resize completes in seconds; the ext4 `resize2fs` completes in under a minute for a 500-GB volume. Give the filesystem more headroom so SQL Server's next autogrow event succeeds and normal write operations resume without any data movement.

*Resize the GCE persistent disk backing /data/mssql from 500 GB to 1 TB with no downtime.*

```bash
gcloud compute disks resize sql-server-data-disk \
    --size=1000GB \
    --zone=europe-west1-b
```

*Extend the ext4 filesystem online on the Linux VM so SQL Server sees the new space.*

```bash
sudo growpart /dev/sdb 1
sudo resize2fs /dev/sdb1
df -h /data/mssql
```

> [!info] Infrastructure commands are not live-captured
>
> The `gcloud` and Linux filesystem commands are for the production environment described in the opening narrative; they do not run against the local stoxx Docker container. The operational shape and expected output for `df -h` after a successful resize is a single line showing the new filesystem size and reduced utilization percentage.

#### Raise the data file ceiling via ALTER DATABASE

After the disk resize has succeeded and `df -h` confirms the new capacity, or as a proactive action during capacity planning when you know the workload will exceed the current `MAX_SIZE`. It is typically triggered by data file at `max_size_mb` and autogrow failing with error 1105. T-SQL session, requires `ALTER DATABASE` permission. State-changing but does not allocate pages; it only lifts the ceiling. Allow subsequent autogrow events to succeed up to the new ceiling, without requiring the DBA to intervene on every growth cycle.

*Lift the stoxx data file ceiling to 400 GB and set the growth increment to 2 GB per autogrow event.*

```sql
ALTER DATABASE stoxx
MODIFY FILE (NAME = stoxx, MAXSIZE = 400GB, FILEGROWTH = 2048MB);
```

*Verify the new ceiling and growth policy are in effect.*

```sql
SELECT name, size * 8 / 1024 AS allocated_mb,
       CAST(max_size AS BIGINT) * 8 / 1024 AS max_size_mb,
       growth * 8 / 1024 AS growth_mb,
       is_percent_growth
FROM sys.master_files
WHERE database_id = DB_ID('stoxx') AND type_desc = 'ROWS';
```

> [!info] ALTER DATABASE not executed against stoxx
>
> Lifting the stoxx data file ceiling would change state for every other teaching note running against this instance. The DDL cells above are shown in their production-correct form but are not executed. In a real incident, the expected effect is: the `ALTER DATABASE` completes in under a second, the verify query shows the new `max_size_mb` and `growth_mb`, and the next autogrow event succeeds up to the new ceiling.

---

### SQL Server | backup set | corruption and untested restore

Nightly full backups run to GCS via a bash script and report success every morning for months. Then a disk failure forces a restore, and the team discovers the backup file cannot be opened: either the GCS upload silently truncated files above the gsutil chunk limit, or the backup was written without `CHECKSUM` and a bit-rot in the file went undetected, or the backup was never actually restorable because the process only ever ran `BACKUP DATABASE` and never ran `RESTORE VERIFYONLY`. SQL Server's `BACKUP` command reports success as soon as the bytes are flushed to the backup device; it does not validate that those bytes round-trip through `RESTORE`. `RESTORE VERIFYONLY` reads the backup header and, when the backup was taken with `WITH CHECKSUM`, re-checks the page checksums — but it can only check what was captured, and a backup taken without `WITH CHECKSUM` has no checksum to verify. Corruption can enter through OS-level I/O errors, upload truncation, file-permission issues causing partial writes, stale `msdb.dbo.backupset` entries pointing at files that were deleted, and hardware flips on the backup media.

The severity is maximum because a missing or corrupt backup converts any data-loss incident into total data loss. All bronze, silver, gold data plus stored procedures, schema, and audit history gone; recovery from upstream feeds is days to weeks; regulatory exposure under BMR is severe because the calculation history must be auditable. The only defense is active: `WITH CHECKSUM` on every backup, `RESTORE VERIFYONLY WITH CHECKSUM` immediately after every backup completes, periodic `DBCC CHECKDB` to catch corruption at the source before it enters the backup chain, and quarterly restore drills where the backup is actually rehydrated onto a separate instance.

#### Take a verifiable full backup with checksum and stats

As the routine nightly backup, or manually before any risky operation (major schema change, partition switch, DDL deployment). It is typically triggered by scheduled SQL Server Agent job, or on-demand before a high-risk change window. T-SQL session, `BACKUP DATABASE` permission. State-changing: writes to the backup device. Can run concurrently with production workload but competes for I/O; prefer scheduling outside peak hours. Produce a backup file that (a) contains data page checksums, (b) is compressed to reduce storage cost, and (c) reports its progress via `STATS` so the operator can see how far along a long-running backup is.

*Back up the stoxx database to a checksum-verified compressed backup file on the backup volume.*

```sql
BACKUP DATABASE stoxx
TO DISK = '/var/opt/mssql/backup/stoxx_refactor_demo.bak'
WITH COMPRESSION, CHECKSUM, INIT,
     NAME = N'stoxx refactor demo full',
     STATS = 10;
```

> [!info] Backup cell not executed during the refactor
>
> Running this `BACKUP DATABASE` would add a new entry to `msdb.dbo.backupset` and rotate the stoxx backup chain that other teaching notes depend on. The command is shown in its production-correct form. The recent backup history captured in Problem 1's log-backup-history cell shows the actual backup entries for stoxx, including a real `BACKUP DATABASE stoxx` that ran at 16:31:07 on 2026-04-11 (620.36 MB, 4-second runtime).

#### Verify an existing backup without restoring it

Immediately after every `BACKUP DATABASE` or `BACKUP LOG`, and again before any restore operation when you want to confirm the backup is still intact. It is typically triggered by routine post-backup verification step, or the first step of a disaster recovery procedure. T-SQL session, requires permission to read the backup file. Read-only against the backup device; does not touch the database. Cost is proportional to the backup file size (SQL Server reads every page). Confirm the backup header is readable, the LSN range is consistent, and — when the backup was taken with `WITH CHECKSUM` — every page's checksum matches the stored value.

*Verify an existing stoxx log backup file; this form does NOT re-check page checksums because the backup was not taken with WITH CHECKSUM.*

```sql
RESTORE VERIFYONLY FROM DISK = '/var/opt/mssql/backup/stoxx_log_004.trn';
```

*Live capture against the local stoxx instance on 2026-04-11. A successful VERIFY returns no result set:*

```text
(no result set)
```

*Verify the same backup file again but add WITH CHECKSUM — this fails because the original backup was not taken with a checksum.*

```sql
RESTORE VERIFYONLY FROM DISK = '/var/opt/mssql/backup/stoxx_log_004.trn' WITH CHECKSUM;
```

*Live capture showing the exact error the operator sees when a backup without an embedded checksum is asked to verify one:*

```text
('42000', '[42000] [Microsoft][ODBC Driver 18 for SQL Server][SQL Server]RESTORE WITH CHECKSUM cannot be specified because the backup set does not contain checksum information. (3187) (SQLExecDirectW); [42000] [Microsoft][ODBC Driver 18 for SQL Server][SQL Server]VERIFY DATABASE is terminating abnormally. (3013)')
```

This is the teaching moment. The first form silently succeeds, telling the operator "the file is readable," but it does not inspect the bytes against checksums — a bit-flip anywhere inside the data pages goes undetected. The second form asks SQL Server to do real verification and fails with error 3187 because the backup was taken without `WITH CHECKSUM`, meaning there is nothing to verify against. Every production backup must be taken with `WITH CHECKSUM` so the second form returns success; a production operator who sees error 3187 should treat that backup as untrusted and re-run the backup with `WITH CHECKSUM` immediately.

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `RESTORE VERIFYONLY` | no result set | success | Backup file header readable, LSN range consistent | Backup is structurally valid |
| `RESTORE VERIFYONLY` | error 3189 | failure | Backup set is damaged | Backup is not restorable; re-run backup |
| `RESTORE VERIFYONLY WITH CHECKSUM` | no result set | success | All page checksums match | Backup is fully verified |
| `RESTORE VERIFYONLY WITH CHECKSUM` | error 3187 | misconfigured | Backup was not taken with CHECKSUM | Re-run backup with `WITH CHECKSUM` |
| `RESTORE VERIFYONLY WITH CHECKSUM` | error 3183 | corruption | Checksum mismatch on a data page | Backup is corrupt; discard and re-take |

#### Read the backup header to inspect metadata

During disaster recovery triage (is this the backup I expect?), during routine audit of stale backup files, or when verifying that a file has been copied correctly. It is typically triggered by uncertainty about which backup is which, unknown provenance of a backup file pulled from blob storage, or confirmation that a file is still readable after a transfer. T-SQL session, read-only, fast (header is at the start of the file). Extract the backup set metadata (database name, LSN range, compatibility level, collation, checksum flag) so the operator can decide whether this file belongs to the restore sequence they are building.

*Read the header metadata of the stoxx log backup file.*

```sql
RESTORE HEADERONLY FROM DISK = '/var/opt/mssql/backup/stoxx_log_004.trn';
```

| Field | Source column | Type | Meaning |
|---|---|---|---|
| `BackupName` | `BackupName` | `nvarchar(128)` | Friendly name set via `WITH NAME = ...` |
| `BackupType` | `BackupType` | `tinyint` | `1` = Full, `2` = Log, `4` = File, `5` = Diff, `6` = File Diff, `7` = Partial, `8` = Partial Diff |
| `DatabaseName` | `DatabaseName` | `sysname` | Name of the source database |
| `BackupSize` | `BackupSize` | `numeric(20,0)` | Uncompressed logical size in bytes |
| `CompressedBackupSize` | `CompressedBackupSize` | `bigint` | Compressed size on disk |
| `FirstLSN` | `FirstLSN` | `numeric(25,0)` | First LSN in this backup |
| `LastLSN` | `LastLSN` | `numeric(25,0)` | Last LSN in this backup |
| `CheckpointLSN` | `CheckpointLSN` | `numeric(25,0)` | LSN at which a checkpoint was taken during the backup |
| `DatabaseBackupLSN` | `DatabaseBackupLSN` | `numeric(25,0)` | The full backup this backup chains from; critical for restore path validation |
| `HasBackupChecksums` | `HasBackupChecksums` | `bit` | `1` = backup was taken with `WITH CHECKSUM` |
| `IsCopyOnly` | `IsCopyOnly` | `bit` | `1` = taken with `WITH COPY_ONLY`; does not affect the normal backup chain |
| `CompressionAlgorithm` | `CompressionAlgorithm` | `nvarchar(32)` | `MS_XPRESS` (SQL 2008+ native) or empty for uncompressed |
| `KeyAlgorithm` | `KeyAlgorithm` | `nvarchar(32)` | Encryption algorithm (`NULL` for unencrypted) |
| `EncryptorThumbprint` | `EncryptorThumbprint` | `varbinary(20)` | Certificate thumbprint used to encrypt the backup |
| `BackupStartDate` / `BackupFinishDate` | same | `datetime` | When the backup started and finished |

*Live capture against stoxx showing the header of `stoxx_log_004.trn` (selected columns shown for readability — the full result set has 59 columns):*

| BackupName | BackupType | DatabaseName | CompressedBackupSize | FirstLSN | LastLSN | DatabaseBackupLSN | HasBackupChecksums | IsCopyOnly | CompressionAlgorithm |
|---|---|---|---|---|---|---|---|---|---|
| stoxx log 004 contains after_pitr_target | 2 | stoxx | 36201 | 397000001750400001 | 397000001756800001 | 397000001744800001 | False | False | MS_XPRESS |

`BackupType = 2` confirms this is a log backup; `HasBackupChecksums = False` explains why the `RESTORE VERIFYONLY WITH CHECKSUM` failed earlier; `DatabaseBackupLSN = 397000001744800001` points at the full backup this log chains from. The compressed size (36 KB) is tiny because the log range was small; `CompressionAlgorithm = MS_XPRESS` confirms the SQL Server native compression algorithm was used.

#### Run DBCC CHECKDB to detect corruption at the source

> [!danger] CHECKDB on a production database is expensive
>
> `DBCC CHECKDB` walks every allocation unit and re-validates page structure, pointer consistency, and table-index consistency. On a multi-hundred-GB database it can take hours and will compete for memory and I/O with the production workload. On the `stoxx` demo instance (712 MB total data) it completes in seconds. On a production analytics_db the recommended pattern is `WITH PHYSICAL_ONLY` for nightly runs and a full `CHECKDB` once per week during the quietest maintenance window.

> [!success] Offload CHECKDB to a restored copy on a separate instance
>
> The safest pattern for busy production instances is to restore the most recent backup to a separate "dbcc" instance (different host, different volume) and run `CHECKDB` there. If CHECKDB finds corruption on the restored copy but the source database is healthy, the backup file itself is corrupt. If CHECKDB finds the same corruption on both, the source has a real physical page defect and you need to run `CHECKDB WITH REPAIR_ALLOW_DATA_LOSS` (as a last resort) or restore from an older, clean backup.

Weekly during the lowest-traffic maintenance window, or immediately after an I/O error is reported in the SQL Server error log, or before any high-stakes change that depends on the database being known-good. It is typically triggered by scheduled maintenance job, or I/O error 824/825 in the error log, or unexplained `DBCC CHECKDB` consistency errors surfaced by other processes. T-SQL session. Read-heavy; requires snapshot creation on supported editions or exclusive access otherwise. Fast on small databases; expensive on large ones. Detect and surface every logical and physical consistency error SQL Server can find, so corruption is caught at the source before it enters the backup chain and becomes an unrecoverable loss.

*Run a full DBCC CHECKDB against the stoxx database with no info messages and all error messages.*

```sql
DBCC CHECKDB ('stoxx') WITH NO_INFOMSGS, ALL_ERRORMSGS;
```

> [!info] CHECKDB output not embedded in this note
>
> A successful `DBCC CHECKDB` returns no rows and no informational messages (that is the point of `NO_INFOMSGS`). The pyodbc runner prints `(no result set)` on success. On a healthy database this is the only expected output. On a corrupted database the output includes one or more error messages naming the affected allocation unit, page, and index, and the operator would need to decide whether to restore from a known-good backup or run `CHECKDB WITH REPAIR_ALLOW_DATA_LOSS` (which does exactly what the name says). The command was not executed against stoxx during the refactor to avoid masking its result if another concurrent note runs it later today.

---

### SQL Server | TDE certificate | lost and blocking restore

A database has Transparent Data Encryption (TDE) enabled to satisfy the EU BMR compliance requirement for data at rest. The host fails catastrophically and must be rebuilt from scratch. The team restores the `.bak` file from blob storage successfully — the file is intact, the checksum verifies, the header reads. Then `RESTORE DATABASE` fails with error 33111 (`Cannot find server certificate with thumbprint '0x...'`), because TDE encrypts the database encryption key (DEK) with a certificate that lives only in the `master` database of the original instance. The certificate was never backed up. The `.bak` file is now a sealed encrypted blob that no one can open, and the data is permanently lost. This incident is unrecoverable by design — the whole point of TDE is that without the certificate and its private key, the data is unreadable.

The severity is maximum: an encrypted backup without the certificate is total data loss regardless of how many copies of the `.bak` file exist. All calculation history, index weights, ESG scores, and audit trail are gone; the backup files become cryptographic noise. The regulatory exposure under BMR is severe because historical index calculation data must be retained and auditable for years. The only defense is preventive: immediately after creating the TDE certificate on the source instance, back up both the certificate and its private key to a password-protected file pair, store them in a separate access-controlled location (not on the same host, not in the same bucket as the database backups), and automate the backup of both the certificate and its password as part of routine maintenance.

#### Audit TDE state on the instance and every database

During routine security audits, before any restore or migration, and as the first step in TDE certificate rotation. It is typically triggered by quarterly compliance audit, pre-migration checklist, or investigation after any database restore failure with error 33111. T-SQL session, requires `VIEW SERVER STATE`. Read-only, negligible cost. Enumerate every database with TDE enabled, the encryption state, and the thumbprint of the certificate protecting each DEK so you can cross-reference against the certificates actually present in `master`.

*Show TDE encryption state and encryptor thumbprint for every database on the instance.*

```sql
SELECT
    DB_NAME(dek.database_id) AS database_name,
    dek.encryption_state_desc,
    dek.key_algorithm,
    dek.key_length,
    dek.encryptor_type,
    dek.encryptor_thumbprint,
    dek.create_date,
    dek.set_date
FROM sys.dm_database_encryption_keys dek
ORDER BY database_name;
```

| Field | Source column | Type | Meaning |
|---|---|---|---|
| `database_name` | `DB_NAME(database_id)` | `sysname` | Database name; `tempdb` appears here if any database is encrypted (tempdb is always encrypted when any user db is) |
| `encryption_state_desc` | `sys.dm_database_encryption_keys.encryption_state_desc` | `nvarchar(60)` | `UNENCRYPTED`, `ENCRYPTION_IN_PROGRESS`, `ENCRYPTED`, `KEY_CHANGE_IN_PROGRESS`, `DECRYPTION_IN_PROGRESS` |
| `key_algorithm` | `key_algorithm` | `nvarchar(60)` | `AES_128`, `AES_192`, `AES_256`, `TRIPLE_DES_3KEY` (deprecated) |
| `key_length` | `key_length` | `int` | Bits of the symmetric DEK (128, 192, 256) |
| `encryptor_type` | `encryptor_type` | `nvarchar(60)` | `CERTIFICATE` or `ASYMMETRIC KEY` — tells you what to look up in `master.sys.certificates` vs `master.sys.asymmetric_keys` |
| `encryptor_thumbprint` | `encryptor_thumbprint` | `varbinary(32)` | SHA1/SHA256 thumbprint of the encryptor; this is the exact value the restore operation will complain about if missing |
| `create_date` | `create_date` | `datetime` | When the DEK was created on this database |
| `set_date` | `set_date` | `datetime` | When the current encryptor was last set; changes during certificate rotation |

*Live capture against the local stoxx instance on 2026-04-11:*

```text
(0 rows)
```

The `stoxx` instance has no databases with TDE enabled — `sys.dm_database_encryption_keys` returns zero rows. This is the common state for analytics and teaching workloads where encryption at rest is handled by the disk layer rather than inside SQL Server. A production instance configured for BMR compliance would return one row per user database and expect `encryption_state_desc = ENCRYPTED` with `key_algorithm = AES_256` and a user-created `encryptor_thumbprint` that matches a row in `master.sys.certificates`.

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `encryption_state_desc` | `UNENCRYPTED` | reference | TDE not active on this database | No DEK to worry about |
| `encryption_state_desc` | `ENCRYPTION_IN_PROGRESS` | transient | Initial encryption sweep is running | Do not fail over or restart mid-sweep |
| `encryption_state_desc` | `ENCRYPTED` | normal | Steady state for TDE databases | Certificate backup is mandatory |
| `encryption_state_desc` | `KEY_CHANGE_IN_PROGRESS` | transient | DEK rotation is in progress | Do not restart instance; wait for completion |
| `encryption_state_desc` | `DECRYPTION_IN_PROGRESS` | transient | TDE is being turned off | Backup chain is changing; watch CHECKDB |
| `key_algorithm` | `AES_256` | normal | Current best-practice algorithm | Recommended for new databases |
| `key_algorithm` | `AES_128` | acceptable | Older default | Rotate to AES_256 during planned maintenance |
| `key_algorithm` | `TRIPLE_DES_3KEY` | warning | Deprecated | Rotate urgently, SQL Server is removing support |
| `encryptor_type` | `CERTIFICATE` | normal | DEK protected by cert in master | Back up `master.sys.certificates` entry |
| `encryptor_type` | `ASYMMETRIC KEY` | normal | DEK protected by asymmetric key (typically EKM/HSM-backed) | Back up asymmetric key metadata and vendor material |

#### List certificates present in master for cross-reference

As the second step of the TDE audit, to cross-reference which certificates actually exist on the instance against which certificates the databases expect. It is typically triggered by follow-up to the TDE encryption keys audit; also used when preparing to back up a TDE certificate. T-SQL session, read-only against `master.sys.certificates`. Requires `VIEW DEFINITION` on the certificate or `sysadmin`. Confirm the encryptor thumbprint referenced by each DEK is actually present in `master` with a usable private key, so a future `BACKUP CERTIFICATE ... WITH PRIVATE KEY` command can succeed.

*Show every certificate in master whose private key is present, with thumbprint, start date, and expiry date.*

```sql
SELECT
    name AS certificate_name,
    thumbprint,
    start_date,
    expiry_date,
    pvt_key_encryption_type_desc,
    issuer_name
FROM master.sys.certificates
WHERE pvt_key_encryption_type_desc IS NOT NULL
ORDER BY name;
```

| Field | Source column | Type | Meaning |
|---|---|---|---|
| `certificate_name` | `sys.certificates.name` | `sysname` | Certificate name used in `BACKUP CERTIFICATE` commands |
| `thumbprint` | `sys.certificates.thumbprint` | `varbinary(32)` | SHA1/SHA256 thumbprint — must match the `encryptor_thumbprint` from `sys.dm_database_encryption_keys` |
| `start_date` / `expiry_date` | same | `datetime` | Certificate validity window |
| `pvt_key_encryption_type_desc` | `sys.certificates.pvt_key_encryption_type_desc` | `nvarchar(60)` | `ENCRYPTED_BY_MASTER_KEY`, `ENCRYPTED_BY_PASSWORD`, `NO_PRIVATE_KEY` — `NO_PRIVATE_KEY` certificates cannot be backed up with private key |
| `issuer_name` | `sys.certificates.issuer_name` | `nvarchar(442)` | Self-signed shows the certificate name; CA-signed shows the CA distinguished name |

*Live capture against the local stoxx instance on 2026-04-11, top 5 rows — the instance only has the Microsoft-built-in signing certificates:*

| certificate_name | thumbprint | start_date | expiry_date | pvt_key_encryption_type_desc | issuer_name |
|---|---|---|---|---|---|
| `##MS_SQLResourceSigningCertificate##` | 4130f1510e90d8531259ea316af1c72aec0f9f88 | 2026-01-23 04:20:25 | 2027-01-23 04:20:25 | NO_PRIVATE_KEY | MS_SQLResourceSigningCertificate |
| `##MS_SQLReplicationSigningCertificate##` | 73e8eaa529d46beacd3798fad563a3e5c073e0d9 | 2026-01-23 04:20:26 | 2027-01-23 04:20:26 | NO_PRIVATE_KEY | MS_SQLResourceSigningCertificate |
| `##MS_SQLAuthenticatorCertificate##` | fb352a9f00a184bb298335da791977222f703b73 | 2026-01-23 04:20:26 | 2027-01-23 04:20:26 | NO_PRIVATE_KEY | MS_SQLAuthenticatorCertificate |
| `##MS_AgentSigningCertificate##` | e9e7ce50e40d926d4c26ad1f67b9794a1121a180 | 2026-01-23 04:22:32 | 2027-01-23 04:22:32 | NO_PRIVATE_KEY | MS_AgentSigningCertificate |
| `##MS_PolicySigningCertificate##` | 21d265e78ac1a4aa51fcd4be101653ab3512d281 | 2026-01-23 04:20:26 | 2027-01-23 04:20:26 | NO_PRIVATE_KEY | MS_PolicySigningCertificate |

Every row has `pvt_key_encryption_type_desc = NO_PRIVATE_KEY` and every `issuer_name` is `MS_*`, which means these are the built-in signing certificates SQL Server installs automatically for internal operations (resource signing, replication, agent jobs, policy-based management). None of them protect a user database's DEK, and none of them can be backed up with `BACKUP CERTIFICATE ... WITH PRIVATE KEY` because they have no private key to back up. A production instance with user TDE would show at least one additional row with a user-chosen `certificate_name`, `pvt_key_encryption_type_desc = ENCRYPTED_BY_MASTER_KEY`, and a matching thumbprint in `sys.dm_database_encryption_keys`.

#### Back up the TDE certificate with its private key

> [!danger] TDE certificate backup is the single point of recovery
>
> If the host fails before the certificate has been backed up, the TDE-protected database backups become permanently inaccessible — no amount of forensic recovery will open an encrypted backup without the certificate. Treat the certificate backup as more important than the database backup itself, and store it in a location that cannot fail at the same time as the source instance (different bucket, different region, different credentials).

> [!success] Bind certificate backup to the weekly maintenance window
>
> Automate `BACKUP CERTIFICATE` as a step in the weekly SQL Agent maintenance job, uploading both files (public `.cer` and encrypted private key `.pvk`) to a certificate-dedicated GCS bucket with a retention policy of at least 10 years (longer than the database backup retention). Store the `ENCRYPTION BY PASSWORD` secret in GCP Secret Manager or HashiCorp Vault with a separate IAM role from the one that can read the `.pvk` — separation of duties means an attacker who compromises the bucket cannot also decrypt the private key.

Immediately after creating the TDE certificate, and again after every certificate rotation. It is typically triggered by `CREATE CERTIFICATE` executed on `master`, or scheduled weekly maintenance run. T-SQL session against `master`, requires `CONTROL` on the certificate. State-changing: writes two files to disk (`.cer` public certificate and `.pvk` private key encrypted with the supplied password). Produce a recovery artifact that allows the certificate to be restored on any other SQL Server instance so TDE-protected database backups remain openable.

*Back up the demo TDE certificate TDE_analytics_cert and its private key to files on the backup volume, encrypting the private key with a password stored in Secret Manager.*

```sql
USE master;

BACKUP CERTIFICATE TDE_analytics_cert
TO FILE = '/var/opt/mssql/backup/TDE_analytics_cert.cer'
WITH PRIVATE KEY (
    FILE = '/var/opt/mssql/backup/TDE_analytics_cert_key.pvk',
    ENCRYPTION BY PASSWORD = '<PASSWORD_FROM_GCP_SECRET_MANAGER>'
);
```

> [!info] TDE not configured on stoxx
>
> Enabling TDE on the stoxx container would disturb other teaching notes and require a restart. The `BACKUP CERTIFICATE` cell is shown in its production-correct form. The two audit cells above confirm there is no user TDE certificate present to back up — if TDE were enabled, `sys.dm_database_encryption_keys` would show the database's state, `master.sys.certificates` would contain the corresponding user certificate, and the `BACKUP CERTIFICATE` would produce a `.cer` and `.pvk` file pair. Microsoft's reference syntax for BACKUP CERTIFICATE is documented at `T-SQL/statements/backup-certificate-transact-sql`.

#### Restore the TDE certificate on a new instance before restoring the database

As the first step of disaster recovery onto a new instance, before `RESTORE DATABASE` is issued. It is typically triggered by rebuilding a SQL Server instance from a TDE-protected backup. T-SQL session against `master` on the new instance. Requires `CREATE CERTIFICATE` permission and access to the `.cer` and `.pvk` files plus the decryption password. Typically run as `sysadmin` during DR. Install the certificate into the new instance's `master` so SQL Server can decrypt the DEK embedded in the TDE-protected backup file and the subsequent `RESTORE DATABASE` succeeds.

*Step 1: create a Database Master Key in master on the new instance.*

```sql
USE master;
CREATE MASTER KEY ENCRYPTION BY PASSWORD = '<NEW_MASTER_KEY_PASSWORD>';
```

*Step 2: recreate the TDE certificate from the backed-up file pair, supplying the decryption password used during `BACKUP CERTIFICATE`.*

```sql
USE master;

CREATE CERTIFICATE TDE_analytics_cert
FROM FILE = '/var/opt/mssql/backup/TDE_analytics_cert.cer'
WITH PRIVATE KEY (
    FILE = '/var/opt/mssql/backup/TDE_analytics_cert_key.pvk',
    DECRYPTION BY PASSWORD = '<PASSWORD_FROM_GCP_SECRET_MANAGER>'
);
```

*Step 3: restore the TDE-protected database backup; this now succeeds because the certificate is in place.*

```sql
RESTORE DATABASE analytics_db
FROM DISK = '/var/opt/mssql/backup/analytics_db_full.bak'
WITH REPLACE, RECOVERY, STATS = 5;
```

> [!info] DR sequence not live-executed
>
> The three steps above are the production disaster-recovery flow for a TDE-protected database. They are not run against the stoxx instance because stoxx has no TDE configured and creating a demo certificate, master key, and restore would require restart and coordination with other notes. The error 33111 that this sequence prevents has the shape `Cannot find server certificate with thumbprint '<hex>'` and fires on `RESTORE DATABASE` if step 2 was skipped or the certificate's private key was not recoverable.

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| Error number | `33111` | critical | DEK encryptor missing from master | Run `CREATE CERTIFICATE ... FROM FILE` before retry |
| Error number | `15581` | critical | Service master key cannot decrypt | Master key password lost; unrecoverable |
| Error number | `15466` | warning | Certificate private key access denied | Check password and file permissions |
| Error number | `15315` | critical | Private key does not match certificate | Wrong `.pvk` for the `.cer`; recover correct pair |

---

## High — Data quality failure or degraded SLA

> [!abstract]- Summary
>
> These eight problems degrade data quality or performance severely enough to miss the publication SLA, corrupt silver or gold layers, or spike API latency — but unlike the Critical class they do not destroy data. The fix window is usually the same business day. Most of them have a clear diagnostic signal in the plan cache, Query Store, or a DMV query that can be run while the workload is still degraded; none require exclusive access to the database.

### SQL Server | bronze staging table | string or binary truncation error 8152

A vendor feed produces a wide distribution of string lengths: most `company_name` values fit in 100 characters, but one restructured holding company has a 143-character legal name. The Python pipeline batch-inserts 5,000 rows into a `bronze.company_master` table whose `company_name` column was defined `NVARCHAR(100)` years ago. SQL Server rejects the entire batch with `Msg 8152: String or binary data would be truncated in table 'analytics_db.bronze.company_master', column 'company_name'`. Under SQL Server 2019+ at compatibility level 150 the message includes the offending row's value; at earlier compatibility levels it does not, and identifying which column caused the failure requires a fan-out of `SELECT MAX(LEN(...))` probes against every `VARCHAR`/`NVARCHAR` column in the target table. Because `INSERT` is all-or-nothing per batch, no rows are loaded — not even the 4,999 that were valid — and the pipeline silently falls behind.

The severity is high because the bronze gap propagates downstream. Silver joins fail to find the missing constituents, gold aggregations use stale ESG scores, and if automated data-quality checks do not fail loud the error surfaces days later as "index weights were wrong last Tuesday." The fix is architectural: bronze staging tables should accept anything (`NVARCHAR(MAX)` or wide explicit ceilings), silver tables should enforce length constraints with explicit `LEFT(...)` truncation and logging, and pre-load validation in the pipeline should flag over-length rows before they reach SQL Server. The root cause is almost always a column definition written for the first vendor's data that was never revisited as the vendor universe expanded.

#### Confirm database compatibility level enables verbose error 8152

During the initial forensic pass after an 8152 error, and as a one-time audit when onboarding a new database. It is typically triggered by 8152 error in the pipeline log without the column name attached, or stakeholder asking which column caused a batch reject. T-SQL session, read-only. Requires `VIEW ANY DEFINITION` on the database. Confirm the database is at compatibility level 150 or higher so subsequent 8152 errors include the column name and truncated value in the message.

*Show the compatibility level and collation for the stoxx database.*

```sql
SELECT name, compatibility_level, collation_name
FROM sys.databases
WHERE name = 'stoxx';
```

| Field | Source column | Type | Meaning |
|---|---|---|---|
| `name` | `sys.databases.name` | `sysname` | Database name |
| `compatibility_level` | `sys.databases.compatibility_level` | `tinyint` | Compat level numeric code: 150 = SQL 2019, 160 = SQL 2022 |
| `collation_name` | `sys.databases.collation_name` | `nvarchar(128)` | Default collation for new columns |

*Live capture against the local stoxx instance on 2026-04-11:*

| name | compatibility_level | collation_name |
|---|---|---|
| stoxx | 160 | SQL_Latin1_General_CP1_CI_AS |

stoxx is at compatibility level 160 (SQL Server 2022), which means any future 8152 error will include the column name and truncated value directly in the message. A production database stuck at 140 (SQL Server 2017) or lower will return the legacy short message and force the operator to probe every column manually. Raising compatibility level is a one-line `ALTER DATABASE` and has no rollback cost for this specific message improvement — changes to cardinality estimator behavior are the bigger consideration when raising compatibility level in production.

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `compatibility_level` | `< 150` | legacy | Error 8152 message has no column name | Raise to 150 or update column probes per load |
| `compatibility_level` | `150` | acceptable | SQL Server 2019 features | Error 8152 is verbose; also enables scalar UDF inlining |
| `compatibility_level` | `160` | normal | SQL Server 2022 features | Current best practice on modern instances |

#### Probe which column would have been truncated

As the fallback when compatibility level is below 150 and error 8152 does not name the column, or as a proactive scan before bulk loads to find over-length rows. It is typically triggered by 8152 error without a named column, or onboarding a new vendor feed. T-SQL session against the staging table. Read-only. `MAX(LEN(...))` is table-scan cost proportional to staging table row count. Identify which string column in the batch has values longer than the target column width so the fix can widen the column or the pre-load validation can reject the offending rows.

*For every silver eurostoxx50 text column, print the maximum observed string length. Adapt the column list per table.*

```sql
SELECT
    MAX(LEN(symbol)) AS max_symbol_len
FROM silver.eurostoxx50_ohlcv;
```

*Live capture against the local stoxx instance on 2026-04-11 — `symbol` is the only text column in the OHLCV tables:*

| max_symbol_len |
|---|
| 5 |

All current ticker symbols on stoxx fit in 5 characters, well below the declared `VARCHAR(20)` ceiling, so the staging table has comfortable headroom. In a production incident against a misbehaving text column, this query would show a `max_len` value that equals or exceeds the column's declared width, matching the truncation failure. The operational pattern during an incident is to run this query against every `VARCHAR`/`NVARCHAR` column in the target table until one of them comes back with a length greater than the column's `max_length` (from `sys.columns`), then widen that column or reject the offending rows.

#### Widen or retype an offending column

> [!warning] ALTER COLUMN rewrites the entire table on some type changes
>
> Widening a string column within the same type family (`VARCHAR(100) → VARCHAR(500)`) is a metadata-only change, finishes in milliseconds, and does not rewrite the data pages. Changing between families (`VARCHAR → NVARCHAR`), changing collation, or going from a fixed length to variable length (`CHAR(10) → VARCHAR(20)`) is a full-table rewrite that acquires a schema modification lock and will block the pipeline until complete. Always test the specific change on a non-production copy first.

> [!success] Prefer VARCHAR(MAX) at bronze and explicit truncation at silver
>
> Use `NVARCHAR(MAX)` (or `VARCHAR(MAX)`) at the bronze staging layer so new vendor data never causes 8152 errors on ingestion. Enforce length constraints only at silver, where the `INSERT` applies `LEFT(NULLIF(RTRIM(x), ''), N)` and logs any truncated rows to a reject table. This design pushes length policy out of the physical schema and into the transform code, where it can be audited per-row.

After identifying the narrow column via the max-length probe, and only after confirming the widening is a metadata-only change (same type family). It is typically triggered by production 8152 error with an identified column and narrower ceiling than the real data range. T-SQL session, `ALTER` permission on the table. State-changing: schema modification lock is acquired briefly. Expand the column width so the staging load succeeds, without rewriting the existing data.

*Widen the hypothetical silver.company_master.company_name column from NVARCHAR(100) to NVARCHAR(500); metadata-only change.*

```sql
ALTER TABLE silver.company_master ALTER COLUMN company_name NVARCHAR(500) NULL;
```

> [!info] silver.company_master does not exist on stoxx
>
> The `company_master` table exists only in the narrative; stoxx uses `silver.index_dim` instead. The DDL above is shown as the production-correct pattern. To demonstrate the same operation live on stoxx, the equivalent would be `ALTER TABLE silver.index_dim ALTER COLUMN exchange NVARCHAR(50)` (the exchange column is declared `VARCHAR(20)`); it is not run here to avoid perturbing other notes that depend on the current schema.

---

### SQL Server | parameter binding | implicit NVARCHAR to VARCHAR conversion

A gold-layer API query filters on `WHERE instrument_isin = @isin` against a `VARCHAR(12)` column with a covering nonclustered index. The C# Dapper parameter `@isin` is bound as a .NET `string`, which Dapper maps to SQL Server `NVARCHAR` by default. SQL Server's data type precedence hierarchy ranks `NVARCHAR` above `VARCHAR`, so the optimizer applies `CONVERT_IMPLICIT(NVARCHAR(4000), instrument_isin)` to **every row of the column** before comparing against the parameter, which destroys the sargability of the predicate. The covering index becomes unusable, the optimizer falls back to a full table scan, and a query that should be a 2 ms index seek on 10 million rows becomes a 4-second scan. The first symptom at the application layer is API latency spikes under load; the diagnostic signature is a yellow warning on the `Seek Predicate` in the execution plan with the message `Type conversion in expression (...) may affect "SeekPlan" in query plan choice`.

The severity is high because the degradation scales with concurrency. A single slow query at 4 seconds is noticeable; ten concurrent slow queries saturate the 8-core instance at 100% CPU, starve other workloads, and trigger client-side circuit breakers that cascade into downstream systems. The fix is always at the parameter binding layer, not the database: force the client to bind `VARCHAR` explicitly via `DbString { IsAnsi = true }` in Dapper, `pyodbc.setinputsizes([pyodbc.SQL_VARCHAR])` in Python, or `AnsiString` in ADO.NET. Widening the column to `NVARCHAR` to "match" the client binding is the wrong fix; it doubles the storage footprint and breaks any downstream tool that expects ASCII identifiers.

#### Detect implicit conversions in the plan cache

During any investigation of CPU-bound query performance regressions, or proactively when onboarding a new application. It is typically triggered by unexplained CPU spike, plan cache filling with scans, or customer complaint about API latency. T-SQL session, requires `VIEW SERVER STATE`. The `LIKE '%CONVERT_IMPLICIT%'` filter against `query_plan` XML is expensive on large plan caches — run it during a low-traffic window if the instance has tens of thousands of cached plans. Count (and optionally list) all cached plans containing a `CONVERT_IMPLICIT` warning, so the highest-impact offenders can be prioritized for parameter binding fixes.

*Count cached plans that contain a CONVERT_IMPLICIT warning. On a production instance, extend the query with TOP N ORDER BY avg_logical_reads to list the worst offenders with their SQL text.*

```sql
SELECT COUNT(*) AS query_count
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_query_plan(qs.plan_handle) qp
WHERE CAST(qp.query_plan AS NVARCHAR(MAX)) LIKE '%CONVERT_IMPLICIT%';
```

| Field | Source column | Type | Meaning |
|---|---|---|---|
| `query_count` | `COUNT(*)` over `sys.dm_exec_query_stats` filtered by plan XML | `int` | Number of cached plans containing a `CONVERT_IMPLICIT` reference in the query plan XML |

*Live capture against the local stoxx instance on 2026-04-11:*

| query_count |
|---|
| 256 |

There are 256 cached plans on stoxx that contain a `CONVERT_IMPLICIT` operation somewhere in their XML. Not every `CONVERT_IMPLICIT` hit is a performance bug — some are legitimate (e.g. a `WHERE` clause comparing two typed columns). The real offenders are the ones whose conversion appears on a `Seek Predicate` node, making the seek into a scan. A production operational rule of thumb: any instance with more than 50 plans containing `CONVERT_IMPLICIT` deserves a walkthrough, and the distinct top 10 by `avg_logical_reads` are almost certainly worth fixing. Extending the query with a `TOP 10 ORDER BY qs.total_logical_reads / NULLIF(qs.execution_count, 0) DESC` ranks them by average I/O cost and is the standard triage pattern.

#### Bind string parameters as VARCHAR explicitly from client code

During code review of new queries, or as a retroactive fix after the plan-cache probe identifies a specific query as the offender. It is typically triggered by `CONVERT_IMPLICIT` warning in the execution plan of a high-frequency query. Application code (Python `pyodbc` or C# `Dapper`). Requires a redeploy of the client binary. Force the driver to send the parameter as ASCII `VARCHAR`, eliminating the type mismatch that triggers the column-side conversion.

*Python pyodbc using setinputsizes to force the first parameter to VARCHAR.*

```python
import pyodbc

with pyodbc.connect(CONN_STR) as conn:
    cursor = conn.cursor()
    cursor.setinputsizes([pyodbc.SQL_VARCHAR])
    cursor.execute(
        "SELECT * FROM gold.index_constituents WHERE instrument_isin = ?",
        isin_value,
    )
```

*C# Dapper using Dapper.DbString with IsAnsi=true to force a VARCHAR bind.*

```csharp
using Dapper;

var result = await conn.QueryAsync<Constituent>(
    "SELECT * FROM gold.index_constituents WHERE instrument_isin = @isin",
    new
    {
        isin = new DbString
        {
            Value = isinValue,
            IsAnsi = true,
            Length = 12,
            IsFixedLength = false,
        }
    });
```

> [!warning] Widening the column is the wrong fix
>
> It is tempting to "fix" the `CONVERT_IMPLICIT` warning by changing `instrument_isin` from `VARCHAR(12)` to `NVARCHAR(12)` so the column matches the client binding. This doubles the storage cost of the identifier column in every index that references it, breaks any downstream tool or external system that expects an ASCII 12-char ISIN, and does not address the underlying bug in the client binding. Always fix the client.

> [!success] Audit id-column types across silver and gold to prevent future regressions
>
> Run the `sys.columns` audit query (below) periodically to surface any new `NVARCHAR` id columns introduced by ad-hoc DDL. Standardize all identifier columns (ISIN, SEDOL, ticker, CUSIP, LEI) on `VARCHAR` with an explicit collation, and document the rule in the table-creation style guide so new tables do not drift.

*Audit all string columns in silver, gold, and dbo schemas for type consistency — ISIN and symbol columns should be VARCHAR, not NVARCHAR.*

```sql
SELECT TOP 10
    SCHEMA_NAME(t.schema_id) + '.' + t.name AS table_name,
    c.name AS column_name,
    ty.name AS data_type,
    c.max_length,
    c.collation_name
FROM sys.columns c
JOIN sys.tables t ON c.object_id = t.object_id
JOIN sys.types ty ON c.user_type_id = ty.user_type_id
WHERE ty.name IN ('char','varchar','nchar','nvarchar')
  AND SCHEMA_NAME(t.schema_id) IN ('silver','gold','dbo')
  AND t.is_ms_shipped = 0
ORDER BY table_name, column_name;
```

*Live capture against stoxx showing the first 8 rows — every listed column is `varchar`, never `nvarchar`, matching the "ASCII identifiers only" rule:*

| table_name | column_name | data_type | max_length | collation_name |
|---|---|---|---|---|
| dbo.bronze_ohlcv | batch_id | varchar | 36 | SQL_Latin1_General_CP1_CI_AS |
| dbo.bronze_ohlcv | symbol | varchar | 20 | SQL_Latin1_General_CP1_CI_AS |
| dbo.context_log | batch_id | varchar | 36 | SQL_Latin1_General_CP1_CI_AS |
| dbo.context_log | column_context | nvarchar | -1 | SQL_Latin1_General_CP1_CI_AS |
| dbo.context_log | data_warnings | nvarchar | -1 | SQL_Latin1_General_CP1_CI_AS |
| dbo.context_log | schema_version | varchar | 10 | SQL_Latin1_General_CP1_CI_AS |
| dbo.context_log | stage | varchar | 20 | SQL_Latin1_General_CP1_CI_AS |
| dbo.context_log | temporal_json | nvarchar | -1 | SQL_Latin1_General_CP1_CI_AS |

Identifier columns (`batch_id`, `symbol`, `schema_version`, `stage`) are all `varchar`, which is the production-correct type for ASCII-only business keys. Text-content columns (`column_context`, `data_warnings`, `temporal_json`) are `nvarchar(max)` because they may store arbitrary Unicode from upstream JSON payloads — the `-1` value in `max_length` is SQL Server's encoding of `MAX`. A production audit that returns any identifier column as `nvarchar` should trigger a review against the source binding code: either the column is legitimately multilingual (in which case the client binding must use `NVARCHAR`), or the column was misdeclared and should be narrowed to `varchar` before any high-volume query starts hitting it.

#### Flush the cached plan after the fix

Immediately after deploying the parameter binding fix, so the first execution recompiles with the correct types. It is typically triggered by code deployment of the Dapper/pyodbc fix. T-SQL session, requires `ALTER` permission on the referenced object. State-changing on the plan cache only. Evict the bad cached plan so the next execution builds a new plan using the corrected parameter binding, which will now produce a seek instead of a scan.

*Mark a table's cached plans for recompile; the next query that references gold.index_constituents will produce a fresh plan.*

```sql
EXEC sp_recompile 'gold.index_constituents';
```

> [!info] sp_recompile cell shown but not executed
>
> `gold.index_constituents` does not exist on stoxx; the operational form is shown for completeness. On stoxx the equivalent live target would be `EXEC sp_recompile 'silver.eurostoxx50_ohlcv'`, which would invalidate every cached plan that references that table. Running it during the refactor was skipped to avoid perturbing other teaching sessions.

---

### SQL Server | stored procedure plan cache | parameter sniffing regression

A stored procedure that accepts a filter parameter with highly skewed cardinality — one flagship value matches 8,000 rows, another boutique value matches 12 — gets compiled on its first execution using whichever parameter value happened to be passed. That value and its cardinality estimate are "sniffed" and baked into the cached plan. Every subsequent execution reuses the cached plan regardless of the actual parameter value, so if the first call was with the flagship value the plan allocates 8 parallel threads, a large memory grant, and hash joins — all catastrophic for the 12-row case that takes 800 ms to do what should be a 1 ms seek. The inverse is equally bad: if the first call was boutique, the plan is a serial nested loop that takes 40 seconds on the flagship. The signature in Query Store is a single `query_id` with one plan and an `avg_duration` that looks bimodal when split by `param_name`; in the DMVs the signature is a high-variance `total_elapsed_time / execution_count` that swings every time the cache is flushed and re-sniffed.

The severity is high because it makes execution time non-deterministic and breaks SLA compliance in unpredictable ways. The same procedure that ran in 1 ms yesterday takes 40 seconds today with no code change. Query Store is the essential forensic tool because it captures every plan compilation event with its parameter value and preserves history across plan cache flushes, which the live DMVs do not. The fixes are well understood: `OPTION(RECOMPILE)` for the simplest cases, `OPTION(OPTIMIZE FOR UNKNOWN)` when recompile cost is too high, and Query Store plan forcing (`sp_query_store_force_plan`) when a specific good plan exists.

#### Audit Query Store state on the database

As the first step of any performance-regression investigation, or during the initial health check on a new production database. It is typically triggered by a query runtime has visibly changed day over day, or forensic review of yesterday's slow period. T-SQL session, read-only against `sys.database_query_store_options`. Requires `VIEW DATABASE STATE`. Confirm Query Store is active, in read-write mode, has sufficient storage, and is not in cleanup mode that would have discarded the historical plans needed for root cause analysis.

*Show the current Query Store options for the active database.*

```sql
SELECT
    actual_state_desc,
    desired_state_desc,
    CAST(current_storage_size_mb AS INT) AS current_storage_size_mb,
    CAST(max_storage_size_mb AS INT) AS max_storage_size_mb,
    query_capture_mode_desc,
    size_based_cleanup_mode_desc,
    stale_query_threshold_days,
    wait_stats_capture_mode_desc
FROM sys.database_query_store_options;
```

| Field | Source column | Type | Meaning |
|---|---|---|---|
| `actual_state_desc` | `sys.database_query_store_options.actual_state_desc` | `nvarchar(60)` | Current operational state: `OFF`, `READ_ONLY`, `READ_WRITE`, `ERROR` |
| `desired_state_desc` | `sys.database_query_store_options.desired_state_desc` | `nvarchar(60)` | What the administrator asked for; differs from `actual_state_desc` when cleanup is degraded |
| `current_storage_size_mb` | `current_storage_size_mb` | `int` | Current on-disk footprint of Query Store data |
| `max_storage_size_mb` | `max_storage_size_mb` | `int` | Hard ceiling before size-based cleanup kicks in |
| `query_capture_mode_desc` | `query_capture_mode_desc` | `nvarchar(60)` | `ALL`, `AUTO`, `CUSTOM`, `NONE` — controls which queries are captured |
| `size_based_cleanup_mode_desc` | `size_based_cleanup_mode_desc` | `nvarchar(60)` | `AUTO` evicts old queries when storage fills; `OFF` stops capture |
| `stale_query_threshold_days` | `stale_query_threshold_days` | `smallint` | Retention window for inactive queries |
| `wait_stats_capture_mode_desc` | `wait_stats_capture_mode_desc` | `nvarchar(60)` | `ON` or `OFF`; required for wait-stat analysis per query |

*Live capture against the local stoxx instance on 2026-04-11:*

| actual_state_desc | desired_state_desc | current_storage_size_mb | max_storage_size_mb | query_capture_mode_desc | size_based_cleanup_mode_desc | stale_query_threshold_days | wait_stats_capture_mode_desc |
|---|---|---|---|---|---|---|---|
| READ_WRITE | READ_WRITE | 10 | 1000 | ALL | AUTO | 30 | ON |

stoxx has Query Store fully enabled: `READ_WRITE` state, 10 MB used of a 1000 MB ceiling (ample headroom), `ALL` capture mode (every query is captured, not just ad-hoc ones), 30-day retention, and wait stats capture on. `ALL` mode is appropriate for teaching and demo workloads; production analytics databases usually prefer `AUTO` to avoid capturing one-off administrative ad-hoc queries. If `actual_state_desc` differs from `desired_state_desc` the operator should check `sys.database_query_store_options.readonly_reason` for why — common causes are filling the `max_storage_size_mb` ceiling or hitting the database compatibility level requirement.

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `actual_state_desc` | `OFF` | critical | Query Store disabled | No historical plans; performance investigation impossible |
| `actual_state_desc` | `READ_ONLY` | warning | Storage ceiling reached or incompatible state | Raise `max_storage_size_mb` or investigate readonly_reason |
| `actual_state_desc` | `READ_WRITE` | normal | Capturing normally | Healthy |
| `actual_state_desc` | `ERROR` | critical | Query Store is in an error state | Restart, check error log |
| `query_capture_mode_desc` | `ALL` | verbose | Every query captured | High overhead on busy instances |
| `query_capture_mode_desc` | `AUTO` | normal | Only queries with significant impact | Production default |
| `query_capture_mode_desc` | `CUSTOM` | advanced | Fine-grained tuning | Used with `CUSTOM_CAPTURE_POLICY` |
| `query_capture_mode_desc` | `NONE` | critical | Capture disabled | New queries won't be tracked |

#### List the slowest queries by Query Store average duration

During triage of a performance regression, or as part of a weekly top-N-slow-queries report. It is typically triggered by a user-visible latency spike, or proactive hygiene on a new workload. T-SQL session, read-only against Query Store catalog views. Cost is proportional to the number of queries tracked; fast on databases with thousands of queries, slow on those with hundreds of thousands. Identify the top offenders by average duration so the parameter-sniffing candidates can be isolated and inspected.

*Top 5 queries from Query Store ordered by average duration, joined to the plan and runtime stats.*

```sql
SELECT TOP 5
    qsq.query_id,
    qsp.plan_id,
    CAST(ISNULL(qsrs.avg_duration, 0) AS BIGINT) AS avg_duration_us,
    ISNULL(qsrs.count_executions, 0) AS count_executions,
    LEFT(qsqt.query_sql_text, 80) AS query_text_excerpt
FROM sys.query_store_query qsq
JOIN sys.query_store_query_text qsqt ON qsq.query_text_id = qsqt.query_text_id
JOIN sys.query_store_plan qsp ON qsq.query_id = qsp.query_id
LEFT JOIN sys.query_store_runtime_stats qsrs ON qsp.plan_id = qsrs.plan_id
ORDER BY ISNULL(qsrs.avg_duration, 0) DESC;
```

| Field | Source column | Type | Meaning |
|---|---|---|---|
| `query_id` | `sys.query_store_query.query_id` | `bigint` | Stable identifier for a query (same text + plan attributes) |
| `plan_id` | `sys.query_store_plan.plan_id` | `bigint` | Stable identifier for a specific cached plan |
| `avg_duration_us` | `sys.query_store_runtime_stats.avg_duration` | `float` (cast to `bigint`) | Average elapsed time in microseconds over the runtime interval |
| `count_executions` | `sys.query_store_runtime_stats.count_executions` | `bigint` | Number of executions in the runtime interval |
| `query_text_excerpt` | `sys.query_store_query_text.query_sql_text` | `nvarchar(max)` | First 80 characters of the query text |

*Live capture against stoxx on 2026-04-11, showing the top 5 slowest queries by average duration:*

| query_id | plan_id | avg_duration_us | count_executions | query_text_excerpt |
|---|---|---|---|---|
| 2971 | 390 | 91835617 | 1 | (@1 tinyint)UPDATE [dbo].[dm_exec_requests_demo] set [payload] = [payload]  WHER |
| 2972 | 391 | 43821688 | 1 | (@1 tinyint)SELECT [payload] FROM [dbo].[dm_exec_requests_demo] WITH(updlock,hol |
| 4133 | 1603 | 23297092 | 3 | (@1 tinyint)SELECT [id],[payload] FROM [dbo].[race_dba_demo] WITH(updlock,holdlo |
| 3362 | 799 | 22901316 | 2 | (@1 tinyint)SELECT [payload] FROM [dbo].[concurrency_block_demo] WITH(updlock,ho |
| 3355 | 792 | 17927394 | 1 | (@1 tinyint)SELECT [payload] FROM [dbo].[admin_block_demo] WITH(updlock,holdlock |

Every query in the top 5 is from the `blocking-and-locking` teaching note's workload — `updlock,holdlock` scans that hold locks deliberately to demonstrate blocking scenarios, with durations in the tens of seconds (`91835617 µs ≈ 91.8 s` for the slowest UPDATE). This is not a bug; it is the deliberate slow path for a pedagogy demo. On a production instance the same query would surface rows that are actually slow for unintended reasons: parameter-sniffed procedures whose `avg_duration_us` is large but `count_executions` is small (sniffing regression signature) or queries whose `count_executions` is high enough that even a modest `avg_duration` multiplies into real CPU cost.

#### Neutralize a sniffed procedure with OPTION(RECOMPILE)

> [!warning] OPTION(RECOMPILE) pays compilation cost on every execution
>
> Adding `OPTION(RECOMPILE)` forces SQL Server to recompile the statement every time it runs, which pays the compilation cost on each execution. For a procedure called a few hundred times per hour this is fine; for a procedure called thousands of times per second the compilation CPU becomes its own bottleneck. Always measure the pre- and post-fix runtime with Query Store before committing.

> [!success] Pair OPTION(RECOMPILE) with statement-level application
>
> Apply `OPTION(RECOMPILE)` at the statement level inside the procedure, not as a procedure-level `WITH RECOMPILE`. The statement-level form only recompiles the affected statement, preserving cached plans for other statements in the same procedure. A procedure-level `WITH RECOMPILE` recompiles the entire procedure on every call, which is much more expensive.

After Query Store has confirmed a specific procedure shows bimodal `avg_duration` across parameter values, and after measuring the call rate to ensure compilation cost will not dominate. It is typically triggered by parameter-sniffing regression confirmed in Query Store. T-SQL session, requires `ALTER` on the procedure. State-changing on schema. Remove the cached plan dependency and recompile per call, producing a plan optimized for each actual parameter value rather than the first sniffed value.

*Add OPTION(RECOMPILE) to the affected statement inside the procedure definition.*

```sql
CREATE OR ALTER PROCEDURE usp_get_index_constituents
    @index_code VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT ic.instrument_isin, ic.weight, ic.effective_date
    FROM gold.index_constituents ic
    WHERE ic.index_code = @index_code
    OPTION (RECOMPILE);
END;
```

*Alternative: use OPTIMIZE FOR UNKNOWN to make the optimizer build a plan based on average statistics instead of the first sniffed value.*

```sql
SELECT ic.instrument_isin, ic.weight
FROM gold.index_constituents ic
WHERE ic.index_code = @index_code
OPTION (OPTIMIZE FOR (@index_code UNKNOWN));
```

> [!info] usp_get_index_constituents does not exist on stoxx
>
> Both cells are the production-correct forms. The equivalent live demo on stoxx would target `silver.eurostoxx50_ohlcv` with a procedure that filters on `symbol`, but the 50-symbol universe has roughly uniform cardinality per symbol so it would not exhibit sniffing skew. See [19-query-store-regressions-and-plan-forcing](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/03-Query-Writing-and-Optimization/query-store-regressions-and-plan-forcing) for a full worked example with forced plans.

---

### SQL Server | concurrent sessions | blocking chain from long reader

A dashboard BI tool runs a long analytical query under `READ_COMMITTED` with a `HOLDLOCK` or `TABLOCK` hint (or inside an explicit transaction), which acquires and holds shared locks on several gold tables for the duration of the statement. The evening pipeline begins its update phase on the same tables and attempts to acquire `LCK_M_U` (update) locks that cannot be granted because the shared locks are still held. The pipeline sessions queue behind the dashboard query, each one blocked by the one in front, forming a chain rooted at the dashboard query as the "head blocker." The Airflow task timeout fires before the dashboard query finishes, the pipeline fails, and downstream index data is not published.

The severity is high because blocking chains cascade: one long reader blocks many writers, which then block whatever is waiting on them, and the queue depth grows until session exhaustion or a lock-timeout wave. The DMV signature is rows in `sys.dm_exec_requests` with `blocking_session_id > 0`, and the "head blocker" is the one session in the chain that is not itself blocked. RCSI is the architectural fix because it converts `READ COMMITTED` from locking-based to version-based and eliminates the reader-writer blocking class entirely. `WITH (NOLOCK)` is a frequently-reached-for tactical fix but allows dirty reads and should never touch rows used in financial calculations.

#### Identify the head blocker and all blocked sessions

As soon as a blocking incident is suspected — pipeline tasks hanging, user reports of timeouts, `LCK_M_*` waits on sys.dm_os_waiting_tasks. It is typically triggered by airflow task timeout on a known-writer task, or a monitoring alert on blocking-session count. T-SQL session, read-only, requires `VIEW SERVER STATE`. Safe to run from a second session even while the workload is frozen. Produce the waits-for graph at the session level (who is blocking whom), identify the head blocker, and gather the SQL text of the blocking and blocked statements so the operator can decide whether to kill, wait, or retry.

*List every blocked session with its blocker, wait type, wait duration, and the SQL text of the statement it is waiting on.*

```sql
SELECT
    r.session_id AS blocked_session,
    r.blocking_session_id AS blocker_session,
    r.wait_type,
    r.wait_time / 1000 AS wait_seconds,
    r.status,
    LEFT(st.text, 200) AS blocked_query_excerpt
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) st
WHERE r.blocking_session_id > 0
ORDER BY r.wait_time DESC;
```

| Field | Source column | Type | Meaning |
|---|---|---|---|
| `blocked_session` | `sys.dm_exec_requests.session_id` | `smallint` | Session waiting on a lock |
| `blocker_session` | `sys.dm_exec_requests.blocking_session_id` | `smallint` | Session holding the lock |
| `wait_type` | `sys.dm_exec_requests.wait_type` | `nvarchar(60)` | Lock type being waited on (`LCK_M_S`, `LCK_M_U`, `LCK_M_X`, `LCK_M_SCH_S`, `LCK_M_SCH_M`) |
| `wait_seconds` | `wait_time / 1000` | `int` | Seconds waited on the current lock request |
| `status` | `sys.dm_exec_requests.status` | `nvarchar(30)` | `running`, `suspended`, `runnable`, `sleeping` |
| `blocked_query_excerpt` | `sys.dm_exec_sql_text.text` | `nvarchar(max)` | First 200 characters of the waiting statement |

*Find the head blocker: the session that is blocking others but is not itself blocked.*

```sql
SELECT
    s.session_id,
    s.login_name,
    s.host_name,
    s.program_name,
    s.open_transaction_count,
    s.status,
    s.last_request_start_time
FROM sys.dm_exec_sessions s
WHERE s.session_id IN (
    SELECT blocking_session_id FROM sys.dm_exec_requests WHERE blocking_session_id > 0
)
  AND s.session_id NOT IN (
    SELECT session_id FROM sys.dm_exec_requests WHERE blocking_session_id > 0
  );
```

*Live capture against the local stoxx instance on 2026-04-11 — both queries return `(0 rows)` because there is no active blocking on the healthy demo instance. During a real incident the first query would return one row per blocked session and the second query would return the single head blocker.*

```text
(0 rows)
```

See [15-blocking-and-locking](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/03-Query-Writing-and-Optimization/blocking-and-locking) for a full walkthrough with live reproduction using a pyodbc helper that holds locks on `dbo.race_dba_demo` while a second session attempts to acquire an `UPDLOCK` — that note captures the full blocking chain from the root through all waiters.

#### Kill the head blocker or set LOCK_TIMEOUT on the waiters

> [!danger] Killing the head blocker rolls back its transaction
>
> `KILL <spid>` terminates the blocker's session and triggers a rollback of any open transaction. The rollback holds the same locks the forward transaction held, and during rollback the blocked sessions are still blocked — killing the blocker does not release locks instantly. On a dashboard query that has been reading for 8 minutes, the rollback is effectively instant because reads do not accumulate undo. On a bulk writer that has been updating for 20 minutes, the rollback will take roughly 20 more minutes.

> [!success] Set LOCK_TIMEOUT on pipeline sessions to fail fast
>
> The alternative to killing is to let the waiters fail fast via `SET LOCK_TIMEOUT 30000` in every pipeline session's connection setup. After 30 seconds of waiting for a lock, the session raises error 1222 (`Lock request time out period exceeded`) and the application can retry or escalate. This avoids the judgment call of whether to kill a production session and converts indefinite hangs into retriable failures.

After the head blocker query has identified the session and the operator has decided that killing it (and triggering rollback) is acceptable. It is typically triggered by an identified head blocker that is either orphaned, rogue, or the correct session to terminate per incident runbook. T-SQL session, requires `ALTER ANY CONNECTION` or `sysadmin`. State-changing and irreversible for the target session. Release the lock hold so the blocked chain can drain.

*Terminate the head blocker session; replace the spid with the one returned by the head-blocker query above.*

```sql
KILL 55;
```

*Alternative: set a 30-second lock timeout on the pipeline connection setup so waiters fail fast with error 1222 and retry logic can kick in.*

```sql
SET LOCK_TIMEOUT 30000;
```

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `LOCK_TIMEOUT` | `-1` | default | Wait indefinitely | Pipeline hangs on any blocking |
| `LOCK_TIMEOUT` | `0` | option | Fail immediately | Error 1222 on first conflict |
| `LOCK_TIMEOUT` | `30000` (30 s) | normal | Short patience, fast fail | Recommended for ETL |
| `LOCK_TIMEOUT` | `> 60000` | warning | Long patience | May mask the real issue |
| Error number | `1222` | normal | Lock request time out | Retriable; client should back off |

---

### SQL Server | table statistics | stale histograms producing bad cardinality estimates

A silver table holds 1 million rows at the start of the quarter. A vendor backfill adds 9 million historical records, bringing the table to 10 million. SQL Server's auto-update-statistics threshold is roughly 20% of rows for classical mode (the dynamic threshold in SQL 2016+ scales this down for larger tables), so stats do update — once — and then another 7 million rows land before the next update fires. The optimizer's histogram now reports 2 million rows while the actual table has 10 million; cardinality estimates for joins are five-fold off; memory grants are under-provisioned; the optimizer picks a nested-loop join plan that would be optimal for 2 million rows and catastrophic for 10 million. The gold aggregation that used to run in 4 minutes now runs in 2 hours, spilling to tempdb because the memory grant was sized on the stale row count.

The severity is high because the regression appears after a routine data load — the pipeline does exactly what it always does, and a query that worked yesterday is slow today. The root cause is always in `sys.stats` and `sys.dm_db_stats_properties`: the `last_updated` timestamp plus the `modification_counter` since last update tell the operator how far the histogram has drifted from reality. The fix is `UPDATE STATISTICS ... WITH FULLSCAN` on the affected table, usually targeted to specific statistics rather than the whole table, followed by `sp_recompile` to flush the cached plans that were using the old histograms.

#### Audit statistics age and modification counter for the hot tables

As the first diagnostic step for any "worked yesterday, slow today" performance regression, or as a nightly health check on high-churn tables. It is typically triggered by sudden query runtime increase without a schema or code change, unexpected `UPDATE STATISTICS` entries in the error log, or a suspect `sp_updatestats` completion. T-SQL session, read-only. `sys.dm_db_stats_properties` is a DMF that must be called per statistic object; a CROSS APPLY over `sys.stats` is the standard pattern. List every statistic on the hot tables with its last-updated timestamp, sample percentage, and modification counter so the operator can decide which statistics need a fresh update.

*Show the top 10 statistics on silver OHLCV tables by row count, ordered by row count descending.*

```sql
SELECT TOP 10
    OBJECT_SCHEMA_NAME(s.object_id) + '.' + OBJECT_NAME(s.object_id) AS table_name,
    s.name AS stat_name,
    sp.last_updated,
    sp.rows,
    sp.rows_sampled,
    CAST(100.0 * sp.rows_sampled / NULLIF(sp.rows, 0) AS DECIMAL(6,2)) AS sample_pct,
    sp.modification_counter,
    sp.steps
FROM sys.stats s
CROSS APPLY sys.dm_db_stats_properties(s.object_id, s.stats_id) sp
WHERE OBJECT_SCHEMA_NAME(s.object_id) IN ('silver','gold','dbo')
  AND OBJECT_NAME(s.object_id) LIKE '%ohlcv%'
ORDER BY sp.rows DESC;
```

| Field | Source column | Type | Meaning |
|---|---|---|---|
| `table_name` | computed | `nvarchar` | Two-part name of the indexed/autocreated statistic's table |
| `stat_name` | `sys.stats.name` | `sysname` | Statistic name; `_WA_Sys_*` prefix = auto-created, `PK_*`/`IX_*` = index-bound, others = user-created |
| `last_updated` | `sys.dm_db_stats_properties.last_updated` | `datetime2` | UTC time the histogram was last rebuilt |
| `rows` | `rows` | `bigint` | Table row count at the time of last update |
| `rows_sampled` | `rows_sampled` | `bigint` | Rows actually scanned to build the histogram (less than `rows` if sampled) |
| `sample_pct` | computed | `decimal(6,2)` | `rows_sampled / rows * 100` |
| `modification_counter` | `modification_counter` | `bigint` | Row modifications since last update; drives auto-update trigger |
| `steps` | `steps` | `int` | Number of histogram steps (max 200 in SQL Server) |

*Live capture against the local stoxx instance on 2026-04-11 (first 8 rows):*

| table_name | stat_name | last_updated | rows | rows_sampled | sample_pct | modification_counter | steps |
|---|---|---|---|---|---|---|---|
| dbo.demo_eurostoxx50_ohlcv | CIX_demo_eurostoxx50_ohlcv | 2026-04-08 01:38:48.766666 | 67155 | 67155 | 100.00 | 0 | 50 |
| silver.eurostoxx50_ohlcv | _WA_Sys_00000005_59063A47 | 2026-04-11 15:59:58.343333 | 67155 | 67155 | 100.00 | 0 | 174 |
| silver.eurostoxx50_ohlcv | _WA_Sys_0000000A_59063A47 | 2026-04-11 15:59:58.38 | 67155 | 67155 | 100.00 | 0 | 182 |
| silver.eurostoxx50_ohlcv | _WA_Sys_0000000C_59063A47 | 2026-03-27 23:12:20.653333 | 66355 | 66355 | 100.00 | 0 | 2 |
| silver.eurostoxx50_ohlcv | _WA_Sys_00000007_59063A47 | 2026-03-27 23:12:20.64 | 66355 | 66355 | 100.00 | 0 | 182 |
| silver.eurostoxx50_ohlcv | IX_silver_eurostoxx50_ohlcv_symbol_date | 2026-03-27 23:12:20.63 | 66355 | 66355 | 100.00 | 0 | 50 |
| silver.eurostoxx50_ohlcv | PK__eurostox__3213E83FDF67D274 | 2026-03-27 23:12:20.616666 | 66355 | 66355 | 100.00 | 0 | 4 |
| silver.eurostoxx50_ohlcv | _WA_Sys_00000003_59063A47 | 2026-03-27 23:12:20.673333 | 66355 | 66355 | 100.00 | 0 | 148 |

The two most recently updated statistics (`_WA_Sys_00000005` and `_WA_Sys_0000000A` at `2026-04-11 15:59:58`) were refreshed today and reflect the current row count of 67,155. The remaining statistics were last updated on `2026-03-27` and still record 66,355 rows — 800 rows stale. `modification_counter = 0` across all rows confirms auto-update has run since the last batch; on a real regression the stale statistics would show a non-zero `modification_counter` proportional to the drift. The `steps` column shows how detailed the histogram is — 200 is the maximum, and anything below 10 means the column domain is small enough that a handful of buckets covers it.

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `modification_counter / rows` | `< 0.05` | normal | Less than 5% drift | Statistics are fresh |
| `modification_counter / rows` | `0.05 – 0.20` | watch | 5–20% drift | Auto-update has not yet fired |
| `modification_counter / rows` | `> 0.20` | warning | Auto-update threshold reached | Manual update advised if query plans are bad |
| `sample_pct` | `100` | ideal | Full scan | Histogram reflects all rows |
| `sample_pct` | `20 – 99` | acceptable | Sampled | Default sample rate; adequate for uniform data |
| `sample_pct` | `< 20` | warning | Low sample on large table | Skewed data may produce bad histogram; use `WITH FULLSCAN` |
| `last_updated` | `> 30 days ago` | watch | Stale by calendar | Update on next maintenance window |

#### Update statistics with full scan on the affected table

> [!warning] UPDATE STATISTICS WITH FULLSCAN scans the entire table
>
> `WITH FULLSCAN` reads every row of the index or heap to build the histogram. On a 100-million-row table this can take tens of minutes and saturates the I/O subsystem. For regular maintenance, the sampled default is usually adequate; use `WITH FULLSCAN` only when the sampled histogram is producing bad cardinality estimates, which is diagnosed via the optimizer's actual-vs-estimated row counts in the query plan.

> [!success] Target specific statistics rather than the whole table
>
> Instead of `UPDATE STATISTICS <table>` (which updates every statistic on the table), target the specific offending statistic: `UPDATE STATISTICS <table> <stat_name>`. On a table with 50 columns and 30 statistics, this reduces the I/O cost by 90%. The stat_name to target is always visible in the suboptimal plan's `StatsCollection` element.

After the audit query has identified a statistic with high modification drift, and after confirming the query regressing is driven by bad cardinality estimates (check the plan's estimated-vs-actual row counts). It is typically triggered by identified stale histogram + confirmed bad cardinality estimate. T-SQL session, `ALTER` permission on the table. Read-heavy I/O cost; can run concurrently with the workload but competes for buffer pool. Rebuild the histogram so the optimizer's cardinality estimates match reality, triggering plan recompilation on next execution.

*Update one specific statistic on silver.eurostoxx50_ohlcv with a full scan.*

```sql
UPDATE STATISTICS silver.eurostoxx50_ohlcv IX_silver_eurostoxx50_ohlcv_symbol_date WITH FULLSCAN;
```

*Flush the cached plans for the table so the next query rebuilds with fresh statistics.*

```sql
EXEC sp_recompile 'silver.eurostoxx50_ohlcv';
```

> [!info] Not executed during the refactor
>
> Running `UPDATE STATISTICS` against `silver.eurostoxx50_ohlcv` would alter the `last_updated` timestamp seen by the audit query in this section's live capture. Both DDL cells are shown in their production-correct form and left unexecuted to preserve the audit capture above.

---

### SQL Server | clustered and nonclustered indexes | logical fragmentation from writes

A bronze table receives half a million new OHLCV rows daily via bulk INSERT and 200,000 rows deleted weekly as part of retention policy. After three months without index maintenance, the clustered index on `(instrument_isin, trade_date)` has 92% logical fragmentation. B-tree pages are mostly empty because page splits and DELETEs leave holes; SQL Server reads 5 pages to retrieve data that, with a clean fill factor, would fit in 1. Logical reads on the daily silver transform climb from 100K to 500K, read-ahead prefetch becomes ineffective because extents are non-contiguous, and the buffer pool fills with half-empty pages that displace the actively-used hot set. The transform that used to finish in 9 minutes now takes 45 minutes and saturates the pd-ssd IOPS budget. The diagnostic DMF is `sys.dm_db_index_physical_stats`, which reports `avg_fragmentation_in_percent` and `avg_page_space_used_in_percent` per index.

The severity is high because the regression sneaks up: fragmentation grows slowly over weeks and months, and by the time a single query runtime is noticeably slow the whole instance is already I/O-bound. The fix rule of thumb — rebuild above 30%, reorganize between 10% and 30%, leave below 10% alone — is the starting point, but heap tables, columnstore indexes, and partitioned indexes each have different maintenance characteristics. The Ola Hallengren `IndexOptimize` solution is the community standard for production.

#### Query fragmentation for the largest indexes on stoxx

As the first diagnostic when queries against a specific table have slowed down, or as a nightly/weekly maintenance health check. It is typically triggered by high logical-reads ratio reported by Query Store or `SET STATISTICS IO`, or calendar-driven maintenance window. T-SQL session, read-only. `sys.dm_db_index_physical_stats` is a DMF; with `'SAMPLED'` mode it reads roughly 1% of pages and returns in seconds even on large databases. `'DETAILED'` mode reads every page and is minutes-to-hours on large databases. Rank indexes by fragmentation percentage so the worst offenders can be targeted for rebuild or reorganize.

*List the top 10 indexes in stoxx by logical fragmentation percentage, filtered to indexes with more than 100 pages (below that threshold fragmentation is irrelevant).*

```sql
SELECT TOP 10
    OBJECT_SCHEMA_NAME(ips.object_id) + '.' + OBJECT_NAME(ips.object_id) AS table_name,
    i.name AS index_name,
    ips.index_type_desc,
    CAST(ips.avg_fragmentation_in_percent AS DECIMAL(6,2)) AS avg_frag_pct,
    ips.page_count,
    CAST(ips.avg_page_space_used_in_percent AS DECIMAL(6,2)) AS avg_page_space_pct
FROM sys.dm_db_index_physical_stats(DB_ID('stoxx'), NULL, NULL, NULL, 'SAMPLED') ips
JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
WHERE ips.page_count > 100
  AND i.index_id > 0
ORDER BY ips.avg_fragmentation_in_percent DESC;
```

| Field | Source column | Type | Meaning |
|---|---|---|---|
| `table_name` | computed | `nvarchar` | Two-part schema-qualified name |
| `index_name` | `sys.indexes.name` | `sysname` | Index name; `CIX_*` = clustered, `IX_*`/`UX_*` = nonclustered |
| `index_type_desc` | `sys.dm_db_index_physical_stats.index_type_desc` | `nvarchar(60)` | `CLUSTERED INDEX`, `NONCLUSTERED INDEX`, `HEAP`, `CLUSTERED COLUMNSTORE`, `NONCLUSTERED COLUMNSTORE` |
| `avg_frag_pct` | `avg_fragmentation_in_percent` | `decimal(6,2)` | Percent of pages whose logical order differs from physical order |
| `page_count` | `page_count` | `bigint` | Total leaf pages in the index |
| `avg_page_space_pct` | `avg_page_space_used_in_percent` | `decimal(6,2)` | Percent of each page actually containing data; low values indicate wasted space from splits or DELETEs |

*Live capture against the local stoxx instance on 2026-04-11, sorted by fragmentation descending:*

| table_name | index_name | index_type_desc | avg_frag_pct | page_count | avg_page_space_pct |
|---|---|---|---|---|---|
| dbo.demo_idxmaint_rowstore | CIX_demo_idxmaint_row_guid | CLUSTERED INDEX | 99.31 | 47967 | 50.45 |
| silver.stoxxusa50_ohlcv | IX_silver_stoxxusa50_ohlcv_symbol_date | NONCLUSTERED INDEX | 46.23 | 212 | 77.67 |
| silver.stoxxasia50_ohlcv | IX_silver_stoxxasia50_ohlcv_symbol_date | NONCLUSTERED INDEX | 41.81 | 232 | 79.71 |
| silver.eurostoxx50_ohlcv | IX_silver_eurostoxx50_ohlcv_symbol_date | NONCLUSTERED INDEX | 40.59 | 239 | 80.09 |
| dbo.demo_idxmaint_splits | CIX_demo_idxmaint_splits | CLUSTERED INDEX | 6.60 | 2895 | 96.00 |
| dbo.demo_eurostoxx50_ohlcv | CIX_demo_eurostoxx50_ohlcv | CLUSTERED INDEX | 2.46 | 771 | 99.06 |
| silver.stoxxusa50_ohlcv | PK__stoxxusa__3213E83FC84E3F24 | CLUSTERED INDEX | 1.50 | 734 | 99.07 |
| dbo.demo_idxmaint_usage | IX_demo_idxmaint_usage_category | NONCLUSTERED INDEX | 0.81 | 124 | 99.61 |

The top row is `dbo.demo_idxmaint_rowstore.CIX_demo_idxmaint_row_guid` at 99.31% fragmentation with only 50.45% page space used — the textbook GUID-clustered anti-pattern. Each insert produces a random GUID that lands in the middle of the B-tree and triggers a page split, leaving pages half-full and physically out of order. This is the single best "before" example in the whole vault for index maintenance, and is deliberately left fragmented so notes like [07-index-maintenance](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/02-Database-Design-and-Storage/index-maintenance) can use it as a live reproduction. The three silver OHLCV nonclustered indexes at 40–46% fragmentation are real production-style fragmentation from ordinary inserts on tables that receive steady appends.

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `avg_frag_pct` | `< 5` | normal | Fresh or well-maintained | Do nothing |
| `avg_frag_pct` | `5 – 10` | watch | Early signs | Monitor during next check |
| `avg_frag_pct` | `10 – 30` | action | Fragmented | `ALTER INDEX ... REORGANIZE` (online, incremental) |
| `avg_frag_pct` | `> 30` | action | Heavily fragmented | `ALTER INDEX ... REBUILD` (can be online on Enterprise or SQL 2022) |
| `avg_frag_pct` | `> 95` | critical | Essentially random order | Rebuild required; also audit clustering key for GUID anti-pattern |
| `avg_page_space_pct` | `> 95` | normal | Pages packed | No wasted space |
| `avg_page_space_pct` | `70 – 95` | acceptable | Normal after splits | `REORGANIZE` compacts to fill factor |
| `avg_page_space_pct` | `< 70` | warning | Pages half-empty | Likely cause: recent bulk DELETEs or GUID-clustered inserts |

#### Rebuild or reorganize the offending indexes

> [!warning] ALTER INDEX REBUILD is a heavy operation even online
>
> On Enterprise edition (and SQL Server 2022 Standard for most index types), `REBUILD WITH (ONLINE = ON)` allows concurrent reads and writes, but the rebuild still uses a tempdb sort area and generates transaction log proportional to the index size. A 100-GB index rebuild generates 100 GB of log records. Ensure the log file has headroom before starting, or take a log backup mid-rebuild.

> [!success] Reorganize first, rebuild only when fragmentation is severe
>
> `ALTER INDEX ... REORGANIZE` is always online, uses minimal log space, and can be interrupted safely. Use it as the default for indexes between 10% and 30% fragmentation. Reserve `REBUILD` for indexes above 30% or for situations where you need to reset the fill factor, change the data compression setting, or rebuild after a column add/drop.

After the fragmentation audit has named the worst offenders and during a maintenance window with confirmed tempdb and log file headroom. It is typically triggered by scheduled weekly maintenance or the audit query above showing an index above 30% fragmentation. T-SQL session, `ALTER` permission. State-changing; online rebuild allows concurrent reads and writes, offline rebuild acquires a schema modification lock. Restore the index to a sequential page order so reads are cheaper and the buffer pool is used efficiently.

*Online-rebuild a single index on a production table; ONLINE=ON is supported on SQL Server 2022 for most index types including those with LOB columns.*

```sql
ALTER INDEX IX_silver_eurostoxx50_ohlcv_symbol_date
ON silver.eurostoxx50_ohlcv
REBUILD WITH (ONLINE = ON, FILLFACTOR = 90, SORT_IN_TEMPDB = ON);
```

*Reorganize a moderately fragmented index online; reorganize is always online and uses minimal log.*

```sql
ALTER INDEX IX_silver_stoxxasia50_ohlcv_symbol_date
ON silver.stoxxasia50_ohlcv
REORGANIZE;
```

> [!info] Not executed during this refactor
>
> Rebuilding or reorganizing the silver OHLCV indexes would reset the fragmentation percentages and erase the real capture above. Both cells are shown in their production-correct form. The production-standard solution for index maintenance on this instance is the Ola Hallengren `IndexOptimize` procedure, which automates the threshold logic and handles heaps, columnstore, and partitioned indexes correctly.

---

### SQL Server | client connection pool | exhaustion from leaked handles

A one-off Python backfill script opens a `pyodbc.connect()` inside a per-row loop and never calls `.close()` or uses a `with` block. After merging into the Airflow DAG it runs nightly, and within a few runs the SQL Server connection count climbs toward the `user connections` configuration ceiling. New pipeline tasks fail with `[08001] Login timeout expired` or `Cannot open database requested`; the C# API layer starts returning `SqlException: A connection was successfully established with the server, but then an error occurred during the login process`; dashboard queries fail; the only immediate fix is restarting the pipeline process to release its leaked connections. The root cause is that `pyodbc` does not pool connections at the library level (unlike SQLAlchemy or .NET's `SqlClient`), and each `pyodbc.connect()` call opens a raw TDS connection that stays open until Python's garbage collector reclaims the object — which may be delayed or never happen in long-running processes.

The severity is high because the symptom is cross-tenant: the API, the pipeline, and ad-hoc tools all compete for the same connection pool, and once exhausted no workload can recover until orphaned sessions are killed or processes are restarted. The prevention is a one-line code standard (always use context managers, always use SQLAlchemy or equivalent pooling for anything called in a hot loop), but enforcement requires monitoring connection counts per program name and alerting on anomalies.

#### Count connections by login and program

During a connection-exhaustion incident, or as a daily health check. It is typically triggered by login timeout errors in pipeline or API logs, or sustained growth in session count without workload growth. T-SQL session, read-only against `sys.dm_exec_sessions`. Requires `VIEW SERVER STATE`. Identify which login + program combination owns the runaway connection count so the leaking process can be found and fixed.

*Count user sessions grouped by login and program name, ordered by connection count descending.*

```sql
SELECT
    login_name,
    program_name,
    COUNT(*) AS connection_count
FROM sys.dm_exec_sessions
WHERE is_user_process = 1
GROUP BY login_name, program_name
ORDER BY connection_count DESC;
```

| Field | Source column | Type | Meaning |
|---|---|---|---|
| `login_name` | `sys.dm_exec_sessions.login_name` | `nvarchar(128)` | SQL or Windows login |
| `program_name` | `sys.dm_exec_sessions.program_name` | `nvarchar(128)` | Application string from the client driver |
| `connection_count` | `COUNT(*)` | `int` | Number of open sessions with this login + program |

*Live capture against the local stoxx instance on 2026-04-11:*

| login_name | program_name | connection_count |
|---|---|---|
| sa | Python | 1 |
| NT AUTHORITY\NETWORK SERVICE | SQLAgent - Contained AG | 1 |
| NT AUTHORITY\NETWORK SERVICE | SQLAgent - Email Logger | 1 |
| NT AUTHORITY\NETWORK SERVICE | SQLAgent - Generic Refresher | 1 |
| NT AUTHORITY\SYSTEM | SQLServerCEIP | 1 |

Five user sessions total, each from a distinct program. `sa` from `Python` is this runner; the four `NT AUTHORITY\*` rows are SQL Server's own internal agents. This is a healthy baseline. During a real connection leak you would see a single `program_name` (e.g. `backfill_corporate_actions.py`) with a connection count in the dozens or hundreds and climbing. The operational threshold to worry about is any single program with more than 50 concurrent connections unless that program is known to be a high-concurrency service.

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `connection_count` per program | `< 10` | normal | Single-instance client | No action |
| `connection_count` per program | `10 – 50` | watch | Multi-threaded client | Healthy if pool is bounded; alert if unbounded |
| `connection_count` per program | `> 50` | warning | Suspicious | Investigate; likely no pooling or leaked handles |
| `connection_count` per program | `> 200` | critical | Near ceiling | Kill + restart the responsible process |

#### Use context managers and pooling in client code

> [!warning] Never omit the `with` block on pyodbc
>
> Even short-lived scripts that "only run for a minute" accumulate orphaned connections when launched from a long-running parent (Airflow worker, API service, CI runner). The context manager is the only way to guarantee the connection is released on both success and exception paths. A bare `pyodbc.connect()` in a loop is the single most common cause of connection-pool exhaustion in Python-to-SQL-Server code.

> [!success] Use SQLAlchemy QueuePool for hot-path code
>
> For any Python code that opens more than a handful of connections per minute, use `sqlalchemy.create_engine` with `pool_size`, `max_overflow`, `pool_timeout`, and `pool_recycle` parameters. The QueuePool keeps a bounded set of connections open, serves them to callers, and recycles them on a schedule. This makes the per-call cost near-zero and guarantees the total connection count stays within the pool bound regardless of caller behavior.

During code review of any new Python pipeline code, and retroactively on any existing code that uses `pyodbc.connect()` in a loop. It is typically triggered by new task PR, connection leak discovered via the audit query above. Python application code. Requires redeploy. Eliminate leaked connections by binding their lifetime to a context manager and bounding the total count via a pool.

*Python pyodbc context manager: the connection is closed when the with block exits, even on exception.*

```python
import pyodbc

with pyodbc.connect(CONN_STR) as conn:
    with conn.cursor() as cursor:
        cursor.execute(
            "INSERT INTO bronze.corporate_actions VALUES (?, ?)",
            (isin, action_type),
        )
    conn.commit()
```

*SQLAlchemy engine with a bounded QueuePool — use this for any hot-path code that opens connections frequently.*

```python
import urllib.parse

from sqlalchemy import create_engine

params = urllib.parse.quote_plus(
    "DRIVER={ODBC Driver 18 for SQL Server};"
    "SERVER=localhost,1434;DATABASE=stoxx;"
    f"UID=sa;PWD={SA_PASSWORD};"
    "Encrypt=no;TrustServerCertificate=yes;"
)

engine = create_engine(
    f"mssql+pyodbc:///?odbc_connect={params}",
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=3600,
    future=True,
)
```

---

### SQL Server | MERGE statement | concurrent race producing duplicate rows

Two Airflow tasks run concurrently and both execute `MERGE INTO silver.esg_scores USING source_table ON (instrument_isin = ...)` against overlapping keys. SQL Server processes `MERGE` as a scan-and-match phase followed by per-row INSERT/UPDATE/DELETE operations; without explicit locking, both sessions can pass the `NOT MATCHED` check before either has committed its `INSERT`, and both end up inserting a row for the same business key. The result is duplicate rows in silver, the gold aggregation's `GROUP BY` double-counts, and downstream index weights are wrong. This is a classic TOCTOU (time-of-check-time-of-use) race, and it is compounded by a handful of Microsoft-acknowledged bugs in `MERGE` (KB2694124, KB2925678, KB4497928) where concurrent execution produces unexpected duplicate-key violations or misses updates that should have fired.

The severity is high because the failure is silent: no errors, no retries, just wrong data. The defense is layered: serialize concurrent `MERGE` calls via an application-level lock (Airflow pool with `slots=1`, `sp_getapplock` at the SQL layer); add `WITH (HOLDLOCK)` to the `MERGE` target so SQL Server takes a range lock covering the matched keys; add a `UNIQUE` constraint on the business key so any duplicate violates the database's own integrity rule and raises error 2627 instead of silently succeeding; or — the community-recommended pattern — avoid `MERGE` entirely for high-concurrency ETL and use an explicit `DELETE + INSERT` in a single transaction.

#### Detect duplicates on the business key

As part of nightly data-quality checks, or immediately when downstream numbers look wrong. It is typically triggered by gold aggregation values look inflated, or a BI user reports doubled totals. T-SQL session, read-only. Scan cost proportional to target table size. Find any business keys with more than one row, identifying the exact rows that need deduplication.

*Find any duplicate rows in silver.esg_scores grouped by the business key (instrument + date).*

```sql
SELECT instrument_isin, score_date, COUNT(*) AS dupe_count
FROM silver.esg_scores
GROUP BY instrument_isin, score_date
HAVING COUNT(*) > 1;
```

> [!info] silver.esg_scores does not exist on stoxx
>
> The duplicate detection pattern is generic — swap the table name and the business key columns for any target. On stoxx, the analogous query against `silver.eurostoxx50_ohlcv` would group by `(symbol, [date])`. It would return zero rows because the silver tables are pre-deduplicated and have primary keys enforcing uniqueness.

#### Replace MERGE with explicit DELETE + INSERT inside a transaction

> [!danger] MERGE has known concurrency and correctness bugs
>
> Microsoft has acknowledged multiple `MERGE` issues over the years, including KB2694124 (duplicate key violation with unique indexes), KB2925678 (incorrect results with filtered indexes), and KB4497928 (access violation under concurrency). The community consensus from SQL Server MVPs Aaron Bertrand, Itzik Ben-Gan, and others is to prefer explicit `DELETE + INSERT` or `UPDATE + INSERT` patterns over `MERGE` for ETL, especially under concurrency. See [Don't use MERGE](https://michaeljswart.com/2021/08/what-to-avoid-if-you-want-to-use-merge) for a thorough discussion.

> [!success] Use DELETE+INSERT inside a transaction with HOLDLOCK
>
> The deterministic alternative is `BEGIN TRAN; DELETE FROM target WITH (HOLDLOCK) WHERE <range>; INSERT INTO target SELECT ... FROM source; COMMIT;`. `HOLDLOCK` forces range locks that prevent phantom inserts from other sessions, `DELETE + INSERT` gives SQL Server an unambiguous sequence with no matching phase, and the combined transaction ensures the whole operation is atomic. Add a `UNIQUE` constraint on the business key as a belt-and-braces defense.

When designing a new ETL merge operation, or when remediating an existing `MERGE` that has produced duplicates under concurrency. It is typically triggered by new ETL task, or dedupe incident caused by concurrent `MERGE`. T-SQL, requires write access to the target. State-changing and atomic inside the transaction. Provide a deterministic upsert that is safe under concurrency and does not rely on `MERGE` semantics.

*Replace MERGE with an explicit DELETE + INSERT inside an atomic transaction, using HOLDLOCK to prevent concurrent inserts.*

```sql
BEGIN TRANSACTION;

    DELETE FROM silver.esg_scores WITH (HOLDLOCK)
    WHERE (instrument_isin, score_date) IN (
        SELECT instrument_isin, score_date FROM #esg_stage
    );

    INSERT INTO silver.esg_scores (
        instrument_isin, score_date, environmental_score,
        social_score, governance_score, composite_score
    )
    SELECT
        instrument_isin, score_date, environmental_score,
        social_score, governance_score, composite_score
    FROM #esg_stage;

COMMIT;
```

*Add a unique constraint on the business key as the database-level defense against any remaining duplication bug.*

```sql
ALTER TABLE silver.esg_scores
ADD CONSTRAINT UQ_esg_scores_isin_date UNIQUE (instrument_isin, score_date);
```

> [!info] Not executed against stoxx
>
> `silver.esg_scores` is a narrative table that does not exist on stoxx. The DELETE+INSERT pattern and the UNIQUE constraint are generic and apply to any silver table with a clear business key. See [10-merge-and-upsert](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/03-Query-Writing-and-Optimization/merge-and-upsert) for a full walkthrough of the MERGE pitfalls and the recommended alternatives.

---

## Moderate — Operational pain workable with monitoring

> [!abstract]- Summary
>
> These seven problems degrade correctness or performance enough to cause real operational pain, but they do not halt the pipeline and can usually be worked around in the short term. The fix window is the current sprint rather than same-day. Most have clean diagnostic queries and deterministic fixes; none require exclusive database access.

### SQL Server | DECIMAL arithmetic | overflow in derived financial calculations

A financial table stores monetary values as `DECIMAL(18,2)`, which has a maximum of roughly 999,999,999,999,999.99 — enough for any single value but not enough for derived calculations. A mega-cap market cap of $3.8 trillion is fine on its own, but `market_cap_usd * constituent_weight` produces a `DECIMAL(24,6)` intermediate, and a `SUM(market_cap_usd) OVER (...)` aggregation across thousands of constituents produces an intermediate that overflows 38 digits of precision. SQL Server raises `Msg 8115: Arithmetic overflow error converting expression to data type decimal` and the entire INSERT batch rolls back. The root cause is always that the column was sized for a single value but the calculation pipeline multiplies, weights, and sums across many rows and the intermediate precision rules (`max(p1-s1, p2-s2) + max(s1, s2) + 1` for multiplication, capped at 38) eat into the safety margin.

The severity is moderate because the batch fails loudly and can be retried after widening the column; no data is lost, just delayed. The defense is to use `DECIMAL(28,6)` or `DECIMAL(38,6)` for any financial monetary column from day one and `TRY_CAST` at staging boundaries so overflow candidates are flagged before they reach the production table.

#### Audit DECIMAL column precision and observed value range

During schema review, or after any `8115` error in the pipeline log. It is typically triggered by `Arithmetic overflow error converting expression to data type decimal` in any INSERT or aggregation. T-SQL session, read-only. Verify the column precision is wide enough to hold not only the stored value but also any derived calculations the pipeline performs on it.

*List all DECIMAL columns in silver and gold with their precision, scale, and an example max-value probe.*

```sql
SELECT
    SCHEMA_NAME(t.schema_id) + '.' + t.name AS table_name,
    c.name AS column_name,
    ty.name AS data_type,
    c.precision,
    c.scale
FROM sys.columns c
JOIN sys.tables t ON c.object_id = t.object_id
JOIN sys.types ty ON c.user_type_id = ty.user_type_id
WHERE ty.name IN ('decimal','numeric')
  AND SCHEMA_NAME(t.schema_id) IN ('silver','gold')
  AND t.is_ms_shipped = 0
ORDER BY table_name, column_name;
```

| Field | Source column | Type | Meaning |
|---|---|---|---|
| `table_name` | computed | `nvarchar` | Two-part name |
| `column_name` | `sys.columns.name` | `sysname` | Column name |
| `data_type` | `sys.types.name` | `sysname` | `decimal` or `numeric` |
| `precision` | `sys.columns.precision` | `tinyint` | Total number of digits (up to 38) |
| `scale` | `sys.columns.scale` | `tinyint` | Digits after the decimal point |

> [!info] Not executed as a live capture
>
> stoxx's silver OHLCV tables use `float` for price and volume rather than `DECIMAL`, so this audit query returns zero rows on stoxx. The query is the generic form to run on a production financial database; any row showing `precision < 28` with `data_type = decimal` on a monetary column should be reviewed against realistic max values and derived-calculation precision requirements.

#### Widen the column to DECIMAL(28,6) or DECIMAL(38,6)

> [!warning] Narrowing an existing column is a full-table rewrite
>
> Widening `DECIMAL(18,2) → DECIMAL(28,2)` is typically a metadata-only change, but narrowing or changing scale can force a full-table rewrite and risk rounding or truncation errors on existing rows. Always widen, never narrow, unless you have explicit approval for a data fix.

> [!success] Use DECIMAL(28,6) from day one on financial monetary columns
>
> `DECIMAL(28,2)` covers up to about $99 quadrillion, more than any real-world market cap; `DECIMAL(28,6)` adds 4 digits of scale for intermediate calculations. Standardize this precision in the schema-layering style guide so new tables do not drift back to `DECIMAL(18,2)`.

After observing an 8115 error or during proactive schema hardening. It is typically triggered by identified narrow column or 8115 error. T-SQL, `ALTER` permission. Metadata-only on widening. Give the column enough precision to hold the largest realistic value plus calculation headroom.

*Widen a hypothetical bronze.market_cap_usd column from DECIMAL(18,2) to DECIMAL(28,2).*

```sql
ALTER TABLE bronze.market_cap ALTER COLUMN market_cap_usd DECIMAL(28,2) NOT NULL;
```

---

### SQL Server | DATE and DATETIME2 columns | type confusion in joins

A silver pipeline joins a `corporate_actions` table (with `ex_date DATE`) to a `price_history` table (with `trade_datetime DATETIME`). The join condition `ca.ex_date = ph.trade_datetime` forces SQL Server to implicitly convert the `DATE` side to `DATETIME`, producing `'2026-03-15 00:00:00.000'`. Any price row with `trade_datetime = '2026-03-15 09:30:00.000'` does not match because the time component differs. The join returns zero rows, corporate actions are silently skipped, and the gold layer's adjusted prices are wrong. This is a silent failure: the query succeeds, just with an empty or incomplete result set. SQL Server's type precedence means `DATETIME` outranks `DATE`, so the column-side is converted, and joins on `DATE = DATETIME` only match rows where the `DATETIME` has exactly midnight as the time component.

The severity is moderate because the symptom is wrong numbers, not a crash. The defense is to standardize column types (`DATE` for business dates, `DATETIME2(3)` for timestamps, never `DATETIME` or `SMALLDATETIME`) and to explicitly `CAST(trade_timestamp AS DATE)` in any join that crosses the two.

#### Audit for legacy DATETIME columns

During any schema review, or after observing empty results from a date-join query. It is typically triggered by empty result from a `DATE = DATETIME` join, or the presence of a legacy column type. T-SQL session, read-only. List every column using the legacy `datetime` or `smalldatetime` types so they can be migrated to `datetime2` or `date`.

*Find all columns using the legacy datetime or smalldatetime types in silver and gold schemas on stoxx.*

```sql
SELECT
    SCHEMA_NAME(t.schema_id) + '.' + t.name AS table_name,
    c.name AS column_name,
    ty.name AS data_type
FROM sys.columns c
JOIN sys.tables t ON c.object_id = t.object_id
JOIN sys.types ty ON c.user_type_id = ty.user_type_id
WHERE ty.name IN ('datetime','smalldatetime')
  AND SCHEMA_NAME(t.schema_id) IN ('silver','gold','dbo')
  AND t.is_ms_shipped = 0
ORDER BY table_name, column_name;
```

| Field | Source column | Type | Meaning |
|---|---|---|---|
| `table_name` | computed | `nvarchar` | Two-part schema-qualified name |
| `column_name` | `sys.columns.name` | `sysname` | Column name |
| `data_type` | `sys.types.name` | `sysname` | `datetime` (3.33ms precision, 1753 minimum) or `smalldatetime` (1 minute precision, 1900 minimum) |
| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `data_type` | `datetime` | legacy | 3.33 ms precision, 1753 minimum | Migrate to `datetime2(3)` |
| `data_type` | `smalldatetime` | legacy | 1-minute precision, 1900 minimum | Migrate to `datetime2(0)` |
| `data_type` | `datetime2` | normal | Variable precision up to 100 ns | Current best practice |
| `data_type` | `date` | normal | Business date only | Correct for dates without time |
| `data_type` | `datetimeoffset` | specialized | Time-zone-aware | Use when TZ matters |

#### Cast to DATE explicitly in joins crossing type boundaries

> [!warning] Implicit DATE-to-DATETIME conversion drops non-midnight rows
>
> When SQL Server promotes a `DATE` column to `DATETIME` for comparison, the resulting value is `YYYY-MM-DD 00:00:00.000`. Any row on the `DATETIME` side whose time component is not exactly midnight fails the equality. The join silently returns zero matching rows for the non-midnight data — no error, no warning, just wrong results.

> [!success] Cast the DATETIME side down to DATE or use half-open date ranges
>
> For equality joins, cast the timestamp column to `DATE`: `ON ca.ex_date = CAST(ph.trade_timestamp AS DATE)`. For range filters, always use half-open intervals: `WHERE ts >= '2026-01-01' AND ts < '2026-02-01'` instead of `BETWEEN '2026-01-01' AND '2026-01-31'`, which misses rows with timestamps after midnight on the end date.

As the fix for any query that joins a `DATE` column to a `DATETIME`/`DATETIME2` column. It is typically triggered by empty result from a date-join query, or code review flagging the pattern. T-SQL query text. Non-invasive change. Produce the intended match result without relying on implicit conversion.

*Join on DATE equality after explicitly casting the DATETIME2 side down to DATE.*

```sql
SELECT ca.instrument_isin, ca.ex_date, ph.close_price
FROM silver.corporate_actions ca
JOIN silver.price_history ph
    ON ca.ex_date = CAST(ph.trade_timestamp AS DATE)
WHERE ca.ex_date >= '2026-01-01' AND ca.ex_date < '2026-04-01';
```

> [!info] silver.corporate_actions and silver.price_history do not exist on stoxx
>
> The pattern is generic. The equivalent on stoxx would use `silver.eurostoxx50_ohlcv.[date]` (a `date` column, already correctly typed) as the left side of the join and any timestamp column as the right. See [08-date-and-time-functions](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/03-Query-Writing-and-Optimization/date-and-time-functions) for the full date/time function reference.

---

### SQL Server | tempdb | PFS and GAM latch contention under concurrent workload

During an end-of-day gold calculation, eight parallel sessions each execute complex sort + hash join queries that allocate worktables and sort runs in tempdb. If tempdb is configured with a single data file, every session contends on the same PFS (Page Free Space), GAM (Global Allocation Map), and SGAM (Shared GAM) system pages. SQL Server serializes updates to these pages with latches, and the wait type `PAGELATCH_UP` spikes. Queries stall not on I/O or CPU but on internal page-allocation locks, and the pipeline takes 25 minutes to do what should be 4 minutes. The Microsoft-recommended fix is to create multiple tempdb data files — one per logical CPU, up to 8 — so SQL Server's proportional-fill algorithm round-robins allocations across files, distributing the PFS/GAM contention.

The severity is moderate because the workaround (add tempdb files) is well known and the symptom is not a hard failure — just a throughput ceiling. SQL Server 2016+ automatically enables trace flags 1117 and 1118 behavior for tempdb, eliminating the need for manual trace flag configuration on modern instances.

#### Audit tempdb file layout

During initial instance setup, after any `PAGELATCH_UP` wait spike, or when onboarding a new analytics workload. It is typically triggered by suspected tempdb latch contention, or pre-deployment health check. T-SQL session, read-only. Count the tempdb data files and their sizes so you can verify the multi-file configuration matches the core count.

*Show every tempdb file with size, growth, and max size.*

```sql
SELECT
    name AS logical_name,
    physical_name,
    type_desc,
    size * 8 / 1024 AS size_mb,
    CASE WHEN max_size = -1 THEN -1 ELSE CAST(max_size AS BIGINT) * 8 / 1024 END AS max_size_mb,
    growth * 8 / 1024 AS growth_mb,
    is_percent_growth
FROM sys.master_files
WHERE database_id = DB_ID('tempdb')
ORDER BY type_desc, name;
```

| Field | Source column | Type | Meaning |
|---|---|---|---|
| `logical_name` | `sys.master_files.name` | `sysname` | File logical name |
| `physical_name` | `sys.master_files.physical_name` | `nvarchar(260)` | Absolute path |
| `type_desc` | `sys.master_files.type_desc` | `nvarchar(60)` | `ROWS` = data file, `LOG` = transaction log |
| `size_mb` | computed | `int` | Current allocation in MB |
| `max_size_mb` | computed | `bigint` | `-1` = unlimited |
| `growth_mb` | computed | `int` | Per-autogrow increment |
| `is_percent_growth` | `sys.master_files.is_percent_growth` | `bit` | `1` = percent, avoid |

*Live capture against the local stoxx instance on 2026-04-11, showing the first 5 of the 9 total tempdb files:*

| logical_name | physical_name | type_desc | size_mb | max_size_mb | growth_mb | is_percent_growth |
|---|---|---|---|---|---|---|
| templog | /var/opt/mssql/data/templog.ldf | LOG | 8 | -1 | 64 | False |
| tempdev | /var/opt/mssql/data/tempdb.mdf | ROWS | 8 | -1 | 64 | False |
| tempdev2 | /var/opt/mssql/data/tempdb2.ndf | ROWS | 8 | -1 | 64 | False |
| tempdev3 | /var/opt/mssql/data/tempdb3.ndf | ROWS | 8 | -1 | 64 | False |
| tempdev4 | /var/opt/mssql/data/tempdb4.ndf | ROWS | 8 | -1 | 64 | False |

stoxx tempdb has 8 data files (`tempdev` through `tempdev8`) each at 8 MB with 64 MB growth, plus one log file. This is the canonical multi-file configuration that eliminates PFS/GAM contention on parallel workloads. A production instance with a single `tempdev` file and no additional `tempdev2..N` is the broken configuration this problem describes.

#### Add tempdb files during a planned maintenance window

> [!warning] Adding tempdb files requires a SQL Server restart
>
> `ALTER DATABASE tempdb ADD FILE` registers the file in metadata, but tempdb is recreated on every service start, so the new files only take effect after `sudo systemctl restart mssql-server`. Plan a maintenance window and coordinate with the application team before restarting.

> [!success] Create all tempdb files equally sized at the same time
>
> SQL Server's proportional-fill algorithm directs allocations to the file with the most free space. If tempdb files are different sizes, the biggest one receives the most allocations, which defeats the purpose of multiple files. Pre-create all files at the same initial size during the same maintenance window and let them grow in lockstep.

During a planned maintenance window on an instance that has a single tempdb data file and shows PFS/GAM latch contention. It is typically triggered by confirmed single-file tempdb and confirmed `PAGELATCH_UP` waits on tempdb pages. T-SQL session, `ALTER DATABASE` permission. State-changing. Requires restart to take effect. Create the multi-file tempdb configuration so the proportional-fill algorithm spreads allocations across files and reduces contention on any single file's PFS/GAM pages.

*Add 7 additional tempdb data files to a single-file instance; repeat for each file with sequential names.*

```sql
ALTER DATABASE tempdb MODIFY FILE (NAME = tempdev, SIZE = 4096MB, FILEGROWTH = 512MB);
ALTER DATABASE tempdb ADD FILE (NAME = tempdev2, FILENAME = '/var/opt/mssql/data/tempdb2.ndf', SIZE = 4096MB, FILEGROWTH = 512MB);
ALTER DATABASE tempdb ADD FILE (NAME = tempdev3, FILENAME = '/var/opt/mssql/data/tempdb3.ndf', SIZE = 4096MB, FILEGROWTH = 512MB);
ALTER DATABASE tempdb ADD FILE (NAME = tempdev4, FILENAME = '/var/opt/mssql/data/tempdb4.ndf', SIZE = 4096MB, FILEGROWTH = 512MB);
```

> [!info] stoxx already has the correct multi-file tempdb
>
> The audit above confirms stoxx ships with 8 tempdb data files pre-created, so the `ADD FILE` commands would fail with "cannot add file, name already exists." The commands are shown as the production DDL to run on a single-file instance.

---

### SQL Server | Query Store plan history | regression after statistics update

A weekend maintenance job runs `UPDATE STATISTICS WITH FULLSCAN` across all user tables. Monday morning, a gold-layer stored procedure that ran in 45 seconds on Friday now takes 12 minutes. Query Store shows the plan changed from a hash join to a nested-loop join after the statistics refresh — the new histogram revealed a skew pattern (one key has 100× the average row count) that misled the optimizer into choosing a plan optimal for the skewed case and catastrophic for the average case. This is the inverse of the stale-statistics problem: fresh statistics can also cause regressions when they expose data skew the previous histogram had smoothed over. The fix is to force the previously known-good plan via `sp_query_store_force_plan` while investigating whether the procedure should be hardened with `OPTIMIZE FOR UNKNOWN` to avoid future skew-driven recompiles.

The severity is moderate because the fix is deterministic (force the good plan) and the instance-level automatic tuning feature (`AUTOMATIC_TUNING (FORCE_LAST_GOOD_PLAN = ON)`) can do this automatically on SQL Server 2017+. The procedural risk is that the operator must identify the specific `query_id` and `plan_id`, which requires Query Store to have captured both the good and bad plans.

#### Enable automatic plan correction

Once per database, during initial Query Store setup on SQL Server 2017+. It is typically triggered by database onboarding, or first observed plan regression that required manual intervention. T-SQL session, `ALTER DATABASE` permission. Let Query Store automatically detect a plan regression (3× slower than the previous plan) and force the previous good plan without operator intervention.

*Enable FORCE_LAST_GOOD_PLAN on the stoxx database.*

```sql
ALTER DATABASE stoxx
SET AUTOMATIC_TUNING (FORCE_LAST_GOOD_PLAN = ON);
```

*Verify the setting is in effect.*

```sql
SELECT name, desired_state, actual_state, reason_desc
FROM sys.database_automatic_tuning_options;
```

> [!info] Not executed against stoxx to avoid perturbing other notes
>
> The `ALTER DATABASE` command is shown as the production form. Microsoft's guidance is to enable `FORCE_LAST_GOOD_PLAN` on every production database running SQL Server 2017 or later unless there is a specific reason not to. The automatic tuning engine is conservative: it only forces a plan after observing a 3× regression for multiple executions, and it removes the forced plan if the database schema changes.

#### Force a specific plan when automatic tuning is off

> [!warning] Forcing a plan is brittle across schema changes
>
> `sp_query_store_force_plan` pins the optimizer to a specific plan_id. If the underlying schema changes (new index, dropped column, changed constraint) the forced plan becomes invalid and Query Store unforces it automatically. Do not force plans as a permanent fix — use it as a tactical bridge while the root cause (parameter sniffing, statistics skew) is being addressed.

> [!success] Document every forced plan with an expiry date
>
> Maintain a wiki or Notion page listing every plan currently forced on the instance: `query_id`, `plan_id`, date forced, operator, reason, and expiry date. Review weekly and unforce any plan whose root cause has been addressed or whose expiry has passed.

After identifying a regression in Query Store and deciding that forcing the old plan is the right tactical fix. It is typically triggered by confirmed plan regression with both good and bad plans captured in Query Store. T-SQL session, `ALTER DATABASE` scope. Force the optimizer to use a specific previously-observed plan for a specific query.

*Force the old plan for query 42 back to plan 7.*

```sql
EXEC sys.sp_query_store_force_plan @query_id = 42, @plan_id = 7;
```

*Later, unforce the plan once the underlying regression is fixed.*

```sql
EXEC sys.sp_query_store_unforce_plan @query_id = 42, @plan_id = 7;
```

---

### SQL Server | sp_configure parallelism knobs | MAXDOP and cost threshold defaults

SQL Server is installed on an 8-vCPU instance with the default `MAXDOP = 0` (use all cores) and `cost threshold for parallelism = 5` (the absurdly low default). Gold aggregations correctly use 8 cores. But the silver pipeline runs 50 small one-per-constituent queries concurrently, and each one processes 200 rows at a cost of 6 — just above the threshold — so each goes parallel on 8 threads. The parallelism overhead (thread setup, repartition streams, gather streams) exceeds the actual work, and the pipeline takes 45 minutes instead of 8. Large legitimate parallel queries are simultaneously starved for worker threads because the small ones are hogging them. The fix is to raise `cost threshold for parallelism` to a realistic value (50 is the community consensus) so small queries stay serial, and to set `MAXDOP` to roughly half the logical core count (4 on an 8-core instance) so even when parallelism kicks in it leaves headroom for other work.

The severity is moderate because the workload still completes — just slowly and with high CPU noise. The fix is a single pair of `sp_configure` calls that take effect immediately without restart. The live audit below shows stoxx running the classic broken default (`MAXDOP = 0`, `cost threshold = 5`) which this section exists to warn against.

#### Audit current parallelism configuration

During instance setup, or when investigating CPU-bound throughput complaints. It is typically triggered by high CPU with low useful throughput, `CXPACKET` waits dominating `sys.dm_os_wait_stats`, or pre-deployment health check. T-SQL session, read-only against `sys.configurations`. Confirm the current values of `max degree of parallelism` and `cost threshold for parallelism`, and flag any instance running the defaults.

*List the critical configuration knobs with their current values; sys.configurations.value and value_in_use are sql_variant and must be CAST.*

```sql
SELECT
    name,
    CAST(value AS INT) AS configured_value,
    CAST(value_in_use AS INT) AS value_in_use,
    CAST(minimum AS INT) AS minimum,
    CAST(maximum AS BIGINT) AS maximum,
    is_dynamic,
    is_advanced
FROM sys.configurations
WHERE name IN (
    'max degree of parallelism',
    'cost threshold for parallelism',
    'max server memory (MB)',
    'min server memory (MB)',
    'optimize for ad hoc workloads'
)
ORDER BY name;
```

| Field | Source column | Type | Meaning |
|---|---|---|---|
| `name` | `sys.configurations.name` | `nvarchar(35)` | Configuration option name |
| `configured_value` | `sys.configurations.value` | `sql_variant` → `int` | Value set by the administrator |
| `value_in_use` | `sys.configurations.value_in_use` | `sql_variant` → `int` | Value currently active |
| `is_dynamic` | `sys.configurations.is_dynamic` | `bit` | `1` = takes effect on `RECONFIGURE`; `0` = requires restart |
| `is_advanced` | `sys.configurations.is_advanced` | `bit` | `1` = requires `show advanced options` |

*Live capture against the local stoxx instance on 2026-04-11:*

| name | configured_value | value_in_use | minimum | maximum | is_dynamic | is_advanced |
|---|---|---|---|---|---|---|
| cost threshold for parallelism | 5 | 5 | 0 | 32767 | True | True |
| max degree of parallelism | 0 | 0 | 0 | 32767 | True | True |
| max server memory (MB) | 2147483647 | 2147483647 | 128 | 2147483647 | True | True |
| min server memory (MB) | 0 | 16 | 0 | 2147483647 | True | True |
| optimize for ad hoc workloads | 0 | 0 | 0 | 1 | True | True |

The stoxx instance ships with all defaults: `cost threshold for parallelism = 5` (trivially low), `max degree of parallelism = 0` (use all cores), and `max server memory = 2147483647 MB` (unlimited, the one that causes Linux OOM on busy instances). This is a textbook "out of the box" configuration and every row above is a known anti-pattern for production. A production-ready instance running 8 vCPUs would show `cost threshold = 50`, `maxdop = 4`, and `max server memory` set to roughly 75% of the physical RAM minus the OS reservation.

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `cost threshold for parallelism` | `5` | default | Trivially low | Small queries go parallel unnecessarily |
| `cost threshold for parallelism` | `25 – 50` | normal | Community consensus | Small queries stay serial; large queries still parallel |
| `cost threshold for parallelism` | `> 100` | watch | Very high | May force genuinely parallelizable queries to stay serial |
| `max degree of parallelism` | `0` | default | Use all cores | No headroom for other work |
| `max degree of parallelism` | `1` | override | Force serial | Only for OLTP or specific workloads |
| `max degree of parallelism` | `half core count` | normal | Balanced | Production default on analytics workloads |
| `max server memory (MB)` | `2147483647` | default | Unlimited | Risk of OS OOM; on Linux, mssql can be killed |
| `max server memory (MB)` | `~75% of physical` | normal | Leave headroom for OS | Safe for dedicated SQL host |
| `optimize for ad hoc workloads` | `0` | default | Cache every ad-hoc plan | Plan cache bloats with one-shot queries |
| `optimize for ad hoc workloads` | `1` | normal | Cache stub only until second execution | Recommended for mixed workloads |

#### Apply production-recommended parallelism settings

During instance hardening, or after the audit above shows defaults on an analytics-style workload. It is typically triggered by audit confirming defaults; scheduled instance hardening. T-SQL session, `ALTER SETTINGS` permission. Dynamic — `RECONFIGURE` takes effect immediately without restart. Raise `cost threshold for parallelism` to 50 and set `max degree of parallelism` to half the logical core count so small queries stay serial and large queries still parallelize.

*Raise cost threshold to 50 and set MAXDOP to 4 on an 8-core instance.*

```sql
EXEC sp_configure 'show advanced options', 1;
RECONFIGURE;

EXEC sp_configure 'cost threshold for parallelism', 50;
RECONFIGURE;

EXEC sp_configure 'max degree of parallelism', 4;
RECONFIGURE;
```

> [!info] Not executed against stoxx to preserve the default capture
>
> Running these `sp_configure` changes would alter the live capture above that intentionally shows the broken defaults as a teaching example. On a real production instance, running the three `sp_configure` pairs takes less than a second and the new values are active immediately.

---

### SQL Server | sleeping session | orphaned transaction holding locks

A Python pipeline task starts a transaction via `conn.autocommit = False`, inserts 10,000 rows into a bronze table, and then crashes with a network error before commit. The Python process exits but the TDS connection enters a half-closed state — SQL Server has not yet received a clean disconnect. The transaction stays open, the locks it acquired stay held, and the session appears in `sys.dm_exec_sessions` with `status = sleeping`. Four hours later a silver transform task is blocked by the orphaned transaction's exclusive locks on the bronze table. No error in Airflow logs, just a hanging task. SQL Server's session cleanup eventually terminates the zombie session based on TCP keepalive intervals, but "eventually" can be minutes to hours.

The defense is three layers: (1) `SET XACT_ABORT ON` inside every stored procedure so a runtime error automatically rolls back; (2) short connection timeouts and `LoginTimeout` on the client side so the client does not wait forever for a disconnected server; (3) SQL Server TCP keepalive configuration so orphaned sessions are detected in minutes rather than hours. This problem and its fix reuse the open-transaction audit query from Problem 1 (the transaction log full problem) — the difference is the lens: for log fullness you care about `ACTIVE_TRANSACTION` holding VLFs, here you care about orphaned `sleeping` sessions holding row and table locks.

#### Find sessions with open transactions in sleeping state

Whenever a pipeline task hangs without a visible error, or as a routine check during a blocking incident. It is typically triggered by hung Airflow task, or the open-transactions audit from Problem 1 returning long-lived sleeping sessions. T-SQL session, read-only, requires `VIEW SERVER STATE`. Identify sessions that are holding an open transaction but are not currently executing anything — the precise signature of an orphaned transaction.

*Show every sleeping session with an open transaction, including transaction age in seconds.*

```sql
SELECT
    s.session_id,
    s.login_name,
    s.host_name,
    s.program_name,
    s.status,
    s.open_transaction_count,
    DATEDIFF(SECOND, t.transaction_begin_time, SYSUTCDATETIME()) AS tx_age_seconds
FROM sys.dm_exec_sessions s
JOIN sys.dm_tran_session_transactions tst ON s.session_id = tst.session_id
JOIN sys.dm_tran_active_transactions t ON tst.transaction_id = t.transaction_id
WHERE s.status = 'sleeping'
  AND s.is_user_process = 1
  AND s.open_transaction_count > 0;
```

*Live capture against the local stoxx instance on 2026-04-11:*

```text
(0 rows)
```

No orphaned sleeping sessions on stoxx at capture time, which is the healthy baseline. During a real incident a single row would appear with `status = sleeping`, `open_transaction_count = 1`, and `tx_age_seconds` in the thousands. See Problem 1's open-transactions audit query for the field definition table — the columns are identical.

#### Use XACT_ABORT ON in stored procedures to eliminate orphan risk

> [!warning] Client-side transactions bypass XACT_ABORT
>
> `SET XACT_ABORT ON` only takes effect inside the T-SQL scope that sets it. If a Python client opens a transaction via `conn.autocommit = False` and then crashes, `XACT_ABORT` is not in play at all — the abort logic lives on the client. The correct defense for client-side transactions is a short connection timeout plus server-side TCP keepalive.

> [!success] Use stored procedures with XACT_ABORT ON for multi-statement transactions
>
> Wrap any multi-statement transaction in a stored procedure that sets `XACT_ABORT ON` and has its own `TRY/CATCH` with explicit `ROLLBACK`. Call the procedure from the client with a single `EXEC`, not via client-side `BEGIN TRAN`. This keeps transaction lifetime bound to the server and eliminates the orphan class entirely.

During code review of any multi-statement transaction, and retroactively on existing procedures that lack it. It is typically triggered by new procedure PR, or observed orphan. T-SQL, `ALTER` on the procedure. Force automatic rollback on any runtime error so no orphaned transaction is possible inside this procedure.

*Template stored procedure with XACT_ABORT ON, TRY/CATCH, and explicit ROLLBACK on error.*

```sql
CREATE OR ALTER PROCEDURE dbo.usp_load_bronze_prices
    @batch_id UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

            INSERT INTO bronze.price_history (batch_id, price) VALUES (@batch_id, 100);
            UPDATE dbo.batch_log SET status = 'LOADED' WHERE id = @batch_id;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH;
END;
```

---

### SQL Server | temp table collation | mismatch between user db and tempdb

A developer creates a temp table without specifying collation: `CREATE TABLE #stage (instrument_isin VARCHAR(12))`. The temp table inherits `tempdb`'s collation, which was set at SQL Server installation and typically differs from the user database collation when the instance is rebuilt or migrated. A join between `#stage.instrument_isin` and a permanent table's `VARCHAR` column with a different collation fails with `Msg 468: Cannot resolve the collation conflict between "SQL_Latin1_General_CP1_CI_AS" and "Latin1_General_CI_AS" in the equal to operation`. The error message is clear but the fix is non-obvious to developers unfamiliar with collations. The defense is to always declare `COLLATE DATABASE_DEFAULT` on temp table string columns so they pick up the current user database's collation instead of tempdb's.

#### Audit collations across server, databases, and temp tables

During instance migration, before creating temp tables in new code, or after any error 468. It is typically triggered by error 468 in the pipeline log, or cross-database join that unexpectedly fails. T-SQL session, read-only. Identify which collation boundaries exist on the instance so temp table code can target the correct `COLLATE` clause.

*Show server collation, user database collations, and tempdb collation on a single row.*

```sql
SELECT
    CAST(SERVERPROPERTY('Collation') AS VARCHAR(64)) AS server_collation,
    (SELECT collation_name FROM sys.databases WHERE name = 'stoxx') AS stoxx_collation,
    (SELECT collation_name FROM sys.databases WHERE name = 'tempdb') AS tempdb_collation;
```

| Field | Source column | Type | Meaning |
|---|---|---|---|
| `server_collation` | `SERVERPROPERTY('Collation')` | `varchar(64)` | Instance-level default collation, set at install time |
| `stoxx_collation` | `sys.databases.collation_name` | `nvarchar(128)` | Collation of the stoxx user database |
| `tempdb_collation` | `sys.databases.collation_name` | `nvarchar(128)` | Collation of tempdb — same as server_collation on a fresh install, can drift on migration |

*Live capture against the local stoxx instance on 2026-04-11:*

| server_collation | stoxx_collation | tempdb_collation |
|---|---|---|
| SQL_Latin1_General_CP1_CI_AS | SQL_Latin1_General_CP1_CI_AS | SQL_Latin1_General_CP1_CI_AS |

All three collations are identical on stoxx, which is the healthy baseline and the most common configuration for new instances. A migrated or rebuilt instance where the user database has been detached/attached from a different server can show divergent collations between `stoxx_collation` and `tempdb_collation` — that is the configuration where untagged temp tables will fail with error 468.

#### Always declare COLLATE DATABASE_DEFAULT on temp table string columns

> [!warning] Omitting COLLATE on a temp table is non-portable
>
> A temp table without an explicit `COLLATE` clause inherits the collation of `tempdb`. Code that works on a development instance where `tempdb` matches the user database will fail in production if the two collations differ. Treat untagged temp tables the same way you would treat an untagged hard-coded charset in source code: a latent portability bug.

> [!success] Use COLLATE DATABASE_DEFAULT for the current database's collation
>
> `COLLATE DATABASE_DEFAULT` resolves to the collation of whatever database the code is currently running in, which is almost always the right answer. It works inside stored procedures, in ad hoc queries, and across database contexts. Make it the standard in the temp-table section of the style guide.

As a code standard in every new query that creates a temp table with a string column. It is typically triggered by new code writing a `CREATE TABLE #...` or `DECLARE @... TABLE`. T-SQL query text. Ensure the temp table's string columns match the user database's collation so joins against permanent tables do not hit error 468.

*Create a temp table with every string column tagged COLLATE DATABASE_DEFAULT.*

```sql
CREATE TABLE #esg_stage (
    instrument_isin VARCHAR(12)   COLLATE DATABASE_DEFAULT NOT NULL,
    score_date      DATE          NOT NULL,
    composite_score DECIMAL(6,4)  NOT NULL
);
```

---

## Low — Annoyances and technical debt

> [!abstract]- Summary
>
> These five problems are technical debt that degrades code quality, maintainability, and future performance but does not cause immediate incidents. The fix window is "tech debt week" or a dedicated cleanup sprint. None require emergency attention but leaving them unfixed compounds over time.

### SQL Server | production queries | SELECT * coupling and performance

A silver-to-gold aggregation uses `SELECT * FROM silver.esg_scores` to feed a downstream calculation. The table has 15 columns including four large `NVARCHAR(MAX)` description fields used only for reporting. The query reads 15 columns but uses 5, the extra columns are transmitted over the network to the application, and the buffer pool fills with unnecessary data. When a developer adds a new `xml_metadata` column, the downstream `SELECT *` returns an unexpected column and breaks the Dapper mapping in the C# API. `SELECT *` is evaluated at runtime against the current schema, so it couples the query to the schema in an implicit way that is invisible to static code review. It also prevents covering indexes from being useful: the optimizer cannot use a 3-column covering index when the query wants 15 columns. The fix is to enforce "no `SELECT *` in persistent code" as a lint rule in CI (sqlfluff `AM04`), with an exception only for ad-hoc SSMS inspection.

#### Audit stored procedures and views for SELECT *

During a code hygiene sprint or as a nightly CI check. It is typically triggered by backlog grooming, or after a Dapper mapping failure caused by a new column. T-SQL session, read-only against `sys.sql_modules`. Produce a list of every persisted database object whose definition contains `SELECT *` so the team can refactor them.

*Find every stored procedure, view, or trigger whose T-SQL body contains SELECT *.*

```sql
SELECT
    OBJECT_SCHEMA_NAME(object_id) + '.' + OBJECT_NAME(object_id) AS object_name,
    type_desc,
    LEN(definition) AS definition_length
FROM sys.sql_modules m
JOIN sys.objects o ON m.object_id = o.object_id
WHERE m.definition LIKE '%SELECT *%'
   OR m.definition LIKE '%select *%';
```

| Field | Source column | Type | Meaning |
|---|---|---|---|
| `object_name` | computed | `nvarchar` | Two-part schema-qualified object name |
| `type_desc` | `sys.objects.type_desc` | `nvarchar(60)` | `SQL_STORED_PROCEDURE`, `VIEW`, `SQL_TRIGGER`, `SQL_SCALAR_FUNCTION`, etc. |
| `definition_length` | `LEN(m.definition)` | `int` | Size of the module's T-SQL source in characters |

> [!warning] This lint match produces false positives
>
> The `LIKE '%SELECT *%'` match finds any module where `SELECT *` appears in the source text — including comments, column list with `*` for multiply, and whitespace variations. For a production audit, run the output through a parser (sqlfluff or T-SQL tokenizer) to filter out the false positives. This query is the starting point, not the final answer.

> [!success] Use sqlfluff in CI to block new SELECT * introductions
>
> Add `sqlfluff` to the repo's lint CI with the `AM04` rule enabled. Every PR that introduces `SELECT *` in production code will fail the lint check before it merges. Combined with a one-time sweep to refactor existing instances, this drives the count of `SELECT *` in production code to zero and keeps it there.

*Live capture against stoxx returns a small set of matches because the teaching database has only a handful of persisted modules. Run this against the production analytics database to get a meaningful list.*

---

### SQL Server | Query Store | not enabled on production database

A pipeline performance regression is reported: the load that ran in 3 minutes last week now takes 20 minutes. Without Query Store, there is no execution history, no plan change record, and no way to determine when or why the plan changed. The team spends 4 hours investigating with no conclusive answer; the incident is closed as "unclear." Two weeks later, it happens again. Query Store is an opt-in feature that captures query execution statistics and plan history directly inside the database, persisted through SQL Server restart and independent of the live plan cache. Without it, the only post-hoc performance data is `sys.dm_exec_query_stats`, which is flushed on restart and does not retain plan history across plan changes.

#### Enable Query Store with production defaults

On every new production database at onboarding time, and retroactively on any database where it is not already enabled. It is typically triggered by database creation, or discovery that a database lacks Query Store. T-SQL session, `ALTER DATABASE` permission. State-changing on database options; non-destructive. Turn on Query Store in read-write mode with production-appropriate sizing and retention so historical query plans and runtime stats are captured going forward.

*Enable Query Store on stoxx with typical production settings.*

```sql
ALTER DATABASE stoxx SET QUERY_STORE = ON;

ALTER DATABASE stoxx SET QUERY_STORE (
    OPERATION_MODE               = READ_WRITE,
    DATA_FLUSH_INTERVAL_SECONDS  = 900,
    INTERVAL_LENGTH_MINUTES      = 60,
    MAX_STORAGE_SIZE_MB          = 2048,
    QUERY_CAPTURE_MODE           = AUTO,
    SIZE_BASED_CLEANUP_MODE      = AUTO,
    STALE_QUERY_THRESHOLD_DAYS   = 30,
    WAIT_STATS_CAPTURE_MODE      = ON
);
```

> [!info] Query Store is already enabled on stoxx
>
> See the Query Store audit capture in Problem 8's `database_query_store_options` table: stoxx is at `READ_WRITE`, 10 MB used of 1000 MB ceiling, `ALL` capture mode, 30-day retention, wait stats on. The DDL cell above would re-apply settings that are already in effect; it is shown as the canonical form for a new database.

> [!warning] Query Store is not retroactive
>
> Enabling Query Store captures data going forward only. No historical data is recovered from before the enable. If a regression has already been reported, Query Store will not help for that specific incident — but it will capture the next one. The best time to enable Query Store is database creation; the second-best time is now.

> [!success] Pair Query Store with automatic plan correction
>
> On SQL Server 2017+, also enable `ALTER DATABASE stoxx SET AUTOMATIC_TUNING (FORCE_LAST_GOOD_PLAN = ON)` so plan regressions are detected and reverted automatically without operator intervention. See Problem 17 for the details.

---

### SQL Server | T-SQL cursors | row-by-row loops replacing set-based queries

A developer implements index constituent weight normalization using a `DECLARE CURSOR` loop: for each of 3,000 constituents, fetch a row, calculate the normalized weight, execute an `UPDATE`. This produces 3,000 individual round-trips and 3,000 lock/unlock cycles. The normalization job takes 45 minutes. The same logic written as a set-based `UPDATE ... SET ... = ... / SUM(...) OVER (PARTITION BY ...)` runs in 8 seconds. SQL Server is optimized for set-based operations; cursor row-by-row processing defeats the query optimizer, bypasses bulk I/O, prevents parallelism, and holds locks for the full cursor lifetime. T-SQL cursors inside stored procedures at least avoid the network round-trip that a Python loop would incur, but they are still dramatically slower than the equivalent set-based query.

#### Replace a cursor with a window function

> [!warning] Cursors have legitimate uses but they are rare
>
> There are specific patterns where a cursor is the right answer: stepping through an administrative script row-by-row with error handling, calling a stored procedure per row when the procedure has side effects, or implementing pack-and-reduce algorithms that genuinely cannot be expressed declaratively. For data transformation in the pipeline, cursors are almost always the wrong answer.

> [!success] Replace cursors with window functions, CTEs, or APPLY
>
> The rewrite patterns are well-known: running totals use `SUM() OVER`, ranked operations use `ROW_NUMBER()`/`RANK()`/`DENSE_RANK()`, gap-filling uses recursive CTEs, per-row derived calculations use `CROSS APPLY` against a table-valued function. For the weight normalization case specifically, `SUM(raw_weight) OVER (PARTITION BY index_code)` is the direct replacement and runs roughly 300× faster than the equivalent cursor.

During any code review that encounters a `DECLARE CURSOR`, and as a search-and-rewrite sprint for existing procedures. It is typically triggered by cursor found in a persisted stored procedure, or slow update job. T-SQL query text, `ALTER` on the procedure. Replace the row-by-row loop with a single set-based statement that runs in one execution and holds locks only for its own duration.

*Set-based weight normalization using a window function — a single UPDATE, no loop, no cursor.*

```sql
UPDATE gold.index_weights
SET normalized_weight = raw_weight / SUM(raw_weight) OVER (PARTITION BY index_code)
WHERE index_code = @index_code;
```

*Audit for any DECLARE CURSOR references in persisted modules on stoxx.*

```sql
SELECT
    OBJECT_SCHEMA_NAME(object_id) + '.' + OBJECT_NAME(object_id) AS object_name,
    type_desc
FROM sys.sql_modules m
JOIN sys.objects o ON m.object_id = o.object_id
WHERE m.definition LIKE '%DECLARE %CURSOR%'
   OR m.definition LIKE '%declare %cursor%';
```

*Live capture against the local stoxx instance on 2026-04-11 — the teaching database has a handful of cursors for demonstration purposes; production analytics code should return zero rows for this audit.*

---

### SQL Server | stored procedures | missing XACT_ABORT and TRY/CATCH

A stored procedure inserts calculated weights into a gold table and then updates an audit log table. The INSERT succeeds, the UPDATE fails due to a FK violation. Without `SET XACT_ABORT ON`, the INSERT remains committed and the UPDATE error bubbles up to the calling Python code, which catches it and logs a warning — but the gold table now has new rows with no corresponding audit entry. The next reconciliation check fails and the engineering team spends hours tracing the inconsistency. Without `SET XACT_ABORT ON`, a runtime error inside a procedure does not automatically roll back the open transaction; the transaction stays open at the point of failure and later statements may or may not execute depending on error severity. Without `TRY/CATCH`, the calling code receives the error but by then the partial changes may already be committed. The fix is a procedure-writing standard: every procedure that modifies state sets `XACT_ABORT ON`, wraps work in `BEGIN TRY / BEGIN CATCH`, and rolls back explicitly on error.

#### Audit stored procedures for missing error handling

During a code hygiene sprint, or after any data-consistency incident where a procedure left the database in a partial state. It is typically triggered by reconciliation failure, or unexplained missing/extra rows after a procedure call. T-SQL, read-only against `sys.sql_modules`. Find every stored procedure whose body does not contain the strings `TRY` or `XACT_ABORT`, indicating missing error handling.

*Find stored procedures without TRY/CATCH on stoxx.*

```sql
SELECT
    OBJECT_SCHEMA_NAME(object_id) + '.' + OBJECT_NAME(object_id) AS procedure_name,
    LEN(m.definition) AS definition_length
FROM sys.sql_modules m
JOIN sys.objects o ON m.object_id = o.object_id
WHERE o.type = 'P'
  AND m.definition NOT LIKE '%BEGIN TRY%'
  AND m.definition NOT LIKE '%begin try%';
```

> [!warning] LIKE-based lint is a starting point, not a final answer
>
> The `NOT LIKE '%BEGIN TRY%'` filter catches procedures where the TRY block is missing entirely, but misses procedures where the TRY block exists but the CATCH is empty or does not roll back. For a rigorous audit, parse the procedure text with a T-SQL parser (TSqlFragment in the ScriptDom library) and check for the presence of a rollback statement inside the CATCH block.

#### Use the mandatory procedure template

> [!success] Every state-changing procedure follows the same skeleton
>
> `SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION; ... COMMIT; END TRY BEGIN CATCH IF @@TRANCOUNT > 0 ROLLBACK; THROW; END CATCH;`. This is six lines of boilerplate that eliminate the entire "partial state after error" class. Make it the first code snippet in the stored procedure style guide.

During every new procedure creation and as the remediation for procedures identified by the audit. It is typically triggered by new procedure PR, or audit finding. T-SQL, `ALTER` on the procedure. Guarantee that any error inside the procedure rolls back all state changes atomically.

*Mandatory stored procedure template with XACT_ABORT, TRY/CATCH, explicit ROLLBACK, and THROW to re-raise.*

```sql
CREATE OR ALTER PROCEDURE gold.usp_load_index_weights
    @index_code    VARCHAR(20),
    @effective_date DATE
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

            DELETE FROM gold.index_weights
            WHERE index_code = @index_code AND effective_date = @effective_date;

            INSERT INTO gold.index_weights (
                index_code, instrument_isin, weight, effective_date
            )
            SELECT
                @index_code,
                ic.instrument_isin,
                ic.raw_weight / SUM(ic.raw_weight) OVER (PARTITION BY ic.index_code),
                @effective_date
            FROM silver.index_constituents ic
            WHERE ic.index_code = @index_code
              AND ic.effective_date = @effective_date;

            INSERT INTO dbo.load_audit (
                load_type, entity_code, effective_date, rows_loaded, load_timestamp
            )
            VALUES (
                'GOLD_INDEX_WEIGHTS', @index_code, @effective_date,
                @@ROWCOUNT, SYSUTCDATETIME()
            );

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH;
END;
```

See [18-stored-procedures-dynamic-sql-and-error-handling](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/03-Query-Writing-and-Optimization/stored-procedures-dynamic-sql-and-error-handling) for the full error-handling pattern reference.

---

### SQL Server | Linux host | filesystem ownership, Kerberos, and case sensitivity

After the SQL Server Linux host is patched via `apt upgrade`, the `mssql-server` service starts but cannot write to `/var/opt/mssql/data/`. The backup script fails because the backup directory is owned by `root`, not the `mssql` service account. A developer connects from a Windows laptop using domain credentials and gets `Login failed for user ''` because Kerberos is not configured on Linux. A query that works on a Windows dev instance fails on Linux because the ext4 filesystem is case-sensitive. SQL Server on Linux runs as the `mssql` system user (UID 10001) and expects `/var/opt/mssql/*` to be owned by `mssql:mssql` with mode `770`. Windows/AD authentication requires explicit Kerberos setup on Linux; it is not automatic. File paths in T-SQL (`BACKUP TO DISK = '...'`, `RESTORE FROM DISK = '...'`) must match the exact case on the filesystem. SQL Server itself is still case-insensitive at the collation layer, but the OS path handling is not.

The severity is low because each gotcha has a clear, well-documented fix; they are annoyances rather than incidents. But they cluster at host provisioning time and catch new operators by surprise, so documenting them as a group saves hours of onboarding confusion.

#### Verify mssql service ownership and permissions

After any OS patch or migration, as part of the post-patch validation checklist. It is typically triggered by `mssql-server` fails to start, or backup/data writes fail with permission errors. Linux shell on the SQL Server host, `sudo` required. Confirm `/var/opt/mssql` and any custom data/log/backup directories are owned by `mssql:mssql` with mode `770`.

*Check ownership and permissions of the SQL Server directories.*

```bash
ls -la /var/opt/mssql/
ls -la /var/opt/mssql/data/
ls -la /var/opt/mssql/backup/
```

*Reset ownership and permissions to the expected state if they drift.*

```bash
sudo chown -R mssql:mssql /var/opt/mssql/
sudo chmod -R 770 /var/opt/mssql/
sudo systemctl restart mssql-server
sudo systemctl status mssql-server
```

> [!info] Linux commands not live-captured
>
> The stoxx instance runs inside a Docker container and its filesystem is not directly addressable from this workstation. These commands are the operational pattern for a non-container Linux SQL Server host. Inside the container, the equivalent verification is `docker exec stoxx-db ls -la /var/opt/mssql/`.

#### Configure memory limit via mssql-conf to prevent Linux OOM

> [!danger] Default max server memory on Linux is unlimited
>
> SQL Server's `max server memory (MB)` defaults to `2147483647`, which on Linux means SQL Server will consume memory until the OS out-of-memory killer terminates the `mssql` process. The first symptom is `mssql-server` service entering `failed` state with `journalctl -u mssql-server` showing an OOM kill message. This is distinct from Windows, where the operating system caps process memory at physical RAM and SQL Server self-regulates.

> [!success] Cap max server memory at ~75% of physical RAM
>
> Run `sudo /opt/mssql/bin/mssql-conf set memory.memorylimitmb <value>` to cap SQL Server at roughly 75% of physical RAM, leaving headroom for the OS, the Linux page cache, and any other services on the host. On a 32 GB VM, `28672` MB (28 GB) is a reasonable setting; on a dedicated 64 GB VM, `57344` MB. This limit is applied via the container mechanism rather than via SQL Server's `max server memory`, so both need to be set on Linux.

During initial SQL Server Linux setup, after any change to VM memory allocation, or after observing OOM kills. It is typically triggered by `mssql-server` service in `failed` state with OOM kill messages in `journalctl`. Linux shell on the SQL Server host, `sudo` required. Requires service restart to apply. Cap SQL Server memory consumption at a safe fraction of physical RAM.

*Set the memory limit via mssql-conf and restart the service.*

```bash
sudo /opt/mssql/bin/mssql-conf set memory.memorylimitmb 28672
sudo systemctl restart mssql-server
sudo systemctl status mssql-server
```

*Verify the service is running and check for recent OOM kills.*

```bash
sudo journalctl -u mssql-server --since "1 hour ago" | grep -i "killed\|oom"
```

See [11-memory-and-buffer-pool](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/01-Server-Operations/memory-and-buffer-pool) for the full memory tuning pattern and the relationship between `memory.memorylimitmb` and SQL Server's internal `max server memory` setting.

## Operational reference tables

> [!abstract]- Summary
>
> This section pulls together the flag tables for the commands used across all 25 problems — BACKUP / RESTORE WITH options, DBCC CHECKDB options, ALTER INDEX REBUILD options, sqlcmd flags, and mssql-conf settings. Every command that appears in a code cell above is documented here with its full documented option set, not just the flags used in the examples.

### BACKUP DATABASE and BACKUP LOG WITH options

| Flag | Syntax | Description |
|---|---|---|
| `COMPRESSION` | `WITH COMPRESSION` | Use native MS_XPRESS compression on the backup stream |
| `NO_COMPRESSION` | `WITH NO_COMPRESSION` | Force uncompressed backup |
| `CHECKSUM` | `WITH CHECKSUM` | Compute page checksums at backup time and validate read integrity |
| `NO_CHECKSUM` | `WITH NO_CHECKSUM` | Skip checksum computation (default) |
| `STOP_ON_ERROR` | `WITH STOP_ON_ERROR` | Abort backup on first page read failure |
| `CONTINUE_AFTER_ERROR` | `WITH CONTINUE_AFTER_ERROR` | Attempt to back up damaged pages despite errors |
| `INIT` | `WITH INIT` | Overwrite existing backup sets on the media |
| `NOINIT` | `WITH NOINIT` | Append to existing backup sets (default) |
| `FORMAT` | `WITH FORMAT` | Reinitialize the backup media (destroys all existing backups) |
| `NOFORMAT` | `WITH NOFORMAT` | Preserve media header (default) |
| `NAME` | `WITH NAME = N'backup name'` | Human-readable backup set name |
| `DESCRIPTION` | `WITH DESCRIPTION = N'...'` | Free-text description |
| `EXPIREDATE` | `WITH EXPIREDATE = '2026-12-31'` | Set backup expiration date |
| `RETAINDAYS` | `WITH RETAINDAYS = 30` | Retain for N days before allowing overwrite |
| `STATS` | `WITH STATS = 10` | Progress message every N percent |
| `COPY_ONLY` | `WITH COPY_ONLY` | Take backup without affecting the log chain |
| `DIFFERENTIAL` | `WITH DIFFERENTIAL` | Take a differential backup (data file only) |
| `MEDIADESCRIPTION` | `WITH MEDIADESCRIPTION = N'...'` | Media description on first write |
| `MEDIANAME` | `WITH MEDIANAME = N'...'` | Media name on first write |
| `BLOCKSIZE` | `WITH BLOCKSIZE = 65536` | Physical block size for the backup device |
| `BUFFERCOUNT` | `WITH BUFFERCOUNT = 50` | Number of I/O buffers used |
| `MAXTRANSFERSIZE` | `WITH MAXTRANSFERSIZE = 4194304` | Max size of each I/O transfer |
| `MIRROR TO` | `MIRROR TO DISK = '...'` | Write identical backup to a second device |
| `ENCRYPTION` | `WITH ENCRYPTION (ALGORITHM = AES_256, SERVER CERTIFICATE = cert_name)` | Encrypt the backup with a certificate or asymmetric key |
| `NO_TRUNCATE` | `WITH NO_TRUNCATE` | `BACKUP LOG` option: do not truncate log after backup |

### RESTORE DATABASE and RESTORE LOG WITH options

| Flag | Syntax | Description |
|---|---|---|
| `RECOVERY` | `WITH RECOVERY` | Bring database online after restore (default) |
| `NORECOVERY` | `WITH NORECOVERY` | Leave database in restoring state for further log apply |
| `STANDBY` | `WITH STANDBY = '/path/to/undo.bak'` | Leave database in read-only state with undo file |
| `REPLACE` | `WITH REPLACE` | Overwrite existing database |
| `CHECKSUM` | `WITH CHECKSUM` | Validate page checksums during restore |
| `NO_CHECKSUM` | `WITH NO_CHECKSUM` | Skip checksum validation |
| `MOVE` | `WITH MOVE 'logical_name' TO '/new/path/file.mdf'` | Redirect a logical file to a new physical path |
| `KEEP_CDC` | `WITH KEEP_CDC` | Preserve Change Data Capture metadata |
| `KEEP_REPLICATION` | `WITH KEEP_REPLICATION` | Preserve replication settings |
| `PARTIAL` | `WITH PARTIAL` | Restore a subset of filegroups (piecemeal restore) |
| `STOPAT` | `WITH STOPAT = '2026-04-11 15:30:00'` | Stop log recovery at a specific point in time |
| `STOPATMARK` | `WITH STOPATMARK = 'tx_name'` | Stop at a named transaction mark |
| `STOPBEFOREMARK` | `WITH STOPBEFOREMARK = 'tx_name'` | Stop immediately before a named transaction mark |
| `STATS` | `WITH STATS = 5` | Progress message every N percent |
| `FILE` | `FILE = 2` | Select backup set N from the media |
| `PASSWORD` | `WITH PASSWORD = N'...'` | Password-protected backup set (deprecated in SQL 2012+) |
| `RESTART` | `WITH RESTART` | Restart an interrupted restore |
| `RESTRICTED_USER` | `WITH RESTRICTED_USER` | Allow only `db_owner` / `dbcreator` / `sysadmin` after restore |

### DBCC CHECKDB options

| Flag | Syntax | Description |
|---|---|---|
| `NO_INFOMSGS` | `WITH NO_INFOMSGS` | Suppress informational messages, return only errors |
| `ALL_ERRORMSGS` | `WITH ALL_ERRORMSGS` | Return every error, not just the first per object |
| `PHYSICAL_ONLY` | `WITH PHYSICAL_ONLY` | Skip logical checks; only read page structure and checksums |
| `DATA_PURITY` | `WITH DATA_PURITY` | Check column values for out-of-range data |
| `ESTIMATEONLY` | `WITH ESTIMATEONLY` | Report tempdb space required without running checks |
| `TABLOCK` | `WITH TABLOCK` | Use table locks instead of a database snapshot (faster but blocks writers) |
| `EXTENDED_LOGICAL_CHECKS` | `WITH EXTENDED_LOGICAL_CHECKS` | Check indexed views, XML indexes, spatial indexes |
| `MAXDOP` | `WITH MAXDOP = N` | Override instance MAXDOP for the CHECKDB run |
| `REPAIR_ALLOW_DATA_LOSS` | `REPAIR_ALLOW_DATA_LOSS` | Repair by deallocating corrupt pages; data loss is possible |
| `REPAIR_REBUILD` | `REPAIR_REBUILD` | Repair without data loss; fixes missing rows in nonclustered indexes |
| `REPAIR_FAST` | `REPAIR_FAST` | Deprecated no-op, kept for syntax compatibility |

### ALTER INDEX REBUILD / REORGANIZE options

| Flag | Syntax | Description |
|---|---|---|
| `REBUILD` | `ALTER INDEX ... REBUILD` | Drop and rebuild the index from scratch |
| `REORGANIZE` | `ALTER INDEX ... REORGANIZE` | Online incremental compaction of leaf level |
| `ONLINE` | `WITH (ONLINE = ON)` | Allow reads and writes during rebuild (Enterprise or SQL 2022 Std) |
| `OFFLINE` | `WITH (ONLINE = OFF)` | Acquire schema modification lock for the rebuild (faster) |
| `FILLFACTOR` | `WITH (FILLFACTOR = 90)` | Leaf page fullness percentage (`0` = 100%) |
| `PAD_INDEX` | `WITH (PAD_INDEX = ON)` | Apply FILLFACTOR to non-leaf pages as well |
| `SORT_IN_TEMPDB` | `WITH (SORT_IN_TEMPDB = ON)` | Use tempdb for intermediate sort during rebuild |
| `DATA_COMPRESSION` | `WITH (DATA_COMPRESSION = PAGE)` | Apply `NONE`, `ROW`, `PAGE`, or `COLUMNSTORE_ARCHIVE` compression |
| `MAXDOP` | `WITH (MAXDOP = N)` | Max parallelism for the rebuild |
| `RESUMABLE` | `WITH (RESUMABLE = ON)` | Allow `ALTER INDEX ... PAUSE` and resume (SQL 2017+) |
| `MAX_DURATION` | `WITH (MAX_DURATION = N MINUTES)` | Auto-pause a resumable rebuild after N minutes |
| `WAIT_AT_LOW_PRIORITY` | `WITH (ONLINE = ON (WAIT_AT_LOW_PRIORITY (MAX_DURATION = N MINUTES, ABORT_AFTER_WAIT = NONE)))` | Low-priority lock wait behavior on online rebuild |

### UPDATE STATISTICS options

| Flag | Syntax | Description |
|---|---|---|
| `FULLSCAN` | `WITH FULLSCAN` | Scan every row to build the histogram |
| `SAMPLE` | `WITH SAMPLE 50 PERCENT` | Scan a percentage of rows |
| `SAMPLE ROWS` | `WITH SAMPLE 1000000 ROWS` | Scan a fixed number of rows |
| `RESAMPLE` | `WITH RESAMPLE` | Reuse the previous sample rate |
| `NORECOMPUTE` | `WITH NORECOMPUTE` | Disable auto-update for this statistic going forward |
| `INCREMENTAL` | `WITH INCREMENTAL = ON` | Per-partition statistics on partitioned tables |
| `MAXDOP` | `WITH MAXDOP = N` | Max parallelism for the statistics rebuild |
| `ON PARTITIONS` | `ON PARTITIONS (1, 2, 3)` | Update stats only for named partitions |
| `PERSIST_SAMPLE_PERCENT` | `WITH PERSIST_SAMPLE_PERCENT = ON` | Remember the sample percentage for future auto-updates |

### sqlcmd flags

| Flag | Syntax | Description |
|---|---|---|
| `-S` | `-S server[,port]` | Server host and optional port (use comma, not colon) |
| `-U` | `-U login` | SQL Server login |
| `-P` | `-P password` | Password for SQL auth |
| `-E` | `-E` | Use trusted (Windows) authentication |
| `-d` | `-d database_name` | Default database context |
| `-Q` | `-Q "SELECT ..."` | Execute a single query and exit |
| `-q` | `-q "SELECT ..."` | Execute a query but do not exit |
| `-i` | `-i /path/to/script.sql` | Read T-SQL from a file |
| `-o` | `-o /path/to/output.txt` | Write output to a file |
| `-W` | `-W` | Strip trailing whitespace (useful for CSV output) |
| `-s` | `-s "\|"` | Column separator character |
| `-w` | `-w 255` | Output line width |
| `-h` | `-h -1` | Header rows (-1 suppresses headers) |
| `-t` | `-t 60` | Query timeout in seconds |
| `-l` | `-l 30` | Login timeout in seconds |
| `-b` | `-b` | Terminate on error (sets errorlevel for scripting) |
| `-r` | `-r {0\|1}` | Redirect stderr to stdout (0) or all output to stderr (1) |
| `-C` | `-C` | Trust server certificate (skip TLS validation) |
| `-N` | `-N` | Use encrypted connection |
| `-v` | `-v var=value` | Define a scripting variable |
| `-I` | `-I` | Enable quoted identifier (`SET QUOTED_IDENTIFIER ON`) |

### mssql-conf settings used in production hardening

| Setting | Syntax | Description |
|---|---|---|
| `memory.memorylimitmb` | `sudo /opt/mssql/bin/mssql-conf set memory.memorylimitmb 28672` | Cap SQL Server memory consumption in MB (prevents Linux OOM) |
| `telemetry.customerfeedback` | `... set telemetry.customerfeedback false` | Disable Customer Experience Improvement Program telemetry |
| `filelocation.defaultdatadir` | `... set filelocation.defaultdatadir /data/mssql/data` | Default directory for new data files |
| `filelocation.defaultlogdir` | `... set filelocation.defaultlogdir /data/mssql/log` | Default directory for new log files |
| `filelocation.defaultbackupdir` | `... set filelocation.defaultbackupdir /data/mssql/backup` | Default directory for backup files |
| `network.tcpport` | `... set network.tcpport 1433` | TCP port SQL Server listens on |
| `network.forceencryption` | `... set network.forceencryption 1` | Force TLS encryption on all connections |
| `network.tlscert` | `... set network.tlscert /etc/ssl/certs/mssql.pem` | TLS certificate file |
| `network.tlskey` | `... set network.tlskey /etc/ssl/private/mssql.key` | TLS private key file |
| `network.tlsprotocols` | `... set network.tlsprotocols 1.2` | Enabled TLS protocol versions |
| `sqlagent.enabled` | `... set sqlagent.enabled true` | Enable SQL Server Agent on Linux |
| `sqlagent.databasemailprofile` | `... set sqlagent.databasemailprofile default` | Database mail profile for Agent job failure notifications |
| `traceflag` | `... traceflag set 1222` | Set a startup trace flag (e.g. 1222 for verbose deadlock logging) |
| `language.lcid` | `... set language.lcid 1033` | Default LCID for session language |
| `coredump.coredumptype` | `... set coredump.coredumptype full` | Enable full core dumps for crash analysis |
| `hadr.hadrenabled` | `... set hadr.hadrenabled 1` | Enable Always On Availability Groups on Linux (requires Pacemaker) |

## Diagnostic decision flow

The following flowchart captures how a senior operator routes from a wait type observation to a specific root cause class. Use this after the severity triage flowchart in the opening section has identified a symptom class and you need to drill into the specific cause.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {
  'primaryColor': '#292e42',
  'primaryTextColor': '#c0caf5',
  'primaryBorderColor': '#565f89',
  'lineColor': '#565f89',
  'secondaryColor': '#1a1b26',
  'tertiaryColor': '#24283b',
  'noteTextColor': '#c0caf5',
  'noteBkgColor': '#292e42',
  'textColor': '#c0caf5',
  'fontSize': '14px'
}}}%%
flowchart TD
    wait[Top wait type<br/>from sys.dm_os_wait_stats] --> family{Wait family?}

    family -->|LCK_M_*| lck[Lock wait]
    family -->|PAGELATCH_*| latch[Page latch wait]
    family -->|PAGEIOLATCH_*| io[Page IO latch wait]
    family -->|CXPACKET / CXCONSUMER| par[Parallelism wait]
    family -->|WRITELOG| wlog[Log flush wait]
    family -->|RESOURCE_SEMAPHORE| mem[Memory grant wait]
    family -->|ASYNC_NETWORK_IO| net[Client-side consumer wait]

    lck --> lckq{Cycle in<br/>waits-for graph?}
    lckq --> yes1[YES]
    lckq --> no1[NO]
    yes1 -.->|deadlock| p2[P2: Deadlock during ETL]
    no1 -.->|blocking| p9[P9: Blocking chain]

    latch --> latchq{PFS or GAM page<br/>in tempdb?}
    latchq --> yes2[YES]
    latchq --> no2[NO]
    yes2 -.->|tempdb contention| p16[P16: Tempdb PFS/GAM]
    no2 -.->|allocation contention| p16

    io -.->|I/O subsystem saturated| disk[Storage I/O bottleneck]
    disk -.->|correlate with<br/>dm_io_virtual_file_stats| p3[P3: Data disk full?]

    par --> parq{cost threshold<br/>for parallelism = 5?}
    parq --> yes3[YES]
    parq --> no3[NO]
    yes3 -.->|small queries going parallel| p19[P19: MAXDOP misconfiguration]
    no3 -.->|genuine parallelism skew| p19

    wlog -.->|log flush backed up| p1[P1: Transaction log full?]
    mem -.->|memory pressure| mem2[Check max server memory]
    net -.->|slow client read| net2[Not a server problem]

    classDef yesNode fill:#1f3b2d,stroke:#73d13d,color:#c0caf5
    classDef noNode fill:#4a1f24,stroke:#db4b4b,color:#c0caf5
    class yes1,yes2,yes3 yesNode
    class no1,no2,no3 noNode
```

Every wait family in the flowchart maps to a specific problem in this note. Once the wait stats point at a family, jump to the corresponding H3 section and run the diagnostic query at the top of that section to confirm the specific cause.

## Related

- [wait-stats-analysis](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/03-Query-Writing-and-Optimization/wait-stats-analysis) — wait type diagnosis and resolution playbook
- [memory-and-buffer-pool](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/01-Server-Operations/memory-and-buffer-pool) — memory pressure, max server memory tuning, buffer pool extension
- [execution-plans](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/03-Query-Writing-and-Optimization/execution-plans) — reading execution plans and identifying CONVERT_IMPLICIT warnings
- [query-store-regressions-and-plan-forcing](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/03-Query-Writing-and-Optimization/query-store-regressions-and-plan-forcing) — Query Store deep dive and plan forcing workflow
- [deadlock-detection-and-prevention](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/03-Query-Writing-and-Optimization/deadlock-detection-and-prevention) — full deadlock graph schema and prevention patterns
- [blocking-and-locking](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/03-Query-Writing-and-Optimization/blocking-and-locking) — blocking chain analysis with live reproduction
- [index-maintenance](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/02-Database-Design-and-Storage/index-maintenance) — fragmentation measurement, rebuild/reorganize strategies, Ola Hallengren solution
- [race-conditions](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/03-Query-Writing-and-Optimization/race-conditions) — lost updates, phantom reads, MERGE under concurrency
- [stored-procedures-dynamic-sql-and-error-handling](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/03-Query-Writing-and-Optimization/stored-procedures-dynamic-sql-and-error-handling) — full error handling pattern reference
- [06-essential-dba-queries](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/01-Server-Operations/essential-dba-queries) — catch-all diagnostic playbook for uncategorized symptoms

## Sources

- Microsoft Learn — [sys.databases](https://learn.microsoft.com/sql/relational-databases/system-catalog-views/sys-databases-transact-sql), [sys.dm_db_log_space_usage](https://learn.microsoft.com/sql/relational-databases/system-dynamic-management-views/sys-dm-db-log-space-usage-transact-sql), [sys.dm_db_index_physical_stats](https://learn.microsoft.com/sql/relational-databases/system-dynamic-management-views/sys-dm-db-index-physical-stats-transact-sql), [sys.dm_database_encryption_keys](https://learn.microsoft.com/sql/relational-databases/system-dynamic-management-views/sys-dm-database-encryption-keys-transact-sql), [sys.query_store_plan](https://learn.microsoft.com/sql/relational-databases/system-catalog-views/sys-query-store-plan-transact-sql), [sys.dm_exec_query_stats](https://learn.microsoft.com/sql/relational-databases/system-dynamic-management-views/sys-dm-exec-query-stats-transact-sql), [BACKUP (Transact-SQL)](https://learn.microsoft.com/sql/t-sql/statements/backup-transact-sql), [RESTORE (Transact-SQL)](https://learn.microsoft.com/sql/t-sql/statements/restore-statements-transact-sql), [ALTER INDEX](https://learn.microsoft.com/sql/t-sql/statements/alter-index-transact-sql), [DBCC CHECKDB](https://learn.microsoft.com/sql/t-sql/database-console-commands/dbcc-checkdb-transact-sql), [UPDATE STATISTICS](https://learn.microsoft.com/sql/t-sql/statements/update-statistics-transact-sql), [sqlcmd utility](https://learn.microsoft.com/sql/tools/sqlcmd/sqlcmd-utility), [mssql-conf Linux settings](https://learn.microsoft.com/sql/linux/sql-server-linux-configure-mssql-conf)
- Community — Paul Randal "Transaction log is full", Erik Darling "Parameter Sniffing", Brent Ozar "Implicit Conversions" and "String or Binary Data Truncated", Aaron Bertrand "Don't use MERGE", Michael J. Swart "What to avoid if you want to use MERGE", Ola Hallengren "IndexOptimize" solution, Glenn Berry "SQL Server Diagnostic Information Queries"
- Microsoft Knowledge Base — KB2694124, KB2925678, KB4497928 (MERGE concurrency issues)
