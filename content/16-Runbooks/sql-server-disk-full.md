---
tags: [runbook, sql-server, gcp, sev1, disk, storage]
type: runbook
severity: sev1
technology: sql-server
status: stable
updated: 2026-03-23
---

# SQL Server Disk Full

> **Trigger**: SQL Server VM disk utilization > 95%
> **Severity**: Sev1 | **SLA**: 15 min acknowledge, resolve within 1 hr
> **Owner**: On-call data engineer
> **Paging**: Auto-page via Datadog alert `sql-vm.disk.used_pct.critical`

---

## Symptoms

- **Datadog alert**: `disk.used_pct > 95` on host `sql-vm`, tag `env:prod`
- **SQL Server error log** (`/var/opt/mssql/log/errorlog`) entries such as:
  ```
  Could not allocate space for object 'dbo.esg_scores' in database 'analytics_db' because the 'PRIMARY' filegroup is full.
  The transaction log for database 'analytics_db' is full due to 'LOG_BACKUP'.
  ```
- **Airflow DAG failures**: tasks writing to SQL Server raise `pyodbc.OperationalError: [HY000] Could not allocate space`
- **BigQuery transfer jobs** error: `Error: SQL Server source read failed — disk I/O error`
- Users report stale index constituent data; last successful load timestamp frozen in Datadog dashboard

> [!warning] Time is critical
> SQL Server will refuse all writes once a data file or log file cannot extend. Index calculation pipelines will silently skip records and produce incorrect constituent weights. Escalate immediately if resolution is not achieved within 30 minutes.

---

## Diagnosis

Work through steps 1–6 in order. Record findings in the incident Slack thread before each remediation action.

### Step 1 — SSH to the VM via IAP

```bash
gcloud compute ssh sql-vm --tunnel-through-iap --zone=europe-west1-b
```

If IAP is blocked, try the OS Login fallback:

```bash
gcloud compute ssh sql-vm --zone=europe-west1-b --ssh-flag="-o StrictHostKeyChecking=no"
```

### Step 2 — Identify the full mount point

```bash
df -h
```

Expected output structure:

```
Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1        50G   47G  1.2G  98% /
/dev/sdb        500G  490G  3.1G  99% /datadrive
/dev/sdc        200G   45G  145G  23% /logdrive
```

Note which mount is at >95%. Common culprits:

| Mount | Contains |
|-------|----------|
| `/datadrive` | MDF / NDF data files (`/datadrive/mssql/data/`) |
| `/logdrive` | LDF transaction log files (`/logdrive/mssql/log/`) |
| `/` | OS + MSSQL binary logs, tempdb if misconfigured |

### Step 3 — Check database and file sizes inside SQL Server

```bash
sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -Q "
SELECT
    DB_NAME(mf.database_id)         AS database_name,
    mf.name                         AS logical_name,
    mf.type_desc,
    mf.physical_name,
    mf.size * 8 / 1024              AS size_mb,
    mf.max_size * 8 / 1024          AS max_size_mb,
    (mf.size - FILEPROPERTY(mf.name, 'SpaceUsed')) * 8 / 1024 AS free_mb
FROM sys.master_files mf
ORDER BY size DESC;
"
```

> [!tip] Reading the output
> Look for files where `free_mb` is near zero — those are the immediate constraint. The `max_size_mb` column shows whether autogrowth is capped at an artificial limit (common misconfiguration).

### Step 4 — Check transaction log fill state

```bash
sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -Q "DBCC SQLPERF(LOGSPACE);"
```

Output columns: `Database Name`, `Log Size (MB)`, `Log Space Used (%)`, `Status`.
Any database above 90% `Log Space Used` is a candidate for log backup.

Also check why the log cannot be reused:

```bash
sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -Q "
SELECT
    name,
    log_reuse_wait_desc,
    recovery_model_desc
FROM sys.databases
WHERE log_reuse_wait_desc <> 'NOTHING';
"
```

| `log_reuse_wait_desc` | Meaning |
|-----------------------|---------|
| `LOG_BACKUP` | Log backup needed (FULL recovery model) |
| `ACTIVE_TRANSACTION` | Long-running or open transaction blocking truncation |
| `DATABASE_MIRRORING` | Mirror not keeping up |
| `REPLICATION` | Unread replication log records |

### Step 5 — Check for long-running or blocking transactions

```bash
sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -Q "DBCC OPENTRAN('analytics_db');"
```

Then get session detail for blocking:

```bash
sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -Q "
SELECT
    r.session_id,
    r.status,
    r.blocking_session_id,
    r.wait_type,
    r.wait_time / 1000          AS wait_sec,
    r.total_elapsed_time / 1000 AS elapsed_sec,
    DB_NAME(r.database_id)      AS db_name,
    SUBSTRING(t.text, 1, 200)   AS query_snippet
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
WHERE r.session_id > 50
ORDER BY r.total_elapsed_time DESC;
"
```

### Step 6 — Check TempDB space usage

