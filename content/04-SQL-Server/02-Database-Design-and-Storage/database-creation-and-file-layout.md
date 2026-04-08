---
title: "Database Creation and File Layout"
tags:
  - sql-server
  - database
  - create-database
  - file-layout
  - mdf
  - ndf
  - ldf
  - autogrowth
  - recovery-model
  - compatibility-level
aliases:
  - CREATE DATABASE
  - MDF NDF LDF
  - database files
  - database options
description: "Reference for CREATE DATABASE, file sizing, autogrowth, filegroups, recovery model, compatibility level, Query Store, and database-level defaults in SQL Server."
parent: "[[domain-database-design-and-storage]]"
links:
  - "[[schemas-tables-and-constraints]]"
  - "[[keys-defaults-identity-and-sequences]]"
  - "[[sql-server-schema-layering]]"
  - "[[storage-internals]]"
  - "[[sql-server-change-tracking]]"
created: 2026-04-08
updated: 2026-04-08
status: complete
---

# Database Creation and File Layout: The Definitive Data Engineering Guide

Every physical and logical decision must be driven by workload type. Incorrect file layout, disk placement, or database options cause the vast majority of performance bottlenecks, availability issues, and disastrous recovery times.

---

## 1. Core Concepts Glossary

*   **Page:** The fundamental unit of data storage in SQL Server. It is exactly 8 KB in size.
*   **Extent:** A collection of eight contiguous pages (64 KB). SQL Server allocates space to tables and indexes in extents.
*   **Virtual Log File (VLF):** Internal, logical divisions of the physical transaction log file. Too many small VLFs degrade database startup and recovery times.
*   **Filegroup:** A logical grouping of physical data files (.ndf or .mdf). They allow data engineers to place specific tables or index partitions onto specific physical disks.
*   **Rowstore:** The traditional method of storing data where all columns for a single row are stored together on the same page. Best for highly concurrent, single-row lookups (OLTP).
*   **Columnstore:** Storing data by columns rather than rows. Highly compressed and optimized for massive aggregations and analytics (OLAP).

---

## 2. Database Types and Workload Scenarios

Databases are never "generic." Tailor file layout, sizing, recovery model, and options to the dominant workload:

| Workload Type | Definition | Scenario / Dominant Pattern | File Layout Priorities | Recovery Model | Key DB Options |
|---|---|---|---|---|---|
| **Real-Time Ingestion (OLTP)** | High concurrency, short transactions, row-by-row operations. | Tick/quote feeds, order-book systems. | Large log file, multiple data files for I/O parallelism, strict separation of data and log physical volumes. | FULL | READ_COMMITTED_SNAPSHOT ON, large FILEGROWTH. |
| **Analytics (Data Warehouse)** | Low concurrency, massive data scans, large aggregations. | Historical market data, risk analytics, back-testing. | Very large data files (often 8–16 per filegroup), date-range partitioned filegroups for columnstore on tiered storage. | FULL or BULK_LOGGED (during ETL) | QUERY_STORE = ON (AUTO), PAGE_VERIFY CHECKSUM. |
| **Hybrid / Mixed** | Combination of ingestion and analytical read queries (HTAP). | Intraday operational dashboards, real-time risk. | Balanced sizing, secondary filegroups isolating columnstore partitions from rowstore ingestion to prevent disk thrashing. | FULL | RCSI enabled, strict Query Store monitoring. |
| **Staging / Transient ETL** | Temporary landing zones for raw feeds before transformation. | Nightly batch processing, data cleansing operations. | Moderate sizes, highest write throughput priority, ephemeral storage acceptable. | SIMPLE | AUTO_SHRINK OFF, QUERY_STORE OFF (reduces overhead). |

---

## 3. Physical Storage Architecture and Hardware Placement

The physical location of your database files dictates the upper limit of your system's performance. SQL Server is heavily dependent on disk I/O. Placing all files on a single volume (e.g., the C: drive) is a catastrophic anti-pattern in professional data engineering. 

Files must be strategically distributed across different types of physical or virtualized hardware based on their access patterns.

### Storage Media Types and Implications

