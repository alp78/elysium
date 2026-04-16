---
title: "02 - Killing Processes — Graceful, Then Forceful"
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell, process-management]
aliases: [kill, pkill, killall, SIGTERM, SIGKILL, kill -9, stop process, terminate process]
keywords: [kill, pkill, killall, SIGTERM, SIGKILL, kill -9, stop process, terminate, signal, graceful shutdown, force kill, process group, PGID, strace, lock file cleanup, Stop-Process]
description: "Graceful and forceful process termination in Linux and PowerShell. Covers the correct kill escalation sequence (SIGTERM -> strace -> SIGKILL), pkill -f for pattern matching, process groups, and cleanup after force kills."
created: 2026-03-22
updated: 2026-04-15
status: complete
---

# Killing Processes — Graceful, Then Forceful

> [!quote] Escalation policy
>
> "Terminate by request when you can; terminate by force only when you must."
>
> — Operations rule of thumb

> [!abstract]- Summary
>
> Process termination is a scope problem first and a force problem second. Decide whether you are targeting one PID, a full command line, every matching executable name, a whole process group, or a local Windows process, then use the smallest command that matches that scope.
>
> - **Linux signal flow** — `kill` sends a signal to one PID, `pkill -f` matches a full command line, `killall` targets every process with one executable name, and negative PGIDs stop an entire job tree.
> - **Escalation discipline** — start with `SIGTERM`, inspect an unresponsive process with `strace -p`, and use `SIGKILL` only when the process will not exit cleanly in time.
> - **PowerShell semantics** — `Stop-Process` terminates local Windows processes; `-Force` suppresses confirmation prompts, not the termination mechanism.
> - **Operational safeguards** — verify PIDs immediately before killing, preview pattern matches with `pgrep -af`, and use service or database control planes instead of OS-level kills for managed services.
> - **Failure-mode diagnostics** — a process can ignore `SIGTERM`, `pkill` patterns can be too broad, `D`-state tasks do not die until kernel I/O returns, and zombie entries point to a parent that has not collected exit status yet.

