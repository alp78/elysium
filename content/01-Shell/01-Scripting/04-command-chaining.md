---
title: "04 - Command Chaining"
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell, scripting]
aliases: [command chaining, shell operators, chain commands, && operator, pipe operator, semicolon operator, OR operator]
keywords: [command chaining, exit code, logical AND, logical OR, pipe, pipeline, semicolon, fail-fast, bash operators, powershell operators, process exit code, shell execution flow]
description: "How bash and PowerShell command chaining operators (&&, ||, ;, |) use exit codes to control execution flow, enabling fail-fast scripts and graceful error handling."
created: 2026-03-22
updated: 2026-04-03
status: complete
---

# Command Chaining

> [!quote]
> "This is the Unix philosophy: Write programs that do one thing and do it well. Write programs to work together. Write programs to handle text streams, because that is a universal interface."
>
> — **Doug McIlroy**, *Bell System Technical Journal* (1978)

> [!abstract]- Summary
>
> Covers bash and PowerShell command chaining operators (`&&`, `||`, `;`, `|`) and how each uses process exit codes to control execution flow, enabling fail-fast deployment scripts, fallback logic, streaming pipelines, and safe error handling.
>
> **Bash chaining operators**
> - `&&` (AND): runs next command only on exit code 0 — backbone of fail-fast scripting; use between all causally dependent steps
> - `||` (OR): runs next command only on non-zero exit — fallback logic, default-value assignment, and the `&& / ||` try/catch idiom
> - `;` (semicolon): runs next command unconditionally, ignoring exit codes — appropriate only for independent commands (e.g., diagnostic sweeps)
> - `|` (pipe): connects stdout of one process to stdin of the next; commands run concurrently; pipeline exit code is the last command's by default
> - `pipefail` (`set -o pipefail`): makes the pipeline return the first non-zero exit code from any stage; required in all scripts
>
> **PowerShell chaining operators**
> - `&&` / `||` (PS 7+): native pipeline chain operators, checking `$?` after each command; not available in Windows PowerShell 5.1
> - `;`: sequential separator, available in all PowerShell versions, ignores success/failure
> - `|` (object pipeline): passes structured .NET objects between cmdlets — typed properties, no text parsing; external executables (`git`, `curl`, `python`) still emit raw text
> - `*>`: redirects all output streams (stdout + stderr + verbose + warning + debug + information) to a file
>
> **Patterns and idioms**
> - Fail-fast deploy chain: `git pull && build && restart`
> - Shell try/catch: `cmd && echo "ok" || { echo "fail" >&2; exit 1; }`
> - Safe default value: `val=$(cmd) || val=default`
> - Script header: `set -euo pipefail` combines fail-fast, unset-variable detection, and pipeline failure propagation
> - Cleanup on failure: use `trap 'cleanup' EXIT` (bash) or `try/catch/finally` (PS) — not `||`
>
> **Operations and safety**
> - Warnings: semicolons in data pipelines mask failures silently; `&& / ||` try/catch pattern has a fragile edge case when the success branch fails; pipeline exit code is last-command-only without `pipefail`; `&&` / `||` are syntax errors in PS 5.1
> - Recommendations table: 7 scenarios covering script header, dependent steps, fallback logic, cleanup, long pipelines, cross-platform, and interactive use
> - Troubleshooting: 5 failure modes covering silent step continuation, empty pipeline output, `&&` syntax error in PS, `||` triggering on success-branch failure, and `$?` / `$LASTEXITCODE` mismatch in PowerShell

