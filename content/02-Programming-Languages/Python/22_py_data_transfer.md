---
type: reference
category: programming-languages
technology: [python, gcp]
tags: [python, gcp, data-transfer, benchmarks]
aliases: [Data Transfer Python, GCS Transfer, BigQuery Load]
keywords: [GCS, gsutil, gcloud storage, Cloud SQL, BigQuery, upload, download, transfer, SCP, SSH, parallel, compression, gzip, tar, benchmark, latency, throughput]
description: "Python data transfer reference — GCS upload/download, VM file copy, SQL Server bulk insert, BigQuery load benchmarks with interactive charts. See [22_cs_data_transfer](https://alp78.github.io/elysium/02-Programming-Languages/CSharp/22_cs_data_transfer) for the C# equivalent."
created: 2026-03-27
updated: 2026-03-27
status: complete
---

# 22. Data Transfer — GCS, SQL Server, BigQuery

> [!quote]
> "Make it work, make it right, make it fast — in that order. But when moving data at scale, make it parallel."
>
> — **Kent Beck**

```python
# All imports for data transfer benchmarking across GCP services

# Standard library
import bz2
import gzip as gzip_mod
import json
import lzma
import multiprocessing
import os
import shutil
import subprocess
import tempfile
import threading
import time
import zipfile
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

# Data & serialisation
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

# Compression (third-party)
import brotli
import lz4.frame
import zstandard as zstd

# SSH & networking
import aiohttp
import paramiko

# Google Cloud
from dotenv import load_dotenv
from gcloud.aio.storage import Storage as AioStorage
from google.cloud import storage, bigquery, kms
from google.cloud.storage import transfer_manager
from google.auth.transport.requests import AuthorizedSession
from google.oauth2 import service_account as sa_mod

# Parallel transfer worker (external file for multiprocessing on Windows)
from loky import get_reusable_executor
from mp_upload_worker import upload_one

# Visualisation & notebook
import nest_asyncio
import plotly.graph_objects as go
from IPython.display import display

nest_asyncio.apply()  # allow asyncio.run() inside Jupyter's running event loop

# Render DataFrames as HTML for Quartz compatibility
html_formatter = get_ipython().display_formatter.formatters["text/html"] # type: ignore
html_formatter.for_type(pd.DataFrame, lambda df: df.to_html())
_ = html_formatter.for_type(pd.Series, lambda s: s.to_frame().to_html())
```

```python
# Load .env and define project constants
load_dotenv(override=True)

PROJECT_ID   = "seclab-dev-ap-26"
REGION       = "europe-west1"
BUCKET_NAME  = f"{PROJECT_ID}-data"
BQ_DATASET   = "index_data"
VM_IP        = os.environ["GCP_VM_IP"]
SQL_IP       = os.environ["GCP_SQL_IP"]
SQL_PASSWORD = os.environ["GCP_SQL_PASSWORD"]
SA_KEY_PATH  = os.environ.get("GCP_SA_KEY_PATH", "./gcp-sa-key.json")
KMS_KEYRING  = "notebook-keyring"
KMS_KEY      = "notebook-encrypt-key"
DATA_DIR     = Path(r"C:/Users/aperi/DEV/LANG/data")

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = SA_KEY_PATH

gcs_client = storage.Client(project=PROJECT_ID)
bucket = gcs_client.bucket(BUCKET_NAME)
bq_client = bigquery.Client(project=PROJECT_ID)
kms_client = kms.KeyManagementServiceClient()
kms_key_name = kms_client.crypto_key_path(PROJECT_ID, REGION, KMS_KEYRING, KMS_KEY)

print(f"  Project: {PROJECT_ID}")
print(f"  SQL IP:  {SQL_IP}")
print(f"  VM IP:   {VM_IP}")
print(f"  Bucket:  {BUCKET_NAME}")
```

      Project: seclab-dev-ap-26
      SQL IP:  34.22.129.89
      VM IP:   34.38.193.79
      Bucket:  seclab-dev-ap-26-data

#### Formatting helpers

```python
# Human-readable size and time formatters
def fmt_bytes(b):
    if b <= 0: return "-"
    if b < 1024: return f"{b} B"
    if b < 1024**2: return f"{b/1024:.1f} KB"
    if b < 1024**3: return f"{b/1024**2:.1f} MB"
    return f"{b/1024**3:.2f} GB"

def fmt_time(ms):
    if ms < 1000: return f"{ms:.0f}ms"
    if ms < 60_000: return f"{ms/1000:.1f}s"
    return f"{ms/60_000:.1f}min"
```

#### Define file sets for upload, SQL insert, and BigQuery benchmarks

```python
# Three separate file sets for different benchmark categories.
# Each set uses real data at appropriate sizes for its operation.
#
# Upload files: test network transfer speed at increasing sizes
# SQL insert files: test insert methods on existing table schemas
# BigQuery files: test load/query on existing table schemas

upload_files = {
    "small":  DATA_DIR / "small_upload.csv",    # ~10 MB
    "medium": DATA_DIR / "medium_upload.csv",   # ~200 MB 
    "large":  DATA_DIR / "large_upload.csv",    # ~1 GB 
} 

sql_insert_files = {
    "small": DATA_DIR / "small_sql_insert.csv", # scores_daily (466 rows)
    "large": DATA_DIR / "large_sql_insert.csv", # oil20_ohlcv (24K rows)
}

bq_files = {
    "small": DATA_DIR / "small_bq_insert.csv",  # index_performance (5K rows)
    "large": DATA_DIR / "large_bq_insert.csv",  # stoxxusa50_ohlcv (65K rows)
}

print("  Upload:")
for tier, path in upload_files.items():
    print(f"    {tier:8s} {path.name:30s} {fmt_bytes(path.stat().st_size)}")

for name, files in [("SQL Insert", sql_insert_files), ("BigQuery", bq_files)]:
    print(f"  {name}:")
    for tier, path in files.items():
        rows = sum(1 for _ in open(path)) - 1
        print(f"    {tier:8s} {path.name:30s} {rows:,} rows")
```

      Upload:
        small    small_upload.csv               9.7 MB
        medium   medium_upload.csv              193.1 MB
        large    large_upload.csv               1.19 GB
      SQL Insert:
        small    small_sql_insert.csv           466 rows
        large    large_sql_insert.csv           24,738 rows
      BigQuery:
        small    small_bq_insert.csv            5,281 rows
        large    large_bq_insert.csv            65,100 rows

## Upload files from Local to GCS

> [!warning] GCS uploads are NOT atomic
>
> GCS uploads are NOT atomic — partial uploads leave incomplete objects
> If an upload fails mid-transfer, a partial object may remain in the bucket. Use
> resumable uploads (default for `google-cloud-storage` client) and verify with
> checksums after upload. For critical data, upload to a staging prefix first, then
> rename (which IS atomic in GCS).

> [!tip] google-cloud-storage resumable uploads resume automatically
>
> `google-cloud-storage` resumable uploads resume automatically on retry
> The Python client library uses resumable uploads by default for files >8MB. If the
> connection drops, re-running the same upload continues from where it stopped.

