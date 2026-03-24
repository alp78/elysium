---
tags: [sql]
type: reference
technology: sql-server
status: stable
updated: 2026-03-23
description: "Comprehensive catalog of SQL Server production problems for data engineers — 25 issues ranked by severity with root cause analysis, impact assessment, prevention protocols, and fix procedures. Covers performance, concurrency, data loading, backup, and operational issues on SQL Server 2022 Linux/GCP."
---

# SQL Server Production Problems

SQL Server is the transactional backbone of the index calculation platform — bronze ingestion, silver cleaning, gold aggregation, and the API serving layer all depend on it. On a self-managed Linux/GCP instance without a dedicated DBA, the data engineering team owns every aspect: performance tuning, backup strategy, concurrency management, and capacity planning. Every problem below has caused a production incident or near-miss. This note provides the diagnosis commands, root causes, and fix procedures that a senior data engineer needs at 2 AM when the pipeline is down.

**Environment:** SQL Server 2022 on Ubuntu 22.04, GCP Compute Engine (n2-standard-8, 500 GB pd-ssd). Medallion architecture: `bronze` (raw ingestion), `silver` (cleaned/normalized), `gold` (aggregated/published). Python pipelines via `pyodbc`, C# APIs via `Dapper`, Airflow orchestration. EU BMR regulated — publication SLAs are legally binding.

---

## Critical — Data Loss / Pipeline Outage

---

### 1. Transaction Log Full

**What happens**

The `analytics_db` transaction log fills the attached pd-ssd volume. SQL Server transitions the database to a state where all write operations fail with `Error 9002: The transaction log for database 'analytics_db' is full due to 'LOG_BACKUP'`. Every bronze INSERT, silver UPDATE, and gold MERGE in the pipeline aborts mid-execution. The Airflow DAG enters a cascade of failures, and the index calculation job cannot write results, breaching the EU BMR publication SLA.

**Root cause**

In `FULL` recovery model, SQL Server cannot reuse log Virtual Log Files (VLFs) until a `BACKUP LOG` operation truncates the inactive portion. If no log backup job is scheduled — or if a long-running transaction holds an open `BEGIN TRAN`, preventing log truncation even when backups run — the log grows until it hits either the configured max size or physical disk capacity. The `log_reuse_wait_desc` column in `sys.databases` reveals exactly why truncation is blocked: `LOG_BACKUP`, `ACTIVE_TRANSACTION`, `REPLICATION`, etc.

**Consequences**

- All pipeline writes fail; bronze ingestion halts, leaving silver/gold layers stale
- Index constituent weights, NAV calculations, and ESG scores cannot be persisted
- API layer returns stale data or errors; C# Dapper calls throw `SqlException`
- EU BMR regulated publication deadlines missed — regulatory incident
- Manual recovery required; risk of data loss if log wraps before backup

**Prevention protocol**

1. Verify the database recovery model and current log reuse state:
```sql
SELECT name,
       recovery_model_desc,
       log_reuse_wait_desc,
       log_size_mb = (SELECT SUM(size * 8.0 / 1024) FROM sys.master_files WHERE database_id = d.database_id AND type = 1)
FROM sys.databases d
WHERE name = 'analytics_db';
```

2. Schedule log backups every 15 minutes via SQL Server Agent (Linux sqlcmd):
```sql
USE msdb;
GO
EXEC sp_add_job @job_name = N'analytics_db - Log Backup 15min';
EXEC sp_add_jobstep
    @job_name = N'analytics_db - Log Backup 15min',
    @step_name = N'Backup Log',
    @command = N'BACKUP LOG analytics_db
    TO DISK = N''/var/opt/mssql/backups/analytics_db_log_'' + CONVERT(VARCHAR, GETDATE(), 112) + ''_'' + REPLACE(CONVERT(VARCHAR(8), GETDATE(), 108),'':'','''') + ''.bak''
    WITH COMPRESSION, STATS = 10;';
EXEC sp_add_schedule
    @schedule_name = N'Every 15 Minutes',
    @freq_type = 4,
    @freq_interval = 1,
    @freq_subday_type = 4,
    @freq_subday_interval = 15;
EXEC sp_attach_schedule @job_name = N'analytics_db - Log Backup 15min', @schedule_name = N'Every 15 Minutes';
EXEC sp_add_jobserver @job_name = N'analytics_db - Log Backup 15min';
```

3. Set a proactive alert at 75% log usage:
```sql
-- Monitor log space usage
SELECT instance_name AS database_name,
       cntr_value AS log_used_pct
FROM sys.dm_os_performance_counters
WHERE counter_name = 'Percent Log Used'
  AND instance_name = 'analytics_db';

-- Also via DBCC (legacy but reliable)
DBCC SQLPERF(LOGSPACE);
```

4. Configure max log file size and set autogrow in fixed chunks (never percent-based):
```sql
ALTER DATABASE analytics_db
MODIFY FILE (
    NAME = analytics_db_log,
    MAXSIZE = 50GB,
    FILEGROWTH = 1GB
);
```

5. Add a Datadog custom metric via Python to track log usage:
```python
import pyodbc

def check_log_space(conn_str: str) -> dict:
    with pyodbc.connect(conn_str) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT instance_name, cntr_value
            FROM sys.dm_os_performance_counters
            WHERE counter_name = 'Percent Log Used'
              AND instance_name = 'analytics_db'
        """)
        row = cursor.fetchone()
        return {"database": row[0], "log_used_pct": row[1]}
```

**Fix procedure**

1. Identify what is blocking log truncation:
```sql
-- What is holding the log?
SELECT name, log_reuse_wait_desc FROM sys.databases WHERE name = 'analytics_db';

-- Find open transactions
DBCC OPENTRAN('analytics_db');

-- Find long-running sessions
SELECT session_id, login_time, last_request_start_time, status,
       transaction_isolation_level, text
FROM sys.dm_exec_sessions s
CROSS APPLY sys.dm_exec_sql_text(s.most_recent_sql_handle)
WHERE open_transaction_count > 0;
```

2. If blocked by `ACTIVE_TRANSACTION`, kill the orphaned session (get spid from above):
```sql
KILL 57;  -- replace with actual spid
```

3. Immediately take an emergency log backup to free VLF space:
```bash
sqlcmd -S localhost -U sa -P "$SA_PASSWORD" -Q "
BACKUP LOG analytics_db
TO DISK = '/var/opt/mssql/backups/analytics_db_log_emergency.bak'
WITH COMPRESSION, INIT;"
```

4. After backup, shrink the log file if disk is still critically low (do not do this routinely):
```sql
USE analytics_db;
DBCC SHRINKFILE (analytics_db_log, 1024);  -- shrink to 1 GB
```

> [!danger] DBCC SHRINKFILE on the log
> Shrinking the log file fragments it into many small VLFs, which degrades future log write performance. Use only in emergencies, then grow it back to the correct size immediately. Never automate log shrink.

5. Verify recovery and restart the Airflow pipeline tasks.

---

### 2. Deadlocks During ETL

**What happens**

The bronze-to-silver transform task runs concurrent sessions: one updates `silver.index_constituents` (locks row A, then tries to lock row B), while a gold-layer aggregation query reads `gold.index_weights` then back-joins to `silver.index_constituents` (holds lock on B, tries lock on A). SQL Server detects the cycle, picks the session with the lower `DEADLOCK_PRIORITY` or the cheapest rollback cost as the victim, and terminates it with `Error 1205`. The Airflow task fails; the gold table is partially stale.

**Root cause**

Deadlocks arise from resource acquisition in inconsistent order across concurrent sessions. SQL Server's lock manager detects cycles in the waits-for graph every 5 seconds. The deadlock monitor picks a victim to break the cycle. In ETL pipelines, the pattern is almost always: session 1 locks rows in table order A→B while session 2 locks B→A. Under `READ_COMMITTED` (default isolation), shared locks are held for the duration of the statement — under `SERIALIZABLE`, for the transaction. Row-level locks escalate to page or table locks under pressure.

**Consequences**

- Partial ETL loads: silver constituent weights updated for 40 of 80 index members, gold is inconsistent
- Index NAV calculated on partially updated data — a silent data quality failure if not caught by checksums
- Airflow task retry logic can mask the error; the next run may succeed on stale input
- Under high concurrency (end-of-day batch + dashboard refresh), deadlock frequency increases

**Prevention protocol**

1. Enable Read Committed Snapshot Isolation (RCSI) to eliminate reader-writer deadlocks:
```sql
-- Must be run when no other connections are active
ALTER DATABASE analytics_db SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
ALTER DATABASE analytics_db SET READ_COMMITTED_SNAPSHOT ON;
ALTER DATABASE analytics_db SET MULTI_USER;

-- Verify
SELECT name, is_read_committed_snapshot_on FROM sys.databases WHERE name = 'analytics_db';
```

> [!warning] RCSI and TempDB
> RCSI stores row versions in TempDB. Monitor TempDB growth after enabling. On high-throughput pipelines, version store can grow significantly. See [[memory-and-buffer-pool]] for TempDB sizing.

2. Capture deadlock graphs from the `system_health` Extended Events session (always-on):
```sql
-- Read deadlock events from ring buffer
SELECT CAST(target_data AS XML).query('
  /RingBufferTarget/event[@name="xml_deadlock_report"]') AS deadlock_graph
FROM sys.dm_xe_session_targets t
JOIN sys.dm_xe_sessions s ON t.event_session_address = s.address
WHERE s.name = 'system_health'
  AND t.target_name = 'ring_buffer';
```

3. Enable trace flag 1222 for verbose deadlock logging to the error log:
```bash
sqlcmd -S localhost -U sa -P "$SA_PASSWORD" -Q "DBCC TRACEON(1222, -1);"
# Verify
sqlcmd -S localhost -U sa -P "$SA_PASSWORD" -Q "DBCC TRACESTATUS();"
```

4. Add deadlock retry logic in the Python pipeline:
```python
import pyodbc
import time
import logging

def execute_with_deadlock_retry(conn_str: str, sql: str, params: tuple = (),
                                 max_retries: int = 3, base_delay: float = 0.5):
    """Retry on SQL Server deadlock (error 1205) with exponential backoff."""
    for attempt in range(max_retries):
        try:
            with pyodbc.connect(conn_str, autocommit=False) as conn:
                cursor = conn.cursor()
                cursor.execute(sql, params)
                conn.commit()
                return
        except pyodbc.Error as e:
            sql_state = e.args[0]
            error_code = e.args[1] if len(e.args) > 1 else ""
            if "1205" in str(error_code) and attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)
                logging.warning(f"Deadlock detected (attempt {attempt + 1}), retrying in {delay}s")
                time.sleep(delay)
            else:
                raise
```

5. In C# Dapper, implement retry with Polly:
```csharp
using Polly;
using Polly.Retry;

var retryPolicy = Policy
    .Handle<SqlException>(ex => ex.Number == 1205)  // deadlock victim
    .WaitAndRetryAsync(
        retryCount: 3,
        sleepDurationProvider: attempt => TimeSpan.FromMilliseconds(500 * Math.Pow(2, attempt)),
        onRetry: (exception, timeSpan, attempt, context) =>
            logger.LogWarning($"Deadlock on attempt {attempt}, retrying in {timeSpan.TotalMs}ms"));

await retryPolicy.ExecuteAsync(async () =>
{
    using var conn = new SqlConnection(connectionString);
    await conn.ExecuteAsync(sql, parameters);
});
```

**Fix procedure**

1. Pull the latest deadlock graph and parse the victim pattern:
```sql
-- Get recent deadlock events
WITH DeadlockData AS (
    SELECT CAST(target_data AS XML) AS xml_data
    FROM sys.dm_xe_session_targets t
    JOIN sys.dm_xe_sessions s ON t.event_session_address = s.address
    WHERE s.name = 'system_health' AND t.target_name = 'ring_buffer'
)
SELECT xml_data.query('/RingBufferTarget/event[@name="xml_deadlock_report"]')
FROM DeadlockData;
```

2. Identify which stored procedures or queries are deadlocking — look for conflicting lock orders in the XML graph.

3. Reorder operations in the ETL to acquire locks consistently (always lock bronze before silver, silver before gold).

4. If the deadlock is reader-writer (a SELECT blocking an UPDATE), confirm RCSI is on and the SELECT is not using `SERIALIZABLE` hints.

5. For immediate production relief, set a lower `DEADLOCK_PRIORITY` on the less critical session:
```sql
SET DEADLOCK_PRIORITY LOW;  -- put this at the top of the analytical query SP
```

---

### 3. Data Disk Full

**What happens**

