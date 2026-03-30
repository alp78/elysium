---
type: reference
category: gcp
technology:
  - gcp
  - bigquery
  - cloud-run
  - pubsub
  - gcs
  - firestore
  - compute-engine
  - dataflow
tags: [cost, infrastructure, bigquery, gcp, firestore, billing]
aliases:
  - GCP billing
  - GCP pricing
  - GCP costs
  - cloud costs
  - FinOps
  - billing account
  - cost breakdown
  - free tier
  - committed use discounts
  - CUD
  - sustained use discounts
  - SUD
  - on-demand pricing
  - per-TB pricing
  - per-slot pricing
keywords:
  - billing account
  - billing export
  - BigQuery pricing
  - on-demand query cost
  - TB scanned
  - slot pricing
  - editions pricing
  - Compute Engine pricing
  - sustained use discount
  - SUD
  - committed use discount
  - CUD
  - preemptible VM
  - spot VM
  - Cloud Run pricing
  - vCPU-second
  - GB-second
  - Pub/Sub pricing
  - message volume
  - GCS storage classes
  - nearline coldline archive
  - Firestore reads writes deletes
  - Dataflow worker cost
  - shuffle cost
  - Cloud Logging ingestion cost
  - Cloud NAT cost
  - static IP cost
  - free tier limits
  - resource labels cost attribution
  - budget alerts
  - cost optimization
  - right-sizing
  - idle resources
  - billing export dataset
  - INFORMATION_SCHEMA JOBS
  - dry run query
  - per-second billing
  - egress cost
  - long-term storage
description: Definitive reference on how every GCP data engineering service is billed — pricing models, billing dimensions, free tiers, discount mechanisms, cost formulas, and gcloud/BigQuery commands for ongoing cost analysis and optimization.
related:
  - "[[moc-gcp]]"
  - "[[querying-and-cost-optimization]]"
  - "[[dataset-and-table-management]]"
  - "[[vm-lifecycle]]"
  - "[[disks-and-snapshots]]"
  - "[[cloud-run-jobs-vs-services]]"
  - "[[pubsub-messaging]]"
  - "[[gcs-buckets-and-lifecycle]]"
  - "[[firestore-data-model-and-operations]]"
  - "[[cloud-logging]]"
  - "[[gcp-projects-and-apis]]"
  - "[[service-accounts-and-iam]]"
created: 2026-03-22
updated: 2026-03-29
status: complete
---

# GCP Billing and Pricing — Data Engineering Reference

This note is the single source of truth for GCP cost management across every data engineering service. It covers pricing models, billing dimensions, free tiers, discount mechanisms, cost formulas, and practical gcloud / BigQuery commands for ongoing cost analysis.

