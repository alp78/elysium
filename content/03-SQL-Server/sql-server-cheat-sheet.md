---
type: reference
category: reference
technology: [sql-server]
tags: [reference, cheat-sheet, sql-server, t-sql]
aliases: [SQL Server cheat sheet, T-SQL quick reference, sqlcmd cheat sheet]
keywords: [sql server, cheat sheet, quick reference, sqlcmd, backup, restore, performance, blocking, deadlock, index, wait stats]
description: "Quick reference cheat sheet for SQL Server administration — sqlcmd connection, backup/restore, performance diagnostics, blocking detection, and index maintenance."
related:
  - "[[sqlcmd-connection-and-usage]]"
  - "[[essential-dba-queries]]"
  - "[[backup-types-and-strategy]]"
  - "[[wait-stats-analysis]]"
  - "[[index-maintenance]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# SQL Server Cheat Sheet

Quick reference for the most critical SQL Server commands. Follow wikilinks for full explanations.

## Connection

```bash
# sqlcmd connection via IAP tunnel
sqlcmd -S localhost,1433 -U sa -P "$DB_PASS" -d data-pipeline -C
```

See [[sqlcmd-connection-and-usage]].

## Essential DBA Queries

```sql
-- Server version
SELECT @@VERSION;

-- Database sizes
SELECT name, size * 8 / 1024 AS size_mb FROM sys.master_files ORDER BY size DESC;

-- Active connections
SELECT DB_NAME(dbid) AS db, COUNT(*) AS connections FROM sys.sysprocesses GROUP BY dbid ORDER BY connections DESC;

-- Currently running queries
SELECT r.session_id, r.status, r.wait_type, r.cpu_time, t.text
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
WHERE r.session_id > 50;

-- Blocking chains
SELECT blocking_session_id AS blocker, session_id AS blocked, wait_type, wait_time
FROM sys.dm_exec_requests WHERE blocking_session_id > 0;
```

See [[essential-dba-queries]].

## Backup and Restore

```sql
-- Full backup with compression
BACKUP DATABASE data-pipeline TO DISK = '/var/opt/mssql/backup/mydb_full.bak' WITH COMPRESSION, INIT;

-- Transaction log backup
BACKUP LOG data-pipeline TO DISK = '/var/opt/mssql/backup/mydb_log.trn' WITH COMPRESSION;

-- Restore (full)
RESTORE DATABASE data-pipeline FROM DISK = '/var/opt/mssql/backup/mydb_full.bak' WITH REPLACE, RECOVERY;
```

See [[backup-types-and-strategy]] and [[restore-and-recovery]].

## Performance Diagnostics

```sql
-- Top 5 wait types
SELECT TOP 5 wait_type, wait_time_ms / 1000 AS wait_sec
FROM sys.dm_os_wait_stats
WHERE wait_type NOT IN ('SLEEP_TASK','LAZYWRITER_SLEEP','BROKER_TO_FLUSH')
ORDER BY wait_time_ms DESC;

-- Page Life Expectancy (target: >300)
SELECT cntr_value AS PLE FROM sys.dm_os_performance_counters
WHERE counter_name = 'Page life expectancy' AND object_name LIKE '%Buffer Manager%';

-- I/O latency per file
SELECT DB_NAME(database_id) AS db, file_id,
  io_stall_read_ms / NULLIF(num_of_reads, 0) AS avg_read_ms,
  io_stall_write_ms / NULLIF(num_of_writes, 0) AS avg_write_ms
FROM sys.dm_io_virtual_file_stats(NULL, NULL);
```

See [[wait-stats-analysis]], [[memory-and-buffer-pool]], [[performance-audit-playbook]].

## Index Maintenance

```sql
-- Check fragmentation
SELECT object_name(ips.object_id) AS table_name, i.name AS index_name,
  ips.avg_fragmentation_in_percent
FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
WHERE ips.avg_fragmentation_in_percent > 10;

-- Rebuild (>30% fragmentation)
ALTER INDEX idx_name ON schema.table REBUILD;

-- Reorganize (10-30% fragmentation)
ALTER INDEX idx_name ON schema.table REORGANIZE;

-- Update statistics after bulk load
UPDATE STATISTICS schema.table;
```

See [[index-maintenance]] and [[index-types-and-strategy]].
