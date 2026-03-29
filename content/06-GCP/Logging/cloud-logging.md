---
type: concept
category: gcp
technology: [gcp, cloud-logging, observability]
tags: [infrastructure, gcp, monitoring]
aliases: [Cloud Logging, gcloud logging read, GCP logs, log filter, log severity, gcloud logging tail, structured logging, audit logs]
keywords: [cloud logging, gcloud logging read, gcloud logging tail, log filter, severity, ERROR, WARNING, INFO, timestamp, textPayload, resource.type, cloud_run_job, gce_instance, full-text search, real-time logs, audit logs, write log entry, log filter language, structured logs]
description: "How to query, filter, and tail GCP Cloud Logging using the gcloud CLI — filtering by severity, time range, resource type, and full-text content to diagnose pipeline failures and infrastructure issues in real-time."
related: [cloud-monitoring-metrics, cloud-run-jobs-vs-services, vm-lifecycle, vpc-service-controls, dataset-and-table-management]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Cloud Logging — Finding the Needle

When your Cloud Run job fails at 3 AM, Cloud Logging is the first place you look. As one of the three pillars covered in [[observability-deep-dive]], logging complements metrics and tracing to give you full incident visibility. The `gcloud logging read` command supports a powerful filter language that lets you narrow from millions of log entries to the specific failure in seconds. The filter language uses field paths, comparison operators, and logical connectives — it is not grep, it is a structured query language applied to structured log records.

### Reading Recent Cloud Logs

```bash
# Read recent logs (most recent first)
gcloud logging read 'resource.type="cloud_run_job"' --limit=50 --format=json
# The filter language is powerful — learn it well
```

### Filtering Cloud Logs by Severity

```bash
# Filter by severity
gcloud logging read 'severity>=ERROR' --limit=20
# Severity levels: DEFAULT, DEBUG, INFO, NOTICE, WARNING, ERROR, CRITICAL, ALERT, EMERGENCY
```

### Filtering Cloud Logs by Time Range

```bash
# Filter by time range
gcloud logging read 'timestamp>="2026-03-09T14:00:00Z" AND timestamp<="2026-03-09T15:00:00Z"' --limit=100
# ISO 8601 timestamps in UTC
```

### Full-Text Search in Cloud Log Messages

```bash
# Full-text search in log messages
gcloud logging read 'textPayload:"deadlock"' --limit=10
# textPayload:"search_term" = substring search in the message body
```

### Filtering Cloud Logs by Resource Type

```bash
# Filter by specific resource
gcloud logging read 'resource.type="gce_instance" AND resource.labels.instance_id="data-pipeline-sql"' --limit=30
```

### Combining Log Filters for Incident Response

```bash
# Combine filters (the pipeline failed — what happened?)
gcloud logging read '
  resource.type="cloud_run_job"
  AND severity>=WARNING
  AND resource.labels.job_name="data-pipeline-pipeline"
  AND timestamp>="2026-03-09T00:00:00Z"
' --limit=100 --format="table(timestamp,severity,textPayload)"
```

### Tailing Cloud Logs in Real-Time

```bash
# Tail logs in real-time (live stream)
gcloud logging tail 'resource.type="cloud_run_job" AND severity>=ERROR'
# Like tail -f for cloud logs — new entries appear as they're written
# Ctrl+C to stop
# Use case: watch pipeline execution in real-time
```

> [!tip] Use Logging Tail for Incidents
>
> Use `gcloud logging tail` During Active Incidents.
> `gcloud logging tail` is your live monitoring window during an incident or deployment. Combine it with a severity filter and resource type to see only what matters. Unlike polling `gcloud logging read` repeatedly, `tail` opens a streaming connection — entries appear in near-real-time with sub-second latency.

### Writing Test Log Entries

```bash
# Write a test log entry
gcloud logging write pipeline-events "Manual test entry from CLI" --severity=INFO
# Use case: verify log routing and alerting
```

### Cloud Logging Filter Language Reference

| Filter | What it matches |
|---|---|
| `resource.type="cloud_run_job"` | All Cloud Run job logs |
| `resource.type="gce_instance"` | All VM logs |
| `severity>=ERROR` | ERROR, CRITICAL, ALERT, EMERGENCY |
| `severity=WARNING` | Exactly WARNING severity |
| `textPayload:"search term"` | Log messages containing this substring |
| `jsonPayload.message:"search"` | Structured JSON log messages containing this substring |
| `resource.labels.job_name="name"` | Logs from a specific Cloud Run job |
| `resource.labels.instance_id="id"` | Logs from a specific VM |
| `timestamp>="2026-03-22T00:00:00Z"` | Logs after this UTC timestamp |
| `protoPayload.status.code=7` | Permission denied errors (VPC-SC violations use code 7) |

### Common Cloud Logging Resource Types for Data Engineering

| Resource type | What it covers |
|---|---|
| `cloud_run_job` | Cloud Run Jobs |
| `cloud_run_revision` | Cloud Run Services |
| `gce_instance` | Compute Engine VMs |
| `bigquery_resource` | BigQuery operations |
| `pubsub_subscription` | Pub/Sub delivery events |
| `k8s_container` | Kubernetes/GKE containers |

> [!tip] Related pattern
>
> SQL Server [[audit-logging]] can forward its audit events to Cloud Logging via the Datadog agent or custom log sinks, unifying database and infrastructure logs in one place. For teams using Datadog as an alternative log destination, [[datadog-log-management]] provides the routing configuration.

### Querying VPC-SC Violations in Cloud Logging

Cloud Audit Logs (a special log type in Cloud Logging) record all VPC Service Controls denials. See [[vpc-service-controls]] for the specific filter pattern.

## Related

- [[cloud-monitoring-metrics]] — Metrics tell you *how much*; logs tell you *what happened*
- [[cloud-run-jobs-vs-services]] — Cloud Run job logs are the most common starting point for pipeline debugging
- [[vm-lifecycle]] — VM system logs appear under `resource.type="gce_instance"`
- [[vpc-service-controls]] — VPC-SC violations appear in Cloud Audit Logs
- [[dataset-and-table-management]] — BigQuery operations appear under `resource.type="bigquery_resource"`

## References

- [Cloud Logging filter language](https://cloud.google.com/logging/docs/view/logging-query-language)
- [Resource types](https://cloud.google.com/logging/docs/api/v2/resource-list)
- [gcloud logging reference](https://cloud.google.com/sdk/gcloud/reference/logging)
