---
type: reference
category: data-architecture
technology:
  - python
  - gcp
tags: [data-architecture, architecture, api, python, gcp]
aliases:
  - API comparison
  - protocol comparison
  - REST vs gRPC
  - REST vs GraphQL
  - WebSocket
  - webhook
  - SSE
  - server-sent events
  - MQTT
  - AMQP
  - FIX protocol
  - SFTP
  - API selection
keywords:
  - REST
  - gRPC
  - GraphQL
  - WebSocket
  - SSE
  - server-sent events
  - MQTT
  - AMQP
  - webhook
  - SFTP
  - FIX protocol
  - HTTP
  - Protobuf
  - JSON
  - TCP
  - pub/sub
  - streaming
  - request-response
  - data ingestion
  - data pipeline
  - API design
  - protocol selection
  - message queue
  - IoT
  - real-time
  - financial data
  - market data
  - trading
  - GCP
  - Cloud Pub/Sub
  - HTTP/2
  - HTTP/3
  - QUIC
  - ConnectRPC
  - AsyncAPI
  - OpenAPI
  - mTLS
  - HMAC
  - paramiko
  - paho-mqtt
  - websockets
  - httpx
  - FastAPI
description: Master decision framework comparing all API and data exchange protocols relevant to data engineering — REST, gRPC, GraphQL, WebSocket, SSE, MQTT, AMQP, Webhooks, SFTP, FIX, and GCP Pub/Sub. Includes working Python code examples, a protocol comparison matrix, and decision tables by use case and constraint.
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# API and Protocol Comparison — Decision Framework

> [!quote]
> "There are only two hard things in Computer Science: cache invalidation and naming things."
> — **Phil Karlton**
>
> "Any fool can write code that a computer can understand. Good programmers write code that humans can understand."
> — **Martin Fowler**

> [!abstract] Purpose
> Data engineers interact with APIs at every stage of a pipeline: pulling from vendor REST endpoints, consuming WebSocket market data feeds, receiving SFTP files from exchanges, publishing to message queues, and exposing data products downstream. This note is the entry point for deciding **which protocol to use and why**. Each protocol section links to a deeper implementation note where one exists.

---

### Protocol Landscape Overview for Data Engineers

APIs are not interchangeable. The protocol you choose determines latency, throughput, schema guarantees, infrastructure complexity, and what your consumers can actually do with the data. Data engineers deal with a wider range of protocols than most backend engineers because the job spans three distinct integration directions:

- **Inbound ingestion** — pulling from external data sources (SaaS vendors, exchanges, IoT devices, data marketplaces). You are the client; you rarely control the protocol.
- **Internal pipeline transport** — moving data between services you own. You control both sides and can optimize aggressively.
- **Downstream serving** — exposing data products to consumers (analytics teams, applications, other services). You control the server; consumers control how they want to query.

Understanding the trade-offs at each layer is what separates a pipeline that works from one that scales.

---

## Request-Response Protocols

These protocols follow the classic pattern: client sends a request, server sends a response. The connection is stateless or short-lived. The three dominant options for data engineering are REST, gRPC, and GraphQL.

### REST (HTTP/JSON)

