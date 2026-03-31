---
type: reference
category: observability
technology:
  - gcp
  - cloud-monitoring
  - python
tags: [monitoring, observability, python, gcp]
aliases:
  - Cloud Monitoring
  - Stackdriver
  - GCP metrics
  - MQL
  - Monitoring Query Language
  - alerting policy
  - notification channel
  - uptime check
  - SLI
  - SLO
keywords:
  - cloud monitoring
  - stackdriver
  - GCP observability
  - metric descriptor
  - monitored resource
  - time series
  - MQL
  - monitoring query language
  - alerting policy
  - notification channel
  - uptime check
  - SLI
  - SLO
  - error budget
  - ops agent
  - custom metrics
  - GAUGE
  - DELTA
  - CUMULATIVE
  - dashboard
  - data engineering monitoring
  - bigquery monitoring
  - pubsub monitoring
  - cloud run monitoring
  - compute engine monitoring
  - firestore monitoring
  - cloud storage monitoring
  - pipeline health
  - data freshness
  - slot utilization
  - backlog monitoring
  - metric alignment
  - metric aggregation
  - gcloud monitoring
  - python monitoring sdk
  - monitoring_v3
  - ops agent sql server
description: >
  Definitive reference for using GCP Cloud Monitoring (formerly Stackdriver) to
  monitor data engineering infrastructure. Covers metric types, monitored resources,
  MQL, custom metrics, dashboards, alerting policies, uptime checks, SLOs, and a
  comprehensive feature-parity comparison with Datadog — using only GCP-native tools.
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# GCP Cloud Monitoring — Deep Dive

> [!quote]
> "The future of monitoring is leaning strongly toward complex analytics on epic amounts of telemetry data."
>
> — **Theo Schlossnagle**

> [!abstract] Purpose
> This is the definitive reference for using GCP Cloud Monitoring (formerly Stackdriver) as the single observability platform for data engineering infrastructure. The goal: achieve full operational parity with Datadog using only GCP-native tools, at a fraction of the cost.

---

### Table of Contents

