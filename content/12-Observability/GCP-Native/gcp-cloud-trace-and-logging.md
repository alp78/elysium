---
type: reference
category: observability
technology:
  - gcp
  - cloud-logging
  - cloud-trace
  - python
tags:
  - reference
  - observability
  - gcp
  - logging
  - tracing
  - distributed-tracing
  - log-analytics
  - audit-logs
aliases:
  - Cloud Logging
  - Cloud Trace
  - log explorer
  - log router
  - log sink
  - trace context
  - span
  - audit log
  - log-based metrics
  - Log Analytics
  - BigQuery log sink
keywords:
  - cloud logging
  - cloud trace
  - distributed tracing
  - structured logs
  - log explorer
  - log router
  - log sink
  - log bucket
  - log analytics
  - bigquery log sink
  - audit logs
  - admin activity logs
  - data access logs
  - log-based metrics
  - opentelemetry
  - trace context
  - span
  - parent span
  - child span
  - trace propagation
  - w3c trace context
  - traceparent header
  - cloud run logging
  - airflow logging
  - gcloud logging read
  - gcloud logging tail
  - gcloud logging sinks
  - log exclusion filter
  - log retention
  - log ingestion cost
  - severity levels
  - jsonPayload
  - httpRequest
  - resource labels
  - correlation id
  - pipeline observability
  - three pillars observability
description: >
  Comprehensive reference for Cloud Logging and Cloud Trace in the context of
  data engineering pipelines on GCP. Covers structured log writing, Log Explorer
  queries, gcloud commands, log-based metrics, log routing to BigQuery and Cloud
  Storage, Log Analytics SQL, audit logs, OpenTelemetry tracing, span
  instrumentation, trace-log correlation, and a full GCP-native observability
  stack architecture with cost comparison vs Datadog.
related:
  - "[[cloud-monitoring-metrics|Cloud Monitoring]]"
  - "[[cloud-monitoring-metrics|custom metrics]]"
  - "[[observability-index]]"
  - "[[firestore-data-model-and-operations|Firestore state store]]"
  - "[[cloud-run-jobs-vs-services|Cloud Run pipelines]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# GCP Cloud Logging and Cloud Trace for Data Engineers

> [!abstract] What This Covers
> The logging and distributed tracing pillars of GCP-native observability for data engineering pipelines. Metrics are covered in [[cloud-monitoring-metrics|Cloud Monitoring]]. This note goes deep on writing structured logs from pipelines, querying them effectively, routing them for cost control and analytics, understanding audit logs, and instrumenting Python pipelines with OpenTelemetry for end-to-end distributed tracing.

---

## Cloud Logging for Data Engineers

### Log Architecture and Concepts

Every log entry in Cloud Logging is a structured record with a fixed schema. The most important fields are:

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | RFC 3339 | When the log was written |
| `severity` | enum | One of the standard severity levels |
| `logName` | string | `projects/PROJECT/logs/LOG_ID` |
| `resource` | MonitoredResource | What produced the log (VM, Cloud Run job, etc.) |
| `textPayload` | string | Unstructured text (avoid for pipelines) |
| `jsonPayload` | struct | Structured key-value data (prefer this) |
| `httpRequest` | struct | HTTP request metadata (auto-populated for Cloud Run) |
| `trace` | string | Full trace resource name for correlation |
| `spanId` | string | Span ID for trace correlation |
| `labels` | map | User-defined key-value labels |
| `insertId` | string | Deduplication ID |

**Log names** follow the pattern `projects/PROJECT/logs/LOG_ID`. The `LOG_ID` is a forward-slash-encoded string. For pipeline logs, use descriptive IDs like `pipeline.extract`, `pipeline.transform`.

**Severity levels** from lowest to highest:

| Level | Numeric | When to Use |
|-------|---------|-------------|
| DEFAULT | 0 | Unspecified |
| DEBUG | 100 | Detailed diagnostic info |
| INFO | 200 | Normal operational events |
| NOTICE | 300 | Normal but significant events |
| WARNING | 400 | Potential issues, not yet errors |
| ERROR | 500 | Errors that don't halt the pipeline |
| CRITICAL | 600 | Severe errors requiring attention |
| ALERT | 700 | Action must be taken immediately |
| EMERGENCY | 800 | System is unusable |

> [!tip] Severity Discipline
> Be deliberate. `ERROR` should mean something failed and needs investigation. `WARNING` should mean something is off but the pipeline continued. Use `INFO` for milestones (stage started, stage completed, rows written). Use `DEBUG` only for verbose diagnostic data you don't want in production by default.

### Log Buckets and Retention

Cloud Logging stores entries in **log buckets**. Three built-in buckets exist per project:

| Bucket | Retention | Cost | Contents |
|--------|-----------|------|----------|
| `_Required` | 400 days | Free | Admin Activity, System Event, Policy Denied |
| `_Default` | 30 days | Charged for ingestion over free tier | Everything else by default |
| Custom | 1–3650 days | Charged for ingestion + storage over tier | Whatever you route there |

**Free tier**: 50 GiB/month log ingestion, 50 GiB/month log storage in `_Default`. After that, ~$0.01/GiB ingestion, $0.01/GiB/month storage.

To check current log ingestion volume:

```bash
# See bytes ingested per log bucket over the last 30 days
gcloud logging buckets list --location=global --project=PROJECT

# Check the log-based metric for bytes ingested (if enabled)
gcloud monitoring time-series list \
  --filter='metric.type="logging.googleapis.com/billing/bytes_ingested"' \
  --project=PROJECT
```

Creating a custom log bucket with extended retention:

```bash
gcloud logging buckets create pipeline-logs \
  --location=global \
  --description="Long-retention bucket for pipeline audit trail" \
  --retention-days=365 \
  --project=PROJECT
```

> [!warning] Retention Is Not Backup
> Increasing retention in a log bucket does NOT protect you from accidental sink misconfiguration. For compliance archival, always set up a Cloud Storage sink (covered below) in addition to setting bucket retention.

---

### Writing Structured Logs from Pipelines

#### Python: google-cloud-logging Library

Install:

```bash
pip install google-cloud-logging
```

Basic setup — attaches the Cloud Logging handler to the Python root logger:

```python
import google.cloud.logging
import logging

client = google.cloud.logging.Client()
client.setup_logging()  # Attaches handler to root logger

logger = logging.getLogger("pipeline.extract")
logger.setLevel(logging.INFO)

# Plain text log — works but loses structure
logger.info("Extraction started")

# Structured log — use json_fields for queryable JSON
logger.info(
    "Extraction completed",
    extra={
        "json_fields": {
            "pipeline": "daily-ingest",
            "stage": "extract",
            "source_table": "raw.events",
            "rows_read": 142_000,
            "duration_seconds": 18.4,
        }
    },
)
```

This writes a `jsonPayload` entry. You can then filter in Log Explorer on `jsonPayload.stage="extract"` or extract `jsonPayload.rows_read` into a distribution metric.

#### Using the Low-Level Logger Directly

