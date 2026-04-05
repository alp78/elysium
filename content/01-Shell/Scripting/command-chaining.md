---
title: "Command Chaining"
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell, scripting]
aliases: [command chaining, shell operators, chain commands, && operator, pipe operator, semicolon operator, OR operator]
keywords: [command chaining, exit code, logical AND, logical OR, pipe, pipeline, semicolon, fail-fast, bash operators, powershell operators, process exit code, shell execution flow]
description: "How bash and PowerShell command chaining operators (&&, ||, ;, |) use exit codes to control execution flow, enabling fail-fast scripts and graceful error handling."
parent: "[[domain-script-engineering]]"
links:
  - "[[command-history]]"
  - "[[io-redirection]]"
  - "[[process-substitution]]"
  - "[[brace-expansion-and-globbing]]"
  - "[[environment-variables]]"
  - "[[defensive-scripting]]"
  - "[[bash-automation]]"
  - "[[powershell-automation]]"
created: 2026-03-22
updated: 2026-04-03
status: complete
---

# Command Chaining — Controlling Execution Flow

Command chaining operators use process exit codes to decide what runs next. Every command exits with a numeric code: 0 means success, anything else means failure. Understanding these operators is the difference between a deployment script that stops on the first error and one that silently plows through failures, leaving your system in an inconsistent state.

> [!quote]
> "This is the Unix philosophy: Write programs that do one thing and do it well. Write programs to work together. Write programs to handle text streams, because that is a universal interface."
>
> — **Doug McIlroy**, *Bell System Technical Journal* (1978)

## Linux command chaining operators

Bash provides four primary chaining operators: `&&` (AND), `||` (OR), `;` (sequential), and `|` (pipe). Each operator reads the exit code of the preceding command to determine whether and how to continue. These operators are the core building blocks of safe, expressive shell scripting.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {'primaryColor': '#292e42','primaryTextColor': '#c0caf5','primaryBorderColor': '#565f89','lineColor': '#565f89','secondaryColor': '#1a1b26','tertiaryColor': '#24283b','noteTextColor': '#c0caf5','noteBkgColor': '#292e42','textColor': '#c0caf5','fontSize': '14px'}}}%%
flowchart TD
    A([Command A runs]) --> B{Exit code?}
    B -->|0 — success| C["&& → runs Command B"]
    B -->|non-zero — failure| D["|| → runs Command B"]
    B -->|ignored| E["; → always runs Command B"]
    A --> F["| → streams stdout to Command B's stdin\n(runs concurrently)"]

    style A fill:#292e42,color:#c0caf5
    style B fill:#1a1b26,color:#c0caf5
    style C fill:#24283b,color:#c0caf5
    style D fill:#24283b,color:#c0caf5
    style E fill:#24283b,color:#c0caf5
    style F fill:#24283b,color:#c0caf5
```

### Linux | && | AND operator — fail-fast chaining

The `&&` operator is a logical AND gate on exit codes. The shell executes the first command, checks its exit code, and only proceeds to the next command if the exit code is exactly 0. If any command in the chain fails, the rest of the chain is skipped — this is fail-fast chaining.

#### Run a single dependent command

The simplest form: run `command_b` only if `command_a` exits with code 0.

```bash
command_a && command_b
```

#### Chain a deploy — git pull, docker build, docker up

Each step only runs if the previous succeeded. The backslash continues the command across lines for readability.

```bash
git pull origin main && \
docker compose build pipeline && \
docker compose up -d pipeline && \
echo "Deploy complete at $(date)"
```

If `git pull` fails (merge conflict, network error), the build never starts. If the build fails (syntax error, missing dependency), the container is never restarted with broken code. This is the backbone of every safe deployment script.

#### Combine AND with OR — shell try/catch pattern

The most powerful pattern combines `&&` and `||` for try/catch-style logic. The curly braces `{ }` group multiple failure actions into a single logical unit. The space after `{` and the semicolon before `}` are both syntactically required in bash.

```bash
sqlcmd -S 10.132.0.2 -U sa -P "$DB_PASS" -d data-pipeline -Q "SELECT 1" > /dev/null 2>&1 \
  && echo "Database connection OK" \
  || { echo "FATAL: Cannot connect to database" >&2; exit 1; }