For the CLI transfer tools (`gsutil cp`, `gcloud storage cp`, `rsync`, `bcp`) that these Python methods wrap or replace, see [data-transfer](https://alp78.github.io/elysium/01-Shell/File-Operations/data-transfer). The GCS operations benchmarked below have direct CLI equivalents documented in [gcs-object-operations](https://alp78.github.io/elysium/06-GCP/Storage/gcs-object-operations).

```python
# Benchmark helper — persists results to JSON, keyed by (method, tier)
GCS_PREFIX   = "benchmarks/uploads"
RESULTS_FILE = DATA_DIR / "upload_results.json"

def _load_results() -> list:
    if RESULTS_FILE.exists():
        return json.loads(RESULTS_FILE.read_text())
    return []

def _save_results(results: list) -> None:
    RESULTS_FILE.write_text(json.dumps(results, indent=2))

def bench_upload(method_name, upload_fn, file_path):
    orig_size = file_path.stat().st_size
    dest = f"{GCS_PREFIX}/{method_name}/{file_path.name}"
    t0 = time.perf_counter()
    actual_size = upload_fn(file_path, dest)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    wire_size = actual_size if actual_size is not None else orig_size
    throughput = wire_size / (elapsed_ms / 1000) if elapsed_ms > 0 else 0
    record = {
        "method":     method_name,
        "tier":       [k for k, v in upload_files.items() if v == file_path][0],
        "size_bytes": orig_size,
        "wire_bytes": wire_size,
        "size":       fmt_bytes(orig_size),
        "wire_size":  fmt_bytes(wire_size),
        "ratio":      f"{orig_size/wire_size:.1f}x" if actual_size else "-",
        "elapsed_ms": round(elapsed_ms, 1),
        "elapsed":    fmt_time(elapsed_ms),
        "throughput": fmt_bytes(throughput) + "/s",
    }
    # Upsert into persistent store keyed by (method, tier)
    all_results = _load_results()
    key = (record["method"], record["tier"])
    all_results = [r for r in all_results if (r["method"], r["tier"]) != key]
    all_results.append(record)
    _save_results(all_results)
    # Keep in-memory list in sync
    global upload_results
    upload_results = [r for r in upload_results if (r["method"], r["tier"]) != key]
    upload_results.append(record)
    return record

# Load existing results into memory on startup
upload_results = _load_results()
print(f"  Loaded {len(upload_results)} existing results from {RESULTS_FILE.name}")
```

      Loaded 33 existing results from upload_results.json

#### Upload CSV to GCS with google-cloud-storage - blob.upload_from_filename over HTTPS

The most straightforward approach. Reads the entire file into memory and uploads in a single request (small files) or automatically switches to a resumable upload for larger files. No tuning required.

```python
# Simple blob upload — single sequential stream
def simple_upload(file_path, dest_blob_name):
    blob = bucket.blob(dest_blob_name)
    blob.upload_from_filename(str(file_path))

print(f"  {'tier':<8s} {'size':>10s} {'time':>10s} {'throughput':>14s}")
for tier, path in upload_files.items():
    r = bench_upload("simple_blob", simple_upload, path)
    upload_results.append(r)
    print(f"  {tier:<8s} {r['size']:>10s} {r['elapsed']:>10s} {r['throughput']:>14s}")
```

      tier           size       time     throughput
      small        9.7 MB       2.3s       4.2 MB/s
      medium     193.1 MB      27.5s       7.0 MB/s
      large       1.19 GB     2.9min       7.0 MB/s

#### Upload CSV to GCS with google-cloud-storage - blob.upload_from_filename(chunk_size) over HTTPS

Explicitly configures the resumable upload chunk size. Each chunk is sent in a separate HTTP request, enabling recovery from mid-upload failures. Useful for unreliable networks — if a chunk fails, only that chunk is retried rather than the whole file.

```python
# Resumable upload — explicit 10 MB chunk size for fault tolerance
CHUNK_SIZE = 10 * 1024 * 1024  # 10 MB

def resumable_upload(file_path, dest_blob_name):
    blob = bucket.blob(dest_blob_name, chunk_size=CHUNK_SIZE)
    blob.upload_from_filename(str(file_path))

print(f"  {'tier':<8s} {'size':>10s} {'time':>10s} {'throughput':>14s}")
for tier, path in upload_files.items():
    r = bench_upload("resumable_chunked", resumable_upload, path)
    upload_results.append(r)
    print(f"  {tier:<8s} {r['size']:>10s} {r['elapsed']:>10s} {r['throughput']:>14s}")
```

      tier           size       time     throughput
      small        9.7 MB       1.6s       6.1 MB/s
      medium     193.1 MB      28.4s       6.8 MB/s
      large       1.19 GB     3.0min       6.8 MB/s

#### Upload CSV to GCS with google-cloud-storage - transfer_manager.upload_chunks_concurrently over HTTPS

Uses `google.cloud.storage.transfer_manager` to split the file into chunks and upload them in parallel across multiple threads. GCS composes the chunks server-side into a single object. Best throughput for large files on high-bandwidth connections.

```python
# Parallel composite upload — chunks uploaded concurrently, composed server-side
# worker_type="process" is broken on Windows (RetryError pickling bug in google-api-core)
def parallel_composite_upload(file_path, dest_blob_name):
    blob = bucket.blob(dest_blob_name)
    transfer_manager.upload_chunks_concurrently(
        str(file_path),
        blob,
        chunk_size=32 * 1024 * 1024,
        worker_type="thread",
        max_workers=8,
        checksum="crc32c",
    )

print(f"  {'tier':<8s} {'size':>10s} {'time':>10s} {'throughput':>14s}")
for tier, path in upload_files.items():
    r = bench_upload("parallel_composite", parallel_composite_upload, path)
    upload_results.append(r)
    print(f"  {tier:<8s} {r['size']:>10s} {r['elapsed']:>10s} {r['throughput']:>14s}")
```

      tier           size       time     throughput
      small        9.7 MB       1.7s       5.5 MB/s
      medium     193.1 MB      27.7s       7.0 MB/s
      large       1.19 GB     2.9min       7.1 MB/s

#### Upload CSV to GCS with google-cloud-storage - blob.upload_from_file over HTTPS

Reads the file as a binary stream rather than loading the full path. Useful when data comes from a pipeline, network socket, or in-memory buffer. Avoids materializing the full file in memory — the client library reads and sends in chunks internally.

```python
# Streamed upload — read file as binary stream, avoids full memory materialisation
def streamed_upload(file_path, dest_blob_name):
    blob = bucket.blob(dest_blob_name)
    blob.chunk_size = 32 * 1024 * 1024

    with open(file_path, "rb") as f:
        blob.upload_from_file(f, 
                              size=file_path.stat().st_size,
                              checksum="crc32c")

print(f"  {'tier':<8s} {'size':>10s} {'time':>10s} {'throughput':>14s}")
for tier, path in upload_files.items():
    r = bench_upload("streamed", streamed_upload, path)
    upload_results.append(r)
    print(f"  {tier:<8s} {r['size']:>10s} {r['elapsed']:>10s} {r['throughput']:>14s}")
```

      tier           size       time     throughput
      small        9.7 MB       1.5s       6.2 MB/s
      medium     193.1 MB      27.8s       6.9 MB/s
      large       1.19 GB     2.9min       7.0 MB/s

#### Upload gzip to GCS with google-cloud-storage - blob.upload_from_filename over HTTPS

Compresses the CSV to gzip locally, then uploads the smaller payload. Trades CPU time for reduced network transfer. The blob's `content_encoding` is set to `gzip` so GCS transparently decompresses on download.

```python
# Compressed upload — gzip locally, upload smaller payload, report wire throughput
# Times compression and upload separately. Throughput = wire_bytes / upload_time only.
gzip_split_times = {}

def gzip_upload(file_path, dest_blob_name):
    fd, tmp = tempfile.mkstemp(suffix=".csv.gz")
    os.close(fd)
    gz_path = Path(tmp)
    try:
        # Phase 1: compress (CPU-bound)
        t0 = time.perf_counter()
        with open(file_path, "rb") as f_in, gzip_mod.open(gz_path, "wb", compresslevel=6) as f_out:
            shutil.copyfileobj(f_in, f_out)
        compress_ms = (time.perf_counter() - t0) * 1000
        wire_size = gz_path.stat().st_size
        # Phase 2: upload (network-bound)
        t0 = time.perf_counter()
        blob = bucket.blob(dest_blob_name)
        blob.content_encoding = "gzip"
        blob.upload_from_filename(str(gz_path))
        upload_ms = (time.perf_counter() - t0) * 1000
        tier = [k for k, v in upload_files.items() if v == file_path][0]
        gzip_split_times[tier] = (compress_ms, upload_ms)
        return wire_size
    finally:
        gz_path.unlink(missing_ok=True)

print(f"  {'tier':<8s} {'orig':>10s} {'wire':>10s} {'ratio':>7s} {'compress':>10s} {'upload':>10s} {'total':>10s} {'throughput':>14s}")
for tier, path in upload_files.items():
    r = bench_upload("gzip_upload", gzip_upload, path)
    upload_results.append(r)
    c_ms, u_ms = gzip_split_times[tier]
    tp = r["wire_bytes"] / (u_ms / 1000) if u_ms > 0 else 0
    print(f"  {tier:<8s} {r['size']:>10s} {r['wire_size']:>10s} {r['ratio']:>7s} {fmt_time(c_ms):>10s} {fmt_time(u_ms):>10s} {r['elapsed']:>10s} {fmt_bytes(tp)+'/s':>14s}")
```

      tier           orig       wire   ratio   compress     upload      total     throughput
      small        9.7 MB     3.2 MB    3.0x      326ms       1.2s       1.5s       2.7 MB/s
      medium     193.1 MB    63.8 MB    3.0x       6.6s       9.2s      15.8s       6.9 MB/s
      large       1.19 GB   420.3 MB    2.9x      38.7s     1.0min     1.6min       7.0 MB/s

#### Upload Parquet to GCS with google-cloud-storage - blob.upload_from_filename over HTTPS

Converts CSV to Parquet (columnar, compressed) before uploading. Parquet files are typically 5-10x smaller than CSV for numeric data. Measures total time including the conversion step — useful when downstream consumers (BigQuery, Spark) prefer Parquet anyway.

```python
# Parquet conversion then upload — report wire throughput based on parquet size
# Times conversion and upload separately. Throughput = wire_bytes / upload_time only.
parquet_split_times = {}

def parquet_upload(file_path, dest_blob_name):
    fd, tmp = tempfile.mkstemp(suffix=".parquet")
    os.close(fd)
    pq_path = Path(tmp)
    try:
        # Phase 1: CSV → Parquet conversion (CPU-bound)
        t0 = time.perf_counter()
        df = pd.read_csv(file_path)
        table = pa.Table.from_pandas(df)
        pq.write_table(table, pq_path, compression="snappy")
        convert_ms = (time.perf_counter() - t0) * 1000
        wire_size = pq_path.stat().st_size
        # Phase 2: upload (network-bound)
        t0 = time.perf_counter()
        blob = bucket.blob(dest_blob_name.replace(".csv", ".parquet"))
        blob.upload_from_filename(str(pq_path))
        upload_ms = (time.perf_counter() - t0) * 1000
        tier = [k for k, v in upload_files.items() if v == file_path][0]
        parquet_split_times[tier] = (convert_ms, upload_ms)
        return wire_size
    finally:
        pq_path.unlink(missing_ok=True)

print(f"  {'tier':<8s} {'orig':>10s} {'parquet':>10s} {'ratio':>7s} {'convert':>10s} {'upload':>10s} {'total':>10s} {'throughput':>14s}")
for tier, path in upload_files.items():
    r = bench_upload("parquet_convert", parquet_upload, path)
    upload_results.append(r)
    c_ms, u_ms = parquet_split_times[tier]
    tp = r["wire_bytes"] / (u_ms / 1000) if u_ms > 0 else 0
    print(f"  {tier:<8s} {r['size']:>10s} {r['wire_size']:>10s} {r['ratio']:>7s} {fmt_time(c_ms):>10s} {fmt_time(u_ms):>10s} {r['elapsed']:>10s} {fmt_bytes(tp)+'/s':>14s}")
```

      tier           orig    parquet   ratio    convert     upload      total     throughput
      small        9.7 MB     4.0 MB    2.4x      129ms      664ms      795ms       6.1 MB/s
      medium     193.1 MB    53.1 MB    3.6x       2.0s       7.7s       9.7s       6.9 MB/s
      large       1.19 GB   460.9 MB    2.6x      14.2s     1.1min     1.3min       7.0 MB/s

#### Upload CSV to GCS with gsutil - cp over HTTPS

Shells out to `gsutil cp`, the standard CLI tool. Uses its own resumable upload logic and retries. Useful as a baseline comparison against the Python client library — also the approach used in shell scripts and CI pipelines.

```python
# gsutil cp file.csv gs://seclab-dev-ap-26-data/benchmarks/uploads/gsutil_cp/file.csv
GSUTIL: str = shutil.which("gsutil.cmd") or shutil.which("gsutil") or "gsutil"

def gsutil_upload(file_path, dest_blob_name):
    dest_uri = f"gs://{BUCKET_NAME}/{dest_blob_name}"
    subprocess.run(
        [GSUTIL, "cp", str(file_path), dest_uri],
        check=True, capture_output=True,
    )

print(f"  {'tier':<8s} {'size':>10s} {'time':>10s} {'throughput':>14s}")
for tier, path in upload_files.items():
    r = bench_upload("gsutil_cp", gsutil_upload, path)
    upload_results.append(r)
    print(f"  {tier:<8s} {r['size']:>10s} {r['elapsed']:>10s} {r['throughput']:>14s}")
```

#### Upload CSV to GCS with gsutil - cp -o parallel_composite over HTTPS

Uses `gsutil -o GSUtil:parallel_composite_upload_threshold=50M` to enable parallel composite uploads at the CLI level. For large files, gsutil splits the file and uploads chunks in parallel — similar to Method 3 but driven entirely by the CLI.

```python
# gsutil -o GSUtil:parallel_composite_upload_threshold=50M -o GSUtil:parallel_composite_upload_component_size=32M cp file.csv gs://seclab-dev-ap-26-data/benchmarks/uploads/gsutil_parallel/file.csv
def gsutil_parallel_upload(file_path, dest_blob_name):
    dest_uri = f"gs://{BUCKET_NAME}/{dest_blob_name}"
    subprocess.run(
        [
            GSUTIL,
            "-o", "GSUtil:parallel_composite_upload_threshold=50M",
            "-o", "GSUtil:parallel_composite_upload_component_size=32M",
            "cp", str(file_path), dest_uri,
        ],
        check=True, 
        capture_output=True,
        text=True,
    )

print(f"  {'tier':<8s} {'size':>10s} {'time':>10s} {'throughput':>14s}")
for tier, path in upload_files.items():
    r = bench_upload("gsutil_parallel", gsutil_parallel_upload, path)
    upload_results.append(r)
    print(f"  {tier:<8s} {r['size']:>10s} {r['elapsed']:>10s} {r['throughput']:>14s}")
```

#### Upload CSV to GCS with gcloud - storage cp over HTTPS

The newer `gcloud storage cp` command replaces `gsutil` and uses the same Python client library under the hood. It automatically enables parallel uploads for large files and is the recommended CLI path going forward.

```python
# gcloud storage cp file.csv gs://seclab-dev-ap-26-data/benchmarks/uploads/gcloud_storage/file.csv
GCLOUD: str = shutil.which("gcloud.cmd") or shutil.which("gcloud") or "gcloud"

def gcloud_storage_upload(file_path, dest_blob_name):
    dest_uri = f"gs://{BUCKET_NAME}/{dest_blob_name}"
    subprocess.run(
        [GCLOUD, "storage", "cp", str(file_path), dest_uri],
        check=True, capture_output=True,
    )

print(f"  {'tier':<8s} {'size':>10s} {'time':>10s} {'throughput':>14s}")
for tier, path in upload_files.items():
    r = bench_upload("gcloud_storage", gcloud_storage_upload, path)
    upload_results.append(r)
    print(f"  {tier:<8s} {r['size']:>10s} {r['elapsed']:>10s} {r['throughput']:>14s}")
```

#### Upload CSV to GCS with google-auth - AuthorizedSession.put over JSON API (HTTPS)

Bypasses the client library entirely and drives the GCS JSON API directly via `AuthorizedSession`. Initiates a resumable upload session, then sends the file in 8 MB chunks with explicit `Content-Range` headers. Demonstrates the underlying protocol that all other methods build on.

```python
# JSON API resumable upload — raw HTTP, 8 MB chunks
RAW_CHUNK = 8 * 1024 * 1024  # 8 MB

def raw_api_upload(file_path, dest_blob_name):
    creds = sa_mod.Credentials.from_service_account_file(
        SA_KEY_PATH, scopes=["https://www.googleapis.com/auth/cloud-platform"],
    )
    session = AuthorizedSession(creds)
    file_size = file_path.stat().st_size

    # Step 1: initiate resumable upload
    init_url = (
        f"https://storage.googleapis.com/upload/storage/v1/b/{BUCKET_NAME}"
        f"/o?uploadType=resumable&name={dest_blob_name}"
    )
    resp = session.post(init_url, headers={"Content-Length": "0"})
    resp.raise_for_status()
    upload_url = resp.headers["Location"]

    # Step 2: send chunks
    with open(file_path, "rb") as f:
        offset = 0
        while offset < file_size:
            chunk = f.read(RAW_CHUNK)
            end = offset + len(chunk) - 1
            headers = {
                "Content-Range": f"bytes {offset}-{end}/{file_size}",
                "Content-Length": str(len(chunk)),
            }
            resp = session.put(upload_url, data=chunk, headers=headers)
            if resp.status_code not in (200, 308):
                resp.raise_for_status()
            offset += len(chunk)

print(f"  {'tier':<8s} {'size':>10s} {'time':>10s} {'throughput':>14s}")
for tier, path in upload_files.items():
    r = bench_upload("raw_json_api", raw_api_upload, path)
    upload_results.append(r)
    print(f"  {tier:<8s} {r['size']:>10s} {r['elapsed']:>10s} {r['throughput']:>14s}")
```

      tier           size       time     throughput
      small        9.7 MB       2.3s       4.2 MB/s
      medium     193.1 MB      29.4s       6.6 MB/s
      large       1.19 GB     3.0min       6.7 MB/s

#### Upload CSV to GCS with gcloud-aio-storage - Storage.upload over HTTPS (async)

Uses `gcloud-aio-storage`, an async GCS client built on `aiohttp`. Runs an `asyncio` event loop with a persistent `aiohttp.ClientSession` — a single session reuses the underlying TCP connection and benefits from HTTP keep-alive, avoiding the per-request handshake overhead of the synchronous client. Resumable upload is forced for files >5 MB.

```python
# Async upload — aiohttp session with connection reuse, resumable for large files
async def _async_upload(file_path: Path, dest_blob_name: str) -> None:
    connector = aiohttp.TCPConnector(limit=8)
    async with aiohttp.ClientSession(connector=connector) as session:
        async with AioStorage(service_file=SA_KEY_PATH, session=session) as storage:
            with open(file_path, "rb") as f:
                data = f.read()
            await storage.upload(
                BUCKET_NAME,
                dest_blob_name,
                data,
                content_type="text/csv",
                force_resumable_upload=True,
                timeout=600,
            )

def async_upload(file_path: Path, dest_blob_name: str) -> None:
    asyncio.run(_async_upload(file_path, dest_blob_name))

print(f"  {'tier':<8s} {'size':>10s} {'time':>10s} {'throughput':>14s}")
for tier, path in upload_files.items():
    r = bench_upload("async_aiohttp", async_upload, path)
    upload_results.append(r)
    print(f"  {tier:<8s} {r['size']:>10s} {r['elapsed']:>10s} {r['throughput']:>14s}")
```

      tier           size       time     throughput
      small        9.7 MB       1.8s       5.2 MB/s
      medium     193.1 MB      27.8s       7.0 MB/s
      large       1.19 GB     2.9min       7.1 MB/s

#### Summary of CSV upload methods from local to GCS

```python
# Results grouped by tier — terminal format
df_up = pd.DataFrame(upload_results)
for tier in ["small", "medium", "large"]:
    sub = df_up[df_up["tier"] == tier]
    print(f"\n  ── {tier} ──")
    print(f"  {'method':<22s} {'size':>10s} {'wire':>10s} {'time':>10s} {'throughput':>14s}")
    for _, row in sub.iterrows():
        print(f"  {row['method']:<22s} {row['size']:>10s} {row['wire_size']:>10s} {row['elapsed']:>10s} {row['throughput']:>14s}")
```

    
      ── small ──
      method                       size       wire       time     throughput
      simple_blob                9.7 MB     9.7 MB       2.3s       4.2 MB/s
      resumable_chunked          9.7 MB     9.7 MB       1.6s       6.1 MB/s
      parallel_composite         9.7 MB     9.7 MB       1.7s       5.5 MB/s
      streamed                   9.7 MB     9.7 MB       1.5s       6.2 MB/s
      gsutil_cp                  9.7 MB     9.7 MB       4.6s       2.1 MB/s
      gsutil_parallel            9.7 MB     9.7 MB       4.0s       2.4 MB/s
      gcloud_storage             9.7 MB     9.7 MB       5.6s       1.7 MB/s
      raw_json_api               9.7 MB     9.7 MB       2.3s       4.2 MB/s
      async_aiohttp              9.7 MB     9.7 MB       1.8s       5.2 MB/s
      gzip_upload                9.7 MB     3.2 MB       1.5s       2.1 MB/s
      gzip_upload                9.7 MB     3.2 MB       1.5s       2.1 MB/s
      parquet_convert            9.7 MB     4.0 MB      795ms       5.1 MB/s
      parquet_convert            9.7 MB     4.0 MB      795ms       5.1 MB/s
    
      ── medium ──
      method                       size       wire       time     throughput
      simple_blob              193.1 MB   193.1 MB      27.5s       7.0 MB/s
      resumable_chunked        193.1 MB   193.1 MB      28.4s       6.8 MB/s
      parallel_composite       193.1 MB   193.1 MB      27.7s       7.0 MB/s
      streamed                 193.1 MB   193.1 MB      27.8s       6.9 MB/s
      gsutil_cp                193.1 MB   193.1 MB      29.7s       6.5 MB/s
      gsutil_parallel          193.1 MB   193.1 MB      30.7s       6.3 MB/s
      gcloud_storage           193.1 MB   193.1 MB      31.8s       6.1 MB/s
      raw_json_api             193.1 MB   193.1 MB      29.4s       6.6 MB/s
      async_aiohttp            193.1 MB   193.1 MB      27.8s       7.0 MB/s
      gzip_upload              193.1 MB    63.8 MB      15.8s       4.0 MB/s
      gzip_upload              193.1 MB    63.8 MB      15.8s       4.0 MB/s
      parquet_convert          193.1 MB    53.1 MB       9.7s       5.4 MB/s
      parquet_convert          193.1 MB    53.1 MB       9.7s       5.4 MB/s
    
      ── large ──
      method                       size       wire       time     throughput
      simple_blob               1.19 GB    1.19 GB     2.9min       7.0 MB/s
      resumable_chunked         1.19 GB    1.19 GB     3.0min       6.8 MB/s
      parallel_composite        1.19 GB    1.19 GB     2.9min       7.1 MB/s
      streamed                  1.19 GB    1.19 GB     2.9min       7.0 MB/s
      gsutil_cp                 1.19 GB    1.19 GB     2.9min       7.0 MB/s
      gsutil_parallel           1.19 GB    1.19 GB     2.9min       6.9 MB/s
      gcloud_storage            1.19 GB    1.19 GB     2.9min       6.9 MB/s
      raw_json_api              1.19 GB    1.19 GB     3.0min       6.7 MB/s
      async_aiohttp             1.19 GB    1.19 GB     2.9min       7.1 MB/s
      gzip_upload               1.19 GB   420.3 MB     1.6min       4.2 MB/s
      gzip_upload               1.19 GB   420.3 MB     1.6min       4.2 MB/s
      parquet_convert           1.19 GB   460.9 MB     1.3min       5.8 MB/s
      parquet_convert           1.19 GB   460.9 MB     1.3min       5.8 MB/s

#### Chart of CSV upload methods from local to GCS

```python
# Throughput chart — grouped by method, bars = tiers sorted by value
df_up = pd.DataFrame(upload_results).drop_duplicates(subset=["method", "tier"], keep="last")
df_up["throughput_mbps"] = df_up["wire_bytes"] / (df_up["elapsed_ms"] / 1000) / 1024**2

# Sort methods by average throughput (descending)
method_order = (
    df_up.groupby("method")["throughput_mbps"]
    .mean()
    .sort_values(ascending=False)
    .index.tolist()
)

tier_colors = {"small": "#636EFA", "medium": "#EF553B", "large": "#00CC96"}

fig = go.Figure()
for tier in ["small", "medium", "large"]:
    sub = df_up[df_up["tier"] == tier].set_index("method").reindex(method_order)
    vals = sub["throughput_mbps"].tolist()
    fig.add_trace(go.Bar(
        name=tier,
        x=method_order,
        y=vals,
        text=[f"{v:.1f}" if v and v == v else "" for v in vals],
        textposition="outside",
        marker_color=tier_colors[tier],
    ))

fig.update_layout(
    title="GCS Upload — Throughput by Method (MB/s, wire bytes)",
    xaxis_title="Method",
    yaxis_title="Throughput (MB/s)",
    barmode="group",
    template="plotly_dark",
    height=500,
    legend_title="Tier",
)
fig.show()
```

<iframe src="/static/plotly/dt_py_01.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

#### google-cloud-storage — cleanup benchmark blobs

```python
# Delete all benchmark blobs from the bucket
blobs = list(gcs_client.list_blobs(BUCKET_NAME, prefix=GCS_PREFIX))
print(f"  Deleting {len(blobs)} benchmark blobs...")
for blob in blobs:
    blob.delete()
print("  Cleanup done")
```

      Deleting 50 benchmark blobs...
      Cleanup done

## Copy files from Local to VM

```python
# VM connection constants
VM_IP       = os.environ["GCP_VM_IP"]
VM_USER     = "alexper_recovery_gmail_com"
VM_SSH_KEY  = "C:/Users/aperi/.ssh/google_compute_engine"  # OS Login key
VM_DATA_DIR = "/home/alexper_recovery_gmail_com/bench_data"
VM_DEST     = VM_DATA_DIR
SCP:    str = shutil.which("scp") or "scp"
GCLOUD: str = shutil.which("gcloud.cmd") or "gcloud.cmd"

def _ssh() -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(VM_IP, username=VM_USER, key_filename=VM_SSH_KEY, timeout=10)
    return client

# Test connection
with _ssh() as ssh:
    _, stdout, _ = ssh.exec_command("free -h | grep Mem && nproc && python3 --version")
    print(stdout.read().decode().strip())
```

    Mem:           7.8Gi       480Mi       5.8Gi       456Ki       1.8Gi       7.3Gi
    2
    Python 3.11.2

```python
# Benchmark helper for local→VM transfers — persists results to JSON, keyed by (method, tier)
COPY_RESULTS_FILE = DATA_DIR / "vm_transfer_results.json"

def _load_copy_results() -> list:
    if COPY_RESULTS_FILE.exists():
        return json.loads(COPY_RESULTS_FILE.read_text())
    return []

def _save_copy_results(results: list) -> None:
    COPY_RESULTS_FILE.write_text(json.dumps(results, indent=2))

def bench_copy(method_name, copy_fn, file_path):
    orig_size = file_path.stat().st_size
    t0 = time.perf_counter()
    actual_size = copy_fn(file_path)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    wire_size = actual_size if actual_size is not None else orig_size
    throughput = wire_size / (elapsed_ms / 1000) if elapsed_ms > 0 else 0
    record = {
        "method":     method_name,
        "tier":       [k for k, v in upload_files.items() if v == file_path][0],
        "size_bytes": orig_size,
        "wire_bytes": wire_size,
        "size":       fmt_bytes(orig_size),
        "wire_size":  fmt_bytes(wire_size),
        "ratio":      f"{orig_size/wire_size:.1f}x" if actual_size else "-",
        "elapsed_ms": round(elapsed_ms, 1),
        "elapsed":    fmt_time(elapsed_ms),
        "throughput": fmt_bytes(throughput) + "/s",
    }
    # Upsert into persistent store keyed by (method, tier)
    all_results = _load_copy_results()
    key = (record["method"], record["tier"])
    all_results = [r for r in all_results if (r["method"], r["tier"]) != key]
    all_results.append(record)
    _save_copy_results(all_results)
    # Keep in-memory list in sync
    global copy_results
    copy_results = [r for r in copy_results if (r["method"], r["tier"]) != key]
    copy_results.append(record)
    return record

# Load existing results into memory on startup
copy_results = _load_copy_results()
print(f"  Loaded {len(copy_results)} existing results from {COPY_RESULTS_FILE.name}")
```

      Loaded 15 existing results from vm_transfer_results.json

#### Copy CSV from local to VM with paramiko - sftp.put over SFTP/SSH

Standard SFTP over SSH. Single-threaded, no compression. Baseline method.

```python
# Method 1 — paramiko SFTP
def sftp_copy(file_path):
    with _ssh() as ssh:
        with ssh.open_sftp() as sftp:
            sftp.put(str(file_path), f"{VM_DEST}/{file_path.name}")

print(f"  {'tier':<8s} {'size':>10s} {'time':>10s} {'throughput':>14s}")
for tier, path in upload_files.items():
    r = bench_copy("sftp_put", sftp_copy, path)
    copy_results.append(r)
    print(f"  {r['tier']:<8s} {r['size']:>10s} {r['elapsed']:>10s} {r['throughput']:>14s}")
```

      tier           size       time     throughput
      small        9.7 MB       5.3s       1.8 MB/s
      medium     193.1 MB     1.5min       2.1 MB/s
      large       1.19 GB     9.8min       2.1 MB/s

#### Copy CSV from local to VM with OpenSSH - scp over SSH

Uses Windows OpenSSH `scp` via subprocess. Same SSH transport as SFTP but a simpler protocol with less per-packet overhead.

```python
# scp -i C:/Users/aperi/.ssh/google_compute_engine -o StrictHostKeyChecking=no -o BatchMode=yes file.csv alexper_recovery_gmail_com@34.38.193.79:/home/alexper_recovery_gmail_com/bench_data/file.csv
def scp_copy(file_path):
    subprocess.run([
        SCP, "-i", VM_SSH_KEY,
        "-o", "StrictHostKeyChecking=no",
        "-o", "BatchMode=yes",
        str(file_path),
        f"{VM_USER}@{VM_IP}:{VM_DEST}/{file_path.name}",
    ], check=True, capture_output=True)

print(f"  {'tier':<8s} {'size':>10s} {'time':>10s} {'throughput':>14s}")
for tier, path in upload_files.items():
    r = bench_copy("scp", scp_copy, path)
    copy_results.append(r)
    print(f"  {r['tier']:<8s} {r['size']:>10s} {r['elapsed']:>10s} {r['throughput']:>14s}")
```

      tier           size       time     throughput
      small        9.7 MB       2.5s       3.9 MB/s
      medium     193.1 MB      28.8s       6.7 MB/s
      large       1.19 GB     2.9min       6.9 MB/s

#### Copy CSV from local to VM with OpenSSH - scp -C over SSH (compressed)

Same as Method 2 but enables SSH-level compression. Trades CPU for reduced bytes on the wire — most effective for compressible data like CSV.

```python
# scp -C — SSH compression. Pre-compute gzip size to estimate wire bytes.
# Times compression and transfer separately. Throughput = wire_bytes / transfer_time only.

gzip_sizes = {}
scp_comp_split_times = {}

# Pre-compute compressed sizes and measure compression time
for tier, path in upload_files.items():
    fd, tmp = tempfile.mkstemp(suffix=".gz")
    os.close(fd)
    gz_path = Path(tmp)
    t0 = time.perf_counter()
    with open(path, "rb") as f_in, gzip_mod.open(gz_path, "wb", compresslevel=6) as f_out:
        shutil.copyfileobj(f_in, f_out)
    compress_ms = (time.perf_counter() - t0) * 1000
    gzip_sizes[str(path)] = gz_path.stat().st_size
    scp_comp_split_times[tier] = (compress_ms, 0)
    gz_path.unlink()

def scp_compressed_copy(file_path):
    tier = [k for k, v in upload_files.items() if v == file_path][0]
    t0 = time.perf_counter()
    subprocess.run([
        SCP, "-i", VM_SSH_KEY,
        "-o", "StrictHostKeyChecking=no",
        "-o", "BatchMode=yes",
        "-C",
        str(file_path),
        f"{VM_USER}@{VM_IP}:{VM_DEST}/{file_path.name}",
    ], check=True, capture_output=True)
    transfer_ms = (time.perf_counter() - t0) * 1000
    c_ms, _ = scp_comp_split_times[tier]
    scp_comp_split_times[tier] = (c_ms, transfer_ms)
    return gzip_sizes[str(file_path)]

print(f"  {'tier':<8s} {'orig':>10s} {'wire':>10s} {'ratio':>7s} {'compress':>10s} {'transfer':>10s} {'total':>10s} {'throughput':>14s}")
for tier, path in upload_files.items():
    r = bench_copy("scp_compressed", scp_compressed_copy, path)
    copy_results.append(r)
    c_ms, t_ms = scp_comp_split_times[tier]
    tp = r["wire_bytes"] / (t_ms / 1000) if t_ms > 0 else 0
    print(f"  {tier:<8s} {r['size']:>10s} {r['wire_size']:>10s} {r.get('ratio','-'):>7s} {fmt_time(c_ms):>10s} {fmt_time(t_ms):>10s} {fmt_time(c_ms+t_ms):>10s} {fmt_bytes(tp)+'/s':>14s}")
```

      tier           orig       wire   ratio   compress   transfer      total     throughput
      small        9.7 MB     3.2 MB    3.0x      339ms       1.9s       2.2s       1.7 MB/s
      medium     193.1 MB    63.8 MB    3.0x       6.4s      10.4s      16.8s       6.1 MB/s
      large       1.19 GB   420.3 MB    2.9x      39.0s     1.1min     1.7min       6.6 MB/s

#### Copy CSV from local to VM with gcloud - compute scp over SSH

Uses the gcloud CLI which handles authentication via OS Login automatically, no key file needed. Internally wraps OpenSSH.

```python
# gcloud compute scp --zone=europe-west1-b --strict-host-key-checking=no file.csv notebook-vm:/home/alexper_recovery_gmail_com/bench_data/file.csv
def gcloud_scp_copy(file_path):
    subprocess.run([
        GCLOUD, "compute", "scp",
        "--zone=europe-west1-b",
        "--strict-host-key-checking=no",
        str(file_path),
        f"notebook-vm:{VM_DEST}/{file_path.name}",
    ], check=True, capture_output=True, shell=True)

print(f"  {'tier':<8s} {'size':>10s} {'time':>10s} {'throughput':>14s}")
for tier, path in upload_files.items():
    r = bench_copy("gcloud_scp", gcloud_scp_copy, path)
    copy_results.append(r)
    print(f"  {r['tier']:<8s} {r['size']:>10s} {r['elapsed']:>10s} {r['throughput']:>14s}")
```

      tier           size       time     throughput
      small        9.7 MB       4.4s       2.2 MB/s
      medium     193.1 MB      31.7s       6.1 MB/s
      large       1.19 GB     3.0min       6.7 MB/s

#### Copy CSV from local to VM with paramiko - sftp.put (tuned window) over SFTP/SSH

Same as Method 1 but increases the SSH window size to 64 MB and disables mid-transfer rekeying, reducing round-trip overhead for large transfers.

```python
# Method 5 — paramiko SFTP with tuned window / read buffer
def sftp_tuned_copy(file_path):
    with _ssh() as ssh:
        transport = ssh.get_transport()
        assert transport is not None
        transport.default_window_size = 64 * 1024 * 1024   # 64 MB window
        transport.packetizer.REKEY_BYTES = 2**40            # avoid rekey mid-transfer
        sftp = paramiko.SFTPClient.from_transport(transport)
        assert sftp is not None
        with sftp:
            sftp.put(str(file_path), f"{VM_DEST}/{file_path.name}")

print(f"  {'tier':<8s} {'size':>10s} {'time':>10s} {'throughput':>14s}")
for tier, path in upload_files.items():
    r = bench_copy("sftp_tuned", sftp_tuned_copy, path)
    copy_results.append(r)
    print(f"  {r['tier']:<8s} {r['size']:>10s} {r['elapsed']:>10s} {r['throughput']:>14s}")
```

      tier           size       time     throughput
      small        9.7 MB       5.3s       1.8 MB/s
      medium     193.1 MB     1.5min       2.1 MB/s
      large       1.19 GB     9.5min       2.1 MB/s

#### Summary of CSV copy methods from local to VM

```python
# Copy results grouped by tier — terminal format
df_cp = pd.DataFrame(copy_results).drop_duplicates(subset=["method", "tier"], keep="last")
for tier in ["small", "medium", "large"]:
    sub = df_cp[df_cp["tier"] == tier]
    print(f"\n  ── {tier} ──")
    print(f"  {'method':<18s} {'size':>10s} {'time':>10s} {'throughput':>14s}")
    for _, row in sub.iterrows():
        print(f"  {row['method']:<18s} {row['size']:>10s} {row['elapsed']:>10s} {row['throughput']:>14s}")
```

    
      ── small ──
      method                   size       time     throughput
      sftp_put               9.7 MB       5.3s       1.8 MB/s
      scp                    9.7 MB       2.5s       3.9 MB/s
      gcloud_scp             9.7 MB       4.4s       2.2 MB/s
      sftp_tuned             9.7 MB       5.3s       1.8 MB/s
      scp_compressed         9.7 MB       1.9s       1.7 MB/s
    
      ── medium ──
      method                   size       time     throughput
      sftp_put             193.1 MB     1.5min       2.1 MB/s
      scp                  193.1 MB      28.8s       6.7 MB/s
      gcloud_scp           193.1 MB      31.7s       6.1 MB/s
      sftp_tuned           193.1 MB     1.5min       2.1 MB/s
      scp_compressed       193.1 MB      10.4s       6.1 MB/s
    
      ── large ──
      method                   size       time     throughput
      sftp_put              1.19 GB     9.8min       2.1 MB/s
      scp                   1.19 GB     2.9min       6.9 MB/s
      gcloud_scp            1.19 GB     3.0min       6.7 MB/s
      sftp_tuned            1.19 GB     9.5min       2.1 MB/s
      scp_compressed        1.19 GB     1.1min       6.6 MB/s

#### Chart of CSV copy methods from local to VM

```python
# Throughput chart — grouped by method, bars = tiers sorted by value
df_cp = pd.DataFrame(copy_results).drop_duplicates(subset=["method", "tier"], keep="last")
df_cp["throughput_mbps"] = df_cp["wire_bytes"] / (df_cp["elapsed_ms"] / 1000) / 1024**2

# Sort methods by average throughput (descending)
method_order = (
    df_cp.groupby("method")["throughput_mbps"]
    .mean()
    .sort_values(ascending=False)
    .index.tolist()
)

tier_colors = {"small": "#636EFA", "medium": "#EF553B", "large": "#00CC96"}

fig = go.Figure()
for tier in ["small", "medium", "large"]:
    sub = df_cp[df_cp["tier"] == tier].set_index("method").reindex(method_order)
    vals = sub["throughput_mbps"].tolist()
    fig.add_trace(go.Bar(
        name=tier,
        x=method_order,
        y=vals,
        text=[f"{v:.1f}" if v and v == v else "" for v in vals],
        textposition="outside",
        marker_color=tier_colors[tier],
    ))

fig.update_layout(
    title="Local → VM Transfer — Throughput by Method (MB/s, wire bytes)",
    xaxis_title="Method",
    yaxis_title="Throughput (MB/s)",
    barmode="group",
    template="plotly_dark",
    height=500,
    legend_title="Tier",
)
fig.show()
```

<iframe src="/static/plotly/dt_py_02.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

## Transfer files from VM to GCS

from VM (`notebook-vm`, `europe-west1-b`)

#### paramiko SFTP — copy upload files and SA key to VM

```python
# Copy upload files + SA key to VM via SFTP
files_to_copy = list(upload_files.values()) + [Path(SA_KEY_PATH)]

with _ssh() as ssh:
    ssh.exec_command(f"mkdir -p {VM_DATA_DIR}")
    with ssh.open_sftp() as sftp:
        for local_path in files_to_copy:
            remote_path = f"{VM_DATA_DIR}/{local_path.name}"
            size = local_path.stat().st_size
            print(f"  Copying {local_path.name} ({fmt_bytes(size)})...", end=" ", flush=True)
            t0 = time.perf_counter()
            sftp.put(str(local_path), remote_path)
            elapsed = time.perf_counter() - t0
            print(f"{fmt_time(elapsed * 1000)}  ({fmt_bytes(size / elapsed)}/s)")
```

      Copying small_upload.csv (9.7 MB)... 4.5s  (2.1 MB/s)
      Copying medium_upload.csv (193.1 MB)... 1.5min  (2.2 MB/s)
      Copying large_upload.csv (1.19 GB)... 9.3min  (2.2 MB/s)
      Copying gcp-sa-key.json (2.3 KB)... 103ms  (22.5 KB/s)
      Done

#### paramiko SSHClient — run upload benchmarks on VM via SSH

Executes the same 10 upload methods on the VM via SSH. The VM is in `europe-west1-b`, same region as the bucket

```python
VM_BENCHMARK_SCRIPT = r"""
import os, time, shutil, tempfile, subprocess, json, sys, gzip as gzip_mod
from pathlib import Path

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = DATA_DIR + "/gcp-sa-key.json"

from google.cloud import storage
from google.cloud.storage import transfer_manager
from google.auth.transport.requests import AuthorizedSession
from google.oauth2 import service_account as sa_mod

PROJECT_ID  = "seclab-dev-ap-26"
BUCKET_NAME = "seclab-dev-ap-26-data"
SA_KEY_PATH = DATA_DIR + "/gcp-sa-key.json"
GCS_PREFIX  = "benchmarks/uploads/vm"
CHUNK_SIZE  = 10 * 1024 * 1024
RAW_CHUNK   = 8  * 1024 * 1024

gcs_client = storage.Client(project=PROJECT_ID)
bucket     = gcs_client.bucket(BUCKET_NAME)

upload_files = {
    "small":  DATA_DIR + "/small_upload.csv",
    "medium": DATA_DIR + "/medium_upload.csv",
    "large":  DATA_DIR + "/large_upload.csv",
}

def fmt_bytes(b):
    if b < 1024**2: return f"{b/1024:.1f} KB"
    if b < 1024**3: return f"{b/1024**2:.1f} MB"
    return f"{b/1024**3:.2f} GB"

def fmt_time(ms):
    if ms < 1000: return f"{ms:.0f}ms"
    if ms < 60000: return f"{ms/1000:.1f}s"
    return f"{ms/60000:.1f}min"

def bench(method, fn, file_path):
    size = Path(file_path).stat().st_size
    dest = f"{GCS_PREFIX}/{method}/{Path(file_path).name}"
    t0 = time.perf_counter()
    result = fn(file_path, dest)
    ms = (time.perf_counter() - t0) * 1000
    # result can be: None, wire_size (int), or (wire_size, compress_ms, upload_ms) tuple
    if isinstance(result, tuple):
        wire_size, compress_ms, upload_ms = result
    else:
        wire_size = result if result is not None else size
        compress_ms = None
        upload_ms = None
    # Throughput = wire_bytes / upload_time only (excludes compression/conversion)
    tp_ms = upload_ms if upload_ms is not None else ms
    tp = wire_size / (tp_ms / 1000) if tp_ms > 0 else 0
    tier = [k for k,v in upload_files.items() if v==file_path][0]
    rec = {
        "method": method, "tier": tier,
        "size_bytes": size, "wire_bytes": wire_size,
        "size": fmt_bytes(size), "wire_size": fmt_bytes(wire_size),
        "ratio": f"{size/wire_size:.1f}x" if result is not None else "-",
        "elapsed_ms": round(tp_ms,1), "elapsed": fmt_time(tp_ms),
        "throughput": fmt_bytes(tp)+"/s",
    }
    if compress_ms is not None:
        rec["compress_ms"] = round(compress_ms, 1)
        rec["upload_ms"] = round(upload_ms, 1)
        rec["total_ms"] = round(ms, 1)
    return rec

def simple_upload(fp, dest):      bucket.blob(dest).upload_from_filename(fp)
def resumable_upload(fp, dest):   bucket.blob(dest, chunk_size=CHUNK_SIZE).upload_from_filename(fp)
def parallel_upload(fp, dest):
    transfer_manager.upload_chunks_concurrently(
        fp, bucket.blob(dest), chunk_size=32*1024*1024, worker_type="thread", max_workers=16, checksum="crc32c")
def streamed_upload(fp, dest):
    with open(fp, "rb") as f: bucket.blob(dest).upload_from_file(f, size=Path(fp).stat().st_size)
def gzip_upload(fp, dest):
    fd, tmp = tempfile.mkstemp(suffix=".csv.gz")
    os.close(fd)
    gz_path = Path(tmp)
    try:
        t0 = time.perf_counter()
        with open(fp, "rb") as f_in, gzip_mod.open(gz_path, "wb", compresslevel=6) as f_out:
            shutil.copyfileobj(f_in, f_out)
        compress_ms = (time.perf_counter() - t0) * 1000
        wire_size = gz_path.stat().st_size
        t0 = time.perf_counter()
        blob = bucket.blob(dest)
        blob.content_encoding = "gzip"
        blob.upload_from_filename(str(gz_path))
        upload_ms = (time.perf_counter() - t0) * 1000
        return (wire_size, compress_ms, upload_ms)
    finally:
        gz_path.unlink(missing_ok=True)
def parquet_upload(fp, dest):
    import pyarrow as pa, pyarrow.parquet as pq, pandas as pd
    fd, tmp = tempfile.mkstemp(suffix=".parquet")
    os.close(fd)
    pq_path = Path(tmp)
    try:
        t0 = time.perf_counter()
        df = pd.read_csv(fp)
        table = pa.Table.from_pandas(df)
        pq.write_table(table, pq_path, compression="snappy")
        convert_ms = (time.perf_counter() - t0) * 1000
        wire_size = pq_path.stat().st_size
        t0 = time.perf_counter()
        bucket.blob(dest.replace(".csv", ".parquet")).upload_from_filename(str(pq_path))
        upload_ms = (time.perf_counter() - t0) * 1000
        return (wire_size, convert_ms, upload_ms)
    finally:
        pq_path.unlink(missing_ok=True)
def gsutil_upload(fp, dest):
    subprocess.run([shutil.which("gsutil") or "gsutil","cp",fp,f"gs://{BUCKET_NAME}/{dest}"], check=True, capture_output=True)
def gsutil_parallel_upload(fp, dest):
    subprocess.run([shutil.which("gsutil") or "gsutil","-o","GSUtil:parallel_composite_upload_threshold=50M",
        "-o","GSUtil:parallel_composite_upload_component_size=32M","cp",fp,f"gs://{BUCKET_NAME}/{dest}"], check=True, capture_output=True)
def gcloud_upload(fp, dest):
    subprocess.run([shutil.which("gcloud") or "gcloud","storage","cp",fp,f"gs://{BUCKET_NAME}/{dest}"], check=True, capture_output=True)
def raw_api_upload(fp, dest):
    creds = sa_mod.Credentials.from_service_account_file(SA_KEY_PATH, scopes=["https://www.googleapis.com/auth/cloud-platform"])
    session = AuthorizedSession(creds)
    size = Path(fp).stat().st_size
    resp = session.post(f"https://storage.googleapis.com/upload/storage/v1/b/{BUCKET_NAME}/o?uploadType=resumable&name={dest}", headers={"Content-Length":"0"})
    resp.raise_for_status()
    url = resp.headers["Location"]
    with open(fp,"rb") as f:
        offset = 0
        while offset < size:
            chunk = f.read(RAW_CHUNK); end = offset+len(chunk)-1
            r = session.put(url, data=chunk, headers={"Content-Range":f"bytes {offset}-{end}/{size}","Content-Length":str(len(chunk))})
            if r.status_code not in (200,308): r.raise_for_status()
            offset += len(chunk)

def async_upload(fp, dest):
    import asyncio, aiohttp
    from gcloud.aio.storage import Storage as AioStorage
    async def _upload():
        connector = aiohttp.TCPConnector(limit=8)
        async with aiohttp.ClientSession(connector=connector) as session:
            async with AioStorage(service_file=SA_KEY_PATH, session=session) as storage:
                with open(fp, "rb") as f:
                    data = f.read()
                await storage.upload(
                    BUCKET_NAME, dest, data,
                    content_type="text/csv",
                    force_resumable_upload=True,
                    timeout=600,
                )
    asyncio.run(_upload())

methods = [
    ("simple_blob",        simple_upload),
    ("resumable_chunked",  resumable_upload),
    ("parallel_composite", parallel_upload),
    ("streamed",           streamed_upload),
    ("gzip_upload",        gzip_upload),
    ("parquet_convert",    parquet_upload),
    ("gsutil_cp",          gsutil_upload),
    ("gsutil_parallel",    gsutil_parallel_upload),
    ("gcloud_storage",     gcloud_upload),
    ("raw_json_api",       raw_api_upload),
    ("async_aiohttp",     async_upload),
]

# Run each (method, tier) individually, emit one JSON line per result
for method, fn in methods:
    for tier, fp in upload_files.items():
        try:
            r = bench(method, fn, fp)
        except Exception as e:
            r = {"method": method, "tier": tier, "error": str(e),
                 "size": "-", "elapsed": "-", "throughput": "-",
                 "elapsed_ms": 0, "size_bytes": 0, "wire_bytes": 0}
        print("__RESULT__" + json.dumps(r), flush=True)
"""
```

```python
# Activate the service account on the VM so gsutil/gcloud CLI tools can authenticate.
# Without this, only Python client library methods work (they read GOOGLE_APPLICATION_CREDENTIALS directly).
#
# Run once per VM session:
#   gcloud auth activate-service-account --key-file=/home/alexper_recovery_gmail_com/bench_data/gcp-sa-key.json
#
with _ssh() as ssh:
    cmd = f"gcloud auth activate-service-account --key-file={VM_DATA_DIR}/gcp-sa-key.json"
    _, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if out: print(out)
    if err: print(err)
```

    Activated service account credentials for: [notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com]

```python
# Run VM benchmark script, stream results line-by-line, save each to local JSON
vm_script_path = f"{VM_DATA_DIR}/bench_upload.py"
VM_UPLOAD_RESULTS_FILE = DATA_DIR / "vm_upload_results.json"

# Load existing results
if VM_UPLOAD_RESULTS_FILE.exists():
    vm_upload_results = json.loads(VM_UPLOAD_RESULTS_FILE.read_text())
else:
    vm_upload_results = []

with _ssh() as ssh:
    script = VM_BENCHMARK_SCRIPT.replace("DATA_DIR", f'"{VM_DATA_DIR}"')
    with ssh.open_sftp() as sftp:
        with sftp.file(vm_script_path, "w") as f:
            f.write(script)

    transport = ssh.get_transport()
    assert transport is not None
    channel = transport.open_session()
    channel.exec_command(f"python3 -u {vm_script_path}")

    line_buf = ""
    print(f"  {'method':<22s} {'tier':<8s} {'size':>10s} {'compress':>10s} {'upload':>10s} {'total':>10s} {'throughput':>14s}")
    while True:
        if channel.recv_ready():
            line_buf += channel.recv(4096).decode()
            while "\n" in line_buf:
                line, line_buf = line_buf.split("\n", 1)
                if line.startswith("__RESULT__"):
                    r = json.loads(line[len("__RESULT__"):])
                    # Print to terminal — show compress/upload split when available
                    if "error" in r:
                        print(f"  {r['method']:<22s} {r['tier']:<8s} {'ERROR':>10s} {r['error'][:40]}")
                    else:
                        comp_str = fmt_time(r["compress_ms"]) if "compress_ms" in r else "-"
                        upl_str  = fmt_time(r["upload_ms"])   if "upload_ms" in r else "-"
                        total_str = fmt_time(r["total_ms"]) if "total_ms" in r else r["elapsed"]
                        print(f"  {r['method']:<22s} {r['tier']:<8s} {r['size']:>10s} {comp_str:>10s} {upl_str:>10s} {total_str:>10s} {r['throughput']:>14s}")
                    # Upsert into local results
                    key = (r["method"], r["tier"])
                    vm_upload_results = [x for x in vm_upload_results if (x["method"], x["tier"]) != key]
                    vm_upload_results.append(r)
                    # Save after each result
                    VM_UPLOAD_RESULTS_FILE.write_text(json.dumps(vm_upload_results, indent=2))
                else:
                    print(line)
        if channel.recv_stderr_ready():
            print("STDERR:", channel.recv_stderr(4096).decode(), flush=True)
        if channel.exit_status_ready() and not channel.recv_ready():
            break

print(f"\n  Saved {len(vm_upload_results)} results to {VM_UPLOAD_RESULTS_FILE.name}")
```

      method                 tier           size   compress     upload      total     throughput
      simple_blob            small        9.7 MB          -          -      434ms      22.3 MB/s
      simple_blob            medium     193.1 MB          -          -       2.2s      87.2 MB/s
      simple_blob            large       1.19 GB          -          -      13.6s      89.7 MB/s
      resumable_chunked      small        9.7 MB          -          -      265ms      36.5 MB/s
      resumable_chunked      medium     193.1 MB          -          -       3.0s      63.4 MB/s
      resumable_chunked      large       1.19 GB          -          -      17.5s      69.8 MB/s
      parallel_composite     small        9.7 MB          -          -      336ms      28.8 MB/s
      parallel_composite     medium     193.1 MB          -          -       1.1s     170.4 MB/s
      parallel_composite     large       1.19 GB          -          -       3.3s     365.0 MB/s
      streamed               small        9.7 MB          -          -      221ms      43.8 MB/s
      streamed               medium     193.1 MB          -          -       1.9s     104.1 MB/s
      streamed               large       1.19 GB          -          -      11.1s     109.9 MB/s
      gzip_upload            small        9.7 MB      588ms      121ms      711ms      26.3 MB/s
      gzip_upload            medium     193.1 MB      11.9s      535ms      12.4s     119.3 MB/s
      gzip_upload            large       1.19 GB     1.4min       2.6s     1.4min     164.6 MB/s
      parquet_convert        small        9.7 MB      384ms      142ms       1.1s      28.3 MB/s
      parquet_convert        medium     193.1 MB       5.6s      512ms       6.1s     103.7 MB/s
      parquet_convert        large       1.19 GB      48.3s       3.5s      51.9s     130.2 MB/s
      gsutil_cp              small        9.7 MB          -          -       2.7s       3.5 MB/s
      gsutil_cp              medium     193.1 MB          -          -       3.9s      49.1 MB/s
      gsutil_cp              large       1.19 GB          -          -      10.3s     117.8 MB/s
      gsutil_parallel        small        9.7 MB          -          -       2.2s       4.4 MB/s
      gsutil_parallel        medium     193.1 MB          -          -       4.1s      47.5 MB/s
      gsutil_parallel        large       1.19 GB          -          -      13.0s      93.4 MB/s
      gcloud_storage         small        9.7 MB          -          -       2.2s       4.4 MB/s
      gcloud_storage         medium     193.1 MB          -          -       3.5s      54.8 MB/s
      gcloud_storage         large       1.19 GB          -          -       7.8s     157.1 MB/s
      raw_json_api           small        9.7 MB          -          -      474ms      20.4 MB/s
      raw_json_api           medium     193.1 MB          -          -       4.4s      44.3 MB/s
      raw_json_api           large       1.19 GB          -          -      18.6s      65.6 MB/s
      async_aiohttp          small        9.7 MB          -          -      814ms      11.9 MB/s
      async_aiohttp          medium     193.1 MB          -          -       2.0s      96.2 MB/s
      async_aiohttp          large       1.19 GB          -          -      10.2s     119.1 MB/s
    
      Saved 33 results to vm_upload_results.json

#### Comparision of files upload from local vs VM

```python
# Side-by-side pivot: local vs VM, large file only (most meaningful for throughput)
def make_pivot(results, label):
    df = pd.DataFrame(results).drop_duplicates(subset=["method", "tier"], keep="last")
    df_large = df[df["tier"] == "large"].set_index("method")
    # Compute throughput from wire_bytes (actual bytes transferred)
    df_large[f"{label}_mbps"] = df_large["wire_bytes"] / (df_large["elapsed_ms"] / 1000) / 1024**2
    return df_large[[f"{label}_mbps"]]

pv_local = make_pivot(upload_results, "local")
pv_vm    = make_pivot(vm_upload_results, "vm")
pv_both  = pv_local.join(pv_vm, how="outer")

comparison = pd.DataFrame({
    "local MB/s":  pv_both.get("local_mbps",  pd.Series(dtype=float)).round(1),
    "vm MB/s":     pv_both.get("vm_mbps",     pd.Series(dtype=float)).round(1),
}).dropna(how="all")
comparison["speedup"] = (comparison["vm MB/s"] / comparison["local MB/s"]).map(lambda x: f"{x:.1f}x" if pd.notna(x) else "-")
display(comparison)

# Sort methods by average of local + vm throughput (descending)
comparison_numeric = comparison[["local MB/s", "vm MB/s"]]
method_order = comparison_numeric.mean(axis=1).sort_values(ascending=False).index.tolist()

# Chart: throughput comparison local vs VM (large file)
fig = go.Figure()
fig.add_trace(go.Bar(
    name="local",
    x=method_order,
    y=[comparison.loc[m, "local MB/s"] if pd.notna(comparison.loc[m, "local MB/s"]) else 0 for m in method_order],
    text=[f"{comparison.loc[m, 'local MB/s']:.1f}" if pd.notna(comparison.loc[m, "local MB/s"]) else "" for m in method_order],
    textposition="outside",
))
fig.add_trace(go.Bar(
    name="vm (europe-west1)",
    x=method_order,
    y=[comparison.loc[m, "vm MB/s"] if pd.notna(comparison.loc[m, "vm MB/s"]) else 0 for m in method_order],
    text=[f"{comparison.loc[m, 'vm MB/s']:.1f}" if pd.notna(comparison.loc[m, "vm MB/s"]) else "" for m in method_order],
    textposition="outside",
))
fig.update_layout(
    title="Upload Throughput — Local vs VM (large file, MB/s, wire bytes)",
    xaxis_title="Method", yaxis_title="Throughput (MB/s)",
    barmode="group", template="plotly_dark", height=500,
)
fig.show()
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>local MB/s</th>
      <th>vm MB/s</th>
      <th>speedup</th>
    </tr>
    <tr>
      <th>method</th>
      <th></th>
      <th></th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>async_aiohttp</th>
      <td>7.1</td>
      <td>119.1</td>
      <td>16.8x</td>
    </tr>
    <tr>
      <th>gcloud_storage</th>
      <td>6.9</td>
      <td>157.1</td>
      <td>22.8x</td>
    </tr>
    <tr>
      <th>gsutil_cp</th>
      <td>7.0</td>
      <td>117.8</td>
      <td>16.8x</td>
    </tr>
    <tr>
      <th>gsutil_parallel</th>
      <td>6.9</td>
      <td>93.4</td>
      <td>13.5x</td>
    </tr>
    <tr>
      <th>gzip_upload</th>
      <td>4.2</td>
      <td>164.6</td>
      <td>39.2x</td>
    </tr>
    <tr>
      <th>parallel_composite</th>
      <td>7.1</td>
      <td>365.0</td>
      <td>51.4x</td>
    </tr>
    <tr>
      <th>parquet_convert</th>
      <td>5.8</td>
      <td>130.2</td>
      <td>22.4x</td>
    </tr>
    <tr>
      <th>raw_json_api</th>
      <td>6.7</td>
      <td>65.6</td>
      <td>9.8x</td>
    </tr>
    <tr>
      <th>resumable_chunked</th>
      <td>6.8</td>
      <td>69.8</td>
      <td>10.3x</td>
    </tr>
    <tr>
      <th>simple_blob</th>
      <td>7.0</td>
      <td>89.7</td>
      <td>12.8x</td>
    </tr>
    <tr>
      <th>streamed</th>
      <td>7.0</td>
      <td>109.9</td>
      <td>15.7x</td>
    </tr>
  </tbody>
</table>

<iframe src="/static/plotly/dt_py_03.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

## Parallel Transfer

> [!warning] GIL and I/O parallelism
>
> Python's GIL limits multithreading for CPU-bound work, not I/O.
> For GCS uploads (I/O-bound), `ThreadPoolExecutor` works well — the GIL is released
> during network I/O. For CPU-bound work like compression, use `ProcessPoolExecutor`
> instead. Mixing CPU and I/O in the same pool causes stalls.

Compares three concurrency strategies for uploading 8 medium-size files to GCS using the top transfer
method (`streamed` / `blob.upload_from_file`, ranked #1 by mean throughput): sequential, multithreaded
(8 threads), and multiprocessing (8 processes). Measures total wall-clock time and aggregate throughput.

#### Generate 8 medium upload files

```python
# Create 8 copies of the medium upload file for parallel transfer benchmarks.
# Using copies (not the same file) to avoid OS-level read caching effects.
PARALLEL_DIR = DATA_DIR / "parallel_8"
PARALLEL_DIR.mkdir(exist_ok=True)

source = upload_files["medium"]
parallel_files = []
for i in range(8):
    dest = PARALLEL_DIR / f"medium_{i:02d}.csv"
    if not dest.exists():
        shutil.copy2(source, dest)
    parallel_files.append(dest)

total_size = sum(f.stat().st_size for f in parallel_files)
print(f"  {len(parallel_files)} files, {fmt_bytes(total_size)} total ({fmt_bytes(parallel_files[0].stat().st_size)} each)")
```

      8 files, 1.51 GB total (193.1 MB each)

#### Parallel transfer benchmark helper

```python
# Parallel transfer benchmark helper — persists results to JSON, keyed by method.
PARALLEL_RESULTS_FILE = DATA_DIR / "parallel_transfer_results.json"
PARALLEL_GCS_PREFIX = "benchmarks/parallel"

def _load_parallel_results() -> list:
    if PARALLEL_RESULTS_FILE.exists():
        return json.loads(PARALLEL_RESULTS_FILE.read_text())
    return []

def _save_parallel_results(results: list) -> None:
    PARALLEL_RESULTS_FILE.write_text(json.dumps(results, indent=2))

def _upload_one(file_path: Path) -> None:
    """Upload a single file using the top method (streamed / blob.upload_from_file)."""
    dest = f"{PARALLEL_GCS_PREFIX}/{file_path.name}"
    blob = bucket.blob(dest)
    with open(file_path, "rb") as f:
        blob.upload_from_file(f, size=file_path.stat().st_size)

def bench_parallel(method_name, run_fn):
    """Benchmark a parallel upload strategy. run_fn(files) uploads all files."""
    total_bytes = sum(f.stat().st_size for f in parallel_files)
    t0 = time.perf_counter()
    run_fn(parallel_files)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    throughput = total_bytes / (elapsed_ms / 1000) if elapsed_ms > 0 else 0
    record = {
        "method":     method_name,
        "files":      len(parallel_files),
        "total_bytes": total_bytes,
        "total_size":  fmt_bytes(total_bytes),
        "elapsed_ms":  round(elapsed_ms, 1),
        "elapsed":     fmt_time(elapsed_ms),
        "throughput":  fmt_bytes(throughput) + "/s",
    }
    # Upsert in persistent store
    all_results = _load_parallel_results()
    all_results = [r for r in all_results if r["method"] != method_name]
    all_results.append(record)
    _save_parallel_results(all_results)
    # Upsert in memory (idempotent)
    global parallel_results
    parallel_results = [r for r in parallel_results if r["method"] != method_name]
    parallel_results.append(record)
    return record

parallel_results = _load_parallel_results()
print(f"  Loaded {len(parallel_results)} existing results from {PARALLEL_RESULTS_FILE.name}")
```

      Loaded 3 existing results from parallel_transfer_results.json

#### Upload 8 files sequentially with blob.upload_from_file

Baseline — uploads each file one after the other in a single thread. Total time = sum of individual upload times. No concurrency overhead.

```python
# Sequential — one file at a time, single thread
def sequential_upload(files):
    for f in files:
        _upload_one(f)

r = bench_parallel("sequential", sequential_upload)
print(f"  {r['files']} files  {r['total_size']}  {r['elapsed']}  {r['throughput']}")
```

      8 files  1.51 GB  3.7min  7.0 MB/s

#### Upload 8 files with ThreadPoolExecutor (8 threads, semaphore-throttled)

Concurrent uploads using 8 threads. A semaphore limits the number of simultaneous uploads to avoid SSL buffer saturation — remaining threads queue and start as earlier uploads finish.

```python
# ThreadPoolExecutor — 8 threads, semaphore-throttled to avoid SSL saturation
# All 8 files are submitted to 8 threads, but a semaphore limits concurrent uploads
# to stay within the connection's bandwidth. Starts at 4 concurrent, adjustable.
CONCURRENT_LIMIT = 4
_sem = __import__('threading').Semaphore(CONCURRENT_LIMIT)

def _throttled_upload(file_path):
    with _sem:
        _upload_one(file_path)

def threaded_upload(files):
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(_throttled_upload, f): f for f in files}
        for fut in as_completed(futures):
            fut.result()

