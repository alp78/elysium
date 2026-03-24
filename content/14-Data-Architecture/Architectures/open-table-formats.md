---
type: concept
category: lakehouse-architecture
technology: [iceberg, delta-lake, apache-hudi, spark, bigquery, gcp]
tags: [architecture, bigquery, gcp]
aliases: [Apache Iceberg, Delta Lake, Apache Hudi, open table format, lakehouse, data lakehouse, BigLake, ACID transactions on data lake, table format comparison]
keywords: [iceberg, delta lake, hudi, open table format, lakehouse, parquet, ACID, time travel, snapshot isolation, schema evolution, partition evolution, hidden partitioning, merge-on-read, copy-on-write, compaction, medallion architecture, bronze silver gold, GDPR deletion, right to be forgotten, BigLake Metastore, Nessie catalog, manifest file, snapshot, BigQuery Iceberg, GCS, S3, PII registry, data privacy, Databricks, Spark]
description: "Open table formats (Apache Iceberg, Delta Lake, Apache Hudi) add a metadata layer on top of Parquet files on cloud storage to provide ACID transactions, snapshot isolation, time travel, schema evolution, and partition evolution. Covers the metadata tree, Iceberg vs Delta Lake vs Hudi comparison, BigQuery/GCP integration, table maintenance, medallion architecture mapping, and GDPR deletion patterns."
related:
  - "[[dbt-transformation-layer]]"
  - "fastapi and polars"
  - "[[observability-deep-dive]]"
  - "[[idempotent-pipeline-design]]"
  - "[[moc-data-pipeline-lifecycle]]"
  - "[[five-pillars-of-data-engineering]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Open Table Formats and Lakehouse Architecture

The data lakehouse combines the low-cost storage of a data lake with the transactional guarantees of a data warehouse. At its core are **open table formats** — metadata layers that sit on top of Parquet files and provide ACID transactions, time travel, schema evolution, and partition management. Major index providers are building their next-generation data platforms on Apache Iceberg. This chapter covers Iceberg, Delta Lake, and how they fit into a financial data architecture.

> [!info] Why This Matters in Financial Data Engineering
> Major index providers have adopted Apache Iceberg for their next-generation platforms. Understanding open table formats at the architecture level — not just API calls — is what separates a senior data engineer from a mid-level one.

---

## 31.1 Why Open Table Formats Exist

Traditional Parquet files on cloud storage (GCS, S3) are just files — they have no concept of transactions, schema enforcement, or time travel. If your pipeline crashes mid-write, you get corrupt or partial data. If you need to query "what did this table look like yesterday," you cannot.

Open table formats solve this by adding a metadata layer:

```
┌──────────────────────────────────────────────────────────┐
│                    QUERY ENGINE                          │
│         (Spark, Trino, BigQuery, Snowflake, DuckDB)      │
└───────────────────────┬──────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────┐
│               OPEN TABLE FORMAT                          │
│        (Iceberg / Delta Lake / Hudi)                     │
│                                                          │
│  • Metadata files (JSON/Avro) tracking which Parquet     │
│    files belong to the table                             │
│  • Snapshot isolation (readers don't see partial writes)  │
│  • Schema evolution (add/rename/drop columns safely)     │
│  • Time travel (query any historical snapshot)           │
│  • Partition evolution (change partitioning without       │
│    rewriting data)                                       │
└───────────────────────┬──────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────┐
│               CLOUD STORAGE                              │
│              (GCS / S3 / ADLS)                           │
│                                                          │
│  /data/daily_ohlcv/                                     │
│    ├── data/                                            │
│    │   ├── trade_date=2026-03-09/                       │
│    │   │   ├── 00001.parquet                            │
│    │   │   └── 00002.parquet                            │
│    │   └── trade_date=2026-03-10/                       │
│    │       └── 00001.parquet                            │
│    └── metadata/                                        │
│        ├── v1.metadata.json                             │
│        ├── v2.metadata.json  (latest)                   │
│        ├── snap-12345-manifest-list.avro                │
│        └── manifest-abcdef.avro                         │
└──────────────────────────────────────────────────────────┘
```

