---
title: "01 - Navigation and Listing"
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell]
aliases: [ls, du, df, directory listing, disk usage, disk free, tree command]
keywords: [ls, du, df, tree, directory listing, disk usage, disk space, file sizes, hidden files, human readable, sort by time, modification time, disk free, filesystem, navigation]
description: "Linux and PowerShell commands for navigating the filesystem, listing files sorted by modification time, checking disk usage with du, and monitoring free disk space with df. Includes the du vs df discrepancy explained."
created: 2026-03-22
updated: 2026-04-15
status: complete
---

# Navigation and Listing

> [!quote]+
>
> "I think the major good idea in Unix was its clean and simple interface: open, close, read, and write."
>
> -- **Ken Thompson**, *Coders at Work* (2009)

> [!abstract]- Summary
>
> Linux and PowerShell answer the same operational questions with different command surfaces: what is in a path, what changed most recently, how much space is allocated, and how much capacity remains. This note shows `ls`, `tree`, `du`, `df`, `Get-ChildItem`, and `Get-PSDrive` with live outputs, plus the two discrepancies that matter most in practice: sparse files and deleted files still held open by a process.

> [!note]- Glossary
>
> **`ls`**
>
> - Lists directory entries and can sort by time, size, and visibility flags.
> - Use it for interactive inspection when you need a quick read of names, timestamps, and sizes.
> - Do not parse its output in scripts; use shell globs, `find -print0`, or `stat` instead.
>
> ---
>
> **`tree`**
>
> - Prints a recursive directory tree.
> - Use it to inspect project layout or data drops without opening each directory manually.
> - Always set a depth limit on large paths or fall back to `find` when `tree` is not installed.
>
> ---
>
> **`du`**
>
> - Reports allocated blocks consumed by files and directories.
> - Use it to identify which paths are actually consuming disk.
> - Its totals can diverge from `df` when deleted files remain open or when files are sparse.
>
> ---
>
> **`df`**
>
> - Reports filesystem-level capacity, used blocks, free blocks, and inode usage.
> - Use it after `du` to confirm whether the underlying filesystem still has headroom.
> - `df -h` shows block usage; `df -i` shows inode pressure, which can fail writes even when free blocks remain.
>
> ---
>
> **`ncdu`**
>
> - An interactive ncurses disk-usage browser that ranks directories by allocated size.
> - Use it after a `du` pass when you need faster drill-down through a large tree than repeated summaries provide.
> - Treat it as an optional follow-up rather than the baseline workflow here; it may be absent on minimal images.
>
> ---
>
> **Inode**
>
> - A filesystem record that stores metadata for one file or directory entry.
> - Use inode counts to diagnose "No space left on device" when `df -h` still shows free space.
> - Large populations of tiny files exhaust inodes long before they exhaust disk blocks.
>
> ---
>
> **Hidden file**
>
> - On Linux, a hidden file is usually a dotfile such as `.env`; on Windows, hidden status is a file attribute.
> - Hidden entries often contain configuration, cache, or state that matters during debugging.
> - `ls -a` and `Get-ChildItem -Force` solve different visibility rules; they are not interchangeable semantics.
>
> ---
>
> **`Get-ChildItem`**
>
> - Returns `FileInfo` and `DirectoryInfo` objects rather than plain text.
> - Use it when you want to sort, filter, and measure filesystem items without string parsing.
> - Prefer `-Filter` over `-Include` when one filesystem-level pattern is enough.
>
> ---
>
> **`Get-PSDrive`**
>
> - Returns PowerShell drive objects with `Used` and `Free` properties.
> - Use it as the PowerShell equivalent of `df` for filesystem drives.
> - Filter to `-PSProvider FileSystem` so registry and certificate drives do not pollute disk-capacity checks.

## Linux navigation and listing tools

The Linux examples below use a disposable fixture at `/tmp/elysium-nav-demo`. `ls` is for interactive inspection, `tree` is for bounded structure checks, `du` explains allocated usage, and `df` confirms what the filesystem can still accept.

### Linux | ls | inspect directory contents