r = bench_parallel('threaded_8', threaded_upload)
print(f"  {r['files']} files  {r['total_size']}  {r['elapsed']}  {r['throughput']}")
```

      8 files  1.51 GB  4.1min  6.3 MB/s

#### Upload 8 files with loky.ProcessPoolExecutor (4 processes)

True parallelism — each upload in a separate process with its own GCS client. 4 workers process 8 files (4 concurrent, 4 queued) to stay within the connection's bandwidth capacity.

```python
# loky ProcessPoolExecutor — 8 files across 4 processes
# max_workers=4 is the throttle: 4 uploads run concurrently, remaining 4 queue.
# This avoids SSL saturation while still using true process-level parallelism.

def multiprocess_upload(files):
    executor = get_reusable_executor(max_workers=4)
    futures = [executor.submit(upload_one, str(f)) for f in files]
    for fut in futures:
        result = fut.result()

r = bench_parallel('multiprocess_4', multiprocess_upload)
print(f"  {r['files']} files  {r['total_size']}  {r['elapsed']}  {r['throughput']}")
```

      8 files  1.51 GB  4.1min  6.3 MB/s

#### Summary of parallel transfer methods

```python
# Parallel transfer summary — reload from JSON for clean deduplicated results
parallel_results = _load_parallel_results()
print(f"  {'method':<18s} {'files':>6s} {'total':>10s} {'time':>10s} {'throughput':>14s}")
for r in parallel_results:
    print(f"  {r['method']:<18s} {r['files']:>6d} {r['total_size']:>10s} {r['elapsed']:>10s} {r['throughput']:>14s}")
