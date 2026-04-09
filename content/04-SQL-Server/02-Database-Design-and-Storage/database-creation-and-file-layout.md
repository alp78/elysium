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

# Database Creation and File Layout


## 1. What “Creating a Database” Actually Means

At a superficial level, creating a database means issuing a statement such as:

```sql
CREATE DATABASE [MyDatabase];
```

At a professional level, creating a database means defining all of the following:

1. **Creation path**
   - Brand-new empty database
   - Attached database
   - Snapshot
   - Contained database

2. **Physical layout**
   - Data files
   - Log files
   - Filegroups
   - File locations
   - Initial sizes
   - Growth settings
   - Maximum sizes

3. **Behavioral defaults**
   - Collation
   - Recovery model
   - Compatibility level
   - Snapshot behavior
   - Read/write concurrency behavior
   - Query Store behavior

4. **Operational baseline**
   - Ownership
   - Encryption approach
   - Backup chain initialization
   - Monitoring expectations
   - Capacity planning
   - Growth forecasting

> [!important]
> A database is a long-lived operational object, not just a container for tables. Poor creation-time decisions produce years of avoidable operational pain: fragmentation, blocking, slow recovery, poor restore behavior, runaway storage growth, and migration problems.

> [!tip]
> The correct question is not “How do I create a database?” but “What kind of database am I creating, for what workload, under what recovery and operational constraints?”

---

## 2. Core Concepts Glossary

This section defines the terms that must be understood before making any storage or configuration decision.

### 2.1 Page

A **page** is the fundamental unit of storage in SQL Server.

- Size: **8 KB**
- Tables and indexes are ultimately stored in pages.
- Reads and writes happen against pages, not arbitrary byte ranges.


When SQL Server reads data from disk into memory, it reads pages. When it modifies stored data, it modifies pages in memory and later flushes them to disk. This is why page density, fragmentation, and I/O behavior matter so much.

**Example:**
If a query needs a row that lives on a page not already in memory, SQL Server must read that page from disk into the buffer pool.

### 2.2 Extent

An **extent** is a group of **8 contiguous pages**, for a total of **64 KB**.

- Size: **64 KB**
- SQL Server allocates space primarily in extents.


Many file, storage, and formatting recommendations are tied to 64 KB because this is a natural SQL Server allocation boundary.

**Example:**
When a table grows and needs more space, SQL Server typically allocates additional extents rather than allocating storage one row at a time.

### 2.3 Data File

A **data file** is a physical file that stores table and index data.

Common file extensions:
- `.mdf` = primary data file
- `.ndf` = secondary data file

**Context and implications:**
- Data files store user objects such as tables and indexes.
- They also indirectly determine where I/O pressure lands.
- Data files belong to filegroups.
- A database must have at least one data file.

**Example:**
A small application database might have one primary data file only. A large warehouse might have multiple secondary data files spread across user-defined filegroups.

### 2.4 Transaction Log File

A **transaction log file** is a physical file that stores the transaction log.

Common file extension:
- `.ldf`

**Context and implications:**
The log is not just “another file.” It is central to durability, crash recovery, high availability, replication patterns, and restore operations.

The log records changes in sequence before they are considered durable. This means:
- every insert, update, and delete depends on it
- recovery depends on it
- log backups depend on it
- availability technologies depend on it

**Example:**
An OLTP system with heavy write volume may have modest data growth but intense log pressure. In such a system, log sizing and log storage latency can matter more than raw data-file size.

> [!warning]
> Treating the log as if it were just another data file is a major design mistake. Log I/O patterns and growth behavior are different from data files, so placement and sizing must be handled differently.

### 2.5 Primary Data File

The **primary data file** is the single main data file of the database.

- Every database has exactly one.
- It belongs to the **PRIMARY** filegroup.
- It contains core metadata required by the database.


Even in sophisticated filegroup designs, the primary file remains special. You cannot build a database entirely out of secondary files.

### 2.6 Secondary Data File

A **secondary data file** is any data file beyond the primary one.

**Why secondary files exist:**
- To increase storage capacity
- To separate data across filegroups
- To support partitioning strategies
- To place different data sets on different storage tiers
- To distribute allocation or I/O pressure in specific scenarios

**Example:**
A warehouse database might place hot partitions in one filegroup on fast SSD storage and cold historical partitions in another filegroup on cheaper storage.

### 2.7 Filegroup

A **filegroup** is a logical container for one or more data files.

**Why filegroups matter:**
Filegroups are not just administrative labels. They are used to control:
- object placement
- partition placement
- piecemeal restore strategy
- read-only archive design
- backup and restore planning in enterprise environments

