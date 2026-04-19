---
title: "03 - I/O Redirection"
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell, scripting]
aliases: [IO redirection, I/O redirection, output redirection, stderr redirect, stdin redirect, file descriptors]
keywords: [redirection, stdout, stderr, stdin, file descriptor, dev null, redirect output, redirect error, tee, append, overwrite, fd 0, fd 1, fd 2, 2>&1, output to file]
description: "How to redirect stdin, stdout, and stderr to files, other streams, or /dev/null in bash and PowerShell, including production logging patterns and common gotchas."
created: 2026-03-22
updated: 2026-04-15
status: complete
---

# I/O Redirection

> [!quote]+
>
> "Expect the output of every program to become the input to another, as yet unknown, program."
>
> -- **Doug McIlroy**, *Bell System Technical Journal* (1978)

> [!abstract]- Summary
>
> Explains how Bash and PowerShell redirect input, normal output, and diagnostic streams to files, pipes, or null sinks.
>
> Shows overwrite and append operators, combined stream redirection, here-documents, here-strings, and `tee` / `Tee-Object` logging patterns with live verification output.
>
> Covers the failure modes that cause silent truncation, lost stderr, missed warnings, and cross-platform encoding surprises.

> [!note]- Glossary
>
> **File descriptor (fd)**
>
> - A small integer that identifies an open file, socket, or stream within a process; the shell starts each process with fd 0, 1, and 2 already open.
> - Redirection operators work by reassigning or duplicating those numbers before the target command starts.
> - stdin, stdout, and stderr are not special objects; they are just the three descriptors the shell opens by default.
>
> ---
>
> **`stdin` (fd 0)**
>
> - Standard input is the default data source for a process; in an interactive shell it is usually the keyboard.
> - `<`, `<<`, and `<<<` replace that interactive source with a file or inline text.
> - A pipe feeds the next command's stdin; it does not create a file you can reopen later.
>
> ---
>
> **`stdout` (fd 1)**
>
> - Standard output is the default destination for normal command results.
> - `>` and `>>` move fd 1 from the terminal to a file, while `tee` and `Tee-Object` duplicate it.
> - `>` truncates the target before the command runs, so `sort file.txt > file.txt` destroys the input first.
>
> ---
>
> **`stderr` (fd 2)**
>
> - Standard error is a separate output stream for failures, warnings, and diagnostics.
> - Keeping stderr separate prevents error text from corrupting structured stdout such as CSV or JSON.
> - `command > file` and `command | next` affect stdout only; stderr still bypasses the file or pipe unless you redirect it explicitly.
>
> ---
>
> **`/dev/null` / `$null`**
>
> - `/dev/null` on Unix-like systems and `$null` in PowerShell are sink targets that discard anything written to them.
> - They are useful when the exit status matters more than the output.
> - The names are platform-specific: `> /dev/null` is Bash syntax, while `*> $null` or `Out-Null` is the PowerShell form.
>
> ---
>
> **`2>&1`**
>
> - `2>&1` duplicates stderr into whatever destination stdout is using at that moment.
> - It is the standard Bash form for merging both streams into one file or pipe.
> - Order matters: `command > file 2>&1` works, while `command 2>&1 > file` leaves stderr on the terminal.
>
> ---
>
> **`&>` / `&>>`**
>
> - Bash 4+ provides `&>` for overwrite and `&>>` for append as shorthand for redirecting stdout and stderr together.
> - They make the common "both streams to one destination" pattern shorter.
> - They are Bash extensions, not POSIX `sh` syntax.
>
> ---
>
> **`tee` / `Tee-Object`**
>
> - `tee` in Bash and `Tee-Object` in PowerShell copy a stream to both persistent storage and the current pipeline.
> - They are the standard choice when you want live console visibility and a saved log at the same time.
> - Without `-a` or `-Append`, they overwrite the target file on each run.
>
> ---
>
> **Here-document (`<<`)**
>
> - A here-document feeds a multi-line block directly into stdin without creating a separate file.
> - It is useful for inline SQL, config fragments, and generated text.
> - `<<EOF` expands variables; `<<'EOF'` keeps the block literal.
>
> ---
>
> **Here-string (`<<<`)**
>
> - A Bash here-string sends a single string to stdin without building an `echo ... | command` pipeline.
> - It is convenient for short values and command substitution tests.
> - It is Bash-only and does not exist in POSIX `sh`.
>
> ---
>
> **`noclobber` / `set -C`**
>
> - `set -C` (or `set -o noclobber`) stops Bash from overwriting an existing file with `>`.
> - It is a safety net for scripts that should fail before replacing previous output.
> - `>|` is the explicit bypass; `>!` is not valid Bash syntax.
>
> ---
>
> **PowerShell streams**
>
> - PowerShell exposes six numbered streams: 1 Success, 2 Error, 3 Warning, 4 Verbose, 5 Debug, and 6 Information.
> - That model is more granular than the Unix stdout/stderr split.
> - `2>` captures errors only; warnings remain on stream 3 unless you merge or redirect them separately.
>
> ---
>
> **PowerShell here-string (`@"..."@` / `@'...'@`)**
>
> - PowerShell here-strings are multi-line string literals that either expand variables (`@"..."@`) or keep text literal (`@'...'@`).
> - They are useful for SQL, JSON, regexes, and any multi-line payload you want to keep readable.
> - The closing delimiter must start at column zero with no leading spaces.
>
> ---
>
> **`Out-File`**
>
> - `Out-File` is the cmdlet behind `>` and `>>`, with explicit parameters for encoding, width, and append behavior.
> - It is the reliable way to state file encoding in scripts that cross Windows and Unix boundaries.
> - Windows PowerShell 5.1 defaults to UTF-16LE, so cross-platform scripts should set `-Encoding utf8` deliberately.