```

      method              files      total       time     throughput
      sequential              8    1.51 GB     3.7min       7.0 MB/s
      threaded_8              8    1.51 GB     4.1min       6.3 MB/s
      multiprocess_4          8    1.51 GB     4.1min       6.3 MB/s

#### google-cloud-storage — cleanup parallel benchmark blobs

```python
# Delete parallel benchmark blobs
blobs = list(gcs_client.list_blobs(BUCKET_NAME, prefix=PARALLEL_GCS_PREFIX))
print(f"  Deleting {len(blobs)} parallel benchmark blobs...")
for blob in blobs:
    blob.delete()
print("  Cleanup done")
```

## Download Files

#### Download CSV from GCS with google-cloud-storage - blob.download_to_file over HTTPS

Streams the blob content directly to a file handle. Avoids materializing the full object in memory — the client library reads and writes in chunks internally. Counterpart to `streamed` upload.

```python
# Download from GCS — streamed (blob.download_to_file)
# Upload counterpart: streamed (blob.upload_from_file) — ranked #1 by mean throughput
GCS_DL_PREFIX = "benchmarks/uploads"  # reuse uploaded blobs
DL_DIR = DATA_DIR / "downloads"
DL_DIR.mkdir(exist_ok=True)

def dl_streamed(blob_name, local_path):
    blob = bucket.blob(blob_name)
    with open(local_path, "wb") as f:
        blob.download_to_file(f)

