---
type: index
category: shell
technology: [bash, powershell]
tags: [shell, bash, linux, powershell]
aliases: [Shell Index, Shell Section, Bash Index, CLI Reference, Command Line, Linux Commands]
keywords: [shell, bash, powershell, linux, cli, command line, grep, awk, sed, find, rsync, ps, systemctl, curl, networking, text processing, scripting, file operations]
description: "Index for the Shell section — text processing (grep, awk, sed), file operations, scripting fundamentals, process management, and networking commands. Every note covers both bash and PowerShell."
related:
  - "[[index|Elysium]]"
  - "[[sql-server-index]]"
  - "[[gcp-index]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Shell — Command Line for Data Engineers

The command line is the data engineer's primary interface to production systems. Every note in this section covers both **bash** (Linux/macOS) and **PowerShell** (Windows) equivalents, so you can work across platforms.

## Text Processing

The core toolkit for transforming, searching, and analyzing data from the command line. These are the commands that replace ad-hoc Python scripts for quick data tasks.

| Note | Description |
|------|-------------|
| [[grep-and-pattern-matching]] | Pattern search with regex — basic/extended/PCRE, recursive search, ripgrep, data engineering scenarios |
| [[awk-data-processing]] | Field extraction, filtering, aggregation, group-by — awk as a column-oriented data processor |
| [[sed-stream-editing]] | Find-and-replace, in-place editing, line manipulation — stream transformation for config files and data |
| [[reading-file-contents]] | cat, head, tail, less — reading and tailing files, 15GB log analysis workflow |
| [[date-and-time-handling]] | ISO 8601 formats, timezone management, date arithmetic — bash, PowerShell, SQL, Python, C# |

## File Operations

Creating, moving, finding, compressing, and transferring files.

| Note | Description |
|------|-------------|
| [[navigation-and-listing]] | ls, du, df, tree — navigating directories and understanding disk usage |
| [[file-manipulation]] | cp, mv, rm, chmod, chown, rsync — copying, moving, and permission management |
| [[finding-files]] | find with -mtime/-size/-exec, xargs parallel processing, fd vs locate |
| [[compression]] | gzip, zstd, tar — compression strategies and archive management |
| [[data-transfer]] | rsync, scp, gcloud scp, gsutil, bcp — transferring data between systems |

## Scripting

Building reliable shell scripts for pipelines, automation, and infrastructure.

| Note | Description |
|------|-------------|
| [[environment-variables]] | export, env, .env files — managing configuration across environments |
| [[io-redirection]] | stdin/stdout/stderr, pipes, file redirection, /dev/null, here documents |
| [[command-chaining]] | Pipes, &&, ||, semicolons — connecting commands into pipelines |
| [[process-substitution]] | <() and >() — using command output as file arguments |
| [[brace-expansion-and-globbing]] | {a,b}, *.py, extglob — generating filenames and argument lists |
| [[defensive-scripting]] | set -euo pipefail, trap, error handling — writing production-safe scripts |
| [[command-history]] | history, Ctrl-R, !!, event designators — navigating and reusing past commands |

## Process Management

Monitoring and controlling running processes and system services.

| Note | Description |
|------|-------------|
| [[viewing-processes]] | ps, top, htop, pstree — inspecting what's running and resource usage |
| [[killing-processes]] | kill, pkill, SIGTERM/SIGKILL escalation — stopping runaway processes |
| [[system-resources]] | free, vmstat, iostat — memory, CPU, and disk I/O diagnostics |
| [[managing-services]] | systemctl, journalctl — managing systemd services, OOM kill detection |

## Networking

Testing connectivity, inspecting sockets, and working with HTTP APIs.

| Note | Description |
|------|-------------|
| [[connectivity-testing]] | ping, nc, dig, mtr — network diagnostics and database connectivity checks |
| [[socket-inspection]] | ss, netstat — port listening, connection states, TIME-WAIT analysis |
| [[http-requests-and-apis]] | curl with retry/timeout/timing — HTTP requests and API testing |
| [[firewalls]] | ufw, GCP firewall rules, Windows Firewall — network access control |
| [[iap-tunneling]] | GCP Identity-Aware Proxy — secure VM access without public IPs |
| [[connecting-to-gcp-resources]] | Connection guide for every GCP resource type |

## Key Concepts

- **[[grep-and-pattern-matching]]** — The single most-used text processing tool
- **[[awk-data-processing]]** — When you need column-based data transformation
- **[[sed-stream-editing]]** — When you need in-place file editing
- **[[defensive-scripting]]** — Non-negotiable for any script that runs in production

## Cross-References

- **SQL Server** — [[sqlcmd-connection-and-usage]] uses shell commands for database operations
- **GCP** — [[gcloud-authentication]] and the entire gcloud CLI is shell-based
- **Docker** — [[container-lifecycle]] commands are shell operations
- **Python** — python pipeline execution runs Python from shell scripts
- **Orchestration** — [[linux-scheduling|cron and crontab]] schedules shell commands

> *This table renders in Obsidian via Dataview. On the web, browse the notes listed above or use the Explorer sidebar.*