REST is the lingua franca of the internet. Almost every external API a data engineer will consume — Bloomberg, Refinitiv Eikon, Alpha Vantage, Stripe, Salesforce, Snowflake, GitHub — speaks REST over HTTP/1.1 with JSON payloads. The stateless request-response model maps cleanly to CRUD operations, and the tooling ecosystem is unmatched: OpenAPI specs, Postman, curl, every HTTP library in every language. For a deeper treatment of authentication patterns, pagination strategies, rate-limit handling, and idiomatic Python consumption patterns, see [rest-api-design-and-consumption](https://alp78.github.io/elysium/14-Data-Architecture/APIs-and-Protocols/rest-api-design-and-consumption).

**Sweet spot:** public and partner APIs, CRUD-style data access, any situation where interoperability and broad tooling support matter more than raw performance.

---

### gRPC (HTTP/2 + Protobuf)

gRPC is Google's open-source RPC framework built on HTTP/2 and Protocol Buffers. Where REST sends human-readable JSON over a new connection per request, gRPC sends binary-encoded Protobuf messages over a single multiplexed HTTP/2 connection. The result is typically 5–10x lower payload size and significantly higher throughput for high-frequency internal service calls. gRPC also defines four communication patterns in one framework: unary (request-response), server-streaming, client-streaming, and bidirectional streaming — making it uniquely suited for pipeline stages that need to stream large result sets. Schema contracts are enforced via `.proto` files, which serve as the single source of truth across every language that generates stubs from them. For service definition patterns, Python stub generation, streaming implementation, and GCP Cloud Run deployment, see [grpc-for-data-pipelines](https://alp78.github.io/elysium/14-Data-Architecture/APIs-and-Protocols/grpc-for-data-pipelines).

**Sweet spot:** high-throughput internal microservices, streaming pipeline stages, any service where schema enforcement and low latency matter more than browser compatibility.

---

### GraphQL

GraphQL is a query language for APIs, developed by Facebook and now widely adopted for data-serving layers. Rather than defining fixed endpoints that return fixed shapes, GraphQL exposes a single endpoint backed by a strongly-typed schema written in Schema Definition Language (SDL). Clients specify exactly the fields they need, eliminating over-fetching (getting too much data) and under-fetching (needing multiple round trips). For data engineering teams serving analytics consumers with divergent needs — one team wants trades with position data, another wants only OHLCV — GraphQL lets each team write their own query without requiring server-side endpoint proliferation. The introspection feature means the schema is self-documenting and explorable via tools like GraphiQL. For schema design, resolver patterns, and Python server implementation, see [graphql-for-data-access](https://alp78.github.io/elysium/14-Data-Architecture/APIs-and-Protocols/graphql-for-data-access).

**Sweet spot:** data-serving layers with multiple heterogeneous consumers, situations where over-fetching is costly, self-documenting APIs for internal data products.

---

## Streaming and Real-Time Protocols

When the data model is continuous rather than discrete — market tick data, sensor telemetry, log streams, live order books — request-response protocols become inefficient or impossible. You cannot poll a WebSocket feed; you cannot replicate a live order book over REST without hammering rate limits. The protocols below are purpose-built for continuous data flows.

### Streaming Protocol — WebSocket

WebSocket establishes a full-duplex persistent TCP connection, negotiated via an HTTP/1.1 upgrade handshake. Once the connection is open, both client and server can send frames at any time without the overhead of repeated HTTP headers. This makes it the standard protocol for real-time financial data: live price feeds, order book updates, and execution reports from exchanges all arrive over WebSocket connections.

#### When a data engineer uses it
- Connecting to exchange WebSocket feeds (Coinbase Advanced Trade, Binance, ICE, CME streaming APIs)
- Subscribing to live FX tick data from a broker or aggregator
- Receiving real-time portfolio valuation updates
- Feeding live price data to a dashboard without polling

#### Python example — connecting to a price feed

```python
import asyncio
import json
import websockets
from datetime import datetime

async def subscribe_price_feed(uri: str, symbols: list[str]) -> None:
    """
    Connect to a WebSocket price feed and process incoming tick data.
    Reconnects automatically on disconnection.
    """
    subscribe_msg = {
        "type": "subscribe",
        "channels": [{"name": "ticker", "product_ids": symbols}]
    }

    while True:  # outer loop handles reconnection
        try:
            async with websockets.connect(
                uri,
                ping_interval=20,
                ping_timeout=10,
                close_timeout=5,
            ) as ws:
                await ws.send(json.dumps(subscribe_msg))
                print(f"[{datetime.utcnow():%H:%M:%S}] Subscribed to {symbols}")

                async for raw_message in ws:
                    msg = json.loads(raw_message)

                    if msg.get("type") == "ticker":
                        symbol   = msg["product_id"]
                        price    = float(msg["price"])
                        bid      = float(msg.get("best_bid", 0))
                        ask      = float(msg.get("best_ask", 0))
                        ts       = msg.get("time", datetime.utcnow().isoformat())

                        print(f"{ts} | {symbol} | price={price:.4f} bid={bid:.4f} ask={ask:.4f}")
                        # In production: write to a ring buffer, push to Pub/Sub, or insert into a time-series DB

        except (websockets.ConnectionClosed, OSError) as e:
            print(f"Connection lost: {e}. Reconnecting in 5 seconds...")
            await asyncio.sleep(5)

if __name__ == "__main__":
    FEED_URI = "wss://advanced-trade-ws.coinbase.com"
    asyncio.run(subscribe_price_feed(FEED_URI, ["BTC-USD", "ETH-USD"]))
```

#### Pros and cons

| Aspect | Detail |
|--------|--------|
| Latency | Very low — no connection setup overhead after initial handshake |
| Direction | Full-duplex — client and server can both send at any time |
| Persistence | Long-lived connection; requires reconnection logic |
| Browser support | Yes (native WebSocket API) |
| Proxy/firewall | Can be blocked; falls back to long-polling in some environments |
| Schema | None — message format is convention-based (usually JSON) |
| Backpressure | Manual — must implement flow control yourself |
| Complexity | Medium — need async handling, ping/pong keepalives, reconnect logic |

> [!warning] WebSocket Reliability
> Exchanges drop WebSocket connections without warning — during maintenance windows, market circuit breakers, or network instability. Production feed handlers must implement exponential backoff reconnection, sequence number gap detection, and a REST fallback to re-snapshot state after reconnecting.

---

### Server-Sent Events (SSE)

SSE is a one-way streaming protocol built on HTTP. The server holds the connection open and pushes newline-delimited `data:` events to the client. Unlike WebSocket, SSE is just HTTP — it works through corporate proxies and firewalls, supports automatic reconnection at the browser level, and requires no special server infrastructure beyond a streaming HTTP response.

The trade-off is directionality: the client cannot send data after the initial request. For data engineering, this is often fine — you want to receive a stream of pipeline status updates, log tail output, or price events without needing to send anything back.

#### When a data engineer uses it
- Streaming pipeline job status to a dashboard (job started, running, X rows processed, complete)
- Log tailing endpoints in internal tooling
- Server-push notifications for data quality alerts
- Streaming LLM-generated data summaries

#### curl example

```bash
# -N disables output buffering so events appear as they arrive
curl -N -H "Authorization: Bearer $TOKEN" https://api.example.com/stream/pipeline/job-42/status
```

#### Python client example with httpx

```python
import httpx
import json

def stream_pipeline_status(job_id: str, token: str) -> None:
    """
    Consume an SSE stream of pipeline job status events.
    Each event is a JSON object with fields: status, rows_processed, message.
    """
    url = f"https://api.example.com/stream/pipeline/{job_id}/status"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "text/event-stream",
        "Cache-Control": "no-cache",
    }

    with httpx.Client(timeout=None) as client:
        with client.stream("GET", url, headers=headers) as response:
            response.raise_for_status()
            buffer = ""

            for line in response.iter_lines():
                if line.startswith("data:"):
                    payload = line[5:].strip()
                    if payload == "[DONE]":
                        print("Stream complete.")
                        break
                    try:
                        event = json.loads(payload)
                        status = event.get("status", "unknown")
                        rows   = event.get("rows_processed", 0)
                        msg    = event.get("message", "")
                        print(f"[{status}] rows={rows:,}  {msg}")
                    except json.JSONDecodeError:
                        pass  # skip malformed events

if __name__ == "__main__":
    stream_pipeline_status("job-42", token="your-token-here")
```

#### Python server example with FastAPI

```python
import asyncio
import json
from fastapi import FastAPI
from fastapi.responses import StreamingResponse

app = FastAPI()

async def pipeline_status_generator(job_id: str):
    """Simulate streaming pipeline progress as SSE events."""
    stages = [
        {"status": "starting",   "rows_processed": 0,      "message": "Initialising connections"},
        {"status": "running",    "rows_processed": 250_000, "message": "Processing batch 1/4"},
        {"status": "running",    "rows_processed": 500_000, "message": "Processing batch 2/4"},
        {"status": "running",    "rows_processed": 750_000, "message": "Processing batch 3/4"},
        {"status": "complete",   "rows_processed": 1_000_000, "message": "All rows written"},
    ]
    for stage in stages:
        yield f"data: {json.dumps(stage)}\n\n"
        await asyncio.sleep(1.5)
    yield "data: [DONE]\n\n"

@app.get("/stream/pipeline/{job_id}/status")
async def stream_status(job_id: str):
    return StreamingResponse(
        pipeline_status_generator(job_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

> [!tip] SSE vs WebSocket
> If you only need server-to-client streaming, prefer SSE over WebSocket. SSE is simpler to implement, works through HTTP/1.1 (no upgrade needed), survives load balancers and proxies more reliably, and has built-in browser reconnection via the `EventSource` API. Only reach for WebSocket when you need to send data in both directions.

---

### MQTT

MQTT (Message Queuing Telemetry Transport) is a lightweight publish-subscribe protocol designed for constrained devices and unreliable networks. It runs over TCP and uses a broker model: publishers send messages to topics on a broker; subscribers receive messages for the topics they subscribe to. The protocol overhead is minimal — a minimum header of 2 bytes — making it viable for microcontrollers and sensors with limited battery and bandwidth.

#### When a data engineer uses it
- Ingesting telemetry from IoT sensors (temperature, pressure, flow rate) into a time-series database
- Consuming edge device data (factory equipment, trading terminal heartbeats)
- Bridging IoT device networks to cloud pipelines (MQTT broker → Cloud Pub/Sub → BigQuery)

#### Quality of Service levels

| QoS | Guarantee | Use case |
|-----|-----------|----------|
| 0 (At most once) | Fire and forget — no acknowledgment | Sensor telemetry where occasional loss is acceptable |
| 1 (At least once) | Message delivered at least once — possible duplicates | Pipeline events where duplicates can be deduplicated |
| 2 (Exactly once) | Four-way handshake ensures exactly-once delivery | Financial transactions, critical control commands |

#### Python example with paho-mqtt

```python
import json
import time
import paho.mqtt.client as mqtt
from datetime import datetime, timezone

BROKER_HOST = "mqtt.broker.example.com"
BROKER_PORT = 8883          # TLS port
TOPIC_PREFIX = "sensors/factory-floor"

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"Connected to MQTT broker")
        client.subscribe(f"{TOPIC_PREFIX}/#", qos=1)
    else:
        print(f"Connection failed with code {rc}")

def on_message(client, userdata, msg):
    """Handle incoming sensor telemetry."""
    try:
        payload = json.loads(msg.payload.decode("utf-8"))
        topic   = msg.topic
        ts      = datetime.now(tz=timezone.utc).isoformat()

        sensor_id   = payload.get("sensor_id")
        reading     = payload.get("value")
        unit        = payload.get("unit", "")

        print(f"{ts} | {topic} | sensor={sensor_id} value={reading} {unit}")

        # In production: batch and write to InfluxDB, BigQuery, or forward to Cloud Pub/Sub
        userdata["buffer"].append({
            "topic": topic,
            "sensor_id": sensor_id,
            "value": reading,
            "unit": unit,
            "timestamp": ts,
        })

    except (json.JSONDecodeError, KeyError) as e:
        print(f"Malformed message on {msg.topic}: {e}")

def run_mqtt_ingestion():
    buffer = []
    client = mqtt.Client(userdata={"buffer": buffer})
    client.on_connect = on_connect
    client.on_message = on_message

    # TLS + username/password auth (common for cloud MQTT brokers)
    client.tls_set()
    client.username_pw_set(username="pipeline-user", password="secret")

    client.connect(BROKER_HOST, BROKER_PORT, keepalive=60)
    client.loop_start()

    try:
        while True:
            time.sleep(10)
            if buffer:
                print(f"Flushing {len(buffer)} readings to storage...")
                # flush_to_bigquery(buffer.copy())
                buffer.clear()
    except KeyboardInterrupt:
        client.loop_stop()
        client.disconnect()

if __name__ == "__main__":
    run_mqtt_ingestion()
```

> [!note] MQTT vs Pub/Sub for IoT
> For pure GCP pipelines, Cloud IoT Core (deprecated) and its successor patterns use MQTT as the device-facing protocol but bridge into Cloud Pub/Sub for the pipeline side. You rarely run your own MQTT broker at scale — instead, use a managed broker (HiveMQ Cloud, AWS IoT Core, EMQX Cloud) that bridges to your cloud messaging system.

---

### AMQP (RabbitMQ)

AMQP (Advanced Message Queuing Protocol) is a binary wire-level protocol for message queuing. RabbitMQ is its most widely deployed implementation. Where Kafka is a distributed log (append-only, consumer manages offset), RabbitMQ is a traditional message broker with rich routing: direct exchanges, fanout exchanges, topic exchanges, and header-based routing. Messages can be acknowledged, rejected, and dead-lettered to separate queues for failed-message handling.

#### When a data engineer uses it
- Decoupling pipeline stages that operate at different throughput rates
- Async task dispatch: queue a data quality check job; a worker pool processes it
- Dead-letter queues: failed transformation attempts accumulate for manual inspection
- Priority queues: urgent regulatory reports ahead of routine batch jobs

#### AMQP vs Pub/Sub vs Kafka

| Dimension | AMQP (RabbitMQ) | Cloud Pub/Sub | Kafka |
|-----------|-----------------|---------------|-------|
| Model | Message queue + routing | Topic-based pub/sub | Distributed log |
| Message retention | Until acknowledged | 7 days default (configurable) | Configurable (days to forever) |
| Consumer model | Competing consumers (push) | Pull or push subscriptions | Consumer groups (pull, offset-based) |
| Ordering | Per-queue (FIFO) | Best-effort | Per-partition strict |
| Dead-letter | Native | Configurable dead-letter topic | Manual or Kafka Streams |
| GCP native | No (self-hosted or CloudAMQP) | Yes | No (use Confluent or self-hosted) |
| Replay | No | Limited (snapshot + replay) | Yes — full replay from any offset |
| Best for | Complex routing, task queues | GCP pipelines, event fan-out | Event sourcing, high-throughput log |

> [!tip] When to Use AMQP vs Pub/Sub on GCP
> If you are entirely within GCP, prefer Pub/Sub — it is managed, scales automatically, and integrates natively with Dataflow, Cloud Functions, and BigQuery subscriptions. Use RabbitMQ (AMQP) when you need sophisticated routing logic, priority queues, or you are integrating with an on-premise system that already speaks AMQP.

---

## Push-Based Protocols

### Webhooks

A webhook is not a protocol — it is a pattern built on HTTP. Instead of polling an endpoint to check for new events, you register a URL with a third-party service and that service sends an HTTP POST to your URL whenever an event occurs. From your server's perspective, you are receiving an inbound HTTP request, not making one.

#### When a data engineer uses it
- Receiving trade execution notifications from a brokerage API
- GitHub Actions triggering pipeline runs on push to main
- Stripe payment events landing in a financial reconciliation pipeline
- Salesforce change data capture events (new lead, closed opportunity)
- PagerDuty alerting a pipeline monitoring endpoint on data quality breach

#### Webhook receiver in FastAPI with HMAC verification

```python
import hashlib
import hmac
import json
import logging
from fastapi import FastAPI, Header, HTTPException, Request, status

app = FastAPI()
logger = logging.getLogger(__name__)

WEBHOOK_SECRET = b"your-webhook-secret"  # shared with the sender; store in Secret Manager

def verify_hmac_signature(
    payload: bytes,
    signature_header: str,
    secret: bytes,
    algorithm: str = "sha256",
) -> bool:
    """
    Verify that the request came from the expected sender using HMAC-SHA256.
    The signature header is typically 'sha256=<hex-digest>' (GitHub style).
    """
    if not signature_header:
        return False
    try:
        scheme, provided_sig = signature_header.split("=", 1)
    except ValueError:
        return False

    expected_sig = hmac.new(secret, payload, hashlib.sha256).hexdigest()
    # constant-time comparison to prevent timing attacks
    return hmac.compare_digest(provided_sig, expected_sig)

@app.post("/webhooks/trade-executions")
async def receive_trade_execution(
    request: Request,
    x_signature_256: str = Header(None, alias="X-Signature-256"),
):
    """
    Receive trade execution events from a brokerage webhook.
    Verifies HMAC signature, parses payload, enqueues for processing.
    Returns 200 immediately — heavy processing happens asynchronously.
    """
    raw_body = await request.body()

    if not verify_hmac_signature(raw_body, x_signature_256, WEBHOOK_SECRET):
        logger.warning("Invalid webhook signature — rejecting request")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid signature",
        )

    try:
        event = json.loads(raw_body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = event.get("event_type")
    idempotency_key = event.get("idempotency_key") or request.headers.get("X-Idempotency-Key")

    logger.info(f"Received webhook: type={event_type} key={idempotency_key}")

    # Check idempotency — sender may retry on timeout; process each event exactly once
    if idempotency_key and await is_already_processed(idempotency_key):
        logger.info(f"Duplicate event {idempotency_key} — skipping")
        return {"status": "already_processed"}

    # Enqueue asynchronously — never do heavy work inline
    # await task_queue.enqueue("process_trade_execution", event)

    return {"status": "accepted", "idempotency_key": idempotency_key}

async def is_already_processed(key: str) -> bool:
    """Check Redis or a dedupliation table for this idempotency key."""
    # Implementation: check Redis SET or Firestore document
    return False
```

#### Reliability patterns for webhook consumers

| Challenge | Solution |
|-----------|----------|
| Sender retries on timeout | Return 200 within 5 seconds; process asynchronously |
| Duplicate delivery | Idempotency keys + deduplication store (Redis, Firestore) |
| Signature forgery | HMAC-SHA256 verification on every request |
| Sender goes silent | Implement heartbeat checks or polling fallback |
| Payload too large | Accept reference, fetch full payload from sender's API |
| Ordered processing | Sequence numbers + ordering buffer, or accept eventual consistency |

> [!warning] Webhook Reliability Expectations
> You cannot guarantee webhook delivery from the sender's side. Network failures, sender bugs, and IP allowlist issues all cause gaps. For financial data pipelines, always maintain a reconciliation process that independently fetches the complete state from the sender's REST API on a schedule. Webhooks are notifications, not guaranteed delivery.

---

## File Transfer Protocols

### SFTP

SFTP (SSH File Transfer Protocol) is not a streaming API — it is a file-based data exchange protocol, and it remains deeply embedded in financial data workflows. Exchanges, data vendors, regulators, and clearinghouses all deliver data as files dropped into an SFTP server. End-of-day position files, reference data updates, settlement instructions, regulatory reports — these arrive as CSV, fixed-width, or XML files transferred over SFTP.

#### When a data engineer uses it
- Retrieving end-of-day trade files from an exchange or prime broker
- Consuming reference data updates (security master, FX rates) from a data vendor
- Delivering regulatory reports (MiFID II, EMIR trade reports) to a regulator's SFTP drop
- Exchanging settlement files with a clearinghouse (DTCC, LCH)

#### Python example with paramiko

```python
import os
import paramiko
from pathlib import Path
from datetime import date, timedelta

def create_sftp_client(
    host: str,
    port: int,
    username: str,
    private_key_path: str,
) -> tuple[paramiko.SSHClient, paramiko.SFTPClient]:
    """
    Establish an SSH connection and return an SFTP client.
    Uses key-based authentication (preferred over password for automated pipelines).
    """
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.RejectPolicy())  # never auto-accept unknown hosts
    ssh.load_host_keys(os.path.expanduser("~/.ssh/known_hosts"))

    private_key = paramiko.Ed25519Key.from_private_key_file(private_key_path)
    ssh.connect(host, port=port, username=username, pkey=private_key, timeout=30)

    sftp = ssh.open_sftp()
    return ssh, sftp