```bash
sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -Q "
SELECT
    SUM(unallocated_extent_page_count) * 8 / 1024      AS free_mb,
    SUM(version_store_reserved_page_count) * 8 / 1024  AS version_store_mb,
    SUM(internal_object_reserved_page_count) * 8 / 1024 AS internal_obj_mb,
    SUM(user_object_reserved_page_count) * 8 / 1024    AS user_obj_mb
FROM sys.dm_db_file_space_usage;
"
```

High `version_store_mb` points to a long-running transaction keeping row versions alive. High `internal_obj_mb` points to large sort/hash spills from expensive queries (often from unoptimized ESG factor joins).

---

## Resolution

Match the root cause identified in Diagnosis before executing any resolution step. Do not run multiple resolution paths simultaneously.

### RC-1: Transaction Log Full (`log_reuse_wait_desc = LOG_BACKUP`)

Take an immediate log backup to free VLF space. The backup destination can be `/tmp` for an emergency dump; move it to GCS afterward.

```bash
sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -Q "
BACKUP LOG analytics_db
TO DISK = '/tmp/analytics_db_log_emergency_$(date +%Y%m%d_%H%M%S).trn'
WITH COMPRESSION, STATS = 10;
"
```

Confirm the log truncated:

```bash
sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -Q "DBCC SQLPERF(LOGSPACE);"
```

`Log Space Used (%)` should drop significantly. If it stays high, there is still an active transaction (go to RC-3).

Upload the backup to GCS and delete the local copy:

```bash
BACKUP_FILE=$(ls -t /tmp/analytics_db_log_emergency_*.trn | head -1)
gcloud storage cp "${BACKUP_FILE}" gs://your-backup-bucket/sql-server/log-emergency/
rm -f "${BACKUP_FILE}"
```

### RC-2: Data Disk Full — Identify and reclaim space

**Find the largest tables consuming space:**

```bash
sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -Q "
SELECT TOP 20
    SCHEMA_NAME(t.schema_id)   AS schema_name,
    t.name                     AS table_name,
    SUM(a.total_pages) * 8 / 1024 AS total_mb,
    SUM(a.used_pages) * 8 / 1024  AS used_mb,
    SUM(a.data_pages) * 8 / 1024  AS data_mb
FROM sys.tables t
INNER JOIN sys.indexes i ON t.object_id = i.object_id
INNER JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
INNER JOIN sys.allocation_units a ON p.partition_id = a.container_id
GROUP BY t.schema_id, t.name
ORDER BY total_mb DESC;
"
```

**Enable PAGE compression on the largest heap/clustered tables** (online operation, no downtime):

```bash
sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -Q "
ALTER TABLE dbo.esg_scores REBUILD WITH (DATA_COMPRESSION = PAGE, ONLINE = ON);
ALTER TABLE dbo.index_constituents_history REBUILD WITH (DATA_COMPRESSION = PAGE, ONLINE = ON);
"
```

PAGE compression typically yields 40–65% reduction on financial time-series data with repetitive decimal values.

**Archive old partitions to GCS** (for partitioned history tables):

```bash
# Export the oldest partition to Parquet via BCP, then delete from SQL Server
sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -Q "
SELECT MIN(price_date), MAX(price_date), COUNT(*) FROM dbo.esg_scores WHERE price_date < '2023-01-01';
"

bcp "SELECT * FROM analytics_db.dbo.esg_scores WHERE price_date < '2023-01-01'" \
    queryout /tmp/esg_scores_archive_pre2023.csv \
    -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" \
    -c -t',' -r'\n'

gcloud storage cp /tmp/esg_scores_archive_pre2023.csv \
    gs://your-archive-bucket/sql-server/esg_scores/pre2023/

sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -Q "
DELETE FROM dbo.esg_scores WHERE price_date < '2023-01-01';
"
```

### RC-3: Long-Running Transaction Blocking Log Truncation

Identify the blocking session from Step 5, then kill it:

```bash
# Replace 87 with the actual session_id from the diagnosis query
sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -Q "KILL 87;"
```

> [!warning] Killing sessions
> KILL rolls back the session's transaction, which can take time proportional to how long it ran. Monitor the rollback progress with:
> ```sql
> SELECT percent_complete, estimated_completion_time, command
> FROM sys.dm_exec_requests WHERE session_id = 87;
> ```
> Do not restart SQL Server while a rollback is in progress.

After the kill completes, take a log backup (RC-1) to reclaim the freed space.

### RC-4: TempDB Bloated

If TempDB is consuming `/` or a shared drive:

```bash
# Check which session is driving TempDB usage
sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -Q "
SELECT TOP 10
    s.session_id,
    s.login_name,
    SUM(tsu.internal_objects_alloc_page_count + tsu.user_objects_alloc_page_count) * 8 / 1024 AS tempdb_mb
FROM sys.dm_db_task_space_usage tsu
JOIN sys.dm_exec_sessions s ON tsu.session_id = s.session_id
GROUP BY s.session_id, s.login_name
ORDER BY tempdb_mb DESC;
"
```