> [!important] Prices Are Approximate
> All prices shown are approximate list prices for the `us-central1` region as of early 2026. Always verify current prices at [cloud.google.com/pricing](https://cloud.google.com/pricing). Multi-region and European regions are typically 10–30% higher.

---

## GCP Billing Fundamentals

### Billing Hierarchy

```
Organization
└── Billing Account (credit card / invoice)
    ├── Project A  ←── Resources (VMs, BQ datasets, GCS buckets…)
    ├── Project B
    └── Project C
```

- One billing account can fund many projects.
- A project can only be linked to one billing account at a time.
- Resources within a project inherit that project's billing account.
- Charges accumulate at the resource level, roll up to project, then to billing account.

Link or change a project's billing account:

```bash
# List billing accounts you have access to
gcloud billing accounts list

# Link a project to a billing account
gcloud billing projects link PROJECT_ID \
  --billing-account=BILLING_ACCOUNT_ID

# Verify current billing link
gcloud billing projects describe PROJECT_ID
```

### Billing Export to BigQuery (Essential)

> [!tip] Foundation of All Cost Analysis
>
> Enable detailed billing export so you can query your actual spend with SQL. This is a one-time console setup per billing account:
>
> 1. Navigate: **Billing → Billing Export → BigQuery Export → Edit Settings**
> 2. Create a dataset first: `billing_export`
> 3. Set table prefix: `gcp_billing_export_v1`
> 4. Resulting table: `billing_export.gcp_billing_export_v1_XXXXXXXX` (X = billing account digits)

Key columns in the billing export table:

| Column | Description |
|--------|-------------|
| `service.description` | Human-readable service name (e.g., "BigQuery") |
| `sku.description` | Specific SKU (e.g., "Analysis (On Demand)") |
| `usage_start_time` | Billing period start |
| `cost` | USD cost for this line item |
| `usage.amount` | Quantity used |
| `usage.unit` | Unit (bytes, seconds, etc.) |
| `labels` | Resource labels as key-value pairs |
| `project.id` | GCP project |
| `resource.name` | Specific resource identifier |

Query total cost by service for the last 30 days:

```sql
SELECT
  service.description AS service,
  SUM(cost) AS total_cost_usd,
  SUM(cost) / SUM(SUM(cost)) OVER () * 100 AS pct_of_total
FROM `billing_export.gcp_billing_export_v1_XXXXXXXX`
WHERE DATE(_PARTITIONTIME) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY service
ORDER BY total_cost_usd DESC
```

Cost by label (e.g., by `pipeline` label):

```sql
SELECT
  (SELECT value FROM UNNEST(labels) WHERE key = 'pipeline') AS pipeline,
  SUM(cost) AS total_cost_usd
FROM `billing_export.gcp_billing_export_v1_XXXXXXXX`
WHERE DATE(_PARTITIONTIME) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
GROUP BY pipeline
ORDER BY total_cost_usd DESC
```

### Resource Labels for Cost Attribution

Labels are the single most important cost governance tool. Every resource should carry at minimum: `team`, `environment`, and `pipeline`.

```bash
# Label a Compute Engine VM
gcloud compute instances update VM_NAME \
  --update-labels=team=data-platform,env=prod,pipeline=daily-ingest

# Label a GCS bucket
gcloud storage buckets update gs://BUCKET_NAME \
  --update-labels=team=data-platform,env=staging,pipeline=etl

# Label a BigQuery dataset
bq update --set_label team:data-platform --set_label env:prod PROJECT_ID:DATASET

# List all labels on a resource
gcloud compute instances describe VM_NAME --format='get(labels)'
```

> [!warning] Labels Are Not Retroactive
>
> Labels only appear on billing export rows created after the label was applied. Label resources at creation time via IaC (Terraform, etc.) to ensure full coverage.

### Budget Alerts

Set budget alerts before costs spiral. Alerts do not cap spending; they notify.

```bash
# Create a budget via gcloud (requires billing.budgets.create permission)
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="Monthly Data Platform Budget" \
  --budget-amount=5000USD \
  --threshold-rules-percent=0.5 \
  --threshold-rules-percent=0.9 \
  --threshold-rules-percent=1.0 \
  --filter-projects=PROJECT_ID

# List existing budgets
gcloud billing budgets list --billing-account=BILLING_ACCOUNT_ID
```

You can also attach a Pub/Sub topic to a budget to trigger automated cost-control actions (e.g., stop non-critical VMs when 90% threshold is hit).

---

## Pricing for Every GCP Data Engineering Service

---

### Compute Engine (VMs)

**Billing unit:** Per-second (minimum 1 minute)

#### Compute Engine cost formula — vCPU + memory + disk + network

```
Monthly cost =
  ( vCPU_count × vCPU_rate/hr
  + RAM_GB    × RAM_rate/hr  ) × hours_running
  + disk_GB   × disk_rate/GB/month
  + snapshot_GB × $0.050/GB/month (regional)
  + unattached_static_IPs × $0.01/hr
```

#### Machine Type Rates (approximate, us-central1)

| Machine family | vCPU/hour | Memory/GB/hour | Notes |
|----------------|-----------|----------------|-------|
| e2 | $0.03351 | $0.00450 | General purpose, best price/perf for most workloads |
| n2 | $0.04715 | $0.00632 | Higher single-thread perf |
| n2d | $0.03878 | $0.00521 | AMD EPYC, ~17% cheaper than n2 |
| c2 | $0.05200 | $0.00698 | Compute-optimized |
| m1 (memory) | $0.04800 | $0.00732 | Very large RAM workloads |

#### Disk Pricing

| Type | Cost/GB/month | IOPS | Notes |
|------|---------------|------|-------|
| pd-standard (HDD) | $0.040 | Low | Cold data, infrequent access |
| pd-balanced | $0.100 | Medium | General purpose |
| pd-ssd | $0.170 | High | Databases, high-IOPS workloads |
| pd-extreme | $0.125 + IOPS charge | Very High | Needs explicit IOPS provisioning |
| hyperdisk-balanced | varies | High | Newer generation |

Snapshots: **$0.050/GB/month** (regional) or **$0.065/GB/month** (multi-regional)

#### Discount Mechanisms

**Sustained Use Discounts (SUD)** — fully automatic, no commitment required:

> [!warning] SUD Varies by Machine Family
>
> N1 and M1/M2 series get up to ~30% SUD. N2, N2D, and C2 series get up to ~20% SUD. **E2 machines do NOT qualify for SUDs at all.** The table below shows the N1/M1/M2 tiers; N2/N2D/C2 tiers are lower.

| Usage in month | Discount (N1/M1/M2) | Discount (N2/N2D/C2) |
|----------------|---------------------|----------------------|
| 0–25% | 0% | 0% |
| 25–50% | 20% off | Up to 10% off |
| 50–75% | 40% off | Up to 15% off |
| 75–100% | Net ~30% for full month | Net ~20% for full month |

Running an N1 VM 24/7 for a full month yields ~30% off automatically. N2/C2 yields ~20%. E2 yields zero SUD.

**Committed Use Discounts (CUD)** — requires a 1- or 3-year resource commitment:

| Commitment | Discount |
|------------|----------|
| 1-year | ~37% off on-demand |
| 3-year | ~55% off on-demand |

CUDs apply at the project or billing-account level (for resource-based CUDs). They do not apply to Spot VMs.

```bash
# Purchase a CUD
gcloud compute commitments create COMMITMENT_NAME \
  --plan=12-month \
  --region=us-central1 \
  --resources=vcpu=16,memory=64GB

# List existing commitments
gcloud compute commitments list --filter="region=us-central1"
```

**Spot / Preemptible VMs** — 60–91% off on-demand rates, can be terminated any time:

```bash
# Create a Spot VM (newer API; Preemptible is deprecated)
gcloud compute instances create INSTANCE_NAME \
  --machine-type=e2-standard-4 \
  --provisioning-model=SPOT \
  --instance-termination-action=STOP \
  --zone=us-central1-a

# Create classic preemptible (still works)
gcloud compute instances create INSTANCE_NAME \
  --machine-type=e2-standard-4 \
  --preemptible \
  --zone=us-central1-a
```

> [!warning] Cost Trap: Idle VMs
>
> A stopped VM still charges for its attached persistent disk and any reserved static IP. To pay zero, delete the disk or resize to the minimum, and release the static IP. Stopping alone does NOT eliminate all costs.

#### Special Licensing Costs

SQL Server on Windows: adds $0.40–$2.00/hour on top of VM price depending on edition. Use SQL Server on Linux (Developer/Express edition = free) or bring-your-own license (BYOL) to avoid this.

GPU VMs: GPUs are billed per-hour on top of the base VM cost. Example: NVIDIA A100 ~$3.67/hour additional.

#### Right-Sizing with the Recommender API

```bash
# List machine-type right-sizing recommendations in a zone
gcloud recommender recommendations list \
  --recommender=google.compute.instance.MachineTypeRecommender \
  --location=us-central1-a \
  --project=PROJECT_ID \
  --format=json | jq '.[] | {name: .name, impact: .primaryImpact.costProjection}'

# Apply a recommendation
gcloud recommender recommendations apply RECOMMENDATION_ID \
  --recommender=google.compute.instance.MachineTypeRecommender \
  --location=us-central1-a \
  --etag=ETAG
```

#### Inventory and Cost Audit Commands

```bash
# List all running VMs and their machine types
gcloud compute instances list \
  --filter="status=RUNNING" \
  --format="table(name,zone,machineType.basename(),status)"

# List VMs by zone sorted by size
gcloud compute instances list \
  --format="table(name,zone,machineType.basename(),scheduling.preemptible)"

# Find unattached (orphaned) persistent disks
gcloud compute disks list \
  --filter="NOT users:*" \
  --format="table(name,zone,sizeGb,type.basename())"

# Find unattached static IPs (charged at $0.01/hr each!)
gcloud compute addresses list \
  --filter="status=RESERVED AND NOT users:*"

# Delete an unattached static IP
gcloud compute addresses delete IP_NAME --region=us-central1
```

**Free tier:** 1 e2-micro instance per month in `us-*` regions (excluding `us-east4`, `us-east5`).

---

### BigQuery

BigQuery has two fundamentally different pricing models. Choose based on workload predictability.

#### Model 1: On-Demand (Pay per Query)

- **$6.25 per TB of data scanned**
- First **1 TB/month free**
- Billed on bytes scanned, not rows returned, not execution time

> [!danger] Full-Table Scan Costs
>
> Cost Trap: Full-Table Scans.
> `SELECT * FROM huge_table` scans every byte. A 10 TB table costs $62.50 per full scan. Always filter on partitioned columns and cluster keys to minimize bytes scanned.

#### Model 2: Editions (Capacity / Slot-Based)

| Edition | Price/slot-hour | Min slots | Autoscaling |
|---------|----------------|-----------|-------------|
| Standard | $0.04 | 100 | Yes (baseline 0) |
| Enterprise | $0.06 | 100 | Yes |
| Enterprise Plus | $0.10 | 100 | Yes |

Editions are best when:
- Queries run frequently throughout the day (capacity is amortized over time)
- You need predictable costs / budget certainty
- You have SLA requirements for slot availability

On-demand is best when:
- Workloads are bursty and unpredictable
- Total monthly scanned volume is under ~500 GB–5 TB
- Ad-hoc analytics with infrequent queries

#### BigQuery Storage Pricing

| Storage type | Cost/GB/month | Condition |
|-------------|---------------|-----------|
| Active | $0.020 | Table modified in last 90 days |
| Long-term | $0.010 | Table NOT modified for 90+ consecutive days |

Long-term storage kicks in automatically per-table (not per-dataset). This is a free 50% storage discount for cold tables — use it by not unnecessarily writing to archive tables.

Partitioned tables get long-term pricing applied per-partition, so old partitions become cheap while new ones stay active-priced.

#### Streaming Inserts Pricing

- **$0.010 per 200 MB** inserted via the legacy streaming API
- Each row is rounded up to 1 KB minimum
- Prefer batch loads (free) or the Storage Write API where possible

> [!tip] Free Tier Summary (BigQuery)
>
> - 1 TB queries/month (on-demand)
> - 10 GB storage/month
> - Free batch loading, exporting, copying, and metadata operations

#### Cost Estimation Commands

```bash
# Dry run: estimate bytes scanned before running a query (no cost incurred)
bq query \
  --dry_run \
  --use_legacy_sql=false \
  "SELECT event_id, user_id, ts
   FROM my_dataset.events
   WHERE DATE(ts) = '2026-03-22'
     AND event_type = 'purchase'"
# Output: Query successfully validated. Assuming the tables are not modified,
#         running this query will process X bytes.
```

Convert dry-run output to cost estimate:

```bash
# Bytes → TB → cost
BYTES=52428800  # example output
python3 -c "print(f'Estimated cost: \${$BYTES / 1e12 * 6.25:.4f}')"
```

#### BigQuery SQL for Cost Analysis

Query cost by user (last 30 days):

```sql
SELECT
  user_email,
  COUNT(*) AS query_count,
  ROUND(SUM(total_bytes_processed) / POW(10, 12), 4) AS tb_scanned,
  ROUND(SUM(total_bytes_processed) / POW(10, 12) * 6.25, 2) AS est_cost_usd,
  ROUND(AVG(total_bytes_processed) / POW(10, 9), 2) AS avg_gb_per_query
FROM `region-us`.INFORMATION_SCHEMA.JOBS
WHERE
  creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
  AND job_type = 'QUERY'
  AND state = 'DONE'
GROUP BY user_email
ORDER BY tb_scanned DESC
```

Most expensive individual queries (last 7 days):

```sql
SELECT
  job_id,
  user_email,
  query,
  ROUND(total_bytes_processed / POW(10, 12), 4) AS tb_scanned,
  ROUND(total_bytes_processed / POW(10, 12) * 6.25, 4) AS est_cost_usd,
  TIMESTAMP_DIFF(end_time, start_time, SECOND) AS duration_seconds,
  creation_time
FROM `region-us`.INFORMATION_SCHEMA.JOBS
WHERE
  creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
  AND job_type = 'QUERY'
  AND state = 'DONE'
ORDER BY total_bytes_processed DESC
LIMIT 50
```

Tables generating the most scan cost:

```sql
SELECT
  referenced_table.project_id,
  referenced_table.dataset_id,
  referenced_table.table_id,
  COUNT(DISTINCT job_id) AS query_count,
  ROUND(SUM(total_bytes_processed) / POW(10, 12), 4) AS tb_scanned,
  ROUND(SUM(total_bytes_processed) / POW(10, 12) * 6.25, 2) AS est_cost_usd
FROM `region-us`.INFORMATION_SCHEMA.JOBS,
  UNNEST(referenced_tables) AS referenced_table
WHERE
  creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
  AND job_type = 'QUERY'
  AND state = 'DONE'
GROUP BY 1, 2, 3
ORDER BY tb_scanned DESC
LIMIT 30
```

Storage cost breakdown by dataset:

```sql
SELECT
  table_schema AS dataset,
  ROUND(SUM(size_bytes) / POW(10, 9), 2) AS total_gb,
  ROUND(SUM(size_bytes) / POW(10, 9) * 0.02, 4) AS est_storage_cost_usd
FROM `PROJECT_ID`.INFORMATION_SCHEMA.TABLE_STORAGE
GROUP BY dataset
ORDER BY total_gb DESC
```

Daily cost trend (slots or on-demand):

```sql
SELECT
  DATE(creation_time) AS query_date,
  COUNT(*) AS queries,
  ROUND(SUM(total_bytes_processed) / POW(10, 12), 4) AS tb_scanned,
  ROUND(SUM(total_bytes_processed) / POW(10, 12) * 6.25, 2) AS est_cost_usd
FROM `region-us`.INFORMATION_SCHEMA.JOBS
WHERE
  creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)
  AND job_type = 'QUERY'
  AND state = 'DONE'
GROUP BY query_date
ORDER BY query_date DESC
```

#### BigQuery Cost Optimization Tactics

Partitioning reduces scan cost by restricting data read:

```sql
-- Create a partitioned table
CREATE TABLE my_dataset.events
PARTITION BY DATE(event_timestamp)
CLUSTER BY event_type, user_id
AS SELECT * FROM my_dataset.events_raw;

-- Verify partition pruning: compare billed bytes with vs without partition filter
-- Always filter on the partition column!
WHERE DATE(event_timestamp) BETWEEN '2026-01-01' AND '2026-03-22'
```

Column selection — never `SELECT *`:

```sql
-- BAD: scans all columns (full row width × all rows)
SELECT * FROM my_dataset.events WHERE DATE(ts) = '2026-03-22'

-- GOOD: scans only selected columns (BigQuery is columnar)
SELECT event_id, user_id, event_type FROM my_dataset.events
WHERE DATE(ts) = '2026-03-22'
```

Materialized views for repeated aggregation patterns:

```sql
CREATE MATERIALIZED VIEW my_dataset.daily_event_counts
PARTITION BY date
AS
SELECT
  DATE(event_timestamp) AS date,
  event_type,
  COUNT(*) AS cnt
FROM my_dataset.events
GROUP BY 1, 2;
-- Queries hitting this view only scan the MV, not the underlying table
```

See [[querying-and-cost-optimization]] for full BigQuery optimization patterns.

---

### Cloud Run

**Billing philosophy:** Pay only for what executes. Zero cost when idle (no requests, no job executions). This makes Cloud Run ideal for batch data engineering jobs.

#### Cloud Run Services (HTTP/gRPC)

| Dimension | Rate | Free tier/month |
|-----------|------|-----------------|
| Requests | $0.40/million | 2 million requests |
| CPU (request processing) | $0.00002400/vCPU-second | 180,000 vCPU-seconds |
| Memory (request processing) | $0.00000250/GB-second | 360,000 GB-seconds |
| CPU (always-on, between requests) | $0.00001800/vCPU-second | — |

#### Cloud Run Jobs (Batch Workloads)

| Dimension | Rate |
|-----------|------|
| CPU | $0.00002400/vCPU-second |
| Memory | $0.00000250/GB-second |
| No per-request charge | — |

#### Cloud Run Job cost formula — vCPU-seconds + memory-seconds + requests

```
Cost = executions × duration_seconds × (vCPU × $0.0000240 + RAM_GB × $0.0000025)
```

Example: 1 execution/day of a 2-vCPU, 4 GB, 300-second job:

```
Daily cost = 1 × 300 × (2 × 0.0000240 + 4 × 0.0000025)
           = 300 × (0.0000480 + 0.0000100)
           = 300 × 0.0000580
           = $0.0174/day → ~$0.52/month
```

> [!tip] Cloud Run vs VM
>
> Cloud Run vs VM for Batch Jobs.
> A Cloud Run Job running 1 hour/day costs roughly $0.04–0.08/day. An e2-standard-2 VM running 24/7 costs ~$49/month. If a job runs less than ~8 hours/day, Cloud Run is cheaper even before accounting for provisioning overhead.

> [!warning] Min Instances Cost Trap
>
> Cost Trap: min-instances > 0.
> Setting `--min-instances=1` on a Cloud Run Service keeps one container always warm. CPU allocated between requests at the idle rate. For low-traffic services that don't need sub-second cold start, keep min-instances at 0.

```bash
# Deploy a Cloud Run Job with cost-efficient defaults
gcloud run jobs create JOB_NAME \
  --image=gcr.io/PROJECT_ID/IMAGE:TAG \
  --region=us-central1 \
  --cpu=1 \
  --memory=512Mi \
  --task-timeout=600 \
  --max-retries=3

# Execute the job
gcloud run jobs execute JOB_NAME --region=us-central1

# Check execution history and durations
gcloud run jobs executions list --job=JOB_NAME --region=us-central1

# Deploy a service with min-instances=0 to avoid idle charges
gcloud run deploy SERVICE_NAME \
  --image=gcr.io/PROJECT_ID/IMAGE:TAG \
  --region=us-central1 \
  --min-instances=0 \
  --max-instances=10 \
  --cpu=1 \
  --memory=512Mi
```

See [[cloud-run-jobs-vs-services]] for architecture guidance.

---

### Pub/Sub

**Billing model:** Based on total data volume (message size × message count).

| Dimension | Rate | Free tier/month |
|-----------|------|-----------------|
| Message delivery (publish + deliver) | $0.04/GB (=$40/TB) | First 10 GB |
| Retained acknowledged messages | $0.27/GB/month | — |
| Snapshot storage | $0.27/GB/month | — |
| BigQuery subscription | $0.05/GB delivered | — |

**Minimum message size:** 1,000 bytes (1 KB) per publish operation. Even a 10-byte message is billed as 1 KB.

#### Pub/Sub cost formula — message volume + delivery + storage

```
Monthly cost = max(0, total_message_volume_GB - 10) × $0.04
             + retained_acknowledged_GB × $0.27
```

Example: 500 million messages/month at 500 bytes each:

```
Volume = 500M × max(500, 1000) bytes = 500M × 1000 = 500 GB
Cost   = (500 - 10) × $0.04 = 490 × $0.04 = $19.60/month
```

> [!warning] Large Message Payloads
>
> Cost Trap: Large Message Payloads.
> Pub/Sub is billed on raw bytes. If you publish 1 MB JSON blobs, you pay 1000× more than publishing a 1 KB event ID and fetching the payload from GCS. Store large payloads in GCS; publish a reference to Pub/Sub.

> [!warning] Retained Acknowledged Messages
>
> Cost Trap: Retained Acknowledged Messages.
> If a subscription has message retention enabled (for replay), all acknowledged messages are stored at $0.27/GB/month. This can accumulate fast for high-volume topics. Set retention only as long as needed.

```bash
# Check message volume on a subscription (via Cloud Monitoring metrics)
gcloud monitoring read \
  'pubsub.googleapis.com/subscription/num_undelivered_messages' \
  --filter='resource.label.subscription_id=SUBSCRIPTION_ID' \
  --freshness=1h

# List subscriptions and their configs
gcloud pubsub subscriptions list --format=json | jq '.[] | {name, messageRetentionDuration}'

# Update retention on a subscription (reduce to save cost)
gcloud pubsub subscriptions modify-config SUBSCRIPTION_ID \
  --message-retention-duration=1d
```

See [[pubsub-messaging]] and [[pubsub-topics-and-subscriptions]] for operational patterns.

---

### Cloud Storage (GCS)

**Billing dimensions:** Storage class, storage volume, operations (Class A / Class B), and egress.

#### Storage Classes and Pricing

| Class | Storage/GB/month | Retrieval/GB | Min storage duration | Use case |
|-------|-----------------|-------------|---------------------|----------|
| Standard | $0.020 | Free | None | Active data, landing zones, temp files |
| Nearline | $0.010 | $0.010 | 30 days | Monthly backups, low-access data |
| Coldline | $0.004 | $0.020 | 90 days | Quarterly audits, DR archives |
| Archive | $0.0012 | $0.050 | 365 days | Compliance, legal hold, cold backups |

> [!warning] Early Deletion Charges
>
> Deleting a Nearline object before 30 days charges you for the remaining duration. Deleting a Coldline object at day 45 of 90 charges you for the remaining 45 days of minimum. Plan lifecycle transitions carefully.

#### Operations Pricing

| Class | Operations | Price |
|-------|-----------|-------|
| Class A (write-like) | Writes, list, multi-part uploads | $0.005/1,000 ops |
| Class B (read-like) | Reads, metadata get | $0.0004/1,000 ops |

Class A ops are 12.5× more expensive than Class B. Minimizing unnecessary bucket listing and re-writes matters at scale.

#### Egress Pricing

| Destination | Rate |
|-------------|------|
| Same region (within GCP) | Free |
| Different region (within GCP) | $0.01/GB |
| Internet (first 1 GB/month) | Free |
| Internet (thereafter) | $0.12/GB |
| Dedicated Interconnect | $0.02–0.04/GB |

> [!danger] Data Egress Costs
>
> Cost Trap: Data Egress.
> Downloading 1 TB from GCS to the internet costs $122.88. Keep downstream compute in the same region as your GCS buckets. If data must leave GCP, compress it first.

#### Free Tier

- 5 GB Standard storage/month
- 5,000 Class A operations/month
- 50,000 Class B operations/month
- 1 GB egress to internet/month

#### GCS Lifecycle Rules for Cost Optimization

```bash
# Apply a lifecycle rule to auto-transition and delete old objects
cat > /tmp/lifecycle.json <<'EOF'
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
        "action": {"type": "Delete"},
        "condition": {"age": 365}
      }
    ]
  }
}
EOF

gsutil lifecycle set /tmp/lifecycle.json gs://BUCKET_NAME

# Verify lifecycle policy
gsutil lifecycle get gs://BUCKET_NAME
```

```bash
# Check bucket storage usage by storage class
gsutil du -s gs://BUCKET_NAME

# Detailed breakdown with storage class
gsutil ls -L gs://BUCKET_NAME/** | grep -E "Storage class|Content-Length"

# Find objects larger than 1 GB (candidates for Coldline/Archive)
gsutil ls -l gs://BUCKET_NAME/** | awk '$1 > 1073741824 {print $0}' | sort -rn
```

See [[gcs-buckets-and-lifecycle]] and [[gcs-object-operations]] for operational patterns.

---

### Firestore

**Billing model:** Per-operation (reads, writes, deletes) plus storage.

#### Pricing

| Operation | Rate | Free tier/day |
|-----------|------|---------------|
| Document reads | $0.06/100,000 | 50,000 reads |
| Document writes | $0.18/100,000 | 20,000 writes |
| Document deletes | $0.02/100,000 | 20,000 deletes |
| Storage | $0.18/GB/month | 1 GB |
| Network egress | Standard GCP egress rates | — |

Free tier resets daily (not monthly), making Firestore effectively free for development workloads.

> [!tip] Writes Cost 3x More
>
> Writes Are 3× More Expensive Than Reads.
> At $0.18/100K writes vs $0.06/100K reads, writes are 3× more expensive. Batch writes using `writeBatch()` to reduce operation count, and avoid unnecessary document overwrites.

> [!danger] Unindexed Collection-Group Queries
>
> Cost Trap: Unindexed Collection-Group Queries.
> A query that cannot use an index falls back to a collection scan, reading every document in the collection. A 1M-document collection with 10 such queries/day = 10M reads = $6/day = $180/month. Always verify query plans and index coverage.

#### Firestore cost estimation — reads, writes, deletes, storage

```
Monthly reads cost  = (total_reads - 50,000/day × 30) / 100,000 × $0.06
Monthly writes cost = (total_writes - 20,000/day × 30) / 100,000 × $0.18
```

Example: 5M reads/day, 500K writes/day (real-time dashboard):

```
Monthly reads  = (5,000,000 - 50,000) × 30 / 100,000 × $0.06
               = 149,850,000 / 100,000 × $0.06 = $89.91

Monthly writes = (500,000 - 20,000) × 30 / 100,000 × $0.18
               = 14,400,000 / 100,000 × $0.18 = $25.92

Total ≈ $115.83/month
```

```bash
# Check Firestore usage via Cloud Monitoring (reads/writes per day)
gcloud monitoring read \
  'firestore.googleapis.com/document/read_count' \
  --project=PROJECT_ID \
  --freshness=24h \
  --align=ALIGN_SUM

# Estimate storage size
gcloud firestore databases describe --project=PROJECT_ID
```

See [[firestore-data-model-and-operations]] and [[real-time-nosql-pipelines]] for design patterns.

---

### Dataflow (Apache Beam)

**Billing model:** Worker resources consumed during job execution. Billed per second.

#### Pricing

| Resource | Batch rate | Streaming rate |
|----------|-----------|---------------|
| Worker vCPU | $0.056/vCPU/hour | $0.069/vCPU/hour |
| Worker memory | $0.003557/GB/hour | $0.004390/GB/hour |
| Worker disk (HDD) | $0.000054/GB/hour | $0.000054/GB/hour |
| Worker disk (SSD) | $0.000298/GB/hour | $0.000298/GB/hour |
| Dataflow Shuffle (batch) | $0.008/GB shuffled | — |
| Streaming Engine | — | $0.018/GB shuffled |

Streaming jobs: 22–25% more expensive than batch due to persistent worker overhead and streaming engine.

#### Dataflow cost formula — worker vCPUs + memory + shuffle

```
Batch job cost =
  workers × duration_hours × (vCPUs_per_worker × $0.056 + RAM_GB × $0.003557)
  + disk_GB × duration_hours × $0.000054
  + shuffle_GB × $0.008
```

Example: 10-worker batch job, 2 hours, n1-standard-4 equivalent (4 vCPU, 15 GB), 250 GB disk, 100 GB shuffle:

```
Compute = 10 × 2 × (4 × $0.056 + 15 × $0.003557)
        = 10 × 2 × ($0.224 + $0.053355)
        = 10 × 2 × $0.277355
        = $5.55

Disk    = 10 × 250 × 2 × $0.000054 = $0.27

Shuffle = 100 × $0.008 = $0.80

Total   ≈ $6.62
```

> [!warning] Over-Provisioned Workers
>
> Cost Trap: Over-Provisioned Worker Counts.
> Dataflow autoscaling helps, but setting `--num-workers` too high wastes money on idle workers. Let autoscaling determine worker count, or profile the job first with a small `--num-workers=2` run to establish a baseline.

> [!warning] Streaming Jobs Running 24/7
>
> Cost Trap: Streaming Jobs Running 24/7.
> A 10-worker streaming Dataflow job at $0.069/vCPU/hour with 4 vCPUs/worker = $0.276/worker/hour × 10 = $2.76/hour = $66.24/day = ~$2,000/month just for compute. Evaluate whether Cloud Run, Cloud Functions, or Pub/Sub + BigQuery streaming inserts can replace a Dataflow streaming job.

```bash
# Submit a batch Dataflow job with cost-conscious defaults
gcloud dataflow jobs run JOB_NAME \
  --gcs-location=gs://BUCKET/templates/TEMPLATE \
  --region=us-central1 \
  --num-workers=2 \
  --max-workers=20 \
  --worker-machine-type=n1-standard-4 \
  --disk-size-gb=50

# List running Dataflow jobs (potential cost leak if forgotten)
gcloud dataflow jobs list --region=us-central1 --filter="state=JOB_STATE_RUNNING"

# Cancel a job
gcloud dataflow jobs cancel JOB_ID --region=us-central1

# Drain a streaming job gracefully (commits in-flight work before stopping)
gcloud dataflow jobs drain JOB_ID --region=us-central1

# Show job metrics (workers, throughput)
gcloud dataflow jobs show JOB_ID --region=us-central1
```

---

### Cloud Scheduler

#### Cloud Scheduler pricing — jobs per month, free tier

| Dimension | Rate | Free tier |
|-----------|------|-----------|
| Jobs | $0.10/job/month | First 3 jobs free |
| Executions | Free | Unlimited |

Cloud Scheduler is trivially cheap — a pipeline with 20 scheduled jobs costs $1.70/month. Never a significant cost driver.

```bash
# List all scheduled jobs (confirm no orphan schedules)
gcloud scheduler jobs list --location=us-central1

# Delete an unused job
gcloud scheduler jobs delete JOB_NAME --location=us-central1
```

---

### Cloud Functions (Gen 2)

#### Cloud Functions pricing — invocations, compute time, networking

| Dimension | Rate | Free tier/month |
|-----------|------|-----------------|
| Invocations | $0.40/million | First 2 million |
| Compute (CPU) | $0.00002400/vCPU-second | First 180,000 vCPU-seconds |
| Compute (memory) | $0.00000250/GB-second | First 360,000 GiB-seconds |
| Networking egress | $0.12/GB | First 5 GB |

Cloud Functions Gen 2 runs on Cloud Run under the hood, so pricing is identical to Cloud Run services. The free tier is generous enough that low-volume event-driven functions cost nothing.

```bash
# List functions and their triggers
gcloud functions list --format="table(name,status,trigger)"

# Describe a function (check min-instances, which adds idle cost)
gcloud functions describe FUNCTION_NAME --region=us-central1

# Update to remove always-on instances
gcloud functions deploy FUNCTION_NAME \
  --min-instances=0 \
  --region=us-central1
```

---

### Secret Manager

#### Secret Manager pricing — active versions, access operations

| Dimension | Rate | Free tier |
|-----------|------|-----------|
| Secret versions (active) | $0.06/version/month | First 6 versions free |
| Access operations | $0.03/10,000 | First 10,000 operations free |

Secret Manager almost never appears as a cost item. With 6 free versions, a typical application stays in the free tier.

> [!tip] Secret Version Hygiene
>
> Destroy old secret versions that are no longer in rotation. Each active version costs $0.06/month. If you have 100 secrets with 10 versions each, that's 1,000 versions = $57/month (minus the 6 free).

```bash
# List all secret versions (find old ones to destroy)
gcloud secrets versions list SECRET_NAME

# Destroy a specific old version
gcloud secrets versions destroy VERSION_NUMBER --secret=SECRET_NAME

# Disable a version (reversible)
gcloud secrets versions disable VERSION_NUMBER --secret=SECRET_NAME
```

---

### Cloud Logging

#### Cloud Logging pricing — ingestion, storage, routing

| Dimension | Rate | Free tier/month |
|-----------|------|-----------------|
| Log ingestion | $0.50/GB | First 50 GB |
| Log storage beyond 30 days | $0.01/GB/month | 30 days retention included |
| Log bucket storage | $0.01/GB/month | — |

> [!danger] Debug Logging in Production
>
> Cost Trap: DEBUG-Level Logging in Production.
> A service logging at DEBUG level can generate 10–100× more log volume than INFO level. At $0.50/GB, 1 TB/month of logs = $476.84 (after 50 GB free). Always use INFO or WARNING in production; use log sampling for high-throughput services.

> [!warning] Log Exclusion Filters
>
> Use log exclusion filters to drop high-volume, low-value logs before they are ingested and billed.

```bash
# Check current log volume (bytes ingested this month)
gcloud logging read \
  'logName="projects/PROJECT_ID/logs/cloudaudit.googleapis.com%2Factivity"' \
  --limit=1 \
  --format=json

# Create a log exclusion filter to drop noisy health-check logs
gcloud logging sinks create exclude-healthchecks \
  logging.googleapis.com/projects/PROJECT_ID \
  --log-filter='httpRequest.requestUrl="/healthz"' \
  --exclusion-filter='true'

# More targeted: exclude specific log names
gcloud logging exclusions create drop-debug-logs \
  --project=PROJECT_ID \
  --description="Drop debug logs from data workers" \
  --log-filter='severity="DEBUG" AND resource.type="cloud_run_revision"'

# List current exclusions
gcloud logging exclusions list --project=PROJECT_ID

# Export logs to GCS for long-term cheap retention (instead of Cloud Logging storage)
gcloud logging sinks create long-term-logs-sink \
  storage.googleapis.com/LOG_ARCHIVE_BUCKET \
  --log-filter='severity>=WARNING' \
  --project=PROJECT_ID
```

See [[cloud-logging]] for logging infrastructure patterns.

---

### Artifact Registry

#### Artifact Registry pricing — storage per GB, free tier

| Dimension | Rate | Free tier |
|-----------|------|-----------|
| Storage | $0.10/GB/month | 0.5 GB free |
| Egress (same region) | Free | — |
| Egress (cross-region within GCP) | $0.01/GB | — |
| Egress to internet | $0.12/GB | — |

> [!tip] Clean Up Old Image Tags
>
> Container images accumulate fast. A 2 GB image with 50 versions = 100 GB = $10/month. Set up cleanup policies to delete images older than N days or beyond the last N versions.

```bash
# List repositories and their sizes
gcloud artifacts repositories list --location=us-central1

# List images in a repository
gcloud artifacts docker images list us-central1-docker.pkg.dev/PROJECT_ID/REPO

# Delete a specific image digest
gcloud artifacts docker images delete \
  us-central1-docker.pkg.dev/PROJECT_ID/REPO/IMAGE@DIGEST

# Set a cleanup policy (delete untagged images older than 30 days)
gcloud artifacts repositories set-cleanup-policies REPO_NAME \
  --location=us-central1 \
  --policy='[{"name":"delete-old-untagged","action":{"type":"Delete"},"condition":{"tagState":"UNTAGGED","olderThan":"30d"}}]'
```

---

### Cloud NAT

#### Cloud NAT pricing — per-VM charge + data processing

| Dimension | Rate | Free tier |
|-----------|------|-----------|
| NAT gateway (Public NAT) | $0.0014/hr per VM (max $0.044/hr at 32+ VMs) | None |
| NAT gateway (Private NAT) | $0.045/hour flat | None |
| Data processed | $0.045/GB | None |

> [!warning] Hidden Cloud NAT Cost
>
> Public NAT costs $0.0014/hr per VM using the gateway, capping at $0.044/hr (~$32/month) for 32+ VMs. Even with zero traffic, the per-VM charge applies while the gateway exists. If you have NAT gateways in multiple regions "just in case," that adds up. Disable NAT in regions where VMs do not need internet access.

```bash
# List all NAT gateways (check for orphaned ones)
gcloud compute routers list --format="table(name,region)"
gcloud compute routers nats list --router=ROUTER_NAME --region=REGION

# Delete a NAT gateway
gcloud compute routers nats delete NAT_NAME \
  --router=ROUTER_NAME \
  --region=us-central1

# Check if VMs actually need NAT (look for internet-bound traffic)
gcloud logging read \
  'resource.type="nat_gateway" AND jsonPayload.destination!~"^10\." AND jsonPayload.bytes_sent>0' \
  --project=PROJECT_ID \
  --limit=10
```

---

### Network Egress (Cross-Service Summary)

Egress charges apply whenever data leaves a region. This is often an invisible multiplier on storage and compute costs.

| Traffic path | Rate |
|-------------|------|
| Within same zone | Free |
| Same region, different zone | $0.01/GB |
| Different GCP regions | $0.01–$0.08/GB |
| Internet (first 1 GB free) | $0.12/GB |
| Cloud CDN cache fill | $0.02–$0.08/GB |
| Dedicated Interconnect | $0.02–$0.04/GB |

> [!tip] Co-Locate Data and Compute
>
> Keep Data and Compute Co-Located.
> Run BigQuery, GCS, Compute Engine, and Cloud Run in the same region. Cross-region egress at $0.08/GB adds up quickly when processing terabytes of data. This is especially important when GCS → Dataflow → BigQuery — all should be in the same region.

---

### GCP Master Pricing Summary Table

| Service | Billing unit | Price | Free tier | Biggest cost trap |
|---------|-------------|-------|-----------|------------------|
| Compute Engine | vCPU-hour + GB-hour | $0.031–0.047/vCPU | 1 e2-micro/month | Idle VMs running 24/7 with attached disks |
| BigQuery (on-demand) | TB scanned | $6.25/TB | 1 TB queries, 10 GB storage | Full-table scans on unpartitioned tables |
| BigQuery (editions) | Slot-hour | $0.04–0.10 | None | Buying more slots than peak demand requires |
| Cloud Run | vCPU-second | $0.000024 | 2M req, 360K GB-s, 180K vCPU-s | min-instances > 0 when not needed |
| Pub/Sub | GB ingested | $0.04/GB | 10 GB/month | Large message payloads + message retention |
| GCS Standard | GB/month | $0.020 | 5 GB | Egress to internet at $0.12/GB |
| GCS Nearline | GB/month | $0.010 | — | Early deletion charges (<30 days) |
| GCS Coldline | GB/month | $0.004 | — | Early deletion charges (<90 days) |
| GCS Archive | GB/month | $0.0012 | — | Early deletion charges (<365 days) |
| Firestore reads | 100K reads | $0.06 | 50K reads/day | Unindexed queries scanning entire collections |
| Firestore writes | 100K writes | $0.18 | 20K writes/day | Unnecessary document overwrites |
| Dataflow batch | vCPU-hour | $0.056 | None | Over-provisioned workers + shuffle ($0.008/GB) |
| Dataflow streaming | vCPU-hour | $0.069 | None | Streaming jobs replacing batch-viable workloads |
| Cloud Logging | GB ingested | $0.50/GB | 50 GB/month | DEBUG-level logging in production |
| Cloud NAT | Per-VM-hour | $0.0014/VM (max $0.044) | None | Gateways left on in unused regions |
| Static IP (unused) | IP-hour | $0.01 | None | Forgotten reserved IPs not attached to VMs |
| Artifact Registry | GB/month | $0.10 | 0.5 GB | Accumulated untagged old image versions |
| Secret Manager | Version/month | $0.06 | 6 versions | Old secret versions not destroyed |
| Cloud Scheduler | Job/month | $0.10 | 3 jobs | Negligible — never a real cost item |

---

### GCP Discount Mechanisms Summary

| Discount type | Services | Discount | Requirement |
|--------------|----------|----------|-------------|
| Sustained Use Discounts (SUD) | Compute Engine N1/M1/M2 (~30%), N2/N2D/C2 (~20%). E2 excluded | Up to ~20-30% | Automatic, just run >25% of month |
| Committed Use Discounts — resource | Compute Engine | 37% (1yr) / 55% (3yr) | Commit to vCPU + RAM for 1 or 3 years |
| Committed Use Discounts — spend | All GCP services | Negotiated | Large enterprise spend contracts |
| Spot / Preemptible VMs | Compute Engine | 60–91% | Accept interruption risk |
| BigQuery flat-rate / editions | BigQuery | Predictable cost | Minimum 100 slots, pay hourly |
| Long-term storage | BigQuery, GCS | 50% off storage | Don't modify tables for 90 days |
| Free tier | All major services | 100% on usage below limit | Automatic |

```bash
# Check active CUDs
gcloud compute commitments list --project=PROJECT_ID

# Check SUD savings (visible in billing export)
SELECT
  sku.description,
  SUM(cost) AS total_cost
FROM `billing_export.gcp_billing_export_v1_XXXXXXXX`
WHERE
  LOWER(sku.description) LIKE '%sustained%'
  OR LOWER(sku.description) LIKE '%committed%'
  AND DATE(_PARTITIONTIME) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY sku.description
ORDER BY total_cost
```

---

## Cost Governance Patterns

### Weekly Cost Review Query

Run this weekly against the billing export to catch anomalies:

```sql
WITH weekly_costs AS (
  SELECT
    service.description AS service,
    DATE_TRUNC(DATE(_PARTITIONTIME), WEEK) AS week,
    SUM(cost) AS cost_usd
  FROM `billing_export.gcp_billing_export_v1_XXXXXXXX`
  WHERE DATE(_PARTITIONTIME) >= DATE_SUB(CURRENT_DATE(), INTERVAL 8 WEEK)
  GROUP BY service, week
),
with_lag AS (
  SELECT
    *,
    LAG(cost_usd) OVER (PARTITION BY service ORDER BY week) AS prev_week_cost
  FROM weekly_costs
)
SELECT
  service,
  week,
  cost_usd,
  prev_week_cost,
  ROUND((cost_usd - prev_week_cost) / NULLIF(prev_week_cost, 0) * 100, 1) AS pct_change
FROM with_lag
WHERE week = DATE_TRUNC(CURRENT_DATE(), WEEK)
ORDER BY pct_change DESC
```

### Anomaly Detection: Unexpected Cost Spikes

```sql
-- Alert when a service costs >2x its 30-day average in a single day
WITH daily AS (
  SELECT
    service.description AS service,
    DATE(_PARTITIONTIME) AS day,
    SUM(cost) AS daily_cost
  FROM `billing_export.gcp_billing_export_v1_XXXXXXXX`
  WHERE DATE(_PARTITIONTIME) >= DATE_SUB(CURRENT_DATE(), INTERVAL 35 DAY)
  GROUP BY service, day
),
stats AS (
  SELECT
    service,
    day,
    daily_cost,
    AVG(daily_cost) OVER (
      PARTITION BY service
      ORDER BY day
      ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING
    ) AS rolling_30d_avg
  FROM daily
)
SELECT
  service,
  day,
  daily_cost,
  rolling_30d_avg,
  ROUND(daily_cost / NULLIF(rolling_30d_avg, 0), 2) AS cost_multiplier
FROM stats
WHERE
  day = DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
  AND daily_cost > rolling_30d_avg * 2
  AND daily_cost > 5  -- ignore tiny absolute costs
ORDER BY cost_multiplier DESC
```

### Cost Attribution by Label

```sql
-- Cost breakdown by environment label
SELECT
  COALESCE((SELECT value FROM UNNEST(labels) WHERE key = 'env'), 'unlabeled') AS environment,
  COALESCE((SELECT value FROM UNNEST(labels) WHERE key = 'team'), 'unlabeled') AS team,
  service.description AS service,
  ROUND(SUM(cost), 2) AS cost_usd
FROM `billing_export.gcp_billing_export_v1_XXXXXXXX`
WHERE DATE(_PARTITIONTIME) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY environment, team, service
HAVING cost_usd > 0.01
ORDER BY cost_usd DESC
```

### Find Unlabeled Resources (Cost Attribution Gap)

```sql
-- Resources contributing cost but missing required labels
SELECT
  service.description AS service,
  resource.name AS resource,
  SUM(cost) AS cost_usd
FROM `billing_export.gcp_billing_export_v1_XXXXXXXX`
WHERE
  DATE(_PARTITIONTIME) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
  AND NOT EXISTS (
    SELECT 1 FROM UNNEST(labels) WHERE key = 'team'
  )
  AND cost > 0
GROUP BY service, resource
HAVING cost_usd > 1
ORDER BY cost_usd DESC
LIMIT 50
```

### Idle Resource Audit

```bash
# VMs stopped for >7 days (still paying for disk)
gcloud compute instances list \
  --filter="status=TERMINATED" \
  --format="table(name,zone,lastStartTimestamp,status)"

# Unattached persistent disks
gcloud compute disks list \
  --filter="NOT users:*" \
  --format="table(name,zone,sizeGb,type.basename(),status)" \
  --sort-by=sizeGb

# Unattached static IPs (each costs $0.01/hour = $7.20/month)
gcloud compute addresses list \
  --filter="status=RESERVED AND NOT users:*" \
  --format="table(name,region,address,status)"

# BigQuery tables that have never been queried (possible orphan data)
SELECT
  t.table_schema,
  t.table_name,
  ts.last_modified_time,
  ROUND(ts.size_bytes / POW(10,9), 2) AS size_gb
FROM `PROJECT_ID`.INFORMATION_SCHEMA.TABLES t
JOIN `PROJECT_ID`.INFORMATION_SCHEMA.TABLE_STORAGE ts
  ON t.table_schema = ts.table_schema AND t.table_name = ts.table_name
WHERE ts.last_modified_time < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)
ORDER BY ts.size_bytes DESC
```

---

## FinOps Checklist

### Daily (Automated)
- [ ] Budget alert thresholds set at 50%, 90%, 100% of monthly budget
- [ ] Billing export flowing to BigQuery (verify rows appearing daily)
- [ ] Anomaly detection query scheduled (or use GCP Recommender)

### Weekly
- [ ] Run weekly cost review query against billing export
- [ ] Check for unattached static IPs
- [ ] Check for unattached persistent disks
- [ ] Review Dataflow streaming job costs (high per-hour)
- [ ] Check Cloud Logging ingestion volume

### Monthly
- [ ] Right-sizing review: run Compute Recommender for all VMs
- [ ] BigQuery: identify top-10 most expensive queries and optimize
- [ ] GCS: verify lifecycle policies are working (check storage class distribution)
- [ ] Review Pub/Sub message retention settings
- [ ] Destroy old Secret Manager versions
- [ ] Clean up Artifact Registry old image tags
- [ ] Check for idle Dataflow jobs left running
- [ ] Verify all resources carry required cost attribution labels

### Quarterly
- [ ] Review CUD coverage vs actual vCPU usage
- [ ] Evaluate on-demand vs editions for BigQuery based on 90-day usage pattern
- [ ] Review Cloud NAT gateways — disable in unused regions
- [ ] Archive or delete BigQuery datasets not used in 90+ days
- [ ] GCS: transition appropriate buckets to colder storage classes

---

### GCP Free Tiers Quick Reference

| Service | Free tier | Notes |
|---------|-----------|-------|
| Compute Engine | 1 e2-micro/month | `us-*` regions only (excl. us-east4/5) |
| BigQuery | 1 TB queries, 10 GB storage/month | On-demand model only |
| Cloud Run | 2M requests, 360K GB-s, 180K vCPU-s/month | Per billing account |
| Pub/Sub | 10 GB/month | Message volume |
| GCS | 5 GB Standard, 5K Class A, 50K Class B ops | Per billing account |
| Firestore | 50K reads, 20K writes, 20K deletes, 1 GB storage | Per day, not per month |
| Cloud Functions | 2M invocations, 180K vCPU-s, 360K GiB-s/month | Gen 2 uses Cloud Run pricing |
| Cloud Logging | 50 GB ingestion/month | Audit logs always free |
| Secret Manager | 6 active versions, 10K access ops/month | Per billing account |
| Cloud Scheduler | 3 jobs | Per billing account |

---

## Related Notes

- [[moc-gcp]] — GCP section overview and navigation
- [[querying-and-cost-optimization]] — BigQuery query optimization techniques
- [[dataset-and-table-management]] — Partitioning and clustering setup
- [[data-loading-and-export]] — Batch loading (free) vs streaming inserts (paid)
- [[vm-lifecycle]] — VM states, stop vs delete cost implications
- [[disks-and-snapshots]] — Disk types and snapshot pricing
- [[cloud-run-jobs-vs-services]] — When to use jobs vs services for cost efficiency
- [[pubsub-messaging]] — Pub/Sub patterns and message size impact
- [[gcs-buckets-and-lifecycle]] — Lifecycle policies for storage cost reduction
- [[firestore-data-model-and-operations]] — Operation count optimization
- [[cloud-logging]] — Log exclusion and volume reduction
- [[gcp-projects-and-apis]] — Project structure and billing linkage
- [[service-accounts-and-iam]] — IAM for billing account access
