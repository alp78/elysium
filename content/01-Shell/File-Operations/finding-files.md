---
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell]
aliases: [find, fd, locate, file search, find command, xargs]
keywords: [find, fd, locate, xargs, file search, recursive search, find by name, find by size, find by time, mtime, mmin, find and delete, empty directories, parallel processing, Get-ChildItem, Where-Object, find large files]
description: "Targeted file searching with find, fd, and locate — searching by name pattern, size, modification time, and content. Includes parallel processing with xargs and PowerShell equivalents."
created: 2026-03-22
updated: 2026-04-03
status: complete
---

# Finding Files — Surgical Searching at Scale

> [!quote]
> "UNIX has a couple of hundred system calls, and the `find` command is probably the single most complicated command in the whole system."
>
> — **Brian Kernighan**, *Unix: A History and a Memoir* (2019)

When a pipeline fails and you need to find the offending file across a directory tree with thousands of entries, brute-force listing is not an option. You need targeted search tools that filter by name, size, time, type, and content. The `find` command is universal; `fd` is faster for interactive use; `locate` is instant but potentially stale. While `find` locates files by metadata, [grep-and-pattern-matching](https://alp78.github.io/elysium/01-Shell/Text-Processing/grep-and-pattern-matching) searches inside those files for content — the two tools complement each other in every investigation.

## Linux file finding tools

Linux provides three complementary file search tools: `find` for precise metadata-based searching with action chaining, `fd` for fast interactive use with simpler syntax, and `locate` for instant name-based lookup against a pre-built database. `find` is the backbone of pipeline maintenance scripts; `fd` suits interactive investigation; `locate` is best when you simply need to know where a file was placed.

### Linux | find | searching by metadata

`find` traverses a directory tree in real time and evaluates predicates — name pattern, type, size, modification time — against each file. It can chain multiple predicates in a single command and pass matching files to arbitrary actions via `-exec`. Results reflect the filesystem as it exists right now, with no caching lag.

#### Find files by name and type

`-name` matches the filename only (not the full path). `-type f` restricts to regular files; `d` matches directories, `l` matches symlinks. Patterns are shell globs, not regex — quote them to prevent the shell from expanding `*` before `find` sees it.

```bash
find /data/ -name "*.parquet" -type f
```

```text
/data/raw/2024/01/trades.parquet
/data/raw/2024/01/quotes.parquet
/data/processed/2024/01/esg_scores.parquet
```

> [!tip] -iname and -path variants
>
> `-name "*.CSV"` misses `.csv` files. Use `-iname "*.csv"` to match regardless of case.
> To match a directory structure pattern like `/data/*/staging/*.csv`, use `-path` instead
> of `-name`.

#### Find files by modification time

`-mtime` measures in complete 24-hour periods from the current moment. `-mtime -7` returns files last modified within the past 168 hours. `-mmin -60` narrows to the past 60 minutes. Adding `-daystart` shifts the reference point from "now" to midnight of the current calendar day.

```bash
find /var/log/ -name "*.log" -mtime -7
```

```text
/var/log/pipeline/ingest_2026-03-28.log
/var/log/pipeline/transform_2026-03-29.log
/var/log/pipeline/ingest_2026-03-31.log
```

> [!warning] -mtime -1 is not "today"
>
> `-mtime -1` means "modified less than 24 hours ago from this instant." If you run it at
> 3pm, files modified at 2pm yesterday are included. For "modified today" semantics, use
> `-daystart -mtime 0`. This distinction matters for log rotation and audit scripts.

> [!success] Use -daystart for calendar-day boundaries
>
> `find /var/log/ -name "*.log" -daystart -mtime 0` matches files modified since midnight
> today, regardless of what time the command runs.

#### Find files larger than a threshold

Size suffixes: `c` = bytes, `k` = KiB, `M` = MiB, `G` = GiB. `+` means "greater than." Use this to identify unexpectedly large files from runaway pipeline outputs or unrotated logs.

```bash
find /data/ -type f -size +100M
```

```text
/data/raw/2024/01/full_snapshot.parquet
/data/archive/2023/bonds_universe.parquet
```

#### Find files smaller than a threshold

`-` means "less than." Files smaller than 1 KiB are often empty stubs or corrupt outputs from failed pipeline runs where the process exited before writing any data.

```bash
find /data/ -type f -size -1k
```

```text
/data/staging/failed_run_2026-03-30.csv
/data/staging/empty_output.parquet
```

#### Execute a command on found files

`-exec` runs an arbitrary command on each matched file. `{}` is replaced with the filename. `\;` terminates the command and spawns one process per file. Schedule recurring cleanup jobs via cron — see [linux-scheduling](https://alp78.github.io/elysium/12-Orchestration/Scheduling/linux-scheduling).

```bash
find /var/log/pipeline/ -name "*.log" -mtime +30 -exec rm {} \;
```

> [!tip] Batch with -exec {} + for speed
>
> `\;` spawns one process per file. `+` batches files as arguments to a single process
> (like `xargs`). For 10,000 files: `\;` = 10,000 `rm` invocations. `+` = ~5 `rm`
> invocations. Use `+` unless the command can't handle multiple arguments.

#### Delete found files safely

`-delete` removes matched files directly without spawning `rm`. There is no argument expansion or shell interpretation, which eliminates an entire class of whitespace and quoting bugs. Always preview with `-print` first, then replace `-print` with `-delete`.

> [!todo] Safe delete workflow
>
> 1. Preview what will be deleted:
> 2. Execute once confirmed:

```bash
find /var/log/pipeline/ -name "*.log" -mtime +30 -print
```

```text
/var/log/pipeline/ingest_2026-02-01.log
/var/log/pipeline/transform_2026-02-03.log
/var/log/pipeline/ingest_2026-02-15.log
```

```bash
find /var/log/pipeline/ -name "*.log" -mtime +30 -delete
```

> [!warning] -delete implies -depth
>
> `find` with `-delete` processes children before parents (depth-first). This means
> directories are deleted after their contents — which is correct. But combining `-delete`
> with `-prune` doesn't work as expected because `-depth` and `-prune` are incompatible.

> [!success] Use -type f to restrict deletion to files only
>
> Add `-type f` before `-delete` to avoid removing directories even if the predicate
> matches a directory name: `find /var/log/pipeline/ -name "*.log" -mtime +30 -type f -delete`.

#### Find empty directories

Empty directories accumulate after pipeline processing moves files out of staging areas. Periodic cleanup with `-empty` prevents directory clutter from interfering with `find` traversals.

```bash
find /data/staging/ -type d -empty
```

```text
/data/staging/2026-03-01
/data/staging/2026-03-15
/data/staging/tmp
```

#### Find files modified today

`-daystart` shifts the time reference from "right now" to midnight of the current day. Combined with `-mtime 0`, this returns files modified since midnight — useful for verifying what a pipeline touched during today's run.

```bash
find /data/ -type f -daystart -mtime 0
```

```text
/data/raw/2026-04-03/trades.parquet
/data/processed/2026-04-03/esg_scores.parquet
```

#### Locate large files to free disk space

Starting from the filesystem root with `2>/dev/null` suppresses permission-denied errors from directories the current user cannot read. Piping through `head -20` prevents overwhelming output on systems with many large files. This is a key diagnostic step in the SQL Server disk-full runbook.

```bash
find / -type f -size +1G 2>/dev/null | head -20
```

```text
/var/lib/docker/overlay2/abc123/diff/large_layer.tar
/data/archive/2023/full_snapshot.parquet
/home/aperi/downloads/ubuntu-22.04.iso
```

#### Find files by owner or group

`-user` and `-group` restrict results to files owned by a specific user or group. Useful for auditing which service account wrote files to a shared directory, or tracking down files created by a runaway process under the wrong owner.

```bash
find /data/ -type f -user pipeline_svc
find /data/ -type f -group data_team
```

#### Find files newer than a reference file

`-newer <ref>` returns files whose modification time is later than the reference file's modification time. This is more reliable than `-mtime` for comparing against a specific event such as the last successful pipeline output.

```bash
find /data/ -type f -newer /data/processed/last_run_marker.txt
```

#### Limit traversal depth

`-maxdepth` prevents `find` from descending below a specified number of directory levels. `-mindepth` skips files at or above a specified level. Both are evaluated before other predicates, making them an efficient way to constrain the search space on deep trees.

```bash
find /data/ -maxdepth 2 -name "*.csv"
find /data/ -mindepth 3 -type f -empty
```

| Flag | Syntax | Description |
|---|---|---|
| `-name` | `find <path> -name "*.csv"` | Match by filename glob (case-sensitive) |
| `-iname` | `find <path> -iname "*.CSV"` | Match by filename glob (case-insensitive) |
| `-path` | `find <path> -path "*/staging/*"` | Match against full path pattern |
| `-type` | `find <path> -type f` | Filter by type: `f` file, `d` directory, `l` symlink |
| `-size` | `find <path> -size +100M` | Filter by size; suffixes: `c` bytes, `k` KiB, `M` MiB, `G` GiB. `+` = greater than, `-` = less than |
| `-mtime` | `find <path> -mtime -7` | Modified within N×24h periods. `+N` = older than, `-N` = newer than |
| `-mmin` | `find <path> -mmin -60` | Modified within N minutes |
| `-daystart` | `find <path> -daystart -mtime 0` | Shift time reference to start of today (midnight) |
| `-newer` | `find <path> -newer ref.txt` | Modified more recently than `ref.txt` |
| `-user` | `find <path> -user svc` | Owned by specified user |
| `-group` | `find <path> -group team` | Owned by specified group |
| `-perm` | `find <path> -perm /660` | Match by permission bits (`/` = any bit set, `-` = all bits set) |
| `-maxdepth` | `find <path> -maxdepth 2` | Limit traversal to N levels deep |
| `-mindepth` | `find <path> -mindepth 3` | Skip files fewer than N levels deep |
| `-empty` | `find <path> -type d -empty` | Match empty files or directories |
| `-exec` | `find <path> -exec cmd {} \;` | Run command on each result (`\;` = per file, `+` = batched) |
| `-delete` | `find <path> -type f -delete` | Delete matched files (implies `-depth`) |
| `-print` | `find <path> -print` | Print matched paths (default behavior) |
| `-print0` | `find <path> -print0` | Print paths separated by null bytes (safe for xargs) |
| `-not` / `!` | `find <path> -not -name "*.csv"` | Negate a predicate |
| `-o` | `find <path> -name "*.csv" -o -name "*.parquet"` | OR operator between predicates |
| `-prune` | `find <path> -path "*/tmp" -prune -o -print` | Skip matching directory subtrees |

### Linux | find | parallel processing with xargs

`xargs` reads a list of arguments from standard input and passes them in batches to a command. Combined with `find -print0`, it becomes a robust parallel execution engine for file operations — compression, checksum calculation, format conversion, or any CPU-bound per-file task.

#### Run parallel operations on found files

`-print0` outputs filenames separated by null bytes instead of newlines, making it safe for any filename including those with spaces, quotes, or special characters. `xargs -0` reads null-delimited input. `-P 4` runs 4 worker processes in parallel — tune this to the number of available cores for CPU-bound tasks.

```bash
find /data/ -name "*.csv" -print0 | xargs -0 -P 4 gzip
```

> [!danger] Always pair -print0 with xargs -0
>
> Without `-print0`, filenames containing spaces or quotes cause `xargs` to split them
> into multiple arguments. `file with spaces.csv` becomes three arguments: `file`, `with`,
> `spaces.csv`. This can target wrong files — or worse, delete unintended files.
> See [defensive-scripting](https://alp78.github.io/elysium/01-Shell/Scripting/defensive-scripting) for more null-delimiter patterns.

> [!success] The -print0 | xargs -0 pair is always safe
>
> `find /data/ -name "*.csv" -print0 | xargs -0 -P 4 gzip` handles any filename
> regardless of whitespace or special characters. This pair is the standard safe idiom.

| Flag | Syntax | Description |
|---|---|---|
| `-0` | `xargs -0` | Read null-delimited input (pair with `find -print0`) |
| `-P` | `xargs -P 4` | Run up to N processes in parallel |
| `-n` | `xargs -n 1` | Pass N arguments per command invocation |
| `-I` | `xargs -I {} cmd {}` | Replace `{}` with each argument (like `-exec`) |
| `-a` | `xargs -a file.txt` | Read arguments from a file instead of stdin |
| `--no-run-if-empty` | `xargs --no-run-if-empty cmd` | Do not run command if stdin is empty |
| `-t` | `xargs -t cmd` | Print each command before executing (dry-run visibility) |

### Linux | fd | interactive search

`fd` is a modern alternative to `find`, written in Rust. It searches recursively from the current directory by default, respects `.gitignore` and `.fdignore` files, and uses a simpler syntax without requiring quoted globs. It is 5–10x faster than `find` on large directory trees due to parallel traversal. Install with `apt install fd-find` (Debian/Ubuntu) or `brew install fd` (macOS) — the binary may be named `fdfind` on some distributions; use `alias fd=fdfind` if needed.

#### Find files by name pattern

`fd` treats the first argument as a regex, not a shell glob. To match a file extension, use `\.parquet$` (anchored to the end of the filename) or simply `parquet` as a substring match. The search path is an optional second argument; omit it to search the current directory.

```bash
fd "\.parquet$" /data/
```

```text
/data/raw/2024/01/trades.parquet
/data/processed/2024/01/esg_scores.parquet
```

#### Find files modified recently

`--changed-within` accepts human-readable durations: `7d`, `2h`, `30min`. This is equivalent to `find -mtime` but with a more readable syntax and no 24-hour period rounding.

```bash
fd --changed-within 7d . /var/log/
```

```text
/var/log/pipeline/ingest_2026-03-28.log
/var/log/pipeline/transform_2026-03-31.log
```

#### Find files by type

`-t f` restricts to files, `-t d` to directories, `-t l` to symlinks, `-t x` to executables. Combine with a pattern for precise filtering.

```bash
fd -t f "\.csv$" /data/staging/
```

| Flag | Syntax | Description |
|---|---|---|
| `-t` | `fd -t f "pattern"` | Filter by type: `f` file, `d` directory, `l` symlink, `x` executable |
| `-e` | `fd -e csv` | Filter by file extension (shorthand for `\.csv$`) |
| `-H` | `fd -H "pattern"` | Include hidden files (dotfiles) |
| `-I` | `fd -I "pattern"` | Ignore `.gitignore` and `.fdignore` rules |
| `--changed-within` | `fd --changed-within 7d` | Files modified within a duration (`1h`, `7d`, `2weeks`) |
| `--changed-before` | `fd --changed-before 30d` | Files not modified within a duration |
| `-s` | `fd -s "Pattern"` | Case-sensitive search (default is smart-case) |
| `-x` | `fd -e csv -x gzip` | Execute a command on each result (like `find -exec {} \;`) |
| `-X` | `fd -e csv -X gzip` | Execute a command with all results batched (like `-exec {} +`) |
| `--max-depth` | `fd --max-depth 2` | Limit traversal depth |
| `-l` | `fd -l "pattern"` | Long listing format (like `ls -l`) |

### Linux | locate | database search

`locate` queries a pre-built file index rather than traversing the filesystem in real time. Searches that would take seconds with `find` complete in milliseconds. The database is maintained by `updatedb`, which typically runs as a daily cron job. Results may be up to 24 hours stale — files created or deleted since the last `updatedb` run will not be reflected.

#### Search for files by name pattern

`locate` matches the pattern as a substring of the full path by default. Use `--basename` to restrict matching to the filename only, equivalent to `find -name`.

```bash
locate "*.parquet"
locate --basename "trades.parquet"
```

```text
/data/raw/2024/01/trades.parquet
/data/raw/2024/02/trades.parquet
```

#### Update the file index

`updatedb` rebuilds the index by traversing the filesystem. It reads `/etc/updatedb.conf` to determine which directories to exclude (typically network mounts and `/proc`). Run it manually after large file operations if `locate` results are stale.

```bash
sudo updatedb
```

| Flag | Syntax | Description |
|---|---|---|
| `--basename` | `locate --basename "pattern"` | Match against filename only, not full path |
| `-c` | `locate -c "pattern"` | Print count of matching entries only |
| `-i` | `locate -i "pattern"` | Case-insensitive search |
| `-l` | `locate -l 20 "pattern"` | Limit output to N results |
| `-r` | `locate -r "regex"` | Use a POSIX regex pattern |
| `-e` | `locate -e "pattern"` | Verify each result still exists on disk before printing |
| `--statistics` | `locate --statistics` | Print database statistics (last update time, entry count) |

### Linux | find vs fd vs locate | choosing the right tool

All three tools find files but differ in speed, result freshness, and predicate power. The right choice depends on whether you need real-time results, complex predicates, or just interactive speed.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {
  'primaryColor': '#292e42',
  'primaryTextColor': '#c0caf5',
  'primaryBorderColor': '#565f89',
  'lineColor': '#565f89',
  'secondaryColor': '#1a1b26',
  'tertiaryColor': '#24283b',
  'noteTextColor': '#c0caf5',
  'noteBkgColor': '#292e42',
  'textColor': '#c0caf5',
  'fontSize': '14px'
}}}%%
flowchart TD
    A([Need to find a file]) --> B{Results must be\ncurrent / real-time?}
    B -- Yes --> C{Complex predicates?\nsize, mtime, exec...}
    B -- No --> D[locate\nInstant from index\nMay be up to 24h stale]
    C -- Yes --> E[find\nFull predicate support\nChain -exec, -delete]
    C -- No --> F{Respecting .gitignore\nor need speed?}
    F -- Yes --> G[fd\n5–10x faster than find\nSimpler regex syntax]
    F -- No --> E

    style D fill:#292e42,stroke:#565f89
    style E fill:#292e42,stroke:#565f89
    style G fill:#292e42,stroke:#565f89
```

> [!tip] find vs fd vs locate
>
> - `find` is universal but single-threaded and slow on large trees. Best for: `-exec`, `-delete`, complex multi-predicate scripts.
> - `fd` (install: `apt install fd-find`) is 5–10x faster, respects `.gitignore`, has simpler syntax. Best for: interactive searching during investigation.
> - `locate` uses a pre-built database updated by `updatedb` cron — instant results but stale by up to 24 hours. Best for: "where did I put that file last week?"

## PowerShell file finding tools

PowerShell's `Get-ChildItem` is the primary recursive search cmdlet, returning rich `FileInfo` and `DirectoryInfo` objects that pipe into `Where-Object` for predicate filtering. `Select-String` handles content search. For parallel file processing, `ForEach-Object -Parallel` is the equivalent of `find | xargs -P`.

### PowerShell | Get-ChildItem | searching by metadata

`Get-ChildItem` traverses a directory tree and returns filesystem objects. `-Filter` is applied at the provider level (fast, before PowerShell processes results). `-Recurse` enables recursive traversal. Pipe the output to `Where-Object` for predicates that `-Filter` cannot express — size ranges, time comparisons, and custom conditions.

#### Find files by name pattern

`-Filter` accepts a single glob pattern applied at the filesystem provider level before results enter the pipeline — this is faster than piping to `Where-Object`. `-File` restricts output to files only (`-Directory` for directories).

```powershell
Get-ChildItem -Path "C:\data\" -Filter "*.parquet" -Recurse -File
```

```text
    Directory: C:\data\raw\2024\01

Mode                 LastWriteTime         Length Name
----                 -------------         ------      ----
-a---          2024-01-15  09:32        1048576 trades.parquet
-a---          2024-01-15  09:33         524288 quotes.parquet
```

#### Find files by size

Pipe into `Where-Object` for predicate filtering. PowerShell understands `KB`, `MB`, `GB` literals natively. `Length` is the file size in bytes; comparison operators `-gt`, `-lt`, `-ge`, `-le` work directly against these literals.

```powershell
Get-ChildItem -Path "C:\data\" -Recurse -File |
    Where-Object Length -gt 100MB
```

```text
Mode                 LastWriteTime         Length Name
----                 -------------         ------      ----
-a---          2024-01-15  10:00     157286400 full_snapshot.parquet
```

#### Find files by modification time

`(Get-Date).AddDays(-7)` creates a `DateTime` object for 7 days ago. Compare against `LastWriteTime` for modification time, `CreationTime` for creation date, or `LastAccessTime` for last access. Script block syntax is required when the comparison is not a simple binary operator.

```powershell
Get-ChildItem -Path "C:\data\" -Recurse -File |
    Where-Object { $_.LastWriteTime -gt (Get-Date).AddDays(-7) }
```

```text
Mode                 LastWriteTime         Length Name
----                 -------------         ------      ----
-a---          2026-03-28  14:22         131072 ingest_2026-03-28.log
-a---          2026-03-31  09:15         204800 transform_2026-03-31.log
```

#### Find empty directories

PowerShell has no built-in "empty directory" filter. Check each directory's child count with a nested `Get-ChildItem`. Include `-Force` to count hidden files — otherwise a directory containing only hidden files appears empty and is incorrectly flagged.

```powershell
Get-ChildItem -Path "C:\data\" -Recurse -Directory |
    Where-Object { (Get-ChildItem $_.FullName -Force).Count -eq 0 }
```

```text
    Directory: C:\data\staging

Mode                 LastWriteTime         Length Name
----                 -------------         ------      ----
d----          2026-03-01  00:00              - 2026-03-01
d----          2026-03-15  00:00              - 2026-03-15
```

#### Run parallel operations on found files

`ForEach-Object -Parallel` runs a script block concurrently across multiple runspaces — the PowerShell equivalent of `find | xargs -P`. `-ThrottleLimit` sets the maximum number of concurrent threads (default is 5). Use `$_` inside the block to reference each piped object.

```powershell
Get-ChildItem -Path "C:\data\" -Filter "*.csv" -Recurse -File |
    ForEach-Object -Parallel {
        Compress-Archive -Path $_.FullName -DestinationPath "$($_.FullName).zip"
    } -ThrottleLimit 4
```

> [!tip] -ThrottleLimit tuning
>
> For CPU-bound tasks (compression, hashing), match `-ThrottleLimit` to logical core count:
> `$ThrottleLimit = (Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors`.
> For I/O-bound tasks, higher values (8–16) are often more effective.

| Parameter | Syntax | Description |
|---|---|---|
| `-Path` | `-Path "C:\data\"` | Root directory for the search |
| `-Filter` | `-Filter "*.csv"` | Glob pattern applied at provider level (fast) |
| `-Recurse` | `-Recurse` | Traverse subdirectories |
| `-File` | `-File` | Return only files (equivalent to `find -type f`) |
| `-Directory` | `-Directory` | Return only directories (equivalent to `find -type d`) |
| `-Depth` | `-Depth 2` | Limit recursion to N levels (equivalent to `find -maxdepth`) |
| `-Force` | `-Force` | Include hidden and system files |
| `-Include` | `-Include "*.csv","*.parquet"` | Include multiple patterns (requires `-Recurse`) |
| `-Exclude` | `-Exclude "*.tmp"` | Exclude matching files from results |
| `Length` | `Where-Object Length -gt 100MB` | File size in bytes (filter with `Where-Object`) |
| `LastWriteTime` | `Where-Object { $_.LastWriteTime -gt ... }` | Modification timestamp |
| `CreationTime` | `Where-Object { $_.CreationTime -gt ... }` | Creation timestamp |

### PowerShell | Select-String | content search

`Select-String` searches file contents using .NET regex and returns `MatchInfo` objects containing `Filename`, `LineNumber`, `Line`, and `Matches` properties. It is the PowerShell equivalent of `grep -rn`. For the Linux equivalent, see [grep-and-pattern-matching](https://alp78.github.io/elysium/01-Shell/Text-Processing/grep-and-pattern-matching).

#### Search file contents by pattern

`-Path` accepts glob patterns including `**\*` for recursive matching. `-Pattern` is a .NET regex. The returned objects can be piped to `Select-Object` or `Format-Table` to display specific properties.

```powershell
Select-String -Path "C:\pipeline\**\*.py" -Pattern "deadlock" -Recurse
```

```text
C:\pipeline\jobs\ingest.py:142:    raise RuntimeError("deadlock detected in queue consumer")
C:\pipeline\jobs\transform.py:87:    # TODO: investigate deadlock under high concurrency
```

| Parameter | Syntax | Description |
|---|---|---|
| `-Path` | `-Path "C:\dir\**\*.py"` | File path with optional glob |
| `-Pattern` | `-Pattern "regex"` | .NET regex to search for |
| `-Recurse` | `-Recurse` | Search subdirectories |
| `-CaseSensitive` | `-CaseSensitive` | Enable case-sensitive matching (default: insensitive) |
| `-SimpleMatch` | `-SimpleMatch` | Treat pattern as a literal string, not regex |
| `-List` | `-List` | Return only the first match per file (like `grep -l`) |
| `-NotMatch` | `-NotMatch` | Return lines that do NOT match the pattern |
| `-Context` | `-Context 2,3` | Include N lines before and M lines after each match |
| `-Encoding` | `-Encoding UTF8` | Specify file encoding |

## Related
- [navigation-and-listing](https://alp78.github.io/elysium/01-Shell/File-Operations/navigation-and-listing) — listing directories before searching
- [reading-file-contents](https://alp78.github.io/elysium/01-Shell/Text-Processing/reading-file-contents) — reading the files you find
- [file-manipulation](https://alp78.github.io/elysium/01-Shell/File-Operations/file-manipulation) — deleting or moving files found by `find`
- [brace-expansion-and-globbing](https://alp78.github.io/elysium/01-Shell/Scripting/brace-expansion-and-globbing) — globbing patterns complement `find`
