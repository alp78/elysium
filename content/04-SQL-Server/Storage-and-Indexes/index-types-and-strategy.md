---
type: concept
category: sql-server
technology: [sql-server]
tags: [sql]
aliases: [clustered index, nonclustered index, covering index, filtered index, columnstore index, CCI, NCCI, composite index, index key, INCLUDE columns, bookmark lookup, key lookup, index seek, index scan, B-tree, fill factor, fragmentation, REORGANIZE, REBUILD, statistics]
keywords: [clustered index, nonclustered index, covering index, filtered index, columnstore index, CCI, NCCI, composite index, INCLUDE, bookmark lookup, key lookup, index seek, index scan, B-tree, fill factor, fragmentation, REORGANIZE, REBUILD, statistics, UPDATE STATISTICS, FULLSCAN, missing index DMV, sys.dm_db_missing_index_details, sys.dm_db_index_usage_stats, sys.dm_db_index_physical_stats, heap, GUID clustered key, NEWSEQUENTIALID, unique index, primary key, index anti-patterns, index decision tree, auto update statistics, DBCC SHOW_STATISTICS, index maintenance]
description: "All SQL Server index types (clustered, nonclustered, covering, filtered, columnstore) with creation syntax, usage guidance, the decision tree for choosing the right type, anti-patterns, fragmentation detection and maintenance, statistics management, and the data pipeline index strategy."
related: [storage-internals, index-maintenance, sargable-queries, execution-plans, performance-audit-playbook, server-configuration]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Index Types and Strategy

Indexes are the single most impactful lever for SQL Server query performance. The right index on the right columns turns a full table scan (thousands of page reads) into a B-tree seek (3-4 page reads). The wrong indexes, or too many indexes, slow down every INSERT, UPDATE, and DELETE. This note covers all index types, how to choose among them, and how to maintain them over time.

---

## Index Types — What They Are and When to Use Each

### B-Tree Rowstore Indexes (Default)

The standard index type. Data is organized in a balanced tree structure where leaf nodes contain the indexed columns (or full rows for clustered). Every query path in OLTP workloads relies on B-tree indexes.

| Index Type | What It Does | When to Use |
|---|---|---|
| **Clustered** | Physically sorts the entire table by the index key. The table IS the index — leaf nodes contain all columns. One per table. | Primary key, the column you most frequently range-scan or JOIN on. Example: `(symbol, date)` on `dbo.market_data`. |
| **Nonclustered** | Separate B-tree structure pointing back to the clustered index key (or heap RID). Multiple per table. | Filter columns in WHERE, JOIN keys, ORDER BY columns. |
| **Unique** | Clustered or nonclustered with a uniqueness constraint. Rejects duplicate values. | Primary keys, natural keys, any column that must be unique (e.g., `symbol + date`). |
| **Composite** | Single index on multiple columns. Column order matters — leftmost column is the most important. | Multi-column WHERE filters, covering queries. `(symbol, date)` vs `(date, symbol)` — use the one matching your most common filter first. |
| **Covering** | Nonclustered index that includes all columns a query needs via INCLUDE clause. Eliminates bookmark lookups. | Frequently-run queries where the nonclustered index is used but SQL Server still needs to look up extra columns from the clustered index. |
| **Filtered** | Nonclustered index with a WHERE clause — indexes only a subset of rows. | Sparse columns, status flags. Example: `WHERE active = 1` when 90% of rows are inactive. Smaller index, faster scans. |

### Columnstore Indexes

Data is stored column-by-column instead of row-by-row, compressed in segments of ~1M rows. Designed for analytics — aggregations over millions of rows scan only the needed columns.

| Index Type | What It Does | When to Use |
|---|---|---|
| **Clustered Columnstore (CCI)** | Replaces the entire table storage with columnar format. No B-tree. One per table. | Pure analytics/warehouse tables with bulk loads and aggregate queries. Not for single-row lookups. |
| **Nonclustered Columnstore (NCCI)** | Adds a columnar index alongside the existing rowstore table. Both coexist. | Hybrid OLTP+analytics — keep the rowstore for transactional writes, add NCCI for reporting queries. Example: add NCCI on `dbo.market_data` for dashboard aggregate queries while keeping rowstore for pipeline upserts. |

### When Columnstore Beats Rowstore

