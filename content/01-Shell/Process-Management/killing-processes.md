---
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell, bash]
aliases: [kill, pkill, killall, SIGTERM, SIGKILL, kill -9, stop process, terminate process]
keywords: [kill, pkill, killall, SIGTERM, SIGKILL, kill -9, stop process, terminate, signal, graceful shutdown, force kill, process group, PGID, strace, lock file cleanup, Stop-Process]
description: "Graceful and forceful process termination in Linux and PowerShell. Covers the correct kill escalation sequence (SIGTERM → strace → SIGKILL), pkill -f for pattern matching, process groups, and cleanup after force kills."
related: ["[[viewing-processes]]", "[[managing-services]]", "[[system-resources]]" ]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Killing Processes — Graceful, Then Forceful

When a pipeline process is stuck — an infinite loop, a hanging database connection, a deadlocked worker — you need to terminate it. The order of escalation matters: graceful first (let the process clean up), forceful only as a last resort. `kill -9` without trying SIGTERM first causes data corruption, orphaned lock files, and unrolled transactions.

## Linux — kill, pkill, killall

> [!info] SIGTERM (signal 15) — graceful shutdown
> Docker uses the same SIGTERM→SIGKILL escalation — see [[container-lifecycle]]. The process can:
> 1. Flush buffers and close file handles
> 2. Commit or rollback database transactions
> 3. Release locks
> 4. Write a clean shutdown message to logs
> 5. Exit with a clean exit code
>
> Always try SIGTERM first. Wait 10-30 seconds for the process to respond.

> [!danger] SIGKILL (signal 9) — force kill
> The kernel terminates the process **immediately** — no chance to clean up:
> - Open files may be corrupted (half-written)
> - Database transactions are NOT rolled back (the DB server does it later)
> - Lock files are NOT removed (manual cleanup needed)
> - Shared memory segments are NOT freed
>
> **Only use `-9` when SIGTERM doesn't work after waiting.**

```bash
kill <PID>              # SIGTERM — graceful shutdown
kill -9 <PID>           # SIGKILL — force kill (last resort)

# Kill by name
pkill -f "python run_pipeline"   # -f = match full command line, not just process name
# Without -f: pkill python would kill ALL python processes (dangerous!)

killall python3         # SIGTERM to every process named exactly "python3"
# DANGER: kills ALL python3 processes for ALL users — prefer pkill -f

# Kill a process group (parent and all children)
kill -- -<PGID>         # negative PID signals the entire process group
# Find PGID: ps -o pid,pgid,cmd -p <PID>
```

## The Correct Kill Escalation

> [!tip] The Correct Kill Escalation
> ```
> kill <PID>              # SIGTERM — ask nicely (wait 10-30 seconds)
>   ↓ (no response)
> kill -15 <PID>          # Same thing, explicit signal number (sometimes retry helps)
>   ↓ (no response)
> strace -p <PID>         # Is it stuck in a syscall? What is it waiting for?
>   ↓ (confirmed stuck)
> kill -9 <PID>           # Nuclear option — force kill
>   ↓ (process gone)
> # Clean up: remove lock files, check for corrupted files, verify DB state
> ```
> Before reaching for `-9`, always try to understand WHY the process is stuck. `strace -p <PID>` attaches to the process and shows what system calls it's making — if it's stuck in `read()` on a socket, the problem is network or the remote server, not the local process.

> [!warning] After a Force Kill — Always Check for Remnants
> After `kill -9`, manually check for:
> - Lock files left in `/var/run/`, `/tmp/`, or the application's data directory
> - Shared memory segments: `ipcs -m` (list), `ipcrm -m <shmid>` (remove)
> - Incomplete writes: check file sizes and checksums
> - Database transaction state: look for open transactions in `sys.dm_exec_sessions` -- if a SQL Server process is the victim, check [[deadlock-detection-and-prevention]] for proper KILL session handling

## PowerShell

```powershell
# Graceful stop
Stop-Process -Id <PID>

# Force kill
Stop-Process -Id <PID> -Force

# Kill by name
Stop-Process -Name "python" -Force

# Kill by pattern (matching command line)
Get-Process | Where-Object { $_.CommandLine -like "*run_pipeline*" } | Stop-Process -Force

# Kill with confirmation
Get-Process -Name "python" | Stop-Process -Confirm
# -Confirm = prompt before each kill (safety net)
```

## Related
- [[viewing-processes]] — find the PID before killing
- [[managing-services]] — use `systemctl stop` for services (cleaner than `kill`)
- [[system-resources]] — confirm resource is released after killing
