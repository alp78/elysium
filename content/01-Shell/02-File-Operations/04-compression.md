---
title: "04 - Compression"
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell]
aliases: [gzip, zstd, tar, compress, decompress, archive, zip, snappy]
keywords: [gzip, zstd, tar, compression, decompress, archive, zip, snappy, compress data, tar.gz, tar.zst, gz, compression algorithm, compression level, pipeline compression strategy, 7zip, GZipStream, Compress-Archive]
description: "Compression tools and selection patterns for Linux and PowerShell: gzip, pigz, zstd, lz4, tar, Compress-Archive, 7-Zip, and GZipStream."
created: 2026-03-22
updated: 2026-04-14
status: complete
---

# Compression

> [!quote]
> "There is no compression algorithm for experience."
>
> - **Andy Jassy**, AWS re:Invent keynote (2012)

> [!abstract]- Summary
>
> Covers the practical compression choices for Linux and PowerShell: `gzip` and `pigz` for `.gz` compatibility, `zstd` as the modern general-purpose codec, `lz4` for latency-sensitive reads, `tar` for directory trees, `Compress-Archive` for built-in ZIP output, `7-Zip` for explicit gzip workflows, and `.NET` `GZipStream` for scripted streaming compression.
>
> - `gzip` remains the safest interchange choice when downstream tooling expects `.gz`.
> - `pigz` keeps the gzip format while using multiple CPU cores.
> - `zstd` is usually the first format to benchmark for modern pipelines, but small inputs can invert the expected ratio advantage.
> - `tar` packages directory trees first; the compression algorithm wraps the tar stream.
> - `Compress-Archive` writes ZIP files only and inherits `ZipArchive` limits such as the 2 GB per-file cap and hidden-file omission.
> - `7-Zip` is reliable here for explicit gzip creation and archive inspection.
> - `GZipStream` is the in-process option when a PowerShell script needs gzip without shelling out.

> [!note]- Glossary
>
> **`gzip`**
>
> - Single-file DEFLATE compressor that writes the `.gz` format.
> - Use it when interoperability matters more than squeezing out the last percentage point of ratio.
> - `gzip file` replaces the source file; use `-k` or `-c` when the original must stay.
>
> ---
>
> **`pigz`**
>
> - Parallel implementation of gzip that emits standard `.gz` output.
> - Use it when you need gzip compatibility but do not want compression pinned to one CPU core.
> - The output format is still gzip, so decompression works with normal `gzip` tooling.
>
> ---
>
> **`zstd`**
>
> - Modern general-purpose compressor that usually balances ratio and throughput better than gzip on real pipeline payloads.
> - Use it for intermediate files and archives when both ends of the workflow support `.zst` or `.tar.zst`.
> - Benchmark representative data instead of assuming it always wins on tiny files.
>
> ---
>
> **`lz4`**
>
> - Very fast compressor with a weaker ratio than gzip or zstd.
> - Use it when decompression latency matters more than storage efficiency.
> - It is a poor default for long-term archives because the output is usually much larger.
>
> ---
>
> **`tar`**
>
> - Archiver that bundles a directory tree into one stream before optional compression.
> - Use it whenever the input is a directory rather than a single file.
> - `tar` does not compress by itself; pair it with `-z`, `--zstd`, or another codec switch.
>
> ---
>
> **`Compress-Archive`**
>
> - Built-in PowerShell cmdlet for creating ZIP archives.
> - Use it for Windows-native ZIP handoffs when a built-in tool is preferable to an external dependency.
> - It uses `System.IO.Compression.ZipArchive`, ignores hidden files and folders, and inherits the 2 GB per-file API limit.
>
> ---
>
> **`7-Zip`**
>
> - Multi-format archive tool exposed here through `C:\Program Files\7-Zip\7z.exe`.
> - Use it when Windows automation needs explicit gzip creation or archive inspection.
> - Validate less-common format switches such as standalone `.zst` creation on the target machine before standardizing on them.
>
> ---
>
> **`GZipStream`**
>
> - .NET stream type for reading and writing gzip data programmatically.
> - Use it inside PowerShell or C# when compression must stay in-process.
> - The memory profile depends on how you wire the streams; a streaming `CopyTo()` pattern avoids loading the full file into RAM.

