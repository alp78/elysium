---
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell, scripting]
aliases: [env vars, environment variables, shell variables, export, PATH variable]
keywords: [environment variable, env var, export, PATH, bashrc, profile, credential handling, secret management, process environment, child process, variable propagation, unset, printenv]
description: "How environment variables propagate through process hierarchies in bash and PowerShell, including secure credential handling patterns and persistence across sessions."
created: 2026-03-22
updated: 2026-04-03
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

When you launch a process, it receives a copy of the parent's exported environment at that instant. Changes in the child do not propagate back to the parent. Changes made in the parent after the child starts do not reach the child. This is a one-way, point-in-time snapshot.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {'primaryColor': '#292e42','primaryTextColor': '#c0caf5','primaryBorderColor': '#565f89','lineColor': '#565f89','secondaryColor': '#1a1b26','tertiaryColor': '#24283b','noteTextColor': '#c0caf5','noteBkgColor': '#292e42','textColor': '#c0caf5','fontSize': '14px'}}}%%
flowchart TD
    A["Shell (parent)<br/>export DB_HOST=10.132.0.2"] -->|"fork + exec<br/>snapshot of env"| B["Child Process A<br/>DB_HOST=10.132.0.2"]
    A -->|"parent changes DB_HOST=10.132.0.3"| C["Shell (parent)<br/>export DB_HOST=10.132.0.3"]
    C -->|"fork + exec<br/>snapshot of new env"| D["Child Process B<br/>DB_HOST=10.132.0.3"]
    B -.-|"child still sees<br/>10.132.0.2"| B
    style A fill:#292e42,stroke:#565f89
    style B fill:#1a1b26,stroke:#565f89
    style C fill:#292e42,stroke:#565f89
    style D fill:#1a1b26,stroke:#565f89
