---
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell, bash, linux, powershell]
aliases: [cat, head, tail, tail -f, grep large files, log analysis, less, reading files]
keywords: [cat, head, tail, tail -f, grep, awk, less, log file, incident response, reading files, follow log, large file, line count, wc -l, extract time window, ripgrep, rg, Select-String]
description: "Commands for reading file contents from quick config checks to deep log file analysis during incidents. Covers tail -f for real-time log following, grep performance flags, and PowerShell Select-String."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Reading File Contents — From Quick Glance to Deep Analysis

A senior data engineer reads files differently depending on context. Checking a config file means reading the whole thing. Investigating a 50GB log file means surgical extraction. Understanding a Parquet file means reading metadata, not data. Choosing the wrong tool turns a 30-second task into a server-killing operation.

## Linux — cat, head, tail, grep, awk

#### cat, head, tail, less — basic file reading

> [!info] cat for small files
>
> `cat` concatenates and prints. Fine for files under a few hundred lines.
> For larger files, use `less` (pager with search) or `head`/`tail`.

```bash
cat filename
```

#### head, tail — check file boundaries

> [!info] head and tail basics
>
> `head` shows the top, `tail` shows the bottom. `head -n 1` extracts the
> header row from a CSV — use this to check column names before loading.

```bash
head -n 20 data.csv
tail -n 20 data.csv
head -n 1 data.csv
```

#### tail -f — follow a log file in real-time

> [!info] Follow log with tail -f
>
> `-f` (follow) keeps the terminal open, printing new lines as they're appended.
> The most-used command during incidents. `Ctrl+C` to stop.

```bash
tail -f /var/log/pipeline/run.log
tail -f /var/log/pipeline/*.log
```

#### tail -f | grep — filter noise from a live log stream

> [!warning] --line-buffered required with tail -f
>
> Without it, grep buffers output and you see nothing for minutes. `--line-buffered`
> forces grep to flush on every matching line.

```bash
tail -f /var/log/pipeline/run.log | grep --line-buffered -E "ERROR|WARN|DEADLOCK"
```

### Analyzing a large log file during an incident — grep, awk, sort workflow

The file is 15GB. Do not `cat` it. Do not open it in vim.

```bash
# The file is 15GB. DO NOT cat it. DO NOT open it in vim.

# Step 1: How big is it? How many lines?
ls -lh pipeline.log          # file size
wc -l pipeline.log           # line count (fast — only reads newlines)

# Step 2: What does the structure look like?
head -5 pipeline.log         # see the log format
# 2025-03-09 14:23:01 INFO  [loader.ohlcv] Loaded 50 rows for ASML

# Step 3: Extract only errors (stream through, don't load into memory)
grep -c "ERROR" pipeline.log       # count errors first
grep -n "ERROR" pipeline.log       # show line numbers (for targeted extraction later)

# Step 4: Get context around a specific error
grep -n -B 5 -A 10 "DEADLOCK" pipeline.log
# -B 5 = 5 lines Before the match
# -A 10 = 10 lines After the match
# -n = line numbers (so you can jump back with sed if needed)

# Step 5: Extract a time window (the outage was between 14:00 and 14:30)
awk '/^2025-03-09 14:0/,/^2025-03-09 14:3/' pipeline.log > /tmp/outage_window.log
# awk range pattern: /start/,/stop/ — prints all lines between first match and second match
# This extracts exactly the time window you care about

# Step 6: Top error categories in that window
grep "ERROR" /tmp/outage_window.log | awk '{print $NF}' | sort | uniq -c | sort -rn | head -10
# $NF = last field on each line (usually the error type)
# sort | uniq -c = count occurrences
# sort -rn = sort by count descending
```

### grep performance on large files — -F, -m, ripgrep, LC_ALL=C

> [!tip] grep performance on large files
>
> - `grep -F "literal string"` is 3-5x faster than `grep "regex"` for literal matches. The `-F` flag uses a fast string-matching algorithm instead of the regex engine. Always use it when you don't need regex.
> - `grep -m 10 "pattern"` stops after 10 matches. If you only need the first few occurrences in a 50GB file, this saves minutes.
> - For recursive searches across thousands of files, use `ripgrep` (`rg`): `rg "pattern" /path/` — it respects `.gitignore`, uses multiple threads, and is 5-10x faster than `grep -r`.
> - `LC_ALL=C grep "pattern"` forces the C locale, which skips Unicode handling and can be 4x faster for ASCII-only data.

### PowerShell — Get-Content -Wait, Select-String for log analysis

#### Get-Content — read entire file or head/tail

> [!info] Get-Content basics
>
> Aliases: `cat`, `type`, `gc`. `-Head` and `-Tail` work like `head -n` and
> `tail -n`.

```powershell
Get-Content filename
Get-Content filename -Head 20
Get-Content filename -Tail 20
```

#### Get-Content -Wait — follow a log file in real-time (like tail -f)

```powershell
Get-Content filename -Wait -Tail 10
```

#### Select-String — search inside files (PowerShell grep)

> [!info] Select-String returns MatchInfo
>
> Returns `MatchInfo` objects with `LineNumber`, `Line`, and `Filename` properties.
> `-Context 3` shows 3 lines before and after each match. For the full `Select-String`
> reference, see [grep-and-pattern-matching](https://alp78.github.io/elysium/01-Shell/Text-Processing/grep-and-pattern-matching).

```powershell
Select-String -Path "C:\logs\*.log" -Pattern "ERROR" -Context 3
(Select-String -Path pipeline.log -Pattern "ERROR").Count
```

## Related
- [navigation-and-listing](https://alp78.github.io/elysium/01-Shell/File-Operations/navigation-and-listing) — find the right file before reading it
- [finding-files](https://alp78.github.io/elysium/01-Shell/File-Operations/finding-files) — search for files by name, size, or modification time
- [viewing-processes](https://alp78.github.io/elysium/01-Shell/Process-Management/viewing-processes) — pair log reading with process inspection during incidents
- [connectivity-testing](https://alp78.github.io/elysium/01-Shell/Networking/connectivity-testing) — network layer to check when logs show connection errors
