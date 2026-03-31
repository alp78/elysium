---
type: concept
category: gcp
technology: [gcp, pubsub]
tags: [infrastructure, gcp, pubsub]
aliases: [Pub/Sub publish, Pub/Sub consume, Pub/Sub pull, gcloud pubsub publish, message attributes, Pub/Sub backlog, ordering keys, exactly-once, idempotent]
keywords: [pubsub, publish, consume, pull, auto-ack, attributes, message ordering, ordering keys, exactly-once delivery, at-least-once, idempotent, backlog, num_undelivered_messages, pipeline lag, MERGE upsert]
description: "How to publish messages to Pub/Sub topics and consume them from subscriptions — including attributes, ordering keys, backlog monitoring, and the idempotency requirements of at-least-once delivery."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Pub/Sub Publishing and Consuming Messages

> [!quote]
> "The basic problem of communication is that of reproducing at one point either exactly or approximately a message selected at another point."
>
> — **Claude Shannon**, *A Mathematical Theory of Communication* (1948)

Publishing to a Pub/Sub topic is a single `gcloud pubsub topics publish` command. Consuming is a `gcloud pubsub subscriptions pull`. In practice, production systems use client libraries (Python `google-cloud-pubsub` -- see [24_py_streaming_realtime](https://alp78.github.io/elysium/02-Programming-Languages/Python/24_py_streaming_realtime), or C# -- see [24_cs_streaming_realtime](https://alp78.github.io/elysium/02-Programming-Languages/CSharp/24_cs_streaming_realtime)) for both operations, but the CLI commands are essential for testing, debugging, and verifying message flow. The most important operational concept is that Pub/Sub delivers messages **at least once**, which means consumers must be idempotent.

## Publishing Messages

#### gcloud pubsub topics publish — basic message publish
```bash
# Publish a message
gcloud pubsub topics publish pipeline-events \
  --message='{"event":"pipeline_complete","index":"market_index","status":"success"}'
```

#### gcloud pubsub topics publish --attribute — publish with metadata attributes
```bash
# Publish with attributes (metadata separate from the message body)
gcloud pubsub topics publish pipeline-events \
  --message='Pipeline stage complete' \
  --attribute=stage=gold,index=market_index,run_id=20260309_1700
# Attributes are key-value pairs that consumers can filter on without parsing the message body
```

> [!tip] Use Attributes for Filtering
>
> Pub/Sub supports server-side attribute filtering — subscriptions can be configured to only deliver messages matching specific attribute conditions. This means you can have one topic for all pipeline events but multiple subscriptions, each receiving only the events relevant to that consumer, without any client-side filtering.

## Consuming Messages

#### gcloud pubsub subscriptions pull --auto-ack — pull messages for testing
```bash
# Pull messages (for testing and debugging)
gcloud pubsub subscriptions pull pipeline-sub --limit=10 --auto-ack
# --auto-ack = acknowledge immediately (removes from the queue)
# Without --auto-ack: messages remain in the queue (peek without consuming)
```

> [!warning] Auto-Ack Is for Testing Only
>
> `--auto-ack` is for Testing Only.
> In production consumer code, never auto-acknowledge. Acknowledge only after successfully processing the message. If you auto-ack and your processing fails, the message is lost — no retry, no dead letter. Ack only on success.

### Monitoring the Pub/Sub Subscription Backlog

```bash
# Check subscription backlog (how many unprocessed messages?)
gcloud pubsub subscriptions describe pipeline-sub \
  --format="value(numUndeliveredMessages)"
# If this number is growing: your consumer is slower than your producer
# This is how you detect pipeline lag
```

A growing backlog is the primary indicator of pipeline lag. If messages arrive faster than they are consumed, the backlog grows, increasing end-to-end latency. The backlog metric is also available in [Cloud Monitoring](https://alp78.github.io/elysium/06-GCP/Logging/cloud-monitoring-metrics) at `pubsub.googleapis.com/subscription/num_undelivered_messages`.

### Pub/Sub Ordering Keys and Exactly-Once Delivery

> [!warning] Ordering and Exactly-Once
>
> Pub/Sub Ordering and Exactly-Once Delivery.
> By default, Pub/Sub does **NOT** guarantee message ordering. Messages may arrive out of order, and may be delivered more than once (at-least-once delivery). For data pipelines, this means:
>
> 1. **Your consumers must be idempotent.** If a message is delivered twice, processing it twice must produce the same result as processing it once. Use MERGE (upsert) instead of INSERT.
>
> 2. **If you need ordering**, use ordering keys: `--message-ordering-key=market_index` ensures all messages with the same key arrive in order. But this limits throughput to a single publisher thread per key.
>
> 3. **Exactly-once delivery** is available but requires enabling it on the subscription and adds latency.

### Pub/Sub Idempotency Requirement for At-Least-Once

Because Pub/Sub can redeliver messages, any pipeline stage consuming from Pub/Sub must be idempotent — processing the same message twice must be safe. The standard pattern:

- Use **MERGE/UPSERT** instead of INSERT when writing to BigQuery or SQL Server
- Include a **unique message ID** (Pub/Sub provides one in `messageId`) in your idempotency key
- Write to a **staging table first**, then merge to production — the merge is idempotent even if repeated

### Pub/Sub Message Format Best Practices

Structure messages as JSON with a consistent schema:
```json
{
  "event": "pipeline_stage_complete",
  "stage": "gold",
  "index": "market_index",
  "run_id": "20260322_1700",
  "timestamp": "2026-03-22T17:00:00Z",
  "rows_processed": 5432
}
```

Keep messages small (under 10 KB). For large payloads, store the data in GCS and publish a pointer (GCS URI) in the message body. For the broader architectural context of how Pub/Sub fits into event-driven pipelines, see [streaming-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/streaming-architecture).

## Related

- [pubsub-topics-and-subscriptions](https://alp78.github.io/elysium/06-GCP/Serverless/pubsub-topics-and-subscriptions) — Creating topics, subscriptions, and dead letter queues
- [cloud-run-jobs-vs-services](https://alp78.github.io/elysium/06-GCP/Serverless/cloud-run-jobs-vs-services) — Cloud Run Services often serve as push subscription endpoints
- [cloud-monitoring-metrics](https://alp78.github.io/elysium/06-GCP/Logging/cloud-monitoring-metrics) — Monitor `pubsub.googleapis.com/subscription/num_undelivered_messages`
- [querying-and-cost-optimization](https://alp78.github.io/elysium/06-GCP/BigQuery/querying-and-cost-optimization) — Using MERGE (upsert) to maintain idempotency when writing to BigQuery

## References

- [Publishing messages](https://cloud.google.com/pubsub/docs/publisher)
- [Subscribing to messages](https://cloud.google.com/pubsub/docs/subscriber)
- [Message ordering](https://cloud.google.com/pubsub/docs/ordering)
- [Exactly-once delivery](https://cloud.google.com/pubsub/docs/exactly-once-delivery)
