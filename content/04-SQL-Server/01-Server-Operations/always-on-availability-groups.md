---
title: "Always On Availability Groups"
tags: [sql-server, gcp, tsql]
aliases: [Always On AG, availability group, AOAG, AG, HA, Pacemaker HA, SQL Server HA, failover clustering, SQL Server Linux HA]
description: "Complete guide to SQL Server Always On Availability Groups on Linux (GCP): architecture, replication modes, step-by-step setup with Pacemaker, essential monitoring DMVs, planned and forced failover operations, read-only routing, and troubleshooting for 5 common issues."
parent: "[[domain-server-operations]]"
links:
  - "[[server-configuration]]"
  - "[[sqlcmd-connection-and-usage]]"
  - "[[essential-dba-queries]]"
  - "[[sql-server-agent-jobs]]"
  - "[[backup-types-and-strategy]]"
  - "[[restore-and-recovery]]"
  - "[[finops-cost-optimization]]"
  - "[[high-availability-overview]]"
  - "[[sql-server-problems]]"
  - "[[troubleshooting-flowcharts]]"
created: 2026-03-22
updated: 2026-04-04
status: complete
---

# Always On Availability Groups

> [!quote]
> "High availability is not about preventing failure — it is about recovering from failure faster than your users notice."
>
> — **Adrian Cockcroft**, Netflix tech blog

Always On Availability Groups (AGs) are the primary high-availability mechanism for SQL Server on Linux. An AG replicates a group of databases across 2–9 replicas (1 primary + up to 8 secondaries), with the primary accepting reads and writes while secondaries receive and replay transaction log records automatically.

---

## Why High Availability?

A single SQL Server instance is a single point of failure. If the VM crashes, the disk corrupts, or you need to patch the OS, your database is down. HA ensures the database remains accessible during planned maintenance and unplanned outages by maintaining redundant copies of data that can take over automatically.

### RPO, RTO, SLA uptime — key HA metrics

| Metric | Definition | Target |
|--------|-----------|--------|
| **RTO** (Recovery Time Objective) | Maximum acceptable downtime after a failure | Seconds to minutes for HA; hours for DR |
| **RPO** (Recovery Point Objective) | Maximum acceptable data loss (how far back you'd roll back) | 0 for synchronous commit; seconds for async |
| **SLA** | Uptime guarantee expressed as a percentage | 99.9% = ~8.7h/year downtime, 99.99% = ~52min/year |

---

## HA Options for SQL Server 2022 on Linux

SQL Server on Linux supports three HA mechanisms, each with different trade-offs between data loss protection, failover speed, operational complexity, and GCP compatibility. Always On Availability Groups are the recommended choice for most workloads because they provide database-level replication with no shared storage requirement — a critical advantage on GCP where native shared block storage is not available.

### Option 1: Always On Availability Groups (Recommended)

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {
  'primaryColor': '#292e42',
  'primaryTextColor': '#c0caf5',
  'primaryBorderColor': '#565f89',
  'lineColor': '#565f89',
  'secondaryColor': '#1a1b26',
  'tertiaryColor': '#24283b',
  'noteTextColor': '#c0caf5',
  'noteBkgColor': '#292e42',
  'textColor': '#c0caf5',
  'fontSize': '14px'
}}}%%
flowchart TD
    VIP["Listener VIP<br/>analytics-sql-ag.internal:1433"]

    VIP --> PRIMARY
    VIP --> SEC1
    VIP --> SEC2

    PRIMARY["Primary (RW)<br/>analytics-sql-01<br/>zone-b"]
    SEC1["Secondary (RO)<br/>analytics-sql-02<br/>zone-c"]
    SEC2["Secondary (RO)<br/>analytics-sql-03<br/>zone-d"]

    PRIMARY -->|"log send"| SEC1
    PRIMARY -->|"log send"| SEC2
    SEC1 -->|"ack"| PRIMARY
    SEC2 -->|"ack"| PRIMARY

    style VIP fill:#1a1a2e,stroke:#bb9af7,color:#fff
    style PRIMARY fill:#1a1a2e,stroke:#9ece6a,color:#fff
    style SEC1 fill:#1a1a2e,stroke:#7aa2f7,color:#fff
    style SEC2 fill:#1a1a2e,stroke:#7aa2f7,color:#fff
