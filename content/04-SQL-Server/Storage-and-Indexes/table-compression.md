---
title: "Table Compression"
tags: [sql, sql-server, tsql]
aliases: [SQL Server compression, page compression, row compression, DATA_COMPRESSION, sp_estimate_data_compression_savings, table compression]
description: "How SQL Server page and row compression works, when to apply each type, how to estimate savings before committing, and how to apply compression with minimal blocking using ONLINE rebuilds. Includes data pipeline guidance for gold-layer tables."
parent: "[[domain-storage-internals]]"
links:
  - "[[storage-internals]]"
  - "[[index-types-and-strategy]]"
  - "[[partitioning-strategies]]"
created: 2026-03-22
updated: 2026-04-04
status: complete
---

# Table Compression

> [!quote]
> "The laws of science represent data compression in action — finding the shortest description that accounts for all the observations."
>
> — **James Gleick**, *The Information*

SQL Server page and row compression reduce the on-disk and in-memory footprint of tables and indexes. For read-heavy tables like the example gold layer, page compression typically saves 60-80% of space on financial time-series data — meaning more data fits in the [buffer pool](https://alp78.github.io/elysium/04-SQL-Server/Performance/memory-and-buffer-pool) without adding RAM.

---

## Why Compression Matters for the Buffer Pool

SQL Server's [buffer pool](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/storage-internals) is an in-memory cache of 8 KB pages. When a query reads data, SQL Server loads pages from disk into the buffer pool. If the table is large, the working set of pages can exceed available RAM, causing pages to be evicted and re-read — generating [PAGEIOLATCH_SH](https://alp78.github.io/elysium/04-SQL-Server/Performance/wait-stats-analysis) waits.

Page compression packs more rows onto each 8 KB page, which has two effects:

1. **Fewer disk reads:** A query that previously read 100 pages might only need 30 compressed pages — 70% fewer I/O operations.
2. **More data in RAM:** 30 compressed pages take up 30 × 8 KB = 240 KB in the buffer pool instead of 100 × 8 KB = 800 KB. More data stays cached, reducing future disk reads.

Pages are stored in their compressed form in the buffer pool — the storage engine decompresses individual rows on the fly when they are accessed by the query processor. This means the CPU cost is paid per row access, not per page load, and scales with the number of rows actually read rather than the number of pages cached.

---

## Compression Types

SQL Server offers two row-based compression types (plus columnstore, which is a separate index type). Both operate at the storage engine level — no application changes are required.

| Type | What It Does | Savings | CPU Overhead | Best For |
|---|---|---|---|---|
| **NONE** | No compression — default | 0% | 0% | Tables with frequent single-row updates |
| **ROW** | Converts fixed-length columns to variable-length storage format. `INT` value 5 stores in 1 byte instead of 4; `CHAR(100)` trailing spaces removed; `NULL` and `0` values across all data types take zero bytes. Types already variable-length (`VARCHAR`, `NVARCHAR`, `VARBINARY`) are unaffected. | 10-40% | Minimal | Active OLTP tables, mixed read/write |
| **PAGE** | Applies ROW compression first, then two additional page-level techniques: (1) **prefix compression** — identifies the longest common prefix per column on each page and stores it once in a Compression Information (CI) structure after the page header, (2) **dictionary compression** — finds repeated values across *all* columns on the page and replaces them with short references in the CI. Only applied to leaf-level pages; non-leaf index pages receive ROW compression only. | 40-80% | Low-moderate | Read-heavy tables, historical data, gold layer |

> [!info] PAGE Includes ROW Compression
>
> PAGE compression applies all ROW compression techniques first, then adds prefix compression and dictionary compression on top. You never need to apply both — PAGE compression is strictly superior.

> [!warning] CPU Overhead on Memory-Constrained Systems
>
> Row decompression consumes CPU each time a row is accessed from a compressed page. On systems with small buffer pools where pages are frequently evicted and re-read, each re-read pays the decompression cost again. If your server is under memory pressure (sustained PLE decline — see [storage-internals](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/storage-internals) for PLE monitoring guidance), compression may increase CPU usage as pages cycle in and out of the buffer pool.

> [!success] Safe Pattern: Check PLE Trend Before Applying Compression
>
> Baseline your PLE using `sys.dm_os_performance_counters WHERE counter_name = 'Page life expectancy'`. A community heuristic is ~300 seconds per 4 GB of buffer pool (e.g., ~7,500s for a 100 GB pool). If PLE is trending well above your baseline, compression is safe. If PLE is already low or declining, address memory pressure first (increase `max server memory`, identify large table consumers with `sys.dm_os_buffer_descriptors`) before adding decompression CPU cost.

> [!info] Page Compression Activation Timing
>
> Page compression does not fire on the first row inserted. It activates when a page is full and the next row would overflow — the entire page is then evaluated for prefix and dictionary compression. If the space freed by the CI structure does not exceed the CI overhead, the page falls back to row compression only. This means partially-filled pages may show only row compression even when PAGE compression is configured.

---

## When to Apply Page Compression

The decision to compress depends on the table's read/write ratio, data distribution, and how often the data changes. Compression is not free — it trades CPU cycles for reduced I/O and memory footprint. The benefit is largest when a table is read far more often than it is written, and when the data contains repeating patterns (common prefixes, repeated values, nullable columns).

### Page compression — good candidates (gold-layer, read-heavy, time-series)

- **Gold-layer tables** — read-only or rarely updated; financial time-series data compresses extremely well
- **Historical silver data** — SCD Type 2 inactive records (`is_current = 0`) that are queried but never updated
- **Archival tables** — older partitions that are frozen
- **Dashboard query targets** — tables that must fit in the buffer pool for fast response times

### Page compression — poor candidates (heavy write, TempDB, small tables)

- **Tables with frequent in-place updates** — each UPDATE decompresses the page, modifies it, and recompresses it (overhead adds up on hot update tables)
- **Tables with highly random data** — compression ratio approaches 0% on random bytes, encrypted data, GUIDs, or truly varied text
- **Small tables** — tables under ~1,000 rows gain nothing; the metadata overhead may increase size

> [!warning] Avoid Compressing Hot Tables
>
> Page compression is not free on write paths. If a table receives thousands of row-level updates per second (e.g., a hot bronze staging table), compressing it will increase CPU and may slow write throughput. Only compress tables that have stabilized and are primarily read.

> [!success] Safe Pattern: Apply ROW Compression to Active Tables, PAGE to Cold Tables
>
> Use `sp_estimate_data_compression_savings` to measure projected savings for both ROW and PAGE. For active OLTP tables with frequent updates (bronze/silver), apply ROW compression only — it removes padding and trailing zeros with minimal CPU overhead. Reserve PAGE compression for read-only or rarely-updated tables such as gold-layer aggregates and historical archive partitions.

---

## Estimating Compression Savings Before Applying

Always estimate before committing. SQL Server's `sp_estimate_data_compression_savings` reads a sample of the table and projects savings:

Passing `NULL` for `@index_id` and `@partition_number` estimates savings across all indexes and partitions. Always compare both ROW and PAGE to determine which level is appropriate.

```sql
EXEC sp_estimate_data_compression_savings
    @schema_name = 'gold',
    @object_name = 'index_performance',
    @index_id = NULL,
    @partition_number = NULL,
    @data_compression = 'PAGE';

EXEC sp_estimate_data_compression_savings
    @schema_name = 'gold',
    @object_name = 'index_performance',
    @index_id = NULL,
    @partition_number = NULL,
    @data_compression = 'ROW';
```

### sp_estimate_data_compression_savings — reading the output

| Column | Meaning |
|---|---|
| `size_with_current_compression_setting_kb` | Current size |
| `size_with_requested_compression_setting_kb` | Projected size after compression |
| `sample_size_with_current_compression_setting_kb` | Size of the sample used |
| `sample_size_with_requested_compression_setting_kb` | Projected sample size |

Divide projected by current to get compression ratio. Financial time-series data (repeated dates, small numeric ranges, frequent NULL patterns) typically achieves 60-80% reduction.

> [!warning] sp_estimate Accuracy Limitations
>
> The procedure samples the source table into a temporary copy in tempdb and compresses the sample — it does not compress the actual table. Existing index fragmentation is included in the "current" size but not in the "projected" size, which can make compression appear more beneficial than it actually is on a heavily fragmented index. Always defragment before comparing. The procedure acquires an Intent Shared (IS) lock and may be blocked by concurrent schema locks. It cannot estimate compression for temporary tables, and `COLUMNSTORE`/`COLUMNSTORE_ARCHIVE` estimation was only added in SQL Server 2019.

> [!success] Interpret Results Conservatively
>
> If the estimated compressed size is *larger* than the current size, the data does not benefit from compression — rows already use near-full precision of their data types and the compression metadata overhead exceeds savings. Do not enable compression in this case.

---

## Applying Compression

Compression is applied by rebuilding the index (or table) with the `DATA_COMPRESSION` option. This physically rewrites every page. On Enterprise Edition, `ONLINE = ON` allows concurrent reads and writes during the rebuild; on Standard Edition, the rebuild takes a schema modification (Sch-M) lock that blocks all access. For new tables, compression can be specified at creation time with no rebuild cost.

### ALTER INDEX REBUILD WITH DATA_COMPRESSION = PAGE — compress specific index

Compressing the clustered index compresses the table data itself, since the clustered index leaf level IS the data.

```sql
ALTER INDEX CIX_index_performance ON gold.index_performance
REBUILD WITH (DATA_COMPRESSION = PAGE);
```

### ALTER TABLE REBUILD WITH DATA_COMPRESSION = PAGE — compress all indexes

Using `ALTER INDEX ALL` compresses every index on the table in a single statement — both the clustered index (data) and all nonclustered indexes.

```sql
ALTER INDEX ALL ON gold.index_performance
REBUILD WITH (DATA_COMPRESSION = PAGE);
```

### ALTER INDEX REBUILD ONLINE = ON — compress without table locks (Enterprise)

`ONLINE = ON` allows concurrent reads and writes during the rebuild. `MAXDOP` limits parallel threads to avoid CPU spikes during compression.

```sql
ALTER INDEX CIX_index_performance ON gold.index_performance
REBUILD WITH (
    DATA_COMPRESSION = PAGE,
    ONLINE = ON,
    MAXDOP = 2
);
```

> [!warning] Enterprise Edition Required for Online Rebuild
>
> Online index rebuilds require Enterprise Edition across all SQL Server versions through 2022. This was not changed by SQL Server 2016 SP1's Common Programmability Surface Area expansion, which brought data compression and partitioning to Standard but explicitly excluded online indexing. On Standard Edition, a rebuild takes a schema modification (Sch-M) lock on the table — blocking all reads and writes for the duration. Schedule rebuilds during maintenance windows. See [blocking-and-locking](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/blocking-and-locking) for lock type details.

> [!success] Safe Pattern: Schedule Standard Edition Rebuilds During Maintenance Windows
>
> On Standard Edition, run compression rebuilds during off-peak hours (e.g., Sunday 02:00 UTC). Use `sys.dm_exec_requests` to confirm no active sessions against the table before starting. For large gold-layer tables, apply compression one table at a time and monitor completion with `WHERE command LIKE '%ALTER INDEX%'` in `sys.dm_exec_requests`.

### CREATE TABLE WITH DATA_COMPRESSION = PAGE — apply at creation time

Specifying compression at creation time avoids the need for a subsequent rebuild and ensures data is compressed from the first insert.

```sql
CREATE TABLE gold.index_performance_archive (
    trade_date      DATE            NOT NULL,
    [index]         NVARCHAR(100)   NOT NULL,
    price_return    FLOAT           NULL,
    total_return    FLOAT           NULL,
    CONSTRAINT CIX_idx_perf_archive PRIMARY KEY CLUSTERED (trade_date, [index])
) WITH (DATA_COMPRESSION = PAGE);
```

> [!danger] REBUILD Resets Compression
>
> Running `ALTER INDEX ... REBUILD` without specifying `DATA_COMPRESSION` resets the index to NONE — silently removing compression. Always include `WITH (DATA_COMPRESSION = PAGE)` in every REBUILD statement for compressed indexes. Automated maintenance scripts that rebuild fragmented indexes must preserve the compression setting.

> [!success] Safe Pattern: Read Current Compression Before REBUILD
>
> Before any REBUILD, query `sys.partitions WHERE object_id = OBJECT_ID('table') AND index_id = 1` and read `data_compression_desc`. Pass the same value to `WITH (DATA_COMPRESSION = ...)` in the REBUILD statement. In automated maintenance scripts, dynamically fetch the compression setting per index and always include it explicitly rather than omitting the clause.

---

## Monitoring Compression State

After applying compression, verify the current state of every table and index to confirm that no index was accidentally left uncompressed or had its compression silently removed by a maintenance script rebuild.

### sys.partitions data_compression_desc — check compression across all tables

```sql
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
```

> [!tip] Spot Compression Opportunities
>
> Look for `NONE` on large read-heavy tables in the output — those are prime candidates for page compression.

### sys.dm_exec_requests percent_complete — monitor compression rebuild progress

```sql
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

### Batch compress gold tables — apply PAGE compression to all gold indexes

> [!info] Maintenance Window for Standard Edition
>
> Run this batch during a maintenance window on Standard Edition (offline rebuild takes a Sch-M lock). On Enterprise Edition, add `ONLINE = ON` to each statement to avoid blocking.

```sql
ALTER INDEX ALL ON gold.index_performance
REBUILD WITH (DATA_COMPRESSION = PAGE);

ALTER INDEX ALL ON gold.scores_daily
REBUILD WITH (DATA_COMPRESSION = PAGE);

ALTER INDEX ALL ON gold.signals_daily
REBUILD WITH (DATA_COMPRESSION = PAGE);

ALTER INDEX ALL ON gold.financial_health
REBUILD WITH (DATA_COMPRESSION = PAGE);
```

### sys.dm_os_buffer_descriptors — estimate buffer pool impact of compression

```sql
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
```

> [!tip] Verify Buffer Pool Reduction
>
> Re-run this query after applying compression to confirm that the buffer pool footprint decreased as expected.

---

## Compression and Columnstore Indexes

[Columnstore indexes](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/index-types-and-strategy) use their own compression algorithm that operates on column segments rather than pages, typically achieving ~10x compression over uncompressed rowstore. Columnstore compression is always active and cannot be disabled. If a table has a clustered columnstore index (CCI), the `DATA_COMPRESSION` setting applies to the delta store (recently loaded rows not yet compressed into segments), not the main columnstore storage.

For tables with a CCI, do not apply PAGE or ROW compression — the columnstore compression is already far more aggressive than page compression.

SQL Server also offers `COLUMNSTORE_ARCHIVE` compression, which applies the Microsoft XPRESS compression algorithm on top of standard columnstore compression for even higher compression ratios. Apply it per-partition to cold data that is rarely queried — it significantly increases both compression and decompression CPU cost. Set via `ALTER TABLE ... REBUILD PARTITION = N WITH (DATA_COMPRESSION = COLUMNSTORE_ARCHIVE)` and revert with `DATA_COMPRESSION = COLUMNSTORE`.

> [!info] XML Compression — SQL Server 2022
>
> SQL Server 2022 introduces `XML_COMPRESSION = ON` for `xml` data type columns and XML indexes, reducing both storage and buffer pool memory for XML-heavy workloads. Applied via `CREATE TABLE` or `ALTER TABLE ... REBUILD` with the `XML_COMPRESSION = ON` option. Estimate savings with `sp_estimate_data_compression_savings` using the `@xml_compression` parameter.

---

## Performance Impact

Compression trades CPU cycles for reduced I/O and memory consumption. The net effect depends on the workload — read-heavy queries benefit because fewer pages need to be read and cached, while write-heavy operations pay decompression and recompression overhead on every page modification.

| Workload | Before Compression | After Page Compression | Impact |
|---|---|---|---|
| Bulk SELECT (full table scan) | 100 pages read | 30 pages read | **+70% faster** (fewer disk reads) |
| Aggregation query (buffer pool hit) | 240 ms | 80 ms | **+66% faster** (smaller working set stays cached) |
| Point lookup (index seek) | 0.3 ms | 0.3 ms | **~0%** (seeks find individual rows, no scan benefit) |
| Bulk INSERT / pipeline load | 12.3 sec | 13.1 sec | **-6% slower** (compression overhead on write path) |
| CPU utilization during reads | 25% | 27% | **+2%** (decompression cost) |

The read improvements dominate for dashboard and reporting workloads. The write overhead is acceptable for gold-layer tables that are loaded once per pipeline run and queried thousands of times.

---

## Related

- [storage-internals](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/storage-internals) — how SQL Server pages, buffer pool, and the 8 KB page structure work
- [index-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/index-types-and-strategy) — columnstore indexes and when they provide better compression than page compression
- [index-maintenance](https://alp78.github.io/elysium/04-SQL-Server/Performance/index-maintenance) — compression state is reset to NONE if you rebuild without specifying DATA_COMPRESSION
- [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/Performance/performance-audit-playbook) — Phase 10 (database sizes) includes compression as a space-reduction technique
- [blocking-and-locking](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/blocking-and-locking) — ONLINE vs. offline rebuild and the lock types each acquires
- [partitioning-strategies](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/partitioning-strategies) — compression can be applied per-partition, enabling different compression levels for recent vs. historical data
