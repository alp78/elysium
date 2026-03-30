---
type: concept
category: foundations
technology: [bash]
tags: [shell, bash, linux]
aliases: [defensive scripting, set -euo pipefail, bash strict mode, safe scripting, script safety]
keywords: [set -e, set -u, set -o pipefail, defensive scripting, bash strict mode, trap, cleanup, exit on error, unset variable, pipeline failure, production script template, error handling]
description: "The bash set flags (set -euo pipefail) that prevent the most dangerous scripting bugs, including exit-on-error, unset variable detection, pipeline failure propagation, and cleanup traps."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Defensive Scripting — The `set` Flags That Save Careers

Every bash script you write for production should begin with one line that enables three safety mechanisms preventing the most common and most dangerous categories of scripting bugs. Without it, your script is a loaded gun pointed at your data.

> [!quote]
> "The most dangerous phrase in the language is, 'We've always done it this way.'"
> — **Grace Hopper**
>
> "Bash without `set -euo pipefail` is a loaded gun pointed at your data."
> — Shell scripting proverb

#### set -euo pipefail — the essential first line of every production script
```bash
#!/usr/bin/env bash
set -euo pipefail
```

> [!tip] Related pattern
>
> The same error-handling philosophy applies in application code: [08_py_errorhandling](https://alp78.github.io/elysium/02-Programming-Languages/Python/08_py_errorhandling) covers Python's `try`/`except` (the equivalent of `set -e` with explicit catches), and [08_cs_errorhandling](https://alp78.github.io/elysium/02-Programming-Languages/CSharp/08_cs_errorhandling) covers C#'s `try`/`catch`/`finally` pattern. For error handling in DAG orchestration, see [airflow-dag-patterns](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-dag-patterns).

### set -e — exit immediately on error

```bash
set -e

# Without set -e, this script continues after the failed rm:
rm /data/staging/*.csv          # fails: no such file
load_pipeline /data/staging/    # RUNS ANYWAY with no data → writes empty tables
echo "Pipeline complete"        # PRINTS SUCCESS → you think everything is fine

# With set -e, the script stops at the failed rm
# The load never runs, "Pipeline complete" never prints
# You get an error exit code, your orchestrator detects the failure
```

> [!warning] When set -e does not trigger
>
> - Commands in `if` conditions: `if rm /nonexistent; then ...` — the `rm` failure does NOT trigger exit
> - Commands before `||`: `rm /nonexistent || true` — the `|| true` absorbs the error
> - Commands in subshells: `(failing_command)` — the subshell exits, but the parent may not
> - The last command in a pipeline (without `pipefail`): `failing_cmd | wc -l` — only `wc`'s exit matters
>
> These are not bugs — they are intentional escape hatches. Use `|| true` when a command is allowed to fail (e.g., "delete if exists" patterns). Use `if` when you want to branch on success/failure.

### set -u — treat unset variables as errors

```bash
set -u

# Without set -u:
rm -rf "$STAGING_DIR"/*
# If STAGING_DIR is unset, this expands to: rm -rf /*
# Yes, this deletes your entire filesystem. This has actually happened in production.
# A Google engineer accidentally ran rm -rf on a live system due to an unset variable.

# With set -u:
rm -rf "$STAGING_DIR"/*
# bash: STAGING_DIR: unbound variable
# Script exits immediately. Your filesystem is intact.
```

#### ${VAR:-default} — handle optional variables with set -u
```bash
set -u

# Use default values for optional variables
DB_PORT="${DB_PORT:-1433}"          # use 1433 if DB_PORT is unset
LOG_LEVEL="${LOG_LEVEL:-INFO}"      # use INFO if LOG_LEVEL is unset
EXTRA_ARGS="${EXTRA_ARGS:-}"        # use empty string if unset (prevents error)

# Check if a variable is set
if [[ -n "${MY_VAR:-}" ]]; then
    echo "MY_VAR is set to: $MY_VAR"
fi
# The :- syntax provides a default without triggering the unbound variable error
```

### set -o pipefail — propagate pipeline failures

```bash
set -o pipefail

# Without pipefail:
curl -f "https://api.example.com/data" | python3 process.py | gzip > output.gz
# If curl fails (network error), python3 gets empty stdin, processes nothing,
# gzip creates an empty file, pipeline reports SUCCESS (gzip's exit code is 0)
# You now have an empty output.gz that downstream systems treat as valid data

# With pipefail:
# The pipeline's exit code is the exit code of the FIRST failed command
# curl's failure propagates → script exits → your orchestrator retries or alerts
```

### Production script template — set -euo pipefail with trap cleanup

```bash
#!/usr/bin/env bash
set -euo pipefail

# Trap for cleanup on exit (runs on normal exit, errors, and signals)
cleanup() {
    rm -f "$TEMP_FILE" 2>/dev/null
    echo "Cleanup complete"
}
trap cleanup EXIT

# Configuration with defaults
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly TEMP_FILE=$(mktemp)
readonly DB_HOST="${DB_HOST:?ERROR: DB_HOST must be set}"
# :? = error with message if unset (stronger than :-)
readonly DB_PORT="${DB_PORT:-1433}"

# Functions
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >&2; }

# Main logic
log "Starting pipeline"
log "Connecting to $DB_HOST:$DB_PORT"
# ... your commands here ...
log "Pipeline complete"
```

### trap EXIT — guaranteed cleanup on script exit, error, or signal

> [!info] trap is your safety net
>
> The `trap cleanup EXIT` pattern ensures cleanup runs no matter how the script terminates — normal exit, `set -e` error, Ctrl+C (SIGINT), or `kill` (SIGTERM). Always use this for temporary files, database connections, lock files, or anything that needs guaranteed cleanup.
>
> Common trap signals:
> ```bash
> trap cleanup EXIT        # runs on ANY exit (normal, error, signal)
> trap 'echo Interrupted' INT     # runs on Ctrl+C
> trap 'echo Terminated' TERM     # runs on kill <pid>
> trap '' HUP              # ignore hangup (keep running after SSH disconnect)
> ```

## Related

- [error-handling-and-retry-patterns](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/error-handling-and-retry-patterns) — Cross-cutting error classification, retry strategies, and failure propagation theory
- [command-chaining](https://alp78.github.io/elysium/01-Shell/Scripting/command-chaining) — How `&&`, `||`, and `;` use exit codes
- [io-redirection](https://alp78.github.io/elysium/01-Shell/Scripting/io-redirection) — Redirecting errors for logging
- [environment-variables](https://alp78.github.io/elysium/01-Shell/Scripting/environment-variables) — Handling required vs optional configuration
- [process-substitution](https://alp78.github.io/elysium/01-Shell/Scripting/process-substitution) — Advanced I/O patterns for scripts

## References

- [GNU Bash Reference — The Set Builtin](https://www.gnu.org/software/bash/manual/html_node/The-Set-Builtin.html)
- [Unofficial Bash Strict Mode](http://redsymbol.net/articles/unofficial-bash-strict-mode/)
