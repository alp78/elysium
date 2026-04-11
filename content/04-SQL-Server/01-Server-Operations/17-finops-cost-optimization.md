---
title: "17 - FinOps Cost Optimization"
tags:
  - sql-server
  - administration
  - finops
  - gcp
aliases:
  - SQL Server cost optimization
  - SQL Server FinOps
description: "Cost-control patterns for SQL Server on GCP, grounded on current SQL Server storage signals and focused on backup compression, snapshots, retention, and compute commitment choices."
created: 2026-03-22
updated: 2026-04-08
status: complete
---

# FinOps Cost Optimization

FinOps for SQL Server is not "make the cloud bill smaller" in the abstract. It is the discipline of connecting SQL Server behavior to infrastructure spend: how much storage the instance allocates, how large the log grows, how efficiently backups compress, whether retention is overbuilt, whether the VM shape matches real use, and which backup and snapshot layers are worth paying for.

---

## Current SQL Server Cost Signals

Start with the SQL Server facts that most directly influence cost. You do not need a cloud bill to see the first layer of waste. SQL Server already tells you a lot.

### Storage Footprint

#### Current database data and log allocation

> [!info]-
> This query aggregates `sys.master_files` by database.
>
> - `data_size_mb` is allocated row-data space
> - `log_size_mb` is allocated transaction-log space
> - `total_size_mb` is the combined allocated footprint
>
> This is the first storage-cost view because allocated SQL Server space eventually becomes disk cost, snapshot size, backup size, or all three.
>
> *This query shows how much storage each database currently owns on disk.*
>
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

*The main cost signal is `stoxx`: it owns 1.64 GB of allocated space, and its log allocation is larger than its data allocation. That does not mean the log is misconfigured by itself, but it does mean log growth, log backup cadence, and snapshot scope matter materially for this environment. The rest of the instance is small enough that almost all storage-cost discussion should focus on `stoxx`, not on the system databases.*

#### Current log allocation and usage for `stoxx`

> [!info]-
> This query reads `sys.dm_db_log_space_usage` inside the `stoxx` database context.
>
> - `total_log_size_mb` is the current allocated log size
> - `used_log_space_mb` is the log space currently in use
> - `log_since_last_backup_mb` shows how much log has accumulated since the last log backup
>
> This is one of the most important FinOps signals because oversized or unbounded logs drive disk growth, snapshot size, and sometimes unnecessary premium storage choices.
>
> *This query shows whether the transaction log is consuming cost-driving space because of growth, workload, or missing backup cadence.*
>
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
| stoxx | 967.99 | 587.66 | 60.71 | 571.10 |

*`stoxx` currently has nearly 1 GB of log allocation, with a little over 60% in use. Cost-wise, the important part is not just the current used percentage; it is the fact that log space since last backup is substantial. If this pattern reflects a missing or infrequent log-backup cadence, the log can keep growing and quietly turn into avoidable disk and snapshot cost.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `used_log_space_percent` | 50-80% | Watch | The log is materially occupied | Check whether growth is expected or operationally avoidable |
| `used_log_space_percent` | > 80-90% | &#10060; | The log is nearing exhaustion | Immediate operational issue and likely cost-growth issue |
| `log_since_last_backup_mb` | Large and rising | &#10060; under FULL | Log backup cadence may be insufficient | Disk growth and snapshot size may rise needlessly |

### Backup Compression

Backup compression is one of the cleanest cost levers in SQL Server because it reduces storage and transfer volume without requiring architectural change.

#### Current backup compression default and observed compression ratio

