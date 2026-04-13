---
title: "03 - Managing Services"
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell, process-management]
aliases: [systemctl, journalctl, service management, systemd, daemon, OOM kill, service restart]
keywords: [systemctl, journalctl, systemd, service, daemon, start service, stop service, restart service, enable on boot, service logs, OOM killer, out of memory, service status, mssql-server, datadog-agent, airflow, service failed, Set-Service, Start-Service]
description: "Managing Linux systemd services and Windows services for production data engineering infrastructure. Covers start/stop/restart/enable, reading service logs with journalctl, diagnosing OOM kills, and the PowerShell equivalents."
created: 2026-03-22
updated: 2026-04-03
status: complete
---

# Managing Services

> [!quote]
> "systemd is never finished, never complete, but tracking progress of technology."
>
> — **Lennart Poettering** (creator of systemd)

> [!abstract]- Summary
>
> Linux and Windows infrastructure services are long-running background processes managed by init systems — systemd on Linux, Service Control Manager on Windows. This note covers the full operational lifecycle of both platforms.
>
> - **Linux systemctl and journalctl tools** — start, stop, restart, enable, disable, mask, and inspect services; read and filter the structured journal; diagnose OOM kills with `dmesg` and `journalctl -k`
> - **PowerShell Windows Services tools** — `Get-Service`, `Start-Service`, `Stop-Service`, `Restart-Service`, `Set-Service`, `sc.exe`; query event logs with `Get-WinEvent`
> - **When to use service management tools** — restarting after config changes, diagnosing failures, enabling boot persistence, blocking dangerous services
> - **When not to use service management tools** — application-level reloads, container orchestration, one-shot scheduled scripts
> - **Warnings** — connection interruption on database restarts, `start` vs `enable` independence, `sc` alias trap in PowerShell, `daemon-reload` requirement after unit file edits
> - **Recommendations** — per-scenario command reference table
> - **Troubleshooting** — symptom → cause → fix table for the most common service failures