**Example:**
You might create:
- `PRIMARY` for metadata and small core objects
- `FG_Current` for active operational data
- `FG_Archive_2024` for older read-only partitions

### 2.8 Default Filegroup

The **default filegroup** is where new objects are created if no filegroup is explicitly specified.


If you define multiple filegroups but forget to manage the default filegroup, objects may still land in the wrong location.

**Example:**
You may create a dedicated application filegroup and set it as default so new tables do not end up in `PRIMARY`.

### 2.9 Logical File Name

The **logical file name** is SQL Server’s internal name for the file.


Administrative commands often refer to logical file names rather than physical paths.

**Example:**
This command uses a logical file name:

```sql
ALTER DATABASE [MyDatabase]
MODIFY FILE (NAME = MyDatabase_Data01, FILEGROWTH = 1024MB);
```

### 2.10 Physical File Path

The **physical file path** is the operating system path to the file.


The physical path determines:
- where I/O occurs
- which storage tier is used
- which permissions are required
- how restores, migrations, and failovers behave

### 2.11 Autogrowth

**Autogrowth** is the mechanism by which SQL Server automatically enlarges a file when its currently allocated space is exhausted.

That short definition is not enough. The operational meaning is the important part.

**What autogrowth actually implies:**
- SQL Server ran out of allocated space inside the current file.
- Work cannot continue indefinitely unless more space is allocated.
- SQL Server must request more disk space from the operating system.
- That growth event can pause or slow user activity.
- For log files, growth can be especially disruptive because new log space must be zero-initialized.

**What autogrowth is not:**
- It is not a sizing strategy.
- It is not a substitute for capacity planning.
- It is not a sign that configuration is “dynamic and smart.”

**Why autogrowth matters so much:**
1. **Performance impact**
   - File growth events consume time and I/O.
   - Large growth events can stall activity.

2. **Operational signal**
   - Frequent autogrowth means your initial sizing is wrong or workload growth is unmanaged.

3. **Fragmentation risk**
   - Repeated growth can lead to less contiguous allocation at the storage layer.

4. **Log-specific risk**
   - Repeated small log growth events create too many VLFs.

**Example:**
A log file starts at 1 GB and grows by 10 MB every few minutes during ETL. That may seem harmless, but after enough growth events you can end up with excessive VLF fragmentation and slower recovery.

> [!warning]
> Autogrowth should be treated as an emergency overflow valve, not as the normal mechanism by which production files obtain their daily working space.

> [!tip]
> A healthy production database may still use autogrowth, but growth events should be infrequent, intentional, monitored, and sized in meaningful fixed increments.

### 2.12 MAXSIZE

**MAXSIZE** defines the upper size limit to which a file can grow.

**Context:**
Without a meaningful cap, a runaway workload can keep consuming storage until the underlying volume is exhausted. That can affect not only one database but an entire instance or host.

**Implications:**
- Protects shared storage from unbounded growth
- Forces capacity planning discipline
- Must be aligned with alerting and available disk space

**Example:**
A staging database may use a strict `MAXSIZE` because it is disposable and should never crowd out production storage.

### 2.13 Virtual Log File (VLF)

A **Virtual Log File** is an internal subdivision of the transaction log.


The log is physically one or more files, but internally it is divided into VLFs. Excessive VLF counts degrade:
- startup time
- crash recovery
- restore operations
- log-scanning operations used by HA/DR features

**What causes bad VLF counts:**
- very small log growth increments
- repeated log autogrowth
- chronic undersizing of the log

**Example:**
A 500 GB log file grown in tiny increments over months often behaves worse operationally than a 500 GB log file that was pre-sized sensibly.

### 2.14 Recovery Model

The **recovery model** is a database setting that determines how transactions are logged and what restore options are possible.


The recovery model is a business decision disguised as a technical setting. It determines whether you can do point-in-time recovery and how much data loss you may face after failure.

**Example:**
Two databases may hold similar data volumes, but the production system requires `FULL` because zero data loss is unacceptable, while a transient ETL landing zone may use `SIMPLE` because the data can be reloaded.

### 2.15 Collation

**Collation** defines string comparison and sorting rules.

It determines:
- case sensitivity
- accent sensitivity
- sort order
- binary vs linguistic comparison behavior
- character encoding behavior in supported collations


Collation affects correctness, not just aesthetics. Different collations can change join behavior, uniqueness behavior, sort order, and interoperability with external systems.

**Example:**
If your database collation differs from `tempdb`, string comparisons involving temp tables may fail unless you explicitly apply `COLLATE`.

### 2.16 Compatibility Level

