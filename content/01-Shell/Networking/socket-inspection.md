---
type: concept
category: foundations
technology: [bash, powershell]
tags: [concept, foundations, bash, networking, linux]
aliases: [ss, netstat, socket inspection, TCP state, LISTEN, ESTABLISHED, TIME-WAIT, ephemeral ports, connection refused vs timed out]
keywords: [ss, netstat, socket inspection, TCP state, LISTEN, ESTAB, TIME-WAIT, ephemeral ports, loopback, 0.0.0.0, 127.0.0.1, connection refused, connection timed out, connection count, Get-NetTCPConnection, SQL Server ports, 1433, 1434, DAC, connection pool, Recv-Q]
description: "Reading socket state with ss (socket statistics) to diagnose network connectivity issues. Covers listening vs established connections, loopback vs all-interface binding, ephemeral ports, TIME-WAIT connections, and the 'connection refused vs timed out' distinction."
related: ["[[connectivity-testing]]", "[[firewalls]]", "[[iap-tunneling]]", "[[viewing-processes]]" ]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Socket Inspection — Reading What the Network Is Doing Right Now

The most underused debugging skill in data engineering is reading socket state. When a pipeline fails with "connection refused" or "connection timed out," the answer is almost always visible in the socket table — if you know how to read it. `ss` (socket statistics) is the modern replacement for `netstat` on Linux.

## Understanding `ss` Output

`ss` reads directly from kernel data structures (netlink) instead of parsing `/proc/net` files, making it faster on systems with thousands of connections.

**Listing listening sockets:**

```bash
# Show all TCP listening sockets with process info
ss -tlnp
# -t = TCP only (use -u for UDP, -x for Unix sockets)
# -l = listening sockets only (waiting for incoming connections)
# -n = numeric (show port numbers, not service names)
# -p = show process name (requires root for other users' processes)

# Example output:
# State   Recv-Q  Send-Q   Local Address:Port     Peer Address:Port  Process
# LISTEN  0       4096     127.0.0.53%lo:53        0.0.0.0:*
# LISTEN  0       128      0.0.0.0:22              0.0.0.0:*         users:(("sshd",pid=1234,fd=3))
# LISTEN  0       128      0.0.0.0:1433            0.0.0.0:*         users:(("sqlservr",pid=5678,fd=5))
# LISTEN  0       128      127.0.0.1:1434          0.0.0.0:*
# LISTEN  0       128      127.0.0.1:1431          0.0.0.0:*
# LISTEN  0       4096     127.0.0.1:5000          0.0.0.0:*
# LISTEN  0       4096     127.0.0.1:8126          0.0.0.0:*
# LISTEN  0       128      [::]:22                 [::]:*
# LISTEN  0       128      *:1433                  *:*
```

**How to read each column:**

| Column | Meaning |
|--------|---------|
| **State** | `LISTEN` = waiting for connections. `ESTAB` = active connection. `TIME-WAIT` = closing. |
| **Recv-Q** | For LISTEN: number of pending connections waiting to be accepted. If >0, the application is falling behind. |
| **Send-Q** | For LISTEN: the backlog size (max pending connections before the kernel starts dropping). |
| **Local Address:Port** | The IP and port the socket is bound to. This is the most important field. |
| **Peer Address:Port** | For LISTEN, always `0.0.0.0:*` (accepting from anyone). For ESTAB, the remote client's IP and port. |
| **Process** | The program that owns this socket. Requires `sudo` to see other users' processes. |

## Interpreting Local Address — Who Can Connect