For more control (labels, severity, trace correlation):

```python
from google.cloud.logging import Client, Resource
from google.cloud.logging.handlers import CloudLoggingHandler
import google.cloud.logging

client = google.cloud.logging.Client()

# Direct structured log write
log = client.logger("pipeline.transform")

log.log_struct(
    {
        "message": "Transform stage completed",
        "pipeline": "daily-ingest",
        "stage": "transform",
        "input_rows": 142_000,
        "output_rows": 139_450,
        "dropped_rows": 2_550,
        "drop_reason": "null_primary_key",
        "duration_seconds": 42.1,
    },
    severity="INFO",
    resource=Resource(
        type="global",
        labels={"project_id": "my-project"},
    ),
    labels={
        "pipeline_run_id": "run-2026-03-22-001",
        "environment": "production",
    },
)
```

#### Cloud Run: Automatic JSON Parsing

Cloud Run automatically parses JSON written to stdout as structured logs. No library needed for basic structured logging:

```python
import json
import sys
import time

def log(severity: str, message: str, **fields):
    """Write a structured log entry to stdout for Cloud Run."""
    entry = {
        "severity": severity,
        "message": message,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        **fields,
    }
    print(json.dumps(entry), flush=True)

# Usage
log("INFO", "Load stage started", stage="load", target_table="warehouse.daily_events")
log("ERROR", "BigQuery insert failed", stage="load", error_code="quotaExceeded", retry=3)
log("INFO", "Pipeline complete", rows_written=139_450, duration_seconds=63.7)
```

Special Cloud Run/Cloud Logging JSON fields:

| JSON key | Effect |
|----------|--------|
| `severity` | Maps to log severity level |
| `message` | Used as the log entry summary in Log Explorer |
| `httpRequest` | Parsed into the httpRequest field |
| `logging.googleapis.com/trace` | Correlates to a Cloud Trace trace |
| `logging.googleapis.com/spanId` | Correlates to a specific span |
| `logging.googleapis.com/labels` | Merged into entry labels |

#### Log Correlation: Adding Trace and Run IDs

For end-to-end correlation across all three pillars, include consistent correlation IDs in every log entry:

```python
import json
import os
import sys
import uuid
import time

# Generate once per pipeline run at startup
PIPELINE_RUN_ID = os.environ.get("PIPELINE_RUN_ID", str(uuid.uuid4())[:8])
TRACE_ID = os.environ.get("TRACE_ID", "")  # Set from OTel context if available

def structured_log(severity: str, message: str, **fields):
    entry = {
        "severity": severity,
        "message": message,
        "pipeline_run_id": PIPELINE_RUN_ID,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        **fields,
    }
    if TRACE_ID:
        # Format for Cloud Logging trace correlation
        entry["logging.googleapis.com/trace"] = (
            f"projects/PROJECT/traces/{TRACE_ID}"
        )
    print(json.dumps(entry), flush=True)

# Every log line now carries pipeline_run_id, making it trivial to
# retrieve all logs for a specific run:
# jsonPayload.pipeline_run_id="run-abc123"
```

#### Structured Logging from Airflow

Airflow's default logging goes to files. To write structured logs to Cloud Logging from DAG tasks:

```python
# In your DAG or operator:
import logging
import google.cloud.logging

# In an Airflow task function:
def my_task_function(**context):
    gcp_client = google.cloud.logging.Client()
    gcp_client.setup_logging()

    logger = logging.getLogger("airflow.pipeline")

    run_id = context["run_id"]
    task_id = context["task"].task_id

    logger.info(
        "Task started",
        extra={
            "json_fields": {
                "dag_id": context["dag"].dag_id,
                "task_id": task_id,
                "run_id": run_id,
                "execution_date": str(context["execution_date"]),
            }
        },
    )
```

For Cloud Composer (managed Airflow on GCP), logs are automatically routed to Cloud Logging under `resource.type="cloud_composer_environment"`.

---

### Querying Logs with gcloud

The `gcloud logging read` command accepts the same filter syntax as Log Explorer.

**Basic reads:**

```bash
# Most recent 50 logs from a specific VM
gcloud logging read \
  'resource.type="gce_instance" AND resource.labels.instance_id="1234567890"' \
  --limit=50 \
  --format=json \
  --project=PROJECT

# Filter by severity (>=ERROR includes ERROR, CRITICAL, ALERT, EMERGENCY)
gcloud logging read \
  'severity>=ERROR AND resource.type="cloud_run_job"' \
  --limit=20 \
  --project=PROJECT

# Specific time range (ISO 8601 timestamps)
gcloud logging read \
  'timestamp>="2026-03-22T00:00:00Z" AND timestamp<="2026-03-22T23:59:59Z"' \
  --limit=100 \
  --project=PROJECT

# Search for a string in either text or JSON payload
gcloud logging read \
  'textPayload:"deadlock" OR jsonPayload.message:"deadlock"' \
  --limit=10 \
  --project=PROJECT
```

**Cloud Run specific:**

```bash
# All logs from a Cloud Run Job named "daily-pipeline"
gcloud logging read \
  'resource.type="cloud_run_job" AND resource.labels.job_name="daily-pipeline"' \
  --limit=50 \
  --project=PROJECT

# Errors from any Cloud Run Job in the last hour
gcloud logging read \
  'resource.type="cloud_run_job" AND severity>=ERROR' \
  --freshness=1h \
  --project=PROJECT

# Logs from a specific Cloud Run Job execution
gcloud logging read \
  'resource.type="cloud_run_job" AND resource.labels.job_name="daily-pipeline" AND labels."run.googleapis.com/execution-name"="daily-pipeline-abc12"' \
  --limit=100 \
  --project=PROJECT
```

**Data pipeline specific:**

```bash
# All logs for a pipeline run ID (requires structured logging with pipeline_run_id)
gcloud logging read \
  'jsonPayload.pipeline_run_id="run-2026-03-22-001"' \
  --project=PROJECT

# Find rows that exceeded a threshold
gcloud logging read \
  'jsonPayload.rows_written>100000 AND jsonPayload.stage="load"' \
  --project=PROJECT

# BigQuery job failures
gcloud logging read \
  'resource.type="bigquery_resource" AND severity=ERROR' \
  --limit=20 \
  --project=PROJECT

# Pub/Sub delivery errors
gcloud logging read \
  'resource.type="pubsub_subscription" AND resource.labels.subscription_id="pipeline-sub" AND severity>=ERROR' \
  --project=PROJECT

# Dataflow job logs
gcloud logging read \
  'resource.type="dataflow_step" AND resource.labels.job_name="streaming-pipeline"' \
  --limit=50 \
  --project=PROJECT

# GCS access logs (requires Data Access audit log enabled)
gcloud logging read \
  'logName="projects/PROJECT/logs/cloudaudit.googleapis.com%2Fdata_access" AND resource.type="gcs_bucket" AND resource.labels.bucket_name="my-pipeline-bucket"' \
  --limit=20 \
  --project=PROJECT

# Cloud Functions errors
gcloud logging read \
  'resource.type="cloud_function" AND resource.labels.function_name="trigger-pipeline" AND severity>=ERROR' \
  --project=PROJECT

# Composer / Airflow task failures
gcloud logging read \
  'resource.type="cloud_composer_environment" AND jsonPayload.message:"Task exited with return code"' \
  --project=PROJECT

# VM out-of-memory events
gcloud logging read \
  'resource.type="gce_instance" AND textPayload:"Out of memory"' \
  --project=PROJECT

# Firestore write errors
gcloud logging read \
  'resource.type="datastore_database" AND severity>=ERROR' \
  --project=PROJECT
```

