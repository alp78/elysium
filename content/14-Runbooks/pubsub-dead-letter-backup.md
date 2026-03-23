---
tags: [gcp]
type: runbook
severity: sev2
technology: gcp
status: stable
updated: 2026-03-23
---

# Pub/Sub Dead Letter Backup

> **Trigger**: Dead letter topic (DLQ) accumulating unprocessed messages
> **Severity**: Sev2 | **SLA**: 1 hr acknowledge, 4 hr resolve
> **Owner**: On-call data engineer
> **Paging**: Cloud Monitoring alert `pubsub-dlq-message-count-high` (> 100 messages on DLQ subscription)

---

## Symptoms

- **Cloud Monitoring alert**: `pubsub.googleapis.com/subscription/num_undelivered_messages` growing on DLQ subscription, crossing the alert threshold
- **Datadog metric**: `custom.pubsub.dlq.message_count` increasing; dashboard shows non-zero DLQ depth that does not drain
- **Pipeline consumers** (Cloud Run jobs or Airflow tasks subscribing to primary topics) are silently dropping messages or logging repeated delivery failures
- Cloud Run consumer logs show repeated errors such as:
  ```
  NACK sent after 3 retries: schema validation failed for message abc123
  Message attribute delivery_attempt=5, exceeds max_delivery_attempts, routing to DLQ
  ```
- Downstream effects: ESG factor updates missing for specific ISINs; index constituent weights not updated for securities whose data feeds through the affected topic; BigQuery tables have gaps

> [!warning] Silent data loss risk
> Pub/Sub DLQ accumulation is easy to miss because primary pipelines appear to run without errors — only the messages that fail validation get silently sidelined. Check DLQ depth on every incident triage. A large backlog may represent hours or days of missed ESG score updates.

---

## Diagnosis

### Step 1 — Check DLQ subscription backlog size

```bash
# Quick count of undelivered messages
gcloud pubsub subscriptions describe dlq-sub \
  --format="value(name, numMessagesRetained)"

# Full subscription details including oldest message age
gcloud pubsub subscriptions describe dlq-sub --format=json \
  | jq '{
      name: .name,
      topic: .topic,
      numMessagesRetained: .numMessagesRetained,
      messageRetentionDuration: .messageRetentionDuration,
      deadLetterPolicy: .deadLetterPolicy
    }'
```

The `numMessagesRetained` field shows the backlog. Also check the DLQ *topic* to confirm it is receiving new messages:

```bash
gcloud pubsub topics describe dlq-topic --format="value(name)"

# List all subscriptions on the DLQ topic (to confirm nothing is consuming it)
gcloud pubsub topics list-subscriptions dlq-topic
```

### Step 2 — Pull sample messages to inspect content

```bash
# Pull up to 5 messages without acknowledging them (non-destructive)
gcloud pubsub subscriptions pull dlq-sub \
  --limit=5 \
  --format=json \
  | jq '.[] | {
      messageId: .message.messageId,
      publishTime: .message.publishTime,
      attributes: .message.attributes,
      data: (.message.data | @base64d)
    }'
```

> [!tip] Message attributes to inspect
> The `attributes` map should contain `CloudPubSubDeadLetterSourceSubscription` (original subscription) and `CloudPubSubDeadLetterSourceTopicPublishTime`. Consumer-added attributes like `delivery_attempt`, `source_system`, `schema_version`, and `isin` are critical for root cause identification.

Decode and pretty-print the message data if it is JSON:

```bash
gcloud pubsub subscriptions pull dlq-sub \
  --limit=5 \
  --format=json \
  | jq '.[] | .message.data | @base64d | fromjson'
```

### Step 3 — Check delivery attempt count

High delivery attempt counts confirm the consumer is repeatedly failing on the same messages:

```bash
gcloud pubsub subscriptions pull dlq-sub \
  --limit=10 \
  --format=json \
  | jq '.[] | {
      messageId: .message.messageId,
      delivery_attempt: .message.attributes.delivery_attempt,
      source_subscription: .message.attributes.CloudPubSubDeadLetterSourceSubscription
    }'
```

If `delivery_attempt` is consistently at the `max_delivery_attempts` limit (e.g., 5), this is a systematic consumer failure, not a transient network issue.

### Step 4 — Check consumer logs for error patterns

For Cloud Run consumers:

```bash
# Filter Cloud Logging for the consumer service, last 2 hours
gcloud logging read \
  'resource.type="cloud_run_revision" resource.labels.service_name="esg-factor-consumer" severity>=ERROR' \
  --limit=50 \
  --format=json \
  | jq '.[] | {timestamp: .timestamp, message: .jsonPayload.message, messageId: .jsonPayload.messageId}'
```