```

#### Synchronous vs asynchronous — AG replication modes

| Mode | How It Works | RPO | Use Case |
|------|-------------|-----|----------|
| **Synchronous commit** | Primary waits for secondary to harden the log before acknowledging the commit to the client | 0 (no data loss) | Same-region secondaries, high-value data |
| **Asynchronous commit** | Primary sends log records but doesn't wait for acknowledgment | > 0 (possible data loss) | Cross-region DR replicas, high-latency links |
| **Configuration-only** | Replica stores AG metadata but not data — acts as a quorum witness | N/A | Third node for automatic failover quorum (avoids needing 3 full replicas) |

**On Linux, Pacemaker replaces Windows Server Failover Clustering (WSFC).** The cluster manager detects failures and triggers failover. SQL Server on Linux uses the `mssql-server-ha` package to integrate with Pacemaker.

### Option 2: Failover Cluster Instance (FCI)

A single SQL Server instance that runs on one node at a time but can fail over to another node. Unlike AGs, FCI uses **shared storage** — both nodes see the same data files.

| Aspect | AG | FCI |
|--------|-----|-----|
| Shared storage | No — each replica has its own copy | Yes — shared disk (or network storage) |
| Database-level | Yes — individual databases can be in different AGs | No — entire instance fails over |
| Readable secondaries | Yes | No |
| GCP implementation | Each VM has its own persistent disk | Requires shared filesystem (GlusterFS, NFS, or iSCSI) |

> [!info] GCP Favors AGs Over FCI
>
> GCP does not offer native shared storage like AWS EBS Multi-Attach or Azure Shared Disks. Setting up GlusterFS or NFS for FCI adds complexity and another failure point. Use AGs.

### Option 3: Log Shipping (Simple DR)

The primary backs up its transaction log on a schedule, copies the backup file to the secondary, and the secondary restores it.

- **RPO**: Minutes to hours (depends on backup frequency)
- **Failover**: Manual — an admin must point applications to the secondary
- **Best for**: DR complement to AGs, not the primary HA solution

### Decision Matrix

| Requirement | AG (Sync) | AG (Async) | FCI | Log Shipping |
|-------------|-----------|-----------|-----|-------------|
| Zero data loss | Yes | No | Yes | No |
| Automatic failover | Yes (with Pacemaker) | No | Yes (with Pacemaker) | No |
| Readable secondary | Yes | Yes | No | With STANDBY |
| No shared storage | Yes | Yes | No | Yes |
| Cross-region DR | Possible | Recommended | No | Yes |
| Simplicity | Medium | Medium | High complexity on GCP | Simple |

---

## Setting Up Always On AGs on Linux (GCP)

The setup follows 8 steps: enable HADR on each instance, create the database mirroring endpoint with certificate authentication, create the AG with the desired replication topology, join secondaries, add databases, and configure Pacemaker as the external cluster manager for automatic failover. All inter-replica communication flows through a single TCP endpoint (port 5022) per instance — the log stream is compressed before transmission.

### Prerequisites

All nodes must have:
- SQL Server 2022 installed with the same version/CU
- The `mssql-server-ha` package installed
- Pacemaker + Corosync installed
- Unique hostnames resolvable by all nodes (via `/etc/hosts` or DNS)
- VPC firewall rules allowing: port 1433 (SQL), 5022 (AG endpoint), 2224 (pcsd), 3121 (Pacemaker), 5405 (Corosync)

### Step 1: Enable HADR on Every Node

Run this on each SQL Server instance. `EXTERNAL` tells SQL Server that an external cluster manager (Pacemaker) handles failover, not WSFC. Verify with `SERVERPROPERTY('IsHadrEnabled')` — it should return 1.

```sql
ALTER SERVER CONFIGURATION SET HADR CLUSTER TYPE = EXTERNAL;

SELECT SERVERPROPERTY('IsHadrEnabled') AS hadr_enabled;
```

### Step 2: Create the Database Mirroring Endpoint on Every Node

```sql
CREATE ENDPOINT [Hadr_endpoint]
    AS TCP (LISTENER_PORT = 5022)
    FOR DATA_MIRRORING (
        ROLE = ALL,
        AUTHENTICATION = CERTIFICATE dbm_cert,
        ENCRYPTION = REQUIRED ALGORITHM AES
    );

