---
title: "13 - Datadog Cost Optimization"
tags: [monitoring, observability, performance, cost, datadog, gcp]
aliases: [Datadog Costs, Datadog Pricing, DD Agent Cost, Datadog Cost Reference, Datadog Monthly Cost]
description: "Datadog pricing breakdown for the data platform — agent RAM overhead, trial vs paid costs, and how to cleanly disable all Datadog components by setting dd_api_key to empty."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Datadog Cost Optimization

> [!quote]+
> "The biggest cost in observability is not the tooling — it is the data you collect that nobody ever looks at."
>
> — **Charity Majors**, CTO of Honeycomb

> [!abstract]- Summary
>
> This note treats observability as a costed design choice rather than a free default: it breaks down where Datadog spend comes from in this platform, how much footprint the agents add to small VMs, when disabling the stack is sensible, and how to compare Datadog's benefits against GCP-native monitoring for the same workloads.
>
> **Cost model**
> - Breaks Datadog usage into its main cost drivers, including hosts, logs, custom metrics, and tracing volume.
> - Helps the reader understand which parts of the observability design actually move the bill.
>
> **Runtime overhead**
> - Covers the agent memory footprint on the small VMs and the option to disable Datadog entirely when the platform does not need it.
> - Keeps infrastructure resource pressure tied to the same economic discussion as SaaS spend.
>
> **Reduction strategies**
> - Lists practical ways to shrink cost, such as narrowing signal scope, using the trial period intentionally, and avoiding unnecessary collection volume.
> - Frames optimization as keeping the highest-value signals rather than blindly cutting telemetry.
>
> **Platform tradeoff**
> - Compares Datadog cost against the surrounding GCP infrastructure and against what GCP-native observability already provides.
> - When to use: the team needs to justify, trim, or temporarily disable Datadog based on actual operational value.

> [!note]- Glossary
>
> **billable host**
> - A machine or runtime Datadog counts toward host-based pricing.
> - It matters here because VM count is one of the clearest recurring cost inputs in the platform.
>
> > [!info] Infrastructure pricing unit
> >
> > If host visibility is not needed, removing or consolidating agents can reduce spend immediately.
>
> ---
>
> **custom metric**
> - A metric outside the default product set, often billed differently because it increases indexed cardinality and volume.
> - It matters here because Datadog custom SQL metrics are powerful but not free.
>
> > [!tip] High-value only
> >
> > Custom metrics should answer a question important enough to justify both config and recurring cost.
>
> ---
>
> **ingested log volume**
> - The amount of log data shipped into Datadog for indexing and retention.
> - It matters here because verbose or low-value log streams can dominate cost quickly.
>
> > [!info] Volume becomes bill
> >
> > Logging every line is easy; paying for and searching it later is the real constraint.
>
> ---
>
> **APM volume**
> - The amount of trace data collected and retained by Datadog APM.
> - It matters here because broad tracing can create meaningful spend even when the tracing model is technically correct.
>
> > [!tip] Trace what matters
> >
> > Sampling and scope control are cost tools as much as performance tools.
>
> ---
>
> **agent overhead**
> - The CPU and memory consumed by the Datadog agent itself on a host.
> - It matters here because small VMs feel the monitoring footprint more sharply than large ones.
>
> > [!info] SaaS cost plus runtime cost
> >
> > The hosted bill is only part of the price; the collector also consumes local capacity.
>
> ---
>
> **feature gate**
> - A configuration switch that enables or disables a subsystem as a unit.
> - It matters here because `dd_api_key` acts as a clean infrastructure-wide gate for Datadog in this project.
>
> > [!tip] All-or-nothing control
> >
> > A strong feature gate makes evaluation and rollback cheaper than hand-editing several partial configs.
>
> ---
>
> **trial period**
> - A time-boxed vendor evaluation window used to test value before committing to ongoing spend.
> - It matters here because observability should prove its operating benefit before it becomes a permanent bill line.
>
> > [!info] Evaluate deliberately
> >
> > Use the trial to validate dashboards, monitors, and incident workflows, not just raw signal arrival.
>
> ---
>
> **total cost of observability**
> - The combined SaaS, infrastructure, and human tradeoffs involved in a monitoring design.
> - It matters here because the real decision is not Datadog price alone, but whether the gained visibility offsets its full cost.
>
> > [!tip] Cost is multidimensional
> >
> > An observability platform is worth its price only if it shortens incidents or prevents bad outcomes materially.

