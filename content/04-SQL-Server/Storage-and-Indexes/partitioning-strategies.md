---
type: concept
category: sql-server
technology: [sql-server]
tags: [sql]
aliases: [SQL Server partitioning, table partitioning, partition function, partition scheme, partition elimination, SWITCH partition, horizontal partitioning, date-based partitioning]
keywords: [partitioning, partition function, partition scheme, partition elimination, SWITCH, partition boundary, trade_date, monthly partitioning, yearly partitioning, FILEGROUP, sys.partitions, sys.partition_functions, sys.partition_schemes, partition_number, archiving, sliding window, columnstore partition, partition key, RIGHT vs LEFT partition function]
description: "SQL Server table partitioning by date: partition functions, partition schemes, creating partitioned clustered indexes, partition elimination for query performance, SWITCH for fast archiving and loading, and the sliding window pattern for ongoing pipelines."
related: [storage-internals, index-types-and-strategy, table-compression, index-maintenance, performance-audit-playbook, blocking-and-locking, bronze-layer-loading]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Partitioning Strategies

SQL Server table partitioning divides a large table into smaller horizontal slices based on a partition key column — typically a date. Each partition is a logically independent unit: queries that filter on the partition key can skip entire partitions without scanning them (partition elimination). Partitions also enable fast `SWITCH` operations that move a full partition between tables in milliseconds — the basis for efficient archiving and sliding-window pipeline patterns. BigQuery uses the same partitioning concept for [[querying-and-cost-optimization|cost optimization and query performance]].

> [!info] When to Partition
> Only partition when a single table exceeds **10 million rows** and queries consistently filter by the partition key. Partitioning small tables adds metadata overhead with no performance benefit. The number one use case is large time-series tables (financial price data, pipeline audit logs) where most queries filter by `trade_date` or a similar date column.

---

## How SQL Server Partitioning Works

SQL Server partitioning has three required components:

```
PARTITION FUNCTION         →    PARTITION SCHEME         →    PARTITIONED TABLE
────────────────────────────    ───────────────────────────    ──────────────────────────────
Defines the boundary values     Maps partitions to filegroups   Clustered index uses the scheme
for splitting the data          (usually PRIMARY for simple     as its storage target
                                setups)
```

#### Partition layout — yearly boundaries for market_data time-series

```
Partition 1: trade_date < '2021-01-01'   (pre-2021 historical)
Partition 2: trade_date >= '2021-01-01' AND < '2022-01-01'   (2021)
Partition 3: trade_date >= '2022-01-01' AND < '2023-01-01'   (2022)
Partition 4: trade_date >= '2023-01-01' AND < '2024-01-01'   (2023)
Partition 5: trade_date >= '2024-01-01' AND < '2025-01-01'   (2024)
Partition 6: trade_date >= '2025-01-01' AND < '2026-01-01'   (2025)
Partition 7: trade_date >= '2026-01-01'                       (2026 — current year)
```

---

## Step 1: Create the Partition Function

The partition function defines the boundary values and whether the boundary belongs to the left or right partition.

```sql
-- YEARLY partition function for trade_date (DATE type)
-- RIGHT means: the boundary value goes in the right (higher) partition
--   Partition 1: trade_date < '2021-01-01'
--   Partition 2: trade_date >= '2021-01-01' AND < '2022-01-01'
--   ... etc.
CREATE PARTITION FUNCTION pf_trade_date_yearly (DATE)
AS RANGE RIGHT FOR VALUES (
    '2021-01-01',
    '2022-01-01',
    '2023-01-01',
    '2024-01-01',
    '2025-01-01',
    '2026-01-01'
);

-- Verify the function was created
SELECT
    pf.name,
    pf.boundary_value_on_right,
    prv.value AS boundary_value,
    prv.boundary_id
FROM sys.partition_functions pf
JOIN sys.partition_range_values prv ON pf.function_id = prv.function_id
WHERE pf.name = 'pf_trade_date_yearly'
ORDER BY prv.boundary_id;
```

> [!info] RIGHT vs LEFT Partition Functions
> - **RANGE RIGHT:** The boundary value is included in the RIGHT (higher) partition. `'2022-01-01'` goes into the "2022" partition.
> - **RANGE LEFT:** The boundary value is included in the LEFT (lower) partition. `'2021-12-31'` goes into the "2021" partition.
>
> For date-based partitions, RANGE RIGHT is the conventional choice because the boundary is the first day of the new period.

---

## Step 2: Create the Partition Scheme

The partition scheme maps each partition to a filegroup. For most workloads, all partitions map to `PRIMARY`.