ALTER ENDPOINT [Hadr_endpoint] STATE = STARTED;
```

> [!info] Certificate Auth on Linux
>
> AGs on Linux use **certificate-based authentication** (not Windows authentication). You create a certificate on the primary and copy it to all secondaries — Windows Kerberos is not available on Linux.

### Step 3: Create and Export the Certificate (Primary)

On the primary, create a master key, generate the AG endpoint certificate, and export both the certificate and private key to files that will be copied to each secondary.

```sql
CREATE MASTER KEY ENCRYPTION BY PASSWORD = 'StrongMasterKeyP@ss!';

CREATE CERTIFICATE dbm_cert
    WITH SUBJECT = 'AG endpoint certificate';

BACKUP CERTIFICATE dbm_cert
    TO FILE = '/var/opt/mssql/data/dbm_cert.cer'
    WITH PRIVATE KEY (
        FILE = '/var/opt/mssql/data/dbm_cert.pvk',
        ENCRYPTION BY PASSWORD = 'CertP@ss123!'
    );
```

```bash
# Copy certificate files to each secondary
scp /var/opt/mssql/data/dbm_cert.* user@analytics-sql-02:/var/opt/mssql/data/
scp /var/opt/mssql/data/dbm_cert.* user@analytics-sql-03:/var/opt/mssql/data/

# Fix ownership on secondaries
ssh user@analytics-sql-02 'sudo chown mssql:mssql /var/opt/mssql/data/dbm_cert.*'
ssh user@analytics-sql-03 'sudo chown mssql:mssql /var/opt/mssql/data/dbm_cert.*'
```

### Step 4: Import the Certificate on Each Secondary

On each secondary, create a master key and import the certificate and private key that were copied from the primary in the previous step.

```sql
CREATE MASTER KEY ENCRYPTION BY PASSWORD = 'StrongMasterKeyP@ss!';

CREATE CERTIFICATE dbm_cert
    FROM FILE = '/var/opt/mssql/data/dbm_cert.cer'
    WITH PRIVATE KEY (
        FILE = '/var/opt/mssql/data/dbm_cert.pvk',
        DECRYPTION BY PASSWORD = 'CertP@ss123!'
    );
```

### Step 5: Create the Availability Group (Primary)

Run on the primary. `DB_FAILOVER = ON` triggers automatic failover when a critical database error (such as corruption) is detected, without waiting for the cluster manager. `REQUIRED_SYNCHRONIZED_SECONDARIES_TO_COMMIT = 1` ensures at least one synchronous secondary hardens the log before the primary acknowledges a commit.

```sql
CREATE AVAILABILITY GROUP [project_ag]
WITH (
    CLUSTER_TYPE = EXTERNAL,
    DB_FAILOVER = ON,
    REQUIRED_SYNCHRONIZED_SECONDARIES_TO_COMMIT = 1
)
FOR REPLICA ON
    N'analytics-sql-01' WITH (
        ENDPOINT_URL = N'tcp://analytics-sql-01:5022',
        AVAILABILITY_MODE = SYNCHRONOUS_COMMIT,
        FAILOVER_MODE = EXTERNAL,
        SEEDING_MODE = AUTOMATIC,
        SECONDARY_ROLE (ALLOW_CONNECTIONS = READ_ONLY)
    ),
    N'analytics-sql-02' WITH (
        ENDPOINT_URL = N'tcp://analytics-sql-02:5022',
        AVAILABILITY_MODE = SYNCHRONOUS_COMMIT,
        FAILOVER_MODE = EXTERNAL,
        SEEDING_MODE = AUTOMATIC,
        SECONDARY_ROLE (ALLOW_CONNECTIONS = READ_ONLY)
    ),
    N'analytics-sql-03' WITH (
        ENDPOINT_URL = N'tcp://analytics-sql-03:5022',
        AVAILABILITY_MODE = ASYNCHRONOUS_COMMIT,
        FAILOVER_MODE = EXTERNAL,
        SEEDING_MODE = AUTOMATIC,
        SECONDARY_ROLE (ALLOW_CONNECTIONS = READ_ONLY)
    );