**Real-time log tailing:**

```bash
# Tail logs from a Cloud Run Job as it runs (like tail -f)
gcloud logging tail \
  'resource.type="cloud_run_job" AND resource.labels.job_name="daily-pipeline"' \
  --format=json \
  --project=PROJECT

# Tail errors across all resources
gcloud logging tail \
  'severity>=ERROR' \
  --project=PROJECT
```

**Output formatting:**

```bash
# Pretty print just message and timestamp
gcloud logging read \
  'resource.type="cloud_run_job"' \
  --limit=20 \
  --format='table(timestamp, severity, jsonPayload.message)' \
  --project=PROJECT

# Export to JSON file
gcloud logging read \
  'resource.type="cloud_run_job" AND severity>=ERROR' \
  --limit=1000 \
  --format=json \
  --project=PROJECT > pipeline_errors.json
```

### Log Explorer Filter Syntax Reference

| Operator | Example | Notes |
|----------|---------|-------|
| `=` | `severity="ERROR"` | Exact match |
| `!=` | `severity!="DEBUG"` | Not equal |
| `>=`, `<=`, `>`, `<` | `severity>=ERROR` | Severity comparison by level |
| `AND` | `severity>=ERROR AND resource.type="cloud_run_job"` | Logical AND |
| `OR` | `severity=ERROR OR severity=CRITICAL` | Logical OR |
| `NOT` | `NOT severity=DEBUG` | Logical NOT |
| `:` | `jsonPayload.message:"failed"` | Substring match |
| `=~` | `jsonPayload.error=~"timeout.*retry"` | Regex match |
| `!~` | `jsonPayload.stage!~"^debug"` | Regex not match |
| Parentheses | `(severity=ERROR OR severity=CRITICAL) AND resource.type="gce_instance"` | Grouping |

**Nested field access** uses dot notation: `jsonPayload.nested.field`. Arrays use index notation: `jsonPayload.errors[0].code`.

**Resource type values** for data engineering:

| Resource Type | Use Case |
|---------------|----------|
| `gce_instance` | VMs running pipeline scripts |
| `cloud_run_job` | Cloud Run Jobs |
| `cloud_run_revision` | Cloud Run Services |
| `cloud_function` | Cloud Functions (Gen 1) |
| `cloudfunctions.googleapis.com/CloudFunction` | Cloud Functions (Gen 2) |
| `bigquery_resource` | BigQuery jobs |
| `pubsub_subscription` | Pub/Sub subscriptions |
| `pubsub_topic` | Pub/Sub topics |
| `dataflow_step` | Dataflow |
| `cloud_composer_environment` | Cloud Composer / Airflow |
| `datastore_database` | Firestore |
| `gcs_bucket` | Cloud Storage (via audit logs) |

> [!tip] Log Explorer Saved Queries
> In the GCP Console Log Explorer, save frequently-used filters as named queries. They persist per-project and are shareable with the team. Store the equivalent `gcloud logging read` commands in your runbook notes alongside them.

---

### Log-Based Metrics

Log-based metrics let you create Cloud Monitoring metrics derived from log patterns. Two types:

- **Counter metrics**: count log entries matching a filter
- **Distribution metrics**: extract a numeric value from each matching log entry

#### Creating Counter Metrics

```bash
# Count pipeline errors per Cloud Run Job
gcloud logging metrics create pipeline-errors \
  --description="Count of pipeline error log entries in Cloud Run Jobs" \
  --log-filter='severity>=ERROR AND resource.type="cloud_run_job"' \
  --project=PROJECT

# Count a specific failure mode
gcloud logging metrics create bq-quota-exceeded \
  --description="Count of BigQuery quota exceeded errors" \
  --log-filter='severity>=ERROR AND (jsonPayload.message:"quotaExceeded" OR textPayload:"quotaExceeded")' \
  --project=PROJECT

# Count successful pipeline completions
gcloud logging metrics create pipeline-completions \
  --description="Count of successful pipeline run completions" \
  --log-filter='jsonPayload.stage="complete" AND jsonPayload.status="success" AND resource.type="cloud_run_job"' \
  --project=PROJECT
```

#### Creating Distribution Metrics

Distribution metrics extract a numeric value from each matching log entry, allowing you to track p50/p90/p99 of values like execution time:

```bash
# Distribution of pipeline execution time (extracted from jsonPayload.duration_seconds)
gcloud logging metrics create pipeline-duration \
  --description="Distribution of pipeline execution time in seconds" \
  --log-filter='jsonPayload.duration_seconds!="" AND jsonPayload.stage="complete"' \
  --value-extractor='EXTRACT(jsonPayload.duration_seconds)' \
  --buckets-type=EXPONENTIAL \
  --buckets-num-finite-buckets=20 \
  --buckets-growth-factor=2 \
  --buckets-scale=1 \
  --project=PROJECT

# Distribution of rows written per pipeline run
gcloud logging metrics create rows-written \
  --description="Distribution of rows written per pipeline run" \
  --log-filter='jsonPayload.rows_written!="" AND jsonPayload.stage="load"' \
  --value-extractor='EXTRACT(jsonPayload.rows_written)' \
  --buckets-type=LINEAR \
  --buckets-num-finite-buckets=10 \
  --buckets-width=10000 \
  --buckets-offset=0 \
  --project=PROJECT
```

#### Using Log-Based Metrics

Once created, log-based metrics appear in Cloud Monitoring as:
- `logging.googleapis.com/user/METRIC_NAME`

You can then:
- Add them to dashboards
- Create alerting policies: "alert if pipeline-errors rate > 5 per minute"
- Use them in uptime calculations

```bash
# List all log-based metrics in a project
gcloud logging metrics list --project=PROJECT

# Describe a specific metric
gcloud logging metrics describe pipeline-errors --project=PROJECT

# Update a metric's filter
gcloud logging metrics update pipeline-errors \
  --log-filter='severity>=ERROR AND resource.type="cloud_run_job" AND resource.labels.job_name!="test-pipeline"' \
  --project=PROJECT

# Delete a metric
gcloud logging metrics delete pipeline-errors --project=PROJECT
```

> [!note] Log-Based Metric Latency
> Log-based metrics have up to 3–4 minutes of latency. Do not use them for sub-minute alerting. For low-latency alerting, write custom metrics directly from your pipeline code using the Cloud Monitoring API (see [[cloud-monitoring-metrics|Cloud Monitoring]]).