> [!note]- Glossary
>
> **Service / Daemon**
> - A long-running background process managed by the operating system's service manager rather than launched manually for one interactive session.
> - Used to run infrastructure components continuously, such as databases, web servers, schedulers, and agents, typically across reboots and user logouts.
>
> > [!info] Services vs one-shot commands
> >
> > A service is registered with a service manager and can usually be started, stopped, restarted, and monitored as a managed unit. A one-shot command runs once and exits, even if it runs for a long time.
>
> ---
>
> **`systemctl`**
> - Primary command-line tool for managing `systemd` units on modern Linux systems, including starting, stopping, restarting, reloading, enabling, disabling, masking, and inspecting services.
> - Used as the operational interface for controlling service lifecycle and checking whether a service is running now and configured to start at boot.
>
> > [!warning] `start` and `enable` are independent
> >
> > `start` affects the current runtime state; `enable` affects boot-time behavior. Use `systemctl enable --now <service>` when you need both.
>
> ---
>
> **`journalctl`**
> - Command-line viewer for the `systemd` journal, which stores structured logs for services, the kernel, and other system components.
> - Used to inspect service startup failures, crash loops, restart events, and recent logs without needing separate flat log files.
>
> > [!tip] Always filter by unit
> >
> > `journalctl` without filters can be overwhelming. `journalctl -u <service> -f` is the usual way to follow logs for one service only.
>
> ---
>
> **Unit file**
> - A `systemd` configuration file that defines how a unit such as a service, timer, or socket should be started, ordered, stopped, and supervised.
> - Used to declare service behavior, including the executable, restart policy, dependencies, environment, and startup conditions.
>
> > [!warning] Edit overrides, not package defaults
> >
> > Vendor unit files usually live under `/usr/lib/systemd/system/` or `/lib/systemd/system/`, depending on the distribution. Do not edit them directly; create overrides under `/etc/systemd/system/` or use `systemctl edit <service>`, then run `systemctl daemon-reload`.
>
> ---
>
> **Service state**
> - Runtime or management status reported by the service manager, such as `active`, `inactive`, `failed`, `activating`, `deactivating`, or `masked`.
> - Used to distinguish whether a service is currently running, stopped cleanly, failed during startup or runtime, or deliberately blocked from being started.
>
> > [!info] `inactive` does not mean broken
> >
> > A service can be `inactive` because it is intentionally stopped or because it is a one-shot unit that completed successfully. `masked` specifically means startup is administratively blocked.
>
> ---
>
> **OOM killer**
> - Linux kernel mechanism that terminates one or more processes when memory pressure becomes severe enough that the system cannot satisfy allocation safely.
> - Used by the kernel as a last-resort protection mechanism to keep the whole machine alive when memory exhaustion would otherwise cause wider failure.
>
> > [!warning] OOM kills may not appear clearly in unit-scoped logs
> >
> > The decisive evidence is usually in kernel logs rather than only in `journalctl -u <service>`. Cross-check with `journalctl -k` or `dmesg` when a service dies or restarts unexpectedly under memory pressure.
>
> ---
>
> **`Get-Service` / `Set-Service`**
> - PowerShell cmdlets for interacting with the Windows Service Control Manager: `Get-Service` reads service status, while `Set-Service` changes properties such as startup type.
> - Used for Windows service administration from scripts and shells, alongside `Start-Service`, `Stop-Service`, and `Restart-Service` for runtime control.
>
> > [!info] Startup type vs running state are independent on Windows
> >
> > A service can be configured for automatic startup and still be currently stopped, or configured as manual and currently running. Treat runtime status and startup configuration as separate facts.
>
> ---
>
> **`sc.exe`**
> - Native Windows Service Control command-line utility for querying, creating, deleting, and configuring services.
> - Used when low-level service operations are needed that are awkward or unavailable through standard PowerShell service cmdlets.
>
> > [!warning] `sc` is a PowerShell alias for `Set-Content`
> >
> > In PowerShell, `sc` does not call the Service Control utility. Use `sc.exe` explicitly to avoid invoking the alias by mistake.
>
> ---
>
> **`Get-WinEvent`**
> - PowerShell cmdlet for querying Windows Event Log records from the System log and provider-specific logs.
> - Used as the main Windows equivalent of `journalctl` for diagnosing service starts, stops, crashes, recovery actions, and related OS events.
>
> > [!info] Key event IDs for service diagnostics
> >
> > `7036` records service state changes, `7034` indicates unexpected termination, `7031` indicates a service failure with Service Control Manager recovery action, and `2004` is associated with severe resource exhaustion events.

Every long-running process in your infrastructure — SQL Server, Airflow, Datadog agent, Docker daemon — runs as a systemd service on Linux or a Windows Service on Windows. Understanding service management is how you restart a crashed database, check why a monitoring agent stopped collecting metrics, or enable a new service to survive reboots. For Airflow-specific service management (scheduler, worker, webserver), see [airflow-core-concepts](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-core-concepts).

The diagram below shows the full service lifecycle and the commands that drive each transition.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {'primaryColor': '#292e42','primaryTextColor': '#c0caf5','primaryBorderColor': '#565f89','lineColor': '#565f89','secondaryColor': '#1a1b26','tertiaryColor': '#24283b','noteTextColor': '#c0caf5','noteBkgColor': '#292e42','textColor': '#c0caf5','fontSize': '14px'}}}%%
stateDiagram-v2
    [*] --> Inactive : service installed
    Inactive --> Activating : start
    Activating --> Active : ExecStart completes
    Active --> Reloading : reload (SIGHUP)
    Reloading --> Active : ExecReload completes
    Active --> Deactivating : stop / restart
    Deactivating --> Inactive : ExecStop completes
    Inactive --> Inactive : enable (symlink only)
    Active --> Failed : crash / OOM kill
    Failed --> Activating : start (manual recovery)
