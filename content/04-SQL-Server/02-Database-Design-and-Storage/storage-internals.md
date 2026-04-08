---
title: "Storage Internals"
tags: [sql, sql-server, storage, tsql]
aliases: [SQL Server pages, extents, WAL, write-ahead logging, VLF, forwarding records, page splits, tempdb internals]
description: "Production guide to SQL Server storage internals: file layout, 8 KB pages, write-ahead logging, log and VLF health, heap forwarding records, page splits, and tempdb behavior, grounded in live stoxx output."
parent: "[[domain-database-design-and-storage]]"
links:
  - "[[index-types-and-strategy]]"
  - "[[table-compression]]"
  - "[[partitioning-strategies]]"
  - "[[index-maintenance]]"
  - "[[memory-and-buffer-pool]]"
created: 2026-03-22
updated: 2026-04-08
status: complete
---

# Storage Internals

Storage internals explain why the same SQL text can behave very differently depending on table structure, page density, log pressure, and allocation patterns. The production questions are concrete:

- where the database is growing
- how pages are laid out
- whether the log is healthy
- whether heaps are generating forwarded rows
- whether updates are forcing page splits
- whether `tempdb` is absorbing versioning or spill pressure

## Core Model

| Unit | Size | What it means operationally |
|---|---:|---|
| Page | 8 KB | SQL Server reads and writes disk-based rowstore data one page at a time. |
| Extent | 64 KB | An extent is 8 contiguous pages and is the basic space-allocation unit. |
| Data file | Variable | Stores data pages, index pages, IAM pages, allocation maps, and metadata. |
| Log file | Variable | Stores the sequential transaction log that guarantees durability. |
| VLF | Variable | A virtual log file is an internal slice of the log file used for reuse and recovery. |

## Inspect The Current File Layout

### `sys.database_files` | verify how the database is physically configured

> [!info]-
> This query inspects the physical files that make up the current database.
>
> - `sys.database_files` returns one row per database file in the current database.
> - `file_id` is the stable file identifier used by many low-level DMVs and DBCC commands.
> - `type_desc` distinguishes row/data files from log files.
> - `physical_name` shows the actual Linux path used by this SQL Server instance.
> - `size / 128.0` converts the file size from 8 KB pages to megabytes.
> - `max_size` is converted into a readable form. `-1` means unlimited growth.
> - `growth` is normalized so the output clearly shows whether growth is in fixed MB increments or percentages.
> - `is_percent_growth` is important operationally because percent growth becomes increasingly expensive and unpredictable as the file grows.
>
```sql
SELECT
    file_id,
    name,
    type_desc,
    physical_name,
    CAST(size / 128.0 AS decimal(18,2)) AS size_mb,
    CASE max_size WHEN -1 THEN 'UNLIMITED' ELSE CAST(CAST(max_size / 128.0 AS decimal(18,2)) AS varchar(30)) END AS max_size_mb,
    CASE is_percent_growth WHEN 1 THEN CAST(growth AS varchar(20)) + '%'
         ELSE CAST(CAST(growth / 128.0 AS decimal(18,2)) AS varchar(30)) + ' MB'
    END AS growth_setting,
    is_percent_growth
FROM sys.database_files
ORDER BY file_id;
```

| file_id | name | type_desc | physical_name | size_mb | max_size_mb | growth_setting | is_percent_growth |
|---:|---|---|---|---:|---|---|---:|
| 1 | stoxx | ROWS | /var/opt/mssql/data/stoxx.mdf | 712.00 | UNLIMITED | 64.00 MB | 0 |
| 2 | stoxx_log | LOG | /var/opt/mssql/data/stoxx_log.ldf | 968.00 | 2097152.00 | 64.00 MB | 0 |