The **compatibility level** is a database-scoped setting that controls portions of query processor and language behavior.


It allows a database to run on a newer SQL Server engine while still preserving older optimizer behavior for compatibility and regression control.

**Example:**
After upgrading an instance to SQL Server 2022, you may choose to keep a migrated database temporarily below level 160 until testing confirms that plan changes are acceptable.

### 2.17 Query Store

**Query Store** is a database-level feature that records query text, plans, and runtime statistics over time.

**Why this matters during database creation:**
Query Store is part of the database’s baseline observability. In SQL Server 2022, it also underpins several intelligent query processing and optimization features.

**Example:**
If performance regresses after a compatibility-level change, Query Store helps identify plan changes and can support plan forcing.

### 2.18 FILESTREAM

**FILESTREAM** allows large binary objects to be stored in the file system while remaining transactionally consistent with SQL Server.


It is not just “another file type.” It changes backup, restore, storage, and administration patterns.

### 2.19 MEMORY_OPTIMIZED_DATA

The **MEMORY_OPTIMIZED_DATA** filegroup is required for durable In-Memory OLTP objects.


A database intended to host durable memory-optimized tables must be created with the correct special-purpose filegroup design. This cannot be treated as an afterthought in production architecture.

---

## 3. Database Creation Modes

SQL Server supports multiple ways to create a database. These modes are operationally different and must not be conflated.

### 3.1 Create a Brand-New Empty Database

This is the standard case: create new files and initialize a new database.

**Use when:**
- creating a new application database
- creating a new warehouse or mart
- creating a staging or landing database
- creating a dev/test environment from scratch

**Core implication:**
You define the initial physical design directly.

**Example:**
```sql
CREATE DATABASE [SalesOps];
```

This minimal form is syntactically valid, but rarely sufficient for production because it leaves too many critical decisions to defaults.

### 3.2 Attach an Existing Database

This attaches already existing database files to an instance.

**Use when:**
- reattaching a detached database
- moving a non-production database between servers
- recovering a copied database outside normal restore workflow

**Operational implications:**
- file paths must be valid
- permissions must be correct
- version compatibility must be acceptable
- TDE certificate dependencies must be met if encryption is in use

**Warning:**
Attach is not a general substitute for backup/restore in mature environments.

### 3.3 Attach and Rebuild Missing Log

This path is used when data files exist but the log file is missing and SQL Server is able to rebuild it.

**Use when:**
- constrained recovery scenarios
- emergency salvage of certain non-production databases

**Why this is risky:**
This is not normal operations. If you rely on this routinely, your backup strategy is already failing.

### 3.4 Create a Database Snapshot

A **database snapshot** is a read-only static view of a source database at a point in time.

**Use when:**
- you need a stable read-only reference
- you want protection before a risky change
- you want to inspect production data without allowing writes

**Key implications:**
- read-only
- dependent on the source database
- not a replacement for backups

### 3.5 Create a Contained Database

A **contained database** reduces dependency on instance-level configuration and logins.

**Use when:**
- portability matters
- database-level user independence matters
- application isolation requirements justify it

**Caution:**
Containment affects authentication and administration practices. It should be chosen intentionally, not casually.

---

## 4. Workload Archetypes and Why They Change the Design

There is no generic “best database layout.” The correct design is workload-specific.

| Workload Type | Characteristics | Main Storage Concern | Typical Recovery Model | Common Notes |
|---|---|---|---|---|
| OLTP | Many short transactions, random I/O, concurrency | Low-latency log and balanced data layout | FULL | RCSI often considered |
| Data Warehouse | Large scans, batch loads, analytics | Large files, partition/filegroup design | FULL or BULK_LOGGED during managed bulk windows | Columnstore common |
| Hybrid / HTAP | Mixed transactional writes and analytical reads | TempDB pressure, concurrency model, mixed I/O | FULL | Query Store essential |
| Staging / ETL | Large transient loads, rebuildable data | Write throughput and fast reset | SIMPLE often | Tight caps acceptable |
| Archive | Low write rate, retention-heavy, read-mostly | Cheaper storage tiers and read-only design | FULL or SIMPLE depending restore needs | Read-only filegroups may help |
| In-Memory Specialized | Ultra-low latency or latch-sensitive workloads | Memory-optimized storage design and log planning | FULL often | Requires special design |

> [!tip]
> Before writing any `CREATE DATABASE` statement, identify the workload type, expected size after 6–12 months, RPO/RTO targets, peak write windows, and expected maintenance operations.

---

## 5. Physical Storage Architecture

The physical location of files constrains performance and recovery behavior. SQL Server is heavily sensitive to storage latency and throughput.

