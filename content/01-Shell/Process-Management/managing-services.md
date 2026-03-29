---
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell, bash, linux, powershell]
aliases: [systemctl, journalctl, service management, systemd, daemon, OOM kill, service restart]
keywords: [systemctl, journalctl, systemd, service, daemon, start service, stop service, restart service, enable on boot, service logs, OOM killer, out of memory, service status, mssql-server, datadog-agent, airflow, service failed, Set-Service, Start-Service]
description: "Managing Linux systemd services and Windows services for production data engineering infrastructure. Covers start/stop/restart/enable, reading service logs with journalctl, diagnosing OOM kills, and the PowerShell equivalents."
related: ["[[viewing-processes]]", "[[killing-processes]]", "[[system-resources]]", "[[reading-file-contents]]" ]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Services — Starting, Stopping, and Debugging Daemons

Every long-running process in your infrastructure -- SQL Server, Airflow, Datadog agent, Docker daemon -- runs as a systemd service on Linux. Understanding service management is how you restart a crashed database, check why a monitoring agent stopped collecting metrics, or enable a new service to survive reboots. For Airflow-specific service management (scheduler, worker, webserver), see [[airflow-core-concepts]].

### systemctl, journalctl — managing systemd services and reading logs

#### systemctl start, stop, restart — control service lifecycle

> [!warning] restart drops all connections
>
> `systemctl restart mssql-server` stops then starts the service — all database
> connections are terminated. In-flight queries are killed, uncommitted transactions are
> rolled back. Use `reload` when possible to avoid downtime.

```bash
sudo systemctl start mssql-server
sudo systemctl stop mssql-server
sudo systemctl restart mssql-server
```

#### systemctl reload — re-read config without restarting

> [!info] Reload without restart
>
> Sends SIGHUP to re-read configuration without stopping the service. Not all
> services support reload — check with `systemctl cat <service>` to see if the unit
> file defines `ExecReload`.

```bash
sudo systemctl reload datadog-agent
```

#### systemctl status — check if a service is running or failed

```bash
sudo systemctl status mssql-server
```

#### systemctl enable — start service automatically on boot

> [!warning] enable does not start now
>
> `systemctl enable` only creates the symlink for boot startup. To start immediately AND
> enable on boot: `sudo systemctl enable --now mssql-server`.

```bash
sudo systemctl enable mssql-server
sudo systemctl disable mssql-server
```

#### journalctl -u — read service logs

> [!info] journalctl filter and follow
>
> `-u` filters by unit (service name). `--since` accepts human-readable times.
> `-f` follows in real-time (like `tail -f`). `-n 50` shows last 50 lines.

```bash
sudo journalctl -u mssql-server --since "1 hour ago" --no-pager
sudo journalctl -u mssql-server -f
```

#### systemctl list-units — show all running services

```bash
systemctl list-units --type=service --state=running
```

### Diagnosing OOM kills — when services crash with no error in their own logs

> [!warning] OOM kills crash with no logs
>
> If a service keeps crashing with no error in its own logs, it was probably killed by the Linux OOM killer (Out Of Memory). Check:
> ```bash
> dmesg | grep -i "oom|killed process" | tail -10
> sudo journalctl -k | grep -i "oom|killed" | tail -10
> ```
> The OOM killer selects the process with the highest memory usage and kills it to prevent the entire system from freezing. Fix: increase VM memory, reduce SQL Server's `max server memory`, or add swap as a buffer.

> [!tip] Service debugging workflow
>
> 1. `systemctl status <service>` — is it running or failed?
> 2. `journalctl -u <service> -n 50 --no-pager` — last 50 log lines
> 3. `dmesg | grep -i oom` — was it OOM killed?
> 4. `systemctl cat <service>` — what is the service definition (ExecStart, environment vars)?
> 5. `journalctl -u <service> --since "30 min ago"` — extended log window

### PowerShell — Start-Service, Stop-Service, Set-Service for Windows services

#### Start-Service, Stop-Service, Restart-Service — control service lifecycle

```powershell
Start-Service -Name "MSSQLSERVER"
Stop-Service -Name "MSSQLSERVER"
Restart-Service -Name "MSSQLSERVER"
```

#### Set-Service -StartupType — enable on boot

```powershell
Set-Service -Name "MSSQLSERVER" -StartupType Automatic
```

#### Get-Service -DependentServices — check what else stops

> [!info] Check dependent services
>
> Shows services that depend on this one. Stopping SQL Server may also stop
> SQL Server Agent, SSIS, or other dependent services.

```powershell
Get-Service -Name "MSSQLSERVER" -DependentServices
```

When running multiple services as containers, [[docker-compose]] provides declarative service orchestration with `docker compose up/down/restart` and automatic dependency ordering.

## Related
- [[viewing-processes]] — monitor resource usage of a running service
- [[system-resources]] — detect OOM conditions before they kill services
- [[killing-processes]] — `kill` as last resort when `systemctl stop` doesn't work
- [[reading-file-contents]] — read log files when `journalctl` isn't enough