> [!note]- Glossary
>
> **PID (process ID)**
>
> - The numeric identifier the kernel or operating system assigns to a running process.
> - Use it when you need to target exactly one process with `kill`, `ps`, or `Stop-Process -Id`.
> - Re-check the PID immediately before stopping anything because PIDs are reused.
>
> ---
>
> **Signal**
>
> - An asynchronous notification delivered to a Unix-like process by the kernel or by another process.
> - Use signals to request termination, pause execution, continue execution, or reload configuration.
> - Signal delivery is asynchronous; the process handles the signal when execution reaches a point where the kernel can deliver it.
>
> ---
>
> **SIGTERM (15)**
>
> - The default termination signal sent by `kill <PID>` and by `pkill` or `killall` when you do not specify another signal.
> - Use it first because it asks the process to exit cleanly and gives the application time to release resources.
> - A process can catch, delay, or ignore `SIGTERM`, so it is a request rather than a guarantee.
>
> ---
>
> **SIGKILL (9)**
>
> - A non-catchable, non-blockable signal that ends the target process immediately.
> - Use it only after a process has ignored or outlived a reasonable `SIGTERM` timeout.
> - `SIGKILL` skips application cleanup, so locks, partial writes, and recovery work can remain behind.
>
> ---
>
> **SIGHUP (1)**
>
> - A signal that historically meant "hang up" and is commonly repurposed by daemons as a configuration-reload request.
> - Use it when the daemon's documentation says `HUP` reloads configuration without a full restart.
> - On managed services, `systemctl reload <service>` is usually safer than sending `HUP` directly to a PID.
>
> ---
>
> **`kill`**
>
> - The standard Unix command for sending a signal to one or more explicit PIDs.
> - Use it when you already know the exact PID and want direct control over the signal you send.
> - `kill <PID>` sends `SIGTERM` by default; it does not imply `SIGKILL`.
>
> ---
>
> **`pkill`**
>
> - A Unix command that matches processes by name or by full command line and then sends them a signal.
> - Use `pkill -f` when the command line is the safest way to distinguish one process instance from another.
> - Always preview matches with `pgrep -af` before you send the signal because a broad pattern can match more processes than intended.
>
> ---
>
> **`killall`**
>
> - A Linux command from `psmisc` that sends a signal to every process with a matching executable name.
> - Use it only when every instance of that executable should stop.
> - Do not assume the same semantics outside Linux; prefer `pkill -f` in portable scripts.
>
> ---
>
> **`Stop-Process`**
>
> - The PowerShell cmdlet for terminating one or more local Windows processes by PID, by name, or from pipeline input.
> - Use it as the native Windows process-termination cmdlet when you are not controlling a Windows service.
> - `-Force` suppresses confirmation prompts; it does not create a Unix-style graceful-versus-forceful signal split.
>
> ---
>
> **Graceful shutdown**
>
> - A termination path that gives the application time to flush buffered output, release locks, close sockets, and persist consistent state.
> - Use it as the default stopping path for jobs, daemons, workers, and anything that owns state.
> - Skipping graceful shutdown increases the risk of stale lock files, partial writes, and crash recovery on the next start.
>
> ---
>
> **Process group (PGID)**
>
> - A Unix process-control grouping that lets one signal reach a parent shell and its related child processes together.
> - Use a negative PGID with `kill -- -<PGID>` when the operational unit is the whole job tree rather than a single PID.
> - Killing only the parent process can leave child processes running.
>
> ---
>
> **D-state (uninterruptible sleep)**
>
> - A Linux task state that means the process is blocked in kernel space, usually on storage or network-backed I/O.
> - Use it diagnostically when `kill -9` appears to have no effect.
> - The signal remains pending until the underlying I/O returns or fails, so repeated `kill -9` commands do not solve the problem.
>
> ---
>
> **Zombie process**
>
> - A process entry whose executable has already exited but whose parent has not yet collected the exit status with `wait()`.
> - Use it diagnostically to understand why a PID still appears in `ps` even though the process is no longer running.
> - Zombies do not consume CPU or memory, but they do indicate a broken parent-side cleanup path.

Process termination is safest when you define the target set first and choose force last. One PID, one command line, every executable name match, a whole process group, and a Windows process name are different scopes, and the right command depends on that scope.

Linux and PowerShell also use different mechanisms. Linux process control is signal-based, so `SIGTERM`, `SIGHUP`, and `SIGKILL` each mean something distinct. PowerShell's `Stop-Process` is not Unix signal delivery, so the documentation must separate the platforms instead of pretending they are the same tool with different syntax.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {'primaryColor': '#292e42','primaryTextColor': '#c0caf5','primaryBorderColor': '#565f89','lineColor': '#565f89','secondaryColor': '#1a1b26','tertiaryColor': '#24283b','noteTextColor': '#c0caf5','noteBkgColor': '#292e42','textColor': '#c0caf5','fontSize': '14px'}}}%%
flowchart TD
    A([Process stuck]) --> B[Send SIGTERM<br>kill PID]
    B --> C{Responded<br>within 30s?}
    C -- Yes --> D([Process exited cleanly])
    C -- No --> E[Diagnose with<br>strace -p PID]
    E --> F{Confirmed<br>stuck in syscall?}
    F -- Unblocked --> D
    F -- Still stuck --> G[Send SIGKILL<br>kill -9 PID]
    G --> H[Process force-terminated]
    H --> I[Manual cleanup:<br>lock files, shared memory,<br>DB transaction state]
    I --> J([Done])
```

## Linux process termination

### Linux | kill | signal a known PID

`kill` is the narrowest Linux termination tool because it only acts on the PID you name. That makes it the default choice when you already know the exact process you intend to stop and want to control the signal explicitly.

#### Request a clean exit with SIGTERM

Use `kill <PID>` first because the default signal is `SIGTERM`. The process has a chance to finish in-flight work and exit cleanly, and the exit code `143` in the capture below shows the shell observed termination by signal `15`.

*Run the commands in this section to request a clean exit with SIGTERM.*
```bash
sleep 300 &
pid=$!
ps -o pid,stat,comm -p "$pid"
kill "$pid"
wait "$pid"
status=$?
printf 'pid=%s exit=%s\n' "$pid" "$status"
```
```text
    PID STAT COMMAND
  30313 S+   sleep
