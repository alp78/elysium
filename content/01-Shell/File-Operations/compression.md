---
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell, bash, linux, powershell]
aliases: [gzip, zstd, tar, compress, decompress, archive, zip, snappy]
keywords: [gzip, zstd, tar, compression, decompress, archive, zip, snappy, compress data, tar.gz, tar.zst, gz, compression algorithm, compression level, pipeline compression strategy, 7zip, GZipStream, Compress-Archive]
description: "Compression tools and strategies for data engineering: gzip for compatibility, zstd for performance, tar for directory archiving. Includes a compression strategy matrix for pipeline intermediate files, archives, Parquet, and database backups."
related: ["[[file-manipulation]]", "[[data-transfer]]", "[[navigation-and-listing]]", "[[finding-files]]" ]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Compression — Shrinking Data for Transfer and Storage

When you move data between systems (GCE VM to GCS, pipeline output to archive), compression is not optional — it directly affects transfer time, storage cost, and bandwidth consumption. Choosing the right compression algorithm is an engineering decision, not an aesthetic one.

## Linux — gzip, zstd, tar

#### gzip — compress and decompress files

> [!info] gzip overview
>
> gzip compresses a single file in place using the DEFLATE algorithm (RFC 1952). It is installed everywhere — every Linux distribution, every macOS, every CI runner. When compatibility is your only requirement, gzip is the safe choice. For better performance, see zstd below.

```bash
gzip data.csv
```

This creates `data.csv.gz` and **deletes the original**.

> [!warning] gzip removes the original file
>
> Running `gzip data.csv` deletes `data.csv` after compression — there is no confirmation prompt. If compression fails mid-write (disk full, interrupted), you lose both the original and the compressed file. Always use `-k` (keep) when compressing files you cannot re-create, or compress a copy instead.

```bash
gzip -k data.csv                  # keep the original file
gzip -d data.csv.gz               # decompress (or: gunzip data.csv.gz)
gzip -t data.csv.gz               # test integrity without decompressing
gzip -l data.csv.gz               # show compression ratio without decompressing
```

#### gzip -1 through -9 — compression level trade-offs

> [!info] Compression level trade-offs
>
> gzip supports compression levels 1 (fastest) through 9 (smallest). The default is **6**. On typical CSV/JSON pipeline data, the practical difference between -1 and -9 is only 5-15% in file size — but -9 takes 5-8x longer. For pipeline intermediate files where you compress and immediately transfer, `-1` is almost always the right choice.

```bash
gzip -1 data.csv                  # fastest compression (larger file, instant)
gzip -9 data.csv                  # maximum compression (smaller file, slow)
```

> [!tip] pigz parallel gzip
>
> gzip is **single-threaded**. On a 4-core VM compressing a 10GB CSV, gzip uses one core while three sit idle. Install `pigz` (parallel gzip) for multi-threaded compression that produces identical `.gz` files:
> ```bash
> pigz -p 4 data.csv               # compress using 4 threads
> pigz -d data.csv.gz              # decompress (also multi-threaded)
> unpigz data.csv.gz               # same as pigz -d
> ```
> `pigz` is a drop-in replacement — same flags, same output format, 3-4x faster on multi-core machines. Install: `apt install pigz`.

#### zstd — modern replacement with better ratio and faster speed

> [!info] zstd beats gzip on all metrics
>
> `zstd` compresses better than gzip **and** decompresses faster. Default level 3
> beats gzip level 6 in both ratio and speed. Scale goes 1-19 (plus `--ultra` for 20-22).
> Use zstd for everything modern — fall back to gzip only when tools require it.

```bash
zstd data.csv
zstd -d data.csv.zst
```

> [!info] zstd keeps the original file
>
> Unlike gzip, zstd **keeps the original file** by default. Use `--rm` to delete
> the original after compression (matching gzip behavior).

```bash
zstd -19 data.csv
zstd --rm data.csv
```

> [!tip] zstd --adapt auto-adjusting level
>
> `zstd --adapt` dynamically adjusts the compression level based on I/O speed. If the
> output pipe is slow (network transfer), it compresses harder. If the pipe is fast
> (local disk), it compresses lighter. Ideal for `zstd --adapt | gsutil cp - gs://...`
> streaming pipelines.

#### tar — archiving and compression for directories

> [!info] tar archive basics
>
> `tar` bundles a directory tree into a single file (archive), optionally
> compressed. Flags: `c` = create, `x` = extract, `t` = list, `z` = gzip, `f` = filename.
> gzip cannot compress directories on its own — `tar` + compression is the standard pattern.

```bash
tar czf archive.tar.gz /path/to/dir/
tar xzf archive.tar.gz -C /output/dir/
```

> [!tip] tar auto-detects compression
>
> You don't need `-z` (gzip) or `--zstd` when extracting — `tar xf archive.tar.gz` and
> `tar xf archive.tar.zst` both work. The compression flag is only needed when **creating**
> archives.