| Scenario | Winner | Why |
|---|---|---|
| `SELECT AVG(close) FROM ohlcv WHERE _index = 'market_index'` (millions of rows) | Columnstore | Reads only `close` and `_index` columns, 10x compression, batch mode execution |
| `SELECT * FROM ohlcv WHERE symbol = 'ASML' AND date = '2025-03-09'` (single row) | Rowstore | B-tree seeks to exact row in microseconds; columnstore must scan segments |
| `INSERT INTO ohlcv VALUES (...)` (single row) | Rowstore | Columnstore uses a deltastore for single inserts — slower, requires background tuple mover |
| Bulk load 100k+ rows | Columnstore | Direct segment compression, no B-tree maintenance |
| `GROUP BY sector ORDER BY avg_score DESC` | Columnstore | Batch mode aggregation, segment elimination |

---

## Exploring Existing Indexes

#### sys.indexes + sys.index_columns — list all indexes on a table

```sql
-- List ALL indexes on a specific table
SELECT
    i.name AS index_name,
    i.type_desc AS index_type,          -- CLUSTERED, NONCLUSTERED, CLUSTERED COLUMNSTORE, etc.
    i.is_unique,
    i.is_primary_key,
    i.filter_definition,                -- NULL if not filtered
    STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS key_columns,
    STRING_AGG(CASE WHEN ic.is_included_column = 1 THEN c.name END, ', ') AS included_columns
FROM sys.indexes i
JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE i.object_id = OBJECT_ID('dbo.market_data')
GROUP BY i.name, i.type_desc, i.is_unique, i.is_primary_key, i.filter_definition
ORDER BY i.index_id;
-- key_columns = columns in the index key (order matters for composite)
-- included_columns = INCLUDE columns (leaf-only, not in the B-tree)
-- filter_definition = WHERE clause for filtered indexes
```

#### sys.indexes + sys.tables — list all indexes across the database

```sql
-- List ALL indexes across the entire database
SELECT
    OBJECT_SCHEMA_NAME(i.object_id) + '.' + OBJECT_NAME(i.object_id) AS table_name,
    i.name AS index_name,
    i.type_desc,
    i.is_unique,
    i.is_primary_key
FROM sys.indexes i
WHERE OBJECTPROPERTY(i.object_id, 'IsUserTable') = 1
ORDER BY table_name, i.index_id;
```

#### sys.dm_db_index_physical_stats — detailed index sizes and page counts

```sql
-- Detailed index info with sizes
SELECT
    OBJECT_SCHEMA_NAME(i.object_id) + '.' + OBJECT_NAME(i.object_id) AS table_name,
    i.name AS index_name,
    i.type_desc,
    ps.row_count,
    CAST(ps.used_page_count * 8.0 / 1024 AS DECIMAL(10,2)) AS size_mb,
    ps.in_row_data_page_count,
    ps.lob_used_page_count
FROM sys.indexes i
JOIN sys.dm_db_partition_stats ps ON i.object_id = ps.object_id AND i.index_id = ps.index_id
WHERE OBJECTPROPERTY(i.object_id, 'IsUserTable') = 1
ORDER BY size_mb DESC;
-- size_mb = how much disk space this index consumes
-- Largest indexes are candidates for review — are they actually used?
```

#### sys.indexes type = 0 — check if a table is a heap

```sql
-- Check if a table is a HEAP (no clustered index)
SELECT
    OBJECT_SCHEMA_NAME(object_id) + '.' + OBJECT_NAME(object_id) AS table_name
FROM sys.indexes
WHERE type = 0  -- 0 = HEAP
  AND OBJECTPROPERTY(object_id, 'IsUserTable') = 1;
-- Heaps have no physical ordering — every query is a full scan
-- Almost always add a clustered index (exception: staging tables with truncate-reload)
```

#### sys.index_columns is_descending_key — view columns with sort direction

```sql
-- View index columns with sort direction
SELECT
    i.name AS index_name,
    c.name AS column_name,
    ic.key_ordinal,
    CASE WHEN ic.is_descending_key = 1 THEN 'DESC' ELSE 'ASC' END AS sort_direction,
    ic.is_included_column
FROM sys.indexes i
JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE i.object_id = OBJECT_ID('dbo.market_data')
ORDER BY i.index_id, ic.key_ordinal;
```

---

## Index Usage Analysis — Are Your Indexes Being Used?

#### sys.dm_db_index_usage_stats — index reads vs writes since restart

