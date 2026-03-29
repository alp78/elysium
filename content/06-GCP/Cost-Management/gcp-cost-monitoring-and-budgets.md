---
type: reference
category: gcp
technology:
  - gcp
  - bigquery
  - python
  - bash
tags: [observability, cost, infrastructure, python, bash, bigquery, gcp, billing]
aliases:
  - cost monitoring
  - budget alerts
  - billing export
  - cost anomaly
  - FinOps
  - cost optimization
  - right-sizing
  - idle resources
  - committed use
  - reserved capacity
keywords:
  - gcp billing export
  - bigquery billing dataset
  - budget alert threshold
  - pub/sub billing notification
  - cloud function auto-shutdown
  - cost anomaly detection
  - right-sizing recommender
  - committed use discounts
  - preemptible vm
  - spot vm
  - bigquery partitioning cost
  - bigquery clustering
  - storage lifecycle policy
  - nearline coldline archive
  - cloud run scale to zero
  - pub/sub lite
  - cloud logging exclusion
  - log sink gcs
  - cloud nat cost
  - firestore batch writes
  - idle vm detection
  - unattached persistent disk
  - unused static ip
  - looker studio billing dashboard
  - terraform budget resource
  - finops gcp
  - cost per pipeline
  - monthly spend projection
  - byte quota bigquery
  - materialized view bigquery
description: >
  Operational FinOps reference for GCP — covers billing export to BigQuery,
  budget alerts with Pub/Sub automation, cost anomaly detection, per-service
  optimization strategies, weekly review checklists, dashboard SQL, and
  Terraform cost controls. No project-specific references.
related:
  - "[[gcp-index]]"
  - "[[dataset-and-table-management|BigQuery]]"
  - "[[cloud-logging]]"
  - "[[service-accounts-and-iam|IAM and security]]"
  - "[[vm-lifecycle|Compute Engine]]"
  - "[[cloud-run-jobs-vs-services]]"
  - "[[gcs-buckets-and-lifecycle|Cloud Storage]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# GCP Cost Monitoring and Budgets

> Operational FinOps for GCP. Covers the full stack: export billing data, alert on budgets, detect anomalies, optimize per service, and automate enforcement.

---

## Setting Up Billing Export to BigQuery

Billing export is the foundation of all cost analysis on GCP. Without it, you are flying blind — the billing console only shows aggregated data with limited filtering.

### Enable the Billing Export

Billing export is configured at the billing account level, not the project level.

```bash
# List billing accounts to get the account ID
gcloud billing accounts list

# Enable BigQuery export — do this in the console or via Terraform
# gcloud does not have a direct command for enabling export;
# use the Billing console: Billing > Billing export > BigQuery export
# Or use the Terraform resource: google_billing_account_bucket_config (see Terraform section)
```

You need two roles:
- `roles/billing.admin` on the billing account
- `roles/bigquery.dataEditor` on the destination dataset

### Create the Destination Dataset

```bash
# Create the dataset that will receive billing data
bq mk \
  --dataset \
  --location=US \
  --description="GCP billing export" \
  PROJECT_ID:billing_export

# Verify
bq ls --datasets PROJECT_ID
```

### Standard vs Detailed Export

| Export type | Table name suffix | Granularity | Use case |
|---|---|---|---|
| Standard | `gcp_billing_export_v1_XXXXXX` | Resource-level daily | General cost tracking |
| Detailed usage cost | `gcp_billing_export_resource_v1_XXXXXX` | SKU + resource ID | Attribution and right-sizing |
| Pricing | `cloud_pricing_export` | SKU pricing data | Build cost calculators |

Enable **detailed usage cost export** if you want resource-level attribution (e.g., per-VM, per-disk costs). It is more expensive in terms of rows but essential for serious FinOps work.

> [!warning] Export Lag
> Billing data typically lags by 24–48 hours. Do not alert on same-day data for critical decisions. Use a 2-day buffer in time-sensitive queries.

### Key Columns in the Export Table

```sql
-- Schema reference for gcp_billing_export_v1_*
-- billing_account_id       STRING    Billing account
-- service.description      STRING    GCP service name (e.g., "BigQuery", "Compute Engine")
-- sku.description          STRING    SKU name (e.g., "N1 Predefined Instance Core")
-- usage_start_time         TIMESTAMP Start of usage period
-- usage_end_time           TIMESTAMP End of usage period
-- project.id               STRING    Project ID
-- project.name             STRING    Project name
-- labels                   ARRAY     Resource labels as key-value pairs
-- resource.name            STRING    Resource identifier (detailed export only)
-- location.region          STRING    Region (e.g., "us-central1")
-- cost                     FLOAT64   Cost in billing currency after credits
-- credits                  ARRAY     Promotions, SUDs, CUDs applied
-- usage.amount             FLOAT64   Usage quantity
-- usage.unit               STRING    Usage unit (e.g., "byte-seconds", "seconds")
-- currency                 STRING    Billing currency code
-- invoice.month            STRING    Invoice month (YYYYMM)
-- cost_type                STRING    regular | tax | adjustment | rounding_error
```

### Example Queries

#### BigQuery billing export — cost by service, current month

```sql
SELECT
  service.description AS service,
  ROUND(SUM(cost), 2) AS total_cost,
  ROUND(SUM(cost) / SUM(SUM(cost)) OVER () * 100, 1) AS pct_of_total
FROM `PROJECT_ID.billing_export.gcp_billing_export_v1_XXXXXX`
WHERE
  invoice.month = FORMAT_DATE('%Y%m', CURRENT_DATE())
  AND cost_type = 'regular'
GROUP BY service
ORDER BY total_cost DESC;
```

#### BigQuery billing export — cost by label (team, pipeline)

