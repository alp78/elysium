---
title: "01 - Reading File Contents"
tags: [shell, text-processing]
aliases: [cat, head, tail, tail -f, less, reading files, Select-String]
keywords: [cat, head, tail, grep, awk, less, Get-Content, Select-String, log analysis, reading files]
description: "Read small files safely, inspect larger logs with bounded commands, and follow live output on Linux and PowerShell."
created: 2026-03-22
updated: 2026-04-15
status: complete
---

# Read File Contents

> [!quote]+
>
> "The most effective debugging tool is still careful thought, coupled with judiciously placed print statements."
>
> — **Brian Kernighan**, *Unix for Beginners* (1979)

> [!abstract]- Summary
>
> Start with bounded reads before you open or stream an unknown file. Use `cat` only for small files, `head` and `tail` for quick inspection, `tail -F` or `Get-Content -Wait` for live logs, and `grep` or `Select-String` when you need context around a known pattern.
>
> - Check size or line count before dumping a large file to the terminal.
> - Prefer `tail -F` when a Linux log may rotate under the same filename.
> - Treat `Get-Content -Raw` as the whole-file case; default `Get-Content` emits one string per line.

> [!note]- Glossary
>
> **`cat`**
>
> - Prints a file to standard output without paging or filtering.
> - Useful for small configs and scripts, or when you want to pipe the whole file into another command.
> - On an unknown or very large log, check size first and prefer bounded reads.
>
> ---
>
> **`head` / `tail`**
>
> - Print the first or last lines of a file.
> - They are the fastest safe inspection step before you search or follow a log.
> - `tail -F` follows the filename across rotation; plain `tail -f` keeps following the previous file handle.
>
> ---
>
> **`grep`**
>
> - Prints lines that match a pattern.
> - Use it to locate errors, add context around a hit, or count matches before deeper inspection.
> - `--line-buffered` matters when `grep` sits in a live pipeline.
>
> ---
>
> **`awk`**
>
> - Applies pattern-action rules to each input line.
> - It is useful for slicing a log to a known time window or extracting specific fields.
> - Range patterns such as `/start/,/stop/` are inclusive.
>
> ---
>
> **`Get-Content`**
>
> - Reads file content into the PowerShell pipeline.
> - By default it emits one string per line, while `-Raw` emits one string for the whole file.
> - `-Wait` is for live follow mode; `-Raw` is not a large-log shortcut.
>
> ---
>
> **`Select-String`**
>
> - Searches files or pipeline input with .NET regular expressions.
> - It returns `MatchInfo` objects, so later pipeline steps can inspect line numbers, context, and counts.
> - Use `-SimpleMatch` when you need literal matching rather than regex behavior.

## Choose the first read

- Small config or script: `cat` or `Get-Content`.
- Unknown log: check size or line count first, then inspect with `head`, `tail`, `Get-Content -TotalCount`, or `Get-Content -Tail`.
- Live log: `tail -F` on Linux, `Get-Content -Wait -Tail 0` in PowerShell.
- Known error pattern: `grep -n -C` or `Select-String -Context`.

## Linux

### Linux | bounded reads

Use bounded reads first so you can confirm structure and recent activity before you search or follow a file.

#### Print a small file with `cat`

`cat` is appropriate when the file is small and you actually want the full contents on standard output. For unknown logs, treat `cat` as the last choice rather than the first.

*Run the commands in this section to print a small file with `cat`.*
```bash
cat /tmp/elysium-reading-demo/app.conf
```
```text
APP_ENV=prod
PORT=8080
LOG_LEVEL=info
```

#### Read the first lines with `head -n`

`head` is the safer first look when you need schema, headers, or the opening lines of a file. If you only need a CSV header row, drop the count to `1`.

*Run the commands in this section to read the first lines with `head -n`.*
```bash
head -n 3 /tmp/elysium-reading-demo/data.csv
```
```text
symbol,price,volume
AAPL,214.32,1200
MSFT,428.10,900
```

#### Read the last lines with `tail -n`

`tail` is the quick way to inspect recent log activity without paging through the entire file. It is usually the first bounded read on an append-only log.

*Run the commands in this section to read the last lines with `tail -n`.*
```bash
tail -n 2 /tmp/elysium-reading-demo/pipeline.log
```
```text
2026-04-14 14:24:03 ERROR [loader.ohlcv] Deadlock detected in writer
2026-04-14 14:24:04 INFO  [loader.ohlcv] Batch complete
```

### Linux | inspect unknown logs before deeper analysis

