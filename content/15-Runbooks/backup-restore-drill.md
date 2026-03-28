---
tags: []
type: runbook
severity: sev3
technology: sql-server, gcp
status: stable
updated: 2026-03-23
cadence: quarterly
---

# Backup Restore Drill

> **Trigger**: Scheduled quarterly validation — or immediately after a production restore event
> **Severity**: Sev3 (scheduled) | Sev1 (if executed during an actual disaster)
> **SLA**: Complete within one business day of scheduled drill date
> **Owner**: On-call data engineer + DBA

---

## Purpose

Validate that:
1. SQL Server backups stored in GCS are intact and restorable — the drill exercises every level of the [[backup-types-and-strategy]] (FULL, DIFF, LOG)
2. The [[restore-and-recovery]] procedure is understood and documented
3. Recovery Time Objective (RTO < 1 hour) can be met
4. Business-critical queries return correct results on a restored database

This drill must be run quarterly. Results must be recorded in the drill log and reviewed by the data engineering lead. Failure to meet success criteria must be escalated and remediated before the next publication cycle.

> [!important] This is not optional
> EU BMR and internal BCDR policy require demonstrable evidence that backup recovery has been tested. The drill log is an auditable record.

---

## Pre-Drill Checklist

- [ ] Test VM provisioned in the same GCP region as production (or confirmed that the existing dev VM is available and has SQL Server 2022 on Linux installed)
- [ ] Sufficient disk space on test VM: at least 2x the backup file size (`df -h /var/opt/mssql/data`)
- [ ] GCS access confirmed: `gcloud auth list` shows an account with `storage.objects.get` on the backup bucket
- [ ] `sqlcmd` or `mssql-tools` installed on the test VM
- [ ] Team notified of the drill window (send a Slack/email notice at least 24 hours ahead)
- [ ] Production is not in a change freeze or mid-publication window
- [ ] Drill log document open and ready to record timestamps

---

## Procedure

Record the wall-clock time at the start of each numbered step. RTO is measured from Step 1 to the end of Step 6.

### Step 1 — Identify the latest available backup

Backup files are stored in GCS with lifecycle policies managed through [[gcs-buckets-and-lifecycle|bucket lifecycle configuration]]. Confirm the target bucket has not aged out recent backups before proceeding.

```bash
# List the most recent backup files in the GCS backup bucket
gcloud storage ls "gs://backup-bucket/sql-server/" --recursive \
  | sort \
  | tail -10

# Identify FULL, DIFF, and LOG backups separately
gcloud storage ls "gs://backup-bucket/sql-server/" --recursive \
  | grep "_FULL_"
gcloud storage ls "gs://backup-bucket/sql-server/" --recursive \
  | grep "_DIFF_"
gcloud storage ls "gs://backup-bucket/sql-server/" --recursive \
  | grep "_LOG_"

# Get the metadata (size, creation time) for the latest FULL backup
gcloud storage stat \
  "gs://backup-bucket/sql-server/analytics_db_FULL_$(date +%Y%m%d).bak"
```

Record:
- Backup file name: ___________________
- Backup file size: ___________________
- Backup created at (UTC): ___________________
- Expected RPO coverage (latest log backup time): ___________________

### Step 2 — Confirm disk space on the test VM

```bash
# Check available disk space — need at least 2x backup file size
df -h /var/opt/mssql/data
df -h /tmp

# Check total RAM and CPU on the test VM
free -h
nproc
```

If `/tmp` does not have enough space, download to `/mnt/data/` or attach an additional disk.

### Step 3 — Download the backup file from GCS to the test VM

```bash
# Download the FULL backup — replace filename with the one identified in Step 1
# Record the start time before running this command
date -u
gcloud storage cp \
  "gs://backup-bucket/sql-server/analytics_db_FULL_$(date +%Y%m%d).bak" \
  /tmp/analytics_db_FULL_$(date +%Y%m%d).bak

# Verify the download completed and the file is not truncated
ls -lh /tmp/analytics_db_FULL_$(date +%Y%m%d).bak

# Verify checksum against the value stored at backup time (if your backup job records it)
sha256sum /tmp/analytics_db_FULL_$(date +%Y%m%d).bak

# If downloading a differential backup as well:
gcloud storage cp \
  "gs://backup-bucket/sql-server/analytics_db_DIFF_$(date +%Y%m%d).bak" \
  /tmp/analytics_db_DIFF_$(date +%Y%m%d).bak
```

### Step 4 — Restore to the test SQL Server instance

Connect to SQL Server on the test VM:

```bash
sqlcmd -S localhost -U sa -P '<SA_PASSWORD>' -Q "SELECT @@VERSION"
```

Inspect the backup file headers before restoring:

```bash
sqlcmd -S localhost -U sa -P '<SA_PASSWORD>' -Q "
RESTORE HEADERONLY
FROM DISK = '/tmp/analytics_db_FULL_$(date +%Y%m%d).bak';
"

sqlcmd -S localhost -U sa -P '<SA_PASSWORD>' -Q "
RESTORE FILELISTONLY
FROM DISK = '/tmp/analytics_db_FULL_$(date +%Y%m%d).bak';
"
```

Note the logical file names from `RESTORE FILELISTONLY` output — you need them for the `MOVE` clauses below.

Restore the FULL backup:

```bash
# Record the start time of the restore
date -u

sqlcmd -S localhost -U sa -P '<SA_PASSWORD>' -Q "
RESTORE DATABASE analytics_db_drill
FROM DISK = '/tmp/analytics_db_FULL_$(date +%Y%m%d).bak'
WITH
    MOVE 'analytics_db'     TO '/var/opt/mssql/data/drill_data.mdf',
    MOVE 'analytics_db_log' TO '/var/opt/mssql/data/drill_log.ldf',
    NORECOVERY,
    REPLACE,
    STATS = 10;
"
```

If a differential backup is being applied:

```bash
sqlcmd -S localhost -U sa -P '<SA_PASSWORD>' -Q "
RESTORE DATABASE analytics_db_drill
FROM DISK = '/tmp/analytics_db_DIFF_$(date +%Y%m%d).bak'
WITH
    NORECOVERY,
    STATS = 10;
"
```

If transaction log backups are being applied (apply each LOG file in chronological order):

```bash
for LOG_FILE in /tmp/analytics_db_LOG_*.bak; do
  echo "Applying log backup: $LOG_FILE"
  sqlcmd -S localhost -U sa -P '<SA_PASSWORD>' -Q "
  RESTORE LOG analytics_db_drill
  FROM DISK = '$LOG_FILE'
  WITH NORECOVERY, STATS = 10;
  "
done
```

Bring the database online:

```bash
sqlcmd -S localhost -U sa -P '<SA_PASSWORD>' -Q "
RESTORE DATABASE analytics_db_drill WITH RECOVERY;
"

# Record the time the database came online
date -u
```

### Step 5 — Run integrity check

```bash
# DBCC CHECKDB validates page checksums, allocation structures, and table/index consistency
# This can take 10–30 minutes on a large database
date -u
sqlcmd -S localhost -U sa -P '<SA_PASSWORD>' -Q "
DBCC CHECKDB('analytics_db_drill') WITH NO_INFOMSGS, ALL_ERRORMSGS;
" -t 3600

date -u
```

Expected output: no rows returned (no errors). Any output from `DBCC CHECKDB` with `NO_INFOMSGS` indicates corruption — see escalation section.

### Step 6 — Row count comparison against production

Run these queries on both the drill database (test VM) and production. Record both sets of numbers.

```bash
# On the test VM (drill database)
sqlcmd -S localhost -U sa -P '<SA_PASSWORD>' -d analytics_db_drill -Q "
SELECT
    t.name          AS table_name,
    p.rows          AS row_count
FROM sys.tables t
JOIN sys.partitions p
    ON t.object_id = p.object_id
   AND p.index_id IN (0, 1)  -- heap or clustered index
ORDER BY t.name;
"
```

```sql
-- On production SQL Server: run the same query
SELECT
    t.name          AS table_name,
    p.rows          AS row_count
FROM sys.tables t
JOIN sys.partitions p
    ON t.object_id = p.object_id
   AND p.index_id IN (0, 1)
ORDER BY t.name;
```

Accept: drill row count is within 0.1% of production row count for all key tables. A larger discrepancy indicates either the backup is stale, the restore is incomplete, or there was data loss.

Key tables to check:

| Table | Expected row count source |
|---|---|
| `dbo.index_levels_gold` | Production query above |
| `dbo.index_constituents_gold` | Production query above |
| `dbo.prices_gold` | Production query above |
| `dbo.corporate_actions` | Production query above |
| `dbo.pipeline_lineage` | Production query above |
| `dbo.restatement_log` | Production query above |

### Step 7 — Business-critical spot-check queries

Pick a known index and date from the last 30 days and verify the restored value matches production exactly.

```bash
sqlcmd -S localhost -U sa -P '<SA_PASSWORD>' -d analytics_db_drill -Q "
-- Spot-check: index level for a known date
SELECT
    index_code,
    price_date,
    index_level,
    divisor
FROM dbo.index_levels_gold
WHERE index_code = '<INDEX_CODE>'
  AND price_date = '<YYYY-MM-DD>';
"
```

Compare the returned `index_level` against:
- The production SQL Server value
- The BigQuery published value

All three must agree to 6 decimal places.

```bash
# Also verify a constituent weight sum for the same date
sqlcmd -S localhost -U sa -P '<SA_PASSWORD>' -d analytics_db_drill -Q "
SELECT
    price_date,
    SUM(weight)  AS total_weight,
    COUNT(*)     AS constituent_count
FROM dbo.index_constituents_gold
WHERE index_code = '<INDEX_CODE>'
  AND price_date = '<YYYY-MM-DD>'
GROUP BY price_date;
"
```

