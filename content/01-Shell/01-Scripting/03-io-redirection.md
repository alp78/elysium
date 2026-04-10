---
title: "03 - I/O Redirection"
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell, scripting]
aliases: [IO redirection, I/O redirection, output redirection, stderr redirect, stdin redirect, file descriptors]
keywords: [redirection, stdout, stderr, stdin, file descriptor, dev null, redirect output, redirect error, tee, append, overwrite, fd 0, fd 1, fd 2, 2>&1, output to file]
description: "How to redirect stdin, stdout, and stderr to files, other streams, or /dev/null in bash and PowerShell, including production logging patterns and common gotchas."
parent: "[[domain-script-engineering]]"
links:
  - "[[02-command-history]]"
  - "[[04-command-chaining]]"
  - "[[06-process-substitution]]"
  - "[[05-brace-expansion-and-globbing]]"
  - "[[01-environment-variables]]"
  - "[[07-defensive-scripting]]"
  - "[[01-bash-automation]]"
  - "[[02-powershell-automation]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# I/O Redirection — Controlling Where Output Goes

Every process has three standard file descriptors: fd 0 (stdin) for input, fd 1 (stdout) for normal output, and fd 2 (stderr) for error messages. Redirection lets you reroute these streams to files, other streams, or `/dev/null` (the void). Mastering redirection is essential for logging pipeline runs, suppressing noise, and separating errors from normal output.

> [!quote]
> "Expect the output of every program to become the input to another, as yet unknown, program."
>
> — **Doug McIlroy**, *Bell System Technical Journal* (1978)
>
> "Rule of Silence: When a program has nothing surprising to say, it should say nothing."
>
> — **Eric S. Raymond**, *The Art of Unix Programming* (2003)

The diagram below shows how the three standard file descriptors relate to a running process and where each redirection operator reroutes them.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {'primaryColor': '#292e42','primaryTextColor': '#c0caf5','primaryBorderColor': '#565f89','lineColor': '#565f89','secondaryColor': '#1a1b26','tertiaryColor': '#24283b','noteTextColor': '#c0caf5','noteBkgColor': '#292e42','textColor': '#c0caf5','fontSize': '14px'}}}%%
flowchart LR
    stdin["fd 0\nstdin"]
    proc["Process"]
    stdout["fd 1\nstdout"]
    stderr["fd 2\nstderr"]
    file1["file / log"]
    file2["error log"]
    devnull["/dev/null\n(discard)"]
    teenode["tee\n(split)"]
    terminal["Terminal"]

    stdin -- "< file" --> proc
    proc --> stdout
    proc --> stderr
    stdout -- "> file\n>> file" --> file1
    stderr -- "2> file" --> file2
    stdout -- "&> / > f 2>&1" --> file1
    stderr -- "2>&1" --> stdout
    stdout -- "| tee -a" --> teenode
    teenode --> file1
    teenode --> terminal
    stdout -- "> /dev/null\n*> $null" --> devnull
    stderr -- "2>/dev/null" --> devnull
