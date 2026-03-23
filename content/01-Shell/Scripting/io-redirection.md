---
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell, bash]
aliases: [IO redirection, I/O redirection, output redirection, stderr redirect, stdin redirect, file descriptors]
keywords: [redirection, stdout, stderr, stdin, file descriptor, dev null, redirect output, redirect error, tee, append, overwrite, fd 0, fd 1, fd 2, 2>&1, output to file]
description: "How to redirect stdin, stdout, and stderr to files, other streams, or /dev/null in bash and PowerShell, including production logging patterns and common gotchas."
related: [command-chaining, defensive-scripting, process-substitution]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# I/O Redirection — Controlling Where Output Goes

Every process has three standard file descriptors: fd 0 (stdin) for input, fd 1 (stdout) for normal output, and fd 2 (stderr) for error messages. Redirection lets you reroute these streams to files, other streams, or `/dev/null` (the void). Mastering redirection is essential for logging pipeline runs, suppressing noise, and separating errors from normal output.

## Bash Redirection

**Redirect stdout to file (overwrite):**
```bash
# Redirect stdout to file (overwrite)
command > output.txt
# Creates the file if it doesn't exist; truncates it if it does
```

**Redirect stdout to file (append):**
```bash
# Redirect stdout to file (append)
command >> output.txt
# Appends to the file — safe for log aggregation
```

**Redirect stderr to file:**
```bash
# Redirect stderr to file
command 2> errors.txt
# Only error messages go to the file; normal output still prints to terminal
```

**Redirect both stdout and stderr to the same file:**
```bash
# Redirect both stdout and stderr to the same file
command > all.txt 2>&1
# ORDER MATTERS: > all.txt redirects fd 1 to the file, then 2>&1 redirects fd 2 to fd 1
# The reverse order (2>&1 > all.txt) does NOT work as expected
```

**Modern bash syntax (bash 4+):**
```bash
# Modern bash syntax (bash 4+)
command &> all.txt
# Shorthand for > all.txt 2>&1 — cleaner, same result
```

**Discard all output (both stdout and stderr):**
```bash
# Discard all output (both stdout and stderr)
command > /dev/null 2>&1
# /dev/null = the black hole — writes to it vanish, reads from it return EOF
# Use case: running a command purely for its exit code (e.g., testing connectivity)
```

**Redirect stdin from a file:**
```bash
# Redirect stdin from a file
sqlcmd -S server -U sa -P "$PASS" -d data-pipeline < query.sql
# The < operator feeds the file's contents as stdin to the command
```

## Production Logging Patterns

**Capture stdout and stderr separately for post-mortem analysis:**
```bash
# Capture stdout and stderr separately for post-mortem analysis
python3 pipeline/run.py \
  > /var/log/pipeline/run_$(date +%Y%m%d_%H%M%S).log \
  2> /var/log/pipeline/run_$(date +%Y%m%d_%H%M%S).err
```

**Tee to both file and terminal (see output in real-time AND save it):**
```bash
# Or tee to both file and terminal (see output in real-time AND save it)
python3 pipeline/run.py 2>&1 | tee -a /var/log/pipeline/run.log
# tee -a = append to file while also passing through to stdout
# 2>&1 = merge stderr into stdout so tee captures both
```

## Gotchas and Edge Cases

> [!warning] Redirect Before the Command Exists — Data Loss Bug
> ```bash
> # This TRUNCATES output.txt before the command even runs:
> sort output.txt > output.txt   # BUG: file is now empty
>
> # Fix: use a temporary file or sponge (from moreutils)
> sort output.txt > tmp.txt && mv tmp.txt output.txt
> sort output.txt | sponge output.txt  # sponge buffers all input before writing
> ```
> The shell opens the output file (truncating it) BEFORE starting the command. This is one of the most common data-loss bugs in shell scripting.

## PowerShell Redirection

```powershell
# Overwrite
command > output.txt      # or: command | Out-File output.txt
# Append
command >> output.txt     # or: command | Out-File output.txt -Append
# Stderr only
command 2> errors.txt
# All streams (stdout + stderr + verbose + warning + debug + information)
command *> all.txt
# Discard all output
command *> $null          # PowerShell equivalent of /dev/null
```

## Related

- [[command-chaining]] — Using pipes and operators to connect commands
- [[defensive-scripting]] — The `set` flags that prevent scripting disasters
- [[process-substitution]] — Using `<()` and `>()` to treat output as files

## References

- [GNU Bash Reference — Redirections](https://www.gnu.org/software/bash/manual/html_node/Redirections.html)