### 5.1 Storage Media Types

- **NVMe**
  - Lowest latency
  - Highest IOPS
  - Best for intense log, TempDB, and active-data workloads

- **Enterprise SSD**
  - Strong random read/write performance
  - Standard production choice for most active data files

- **Standard SSD**
  - Good for moderate workloads and many archive scenarios

- **HDD**
  - Poor for random I/O
  - Acceptable mainly for backups or colder scan-oriented storage

### 5.2 Placement Principles

| File Type | Access Pattern | Placement Goal |
|---|---|---|
| Log (`.ldf`) | Mostly sequential write | Lowest latency possible, isolated from noisy random I/O where practical |
| TempDB | Heavy random read/write | Fastest practical storage |
| Active data | Mixed random read/write and scans | Fast stable storage |
| Archive data | Mostly scans, fewer writes | Lower-cost storage can be acceptable |
| Backups | Large sequential I/O | Throughput-focused separate path |

### 5.3 What “Separate Drives” Really Means

“Put data and log on separate drives” is a useful rule of thumb, but the real requirement is **separate performance domains**, not just separate letters.

**Correct interpretation:**
- If different drive letters still land on the same shared congested storage, separation may be illusory.
- On modern SAN, HCI, or virtualized platforms, validate actual latency and contention rather than trusting naming conventions.

> [!warning]
> Logical separation without physical or performance isolation can create false confidence.

### 5.4 Instant File Initialization (IFI)

**Instant File Initialization** allows data files to be created or grown without zeroing the newly allocated space.

**Why it matters:**
Without IFI, data file creation and growth can take much longer because the OS must write zeros to the new space before SQL Server can use it.

**What it affects:**
- data file creation
- data file growth
- restore operations involving data-file growth

**What it does not affect:**
- log file creation
- log file growth

> [!important]
> Log files cannot use IFI. This is one reason why log autogrowth events are often more operationally painful than data-file growth events.

---

## 6. Files and Filegroups

### 6.1 Primary Data File (`.mdf`)

The primary data file:
- is mandatory
- exists exactly once per database
- belongs to `PRIMARY`
- contains required database metadata

**Recommendation:**
Keep it explicit and sensibly named.

**Example logical name:**
- `SalesOps_Primary`

### 6.2 Secondary Data Files (`.ndf`)

Secondary data files are optional and used for:
- capacity expansion
- filegroup strategies
- partition layout
- storage-tier separation
- specific throughput or allocation patterns

**Important nuance:**
More files are not automatically better.

> [!warning]
> Do not create multiple data files because “someone said SQL Server likes eight files.” File counts must solve a specific problem, not imitate folklore.

### 6.3 Transaction Log Files (`.ldf`)

A database needs at least one log file.

**Important nuance:**
Multiple log files are usually not a performance strategy.

SQL Server writes to one log file at a time. Additional log files are generally used only as a temporary space workaround if the main log drive is full.

> [!warning]
> Multiple log files do not provide the kind of parallelism people often assume. Adding a second log file is usually a sign of an operational emergency, not a best practice.

### 6.4 PRIMARY Filegroup

The `PRIMARY` filegroup:
- is mandatory
- contains the primary data file
- contains system tables for the database

**Professional recommendation:**
In larger systems, keep `PRIMARY` relatively clean and place user data deliberately into user-defined filegroups when there is an operational reason.

### 6.5 User-Defined Filegroups

Use user-defined filegroups when you need:
- partition management
- archival separation
- read-only subsets
- storage tiering
- piecemeal restore planning

**Example:**
- `FG_Current`
- `FG_Archive_2024`
- `FG_Archive_2025`

### 6.6 FILESTREAM Filegroup

A FILESTREAM filegroup is used for FILESTREAM storage.

**Operational meaning:**
- It maps to a directory structure rather than behaving like a normal rowstore data file.
- It changes administration, restore planning, and storage layout.

### 6.7 MEMORY_OPTIMIZED_DATA Filegroup

A MEMORY_OPTIMIZED_DATA filegroup is required for durable memory-optimized objects.

**Operational meaning:**
- You cannot simply decide later that the database is “in-memory capable” without the proper storage structure.
- If In-Memory OLTP is part of the workload design, plan it at database creation time.

---

## 7. File Specification Parameters

A database file definition typically includes several parameters. These must be understood semantically, not just memorized syntactically.

### 7.1 `NAME`

The logical file name used internally by SQL Server.

**Why it matters:**
Management commands often use `NAME`, not the physical path.

**Example:**
```sql
NAME = SalesOps_Data01
```

### 7.2 `FILENAME`

The OS path to the file.

