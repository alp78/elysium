---
type: concept
category: gcp
technology: [gcp, bigquery, gcs]
tags: [infrastructure, bigquery, gcp]
aliases: [BigQuery load, bq load, BigQuery export, bq extract, time travel, BigQuery GCS load, Parquet BigQuery]
keywords: [bq load, bq extract, CSV, Parquet, AVRO, ORC, NEWLINE_DELIMITED_JSON, GCS, hive partitioning, autodetect schema, time travel, FOR SYSTEM_TIME AS OF, restore, bq cp, compression, GZIP, export, data loading, ingestion]
description: "How to load data into BigQuery from GCS using CSV, Parquet, and other formats — including hive-partitioned layouts — and export BigQuery tables back to GCS. Also covers BigQuery time travel for querying and restoring historical data."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# BigQuery Data Loading and Export

> [!quote]
> "Data is a precious thing and will last longer than the systems themselves."
> — **Tim Berners-Lee**

BigQuery ingests data primarily from Cloud Storage (GCS), supporting CSV, Parquet, Avro, ORC, and newline-delimited JSON. Parquet is the recommended format for production loads — it is columnar, compressed, and carries its own schema, eliminating the need for schema specification or header row handling. For a deeper comparison of when to choose each format, see [serialization-formats](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/serialization-formats). This note covers load and export operations, hive-partitioned directory structures, and BigQuery's built-in time travel capability for recovering from data corruption.

## Loading Data from GCS

#### bq load --source_format=CSV — load CSV from GCS

Supported source formats: `CSV`, `NEWLINE_DELIMITED_JSON`, `PARQUET`, `AVRO`, `ORC`. The `--skip_leading_rows=1` flag skips the header row, and `--autodetect` infers the schema from data. For production, specify an explicit schema with the `--schema` flag or a `schema.json` file.

```bash
# Load CSV from GCS into BigQuery
bq load --source_format=CSV --skip_leading_rows=1 --autodetect \
  project_data.staging_ohlcv gs://data-pipeline-bucket/exports/ohlcv.csv
```

#### bq load --source_format=PARQUET — load Parquet from GCS (recommended)
```bash
# Load Parquet (best format — schema is embedded, columnar, compressed)
bq load --source_format=PARQUET project_data.ohlcv gs://data-pipeline-bucket/exports/ohlcv.parquet
# No --autodetect needed — Parquet files contain their own schema
# No --skip_leading_rows — Parquet is binary, not text
```

> [!warning] Autodetect Schema Can Be Wrong
>
> `--autodetect` Infers Schema from a Sample and Can Be Wrong.
> `--autodetect` reads the first 500 rows of a CSV to infer types. If row 501 has a longer string or a different date format, the load fails or silently truncates data. For production loads, always define an explicit schema with `--schema` or a JSON schema file. Parquet avoids this entirely because the schema is embedded in the file.

> [!tip] Use Parquet for Production
>
> Always Use Parquet for Production Loads.
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

### Exporting BigQuery Data to GCS

The `*` wildcard in the destination path causes BigQuery to shard the output across multiple files (parallel export). Supported formats: `PARQUET`, `CSV`, `NEWLINE_DELIMITED_JSON`, `AVRO`.

```bash
# Export table to GCS
bq extract --destination_format=PARQUET project_data.ohlcv gs://data-pipeline-bucket/export/ohlcv-*.parquet

# Export with compression (see [compression](https://alp78.github.io/elysium/01-Shell/File-Operations/compression) for algorithm trade-offs)
bq extract --destination_format=CSV --compression=GZIP \
  project_data.ohlcv gs://data-pipeline-bucket/export/ohlcv-*.csv.gz
```

> [!info] Export Sharding
>
> The `*` wildcard in the export destination path tells BigQuery to shard the output across multiple files. This is required for large tables — BigQuery cannot write a single file larger than ~1 GB. The shards can be read back together with `gs://bucket/prefix-*.parquet`.