#### tar --zstd — archive with zstd compression (better than gzip)

```bash
tar --zstd -cf archive.tar.zst /path/to/dir/
tar xf archive.tar.zst
```

#### tar tf — list contents before extracting (safety check)

> [!danger] Tar bombs without top-level directory
>
> An archive created from `tar cf bomb.tar.gz *` (note: no parent directory) extracts
> files directly into your current directory, potentially overwriting files. Always list
> contents first with `tar tf` to verify structure before extracting.

```bash
tar tzf archive.tar.gz | head -20
```

### Compression strategy matrix — choosing the right algorithm for data pipelines

> [!tip] Related pattern
>
> For a broader comparison of serialization codecs (Snappy, gzip, zstd, LZ4) alongside file formats like Parquet and Avro, see [serialization-formats](/14-Data-Architecture/Pipeline-Patterns/serialization-formats). For writing Parquet with specific compression options in code, see [10_py_serialization_formats](/02-Programming-Languages/Python/10_py_serialization_formats) (Python) and [10_cs_serialization_formats](/02-Programming-Languages/CSharp/10_cs_serialization_formats) (C#).

> [!tip] Pipeline compression strategy
>
> | Scenario | Algorithm | Level | Why |
> |---|---|---|---|
> | Pipeline intermediate files | zstd | 3 (default) | Best speed/ratio balance, fast decompress |
> | Long-term archive to GCS | zstd | 19 | Maximum compression, storage cost matters |
> | Parquet files | snappy (internal) | default | Parquet uses snappy by default, fastest decompress |
> | Log shipping | gzip | 6 | Universal compatibility, all tools support it |
> | Database backup transfer | gzip | 1 | Fast compression, backup is already large |
>
> **The 90% rule:** For almost all data engineering work, `zstd` at default settings is the right answer. It compresses better than gzip, decompresses faster than gzip, and supports streaming. The only reason to use gzip is backward compatibility with tools that do not yet support zstd.

## PowerShell — Compress-Archive, 7-Zip, GZipStream

#### Compress-Archive — built-in zip compression

> [!info] Compress-Archive basics
>
> `Compress-Archive` creates zip files using .NET's `System.IO.Compression`.
> `-Update` adds files to an existing archive. `-Force` overwrites an existing archive.

```powershell
Compress-Archive -Path "C:\data\output\*" -DestinationPath "C:\data\output.zip"
Compress-Archive -Path file.txt -DestinationPath archive.zip -Update
```

> [!warning] 2 GB limit in PowerShell 5.1
>
> Windows PowerShell 5.1 (the default on Windows) uses .NET Framework's
> `System.IO.Compression` which caps individual file entries at 2 GB. PowerShell 7+
> removes this limit. For large files on Windows PS 5.1, use 7-Zip instead.

#### Expand-Archive — extract zip files

```powershell
Expand-Archive -Path archive.zip -DestinationPath "C:\data\restored\" -Force
```

#### 7-Zip — gzip, zstd, and tar on Windows

> [!info] 7-Zip on Windows
>
> 7-Zip (`7z`) supports every compression format. Install via
> `scoop install 7zip` or `winget install 7zip`. Use `l` to list archive contents
> before extracting (same safety habit as `tar tf`).

```powershell
7z a -tgzip archive.gz data.csv
7z a -tzstd archive.zst data.csv
7z x archive.gz
7z l archive.tar.gz
```

#### GZipStream — programmatic gzip without external tools

> [!info] GZipStream programmatic compression
>
> Use .NET's `GZipStream` when you need gzip compression in a PowerShell script
> without external dependencies. Reads the entire file into memory — not suitable for
> files larger than available RAM.

```powershell
$input = [System.IO.File]::ReadAllBytes("data.csv")
$ms = [System.IO.MemoryStream]::new()
$gz = [System.IO.Compression.GZipStream]::new(
    $ms, [System.IO.Compression.CompressionLevel]::Optimal)
$gz.Write($input, 0, $input.Length); $gz.Close()
[System.IO.File]::WriteAllBytes("data.csv.gz", $ms.ToArray())
```

When exporting data from BigQuery, the `bq extract --compression` flag accepts gzip and snappy for CSV/JSON exports -- see [data-loading-and-export](/06-GCP/BigQuery/data-loading-and-export) for the full syntax. If you are archiving compressed files to GCS cold storage tiers, compressing before upload saves significant storage cost -- see [gcs-buckets-and-lifecycle](/06-GCP/Storage/gcs-buckets-and-lifecycle) for lifecycle policies that transition objects between storage classes.

## Related
- [data-flow-architecture](/14-Data-Architecture/Pipeline-Patterns/data-flow-architecture) — format and compression selection by pipeline scenario
- [[file-manipulation]] — moving and copying the resulting archives
- [[data-transfer]] — compression during rsync transfers (`-z` flag)
- [[navigation-and-listing]] — checking disk usage before and after compression
- [[finding-files]] — finding old archives to clean up
