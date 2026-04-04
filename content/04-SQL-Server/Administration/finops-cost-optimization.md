---
tags: [performance, cost, sql, gcp, sql-server, tsql]
aliases: [SQL Server cost optimization, FinOps SQL Server, GCP disk snapshots, committed use discount, spot instances, application-consistent snapshot, right-sizing SQL Server]
description: "Cost optimization strategies for SQL Server on GCP: disk snapshot schedules, application-consistent snapshot technique with SQL Server 2022 SUSPEND_FOR_SNAPSHOT_BACKUP, committed use discounts vs spot instances, and right-sizing the VM using GCP Recommender."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# FinOps — Cost Optimization for SQL Server on GCP

> [!quote]
> "We all want 100% availability, but that actually costs money."
>
> — **Werner Vogels**, AWS re:Invent keynote

Cost optimization for a production SQL Server on GCP has three levers: **snapshot schedules** (cheap disaster recovery alongside SQL backups), **committed use discounts** (reduce VM cost for stable workloads), and **right-sizing** (ensure the VM matches actual resource utilization).

---

## Persistent Disk Snapshot Schedules

GCP persistent disk snapshots are incremental, block-level copies of the disk. They are cheaper and faster than SQL backups for full-disk disaster recovery — but they are **NOT a replacement** for SQL backups. Understanding the difference:

| Method | Storage Cost | Recovery Speed | Consistency | Granularity |
|---|---|---|---|---|
| SQL BACKUP to local disk | Disk space on VM | Minutes (restore) | Application-consistent | Database, filegroup, file |
| SQL BACKUP to GCS | ~$0.02/GB/month (Standard) | Minutes + download time | Application-consistent | Database, filegroup, file |
| GCP Disk Snapshot | ~$0.026/GB/month (incremental) | Minutes (create disk from snapshot) | Crash-consistent | Entire disk only |
| GCP Disk Snapshot + FREEZE | ~$0.026/GB/month | Minutes | Application-consistent | Entire disk only |

**Best strategy: use BOTH**

- Daily SQL BACKUP to GCS (for PITR and granular recovery — see [backup-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/Administration/backup-types-and-strategy))
- Daily disk snapshot (for fast full-VM recovery / disaster recovery)

#### gcloud compute resource-policies create — snapshot schedule

```bash
# Daily snapshots, retain for 14 days
gcloud compute resource-policies create snapshot-schedule analytics-sql-daily \
  --region=europe-west1 \
  --max-retention-days=14 \
  --start-time=03:00 \
  --daily-schedule

# Attach to the data disk
gcloud compute disks add-resource-policies analytics-sql-data \
  --zone=europe-west1-b \
  --resource-policies=analytics-sql-daily

# Verify
gcloud compute disks describe analytics-sql-data --zone=europe-west1-b \
  --format="get(resourcePolicies)"
```

#### gcloud compute disks snapshot --guest-flush — application-consistent snapshots

Crash-consistent snapshots are fine for OS and data recovery, but may leave the database in an unclean state requiring recovery. For application-consistent snapshots, freeze SQL Server I/O before the snapshot:

```sql
-- SQL Server 2022: SUSPEND_FOR_SNAPSHOT_BACKUP (modern approach)
-- 1. Freeze I/O
ALTER DATABASE analytics_db SET SUSPEND_FOR_SNAPSHOT_BACKUP = ON;
-- 2. Take GCP snapshot (from a separate script/process)
-- 3. The database auto-resumes after the snapshot metadata is captured

-- Alternative using classic commands (older SQL Server versions):
CHECKPOINT;
DBCC FREEZEIO('analytics_db');     -- Freeze writes
-- Take GCP snapshot here
DBCC THAWIO('analytics_db');       -- Resume writes
```

> [!warning] SQL Server 2022+ Only
>
> SUSPEND_FOR_SNAPSHOT_BACKUP Is SQL Server 2022+.
> `ALTER DATABASE ... SET SUSPEND_FOR_SNAPSHOT_BACKUP = ON` is available only in SQL Server 2022. For older versions, use the `DBCC FREEZEIO` / `DBCC THAWIO` approach. The freeze duration should be minimized (seconds) — all writes are blocked during the freeze.

> [!success] Use DBCC FREEZEIO for Older Versions
>
> On SQL Server 2019 and earlier, wrap the GCP snapshot call with `DBCC FREEZEIO('analytics_db');` before and `DBCC THAWIO('analytics_db');` after. Keep a timer — if the freeze exceeds 30 seconds, the application will notice write latency. Test freeze duration in staging before rolling out to production.

---

## Committed Use Discounts (CUDs) vs Spot Instances

#### Committed Use Discounts — 1-year or 3-year vCPU/memory commitment

```bash
# View current commitments
gcloud compute commitments list --region=europe-west1

# Create a 1-year CUD for an e2-standard-4 equivalent
gcloud compute commitments create analytics-sql-cud \
  --region=europe-west1 \
  --plan=12-month \
  --resources=vcpu=4,memory=16GB
```

| Term | Discount (e2 family) | Risk |
|---|---|---|
| On-demand | 0% (baseline) | None — pay as you go |
| 1-year CUD | ~20-28% | Committed to paying even if VM is off |
| 3-year CUD | ~40-52% | Locked in for 3 years |

#### Spot/Preemptible VMs — 60-91% discount for non-production

