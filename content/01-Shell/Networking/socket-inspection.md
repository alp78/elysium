---
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell, bash, linux, powershell, networking]
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

#### ss -tlnp — listing listening TCP sockets with process info

> [!info] `ss -tlnp` flags
> - `-t` — TCP only (use `-u` for UDP, `-x` for Unix sockets)
> - `-l` — listening sockets only (waiting for incoming connections)
> - `-n` — numeric (show port numbers, not service names — much faster)
> - `-p` — show process name (requires root for other users' processes)

```bash
ss -tlnp
```

    State   Recv-Q  Send-Q   Local Address:Port     Peer Address:Port  Process
    LISTEN  0       128      0.0.0.0:22              0.0.0.0:*         users:(("sshd",pid=1234,fd=3))
    LISTEN  0       128      0.0.0.0:1433            0.0.0.0:*         users:(("sqlservr",pid=5678,fd=5))
    LISTEN  0       128      127.0.0.1:1434          0.0.0.0:*
    LISTEN  0       4096     127.0.0.1:5000          0.0.0.0:*

#### ss output columns — State, Recv-Q, Send-Q, Local Address, Process

| Column | Meaning |
|--------|---------|
| **State** | `LISTEN` = waiting for connections. `ESTAB` = active connection. `TIME-WAIT` = closing. |
| **Recv-Q** | For LISTEN: number of pending connections waiting to be accepted. If >0, the application is falling behind. |
| **Send-Q** | For LISTEN: the backlog size (max pending connections before the kernel starts dropping). |
| **Local Address:Port** | The IP and port the socket is bound to. This is the most important field. |
| **Peer Address:Port** | For LISTEN, always `0.0.0.0:*` (accepting from anyone). For ESTAB, the remote client's IP and port. |
| **Process** | The program that owns this socket. Requires `sudo` to see other users' processes. |

### ss local address — 0.0.0.0 vs 127.0.0.1 determines who can connect

> [!info] The IP address determines WHO can connect
> - **`0.0.0.0:1433`** — listening on ALL IPv4 interfaces. Any machine on the network can connect. This is how SQL Server, SSH, and web servers normally listen. Equivalent: `*:1433`
> - **`127.0.0.1:5000`** — LOOPBACK only. Only processes on THIS machine can connect. External machines get "connection refused" even if firewall allows it. Use case: Datadog agent, internal APIs
> - **`[::]:22`** — listening on ALL IPv6 interfaces. On Linux with dual-stack, often handles BOTH IPv4 and IPv6
> - **`[::1]:1434`** — IPv6 loopback only (same as `127.0.0.1` but for IPv6)
> - **`127.0.0.53%lo:53`** — bound to loopback via the `lo` interface. `systemd-resolved` uses this for local DNS
> - **`10.0.0.3:1433`** — bound to a SPECIFIC interface. Only connections arriving on that IP are accepted

### Common services and default ports — SSH, SQL Server, Datadog, PostgreSQL, Airflow

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

### ss -tnp — viewing established connections and reading peer addresses

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

### ss filtering — counting connections, TIME-WAIT, and per-client breakdown

#### ss -tn | grep :1433 — count active database connections

```bash
ss -tn | grep :1433 | wc -l
```

#### ss + awk — count connections per remote IP

> [!info] Shows which clients are consuming the most connections. Useful for identifying
> connection pool leaks or runaway pipeline processes.

```bash
ss -tn | grep :1433 | awk '{print $5}' | cut -d: -f1 | sort | uniq -c | sort -rn
```

#### ss state time-wait — detect rapid connect/disconnect patterns

> [!warning] Excessive TIME-WAIT connections (>1000) can exhaust ephemeral ports
> TIME-WAIT is normal for short-lived queries, but if a pipeline opens and closes
> connections rapidly without pooling, ephemeral ports (32768-60999) fill up. Fix: use
> connection pooling in your application, or tune `net.ipv4.tcp_tw_reuse=1` in sysctl.

```bash
ss -tn state time-wait | grep :1433
```

#### ss -s — connection states summary

> [!info] A quick health check: how many connections are established, closing, or waiting?
> Use during incidents to see if connection counts are abnormal.

```bash
ss -s
```

#### watch + ss — real-time connection monitoring

> [!info] Updates every second — useful during load testing, deployment, or incident
> response. Watch for connection count climbing steadily (pool leak) or dropping to zero
> (service crash).

```bash
watch -n 1 'ss -tn | grep :1433 | wc -l'
```

### Connection refused vs connection timed out — diagnosing the root cause

> [!warning] "Connection Refused" vs "Connection Timed Out" — Completely Different Root Causes
> These two errors look similar but have completely different causes:
>
> - **Connection refused** = The packet reached the server, but nothing is listening on that port. The kernel sends back a TCP RST (reset). Diagnosis: check `ss -tlnp` — is the service running? Is it bound to the right interface?
> - **Connection timed out** = The packet never reached the server (or the response never came back). No RST, no SYN-ACK — just silence. Diagnosis: check firewalls (GCP firewall rules, ufw, iptables), routing, and whether the server is up at all.
>
> A quick way to tell: `nc -zv -w 3 host port`. "Connection refused" is instant. "Connection timed out" takes 3 seconds (your timeout). The speed of the failure tells you which layer is broken.

### PowerShell — Get-NetTCPConnection for socket inspection and connection counts

#### Get-NetTCPConnection -State Listen — list listening ports with process names

```powershell
Get-NetTCPConnection -State Listen | Sort-Object LocalPort |
    Select-Object LocalAddress, LocalPort, OwningProcess,
    @{N='Process';E={(Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName}} |
    Format-Table -AutoSize
```

#### Get-NetTCPConnection -State Established — show active SQL Server connections

```powershell
Get-NetTCPConnection -LocalPort 1433 -State Established |
    Select-Object LocalAddress, LocalPort, RemoteAddress, RemotePort |
    Format-Table -AutoSize
```

#### Get-NetTCPConnection | Group-Object — count connections per remote address

```powershell
Get-NetTCPConnection -LocalPort 1433 -State Established |
    Group-Object RemoteAddress | Sort-Object Count -Descending |
    Select-Object Count, Name
```

#### Get-NetTCPConnection | Group-Object State — connection state breakdown

> [!info] Shows how many connections are in each TCP state (Listen, Established, TimeWait).
> A quick health check equivalent to `ss -s` on Linux.

```powershell
Get-NetTCPConnection -LocalPort 1433 | Group-Object State |
    Select-Object Count, Name
```

## Related
- [[connectivity-testing]] — test reachability before reading socket state
- [[firewalls]] — when sockets show nothing listening but you expected something
- [[iap-tunneling]] — understanding IAP proxy addresses in established connections
- [[viewing-processes]] — find which process owns a socket (combine with `ss -p`)
