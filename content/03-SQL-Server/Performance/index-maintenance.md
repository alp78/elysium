---
type: how-to
category: performance
technology: [sql-server]
tags: [sql-server, performance, indexing, maintenance, fragmentation]
aliases: [index fragmentation, index rebuild, index reorganize, fill factor, ALTER INDEX REBUILD, ALTER INDEX REORGANIZE, index defragmentation, Ola Hallengren]
keywords: [index fragmentation, avg_fragmentation_in_percent, index rebuild, index reorganize, fill factor, ONLINE=ON, sys.dm_db_index_physical_stats, REORGANIZE, REBUILD, PAGE compression, DATA_COMPRESSION, columnstore reorganize, COMPRESS_ALL_ROW_GROUPS, statistics update after rebuild, index maintenance script, Ola Hallengren, maintenance window]
description: "How to detect and fix SQL Server index fragmentation using REORGANIZE and REBUILD operations — includes fragmentation thresholds, automated maintenance script, fill factor guidance, and a recommended maintenance schedule for data pipeline workloads."
related: [index-types-and-strategy, wait-stats-analysis, query-plan-analysis, storage-internals, server-configuration, essential-dba-queries]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Index Maintenance

Index fragmentation occurs when the physical order of data pages on disk diverges from the logical order of the B-tree index. As pages split during INSERT, UPDATE, and DELETE operations, pages become partially filled and out-of-order. Fragmented indexes cause SQL Server to read more pages than necessary for range scans, increasing I/O and elevating `PAGEIOLATCH_SH` [[wait-stats-analysis|wait statistics]].

## Why Fragmentation Matters

- **Range scans** (WHERE date BETWEEN, ORDER BY) read pages sequentially. Fragmented indexes require jumping between non-contiguous pages, causing extra I/O.
- **Partial pages** waste space — a 50% full page holds half as much data, so range scans read twice as many pages.
- **Effect on buffer pool** — more pages read means more [[memory-and-buffer-pool|buffer pool]] pressure, evicting useful cached pages.
- **Effect on small indexes** — indexes under 1,000 pages have negligible fragmentation impact regardless of the percentage. Skip them in maintenance scripts.

## Fragmentation Detection

**Check fragmentation for a specific table:**

```sql
-- Check fragmentation for all indexes on a table
SELECT
    i.name AS index_name,
    i.type_desc,
    ips.avg_fragmentation_in_percent,
    ips.page_count,
    ips.avg_page_space_used_in_percent,
    ips.fragment_count
FROM sys.dm_db_index_physical_stats(DB_ID(), OBJECT_ID('dbo.market_data'), NULL, NULL, 'LIMITED') ips
JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id;
-- 'LIMITED' = fast scan (reads only parent pages, not leaf). Use 'DETAILED' for full accuracy.
-- avg_fragmentation_in_percent = logical fragmentation (out-of-order pages)
-- avg_page_space_used_in_percent = how full each page is (low = wasted space)
```

**Fragmentation thresholds:**

| Fragmentation Level | Action |
|--------------------|--------|
| < 5% | Do nothing |
| 5–30% | REORGANIZE (online, lightweight) |
| > 30% | REBUILD (offline or online, thorough) |
| page_count < 1000 | Skip entirely — too small to matter |

**Check fragmentation across all indexes in the database:**

```sql
-- Fragmentation across ALL indexes in the database
SELECT
    OBJECT_SCHEMA_NAME(ips.object_id) + '.' + OBJECT_NAME(ips.object_id) AS table_name,
    i.name AS index_name,
    ips.avg_fragmentation_in_percent,
    ips.page_count,
    ips.index_type_desc
FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
WHERE ips.page_count > 100     -- skip tiny indexes
  AND ips.avg_fragmentation_in_percent > 5  -- skip clean indexes
ORDER BY ips.avg_fragmentation_in_percent DESC;
```