```sql
SELECT
  (SELECT value FROM UNNEST(labels) WHERE key = 'team') AS team,
  ROUND(SUM(cost), 2) AS total_cost
FROM `PROJECT_ID.billing_export.gcp_billing_export_v1_XXXXXX`
WHERE
  invoice.month = FORMAT_DATE('%Y%m', CURRENT_DATE())
  AND cost_type = 'regular'
GROUP BY team
ORDER BY total_cost DESC;
```

#### BigQuery billing export — cost by project, current month

```sql
SELECT
  project.id AS project_id,
  project.name AS project_name,
  ROUND(SUM(cost), 2) AS total_cost
FROM `PROJECT_ID.billing_export.gcp_billing_export_v1_XXXXXX`
WHERE
  invoice.month = FORMAT_DATE('%Y%m', CURRENT_DATE())
  AND cost_type = 'regular'
GROUP BY project_id, project_name
ORDER BY total_cost DESC;
```

#### BigQuery billing export — daily spend trend, last 30 days

```sql
SELECT
  DATE(usage_start_time) AS usage_date,
  ROUND(SUM(cost), 2) AS daily_cost
FROM `PROJECT_ID.billing_export.gcp_billing_export_v1_XXXXXX`
WHERE
  usage_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
  AND cost_type = 'regular'
GROUP BY usage_date
ORDER BY usage_date;
```

#### BigQuery billing export — cost by SKU (find surprise line items)

```sql
SELECT
  service.description AS service,
  sku.description AS sku,
  location.region AS region,
  ROUND(SUM(cost), 2) AS total_cost,
  ROUND(SUM(usage.amount), 2) AS total_usage,
  usage.unit AS unit
FROM `PROJECT_ID.billing_export.gcp_billing_export_v1_XXXXXX`
WHERE
  invoice.month = FORMAT_DATE('%Y%m', CURRENT_DATE())
  AND cost_type = 'regular'
  AND cost > 0
GROUP BY service, sku, region, unit
ORDER BY total_cost DESC
LIMIT 50;
```

> [!tip] Partition Your Queries
> The billing export table is partitioned on `usage_start_time`. Always filter on this column (not `usage_end_time`) to avoid full table scans. A 30-day query on a busy account can easily scan 10+ GB without a partition filter.

---

## Budget Alerts

Budgets in GCP are attached to billing accounts and can scope to specific projects, services, or labels.

### Create a Budget via gcloud

```bash
# Basic budget with threshold alerts
gcloud billing budgets create \
  --billing-account=ACCOUNT_ID \
  --display-name="Data Platform Monthly" \
  --budget-amount=500USD \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=80 \
  --threshold-rule=percent=100 \
  --notifications-pubsub-topic=projects/PROJECT_ID/topics/billing-alerts

# Budget scoped to specific projects
gcloud billing budgets create \
  --billing-account=ACCOUNT_ID \
  --display-name="Production Projects Budget" \
  --budget-amount=1000USD \
  --projects=projects/PROJECT_ID_1,projects/PROJECT_ID_2 \
  --threshold-rule=percent=80 \
  --threshold-rule=percent=100 \
  --notifications-pubsub-topic=projects/PROJECT_ID/topics/billing-alerts

# Budget scoped to a specific service (BigQuery only)
gcloud billing budgets create \
  --billing-account=ACCOUNT_ID \
  --display-name="BigQuery Budget" \
  --budget-amount=200USD \
  --filter-services=services/95FF-2EF5-5EA1 \
  --threshold-rule=percent=90 \
  --notifications-pubsub-topic=projects/PROJECT_ID/topics/billing-alerts

# List existing budgets
gcloud billing budgets list --billing-account=ACCOUNT_ID

# Describe a budget
gcloud billing budgets describe BUDGET_ID --billing-account=ACCOUNT_ID

# Delete a budget
gcloud billing budgets delete BUDGET_ID --billing-account=ACCOUNT_ID
```

> [!warning] Budget Alert Lag
> Budget alerts are based on spend data that can lag up to 24 hours. A 100% alert does not mean spending stops — charges continue to accrue. Use budget alerts as early warning signals, not hard cutoffs.

### Budget Alert → Pub/Sub → Cloud Function

The full automation pattern: budget fires a Pub/Sub message, Cloud Function reacts.

**Step 1: Create the Pub/Sub topic**

```bash
gcloud pubsub topics create billing-alerts --project=PROJECT_ID

# Grant the Billing service account permission to publish
gcloud pubsub topics add-iam-policy-binding billing-alerts \
  --member=serviceAccount:billing-alerts@system.gserviceaccount.com \
  --role=roles/pubsub.publisher \
  --project=PROJECT_ID
```

**Step 2: Cloud Function — Auto-shutdown VMs on budget exceeded**

```python
# main.py — Cloud Function triggered by Pub/Sub billing alert
import base64
import json
import googleapiclient.discovery
from google.cloud import compute_v1


def stop_vms_on_budget_exceeded(event, context):
    """Stop all non-critical VMs when budget threshold is exceeded."""

    # Decode the Pub/Sub message
    pubsub_data = base64.b64decode(event['data']).decode('utf-8')
    budget_data = json.loads(pubsub_data)

    cost_amount = budget_data.get('costAmount', 0)
    budget_amount = budget_data.get('budgetAmount', 0)

    # Only act at 100% threshold
    if cost_amount < budget_amount:
        print(f"Spend {cost_amount} < budget {budget_amount}. No action.")
        return

    print(f"Budget exceeded: {cost_amount} / {budget_amount}. Stopping VMs.")

    compute = compute_v1.InstancesClient()
    zones_client = compute_v1.ZonesClient()

    project = "YOUR_PROJECT_ID"  # or read from env var

    # List all zones
    for zone in zones_client.list(project=project):
        zone_name = zone.name

        # List instances in zone
        for instance in compute.list(project=project, zone=zone_name):
            # Skip instances tagged as critical
            labels = instance.labels or {}
            if labels.get('auto-shutdown') == 'false':
                print(f"Skipping {instance.name} (auto-shutdown=false)")
                continue

            if instance.status == 'RUNNING':
                print(f"Stopping {instance.name} in {zone_name}")
                compute.stop(
                    project=project,
                    zone=zone_name,
                    instance=instance.name
                )
```