```

This reads as: try the SQL connection → on success, print OK → on failure, print error to stderr and exit with code 1.

| Operator | Syntax | Runs next command when... |
|---|---|---|
| `&&` | `cmd_a && cmd_b` | `cmd_a` exits with code 0 (success) |
| `\|\|` | `cmd_a \|\| cmd_b` | `cmd_a` exits with any non-zero code (failure) |
| `&&` + `\|\|` | `cmd_a && ok \|\| fail` | Combined: `ok` on success, `fail` on failure |

### Linux | || | OR operator — fallback on failure

The `||` operator is a logical OR gate — the fallback operator. Use it to provide an alternative action when the primary action fails. The second command runs only if the first exits with a non-zero code.

#### Run a fallback command on failure

```bash
command_a || command_b
```

#### Fall back from rsync to scp on failure

Try the fast network sync path first; if it fails (e.g., `rsync` is not installed on the remote, or the connection drops), fall back to the slower but universally available `scp`.

```bash
rsync -avz /data/ backup-server:/data/ || scp -r /data/ backup-server:/data/
```

#### Provide a safe default value

The `||` operator is commonly used to assign a default value when a variable lookup or command fails.

```bash
DB_HOST=$(cat /etc/db_host 2>/dev/null) || DB_HOST="localhost"
```

| Operator | Syntax | Runs next command when... |
|---|---|---|
| `\|\|` | `cmd_a \|\| cmd_b` | `cmd_a` exits with non-zero (failure) |
| `\|\|` | `val=$(cmd) \|\| val=default` | `cmd` fails — sets a safe default |

### Linux | ; | semicolon — sequential with no error checking

The semicolon is a sequential separator with no error checking. It is the equivalent of pressing Enter between two commands. The second command always runs, regardless of whether the first succeeded or failed.

#### Run commands sequentially regardless of outcome

```bash
command_a ; command_b
```

#### Gather diagnostics during an outage

All diagnostic commands should run regardless of whether earlier ones fail — you want as much information as possible during an incident.

```bash
free -h ; df -h ; docker ps ; ss -tlnp
```

> [!warning] Never use semicolons in data pipeline scripts
>
> A semicolon between "delete old data" and "load new data" means the load runs even if the delete failed. The result is duplicate or inconsistent data with no error surfaced.

> [!success] Use `&&` in data scripts
>
> Replace semicolons with `&&` whenever commands are causally dependent. The pipeline will stop at the first failure and return a non-zero exit code that CI/CD systems, cron monitors, and alerting tools can detect.
>
> ```bash
> truncate_staging_table && load_new_data && validate_row_count
> ```

| Operator | Syntax | Runs next command when... |
|---|---|---|
| `;` | `cmd_a ; cmd_b` | Always — exit code is ignored |

### Linux | | | pipe — streaming composition

Pipes are the shell's composition mechanism. Each command in a pipeline runs as a separate process, and the kernel connects them via an in-memory buffer. Data flows from left to right as a continuous stream — the second command can begin processing before the first has finished producing all its output. This allows pipelines to process files larger than available RAM.

#### Connect stdout of one command to stdin of another

```bash
command_a | command_b
```

#### Analyze a 50 GB compressed log file — stream without loading into memory

The pipeline decompresses, filters on error patterns, extracts timestamp and message fields, counts occurrences, and surfaces the top 20 patterns — all in a single streaming pass. No intermediate files are written and no full decompression is needed.

```bash
zcat /var/log/pipeline-2025-03-*.gz | \
  grep -E "ERROR|DEADLOCK|TIMEOUT" | \
  awk '{print $1, $2, $NF}' | \
  sort | uniq -c | sort -rn | head -20
