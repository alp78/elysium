---
title: "09 - Partitioning Strategies"
tags: [sql, sql-server, storage, tsql]
aliases: [table partitioning, partition function, partition scheme, sliding window, partition elimination, switch partition]
description: "Production guide to SQL Server table partitioning: when partitioning helps, how partition functions and schemes work, partition elimination, metadata-only SWITCH operations, and the sliding-window SPLIT/MERGE pattern."
created: 2026-03-22
updated: 2026-04-08
status: complete
---

# Partitioning Strategies

Partitioning divides one logical table into multiple physical partitions based on a partition key. In SQL Server, partitioning is primarily a **manageability** and **data-lifecycle** feature. It can help query performance through partition elimination, but it is not a universal speed feature on its own.

Use partitioning when you need one or more of these:

- sliding-window data retention
- very fast archival or load-exchange operations with `SWITCH`
- per-partition rebuild, compression, or maintenance
- predictable time-sliced access on very large tables

Do not use partitioning as a reflex for every large table. If the partition key is not part of the real workload predicates, partitioning adds complexity with little benefit.

## Current Baseline In `stoxx`

The live `stoxx` database currently has no partition functions or partition schemes. That makes it a clean baseline for a disposable demo.

### `sys.partition_schemes` and `sys.partition_functions` | verify the current state

This query confirms whether the database is already using native SQL Server table partitioning.

*Return the current count of partition schemes and partition functions in `stoxx`.*

```sql
SELECT COUNT(*) AS partition_scheme_count
FROM sys.partition_schemes;

SELECT COUNT(*) AS partition_function_count
FROM sys.partition_functions;
```

| partition_scheme_count |
|---:|
| 0 |

<!-- -->

| partition_function_count |
|---:|
| 0 |

_`stoxx` is not using native partitioning today. That means any partitioning design would be a deliberate new architecture choice, not a pre-existing storage pattern that simply needs tuning._

## Reproducible Partition Demo

This note uses a disposable single-filegroup demo so the mechanics are fully reproducible. In production, partitioning is often paired with multiple filegroups for storage tiering, backup strategy, or archival isolation, but the core engine behavior can be demonstrated safely with all partitions on `PRIMARY`.

> [!warning]
>
> This demo uses `ALL TO ([PRIMARY])` for reproducibility. That proves the partitioning mechanics, but it does not represent a full production storage-tiering design.

> [!success]
>
> Use the single-filegroup demo to learn the mechanics first. In production, move hot and cold partitions to deliberate filegroups only when you have a real lifecycle or backup reason to do so.

### Partition function and scheme

A **partition function** defines the boundary values. A **partition scheme** maps the resulting partitions to filegroups.

#### `CREATE PARTITION FUNCTION` + `CREATE PARTITION SCHEME` | define monthly boundaries

This demo uses monthly boundaries for February, March, and April 2025 with `RANGE RIGHT`, so each boundary value belongs to the partition on its right.

*Create a date-based partition function and a single-filegroup partition scheme for the demo.*

```sql
IF OBJECT_ID('dbo.demo_partition_market_data_stage','U') IS NOT NULL
    DROP TABLE dbo.demo_partition_market_data_stage;
IF OBJECT_ID('dbo.demo_partition_market_data_archive','U') IS NOT NULL
    DROP TABLE dbo.demo_partition_market_data_archive;
IF OBJECT_ID('dbo.demo_partition_market_data','U') IS NOT NULL
    DROP TABLE dbo.demo_partition_market_data;
IF EXISTS (SELECT 1 FROM sys.partition_schemes WHERE name = 'ps_demo_market_data')
    DROP PARTITION SCHEME ps_demo_market_data;
IF EXISTS (SELECT 1 FROM sys.partition_functions WHERE name = 'pf_demo_market_data')
    DROP PARTITION FUNCTION pf_demo_market_data;

CREATE PARTITION FUNCTION pf_demo_market_data (date)
AS RANGE RIGHT FOR VALUES ('2025-02-01', '2025-03-01', '2025-04-01');

CREATE PARTITION SCHEME ps_demo_market_data
AS PARTITION pf_demo_market_data ALL TO ([PRIMARY]);
```

#### `sys.partition_range_values` | inspect the boundaries

This query shows the defined partition boundaries and whether the function is `RANGE RIGHT`.

*Return the partition boundaries for the disposable demo function.*

```sql
SELECT
    pf.name AS partition_function,
    prv.boundary_id,
    CONVERT(date, prv.value) AS boundary_value,
    pf.boundary_value_on_right
FROM sys.partition_functions AS pf
JOIN sys.partition_range_values AS prv
    ON pf.function_id = prv.function_id
WHERE pf.name = 'pf_demo_market_data'
ORDER BY prv.boundary_id;
```

| partition_function | boundary_id | boundary_value | boundary_value_on_right |
|---|---:|---|---:|
| `pf_demo_market_data` | 1 | 2025-02-01 | 1 |
| `pf_demo_market_data` | 2 | 2025-03-01 | 1 |
| `pf_demo_market_data` | 3 | 2025-04-01 | 1 |