Use `ls` to answer interactive questions quickly: what changed last, what is hidden, which entries are directories, and which files dominate a directory by size. For programmatic file handling, switch to `find`, shell globs, or `stat` instead of parsing display text.

#### List files sorted by modification time

`ls -lhrt` keeps long-format metadata, converts sizes to human-readable units, and reverses the default newest-first time sort so the newest file is last. The output makes it easy to confirm the latest pipeline artifact without losing permissions, owner, or timestamp detail.

*Run the commands in this section to list files sorted by modification time.*
```bash
ls -lhrt /tmp/elysium-nav-demo/data
```

```text
total 2.1M
-rw-r--r-- 1 alex alex 8.0K Apr 14 08:05 archive.log
-rw-r--r-- 1 alex alex  64K Apr 14 08:15 daily.csv
-rw-r--r-- 1 alex alex 2.0M Apr 14 08:25 latest.parquet
-rw-r--r-- 1 alex alex 128M Apr 14 08:30 sparse.bin
```

#### Reveal hidden dotfiles

`ls -la` includes dotfiles in the listing and keeps directory metadata visible. Use it first when a configuration file appears to be missing but the application insists the path exists.

*Run the commands in this section to reveal hidden dotfiles.*
```bash
ls -la /tmp/elysium-nav-demo
```

```text
total 32
drwxr-xr-x   5 alex alex  4096 Apr 14 10:03 .
drwxrwxrwt 187 root root 12288 Apr 14 10:03 ..
-rw-r--r--   1 alex alex    11 Apr 14 10:03 .env
drwxr-xr-x   2 alex alex  4096 Apr 14 10:03 data
drwxr-xr-x   2 alex alex  4096 Apr 14 10:03 logs
drwxr-xr-x   4 alex alex  4096 Apr 14 10:03 project
```

#### List only directories

`ls -d */` lists the directory entries themselves instead of their contents. That is useful when you want a quick survey of branches under a path without mixing in file noise.

*Run the commands in this section to list only directories.*
```bash
ls -d /tmp/elysium-nav-demo/*/
```

```text
/tmp/elysium-nav-demo/data/
/tmp/elysium-nav-demo/logs/
/tmp/elysium-nav-demo/project/
```

#### Sort files by size

`ls -lhS` is the quickest way to see which files dominate a directory. The listing below also shows why `ls` is not a disk-usage tool: `sparse.bin` has the largest logical size, but that does not mean it consumed 128 MB of blocks.

*Run the commands in this section to sort files by size.*
```bash
ls -lhS /tmp/elysium-nav-demo/data
```

```text
total 2.1M
-rw-r--r-- 1 alex alex 128M Apr 14 08:30 sparse.bin
-rw-r--r-- 1 alex alex 2.0M Apr 14 08:25 latest.parquet
-rw-r--r-- 1 alex alex  64K Apr 14 08:15 daily.csv
-rw-r--r-- 1 alex alex 8.0K Apr 14 08:05 archive.log
```

Use these `ls` flags as quick reference when adapting the examples.

| Flag | Syntax | Description |
|------|--------|-------------|
| `-l` | `ls -l` | Long format with permissions, owner, size, and timestamp columns |
| `-h` | `ls -lh` | Human-readable sizes |
| `-r` | `ls -r` | Reverse sort order |
| `-t` | `ls -t` | Sort by modification time |
| `-S` | `ls -S` | Sort by logical file size, largest first |
| `-a` | `ls -a` | Include dotfiles |
| `-A` | `ls -A` | Include dotfiles but omit `.` and `..` |
| `-d` | `ls -d */` | List directory entries themselves |
| `-R` | `ls -R` | Recurse into subdirectories |
| `-i` | `ls -i` | Show inode numbers |
| `-1` | `ls -1` | Print one entry per line |

### Linux | tree | inspect structure

`tree` is useful when the question is about shape rather than metadata. On minimal images it may be absent; if so, install it or fall back to `find`, but keep the recursion depth bounded.

#### Inspect a project tree without full recursion

`tree -L 2 --dirsfirst` surfaces the first two levels of a hierarchy and shows directories before files. That is enough to inspect project layout without dumping every nested artifact in a deep data path.