```bash
# Deploy the Cloud Function
gcloud functions deploy stop-vms-on-budget \
  --runtime=python311 \
  --trigger-topic=billing-alerts \
  --entry-point=stop_vms_on_budget_exceeded \
  --region=us-central1 \
  --service-account=budget-enforcer@PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars=PROJECT_ID=PROJECT_ID

# Required IAM for the service account
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member=serviceAccount:budget-enforcer@PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/compute.instanceAdmin.v1
```

### Multiple Budget Strategy

| Budget scope | Threshold | Action |
|---|---|---|
| Per billing account | 80%, 100% | Email alert + Slack |
| Per production project | 90%, 100% | Email + auto-shutdown |
| Per team (via labels) | 80% | Email team lead |
| BigQuery only | 80% | Disable on-demand slots |
| Dev/staging environment | 50% | Auto-shutdown non-prod VMs |

```bash
# Label-based budget (e.g., for a specific team)
# Note: label-based budgets require the Billing API; use Terraform for this
# See Terraform section for the resource definition
```

---

## Cost Anomaly Detection

Automated anomaly detection catches runaway jobs, misconfigured resources, and unexpected usage spikes before they appear on the invoice.

### BigQuery SQL: Detect Spend Anomalies

```sql
-- Daily spend vs 7-day rolling average
-- Flag days where spend is more than 2x the average
WITH daily_spend AS (
  SELECT
    DATE(usage_start_time) AS usage_date,
    service.description AS service,
    SUM(cost) AS daily_cost
  FROM `PROJECT_ID.billing_export.gcp_billing_export_v1_XXXXXX`
  WHERE
    usage_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
    AND cost_type = 'regular'
  GROUP BY usage_date, service
),
rolling_avg AS (
  SELECT
    usage_date,
    service,
    daily_cost,
    AVG(daily_cost) OVER (
      PARTITION BY service
      ORDER BY usage_date
      ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING
    ) AS seven_day_avg
  FROM daily_spend
)
SELECT
  usage_date,
  service,
  ROUND(daily_cost, 2) AS daily_cost,
  ROUND(seven_day_avg, 2) AS seven_day_avg,
  ROUND(daily_cost / NULLIF(seven_day_avg, 0), 2) AS ratio,
  CASE
    WHEN daily_cost > seven_day_avg * 2 THEN 'ANOMALY'
    WHEN daily_cost > seven_day_avg * 1.5 THEN 'ELEVATED'
    ELSE 'NORMAL'
  END AS status
FROM rolling_avg
WHERE
  usage_date = DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
  AND seven_day_avg > 1  -- ignore near-zero baseline
ORDER BY ratio DESC;
```

### Python Script: Automated Anomaly Detection and Alerting

```python
#!/usr/bin/env python3
"""
gcp_cost_anomaly.py
Run daily (Cloud Scheduler → Cloud Run job or Cloud Function).
Queries billing export, detects anomalies, sends Slack/email alerts.
"""

import os
from datetime import date, timedelta
from google.cloud import bigquery
import requests


BILLING_TABLE = os.environ["BILLING_TABLE"]  # PROJECT.dataset.table
SLACK_WEBHOOK = os.environ.get("SLACK_WEBHOOK_URL")
ANOMALY_RATIO_THRESHOLD = float(os.environ.get("ANOMALY_THRESHOLD", "2.0"))
MIN_BASELINE_COST = float(os.environ.get("MIN_BASELINE_COST", "5.0"))


ANOMALY_QUERY = """
WITH daily_spend AS (
  SELECT
    DATE(usage_start_time) AS usage_date,
    service.description AS service,
    SUM(cost) AS daily_cost
  FROM `{table}`
  WHERE
    usage_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
    AND cost_type = 'regular'
  GROUP BY usage_date, service
),
rolling_avg AS (
  SELECT
    usage_date,
    service,
    daily_cost,
    AVG(daily_cost) OVER (
      PARTITION BY service
      ORDER BY usage_date
      ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING
    ) AS seven_day_avg
  FROM daily_spend
)
SELECT
  usage_date,
  service,
  ROUND(daily_cost, 2) AS daily_cost,
  ROUND(seven_day_avg, 2) AS seven_day_avg,
  ROUND(daily_cost / NULLIF(seven_day_avg, 0), 2) AS ratio
FROM rolling_avg
WHERE
  usage_date = DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
  AND seven_day_avg > {min_baseline}
  AND daily_cost > seven_day_avg * {threshold}
ORDER BY ratio DESC
""".format(
    table=BILLING_TABLE,
    min_baseline=MIN_BASELINE_COST,
    threshold=ANOMALY_RATIO_THRESHOLD,
)


def detect_anomalies():
    client = bigquery.Client()
    results = client.query(ANOMALY_QUERY).result()
    anomalies = [dict(row) for row in results]
    return anomalies


def send_slack_alert(anomalies: list[dict]):
    if not SLACK_WEBHOOK or not anomalies:
        return

    lines = [f"*GCP Cost Anomaly Alert* — {date.today() - timedelta(days=1)}"]
    for a in anomalies:
        lines.append(
            f"• *{a['service']}*: ${a['daily_cost']:.2f} vs "
            f"${a['seven_day_avg']:.2f} avg ({a['ratio']:.1f}x)"
        )

    payload = {"text": "\n".join(lines)}
    resp = requests.post(SLACK_WEBHOOK, json=payload, timeout=10)
    resp.raise_for_status()


def main():
    anomalies = detect_anomalies()
    if anomalies:
        print(f"Found {len(anomalies)} anomalies:")
        for a in anomalies:
            print(f"  {a['service']}: {a['ratio']}x above baseline")
        send_slack_alert(anomalies)
    else:
        print("No anomalies detected.")


if __name__ == "__main__":
    main()
```