```bash
# Spot instance (for testing only — NEVER use for production databases)
gcloud compute instances create analytics-sql-test \
  --zone=europe-west1-b \
  --machine-type=e2-standard-4 \
  --provisioning-model=SPOT \
  --instance-termination-action=STOP
```

- 60-91% discount
- GCP can TERMINATE the VM with 30 seconds notice
- **NEVER use for production databases** — data corruption risk if terminated mid-write
- Acceptable for: CI/CD test databases, read-only analytics replicas, migration testing

#### CUD vs Spot vs On-demand — decision matrix

| Scenario | Recommendation |
|---|---|
| Dev/test, can tolerate restarts | Spot Instance (60-91% savings) |
| Production, stable workload, multi-year horizon | 3-year CUD (40-52% savings) |
| Production, uncertain future | 1-year CUD (20-28% savings) |
| Production, variable workload | On-demand + right-sizing |

---

## Right-Sizing and Cost Monitoring

#### gcloud recommender recommendations list — check if VM is oversized

```bash
# Get CPU utilization over last 30 days
gcloud recommender recommendations list \
  --project=data-platform-prod \
  --location=europe-west1-b \
  --recommender=google.compute.instance.MachineTypeRecommender \
  --format="table(content.overview.resourceName, content.overview.recommendedMachineType.name, content.overview.currentMachineType.name)"
```

#### BigQuery billing export — monthly cost tracking by service

```bash
# Billing export query (requires billing export to BigQuery to be enabled)
# bq query --use_legacy_sql=false "
SELECT
  service.description,
  sku.description,
  SUM(cost) AS total_cost,
  SUM(usage.amount) AS usage_amount,
  usage.unit
FROM \`data-platform-prod.billing_export.gcp_billing_export_v1_*\`
WHERE DATE(_PARTITIONTIME) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  AND project.id = 'data-platform-prod'
GROUP BY 1, 2, 5
ORDER BY total_cost DESC
LIMIT 20"
```

#### Cost reduction checklist — stop idle VMs, right-size, compress, lifecycle

- [ ] Stop VM when not in use (nights/weekends for dev): schedule with Cloud Scheduler
- [ ] Use pd-balanced instead of pd-ssd if IOPS requirements are met (see [server-configuration](https://alp78.github.io/elysium/04-SQL-Server/Administration/server-configuration))
- [ ] Set log backup retention policy (don't keep indefinitely)
- [ ] Use Nearline/Coldline storage class for old backups in GCS:
  - Standard → Nearline: 30 days old
  - Nearline → Coldline: 90 days old
  - Coldline → Delete: 365 days old
- [ ] Check for idle persistent disks: `gcloud compute disks list --filter="NOT users:*"`
- [ ] Right-size based on actual utilization (GCP Recommender above)

#### gsutil lifecycle set — GCS backup retention policy

```json
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "SetStorageClass", "storageClass": "NEARLINE"},
        "condition": {"age": 30, "matchesStorageClass": ["STANDARD"]}
      },
      {
        "action": {"type": "SetStorageClass", "storageClass": "COLDLINE"},
        "condition": {"age": 90, "matchesStorageClass": ["NEARLINE"]}
      },
      {
        "action": {"type": "Delete"},
        "condition": {"age": 365}
      }
    ]
  }
}
```

---

### SQL Server Storage Optimization

Beyond GCP-level cost savings, SQL Server's own storage choices affect both performance and cost:

**Table compression as a buffer pool multiplier** — see [table-compression](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/table-compression):
- PAGE compression on gold-layer tables saves 60-80% disk space
- Fewer disk I/Os = less need to upgrade to pd-ssd from pd-balanced
- More data fits in the buffer pool = less need to upsize the VM's RAM

**Partitioning for tiered storage** — see [partitioning-strategies](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/partitioning-strategies):
- Old partitions can be on a pd-balanced or pd-standard disk (cheaper)
- Current-year partition stays on pd-ssd for low latency
- Filegroups map partitions to disks: partition 1-5 on archive disk, partition 6+ on fast disk

**[Backup compression](https://alp78.github.io/elysium/04-SQL-Server/Administration/backup-types-and-strategy)** — enabled by default in SQL Server 2022:
```sql
-- Verify backup compression is enabled at instance level
SELECT value_in_use FROM sys.configurations
WHERE name = 'backup compression default';
-- Should be 1 (enabled). If 0, enable:
EXEC sp_configure 'backup compression default', 1;
RECONFIGURE;
```

Backup compression typically reduces backup file size by 50-70%, directly reducing GCS storage costs.

---

### Related

- [backup-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/Administration/backup-types-and-strategy) — SQL backup strategy (Full/Differential/Log) that complements disk snapshots
- [restore-and-recovery](https://alp78.github.io/elysium/04-SQL-Server/Administration/restore-and-recovery) — how to restore from both SQL backups and disk snapshots
- [server-configuration](https://alp78.github.io/elysium/04-SQL-Server/Administration/server-configuration) — disk type selection (pd-ssd vs pd-balanced) and IO configuration
- [always-on-availability-groups](https://alp78.github.io/elysium/04-SQL-Server/High-Availability/always-on-availability-groups) — AG backup offload to secondary reduces primary VM IO costs
- [tde-encryption](https://alp78.github.io/elysium/04-SQL-Server/Security/tde-encryption) — TDE adds ~3-7% CPU overhead; factor into VM sizing
- [table-compression](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/table-compression) — reduce storage and buffer pool footprint without adding RAM