*Run the commands in this section to inspect a project tree without full recursion.*
```bash
tree -L 2 --dirsfirst /tmp/elysium-nav-demo
```

```text
/tmp/elysium-nav-demo
├── data
│   ├── archive.log
│   ├── daily.csv
│   ├── latest.parquet
│   └── sparse.bin
├── logs
│   ├── app.log
│   └── elysium-nav-deleted.pid
└── project
    ├── docs
    └── src

6 directories, 6 files
```

These `tree` options are the ones most likely to matter during routine inspection.

| Flag | Syntax | Description |
|------|--------|-------------|
| `-L` | `tree -L 2` | Limit recursion depth |
| `-d` | `tree -d` | Show directories only |
| `--dirsfirst` | `tree --dirsfirst` | Print directories before files |
| `-h` | `tree -h` | Show human-readable sizes |
| `-a` | `tree -a` | Include hidden files |
| `-I` | `tree -I '*.log'` | Exclude names that match a pattern |
| `--noreport` | `tree --noreport` | Suppress the final count summary |

### Linux | du | measure allocated disk usage

Use `du` when the question is "what actually consumed blocks on disk?" rather than "how large does the file look in a directory listing?" It is the right first step before any cleanup or capacity remediation. If you need interactive drill-down after the first ranking pass, `ncdu` is a useful follow-up where it is installed, but the executable baseline here stays with stock `du`.

#### Find the largest immediate directories

`du -h --max-depth=1 | sort -rh` ranks only the first level below the target path. That keeps the signal tight enough to identify the branch worth investigating next.

*Run the commands in this section to find the largest immediate directories.*
```bash
du -h --max-depth=1 /tmp/elysium-nav-demo | sort -rh
```

```text
2.4M	/tmp/elysium-nav-demo
2.1M	/tmp/elysium-nav-demo/data
264K	/tmp/elysium-nav-demo/logs
20K	/tmp/elysium-nav-demo/project
```

#### Show allocated blocks for a sparse file

`du` reports allocated blocks, not logical file length. The sparse file below occupies almost no disk even though `ls` reports a 128 MB logical size.

> [!info] Apparent and allocated size diverge on sparse files
>
> GNU `du` answers the "how many blocks did the filesystem allocate?" question. When you need the logical byte count instead, use `du --apparent-size` or `du -b`; those measurements line up with what `ls -l` and most applications report for the file length.

*Run the commands in this section to show allocated blocks for a sparse file.*
```bash
du -h /tmp/elysium-nav-demo/data/sparse.bin
```

```text
0	/tmp/elysium-nav-demo/data/sparse.bin
```

Keep `du` usage narrow and explicit so the output stays attributable to a specific path depth or file set.

| Flag | Syntax | Description |
|------|--------|-------------|
| `-s` | `du -s dir/` | Print a single summary total |
| `-h` | `du -h dir/` | Use human-readable units |
| `--max-depth` | `du --max-depth=1 dir/` | Limit recursion depth |
| `-c` | `du -c dir/` | Add a grand total row |
| `-a` | `du -a dir/` | Include files as well as directories |
| `--exclude` | `du --exclude='*.log' dir/` | Skip paths that match a pattern |

### Linux | df | check filesystem headroom

After `du` identifies the heavy paths, use `df` to confirm whether the filesystem itself is close to a block or inode limit. The two views answer different questions and should be read together.

#### Check free blocks before cleanup

`df -h` reports filesystem-wide capacity for the mounted path. It tells you whether the filesystem is actually near exhaustion, not just whether one directory is large.

*Run the commands in this section to check free blocks before cleanup.*
```bash
df -h /tmp/elysium-nav-demo
```

```text
Filesystem      Size  Used Avail Use% Mounted on
/dev/sdf       1007G  2.2G  954G   1% /
```

#### Check inode usage before assuming blocks are full

`df -i` answers the failure mode that `df -h` misses. If block usage looks healthy but writes still fail, inode exhaustion is the next thing to inspect.

*Run the commands in this section to check inode usage before assuming blocks are full.*
```bash
df -i /tmp/elysium-nav-demo
```

```text
Filesystem       Inodes IUsed    IFree IUse% Mounted on
/dev/sdf       67108864 58030 67050834    1% /
```

