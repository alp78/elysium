---
type: concept
category: sql-server
technology: [sql-server]
tags: [sql, sql-server, tsql]
aliases: [SQL Server backup, full backup, differential backup, transaction log backup, copy-only backup, 3-2-1 rule, backup strategy]
keywords: [backup, full backup, differential backup, transaction log backup, copy-only backup, BACKUP DATABASE, BACKUP LOG, RESTORE VERIFYONLY, 3-2-1 rule, GCS backup, recovery model, RPO, RTO, .bak, .trn, compression, checksum, PITR, point-in-time recovery]
description: "SQL Server backup types (full, differential, transaction log, copy-only), the 3-2-1 backup rule, recovery model selection, and an automated GCS backup script."
related: [restore-and-recovery, server-configuration, sqlcmd-connection-and-usage]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Backup Types and Strategy

Backups are the single most critical responsibility of anyone operating a database. A backup strategy is not "I'll remember to back up before big changes" — it is a documented, automated, tested schedule that guarantees you can recover to any point in time within your recovery window.

---

## Backup Types

| Backup Type | What It Contains | Duration | Frequency | Use Case |
|---|---|---|---|---|
| **Full** | Entire database | Minutes to hours | Daily or weekly | Baseline for all other backups |
| **Differential** | Changes since last full | Seconds to minutes | Every 6-12 hours | Reduce recovery time between fulls |
| **Transaction Log** | Log records since last log backup | Seconds | Every 15-60 minutes | Point-in-time recovery |
| **Copy-Only** | Same as full, but doesn't break backup chain | Minutes | Ad-hoc | Before risky operations |

#### .bak, .trn, .dif — backup file extensions and typical sizes

| Backup Type | File Extension | Typical Size |
|---|---|---|
| **Full** | `.bak` | Large (= DB size compressed) |
| **Differential** | `.bak` | Medium (fraction of full) |
| **Transaction Log** | `.trn` | Small |

---

### T-SQL Backup Commands

#### BACKUP DATABASE — full backup (the foundation of all restores)

```sql
-- Full backup — baseline for all other backups
BACKUP DATABASE analytics_db
TO DISK = '/var/opt/mssql/backup/mydb_full.bak'
WITH COMPRESSION, STATS = 10, CHECKSUM;
-- COMPRESSION = 3-5x smaller, slightly more CPU
-- STATS = 10 = print progress every 10%
-- CHECKSUM = verify integrity during backup (catches corruption early)
```

#### BACKUP DATABASE WITH DIFFERENTIAL — only changes since last full

```sql
-- Differential — only pages changed since last full
BACKUP DATABASE analytics_db
TO DISK = '/var/opt/mssql/backup/mydb_diff.bak'
WITH DIFFERENTIAL, COMPRESSION, CHECKSUM;
-- 10-50x faster than full backup (only changed pages)
```

#### BACKUP LOG — transaction log backup for point-in-time recovery

```sql
-- Transaction log (required for FULL recovery model)
BACKUP LOG analytics_db
TO DISK = '/var/opt/mssql/backup/mydb_log.trn'
WITH COMPRESSION;
-- Captures every transaction since the last log backup
-- Enables point-in-time recovery: "restore to 14:23:45 yesterday"
```

#### BACKUP DATABASE WITH COPY_ONLY — ad-hoc backup that preserves the chain

```sql
-- Copy-only — does not affect the backup chain
BACKUP DATABASE analytics_db
TO DISK = '/var/opt/mssql/backup/mydb_adhoc.bak'
WITH COPY_ONLY, COMPRESSION;
-- COPY_ONLY = does not reset the differential baseline
-- Use before: schema changes, risky deployments, data migrations
```

#### RESTORE VERIFYONLY — validate a backup file without restoring

```sql
-- Verify a backup file is readable and intact
RESTORE VERIFYONLY FROM DISK = '/var/opt/mssql/backup/mydb_full.bak'
WITH CHECKSUM;
-- Reads the entire backup file and verifies checksums
```

> [!warning] Always Verify
>
> An unverified backup is not a backup. Run `RESTORE VERIFYONLY` after every important backup. Also schedule monthly test restores to verify recoverability end-to-end.

---

### The 3-2-1 Backup Rule

> [!info] The 3-2-1 Rule
>
> - **3** copies of your data (production + 2 backups)
> - **2** different storage types (local disk + cloud storage)
> - **1** copy offsite (GCS bucket in a different region)
>
> For the GCS side, [[gcs-buckets-and-lifecycle]] covers lifecycle policies that automatically transition backups from Standard to Nearline to Coldline storage. As a complementary strategy, [[disks-and-snapshots|GCE disk snapshots]] provide block-level backup with near-instant restore.

---

### Automated Backup-to-GCS Script

