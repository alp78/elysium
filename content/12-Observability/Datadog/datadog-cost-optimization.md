---
type: reference
category: observability
technology: [datadog, gcp]
tags: [datadog, cost, monitoring, data-pipeline]
aliases: [Datadog Costs, Datadog Pricing, DD Agent Cost]
keywords: [datadog cost, datadog pricing, host cost, trial, infrastructure monitoring, APM pro, logs pricing, EU region, datadoghq.eu, 14-day trial, per host, dd-agent free, ram usage 350mb, disable datadog, dd_api_key empty]
description: "Datadog pricing breakdown for the data platform — agent RAM overhead, trial vs paid costs, and how to cleanly disable all Datadog components by setting dd_api_key to empty."
related:
  - datadog-architecture-overview
  - datadog-agent-airflow-vm
  - datadog-agent-sql-vm
  - datadog-troubleshooting
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Datadog Cost Optimization

The the data pipeline project Datadog setup runs two agents (Airflow VM and SQL VM) plus a GCP Integration. The agent software itself is free — costs are incurred from Datadog's SaaS based on host count and log/trace volume.

---

## Cost Breakdown

| Component | Monthly Cost |
|-----------|-------------|
| dd-agent on Airflow VM | $0 (uses existing VM resources, ~350 MB RAM) |
| dd-agent on SQL VM | $0 (uses existing VM resources, ~250 MB RAM) |
| Datadog EU (14-day trial) | $0 |
| Datadog EU (after trial, Infrastructure + Logs + APM Pro) | ~$50-80/host |

The agent itself is free — you pay for Datadog's SaaS based on host count and log/trace volume.

---

## What Drives Cost

| Feature | Cost Driver |
|---------|-------------|
| Infrastructure Monitoring | Per host per month |
| Log Management | Per GB ingested and indexed |
| APM (Application Performance Monitoring) | Per host with APM enabled |
| GCP Integration | Included with Infrastructure plan |

With 2 VMs (Airflow + SQL), expect 2 billable hosts. The Cloud Run job does not count as a host — it uses the APM Agent on the Airflow VM (which is already counted).

---

## Agent Memory Overhead

The agents are lightweight additions to existing VMs:

| VM | Agent Type | RAM Overhead |
|----|-----------|-------------|
| data-pipeline-airflow (e2-medium, 4 GB) | Docker container | ~350 MB |
| data-pipeline-sql (e2-small, 2 GB) | systemd package | ~250 MB |

See [[datadog-agent-airflow-vm]] for the full memory budget on the Airflow VM (total ~1,650 MB out of 4 GB).

---

## Disabling Datadog (Removing All Costs)

Everything is conditional on `var.dd_api_key != ""`. To disable:

1. Set `dd_api_key = ""` in `infra/terraform.tfvars`
2. Run `terraform apply` — all conditional Datadog resources are destroyed (service account, firewall rule, VM metadata)
3. SSH into Airflow VM and remove the agent:
   ```bash
   docker rm -f dd-agent
   ```
4. SSH into SQL VM and stop the agent:
   ```bash
   sudo systemctl disable datadog-agent && sudo systemctl stop datadog-agent
   ```
5. Revert Dockerfile entrypoint:
   ```dockerfile
   ENTRYPOINT ["python", "utils/run_pipeline.py"]
   ```
6. Remove `ddtrace>=2.10.0` from `requirements.txt`
7. Rebuild and push the pipeline image
8. The logger and `run_pipeline.py` trace code no-ops automatically (`ImportError` guard) — no code changes needed

One `terraform apply` + one image rebuild cleans up everything.

> [!tip] Trial-to-Paid Transition
> The 14-day trial gives full access to all Datadog features. Use the trial period to build dashboards, monitors, and verify the full observability stack. After the trial, evaluate which features are worth the cost (Infrastructure + APM at ~$50-80/host/month is the typical entry point for production monitoring).

---

## Cost Reduction Strategies

If cost is a concern after the trial:

1. **Infrastructure only (no APM, no Logs):** Lowest tier. Keeps VM metrics and the SQL Server integration. Lose traces and log search.
2. **GCE Automuting:** Enable in the GCP Integration so monitors are silenced and not billed for evaluation periods when VMs are stopped overnight.
3. **Log sampling:** Configure log pipelines to drop high-volume debug logs and only index warnings/errors.
4. **Trace sampling:** Configure `ddtrace` to sample a fraction of traces (e.g., 10%) to reduce APM host costs.

---

## Related

- [[datadog-architecture-overview]] — Full observability topology
- [[datadog-agent-airflow-vm]] — Memory budget on Airflow VM
- [[datadog-agent-sql-vm]] — SQL VM agent management
- [[datadog-troubleshooting]] — Disabling Datadog section