```


## Key terms used in this note

| Term | Plain-English definition | Why it matters here | Common mistake / confusion |
|---|---|---|---|
| File descriptor (fd) | A small integer that the operating system assigns to each open file, socket, or stream within a process. Every process starts with three: fd 0 (stdin), fd 1 (stdout), fd 2 (stderr). | All redirection operators work by reassigning file descriptors — understanding the numbered model is required for correct combined redirections. | Thinking stdin/stdout/stderr are special objects. They are just file descriptors 0, 1, and 2, and the shell can reroute them like any other fd. |
| stdin (fd 0) | Standard input — the default source of data for a process. For an interactive shell, stdin is the keyboard. | Input redirection (`<`, `<<`, `<<<`) replaces the keyboard with a file or inline text. | Forgetting that piping (`\|`) connects the previous command's stdout to the next command's stdin — not to a file. |
| stdout (fd 1) | Standard output — the default destination for a process's normal (non-error) output. For an interactive shell, stdout is the terminal screen. | Output redirection (`>`, `>>`) reroutes stdout to a file instead of the terminal. | Not realizing that `>` truncates the target file to zero bytes before the command starts — data loss if input and output are the same file. |
| stderr (fd 2) | Standard error — a separate output stream reserved for error messages, warnings, and diagnostics. | Separating stderr from stdout lets you log errors independently and prevents error messages from corrupting data in stdout. | Assuming all output goes to the same place. Without `2>&1`, stderr still flows to the terminal even when stdout is redirected to a file. |
| `/dev/null` | A special file on Unix/Linux that discards all data written to it and returns EOF on read. PowerShell uses `$null` for the same purpose. | Used to silence noisy commands when you only care about the exit code (e.g., connectivity checks, existence tests). | On Windows/PowerShell, writing `> /dev/null` does not work — use `> $null` or `Out-Null` instead. |
| `tee` / `Tee-Object` | A command that splits its input: one copy goes to a file, the other continues to stdout. Named after a T-shaped plumbing pipe fitting. | The standard pattern for simultaneously monitoring a long-running job on screen and saving a persistent log file. | Forgetting to add `-a` (bash) or `-Append` (PowerShell) when you want to preserve previous log content rather than overwrite. |
| Here-document (`<<`) | A shell construct that feeds multi-line inline text to a command's stdin without creating a temporary file. Delimited by a user-chosen word (e.g., `EOF`). | Used to embed SQL scripts, configuration blocks, or multi-line strings directly in shell scripts. | Not quoting the delimiter (`<<'EOF'` vs `<<EOF`). Without quotes, `$variables` and backticks inside the block are expanded — potentially injecting unintended values. |
| Here-string (`<<<`) | A bash construct that feeds a single string to a command's stdin. More efficient than `echo "text" \| command` because it avoids a subshell. | Quick way to feed short values to tools like `base64`, `bc`, `jq`, or `read`. | Only available in bash (not POSIX sh). Scripts starting with `#!/bin/sh` cannot use `<<<`. |
| `2>&1` | A redirection expression that duplicates fd 2 (stderr) into fd 1 (stdout), merging both streams. | Required for capturing both normal output and errors in the same file or pipe. | Placing `2>&1` before `>` — at that point fd 1 still points to the terminal, so stderr goes to the terminal instead of the file. |
| PowerShell streams | PowerShell defines six numbered output streams: 1 (Success), 2 (Error), 3 (Warning), 4 (Verbose), 5 (Debug), 6 (Information). The `*>` operator targets all six. | More granular than Unix's two-stream model — allows selectively capturing warnings, verbose output, or debug traces. | Assuming `2>` captures everything on the error path. Warnings are stream 3, not stream 2 — they require `3>` or `*>` to capture. |
| `noclobber` / `set -C` | A bash option that prevents `>` from overwriting existing files. When enabled, `>` fails if the target file exists — you must use `>\|` to force overwrite. | A safety net against accidental overwrites of important output files in automated scripts. | Not knowing that `>\|` bypasses `noclobber`. The operator is `>\|`, not `>!` (which is csh syntax). |

## What this note covers

- The three standard file descriptors (stdin, stdout, stderr) and their numbered identifiers
- Output redirection operators: overwrite (`>`), append (`>>`), stderr (`2>`), combined (`2>&1`, `&>`), discard (`/dev/null`)
- Input redirection: files (`<`), here-documents (`<<`), here-strings (`<<<`)
- Splitting output with `tee` (Linux) and `Tee-Object` (PowerShell) for production logging
- Common gotchas: redirect-before-write, wrong `2>&1` ordering
- PowerShell's six-stream model and extended redirection operators
- PowerShell here-strings (`@"..."@`, `@'...'@`)

## Linux I/O redirection tools

Bash uses file-descriptor numbers (0, 1, 2) and symbolic operators (`>`, `>>`, `<`, `2>`, `&>`) to redirect streams. All operators act on the shell level before the target command starts, which is critical for understanding ordering rules and the redirect-before-write gotcha documented below.

### Linux | redirection | output operators