### Datadog Cost Breakdown per Component

| Component | Monthly Cost |
|-----------|-------------|
| dd-agent on Airflow VM | $0 (uses existing VM resources, ~350 MB RAM) |
| dd-agent on SQL VM | $0 (uses existing VM resources, ~250 MB RAM) |
| Datadog EU (14-day trial) | $0 |
| Datadog EU (after trial, Infrastructure + Logs + APM Pro) | ~$50-80/host |

The agent itself is free — you pay for Datadog's SaaS based on host count and log/trace volume.

---

### What Drives Datadog Cost

| Feature | Cost Driver |
|---------|-------------|
| Infrastructure Monitoring | Per host per month |
| Log Management | Per GB ingested and indexed |
| APM (Application Performance Monitoring) | Per host with APM enabled |
| GCP Integration | Included with Infrastructure plan |

With 2 VMs (Airflow + SQL), expect 2 billable hosts. The Cloud Run job does not count as a host — it uses the APM Agent on the Airflow VM (which is already counted).

---

### Datadog Agent Memory Overhead

The agents are lightweight additions to existing VMs:

| VM | Agent Type | RAM Overhead |
|----|-----------|-------------|
| data-pipeline-airflow (e2-medium, 4 GB) | Docker container | ~350 MB |
| data-pipeline-sql (e2-small, 2 GB) | systemd package | ~250 MB |

See [datadog-agent-airflow-vm](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-agent-airflow-vm) for the full memory budget on the Airflow VM (total ~1,650 MB out of 4 GB).

---

### Disabling Datadog to Remove All Costs

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
> The 14-day trial gives full access to all Datadog features. Use the trial period to build dashboards, monitors, and verify the full observability stack. After the trial, evaluate which features are worth the cost (Infrastructure + APM at ~$50-80/host/month is the typical entry point for production monitoring). For a broader view of cost management across the GCP stack, see [gcp-billing-and-pricing](https://alp78.github.io/elysium/06-GCP/Cost-Management/gcp-billing-and-pricing).

> [!tip] Related pattern
> The cost optimization mindset here parallels the [SQL Server FinOps](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/finops-cost-optimization) approach: right-size resources first, then decide which premium capabilities (APM traces, log indexing) deliver enough value to justify their cost.

---

### Datadog Cost Reduction Strategies

If cost is a concern after the trial:

1. **Infrastructure only (no APM, no Logs):** Lowest tier. Keeps VM metrics and the SQL Server integration. Lose traces and log search.
2. **GCE Automuting:** Enable in the GCP Integration so monitors are silenced and not billed for evaluation periods when VMs are stopped overnight.
3. **Log sampling:** Configure log pipelines to drop high-volume debug logs and only index warnings/errors.
4. **Trace sampling:** Configure `ddtrace` to sample a fraction of traces (e.g., 10%) to reduce APM host costs.

---

### Datadog Trial and Evaluation Period

The Datadog EU 14-day trial is sufficient to:

- Set up both agents
- Configure the GCP Integration
- Build the Pipeline Watch and SQL Server DBA dashboards
- Test APM traces and log collection
- Evaluate whether the full subscription is worthwhile

After the trial, set `dd_api_key = ""` in `terraform.tfvars` and run `terraform apply` to cleanly disable everything. See [datadog-troubleshooting](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-troubleshooting) for the full disabling procedure.

---

### Datadog Compared to GCP Infrastructure Costs

For context, Datadog is optional add-on monitoring. The base the data pipeline project GCP infrastructure costs ~$83/month (see cost reference). Datadog adds:

- Trial: $0
- After trial (if subscribed): ~\$100–160/month (2 hosts × \$50–80)

The Datadog subscription would roughly double the total infrastructure cost. Evaluate whether the observability value justifies the cost relative to using GCP Cloud Monitoring (free) and Cloud Logging (free tier).

---

## Related

- [datadog-architecture-overview](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-architecture-overview) — Full observability topology
- [datadog-agent-airflow-vm](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-agent-airflow-vm) — Memory budget on Airflow VM
- [datadog-agent-sql-vm](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-agent-sql-vm) — SQL VM agent management
- [datadog-troubleshooting](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-troubleshooting) — Disabling Datadog section