pid=30313 exit=143
```

#### Escalate to SIGKILL only after a timeout

Use `kill -9` only after a process has ignored `SIGTERM` or outlived the timeout you assigned to a clean shutdown. The exit code `137` in the capture below is `128 + 9`, which confirms `SIGKILL`.

*Run the commands in this section to escalate to SIGKILL only after a timeout.*
```bash
sleep 300 &
pid=$!
kill -9 "$pid"
wait "$pid"
status=$?
printf 'pid=%s exit=%s\n' "$pid" "$status"
```
```text
pid=30315 exit=137
```

> [!danger] Database shutdown risk
>
> Do not use `kill` or `kill -9` as the normal shutdown path for database engines. Use the database or service control plane instead, such as `SHUTDOWN` for SQL Server, `pg_ctl stop` for PostgreSQL, or the service manager command that owns the process.

> [!success] Use the service control plane
>
> Stop database engines with the database-native shutdown or service-manager command that owns the process, then reserve `kill` for wrapper processes that no longer respond to that control plane.

| Syntax | Use |
|---|---|
| `kill <PID>` | Send `SIGTERM` to one PID. |
| `kill -15 <PID>` | Send explicit `SIGTERM`. |
| `kill -9 <PID>` | Send `SIGKILL` and bypass application cleanup. |
| `kill -HUP <PID>` | Send `SIGHUP` to daemons that reload config on `HUP`. |
| `kill -SIGSTOP <PID>` | Pause a process. |
| `kill -SIGCONT <PID>` | Resume a stopped process. |
| `kill -l` | List signal names and numbers. |

### Linux | pkill | match the full command line

`pkill` is appropriate when a PID is too narrow but a full executable-name sweep would be too broad. The safest pattern is `pgrep -af` to preview the full command line and `pkill -f` to signal only the command line you just verified.

#### Preview the full command line before killing by pattern

The capture below starts a uniquely marked Python process, lists it with `pgrep -af`, then terminates only that command line with `pkill -f`. This is the portable pattern for "kill the specific invocation, not every Python process."

*Run the commands in this section to preview the full command line before killing by pattern.*
```bash
python3 -c 'import time; time.sleep(300)' note-pkill-final-20260414 &
pid=$!
pgrep -af 'note-pkill-final-20260414'
pkill -f 'note-pkill-final-20260414'
wait "$pid"
status=$?
printf 'pid=%s exit=%s\n' "$pid" "$status"
```
```text
30316 python3 -c import time; time.sleep(300) note-pkill-final-20260414
pid=30316 exit=143
```

| Syntax | Use |
|---|---|
| `pgrep -af "<pattern>"` | Preview matching full command lines before signaling anything. |
| `pkill -f "<pattern>"` | Send `SIGTERM` to full command-line matches. |
| `pkill -9 -f "<pattern>"` | Send `SIGKILL` to full command-line matches. |
| `pkill -x "<name>"` | Match an exact process name. |
| `pkill -u <user> <name>` | Limit the match to one effective user. |
| `pkill -e -f "<pattern>"` | Echo the processes that were signaled. |

### Linux | killall | stop every instance by executable name

`killall` is the right tool only when every process with a given executable name should stop. This note documents the Linux `psmisc` implementation specifically; outside Linux, do not assume the same behavior, and prefer `pkill -f` when script portability matters.

#### Kill every matching executable name in a Linux-only context

The live capture below runs two `sleep` processes inside an isolated PID namespace and then stops both with `killall sleep`. The isolated namespace keeps the demonstration from touching unrelated processes on the host.

*Run the commands in this section to kill every matching executable name in a Linux-only context.*
```bash
unshare --user --map-root-user --pid --fork --mount-proc bash -lc '
  sleep 300 & pid1=$!
  sleep 300 & pid2=$!
  ps -o pid,comm,args -p "$pid1","$pid2"
  killall sleep
  wait "$pid1"; s1=$?
  wait "$pid2"; s2=$?
  printf "pid1=%s exit1=%s\npid2=%s exit2=%s\n" "$pid1" "$s1" "$pid2" "$s2"