The output redirection operators control where fd 1 (stdout) and fd 2 (stderr) are written. Understanding their evaluation order is required for correct combined redirections.

#### Redirect stdout to a file (overwrite)

The `>` operator opens the target file and truncates it to zero bytes before the command starts, then connects fd 1 to that file. If the file does not exist it is created. If it already exists all previous content is lost.

```bash
command > output.txt
```

#### Redirect stdout to a file (append)

The `>>` operator opens the target file in append mode so existing content is preserved. New output is written after the last byte. This is safe for log aggregation across multiple runs.

```bash
command >> output.txt
```

#### Redirect stderr to a file

The `2>` operator connects fd 2 (stderr) to the target file. Normal output (fd 1) still flows to the terminal. Use this when you want to capture error messages separately for later analysis while keeping live output visible.

```bash
command 2> errors.txt
```

#### Redirect both stdout and stderr to the same file

The `2>&1` expression redirects fd 2 to wherever fd 1 currently points. The ordering is strict: `> all.txt` must appear first to redirect fd 1 to the file, then `2>&1` redirects fd 2 to that same destination. Reversing the order (`2>&1 > all.txt`) redirects fd 2 to the terminal (the original location of fd 1) and only fd 1 ends up in the file.

```bash
command > all.txt 2>&1
```

#### Redirect both stdout and stderr — bash 4+ shorthand

The `&>` operator is syntactic sugar for `> file 2>&1`. It is available in bash 4.0 and later and produces identical results with cleaner syntax. It always overwrites; use `&>>` to append both streams.

```bash
command &> all.txt
```

```bash
command &>> all.txt
```

#### Discard all output

Writing to `/dev/null` discards output silently. Reads from `/dev/null` return EOF immediately. The combined pattern `> /dev/null 2>&1` (or `&> /dev/null`) is used when a command is run purely for its exit code, such as testing connectivity or checking if a file exists.

```bash
command > /dev/null 2>&1
```

| Operator | Syntax | Effect |
|---|---|---|
| `>` | `cmd > file` | Redirect stdout to file (overwrite) |
| `>>` | `cmd >> file` | Redirect stdout to file (append) |
| `2>` | `cmd 2> file` | Redirect stderr to file (overwrite) |
| `2>>` | `cmd 2>> file` | Redirect stderr to file (append) |
| `2>&1` | `cmd > file 2>&1` | Merge stderr into stdout, both to file |
| `&>` | `cmd &> file` | Redirect stdout and stderr to file (bash 4+, overwrite) |
| `&>>` | `cmd &>> file` | Redirect stdout and stderr to file (bash 4+, append) |
| `> /dev/null` | `cmd > /dev/null` | Discard stdout |
| `&> /dev/null` | `cmd &> /dev/null` | Discard stdout and stderr |

### Linux | redirection | input operators

Input redirection feeds file content or inline text directly into a command's stdin, replacing interactive keyboard input. This enables non-interactive execution of tools that normally expect a terminal prompt.

#### Redirect stdin from a file

The `<` operator opens the specified file and feeds its contents as the standard input of the command. The command sees the file data exactly as if the user had typed it. This is commonly used to feed SQL scripts to database clients without interactive prompts.

```bash
sqlcmd -S server -U sa -P "$PASS" -d data-pipeline < query.sql
```

#### Here-document — embed multi-line stdin inline

A here-doc (`<<`) lets you embed multi-line text directly in the script without creating a temporary file. The shell feeds everything between the two delimiters to the command's stdin. Quoting the delimiter (`<<'EOF'`) disables variable expansion and command substitution inside the block, which is important when the content contains `$` or backticks.

```bash
cat <<EOF
Line one
Line two with variable: $HOME
EOF
```

Use the quoted form when the block must be treated literally:

```bash
cat <<'EOF'
This $variable will NOT be expanded.
EOF
```

#### Here-string — feed a single string to stdin

A here-string (`<<<`) passes a single string directly to a command's stdin. It avoids a subshell compared to `echo "text" | command` and is useful for feeding short values to tools like `read`, `bc`, or `base64`.

