---
title: "Index Maintenance"
tags: [sql, sql-server, tsql]
aliases: [index fragmentation, index rebuild, index reorganize, fill factor, ALTER INDEX REBUILD, ALTER INDEX REORGANIZE, index defragmentation, Ola Hallengren, resumable index rebuild, dm_db_index_physical_stats, missing index suggestions, unused indexes]
description: "How to detect and fix SQL Server index fragmentation using REORGANIZE and REBUILD operations — includes fragmentation thresholds, scan modes (LIMITED/SAMPLED/DETAILED), resumable operations, automated maintenance scripts, fill factor guidance, index discovery DMVs, and a recommended maintenance schedule for data pipeline workloads."
parent: "[[domain-query-craft]]"
links:
  - "[[sargable-queries]]"
  - "[[merge-and-upsert]]"
  - "[[date-and-time-functions]]"
  - "[[execution-plans]]"
  - "[[query-plan-analysis]]"
  - "[[wait-stats-analysis]]"
  - "[[memory-and-buffer-pool]]"
  - "[[performance-audit-playbook]]"
  - "[[pipeline-integration-and-devex]]"
  - "[[pit-integrity-logic]]"
created: 2026-03-22
updated: 2026-04-04
status: complete
---

# Index Maintenance

> [!quote]
> "TempDB is like SQL Server's public toilet."
>
> — **Brent Ozar**, brentozar.com

SQL Server stores index data in a B-tree structure — a balanced tree where the root and intermediate levels contain pointers that guide lookups, and the leaf level holds the actual data rows (clustered) or row locators (nonclustered). Each level is composed of 8 KB data pages, which are the fundamental unit of I/O in SQL Server.