```

> [!tip] REQUIRED_SYNCHRONIZED_SECONDARIES_TO_COMMIT
>
> Setting this to 1 prevents data loss during failover — the primary will not acknowledge a commit until at least 1 synchronous secondary has hardened the log. Trade-off: if both synchronous secondaries go down, the primary stops accepting writes. Available since SQL Server 2017.

> [!info] SEEDING_MODE = AUTOMATIC
>
> SQL Server streams the initial database copy over the AG endpoint instead of requiring manual backup/restore. For large databases (100+ GB), manual seeding with backup/restore is faster.

### Step 6: Join Secondaries to the AG

Run on each secondary. `GRANT CREATE ANY DATABASE` allows automatic seeding to create the database on the secondary without manual backup/restore.

```sql
ALTER AVAILABILITY GROUP [project_ag] JOIN WITH (CLUSTER_TYPE = EXTERNAL);
ALTER AVAILABILITY GROUP [project_ag] GRANT CREATE ANY DATABASE;
```

The `GRANT CREATE ANY DATABASE` allows automatic seeding to create the database on the secondary.

### Step 7: Add Databases to the AG (Primary)

```sql
ALTER AVAILABILITY GROUP [project_ag] ADD DATABASE [analytics_db];
```

The database must be in FULL recovery model. If it's in SIMPLE:

```sql
ALTER DATABASE [analytics_db] SET RECOVERY FULL;
BACKUP DATABASE [analytics_db] TO DISK = '/var/opt/mssql/backup/mydb_full.bak';
-- Then add to AG
ALTER AVAILABILITY GROUP [project_ag] ADD DATABASE [analytics_db];
```

### Step 8: Configure Pacemaker

```bash
# Install on all nodes
sudo apt install -y pacemaker pacemaker-cli-utils corosync resource-agents fence-agents

# Install the SQL Server HA resource agent
sudo apt install -y mssql-server-ha
```

On each node, create a dedicated SQL login for Pacemaker health checks and grant it the permissions needed to monitor and manage the AG.

```sql
CREATE LOGIN [pacemakerLogin] WITH PASSWORD = 'PacemakerP@ss!';

GRANT ALTER, CONTROL, VIEW DEFINITION ON AVAILABILITY GROUP::[project_ag]
    TO [pacemakerLogin];
GRANT VIEW SERVER STATE TO [pacemakerLogin];
```

```bash
# Store credentials for the resource agent on each node
echo 'pacemakerLogin' | sudo tee /var/opt/mssql/secrets/passwd
echo 'PacemakerP@ss!' | sudo tee -a /var/opt/mssql/secrets/passwd
sudo chmod 400 /var/opt/mssql/secrets/passwd
sudo chown root:root /var/opt/mssql/secrets/passwd
```

Configure Corosync on the primary node, then copy the configuration file to all other nodes. The `nodelist` must include all AG replicas with unique node IDs.

```bash
sudo cat > /etc/corosync/corosync.conf << 'EOF'
totem {
    version: 2
    cluster_name: analytics-cluster
    transport: udpu
    rrp_mode: none
}

nodelist {
    node {
        ring0_addr: analytics-sql-01
        nodeid: 1
    }
    node {
        ring0_addr: analytics-sql-02
        nodeid: 2
    }
    node {
        ring0_addr: analytics-sql-03
        nodeid: 3
    }
}

quorum {
    provider: corosync_votequorum
    two_node: 0
}
EOF

sudo systemctl restart corosync
sudo systemctl restart pacemaker
```

Create the AG resource and virtual IP in Pacemaker. Run on one node only — Pacemaker propagates the configuration to all cluster members. The colocation constraint ensures the VIP always follows the primary replica.

```bash
sudo pcs resource create ag_cluster \
    ocf:mssql:ag \
    ag_name="project_ag" \
    meta failure-timeout=60s \
    op start timeout=60s \
    op stop timeout=60s \
    op promote timeout=60s \
    op demote timeout=10s \
    op monitor timeout=60s interval=10s on-fail=demote \
    op monitor timeout=60s interval=11s on-fail=restart role=Promoted \
    master notify=true

# Create a virtual IP resource for the AG listener
sudo pcs resource create ag_vip \
    ocf:heartbeat:IPaddr2 \
    ip=10.132.0.100 \
    cidr_netmask=32 \
    op monitor interval=30s

