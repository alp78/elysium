---
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell, bash, linux, powershell]
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
kill <PID>
kill -9 <PID>
```

#### pkill -f — kill by command line pattern

> [!danger] `pkill` without `-f` matches **process name only** (first 15 characters)
> `pkill python` kills every Python process on the system. Always use `-f` to match
> the full command line: `pkill -f "python run_pipeline"` targets only that specific
> script.

```bash
pkill -f "python run_pipeline"
```

> [!warning] `killall` is dangerous on macOS — it kills ALL processes
> On Linux, `killall python3` kills all processes named `python3`. On macOS/BSD,
> `killall` with no arguments kills **every process you own**. Prefer `pkill -f` for
> portability.

```bash
killall python3
```

#### kill -- -PGID — kill a process group (parent and all children)

> [!info] A negative PID signals the entire process group. Use this to kill a parent
> process and all its children at once (e.g., a bash script that spawned multiple
> subprocesses). Find the PGID with `ps -o pid,pgid,cmd -p <PID>`.

```bash
kill -- -<PGID>
```

### SIGTERM → strace → SIGKILL — the correct kill escalation sequence

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

### PowerShell — Stop-Process for graceful and forced termination

#### Stop-Process — graceful and forced termination

> [!info] Without `-Force`, `Stop-Process` sends a close request (equivalent to SIGTERM).
> With `-Force`, it terminates immediately (equivalent to SIGKILL).

```powershell
Stop-Process -Id <PID>
Stop-Process -Id <PID> -Force
```

#### Stop-Process -Name — kill by process name

> [!warning] `Stop-Process -Name "python"` kills ALL Python processes, same as `killall`.
> Use `Where-Object` on `CommandLine` to target a specific script.

```powershell
Get-Process | Where-Object { $_.CommandLine -like "*run_pipeline*" } |
    Stop-Process -Force
```

#### Stop-Process -Confirm — kill with safety prompt

```powershell
Get-Process -Name "python" | Stop-Process -Confirm
```

## Related
- [[viewing-processes]] — find the PID before killing
- [[managing-services]] — use `systemctl stop` for services (cleaner than `kill`)
- [[system-resources]] — confirm resource is released after killing
