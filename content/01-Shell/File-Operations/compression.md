---
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell, bash]
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

#### gzip — the universal default

```bash
# gzip — the universal default
gzip data.csv                     # creates data.csv.gz, removes original
gzip -k data.csv                  # -k = keep the original file
gzip -9 data.csv                  # -9 = maximum compression (slower, smaller)
gzip -1 data.csv                  # -1 = fastest compression (quick, larger)
gzip -d data.csv.gz               # decompress (or: gunzip data.csv.gz)
gzip -l data.csv.gz               # show compression ratio without decompressing
```

#### zstd — modern replacement with better ratio and faster speed

```bash
# zstd — modern replacement, better ratio AND faster than gzip
zstd data.csv                     # creates data.csv.zst
zstd -19 data.csv                 # maximum compression (1-19 scale)
zstd -d data.csv.zst              # decompress
zstd --rm data.csv                # remove original after compressing
# zstd at level 3 (default) is faster than gzip at level 6, with a better ratio
# Use zstd for everything modern (Parquet, log archives, data transfers)
# Use gzip only when compatibility requires it (some tools don't support zstd yet)
```

#### tar — archiving and compression for directories

```bash
# tar — archiving + compression (directories into a single file)
tar czf archive.tar.gz /path/to/dir/
# c = create archive, z = gzip compression, f = filename follows
# Adds directory structure AND compresses in one step

tar xzf archive.tar.gz
# x = extract, z = decompress gzip, f = filename follows

tar xzf archive.tar.gz -C /output/dir/
# -C = change to this directory before extracting

# tar with zstd (better compression)
tar --zstd -cf archive.tar.zst /path/to/dir/
tar --zstd -xf archive.tar.zst

# List contents without extracting (verify before extract)
tar tzf archive.tar.gz | head -20
# t = list contents (test mode)
# ALWAYS list before extracting archives from unknown sources
```

## Compression Strategy Matrix

> [!tip] Related pattern
> For a broader comparison of serialization codecs (Snappy, gzip, zstd, LZ4) alongside file formats like Parquet and Avro, see [[serialization-formats]]. For writing Parquet with specific compression options in code, see [[10_py_serialization_formats]] (Python) and [[10_cs_serialization_formats]] (C#).

> [!tip] Compression Strategy for Data Pipelines
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

```powershell
# Compress-Archive (built-in, zip format only)
Compress-Archive -Path "C:\data\output\*" -DestinationPath "C:\data\output.zip"
Compress-Archive -Path file.txt -DestinationPath archive.zip -Update  # add to existing

# Expand-Archive
Expand-Archive -Path archive.zip -DestinationPath "C:\data\restored\" -Force
# -Force = overwrite existing files

# For gzip/zstd on Windows: install via scoop or use 7-Zip
7z a -tgzip archive.gz data.csv          # gzip
7z a -tzstd archive.zst data.csv         # zstd
7z x archive.gz                           # extract
7z l archive.tar.gz                       # list contents

# .NET GZipStream (programmatic gzip without external tools)
$input = [System.IO.File]::ReadAllBytes("data.csv")
$ms = [System.IO.MemoryStream]::new()
$gz = [System.IO.Compression.GZipStream]::new($ms, [System.IO.Compression.CompressionLevel]::Optimal)
$gz.Write($input, 0, $input.Length); $gz.Close()
[System.IO.File]::WriteAllBytes("data.csv.gz", $ms.ToArray())
```

When exporting data from BigQuery, the `bq extract --compression` flag accepts gzip and snappy for CSV/JSON exports -- see [[data-loading-and-export]] for the full syntax. If you are archiving compressed files to GCS cold storage tiers, compressing before upload saves significant storage cost -- see [[gcs-buckets-and-lifecycle]] for lifecycle policies that transition objects between storage classes.

## Related
- [[file-manipulation]] — moving and copying the resulting archives
- [[data-transfer]] — compression during rsync transfers (`-z` flag)
- [[navigation-and-listing]] — checking disk usage before and after compression
- [[finding-files]] — finding old archives to clean up