sudo pcs constraint colocation add ag_vip with master ag_cluster-clone INFINITY
sudo pcs constraint order promote ag_cluster-clone then start ag_vip
```

> [!info] Use ILB Instead of Floating VIP
>
> GCP does not support Gratuitous ARP, so a floating VIP may not work reliably. Create an Internal Load Balancer (ILB) with a health check on port 1433 and backend instance group containing all AG nodes. The ILB forwards traffic only to the node that responds as primary.

---

## Monitoring the AG — Essential DMVs

AG health is monitored through the `sys.dm_hadr_*` family of Dynamic Management Views. The primary health signals are the **log send queue** (how far behind the secondary is in receiving log blocks) and the **redo queue** (how far behind the secondary is in replaying received log blocks into database pages). A growing send queue increases RPO risk on async replicas and can cause transaction log file growth on the primary (SQL Server cannot truncate the log past the oldest un-sent record). A growing redo queue increases recovery time after failover and increases read latency on readable secondaries.

The data synchronization pipeline follows six stages: log generation on the primary, log capture into per-replica queues, network send, receive and cache on the secondary, harden (flush to secondary log file — this is the point where data loss is prevented for synchronous replicas), and redo (apply hardened log records to secondary database pages).

### Replica and Database Health

#### sys.dm_hadr_availability_replica_states — replica sync health

```sql
SELECT
    ag.name                          AS ag_name,
    ar.replica_server_name           AS replica,
    ars.role_desc                    AS current_role,
    ar.availability_mode_desc        AS sync_mode,
    ars.connected_state_desc         AS connected,
    ars.synchronization_health_desc  AS sync_health,
    ars.operational_state_desc       AS operational_state,
    ars.last_connect_error_number    AS last_error,
    ars.last_connect_error_timestamp AS last_error_time
FROM sys.availability_groups ag
JOIN sys.availability_replicas ar
    ON ag.group_id = ar.group_id
JOIN sys.dm_hadr_availability_replica_states ars
    ON ar.replica_id = ars.replica_id
ORDER BY ars.role_desc, ar.replica_server_name;
```

#### Healthy AG output — SYNCHRONIZED, CONNECTED, PRIMARY/SECONDARY

```
ag_name    replica        current_role  sync_mode    connected    sync_health
project_ag   analytics-sql-01   PRIMARY       SYNCHRONOUS  CONNECTED    HEALTHY
project_ag   analytics-sql-02   SECONDARY     SYNCHRONOUS  CONNECTED    HEALTHY
project_ag   analytics-sql-03   SECONDARY     ASYNCHRONOUS CONNECTED    HEALTHY
```

Any value other than `CONNECTED` + `HEALTHY` needs investigation.

#### sys.dm_hadr_database_replica_states — log send queue and redo queue

```sql
SELECT
    d.name                              AS database_name,
    ar.replica_server_name,
    drs.synchronization_state_desc      AS sync_state,
    drs.synchronization_health_desc     AS sync_health,
    drs.log_send_queue_size             AS log_send_queue_kb,
    drs.log_send_rate                   AS log_send_rate_kb_sec,
    drs.redo_queue_size                 AS redo_queue_kb,
    drs.redo_rate                       AS redo_rate_kb_sec,
    drs.last_hardened_lsn,
    drs.last_commit_time,
    drs.is_suspended,
    drs.suspend_reason_desc
FROM sys.dm_hadr_database_replica_states drs
JOIN sys.availability_replicas ar
    ON drs.replica_id = ar.replica_id
JOIN sys.databases d
    ON drs.database_id = d.database_id
ORDER BY d.name, ar.replica_server_name;
```

#### log_send_queue_size, redo_queue_size — key replication lag columns

| Column | Alert If |
|--------|----------|
| `log_send_queue_size` | > 50,000 KB (secondary is falling behind) |
| `redo_queue_size` | > 100,000 KB (secondary redo is lagging) |
| `is_suspended` | = 1 (manual intervention needed) |
| `sync_state` | NOT SYNCHRONIZING = broken |

### Seeding and Throughput

#### sys.dm_hadr_automatic_seeding — automatic seeding progress

Check seeding status when adding a new database or replica. A `failure_state_desc` value indicates why seeding failed (e.g., insufficient disk space, network timeout).

```sql
SELECT
    ag.name                          AS ag_name,
    ar.replica_server_name           AS replica,
    d.name                           AS database_name,
    hadr_s.current_state             AS seeding_state,
    hadr_s.performed_seeding         AS seeding_done,
    hadr_s.failure_state_desc        AS failure_reason,
    hadr_s.start_time,
    hadr_s.completion_time
FROM sys.dm_hadr_automatic_seeding hadr_s
JOIN sys.availability_groups ag
    ON hadr_s.ag_id = ag.group_id
JOIN sys.availability_replicas ar
    ON hadr_s.ag_id = ar.group_id
    AND hadr_s.replica_id = ar.replica_id
JOIN sys.databases d
    ON hadr_s.ag_db_id = d.group_database_id;