```sql
-- Index usage statistics (reads vs. writes)
SELECT
    OBJECT_SCHEMA_NAME(i.object_id) + '.' + OBJECT_NAME(i.object_id) AS table_name,
    i.name AS index_name,
    i.type_desc,
    s.user_seeks,       -- index seek operations (good — means index is used efficiently)
    s.user_scans,       -- full index scans (ok for small tables, bad for large)
    s.user_lookups,     -- bookmark lookups (nonclustered → clustered to get extra columns)
    s.user_updates,     -- how often DML (INSERT/UPDATE/DELETE) maintains this index
    s.user_seeks + s.user_scans + s.user_lookups AS total_reads,
    s.last_user_seek,
    s.last_user_scan
FROM sys.indexes i
LEFT JOIN sys.dm_db_index_usage_stats s
    ON i.object_id = s.object_id AND i.index_id = s.index_id AND s.database_id = DB_ID()
WHERE OBJECTPROPERTY(i.object_id, 'IsUserTable') = 1
ORDER BY total_reads DESC;
-- INTERPRETATION:
-- High user_seeks, low user_scans = healthy index (point lookups)
-- High user_scans = possible missing covering columns or wrong index key
-- High user_updates, zero reads = DEAD INDEX — drop it to save write overhead
-- user_lookups > 0 = key lookup happening — consider INCLUDE columns
```

#### dm_db_index_usage_stats user_seeks = 0 — find unused indexes

```sql
-- UNUSED indexes (zero reads since last restart)
SELECT
    OBJECT_SCHEMA_NAME(i.object_id) + '.' + OBJECT_NAME(i.object_id) AS table_name,
    i.name AS index_name,
    i.type_desc,
    s.user_updates AS write_cost,
    CAST(ps.used_page_count * 8.0 / 1024 AS DECIMAL(10,2)) AS size_mb
FROM sys.indexes i
LEFT JOIN sys.dm_db_index_usage_stats s
    ON i.object_id = s.object_id AND i.index_id = s.index_id AND s.database_id = DB_ID()
JOIN sys.dm_db_partition_stats ps
    ON i.object_id = ps.object_id AND i.index_id = ps.index_id
WHERE OBJECTPROPERTY(i.object_id, 'IsUserTable') = 1
  AND i.type > 0  -- exclude heaps
  AND i.is_primary_key = 0
  AND i.is_unique_constraint = 0
  AND ISNULL(s.user_seeks, 0) = 0
  AND ISNULL(s.user_scans, 0) = 0
  AND ISNULL(s.user_lookups, 0) = 0
ORDER BY s.user_updates DESC;
-- WARNING: dm_db_index_usage_stats resets on service restart
-- Check uptime first: SELECT sqlserver_start_time FROM sys.dm_os_sys_info
-- Only drop unused indexes if uptime covers a full business cycle (at least 1 week)
```

#### sys.index_columns STRING_AGG — find duplicate indexes (same key columns)

```sql
-- DUPLICATE indexes (same key columns — waste of space and write I/O)
WITH IndexColumns AS (
    SELECT
        i.object_id,
        i.index_id,
        i.name,
        i.type_desc,
        STRING_AGG(c.name, ',') WITHIN GROUP (ORDER BY ic.key_ordinal) AS key_cols
    FROM sys.indexes i
    JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id AND ic.is_included_column = 0
    JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    WHERE OBJECTPROPERTY(i.object_id, 'IsUserTable') = 1
    GROUP BY i.object_id, i.index_id, i.name, i.type_desc
)
SELECT
    OBJECT_SCHEMA_NAME(a.object_id) + '.' + OBJECT_NAME(a.object_id) AS table_name,
    a.name AS index_a, a.type_desc AS type_a,
    b.name AS index_b, b.type_desc AS type_b,
    a.key_cols
FROM IndexColumns a
JOIN IndexColumns b ON a.object_id = b.object_id AND a.key_cols = b.key_cols AND a.index_id < b.index_id;
-- Same key columns on the same table = one of them is redundant
-- Keep the one with INCLUDE columns or unique constraint; drop the other
```

---

## Missing Index Recommendations

#### sys.dm_db_missing_index_details — built-in missing index recommendations

