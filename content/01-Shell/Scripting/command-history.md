---
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell, bash]
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

**Search, recall, and re-run previous commands:**
```bash
# View full history
history
# Each line is numbered. Use the number to re-execute: !123

# Search history (text filter)
history | grep "sqlcmd"
# Finds every sqlcmd command you've ever run in this shell

# Reverse incremental search (the most important shortcut in bash)
# Press Ctrl+R, then type a fragment
# (reverse-i-search)`sqlcmd': sqlcmd -S 10.132.0.2 -U sa -P "$SA_PASSWORD" -d analytics_db
# Press Ctrl+R again to cycle through older matches
# Press Enter to execute, or Right arrow to edit before executing
# Press Ctrl+G or Ctrl+C to cancel

# Re-run the last command
!!
# Use case: "permission denied" → sudo !!  (re-runs with sudo prepended)

# Re-run the last command that started with a string
!git      # re-runs the most recent command starting with "git"
!docker   # re-runs the most recent docker command

# Use the last argument of the previous command
echo "new file.txt"
vim $_    # $_ = "new file.txt" (last argument of previous command)
# Also: Alt+. (press repeatedly to cycle through older last-arguments)

# History expansion — modify and re-run
^typo^fix          # Re-run last command with "typo" replaced by "fix"
!!:s/old/new       # Same thing, more explicit syntax
!-2                # Run the command from 2 commands ago

# Prevent a command from being saved to history
 command_with_secret  # leading space (requires HISTCONTROL=ignorespace in .bashrc)
```

## Building Complex Commands Incrementally

**Production scenario — building commands step by step using history recall:**
```bash
# Step 1: Test the base query
sqlcmd -S 10.132.0.2 -U sa -P "$SA_PASSWORD" -d analytics_db -Q "SELECT COUNT(*) FROM dbo.market_data"
# Step 2: Ctrl+R, type "sqlcmd", modify the query
sqlcmd -S 10.132.0.2 -U sa -P "$SA_PASSWORD" -d analytics_db -Q "SELECT TOP 10 * FROM dbo.market_data ORDER BY date DESC"
# Step 3: Ctrl+R again, refine further
# Each iteration builds on the previous — you never retype the connection parameters
```

## History Configuration for Data Engineers

> [!info] History Configuration
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

## PowerShell History

```powershell
# Search history
Get-History | Where-Object CommandLine -like "*sqlcmd*"
# or: h | ? CommandLine -like "*sql*"  (using aliases)

# Reverse search (same as bash — provided by PSReadLine)
# Ctrl+R, then type — works identically

# Re-run a specific history entry
Invoke-History -Id 42

# Re-run last command
Invoke-History

# PSReadLine predictive IntelliSense (PowerShell 7+)
Set-PSReadLineOption -PredictionSource History
Set-PSReadLineOption -PredictionViewStyle ListView
# As you type, PowerShell shows matching commands from history
# Arrow keys to select, Right arrow to accept
# This alone is worth upgrading to PowerShell 7
```

## Related

- [[environment-variables]] — Preventing secrets from being stored in history
- [[defensive-scripting]] — Writing scripts that don't need manual recall
- [[command-chaining]] — Building complex command pipelines

## References

- [GNU Bash Reference — History](https://www.gnu.org/software/bash/manual/html_node/Bash-History-Facilities.html)
- [PSReadLine Module](https://learn.microsoft.com/en-us/powershell/module/psreadline/)