```sql
-- Simple scheme: all partitions on the PRIMARY filegroup
CREATE PARTITION SCHEME ps_trade_date_yearly
AS PARTITION pf_trade_date_yearly
ALL TO ([PRIMARY]);

-- Advanced scheme: archive partitions on a separate filegroup (for read-only compression)
-- Requires creating the filegroup first:
-- ALTER DATABASE analytics_db ADD FILEGROUP [ARCHIVE]
-- ALTER DATABASE analytics_db ADD FILE (NAME = 'project_archive', FILENAME = '/data/archive/project_archive.ndf') TO FILEGROUP [ARCHIVE]
--
-- CREATE PARTITION SCHEME ps_trade_date_yearly
-- AS PARTITION pf_trade_date_yearly
-- TO ([ARCHIVE], [ARCHIVE], [ARCHIVE], [ARCHIVE], [ARCHIVE], [ARCHIVE], [PRIMARY]);
-- (first N partitions → ARCHIVE filegroup, last partition → PRIMARY for current year)
```

---

## Step 3: Create the Partitioned Table

The clustered index must use the partition scheme and include the partition key column.

```sql
-- Create a partitioned version of dbo.market_data
-- The clustered index key must include the partition key (trade_date)
CREATE TABLE dbo.market_data_partitioned (
    trade_date      DATE            NOT NULL,
    symbol          NVARCHAR(20)    NOT NULL,
    [open]          DECIMAL(18, 6)  NULL,
    high            DECIMAL(18, 6)  NULL,
    low             DECIMAL(18, 6)  NULL,
    [close]         DECIMAL(18, 6)  NULL,
    volume          BIGINT          NULL,
    [index]         NVARCHAR(100)   NOT NULL,
    loaded_at       DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT CIX_market_data_partitioned
        PRIMARY KEY CLUSTERED (trade_date, symbol)
        ON ps_trade_date_yearly (trade_date)  -- partition scheme on the key column
)
WITH (DATA_COMPRESSION = PAGE);  -- can apply compression to all partitions at once
```

> [!warning] Partition Key Must Be in the Clustered Index Key
> The partition key column (`trade_date`) must be part of the clustered index key. If you try to create a partitioned table on a column not in the clustered index, SQL Server will raise an error. For a table partitioned by `trade_date`, the clustered index key should be `(trade_date, symbol)` — trade_date first (for partition elimination) or second (for symbol-first lookups, but then partition elimination only works if trade_date is also in the WHERE clause).

---

## Partition Elimination — How Queries Skip Partitions

When a query includes a filter on the partition key, SQL Server's optimizer uses the partition function to determine which partitions could contain matching rows and skips the rest.

```sql
-- This query hits ONLY partition 6 (2025 data) — eliminates 6 out of 7 partitions
SELECT symbol, trade_date, [close]
FROM dbo.market_data_partitioned
WHERE trade_date BETWEEN '2025-01-01' AND '2025-12-31'
  AND symbol = 'ASML';

-- Verify partition elimination in the execution plan:
-- Look for "Actual Partition Count" in the plan properties
-- Should be 1 or 2 partitions, not all 7

-- Query to see which partitions contain data
SELECT
    partition_number,
    rows,
    data_compression_desc AS compression,
    CAST(used_pages * 8.0 / 1024 AS DECIMAL(10,2)) AS size_mb
FROM sys.dm_db_partition_stats ps
JOIN sys.partitions p ON ps.partition_id = p.partition_id
WHERE p.object_id = OBJECT_ID('dbo.market_data_partitioned')
  AND p.index_id = 1  -- clustered index
ORDER BY partition_number;
```

> [!warning] Partition Elimination Requires a SARGable Predicate on the Partition Key
> `WHERE trade_date >= '2025-01-01'` — eliminates older partitions. Good.
> `WHERE YEAR(trade_date) = 2025` — wraps the column in a function. SQL Server may NOT eliminate partitions. Use [[sargable-queries]] patterns: always filter directly on the column.

---

## SWITCH — Millisecond Partition Operations

`ALTER TABLE ... SWITCH` is the most powerful partitioning feature. It moves a partition between tables by updating metadata only — no data movement, no row-by-row processing. A billion-row partition switches in milliseconds.

#### ALTER TABLE SWITCH PARTITION — fast archiving to archive table

