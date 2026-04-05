---
title: "Domain: Script Engineering"
tags:
  - domain
  - shell
---

# Script Engineering

Building reliable shell scripts with proper history management, IO control, chaining, expansion, environment variables, and defensive error handling.

```mermaid
mindmap
  ((Script Engineering))
    (command history)
    (IO redirection)
    (command chaining)
    (process substitution)
    (brace expansion)
    (environment variables)
    (defensive scripting)
    (bash automation)
    (powershell automation)
```

> [!abstract]- [[command-history]]
>
> - [[command-history#Bash History|Search, recall, re-run]]
> - [[command-history#Building Complex Commands Incrementally|Building commands incrementally]]
> - [[command-history#HISTSIZE, HISTCONTROL — history configuration for .bashrc|History configuration]]
> - [[command-history#PowerShell — Get-History, PSReadLine predictive IntelliSense|PowerShell equivalents]]

> [!abstract]- [[io-redirection]]
>
> - [[io-redirection#Bash Redirection|Stdout, stderr, stdin redirection]]
> - [[io-redirection#Production Logging Patterns]]
> - [[io-redirection#Redirect-before-write gotcha]]
> - [[io-redirection#PowerShell — Out-File|PowerShell equivalents]]

> [!abstract]- [[command-chaining]]
>
> - [[command-chaining#AND Operator|AND operator]]
> - [[command-chaining#Semicolon|Semicolon]]
> - [[command-chaining#OR Operator|OR operator]]
> - [[command-chaining#AND + OR Combined|Combined try/catch pattern]]
> - [[command-chaining#Pipe|Pipe]]

> [!abstract]- [[process-substitution]]
>
> - [[process-substitution#Process Substitution]]
> - [[process-substitution#Here Documents]]
> - [[process-substitution#Here Strings]]

> [!abstract]- [[brace-expansion-and-globbing]]
>
> - [[brace-expansion-and-globbing#Brace Expansion]]
> - [[brace-expansion-and-globbing#Globbing — Extended Patterns|Globbing and extended patterns]]
> - [[brace-expansion-and-globbing#shopt settings for .bashrc — extglob, globstar, failglob|Shell options for .bashrc]]
> - [[brace-expansion-and-globbing#PowerShell — ForEach-Object loops and Get-ChildItem -Recurse for globbing|PowerShell equivalents]]

> [!abstract]- [[environment-variables]]
>
> - [[environment-variables#The Propagation Model|Propagation model]]
> - [[environment-variables#Bash Environment Variables|Setting and exporting]]
> - [[environment-variables#Secure Credential Handling]]
> - [[environment-variables#PowerShell — $env: drive, SetEnvironmentVariable for persistent env vars|PowerShell equivalents]]

> [!abstract]- [[defensive-scripting]]
>
> - [[defensive-scripting#set -e — exit immediately on error|Exit on error]]
> - [[defensive-scripting#set -u — treat unset variables as errors|Unset variable protection]]
> - [[defensive-scripting#set -o pipefail — propagate pipeline failures|Pipeline failure propagation]]
> - [[defensive-scripting#Production script template — set -euo pipefail with trap cleanup|Production script template]]
> - [[defensive-scripting#trap EXIT — guaranteed cleanup on script exit, error, or signal|Trap cleanup on exit]]

> [!abstract]- [[bash-automation]]
>
> - [[bash-automation#File Intake and Validation|File intake and validation]]
> - [[bash-automation#Data Transformation|Data transformation]]
> - [[bash-automation#API Interaction|API interaction]]
> - [[bash-automation#Database Operations|Database operations]]

> [!abstract]- [[powershell-automation]]
>
> - [[powershell-automation#File Intake and Validation|File intake and validation]]
> - [[powershell-automation#Data Transformation|Data transformation]]
> - [[powershell-automation#API Interaction|API interaction]]
> - [[powershell-automation#Database Operations|Database operations]]