Every process starts with stdin, stdout, and stderr already attached. Redirection rewires those streams before the command begins, which is why operator order can change behavior completely.

The diagram below shows the standard descriptors, the common redirection operators that target them, and the split between terminal, files, and discard sinks.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {'primaryColor': '#292e42','primaryTextColor': '#c0caf5','primaryBorderColor': '#565f89','lineColor': '#565f89','secondaryColor': '#1a1b26','tertiaryColor': '#24283b','noteTextColor': '#c0caf5','noteBkgColor': '#292e42','textColor': '#c0caf5','fontSize': '14px'}}}%%
flowchart LR
    stdin["fd 0<br>stdin"]
    proc["Process"]
    stdout["fd 1<br>stdout"]
    stderr["fd 2<br>stderr"]
    file1["file / log"]
    file2["error log"]
    devnull["/dev/null<br>(discard)"]
    teenode["tee<br>(split)"]
    terminal["Terminal"]

    stdin -- "< file" --> proc
    proc --> stdout
    proc --> stderr
    stdout -- "> file<br>>> file" --> file1
    stderr -- "2> file" --> file2
    stdout -- "&> / > file 2>&1" --> file1
    stderr -- "2>&1" --> stdout
    stdout -- "| tee -a" --> teenode
    teenode --> file1
    teenode --> terminal
    stdout -- "> /dev/null<br>*> $null" --> devnull
    stderr -- "2>/dev/null" --> devnull