print(f"  {'tier':<8s} {'size':>10s} {'time':>10s} {'throughput':>14s}")
for tier, path in upload_files.items():
    blob_name = f"{GCS_DL_PREFIX}/gcloud_storage/{path.name}"
    local_dest = DL_DIR / f"dl_streamed_{path.name}"
    t0 = time.perf_counter()
    dl_streamed(blob_name, local_dest)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    size = local_dest.stat().st_size
    tp = size / (elapsed_ms / 1000) if elapsed_ms > 0 else 0
    print(f"  {tier:<8s} {fmt_bytes(size):>10s} {fmt_time(elapsed_ms):>10s} {fmt_bytes(tp)+'/s':>14s}")
    local_dest.unlink()
```

      tier           size       time     throughput
      small        9.7 MB      366ms      26.4 MB/s
      medium     193.1 MB       2.0s      95.3 MB/s
      large       1.19 GB      12.0s     101.1 MB/s

#### Download CSV from GCS with google-cloud-storage - blob.download_to_filename over HTTPS

Downloads the entire blob to a local file in a single request. The client library handles resumable downloads automatically for large files. Counterpart to `resumable_chunked` upload.

```python
# Download from GCS — simple (blob.download_to_filename)
# Upload counterpart: resumable_chunked (blob.upload_from_filename) — ranked #2 by mean throughput