```


## Linux systemctl and journalctl tools

systemd is the init system and service manager for most modern Linux distributions. Every service is described by a unit file stored in `/etc/systemd/system/` or `/lib/systemd/system/`. The `systemctl` command controls service state; `journalctl` reads the structured log journal that systemd writes for every unit.

### Linux | systemctl | control service lifecycle

The `start`, `stop`, and `restart` subcommands are the primary controls for a service's runtime state. They operate immediately, without waiting for a reboot.

#### Start a service

`systemctl start` sends a start signal and runs the command defined in `ExecStart` inside the unit file. The command returns once the service has entered the `active` state.

```bash
sudo systemctl start mssql-server
```

#### Stop a service

`systemctl stop` sends `SIGTERM` to the main process (and `SIGKILL` after a configurable timeout if it does not exit). All resources held by the service are released.

```bash
sudo systemctl stop mssql-server
```

#### Restart a service

`systemctl restart` stops then starts the service in a single operation. All active connections are terminated and in-flight transactions are rolled back.

```bash
sudo systemctl restart mssql-server
```

> [!warning] Restart drops all connections
>
> `systemctl restart mssql-server` stops then starts the service — all database connections are terminated. In-flight queries are killed, uncommitted transactions are rolled back.

> [!success] Use reload when the service supports it
>
> `sudo systemctl reload mssql-server` sends SIGHUP to re-read configuration without stopping the process. Check whether the service supports reload with `systemctl cat <service>` and look for an `ExecReload` directive.

#### Reload configuration without restarting

`systemctl reload` sends SIGHUP to the main process, instructing it to re-read its configuration files without terminating. Not all services define `ExecReload`; if the unit file lacks it, this command returns an error.

```bash
sudo systemctl reload datadog-agent
```

#### Reload unit file changes from disk

After editing a unit file directly in `/etc/systemd/system/`, the daemon must be told to re-parse its unit definitions. This does not restart any running service — it only refreshes systemd's internal state.

```bash
sudo systemctl daemon-reload
```

| Flag / Subcommand | Syntax | Description |
|---|---|---|
| `start` | `systemctl start <unit>` | Start a stopped service |
| `stop` | `systemctl stop <unit>` | Stop a running service |
| `restart` | `systemctl restart <unit>` | Stop then start the service |
| `reload` | `systemctl reload <unit>` | Re-read config via SIGHUP (requires ExecReload) |
| `daemon-reload` | `systemctl daemon-reload` | Re-parse unit files after editing them on disk |

### Linux | systemctl | check service status

`systemctl status` displays the current state of a service, its main PID, recent log lines from the journal, and the cgroup resource group it belongs to. This is always the first command to run when a service is behaving unexpectedly.

#### Check if a service is running or failed

The output includes the active state (`active (running)`, `inactive (dead)`, `failed`), the start time, and the last few journal lines. A non-zero exit code on the last run is reported in the `Main PID` line.

```bash
sudo systemctl status mssql-server
```

```text
● mssql-server.service - Microsoft SQL Server Database Engine
     Loaded: loaded (/lib/systemd/system/mssql-server.service; enabled; vendor preset: enabled)
     Active: active (running) since Thu 2026-04-03 08:12:44 UTC; 2h 15min ago
   Main PID: 1234 (sqlservr)
      Tasks: 141 (limit: 4915)
     Memory: 3.2G
        CPU: 4min 12.551s
     CGroup: /system.slice/mssql-server.service
             └─1234 /opt/mssql/bin/sqlservr

Apr 03 08:12:44 prod-db01 systemd[1]: Starting Microsoft SQL Server Database Engine...
Apr 03 08:12:46 prod-db01 systemd[1]: Started Microsoft SQL Server Database Engine.
```

The `Active` field reflects the current state. `active (running)` means the main process is alive. `failed` means it exited with a non-zero code. `inactive (dead)` means it was stopped cleanly.

#### Inspect the raw unit file

`systemctl cat` prints the unit file exactly as systemd loaded it, including all directives: `ExecStart`, `ExecReload`, `Restart`, `RestartSec`, `Environment`. Use this to verify what command runs on start and whether reload is supported.

```bash
systemctl cat mssql-server
```

```text
# /lib/systemd/system/mssql-server.service
[Unit]
Description=Microsoft SQL Server Database Engine
After=network-online.target
Wants=network-online.target

[Service]
Type=notify
ExecStart=/opt/mssql/bin/sqlservr
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

#### List all running services

Shows every service currently in the `active (running)` state. Add `--all` to include inactive and failed units as well.

```bash
systemctl list-units --type=service --state=running
```