```

## Linux I/O redirection tools

Bash applies redirections in the shell before the target process starts. That model is simple once you think in file descriptors, but it also explains why bad ordering can silently drop output or truncate files.

### Linux | redirection | output operators

These operators target stdout, stderr, or both. The examples below use temporary directories so the behavior is visible without depending on project-specific files or paths.

> [!warning] Descriptor order changes the result
>
> Bash applies redirections from left to right. `cmd > file 2>&1` sends both streams to the file, while `cmd 2>&1 > file` duplicates stderr to the terminal-bound stdout first and leaves error output on screen. Use the explicit `> file 2>&1` order when the log must contain both streams.

#### Redirect stdout to a file (overwrite)

`>` opens the destination for writing and truncates any previous content before the command runs. The example overwrites an existing file and then prints the final contents so the effect is visible.

*Run the commands in this section to redirect stdout to a file (overwrite).*
```bash
tmp=$(mktemp -d)
printf 'old\n' > "$tmp/output.txt"
printf 'new\n' > "$tmp/output.txt"
cat "$tmp/output.txt"
```

```text
new
```

#### Redirect stdout to a file (append)

`>>` keeps the existing file contents and writes new stdout at the end. That makes it the default choice for cumulative logs and audit trails.

*Run the commands in this section to redirect stdout to a file (append).*
```bash
tmp=$(mktemp -d)
printf 'first\n' > "$tmp/output.txt"
printf 'second\n' >> "$tmp/output.txt"
cat "$tmp/output.txt"
```

```text
first
second
```

#### Redirect stderr to a file

`2>` moves only stderr. Stdout keeps going to the terminal, which is why this pattern is useful when you want live progress but a separate error record.

*Run the commands in this section to redirect stderr to a file.*
```bash
tmp=$(mktemp -d)
bash -lc 'printf "visible stdout\n"; printf "captured stderr\n" >&2' 2> "$tmp/errors.txt"
printf 'stderr file:\n'
cat "$tmp/errors.txt"
```

```text
visible stdout
stderr file:
captured stderr
```

#### Redirect both stdout and stderr to the same file

`> file 2>&1` first points stdout at the file and then duplicates stderr into that same destination. The output below proves that both streams were written into one file instead of the terminal.

*Run the commands in this section to redirect both stdout and stderr to the same file.*
```bash
tmp=$(mktemp -d)
bash -lc 'printf "stdout line\n"; printf "stderr line\n" >&2' > "$tmp/all.txt" 2>&1
cat "$tmp/all.txt"
```

```text
stdout line
stderr line
```

#### Redirect both stdout and stderr with Bash shorthand

`&>` is the overwrite shorthand and `&>>` is the append shorthand. They are convenient in Bash-only scripts when the explicit `> file 2>&1` form is not needed for portability.

*Run the commands in this section to redirect both stdout and stderr with Bash shorthand.*
```bash
tmp=$(mktemp -d)
bash -lc 'printf "first stdout\n"; printf "first stderr\n" >&2' &> "$tmp/all.txt"
bash -lc 'printf "second stdout\n"; printf "second stderr\n" >&2' &>> "$tmp/all.txt"
cat "$tmp/all.txt"
```

```text
first stdout
first stderr
second stdout
second stderr
```

#### Discard all output

Redirecting to `/dev/null` is the Bash way to silence a command when only success or failure matters. Because the redirect is intentionally silent, the follow-up line verifies that the command still ran and returned exit code `0`.

*Run the commands in this section to discard all output.*
```bash
bash -lc 'printf "hidden stdout\n"; printf "hidden stderr\n" >&2' > /dev/null 2>&1
printf 'command completed with exit code %s\n' "$?"
```

```text
command completed with exit code 0
```

Use the lookup table below when you need the Bash syntax quickly.

| Operator | Syntax | Effect |
|---|---|---|
| `>` | `cmd > file` | Redirect stdout to file (overwrite) |
| `>>` | `cmd >> file` | Redirect stdout to file (append) |
| `2>` | `cmd 2> file` | Redirect stderr to file (overwrite) |
| `2>>` | `cmd 2>> file` | Redirect stderr to file (append) |
| `2>&1` | `cmd > file 2>&1` | Merge stderr into stdout, both to file |
| `&>` | `cmd &> file` | Redirect stdout and stderr to file (Bash 4+, overwrite) |
| `&>>` | `cmd &>> file` | Redirect stdout and stderr to file (Bash 4+, append) |
| `> /dev/null` | `cmd > /dev/null` | Discard stdout |
| `&> /dev/null` | `cmd &> /dev/null` | Discard stdout and stderr |

### Linux | redirection | input operators

Input redirection replaces interactive keyboard input with a file or inline block. That matters any time a script needs to feed a command deterministically.

#### Redirect stdin from a file

`<` opens a file and makes it the command's stdin. `wc -l` is a compact verification target because the output reflects only what came from the redirected file.

*Run the commands in this section to redirect stdin from a file.*
```bash
tmp=$(mktemp -d)
printf 'alpha\nbeta\ngamma\n' > "$tmp/input.txt"
wc -l < "$tmp/input.txt"
```

```text
3
```

#### Here-document - embed multi-line stdin inline

A here-document keeps multi-line input in the script itself. The first example shows normal expansion, and the second uses a quoted delimiter so the payload stays literal.

*Run the commands in this section to here-document - embed multi-line stdin inline.*
```bash
name='Elysium'
cat <<EOF
Hello, $name
EOF
```

```text
Hello, Elysium
```

*Run the commands in this section to here-document - embed multi-line stdin inline.*
```bash
name='Elysium'
cat <<'EOF'
Hello, $name
EOF
```

```text
Hello, $name
```

#### Here-string - feed a single string to stdin

`<<<` is the compact Bash form for passing one string into stdin. The example below base64-encodes a short string and preserves the original captured output.

*Run the commands in this section to here-string - feed a single string to stdin.*
```bash
base64 <<< "encode this string"
```

```text
ZW5jb2RlIHRoaXMgc3RyaW5nCg==
```

Use the lookup table below when you need the input forms at a glance.

| Operator | Syntax | Effect |
|---|---|---|
| `<` | `cmd < file` | Feed file contents as stdin |
| `<<DELIM` | `cmd <<EOF ... EOF` | Here-document: inline multi-line stdin |
| `<<'DELIM'` | `cmd <<'EOF' ... EOF` | Here-document with literal (no expansion) |
| `<<<` | `cmd <<< "string"` | Here-string: feed single string as stdin |

### Linux | redirection | tee and production logging

`tee` duplicates stdout so the same stream can be watched live and persisted to disk. When stderr matters too, you have to merge it before the pipe.

#### Write to terminal and file simultaneously

The command below writes two lines to stdout, shows them live, and then prints the saved log so the duplicated stream is obvious.

*Run the commands in this section to write to terminal and file simultaneously.*
```bash
tmp=$(mktemp -d)
printf 'line one\nline two\n' | tee "$tmp/run.log"
printf '\nlog file:\n'
cat "$tmp/run.log"
```

```text
line one
line two