The GCE pd-ssd data volume reaches 100% capacity during an overnight bulk load of OHLCV price data. SQL Server cannot allocate new extents for the `bronze.price_history` data file. All INSERT operations fail with OS error 112 (disk full). The pipeline halts, the Airflow DAG marks tasks as failed, and because the gold layer has not been refreshed, the morning index publication uses yesterday's prices. The SLA is missed.

**Root cause**

SQL Server data files grow via autogrow events when the current allocated space is exhausted. If the OS has no free space, the autogrow fails and the write fails. Common causes on this platform: unexpected data volume growth (new index universe added), log file growing due to missed backups, TempDB runaway growth, or retention policy not archiving old bronze partitions. The `size` column in `sys.master_files` shows allocated space; `FILEPROPERTY` or `sp_spaceused` shows actual used space.

**Consequences**

- Bronze ingestion halts; day's OHLCV data, corporate actions, and ESG scores not loaded
- Gold layer stale; index constituents and weights calculated on prior-day data
- Morning publication deadline missed — BMR regulatory consequence
- Application errors cascade to the C# API layer (Dapper writes return `SqlException`)

**Prevention protocol**

1. Monitor disk usage from Linux and inside SQL Server:
```bash
# Linux-level disk check
df -h /data/mssql

# Alert if above 80%
used_pct=$(df /data/mssql | awk 'NR==2 {print $5}' | tr -d '%')
if [ "$used_pct" -gt 80 ]; then
    echo "ALERT: Data disk at ${used_pct}%" | mail -s "SQL Server Disk Alert" oncall@company.com
fi
```

```sql
-- SQL Server view: data file sizes and space used
SELECT
    mf.name AS logical_name,
    mf.physical_name,
    mf.size * 8 / 1024 AS allocated_mb,
    FILEPROPERTY(mf.name, 'SpaceUsed') * 8 / 1024 AS used_mb,
    (mf.size - FILEPROPERTY(mf.name, 'SpaceUsed')) * 8 / 1024 AS free_mb
FROM sys.master_files mf
WHERE mf.database_id = DB_ID('analytics_db');

-- Database-level space summary
EXEC sp_spaceused;

-- Top 10 largest tables by data size
SELECT TOP 10
    OBJECT_NAME(i.object_id) AS table_name,
    SUM(a.total_pages) * 8 / 1024 AS total_mb,
    SUM(a.used_pages) * 8 / 1024 AS used_mb
FROM sys.indexes i
JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
JOIN sys.allocation_units a ON p.partition_id = a.container_id
GROUP BY i.object_id
ORDER BY total_mb DESC;
```

2. Set autogrow in fixed MB increments (never percentage):
```sql
ALTER DATABASE analytics_db
MODIFY FILE (NAME = analytics_db_data, FILEGROWTH = 2048MB);  -- 2 GB chunks
ALTER DATABASE analytics_db
MODIFY FILE (NAME = analytics_db_data, MAXSIZE = 400GB);       -- hard ceiling below disk
```

3. Implement a retention policy to archive bronze partitions older than 90 days to GCS.

**Fix procedure**

1. Confirm disk is full and identify the largest consumers:
```bash
df -h
du -sh /var/opt/mssql/data/*
```

2. If time permits, online-resize the GCE persistent disk (zero downtime):
```bash
# In GCP Console or gcloud — resize the disk
gcloud compute disks resize sql-server-data-disk --size=1000GB --zone=europe-west1-b

# On the Linux VM, extend the filesystem (no reboot needed for ext4)
sudo growpart /dev/sdb 1
sudo resize2fs /dev/sdb1

# Verify
df -h /data/mssql
```

3. If immediate space is needed before resize completes, move non-critical files:
```bash
# Move old log backups off the data volume
mv /var/opt/mssql/backups/analytics_db_log_202501*.bak /tmp/archive/
```

4. Delete or archive old bronze partition data:
```sql
-- Archive OHLCV data older than 90 days
DELETE FROM bronze.price_history
WHERE trade_date < DATEADD(DAY, -90, CAST(GETDATE() AS DATE));
```

5. Shrink the data file only if truly necessary (avoid fragmentation):
```sql
USE analytics_db;
DBCC SHRINKFILE (analytics_db_data, 200000);  -- target size in MB, use conservatively
```

6. Restart the pipeline once disk space is confirmed at < 70%.

---

### 4. Backup Corruption / Untested Restores

**What happens**

Nightly full backups run to GCS via a bash script using `sqlcmd`. The script completes successfully and logs a green status. Six months pass with no restore test. A pd-ssd disk failure on the GCE instance corrupts the primary data files. The team attempts to restore from GCS — the backup file is corrupt because the GCS upload script was silently truncating files above 5 GB, a limit on the gsutil version in use. The database cannot be restored.

**Root cause**

SQL Server backup files are not self-verifying by default. `BACKUP DATABASE` reports success when data is written to disk, but it does not validate that the file can actually be restored. Backup corruption can occur due to: OS-level I/O errors during the backup write, GCS upload truncation or corruption, file permission issues causing partial writes, or backup device failures. `RESTORE VERIFYONLY` reads and validates the backup header and checksums but does not restore — it is a safety net, not a guarantee.

**Consequences**

- Complete database loss if the only copy is a corrupt backup
- All bronze/silver/gold data, stored procedures, and schema history lost
- Recovery from scratch: days to weeks of data re-ingestion and reprocessing
- Regulatory non-compliance: BMR requires auditability of index calculation history

**Prevention protocol**

1. Always include `CHECKSUM` in backup commands:
```sql
BACKUP DATABASE analytics_db
TO DISK = '/var/opt/mssql/backups/analytics_db_full.bak'
WITH COMPRESSION, CHECKSUM, STATS = 10;

BACKUP LOG analytics_db
TO DISK = '/var/opt/mssql/backups/analytics_db_log.bak'
WITH COMPRESSION, CHECKSUM;
```

2. Run `RESTORE VERIFYONLY` immediately after every backup:
```bash
#!/bin/bash
BACKUP_FILE="/var/opt/mssql/backups/analytics_db_full_$(date +%Y%m%d).bak"

# Take backup
sqlcmd -S localhost -U sa -P "$SA_PASSWORD" -Q "
BACKUP DATABASE analytics_db
TO DISK = '$BACKUP_FILE'
WITH COMPRESSION, CHECKSUM, STATS = 10;"

# Verify immediately
VERIFY_RESULT=$(sqlcmd -S localhost -U sa -P "$SA_PASSWORD" -Q "
RESTORE VERIFYONLY FROM DISK = '$BACKUP_FILE'
WITH CHECKSUM;" 2>&1)

if echo "$VERIFY_RESULT" | grep -q "is valid"; then
    echo "Backup verified successfully: $BACKUP_FILE"
    # Upload to GCS
    gsutil cp "$BACKUP_FILE" "gs://company-sql-backups/analytics_db/$(date +%Y/%m/%d)/"
else
    echo "BACKUP VERIFICATION FAILED: $BACKUP_FILE" | mail -s "CRITICAL: SQL Backup Failed" oncall@company.com
    exit 1
fi
```

3. Run `DBCC CHECKDB` weekly to detect corruption before it affects backups:
```sql
DBCC CHECKDB('analytics_db') WITH NO_INFOMSGS, ALL_ERRORMSGS;
```

4. Quarterly restore drill — see [[backup-restore-drill]] runbook. Automate the drill against a separate GCE instance:
```bash
# Restore to test instance (run on a separate VM)
sqlcmd -S test-sql-instance -U sa -P "$SA_PASSWORD" -Q "
RESTORE DATABASE analytics_db_test
FROM DISK = '/mnt/gcs-backup/analytics_db_full_latest.bak'
WITH MOVE 'analytics_db_data' TO '/var/opt/mssql/data/analytics_db_test.mdf',
     MOVE 'analytics_db_log' TO '/var/opt/mssql/data/analytics_db_test_log.ldf',
     REPLACE, STATS = 10;"
```

**Fix procedure**

1. List available backup files in GCS and identify the last known-good backup:
```bash
gsutil ls -l "gs://company-sql-backups/analytics_db/**" | sort -k2 | tail -20
```

2. Download the backup to the recovery instance:
```bash
gsutil cp "gs://company-sql-backups/analytics_db/2026/03/22/analytics_db_full_20260322.bak" \
    /var/opt/mssql/backups/
```

3. Verify the backup before attempting restore:
```bash
sqlcmd -S localhost -U sa -P "$SA_PASSWORD" -Q "
RESTORE VERIFYONLY
FROM DISK = '/var/opt/mssql/backups/analytics_db_full_20260322.bak'
WITH CHECKSUM;"
```

4. Restore the database:
```sql
RESTORE DATABASE analytics_db
FROM DISK = '/var/opt/mssql/backups/analytics_db_full_20260322.bak'
WITH REPLACE, RECOVERY, STATS = 5;
```

5. Apply log backups sequentially to minimize data loss:
```sql
RESTORE DATABASE analytics_db
FROM DISK = '/var/opt/mssql/backups/analytics_db_full_20260322.bak'
WITH NORECOVERY, REPLACE;

RESTORE LOG analytics_db
FROM DISK = '/var/opt/mssql/backups/analytics_db_log_20260322_0000.bak'
WITH NORECOVERY;

-- ... apply all log backups in order ...

RESTORE LOG analytics_db
FROM DISK = '/var/opt/mssql/backups/analytics_db_log_20260322_2345.bak'
WITH RECOVERY;  -- final log backup: bring database online
```

---

### 5. TDE Certificate Lost

**What happens**

The analytics database has Transparent Data Encryption (TDE) enabled — a compliance requirement under EU BMR for data at rest. The GCE VM fails catastrophically and must be rebuilt from scratch. The team successfully restores the `.bak` file from GCS. When attempting `RESTORE DATABASE`, SQL Server returns `Error 33111: Cannot find server certificate with thumbprint`. The TDE certificate was stored only in the `master` database on the failed VM, and no certificate backup was ever taken. The backup is permanently inaccessible.

**Root cause**

TDE encrypts the database encryption key (DEK) using an asymmetric certificate stored in the `master` database. The certificate itself is encrypted by the Database Master Key (DMK), which is protected by the service master key. When restoring a TDE-protected backup to a new SQL Server instance, you must first restore the certificate (and its private key) to the new instance's `master` database. Without the certificate, the encrypted DEK cannot be decrypted, and the backup is unreadable.

**Consequences**

- Encrypted backup is permanently inaccessible — equivalent to total data loss
- All calculation history, index weights, ESG scores, and audit trail lost
- BMR regulatory breach — historical index data must be retained and auditable
- Certificate recovery is impossible without the private key backup

**Prevention protocol**

1. Immediately after creating the TDE certificate, back it up with its private key:
```sql
-- Check if TDE is enabled and note the certificate name
SELECT db.name AS database_name, dek.encryptor_thumbprint,
       c.name AS certificate_name, c.expiry_date
FROM sys.dm_database_encryption_keys dek
JOIN sys.databases db ON dek.database_id = db.database_id
JOIN sys.certificates c ON dek.encryptor_thumbprint = c.thumbprint;

-- Back up the certificate and private key
BACKUP CERTIFICATE TDE_analytics_cert
TO FILE = '/var/opt/mssql/certs/TDE_analytics_cert.cer'
WITH PRIVATE KEY (
    FILE = '/var/opt/mssql/certs/TDE_analytics_cert_key.pvk',
    ENCRYPTION BY PASSWORD = 'StrongCertPassword123!'  -- store in HashiCorp Vault or GCP Secret Manager
);
```

2. Upload the certificate backup to GCS in a separate, access-controlled bucket:
```bash
# Encrypt the cert files before upload (belt-and-suspenders)
gpg --symmetric --cipher-algo AES256 /var/opt/mssql/certs/TDE_analytics_cert.cer
gpg --symmetric --cipher-algo AES256 /var/opt/mssql/certs/TDE_analytics_cert_key.pvk

gsutil cp /var/opt/mssql/certs/TDE_analytics_cert.cer.gpg \
    gs://company-sql-certs/tde/
gsutil cp /var/opt/mssql/certs/TDE_analytics_cert_key.pvk.gpg \
    gs://company-sql-certs/tde/
```

3. Store the private key encryption password in GCP Secret Manager:
```bash
echo -n 'StrongCertPassword123!' | \
    gcloud secrets create sql-tde-cert-password \
    --data-file=- \
    --replication-policy=user-managed \
    --locations=europe-west1
```

4. Automate certificate backup as part of the weekly maintenance job.

**Fix procedure**

1. On the new SQL Server instance, create the Database Master Key in `master`:
```sql
USE master;
CREATE MASTER KEY ENCRYPTION BY PASSWORD = 'NewMasterKeyPassword!';
```