def ingest_eod_trade_files(
    host: str,
    port: int,
    username: str,
    private_key_path: str,
    remote_dir: str,
    local_landing_dir: Path,
    as_of_date: date | None = None,
) -> list[Path]:
    """
    Download end-of-day trade files from an exchange SFTP server.
    Files are named like: trades_YYYYMMDD.csv
    Returns list of downloaded local file paths.
    """
    if as_of_date is None:
        as_of_date = date.today() - timedelta(days=1)

    date_str = as_of_date.strftime("%Y%m%d")
    local_landing_dir.mkdir(parents=True, exist_ok=True)

    ssh, sftp = create_sftp_client(host, port, username, private_key_path)
    downloaded = []

    try:
        sftp.chdir(remote_dir)
        remote_files = sftp.listdir()

        # Filter for today's files — vendors often keep multiple days on the server
        target_files = [f for f in remote_files if date_str in f and f.endswith(".csv")]

        for filename in target_files:
            local_path = local_landing_dir / filename

            if local_path.exists():
                print(f"Already downloaded: {filename} — skipping")
                continue

            remote_attrs = sftp.stat(filename)
            print(f"Downloading {filename} ({remote_attrs.st_size:,} bytes)...")
            sftp.get(filename, str(local_path))
            downloaded.append(local_path)
            print(f"  -> {local_path}")

    finally:
        sftp.close()
        ssh.close()

    return downloaded