Index fragmentation occurs when the physical order of these data pages on disk diverges from the logical order of the B-tree. As rows are inserted, updated, or deleted, SQL Server may need to perform a page split — when a page is full and a new row must be inserted in logical order, SQL Server allocates a new page and moves roughly half the rows from the full page to the new one. The new page is typically not physically adjacent to the original, creating fragmentation. Over time, repeated page splits leave pages partially filled and scattered across the data file. Fragmented indexes cause SQL Server to read more pages than necessary for range scans, increasing I/O and elevating `PAGEIOLATCH_SH` waits — the [wait type](https://alp78.github.io/elysium/04-SQL-Server/Performance/wait-stats-analysis) that signals a thread is waiting for a data page to be read from disk into the buffer pool.

## Why Fragmentation Matters

Fragmentation primarily degrades performance for queries that perform large sequential scans — point lookups (singleton seeks) are largely unaffected because they traverse the B-tree directly to a single page.

- **Range scans** — queries with `WHERE date BETWEEN`, `ORDER BY`, or window functions read pages sequentially. SQL Server uses a read-ahead mechanism that pre-fetches up to 64 contiguous pages at a time (512 KB). When pages are out-of-order, read-ahead becomes less effective, forcing smaller, random I/O operations instead of large sequential reads.
- **Partial pages** — a 50% full page holds half as much data, so range scans read twice as many pages to retrieve the same number of rows. This is measured by the `avg_page_space_used_in_percent` column in `sys.dm_db_index_physical_stats`.
- **Buffer pool pressure** — more pages read means more [buffer pool](https://alp78.github.io/elysium/04-SQL-Server/Performance/memory-and-buffer-pool) consumption, evicting useful cached pages and increasing `PAGEIOLATCH_SH` waits.
- **Small indexes** — indexes under 1,000 pages (roughly 8 MB) have negligible fragmentation impact regardless of the percentage. SQL Server allocates small indexes on mixed extents (shared with other objects), so their pages are inherently non-contiguous. Skip them in maintenance scripts.

## Fragmentation Detection and Remediation

The primary tool for measuring index fragmentation is the dynamic management function `sys.dm_db_index_physical_stats`. It returns fragmentation statistics for indexes and heaps, including the percentage of out-of-order pages (logical fragmentation) and how full each page is (page density). The function accepts parameters for database, object, index, partition, and scan mode — passing `NULL` for any parameter returns data for all values of that parameter.

### sys.dm_db_index_physical_stats — check fragmentation for a table

This query returns fragmentation metrics for every index on a specific table. The `'SAMPLED'` scan mode reads a 1% sample of leaf pages, providing both fragmentation order and page density at moderate cost. Key columns in the result: `avg_fragmentation_in_percent` measures logical fragmentation (the percentage of out-of-order pages in the leaf level), and `avg_page_space_used_in_percent` measures page density (how full each page is — low values indicate wasted space from page splits). Use `'LIMITED'` instead if you only need fragmentation percentage and want the fastest possible scan.

```sql
SELECT
    i.name AS index_name,
    i.type_desc,
    ips.avg_fragmentation_in_percent,
    ips.page_count,
    ips.avg_page_space_used_in_percent,
    ips.fragment_count
FROM sys.dm_db_index_physical_stats(DB_ID(), OBJECT_ID('dbo.market_data'), NULL, NULL, 'SAMPLED') ips
JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id;
```

### Fragmentation thresholds — reorganize vs rebuild decision guide

The conventional thresholds below originate from Microsoft's documentation and are widely adopted as a starting point. They are guidelines, not absolute rules — the right thresholds depend on workload patterns. Fragmentation only matters for queries that perform large sequential scans; OLTP workloads dominated by single-row seeks may see no benefit from defragmentation at any percentage.

> [!info] Rebuild vs Reorganize Decision
>
> Below 5% fragmentation — do nothing (noise level). Between 5% and 30% — `ALTER INDEX REORGANIZE` (online, no lock, interruptible). Above 30% — `ALTER INDEX REBUILD` (can be done `ONLINE = ON` in Enterprise/Developer edition). Always skip indexes with fewer than 1,000 pages regardless of fragmentation percentage.

| Fragmentation Level | Action |
|--------------------|--------|
| < 5% | Do nothing |
| 5–30% | REORGANIZE (online, lightweight) |
| > 30% | REBUILD (offline or online, thorough) |
| page_count < 1000 | Skip entirely — too small to matter |

### sys.dm_db_index_physical_stats — fragmentation across all indexes

Passing `NULL` for the object ID parameter returns fragmentation data for every index in the current database. The `WHERE` clause filters out indexes below 100 pages (too small to benefit from maintenance) and below 5% fragmentation (within the noise threshold).

```sql
SELECT
    OBJECT_SCHEMA_NAME(ips.object_id) + '.' + OBJECT_NAME(ips.object_id) AS table_name,
    i.name AS index_name,
    ips.avg_fragmentation_in_percent,
    ips.page_count,
    ips.index_type_desc
FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
WHERE ips.page_count > 100
  AND ips.avg_fragmentation_in_percent > 5
ORDER BY ips.avg_fragmentation_in_percent DESC;
```

### Scan modes — LIMITED vs SAMPLED vs DETAILED

The last parameter of `sys.dm_db_index_physical_stats` controls the scan mode, which determines how much of the index is read to compute statistics. Choosing the right mode balances accuracy against the I/O cost of the scan itself.

| Mode | What it reads | Speed | Accuracy | `avg_page_space_used_in_percent` |
|------|--------------|-------|----------|----------------------------------|
| `LIMITED` | Parent-level (non-leaf) pages only | Fastest | Approximate | NULL (not available) |
| `SAMPLED` | 1% random sample of all leaf pages | Moderate | Estimated — if index has < 10,000 pages, `DETAILED` is used automatically | Approximate |
| `DETAILED` | Every leaf page in the index | Slowest | Exact | Exact |

> [!warning] LIMITED Does Not Return Page Density
>
> `LIMITED` mode cannot report `avg_page_space_used_in_percent` (page density) because it only reads non-leaf pages. If you need to assess wasted space from partial pages — not just fragmentation order — use `SAMPLED` or `DETAILED`.

> [!success] Use `LIMITED` for routine monitoring and `SAMPLED` or `DETAILED` only before targeted maintenance
>
> Schedule regular fragmentation checks with `LIMITED` to keep the DMV query fast. Switch to `SAMPLED` for a quick page density estimate, or `DETAILED` for specific indexes you are about to REBUILD where precise data justifies the extra I/O.

### REORGANIZE — Online, Lightweight

`ALTER INDEX REORGANIZE` defragments the leaf level of an index by physically reordering leaf pages to match their logical (left-to-right) order. It also compacts pages to reclaim partially-used space up to the current fill factor setting. REORGANIZE is always an online operation — it acquires only short-duration Intent-Shared (IS) locks, so the table remains fully accessible for reads and writes throughout.

REORGANIZE is interruptible: if you cancel the operation or it is interrupted (e.g., by a failover), all progress made up to that point is preserved in the database. This makes it safe to run during production hours — you can start and stop it multiple times until it completes.

**Best for:** 5–30% fragmentation, during production hours when locking is unacceptable.

#### Reorganize a specific rowstore index

```sql
ALTER INDEX IX_ohlcv_symbol_date ON dbo.market_data REORGANIZE;
```

#### Reorganize all indexes on a table

```sql
ALTER INDEX ALL ON dbo.market_data REORGANIZE;
```

#### Reorganize a columnstore index

For columnstore indexes, REORGANIZE compresses closed delta rowgroups into compressed columnstore segments and physically removes rows marked as deleted (when 10% or more of a rowgroup's rows are deleted). Without `COMPRESS_ALL_ROW_GROUPS = ON`, only closed delta rowgroups are compressed — open rowgroups are left untouched. Use this flag after bulk loads to ensure all data enters compressed storage.

```sql
ALTER INDEX CCI_archive ON dbo.market_data_archive REORGANIZE
WITH (COMPRESS_ALL_ROW_GROUPS = ON);
```

> [!info] REORGANIZE Does Not Update Statistics
>
> Unlike REBUILD, REORGANIZE does not automatically update statistics. If the data distribution changed significantly (e.g., after a large batch load), run `UPDATE STATISTICS` separately after REORGANIZE to keep the query optimizer's cardinality estimates accurate.

### REBUILD — Heavier, More Thorough

REBUILD drops and recreates the entire index from scratch. It fully eliminates fragmentation, resets fill factor, and automatically updates statistics.

**Best for:** > 30% fragmentation, or when fill factor needs to be adjusted, or when data was compressed and needs re-compression.

#### Rebuild a specific index — offline (default)

Without options, REBUILD runs offline — it acquires a Schema Modification (Sch-M) lock that blocks all reads and writes for the duration. The index is dropped and recreated from scratch, resetting fragmentation to near 0% and automatically updating statistics with a full scan. Note: even after REBUILD, fragmentation may not be exactly 0% — SQL Server assigns index chunks to different CPU cores during a parallel rebuild, and when the pieces are merged, small boundary fragmentation can occur. Use `MAXDOP = 1` to eliminate this, at the expense of longer rebuild time.

```sql
ALTER INDEX IX_ohlcv_symbol_date ON dbo.market_data REBUILD;
```

#### Rebuild a specific index — online

With `ONLINE = ON`, the table remains accessible during the rebuild. SQL Server maintains both the old and new versions of the index simultaneously, applying DML changes to both. This requires more TempDB space and takes longer than offline REBUILD, but avoids blocking production queries. Online REBUILD requires Enterprise or Developer edition.

```sql
ALTER INDEX IX_ohlcv_symbol_date ON dbo.market_data REBUILD
WITH (ONLINE = ON);
```

#### Rebuild with full options

The `FILLFACTOR` option controls how full each leaf page is packed during the rebuild (1–100%). `SORT_IN_TEMPDB = ON` offloads sort work to TempDB, reducing I/O contention on the main data file. `DATA_COMPRESSION` applies row-level (`ROW`) or page-level (`PAGE`) compression — PAGE compression uses dictionary and prefix encoding for higher savings (see [table-compression](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/table-compression)). `MAXDOP` limits the degree of parallelism — a higher value shortens rebuild duration at the expense of more CPU.

```sql
ALTER INDEX IX_ohlcv_symbol_date ON dbo.market_data REBUILD
WITH (
    ONLINE = ON,
    FILLFACTOR = 90,
    SORT_IN_TEMPDB = ON,
    DATA_COMPRESSION = PAGE,
    MAXDOP = 2
);
```

#### Rebuild all indexes on a table

```sql
ALTER INDEX ALL ON dbo.market_data REBUILD WITH (ONLINE = ON);
```

#### Rebuild a columnstore index

Rebuilding a columnstore index re-reads all data from the original columnstore and delta store, compresses it into new rowgroups with optimal encoding, and physically removes rows that were marked as deleted (ghost records from `DELETE` operations).

```sql
ALTER INDEX CCI_archive ON dbo.market_data_archive REBUILD;
```

> [!warning] REBUILD OFFLINE Blocks All Access
>
> Without `ONLINE = ON`, REBUILD acquires a Schema Modification (Sch-M) lock that blocks all reads and writes for the duration. On a large table this can take minutes to hours. `ONLINE = ON` requires Enterprise or Developer edition — Standard edition only supports offline REBUILD.

> [!success] Always use `WITH (ONLINE = ON)` for production REBUILDs
>
> `ALTER INDEX IX_name ON table REBUILD WITH (ONLINE = ON);` keeps the table fully accessible during the rebuild. Schedule offline REBUILDs only in a dedicated maintenance window when no reads or writes are expected.

### Resumable Index Operations

Starting with SQL Server 2017 (for `ALTER INDEX REBUILD`) and SQL Server 2019 (for `CREATE INDEX`), online index operations can be made resumable with the `RESUMABLE = ON` option. A resumable rebuild can be paused, resumed, or aborted — if the operation is interrupted by a failover, disk space shortage, or manual pause, it picks up from where it stopped rather than restarting from scratch.

This is particularly valuable for large tables where a REBUILD may take hours. You can fit the operation into multiple short maintenance windows instead of requiring one continuous block.

#### Rebuild with resumable enabled

The `MAX_DURATION` parameter specifies how many minutes the operation runs before automatically pausing. Once paused, reissue the same `ALTER INDEX REBUILD` command to resume.

```sql
ALTER INDEX IX_ohlcv_symbol_date ON dbo.market_data REBUILD
WITH (ONLINE = ON, RESUMABLE = ON, MAX_DURATION = 60);
```

#### Pause and resume a running rebuild

```sql
ALTER INDEX IX_ohlcv_symbol_date ON dbo.market_data PAUSE;
```

```sql
ALTER INDEX IX_ohlcv_symbol_date ON dbo.market_data RESUME;
```

#### Abort a resumable rebuild

Aborting discards the in-progress rebuild work and returns to the original index. The original index remains fully intact and usable throughout.

```sql
ALTER INDEX IX_ohlcv_symbol_date ON dbo.market_data ABORT;
```

> [!warning] Paused Resumable Rebuilds Still Consume Resources
>
> While a resumable rebuild is paused, both the original index and the partially-built new index coexist on disk, consuming additional storage. Every DML operation must update both copies. Do not leave a resumable rebuild paused indefinitely — either resume and complete it, or abort it.

> [!success] Abort paused rebuilds you don't intend to finish
>
> If you pause a resumable rebuild and decide not to continue, run `ALTER INDEX ... ABORT` to reclaim the extra disk space and eliminate the DML overhead of maintaining two index copies.

> [!info] ELEVATE_ONLINE and ELEVATE_RESUMABLE Database Options
>
> SQL Server 2019+ provides database-scoped configurations `ELEVATE_ONLINE` and `ELEVATE_RESUMABLE` that automatically promote index DDL to online or resumable execution. Setting `ELEVATE_ONLINE = WHEN_SUPPORTED` prevents accidental offline rebuilds that block table access. Set via `ALTER DATABASE SCOPED CONFIGURATION SET ELEVATE_ONLINE = WHEN_SUPPORTED;`.

### Fill Factor Guidance

Fill factor controls how full SQL Server packs leaf pages during a REBUILD (1–100%). A fill factor of 90 means each page is packed to 90% capacity, leaving 10% free space for future inserts. The free space reduces page splits by giving new rows room to be inserted in logical order without forcing a split.

Fill factor only takes effect during an index REBUILD (or CREATE INDEX) — it does not affect ongoing DML operations. Between rebuilds, pages can fill to 100% as new rows arrive. The server-wide default fill factor is 0, which is equivalent to 100% (fully packed pages). You can check the current default with `SELECT value FROM sys.configurations WHERE name = 'fill factor (%)';`.

| Workload | Fill Factor | Rationale |
|----------|------------|-----------|
| Read-only reporting tables | 100% (or 0) | No inserts — pack tightly for fewer pages and smaller index |
| Random INSERT workload (OLTP) | 80–85% | Leave room on every page to absorb random inserts and prevent page splits |
| Sequential INSERT (time-series) | 90–95% | Mostly appends at the end — minimal mid-page splits |
| The market data fact table | 90% | Daily bulk loads with MERGE, mostly sequential by (symbol, date) |

> [!info] PAD_INDEX Extends Fill Factor to Intermediate Levels
>
> By default, fill factor applies only to leaf-level pages. The `PAD_INDEX = ON` option extends the same fill factor percentage to intermediate (non-leaf) levels of the B-tree. This is rarely needed — intermediate pages hold only key values and page pointers, not full data rows, so they split far less frequently than leaf pages.

> [!tip] Monitor Page Splits to Tune Fill Factor
>
> Use `sys.dm_db_index_operational_stats` to check the `leaf_allocation_count` column — high values indicate frequent page splits. If an index with fill factor 90 still shows heavy splits, lower it to 80–85%. If splits are near zero, raise it to 95–100% to reclaim the wasted space.

### Automated Maintenance Script

This script uses a cursor to iterate over all indexes in the current database that exceed the fragmentation and page count thresholds, then applies REORGANIZE or REBUILD depending on the fragmentation level. The cursor approach is a simplified illustration — it processes indexes one at a time, prints each generated DDL statement for audit purposes, then executes it. Indexes below 100 pages or below 5% fragmentation are skipped. Heap indexes (where `i.name IS NULL`) are excluded.

Schedule this script weekly during a low-usage window (e.g., Sunday 02:00 UTC) via SQL Server Agent.

```sql
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
```

> [!tip] Use Ola Hallengren's IndexOptimize in Production
>
> For production environments, [Ola Hallengren's IndexOptimize](https://ola.hallengren.com/sql-server-index-and-statistics-maintenance.html) is the industry standard for index and statistics maintenance. It handles edge cases the script above does not — columnstore indexes, partitioned tables, `ONLINE` availability detection per edition, LOB column restrictions, detailed logging, and email notifications. It integrates with SQL Server Agent and supports a `@FragmentationLow`, `@FragmentationMedium`, `@FragmentationHigh` parameter model for threshold-based decisions. The script above is a learning illustration; use Hallengren's solution for real workloads.

> [!tip] Microsoft's Adaptive Index Defrag
>
> Microsoft's [Adaptive Index Defrag](https://github.com/Microsoft/tigertoolbox/tree/master/AdaptiveIndexDefrag) script from the Tiger Toolbox is another open-source alternative. It automatically chooses between REORGANIZE and REBUILD based on fragmentation level and also handles statistics updates with a linear threshold.

### Statistics After Maintenance

SQL Server's query optimizer uses statistics objects — histograms and density vectors — to estimate how many rows a query will return (cardinality estimation). Inaccurate statistics lead the optimizer to choose suboptimal plans: too few estimated rows may trigger nested loop joins on large tables; too many may cause unnecessary hash joins or table scans. [Cardinality estimation](https://alp78.github.io/elysium/04-SQL-Server/Performance/query-plan-analysis) depends on accurate, up-to-date statistics.

SQL Server auto-updates statistics when roughly 20% of rows have changed (with a lower threshold of `SQRT(1000 * table_rows)` on tables over 25,000 rows when trace flag 2371 is active — enabled by default starting with SQL Server 2016 under compatibility level 130+). However, auto-update is triggered lazily (on the next query compilation that uses the stale stats), so after a large bulk load the first query may get a bad plan before auto-update fires.

#### Update statistics for a specific table with full scan

`WITH FULLSCAN` reads every row in the table to build the histogram, producing the most accurate statistics. Use this after bulk loads where data distribution changes significantly.

```sql
UPDATE STATISTICS dbo.market_data WITH FULLSCAN;
```

#### Update all statistics in the database

`sp_updatestats` updates only statistics that are stale (where `modification_counter > 0`). It uses the auto-sampling rate, not a full scan.

```sql
EXEC sp_updatestats;
```

#### View statistics staleness for all tables

The `modification_counter` column from `sys.dm_db_stats_properties` tracks how many row modifications have occurred since the last statistics update. A `pct_modified` above 20% is a strong signal that the statistics are stale and should be updated manually.

```sql
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
```

> [!info] REBUILD Automatically Updates Statistics
>
> An index REBUILD automatically updates statistics with a full scan (equivalent to `UPDATE STATISTICS ... WITH FULLSCAN`). REORGANIZE does not update statistics. After REORGANIZE on a table that received significant data changes, always run `UPDATE STATISTICS` separately to keep cardinality estimates accurate.

### Index Anti-Patterns

Common index maintenance mistakes, their consequences, and the correct approach.

| Mistake | Why It's Bad | Fix |
|---------|-------------|-----|
| **Never rebuilding** | Fragmentation grows → range scans read more pages → queries slow down | Weekly maintenance: REORGANIZE at 5–30%, REBUILD at >30% |
| **Rebuilding tiny indexes** | Indexes under 1,000 pages (~8 MB) have negligible fragmentation impact — wasting maintenance time and I/O | Skip indexes with `page_count < 1000` in maintenance scripts |
| **Over-indexing staging tables** | Staging tables are truncated and bulk-loaded — indexes slow down the load with per-row maintenance overhead | Drop indexes before bulk load, recreate after |
| **Ignoring partitioned indexes** | Each partition fragments independently and may need separate maintenance | Use `REBUILD PARTITION = N` to target hot partitions only (see [partitioning-strategies](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/partitioning-strategies)) |
| **Not updating statistics after large loads** | Stale statistics → bad cardinality estimates → suboptimal query plans (table scans, wrong join types) | `UPDATE STATISTICS table WITH FULLSCAN` after bulk loads |
| **REBUILD OFFLINE during business hours** | Sch-M lock blocks all reads and writes for the duration | Always use `WITH (ONLINE = ON)` in production, or schedule off-hours |
| **SHRINK then REBUILD** | `DBCC SHRINKFILE` moves pages to fill gaps, re-fragmenting indexes that were just rebuilt | Always run SHRINK before REBUILD if both are needed — never shrink after |

## Pipeline Maintenance Schedule

The maintenance cadence below is tuned for a data pipeline that runs 3x daily, loading market data and derived signals into a medallion-layer SQL Server database.

| Frequency | Action | Scope |
|-----------|--------|-------|
| After each pipeline run (3x daily) | `UPDATE STATISTICS ... WITH FULLSCAN` | Tables that received bulk loads |
| Weekly (Sunday 02:00 UTC) | REORGANIZE / REBUILD based on fragmentation | All indexes via automated maintenance script |
| Monthly | Review unused index DMV, review missing index DMV | Database-wide index audit |

### Update statistics after each pipeline run

```sql
UPDATE STATISTICS dbo.market_data;
UPDATE STATISTICS silver.signals_daily;
UPDATE STATISTICS silver.signals_quarterly;
```

### Recommended index layout for medallion data model

The indexes below support the primary access patterns: pipeline MERGE operations key on `(symbol, date)`, dashboards aggregate across symbols and date ranges, and dimension lookups filter by active tickers and index membership.

#### dbo.market_data — main fact table

The clustered index on `(symbol, date)` aligns with the MERGE key. The nonclustered columnstore index (NCCI) provides compressed columnar storage for dashboard aggregation queries that scan wide ranges of rows.

```sql
CREATE NONCLUSTERED COLUMNSTORE INDEX NCCI_ohlcv_dashboard
ON dbo.market_data (symbol, date, [open], high, low, [close], volume, _index);
```

#### dbo.daily_metrics — derived signals

Key columns `(_index, date DESC)` support lookups by stock index with most-recent-first ordering. The `INCLUDE` columns cover the dashboard's SELECT list, enabling index-only scans without key lookups.

```sql
CREATE NONCLUSTERED INDEX IX_daily_index_date
ON dbo.daily_metrics (_index, date DESC)
INCLUDE (symbol, close, momentum_score, relative_value_score, sentiment_score);
```

#### dbo.quarterly_metrics — quarterly fundamentals

```sql
CREATE NONCLUSTERED INDEX IX_quarterly_index
ON dbo.quarterly_metrics (_index)
INCLUDE (symbol, pe_ratio, pb_ratio, dividend_yield, quality_score, governance_score);
```

#### dbo.instrument_tickers — dimension table

A filtered index on `WHERE active = 1` indexes only the active tickers, keeping the index small and fast. Since the dimension table is small and rarely updated, maintenance overhead is negligible.

```sql
CREATE NONCLUSTERED INDEX IX_tickers_active_index
ON dbo.instrument_tickers (_index, symbol)
WHERE active = 1;
```

## Index Discovery

Before creating new indexes or deciding which to drop, you need a complete picture of what already exists, how each index is used, and what the optimizer wishes it had. The DMVs in this section provide that visibility.

### Index Metadata — all indexes with key and included columns

This query joins `sys.indexes`, `sys.index_columns`, and `sys.columns` to produce a complete inventory of every index on a table, showing the key columns (used for seeks and ordering) separately from included columns (carried in the leaf for covering queries, not part of the B-tree key). The `CASE` expression inside `STRING_AGG` splits the two column lists — SQL Server does not support the `FILTER (WHERE ...)` aggregate syntax used in PostgreSQL.

```sql
SELECT
    i.index_id,
    i.name              AS index_name,
    i.type_desc,
    i.is_unique,
    i.is_primary_key,
    i.is_unique_constraint,
    i.fill_factor,
    i.is_disabled,
    i.allow_page_locks,
    i.allow_row_locks,
    i.has_filter,
    i.filter_definition,
    STRING_AGG(CASE WHEN ic.is_included_column = 0 THEN c.name END, ', ')
        WITHIN GROUP (ORDER BY ic.key_ordinal)  AS key_columns,
    STRING_AGG(CASE WHEN ic.is_included_column = 1 THEN c.name END, ', ')
        WITHIN GROUP (ORDER BY ic.key_ordinal)  AS included_columns
FROM sys.indexes i
JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
JOIN sys.columns c        ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE i.object_id = OBJECT_ID('dbo.trades')
GROUP BY i.index_id, i.name, i.type_desc, i.is_unique, i.is_primary_key,
         i.is_unique_constraint, i.fill_factor, i.is_disabled,
         i.allow_page_locks, i.allow_row_locks, i.has_filter, i.filter_definition
ORDER BY i.index_id;
```

### Index Usage Stats — seeks, scans, lookups, and updates since last restart

`sys.dm_db_index_usage_stats` tracks cumulative read and write operations per index since the last SQL Server restart or the last time the index was rebuilt. Understanding the four operation types is essential for evaluating index value:

| Counter | Meaning | Example |
|---------|---------|---------|
| `user_seeks` | B-tree traversal to a specific key value or range — the most efficient read pattern | `WHERE symbol = 'AAPL' AND date = '2026-01-15'` using a covering index |
| `user_scans` | Full leaf-level scan of the entire index — expensive on large indexes | `SELECT * FROM market_data` with no useful WHERE predicate |
| `user_lookups` | Key lookup (bookmark lookup) from a nonclustered index back to the clustered index to fetch columns not covered by the nonclustered index | Nonclustered index satisfies the WHERE clause but the SELECT list includes columns not in the index |
| `user_updates` | Write operations (INSERT, UPDATE, DELETE) that must maintain the index — every DML touching an indexed column increments this | A daily bulk MERGE updates 50,000 rows → each nonclustered index on the table gets 50,000 update operations |

An index with high `user_updates` but zero reads is pure overhead — it costs write performance without serving any queries.

```sql
SELECT
    OBJECT_SCHEMA_NAME(ius.object_id)   AS schema_name,
    OBJECT_NAME(ius.object_id)          AS table_name,
    i.name                              AS index_name,
    i.type_desc,
    ius.user_seeks,
    ius.user_scans,
    ius.user_lookups,
    ius.user_updates,
    ius.user_seeks + ius.user_scans + ius.user_lookups AS total_reads,
    ius.last_user_seek,
    ius.last_user_scan,
    ius.last_user_update
FROM sys.dm_db_index_usage_stats ius
JOIN sys.indexes i ON ius.object_id = i.object_id AND ius.index_id = i.index_id
WHERE ius.database_id = DB_ID()
ORDER BY total_reads DESC;
```

> [!warning] Usage Stats Reset on Restart, Offline, and Detach
>
> These stats reset on SQL Server restart, database offline, or database detach. In older builds (SQL Server 2012 prior to SP2 CU12, SQL Server 2014 prior to SP2), stats also cleared on index rebuild. If the server was recently restarted, the data is not representative — wait at least one full business cycle (1 week) before making drop decisions. Also note that usage stats on an Availability Group primary do not reflect queries running on readable secondaries — indexes used only on secondaries will appear unused on the primary.

> [!success] Check `sys.dm_os_sys_info.sqlserver_start_time` before making drop decisions
>
> Run `SELECT sqlserver_start_time FROM sys.dm_os_sys_info;` to verify uptime. If the server restarted within the last 7 days, defer any index drop decision until a full business cycle of usage data has accumulated.

### Unused Indexes — indexes with zero reads but ongoing write cost

This query identifies indexes that have never been used for a seek, scan, or lookup — but are still being updated on every INSERT, UPDATE, or DELETE. These are pure overhead: they consume disk space, slow down writes, and generate unnecessary I/O during maintenance. The query excludes heaps, primary keys, and unique constraints (which serve integrity enforcement even if never directly sought).

```sql
SELECT
    OBJECT_SCHEMA_NAME(ius.object_id)   AS schema_name,
    OBJECT_NAME(ius.object_id)          AS table_name,
    i.name                              AS index_name,
    ius.user_seeks, ius.user_scans, ius.user_lookups,
    ius.user_updates                    AS writes_maintaining_index
FROM sys.dm_db_index_usage_stats ius
JOIN sys.indexes i ON ius.object_id = i.object_id AND ius.index_id = i.index_id
WHERE ius.database_id = DB_ID()
  AND ius.user_seeks = 0
  AND ius.user_scans = 0
  AND ius.user_lookups = 0
  AND i.type_desc <> 'HEAP'
  AND i.is_primary_key = 0
  AND i.is_unique = 0
ORDER BY ius.user_updates DESC;
```

> [!warning] Verify Full Business Cycle Before Dropping
>
> An unused index still costs write performance — every INSERT/UPDATE/DELETE must maintain it. But verify the stats cover a full business cycle. An index used only during month-end reporting shows zero usage for 29 days.

> [!success] Wait for at least one full business cycle, then disable before dropping
>
> Before dropping, `ALTER INDEX IX_name ON table DISABLE;` to stop maintaining it without removing it. Run through a full month-end cycle. If no query complaints arise, then `DROP INDEX`. Disabling is reversible; dropping is not.

### Missing Index Suggestions — SQL Server's recommended indexes ranked by impact

When the query optimizer compiles a plan and identifies that a potentially useful index does not exist, it records the suggestion in the `sys.dm_db_missing_index_*` DMVs. The `improvement_measure` formula below combines three factors: `avg_total_user_cost` (average cost of queries that would benefit), `avg_user_impact` (estimated percentage cost reduction if the index existed, 0–100), and the total number of seeks and scans that would have used it. A higher score means greater cumulative benefit across all queries.

> [!warning] Never Blindly Create All Suggestions
>
> Missing index suggestions are per-query, not per-workload. They may recommend overlapping indexes (differing only in included columns), indexes that benefit one query but add write overhead to many others, or indexes on low-selectivity columns that the optimizer would not actually seek on. The feature also has a known limitation: it does not generate suggestions for queries that receive a trivial plan optimization (simple queries the optimizer can plan without cost-based search). Like usage stats, missing index DMVs reset on SQL Server restart. Always review suggestions holistically — never create all of them.

> [!success] Review suggestions for overlaps, then create only those with high `improvement_measure` scores
>
> Sort by `improvement_measure` and focus on the top 3–5. Check whether two suggestions differ only in `included_columns` — if so, merge them into one covering index. Test each new index on a non-production copy before applying to production.

```sql
SELECT TOP 20
    mid.database_id,
    DB_NAME(mid.database_id)                AS database_name,
    OBJECT_SCHEMA_NAME(mid.object_id, mid.database_id) AS schema_name,
    OBJECT_NAME(mid.object_id, mid.database_id)        AS table_name,
    migs.avg_total_user_cost *
        migs.avg_user_impact *
        (migs.user_seeks + migs.user_scans)             AS improvement_measure,
    migs.unique_compiles,
    migs.user_seeks,
    migs.user_scans,
    migs.avg_total_user_cost                            AS avg_cost_without_index,
    migs.avg_user_impact,
    mid.equality_columns,
    mid.inequality_columns,
    mid.included_columns,
    'CREATE INDEX IX_' + OBJECT_NAME(mid.object_id, mid.database_id)
        + '_' + REPLACE(ISNULL(mid.equality_columns,''), ', ', '_')
        + ' ON ' + mid.statement
        + ' (' + ISNULL(mid.equality_columns, '')
        + CASE WHEN mid.inequality_columns IS NOT NULL
               THEN CASE WHEN mid.equality_columns IS NOT NULL THEN ', ' ELSE '' END
                    + mid.inequality_columns ELSE '' END + ')'
        + CASE WHEN mid.included_columns IS NOT NULL
               THEN ' INCLUDE (' + mid.included_columns + ')' ELSE '' END
        AS create_statement
FROM sys.dm_db_missing_index_details mid
JOIN sys.dm_db_missing_index_groups mig  ON mid.index_handle = mig.index_handle
JOIN sys.dm_db_missing_index_group_stats migs ON mig.index_group_handle = migs.group_handle
WHERE mid.database_id = DB_ID()
ORDER BY improvement_measure DESC;
```

## Related

- [index-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/index-types-and-strategy) — Choosing the right index type before maintaining it
- [wait-stats-analysis](https://alp78.github.io/elysium/04-SQL-Server/Performance/wait-stats-analysis) — High PAGEIOLATCH_SH waits indicate fragmentation or insufficient RAM
- [query-plan-analysis](https://alp78.github.io/elysium/04-SQL-Server/Performance/query-plan-analysis) — Fragmented indexes cause more expensive execution plans
- [storage-internals](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/storage-internals) — How page splits create fragmentation at the storage level
- [server-configuration](https://alp78.github.io/elysium/04-SQL-Server/Administration/server-configuration) — TempDB configuration affects SORT_IN_TEMPDB performance during rebuilds
- [essential-dba-queries](https://alp78.github.io/elysium/04-SQL-Server/Administration/essential-dba-queries) — DMV queries for index health monitoring

## References

- [sys.dm_db_index_physical_stats (Microsoft Docs)](https://learn.microsoft.com/en-us/sql/relational-databases/system-dynamic-management-views/sys-dm-db-index-physical-stats-transact-sql)
- [Optimize index maintenance to improve query performance (Microsoft Docs)](https://learn.microsoft.com/en-us/sql/relational-databases/indexes/reorganize-and-rebuild-indexes)
- [ALTER INDEX (Microsoft Docs)](https://learn.microsoft.com/en-us/sql/t-sql/statements/alter-index-transact-sql)
- [Guidelines for online index operations (Microsoft Docs)](https://learn.microsoft.com/en-us/sql/relational-databases/indexes/guidelines-for-online-index-operations)
- [Ola Hallengren's SQL Server Maintenance Solution](https://ola.hallengren.com/)
- [Microsoft Tiger Toolbox — Adaptive Index Defrag](https://github.com/Microsoft/tigertoolbox/tree/master/AdaptiveIndexDefrag)