> [!note]- Glossary
>
> **Exit code**
> - A numeric value (0–255) every process returns on exit; 0 means success, any non-zero value means failure.
> - Every chaining operator reads the exit code of the preceding command to decide whether to run, skip, or branch — it is the universal signal that connects all operators in this note.
>
> > [!warning] Output does not imply success
> >
> > A command can print text to stdout and still exit with a non-zero code. Never infer success from visible output; always inspect the exit code via `$?` or `$LASTEXITCODE`.
>
> ---
>
> **`$?`**
> - A bash special variable that holds the exit code of the most recently executed foreground command or pipeline.
> - Used implicitly by `&&`, `||`, and `set -e` to make branching decisions; inspect it explicitly in scripts to detect failure after commands that do not chain naturally.
>
> > [!warning] `$?` is overwritten immediately
> >
> > Every command — including `echo` — overwrites `$?`. Capture it in a variable (`rc=$?`) immediately after the command you care about, before any other statement runs.
>
> ---
>
> **`$LASTEXITCODE`**
> - A PowerShell automatic variable that holds the exit code of the last native executable (non-cmdlet) that ran.
> - Essential for checking results of `git`, `curl`, `python`, and other external binaries inside PowerShell scripts, where `$?` reflects cmdlet error state, not native exit codes.
>
> > [!warning] `$?` and `$LASTEXITCODE` diverge
> >
> > In PowerShell, `$?` can be `$false` (a cmdlet raised a non-terminating error) while `$LASTEXITCODE` is 0 (the last native exe succeeded), and vice versa. Use the right variable for the right tool type.
>
> ---
>
> **`&&` operator**
> - A chaining operator (bash and PS 7+) that runs the right-hand command only if the left-hand command exits with code 0 (success).
> - The backbone of fail-fast scripting: prevents downstream steps from running on corrupted, missing, or partially produced input.
>
> > [!warning] Fragile in the `&& / ||` try/catch pattern
> >
> > `cmd && echo "ok" || echo "fail"`: if `cmd` succeeds but `echo "ok"` fails (e.g., broken pipe), the `||` branch fires even though the primary command succeeded. Use explicit `if/then/else` for critical logic.
>
> ---
>
> **`||` operator**
> - A chaining operator (bash and PS 7+) that runs the right-hand command only if the left-hand command exits with a non-zero code (failure).
> - Used for fallback logic (try fast path, fall back to safe path) and for assigning safe default values when a command or lookup fails.
>
> > [!info] Exit code of the overall expression
> >
> > The exit code of `cmd_a || cmd_b` is the exit code of whichever command actually ran last. If `cmd_a` fails and `cmd_b` succeeds, the overall result is 0 — the failure of `cmd_a` is absorbed.
>
> ---
>
> **`;` semicolon**
> - A sequential statement separator that executes the next command unconditionally, regardless of whether the previous command succeeded or failed.
> - Appropriate only for independent commands where the second does not depend on the first (e.g., gathering multiple diagnostic snapshots during an outage).
>
> > [!danger] Silent failure masking in data pipelines
> >
> > A semicolon between causally dependent steps — `truncate_table ; load_data` — means `load_data` runs even if `truncate_table` failed, producing duplicate or inconsistent data with no error surfaced.
>
> ---
>
> **`|` pipe (bash)**
> - An operator that connects the stdout of one process to the stdin of the next; both processes run concurrently as separate kernel processes linked by an in-memory buffer.
> - Enables streaming composition over arbitrarily large inputs without intermediate files, and is the foundation of Unix-style text pipeline idioms.
>
> > [!warning] Exit code is the last stage's by default
> >
> > Without `set -o pipefail`, a failed early stage (e.g., `grep` exits 1 on no matches) is invisible — the pipeline's exit code is the last command's. Enable `pipefail` in every script.
>
> ---
>
> **`pipefail`**
> - A bash shell option (`set -o pipefail`) that makes a pipeline exit with the first non-zero exit code from any stage, rather than always using the last stage's exit code.
> - Without it, failures in early pipeline stages are silently swallowed, producing empty or wrong results that downstream steps and CI/CD systems treat as success.
>
> > [!warning] Avoid in interactive shells
> >
> > `pipefail` makes benign interactive patterns like `history | grep cmd` return an error exit when the pattern is not found, which is confusing and can interfere with interactive shell workflows. Enable it only in scripts.
>
> ---
>
> **`set -e`**
> - A bash option that causes the shell to exit immediately whenever a simple command returns a non-zero exit code (roughly equivalent to adding `|| exit` after every command).
> - Combined with `set -u` (unset variable detection) and `pipefail` in the idiomatic `set -euo pipefail` script header for maximum safety.
>
> > [!warning] `set -e` has silent exceptions
> >
> > Commands in `if` conditions, after `!`, in `while`/`until` tests, and in subshells with `||` or `&&` do not trigger `set -e` on failure. Relying on `set -e` alone is insufficient — explicit `&&` chaining and `pipefail` are still needed.
>
> ---
>
> **Fail-fast**
> - A scripting strategy where execution stops at the first error rather than continuing through subsequent steps, achieved with `&&` chaining and/or `set -e`.
> - Ensures the system is left in a known state after a failure: if step 2 of 5 fails, steps 3–5 never execute, preventing partial or inconsistent state.
>
> > [!info] Fail-fast is not the same as error handling
> >
> > Stopping early prevents further damage but does not clean up. Use `trap 'cleanup' EXIT` (bash) or `try/catch/finally` (PowerShell) alongside fail-fast operators when resources must be released on failure.
>
> ---
>
> **Pipeline chain operators (PS 7+)**
> - PowerShell 7's native `&&` and `||` operators, which check `$?` after each command to decide whether to run the next — directly mirroring bash behavior.
> - Enables fail-fast chaining and fallback patterns in PowerShell without `try/catch` boilerplate; not available in Windows PowerShell 5.1.
>
> > [!danger] Syntax error in PowerShell 5.1
> >
> > Using `&&` or `||` in Windows PowerShell 5.1 is a parse error, not just a runtime failure. Scripts break immediately. For 5.1 compatibility, use `try/catch` blocks or manually check `if ($LASTEXITCODE -ne 0)` after each command.
>
> ---
>
> **Object pipeline (PowerShell)**
> - PowerShell's `|` passes structured .NET objects — with typed properties (integers, datetimes, booleans) — between cmdlets, rather than raw text strings.
> - Eliminates the text-parsing step required in bash pipelines and removes a class of bugs caused by whitespace, locale-dependent formatting, and column reordering.
>
> > [!warning] Object pipeline does not apply to external executables
> >
> > When PowerShell pipes output from `git`, `curl`, `python`, or any non-cmdlet binary, the pipe carries raw text strings, not objects. Text parsing is still required for external tool output even inside a PowerShell pipeline.
>
> ---
>
> **`${PIPESTATUS[@]}`**
> - A bash array that holds the exit codes of all commands in the most recently executed pipeline, indexed left to right.
> - Used after critical pipelines to identify which specific stage failed, complementing `pipefail` when per-stage diagnostics are needed.
>
> > [!warning] `${PIPESTATUS[@]}` is overwritten by the next command
> >
> > Like `$?`, the array is replaced the moment any subsequent command runs. Capture it immediately: `pipe_statuses=("${PIPESTATUS[@]}")` on the line directly after the pipeline.
>
> ---
>
> **`trap` (bash)**
> - A bash built-in that registers a command or function to run automatically when the shell receives a signal or exits, regardless of how the exit happens.
> - The correct mechanism for guaranteed cleanup (closing connections, removing temp files, sending alerts) when fail-fast `&&` chaining stops execution early.
>
> > [!info] `trap 'cleanup' EXIT` fires on all exits
> >
> > Unlike `||` cleanup patterns, `trap ... EXIT` fires on both successful and failed exits, making it the reliable choice when cleanup must always happen regardless of outcome.
>
> ---
>
> **`*>` redirect (PowerShell)**
> - A PowerShell redirection operator that captures all output streams — stdout, stderr, verbose, warning, debug, and information — and writes them to a file.
> - More comprehensive than bash's `2>&1`, which only merges stderr into stdout; `*>` captures every PowerShell output channel in a single operator.
>
> > [!info] Stream numbers for selective capture
> >
> > PowerShell numbers its streams: 1 (stdout), 2 (error), 3 (warning), 4 (verbose), 5 (debug), 6 (information). Use `2>` to capture only errors, or `3>&1` to merge warnings into stdout, for finer control than `*>`.