### Cloud Monitoring Custom Metric for Daily Spend

```python
# Write daily spend as a custom metric for Cloud Monitoring dashboards and alerts
from google.cloud import monitoring_v3
from google.cloud import bigquery
import time

def write_daily_spend_metric(project_id: str, cost: float, service: str):
    client = monitoring_v3.MetricServiceClient()
    project_name = f"projects/{project_id}"

    series = monitoring_v3.TimeSeries()
    series.metric.type = "custom.googleapis.com/billing/daily_spend"
    series.metric.labels["service"] = service
    series.resource.type = "global"
    series.resource.labels["project_id"] = project_id

    now = time.time()
    interval = monitoring_v3.TimeInterval(
        {"end_time": {"seconds": int(now), "nanos": 0}}
    )
    point = monitoring_v3.Point(
        {"interval": interval, "value": {"double_value": cost}}
    )
    series.points = [point]

    client.create_time_series(name=project_name, time_series=[series])
    print(f"Written metric: {service} = ${cost:.2f}")
```

---

## Cost Optimization Strategies

### Compute Engine

#### Right-Sizing with GCP Recommender

```bash
# List machine type recommendations for a specific zone
gcloud recommender recommendations list \
  --recommender=google.compute.instance.MachineTypeRecommender \
  --location=us-central1-a \
  --project=PROJECT_ID \
  --format="table(name,stateInfo.state,primaryImpact.costProjection.cost.units)"

# List idle VM recommendations
gcloud recommender recommendations list \
  --recommender=google.compute.instance.IdleResourceRecommender \
  --location=us-central1-a \
  --project=PROJECT_ID

# Apply a right-sizing recommendation
gcloud recommender recommendations mark-claimed \
  RECOMMENDATION_ID \
  --recommender=google.compute.instance.MachineTypeRecommender \
  --location=us-central1-a \
  --project=PROJECT_ID \
  --etag=ETAG
```

#### Schedule VM Shutdown with Cloud Scheduler

```bash
# Create a service account for the scheduler
gcloud iam service-accounts create vm-scheduler \
  --display-name="VM Scheduler"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member=serviceAccount:vm-scheduler@PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/compute.instanceAdmin.v1

# Stop VMs at 8 PM weekdays (UTC)
gcloud scheduler jobs create http stop-dev-vms \
  --schedule="0 20 * * 1-5" \
  --uri="https://compute.googleapis.com/compute/v1/projects/PROJECT_ID/zones/ZONE/instances/INSTANCE_NAME/stop" \
  --http-method=POST \
  --oauth-service-account-email=vm-scheduler@PROJECT_ID.iam.gserviceaccount.com \
  --location=us-central1

# Start VMs at 7 AM weekdays (UTC)
gcloud scheduler jobs create http start-dev-vms \
  --schedule="0 7 * * 1-5" \
  --uri="https://compute.googleapis.com/compute/v1/projects/PROJECT_ID/zones/ZONE/instances/INSTANCE_NAME/start" \
  --http-method=POST \
  --oauth-service-account-email=vm-scheduler@PROJECT_ID.iam.gserviceaccount.com \
  --location=us-central1
```

> [!warning] Spot VM Gotcha
> Spot VMs can be preempted with 30 seconds notice. Never run stateful workloads or anything that cannot checkpoint. Use them for: batch ETL, ML training jobs, CI/CD workers, and parallelizable data processing.

#### Committed Use Discounts

```bash
# Purchase a 1-year CUD for n2 vCPUs in us-central1
gcloud compute commitments create my-commitment \
  --plan=12-month \
  --region=us-central1 \
  --resources=vcpu=10,memory=40GB \
  --type=GENERAL_PURPOSE

# List existing commitments
gcloud compute commitments list --region=us-central1

# Describe a commitment
gcloud compute commitments describe my-commitment --region=us-central1
```

| Discount type | Commitment | Discount |
|---|---|---|
| Sustained Use Discount (SUD) | Automatic | Up to 30% for N1 |
| Committed Use Discount 1yr | 1-year commit | ~37% |
| Committed Use Discount 3yr | 3-year commit | ~55% |
| Spot VM | No commit, preemptible | 60–91% |

> [!tip] Custom Machine Types
> When a standard machine type has more RAM or vCPU than you need, create a custom machine type. Example: instead of n2-standard-8 (8 vCPU, 32 GB), use `n2-custom-6-24576` (6 vCPU, 24 GB). Pay only for what you configure.

```bash
# Create a VM with a custom machine type
gcloud compute instances create my-instance \
  --machine-type=n2-custom-6-24576 \
  --zone=us-central1-a
```

---

### BigQuery

> [!warning] On-Demand Cost Trap
> On-demand BigQuery pricing charges per byte scanned. A single `SELECT *` on a 10 TB table costs ~$50. Enforce partition filters and use `--dry_run` before running unfamiliar queries.

#### Partition and Cluster Tables

```sql
-- Create a partitioned and clustered table
CREATE TABLE `PROJECT_ID.dataset.events`
PARTITION BY DATE(event_timestamp)
CLUSTER BY user_id, event_type
OPTIONS (
  partition_expiration_days = 365,
  require_partition_filter = TRUE
)
AS SELECT * FROM source_table;
```

```bash
# Enable partition filter requirement on existing table
bq update \
  --require_partition_filter=true \
  PROJECT_ID:dataset.events
```

#### Dry Run Before Expensive Queries