---

### Log Router and Sinks

The **Log Router** intercepts every log entry before it reaches a log bucket. Sinks route copies of matching log entries to external destinations. You can route logs to:

- **BigQuery**: for SQL analytics over log data
- **Cloud Storage**: for archival and compliance
- **Pub/Sub**: for streaming to external systems (Splunk, Datadog, custom consumers)
- **Log Buckets**: route logs to a different log bucket (e.g., for separate retention)

#### Creating Sinks

```bash
# Route error logs to BigQuery for SQL analysis
gcloud logging sinks create error-log-sink \
  bigquery.googleapis.com/projects/PROJECT/datasets/pipeline_error_logs \
  --log-filter='severity>=ERROR' \
  --project=PROJECT

# After creation, grant the sink's service account BigQuery Data Editor
# The service account is shown in the output of the above command
gcloud projects add-iam-policy-binding PROJECT \
  --member="serviceAccount:SINK_SA@gcp-sa-logging.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataEditor"

# Route all audit logs to Cloud Storage for compliance archival
gcloud logging sinks create audit-archive \
  storage.googleapis.com/my-audit-log-archive-bucket \
  --log-filter='logName:"cloudaudit.googleapis.com"' \
  --project=PROJECT

# Route specific pipeline logs to Pub/Sub for streaming to Splunk
gcloud logging sinks create pipeline-to-splunk \
  pubsub.googleapis.com/projects/PROJECT/topics/log-export-topic \
  --log-filter='resource.type="cloud_run_job" AND jsonPayload.pipeline!=""' \
  --project=PROJECT

# Route DEBUG logs to a separate custom bucket for high-verbosity storage
gcloud logging sinks create debug-logs-sink \
  logging.googleapis.com/projects/PROJECT/locations/global/buckets/debug-logs \
  --log-filter='severity=DEBUG' \
  --project=PROJECT

# Organization-level sink (routes from all projects in org)
gcloud logging sinks create org-audit-sink \
  bigquery.googleapis.com/projects/CENTRAL_PROJECT/datasets/org_audit_logs \
  --log-filter='logName:"cloudaudit.googleapis.com/activity"' \
  --organization=ORG_ID \
  --include-children
```

#### Managing Sinks

```bash
# List all sinks
gcloud logging sinks list --project=PROJECT

# Describe a sink (shows service account, destination, filter)
gcloud logging sinks describe error-log-sink --project=PROJECT

# Update a sink's filter
gcloud logging sinks update error-log-sink \
  --log-filter='severity>=ERROR AND resource.type="cloud_run_job"' \
  --project=PROJECT

# Delete a sink
gcloud logging sinks delete error-log-sink --project=PROJECT
```

#### Exclusion Filters

Exclusions prevent specific log entries from being ingested. Use them to reduce cost without losing important data:

```bash
# Exclude DEBUG logs from the _Default bucket (they cost money, rarely needed)
gcloud logging sinks update _Default \
  --add-exclusion="name=exclude-debug,filter=severity=DEBUG,description=Exclude debug logs" \
  --project=PROJECT

# Exclude health check logs from Cloud Run (noisy, not useful)
gcloud logging sinks update _Default \
  --add-exclusion='name=exclude-health-checks,filter=httpRequest.requestUrl:"/health" AND httpRequest.status=200' \
  --project=PROJECT

# Exclude a specific verbose pipeline stage from default storage
# (you might still sink it to Cloud Storage for archival, just not pay for default ingestion)
gcloud logging sinks update _Default \
  --add-exclusion='name=exclude-debug-stage,filter=jsonPayload.stage="debug-checkpoint"' \
  --project=PROJECT

# List exclusions on a sink
gcloud logging sinks describe _Default --project=PROJECT | grep -A 20 exclusions

# Remove an exclusion
gcloud logging sinks update _Default \
  --remove-exclusion=exclude-debug \
  --project=PROJECT
```

> [!warning] Exclusions Are Permanent
> Excluded log entries are dropped immediately and permanently. You cannot recover them later. Only exclude logs you are certain you will never need. Test exclusion filters in Log Explorer first by verifying the matching entries are truly noise.

---

### Log Analytics with BigQuery

Log Analytics is a feature that lets you query a Cloud Logging bucket directly with SQL using BigQuery syntax. Enable it on any log bucket to unlock SQL-based analysis without the overhead of a separate sink.

#### Enabling Log Analytics

```bash
# Enable Log Analytics on an existing bucket
gcloud logging buckets update _Default \
  --location=global \
  --enable-analytics \
  --project=PROJECT

# Or on a custom bucket
gcloud logging buckets update pipeline-logs \
  --location=global \
  --enable-analytics \
  --project=PROJECT

# Check if Log Analytics is enabled
gcloud logging buckets describe _Default \
  --location=global \
  --project=PROJECT | grep analyticsEnabled
```

Once enabled, navigate to Log Analytics in the Cloud Logging console or query the linked BigQuery view.

#### SQL Queries for Pipeline Analysis

**Basic error analysis:**

```sql
SELECT
  timestamp,
  severity,
  resource.labels.job_name AS job_name,
  JSON_VALUE(json_payload, '$.pipeline_run_id') AS run_id,
  JSON_VALUE(json_payload, '$.stage') AS stage,
  JSON_VALUE(json_payload, '$.message') AS message,
  JSON_VALUE(json_payload, '$.error') AS error
FROM `project.region.bucket_name._AllLogs`
WHERE severity = 'ERROR'
  AND timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
ORDER BY timestamp DESC
LIMIT 100;
```

**Error rate over time:**

```sql
SELECT
  TIMESTAMP_TRUNC(timestamp, HOUR) AS hour,
  resource.labels.job_name AS job_name,
  COUNT(*) AS total_logs,
  COUNTIF(severity = 'ERROR' OR severity = 'CRITICAL') AS error_count,
  ROUND(
    COUNTIF(severity = 'ERROR' OR severity = 'CRITICAL') * 100.0 / COUNT(*),
    2
  ) AS error_rate_pct
FROM `project.region.bucket_name._AllLogs`
WHERE timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
  AND resource.type = 'cloud_run_job'
GROUP BY hour, job_name
ORDER BY hour DESC;
```

**Pipeline duration trends:**

```sql
SELECT
  DATE(timestamp) AS run_date,
  resource.labels.job_name AS job_name,
  AVG(CAST(JSON_VALUE(json_payload, '$.duration_seconds') AS FLOAT64)) AS avg_duration_s,
  MAX(CAST(JSON_VALUE(json_payload, '$.duration_seconds') AS FLOAT64)) AS max_duration_s,
  MIN(CAST(JSON_VALUE(json_payload, '$.duration_seconds') AS FLOAT64)) AS min_duration_s,
  APPROX_QUANTILES(
    CAST(JSON_VALUE(json_payload, '$.duration_seconds') AS FLOAT64), 100
  )[OFFSET(90)] AS p90_duration_s
FROM `project.region.bucket_name._AllLogs`
WHERE JSON_VALUE(json_payload, '$.stage') = 'complete'
  AND JSON_VALUE(json_payload, '$.duration_seconds') IS NOT NULL
  AND timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY run_date, job_name
ORDER BY run_date DESC;
```