```bash
# CRITICAL: the IP address determines WHO can connect

# 0.0.0.0:1433 — listening on ALL IPv4 interfaces
# Any machine on the network (or internet, if no firewall) can connect
# This is how SQL Server, SSH, and web servers normally listen
# Equivalent: *:1433

# 127.0.0.1:5000 — listening on LOOPBACK only
# ONLY processes on THIS MACHINE can connect
# External machines will get "connection refused" even if firewall allows it
# Use case: Datadog agent, internal APIs, admin tools
# Equivalent: localhost:5000

# [::]:22 — listening on ALL IPv6 interfaces
# IPv6 version of 0.0.0.0 — accepts IPv6 connections from anywhere
# On Linux with dual-stack, this often handles BOTH IPv4 and IPv6

# [::1]:1434 — IPv6 loopback only
# Same as 127.0.0.1 but for IPv6 — localhost only

# 127.0.0.53%lo:53 — bound to loopback via the "lo" interface
# The %lo suffix specifies the network interface (lo = loopback device)
# systemd-resolved uses this for local DNS resolution

# 10.0.0.3:1433 — bound to a SPECIFIC interface
# Only connections arriving on the 10.0.0.3 interface are accepted
# Connections to other IPs on the same machine are refused
```

## Common Services and Their Default Ports

```bash
# Port    Service                     Typical Bind Address
# 22      SSH (sshd)                  0.0.0.0 (all interfaces — for IAP and direct SSH)
# 53      DNS (systemd-resolved)      127.0.0.53 (loopback — local resolution only)
# 1433    SQL Server (sqlservr)       0.0.0.0 (all interfaces — accepts DB connections)
# 1434    SQL Server Browser          127.0.0.1 (loopback — instance discovery, rarely needed)
# 1431    SQL Server DAC              127.0.0.1 (loopback — emergency admin access)
# 5000    Datadog Agent (intake)      127.0.0.1 (loopback — collects local metrics)
# 5001    Datadog Agent (IPC)         127.0.0.1 (loopback — internal communication)
# 8126    Datadog APM (traces)        127.0.0.1 (loopback — receives traces from local apps)
# 5432    PostgreSQL                  0.0.0.0 or 127.0.0.1 (depends on pg_hba.conf)
# 8080    Airflow webserver           0.0.0.0 (all — but usually behind a reverse proxy)
# 5555    Airflow Flower              0.0.0.0 (all — Celery monitoring)
# 6379    Redis                       127.0.0.1 (loopback — should NEVER be 0.0.0.0)
```

> [!tip] SQL Server Port Breakdown
> - **1433** — The database engine. This is where your queries go. Always `0.0.0.0` for production.
> - **1434** — SQL Server Browser service. Tells clients which port each *named instance* uses. Irrelevant when using the default instance on default port 1433. Can be disabled.
> - **1431** — Dedicated Admin Connection (DAC). An emergency-only connection that bypasses normal resource limits. Used when the server is so overloaded that normal connections are rejected. Always localhost-only. Connect with: `sqlcmd -S admin:localhost -U sa`

## Viewing Established Connections

```bash
# Show active (established) TCP connections
ss -tnp
# No -l flag = shows established connections instead of listening sockets
# This shows who is actively connected to your services

# Example output:
# State   Recv-Q  Send-Q   Local Address:Port     Peer Address:Port  Process
# ESTAB   0       0        10.0.0.3:1433          10.0.0.24:56434
# ESTAB   0       0        10.0.0.3:1433          10.0.0.24:26733
# ESTAB   0       0        10.0.0.3:22            35.235.240.5:44122

# Reading each line:
# Line 1: Someone at 10.0.0.24 (ephemeral port 56434) is connected to SQL Server (1433)
#          10.0.0.24 = IAP proxy internal IP — this is an IAP tunnel connection
# Line 2: Second SQL Server connection from the same IAP proxy (different ephemeral port)
#          Two connections = likely SSMS with two query windows, or one app with two sessions
# Line 3: SSH connection from 35.235.240.5 — a Google IAP IP (35.235.240.0/20 range)
#          This is your interactive SSH session via gcloud compute ssh
```