```text
  UNIT                        LOAD   ACTIVE SUB     DESCRIPTION
  datadog-agent.service       loaded active running  Datadog Agent
  docker.service              loaded active running  Docker Application Container Engine
  mssql-server.service        loaded active running  Microsoft SQL Server Database Engine
  ssh.service                 loaded active running  OpenBSD Secure Shell server

LOAD   = Reflects whether the unit definition was properly loaded.
ACTIVE = The high-level unit activation state.
SUB    = The low-level unit activation substate.

4 loaded units listed.
```

| Flag / Subcommand | Syntax | Description |
|---|---|---|
| `status` | `systemctl status <unit>` | Show runtime state, PID, recent logs |
| `cat` | `systemctl cat <unit>` | Print the loaded unit file |
| `list-units` | `systemctl list-units --type=service` | List all service units |
| `--state=` | `--state=running\|failed\|inactive` | Filter list by activation state |
| `--all` | `systemctl list-units --all` | Include inactive and failed units |

### Linux | systemctl | manage boot persistence

Enabling a service creates a symlink in the appropriate `wants` directory so that systemd starts the service during the next boot sequence. It does not start the service immediately.

#### Enable a service to start on boot

`systemctl enable` creates a symlink from `/etc/systemd/system/multi-user.target.wants/<unit>` to the unit file. The service will start automatically on every subsequent reboot.

```bash
sudo systemctl enable mssql-server
```

#### Enable and start immediately

The `--now` flag combines enable and start into a single command. This is the standard production pattern when adding a new service.

```bash
sudo systemctl enable --now mssql-server
```

> [!warning] enable does not start the service
>
> `systemctl enable` only creates the boot symlink. The service remains stopped until the next reboot or until you explicitly `start` it.

> [!success] Combine enable and start with --now
>
> `sudo systemctl enable --now mssql-server` both creates the boot symlink and starts the service immediately. This is the safe, complete command for adding a new service to production.

#### Disable a service from starting on boot

`systemctl disable` removes the symlink but does not stop the currently running service. Use `stop` separately if you also need to terminate the running process.

```bash
sudo systemctl disable mssql-server
```

#### Check whether a service is enabled

`is-enabled` returns `enabled`, `disabled`, or `static` (always starts when a dependency requires it). Useful in automation scripts to verify the desired boot state.

```bash
systemctl is-enabled mssql-server
```

```text
enabled
```

| Flag / Subcommand | Syntax | Description |
|---|---|---|
| `enable` | `systemctl enable <unit>` | Create boot symlink |
| `enable --now` | `systemctl enable --now <unit>` | Create boot symlink and start immediately |
| `disable` | `systemctl disable <unit>` | Remove boot symlink (service keeps running) |
| `is-enabled` | `systemctl is-enabled <unit>` | Print enabled/disabled/static state |

### Linux | journalctl | read service logs

`journalctl` queries the systemd journal, which aggregates logs from all services into a single binary store. Unlike traditional log files in `/var/log/`, the journal is indexed and queryable by unit, time range, priority level, and boot session.

#### Read recent logs for a service

`-u` filters by unit name. `--no-pager` prints directly to stdout instead of opening `less`, which is required for scripting and piping. `--since` accepts absolute timestamps (`"2026-04-03 08:00:00"`) or relative expressions (`"1 hour ago"`).

```bash
sudo journalctl -u mssql-server --since "1 hour ago" --no-pager
```

```text
Apr 03 08:12:44 prod-db01 sqlservr[1234]: SQL Server is now ready for client connections.
Apr 03 08:45:01 prod-db01 sqlservr[1234]: I/O error on file '/var/opt/mssql/data/model.mdf': 0(The operation completed successfully.)
Apr 03 09:15:22 prod-db01 sqlservr[1234]: Login failed for user 'sa'. Reason: Password did not match.
```

#### Follow logs in real time

`-f` tails the journal live, equivalent to `tail -f` on a traditional log file. Use this while reproducing an issue or watching a service start up.

```bash
sudo journalctl -u mssql-server -f
```

#### Read the last N lines

`-n` limits output to the most recent N log entries. Combine with `--no-pager` for scripting.

```bash
sudo journalctl -u mssql-server -n 50 --no-pager
```

#### Filter by log priority level

`-p` filters by syslog priority. `err` shows only error-level and above (critical, alert, emergency). Useful for extracting only failures from verbose services.

```bash
sudo journalctl -u datadog-agent -p err --since "24 hours ago" --no-pager
```

