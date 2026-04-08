---
title: "Table Compression"
tags: [sql, sql-server, storage, tsql]
aliases: [SQL Server compression, row compression, page compression, DATA_COMPRESSION, sp_estimate_data_compression_savings]
description: "Production guide to SQL Server row and page compression: when compression helps, how to estimate savings, how to validate the actual reduction, and when compression should be avoided."
parent: "[[domain-database-design-and-storage]]"
links:
  - "[[storage-internals]]"
  - "[[index-types-and-strategy]]"
  - "[[index-maintenance]]"
created: 2026-03-22
updated: 2026-04-08
status: complete
---

# Table Compression

SQL Server table and index compression reduce page count by storing rows more efficiently. The benefit is not only disk savings. Fewer pages usually means:

- fewer logical reads
- smaller buffer-pool footprint
- less I/O for scans and range reads

The tradeoff is CPU. Compression is therefore a storage-engine trade: more CPU work during access and maintenance in exchange for fewer pages on disk and in memory.

## Compression Types

For rowstore tables and indexes, the practical production choices are `NONE`, `ROW`, and `PAGE`.

| Compression | What it changes | Typical benefit | Main tradeoff | Best fit |
|---|---|---|---|---|
| `NONE` | No compression | None | None | Hot write-heavy tables when page count is already low |
| `ROW` | Stores fixed-length values in a more compact variable-length form where possible | Moderate page reduction | Small CPU overhead | Mixed workloads and moderately active tables |
| `PAGE` | Applies row compression first, then page-level prefix and dictionary compression | Highest page reduction | More CPU overhead on access and rebuild | Read-heavy tables, historical data, cold partitions |

`PAGE` includes the `ROW` techniques automatically. You do not combine both manually.