```

#### dm_hadr_database_replica_states — log send and redo throughput monitoring

Monitor log send and redo rates over time. A persistent gap between `log_send_rate` and `redo_rate` indicates the secondary cannot replay log records as fast as they arrive — the redo queue will grow until the bottleneck is resolved.

```sql
SELECT
    ar.replica_server_name,
    drs.log_send_queue_size / 1024.0      AS log_send_queue_mb,
    drs.log_send_rate / 1024.0            AS log_send_rate_mb_sec,
    drs.redo_queue_size / 1024.0          AS redo_queue_mb,
    drs.redo_rate / 1024.0                AS redo_rate_mb_sec,
    DATEDIFF(SECOND,
        drs.last_commit_time,
        GETUTCDATE()
    )                                     AS commit_lag_seconds
FROM sys.dm_hadr_database_replica_states drs
JOIN sys.availability_replicas ar ON drs.replica_id = ar.replica_id;
```

---

## Failover Operations

AG failover transfers the primary role from one replica to another. There are two types: **planned** (zero data loss, initiated by an administrator during maintenance windows) and **forced** (emergency, possible data loss, used when the primary is unreachable). In both cases, the failover command is run on the *target* secondary, not the current primary.

### Planned Failover (Zero Downtime, Zero Data Loss)

Used for: OS patching, SQL Server upgrades, VM maintenance.

First, verify on the primary that the target secondary shows `SYNCHRONIZED` (not `SYNCHRONIZING` — a SYNCHRONIZING state means the secondary has not caught up and a planned failover would lose data). Then run the FAILOVER command on the target secondary.

```sql
SELECT
    ar.replica_server_name,
    drs.synchronization_state_desc
FROM sys.dm_hadr_database_replica_states drs
JOIN sys.availability_replicas ar ON drs.replica_id = ar.replica_id
WHERE drs.synchronization_state_desc = 'SYNCHRONIZED';
```

```sql
ALTER AVAILABILITY GROUP [project_ag] FAILOVER;
```

After failover, the old primary becomes a secondary and starts receiving log records from the new primary. Applications connected to the listener/VIP are redirected automatically (brief connection drop, ~10-30 seconds).

### Forced Failover (Emergency, Possible Data Loss)

Used when the primary is down and cannot be recovered quickly.

Run on the secondary you want to promote to primary. This command does not wait for the original primary and may result in data loss for any transactions that were committed on the primary but not yet hardened on this secondary.

```sql
ALTER AVAILABILITY GROUP [project_ag] FORCE_FAILOVER_ALLOW_DATA_LOSS;
```

#### Post-forced-failover checklist — resume databases, reverse replication

1. Check for data inconsistencies between the new primary and remaining secondaries
2. When the old primary comes back online, it may have transactions that the new primary doesn't — these "divergent" transactions must be resolved
3. Rejoin the old primary as a secondary:

```sql
ALTER AVAILABILITY GROUP [project_ag]
    SET (ROLE = SECONDARY);
ALTER AVAILABILITY GROUP [project_ag] JOIN WITH (CLUSTER_TYPE = EXTERNAL);
```

If the databases diverged too much, drop the database on the old primary and let automatic seeding re-create it:

```sql
DROP DATABASE [analytics_db];
ALTER AVAILABILITY GROUP [project_ag] GRANT CREATE ANY DATABASE;
```

---

## Read-Only Routing

Read-only routing allows the AG listener to redirect connections that specify `ApplicationIntent=ReadOnly` to a secondary replica, offloading read workloads (dashboards, reporting, analytics) away from the primary. The routing decision happens at connection time: the client connects to the listener, SQL Server inspects the `ApplicationIntent` property in the connection string, and if it is `ReadOnly`, the primary consults its `READ_ONLY_ROUTING_LIST` and redirects the connection to the first available secondary in the list.

By default, the routing list is **ordered** — SQL Server always routes to the first available entry. To distribute read connections across multiple secondaries using round-robin, nest replicas in parentheses (available since SQL Server 2016): `READ_ONLY_ROUTING_LIST = (('Server1','Server2'),'Server3')` routes round-robin between Server1 and Server2, falling back to Server3 only if both are unavailable.

### Routing configuration

Configure `READ_ONLY_ROUTING_URL` on each replica (the TCP endpoint that read-only connections are redirected to) and `READ_ONLY_ROUTING_LIST` on each replica's `PRIMARY_ROLE` (the ordered list of secondaries to route to when that replica is the primary).

```sql
ALTER AVAILABILITY GROUP [project_ag]
MODIFY REPLICA ON N'analytics-sql-01' WITH (
    PRIMARY_ROLE (
        READ_ONLY_ROUTING_LIST = (N'analytics-sql-02', N'analytics-sql-03')
    ),
    SECONDARY_ROLE (
        READ_ONLY_ROUTING_URL = N'tcp://analytics-sql-01:1433',
        ALLOW_CONNECTIONS = READ_ONLY
    )
);

