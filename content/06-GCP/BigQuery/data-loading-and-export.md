---
title: "Data Loading and Export"
tags: [bigquery, gcp, data-loading, data-export]
aliases: [BigQuery load, bq load, BigQuery export, bq extract, time travel, BigQuery GCS load, Parquet BigQuery]
description: "How to load data into BigQuery from GCS using CSV, Parquet, and other formats — including hive-partitioned layouts — and export BigQuery tables back to GCS. Also covers BigQuery time travel for querying and restoring historical data."
parent: "[[domain-data-services]]"
links:
  - "[[gcs-buckets-and-lifecycle]]"
  - "[[gcs-object-operations]]"
  - "[[dataset-and-table-management]]"
  - "[[querying-and-cost-optimization]]"
  - "[[job-management]]"
  - "[[bigquery-problems]]"
  - "[[firestore-data-model-and-operations]]"
  - "[[real-time-nosql-pipelines]]"
created: 2026-03-22
updated: 2026-04-05
status: complete
---

# BigQuery Data Loading and Export

> [!quote]
> "Getting information off the Internet is like taking a drink from a fire hydrant."
>
> — **Mitch Kapor**, founder of Lotus Development

BigQuery ingests data primarily from Cloud Storage (GCS), supporting CSV, Parquet, Avro, ORC, and newline-delimited JSON. Parquet is the recommended format for production loads — it is columnar, compressed, and carries its own schema, eliminating the need for schema specification or header row handling. For a deeper comparison of when to choose each format, see [serialization-formats](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/serialization-formats). This note covers load and export operations, hive-partitioned directory structures, and BigQuery's built-in time travel capability for recovering from data corruption.

## Loading Data from GCS

Loading data from GCS into BigQuery requires `bigquery.dataEditor` on the target dataset and `storage.objectViewer` on the source GCS bucket. Load jobs run asynchronously and are **free** — BigQuery does not charge for loading data from GCS. Each load job supports up to 10,000 source files and 15 TB total input; individual files may not exceed 5 TB. Ensure `bigquery.googleapis.com` is enabled before running any `bq` command.

### bq load — Load from GCS

`bq load` creates an asynchronous load job that reads one or more GCS URIs and writes to a target table. Use glob patterns (`gs://bucket/prefix/*`) to load multiple files in a single job. The target table must already exist, or pass `--autodetect` or `--schema` to create it on first load.

#### bq load --source_format=CSV — load CSV from GCS

Supported source formats: `CSV`, `NEWLINE_DELIMITED_JSON`, `PARQUET`, `AVRO`, `ORC`. The `--skip_leading_rows=1` flag skips the header row, and `--autodetect` infers the schema from data. For production, specify an explicit schema with the `--schema` flag or a `schema.json` file.

```bash
bq load --source_format=CSV --skip_leading_rows=1 --autodetect \
  project_data.staging_ohlcv gs://data-pipeline-bucket/exports/ohlcv.csv
```

```text
Waiting on bqjob_r1a2b3c4d_00000190ab12ef34_1 ... (3s) Current status: DONE
```

#### bq load --source_format=PARQUET — load Parquet from GCS (recommended)

Parquet embeds its schema, so `--autodetect` and `--skip_leading_rows` are not required. The columnar layout and built-in Snappy compression make Parquet the preferred format for production loads.

```bash
bq load --source_format=PARQUET \
  project_data.ohlcv gs://data-pipeline-bucket/exports/ohlcv.parquet
```

```text
Waiting on bqjob_r5e6f7a8b_00000190ab56cd78_1 ... (2s) Current status: DONE
```

> [!warning] Autodetect Schema Can Be Wrong
>
> `--autodetect` Infers Schema from a Sample and Can Be Wrong.
> `--autodetect` reads the first 500 rows of a CSV to infer types. If row 501 has a longer string or a different date format, the load fails or silently truncates data. For production loads, always define an explicit schema with `--schema` or a JSON schema file. Parquet avoids this entirely because the schema is embedded in the file.

> [!success] Specify an Explicit Schema for CSV Loads
>
> Pass `--schema` or a `schema.json` file to `bq load` for all CSV loads in production. This eliminates sampling ambiguity entirely. For new pipelines, switch to Parquet — the schema is embedded in the file and `--autodetect` is never needed.

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

When GCS files are organized with key-value directory segments (`year=2025/month=03/`), `--hive_partitioning_mode=AUTO` maps those directory components to BigQuery partition columns automatically. The source URI must end with `/*` to match all partitions. Expected directory format: `gs://bucket/prefix/year=YYYY/month=MM/file.parquet`.

```bash
bq load --source_format=PARQUET --hive_partitioning_mode=AUTO \
  project_data.ohlcv 'gs://data-pipeline-bucket/data/*'
```