Before you stream or search an unfamiliar log, confirm its size and then narrow the scope with targeted reads.

#### Check file size with `ls -lh`

File size tells you whether a full-file read is cheap or reckless. On a large file, switch to bounded reads and targeted search immediately.

*Run the commands in this section to check file size with `ls -lh`.*
```bash
ls -lh /tmp/elysium-reading-demo/pipeline.log
```
```text
-rw-r--r-- 1 alex alex 437 Apr 14 13:09 /tmp/elysium-reading-demo/pipeline.log
```

#### Count newline-terminated records with `wc -l`

`wc -l` counts newline characters, which makes it a fast way to estimate record count before you decide how aggressively to inspect the file. A final line without a trailing newline is not counted the way many editors display it.

*Run the commands in this section to count newline-terminated records with `wc -l`.*
```bash
wc -l /tmp/elysium-reading-demo/pipeline.log
```
```text
7 /tmp/elysium-reading-demo/pipeline.log
```

#### Show line numbers and surrounding context with `grep -n -C`

When you already know the pattern, `grep -n -C` gives you the hit, its line number, and a bounded amount of context around it. That is usually enough to decide whether you need a longer time-window extract.

*Run the commands in this section to show line numbers and surrounding context with `grep -n -C`.*
```bash
grep -n -C 1 'ERROR' /tmp/elysium-reading-demo/pipeline.log
```
```text
3-2026-04-14 14:24:00 WARN  [loader.ohlcv] Retrying after timeout
4:2026-04-14 14:24:01 ERROR [loader.ohlcv] Connection timeout after 30s
5-2026-04-14 14:24:02 INFO  [loader.ohlcv] Retry succeeded
6:2026-04-14 14:24:03 ERROR [loader.ohlcv] Deadlock detected in writer
7-2026-04-14 14:24:04 INFO  [loader.ohlcv] Batch complete
```

#### Slice a known time window with `awk`

If the interesting period is already known, an `awk` range pattern is the simplest way to isolate that window without opening the rest of the file.

*Run the commands in this section to slice a known time window with `awk`.*
```bash
awk '/^2026-04-14 14:24:00/,/^2026-04-14 14:24:02/' /tmp/elysium-reading-demo/pipeline.log
```
```text
2026-04-14 14:24:00 WARN  [loader.ohlcv] Retrying after timeout
2026-04-14 14:24:01 ERROR [loader.ohlcv] Connection timeout after 30s
2026-04-14 14:24:02 INFO  [loader.ohlcv] Retry succeeded
```

### Linux | follow live logs

Once the bounded reads tell you that the file is the right target, switch to follow mode for ongoing activity.

#### Follow a rotating log with `tail -F`

Use `tail -F` when the writer may rotate or replace the file under the same name. The captured output below shows the reopen event, which is exactly why `-F` is safer than plain `-f` for production logs.

> [!info] Rotation-safe follow mode
>
> GNU `tail -f` follows the file descriptor by default, which can leave you attached to the old inode after a rename or log rotation. `tail -F` switches to name-following with retry, so the reader can reopen the path when the log disappears and reappears.

*Run the commands in this section to follow a rotating log with `tail -F`.*
```bash
tail -n 0 -F /tmp/elysium-reading-demo/live.log
```
```text
2026-04-14 14:25:00 INFO appended before rotation
tail: '/tmp/elysium-reading-demo/live.log' has become inaccessible: No such file or directory
tail: '/tmp/elysium-reading-demo/live.log' has appeared;  following new file
2026-04-14 14:25:01 INFO resumed after rotation
2026-04-14 14:25:02 WARN retrying on new file
```

## PowerShell

### PowerShell | bounded reads

PowerShell exposes the same core reading patterns, but the pipeline carries string objects and `MatchInfo` objects instead of plain text lines alone.

#### Print a small file with `Get-Content`

Default `Get-Content` is the PowerShell equivalent of a basic file read. It emits one string per line, which means later pipeline steps still work line by line.

*Run the commands in this section to print a small file with `Get-Content`.*
```powershell
Get-Content (Join-Path $env:TEMP 'elysium-reading-demo\app.conf')
```
```text
APP_ENV=prod
PORT=8080
LOG_LEVEL=info
```

#### Read the first lines with `-TotalCount`

`Get-Content` uses `-TotalCount` for the bounded "read the first N lines" case. Use `1` when you only need the header row.