> [!warning] LIMITED vs. DETAILED Mode
> The `'LIMITED'` mode reads only the parent-level pages and is fast but approximate. `'DETAILED'` reads all leaf pages for accurate fragmentation data but is slow on large tables. Use `'LIMITED'` for regular monitoring and `'DETAILED'` only before a targeted maintenance operation.

## REORGANIZE — Online, Lightweight

REORGANIZE physically reorders the leaf pages of an index to match logical order. It is an online operation — the table remains fully accessible during the operation.

**Best for:** 5–30% fragmentation, during production hours when locking is unacceptable.

```sql
-- Reorganize a specific index (online — no blocking)
ALTER INDEX IX_ohlcv_symbol_date ON dbo.market_data REORGANIZE;
-- Physically reorders leaf pages to match logical order
-- Online operation — table remains fully accessible during reorganize
-- Compacts pages to reclaim partially-used space
-- Best for: 5-30% fragmentation, production hours

-- Reorganize ALL indexes on a table
ALTER INDEX ALL ON dbo.market_data REORGANIZE;

-- Reorganize columnstore (forces delta rowgroups into compressed segments)
ALTER INDEX CCI_archive ON dbo.market_data_archive REORGANIZE
WITH (COMPRESS_ALL_ROW_GROUPS = ON);
-- COMPRESS_ALL_ROW_GROUPS = ON → forces open delta rowgroups to compress
-- Without this flag: only closes CLOSED delta rowgroups
-- Run after bulk loads to ensure all data is compressed
```

> [!info] REORGANIZE Does Not Update Statistics
> Unlike REBUILD, REORGANIZE does not automatically update statistics. Run `UPDATE STATISTICS` separately after REORGANIZE if the data distribution has changed significantly.

## REBUILD — Heavier, More Thorough

REBUILD drops and recreates the entire index from scratch. It fully eliminates fragmentation, resets fill factor, and automatically updates statistics.

**Best for:** > 30% fragmentation, or when fill factor needs to be adjusted, or when data was compressed and needs re-compression.

```sql
-- Rebuild a specific index (offline by default)
ALTER INDEX IX_ohlcv_symbol_date ON dbo.market_data REBUILD;
-- Drops and recreates the entire index from scratch
-- Resets fragmentation to ~0%, updates statistics
-- OFFLINE: locks the table — no reads or writes during rebuild

-- Rebuild online (Enterprise/Developer edition only)
ALTER INDEX IX_ohlcv_symbol_date ON dbo.market_data REBUILD
WITH (ONLINE = ON);
-- Table remains accessible during rebuild
-- Takes longer than offline, uses more TempDB
-- Best for: production environments that cannot afford downtime

-- Rebuild with full options
ALTER INDEX IX_ohlcv_symbol_date ON dbo.market_data REBUILD
WITH (
    ONLINE = ON,
    FILLFACTOR = 90,             -- leave 10% free space on each page for future inserts
    SORT_IN_TEMPDB = ON,         -- use TempDB for sort work (reduces main DB I/O)
    DATA_COMPRESSION = PAGE,     -- compress at page level (saves ~60% space, slight CPU cost)
    MAXDOP = 2                   -- limit parallel threads to 2
);
-- FILLFACTOR: 100 = pack pages full (best for read-only), 80-90 = leave room for inserts
-- DATA_COMPRESSION: NONE | ROW (minimal) | PAGE (dictionary + prefix compression)

-- Rebuild ALL indexes on a table
ALTER INDEX ALL ON dbo.market_data REBUILD WITH (ONLINE = ON);

-- Rebuild columnstore
ALTER INDEX CCI_archive ON dbo.market_data_archive REBUILD;
-- Re-compresses all segments with optimal encoding
-- Also eliminates deleted rows (ghost records from DELETEs)
```

> [!warning] REBUILD OFFLINE Locks the Table
> Without `WITH (ONLINE = ON)`, REBUILD takes a schema modification lock that blocks all reads and writes for the duration. On a large table this can take minutes to hours. Always use `ONLINE = ON` in production unless you have a maintenance window. Note: `ONLINE = ON` requires Developer or Enterprise edition.

## Fill Factor Guidance

