---
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell, bash, linux, powershell]
aliases: [command chaining, shell operators, chain commands, && operator, pipe operator, semicolon operator, OR operator]
keywords: [command chaining, exit code, logical AND, logical OR, pipe, pipeline, semicolon, fail-fast, bash operators, powershell operators, process exit code, shell execution flow]
description: "How bash and PowerShell command chaining operators (&&, ||, ;, |) use exit codes to control execution flow, enabling fail-fast scripts and graceful error handling."
related: [io-redirection, defensive-scripting, process-substitution]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Command Chaining — Controlling Execution Flow

Command chaining operators use process exit codes to decide what runs next. Every command exits with a numeric code: 0 means success, anything else means failure. Understanding these operators is the difference between a deployment script that stops on the first error and one that silently plows through failures, leaving your system in an inconsistent state.

## The Four Operators

### AND Operator (&&) — Fail-Fast Chaining

The `&&` operator is a logical AND gate on exit codes. The shell executes the first command, checks its exit code, and only proceeds to the next command if the exit code is exactly 0.

#### && operator — run second command only if first succeeds
```bash
# AND — Run B only if A succeeds (exit code 0)
command_a && command_b
```

#### && chained deploy — git pull, docker build, docker up
```bash
# Each step only runs if the previous succeeded
git pull origin main && \
docker compose build pipeline && \
docker compose up -d pipeline && \
echo "Deploy complete at $(date)"
```

If `git pull` fails (merge conflict, network error), the build never starts. If the build fails (syntax error, missing dependency), the container is never restarted with broken code. This is **fail-fast chaining** — the backbone of every safe deployment script.

#### PowerShell && and $LASTEXITCODE — AND chain (7+ only)
```powershell
# AND chain (PowerShell 7+ only)
command_a && command_b

# PowerShell 5.1 — no && support, use explicit error checking
command_a; if ($LASTEXITCODE -eq 0) { command_b }
# $LASTEXITCODE = exit code of the last native (non-PowerShell) command
# For PowerShell cmdlets, use $? (True if last command succeeded)
```

### Semicolon (;) — Sequential with No Error Checking

The semicolon is a sequential separator with no error checking. It is the equivalent of pressing Enter between two commands. The second command always runs, regardless of whether the first succeeded or failed.

#### ; semicolon — run B regardless of whether A succeeds
```bash
# SEMICOLON — Run B regardless of whether A succeeds
command_a ; command_b
```

**When to use semicolons:** Only when the commands are genuinely independent. Listing multiple diagnostic commands during an incident is a valid use case:

#### ; chained diagnostics — free, df, docker ps, ss during outage
```bash
# Gathering diagnostics during an outage — all commands should run regardless
free -h ; df -h ; docker ps ; ss -tlnp
```

> [!warning] Never use semicolons in data scripts
>
> A semicolon between "delete old data" and "load new data" means the load runs even if the delete failed — and now you have duplicate data.

### OR Operator (||) — Fallback on Failure

The `||` operator is a logical OR gate — the fallback operator. Use it to provide an alternative action when the primary action fails.

#### || operator — run B only if A fails (non-zero exit code)
```bash
# OR — Run B only if A fails (non-zero exit code)
command_a || command_b
```

#### || fallback — rsync fails, fall back to scp
```bash
# Try the fast path; if it fails, fall back to the slow path
rsync -avz /data/ backup-server:/data/ || scp -r /data/ backup-server:/data/
```

#### PowerShell || — OR chain and semicolon (7+ only)

```powershell
# OR chain (PowerShell 7+)
command_a || command_b

# Sequential regardless
command_a; command_b
```

### AND + OR Combined — The Shell Try/Catch

The most powerful pattern combines `&&` and `||` for try/catch-style logic:

