---
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell, bash, linux, powershell]
aliases: [ls, du, df, directory listing, disk usage, disk free, tree command]
keywords: [ls, du, df, tree, directory listing, disk usage, disk space, file sizes, hidden files, human readable, sort by time, modification time, disk free, filesystem, navigation]
description: "Linux and PowerShell commands for navigating the filesystem, listing files sorted by modification time, checking disk usage with du, and monitoring free disk space with df. Includes the du vs df discrepancy explained."
related: ["[[file-manipulation]]", "[[finding-files]]", "[[reading-file-contents]]", "[[compression]]" ]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Navigation and Listing — Seeing What You Have

The `ls` command is your window into the file system. The flags you choose determine whether you see just filenames or a complete picture of sizes, permissions, ownership, and modification times. As a data engineer you regularly deal with directories containing gigabytes of data — the right listing command tells you what changed, what's consuming space, and whether a pipeline produced what it should.

## Linux — ls, du, df, tree

#### ls -lhrt — the data engineer's default listing

> [!info] ls -lhrt flags
>
> - `-l` — long format (permissions, owner, group, size, date, name)
> - `-h` — human-readable sizes (1.2G instead of 1289748480)
> - `-r` — reverse order
> - `-t` — sort by modification time
> - Combined: most recently modified file appears **last** (at the bottom of your terminal, right next to your cursor)

```bash
ls -lhrt
```

#### ls -la — show hidden files (dotfiles)

> [!info] Show hidden files with -a
>
> `-a` includes entries starting with `.` — the convention Unix uses to hide
> files. In data engineering directories, critical files like `.env`, `.git/`,
> `.dockerignore`, and `.dbt/` are all hidden by default. If a pipeline can't find its
> config, check hidden files first.

```bash
ls -la
```

#### ls -d */ — list only directories

> [!info] List directories only with -d
>
> `-d` tells `ls` to list the directory entry itself rather than its contents.
> Combined with the `*/` glob, this shows only directories in the current path — useful
> for surveying project structure without file noise.

```bash
ls -d */
```

#### tree — visual directory tree

> [!info] tree command
>
> `tree` prints a recursive directory structure as an indented tree. Not installed
> by default on minimal Linux images (Debian slim, Alpine, Docker base images). Install
> with `apt install tree` (Debian/Ubuntu) or `yum install tree` (RHEL/CentOS).

```bash
tree -L 2 --dirsfirst
```

> [!tip] Limit tree depth with -L
>
> `-L 2` limits depth to 2 levels — essential for large repos. Without `-L`,
> `tree` recurses the entire subtree. On a data directory with millions of partitioned
> Parquet files this produces unusable output and can take minutes.

> [!danger] Never parse ls output in scripts
>
> `ls` output is designed for humans, not programs. Filenames containing spaces, newlines,
> or glob characters break any script that parses `ls`. Instead:
> - **Loop over files:** `for f in *.csv; do ...` (shell glob — safe)
> - **Find files programmatically:** `find . -name "*.csv" -print0 | xargs -0 ...`
> - **Get file metadata in scripts:** `stat --format='%s %n' *` instead of parsing `ls -l`
>
> See [[defensive-scripting]] for robust file-handling patterns.

### du, ls, df — investigating disk space on a database server

This is the opening move in the sql server disk full runbook.

```bash
# Step 1: What's consuming the most space? (top 10 directories)
du -h --max-depth=1 /var/opt/mssql/ | sort -rh | head -10

# Step 2: Which database files are the largest?
ls -lhS /var/opt/mssql/data/*.mdf /var/opt/mssql/data/*.ndf 2>/dev/null

# Step 3: How much free space remains?
df -h /var/opt/mssql/
```

> [!warning] SQL Server stops when disk is full
>
> Monitor `df -h` regularly on database servers.

### du vs df discrepancy — why disk usage numbers don't match

> [!warning] du vs df numbers don't match
>
> `du` measures actual file sizes. `df` measures filesystem block allocation. These numbers frequently disagree because:
> 1. **Deleted files still held open:** If a process (e.g., SQL Server) has a file open and you delete it, `du` won't count it but `df` still does — the blocks aren't freed until the process closes the file handle. This is the #1 cause of "I deleted 20GB of logs but disk space didn't change."
> 2. **Filesystem metadata and reserved blocks:** ext4 reserves 5% for root by default. Reduce with `tune2fs -m 1 /dev/sda1` (set to 1%) on data-only volumes.
> 3. **Sparse files:** Files with holes (e.g., database pre-allocated files) report different sizes via `ls -l` (logical) vs `du` (actual blocks).
>
> To find deleted-but-held-open files consuming space:
> ```bash
> sudo lsof +L1 | grep deleted
> # Shows processes holding deleted files open
> # Fix: restart the process, or more precisely, identify which log rotation is broken
> ```

