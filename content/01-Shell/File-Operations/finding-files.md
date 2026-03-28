---
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell, bash]
aliases: [find, fd, locate, file search, find command, xargs]
keywords: [find, fd, locate, xargs, file search, recursive search, find by name, find by size, find by time, mtime, mmin, find and delete, empty directories, parallel processing, Get-ChildItem, Where-Object, find large files]
description: "Targeted file searching with find, fd, and locate — searching by name pattern, size, modification time, and content. Includes parallel processing with xargs and PowerShell equivalents."
related: ["[[navigation-and-listing]]", "[[reading-file-contents]]", "[[file-manipulation]]", "[[brace-expansion-and-globbing]]" ]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Finding Files — Surgical Searching at Scale

When a pipeline fails and you need to find the offending file across a directory tree with thousands of entries, brute-force listing is not an option. You need targeted search tools that filter by name, size, time, type, and content. The `find` command is universal; `fd` is faster for interactive use; `locate` is instant but potentially stale. While `find` locates files by metadata, [[grep-and-pattern-matching]] searches inside those files for content -- the two tools complement each other in every investigation.

## Linux — find, fd, locate

#### find -name -type — find by name pattern

```bash
# Find by name pattern
find /data/ -name "*.parquet" -type f
# -name = filename pattern (case-sensitive; use -iname for case-insensitive)
# -type f = files only (d = directories, l = symlinks)
```

#### find -mtime -mmin — find by modification time

```bash
# Find by modification time
find /var/log/ -name "*.log" -mtime -7
# -mtime -7 = modified within the last 7 days
# -mtime +30 = modified more than 30 days ago (candidates for archival)
# -mmin -60 = modified within the last 60 minutes (recent changes)
```

#### find -size — find by file size

```bash
# Find by size
find /data/ -type f -size +100M
# -size +100M = larger than 100 MB
# -size -1k = smaller than 1 KB (probably empty or corrupt)
```

#### find -exec, find -delete — find and execute on results

```bash
# Find and execute (delete old logs — schedule this via cron, see [[linux-scheduling]])
find /var/log/pipeline/ -name "*.log" -mtime +30 -exec rm {} \;
# -exec rm {} \; = run rm on each found file
# {} = placeholder for the found filename
# \; = end of the -exec command

# SAFER: Find and delete with confirmation (list first, then delete)
find /var/log/pipeline/ -name "*.log" -mtime +30 -print
# Review the list, THEN:
find /var/log/pipeline/ -name "*.log" -mtime +30 -delete
# -delete is safer than -exec rm because it won't accidentally expand
```

#### find -empty, find -daystart — empty dirs and today's files

```bash
# Find empty directories (cleanup after data pipeline runs)
find /data/staging/ -type d -empty
# Often left behind after pipeline processing moves files out

# Find files modified today (what did the pipeline touch?)
find /data/ -type f -daystart -mtime 0
# -daystart = measure from start of today, not 24 hours ago
# -mtime 0 = modified today

# Find large files consuming disk space (key step in the [[sql-server-disk-full]] runbook)
find / -type f -size +1G 2>/dev/null | head -20
# 2>/dev/null = suppress permission errors from system directories
```

#### find -print0 | xargs -0 -P — parallel processing of found files

```bash
# Combine with xargs for parallel processing
find /data/ -name "*.csv" -print0 | xargs -0 -P 4 gzip
# -print0 = null-delimited output (handles filenames with spaces)
# xargs -0 = read null-delimited input
# -P 4 = run 4 gzip processes in parallel (4x faster on multi-core)
```

## Tool Comparison — `find` vs `fd` vs `locate`

> [!tip] `find` vs `fd` vs `locate`
> - `find` is universal but single-threaded and slow on large trees. Good for: combining with `-exec`, complex predicates.
> - `fd` (install: `apt install fd-find`) is 5-10x faster, respects `.gitignore`, has a simpler syntax: `fd "\.parquet$" /data/`. Use it for interactive searching.
> - `locate` uses a pre-built database (updated by `updatedb` cron): `locate "*.parquet"` — instant results but stale by up to 24 hours. Good for: "where did I put that file last week?"

## PowerShell — Get-ChildItem with Where-Object

```powershell
# Find by name pattern (recursive)
Get-ChildItem -Path "C:\data\" -Filter "*.parquet" -Recurse -File
# -Filter = fast filename filter (kernel-level, faster than -Include)
# -Recurse = search subdirectories
# -File = files only (use -Directory for directories)

# Find by size
Get-ChildItem -Path "C:\data\" -Recurse -File | Where-Object Length -gt 100MB

# Find by modification time
Get-ChildItem -Path "C:\data\" -Recurse -File |
    Where-Object { $_.LastWriteTime -gt (Get-Date).AddDays(-7) }

# Find empty directories
Get-ChildItem -Path "C:\data\" -Recurse -Directory |
    Where-Object { (Get-ChildItem $_.FullName -Force).Count -eq 0 }

# Search file contents (recursive grep)
Select-String -Path "C:\pipeline\**\*.py" -Pattern "deadlock" -Recurse
# Returns: filename, line number, matching line — structured objects
```

## Related
- [[navigation-and-listing]] — listing directories before searching
- [[reading-file-contents]] — reading the files you find
- [[file-manipulation]] — deleting or moving files found by `find`
- [[brace-expansion-and-globbing]] — globbing patterns complement `find`
