---
type: concept
category: foundations
technology: [bash, powershell, gcp]
tags: [shell, bash, gcp]
aliases: [rsync, scp, gcloud scp, gsutil, gcloud storage, bcp, sqlcmd export, file transfer, data movement]
keywords: [rsync, scp, gcloud compute scp, gsutil, gcloud storage, bcp, sqlcmd, file transfer, data movement, trailing slash, resume transfer, delta transfer, parallel transfer, bandwidth limit, checksum, GCS upload, GCS sync, SQL Server export, CSV export, bulk copy, parallel bcp, bwlimit, rsync exclude, dry run]
description: "Complete guide to data transfer tools for data engineering: rsync for local and remote transfers, scp for quick copies, gcloud compute scp for GCE VMs, gsutil and gcloud storage for GCS, bcp for SQL Server bulk export/import, and sqlcmd for query-based export."
related: ["[[iap-tunneling]]", "[[connecting-to-gcp-resources]]", "[[compression]]", "[[file-manipulation]]" ]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Data Transfer — Moving and Copying Data Across Machines

Copying a file on a single machine is trivial. Copying 50 GB of pipeline output from a Compute Engine VM to your workstation, synchronizing a directory tree between two servers, or uploading a database backup to Cloud Storage — that is where the tool choice and flags determine whether the transfer takes 5 minutes or 5 hours, and whether a network interruption means starting over or resuming cleanly.

## rsync — The Gold Standard for File Transfer

`rsync` is the most important file transfer tool in data engineering. It transfers only the differences between source and destination (delta transfer), supports compression, preserves all metadata, and resumes interrupted transfers automatically. If you learn one transfer tool, learn rsync.

**Linux — local copies:**

```bash
# Basic local copy (use rsync instead of cp for anything non-trivial)
rsync -av source_dir/ dest_dir/
# -a = archive mode — the single most important flag. Equivalent to -rlptgoD:
#   -r = recursive (descend into directories)
#   -l = copy symlinks as symlinks (not as the files they point to)
#   -p = preserve permissions (chmod settings)
#   -t = preserve modification times (critical for change detection pipelines)
#   -g = preserve group ownership
#   -o = preserve owner (requires root for other users' files)
#   -D = preserve device and special files
# -v = verbose (print each file as it transfers — useful for progress tracking)
#
# CRITICAL: the trailing slash on source_dir/ matters!
# rsync source_dir/  dest_dir/  → copies CONTENTS of source_dir into dest_dir
# rsync source_dir   dest_dir/  → copies source_dir ITSELF into dest_dir (creates dest_dir/source_dir/)

# With compression and progress bar (the standard for large transfers)
rsync -avz --progress source_dir/ dest_dir/
# -z = compress data during transfer (reduces bandwidth, adds CPU overhead)
#   Use -z for: network transfers (remote machines, slow links)
#   Skip -z for: local copies, fast networks (10Gbps LAN), already-compressed files (.gz, .parquet)
# --progress = show per-file transfer progress (bytes transferred, speed, ETA)

# Human-readable progress (better for large transfers)
rsync -avzh --progress source_dir/ dest_dir/
# -h = human-readable numbers (1.2G instead of 1289748480)

# Transfer with overall progress (not per-file)
rsync -avzh --info=progress2 source_dir/ dest_dir/
# --info=progress2 = single progress bar for the entire transfer
#   Shows: total bytes transferred, percentage, speed, ETA
#   Much cleaner than --progress when copying thousands of small files

# Resume an interrupted transfer (rsync does this automatically)
rsync -avzP source_dir/ dest_dir/
# -P = --partial + --progress combined
# --partial = keep partially transferred files (don't delete on interruption)
#   Without --partial: if the transfer is interrupted, the partial file is DELETED
#   With --partial: the partial file is kept, and rsync resumes from where it left off
#   This is essential for large files over unreliable connections

# Dry run — preview what would happen without doing anything
rsync -avzn source_dir/ dest_dir/
# -n = dry run (also: --dry-run)
# Shows every file that WOULD be transferred, without actually transferring
# ALWAYS do a dry run before large or destructive syncs

# Delete files in destination that don't exist in source (mirror mode)
rsync -avz --delete source_dir/ dest_dir/
# --delete = remove files from dest that no longer exist in source
# WARNING: This is destructive. A wrong source path = empty directory = deletes everything in dest.
# ALWAYS use -n (dry run) first:
rsync -avzn --delete source_dir/ dest_dir/
# Verify the list of "deleting X" lines before running without -n

# Exclude files or patterns
rsync -avz --exclude='*.log' --exclude='__pycache__/' source_dir/ dest_dir/
# --exclude = skip files matching this pattern
# Common excludes for pipeline directories:
#   '*.log'           — log files (regenerated, large)
#   '__pycache__/'    — Python bytecode cache
#   '.git/'           — git history (use git clone instead)
#   'node_modules/'   — npm packages (use npm install instead)
#   '*.tmp'           — temporary files

# Exclude from a file (cleaner for many excludes)
rsync -avz --exclude-from='rsync-excludes.txt' source_dir/ dest_dir/
# rsync-excludes.txt:
# *.log
# __pycache__/
# .git/
# *.tmp

# Include only specific file types
rsync -avz --include='*.parquet' --include='*/' --exclude='*' source_dir/ dest_dir/
# --include='*.parquet' = include parquet files
# --include='*/' = include directories (so rsync descends into them)
# --exclude='*' = exclude everything else
# ORDER MATTERS: includes are checked before excludes

# Bandwidth limit (don't saturate the network)
rsync -avz --bwlimit=50000 source_dir/ dest_dir/
# --bwlimit=50000 = limit to 50,000 KB/s (≈50 MB/s)
# Use when: syncing during business hours, sharing bandwidth with production traffic
# Units: KB/s by default. Use --bwlimit=50m for 50 MB/s (rsync 3.2.3+)

# Checksum-based comparison (slower but more reliable)
rsync -avc source_dir/ dest_dir/
# -c = compare files by checksum instead of modification time and size
# Default behavior: rsync skips files where size and mtime match (fast but can miss corrupted files)
# With -c: rsync computes checksums for every file (slower, but catches bit-rot and silent corruption)
# Use for: critical data, backup verification, compliance copies
```

