---
title: "GCS Object Operations"
tags: [gcp, gcs, gcloud]
aliases: [GCS objects, gcloud storage, gsutil, Cloud Storage operations, GCS copy, GCS sync, GCS rsync]
description: "How to list, copy, sync, move, delete, and inspect metadata of Cloud Storage objects using the gcloud storage CLI — including parallel transfers for large files and incremental sync patterns."
parent: "[[domain-data-services]]"
links:
  - "[[gcs-buckets-and-lifecycle]]"
  - "[[dataset-and-table-management]]"
  - "[[data-loading-and-export]]"
  - "[[querying-and-cost-optimization]]"
  - "[[job-management]]"
  - "[[bigquery-problems]]"
  - "[[firestore-data-model-and-operations]]"
  - "[[real-time-nosql-pipelines]]"
created: 2026-03-22
updated: 2026-04-05
status: complete
---

# GCS Object Operations

> [!quote]
> "GCS is the connective tissue of every GCP pipeline — data lands there, stages there, backs up there, and exports from there. Master the object operations and the rest follows."
>
> — **Valentin Deleplace**, Google Cloud Developer Advocate

Cloud Storage (GCS) is the connective tissue of every GCP data pipeline — where raw data lands, intermediate files live, backups are stored, and exports are staged. The `gcloud storage` command (part of the gcloud CLI) handles all object operations. It automatically parallelizes large transfers and is generally faster than the older `gsutil` command for most data engineering tasks. For the shell-level rsync and scp equivalents of these operations, see [data-transfer](https://alp78.github.io/elysium/01-Shell/File-Operations/data-transfer).

> [!todo] Prerequisites
>
> 1. Enable the Cloud Storage API: `gcloud services enable storage.googleapis.com`
> 2. Authenticate: `gcloud auth login` (interactive) or `gcloud auth activate-service-account` (CI/CD)
> 3. Required IAM roles: `roles/storage.objectViewer` (read), `roles/storage.objectAdmin` (read/write/delete), or `roles/storage.admin` (full bucket + object control)
> 4. Install the gcloud CLI (part of Google Cloud SDK)

> [!info] `gcloud storage` Replaces `gsutil`
>
> `gcloud storage` is the modern replacement for `gsutil`. It is faster (automatic parallelism, optimized HTTP), supports the same operations, and is actively developed. `gsutil` is in maintenance mode — Google recommends migrating all scripts to `gcloud storage`. The main syntax difference: `gsutil -m cp -r` becomes `gcloud storage cp -r` (parallelism is automatic, no `-m` flag needed).

> [!info] GCS Pricing Model
>
> GCS pricing has three components: **storage** (per GB/month, varies by class — Standard: ~$0.020/GB, Nearline: ~$0.010/GB, Coldline: ~$0.004/GB, Archive: ~$0.0012/GB), **operations** (Class A mutating operations like write/list: ~$0.05 per 10K ops; Class B read operations: ~$0.004 per 10K ops), and **egress** (free within the same region, ~$0.01/GB cross-region within GCP, ~$0.12/GB to internet). Pricing varies by region — see [Cloud Storage pricing](https://cloud.google.com/storage/pricing).

> [!info] GCS Quotas and Limits
>
> - Maximum single object size: **5 TiB**
> - Maximum single upload size (without composite): **5 GiB** — files larger than this require parallel composite upload or resumable upload
> - Maximum compose components: **32** per compose operation
> - Maximum bucket-level operations: **1 read/write per second per object** (higher with retry backoff)
> - Object names: up to **1,024 bytes** UTF-8 encoded

## Core Object Operations

The fundamental GCS operations — listing, copying, syncing, moving, deleting, and inspecting objects — all use the `gcloud storage` CLI. Each command supports glob patterns, recursive flags, and automatic parallelism for multi-file transfers.

### gcloud | List objects

Listing enumerates objects and prefixes (virtual directories) in a bucket or under a specific prefix. GCS uses a flat namespace — there are no real directories, only key prefixes that look like paths.

#### List objects in a prefix

```bash
gcloud storage ls gs://data-pipeline-bucket/data/
```

```text
gs://data-pipeline-bucket/data/2026-01-01/
gs://data-pipeline-bucket/data/2026-01-02/
gs://data-pipeline-bucket/data/schema.json
```

#### List objects recursively with details

The `-l` flag shows object size and creation time. The `-r` flag recurses into all prefixes.

```bash
gcloud storage ls -l -r gs://data-pipeline-bucket/data/
```

```text
    1048576  2026-03-20T14:32:00Z  gs://data-pipeline-bucket/data/2026-01-01/trades.parquet
    2097152  2026-03-20T14:32:05Z  gs://data-pipeline-bucket/data/2026-01-01/quotes.parquet
TOTAL: 2 objects, 3145728 bytes (3 MiB)
```

#### Stream object content to stdout

`gcloud storage cat` reads an object and writes its content to standard output — useful for inspecting small files or piping to other tools without downloading.

```bash
gcloud storage cat gs://data-pipeline-bucket/data/schema.json
```

```text
{"fields": [{"name": "date", "type": "DATE"}, {"name": "ticker", "type": "STRING"}]}
```

> [!info] GCS Has No Real Directories
>
> GCS uses a flat namespace with key prefixes that look like directories. `gs://bucket/data/` is not a folder — it is a filter for all objects whose key starts with `data/`. This matters when deleting "directories" (delete all objects with the prefix) or moving "directories" (copy all + delete all).

| Flag | Syntax | Description |
|---|---|---|
| `-r` | `gcloud storage ls -r gs://bucket/` | List objects recursively under all prefixes |
| `-l` | `gcloud storage ls -l gs://bucket/` | Show object size and creation timestamp |
| `-L` | `gcloud storage ls -L gs://bucket/obj` | Show full metadata (storage class, hashes, custom metadata) |
| `-b` | `gcloud storage ls -b gs://bucket/` | List bucket-level details only, not objects |
| `--format` | `gcloud storage ls --format=json gs://bucket/` | Output as JSON for scripting |

> [!danger] Recursive Delete Is Irreversible
>
> `gcloud storage rm -r gs://bucket/prefix/` deletes all matching objects immediately with no confirmation prompt and no trash. If versioning is not enabled on the bucket, the data is permanently gone. Always enable versioning on buckets containing pipeline data or backups (see [gcs-buckets-and-lifecycle](https://alp78.github.io/elysium/06-GCP/Storage/gcs-buckets-and-lifecycle)). A single typo in the prefix can wipe an entire dataset.

> [!success] Enable Versioning Before Any Bulk Delete
>
> Enable versioning on every pipeline bucket: `gcloud storage buckets update gs://bucket --versioning`. With versioning active, `rm` makes objects noncurrent rather than permanently deleting them. Recover with `gcloud storage cp -v gs://bucket/file#<generation> gs://bucket/file`. For staged cleanups, do a dry-run first with `gcloud storage ls -r gs://bucket/prefix/` to verify the affected object list before issuing the `rm` command.

### gcloud | Copy objects

`gcloud storage cp` copies objects between local filesystems and GCS, or between GCS buckets. It automatically detects content types, parallelizes large transfers, and resumes interrupted uploads. This is the workhorse command for data pipeline ingestion and export.

#### Copy local file to GCS

```bash
gcloud storage cp data.parquet gs://data-pipeline-bucket/pipeline/bronze/
```

```text
Copying file://data.parquet to gs://data-pipeline-bucket/pipeline/bronze/data.parquet
  Completed files 1/1 | 15.2MiB/15.2MiB
```

#### Copy GCS object to local

```bash
gcloud storage cp gs://data-pipeline-bucket/pipeline/gold/scores.parquet ./local/
```

```text
Copying gs://data-pipeline-bucket/pipeline/gold/scores.parquet to file://./local/scores.parquet
  Completed files 1/1 | 8.7MiB/8.7MiB
```

#### Copy a directory recursively

The `-r` flag copies all objects under a prefix. `gcloud storage` automatically parallelizes multi-file transfers — no `-m` flag needed (unlike the legacy `gsutil -m cp -r`).

```bash
gcloud storage cp -r ./output/ gs://data-pipeline-bucket/pipeline/
```

```text
Copying file://./output/part-001.parquet to gs://data-pipeline-bucket/pipeline/output/part-001.parquet
Copying file://./output/part-002.parquet to gs://data-pipeline-bucket/pipeline/output/part-002.parquet
  Completed files 2/2 | 30.4MiB/30.4MiB
```

#### Copy between GCS buckets

```bash
gcloud storage cp -r gs://source-bucket/data/ gs://dest-bucket/data/
```

| Flag | Syntax | Description |
|---|---|---|
| `-r` | `gcloud storage cp -r src/ gs://bucket/` | Copy recursively (all files in directory/prefix) |
| `-n` | `gcloud storage cp -n src gs://bucket/` | No-clobber — skip objects that already exist at the destination |
| `-z` | `gcloud storage cp -z csv,json src gs://bucket/` | Compress specified file extensions during upload (gzip transport encoding) |
| `-Z` | `gcloud storage cp -Z src gs://bucket/` | Compress all files during upload regardless of extension |
| `--include` | `gcloud storage cp -r --include="*.parquet" src/ gs://bucket/` | Only copy files matching the glob pattern |
| `--exclude` | `gcloud storage cp -r --exclude="*.tmp" src/ gs://bucket/` | Skip files matching the glob pattern |
| `--no-user-output-enabled` | `gcloud storage cp --no-user-output-enabled src gs://bucket/` | Suppress progress output (useful in CI/CD scripts) |
| `--content-type` | `gcloud storage cp --content-type=text/csv src gs://bucket/` | Override the auto-detected MIME type |

### gcloud | Sync objects incrementally

`gcloud storage rsync` compares checksums and sizes between source and destination, then transfers only new or changed files. This is the primary tool for incremental pipeline output and large directory syncs. Unlike `cp`, it skips objects that already match — saving time and egress cost on repeated runs.

#### Sync local directory to GCS

```bash
gcloud storage rsync -r ./local_data/ gs://data-pipeline-bucket/data/
```

```text
Copying file://./local_data/new_file.parquet to gs://data-pipeline-bucket/data/new_file.parquet
Skipping file://./local_data/existing_file.parquet (already matches destination)
  Completed files 1/1 | 5.1MiB/5.1MiB
```

#### Sync with delete (mirror mode)

The `-d` flag deletes destination objects that do not exist in the source, making the destination an exact mirror. Double-check the source/destination direction before using this flag.

```bash
gcloud storage rsync -r -d ./local_data/ gs://data-pipeline-bucket/data/
```

```text
Copying file://./local_data/new_file.parquet to gs://data-pipeline-bucket/data/new_file.parquet
Removing gs://data-pipeline-bucket/data/stale_file.csv
  Completed files 1/1 | 5.1MiB/5.1MiB
```

> [!warning] Sync with Delete Is Irreversible
>
> The `-d` (delete) flag on `gcloud storage rsync` removes GCS objects that don't exist locally. Always double-check:
> 1. The source and destination are in the correct order
> 2. Versioning is enabled on the bucket if you need recovery (see [gcs-buckets-and-lifecycle](https://alp78.github.io/elysium/06-GCP/Storage/gcs-buckets-and-lifecycle))
> 3. The sync will delete only what you expect

> [!success] Dry-Run Rsync Before Enabling Delete
>
> Run `gcloud storage rsync -r --dry-run` to preview what would be transferred and deleted before committing. Enable bucket versioning so that any accidental deletions are noncurrent and recoverable. For automated pipelines, prefer `rsync` without `-d` unless mirroring is an explicit requirement — additive syncs are always safer.

| Flag | Syntax | Description |
|---|---|---|
| `-r` | `gcloud storage rsync -r src/ gs://bucket/` | Recurse into subdirectories/prefixes |
| `-d` | `gcloud storage rsync -d src/ gs://bucket/` | Delete destination objects not in source (mirror mode) |
| `-n` | `gcloud storage rsync -n src/ gs://bucket/` | Dry-run — show what would be transferred without executing |
| `--include` | `gcloud storage rsync --include="*.parquet" src/ gs://bucket/` | Only sync files matching the glob pattern |
| `--exclude` | `gcloud storage rsync --exclude="*.tmp" src/ gs://bucket/` | Skip files matching the glob pattern |
| `-x` | `gcloud storage rsync -x ".*\.log$" src/ gs://bucket/` | Exclude files matching a regex pattern |

### gcloud | Move and delete objects

Move renames or relocates objects within or across buckets. Delete removes objects permanently (unless versioning is enabled). Both operations are irreversible without versioning.

#### Move (rename) an object

GCS move is implemented as copy + delete — the object briefly exists at both paths during the operation. This is not atomic.

```bash
gcloud storage mv gs://bucket/old_name.csv gs://bucket/new_name.csv
```

```text
Copying gs://bucket/old_name.csv to gs://bucket/new_name.csv
Removing gs://bucket/old_name.csv
  Completed files 1/1 | 256.0KiB/256.0KiB
```

#### Delete a single object

```bash
gcloud storage rm gs://bucket/old_file.csv
```

```text
Removing gs://bucket/old_file.csv
```

#### Delete all objects under a prefix

The `-r` flag recursively deletes all objects matching the prefix. There is no confirmation prompt.

```bash
gcloud storage rm -r gs://bucket/old_directory/
```

```text
Removing gs://bucket/old_directory/file1.csv
Removing gs://bucket/old_directory/file2.csv
Removing gs://bucket/old_directory/
  Completed 2/2
```

> [!warning] GCS Move Is Not Atomic
>
> `gcloud storage mv` is implemented as copy + delete. During the operation, the object exists at both the source and destination paths. For critical data, use copy first, verify the destination, then delete the source manually.

> [!success] Safe Move Pattern for Critical Data
>
> For critical objects, perform the move manually in two steps: (1) `gcloud storage cp gs://bucket/source gs://bucket/dest` — copy and verify with `gcloud storage objects describe gs://bucket/dest` to confirm size and `md5Hash` match; (2) only then `gcloud storage rm gs://bucket/source`. This eliminates the risk of data loss if the delete step is interrupted.

| Flag | Syntax | Description |
|---|---|---|
| `-r` | `gcloud storage rm -r gs://bucket/prefix/` | Delete all objects recursively under the prefix |
| `-a` | `gcloud storage rm -a gs://bucket/obj` | Delete all versions of the object (including noncurrent) |
| `--continue-on-error` | `gcloud storage rm --continue-on-error -r gs://bucket/prefix/` | Continue deleting remaining objects if some fail |

### gcloud | Inspect object metadata

`gcloud storage objects describe` returns detailed metadata for a single object — size, checksums, content type, storage class, timestamps, and custom metadata. This is the primary tool for verifying uploads and debugging pipeline data.

#### Describe an object

```bash
gcloud storage objects describe gs://bucket/data.parquet
```

```text
bucket: bucket
content_type: application/octet-stream
crc32c_hash: aB1cD2==
etag: CMDx4qLw9PoCEAE=
generation: 1711288320000000
md5_hash: 1B2M2Y8AsgTpgAmY7PhCfg==
metageneration: 1
name: data.parquet
size: 15728640
storage_class: STANDARD
time_created: 2026-03-20T14:32:00Z
updated: 2026-03-20T14:32:00Z
```

Object metadata fields useful for data engineering:

- `size` — file size in bytes
- `md5_hash` — checksum for integrity verification after copy or transfer
- `content_type` — MIME type (`application/octet-stream` for Parquet, `text/csv` for CSV)
- `storage_class` — current storage class (see [gcs-buckets-and-lifecycle](https://alp78.github.io/elysium/06-GCP/Storage/gcs-buckets-and-lifecycle))
- `time_created` — when the object was first uploaded
- `updated` — last modification timestamp
- `crc32c_hash` — CRC32C checksum (used by `gcloud storage` for integrity checks)

#### Verify object checksum locally

`gcloud storage hash` computes local file checksums for comparison against GCS object hashes.

```bash
gcloud storage hash ./local/data.parquet
```

```text
Hashes [./local/data.parquet]:
    Hash (crc32c): aB1cD2==
    Hash (md5):    1B2M2Y8AsgTpgAmY7PhCfg==
```

## Transfer Optimization

Large-scale data pipelines often involve files exceeding hundreds of megabytes or transfers spanning terabytes of data. `gcloud storage` provides built-in parallelism, but composite uploads and the managed Transfer Service offer additional throughput for extreme workloads.

### gcloud | Parallel composite upload

For files larger than 150 MB, parallel composite upload splits the file into chunks, uploads each chunk in parallel, and composes them into a single object on the server. This significantly reduces upload time for large Parquet files, database exports, and model artifacts.

```bash
gcloud storage cp --component-size=32Mi large_file.parquet gs://bucket/
```

> [!warning] Composite Upload Compatibility Risk
>
> When using `--component-size` for parallel composite uploads, the resulting GCS object is composed from multiple components. Some tools (older versions of gsutil, third-party libraries) may fail to read composite objects correctly, or the CRC32C checksum may differ from what a standard upload produces. Test downstream readers before enabling this in production pipelines.

> [!success] Test Composite Object Compatibility First
>
> Before enabling `--component-size` in production, upload a representative test file and verify it with all downstream readers (BigQuery `bq load`, Python `gcsfs`, your C# GCS client). If any reader fails, fall back to standard single-stream upload or use the Transfer Service for large-scale bulk moves instead. Composite uploads are best suited for one-off large file ingestion where downstream compatibility is confirmed.

### gcloud | Transfer Service for bulk moves

For large-scale transfers exceeding 1 TB — cross-bucket, cross-region, or from other cloud providers — the Storage Transfer Service runs as a managed job with automatic retry, parallelism, and scheduling. It is more reliable than scripted CLI transfers for bulk data migrations.

```bash
gcloud transfer jobs create gs://source-bucket/ gs://dest-bucket/ --name=bulk-migration
```

> [!info] Related Pattern
>
> For code that needs to read GCS objects transparently alongside local files, [Python's fsspec](https://alp78.github.io/elysium/02-Programming-Languages/Python/09_py_fileio_serialization) provides a unified file I/O interface that abstracts away `gs://` vs local paths.

> [!warning] Egress Costs on Cross-Region and Internet Transfers
>
> Downloading data from GCS to on-premises or to the internet incurs egress charges (~$0.12/GB to internet, ~$0.01/GB cross-region within GCP). A 500 GB export to a local machine costs ~$60 in egress alone. Cross-region bucket-to-bucket copies also incur egress fees.

> [!success] Minimize Egress with Co-located Processing
>
> Keep compute and storage in the same region to avoid egress charges. Use Cloud Run Jobs or Compute Engine VMs in the same region as your GCS bucket. For large exports, consider BigQuery `EXPORT DATA` to a same-region bucket, then download only the final aggregated results. Use [Transfer Service](https://cloud.google.com/storage-transfer/docs) for scheduled cross-region replication to amortize cost.

### gcloud | Generate signed URLs

Signed URLs provide time-limited, authenticated access to a GCS object without requiring the requester to have a Google account or IAM role. This is essential for sharing pipeline outputs with external consumers, generating download links for dashboards, or granting temporary upload access.

```bash
gcloud storage sign-url gs://bucket/pipeline/gold/report.parquet --duration=1h
```

```text
---
resource: gs://bucket/pipeline/gold/report.parquet
signed_url: https://storage.googleapis.com/bucket/pipeline/gold/report.parquet?X-Goog-Signature=...&X-Goog-Expires=3600...
expiration: 2026-04-05T15:00:00Z
http_verb: GET
---
```

> [!tip] Signed URL Best Practices
>
> - Keep durations as short as possible — minutes for API consumers, hours only for manual downloads.
> - Use `--private-key-file` with a dedicated service account key for production signing. In CI/CD, prefer `--impersonate-service-account` to avoid key files on disk.
> - Signed URLs are `GET` by default. Use `--http-verb=PUT` to generate upload URLs for external partners.

## Pipeline Patterns

GCS is the staging layer in the medallion architecture pattern used by most GCP data pipelines. Bronze landing copies raw data to GCS, silver processing happens inside Cloud Run Jobs or Dataflow via client libraries, and gold output exports BigQuery results back to GCS for downstream consumers. The Python equivalent of these CLI patterns is covered in [22_py_data_transfer](https://alp78.github.io/elysium/02-Programming-Languages/Python/22_py_data_transfer).

### gcloud | Bronze landing

Copy raw local data to the GCS bronze (staging) layer.

```bash
gcloud storage cp ./raw_data/*.parquet gs://data-pipeline-bucket/pipeline/bronze/
```

```text
Copying file://./raw_data/trades_2026-04-04.parquet to gs://data-pipeline-bucket/pipeline/bronze/trades_2026-04-04.parquet
Copying file://./raw_data/quotes_2026-04-04.parquet to gs://data-pipeline-bucket/pipeline/bronze/quotes_2026-04-04.parquet
  Completed files 2/2 | 45.3MiB/45.3MiB
```

### bq | Gold export

Export BigQuery query results back to GCS as Parquet for downstream consumers or external delivery.

```bash
bq extract --destination_format=PARQUET project_data.ohlcv gs://data-pipeline-bucket/pipeline/gold/ohlcv-*.parquet
```

```text
Waiting on bqjob_r1234abcd_00000190... (0s) Current status: DONE
```

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
    A["Local Files"] -->|"gcloud storage cp"| B["GCS Bronze"]
    B -->|"Cloud Run Job<br/>(Python client)"| C["GCS Silver"]
    C -->|"bq load"| D["BigQuery"]
    D -->|"bq extract"| E["GCS Gold"]
    E -->|"gcloud storage cp<br/>or signed URL"| F["Downstream<br/>Consumers"]

    style A fill:#292e42,stroke:#565f89,color:#c0caf5
    style B fill:#1a1b26,stroke:#f7768e,color:#c0caf5
    style C fill:#1a1b26,stroke:#e0af68,color:#c0caf5
    style D fill:#1a1b26,stroke:#7aa2f7,color:#c0caf5
    style E fill:#1a1b26,stroke:#9ece6a,color:#c0caf5
    style F fill:#292e42,stroke:#565f89,color:#c0caf5
```

## Related

- [gcs-buckets-and-lifecycle](https://alp78.github.io/elysium/06-GCP/Storage/gcs-buckets-and-lifecycle) — Creating buckets, storage classes, and lifecycle rules that govern these objects
- [data-loading-and-export](https://alp78.github.io/elysium/06-GCP/BigQuery/data-loading-and-export) — Loading GCS objects into BigQuery with `bq load`
- [cloud-run-jobs-vs-services](https://alp78.github.io/elysium/06-GCP/Serverless/cloud-run-jobs-vs-services) — Cloud Run Jobs read/write GCS as their primary data interface
- [gcloud-output-formatting](https://alp78.github.io/elysium/06-GCP/Core/gcloud-output-formatting) — Use `--format` with `gcloud storage ls` for scriptable listings
- [bq-fundamentals](https://alp78.github.io/elysium/05-DB-Queries/BigQuery/bq-fundamentals) — BigQuery query patterns for data loaded from GCS
- [gcs-terraform](https://alp78.github.io/elysium/07-Terraform/GCP/gcs-terraform) — Provisioning GCS buckets and IAM bindings with Terraform

## References

- [gcloud storage command reference](https://cloud.google.com/sdk/gcloud/reference/storage)
- [Uploading objects](https://cloud.google.com/storage/docs/uploading-objects)
- [Transfer Service](https://cloud.google.com/storage-transfer/docs)
- [Signed URLs](https://cloud.google.com/storage/docs/access-control/signed-urls)
- [Cloud Storage pricing](https://cloud.google.com/storage/pricing)