```bash
# Estimate bytes scanned before running
bq query \
  --dry_run \
  --use_legacy_sql=false \
  'SELECT * FROM `PROJECT_ID.dataset.events` WHERE DATE(event_timestamp) = "2026-01-01"'
# Output: Query successfully validated. Assuming the tables are not modified,
# running this query will process 1234567890 bytes of data.

# Script to abort if query exceeds a byte limit
BYTES_LIMIT=10737418240  # 10 GB
BYTES=$(bq query --dry_run --use_legacy_sql=false "$QUERY" 2>&1 | grep -oP '\d+ bytes')
if [ "$BYTES" -gt "$BYTES_LIMIT" ]; then
  echo "Query would scan $(numfmt --to=iec $BYTES). Aborting."
  exit 1
fi
```

#### Set Per-User and Per-Project Byte Quotas

```bash
# Create a capacity commitment (BigQuery editions)
gcloud alpha bq reservations capacity-commitments create \
  --location=us-central1 \
  --slot-count=100 \
  --plan=FLEX \
  --project=PROJECT_ID

# Set a custom quota for on-demand bytes processed per day (via Quota API)
# Navigate to: IAM & Admin > Quotas > "Query usage per day per user"
# Or use the gcloud quotas command (preview):
gcloud quotas info --service=bigquery.googleapis.com --project=PROJECT_ID
```

#### Materialized Views for Repeated Queries

```sql
-- Create a materialized view to cache expensive aggregations
CREATE MATERIALIZED VIEW `PROJECT_ID.dataset.daily_revenue_mv`
PARTITION BY report_date
OPTIONS (enable_refresh = TRUE, refresh_interval_minutes = 60)
AS
SELECT
  DATE(order_timestamp) AS report_date,
  product_category,
  COUNT(*) AS order_count,
  SUM(revenue_usd) AS total_revenue
FROM `PROJECT_ID.dataset.orders`
GROUP BY report_date, product_category;
```

---

### Cloud Storage

#### Lifecycle Policies

```bash
# Update a bucket with a lifecycle config file
gcloud storage buckets update gs://BUCKET_NAME \
  --lifecycle-file=lifecycle.json

# View current lifecycle config
gcloud storage buckets describe gs://BUCKET_NAME \
  --format="value(lifecycle)"
```

#### lifecycle.json — full GCS tiering: Nearline → Coldline → Archive → Delete

```json
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "SetStorageClass", "storageClass": "NEARLINE"},
        "condition": {"age": 30, "matchesStorageClass": ["STANDARD"]}
      },
      {
        "action": {"type": "SetStorageClass", "storageClass": "COLDLINE"},
        "condition": {"age": 90, "matchesStorageClass": ["NEARLINE"]}
      },
      {
        "action": {"type": "SetStorageClass", "storageClass": "ARCHIVE"},
        "condition": {"age": 365, "matchesStorageClass": ["COLDLINE"]}
      },
      {
        "action": {"type": "Delete"},
        "condition": {"age": 1825}
      },
      {
        "action": {"type": "AbortIncompleteMultipartUpload"},
        "condition": {"age": 7}
      }
    ]
  }
}
```

> [!warning] Early Deletion Fees
> Nearline has a 30-day minimum storage duration. Coldline: 90 days. Archive: 365 days. If you delete or transition early, you still pay for the minimum. Design lifecycle rules so objects stay in each class at least as long as the minimum.

```bash
# Find buckets without lifecycle policies
gcloud storage ls --project=PROJECT_ID | while read bucket; do
  policy=$(gcloud storage buckets describe "$bucket" --format="value(lifecycle)" 2>/dev/null)
  if [ -z "$policy" ]; then
    echo "No lifecycle: $bucket"
  fi
done

# Estimate cost of objects by storage class
gcloud storage ls --recursive --long gs://BUCKET_NAME | \
  awk '{sum[$4] += $1; count[$4]++} END {for (c in sum) print c, count[c], sum[c]}'
```

#### GCS storage class pricing — Standard, Nearline, Coldline, Archive rates

| Class | Storage/GB/month | Retrieval/GB | Min duration |
|---|---|---|---|
| Standard | $0.020 | $0 | None |
| Nearline | $0.010 | $0.01 | 30 days |
| Coldline | $0.004 | $0.02 | 90 days |
| Archive | $0.0012 | $0.05 | 365 days |

---

### Cloud Run

```bash
# Scale to zero for batch jobs (no min instances)
gcloud run services update SERVICE_NAME \
  --min-instances=0 \
  --max-instances=10 \
  --region=us-central1

# Right-size CPU and memory
gcloud run services update SERVICE_NAME \
  --cpu=0.5 \
  --memory=512Mi \
  --region=us-central1

# CPU-only allocation (not always-on) — cheaper for batch
gcloud run services update SERVICE_NAME \
  --no-cpu-throttling=false \
  --region=us-central1
# Note: --no-cpu-throttling means CPU is only allocated during request processing
# Default is throttled (cheaper). Always-on (--no-cpu-throttling) costs more.

# For Cloud Run Jobs: set parallelism to control concurrent cost
gcloud run jobs update JOB_NAME \
  --parallelism=5 \
  --region=us-central1
```

> [!tip] Cloud Run vs Cloud Functions Cost
> Cloud Run bills per 100ms of CPU+memory allocation. Cloud Functions Gen2 runs on Cloud Run under the hood. For jobs that run infrequently and complete quickly, Cloud Run Jobs with `min-instances=0` is almost free — you only pay during execution.

---

### Pub/Sub

```bash
# Use Pub/Sub Lite for high-volume, cost-sensitive workloads
# Pub/Sub Lite is ~10x cheaper but requires reserved capacity and is zonal

# Create a Pub/Sub Lite topic
gcloud pubsub lite-topics create my-lite-topic \
  --location=us-central1 \
  --partitions=1 \
  --per-partition-publish-mib=1 \
  --per-partition-subscribe-mib=2

# Set retention to minimum needed (reduces storage cost)
gcloud pubsub subscriptions modify-config SUBSCRIPTION_NAME \
  --message-retention-duration=1d
```