'
```
```text
    PID COMMAND         COMMAND
      7 sleep           sleep 300
      8 sleep           sleep 300
pid1=7 exit1=143
pid2=8 exit2=143
```

| Syntax | Use |
|---|---|
| `killall <name>` | Send `SIGTERM` to every process with that executable name. |
| `killall -9 <name>` | Send `SIGKILL` to every matching executable name. |
| `killall -u <user> <name>` | Limit the match to one user. |
| `killall -w <name>` | Wait for every matched process to exit. |
| `killall -e <name>` | Require an exact executable-name match. |

### Linux | process groups | stop the whole job tree

When one shell command starts several child processes, the operational unit is often the whole process group rather than one PID. A negative PGID lets you terminate the parent and its children with one signal.

#### Signal the whole process group with a negative PGID

The capture below starts a detached shell that owns two `sleep` children, prints the shared PGID, then sends `SIGTERM` to the whole group with `kill -- -<PGID>`.

> [!info] `--` protects the negative PGID
>
> A negative PID means "target this process group", but a leading `-` also looks like another command-line option to `kill`. `kill -- -"$pgid"` stops option parsing first, which keeps the group ID from being misread as a signal selector by shell builtins or wrapper scripts.

*Run the commands in this section to signal the whole process group with a negative PGID.*
```bash
setsid bash -c 'sleep 300 & sleep 300 & wait' &
parent=$!
sleep 1
pgid=$(ps -o pgid= -p "$parent" | tr -d ' ')
ps -o pid,pgid,comm --sort pid -g "$pgid"
kill -- -"$pgid"
wait "$parent"
status=$?
printf 'parent=%s pgid=%s exit=%s\n' "$parent" "$pgid" "$status"
```
```text
    PID    PGID COMMAND
  30379   30379 bash
  30384   30379 sleep
  30385   30379 sleep