_`boundary_value_on_right = 1` confirms `RANGE RIGHT`. That means `2025-02-01` belongs to partition 2, `2025-03-01` belongs to partition 3, and so on. The function therefore creates four partitions: before February, February, March, and April onward._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `boundary_value_on_right` | `1` | ✅ | `RANGE RIGHT`. | Boundary values belong to the partition on the right side. |
| `boundary_value_on_right` | `0` | Depends | `RANGE LEFT`. | Boundary values belong to the partition on the left side instead. |

### Create the partitioned table

The table becomes partitioned only when its clustered index or heap is placed on the partition scheme.

#### `CREATE TABLE` + aligned clustered index | build the partitioned demo table

This creates a disposable table and places its clustered index on the partition scheme using `[date]` as the partitioning column.

*Create the partitioned demo table and load rows from January through April 2025.*

```sql
CREATE TABLE dbo.demo_partition_market_data
(
    id int NOT NULL,
    symbol varchar(20) NOT NULL,
    [date] date NOT NULL,
    [close] float NOT NULL,
    volume bigint NOT NULL
);

CREATE CLUSTERED INDEX CIX_demo_partition_market_data
    ON dbo.demo_partition_market_data([date], id)
    ON ps_demo_market_data([date]);

INSERT INTO dbo.demo_partition_market_data (id, symbol, [date], [close], volume)
SELECT
    id,
    symbol,
    [date],
    [close],
    volume
FROM silver.eurostoxx50_ohlcv
WHERE [date] >= '2025-01-01'
  AND [date] < '2025-05-01';

SELECT COUNT(*) AS row_count
FROM dbo.demo_partition_market_data;
```

| row_count |
|---:|
| 4149 |

_The demo table now contains 4,149 rows spread across four date-based partitions._

#### `sys.partitions` | verify row distribution by partition

This query shows how many rows landed in each partition after the load.

*Return the row counts for each physical partition of the demo table.*

```sql
SELECT
    p.partition_number,
    p.rows AS partition_rows
FROM sys.partitions AS p
WHERE p.object_id = OBJECT_ID('dbo.demo_partition_market_data')
  AND p.index_id = 1
ORDER BY p.partition_number;
```

| partition_number | partition_rows |
|---:|---:|
| 1 | 1099 |
| 2 | 1000 |
| 3 | 1050 |
| 4 | 1000 |

_The load distributed rows across all four partitions. That makes the next steps meaningful because there is real data to eliminate, switch out, and switch back in._

## Partition Elimination

Partition elimination works only when the query predicate constrains the partition key. If the partition key is not part of the filter, SQL Server has no basis to skip partitions.

### `$PARTITION` | show which partition a query touches

This query proves that a March-only predicate touches only partition 3.

#### `$PARTITION` | verify elimination for a March-only predicate

This uses the partition function directly to show which partition number the filtered rows belong to.

*Return the touched partition number for a March-only predicate and count the qualifying rows.*

```sql
SELECT DISTINCT
    $PARTITION.pf_demo_market_data([date]) AS touched_partition
FROM dbo.demo_partition_market_data
WHERE [date] >= '2025-03-01'
  AND [date] < '2025-04-01'
ORDER BY touched_partition;

SELECT COUNT(*) AS march_rows
FROM dbo.demo_partition_market_data
WHERE [date] >= '2025-03-01'
  AND [date] < '2025-04-01';
```

| touched_partition |
|---:|
| 3 |

<!-- -->

| march_rows |
|---:|
| 1050 |

_The March predicate maps exclusively to partition 3. That is the conceptual core of partition elimination: the query does not need every partition because the partition key itself narrows the search space._

## `SWITCH` | metadata-only movement

`SWITCH` is the strongest operational reason to partition large fact tables. It lets SQL Server move an entire partition in or out as metadata, provided the source and target structures are compatible.