2. Retrieve the certificate files from GCS and decrypt:
```bash
gsutil cp gs://company-sql-certs/tde/TDE_analytics_cert.cer.gpg /tmp/
gsutil cp gs://company-sql-certs/tde/TDE_analytics_cert_key.pvk.gpg /tmp/
gpg --decrypt /tmp/TDE_analytics_cert.cer.gpg > /tmp/TDE_analytics_cert.cer
gpg --decrypt /tmp/TDE_analytics_cert_key.pvk.gpg > /tmp/TDE_analytics_cert_key.pvk
```

3. Restore the certificate into the new `master` database:
```sql
USE master;
CREATE CERTIFICATE TDE_analytics_cert
FROM FILE = '/tmp/TDE_analytics_cert.cer'
WITH PRIVATE KEY (
    FILE = '/tmp/TDE_analytics_cert_key.pvk',
    DECRYPTION BY PASSWORD = 'StrongCertPassword123!'
);
```

4. Now restore the TDE-protected database backup normally:
```sql
RESTORE DATABASE analytics_db
FROM DISK = '/var/opt/mssql/backups/analytics_db_full.bak'
WITH REPLACE, RECOVERY, STATS = 5;
```

5. Delete the certificate plaintext files from the filesystem immediately after restore.

---

## High — Data Quality / Performance Degradation

---

### 6. String or Binary Data Would Be Truncated (Error 8152)

**What happens**

A vendor API provides company metadata including `company_name` fields. Most are under 100 characters. One record — a restructured holding company with a full legal name — is 143 characters. The Python pipeline bulk-inserts a 5,000-row batch into `bronze.company_master`. SQL Server raises `Error 8152: String or binary data would be truncated in table 'analytics_db.bronze.company_master', column 'company_name'`. The entire batch is rejected. No rows are inserted, even the 4,999 valid ones.

**Root cause**

SQL Server's `INSERT` is an all-or-nothing operation per batch. If any row in the batch would violate a column length constraint, the entire batch fails with error 8152. In SQL Server 2019+ with compatibility level 150, the error message includes the column name and truncated value. Prior to that, identifying which column caused the error required guesswork. The problem originates from column definitions that are too narrow relative to realistic source data ranges.

**Consequences**

- Silent data gap: bronze table missing 5,000 rows for the day's load
- Silver and gold layers calculate index metrics on incomplete constituent data
- ESG scores for new constituents are not loaded; index rebalancing uses stale universe
- If not caught by data quality checks, incorrect index weights published to clients

**Prevention protocol**

1. Enable verbose truncation warnings (SQL Server 2019+, compatibility level 150):
```sql
ALTER DATABASE analytics_db SET COMPATIBILITY_LEVEL = 150;
-- Error message will now say: "String or binary data would be truncated in table
-- 'analytics_db.bronze.company_master', column 'company_name'. Truncated value: 'Acme Corp...'"
```

2. Design bronze staging tables with `VARCHAR(MAX)` or oversized columns; enforce length constraints only at silver:
```sql
-- Bronze: accept everything
CREATE TABLE bronze.company_master_stage (
    company_id       INT,
    company_name     NVARCHAR(MAX),   -- never truncate at bronze
    isin             VARCHAR(20),
    country_code     CHAR(2),
    load_timestamp   DATETIME2(3) DEFAULT SYSUTCDATETIME()
);

-- Silver: enforce constraints with explicit truncation and logging
INSERT INTO silver.company_master (company_id, company_name, isin, country_code)
SELECT
    company_id,
    LEFT(NULLIF(RTRIM(company_name), ''), 255) AS company_name,  -- explicit truncation
    UPPER(LEFT(isin, 12)) AS isin,
    UPPER(LEFT(country_code, 2)) AS country_code
FROM bronze.company_master_stage
WHERE load_timestamp >= @batch_start;
```

3. Add a pre-load validation step in Python to detect truncation risks before hitting SQL Server:
```python
import pyodbc
import pandas as pd

def validate_string_lengths(df: pd.DataFrame, column_limits: dict) -> pd.DataFrame:
    """Flag rows that would exceed column limits. Returns offending rows."""
    violations = []
    for col, max_len in column_limits.items():
        if col in df.columns:
            mask = df[col].str.len() > max_len
            if mask.any():
                bad_rows = df[mask].copy()
                bad_rows['_violation'] = f"{col} exceeds {max_len} chars"
                violations.append(bad_rows)
    return pd.concat(violations) if violations else pd.DataFrame()

# Usage
column_limits = {"company_name": 255, "isin": 12, "country_code": 2}
issues = validate_string_lengths(df_batch, column_limits)
if not issues.empty:
    issues.to_csv("/logs/truncation_violations.csv", index=False)
    logger.warning(f"{len(issues)} rows flagged for truncation, loading with LEFT() trim")
```

**Fix procedure**

1. Identify the exact column causing the truncation (SQL Server 2019+):
```sql
-- The error message in compatibility 150 will include the column name.
-- If on older compatibility, test each VARCHAR column:
SELECT MAX(LEN(company_name)) AS max_len FROM bronze.company_master_stage;
SELECT MAX(LEN(isin)) AS max_len FROM bronze.company_master_stage;
```

2. Widen the column in production if the data is legitimately longer:
```sql
ALTER TABLE bronze.company_master ALTER COLUMN company_name NVARCHAR(500);
ALTER TABLE silver.company_master ALTER COLUMN company_name NVARCHAR(500);
```

3. Re-run the failed load batch.

---

### 7. Implicit Type Conversion Kills Performance

**What happens**

The gold-layer API query for index constituents includes `WHERE i.instrument_isin = @isin`. The column `instrument_isin` is `VARCHAR(12)`. The C# Dapper parameter `@isin` is passed as a .NET `string`, which maps to SQL Server `NVARCHAR`. SQL Server cannot use the index on `instrument_isin` because it must apply `CONVERT_IMPLICIT` to every row in the column to compare it against the `NVARCHAR` parameter. A query that should execute in 2ms (index seek on 10M rows) takes 4 seconds (full table scan). Under load, the API latency spikes, triggering circuit breakers.

**Root cause**

SQL Server has a data type precedence hierarchy. `NVARCHAR` outranks `VARCHAR`. When types differ on both sides of a comparison, SQL Server converts the lower-precedence side (the column) to match the parameter, not the other way around. This means `CONVERT_IMPLICIT` is applied to every row in the column, preventing the optimizer from using the index (the index contains `VARCHAR` values, not the converted `NVARCHAR` ones). The problem appears in execution plans as a yellow `CONVERT_IMPLICIT` warning on the `Seek Predicate`.

**Consequences**

- Table scans on multi-million row tables for every API call
- Gold API response time degrades from sub-10ms to seconds
- Under concurrent load, CPU spikes to 100% on full-table scans
- Dashboard queries and batch pipelines compete for CPU resources

**Prevention protocol**

1. Detect implicit conversions in the plan cache:
```sql
SELECT TOP 20
    qs.execution_count,
    qs.total_logical_reads / qs.execution_count AS avg_logical_reads,
    SUBSTRING(st.text, qs.statement_start_offset/2+1,
              (CASE qs.statement_end_offset WHEN -1 THEN DATALENGTH(st.text)
               ELSE qs.statement_end_offset END - qs.statement_start_offset)/2+1) AS query_text,
    qp.query_plan
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
CROSS APPLY sys.dm_exec_query_plan(qs.plan_handle) qp
WHERE CAST(qp.query_plan AS NVARCHAR(MAX)) LIKE '%CONVERT_IMPLICIT%'
ORDER BY avg_logical_reads DESC;
```

2. Fix pyodbc to pass the correct type using explicit `VARCHAR`:
```python
import pyodbc

# BAD: Python str → NVARCHAR → implicit conversion on VARCHAR column
cursor.execute("SELECT * FROM gold.index_constituents WHERE instrument_isin = ?", isin_value)

# GOOD: explicitly cast in the query, or use CAST in SQL
cursor.execute(
    "SELECT * FROM gold.index_constituents WHERE instrument_isin = CAST(? AS VARCHAR(12))",
    isin_value
)

# ALTERNATIVE: use pyodbc's explicit type binding
cursor.setinputsizes([pyodbc.SQL_VARCHAR])
cursor.execute("SELECT * FROM gold.index_constituents WHERE instrument_isin = ?", isin_value)
```

3. Fix Dapper to explicitly specify varchar parameters:
```csharp
// BAD: string maps to NVARCHAR by default in Dapper
var result = await conn.QueryAsync<Constituent>(
    "SELECT * FROM gold.index_constituents WHERE instrument_isin = @isin",
    new { isin = isinValue });

// GOOD: use DbString to force VARCHAR
var result = await conn.QueryAsync<Constituent>(
    "SELECT * FROM gold.index_constituents WHERE instrument_isin = @isin",
    new { isin = new DbString { Value = isinValue, IsAnsi = true, Length = 12 } });
```

4. Ensure all `CHAR`/`VARCHAR` ID columns (ISIN, SEDOL, ticker) are consistently typed across all tables and never mixed with `NCHAR`/`NVARCHAR`.

**Fix procedure**

1. Identify the exact implicit conversion in the execution plan (look for the yellow warning):
```sql
SET STATISTICS IO ON;
SET STATISTICS TIME ON;
SELECT * FROM gold.index_constituents WHERE instrument_isin = N'US0378331005';
-- Look for CONVERT_IMPLICIT in the XML plan
```

2. Fix the parameter type in the calling code (see prevention above).

3. Force a recompile to flush the bad cached plan:
```sql
EXEC sp_recompile 'gold.index_constituents';
```

---

### 8. Parameter Sniffing

**What happens**

The stored procedure `usp_get_index_constituents @index_code VARCHAR(20)` is called for the first time with `'MSCI_WORLD'` (8,000 constituents). SQL Server compiles a parallel plan optimized for 8,000 rows. This plan is cached. All subsequent calls, including `'CUSTOM_ESG_5'` (12 constituents), use the cached plan. The plan allocates 8 parallel threads, sorts on a 8,000-row estimate, and performs hash joins — catastrophically inefficient for 12 rows. A query that should run in 1ms takes 800ms. When `CUSTOM_ESG_5` is recalculated during the daily batch, it serially blocks 200 other fast queries.

**Root cause**

SQL Server compiles stored procedure plans on first execution (or after `sp_recompile`) using the parameter values provided at that moment ("sniffed" parameters). The resulting plan is stored in the plan cache keyed by the procedure object. Every subsequent execution reuses this plan regardless of the actual parameter values. This is a feature, not a bug — reuse avoids compilation overhead — but it becomes a problem when parameter distributions are highly skewed (common in financial data: flagship vs boutique indices).

**Consequences**

- Fast queries get heavyweight parallel plans → thread starvation
- Slow queries get serial plans → CPU underutilized
- Index calculation for small custom ESG indices takes 50x longer than necessary
- Execution time is non-deterministic; SLA compliance becomes unpredictable

**Prevention protocol**

1. Enable and configure Query Store on the database:
```sql
ALTER DATABASE analytics_db SET QUERY_STORE = ON;
ALTER DATABASE analytics_db SET QUERY_STORE (
    OPERATION_MODE = READ_WRITE,
    CLEANUP_POLICY = (STALE_QUERY_THRESHOLD_DAYS = 30),
    DATA_FLUSH_INTERVAL_SECONDS = 900,
    MAX_STORAGE_SIZE_MB = 1024,
    QUERY_CAPTURE_MODE = AUTO,
    SIZE_BASED_CLEANUP_MODE = AUTO
);
```

2. For procedures with high parameter skew, use `OPTION(RECOMPILE)`:
```sql
CREATE OR ALTER PROCEDURE usp_get_index_constituents
    @index_code VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT ic.instrument_isin, ic.weight, ic.effective_date
    FROM gold.index_constituents ic
    WHERE ic.index_code = @index_code
    OPTION(RECOMPILE);  -- recompile per execution; cheap for fast queries, correct for all
END;
```

3. Alternative: `OPTIMIZE FOR UNKNOWN` (avoids sniffing but uses average statistics):
```sql
SELECT ic.instrument_isin, ic.weight
FROM gold.index_constituents ic
WHERE ic.index_code = @index_code
OPTION(OPTIMIZE FOR (@index_code UNKNOWN));
```

4. Force a specific plan via Query Store when a known-good plan exists:
```sql
-- Find the query and its plans
SELECT qsq.query_id, qsq.query_hash, qsp.plan_id, qsp.avg_duration,
       qsqt.query_sql_text
FROM sys.query_store_query qsq
JOIN sys.query_store_query_text qsqt ON qsq.query_text_id = qsqt.query_text_id
JOIN sys.query_store_plan qsp ON qsq.query_id = qsp.query_id
WHERE qsqt.query_sql_text LIKE '%index_constituents%'
ORDER BY qsp.avg_duration DESC;

-- Force a specific good plan
EXEC sys.sp_query_store_force_plan @query_id = 42, @plan_id = 7;
```