#### Pub/Sub vs Pub/Sub Lite — feature and cost comparison

| Feature | Pub/Sub | Pub/Sub Lite |
|---|---|---|
| Pricing model | Per message + throughput | Reserved capacity |
| Zonal/Regional | Regional | Zonal |
| Ordering | At-subscription level | Partition-level |
| Break-even | < 5 GB/day throughput | > 5 GB/day throughput |
| Management | Zero | Partition sizing required |

---

### Cloud Logging

> [!warning] Logging Cost Trap
> Cloud Logging charges $0.01/GB for ingestion beyond the free tier (first 50 GB/project/month are free). A verbose application logging at DEBUG level can easily exceed 100 GB/month. Always exclude DEBUG in production.

#### Exclude Debug Logs

```bash
# Add an exclusion to the _Default sink to drop DEBUG and lower
gcloud logging sinks update _Default \
  --add-exclusion="name=exclude-debug,filter=severity<=DEBUG"

# Verify the exclusion was applied
gcloud logging sinks describe _Default

# Exclude a specific noisy logger entirely
gcloud logging sinks update _Default \
  --add-exclusion='name=exclude-healthcheck,filter=httpRequest.requestUrl="/health"'

# List all exclusions on the default sink
gcloud logging sinks describe _Default --format="json" | \
  python3 -c "import json,sys; [print(e['name'], e['filter']) for e in json.load(sys.stdin).get('exclusions', [])]"
```

#### Route Old Logs to GCS (Cheaper Retention)

```bash
# Create a GCS sink for long-term retention
gcloud logging sinks create long-term-logs-sink \
  storage.googleapis.com/BUCKET_NAME \
  --log-filter='timestamp < "2026-01-01T00:00:00Z"' \
  --project=PROJECT_ID

# Grant the sink's writer identity access to the bucket
WRITER=$(gcloud logging sinks describe long-term-logs-sink \
  --format="value(writerIdentity)")
gcloud storage buckets add-iam-policy-binding gs://BUCKET_NAME \
  --member="$WRITER" \
  --role=roles/storage.objectCreator
```

#### Set Custom Retention per Log Bucket

```bash
# Default _Default bucket has 30-day retention (free)
# Create a custom bucket with shorter retention for noisy logs
gcloud logging buckets create short-retention-logs \
  --location=global \
  --retention-days=7 \
  --project=PROJECT_ID

# Update retention on existing bucket
gcloud logging buckets update _Default \
  --location=global \
  --retention-days=14 \
  --project=PROJECT_ID
```

#### Cloud Logging cost reference — ingestion, storage, routing rates

| Tier | Cost |
|---|---|
| First 50 GB/project/month | Free |
| Above 50 GB | $0.01/GB ingestion |
| Storage beyond 30 days | $0.01/GB/month |
| GCS archive (via sink) | ~$0.004/GB/month (Coldline) |

---

### Cloud NAT

```bash
# Check if NAT is being used (look for egress to internet from VMs)
gcloud compute routers nats list \
  --router=ROUTER_NAME \
  --region=us-central1 \
  --project=PROJECT_ID

# Delete NAT if VMs only need to reach GCP APIs
gcloud compute routers nats delete NAT_NAME \
  --router=ROUTER_NAME \
  --region=us-central1

# Enable Private Google Access instead (free, no NAT needed for GCP APIs)
gcloud compute networks subnets update SUBNET_NAME \
  --region=us-central1 \
  --enable-private-ip-google-access
```

> [!tip] Private Google Access
> Enabling Private Google Access on a subnet allows VMs without external IPs to reach GCP APIs (BigQuery, GCS, Pub/Sub, etc.) without NAT. This eliminates NAT gateway costs for GCP-internal traffic.

---

### Firestore

```bash
# Firestore cost is primarily driven by reads, writes, and storage
# Reads: $0.06 per 100K; Writes: $0.18 per 100K; Storage: $0.108/GB/month

# No direct gcloud cost commands — optimize in application code
```

#### Application-level optimizations — batch queries, connection pooling, caching

```python
from google.cloud import firestore
from functools import lru_cache
from datetime import datetime, timedelta
from typing import Any


# Pattern 1: In-memory TTL cache to reduce reads
_cache: dict[str, tuple[Any, datetime]] = {}
CACHE_TTL = timedelta(minutes=5)


def get_config(key: str) -> Any:
    if key in _cache:
        value, expiry = _cache[key]
        if datetime.utcnow() < expiry:
            return value

    db = firestore.Client()
    doc = db.collection("config").document(key).get()
    value = doc.to_dict()
    _cache[key] = (value, datetime.utcnow() + CACHE_TTL)
    return value


# Pattern 2: Batch writes (500 ops per batch)
def batch_write_events(events: list[dict]):
    db = firestore.Client()
    batch = db.batch()

    for i, event in enumerate(events):
        if i > 0 and i % 500 == 0:
            batch.commit()
            batch = db.batch()

        ref = db.collection("events").document()
        batch.set(ref, event)

    batch.commit()


# Pattern 3: Limit fields returned (reduces read bandwidth billing)
def get_user_summary(user_id: str) -> dict:
    db = firestore.Client()
    doc = db.collection("users").document(user_id).get(
        field_paths=["name", "email", "plan"]  # don't fetch large nested fields
    )
    return doc.to_dict()
```

---

## Weekly Cost Review Checklist

Run this every Monday against the previous week's data.

- [ ] Check billing dashboard: any unexpected spikes vs last week?
- [ ] Review Recommender suggestions (right-sizing, idle resources)
- [ ] Check for idle VMs (running but zero CPU utilization for 7+ days)
- [ ] Check for unattached persistent disks (cost money even when VM is stopped)
- [ ] Check for unused static IP addresses ($0.010/hour = $7.20/month each)
- [ ] Review BigQuery slot utilization or bytes scanned (any rogue queries?)
- [ ] Check Cloud Logging ingestion volume vs previous week
- [ ] Verify lifecycle policies on GCS buckets (any new buckets without policies?)
- [ ] Review Cloud NAT gateway usage (any unexpected egress?)
- [ ] Check for unused Artifact Registry images consuming storage
- [ ] Review any new services added this week (do they have cost controls?)