**Why it matters:**
This determines where the file lives physically and therefore where its I/O and capacity demands land.

**Example:**
```sql
FILENAME = 'E:\SQLData\SalesOps_Data01.ndf'
```

### 7.3 `SIZE`

The initial allocated size of the file.

**Why it matters:**
`SIZE` defines how much space SQL Server asks the OS to allocate immediately. Good initial sizing reduces future autogrowth, fragmentation, and operational interruptions.

**Example:**
```sql
SIZE = 40960MB
```

**Professional interpretation:**
A `SIZE` setting is a forecast. It says, “We expect this file to need at least this much space now or soon enough that allocating it upfront is better than growing it repeatedly later.”

### 7.4 `MAXSIZE`

The maximum size to which the file may grow.

**Why it matters:**
It is a capacity control mechanism.

**Example:**
```sql
MAXSIZE = 500GB
```

**Use thoughtfully:**
- Too small: you create avoidable outages.
- Too loose: you risk consuming all shared storage.

### 7.5 `FILEGROWTH`

The increment by which the file grows during autogrowth.

**Why it matters:**
`FILEGROWTH` determines how disruptive growth events are and how often they occur.

**Examples:**
```sql
FILEGROWTH = 512MB
FILEGROWTH = 4GB
```

**Professional recommendation:**
Use fixed-size increments rather than percentages in most production systems.

> [!warning]
> Percentage growth looks harmless on small files and becomes dangerous on large ones. A 10% growth event on a 2 TB file is not “small and dynamic”; it is a 200 GB storage event.

---

## 8. Sizing and Growth Strategy

Autogrowth is not where sizing strategy begins. Good sizing starts with forecasting.

### 8.1 Initial Sizing Principles

Initial size should be based on:
- expected data volume
- retention window
- compression behavior
- index footprint
- peak growth bursts
- maintenance patterns
- expected runway until the next controlled resize

**Good practice:**
Size for a meaningful future window, not just for today’s row count.

**Example:**
If you expect 300 GB of net growth over the next quarter, a 5 GB initial file with autogrowth is clearly the wrong design.

### 8.2 Why Tiny Defaults Are Harmful

Tiny defaults cause:
- repeated autogrowth
- avoidable file fragmentation
- operational noise
- greater risk of VLF problems in logs
- more frequent pauses during growth events

### 8.3 Data File Growth Guidance

Choose increments that are:
- large enough to avoid constant growth
- small enough not to create huge unnecessary reservations
- aligned with storage behavior and monitoring cadence

### 8.4 Log File Growth Guidance

Choose log increments with more care than data-file increments.

**Why:**
Log growth requires zero-initialization and directly affects write workloads.

Factors to model:
- peak ETL windows
- large index rebuilds
- long-running transactions
- AG/log shipping/replication lag
- log backup frequency

### 8.5 VLF Strategy

The log should be pre-sized for expected bursts.

**Goal:**
Minimize repeated small growth events and avoid creating an excessive VLF count.

> [!tip]
> When you size the log, think in terms of the largest expected burst of unreusable log, not just the average day.

---

## 9. Collation

Collation governs how strings are stored and compared from a linguistic and comparison-rules perspective.

### 9.1 What Collation Controls

- case sensitivity
- accent sensitivity
- sort order
- binary vs linguistic comparison
- character encoding support in relevant collations

### 9.2 Why Collation Must Be Chosen Deliberately

Poor collation choices cause:
- join inconsistencies
- temp table conflicts
- incorrect assumptions in ETL logic
- application behavior mismatches
- painful migrations later

### 9.3 Common Examples

#### `SQL_Latin1_General_CP1_CI_AS`
Legacy SQL collation.

**Context:**
Common in older environments. Often chosen for compatibility rather than modern design quality.

#### `Latin1_General_100_CI_AS_SC_UTF8`
Modern Windows collation with UTF-8 support.

**Context:**
Useful when modern multilingual text or JSON-heavy workloads benefit from UTF-8 storage semantics.

#### `Latin1_General_BIN2`
Binary collation.

**Context:**
Useful for exact binary comparisons and certain technical workloads where linguistic sorting is not desired.

### 9.4 TempDB Interaction

If the database collation differs from `tempdb`, you can encounter string comparison errors in temporary objects.

**Example problem pattern:**
- user table in one collation
- temp table in server/tempdb collation
- string join fails unless `COLLATE` is used explicitly

> [!warning]
> Collation mismatches are a classic source of hidden ETL and reporting failures.

---

## 10. Recovery Models

Recovery model is one of the most consequential database settings because it controls recoverability and log behavior.

### 10.1 FULL