**Fix procedure**

1. Clear the cached plan for the affected procedure:
```sql
-- Clear specific procedure's plan
EXEC sp_recompile 'usp_get_index_constituents';
```

2. Identify which plan is currently cached and how it was compiled:
```sql
SELECT qs.execution_count, qs.plan_generation_num,
       qs.total_elapsed_time / qs.execution_count AS avg_elapsed_us,
       SUBSTRING(st.text, 1, 200) AS query_text
FROM sys.dm_exec_procedure_stats ps
CROSS APPLY sys.dm_exec_sql_text(ps.sql_handle) st
CROSS APPLY sys.dm_exec_query_plan(ps.plan_handle) qp
WHERE OBJECT_NAME(ps.object_id) = 'usp_get_index_constituents';
```

3. Add `OPTION(RECOMPILE)` or `OPTION(OPTIMIZE FOR UNKNOWN)` to the affected query and redeploy.

---

### 9. Blocking Chains

**What happens**

At 17:30 UTC, the dashboard team runs a long analytical query refreshing a Power BI report on `gold.index_performance_history`. This query holds shared locks on 15 gold tables under `READ_COMMITTED` isolation for 8 minutes. The evening pipeline begins at 17:35 UTC and attempts to `UPDATE` the same gold tables with newly calculated index values. All pipeline UPDATE sessions queue behind the dashboard query. 20 sessions pile up in `WAIT TYPE: LCK_M_U`. By 17:45, the Airflow task timeout fires, the pipeline fails, and index data is not published.

**Root cause**

Under `READ_COMMITTED` isolation (SQL Server default), shared locks acquired during a `SELECT` are released as each row is read — not held for the transaction duration. However, under `SERIALIZABLE` or if the query uses lock hints (`HOLDLOCK`, `TABLOCK`), shared locks are held until the transaction commits. The dashboard query runs within a transaction that is either explicitly open or uses a hint. The pipeline `UPDATE` needs exclusive locks that conflict with the held shared locks, creating a blocking chain where one session blocks many.

**Consequences**

- Pipeline execution delayed beyond SLA window
- Index values not updated in the API serving layer; clients receive stale data
- Cascading Airflow task failures; DAG retries compound the delay
- In extreme cases, the blocking chain can trigger memory pressure from accumulated lock structures

**Prevention protocol**

1. Monitor blocking chains in real time:
```sql
-- Find blocking chains: who is blocking whom
SELECT
    r.session_id AS blocked_session,
    r.blocking_session_id AS blocker_session,
    r.wait_type,
    r.wait_time / 1000 AS wait_seconds,
    r.status,
    SUBSTRING(st.text, r.statement_start_offset/2+1, 200) AS blocked_query,
    h.text AS blocker_query
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) st
JOIN sys.dm_exec_sessions s ON r.session_id = s.session_id
OUTER APPLY (
    SELECT TOP 1 st2.text
    FROM sys.dm_exec_requests r2
    CROSS APPLY sys.dm_exec_sql_text(r2.sql_handle) st2
    WHERE r2.session_id = r.blocking_session_id
) h
WHERE r.blocking_session_id > 0
ORDER BY r.wait_time DESC;

-- Find the head blocker (the root of the chain)
SELECT session_id, login_name, host_name, program_name,
       open_transaction_count, status,
       last_request_start_time
FROM sys.dm_exec_sessions
WHERE session_id IN (
    SELECT blocking_session_id FROM sys.dm_exec_requests WHERE blocking_session_id > 0
)
AND session_id NOT IN (
    SELECT session_id FROM sys.dm_exec_requests WHERE blocking_session_id > 0
);
```