*The database currently has one data file and one log file, both growing in fixed 64 MB increments. Fixed growth is preferable to percentage growth because it keeps growth behavior predictable. The main production concern in this output is that the data file is allowed to grow without a defined cap; unlimited growth is easy to forget until the underlying volume becomes the real limit.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `type_desc` | `ROWS` | &#9989; | Main data file. | Stores tables, indexes, and allocation structures. |
| `type_desc` | `LOG` | &#9989; | Transaction log file. | Governs durability, recovery, and log reuse. |
| `max_size_mb` | `UNLIMITED` | &#10060; | SQL Server can keep growing the file until the volume runs out. | Convenient in a lab, risky in production without external disk controls. |
| `is_percent_growth` | `0` | &#9989; | Growth uses a fixed increment. | Predictable growth events and easier capacity planning. |
| `is_percent_growth` | `1` | &#10060; | Growth uses a percentage of current size. | Growth events become larger and less predictable over time. |

## Inspect A Real Data Page

### `sys.dm_db_database_page_allocations` + `sys.dm_db_page_info` | inspect one live data page

> [!info]-
> This batch finds one real data page from `silver.eurostoxx50_ohlcv` and then inspects the page header metadata.
>
> - `sys.dm_db_database_page_allocations` returns the pages allocated to an object.
> - `OBJECT_ID(N'silver.eurostoxx50_ohlcv')` targets a real production table instead of a synthetic object.
> - `WHERE page_type_desc = 'DATA_PAGE'` excludes IAM and allocation-map pages and keeps only pages that actually hold rows.
> - The first `SELECT` captures the `file_id` and `page_id` of one real row-bearing page.
> - `sys.dm_db_page_info` then reads the page header and surrounding linkage information for that exact page.
> - `page_level = 0` means this is a leaf-level page, not an internal B-tree branch page.
> - `slot_count` is the number of row slots on the page.
> - `free_bytes` shows how much free space remains on that page at capture time.
>
```sql
DECLARE @file_id int, @page_id int;

SELECT TOP (1)
    @file_id = allocated_page_file_id,
    @page_id = allocated_page_page_id
FROM sys.dm_db_database_page_allocations(DB_ID(), OBJECT_ID(N'silver.eurostoxx50_ohlcv'), 1, NULL, 'DETAILED')
WHERE page_type_desc = 'DATA_PAGE'
ORDER BY allocated_page_file_id, allocated_page_page_id;

SELECT
    file_id,
    page_id,
    page_type_desc,
    page_level,
    object_id,
    index_id,
    is_mixed_extent,
    has_ghost_records,
    prev_page_file_id,
    prev_page_page_id,
    next_page_file_id,
    next_page_page_id,
    slot_count,
    free_bytes,
    fixed_length
FROM sys.dm_db_page_info(DB_ID(), @file_id, @page_id, 'DETAILED');
```

| file_id | page_id | page_type_desc | page_level | object_id | index_id | is_mixed_extent | has_ghost_records | prev_page_file_id | prev_page_page_id | next_page_file_id | next_page_page_id | slot_count | free_bytes | fixed_length |
|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 2336 | DATA_PAGE | 0 | 1493580359 | 1 | 0 | 0 | 1 | 3295 | 1 | 2337 | 88 | 8 | 76 |

*This is a real leaf data page from the clustered index of `silver.eurostoxx50_ohlcv`. It is in file 1, linked to neighboring pages on both sides, contains 88 row slots, and has only 8 free bytes left. That is the physical reality behind a clustered-index scan or seek: the engine is traversing linked 8 KB pages like this one.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `page_type_desc` | `DATA_PAGE` | &#9989; | A normal row-bearing data page. | This is the page type most rowstore queries ultimately read. |
| `page_level` | `0` | &#9989; | Leaf level. | This is where the actual clustered rows live. |
| `page_level` | `> 0` | &#9989; | Internal index level. | The page is part of B-tree navigation, not the final row payload. |
| `is_mixed_extent` | `0` | &#9989; | The page is in a uniform extent. | Normal for established objects on modern SQL Server builds. |
| `is_mixed_extent` | `1` | ⚠ | The page is in a mixed extent. | More common on very small objects or special allocation cases. |
| `has_ghost_records` | `0` | &#9989; | No ghosted rows on the page right now. | Nothing on this page is waiting for deferred cleanup. |
| `has_ghost_records` | `1` | ⚠ | At least one row is ghosted. | A delete happened and cleanup has not yet reclaimed the slot. |

## Write-Ahead Logging And Log Health