**Rows processed per pipeline run:**

```sql
SELECT
  JSON_VALUE(json_payload, '$.pipeline_run_id') AS run_id,
  MIN(timestamp) AS start_time,
  MAX(timestamp) AS end_time,
  TIMESTAMP_DIFF(MAX(timestamp), MIN(timestamp), SECOND) AS total_duration_s,
  MAX(CAST(JSON_VALUE(json_payload, '$.rows_read') AS INT64)) AS rows_read,
  MAX(CAST(JSON_VALUE(json_payload, '$.rows_written') AS INT64)) AS rows_written,
  MAX(CAST(JSON_VALUE(json_payload, '$.dropped_rows') AS INT64)) AS dropped_rows
FROM `project.region.bucket_name._AllLogs`
WHERE JSON_VALUE(json_payload, '$.pipeline_run_id') IS NOT NULL
  AND timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
GROUP BY run_id
ORDER BY start_time DESC;
```

**Cross-correlate logs with BigQuery job metadata:**

```sql
-- Join pipeline logs with BigQuery INFORMATION_SCHEMA for cost analysis
SELECT
  l.timestamp,
  JSON_VALUE(l.json_payload, '$.pipeline_run_id') AS run_id,
  j.total_bytes_processed,
  j.total_slot_ms,
  ROUND(j.total_bytes_processed / POW(1024, 4) * 6.25, 4) AS estimated_cost_usd
FROM `project.region.bucket_name._AllLogs` l
JOIN `project.region.INFORMATION_SCHEMA.JOBS` j
  ON JSON_VALUE(l.json_payload, '$.bq_job_id') = j.job_id
WHERE l.timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
  AND j.creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
ORDER BY estimated_cost_usd DESC;
```

> [!tip] Log Analytics vs BigQuery Sink
> Log Analytics queries your log bucket in place — no data movement, no ETL. A BigQuery sink copies log data into a regular BigQuery dataset. Use Log Analytics for ad-hoc analysis. Use a BigQuery sink when you need to join log data with other datasets, apply custom transformations, or share access with users who don't have Cloud Logging viewer permissions.

---

### Audit Logs

Audit logs record who did what to GCP resources. For data engineers, they are essential for compliance, access tracking, and incident investigation.

#### Audit Log Types

| Log Type | Log Name | Always On | Cost | Contents |
|----------|----------|-----------|------|----------|
| Admin Activity | `cloudaudit.googleapis.com/activity` | Yes | Free (in `_Required` bucket) | Who modified infrastructure (created VMs, changed IAM, modified BigQuery tables) |
| Data Access | `cloudaudit.googleapis.com/data_access` | No | Charged | Who read or wrote data (BigQuery query results, GCS file reads, Firestore reads) |
| System Event | `cloudaudit.googleapis.com/system_event` | Yes | Free | GCP-initiated actions (live migration, auto-scaling) |
| Policy Denied | `cloudaudit.googleapis.com/policy` | Yes | Free | IAM permission denials |

#### Enabling Data Access Audit Logs

Data Access logs are the most useful for data engineers (who read which BigQuery table?) but are disabled by default due to volume.

Using gcloud:

```bash
# Export current IAM policy to a file
gcloud projects get-iam-policy PROJECT \
  --format=json > /tmp/policy.json

# Edit the file to add auditConfigs
# Add this block to the JSON:
# {
#   "auditConfigs": [
#     {
#       "service": "bigquery.googleapis.com",
#       "auditLogConfigs": [
#         { "logType": "DATA_READ" },
#         { "logType": "DATA_WRITE" }
#       ]
#     },
#     {
#       "service": "storage.googleapis.com",
#       "auditLogConfigs": [
#         { "logType": "DATA_READ" },
#         { "logType": "DATA_WRITE" }
#       ]
#     }
#   ]
# }

# Apply the updated policy
gcloud projects set-iam-policy PROJECT /tmp/policy.json
```

> [!warning] Data Access Log Volume
> Enabling Data Access logs for BigQuery in a busy project can generate gigabytes of logs per day. Enable selectively. For compliance, consider enabling only `DATA_WRITE` logs or scoping to specific services. Route them to a low-cost Cloud Storage sink rather than keeping them in the default bucket.

#### Querying Audit Logs

```bash
# Who created or deleted BigQuery datasets in the last 7 days
gcloud logging read \
  'logName="projects/PROJECT/logs/cloudaudit.googleapis.com%2Factivity" AND resource.type="bigquery_dataset" AND (protoPayload.methodName:"datasets.insert" OR protoPayload.methodName:"datasets.delete")' \
  --freshness=7d \
  --format='table(timestamp, protoPayload.authenticationInfo.principalEmail, protoPayload.methodName, resource.labels.dataset_id)' \
  --project=PROJECT

# Who modified IAM policies
gcloud logging read \
  'logName="projects/PROJECT/logs/cloudaudit.googleapis.com%2Factivity" AND protoPayload.methodName:"SetIamPolicy"' \
  --freshness=30d \
  --project=PROJECT

# Permission denied errors (useful for debugging service account access issues)
gcloud logging read \
  'logName="projects/PROJECT/logs/cloudaudit.googleapis.com%2Fpolicy"' \
  --limit=20 \
  --format='table(timestamp, protoPayload.authenticationInfo.principalEmail, protoPayload.resourceName, protoPayload.status.message)' \
  --project=PROJECT

# Who queried a specific BigQuery table (requires Data Access logs)
gcloud logging read \
  'logName="projects/PROJECT/logs/cloudaudit.googleapis.com%2Fdata_access" AND resource.type="bigquery_dataset" AND protoPayload.resourceName:"tables/sensitive_table"' \
  --freshness=7d \
  --project=PROJECT

# All actions by a specific service account
gcloud logging read \
  'logName:"cloudaudit.googleapis.com" AND protoPayload.authenticationInfo.principalEmail="pipeline-sa@PROJECT.iam.gserviceaccount.com"' \
  --freshness=7d \
  --project=PROJECT
```

---

## Cloud Trace for Distributed Pipeline Tracing

### What Is Distributed Tracing

A **trace** represents the end-to-end journey of a single operation across multiple services. It is made up of **spans**, where each span represents one unit of work.

```
Trace: daily-pipeline-run (63.7s)
├── extract (18.4s)
│   ├── bq-read-raw-events (17.1s)
│   └── validate-schema (1.3s)
├── transform (42.1s)
│   ├── deduplicate (8.2s)
│   ├── enrich-from-lookup-table (31.4s)   <-- bottleneck
│   └── compute-aggregates (2.5s)
└── load (3.2s)
    ├── bq-write-warehouse (2.8s)
    └── pubsub-publish-completion (0.4s)
```