| Flag | Syntax | Description |
|---|---|---|
| `-u` | `journalctl -u <unit>` | Filter by systemd unit name |
| `-f` | `journalctl -f` | Follow journal in real time |
| `-n` | `journalctl -n <N>` | Show last N entries |
| `--since` | `--since "1 hour ago"` | Filter by start time (relative or absolute) |
| `--until` | `--until "2026-04-03 10:00:00"` | Filter by end time |
| `--no-pager` | `journalctl --no-pager` | Print to stdout, no interactive pager |
| `-p` | `journalctl -p err` | Filter by priority (emerg, alert, crit, err, warning, notice, info, debug) |
| `-k` | `journalctl -k` | Show kernel messages only (equivalent to dmesg) |
| `-b` | `journalctl -b` | Show logs from current boot; `-b -1` for previous boot |

### Linux | dmesg and journalctl | diagnose OOM kills

When a service keeps crashing with no error in its own logs, it was likely killed by the Linux OOM (Out of Memory) killer. The OOM killer is a kernel mechanism that terminates the process with the highest memory score (`oom_score`) when the system runs out of physical memory and swap. It writes a record to the kernel ring buffer, not to the service's own journal.

#### Check the kernel ring buffer for OOM events

`dmesg` reads the kernel ring buffer. The OOM killer always writes a `Killed process` line with the process name, PID, and amount of memory freed.

```bash
sudo dmesg | grep -i "oom\|killed process" | tail -10
```

```text
[1234567.890123] Out of memory: Kill process 9876 (sqlservr) score 742 or sacrifice child
[1234567.891456] Killed process 9876 (sqlservr) total-vm:6291456kB, anon-rss:5242880kB, file-rss:0kB, shmem-rss:0kB
```

#### Check the journal for kernel OOM events

`journalctl -k` queries the same kernel messages through the journal API, which supports richer filtering by time range.

```bash
sudo journalctl -k --since "1 hour ago" | grep -i "oom\|killed"
```

```text
Apr 03 09:47:12 prod-db01 kernel: Out of memory: Kill process 9876 (sqlservr) score 742 or sacrifice child
Apr 03 09:47:12 prod-db01 kernel: Killed process 9876 (sqlservr) total-vm:6291456kB, anon-rss:5242880kB
```

> [!warning] OOM kills leave no trace in the service's own logs
>
> The service is terminated by the kernel before it can write any shutdown message. `journalctl -u <service>` will show the service stopped cleanly, which is misleading. Always cross-check with `dmesg` or `journalctl -k` when a service restarts unexpectedly.

> [!success] Resolution paths for OOM kills
>
> 1. Increase VM memory allocation.
> 2. For SQL Server: reduce `max server memory (MB)` in `sp_configure` to cap RSS below total RAM.
> 3. Add swap space as a pressure buffer: `fallocate -l 4G /swapfile && mkswap /swapfile && swapon /swapfile`.
> 4. Use `systemd-oomd` or `earlyoom` to trigger controlled termination of lower-priority processes before the kernel OOM killer acts.

> [!tip] Service debugging workflow
>
> 1. `systemctl status <service>` — is it running or failed?
> 2. `journalctl -u <service> -n 50 --no-pager` — last 50 log lines
> 3. `dmesg | grep -i oom` — was it OOM killed?
> 4. `systemctl cat <service>` — what is the service definition (ExecStart, environment vars)?
> 5. `journalctl -u <service> --since "30 min ago"` — extended log window

## PowerShell Windows Services tools

Windows Services are long-running background processes managed by the Service Control Manager (SCM). Each service has a display name, a short name used in commands, a startup type (Automatic, Manual, Disabled), and a set of dependencies. The PowerShell `*-Service` cmdlets wrap the SCM API and provide equivalent control to `systemctl` on Linux. The event log (via `Get-WinEvent`) is the equivalent of `journalctl`.

### PowerShell | Get-Service | check service status

`Get-Service` queries the Service Control Manager for the current state of one or more services. It is always the first command to run when investigating a service issue on Windows.

#### Check the status of a single service

Returns the service object with its `Status` (`Running`, `Stopped`, `Paused`), `StartType`, and display name. The short name `MSSQLSERVER` is the default instance; named instances use `MSSQL$<InstanceName>`.