def upload_regulatory_report(
    host: str,
    port: int,
    username: str,
    private_key_path: str,
    remote_dir: str,
    local_file: Path,
) -> str:
    """
    Upload a regulatory report file to a regulator's SFTP drop zone.
    Returns the remote file path on success.
    """
    ssh, sftp = create_sftp_client(host, port, username, private_key_path)
    try:
        remote_path = f"{remote_dir}/{local_file.name}"
        sftp.put(str(local_file), remote_path)
        print(f"Uploaded {local_file.name} to {host}:{remote_path}")
        return remote_path
    finally:
        sftp.close()
        ssh.close()

# --- Automated SFTP ingestion pattern ---

if __name__ == "__main__":
    from pathlib import Path

    SFTP_CONFIG = {
        "host":             "sftp.exchange.example.com",
        "port":             22,
        "username":         "pipeline-user",
        "private_key_path": "/home/pipeline/.ssh/exchange_ed25519",
    }

    files = ingest_eod_trade_files(
        **SFTP_CONFIG,
        remote_dir="/outbound/trades",
        local_landing_dir=Path("/data/landing/trades"),
    )

    print(f"\nIngested {len(files)} file(s):")
    for f in files:
        print(f"  {f}")
```

> [!tip] Automated SFTP in Production
> In a Cloud Composer (Airflow) or Cloud Run pipeline, the SFTP ingestion task runs on a schedule (typically 18:30 local exchange time for T+0 EOD files). Downloaded files land in a Cloud Storage staging bucket, trigger a Pub/Sub notification, and a downstream Dataflow job loads them into BigQuery. Never leave files in the SFTP landing zone indefinitely — acknowledge receipt by moving or deleting, and keep the local staging area time-bounded.

---

### FIX Protocol

FIX (Financial Information eXchange) is the industry standard messaging protocol for electronic trading. Developed in 1992 between Fidelity Investments and Salomon Brothers, it remains dominant in equities, derivatives, and FX trading globally. A FIX message is a sequence of tag=value pairs delimited by the SOH (ASCII 01) character — entirely human-readable when decoded, but processed at machine speed.

#### When a data engineer encounters FIX
- Ingesting trade execution reports from an order management system (OMS) or execution management system (EMS) in real time
- Consuming order book snapshots and incremental updates from an exchange FIX feed
- Processing drop-copy feeds: a real-time mirror of all executed orders routed to a separate system for risk monitoring and regulatory reporting

#### Message structure example (decoded)

```
8=FIX.4.4 | 9=148 | 35=D | 49=CLIENT | 56=BROKER | 34=1 | 52=20241115-09:30:01.123 |
11=ORD-001 | 55=AAPL | 54=1 | 38=100 | 40=2 | 44=182.50 | 59=0 | 10=153 |
```

| Tag | Field | Value |
|-----|-------|-------|
| 35 | MsgType | D = New Order Single |
| 55 | Symbol | AAPL |
| 54 | Side | 1 = Buy |
| 38 | OrderQty | 100 |
| 40 | OrdType | 2 = Limit |
| 44 | Price | 182.50 |

#### Key FIX message types for data engineers

| MsgType | Name | Data engineering use |
|---------|------|---------------------|
| D | New Order Single | Order flow analysis |
| 8 | Execution Report | Trade capture, P&L, regulatory reporting |
| W | Market Data Snapshot | Reference price, order book initialization |
| X | Market Data Incremental | Real-time order book updates |
| V | Market Data Request | Subscribing to a feed |

> [!note] FIX is a Specialist Domain
> Full FIX session management (logon, heartbeat, sequence number recovery, resend requests) is a specialised engineering domain handled by FIX engines: QuickFIX/n, Onixs, B2BITS, or commercial solutions. As a data engineer you are more likely to consume FIX data after it has been parsed and written to a queue or database by a FIX engine, rather than implementing the session layer yourself. The key skill is understanding the message structure and knowing which tags carry the data you need.

---

### Master Protocol Comparison Table

| Protocol | Transport | Payload | Direction | Latency | Throughput | Browser | Streaming | Schema | Auth | When DE Uses It |
|----------|-----------|---------|-----------|---------|------------|---------|-----------|--------|------|-----------------|
| REST | HTTP/1.1 | JSON/XML | Request-response | Medium | Medium | Yes | No | OpenAPI (optional) | Headers/OAuth | External APIs, CRUD |
| gRPC | HTTP/2 | Protobuf | Req-resp + streaming | Low | High | gRPC-Web | Yes (4 types) | .proto (required) | Interceptors/mTLS | Internal services |
| GraphQL | HTTP | JSON | Request-response | Medium | Medium | Yes | Subscriptions | SDL (required) | Resolvers | Flexible data serving |
| WebSocket | TCP | Any | Full-duplex | Very low | High | Yes | Yes | None | Handshake | Real-time feeds |
| SSE | HTTP | Text/JSON | Server→client | Low | Medium | Yes | Yes (one-way) | None | Headers | Status streaming |
| MQTT | TCP | Binary | Pub/sub | Very low | Medium | Via WS | Yes | None | Username/cert | IoT ingestion |
| AMQP | TCP | Binary | Queue-based | Low | High | No | Yes | None | SASL | Reliable messaging |
| Webhook | HTTP | JSON | Push (server→client) | Event-driven | Low | N/A | No | None | HMAC | Event notifications |
| SFTP | SSH | Binary files | Bidirectional | High | High | No | No | None | Key/password | File-based exchange |
| FIX | TCP | Tagged fields | Bidirectional | Ultra-low | Very high | No | Yes | FIX dictionary | Session | Trading data |
| Pub/Sub | HTTPS | JSON/binary | Pub/sub | Medium | Very high | No | Yes | None | IAM | GCP pipeline decoupling |

---

## Decision Framework

### By Use Case

| Scenario | Recommended | Why |
|----------|-------------|-----|
| Ingest from a SaaS vendor API | REST | Universal support, documented, every vendor has one |
| High-throughput internal pipeline stage | gRPC | Speed, streaming, type safety, schema contracts |
| Serve data to multiple dashboard teams | GraphQL | Each team queries exactly what they need |
| Real-time market data feed (ticks, order book) | WebSocket | Full-duplex, lowest latency, exchange standard |
| Receive deployment/CI events | Webhook | Push-based, simple, zero polling overhead |
| Ingest IoT sensor data | MQTT | Lightweight, handles unreliable networks, QoS levels |
| Decouple pipeline stages on GCP | Pub/Sub | Managed, scales to millions of msgs/sec, GCP-native |
| Receive daily files from exchange or vendor | SFTP | Industry standard for file delivery in financial data |
| Pipeline status streaming to dashboard | SSE | Simple, one-way, HTTP-compatible, firewall-friendly |
| Async task dispatch with routing | AMQP | Rich routing, dead-letter queues, competing consumers |
| Ingest trade execution data from OMS | FIX drop-copy | Industry standard for order and execution data |
| Regulatory reporting to counterparty | SFTP | Counterparty dictates the protocol; SFTP is the norm |

### By Constraint

| If you need... | Use |
|----------------|-----|
| Browser compatibility | REST, GraphQL, WebSocket, SSE |
| Schema enforcement | gRPC (Protobuf), GraphQL (SDL) |
| Bidirectional streaming | gRPC, WebSocket |
| Works through corporate firewalls | REST, SSE, GraphQL |
| Maximum throughput | gRPC, AMQP, FIX |
| Minimum latency | FIX, WebSocket, MQTT |
| Minimum complexity | REST, Webhooks |
| GCP-native integration | REST (Cloud Endpoints), gRPC (Cloud Run), Pub/Sub |
| Reliable delivery with acknowledgment | AMQP, Pub/Sub (with ack deadline) |
| Exactly-once semantics | MQTT QoS 2, AMQP with transactions |
| No control over sender-side protocol | Whatever the sender dictates (usually REST or SFTP) |

### Decision Tree

```
Is this inbound ingestion from an external party?
├── Yes: Do you control the protocol?
│   ├── No: Use whatever the external party provides (REST, SFTP, FIX, WebSocket)
│   └── Yes: → see By Use Case table above
└── No: Is this internal (you control both sides)?
    ├── Is latency the primary concern?
    │   └── Yes → gRPC or WebSocket
    ├── Is it file-based batch exchange?
    │   └── Yes → SFTP or Cloud Storage
    ├── Do you need async decoupling?
    │   └── Yes → Cloud Pub/Sub (GCP) or AMQP (multi-cloud / on-prem)
    └── Is it serving data to consumers with varied needs?
        └── Yes → GraphQL