Use these `df` flags when you need capacity context instead of directory-level attribution.

| Flag | Syntax | Description |
|------|--------|-------------|
| `-h` | `df -h` | Show human-readable block totals |
| `-i` | `df -i` | Show inode usage instead of block usage |
| `-T` | `df -T` | Show filesystem type |
| `-t` | `df -t ext4` | Filter by filesystem type |
| `--total` | `df --total` | Add a grand total row |

### Linux | du vs df | diagnose mismatches

When `ls`, `du`, and `df` disagree, the discrepancy is usually explainable. The common cases are sparse files, deleted files still held open, and filesystem-level overhead that directory walks do not attribute back to a visible path.

#### Show the sparse file's logical size

`ls -lh` reports the file's logical length, which is what most applications see. Compare it with the earlier `du` output to distinguish logical size from allocated blocks.

*Run the commands in this section to show the sparse file's logical size.*
```bash
ls -lh /tmp/elysium-nav-demo/data/sparse.bin
```

```text
-rw-r--r-- 1 alex alex 128M Apr 14 08:30 /tmp/elysium-nav-demo/data/sparse.bin
```

#### Find deleted files still held open

`lsof +L1` lists file handles whose link count dropped below one, and `grep` narrows the result to the deleted fixture file. This is the canonical explanation when `df` still shows used space after a log file was removed.

*Run the commands in this section to find deleted files still held open.*
```bash
lsof +L1 | grep elysium-nav-deleted
```

```text
python3 18559 alex    3r   REG   8,80       23     0 45119 /tmp/elysium-nav-demo/logs/elysium-nav-deleted.log (deleted)
```

If neither case explains the mismatch, reserved blocks and filesystem metadata are the next places to inspect.

## PowerShell navigation and listing tools

The PowerShell examples below use a disposable fixture at `$env:TEMP\elysium-nav-demo`. `Get-ChildItem` returns typed objects, so sorting and measurement happen on properties rather than parsed text.

### PowerShell | Get-ChildItem | inspect files and directories

Use `Get-ChildItem` when you want the equivalent of `ls` plus object-aware filtering and measurement. For large trees, prefer `-Filter` over `-Include` so filtering happens in the filesystem provider instead of after full enumeration.

#### List items by last write time

`Sort-Object LastWriteTime` orders the file objects by modification time. The formatted output makes it easy to verify which artifact arrived last without losing the underlying metadata.

*Run the commands in this section to list items by last write time.*
```powershell
Get-ChildItem -Path "$env:TEMP\elysium-nav-demo\data" | Sort-Object LastWriteTime | Format-Table Mode, LastWriteTime, Length, Name -AutoSize
```

```text
Mode   LastWriteTime     Length Name
----   -------------     ------ ----
-a---- 14-Apr-26 8:15:00  65536 daily.csv
-a---- 14-Apr-26 8:25:00 262144 latest.parquet
```

#### Format human-readable sizes

PowerShell does not have a native `-h` switch, so a calculated property is the standard way to convert byte counts into readable units. The command below keeps the pipeline object-based while presenting sizes the way an operator expects to read them.

*Run the commands in this section to format human-readable sizes.*
```powershell
Get-ChildItem -Path "$env:TEMP\elysium-nav-demo\data" | Sort-Object Length -Descending | Select-Object Name, @{N='Size';E={ if ($_.Length -ge 1MB) { '{0:N1} MB' -f ($_.Length / 1MB) } elseif ($_.Length -ge 1KB) { '{0:N1} KB' -f ($_.Length / 1KB) } else { '{0} B' -f $_.Length } }}, LastWriteTime | Format-Table -AutoSize
```

```text
Name           Size     LastWriteTime
----           ----     -------------
latest.parquet 256.0 KB 14-Apr-26 8:25:00
daily.csv      64.0 KB  14-Apr-26 8:15:00
```

#### Reveal hidden configuration files

`Get-ChildItem` skips hidden items unless you add `-Force`. Use this before concluding that a configuration file is absent on Windows.