Expected: `total_weight = 1.000000`, `constituent_count` matches production.

### Step 8 — Record RTO

```
Drill start time (Step 1 initiated):  ____:____ UTC
Database online (Step 4 RECOVERY):    ____:____ UTC
DBCC CHECKDB completed (Step 5):      ____:____ UTC
Spot-check verified (Step 7):         ____:____ UTC

Total RTO (Step 1 → Step 7 complete): _______ minutes
```

RTO target: < 60 minutes for a full database restore including integrity check and spot-check.

### Step 9 — Clean up

```bash
# Drop the drill database — do not leave it running, it consumes disk and may confuse monitoring
sqlcmd -S localhost -U sa -P '<SA_PASSWORD>' -Q "
DROP DATABASE analytics_db_drill;
"

# Confirm it is gone
sqlcmd -S localhost -U sa -P '<SA_PASSWORD>' -Q "
SELECT name FROM sys.databases WHERE name = 'analytics_db_drill';
"
# Expected: 0 rows returned

# Remove the backup files from the test VM
rm -f /tmp/analytics_db_FULL_*.bak
rm -f /tmp/analytics_db_DIFF_*.bak
rm -f /tmp/analytics_db_LOG_*.bak

# Confirm disk space is restored
df -h /tmp
df -h /var/opt/mssql/data
```

### Step 10 — Document results in the drill log

```sql
-- Insert drill results into the backup_restore_drill_log table on production
INSERT INTO dbo.backup_restore_drill_log (
    drill_id,
    drill_date,
    conducted_by,
    backup_file_name,
    backup_created_at,
    restore_start_time,
    database_online_time,
    dbcc_passed,
    row_count_check_passed,
    spot_check_passed,
    rto_minutes,
    rto_target_met,
    notes,
    ticket_id
)
VALUES (
    NEWID(),
    CAST(GETUTCDATE() AS DATE),
    '<engineer_id>',
    'analytics_db_FULL_<YYYYMMDD>.bak',
    '<backup_created_at_utc>',
    '<restore_start_utc>',
    '<database_online_utc>',
    <1 or 0>,              -- DBCC CHECKDB passed?
    <1 or 0>,              -- Row count within 0.1%?
    <1 or 0>,              -- Spot-check values matched?
    <rto_minutes>,
    CASE WHEN <rto_minutes> < 60 THEN 1 ELSE 0 END,
    '<Any observations, deviations, or issues noted during the drill>',
    '<TICKET_ID>'
);
```

---

## Success Criteria

| Check | Expected | Pass/Fail |
|---|---|---|
| `RESTORE DATABASE` completed without errors | Yes | |
| `DBCC CHECKDB` returned no rows (no errors) | 0 rows | |
| Row counts within 0.1% of production for all key tables | Yes | |
| Spot-check index level matches production and BigQuery | Exact match (6 dp) | |
| Weight sum = 1.0 for spot-check date | 1.000000 | |
| RTO from Step 1 to end of Step 7 | < 60 minutes | |
| Drill database dropped and disk cleaned up | Yes | |
| Results recorded in `dbo.backup_restore_drill_log` | Yes | |

---

## Escalation

| Condition | Escalate to | Action |
|---|---|---|
| `DBCC CHECKDB` returns errors | DBA + Head of Data Engineering | Immediately investigate backup integrity; run against a previous backup |
| RTO exceeds 60 minutes | Data engineering lead | Review restore procedure; consider pre-staged warm standby |
| Backup file not found in GCS for today | DBA | Investigate backup job failure; check Airflow backup DAG logs |
| GCS checksum mismatch | DBA + Security | Treat as potential data integrity incident; do not use this backup |
| Row count divergence > 0.1% | DBA | Identify which tables differ; may indicate backup taken mid-write |

> [!danger] If backup is corrupt or absent
> Do not wait for the next scheduled drill. Immediately investigate the backup pipeline, restore from the last known good backup, and file an incident. A missing or unrestorable backup is a Sev1 BCDR event.

---

## Post-Drill Checklist

- [ ] All 8 success criteria marked Pass
- [ ] `dbo.backup_restore_drill_log` row inserted with all fields populated
- [ ] RTO recorded and compared against previous quarter's result
- [ ] If RTO > 60 min: remediation ticket raised with target completion date
- [ ] If DBCC or row count failed: incident ticket raised and backup pipeline investigated
- [ ] Drill results shared with data engineering lead and compliance team
- [ ] Next drill date confirmed in the team calendar (3 months from today)

---

## Related

- [[on-call-guide]]
- [[compliance-and-auditability]]
- [[data-restatement-procedure]]
- [[runbooks-index]]