Command chaining operators use process exit codes to decide what runs next. Every command exits with a numeric code: 0 means success, anything else means failure. Understanding these operators is the difference between a deployment script that stops on the first error and one that silently plows through failures, leaving your system in an inconsistent state.

## Linux command chaining operators

Bash provides four primary chaining operators: `&&` (AND), `||` (OR), `;` (sequential), and `|` (pipe). Each operator reads the exit code of the preceding command to determine whether and how to continue. These operators are the core building blocks of safe, expressive shell scripting.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {'primaryColor': '#292e42','primaryTextColor': '#c0caf5','primaryBorderColor': '#565f89','lineColor': '#565f89','secondaryColor': '#1a1b26','tertiaryColor': '#24283b','noteTextColor': '#c0caf5','noteBkgColor': '#292e42','textColor': '#c0caf5','fontSize': '14px'}}}%%
flowchart TD
    A([Command A runs]) --> B{Exit code?}
    B -->|0 — success| C["&& → runs Command B"]
    B -->|non-zero — failure| D["|| → runs Command B"]
    B -->|ignored| E["; → always runs Command B"]
    A --> F["| → streams stdout to Command B's stdin<br>(runs concurrently)"]

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


> [!example] Shell Chaining Fit
>
> > [!success] Appropriate
> >
> > - **Deployment scripts** — chain `git pull && build && restart` so a build never starts on broken code and a restart never happens with a broken build.
> > - **Data pipeline steps with causal dependencies** — `truncate_staging && load_data && validate_count` ensures each step only runs if the previous succeeded.
> > - **Fallback logic** — `rsync ... || scp ...` tries the fast path first and falls back to the universally available alternative.
> > - **Quick diagnostic sweeps** — `free -h ; df -h ; docker ps ; ss -tlnp` gathers all information regardless of individual command failures during an incident.
> > - **Streaming data processing** — `zcat | grep | awk | sort | uniq -c | head` processes gigabytes of data in a single pass without intermediate files.
> > - **Guard clauses** — `[ -f config.yaml ] || { echo "Missing config" >&2; exit 1; }` validates prerequisites before the main script logic runs.
>
> > [!failure] Inappropriate
> >
> > - **Complex conditional logic** — if you need more than one level of `&&` / `||` nesting, write a proper `if/then/else` block or a function. Deeply nested chaining is unreadable and error-prone.
> > - **Steps requiring cleanup on failure** — `&&` stops execution but does not run cleanup code. Use `trap 'cleanup_function' EXIT` in bash or `try/catch/finally` in PowerShell for guaranteed cleanup.
> > - **Long-running pipelines that need individual stage monitoring** — a 10-stage streaming pipeline hides which stage is slow or failing. Break it into named steps with intermediate checkpoints when debuggability matters more than streaming efficiency.
> > - **PowerShell 5.1 environments** — `&&` and `||` are only available in PowerShell 7+. Use `try/catch` or manual `$LASTEXITCODE` checks instead.