```

---

## Protocol Evolution and Trends

### HTTP/3 and QUIC

HTTP/3 replaces TCP with QUIC (Quick UDP Internet Connections), a UDP-based transport that eliminates head-of-line blocking — the problem where a single lost TCP packet stalls all streams sharing the connection. For gRPC and REST over high-latency or lossy networks (cross-region calls, mobile), HTTP/3 reduces connection establishment time and improves throughput under packet loss. As of 2025, major cloud load balancers (GCP, Cloudflare, AWS CloudFront) support HTTP/3. The impact on data engineering workloads is most felt in cross-region API calls and high-frequency REST polling patterns.

### gRPC-Web

Standard gRPC cannot run in a browser because browsers do not expose the raw HTTP/2 framing gRPC requires. gRPC-Web is a proxy-compatible variant that wraps gRPC frames in HTTP/1.1, enabling browser clients to call gRPC services directly (with an Envoy proxy or the gRPC-Web library handling translation). For data engineering, this matters when you are building internal tooling with web frontends that need to consume a gRPC data service without a REST translation layer.

### ConnectRPC

ConnectRPC is a newer RPC framework from Buf that generates gRPC-compatible services callable via plain HTTP/1.1 with JSON — meaning `curl` and standard HTTP clients work without modification, while gRPC clients using Protobuf also work natively. This eliminates the "gRPC is hard to debug" friction while preserving schema contracts and binary efficiency. Increasingly adopted for internal data services where you want the benefits of Protobuf schemas without mandating gRPC clients everywhere.

### AsyncAPI

OpenAPI (formerly Swagger) is the schema standard for REST APIs. AsyncAPI is its equivalent for event-driven architectures: a machine-readable specification for Kafka topics, Pub/Sub topics, WebSocket channels, AMQP queues, and MQTT topics. It documents the message structure, channel names, protocol bindings, and operation semantics (publish vs subscribe). For teams building data products on event-driven infrastructure, AsyncAPI documentation serves the same role as OpenAPI docs do for REST services — a contract that consumer teams can rely on.

### WebTransport

WebTransport is a web standard (currently in WHATWG draft) that exposes QUIC streams and datagrams to browser JavaScript. For data engineering, it is a future path to very-low-latency browser-to-server streaming (lower than WebSocket) that works through HTTP/3 infrastructure. Not yet production-ready for most environments, but worth watching for real-time financial data display use cases.

---

### Protocol Authentication Quick Reference

Each protocol has idiomatic authentication patterns. Using the wrong one creates unnecessary friction.

| Protocol | Idiomatic Auth | Notes |
|----------|----------------|-------|
| REST | Bearer token (JWT/OAuth2), API key in header | HTTPS mandatory; never send credentials in URL |
| gRPC | mTLS (service-to-service), interceptor with JWT | .proto interceptors handle auth transparently |
| GraphQL | Same as REST (it's over HTTP) | Token in Authorization header |
| WebSocket | Token in query param or subprotocol header at handshake | Cannot set headers after connection upgrade in browsers |
| SSE | Bearer token in initial GET request header | Same as REST; token set at connection time |
| MQTT | Username/password + TLS client certificate | Managed brokers often support OAuth2 as well |
| AMQP | SASL PLAIN over TLS (username/password or certificates) | RabbitMQ also supports OAuth2 via plugin |
| Webhook | HMAC signature in request header | Sender signs payload; receiver verifies — stateless |
| SFTP | SSH public key (preferred), password | Store private key in Secret Manager; rotate regularly |
| FIX | Session-level logon with CompID + password | SenderCompID / TargetCompID establish session identity |

---

## Common Data Engineering Patterns by Domain

### Financial Data Ingestion Stack

```
Exchange/Broker
    ├── FIX drop-copy feed  →  FIX engine  →  Execution DB  →  BigQuery (batch)
    ├── WebSocket price feed →  Tick handler  →  Redis / InfluxDB  →  BigQuery (micro-batch)
    └── SFTP EOD files       →  Cloud Storage  →  Dataflow  →  BigQuery (nightly)