```sql
-- Create the archive table with identical structure on the ARCHIVE filegroup
CREATE TABLE dbo.market_data_archive (
    trade_date      DATE            NOT NULL,
    symbol          NVARCHAR(20)    NOT NULL,
    [open]          DECIMAL(18, 6)  NULL,
    high            DECIMAL(18, 6)  NULL,
    low             DECIMAL(18, 6)  NULL,
    [close]         DECIMAL(18, 6)  NULL,
    volume          BIGINT          NULL,
    [index]         NVARCHAR(100)   NOT NULL,
    loaded_at       DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT CIX_market_data_archive
        PRIMARY KEY CLUSTERED (trade_date, symbol)
        ON [PRIMARY]  -- or ARCHIVE filegroup
)
WITH (DATA_COMPRESSION = PAGE);

-- Switch partition 1 (pre-2021 data) OUT of the main table INTO the archive
-- This takes milliseconds — no data movement, only metadata update
ALTER TABLE dbo.market_data_partitioned
SWITCH PARTITION 1
TO dbo.market_data_archive;

-- After the switch:
-- dbo.market_data_partitioned partition 1 is empty
-- dbo.market_data_archive contains all pre-2021 rows
```

#### ALTER TABLE SWITCH — fast staging load, switch table IN as partition

```sql
-- Pipeline: load new data to a staging table, then switch it in atomically
-- Step 1: Load data to the staging table
CREATE TABLE dbo.market_data_staging_2026 (
    trade_date      DATE            NOT NULL,
    symbol          NVARCHAR(20)    NOT NULL,
    [open]          DECIMAL(18, 6)  NULL,
    high            DECIMAL(18, 6)  NULL,
    low             DECIMAL(18, 6)  NULL,
    [close]         DECIMAL(18, 6)  NULL,
    volume          BIGINT          NULL,
    [index]         NVARCHAR(100)   NOT NULL,
    loaded_at       DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT CIX_staging_2026
        PRIMARY KEY CLUSTERED (trade_date, symbol)
        ON ps_trade_date_yearly (trade_date)  -- must use same partition scheme
)
WITH (DATA_COMPRESSION = PAGE);

-- Load data into staging (can take minutes — doesn't block main table)
INSERT INTO dbo.market_data_staging_2026 (trade_date, symbol, ...)
SELECT ...
FROM external_source
WHERE trade_date >= '2026-01-01';

-- Step 2: Switch the staging table in as partition 7 (the 2026 partition)
-- This takes milliseconds — atomically replaces the empty partition with the loaded data
ALTER TABLE dbo.market_data_staging_2026
SWITCH TO dbo.market_data_partitioned PARTITION 7;
```

> [!warning] SWITCH Requirements
> Both source and target tables must:
> - Have identical column definitions (same names, types, nullability, defaults)
> - Have identical indexes (clustered index key columns and order)
> - Use the same partition scheme (or the target is partitioned and source is not — single partition switch)
> - The target partition must be empty before a SWITCH IN
> - Both tables must be in the same database

---

## Adding New Partitions — Sliding Window Pattern

For an ongoing pipeline, add a new partition boundary at the start of each year (or month for monthly partitioning):

```sql
-- At the start of 2027, add a partition for 2027 data
-- Step 1: The partition scheme needs a "next used" filegroup
ALTER PARTITION SCHEME ps_trade_date_yearly
NEXT USED [PRIMARY];

-- Step 2: Add the new boundary to the partition function
ALTER PARTITION FUNCTION pf_trade_date_yearly ()
SPLIT RANGE ('2027-01-01');

-- The partition function now has 7 boundaries (8 partitions)
-- The 2026 partition is now bounded on the right: >= '2026-01-01' AND < '2027-01-01'
-- A new empty partition 8 exists for 2027 data

-- Verify the new partition exists
SELECT
    partition_number,
    rows,
    CAST(used_pages * 8.0 / 1024 AS DECIMAL(10,2)) AS size_mb
FROM sys.dm_db_partition_stats
WHERE object_id = OBJECT_ID('dbo.market_data_partitioned')
ORDER BY partition_number;
```

#### ALTER PARTITION FUNCTION MERGE RANGE — remove old partitions

```sql
-- Before removing: switch out the old partition to the archive table (see above)
-- Then merge the empty partition boundary to eliminate the partition
ALTER PARTITION FUNCTION pf_trade_date_yearly ()
MERGE RANGE ('2021-01-01');
-- Partition 1 and 2 are merged into a single partition (now covering all pre-2022 data)
-- Only safe to do after switching out the data first!
```

---

## Per-Partition Compression

Different partitions can have different compression levels — useful for mixed hot/cold data. See [[table-compression]] for detailed compression ratio benchmarks and the decision framework for choosing between ROW and PAGE compression.

