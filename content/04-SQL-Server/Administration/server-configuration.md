---
type: how-to
category: sql-server
technology: [sql-server]
tags: [sql, sql-server, tsql]
aliases: [SQL Server configuration, max server memory, sp_configure, mssql-conf, RCSI, Read Committed Snapshot Isolation, TempDB configuration, swappiness, THP]
keywords: [max server memory, sp_configure, mssql-conf, RCSI, Read Committed Snapshot Isolation, TempDB files, swappiness, transparent huge pages, THP, IO scheduler, trace flags, recovery model, memory limit, buffer pool, Linux optimization, GCP]
description: "Non-negotiable SQL Server configuration settings: max server memory, RCSI, TempDB, recovery models, and Linux OS tuning (swappiness, THP, I/O scheduler) for SQL Server on Linux GCP."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Server Configuration

> [!quote]
> "Configuration is the silent killer of production systems — most outages are caused not by code bugs, but by misconfiguration."
> — **John Allspaw**

These are the non-negotiable configuration settings that every production SQL Server instance must have in place before going live. Skipping any of these leads to data corruption, OOM crashes, or unrecoverable failures. When provisioning the underlying VM with [Terraform](https://alp78.github.io/elysium/07-Terraform/GCP-Resources/terraform-compute), these config requirements should be reflected in the VM spec (machine type, disk size, resource limits).

---

## Tier 1: Non-Negotiable (Do Before Going to Production)

### Set Max Server Memory

SQL Server will consume every byte of available memory and never release it without a restart. On a shared VM (with Datadog agent, OS processes), this causes OOM kills. See [memory-and-buffer-pool](https://alp78.github.io/elysium/04-SQL-Server/Performance/memory-and-buffer-pool) for how the buffer pool uses the memory allocated here.

**Rule:** `max server memory = Total RAM − 1 GB` (minimum). On a 2 GB VM: 768–1024 MB. On an 8 GB VM: 6144 MB.

| Total VM RAM | max server memory (MB) | OS/Agent Reserve |
|--------------|------------------------|------------------|
| 2 GB         | 1024                   | ~900 MB          |
| 4 GB         | 2560                   | 1.5 GB           |
| 8 GB         | 6144                   | 2 GB             |
| 16 GB        | 12288                  | 4 GB             |
| 32 GB        | 26624                  | 6 GB             |

#### mssql-conf set memory.memorylimitmb — set max memory (requires restart)

```bash
# Set memory limit (leave ~900 MB for OS + Datadog agent)
# Example: 2 GB VM → 1024 MB for SQL Server
sudo /opt/mssql/bin/mssql-conf set memory.memorylimitmb 1024
sudo systemctl restart mssql-server
```

#### sp_configure 'max server memory' — set max memory (immediate, no restart)

```sql
EXEC sp_configure 'show advanced options', 1;
RECONFIGURE;
EXEC sp_configure 'max server memory', 1024;  -- MB
RECONFIGURE;
```

#### sp_configure — verify current max memory setting

```sql
EXEC sp_configure 'show advanced options', 1;
RECONFIGURE;
EXEC sp_configure 'max server memory';
-- run_value = 2147483647 means UNLIMITED (dangerous!)
-- run_value = 1024 means 1024 MB (correct)
```

> [!warning] Never Skip This Setting
>
> Without `max server memory`, SQL Server claims all available RAM on the VM. The OS runs out of memory, the OOM killer fires, and the process crashes. This is one of the 7 Deadly Sins of SQL Server.

> [!tip] mssql-conf vs sp_configure
>
> `sp_configure` takes effect immediately and persists, but gets overridden by `mssql-conf` on next restart if both are set. `mssql-conf` requires a restart to apply. Pick one method and stick with it.

---

### Recovery Model

Choose deliberately between FULL and SIMPLE. Never leave a database in FULL recovery without log backups — the log file will grow until it fills the disk.

```sql
-- Check current recovery model
SELECT name, recovery_model_desc FROM sys.databases WHERE name = 'analytics_db';

-- Switch to SIMPLE (idempotent pipeline, data reproducible from source)
ALTER DATABASE [analytics_db] SET RECOVERY SIMPLE;

-- Switch to FULL (production, point-in-time recovery needed)
ALTER DATABASE [analytics_db] SET RECOVERY FULL;
-- IMPORTANT: After switching to FULL, immediately take a full backup
-- to start the log chain. PITR is impossible without it.
```

See [backup-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/Administration/backup-types-and-strategy) for the full decision matrix.

---

### Enable Read Committed Snapshot Isolation (RCSI)

Without RCSI, readers block writers and writers block readers. Dashboard queries stall while the pipeline writes, and vice versa. RCSI eliminates this entirely with zero code changes — readers use row-version snapshots from TempDB instead of shared locks.

```sql
ALTER DATABASE analytics_db SET READ_COMMITTED_SNAPSHOT ON;
```

> [!tip] RCSI Is Most Impactful
>
> RCSI Is the Single Most Impactful Setting.
> Enabling RCSI eliminates the most common class of deadlocks: reader/writer conflicts. The pipeline (writer) and dashboard (reader) can operate concurrently without blocking each other.

> [!warning] RCSI and TempDB Space
>
> RCSI requires TempDB space to store row versions. Monitor TempDB usage after enabling. A long-running read transaction with RCSI enabled can cause the TempDB version store to grow indefinitely.

---

### Every Table Must Have a Clustered Index

A table without a clustered index is a **heap**. Heaps have no physical order — every query scans every page. Every table in silver and gold layers must have a clustered index.

```sql
-- Check for heaps (tables without clustered indexes)
SELECT SCHEMA_NAME(t.schema_id) + '.' + t.name AS table_name, p.rows
FROM sys.tables t
JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id = 0
WHERE p.rows > 0
ORDER BY p.rows DESC;
-- If ANY silver/gold table appears here, fix it immediately.
```

See [index-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/index-types-and-strategy) for clustered index key selection.

---

### Update Statistics After Bulk Loads

Stale statistics cause the optimizer to make wrong choices. After every pipeline run that inserts or updates more than 10% of a table, update statistics.

```sql
-- After pipeline completes
UPDATE STATISTICS gold.scores_daily WITH FULLSCAN;
UPDATE STATISTICS gold.index_performance WITH FULLSCAN;
```

---

## Linux OS Tuning (for SQL Server on Linux)

Three Linux settings with outsized impact on SQL Server performance. Wrong defaults cause random latency spikes, I/O stalls, and memory thrashing. When running SQL Server in Docker, [container resource limits](https://alp78.github.io/elysium/09-Docker/container-lifecycle) (memory limits, CPU quotas) mirror these OS-level tuning concerns.

### Swappiness

Linux default swappiness (60) causes SQL Server buffer pool pages to be swapped to disk, destroying performance.

```bash
# Check current value
cat /proc/sys/vm/swappiness
# Expected: 60 (default — bad for SQL Server)

# Set to 1 (minimal swap, only to avoid OOM)
sudo sysctl vm.swappiness=1

# Persist across reboots
echo 'vm.swappiness = 1' | sudo tee -a /etc/sysctl.d/99-sqlserver.conf
sudo sysctl --system

# Verify
cat /proc/sys/vm/swappiness
# Expected: 1
```

> [!warning] Never Set Swappiness to 0
>
> This completely disables swap and the OOM killer will terminate SQL Server under memory pressure. The value `1` means "swap only as a last resort."

### Transparent Huge Pages (THP)

Microsoft recommends disabling THP for SQL Server on Linux. THP causes latency spikes during page compaction.

```bash
# Check current state
cat /sys/kernel/mm/transparent_hugepage/enabled
# Bad:    [always] madvise never
# Good:   always madvise [never]

# Disable immediately
echo never | sudo tee /sys/kernel/mm/transparent_hugepage/enabled
echo never | sudo tee /sys/kernel/mm/transparent_hugepage/defrag

# Persist via systemd service
sudo tee /etc/systemd/system/disable-thp.service << 'EOF'
[Unit]
Description=Disable Transparent Huge Pages
DefaultDependencies=no
After=sysinit.target local-fs.target
Before=mssql-server.service

[Service]
Type=oneshot
ExecStart=/bin/sh -c 'echo never > /sys/kernel/mm/transparent_hugepage/enabled && echo never > /sys/kernel/mm/transparent_hugepage/defrag'

[Install]
WantedBy=basic.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable disable-thp
```

### I/O Scheduler

For SSD-backed disks (pd-ssd, local-ssd), use `none` (noop) or `mq-deadline`. The default `bfq` or `cfq` adds unnecessary overhead for cloud SSDs.

```bash
# Check current scheduler per device
cat /sys/block/sdb/queue/scheduler
# Example output: [mq-deadline] kyber bfq none

# Set to none (best for NVMe/SSD)
echo none | sudo tee /sys/block/sdb/queue/scheduler

# Persist via udev rule
sudo tee /etc/udev/rules.d/60-io-scheduler.rules << 'EOF'
# Set noop scheduler for all SSD/NVMe devices
ACTION=="add|change", KERNEL=="sd[a-z]", ATTR{queue/rotational}=="0", ATTR{queue/scheduler}="none"
ACTION=="add|change", KERNEL=="nvme[0-9]*", ATTR{queue/scheduler}="none"
EOF

sudo udevadm control --reload-rules
sudo udevadm trigger
```

---

### TempDB Configuration

Best practice: create one TempDB data file per logical CPU core (up to 8), all equally sized. This reduces PFS/GAM/SGAM page contention.

```sql
-- Add tempdb data files (run once, persists until server restart wipes tempdb)
ALTER DATABASE tempdb ADD FILE (
    NAME = 'tempdev2', FILENAME = '/var/opt/mssql/data/tempdb2.ndf',
    SIZE = 100MB, FILEGROWTH = 50MB
);
-- Repeat for tempdev3, tempdev4, etc.
```

Or configure in `mssql.conf` (persistent across restarts):

```ini
[tempdb]
data_directory = /var/opt/mssql/data
initial_size_mb = 100
number_of_files = 4
```

---

### Trace Flags

Recommended trace flags for SQL Server 2022 on Linux:

```bash
sudo /opt/mssql/bin/mssql-conf traceflag 3226 1222 460 on
sudo systemctl restart mssql-server
```

| Flag | Purpose |
|------|---------|
| **3226** | Suppress successful backup messages in error log (reduces log noise) |
| **1222** | Log deadlock graphs in error log in XML format |
| **460** | Replace truncation error messages with actionable detail (column name, actual length) |

---

### Complete sysctl Reference

Full `/etc/sysctl.d/99-sqlserver.conf` for SQL Server 2022 on Linux (GCP):

```ini
# /etc/sysctl.d/99-sqlserver.conf — SQL Server 2022 on Linux (GCP)

# Swap only as absolute last resort
vm.swappiness = 1

# Reduce tendency to reclaim dentry/inode caches
vm.vfs_cache_pressure = 50

# Dirty page writeback — tune for batch ingestion
vm.dirty_ratio = 40
vm.dirty_background_ratio = 10

# Network buffers
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.core.rmem_default = 1048576
net.core.wmem_default = 1048576
net.ipv4.tcp_rmem = 4096 1048576 16777216
net.ipv4.tcp_wmem = 4096 1048576 16777216
net.core.somaxconn = 4096
net.core.netdev_max_backlog = 5000

# ARP cache for VPC networking
net.ipv4.neigh.default.gc_thresh1 = 4096
net.ipv4.neigh.default.gc_thresh2 = 8192
net.ipv4.neigh.default.gc_thresh3 = 16384
```

---

### The 7 Deadly Sins of SQL Server

| Sin | Why it kills you |
|-----|-----------------|
| **`SELECT *` in production queries** | Reads every column from every page, prevents covering indexes from working, wastes buffer pool space |
| **No clustered index (heap tables)** | Every query is a full table scan regardless of WHERE clause |
| **Functions on columns in WHERE** | Forces full index scan instead of seek — 100x+ more I/O |
| **Long-running open transactions** | Holds locks for the entire duration, blocks everything else, version store bloat with RCSI |
| **No `max server memory` limit** | SQL Server claims all RAM, OS starves, OOM killer fires, database crashes |
| **FULL recovery with no log backups** | Transaction log grows until disk is full, then all writes fail |
| **Deploying without reading the execution plan** | You're guessing. The optimizer is smarter than you, but only if statistics are current and queries are SARGable |

---

### Related

- [memory-and-buffer-pool](https://alp78.github.io/elysium/04-SQL-Server/Performance/memory-and-buffer-pool) — how the buffer pool uses max server memory
- [backup-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/Administration/backup-types-and-strategy) — recovery model implications for backup strategy
- [blocking-and-locking](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/blocking-and-locking) — RCSI and its effect on lock contention
- [storage-internals](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/storage-internals) — TempDB internals and WAL mechanics
