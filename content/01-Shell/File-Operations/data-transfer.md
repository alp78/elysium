---
type: concept
category: foundations
technology: [bash, powershell, gcp]
tags: [shell, bash, gcp, linux, powershell, sql-server]
aliases: [rsync, scp, gcloud scp, gsutil, gcloud storage, bcp, sqlcmd export, file transfer, data movement]
keywords: [rsync, scp, gcloud compute scp, gsutil, gcloud storage, bcp, sqlcmd, file transfer, data movement, trailing slash, resume transfer, delta transfer, parallel transfer, bandwidth limit, checksum, GCS upload, GCS sync, SQL Server export, CSV export, bulk copy, parallel bcp, bwlimit, rsync exclude, dry run]
description: "Complete guide to data transfer tools for data engineering: rsync for local and remote transfers, scp for quick copies, gcloud compute scp for GCE VMs, gsutil and gcloud storage for GCS, bcp for SQL Server bulk export/import, and sqlcmd for query-based export."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Data Transfer — Moving and Copying Data Across Machines

> [!quote]
> "Never underestimate the bandwidth of a station wagon full of tapes hurtling down the highway."
> — **Andrew S. Tanenbaum**

Copying a file on a single machine is trivial. Copying 50 GB of pipeline output from a Compute Engine VM to your workstation, synchronizing a directory tree between two servers, or uploading a database backup to Cloud Storage — that is where the tool choice and flags determine whether the transfer takes 5 minutes or 5 hours, and whether a network interruption means starting over or resuming cleanly.

## rsync — The Gold Standard for File Transfer

`rsync` is the most important file transfer tool in data engineering. It transfers only the differences between source and destination (delta transfer), supports compression, preserves all metadata, and resumes interrupted transfers automatically. If you learn one transfer tool, learn rsync.

#### rsync -av — local copies with archive mode

> [!info] rsync -a archive mode
>
> Equivalent to `-rlptgoD`:
> - `-r` — recursive (descend into directories)
> - `-l` — copy symlinks as symlinks
> - `-p` — preserve permissions
> - `-t` — preserve modification times (critical for change detection pipelines)
> - `-g` / `-o` — preserve group/owner
> - `-D` — preserve device and special files
>
> Add `-v` for verbose output, `-z` for compression during transfer (skip for local copies or already-compressed files), `--progress` for per-file progress.

> [!warning] Trailing slash matters
>
> - `rsync source_dir/ dest_dir/` → copies **contents** of `source_dir` into `dest_dir`
> - `rsync source_dir dest_dir/` → copies `source_dir` **itself** into `dest_dir` (creates `dest_dir/source_dir/`)

```bash
rsync -avzh --progress source_dir/ dest_dir/
```

> [!tip] Single progress bar with --info=progress2
>
> `--progress` prints per-file progress (noisy with thousands of small files).
> `--info=progress2` shows one aggregated progress bar with total bytes, percentage,
> speed, and ETA — much cleaner for large directory syncs.

```bash
rsync -avzh --info=progress2 source_dir/ dest_dir/
```

#### rsync -P — resume interrupted transfers

> [!tip] Resume with -P
>
> `-P` combines `--partial` + `--progress`. Without `--partial`, a partially
> transferred file is **deleted** on interruption — you start over. With `--partial`,
> the incomplete file is kept and rsync resumes from where it stopped. Essential for
> files over 1 GB on unreliable connections.

```bash
rsync -avzP source_dir/ dest_dir/
```

#### rsync -n — dry-run preview before destructive operations

> [!tip] Dry-run preview
>
> `-n` (or `--dry-run`) shows every file that **would** be transferred or
> deleted without actually doing anything. Always dry-run before `--delete` operations.

```bash
rsync -avzn source_dir/ dest_dir/
```

#### rsync --delete — mirror mode (destructive sync)

> [!danger] --delete is destructive
>
> `--delete` removes files from the destination that no longer exist in the
> source. If your source path is wrong (e.g., an empty directory), `--delete` wipes
> **everything** in the destination. Always dry-run first.

```bash
rsync -avzn --delete source_dir/ dest_dir/
rsync -avz --delete source_dir/ dest_dir/
```

#### rsync --exclude — filter files and patterns