ALTER AVAILABILITY GROUP [project_ag]
MODIFY REPLICA ON N'analytics-sql-02' WITH (
    PRIMARY_ROLE (
        READ_ONLY_ROUTING_LIST = (N'analytics-sql-01', N'analytics-sql-03')
    ),
    SECONDARY_ROLE (
        READ_ONLY_ROUTING_URL = N'tcp://analytics-sql-02:1433',
        ALLOW_CONNECTIONS = READ_ONLY
    )
);
```

#### ApplicationIntent=ReadOnly — read-only routing connection strings

```
# Read-write (goes to primary)
Server=analytics-sql-ag.internal,1433;Database=analytics_db;ApplicationIntent=ReadWrite;

# Read-only (routed to a secondary)
Server=analytics-sql-ag.internal,1433;Database=analytics_db;ApplicationIntent=ReadOnly;
```

#### @@SERVERNAME, CONNECTIONPROPERTY — verify read-only routing

Run on a read-only connection to verify it landed on a secondary. The result should show a secondary server name and `READ_ONLY` for updateability. If it shows the primary, read-only routing is not working.

```sql
SELECT @@SERVERNAME AS connected_to,
       DATABASEPROPERTYEX(DB_NAME(), 'Updateability') AS updateability;
```

> [!warning] Common Read-Only Routing Failures
>
> - Connection string targets a server instance directly instead of the listener — routing is bypassed entirely
> - `ApplicationIntent=ReadOnly` is missing from the connection string — traffic goes to the primary
> - `READ_ONLY_ROUTING_LIST` is empty or not configured on the primary replica
> - `READ_ONLY_ROUTING_URL` is missing or incorrect on the secondary — verify with `SELECT read_only_routing_url FROM sys.availability_replicas`
> - The client driver does not support `ApplicationIntent` — only modern drivers (ODBC 11+, `Microsoft.Data.SqlClient`, `System.Data.SqlClient` 4.0.2+) handle it; legacy drivers silently ignore it

> [!success] Diagnostic Queries
>
> ```sql
> SELECT replica_server_name, secondary_role_allow_connections_desc,
>        read_only_routing_url
> FROM sys.availability_replicas;
>
> SELECT * FROM sys.availability_read_only_routing_lists;
> ```

---

## Troubleshooting

The five issues below cover the most common AG failures. Each issue includes a diagnosis query, a cause/fix table, and where applicable, the specific error numbers or DMV values that confirm the root cause.

### Issue 1: Secondary Shows NOT SYNCHRONIZING

#### AG troubleshooting — diagnosis queries for sync lag and connection issues

```sql
-- Check if data movement is suspended
SELECT
    ar.replica_server_name,
    drs.is_suspended,
    drs.suspend_reason_desc
FROM sys.dm_hadr_database_replica_states drs
JOIN sys.availability_replicas ar ON drs.replica_id = ar.replica_id
WHERE drs.is_suspended = 1;
```

| Cause | Fix |
|-------|-----|
| Data movement manually suspended | `ALTER DATABASE [analytics_db] SET HADR RESUME` on the secondary |
| Endpoint not started | `ALTER ENDPOINT [Hadr_endpoint] STATE = STARTED` |
| Certificate expired or mismatched | Re-export from primary, re-import on secondary |
| Firewall blocking port 5022 | Check `gcloud compute firewall-rules list --filter="allowed:tcp/5022"` |
| Log send queue growing unbounded | Network throughput issue — check GCP network metrics |

### Issue 2: High Redo Queue on Secondary

The secondary is receiving log records faster than it can replay them.

```sql
-- Check redo rate vs log send rate
SELECT
    ar.replica_server_name,
    drs.redo_queue_size AS redo_queue_kb,
    drs.redo_rate AS redo_rate_kb_sec,
    CASE WHEN drs.redo_rate > 0
         THEN drs.redo_queue_size / drs.redo_rate
         ELSE -1
    END AS estimated_redo_catchup_seconds