```bash
base64 <<< "encode this string"
```

```text
ZW5jb2RlIHRoaXMgc3RyaW5nCg==
```

| Operator | Syntax | Effect |
|---|---|---|
| `<` | `cmd < file` | Feed file contents as stdin |
| `<<DELIM` | `cmd <<EOF ... EOF` | Here-document: inline multi-line stdin |
| `<<'DELIM'` | `cmd <<'EOF' ... EOF` | Here-document with literal (no expansion) |
| `<<<` | `cmd <<< "string"` | Here-string: feed single string as stdin |

### Linux | redirection | tee and production logging

The `tee` command reads from stdin and writes simultaneously to a file and to stdout, allowing a pipeline to both save and display output. This is the standard pattern for real-time monitoring of long-running jobs while also capturing a persistent log.

#### Write to terminal and file simultaneously

`tee` without flags overwrites the destination file. It splits the stream so the downstream terminal sees the same data that is written to disk.

```bash
python3 pipeline/run.py | tee /var/log/pipeline/run.log
```

#### Append to log file while displaying live output

The `-a` flag puts `tee` in append mode, preserving previous log content. Prepending `2>&1` merges stderr into stdout before the pipe so both streams are captured and displayed.

```bash
python3 pipeline/run.py 2>&1 | tee -a /var/log/pipeline/run.log
```

#### Separate stdout and stderr into distinct log files

This pattern uses process substitution to simultaneously redirect stdout to one file and stderr to another, both with timestamps derived from the same `date` call. Useful for post-mortem analysis where distinguishing error lines from normal output is required.

```bash
python3 pipeline/run.py \
  > /var/log/pipeline/run_$(date +%Y%m%d_%H%M%S).log \
  2> /var/log/pipeline/run_$(date +%Y%m%d_%H%M%S).err
```

| Flag | Syntax | Description |
|---|---|---|
| *(none)* | `cmd \| tee file` | Overwrite file, pass through to stdout |
| `-a` | `cmd \| tee -a file` | Append to file, pass through to stdout |
| `-i` | `cmd \| tee -i file` | Ignore SIGINT (keep writing even if Ctrl-C is pressed) |

### Linux | redirection | common gotchas

Understanding the shell's evaluation order prevents data-loss bugs that are difficult to diagnose because no error is reported.

#### Redirect-before-write — sort overwrites itself to empty

The shell opens and truncates the output file before launching the command. When the input and output file are the same path, the file is emptied before the command reads a single byte.

```bash
sort output.txt > output.txt
```

> [!warning] This command silently destroys the contents of `output.txt`. The shell truncates the file to zero bytes before `sort` reads a single line. No error is reported.

> [!success] Use a temporary file and rename it, or use `sponge` from the `moreutils` package. `sponge` buffers all input in memory before opening the output file, making in-place rewrites safe.
>
> ```bash
> sort output.txt > tmp.txt && mv tmp.txt output.txt
> ```
>
> ```bash
> sort output.txt | sponge output.txt
> ```

#### Wrong order for 2>&1 combined redirect

Placing `2>&1` before `>` redirects stderr to the terminal (the original fd 1 location) and sends only stdout to the file.

```bash
command 2>&1 > all.txt
```

> [!warning] This does NOT capture stderr in the file. At the moment `2>&1` is evaluated, fd 1 still points to the terminal, so stderr is sent to the terminal. The subsequent `> all.txt` then redirects only fd 1 to the file.

> [!success] Always place `2>&1` after the output redirect so fd 1 is already pointing to the file when stderr is merged into it.
>
> ```bash
> command > all.txt 2>&1
> ```


#### Prevent accidental overwrites with noclobber

`set -C` (or `set -o noclobber`) makes the shell refuse to overwrite existing files with `>`. You must use `>|` to explicitly force an overwrite. This is a safety net for automated scripts that should never clobber previous output.

```bash
set -C
echo "data" > existing_file.txt
```

```text
bash: existing_file.txt: cannot overwrite existing file
```