**Definition:**
All required changes are fully logged such that point-in-time recovery is possible when log backups are taken properly.

**What it implies operationally:**
- you must run log backups
- the log does not take care of itself
- backup discipline is part of normal operations
- HA/DR patterns often depend on this model

**Use when:**
- the database matters
- data loss must be minimized
- point-in-time recovery is required
- Availability Groups or similar patterns are used

**Example:**
A production financial transactions database almost always belongs in `FULL` recovery.

### 10.2 BULK_LOGGED

**Definition:**
A model that minimizes logging for certain bulk operations while retaining much of the `FULL` model’s framework.

**Why it exists:**
Some bulk operations produce very large volumes of log. `BULK_LOGGED` can reduce that pressure in carefully controlled windows.

**Use when:**
- large controlled bulk operations justify it
- backup and restore implications are fully understood

**Caution:**
This is not a casual performance switch. It changes restore semantics around minimally logged work.

### 10.3 SIMPLE

**Definition:**
A model in which reusable log space is reclaimed automatically after checkpoint when possible. Log backups are not part of the design.

**What it implies:**
- no point-in-time recovery
- simpler operations
- lower recoverability
- acceptable only when rebuild or data loss is acceptable

**Use when:**
- staging databases
- disposable dev/test databases
- rebuildable transient data stores

> [!important]
> Setting a database to `FULL` is not enough by itself. A first full backup must be taken to establish the operational backup chain expected by many HA/DR workflows.

---

## 11. Compatibility Level

Compatibility level is a database-scoped control over selected optimizer and language behaviors.

### 11.1 Why It Exists

It lets you separate:
- engine version
- database behavior version

This is crucial for upgrade control.

### 11.2 Why It Matters During Creation

For brand-new databases, compatibility level expresses the intended behavioral target.

For migrated databases, it can be used to stage upgrade risk.

### 11.3 Practical Guidance

- Set it explicitly.
- Test before changing it on upgraded workloads.
- Use Query Store to validate the effect of changes.

**Example:**
```sql
ALTER DATABASE [SalesOps] SET COMPATIBILITY_LEVEL = 160;
```

> [!tip]
> Do not treat compatibility level as documentation trivia. It can materially change plan selection and performance characteristics.

---

## 12. Isolation and Concurrency Behavior

Concurrency behavior is part of database design, not just query design.

### 12.1 `ALLOW_SNAPSHOT_ISOLATION`

Allows explicit snapshot-isolation transactions.

**What it implies:**
Readers can access versioned rows instead of waiting behind writers, but row versions must be stored and managed.

### 12.2 `READ_COMMITTED_SNAPSHOT`

Changes the default read committed behavior to use row versioning.

**Why people enable it:**
It often reduces reader/writer blocking significantly.

**What it costs:**
- more TempDB pressure
- more version-store monitoring requirements
- more need to understand long-running transactions

> [!warning]
> Enabling RCSI without proper TempDB design is incomplete engineering.

**Example:**
A reporting-heavy OLTP database may benefit from RCSI because it allows dashboards to read without blocking transactions.

---

## 13. Query Store

Query Store is a core database-level observability and plan-management feature.

### 13.1 What It Stores

- query text
- execution plans
- runtime statistics
- historical execution behavior

### 13.2 Why It Matters at Creation Time

A database should be born with an intentional observability baseline. Query Store is part of that baseline.

In SQL Server 2022 it is even more important because several intelligent performance features depend on or integrate with it.

### 13.3 Main Settings to Understand

- `OPERATION_MODE`
  - `READ_WRITE`
  - `READ_ONLY`

- `QUERY_CAPTURE_MODE`
  - `ALL`
  - `AUTO`
  - `NONE`
  - `CUSTOM`

- `MAX_STORAGE_SIZE_MB`
  - upper storage limit for Query Store data

### 13.4 Practical Recommendation

For most production databases:
- enable Query Store
- use `AUTO` capture initially
- size it realistically
- monitor whether it becomes read-only due to space pressure

---

## 14. Database-Scoped Configuration

Not all important per-database behavior is configured via `ALTER DATABASE ... SET`. SQL Server also provides **database-scoped configuration**.

### 14.1 Why This Matters

This allows workload-specific control of selected optimizer and execution behaviors without changing the whole instance.

### 14.2 Examples

Examples include settings related to:
- `MAXDOP`
- parameter sniffing behavior
- cardinality estimation behavior
- memory grant feedback
- adaptive query processing features

### 14.3 Design Guidance

Do not blindly override every knob at creation time.

Instead:
- know the surface area exists
- document intended defaults
- apply explicit overrides only where workload evidence supports them