*   **NVMe (Non-Volatile Memory Express):** Provides the lowest latency and highest IOPS (Input/Output Operations Per Second). Essential for workloads requiring microsecond response times.
*   **Enterprise SSD (Solid State Drive):** Excellent for random read/write workloads. The standard for active database files.
*   **HDD (Hard Disk Drive / Spinning Disk):** High latency, terrible at random I/O, but very cheap per terabyte. Useful only for sequential access patterns like backups or cold historical archives.

### Disk Placement Strategy

| File Type | Access Pattern | Recommended Hardware | Storage Placement Implications and Rules |
|---|---|---|---|
| **Transaction Log (.ldf)** | Strictly Sequential Write (and sequential read during backups/recovery). | **NVMe or Top-Tier SSD** | **Rule:** Isolate completely. The log requires the lowest possible latency. Because it writes sequentially, placing it on a disk with random-access data files causes "head thrashing" (even on SSDs, it creates mixed I/O queues at the controller level, degrading performance). Dedicate an entire LUN/Volume exclusively to log files. |
| **TempDB (.mdf/.ndf/.ldf)** | Extreme Random Read/Write. | **NVMe or Top-Tier SSD** | **Rule:** TempDB is the global scratchpad for the instance (sorting, hashing, row-versioning). It must sit on the fastest possible storage. Dedicate an isolated, ephemeral volume for TempDB to prevent it from consuming I/O bandwidth needed by user databases. |
| **Active Data / Primary (.mdf/.ndf)** | Heavy Random Read/Write. | **Enterprise SSD** | **Rule:** Active tables and indexes live here. Separate these from the OS, Log, and TempDB. For high-volume systems, split data across multiple .ndf files stored on multiple discrete SSD volumes to parallelize disk controller queues. |
| **Historical Archive (.ndf)** | Sequential Read (large scans), minimal writes. | **Standard SSD or HDD** | **Rule:** If you partition data by year, place the "Cold" filegroups (e.g., 2018-2020 data) on cheaper, slower storage arrays. Since analytical queries typically scan these sequentially, the performance penalty is mitigated, and enterprise storage costs are dramatically reduced. |

### OS-Level Storage Alignment

> [!warning] Gotcha: NTFS/ReFS Allocation Unit Size
> Before creating files, ensure the underlying Windows or Linux disk volumes are formatted with a **64 KB Allocation Unit Size** (Block Size). SQL Server reads and writes in 64 KB extents. If the OS disk is formatted to the default 4 KB, every single SQL Server read/write operation requires 16 separate OS-level disk operations. This misalignment silently destroys I/O throughput.

---

## 4. CREATE DATABASE, Sizing, and Growth Mechanics

SQL Server separates persistent storage into fundamentally different file types:
*   **Primary Data File (.mdf):** Contains system tables, metadata, and user data. Every database has exactly one.
*   **Secondary Data Files (.ndf):** Optional files used to spread data across multiple disks (I/O parallelism) or organize data into filegroups.
*   **Transaction Log Files (.ldf):** The sequential record of all database modifications. 

### Demystifying SIZE and FILEGROWTH

In the `CREATE DATABASE` statement, `SIZE` and `FILEGROWTH` are the most critical parameters for physical disk management. Relying on defaults here guarantees future production outages.

#### What is SIZE?
`SIZE` defines the initial physical space requested from the operating system and allocated on the disk the moment the database is created. 

**The Engineering Rationale:** 
You must pre-size files to match the expected data volume for the near future (e.g., 6 to 12 months of runway). If you expect to land 500 GB of data in the next few months, set the `SIZE` to 500 GB on day one. 
*   **Prevents Fragmentation:** Asking for a massive chunk upfront allows the OS to grant contiguous blocks of storage, which vastly improves read/write speeds.
*   **Eliminates I/O Stalls:** Pre-sizing prevents the database engine from constantly pausing user transactions to ask the operating system for more space during everyday ingestion.

#### What is FILEGROWTH?
`FILEGROWTH` dictates exactly how much space is added to the file when it completely fills its current `SIZE` allocation. Autogrowth is an automatic safety valve to prevent out-of-space errors; it is **not** a daily operational strategy.