```bash
echo "data" >| existing_file.txt
```

> [!tip] Add `set -C` to production scripts
>
> Combined with `set -euo pipefail` (see [defensive-scripting](https://alp78.github.io/elysium/01-Shell/01-Scripting/07-defensive-scripting)), `set -C` prevents a class of data-loss bugs where a redirect silently destroys an output file from a previous run.

## PowerShell I/O redirection tools

PowerShell extends the two-stream Unix model to six numbered streams: 1 (Success/stdout), 2 (Error), 3 (Warning), 4 (Verbose), 5 (Debug), 6 (Information). The `*>` wildcard operator targets all six at once. PowerShell also replaces `/dev/null` with `$null`, a built-in variable that discards all data written to it.

### PowerShell | redirection | output operators

The PowerShell redirection operators mirror their bash counterparts for streams 1 and 2 but extend to streams 3–6 and the `*` wildcard. `Out-File` is the cmdlet equivalent and offers additional parameters for encoding and width.

#### Redirect stdout (Success stream) to a file — overwrite

The `>` operator is an alias for `Out-File`. It writes the Success stream (stream 1) to a file, overwriting it if it exists. PowerShell serializes objects as formatted strings using the default formatter before writing.

```powershell
Get-Process > processes.txt
```

An explicit `Out-File` call gives access to encoding and line-width parameters:

```powershell
Get-Process | Out-File processes.txt -Encoding utf8 -Width 200
```

#### Redirect stdout to a file — append

The `>>` operator and `Out-File -Append` both open the file in append mode. The `-Append` flag on `Out-File` is preferred in scripts because it makes intent explicit.

```powershell
Get-Process >> processes.txt
```

```powershell
Get-Process | Out-File processes.txt -Append
```

#### Redirect stderr (Error stream) to a file

Stream 2 carries terminating and non-terminating errors. Redirecting `2>` captures error records to a file while the Success stream continues to the default output.

```powershell
Get-ChildItem C:\NonExistent 2> errors.txt
```

#### Redirect all streams to a file

The `*>` operator redirects all six streams simultaneously. This is the PowerShell equivalent of `&> all.txt` in bash but also captures Warning, Verbose, Debug, and Information streams that bash has no direct equivalent for.

```powershell
command *> all.txt
```

#### Discard all output

`$null` is a built-in automatic variable. Assigning to it or redirecting to it discards data without writing to disk. Using `*> $null` silences all six streams simultaneously.

```powershell
command *> $null
```

Alternatively, pipe to `Out-Null`:

```powershell
command | Out-Null
```

| Operator | Syntax | Effect |
|---|---|---|
| `>` | `cmd > file` | Redirect Success stream to file (overwrite) |
| `>>` | `cmd >> file` | Redirect Success stream to file (append) |
| `2>` | `cmd 2> file` | Redirect Error stream to file (overwrite) |
| `2>>` | `cmd 2>> file` | Redirect Error stream to file (append) |
| `3>` | `cmd 3> file` | Redirect Warning stream to file |
| `4>` | `cmd 4> file` | Redirect Verbose stream to file |
| `5>` | `cmd 5> file` | Redirect Debug stream to file |
| `6>` | `cmd 6> file` | Redirect Information stream to file |
| `*>` | `cmd *> file` | Redirect all streams to file |
| `*>>` | `cmd *>> file` | Redirect all streams to file (append) |
| `*> $null` | `cmd *> $null` | Discard all streams (equivalent to `> /dev/null 2>&1`) |

### PowerShell | redirection | Tee-Object

`Tee-Object` is the PowerShell equivalent of the Unix `tee` command. It splits the pipeline so output is written to a file (or variable) while simultaneously passing the objects through to the next pipeline stage or the console.

#### Write to terminal and file simultaneously

`Tee-Object -FilePath` writes the string representation of each pipeline object to a file while letting the objects continue down the pipeline to the console.

```powershell
Get-Process | Tee-Object -FilePath processes.txt
```

#### Append to log file while displaying live output

The `-Append` switch preserves previous file content, mirroring `tee -a` in bash.

```powershell
python3 pipeline/run.py 2>&1 | Tee-Object -FilePath C:\Logs\run.log -Append
```

#### Capture output in a variable and continue the pipeline

`Tee-Object -Variable` stores objects in a PowerShell variable for later inspection while still sending them to the next command. This is useful in interactive debugging sessions.

```powershell
Get-Service | Tee-Object -Variable services | Where-Object Status -eq Running
```

| Parameter | Syntax | Description |
|---|---|---|
| `-FilePath` | `Tee-Object -FilePath file` | Write to file (overwrite) and pass through |
| `-Append` | `Tee-Object -FilePath file -Append` | Write to file (append) and pass through |
| `-Variable` | `Tee-Object -Variable varName` | Store in variable and pass through |

### PowerShell | redirection | here-string

PowerShell here-strings use `@"..."@` (expandable) and `@'...'@` (literal) delimiters. The closing delimiter must appear at the start of a line with no leading whitespace. They are used to define multi-line string literals without escape sequences, and to feed multi-line content to commands.

#### Expandable here-string — variable interpolation active

Inside `@"..."@`, PowerShell expands `$variables` and `$(expressions)` normally. Use this form when the string content must reference runtime values.

```powershell
$name = "World"
$text = @"
Hello, $name
Today is $(Get-Date -Format 'yyyy-MM-dd')
"@
Write-Output $text
```

```text
Hello, World
Today is 2026-04-03
```

#### Literal here-string — no expansion

Inside `@'...'@`, all content is treated as literal text. Dollar signs, backticks, and parentheses have no special meaning. Use this form for content that must not be processed (e.g., JSON templates, SQL scripts, regex patterns).

```powershell
$sql = @'
SELECT *
FROM dbo.Positions
WHERE ticker = '$AAPL'
  AND date >= '2026-01-01'
'@
Invoke-Sqlcmd -Query $sql -ServerInstance "srv01"
```

| Form | Delimiters | Variable expansion | Use case |
|---|---|---|---|
| Expandable | `@"..."@` | Yes | Strings with dynamic values |
| Literal | `@'...'@` | No | SQL, JSON, regex, raw templates |


## When to use I/O redirection

- **Logging pipeline runs** — redirect stdout and stderr to timestamped log files for post-mortem analysis. Use `tee -a` for simultaneous live monitoring and persistent logging.
- **Silencing noisy commands** — discard output with `> /dev/null 2>&1` when you only care about the exit code (e.g., `command -v tool > /dev/null 2>&1` to test if a tool is installed).
- **Separating errors from data** — redirect stderr to a separate file when stdout carries structured data (CSV, JSON) that must not be contaminated with error messages.
- **Non-interactive database operations** — feed SQL scripts to `sqlcmd` or `psql` via `< query.sql` instead of typing queries interactively.
- **Embedding configuration in scripts** — use here-documents to include multi-line SQL, JSON, or YAML directly in a bash script without managing separate template files.

## When not to use I/O redirection

- **Complex output processing** — if you need to transform, filter, or conditionally route output, use a proper scripting language (Python, PowerShell) rather than chaining increasingly complex redirections.
- **Structured logging** — for production services, use a logging framework that writes structured JSON logs. Shell redirection does not add timestamps, log levels, or correlation IDs.
- **Large binary data** — redirecting binary output (images, compressed files) through text-processing pipelines can corrupt data due to locale-dependent encoding conversions. Use direct file operations instead.

## Warnings

> [!danger] Redirect-before-write destroys data silently
>
> `sort file.txt > file.txt` empties the file because the shell truncates it to zero bytes before `sort` reads a single line. No error is reported. Always use a temporary file and rename, or pipe through `sponge` from `moreutils`.

> [!warning] Wrong order for `2>&1` loses stderr
>
> `command 2>&1 > file` sends stderr to the terminal and only stdout to the file. The correct order is `command > file 2>&1` (redirect fd 1 first, then merge fd 2 into it).

> [!warning] `>` overwrites without confirmation
>
> Unlike `cp -i` or `mv -i`, the `>` operator silently overwrites existing files with no prompt. Use `set -C` (`noclobber`) in scripts to prevent this, or use `>>` (append) when previous content must be preserved.

> [!warning] Piping only captures stdout by default
>
> `command | grep pattern` filters only stdout. Stderr bypasses the pipe entirely and goes to the terminal. To include stderr in the pipe, use `command 2>&1 | grep pattern` or `command |& grep pattern` (bash 4+).

> [!warning] PowerShell `>` uses UTF-16LE encoding by default (PS 5.1)
>
> In Windows PowerShell 5.1, `>` and `Out-File` default to UTF-16LE encoding, which can break Unix tools and pipelines. Use `Out-File -Encoding utf8` or upgrade to PowerShell 7+ where the default is UTF-8 (no BOM).

## Recommendations

| Scenario | Recommendation |
|---|---|
| Production pipeline logging | Use `command 2>&1 \| tee -a /var/log/pipeline/run_$(date +%Y%m%d).log` to capture both streams with live monitoring. |
| Separating errors from data | Redirect stdout to a data file and stderr to an error log: `command > data.csv 2> errors.log`. |
| Checking tool availability | Use `command -v tool > /dev/null 2>&1` for a clean existence check with no output. |
| Preventing overwrites in scripts | Add `set -C` at the top of the script. Use `>\|` for intentional overwrites. |
| Embedding SQL in bash scripts | Use quoted here-documents (`<<'EOF'`) to prevent `$` expansion inside SQL that uses dollar-quoting or variable-like syntax. |
| PowerShell encoding | Always specify `-Encoding utf8` with `Out-File` in cross-platform scripts. In PS 7+, the default is already UTF-8. |
| Discarding all output | Use `&> /dev/null` (bash 4+) or `*> $null` (PowerShell). These are the cleanest forms and capture all streams. |

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "Output file is empty after redirect" | Redirect-before-write: the input and output file are the same path. | Use a temp file and rename, or pipe through `sponge`. |
| "Error messages appear on screen despite redirecting to file" | Only stdout (`>`) was redirected. Stderr (fd 2) still goes to the terminal. | Add `2>&1` after the stdout redirect, or use `&>` (bash 4+). |
| "File contains garbled characters after redirect (PowerShell)" | PowerShell 5.1 defaults to UTF-16LE encoding. | Use `Out-File -Encoding utf8` or switch to PowerShell 7+. |
| "Here-document variables are expanded when they shouldn't be" | The delimiter was not quoted: `<<EOF` expands `$variables`, `<<'EOF'` does not. | Quote the delimiter: `<<'EOF'`. |
| "`noclobber` prevents writing to a file that doesn't exist" | This should not happen — `noclobber` only blocks overwrites of existing files. If you see this error, check file permissions or disk space. | Verify with `ls -la` and `df -h`. |
| "Pipe captures stdout but misses warnings (PowerShell)" | Warnings are stream 3, not stream 2. The `\|` pipe only passes stream 1. | Use `3>&1` before the pipe to merge warnings into stdout, or use `*>&1 \|` to merge all streams. |
| "`tee` writes to file but shows nothing on terminal" | The preceding command in the pipeline produced no output, or stderr was not merged before the pipe. | Add `2>&1` before `\| tee` to include error output. |

## Cross-references

- [command-chaining](https://alp78.github.io/elysium/01-Shell/01-Scripting/04-command-chaining) — Using pipes and operators to connect commands
- [defensive-scripting](https://alp78.github.io/elysium/01-Shell/01-Scripting/07-defensive-scripting) — The `set` flags that prevent scripting disasters
- [process-substitution](https://alp78.github.io/elysium/01-Shell/01-Scripting/06-process-substitution) — Using `<()` and `>()` to treat output as files

## References

- [GNU Bash Reference — Redirections](https://www.gnu.org/software/bash/manual/html_node/Redirections.html)
- [PowerShell — About Redirection](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_redirection)
- [PowerShell — Tee-Object](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/tee-object)
