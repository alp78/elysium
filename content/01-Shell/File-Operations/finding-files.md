---
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell, bash, linux, powershell]
aliases: [find, fd, locate, file search, find command, xargs]
keywords: [find, fd, locate, xargs, file search, recursive search, find by name, find by size, find by time, mtime, mmin, find and delete, empty directories, parallel processing, Get-ChildItem, Where-Object, find large files]
description: "Targeted file searching with find, fd, and locate — searching by name pattern, size, modification time, and content. Includes parallel processing with xargs and PowerShell equivalents."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Finding Files — Surgical Searching at Scale

> [!quote]
> "UNIX has a couple of hundred system calls, and the `find` command is probably the single most complicated command in the whole system."
> — **Brian Kernighan**, *Unix: A History and a Memoir* (2019)

When a pipeline fails and you need to find the offending file across a directory tree with thousands of entries, brute-force listing is not an option. You need targeted search tools that filter by name, size, time, type, and content. The `find` command is universal; `fd` is faster for interactive use; `locate` is instant but potentially stale. While `find` locates files by metadata, [grep-and-pattern-matching](https://alp78.github.io/elysium/01-Shell/Text-Processing/grep-and-pattern-matching) searches inside those files for content -- the two tools complement each other in every investigation.

## Linux — find, fd, locate

#### find -name -type — find by name pattern

> [!info] find by name and type
>
> `-name` matches the filename only (not the path). `-type f` restricts to
> regular files (`d` = directories, `l` = symlinks). Patterns are shell globs, not regex
> — quote them to prevent the shell from expanding `*` before `find` sees it.

```bash
find /data/ -name "*.parquet" -type f
```

> [!tip] -iname and -path variants
>
> `-name "*.CSV"` misses `.csv` files. Use `-iname "*.csv"` to match regardless of case.
> To match a directory structure pattern like `/data/*/staging/*.csv`, use `-path` instead
> of `-name`.

#### find -mtime -mmin — find by modification time

> [!info] mtime measures 24-hour periods
>
> `-mtime` measures in 24-hour periods from **right now**, not from midnight.
> `-mtime -7` = modified within the last 168 hours. `-mmin -60` = modified within the
> last 60 minutes. Use `-daystart` if you need calendar-day boundaries.

```bash
find /var/log/ -name "*.log" -mtime -7
```

> [!warning] -mtime -1 is not "today"
>
> `-mtime -1` means "modified less than 24 hours ago from this instant." If you run it at
> 3pm, files modified at 2pm yesterday are included. For "modified today" semantics, use
> `-daystart -mtime 0`. This distinction matters for log rotation and audit scripts.

#### find -size — find by file size

> [!info] find -size suffixes
>
> Size suffixes: `c` = bytes, `k` = KiB, `M` = MiB, `G` = GiB. `+` means
> "greater than," `-` means "less than." Files smaller than 1k are often empty stubs or
> corrupt outputs from failed pipeline runs.

```bash
find /data/ -type f -size +100M
find /data/ -type f -size -1k
```

#### find -exec, find -delete — find and execute on results

> [!info] find -exec usage
>
> `-exec` runs a command on each found file. `{}` is the placeholder for the
> filename. `\;` terminates the command (one invocation per file). Schedule cleanup
> jobs via cron — see [linux-scheduling](https://alp78.github.io/elysium/12-Orchestration/Scheduling/linux-scheduling).

```bash
find /var/log/pipeline/ -name "*.log" -mtime +30 -exec rm {} \;
```

> [!tip] Batch with -exec {} + for speed
>
> `\;` spawns one process per file. `+` batches files as arguments to a single process
> (like `xargs`). For 10,000 files: `\;` = 10,000 `rm` invocations. `+` = ~5 `rm`
> invocations. Use `+` unless the command can't handle multiple arguments.

#### find -delete — safer alternative to -exec rm

> [!info] find -delete safety
>
> `-delete` removes found files directly without spawning `rm`. It's safer because
> there's no argument expansion or shell interpretation. Always `find ... -print` first to
> review what will be deleted, then change `-print` to `-delete`.

```bash
find /var/log/pipeline/ -name "*.log" -mtime +30 -print
find /var/log/pipeline/ -name "*.log" -mtime +30 -delete
```

> [!warning] -delete implies -depth
>
> `find` with `-delete` processes children before parents. This means directories are
> deleted after their contents — which is correct. But combining `-delete` with `-prune`
> doesn't work as expected because `-depth` and `-prune` are incompatible.

#### find -empty, find -daystart — empty dirs and today's files

> [!info] Finding empty directories
>
> Empty directories are commonly left behind after pipeline processing moves
> files out of staging areas. Periodic cleanup prevents directory clutter.

```bash
find /data/staging/ -type d -empty
```

#### find -daystart -mtime 0 — find files modified today

> [!info] -daystart for calendar-day matching
>
> `-daystart` shifts the time reference from "now" to "start of today" (midnight).
> Combined with `-mtime 0`, this finds files modified since midnight — useful for checking
> what a pipeline touched during today's run.

```bash
find /data/ -type f -daystart -mtime 0
```

#### find -size +1G — find large files consuming disk space

> [!info] Find large files consuming disk
>
> A key step in the sql server disk full runbook. Pipe through `head` to avoid
> overwhelming output. `2>/dev/null` suppresses permission-denied errors from system
> directories you can't read.

```bash
find / -type f -size +1G 2>/dev/null | head -20
```

#### find -print0 | xargs -0 -P — parallel processing of found files

> [!info] Null-delimited parallel processing
>
> `-print0` outputs filenames separated by null bytes instead of newlines,
> making it safe for any filename. `xargs -0` reads null-delimited input. `-P 4` runs
> 4 processes in parallel — scales linearly with cores for CPU-bound tasks like compression.

```bash
find /data/ -name "*.csv" -print0 | xargs -0 -P 4 gzip
```

> [!danger] Always use -print0 with xargs -0
>
> Without `-print0`, filenames containing spaces or quotes cause `xargs` to split them
> into multiple arguments. `file with spaces.csv` becomes three arguments: `file`, `with`,
> `spaces.csv`. This can target wrong files — or worse, delete unintended files.
> See [defensive-scripting](https://alp78.github.io/elysium/01-Shell/Scripting/defensive-scripting) for more null-delimiter patterns.

### find vs fd vs locate — tool comparison

> [!tip] find vs fd vs locate
>
> - `find` is universal but single-threaded and slow on large trees. Good for: combining with `-exec`, complex predicates.
> - `fd` (install: `apt install fd-find`) is 5-10x faster, respects `.gitignore`, has a simpler syntax: `fd "\.parquet$" /data/`. Use it for interactive searching.
> - `locate` uses a pre-built database (updated by `updatedb` cron): `locate "*.parquet"` — instant results but stale by up to 24 hours. Good for: "where did I put that file last week?"

## PowerShell — Get-ChildItem, Where-Object, Select-String

#### Get-ChildItem -Filter — find files by name pattern

> [!info] Get-ChildItem -Filter
>
> `-Filter` is applied at the filesystem provider level (fast). `-Recurse` searches
> subdirectories. `-File` restricts to files only (`-Directory` for directories).

```powershell
Get-ChildItem -Path "C:\data\" -Filter "*.parquet" -Recurse -File
```

#### Get-ChildItem | Where-Object — find files by size

> [!info] Filter by size with Where-Object
>
> Pipe into `Where-Object` for predicate filtering. PowerShell understands
> `KB`, `MB`, `GB` literals natively — no conversion math needed.

```powershell
Get-ChildItem -Path "C:\data\" -Recurse -File |
    Where-Object Length -gt 100MB
```

#### Get-ChildItem | Where-Object LastWriteTime — find files by modification time

> [!info] Filter by modification time
>
> `(Get-Date).AddDays(-7)` creates a DateTime object for 7 days ago. Compare
> against `LastWriteTime` for modification time or `CreationTime` for creation date.

```powershell
Get-ChildItem -Path "C:\data\" -Recurse -File |
    Where-Object { $_.LastWriteTime -gt (Get-Date).AddDays(-7) }
```

#### Get-ChildItem -Directory — find empty directories

> [!info] Find empty directories in PowerShell
>
> PowerShell has no built-in "empty directory" filter. Check each directory's
> child count. Include `-Force` so hidden files are counted — otherwise a directory
> containing only hidden files appears empty.

```powershell
Get-ChildItem -Path "C:\data\" -Recurse -Directory |
    Where-Object { (Get-ChildItem $_.FullName -Force).Count -eq 0 }
```

#### Select-String — search file contents (PowerShell grep)

> [!info] Select-String searches content
>
> `Select-String` searches file contents by regex and returns structured objects
> with `Filename`, `LineNumber`, and `Line` properties. Use `**\*` glob for recursive
> search. For the Linux equivalent, see [grep-and-pattern-matching](https://alp78.github.io/elysium/01-Shell/Text-Processing/grep-and-pattern-matching).

```powershell
Select-String -Path "C:\pipeline\**\*.py" -Pattern "deadlock" -Recurse
```

## Related
- [navigation-and-listing](https://alp78.github.io/elysium/01-Shell/File-Operations/navigation-and-listing) — listing directories before searching
- [reading-file-contents](https://alp78.github.io/elysium/01-Shell/Text-Processing/reading-file-contents) — reading the files you find
- [file-manipulation](https://alp78.github.io/elysium/01-Shell/File-Operations/file-manipulation) — deleting or moving files found by `find`
- [brace-expansion-and-globbing](https://alp78.github.io/elysium/01-Shell/Scripting/brace-expansion-and-globbing) — globbing patterns complement `find`
