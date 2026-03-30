---
type: concept
category: gcp
technology: [gcp, compute-engine]
tags: [infrastructure, gcp, compute-engine]
aliases: [Compute Engine VM lifecycle, VM start stop, VM resize, VM machine types, GCE lifecycle]
keywords: [compute engine, VM, virtual machine, start, stop, reset, resize, machine type, e2, n2, c2, m2, right-sizing, scheduling, resource policy, instance schedule, cost optimization, RUNNING, STOPPED, TERMINATED]
description: "How to manage Compute Engine VM lifecycle operations — start, stop, reset, resize machine types, schedule start/stop windows, and right-size VMs using monitoring data."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# VM Lifecycle — Start, Stop, Resize, and Debug

> [!quote]
> "I remember the days when I built my own gaming PCs. Eventually I sold out and bought an Xbox because I just wanted to play games, not build gaming rigs. Serverless is like that."
> — **Kelsey Hightower**

Compute Engine VMs host self-managed services — SQL Server, Airflow, monitoring agents, and any workload that doesn't fit the serverless model. Unlike [Cloud Run](https://alp78.github.io/elysium/06-GCP/Serverless/cloud-run-jobs-vs-services) (which is ephemeral), VMs are stateful and persistent, making them your responsibility to maintain, secure, and right-size. Understanding the full lifecycle — including scheduled start/stop and cost-aware right-sizing — is essential for operating VMs economically.

### Listing and Describing Compute Engine VMs

`instances list` shows NAME, ZONE, MACHINE_TYPE, INTERNAL_IP, EXTERNAL_IP, and STATUS (`RUNNING`, `STOPPED`, `TERMINATED`, `STAGING`, `SUSPENDED`). `instances describe` returns complete YAML/JSON with machine type, disks, network interfaces, service account, labels, metadata, scheduling options, and creation timestamp. Use `--format` to extract specific fields.

```bash
# List all VMs (quick inventory)
gcloud compute instances list

# Describe a specific VM (full detail including disk, network, metadata)
gcloud compute instances describe data-pipeline-sql --zone=europe-west1-b
```

### VM Start, Stop, and Reset Operations

`start`/`stop` are graceful operations (ACPI signal, like pressing the power button). `reset` is a hard reboot (like pulling the power cord) — use only when the VM is unresponsive. Stopped VMs do not incur compute charges, but disk charges continue.

```bash
# Start / stop / reset
gcloud compute instances start data-pipeline-sql --zone=europe-west1-b
gcloud compute instances stop data-pipeline-sql --zone=europe-west1-b
gcloud compute instances reset data-pipeline-sql --zone=europe-west1-b
```

> [!warning] Disk Charges Continue When Stopped
>
> Stopping a VM eliminates compute charges but disk storage charges continue. For VMs you need to stop long-term, consider snapshotting the disk and deleting the VM entirely — then recreating from the snapshot when needed.

### Resizing a VM by Changing Machine Type

The VM must be stopped before changing machine type — you cannot resize a running VM. Machine type families: `e2-*` (cost-optimized, burstable — dev/small workloads), `n2-*` (balanced — production), `c2-*` (compute-optimized — CPU-intensive transforms), `m2-*` (memory-optimized — large databases), or custom sizing with `--custom-cpu=4 --custom-memory=16GB`.

```bash
# Resize a VM (change CPU/memory)
gcloud compute instances stop data-pipeline-sql --zone=europe-west1-b
gcloud compute instances set-machine-type data-pipeline-sql --zone=europe-west1-b --machine-type=e2-standard-4
gcloud compute instances start data-pipeline-sql --zone=europe-west1-b
```

### Right-Sizing VMs with Cloud Monitoring Data

The most common waste in cloud data engineering is over-provisioned VMs. Right-sizing requires looking at actual utilization, not guesses.

```bash
# Check actual utilization over the last week
gcloud monitoring time-series list \
  --filter='metric.type="compute.googleapis.com/instance/cpu/utilization"
            AND resource.labels.instance_id="data-pipeline-sql"' \
  --interval-start-time="$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%SZ)" \
  --format="value(points.value.doubleValue)" | sort -n | tail -5
```

> [!tip] Right-Sizing Rules of Thumb
>
> - If peak CPU utilization is 30%, you're paying for 70% wasted capacity. Downsize.
> - If `free -h` on the VM shows less than 60% memory used at peak, try the next smaller machine type. Monitor for a week after downsizing.
> - An e2-medium running 24/7 costs ~$25/month. An e2-standard-4 costs ~$97/month.

### Scheduled Start/Stop to Save 64% on Business-Hours Workloads

If a VM only needs to run during business hours (12 hours/day, 5 days/week), scheduling start/stop saves approximately 64% of compute costs:

```bash
gcloud compute resource-policies create instance-schedule data-pipeline-schedule \
  --region=europe-west1 \
  --vm-start-schedule="0 7 * * 1-5" --timezone="Europe/Paris" \
  --vm-stop-schedule="0 21 * * 1-5"
gcloud compute instances add-resource-policies data-pipeline-sql --zone=europe-west1-b \
  --resource-policies=data-pipeline-schedule
```

### Compute Engine Machine Type Selection Guide

| Family | Best for | Example |
|---|---|---|
| `e2-*` | Dev/test, burstable, cost-optimized | `e2-medium`, `e2-standard-2` |
| `n2-*` | Production workloads, balanced | `n2-standard-4`, `n2-standard-8` |
| `c2-*` | CPU-intensive transforms, compute | `c2-standard-4`, `c2-standard-8` |
| `m2-*` | Large databases, memory-intensive | `m2-ultramem-208` |
| Custom | Exact CPU/memory sizing | `--custom-cpu=6 --custom-memory=20GB` |

## Related

- [vm-ssh-and-file-transfer](https://alp78.github.io/elysium/06-GCP/Compute/vm-ssh-and-file-transfer) — Accessing VMs after they are running
- [disks-and-snapshots](https://alp78.github.io/elysium/06-GCP/Compute/disks-and-snapshots) — Snapshotting before risky resize or upgrade operations
- [cloud-monitoring-metrics](https://alp78.github.io/elysium/06-GCP/Logging/cloud-monitoring-metrics) — Reading CPU and memory metrics for right-sizing decisions
- [gcloud-configurations](https://alp78.github.io/elysium/06-GCP/Core/gcloud-configurations) — Targeting the right project/zone before lifecycle operations
- [service-accounts-and-iam](https://alp78.github.io/elysium/06-GCP/Security/service-accounts-and-iam) — Service account attached to the VM controls what it can access

## References

- [Compute Engine machine families](https://cloud.google.com/compute/docs/machine-resource)
- [VM instance lifecycle](https://cloud.google.com/compute/docs/instances/instance-life-cycle)
- [Instance schedules](https://cloud.google.com/compute/docs/instances/schedule-instance-start-stop)