```bash
# Find unattached persistent disks
gcloud compute disks list \
  --filter="NOT users:*" \
  --format="table(name,zone,sizeGb,type,status)" \
  --project=PROJECT_ID

# Find unused static IPs (reserved but not attached)
gcloud compute addresses list \
  --filter="status=RESERVED" \
  --format="table(name,address,region,status)" \
  --project=PROJECT_ID

# Release an unused static IP
gcloud compute addresses delete ADDRESS_NAME --region=REGION

# Find VMs with low CPU utilization (use Cloud Monitoring)
gcloud monitoring metrics list --filter="metric.type=compute.googleapis.com/instance/cpu/utilization"
# Then query via Cloud Monitoring API or BigQuery metrics export for 7-day averages
```

---

## Cost Dashboard in BigQuery

A complete set of SQL views for a billing dashboard. Connect these to Looker Studio or Grafana.

### BigQuery Cost Dashboard — Daily Spend by Service

```sql
CREATE OR REPLACE VIEW `PROJECT_ID.billing_export.v_daily_spend_by_service` AS
SELECT
  DATE(usage_start_time) AS usage_date,
  service.description AS service,
  ROUND(SUM(cost), 2) AS daily_cost,
  ROUND(SUM(
    (SELECT SUM(c.amount) FROM UNNEST(credits) AS c)
  ), 2) AS total_credits
FROM `PROJECT_ID.billing_export.gcp_billing_export_v1_XXXXXX`
WHERE cost_type = 'regular'
GROUP BY usage_date, service;
```

### BigQuery Cost Dashboard — Month-over-Month Comparison

```sql
CREATE OR REPLACE VIEW `PROJECT_ID.billing_export.v_mom_comparison` AS
WITH monthly AS (
  SELECT
    invoice.month AS invoice_month,
    service.description AS service,
    ROUND(SUM(cost), 2) AS monthly_cost
  FROM `PROJECT_ID.billing_export.gcp_billing_export_v1_XXXXXX`
  WHERE cost_type = 'regular'
  GROUP BY invoice_month, service
)
SELECT
  curr.invoice_month,
  curr.service,
  curr.monthly_cost AS current_month_cost,
  prev.monthly_cost AS prev_month_cost,
  ROUND(curr.monthly_cost - COALESCE(prev.monthly_cost, 0), 2) AS delta,
  ROUND(
    (curr.monthly_cost - COALESCE(prev.monthly_cost, 0))
    / NULLIF(prev.monthly_cost, 0) * 100, 1
  ) AS pct_change
FROM monthly curr
LEFT JOIN monthly prev
  ON curr.service = prev.service
  AND curr.invoice_month = FORMAT_DATE(
    '%Y%m',
    DATE_ADD(PARSE_DATE('%Y%m', curr.invoice_month), INTERVAL -1 MONTH)
  )
WHERE curr.invoice_month = FORMAT_DATE('%Y%m', CURRENT_DATE())
ORDER BY delta DESC;
```

### BigQuery Cost Dashboard — Top 10 Most Expensive Resources

```sql
CREATE OR REPLACE VIEW `PROJECT_ID.billing_export.v_top_resources` AS
SELECT
  resource.name AS resource_name,
  service.description AS service,
  sku.description AS sku,
  project.id AS project_id,
  location.region AS region,
  ROUND(SUM(cost), 2) AS total_cost
FROM `PROJECT_ID.billing_export.gcp_billing_export_resource_v1_XXXXXX`
WHERE
  invoice.month = FORMAT_DATE('%Y%m', CURRENT_DATE())
  AND cost_type = 'regular'
  AND resource.name IS NOT NULL
GROUP BY resource_name, service, sku, project_id, region
ORDER BY total_cost DESC
LIMIT 10;
```

### BigQuery Cost Dashboard — Cost per Pipeline (via Labels)

```sql
CREATE OR REPLACE VIEW `PROJECT_ID.billing_export.v_cost_per_pipeline` AS
SELECT
  (SELECT value FROM UNNEST(labels) WHERE key = 'pipeline') AS pipeline,
  (SELECT value FROM UNNEST(labels) WHERE key = 'env') AS environment,
  service.description AS service,
  ROUND(SUM(cost), 2) AS total_cost
FROM `PROJECT_ID.billing_export.gcp_billing_export_v1_XXXXXX`
WHERE
  invoice.month = FORMAT_DATE('%Y%m', CURRENT_DATE())
  AND cost_type = 'regular'
  AND EXISTS (SELECT 1 FROM UNNEST(labels) WHERE key = 'pipeline')
GROUP BY pipeline, environment, service
ORDER BY total_cost DESC;
```

### BigQuery Cost Dashboard — Projected Monthly Spend

```sql
CREATE OR REPLACE VIEW `PROJECT_ID.billing_export.v_monthly_projection` AS
WITH current_month AS (
  SELECT
    service.description AS service,
    SUM(cost) AS spend_to_date,
    COUNT(DISTINCT DATE(usage_start_time)) AS days_with_data
  FROM `PROJECT_ID.billing_export.gcp_billing_export_v1_XXXXXX`
  WHERE
    invoice.month = FORMAT_DATE('%Y%m', CURRENT_DATE())
    AND cost_type = 'regular'
  GROUP BY service
),
days_info AS (
  SELECT
    EXTRACT(DAY FROM CURRENT_DATE()) AS days_elapsed,
    EXTRACT(DAY FROM DATE_ADD(
      DATE_TRUNC(CURRENT_DATE(), MONTH),
      INTERVAL 1 MONTH
    ) - 1) AS days_in_month
)
SELECT
  service,
  ROUND(spend_to_date, 2) AS spend_to_date,
  ROUND(
    spend_to_date / NULLIF(days_elapsed, 0) * days_in_month, 2
  ) AS projected_monthly_spend,
  days_elapsed,
  days_in_month
FROM current_month
CROSS JOIN days_info
ORDER BY projected_monthly_spend DESC;
```