Compression decisions split into two questions: are you compressing one file or a whole directory tree, and does compatibility matter more than throughput? The examples below keep those choices separate and show live output for each tool family.

## Linux compression workflows

### Linux | gzip and pigz | single-file gzip workflows

`gzip` is the compatibility baseline for Linux and Unix-like environments. `pigz` keeps the same `.gz` format but parallelizes compression work across CPU cores.

#### Compress a stream with `gzip`

`gzip -c` writes compressed bytes to stdout instead of replacing the source file. Piping the result into `wc -c` gives a fast way to compare output size without creating a file on disk.

```bash
gzip -c /etc/services | wc -c
```

```text
5379
```

#### Inspect a `.gz` file without extracting it

`gzip -l` reports compressed size, uncompressed size, and ratio for an existing gzip member. Use it when you need to estimate payload size or confirm that a file is actually gzip before decompressing it.

```bash
gzip -l /usr/share/man/man1/printf.1.gz
```

```text
         compressed        uncompressed  ratio uncompressed_name
               1273                2335  46.3% /usr/share/man/man1/printf.1
```

#### Keep the gzip format but parallelize compression with `pigz`

`pigz -c` emits the same gzip format as `gzip -c`. On the same input used above, the byte count is identical, which is why `pigz` works as a drop-in replacement for `.gz` workflows.

```bash
pigz -c /etc/services | wc -c
```

```text
5379
```

### Linux | zstd and lz4 | alternative single-file codecs

When downstream systems do not require `.gz`, compare a modern codec against gzip on representative data. Small files often behave differently from large CSV, JSON, or log batches because container overhead matters more.

#### Compress the same input with `zstd`

This command sends `/etc/services` through `zstd` at its default level and counts the compressed bytes. The result is close to gzip on this small input, which is exactly why ratio claims should be validated against real payloads.

```bash
zstd -cq /etc/services | wc -c
```

```text
5559
```

#### Compress the same input with `lz4`

`lz4` trades ratio for speed. The larger byte count here is expected and is usually acceptable only when decompression latency matters more than storage or network cost.

```bash
lz4 -cq /etc/services | wc -c
```

```text
8056
```

### Linux | tar | archive directory trees before compression

A directory tree has to be archived before it can be compressed as one unit. `tar` handles the packaging step; the codec flag determines how that tar stream is compressed.

#### Create a gzip-compressed tar stream

This example archives `/etc/hosts` and `/etc/services` into one gzip-compressed tar stream and measures the resulting byte count. The key point is that `tar` is operating on multiple paths, not on a single file.

```bash
tar -C /etc -czf - hosts services | wc -c
```

```text
5752
```

#### Create a zstd-compressed tar stream

`tar --zstd` swaps the compression algorithm while keeping the same archive structure. On this tiny two-file archive, the zstd-wrapped tar stream is slightly larger, which is a reminder to benchmark instead of assuming.

```bash
tar -C /etc --zstd -cf - hosts services | wc -c
```

```text
5982
```

Before extracting an archive you did not create, list it first with `tar -tf archive.tar.gz` or `tar -tf archive.tar.zst`. That check is cheap and prevents accidental extraction into the wrong directory.

## PowerShell compression workflows

### PowerShell | Compress-Archive | built-in ZIP output

`Compress-Archive` is the built-in choice for ZIP files on Windows. It is convenient for handoffs and ad hoc packaging, but it is not a general compression front end: it writes ZIP only, skips hidden items, and inherits the `ZipArchive` 2 GB per-file limit.

#### Create a ZIP archive with `Compress-Archive`

`-PassThru` makes the cmdlet emit the created archive object, which gives you immediate verification without a second command. `-CompressionLevel Fastest` is usually the right starting point for already structured data that will be moved again soon.

