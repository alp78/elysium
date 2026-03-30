---
type: concept
category: data-architecture
technology: [gcp, python]
tags: [data-architecture, architecture, streaming, python, gcp]
aliases: [streaming architecture, Lambda architecture, Kappa architecture, event-driven architecture, real-time pipeline, stream processing, CDC, change data capture, event streaming, micro-batch, continuous processing, stream-first architecture]
keywords: [streaming, batch, micro-batch, Lambda architecture, Kappa architecture, event-driven, Kafka, Pub/Sub, Kinesis, Event Hubs, Spark Structured Streaming, Apache Flink, Apache Beam, Dataflow, ksqlDB, Debezium, SQL Server CDC, GCP Datastream, event sourcing, CQRS, exactly-once, at-least-once, tumbling window, sliding window, session window, watermark, late data, reprocessing, replay, real-time analytics, stream processing, CDC, change data capture, producer, consumer, broker, topic, partition, consumer group, offset, backpressure, checkpointing, state store, windowing]
description: "Streaming architecture patterns — Lambda, Kappa, and event-driven — covering batch vs streaming trade-offs, message broker comparisons (Kafka, Pub/Sub, Kinesis), stream processing engines (Flink, Beam/Dataflow, Spark Structured Streaming), CDC tools (Debezium, GCP Datastream), and the GCP canonical streaming stack."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Streaming Architecture

> [!quote]
> "A log is perhaps the simplest possible storage abstraction. It is an append-only, totally-ordered sequence of records ordered by time."
> — **Jay Kreps** (creator of Apache Kafka)

Streaming architecture is any data system design where data is processed continuously as it arrives — events are consumed and acted upon within milliseconds to seconds, rather than being collected and processed in large batches hours later. It encompasses the message brokers that carry events, the processing engines that transform them, the patterns that govern their semantics (Lambda, Kappa, CQRS, event sourcing), and the windowing strategies that handle the inherent challenges of time-ordered distributed data.

