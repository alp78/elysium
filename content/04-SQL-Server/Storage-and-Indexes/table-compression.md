---
type: concept
category: sql-server
technology: [sql-server]
tags: [sql, sql-server, tsql]
aliases: [SQL Server compression, page compression, row compression, DATA_COMPRESSION, sp_estimate_data_compression_savings, table compression]
keywords: [compression, page compression, row compression, DATA_COMPRESSION, sp_estimate_data_compression_savings, REBUILD, ALTER INDEX, buffer pool, disk space, cold tables, gold layer, archival, financial time-series, prefix compression, dictionary compression, columnstore compression, ONLINE rebuild, compression savings]
description: "How SQL Server page and row compression works, when to apply each type, how to estimate savings before committing, and how to apply compression with minimal blocking using ONLINE rebuilds. Includes data pipeline guidance for gold-layer tables."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Table Compression

> [!quote]
> "The laws of science represent data compression in action — finding the shortest description that accounts for all the observations."
> — **James Gleick**, *The Information*

SQL Server page and row compression reduce the on-disk and in-memory footprint of tables and indexes. For read-heavy tables like the example gold layer, page compression typically saves 60-80% of space on financial time-series data — meaning more data fits in the [buffer pool](https://alp78.github.io/elysium/04-SQL-Server/Performance/memory-and-buffer-pool) without adding RAM.

---

### Why Compression Matters for the Buffer Pool

SQL Server's [buffer pool](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/storage-internals) is an in-memory cache of 8 KB pages. When a query reads data, SQL Server loads pages from disk into the buffer pool. If the table is large, the working set of pages can exceed available RAM, causing pages to be evicted and re-read — generating [PAGEIOLATCH_SH](https://alp78.github.io/elysium/04-SQL-Server/Performance/wait-stats-analysis) waits.

Page compression shrinks the on-disk page footprint, which has two effects:

1. **Fewer disk reads:** A query that previously read 100 pages might only need 30 compressed pages — 70% fewer I/O operations.
2. **More data in RAM:** 30 compressed pages take up 30 × 8 KB = 240 KB in the buffer pool instead of 100 × 8 KB = 800 KB. More data stays cached, reducing future disk reads.

SQL Server decompresses data on the fly as pages are loaded into the buffer pool. This consumes CPU, but modern processors with AES-NI acceleration handle it cheaply.

---

### Compression Types

SQL Server offers two row-based compression types (plus columnstore, which is a separate index type):

| Type | What It Does | Savings | CPU Overhead | Best For |
|---|---|---|---|---|
| **NONE** | No compression — default | 0% | 0% | Tables with frequent single-row updates |
| **ROW** | Removes internal padding; stores variable-length values without trailing zeros; uses shorter integer representation when possible | 10-40% | Minimal | Active OLTP tables, mixed read/write |
| **PAGE** | All ROW compression techniques, plus prefix compression (common values per column stored once) and dictionary compression (repeated values across columns replaced with short codes) | 40-80% | Low-moderate | Read-heavy tables, historical data, gold layer |

> [!info] PAGE Includes ROW Compression
>
> PAGE Compression Includes ROW Compression.
> PAGE compression applies all ROW compression techniques first, then adds prefix compression and dictionary compression on top. You never need to apply both — PAGE compression is strictly superior.

---

## When to Apply Page Compression

#### Page compression — good candidates (gold-layer, read-heavy, time-series)

- **Gold-layer tables** — read-only or rarely updated; financial time-series data compresses extremely well
- **Historical silver data** — SCD Type 2 inactive records (`is_current = 0`) that are queried but never updated
- **Archival tables** — older partitions that are frozen
- **Dashboard query targets** — tables that must fit in the buffer pool for fast response times

#### Page compression — poor candidates (heavy write, TempDB, small tables)

- **Tables with frequent in-place updates** — each UPDATE decompresses the page, modifies it, and recompresses it (overhead adds up on hot update tables)
- **Tables with highly random data** — compression ratio approaches 0% on random bytes, encrypted data, GUIDs, or truly varied text
- **Small tables** — tables under ~1,000 rows gain nothing; the metadata overhead may increase size

> [!warning] Avoid Compressing Hot Tables
>
> Don't Compress Tables with Frequent Updates.
> Page compression is not free on write paths. If a table receives thousands of row-level updates per second (e.g., a hot bronze staging table), compressing it will increase CPU and may slow write throughput. Only compress tables that have stabilized and are primarily read.

---

## Estimating Compression Savings Before Applying

Always estimate before committing. SQL Server's `sp_estimate_data_compression_savings` reads a sample of the table and projects savings:

```sql
-- Estimate PAGE compression savings for gold.index_performance
EXEC sp_estimate_data_compression_savings
    @schema_name = 'gold',
    @object_name = 'index_performance',
    @index_id = NULL,         -- NULL = all indexes
    @partition_number = NULL,  -- NULL = all partitions
    @data_compression = 'PAGE';

-- Estimate ROW compression savings for comparison
EXEC sp_estimate_data_compression_savings
    @schema_name = 'gold',
    @object_name = 'index_performance',
    @index_id = NULL,
    @partition_number = NULL,
    @data_compression = 'ROW';
```

#### sp_estimate_data_compression_savings — reading the output

| Column | Meaning |
|---|---|
| `size_with_current_compression_setting_kb` | Current size |
| `size_with_requested_compression_setting_kb` | Projected size after compression |
| `sample_size_with_current_compression_setting_kb` | Size of the sample used |
| `sample_size_with_requested_compression_setting_kb` | Projected sample size |

Divide projected by current to get compression ratio. Financial time-series data (repeated dates, small numeric ranges, frequent NULL patterns) typically achieves 60-80% reduction.

---

## Applying Compression

#### ALTER INDEX REBUILD WITH DATA_COMPRESSION = PAGE — compress specific index

```sql
-- Apply page compression to the clustered index (the table itself)
ALTER INDEX CIX_index_performance ON gold.index_performance
REBUILD WITH (DATA_COMPRESSION = PAGE);
```

#### ALTER TABLE REBUILD WITH DATA_COMPRESSION = PAGE — compress all indexes

```sql
-- Compress all indexes on the table in one statement
ALTER INDEX ALL ON gold.index_performance
REBUILD WITH (DATA_COMPRESSION = PAGE);
```

#### ALTER INDEX REBUILD ONLINE = ON — compress without table locks (Enterprise)

```sql
-- Online rebuild — other sessions can read and write during the rebuild
ALTER INDEX CIX_index_performance ON gold.index_performance
REBUILD WITH (
    DATA_COMPRESSION = PAGE,
    ONLINE = ON,
    MAXDOP = 2           -- limit parallel threads to avoid CPU spikes
);
```

> [!warning] Enterprise Edition Required
>
> ONLINE = ON Requires Enterprise Edition.
> Online index rebuilds are not available in Standard Edition. On Standard Edition, an index rebuild takes a schema modification (Sch-M) lock on the table — blocking all reads and writes for the duration. Schedule Standard Edition rebuilds during maintenance windows. See [blocking-and-locking](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/blocking-and-locking) for lock type details.

#### CREATE TABLE WITH DATA_COMPRESSION = PAGE — apply at creation time

```sql
-- Create a compressed table directly (no rebuild needed)
CREATE TABLE gold.index_performance_archive (
    trade_date      DATE            NOT NULL,
    [index]         NVARCHAR(100)   NOT NULL,
    price_return    FLOAT           NULL,
    total_return    FLOAT           NULL,
    CONSTRAINT CIX_idx_perf_archive PRIMARY KEY CLUSTERED (trade_date, [index])
) WITH (DATA_COMPRESSION = PAGE);
```

---

## Monitoring Compression State

#### sys.partitions data_compression_desc — check compression across all tables

```sql
-- Current compression settings for all user tables and indexes
SELECT
    SCHEMA_NAME(o.schema_id) + '.' + o.name AS table_name,
    i.name AS index_name,
    i.type_desc AS index_type,
    p.data_compression_desc AS compression,
    CAST(a.used_pages * 8.0 / 1024 AS DECIMAL(10,2)) AS size_mb,
    p.rows AS row_count
FROM sys.objects o
JOIN sys.indexes i ON o.object_id = i.object_id
JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
JOIN sys.allocation_units a ON p.partition_id = a.container_id
WHERE o.type = 'U'
  AND o.schema_id IN (SCHEMA_ID('gold'), SCHEMA_ID('silver'))
ORDER BY size_mb DESC;
-- Look for: NONE on large read-heavy tables = compression opportunity
```

#### sys.dm_exec_requests percent_complete — monitor compression rebuild progress

```sql
-- Monitor an in-progress index rebuild
SELECT
    r.session_id,
    r.command,
    r.percent_complete,
    r.estimated_completion_time / 1000 AS remaining_sec,
    SUBSTRING(t.text, 1, 100) AS query_text
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
WHERE r.command LIKE '%ALTER INDEX%';
```

---

## Pipeline Compression Strategy

The analytics database has three schema layers with different compression recommendations:

| Schema | Tables | Recommendation | Reason |
|---|---|---|---|
| `bronze` | Raw loaded data, staging | NONE | Frequently truncated and reloaded; compression adds overhead with no benefit |
| `silver` | Normalized daily/corporate data | ROW on large tables | Mixed read/write (SCD upserts); ROW compression is safe overhead-wise |
| `gold` | Index performance, scores, signals | PAGE | Read-only by dashboards; time-series data compresses 60-80%; must fit in buffer pool |

#### Batch compress gold tables — apply PAGE compression to all gold indexes

```sql
-- Apply page compression to all gold-layer tables
-- Run during a maintenance window for Standard Edition; can run online for Enterprise

ALTER INDEX ALL ON gold.index_performance
REBUILD WITH (DATA_COMPRESSION = PAGE);

ALTER INDEX ALL ON gold.scores_daily
REBUILD WITH (DATA_COMPRESSION = PAGE);

ALTER INDEX ALL ON gold.signals_daily
REBUILD WITH (DATA_COMPRESSION = PAGE);

ALTER INDEX ALL ON gold.financial_health
REBUILD WITH (DATA_COMPRESSION = PAGE);
```

#### sys.dm_os_buffer_descriptors — estimate buffer pool impact of compression

```sql
-- Buffer pool usage by schema before compression
SELECT
    SCHEMA_NAME(o.schema_id) AS [schema],
    SUM(bd.page_count) AS pages_in_buffer,
    CAST(SUM(bd.page_count) * 8.0 / 1024 AS DECIMAL(10,2)) AS buffer_mb
FROM sys.dm_os_buffer_descriptors bd
JOIN sys.allocation_units au ON bd.allocation_unit_id = au.allocation_unit_id
JOIN sys.partitions p ON au.container_id = p.partition_id
JOIN sys.objects o ON p.object_id = o.object_id
WHERE bd.database_id = DB_ID('analytics_db')
  AND o.type = 'U'
GROUP BY SCHEMA_NAME(o.schema_id)
ORDER BY buffer_mb DESC;
-- Re-run after compression to verify buffer pool reduction
```

---

### Compression and Columnstore Indexes

[Columnstore indexes](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/index-types-and-strategy) use their own compression (delta stores + column segments with ~10x compression ratio). If a table has a clustered columnstore index (CCI), the `DATA_COMPRESSION` setting applies to the delta store (recently loaded rows not yet compressed into segments), not the main columnstore storage.

For tables with a CCI, do not apply PAGE or ROW compression — the columnstore compression is already far more aggressive than page compression.

---

### Performance Impact

| Workload | Before Compression | After Page Compression | Impact |
|---|---|---|---|
| Bulk SELECT (full table scan) | 100 pages read | 30 pages read | **+70% faster** (fewer disk reads) |
| Aggregation query (buffer pool hit) | 240 ms | 80 ms | **+66% faster** (smaller working set stays cached) |
| Point lookup (index seek) | 0.3 ms | 0.3 ms | **~0%** (seeks find individual rows, no scan benefit) |
| Bulk INSERT / pipeline load | 12.3 sec | 13.1 sec | **-6% slower** (compression overhead on write path) |
| CPU utilization during reads | 25% | 27% | **+2%** (decompression cost) |

The read improvements dominate for dashboard and reporting workloads. The write overhead is acceptable for gold-layer tables that are loaded once per pipeline run and queried thousands of times.

---

### Related

- [storage-internals](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/storage-internals) — how SQL Server pages, buffer pool, and the 8 KB page structure work
- [index-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/index-types-and-strategy) — columnstore indexes and when they provide better compression than page compression
- [index-maintenance](https://alp78.github.io/elysium/04-SQL-Server/Performance/index-maintenance) — compression state is reset to NONE if you rebuild without specifying DATA_COMPRESSION
- [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/Performance/performance-audit-playbook) — Phase 10 (database sizes) includes compression as a space-reduction technique
- [blocking-and-locking](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/blocking-and-locking) — ONLINE vs. offline rebuild and the lock types each acquires
- [partitioning-strategies](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/partitioning-strategies) — compression can be applied per-partition, enabling different compression levels for recent vs. historical data
