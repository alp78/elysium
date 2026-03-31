---
type: concept
category: foundations
technology: [bash, powershell, gcp]
tags: [testing, shell, bash, linux, powershell, gcp, networking]
aliases: [netcat, nc, ping, traceroute, mtr, dig, DNS, port testing, TCP test, ss, connectivity]
keywords: [netcat, nc, ping, traceroute, mtr, dig, DNS lookup, port testing, TCP test, ss, connectivity, connection refused, connection timed out, /dev/tcp, Test-NetConnection, Resolve-DnsName, network debugging, firewall, GCP firewall rules]
description: "Systematic network connectivity debugging from DNS resolution through TCP port reachability to application-level authentication. Covers netcat, dig, traceroute, mtr, ss, and PowerShell Test-NetConnection."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Connectivity Testing — "Can I Reach the Server?"

The first question in any network debugging session is: "Can my client reach the server at all?" This seems simple, but there are multiple layers that can fail: DNS resolution, TCP routing, firewall rules, and the service itself. Working through the layers systematically turns a 2-hour debugging session into a 5-minute one.

> [!quote]
> "Everything fails, all the time."
> — **Werner Vogels**, AWS re:Invent keynote (2012)

## Linux — nc, dig, traceroute, mtr, ss

#### nc (netcat) — testing port reachability

