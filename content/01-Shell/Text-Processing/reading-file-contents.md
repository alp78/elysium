---
type: concept
category: foundations
technology: [bash, powershell]
tags: [concept, foundations, bash, filesystem, linux]
aliases: [cat, head, tail, tail -f, grep large files, log analysis, less, reading files]
keywords: [cat, head, tail, tail -f, grep, awk, less, log file, incident response, reading files, follow log, large file, line count, wc -l, extract time window, ripgrep, rg, Select-String]
description: "Commands for reading file contents from quick config checks to deep log file analysis during incidents. Covers tail -f for real-time log following, grep performance flags, and PowerShell Select-String."
related: ["[[navigation-and-listing]]", "[[finding-files]]", "[[viewing-processes]]", "[[viewing-processes]]" ]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Reading File Contents — From Quick Glance to Deep Analysis

A senior data engineer reads files differently depending on context. Checking a config file means reading the whole thing. Investigating a 50GB log file means surgical extraction. Understanding a Parquet file means reading metadata, not data. Choosing the wrong tool turns a 30-second task into a server-killing operation.

## Linux — cat, head, tail, grep, awk

**Basic file reading:**

```bash
# Read a small file (config, script, schema)
cat filename
# cat = concatenate and print. Fine for files under a few hundred lines.
# For larger files, use less (pager with search) or head/tail

# First and last N lines (boundary checking)
head -n 20 data.csv     # first 20 lines (check headers, column structure)
tail -n 20 data.csv     # last 20 lines (check for truncation, footer junk)
head -n 1 data.csv      # header row only (see column names)

# Follow a log file in real-time (the most-used command during incidents)
tail -f /var/log/pipeline/run.log
# -f = follow — keeps the terminal open, printing new lines as they're appended
# Ctrl+C to stop

# Follow multiple log files simultaneously
tail -f /var/log/pipeline/*.log
# Shows filename headers as each file gets new content
# Use case: monitoring scheduler, worker, and database logs at the same time

# Follow with grep (filter noise in real-time)
tail -f /var/log/pipeline/run.log | grep --line-buffered "ERROR\|WARN\|DEADLOCK"
# --line-buffered = flush output on every line (without this, grep buffers and you see nothing)
# \| = OR in basic regex (or use grep -E "ERROR|WARN|DEADLOCK" for extended regex)
```

## Production Scenario — Analyzing a Large Log File During an Incident

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

## grep Performance on Large Files

> [!tip] `grep` Performance on Large Files
> - `grep -F "literal string"` is 3-5x faster than `grep "regex"` for literal matches. The `-F` flag uses a fast string-matching algorithm instead of the regex engine. Always use it when you don't need regex.
> - `grep -m 10 "pattern"` stops after 10 matches. If you only need the first few occurrences in a 50GB file, this saves minutes.
> - For recursive searches across thousands of files, use `ripgrep` (`rg`): `rg "pattern" /path/` — it respects `.gitignore`, uses multiple threads, and is 5-10x faster than `grep -r`.
> - `LC_ALL=C grep "pattern"` forces the C locale, which skips Unicode handling and can be 4x faster for ASCII-only data.

## PowerShell — Get-Content, Select-String

```powershell
# Read entire file
Get-Content filename         # aliases: cat, type, gc

# First/last N lines
Get-Content filename -Head 20
Get-Content filename -Tail 20

# Follow a log file in real-time
Get-Content filename -Wait -Tail 10
# -Wait = keep reading as new lines appear (like tail -f)
# -Tail 10 = start from the last 10 lines

# Search inside files (PowerShell's grep)
Select-String -Path "C:\logs\*.log" -Pattern "ERROR" -Context 3
# -Path = file glob pattern
# -Pattern = regex (or use -SimpleMatch for literal string matching)
# -Context 3 = show 3 lines before and after each match
# Returns MatchInfo objects with LineNumber, Line, Filename properties

# Count matches
(Select-String -Path pipeline.log -Pattern "ERROR").Count

# Search recursively
Select-String -Path "C:\pipeline\**\*.log" -Pattern "DEADLOCK" -Recurse
```

## Related
- [[navigation-and-listing]] — find the right file before reading it
- [[finding-files]] — search for files by name, size, or modification time
- [[viewing-processes]] — pair log reading with process inspection during incidents
- [[connectivity-testing]] — network layer to check when logs show connection errors