#### df -i — check inode usage when disk is "full" but df shows free space

> [!danger] Inode exhaustion looks like disk full
>
> Running out of inodes produces the same "No space left on device" error as
> running out of disk blocks — but `df -h` shows plenty of free space. This happens on
> systems with millions of small files (e.g., a `/tmp` full of tiny lock files, or a
> logging directory with one file per request). Check inodes with:

```bash
df -i /var/opt/mssql/
```

> [!tip] ncdu interactive disk explorer
>
> `ncdu` (NCurses Disk Usage) provides an interactive, navigable view of disk consumption
> sorted by size. Far more efficient than running `du` repeatedly. Install with
> `apt install ncdu`, then run `ncdu /var/opt/mssql/`. Press `d` to delete directly from
> the interface (with confirmation).

## PowerShell — Get-ChildItem, Get-PSDrive

#### Get-ChildItem — list files sorted by modification time

> [!info] Get-ChildItem returns objects
>
> `Get-ChildItem` (aliases: `ls`, `dir`, `gci`) returns rich objects with
> properties like `Name`, `Length`, `LastWriteTime`, and `Mode`. Unlike Unix `ls`, the
> output is typed — you pipe objects, not text. This makes PowerShell immune to the
> filename-parsing pitfalls that plague bash `ls`.

```powershell
Get-ChildItem -Path . | Sort-Object LastWriteTime
```

#### Get-ChildItem — human-readable file sizes

> [!info] Human-readable sizes in PowerShell
>
> PowerShell has no `-h` flag for human-readable sizes. Build a calculated
> property with `Select-Object` and a format expression. This pattern is reusable
> anywhere you need to display byte counts cleanly.

```powershell
Get-ChildItem -Path . | Sort-Object Length -Descending |
    Select-Object Name, @{N='Size';E={
        if ($_.Length -ge 1GB) { "{0:N1} GB" -f ($_.Length/1GB) }
        elseif ($_.Length -ge 1MB) { "{0:N1} MB" -f ($_.Length/1MB) }
        else { "{0:N1} KB" -f ($_.Length/1KB) }
    }}, LastWriteTime
```

#### Get-ChildItem -Force — show hidden and system files

> [!info] Get-ChildItem skips hidden files
>
> By default `Get-ChildItem` skips hidden and system files entirely — unlike
> `ls` which only hides dotfiles. Use `-Force` to include everything, or `-Hidden` to
> return hidden items only.

```powershell
Get-ChildItem -Force
```

> [!warning] -Force required for hidden files
>
> `Get-ChildItem -Path ".env"` returns nothing if `.env` is hidden — no error, no
> output. You must use `Get-ChildItem -Force -Path ".env"`. This catches many people
> when debugging "file not found" issues on Windows.

#### Get-ChildItem -Recurse — recursive directory size (equivalent of du -sh)

> [!info] Recursive directory size
>
> Pipe recursive file objects into `Measure-Object -Sum` to total the `Length`
> property. The `-File` switch excludes directories (which have no meaningful `Length`).

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

#### Get-PSDrive — check free disk space across all drives

> [!info] Get-PSDrive free space
>
> `Get-PSDrive` returns PS drive objects including `Used` and `Free` byte counts.
> Filter to `FileSystem` provider to exclude registry and certificate drives.

```powershell
Get-PSDrive -PSProvider FileSystem | Format-Table Name,
    @{N='Used(GB)';E={[math]::Round($_.Used/1GB,1)}},
    @{N='Free(GB)';E={[math]::Round($_.Free/1GB,1)}}
```

For continuous disk and resource monitoring beyond manual `du`/`df` checks, see [[system-resources]] which covers `vmstat`, `iostat`, and automated alerting patterns.

## Related
- [[file-manipulation]] — copying, moving, permissions, and safe delete patterns
- [[finding-files]] — surgical search for specific files across large trees
- [[reading-file-contents]] — what to do once you find the file
- [[compression]] — reduce disk usage with gzip, zstd, and tar