Fill factor controls how full SQL Server packs leaf pages during a rebuild (1–100%). A lower fill factor leaves free space on each page for future inserts, reducing page splits.

| Workload | Fill Factor | Rationale |
|----------|------------|-----------|
| Read-only reporting tables | 100% | No inserts — pack tightly for fewer pages |
| Random INSERT workload (OLTP) | 80–85% | Leave room to prevent page splits |
| Sequential INSERT (time-series) | 90–95% | Mostly appends — minimal splits |
| The market data fact table | 90% | Daily bulk loads, mostly sequential |

## Automated Maintenance Script

This script checks fragmentation and applies REORGANIZE or REBUILD based on thresholds:

```sql
-- Smart maintenance: reorganize or rebuild based on fragmentation level
DECLARE @TableName NVARCHAR(256), @IndexName NVARCHAR(256), @Frag FLOAT, @Pages BIGINT;
DECLARE @SQL NVARCHAR(MAX);

DECLARE idx_cursor CURSOR FOR
SELECT
    OBJECT_SCHEMA_NAME(ips.object_id) + '.' + OBJECT_NAME(ips.object_id),
    i.name,
    ips.avg_fragmentation_in_percent,
    ips.page_count
FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
WHERE ips.page_count > 100
  AND ips.avg_fragmentation_in_percent > 5
  AND i.name IS NOT NULL;

OPEN idx_cursor;
FETCH NEXT FROM idx_cursor INTO @TableName, @IndexName, @Frag, @Pages;

WHILE @@FETCH_STATUS = 0
BEGIN
    IF @Frag > 30
        SET @SQL = 'ALTER INDEX [' + @IndexName + '] ON ' + @TableName + ' REBUILD WITH (ONLINE = ON);';
    ELSE
        SET @SQL = 'ALTER INDEX [' + @IndexName + '] ON ' + @TableName + ' REORGANIZE;';

    PRINT @SQL;
    EXEC sp_executesql @SQL;
    FETCH NEXT FROM idx_cursor INTO @TableName, @IndexName, @Frag, @Pages;
END;

CLOSE idx_cursor;
DEALLOCATE idx_cursor;
-- Run weekly during low-usage window (e.g., Sunday 02:00 UTC)
-- For production: use Ola Hallengren's maintenance solution instead (industry standard)
-- https://ola.hallengren.com/
```

> [!tip] Use Ola Hallengren's Solution in Production
> For production environments, Ola Hallengren's [IndexOptimize](https://ola.hallengren.com/sql-server-index-and-statistics-maintenance.html) script is the industry standard. It handles edge cases (columnstore, partitioned tables, ONLINE availability), provides detailed logging, and integrates with SQL Agent. The script above is a simplified illustration.

## Statistics After Maintenance

[[query-plan-analysis|Cardinality estimation]] depends on accurate statistics. Keep them current:

```sql
-- Update statistics for a specific table with full scan (most accurate)
UPDATE STATISTICS dbo.market_data WITH FULLSCAN;

-- Update ALL statistics in the database (uses auto sampling rate)
EXEC sp_updatestats;

-- View statistics staleness for all tables in the database
SELECT
    OBJECT_SCHEMA_NAME(s.object_id) + '.' + OBJECT_NAME(s.object_id) AS table_name,
    s.name AS stat_name,
    sp.last_updated,
    sp.rows,
    sp.modification_counter,
    CAST(100.0 * sp.modification_counter / NULLIF(sp.rows, 0) AS DECIMAL(5,1)) AS pct_modified
FROM sys.stats s
CROSS APPLY sys.dm_db_stats_properties(s.object_id, s.stats_id) sp
WHERE OBJECTPROPERTY(s.object_id, 'IsUserTable') = 1
  AND sp.modification_counter > 0
ORDER BY sp.modification_counter DESC;
-- pct_modified > 20% → stats are likely stale
```

