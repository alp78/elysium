---
title: "07 - Defensive Scripting"
tags:
  - shell
  - scripting
aliases: [defensive scripting, set -euo pipefail, bash strict mode, safe scripting, script safety]
keywords: [set -e, set -u, set -o pipefail, defensive scripting, bash strict mode, trap, cleanup, exit on error, unset variable, pipeline failure, production script template, error handling, ErrorActionPreference, Set-StrictMode, PowerShell error handling]
description: "Bash set flags (set -euo pipefail) and PowerShell equivalents ($ErrorActionPreference, Set-StrictMode, try/catch) that prevent the most dangerous scripting bugs — exit-on-error, unset variable detection, pipeline failure propagation, and cleanup traps."
created: 2026-03-22
updated: 2026-04-03
status: complete
---

# Defensive Scripting — The `set` Flags That Save Careers

Every production script should begin with a one-line safety declaration that enables the three mechanisms preventing the most common and most dangerous categories of scripting bugs. Without it, your script is a loaded gun pointed at your data.

> [!quote]
> "The most dangerous phrase in the language is, 'We've always done it this way.'"
>
> — **Grace Hopper**, attributed remark (c. 1980s)
>
> "Bash without `set -euo pipefail` is a loaded gun pointed at your data."
>
> — Shell scripting proverb

> [!tip] Related pattern
>
> The same error-handling philosophy applies in application code: [08_py_errorhandling](https://alp78.github.io/elysium/02-Programming-Languages/Python/08_py_errorhandling) covers Python's `try`/`except` (the equivalent of `set -e` with explicit catches), and [08_cs_errorhandling](https://alp78.github.io/elysium/02-Programming-Languages/CSharp/08_cs_errorhandling) covers C#'s `try`/`catch`/`finally` pattern. For error handling in DAG orchestration, see [airflow-dag-patterns](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-dag-patterns).

The diagram below shows how the three bash flags and `trap` interact as a layered defence. PowerShell equivalents map to the same layers.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {'primaryColor': '#292e42','primaryTextColor': '#c0caf5','primaryBorderColor': '#565f89','lineColor': '#565f89','secondaryColor': '#1a1b26','tertiaryColor': '#24283b','noteTextColor': '#c0caf5','noteBkgColor': '#292e42','textColor': '#c0caf5','fontSize': '14px'}}}%%
flowchart TD
    A([Script starts]) --> B[set -e\nexit on command failure]
    B --> C[set -u\nerror on unset variable]
    C --> D[set -o pipefail\npropagate pipeline failures]
    D --> E[trap EXIT\nguaranteed cleanup]
    E --> F([Safe execution])

    B -- "command fails" --> G[[Script exits\nnon-zero]]
    C -- "unset variable" --> G
    D -- "pipeline stage fails" --> G
    G --> E