FROM sys.dm_hadr_database_replica_states drs
JOIN sys.availability_replicas ar ON drs.replica_id = ar.replica_id
WHERE drs.redo_queue_size > 0;
```

#### AG sync lag fixes — network, redo bottleneck, log throughput
- Check secondary disk I/O: `iostat -xz 1` — look for high `%util` or `await`
- Ensure secondary has enough CPU for redo thread (it's single-threaded per database in most cases)
- If secondary is also serving read queries, those queries may hold schema locks blocking redo. Use [RCSI](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/blocking-and-locking) on the secondary to avoid this
- Increase secondary VM size if I/O or CPU is the bottleneck

### Issue 3: Automatic Failover Didn't Happen

```bash
# Check Pacemaker resource status
sudo pcs status
sudo pcs resource show ag_cluster

# Check for failed actions
sudo pcs resource cleanup ag_cluster

# View detailed Pacemaker log
sudo corosync-quorumtool -s  # quorum status
sudo crm_mon -1              # one-shot cluster status
```

| Cause | Fix |
|-------|-----|
| No quorum (majority of nodes down) | Need >50% of nodes online. With 2 nodes, add a config-only replica as witness |
| Synchronous secondary not SYNCHRONIZED | Failover blocked to prevent data loss. Fix the sync issue first |
| Pacemaker resource in failed state | `sudo pcs resource cleanup ag_cluster` to reset failure count |
| STONITH not configured | Pacemaker requires fencing by default. Either configure it or disable: `sudo pcs property set stonith-enabled=false` (not recommended for production) |

### Issue 4: Split-Brain Scenario

Two nodes both think they're the primary. This is the most dangerous HA failure.

#### Split-brain prevention — witness, quorum, fencing
- Always configure proper fencing (STONITH) — Pacemaker can use `fence_gce` to forcibly shut down a GCP VM
- Set `REQUIRED_SYNCHRONIZED_SECONDARIES_TO_COMMIT = 1` so the primary stops accepting writes if it can't reach a secondary
- Use odd number of nodes (or a config-only witness) for clean majority

#### Split-brain detection — check both replicas claim PRIMARY

Run on both nodes — if both return a row with `role_desc = 'PRIMARY'`, the cluster is in a split-brain state.

```sql
SELECT
    ars.role_desc,
    ar.replica_server_name
FROM sys.dm_hadr_availability_replica_states ars
JOIN sys.availability_replicas ar ON ars.replica_id = ar.replica_id
WHERE ars.role_desc = 'PRIMARY';
```

#### Split-brain recovery — identify divergent data, reseed secondary
1. Immediately stop writes to both nodes (bring applications offline)
2. Determine which node has the most recent data (compare `last_hardened_lsn`)
3. Demote the stale node: force stop SQL Server, then rejoin as secondary
4. If data diverged, restore the stale node from backup or reseed

### Issue 5: Certificate Expiry

```sql
SELECT name, expiry_date, start_date
FROM sys.certificates
WHERE name = 'dbm_cert';
```

If expired, generate a new certificate on the primary, export it, and import it on all secondaries. Then alter the endpoint:

```sql
ALTER ENDPOINT [Hadr_endpoint]
    FOR DATA_MIRRORING (AUTHENTICATION = CERTIFICATE dbm_cert_new);
```

> [!info] SQL Server 2022: Contained Availability Groups
>
> SQL Server 2022 (Enterprise only) introduces **contained AGs** — an AG type that carries its own `master` and `msdb` system databases, kept in sync across all replicas. Server-scoped objects (logins, SQL Agent jobs, permissions) created within the contained AG context replicate automatically with the AG, eliminating the longstanding pain point of manually re-scripting instance-level objects on each replica after failover. Create with `CREATE AVAILABILITY GROUP ... WITH (CONTAINED)`. Connect through the AG listener to access the contained environment — connecting directly to the instance gives the instance-level context instead.

---

## Related

- [backup-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/backup-types-and-strategy) — FULL recovery model required for AGs; backup strategy with AG
- [restore-and-recovery](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/restore-and-recovery) — recovery point objectives and how AGs interact with restore scenarios
- [server-configuration](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/server-configuration) — instance settings (MAXDOP, max server memory) that apply to all replicas
- [blocking-and-locking](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/blocking-and-locking) — RCSI on secondary replicas to prevent redo thread blocking
- [storage-internals](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/storage-internals) — WAL and log record flow that underlies AG replication