```

#### Enable pipefail to propagate failures through the pipeline

By default, a pipeline's exit code is the exit code of the last command only. If `grep` finds no matches (exit code 1) but `wc -l` succeeds (exit code 0), the pipeline as a whole reports success — silently masking the grep failure.

```bash
set -o pipefail
```

With `pipefail` active, the pipeline exits with the first non-zero exit code from any stage. Enable it at the top of every script. Avoid it in interactive shells — it makes common patterns like `history | grep cmd` return errors when the pattern is not found.

> [!warning] Pipeline exit code trap without pipefail
>
> Without `set -o pipefail`, a failed early stage (e.g., a `grep` returning no results) is silently swallowed. The script continues as if the pipeline succeeded, which can produce empty or incorrect results in downstream steps.

> [!success] Enable pipefail in all scripts
>
> Add `set -o pipefail` (or combine with `set -euo pipefail`) at the top of every bash script. This ensures any stage failure propagates as the pipeline's overall exit code, making failures visible to the caller and to CI/CD systems.
>
> ```bash
> #!/usr/bin/env bash
> set -euo pipefail
> ```

| Operator | Syntax | Description |
|---|---|---|
| `\|` | `cmd_a \| cmd_b` | Connects stdout of `cmd_a` to stdin of `cmd_b`; commands run concurrently |
| `\|&` | `cmd_a \|& cmd_b` | Connects both stdout and stderr of `cmd_a` to stdin of `cmd_b` (bash 4+) |

## PowerShell command chaining operators

PowerShell mirrors bash's chaining operators. PowerShell 7 introduced native `&&` and `||` pipeline chain operators, aligning its syntax with bash for users writing cross-platform scripts. The fundamental difference is that PowerShell's `|` pipe passes structured .NET objects rather than raw text, eliminating the text-parsing step required in bash pipelines.

### PowerShell | && | AND operator — fail-fast chaining

The `&&` pipeline chain operator was introduced in PowerShell 7.0. It behaves identically to bash: the right-hand command runs only if the left-hand command succeeds (i.e., `$?` is `$true` and no terminating error was thrown). This operator is not available in Windows PowerShell 5.1.

#### Run a dependent command on success (PowerShell 7+)

```powershell
command_a && command_b
```

#### Chain a deploy — git pull, dotnet build, service restart (PowerShell 7+)

```powershell
git pull origin main && `
dotnet build ./Pipeline.sln --configuration Release && `
Restart-Service -Name PipelineWorker && `
Write-Host "Deploy complete at $(Get-Date)"
```

#### Combine AND with OR — PowerShell try/catch pattern (PowerShell 7+)

```powershell
Test-NetConnection -ComputerName db-server -Port 1433 -Quiet && `
  Write-Host "Database connection OK" || `
  { Write-Error "FATAL: Cannot connect to database"; exit 1 }
```

| Operator | Syntax | Runs next command when... |
|---|---|---|
| `&&` | `cmd_a && cmd_b` | `cmd_a` succeeds (`$?` is `$true`) |
| `\|\|` | `cmd_a \|\| cmd_b` | `cmd_a` fails (`$?` is `$false`) |
| `&&` + `\|\|` | `cmd_a && ok \|\| fail` | Combined: `ok` on success, `fail` on failure |

### PowerShell | || | OR operator — fallback on failure

The `||` pipeline chain operator runs the right-hand command only if the left-hand command fails. Introduced in PowerShell 7.0, it mirrors bash's `||` behavior.

#### Run a fallback command on failure (PowerShell 7+)

```powershell
command_a || command_b
```

#### Fall back to a local copy if remote fetch fails (PowerShell 7+)

```powershell
Invoke-RestMethod -Uri "https://api.example.com/rates" -OutFile rates.json || `
  Copy-Item -Path ".\rates_fallback.json" -Destination ".\rates.json"
```

| Operator | Syntax | Runs next command when... |
|---|---|---|
| `\|\|` | `cmd_a \|\| cmd_b` | `cmd_a` fails (`$?` is `$false`) |

### PowerShell | ; | semicolon — sequential with no error checking

The semicolon in PowerShell separates statements sequentially, equivalent to pressing Enter between them. The second statement always executes regardless of whether the first succeeded. Available in all PowerShell versions.

#### Run statements sequentially regardless of outcome

```powershell
command_a; command_b
```

#### Gather diagnostics during an outage

```powershell
Get-Process | Measure-Object WorkingSet -Sum; Get-Disk; Get-NetTCPConnection -State Listen
```

> [!warning] Never use semicolons in pipeline scripts with causal dependencies
>
> A semicolon between "clear staging table" and "insert new data" means the insert runs even if the truncation failed, producing duplicate rows.

> [!success] Use `&&` for causally dependent steps
>
> ```powershell
> Invoke-Sqlcmd -Query "TRUNCATE TABLE staging.Rates" && `
> Import-Csv rates.csv | Write-SqlTableData -TableName "staging.Rates"
> ```