---

## 31.2 Apache Iceberg Deep Dive

Iceberg is the open table format with the broadest engine support and the most advanced metadata management. It was created at Netflix and is now an Apache top-level project.

### Iceberg's Metadata Tree

```
Catalog (Hive Metastore, REST, Nessie, Glue)
  └── Table metadata file (v2.metadata.json)
        ├── Current snapshot ID
        ├── Schema (with field IDs for safe evolution)
        ├── Partition spec (can evolve over time)
        ├── Sort order
        └── Snapshot list
              └── Snapshot (snap-12345)
                    └── Manifest list (manifest-list.avro)
                          ├── Manifest 1 (manifest-aaa.avro)
                          │     ├── file1.parquet (with column stats: min, max, null count)
                          │     └── file2.parquet
                          └── Manifest 2 (manifest-bbb.avro)
                                └── file3.parquet
```

> [!info] Why the Metadata Tree Matters for Performance
> Iceberg's manifest files contain column-level statistics (min, max, null count) for every data file. Query engines use these statistics to skip entire files without reading them — this is "predicate pushdown" at the storage layer. A query for `WHERE symbol = 'SAP.DE'` on a table with 10,000 files might scan only 12 of them if the manifest stats show which files contain SAP.DE values.

### Key Iceberg Features for Financial Data

| Feature | How It Works | Financial Data Use Case |
|---|---|---|
| **Snapshot isolation** | Readers see a consistent snapshot; writers create a new snapshot atomically | Dashboard reads never see half-written pipeline data |
| **Time travel** | Query any historical snapshot by ID or timestamp | "What was the index composition on March 9?" for audit |
| **Schema evolution** | Add, rename, drop columns by field ID (not position) | Add new signal columns without rewriting historical data |
| **Partition evolution** | Change partitioning without rewriting data | Switch from monthly to daily partitioning as data grows |
| **Hidden partitioning** | Users query without knowing partition columns | `WHERE trade_date = '2026-03-10'` — Iceberg handles the rest |
| **Row-level deletes** | Delete/update individual rows efficiently (merge-on-read or copy-on-write) | GDPR deletion, corporate action corrections |

### Creating an Iceberg Table (Spark)

**Create an Iceberg table with partitioning using PySpark:**

```python
from pyspark.sql import SparkSession

spark = SparkSession.builder \
    .config("spark.sql.catalog.data-pipeline", "org.apache.iceberg.spark.SparkCatalog") \
    .config("spark.sql.catalog.data-pipeline.type", "rest") \
    .config("spark.sql.catalog.data-pipeline.uri", "http://iceberg-rest:8181") \
    .config("spark.sql.catalog.data-pipeline.warehouse", "gs://data-pipeline-lakehouse/") \
    .getOrCreate()

# Create table with partitioning
spark.sql("""
    CREATE TABLE data-pipeline.silver.daily_ohlcv (
        symbol         STRING,
        trade_date     DATE,
        open_price     DECIMAL(12,4),
        high_price     DECIMAL(12,4),
        low_price      DECIMAL(12,4),
        close_price    DECIMAL(12,4),
        volume         BIGINT,
        index_key      STRING,
        loaded_at      TIMESTAMP
    )
    USING iceberg
    PARTITIONED BY (days(trade_date), index_key)
    TBLPROPERTIES (
        'write.format.default' = 'parquet',
        'write.parquet.compression-codec' = 'zstd'
    )
""")
```

### Time Travel Queries

**Time travel queries — query historical snapshots for audit purposes:**