```powershell
Get-Service -Name "MSSQLSERVER"
```

```text
Status   Name               DisplayName
------   ----               -----------
Running  MSSQLSERVER        SQL Server (MSSQLSERVER)
```

#### List all running services

Pipes all services through `Where-Object` to filter by `Running` status. Equivalent to `systemctl list-units --type=service --state=running`.

```powershell
Get-Service | Where-Object { $_.Status -eq "Running" }
```

```text
Status   Name                 DisplayName
------   ----                 -----------
Running  datadog-agent        Datadog Agent
Running  Docker Desktop       Docker Desktop
Running  MSSQLSERVER          SQL Server (MSSQLSERVER)
Running  WinRM                Windows Remote Management (WS-Management)
```

#### Check dependent services

Shows services that depend on the target service. Stopping SQL Server will also stop SQL Server Agent (`SQLSERVERAGENT`), SQL Server Browser, and any other registered dependents.

```powershell
Get-Service -Name "MSSQLSERVER" -DependentServices
```

```text
Status   Name             DisplayName
------   ----             -----------
Running  SQLSERVERAGENT   SQL Server Agent (MSSQLSERVER)
Stopped  SQLBrowser       SQL Server Browser
```

| Flag / Parameter | Syntax | Description |
|---|---|---|
| `-Name` | `Get-Service -Name "MSSQLSERVER"` | Query a specific service by short name |
| `-DisplayName` | `Get-Service -DisplayName "SQL*"` | Query by display name (supports wildcards) |
| `-DependentServices` | `Get-Service -Name "X" -DependentServices` | Show services that depend on this one |
| `-RequiredServices` | `Get-Service -Name "X" -RequiredServices` | Show services this one depends on |

### PowerShell | Start-Service, Stop-Service, Restart-Service | control service lifecycle

These cmdlets send control requests to the SCM and wait for the service to reach the target state before returning. They are the PowerShell equivalents of `systemctl start/stop/restart`.

#### Start a service

```powershell
Start-Service -Name "MSSQLSERVER"
```

#### Stop a service

```powershell
Stop-Service -Name "MSSQLSERVER"
```

> [!warning] Stop-Service blocks on dependent services
>
> If dependent services are running, `Stop-Service` fails with an error unless you pass `-Force`. Stopping SQL Server while SQL Server Agent is running will fail by default.

> [!success] Force-stop including dependents
>
> `Stop-Service -Name "MSSQLSERVER" -Force` stops the service and all its dependents in the correct order. Review dependents first with `Get-Service -Name "MSSQLSERVER" -DependentServices`.

#### Restart a service

```powershell
Restart-Service -Name "MSSQLSERVER"
```

#### Restart including dependent services

`-Force` propagates the restart to dependent services so they do not remain in a stopped state after the primary service comes back up.

```powershell
Restart-Service -Name "MSSQLSERVER" -Force
```

| Flag / Parameter | Syntax | Description |
|---|---|---|
| `-Name` | `Start-Service -Name "X"` | Target service by short name |
| `-Force` | `Stop-Service -Name "X" -Force` | Stop service and all its dependents |
| `-PassThru` | `Restart-Service -Name "X" -PassThru` | Return the service object after the operation |

### PowerShell | Set-Service | manage startup type

`Set-Service` modifies the service configuration in the SCM registry, including startup type and description. Changes take effect on the next service start; the currently running service is not affected.

#### Configure a service to start automatically on boot

`Automatic` is equivalent to `systemctl enable`. The service starts during the Windows boot sequence without requiring manual intervention.

```powershell
Set-Service -Name "MSSQLSERVER" -StartupType Automatic
```

#### Disable a service from starting on boot

`Disabled` prevents the service from being started manually or automatically. Use this to lock down services that must not run in a given environment.

```powershell
Set-Service -Name "MSSQLSERVER" -StartupType Disabled
```

#### Set a service to manual start

`Manual` means the service does not start on boot but can be started on demand. Equivalent to a service with no `[Install]` section in its systemd unit file.

```powershell
Set-Service -Name "MSSQLSERVER" -StartupType Manual
```