```sql
-- SQL Server's built-in missing index suggestions
SELECT TOP 20
    CONVERT(DECIMAL(18,2), migs.avg_total_user_cost * migs.avg_user_impact *
        (migs.user_seeks + migs.user_scans)) AS improvement_score,
    migs.user_seeks,
    migs.user_scans,
    OBJECT_SCHEMA_NAME(mid.object_id) + '.' + OBJECT_NAME(mid.object_id) AS table_name,
    mid.equality_columns,     -- columns in WHERE col = value (highest selectivity)
    mid.inequality_columns,   -- columns in WHERE col > value, col BETWEEN, ORDER BY
    mid.included_columns,     -- columns in SELECT list (to avoid bookmark lookups)
    'CREATE NONCLUSTERED INDEX [IX_' + OBJECT_NAME(mid.object_id) + '_'
        + REPLACE(REPLACE(ISNULL(mid.equality_columns,''), ', ', '_'), '[', '')
        + '] ON ' + OBJECT_SCHEMA_NAME(mid.object_id) + '.' + OBJECT_NAME(mid.object_id)
        + ' (' + ISNULL(mid.equality_columns, '')
        + CASE WHEN mid.equality_columns IS NOT NULL AND mid.inequality_columns IS NOT NULL
               THEN ', ' ELSE '' END
        + ISNULL(mid.inequality_columns, '') + ')'
        + CASE WHEN mid.included_columns IS NOT NULL
               THEN ' INCLUDE (' + mid.included_columns + ')'
               ELSE '' END AS create_statement
FROM sys.dm_db_missing_index_groups mig
JOIN sys.dm_db_missing_index_group_stats migs ON mig.index_group_handle = migs.group_handle
JOIN sys.dm_db_missing_index_details mid ON mig.index_handle = mid.index_handle
WHERE mid.database_id = DB_ID()
ORDER BY improvement_score DESC;
-- improvement_score = estimated benefit (higher = more impactful)
-- CAUTION: These are suggestions, not commands. Always evaluate:
--   1. Does this duplicate an existing index?
--   2. Is the table heavily written to? (more indexes = slower inserts)
--   3. Can I extend an existing index with INCLUDE instead of creating a new one?
--   4. Resets on service restart — only trust after sufficient uptime
```

#### XML plan MissingIndex — find cached plans with missing index warnings

```sql
-- Missing index suggestions from a specific query plan
SELECT TOP 10
    query_plan,
    total_elapsed_time / execution_count AS avg_elapsed_us,
    execution_count
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_query_plan(qs.plan_handle) qp
WHERE CAST(query_plan AS NVARCHAR(MAX)) LIKE '%MissingIndex%'
ORDER BY total_elapsed_time DESC;
-- Finds cached query plans that contain missing index warnings
```

---

## Creating Indexes — All Flavors

### Single-Column Nonclustered

```sql
-- Basic nonclustered index
CREATE NONCLUSTERED INDEX IX_market_data_symbol
ON dbo.market_data (symbol);
-- Creates a B-tree on the symbol column
-- Use for: WHERE symbol = 'ASML' (equality filter on one column)

-- Unique nonclustered
CREATE UNIQUE NONCLUSTERED INDEX UX_instrument_tickers_symbol
ON dbo.instrument_tickers (symbol);
-- Enforces uniqueness + provides seek capability
-- Fails on INSERT/UPDATE that would create a duplicate
```

### Composite (Multi-Column)

```sql
-- Two-column composite index
CREATE NONCLUSTERED INDEX IX_market_data_symbol_date
ON dbo.market_data (symbol, date);
-- Column order matters:
-- WHERE symbol = 'ASML' AND date = '2025-03-09'  → SEEK (both columns used)
-- WHERE symbol = 'ASML'                           → SEEK (leftmost prefix)
-- WHERE date = '2025-03-09'                       → SCAN (first column skipped — index less useful)

-- Three-column composite
CREATE NONCLUSTERED INDEX IX_daily_index_sector_date
ON dbo.daily_metrics (_index, sector, date DESC);
-- DESC on date = most recent dates at the top of the index
-- Optimal for: WHERE _index = 'market_index' AND sector = 'Technology' ORDER BY date DESC

-- GUIDELINE: Column order in composite indexes
-- 1st position: Most selective equality column (highest cardinality in WHERE = )
-- 2nd position: Next equality column
-- Last position: Range/inequality column (>, <, BETWEEN, ORDER BY)
-- Example: WHERE _index = 'market_index' AND sector = 'Technology' AND date >= '2025-01-01'
--   Index: (_index, sector, date) — equalities first, range last
```

### Covering Indexes (with INCLUDE)

```sql
-- Nonclustered with INCLUDE columns
CREATE NONCLUSTERED INDEX IX_market_data_symbol_date_cover
ON dbo.market_data (symbol, date)
INCLUDE (close, volume, high, low);
-- Key columns (symbol, date) = used for seeking/filtering
-- INCLUDE columns (close, volume, high, low) = stored in leaf only, not in B-tree
-- Result: query reads ONLY this index — no bookmark lookup to the clustered index

-- WHEN TO ADD INCLUDE:
-- Run the query, check the execution plan. If you see a "Key Lookup" or "RID Lookup"
-- operator, the nonclustered index was used but SQL Server needed extra columns.
-- Add those extra columns to INCLUDE.

-- Example: This query causes a key lookup without INCLUDE:
-- SELECT symbol, date, close, volume FROM dbo.market_data WHERE symbol = 'ASML' AND date >= '2025-01-01'
-- With the covering index above: no lookup needed, pure index scan at leaf level

-- INCLUDE vs adding to key:
-- INCLUDE: column is at leaf level only — doesn't affect seek order, smaller B-tree
-- Key: column is in every B-tree level — only put columns here if they're in WHERE/ORDER BY
```