def dl_simple(blob_name, local_path):
    blob = bucket.blob(blob_name)
    blob.download_to_filename(str(local_path))

print(f"  {'tier':<8s} {'size':>10s} {'time':>10s} {'throughput':>14s}")
for tier, path in upload_files.items():
    blob_name = f"{GCS_DL_PREFIX}/gcloud_storage/{path.name}"
    local_dest = DL_DIR / f"dl_simple_{path.name}"
    t0 = time.perf_counter()
    dl_simple(blob_name, local_dest)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    size = local_dest.stat().st_size
    tp = size / (elapsed_ms / 1000) if elapsed_ms > 0 else 0
    print(f"  {tier:<8s} {fmt_bytes(size):>10s} {fmt_time(elapsed_ms):>10s} {fmt_bytes(tp)+'/s':>14s}")
    local_dest.unlink()
```

      tier           size       time     throughput
      small        9.7 MB      321ms      30.1 MB/s
      medium     193.1 MB       2.0s      97.7 MB/s
      large       1.19 GB      11.7s     104.4 MB/s

#### Download CSV from GCS with google-cloud-storage - transfer_manager.download_chunks_concurrently over HTTPS

Uses `google.cloud.storage.transfer_manager` to download the file in parallel chunks across multiple threads. Best throughput for large files on high-bandwidth connections.

```python
# Download from GCS — parallel chunks (transfer_manager.download_chunks_concurrently)
# Upload counterpart: parallel_composite (transfer_manager.upload_chunks_concurrently) — ranked #3 by mean throughput

def dl_parallel(blob_name, local_path):
    blob = bucket.blob(blob_name)
    transfer_manager.download_chunks_concurrently(
        blob, local_path, chunk_size=32 * 1024 * 1024, max_workers=8)

print(f"  {'tier':<8s} {'size':>10s} {'time':>10s} {'throughput':>14s}")
for tier, path in upload_files.items():
    blob_name = f"{GCS_DL_PREFIX}/gcloud_storage/{path.name}"
    local_dest = DL_DIR / f"dl_parallel_{path.name}"
    t0 = time.perf_counter()
    dl_parallel(blob_name, str(local_dest))
    elapsed_ms = (time.perf_counter() - t0) * 1000
    size = local_dest.stat().st_size
    tp = size / (elapsed_ms / 1000) if elapsed_ms > 0 else 0
    print(f"  {tier:<8s} {fmt_bytes(size):>10s} {fmt_time(elapsed_ms):>10s} {fmt_bytes(tp)+'/s':>14s}")
    local_dest.unlink()
```

      tier           size       time     throughput
      small        9.7 MB       2.1s       4.5 MB/s
      medium     193.1 MB       5.1s      37.7 MB/s
      large       1.19 GB      14.2s      85.8 MB/s

## Download files from VM

#### Download CSV from VM with OpenSSH - scp over SSH

Uses Windows OpenSSH `scp` via subprocess in reverse direction (VM → local). Same SSH transport as upload but pulls data from the VM.

```python
# scp -i C:/Users/aperi/.ssh/google_compute_engine -o StrictHostKeyChecking=no -o BatchMode=yes alexper_recovery_gmail_com@34.38.193.79:/home/alexper_recovery_gmail_com/bench_data/file.csv ./downloads/file.csv
# Download from VM — scp (reverse direction)
# Upload counterpart: scp — ranked #1 by mean throughput

DL_DIR.mkdir(exist_ok=True)

def dl_scp(remote_file, local_path):
    subprocess.run([
        SCP, "-i", VM_SSH_KEY,
        "-o", "StrictHostKeyChecking=no",
        "-o", "BatchMode=yes",
        f"{VM_USER}@{VM_IP}:{remote_file}",
        str(local_path),
    ], check=True, capture_output=True)

print(f"  {'tier':<8s} {'size':>10s} {'time':>10s} {'throughput':>14s}")
for tier, path in upload_files.items():
    remote = f"{VM_DEST}/{path.name}"
    local_dest = DL_DIR / f"dl_scp_{path.name}"
    t0 = time.perf_counter()
    dl_scp(remote, local_dest)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    size = local_dest.stat().st_size
    tp = size / (elapsed_ms / 1000) if elapsed_ms > 0 else 0
    print(f"  {tier:<8s} {fmt_bytes(size):>10s} {fmt_time(elapsed_ms):>10s} {fmt_bytes(tp)+'/s':>14s}")
    local_dest.unlink()
```

      tier           size       time     throughput
      small        9.7 MB       1.5s       6.3 MB/s
      medium     193.1 MB       4.4s      43.9 MB/s
      large       1.19 GB      19.2s      63.4 MB/s

#### Download CSV from VM with gcloud - compute scp over SSH

Uses the gcloud CLI which handles authentication via OS Login automatically, no key file needed. Internally wraps OpenSSH.

```python
# gcloud compute scp --zone=europe-west1-b --strict-host-key-checking=no notebook-vm:/home/alexper_recovery_gmail_com/bench_data/file.csv ./downloads/file.csv
# Download from VM — gcloud compute scp (reverse direction)
# Upload counterpart: gcloud_scp — ranked #2 by mean throughput

def dl_gcloud_scp(remote_file, local_path):
    subprocess.run([
        GCLOUD, "compute", "scp",
        "--zone=europe-west1-b",
        "--strict-host-key-checking=no",
        f"notebook-vm:{remote_file}",
        str(local_path),
    ], check=True, capture_output=True, shell=True)

print(f"  {'tier':<8s} {'size':>10s} {'time':>10s} {'throughput':>14s}")
for tier, path in upload_files.items():
    remote = f"{VM_DEST}/{path.name}"
    local_dest = DL_DIR / f"dl_gcloud_{path.name}"
    t0 = time.perf_counter()
    dl_gcloud_scp(remote, local_dest)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    size = local_dest.stat().st_size
    tp = size / (elapsed_ms / 1000) if elapsed_ms > 0 else 0
    print(f"  {tier:<8s} {fmt_bytes(size):>10s} {fmt_time(elapsed_ms):>10s} {fmt_bytes(tp)+'/s':>14s}")
    local_dest.unlink()
```

      tier           size       time     throughput
      small        9.7 MB       4.2s       2.3 MB/s
      medium     193.1 MB       9.9s      19.6 MB/s
      large       1.19 GB      38.4s      31.7 MB/s

#### Download CSV from VM with OpenSSH - scp -C over SSH (compressed)

Same as `scp` but enables SSH-level compression. Trades CPU for reduced bytes on the wire — most effective for compressible data like CSV.

```python
# scp -C -i C:/Users/aperi/.ssh/google_compute_engine -o StrictHostKeyChecking=no -o BatchMode=yes alexper_recovery_gmail_com@34.38.193.79:/home/alexper_recovery_gmail_com/bench_data/file.csv ./downloads/file.csv
# Download from VM — scp -C (compressed, reverse direction)
# Upload counterpart: scp_compressed — ranked #3 by mean throughput

def dl_scp_compressed(remote_file, local_path):
    subprocess.run([
        SCP, "-i", VM_SSH_KEY,
        "-o", "StrictHostKeyChecking=no",
        "-o", "BatchMode=yes",
        "-C",
        f"{VM_USER}@{VM_IP}:{remote_file}",
        str(local_path),
    ], check=True, capture_output=True)

print(f"  {'tier':<8s} {'size':>10s} {'time':>10s} {'throughput':>14s}")
for tier, path in upload_files.items():
    remote = f"{VM_DEST}/{path.name}"
    local_dest = DL_DIR / f"dl_scp_c_{path.name}"
    t0 = time.perf_counter()
    dl_scp_compressed(remote, local_dest)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    size = local_dest.stat().st_size
    tp = size / (elapsed_ms / 1000) if elapsed_ms > 0 else 0
    print(f"  {tier:<8s} {fmt_bytes(size):>10s} {fmt_time(elapsed_ms):>10s} {fmt_bytes(tp)+'/s':>14s}")
    local_dest.unlink()
```

      tier           size       time     throughput
      small        9.7 MB       2.0s       4.8 MB/s
      medium     193.1 MB      13.8s      14.0 MB/s
      large       1.19 GB     1.3min      15.1 MB/s

## File Compression Benchmarks

Benchmarks compression speed and ratio for the large upload file (~1.19 GB CSV) and a folder of 1000 small files.
Methods: gzip, bz2, lzma (xz), zstd, lz4, brotli, zip archive.

#### Generate 1000 small test files (~1 MB each)

```python
# Generate 1000 small CSV files (~1 MB each) for multi-file compression benchmarks.
# Splits large_upload.csv (~1.19 GB) into 1000 chunks, each a valid CSV with the same header.
SMALL_FILES_DIR = DATA_DIR / "small_files_1000"
if SMALL_FILES_DIR.exists():
    shutil.rmtree(SMALL_FILES_DIR)
SMALL_FILES_DIR.mkdir()

source_csv = upload_files["large"]  # ~1.19 GB
lines = source_csv.read_text().splitlines()
header = lines[0]
data_lines = lines[1:]
chunk_size = len(data_lines) // 1000

for i in range(1000):
    start = i * chunk_size
    end = start + chunk_size if i < 999 else len(data_lines)
    chunk_path = SMALL_FILES_DIR / f"chunk_{i:04d}.csv"
    chunk_path.write_text(header + chr(10) + chr(10).join(data_lines[start:end]) + chr(10))

small_files = sorted(SMALL_FILES_DIR.glob("*.csv"))
total_size = sum(f.stat().st_size for f in small_files)
print(f"  Generated {len(small_files)} files in {SMALL_FILES_DIR.name}/")
print(f"  Total size: {fmt_bytes(total_size)}  Avg: {fmt_bytes(total_size // len(small_files))}")
```

      Generated 1000 files in small_files_1000/
      Total size: 1.19 GB  Avg: 1.2 MB

#### Compression benchmark helper

```python
# Compression benchmark helper — times compress + decompress, measures ratio.
# Persists results to JSON, keyed by (method, tier).
COMPRESS_RESULTS_FILE = DATA_DIR / "compression_results.json"

compress_files = {
    "large":       upload_files["large"],        # single 1.19 GB CSV
    "1000_small":   SMALL_FILES_DIR,               # folder of 100 small CSVs
}

def _load_compress_results() -> list:
    if COMPRESS_RESULTS_FILE.exists():
        return json.loads(COMPRESS_RESULTS_FILE.read_text())
    return []

def _save_compress_results(results: list) -> None:
    COMPRESS_RESULTS_FILE.write_text(json.dumps(results, indent=2))

def bench_compress(method_name, compress_fn, decompress_fn, input_path, tier):
    """Benchmark a compression method.
    compress_fn(input_path, output_path) -> compressed size in bytes
    decompress_fn(compressed_path, output_path) -> None
    """
    # Measure original size
    if input_path.is_dir():
        orig_size = sum(f.stat().st_size for f in input_path.glob("*"))
    else:
        orig_size = input_path.stat().st_size

    fd, tmp_compressed = tempfile.mkstemp(suffix=f".{method_name}")
    os.close(fd)
    fd2, tmp_decompressed = tempfile.mkstemp(suffix=".out")
    os.close(fd2)

    try:
        # Compress
        t0 = time.perf_counter()
        compressed_size = compress_fn(input_path, Path(tmp_compressed))
        compress_ms = (time.perf_counter() - t0) * 1000

        # Decompress
        t0 = time.perf_counter()
        decompress_fn(Path(tmp_compressed), Path(tmp_decompressed))
        decompress_ms = (time.perf_counter() - t0) * 1000

        compress_tp = orig_size / (compress_ms / 1000) if compress_ms > 0 else 0
        decompress_tp = orig_size / (decompress_ms / 1000) if decompress_ms > 0 else 0

        record = {
            "method":         method_name,
            "tier":           tier,
            "orig_bytes":     orig_size,
            "compressed_bytes": compressed_size,
            "orig_size":      fmt_bytes(orig_size),
            "compressed_size": fmt_bytes(compressed_size),
            "ratio":          f"{orig_size / compressed_size:.1f}x" if compressed_size > 0 else "-",
            "compress_ms":    round(compress_ms, 1),
            "decompress_ms":  round(decompress_ms, 1),
            "compress_time":  fmt_time(compress_ms),
            "decompress_time": fmt_time(decompress_ms),
            "compress_tp":    fmt_bytes(compress_tp) + "/s",
            "decompress_tp":  fmt_bytes(decompress_tp) + "/s",
        }
    finally:
        Path(tmp_compressed).unlink(missing_ok=True)
        Path(tmp_decompressed).unlink(missing_ok=True)

    # Upsert into persistent store
    all_results = _load_compress_results()
    key = (record["method"], record["tier"])
    all_results = [r for r in all_results if (r["method"], r["tier"]) != key]
    all_results.append(record)
    _save_compress_results(all_results)

    compress_results.append(record)
    return record

compress_results = _load_compress_results()
print(f"  Loaded {len(compress_results)} existing results from {COMPRESS_RESULTS_FILE.name}")
```

      Loaded 14 existing results from compression_results.json

#### Compress with gzip (zlib level 6)

Standard gzip compression. The most widely supported format — every tool, language, and OS can decompress it. Default level 6 balances speed and ratio.

```python
# gzip — stdlib, zlib level 6 (default)
def gzip_compress(input_path, output_path):
    with open(output_path, "wb") as f_out:
        with gzip_mod.open(f_out, "wb", compresslevel=6) as gz:
            if input_path.is_dir():
                for f in sorted(input_path.glob("*")):
                    gz.write(f.read_bytes())
            else:
                with open(input_path, "rb") as f_in:
                    shutil.copyfileobj(f_in, gz)
    return output_path.stat().st_size

def gzip_decompress(compressed_path, output_path):
    with open(compressed_path, "rb") as f_in, open(output_path, "wb") as f_out:
        with gzip_mod.GzipFile(fileobj=f_in) as gz:
            shutil.copyfileobj(gz, f_out)

print(f"  {'tier':<12s} {'orig':>10s} {'compressed':>12s} {'ratio':>7s} {'compress':>10s} {'decompress':>10s} {'c_tp':>14s} {'d_tp':>14s}")
for tier, path in compress_files.items():
    r = bench_compress("gzip", gzip_compress, gzip_decompress, path, tier)
    print(f"  {tier:<12s} {r['orig_size']:>10s} {r['compressed_size']:>12s} {r['ratio']:>7s} {r['compress_time']:>10s} {r['decompress_time']:>10s} {r['compress_tp']:>14s} {r['decompress_tp']:>14s}")
```

      tier               orig   compressed   ratio   compress decompress           c_tp           d_tp
      large           1.19 GB     420.3 MB    2.9x      39.5s       3.2s      30.8 MB/s     384.7 MB/s
      1000_small      1.19 GB     420.4 MB    2.9x      44.1s       3.1s      27.6 MB/s     388.2 MB/s

#### Compress with bz2 (Burrows-Wheeler)

Higher compression ratio than gzip but significantly slower. Uses the Burrows-Wheeler transform. Best when storage cost matters more than CPU time.

```python
# bz2 — stdlib, Burrows-Wheeler, level 9 (default)

