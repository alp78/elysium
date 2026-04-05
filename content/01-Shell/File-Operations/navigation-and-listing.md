---
title: "Navigation and Listing"
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell]
aliases: [ls, du, df, directory listing, disk usage, disk free, tree command]
keywords: [ls, du, df, tree, directory listing, disk usage, disk space, file sizes, hidden files, human readable, sort by time, modification time, disk free, filesystem, navigation]
description: "Linux and PowerShell commands for navigating the filesystem, listing files sorted by modification time, checking disk usage with du, and monitoring free disk space with df. Includes the du vs df discrepancy explained."
parent: "[[domain-file-operations]]"
links:
  - "[[reading-file-contents]]"
  - "[[grep-and-pattern-matching]]"
  - "[[awk-data-processing]]"
  - "[[sed-stream-editing]]"
  - "[[date-and-time-handling]]"
  - "[[finding-files]]"
  - "[[file-manipulation]]"
  - "[[compression]]"
  - "[[data-transfer]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Navigation and Listing — Seeing What You Have

> [!quote]
> "UNIX is basically a simple operating system, but you have to be a genius to understand the simplicity."
>
> — **Dennis Ritchie**, attributed remark (c. 1980s)
>
> "I think the major good idea in Unix was its clean and simple interface: open, close, read, and write."
>
> — **Ken Thompson**, *Coders at Work* interview (2009)

The `ls` command is your window into the file system. The flags you choose determine whether you see just filenames or a complete picture of sizes, permissions, ownership, and modification times. As a data engineer you regularly deal with directories containing gigabytes of data — the right listing command tells you what changed, what's consuming space, and whether a pipeline produced what it should.

## Linux navigation and listing tools

Linux provides `ls` for directory listing, `tree` for visual structure, `du` for measuring disk consumption, and `df` for monitoring free space. In data engineering, you use these constantly to verify pipeline output, diagnose disk pressure, and track what changed between runs.

### Linux | ls | list files and directories

`ls` is the primary directory listing tool. The flags you combine determine how much information is shown: size, permissions, ownership, timestamps, and hidden files. The default `ls` output is sorted alphabetically — almost never what you want in a data directory.

#### List files sorted by modification time

`-lhrt` combines four flags: `-l` (long format with permissions, owner, size, date), `-h` (human-readable sizes like 1.2G instead of raw bytes), `-r` (reverse sort order), and `-t` (sort by modification time). Combined, the most recently modified file appears last — right at the bottom of your terminal next to your cursor.

```bash
ls -lhrt
```

#### Show hidden files

`-a` includes entries starting with `.` — the convention Unix uses to hide files. In data engineering directories, critical files like `.env`, `.git/`, `.dockerignore`, and `.dbt/` are all hidden by default. If a pipeline cannot find its config, check hidden files first.

```bash
ls -la
```

#### List only directories

`-d` tells `ls` to list the directory entry itself rather than its contents. Combined with the `*/` glob, this shows only directories in the current path — useful for surveying project structure without file noise.

```bash
ls -d */
```

#### Sort files by size

`-S` sorts by file size, largest first. Combine with `-lh` for human-readable output. Useful for quickly identifying what is consuming the most space in a directory.

```bash
ls -lhS
```

| Flag | Syntax | Description |
|------|--------|-------------|
| `-l` | `ls -l` | Long format: permissions, owner, size, date, name |
| `-h` | `ls -lh` | Human-readable sizes (requires `-l`) |
| `-r` | `ls -r` | Reverse sort order |
| `-t` | `ls -t` | Sort by modification time (newest first) |
| `-S` | `ls -S` | Sort by file size (largest first) |
| `-a` | `ls -a` | Include hidden files (dotfiles) |
| `-A` | `ls -A` | Like `-a` but excludes `.` and `..` |
| `-d` | `ls -d */` | List directory entries themselves, not their contents |
| `-R` | `ls -R` | Recursive listing |
| `-i` | `ls -i` | Show inode numbers |
| `-1` | `ls -1` | One file per line (useful for piping) |