> [!info] nc (netcat) flags
>
> - `-z` — scan mode (don't send data, just check if the port is open)
> - `-v` — verbose (shows "succeeded!" or "refused")
> - `-w 5` — timeout after 5 seconds (don't hang on unreachable hosts)

```bash
nc -zv -w 5 hostname 1433
```

> [!tip] Refused vs timed out diagnosis
>
> - **Refused** = the host is reachable but nothing is listening on that port (service
>   down, wrong port number)
> - **Timed out** = packets are being dropped (firewall rule, host unreachable, wrong IP)
>
> "Refused" is good news — the host is alive. "Timed out" means a network-layer problem.

#### bash /dev/tcp — port test without netcat installed

> [!info] Bash /dev/tcp built-in
>
> Bash has a built-in TCP pseudo-device. No external tools needed — works on
> minimal containers and Docker images where netcat isn't installed.

```bash
timeout 5 bash -c "echo > /dev/tcp/hostname/1433" && echo "OPEN" || echo "CLOSED"
```

#### nc port sweep — test multiple data engineering ports at once

> [!info] Port sweep for diagnostics
>
> Sweeps common data engineering ports in a loop. Useful as a first diagnostic
> when connecting to a new VM or after firewall changes.

```bash
for port in 1433 5432 6379 8080; do
    nc -zv -w 3 hostname $port 2>&1 | grep -E "succeeded|refused|timed out"
done
```

#### dig — DNS lookup and record queries

> [!info] dig DNS lookup
>
> `dig` queries DNS records. `+short` strips all metadata and returns just the
> answer. Use `@8.8.8.8` to query Google's public DNS — useful when you suspect your
> local DNS is stale or broken.

```bash
dig +short hostname
dig hostname A
dig @8.8.8.8 hostname
```

> [!warning] dig +short may return CNAME
>
> If the hostname is a CNAME alias, `dig +short` returns the alias target, not the IP.
> Chain them: `dig +short hostname` → returns CNAME → `dig +short that-cname` → returns
> IP. Or use `dig +short hostname A` to force A-record resolution.

#### traceroute, mtr, ss — network path tracing and listening ports

#### traceroute — trace the network path to a host

> [!info] traceroute hop analysis
>
> Shows each network hop between you and the destination. If the trace stops at
> a specific hop, that's where the firewall or routing issue is. `***` lines mean the hop
> is blocking ICMP or dropping packets.

```bash
traceroute hostname
```

> [!warning] traceroute uses UDP by default
>
> Use `traceroute -T` for TCP-based tracing (more likely to pass through firewalls).
> On GCP, ICMP is often blocked between VPCs — TCP traceroute gives more reliable results.

#### mtr — combines ping + traceroute in real time

> [!info] mtr real-time path analysis
>
> `mtr` continuously probes each hop and shows loss percentage, latency, and
> jitter. A sudden latency jump at a specific hop = bottleneck. Packet loss at a hop =
> congestion or drops. Install with `apt install mtr`.

```bash
mtr -c 10 hostname
```

#### ss -tlnp — show listening ports on the local machine

> [!info] ss listening port check
>
> `ss` is the modern replacement for `netstat`. Flags: `-t` = TCP, `-l` = listening,
> `-n` = numeric (don't resolve names), `-p` = show process. Use this to verify that the
> service you're trying to reach is actually listening on the expected port. For deeper
> connection state analysis, see [socket-inspection](https://alp78.github.io/elysium/01-Shell/Networking/socket-inspection).

```bash
ss -tlnp
```

### Debugging a failed database connection — systematic network stack walkthrough

```bash
# Systematic debugging (work through the network stack)

# 1. Can we resolve the hostname?
dig +short data-pipeline-sql
# If empty: DNS problem. Check /etc/resolv.conf, VPC DNS settings

# 2. Can we reach the IP? (ICMP may be blocked — see warning below)
ping -c 3 10.132.0.2
# If timeout: routing problem, firewall, or VM is down

# 3. Can we reach the port?
nc -zv -w 5 10.132.0.2 1433
# If refused: SQL Server is not running, or listening on different port
# If timeout: GCP firewall rule blocking port 1433

# 4. Can we authenticate? (see [sql-server-authentication](https://alp78.github.io/elysium/04-SQL-Server/Security/sql-server-authentication) for login types and troubleshooting)
sqlcmd -S 10.132.0.2 -U sa -P "$SA_PASSWORD" -d data-pipeline -Q "SELECT 1" -l 10
# -l 10 = login timeout 10 seconds
# If "Login failed": wrong credentials
# If "Cannot open database": database doesn't exist
# If timeout: connection pool exhausted, or server overloaded

# 5. Check GCP firewall rules (from local machine)
gcloud compute firewall-rules list --filter="direction=INGRESS" --format="table(name,network,direction,allowed,sourceRanges)"
# Look for a rule allowing TCP:1433 from your source IP/range
```

> [!warning] ping uses ICMP blocked by GCP
>
> A `ping` timeout does NOT mean the host is unreachable. GCP's default firewall rules
> block ICMP. Skip straight to `nc -zv` (TCP port test) in GCP environments. Only use
> `ping` if you've confirmed ICMP is allowed by a firewall rule.

### The "it works from my machine" problem — user context, DNS, and connection pools

> [!warning] "Works from my machine" problem
>
> If your pipeline fails to connect but you can connect manually from the same VM, check:
> 1. **User context:** Your manual test runs as your user; the pipeline runs as a service account or different user. Different users may have different network namespaces (Docker), proxy settings (`http_proxy` env var), or firewall rules.
> 2. **DNS:** Your `/etc/hosts` may have an entry that the pipeline's container doesn't.
> 3. **Connection pool exhaustion:** The pipeline may have used all available connections. Check: `SELECT COUNT(*) FROM sys.dm_exec_sessions WHERE is_user_process = 1`
> 4. **TCP keepalive:** Idle connections through a load balancer or NAT gateway are silently dropped after a timeout (often 5 minutes). The pipeline thinks the connection is alive, but the network has closed it. Fix: set connection pool idle timeout lower than the NAT timeout.

## PowerShell — Test-NetConnection, Resolve-DnsName

#### Test-NetConnection — test port reachability

> [!info] Test-NetConnection output
>
> Returns a rich object with `TcpTestSucceeded`, source IP, remote IP, and
> latency. The verbose output is helpful for debugging; the `.TcpTestSucceeded` property
> is useful in scripts.

```powershell
Test-NetConnection -ComputerName hostname -Port 1433
```

> [!warning] Test-NetConnection is slow
>
> Each call has a built-in timeout. For sweeping multiple ports, this is painfully slow
> compared to `nc`. Use `[System.Net.Sockets.TcpClient]` for faster programmatic checks
> in PowerShell scripts.

```powershell
(Test-NetConnection -ComputerName 10.132.0.2 -Port 1433 `
    -WarningAction SilentlyContinue).TcpTestSucceeded
```

#### Resolve-DnsName — DNS lookup

> [!info] Resolve-DnsName output
>
> Returns structured objects with `Name`, `Type`, `IPAddress`, and `TTL`.

```powershell
Resolve-DnsName hostname
```

#### Test-NetConnection -TraceRoute — trace route to host

```powershell
Test-NetConnection -ComputerName hostname -TraceRoute
```

#### Get-NetTCPConnection — show listening ports with process names

> [!info] PowerShell listening ports
>
> PowerShell equivalent of `ss -tlnp`. Joins connection data with process names
> using `Get-Process`.

```powershell
Get-NetTCPConnection -State Listen | Sort-Object LocalPort |
    Select-Object LocalPort, OwningProcess,
    @{N='Process';E={(Get-Process -Id $_.OwningProcess).ProcessName}}
```

For a broader systematic diagnosis approach that goes beyond network connectivity into application and query-level troubleshooting, see [troubleshooting-flowcharts](https://alp78.github.io/elysium/04-SQL-Server/Performance/troubleshooting-flowcharts).

## Related
- [firewalls](https://alp78.github.io/elysium/01-Shell/Networking/firewalls) — when `nc` shows timeout (packet blocked, not refused)
- [socket-inspection](https://alp78.github.io/elysium/01-Shell/Networking/socket-inspection) — deeper analysis of connection states
- [iap-tunneling](https://alp78.github.io/elysium/01-Shell/Networking/iap-tunneling) — connecting to VMs with no public IP
- [http-requests-and-apis](https://alp78.github.io/elysium/01-Shell/Networking/http-requests-and-apis) — testing REST API connectivity with curl
