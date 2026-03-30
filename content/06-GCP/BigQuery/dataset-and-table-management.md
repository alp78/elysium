---
type: concept
category: gcp
technology: [gcp, bigquery]
tags: [infrastructure, bigquery, gcp]
aliases: [BigQuery datasets, BigQuery tables, bq ls, bq show, bq mk, BQ schema, BigQuery table management]
keywords: [bigquery, bq, dataset, table, schema, metadata, bq ls, bq show, bq mk, bq rm, create table, delete table, partitioning, clustering, time partitioning, location, EU, US, data residency, view, materialized view]
description: "How to list, inspect, create, and delete BigQuery datasets and tables using the bq CLI — including schemas, metadata, partitioning, and clustering configuration."
related: [querying-and-cost-optimization, data-loading-and-export, job-management, gcp-projects-and-apis, service-accounts-and-iam]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# BigQuery Dataset and Table Management

BigQuery is Google's serverless data warehouse. It can scan petabytes in seconds, charges $5 per TB scanned (on-demand), and requires zero infrastructure management. The `bq` CLI (installed with the gcloud SDK) is the command-line interface for all BigQuery operations — listing resources, inspecting schemas, creating structures, and deleting objects. The most consequential configuration decisions — dataset location, partitioning strategy, and clustering columns — must be made at table creation time and cannot be changed later.

### Listing BigQuery Datasets and Tables

```bash
# List datasets in the current project
bq ls
# bq = BigQuery command-line tool (installed with gcloud SDK)

# List tables in a dataset
bq ls my_dataset
# Shows: tableId, Type (TABLE/VIEW/MATERIALIZED_VIEW), row count, size
```

### Inspecting BigQuery Schema and Metadata

The `--schema` flag displays only column definitions; `--format=prettyjson` renders human-readable JSON instead of the compact default. Without `--schema`, the full metadata is returned — key fields include `numRows` (row count), `numBytes` (uncompressed size), `type` (`TABLE` | `VIEW` | `MATERIALIZED_VIEW`), `timePartitioning` (partition column and granularity), and `clustering` (clustering columns).

```bash
# Show table schema (column names and types)
bq show --schema --format=prettyjson my_dataset.my_table

# Show table metadata (size, rows, creation time, partitioning, clustering)
bq show --format=prettyjson my_dataset.my_table
```

### Creating BigQuery Datasets

The `--location` flag sets data residency (`EU`, `US`, `asia-northeast1`, etc.). Location cannot be changed after creation, and all tables within a dataset must be in the same location as the dataset.

```bash
# Create a dataset
bq mk --dataset --location=EU --description="data pipeline data" project_data
```

> [!warning] Dataset Location Is Permanent
>
> The `--location` flag sets data residency for all tables in the dataset. Once created, location cannot be changed. For EU data residency compliance, always specify `--location=EU` (multi-region EU) or a specific European region like `europe-west1`.

## Creating Tables

#### bq mk --table — create table with inline schema

Inline schema uses `column_name:TYPE` pairs. Supported types: `STRING`, `INTEGER`, `FLOAT`, `NUMERIC`, `BOOLEAN`, `DATE`, `DATETIME`, `TIMESTAMP`, `BYTES`, `GEOGRAPHY`.

```bash
# Create a table with schema
bq mk --table project_data.ohlcv symbol:STRING,date:DATE,open:FLOAT,high:FLOAT,low:FLOAT,close:FLOAT,volume:INTEGER
```

#### bq mk --time_partitioning_field --clustering_fields — partitioned and clustered table

`--time_partitioning_field` sets the partition column (`DATE` or `TIMESTAMP`), and `--time_partitioning_type` controls granularity (`DAY` | `MONTH` | `YEAR`). `--clustering_fields` accepts up to 4 columns for within-partition sorting. A query filtering on `date` scans only the matching partitions, and clustering on `symbol` further narrows reads to the relevant data blocks.

```bash
# Create a partitioned + clustered table (the optimal layout)
bq mk --table --time_partitioning_field=date --time_partitioning_type=DAY \
  --clustering_fields=symbol,_index \
  project_data.ohlcv schema.json
```

> [!tip] Partition and Cluster by Default
>
> Partitioning + Clustering is the Default Best Practice.
> For any time-series data in BigQuery, partition by the date/timestamp column and cluster by the most common filter columns (e.g., `symbol`, `index`). This combination reduces scanned bytes by 90%+ for typical analytical queries compared to unpartitioned tables. See [querying-and-cost-optimization](/06-GCP/BigQuery/querying-and-cost-optimization) for the full cost impact.

### Deleting BigQuery Tables and Datasets

The `-f` flag forces deletion without a confirmation prompt. Table deletion is not reversible unless you use time travel (see [data-loading-and-export](/06-GCP/BigQuery/data-loading-and-export)). The `-r` flag enables recursive deletion, removing all tables within the dataset first.

```bash
# Delete a table
bq rm -f my_dataset.my_table

# Delete a dataset and all its tables
bq rm -r -f my_dataset
```

### BigQuery Column Types Reference

| Type | Description |
|---|---|
| `STRING` | Variable-length UTF-8 text |
| `INTEGER` | 64-bit signed integer |
| `FLOAT` | 64-bit IEEE 754 floating point |
| `NUMERIC` | Exact decimal (38 digits, 9 decimal places) |
| `BOOLEAN` | `true` or `false` |
| `DATE` | Calendar date (no time) |
| `DATETIME` | Date and time (no timezone) |
| `TIMESTAMP` | Absolute point in time (with timezone) |
| `BYTES` | Variable-length binary data |
| `GEOGRAPHY` | Geographic data types |

## Related

- [querying-and-cost-optimization](/06-GCP/BigQuery/querying-and-cost-optimization) — Cost impact of partitioning and clustering on query scans
- [data-loading-and-export](/06-GCP/BigQuery/data-loading-and-export) — Loading data into tables and exporting to GCS
- [job-management](/06-GCP/BigQuery/job-management) — Monitoring and canceling BQ jobs
- [gcp-projects-and-apis](/06-GCP/Core/gcp-projects-and-apis) — `bigquery.googleapis.com` must be enabled before any `bq` command works
- [service-accounts-and-iam](/06-GCP/Security/service-accounts-and-iam) — `roles/bigquery.dataEditor` + `roles/bigquery.jobUser` required

## References

- [BigQuery data types](https://cloud.google.com/bigquery/docs/reference/standard-sql/data-types)
- [Creating and using tables](https://cloud.google.com/bigquery/docs/tables)
- [Partitioned tables](https://cloud.google.com/bigquery/docs/partitioned-tables)