**The Engineering Rationale:** 
*   **The Percentage Death Spiral:** Never use percentage-based growth. If a 1 TB log file grows by 10%, SQL Server must allocate 100 GB. Because log files must be strictly zero-initialized (wiped clean with zeros) before use, writing 100 GB of zeros to disk can take minutes. During those minutes, every single write transaction against the database is frozen. Always use fixed MB or GB increments.
*   **The VLF Problem:** If growth is too small (e.g., 10 MB), the file will grow constantly. For the transaction log, every growth event creates new Virtual Log Files (VLFs). Having thousands of tiny VLFs severely degrades database startup time, replication speed, and disaster recovery restores.
*   **The Goldilocks Increment:** Growth must be large enough to prevent frequent growth events, but small enough that zero-initializing the space does not cause a massive timeout stall.

> [!note] Instant File Initialization (IFI)
> IFI allows data files (.mdf/.ndf) to bypass zeroing out space during creation or growth, making growth instantaneous. It requires granting the "Perform Volume Maintenance Tasks" privilege to the SQL service account at the OS level. **Log files (.ldf) cannot use IFI and must always zero-initialize.**

---

## 5. Advanced Filegroups and Specialized Storage

Beyond standard PRIMARY and secondary rowstore data files, certain engineering scenarios require specialized filegroups.

| Filegroup Type | Definition | Data Engineering Use Case |
|---|---|---|
| **Standard Filegroups** | Logical containers for .ndf files. | Date-partitioning large fact tables (e.g., FG_2023, FG_2024). Allows you to back up, restore, or move specific years independently to cheaper storage. |
| **MEMORY_OPTIMIZED_DATA** | Required for In-Memory OLTP. Maps to a directory rather than a file. | High-throughput data ingestion where traditional latching/locking is a bottleneck. Data is stored natively in RAM and serialized to disk. |
| **FILESTREAM** | Integrates the SQL Server Database Engine with an NTFS/ReFS file system. | Storing massive binary data (e.g., raw PDFs, image blobs, massive XML/JSON payloads) where files exceed 1 MB, keeping the database footprint small while maintaining transactional consistency. |

---

## 6. Baseline CREATE DATABASE Script

This template establishes explicit file names, sizes, multiple filegroups, fixed growth, and targets specific hypothetical disk drives (E: for active data, F: for historical archive, L: for logs).

```sql
CREATE DATABASE market_analytics
ON PRIMARY (
    -- Metadata only. Placed on standard fast SSD.
    NAME = market_analytics_primary,
    FILENAME = 'E:\SQLData\market_analytics_primary.mdf',
    SIZE = 4096MB,
    FILEGROWTH = 512MB
),
-- Active Data Filegroup. Placed on high-IOPS NVMe.
FILEGROUP FG_ActiveData (
    NAME = market_analytics_active_1,
    FILENAME = 'E:\SQLData\market_analytics_active_1.ndf',
    SIZE = 250GB,
    FILEGROWTH = 5GB
),
-- Specialized filegroup for partitioned historical data. Placed on cheaper HDD/Tier-3 SSD.
FILEGROUP FG_Historical (
    NAME = market_analytics_history_1,
    FILENAME = 'F:\SQLArchive\market_analytics_history_1.ndf',
    SIZE = 1000GB,
    FILEGROWTH = 10GB
)
LOG ON (
    -- Transaction Log. Placed on isolated, dedicated NVMe drive.
    NAME = market_analytics_log,
    FILENAME = 'L:\SQLLogs\market_analytics_log.ldf',
    SIZE = 150GB,
    FILEGROWTH = 1GB
);
```

---

## 7. Database-Level Options: The Post-Creation Baseline

These configurations define how the database recovers, sorts data, and manages concurrency. They must be set immediately after `CREATE DATABASE`.

### A. Collation

Collation defines character sets, sort orders, and case/accent sensitivity. If omitted, the database inherits the server's default collation, which can break ETL pipelines merging data from external sources.