```sql
-- Query the table as it was at a specific timestamp (audit use case)
SELECT * FROM data-pipeline.silver.daily_ohlcv
TIMESTAMP AS OF '2026-03-09T18:00:00Z'
WHERE symbol = 'SAP.DE';

-- Query a specific snapshot ID (from metadata)
SELECT * FROM data-pipeline.silver.daily_ohlcv VERSION AS OF 12345678;

-- See all snapshots (audit trail)
SELECT * FROM data-pipeline.silver.daily_ohlcv.snapshots;

-- Rollback to a previous snapshot (undo a bad pipeline run)
CALL data-pipeline.system.rollback_to_snapshot('silver.daily_ohlcv', 12345677);
```

### Partition Evolution (Change Partitioning Without Rewriting Data)

**Add a new partition field without rewriting existing data:**

```sql
-- Original: partitioned by month
ALTER TABLE data-pipeline.silver.daily_ohlcv
    ADD PARTITION FIELD days(trade_date);

-- Old data stays in monthly partitions
-- New data is written to daily partitions
-- Queries work seamlessly across both partition schemes
-- Iceberg handles the routing automatically
```

> [!tip] Partition Evolution Is Unique to Iceberg
> Neither Delta Lake nor Hudi support partition evolution without a full table rewrite. For tables that grow significantly over time (like a tick data table), this is a critical operational advantage — you can switch from monthly to daily partitions as volume grows without a disruptive migration.

---

## 31.3 Iceberg vs Delta Lake vs Hudi

| Feature | Apache Iceberg | Delta Lake | Apache Hudi |
|---|---|---|---|
| **Created by** | Netflix (2017) | Databricks (2019) | Uber (2016) |
| **Engine support** | Spark, Trino, Flink, Snowflake, BigQuery, Dremio, DuckDB | Spark, Trino (limited), Databricks-native | Spark, Flink, Trino |
| **Hidden partitioning** | Yes (killer feature) | No (users must specify partition columns) | No |
| **Partition evolution** | Yes (without data rewrite) | No (requires full rewrite) | No |
| **Schema evolution** | Field IDs (position-independent) | Column names (position-dependent) | Column names |
| **Time travel** | Snapshot-based | Version-based | Timeline-based |
| **Merge-on-read** | Yes | Yes (Deletion Vectors, 2023+) | Yes (native) |
| **Best for** | Multi-engine environments, evolving schemas | Databricks-native workloads | CDC/streaming-heavy workloads |
| **Adoption 2026** | Growing fastest (Snowflake, BQ native support) | Dominant in Databricks shops | Niche (Uber, streaming) |

> [!info] Recommendation for Financial Data Platforms in 2026
> **Iceberg is the recommended choice** due to its multi-engine support (not locked into Databricks), hidden partitioning (simpler queries for end users), and partition evolution (critical as data volumes grow). If your organization is already on Databricks and using Unity Catalog, Delta Lake is fine — but for new builds, Iceberg is the safer long-term bet.

---

## 31.4 Iceberg on BigQuery (GCP)

BigQuery supports reading and writing Iceberg tables natively via **BigLake Metastore**:

**Create a BigLake external table pointing to Iceberg files on GCS:**

```sql
-- Create a BigLake connection for GCS access
CREATE EXTERNAL TABLE `project_project.silver.daily_ohlcv`
WITH CONNECTION `projects/data-pipeline-project/locations/eu/connections/biglake`
OPTIONS (
    format = 'ICEBERG',
    uris = ['gs://data-pipeline-lakehouse/silver/daily_ohlcv']
);

-- Query Iceberg tables with standard BigQuery SQL
SELECT symbol, trade_date, close_price
FROM `project_project.silver.daily_ohlcv`
WHERE trade_date = '2026-03-10'
ORDER BY close_price DESC;

-- BigQuery's query optimizer uses Iceberg metadata
-- (manifest files, column statistics) to skip irrelevant files
```

> [!tip] BigQuery + Iceberg = Multi-Engine Lakehouse
> With BigLake Metastore, the same Iceberg table can be read by Spark (for heavy transforms), BigQuery (for SQL analytics), and DuckDB (for local development). This is the multi-engine lakehouse architecture — one copy of data, multiple compute engines, no data movement.