```text
Waiting on bqjob_r9c0d1e2f_00000190ab90ef12_1 ... (5s) Current status: DONE
```

| Flag | Values | Description |
|---|---|---|
| `--source_format` | `PARQUET`, `CSV`, `AVRO`, `ORC`, `NEWLINE_DELIMITED_JSON` | Source file format |
| `--skip_leading_rows` | integer | Rows to skip at start of CSV file (`1` for header row) |
| `--autodetect` | flag | Infer schema from first 500 rows — CSV/JSON only; not needed for Parquet |
| `--schema` | `field:TYPE,...` or path to JSON | Explicit schema; eliminates autodetect sampling errors |
| `--hive_partitioning_mode` | `AUTO`, `CUSTOM`, `STRINGS` | Map GCS directory segments to BigQuery partition columns |
| `--hive_partitioning_source_uri_prefix` | URI prefix | Base prefix stripped before hive partition key detection |
| `--replace` | flag | Truncate and replace table contents instead of appending |
| `--time_partitioning_field` | field name | Use a DATE or TIMESTAMP column for partition pruning |
| `--clustering_fields` | comma-separated fields | Cluster table on up to 4 fields for query performance |
| `--max_bad_records` | integer | Allow N malformed rows before failing the job (default: `0`) |

### bq extract — Export BigQuery Data to GCS

`bq extract` exports a BigQuery table or view to one or more GCS objects. Export jobs are free — no charge for reading BigQuery during export; cost comes only from the resulting GCS storage. Requires `bigquery.dataViewer` on the source table and `storage.objectCreator` on the destination bucket. Supported export formats: `PARQUET`, `CSV`, `NEWLINE_DELIMITED_JSON`, `AVRO`.

#### bq extract — export table to GCS

Use the `*` wildcard in the destination URI to enable parallel sharded export. BigQuery cannot write a single output file larger than approximately 1 GB; the wildcard is required for any non-trivial table.

```bash
bq extract --destination_format=PARQUET \
  project_data.ohlcv gs://data-pipeline-bucket/export/ohlcv-*.parquet
```

```text
Waiting on bqjob_r3a4b5c6d_00000190ab34ef56_1 ... (4s) Current status: DONE
```

#### bq extract --compression — export with compression