| Flag / Parameter | Syntax | Description |
|---|---|---|
| `-StartupType Automatic` | `Set-Service -Name "X" -StartupType Automatic` | Start on boot (equivalent to systemctl enable) |
| `-StartupType Manual` | `Set-Service -Name "X" -StartupType Manual` | Start on demand only |
| `-StartupType Disabled` | `Set-Service -Name "X" -StartupType Disabled` | Prevent start entirely |
| `-StartupType AutomaticDelayedStart` | `Set-Service -Name "X" -StartupType AutomaticDelayedStart` | Start after other Automatic services (reduces boot contention) |
| `-Description` | `Set-Service -Name "X" -Description "text"` | Update the service description |

### PowerShell | Get-WinEvent | read service event logs

`Get-WinEvent` queries Windows Event Log, which is the Windows equivalent of `journalctl`. Service lifecycle events (start, stop, crash, SCM errors) are recorded in the `System` log. Application-specific events are in `Application` or a dedicated provider log.

#### Read recent events for a specific service

Filters the System event log for entries from the `Service Control Manager` provider that mention the target service. `-MaxEvents` limits the number of returned entries.

```powershell
Get-WinEvent -LogName System -MaxEvents 50 |
    Where-Object { $_.Message -like "*MSSQLSERVER*" }
```

```text
TimeCreated          Id  LevelDisplayName Message
-----------          --  ---------------- -------
4/3/2026 8:12:44 AM  7036 Information      The SQL Server (MSSQLSERVER) service entered the running state.
4/3/2026 7:58:01 AM  7034 Error            The SQL Server (MSSQLSERVER) service terminated unexpectedly.
```

Event ID 7036 is a state-change event (service started or stopped). Event ID 7034 indicates an unexpected termination (crash). Event ID 7031 indicates a service failed and SCM attempted recovery.

#### Query a service's dedicated event log provider

SQL Server, Datadog, and other enterprise services write to their own named event log providers in addition to the System log.

```powershell
Get-WinEvent -ProviderName "MSSQLSERVER" -MaxEvents 20
```

#### Follow events in real time

`-Wait` streams new events as they arrive, equivalent to `journalctl -f`.

```powershell
Get-WinEvent -LogName System -MaxEvents 1 -Wait |
    Where-Object { $_.Message -like "*MSSQLSERVER*" }
```

> [!info] No direct equivalent for dmesg on Windows
>
> Windows does not expose a kernel ring buffer equivalent to `dmesg`. OOM-related terminations are recorded in the System event log under Event ID 2004 (from the `Microsoft-Windows-Resource-Exhaustion-Detector` provider) or may appear as Event ID 7034 (unexpected service termination). Query with `Get-WinEvent -ProviderName "Microsoft-Windows-Resource-Exhaustion-Detector"`.

| Flag / Parameter | Syntax | Description |
|---|---|---|
| `-LogName` | `-LogName System` | Query a named event log |
| `-ProviderName` | `-ProviderName "MSSQLSERVER"` | Query by event provider name |
| `-MaxEvents` | `-MaxEvents 50` | Limit number of returned events |
| `-Wait` | `-Wait` | Stream new events in real time (like journalctl -f) |
| `-FilterHashtable` | `-FilterHashtable @{LogName='System'; Id=7036}` | Fast server-side filtering by log, ID, level, time |