def bz2_compress(input_path, output_path):
    with open(output_path, "wb") as raw_out, bz2.BZ2File(raw_out, "wb", compresslevel=9) as f_out:
        if input_path.is_dir():
            for f in sorted(input_path.glob("*")):
                f_out.write(f.read_bytes())
        else:
            with open(input_path, "rb") as f_in:
                shutil.copyfileobj(f_in, f_out)
    return output_path.stat().st_size

def bz2_decompress(compressed_path, output_path):
    with open(compressed_path, "rb") as raw_in, open(output_path, "wb") as f_out:
        with bz2.BZ2File(raw_in) as f_in:
            shutil.copyfileobj(f_in, f_out)

print(f"  {'tier':<12s} {'orig':>10s} {'compressed':>12s} {'ratio':>7s} {'compress':>10s} {'decompress':>10s} {'c_tp':>14s} {'d_tp':>14s}")
for tier, path in compress_files.items():
    r = bench_compress("bz2", bz2_compress, bz2_decompress, path, tier)
    print(f"  {tier:<12s} {r['orig_size']:>10s} {r['compressed_size']:>12s} {r['ratio']:>7s} {r['compress_time']:>10s} {r['decompress_time']:>10s} {r['compress_tp']:>14s} {r['decompress_tp']:>14s}")
```

      tier               orig   compressed   ratio   compress decompress           c_tp           d_tp
      large           1.19 GB     296.7 MB    4.1x      52.2s      25.1s      23.3 MB/s      48.4 MB/s
      1000_small      1.19 GB     296.8 MB    4.1x      54.9s      24.5s      22.2 MB/s      49.6 MB/s

#### Compress with lzma (xz)

Best compression ratio of the stdlib methods. Very slow to compress but fast to decompress. Used by `.xz` and `.tar.xz` archives. Ideal for archival where you compress once and decompress many times.

```python
# lzma (xz) — stdlib, best ratio, slowest compress

def lzma_compress(input_path, output_path):
    with open(output_path, "wb") as raw_out, lzma.LZMAFile(raw_out, "wb", preset=6) as f_out:
        if input_path.is_dir():
            for f in sorted(input_path.glob("*")):
                f_out.write(f.read_bytes())
        else:
            with open(input_path, "rb") as f_in:
                shutil.copyfileobj(f_in, f_out)
    return output_path.stat().st_size

def lzma_decompress(compressed_path, output_path):
    with open(compressed_path, "rb") as raw_in, open(output_path, "wb") as f_out:
        with lzma.LZMAFile(raw_in) as f_in:
            shutil.copyfileobj(f_in, f_out)

print(f"  {'tier':<12s} {'orig':>10s} {'compressed':>12s} {'ratio':>7s} {'compress':>10s} {'decompress':>10s} {'c_tp':>14s} {'d_tp':>14s}")
for tier, path in compress_files.items():
    r = bench_compress("lzma", lzma_compress, lzma_decompress, path, tier)
    print(f"  {tier:<12s} {r['orig_size']:>10s} {r['compressed_size']:>12s} {r['ratio']:>7s} {r['compress_time']:>10s} {r['decompress_time']:>10s} {r['compress_tp']:>14s} {r['decompress_tp']:>14s}")
```

      tier               orig   compressed   ratio   compress decompress           c_tp           d_tp
      large           1.19 GB     321.7 MB    3.8x     8.1min      13.0s       2.5 MB/s      93.8 MB/s
      1000_small      1.19 GB     321.7 MB    3.8x     8.0min      12.8s       2.5 MB/s      94.8 MB/s

#### Compress with zstandard (Zstandard/zstd)

Modern compression algorithm by Facebook. Near-gzip ratio at LZ4-like speed. Supports dictionary compression and streaming. The default choice for new systems — used by Linux kernel, Kafka, ClickHouse.

```python
# zstandard (zstd) — near-gzip ratio at LZ4-like speed

def zstd_compress(input_path, output_path):
    cctx = zstd.ZstdCompressor(level=3)
    with open(output_path, "wb") as f_out:
        with cctx.stream_writer(f_out) as writer:
            if input_path.is_dir():
                for f in sorted(input_path.glob("*")):
                    writer.write(f.read_bytes())
            else:
                with open(input_path, "rb") as f_in:
                    shutil.copyfileobj(f_in, writer)
    return output_path.stat().st_size

def zstd_decompress(compressed_path, output_path):
    dctx = zstd.ZstdDecompressor()
    with open(compressed_path, "rb") as f_in, open(output_path, "wb") as f_out:
        dctx.copy_stream(f_in, f_out)

print(f"  {'tier':<12s} {'orig':>10s} {'compressed':>12s} {'ratio':>7s} {'compress':>10s} {'decompress':>10s} {'c_tp':>14s} {'d_tp':>14s}")
for tier, path in compress_files.items():
    r = bench_compress("zstd", zstd_compress, zstd_decompress, path, tier)
    print(f"  {tier:<12s} {r['orig_size']:>10s} {r['compressed_size']:>12s} {r['ratio']:>7s} {r['compress_time']:>10s} {r['decompress_time']:>10s} {r['compress_tp']:>14s} {r['decompress_tp']:>14s}")
```

      tier               orig   compressed   ratio   compress decompress           c_tp           d_tp
      large           1.19 GB     438.8 MB    2.8x       5.7s       1.7s     215.1 MB/s     705.7 MB/s
      1000_small      1.19 GB     438.9 MB    2.8x       5.4s       1.6s     226.0 MB/s     784.7 MB/s

#### Compress with lz4

Fastest compression algorithm — optimized for speed over ratio. Decompression is extremely fast (multi-GB/s). Used in real-time systems, databases (RocksDB), and in-memory caching where latency matters more than size.

```python
# lz4 — fastest compress/decompress, lowest ratio

def lz4_compress(input_path, output_path):
    with open(output_path, "wb") as f_out:
        with lz4.frame.open(f_out, "wb") as lz:
            if input_path.is_dir():
                for f in sorted(input_path.glob("*")):
                    lz.write(f.read_bytes())
            else:
                with open(input_path, "rb") as f_in:
                    shutil.copyfileobj(f_in, lz)
    return output_path.stat().st_size

def lz4_decompress(compressed_path, output_path):
    with lz4.frame.open(compressed_path, "rb") as f_in, open(output_path, "wb") as f_out:
        shutil.copyfileobj(f_in, f_out)

print(f"  {'tier':<12s} {'orig':>10s} {'compressed':>12s} {'ratio':>7s} {'compress':>10s} {'decompress':>10s} {'c_tp':>14s} {'d_tp':>14s}")
for tier, path in compress_files.items():
    r = bench_compress("lz4", lz4_compress, lz4_decompress, path, tier)
    print(f"  {tier:<12s} {r['orig_size']:>10s} {r['compressed_size']:>12s} {r['ratio']:>7s} {r['compress_time']:>10s} {r['decompress_time']:>10s} {r['compress_tp']:>14s} {r['decompress_tp']:>14s}")
```

      tier               orig   compressed   ratio   compress decompress           c_tp           d_tp
      large           1.19 GB     749.6 MB    1.6x       2.4s       1.2s     498.5 MB/s     995.2 MB/s
      1000_small      1.19 GB     749.7 MB    1.6x       2.6s       1.1s     459.6 MB/s      1.04 GB/s

#### Compress with brotli

Google-developed algorithm optimized for web content. Better ratio than gzip at similar speed (level 4). Used by all modern browsers for HTTP content-encoding. Best for static assets served over CDN.

```python
# brotli — Google, optimized for web content, level 4

def brotli_compress(input_path, output_path):
    if input_path.is_dir():
        data = b"".join(f.read_bytes() for f in sorted(input_path.glob("*")))
    else:
        data = input_path.read_bytes()
    compressed = brotli.compress(data, quality=4)
    output_path.write_bytes(compressed)
    return len(compressed)

def brotli_decompress(compressed_path, output_path):
    data = brotli.decompress(compressed_path.read_bytes())
    output_path.write_bytes(data)

print(f"  {'tier':<12s} {'orig':>10s} {'compressed':>12s} {'ratio':>7s} {'compress':>10s} {'decompress':>10s} {'c_tp':>14s} {'d_tp':>14s}")
for tier, path in compress_files.items():
    r = bench_compress("brotli", brotli_compress, brotli_decompress, path, tier)
    print(f"  {tier:<12s} {r['orig_size']:>10s} {r['compressed_size']:>12s} {r['ratio']:>7s} {r['compress_time']:>10s} {r['decompress_time']:>10s} {r['compress_tp']:>14s} {r['decompress_tp']:>14s}")
```

      tier               orig   compressed   ratio   compress decompress           c_tp           d_tp
      large           1.19 GB     405.4 MB    3.0x      13.7s       3.2s      88.8 MB/s     383.8 MB/s
      1000_small      1.19 GB     405.4 MB    3.0x      13.9s       3.1s      87.8 MB/s     386.8 MB/s

#### Compress with zipfile (ZIP archive)

Standard ZIP format — compresses each file individually within the archive. Unlike the stream-based methods above, ZIP preserves file boundaries and names. Universal format supported by every OS file manager.

```python
# zipfile — ZIP archive with deflate compression

def zip_compress(input_path, output_path):
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        if input_path.is_dir():
            for f in sorted(input_path.glob("*")):
                zf.write(f, f.name)
        else:
            zf.write(input_path, input_path.name)
    return output_path.stat().st_size

def zip_decompress(compressed_path, output_path):
    # Extract all to a temp dir, then concat to output for timing consistency
    with zipfile.ZipFile(compressed_path, "r") as zf:
        td = Path(tempfile.mkdtemp())
        zf.extractall(td)
        with open(output_path, "wb") as f_out:
            for f in sorted(td.iterdir()):
                f_out.write(f.read_bytes())
        shutil.rmtree(td)

print(f"  {'tier':<12s} {'orig':>10s} {'compressed':>12s} {'ratio':>7s} {'compress':>10s} {'decompress':>10s} {'c_tp':>14s} {'d_tp':>14s}")
for tier, path in compress_files.items():
    r = bench_compress("zip", zip_compress, zip_decompress, path, tier)
    print(f"  {tier:<12s} {r['orig_size']:>10s} {r['compressed_size']:>12s} {r['ratio']:>7s} {r['compress_time']:>10s} {r['decompress_time']:>10s} {r['compress_tp']:>14s} {r['decompress_tp']:>14s}")
```

      tier               orig   compressed   ratio   compress decompress           c_tp           d_tp
      large           1.19 GB     420.3 MB    2.9x      40.2s       4.2s      30.3 MB/s     289.2 MB/s
      1000_small      1.19 GB     421.6 MB    2.9x      39.5s       7.4s      30.8 MB/s     163.8 MB/s

#### Summary of compression methods

```python
# Compression results summary — all methods, both tiers
df_comp = pd.DataFrame(compress_results).drop_duplicates(subset=["method", "tier"], keep="last")
for tier in ["large", "1000_small"]:
    sub = df_comp[df_comp["tier"] == tier].sort_values("compress_ms")
    print(f"\n  \u2500\u2500 {tier} \u2500\u2500")
    print(f"  {'method':<12s} {'orig':>10s} {'compressed':>12s} {'ratio':>7s} {'compress':>10s} {'decompress':>10s} {'c_tp':>14s} {'d_tp':>14s}")
    for _, row in sub.iterrows():
        print(f"  {row['method']:<12s} {row['orig_size']:>10s} {row['compressed_size']:>12s} {row['ratio']:>7s} {row['compress_time']:>10s} {row['decompress_time']:>10s} {row['compress_tp']:>14s} {row['decompress_tp']:>14s}")
```

    
      ── large ──
      method             orig   compressed   ratio   compress decompress           c_tp           d_tp
      lz4             1.19 GB     749.6 MB    1.6x       2.4s       1.2s     498.5 MB/s     995.2 MB/s
      zstd            1.19 GB     438.8 MB    2.8x       5.7s       1.7s     215.1 MB/s     705.7 MB/s
      brotli          1.19 GB     405.4 MB    3.0x      13.7s       3.2s      88.8 MB/s     383.8 MB/s
      gzip            1.19 GB     420.3 MB    2.9x      39.5s       3.2s      30.8 MB/s     384.7 MB/s
      zip             1.19 GB     420.3 MB    2.9x      40.2s       4.2s      30.3 MB/s     289.2 MB/s
      bz2             1.19 GB     296.7 MB    4.1x      52.2s      25.1s      23.3 MB/s      48.4 MB/s
      lzma            1.19 GB     321.7 MB    3.8x     8.4min      13.2s       2.4 MB/s      92.5 MB/s
    
      ── 1000_small ──
      method             orig   compressed   ratio   compress decompress           c_tp           d_tp
      lz4             1.19 GB     749.7 MB    1.6x       2.6s       1.1s     459.6 MB/s      1.04 GB/s
      zstd            1.19 GB     438.9 MB    2.8x       5.4s       1.6s     226.0 MB/s     784.7 MB/s
      brotli          1.19 GB     405.4 MB    3.0x      13.9s       3.1s      87.8 MB/s     386.8 MB/s
      zip             1.19 GB     421.6 MB    2.9x      39.5s       7.4s      30.8 MB/s     163.8 MB/s
      gzip            1.19 GB     420.4 MB    2.9x      44.1s       3.1s      27.6 MB/s     388.2 MB/s
      bz2             1.19 GB     296.8 MB    4.1x      54.9s      24.5s      22.2 MB/s      49.6 MB/s
      lzma            1.19 GB     321.7 MB    3.8x     8.1min      14.3s       2.5 MB/s      85.0 MB/s

#### Chart — compression speed vs ratio

```python
# Scatter: compress throughput (x) vs ratio (y) — large file only
df_large = df_comp[df_comp["tier"] == "large"].copy()
df_large["c_mbps"] = df_large["orig_bytes"] / (df_large["compress_ms"] / 1000) / 1024**2
df_large["ratio_num"] = df_large["orig_bytes"] / df_large["compressed_bytes"]

fig = go.Figure()
fig.add_trace(go.Scatter(
    x=df_large["c_mbps"], y=df_large["ratio_num"],
    mode="markers+text", text=df_large["method"],
    textposition="top center", marker=dict(size=12),
))
fig.update_layout(
    title="Compression — Speed vs Ratio (large file)",
    xaxis_title="Compress Throughput (MB/s)",
    yaxis_title="Compression Ratio (x)",
    template="plotly_dark", height=500,
)
fig.show()
```

<iframe src="/static/plotly/dt_py_04.html" width="100%" height="550" style="border:none;border-radius:8px;" loading="lazy"></iframe>

## Production Pipeline — Compress, Split, Parallel Upload, Download, Verify, Merge

> [!danger] Always verify checksums after transfer
>
> Always verify checksums after transfer — silent corruption is real
> Network transfers can produce bit-flip errors that don't trigger TCP checksum failures.
> GCS stores CRC32C and MD5 checksums for every object — verify after download. Without
> verification, you won't know a 1GB Parquet file is corrupt until a query fails on row
> 800,000.

End-to-end pipeline that mirrors how production systems (Kafka, ClickHouse, cloud ETL) handle
massive file transfers: compress with zstd, split into chunks, upload in parallel, download in
parallel, verify checksums per chunk, and merge back to the original file.

Uses the large upload file (~1.19 GB) as input.

#### Step 1 — Compress with zstd (level 3)

Compress the full file before splitting. Zstd level 3 gives ~3x ratio at near-LZ4 speed — the production sweet spot.

```python
# Step 1: Compress the large file with zstd level 3
import hashlib

