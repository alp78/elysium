---
type: concept
category: foundations
technology: [bash, powershell, gcp]
tags: [testing, shell, bash, gcp]
aliases: [netcat, nc, ping, traceroute, mtr, dig, DNS, port testing, TCP test, ss, connectivity]
keywords: [netcat, nc, ping, traceroute, mtr, dig, DNS lookup, port testing, TCP test, ss, connectivity, connection refused, connection timed out, /dev/tcp, Test-NetConnection, Resolve-DnsName, network debugging, firewall, GCP firewall rules]
description: "Systematic network connectivity debugging from DNS resolution through TCP port reachability to application-level authentication. Covers netcat, dig, traceroute, mtr, ss, and PowerShell Test-NetConnection."
related: ["[[firewalls]]", "[[socket-inspection]]", "[[iap-tunneling]]", "[[http-requests-and-apis]]" ]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Connectivity Testing — "Can I Reach the Server?"

The first question in any network debugging session is: "Can my client reach the server at all?" This seems simple, but there are multiple layers that can fail: DNS resolution, TCP routing, firewall rules, and the service itself. Working through the layers systematically turns a 2-hour debugging session into a 5-minute one.

## Linux — nc, dig, traceroute, mtr, ss

#### nc (netcat) — testing port reachability

```bash
# Test if a specific port is reachable (the single most useful network command)
nc -zv hostname 1433
# nc = netcat — the Swiss Army knife of networking
# -z = scan mode (don't send data, just check if the port is open)
# -v = verbose (shows "Connection to hostname 1433 port [tcp/ms-sql-s] succeeded!")
# Use case: "Can my pipeline VM reach the SQL Server VM on port 1433?"

# With timeout (don't hang for 60 seconds on unreachable hosts)
nc -zv -w 5 hostname 1433
# -w 5 = timeout after 5 seconds

# Alternative: bash built-in TCP test (no netcat required)
timeout 5 bash -c "echo > /dev/tcp/hostname/1433" && echo "OPEN" || echo "CLOSED"
# /dev/tcp/host/port = bash pseudo-device for TCP connections
# timeout 5 = abort after 5 seconds (prevents hanging)
# Works on every Linux system without installing extra packages

# Test multiple ports at once
for port in 1433 5432 6379 8080; do
    nc -zv -w 3 hostname $port 2>&1 | grep -E "succeeded|refused|timed out"
done
# Quick sweep of common data engineering ports:
# 1433 = SQL Server, 5432 = PostgreSQL, 6379 = Redis, 8080 = Airflow webserver
```

#### dig — DNS lookup and record queries

```bash
# DNS lookup
dig +short hostname
# dig = DNS lookup tool (more detailed than nslookup)
# +short = just the IP address, skip all the DNS metadata

dig hostname A           # A record (IPv4 address)
dig hostname CNAME       # CNAME record (alias)
dig @8.8.8.8 hostname    # query specific DNS server (Google's)
# Use case: "Is DNS resolving our internal hostname correctly?"
```

#### traceroute, mtr, ss — network path tracing and listening ports

```bash
# Trace the network path (where is the packet getting lost?)
traceroute hostname
# Shows each network hop between you and the destination
# If the trace stops at a specific hop, that's where the firewall or routing issue is
# Timeout lines (***) = the hop is blocking ICMP or the packet is being dropped

# Better alternative: mtr (combines ping + traceroute)
mtr -c 10 hostname
# -c 10 = send 10 probes
# Shows: loss%, latency per hop, jitter
# Look for: sudden latency increase at a specific hop = bottleneck
# Look for: packet loss at a specific hop = congestion or drops

# Show listening ports on the local machine
ss -tlnp
# ss = socket statistics (modern replacement for netstat)
# -t = TCP only
# -l = listening sockets only
# -n = numeric addresses (don't resolve hostnames — much faster)
# -p = show process name and PID
# Use case: "Is SQL Server actually listening on port 1433?"
# Typical output: LISTEN  0  128  0.0.0.0:1433  users:(("sqlservr",pid=1234,fd=5))
```

## Production Scenario — Pipeline Can't Connect to the Database

```bash
# Systematic debugging (work through the network stack)

# 1. Can we resolve the hostname?
dig +short data-pipeline-sql
# If empty: DNS problem. Check /etc/resolv.conf, VPC DNS settings

# 2. Can we reach the IP?
ping -c 3 10.132.0.2
# If timeout: routing problem, firewall, or VM is down

# 3. Can we reach the port?
nc -zv -w 5 10.132.0.2 1433
# If refused: SQL Server is not running, or listening on different port
# If timeout: GCP firewall rule blocking port 1433

# 4. Can we authenticate? (see [[sql-server-authentication]] for login types and troubleshooting)
sqlcmd -S 10.132.0.2 -U sa -P "$SA_PASSWORD" -d data-pipeline -Q "SELECT 1" -l 10
# -l 10 = login timeout 10 seconds
# If "Login failed": wrong credentials
# If "Cannot open database": database doesn't exist
# If timeout: connection pool exhausted, or server overloaded

# 5. Check GCP firewall rules (from local machine)
gcloud compute firewall-rules list --filter="direction=INGRESS" --format="table(name,network,direction,allowed,sourceRanges)"
# Look for a rule allowing TCP:1433 from your source IP/range
```

## The "It Works from My Machine" Problem

> [!warning] The "It Works from My Machine" Problem
> If your pipeline fails to connect but you can connect manually from the same VM, check:
> 1. **User context:** Your manual test runs as your user; the pipeline runs as a service account or different user. Different users may have different network namespaces (Docker), proxy settings (`http_proxy` env var), or firewall rules.
> 2. **DNS:** Your `/etc/hosts` may have an entry that the pipeline's container doesn't.
> 3. **Connection pool exhaustion:** The pipeline may have used all available connections. Check: `SELECT COUNT(*) FROM sys.dm_exec_sessions WHERE is_user_process = 1`
> 4. **TCP keepalive:** Idle connections through a load balancer or NAT gateway are silently dropped after a timeout (often 5 minutes). The pipeline thinks the connection is alive, but the network has closed it. Fix: set connection pool idle timeout lower than the NAT timeout.

## PowerShell

```powershell
# Test port connectivity
Test-NetConnection -ComputerName hostname -Port 1433
# Returns: TcpTestSucceeded: True/False
# Also shows: source IP, remote IP, latency

# Quick version (just success/fail)
(Test-NetConnection -ComputerName 10.132.0.2 -Port 1433 -WarningAction SilentlyContinue).TcpTestSucceeded

# DNS lookup
Resolve-DnsName hostname
# Returns: Name, Type, IPAddress, TTL

# Trace route
Test-NetConnection -ComputerName hostname -TraceRoute
# Shows each hop like traceroute

# Listening ports
Get-NetTCPConnection -State Listen | Sort-Object LocalPort |
    Select-Object LocalPort, OwningProcess,
    @{N='Process';E={(Get-Process -Id $_.OwningProcess).ProcessName}}
```

For a broader systematic diagnosis approach that goes beyond network connectivity into application and query-level troubleshooting, see [[troubleshooting-flowcharts]].

## Related
- [[firewalls]] — when `nc` shows timeout (packet blocked, not refused)
- [[socket-inspection]] — deeper analysis of connection states
- [[iap-tunneling]] — connecting to VMs with no public IP
- [[http-requests-and-apis]] — testing REST API connectivity with curl