```mermaid
flowchart LR
    A[Row Modification] --> B[Log Records Generated]
    B --> C[Log Records Flushed To .ldf]
    C --> D[Transaction Can Commit]
    D --> E[Dirty Page Can Flush Later]
```

Write-ahead logging means the log is durable first and the data page is durable later. A committed row can still live only in memory for a while, but the change is already safe because the log record was flushed first.

### `sys.dm_db_log_space_usage` | check current log pressure

> [!info]-
> This query combines database metadata with the current log-usage DMV so you can assess log pressure in one result.
>
> - `sys.databases` contributes the recovery model.
> - `sys.dm_db_log_space_usage` contributes the current log footprint for the current database.
> - `total_log_mb` is the total current size of the log file.
> - `used_log_mb` and `used_log_pct` show how much of that log is currently occupied.
> - `free_log_mb` is computed for readability.
> - `log_since_last_backup_mb` matters most in `FULL` or `BULK_LOGGED` recovery, because regular log backups are what allow inactive VLFs to be reused.
>
```sql
SELECT
    d.name AS database_name,
    d.recovery_model_desc,
    CAST(ls.total_log_size_in_bytes / 1048576.0 AS decimal(18,2)) AS total_log_mb,
    CAST(ls.used_log_space_in_bytes / 1048576.0 AS decimal(18,2)) AS used_log_mb,
    CAST(ls.used_log_space_in_percent AS decimal(9,2)) AS used_log_pct,
    CAST((ls.total_log_size_in_bytes - ls.used_log_space_in_bytes) / 1048576.0 AS decimal(18,2)) AS free_log_mb,
    CAST(ls.log_space_in_bytes_since_last_backup / 1048576.0 AS decimal(18,2)) AS log_since_last_backup_mb
FROM sys.databases AS d
CROSS JOIN sys.dm_db_log_space_usage AS ls
WHERE d.database_id = DB_ID();
```

| database_name | recovery_model_desc | total_log_mb | used_log_mb | used_log_pct | free_log_mb | log_since_last_backup_mb |
|---|---|---:|---:|---:|---:|---:|
| stoxx | FULL | 967.99 | 638.23 | 65.93 | 329.76 | 621.65 |

*`stoxx` is in `FULL` recovery and about two thirds of the current log file is occupied. The most important operational signal is that more than 621 MB of log has accumulated since the last log backup. In `FULL` recovery, sustained growth in this column usually means the log-backup chain is absent, infrequent, or blocked by a reuse issue.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `recovery_model_desc` | `FULL` | &#9989; | Full recovery model. | Supports point-in-time recovery, but requires regular log backups. |
| `recovery_model_desc` | `SIMPLE` | ⚠ | Log is truncated automatically at checkpoints. | Simpler operations, but no point-in-time recovery through log backups. |
| `recovery_model_desc` | `BULK_LOGGED` | ⚠ | Reduced logging for some bulk operations. | Can help load workloads, but complicates recovery semantics. |
| `used_log_pct` | `< 70%` | &#9989; | Comfortable headroom. | Usually not urgent if the trend is stable. |
| `used_log_pct` | `70% - 90%` | ⚠ | Meaningful pressure. | Watch active transactions, backups, and reuse waits. |
| `used_log_pct` | `> 90%` | &#10060; | High pressure. | Growth or log-full conditions may be close. |
| `log_since_last_backup_mb` | Low and resetting | &#9989; | Log backups are occurring. | Inactive VLFs can become reusable. |
| `log_since_last_backup_mb` | High and monotonically increasing | &#10060; | Log backup chain is not keeping up. | Expect persistent log growth in `FULL` recovery. |

### `sys.dm_db_log_info` | inspect VLF count

> [!info]-
> This query summarizes the current virtual log file layout.
>
> - `sys.dm_db_log_info(DB_ID())` returns one row per VLF in the current database log.
> - `vlf_count` is the total number of VLFs.
> - `active_vlf_count` is the number of currently active VLFs.
> - `total_vlf_size_mb` confirms the summed VLF footprint matches the actual log size.
>
```sql
SELECT
    COUNT(*) AS vlf_count,
    SUM(CASE WHEN vlf_status = 2 THEN 1 ELSE 0 END) AS active_vlf_count,
    CAST(SUM(vlf_size_mb) AS decimal(18,2)) AS total_vlf_size_mb
FROM sys.dm_db_log_info(DB_ID());
```

