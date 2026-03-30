---
type: reference
category: observability
technology: [datadog]
tags: [monitoring, observability, cost, datadog]
aliases: [Datadog Cost, Datadog Pricing, Datadog Monthly Cost]
keywords: [Datadog EU, datadoghq.eu, 14-day trial, Infrastructure, Logs, APM Pro, 50-80 per host, dd-agent RAM, 350 MB, 250 MB, free trial, agent cost, SaaS, host count, log volume, trace volume]
description: "Datadog cost reference for the data platform — the agents themselves are free, costs are Datadog SaaS pricing based on host count and log/trace volume, with the EU 14-day trial covering initial setup."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Datadog Cost Reference

> [!quote]
> "If you don't measure it, you can't optimize it."
> — **Coda Hale**

Datadog agents themselves add no GCP compute cost — they run on existing VMs. The only cost is Datadog's SaaS pricing based on host count and observability product usage.

---

### Datadog SaaS Cost Breakdown

| Component | Monthly Cost |
|-----------|-------------|
| dd-agent on Airflow VM | $0 (uses existing VM resources, ~350 MB RAM) |
| dd-agent on SQL VM | $0 (uses existing VM resources, ~250 MB RAM) |
| Datadog EU (14-day trial) | $0 |
| Datadog EU (after trial, Infrastructure + Logs + APM Pro) | ~$50–80/host |

The agent itself is free — you pay for Datadog's SaaS based on host count and log/trace volume.

---

### What Drives Datadog Pricing

**Host count:** The data platform has 2 monitored hosts (`data-pipeline-airflow` and `data-pipeline-sql`). Cloud Run jobs are ephemeral and don't count as hosts — their metrics come from the [GCP Integration](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-gcp-integration).

**Log volume:** SQL Server only logs significant events (startups, errors, failed logins, backups) — not regular queries. Log volume is very low.

**APM trace volume:** The pipeline runs 1–3 times per day via Airflow. Each run generates traces for 16–17 steps. Trace volume is very low.

**GCP Integration:** Free — included in the Infrastructure plan.

---

### Datadog Agent RAM Impact on Existing VMs

| VM | Total RAM | dd-agent usage | Headroom |
|----|-----------|----------------|---------|
| data-pipeline-airflow (e2-medium, 4 GB) | 4 GB | ~350 MB | ~2.35 GB free |
| data-pipeline-sql (e2-small, 2 GB) | 2 GB | ~250 MB | ~1.5 GB free |

Both VMs have sufficient headroom. Monitor via **Datadog Infrastructure > Host Map** if memory pressure is suspected.

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
- After trial (if subscribed): ~$100–160/month (2 hosts × $50–80)

The Datadog subscription would roughly double the total infrastructure cost. Evaluate whether the observability value justifies the cost relative to using GCP Cloud Monitoring (free) and Cloud Logging (free tier).

---

## Related Notes

- [datadog-architecture-overview](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-architecture-overview) — full observability architecture
- cost reference — GCP infrastructure cost reference
- [datadog-troubleshooting](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-troubleshooting) — how to disable Datadog if trial ends