### Filtered Indexes

```sql
-- Index only active tickers
CREATE NONCLUSTERED INDEX IX_instrument_tickers_active
ON dbo.instrument_tickers (symbol, _index)
WHERE active = 1;
-- Only indexes rows where active = 1
-- Much smaller than a full index if most rows are inactive
-- Faster seeks, less storage, less maintenance overhead

-- Index only recent data
CREATE NONCLUSTERED INDEX IX_market_data_recent
ON dbo.market_data (symbol, date)
INCLUDE (close)
WHERE date >= '2024-01-01';
-- Indexes only the last ~1 year of data
-- Perfect for dashboard queries that never look at old data

-- LIMITATIONS:
-- 1. Filter must use simple comparisons (=, >, <, IN) — no functions, no LIKE
-- 2. Query WHERE clause must be a superset of the filter (or SQL Server won't use it)
-- 3. Can't be used with parameterized queries unless OPTION(RECOMPILE) is used
--    (because the optimizer doesn't know the parameter value at compile time)

-- Parameterized query forcing filtered index usage:
SELECT * FROM dbo.instrument_tickers WHERE symbol = @sym AND active = 1 OPTION (RECOMPILE);
-- OPTION (RECOMPILE) = recompile plan each execution — optimizer sees actual @sym value
-- Trade-off: compilation cost vs. better plan — worth it for infrequent complex queries
```

### Clustered Index

```sql
-- Create clustered index (defines physical row order)
CREATE CLUSTERED INDEX CX_market_data
ON dbo.market_data (symbol, date);
-- The table is now physically sorted by (symbol, date)
-- Only ONE clustered index per table
-- All nonclustered indexes point to the clustered key

-- Clustered on identity column (most common default)
CREATE TABLE dbo.audit_log (
    id BIGINT IDENTITY(1,1),
    event_type VARCHAR(50),
    event_data NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_audit_log PRIMARY KEY CLUSTERED (id)
);
-- IDENTITY = auto-incrementing → sequential inserts → no page splits → minimal fragmentation
-- Best for: append-only tables, logging, audit trails

-- Choosing the right clustered index key:
-- NARROW: fewer bytes = smaller nonclustered indexes (they all store the clustered key)
-- UNIQUE: avoids the 4-byte uniquifier SQL Server adds to non-unique clustered keys
-- STATIC: columns that don't change — updates to the clustered key cause physical row moves
-- EVER-INCREASING: sequential values minimize page splits (INT IDENTITY, DATETIME2, SEQUENCE)

-- ANTI-PATTERN: GUID as clustered key
-- Random GUIDs cause massive page splits and fragmentation
-- If you must use GUID: use NEWSEQUENTIALID() instead of NEWID()
CREATE TABLE dbo.bad_example (
    id UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID(),  -- sequential, not random
    CONSTRAINT PK_bad PRIMARY KEY CLUSTERED (id)
);
```

### Columnstore Indexes

```sql
-- Clustered Columnstore Index (CCI) — replaces table storage entirely
CREATE CLUSTERED COLUMNSTORE INDEX CCI_market_data_archive
ON dbo.market_data_archive;
-- Entire table is now stored in columnar segments (~1M rows each)
-- 10x compression ratio typical — great for archival/analytics tables
-- Best for: read-heavy tables with aggregate queries, rarely updated
-- AVOID for: single-row OLTP lookups, frequent single-row inserts

-- CCI with ordering (SQL Server 2022+)
CREATE CLUSTERED COLUMNSTORE INDEX CCI_market_data_archive
ON dbo.market_data_archive
ORDER (symbol, date);
-- Ordered CCI = segment elimination based on sorted column min/max values
-- Query: WHERE symbol = 'ASML' → skips all segments where symbol min > 'ASML' or max < 'ASML'
-- Similar to Parquet row group pruning

-- Nonclustered Columnstore Index (NCCI) — hybrid approach
CREATE NONCLUSTERED COLUMNSTORE INDEX NCCI_market_data_analytics
ON dbo.market_data (symbol, date, close, volume, high, low, _index);
-- Adds columnstore alongside existing rowstore (B-tree) storage
-- Rowstore handles OLTP (inserts, point lookups)
-- NCCI handles analytics (aggregations, scans)
-- SQL Server optimizer picks the right one per query

-- Filtered NCCI — columnstore on a subset
CREATE NONCLUSTERED COLUMNSTORE INDEX NCCI_market_data_recent
ON dbo.market_data (symbol, date, close, volume)
WHERE date >= '2024-01-01';
-- Columnstore benefits only for recent data
-- Smaller index, faster to build and maintain

-- WHEN TO USE COLUMNSTORE IN the data pipeline:
-- Dashboard queries: "average close by index over 3 years" → scans millions of rows → columnstore wins
-- Pipeline upserts: "MERGE into ohlcv WHERE symbol = @s AND date = @d" → single-row → rowstore wins
-- Solution: keep rowstore clustered index for pipeline, add NCCI for dashboard
```