```powershell
Compress-Archive -Path "$PSHOME\pwsh.exe" -DestinationPath "$env:TEMP\vault-compression-demo.zip" -CompressionLevel Fastest -Force -PassThru | ForEach-Object { "{0}`t{1}" -f $_.Name, $_.Length }
```

```text
vault-compression-demo.zip	132805
```

### PowerShell | 7-Zip | explicit gzip workflows

When the workflow needs `.gz` rather than `.zip`, use the explicit 7-Zip binary path in automation. That avoids PATH ambiguity and makes it clear which tool is responsible for the archive format.

#### Create a gzip file with the explicit `7z.exe` path

This command writes a gzip member from `pwsh.exe` and filters the tool output down to the confirmation lines that matter in automation logs.

```powershell
& 'C:\Program Files\7-Zip\7z.exe' a -tgzip "$env:TEMP\vault-compression-demo.gz" "$PSHOME\pwsh.exe" | Select-String -Pattern 'Archive size:','Everything is Ok' | ForEach-Object { $_.Line.Trim() }
```

```text
Archive size: 104191 bytes (102 KiB)
Everything is Ok
```

#### List the member stored in that gzip file

`7z l` is the inspection step before extraction. Here it confirms that the gzip member contains `pwsh.exe` and reports both logical and compressed size.

```powershell
& 'C:\Program Files\7-Zip\7z.exe' l "$env:TEMP\vault-compression-demo.gz" | Select-String -Pattern 'Type = gzip','Name$','pwsh\.exe$' | ForEach-Object { $_.Line }
```

```text
Type = gzip
   Date      Time    Attr         Size   Compressed  Name
2026-03-12 03:11:00 .....       295456       104191  pwsh.exe
```

### PowerShell | GZipStream | scripted gzip

`GZipStream` is the right abstraction when compression needs to stay inside a PowerShell script. The important implementation detail is to connect input and output streams directly instead of materializing the whole file as one byte array.

#### Compress a file with stream-based `GZipStream`

This example opens the source file as a stream, copies it into a gzip stream, and emits the created `.gz` file information. The command stays in-process and avoids the `ReadAllBytes()` pattern that scales poorly on large files.

```powershell
$source = Join-Path $PSHOME 'pwsh.exe'; $target = Join-Path $env:TEMP 'vault-compression-gzipstream.gz'; $input = [System.IO.File]::OpenRead($source); $output = [System.IO.File]::Create($target); $gzip = [System.IO.Compression.GZipStream]::new($output, [System.IO.Compression.CompressionLevel]::Fastest); $input.CopyTo($gzip); $gzip.Dispose(); $output.Dispose(); $input.Dispose(); Get-Item $target | ForEach-Object { "{0}`t{1}" -f $_.Name, $_.Length }
```

```text
vault-compression-gzipstream.gz	132709
```

## Selecting the format

- Use `gzip` or `pigz` when the downstream contract is explicitly `.gz`, especially for logs and interchange files that must decompress everywhere.
- Use `zstd` for modern intermediate files and archives when both ends support it, then benchmark level and ratio on representative data before locking in a default.
- Use `lz4` when read latency or CPU budget dominates storage cost, such as hot local caches or very short-lived transport buffers.
- Use `tar` whenever the input is a directory tree; compression comes after archiving, not instead of it.
- Use `Compress-Archive` for built-in ZIP workflows on Windows, `7-Zip` for explicit gzip creation and inspection, and `GZipStream` when the compression step must stay inside script logic.

The examples above also show why blanket rules are risky. On the captured `/etc/services` and `/etc/{hosts,services}` samples, gzip produced slightly smaller outputs than zstd because the inputs were small enough for container overhead to dominate. Measure the data you actually ship.

## Cross-references

- [file-manipulation](https://alp78.github.io/elysium/01-Shell/02-File-Operations/02-file-manipulation) - moving, renaming, and cleaning up generated archives
- [finding-files](https://alp78.github.io/elysium/01-Shell/02-File-Operations/03-finding-files) - locating old archives and bulk-compressing matched files
- [data-transfer](https://alp78.github.io/elysium/01-Shell/02-File-Operations/05-data-transfer) - combining compression with remote copies and streaming transfers