### BigQuery Time Travel — Querying Historical Data

BigQuery retains 7 days of historical data for every table. The `FOR SYSTEM_TIME AS OF` clause lets you query the table as it existed at any point within that window — without any snapshots or backups needed.

`FOR SYSTEM_TIME AS OF` queries the table as it existed at a given timestamp. BigQuery retains 7 days of time travel data by default. Typical use case: "The pipeline corrupted data yesterday — how many rows were there before?"

```bash
# Time travel — query data as it existed at a past point in time
bq query --use_legacy_sql=false \
  'SELECT COUNT(*) FROM `project_data.ohlcv` FOR SYSTEM_TIME AS OF TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 3 DAY)'
```

### Restoring a BigQuery Table from Time Travel

```bash
# Restore a table from time travel
bq cp project_data.ohlcv@-86400000 project_data.ohlcv_restored
# @-86400000 = 86400000 milliseconds ago (24 hours)
# cp = copy the historical snapshot to a new table
```

> [!tip] Time Travel for Recovery
>
> Time Travel Is Your First Recovery Option.
> Before considering a backup restore or re-running a pipeline, check if time travel can recover the data. It is instantaneous, free, and requires no infrastructure. Only if the corruption occurred more than 7 days ago do you need an alternative recovery strategy.

> [!danger] Time Travel 7-Day Limit
>
> Time Travel Has a 7-Day Hard Limit.
> If a table was dropped or corrupted more than 7 days ago, time travel data is permanently gone. For critical tables, extend the time travel window to the maximum (7 days is the default, configurable up to 7 days for Standard edition). For longer retention, set up scheduled table snapshots or export to GCS on a regular cadence. Once a table is deleted and 7 days pass, there is no recovery path.

> [!tip] Related pattern
>
> The `bq load` workflow mirrors the [bronze-layer-loading](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/bronze-layer-loading) pattern used for SQL Server ingestion — both follow the same stage-then-validate approach for landing raw data into an analytical store. Once data is loaded, [bq-engineering](https://alp78.github.io/elysium/05-DB-Queries/BigQuery/bq-engineering) covers the advanced query patterns that transform and consume it.

### BigQuery Data Format Comparison

| Format | Schema | Compressed | Best for |
|---|---|---|---|
| Parquet | Embedded | Yes (columnar) | Production loads, analytics |
| Avro | Embedded | Yes (row-level) | Streaming, row-oriented workloads |
| CSV | None (autodetect or explicit) | Optional (GZIP) | External sources, simple data |
| NEWLINE_DELIMITED_JSON | None (autodetect or explicit) | Optional | Semi-structured data, APIs |
| ORC | Embedded | Yes | Hive ecosystem compatibility |

## Related

- [dataset-and-table-management](https://alp78.github.io/elysium/06-GCP/BigQuery/dataset-and-table-management) — Tables must exist (or use `--autodetect`) before loading
- [querying-and-cost-optimization](https://alp78.github.io/elysium/06-GCP/BigQuery/querying-and-cost-optimization) — Querying tables after data is loaded
- [job-management](https://alp78.github.io/elysium/06-GCP/BigQuery/job-management) — Load and export operations create BQ jobs; monitor and cancel them
- [gcs-object-operations](https://alp78.github.io/elysium/06-GCP/Storage/gcs-object-operations) — Managing the GCS objects that feed BigQuery loads
- [gcs-buckets-and-lifecycle](https://alp78.github.io/elysium/06-GCP/Storage/gcs-buckets-and-lifecycle) — Lifecycle rules to auto-expire staging data after loading

## Related
- [data-flow-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/data-flow-architecture) — complete data movement topology showing how bq load/extract fits into the stack

## References

- [Loading data into BigQuery](https://cloud.google.com/bigquery/docs/loading-data)
- [Exporting table data](https://cloud.google.com/bigquery/docs/exporting-data)
- [Time travel](https://cloud.google.com/bigquery/docs/time-travel)