## rsync Trailing Slash Gotcha

> [!warning] rsync Trailing Slash Gotcha
> This is the single most common rsync mistake:
> ```bash
> # Scenario: you want to sync /data/bronze/ to /backup/bronze/
>
> rsync -avz /data/bronze/ /backup/bronze/     # CORRECT: copies CONTENTS into /backup/bronze/
> rsync -avz /data/bronze  /backup/bronze/      # WRONG: creates /backup/bronze/bronze/ (nested!)
>
> # Rule: always put a trailing slash on the SOURCE to mean "copy contents, not the directory itself"
> # If you're ever unsure, use -n (dry run) first
> ```

**Linux — rsync over SSH (local ↔ remote):**

```bash
# Push: local → remote server
rsync -avzP /data/exports/ user@remote-server:/data/imports/
# rsync uses SSH by default for remote transfers
# The remote path is specified as user@host:/path

# Pull: remote server → local
rsync -avzP user@remote-server:/data/exports/ /local/data/

# With a specific SSH key
rsync -avzP -e "ssh -i ~/.ssh/gcp_key" /data/exports/ user@10.132.0.2:/data/imports/
# -e = specify the remote shell command
# "ssh -i ~/.ssh/gcp_key" = use this specific identity file for SSH authentication

# With a non-standard SSH port
rsync -avzP -e "ssh -p 2222" /data/ user@server:/data/
# -e "ssh -p 2222" = connect to SSH port 2222 instead of the default 22

# Through an IAP tunnel (GCE VMs with no public IP)
# Step 1: Open the IAP tunnel
gcloud compute start-iap-tunnel data-pipeline-sql 22 --local-host-port=127.0.0.1:2222 --zone=europe-west1-b &
# Step 2: rsync through the tunnel
rsync -avzP -e "ssh -p 2222" /data/exports/ user@127.0.0.1:/data/imports/
# The tunnel maps local port 2222 → VM port 22 (SSH)
# rsync connects to localhost:2222, which goes through IAP to the VM

# Alternative: use gcloud compute scp for simpler transfers (see below)
```

## rsync vs cp — When to Use Which

> [!tip] rsync vs cp — When to Use Which
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

**Linux:**