The canonical GCP streaming stack — [Pub/Sub](https://alp78.github.io/elysium/06-GCP/Serverless/pubsub-messaging) → Dataflow (Apache Beam) → BigQuery — is the reference implementation for this vault. But understanding the landscape of alternatives is essential: Kafka dominates outside GCP, Flink is the leading stateful streaming engine globally, and CDC (Change Data Capture) is how streaming connects to existing relational databases. For Python and C# implementations of streaming patterns, see [24_py_streaming_realtime](https://alp78.github.io/elysium/02-Programming-Languages/Python/24_py_streaming_realtime) and [24_cs_streaming_realtime](https://alp78.github.io/elysium/02-Programming-Languages/CSharp/24_cs_streaming_realtime) respectively.

---

### Batch vs Streaming vs Micro-Batch

These three processing models represent fundamentally different trade-offs between latency, throughput, cost, and operational complexity:

| Dimension | Batch | Micro-Batch | Streaming |
|---|---|---|---|
| **Trigger** | Scheduled (hourly, daily) | Time-based intervals (1–60 seconds) | Event-driven — continuous |
| **Latency** | Minutes to hours | Seconds to minutes | Milliseconds to seconds |
| **Throughput** | Very high — optimized for large volumes | High | Moderate to high |
| **State management** | Stateless by design; state lives in the database | Stateful per micro-batch window | Stateful — maintained in memory/RocksDB |
| **Exactly-once** | Easy — idempotent batch loads; see [idempotent-pipeline-design](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design) | Hard — requires transactional commits per batch | Hard — requires distributed checkpointing |
| **Reprocessing** | Easy — re-run the batch job | Moderate — replay from source topic | Hard — requires log retention and replay |
| **Late data handling** | N/A — all data collected before job starts | Limited watermark support | Full watermark and late-event policies |
| **Infrastructure cost** | Low at rest — compute runs briefly | Moderate — compute runs frequently | High — compute runs 24/7 |
| **Operational complexity** | Low | Moderate | High |
| **Tooling** | Airflow + Spark, dbt, SQL | Spark Structured Streaming | Flink, Kafka Streams, ksqlDB, Dataflow |
| **Typical use cases** | Nightly warehouse loads, reporting | Dashboard refresh, near-real-time KPIs | Fraud detection, real-time recommendations |

> [!tip] Micro-Batch is Often the Right Compromise
> Pure streaming (millisecond latency) is expensive and operationally demanding. Most "real-time" business requirements actually need data within 1–5 minutes — which micro-batch (Spark Structured Streaming, Dataflow with windowing) handles at far lower cost and complexity. Before building a streaming system, confirm the latency requirement is genuine.

---

## Lambda Architecture

The Lambda architecture (Nathan Marz, 2011) addresses a real problem: batch systems produce accurate results but lag by hours; streaming systems are fast but can lose or mishandle late-arriving data. Lambda's solution is to run both simultaneously.

### Components

```
                    ┌─────────────────────────────────────────────┐
Raw Event Stream ──►│              MESSAGE BROKER                  │
(all events)        │         (Kafka / Pub/Sub / Kinesis)          │
                    └──────────────┬──────────────┬───────────────┘
                                   │              │
                    ┌──────────────▼──┐  ┌────────▼───────────────┐
                    │   BATCH LAYER   │  │     SPEED LAYER         │
                    │ (Spark on HDFS, │  │ (Flink / Kafka Streams  │
                    │  BigQuery, etc.)│  │  / Storm)               │
                    │                │  │                          │
                    │ Recomputes ALL  │  │ Processes only recent   │
                    │ data nightly.   │  │ events. Fast but approx.│
                    │ Authoritative.  │  │ Results overwritten by   │
                    │                │  │ batch when batch catches │
                    └──────┬─────────┘  └────────┬───────────────┘
                           │                     │
                    ┌──────▼─────────────────────▼───────────────┐
                    │              SERVING LAYER                   │
                    │    (Cassandra, HBase, BigQuery, Redis)       │
                    │  Merges batch view + speed view at query time │
                    └─────────────────────────────────────────────┘
```

### How the Layers Work

**Batch layer:** stores the master dataset (all raw events, immutable) and recomputes batch views — typically a full reprocessing of all historical data — on a schedule (nightly, hourly). The output is authoritative and accurate, but delayed.

**Speed layer:** processes the same event stream in real time, producing approximate or partial results for the window of data not yet covered by the latest batch view. When the next batch view is computed, the speed layer's results for that period are discarded.

**Serving layer:** receives both batch views and speed views and merges them at query time. A dashboard query for "revenue today" returns the batch result for data through midnight plus the speed layer result for data since midnight.

### Lambda Architecture Pros and Cons

#### Pros
- Handles late-arriving data correctly — batch layer reprocesses with full dataset, correcting any errors the speed layer made.
- Batch results are always authoritative — if the speed layer has a bug, the batch layer corrects it in the next run.
- Can use best-of-breed tools for each layer (Spark for batch, Flink for speed).
- Provides graceful degradation — if the speed layer fails, the system falls back to batch-only mode.

#### Cons
- **Dual codebases.** The same business logic (e.g., "calculate revenue") must be implemented twice — once in batch (Spark SQL) and once in streaming (Flink). They will diverge. This is the primary operational cost and the main reason Lambda architecture is being replaced.
- **Serving layer complexity.** Merging batch and speed views at query time is non-trivial and a common source of subtle bugs.
- **High infrastructure cost.** Two separate processing systems (batch + streaming) with different operational models.
- **Delayed correctness.** Results are not authoritative until the batch layer catches up — which can be hours.

> [!warning] Lambda's Dual Codebase Problem
> In practice, the batch and speed layer implementations inevitably diverge. A bug is fixed in one but not the other. A new business rule is added to batch but forgotten in speed. The speed layer shows 10,000 events; the batch layer shows 9,847. Which is correct? Lambda's main failure mode is the complexity of maintaining two implementations of the same logic in different paradigms.

---

## Kappa Architecture

The Kappa architecture (Jay Kreps, LinkedIn, 2014) is a direct response to Lambda's dual-codebase problem. Its thesis: if you can reprocess the entire event log from scratch (because you retained it in Kafka), you do not need a separate batch layer. Everything is streaming.

### Components

```
                    ┌────────────────────────────────────────────┐
Raw Event Stream ──►│           MESSAGE BROKER                   │
(all events,        │      (Kafka — long retention,               │
 long retention)    │       compacted topics, replay)            │
                    └──────────────┬─────────────────────────────┘
                                   │  consumed by ONE processing system
                    ┌──────────────▼─────────────────────────────┐
                    │         STREAM PROCESSING ENGINE            │
                    │    (Flink / Kafka Streams / Beam)           │
                    │                                             │
                    │  Single codebase for ALL processing.        │
                    │  Reprocessing = replay from offset 0.       │
                    │  New logic version = run new job in         │
                    │  parallel, cutover, remove old.             │
                    └──────────────┬─────────────────────────────┘
                                   │
                    ┌──────────────▼─────────────────────────────┐
                    │            SERVING LAYER                    │
                    │  (BigQuery, Iceberg, Redis, Cassandra)      │
                    └─────────────────────────────────────────────┘
```

### Reprocessing in Kappa

When business logic changes, reprocessing works like this:
1. Start a new version of the streaming job (v2) reading from offset 0 in Kafka.
2. Let v2 process all historical data in parallel with v1, writing to a new output table/topic.
3. Once v2 has caught up to the present (its consumer lag reaches zero), swap the serving layer to v2's output.
4. Stop v1, delete its output.

This requires that Kafka topics retain sufficient history — typically 7–90 days, or use a compacted topic for tables with finite state.

### Lambda vs Kappa Comparison

| Dimension | Lambda | Kappa |
|---|---|---|
| **Codebases** | Two (batch + streaming) | One (streaming only) |
| **Consistency** | Batch is authoritative; speed layer can diverge | Single codebase — no divergence |
| **Reprocessing** | Re-run batch job (easy, but separate system) | Replay Kafka topic from offset 0 |
| **Infrastructure** | Complex — two systems, one serving layer merges | Simpler — one processing system |
| **Late data** | Batch layer corrects at next run | Watermarks + reprocessing handles it |
| **Tooling expertise** | Spark (batch) + Flink (streaming) | Flink or Kafka Streams only |
| **Kafka retention cost** | Retention optional (batch reads from source) | Long retention required (weeks/months) |
| **Best for** | Highly accurate historical aggregates + real-time | Systems where single codebase simplicity outweighs reprocessing cost |

> [!info] Modern Consensus: Kappa + Open Table Formats
> The current industry consensus is converging toward Kappa-style single-codebase streaming, with Apache Iceberg or Delta Lake as the serving layer. Iceberg's time travel enables point-in-time accuracy without a batch recompute. Flink writing to Iceberg with exactly-once semantics provides accurate, low-latency results without dual codebases. This is the [lakehouse](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/lakehouse-architecture) + Kappa combination.

---

## Event-Driven Architecture

Event-driven architecture (EDA) is a broader pattern — not just for data pipelines, but for entire system design — where components communicate by producing and consuming events. Data streaming pipelines are a specialization of EDA.

### Core Components

**Producers:** services or systems that generate events and publish them to a broker. A producer does not know who will consume its events — it fires and forgets.

**Message brokers (topics):** durable, ordered, replayable logs of events. The broker is the decoupling point — producers and consumers are independent.

**Consumers (consumer groups):** services or jobs that subscribe to topics and process events. Multiple consumers can process the same event independently (fan-out). Within a consumer group, each partition is assigned to one consumer for ordered processing.

**Event schema:** the contract between producers and consumers. Must be versioned and registered in a schema registry to prevent breaking changes.

```
┌────────────────┐        ┌──────────────────────┐        ┌────────────────────┐
│  PRODUCER      │        │   MESSAGE BROKER      │        │  CONSUMER          │
│                │        │                       │        │                    │
│  Payments API  │──────► │  payments.events      │──────► │  Risk scoring job  │
│  Orders svc    │──────► │  orders.completed     │──────► │  Finance analytics │
│  Inventory svc │──────► │  inventory.changes    │──────► │  Audit logger      │
└────────────────┘        └──────────────────────┘        └────────────────────┘
                           (Kafka / Pub/Sub / Kinesis)
```

---

### Message Broker Comparison

| Dimension | Apache Kafka | GCP Pub/Sub | AWS Kinesis | Azure Event Hubs |
|---|---|---|---|---|
| **Deployment model** | Self-managed (or Confluent Cloud) | Fully managed, serverless | Fully managed | Fully managed |
| **Retention model** | Log-based, configurable retention (hours to forever) | Message-based, max 7 days | Shard-based, 1–365 days | Partition-based, 1–90 days |
| **Replay / rewind** | Yes — seek to any offset, from offset 0 | No — once ACKed, gone | Yes — per shard |  Yes — per partition |
| **Ordering** | Per-partition ordering | No global ordering (best-effort) | Per-shard ordering | Per-partition ordering |
| **Throughput** | Extremely high — millions of events/sec | Very high — auto-scales | High — scales with shards | High — scales with partitions |
| **Consumer groups** | Native concept — each group tracks its own offset | Subscription model — each subscription gets all messages | Shard iterator per consumer | Consumer group concept |
| **Schema registry** | Confluent Schema Registry (separate) | Not native (use Protobuf + registry) | Not native | Not native |
| **GCP integration** | Dataproc/Flink, Kafka Connector for BQ | Native — Dataflow, Cloud Run, BigQuery | N/A (AWS) | N/A (Azure) |
| **Pricing model** | Infrastructure cost (Confluent: GB + connectors) | Per-message volume | Per-shard-hour + GB | Per-throughput-unit + GB |
| **Lock-in** | Low — open protocol, portable | High — GCP-specific | High — AWS-specific | High — Azure-specific |
| **When to choose** | Multi-engine, cross-cloud, replay required, Kafka ecosystem | GCP-native, serverless, simple fan-out | AWS-native streaming | Azure-native streaming |

> [!tip] GCP Recommendation: Pub/Sub for Simplicity, Kafka for Portability
> If you are fully committed to GCP, [Pub/Sub](https://alp78.github.io/elysium/06-GCP/Serverless/pubsub-topics-and-subscriptions) is the right choice — serverless, no operational overhead, native Dataflow integration. If you need cross-cloud portability, replay to offset 0, or the Kafka Connect ecosystem (hundreds of pre-built connectors), run Kafka on Dataproc or use Confluent Cloud.

---

## Stream Processing Engine Comparison

| Engine | Model | State Management | Exactly-Once | Best For |
|---|---|---|---|---|
| **Apache Flink** | True streaming (event-by-event) | RocksDB state backend; distributed snapshots | Yes (with Kafka + Iceberg sinks) | Complex stateful processing, CEP, low-latency |
| **Apache Beam / Dataflow** | Unified batch + streaming model | Persistent state in Dataflow runner | Yes | GCP-native, unified batch/stream codebase |
| **Spark Structured Streaming** | Micro-batch (default) or continuous | In-memory + checkpoint | Yes (micro-batch) | Teams already using Spark; batch/stream parity |
| **Kafka Streams** | Micro-batch + true streaming | RocksDB (local) | Yes | Lightweight, Kafka-native, no separate cluster |
| **ksqlDB** | SQL over Kafka streams | Materialized tables | Yes | SQL-based stream processing; no JVM code |
| **Apache Storm** | True streaming (older) | External (Redis, etc.) | At-least-once (default) | Legacy systems; largely superseded by Flink |

### Apache Flink: Key Concepts

Flink is the leading stateful stream processing engine. Its core strengths:

**Checkpointing:** Flink periodically snapshots the state of all operators to durable storage (GCS, S3, HDFS). On failure, Flink restarts from the last checkpoint, replaying input from that position — enabling exactly-once processing.

**Savepoints:** manually triggered, full-state snapshots used for planned restarts (upgrades, migrations). Unlike checkpoints, savepoints are not deleted automatically.

**Watermarks:** mechanism for handling event-time ordering in distributed systems (see Windowing section below).

#### State backends
- `HashMapStateBackend`: in-memory, fast, limited by heap size. Good for development.
- `EmbeddedRocksDBStateBackend`: persistent on-disk state using RocksDB. Handles state larger than memory. Required for production.

#### Flink writing to Iceberg with exactly-once
```java
// Apache Flink — Iceberg sink with exactly-once semantics (Java)
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.apache.iceberg.flink.sink.FlinkSink;
import org.apache.flink.streaming.api.datastream.DataStream;

StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();

// Enable checkpointing — required for exactly-once
env.enableCheckpointing(60_000L);  // checkpoint every 60 seconds

DataStream<RowData> stream = ...; // your Kafka source

// Write to Iceberg table on GCS with exactly-once
FlinkSink.forRowData(stream)
    .tableLoader(TableLoader.fromHadoopTable("gs://my-bucket/warehouse/events"))
    .overwrite(false)
    .build();

env.execute("Events to Iceberg");
```

#### Apache Beam / Dataflow (GCP)

Beam provides a unified programming model that runs on multiple runners (Dataflow, Spark, Flink). Dataflow is the GCP-managed runner — serverless, autoscaling, no cluster management.

```python
# Apache Beam — Pub/Sub to BigQuery pipeline (Python)
import apache_beam as beam
from apache_beam.options.pipeline_options import PipelineOptions
from apache_beam.io.gcp.bigquery import WriteToBigQuery, BigQueryDisposition

options = PipelineOptions(
    runner="DataflowRunner",
    project="my-project",
    region="us-central1",
    temp_location="gs://my-bucket/temp",
    streaming=True,  # Enable streaming mode
)

def parse_event(message):
    """Parse a Pub/Sub message into a BigQuery row."""
    import json
    data = json.loads(message.decode("utf-8"))
    return {
        "event_id":    data["event_id"],
        "event_type":  data["event_type"],
        "amount_usd":  data["amount_usd"],
        "user_id":     data["user_id"],
        "event_ts":    data["timestamp"],
    }

with beam.Pipeline(options=options) as p:
    (
        p
        | "Read from Pub/Sub" >> beam.io.ReadFromPubSub(
            subscription="projects/my-project/subscriptions/events-sub"
          )
        | "Parse JSON"        >> beam.Map(parse_event)
        | "Write to BigQuery" >> WriteToBigQuery(
            table="my-project:my_dataset.events",
            schema={
                "fields": [
                    {"name": "event_id",   "type": "STRING",    "mode": "REQUIRED"},
                    {"name": "event_type", "type": "STRING",    "mode": "REQUIRED"},
                    {"name": "amount_usd", "type": "FLOAT64",   "mode": "NULLABLE"},
                    {"name": "user_id",    "type": "STRING",    "mode": "REQUIRED"},
                    {"name": "event_ts",   "type": "TIMESTAMP", "mode": "REQUIRED"},
                ]
            },
            create_disposition=BigQueryDisposition.CREATE_IF_NEEDED,
            write_disposition=BigQueryDisposition.WRITE_APPEND,
          )
    )
```

---

## Change Data Capture (CDC)

Change Data Capture is the technique of streaming changes from a relational database (inserts, updates, deletes) into a streaming pipeline, without requiring the application to publish events explicitly. CDC reads the database's internal transaction log — not the application layer.

### Why CDC Matters

- **No application code change required.** The database already logs every change; CDC just reads that log.
- **Low latency.** Changes are available within milliseconds of being committed.
- **Complete change history.** Inserts, updates, AND deletes — a standard SELECT query cannot capture deletes.
- **Enables real-time lakehouse.** CDC streams database changes into [lakehouse](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/lakehouse-architecture) tables (Iceberg, Delta) keeping an analytical copy current.

### CDC Tools

| Tool | Source Systems | Notes |
|---|---|---|
| **Debezium** | MySQL, PostgreSQL, SQL Server, Oracle, MongoDB, DB2 | Open source; runs as Kafka Connect connector; CDC via transaction log |
| **SQL Server CDC** | SQL Server only | Native SQL Server feature; enables capture of changes at table level; Debezium reads this |
| **GCP Datastream** | MySQL, PostgreSQL, Oracle, SQL Server | Managed GCP service; outputs to GCS or directly to BigQuery |
| **AWS DMS** | Most relational databases | AWS managed; outputs to Kinesis, S3, RDS |
| **Airbyte** | 300+ sources (APIs, databases) | Open source ELT platform; CDC supported for select databases |
| **Fivetran** | 300+ connectors | Fully managed; expensive but zero operational overhead |
| **Estuary Flow** | Databases, APIs, files | CDC-first design; built on Gazette (distributed log) |

### Debezium + Kafka: Architecture

```
SQL Server / PostgreSQL          Debezium (Kafka Connect)     Kafka Topics
──────────────────────────────────────────────────────────────────────────
Transaction log  ──────────────►  Reads WAL / CDC log  ──►  db.orders (Avro)
(WAL / CDC log)                   Publishes CDC events  ──►  db.customers
                                  Schema in registry    ──►  db.payments
```

#### SQL Server CDC: enabling on a table
```sql
-- Enable CDC on the SQL Server database (requires sysadmin)
EXEC sys.sp_cdc_enable_db;
GO

-- Enable CDC on a specific table
EXEC sys.sp_cdc_enable_table
    @source_schema = N'dbo',
    @source_name   = N'orders',
    @role_name     = NULL,
    @supports_net_changes = 1;
GO

-- Query the CDC change table — shows all changes since a given LSN
SELECT
    __$operation,  -- 1=delete, 2=insert, 3=update_before, 4=update_after
    __$start_lsn,
    order_id,
    amount,
    status,
    updated_at
FROM cdc.dbo_orders_CT
WHERE __$start_lsn > @last_processed_lsn
ORDER BY __$start_lsn;
```

#### GCP Datastream: stream SQL Server changes to BigQuery
```bash
# Create a Datastream connection profile for SQL Server source
gcloud datastream connection-profiles create sql-server-source \
  --location=us-central1 \
  --type=sql-server \
  --display-name="SQL Server CDC Source" \
  --static-service-ip-connectivity \
  --sql-server-hostname=10.0.0.5 \
  --sql-server-port=1433 \
  --sql-server-username=datastream_user \
  --sql-server-password-secret-version=projects/my-project/secrets/ds-pass/versions/latest

# Create BigQuery destination profile
gcloud datastream connection-profiles create bigquery-dest \
  --location=us-central1 \
  --type=bigquery \
  --display-name="BigQuery CDC Destination"

# Create the stream (SQL Server CDC → BigQuery)
gcloud datastream streams create orders-cdc-stream \
  --location=us-central1 \
  --display-name="Orders CDC to BigQuery" \
  --source=sql-server-source \
  --sql-server-excluded-objects='' \
  --destination=bigquery-dest \
  --bigquery-dataset-template="{_schema}" \
  --backfill-all
```

---

## Key Streaming Patterns

### Streaming Pattern — Event Sourcing

In event sourcing, the system's state is derived entirely from an immutable log of events — the events are the source of truth, not the current state in a database table.

```
Traditional:               Event Sourcing:
──────────────────         ────────────────────────────────────────────
orders table               events log (append-only, immutable)
order_id | status          ────────────────────────────────────────────
1001     | fulfilled       {event: "order_placed",   order_id: 1001, ts: T1}
                           {event: "payment_received", order_id: 1001, ts: T2}
                           {event: "order_fulfilled",  order_id: 1001, ts: T3}

                           Current state = replay all events for order 1001
                           State at T2   = replay only events up to T2
```

Benefits: complete audit trail, point-in-time state reconstruction, natural CDC (the event log IS the change log).

### Streaming Pattern — CQRS (Command Query Responsibility Segregation)

CQRS separates the write model (commands that change state) from the read model (queries that read state). [Firestore](https://alp78.github.io/elysium/06-GCP/Firestore/real-time-nosql-pipelines) is a natural fit for the read-side materialized view in CQRS, providing real-time sync to client applications. In a streaming context:

```
Write Side (Command)           Event Stream          Read Side (Query)
──────────────────────────────────────────────────────────────────────
API receives command   ──►  events published  ──►  Stream processor
(place order)               to Kafka/Pub/Sub        materializes read models:
Validates, executes                                   - orders_by_status table
Emits event to topic                                  - customer_order_history
                                                      - revenue_by_product
```

CQRS is powerful but adds system complexity. Use it when your read and write models have fundamentally different requirements (e.g., high-throughput writes but complex aggregation queries).

### Streaming Pattern — Exactly-Once Semantics

Distributed streaming systems can guarantee one of three delivery semantics:

| Semantic | Guarantee | Risk |
|---|---|---|
| **At-most-once** | Every message processed 0 or 1 times | Data loss — failures may skip messages |
| **At-least-once** | Every message processed 1 or more times | Duplicates — failures cause reprocessing; consumers must be idempotent |
| **Exactly-once** | Every message processed exactly once | Requires coordination between broker, processor, and sink; highest overhead |

#### Exactly-once in Kafka
- Kafka producers: `transactional.id` + `enable.idempotence=true`
- Kafka Streams: `processing.guarantee=exactly_once_v2`
- Flink + Kafka: two-phase commit protocol between Flink's checkpoint and Kafka's transaction coordinator

> [!warning] Exactly-Once Is Not Magic
> "Exactly-once" in streaming applies to the broker-to-processor-to-sink path. It does not protect against logic bugs (processing an event twice because your code has a bug), external system failures (the sink database rejecting a write), or clock skew. Always design for [idempotency](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design) at the application level as a defense in depth.

---

## Windowing: Tumbling, Sliding, and Session Windows

Windowing is how stream processors group events into finite sets for aggregation. Because events arrive continuously, you must define a time boundary to compute a meaningful aggregate ("revenue in the last 5 minutes").

### Window Types

**Tumbling windows:** fixed-duration, non-overlapping. Every event belongs to exactly one window.
```
Events:    e1 e2 e3  |  e4 e5  |  e6 e7 e8 e9
Tumbling:  [-- 5 min --][- 5 min-][---- 5 min ---]
```

**Sliding windows:** fixed-duration, overlapping by a slide interval. An event may belong to multiple windows.
```
Events:    e1 e2 e3 e4 e5 e6 e7
Window 1:  [-- 10 min --------]
Window 2:       [-- 10 min --------]
Window 3:            [-- 10 min --------]
Slide:     5 minutes
```

**Session windows:** variable-duration, defined by inactivity gaps. A session closes when no events arrive within the gap duration.
```
Events:    e1 e2 e3      e4         e5 e6 e7 e8
Session:   [--- session -]  (gap)   [------ session ------]
Gap:       30-second inactivity closes the session
```

### Flink Windowing in Java

```java
// Apache Flink — windowed aggregations (Java)
import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.windowing.assigners.*;
import org.apache.flink.streaming.api.windowing.time.Time;

DataStream<Event> events = ...; // from Kafka source

// Tumbling window: revenue per product per 5-minute window
events
    .keyBy(Event::getProductId)
    .window(TumblingEventTimeWindows.of(Time.minutes(5)))
    .aggregate(new RevenueAggregator())
    .print();

// Sliding window: 10-minute window, sliding every 1 minute
events
    .keyBy(Event::getUserId)
    .window(SlidingEventTimeWindows.of(Time.minutes(10), Time.minutes(1)))
    .aggregate(new PageviewAggregator())
    .print();

// Session window: user session closes after 30 minutes of inactivity
events
    .keyBy(Event::getUserId)
    .window(EventTimeSessionWindows.withGap(Time.minutes(30)))
    .aggregate(new SessionAggregator())
    .print();
```

#### Beam windowing in Python
```python
import apache_beam as beam
from apache_beam.transforms.window import FixedWindows, SlidingWindows, Sessions

# Tumbling (Fixed) window: 5-minute windows
events | "Fixed Windows" >> beam.WindowInto(FixedWindows(5 * 60))

# Sliding window: 10-minute window every 1 minute
events | "Sliding Windows" >> beam.WindowInto(SlidingWindows(10 * 60, 1 * 60))

# Session window: close after 30 minutes of inactivity
events | "Session Windows" >> beam.WindowInto(Sessions(30 * 60))
```

---

## Watermarks and Late Data Handling

In event-time processing, events carry a timestamp that represents *when the event occurred* — not when it was received by the processing engine. Events can arrive out of order and late (network delays, mobile apps syncing after being offline). Watermarks tell the stream processor how far behind event time is allowed to lag before a window is closed.

```
Event time:     09:00  09:01  09:02  09:03  09:04  09:05
                  │      │      │      │      │      │
Processing time:  ─────────────────────────────────────► (now: 09:06)

Watermark at 09:03 means:
  "I believe all events with timestamp ≤ 09:03 have arrived.
   I will now close and emit the 09:00–09:05 window."

Late event: arrives at processing time 09:06 with event time 09:01
  → Falls behind the watermark
  → Either DISCARDED or sent to a side output for separate handling
```

#### Strategies for late data

1. **Discard:** ignore events that arrive after the watermark. Simple, but loses data. Acceptable when late events are rare and business impact is low.
2. **Side output (Flink/Beam):** route late events to a separate stream for separate processing or logging.
3. **Allowed lateness:** extend the window to wait for late events for a defined period after the watermark. The window can update and re-emit corrected results.
4. **Reprocessing:** accept that streaming results are approximate; batch reprocessing (Kappa-style or Lambda batch layer) corrects them.

#### Flink watermark strategy
```java
// Flink — bounded out-of-orderness watermark strategy (Java)
import org.apache.flink.api.common.eventtime.WatermarkStrategy;
import java.time.Duration;

DataStream<Event> withTimestamps = rawStream
    .assignTimestampsAndWatermarks(
        WatermarkStrategy
            .<Event>forBoundedOutOfOrderness(Duration.ofSeconds(30))
            .withTimestampAssigner((event, ts) -> event.getEventTimestampMs())
    );
```

---

## GCP Streaming Stack: Pub/Sub → Dataflow → BigQuery

This is the canonical GCP real-time pipeline architecture:

```
Data Sources            GCP Services                     Destinations
────────────────────────────────────────────────────────────────────────
Application events ──►  Cloud Pub/Sub  ──►  Dataflow  ──►  BigQuery
Database CDC       ──►  Datastream     ──►  (Beam)    ──►  Cloud Storage
IoT devices        ──►  IoT Core       ──►             ──►  Bigtable
Files on GCS       ──►                                ──►  Firestore
```

#### GCP Streaming to BigQuery — why this stack
- **Pub/Sub** is serverless, globally distributed, and deeply integrated with every GCP service. It handles spikes without capacity planning. See [pubsub-topics-and-subscriptions](https://alp78.github.io/elysium/06-GCP/Serverless/pubsub-topics-and-subscriptions) for setup and [pubsub-messaging](https://alp78.github.io/elysium/06-GCP/Serverless/pubsub-messaging) for publish/consume patterns.
- **Dataflow** (Apache Beam runner) is fully managed — no cluster to size, patch, or scale. It auto-scales workers based on backlog. The unified batch+stream model means one Beam pipeline handles both historical backfill and live streaming.
- **BigQuery** is the serving layer — serverless SQL, no indexes to manage, sub-second query latency on petabytes, native streaming insert API.
- **Cloud Logging + Monitoring:** see [cloud-logging](https://alp78.github.io/elysium/06-GCP/Logging/cloud-logging) and [cloud-monitoring-metrics](https://alp78.github.io/elysium/06-GCP/Logging/cloud-monitoring-metrics) for pipeline observability.

#### End-to-end GCP streaming pipeline with Dataflow
```python
# Complete Pub/Sub → Dataflow → BigQuery streaming pipeline
import apache_beam as beam
from apache_beam.options.pipeline_options import PipelineOptions, StandardOptions
from apache_beam.io.gcp.bigquery import WriteToBigQuery, BigQueryDisposition
import json
import logging

class ParseAndEnrich(beam.DoFn):
    """Parse Pub/Sub message and add processing metadata."""
    def process(self, element, timestamp=beam.DoFn.TimestampParam):
        try:
            record = json.loads(element.decode("utf-8"))
            record["processing_ts"] = str(timestamp)
            record["pipeline_version"] = "2.0"
            yield record
        except (json.JSONDecodeError, KeyError) as e:
            logging.error(f"Failed to parse message: {e}")
            # Route to dead letter queue
            yield beam.pvalue.TaggedOutput("dead_letter", element)

def run():
    options = PipelineOptions(
        runner="DataflowRunner",
        project="my-project",
        region="us-central1",
        job_name="events-to-bigquery",
        temp_location="gs://my-bucket/dataflow/temp",
        staging_location="gs://my-bucket/dataflow/staging",
        max_num_workers=50,
        autoscaling_algorithm="THROUGHPUT_BASED",
        streaming=True,
    )

    bq_schema = {
        "fields": [
            {"name": "event_id",         "type": "STRING",    "mode": "REQUIRED"},
            {"name": "user_id",          "type": "STRING",    "mode": "REQUIRED"},
            {"name": "event_type",       "type": "STRING",    "mode": "REQUIRED"},
            {"name": "amount_usd",       "type": "FLOAT64",   "mode": "NULLABLE"},
            {"name": "processing_ts",    "type": "TIMESTAMP", "mode": "REQUIRED"},
            {"name": "pipeline_version", "type": "STRING",    "mode": "REQUIRED"},
        ]
    }

    with beam.Pipeline(options=options) as p:
        parsed, dead_letter = (
            p
            | "Read Pub/Sub"  >> beam.io.ReadFromPubSub(
                subscription="projects/my-project/subscriptions/events-sub",
                with_attributes=False,
              )
            | "Parse + Enrich" >> beam.ParDo(ParseAndEnrich()).with_outputs(
                "dead_letter", main="parsed"
              )
        )

        # Main path — write to BigQuery
        parsed | "Write to BigQuery" >> WriteToBigQuery(
            table="my-project:analytics.events",
            schema=bq_schema,
            create_disposition=BigQueryDisposition.CREATE_IF_NEEDED,
            write_disposition=BigQueryDisposition.WRITE_APPEND,
            method="STREAMING_INSERTS",
        )

        # Dead letter path — write failed records to separate topic/table
        dead_letter | "Write Dead Letter" >> WriteToBigQuery(
            table="my-project:analytics.events_dead_letter",
            schema={"fields": [{"name": "raw", "type": "BYTES", "mode": "REQUIRED"}]},
            create_disposition=BigQueryDisposition.CREATE_IF_NEEDED,
            write_disposition=BigQueryDisposition.WRITE_APPEND,
        )

if __name__ == "__main__":
    run()
```

---

### Streaming vs Batch Decision Matrix

Use this matrix to decide whether a use case requires streaming, micro-batch, or batch processing:

| Factor | Streaming | Micro-Batch | Batch |
|---|---|---|---|
| **Required latency** | < 30 seconds | 30 seconds – 5 minutes | > 5 minutes acceptable |
| **Data arrives** | Continuously | Continuously | In discrete files or dumps |
| **Event ordering critical** | Yes | Partially | Typically no |
| **Late data frequency** | High | Moderate | N/A |
| **State across events needed** | Yes | Yes | Sometimes |
| **Budget for 24/7 compute** | Available | Available | Limited |
| **Team has streaming expertise** | Yes | Yes | No |
| **Use case examples** | Fraud detection, real-time recommendations, alerting | Dashboard refresh, near-real-time KPIs, CDC to warehouse | Nightly reporting, ML training, batch ETL |

> [!tip] Default to Batch, Upgrade to Streaming
> Start with the simplest solution that meets the requirement. If stakeholders say "real-time," ask: "does this need to be within 1 second, or within 5 minutes?" Most "real-time" requirements are actually "near real-time" — 5-minute micro-batch Dataflow pipelines are dramatically simpler to build, test, and operate than true streaming systems. Save streaming complexity for use cases that genuinely require it.

---

### Connection to Lakehouse Architecture

Streaming and the [lakehouse](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/lakehouse-architecture) are complementary:
- Streaming provides the real-time ingestion layer.
- The lakehouse provides the durable, queryable storage layer with ACID guarantees.

The combination — streaming writes to [Iceberg](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/open-table-formats) via Flink or Dataflow — is increasingly called the "streaming lakehouse":

```
Kafka/Pub/Sub  →  Flink (exactly-once)  →  Iceberg on GCS  →  BigQuery/Trino/DuckDB
```

For [data mesh](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/data-mesh-architecture) implementations, each domain's data product may expose a streaming interface (a Kafka topic or Pub/Sub topic) for real-time consumers, in addition to a batch interface (an Iceberg table or BigQuery dataset) for analytical consumers.

---

## Related Notes

- [pubsub-messaging](https://alp78.github.io/elysium/06-GCP/Serverless/pubsub-messaging) — Pub/Sub publish/consume patterns and operational commands
- [pubsub-topics-and-subscriptions](https://alp78.github.io/elysium/06-GCP/Serverless/pubsub-topics-and-subscriptions) — Pub/Sub topic and subscription setup on GCP
- [lakehouse-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/lakehouse-architecture) — lakehouse as the serving layer for streaming pipelines
- [open-table-formats](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/open-table-formats) — Iceberg and Delta Lake as the streaming write target
- [medallion-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/medallion-architecture) — bronze layer as the streaming ingestion target
- [idempotent-pipeline-design](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design) — exactly-once semantics and idempotent consumer design
- [airflow-core-concepts](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-core-concepts) — orchestrating streaming pipeline deployments and monitoring
- [data-mesh-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/data-mesh-architecture) — domain data products exposed as streaming topics
- [cloud-logging](https://alp78.github.io/elysium/06-GCP/Logging/cloud-logging) — GCP observability for streaming pipelines
- [cloud-monitoring-metrics](https://alp78.github.io/elysium/06-GCP/Logging/cloud-monitoring-metrics) — pipeline lag, backlog, and throughput metrics
- [five-pillars-of-data-engineering](https://alp78.github.io/elysium/14-Data-Architecture/five-pillars-of-data-engineering) — reliability and observability for streaming systems

## References

- [Apache Flink Documentation](https://flink.apache.org/docs/stable/)
- [Apache Beam Documentation](https://beam.apache.org/documentation/)
- [Google Dataflow Documentation](https://cloud.google.com/dataflow/docs)
- [Debezium CDC Documentation](https://debezium.io/documentation/)
- [Confluent Kafka Documentation](https://docs.confluent.io/platform/current/)
- [GCP Datastream Documentation](https://cloud.google.com/datastream/docs)
- [Marz, N. (2011). How to beat the CAP theorem.](http://nathanmarz.com/blog/how-to-beat-the-cap-theorem.html) (Lambda architecture origin)
- [Kreps, J. (2014). Questioning the Lambda Architecture.](https://www.oreilly.com/radar/questioning-the-lambda-architecture/) (Kappa origin)
- [Dehghani, Z. (2022). Data Mesh. O'Reilly.](https://www.oreilly.com/library/view/data-mesh/9781492092384/)