> [!info]-
> This query returns two result sets.
>
> - The first result set checks the instance default for backup compression.
> - The second reads recent full backups from `msdb.dbo.backupset` and computes the actual observed compression ratio.
>
> This combination matters because an instance can have `backup compression default = 0` and still produce compressed backups if the backup command explicitly asks for compression.
>
> *This query shows whether compressed backups are the default and what compression ratio was actually achieved on a recent full backup.*
>
```sql
SELECT
    value,
    value_in_use
FROM sys.configurations
WHERE name = 'backup compression default';

SELECT TOP (5)
    database_name,
    CAST(backup_size / 1048576.0 AS decimal(12,2)) AS backup_size_mb,
    CAST(compressed_backup_size / 1048576.0 AS decimal(12,2)) AS compressed_size_mb,
    CAST(CAST(backup_size AS float) / NULLIF(compressed_backup_size, 0) AS decimal(12,2)) AS compression_ratio
FROM msdb.dbo.backupset
WHERE type = 'D'
ORDER BY backup_finish_date DESC;
```

| value | value_in_use |
|---:|---:|
| 0 | 0 |

<!-- result-set-separator -->

| database_name | backup_size_mb | compressed_size_mb | compression_ratio |
|---|---:|---:|---:|
| admin_restore_demo | 2.90 | 0.47 | 6.22 |

*The instance default is currently off, so SQL Server will not compress backups unless each backup command explicitly asks for it. At the same time, the recent disposable full backup compressed very well, from 2.90 MB down to 0.47 MB, about 6.22:1. That is exactly the kind of signal that justifies enabling backup compression by default: the workload is getting real benefit from it.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `value_in_use` | `0` for `backup compression default` | Watch | Compression is opt-in per backup command | Easy for jobs and scripts to miss the cost-saving option |
| `value_in_use` | `1` for `backup compression default` | &#9989; in most estates | Compression is the default behavior | Lower routine backup storage footprint |
| `compression_ratio` | `> 2` | &#9989; | Compression is materially effective | Strong candidate for default compression |
| `compression_ratio` | `~1` | Watch | Compression is ineffective | Data may already be compressed or encrypted |

#### Enable backup compression by default

> [!warning]
> Compression saves storage and transfer cost, but it is not free. Backup compression consumes CPU. On most general-purpose estates that is a worthwhile trade, but validate it during the backup window.
>
> [!success]
> If the observed compression ratio is strong and backup CPU headroom exists, enable compression by default and let individual backup commands opt out only when necessary.
>
> *This command makes compressed backups the default behavior at the instance level.*
>
```sql
EXEC sp_configure 'backup compression default', 1;
RECONFIGURE;
```

### Volume Headroom

#### Current volume free space seen by SQL Server

> [!info]-
> This query uses `sys.dm_os_volume_stats` through `sys.master_files`.
>
> - `total_gb` and `free_gb` come from the host volume metadata visible to SQL Server
> - `volume_mount_point` and `file_system_type` are host metadata fields
>
> On containerized Linux deployments, some mount metadata can be null even when byte counts are still populated.
>
> *This query shows the storage volume capacity and free space visible to SQL Server.*
>
```sql
SELECT DISTINCT TOP (10)
    vs.volume_mount_point,
    vs.file_system_type,
    CAST(vs.total_bytes / 1024.0 / 1024 / 1024 AS decimal(12,2)) AS total_gb,
    CAST(vs.available_bytes / 1024.0 / 1024 / 1024 AS decimal(12,2)) AS free_gb,
    vs.logical_volume_name
FROM sys.master_files AS mf
CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.file_id) AS vs
ORDER BY vs.volume_mount_point;
```

| volume_mount_point | file_system_type | total_gb | free_gb | logical_volume_name |
|---|---|---:|---:|---|
| NULL | NULL | 1006.85 | 923.06 | NULL |

*SQL Server can see about 1 TB of total underlying storage with about 923 GB free, so the current environment is not storage-constrained. The null mount metadata is a platform detail of this Linux or containerized setup, not proof that `dm_os_volume_stats` is broken. The byte counts are the useful part here, and they show ample current headroom.*

---

## GCP Cost Levers

SQL Server storage behavior affects cost inside the VM. GCP then adds another layer of cost choices around snapshot strategy, retention, and compute commitment.

### Backups Versus Snapshots

