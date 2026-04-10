---
title: "07 - Backup Types and Strategy"
tags:
  - sql-server
  - administration
  - backup
aliases:
  - SQL Server backup strategy
  - full backup
  - differential backup
  - transaction log backup
description: "Production SQL Server backup strategy: backup types, backup-chain rules, verification commands, retention guidance, and real backup metadata captured from the current environment."
parent: "[[domain-server-operations]]"
links:
  - "[[01-server-configuration]]"
  - "[[08-restore-and-recovery]]"
  - "[[05-sql-server-agent-jobs]]"
  - "[[02-sqlcmd-connection-and-usage]]"
  - "[[06-essential-dba-queries]]"
created: 2026-03-22
updated: 2026-04-08
status: complete
---

# Backup Types and Strategy

This note explains how SQL Server backups fit together operationally. A backup strategy is not a list of commands. It is a restore design expressed as a schedule: which backup types exist, how they depend on each other, where the files live, how long they are retained, and how you prove they can be restored.

The live evidence in this note comes from a disposable backup taken on April 8, 2026 and recorded in `msdb`.

---

## Backup Model

SQL Server supports several backup types, but only three form the core of most production strategies: full, differential, and transaction log. The restore design follows directly from how these three interact.

### Chain Semantics

The most important thing to understand is that backups do not exist independently. They form restore dependencies.

#### How the main backup types relate to each other

| Backup type | What it captures | Depends on | Typical use |
|---|---|---|---|
| Full | Entire database plus enough log for transactional consistency at backup completion | Nothing earlier in the chain | Baseline for every restore design |
| Differential | Extents changed since the most recent conventional full backup | Latest conventional full backup | Reduces restore time between full backups |
| Transaction log | Log records since the previous log backup | Unbroken log chain and a recovery-model design that supports log backups | Point-in-time recovery and log truncation in FULL/BULK_LOGGED |
| Copy-only full | Full backup that does not reset the differential base | Nothing earlier in the chain | Ad hoc protection before risky work |
| Copy-only log | Log backup that does not affect the normal log-backup archive point | Existing log chain | Specialized operational cases |

#### Backup chain and restore dependency flow

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
flowchart LR
    F[Conventional Full Backup] --> D[Latest Differential]
    D --> L1[Log Backup 1]
    L1 --> L2[Log Backup 2]
    L2 --> LN[Final Required Log]
    LN --> R[Restore Target]
    F -. supports direct restore without differential .-> L1
```

### Recovery Model Boundaries

Backup strategy depends on the database recovery model. A FULL backup command works in every recovery model. Point-in-time recovery does not.

#### Current recovery-model signal for the primary workload database

> [!info]-
> This query reads the database-level recovery configuration from `sys.databases`.
>
> - `recovery_model_desc` tells you which backup types are meaningful operationally.
> - `log_reuse_wait_desc` tells you whether the log is currently waiting on a backup or blocked by something else.
>
> *This query confirms whether the database is even eligible for a log-backup strategy and point-in-time recovery.*
>
```sql
SELECT
    name,
    recovery_model_desc,
    log_reuse_wait_desc