```


## Key terms used in this note

| Term | Plain-English definition | Why it matters here | Common mistake / confusion |
|---|---|---|---|
| `set -e` | A bash flag that causes the script to exit immediately when any command returns a non-zero exit code. Without it, failures are silently ignored. | Prevents downstream steps from running on corrupted or missing input. The single most important safety flag for production scripts. | Assuming `set -e` catches all failures. Commands in `if` conditions, before `\|\|`, or in subshells do not trigger it. |
| `set -u` | A bash flag that treats references to unset variables as errors, causing immediate exit. Without it, unset variables silently expand to empty strings. | Prevents the catastrophic `rm -rf "$UNSET_VAR"/*` scenario where an empty variable expands to `rm -rf /*`. | Not knowing the `${VAR:-default}` escape hatch for optional variables under `set -u`. |
| `set -o pipefail` | A bash flag that makes a pipeline return the exit code of the first command that fails, rather than the last command. | Without it, `broken_cmd \| wc -l` reports success even when `broken_cmd` fails. | Enabling `pipefail` in interactive shells -- benign patterns like `grep pattern \| head` trigger exit-on-error when `head` closes the pipe early. |
| `set -euo pipefail` | The combined strict mode header for bash scripts. Enables exit-on-error, unset-variable detection, and pipeline failure propagation in one line. | The recommended first line after the shebang in every production bash script. | Placing it after commands that have already run -- the flags only apply to commands that follow them. |
| `trap` | A bash built-in that registers a handler to run when the script receives a signal or exits. | `trap cleanup EXIT` ensures temp files, lock files, and connections are always cleaned up, even on error. | Using `trap ... ERR` without `set -E` -- ERR traps are not inherited by functions or subshells by default. |
| Exit code | A numeric value (0-255) that every process returns when it finishes. 0 means success; any other value means failure. Stored in `$?`. | Every `set` flag and chaining operator reads exit codes to decide behavior. | Assuming a script succeeded because it reached the last line. Without `set -e`, earlier failures are silently ignored. |
| `${VAR:-default}` | A bash parameter expansion that returns `default` if `VAR` is unset or empty, without triggering a `set -u` error. | The standard way to define optional variables with fallback values in strict-mode scripts. | Confusing `:-` (unset or empty) with `-` (unset only) and `:?` (exit with error if unset). |
| `$ErrorActionPreference` | A PowerShell preference variable controlling behavior on non-terminating errors. Default is `Continue`. Set to `Stop` for fail-fast behavior. | The PowerShell equivalent of `set -e`. Must be set to `Stop` for `try/catch` to work on non-terminating errors. | It does not affect native executables -- `$LASTEXITCODE` must be checked manually after external tools. |
| `Set-StrictMode` | A PowerShell cmdlet that enforces rules such as detecting uninitialized variables. | The PowerShell equivalent of `set -u`. `-Version Latest` enables all available checks. | Confusing it with `$ErrorActionPreference` -- they control different things. |
| `try/catch/finally` | PowerShell structured error handling. `try` wraps risky code, `catch` handles errors, `finally` runs cleanup unconditionally. | The PowerShell equivalent of bash `set -e` + `trap EXIT`. | Non-terminating errors bypass `catch` unless `$ErrorActionPreference = 'Stop'` is set. |

## What this note covers

- The three bash strict-mode flags (`set -e`, `set -u`, `set -o pipefail`) and when each triggers
- The `${VAR:-default}` and `${VAR:?error}` parameter expansions for safe variable handling
- The `trap` built-in for guaranteed cleanup on exit, error, or signal
- Complete production script templates for both bash and PowerShell
- PowerShell equivalents: `$ErrorActionPreference`, `Set-StrictMode`, `try/catch/finally`, `$LASTEXITCODE`
## Linux | bash | defensive scripting tools

Bash provides four complementary safety mechanisms that together eliminate the most common categories of silent failure in shell scripts. They are enabled at the top of every production script and apply for the lifetime of that shell session.

### Linux | set | configure shell safety flags

The `set` builtin modifies the behaviour of the current shell. The three flags below are almost always combined into a single `set -euo pipefail` declaration. Each flag addresses a distinct failure mode.

#### Enable the full strict mode header

Every production script begins with the shebang and the strict mode line. The shebang `#!/usr/bin/env bash` locates `bash` via `PATH` rather than hard-coding `/bin/bash`, which keeps the script portable across systems where bash lives in a different location.

```bash
#!/usr/bin/env bash
set -euo pipefail
```

#### set -e — exit immediately on non-zero exit code

Without `set -e`, a failed command simply sets `$?` to a non-zero value and execution continues. The next command runs even if the previous one failed. With `set -e`, any command that exits with a non-zero status causes the script to exit immediately with that same status. This makes failures impossible to silently ignore.

```bash
set -e
```

The following demonstrates the difference. Without `set -e`, a failed `rm` does not stop the pipeline from running on empty data.

```bash
rm /data/staging/*.csv
load_pipeline /data/staging/
echo "Pipeline complete"
```

With `set -e`, the script stops at the failed `rm`. The load never runs and the success message never prints. Your orchestrator receives a non-zero exit code and can retry or alert.

> [!warning] Situations where set -e does not trigger
>
> - Commands in `if` conditions: `if rm /nonexistent; then ...` — the failure does not trigger exit; `if` tests the return code explicitly.
> - Commands before `||`: `rm /nonexistent || true` — `|| true` absorbs the error intentionally.
> - Commands in subshells: `(failing_command)` — the subshell exits with non-zero, but the parent script may not unless you check `$?`.
> - The last command in a pipeline (without `pipefail`): `failing_cmd | wc -l` — only `wc`'s exit code matters.

> [!success] Using escape hatches deliberately
>
> These exceptions are intentional. Use `|| true` when a command is allowed to fail (e.g., "delete if exists" patterns). Use `if` when you need to branch on success or failure without exiting. Use subshells to isolate failures from the parent. The escape hatches give you precision, not a loophole.

#### set -u — treat unset variables as errors

Without `set -u`, referencing an unset variable silently expands to an empty string. This is one of the most catastrophic silent failures in shell scripting: a missing variable in a destructive command can expand to a path you never intended.

```bash
set -u
```

The classic example: if `STAGING_DIR` is unset, the following command expands to `rm -rf /*` — deleting the entire filesystem. This has occurred in production environments, including a widely reported incident at a major technology company.

```bash
rm -rf "$STAGING_DIR"/*
```

```text
bash: STAGING_DIR: unbound variable
```

With `set -u`, the script exits before `rm` runs. The filesystem is intact.

#### ${VAR:-default} — supply defaults for optional variables under set -u

The `:-` operator provides a fallback value when a variable is unset or empty, without triggering the `set -u` error. Use it for optional configuration that has a sensible default. The `:?` operator does the opposite: it exits with a custom error message when the variable is unset, making it ideal for required configuration.

```bash
DB_PORT="${DB_PORT:-1433}"
LOG_LEVEL="${LOG_LEVEL:-INFO}"
EXTRA_ARGS="${EXTRA_ARGS:-}"
DB_HOST="${DB_HOST:?ERROR: DB_HOST must be set}"
```

To test whether an optional variable is set before using it, combine `:-` with an empty default:

```bash
if [[ -n "${MY_VAR:-}" ]]; then
    echo "MY_VAR is set to: $MY_VAR"
fi
```

#### set -o pipefail — propagate failures from any pipeline stage

Without `pipefail`, the exit code of a pipeline is the exit code of its last command only. If an early stage fails, the remaining stages run on bad or empty input and may succeed, masking the root failure entirely.

```bash
set -o pipefail
```

Without `pipefail`, if `curl` fails with a network error, `python3` receives empty stdin, processes nothing, `gzip` creates an empty file, and the pipeline exits 0. Downstream systems receive an empty but formally valid output file.

```bash
curl -f "https://api.example.com/data" | python3 process.py | gzip > output.gz
```

With `pipefail`, the pipeline's exit code is the exit code of the first failed command. The `curl` failure propagates through the pipeline, the script exits non-zero, and your orchestrator retries or alerts.

| Flag | Syntax | Description |
|---|---|---|
| `-e` | `set -e` | Exit immediately when any command exits with a non-zero status |
| `-u` | `set -u` | Treat unset variables as errors and exit immediately |
| `-o pipefail` | `set -o pipefail` | Pipeline exit code is the exit code of the first failed command |
| `-x` | `set -x` | Print each command and its arguments before executing (debug trace) |
| `-n` | `set -n` | Read commands but do not execute them (syntax check) |
| `-f` | `set -f` | Disable filename expansion (globbing) |
| `-C` | `set -C` | Prevent redirection from overwriting existing files |
| `+e` | `set +e` | Disable exit-on-error temporarily (re-enable with `set -e`) |
| `+u` | `set +u` | Disable unset-variable errors temporarily |

### Linux | trap | guarantee cleanup on exit

The `trap` builtin registers a handler — a function or command — that runs when the script receives a specified signal or exits. It is the shell equivalent of a `finally` block: cleanup runs regardless of how the script terminates.

#### Register a cleanup function on EXIT

`EXIT` is a pseudo-signal that fires on any shell exit: normal completion, `set -e` error, or receipt of a signal. Registering a cleanup function on `EXIT` ensures temporary files, lock files, and database connections are always released.

```bash
cleanup() {
    rm -f "$TEMP_FILE" 2>/dev/null
    echo "Cleanup complete" >&2
}
trap cleanup EXIT
```

The `2>/dev/null` on the `rm` inside the cleanup function prevents spurious error output if the temporary file was never created (e.g., the script failed before `mktemp`).

#### Trap specific signals

You can register different handlers for different signals, or suppress a signal entirely by trapping it with an empty string.

```bash
trap 'echo Interrupted >&2' INT
trap 'echo Terminated >&2' TERM
trap '' HUP
```

`INT` fires on Ctrl+C. `TERM` fires on `kill <pid>`. `HUP` fires when the controlling terminal closes — suppressing it keeps a script running after an SSH disconnect.

> [!warning] Trapping ERR is fragile
>
> `trap 'handler' ERR` fires when a command exits non-zero, similar to `set -e`. However, ERR traps are not inherited by subshells or functions unless `set -E` (`set -o errtrace`) is also set. The combination of `set -euo pipefail` plus a `trap ... EXIT` is more reliable than relying on ERR traps for error detection.

> [!success] Preferred pattern for error logging
>
> Combine `set -euo pipefail` with a logging function and an `EXIT` trap for cleanup. Use `$?` inside the cleanup function to distinguish a clean exit (0) from an error exit (non-zero) and log accordingly.
>
> ```bash
> cleanup() {
>     local exit_code=$?
>     if [[ $exit_code -ne 0 ]]; then
>         echo "[ERROR] Script failed with exit code $exit_code" >&2
>     fi
>     rm -f "$TEMP_FILE" 2>/dev/null
> }
> trap cleanup EXIT
> ```

### Linux | bash | production script template

The template below combines all four mechanisms into a reusable starting point. Every component is explained inline as plain text.

`SCRIPT_DIR` resolves the directory of the script itself regardless of where it is called from, making relative paths within the script reliable. `mktemp` creates a temporary file in `/tmp` and returns its path, which is stored in `TEMP_FILE` and cleaned up by the `cleanup` trap. The `log` function writes to stderr (fd 2) rather than stdout so that log lines do not pollute the script's output when captured by a pipeline.

```bash
#!/usr/bin/env bash
set -euo pipefail

cleanup() {
    local exit_code=$?
    [[ $exit_code -ne 0 ]] && echo "[ERROR] Exited with code $exit_code" >&2
    rm -f "$TEMP_FILE" 2>/dev/null
}
trap cleanup EXIT

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly TEMP_FILE=$(mktemp)
readonly DB_HOST="${DB_HOST:?ERROR: DB_HOST must be set}"
readonly DB_PORT="${DB_PORT:-1433}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >&2; }

log "Starting pipeline"
log "Connecting to $DB_HOST:$DB_PORT"
log "Pipeline complete"
```

## PowerShell | defensive scripting tools

PowerShell provides structural equivalents for every Bash defensive mechanism. The mechanisms differ in syntax and defaults — PowerShell does not exit on errors by default — but the underlying philosophy is identical: fail loudly and immediately rather than continuing silently into an inconsistent state.

### PowerShell | $ErrorActionPreference | set global error behaviour

`$ErrorActionPreference` is the PowerShell equivalent of `set -e`. It controls what PowerShell does when a non-terminating error occurs. The default value is `Continue`, which prints the error but keeps executing — the equivalent of Bash without `set -e`.

#### Set ErrorActionPreference to Stop at the top of every script

Setting `$ErrorActionPreference = 'Stop'` at the top of a script causes every non-terminating error to become a terminating error, which can be caught by `try/catch` or will exit the script if uncaught. This is the direct equivalent of `set -e`.

```powershell
$ErrorActionPreference = 'Stop'
```

| Value | Behaviour |
|---|---|
| `Continue` | Print error message and continue executing (default) |
| `Stop` | Treat every error as terminating — equivalent to `set -e` |
| `SilentlyContinue` | Suppress error output and continue |
| `Inquire` | Prompt the user on each error |

### PowerShell | Set-StrictMode | detect uninitialized variables and bad expressions

`Set-StrictMode` is the PowerShell equivalent of `set -u`. It enforces a set of best-practice rules that, when violated, cause a terminating error. `Version Latest` enables all available checks including uninitialized variables, uninitialised properties on objects, and calls to functions with the wrong number of arguments.

#### Enable strict mode at the highest version

```powershell
Set-StrictMode -Version Latest
```

Without `Set-StrictMode`, referencing an unset variable silently returns `$null`, which can lead to the same class of catastrophic silent errors as Bash without `set -u`.

```powershell
Remove-Item "$StagingDir\*" -Recurse -Force
```

```text
The variable '$StagingDir' cannot be retrieved because it has not been set.
At line:1 char:13
```

With `Set-StrictMode -Version Latest`, the script terminates before `Remove-Item` runs.

| Version | Additional checks enabled |
|---|---|
| `1.0` | Prohibits references to uninitialised variables |
| `2.0` | Adds: prohibits references to uninitialised properties, calls to non-existent functions |
| `Latest` | Enables all checks available in the current PowerShell version |

### PowerShell | try/catch/finally | structured error handling and cleanup

PowerShell's `try/catch/finally` is the structural equivalent of Bash's `set -e` plus `trap EXIT`. The `finally` block runs unconditionally, whether the `try` block succeeded or threw an exception — making it the right place for cleanup logic.

#### Wrap the script body in try/catch/finally

The combination of `$ErrorActionPreference = 'Stop'` with `try/catch` ensures that any command failure — including cmdlet errors and external executable errors — is caught and handled. Without `$ErrorActionPreference = 'Stop'`, non-terminating errors bypass `catch` entirely.

```powershell
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$TempFile = [System.IO.Path]::GetTempFileName()

try {
    Write-Host "Starting pipeline"
    # ... your commands here ...
    Write-Host "Pipeline complete"
}
catch {
    Write-Error "Script failed: $_"
    exit 1
}
finally {
    Remove-Item -Path $TempFile -ErrorAction SilentlyContinue
    Write-Host "Cleanup complete"
}
```

> [!warning] External executables and $ErrorActionPreference
>
> `$ErrorActionPreference = 'Stop'` only affects PowerShell cmdlets and .NET method errors — it does not automatically cause the script to exit when a native executable (e.g., `python.exe`, `git.exe`) returns a non-zero exit code. You must check `$LASTEXITCODE` explicitly after calling external executables.

> [!success] Check $LASTEXITCODE after external executables
>
> After calling any external tool, check `$LASTEXITCODE` and throw if it is non-zero. This makes external failures terminating errors that `catch` can handle.
>
> ```powershell
> python process.py
> if ($LASTEXITCODE -ne 0) {
>     throw "process.py exited with code $LASTEXITCODE"
> }
> ```

### PowerShell | production script template

The template below is the PowerShell equivalent of the Bash template: it sets strict defaults at the top, resolves the script directory portably, creates a temp file, and ensures cleanup in `finally`. `$PSScriptRoot` is the PowerShell equivalent of `$(dirname "${BASH_SOURCE[0]}")` — it contains the directory of the currently executing script file.

```powershell
#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$TempFile = [System.IO.Path]::GetTempFileName()
$ScriptDir = $PSScriptRoot

$DbHost = $env:DB_HOST
if (-not $DbHost) { throw "ERROR: DB_HOST environment variable must be set" }
$DbPort = if ($env:DB_PORT) { $env:DB_PORT } else { '1433' }

function Write-Log {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
}

try {
    Write-Log "Starting pipeline"
    Write-Log "Connecting to ${DbHost}:${DbPort}"
    # ... your commands here ...
    Write-Log "Pipeline complete"
}
catch {
    Write-Error "Pipeline failed: $_"
    exit 1
}
finally {
    Remove-Item -Path $TempFile -ErrorAction SilentlyContinue
}
```


## When to use defensive scripting

- **Every production script** -- `set -euo pipefail` with a `trap EXIT` cleanup should be the first lines of every bash script that runs in CI/CD, cron, Airflow, or any automated context.
- **Any script that modifies data** -- scripts that truncate tables, delete files, move data, or restart services must fail fast. A half-completed destructive operation is worse than a complete failure.
- **Multi-step deployment scripts** -- `git pull && build && restart` patterns rely on exit codes. Without `set -e`, a failed build does not prevent a restart with broken code.
- **Scripts handling credentials** -- combine `set -u` with `${VAR:?ERROR}` to guarantee required environment variables are set before accessing secrets.

## When not to use defensive scripting

- **Interactive one-liners** -- `set -euo pipefail` in an interactive shell causes confusing exits on benign patterns like `grep pattern | head` (SIGPIPE). Use it in scripts only.
- **Scripts that intentionally check for failure** -- if the script logic depends on testing whether commands fail, use `if ! command; then` or `command || true` rather than disabling `set -e` globally.
- **Sourced library files** -- files intended to be sourced (`. library.sh`) should not set `set -euo pipefail` because the flags would affect the caller environment.

## Warnings

> [!danger] Without `set -u`, unset variables in destructive commands can destroy data
>
> `rm -rf "$STAGING_DIR"/*` with an unset `STAGING_DIR` expands to `rm -rf /*`. This has caused real-world data center outages. Always use `set -u` and `${VAR:?ERROR}` for required variables.

> [!warning] `set -e` does not catch all failures
>
> Commands in `if` conditions, before `||`, in subshells, and in command substitutions do not trigger `set -e`. These are intentional escape hatches but mean `set -e` is not a substitute for explicit error checking in critical paths.

> [!warning] PowerShell `$ErrorActionPreference = 'Stop'` does not affect native executables
>
> Running `python process.py` with `$ErrorActionPreference = 'Stop'` does not cause the script to exit if Python returns a non-zero exit code. You must check `$LASTEXITCODE` manually.

> [!warning] `trap ERR` is not inherited by functions without `set -E`
>
> `trap 'handler' ERR` only fires in the main script scope. Functions and subshells do not inherit it unless `set -E` is also enabled. Prefer `trap cleanup EXIT` over `trap handler ERR`.

## Recommendations

| Scenario | Recommendation |
|---|---|
| Script header (bash) | `#!/usr/bin/env bash` followed by `set -euo pipefail` on the next line. No exceptions for production scripts. |
| Script header (PowerShell) | `$ErrorActionPreference = 'Stop'` and `Set-StrictMode -Version Latest` at the top. |
| Required variables | Use `${VAR:?ERROR: VAR must be set}` to exit with a clear error message if the variable is missing. |
| Optional variables | Use `${VAR:-default}` to provide a fallback value without triggering `set -u`. |
| Cleanup | Use `trap cleanup EXIT` (bash) or `try/catch/finally` (PowerShell). Never rely on the script reaching the last line. |
| External executables in PowerShell | Always check `$LASTEXITCODE` after calling native tools. |
| Debug tracing | Add `set -x` temporarily for debugging. Remove it before committing -- it prints every command including those containing secrets. |
| Disabling strict mode temporarily | Use `set +e` before a command that is allowed to fail, then `set -e` immediately after. Document why. |

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Script exits unexpectedly on a command that should work | `set -e` is active and the command returned a non-zero exit code. Even `grep` returns 1 when it finds no matches. | Use `grep pattern file \|\| true` to explicitly allow failure, or wrap in `if grep ...`. |
| Unbound variable error on an optional variable | `set -u` is active and the variable is not set. | Use `${VAR:-default}` to provide a fallback or `${VAR:-}` for an empty default. |
| Pipeline succeeds but produces empty output | `pipefail` is not enabled and an early stage failed silently. | Add `set -o pipefail` and check `${PIPESTATUS[@]}` to find the failed stage. |
| Cleanup function never runs | `trap cleanup EXIT` was not set, or the script was killed with `SIGKILL` (which cannot be trapped). | Ensure `trap cleanup EXIT` is set early, before any commands that might fail. |
| PowerShell catch block never executes | `$ErrorActionPreference` is still `Continue`, so non-terminating errors bypass `catch`. | Set `$ErrorActionPreference = 'Stop'` before the `try` block. |
| PowerShell script continues after Python exits with error | `$ErrorActionPreference` does not affect native executable exit codes. | Check `$LASTEXITCODE` after the call: `if ($LASTEXITCODE -ne 0) { throw "Failed" }`. |
## Cross-references

- [error-handling-and-retry-patterns](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/error-handling-and-retry-patterns) — Cross-cutting error classification, retry strategies, and failure propagation theory
- [command-chaining](https://alp78.github.io/elysium/01-Shell/01-Scripting/04-command-chaining) — How `&&`, `||`, and `;` use exit codes
- [io-redirection](https://alp78.github.io/elysium/01-Shell/01-Scripting/03-io-redirection) — Redirecting errors for logging
- [environment-variables](https://alp78.github.io/elysium/01-Shell/01-Scripting/01-environment-variables) — Handling required vs optional configuration
- [process-substitution](https://alp78.github.io/elysium/01-Shell/01-Scripting/06-process-substitution) — Advanced I/O patterns for scripts

## References

- [GNU Bash Reference — The Set Builtin](https://www.gnu.org/software/bash/manual/html_node/The-Set-Builtin.html)
- [Unofficial Bash Strict Mode](http://redsymbol.net/articles/unofficial-bash-strict-mode/)
- [PowerShell — about_Preference_Variables](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_preference_variables)
- [PowerShell — Set-StrictMode](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/set-strictmode)
- [PowerShell — about_Try_Catch_Finally](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_try_catch_finally)