---

## 31.5 Table Maintenance: Compaction and Cleanup

Iceberg tables accumulate small files over time (especially with streaming writes or frequent updates). Maintenance operations keep performance optimal:

**Iceberg table maintenance procedures — run as scheduled Airflow tasks:**

```sql
-- Compaction: merge small files into larger ones (target 256MB per file)
CALL data-pipeline.system.rewrite_data_files(
    table => 'silver.daily_ohlcv',
    options => map('target-file-size-bytes', '268435456')  -- 256 MB
);

-- Expire old snapshots (free storage, but loses time travel to those points)
CALL data-pipeline.system.expire_snapshots(
    table => 'silver.daily_ohlcv',
    older_than => TIMESTAMP '2026-02-01 00:00:00',
    retain_last => 10  -- always keep the last 10 snapshots
);

-- Remove orphan files (files not referenced by any snapshot)
CALL data-pipeline.system.remove_orphan_files(
    table => 'silver.daily_ohlcv',
    older_than => TIMESTAMP '2026-02-01 00:00:00'
);

-- Rewrite manifests (optimize metadata for faster planning)
CALL data-pipeline.system.rewrite_manifests('silver.daily_ohlcv');
```

> [!warning] Snapshot Expiry and Time Travel Trade-off
> Expiring snapshots frees storage but permanently loses the ability to time-travel to those snapshots. For financial audit purposes, keep at least 90 days of snapshots for active tables. For bronze/raw tables, 30 days is usually sufficient.

---

## 31.6 The Medallion Architecture on a Lakehouse

The [[medallion-architecture|medallion architecture]] (bronze/silver/gold) maps naturally to a lakehouse:

| Layer | Iceberg Table Properties | Materialization |
|---|---|---|
| **Bronze** | Append-only, partitioned by load_date | Raw data, no deletes |
| **Silver** | Merge-on-read for upserts, partitioned by trade_date | Cleaned, validated, SCD2 via snapshots |
| **Gold** | Copy-on-write for fast reads, sorted by index_key | Aggregated, optimized for dashboard queries |

**GCS lakehouse folder structure for the project financial data:**

```
gs://data-pipeline-lakehouse/
├── bronze/
│   ├── yahoo_ohlcv/          # Iceberg table: append-only
│   ├── corporate_actions/     # Iceberg table: append-only
│   └── index_constituents/    # Iceberg table: append-only
├── silver/
│   ├── daily_ohlcv/          # Iceberg table: upsert via MERGE
│   ├── daily_signals/        # Iceberg table: upsert via MERGE
│   └── dim_constituents/     # Iceberg table: SCD2 via snapshots
└── gold/
    ├── index_performance/    # Iceberg table: overwrite partitions daily
    ├── composite_scores/     # Iceberg table: overwrite partitions daily
    └── constituent_weights/  # Iceberg table: overwrite partitions daily
```

> [!info] dbt + Iceberg
> [[dbt-transformation-layer|dbt]] can target Iceberg tables directly using the `dbt-spark` or `dbt-trino` adapters. The `materialized='incremental'` config maps to Iceberg's MERGE operation. The `snapshots/` folder maps to Iceberg's snapshot-based SCD2 tracking.

---

## 31.7 Data Privacy and GDPR Deletion in Lakehouses

Financial data platforms increasingly handle Personally Identifiable Information (PII) — shareholder registries, client portfolio data, KYC records, beneficial ownership databases. When a data subject exercises their "right to be forgotten" under GDPR Article 17, you must delete their data from immutable Parquet files in a data lake. This is an architectural challenge that forces you to understand the write strategies of your table format.

### The Problem: Deleting From Immutable Files

Parquet files are immutable by design. You cannot remove a single row from a Parquet file — you must rewrite the entire file without that row. In a data lake with millions of files, finding and rewriting every file containing a specific person's data is expensive and error-prone.