| vlf_count | active_vlf_count | total_vlf_size_mb |
|---:|---:|---:|
| 43 | 25 | 967.96 |

*The current VLF layout is healthy. Forty-three VLFs for a roughly 968 MB log is not excessive, and the active portion is materially smaller than the total log. The practical takeaway is that this log is not currently suffering from pathological VLF fragmentation.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `vlf_count` | `< 50` | &#9989; | Usually healthy for small and medium logs. | Recovery and log scans are unlikely to be impaired by VLF sprawl alone. |
| `vlf_count` | `50 - 200` | ⚠ | Worth monitoring. | Often acceptable, but confirm growth behavior and backup cadence. |
| `vlf_count` | `> 200` | &#10060; | Often excessive. | Recovery, startup, and log-management tasks can become slower. |
| `active_vlf_count` | Much lower than `vlf_count` | &#9989; | Good reuse headroom exists. | The log has inactive regions available for reuse. |
| `active_vlf_count` | Close to `vlf_count` | ⚠ | Most of the log is active. | Growth pressure is more likely if heavy logging continues. |

### `sys.fn_dblog` | confirm that one row change writes multiple log records

> [!warning]
> `sys.fn_dblog` is undocumented and unsupported. Use it only for controlled diagnostics, not as a routine application dependency.
>
> [!info]-
> This query inspects the most recent log records associated with a disposable demo table.
>
> - `sys.fn_dblog(NULL, NULL)` reads the active portion of the transaction log.
> - The filter limits the result to one demo table so the output stays interpretable.
> - The result shows that a simple `INSERT` is not a single physical action. SQL Server logs row insertion, page formatting, allocation-map changes, and allocation bookkeeping.
>
```sql
SELECT TOP (5)
    [Current LSN],
    Operation,
    Context,
    [Page ID],
    AllocUnitName
FROM sys.fn_dblog(NULL, NULL)
WHERE AllocUnitName LIKE 'dbo.demo_storage_log%'
ORDER BY [Current LSN] DESC;
```

| Current LSN | Operation | Context | Page ID | AllocUnitName |
|---|---|---|---|---|
| 00000169:0001D9D0:001A | LOP_INSERT_ROWS | LCX_CLUSTERED | 0001:00001c40 | dbo.demo_storage_log.PK__demo_sto__3213E83FCD8EA637 |
| 00000169:0001D9D0:0016 | LOP_FORMAT_PAGE | LCX_HEAP | 0001:00001c40 | dbo.demo_storage_log.PK__demo_sto__3213E83FCD8EA637 |
| 00000169:0001D9D0:000E | LOP_SET_BITS | LCX_IAM | 0001:000072a2 | dbo.demo_storage_log.PK__demo_sto__3213E83FCD8EA637 |
| 00000169:0001D9D0:000C | LOP_FORMAT_PAGE | LCX_IAM | 0001:000072a2 | dbo.demo_storage_log.PK__demo_sto__3213E83FCD8EA637 |
| 00000169:0001D9D0:0009 | LOP_MODIFY_ROW | LCX_PFS | 0001:00000001 | dbo.demo_storage_log.PK__demo_sto__3213E83FCD8EA637 |

*One row insert generated multiple log records. That is the operational reason write-heavy workloads are limited by more than row count alone: every change also touches allocation structures, page metadata, and durability bookkeeping.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `Operation` | `LOP_INSERT_ROWS` | &#9989; | The row payload was inserted. | This is the business-level row change. |
| `Operation` | `LOP_FORMAT_PAGE` | &#9989; | A page was initialized or prepared. | New page allocation or page-use change happened. |
| `Operation` | `LOP_SET_BITS` | &#9989; | Allocation maps were updated. | SQL Server changed extent/page allocation bookkeeping. |
| `Operation` | `LOP_MODIFY_ROW` | &#9989; | Metadata or row contents changed in place. | Common around PFS and other system structures. |
| `Context` | `LCX_CLUSTERED` | &#9989; | The operation affected clustered-index storage. | The base row itself was logged. |
| `Context` | `LCX_IAM` | &#9989; | The operation affected IAM allocation metadata. | Space allocation changed. |
| `Context` | `LCX_PFS` | &#9989; | The operation affected PFS metadata. | Page free-space and allocation status changed. |