Kill the top consuming session if appropriate. If TempDB itself is corrupted or maxed out and no session can be killed, restart SQL Server (this automatically recreates TempDB):

```bash
sudo systemctl restart mssql-server
```

> [!danger] Service restart
> Restarting mssql-server will disconnect all active connections and roll back open transactions. Confirm with the on-call lead before executing in production.

### RC-5: Emergency GCE Disk Resize (Online, No VM Downtime)

Use this when the disk physically needs to grow and no data can be deleted fast enough.

```bash
# Step 1: Snapshot the disk before any resize (safety net)
SNAPSHOT_NAME="data-disk-emergency-$(date +%Y%m%d-%H%M%S)"
gcloud compute disks snapshot data-disk \
    --zone=europe-west1-b \
    --snapshot-names="${SNAPSHOT_NAME}" \
    --description="Emergency snapshot before disk resize — disk-full incident"

# Verify snapshot is READY before proceeding
gcloud compute snapshots describe "${SNAPSHOT_NAME}" --format="value(status)"
# Must return: READY

# Step 2: Resize the persistent disk (GCE allows online resize — no VM stop needed)
gcloud compute disks resize data-disk \
    --size=500GB \
    --zone=europe-west1-b

# Step 3: Extend the filesystem to use the new space (run on the VM)
# For ext4 (standard for GCE data disks):
sudo resize2fs /dev/sdb

# For XFS (if used):
# sudo xfs_growfs /datadrive

# Verify new space is available
df -h /datadrive
```

> [!warning] GCE disk resize is irreversible
> You can only increase disk size, never decrease. Start with the minimum needed (e.g., +100 GB) rather than jumping to maximum. A snapshot does not protect against a bad resize, but it allows restore to a new disk if the VM becomes unbootable.

### RC-6: Old SQL Server Backup Files Consuming Disk

```bash
# List backup files older than 3 days on the local disk
find /datadrive/backups -name "*.bak" -mtime +3 -ls
find /logdrive/backups -name "*.trn" -mtime +1 -ls

# Upload to GCS before deleting
gsutil -m cp /datadrive/backups/*.bak gs://your-backup-bucket/sql-server/full/
gsutil -m cp /logdrive/backups/*.trn gs://your-backup-bucket/sql-server/log/

# Delete after confirming GCS copy
find /datadrive/backups -name "*.bak" -mtime +3 -delete
find /logdrive/backups -name "*.trn" -mtime +1 -delete
```

---

## Verification

After any resolution step, confirm the incident is resolved:

```bash
# 1. Confirm disk is below 80%
df -h

# 2. Confirm SQL Server is healthy
sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -Q "SELECT @@VERSION; SELECT name, state_desc FROM sys.databases;"

# 3. Confirm log space is reclaimed
sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -Q "DBCC SQLPERF(LOGSPACE);"

# 4. Trigger the most recently failed Airflow DAG manually (from Airflow host)
airflow dags trigger index_constituent_load --conf '{"backfill": false}'

# 5. Watch Datadog dashboard: disk.used_pct should be declining and alert should auto-resolve
```

---

## Escalation

| Condition | Action |
|-----------|--------|
| Disk >99%, cannot free space in 15 min | Escalate to infra lead; initiate disk resize (RC-5) immediately |
| SQL Server will not start after restart | Page DBA on-call; restore from most recent GCS snapshot |
| Data files corrupted (DBCC CHECKDB reports errors) | Declare data integrity incident; do not allow pipeline writes until cleared |
| Billing spike from emergency GCS uploads | Notify finops; tag uploads with `incident=true` label |

---

## Post-Incident

- [ ] Send resolution notice to #data-engineering-incidents with timeline
- [ ] Confirm all Airflow DAGs that failed during the incident have been retriggered and succeeded
- [ ] Validate index constituent weights for any calculation window that overlapped with the outage
- [ ] Schedule PIR within 48 hours
- [ ] Review and update Datadog alert thresholds (consider adding 85% warning alert)
- [ ] Add permanent fix to backlog: PAGE compression on uncompressed gold tables, partition lifecycle policy, automated log backup schedule via SQL Agent

---

## Long-Term Prevention

| Action | Owner | Priority |
|--------|-------|----------|
| Enable PAGE compression on all gold-layer tables | Data Eng | High |
| Implement SQL Agent job: log backup every 2 hrs | DBA | High |
| Set `max_size` on all data files to disk capacity (remove artificial caps) | DBA | High |
| Terraform: set persistent disk size alerts at 75% and 85% | Infra | Medium |
| Implement partition archival Cloud Run job (monthly) | Data Eng | Medium |
| Move TempDB to a dedicated SSD persistent disk | DBA | Low |

---

## Related

- [[on-call-guide]]
- [[runbooks-index]]
- [[gce-disk-management]]
- [[sql-server-backup-schedule]]
- [[airflow-scheduler-down]]
