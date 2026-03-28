---
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell, bash]
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

## Linux (systemd)

```bash
# Start / stop / restart a service
sudo systemctl start mssql-server
sudo systemctl stop mssql-server
sudo systemctl restart mssql-server
# systemctl = systemd service manager
# restart = stop + start (brief downtime — connections are dropped)

# Reload configuration without restarting (not all services support this)
sudo systemctl reload datadog-agent
# reload = send SIGHUP to re-read config without stopping the service
# Not all services support reload — check with: systemctl cat <service>

# Check service status
sudo systemctl status mssql-server
# Shows: active/inactive/failed, PID, memory, CPU, recent log lines
# "active (running)" = healthy
# "failed" = crashed — check the log lines at the bottom for the error

# Enable/disable service on boot
sudo systemctl enable mssql-server     # start automatically on boot
sudo systemctl disable mssql-server    # don't start on boot

# Service logs (via journald)
sudo journalctl -u mssql-server --since "1 hour ago" --no-pager
# -u = unit (service name)
# --since = time filter (also: "today", "yesterday", "2025-03-09 14:00")
# --no-pager = print all output (don't paginate)

# Follow service logs in real-time
sudo journalctl -u mssql-server -f
# -f = follow (like tail -f)

# All services and their status
systemctl list-units --type=service --state=running
# Shows every currently running service

# Why did a service fail?
sudo systemctl status mssql-server   # recent error lines
sudo journalctl -u mssql-server -n 50 --no-pager  # last 50 log lines
# Common causes: permission error, port conflict, config syntax error, OOM kill
```

## Diagnosing OOM Kills

> [!warning] OOM Kills — When Services Crash With No Error in Their Own Logs
> If a service keeps crashing with no error in its own logs, it was probably killed by the Linux OOM killer (Out Of Memory). Check:
> ```bash
> dmesg | grep -i "oom|killed process" | tail -10
> sudo journalctl -k | grep -i "oom|killed" | tail -10
> ```
> The OOM killer selects the process with the highest memory usage and kills it to prevent the entire system from freezing. Fix: increase VM memory, reduce SQL Server's `max server memory`, or add swap as a buffer.

> [!tip] Quick Service Debugging Workflow
> 1. `systemctl status <service>` — is it running or failed?
> 2. `journalctl -u <service> -n 50 --no-pager` — last 50 log lines
> 3. `dmesg | grep -i oom` — was it OOM killed?
> 4. `systemctl cat <service>` — what is the service definition (ExecStart, environment vars)?
> 5. `journalctl -u <service> --since "30 min ago"` — extended log window

## PowerShell (Windows Services)

```powershell
# Start / stop / restart
Start-Service -Name "MSSQLSERVER"
Stop-Service -Name "MSSQLSERVER"
Restart-Service -Name "MSSQLSERVER"

# Status
Get-Service -Name "MSSQLSERVER"

# Enable on boot
Set-Service -Name "MSSQLSERVER" -StartupType Automatic

# List running services
Get-Service | Where-Object Status -eq "Running" | Sort-Object DisplayName

# Service dependencies (what else stops if I stop this?)
Get-Service -Name "MSSQLSERVER" -DependentServices
```

When running multiple services as containers, [[docker-compose]] provides declarative service orchestration with `docker compose up/down/restart` and automatic dependency ordering.

## Related
- [[viewing-processes]] — monitor resource usage of a running service
- [[system-resources]] — detect OOM conditions before they kill services
- [[killing-processes]] — `kill` as last resort when `systemctl stop` doesn't work
- [[reading-file-contents]] — read log files when `journalctl` isn't enough