### Iceberg's Solution: Merge-on-Read vs Copy-on-Write

| Strategy | How Deletion Works | Read Performance | Write Performance | Best For |
|---|---|---|---|---|
| **Copy-on-Write (CoW)** | Rewrite affected data files without the deleted rows | Fast (no merge at read time) | Slow (rewriting large files) | Read-heavy tables (gold layer, dashboards) |
| **Merge-on-Read (MoR)** | Write a "delete file" listing row positions to skip | Unchanged (until compaction) | Fast (small delete file written) | Write-heavy tables (bronze, silver layers) |

**Iceberg GDPR deletion — step by step:**

```sql
-- Iceberg: delete a specific person's data (uses MoR by default)
DELETE FROM silver.client_portfolios
WHERE client_id = 'GDPR-REQUEST-2026-03-10-00142';

-- What actually happens under the hood:
-- 1. Iceberg scans metadata to find which data files contain this client_id
-- 2. Writes a "position delete file" marking those rows as deleted
-- 3. Future reads skip the deleted rows
-- 4. Original data file is unchanged (until compaction rewrites it)

-- Force compaction to physically remove deleted data
-- (required for true GDPR compliance — the data must not be recoverable)
CALL system.rewrite_data_files(
    table => 'silver.client_portfolios',
    strategy => 'sort',
    where => 'client_id = ''GDPR-REQUEST-2026-03-10-00142'''
);

-- Also expire old snapshots so time-travel can't recover the data
CALL system.expire_snapshots(
    table => 'silver.client_portfolios',
    older_than => TIMESTAMP '2026-03-10 00:00:00',
    retain_last => 1
);

-- Remove orphan files (data files no longer referenced by any snapshot)
CALL system.remove_orphan_files(
    table => 'silver.client_portfolios',
    older_than => TIMESTAMP '2026-03-10 00:00:00'
);
```

### Delta Lake's GDPR Deletion Approach

**Delta Lake delete and vacuum for GDPR compliance:**

```python
from delta.tables import DeltaTable

# Delete the person's data
dt = DeltaTable.forPath(spark, "gs://data-pipeline-lakehouse/silver/client_portfolios")
dt.delete("client_id = 'GDPR-REQUEST-2026-03-10-00142'")

# VACUUM to physically remove old files (required for GDPR)
# Default retention: 7 days — for GDPR, you may need to vacuum immediately
spark.conf.set("spark.databricks.delta.retentionDurationCheck.enabled", "false")
dt.vacuum(0)  # 0 hours = remove all unreferenced files immediately
```

### The GDPR Deletion Pipeline

```
1. RECEIVE     →  GDPR deletion request arrives (legal team → Jira ticket)
2. IDENTIFY    →  Query data catalog: which tables contain this client_id?
                   SELECT table_name, column_name
                   FROM data_catalog.pii_registry
                   WHERE pii_type = 'client_id'
3. AUDIT       →  Log: what will be deleted, from which tables, why
4. DELETE      →  Execute DELETE on each table (Iceberg MoR / Delta tombstone)
5. COMPACT     →  Run compaction to physically remove rows from Parquet files
6. EXPIRE      →  Expire snapshots and vacuum to prevent time-travel recovery
7. VERIFY      →  Query all affected tables: confirm zero rows match client_id
8. CERTIFY     →  Generate deletion certificate for legal/compliance team
```

### PII Registry — Know Where Your Sensitive Data Lives

**PII registry table — maintained by data engineers, queried for GDPR deletions:**