GZIP compression reduces CSV export file size significantly. See [compression](https://alp78.github.io/elysium/01-Shell/File-Operations/compression) for algorithm trade-offs.

```bash
bq extract --destination_format=CSV --compression=GZIP \
  project_data.ohlcv gs://data-pipeline-bucket/export/ohlcv-*.csv.gz
```

```text
Waiting on bqjob_r7e8f9a0b_00000190ab78cd90_1 ... (6s) Current status: DONE
```

> [!info] Export Sharding
>
> The `*` wildcard in the export destination path tells BigQuery to shard the output across multiple files. This is required for large tables — BigQuery cannot write a single file larger than ~1 GB. The shards can be read back together with `gs://bucket/prefix-*.parquet`.

| Flag | Values | Description |
|---|---|---|
| `--destination_format` | `PARQUET`, `CSV`, `NEWLINE_DELIMITED_JSON`, `AVRO` | Output file format |
| `--compression` | `GZIP`, `DEFLATE`, `SNAPPY`, `ZSTD`, `NONE` | Compression codec for output files |
| `--field_delimiter` | character | CSV field separator (default: `,`) |
| `--print_header` | boolean | Include header row in CSV output (default: `true`) |

### BigQuery Time Travel

BigQuery retains historical versions of every table for a configurable window — 7 days by default, adjustable from 2 to 7 days per table via `max_time_travel_hours`. Time travel requires no manual setup and adds storage overhead proportional to the volume of row changes; reduce the window on high-churn staging tables to lower cost.

#### bq query — FOR SYSTEM_TIME AS OF

`FOR SYSTEM_TIME AS OF` queries the table as it existed at a given timestamp, within the configured time travel window. Typical use case: "The pipeline corrupted data yesterday — how many rows were there before?"

```bash
bq query --use_legacy_sql=false \
  'SELECT COUNT(*) FROM `project_data.ohlcv` FOR SYSTEM_TIME AS OF TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 3 DAY)'
```

```text
+-------+
| f0_   |
+-------+
| 42500 |
+-------+
```

#### bq cp — restore from time travel snapshot

`bq cp` copies a historical snapshot to a new table without modifying the original. The suffix `@-86400000` references the table state 86,400,000 milliseconds (24 hours) before the current time.

```bash
bq cp project_data.ohlcv@-86400000 project_data.ohlcv_restored
```

```text
Waiting on bqjob_r1f2a3b4c_00000190ab12cd34_1 ... (2s) Current status: DONE
Table 'project_data:project_data.ohlcv_restored' successfully created.
```

> [!tip] Time Travel for Recovery
>
> Time Travel Is Your First Recovery Option.
> Before considering a backup restore or re-running a pipeline, check if time travel can recover the data. It is instantaneous, free, and requires no infrastructure. Only if the corruption occurred more than 7 days ago do you need an alternative recovery strategy.

> [!warning] Time Travel Increases Storage Cost
>
> BigQuery stores all row versions within the time travel window. For tables with frequent updates or deletes, this can add 30–100% to storage cost. High-churn staging tables with the default 168-hour window accumulate significant overhead.

> [!success] Right-Size Time Travel by Table Tier
>
> Set `max_time_travel_hours = 168` on critical production tables and `max_time_travel_hours = 48` on high-churn staging tables. This balances recovery coverage against storage cost.

> [!danger] Time Travel 7-Day Hard Limit
>
> If a table was dropped or corrupted more than 7 days ago, time travel data is permanently gone. Once a table is deleted and 7 days pass, there is no recovery path.

> [!success] Supplement Time Travel with Snapshots and GCS Exports
>
> Set `max_time_travel_hours = 168` on all critical tables and add a scheduled `CREATE SNAPSHOT TABLE` job for long-term audit retention. Export to GCS via `bq extract` on a regular cadence so recovery beyond 7 days is always possible.

> [!tip] Related pattern
>
> The `bq load` workflow mirrors the [bronze-layer-loading](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/bronze-layer-loading) pattern used for SQL Server ingestion — both follow the same stage-then-validate approach for landing raw data into an analytical store. Once data is loaded, [bq-engineering](https://alp78.github.io/elysium/05-DB-Queries/BigQuery/bq-engineering) covers the advanced query patterns that transform and consume it.

### BigQuery Data Format Comparison

| Format | Schema | Compressed | Best for |
|---|---|---|---|
| Parquet | Embedded | Yes (columnar) | Production loads, analytics |
| Avro | Embedded | Yes (row-level) | Streaming, row-oriented workloads |
| CSV | None (autodetect or explicit) | Optional (GZIP) | External sources, simple data |
| NEWLINE_DELIMITED_JSON | None (autodetect or explicit) | Optional | Semi-structured data, APIs |
| ORC | Embedded | Yes | Hive ecosystem compatibility |

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {
  'primaryColor': '#292e42',
  'primaryTextColor': '#c0caf5',
  'primaryBorderColor': '#565f89',
  'lineColor': '#565f89',
  'secondaryColor': '#1a1b26',
  'tertiaryColor': '#24283b',
  'noteTextColor': '#c0caf5',
  'noteBkgColor': '#292e42',
  'textColor': '#c0caf5',
  'fontSize': '14px'
}}}%%
flowchart LR
    GCS1["GCS Bucket (source)"]
    LOAD["bq load (free)"]
    BQ["BigQuery Table"]
    TT["Historical Snapshot"]
    EXTRACT["bq extract (free)"]
    GCS2["GCS Bucket (export)"]

    GCS1 -->|"CSV · Parquet · Avro · ORC"| LOAD
    LOAD --> BQ
    BQ -->|"FOR SYSTEM_TIME AS OF"| TT
    TT -->|"bq cp @-Nms"| BQ
    BQ --> EXTRACT
    EXTRACT -->|"CSV · Parquet · Avro"| GCS2
```

## Related

- [dataset-and-table-management](https://alp78.github.io/elysium/06-GCP/BigQuery/dataset-and-table-management) — Tables must exist (or use `--autodetect`) before loading
- [querying-and-cost-optimization](https://alp78.github.io/elysium/06-GCP/BigQuery/querying-and-cost-optimization) — Querying tables after data is loaded
- [job-management](https://alp78.github.io/elysium/06-GCP/BigQuery/job-management) — Load and export operations create BQ jobs; monitor and cancel them
- [gcs-object-operations](https://alp78.github.io/elysium/06-GCP/Storage/gcs-object-operations) — Managing the GCS objects that feed BigQuery loads
- [gcs-buckets-and-lifecycle](https://alp78.github.io/elysium/06-GCP/Storage/gcs-buckets-and-lifecycle) — Lifecycle rules to auto-expire staging data after loading
- [data-flow-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/data-flow-architecture) — complete data movement topology showing how bq load/extract fits into the stack
- [Terraform BigQuery provisioning](https://alp78.github.io/elysium/07-Terraform/) — IaC for creating BigQuery datasets, tables, and scheduled queries

## References

- [Loading data into BigQuery](https://cloud.google.com/bigquery/docs/loading-data)
- [Exporting table data](https://cloud.google.com/bigquery/docs/exporting-data)
- [Time travel](https://cloud.google.com/bigquery/docs/time-travel)