FROM sys.databases
WHERE name = 'stoxx';
```

| name | recovery_model_desc | log_reuse_wait_desc |
|---|---|---|
| stoxx | FULL | ACTIVE_TRANSACTION |

*`stoxx` is in `FULL` recovery model, so a real log-backup chain is both possible and expected if the environment requires point-in-time recovery. The current blocker to log reuse is `ACTIVE_TRANSACTION`, not `LOG_BACKUP`, which means an open transaction is the immediate reason the log cannot reuse space. That does not remove the need for log backups; it just means the present log-pressure explanation is transactional rather than backup-related.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `recovery_model_desc` | `FULL` | Context dependent | Log backups and PITR are supported | Use only if you will actually run log backups |
| `recovery_model_desc` | `SIMPLE` | Context dependent | Log backups are not part of the design | Simpler log management, but no PITR |
| `recovery_model_desc` | `BULK_LOGGED` | Watch carefully | Minimal logging for some bulk operations | Use temporarily, not as a casual permanent default |
| `log_reuse_wait_desc` | `LOG_BACKUP` | &#10060; under FULL/BULK_LOGGED | Log backup is required before reuse | Backup job failure or missing schedule is likely |
| `log_reuse_wait_desc` | `ACTIVE_TRANSACTION` | Watch | Open transaction blocks reuse | Investigate open transactions first |

---

## Inspecting Real Backup Evidence

Any backup strategy should be validated against `msdb`, not just against job definitions or scripts.

### Backup History

This subsection shows the actual backup metadata recorded by SQL Server in the current environment.

#### Recent backup history from `msdb.dbo.backupset`

> [!info]-
> This query reads the main backup history table in `msdb`.
>
> - `type = 'D'` means full database backup.
> - `backup_size_mb` is the logical backup size.
> - `compressed_backup_size_mb` is the physical size written to the backup file when compression is used.
> - `is_copy_only` shows whether the backup participates in the normal backup chain.
> - `recovery_model` records the database recovery model at backup time.
>
> *This query proves that a full backup was recorded and shows whether compression and copy-only semantics were involved.*
>
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

*The current environment has at least one verified full-backup record in `msdb`, but it is a disposable administration lab database, not the `stoxx` workload database. That matters operationally: the backup mechanism works, but this output does not prove that `stoxx` already has a real scheduled backup cadence. The compression ratio is strong at roughly 6.2:1, which is what you want to see for ordinary compressed full backups on small rowstore data.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `type` | `D` | &#9989; here | Full database backup | Baseline backup type |
| `type` | `I` | Context dependent | Differential backup | Speeds up restore between full and logs |
| `type` | `L` | Context dependent | Transaction log backup | Required for PITR in FULL/BULK_LOGGED |
| `is_copy_only` | `0` | &#9989; here | Conventional backup | Affects normal chain semantics |
| `is_copy_only` | `1` | Context dependent | Copy-only backup | Useful but not a replacement for scheduled chain members |

#### Physical media path for the recorded backup

*This query joins `backupset` to `backupmediafamily` so you can see where SQL Server physically wrote the backup.*

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

*The backup record points to a real `.bak` file under `/var/opt/mssql/backup`. This is the operational bridge between backup metadata and restore execution: when a restore request arrives, you need both the `msdb` history and the media path.*

### Backup Verification

Backup history is not enough. You also need commands that confirm the file is readable and that show what is inside it.

#### Verify the backup file without restoring it

> [!info]-
> `RESTORE VERIFYONLY` validates that SQL Server can read the backup set and that the backup structure is internally consistent.
>
> - It does not restore data.
> - With `CHECKSUM`, SQL Server also validates the backup checksums if they exist.
> - It does not replace a real test restore.
>
> *This command checks whether the backup file is structurally valid and readable without performing a restore.*
>
```sql
RESTORE VERIFYONLY
FROM DISK = '/var/opt/mssql/backup/admin_restore_demo_full.bak'
WITH CHECKSUM;
```

| Result |
|---|
| The backup set on file 1 is valid. |

*This is the expected success message from `VERIFYONLY`: SQL Server can read the file and the backup structure is valid. That is necessary, but not sufficient. `VERIFYONLY` does not prove that the backup restores to a usable database or that the underlying data is logically clean.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `Result` | `The backup set on file 1 is valid.` | &#9989; | Backup structure is readable and valid | Good first validation step before restore |
| `Result` | Checksum or media error text | &#10060; | Backup file is damaged, incomplete, or unreadable | Treat the backup as unusable until proven otherwise |

#### Inspect the backup-set header metadata

> [!info]-
> `RESTORE HEADERONLY` returns one row per backup set on the media. The full row is wide, so the fields below focus on the columns that matter most first:
>
> - `BackupType` identifies the backup-set kind numerically.
> - `Compressed` shows whether compression was used.
> - `Position` identifies the backup-set number on the media.
> - `DatabaseName` identifies the source database.
> - `RecoveryModel` records the recovery model at backup time.
> - `BackupTypeDescription` is the human-readable backup type.
> - `CompressedBackupSize` is the actual number of bytes written to media after compression.
>
> *This command shows what kind of backup is stored in the file and which source database and recovery model it belongs to.*
>
```sql
RESTORE HEADERONLY
FROM DISK = '/var/opt/mssql/backup/admin_restore_demo_full.bak';
```

| BackupType | Compressed | Position | DatabaseName | BackupStartDate | BackupFinishDate | RecoveryModel | BackupTypeDescription | CompressedBackupSize | CompressionAlgorithm |
|---:|---:|---:|---|---|---|---|---|---:|---|
| 1 | 1 | 1 | admin_restore_demo | 2026-04-08 16:35:41.000 | 2026-04-08 16:35:41.000 | FULL | Database | 488703 | MS_XPRESS |

*The header proves this file contains one compressed full database backup for `admin_restore_demo`, taken while the source database was in `FULL` recovery model. `Position = 1` matters when a media file contains multiple backup sets; here there is only one. `CompressionAlgorithm = MS_XPRESS` is the expected SQL Server backup-compression algorithm on this build.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `BackupType` | `1` | &#9989; here | Full database backup | Valid full-backup restore starting point |
| `BackupType` | `2`, `5` | Context dependent | Log or differential backup | Use only in the right restore sequence |
| `Compressed` | `1` | &#9989; | Backup was compressed | Lower media footprint |
| `Compressed` | `0` | Context dependent | Backup stored uncompressed | Larger storage and transfer cost |
| `Position` | `1` | Context | First backup set on the media | Use `WITH FILE = 1` if the media later contains multiple sets |
| `RecoveryModel` | `FULL` | Context dependent | Recovery model at backup time | Important when reasoning about later log backups |

#### Inspect the logical files stored in the backup

> [!info]-
> `RESTORE FILELISTONLY` returns one row per file inside the backup.
>
> - `LogicalName` is the name you must reference in `WITH MOVE` clauses during side-by-side restore.
> - `PhysicalName` is the original file path on the source instance.
> - `Type` identifies whether the file is a data file (`D`) or log file (`L`).
> - `FileGroupName` identifies the owning filegroup for data files.
>
> *This command lists the data and log files stored inside the backup so you can build the correct `WITH MOVE` restore command.*
>
```sql
RESTORE FILELISTONLY
FROM DISK = '/var/opt/mssql/backup/admin_restore_demo_full.bak';
```

| LogicalName | PhysicalName | Type | FileGroupName | Size | FileId | IsReadOnly | IsPresent |
|---|---|---|---|---:|---:|---:|---:|
| admin_restore_demo | /var/opt/mssql/data/admin_restore_demo.mdf | D | PRIMARY | 8388608 | 1 | 0 | 1 |
| admin_restore_demo_log | /var/opt/mssql/data/admin_restore_demo_log.ldf | L | NULL | 8388608 | 2 | 0 | 1 |

*These are the exact logical names required for a side-by-side restore. The presence of one data file and one log file keeps the restore simple, but the important operational principle is general: `LogicalName`, not `PhysicalName`, is what the `MOVE` clause must target.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `Type` | `D` | &#9989; | Data file | Restore into `.mdf` or `.ndf` destination |
| `Type` | `L` | &#9989; | Log file | Restore into `.ldf` destination |
| `IsPresent` | `1` | &#9989; | File is present in the backup set | Restore can reference it normally |
| `IsReadOnly` | `0` | Context | File was not read-only at backup time | Normal mutable file |

---

## Production Backup Commands

These are the commands that actually implement the strategy. The safest pattern is to treat each backup type as a deliberate operational tool, not as a syntax variation you choose casually.

### Core Commands

#### Take a conventional full backup

> [!success]
> Use a conventional full backup as the baseline for every restore design. Add `CHECKSUM` unless you have a tested reason not to, and add `COMPRESSION` unless you have a tested storage or CPU reason not to.
>
> *This command creates the baseline full backup that later differential and log restores depend on.*
>
```sql
BACKUP DATABASE stoxx
TO DISK = '/var/opt/mssql/backup/stoxx_full.bak'
WITH COMPRESSION, CHECKSUM, STATS = 10;
```

#### Take a differential backup

*This command backs up only the extents changed since the most recent conventional full backup.*

```sql
BACKUP DATABASE stoxx
TO DISK = '/var/opt/mssql/backup/stoxx_diff.bak'
WITH DIFFERENTIAL, COMPRESSION, CHECKSUM, STATS = 10;
```

#### Take a transaction log backup

> [!warning]
> This command only makes sense when the database is in `FULL` or `BULK_LOGGED` recovery model and a real log-chain design exists. A database left in `FULL` recovery model without a log-backup cadence will eventually grow its log until writes fail.
>
> [!success]
> If the database needs point-in-time recovery, pair `FULL` recovery model with a log-backup job. Treat recovery model and log-backup schedule as one design decision, not two separate tasks.
>
> *This command backs up the transaction log since the previous log backup and advances the log chain.*
>
```sql
BACKUP LOG stoxx
TO DISK = '/var/opt/mssql/backup/stoxx_log.trn'
WITH COMPRESSION, STATS = 10;
```

#### Take a copy-only full backup before risky work

*This command creates an ad hoc full backup without resetting the differential base of the normal backup chain.*

```sql
BACKUP DATABASE stoxx
TO DISK = '/var/opt/mssql/backup/stoxx_prechange_copy_only.bak'
WITH COPY_ONLY, COMPRESSION, CHECKSUM, STATS = 10;
```

---

## Scheduling And Retention

A backup strategy is only real when the cadence and retention are explicit.

### Cadence

Use backup frequency to express RPO and restore effort, not habit.

#### Common starting schedules

| Workload type | Full backup | Differential backup | Log backup |
|---|---|---|---|
| OLTP or user-generated data | Daily | Every 4-6 hours | Every 5-15 minutes |
| Analytics with moderate reload cost | Daily or weekly | Daily | Optional, if PITR is required |
| Fully reproducible staging or dev | Daily or weekly | Optional | Usually none, if SIMPLE recovery is intentional |

### Retention And Off-Instance Copies

Keep at least one storage copy outside the SQL Server host. Local backups are operationally useful but not enough as a resilience design.

#### 3-2-1 interpretation for SQL Server

| Rule element | Practical meaning |
|---|---|
| 3 copies | Production data plus at least two independent backup copies |
| 2 media or storage contexts | Local disk plus object storage, or local disk plus snapshot layer |
| 1 off-instance or offsite copy | A backup that survives loss of the SQL Server host or attached storage |

#### Set backup retention metadata in the command when appropriate

*This command shows how to set SQL Server media-retention metadata directly on the backup set.*

```sql
BACKUP DATABASE stoxx
TO DISK = '/var/opt/mssql/backup/stoxx_full.bak'
WITH COMPRESSION, CHECKSUM, RETAINDAYS = 30;
```

---

## Related

- [[08-restore-and-recovery]] for the actual restore commands and side-by-side restore workflow
- [[01-server-configuration]] for the recovery-model decision that makes the backup-chain design possible
- [[05-sql-server-agent-jobs]] for scheduling and monitoring recurring backup jobs
- [[02-sqlcmd-connection-and-usage]] for shell-based backup automation patterns
- [[06-essential-dba-queries]] for the `msdb` and log-space checks that prove the strategy is actually running
