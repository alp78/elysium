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

```bash
# Show table schema (column names and types)
bq show --schema --format=prettyjson my_dataset.my_table
# --schema = display only column definitions
# --format=prettyjson = human-readable JSON (vs. compact default)

# Show table metadata (size, rows, creation time, partitioning, clustering)
bq show --format=prettyjson my_dataset.my_table
# KEY FIELDS:
# numRows = row count
# numBytes = uncompressed size
# type = TABLE | VIEW | MATERIALIZED_VIEW
# timePartitioning = partition column and type (DAY, MONTH, YEAR)
# clustering = clustering columns
```

### Creating BigQuery Datasets

```bash
# Create a dataset
bq mk --dataset --location=EU --description="data pipeline data" project_data
# --location = data residency (EU, US, asia-northeast1, etc.)
# Location CANNOT be changed after creation
# Tables within a dataset must be in the same location as the dataset
```

> [!warning] Dataset Location Is Permanent
> The `--location` flag sets data residency for all tables in the dataset. Once created, location cannot be changed. For EU data residency compliance, always specify `--location=EU` (multi-region EU) or a specific European region like `europe-west1`.

## Creating Tables

#### bq mk --table — create table with inline schema
```bash
# Create a table with schema
bq mk --table project_data.ohlcv symbol:STRING,date:DATE,open:FLOAT,high:FLOAT,low:FLOAT,close:FLOAT,volume:INTEGER
# Inline schema: column_name:TYPE pairs
# Types: STRING, INTEGER, FLOAT, NUMERIC, BOOLEAN, DATE, DATETIME, TIMESTAMP, BYTES, GEOGRAPHY
```

#### bq mk --time_partitioning_field --clustering_fields — partitioned and clustered table
```bash
# Create a partitioned + clustered table (the optimal layout)
bq mk --table --time_partitioning_field=date --time_partitioning_type=DAY \
  --clustering_fields=symbol,_index \
  project_data.ohlcv schema.json
# --time_partitioning_field = partition column (DATE or TIMESTAMP)
# --time_partitioning_type = DAY | MONTH | YEAR (granularity of partitions)
# --clustering_fields = up to 4 columns for within-partition sorting
# WHY: A query filtering on date scans only the matching partition(s)
#       Then clustering on symbol further narrows to only the relevant data blocks
```

> [!tip] Partitioning + Clustering is the Default Best Practice
> For any time-series data in BigQuery, partition by the date/timestamp column and cluster by the most common filter columns (e.g., `symbol`, `index`). This combination reduces scanned bytes by 90%+ for typical analytical queries compared to unpartitioned tables. See [[querying-and-cost-optimization]] for the full cost impact.

### Deleting BigQuery Tables and Datasets

```bash
# Delete a table
bq rm -f my_dataset.my_table
# -f = force (no confirmation prompt)
# ⚠️ This is NOT reversible (unless you use time travel — see data-loading-and-export)

# Delete a dataset and all its tables
bq rm -r -f my_dataset
# -r = recursive (delete all tables first)
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

- [[querying-and-cost-optimization]] — Cost impact of partitioning and clustering on query scans
- [[data-loading-and-export]] — Loading data into tables and exporting to GCS
- [[job-management]] — Monitoring and canceling BQ jobs
- [[gcp-projects-and-apis]] — `bigquery.googleapis.com` must be enabled before any `bq` command works
- [[service-accounts-and-iam]] — `roles/bigquery.dataEditor` + `roles/bigquery.jobUser` required

## References

- [BigQuery data types](https://cloud.google.com/bigquery/docs/reference/standard-sql/data-types)
- [Creating and using tables](https://cloud.google.com/bigquery/docs/tables)
- [Partitioned tables](https://cloud.google.com/bigquery/docs/partitioned-tables)