---

## 15. Contained Databases

Contained databases reduce reliance on instance-level objects such as traditional login mappings.

### 15.1 Containment Values

- `NONE`
  - classic model
- `PARTIAL`
  - partial containment support

### 15.2 Why This Matters

Containment affects:
- authentication design
- migration behavior
- collation interactions in some scenarios
- operational administration patterns

### 15.3 When to Use It

Use containment only when portability or isolation requirements justify the additional operational model.

---

## 16. FILESTREAM

FILESTREAM is intended for large binary objects that benefit from file-system storage while remaining transactionally integrated with SQL Server.

### 16.1 Use Cases

- large documents
- image/video assets
- very large binary payloads

### 16.2 Why It Is Special

FILESTREAM is not merely a different extension. It changes:
- storage layout
- backup and restore behavior
- administrative expectations
- access patterns

> [!note]
> Use FILESTREAM only when the workload truly justifies it. Most ordinary databases do not need it.

---

## 17. MEMORY_OPTIMIZED_DATA

If the design includes durable memory-optimized objects, the database requires a **MEMORY_OPTIMIZED_DATA** filegroup.

### 17.1 Why It Matters

This is a special storage architecture with distinct operational and recovery characteristics.

### 17.2 Practical Guidance

Do not add this casually. In-Memory OLTP should be a deliberate architectural choice driven by measured need.

---

## 18. Security and Ownership Baseline

Database creation should include a security baseline.

### 18.1 Ownership

A database owner should be chosen intentionally.

**Common practice:**
Set ownership to a stable administrative principal rather than leaving ownership tied to an individual’s account.

### 18.2 Transparent Data Encryption (TDE)

TDE encrypts data and log files at rest.

**Why it matters during design:**
Encryption affects:
- backup/restore dependencies
- certificate and key management
- migration procedures
- compliance workflows

> [!warning]
> If you use TDE and do not protect the relevant certificates/keys, your backup strategy is incomplete.

### 18.3 TRUSTWORTHY and Similar Risky Options

Certain database options carry major security implications.

**Principle:**
Do not enable sensitive options such as `TRUSTWORTHY` casually. They require explicit security justification.

---

## 19. Operational Database Options

A professional guide must distinguish recommended defaults from niche settings.

### 19.1 Commonly Recommended Defaults

- `PAGE_VERIFY CHECKSUM`
- `AUTO_CLOSE OFF`
- `AUTO_SHRINK OFF`

**Why:**
These settings support integrity and predictable performance.

### 19.2 Situational Options

- `READ_ONLY`
- `MULTI_USER`
- `SINGLE_USER`
- `RESTRICTED_USER`
- `DELAYED_DURABILITY`
- Service Broker-related options

These are not universally “on” or “off.” They depend on the workload and administration model.

### 19.3 Why `AUTO_SHRINK` Is Dangerous

`AUTO_SHRINK` seems helpful to inexperienced operators because it appears to reclaim space automatically.

In reality it often causes:
- fragmentation
- repeated shrink/grow cycles
- avoidable I/O churn
- worse performance

> [!warning]
> `AUTO_SHRINK` is usually a symptom of poor capacity management, not a solution to it.

---

## 20. CREATE DATABASE Syntax Surface

A definitive guide must acknowledge that `CREATE DATABASE` is broader than the common “name + files” example.

At a high level, the statement surface includes:
- new database creation
- file and filegroup definitions
- log file definitions
- collation
- containment
- snapshot creation
- attach scenarios

**Practical lesson:**
Do not memorize only one pattern. Choose the pattern that matches the operational reality.

---

## 21. Baseline Production Example

The following example shows a more realistic production-style starting point than `CREATE DATABASE MyDb;`.