```bash
# Automated backup-to-GCS script (run via cron)
#!/usr/bin/env bash
set -euo pipefail
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="/var/opt/mssql/backup/mydb_full_${DATE}.bak"
sqlcmd -S localhost -U sa -P "$SA_PASSWORD" -C -Q "BACKUP DATABASE analytics_db TO DISK = '${BACKUP_PATH}' WITH COMPRESSION, CHECKSUM"
gcloud storage cp "${BACKUP_PATH}" gs://analytics-db-backups/daily/
rm "${BACKUP_PATH}"  # remove local copy after upload
```

> [!danger] Test Your Restores
>
> Test Your Restores, Not Just Your Backups.
> A backup that cannot be restored is worse than no backup -- it gives false confidence. Schedule quarterly restore drills to a separate database. Common failures that only surface during restore: corrupt `.bak` files from disk errors, missing log chain gaps (skipped a log backup), and cross-version incompatibilities when restoring to a different SQL Server edition.

---

## Recovery Model Decision Matrix

The recovery model determines how transaction logs are managed and what kind of restores are possible.

| Criterion | FULL Recovery | SIMPLE Recovery |
|---|---|---|
| **Point-in-time recovery** | Yes — restore to any second | No — restore to last full/diff backup only |
| **Log file behavior** | Grows until you take a log backup | Auto-recycles at each checkpoint, stays small |
| **Log backup required** | Yes — every 5-15 min in production | No log backups possible |
| **Data loss window (RPO)** | Minutes (= log backup interval) | Hours or a full day (= full backup interval) |
| **Use when** | User-generated data, financial records, compliance | Reproducible data, idempotent pipelines, dev/test |
| **Risk if misconfigured** | Unbounded log growth fills disk | Cannot recover recent transactions |

> [!danger] FULL Recovery Needs Log Backups
>
> FULL Recovery Without Log Backups Fills Your Disk.
> Never leave a database in FULL recovery model without regular log backups. The transaction log will grow without bound until it fills the disk, at which point **all writes fail across all databases on the instance**. This is the single most common production outage for SQL Server. If you see the log file growing past 10 GB, check `SELECT log_reuse_wait_desc FROM sys.databases` -- if it says `LOG_BACKUP`, no log backups are running.

### Switching Recovery Models

```sql
-- Check current recovery model
SELECT name, recovery_model_desc FROM sys.databases WHERE name = 'analytics_db';

-- Switch to SIMPLE (idempotent pipeline, data reproducible from source)
ALTER DATABASE [analytics_db] SET RECOVERY SIMPLE;

-- Switch to FULL (production, point-in-time recovery needed)
ALTER DATABASE [analytics_db] SET RECOVERY FULL;
-- IMPORTANT: take a full backup IMMEDIATELY after switching to FULL
-- to start the log chain. PITR is impossible without it.
```

### After Switching from FULL to SIMPLE — Reclaim Log Space

Switching to SIMPLE marks the log space as reusable but does not shrink the `.ldf` file on disk. SQL Server will reuse the space internally, but the file stays its current size. To physically reclaim disk space:

```sql
-- Check current log size and usage
DBCC SQLPERF(LOGSPACE);

-- Find the logical name of the log file
SELECT name, type_desc, size * 8 / 1024 AS size_mb
FROM sys.database_files WHERE type = 1;

-- Shrink the log file to a reasonable size (e.g., 64 MB)
-- SQL Server will grow it again as needed, but under SIMPLE it will recycle space
DBCC SHRINKFILE(N'mydb_log', 64);
```

> [!warning] Never Shrink Data Files Routinely
>
> Never Shrink Data Files as Routine Maintenance.
> `DBCC SHRINKFILE` on data files (`.mdf`) causes massive index fragmentation, forcing expensive rebuilds afterward. Shrinking the log file (`.ldf`) after switching to SIMPLE recovery is fine -- shrinking data files as a regular practice is almost always counterproductive.

---

### Point-in-Time Recovery Sequence

To restore to a specific second in time, replay backups in this order:

```text
Full → Differential (optional, speeds up restore) → Log backups in sequence → STOPAT target timestamp
```

See [[restore-and-recovery]] for the complete RESTORE commands, and backup restore drill for the quarterly validation drill that tests these backups end-to-end.

---

### Production HA Backup Schedule

| Backup Type | Frequency | Storage | Purpose |
|---|---|---|---|
| Full | Daily at 02:00 UTC | GCS Standard → Nearline (7d) → Coldline (30d) | Baseline for restores |
| Differential | Every 4-6 hours | GCS Standard → Nearline (7d) | Reduces log replay time |
| Log | Every 5-15 minutes | GCS Standard → Nearline (7d) | Point-in-time recovery |

---

### Related

- [[restore-and-recovery]] — full restore, PITR, restore to new database
- [[server-configuration]] — recovery model configuration with `mssql-conf`
- [[sqlcmd-connection-and-usage]] — using sqlcmd for backup scripting