Microsoft documents row and page compression behavior, supported objects, and estimation procedure details in the [data compression documentation](https://learn.microsoft.com/en-us/sql/relational-databases/data-compression/data-compression).

## Current Compression Posture

Before recommending compression, verify what is already compressed. In `stoxx`, almost all rowstore indexes are still uncompressed, while the small analytical demos already show clustered columnstore compression.

### `sys.partitions` | inspect current compression across the database

This query reads the current compression descriptor from the storage metadata and shows actual used page counts.

#### `sys.partitions` + `sys.dm_db_partition_stats` | check current compression state

This is the first check before any compression rollout or rebuild.

*Return the current compression descriptor, size, and row count for the largest indexes in `stoxx`.*

```sql
SELECT TOP 20
    SCHEMA_NAME(o.schema_id) + '.' + o.name AS table_name,
    i.name AS index_name,
    i.type_desc,
    p.data_compression_desc AS compression,
    CAST(ps.used_page_count * 8.0 / 1024 AS decimal(10,2)) AS size_mb,
    ps.row_count
FROM sys.objects AS o
JOIN sys.indexes AS i
    ON o.object_id = i.object_id
JOIN sys.partitions AS p
    ON i.object_id = p.object_id
   AND i.index_id = p.index_id
JOIN sys.dm_db_partition_stats AS ps
    ON i.object_id = ps.object_id
   AND i.index_id = ps.index_id
WHERE o.type = 'U'
  AND i.index_id > 0
ORDER BY size_mb DESC;
```

| table_name | index_name | type_desc | compression | size_mb | row_count |
|---|---|---|---|---:|---:|
| `dbo.demo_idxmaint_rowstore` | `CIX_demo_idxmaint_row_guid` | `CLUSTERED` | `NONE` | 188.02 | 671550 |
| `dbo.demo_idxmaint_missing` | `PK_demo_idxmaint_missing` | `CLUSTERED` | `NONE` | 93.88 | 671550 |
| `dbo.demo_idxmaint_rowstore` | `IX_demo_idxmaint_symbol_date` | `NONCLUSTERED` | `NONE` | 34.84 | 671550 |
| `dbo.demo_idxmaint_splits` | `CIX_demo_idxmaint_splits` | `CLUSTERED` | `NONE` | 22.95 | 100000 |
| `dbo.demo_eurostoxx50_ohlcv` | `CIX_demo_eurostoxx50_ohlcv` | `CLUSTERED` | `NONE` | 6.24 | 67155 |
| `silver.eurostoxx50_ohlcv` | `PK__eurostox__3213E83FDF67D274` | `CLUSTERED` | `NONE` | 6.02 | 67155 |
| `silver.stoxxasia50_ohlcv` | `PK__stoxxasi__3213E83F66A8DE5E` | `CLUSTERED` | `NONE` | 5.80 | 64875 |
| `silver.stoxxusa50_ohlcv` | `PK__stoxxusa__3213E83FC84E3F24` | `CLUSTERED` | `NONE` | 5.77 | 66000 |
| `dbo.demo_table_compression` | `CIX_demo_table_compression` | `CLUSTERED` | `PAGE` | 1.13 | 50000 |
| `dbo.demo_index_types_columnstore` | `CCI_demo_index_types_columnstore` | `CLUSTERED COLUMNSTORE` | `COLUMNSTORE` | 0.63 | 50000 |

_The current rowstore baseline is overwhelmingly `NONE`. The most useful signal is not the demo noise; it is that the real `silver` fact tables remain uncompressed, so any production recommendation to use compression still has to be justified object by object. The output also shows that `PAGE` and `COLUMNSTORE` are reflected distinctly in storage metadata._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `compression` | `NONE` | Depends | No row/page compression is active. | Default baseline; compression decision is still open. |
| `compression` | `ROW` | Depends | Row compression is active. | Good middle ground when page savings matter but write activity remains meaningful. |
| `compression` | `PAGE` | ✅ for read-heavy rowstore data | Page compression is active. | Highest rowstore savings, but more CPU work. |
| `compression` | `COLUMNSTORE` | Depends | Columnstore compression is active. | Separate storage model from row/page compression. |

## Estimate Before You Rebuild

Never enable compression blindly. SQL Server provides `sp_estimate_data_compression_savings` so you can compare current size to projected size before changing the actual object.

### `sp_estimate_data_compression_savings` | estimate on a real live table

`gold.index_performance` is a good live candidate because it is small, stable, and read-facing.

#### `sp_estimate_data_compression_savings` | compare `ROW` and `PAGE` on `gold.index_performance`

This procedure estimates size changes for all indexes on the table under the requested compression mode.

*Estimate the projected size of `gold.index_performance` under `ROW` and `PAGE` compression before changing the table.*

```sql
EXEC sp_estimate_data_compression_savings
    @schema_name = 'gold',
    @object_name = 'index_performance',
    @index_id = NULL,
    @partition_number = NULL,
    @data_compression = 'ROW';

EXEC sp_estimate_data_compression_savings
    @schema_name = 'gold',
    @object_name = 'index_performance',
    @index_id = NULL,
    @partition_number = NULL,
    @data_compression = 'PAGE';
```

| object_name | schema_name | index_id | partition_number | size_with_current_compression_setting_kb | size_with_requested_compression_setting_kb | sample_size_with_current_compression_setting_kb | sample_size_with_requested_compression_setting_kb |
|---|---|---:|---:|---:|---:|---:|---:|
| `index_performance` | `gold` | 1 | 1 | 672 | 488 | 728 | 536 |
| `index_performance` | `gold` | 2 | 1 | 200 | 192 | 232 | 224 |
| `index_performance` | `gold` | 1 | 1 | 672 | 368 | 728 | 400 |
| `index_performance` | `gold` | 2 | 1 | 200 | 120 | 232 | 144 |

_The clustered index estimate is the important part here. `ROW` compression would reduce the clustered structure from 672 KB to 488 KB, while `PAGE` would reduce it further to 368 KB. The nonclustered index also benefits, but less dramatically. This is the exact pattern that justifies page compression on read-heavy, repetitive data: the extra CPU cost buys a meaningful page-count reduction._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `size_with_requested_compression_setting_kb` much lower than current | ✅ | Compression should shrink the object materially. | Strong candidate for implementation. |
| `size_with_requested_compression_setting_kb` close to current | Depends | Compression benefit is small. | CPU tradeoff may not be worth it. |
| `PAGE` estimate much better than `ROW` | ✅ for cold/read-heavy data | Page-level dictionary/prefix compression is finding repetition. | Consider `PAGE` if write activity is low enough. |
| `PAGE` estimate barely better than `ROW` | Depends | Page-level techniques add little beyond row compression. | `ROW` may be the safer balance. |

## Validate The Actual Reduction On A Disposable Table

An estimate is still only an estimate. The safest teaching pattern is to apply compression to a disposable copy and verify the actual page-count change.

### Demo setup

This disposable table copies 50,000 rows from `silver.eurostoxx50_ohlcv` into a simple clustered rowstore shape.

#### `CREATE TABLE` + `CREATE CLUSTERED INDEX` | build the disposable compression demo

This creates the table that the next before/after comparison uses.

*Create the disposable rowstore table used to validate actual page-compression savings.*

```sql
IF OBJECT_ID('dbo.demo_table_compression', 'U') IS NOT NULL
    DROP TABLE dbo.demo_table_compression;

SELECT TOP (50000)
    id,
    symbol,
    [date],
    [close],
    volume
INTO dbo.demo_table_compression
FROM silver.eurostoxx50_ohlcv
ORDER BY id;

CREATE CLUSTERED INDEX CIX_demo_table_compression
    ON dbo.demo_table_compression(id);

SELECT COUNT(*) AS row_count
FROM dbo.demo_table_compression;
```

| row_count |
|---:|
| 50000 |

_The demo table now has 50,000 rows and a simple clustered rowstore layout, which makes the compression effect easy to compare._

#### Baseline compression state

This verifies the starting size and compression descriptor before rebuilding with `PAGE`.

*Return the current compression state and used page count before applying compression.*

```sql
SELECT
    i.name AS index_name,
    p.data_compression_desc AS compression,
    ps.row_count,
    ps.used_page_count,
    CAST(ps.used_page_count * 8.0 / 1024 AS decimal(10,2)) AS size_mb
FROM sys.indexes AS i
JOIN sys.partitions AS p
    ON i.object_id = p.object_id
   AND i.index_id = p.index_id
JOIN sys.dm_db_partition_stats AS ps
    ON i.object_id = ps.object_id
   AND i.index_id = ps.index_id
WHERE i.object_id = OBJECT_ID('dbo.demo_table_compression')
  AND i.index_id > 0;
```

| index_name | compression | row_count | used_page_count | size_mb |
|---|---|---:|---:|---:|
| `CIX_demo_table_compression` | `NONE` | 50000 | 296 | 2.31 |

_Before compression, the clustered index occupies 296 pages, or about 2.31 MB._

### Apply compression

Compression is a rebuild operation. It rewrites the object physically with the requested storage format.

#### `ALTER INDEX ... REBUILD WITH (DATA_COMPRESSION = PAGE)` | apply page compression

This rebuilds the clustered index with `PAGE` compression.

> [!warning]
>
> Compression rebuilds are fully state-changing operations. On large objects they consume log, CPU, and maintenance-window time. On non-Enterprise/Developer environments, online options may also be limited depending on operation and edition.

> [!success]
>
> Use `sp_estimate_data_compression_savings` first, test on a disposable copy when possible, and schedule production rebuilds in a controlled window with post-checks on size and workload impact.

*Rebuild the disposable clustered index with `PAGE` compression enabled.*

```sql
ALTER INDEX CIX_demo_table_compression
    ON dbo.demo_table_compression
REBUILD WITH (DATA_COMPRESSION = PAGE);
```

#### Post-change validation

This checks the actual page count after the rebuild.

*Return the current compression state and used page count after applying `PAGE` compression.*

```sql
SELECT
    i.index_id,
    i.name AS index_name,
    p.partition_number,
    p.data_compression_desc AS compression,
    ps.row_count,
    ps.used_page_count,
    CAST(ps.used_page_count * 8.0 / 1024 AS decimal(10,2)) AS size_mb
FROM sys.indexes AS i
JOIN sys.partitions AS p
    ON i.object_id = p.object_id
   AND i.index_id = p.index_id
JOIN sys.dm_db_partition_stats AS ps
    ON i.object_id = ps.object_id
   AND i.index_id = ps.index_id
WHERE i.object_id = OBJECT_ID('dbo.demo_table_compression')
  AND i.index_id > 0
ORDER BY i.index_id, p.partition_number;
```

| index_id | index_name | partition_number | compression | row_count | used_page_count | size_mb |
|---|---|---:|---|---:|---:|---:|
| 1 | `CIX_demo_table_compression` | 1 | `PAGE` | 50000 | 144 | 1.13 |

_The actual reduction is substantial: from 296 pages to 144 pages, or from 2.31 MB to 1.13 MB. That is about a 51% page-count reduction on this disposable copy. This is exactly the kind of result that can justify page compression for read-heavy tables._

## How To Choose `ROW` vs `PAGE`

- Choose `ROW` when the table still sees meaningful write activity and the estimate shows a worthwhile reduction.
- Choose `PAGE` when the table is read-heavy, historically stable, or partitioned into colder slices.
- Do not compress tiny tables just because the feature exists. A few pages do not justify extra CPU or maintenance complexity.
- If `PAGE` barely improves on `ROW`, prefer `ROW`.

## Operational Recommendations

- Compress read-heavy gold tables and older historical partitions first.
- Avoid broad page-compression rollouts on hot write-heavy bronze tables.
- Re-check page count and query-read patterns after compression. The goal is fewer pages and lower I/O, not just a new metadata flag.
- Remember that columnstore compression is a different storage model; do not treat `COLUMNSTORE` as interchangeable with row/page compression.
- Keep compression strategy aligned with [[index-maintenance]] so rebuild jobs preserve the intended compression setting.

## Related

- [[storage-internals]]
- [[index-types-and-strategy]]
- [[index-maintenance]]