When running multiple services as containers, [docker-compose](https://alp78.github.io/elysium/09-Docker/docker-compose) provides declarative service orchestration with `docker compose up/down/restart` and automatic dependency ordering.


> [!example] Service Lifecycle Fit
>
> > [!success] Appropriate
> >
> > - **Restarting after config changes** -- `systemctl restart nginx` or `Restart-Service SqlServer` applies configuration changes that require a service restart.
> > - **Diagnosing service failures** -- `systemctl status <service>` shows the current state, PID, and last few log lines. `journalctl -u <service> --since "1 hour ago"` shows recent logs.
> > - **Enabling services at boot** -- `systemctl enable docker` ensures Docker starts automatically after a reboot.
> > - **Investigating startup failures** -- `journalctl -u <service> -b` shows logs from the current boot, pinpointing why a service failed to start.
> > - **Blocking dangerous services** -- `systemctl mask <service>` prevents a service from being started by any mechanism, including dependencies.
>
> > [!failure] Inappropriate
> >
> > - **Application-level restarts** -- if your application has a built-in reload mechanism (e.g., Airflow `airflow dags reserialize`), use that instead of restarting the entire service.
> > - **Container orchestration** -- Docker containers and Kubernetes pods have their own lifecycle management. Use `docker restart` or `kubectl rollout restart` instead of `systemctl`.
> > - **One-shot scripts** -- scripts that run once and exit are not services. Use cron, systemd timers, or Task Scheduler for scheduled execution.

## Warnings

> [!danger] `systemctl stop` on a database service interrupts all active connections
>
> Stopping SQL Server, PostgreSQL, or MySQL terminates all active queries and connections immediately. Verify no critical jobs are running before stopping. Use `SHUTDOWN WITH NOWAIT` (SQL Server) only in emergencies.

> [!warning] `start` vs `enable` are independent operations
>
> `systemctl start` runs the service now but does not survive reboot. `systemctl enable` configures boot startup but does not start the service now. To do both: `systemctl enable --now <service>`.

> [!warning] `sc` in PowerShell is an alias for `Set-Content`
>
> Running `sc query <service>` in PowerShell calls `Set-Content`, not the Windows service control tool. Always use `sc.exe query <service>` or `Get-Service <service>` in PowerShell.

> [!warning] Editing unit files requires `daemon-reload`
>
> After modifying a systemd unit file, run `systemctl daemon-reload` before restarting the service. Without it, systemd uses the cached version of the unit file and your changes have no effect.

## Recommendations

| Scenario | Recommendation |
|---|---|
| Check service status | `systemctl status <service>` (Linux) or `Get-Service <name>` (PowerShell). |
| Start and enable at boot | `systemctl enable --now <service>`. |
| View recent service logs | `journalctl -u <service> --since "1 hour ago" --no-pager`. |
| Follow service logs live | `journalctl -u <service> -f` (equivalent to `tail -F` for service logs). |
| Diagnose boot failure | `journalctl -u <service> -b` for current-boot logs. Add `-p err` to filter errors only. |
| Prevent accidental start | `systemctl mask <service>` blocks all start attempts. `unmask` to reverse. |
| Windows service control | `Get-Service`, `Start-Service`, `Stop-Service`, `Restart-Service`. For creation/deletion: `sc.exe`. |
| Custom service creation | Create a unit file in `/etc/systemd/system/`, then `systemctl daemon-reload && systemctl enable --now <service>`. |

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Service fails to start with "Unit is masked" | `systemctl mask` was run previously, blocking all start attempts. | `systemctl unmask <service>` then `systemctl start <service>`. |
| Service starts but immediately exits | Application error, missing config, or wrong user permissions. | Check `journalctl -u <service> -b` for the error message. Common causes: missing environment variables, wrong file paths, permission denied. |
| `systemctl restart` hangs | The service stop phase is waiting for connections to drain or processes to terminate. | Wait for the timeout (default 90s). If unacceptable, `systemctl kill <service>` sends SIGKILL. |
| Config changes not taking effect after restart | `systemctl daemon-reload` was not run after editing the unit file. | Run `systemctl daemon-reload` then `systemctl restart <service>`. |
| Service runs but is not accessible from outside | Service is listening on `127.0.0.1` (localhost only) instead of `0.0.0.0`. Or a firewall is blocking the port. | Check binding address in the service config. Check `ss -tlnp` for listen address. Check `ufw status` or `iptables -L`. |
| Windows service not starting after reboot | Startup type is set to Manual, not Automatic. | `Set-Service -Name <service> -StartupType Automatic`. |
## Cross-references
- [viewing-processes](https://alp78.github.io/elysium/01-Shell/Process-Management/viewing-processes) — monitor resource usage of a running service
- [system-resources](https://alp78.github.io/elysium/01-Shell/Process-Management/system-resources) — detect OOM conditions before they kill services
- [killing-processes](https://alp78.github.io/elysium/01-Shell/Process-Management/killing-processes) — `kill` as last resort when `systemctl stop` doesn't work
- [reading-file-contents](https://alp78.github.io/elysium/01-Shell/Text-Processing/reading-file-contents) — read log files when `journalctl` isn't enough