*Run the commands in this section to reveal hidden configuration files.*
```powershell
Get-ChildItem -Force -Path "$env:TEMP\elysium-nav-demo" | Format-Table Mode, Length, Name -AutoSize
```

```text
Mode   Length Name
----   ------ ----
d-----        data
d-----        logs
d-----        project
---h-- 12     .env
```

#### Measure a directory recursively

`Measure-Object -Sum` totals the `Length` property across all files under the path. Wrapping the expression in `[math]::Round()` produces a single numeric result that can feed alerting or threshold logic.

*Run the commands in this section to measure a directory recursively.*
```powershell
[math]::Round(((Get-ChildItem -Path "$env:TEMP\elysium-nav-demo" -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1KB), 1)
```

```text
322
```

These parameters cover the cases used most often when exploring or measuring a Windows path.

| Parameter | Syntax | Description |
|-----------|--------|-------------|
| `-Path` | `-Path "C:\dir"` | Target directory or file path |
| `-Recurse` | `-Recurse` | Enumerate child items recursively |
| `-Filter` | `-Filter "*.csv"` | Apply one filesystem-level pattern during enumeration |
| `-Include` | `-Include "*.csv"` | Filter after enumeration completes |
| `-Exclude` | `-Exclude "*.tmp"` | Skip names that match a pattern |
| `-Force` | `-Force` | Include hidden and system items |
| `-Hidden` | `-Hidden` | Return only hidden items |
| `-File` | `-File` | Return files only |
| `-Directory` | `-Directory` | Return directories only |
| `-Depth` | `-Depth 2` | Limit recursion depth |
| `-Name` | `-Name` | Return names instead of full objects |

### PowerShell | Get-PSDrive | report disk capacity

`Get-PSDrive` is the PowerShell capacity view that corresponds to `df`. Filter it to filesystem drives so the output stays focused on actual disk-backed volumes.

#### Report used and free space by drive

The calculated properties below convert raw byte counts into gigabytes and keep the result concise enough for routine checks. This is the PowerShell equivalent of a human-readable filesystem-capacity report.

*Run the commands in this section to report used and free space by drive.*
```powershell
Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{N='Used(GB)';E={[math]::Round($_.Used / 1GB, 1)}}, @{N='Free(GB)';E={[math]::Round($_.Free / 1GB, 1)}} | Format-Table -AutoSize
```

```text
Name Used(GB) Free(GB)
---- -------- --------
C      1655.6    250.3
```

#### Flag drives above an alert threshold

A simple percentage threshold turns the same drive data into an operational check. The example below surfaces only drives already above 80 percent used, which is a sensible point to alert before a filesystem hard-fails.

*Run the commands in this section to flag drives above an alert threshold.*
```powershell
Get-PSDrive -PSProvider FileSystem | Where-Object { (($_.Used / ($_.Used + $_.Free)) * 100) -ge 80 } | Select-Object Name, @{N='UsedPct';E={[math]::Round((($_.Used / ($_.Used + $_.Free)) * 100), 1)}} | Format-Table -AutoSize
```

```text
Name UsedPct
---- -------
C       86.9
```

Use this small parameter set when turning an ad hoc disk check into a repeatable PowerShell routine.

| Parameter | Syntax | Description |
|-----------|--------|-------------|
| `-PSProvider` | `-PSProvider FileSystem` | Restrict output to filesystem drives |
| `-Name` | `-Name C` | Return one named drive |

For continuous resource monitoring beyond ad hoc directory inspection, see [system-resources](https://alp78.github.io/elysium/01-Shell/04-Process-Management/04-system-resources).

## Cross-references

- [file-manipulation](https://alp78.github.io/elysium/01-Shell/02-File-Operations/02-file-manipulation) - copying, moving, permissions, and safe delete patterns
- [finding-files](https://alp78.github.io/elysium/01-Shell/02-File-Operations/03-finding-files) - search large trees once directory layout is clear
- [reading-file-contents](https://alp78.github.io/elysium/01-Shell/03-Text-Processing/01-reading-file-contents) - inspect files after you locate them
- [compression](https://alp78.github.io/elysium/01-Shell/02-File-Operations/04-compression) - reduce disk pressure with archive and compression tools
