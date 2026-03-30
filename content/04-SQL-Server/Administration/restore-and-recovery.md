---
type: how-to
category: sql-server
technology: [sql-server]
tags: [sql, sql-server, tsql]
aliases: [SQL Server restore, point-in-time recovery, PITR, RESTORE DATABASE, NORECOVERY, STOPAT, restore to new database]
keywords: [restore, RESTORE DATABASE, RESTORE LOG, NORECOVERY, RECOVERY, REPLACE, STOPAT, point-in-time recovery, PITR, full restore, differential restore, log restore, side-by-side restore, MOVE, disaster recovery, crash recovery]
description: "How to restore a SQL Server database from backup including full restore, point-in-time recovery (PITR) with log replaying, and restoring to a new database for side-by-side comparison."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Restore and Recovery

Knowing how to perform a restore is the test of whether your backup strategy is real. Every restore procedure should be practiced in a non-production environment before you need it under pressure.

---

### Full Restore

Overwrites the existing database with the contents of a full backup.

```sql
-- Restore full backup (overwrite existing database)
RESTORE DATABASE analytics_db
FROM DISK = '/var/opt/mssql/backup/mydb_full.bak'
WITH REPLACE, RECOVERY;
```

> [!info] RESTORE WITH options
>
> - **REPLACE** — overwrites the existing database without a safety check
> - **RECOVERY** — brings the database online after restore (this is the default if omitted)

> [!warning] REPLACE Destroys Existing Data
>
> `WITH REPLACE` overwrites the existing database without confirmation. Ensure you are targeting the correct database and server before running. Consider a side-by-side restore first if you are uncertain.

---

## Point-in-Time Recovery (PITR)

Restores to an exact second using the full backup chain: full → differential (optional) → log backups.

1. Restore the full backup with `NORECOVERY` to leave the database in a restoring state.
2. Restore the differential backup (also with `NORECOVERY`) to bring the database closer to the target time.
3. Restore the transaction log with `STOPAT` to replay transactions up to the exact second, then bring the database online with `RECOVERY`.

```sql
RESTORE DATABASE analytics_db FROM DISK = '/var/opt/mssql/backup/mydb_full.bak' WITH NORECOVERY;
RESTORE DATABASE analytics_db FROM DISK = '/var/opt/mssql/backup/mydb_diff.bak' WITH NORECOVERY;
RESTORE LOG analytics_db FROM DISK = '/var/opt/mssql/backup/mydb_log.trn'
WITH STOPAT = '2026-03-09T14:23:45', RECOVERY;
```

> [!info] STOPAT — point-in-time precision
>
> `STOPAT` tells SQL Server to stop replaying the transaction log at the specified timestamp. Any transactions committed after that moment are discarded. Pair it with `RECOVERY` on the final restore step to bring the database online.

#### RESTORE DATABASE options — NORECOVERY, STOPAT, REPLACE

| Option | Purpose |
|--------|---------|
| `NORECOVERY` | Leave the database in restoring state (more backups to apply) |
| `RECOVERY` | Bring the database online (final step) |
| `STOPAT = 'timestamp'` | Stop replaying the log at this exact point in time |
| `REPLACE` | Overwrite the existing database |

> [!info] PITR Needs FULL Recovery
>
> PITR Requires FULL Recovery Model.
> Point-in-time recovery is only possible if the database was in FULL recovery model at the time of the events you want to recover. If the database was in SIMPLE recovery, you can only restore to the last full or differential backup.

---

### Restore to a New Database (Side-by-Side)

Use this to restore a backup alongside the existing production database for comparison or investigation — without touching production data.

Use `MOVE` to remap data and log file paths when the original files are already in use by the production database — this lets you restore yesterday's backup alongside production for comparison.

```sql
-- Restore to a NEW database (side-by-side, for comparison)
RESTORE DATABASE project_investigation
FROM DISK = '/var/opt/mssql/backup/mydb_full.bak'
WITH MOVE 'analytics_db' TO '/var/opt/mssql/data/project_inv.mdf',
     MOVE 'mydb_log' TO '/var/opt/mssql/data/project_inv_log.ldf',
     RECOVERY;
```

> [!tip] Side-by-Side Investigation
>
> Side-by-Side for Safe Investigation.
> When investigating a data quality issue, always restore to a new database name (`project_investigation`) rather than overwriting production. This lets you compare old vs. current data without risk.

---

### Verifying a Backup Before Restoring

Run `RESTORE VERIFYONLY` to check that a backup file is intact without performing the actual restore. This should be part of your regular backup verification schedule.

```sql
RESTORE VERIFYONLY FROM DISK = '/var/opt/mssql/backup/mydb_full.bak' WITH CHECKSUM;
```

---

## Monitoring Recovery Progress After a Crash

After an unexpected shutdown, SQL Server runs through three recovery phases (Analysis → Redo → Undo). Monitor progress:

```sql
-- Monitor recovery progress after a crash
SELECT
    database_id,
    DB_NAME(database_id) AS database_name,
    percent_complete,
    estimated_completion_time / 60000 AS est_minutes_remaining
FROM sys.dm_exec_requests
WHERE command LIKE '%RECOVERY%';
```

#### Crash recovery — analysis, redo, undo phases

| Phase | What Happens | Duration |
|---|---|---|
| **Analysis** | Read log from last checkpoint, build list of dirty pages and active transactions | Fast |
| **Redo (roll forward)** | Replay all committed changes not yet in `.mdf` | Proportional to log records since last checkpoint |
| **Undo (roll back)** | Reverse uncommitted transactions from before the crash | Proportional to uncommitted work at crash time |

#### Crash recovery scenarios — clean shutdown vs power failure vs log corruption

| Scenario | Impact |
|---|---|
| VM hard-stops (GCE preemption or `--force`) | Recovery replays log from last checkpoint. Typically seconds to a few minutes. No data loss for committed transactions. |
| `systemctl stop mssql-server` (graceful) | SQL Server runs a final checkpoint, flushing all dirty pages. Recovery on restart is instant. |
| `.ldf` disk fills up | All write operations fail immediately. Database is still readable. Fix: add space, shrink log, or switch to SIMPLE. |
| `.mdf` corruption (bad disk sector) | Recovery fails. Restore from backup. This is why `BACKUP WITH CHECKSUM` exists. |

---

### Related

- [backup-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/Administration/backup-types-and-strategy) — understanding backup types and the 3-2-1 rule
- [server-configuration](https://alp78.github.io/elysium/04-SQL-Server/Administration/server-configuration) — recovery model configuration
- [essential-dba-queries](https://alp78.github.io/elysium/04-SQL-Server/Administration/essential-dba-queries) — monitoring active queries and blocking
- [storage-internals](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/storage-internals) — how WAL and checkpoints work at the page level