Without tracing, you see the wall clock time of the whole run. With tracing, you instantly see that `enrich-from-lookup-table` takes 75% of total time.

**Span attributes** are key-value pairs attached to a span:

| Attribute | Example |
|-----------|---------|
| `pipeline.name` | `daily-ingest` |
| `pipeline.stage` | `transform` |
| `db.system` | `bigquery` |
| `db.statement` | `SELECT ... FROM raw.events` |
| `http.method` | `POST` |
| `http.url` | `https://bigquery.googleapis.com/...` |
| `error` | `true` |
| `exception.message` | `QuotaExceeded: ...` |

**Trace context propagation** is how the trace ID and span ID travel across service boundaries. The W3C Trace Context standard defines the `traceparent` HTTP header:

```
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
              ^^  ^^^^^^^^trace-id^^^^^^^^^^^^^^^^  ^^^span-id^^^   flags
```

When your Cloud Run Job calls another service, it should pass this header. The receiving service then creates a child span under the same trace.

### Instrumenting Python Pipelines with OpenTelemetry

OpenTelemetry is the open standard for observability instrumentation. Cloud Trace has a native OpenTelemetry exporter.

Install:

```bash
pip install opentelemetry-sdk \
            opentelemetry-api \
            opentelemetry-exporter-gcp-trace \
            opentelemetry-instrumentation-requests \
            opentelemetry-instrumentation-urllib3
```

#### Basic Setup and Manual Spans

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.cloud_trace import CloudTraceSpanExporter

# Initialize once at startup
def setup_tracing(project_id: str):
    provider = TracerProvider()
    exporter = CloudTraceSpanExporter(project_id=project_id)
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    return trace.get_tracer("pipeline")

tracer = setup_tracing("my-project")

# Manual span instrumentation
def run_pipeline(pipeline_name: str):
    with tracer.start_as_current_span(
        "pipeline-run",
        attributes={
            "pipeline.name": pipeline_name,
            "pipeline.version": "2.1.0",
            "pipeline.environment": "production",
        }
    ) as root_span:

        # Extract stage
        with tracer.start_as_current_span("extract") as extract_span:
            rows = extract_data()
            extract_span.set_attribute("pipeline.rows_read", rows)

        # Transform stage
        with tracer.start_as_current_span("transform") as transform_span:
            result_rows, dropped = transform_data(rows)
            transform_span.set_attribute("pipeline.rows_output", result_rows)
            transform_span.set_attribute("pipeline.rows_dropped", dropped)

        # Load stage
        with tracer.start_as_current_span("load") as load_span:
            load_data(result_rows)
            load_span.set_attribute("pipeline.rows_written", result_rows)

        root_span.set_attribute("pipeline.status", "complete")
```

#### Recording Errors in Spans

```python
from opentelemetry.trace import StatusCode
import traceback

with tracer.start_as_current_span("bq-query") as span:
    try:
        result = run_bq_query(sql)
        span.set_attribute("db.rows_returned", len(result))
    except Exception as e:
        # Mark the span as failed
        span.set_status(StatusCode.ERROR, str(e))
        span.record_exception(e)  # Attaches stack trace to span
        raise
```

#### Auto-Instrumentation for HTTP Clients

Auto-instrumentation patches the requests and urllib3 libraries to automatically create child spans and propagate trace context:

```python
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.instrumentation.urllib3 import URLLib3Instrumentor

# Call once at startup, before any requests are made
RequestsInstrumentor().instrument()
URLLib3Instrumentor().instrument()

# Now all requests.get(), requests.post(), etc. automatically:
# 1. Create a child span under the current active span
# 2. Inject the traceparent header into outgoing requests
# 3. Record HTTP method, URL, status code as span attributes
import requests
response = requests.get("https://api.example.com/data")
# ↑ This call is automatically traced
```

#### Propagating Trace Context Across Cloud Run Jobs

When one Cloud Run Job triggers another (e.g., via Cloud Tasks or Pub/Sub), propagate the trace context:

**Sender (Job A — creating the downstream task):**

```python
from opentelemetry import trace
from opentelemetry.propagate import inject

def enqueue_downstream_job(payload: dict):
    # Get current span's trace context
    carrier = {}
    inject(carrier)  # Populates carrier with traceparent, tracestate

    # Pass the trace context in the message or task metadata
    message_with_context = {
        **payload,
        "_trace_context": carrier,  # e.g., {"traceparent": "00-abc..."}
    }

    # Publish to Pub/Sub or Cloud Tasks
    publish_message(message_with_context)
```

**Receiver (Job B — processing the task):**

```python
from opentelemetry import trace
from opentelemetry.propagate import extract

def process_message(message: dict):
    # Extract trace context from the incoming message
    trace_context = message.get("_trace_context", {})
    ctx = extract(trace_context)  # Reconstructs the OTel context

    # Start a span as a child of the upstream span
    with tracer.start_as_current_span(
        "downstream-processing",
        context=ctx,
    ) as span:
        span.set_attribute("pipeline.source_job", "daily-ingest")
        process(message)
```

#### BigQuery Span Instrumentation

The BigQuery Python client does not auto-instrument. Add manual spans around BigQuery calls:

```python
from google.cloud import bigquery

bq_client = bigquery.Client()

def traced_bq_query(sql: str, job_config=None):
    """Run a BigQuery query with tracing."""
    with tracer.start_as_current_span("bigquery.query") as span:
        span.set_attribute("db.system", "bigquery")
        span.set_attribute("db.statement", sql[:1000])  # Truncate long SQL

        job = bq_client.query(sql, job_config=job_config)
        rows = list(job.result())

        # Record job metadata after completion
        span.set_attribute("db.bigquery.job_id", job.job_id)
        span.set_attribute("db.bigquery.bytes_processed", job.total_bytes_processed or 0)
        span.set_attribute("db.bigquery.slot_ms", job.slot_millis or 0)
        span.set_attribute("db.rows_returned", len(rows))

        return rows

# Usage
results = traced_bq_query("SELECT * FROM `dataset.table` WHERE date = '2026-03-22'")
```

#### Correlating Traces with Logs

To click from a trace span to the corresponding log entries in Log Explorer, inject the trace ID and span ID into your log entries:

```python
import json
import sys
from opentelemetry import trace as otel_trace

PROJECT_ID = "my-project"

def log_with_trace(severity: str, message: str, **fields):
    """Write a structured log entry with trace correlation."""
    current_span = otel_trace.get_current_span()
    span_context = current_span.get_span_context()

    entry = {
        "severity": severity,
        "message": message,
        **fields,
    }

    if span_context.is_valid:
        trace_id = format(span_context.trace_id, "032x")
        span_id = format(span_context.span_id, "016x")
        entry["logging.googleapis.com/trace"] = (
            f"projects/{PROJECT_ID}/traces/{trace_id}"
        )
        entry["logging.googleapis.com/spanId"] = span_id
        entry["logging.googleapis.com/trace_sampled"] = True

    print(json.dumps(entry), flush=True)

