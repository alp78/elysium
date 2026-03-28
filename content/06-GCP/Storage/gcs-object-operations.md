---
type: concept
category: gcp
technology: [gcp, cloud-storage]
tags: [infrastructure, gcp]
aliases: [GCS objects, gcloud storage, gsutil, Cloud Storage operations, GCS copy, GCS sync, GCS rsync]
keywords: [gcloud storage, gsutil, GCS, cloud storage, ls, cp, copy, rsync, sync, mv, move, rm, delete, object metadata, parallel upload, parallel composite upload, component size, gcloud storage vs gsutil, transfer service, large file, incremental sync]
description: "How to list, copy, sync, move, delete, and inspect metadata of Cloud Storage objects using the gcloud storage CLI — including parallel transfers for large files and incremental sync patterns."
related: [gcs-buckets-and-lifecycle, data-loading-and-export, cloud-run-jobs-vs-services, gcloud-output-formatting]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# GCS Object Operations

Cloud Storage (GCS) is the connective tissue of every GCP data pipeline — where raw data lands, intermediate files live, backups are stored, and exports are staged. The `gcloud storage` command (part of the gcloud CLI) handles all object operations. It automatically parallelizes large transfers and is generally faster than the older `gsutil` command for most data engineering tasks. For the shell-level rsync and scp equivalents of these operations, see [[data-transfer]].

## Listing Objects

```bash
# List objects
gcloud storage ls gs://data-pipeline-bucket/data/
# Shows objects and prefixes (GCS doesn't have real directories — just key prefixes)
```

> [!info] GCS Has No Real Directories
> GCS uses a flat namespace with key prefixes that look like directories. `gs://bucket/data/` is not a folder — it is a filter for all objects whose key starts with `data/`. This matters when deleting "directories" (delete all objects with the prefix) or moving "directories" (copy all + delete all).

## Copying Files

```bash
# Copy local → GCS
gcloud storage cp data.parquet gs://data-pipeline-bucket/pipeline/bronze/
# Automatically detects content type and applies appropriate headers

# Copy GCS → local
gcloud storage cp gs://data-pipeline-bucket/pipeline/gold/scores.parquet ./local/

# Copy with parallel threads (large files and many files)
gcloud storage cp -r ./output/ gs://data-pipeline-bucket/pipeline/ --no-user-output-enabled
# gcloud storage automatically parallelizes large transfers
# For gsutil: gsutil -m cp -r (the -m flag enables multi-threading)
```

## Incremental Sync with rsync

```bash
# Sync (only transfer changed files — like rsync)
gcloud storage rsync -r ./local_data/ gs://data-pipeline-bucket/data/
# rsync compares checksums and only uploads new/changed files
# Critical for: incremental pipeline output, large directory syncs

# Sync with delete (mirror — remove GCS files not in local)
gcloud storage rsync -r -d ./local_data/ gs://data-pipeline-bucket/data/
# -d = delete destination files that don't exist in source
# ⚠️ DANGEROUS: this deletes GCS files. Double-check the direction.
```

> [!warning] Sync with Delete is Irreversible
> The `-d` (delete) flag on `gcloud storage rsync` removes GCS objects that don't exist locally. Always double-check:
> 1. The source and destination are in the correct order
> 2. Versioning is enabled on the bucket if you need recovery (see [[gcs-buckets-and-lifecycle]])
> 3. The sync will delete only what you expect

## Moving and Deleting Objects

```bash
# Move/rename
gcloud storage mv gs://bucket/old_name.csv gs://bucket/new_name.csv
# GCS "move" = copy + delete (not atomic — the object briefly exists in both locations)

# Delete
gcloud storage rm gs://bucket/old_file.csv
gcloud storage rm -r gs://bucket/old_directory/
# -r = recursive (deletes all objects with the prefix)
```

> [!warning] GCS Move Is Not Atomic
> `gcloud storage mv` is implemented as copy + delete. During the operation, the object exists at both the source and destination paths. For critical data, use copy first, verify the destination, then delete the source manually.

## Viewing Object Metadata

```bash
# View object metadata
gcloud storage objects describe gs://bucket/data.parquet
# Shows: size, creation time, md5Hash, content type, storage class, custom metadata
```

Object metadata fields useful for data engineering:
- `size` — file size in bytes
- `md5Hash` — checksum for integrity verification
- `contentType` — MIME type (`application/octet-stream` for Parquet, `text/csv` for CSV)
- `storageClass` — current storage class (see [[gcs-buckets-and-lifecycle]])
- `timeCreated` — when the object was first uploaded
- `updated` — last modification timestamp

## Transfer Optimization

> [!tip] Related pattern
> For code that needs to read GCS objects transparently alongside local files, [[09_py_fileio_serialization|Python's fsspec]] provides a unified file I/O interface that abstracts away `gs://` vs local paths.

> [!tip] Large File Transfer Options
> - **Parallel composite upload** for large files (>150 MB): `gcloud storage cp --component-size=32Mi large_file.parquet gs://bucket/` — splits the file into 32 MB chunks, uploads in parallel, and composes them on the server.
> - **`gsutil` vs `gcloud storage`**: The newer `gcloud storage` command is generally faster and simpler. `gsutil` is still available for features not yet ported. For most data engineering work, use `gcloud storage`.
> - **Transfer Service** for large-scale moves (>1 TB): `gcloud transfer jobs create gs://source/ gs://dest/` — runs as a managed job with retry, parallelism, and scheduling. More reliable than scripted gsutil for bulk transfers.

## Common Pipeline Patterns

```bash
# Bronze landing: local data → GCS staging (Python equivalent: [[22_py_data_transfer]])
gcloud storage cp ./raw_data/*.parquet gs://data-pipeline-bucket/pipeline/bronze/

# Silver processing: Cloud Run job reads from bronze, writes to silver
# (done via Python client library in the container)

# Gold output: export BigQuery results to GCS for downstream consumers
bq extract --destination_format=PARQUET project_data.ohlcv gs://data-pipeline-bucket/pipeline/gold/ohlcv-*.parquet
```

## Related

- [[gcs-buckets-and-lifecycle]] — Creating buckets, storage classes, and lifecycle rules that govern these objects
- [[data-loading-and-export]] — Loading GCS objects into BigQuery with `bq load`
- [[cloud-run-jobs-vs-services]] — Cloud Run Jobs read/write GCS as their primary data interface
- [[gcloud-output-formatting]] — Use `--format` with `gcloud storage ls` for scriptable listings

## References

- [gcloud storage command reference](https://cloud.google.com/sdk/gcloud/reference/storage)
- [Uploading objects](https://cloud.google.com/storage/docs/uploading-objects)
- [Transfer Service](https://cloud.google.com/storage-transfer/docs)