> [!info] REBUILD Updates Statistics Automatically
> An index REBUILD automatically updates statistics with a full scan (equivalent to `WITH FULLSCAN`). REORGANIZE does NOT update statistics. After REORGANIZE, always run `UPDATE STATISTICS` if the data volume changed significantly.

## Index Anti-Patterns

| Mistake | Why It's Bad | Fix |
|---------|-------------|-----|
| **Never rebuilding** | Fragmentation grows → range scans read more pages → queries slow down | Weekly maintenance: REORGANIZE at 5–30%, REBUILD at >30% |
| **Rebuilding tiny indexes** | Indexes under 1,000 pages have negligible fragmentation impact — wasting maintenance time | Skip indexes with page_count < 1,000 |
| **Over-indexing staging tables** | Staging tables are truncated and bulk-loaded — indexes slow down the load | Drop indexes before bulk load, recreate after |
| **Not updating statistics after large loads** | Stale statistics → bad query plans → table scans | `UPDATE STATISTICS table WITH FULLSCAN` after bulk loads |
| **REBUILD OFFLINE during business hours** | Locks the table for the duration | Always use `WITH (ONLINE = ON)` in production, or schedule off-hours |

## Pipeline Maintenance Schedule

```sql
-- MAINTENANCE SCHEDULE:
-- After each pipeline run (3x daily): UPDATE STATISTICS on tables that were loaded
-- Weekly (Sunday 02:00 UTC): REORGANIZE/REBUILD based on fragmentation
-- Monthly: Review unused index DMV, review missing index DMV

-- After each pipeline run
UPDATE STATISTICS dbo.market_data;
UPDATE STATISTICS silver.signals_daily;
UPDATE STATISTICS silver.signals_quarterly;

-- Weekly: full fragmentation check and maintenance
-- Run the automated maintenance script above during the Sunday 02:00 UTC window
```

**Recommended index layout for the example data model:**

```sql
-- dbo.market_data (main fact table — millions of rows, daily bulk upserts)
-- Clustered: (symbol, date) — primary access pattern for pipeline MERGE and dashboard lookups
-- NCCI for dashboard aggregates:
CREATE NONCLUSTERED COLUMNSTORE INDEX NCCI_ohlcv_dashboard
ON dbo.market_data (symbol, date, [open], high, low, [close], volume, _index);

-- dbo.daily_metrics (derived signals — daily upserts)
CREATE NONCLUSTERED INDEX IX_daily_index_date
ON dbo.daily_metrics (_index, date DESC)
INCLUDE (symbol, close, momentum_score, relative_value_score, sentiment_score);

-- dbo.quarterly_metrics (quarterly fundamentals)
CREATE NONCLUSTERED INDEX IX_quarterly_index
ON dbo.quarterly_metrics (_index)
INCLUDE (symbol, pe_ratio, pb_ratio, dividend_yield, quality_score, governance_score);

-- dbo.instrument_tickers (dimension — small, rarely updated)
CREATE NONCLUSTERED INDEX IX_tickers_active_index
ON dbo.instrument_tickers (_index, symbol)
WHERE active = 1;  -- Filtered index for active tickers only
```

## Related

- [[index-types-and-strategy]] — Choosing the right index type before maintaining it
- [[wait-stats-analysis]] — High PAGEIOLATCH_SH waits indicate fragmentation or insufficient RAM
- [[query-plan-analysis]] — Fragmented indexes cause more expensive execution plans
- [[storage-internals]] — How page splits create fragmentation at the storage level
- [[server-configuration]] — TempDB configuration affects SORT_IN_TEMPDB performance during rebuilds
- [[essential-dba-queries]] — DMV queries for index health monitoring

## References

- [sys.dm_db_index_physical_stats (Microsoft Docs)](https://learn.microsoft.com/en-us/sql/relational-databases/system-dynamic-management-views/sys-dm-db-index-physical-stats-transact-sql)
- [Ola Hallengren's SQL Server Maintenance Solution](https://ola.hallengren.com/)
- [ALTER INDEX (Microsoft Docs)](https://learn.microsoft.com/en-us/sql/t-sql/statements/alter-index-transact-sql)