```bash
# Push a single file: local → remote
scp local_file.py user@remote-server:/tmp/
# Copies through SSH. Same authentication as ssh (keys, passwords).

# Pull a single file: remote → local
scp user@remote-server:/tmp/output.csv ./local/

# Recursive directory copy
scp -r local_dir/ user@remote-server:/tmp/
# -r = recursive (required for directories)
# WARNING: scp -r does NOT preserve symlinks, hardlinks, or special files
# WARNING: scp -r does NOT resume on interruption — starts from scratch
# For directories, prefer rsync -avzP

# With a specific SSH port
scp -P 2222 file.txt user@server:/tmp/
# -P (uppercase!) = port number
# Note: ssh uses lowercase -p, scp uses uppercase -P — a common gotcha

# With a specific SSH key
scp -i ~/.ssh/gcp_key file.txt user@10.132.0.2:/tmp/

# Preserve timestamps and permissions
scp -rp local_dir/ user@server:/tmp/
# -p (lowercase!) = preserve modification times, access times, and permissions
# Note: scp -p is NOT the same as scp -P (port). Case matters.

# Bandwidth limit
scp -l 50000 large_file.tar.gz user@server:/tmp/
# -l = limit bandwidth in Kbit/s (not KB/s!)
# 50000 Kbit/s ≈ 6.1 MB/s
# Note: rsync uses KB/s, scp uses Kbit/s — different units, same concept

# Copy between two remote hosts (through your local machine)
scp user@server1:/data/file.csv user@server2:/data/file.csv
# Your machine acts as the relay — data flows: server1 → you → server2
# For server-to-server copy without relay, SSH into server1 and scp from there
```

**PowerShell — pscp (PuTTY) or OpenSSH scp:**

```powershell
# Windows 10+ includes OpenSSH — scp works natively
scp .\local_file.py user@remote-server:/tmp/
scp user@remote-server:/tmp/output.csv .\local\

# Recursive with specific key
scp -r -i ~/.ssh/gcp_key ./local_dir/ user@10.132.0.2:/tmp/

# Or use gcloud compute scp (handles IAP automatically)
gcloud compute scp .\file.py data-pipeline-sql:/tmp/ --zone=europe-west1-b --tunnel-through-iap
gcloud compute scp --recurse .\local_dir\ data-pipeline-sql:/tmp/ --zone=europe-west1-b --tunnel-through-iap
```

## gcloud compute scp — GCE-Native File Transfer

`gcloud compute scp` wraps scp with automatic IAP tunneling, OS Login authentication, and zone resolution. It's the simplest way to move files to/from GCE VMs.

**Linux and PowerShell (identical commands):**

```bash
# Push: local → VM
gcloud compute scp local_file.py data-pipeline-sql:/tmp/ \
    --zone=europe-west1-b --tunnel-through-iap
# data-pipeline-sql = VM instance name (not IP address)
# :/tmp/ = destination path on the VM
# --tunnel-through-iap = route through IAP (no public IP required)

# Pull: VM → local
gcloud compute scp data-pipeline-sql:/var/opt/mssql/backups/data-pipeline.bak ./backups/ \
    --zone=europe-west1-b --tunnel-through-iap

# Multiple files
gcloud compute scp file1.py file2.py data-pipeline-sql:/tmp/ \
    --zone=europe-west1-b --tunnel-through-iap

# Recursive directory copy
gcloud compute scp --recurse ./dags/ data-pipeline-airflow:/tmp/dags/ \
    --zone=europe-west1-b --tunnel-through-iap
# --recurse = copy directory recursively (like scp -r)

# With compression
gcloud compute scp --compress large_file.csv data-pipeline-sql:/tmp/ \
    --zone=europe-west1-b --tunnel-through-iap
# --compress = enable SSH compression (useful for text/CSV, not for already-compressed files)

# Specify SSH key explicitly (rare — gcloud handles keys automatically)
gcloud compute scp --ssh-key-file=~/.ssh/custom_key file.txt data-pipeline-sql:/tmp/ \
    --zone=europe-west1-b --tunnel-through-iap
```

> [!warning] Gotcha — Permission Errors on gcloud scp
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

Google Cloud Storage (GCS) is the backbone for data lake storage, pipeline staging, and database backups. `gsutil` and `gcloud storage` are your tools for moving data in and out.

**Linux and PowerShell (identical commands):**