## Warnings

> [!danger] Semicolons in data pipelines mask failures
>
> `truncate_table ; load_data ; validate` runs all three steps regardless of failures. If truncation fails, load runs on stale data. If load fails, validation runs on empty or corrupt data. Always use `&&` for causally dependent steps.

> [!warning] The `&&` / `||` try/catch pattern has a subtle bug
>
> `cmd && echo "ok" || echo "fail"` — if `cmd` succeeds but `echo "ok"` fails (e.g., broken pipe, write error), the `|| echo "fail"` runs even though `cmd` succeeded. For critical scripts, use proper `if/then/else` blocks instead of the chained pattern.

> [!warning] Pipeline exit code is the last command's exit code by default
>
> `broken_cmd | wc -l` returns exit code 0 (from `wc`) even when `broken_cmd` fails. Enable `set -o pipefail` in every script to propagate the first failure.

> [!warning] `&&` / `||` not available in PowerShell 5.1
>
> The pipeline chain operators were introduced in PowerShell 7.0. Scripts targeting Windows PowerShell 5.1 must use `try/catch`, `if ($LASTEXITCODE -ne 0)`, or the `$ErrorActionPreference` variable instead.

## Recommendations

| Scenario | Recommendation |
|---|---|
| Script header | Start every bash script with `set -euo pipefail`. This combines fail-fast (`-e`), unset variable detection (`-u`), and pipeline failure propagation (`pipefail`). |
| Dependent steps | Use `&&` between causally dependent commands. Reserve `;` for truly independent operations. |
| Fallback logic | Use `primary_cmd \|\| fallback_cmd`. For complex fallbacks, use `if ! primary_cmd; then fallback_logic; fi`. |
| Cleanup on failure | Use `trap 'cleanup' EXIT` (bash) or `try/catch/finally` (PowerShell) — not `\|\|` — for cleanup that must run on both success and failure. |
| Long pipelines | Add `set -o pipefail` and check `${PIPESTATUS[@]}` after critical pipelines to identify which stage failed. |
| Cross-platform scripts | Stick to `&&` and `\|\|` for PowerShell 7+ environments. For 5.1 compatibility, use `try/catch` blocks. |
| Interactive use | Avoid `set -o pipefail` in interactive shells — it makes benign patterns like `history \| grep cmd` return errors when the pattern is not found. |

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "Script continues past a failed step" | Steps are separated by `;` instead of `&&`, or `set -e` / `pipefail` is not enabled. | Replace `;` with `&&` for dependent steps. Add `set -euo pipefail` to the script header. |
| "Pipeline succeeds but produces empty output" | An early pipeline stage failed (e.g., `grep` found no matches) but the last stage (`wc -l`, `head`) succeeded, masking the error. | Enable `set -o pipefail`. Check `${PIPESTATUS[@]}` to find which stage returned non-zero. |
| "`&&` syntax error in PowerShell" | Using `&&` in Windows PowerShell 5.1, which does not support pipeline chain operators. | Upgrade to PowerShell 7+ or replace with `if ($LASTEXITCODE -eq 0) { next_cmd }`. |
| "Fallback `\|\|` command runs even though the primary succeeded" | The primary command succeeded but a subsequent `&&` step failed, triggering the `\|\|` branch. The combined pattern `cmd && ok \|\| fail` is fragile. | Use explicit `if/then/else` for critical logic instead of the chained `&& / \|\|` pattern. |
| "External command in PowerShell pipeline returns 0 but pipeline fails" | PowerShell treats non-terminating errors (e.g., `Write-Error`) differently from native exit codes. `$?` may be `$false` even when `$LASTEXITCODE` is 0. | Check `$LASTEXITCODE` for native executables. Use `$ErrorActionPreference = 'Stop'` to convert non-terminating errors to terminating ones. |

## Cross-references

- [io-redirection](https://alp78.github.io/elysium/01-Shell/01-Scripting/03-io-redirection) — Controlling where command output goes
- [defensive-scripting](https://alp78.github.io/elysium/01-Shell/01-Scripting/07-defensive-scripting) — Using `set -euo pipefail` to make scripts safe
- [process-substitution](https://alp78.github.io/elysium/01-Shell/01-Scripting/06-process-substitution) — Treating command output as files

## References

- [GNU Bash Reference — Pipelines](https://www.gnu.org/software/bash/manual/html_node/Pipelines.html)
- [GNU Bash Reference — Lists of Commands](https://www.gnu.org/software/bash/manual/html_node/Lists.html)
- [PowerShell 7 Pipeline Chain Operators](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_pipeline_chain_operators)
