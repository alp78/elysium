---
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell, bash, linux, powershell]
aliases: [ps aux, htop, top, pstree, process list, process monitoring, iostat, docker stats]
keywords: [ps aux, htop, top, pstree, process list, PID, CPU usage, memory usage, RSS, VSZ, zombie process, D state, uninterruptible sleep, iostat, docker stats, process tree, uptime, load average, free memory]
description: "Linux and PowerShell commands for viewing running processes, understanding resource usage, and diagnosing system performance issues. Covers ps aux, htop, top, pstree, and the D state (uninterruptible sleep) that cannot be killed."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Viewing Processes — Understanding What Is Running

When an Airflow VM is slow, a query is hanging, or a runaway process is pinning the CPU — your first move is always to understand what is running. `ps aux` gives you the snapshot; `htop` gives you the real-time picture; `iostat` tells you if the disk is the bottleneck.

> [!quote]
> "You can have a second computer once you've shown you know how to use the first one."
> — **Paul Barham**

## Linux — ps, top, htop, pstree

> [!info] ps aux flags
>
> - `a` — show processes from all users
> - `u` — user-oriented format (USER, PID, %CPU, %MEM, VSZ, RSS, TTY, STAT, START, TIME, COMMAND)
> - `x` — include processes without a controlling terminal (daemons, background jobs)

> [!info] Important columns
>
> - **PID** — process ID (needed for `kill`)
> - **%CPU** — CPU usage percentage (can exceed 100% on multi-core)
> - **%MEM** — percentage of physical memory used
> - **RSS** — Resident Set Size in KB (actual RAM used — the number that matters)
> - **VSZ** — Virtual memory size (includes shared libraries — misleadingly large)
> - **STAT** — process state: `S`=sleeping, `R`=running, `D`=uninterruptible sleep (IO wait), `Z`=zombie
> - **TIME** — cumulative CPU time consumed since start
> - **COMMAND** — full command line (most useful for identification)

```bash
ps aux
```

#### ps aux | grep — find a specific process

> [!warning] grep matches itself in ps output
>
> `ps aux | grep mssql` always shows the `grep mssql` process too. Use the bracket
> trick: `ps aux | grep "[m]ssql"` — the regex `[m]ssql` matches `mssql` but not the
> literal string `[m]ssql` in grep's own command line.

```bash
ps aux | grep "[m]ssql"
```

#### pstree -p — show parent-child process relationships

> [!info] Process tree relationships
>
> Shows which process spawned which — critical for understanding if a Python
> process is a child of Airflow (scheduled) or a manual run (someone's SSH session).

```bash
pstree -p
```

#### top — real-time resource monitoring

```bash
top
```

> [!tip] Interactive commands in top
>
> - `P` — sort by CPU (default)
> - `M` — sort by memory
> - `k` — kill a process (enter PID when prompted)
> - `c` — toggle full command line
> - `1` — show per-CPU breakdown (one core maxed while others idle = single-threaded bottleneck)
> - `q` — quit

> [!tip] htop is better top
>
> - `F5` — toggle tree view
> - `F6` — choose sort column
> - `F9` — kill signal selection menu
> - Color-coded, mouse support, tree view, horizontal scrolling for long command lines

```bash
# htop
htop
```

### Diagnosing a slow Airflow VM — ps, docker stats, iostat workflow

```bash
# Step 1: Quick overview
free -h && uptime
# free -h: check memory (is it exhausted? is swap being used?)
# uptime: check load average (is it above the CPU count?)

# Step 2: Identify the resource hog
ps aux --sort=-%mem | head -10    # top 10 by memory
ps aux --sort=-%cpu | head -10    # top 10 by CPU

# Step 3: Docker-specific (if services run in containers)
sudo docker stats --no-stream
# Shows: CPU%, MEM USAGE/LIMIT, MEM%, NET I/O, BLOCK I/O for each container
# --no-stream = print once and exit (vs. real-time updates)

# Step 4: Is the disk the bottleneck?
iostat -xz 2 3    # -x = extended stats, -z = suppress zero-activity, 2 3 = every 2s × 3 samples
```

> [!info] iostat key columns
>
> - **await** — average I/O wait time in ms (>20ms = slow disk)
> - **%util** — percentage of time the device is busy (>80% = saturated)
> - If `%util` is 100%, your pipeline is I/O bound — no amount of CPU optimization will help

### The D state — uninterruptible sleep processes that cannot be killed

> [!warning] D state processes cannot be killed
>
> If you see processes in state `D` in `ps aux`, they are waiting for I/O and **cannot be killed** — not even with `kill -9`. They will stay until the I/O completes or the kernel gives up. Common causes:
> 1. NFS mount hung (network storage is unreachable)
> 2. Disk hardware failure (the drive isn't responding)
> 3. Kernel bug (rare but real)
>
> If you have many `D` state processes, check `dmesg | tail -50` for kernel-level errors. This is a system-level problem, not something you can fix from userspace.

### PowerShell — Get-Process, Get-CimInstance for process and system monitoring

#### Get-Process — top processes by CPU or memory

```powershell
Get-Process | Sort-Object CPU -Descending | Select-Object -First 20 Name, Id, CPU,
    @{N='Mem(MB)';E={[math]::Round($_.WorkingSet64/1MB)}}
```

#### Get-Process -Name — find a specific process

```powershell
Get-Process -Name "sqlservr" -ErrorAction SilentlyContinue
```

#### Get-Process | Where-Object — find memory-hungry processes

```powershell
Get-Process | Where-Object { $_.WorkingSet64 -gt 500MB } |
    Format-Table Name, Id, @{N='Mem(MB)';E={[math]::Round($_.WorkingSet64/1MB)}} -AutoSize
```

#### Get-CimInstance — CPU, memory, and uptime overview

```powershell
Get-CimInstance -ClassName Win32_Processor |
    Select-Object Name, NumberOfCores, NumberOfLogicalProcessors
```

```powershell
$os = Get-CimInstance Win32_OperatingSystem
"Total: {0:N1} GB | Free: {1:N1} GB | Used: {2:N0}%" -f
    ($os.TotalVisibleMemorySize/1MB),
    ($os.FreePhysicalMemory/1MB),
    ((1 - $os.FreePhysicalMemory/$os.TotalVisibleMemorySize) * 100)
```

## Related
- [killing-processes](https://alp78.github.io/elysium/01-Shell/Process-Management/killing-processes) — what to do once you find the problematic process
- [system-resources](https://alp78.github.io/elysium/01-Shell/Process-Management/system-resources) — deeper memory, CPU, and disk I/O analysis
- [managing-services](https://alp78.github.io/elysium/01-Shell/Process-Management/managing-services) — checking systemd service status and logs
- [reading-file-contents](https://alp78.github.io/elysium/01-Shell/Text-Processing/reading-file-contents) — reading service logs after identifying the issue