### Unique Constraints and Primary Keys

```sql
-- Primary Key (clustered by default)
ALTER TABLE dbo.instrument_tickers
ADD CONSTRAINT PK_instrument_tickers PRIMARY KEY CLUSTERED (symbol);

-- Primary Key (nonclustered — when you want a different clustered key)
ALTER TABLE dbo.daily_metrics
ADD CONSTRAINT PK_daily_metrics PRIMARY KEY NONCLUSTERED (symbol, date);
-- Useful when the clustered index should be on a different column (e.g., identity)

-- Unique constraint
ALTER TABLE dbo.instrument_tickers
ADD CONSTRAINT UQ_instrument_tickers_isin UNIQUE (isin);
-- Creates a unique nonclustered index behind the scenes
-- Allows one NULL (unlike some databases that allow multiple NULLs)
```

---

## Index Fragmentation — Detection and Maintenance

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

-- INTERPRETATION:
-- < 5% fragmentation     → do nothing
-- 5-30% fragmentation    → REORGANIZE (online, lightweight)
-- > 30% fragmentation    → REBUILD (offline or online, heavier but thorough)
-- page_count < 1000      → too small to matter — skip it
```

#### sys.dm_db_index_physical_stats — check fragmentation across all indexes

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
WHERE ips.page_count > 100    -- skip tiny indexes
  AND ips.avg_fragmentation_in_percent > 5  -- skip clean indexes
ORDER BY ips.avg_fragmentation_in_percent DESC;
```

### REORGANIZE (Online, Lightweight)

Use for 5-30% fragmentation. Safe to run during production hours.

```sql
-- Reorganize a specific index (online — no blocking)
ALTER INDEX IX_market_data_symbol_date ON dbo.market_data REORGANIZE;
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

### REBUILD (Heavier, More Thorough)

Use for >30% fragmentation. Drops and recreates the index from scratch. Resets statistics.

```sql
-- Rebuild a specific index (offline by default)
ALTER INDEX IX_market_data_symbol_date ON dbo.market_data REBUILD;
-- Drops and recreates the entire index from scratch
-- Resets fragmentation to ~0%, updates statistics
-- OFFLINE: locks the table — no reads or writes during rebuild

-- Rebuild online (Enterprise/Developer edition only)
ALTER INDEX IX_market_data_symbol_date ON dbo.market_data REBUILD
WITH (ONLINE = ON);
-- Table remains accessible during rebuild
-- Takes longer than offline, uses more TempDB
-- Best for: production environments that can't afford downtime