```sql
CREATE DATABASE [MarketAnalytics]
ON PRIMARY (
    NAME = N'MarketAnalytics_Primary',
    FILENAME = N'E:\SQLData\MarketAnalytics_Primary.mdf',
    SIZE = 4096MB,
    FILEGROWTH = 512MB,
    MAXSIZE = 50GB
),
FILEGROUP [FG_Current] (
    NAME = N'MarketAnalytics_Current_01',
    FILENAME = N'E:\SQLData\MarketAnalytics_Current_01.ndf',
    SIZE = 102400MB,
    FILEGROWTH = 4096MB,
    MAXSIZE = 1024GB
),
FILEGROUP [FG_Archive] (
    NAME = N'MarketAnalytics_Archive_01',
    FILENAME = N'F:\SQLArchive\MarketAnalytics_Archive_01.ndf',
    SIZE = 204800MB,
    FILEGROWTH = 8192MB,
    MAXSIZE = 4096GB
)
LOG ON (
    NAME = N'MarketAnalytics_Log',
    FILENAME = N'L:\SQLLogs\MarketAnalytics_Log.ldf',
    SIZE = 32768MB,
    FILEGROWTH = 2048MB,
    MAXSIZE = 512GB
)
COLLATE Latin1_General_100_CI_AS_SC_UTF8;
GO

ALTER DATABASE [MarketAnalytics] SET RECOVERY FULL;
ALTER DATABASE [MarketAnalytics] SET COMPATIBILITY_LEVEL = 160;
ALTER DATABASE [MarketAnalytics] SET ALLOW_SNAPSHOT_ISOLATION ON;
ALTER DATABASE [MarketAnalytics] SET READ_COMMITTED_SNAPSHOT ON;
ALTER DATABASE [MarketAnalytics] SET PAGE_VERIFY CHECKSUM;
ALTER DATABASE [MarketAnalytics] SET AUTO_CLOSE OFF;
ALTER DATABASE [MarketAnalytics] SET AUTO_SHRINK OFF;
ALTER DATABASE [MarketAnalytics] SET QUERY_STORE = ON;
ALTER DATABASE [MarketAnalytics] SET QUERY_STORE (
    OPERATION_MODE = READ_WRITE,
    QUERY_CAPTURE_MODE = AUTO,
    SIZE_BASED_CLEANUP_MODE = AUTO,
    MAX_STORAGE_SIZE_MB = 2048
);
ALTER AUTHORIZATION ON DATABASE::[MarketAnalytics] TO [sa];
GO
```

---

## 22. Recommended Creation Workflow

A professional creation workflow usually looks like this:

1. Classify the workload
2. Define RPO/RTO and HA/DR requirements
3. Forecast size and growth for data and log separately
4. Choose filegroup strategy only if it solves a real problem
5. Choose file locations based on actual storage characteristics
6. Pre-size files deliberately
7. Set fixed growth increments
8. Set collation intentionally
9. Set recovery model intentionally
10. Set compatibility level explicitly
11. Configure isolation behavior intentionally
12. Enable and size Query Store
13. Set core safety options
14. Set ownership intentionally
15. Take the first full backup if the database enters `FULL` recovery
16. Add monitoring for file usage, autogrowth, VLFs, and Query Store capacity

> [!tip]
> The first day of a database’s life is when it is cheapest to get the architecture right.

---

## 23. Anti-Patterns

### 23.1 Accepting All Defaults in Production

This usually means:
- bad file placement
- tiny initial size
- poor growth settings
- accidental collation inheritance
- no operational baseline

### 23.2 Using Percentage Growth on Large Files

This leads to unpredictable and eventually enormous growth events.

### 23.3 Letting Autogrowth Handle Daily Capacity Planning

This converts predictable engineering into reactive firefighting.

### 23.4 Enabling `AUTO_SHRINK`

Usually harmful and rarely justified.

### 23.5 Adding Multiple Log Files for “Performance”

Misunderstands how the log works.

### 23.6 Copying File-Count Folklore Without Evidence

Examples:
- arbitrary numbers of data files
- ritualistic separation with no actual storage isolation
- using warehouse patterns for OLTP or vice versa

### 23.7 Ignoring the First Full Backup in `FULL` Recovery

This leaves the database operationally incomplete for many HA/DR patterns.

---

## 24. What to Monitor After Creation

Creation is not the end of the design. The database must be observed.

Monitor at minimum:
- file free space
- autogrowth events
- log reuse waits
- VLF counts
- Query Store size and state
- TempDB pressure if row versioning is enabled
- backup success and cadence
- restore testability
- storage latency

---

## 25. Decision Checklist

Before promoting a newly created database to production, confirm:

- Workload type is documented
- Recovery model is intentional
- First full backup plan exists
- File placement is intentional
- File sizes are pre-sized sensibly
- Growth increments are fixed and realistic
- `MAXSIZE` strategy is defined
- Collation is intentional
- Compatibility level is explicit
- Query Store is configured
- `PAGE_VERIFY CHECKSUM` is enabled
- `AUTO_CLOSE` is OFF
- `AUTO_SHRINK` is OFF
- Ownership is set intentionally
- Monitoring and alerting are ready

---

## Related

- [[server-configuration]] for instance-level settings, TempDB, and host-level preparation
- [[schemas-tables-and-constraints]] for logical schema and table design
- [[keys-defaults-identity-and-sequences]] for key-generation strategy
- [[storage-internals]] for deeper storage mechanics
- [[sql-server-change-tracking]] for downstream change-capture patterns