> [!info] rsync --exclude patterns
>
> `--exclude` accepts glob patterns. For many exclusions, use `--exclude-from`
> with a file listing one pattern per line. For include-only workflows, combine
> `--include` + `--exclude='*'` — **order matters**: includes are evaluated before excludes.

```bash
rsync -avz --exclude='*.log' --exclude='__pycache__/' source_dir/ dest_dir/
rsync -avz --exclude-from='rsync-excludes.txt' source_dir/ dest_dir/
```

```bash
# Include only Parquet files (must include dirs for recursion)
rsync -avz --include='*.parquet' --include='*/' --exclude='*' source_dir/ dest_dir/
```

#### rsync --bwlimit — throttle bandwidth during business hours

> [!info] Throttle with --bwlimit
>
> `--bwlimit` caps transfer speed in KB/s. Prevents saturating a shared network
> link during working hours.

```bash
rsync -avz --bwlimit=50000 source_dir/ dest_dir/
```

#### rsync -c — checksum comparison for detecting bit-rot

> [!info] Checksum comparison with -c
>
> By default rsync compares mtime + file size to decide what to transfer. `-c`
> forces full checksum comparison — slower but catches silent corruption where the file
> size didn't change. Use for critical data like database backups.

```bash
rsync -avc source_dir/ dest_dir/
```

### rsync trailing slash — source path determines copy behavior

> [!warning] rsync trailing slash gotcha
> This is the single most common rsync mistake. The trailing slash on the **source** path changes what gets copied:
>
> ```bash
> rsync -avz /data/bronze/ /backup/bronze/   # CORRECT: copies CONTENTS into /backup/bronze/
> rsync -avz /data/bronze  /backup/bronze/   # WRONG: creates /backup/bronze/bronze/ (nested!)
> ```
>
> **Rule:** always put a trailing slash on the source to mean "copy contents, not the directory itself." If you're ever unsure, use `-n` (dry run) first.

#### rsync -avzP over SSH — local to remote and back

> [!info] rsync over SSH
>
> rsync uses SSH by default for remote transfers. The remote path syntax is
> `user@host:/path`. Use `-e` to customize the SSH command (specific key, non-standard
> port).

```bash
# Push: local → remote
rsync -avzP /data/exports/ user@remote-server:/data/imports/

# Pull: remote → local
rsync -avzP user@remote-server:/data/exports/ /local/data/
```

#### rsync -e — custom SSH key or non-standard port

> [!info] Custom SSH with -e
>
> `-e` specifies the remote shell command. Wrap SSH options in quotes.

```bash
rsync -avzP -e "ssh -i ~/.ssh/gcp_key" /data/exports/ user@10.132.0.2:/data/imports/
rsync -avzP -e "ssh -p 2222" /data/ user@server:/data/
```

#### rsync through IAP tunnel — transferring to GCE VMs with no public IP