| Operator | Syntax | Runs next command when... |
|---|---|---|
| `;` | `cmd_a; cmd_b` | Always — exit status is ignored |

### PowerShell | | | pipe — object pipeline

PowerShell's pipe passes structured .NET objects from one cmdlet to the next, not raw text. This means downstream cmdlets receive typed properties (integers, datetimes, booleans) rather than strings that need to be parsed. The trade-off is that PowerShell pipelines are more verbose and slower for simple text-only tasks compared to bash.

The key cmdlets for pipeline processing are: `Where-Object` (filter), `Select-Object` (project properties), `Sort-Object` (sort by property), `ForEach-Object` (iterate), and `Group-Object` (aggregate).

#### Filter, sort, and select top results from an object pipeline

`Where-Object CPU -gt 100` filters by the actual numeric `CPU` property — not by string comparison. `Sort-Object CPU -Descending` sorts numerically. No parsing is required.

```powershell
Get-Process | Where-Object CPU -gt 100 | Sort-Object CPU -Descending | Select-Object -First 5
```

```text
 NPM(K)    PM(M)      WS(M)     CPU(s)      Id  SI ProcessName
 ------    -----      -----     ------      --  -- -----------
     82   256.34     312.45    1845.22    4512   1 chrome
     41   128.10     145.33     923.11    3201   1 node
     ...
```

#### Redirect all output streams to a file

The `*>` operator captures all PowerShell output streams: stdout, stderr, verbose, warning, debug, and information. This is more comprehensive than bash's `2>&1`, which only merges stderr into stdout.

```powershell
Some-Command *> all-output.txt
```

PowerShell pipes raw text strings when you run an external executable (e.g., `git`, `curl`, `python`). The object pipeline only applies to native PowerShell cmdlets and functions that return .NET objects.

> [!info] PowerShell object pipeline vs bash text pipeline
>
> Bash pipes raw text — every command must parse the text it receives, and subtle formatting changes (whitespace, column reordering, locale-specific date formats) can silently break downstream commands. PowerShell pipes structured .NET objects with typed properties. `Sort-Object CPU` sorts by an actual numeric value; `Where-Object StartTime -gt (Get-Date).AddHours(-1)` compares real `DateTime` objects.
>
> When processing structured data (JSON, CSV, database results, Windows event logs), PowerShell's object pipeline eliminates an entire class of parsing bugs. For unstructured text (log files, arbitrary command output, Unix-native tools), bash remains the more ergonomic choice.

| Operator | Syntax | Description |
|---|---|---|
| `\|` | `cmd_a \| cmd_b` | Passes .NET objects from `cmd_a` to `cmd_b` (cmdlets) or text (external executables) |
| `*>` | `cmd *> file.txt` | Redirects all output streams (stdout + stderr + verbose + warning + debug + information) to a file |

## Related

- [io-redirection](https://alp78.github.io/elysium/01-Shell/Scripting/io-redirection) — Controlling where command output goes
- [defensive-scripting](https://alp78.github.io/elysium/01-Shell/Scripting/defensive-scripting) — Using `set -euo pipefail` to make scripts safe
- [process-substitution](https://alp78.github.io/elysium/01-Shell/Scripting/process-substitution) — Treating command output as files

## References

- [GNU Bash Reference — Pipelines](https://www.gnu.org/software/bash/manual/html_node/Pipelines.html)
- [GNU Bash Reference — Lists of Commands](https://www.gnu.org/software/bash/manual/html_node/Lists.html)
- [PowerShell 7 Pipeline Chain Operators](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_pipeline_chain_operators)