## Heap Forwarding Records

> [!example]
> This demo is intentionally disposable. It shows why mutable heaps age poorly when updated rows no longer fit on their original pages.
>
### Setup

> [!info]-
> This batch creates a small heap and inserts narrow rows.
>
> - The table has no clustered index, so it is a heap.
> - The initial payload is short so most rows fit densely on the original page.
> - The widening update later will force SQL Server to move some rows to different pages and leave forwarding pointers behind.
>
```sql
DROP TABLE IF EXISTS dbo.demo_storage_heap_forwarding;

CREATE TABLE dbo.demo_storage_heap_forwarding
(
    row_id int NOT NULL,
    payload varchar(800) NOT NULL
);

;WITH n (row_id) AS
(
    SELECT TOP (200) ROW_NUMBER() OVER (ORDER BY (SELECT NULL))
    FROM sys.all_objects
)
INSERT INTO dbo.demo_storage_heap_forwarding (row_id, payload)
SELECT n.row_id, REPLICATE('A', 20)
FROM n;
```

### Baseline

> [!info]-
> This query checks the physical state of the heap before the widening update.
>
> - `sys.dm_db_index_physical_stats` returns low-level physical information about the object.
> - `index_id = 0` means heap storage.
> - `forwarded_record_count` is the critical column here. In a healthy fresh heap it should be zero.
>
```sql
SELECT
    index_type_desc,
    page_count,
    record_count,
    forwarded_record_count
FROM sys.dm_db_index_physical_stats(DB_ID(), OBJECT_ID(N'dbo.demo_storage_heap_forwarding'), 0, NULL, 'DETAILED');
```

| index_type_desc | page_count | record_count | forwarded_record_count |
|---|---:|---:|---:|
| HEAP | 1 | 200 | 0 |

*The fresh heap fits on one page and has no forwarded rows. This is the clean baseline state before any row widening occurs.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `index_type_desc` | `HEAP` | &#9989; | The table has no clustered index. | Forwarding records are possible on widening updates. |
| `forwarded_record_count` | `0` | &#9989; | No forwarding pointers exist. | Reads do not need extra heap hops yet. |
| `forwarded_record_count` | `> 0` | &#10060; | Some rows were moved and left forwarding stubs. | Heap lookups now require extra page visits. |

### Widen The Rows

> [!info]-
> This update makes half the rows much larger.
>
> - The widened payload no longer fits the original packed layout.
> - Because this is a heap, SQL Server can move rows elsewhere and leave forwarding pointers behind instead of maintaining a clustered key order.
>
```sql
UPDATE dbo.demo_storage_heap_forwarding
SET payload = REPLICATE('Z', 500)
WHERE row_id % 2 = 0;
```

### Post-change Validation

> [!info]-
> This is the same physical-stats query after the widening update.
>
> - Compare `page_count` and `forwarded_record_count` to the baseline.
> - The rows themselves are still only 200 business rows, but the physical storage now includes forwarding overhead.
>
```sql
SELECT
    index_type_desc,
    page_count,
    record_count,
    forwarded_record_count
FROM sys.dm_db_index_physical_stats(DB_ID(), OBJECT_ID(N'dbo.demo_storage_heap_forwarding'), 0, NULL, 'DETAILED');
```

| index_type_desc | page_count | record_count | forwarded_record_count |
|---|---:|---:|---:|
| HEAP | 8 | 294 | 94 |

*The heap expanded from 1 page to 8 pages and now has 94 forwarded rows. That is the exact failure mode mutable heaps suffer from: row access becomes less direct over time because the original row location now points somewhere else.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `page_count` | Increased materially | ⚠ | The heap now occupies more pages. | Reads and scans have more physical work to do. |
| `record_count` | Higher than business row count | ⚠ | Physical row accounting now includes forwarding artifacts. | The storage engine is carrying extra structural overhead. |
| `forwarded_record_count` | `94` | &#10060; | Nearly half the rows now require a forwarding hop. | Rebuild or add a clustered index if this pattern appears in production. |