2. Enable RCSI to prevent reader-writer blocking (see Problem #2):
```sql
ALTER DATABASE analytics_db SET READ_COMMITTED_SNAPSHOT ON;
```

3. Add `SET LOCK_TIMEOUT` in all pipeline sessions:
```sql
-- Pipeline sessions should fail fast rather than wait indefinitely
SET LOCK_TIMEOUT 30000;  -- 30 seconds; raises error 1222 if timeout exceeded
```

4. Direct dashboard/BI queries to a BigQuery replica via Dataflow export rather than hitting the production SQL Server directly.

**Fix procedure**

1. Identify and kill the head blocker if it is a rogue query:
```sql
-- Kill the head blocker (get spid from the blocking chain query above)
KILL 55;
```

2. If it is a legitimate long-running query that cannot be killed, set lock timeout on the pipeline session and let it fail-fast, then retry after the blocking query completes.

3. After the incident, add `NOLOCK` hint to the specific dashboard queries (with documented caveats about dirty reads) as a temporary measure until RCSI is enabled:
```sql
-- TEMPORARY — dirty reads acceptable for dashboard/analytical use
SELECT * FROM gold.index_performance_history WITH (NOLOCK)
WHERE index_code = 'MSCI_WORLD' AND effective_date >= '2026-01-01';
```

> [!warning] NOLOCK hint
> `WITH (NOLOCK)` / `READUNCOMMITTED` can return uncommitted rows, skip rows, or return the same row twice due to page splits. Never use on financial calculations, only on non-critical dashboard queries where approximate data is acceptable.

---

### 10. Stale Statistics

**What happens**

The `silver.corporate_actions` table holds 1M rows at the start of the year. Over Q1, a large vendor data backfill adds 9M historical records, bringing the table to 10M rows. SQL Server's auto-update statistics threshold is 20% of rows (2M row change) — so statistics update occurs, but then another 7M rows are added before the next update triggers. The query optimizer estimates 2M rows for a join plan; the actual result is 10M rows. The query plan uses a nested-loop join optimized for 2M rows — catastrophic at 10M. The gold aggregation runs for 2 hours instead of 4 minutes.

**Root cause**

Auto-update statistics fires when approximately 20% of rows in a table have changed (this threshold decreases for large tables in SQL Server 2016+, but partitioned tables have their own per-partition thresholds). Statistics describe the data distribution via histograms. When the histogram is stale, the optimizer's cardinality estimates diverge from reality, leading to wrong join strategies, wrong memory grants (too little → spills to TempDB, too much → memory starvation), and wrong parallelism decisions.

**Consequences**

- Gold aggregation query runtimes increase from minutes to hours
- Memory grant underestimation causes TempDB spill (physical reads replacing memory operations)
- Daily index calculation deadline missed
- ESG score aggregations and constituent-weighted averages are slow and unpredictable

**Prevention protocol**

1. Check statistics age and sampling rate for critical tables:
```sql
SELECT
    OBJECT_NAME(s.object_id) AS table_name,
    s.name AS stat_name,
    sp.last_updated,
    sp.rows,
    sp.rows_sampled,
    CAST(100.0 * sp.rows_sampled / NULLIF(sp.rows, 0) AS DECIMAL(5,2)) AS sample_pct,
    sp.modification_counter
FROM sys.stats s
CROSS APPLY sys.dm_db_stats_properties(s.object_id, s.stats_id) sp
WHERE OBJECT_NAME(s.object_id) IN ('corporate_actions', 'index_constituents', 'price_history')
ORDER BY sp.last_updated;

-- Inspect a specific statistic's histogram
DBCC SHOW_STATISTICS('silver.corporate_actions', 'IX_corp_actions_effective_date');
```

2. After each pipeline load, run targeted statistics update with full scan on affected tables:
```sql
-- Post-load statistics update (run after each pipeline batch)
UPDATE STATISTICS silver.corporate_actions WITH FULLSCAN;
UPDATE STATISTICS silver.index_constituents WITH FULLSCAN;
UPDATE STATISTICS gold.index_weights WITH FULLSCAN;

-- Or update all statistics in the database
EXEC sp_updatestats;  -- only updates stats with changes since last update
```

3. Enable `AUTO_UPDATE_STATISTICS_ASYNC` to avoid query blocking during stats update:
```sql
ALTER DATABASE analytics_db SET AUTO_UPDATE_STATISTICS ON;
ALTER DATABASE analytics_db SET AUTO_UPDATE_STATISTICS_ASYNC ON;
```

4. Add a post-load step in the Airflow DAG to run statistics update:
```python
from airflow.providers.microsoft.mssql.operators.mssql import MsSqlOperator

update_stats = MsSqlOperator(
    task_id='update_statistics',
    mssql_conn_id='analytics_db',
    sql="""
        UPDATE STATISTICS silver.corporate_actions WITH FULLSCAN;
        UPDATE STATISTICS silver.index_constituents WITH FULLSCAN;
        UPDATE STATISTICS gold.index_weights WITH FULLSCAN;
    """,
    dag=dag
)
load_silver >> update_stats >> load_gold
```

**Fix procedure**

1. Run `FULLSCAN` statistics update on the table with the bad estimates:
```sql
UPDATE STATISTICS silver.corporate_actions WITH FULLSCAN;
```

2. Flush the cached plan that was using the stale statistics:
```sql
-- Free the specific plan from cache
EXEC sp_recompile 'silver.corporate_actions';
-- Or clear the entire plan cache (emergency only — affects all queries)
DBCC FREEPROCCACHE;
```

3. Re-run the failing gold aggregation query.

---

### 11. Index Fragmentation

**What happens**

The `bronze.price_history` table receives 500,000 new OHLCV rows daily via bulk INSERT. It also has 200,000 rows deleted weekly as part of the retention policy. After 3 months without index maintenance, the clustered index on `(instrument_isin, trade_date)` has 92% logical fragmentation. B-tree pages are mostly empty; SQL Server reads 5 pages to get data that fits in 1. Logical reads for the daily silver transform go from 100K to 500K. The transform runs for 45 minutes instead of 9 minutes.

**Root cause**

Index fragmentation occurs in two forms: logical (pages are out of order — the logical page order differs from physical), and extent (extents are not contiguous). Heavy INSERT patterns cause page splits when new rows are inserted in the middle of an already-full page. DELETE leaves holes. The `fill_factor` setting controls how full pages are packed. When `avg_fragmentation_in_percent` exceeds 30%, rebuilding the index reorganizes pages in order and resets the fill factor. Between 10–30%, REORGANIZE (online, incremental) is sufficient.

**Consequences**

- Excess logical reads → higher I/O → slower queries → longer pipeline runtimes
- Buffer pool fills with unnecessary empty pages from fragmented index
- Read-ahead prefetch is less effective on non-contiguous extents
- SSD I/O budget consumed; pd-ssd IOPS limits become the bottleneck

**Prevention protocol**

1. Query fragmentation for all indexes:
```sql
SELECT
    OBJECT_NAME(ips.object_id) AS table_name,
    i.name AS index_name,
    ips.index_type_desc,
    ips.avg_fragmentation_in_percent,
    ips.page_count,
    ips.avg_page_space_used_in_percent
FROM sys.dm_db_index_physical_stats(DB_ID('analytics_db'), NULL, NULL, NULL, 'SAMPLED') ips
JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
WHERE ips.page_count > 100  -- only indexes large enough to matter
ORDER BY ips.avg_fragmentation_in_percent DESC;
```

2. Intelligent rebuild/reorganize script (Ola Hallengren logic condensed):
```sql
DECLARE @table NVARCHAR(256), @index NVARCHAR(256), @frag FLOAT, @pages INT;
DECLARE frag_cursor CURSOR FOR
    SELECT QUOTENAME(OBJECT_SCHEMA_NAME(ips.object_id)) + '.' + QUOTENAME(OBJECT_NAME(ips.object_id)),
           QUOTENAME(i.name),
           ips.avg_fragmentation_in_percent,
           ips.page_count
    FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'SAMPLED') ips
    JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
    WHERE ips.page_count > 100 AND i.index_id > 0;

OPEN frag_cursor;
FETCH NEXT FROM frag_cursor INTO @table, @index, @frag, @pages;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF @frag > 30
        EXEC('ALTER INDEX ' + @index + ' ON ' + @table + ' REBUILD WITH (ONLINE = ON, FILLFACTOR = 80);');
    ELSE IF @frag > 10
        EXEC('ALTER INDEX ' + @index + ' ON ' + @table + ' REORGANIZE;');
    FETCH NEXT FROM frag_cursor INTO @table, @index, @frag, @pages;
END;
CLOSE frag_cursor;
DEALLOCATE frag_cursor;
```

3. Schedule this maintenance weekly (Saturday 02:00 UTC) via SQL Server Agent, or use the Ola Hallengren `IndexOptimize` solution.

**Fix procedure**

1. Identify the worst-fragmented tables and rebuild:
```sql
ALTER INDEX ALL ON bronze.price_history REBUILD WITH (ONLINE = ON, FILLFACTOR = 80);
ALTER INDEX ALL ON silver.index_constituents REBUILD WITH (ONLINE = ON);
```

2. `ONLINE = ON` allows concurrent reads/writes during the rebuild (SQL Server 2022 supports online rebuild for most index types). Verify before using:
```sql
-- Check if online rebuild is supported (requires Enterprise Edition or SQL Server 2022 Standard in some cases)
SELECT SERVERPROPERTY('EngineEdition');  -- 3 = Enterprise
```

---

### 12. Connection Pool Exhaustion

**What happens**

A data engineer writes a Python script for a one-off corporate actions backfill. The script opens a `pyodbc.connect()` inside a loop for each of 10,000 rows but never calls `.close()` or uses a `with` block. It is merged into the Airflow DAG and runs nightly. After 3 nights, the SQL Server connection count hits the configured maximum (100 connections). New pipeline tasks fail with `[08001] Login timeout expired` or `Cannot open database requested`. The API serving layer also starts failing as it cannot acquire connections.

**Root cause**

`pyodbc` does not implement automatic connection pooling at the library level (unlike `SqlAlchemy`). Each `pyodbc.connect()` call opens a raw TDS network connection to SQL Server. Without explicit `.close()` or context manager usage, connections remain open until the Python process's garbage collector collects the object — which may be delayed or never happen in long-running processes. SQL Server enforces a connection limit via the `max connections` configuration option (default 32,767, but typically capped lower in production). When the limit is hit, new connection attempts fail.

**Consequences**

- Pipeline tasks cannot acquire connections; Airflow tasks fail en masse
- C# API calls return `SqlException: A connection was successfully established with the server, but then an error occurred during the login process`
- Dashboard queries fail; operational visibility lost
- The only immediate fix is restarting the pipeline process (kills all its connections)

**Prevention protocol**

1. Always use context managers in Python — this is non-negotiable:
```python
import pyodbc

# BAD — connection never explicitly closed
conn = pyodbc.connect(CONN_STR)
cursor = conn.cursor()
cursor.execute("INSERT INTO bronze.corporate_actions VALUES (?, ?)", row)
conn.commit()
# conn.close() forgotten

# GOOD — context manager guarantees close on exit or exception
with pyodbc.connect(CONN_STR) as conn:
    with conn.cursor() as cursor:
        cursor.execute("INSERT INTO bronze.corporate_actions VALUES (?, ?)", row)
    conn.commit()
```

2. For high-frequency pipeline tasks, use SQLAlchemy's connection pooling:
```python
from sqlalchemy import create_engine
import urllib

params = urllib.parse.quote_plus(
    "DRIVER={ODBC Driver 18 for SQL Server};"
    "SERVER=localhost;DATABASE=analytics_db;"
    f"UID=sa;PWD={SA_PASSWORD};TrustServerCertificate=yes;"
)
engine = create_engine(
    f"mssql+pyodbc:///?odbc_connect={params}",
    pool_size=5,          # max persistent connections per process
    max_overflow=10,      # additional connections allowed temporarily
    pool_timeout=30,      # wait up to 30s for a connection
    pool_recycle=3600,    # recycle connections every hour
)
```

3. Monitor connection count:
```sql
-- Total connections by login
SELECT login_name, COUNT(*) AS connection_count
FROM sys.dm_exec_sessions
WHERE is_user_process = 1
GROUP BY login_name
ORDER BY connection_count DESC;

-- All active connections
SELECT session_id, login_name, host_name, program_name, status,
       last_request_start_time, open_transaction_count
FROM sys.dm_exec_sessions
WHERE is_user_process = 1
ORDER BY last_request_start_time;
```

**Fix procedure**

1. Identify which program/host is leaking connections:
```sql
SELECT program_name, host_name, login_name, COUNT(*) AS conn_count
FROM sys.dm_exec_sessions
WHERE is_user_process = 1
GROUP BY program_name, host_name, login_name
ORDER BY conn_count DESC;
```

2. Kill orphaned connections (or restart the responsible process):
```bash
# Restart the leaking Python pipeline process on the Airflow worker
pkill -f "python.*backfill_corporate_actions.py"
```

3. Kill individual orphaned sessions from SQL Server side:
```sql
-- Kill all sessions from a specific host/program (generate kill statements)
SELECT 'KILL ' + CAST(session_id AS VARCHAR) + ';'
FROM sys.dm_exec_sessions
WHERE program_name = 'LeakingPipelineScript' AND is_user_process = 1;
-- Then execute each KILL statement
```

4. Fix the code to use context managers and redeploy.

---

### 13. MERGE Statement Race Conditions

**What happens**

Two Airflow tasks run concurrently: `merge_esg_scores` and `merge_esg_scores_restatement`. Both execute a `MERGE INTO silver.esg_scores USING source_table ON (instrument_isin = ...)`. Without a serialization mechanism, both tasks read the target table simultaneously, find no matching rows, and both attempt to `INSERT`. The result is duplicate rows in `silver.esg_scores` for the same instrument and date. The gold aggregation query that `GROUP BY` on those rows double-counts ESG scores, producing incorrect constituent weights.

**Root cause**

`MERGE` is not inherently safe for concurrent execution against the same target table. Despite being a single statement, SQL Server can execute the `MERGE` as a scan-and-match followed by individual row operations. Two concurrent `MERGE` statements can both pass the `NOT MATCHED` check before either has committed its `INSERT`. This is a classic TOCTOU (time-of-check-time-of-use) race. The problem is compounded by the fact that `MERGE` acquires locks at the row level, not the table level, by default. Microsoft has documented several bugs and unexpected behaviors with `MERGE` in complex scenarios.

**Consequences**

- Duplicate rows in silver ESG tables — data quality failure
- Gold ESG scores calculated as 2x the correct value
- Index rebalancing based on incorrect ESG tilts → wrong constituent weights published
- Regulatory risk: incorrect ESG index weights published to EU BMR clients

**Prevention protocol**

1. Serialize MERGE operations using an Airflow pool (1 slot = only one task runs at a time):
```python
# In Airflow DAG definition
merge_esg_scores = PythonOperator(
    task_id='merge_esg_scores',
    python_callable=run_merge_esg,
    pool='sql_server_merge_pool',  # pool with slots=1
    dag=dag
)
```

```bash
# Create the pool in Airflow CLI
airflow pools set sql_server_merge_pool 1 "Serializes MERGE operations on silver tables"
```

2. Replace `MERGE` with the safer `DELETE + INSERT` pattern for ETL:
```sql
-- Safer alternative: explicit DELETE then INSERT in a transaction
BEGIN TRANSACTION;

    DELETE FROM silver.esg_scores
    WHERE instrument_isin IN (SELECT instrument_isin FROM #esg_stage)
      AND score_date IN (SELECT score_date FROM #esg_stage);

    INSERT INTO silver.esg_scores (instrument_isin, score_date, environmental_score,
                                    social_score, governance_score, composite_score)
    SELECT instrument_isin, score_date, environmental_score,
           social_score, governance_score, composite_score
    FROM #esg_stage;

COMMIT;
```

3. If `MERGE` must be used, add a `WITH (HOLDLOCK)` hint on the target to prevent phantom inserts:
```sql
MERGE INTO silver.esg_scores WITH (HOLDLOCK) AS target
USING #esg_stage AS source
ON target.instrument_isin = source.instrument_isin
   AND target.score_date = source.score_date
WHEN MATCHED THEN UPDATE SET ...
WHEN NOT MATCHED THEN INSERT ...;
```

> [!danger] MERGE reliability
> Microsoft has acknowledged bugs in `MERGE` related to duplicate key errors and unexpected behavior with concurrent access. The general recommendation for high-concurrency ETL is to avoid `MERGE` and use explicit `DELETE + INSERT` or `UPDATE + INSERT` patterns. See [KB2647913](https://support.microsoft.com/kb/2647913).

**Fix procedure**

1. Identify and remove duplicate rows:
```sql
-- Find duplicates
SELECT instrument_isin, score_date, COUNT(*) AS dupe_count
FROM silver.esg_scores
GROUP BY instrument_isin, score_date
HAVING COUNT(*) > 1;

-- Remove duplicates, keeping the row with the highest load_id (most recent)
WITH cte AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY instrument_isin, score_date
                                  ORDER BY load_id DESC) AS rn
    FROM silver.esg_scores
)
DELETE FROM cte WHERE rn > 1;
```

2. Re-run the gold aggregation after deduplication.

3. Add a unique constraint to prevent future duplicates:
```sql
ALTER TABLE silver.esg_scores
ADD CONSTRAINT UQ_esg_scores_isin_date UNIQUE (instrument_isin, score_date);
```

---

## Moderate — Operational Pain

---

### 14. Arithmetic Overflow

**What happens**

A newly indexed mega-cap company has a market capitalization of $3.8 trillion (stored as cents: 380,000,000,000,000). The `bronze.market_cap` table has a `market_cap_usd` column defined as `DECIMAL(18,2)`, which has a maximum value of approximately 999,999,999,999,999.99. This value fits, but a derived calculation multiplying market cap by a constituent weight (e.g., `market_cap_usd * 1.05`) overflows the `DECIMAL(18,2)` intermediate result. SQL Server raises `Error 8115: Arithmetic overflow error converting expression to data type decimal`. The INSERT for the entire calculation batch fails.

**Root cause**

SQL Server arithmetic on `DECIMAL` types uses the combined precision of the operands. Multiplying `DECIMAL(18,2) * DECIMAL(5,4)` produces `DECIMAL(24,6)` intermediate results. If intermediate precision exceeds `DECIMAL(38,x)` (the maximum), or if the result exceeds the target column's precision, an overflow occurs. For financial data where values can be multiplied by weights, scaled, or aggregated across thousands of rows (SUM of market caps), the safe minimum is `DECIMAL(28,6)` or `DECIMAL(38,6)`.

**Consequences**

- Batch INSERT fails; entire calculation result set discarded
- Index weight normalization cannot persist; gold layer stale
- Silent if error handling is not in place — pipeline may log a warning and continue with stale data

**Prevention protocol**

1. Use `DECIMAL(28,6)` for all financial monetary values from day one:
```sql
-- Column definition for financial tables
CREATE TABLE gold.index_weights (
    index_code          VARCHAR(20)     NOT NULL,
    instrument_isin     VARCHAR(12)     NOT NULL,
    weight              DECIMAL(10,8)   NOT NULL,  -- weight: 0.00000001 to 1.00000000
    market_cap_usd      DECIMAL(28,2)   NOT NULL,  -- supports up to $9.9 quadrillion
    nav_contribution    DECIMAL(28,6)   NOT NULL,
    effective_date      DATE            NOT NULL
);
```

2. Use `TRY_CAST` in staging to catch overflow before it propagates:
```python
# In Python pipeline: validate before insert
import pandas as pd

def validate_decimal_range(df: pd.DataFrame, col: str, max_precision: int = 28) -> pd.DataFrame:
    max_val = 10 ** (max_precision - 2) - 0.01
    overflows = df[df[col].abs() > max_val]
    if not overflows.empty:
        logger.error(f"Decimal overflow in {col}: {overflows[[col]].head()}")
    return df[df[col].abs() <= max_val]
```

```sql
-- In T-SQL: safe casting in staging transform
INSERT INTO gold.index_weights (market_cap_usd, nav_contribution)
SELECT
    TRY_CAST(market_cap_raw AS DECIMAL(28,2)),
    TRY_CAST(market_cap_raw * constituent_weight AS DECIMAL(28,6))
FROM bronze.market_cap_stage
WHERE TRY_CAST(market_cap_raw AS DECIMAL(28,2)) IS NOT NULL;  -- silently skip overflows
```

**Fix procedure**

1. Identify the overflowing column and value range:
```sql
SELECT MAX(ABS(market_cap_usd)) AS max_val, MIN(market_cap_usd) AS min_val
FROM bronze.market_cap_stage;
```

2. `ALTER COLUMN` to a wider precision:
```sql
ALTER TABLE bronze.market_cap ALTER COLUMN market_cap_usd DECIMAL(28,2);
ALTER TABLE gold.index_weights ALTER COLUMN market_cap_usd DECIMAL(28,2);
```

3. Re-run the failed calculation batch.

---

### 15. Date/Time Type Confusion

**What happens**

The silver pipeline JOINs `silver.corporate_actions` (with `ex_date DATE`) to `silver.price_history` (with `trade_datetime DATETIME`). The JOIN condition is `ca.ex_date = ph.trade_datetime`. SQL Server implicitly converts `ca.ex_date` to `DATETIME` as `'2026-03-15 00:00:00.000'`. All price rows with `trade_datetime = '2026-03-15 09:30:00.000'` do not match because the time component differs. The JOIN returns zero rows. Corporate actions adjustments are silently skipped, producing incorrect adjusted prices in the gold layer.

**Root cause**

SQL Server has multiple date/time types: `DATE` (date only), `TIME` (time only), `DATETIME` (date + time, 3.33ms precision, 1753 minimum), `DATETIME2` (date + time, 100ns precision, 0001 minimum), `SMALLDATETIME`, `DATETIMEOFFSET`. Implicit conversion between them follows data type precedence. `DATETIME` outranks `DATE`, so `DATE` columns are converted to `DATETIME` with midnight time. JOINs on `DATE = DATETIME` only match rows where the DATETIME has exactly midnight as the time component.

**Consequences**

- Corporate actions adjustments not applied; adjusted prices are wrong
- Dividend reinvestment factors not joined; total return index calculated incorrectly
- ESG event dates not correlated with price dates; event-driven ESG scoring fails
- Silent failure — the query succeeds, the result set is just empty or incomplete

**Prevention protocol**

1. Standardize date/time types across all schemas:
```sql
-- Standard: trade/reference dates use DATE, timestamps use DATETIME2(3)
-- NEVER use: DATETIME (legacy, 1753 minimum, 3.33ms precision)
-- NEVER use: SMALLDATETIME (1 minute precision)

-- Correct column types for financial tables:
CREATE TABLE silver.corporate_actions (
    action_id        INT          NOT NULL IDENTITY,
    instrument_isin  VARCHAR(12)  NOT NULL,
    ex_date          DATE         NOT NULL,   -- business date
    record_date      DATE         NOT NULL,
    pay_date         DATE         NOT NULL,
    load_timestamp   DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE silver.price_history (
    instrument_isin  VARCHAR(12)  NOT NULL,
    trade_date       DATE         NOT NULL,   -- business date (not datetime)
    trade_timestamp  DATETIME2(3) NULL,       -- exchange timestamp when available
    close_price      DECIMAL(18,6) NOT NULL
);
```

2. JOIN on `DATE` to `DATE` after casting, never `DATE` to `DATETIME`:
```sql
-- BAD: implicit conversion, misses non-midnight rows
SELECT * FROM silver.corporate_actions ca
JOIN silver.price_history ph ON ca.ex_date = ph.trade_timestamp;

-- GOOD: cast DATETIME2 to DATE for the join
SELECT * FROM silver.corporate_actions ca
JOIN silver.price_history ph ON ca.ex_date = CAST(ph.trade_timestamp AS DATE);
```

3. Common pitfalls reference:
```sql
-- Pitfall 1: GETDATE() returns DATETIME, not DATE
SELECT CAST(GETDATE() AS DATE) AS today;              -- correct
SELECT GETDATE() AS today;                             -- wrong type for date-only comparisons

-- Pitfall 2: BETWEEN on dates
-- BAD (misses rows on end date after midnight):
WHERE trade_timestamp BETWEEN '2026-01-01' AND '2026-01-31'
-- GOOD:
WHERE trade_date >= '2026-01-01' AND trade_date <= '2026-01-31'  -- if trade_date is DATE
WHERE trade_timestamp >= '2026-01-01' AND trade_timestamp < '2026-02-01'  -- if DATETIME2

-- Pitfall 3: DATEDIFF works differently across types
SELECT DATEDIFF(DAY, '2026-01-01', '2026-01-31 23:59:59');  -- returns 30, not 31
```

**Fix procedure**

1. Identify type mismatches in queries:
```sql
SELECT COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('corporate_actions', 'price_history')
  AND DATA_TYPE IN ('datetime', 'smalldatetime');  -- flag legacy types
```

2. Alter legacy DATETIME columns to DATETIME2 or DATE as appropriate:
```sql
ALTER TABLE silver.price_history ALTER COLUMN trade_datetime DATETIME2(3);
```

---

### 16. TempDB Contention

**What happens**

During the end-of-day gold calculation, 8 parallel Airflow tasks run simultaneously, each executing complex sort+hash join queries. All of them allocate worktables and sort runs in TempDB. The TempDB data file (single file, default configuration) becomes a bottleneck. Wait type `PAGELATCH_UP` on PFS, GAM, and SGAM pages spikes. Queries stall not on I/O or CPU, but on internal TempDB page allocation locks.

**Root cause**

TempDB uses a small number of special system pages (PFS — Page Free Space, GAM — Global Allocation Map, SGAM — Shared GAM) to track page allocations. Under concurrent workloads, all sessions compete to update these pages. SQL Server serializes updates to these pages using latches, creating a bottleneck. The fix is to create multiple TempDB data files — SQL Server round-robins allocations across files, reducing contention on any single file's PFS/GAM pages. Best practice: 1 file per logical CPU core, up to 8 files.

**Consequences**

- Parallel pipeline tasks stall waiting for TempDB page allocations
- Overall pipeline throughput reduced; tasks that should take 4 minutes take 25 minutes
- CPU appears underutilized (threads are waiting on latches, not running)
- TempDB growth under heavy RCSI workload compounds the problem

**Prevention protocol**

1. Check current TempDB configuration:
```sql
SELECT name, physical_name, size * 8 / 1024 AS size_mb,
       max_size * 8 / 1024 AS max_size_mb, growth * 8 / 1024 AS growth_mb
FROM sys.master_files
WHERE database_id = DB_ID('tempdb');

-- Check for PFS/GAM latch contention
SELECT wait_type, waiting_tasks_count, wait_time_ms, signal_wait_time_ms
FROM sys.dm_os_wait_stats
WHERE wait_type = 'PAGELATCH_UP'
ORDER BY wait_time_ms DESC;
```

2. Configure TempDB with multiple equal-sized files (run once, requires restart):
```sql
-- Add TempDB files (on an 8-core machine, add 7 more files)
-- File 1 already exists — modify it
ALTER DATABASE tempdb MODIFY FILE (NAME = tempdev, SIZE = 4096MB, FILEGROWTH = 512MB);

-- Add files 2 through 8
ALTER DATABASE tempdb ADD FILE (NAME = tempdev2, FILENAME = '/var/opt/mssql/data/tempdb2.ndf', SIZE = 4096MB, FILEGROWTH = 512MB);
ALTER DATABASE tempdb ADD FILE (NAME = tempdev3, FILENAME = '/var/opt/mssql/data/tempdb3.ndf', SIZE = 4096MB, FILEGROWTH = 512MB);
ALTER DATABASE tempdb ADD FILE (NAME = tempdev4, FILENAME = '/var/opt/mssql/data/tempdb4.ndf', SIZE = 4096MB, FILEGROWTH = 512MB);
ALTER DATABASE tempdb ADD FILE (NAME = tempdev5, FILENAME = '/var/opt/mssql/data/tempdb5.ndf', SIZE = 4096MB, FILEGROWTH = 512MB);
ALTER DATABASE tempdb ADD FILE (NAME = tempdev6, FILENAME = '/var/opt/mssql/data/tempdb6.ndf', SIZE = 4096MB, FILEGROWTH = 512MB);
ALTER DATABASE tempdb ADD FILE (NAME = tempdev7, FILENAME = '/var/opt/mssql/data/tempdb7.ndf', SIZE = 4096MB, FILEGROWTH = 512MB);
ALTER DATABASE tempdb ADD FILE (NAME = tempdev8, FILENAME = '/var/opt/mssql/data/tempdb8.ndf', SIZE = 4096MB, FILEGROWTH = 512MB);
```

> [!warning] TempDB changes require SQL Server restart
> TempDB file changes take effect after `sudo systemctl restart mssql-server`. Plan a maintenance window.

3. Enable trace flag 1118 (uniform extent allocation, reduces GAM contention):
```bash
# Add to /var/opt/mssql/mssql.conf or SQL Server Agent startup
sqlcmd -S localhost -U sa -P "$SA_PASSWORD" -Q "DBCC TRACEON(1118, -1);"
```

**Fix procedure**

1. Identify TempDB contention:
```sql
SELECT session_id, wait_type, wait_duration_ms, resource_description
FROM sys.dm_os_waiting_tasks
WHERE wait_type = 'PAGELATCH_UP'
  AND resource_description LIKE '2:%';  -- 2 = TempDB file_id
```

2. Add TempDB files per the prevention protocol above and restart SQL Server.

---

### 17. Query Plan Regression After Statistics Update

**What happens**

The weekend maintenance job runs `UPDATE STATISTICS WITH FULLSCAN` on all tables. Monday morning, the gold-layer aggregation stored procedure — which ran in 45 seconds Friday — now runs for 12 minutes. Query Store shows the plan changed from a hash join to a nested-loop join after the statistics update. The new statistics revealed a data skew that caused the optimizer to choose a suboptimal plan for the average case.

**Root cause**

Statistics updates trigger stored procedure recompilation on next execution. The new plan is based on current, accurate statistics. However, accurate statistics can sometimes reveal skew patterns (e.g., one ISIN has 100x more rows than average) that mislead the optimizer into choosing a plan that is optimal for the skewed case but terrible for the average case. This is the inverse of Problem #10: too-fresh statistics can also cause regressions.

**Consequences**

- Monday morning gold calculations delayed; publication SLA at risk
- Performance regression appears after routine maintenance — difficult to diagnose causally
- Manual intervention required to identify and force the correct plan

**Prevention protocol**

1. Enable Query Store automatic plan correction:
```sql
ALTER DATABASE analytics_db
SET AUTOMATIC_TUNING (FORCE_LAST_GOOD_PLAN = ON);
```

2. Before statistics updates in production, test in a dev/staging environment with the same data profile.

3. Force a previously known-good plan via Query Store:
```sql
-- Find the query that regressed
SELECT qsq.query_id, qsp.plan_id, qsp.avg_duration,
       qsp.last_execution_time, qsp.is_forced_plan
FROM sys.query_store_query qsq
JOIN sys.query_store_plan qsp ON qsq.query_id = qsp.query_id
JOIN sys.query_store_query_text qsqt ON qsq.query_text_id = qsqt.query_text_id
WHERE qsqt.query_sql_text LIKE '%usp_calculate_index_nav%'
ORDER BY qsp.last_execution_time DESC;

-- Force the last known-good plan (from before the regression)
EXEC sys.sp_query_store_force_plan @query_id = 15, @plan_id = 3;  -- plan_id 3 = Friday's fast plan
```

**Fix procedure**

1. Identify the regression in Query Store:
```sql
-- Query Store: plans with significant performance change
SELECT qsq.query_id, qsqt.query_sql_text,
       qsp_new.plan_id AS new_plan_id, qsp_new.avg_duration AS new_avg_us,
       qsp_old.plan_id AS old_plan_id, qsp_old.avg_duration AS old_avg_us
FROM sys.query_store_query qsq
JOIN sys.query_store_query_text qsqt ON qsq.query_text_id = qsqt.query_text_id
JOIN sys.query_store_plan qsp_new ON qsq.query_id = qsp_new.query_id
JOIN sys.query_store_plan qsp_old ON qsq.query_id = qsp_old.query_id
WHERE qsp_new.plan_id > qsp_old.plan_id
  AND qsp_new.avg_duration > qsp_old.avg_duration * 3;  -- 3x slower regression threshold
```

2. Force the old plan and verify performance is restored.

3. Investigate why the new statistics caused a regression and consider `OPTIMIZE FOR UNKNOWN` if the data distribution is genuinely bimodal.

---

### 18. MAXDOP Misconfiguration

**What happens**

SQL Server is installed on an n2-standard-8 GCE instance (8 vCPUs). Default `MAXDOP = 0` (use all available cores). The gold aggregation queries correctly use all 8 cores in parallel. However, the silver cleaning pipeline runs 50 small queries (one per index constituent) concurrently. Each small query — which processes 200 rows — goes parallel on 8 threads. The overhead of thread synchronization, exchange operators, and parallelism coordinator exceeds the actual query work. The silver pipeline takes 45 minutes instead of 8 minutes. Meanwhile, the legitimate parallel gold queries are starved for worker threads.

**Root cause**

`MAXDOP = 0` means every query *can* use all CPU cores when the optimizer decides parallelism is beneficial. The optimizer chooses parallelism when the estimated cost exceeds the `cost threshold for parallelism` (default: 5, which is absurdly low). A query with cost 6 on 200 rows goes parallel. The parallelism overhead (thread setup, repartition streams, gather streams) for small queries exceeds the work saved. `MAXDOP` controls the maximum degree, and `cost threshold for parallelism` controls when parallelism is even considered.

**Consequences**

- Small queries use 8 threads instead of 1; worker thread pool depleted
- Large legitimate parallel queries wait for worker threads
- Overall system throughput drops; more CPU cycles spent on parallelism coordination than query work
- Harder to diagnose because CPU usage looks high but useful work is low

**Prevention protocol**

1. Configure MAXDOP and cost threshold based on core count:
```sql
-- For 8 cores: MAXDOP = 4 (half of cores, leave headroom for OS and other processes)
EXEC sp_configure 'show advanced options', 1;
RECONFIGURE;

EXEC sp_configure 'max degree of parallelism', 4;
RECONFIGURE;

-- Raise cost threshold for parallelism to avoid trivially going parallel
EXEC sp_configure 'cost threshold for parallelism', 50;  -- default is 5; 50 is more realistic
RECONFIGURE;

-- Verify
EXEC sp_configure 'max degree of parallelism';
EXEC sp_configure 'cost threshold for parallelism';
```

2. For specific small queries, override with `OPTION(MAXDOP 1)`:
```sql
-- Force serial execution for known-small queries
SELECT ic.instrument_isin, ic.weight
FROM silver.index_constituents ic
WHERE ic.index_code = @index_code
OPTION(MAXDOP 1);
```

3. Monitor parallelism wait types:
```sql
SELECT wait_type, waiting_tasks_count, wait_time_ms
FROM sys.dm_os_wait_stats
WHERE wait_type IN ('CXPACKET', 'CXCONSUMER', 'EXCHANGE')
ORDER BY wait_time_ms DESC;
```

> [!warning] CXPACKET waits
> High `CXPACKET` waits indicate parallelism skew (one thread finishes, others wait). This is a symptom of bad MAXDOP or CTFP settings. Raising cost threshold for parallelism is usually the correct fix — not blindly setting MAXDOP 1.

**Fix procedure**

1. Apply the `sp_configure` changes above.

2. `RECONFIGURE` takes effect immediately; no restart needed for these settings.

---

### 19. Orphaned Transactions

**What happens**

A Python pipeline task starts a transaction (`BEGIN TRANSACTION` via `conn.autocommit = False`), inserts 10,000 rows into `bronze.price_history`, and then crashes due to a network error before committing. The Python process exits, but the TDS connection is in a half-closed state — SQL Server has not received a clean disconnect signal. The transaction remains open. 4 hours later, the silver transform task is blocked by the orphaned transaction holding exclusive locks on the bronze table.

**Root cause**

When a SQL Server client connection drops ungracefully (process killed, network failure), SQL Server may not immediately detect the disconnect. The TCP keepalive interval determines how long it takes. During this window, the open transaction and its locks persist. SQL Server's session cleanup eventually terminates the zombie session, but this can take minutes to hours depending on network keepalive settings and connection pooling behavior.

**Consequences**

- Shared and exclusive locks held by the orphaned transaction block all subsequent pipeline tasks
- The blocking chain (see Problem #9) can cascade to dozens of waiting sessions
- No visible error in the Airflow logs — tasks simply hang until lock timeout

**Prevention protocol**

1. Set `XACT_ABORT ON` in all stored procedures (automatic rollback on error):
```sql
CREATE OR ALTER PROCEDURE usp_load_bronze_prices AS
BEGIN
    SET XACT_ABORT ON;  -- any error automatically rolls back the transaction
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
        INSERT INTO bronze.price_history ...;
        UPDATE bronze.load_log SET status = 'LOADED' ...;
    COMMIT;
END;
```

2. Set connection timeout in pyodbc to detect dead connections:
```python
conn_str = (
    "DRIVER={ODBC Driver 18 for SQL Server};"
    "SERVER=localhost;DATABASE=analytics_db;"
    f"UID=sa;PWD={SA_PASSWORD};"
    "TrustServerCertificate=yes;"
    "Connect Timeout=30;"      # fail connection if server unreachable for 30s
    "LoginTimeout=30;"
)
```

3. Configure SQL Server keepalive settings:
```bash
# In /var/opt/mssql/mssql.conf
# These settings reduce the time SQL Server detects a dead TCP connection
echo "[network]" >> /var/opt/mssql/mssql.conf
echo "tcpkeepaliveinterval = 30" >> /var/opt/mssql/mssql.conf
```

**Fix procedure**

1. Find orphaned transactions:
```sql
DBCC OPENTRAN('analytics_db');

-- More detail: sessions with open transactions but no active request
SELECT s.session_id, s.login_name, s.host_name, s.program_name,
       s.open_transaction_count, s.status, s.last_request_start_time,
       t.transaction_begin_time
FROM sys.dm_exec_sessions s
JOIN sys.dm_tran_session_transactions tst ON s.session_id = tst.session_id
JOIN sys.dm_tran_active_transactions t ON tst.transaction_id = t.transaction_id
WHERE s.open_transaction_count > 0
  AND s.status = 'sleeping';  -- sleeping = client not currently executing
```

2. Kill the orphaned session:
```sql
KILL 62;  -- replace with actual session_id
```

---

### 20. Collation Mismatch

**What happens**

The server default collation is `Latin1_General_CI_AS`. A developer creates a temp table without specifying collation: `CREATE TABLE #stage (instrument_isin VARCHAR(12))`. The temp table inherits `tempdb`'s collation, which is `SQL_Latin1_General_CP1_CI_AS` (set during initial SQL Server installation). A JOIN between `#stage.instrument_isin` and `silver.index_constituents.instrument_isin` fails with `Cannot resolve the collation conflict between "SQL_Latin1_General_CP1_CI_AS" and "Latin1_General_CI_AS" in the equal to operation`.

**Root cause**

Every string column in SQL Server has a collation that controls sort order, case sensitivity, and accent sensitivity. When two columns with different collations are compared, SQL Server cannot implicitly resolve the conflict and raises an error. `tempdb` collation is set at SQL Server installation time and cannot be easily changed. If `tempdb` collation differs from user database collation, any temp table created without explicit `COLLATE` will cause this error.

**Consequences**

- ETL queries using temp tables fail; pipeline aborts
- Difficult to reproduce in dev if dev instance has matching collations
- Affects all string JOINs between temp tables and permanent tables
- The error message is clear but the fix is non-obvious for developers unfamiliar with collations

**Prevention protocol**

1. Always specify `COLLATE DATABASE_DEFAULT` on temp table string columns:
```sql
CREATE TABLE #esg_stage (
    instrument_isin     VARCHAR(12) COLLATE DATABASE_DEFAULT NOT NULL,
    score_date          DATE        NOT NULL,
    composite_score     DECIMAL(6,4) NOT NULL
);
```

2. Check current collation settings:
```sql
-- Server collation
SELECT SERVERPROPERTY('Collation') AS server_collation;

-- Database collation
SELECT name, collation_name FROM sys.databases WHERE name IN ('analytics_db', 'tempdb');

-- Column-level collations
SELECT TABLE_NAME, COLUMN_NAME, COLLATION_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA IN ('silver', 'gold')
  AND DATA_TYPE IN ('varchar', 'nvarchar', 'char', 'nchar')
ORDER BY TABLE_NAME, COLUMN_NAME;
```

3. Standardize the server collation at install time:
```bash
# During SQL Server for Linux initial setup
sudo /opt/mssql/bin/mssql-conf set-collation
# Choose: Latin1_General_CI_AS (or SQL_Latin1_General_CP1_CI_AS consistently)
```

**Fix procedure**

1. Add `COLLATE DATABASE_DEFAULT` to the failing temp table column:
```sql
-- Quick fix: add COLLATE clause to the temp table definition
CREATE TABLE #stage (
    instrument_isin VARCHAR(12) COLLATE DATABASE_DEFAULT NOT NULL
);
```

2. Alternatively, use explicit COLLATE in the JOIN:
```sql
SELECT * FROM #stage s
JOIN silver.index_constituents ic
    ON s.instrument_isin COLLATE Latin1_General_CI_AS = ic.instrument_isin;
```

---

## Low — Annoyances / Technical Debt

---

### 21. SELECT * in Production Queries

**What happens**

A silver-to-gold aggregation query uses `SELECT * FROM silver.esg_scores` to feed a downstream calculation. The `silver.esg_scores` table has 15 columns, including 4 large `NVARCHAR(MAX)` description columns used only for reporting. The query reads 15 columns but uses 5. Unnecessary I/O consumes buffer pool pages; the extra columns are transmitted over the network to the application. When a developer adds a new `xml_metadata` column to `silver.esg_scores`, the downstream `SELECT *` query suddenly returns an unexpected column, breaking the Dapper mapping in the C# API.

**Root cause**

`SELECT *` is evaluated at runtime against the current table schema. It couples the query to the schema, breaks when columns are added or reordered, returns unnecessary data, prevents covering index usage, and bloats execution plan memory grants. It is technically valid SQL but universally considered harmful in production code.

**Consequences**

- Excess I/O from wide selects (especially with LOB columns)
- Buffer pool polluted with unnecessary column data
- Dapper/ORM mapping breaks when columns are added
- Covering index cannot be used (the index covers 3 columns; `SELECT *` needs 15)

**Prevention protocol**

1. Enforce `sqlfluff` linting in the CI pipeline:
```yaml
# .sqlfluff (sqlfluff configuration)
[sqlfluff]
dialect = tsql
rules = L004,L010,L028,L034,AM04  # AM04: no SELECT *

# In CI (GitHub Actions or similar)
- name: Lint SQL
  run: sqlfluff lint sql/ --dialect tsql --rules AM04
```

2. Code review rule: all production SQL must list explicit columns. No exceptions for INSERT/SELECT either — always list target columns.

3. Alias all columns in complex queries for documentation:
```sql
-- Good practice: explicit, documented column list
SELECT
    es.instrument_isin,
    es.score_date,
    es.environmental_score,
    es.social_score,
    es.governance_score,
    es.composite_score
FROM silver.esg_scores es
WHERE es.score_date = @calculation_date;
```

**Fix procedure**

1. Audit existing stored procedures and views for `SELECT *`:
```sql
SELECT OBJECT_NAME(object_id) AS object_name, definition
FROM sys.sql_modules
WHERE definition LIKE '%SELECT *%'
   OR definition LIKE '%SELECT%\*%' ESCAPE '\';
```

2. Replace each `SELECT *` with explicit column lists and redeploy.

---

### 22. No Query Store Enabled

**What happens**

A pipeline performance regression is reported: the index constituent load that ran in 3 minutes last week now takes 20 minutes. Without Query Store, there is no execution history, no plan change record, and no way to determine when or why the plan changed. The team spends 4 hours investigating with no conclusive answer. The incident is closed as "unclear." Two weeks later, it happens again.

**Root cause**

Query Store is an opt-in feature that captures query execution statistics and plan history directly inside the database. Without it, the only post-hoc performance data available is the live `sys.dm_exec_query_stats` DMV — which is flushed on SQL Server restart and does not retain plan history across plan changes. Query Store is the essential foundation for any production performance investigation.

**Prevention protocol**

1. Enable Query Store on all user databases from day one:
```sql
ALTER DATABASE analytics_db SET QUERY_STORE = ON;
ALTER DATABASE analytics_db SET QUERY_STORE (
    OPERATION_MODE = READ_WRITE,
    DATA_FLUSH_INTERVAL_SECONDS = 900,       -- flush to disk every 15 min
    INTERVAL_LENGTH_MINUTES = 60,            -- aggregation interval: 1 hour
    MAX_STORAGE_SIZE_MB = 2048,              -- 2 GB for query store data
    QUERY_CAPTURE_MODE = AUTO,               -- only capture queries with meaningful impact
    SIZE_BASED_CLEANUP_MODE = AUTO,          -- auto-cleanup when space fills
    STALE_QUERY_THRESHOLD_DAYS = 30,         -- retain 30 days of history
    WAIT_STATS_CAPTURE_MODE = ON             -- also capture wait stats per query
);

-- Verify
SELECT actual_state_desc, desired_state_desc, current_storage_size_mb,
       max_storage_size_mb, query_capture_mode_desc
FROM sys.database_query_store_options;
```

2. Enable automatic plan correction:
```sql
ALTER DATABASE analytics_db
SET AUTOMATIC_TUNING (FORCE_LAST_GOOD_PLAN = ON);
```

**Fix procedure**

Enable Query Store per the prevention steps above. No data retroactively becomes available — historical data is only captured going forward from the moment it is enabled.

---

### 23. Cursor-Based Logic Instead of Set-Based

**What happens**

A developer implements index constituent weight normalization using a `DECLARE CURSOR` loop: for each of 3,000 constituents, execute a `SELECT`, calculate the normalized weight in Python/T-SQL, then execute an `UPDATE`. This runs 3,000 individual round-trips. The normalization job takes 45 minutes. The same logic written as a set-based window function query runs in 8 seconds.

**Root cause**

SQL Server is optimized for set-based operations. Row-by-row cursor processing defeats the query optimizer, bypasses bulk I/O optimizations, and generates 3,000 individual lock/unlock cycles instead of one. The TDS round-trip overhead alone (client-server for each row in a Python loop) compounds the problem. T-SQL cursors inside stored procedures avoid the network round-trip but still process row-by-row, preventing parallelism.

**Consequences**

- 45 minutes of wall-clock time for a 8-second operation
- Holds locks on tables for the entire cursor duration, creating blocking for concurrent sessions
- CPU underutilized (single-threaded, sequential execution)
- Silver-to-gold calculation delayed; publication SLA at risk

**Prevention protocol**

1. Replace cursor logic with window functions — the canonical example:
```sql
-- BAD: cursor approach (row-by-row weight normalization)
DECLARE @isin VARCHAR(12), @weight DECIMAL(10,8), @total DECIMAL(10,8);
DECLARE weight_cursor CURSOR FOR
    SELECT instrument_isin, raw_weight FROM gold.index_weights WHERE index_code = @index_code;
OPEN weight_cursor;
FETCH NEXT FROM weight_cursor INTO @isin, @weight;
WHILE @@FETCH_STATUS = 0
BEGIN
    SELECT @total = SUM(raw_weight) FROM gold.index_weights WHERE index_code = @index_code;
    UPDATE gold.index_weights SET normalized_weight = @weight / @total
    WHERE instrument_isin = @isin AND index_code = @index_code;
    FETCH NEXT FROM weight_cursor INTO @isin, @weight;
END;
CLOSE weight_cursor; DEALLOCATE weight_cursor;

-- GOOD: set-based window function (same result, runs in milliseconds)
UPDATE iw
SET normalized_weight = iw.raw_weight / weight_totals.total_weight
FROM gold.index_weights iw
JOIN (
    SELECT index_code, SUM(raw_weight) AS total_weight
    FROM gold.index_weights
    WHERE index_code = @index_code
    GROUP BY index_code
) weight_totals ON iw.index_code = weight_totals.index_code
WHERE iw.index_code = @index_code;

-- EVEN BETTER: using window function directly
UPDATE gold.index_weights
SET normalized_weight = raw_weight / SUM(raw_weight) OVER (PARTITION BY index_code)
WHERE index_code = @index_code;
```

2. Enforce as a code review standard. Use `sqlfluff` or SQL Server Extended Events to flag cursor usage in stored procedures.

**Fix procedure**

Replace the cursor with the equivalent set-based query. For running totals, use `SUM() OVER`, `LAG()`, `LEAD()`. For rank-based operations, use `ROW_NUMBER()`, `RANK()`, `DENSE_RANK()`. For gap-filling, use recursive CTEs.

---

### 24. Missing Error Handling in Stored Procedures

**What happens**

The stored procedure `usp_load_gold_index_weights` inserts calculated weights and then updates a `load_audit` table. The INSERT succeeds, but the UPDATE fails due to a FK violation. Without `TRY/CATCH` or `XACT_ABORT`, the INSERT is committed and the UPDATE error is silently swallowed by the calling Python code (which only checks `@@ERROR` implicitly). The gold table has new weights, but the audit table is out of sync. The next reconciliation check fails, and the engineering team spends hours tracing the inconsistency.

**Root cause**

Without `SET XACT_ABORT ON`, a runtime error inside a stored procedure (constraint violation, conversion error, etc.) does not automatically roll back the transaction. The transaction remains open at the point of the error; subsequent statements may or may not execute depending on the error severity. Without a `TRY/CATCH` block, the calling code receives the error but may have already committed partial changes. This leaves the database in an inconsistent intermediate state.

**Prevention protocol**

1. Mandatory stored procedure template — enforce via code review:
```sql
CREATE OR ALTER PROCEDURE usp_load_gold_index_weights
    @index_code    VARCHAR(20),
    @effective_date DATE
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;  -- any error = automatic full rollback

    BEGIN TRY
        BEGIN TRANSACTION;

            -- Step 1: Delete existing weights for this index/date (idempotent load)
            DELETE FROM gold.index_weights
            WHERE index_code = @index_code AND effective_date = @effective_date;

            -- Step 2: Insert calculated weights from silver
            INSERT INTO gold.index_weights (index_code, instrument_isin, weight,
                                            market_cap_usd, effective_date)
            SELECT @index_code, ic.instrument_isin,
                   ic.raw_weight / SUM(ic.raw_weight) OVER (PARTITION BY ic.index_code),
                   mc.market_cap_usd,
                   @effective_date
            FROM silver.index_constituents ic
            JOIN silver.market_cap mc
                ON ic.instrument_isin = mc.instrument_isin
               AND mc.price_date = @effective_date
            WHERE ic.index_code = @index_code AND ic.effective_date = @effective_date;

            -- Step 3: Audit log
            INSERT INTO dbo.load_audit (load_type, entity_code, effective_date,
                                         rows_loaded, load_timestamp)
            VALUES ('GOLD_INDEX_WEIGHTS', @index_code, @effective_date,
                    @@ROWCOUNT, SYSUTCDATETIME());

        COMMIT;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;

        -- Re-raise with context
        THROW;  -- preserves original error number, severity, state
        -- Alternative: RAISERROR with custom message
    END CATCH;
END;
```

2. Python pipeline: always check for exceptions and do not swallow errors:
```python
try:
    with pyodbc.connect(CONN_STR, autocommit=False) as conn:
        conn.execute("{CALL usp_load_gold_index_weights(?, ?)}", (index_code, effective_date))
        conn.commit()
except pyodbc.Error as e:
    logger.error(f"Failed to load gold weights for {index_code}/{effective_date}: {e}")
    raise  # let Airflow mark the task as failed
```

**Fix procedure**

1. Identify stored procedures without error handling:
```sql
SELECT OBJECT_NAME(object_id) AS proc_name, definition
FROM sys.sql_modules
WHERE objectproperty(object_id, 'IsProcedure') = 1
  AND definition NOT LIKE '%TRY%'
ORDER BY OBJECT_NAME(object_id);
```

2. Remediate each procedure by adding `SET XACT_ABORT ON` + `TRY/CATCH` per the template above.

3. Test each remediated procedure with deliberate failures (wrong FK value, type mismatch) to confirm rollback behavior.

---

### 25. SQL Server on Linux Gotchas

**What happens**

After the SQL Server Linux instance is patched via `apt upgrade`, the `mssql-server` service starts but SQL Server cannot write to `/var/opt/mssql/data/`. The backup script also fails because the backup directory `/data/mssql/backups/` is owned by `root`, not the `mssql` service account. A developer connects via the domain Windows account from their laptop — and gets `Login failed for user ''` because Kerberos authentication is not configured on Linux. Meanwhile, a query that works on the Windows dev instance fails on Linux because the Linux filesystem is case-sensitive for file paths.

**Root cause**

SQL Server on Linux runs as the `mssql` system user (UID 10001 by default). File system paths for data files, log files, backup directories, and certificate files must be owned by `mssql:mssql` with appropriate permissions. Windows authentication (Active Directory / Kerberos) requires explicit Kerberos configuration on Linux — it is not automatic. The Linux filesystem (ext4) is case-sensitive; SQL Server itself is case-insensitive (controlled by collation), but paths in `BACKUP DATABASE TO DISK=` and file references must match the exact case on the filesystem.

**Consequences**

- SQL Server fails to start or write data files after directory permission changes
- Backup jobs fail silently if the backup directory lacks write permissions for `mssql`
- Windows/AD authentication not available; all connections require SQL auth (sa or SQL login)
- Certificate and backup path errors that do not occur on Windows instances

**Prevention protocol**

1. Set correct ownership and permissions for all SQL Server directories:
```bash
# Data and log files
sudo chown -R mssql:mssql /var/opt/mssql/
sudo chmod -R 770 /var/opt/mssql/

# Custom backup directory
sudo mkdir -p /data/mssql/backups
sudo chown -R mssql:mssql /data/mssql/
sudo chmod -R 770 /data/mssql/

# Verify
ls -la /var/opt/mssql/data/
ls -la /data/mssql/backups/
```

2. Manage SQL Server as a systemd service:
```bash
# Start, stop, restart, status
sudo systemctl start mssql-server
sudo systemctl stop mssql-server
sudo systemctl restart mssql-server
sudo systemctl status mssql-server

# View error log (equivalent to SQL Server error log on Windows)
sudo cat /var/opt/mssql/log/errorlog
sudo tail -f /var/opt/mssql/log/errorlog  # live monitoring

# Check if service is enabled at boot
sudo systemctl is-enabled mssql-server
sudo systemctl enable mssql-server
```

3. Configure SQL Server settings on Linux (mssql-conf):
```bash
# Set SA password (initial setup)
sudo /opt/mssql/bin/mssql-conf set-sa-password

# Set memory limit (important on GCE — leave headroom for OS)
sudo /opt/mssql/bin/mssql-conf set memory.memorylimitmb 28672  # 28 GB on 32 GB VM

# View current configuration
sudo cat /var/opt/mssql/mssql.conf

# Set default data and log directories
sudo /opt/mssql/bin/mssql-conf set filelocation.defaultdatadir /data/mssql/data
sudo /opt/mssql/bin/mssql-conf set filelocation.defaultlogdir /data/mssql/log
sudo /opt/mssql/bin/mssql-conf set filelocation.defaultbackupdir /data/mssql/backups
```

4. Linux-specific path and case-sensitivity gotchas:
```bash
# File paths in T-SQL must use exact case matching the Linux filesystem
# BAD: BACKUP TO DISK = '/var/opt/MSSQL/backups/...'  -- fails on Linux
# GOOD: BACKUP TO DISK = '/var/opt/mssql/backups/...' -- exact case

# Check ODBC driver is installed correctly
odbcinst -q -d -n "ODBC Driver 18 for SQL Server"
cat /etc/odbcinst.ini

# Test connectivity from Python
python3 -c "
import pyodbc
conn = pyodbc.connect('DRIVER={ODBC Driver 18 for SQL Server};SERVER=localhost;DATABASE=analytics_db;UID=sa;PWD=YourPassword;TrustServerCertificate=yes;')
print('Connected:', conn.getinfo(pyodbc.SQL_SERVER_NAME))
conn.close()
"
```

5. Use SQL authentication (not Windows auth) for all pipeline connections:
```python
# pyodbc connection string for Linux SQL Server (no Windows auth)
CONN_STR = (
    "DRIVER={ODBC Driver 18 for SQL Server};"
    "SERVER=10.0.0.5,1433;"          # use IP or internal DNS, not Windows hostname
    "DATABASE=analytics_db;"
    "UID=pipeline_svc;"              # dedicated service account, not sa
    f"PWD={os.environ['DB_PASSWORD']};"
    "TrustServerCertificate=yes;"    # required if not using proper TLS cert
    "Encrypt=yes;"
)
```

**Fix procedure**

1. If SQL Server fails to start after a permission change:
```bash
# Reset permissions
sudo chown -R mssql:mssql /var/opt/mssql/
sudo chmod -R 770 /var/opt/mssql/
sudo systemctl restart mssql-server
sudo systemctl status mssql-server

# Check error log for specific errors
sudo tail -50 /var/opt/mssql/log/errorlog
```

2. If backup fails with access denied:
```bash
sudo chown mssql:mssql /data/mssql/backups/
sudo chmod 770 /data/mssql/backups/
# Test: run a manual backup as the mssql service user
sudo -u mssql sqlcmd -S localhost -U sa -P "$SA_PASSWORD" -Q "BACKUP DATABASE analytics_db TO DISK = '/data/mssql/backups/test.bak';"
```

3. If SQL Server process is consuming too much memory and being OOM-killed:
```bash
# Check if SQL Server was killed
sudo journalctl -u mssql-server --since "1 hour ago"
# Set memory limit via mssql-conf
sudo /opt/mssql/bin/mssql-conf set memory.memorylimitmb 24576  # 24 GB
sudo systemctl restart mssql-server
```

---

## Related

- [[wait-stats-analysis]] — Wait type diagnosis
- [[memory-and-buffer-pool]] — Memory pressure diagnosis
- [[execution-plans]] — Reading execution plans
- [[query-plan-analysis]] — Query Store and plan forcing
- [[deadlock-detection-and-prevention]] — Deadlock deep dive
- [[blocking-and-locking]] — Blocking chain analysis
- [[index-maintenance]] — Fragmentation management
- [[backup-types-and-strategy]] — Backup configuration
- [[sql-server-disk-full]] — Disk full runbook
- [[on-call-guide]] — Incident response framework

---

## Sources

- SQL Server Performance Tuning Checklist 2026 (SQLYARD)
- 10 SQL Server Performance Killers (DEV Community)
- SQL Server Deadlocks by Example (Red Gate)
- Implicit Conversions (Brent Ozar)
- Ola Hallengren Index and Statistics Maintenance
- SQL Server Memory Troubleshooting (Microsoft Learn)
- String or Binary Data Truncated (Brent Ozar)
