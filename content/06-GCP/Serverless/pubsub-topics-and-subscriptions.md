---
type: concept
category: gcp
technology: [gcp, pubsub]
tags: [infrastructure, gcp, pubsub]
aliases: [Pub/Sub topics, Pub/Sub subscriptions, gcloud pubsub, dead letter queue, push subscription, pull subscription]
keywords: [pubsub, pub/sub, topic, subscription, pull subscription, push subscription, dead letter, ack deadline, message retention, at-least-once delivery, acknowledgement, gcloud pubsub topics create, gcloud pubsub subscriptions create, decoupling, asynchronous messaging]
description: "How to create Pub/Sub topics and subscriptions — including pull vs push models, acknowledgement deadlines, message retention, and dead letter queues for failed message handling."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Pub/Sub Topics and Subscriptions

> [!quote]
> "The key in making great and growable systems is much more to design how its modules communicate rather than what their internal properties and behaviors should be."
>
> — **Alan Kay**, *The Early History of Smalltalk* (1993)

Pub/Sub decouples producers from consumers. Instead of pipeline stages calling each other directly (tight coupling), they publish events to topics and subscribe independently. This pattern enables retry logic, dead letter queues, and horizontal scaling without changing the producer code. A topic is the named channel; subscriptions are the delivery mechanisms. Multiple subscriptions on the same topic each receive all messages independently.

### Why Pub/Sub for Data Pipelines

```text
Without Pub/Sub (tight coupling):
  Stage A calls Stage B directly → Stage B failure blocks Stage A

With Pub/Sub (loose coupling):
  Stage A publishes to topic → Stage B subscribes and processes independently
  Stage B can retry, scale, or be replaced without touching Stage A
```

### Creating Pub/Sub Topics

```bash
# Create a topic
gcloud pubsub topics create pipeline-events
# A topic is a named channel that producers publish to
# Multiple subscriptions can receive messages from the same topic
```

### Creating Pub/Sub Pull Subscriptions

Pull subscriptions require the consumer to actively fetch messages. The consumer controls the rate of processing.

```bash
# Create a pull subscription (your consumer pulls messages)
gcloud pubsub subscriptions create pipeline-sub \
  --topic=pipeline-events \
  --ack-deadline=60 \
  --message-retention-duration=7d
```

> [!info] Subscription Flag Behavior
>
> - `--ack-deadline=60` gives the consumer 60 seconds to acknowledge each message. If the message is not acknowledged within that window, Pub/Sub redelivers it (at-least-once delivery).
> - `--message-retention-duration=7d` keeps messages for 7 days, enabling replay and debugging of past events.

> [!info] At-Least-Once Delivery
>
> Pub/Sub guarantees **at-least-once delivery**: every message will be delivered at least once, but may be delivered more than once. The `--ack-deadline` determines how long the consumer has to process and acknowledge a message before Pub/Sub considers it unacknowledged and redelivers it. Set the deadline to exceed your maximum expected processing time plus margin.

### Creating Pub/Sub Push Subscriptions

Push subscriptions have Pub/Sub deliver messages to an HTTP endpoint. Used for event-driven triggers to Cloud Run or Cloud Functions.

```bash
# Create a push subscription (Pub/Sub pushes to an HTTP endpoint)
gcloud pubsub subscriptions create pipeline-push \
  --topic=pipeline-events \
  --push-endpoint=https://my-service-xyz.run.app/pubsub
# Push subscriptions deliver messages to Cloud Run, Cloud Functions, or any HTTP endpoint
# Use for: event-driven triggers (pipeline step completed → trigger next step)
```

### Pub/Sub Dead Letter Topics

Dead letter topics capture messages that repeatedly fail processing. After a configurable number of delivery attempts, Pub/Sub stops trying to deliver the message to the main subscription and routes it to the dead letter topic instead.

```bash
# Create a dead letter topic (for messages that repeatedly fail processing)
gcloud pubsub topics create pipeline-events-dead-letter
gcloud pubsub subscriptions update pipeline-sub \
  --dead-letter-topic=pipeline-events-dead-letter \
  --max-delivery-attempts=5
# After 5 failed delivery attempts, the message goes to the dead letter topic
# You can inspect dead-lettered messages to understand why processing failed
```

> [!tip] Configure Dead Letter Topics
>
> Always Configure Dead Letter Topics in Production.
> Without a dead letter topic, a single unprocessable message (due to a malformed payload or a persistent consumer bug) will be retried indefinitely and can block all subsequent message processing. Dead letter topics isolate these "poison pill" messages so the rest of the queue can continue flowing.

### Pub/Sub Pull vs Push Comparison

| Feature | Pull | Push |
|---|---|---|
| Consumer controls rate | Yes | No (Pub/Sub controls) |
| Works with Cloud Run | Both, but push is simpler | Yes (native trigger) |
| Works offline consumers | Yes | No (requires HTTP endpoint) |
| Backpressure | Natural (consumer just stops pulling) | Configurable retry policy |
| Best for | Batch consumers, controlled throughput | Event-driven triggers, serverless |

## Related

- [pubsub-messaging](https://alp78.github.io/elysium/06-GCP/Serverless/pubsub-messaging) — Publishing messages to topics and consuming from subscriptions
- [cloud-run-jobs-vs-services](https://alp78.github.io/elysium/06-GCP/Serverless/cloud-run-jobs-vs-services) — Cloud Run Services are common push subscription endpoints
- [gcp-projects-and-apis](https://alp78.github.io/elysium/06-GCP/Core/gcp-projects-and-apis) — `pubsub.googleapis.com` must be enabled
- [service-accounts-and-iam](https://alp78.github.io/elysium/06-GCP/Security/service-accounts-and-iam) — `roles/pubsub.publisher` and `roles/pubsub.subscriber` roles
- [cloud-logging](https://alp78.github.io/elysium/06-GCP/Logging/cloud-logging) — Pub/Sub delivery failures appear in Cloud Logging

## References

- [Pub/Sub overview](https://cloud.google.com/pubsub/docs/overview)
- [Dead letter topics](https://cloud.google.com/pubsub/docs/dead-letter-topics)
- [Choosing pull vs push](https://cloud.google.com/pubsub/docs/pull)