## Page Splits

> [!warning]
> Do not use fragmentation percentage in isolation. Small objects can show dramatic percentages without being a maintenance priority. Use this demo to understand the mechanism, not as a rebuild threshold.
>
> [!example]
> This demo shows how widening updates can force a clustered index to split pages and consume more space.
>
### Setup

> [!info]-
> This batch creates a clustered table with narrow rows.
>
> - The table starts compact and ordered by `row_id`.
> - The later widening update forces the leaf level to allocate more pages.
>
```sql
DROP TABLE IF EXISTS dbo.demo_storage_page_splits;

CREATE TABLE dbo.demo_storage_page_splits
(
    row_id int NOT NULL,
    payload varchar(800) NOT NULL,
    CONSTRAINT PK_demo_storage_page_splits PRIMARY KEY CLUSTERED (row_id)
);

;WITH n (row_id) AS
(
    SELECT TOP (200) ROW_NUMBER() OVER (ORDER BY (SELECT NULL))
    FROM sys.all_objects
)
INSERT INTO dbo.demo_storage_page_splits (row_id, payload)
SELECT n.row_id, REPLICATE('A', 20)
FROM n;
```

### Baseline

> [!info]-
> This query inspects only the leaf level of the clustered index.
>
> - `index_level = 0` isolates the leaf pages where the actual rows live.
> - `avg_fragmentation_in_percent` is measured only on the leaf level.
> - `page_count` shows how many leaf pages the clustered index currently needs.
>
```sql
SELECT
    index_level,
    CAST(avg_fragmentation_in_percent AS decimal(9,2)) AS avg_fragmentation_in_percent,
    page_count,
    record_count
FROM sys.dm_db_index_physical_stats(DB_ID(), OBJECT_ID(N'dbo.demo_storage_page_splits'), 1, NULL, 'DETAILED')
WHERE index_level = 0;
```

| index_level | avg_fragmentation_in_percent | page_count | record_count |
|---:|---:|---:|---:|
| 0 | 0.00 | 1 | 200 |

*The fresh clustered index is compact: one leaf page, no fragmentation worth discussing, and 200 rows stored in key order.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `index_level` | `0` | &#9989; | Leaf level only. | This is the level that affects row reads directly. |
| `avg_fragmentation_in_percent` | `0 - 5` | &#9989; | Generally healthy. | Range scans are not paying extra page-order penalties. |
| `avg_fragmentation_in_percent` | `5 - 30` | ⚠ | Evaluate in context. | Check page count and workload type before rebuilding. |
| `avg_fragmentation_in_percent` | `> 30` | &#10060; | Material fragmentation on meaningful objects. | Often worth maintenance when page count is also substantial. |

### Widen The Rows

> [!info]-
> This update makes every row much wider.
>
> - The clustered key stays the same.
> - The leaf level must allocate more pages to keep the larger rows.
> - This is a classic route to page splits and extra read amplification.
>
```sql
UPDATE dbo.demo_storage_page_splits
SET payload = REPLICATE('Y', 500);
```

### Post-change Validation

> [!info]-
> This reruns the same leaf-level physical-stats query after the widening update.
>
> - Compare both `page_count` and `avg_fragmentation_in_percent` to the baseline.
> - The row count is unchanged, so any growth is purely storage overhead created by the wider rows.
>
```sql
SELECT
    index_level,
    CAST(avg_fragmentation_in_percent AS decimal(9,2)) AS avg_fragmentation_in_percent,
    page_count,
    record_count
FROM sys.dm_db_index_physical_stats(DB_ID(), OBJECT_ID(N'dbo.demo_storage_page_splits'), 1, NULL, 'DETAILED')
WHERE index_level = 0;
```

| index_level | avg_fragmentation_in_percent | page_count | record_count |
|---:|---:|---:|---:|
| 0 | 12.00 | 25 | 200 |

