---
title: "17 - PostgreSQL FinOps Cost Optimization"
tags:
  - postgresql
  - finops
  - gcp
description: "Cost-control discipline for self-managed PostgreSQL on Google Cloud, grounded in live stoxx-postgres storage and backup signals plus current Google Cloud guidance for disk choices, Cloud Storage classes, committed use discounts, and Billing export to BigQuery."
parent: "[[domain-postgresql-server-operations]]"
links:
  - "[[16-postgresql-performance-audit-playbook]]"
  - "[[18-postgresql-system-catalog-and-stats-reference]]"
status: complete
---

# PostgreSQL FinOps Cost Optimization

PostgreSQL changes the cost conversation immediately because there is no SQL Server-style per-core database license sitting on top of the VM. That does not make the workload cheap by default. It changes where waste hides: oversized disks, over-retained backups, avoidable replica count, idle compute, unused indexes, and observability gaps that stop the team from proving what is actually expensive.

> [!abstract]- Summary
>
> This note mirrors the SQL Server FinOps chapter, but translates the cost levers into PostgreSQL's real operating model on Google Cloud:
>
> - **FinOps fundamentals**
>   - frames the cost lifecycle for self-managed PostgreSQL, where storage, HA, backup retention, and operator time dominate more than database licensing
> - **Current cost signals**
>   - uses live `stoxx-postgres` storage, backup, and index metrics to show where this lab is over- or under-spending
> - **GCP infrastructure levers**
>   - maps PostgreSQL needs to current Google Cloud disk choices, Cloud Storage classes, and Compute Engine commitment models
> - **Governance**
>   - treats labels, Billing export to BigQuery, and budgets as required cost instrumentation rather than optional reporting polish
> - **Recommendations**
>   - ends with quick wins, structural changes, and what the current lab most clearly implies

## FinOps Fundamentals For PostgreSQL

### The three phases

| Phase | PostgreSQL interpretation |
|---|---|
| Inform | measure VM, disk, backup, replica, and storage-class costs with resource-level detail |
| Optimize | right-size compute and disk, trim backup retention, eliminate unused storage and indexes |
| Operate | keep labels, dashboards, budgets, and commitment reviews current as workload shape changes |

### Why PostgreSQL cost differs from SQL Server cost

For self-managed PostgreSQL on Compute Engine, the primary direct charges are compute, persistent storage, snapshots or backup storage, network egress, and optionally support contracts. There is no PostgreSQL license fee for the core engine itself. That shifts FinOps pressure toward operational architecture:

| Cost driver | Why it matters |
|---|---|
| Compute | always-on primaries and standbys dominate monthly spend |
| Block storage | disks are often provisioned for "future growth" and then sit half-empty |
| Backup storage | physical backups, WAL archives, and logical dumps compound quietly |
| High availability | each extra synchronous or asynchronous standby is a deliberate spend choice |
| Human operations | weak observability forces expensive manual tuning and oversized safety margins |

## Current PostgreSQL Cost Signals

### Storage footprint

Run this first in any cost review because storage over-provisioning is the easiest waste to miss. The current lab shows a common pattern: the database is small, the volume is huge, and nothing is wrong functionally.

```sql
SELECT datname,
       pg_size_pretty(pg_database_size(datname)) AS db_size
FROM pg_database
ORDER BY pg_database_size(datname) DESC;
```

| datname | db_size |
|---|---|
| `stoxx` | `45 MB` |
| `postgres` | `7671 kB` |
| `template1` | `7425 kB` |
| `template0` | `7361 kB` |

```text
Filesystem      Size  Used Avail Use% Mounted on
/dev/sdf       1007G   68G  889G   8% /var/lib/postgresql/data
```

The database itself is only `45 MB`, while the attached volume is roughly `1 TB` and only `8%` used. That does not automatically mean the disk should be shrunk in production; it does mean the team should prove that the remaining headroom is tied to real growth, WAL retention, or backup staging requirements rather than vague comfort.

### Backup storage footprint and compression

Physical and logical backups consume cost differently, so measure both.

```text
84M  /tmp/note07/basebackup
13M  /tmp/note07/basebackup-20260418.tar.gz
4.0K /tmp/note07/globals_only.sql
5.6M /tmp/note07/stoxx_note07.dump
```