For consumers running inside Airflow tasks:

```bash
# On the Airflow VM, check the task log for the subscriber task
docker exec airflow-scheduler airflow tasks logs \
  esg_pubsub_consumer \
  subscribe_esg_factors \
  2026-03-23T08:00:00+00:00
```

Common error patterns to look for:

| Error Pattern | Root Cause |
|---------------|------------|
| `jsonschema.ValidationError` | Message payload does not match expected schema |
| `KeyError: 'isin'` | Required field missing in message data |
| `ValueError: could not convert string to float` | Data type mismatch in a numeric ESG field |
| `google.api_core.exceptions.AlreadyExists` | Idempotency failure — downstream write conflict |
| `sqlalchemy.exc.OperationalError` | SQL Server write failure (check sql-server-disk-full) |

### Step 5 — Confirm whether the source data is malformed

Pull one message and validate it against the expected schema:

```bash
# Save a sample message to a file
gcloud pubsub subscriptions pull dlq-sub \
  --limit=1 \
  --format=json \
  | jq -r '.[0].message.data | @base64d' > /tmp/sample_dlq_message.json

cat /tmp/sample_dlq_message.json
```

Manually check for the most common ESG data issues:

- Missing `isin` or `score_date` fields
- `esg_score` value outside valid range (0–100)
- `score_date` format not matching `YYYY-MM-DD`
- `provider_id` referencing an unknown data provider code
- Message size exceeding 10 MB (Pub/Sub hard limit)

---

## Resolution

### RC-1: Fix the Consumer Code or Schema

This is the most common root cause. Once you identify the validation failure from Step 4–5:

1. Fix the consumer application code (Cloud Run service or Airflow DAG)
2. Build and push a new container image:

```bash
# Build and push updated consumer image
cd /path/to/consumer-service
docker build -t europe-west1-docker.pkg.dev/YOUR_PROJECT/consumers/esg-factor-consumer:hotfix-$(date +%Y%m%d) .
docker push europe-west1-docker.pkg.dev/YOUR_PROJECT/consumers/esg-factor-consumer:hotfix-$(date +%Y%m%d)

# Deploy the updated revision to Cloud Run
gcloud run deploy esg-factor-consumer \
  --image=europe-west1-docker.pkg.dev/YOUR_PROJECT/consumers/esg-factor-consumer:hotfix-$(date +%Y%m%d) \
  --region=europe-west1 \
  --platform=managed
```

3. Verify the new revision is serving traffic:

```bash
gcloud run revisions list --service=esg-factor-consumer --region=europe-west1
```

### RC-2: Replay DLQ Messages to the Primary Topic After Fix

After confirming the consumer fix is deployed, replay the DLQ messages through the primary topic:

**Option A: gcloud CLI (for small backlogs < 50 messages)**

```bash
# Pull all messages from DLQ and republish to the primary topic
# NOTE: This acknowledges messages from the DLQ as it reads them
MESSAGES=$(gcloud pubsub subscriptions pull dlq-sub \
  --limit=50 \
  --auto-ack \
  --format=json)

echo "${MESSAGES}" | jq -r '.[] | .message.data' | while read DATA; do
    gcloud pubsub topics publish esg-factors-topic --message="${DATA}"
done
```

**Option B: Python replay script (for large backlogs, recommended)**