*The row count stayed at 200, but the leaf level expanded from 1 page to 25 pages and fragmentation rose from 0% to 12%. The exact percentage is not the main lesson here because the object is tiny; the real lesson is that widening rows forces additional pages and breaks the original dense layout.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `page_count` | `25` vs `1` baseline | ⚠ | The same rows now occupy far more leaf pages. | Range scans and buffer usage become more expensive. |
| `avg_fragmentation_in_percent` | `12.00` | ⚠ | The leaf order is no longer perfectly sequential. | Small in production impact here, but it proves the split mechanism. |
| `record_count` | Unchanged | &#9989; | Business row count stayed constant. | The extra cost comes from storage layout, not more data. |

## `tempdb` Space By Category

### `tempdb.sys.dm_db_file_space_usage` | see what is consuming `tempdb`

> [!info]-
> This query summarizes `tempdb` usage by allocation category.
>
> - `unallocated_mb` is free space already inside the `tempdb` files.
> - `version_store_mb` is row-version storage used by snapshot isolation, RCSI, online index operations, and some internal consumers.
> - `user_object_mb` covers temp tables, table variables, and other user-created objects materialized in `tempdb`.
> - `internal_object_mb` covers worktables, sorts, hashes, spools, and other internal engine work.
> - `mixed_extent_mb` is low-level allocation overhead and is usually a secondary signal.
>
```sql
SELECT
    CAST(SUM(unallocated_extent_page_count) * 8.0 / 1024 AS decimal(18,2)) AS unallocated_mb,
    CAST(SUM(version_store_reserved_page_count) * 8.0 / 1024 AS decimal(18,2)) AS version_store_mb,
    CAST(SUM(user_object_reserved_page_count) * 8.0 / 1024 AS decimal(18,2)) AS user_object_mb,
    CAST(SUM(internal_object_reserved_page_count) * 8.0 / 1024 AS decimal(18,2)) AS internal_object_mb,
    CAST(SUM(mixed_extent_page_count) * 8.0 / 1024 AS decimal(18,2)) AS mixed_extent_mb
FROM tempdb.sys.dm_db_file_space_usage;
```

| unallocated_mb | version_store_mb | user_object_mb | internal_object_mb | mixed_extent_mb |
|---:|---:|---:|---:|---:|
| 2618.44 | 0.00 | 2.44 | 1.06 | 2.06 |

*`tempdb` is healthy at capture time. More than 2.6 GB inside the current files is free, version store usage is effectively zero, and both user and internal object footprints are tiny. This is what an uncongested `tempdb` looks like.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `version_store_mb` | Near `0` | &#9989; | Little or no version-store pressure. | Snapshot/RCSI or online-maintenance versioning is not stressing `tempdb` right now. |
| `version_store_mb` | Sustained growth | &#10060; | Long-running versioned transactions exist. | Investigate snapshot readers, RCSI, or online operations. |
| `user_object_mb` | Low and transient | &#9989; | Temp tables and user scratch objects are modest. | Normal ETL or SSMS activity. |
| `user_object_mb` | High and persistent | ⚠ | User sessions are holding large `tempdb` objects. | Check temp-table strategy and session cleanup. |
| `internal_object_mb` | Low | &#9989; | Sorts, hashes, and worktables are modest. | No visible spill pressure right now. |
| `internal_object_mb` | High or rising fast | &#10060; | The engine is spilling or materializing heavy workspace structures. | Check memory grants, sorts, hashes, and bad plans. |

## Production Recommendations

- Use fixed MB growth, not percent growth, for both data and log files.
- Do not leave primary data files effectively uncapped in production unless the underlying storage layer is explicitly managed and monitored.
- In `FULL` recovery, monitor `log_since_last_backup_mb` and the actual log-backup cadence together. A healthy backup strategy is what makes log reuse possible.
- Avoid mutable heaps for long-lived OLTP or frequently updated tables. Forwarding records are a structural tax, not a cosmetic issue.
- Treat page splits as a design signal first. Sequential clustering, narrower rows, lower churn, and targeted fill factor changes usually matter more than blind rebuilds.
- Watch `tempdb` version store and internal object space when troubleshooting snapshot workloads, spills, or online maintenance.

## Related

- [[index-types-and-strategy]]
- [[table-compression]]
- [[partitioning-strategies]]
- [[index-maintenance]]
- [[memory-and-buffer-pool]]