| Collation Option | Definition | Data Engineering Scenario |
|---|---|---|
| `SQL_Latin1_General_CP1_CI_AS` | Legacy default (Case Insensitive, Accent Sensitive). | General backward compatibility with older applications. |
| `Latin1_General_100_CI_AS_SC_UTF8` | Modern UTF-8 support (SQL 2019+). | Ingesting modern web data, JSON, or global text feeds natively in UTF-8 to save space on VARCHAR columns. |
| `Latin1_General_BIN2` | Binary sorting. | High-performance ETL environments where exact binary string matching is required (fastest sorting performance). |

> [!warning] Gotcha: TempDB Collation Conflicts
> If your user database collation differs from the `tempdb` collation (which matches the server), joining temporary tables (#temp) to user tables on string columns will fail with a collation conflict error. Always explicitly define collation in #temp table creation if they differ.

```sql
ALTER DATABASE market_analytics COLLATE Latin1_General_100_CI_AS_SC_UTF8;
```

### B. Recovery Model and High Availability

| Recovery Model | Behavior | Scenario |
|---|---|---|
| **FULL** | Every transaction is fully logged. Requires regular transaction log backups. | Production standard. Allows point-in-time recovery. Required for Always On Availability Groups. |
| **BULK_LOGGED** | Minimally logs specific bulk operations (e.g., bcp, BULK INSERT, Index Rebuilds). | Heavy ETL load windows. Reduces log file bloat during massive data imports. Must switch back to FULL after ETL. |
| **SIMPLE** | Log auto-truncates upon checkpoint. No log backups allowed. | Staging, Dev, or QA environments. Data loss risk is accepted. |

> [!important] High Availability Readiness
> If you are placing this database into an Always On Availability Group, simply setting the model to `FULL` is not enough. **You must take a full database backup** immediately to initialize the log chain. Until the first full backup is taken, a database in FULL recovery behaves like SIMPLE recovery.

### C. Concurrency: Snapshot Isolation and RCSI

Read behavior is a database decision, not an instance decision. In modern data systems, readers should not block writers.

```sql
-- Permits explicit SNAPSHOT isolation transactions
ALTER DATABASE market_analytics SET ALLOW_SNAPSHOT_ISOLATION ON;

-- Changes the default READ COMMITTED behavior to use row versioning
ALTER DATABASE market_analytics SET READ_COMMITTED_SNAPSHOT ON;
```

> [!warning] Gotcha: TempDB Overhead
> RCSI eliminates reader-writer blocking by keeping older versions of rows in TempDB. In a high-velocity ingestion system, enabling RCSI mandates an aggressively sized and heavily parallelized TempDB setup (e.g., 8 to 16 data files on the fastest available NVMe drives).

### D. Security, Ownership, and Query Store

Best practices dictate reassigning database ownership away from the creator account to `sa` to prevent orphaned databases if an employee leaves. 

```sql
-- Security & Ownership
ALTER AUTHORIZATION ON DATABASE::market_analytics TO [sa];

-- Enable Query Store for performance telemetry
ALTER DATABASE market_analytics SET QUERY_STORE = ON;
ALTER DATABASE market_analytics SET QUERY_STORE (
    OPERATION_MODE = READ_WRITE,
    QUERY_CAPTURE_MODE = AUTO,
    SIZE_BASED_CLEANUP_MODE = AUTO,
    MAX_STORAGE_SIZE_MB = 2048
);

-- Safety and Auto Options
ALTER DATABASE market_analytics SET PAGE_VERIFY CHECKSUM;
ALTER DATABASE market_analytics SET AUTO_CLOSE OFF;
ALTER DATABASE market_analytics SET AUTO_SHRINK OFF;
```

> [!warning] Gotcha: Auto_Shrink
> **Never enable AUTO_SHRINK.** It creates a devastating cycle of performance degradation: SQL Server wastes CPU shrinking the file, heavily fragmenting all indexes in the process, only to immediately trigger expensive autogrowth events when the next ETL job runs.

## Related

- [[server-configuration]] for instance-level settings, TempDB, and Linux host checks
- [[schemas-tables-and-constraints]] for `CREATE SCHEMA`, `CREATE TABLE`, and constraint design
- [[keys-defaults-identity-and-sequences]] for key generation and default-value behavior
- [[storage-internals]] for the physical consequences of file and log design