### Looker Studio / Grafana Connection

```bash
# Looker Studio: connect via BigQuery connector
# Data source > BigQuery > Project > Dataset > View
# Use v_daily_spend_by_service for time-series charts
# Use v_monthly_projection for a summary scorecard

# Grafana: use BigQuery plugin (grafana-bigquery-datasource)
# Install: grafana-cli plugins install doitintl-bigquery-datasource
# Configure service account with roles/bigquery.dataViewer on the billing dataset
```

---

## Terraform for Cost Controls

### Terraform Cost Controls — Budget Resource

```hcl
# terraform/modules/billing/budget.tf

resource "google_billing_budget" "monthly_budget" {
  billing_account = var.billing_account_id
  display_name    = "${var.budget_name} Monthly Budget"

  budget_filter {
    projects = [for p in var.project_ids : "projects/${p}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(var.budget_amount_usd)
    }
  }

  threshold_rules {
    threshold_percent = 0.5
    spend_basis       = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 0.8
    spend_basis       = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "CURRENT_SPEND"
  }

  all_updates_rule {
    pubsub_topic                     = google_pubsub_topic.billing_alerts.id
    schema_version                   = "1.0"
    monitoring_notification_channels = var.notification_channels
    disable_default_iam_recipients   = false
  }
}

resource "google_pubsub_topic" "billing_alerts" {
  name    = "billing-alerts"
  project = var.project_id

  labels = local.common_labels
}
```

### Terraform Cost Controls — Enforce Labels on All Resources

```hcl
# terraform/modules/labels/variables.tf
variable "required_labels" {
  description = "Labels required on all resources for cost attribution."
  type = object({
    env      = string
    team     = string
    pipeline = optional(string, "none")
  })
}

locals {
  common_labels = {
    env         = var.required_labels.env
    team        = var.required_labels.team
    pipeline    = var.required_labels.pipeline
    managed_by  = "terraform"
    cost_center = var.cost_center
  }
}

# Apply to every resource
resource "google_compute_instance" "worker" {
  # ...
  labels = local.common_labels
}

resource "google_bigquery_dataset" "main" {
  # ...
  labels = local.common_labels
}

resource "google_storage_bucket" "data" {
  # ...
  labels = local.common_labels
}
```

### Terraform Cost Controls — Machine Type Variables (Right-Sizing)

```hcl
# terraform/environments/prod/variables.tf
variable "worker_machine_type" {
  description = "Machine type for worker VMs. Right-size based on Recommender output."
  type        = string
  default     = "n2-standard-4"

  validation {
    condition = can(regex("^(n2|n2d|c2|e2|t2d)-", var.worker_machine_type))
    error_message = "Use modern machine families (n2, n2d, c2, e2, t2d) for best price/performance."
  }
}

variable "worker_disk_size_gb" {
  description = "Boot disk size for worker VMs."
  type        = number
  default     = 50
}

variable "worker_preemptible" {
  description = "Use spot/preemptible instances for workers."
  type        = bool
  default     = false
}

resource "google_compute_instance_template" "worker" {
  machine_type = var.worker_machine_type

  disk {
    disk_size_gb = var.worker_disk_size_gb
    disk_type    = "pd-balanced"
  }

  scheduling {
    preemptible       = var.worker_preemptible
    automatic_restart = var.worker_preemptible ? false : true
  }

  labels = local.common_labels
}
```

### Terraform Cost Controls — Organization Policy to Enforce Labels

```hcl
# Require specific labels on all GCE instances via org policy
resource "google_org_policy_policy" "require_labels" {
  name   = "projects/${var.project_id}/policies/compute.requireShieldedVm"
  parent = "projects/${var.project_id}"

  spec {
    rules {
      enforce = "TRUE"
    }
  }
}

# Better: use gcloud org-policies for label constraints
# gcloud org-policies set-policy label-policy.yaml --project=PROJECT_ID
# where label-policy.yaml defines required label keys
```

```bash
# Audit: find resources missing the 'team' label
gcloud asset search-all-resources \
  --scope=projects/PROJECT_ID \
  --query='NOT labels.team:*' \
  --asset-types='compute.googleapis.com/Instance,storage.googleapis.com/Bucket' \
  --format="table(name,assetType,labels)"
```

---

## Quick Reference: Cost by Service

| Service | Primary cost driver | Key optimization |
|---|---|---|
| Compute Engine | vCPU + RAM hours | Right-size, schedule off-hours, use Spot for batch |
| BigQuery | Bytes scanned (on-demand) | Partition, cluster, dry-run, quotas |
| Cloud Storage | GB-months + retrieval | Lifecycle policies, Coldline for archives |
| Cloud Run | CPU + memory × request time | Scale to zero, right-size allocation |
| Cloud Logging | GB ingested | Exclude debug, route to GCS |
| Cloud NAT | Data processed | Private Google Access for GCP API calls |
| Pub/Sub | Message volume | Pub/Sub Lite for high throughput, compress messages |
| Firestore | Read/write ops | Cache reads, batch writes |
| Artifact Registry | Storage GB | Delete old image tags with lifecycle policy |
| Cloud Scheduler | Job executions | First 3 jobs/month are free; minimal cost |

---

> [!note] FinOps Culture
> Tools and dashboards only work if someone acts on the data. Assign a cost owner per team or service. Include projected spend in sprint planning. Make cost visible in CI/CD (e.g., print BigQuery bytes scanned in the job log). The cheapest infrastructure is the kind your team actually monitors.