-- Rebuild with options
ALTER INDEX IX_market_data_symbol_date ON dbo.market_data REBUILD
WITH (
    ONLINE = ON,
    FILLFACTOR = 90,              -- leave 10% free space on each page for future inserts
    SORT_IN_TEMPDB = ON,          -- use TempDB for sort work (reduces main DB I/O)
    DATA_COMPRESSION = PAGE,      -- compress at page level (saves ~60% space, slight CPU cost)
    MAXDOP = 2                    -- limit parallel threads to 2
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

### Automated Maintenance Script

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

---

## Statistics — The Optimizer's Data Map

Statistics tell the query optimizer how data is distributed in each column. Without accurate statistics, the optimizer makes bad guesses about row counts, leading to terrible execution plans.

#### sys.stats + dm_db_stats_properties — view all statistics on a table

```sql
-- View all statistics on a table
SELECT
    s.name AS stat_name,
    s.auto_created,
    s.user_created,
    s.no_recompute,
    sp.last_updated,
    sp.rows,
    sp.rows_sampled,
    sp.modification_counter    -- rows changed since last stats update
FROM sys.stats s
CROSS APPLY sys.dm_db_stats_properties(s.object_id, s.stats_id) sp
WHERE s.object_id = OBJECT_ID('dbo.market_data')
ORDER BY sp.last_updated;
-- modification_counter = how stale the stats are (high = needs update)
-- rows_sampled / rows = sample rate (< 100% means stats may be approximate)
```

#### dm_db_stats_properties modification_counter — find stale statistics

```sql
-- STALE statistics (changed significantly since last update)
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
-- Auto-update triggers at ~20% modifications (or sqrt(1000 * rows) in SQL Server 2016+)
```

#### UPDATE STATISTICS WITH FULLSCAN — refresh statistics after bulk loads

```sql
-- Update statistics for a specific index
UPDATE STATISTICS dbo.market_data IX_market_data_symbol_date;

-- Update with full scan (most accurate — reads every row)
UPDATE STATISTICS dbo.market_data IX_market_data_symbol_date WITH FULLSCAN;
-- FULLSCAN = 100% sample — most accurate but slowest
-- Default sample = auto (SQL Server picks a sample rate based on table size)

-- Update ALL statistics on a table
UPDATE STATISTICS dbo.market_data WITH FULLSCAN;

-- Update ALL statistics in the database
EXEC sp_updatestats;
-- Updates only statistics that have been modified since last update
-- Uses default sample rate (not full scan)
```

#### DBCC SHOW_STATISTICS — view histogram data distribution

```sql
-- View the histogram (data distribution) for a statistic
DBCC SHOW_STATISTICS('dbo.market_data', 'IX_market_data_symbol_date');
-- Returns 3 result sets:
-- 1. Header: name, last updated, rows, rows sampled
-- 2. Density vector: average selectivity per column combination
-- 3. Histogram: up to 200 steps showing value distribution
--    RANGE_HI_KEY = upper bound of the step
--    EQ_ROWS = rows matching exactly this value
--    RANGE_ROWS = rows between previous step and this one
--    DISTINCT_RANGE_ROWS = distinct values in the range
--    AVG_RANGE_ROWS = average rows per distinct value in range
```

#### ALTER DATABASE SET AUTO_CREATE_STATISTICS ON — enable auto stats

```sql
-- Enable auto-create and auto-update (should always be ON)
ALTER DATABASE analytics_db SET AUTO_CREATE_STATISTICS ON;
ALTER DATABASE analytics_db SET AUTO_UPDATE_STATISTICS ON;
ALTER DATABASE analytics_db SET AUTO_UPDATE_STATISTICS_ASYNC ON;
-- AUTO_CREATE: creates statistics on columns used in WHERE when no stats exist
-- AUTO_UPDATE: refreshes stats when modification_counter exceeds threshold
-- ASYNC: stats update happens in background (query doesn't wait)
```

> [!tip] Always Update Statistics After Bulk Loads
> After any pipeline run that inserts or updates more than 10% of a table, statistics may be stale. The optimizer will make poor plan choices until statistics reflect the new data distribution. Run `UPDATE STATISTICS table WITH FULLSCAN` immediately after large loads.

---

## Index Strategy Decision Tree

Use this flowchart to decide which index type to create:

```
START: What query pattern are you optimizing?
│
├─ Point lookup (WHERE col = value, single row)
│  └─ Is this the primary access pattern for the table?
│     ├─ YES → CLUSTERED INDEX on that column
│     └─ NO  → NONCLUSTERED INDEX on that column
│
├─ Range scan (WHERE col BETWEEN, col >= , ORDER BY)
│  └─ Is it combined with equality filters?
│     ├─ YES → COMPOSITE INDEX: equality columns first, range column last
│     │        Example: (symbol, date) for WHERE symbol = 'ASML' AND date >= '2025-01-01'
│     └─ NO  → NONCLUSTERED INDEX on the range column
│
├─ Multi-column filter (WHERE a = x AND b = y AND c > z)
│  └─ COMPOSITE INDEX: most selective equality first, range last
│     Then check: does the query SELECT other columns?
│     ├─ YES → Add those to INCLUDE (covering index)
│     └─ NO  → Key columns only
│
├─ Aggregate / GROUP BY over large data (millions of rows)
│  └─ Is the table mostly read, rarely written?
│     ├─ YES → CLUSTERED COLUMNSTORE INDEX
│     └─ NO  → NONCLUSTERED COLUMNSTORE INDEX (hybrid)
│
├─ JOIN on a foreign key column
│  └─ NONCLUSTERED INDEX on the FK column in the child table
│     (Parent table's PK is already indexed)
│
├─ Sparse filter (WHERE active = 1, and 90% of rows are 0)
│  └─ FILTERED NONCLUSTERED INDEX with WHERE active = 1
│
└─ ORDER BY without WHERE (e.g., TOP 10 ORDER BY date DESC)
   └─ NONCLUSTERED INDEX on (date DESC)
       Consider INCLUDE for the SELECT columns
```

---

## Index Anti-Patterns and Common Mistakes

| Mistake | Why It's Bad | Fix |
|---|---|---|
| **Too many indexes** on a write-heavy table | Every INSERT/UPDATE/DELETE must maintain all indexes — slows writes by 2-10x | Drop unused indexes. Aim for 5-7 max on OLTP tables. |
| **Wrong column order** in composite index | `(date, symbol)` when queries filter by `symbol` first → index scan instead of seek | Put the most selective equality column first. |
| **Missing INCLUDE** columns | Nonclustered seek + key lookup to clustered = 2x I/O | Add frequently-selected columns to INCLUDE. |
| **GUID clustered key** (NEWID) | Random values → page splits → 99% fragmentation → excessive I/O | Use INT IDENTITY or NEWSEQUENTIALID(). |
| **Indexing every column** mentioned in missing index DMV | Missing index DMV suggests one index per query — creates explosion of overlapping indexes | Consolidate: one composite index can serve multiple queries. |
| **Never rebuilding** | Fragmentation grows → range scans read more pages → queries slow down over time | Weekly maintenance: REORGANIZE at 5-30%, REBUILD at >30%. |
| **Rebuilding tiny indexes** | Indexes under 1000 pages have negligible fragmentation impact — wasting maintenance time | Skip indexes with page_count < 1000. |
| **Over-indexing staging tables** | Staging tables are truncated and bulk-loaded — indexes slow down the load | Drop indexes before bulk load, recreate after. Or use heap (no clustered index). |
| **Not updating statistics** after large data loads | Stale statistics → optimizer estimates wrong row counts → picks bad join strategies | `UPDATE STATISTICS table WITH FULLSCAN` after bulk loads. |
| **Filtered index** without OPTION(RECOMPILE) | Parameterized queries may not use the filtered index because optimizer doesn't know the parameter value | Add `OPTION(RECOMPILE)` or use local variables. |

---

## Pipeline Index Strategy

Recommended index layout for the example data model:

```sql
-- dbo.market_data (main fact table — millions of rows, daily bulk upserts)
-- Clustered: (symbol, date) — primary access pattern for pipeline MERGE and dashboard lookups
-- NCCI for dashboard aggregates:
CREATE NONCLUSTERED COLUMNSTORE INDEX NCCI_market_data_dashboard
ON dbo.market_data (symbol, date, [open], high, low, [close], volume, _index);

-- dbo.daily_metrics (derived signals — daily upserts)
-- Clustered: (symbol, date)
-- Nonclustered for dashboard leaderboard:
CREATE NONCLUSTERED INDEX IX_daily_index_date
ON dbo.daily_metrics (_index, date DESC)
INCLUDE (symbol, close, momentum_score, relative_value_score, sentiment_score);

-- dbo.quarterly_metrics (quarterly fundamentals)
-- Clustered: (symbol, quarter_end)
-- Nonclustered for dashboard:
CREATE NONCLUSTERED INDEX IX_quarterly_index
ON dbo.quarterly_metrics (_index)
INCLUDE (symbol, pe_ratio, pb_ratio, dividend_yield, quality_score, governance_score);

-- dbo.instrument_tickers (dimension — small, rarely updated)
-- Clustered PK: (symbol)
-- Filtered for active:
CREATE NONCLUSTERED INDEX IX_instrument_tickers_active_index
ON dbo.instrument_tickers (_index, symbol)
WHERE active = 1;

-- dbo.gold_scores (pre-computed — dashboard reads only)
-- Clustered: (symbol, date)
-- NCCI for ranking queries:
CREATE NONCLUSTERED COLUMNSTORE INDEX NCCI_gold_scores
ON dbo.gold_scores (symbol, date, composite_score, rank_overall, _index, sector);

-- MAINTENANCE SCHEDULE:
-- After each pipeline run (3x daily): UPDATE STATISTICS on tables that were loaded
-- Weekly (Sunday 02:00 UTC): REORGANIZE/REBUILD based on fragmentation
-- Monthly: Review unused index DMV, review missing index DMV
```

---

## Related

- [[storage-internals]] — B-tree page structure, page splits, and how indexes are stored
- [[index-maintenance]] — dedicated maintenance procedures and scheduling
- [[sargable-queries]] — writing predicates that enable index seeks instead of scans
- [[execution-plans]] — reading execution plans to identify missing indexes and key lookups
- [[performance-audit-playbook]] — structured audit incorporating index analysis
- [[server-configuration]] — heap detection and statistics update after bulk loads
