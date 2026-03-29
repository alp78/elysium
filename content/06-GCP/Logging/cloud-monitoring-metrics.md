---
type: concept
category: gcp
technology: [gcp, cloud-monitoring, observability]
tags: [observability, infrastructure, gcp, monitoring]
aliases: [Cloud Monitoring, GCP metrics, time series, gcloud monitoring, VM CPU metrics, Cloud Monitoring metrics descriptors, BigQuery metrics]
keywords: [cloud monitoring, metrics, time series, gcloud monitoring time-series list, metrics descriptors, CPU utilization, disk read, disk write, network, cloud run job completions, pubsub backlog, bigquery slot usage, capacity planning, right-sizing, monitoring time-series, interval-start-time, doubleValue]
description: "How to query Cloud Monitoring time-series metrics using the gcloud CLI — listing available metric types and reading historical metric data for capacity planning, right-sizing, and pipeline health monitoring."
related: [cloud-logging, vm-lifecycle, cloud-run-jobs-vs-services, pubsub-messaging, dataset-and-table-management]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Cloud Monitoring — Metrics and Alerts

Cloud Monitoring captures time-series metrics for every GCP resource. When your VM's CPU spikes, when a Cloud Run job fails repeatedly, or when a Pub/Sub subscription is falling behind — Cloud Monitoring has the data. The `gcloud monitoring` commands let you explore available metrics and read historical data from the command line, without opening the Cloud Console. This is essential for scripted capacity planning and right-sizing decisions.

### Listing Available Cloud Monitoring Metric Types

```bash
# List available metric types
gcloud monitoring metrics-descriptors list --filter="metric.type:compute.googleapis.com/instance/cpu"
# Explore what metrics are available for your resource types
```

Use `--filter` to narrow down the potentially enormous list of available metrics. Filter by service prefix to see all metrics for a given resource type.

## Reading Time-Series Metric Data

#### gcloud monitoring read — CPU utilization for a VM over 24 hours
```bash
# Read metric data (CPU utilization for a VM over 24 hours)
gcloud monitoring time-series list \
  --filter='metric.type="compute.googleapis.com/instance/cpu/utilization" AND resource.labels.instance_id="data-pipeline-sql"' \
  --interval-start-time="$(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%SZ)" \
  --format="value(points.value.doubleValue)"
# Returns data points — pipe to sort -n | tail for peak utilization
```

#### gcloud monitoring read REDUCE_MAX — VM right-sizing, peak CPU over 7 days
```bash
# Check actual utilization over the last week
gcloud monitoring time-series list \
  --filter='metric.type="compute.googleapis.com/instance/cpu/utilization"
            AND resource.labels.instance_id="data-pipeline-sql"' \
  --interval-start-time="$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%SZ)" \
  --format="value(points.value.doubleValue)" | sort -n | tail -5
```

> [!tip] Metrics for Right-Sizing
>
> Use Metrics for Right-Sizing Decisions.
> Pull CPU utilization data before any VM resize decision. If the top 5 data points (peak values from the last 7 days) are all below 0.30 (30%), the VM is over-provisioned. The `sort -n | tail -5` pipeline extracts the highest recorded values, which represent true peak load. See [[vm-lifecycle]] for the full right-sizing workflow.

### Key Cloud Monitoring Metrics for Data Engineers

| Metric | Description |
|---|---|
| `compute.googleapis.com/instance/cpu/utilization` | VM CPU % |
| `compute.googleapis.com/instance/disk/read_bytes_count` | Disk read throughput |
| `compute.googleapis.com/instance/disk/write_bytes_count` | Disk write throughput |
| `compute.googleapis.com/instance/network/received_bytes_count` | Network in |
| `run.googleapis.com/job/completed_task_attempt_count` | Cloud Run job completions |
| `pubsub.googleapis.com/subscription/num_undelivered_messages` | Pub/Sub backlog |
| `bigquery.googleapis.com/query/count` | BigQuery query count |
| `bigquery.googleapis.com/slots/total_available` | BigQuery slot usage |

### Metrics vs Logs — When to Use Each

| Signal type | Tool | Best for |
|---|---|---|
| Metrics (numeric, aggregated) | Cloud Monitoring | Trends, capacity planning, alerting thresholds, right-sizing |
| Logs (text, events) | [[cloud-logging|Cloud Logging]] | Root cause analysis, debugging failures, finding specific errors |

Metrics tell you *how much* and *when* — they are aggregated numbers over time. Logs tell you *what happened* — they are discrete events with full context. Senior engineers use both together: metrics surface anomalies, logs explain them.

### Common Cloud Monitoring Patterns for Data Engineering

**Is the Pub/Sub backlog growing?**
```bash
gcloud monitoring time-series list \
  --filter='metric.type="pubsub.googleapis.com/subscription/num_undelivered_messages" AND resource.labels.subscription_id="pipeline-sub"' \
  --interval-start-time="$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)" \
  --format="value(points.value.int64Value)"
```

**Are Cloud Run jobs completing successfully?**
```bash
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/job/completed_task_attempt_count"' \
  --interval-start-time="$(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%SZ)" \
  --format="value(metric.labels.result,points.value.int64Value)"
# Look for "failed" in the result label to count job failures
```

### Cloud Monitoring Alerting Policies

While `gcloud monitoring` CLI commands are used for ad-hoc queries, alerting policies are best configured through the Cloud Console or Terraform. The Cloud Console's alerting UI supports:
- Threshold conditions on any metric (e.g., CPU > 80% for 5 minutes)
- Anomaly detection for unusual metric spikes
- Notification channels (email, PagerDuty, Slack, Pub/Sub)
- SLO-based alerting for error rates and latency

## Related

- [[cloud-logging]] — Logs complement metrics for full observability; use both during incident response
- [[vm-lifecycle]] — Metric-driven right-sizing decisions for Compute Engine VMs
- [[cloud-run-jobs-vs-services]] — Monitor `run.googleapis.com/job/completed_task_attempt_count` for pipeline success rates
- [[pubsub-messaging]] — `pubsub.googleapis.com/subscription/num_undelivered_messages` detects pipeline lag
- [[dataset-and-table-management]] — BigQuery slot utilization metrics for capacity planning

## References

- [Cloud Monitoring metrics list](https://cloud.google.com/monitoring/api/metrics_gcp)
- [gcloud monitoring time-series reference](https://cloud.google.com/sdk/gcloud/reference/monitoring/time-series/list)
- [Creating alerting policies](https://cloud.google.com/monitoring/alerts/using-alerting-ui)