SQL Server backups and GCP disk snapshots solve different problems. Treating them as substitutes is a common cost and resilience mistake.

#### What each layer is actually buying

| Mechanism | Strength | Weakness |
|---|---|---|
| SQL Server backup | Database-aware, restore-granular, chain-aware | Slower full-environment rebuild than disk rehydration |
| GCP disk snapshot | Fast disk-level recovery and infrastructure convenience | Disk-level only, not SQL-aware by itself |
| Both together | Better operational resilience | Higher storage and operational complexity unless retention is managed deliberately |

#### Create a snapshot schedule for the SQL Server data disk

> [!warning]
> A disk snapshot is not a replacement for a SQL Server backup strategy. It captures storage blocks, not a SQL-aware restore chain.
>
> [!success]
> Use snapshots as a complementary recovery layer: fast infrastructure recovery plus SQL-aware backups for restore granularity and point-in-time recovery.
>
> *This command creates a recurring snapshot schedule on GCP for the backing disk used by the SQL Server instance.*
>
```bash
gcloud compute resource-policies create snapshot-schedule analytics-sql-daily \
  --region=europe-west1 \
  --max-retention-days=14 \
  --start-time=03:00 \
  --daily-schedule
```

#### Use an application-consistent snapshot pattern on SQL Server 2022+

> [!warning]
> Do not freeze writes casually on a busy production system. The snapshot window must be short and operationally controlled.
>
> [!success]
> If SQL Server 2022 snapshot-backup semantics are part of the design, freeze writes only for the few seconds needed to take the storage snapshot, then complete the metadata-only backup step immediately.
>
> *This command pattern coordinates SQL Server 2022 snapshot-backup semantics with an infrastructure snapshot.*
>
```sql
ALTER DATABASE stoxx
SET SUSPEND_FOR_SNAPSHOT_BACKUP = ON;
```

```bash
gcloud compute disks snapshot analytics-sql-data \
  --zone=europe-west1-b \
  --snapshot-names=analytics-sql-$(date +%Y%m%d-%H%M%S)
```

```sql
BACKUP DATABASE stoxx
TO DISK = '/var/opt/mssql/backup/stoxx_snapshot.bkm'
WITH METADATA_ONLY;
```

### Retention And Lifecycle

The easiest way to waste money on backups is to keep every copy in the most expensive storage class forever.

#### Apply an object-lifecycle policy to the backup bucket

*This command applies a lifecycle policy to a GCS bucket so old backup objects move through cheaper storage classes or expire automatically according to policy.*

```bash
gcloud storage buckets update gs://analytics-sql-backups \
  --lifecycle-file=lifecycle.json
```

### Compute Commitment Choices

VM cost optimization is a contract decision as much as a sizing decision.

#### Choose the right compute purchase model

| Workload shape | Better default |
|---|---|
| Stable production VM with predictable long-term use | Committed use discount |
| Variable or uncertain production VM | On-demand until the utilization pattern is proven |
| Rebuildable non-production environment | Spot VM can be acceptable |
| Production SQL Server with availability expectations | Do not use Spot as the primary node |

#### Check machine-type recommendations from GCP Recommender

*This command asks GCP Recommender for machine-type right-sizing recommendations based on observed utilization history.*

```bash
gcloud recommender recommendations list \
  --project=data-platform-prod \
  --location=europe-west1-b \
  --recommender=google.compute.instance.MachineTypeRecommender
```

---

## Practical Recommendations

These are the highest-value cost actions suggested by the current evidence.

### What the current signals imply

1. Enable `backup compression default` unless backup CPU pressure proves that it should stay opt-in.
2. Review whether `stoxx` really needs a log file close to 1 GB at this stage, or whether the current footprint mostly reflects missing or immature log-backup operations.
3. Keep SQL-aware backups and disk snapshots as separate design layers, but manage retention so both layers do not accumulate indefinitely.
4. Do not right-size the VM from one short observation window alone. Use longer utilization history plus GCP Recommender before changing committed compute.

---