> [!info] What Are Ephemeral Ports?
> When a client connects, the OS picks a random high port (typically 32768-60999 on Linux) for the client side. The server sees this as the "peer port." Each connection gets a unique ephemeral port. That's why you see different port numbers (56434, 26733) even though both connections go to the same SQL Server on port 1433.

## Filtering and Counting Connections

```bash
# Count connections to SQL Server
ss -tn | grep :1433 | wc -l
# Quick check: "How many clients are connected to the database right now?"

# Count by remote IP (who's using the most connections?)
ss -tn | grep :1433 | awk '{print $5}' | cut -d: -f1 | sort | uniq -c | sort -rn
# Output:
# 15  10.0.0.24     ← IAP tunnel connections
#  3  10.132.0.5    ← Pipeline VM
#  1  10.132.0.8    ← Airflow scheduler

# Show connections in TIME-WAIT state (connections closing)
ss -tn state time-wait | grep :1433
# Many TIME-WAIT connections = rapid connect/disconnect pattern
# This is normal for short-lived pipeline queries, but excessive numbers
# (>1000) can exhaust ephemeral ports. Fix: use connection pooling.

# Show connection states summary
ss -s
# Output:
# TCP:   42 (estab 18, closed 8, orphaned 0, timewait 8)
# Quick health check: are connection counts reasonable?

# Watch connections in real-time
watch -n 1 'ss -tn | grep :1433 | wc -l'
# Updates every second — useful during load testing or deployment
```

## Connection Refused vs Connection Timed Out

> [!warning] "Connection Refused" vs "Connection Timed Out" — Completely Different Root Causes
> These two errors look similar but have completely different causes:
>
> - **Connection refused** = The packet reached the server, but nothing is listening on that port. The kernel sends back a TCP RST (reset). Diagnosis: check `ss -tlnp` — is the service running? Is it bound to the right interface?
> - **Connection timed out** = The packet never reached the server (or the response never came back). No RST, no SYN-ACK — just silence. Diagnosis: check firewalls (GCP firewall rules, ufw, iptables), routing, and whether the server is up at all.
>
> A quick way to tell: `nc -zv -w 3 host port`. "Connection refused" is instant. "Connection timed out" takes 3 seconds (your timeout). The speed of the failure tells you which layer is broken.

## PowerShell — Socket Inspection

```powershell
# List all listening TCP ports with process names
Get-NetTCPConnection -State Listen | Sort-Object LocalPort |
    Select-Object LocalAddress, LocalPort, OwningProcess,
    @{N='Process';E={(Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName}} |
    Format-Table -AutoSize

# Output:
# LocalAddress  LocalPort  OwningProcess  Process
# 0.0.0.0       22         1234           sshd
# 0.0.0.0       1433       5678           sqlservr
# 127.0.0.1     1434       5678           sqlservr
# 127.0.0.1     5000       9012           agent

# Show established connections to SQL Server
Get-NetTCPConnection -LocalPort 1433 -State Established |
    Select-Object LocalAddress, LocalPort, RemoteAddress, RemotePort, OwningProcess |
    Format-Table -AutoSize

# Count connections per remote address
Get-NetTCPConnection -LocalPort 1433 -State Established |
    Group-Object RemoteAddress | Sort-Object Count -Descending |
    Select-Object Count, Name

# Quick check: is the port open?
Test-NetConnection -ComputerName localhost -Port 1433 -InformationLevel Quiet
# Returns: True or False — the simplest connectivity test

# Show all connection states for port 1433
Get-NetTCPConnection -LocalPort 1433 | Group-Object State |
    Select-Object Count, Name
# Output:
# Count  Name
#     1  Listen
#     5  Established
#     2  TimeWait
```

## Related
- [[connectivity-testing]] — test reachability before reading socket state
- [[firewalls]] — when sockets show nothing listening but you expected something
- [[iap-tunneling]] — understanding IAP proxy addresses in established connections
- [[viewing-processes]] — find which process owns a socket (combine with `ss -p`)
