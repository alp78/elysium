---
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell, bash, linux, powershell]
aliases: [free, vmstat, iostat, iotop, lscpu, uptime, load average, memory monitoring, disk IO]
keywords: [free, vmstat, iostat, iotop, lscpu, uptime, load average, memory, CPU, disk I/O, buffer cache, swap, available memory, page life expectancy, PLE, SQL Server memory, OOM killer, performance monitoring, Get-Counter]
description: "Linux and PowerShell commands for monitoring memory, CPU, and disk I/O. Explains the 'available' vs 'free' memory distinction, load average interpretation, and how to read iostat for disk saturation."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# System Resources — Memory, CPU, and Disk I/O

Resource monitoring tells you whether performance problems are CPU-bound, memory-constrained, or I/O-limited — three different root causes requiring completely different fixes. Reading the numbers correctly is as important as knowing which commands to run.

> [!quote]
> "Memory is like an orgasm. It's a lot better if you don't have to fake it."
>
> — **Seymour Cray** (on virtual memory)
>
> "Anyone can build a fast CPU. The trick is to build a fast system."
>
> — **Seymour Cray**, attributed remark (c. 1980s)

## Linux — free, lscpu, uptime, vmstat, iostat, iotop

#### free -h — memory usage and available RAM

> [!warning] Available matters, not free
>
> Linux uses free memory as disk cache (`buff/cache`). This is **good** — it speeds up
> reads. `available` = free + reclaimable cache = how much memory apps can actually use.
> If `available` < 500MB on a database server, you're in danger of OOM kills.
> If swap `used` > 0, the server is already under memory pressure.

```bash
free -h
```

#### lscpu, uptime — CPU info and load average

> [!info] CPU capacity check
>
> `lscpu` shows cores × threads = total parallel capacity. If `uptime` load
> average exceeds this number, the CPU is oversubscribed.

```bash
lscpu
```

> [!info] Load average interpretation
>
> Load average = runnable processes averaged over 1, 5, and 15 minutes. Compare
> to CPU count: on a 2-core machine, load 2.0 = 100% utilized, load 4.0 = overloaded.
> If 1-min > 15-min, load is increasing (getting worse).

```bash
uptime
```

#### vmstat — combined CPU/memory/IO snapshot

> [!info] vmstat key columns
>
> - **r** — processes waiting for CPU (high = CPU-bound)
> - **b** — processes blocked on I/O (high = I/O-bound)
> - **si/so** — swap in/out (should be zero — any swap activity = memory pressure)
> - **wa** — CPU time spent waiting for I/O (>20% = disk bottleneck)
> - **st** — stolen time (>0 on VMs = hypervisor overcommit)

```bash
vmstat 2 5    # sample every 2 seconds, 5 samples
```

#### iostat -xz — disk I/O performance and utilization

> [!info] iostat key columns
>
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

> [!tip] SQL Server memory behavior
>
> SQL Server intentionally grabs as much memory as possible and holds it. This is BY DESIGN -- it's using the RAM as a buffer pool cache. `free -h` will show almost all memory as "used," which looks alarming but is correct behavior. For deeper analysis of buffer pool health, cache hit ratios, and memory grants, see [memory-and-buffer-pool](https://alp78.github.io/elysium/04-SQL-Server/Performance/memory-and-buffer-pool).
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

For automated monitoring of these same metrics (CPU, memory, disk I/O) with alerting and dashboards, see [datadog-sql-server-integration](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-sql-server-integration). To tune SQL Server's memory ceiling and prevent it from starving the OS, see [max server memory configuration](https://alp78.github.io/elysium/04-SQL-Server/Administration/server-configuration).

## Related
- [viewing-processes](https://alp78.github.io/elysium/01-Shell/Process-Management/viewing-processes) — identify which processes are consuming the resources
- [killing-processes](https://alp78.github.io/elysium/01-Shell/Process-Management/killing-processes) — terminate runaway processes consuming excess resources
- [managing-services](https://alp78.github.io/elysium/01-Shell/Process-Management/managing-services) — check if OOM kills are crashing services