# Usage inside a traced function:
with tracer.start_as_current_span("extract"):
    log_with_trace("INFO", "Starting extraction", stage="extract", source="raw.events")
    rows = do_extract()
    log_with_trace("INFO", "Extraction done", stage="extract", rows=len(rows))
```

Now in Cloud Trace, each span has a "View Logs" link that filters Log Explorer to matching trace-correlated entries.

### Viewing Traces in the Console

In the Cloud Trace console:
- **Trace list**: shows all recorded traces, filterable by root span name, latency, date
- **Waterfall view**: horizontal bar chart showing span durations and nesting
- **Span details**: attributes, events, status, linked logs
- **Latency distribution**: histogram of trace durations over time — useful for detecting regressions

#### gcloud Trace Commands

```bash
# List recent traces (limited gcloud support; prefer console or API)
gcloud trace traces list \
  --project=PROJECT \
  --start-time="2026-03-22T00:00:00Z" \
  --end-time="2026-03-22T23:59:59Z" \
  --page-size=10

# List traces matching a filter
gcloud trace traces list \
  --project=PROJECT \
  --filter='rootSpan.name:"daily-pipeline"' \
  --limit=10
```

> [!note] Cloud Trace Sampling
> By default, Cloud Trace samples 1 request per second per resource. For batch pipelines where each run is important, set the sampler to always-on during development, then dial back for production to control cost.
>
> ```python
> from opentelemetry.sdk.trace.sampling import ALWAYS_ON, ParentBased, TraceIdRatioBased
>
> # Always sample (development / critical pipelines)
> provider = TracerProvider(sampler=ALWAYS_ON)
>
> # Sample 10% of traces (high-volume pipelines)
> provider = TracerProvider(sampler=TraceIdRatioBased(0.1))
> ```

### Cloud Trace Pricing

| Tier | Price |
|------|-------|
| First 2.5 million spans/month | Free |
| Additional spans | $0.20 per million spans |

For a daily pipeline with 50 spans per run, 30 runs/day: 50 × 30 × 30 = 45,000 spans/month. Well within the free tier.

### Cloud Trace vs Datadog APM

| Feature | Cloud Trace | Datadog APM |
|---------|-------------|-------------|
| Instrumentation standard | OpenTelemetry (open, portable) | ddtrace (proprietary) |
| Auto-instrumentation coverage | HTTP, gRPC (via OTel libraries) | Extensive (BQ, Redis, SQL, etc.) |
| Flame graphs | Yes | Yes (richer, with CPU profiling) |
| Log correlation | Via trace_id in structured logs | Automatic (agent injects) |
| Service map | Basic | Rich (auto-detected dependencies) |
| Trace search | Limited (console + API) | Advanced (faceted search, retention) |
| Pricing | Free up to 2.5M spans/month | Included in APM per-host pricing |
| SQL query tracking | Manual spans required | Automatic |
| GCP integration | Native | Requires Datadog Agent on every host |
| Retention | 30 days | Configurable (15–30 days) |
| Alert on trace patterns | No | Yes (anomaly detection) |

> [!tip] When Cloud Trace Is Enough
> For batch data pipelines with 1–100 runs/day, Cloud Trace is sufficient. Its free tier easily covers the span volume, and the waterfall view is all you need to find bottlenecks. Datadog APM is more valuable for high-throughput services where the richer auto-instrumentation and anomaly detection pay for themselves.

---

## End-to-End Observability: Connecting Metrics, Logs, and Traces

### The Three Pillars Connected

The three observability signals serve different diagnostic needs:

| Signal | Tells You | Time to Insight |
|--------|-----------|-----------------|
| **Metrics** | Something is wrong (error rate spike, latency regression) | Seconds (alert fires) |
| **Logs** | What happened and why | Minutes (search and read) |
| **Traces** | Where time was spent across services | Minutes (find the slow span) |

**Investigation flow:**

1. Alert fires on a Cloud Monitoring policy: `pipeline-errors > 5 in 5 minutes`
2. Drill into the alerting metric in Cloud Monitoring → see which Cloud Run Job spiked
3. Jump to Log Explorer → filter by `resource.labels.job_name` + `severity>=ERROR` → find the error message
4. Copy the `pipeline_run_id` from the log entry → filter all logs for that run → reconstruct the full timeline
5. Copy the `trace_id` from the log entry → open Cloud Trace → see the waterfall → identify which span failed or was slow

### Correlation ID Strategy

Use one consistent correlation ID per pipeline run across all three pillars:

```python
import uuid
import os

# Generated at pipeline startup, passed as env var to child processes
PIPELINE_RUN_ID = os.environ.get("PIPELINE_RUN_ID", f"run-{uuid.uuid4().hex[:8]}")

# 1. Log every entry with pipeline_run_id
structured_log("INFO", "Stage complete", pipeline_run_id=PIPELINE_RUN_ID, stage="extract")

# 2. Set pipeline_run_id as a span attribute
with tracer.start_as_current_span("pipeline-run") as span:
    span.set_attribute("pipeline.run_id", PIPELINE_RUN_ID)

# 3. Write pipeline_run_id to Firestore state store
# (allows dashboard to show "which runs are in progress right now")
firestore_client.collection("pipeline_runs").document(PIPELINE_RUN_ID).set({
    "status": "running",
    "started_at": firestore.SERVER_TIMESTAMP,
    "job_name": "daily-ingest",
})