```bash
# Upload a single file
gsutil cp local_file.csv gs://data-pipeline-data-lake/bronze/
# cp = copy (same semantics as Unix cp)
# gs://bucket/path = GCS URI

# Upload with parallel composite upload (for files >150 MB)
gsutil -o GSUtil:parallel_composite_upload_threshold=150M cp large_file.parquet gs://data-pipeline-data-lake/silver/
# Splits the file into chunks, uploads in parallel, reassembles in GCS
# 5-10x faster for large files on high-bandwidth connections

# Download a file
gsutil cp gs://data-pipeline-data-lake/gold/scores.parquet ./local/

# Recursive directory upload
gsutil -m cp -r ./output/ gs://data-pipeline-data-lake/bronze/pipeline_run/
# -m = multithreaded (parallel transfers — significantly faster for many files)
# -r = recursive

# Sync a local directory to GCS (like rsync for the cloud)
gsutil -m rsync -r ./local_data/ gs://data-pipeline-data-lake/bronze/
# rsync = only transfer files that are new or changed (delta sync)
# -r = recursive
# DOES NOT delete remote files by default (safe)

# Sync with delete (mirror mode — use with caution)
gsutil -m rsync -r -d ./local_data/ gs://data-pipeline-data-lake/bronze/
# -d = delete remote files not present locally
# WARNING: same risk as rsync --delete — wrong source = deleted data
# ALWAYS do a dry run first:
gsutil -m rsync -r -d -n ./local_data/ gs://data-pipeline-data-lake/bronze/
# -n = dry run (shows what would be transferred/deleted)

# Copy between GCS buckets (server-side — no data flows through your machine)
gsutil -m cp -r gs://source-bucket/data/ gs://dest-bucket/data/
# This happens entirely inside Google's network — extremely fast
# No egress charges (same region), no bandwidth usage on your machine

# Move (rename) within GCS
gsutil mv gs://bucket/old_path/ gs://bucket/new_path/
# Server-side rename — instant for same-bucket operations

# New syntax: gcloud storage (faster, eventually replaces gsutil)
gcloud storage cp local_file.csv gs://data-pipeline-data-lake/bronze/
gcloud storage cp -r ./output/ gs://data-pipeline-data-lake/bronze/
gcloud storage rsync ./local_data/ gs://data-pipeline-data-lake/bronze/ --recursive
# gcloud storage uses the same flags but is 20-94% faster than gsutil for large transfers
# (uses the JSON API with resumable uploads by default)
```

## gsutil vs gcloud storage

> [!tip] gsutil vs gcloud storage
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

`bcp` (bulk copy program) transfers data between SQL Server and flat files at maximum throughput. It bypasses the query engine and writes directly to/from the storage layer. For loading millions of rows, bcp is 10-50x faster than INSERT statements.

**Linux:**

```bash
# Export table to CSV
bcp "SELECT * FROM gold.scores_daily" queryout scores.csv \
    -S 127.0.0.1,1435 -U sa -P "$SA_PASSWORD" -d data-pipeline \
    -c -t "," -r "\n"
# queryout = export a query result to file
# -S = server,port
# -U = username, -P = password, -d = database
# -c = character mode (text output, not binary)
# -t "," = field terminator (comma — makes it CSV)
# -r "\n" = row terminator (newline)

# Export to file with tab delimiter (TSV — safer than CSV for data with commas)
bcp data-pipeline.gold.scores_daily out scores.tsv \
    -S 127.0.0.1,1435 -U sa -P "$SA_PASSWORD" \
    -c -t "\t" -r "\n"
# out = export an entire table (faster than queryout — no query parsing)
# -t "\t" = tab delimiter

# Import CSV into a table
bcp data-pipeline.bronze.staging_data in data.csv \
    -S 127.0.0.1,1435 -U sa -P "$SA_PASSWORD" \
    -c -t "," -r "\n" -F 2 -b 10000 -e errors.log
# in = import from file to table
# -F 2 = skip the first row (header row — start from row 2)
# -b 10000 = batch size (commit every 10,000 rows — controls transaction size)
#   Small batch size = slower but uses less transaction log space
#   Large batch size = faster but needs more log space, bigger rollback on failure
# -e errors.log = log rejected rows to this file (invaluable for debugging bad data)

# Native format (fastest — binary, not human-readable)
bcp data-pipeline.gold.scores_daily out scores.bcp \
    -S 127.0.0.1,1435 -U sa -P "$SA_PASSWORD" \
    -n
# -n = native mode (binary format — preserves exact data types)
# Use for: SQL Server → SQL Server transfers (fastest possible)
# Cannot be opened in Excel or text editors

# With format file (for complex column mappings)
bcp data-pipeline.bronze.staging_data format nul \
    -S 127.0.0.1,1435 -U sa -P "$SA_PASSWORD" \
    -c -t "," -f staging_format.fmt
# format nul = generate a format file WITHOUT transferring data
# -f staging_format.fmt = output format file
# Edit the .fmt file to map CSV columns to table columns (skip columns, reorder, etc.)
# Then use: bcp ... in data.csv -f staging_format.fmt

# Parallel bcp (for very large tables — split and load simultaneously)
# Split the source into chunks and run multiple bcp processes:
bcp "SELECT * FROM gold.scores_daily WHERE index_key = 'index_europe'" queryout chunk1.csv ... &
bcp "SELECT * FROM gold.scores_daily WHERE index_key = 'index_usa'" queryout chunk2.csv ... &
bcp "SELECT * FROM gold.scores_daily WHERE index_key = 'index_asia'" queryout chunk3.csv ... &
wait
# Each process runs in parallel — 3x throughput on multi-core systems
```

