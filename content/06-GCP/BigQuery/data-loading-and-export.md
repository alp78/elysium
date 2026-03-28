---
type: concept
category: gcp
technology: [gcp, bigquery, gcs]
tags: [infrastructure, bigquery, gcp]
aliases: [BigQuery load, bq load, BigQuery export, bq extract, time travel, BigQuery GCS load, Parquet BigQuery]
keywords: [bq load, bq extract, CSV, Parquet, AVRO, ORC, NEWLINE_DELIMITED_JSON, GCS, hive partitioning, autodetect schema, time travel, FOR SYSTEM_TIME AS OF, restore, bq cp, compression, GZIP, export, data loading, ingestion]
description: "How to load data into BigQuery from GCS using CSV, Parquet, and other formats — including hive-partitioned layouts — and export BigQuery tables back to GCS. Also covers BigQuery time travel for querying and restoring historical data."
related: [dataset-and-table-management, querying-and-cost-optimization, job-management, gcs-object-operations, gcs-buckets-and-lifecycle]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# BigQuery Data Loading and Export

BigQuery ingests data primarily from Cloud Storage (GCS), supporting CSV, Parquet, Avro, ORC, and newline-delimited JSON. Parquet is the recommended format for production loads — it is columnar, compressed, and carries its own schema, eliminating the need for schema specification or header row handling. For a deeper comparison of when to choose each format, see [[serialization-formats]]. This note covers load and export operations, hive-partitioned directory structures, and BigQuery's built-in time travel capability for recovering from data corruption.

## Loading Data from GCS

#### bq load --source_format=CSV — load CSV from GCS
```bash
# Load CSV from GCS into BigQuery
bq load --source_format=CSV --skip_leading_rows=1 --autodetect \
  project_data.staging_ohlcv gs://data-pipeline-bucket/exports/ohlcv.csv
# --source_format = CSV | NEWLINE_DELIMITED_JSON | PARQUET | AVRO | ORC
# --skip_leading_rows=1 = skip header row
# --autodetect = infer schema from data
# For production: specify explicit schema with --schema flag or schema.json
```

#### bq load --source_format=PARQUET — load Parquet from GCS (recommended)
```bash
# Load Parquet (best format — schema is embedded, columnar, compressed)
bq load --source_format=PARQUET project_data.ohlcv gs://data-pipeline-bucket/exports/ohlcv.parquet
# No --autodetect needed — Parquet files contain their own schema
# No --skip_leading_rows — Parquet is binary, not text
```

> [!tip] Always Use Parquet for Production Loads
> Parquet is the superior format for BigQuery loads because:
> - Schema is embedded in the file (no `--autodetect` ambiguity)
> - Columnar compression reduces file size by 70-90% vs CSV
> - No header row handling needed
> - Native type mapping (dates, timestamps, decimals are correctly typed)
>
> The only reason to use CSV is when you receive data from an external source that doesn't support Parquet.

#### bq load --hive_partitioning_mode=AUTO — load from Hive-partitioned GCS
```bash
# Load with partitioning from GCS Hive layout
bq load --source_format=PARQUET --hive_partitioning_mode=AUTO \
  project_data.ohlcv 'gs://data-pipeline-bucket/data/*'
# --hive_partitioning_mode=AUTO = detect partition columns from directory names
# Directory structure: gs://bucket/data/year=2025/month=03/data.parquet
```

## Exporting Data to GCS

```bash
# Export table to GCS
bq extract --destination_format=PARQUET project_data.ohlcv gs://data-pipeline-bucket/export/ohlcv-*.parquet
# Wildcard * = BigQuery shards the output (parallel export, multiple files)
# PARQUET | CSV | NEWLINE_DELIMITED_JSON | AVRO

# Export with compression (see [[compression]] for algorithm trade-offs)
bq extract --destination_format=CSV --compression=GZIP \
  project_data.ohlcv gs://data-pipeline-bucket/export/ohlcv-*.csv.gz
```

> [!info] Export Sharding
> The `*` wildcard in the export destination path tells BigQuery to shard the output across multiple files. This is required for large tables — BigQuery cannot write a single file larger than ~1 GB. The shards can be read back together with `gs://bucket/prefix-*.parquet`.

## Time Travel — Querying Historical Data

BigQuery retains 7 days of historical data for every table. The `FOR SYSTEM_TIME AS OF` clause lets you query the table as it existed at any point within that window — without any snapshots or backups needed.

```bash
# Time travel — query data as it existed at a past point in time
bq query --use_legacy_sql=false \
  'SELECT COUNT(*) FROM `project_data.ohlcv` FOR SYSTEM_TIME AS OF TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 3 DAY)'
# FOR SYSTEM_TIME AS OF = query the table as it existed at that timestamp
# BigQuery retains 7 days of time travel data by default
# Use case: "The pipeline corrupted data yesterday — how many rows were there before?"
```

## Restoring a Table from Time Travel

```bash
# Restore a table from time travel
bq cp project_data.ohlcv@-86400000 project_data.ohlcv_restored
# @-86400000 = 86400000 milliseconds ago (24 hours)
# cp = copy the historical snapshot to a new table
```

> [!tip] Time Travel Is Your First Recovery Option
> Before considering a backup restore or re-running a pipeline, check if time travel can recover the data. It is instantaneous, free, and requires no infrastructure. Only if the corruption occurred more than 7 days ago do you need an alternative recovery strategy.

> [!tip] Related pattern
> The `bq load` workflow mirrors the [[bronze-layer-loading]] pattern used for SQL Server ingestion — both follow the same stage-then-validate approach for landing raw data into an analytical store. Once data is loaded, [[bq-engineering]] covers the advanced query patterns that transform and consume it.

## Format Comparison

| Format | Schema | Compressed | Best for |
|---|---|---|---|
| Parquet | Embedded | Yes (columnar) | Production loads, analytics |
| Avro | Embedded | Yes (row-level) | Streaming, row-oriented workloads |
| CSV | None (autodetect or explicit) | Optional (GZIP) | External sources, simple data |
| NEWLINE_DELIMITED_JSON | None (autodetect or explicit) | Optional | Semi-structured data, APIs |
| ORC | Embedded | Yes | Hive ecosystem compatibility |

## Related

- [[dataset-and-table-management]] — Tables must exist (or use `--autodetect`) before loading
- [[querying-and-cost-optimization]] — Querying tables after data is loaded
- [[job-management]] — Load and export operations create BQ jobs; monitor and cancel them
- [[gcs-object-operations]] — Managing the GCS objects that feed BigQuery loads
- [[gcs-buckets-and-lifecycle]] — Lifecycle rules to auto-expire staging data after loading

## References

- [Loading data into BigQuery](https://cloud.google.com/bigquery/docs/loading-data)
- [Exporting table data](https://cloud.google.com/bigquery/docs/exporting-data)
- [Time travel](https://cloud.google.com/bigquery/docs/time-travel)