log file:
line one
line two
```

#### Append to log file while displaying live output

`tee -a` preserves prior log content. The example seeds the file with one line, merges stderr into stdout with `2>&1`, and then appends the new combined stream.

*Run the commands in this section to append to log file while displaying live output.*
```bash
tmp=$(mktemp -d)
printf 'seed line\n' > "$tmp/run.log"
bash -lc 'printf "stdout line\n"; printf "stderr line\n" >&2' 2>&1 | tee -a "$tmp/run.log"
printf '\nlog file:\n'
cat "$tmp/run.log"
```

```text
stdout line
stderr line

log file:
seed line
stdout line
stderr line
```

#### Separate stdout and stderr into distinct log files

Separate log files are easier to search when the normal data stream and diagnostics have different consumers. This example uses a fixed timestamp string so the resulting paths stay stable inside the demo.

*Run the commands in this section to separate stdout and stderr into distinct log files.*
```bash
tmp=$(mktemp -d)
stamp='20260414_061410'
bash -lc 'printf "ok\n"; printf "problem\n" >&2' \
  > "$tmp/run_${stamp}.log" \
  2> "$tmp/run_${stamp}.err"
printf 'stdout file:\n'
cat "$tmp/run_${stamp}.log"
printf '\nstderr file:\n'
cat "$tmp/run_${stamp}.err"
```

```text
stdout file:
ok

stderr file:
problem
```

Use the lookup table below when you only need the `tee` flags.

| Flag | Syntax | Description |
|---|---|---|
| *(none)* | `cmd \| tee file` | Overwrite file, pass through to stdout |
| `-a` | `cmd \| tee -a file` | Append to file, pass through to stdout |
| `-i` | `cmd \| tee -i file` | Ignore SIGINT (keep writing even if Ctrl-C is pressed) |

### Linux | redirection recommendations | logging and safety patterns

The operator sections above explain mechanics. The recommendations below turn those mechanics into repeatable Bash patterns for production scripts and terminal workflows.

#### Capture both streams in a production log

If a job can fail noisily, append a merged stream to a persistent log. That gives you a complete timeline without sacrificing live terminal visibility.

*Run the commands in this section to capture both streams in a production log.*
```bash
tmp=$(mktemp -d)
bash -lc 'printf "job ok\n"; printf "job warning\n" >&2' 2>&1 | tee -a "$tmp/run.log"
printf '\nlog file:\n'
cat "$tmp/run.log"
```

```text
job ok
job warning

log file:
job ok
job warning
```

#### Keep data output and error output separate

Structured output should not share a file with diagnostics. The example keeps CSV-like data on stdout and sends the bad row marker to a separate error log.

*Run the commands in this section to keep data output and error output separate.*
```bash
tmp=$(mktemp -d)
bash -lc 'printf "row1,row2\n"; printf "bad row\n" >&2' > "$tmp/data.csv" 2> "$tmp/errors.log"
printf 'data.csv:\n'
cat "$tmp/data.csv"
printf '\nerrors.log:\n'
cat "$tmp/errors.log"
```

```text
data.csv:
row1,row2

