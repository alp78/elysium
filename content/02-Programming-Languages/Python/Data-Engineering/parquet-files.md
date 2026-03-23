---
type: concept
category: data-formats
technology: [python, duckdb, bash]
tags: [concept, python, data-formats, parquet, etl, snippet, reference]
aliases: [Parquet format, columnar storage, DuckDB Parquet, Parquet inspection, Parquet partitioning, Hive partitioning, Parquet vs CSV, Parquet compression, columnar file format]
keywords: [parquet, duckdb, columnar, column pruning, predicate pushdown, row group, compression, snappy, zstd, hive partitioning, partition pruning, parquet-tools, parquet schema, csv to parquet, parquet to csv, merge parquet, analytical storage, data lake, file format]
description: "Parquet is the columnar binary standard for analytical data storage. This note covers why Parquet outperforms CSV, how to inspect and convert files with DuckDB, and how to write partitioned and clustered datasets for optimal query performance."
related: [awk-data-processing, serialization-formats, date-and-time-handling, sql-python-csharp-transforms]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Parquet Files — The Columnar Standard

Parquet is the de facto standard for analytical data storage. It stores data column-by-column, achieves 5-10x compression over CSV, supports predicate pushdown (skip irrelevant data), and embeds the schema in the file footer. Every serious data pipeline should output Parquet, not CSV. See [[serialization-formats]] for a full comparison of all formats.

## Why Parquet Matters

**Format comparison:**

| Feature | CSV | JSON | Parquet |
|---|---|---|---|
| Format | Text, row-based | Text, hierarchical | Binary, columnar |
| Schema | None (headers optional) | None | Embedded |
| Compression | ~2x with gzip | ~2x with gzip | ~5-10x native |
| Column pruning | No (read entire line) | No | Yes (read only needed columns) |
| Predicate pushdown | No | No | Yes (skip row groups via min/max stats) |
| Append | Simple | Simple | Requires new file or merge |
| Human-readable | Yes | Yes | No |
| Best for | Small exchanges, imports | APIs, configs | Analytics, data lakes, pipelines |

> [!tip] Parquet vs CSV for Pipelines
> CSV is for human-readable data exchange and tool compatibility. Parquet is for pipelines and data lakes. The 5-10x compression alone halves your storage and transfer costs. Column pruning and predicate pushdown mean a query for one column reads 1/N of the data. Use CSV at pipeline boundaries where external tools need it; use Parquet everywhere internally.

> [!info] Columnar Storage Explained
> In a row-based format (CSV, JSON), all values for a single record are stored together. In a columnar format (Parquet), all values for a single column are stored together. This means:
> - **Column pruning**: `SELECT name FROM data` reads only the `name` column bytes — ignores all other columns entirely.
> - **Predicate pushdown**: Each row group stores min/max statistics per column. `WHERE date = '2026-03-10'` skips entire row groups where max date < '2026-03-10'.
> - **Better compression**: Repeated values in a column (e.g., a `country` column with 90% 'US') compress dramatically better when stored together.

## Inspecting and Converting Parquet Files

**DuckDB is the fastest way to work with Parquet files without installing Python packages:**

```bash
# View schema
parquet-tools schema data.parquet
# or: duckdb -c "DESCRIBE SELECT * FROM 'data.parquet';"

# View metadata (row groups, compression, statistics)
duckdb -c "SELECT * FROM parquet_metadata('data.parquet');"
# Shows: column min/max values, null counts, compression codec per column
# Use case: verify clustering is effective (check if min/max ranges are narrow)

# Row count without reading data
duckdb -c "SELECT COUNT(*) FROM 'data.parquet';"

# CSV to Parquet
duckdb -c "COPY (SELECT * FROM read_csv_auto('data.csv')) TO 'data.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);"

# Parquet to CSV
duckdb -c "COPY (SELECT * FROM 'data.parquet') TO 'data.csv' (HEADER, DELIMITER ',');"

# Merge multiple Parquet files
duckdb -c "COPY (SELECT * FROM 'parts/*.parquet') TO 'merged.parquet' (FORMAT PARQUET);"
```

> [!tip] DuckDB for Parquet Inspection
> DuckDB can query Parquet files directly with full SQL — no Python, no Spark, no cluster needed. `parquet_metadata()` is especially powerful: it shows per-column min/max statistics, null counts, and compression ratios. If your clustering is working, the min/max ranges for the sort key should be narrow within each row group.

## Partitioning and Clustering

Partitioning splits a dataset into directories by column value. Clustering sorts data within files. Both dramatically improve query performance by reducing the amount of data read.

**Write and read Hive-partitioned Parquet datasets:**
```bash
# Write Hive-partitioned dataset
duckdb -c "COPY (SELECT * FROM 'data.parquet') TO 'output/' (FORMAT PARQUET, PARTITION_BY (year, month));"
# Creates: output/year=2025/month=03/data_0.parquet

# Read with partition pruning
duckdb -c "SELECT * FROM parquet_scan('output/**/*.parquet', hive_partitioning=1) WHERE year = 2025;"
# Only reads the year=2025/ directory — skips all other years

# Write clustered (sorted) Parquet
duckdb -c "COPY (SELECT * FROM 'data.parquet' ORDER BY symbol, date) TO 'clustered.parquet' (FORMAT PARQUET, ROW_GROUP_SIZE 100000);"
# Sorting enables row group skipping: WHERE symbol = 'ASML' → only reads row groups where min <= 'ASML' <= max
```

> [!info] Hive Partitioning Convention
> The `year=2026/month=03/` directory naming convention is called "Hive partitioning" — originated in Apache Hive. It is understood natively by DuckDB, Spark, BigQuery external tables, AWS Athena, and most modern data tools. Use it for any dataset partitioned by date or categorical columns.

> [!tip] Choosing Partition Columns
> Partition by columns you commonly filter on (e.g., `year`, `month`, `region`). Too many partitions (e.g., partitioning by day across 5 years = 1,825 directories) creates "small file problems" — overhead from listing thousands of files outweighs the benefit. A good rule: aim for 100MB-1GB per partition file.

## Compression Codecs for Parquet

See [[serialization-formats]] for the full compression comparison. For Parquet specifically:
- **Snappy** — default in many tools; very fast compress/decompress; moderate ratio (~1.5-2x)
- **Zstd** — best overall for storage pipelines; fast and good ratio (2-4x); recommended for new pipelines
- **Gzip** — maximum compatibility with legacy tools; slower; similar ratio to Zstd

**Specify compression when writing:**
```bash
# Zstd — recommended for production storage
duckdb -c "COPY (SELECT * FROM 'data.csv' USING SAMPLE) TO 'data.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);"

# Snappy — use if downstream tools don't support Zstd
duckdb -c "COPY (SELECT * FROM 'data.csv') TO 'data.parquet' (FORMAT PARQUET, COMPRESSION SNAPPY);"
```

## Related Notes

- [[awk-data-processing|awk for CSV processing]] — JSON and CSV processing in Bash, Python, PowerShell
- [[serialization-formats]] — Full format decision matrix: JSON, YAML, CSV, Parquet, Avro, Protobuf, MessagePack, Pickle
- [[date-and-time-handling]] — ISO 8601 date formatting for Parquet file naming conventions
- [[sql-python-csharp-transforms]] — Data manipulation transforms that output to Parquet

## References

- [Apache Parquet format specification](https://parquet.apache.org/docs/file-format/)
- [DuckDB Parquet docs](https://duckdb.org/docs/data/parquet/overview)
- [parquet-tools](https://github.com/apache/parquet-mr/tree/master/parquet-tools)
