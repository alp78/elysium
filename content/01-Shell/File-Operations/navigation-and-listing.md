---
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell, bash]
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

> [!info] `ls -lhrt` — the data engineer's default
> - `-l` — long format (permissions, owner, group, size, date, name)
> - `-h` — human-readable sizes (1.2G instead of 1289748480)
> - `-r` — reverse order
> - `-t` — sort by modification time
> - Combined: most recently modified file appears **last** (at the bottom of your terminal, right next to your cursor)

```bash
ls -lhrt              # most recent at the bottom
ls -la                # show hidden files (.env, .git, .dockerignore)
ls -d */              # show only directories
tree -L 2 --dirsfirst # visual tree (apt install tree)
```

## Production Scenario — Investigating Disk Space on a Database Server

This is the opening move in the [[sql-server-disk-full]] runbook.

```bash
# Step 1: What's consuming the most space? (top 10 directories)
du -h --max-depth=1 /var/opt/mssql/ | sort -rh | head -10

# Step 2: Which database files are the largest?
ls -lhS /var/opt/mssql/data/*.mdf /var/opt/mssql/data/*.ndf 2>/dev/null

# Step 3: How much free space remains?
df -h /var/opt/mssql/
```

> [!warning] SQL Server **stops** when the disk is full. Monitor `df -h` regularly on database servers.

## The `du` vs `df` Discrepancy

> [!warning] `du` vs `df` Numbers Don't Always Match
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

## PowerShell

```powershell
# List files sorted by modification time (newest last)
Get-ChildItem -Path . | Sort-Object LastWriteTime
# Get-ChildItem aliases: ls, dir, gci
# Returns objects with properties: Name, Length, LastWriteTime, Mode

# Human-readable sizes (PowerShell doesn't have -h, so calculate)
Get-ChildItem -Path . | Sort-Object Length -Descending |
    Select-Object Name, @{N='Size';E={
        if ($_.Length -ge 1GB) { "{0:N1} GB" -f ($_.Length/1GB) }
        elseif ($_.Length -ge 1MB) { "{0:N1} MB" -f ($_.Length/1MB) }
        else { "{0:N1} KB" -f ($_.Length/1KB) }
    }}, LastWriteTime

# Show hidden files
Get-ChildItem -Force
# -Force = include hidden and system files

# Recursive directory size (equivalent of du -sh)
(Get-ChildItem -Path "C:\data\pipeline" -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1GB
# Returns size in GB as a decimal — pipe to [math]::Round() for clean output

# Disk free space
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