These sizes imply:

| Artifact | Observed size | Cost implication |
|---|---|---|
| physical base backup directory | `84 MB` | baseline physical recovery footprint before compression |
| compressed base-backup tarball | `13 MB` | compression materially reduces object-storage cost for cold retention |
| logical custom dump | `5.6 MB` | cheap to retain, but not a substitute for PITR |
| globals dump | `4 KB` | trivial size but operationally important for role recovery |

### Indexes as a cost signal

Indexes cost storage, write amplification, and backup size. They are not free even when tiny.

```sql
SELECT schemaname,
       relname,
       indexrelname,
       pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
       idx_scan
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 10;
```

| schemaname | relname | indexrelname | index_size | idx_scan |
|---|---|---|---|---|
| `silver` | `eurostoxx50_ohlcv` | `eurostoxx50_ohlcv_pkey` | `1488 kB` | `0` |
| `silver` | `stoxxusa50_ohlcv` | `stoxxusa50_ohlcv_pkey` | `1464 kB` | `0` |
| `silver` | `stoxxasia50_ohlcv` | `stoxxasia50_ohlcv_pkey` | `1440 kB` | `0` |

The current indexes are tiny, so index cost is not a top spending lever in this lab. The principle still matters at scale: unused large indexes raise compute, WAL, storage, and backup costs together.

### Memory and parallelism as cost amplifiers

```sql
SELECT name, setting, unit
FROM pg_settings
WHERE name IN (
  'effective_cache_size',
  'max_parallel_workers',
  'max_parallel_workers_per_gather',
  'shared_buffers'
)
ORDER BY name;
```

| name | setting | unit |
|---|---|---|
| `effective_cache_size` | `524288` | `8kB` |
| `max_parallel_workers` | `8` |  |
| `max_parallel_workers_per_gather` | `2` |  |
| `shared_buffers` | `16384` | `8kB` |

These settings are moderate, but the FinOps lesson is larger: oversized memory and aggressive parallel settings often cause teams to buy up the VM before they have proved that plan shape, indexing, or spill behavior are the real bottlenecks.

## GCP Infrastructure Cost Levers

### Disk choice

Current Google Cloud documentation says:

| Lever | Current Google guidance | PostgreSQL FinOps read |
|---|---|---|
| Persistent Disk console default | `pd-balanced` | good default for general-purpose self-managed PostgreSQL when Hyperdisk is not needed |
| Hyperdisk Balanced | described as the best fit for most workloads, including PostgreSQL | worth evaluating when independent performance tuning or higher IOPS/throughput control matters |
| `pd-ssd` | still valid for higher-performance DB workloads | simpler than Hyperdisk, but less flexible on performance tuning |
| `pd-standard` | cheaper HDD-backed option | usually a false economy for primary PostgreSQL data files |

The storage choice should follow latency and IOPS evidence, not habit. Most small-to-medium PostgreSQL workloads do not need the most expensive disk tier; many still need more than HDD economics.

### Backups versus snapshots

Compute Engine snapshots and PostgreSQL-native backups serve different cost and recovery goals:

| Mechanism | Best use | Cost trade-off |
|---|---|---|
| PostgreSQL physical backup + WAL | point-in-time recovery and replica seeding | more moving parts, but precise recovery |
| PostgreSQL logical dump | object-level restore and schema portability | smaller, cheaper, but weaker for full recovery |
| Disk snapshot | infrastructure rollback and fast disk copy | convenient, but not a replacement for PostgreSQL-consistent recovery design |

### Cloud Storage bucket strategy

Current Cloud Storage documentation states that storage class affects both pricing and operations. Standard storage has no minimum storage duration or retrieval fee. Nearline adds a 30-day minimum storage duration and retrieval fees.

That leads to a practical PostgreSQL policy:

| Backup class | Suitable Cloud Storage class | Why |
|---|---|---|
| recent logical dumps and active restore set | Standard | no retrieval penalty during frequent test restores |
| older monthly archives | Nearline or colder, via lifecycle | cheaper retention if restore frequency is truly low |
| WAL archive needed for active PITR window | Standard | random urgent restore reads should not incur cold-storage friction |

### Compute commitment choices