*Run the commands in this section to read the first lines with `-TotalCount`.*
```powershell
Get-Content (Join-Path $env:TEMP 'elysium-reading-demo\data.csv') -TotalCount 3
```
```text
symbol,price,volume
AAPL,214.32,1200
MSFT,428.10,900
```

#### Read the last lines with `-Tail`

`-Tail` is the direct equivalent of `tail -n`. It is the safest way to inspect the newest log lines without materializing the full file.

*Run the commands in this section to read the last lines with `-Tail`.*
```powershell
Get-Content (Join-Path $env:TEMP 'elysium-reading-demo\pipeline.log') -Tail 2
```
```text
2026-04-14 14:24:03 ERROR [loader.ohlcv] Deadlock detected in writer
2026-04-14 14:24:04 INFO  [loader.ohlcv] Batch complete
```

#### Use `-Raw` only when you need one string

`-Raw` changes the shape of the result from line-by-line output to a single string object. That is useful for whole-file parsing, but it is the wrong default for large log inspection.

*Run the commands in this section to use `-Raw` only when you need one string.*
```powershell
(Get-Content (Join-Path $env:TEMP 'elysium-reading-demo\pipeline.log') -Raw).GetType().FullName
```
```text
System.String
```

### PowerShell | follow and search logs

For ongoing logs, follow the file as it grows. For known patterns, switch to `Select-String` so the result includes match metadata instead of plain text alone.

#### Follow appended lines with `-Wait`

`-Wait` keeps reading as new lines arrive. Pair it with `-Tail 0` when you only want future writes instead of replaying the current file contents first.

> [!info] FileSystem-only follow behavior
>
> `Get-Content -Wait` works only on FileSystem drives, polls once per second, cannot be combined with `-Raw`, and stops if the file is deleted. It follows appended lines well, but it is not a path-reopen equivalent to `tail -F`.

*Run the commands in this section to follow appended lines with `-Wait`.*
```powershell
Get-Content -Path (Join-Path $env:TEMP 'elysium-reading-demo\live.log') -Wait -Tail 0
```
```text
2026-04-14 14:25:00 INFO appended line
2026-04-14 14:25:01 WARN retrying
```

#### Search with context using `Select-String`

`Select-String` is the right tool when you need the match plus surrounding lines. Converting each result to a string keeps the example readable while still showing line numbers and context.

*Run the commands in this section to search with context using `Select-String`.*
```powershell
Select-String -Path (Join-Path $env:TEMP 'elysium-reading-demo\pipeline.log') -Pattern 'ERROR' -Context 1,1 | ForEach-Object { $_.ToString() }
```
```text
  C:\Users\aperi\AppData\Local\Temp\elysium-reading-demo\pipeline.log:3:2026-04-14 14:24:00 WARN  [loader.ohlcv] Retrying after timeout
> C:\Users\aperi\AppData\Local\Temp\elysium-reading-demo\pipeline.log:4:2026-04-14 14:24:01 ERROR [loader.ohlcv] Connection timeout after 30s
  C:\Users\aperi\AppData\Local\Temp\elysium-reading-demo\pipeline.log:5:2026-04-14 14:24:02 INFO  [loader.ohlcv] Retry succeeded
> C:\Users\aperi\AppData\Local\Temp\elysium-reading-demo\pipeline.log:6:2026-04-14 14:24:03 ERROR [loader.ohlcv] Deadlock detected in writer
  C:\Users\aperi\AppData\Local\Temp\elysium-reading-demo\pipeline.log:7:2026-04-14 14:24:04 INFO  [loader.ohlcv] Batch complete
```

#### Count matching lines with `Select-String`

If you only need magnitude before you inspect full context, count the `MatchInfo` results first and expand later only when the number justifies it.

*Run the commands in this section to count matching lines with `Select-String`.*
```powershell
(Select-String -Path (Join-Path $env:TEMP 'elysium-reading-demo\pipeline.log') -Pattern 'ERROR').Count
```
```text
2
```

## Cross-references

- [grep-and-pattern-matching](https://alp78.github.io/elysium/01-Shell/Text-Processing/grep-and-pattern-matching) — move from bounded reads to targeted search
- [navigation-and-listing](https://alp78.github.io/elysium/01-Shell/File-Operations/navigation-and-listing) — find the file before you inspect it
- [finding-files](https://alp78.github.io/elysium/01-Shell/File-Operations/finding-files) — search by path, name, size, or modification time
- [viewing-processes](https://alp78.github.io/elysium/01-Shell/Process-Management/viewing-processes) — correlate log output with the process that produced it