> [!info] rsync through IAP tunnel
>
> Open an IAP tunnel to port 22 (SSH) on the VM, then point rsync at the
> local tunnel endpoint. The tunnel runs in the background (`&`). For simpler
> one-off transfers, use `gcloud compute scp` instead. For IAP tunnel details, see
> [iap-tunneling](https://alp78.github.io/elysium/01-Shell/Networking/iap-tunneling).

```bash
gcloud compute start-iap-tunnel data-pipeline-sql 22 \
    --local-host-port=127.0.0.1:2222 --zone=europe-west1-b &
rsync -avzP -e "ssh -p 2222" /data/exports/ user@127.0.0.1:/data/imports/
```

### rsync vs cp — when to use which

> [!tip] rsync vs cp decision matrix
>
> | Scenario | Use | Why |
> |----------|-----|-----|
> | Copy a single small file | `cp` | Simpler, faster startup |
> | Copy a directory locally | `rsync -av` | Preserves metadata, shows progress, resumable |
> | Copy large files (>1 GB) | `rsync -avP` | Resume on failure, progress tracking |
> | Sync directories (keep in sync) | `rsync -av --delete` | Delta transfer, only copies changes |
> | Copy to/from remote servers | `rsync -avzP` | Compression, resume, SSH built-in |
> | Copy inside Docker build | `COPY` directive | Docker layer caching |

## scp — Simple Remote Copy

`scp` (secure copy) is simpler than rsync but lacks delta transfer, resume, and progress for directories. Use it for quick one-off file transfers. For anything repeated or large, use rsync.

#### scp — push, pull, recursive copy over SSH

> [!info] scp basics
>
> `scp` copies files through SSH. Same authentication as `ssh` (keys, agent,
> passwords). Use for quick one-off file transfers. For anything large or repeated,
> prefer `rsync`.

```bash
scp local_file.py user@remote-server:/tmp/
scp user@remote-server:/tmp/output.csv ./local/
```

> [!warning] scp -r limitations
>
> `scp -r` does NOT preserve symlinks, hardlinks, or special files.
> It also does NOT resume on interruption — starts from byte 0. For directories,
> always prefer `rsync -avzP`.

```bash
scp -r local_dir/ user@remote-server:/tmp/
```

#### scp -P, -p, -i — port, preserve, and identity key

> [!warning] scp -P vs -p confusion
>
> `-P` (uppercase) = port number. `-p` (lowercase) = preserve timestamps.
> This is the opposite of `ssh` which uses lowercase `-p` for port. Mixing them up is
> one of the most common scp mistakes.

```bash
scp -P 2222 file.txt user@server:/tmp/
scp -rp local_dir/ user@server:/tmp/
scp -i ~/.ssh/gcp_key file.txt user@10.132.0.2:/tmp/
```

#### scp -l — bandwidth limit (in Kbit/s, not KB/s)

> [!warning] scp -l uses Kbit/s not KB/s
>
> `scp -l` uses **Kbit/s**, not KB/s. 50000 Kbit/s = ~6.1 MB/s. `rsync
> --bwlimit` uses KB/s. Confusing the units produces transfers 8x faster or slower
> than intended.

```bash
scp -l 50000 large_file.tar.gz user@server:/tmp/
```

#### scp remote-to-remote — relay through your machine

> [!info] scp remote-to-remote relays locally
>
> Copying between two remote hosts relays data through your local machine
> (server1 → you → server2). For direct server-to-server transfer, SSH into server1
> and `scp` from there.

```bash
scp user@server1:/data/file.csv user@server2:/data/file.csv
```

#### PowerShell scp — remote file transfer (Windows 10+ includes OpenSSH)

> [!info] scp on Windows via OpenSSH
>
> Windows 10+ ships with OpenSSH — `scp` works natively from PowerShell. Same
> syntax as Linux with backslash paths or forward slashes.

```powershell
scp .\local_file.py user@remote-server:/tmp/
scp -r -i ~/.ssh/gcp_key ./local_dir/ user@10.132.0.2:/tmp/
```

#### gcloud compute scp (PowerShell) — GCE VM transfer with automatic IAP

> [!info] gcloud compute scp on PowerShell
>
> Same as the Linux version. gcloud handles IAP tunneling and SSH key management
> automatically.

```powershell
gcloud compute scp .\file.py data-pipeline-sql:/tmp/ `
    --zone=europe-west1-b --tunnel-through-iap
gcloud compute scp --recurse .\local_dir\ data-pipeline-sql:/tmp/ `
    --zone=europe-west1-b --tunnel-through-iap
```

## gcloud compute scp — GCE-Native File Transfer

`gcloud compute scp` wraps scp with automatic IAP tunneling, OS Login authentication, and zone resolution. It's the simplest way to move files to/from GCE VMs. For additional SSH and file transfer patterns on GCE, including OS Login and metadata SSH keys, see [vm-ssh-and-file-transfer](https://alp78.github.io/elysium/06-GCP/Compute/vm-ssh-and-file-transfer).

#### gcloud compute scp — push and pull files to/from GCE VMs

> [!info] gcloud compute scp usage
>
> Uses VM **instance name** (not IP). `--tunnel-through-iap` routes through
> Identity-Aware Proxy — no public IP required. gcloud handles SSH key management
> automatically.

```bash
# Push: local → VM
gcloud compute scp local_file.py data-pipeline-sql:/tmp/ \
    --zone=europe-west1-b --tunnel-through-iap

# Pull: VM → local
gcloud compute scp data-pipeline-sql:/var/opt/mssql/backups/data-pipeline.bak ./backups/ \
    --zone=europe-west1-b --tunnel-through-iap
```

#### gcloud compute scp --recurse — copy directories to/from GCE VMs

> [!info] Recursive directory copy with --recurse
>
> `--recurse` copies directories recursively (like `scp -r`). Add `--compress`
> for text/CSV files — SSH-level compression that helps on slow connections but wastes
> CPU on already-compressed formats (Parquet, gzip).

```bash
gcloud compute scp --recurse ./dags/ data-pipeline-airflow:/tmp/dags/ \
    --zone=europe-west1-b --tunnel-through-iap
```

> [!warning] Permission errors on gcloud scp
>
> `gcloud compute scp` logs in as your OS Login username, which may not have write access to the target directory:
> ```bash
> # Fails: /opt/airflow/dags/ is owned by UID 50000
> gcloud compute scp dag.py data-pipeline-airflow:/opt/airflow/dags/ --zone=europe-west1-b --tunnel-through-iap
> # ERROR: Permission denied
>
> # Fix: scp to /tmp/, then SSH in and sudo mv
> gcloud compute scp dag.py data-pipeline-airflow:/tmp/ --zone=europe-west1-b --tunnel-through-iap
> gcloud compute ssh data-pipeline-airflow --zone=europe-west1-b --tunnel-through-iap \
>     --command="sudo cp /tmp/dag.py /opt/airflow/dags/ && sudo chown 50000:0 /opt/airflow/dags/dag.py"
> ```

## gsutil and gcloud storage — Cloud Storage Transfers

Google Cloud Storage (GCS) is the backbone for data lake storage, pipeline staging, and database backups. `gsutil` and `gcloud storage` are your tools for moving data in and out. For the full range of GCS object operations including parallel composite uploads and signed URLs, see [gcs-object-operations](https://alp78.github.io/elysium/06-GCP/Storage/gcs-object-operations).

#### gsutil cp, gsutil rsync — upload and sync to Cloud Storage

#### gsutil cp — upload and download single files

> [!info] gsutil cp basics
>
> `gsutil cp` follows Unix `cp` semantics. `gs://bucket/path` is the GCS URI.
> Add `-m` for multithreaded parallel transfers (significantly faster for many files).

```bash
gsutil cp local_file.csv gs://data-pipeline-data-lake/bronze/
gsutil cp gs://data-pipeline-data-lake/gold/scores.parquet ./local/
```

#### gsutil -m cp -r — parallel recursive directory upload

> [!info] Parallel recursive upload
>
> `-m` enables multithreaded transfers. `-r` recurses into subdirectories. For
> files over 150 MB, enable parallel composite uploads to split the file into chunks
> and upload them simultaneously — 5-10x faster on high-bandwidth connections.

```bash
gsutil -m cp -r ./output/ gs://data-pipeline-data-lake/bronze/pipeline_run/
```

```bash
# Parallel composite upload for large files
gsutil -o GSUtil:parallel_composite_upload_threshold=150M \
    cp large_file.parquet gs://data-pipeline-data-lake/silver/
```

#### gsutil rsync — delta sync to Cloud Storage

> [!info] gsutil rsync delta sync
>
> `gsutil rsync` transfers only new or changed files (like `rsync` for the cloud).
> Without `-d`, it never deletes remote files — safe by default.

```bash
gsutil -m rsync -r ./local_data/ gs://data-pipeline-data-lake/bronze/
```

> [!danger] gsutil rsync -d is destructive
>
> `gsutil rsync -d` deletes remote files not present locally.
> Same risk as `rsync --delete` — a wrong source path or empty directory wipes the
> destination. Always dry-run first with `-n`:

```bash
gsutil -m rsync -r -d -n ./local_data/ gs://data-pipeline-data-lake/bronze/
```

#### gsutil cp gs:// gs:// — server-side copy between GCS buckets

> [!info] Server-side GCS copy
>
> Copying between GCS buckets happens entirely inside Google's network — no data
> flows through your machine. No egress charges for same-region copies. Extremely fast
> regardless of file size.

```bash
gsutil -m cp -r gs://source-bucket/data/ gs://dest-bucket/data/
gsutil mv gs://bucket/old_path/ gs://bucket/new_path/
```

#### gcloud storage — modern replacement for gsutil (20-94% faster)

> [!info] gcloud storage replaces gsutil
>
> `gcloud storage` is the Go-based replacement for Python-based `gsutil`. Same
> semantics, faster execution, resumable uploads by default. Prefer for new scripts.

```bash
gcloud storage cp local_file.csv gs://data-pipeline-data-lake/bronze/
gcloud storage cp -r ./output/ gs://data-pipeline-data-lake/bronze/
gcloud storage rsync ./local_data/ gs://data-pipeline-data-lake/bronze/ --recursive
```

### gsutil vs gcloud storage — choosing between legacy and modern CLI

> [!tip] gsutil vs gcloud storage
>
> `gsutil` is the legacy tool (Python-based, slower). `gcloud storage` is the modern replacement (Go-based, faster, same flags). Both work, but prefer `gcloud storage` for new scripts:
>
> | Feature | gsutil | gcloud storage |
> |---------|--------|----------------|
> | Speed | Baseline | 20-94% faster |
> | Resumable uploads | Manual config | Default |
> | Parallel transfers | `-m` flag | Built-in |
> | Syntax | `gsutil cp` | `gcloud storage cp` |
> | Status | Maintenance | Active development |

## bcp — SQL Server Bulk Copy

`bcp` (bulk copy program) transfers data between SQL Server and flat files at maximum throughput. It bypasses the query engine and writes directly to/from the storage layer. For loading millions of rows, bcp is 10-50x faster than INSERT statements. In a medallion architecture, bcp imports typically feed the [bronze layer](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/bronze-layer-loading) before transformation begins.

#### bcp — bulk copy export and import (Linux)

> [!info] bcp flags reference
>
> - **Direction:** `queryout` (export query result), `out` (export table — faster), `in` (import from file)
> - `-S` — server,port | `-U` — username | `-P` — password | `-d` — database
> - `-c` — character mode (text) | `-n` — native mode (binary, fastest for SQL→SQL)
> - `-t ","` — field terminator | `-r "\n"` — row terminator
> - `-F 2` — skip header row (start from row 2)
> - `-b 10000` — batch size (small = less log space, large = faster)
> - `-e errors.log` — log rejected rows (invaluable for debugging bad data)

#### bcp queryout — export a query result to CSV

```bash
bcp "SELECT * FROM gold.scores_daily" queryout scores.csv \
    -S 127.0.0.1,1435 -U sa -P "$SA_PASSWORD" -d data-pipeline \
    -c -t "," -r "\n"
```

#### bcp out — export a full table (faster than queryout)

> [!tip] TSV for comma-containing data
>
> Use TSV (`-t "\t"`) instead of CSV when data contains commas. `out` exports
> the entire table without query parsing — faster than `queryout` for full-table exports.

```bash
bcp data-pipeline.gold.scores_daily out scores.tsv \
    -S 127.0.0.1,1435 -U sa -P "$SA_PASSWORD" \
    -c -t "\t" -r "\n"
```

#### bcp in — import CSV into a SQL Server table

> [!info] bcp import flags
>
> `-F 2` skips the header row (starts from row 2). `-b 10000` sets the batch
> size — smaller batches use less transaction log space. `-e errors.log` captures rejected
> rows with their line numbers and error details.

```bash
bcp data-pipeline.bronze.staging_data in data.csv \
    -S 127.0.0.1,1435 -U sa -P "$SA_PASSWORD" \
    -c -t "," -r "\n" -F 2 -b 10000 -e errors.log
```

> [!danger] bcp silently truncates data
>
> If a CSV field contains 500 characters but the target column is `VARCHAR(255)`, bcp
> **truncates the data without error or warning**. The import reports success, row counts
> match, but data is silently damaged. Always verify max field lengths before import:
> ```sql
> SELECT MAX(LEN(column_name)) FROM staging_table
> ```

> [!warning] bcp exit code 0 is misleading
>
> bcp returns exit code 0 even when rows are rejected. Always check the `-e` error log
> file AND compare row counts: `wc -l data.csv` vs `SELECT COUNT(*) FROM table`.

#### bcp -n — native binary format (fastest for SQL-to-SQL transfers)

> [!info] Native binary format with -n
>
> `-n` uses binary format — preserves exact data types with no text conversion.
> 2-5x faster than character mode. Cannot be opened in text editors. Use for SQL Server →
> SQL Server transfers only.

```bash
bcp data-pipeline.gold.scores_daily out scores.bcp \
    -S 127.0.0.1,1435 -U sa -P "$SA_PASSWORD" -n
```

#### bcp format — generate column mapping files

> [!info] bcp format files
>
> `format nul` generates a format file without transferring data. Edit the `.fmt`
> file to skip columns, reorder mappings, or handle schema differences. Then use
> `-f staging_format.fmt` on the actual import.

```bash
bcp data-pipeline.bronze.staging_data format nul \
    -S 127.0.0.1,1435 -U sa -P "$SA_PASSWORD" \
    -c -t "," -f staging_format.fmt
```

#### bcp parallel — split and load simultaneously for large tables

> [!info] Parallel bcp with background jobs
>
> Split the source by a partition key and run multiple `bcp` processes in
> background (`&`). Each process loads independently — 3x throughput on multi-core
> systems. Use `wait` to block until all complete.

```bash
bcp "SELECT * FROM gold.scores_daily WHERE index_key = 'index_europe'" queryout chunk1.csv \
    -S 127.0.0.1,1435 -U sa -P "$SA_PASSWORD" -d data-pipeline -c -t "," -r "\n" &
bcp "SELECT * FROM gold.scores_daily WHERE index_key = 'index_usa'" queryout chunk2.csv \
    -S 127.0.0.1,1435 -U sa -P "$SA_PASSWORD" -d data-pipeline -c -t "," -r "\n" &
wait
```

#### bcp — bulk copy export and import (PowerShell)

> [!info] bcp on PowerShell
>
> `bcp.exe` is a native Windows binary — same flags as Linux. Use `$env:SA_PASSWORD`
> for environment variables in PowerShell and backtick (`` ` ``) for line continuation.

```powershell
bcp "SELECT * FROM gold.scores_daily" queryout scores.csv `
    -S "127.0.0.1,1435" -U sa -P $env:SA_PASSWORD -d data-pipeline `
    -c -t "," -r "\n"
```

```powershell
bcp data-pipeline.bronze.staging_data in .\data.csv `
    -S "127.0.0.1,1435" -U sa -P $env:SA_PASSWORD `
    -c -t "," -F 2 -b 10000 -e .\errors.log
```

> [!tip] Verify row counts after import
>
> Always verify row count after bcp import — never trust the exit code alone.

```powershell
Invoke-Sqlcmd -ServerInstance "127.0.0.1,1435" -Database "data-pipeline" `
    -Username "sa" -Password $env:SA_PASSWORD -TrustServerCertificate `
    -Query "SELECT COUNT(*) AS loaded_rows FROM bronze.staging_data"
```

## sqlcmd — Query-Based Data Export

For smaller exports or custom query results, `sqlcmd` outputs directly to file.

#### sqlcmd -Q -o — query-based CSV export (Linux)

> [!info] sqlcmd export flags
>
> `-Q` executes the query and exits. `SET NOCOUNT ON` suppresses the
> "(N rows affected)" message that pollutes CSV output. `-s ","` sets the column
> separator. `-W` removes trailing spaces from columns. `-o` writes to file.

```bash
sqlcmd -S 127.0.0.1,1435 -U sa -P "$SA_PASSWORD" -d data-pipeline \
    -Q "SET NOCOUNT ON; SELECT * FROM gold.scores_daily" \
    -s "," -W -o scores.csv
```

> [!warning] sqlcmd dashes separator line
>
> Every sqlcmd CSV export contains a line of `---` dashes on row 2. This breaks CSV
> parsers. Remove it with `sed -i '2d' scores.csv` after export. Adding `-k1` removes
> control characters but does NOT remove the dashes line.

```bash
sed -i '2d' scores.csv
```

#### Invoke-Sqlcmd + Export-Csv — query-based CSV export (PowerShell)

```powershell
# Export to CSV (cleaner than sqlcmd — proper CSV with quoting)
Invoke-Sqlcmd -ServerInstance "127.0.0.1,1435" -Database "data-pipeline" `
    -Username "sa" -Password $env:SA_PASSWORD -TrustServerCertificate `
    -Query "SELECT * FROM gold.scores_daily" |
    Export-Csv -Path .\scores.csv -NoTypeInformation
# Export-Csv handles quoting, escaping, and headers properly
# -NoTypeInformation = don't add the #TYPE line at the top
```

### Transfer decision matrix — choosing the right tool by scenario

| Scenario | Tool | Command Pattern |
|----------|------|-----------------|
| Single file, local → local | `cp` | `cp file dest/` |
| Directory, local → local | `rsync` | `rsync -avh src/ dest/` |
| Large files, local → local | `rsync` | `rsync -avhP src/ dest/` |
| Any file, local → GCE VM | `gcloud scp` | `gcloud compute scp file vm:/path --tunnel-through-iap` |
| Directory, local → GCE VM | `gcloud scp` | `gcloud compute scp --recurse dir/ vm:/path --tunnel-through-iap` |
| Large directory, local ↔ VM | `rsync` + IAP | IAP tunnel on port 22 → `rsync -avzP -e "ssh -p 2222"` |
| Any file, local → GCS | `gcloud storage` | `gcloud storage cp file gs://bucket/path` |
| Directory, local → GCS | `gcloud storage` | `gcloud storage cp -r dir/ gs://bucket/path` |
| Sync directory → GCS | `gsutil rsync` | `gsutil -m rsync -r dir/ gs://bucket/path` |
| GCS → GCS (same region) | `gsutil cp` | `gsutil -m cp -r gs://src/ gs://dest/` (server-side, free) |
| SQL table → CSV file | `bcp` | `bcp table out file.csv -c -t ","` |
| CSV file → SQL table | `bcp` | `bcp table in file.csv -c -t "," -F 2 -b 10000` |
| SQL query → CSV file | `sqlcmd` | `sqlcmd -Q "SELECT ..." -s "," -W -o file.csv` |
| SQL query → CSV (PowerShell) | `Invoke-Sqlcmd` | `Invoke-Sqlcmd -Query "..." | Export-Csv` |
| VM → VM (no local relay) | SSH + rsync | SSH into source VM, rsync directly to dest VM |
| Database backup → GCS | `bcp` + `gsutil` | Export with bcp, then `gsutil cp backup.bak gs://bucket/` |

Once data lands in GCS, you can load it directly into BigQuery with `bq load` -- see [data-loading-and-export](https://alp78.github.io/elysium/06-GCP/BigQuery/data-loading-and-export) for format options and schema autodetection. For recurring transfers, schedule rsync or gsutil jobs with cron -- see [linux-scheduling](https://alp78.github.io/elysium/12-Orchestration/Scheduling/linux-scheduling) for crontab patterns.

### Compression trade-offs — when to use -z during transfers

> [!tip] Compression trade-offs
>
> Not all data benefits from transfer compression:
>
> | Data Type | Compress? | Why |
> |-----------|-----------|-----|
> | CSV, JSON, XML | Yes (`-z`) | Text compresses 5-10x — massive bandwidth savings |
> | Parquet, ORC | No | Already compressed internally — double compression wastes CPU |
> | .tar.gz, .zip | No | Already compressed — rsync -z adds CPU overhead with zero benefit |
> | SQL backups (.bak) | Depends | Use `WITH COMPRESSION` in the BACKUP command instead — done server-side |
> | Docker images (.tar) | Yes | Layers contain uncompressed filesystem data |
>
> When in doubt, test: `rsync -avz` vs `rsync -av` on a representative sample. If the compressed transfer isn't significantly faster, drop the `-z`.

### Resumability — why resume support matters more than raw speed

> [!warning] Resume support over raw speed
>
> For transfers over 1 GB, the ability to resume after failure is more valuable than raw speed. Here's why:
>
> A 50 GB file at 100 MB/s takes ~8 minutes. If the network drops at 90% completion:
> - **scp**: starts over from byte 0. Another 8 minutes.
> - **rsync -P**: resumes from byte 45 GB. About 50 seconds to finish.
> - **gcloud storage cp**: resumable by default. Re-run the same command.
> - **bcp**: no resume. Must re-export from scratch.
>
> Rule: for any transfer over 1 GB, use a tool with resume support (rsync, gcloud storage, or gsutil).

## Related
- [data-flow-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/data-flow-architecture) — complete data movement topology and tool selection framework
- [iap-tunneling](https://alp78.github.io/elysium/01-Shell/Networking/iap-tunneling) — opening IAP tunnels for rsync and scp to GCE VMs
- [compression](https://alp78.github.io/elysium/01-Shell/File-Operations/compression) — compress data before or during transfer
- [connecting-to-gcp-resources](https://alp78.github.io/elysium/01-Shell/Networking/connecting-to-gcp-resources) — complete GCP connection guide including GCS
- [file-manipulation](https://alp78.github.io/elysium/01-Shell/File-Operations/file-manipulation) — local file operations before transfer