```

## Linux environment variable tools

Linux environment variables are managed through shell built-ins (`export`, `unset`) and the process environment utilities (`env`, `printenv`). Variables can be session-scoped, command-scoped, or persisted to shell startup files.

### Linux | env, printenv | view environment variables

`env` prints the full set of exported environment variables for the current process. `printenv` is similar but accepts variable names as arguments to print specific values. Both show only exported variables — shell-local variables are not included.

#### List all exported environment variables

```bash
env
```

```text
SHELL=/bin/bash
HOME=/home/user
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin
DB_HOST=10.132.0.2
GOOGLE_CLOUD_PROJECT=data-platform-prod
...
```

#### Filter environment variables by pattern

```bash
env | grep -i proxy
```

#### Print the value of a specific variable

```bash
printenv DB_HOST
```

```text
10.132.0.2
```

#### Print multiple variables in one call

```bash
printenv HOME PATH SHELL
```

| Flag | Syntax | Description |
|---|---|---|
| `-0` | `env -0` | Separate output with null bytes instead of newlines (safe for filenames with spaces) |
| `-i` | `env -i command` | Run command with a completely empty environment |
| `-u` | `env -u VAR command` | Run command with VAR removed from the environment |

### Linux | export | set and propagate variables

`export` marks a shell variable for inclusion in the environment of child processes. Without `export`, a variable assignment is a shell-local variable — invisible to any child process.

#### Set and export a variable to child processes

```bash
export MY_VAR="value"
```

> [!warning] Without `export`, the variable is not in the environment
>
> `MY_VAR="value"` creates a shell-local variable. Child processes — Python scripts, Docker commands, cron jobs — will NOT see it. This is the most common cause of "it works in my terminal but not in my script."

> [!success] Always use `export` for variables that must be visible to subprocesses
>
> ```bash
> export DB_HOST="10.132.0.2"
> python3 pipeline/run.py  # os.environ["DB_HOST"] returns "10.132.0.2"
> ```

#### Export an existing shell variable

```bash
MY_VAR="value"
export MY_VAR
```

#### Set a variable only for a single command

Prefixing `KEY=value` before a command sets the variable in that command's environment only. It is not added to the current shell's environment at all — the cleanest way to pass one-off configuration.

```bash
DB_HOST=10.132.0.2 DB_PORT=1433 python3 pipeline/run.py
```

#### Export and set in one step (inline assignment)

```bash
export DB_HOST=10.132.0.2 DB_PORT=1433
```

| Flag | Syntax | Description |
|---|---|---|
| `-n` | `export -n VAR` | Remove the export attribute from a variable (keeps the value in the shell, stops exporting to children) |
| `-f` | `export -f func` | Export a shell function so subshells inherit it |
| `-p` | `export -p` | Print all exported variables and functions in a format that can be re-sourced |

### Linux | unset | remove variables

`unset` removes a variable from both the shell environment and the export list. After `unset`, the variable no longer exists in the current shell or in any new child processes.

#### Remove a variable from the environment

```bash
unset MY_VAR
```

#### Unset a shell function

```bash
unset -f my_function
```

| Flag | Syntax | Description |
|---|---|---|
| `-v` | `unset -v VAR` | Unset a variable (default behavior) |
| `-f` | `unset -f func` | Unset a function |

### Linux | .bashrc, .profile | persist variables across sessions

Shell startup files are the standard mechanism for persisting environment variables. The right file depends on whether the shell is a login shell or an interactive non-login shell.

`~/.bashrc` is sourced for every new interactive non-login bash shell (i.e., every new terminal window or tab). `~/.profile` (or `~/.bash_profile`) is sourced for login shells only — SSH sessions, console logins, and shells started with `--login`. To cover both cases, the common pattern is to put exports in `~/.bashrc` and source `~/.bashrc` from `~/.profile`. `source` (or its alias `.`) re-reads the file in the current shell without opening a new process.

#### Persist a variable by appending to .bashrc

```bash
echo 'export GOOGLE_CLOUD_PROJECT="data-platform-prod"' >> ~/.bashrc
```

#### Reload .bashrc in the current session

```bash
source ~/.bashrc
```

> [!warning] `.bashrc` is not sourced in cron jobs
>
> Cron runs each command in a minimal environment — it does NOT source `.bashrc`, `.profile`, or any startup file. Variables defined only in those files will be missing.

> [!success] Define variables directly in crontab or source the profile explicitly
>
> ```bash
> # In crontab (crontab -e):
> DB_HOST=10.132.0.2
> 0 3 * * * /home/user/scripts/backup.sh
>
> # Or source the profile at the start of the cron command:
> 0 3 * * * . ~/.profile && /home/user/scripts/backup.sh
> ```

### Linux | .env files, source | load variables from a file

`.env` files are plain-text files listing `KEY=value` pairs, one per line. They are a de-facto standard (popularized by [12-factor apps](https://12factor.net/config)) for keeping configuration out of source code and out of startup files. They are not processed automatically — you must explicitly load them.

#### Create a .env file

```bash
cat > .env << 'EOF'
DB_HOST=10.132.0.2
DB_PORT=5432
DB_NAME=warehouse
EOF
```

#### Source a .env file into the current shell

`source` (or `.`) executes the file in the current shell context, making all exported variables available immediately.

```bash
source .env
```

> [!danger] Never commit .env files to version control
>
> `.env` files typically contain credentials and secrets. Committing them to git exposes those secrets permanently — even after deletion, git history preserves them.

> [!success] Add `.env` to `.gitignore` and commit only the template
>
> ```bash
> echo ".env" >> .gitignore
> cp .env .env.example  # strip actual values, commit .env.example as the template
> ```

#### Export variables from a .env file without polluting the current shell

`env` with `-a` reads from a file; alternatively, use a subshell so the variables are scoped only to the command.

```bash
env $(grep -v '^#' .env | xargs) python3 pipeline/run.py
```

### Linux | envsubst | substitute variables into templates

`envsubst` replaces `$VAR` or `${VAR}` placeholders in a template file with the current values of those environment variables. It is part of the GNU `gettext` package and is widely used in CI/CD pipelines and Docker entrypoints to generate config files from templates.

#### Substitute all variables in a template

```bash
envsubst < config.template.yaml > config.yaml
```

#### Substitute only specific variables

Passing a comma-separated list of variable names in `$'...'` quoting restricts substitution to only those variables, leaving all others literal.

```bash
envsubst '$DB_HOST,$DB_PORT' < config.template.yaml > config.yaml
```

| Flag | Syntax | Description |
|---|---|---|
| (none) | `envsubst < template` | Substitute all `$VAR` / `${VAR}` occurrences in stdin |
| `'$LIST'` | `envsubst '$A,$B' < template` | Restrict substitution to the named variables only |
| `-v` | `envsubst -v < template` | List all variables found in the template (dry run, no substitution) |

## PowerShell environment variable tools

PowerShell exposes the process environment through the `Env:` PSDrive — a virtual filesystem where each environment variable is a "file" you navigate with the standard provider cmdlets (`Get-ChildItem`, `Set-Item`, `Remove-Item`). For persistent changes across sessions, use the `[System.Environment]` .NET class which writes directly to the Windows registry.

### PowerShell | Get-ChildItem Env:, $env: | view environment variables

The `Env:` drive lists all variables in the current process environment. Individual variables are read with the `$env:NAME` syntax, which is the PowerShell equivalent of `$NAME` in bash.

#### List all environment variables

```powershell
Get-ChildItem Env:
```

```text
Name                           Value
----                           -----
COMPUTERNAME                   WORKSTATION01
Path                           C:\Windows\system32;C:\Windows;...
USERNAME                       aperi
DB_HOST                        10.132.0.2
...
```

#### Read a specific variable

```powershell
$env:PATH
```

#### Filter environment variables by pattern

```powershell
Get-ChildItem Env: | Where-Object { $_.Name -like "*PROXY*" }
```

#### Check whether a variable is set

```powershell
[bool]$env:DB_HOST
```

### PowerShell | $env:VAR | set variables for the current session

Assigning to `$env:VAR` sets the variable in the current process environment. This is equivalent to `export VAR=value` in bash — child processes spawned from this session will inherit the variable, but it does not persist after the session ends.

#### Set a variable for the current session

```powershell
$env:MY_VAR = "value"
```

#### Set a variable for a single command only

In PowerShell, there is no inline `KEY=value command` syntax. The idiomatic equivalent is to set the variable, run the command, then unset it — or use a temporary subshell via `Start-Process`.

```powershell
$env:DB_HOST = "10.132.0.2"
python pipeline/run.py
Remove-Item Env:DB_HOST
```

> [!tip] Use a try/finally block to guarantee cleanup even on error
>
> ```powershell
> $env:DB_HOST = "10.132.0.2"
> try { python pipeline/run.py }
> finally { Remove-Item Env:DB_HOST -ErrorAction SilentlyContinue }
> ```

### PowerShell | [System.Environment]::SetEnvironmentVariable | persist across sessions

`[System.Environment]::SetEnvironmentVariable` writes to the Windows registry, making variables available to all new processes after the current session restarts. The `"User"` scope writes to `HKCU:\Environment`; `"Machine"` scope writes to `HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment` and requires Administrator rights. Existing running sessions do NOT pick up the change until they are restarted.

#### Persist a variable for the current user

```powershell
[Environment]::SetEnvironmentVariable("MY_VAR", "value", "User")
```

#### Persist a variable system-wide (requires Administrator)

```powershell
[Environment]::SetEnvironmentVariable("MY_VAR", "value", "Machine")
```

#### Read a persisted variable from the registry

```powershell
[Environment]::GetEnvironmentVariable("MY_VAR", "User")
```

#### Persist a variable in $PROFILE (PowerShell equivalent of .bashrc)

`$PROFILE` is the path to the current user's PowerShell profile script, sourced on every new session — equivalent to `~/.bashrc` in bash. This approach is simpler than the registry for user-scoped variables.

```powershell
Add-Content -Path $PROFILE -Value '$env:GOOGLE_CLOUD_PROJECT = "data-platform-prod"'
```

#### Reload the profile in the current session

```powershell
. $PROFILE
```

### PowerShell | Remove-Item Env:, SetEnvironmentVariable $null | unset variables

Session-scoped variables are removed with `Remove-Item Env:VAR`. To remove a persisted (registry) variable, pass `$null` as the value to `SetEnvironmentVariable`.

#### Remove a variable from the current session

```powershell
Remove-Item Env:MY_VAR
```

#### Remove a persisted user variable (registry)

```powershell
[Environment]::SetEnvironmentVariable("MY_VAR", $null, "User")
```

> [!warning] Session PATH and system PATH are independent
>
> Modifying `$env:PATH` in a PowerShell session only affects that session and its children. The system PATH stored in the registry is not changed, and new terminal windows will not see the modification.

> [!success] Update the registry PATH to make changes permanent
>
> ```powershell
> $current = [Environment]::GetEnvironmentVariable("PATH", "User")
> [Environment]::SetEnvironmentVariable("PATH", "$current;C:\tools\bin", "User")
> ```
> Restart the terminal for the change to take effect in all new sessions.

| Flag/Method | Syntax | Description |
|---|---|---|
| `Remove-Item Env:` | `Remove-Item Env:VAR` | Remove variable from current session only |
| `SetEnvironmentVariable $null` | `[Environment]::SetEnvironmentVariable("VAR", $null, "User")` | Delete persisted user variable from registry |
| `SetEnvironmentVariable $null` | `[Environment]::SetEnvironmentVariable("VAR", $null, "Machine")` | Delete persisted machine variable (requires Administrator) |

### PowerShell | .env files | load variables from a file

PowerShell has no native `.env` file loader. The standard approach is to parse the file manually or use a community module such as `Set-PsEnv` (from the `Set-PsEnv` module on PSGallery).

#### Load a .env file manually

This function reads each non-comment, non-blank line, splits on the first `=`, and sets `$env:KEY = value`.

```powershell
Get-Content .env | Where-Object { $_ -notmatch '^\s*#' -and $_ -match '=' } | ForEach-Object {
    $key, $val = $_ -split '=', 2
    [System.Environment]::SetEnvironmentVariable($key.Trim(), $val.Trim(), "Process")
}
```

#### Install and use the Set-PsEnv module

```powershell
Install-Module -Name Set-PsEnv -Scope CurrentUser
Set-PsEnv
```

> [!danger] Never commit .env files to version control
>
> `.env` files typically contain credentials and secrets. Committing them exposes secrets permanently in git history, even after deletion.

> [!success] Add `.env` to `.gitignore` and commit only the sanitized template
>
> ```powershell
> Add-Content -Path .gitignore -Value ".env"
> Copy-Item .env .env.example  # manually strip actual values before committing
> ```

## Secure Credential Handling

Credentials must never appear as command-line arguments or hardcoded in scripts. Any user on the system can run `ps aux` (Linux) or `Get-Process` (PowerShell) and see full argument lists of running processes — including passwords passed with flags like `-P 'MyPassword'`.

### Linux | credential injection patterns

#### Read a secret from a file or secret manager at runtime

Rather than storing the credential in the environment permanently, resolve it at the point of use.

```bash
export SA_PASSWORD=$(cat /run/secrets/sa_password)
sqlcmd -S 10.132.0.2 -U sa -P "$SA_PASSWORD"
```

#### Inject a secret from GCP Secret Manager

```bash
export SA_PASSWORD=$(gcloud secrets versions access latest --secret="sql-sa-password")
sqlcmd -S 10.132.0.2 -U sa -P "$SA_PASSWORD"
```

#### Unset credentials immediately after use

```bash
unset SA_PASSWORD
```

> [!info] Process environment visibility on Linux
>
> Environment variables are visible to the process owner and root via `/proc/<pid>/environ`. They are significantly safer than command-line arguments (visible to all users via `ps aux`), but the gold standard is reading credentials from a file descriptor or a secret manager. Docker secrets mount to `/run/secrets/` inside the [container](https://alp78.github.io/elysium/09-Docker/container-lifecycle) — always use this for containerised workloads.

> [!danger] Never pass credentials as command-line arguments
>
> ```bash
> sqlcmd -S 10.132.0.2 -U sa -P 'MyPassword123'  # visible in ps aux to all users
> ```

> [!success] Pass credentials through environment variables or file descriptors
>
> ```bash
> export SA_PASSWORD=$(gcloud secrets versions access latest --secret="sql-sa-password")
> sqlcmd -S 10.132.0.2 -U sa -P "$SA_PASSWORD"
> unset SA_PASSWORD
> ```
> See [secrets-management](https://alp78.github.io/elysium/06-GCP/Security/secrets-management) for the full GCP pattern.

### PowerShell | credential injection patterns

#### Read a secret from a file at runtime

```powershell
$env:SA_PASSWORD = Get-Content "C:\secrets\sa_password.txt" -Raw
sqlcmd -S 10.132.0.2 -U sa -P $env:SA_PASSWORD
```

#### Inject a secret from Azure Key Vault or GCP Secret Manager

```powershell
$env:SA_PASSWORD = (gcloud secrets versions access latest --secret="sql-sa-password")
sqlcmd -S 10.132.0.2 -U sa -P $env:SA_PASSWORD
```

#### Unset credentials immediately after use

```powershell
Remove-Item Env:SA_PASSWORD
```

> [!danger] Never pass credentials as command-line arguments in PowerShell
>
> ```powershell
> sqlcmd -S 10.132.0.2 -U sa -P "MyPassword123"  # visible in Get-WmiObject Win32_Process
> ```

> [!success] Use SecureString or environment variables loaded from a secret manager
>
> ```powershell
> $env:SA_PASSWORD = (gcloud secrets versions access latest --secret="sql-sa-password")
> sqlcmd -S 10.132.0.2 -U sa -P $env:SA_PASSWORD
> Remove-Item Env:SA_PASSWORD
> ```

For a declarative approach to managing variables and configuration across environments, see [terraform-variables-and-outputs](https://alp78.github.io/elysium/07-Terraform/Fundamentals/terraform-variables-and-outputs) which covers Terraform input variables, locals, and output values.

## Related

- [defensive-scripting](https://alp78.github.io/elysium/01-Shell/Scripting/defensive-scripting) — Using `set -u` to catch unset variable references
- [command-history](https://alp78.github.io/elysium/01-Shell/Scripting/command-history) — Preventing secrets from being saved to history
- [command-chaining](https://alp78.github.io/elysium/01-Shell/Scripting/command-chaining) — Operators that control execution flow

## References

- [GNU Bash Reference — Shell Variables](https://www.gnu.org/software/bash/manual/html_node/Shell-Variables.html)
- [PowerShell Environment Provider](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_environment_provider)