```sql
-- data_catalog.pii_registry — maintained by data engineers
CREATE TABLE data_catalog.pii_registry (
    table_name    NVARCHAR(200) NOT NULL,
    column_name   NVARCHAR(100) NOT NULL,
    pii_type      NVARCHAR(50)  NOT NULL,  -- client_id, email, name, national_id
    sensitivity   NVARCHAR(20)  NOT NULL,  -- HIGH, MEDIUM, LOW
    masking_rule  NVARCHAR(100),           -- SHA256, TRUNCATE, REDACT, NULL
    retention_days INT,                     -- how long to keep before auto-delete
    PRIMARY KEY (table_name, column_name)
);
```

### Key Architectural Decisions for GDPR-Compliant Lakehouses

| Decision | Recommendation | Why |
|---|---|---|
| **Partition by client_id?** | No — creates too many small files | Partition by date; use Iceberg's metadata filtering to find affected files |
| **Separate PII tables** | Yes — isolate PII in dedicated tables | Deletion targets fewer, smaller tables; join by surrogate key |
| **Pseudonymization** | Hash PII at ingestion, store mapping separately | Delete the mapping = effectively delete the person |
| **Retention policies** | Automate deletion after retention period | `CALL expire_snapshots()` on a schedule, `VACUUM` weekly |
| **Audit logging** | Log every deletion with ticket ID, timestamp, row counts | Regulators will ask for proof of deletion |

> [!warning] GDPR Deletion Is an Architecture Decision, Not an Afterthought
> If you design your lakehouse without thinking about deletion, you will spend weeks retrofitting it when the first GDPR request arrives. The best pattern is **PII isolation**: keep all personally identifiable data in separate tables joined by a surrogate key. To "forget" a person, you delete one row from the mapping table and run a single compaction job — instead of scanning every table in the lake. Design for deletion from day one.

---

## Gotchas & Edge Cases

- **Hidden partitioning requires Iceberg-aware query engines:** DuckDB with the Iceberg extension, BigQuery with BigLake, and Spark with the Iceberg Spark extension all support hidden partitioning. Generic Parquet readers do not — they will read all files.
- **Compaction frequency:** How often to compact depends on write frequency. For streaming writes (thousands of files/day), compact daily. For batch pipelines (1-10 files/day), compact weekly.
- **Catalog choice:** The Iceberg table itself is stored on GCS, but you need a catalog to track table locations. Options: REST catalog (flexible), Hive Metastore (legacy), Nessie (git-like branching for data), Google BigLake Metastore (GCP-native). Choose based on your engine ecosystem.
- **Delta Lake Deletion Vectors (2023+):** Delta Lake added MoR-style "Deletion Vectors" in 2023, narrowing the gap with Iceberg's row-level delete performance. If you are on Databricks, check the Deletion Vectors docs before assuming full-file rewrites are required.
- **Iceberg REST catalog vs Hive Metastore:** The REST catalog is the modern standard — it works with any HTTP client and any language. Prefer it for new deployments. Hive Metastore is legacy and requires a Thrift server.
- **`VACUUM` with 0 retention:** Vacuuming with 0 hours retention removes all unreferenced files immediately, including files that concurrent readers might be accessing. Only do this during maintenance windows with no active queries.

## Related
- [[dbt-transformation-layer]] — dbt as the transformation engine for lakehouse tables
- fastapi and polars — Polars for reading Parquet/Iceberg files efficiently
- [[observability-deep-dive]] — lineage and data quality for lakehouse pipelines
- [[idempotent-pipeline-design]] — incremental load patterns for bronze/silver/gold layers
- [[moc-data-pipeline-lifecycle]] — end-to-end pipeline lifecycle in a lakehouse context

## References
- [Apache Iceberg documentation](https://iceberg.apache.org/docs/latest/)
- [Delta Lake documentation](https://docs.delta.io/)
- [Apache Hudi documentation](https://hudi.apache.org/docs/overview/)
- [BigQuery Iceberg tables (BigLake)](https://cloud.google.com/bigquery/docs/iceberg-tables)
- [Project Nessie — git for data](https://projectnessie.org/)
- [Databricks Deletion Vectors](https://docs.databricks.com/en/delta/deletion-vectors.html)
