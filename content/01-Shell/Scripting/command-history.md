---
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell, bash, linux, powershell]
aliases: [command history, shell history, history recall, reverse search, Ctrl+R]
keywords: [command history, history, reverse search, Ctrl+R, bash history, HISTSIZE, HISTCONTROL, recall, re-run command, bang bang, exclamation, PSReadLine, predictive intellisense]
description: "How to search, recall, and re-run previous shell commands in bash and PowerShell, including history configuration for data engineers and incident response."
related: [environment-variables, defensive-scripting, command-chaining]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Command History and Recall — Speed Through Muscle Memory

In an incident at 2 AM, you do not have time to retype a complex pipeline command from memory. Your shell history is a searchable log of every command you have run, and the speed at which you can recall and modify previous commands directly affects your response time.

## Bash History

#### history, Ctrl+R, !!, !$ — search, recall, re-run commands
```bash
# View full history
history
# Each line is numbered. Use the number to re-execute: !123

# Search history (text filter)
history | grep "sqlcmd"
# Finds every sqlcmd command you've ever run in this shell
```

> [!tip] Reverse search with Ctrl+R
>
> 1. Press `Ctrl+R`, then type a fragment (e.g., `sqlcmd`)
> 2. Bash shows the most recent match: `(reverse-i-search)'sqlcmd': sqlcmd -S 10.132.0.2 -U sa -P "$SA_PASSWORD" -d analytics_db`
> 3. Press `Ctrl+R` again to cycle through older matches
> 4. Press `Enter` to execute, or `→` (right arrow) to edit before executing
> 5. Press `Ctrl+G` or `Ctrl+C` to cancel

#### !! — re-run the last command

> [!info] sudo !! pattern
>
> The most common use: `sudo !!` — re-runs the last command with `sudo` prepended
> after a "permission denied" error.

```bash
!!
sudo !!
```

#### !string — re-run the most recent command starting with a string

```bash
!git
!docker
```

> [!warning] !string runs without confirmation
>
> `!rm` re-runs your most recent `rm` command with no chance to review it. Use
> `!rm:p` to **print** the match without executing, then `!!` to run it after review.

#### $_ and Alt+. — recall the last argument of the previous command

```bash
mkdir /data/pipeline/new_output
cd $_
```

#### ^old^new — quick substitution in last command

```bash
^typo^fix
```

#### Leading space — prevent a command from being saved to history

> [!info] Hide from history with leading space
>
> Requires `HISTCONTROL=ignorespace` in `.bashrc`. Use for commands containing
> temporary credentials or sensitive parameters.

```bash
 command_with_secret
```

## Building Complex Commands Incrementally

#### History workflow — building commands step by step with !!, ^old^new
```bash
# Step 1: Test the base query
sqlcmd -S 10.132.0.2 -U sa -P "$SA_PASSWORD" -d analytics_db -Q "SELECT COUNT(*) FROM dbo.market_data"
# Step 2: Ctrl+R, type "sqlcmd", modify the query
sqlcmd -S 10.132.0.2 -U sa -P "$SA_PASSWORD" -d analytics_db -Q "SELECT TOP 10 * FROM dbo.market_data ORDER BY date DESC"
# Step 3: Ctrl+R again, refine further
# Each iteration builds on the previous — you never retype the connection parameters
```

### HISTSIZE, HISTCONTROL — history configuration for .bashrc

> [!info] History configuration
>
> Add these to your `~/.bashrc` to supercharge your history:
> ```bash
> export HISTSIZE=50000            # commands to keep in memory
> export HISTFILESIZE=100000       # commands to keep in ~/.bash_history
> export HISTCONTROL=ignoreboth    # ignore duplicates and space-prefixed commands
> export HISTTIMEFORMAT="%Y-%m-%d %H:%M:%S  "  # timestamp each command
> shopt -s histappend              # append to history file, don't overwrite
> PROMPT_COMMAND="history -a"      # write to file after every command (survives crashes)
> ```
> The timestamp format is invaluable during post-incident reviews: "What commands were run on the database server between 14:00 and 14:30 yesterday?"

### PowerShell — Get-History, PSReadLine predictive IntelliSense

#### Get-History — search PowerShell history

```powershell
Get-History | Where-Object CommandLine -like "*sqlcmd*"
```

#### Invoke-History — re-run a previous command

```powershell
Invoke-History -Id 42
Invoke-History
```

#### Set-PSReadLineOption — predictive IntelliSense (PowerShell 7+)

> [!tip] PSReadLine predictive IntelliSense
>
> PSReadLine's predictive IntelliSense shows matching commands from history as you
> type. Arrow keys to select, Right arrow to accept. This alone is worth upgrading to
> PowerShell 7.

```powershell
Set-PSReadLineOption -PredictionSource History
Set-PSReadLineOption -PredictionViewStyle ListView
```

## Related

- [environment-variables](/01-Shell/Scripting/environment-variables) — Preventing secrets from being stored in history
- [defensive-scripting](/01-Shell/Scripting/defensive-scripting) — Writing scripts that don't need manual recall
- [command-chaining](/01-Shell/Scripting/command-chaining) — Building complex command pipelines

## References

- [GNU Bash Reference — History](https://www.gnu.org/software/bash/manual/html_node/Bash-History-Facilities.html)
- [PSReadLine Module](https://learn.microsoft.com/en-us/powershell/module/psreadline/)
