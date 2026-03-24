---
type: concept
category: gcp
technology: [gcp, compute-engine]
tags: [infrastructure, gcp]
aliases: [GCE disks, persistent disk snapshots, disk resize, serial console, disk snapshot GCP]
keywords: [persistent disk, snapshot, disk resize, serial console, backup, restore, incremental snapshot, resize2fs, xfs_growfs, boot problems, disk management, pd-ssd, pd-balanced, disk list]
description: "How to manage Compute Engine persistent disks — creating incremental snapshots before risky changes, resizing disks, restoring from snapshots, and using the serial console when a VM won't boot."
related: [vm-lifecycle, vm-ssh-and-file-transfer, gcs-buckets-and-lifecycle, cloud-logging]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Disks and Snapshots — Protecting Your Data

Compute Engine persistent disk snapshots are your undo button. Snapshots are incremental — only changed blocks are stored — making them fast and inexpensive to create. The rule is simple: **always snapshot before any risky operation** (OS upgrades, database updates, schema migrations, disk resizing). The serial console provides the last resort for diagnosing VMs that fail to boot.

## Listing Disks

```bash
# List all disks
gcloud compute disks list
```

## Creating Snapshots

```bash
# Create a snapshot before risky changes (your undo button)
gcloud compute disks snapshot data-pipeline-sql-disk --zone=europe-west1-b \
  --snapshot-names=data-pipeline-sql-before-upgrade-$(date +%Y%m%d)
# ALWAYS snapshot before: OS upgrades, SQL Server updates, schema migrations, disk resizing
# Snapshots are incremental — only changed blocks are stored (fast and cheap)

# List snapshots
gcloud compute snapshots list
```

> [!tip] Snapshot Naming Convention
> Include the date and the reason in the snapshot name: `data-pipeline-sql-before-upgrade-20260322`. This makes it immediately clear which snapshot to restore from when things go wrong at 3 AM.

## Restoring from a Snapshot

Restoration requires creating a new disk from the snapshot, then reattaching it to the VM. There is no in-place restore.

```bash
# Restore from snapshot (create a new disk, attach to VM)
gcloud compute disks create data-pipeline-sql-restored --zone=europe-west1-b \
  --source-snapshot=data-pipeline-sql-before-upgrade-20260309 --type=pd-ssd
# Then: stop VM, detach old disk, attach new disk, start VM
```

## Resizing a Disk

GCS persistent disks can only grow, never shrink. The disk resize itself is online (no downtime), but the filesystem inside the VM must be manually expanded after the disk grows.

```bash
# Resize a disk (grow only — cannot shrink)
gcloud compute disks resize data-pipeline-sql-disk --zone=europe-west1-b --size=100GB
# The disk grows online — no downtime needed
# But the filesystem inside doesn't auto-expand:
# SSH in and run: sudo resize2fs /dev/sda1 (ext4) or sudo xfs_growfs / (xfs)
```

> [!warning] Filesystem Must Be Expanded Manually
> After `gcloud compute disks resize`, the new disk capacity is allocated but invisible to the OS. You must SSH in and run the appropriate filesystem expansion command:
> - **ext4:** `sudo resize2fs /dev/sda1`
> - **xfs:** `sudo xfs_growfs /`
>
> Skipping this step leaves your application still seeing the old, smaller disk.

## Serial Console — When SSH Fails

The serial console is your last resort for VMs that will not boot. It shows boot messages, kernel logs, and the early-boot console output — the only diagnostic tool when SSH is unavailable.

```bash
# Serial console (when SSH fails — boot problems, kernel panics)
gcloud compute instances get-serial-port-output data-pipeline-sql --zone=europe-west1-b
# Shows boot messages, kernel logs — the only way to diagnose a VM that won't boot
```

> [!info] Common Scenarios for Serial Console Use
> - Kernel panic after an OS update — the VM boots but SSH never comes up
> - Disk full causing boot failure — `/` mounted read-only, init fails
> - Incorrect `/etc/fstab` entries after adding a new disk — VM hangs at mount
> - Grub misconfiguration after updating boot loader

## Disk Types

| Type | Use case | Performance |
|---|---|---|
| `pd-ssd` | Databases, production workloads | High IOPS, low latency |
| `pd-balanced` | General purpose, cost-efficient | Balanced IOPS/cost |
| `pd-standard` | Large sequential reads, backups | Low IOPS, cheap storage |
| `pd-extreme` | Highest performance databases | Very high IOPS, expensive |

## Related

- [[vm-lifecycle]] — Stop the VM before detaching/attaching disks after snapshot restore
- [[vm-ssh-and-file-transfer]] — SSH is the primary access method; serial console is the fallback
- [[gcs-buckets-and-lifecycle]] — GCS is the alternative storage layer for pipeline data (not OS disks)
- [[cloud-logging]] — Check Cloud Logging alongside serial console output for boot diagnostics

## References

- [Persistent disk snapshots](https://cloud.google.com/compute/docs/disks/create-snapshots)
- [Resize a persistent disk](https://cloud.google.com/compute/docs/disks/resize-persistent-disk)
- [Serial console access](https://cloud.google.com/compute/docs/troubleshooting/troubleshooting-using-serial-console)