```python
#!/usr/bin/env python3
"""
DLQ Replay Script
Pulls messages from DLQ subscription, republishes to primary topic.
Run after deploying consumer fix. Requires: google-cloud-pubsub
Usage: python dlq_replay.py --project YOUR_PROJECT --dlq-sub dlq-sub --target-topic esg-factors-topic
"""

import argparse
import base64
import json
import time
from google.cloud import pubsub_v1

def replay_dlq(project_id: str, dlq_subscription: str, target_topic: str,
               batch_size: int = 100, dry_run: bool = False) -> None:
    subscriber = pubsub_v1.SubscriberClient()
    publisher  = pubsub_v1.PublisherClient()

    sub_path   = subscriber.subscription_path(project_id, dlq_subscription)
    topic_path = publisher.topic_path(project_id, target_topic)

    total_replayed = 0
    total_failed   = 0

    print(f"Starting DLQ replay: {sub_path} -> {topic_path}")
    print(f"Dry run: {dry_run}")

    while True:
        response = subscriber.pull(
            request={"subscription": sub_path, "max_messages": batch_size}
        )

        if not response.received_messages:
            print(f"DLQ drained. Total replayed: {total_replayed}, failed: {total_failed}")
            break

        ack_ids = []
        for msg in response.received_messages:
            raw_data = msg.message.data
            attributes = dict(msg.message.attributes)

            # Remove DLQ-specific attributes before republishing
            attributes.pop("CloudPubSubDeadLetterSourceSubscription", None)
            attributes.pop("CloudPubSubDeadLetterSourceTopicPublishTime", None)
            attributes.pop("delivery_attempt", None)

            try:
                if not dry_run:
                    future = publisher.publish(topic_path, data=raw_data, **attributes)
                    future.result(timeout=10)
                total_replayed += 1
                ack_ids.append(msg.ack_id)
                print(f"  Replayed message {msg.message.message_id}")
            except Exception as e:
                total_failed += 1
                print(f"  FAILED to replay {msg.message.message_id}: {e}")

        if ack_ids and not dry_run:
            subscriber.acknowledge(request={"subscription": sub_path, "ack_ids": ack_ids})

        time.sleep(0.5)  # Avoid overwhelming the consumer on startup

    print(f"Replay complete. Replayed: {total_replayed}, Failed: {total_failed}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Replay Pub/Sub DLQ messages")
    parser.add_argument("--project",      required=True)
    parser.add_argument("--dlq-sub",      required=True)
    parser.add_argument("--target-topic", required=True)
    parser.add_argument("--batch-size",   type=int, default=100)
    parser.add_argument("--dry-run",      action="store_true",
                        help="Pull and log messages without republishing or acknowledging")
    args = parser.parse_args()

    replay_dlq(
        project_id=args.project,
        dlq_subscription=args.dlq_sub,
        target_topic=args.target_topic,
        batch_size=args.batch_size,
        dry_run=args.dry_run,
    )
```

Run the replay script:

```bash
# Dry run first — confirm messages look correct without side effects
python dlq_replay.py \
  --project YOUR_PROJECT \
  --dlq-sub dlq-sub \
  --target-topic esg-factors-topic \
  --dry-run

# Execute the actual replay
python dlq_replay.py \
  --project YOUR_PROJECT \
  --dlq-sub dlq-sub \
  --target-topic esg-factors-topic \
  --batch-size 100
```

### RC-3: Poison Messages — Acknowledge and Document (No Replay Possible)

Some messages are unrecoverable: the source data is fundamentally invalid, the originating system has been corrected, and replaying would write corrupt records.

```bash
# Pull and acknowledge (discard) a single known poison message by ack_id
ACK_ID="projects/YOUR_PROJECT/subscriptions/dlq-sub/ack-id-from-pull-output"
gcloud pubsub subscriptions acknowledge dlq-sub --ack-ids="${ACK_ID}"

# For a batch of poison messages, collect ack IDs and acknowledge in bulk
gcloud pubsub subscriptions pull dlq-sub \
  --limit=20 \
  --format=json \
  | jq -r '.[].ackId' > /tmp/poison_ack_ids.txt

# Review the ack IDs before acknowledging
cat /tmp/poison_ack_ids.txt

# Acknowledge all (this permanently discards the messages)
ACK_IDS=$(cat /tmp/poison_ack_ids.txt | tr '\n' ',' | sed 's/,$//')
gcloud pubsub subscriptions acknowledge dlq-sub --ack-ids="${ACK_IDS}"
```

> [!danger] Acknowledging DLQ messages is permanent
> Once acknowledged, messages cannot be recovered unless you have the raw data from the source system. Before acknowledging poison messages in bulk, save their payload to GCS for audit purposes.

Save poison message payloads before acknowledging:

```bash
gcloud pubsub subscriptions pull dlq-sub \
  --limit=50 \
  --format=json \
  | jq '.' > /tmp/poison_messages_$(date +%Y%m%d_%H%M%S).json

gcloud storage cp /tmp/poison_messages_*.json \
  gs://your-archive-bucket/pubsub-dlq-audit/$(date +%Y%m%d)/
```

### RC-4: DLQ Subscription Retention Expiry Risk

If the DLQ has been accumulating for days and messages are approaching the retention deadline (default: 7 days), urgent replay is needed before messages expire:

```bash
# Check oldest message age
gcloud pubsub subscriptions describe dlq-sub --format=json \
  | jq '.messageRetentionDuration'

# Extend retention temporarily to buy time (max 7 days = 604800s)
gcloud pubsub subscriptions modify-push-config dlq-sub \
  --message-retention-duration=604800s
```

Then proceed with replay (RC-2) immediately.

### RC-5: Set Up DLQ Monitoring Alert (If Not Exists)

If the team discovered this incident through manual observation rather than an alert, create the alert:

```bash
# Create a Cloud Monitoring alerting policy for DLQ depth
gcloud alpha monitoring policies create \
  --notification-channels=YOUR_NOTIFICATION_CHANNEL_ID \
  --display-name="Pub/Sub DLQ High Message Count" \
  --condition-display-name="DLQ undelivered messages > 100" \
  --condition-filter='resource.type="pubsub_subscription" AND resource.labels.subscription_id="dlq-sub" AND metric.type="pubsub.googleapis.com/subscription/num_undelivered_messages"' \
  --condition-threshold-value=100 \
  --condition-threshold-duration=300s \
  --condition-comparison=COMPARISON_GT \
  --condition-aggregation-alignment-period=60s \
  --condition-aggregation-per-series-aligner=ALIGN_MEAN
```

Also add a Datadog metric monitor if not present:

```yaml
# Datadog monitor configuration (apply via Terraform or Datadog UI)
# Monitor: pubsub.dlq.message_count > 100 for 5 minutes
name: "Pub/Sub DLQ High Message Count"
type: metric alert
query: "avg(last_5m):avg:gcp.pubsub.subscription.num_undelivered_messages{subscription_id:dlq-sub} > 100"
message: "@pagerduty Pub/Sub DLQ is accumulating. Check dlq-sub. Runbook: [[pubsub-dead-letter-backup]]"
thresholds:
  critical: 100
  warning: 25
```

---

## Verification

```bash
# 1. Confirm DLQ is draining
gcloud pubsub subscriptions describe dlq-sub \
  --format="value(numMessagesRetained)"
# Should be decreasing or zero

# 2. Confirm primary consumer is processing messages successfully
gcloud logging read \
  'resource.type="cloud_run_revision" resource.labels.service_name="esg-factor-consumer" severity>=INFO' \
  --limit=20 \
  --freshness=10m \
  --format=json \
  | jq '.[] | .jsonPayload.message' | grep -i "processed\|success"

# 3. Confirm BigQuery target tables have been updated for the affected ISINs
# Run in BQ console:
# SELECT isin, MAX(score_date) AS latest_score_date
# FROM `your_project.analytics.esg_scores`
# WHERE score_date >= CURRENT_DATE() - 1
# GROUP BY isin
# ORDER BY latest_score_date ASC
# LIMIT 20;

# 4. Confirm Cloud Monitoring alert has resolved
gcloud alpha monitoring policies list \
  --filter="displayName='Pub/Sub DLQ High Message Count'" \
  --format="value(enabled, name)"
```

---

## Escalation

| Condition | Action |
|-----------|--------|
| DLQ growing faster than it can be drained (> 1000 messages) | Escalate to data lead; pause the upstream producer temporarily |
| Consumer service cannot be redeployed (Cloud Run API unavailable) | Escalate to infra lead; check GCP status page |
| Messages contain PII or regulated data (e.g., counterparty data) | Do not save to local disk; use GCS with CMEK; notify compliance |
| DLQ retention about to expire (> 6 days old messages) | Immediately extend retention and begin emergency replay |
| Root cause is in upstream data provider feed | Notify vendor; trigger a re-delivery request via provider API or SFTP |

---

## Post-Incident

- [ ] Send resolution notice to #data-engineering-incidents with message count replayed and ISINs affected
- [ ] Validate ESG score completeness in BigQuery: check for gaps in `score_date` for affected securities
- [ ] Validate index constituent weights recalculated correctly if ESG scores feed into weighting
- [ ] Save poison message payloads to GCS for audit trail
- [ ] Schedule PIR within 48 hours
- [ ] Add schema validation logging to consumer (structured log with `message_id` and validation error detail)
- [ ] Update DLQ monitoring alert threshold if current threshold caused delayed detection

---

## Long-Term Prevention

| Action | Owner | Priority |
|--------|-------|----------|
| Add DLQ depth metric to main data engineering dashboard | Infra | High |
| Implement structured logging in all consumers (include `message_id`, `isin`, error type) | Data Eng | High |
| Add schema validation at the producer side (fail fast before publish) | Data Eng | High |
| Set `max_delivery_attempts = 5` and DLQ on all primary subscriptions | Infra | High |
| Build automated replay Cloud Run job triggered by DLQ alert | Data Eng | Medium |
| Add contract testing between producer schema and consumer schema in CI/CD | Data Eng | Medium |
| Implement Pub/Sub message schema registry (Pub/Sub Schema feature) | Infra | Medium |

---

## Related

- [[on-call-guide]]
- [[runbooks-index]]
- [[airflow-scheduler-down]]
- [[bigquery-quota-exceeded]]
- [[pubsub-messaging|Pub/Sub]]
- [[cloud-run-jobs-vs-services|Cloud Run deployment]]
