---
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell, bash, linux, powershell]
aliases: [env vars, environment variables, shell variables, export, PATH variable]
keywords: [environment variable, env var, export, PATH, bashrc, profile, credential handling, secret management, process environment, child process, variable propagation, unset, printenv]
description: "How environment variables propagate through process hierarchies in bash and PowerShell, including secure credential handling patterns and persistence across sessions."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Environment Variables — Configuration Without Code

Environment variables are the standard mechanism for passing configuration to processes without hardcoding values in source code. Every production system you operate — databases, orchestrators, cloud CLIs, Docker containers — reads environment variables for credentials, connection strings, feature flags, and runtime parameters.

> [!quote]
> "Explicit is better than implicit."
>
> — **Tim Peters**, The Zen of Python

## The Propagation Model

Understanding how environment variables propagate through process hierarchies is critical: a variable set in your shell is NOT automatically visible to a child process unless you explicitly export it. This is the source of countless "it works in my terminal but not in my cron job" bugs.

When you launch a process, it receives a COPY of the parent's exported environment. Changes in the child do not propagate back to the parent. Changes in the parent after the child starts do not reach the child. This is a one-way, point-in-time snapshot.

#### export — process environment propagation model
```
Shell (parent)
├── export DB_HOST=10.132.0.2     ← parent sets variable
├── python3 pipeline/run.py        ← child gets DB_HOST=10.132.0.2
│   └── os.environ["DB_HOST"]      ← reads "10.132.0.2"
├── export DB_HOST=10.132.0.3     ← parent changes it
└── python3 pipeline/run.py        ← NEW child gets DB_HOST=10.132.0.3
    └── (the FIRST child still sees 10.132.0.2)
```

## Bash Environment Variables

#### env, export, printenv — view, set, and export environment variables
#### env, printenv — view environment variables

```bash
env
env | grep -i proxy
```

#### export — set and propagate variables to child processes

> [!warning] Without export it is not exported
>
> `MY_VAR="value"` is NOT an environment variable.
> Without `export`, the variable is a **shell variable** — visible only in the current
> shell. Child processes (Python scripts, docker commands, cron jobs) will NOT see it.
> This is the #1 cause of "it works in my terminal but not in my script."

```bash
export MY_VAR="value"
```

#### VAR=value command — set variable for a single command only

> [!info] Scoped to single command
>
> The variable exists only for the duration of the command. After it exits, the
> variable is gone — not even the current shell has it. This is the cleanest way to pass
> one-off configuration.

```bash
DB_HOST=10.132.0.2 DB_PORT=1433 python3 pipeline/run.py
```

#### unset — remove a variable from the environment

```bash
unset MY_VAR
```

#### ~/.bashrc vs ~/.profile — persisting variables across sessions

> [!info] .bashrc vs .profile
>
> `~/.bashrc` is executed for every new interactive bash shell. `~/.profile` (or
> `~/.bash_profile`) is executed for login shells only. `source` re-reads the file in the
> current shell without opening a new one.

```bash
echo 'export GOOGLE_CLOUD_PROJECT="data-platform-prod"' >> ~/.bashrc
source ~/.bashrc
```

> [!warning] .bashrc not available in cron
>
> Cron runs commands in a minimal environment that does NOT source `.bashrc`. Define
> variables directly in the crontab (`VAR=value` above the schedule line) or source the
> profile explicitly at the start of the cron command.

## Secure Credential Handling

> [!warning] Never hardcode credentials
>
> Any user on the system can run `ps aux` and see the full command line of every running process. Passing a password as a command-line argument makes it visible to everyone.

#### .env files and source — secure credential handling in scripts
```bash
# NEVER hardcode credentials in scripts. Use environment variables.
# BAD:
sqlcmd -S 10.132.0.2 -U sa -P 'MyPassword123'  # password visible in process list!

# GOOD:
export SA_PASSWORD=$(cat /run/secrets/sa_password)
sqlcmd -S 10.132.0.2 -U sa -P "$SA_PASSWORD"

# BEST: Use a secret manager and inject at runtime (see [secrets-management](https://alp78.github.io/elysium/06-GCP/Security/secrets-management))
export SA_PASSWORD=$(gcloud secrets versions access latest --secret="sql-sa-password")
sqlcmd -S 10.132.0.2 -U sa -P "$SA_PASSWORD"

# PARANOID (and correct): Unset after use
unset SA_PASSWORD
```

> [!info] ps aux credential leak
>
> Any user on the system can run `ps aux` and see the full command line of every running process. If you pass a password as a command-line argument (`-P 'MyPassword'`), every user on the machine can read it. Environment variables are slightly better (visible only via `/proc/<pid>/environ`, which requires same-user or root access), but the gold standard is reading credentials from a file descriptor or secret manager. Docker secrets mount to `/run/secrets/` inside the [container](https://alp78.github.io/elysium/09-Docker/container-lifecycle) -- always use this mechanism for containerized workloads.

### PowerShell — $env: drive, SetEnvironmentVariable for persistent env vars

#### Get-ChildItem Env: — view all environment variables

> [!info] PowerShell Env: drive
>
> `Env:` is a PowerShell drive mapping to the process environment — each variable
> is a "file" you can read with `$env:NAME`.

```powershell
Get-ChildItem Env:
$env:PATH
```

#### $env:VAR — set for current session

```powershell
$env:MY_VAR = "value"
```

#### SetEnvironmentVariable — persist across sessions (registry)

> [!info] Persist across sessions
>
> `"User"` = per-user (HKCU registry). `"Machine"` = system-wide (requires
> Administrator). Existing sessions do NOT pick up the change until restarted.

```powershell
[Environment]::SetEnvironmentVariable("MY_VAR", "value", "User")
```

#### Remove-Item Env: — unset variables

```powershell
Remove-Item Env:MY_VAR
[Environment]::SetEnvironmentVariable("MY_VAR", $null, "User")
```

> [!warning] Session PATH vs system PATH
>
> Modifying `$env:PATH` in a PowerShell session only affects that session and its children. The system PATH (visible to new terminal windows, services, etc.) is stored in the registry. To permanently add a directory:
> ```powershell
> $current = [Environment]::GetEnvironmentVariable("PATH", "User")
> [Environment]::SetEnvironmentVariable("PATH", "$current;C:\tools\bin", "User")
> ```
> Restart your terminal for the change to take effect.

For a declarative approach to managing variables and configuration across environments, see [terraform-variables-and-outputs](https://alp78.github.io/elysium/07-Terraform/Fundamentals/terraform-variables-and-outputs) which covers Terraform input variables, locals, and output values.

## Related

- [defensive-scripting](https://alp78.github.io/elysium/01-Shell/Scripting/defensive-scripting) — Using `set -u` to catch unset variable references
- [command-history](https://alp78.github.io/elysium/01-Shell/Scripting/command-history) — Preventing secrets from being saved to history
- [command-chaining](https://alp78.github.io/elysium/01-Shell/Scripting/command-chaining) — Operators that control execution flow

## References

- [GNU Bash Reference — Shell Variables](https://www.gnu.org/software/bash/manual/html_node/Shell-Variables.html)
- [PowerShell Environment Provider](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_environment_provider)