**PowerShell:**

```powershell
# Same bcp.exe commands — bcp is a native Windows binary
bcp "SELECT * FROM gold.scores_daily" queryout scores.csv `
    -S "127.0.0.1,1435" -U sa -P $env:SA_PASSWORD -d data-pipeline `
    -c -t "," -r "\n"

# Import with error logging
bcp data-pipeline.bronze.staging_data in .\data.csv `
    -S "127.0.0.1,1435" -U sa -P $env:SA_PASSWORD `
    -c -t "," -F 2 -b 10000 -e .\errors.log

# Check row count after import
Invoke-Sqlcmd -ServerInstance "127.0.0.1,1435" -Database "data-pipeline" `
    -Username "sa" -Password $env:SA_PASSWORD -TrustServerCertificate `
    -Query "SELECT COUNT(*) AS loaded_rows FROM bronze.staging_data"
```

## sqlcmd — Query-Based Data Export

For smaller exports or custom query results, `sqlcmd` outputs directly to file.

**Linux:**

```bash
# Export query result to CSV
sqlcmd -S 127.0.0.1,1435 -U sa -P "$SA_PASSWORD" -d data-pipeline \
    -Q "SET NOCOUNT ON; SELECT * FROM gold.scores_daily" \
    -s "," -W -o scores.csv
# -Q = execute query and exit
# SET NOCOUNT ON = suppress "(N rows affected)" message in output
# -s "," = column separator (comma)
# -W = remove trailing spaces from columns
# -o scores.csv = output to file (instead of stdout)

# Export to CSV with headers only (no dashes separator line)
sqlcmd -S 127.0.0.1,1435 -U sa -P "$SA_PASSWORD" -d data-pipeline \
    -Q "SET NOCOUNT ON; SELECT * FROM gold.scores_daily" \
    -s "," -W -o scores.csv -k1
# -k1 = remove control characters (cleans up the output)
# Note: sqlcmd always adds a dash separator line under headers. To remove it:
# sed -i '2d' scores.csv   (delete line 2 — the dashes)
```

**PowerShell:**

```powershell
# Export to CSV (cleaner than sqlcmd — proper CSV with quoting)
Invoke-Sqlcmd -ServerInstance "127.0.0.1,1435" -Database "data-pipeline" `
    -Username "sa" -Password $env:SA_PASSWORD -TrustServerCertificate `
    -Query "SELECT * FROM gold.scores_daily" |
    Export-Csv -Path .\scores.csv -NoTypeInformation
# Export-Csv handles quoting, escaping, and headers properly
# -NoTypeInformation = don't add the #TYPE line at the top
```

## Transfer Decision Matrix

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
| SQL query → CSV (PowerShell) | `Invoke-Sqlcmd` | `Invoke-Sqlcmd -Query "..." \| Export-Csv` |
| VM → VM (no local relay) | SSH + rsync | SSH into source VM, rsync directly to dest VM |
| Database backup → GCS | `bcp` + `gsutil` | Export with bcp, then `gsutil cp backup.bak gs://bucket/` |

## Compression Trade-offs for Transfers

> [!tip] Compression Trade-offs
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

## Resumability Matters More Than Speed

> [!warning] For Transfers Over 1 GB, Resume Support Is Critical
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
- [[iap-tunneling]] — opening IAP tunnels for rsync and scp to GCE VMs
- [[compression]] — compress data before or during transfer
- [[connecting-to-gcp-resources]] — complete GCP connection guide including GCS
- [[file-manipulation]] — local file operations before transfer