```sql
-- Apply PAGE compression to old partitions, NONE to the current-year partition
-- (Current year gets many updates; old partitions are read-only)

-- Compress partitions 1-6 (historical years 2020-2025)
ALTER INDEX CIX_market_data_partitioned ON dbo.market_data_partitioned
REBUILD PARTITION = 1 WITH (DATA_COMPRESSION = PAGE);

ALTER INDEX CIX_market_data_partitioned ON dbo.market_data_partitioned
REBUILD PARTITION = 2 WITH (DATA_COMPRESSION = PAGE);

-- ... repeat for partitions 3-6

-- Leave partition 7 (current year 2026) uncompressed for write performance
ALTER INDEX CIX_market_data_partitioned ON dbo.market_data_partitioned
REBUILD PARTITION = 7 WITH (DATA_COMPRESSION = NONE);
```

---

## Monitoring Partitioned Tables

```sql
-- Full partition inventory: rows, size, compression per partition
SELECT
    OBJECT_NAME(p.object_id) AS table_name,
    p.partition_number,
    p.rows,
    CAST(a.used_pages * 8.0 / 1024 AS DECIMAL(10,2)) AS size_mb,
    p.data_compression_desc AS compression,
    prv.value AS partition_boundary
FROM sys.partitions p
JOIN sys.allocation_units a ON p.partition_id = a.container_id
LEFT JOIN sys.partition_range_values prv
    ON p.partition_number = prv.boundary_id
    AND (SELECT function_id FROM sys.partition_schemes ps
         JOIN sys.indexes i ON ps.data_space_id = i.data_space_id
         WHERE i.object_id = p.object_id AND i.index_id = p.index_id) = prv.function_id
WHERE p.object_id = OBJECT_ID('dbo.market_data_partitioned')
  AND p.index_id = 1
ORDER BY p.partition_number;

-- Check all partition functions in the database
SELECT
    pf.name AS function_name,
    pf.fanout AS partition_count,
    pf.boundary_value_on_right,
    pf.create_date
FROM sys.partition_functions pf;

-- Check all partition schemes
SELECT
    ps.name AS scheme_name,
    pf.name AS function_name
FROM sys.partition_schemes ps
JOIN sys.partition_functions pf ON ps.function_id = pf.function_id;
```

---

## Partitioning Decision Tree

```
Is the table > 10 million rows?
├── NO  → Don't partition. Add covering indexes instead.
│         See [[index-types-and-strategy]].
└── YES → Do queries consistently filter by a date column?
          ├── NO  → Partitioning won't help (no partition elimination).
          │         Consider columnstore index instead.
          └── YES → Partition by that date column.
                    ├── Yearly partitioning → > 1M rows per year?
                    │   YES → Use yearly boundaries
                    │   NO  → Use monthly boundaries for finer granularity
                    └── Do you need fast archiving or bulk-load switching?
                        YES → SWITCH-based sliding window pattern
                        NO  → Simple partition for elimination only
```

---

## Common Pitfalls

| Pitfall | Symptom | Fix |
|---|---|---|
| Partition key not in clustered index | CREATE TABLE fails | Always include partition key in the clustered index key |
| Partition key wrapped in function in WHERE | No partition elimination (full scan) | Write SARGable predicates: `WHERE trade_date >= '2025-01-01'` |
| SWITCH fails with "does not match" | ALTER TABLE SWITCH error | Ensure both tables have identical column definitions and indexes |
| Too many partitions (> 1,000) | Metadata overhead slows all queries | Use yearly partitions for multi-year tables; don't partition by day |
| Forgetting to add NEXT USED before SPLIT | SPLIT RANGE fails | `ALTER PARTITION SCHEME ... NEXT USED [filegroup]` before every SPLIT |
| Compressing current-year partition | Slow pipeline writes | Use per-partition compression: compress historical, leave current uncompressed |

---

## Related

- [[storage-internals]] — how pages and filegroups interact with partitions at the storage level
- [[index-types-and-strategy]] — columnstore indexes as an alternative to partitioning for analytics workloads
- [[table-compression]] — applying per-partition compression to cold historical data
- [[index-maintenance]] — maintaining fragmentation per partition with `REBUILD PARTITION = N`
- [[performance-audit-playbook]] — identifying tables over 10M rows that are candidates for partitioning
- [[blocking-and-locking]] — SWITCH operations take a schema modification lock briefly; plan maintenance windows accordingly
- [[bronze-layer-loading]] — SWITCH-based staging loads as an alternative to TRUNCATE + INSERT for large bronze tables