Current Google Cloud documentation describes both resource-based and compute-flexible committed use discounts for Compute Engine. Resource-based commitments suit steady regional workloads. Compute-flexible CUDs trade some rigidity for broader eligible spend across the billing account.

For self-managed PostgreSQL:

| Pattern | Better fit |
|---|---|
| one stable primary and one stable standby in the same region | resource-based CUDs are often the cleanest fit |
| broader estate with shifting machine families or cross-project spend | compute-flexible CUDs deserve review |
| uncertain near-term footprint | stay on demand until usage is stable enough to justify commitment risk |

### PostgreSQL licensing on GCP

The key difference from the SQL Server source note is simple: core PostgreSQL itself does not add a per-core license line item on Compute Engine. That usually makes the compute and storage decision cleaner, but it also removes the false comfort of blaming spend on licensing. Waste is more likely to be architectural.

## Monitoring, Chargeback, And Governance

### Label every PostgreSQL resource

Minimum label set for a self-managed PostgreSQL estate:

| Label | Why |
|---|---|
| `service` | separates database costs from app-tier costs |
| `environment` | distinguishes prod, stage, dev |
| `owner` | gives finance and engineering a real escalation path |
| `backup_policy` | makes retention cost explainable |
| `ha_role` | primary, standby, or archive-only helper |

### Export billing to BigQuery

Google Cloud documentation recommends enabling Billing export to BigQuery early because it continuously exports detailed usage, cost estimates, and pricing data to a dataset you choose. For PostgreSQL FinOps, the detailed usage export matters because it lets you attribute spend to specific VMs, SSDs, and attached resources rather than only to broad services.

### Budgets and alerts

Budgeting rules should match PostgreSQL reality:

| Alert target | Why |
|---|---|
| monthly total spend | finance visibility |
| storage growth rate | catches silent over-provisioning and runaway retention |
| backup-bucket growth | surfaces retention drift |
| standby count or compute-hours jump | catches HA sprawl |

### Build a PostgreSQL cost dashboard

The dashboard should answer:

| Question | Backing data |
|---|---|
| which VM and disks drive most spend? | Billing export detailed usage tables |
| how fast are backups growing? | bucket object bytes over time |
| are we paying for unused HA? | replica inventory versus read traffic and failover policy |
| which databases are actually growing? | `pg_database_size`, relation-size snapshots, WAL archive volume |

## Practical Recommendations

### Quick wins

| Action | Why |
|---|---|
| right-size the oversized data disk if the retained headroom is not justified | the current lab is heavily over-provisioned relative to actual database size |
| keep compressed physical backups for colder retention tiers | `84 MB` to `13 MB` is a meaningful compression ratio even on a tiny lab |
| install `pg_stat_statements` before bigger spend decisions | cost tuning without workload evidence turns into guesswork |

### Structural changes

| Action | Why |
|---|---|
| choose disk type from measured latency and IOPS needs, not defaults or fear | disk tier is a recurring monthly decision |
| align backup storage class with restore frequency | colder classes are only cheaper if retrieval patterns are genuinely rare |
| review whether every standby is delivering real RPO/RTO value | HA replicas are one of the largest ongoing PostgreSQL cost multipliers |

### Continuous practices

| Action | Why |
|---|---|
| review CUD fit quarterly | steady workloads change slowly, but they do change |
| snapshot relation-size and backup-size trends | growth is easier to correct early |
| audit unused indexes during performance reviews | they quietly tax storage and write path costs |

### What the current lab most clearly implies

The strongest current cost signal is not compute or indexing; it is storage sizing discipline. The live lab has a `45 MB` primary database on a roughly `1 TB` data volume with only `8%` used. That may be acceptable if the volume is shared with other assets or reserved for projected WAL and backup staging growth, but it is not self-justifying. The next strongest signal is recovery economics: compressed physical backups are far smaller than their uncompressed directory form, which makes lifecycle-managed object storage a clear lever once PITR archiving is introduced.

## Sources

- Google Cloud Compute Engine docs: Committed use discounts, Persistent Disk, and Hyperdisk Balanced.
- Google Cloud Billing docs: Billing export to BigQuery.
- Google Cloud Storage docs: Storage classes and pricing model differences.