parent=30379 pgid=30379 exit=143
```

| Syntax | Use |
|---|---|
| `ps -o pid,pgid,cmd -p <PID>` | Inspect the PGID of one process. |
| `kill -- -<PGID>` | Send `SIGTERM` to the entire process group. |
| `kill -9 -- -<PGID>` | Send `SIGKILL` to the entire process group. |

### Linux | escalation diagnostics | inspect before forcing

Blind `kill -9` hides root causes. If a process will not exit, inspect what it is doing before you decide the process itself is the problem.

#### Attach `strace -p` before escalating blindly

`strace -p` shows the system call the process is blocked in. On the WSL host used for this note, non-root attach was blocked by ptrace policy, so the live capture below was run with root privileges. The important point is that the output tells you what the process is waiting on before you escalate.

*Run the commands in this section to attach `strace -p` before escalating blindly.*
```bash
sleep 300 &
pid=$!
sudo timeout 1 strace -p "$pid" 2>&1 | sed -n '1,3p'
kill "$pid"
wait "$pid"
```
```text
strace: Process 30405 attached
restart_syscall(<... resuming interrupted read ...>strace: Process 30405 detached
 <detached ...>
```

## PowerShell process termination

### PowerShell | Stop-Process | terminate local processes

`Stop-Process` is the PowerShell cmdlet for terminating local Windows processes. It is not Unix signal delivery, and there is no `SIGTERM`-versus-`SIGKILL` split here. Microsoft documents `-Force` as a way to suppress confirmation prompts, especially for processes not owned by the current user, not as a separate termination mechanism.

#### Stop one PID and verify that it exited

The example below starts a temporary `pwsh` process, stops it by PID, returns the stopped process object with `-PassThru`, and verifies that the PID is gone.

*Run the commands in this section to stop one PID and verify that it exited.*
```powershell
$PSStyle.OutputRendering = 'PlainText'
$p = Start-Process pwsh -ArgumentList '-NoLogo','-NoProfile','-Command','Start-Sleep -Seconds 300 # note-demo-stop-id' -PassThru -WindowStyle Hidden
Start-Sleep -Milliseconds 700
Stop-Process -Id $p.Id -PassThru |
    Select-Object Id, ProcessName, HasExited |
    Format-Table -AutoSize
$count = @(Get-Process -Id $p.Id -ErrorAction SilentlyContinue).Count
"remaining=$count"
```
```text
   Id ProcessName HasExited
   -- ----------- ---------
42820 pwsh             True

remaining=0
```

#### Use `-Name` only when every matching process should stop

`Stop-Process -Name` behaves like a Windows-wide name match, so it is only safe when every matching process is disposable. The capture below starts two `PING` processes, lists them, and then stops both by name.

*Run the commands in this section to use `-Name` only when every matching process should stop.*
```powershell
$PSStyle.OutputRendering = 'PlainText'
$p1 = Start-Process ping -ArgumentList '127.0.0.1','-t' -PassThru -WindowStyle Hidden
$p2 = Start-Process ping -ArgumentList '127.0.0.1','-t' -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 1
Get-Process -Name ping |
    Where-Object { $_.Id -in @($p1.Id, $p2.Id) } |
    Select-Object Id, ProcessName |
    Sort-Object Id |
    Format-Table -AutoSize
Stop-Process -Name ping -PassThru |
    Where-Object { $_.Id -in @($p1.Id, $p2.Id) } |
    Select-Object Id, ProcessName, HasExited |
    Sort-Object Id |
    Format-Table -AutoSize
```
```text
   Id ProcessName
   -- -----------
26980 PING
37816 PING


   Id ProcessName HasExited
   -- ----------- ---------
26980 PING             True
37816 PING             True
```

| Syntax | Use |
|---|---|
| `Stop-Process -Id <PID>` | Stop one process by PID. |
| `Stop-Process -Name "<name>"` | Stop every local process with that name. |
| `Stop-Process -PassThru` | Return the stopped process object. |
| `Stop-Process -WhatIf` | Preview the stop without running it. |
| `Stop-Process -Confirm` | Force a confirmation prompt before the stop. |
| `Stop-Process -Force` | Suppress confirmation when PowerShell would otherwise prompt; it does not change the termination mechanism. |
| `Stop-Process -ErrorAction SilentlyContinue` | Suppress errors for missing or already-exited processes. |

### PowerShell | selective targeting | narrow the target set before stopping

When several instances share one process name, filter the process list before you stop anything. `CommandLine` is usually the most precise discriminator for ad hoc scripts and workers.

#### Match the exact instance by `CommandLine`

This example starts a marked `pwsh` process, filters the `pwsh` process list by `CommandLine`, prints only the matching instance, and then stops it. The final `remaining=0` line confirms that the targeted PID is gone.

*Run the commands in this section to match the exact instance by `CommandLine`.*
```powershell
$PSStyle.OutputRendering = 'PlainText'
$p = Start-Process pwsh -ArgumentList '-NoLogo','-NoProfile','-Command','Start-Sleep -Seconds 300 # note-demo-filter' -PassThru -WindowStyle Hidden
Start-Sleep -Milliseconds 700
Get-Process -Name pwsh |
    Where-Object { $_.Id -ne $PID -and $_.CommandLine -like '*note-demo-filter*' } |
    Select-Object Id, ProcessName, CommandLine |
    Format-Table -Wrap
Stop-Process -Id $p.Id
$count = @(Get-Process -Id $p.Id -ErrorAction SilentlyContinue).Count
"remaining=$count"
```
```text
   Id ProcessName CommandLine
   -- ----------- -----------
27404 pwsh        "C:\Program Files\PowerShell\7\pwsh.exe" -NoLogo -NoProfile -Command Start-Sleep -Seconds 300 #
                  note-demo-filter

remaining=0
```

If `CommandLine` is blank because access to another user's process is restricted, switch to `Get-CimInstance Win32_Process` to inspect owner and command-line metadata before you stop anything.

| Property or switch | Use |
|---|---|
| `CommandLine` | Filter one instance by its full invocation string. |
| `Id` | Target a single PID precisely. |
| `Path` | Confirm which executable image is running. |
| `CPU` | Spot runaway processes before termination. |
| `WorkingSet` | Check memory pressure before deciding to stop the process. |

## Recommended operational paths

### Linux | recommended paths

When the process is a daemon or the issue is a bound port rather than a hung worker, the best command is often not `kill`. Choose the operational path that matches the problem.

#### Reload a daemon with `SIGHUP` instead of killing it

For daemons that document `SIGHUP` as a reload signal, `kill -HUP` is a configuration refresh, not a shutdown. The live capture below starts a Python process with a `SIGHUP` handler, sends `HUP`, and shows the handler running without a forced kill.

*Run the commands in this section to reload a daemon with `SIGHUP` instead of killing it.*
```bash
python3 - <<'PY' &
import signal
import sys
import time

def handle_hup(signum, frame):
    print("hup-handled")
    sys.stdout.flush()
    raise SystemExit(0)

signal.signal(signal.SIGHUP, handle_hup)
print("ready")
sys.stdout.flush()
time.sleep(300)
PY
pid=$!
sleep 1
kill -HUP "$pid"
wait "$pid"
status=$?
printf 'pid=%s exit=%s\n' "$pid" "$status"
```
```text
ready
hup-handled
pid=30337 exit=0
```

#### Free a listening port after identifying the owner

If a port is the operational symptom, inspect the listener first and then kill the owner explicitly. `fuser -k` is effective, but it is broad for that port, so the safety step is the `ss` inspection immediately before the kill.

*Run the commands in this section to free a listening port after identifying the owner.*
```bash
python3 -m http.server 18181 >/dev/null 2>&1 &
pid=$!
sleep 1
ss -H -ltnp '( sport = :18181 )'
fuser -k 18181/tcp >/dev/null 2>&1
wait "$pid"
status=$?
out=$(ss -H -ltnp '( sport = :18181 )')
if [ -n "$out" ]; then
  printf '%s\n' "$out"
else
  printf 'port 18181 no longer has a listening process\n'
fi
printf 'pid=%s exit=%s\n' "$pid" "$status"
```
```text
LISTEN 0      5      0.0.0.0:18181 0.0.0.0:* users:(("python3",pid=30339,fd=3))
port 18181 no longer has a listening process
pid=30339 exit=137
```

Use service or database control planes instead of raw process kills for managed workloads. `systemctl stop`, `Stop-Service`, `pg_ctl stop`, and database-native shutdown commands preserve the coordination logic that a direct PID kill bypasses.

### PowerShell | recommended paths

PowerShell can preview a stop before it runs it. Use that preview when the target name is shared, when a wildcard is involved, or when you want to confirm the PID set before terminating anything.

#### Preview a broad stop with `-WhatIf`

`-WhatIf` is the PowerShell-native dry run. The capture below shows the exact target PowerShell would stop without actually terminating it at preview time.

*Run the commands in this section to preview a broad stop with `-WhatIf`.*
```powershell
$PSStyle.OutputRendering = 'PlainText'
$p = Start-Process pwsh -ArgumentList '-NoLogo','-NoProfile','-Command','Start-Sleep -Seconds 300 # note-demo-whatif' -PassThru -WindowStyle Hidden
Start-Sleep -Milliseconds 700
Stop-Process -Id $p.Id -WhatIf
Stop-Process -Id $p.Id
```
```text
What if: Performing the operation "Stop-Process" on target "pwsh (17400)".
```

For Windows services, prefer `Stop-Service` or the service-specific control plane. `Stop-Process` is for local processes, not for clean service shutdown orchestration.

## Troubleshooting

### Linux | troubleshooting

These failure modes explain why a stop command may appear to do nothing, may stop too much, or may leave residual state behind.

#### `SIGTERM` was ignored and the process stayed alive

Some processes trap or ignore `SIGTERM`. The capture below starts a shell that ignores `TERM`, shows that it is still present after the signal, and then removes it with `SIGKILL`.

*Run the commands in this section to `SIGTERM` was ignored and the process stayed alive.*
```bash
bash -c 'trap "" TERM; while :; do sleep 1; done' &
pid=$!
sleep 1
kill "$pid"
sleep 1
ps -o pid,stat,comm,args -p "$pid"
kill -9 "$pid"
wait "$pid"
status=$?
printf 'pid=%s final_exit=%s\n' "$pid" "$status"
```
```text
    PID STAT COMMAND         COMMAND
  30344 R+   bash            bash -c trap "" TERM; while :; do sleep 1; done
pid=30344 final_exit=137
```

#### The `pkill` pattern was too broad

`pkill` matches every process that satisfies the pattern you give it. The capture below starts two differently marked Python processes and then kills both with one broad pattern, which is exactly why `pgrep -af` preview is mandatory before the signal step.

*Run the commands in this section to the `pkill` pattern was too broad.*
```bash
python3 -c 'import time; time.sleep(300)' note-broad-one &
pid1=$!
python3 -c 'import time; time.sleep(300)' note-broad-two &
pid2=$!
pgrep -af 'note-broad-'
pkill -f 'note-broad-'
wait "$pid1"
status1=$?
wait "$pid2"
status2=$?
printf 'pid1=%s exit1=%s\npid2=%s exit2=%s\n' "$pid1" "$status1" "$pid2" "$status2"
```
```text
30678 python3 -c import time; time.sleep(300) note-broad-one
30679 python3 -c import time; time.sleep(300) note-broad-two
pid1=30678 exit1=143
pid2=30679 exit2=143
```

#### `kill -9` had no visible effect because the task was in `D` state

If `kill -9` appears ineffective, inspect the process state instead of retrying the same signal. The live check below found no `D`-state tasks on the current host, but the command is the one you use to confirm whether the problem is blocked kernel I/O.

*Run the commands in this section to `kill -9` had no visible effect because the task was in `D` state.*
```bash
out=$(ps -eo pid,stat,wchan:24,comm | awk '$2 ~ /^D/ { print }')
if [ -n "$out" ]; then
  printf '%s\n' "$out"
else
  printf 'no D-state processes found\n'
fi
```
```text
no D-state processes found
```

#### The process exited but a zombie entry remained

If a process is gone but still visible as `Z`, the parent has not collected the exit status yet. The command below checks for zombie entries directly; on the current host it returned none.

*Run the commands in this section to the process exited but a zombie entry remained.*
```bash
out=$(ps -eo pid,ppid,stat,comm | awk '$3 ~ /^Z/ { print }')
if [ -n "$out" ]; then
  printf '%s\n' "$out"
else
  printf 'no zombie processes found\n'
fi
```
```text
no zombie processes found
```

### PowerShell | troubleshooting

The most common PowerShell failure mode is not a missing signal; it is a permission boundary. When access is denied, fix the execution context instead of retrying the same stop command repeatedly.

#### `Stop-Process` returned access denied

The example below safely reproduces the error by attempting to stop the Windows `Idle` process. That is the expected signal that the process is protected or owned by a higher-privilege context.

*Run the commands in this section to `Stop-Process` returned access denied.*
```powershell
$PSStyle.OutputRendering = 'PlainText'
try {
    Stop-Process -Name Idle -ErrorAction Stop
} catch {
    $_.Exception.Message
}
```
```text
Cannot stop process "Idle (0)" because of the following error: Access is denied.
```

## Cross-references

- [viewing-processes](https://alp78.github.io/elysium/01-Shell/Process-Management/viewing-processes) — find the right PID, PGID, or command line before sending a signal
- [managing-services](https://alp78.github.io/elysium/01-Shell/Process-Management/managing-services) — use service managers instead of raw PID termination for managed services
- [system-resources](https://alp78.github.io/elysium/01-Shell/Process-Management/system-resources) — verify that ports, files, and memory segments were actually released