errors.log:
bad row
```

#### Check whether a tool exists without printing noise

`command -v tool > /dev/null 2>&1` is the quiet existence check for shell scripts. The verification line prints the exit code instead of the command path.

*Run the commands in this section to check whether a tool exists without printing noise.*
```bash
command -v bash > /dev/null 2>&1
printf 'bash_available=%s\n' "$?"
```

```text
bash_available=0
```

#### Quote here-document delimiters when embedded text must stay literal

Quoted delimiters prevent accidental expansion inside inline SQL, JSON templates, and shell snippets that contain `$`-prefixed placeholders.

*Run the commands in this section to quote here-document delimiters when embedded text must stay literal.*
```bash
ticker='AAPL'
cat <<'EOF'
SELECT '$ticker' AS literal_symbol;
EOF
```

```text
SELECT '$ticker' AS literal_symbol;
```

### Linux | redirection troubleshooting | truncation and stderr problems

These are the failure signatures that show up most often in shell scripts. Each example is intentionally small so the broken behavior is obvious before the fix is explained.

#### Output file is empty after a redirect

If the input file and output file are the same path, the shell truncates the target before the command reads it. The byte count below drops to zero because `sort` destroyed the input first.

*Run the commands in this section to output file is empty after a redirect.*
```bash
tmp=$(mktemp -d)
printf 'pear\napple\n' > "$tmp/items.txt"
sort "$tmp/items.txt" > "$tmp/items.txt"
printf 'bytes_after_sort=%s\n' "$(wc -c < "$tmp/items.txt")"
```

```text
bytes_after_sort=0
```

#### Stderr still appears on the terminal after a redirect

This symptom usually means stderr was never redirected correctly. The example uses the classic wrong-order form, so stderr stays on the terminal while only stdout reaches the file.

*Run the commands in this section to stderr still appears on the terminal after a redirect.*
```bash
tmp=$(mktemp -d)
bash -lc 'printf "stdout line\n"; printf "stderr line\n" >&2' 2>&1 > "$tmp/all.txt"
printf 'file:\n'
cat "$tmp/all.txt"
```

```text
stderr line
file:
stdout line
```

#### Here-document variables expanded when they should stay literal

An unquoted delimiter expands shell variables inside the block. If you expected literal text, the output below is the failure mode you are looking for.

*Run the commands in this section to here-document variables expanded when they should stay literal.*
```bash
name='Elysium'
cat <<EOF
name=$name
EOF
```

```text
name=Elysium
```

#### `noclobber` seems to block a new file

`noclobber` only blocks overwriting an existing file. If a first write to a new path succeeds, a failure on a supposedly missing file is more likely a path, permission, or disk issue.

*Run the commands in this section to `noclobber` seems to block a new file.*
```bash
tmp=$(mktemp -d)
cd "$tmp"
set -C
printf 'new file\n' > new.txt
cat new.txt
```

```text
new file
```

#### `tee` wrote nothing because the pipeline produced only stderr

`tee` receives stdout from the pipe, not stderr. When the upstream command writes only to stderr, the terminal still shows the message but the log stays empty.

*Run the commands in this section to `tee` wrote nothing because the pipeline produced only stderr.*
```bash
tmp=$(mktemp -d)
bash -lc 'printf "stderr only\n" >&2' | tee "$tmp/out.log"
printf 'log_bytes=%s\n' "$(wc -c < "$tmp/out.log")"
```

```text
stderr only
log_bytes=0
```

#### Prevent accidental overwrites with `noclobber`

`set -C` turns accidental overwrite into an explicit failure. The existing refusal output below is preserved, and the second command shows the deliberate `>|` bypass.

*Run the commands in this section to prevent accidental overwrites with `noclobber`.*
```bash
tmp=$(mktemp -d)
cd "$tmp"
printf 'old\n' > existing_file.txt
set -C
echo "data" > existing_file.txt
```

```text
bash: existing_file.txt: cannot overwrite existing file
```

*Run the commands in this section to prevent accidental overwrites with `noclobber`.*
```bash
tmp=$(mktemp -d)
cd "$tmp"
printf 'old\n' > existing_file.txt
set -C
echo "data" >| existing_file.txt
cat existing_file.txt
```

```text
data
```

## PowerShell I/O redirection tools

PowerShell keeps the familiar success and error streams but adds separate warning, verbose, debug, and information channels. That is why the redirection syntax looks similar to Bash at first and then quickly diverges.

### PowerShell | redirection | output operators

These operators target the numbered PowerShell streams. The examples use temporary directories and simple strings so the stream behavior stays visible instead of host-specific.

> [!info] File redirection still formats PowerShell objects
>
> `>` and `>>` flow through PowerShell's formatting system rather than writing raw object structure. Use `Export-Csv`, `ConvertTo-Json`, or `Out-File` with explicit `-Encoding` and `-Width` when the file is a machine-consumed artifact instead of a human log.

#### Redirect stdout (Success stream) to a file

`>` writes the Success stream to a file. The example overwrites an existing file and then reads it back so the final state is unambiguous.

*Run the commands in this section to redirect stdout (Success stream) to a file.*
```powershell
$tmp = Join-Path $env:TEMP ('redir-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
$path = Join-Path $tmp 'processes.txt'
'old' | Out-File $path -Encoding utf8
'new' > $path
Get-Content $path
```

```text
new
```

#### Redirect stdout to a file and append additional output

`>>` appends to the same file, and `Out-File -Append` makes that intent explicit in scripts. The final read shows all three writes in order.

*Run the commands in this section to redirect stdout to a file and append additional output.*
```powershell
$tmp = Join-Path $env:TEMP ('redir-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
$path = Join-Path $tmp 'processes.txt'
'first' > $path
'second' >> $path
'third' | Out-File $path -Append
Get-Content $path
```

```text
first
second
third
```

#### Redirect stderr (Error stream) to a file

`2>` captures the error stream without touching the Success stream. The verification step filters the redirected file down to the message line so the captured error is easy to inspect.

*Run the commands in this section to redirect stderr (Error stream) to a file.*
```powershell
$tmp = Join-Path $env:TEMP ('redir-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
$path = Join-Path $tmp 'errors.txt'
Write-Error 'captured error' 2> $path
Get-Content $path | Select-String -Pattern 'captured error' | ForEach-Object { $_.Matches.Value }
```

```text
captured error
```

#### Redirect all streams to a file

`*>` is the wildcard form that captures Success, Warning, Verbose, Debug, Information, and Error output in one destination. The verification step extracts the key tokens from the saved file so each stream is visible without the surrounding formatting noise.

*Run the commands in this section to redirect all streams to a file.*
```powershell
if ($PSVersionTable.PSVersion.Major -ge 7) { $PSStyle.OutputRendering = 'PlainText' }
$tmp = Join-Path $env:TEMP ('redir-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
$path = Join-Path $tmp 'all.txt'
& {
  Write-Output 'success'
  Write-Warning 'warning'
  Write-Verbose 'verbose' -Verbose
  Write-Debug 'debug' -Debug
  Write-Information 'info' -InformationAction Continue
  Write-Error 'error'
} *> $path
Get-Content $path |
  Select-String -Pattern 'success|warning|verbose|debug|info|error' -AllMatches |
  ForEach-Object { $_.Matches.Value }
```

```text
success
warning
verbose
debug
info
Error
error
```

#### Discard all output

`*> $null` discards every PowerShell stream. Because the redirected command is intentionally silent, the follow-up line proves that only later output is still visible.

*Run the commands in this section to discard all output.*
```powershell
& {
  Write-Output 'success'
  Write-Warning 'warning'
  Write-Information 'info' -InformationAction Continue
} *> $null
'only this line remains'
```

```text
only this line remains
```

Use the lookup table below for the numbered PowerShell stream operators.

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
| `*> $null` | `cmd *> $null` | Discard all streams |

### PowerShell | redirection | Tee-Object

`Tee-Object` is the PowerShell split-point for live output plus persisted output. Unlike Bash `tee`, it works with PowerShell objects, not just plain text.

#### Write to terminal and file simultaneously

`Tee-Object -FilePath` writes the same Success stream to the console and a file. The verification step reads the file back immediately.

*Run the commands in this section to write to terminal and file simultaneously.*
```powershell
$tmp = Join-Path $env:TEMP ('redir-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
$path = Join-Path $tmp 'processes.txt'
'alpha','beta' | Tee-Object -FilePath $path
"`nfile:"
Get-Content $path
```

```text
alpha
beta

file:
alpha
beta
```

#### Append to a log file while displaying live output

`-Append` keeps existing log content. Because warnings live on stream 3, the example merges `3>&1` before `Tee-Object` so both lines are visible and persisted.

*Run the commands in this section to append to a log file while displaying live output.*
```powershell
if ($PSVersionTable.PSVersion.Major -ge 7) { $PSStyle.OutputRendering = 'PlainText' }
$tmp = Join-Path $env:TEMP ('redir-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
$path = Join-Path $tmp 'run.log'
'seed' | Set-Content $path
& { Write-Output 'live success'; Write-Warning 'live warning' } 3>&1 | Tee-Object -FilePath $path -Append
"`nfile:"
Get-Content $path
```

```text
live success
WARNING: live warning

file:
seed
live success
live warning
```
#### Capture output in a variable and continue the pipeline

`Tee-Object -Variable` lets you inspect the full stream later while the pipeline keeps moving. The filtered output proves the downstream pipeline still ran, and the final line shows the saved copy.

*Run the commands in this section to capture output in a variable and continue the pipeline.*
```powershell
$captured = $null
'one','two','three' | Tee-Object -Variable captured | Where-Object { $_ -match 't' }
"captured=$($captured -join ',')"
```

```text
two
three
captured=one,two,three
```

Use the lookup table below for the most common `Tee-Object` parameters.

| Parameter | Syntax | Description |
|---|---|---|
| `-FilePath` | `Tee-Object -FilePath file` | Write to file (overwrite) and pass through |
| `-Append` | `Tee-Object -FilePath file -Append` | Write to file (append) and pass through |
| `-Variable` | `Tee-Object -Variable varName` | Store in variable and pass through |

### PowerShell | redirection | here-string

PowerShell here-strings are multi-line literals, not stdin redirection. They matter in this note because they are often the PowerShell substitute for Bash here-doc content blocks.

#### Expandable here-string - variable interpolation active

`@"..."@` expands variables and expressions inside the block. The example uses a fixed date string so the original captured output remains stable.

*Run the commands in this section to expandable here-string - variable interpolation active.*
```powershell
$name = "World"
$today = "2026-04-03"
$text = @"
Hello, $name
Today is $today
"@
Write-Output $text
```

```text
Hello, World
Today is 2026-04-03
```

#### Literal here-string - no expansion

`@'...'@` keeps the content untouched. That is the safe form for SQL, JSON, templates, and any block that contains `$`-prefixed text you do not want interpolated.

*Run the commands in this section to literal here-string - no expansion.*
```powershell
$sql = @'
SELECT *
FROM dbo.Positions
WHERE ticker = '$AAPL'
  AND date >= '2026-01-01'
'@
Write-Output $sql
```

```text
SELECT *
FROM dbo.Positions
WHERE ticker = '$AAPL'
  AND date >= '2026-01-01'
```

Use the lookup table below when choosing the PowerShell here-string form.

| Form | Delimiters | Variable expansion | Use case |
|---|---|---|---|
| Expandable | `@"..."@` | Yes | Strings with dynamic values |
| Literal | `@'...'@` | No | SQL, JSON, regex, raw templates |

### PowerShell | redirection recommendations | logging and encoding patterns

These patterns build on the core operators above and focus on the cases that most often matter in scripts shared across Windows and Unix environments.

#### Append production logs with `Tee-Object -Append`

When operators need both live visibility and a durable log, append instead of overwrite. Merging stream 3 before the tee step keeps warning text in the same timeline.

*Run the commands in this section to append production logs with `Tee-Object -Append`.*
```powershell
if ($PSVersionTable.PSVersion.Major -ge 7) { $PSStyle.OutputRendering = 'PlainText' }
$tmp = Join-Path $env:TEMP ('redir-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
$path = Join-Path $tmp 'run.log'
'seed' | Set-Content $path
& { Write-Output 'live success'; Write-Warning 'live warning' } 3>&1 | Tee-Object -FilePath $path -Append
"`nfile:"
Get-Content $path
```

```text
live success
WARNING: live warning

file:
seed
live success
live warning
```

#### Keep success output and error output in separate files

Separating data from diagnostics keeps structured results machine-readable. The example writes the data row to one file and the error text to another.

*Run the commands in this section to keep success output and error output in separate files.*
```powershell
$tmp = Join-Path $env:TEMP ('redir-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
$data = Join-Path $tmp 'data.csv'
$errors = Join-Path $tmp 'errors.log'
& { 'row1,row2'; [Console]::Error.WriteLine('bad row') } > $data 2> $errors
'data.csv:'
Get-Content $data
"`nerrors.log:"
Get-Content $errors
```

```text
data.csv:
row1,row2

errors.log:
bad row
```

#### Prefer `Out-File -Encoding utf8` when another tool will read the file

Encoding bugs are easiest to prevent before the file leaves PowerShell. The byte dump below shows the UTF-8 representation of `olá` rather than the UTF-16LE layout that surprises many Unix tools.

*Run the commands in this section to prefer `Out-File -Encoding utf8` when another tool will read the file.*
```powershell
$tmp = Join-Path $env:TEMP ('redir-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
$path = Join-Path $tmp 'utf8.txt'
'olá' | Out-File $path -Encoding utf8
[BitConverter]::ToString([IO.File]::ReadAllBytes($path))
```

```text
6F-6C-C3-A1-0D-0A
```

### PowerShell | redirection troubleshooting | encoding and stream capture problems

Most PowerShell redirect bugs come from the extra streams or from encoding defaults that differ across hosts. These examples isolate those two cases.

#### Redirected file contains UTF-16LE bytes

If a file starts with `FF-FE` and every character is followed by `00`, you wrote UTF-16LE. That is the default many people still encounter in Windows PowerShell 5.1.

*Run the commands in this section to redirected file contains UTF-16LE bytes.*
```powershell
$tmp = Join-Path $env:TEMP ('redir-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
$path = Join-Path $tmp 'unicode.txt'
'olá' | Out-File $path -Encoding unicode
[BitConverter]::ToString([IO.File]::ReadAllBytes($path))
```

```text
FF-FE-6F-00-6C-00-E1-00-0D-00-0A-00
```

#### The pipeline missed warnings

PowerShell pipes stream 1 by default, not stream 3. The first command shows the warning reaching the console while the pipeline sees only the data row; the second merges `3>&1` so the warning enters the pipeline too.

*Run the commands in this section to the pipeline missed warnings.*
```powershell
if ($PSVersionTable.PSVersion.Major -ge 7) { $PSStyle.OutputRendering = 'PlainText' }
& { Write-Warning 'pay attention'; Write-Output 'data row' } | ForEach-Object { "pipe saw: $_" }
```

```text
WARNING: pay attention
pipe saw: data row
```

*Run the commands in this section to the pipeline missed warnings.*
```powershell
if ($PSVersionTable.PSVersion.Major -ge 7) { $PSStyle.OutputRendering = 'PlainText' }
& { Write-Warning 'pay attention'; Write-Output 'data row' } 3>&1 | ForEach-Object { "pipe saw: $_" }
```

```text
pipe saw: pay attention
pipe saw: data row
```

## I/O Redirection Warnings and Failure Patterns

- **Redirect-before-write is silent.** `sort file.txt > file.txt` empties the file before `sort` reads it.
- **`2>&1` is evaluated left to right.** Put it after the stdout redirect when both streams must land in the same place.
- **`>` never asks for confirmation.** Use append mode, `noclobber`, or a temporary file when overwriting is risky.
- **Pipes do not collect every stream by default.** Bash pipes stdout unless you merge stderr first; PowerShell pipes stream 1 unless you merge additional streams.
- **PowerShell encoding is host-sensitive.** If a file leaves PowerShell, declare the encoding instead of relying on defaults.

## I/O Redirection Cross-References

- [command-chaining](https://alp78.github.io/elysium/01-Shell/01-Scripting/04-command-chaining) - Using pipes and operators to connect commands
- [defensive-scripting](https://alp78.github.io/elysium/01-Shell/01-Scripting/07-defensive-scripting) - The `set` flags that prevent scripting disasters
- [process-substitution](https://alp78.github.io/elysium/01-Shell/01-Scripting/06-process-substitution) - Using `<()` and `>()` to treat output as files

## I/O Redirection References

- [GNU Bash Reference - Redirections](https://www.gnu.org/software/bash/manual/html_node/Redirections.html)
- [PowerShell - About Redirection](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_redirection)
- [PowerShell - Tee-Object](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/tee-object)