Microsoft documents the strict compatibility rules for partitioned tables and indexes in the [partitioning documentation](https://learn.microsoft.com/en-us/sql/relational-databases/partitions/create-partitioned-tables-and-indexes). The most important operational constraints are:

- source and target table structures must match
- indexes must be aligned correctly
- the target for `SWITCH OUT` must be empty
- the rows must fit the target partition or check-constraint boundary

### `SWITCH OUT` | move one partition to an archive table

The archive table must have the same shape and compatible index definition.

#### `ALTER TABLE ... SWITCH PARTITION` | move partition 2 out to archive

This moves the February partition out of the partitioned table into a normal table with a matching clustered index.

*Create an empty archive table with a compatible clustered index and switch partition 2 into it.*

```sql
CREATE TABLE dbo.demo_partition_market_data_archive
(
    id int NOT NULL,
    symbol varchar(20) NOT NULL,
    [date] date NOT NULL,
    [close] float NOT NULL,
    volume bigint NOT NULL
);

CREATE CLUSTERED INDEX CIX_demo_partition_market_data_archive
    ON dbo.demo_partition_market_data_archive([date], id);

ALTER TABLE dbo.demo_partition_market_data
    SWITCH PARTITION 2 TO dbo.demo_partition_market_data_archive;

SELECT COUNT(*) AS archive_rows
FROM dbo.demo_partition_market_data_archive;

SELECT
    p.partition_number,
    p.rows AS partition_rows
FROM sys.partitions AS p
WHERE p.object_id = OBJECT_ID('dbo.demo_partition_market_data')
  AND p.index_id = 1
ORDER BY p.partition_number;
```

| archive_rows |
|---:|
| 1000 |

<!-- -->

| partition_number | partition_rows |
|---:|---:|
| 1 | 1099 |
| 2 | 0 |
| 3 | 1050 |
| 4 | 1000 |

_Partition 2 moved out instantly at the metadata level. The archive table now contains the 1,000 February rows, and the source partition is empty without row-by-row delete work._

### `SWITCH IN` | load a prepared staging table into an empty partition

The staging table must be empty after the switch, and its rows must satisfy the target partition boundary.

#### `ALTER TABLE ... SWITCH TO ... PARTITION` | switch February rows back in

This creates a staging table with a February-only check constraint, loads ten rows, and switches them into partition 2.

*Create a staging table constrained to the February range and switch it into partition 2.*

```sql
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

CREATE TABLE dbo.demo_partition_market_data_stage
(
    id int NOT NULL,
    symbol varchar(20) NOT NULL,
    [date] date NOT NULL,
    [close] float NOT NULL,
    volume bigint NOT NULL,
    CONSTRAINT CK_demo_partition_market_data_stage_feb
        CHECK ([date] >= '2025-02-01' AND [date] < '2025-03-01')
);

CREATE CLUSTERED INDEX CIX_demo_partition_market_data_stage
    ON dbo.demo_partition_market_data_stage([date], id);

INSERT INTO dbo.demo_partition_market_data_stage (id, symbol, [date], [close], volume)
SELECT TOP (10)
    id + 1000000,
    symbol,
    [date],
    [close],
    volume
FROM silver.eurostoxx50_ohlcv
WHERE [date] >= '2025-02-01'
  AND [date] < '2025-03-01'
ORDER BY id;

ALTER TABLE dbo.demo_partition_market_data_stage
    SWITCH TO dbo.demo_partition_market_data PARTITION 2;

SELECT COUNT(*) AS stage_rows
FROM dbo.demo_partition_market_data_stage;

SELECT
    p.partition_number,
    p.rows AS partition_rows
FROM sys.partitions AS p
WHERE p.object_id = OBJECT_ID('dbo.demo_partition_market_data')
  AND p.index_id = 1
ORDER BY p.partition_number;
```

| stage_rows |
|---:|
| 0 |

<!-- -->

| partition_number | partition_rows |
|---:|---:|
| 1 | 1099 |
| 2 | 10 |
| 3 | 1050 |
| 4 | 1000 |

_The staging table is empty after the switch, and partition 2 now contains the ten staged February rows. This is the operational pattern used for very fast partition-aligned batch loads._

## Sliding Window With `SPLIT` And `MERGE`

Sliding-window partitioning means:

- `SPLIT` to add the next future boundary
- load or switch data into the new range
- archive and `MERGE` away the oldest empty boundary

### `ALTER PARTITION FUNCTION` | add and remove a future boundary

This demo uses a future empty boundary so both `SPLIT` and `MERGE` are safe and observable.

#### `SPLIT RANGE` + `MERGE RANGE` | grow and shrink the partition map

This adds a new boundary at `2025-05-01`, verifies the partition count increase, then merges it away again.

*Add a future empty partition boundary, verify the partition count increase, then merge it away again.*

```sql
SELECT COUNT(*) AS partition_count_before_split
FROM sys.partitions
WHERE object_id = OBJECT_ID('dbo.demo_partition_market_data')
  AND index_id = 1;

ALTER PARTITION SCHEME ps_demo_market_data NEXT USED [PRIMARY];
ALTER PARTITION FUNCTION pf_demo_market_data() SPLIT RANGE ('2025-05-01');

SELECT COUNT(*) AS partition_count_after_split
FROM sys.partitions
WHERE object_id = OBJECT_ID('dbo.demo_partition_market_data')
  AND index_id = 1;

ALTER PARTITION FUNCTION pf_demo_market_data() MERGE RANGE ('2025-05-01');

SELECT COUNT(*) AS partition_count_after_merge
FROM sys.partitions
WHERE object_id = OBJECT_ID('dbo.demo_partition_market_data')
  AND index_id = 1;
```

| partition_count_before_split |
|---:|
| 4 |

<!-- -->

| partition_count_after_split |
|---:|
| 5 |

<!-- -->

| partition_count_after_merge |
|---:|
| 4 |

_The partition map grows from four partitions to five when the future boundary is added, then returns to four when the boundary is merged away. This is the structural basis of the sliding-window pattern._

## Production Recommendations

- Partition only when the partition key is part of real workload predicates or lifecycle management.
- Keep all indexes aligned if you want reliable `SWITCH` operations.
- Design the partition key into the clustered index shape intentionally.
- Use partitioning for manageability first, and treat performance gains as workload-dependent.
- Compress colder partitions more aggressively than hot ones when the data lifecycle supports it.
- Prefer an empty future partition before the next load window so `SPLIT` is planned, not reactive.