PIPELINE_DIR = DATA_DIR / "pipeline"
PIPELINE_DIR.mkdir(exist_ok=True)
PIPELINE_GCS_PREFIX = "benchmarks/pipeline"

source_file = upload_files["large"]
compressed_file = PIPELINE_DIR / "large_upload.csv.zst"

# Compute original checksum for end-to-end verification
print(f"  Source: {source_file.name} ({fmt_bytes(source_file.stat().st_size)})")
t0 = time.perf_counter()
original_md5 = hashlib.md5(source_file.read_bytes()).hexdigest()
print(f"  Original MD5: {original_md5} ({fmt_time((time.perf_counter()-t0)*1000)})")

# Compress
t0 = time.perf_counter()
cctx = zstd.ZstdCompressor(level=3)
with open(source_file, "rb") as f_in, open(compressed_file, "wb") as f_out:
    cctx.copy_stream(f_in, f_out)
compress_ms = (time.perf_counter() - t0) * 1000

orig_size = source_file.stat().st_size
comp_size = compressed_file.stat().st_size
ratio = orig_size / comp_size
tp = orig_size / (compress_ms / 1000)
print(f"  Compressed: {fmt_bytes(comp_size)} ({ratio:.1f}x ratio)")
print(f"  Time: {fmt_time(compress_ms)}  Throughput: {fmt_bytes(tp)}/s")
```

      Source: large_upload.csv (1.19 GB)
      Original MD5: 054b516bca00fe7ebcfeb6516a5d3789 (1.5s)
      Compressed: 438.8 MB (2.8x ratio)
      Time: 5.2s  Throughput: 234.8 MB/s

#### Step 2 — Split into 8 chunks with per-chunk MD5

Split the compressed file into 8 equal chunks. Compute MD5 for each chunk — used to verify integrity after download.

```python
# Step 2: Split compressed file into 8 chunks, compute MD5 per chunk
NUM_CHUNKS = 8
CHUNK_DIR = PIPELINE_DIR / "chunks"
if CHUNK_DIR.exists():
    shutil.rmtree(CHUNK_DIR)
CHUNK_DIR.mkdir()

comp_data = compressed_file.read_bytes()
chunk_size = len(comp_data) // NUM_CHUNKS
chunk_manifest = []  # (filename, md5, size)

t0 = time.perf_counter()
for i in range(NUM_CHUNKS):
    start = i * chunk_size
    end = start + chunk_size if i < NUM_CHUNKS - 1 else len(comp_data)
    chunk_bytes = comp_data[start:end]
    chunk_name = f"chunk_{i:02d}.zst"
    chunk_path = CHUNK_DIR / chunk_name
    chunk_path.write_bytes(chunk_bytes)
    chunk_md5 = hashlib.md5(chunk_bytes).hexdigest()
    chunk_manifest.append((chunk_name, chunk_md5, len(chunk_bytes)))
split_ms = (time.perf_counter() - t0) * 1000

print(f"  Split into {NUM_CHUNKS} chunks in {fmt_time(split_ms)}")
print(f"  {'chunk':<16s} {'size':>10s} {'md5'}")
for name, md5, size in chunk_manifest:
    print(f"  {name:<16s} {fmt_bytes(size):>10s} {md5}")
```

      Split into 8 chunks in 675ms
      chunk                  size md5
      chunk_00.zst        54.9 MB 1f20518e7d64130d89620551cff1c9cd
      chunk_01.zst        54.9 MB 1a3a1ba0db8277ea1cd60608950dc478
      chunk_02.zst        54.9 MB 462d417d281787d1da88d66bc7583a10
      chunk_03.zst        54.9 MB 0c3661667a279c96a71303e594662e4b
      chunk_04.zst        54.9 MB c9dbda9ee4155166e50f7a8e60008cab
      chunk_05.zst        54.9 MB 0f45370cc3fc12ed9232cddf6a28b8fa
      chunk_06.zst        54.9 MB 069ce02e0072e67f81fd6869b9992a1a
      chunk_07.zst        54.9 MB 492e94537b6ff915b07af6f5af21cc7f

#### Step 3 — Parallel upload chunks with transfer_manager.upload_chunks_concurrently

Two levels of parallelism: outer `ThreadPoolExecutor` dispatches 8 chunks (4 concurrent via semaphore), inner `transfer_manager` further splits each chunk into 32 MB sub-chunks and uploads them concurrently. CRC32C checksum per sub-chunk.

```python
# Step 3: Upload all chunks in parallel, each using transfer_manager.upload_chunks_concurrently
# Outer parallelism: 8 threads (one per chunk), semaphore-throttled to 4 concurrent.
# Inner parallelism: transfer_manager splits each chunk into 32 MB sub-chunks, uploads concurrently.
# Double parallelism = maximum throughput.

chunk_files = sorted(CHUNK_DIR.glob("*.zst"))
_upload_sem = threading.Semaphore(4)

def _upload_chunk_parallel(chunk_path):
    with _upload_sem:
        blob_name = f"{PIPELINE_GCS_PREFIX}/{chunk_path.name}"
        blob = bucket.blob(blob_name)
        transfer_manager.upload_chunks_concurrently(
            str(chunk_path), blob,
            chunk_size=32 * 1024 * 1024,
            worker_type="thread",
            max_workers=4,
            checksum="crc32c",
        )
    return chunk_path.name

t0 = time.perf_counter()
with ThreadPoolExecutor(max_workers=8) as pool:
    futures = {pool.submit(_upload_chunk_parallel, f): f for f in chunk_files}
    for fut in as_completed(futures):
        name = fut.result()
        print(f"    ✓ uploaded {name}")
upload_ms = (time.perf_counter() - t0) * 1000

total_uploaded = sum(s for _, _, s in chunk_manifest)
tp = total_uploaded / (upload_ms / 1000)
print(f"  Uploaded {NUM_CHUNKS} chunks ({fmt_bytes(total_uploaded)}) in {fmt_time(upload_ms)}  ({fmt_bytes(tp)}/s)")
```

        ✓ uploaded chunk_03.zst
        ✓ uploaded chunk_02.zst
        ✓ uploaded chunk_01.zst
        ✓ uploaded chunk_00.zst
        ✓ uploaded chunk_04.zst
        ✓ uploaded chunk_07.zst
        ✓ uploaded chunk_06.zst
        ✓ uploaded chunk_05.zst
      Uploaded 8 chunks (438.8 MB) in 1.0min  (7.0 MB/s)

#### Step 4 — Parallel download chunks from GCS

Download all 8 chunks back in parallel. Uses `blob.download_to_file` (top download method).

```python
# Step 4: Download chunks in parallel
DL_CHUNK_DIR = PIPELINE_DIR / "downloaded_chunks"
if DL_CHUNK_DIR.exists():
    shutil.rmtree(DL_CHUNK_DIR)
DL_CHUNK_DIR.mkdir()

_download_sem = threading.Semaphore(4)

def _download_chunk(chunk_name):
    with _download_sem:
        blob_name = f"{PIPELINE_GCS_PREFIX}/{chunk_name}"
        blob = bucket.blob(blob_name)
        local_path = DL_CHUNK_DIR / chunk_name
        with open(local_path, "wb") as f:
            blob.download_to_file(f)
    return chunk_name

t0 = time.perf_counter()
with ThreadPoolExecutor(max_workers=8) as pool:
    futures = {pool.submit(_download_chunk, name): name for name, _, _ in chunk_manifest}
    for fut in as_completed(futures):
        name = fut.result()
        print(f"    ✓ downloaded {name}")
download_ms = (time.perf_counter() - t0) * 1000

tp = total_uploaded / (download_ms / 1000)
print(f"  Downloaded {NUM_CHUNKS} chunks in {fmt_time(download_ms)}  ({fmt_bytes(tp)}/s)")
```

        ✓ downloaded chunk_00.zst
        ✓ downloaded chunk_03.zst
        ✓ downloaded chunk_02.zst
        ✓ downloaded chunk_04.zst
        ✓ downloaded chunk_05.zst
        ✓ downloaded chunk_06.zst
        ✓ downloaded chunk_07.zst
        ✓ downloaded chunk_01.zst
      Downloaded 8 chunks in 4.7s  (92.6 MB/s)

#### Step 5 — Verify chunk checksums

Compare MD5 of each downloaded chunk against the manifest computed at split time. Any mismatch means corruption during transfer.

```python
# Step 5: Verify MD5 checksums per chunk
all_ok = True
print(f"  {'chunk':<16s} {'expected':>34s} {'actual':>34s} {'status'}")
for name, expected_md5, _ in chunk_manifest:
    dl_path = DL_CHUNK_DIR / name
    actual_md5 = hashlib.md5(dl_path.read_bytes()).hexdigest()
    ok = actual_md5 == expected_md5
    status = "✓" if ok else "✗ MISMATCH"
    if not ok:
        all_ok = False
    print(f"  {name:<16s} {expected_md5:>34s} {actual_md5:>34s} {status}")

print(f"  {'All chunks verified OK' if all_ok else 'CHECKSUM FAILURE — transfer corrupted'}")
```

      chunk                                      expected                             actual status
      chunk_00.zst       1f20518e7d64130d89620551cff1c9cd   1f20518e7d64130d89620551cff1c9cd ✓
      chunk_01.zst       1a3a1ba0db8277ea1cd60608950dc478   1a3a1ba0db8277ea1cd60608950dc478 ✓
      chunk_02.zst       462d417d281787d1da88d66bc7583a10   462d417d281787d1da88d66bc7583a10 ✓
      chunk_03.zst       0c3661667a279c96a71303e594662e4b   0c3661667a279c96a71303e594662e4b ✓
      chunk_04.zst       c9dbda9ee4155166e50f7a8e60008cab   c9dbda9ee4155166e50f7a8e60008cab ✓
      chunk_05.zst       0f45370cc3fc12ed9232cddf6a28b8fa   0f45370cc3fc12ed9232cddf6a28b8fa ✓
      chunk_06.zst       069ce02e0072e67f81fd6869b9992a1a   069ce02e0072e67f81fd6869b9992a1a ✓
      chunk_07.zst       492e94537b6ff915b07af6f5af21cc7f   492e94537b6ff915b07af6f5af21cc7f ✓
      All chunks verified OK

#### Step 6 — Merge chunks and decompress

Concatenate the downloaded chunks back into the compressed file, then decompress with zstd. Verify the final file matches the original via MD5.

```python
# Step 6: Merge chunks → decompress → verify against original
merged_compressed = PIPELINE_DIR / "merged.csv.zst"
final_output = PIPELINE_DIR / "restored_large_upload.csv"

# Merge
t0 = time.perf_counter()
with open(merged_compressed, "wb") as f_out:
    for name, _, _ in chunk_manifest:
        f_out.write((DL_CHUNK_DIR / name).read_bytes())
merge_ms = (time.perf_counter() - t0) * 1000
print(f"  Merged {NUM_CHUNKS} chunks in {fmt_time(merge_ms)}")

# Decompress
t0 = time.perf_counter()
dctx = zstd.ZstdDecompressor()
with open(merged_compressed, "rb") as f_in, open(final_output, "wb") as f_out:
    dctx.copy_stream(f_in, f_out)
decompress_ms = (time.perf_counter() - t0) * 1000

restored_size = final_output.stat().st_size
tp = restored_size / (decompress_ms / 1000)
print(f"  Decompressed: {fmt_bytes(restored_size)} in {fmt_time(decompress_ms)}  ({fmt_bytes(tp)}/s)")

# Final verification
t0 = time.perf_counter()
restored_md5 = hashlib.md5(final_output.read_bytes()).hexdigest()
verify_ms = (time.perf_counter() - t0) * 1000

match = restored_md5 == original_md5
print(f"  Restored MD5:  {restored_md5}")
print(f"  Original MD5:  {original_md5}")
print(f"  {'MATCH ✓ — pipeline verified end-to-end' if match else 'MISMATCH ✗ — data corrupted'}")
```

      Merged 8 chunks in 283ms
      Decompressed: 1.19 GB in 1.7s  (733.7 MB/s)
      Restored MD5:  054b516bca00fe7ebcfeb6516a5d3789
      Original MD5:  054b516bca00fe7ebcfeb6516a5d3789
      MATCH ✓ — pipeline verified end-to-end

#### Parallel upload, merge, verify — pipeline summary

```python
# End-to-end pipeline timing summary
total_ms = compress_ms + split_ms + upload_ms + download_ms + merge_ms + decompress_ms + verify_ms
end_to_end_tp = orig_size / (total_ms / 1000)

print(f"  {'step':<20s} {'time':>10s} {'throughput':>14s}")
print(f"  {'compress (zstd 3)':<20s} {fmt_time(compress_ms):>10s} {fmt_bytes(orig_size / (compress_ms/1000))+ '/s':>14s}")
print(f"  {'split (8 chunks)':<20s} {fmt_time(split_ms):>10s} {fmt_bytes(comp_size / (split_ms/1000))+ '/s':>14s}")
print(f"  {'upload (parallel)':<20s} {fmt_time(upload_ms):>10s} {fmt_bytes(total_uploaded / (upload_ms/1000))+ '/s':>14s}")
print(f"  {'download (parallel)':<20s} {fmt_time(download_ms):>10s} {fmt_bytes(total_uploaded / (download_ms/1000))+ '/s':>14s}")
print(f"  {'verify checksums':<20s} {fmt_time(verify_ms):>10s} {'':>14s}")
print(f"  {'merge chunks':<20s} {fmt_time(merge_ms):>10s} {fmt_bytes(comp_size / (merge_ms/1000))+ '/s':>14s}")
print(f"  {'decompress (zstd)':<20s} {fmt_time(decompress_ms):>10s} {fmt_bytes(restored_size / (decompress_ms/1000))+ '/s':>14s}")
print(f"  {'':>20s} {'':>10s} {'':>14s}")
print(f"  {'TOTAL':<20s} {fmt_time(total_ms):>10s} {fmt_bytes(end_to_end_tp)+ '/s':>14s}")
print(f"  Original: {fmt_bytes(orig_size)}  Wire: {fmt_bytes(comp_size)}  Ratio: {ratio:.1f}x")
```

      step                       time     throughput
      compress (zstd 3)          5.2s     234.8 MB/s
      split (8 chunks)          675ms     649.8 MB/s
      upload (parallel)        1.0min       7.0 MB/s
      download (parallel)        4.7s      92.6 MB/s
      verify checksums           1.5s               
      merge chunks              283ms      1.51 GB/s
      decompress (zstd)          1.7s     733.7 MB/s
                                                    
      TOTAL                    1.3min      15.9 MB/s
      Original: 1.19 GB  Wire: 438.8 MB  Ratio: 2.8x

#### Cleanup pipeline files

```python
# Cleanup pipeline: local temp files + GCS blobs
blobs = list(gcs_client.list_blobs(BUCKET_NAME, prefix=PIPELINE_GCS_PREFIX))
print(f"  Deleting {len(blobs)} pipeline blobs...")
for blob in blobs:
    blob.delete()

shutil.rmtree(PIPELINE_DIR)
print(f"  Deleted {PIPELINE_DIR.name}/ local directory")
print("  Cleanup done")
```

      Deleting 8 pipeline blobs...
      Deleted pipeline/ local directory
      Cleanup done