> [!danger] Never parse ls output in scripts
>
> `ls` output is designed for humans, not programs. Filenames containing spaces, newlines,
> or glob characters break any script that parses `ls`. Instead:
> - **Loop over files:** `for f in *.csv; do ...` (shell glob — safe)
> - **Find files programmatically:** `find . -name "*.csv" -print0 | xargs -0 ...`
> - **Get file metadata in scripts:** `stat --format='%s %n' *` instead of parsing `ls -l`
>
> See [defensive-scripting](https://alp78.github.io/elysium/01-Shell/Scripting/defensive-scripting) for robust file-handling patterns.

> [!success] Use globs and find for programmatic file handling
>
> `for f in *.csv; do echo "$f"; done` is safe against any filename. `find . -name "*.csv" -print0 | xargs -0 cmd` handles spaces and special characters correctly. Both are immune to the pitfalls of parsing `ls` output.

### Linux | tree | visualize directory structure

`tree` prints a recursive directory structure as an indented tree. It is not installed by default on minimal Linux images (Debian slim, Alpine, Docker base images) — install with `apt install tree` (Debian/Ubuntu) or `yum install tree` (RHEL/CentOS). In Docker environments without `tree`, use `find . -maxdepth 2 -type d` as a substitute. On Windows, `tree.com` is built in: `tree C:\data /F` prints the full tree including filenames.

#### Visual directory tree

`-L 2` limits recursion depth to 2 levels — essential for large repos and data directories. Without `-L`, `tree` recurses the entire subtree; on a directory with millions of partitioned Parquet files this produces unusable output and can take minutes.

```bash
tree -L 2 --dirsfirst
```

> [!tip] Limit tree depth with -L
>
> `-L 2` limits depth to 2 levels — essential for large repos. Without `-L`,
> `tree` recurses the entire subtree. On a data directory with millions of partitioned
> Parquet files this produces unusable output and can take minutes.

| Flag | Syntax | Description |
|------|--------|-------------|
| `-L` | `tree -L 2` | Limit recursion depth |
| `-d` | `tree -d` | Show directories only |
| `--dirsfirst` | `tree --dirsfirst` | List directories before files |
| `-h` | `tree -h` | Human-readable file sizes |
| `-a` | `tree -a` | Include hidden files |
| `-I` | `tree -I '*.log'` | Exclude files matching pattern |
| `--noreport` | `tree --noreport` | Suppress file/directory count at end |

### Linux | du + df | disk space investigation

The standard disk-full runbook starts with `du` to locate the largest consumers, then `ls` to identify specific files, then `df` to confirm how much free space remains. Run these three steps in order before taking any remediation action.

#### Find top space-consuming directories

`--max-depth=1` limits recursion to immediate subdirectories. `sort -rh` ranks by descending human-readable size. `head -10` keeps output manageable.

```bash
du -h --max-depth=1 /var/opt/mssql/ | sort -rh | head -10
```

#### List database files by size

`-lhS` combines long format, human-readable sizes, and sort-by-size. The `2>/dev/null` suppresses "no such file" errors when `.ndf` files do not exist.

```bash
ls -lhS /var/opt/mssql/data/*.mdf /var/opt/mssql/data/*.ndf 2>/dev/null
```

#### Check filesystem free space

Run this after `du` to confirm how much headroom remains. If `du` total and `df` used diverge significantly, see the discrepancy diagnosis section below.

```bash
df -h /var/opt/mssql/
```

> [!warning] SQL Server stops when disk is full
>
> SQL Server halts all writes when the data volume is full — transactions fail and the service may not restart cleanly. Monitor `df -h` on schedule and alert before reaching 85% usage.

> [!success] Set a disk-full alert before you need this runbook
>
> Configure a cron job or monitoring agent to alert at 80% disk usage. `df -h` in a cron script with a threshold check is a 5-line script that prevents the entire runbook above from ever being needed in production.

| Flag | Syntax | Description |
|------|--------|-------------|
| `-s` | `du -s dir/` | Summary: total only, no per-subdirectory breakdown |
| `-h` | `du -h dir/` | Human-readable sizes (K, M, G) |
| `--max-depth` | `du --max-depth=1 dir/` | Limit recursion depth |
| `-c` | `du -c dir/` | Print grand total at end |
| `-a` | `du -a dir/` | Include all files, not just directories |
| `--exclude` | `du --exclude='*.log' dir/` | Skip files matching pattern |

| Flag | Syntax | Description |
|------|--------|-------------|
| `-h` | `df -h` | Human-readable sizes |
| `-i` | `df -i` | Show inode usage instead of block usage |
| `-T` | `df -T` | Show filesystem type |
| `-t` | `df -t ext4` | Filter by filesystem type |
| `--total` | `df --total` | Print grand total row |

### Linux | du vs df | discrepancy diagnosis

`du` measures actual file sizes. `df` measures filesystem block allocation. These numbers frequently disagree — understanding why tells you which tool to trust and what action to take.

> [!warning] du vs df numbers don't match
>
> Three root causes:
> 1. **Deleted files still held open:** If a process has a file open and you delete it, `du` no longer counts it but `df` still does — the blocks are not freed until the process closes the file handle. This is the most common cause of "I deleted 20 GB of logs but disk space did not change."
> 2. **Filesystem metadata and reserved blocks:** ext4 reserves 5% for root by default. Reduce with `tune2fs -m 1 /dev/sda1` (set to 1%) on data-only volumes.
> 3. **Sparse files:** Files with holes (e.g., database pre-allocated files) report different sizes via `ls -l` (logical) vs `du` (actual blocks).

> [!success] Find deleted-but-held-open files with lsof
>
> `lsof +L1` lists all file descriptors with a link count below 1 — i.e., deleted files still held open by a process. Restarting the process (or fixing log rotation) releases the blocks and reclaims the space.

```bash
sudo lsof +L1 | grep deleted
```

#### Check inode usage

Running out of inodes produces the same "No space left on device" error as running out of disk blocks — but `df -h` shows plenty of free space. This happens on systems with millions of small files (e.g., `/tmp` full of lock files, or a logging directory with one file per request). The `IUse%` column reveals the condition.

```bash
df -i /var/opt/mssql/
```

> [!danger] Inode exhaustion looks like disk full
>
> Running out of inodes produces the same "No space left on device" error as running out of disk blocks — but `df -h` shows plenty of free space.

> [!success] Find the directory responsible for inode exhaustion
>
> `for d in /var/log /tmp /var/opt/mssql; do echo "$d: $(find $d -maxdepth 1 | wc -l) files"; done` shows which directory is generating the most file entries. Clean up or compress the offending log/temp directories.

> [!tip] ncdu interactive disk explorer
>
> `ncdu` (NCurses Disk Usage) provides an interactive, navigable view of disk consumption
> sorted by size. Far more efficient than running `du` repeatedly. Install with
> `apt install ncdu`, then run `ncdu /var/opt/mssql/`. Press `d` to delete directly from
> the interface (with confirmation).

## PowerShell navigation and listing tools

PowerShell provides `Get-ChildItem` for directory listing and `Get-PSDrive` for disk space monitoring. Unlike Unix `ls`, `Get-ChildItem` returns typed objects — you pipe `FileInfo` and `DirectoryInfo` objects, not text — which makes PowerShell immune to the filename-parsing pitfalls that affect bash `ls`.

### PowerShell | Get-ChildItem | list and inspect files

`Get-ChildItem` (aliases: `ls`, `dir`, `gci`) returns objects with properties including `Name`, `Length`, `LastWriteTime`, and `Mode`. These objects feed directly into `Sort-Object`, `Where-Object`, `Select-Object`, and `Measure-Object` without text parsing.

#### List files sorted by modification time

`Sort-Object LastWriteTime` sorts the file objects by their last write timestamp. Without `-Descending`, the oldest file appears first and the most recently modified file appears last — matching the `ls -lhrt` convention.

```powershell
Get-ChildItem -Path . | Sort-Object LastWriteTime
```

#### Display human-readable file sizes

PowerShell has no `-h` flag for human-readable sizes. Build a calculated property with `Select-Object` and a format expression using `if`/`elseif` to choose the right unit. This pattern is reusable anywhere byte counts need to be displayed cleanly.

```powershell
Get-ChildItem -Path . | Sort-Object Length -Descending |
    Select-Object Name, @{N='Size';E={
        if ($_.Length -ge 1GB) { "{0:N1} GB" -f ($_.Length/1GB) }
        elseif ($_.Length -ge 1MB) { "{0:N1} MB" -f ($_.Length/1MB) }
        else { "{0:N1} KB" -f ($_.Length/1KB) }
    }}, LastWriteTime
```

#### Show hidden and system files

By default `Get-ChildItem` skips hidden and system files entirely — unlike `ls` which only hides dotfiles. Use `-Force` to include everything, or `-Hidden` to return hidden items only.

```powershell
Get-ChildItem -Force
```

> [!warning] -Force required for hidden files
>
> `Get-ChildItem -Path ".env"` returns nothing if `.env` is hidden — no error, no
> output. You must use `Get-ChildItem -Force -Path ".env"`. This catches many people
> when debugging "file not found" issues on Windows.

> [!success] Check for hidden files when a config is "missing"
>
> Before concluding a file does not exist, always run `Get-ChildItem -Force` in the directory. Hidden system files and dotfiles are invisible to the default listing, causing silent "file not found" failures in pipeline scripts.

#### Calculate recursive directory size

Pipe recursive file objects into `Measure-Object -Sum` to total the `Length` property. The `-File` switch excludes directories, which have no meaningful `Length`. The result is in bytes — divide by `1GB` and round for a human-readable figure.

```powershell
$bytes = (Get-ChildItem -Path "C:\data\pipeline" -Recurse -File |
    Measure-Object -Property Length -Sum).Sum
[math]::Round($bytes / 1GB, 2)
```

> [!warning] -Filter vs -Include performance
>
> `-Filter` is applied by the filesystem provider during retrieval (fast). `-Include`
> retrieves everything first, then filters in PowerShell (slow). On directories with
> millions of files, `-Include "*.parquet"` can take 10x longer than
> `-Filter "*.parquet"`. Always prefer `-Filter` for single-pattern matching.

> [!success] Use -Filter for single-pattern filtering
>
> `Get-ChildItem -Recurse -Filter "*.parquet"` delegates filtering to the OS filesystem layer, making it orders of magnitude faster than `-Include` on large directories.

| Parameter | Syntax | Description |
|-----------|--------|-------------|
| `-Path` | `-Path "C:\dir"` | Target path |
| `-Recurse` | `-Recurse` | Recursive listing |
| `-Filter` | `-Filter "*.csv"` | Filter by pattern (filesystem-level, fast) |
| `-Include` | `-Include "*.csv"` | Include matching items (post-retrieval, slower) |
| `-Exclude` | `-Exclude "*.tmp"` | Exclude matching items |
| `-Force` | `-Force` | Include hidden and system files |
| `-Hidden` | `-Hidden` | Show only hidden items |
| `-File` | `-File` | Return only files (no directories) |
| `-Directory` | `-Directory` | Return only directories |
| `-Depth` | `-Depth 2` | Limit recursion depth |
| `-Name` | `-Name` | Return names only, not file objects |

### PowerShell | Get-PSDrive | check free disk space

`Get-PSDrive` returns PS drive objects including `Used` and `Free` byte counts. Filter to the `FileSystem` provider to exclude registry, certificate, and environment drives.

#### Check free disk space across all drives

Computed properties with `@{N=...; E=...}` convert raw byte values to GB rounded to one decimal place — equivalent to `df -h` output.

```powershell
Get-PSDrive -PSProvider FileSystem | Format-Table Name,
    @{N='Used(GB)';E={[math]::Round($_.Used/1GB,1)}},
    @{N='Free(GB)';E={[math]::Round($_.Free/1GB,1)}}
```

| Parameter | Syntax | Description |
|-----------|--------|-------------|
| `-PSProvider` | `-PSProvider FileSystem` | Filter to a specific provider type |
| `-Name` | `-Name C` | Return a specific drive by name |

For continuous disk and resource monitoring beyond manual `du`/`df` checks, see [system-resources](https://alp78.github.io/elysium/01-Shell/Process-Management/system-resources) which covers `vmstat`, `iostat`, and automated alerting patterns.

## Related
- [file-manipulation](https://alp78.github.io/elysium/01-Shell/File-Operations/file-manipulation) — copying, moving, permissions, and safe delete patterns
- [finding-files](https://alp78.github.io/elysium/01-Shell/File-Operations/finding-files) — surgical search for specific files across large trees
- [reading-file-contents](https://alp78.github.io/elysium/01-Shell/Text-Processing/reading-file-contents) — what to do once you find the file
- [compression](https://alp78.github.io/elysium/01-Shell/File-Operations/compression) — reduce disk usage with gzip, zstd, and tar