Data Vendors (Bloomberg, Refinitiv, ICE)
    ├── REST API              →  Cloud Composer DAG  →  BigQuery
    └── SFTP reference data  →  Cloud Storage  →  BigQuery (daily refresh)
```

### GCP Cloud-Native Pipeline Stack

```
External APIs (REST)  →  Cloud Functions (ingest)  →  Cloud Pub/Sub
IoT Devices (MQTT)    →  Managed MQTT Broker        →  Cloud Pub/Sub
Webhooks (HTTP POST)  →  Cloud Run (receiver)       →  Cloud Pub/Sub
                                                           ↓
                                                     Dataflow (transform)
                                                           ↓
                                                     BigQuery (analytical store)
```

### Internal Service Mesh

```
Data Platform Services
    ├── Feature serving API     →  gRPC (low latency, schema-enforced)
    ├── Pipeline status API     →  SSE (streaming to dashboards)
    ├── Ad-hoc data queries     →  GraphQL (flexible, self-documenting)
    └── Pipeline orchestration  →  REST (Airflow API, Cloud Composer API)
```

---

## See Also

- [rest-api-design-and-consumption](https://alp78.github.io/elysium/14-Data-Architecture/APIs-and-Protocols/rest-api-design-and-consumption) — REST deep dive: pagination, rate limiting, retry patterns, Python clients
- [grpc-for-data-pipelines](https://alp78.github.io/elysium/14-Data-Architecture/APIs-and-Protocols/grpc-for-data-pipelines) — gRPC deep dive: .proto files, streaming, Python stubs, Cloud Run deployment
- [graphql-for-data-access](https://alp78.github.io/elysium/14-Data-Architecture/APIs-and-Protocols/graphql-for-data-access) — GraphQL deep dive: schema design, resolvers, Python server, consumer patterns
- [moc-data-architecture](https://alp78.github.io/elysium/14-Data-Architecture/moc-data-architecture) — Full data architecture index