#### && || combined — shell try/catch pattern
```bash
# Try to connect; exit with clear error message if it fails
sqlcmd -S 10.132.0.2 -U sa -P "$DB_PASS" -d data-pipeline -Q "SELECT 1" > /dev/null 2>&1 \
  && echo "Database connection OK" \
  || { echo "FATAL: Cannot connect to database" >&2; exit 1; }
```

This pattern — `try && success_action || failure_action` — is the shell equivalent of try/catch. The curly braces `{ }` group the failure actions. Note the semicolon before the closing brace and the space after the opening brace — both are syntactically required in bash.

### Pipe (|) — Streaming Composition

Pipes are the shell's composition mechanism. Each command in a pipeline runs as a separate process, and the kernel connects them via an in-memory buffer. Data flows from left to right, streaming — the second command can begin processing before the first has finished producing all its output.

#### | pipe — connect stdout of A to stdin of B
```bash
# PIPE — Connect stdout of A to stdin of B
command_a | command_b
```

#### zcat | grep | awk | sort — streaming 50GB log analysis
```bash
# Stream through the file without loading it into memory
zcat /var/log/pipeline-2025-03-*.gz | \
  grep -E "ERROR|DEADLOCK|TIMEOUT" | \
  awk '{print $1, $2, $NF}' | \
  sort | uniq -c | sort -rn | head -20
```

This pipeline decompresses, filters, extracts fields, counts occurrences, and shows the top 20 error patterns — all in a single streaming pass. No intermediate files, no memory explosion. A 50GB compressed log can be analyzed in minutes on a machine with 2GB of RAM.

> [!abstract] Pipeline exit code trap
>
> By default, a pipeline's exit code is the exit code of the **last** command only. If `grep` finds nothing (exit code 1) but `wc -l` succeeds (exit code 0), the pipeline reports success. This masks failures silently.
>
> Fix this with `set -o pipefail`:
> ```bash
> set -o pipefail
> grep "CRITICAL" /var/log/app.log | wc -l
> # Now the pipeline exits with grep's exit code (1) if grep finds nothing
> ```
> Always enable `pipefail` in scripts. Never in interactive shells (it makes `history | grep` annoying).

#### PowerShell | pipe — objects, not text (Where-Object, Sort-Object)

```powershell
# Pipe (passes OBJECTS, not text — this is PowerShell's superpower)
Get-Process | Where-Object CPU -gt 100 | Sort-Object CPU -Descending | Select-Object -First 5
# Unlike bash (which pipes raw text), PowerShell pipes structured .NET objects
# Where-Object filters on actual typed properties, not string patterns

# Redirect all streams to file
command *> all.txt
# * = all output streams (stdout + stderr + verbose + warning + debug + information)
# This is more comprehensive than bash's 2>&1
```

> [!info] PowerShell objects vs bash text
>
> This is the fundamental difference between the two shells. Bash pipes raw text — every command must parse the text it receives, and subtle formatting changes can break downstream commands. PowerShell pipes structured .NET objects with typed properties. This means `Sort-Object CPU` sorts by the actual numeric CPU value, not by a string that happens to look like a number. When you are processing structured data (JSON, CSV, database results), PowerShell's object pipeline eliminates an entire class of parsing bugs.
>
> The trade-off: PowerShell is verbose and slower for simple text processing. Use bash for log analysis, file manipulation, and Unix-native tools. Use PowerShell for structured data, Windows administration, and .NET integration.

## Related

- [io-redirection](/01-Shell/Scripting/io-redirection) — Controlling where command output goes
- [defensive-scripting](/01-Shell/Scripting/defensive-scripting) — Using `set -euo pipefail` to make scripts safe
- [process-substitution](/01-Shell/Scripting/process-substitution) — Treating command output as files

## References

- [GNU Bash Reference — Pipelines](https://www.gnu.org/software/bash/manual/html_node/Pipelines.html)
- [GNU Bash Reference — Lists of Commands](https://www.gnu.org/software/bash/manual/html_node/Lists.html)
