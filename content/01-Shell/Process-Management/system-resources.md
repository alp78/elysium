---
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell, bash, linux, powershell]
aliases: [free, vmstat, iostat, iotop, lscpu, uptime, load average, memory monitoring, disk IO]
keywords: [free, vmstat, iostat, iotop, lscpu, uptime, load average, memory, CPU, disk I/O, buffer cache, swap, available memory, page life expectancy, PLE, SQL Server memory, OOM killer, performance monitoring, Get-Counter]
description: "Linux and PowerShell commands for monitoring memory, CPU, and disk I/O. Explains the 'available' vs 'free' memory distinction, load average interpretation, and how to read iostat for disk saturation."
related: ["[[viewing-processes]]", "[[killing-processes]]", "[[managing-services]]" ]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# System Resources — Memory, CPU, and Disk I/O

Resource monitoring tells you whether performance problems are CPU-bound, memory-constrained, or I/O-limited — three different root causes requiring completely different fixes. Reading the numbers correctly is as important as knowing which commands to run.

## Linux — free, lscpu, uptime, vmstat, iostat, iotop

#### free -h — memory usage and available RAM

```bash
# Memory — the command you'll run most often on database servers
free -h
# Output:
#                total    used    free    shared  buff/cache   available
# Mem:           3.8Gi    2.4Gi   1.2Gi   22Mi    534Mi        1.4Gi
# Swap:          0B       0B      0B
#
# KEY INSIGHT: "available" is the number that matters, NOT "free"
# Linux uses free memory as disk cache (buff/cache). This is GOOD — it speeds up reads.
# "available" = free + reclaimable cache = how much memory your apps can actually use
# If "available" < 500MB on a database server, you're in danger of OOM kills
# If swap is being used (used > 0), your server is already under memory pressure
```

#### lscpu, uptime — CPU info and load average

```bash
# CPU info
lscpu
# Shows: architecture, cores, threads, model, MHz, cache sizes
# Critical check: cores × threads = total parallel capacity
# If load average (from uptime) > this number, the CPU is oversubscribed

# Uptime and load average
uptime
#  14:23:01 up 45 days, load average: 1.82, 2.15, 1.96
# Load average = number of runnable processes averaged over 1, 5, and 15 minutes
# Compare to CPU count: on a 2-core machine, load 2.0 = 100% utilized, load 4.0 = overloaded
# Trend: if 1-min > 15-min, load is increasing (getting worse)
```

#### vmstat — combined CPU/memory/IO snapshot

> [!info] `vmstat` key columns
> - **r** — processes waiting for CPU (high = CPU-bound)
> - **b** — processes blocked on I/O (high = I/O-bound)
> - **si/so** — swap in/out (should be zero — any swap activity = memory pressure)
> - **wa** — CPU time spent waiting for I/O (>20% = disk bottleneck)
> - **st** — stolen time (>0 on VMs = hypervisor overcommit)

```bash
vmstat 2 5    # sample every 2 seconds, 5 samples
```

#### iostat -xz — disk I/O performance and utilization

> [!info] `iostat` key columns
> - **r/s, w/s** — reads and writes per second
> - **rkB/s, wkB/s** — throughput in KB/s
> - **await** — average I/O wait time in ms (SSD: <5ms normal, >20ms saturated; HDD: 10-20ms normal, >50ms severe)
> - **%util** — percentage of time device is busy (>90% = the bottleneck, no amount of CPU/memory helps)

```bash
iostat -xz 2    # -x = extended stats, -z = suppress idle devices, 2 = every 2 seconds

# iotop — per-process I/O (who's doing the disk I/O?)
sudo iotop -o   # -o = only show processes with active I/O
```

### SQL Server memory interpretation — why free -h looks alarming but is normal

> [!tip] Reading Memory on a SQL Server VM
> SQL Server intentionally grabs as much memory as possible and holds it. This is BY DESIGN -- it's using the RAM as a buffer pool cache. `free -h` will show almost all memory as "used," which looks alarming but is correct behavior. For deeper analysis of buffer pool health, cache hit ratios, and memory grants, see [[memory-and-buffer-pool]].
>
> The real question is: "Does SQL Server have ENOUGH memory?" Check Page Life Expectancy (PLE):
> ```sql
> SELECT cntr_value AS PLE_seconds
> FROM sys.dm_os_performance_counters
> WHERE counter_name = 'Page life expectancy'
>   AND object_name LIKE '%Buffer Manager%';
> ```
> PLE > 300 seconds = healthy. PLE < 60 seconds = SQL Server is constantly evicting pages from cache = not enough memory.

### PowerShell — Get-CimInstance, Get-Counter for memory, CPU, and disk I/O

```powershell
# Memory
$os = Get-CimInstance Win32_OperatingSystem
[PSCustomObject]@{
    'Total (GB)' = [math]::Round($os.TotalVisibleMemorySize/1MB, 1)
    'Free (GB)'  = [math]::Round($os.FreePhysicalMemory/1MB, 1)
    'Used %'     = [math]::Round((1 - $os.FreePhysicalMemory/$os.TotalVisibleMemorySize)*100)
}

# CPU utilization (current)
Get-Counter '\Processor(_Total)\% Processor Time' -SampleInterval 2 -MaxSamples 5

# Disk I/O
Get-Counter '\PhysicalDisk(*)\Disk Reads/sec','\PhysicalDisk(*)\Disk Writes/sec',
    '\PhysicalDisk(*)\Avg. Disk sec/Read','\PhysicalDisk(*)\Avg. Disk sec/Write'
```

For automated monitoring of these same metrics (CPU, memory, disk I/O) with alerting and dashboards, see [[datadog-sql-server-integration]]. To tune SQL Server's memory ceiling and prevent it from starving the OS, see [[server-configuration|max server memory configuration]].

## Related
- [[viewing-processes]] — identify which processes are consuming the resources
- [[killing-processes]] — terminate runaway processes consuming excess resources
- [[managing-services]] — check if OOM kills are crashing services