# 4. Tag custom metrics with pipeline_run_id label
# (enables filtering dashboards by run)
```

### Building a GCP-Native Observability Stack

A complete GCP-native observability stack for a data engineering team, without Datadog:

#### Architecture Overview

```
Data Pipeline (Cloud Run Job)
│
├── Metrics ──────────────────────────────────────────────────────────────────►  Cloud Monitoring
│   ├── Ops Agent (VM metrics: CPU, memory, disk, network)                       │
│   ├── Built-in metrics (Cloud Run: request count, latency, memory)             ├── Dashboards
│   ├── Custom metrics (rows_processed, bq_bytes_billed, pipeline_duration)     ├── Alerting Policies
│   └── Log-based metrics (error count, warning count)                           └── Uptime Checks
│
├── Logs ──────────────────────────────────────────────────────────────────────► Cloud Logging
│   ├── Structured JSON logs (pipeline_run_id, stage, row counts, errors)        │
│   ├── Cloud Run stdout → auto-parsed JSON                                      ├── Log Explorer
│   ├── Log Router                                                                ├── Log Analytics (SQL)
│   │   ├── Error sink → BigQuery (error_logs dataset)                           └── Audit trail
│   │   └── All logs sink → Cloud Storage (gs://archive-bucket/logs/)
│   └── Audit logs → _Required bucket (free, 400 days)
│
├── Traces ────────────────────────────────────────────────────────────────────► Cloud Trace
│   ├── OpenTelemetry SDK (manual spans per pipeline stage)                      │
│   ├── Auto-instrumented HTTP calls (requests, urllib3)                         ├── Waterfall view
│   └── Trace context propagated via Pub/Sub message metadata                   └── Latency distribution
│
└── State ─────────────────────────────────────────────────────────────────────► Firestore
    └── pipeline_runs collection (live status, last run time, row counts)        └── Live dashboard
```

#### Step 1: Metrics

- Install Ops Agent on all VMs (see [[cloud-monitoring-metrics|custom metrics]])
- Cloud Run metrics are automatic (no Ops Agent needed)
- Write custom metrics for business KPIs using `google-cloud-monitoring` Python library
- Create log-based metrics for error counts

#### Step 2: Logs

- Write structured JSON logs with `pipeline_run_id` in every entry
- Enable Log Analytics on `_Default` bucket
- Create sinks: errors → BigQuery, all logs → Cloud Storage

#### Step 3: Traces

- Add OpenTelemetry SDK to pipeline entrypoint
- Instrument major stages as spans
- Auto-instrument HTTP clients
- Propagate trace context across Pub/Sub calls

#### Step 4: Alerting

```bash
# Create notification channel (email)
gcloud monitoring channels create \
  --display-name="Pipeline Alerts Email" \
  --type=email \
  --channel-labels=email_address=data-team@company.com \
  --project=PROJECT

# Create alerting policy for pipeline errors
# (use Terraform or Console for full policy; gcloud for simple policies)
gcloud alpha monitoring policies create \
  --policy-from-file=pipeline-error-policy.json \
  --project=PROJECT
```

#### Step 5: Dashboard

Create a Cloud Monitoring dashboard covering:
- Pipeline runs per day (log-based metric)
- Error rate over time (log-based metric)
- Pipeline duration p50/p90 (distribution metric or log-based distribution)
- BigQuery bytes billed per run (custom metric)
- VM CPU and memory (Ops Agent metrics)
- Rows processed per run (custom metric)

---

### Cost Comparison: GCP-Native vs Datadog

Reference infrastructure for this comparison: 2 GCE VMs, BigQuery active usage, 5 Cloud Run Jobs (10 runs/day each), 3 Pub/Sub topics, Cloud Storage, Firestore. All numbers are approximate list prices as of early 2026.

#### GCP-Native Stack

| Component | Monthly Cost | Notes |
|-----------|-------------|-------|
| Cloud Monitoring (metrics) | $0 | Built-in and Ops Agent metrics are free |
| Custom metrics | ~$2–5 | $0.18/metric/month after 150 free metrics; 10–20 custom metrics |
| Log ingestion | ~$0–15 | 50 GiB/month free; typical pipelines stay under unless verbose logging |
| Log storage | ~$0–5 | 50 GiB/month free in `_Default` bucket |
| Log Analytics | $0 | Querying log buckets with SQL is free |
| BigQuery log sink storage | ~$0–3 | Standard BQ storage rates on exported logs |
| Cloud Trace | $0 | Batch pipelines easily stay under 2.5M spans/month free tier |
| Cloud Storage log archive | ~$1–3 | At $0.02/GiB for Standard storage |
| **Total** | **~$3–31/month** | |

#### Datadog Stack

| Component | Monthly Cost | Notes |
|-----------|-------------|-------|
| Infrastructure monitoring | ~$30/host × 2 hosts = $60 | Pro plan pricing |
| APM | ~$35/host × 2 hosts = $70 | APM + Profiling |
| Log Management | ~$0.10/GiB × 20 GiB = $100+ | Ingestion + 15-day retention |
| Log rehydration | Additional | If you need logs older than 15 days |
| Dashboards, alerts | Included | |
| **Total** | **~$230–400/month** | Scales with host count and log volume |

> [!info] The Real GCP-Native Cost
> The dominant cost driver for GCP-native logging is log ingestion volume. If your pipelines write verbose DEBUG-level logs, you can easily exceed the 50 GiB free tier. The fix: use exclusion filters to drop DEBUG logs from `_Default`, route them to a cheap Cloud Storage sink only if needed, and ensure your pipeline code only logs at DEBUG during development.

> [!info] When Datadog Is Worth It
> Datadog's value is in breadth and depth of auto-instrumentation. If your team runs dozens of services in multiple languages, and you need rich APM with CPU profiling, automatic anomaly detection, and a consolidated view across non-GCP infrastructure, Datadog's cost is justified. For a focused GCP data engineering team running batch pipelines, GCP-native is sufficient and dramatically cheaper.

---

## Quick Reference: Common gcloud Logging Commands

```bash
# Read recent logs
gcloud logging read 'FILTER' --limit=N --project=PROJECT

# Tail logs in real-time
gcloud logging tail 'FILTER' --project=PROJECT

# List log-based metrics
gcloud logging metrics list --project=PROJECT

# Create a log-based metric
gcloud logging metrics create NAME --log-filter='FILTER' --project=PROJECT

# List sinks
gcloud logging sinks list --project=PROJECT

# Create a BigQuery sink
gcloud logging sinks create NAME \
  bigquery.googleapis.com/projects/PROJECT/datasets/DATASET \
  --log-filter='FILTER' --project=PROJECT

# Create a Cloud Storage sink
gcloud logging sinks create NAME \
  storage.googleapis.com/BUCKET_NAME \
  --log-filter='FILTER' --project=PROJECT

# Add exclusion to _Default sink
gcloud logging sinks update _Default \
  --add-exclusion="name=NAME,filter=FILTER" --project=PROJECT

# List log buckets
gcloud logging buckets list --location=global --project=PROJECT

# Enable Log Analytics on a bucket
gcloud logging buckets update BUCKET \
  --location=global --enable-analytics --project=PROJECT

# Enable Data Access audit logs (edit policy.json first)
gcloud projects get-iam-policy PROJECT --format=json > /tmp/policy.json
# ... edit /tmp/policy.json to add auditConfigs ...
gcloud projects set-iam-policy PROJECT /tmp/policy.json
```

## Quick Reference: OpenTelemetry Tracing Setup

```python
# Install: pip install opentelemetry-sdk opentelemetry-exporter-gcp-trace
# opentelemetry-instrumentation-requests

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.cloud_trace import CloudTraceSpanExporter
from opentelemetry.instrumentation.requests import RequestsInstrumentor

# Setup (call once at startup)
provider = TracerProvider()
provider.add_span_processor(BatchSpanProcessor(CloudTraceSpanExporter()))
trace.set_tracer_provider(provider)
RequestsInstrumentor().instrument()

tracer = trace.get_tracer("pipeline")

# Usage
with tracer.start_as_current_span("my-span", attributes={"key": "value"}) as span:
    try:
        do_work()
    except Exception as e:
        from opentelemetry.trace import StatusCode
        span.set_status(StatusCode.ERROR, str(e))
        span.record_exception(e)
        raise
```

---

*See also: [[cloud-monitoring-metrics|Cloud Monitoring]] | [[cloud-monitoring-metrics|custom metrics]] | [[observability-index]] | [[firestore-data-model-and-operations|Firestore state store]]*
