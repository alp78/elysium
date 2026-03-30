---
title: "Domain: System and Network"
tags:
  - domain
  - shell
---

# System and Network

Monitoring processes and resources, managing services, testing connectivity, inspecting sockets, making HTTP requests, configuring firewalls, and connecting to GCP infrastructure.

```mermaid
mindmap
  ((System and Network))
    (viewing processes)
    (system resources)
    (killing processes)
    (managing services)
    (connectivity testing)
    (socket inspection)
    (HTTP, APIs)
    (firewalls)
    (IAP tunneling)
    (GCP resources)
```

> [!abstract]- [[viewing-processes]]
>
> - [[viewing-processes#Linux — ps, top, htop, pstree|Listing and monitoring processes]]
> - [[viewing-processes#Diagnosing a slow Airflow VM — ps, docker stats, iostat workflow|Diagnosing a slow VM]]
> - [[viewing-processes#The D state — uninterruptible sleep processes that cannot be killed|The D state (unkillable processes)]]
> - [[viewing-processes#PowerShell — Get-Process, Get-CimInstance for process and system monitoring|PowerShell equivalents]]

> [!abstract]- [[system-resources]]
>
> - [[system-resources#free -h — memory usage and available RAM|Memory usage]]
> - [[system-resources#lscpu, uptime — CPU info and load average|CPU and load average]]
> - [[system-resources#vmstat — combined CPU, memory, IO snapshot|Combined system snapshot]]
> - [[system-resources#SQL Server memory interpretation — why free -h looks alarming but is normal|SQL Server memory interpretation]]
> - [[system-resources#PowerShell — Get-CimInstance, Get-Counter for memory, CPU, and disk IO|PowerShell equivalents]]

> [!abstract]- [[killing-processes]]
>
> - [[killing-processes#pkill -f — kill by command line pattern|Kill by pattern]]
> - [[killing-processes#kill -- -PGID — kill a process group (parent and all children)|Kill a process group]]
> - [[killing-processes#SIGTERM → strace → SIGKILL — the correct kill escalation sequence|Correct kill escalation]]
> - [[killing-processes#PowerShell — Stop-Process for graceful and forced termination|PowerShell equivalents]]

> [!abstract]- [[managing-services]]
>
> - [[managing-services#systemctl, journalctl — managing systemd services and reading logs|Service lifecycle and logs]]
> - [[managing-services#systemctl enable — start service automatically on boot|Enable on boot]]
> - [[managing-services#Diagnosing OOM kills — when services crash with no error in their own logs|Diagnosing OOM kills]]
> - [[managing-services#PowerShell — Start-Service, Stop-Service, Set-Service for Windows services|PowerShell equivalents]]

> [!abstract]- [[connectivity-testing]]
>
> - [[connectivity-testing#nc (netcat) — testing port reachability|Port reachability testing]]
> - [[connectivity-testing#dig — DNS lookup and record queries|DNS lookup]]
> - [[connectivity-testing#mtr — combines ping + traceroute in real time|Path tracing]]
> - [[connectivity-testing#Debugging a failed database connection — systematic network stack walkthrough|Debugging failed connections]]
> - [[connectivity-testing#PowerShell — Test-NetConnection, Resolve-DnsName|PowerShell equivalents]]

> [!abstract]- [[socket-inspection]]
>
> - [[socket-inspection#ss local address — 0.0.0.0 vs 127.0.0.1 determines who can connect|Listening address scope]]
> - [[socket-inspection#Common services and default ports — SSH, SQL Server, Datadog, PostgreSQL, Airflow|Common ports reference]]
> - [[socket-inspection#ss filtering — counting connections, TIME-WAIT, and per-client breakdown|Connection counting and filtering]]
> - [[socket-inspection#Connection refused vs connection timed out — diagnosing the root cause|Refused vs timed out]]
> - [[socket-inspection#PowerShell — Get-NetTCPConnection for socket inspection and connection counts|PowerShell equivalents]]

> [!abstract]- [[http-requests-and-apis]]
>
> - [[http-requests-and-apis#curl -X POST — send JSON body|Sending requests]]
> - [[http-requests-and-apis#curl --retry --connect-timeout — download with retry and timeout|Retry and timeout]]
> - [[http-requests-and-apis#curl -w — timing breakdown to diagnose latency|Latency diagnosis]]
> - [[http-requests-and-apis#curl vs wget vs Python requests — tool selection|Tool selection]]
> - [[http-requests-and-apis#PowerShell — Invoke-RestMethod, Invoke-WebRequest for HTTP requests|PowerShell equivalents]]

> [!abstract]- [[firewalls]]
>
> - [[firewalls#ufw — Linux Uncomplicated Firewall for port access control|Linux firewall rules]]
> - [[firewalls#ufw default deny — the correct baseline for production servers|Default deny baseline]]
> - [[firewalls#Defense in depth — layered firewall strategy for production databases|Defense in depth strategy]]
> - [[firewalls#PowerShell — Windows Firewall with New-NetFirewallRule|PowerShell equivalents]]

> [!abstract]- [[iap-tunneling]]
>
> - [[iap-tunneling#How IAP tunneling works — the full network path from workstation to VM|How IAP works]]
> - [[iap-tunneling#IAP Tunnel Commands — All Variants|Tunnel commands]]
> - [[iap-tunneling#Debugging IAP tunnels — API, IAM, firewall, and VM state checks|Debugging tunnels]]
> - [[iap-tunneling#IAP vs Cloud VPN vs bastion host — choosing the right access method|IAP vs VPN vs bastion]]

> [!abstract]- [[connecting-to-gcp-resources]]
>
> - [[connecting-to-gcp-resources#Compute Engine VMs (SSH)|Compute Engine SSH]]
> - [[connecting-to-gcp-resources#SQL Server on Compute Engine (via IAP Tunnel)|SQL Server via IAP]]
> - [[connecting-to-gcp-resources#BigQuery (Direct API — No Tunnel Needed)|BigQuery direct API]]
> - [[connecting-to-gcp-resources#Cloud Run services — HTTPS endpoints with identity token auth|Cloud Run]]
> - [[connecting-to-gcp-resources#Connection quick reference matrix — protocol and tunnel requirements by service|Connection matrix]]
