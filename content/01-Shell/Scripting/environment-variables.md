---
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell, bash]
aliases: [env vars, environment variables, shell variables, export, PATH variable]
keywords: [environment variable, env var, export, PATH, bashrc, profile, credential handling, secret management, process environment, child process, variable propagation, unset, printenv]
description: "How environment variables propagate through process hierarchies in bash and PowerShell, including secure credential handling patterns and persistence across sessions."
related: [command-chaining, defensive-scripting, command-history]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Environment Variables — Configuration Without Code

Environment variables are the standard mechanism for passing configuration to processes without hardcoding values in source code. Every production system you operate — databases, orchestrators, cloud CLIs, Docker containers — reads environment variables for credentials, connection strings, feature flags, and runtime parameters.

## The Propagation Model

Understanding how environment variables propagate through process hierarchies is critical: a variable set in your shell is NOT automatically visible to a child process unless you explicitly export it. This is the source of countless "it works in my terminal but not in my cron job" bugs.

When you launch a process, it receives a COPY of the parent's exported environment. Changes in the child do not propagate back to the parent. Changes in the parent after the child starts do not reach the child. This is a one-way, point-in-time snapshot.

**Process environment propagation model:**
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

**View, set, and export environment variables:**
```bash
# View all environment variables
env
# or: printenv (identical output)
# Pipe to grep for specific ones: env | grep -i proxy

# View a specific variable
echo $HOME         # /home/airflow
echo $PATH         # /usr/local/bin:/usr/bin:/bin:...
echo $SHELL        # /bin/bash

# Set a variable for the current shell ONLY (not exported to children)
MY_VAR="value"
# This is a shell variable, not an environment variable
# Child processes will NOT see it

# Export to make it available to child processes
export MY_VAR="value"
# Now every child process launched from this shell inherits MY_VAR

# Set for a SINGLE command only (does not persist)
DB_HOST=10.132.0.2 DB_PORT=1433 python3 pipeline/run.py
# DB_HOST and DB_PORT exist only for the duration of the python3 process
# After it exits, they are gone — not even the current shell has them
# This is the cleanest way to pass one-off configuration

# Unset a variable
unset MY_VAR
# Completely removes it from the environment

# Persist across sessions (add to shell profile)
echo 'export GOOGLE_CLOUD_PROJECT="data-platform-prod"' >> ~/.bashrc
source ~/.bashrc
# ~/.bashrc = executed for every new interactive bash shell
# ~/.profile or ~/.bash_profile = executed for login shells only
# source = re-read the file in the current shell (alias: .)
```

## Secure Credential Handling

> [!warning] Never Hardcode Credentials in Scripts
> Any user on the system can run `ps aux` and see the full command line of every running process. Passing a password as a command-line argument makes it visible to everyone.

**Production scenario — secure credential handling:**
```bash
# NEVER hardcode credentials in scripts. Use environment variables.
# BAD:
sqlcmd -S 10.132.0.2 -U sa -P 'MyPassword123'  # password visible in process list!

# GOOD:
export SA_PASSWORD=$(cat /run/secrets/sa_password)
sqlcmd -S 10.132.0.2 -U sa -P "$SA_PASSWORD"

# BEST: Use a secret manager and inject at runtime (see [[secrets-management]])
export SA_PASSWORD=$(gcloud secrets versions access latest --secret="sql-sa-password")
sqlcmd -S 10.132.0.2 -U sa -P "$SA_PASSWORD"

# PARANOID (and correct): Unset after use
unset SA_PASSWORD
```

> [!info] The `ps aux` Credential Leak
> Any user on the system can run `ps aux` and see the full command line of every running process. If you pass a password as a command-line argument (`-P 'MyPassword'`), every user on the machine can read it. Environment variables are slightly better (visible only via `/proc/<pid>/environ`, which requires same-user or root access), but the gold standard is reading credentials from a file descriptor or secret manager. Docker secrets mount to `/run/secrets/` inside the [[container-lifecycle|container]] -- always use this mechanism for containerized workloads.

## PowerShell Environment Variables

```powershell
# View all environment variables
Get-ChildItem Env:
# Env: is a PowerShell drive that maps to the process environment
# Think of it as a virtual filesystem where each variable is a "file"

# View a specific variable
$env:HOME
$env:PATH
$env:GOOGLE_CLOUD_PROJECT

# Set for current session
$env:MY_VAR = "value"
# Immediately available to child processes launched from this session

# Set permanently (persists across sessions)
[Environment]::SetEnvironmentVariable("MY_VAR", "value", "User")
# "User" = per-user (HKCU registry) — persists for this user across all new sessions
# "Machine" = system-wide (HKLM registry) — requires Administrator elevation
# NOTE: Existing sessions do not pick up the change until restarted

# Unset
Remove-Item Env:MY_VAR                                          # current session only
[Environment]::SetEnvironmentVariable("MY_VAR", $null, "User")  # permanent removal
```

> [!warning] PowerShell `$env:PATH` vs System PATH
> Modifying `$env:PATH` in a PowerShell session only affects that session and its children. The system PATH (visible to new terminal windows, services, etc.) is stored in the registry. To permanently add a directory:
> ```powershell
> $current = [Environment]::GetEnvironmentVariable("PATH", "User")
> [Environment]::SetEnvironmentVariable("PATH", "$current;C:\tools\bin", "User")
> ```
> Restart your terminal for the change to take effect.

For a declarative approach to managing variables and configuration across environments, see [[terraform-variables-and-outputs]] which covers Terraform input variables, locals, and output values.

## Related

- [[defensive-scripting]] — Using `set -u` to catch unset variable references
- [[command-history]] — Preventing secrets from being saved to history
- [[command-chaining]] — Operators that control execution flow

## References

- [GNU Bash Reference — Shell Variables](https://www.gnu.org/software/bash/manual/html_node/Shell-Variables.html)
- [PowerShell Environment Provider](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_environment_provider)