1. [Cloud Monitoring Architecture](#cloud-monitoring-architecture)
2. [Monitoring Every GCP Component Used in Data Engineering](#monitoring-every-gcp-component-used-in-data-engineering)
   - [Compute Engine VMs](#compute-engine-vms)
   - [BigQuery](#bigquery)
   - [Cloud Run Jobs and Services](#cloud-run-jobs-and-services)
   - [Pub/Sub](#pubsub)
   - [Cloud Storage](#cloud-storage)
   - [Firestore](#firestore)
   - [Cloud Scheduler and Cloud Functions](#cloud-scheduler-and-cloud-functions)
3. [Monitoring Query Language (MQL)](#monitoring-query-language-mql)
4. [Custom Metrics for Data Pipelines](#custom-metrics-for-data-pipelines)
5. [Dashboards](#dashboards)
6. [Alerting Policies](#alerting-policies)
7. [Uptime Checks](#uptime-checks)
8. [SLIs and SLOs](#slis-and-slos)
9. [Cloud Monitoring vs Datadog — Feature Parity](#cloud-monitoring-vs-datadog-feature-parity)
10. [Operational Runbook](#operational-runbook)

---

## Cloud Monitoring Architecture

### How Cloud Monitoring Collects Metrics

Cloud Monitoring is a fully managed time-series database and alerting service. Metrics flow in through four distinct pathways:

| Ingestion Path | Examples | Latency |
|---|---|---|
| **GCP built-in integration** | Compute Engine CPU, BigQuery slots, Pub/Sub backlog | 1–3 min |
| **Ops Agent** (on-VM agent) | Custom logs, SQL Server counters, process metrics | 1 min |
| **Cloud Monitoring API** | Custom metrics written by application code | Seconds |
| **Metric scopes / workspace federation** | Cross-project monitoring | Varies |

The underlying storage is a time-series database. Each time series is identified by a **metric type** + a **monitored resource** + **metric labels**. All time series are stored in Cloud Monitoring automatically — you do not provision any database.

### Metric Types: GAUGE, DELTA, CUMULATIVE

Understanding metric kinds is critical for correct MQL aggregation and alerting.

| Kind | Definition | Example | Aggregation |
|---|---|---|---|
| **GAUGE** | Snapshot value at a point in time | CPU utilization (0.0–1.0) | mean, max, percentile |
| **DELTA** | Value represents change over the alignment period | Bytes written per minute | sum, rate |
| **CUMULATIVE** | Ever-increasing counter; resets only on restart | Total requests served | rate(), delta() |

> [!warning] Aggregation Pitfall
> Summing a GAUGE metric (e.g., CPU utilization) across instances gives a meaningless number. Always use `mean()` or `max()` for GAUGE. For CUMULATIVE metrics, always call `rate()` first to convert to a per-second rate before aggregating across resources.

### Metric Descriptors

A **metric descriptor** defines the schema for a metric type. Key fields:

```
MetricDescriptor {
  type:         "compute.googleapis.com/instance/cpu/utilization"
  metricKind:   GAUGE
  valueType:    DOUBLE
  unit:         "1" (unitless ratio 0.0–1.0)
  labels:       []  (none; resource labels carry instance identity)
  description:  "CPU utilization across all vCPUs"
}
```

Inspect any metric descriptor:

```bash
gcloud monitoring metrics-descriptors describe \
  "compute.googleapis.com/instance/cpu/utilization"

# List all metric descriptors for a service
gcloud monitoring metrics-descriptors list \
  --filter="metric.type:bigquery.googleapis.com"

# List custom metric descriptors
gcloud monitoring metrics-descriptors list \
  --filter="metric.type:custom.googleapis.com"
```

### Monitored Resource Types

Every time series is tagged with a **monitored resource type** that identifies where the metric originates. The most important resource types for data engineering:

| Resource Type | Use Case | Key Labels |
|---|---|---|
| `gce_instance` | Compute Engine VMs (SQL Server, Airflow) | `instance_id`, `zone`, `project_id` |
| `cloud_run_job` | Cloud Run Jobs | `job_name`, `location`, `project_id` |
| `cloud_run_revision` | Cloud Run Services | `service_name`, `revision_name`, `location` |
| `pubsub_subscription` | Pub/Sub consumer lag | `subscription_id`, `project_id` |
| `pubsub_topic` | Pub/Sub producer metrics | `topic_id`, `project_id` |
| `bigquery_project` | BigQuery slot usage | `project_id`, `location` |
| `bigquery_dataset` | Dataset-level metrics | `dataset_id`, `project_id` |
| `cloudsql_database` | Cloud SQL instances | `database_id`, `region` |
| `gcs_bucket` | Cloud Storage | `bucket_name`, `location` |
| `firestore_database` | Firestore | `database_id`, `project_id` |
| `k8s_container` | GKE containers | `cluster_name`, `namespace_name`, `pod_name` |
| `cloud_function` | Cloud Functions | `function_name`, `region` |
| `cloud_scheduler_job` | Cloud Scheduler | `job_id`, `location` |
| `uptime_url` | Uptime check endpoints | `host`, `check_id` |

Inspect a resource type descriptor:

```bash
gcloud monitoring resource-descriptors describe gce_instance
gcloud monitoring resource-descriptors list
```

### Data Retention

| Resolution | Retention |
|---|---|
| Raw (original sample rate) | 6 weeks |
| 1-minute aligned | 6 weeks |
| 10-minute aligned | 5 years |
| 1-hour aligned | 5 years |

> [!note] Retention Implications
> For dashboards showing the last 7 days, raw resolution is available. For quarterly trend analysis, data is available but at 10-minute or 1-hour granularity. Plan alert thresholds accordingly — an alert with a 5-minute window must query raw or 1-minute data.

### Custom Metrics: When and How

Create custom metrics when built-in metrics do not expose what you need:

- **Pipeline row throughput** — no built-in metric measures rows processed by a Python job
- **Data freshness** — no built-in metric knows when a table was last successfully refreshed
- **Business KPIs** — order count, revenue processed, records ingested per hour
- **Cross-service health** — a single metric aggregating multiple upstream statuses

Custom metric limits (per project):
- 500 active time series per custom metric descriptor (soft limit, raisable)
- 200 metric descriptors (soft limit)
- First 150 descriptors free; $0.10/descriptor/month beyond that
- Ingest: first 150 MB/month free; $0.01/MB after

---

## Monitoring Every GCP Component Used in Data Engineering

### Compute Engine VMs

VMs running SQL Server, Airflow schedulers, or custom Python workers require agent-level observability.

#### Built-in Metrics (No Agent Required)

These metrics are collected automatically by GCP infrastructure:

| Metric | Type | Description |
|---|---|---|
| `compute.googleapis.com/instance/cpu/utilization` | GAUGE | CPU utilization (0.0–1.0) |
| `compute.googleapis.com/instance/disk/read_bytes_count` | DELTA | Disk read bytes per alignment period |
| `compute.googleapis.com/instance/disk/write_bytes_count` | DELTA | Disk write bytes per alignment period |
| `compute.googleapis.com/instance/disk/read_ops_count` | DELTA | Disk read operations |
| `compute.googleapis.com/instance/disk/write_ops_count` | DELTA | Disk write operations |
| `compute.googleapis.com/instance/network/received_bytes_count` | DELTA | Network ingress bytes |
| `compute.googleapis.com/instance/network/sent_bytes_count` | DELTA | Network egress bytes |
| `compute.googleapis.com/instance/uptime` | DELTA | Seconds the VM has been running |
| `compute.googleapis.com/instance/memory/balloon_ram_used` | GAUGE | Memory used (only with balloon driver) |

> [!warning] Memory Metrics
> Built-in GCP metrics do NOT include OS-level memory utilization without the Ops Agent. The `balloon_ram_used` metric only applies to VMs with the virtio balloon driver configured. Install the Ops Agent to get real memory metrics.

#### Ops Agent: Installation

The Ops Agent replaces the legacy Logging and Monitoring agents. It collects logs via Fluent Bit and metrics via OpenTelemetry.

```bash
# Install Ops Agent on Debian/Ubuntu
curl -sSO https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh
sudo bash add-google-cloud-ops-agent-repo.sh --also-install

# Verify installation
sudo systemctl status google-cloud-ops-agent

# Check agent version
/opt/google-cloud-ops-agent/libexec/google_cloud_ops_agent_engine --version

# View agent logs
sudo journalctl -u google-cloud-ops-agent --no-pager -n 50
```

Automated installation via startup script or metadata:

```bash
gcloud compute instances add-metadata VM_NAME \
  --metadata=startup-script='#! /bin/bash
curl -sSO https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh
sudo bash add-google-cloud-ops-agent-repo.sh --also-install'
```

After installation, additional metrics become available:

| Metric | Description |
|---|---|
| `agent.googleapis.com/memory/percent_used` | OS memory utilization by state |
| `agent.googleapis.com/disk/percent_used` | Filesystem utilization |
| `agent.googleapis.com/processes/count_by_state` | Process count by state |
| `agent.googleapis.com/swap/percent_used` | Swap utilization |
| `agent.googleapis.com/cpu/load_1m` | 1-minute load average |
| `agent.googleapis.com/network/tcp_connections` | TCP connection count by state |

#### Ops Agent: SQL Server Configuration

The Ops Agent can collect SQL Server performance counters via its `sqlserver` receiver. Configuration lives at `/etc/google-cloud-ops-agent/config.yaml`.

> [!info] Ops Agent SQL Server authentication
> By default the Ops Agent uses Windows Authentication (the service account running the agent). To use SQL Authentication instead, uncomment `username` and `password` in the config below and set the environment variable `SQL_MONITORING_PASSWORD`.

```yaml
# /etc/google-cloud-ops-agent/config.yaml
metrics:
  receivers:
    sqlserver:
      type: sqlserver
      collection_interval: 60s
      # username: monitoring_user         # uncomment for SQL Authentication
      # password: ${SQL_MONITORING_PASSWORD}

  service:
    pipelines:
      sqlserver_metrics:
        receivers: [sqlserver]

logging:
  receivers:
    sqlserver_error_log:
      type: sql_server
      # Path to SQL Server error log
      include_paths:
        - "C:\\Program Files\\Microsoft SQL Server\\MSSQL*\\MSSQL\\Log\\ERRORLOG"

  service:
    pipelines:
      sqlserver_logs:
        receivers: [sqlserver_error_log]
        exporters: [google]
```

SQL Server metrics collected by the receiver:

| Metric | Counter | Alert Threshold |
|---|---|---|
| `sqlserver.page.buffer_cache.hit_ratio` | Buffer Cache Hit Ratio | < 90% |
| `sqlserver.lock.wait_time.avg` | Average Latch Wait Time (ms) | > 1000ms |
| `sqlserver.batch.request.rate` | Batch Requests/sec | Baseline + 3σ |
| `sqlserver.user.connection.count` | User Connections | > 80% max |
| `sqlserver.transaction.log.growth.count` | Log Growths | > 0 (unexpected growth) |
| `sqlserver.memory.page_life_expectancy` | Page Life Expectancy (PLE) | < 300s |
| `sqlserver.deadlock.count` | Number of Deadlocks/sec | > 0 |

After modifying config, restart the agent:

```bash
sudo systemctl restart google-cloud-ops-agent
# Verify config is valid
sudo /opt/google-cloud-ops-agent/libexec/google_cloud_ops_agent_engine \
  --config=/etc/google-cloud-ops-agent/config.yaml --feature=metrics
```

#### Key gcloud Commands for VM Monitoring

```bash
# Check VM status
gcloud compute instances describe VM_NAME \
  --zone=ZONE \
  --format='get(status)'

# Get serial port output (boot/crash logs)
gcloud compute instances get-serial-port-output VM_NAME \
  --zone=ZONE \
  --start=0

# List all instances with their status
gcloud compute instances list \
  --format='table(name,zone,status,machineType.basename())'

# SSH and check OS-level metrics manually
gcloud compute ssh VM_NAME --zone=ZONE -- \
  'free -h; df -h; uptime; ss -s'

# List all dashboards
gcloud monitoring dashboards list \
  --format='table(name,displayName)'

# Describe a specific dashboard
gcloud monitoring dashboards describe DASHBOARD_ID

# List all uptime checks
gcloud monitoring uptime list-configs
```

---

### BigQuery

BigQuery exposes metrics at the project and dataset level. For job-level detail, use `INFORMATION_SCHEMA`.

#### Built-in Metrics

| Metric | Type | Description |
|---|---|---|
| `bigquery.googleapis.com/storage/table_count` | GAUGE | Number of tables per dataset |
| `bigquery.googleapis.com/storage/row_count` | GAUGE | Number of rows per table |
| `bigquery.googleapis.com/storage/stored_bytes` | GAUGE | Stored bytes per table/dataset |
| `bigquery.googleapis.com/query/count` | DELTA | Number of queries per period |
| `bigquery.googleapis.com/query/scanned_bytes` | DELTA | Bytes scanned per period |
| `bigquery.googleapis.com/query/scanned_bytes_billed` | DELTA | Billable bytes scanned |
| `bigquery.googleapis.com/query/execution_times` | DELTA (distribution) | Query latency distribution |
| `bigquery.googleapis.com/slots/total_available` | GAUGE | Total slot capacity |
| `bigquery.googleapis.com/slots/allocated_for_project` | GAUGE | Slots in use by project |
| `bigquery.googleapis.com/slots/allocated_for_reservation` | GAUGE | Slots used per reservation |

#### INFORMATION_SCHEMA Queries for Job-Level Monitoring

Cloud Monitoring metrics are aggregated; for per-job visibility, query `INFORMATION_SCHEMA.JOBS`:

```sql
-- Top 20 most expensive queries in the last 24 hours
SELECT
  job_id,
  user_email,
  query,
  ROUND(total_bytes_processed / POW(1024, 3), 2) AS gb_scanned,
  ROUND(total_slot_ms / 1000 / 60, 2) AS slot_minutes,
  TIMESTAMP_DIFF(end_time, start_time, SECOND) AS duration_sec,
  state,
  creation_time
FROM `region-us`.INFORMATION_SCHEMA.JOBS
WHERE
  creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
  AND job_type = 'QUERY'
ORDER BY total_bytes_processed DESC
LIMIT 20;

-- Failed jobs in the last 6 hours
SELECT
  job_id,
  user_email,
  error_result.reason AS error_reason,
  error_result.message AS error_message,
  creation_time,
  query
FROM `region-us`.INFORMATION_SCHEMA.JOBS
WHERE
  creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 6 HOUR)
  AND state = 'DONE'
  AND error_result IS NOT NULL
ORDER BY creation_time DESC;

-- Slot utilization by reservation over time
SELECT
  reservation_id,
  DATE_TRUNC(creation_time, HOUR) AS hour,
  SUM(total_slot_ms) / 1000 / 3600 AS avg_slots_used
FROM `region-us`.INFORMATION_SCHEMA.JOBS
WHERE creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
GROUP BY 1, 2
ORDER BY 2 DESC, 3 DESC;

-- Long-running queries (> 5 minutes)
SELECT
  job_id,
  user_email,
  TIMESTAMP_DIFF(end_time, start_time, SECOND) AS duration_sec,
  total_bytes_processed,
  state,
  creation_time
FROM `region-us`.INFORMATION_SCHEMA.JOBS
WHERE
  creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
  AND TIMESTAMP_DIFF(end_time, start_time, SECOND) > 300
ORDER BY duration_sec DESC;
```

#### gcloud / bq Commands for Job Monitoring

```bash
# List recent jobs
bq ls -j --max_results=10 --format=prettyjson

# Show job details including error
bq show -j JOB_ID

# List jobs with status filter
bq ls -j --state=FAILURE --max_results=20

# Show BigQuery project info
bq show --project_id=PROJECT_ID

# Describe a dataset
bq show --dataset PROJECT_ID:DATASET_ID

# List tables in a dataset with size
bq ls --format=prettyjson PROJECT_ID:DATASET_ID

# Check slot reservations
bq ls --reservation --location=US --project_id=PROJECT_ID

# Show reservation details
bq show --reservation --location=US \
  PROJECT_ID:US.RESERVATION_NAME
```

> [!tip] Cost Control Alert
> The single most important BigQuery alert for cost control is `bigquery.googleapis.com/query/scanned_bytes_billed`. Set a threshold at your acceptable daily spend limit converted to bytes (e.g., $10/day at $5/TB on-demand = 2 TB = 2,000,000,000,000 bytes in 1 hour alert window).

---

### Cloud Run Jobs and Services

#### Built-in Metrics for Cloud Run Services

| Metric | Type | Description |
|---|---|---|
| `run.googleapis.com/request_count` | DELTA | Request count by response code |
| `run.googleapis.com/request_latencies` | DELTA (distribution) | Request latency percentiles |
| `run.googleapis.com/container/cpu/utilization` | GAUGE | CPU utilization per instance |
| `run.googleapis.com/container/memory/utilizations` | GAUGE | Memory utilization per instance |
| `run.googleapis.com/container/instance_count` | GAUGE | Active instance count |
| `run.googleapis.com/container/startup_latency` | DELTA (distribution) | Container startup time |
| `run.googleapis.com/container/billable_instance_time` | DELTA | Billable instance-seconds |

#### Built-in Metrics for Cloud Run Jobs

| Metric | Type | Description |
|---|---|---|
| `run.googleapis.com/job/execution_count` | DELTA | Execution count by completion status |
| `run.googleapis.com/job/running_executions` | GAUGE | Currently running executions |
| `run.googleapis.com/job/task_attempt_count` | DELTA | Task attempts by completion status |
| `run.googleapis.com/job/task_attempt_latencies` | DELTA (distribution) | Task duration percentiles |
| `run.googleapis.com/container/cpu/allocation_time` | DELTA | CPU seconds allocated |
| `run.googleapis.com/container/memory/allocations` | GAUGE | Memory allocated per container |

#### gcloud Commands for Cloud Run

```bash
# List all Cloud Run jobs
gcloud run jobs list --region=REGION \
  --format='table(name,region,lastRunStatus.completionTime)'

# List executions for a specific job
gcloud run jobs executions list \
  --job=JOB_NAME \
  --region=REGION \
  --limit=10 \
  --format='table(name,completionTime,succeeded,failed)'

# Describe a specific execution (includes task status)
gcloud run jobs executions describe EXECUTION_NAME \
  --region=REGION

# Get logs for a specific execution
gcloud logging read \
  'resource.type="cloud_run_job" AND resource.labels.job_name="JOB_NAME"' \
  --limit=100 \
  --format='table(timestamp,severity,textPayload)'

# Trigger a job manually
gcloud run jobs execute JOB_NAME --region=REGION

# Describe a Cloud Run service
gcloud run services describe SERVICE_NAME \
  --region=REGION \
  --format='get(status.conditions)'

# List all Cloud Run services
gcloud run services list --region=REGION \
  --format='table(name,region,status.conditions[0].status,url)'

# Get Cloud Run service traffic split
gcloud run services describe SERVICE_NAME \
  --region=REGION \
  --format='get(spec.traffic)'
```

#### Cold Start Monitoring

Cold starts add latency to Cloud Run services. Monitor `run.googleapis.com/container/startup_latency`:

```bash
# Query p99 startup latency via MQL
# (see MQL section for full query)

# Check current instance count (0 = cold)
gcloud run services describe SERVICE_NAME \
  --region=REGION \
  --format='get(status.observedGeneration)'
```

> [!note] Cloud Run Jobs vs Services
> Cloud Run Jobs do not have a concept of "cold start" in the alerting sense — every execution starts fresh. The relevant metric for jobs is `job/execution_count` filtered by `completion_status=failed`. Alert on any non-zero failed executions.

---

### Pub/Sub

Pub/Sub backlog is the most important pipeline health signal. A growing backlog means consumers are falling behind producers.

#### Built-in Metrics

| Metric | Resource | Type | Description |
|---|---|---|---|
| `pubsub.googleapis.com/subscription/num_undelivered_messages` | `pubsub_subscription` | GAUGE | Backlog message count |
| `pubsub.googleapis.com/subscription/oldest_unacked_message_age` | `pubsub_subscription` | GAUGE | Age of oldest unacked message (seconds) |
| `pubsub.googleapis.com/subscription/num_outstanding_messages` | `pubsub_subscription` | GAUGE | Messages outstanding to push subscribers |
| `pubsub.googleapis.com/subscription/delivery_latencies` | `pubsub_subscription` | DELTA (distribution) | End-to-end delivery latency |
| `pubsub.googleapis.com/subscription/num_undelivered_messages` | `pubsub_subscription` | GAUGE | Dead-letter topic backlog |
| `pubsub.googleapis.com/topic/send_message_operation_count` | `pubsub_topic` | DELTA | Publish operations |
| `pubsub.googleapis.com/topic/byte_cost` | `pubsub_topic` | DELTA | Bytes published (billing metric) |
| `pubsub.googleapis.com/snapshot/num_messages` | `pubsub_snapshot` | GAUGE | Messages in snapshot |

#### gcloud Commands for Pub/Sub

```bash
# List all subscriptions with key attributes
gcloud pubsub subscriptions list \
  --format='table(name,topic,ackDeadlineSeconds,messageRetentionDuration)'

# Describe a subscription (check DLQ, retention, filter)
gcloud pubsub subscriptions describe SUB_NAME

# Seek subscription to a specific timestamp (replay)
gcloud pubsub subscriptions seek SUB_NAME \
  --time=2026-03-20T00:00:00Z

# List snapshots for a topic
gcloud pubsub topics list-snapshots TOPIC_NAME

# Create a snapshot (for replay)
gcloud pubsub snapshots create SNAPSHOT_NAME \
  --subscription=SUB_NAME

# Pull messages manually (debugging)
gcloud pubsub subscriptions pull SUB_NAME \
  --max-messages=5 \
  --auto-ack

# List topics
gcloud pubsub topics list

# Describe a topic (check DLQ config)
gcloud pubsub topics describe TOPIC_NAME

# Check subscription IAM policy
gcloud pubsub subscriptions get-iam-policy SUB_NAME
```

> [!danger] Pipeline Stall Alert
> `oldest_unacked_message_age` is the single most important Pub/Sub metric. If a consumer crashes or falls behind, this value climbs. Alert at 300 seconds (5 minutes) for P1 pipelines. At 3600 seconds (1 hour), messages may be at risk of expiry depending on retention settings.

#### Consumer Lag Analysis

```bash
# Approximate consumer lag in number of messages
gcloud pubsub subscriptions describe SUB_NAME \
  --format='get(name,pushConfig,messageRetentionDuration)'

# Combine with metric query for true backlog depth
# (use MQL; see MQL section)
```

---

### Cloud Storage

#### Built-in Metrics

| Metric | Type | Description |
|---|---|---|
| `storage.googleapis.com/api/request_count` | DELTA | Requests by method (GET, PUT, DELETE) |
| `storage.googleapis.com/network/received_bytes_count` | DELTA | Ingress bytes |
| `storage.googleapis.com/network/sent_bytes_count` | DELTA | Egress bytes |
| `storage.googleapis.com/storage/object_count` | GAUGE | Object count per bucket |
| `storage.googleapis.com/storage/total_bytes` | GAUGE | Total stored bytes per bucket |

#### gcloud Commands for GCS

```bash
# List objects with size and timestamp
gcloud storage ls --long gs://BUCKET/path/

# Get total size of a bucket
gcloud storage du gs://BUCKET/ --summarize

# Get bucket metadata (retention policy, lifecycle)
gcloud storage buckets describe gs://BUCKET \
  --format='default'

# List lifecycle rules
gcloud storage buckets describe gs://BUCKET \
  --format='get(lifecycle_config)'

# Count objects in a prefix
gcloud storage ls gs://BUCKET/prefix/ | wc -l

# Check when the last object was written to a landing zone
gcloud storage ls --long gs://BUCKET/landing/ \
  | sort -k2 -r | head -5
```

> [!tip] Landing Zone Monitoring Pattern
> For ingestion pipelines that drop files into GCS, monitor `storage/object_count` on the landing prefix. Alert if the count hasn't increased in N hours — this indicates the upstream producer has stopped writing, even if the pipeline itself is healthy.

---

### Firestore

#### Built-in Metrics

| Metric | Type | Description |
|---|---|---|
| `firestore.googleapis.com/document/read_count` | DELTA | Document reads |
| `firestore.googleapis.com/document/write_count` | DELTA | Document writes |
| `firestore.googleapis.com/document/delete_count` | DELTA | Document deletes |
| `firestore.googleapis.com/network/snapshot_listeners` | GAUGE | Active real-time listeners |
| `firestore.googleapis.com/api/request_count` | DELTA | API requests by method |

#### gcloud Commands for Firestore

```bash
# List Firestore operations (imports/exports)
gcloud firestore operations list

# Describe a specific operation
gcloud firestore operations describe OPERATION_NAME

# Export Firestore to GCS
gcloud firestore export gs://BUCKET/path \
  --collection-ids=COLLECTION_NAME

# List indexes
gcloud firestore indexes composite list

# Check Firestore database configuration
gcloud firestore databases describe --database=DATABASE_ID
```

Alert conditions for Firestore:

- Write rate > expected baseline (indicates runaway writes or a loop bug)
- Read rate approaching quota limits (Firestore has per-database read quotas)
- Export operations failing (data backup failure)

---

### Cloud Scheduler and Cloud Functions

#### Cloud Scheduler Metrics

| Metric | Type | Description |
|---|---|---|
| `cloudscheduler.googleapis.com/job/attempt_count` | DELTA | Attempts by result code |
| `cloudscheduler.googleapis.com/job/last_attempt_result` | GAUGE | 1 = success, 0 = failure |
| `cloudscheduler.googleapis.com/job/completion_count` | DELTA | Completions by result |

```bash
# List all scheduler jobs
gcloud scheduler jobs list --location=LOCATION \
  --format='table(name,schedule,state,lastAttemptTime,status)'

# Describe a job (see schedule, target, error history)
gcloud scheduler jobs describe JOB_NAME --location=LOCATION

# Pause / resume a job
gcloud scheduler jobs pause JOB_NAME --location=LOCATION
gcloud scheduler jobs resume JOB_NAME --location=LOCATION

# Trigger a job immediately
gcloud scheduler jobs run JOB_NAME --location=LOCATION
```

#### Cloud Functions Metrics

| Metric | Type | Description |
|---|---|---|
| `cloudfunctions.googleapis.com/function/execution_count` | DELTA | Executions by status |
| `cloudfunctions.googleapis.com/function/execution_times` | DELTA (distribution) | Execution duration |
| `cloudfunctions.googleapis.com/function/user_memory_bytes` | DELTA (distribution) | Memory used |
| `cloudfunctions.googleapis.com/function/active_instances` | GAUGE | Active instances |
| `cloudfunctions.googleapis.com/function/instance_count` | GAUGE | Instance count by state |

```bash
# List functions
gcloud functions list --format='table(name,region,status,updateTime)'

# Describe a function
gcloud functions describe FUNCTION_NAME --region=REGION

# View function logs
gcloud functions logs read FUNCTION_NAME \
  --region=REGION \
  --limit=50

# Get function invocation logs filtered by severity
gcloud logging read \
  'resource.type="cloud_function" AND resource.labels.function_name="FUNCTION_NAME" AND severity>=ERROR' \
  --limit=20 \
  --format='table(timestamp,severity,textPayload)'
```

---

## Monitoring Query Language (MQL)

MQL is a text-based query language for Cloud Monitoring time series. It operates on a pipeline model: each `|` operator passes data to the next transformation.

### MQL Syntax Fundamentals

```
fetch <resource_type>
| metric '<metric_type>'
| filter <label_filter>
| group_by [<label_list>], <aggregation>
| align <aligner>()
| every <period>
| within <duration>
```

#### Core operations

| Operation | Purpose | Example |
|---|---|---|
| `fetch` | Select resource type | `fetch gce_instance` |
| `metric` | Select metric | `metric 'compute.googleapis.com/...'` |
| `filter` | Filter by label | `filter resource.zone == 'us-east1-b'` |
| `group_by` | Group and aggregate | `group_by [resource.instance_id], mean(val())` |
| `align` | Align samples to grid | `align mean_aligner()` |
| `every` | Set alignment period | `every 1m` |
| `within` | Set time window | `within 1h` |
| `rate` | Convert CUMULATIVE to rate | `rate()` |
| `delta` | Change over period | `delta()` |
| `condition` | Boolean expression for alert | `condition val() > 0.9` |

### MQL Examples: Compute Engine

```
# CPU utilization across all VMs in a zone, top 10
fetch gce_instance
| metric 'compute.googleapis.com/instance/cpu/utilization'
| filter resource.zone == 'europe-west1-b'
| group_by [resource.instance_id, metadata.system_labels.name], mean(val())
| every 5m
| top 10

# Memory utilization (requires Ops Agent)
fetch gce_instance
| metric 'agent.googleapis.com/memory/percent_used'
| filter metric.labels.state == 'used'
| group_by [resource.instance_id], mean(val())
| every 5m

# Disk utilization alert condition
fetch gce_instance
| metric 'agent.googleapis.com/disk/percent_used'
| filter metric.labels.state == 'used'
| group_by [resource.instance_id, metric.labels.device], max(val())
| every 5m
| condition val() > 0.85
```

### MQL Examples: BigQuery Cost Tracking

```
# Total bytes scanned in the last hour (on-demand cost proxy)
fetch bigquery_project
| metric 'bigquery.googleapis.com/query/scanned_bytes'
| group_by [], sum(val())
| align delta(1h)
| within 1h

# Slot utilization percentage
fetch bigquery_project
| metric 'bigquery.googleapis.com/slots/allocated_for_project'
| join (
    fetch bigquery_project
    | metric 'bigquery.googleapis.com/slots/total_available'
  )
| div()
| scale('%')
| every 5m

# Query count by error status
fetch bigquery_project
| metric 'bigquery.googleapis.com/query/count'
| group_by [metric.labels.status], sum(val())
| every 1m
```

### MQL Examples: Pub/Sub Backlog Alerting

```
# Oldest unacked message age across all subscriptions
fetch pubsub_subscription
| metric 'pubsub.googleapis.com/subscription/oldest_unacked_message_age'
| group_by [resource.subscription_id], max(val())
| every 1m

# Backlog size (message count)
fetch pubsub_subscription
| metric 'pubsub.googleapis.com/subscription/num_undelivered_messages'
| group_by [resource.subscription_id], max(val())
| every 1m

# Subscription backlog alert (P1 condition)
fetch pubsub_subscription
| metric 'pubsub.googleapis.com/subscription/oldest_unacked_message_age'
| filter resource.subscription_id == 'SUBSCRIPTION_NAME'
| group_by [], max(val())
| every 1m
| condition val() > 300  # 5 minutes
```

### MQL Examples: Cloud Run Cold Start Analysis

```
# p99 startup latency for a Cloud Run service
fetch cloud_run_revision
| metric 'run.googleapis.com/container/startup_latency'
| filter resource.service_name == 'SERVICE_NAME'
| align delta(5m)
| every 5m
| group_by [resource.service_name], percentile(val(), 99)

# Cloud Run job failure rate
fetch cloud_run_job
| metric 'run.googleapis.com/job/execution_count'
| filter resource.job_name == 'JOB_NAME'
| group_by [metric.labels.result], sum(val())
| align rate(1h)
| every 1m

# Request error rate for Cloud Run service
fetch cloud_run_revision
| metric 'run.googleapis.com/request_count'
| filter (resource.service_name == 'SERVICE_NAME'
    AND metric.labels.response_code_class == '5xx')
| group_by [], sum(val())
| align rate(5m)
| every 1m
| condition val() > 5  # > 5 errors/min
```

### MQL vs PromQL Comparison

| Feature | MQL | PromQL |
|---|---|---|
| Syntax style | Pipe-based (`|`) | Function-based nesting |
| Learning curve | Moderate | Steeper for newcomers |
| Time range | In-query `within` | External to query |
| Resource filtering | `filter resource.X == Y` | `{label="value"}` |
| Aggregation | `group_by [label], func()` | `by (label)` after function |
| Rate conversion | `rate()` or `align rate(1h)` | `rate(metric[5m])` |
| Percentiles | `percentile(val(), 99)` | `histogram_quantile(0.99, ...)` |
| Cross-metric join | `join` operator | Binary operators (+, /, ...) |
| Availability | GCP Cloud Monitoring only | Prometheus + compatible systems |
| Custom metric support | Full | Full (via Cloud Managed Prometheus) |

> [!note] Managed Prometheus
> GCP Cloud Monitoring also supports **Google Cloud Managed Service for Prometheus** (GMP). If your team already uses PromQL, GMP lets you use PromQL syntax against GCP metrics. However, MQL is the native language and has features (like `join` and `condition`) that PromQL does not.

---

## Custom Metrics for Data Pipelines

### Python SDK: Writing Custom Metrics

```python
import time
from google.cloud import monitoring_v3
from google.api import metric_pb2 as ga_metric
from google.api import monitored_resource_pb2

PROJECT_ID = "your-project-id"
PROJECT_NAME = f"projects/{PROJECT_ID}"

client = monitoring_v3.MetricServiceClient()


def create_metric_descriptor(metric_type: str, description: str, unit: str = "1"):
    """Create a custom GAUGE metric descriptor."""
    descriptor = ga_metric.MetricDescriptor()
    descriptor.type = f"custom.googleapis.com/{metric_type}"
    descriptor.metric_kind = ga_metric.MetricDescriptor.MetricKind.GAUGE
    descriptor.value_type = ga_metric.MetricDescriptor.ValueType.DOUBLE
    descriptor.description = description
    descriptor.unit = unit

    descriptor = client.create_metric_descriptor(
        name=PROJECT_NAME, metric_descriptor=descriptor
    )
    print(f"Created metric descriptor: {descriptor.name}")
    return descriptor


def write_metric(metric_type: str, value: float, labels: dict = None):
    """Write a single data point to a custom metric."""
    series = monitoring_v3.TimeSeries()
    series.metric.type = f"custom.googleapis.com/{metric_type}"

    if labels:
        series.metric.labels.update(labels)

    # Use global resource type for pipeline metrics
    series.resource.type = "global"
    series.resource.labels["project_id"] = PROJECT_ID

    now = time.time()
    interval = monitoring_v3.TimeInterval(
        {"end_time": {"seconds": int(now), "nanos": int((now % 1) * 10**9)}}
    )

    point = monitoring_v3.Point(
        {"interval": interval, "value": {"double_value": value}}
    )
    series.points = [point]

    client.create_time_series(name=PROJECT_NAME, time_series=[series])
    print(f"Wrote {value} to custom.googleapis.com/{metric_type}")
```

### Custom Metric: Pipeline Decorator Pattern

Wrap any pipeline function to automatically emit metrics:

```python
import functools
import time
from google.cloud import monitoring_v3

def monitor_pipeline(pipeline_name: str, project_id: str):
    """Decorator to emit execution duration, row count, and error count."""
    client = monitoring_v3.MetricServiceClient()
    project_name = f"projects/{project_id}"

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            error_count = 0
            rows_processed = 0

            try:
                result = func(*args, **kwargs)
                # Expect function to return row count
                rows_processed = result if isinstance(result, int) else 0
                return result
            except Exception as e:
                error_count = 1
                raise
            finally:
                duration = time.time() - start_time
                _write_batch(
                    client,
                    project_name,
                    pipeline_name,
                    duration,
                    rows_processed,
                    error_count,
                )

        return wrapper

    def _write_batch(client, project_name, pipeline_name, duration, rows, errors):
        now = time.time()
        interval = monitoring_v3.TimeInterval(
            {"end_time": {"seconds": int(now), "nanos": 0}}
        )

        metrics = [
            ("pipeline/execution_duration_seconds", duration),
            ("pipeline/rows_processed", float(rows)),
            ("pipeline/error_count", float(errors)),
        ]

        time_series_list = []
        for metric_suffix, value in metrics:
            series = monitoring_v3.TimeSeries()
            series.metric.type = f"custom.googleapis.com/{metric_suffix}"
            series.metric.labels["pipeline_name"] = pipeline_name
            series.resource.type = "global"
            series.resource.labels["project_id"] = project_name.split("/")[-1]
            point = monitoring_v3.Point(
                {"interval": interval, "value": {"double_value": value}}
            )
            series.points = [point]
            time_series_list.append(series)

        client.create_time_series(name=project_name, time_series=time_series_list)

    return decorator


# Usage in Airflow tasks or Cloud Run jobs
@monitor_pipeline(pipeline_name="bigquery_to_firestore", project_id="my-project")
def run_etl_pipeline():
    # ... ETL logic ...
    rows_written = 42_000
    return rows_written
```

### Custom Metric: Data Freshness

The most operationally valuable custom metric for data engineering — measures time since the last successful pipeline run:

```python
import time
from google.cloud import monitoring_v3, bigquery

def update_data_freshness_metric(
    table_id: str,
    pipeline_name: str,
    project_id: str,
):
    """
    Query the max update timestamp from a BigQuery table and
    write the staleness (seconds since last update) as a custom metric.
    """
    bq_client = bigquery.Client(project=project_id)
    monitoring_client = monitoring_v3.MetricServiceClient()

    # Query last successful update time
    query = f"""
        SELECT TIMESTAMP_DIFF(
            CURRENT_TIMESTAMP(),
            MAX(updated_at),
            SECOND
        ) AS staleness_seconds
        FROM `{table_id}`
    """

    result = bq_client.query(query).result()
    staleness_seconds = next(result).staleness_seconds

    # Write to Cloud Monitoring
    now = time.time()
    series = monitoring_v3.TimeSeries()
    series.metric.type = "custom.googleapis.com/pipeline/data_freshness_seconds"
    series.metric.labels["pipeline_name"] = pipeline_name
    series.metric.labels["table_id"] = table_id.replace(":", ".").replace("/", ".")
    series.resource.type = "global"
    series.resource.labels["project_id"] = project_id

    interval = monitoring_v3.TimeInterval(
        {"end_time": {"seconds": int(now), "nanos": 0}}
    )
    point = monitoring_v3.Point(
        {"interval": interval, "value": {"double_value": float(staleness_seconds)}}
    )
    series.points = [point]

    monitoring_client.create_time_series(
        name=f"projects/{project_id}", time_series=[series]
    )
    print(f"Data freshness for {pipeline_name}: {staleness_seconds}s")
    return staleness_seconds
```

### Standard Custom Metric Catalog

| Metric Type | Unit | Description | Alert Threshold |
|---|---|---|---|
| `custom.googleapis.com/pipeline/rows_processed` | `1` | Rows processed per run | < expected baseline |
| `custom.googleapis.com/pipeline/execution_duration_seconds` | `s` | Wall-clock time of pipeline | > 2× historical p95 |
| `custom.googleapis.com/pipeline/data_freshness_seconds` | `s` | Seconds since last successful refresh | > SLA threshold |
| `custom.googleapis.com/pipeline/error_count` | `1` | Errors raised during execution | > 0 |
| `custom.googleapis.com/pipeline/records_failed` | `1` | Records that failed validation | > 0 |
| `custom.googleapis.com/pipeline/records_skipped` | `1` | Records skipped (deduplication, etc.) | > expected |
| `custom.googleapis.com/queue/depth` | `1` | Internal queue depth for custom consumers | > high-water mark |
| `custom.googleapis.com/db/connection_pool_size` | `1` | Active DB connections from pipeline | > pool max |

### Writing Metrics from Different Contexts

#### From an Airflow task

```python
from airflow.decorators import task
from google.cloud import monitoring_v3

@task()
def load_data():
    # ... load logic ...
    rows = 50000

    # Write metric after successful load
    client = monitoring_v3.MetricServiceClient()
    # ... (use write_metric function from above) ...
    write_metric("pipeline/rows_processed", float(rows),
                 labels={"pipeline_name": "daily_load"})
    return rows
```

#### From a Cloud Run Job entrypoint

```python
import os
import sys

def main():
    pipeline_name = os.environ.get("PIPELINE_NAME", "unknown")
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")

    try:
        rows = run_pipeline()
        write_metric("pipeline/rows_processed", float(rows),
                    labels={"pipeline_name": pipeline_name})
        write_metric("pipeline/error_count", 0.0,
                    labels={"pipeline_name": pipeline_name})
    except Exception as e:
        write_metric("pipeline/error_count", 1.0,
                    labels={"pipeline_name": pipeline_name})
        sys.exit(1)

if __name__ == "__main__":
    main()
```

---

## Dashboards

### Creating Dashboards

```bash
# Create a dashboard from a JSON file
gcloud monitoring dashboards create \
  --config-from-file=dashboard.json

# List all dashboards
gcloud monitoring dashboards list \
  --format='table(name,displayName)'

# Describe (export) an existing dashboard as JSON
gcloud monitoring dashboards describe DASHBOARD_NAME \
  --format=json > my-dashboard.json

# Delete a dashboard
gcloud monitoring dashboards delete DASHBOARD_NAME
```

### Dashboard JSON Structure

A Cloud Monitoring dashboard JSON has this top-level structure:

```json
{
  "displayName": "Data Engineering Overview",
  "mosaicLayout": {
    "columns": 12,
    "tiles": [
      {
        "xPos": 0, "yPos": 0, "width": 6, "height": 4,
        "widget": {
          "title": "VM CPU Utilization",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesQueryLanguage": "fetch gce_instance | metric 'compute.googleapis.com/instance/cpu/utilization' | group_by [metadata.system_labels.name], mean(val()) | every 1m"
                },
                "plotType": "LINE"
              }
            ],
            "yAxis": {"label": "CPU utilization", "scale": "LINEAR"}
          }
        }
      }
    ]
  }
}
```

### Essential Data Engineering Dashboard Widgets

| # | Widget | Metric(s) | Chart Type | Purpose |
|---|---|---|---|---|
| 1 | VM CPU Utilization | `compute.googleapis.com/instance/cpu/utilization` | Line | SQL Server / Airflow host health |
| 2 | VM Memory Utilization | `agent.googleapis.com/memory/percent_used` | Line | Requires Ops Agent |
| 3 | VM Disk Usage % | `agent.googleapis.com/disk/percent_used` | Line | Alert before disk full |
| 4 | BigQuery Slots Used | `bigquery.googleapis.com/slots/allocated_for_project` | Line | Capacity planning |
| 5 | BigQuery Bytes Scanned | `bigquery.googleapis.com/query/scanned_bytes_billed` | Stacked bar | Cost tracking |
| 6 | Pub/Sub Backlog Age | `pubsub.googleapis.com/subscription/oldest_unacked_message_age` | Line | Pipeline stall detection |
| 7 | Pub/Sub Message Count | `pubsub.googleapis.com/subscription/num_undelivered_messages` | Line | Backlog depth |
| 8 | Cloud Run Job Success Rate | `run.googleapis.com/job/execution_count` | Stacked bar (by result) | Job health |
| 9 | Cloud Run Latency p99 | `run.googleapis.com/request_latencies` | Heatmap | Service latency |
| 10 | GCS Object Count | `storage.googleapis.com/storage/object_count` | Line | Landing zone activity |
| 11 | Pipeline Rows Processed | `custom.googleapis.com/pipeline/rows_processed` | Bar | Throughput tracking |
| 12 | Data Freshness | `custom.googleapis.com/pipeline/data_freshness_seconds` | Line | SLA compliance |
| 13 | Pipeline Error Count | `custom.googleapis.com/pipeline/error_count` | Bar | Error visibility |
| 14 | Firestore Writes | `firestore.googleapis.com/document/write_count` | Line | Write rate monitoring |

### Complete Dashboard JSON Example

```json
{
  "displayName": "Data Engineering Overview",
  "mosaicLayout": {
    "columns": 12,
    "tiles": [
      {
        "xPos": 0, "yPos": 0, "width": 6, "height": 4,
        "widget": {
          "title": "VM CPU Utilization",
          "xyChart": {
            "dataSets": [{
              "timeSeriesQuery": {
                "timeSeriesQueryLanguage": "fetch gce_instance | metric 'compute.googleapis.com/instance/cpu/utilization' | group_by [metadata.system_labels.name], mean(val()) | every 1m"
              },
              "plotType": "LINE",
              "legendTemplate": "${metric.labels.instance_name}"
            }],
            "yAxis": {"label": "Utilization (0-1)", "scale": "LINEAR"}
          }
        }
      },
      {
        "xPos": 6, "yPos": 0, "width": 6, "height": 4,
        "widget": {
          "title": "Pub/Sub Oldest Unacked Message Age",
          "xyChart": {
            "dataSets": [{
              "timeSeriesQuery": {
                "timeSeriesQueryLanguage": "fetch pubsub_subscription | metric 'pubsub.googleapis.com/subscription/oldest_unacked_message_age' | group_by [resource.subscription_id], max(val()) | every 1m"
              },
              "plotType": "LINE"
            }],
            "thresholds": [{"value": 300, "color": "RED", "direction": "ABOVE"}],
            "yAxis": {"label": "Age (seconds)", "scale": "LINEAR"}
          }
        }
      },
      {
        "xPos": 0, "yPos": 4, "width": 6, "height": 4,
        "widget": {
          "title": "BigQuery Bytes Scanned (Billed)",
          "xyChart": {
            "dataSets": [{
              "timeSeriesQuery": {
                "timeSeriesQueryLanguage": "fetch bigquery_project | metric 'bigquery.googleapis.com/query/scanned_bytes_billed' | align delta(1h) | every 1h | group_by [], sum(val())"
              },
              "plotType": "STACKED_BAR"
            }],
            "yAxis": {"label": "Bytes (per hour)", "scale": "LINEAR"}
          }
        }
      },
      {
        "xPos": 6, "yPos": 4, "width": 6, "height": 4,
        "widget": {
          "title": "Cloud Run Job Executions by Result",
          "xyChart": {
            "dataSets": [{
              "timeSeriesQuery": {
                "timeSeriesQueryLanguage": "fetch cloud_run_job | metric 'run.googleapis.com/job/execution_count' | group_by [resource.job_name, metric.labels.result], sum(val()) | align rate(1h) | every 5m"
              },
              "plotType": "STACKED_BAR"
            }],
            "yAxis": {"label": "Executions/hr", "scale": "LINEAR"}
          }
        }
      },
      {
        "xPos": 0, "yPos": 8, "width": 4, "height": 4,
        "widget": {
          "title": "Pipeline Rows Processed",
          "xyChart": {
            "dataSets": [{
              "timeSeriesQuery": {
                "timeSeriesQueryLanguage": "fetch global | metric 'custom.googleapis.com/pipeline/rows_processed' | group_by [metric.labels.pipeline_name], sum(val()) | every 5m"
              },
              "plotType": "STACKED_BAR"
            }],
            "yAxis": {"label": "Rows", "scale": "LINEAR"}
          }
        }
      },
      {
        "xPos": 4, "yPos": 8, "width": 4, "height": 4,
        "widget": {
          "title": "Data Freshness (seconds since last refresh)",
          "xyChart": {
            "dataSets": [{
              "timeSeriesQuery": {
                "timeSeriesQueryLanguage": "fetch global | metric 'custom.googleapis.com/pipeline/data_freshness_seconds' | group_by [metric.labels.pipeline_name], max(val()) | every 5m"
              },
              "plotType": "LINE"
            }],
            "thresholds": [{"value": 3600, "color": "RED", "direction": "ABOVE"}],
            "yAxis": {"label": "Seconds", "scale": "LINEAR"}
          }
        }
      },
      {
        "xPos": 8, "yPos": 8, "width": 4, "height": 4,
        "widget": {
          "title": "GCS Landing Zone Object Count",
          "xyChart": {
            "dataSets": [{
              "timeSeriesQuery": {
                "timeSeriesQueryLanguage": "fetch gcs_bucket | metric 'storage.googleapis.com/storage/object_count' | group_by [resource.bucket_name], max(val()) | every 5m"
              },
              "plotType": "LINE"
            }],
            "yAxis": {"label": "Objects", "scale": "LINEAR"}
          }
        }
      }
    ]
  }
}
```

---

## Alerting Policies

### Alert Policy Anatomy

An alerting policy has three components:

1. **Condition** — the time-series query + threshold that triggers the alert
2. **Notification channels** — where to send the alert (email, Slack, PagerDuty)
3. **Documentation** — runbook text included in the notification

### Creating Alerting Policies via gcloud

```bash
# Create a policy from JSON file
gcloud monitoring policies create \
  --policy-from-file=alert-policy.json

# List all alerting policies
gcloud monitoring policies list \
  --format='table(name,displayName,enabled,conditions[0].displayName)'

# Describe a policy (export as JSON)
gcloud monitoring policies describe POLICY_NAME \
  --format=json > my-policy.json

# Enable / disable a policy
gcloud monitoring policies update POLICY_NAME --enabled
gcloud monitoring policies update POLICY_NAME --no-enabled

# Delete a policy
gcloud monitoring policies delete POLICY_NAME
```

### Alert Policy JSON Example: Pub/Sub Stall

```json
{
  "displayName": "Pub/Sub Pipeline Stall — Oldest Unacked > 5 min",
  "enabled": true,
  "conditions": [
    {
      "displayName": "Oldest unacked message age > 300s",
      "conditionMonitoringQueryLanguage": {
        "query": "fetch pubsub_subscription | metric 'pubsub.googleapis.com/subscription/oldest_unacked_message_age' | group_by [resource.subscription_id], max(val()) | every 1m | condition val() > 300",
        "duration": "120s",
        "trigger": {"count": 1}
      }
    }
  ],
  "notificationChannels": ["projects/PROJECT_ID/notificationChannels/CHANNEL_ID"],
  "documentation": {
    "content": "## Pub/Sub Pipeline Stall\n\nThe subscription backlog has not been consumed for over 5 minutes.\n\n**Possible causes:**\n- Consumer service is down or crashing\n- Consumer is too slow (scale up)\n- Message poison pill causing repeated NACK\n\n**Remediation:**\n1. Check Cloud Run job executions: `gcloud run jobs executions list --job=JOB_NAME --region=REGION`\n2. Check consumer logs: `gcloud logging read 'resource.type=cloud_run_job'`\n3. If poison pill: seek subscription forward past the stuck message",
    "mimeType": "text/markdown"
  },
  "alertStrategy": {
    "notificationRateLimit": {"period": "3600s"},
    "autoClose": "1800s"
  }
}
```

### Alert Policy JSON Example: Data Freshness SLA

```json
{
  "displayName": "Data Freshness — Pipeline Stale > 1 Hour",
  "enabled": true,
  "conditions": [
    {
      "displayName": "data_freshness_seconds > 3600",
      "conditionMonitoringQueryLanguage": {
        "query": "fetch global | metric 'custom.googleapis.com/pipeline/data_freshness_seconds' | group_by [metric.labels.pipeline_name], max(val()) | every 5m | condition val() > 3600",
        "duration": "300s",
        "trigger": {"count": 1}
      }
    }
  ],
  "notificationChannels": ["projects/PROJECT_ID/notificationChannels/CHANNEL_ID"],
  "documentation": {
    "content": "## Stale Data Alert\n\nA pipeline has not produced fresh data in over 1 hour.\n\n**Check the pipeline logs and recent executions.**",
    "mimeType": "text/markdown"
  }
}
```

### Notification Channels

```bash
# Create an email notification channel
gcloud monitoring channels create \
  --type=email \
  --display-name="On-call email" \
  --channel-labels=email_address=oncall@example.com

# Create a Slack notification channel (requires Slack webhook URL)
gcloud monitoring channels create \
  --type=slack \
  --display-name="Data Engineering Slack" \
  --channel-labels=channel_name="#data-alerts" \
  --channel-labels=auth_token=TOKEN

# Create a Pub/Sub notification channel (for custom routing)
gcloud monitoring channels create \
  --type=pubsub \
  --display-name="Alert Router" \
  --channel-labels=topic=projects/PROJECT_ID/topics/TOPIC_NAME

# Create a webhook channel (for PagerDuty, custom systems)
gcloud monitoring channels create \
  --type=webhook_basicauth \
  --display-name="PagerDuty Webhook" \
  --channel-labels=url=https://events.pagerduty.com/integration/KEY/enqueue

# List all channels
gcloud monitoring channels list \
  --format='table(name,displayName,type,enabled)'

# Describe a channel
gcloud monitoring channels describe CHANNEL_NAME

# Verify a channel (sends a test notification)
gcloud monitoring channels verify CHANNEL_NAME

# Delete a channel
gcloud monitoring channels delete CHANNEL_NAME
```

### Essential Data Engineering Alerts Reference Table

| Alert | Metric | Condition | Duration | Severity | Priority |
|---|---|---|---|---|---|
| VM Down / Uptime Failed | Uptime check | Check failing | 5 min | Critical | P1 |
| VM High CPU | `compute.googleapis.com/instance/cpu/utilization` | > 90% | 15 min | Warning | P2 |
| VM High Memory | `agent.googleapis.com/memory/percent_used` (state=used) | > 90% | 10 min | Warning | P2 |
| VM Disk Full | `agent.googleapis.com/disk/percent_used` | > 85% | 5 min | Warning | P2 |
| Pub/Sub Pipeline Stall | `pubsub.googleapis.com/subscription/oldest_unacked_message_age` | > 300s | 2 min | Critical | P1 |
| BigQuery Cost Spike | `bigquery.googleapis.com/query/scanned_bytes_billed` | > 1 TB in 1h | 1 min | Warning | P2 |
| BigQuery Job Failures | `bigquery.googleapis.com/query/count` (status=error) | > 5 in 5m | 1 min | Warning | P2 |
| Cloud Run Job Failure | `run.googleapis.com/job/execution_count` (result=failed) | > 0 in 15m | 1 min | Critical | P1 |
| Cloud Run High Error Rate | `run.googleapis.com/request_count` (5xx) | > 1% of requests | 5 min | Critical | P1 |
| Data Freshness Stale | `custom.googleapis.com/pipeline/data_freshness_seconds` | > 3600s | 5 min | Critical | P1 |
| Pipeline Error Raised | `custom.googleapis.com/pipeline/error_count` | > 0 | 1 min | Critical | P1 |
| GCS Landing Zone Empty | `storage.googleapis.com/storage/object_count` | Absent or no change | 2 hours | Warning | P2 |
| Firestore Write Spike | `firestore.googleapis.com/document/write_count` | > 5000 writes/min | 5 min | Warning | P2 |
| Cloud Function Failures | `cloudfunctions.googleapis.com/function/execution_count` (status=error) | > 0 | 1 min | Warning | P2 |
| SQL Server PLE Low | `agent.googleapis.com/sqlserver/memory/page_life_expectancy` | < 300s | 10 min | Warning | P2 |

---

## Uptime Checks

Uptime checks probe HTTP(S), TCP, or HTTPS endpoints and report availability. They also serve as heartbeat monitors.

### Creating Uptime Checks

```bash
# Create an HTTP uptime check for a URL
gcloud monitoring uptime create \
  --display-name="Airflow Webserver" \
  --http-check-path="/health" \
  --hostname=airflow.internal.example.com \
  --port=8080 \
  --period=60 \
  --timeout=10

# Create a TCP uptime check (e.g., check SQL Server port is open)
gcloud monitoring uptime create \
  --display-name="SQL Server TCP" \
  --tcp-check \
  --hostname=sqlserver.internal.example.com \
  --port=1433 \
  --period=60

# List all uptime checks
gcloud monitoring uptime list-configs \
  --format='table(name,displayName,httpCheck.path,period)'

# Describe an uptime check
gcloud monitoring uptime describe CHECK_NAME

# Delete an uptime check
gcloud monitoring uptime delete CHECK_NAME
```

### Uptime Check Metrics

Uptime checks produce two metrics:

| Metric | Type | Description |
|---|---|---|
| `monitoring.googleapis.com/uptime_check/check_passed` | GAUGE | 1 = passed, 0 = failed |
| `monitoring.googleapis.com/uptime_check/request_latency` | GAUGE | Latency in ms |

```bash
# Alert when uptime check fails for 5 minutes
# (Alert policy condition in MQL)
# fetch uptime_url
# | metric 'monitoring.googleapis.com/uptime_check/check_passed'
# | filter resource.check_id == 'CHECK_ID'
# | group_by [], min(val())
# | every 1m
# | condition val() == 0
```

> [!note] Uptime Check Global Probing
> GCP uptime checks probe from multiple global locations simultaneously. A check only fails if probers from multiple regions cannot reach the endpoint. This means transient single-region network issues do not trigger false alerts.

---

## SLIs and SLOs

Service Level Indicators (SLIs) and Objectives (SLOs) formalize reliability targets. Cloud Monitoring has native SLO support.

### Concepts

| Term | Definition | Example |
|---|---|---|
| **SLI** | Quantitative measure of service behavior | Request success rate |
| **SLO** | Target value or range for an SLI | 99.9% success rate over 30 days |
| **Error budget** | 1 - SLO target; how much failure is allowed | 0.1% → 43 min downtime per 30 days |
| **Burn rate** | Rate at which error budget is consumed | 1.0 = consuming budget at SLO rate |

### Creating SLOs via gcloud

```bash
# Create an SLO for a Cloud Run service (request-based)
gcloud monitoring services create \
  --display-name="Data API Service" \
  cloud-run:SERVICE_NAME

# List services
gcloud monitoring services list

# Create an SLO on a service
gcloud monitoring slos create \
  --service=SERVICE_NAME \
  --display-name="99.5% success rate over 30d" \
  --request-based \
  --good-total-ratio-threshold=0.995 \
  --goal=0.995 \
  --rolling-period=30d

# List SLOs
gcloud monitoring slos list --service=SERVICE_NAME

# Describe an SLO (includes current error budget)
gcloud monitoring slos describe SLO_NAME \
  --service=SERVICE_NAME
```

### SLO Alert: Error Budget Burn Rate

Cloud Monitoring can alert when the error budget burn rate is too high — the standard Google SRE alerting pattern:

```json
{
  "displayName": "Error Budget Burn Rate Alert",
  "conditions": [
    {
      "displayName": "Fast burn: 14.4x burn rate over 1h",
      "conditionThreshold": {
        "filter": "select_slo_burn_rate(\"projects/PROJECT_ID/services/SERVICE_ID/serviceLevelObjectives/SLO_ID\", 60m)",
        "comparison": "COMPARISON_GT",
        "thresholdValue": 14.4,
        "duration": "0s"
      }
    },
    {
      "displayName": "Slow burn: 6x burn rate over 6h",
      "conditionThreshold": {
        "filter": "select_slo_burn_rate(\"projects/PROJECT_ID/services/SERVICE_ID/serviceLevelObjectives/SLO_ID\", 360m)",
        "comparison": "COMPARISON_GT",
        "thresholdValue": 6,
        "duration": "0s"
      }
    }
  ],
  "combiner": "OR"
}
```

> [!tip] Burn Rate Thresholds
> The Google SRE book recommends: alert at 14.4x burn rate over 1 hour (consumes 2% budget → page immediately) AND 6x burn rate over 6 hours (consumes 5% budget → ticket). This catches both sudden outages and slow degradation.

---

## Cloud Monitoring vs Datadog — Feature Parity

### Cloud Monitoring vs Datadog — Comprehensive Comparison Table

| Capability | Cloud Monitoring | Datadog | Notes |
|---|---|---|---|
| **VM metrics** | Ops Agent | Datadog Agent | Both collect CPU, memory, disk, network automatically |
| **SQL Server metrics** | Ops Agent `sqlserver` receiver | Native SQL Server integration | Datadog has richer out-of-the-box SQL metrics (200+ counters); Ops Agent covers ~20 key counters |
| **APM / Distributed Tracing** | Cloud Trace | Datadog APM | See [gcp-cloud-trace-and-logging](https://alp78.github.io/elysium/13-Observability/GCP-Native/gcp-cloud-trace-and-logging); Cloud Trace integrates natively with GCP services |
| **Log Management** | Cloud Logging | Datadog Log Management | See [gcp-cloud-trace-and-logging](https://alp78.github.io/elysium/13-Observability/GCP-Native/gcp-cloud-trace-and-logging); Cloud Logging is free up to 50 GB/project/month |
| **Dashboards** | Cloud Monitoring Dashboards | Datadog Dashboards | Datadog has better UX (drag-and-drop, TV mode, widgets); Cloud Monitoring requires JSON or UI clicks |
| **Alerting** | Alerting Policies | Datadog Monitors | Similar capability; Datadog has built-in anomaly detection and forecast alerts |
| **Custom Metrics** | monitoring_v3 Python/REST API | DogStatsD / REST API | Cloud Monitoring is significantly cheaper at scale |
| **BigQuery Monitoring** | Native built-in integration | Limited (requires log export) | Cloud Monitoring has native BQ slot and cost metrics; Datadog requires workarounds |
| **Pub/Sub Monitoring** | Native built-in integration | Limited | Cloud Monitoring has backlog, age, throughput natively |
| **Cloud Run Monitoring** | Native built-in integration | Limited (custom agent needed) | Cloud Monitoring covers Cloud Run Jobs natively |
| **Firestore Monitoring** | Native built-in integration | Not available | Cloud Monitoring is the only option |
| **GCS Monitoring** | Native built-in integration | S3-compatible limited | Cloud Monitoring is better for GCS |
| **SLO Management** | Native SLO + error budget | SLO Widgets (requires setup) | Both support burn-rate alerting; Cloud Monitoring is more native |
| **Uptime Checks** | Built-in (global probing) | Datadog Synthetics | Datadog Synthetics is more capable (browser tests, scripted checks); Cloud Monitoring covers basic HTTP/TCP |
| **Anomaly Detection** | Not native (manual thresholds only) | Built-in (ML-based) | Significant Datadog advantage for dynamic baselines |
| **Cost** | Free (included in GCP) + custom metric costs | $15–$23/host/month + per-metric fees | Cloud Monitoring is dramatically cheaper for pure GCP workloads |
| **Multi-cloud** | GCP only | Cloud-agnostic | Datadog monitors AWS, Azure, GCP, on-prem in one pane |
| **Cross-project views** | Metric scopes (workspace) | Single global view | Datadog is simpler for multi-project/multi-account |
| **Correlation (metrics + logs + traces)** | Requires navigation across products | Unified in one UI | Datadog has better correlation UX |
| **Incident Management** | Not included (use PagerDuty) | Datadog Incidents (add-on) | Neither is best-in-class; use PagerDuty |
| **Mobile App** | Not available | Datadog Mobile App | Datadog advantage for on-call |

### When to Use Which: Decision Guide

> [!success] Use Cloud Monitoring When...
> - Your infrastructure is **100% on GCP** — Cloud Monitoring has native integrations for every GCP service that Datadog cannot match
> - **Cost is a primary concern** — Datadog is $15–$23/host/month; Cloud Monitoring is free for standard GCP metrics
> - You need **BigQuery, Pub/Sub, Cloud Run, or Firestore** metrics — Cloud Monitoring is first-class; Datadog requires workarounds
> - Your team is comfortable with MQL or is willing to learn it
> - You need **SLO management** natively tied to GCP services

> [!warning] Consider Datadog When...
> - You have a **multi-cloud environment** (GCP + AWS + on-prem) and need a single pane
> - You need **ML-based anomaly detection** and adaptive thresholds without manual baseline tuning
> - Your team already has Datadog expertise and wants to minimize tool-switching
> - You need rich **browser-based synthetic monitoring** (Datadog Synthetics vs basic uptime checks)
> - You have a large SQL Server footprint and need the full 200+ SQL Server metric set out of the box
> - Your on-call workflow depends on the **Datadog Mobile App**

> [!tip] Hybrid Approach
> Many teams run both: **Datadog for infrastructure observability** (hosts, services, APM) and **Cloud Monitoring for GCP-native service metrics** (BigQuery, Pub/Sub, Cloud Run). Use Cloud Monitoring alerting policies to forward critical alerts to PagerDuty, which also receives Datadog alerts. This avoids paying Datadog host fees for GCP-managed services (Cloud Run, BigQuery) where Cloud Monitoring is clearly superior.

### Feature Gap Mitigations

| Datadog Feature | Cloud Monitoring Alternative | Gap Level |
|---|---|---|
| Anomaly detection | Manual static thresholds; or export metrics to Vertex AI for ML-based detection | High |
| Live Process Monitoring | Ops Agent `processes` receiver + custom metric | Medium |
| Network Performance Monitoring | VPC Flow Logs + Cloud Logging queries | Medium |
| Browser synthetics | Use Playwright/Selenium in Cloud Run + write custom pass/fail metric | High |
| Mobile app alerts | Route alert notifications to PagerDuty (has mobile app) | Low |
| Log-to-metric correlation in UI | Navigate between Cloud Logging and Cloud Monitoring tabs | Medium |
| Watchdog (proactive anomaly finding) | Not available; requires manual alert setup | High |

---

## Operational Runbook

### Investigating a VM Alert

```bash
# 1. Check VM status
gcloud compute instances describe VM_NAME --zone=ZONE --format='get(status)'

# 2. Get serial port output (panic / OOM messages)
gcloud compute instances get-serial-port-output VM_NAME --zone=ZONE

# 3. SSH to check system state
gcloud compute ssh VM_NAME --zone=ZONE -- 'uptime; free -h; df -h; top -bn1 | head -20'

# 4. Check Ops Agent status and recent errors
gcloud compute ssh VM_NAME --zone=ZONE -- \
  'sudo systemctl status google-cloud-ops-agent; sudo journalctl -u google-cloud-ops-agent -n 30'

# 5. Check OS logs in Cloud Logging
gcloud logging read \
  'resource.type="gce_instance" AND resource.labels.instance_id="INSTANCE_ID" AND severity>=ERROR' \
  --limit=50 \
  --format='table(timestamp,severity,textPayload)'
```

### Investigating a Pub/Sub Pipeline Stall

```bash
# 1. Check current backlog depth and age
gcloud pubsub subscriptions describe SUB_NAME \
  --format='get(name,pushConfig,ackDeadlineSeconds)'

# 2. Try to pull a message manually to see what's stuck
gcloud pubsub subscriptions pull SUB_NAME --max-messages=1

# 3. Check consumer (Cloud Run job) recent executions
gcloud run jobs executions list --job=JOB_NAME --region=REGION \
  --format='table(name,completionTime,conditions[0].type,conditions[0].status)'

# 4. Check consumer logs for errors
gcloud logging read \
  'resource.type="cloud_run_job" AND resource.labels.job_name="JOB_NAME" AND severity>=ERROR' \
  --limit=50 --format='table(timestamp,severity,textPayload)'

# 5. If poison pill: seek past the stuck message
gcloud pubsub subscriptions seek SUB_NAME \
  --time=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# 6. Manually trigger the consumer job
gcloud run jobs execute JOB_NAME --region=REGION
```

### Investigating a BigQuery Cost Spike

```sql
-- Run in BigQuery console immediately
SELECT
  user_email,
  COUNT(*) AS job_count,
  ROUND(SUM(total_bytes_processed) / POW(1024, 4), 2) AS tb_scanned,
  ROUND(SUM(total_bytes_billed) / POW(1024, 4), 2) AS tb_billed
FROM `region-us`.INFORMATION_SCHEMA.JOBS
WHERE
  creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 HOUR)
  AND job_type = 'QUERY'
GROUP BY user_email
ORDER BY tb_scanned DESC
LIMIT 20;
```

```bash
# Find the worst offending job
bq ls -j --state=DONE --max_results=10 --format=prettyjson \
  | python3 -c "import sys,json; jobs=json.load(sys.stdin); \
    [print(j['id'], j.get('statistics',{}).get('query',{}).get('totalBytesProcessed','?')) \
    for j in sorted(jobs, key=lambda x: int(x.get('statistics',{}).get('query',{}).get('totalBytesProcessed','0')), reverse=True)]"
```

### Investigating a Cloud Run Job Failure

```bash
# 1. List recent executions
gcloud run jobs executions list --job=JOB_NAME --region=REGION \
  --limit=5 \
  --format='table(name,completionTime,conditions)'

# 2. Describe the failed execution
gcloud run jobs executions describe EXECUTION_NAME --region=REGION

# 3. Get task logs for the failed execution
gcloud logging read \
  'resource.type="cloud_run_job" AND labels."run.googleapis.com/execution_name"="EXECUTION_NAME"' \
  --limit=100 \
  --format='table(timestamp,severity,textPayload,jsonPayload)'

# 4. Check exit code and container stderr
gcloud run jobs executions describe EXECUTION_NAME --region=REGION \
  --format='get(status.observedTaskCount,status.failedCount,status.succeededCount)'
```

### Alert Response Priority Matrix

| Severity | Response Time | Examples | Action |
|---|---|---|---|
| P1 – Critical | < 15 min | VM down, Pub/Sub stall, job failure, data stale | Page on-call; immediate investigation |
| P2 – Warning | < 2 hours | High CPU, disk usage, cost spike | Ticket; investigate during business hours |
| P3 – Info | Next business day | Slow query, slightly elevated error rate | Log; review in weekly metrics review |

---

### Quick Reference: gcloud Monitoring Commands

```bash
# --- Metric Descriptors ---
gcloud monitoring metrics-descriptors list --filter="metric.type:FILTER"
gcloud monitoring metrics-descriptors describe METRIC_TYPE
gcloud monitoring metrics-descriptors delete METRIC_TYPE  # custom only

# --- Dashboards ---
gcloud monitoring dashboards list
gcloud monitoring dashboards describe DASHBOARD_ID --format=json
gcloud monitoring dashboards create --config-from-file=FILE.json
gcloud monitoring dashboards update DASHBOARD_ID --config-from-file=FILE.json
gcloud monitoring dashboards delete DASHBOARD_ID

# --- Alerting Policies ---
gcloud monitoring policies list
gcloud monitoring policies describe POLICY_NAME
gcloud monitoring policies create --policy-from-file=FILE.json
gcloud monitoring policies update POLICY_NAME --policy-from-file=FILE.json
gcloud monitoring policies delete POLICY_NAME
gcloud monitoring policies update POLICY_NAME --enabled
gcloud monitoring policies update POLICY_NAME --no-enabled

# --- Notification Channels ---
gcloud monitoring channels list
gcloud monitoring channels describe CHANNEL_NAME
gcloud monitoring channels create --type=TYPE --display-name=NAME --channel-labels=KEY=VALUE
gcloud monitoring channels update CHANNEL_NAME --channel-labels=KEY=VALUE
gcloud monitoring channels verify CHANNEL_NAME
gcloud monitoring channels delete CHANNEL_NAME

# --- Uptime Checks ---
gcloud monitoring uptime list-configs
gcloud monitoring uptime describe CHECK_NAME
gcloud monitoring uptime create --display-name=NAME --http-check-path=PATH --hostname=HOST
gcloud monitoring uptime delete CHECK_NAME

# --- SLOs ---
gcloud monitoring services list
gcloud monitoring services describe SERVICE_NAME
gcloud monitoring slos list --service=SERVICE_NAME
gcloud monitoring slos describe SLO_NAME --service=SERVICE_NAME
gcloud monitoring slos create --service=SERVICE_NAME --display-name=NAME ...
gcloud monitoring slos delete SLO_NAME --service=SERVICE_NAME
```

---

> [!summary] Key Takeaways
> 1. **Cloud Monitoring is free for standard GCP metrics** — the cost advantage over Datadog is decisive for pure-GCP shops.
> 2. **Ops Agent is mandatory** — without it, you have no memory metrics, no SQL Server counters, no process visibility on VMs.
> 3. **MQL is powerful but verbose** — invest time learning `align`, `group_by`, and `rate()` to avoid misinterpreting DELTA and CUMULATIVE metrics.
> 4. **Custom metrics close the gap** — `data_freshness_seconds` and `rows_processed` are the two most valuable custom metrics for a data engineering team.
> 5. **Pub/Sub `oldest_unacked_message_age` is your primary pipeline health signal** — alert on it before anything else.
> 6. **INFORMATION_SCHEMA is your escape hatch for BigQuery** — Cloud Monitoring BQ metrics are aggregate; INFORMATION_SCHEMA gives per-job detail.
> 7. **Cloud Monitoring wins on GCP-native services** (BigQuery, Pub/Sub, Cloud Run, Firestore); Datadog wins on cross-cloud and anomaly detection.
