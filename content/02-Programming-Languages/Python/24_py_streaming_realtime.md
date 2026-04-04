---
tags: [python, gcp, pipeline, streaming]
aliases: [Streaming Python, Real-Time Data Python, WebSocket, SSE, Pub/Sub]
description: "Python streaming and real-time data reference — WebSocket, SSE, Pub/Sub, Firestore listeners, and latency benchmarks. See [24_cs_streaming_realtime](https://alp78.github.io/elysium/02-Programming-Languages/CSharp/24_cs_streaming_realtime) for the C# equivalent."
created: 2026-03-28
updated: 2026-03-28
status: complete
---

# 24. Streaming & Real-Time Data
WebSocket, SSE, Pub/Sub, Firestore

> [!quote]
> "Turning the database inside out: take the implementation detail that was previously hidden inside the database, and make it a first-class citizen."
>
> — **Martin Kleppmann**, *Making Sense of Stream Processing* (2016)

### Technologies Overview

| Technology | Protocol | Direction | Latency | Use Case |
|------------|----------|-----------|---------|----------|
| **WebSocket** | TCP (upgrade from HTTP) | Full-duplex (bi-directional) | Sub-ms to ~10ms | Live trading, gaming, collaborative editing |
| **SSE (Server-Sent Events)** | HTTP/1.1 long-lived | Server → Client only | ~10-50ms | Dashboards, notifications, AI chat streaming |
| **Google Cloud Pub/Sub** | gRPC | Decoupled (pub/sub) | 50-200ms | Event-driven pipelines, microservices, IoT |
| **Firestore Listener** | gRPC (bi-directional stream) | Server → Client push | 100-500ms | Mobile sync, live dashboards, cache invalidation |
| **Batch (GCS file)** | HTTPS | Request/Response | Seconds | ETL, data lake loads, archival |

**WebSocket** opens a persistent TCP connection where both sides can send messages at any time — the lowest-latency option. The protocol starts as an HTTP request (`Upgrade: websocket`) then switches to a raw binary frame protocol.

**SSE** is a simpler one-way alternative: the server holds an HTTP connection open and pushes `text/event-stream` lines. The browser (or client) automatically reconnects on failure. It works through CDNs and proxies that block WebSocket.

**Pub/Sub** is a managed message bus — publishers and subscribers are fully decoupled. Messages are durably stored until acknowledged. Supports fan-out (one message → many subscribers), dead-letter queues, and exactly-once delivery. Higher latency than direct connections but infinitely more scalable.

**Firestore Listener** (`on_snapshot`) uses gRPC bidirectional streaming under the hood. The server pushes document-level change events (ADDED, MODIFIED, REMOVED) as they happen. Built-in offline support and optimistic concurrency — designed for mobile/web apps that need real-time sync without managing connections.

**Batch transfer** (file upload/download via GCS) is included as a baseline. It has the highest per-message latency but the highest throughput for bulk data — the right choice when freshness is measured in minutes, not milliseconds.

```python
# All imports for streaming and real-time data patterns

# Standard library
import asyncio
import gc
import json
import os
import random
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

# Async networking
import aiohttp
from aiohttp import web
import httpx
import websockets
import nest_asyncio

# Data
import pandas as pd

# Google Cloud
from dotenv import load_dotenv
from google.cloud import pubsub_v1, firestore, storage

# Visualisation
import plotly.graph_objects as go
from IPython.display import display

nest_asyncio.apply()  # allow asyncio.run() inside Jupyter

# Render DataFrames as HTML
html_formatter = get_ipython().display_formatter.formatters['text/html'] # type: ignore
html_formatter.for_type(pd.DataFrame, lambda df: df.to_html())
_ = html_formatter.for_type(pd.Series, lambda s: s.to_frame().to_html())

import logging
logging.getLogger("aiohttp.server").setLevel(logging.CRITICAL)
```

```python
# Load .env and define project constants
load_dotenv(override=True)

PROJECT_ID   = 'seclab-dev-ap-26'
REGION       = 'europe-west1'
BUCKET_NAME  = f'{PROJECT_ID}-data'
FIRESTORE_DB = 'seclab-scores'
SA_KEY_PATH  = os.environ.get('GCP_SA_KEY_PATH', './gcp-sa-key.json')
DATA_DIR     = Path(r'C:\Users\aperi\DEV\LANG\data')

os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = SA_KEY_PATH

# GCP clients
# Disable publisher batching for latency benchmarks (default batches up to 10ms)
from google.cloud.pubsub_v1.types import BatchSettings
publisher    = pubsub_v1.PublisherClient(
    batch_settings=BatchSettings(max_messages=1, max_latency=0))
subscriber   = pubsub_v1.SubscriberClient()
fs_client    = firestore.Client(project=PROJECT_ID, database=FIRESTORE_DB)
gcs_client   = storage.Client(project=PROJECT_ID)
bucket       = gcs_client.bucket(BUCKET_NAME)

PROJECT_ID  # Project
FIRESTORE_DB  # Firestore
print(f'  GCS:       gs://{BUCKET_NAME}')
```

      seclab-dev-ap-26
      seclab-scores
      gs://seclab-dev-ap-26-data

#### Formatting helpers

```python
def fmt_time(ms):
    if ms < 1: return f'{ms*1000:.0f}µs'
    if ms < 1000: return f'{ms:.0f}ms'
    if ms < 60_000: return f'{ms/1000:.1f}s'
    m, s = divmod(ms / 1000, 60)
    if s == 0: return f'{int(m)}min'
    return f'{int(m)}m{s:.0f}s'

def fmt_rate(n, ms):
    if ms <= 0: return '-'
    rate = n / (ms / 1000)
    if rate < 1000: return f'{rate:.0f} msg/s'
    if rate < 1_000_000: return f'{rate/1000:.1f}K msg/s'
    return f'{rate/1_000_000:.1f}M msg/s'
```

#### Simulated OHLCV tick generator

Generates synthetic tick data for 5 symbols — used as the data source for all streaming patterns below.

```python
# Simulated tick generator — produces OHLCV-like ticks with realistic price movement
SYMBOLS = ['ASML.AS', 'SAP.DE', 'SIE.DE', 'MC.PA', 'TTE.PA']
PRICES = {s: random.uniform(50, 900) for s in SYMBOLS}

def generate_tick():
    """Generate one simulated tick with random walk price movement."""
    symbol = random.choice(SYMBOLS)
    price = PRICES[symbol]
    change = price * random.gauss(0, 0.002)  # 0.2% stddev per tick
    PRICES[symbol] = price + change
    return {
        'symbol': symbol,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'price': round(PRICES[symbol], 4),
        'volume': random.randint(100, 10_000),
        'bid': round(PRICES[symbol] - random.uniform(0.01, 0.5), 4),
        'ask': round(PRICES[symbol] + random.uniform(0.01, 0.5), 4),
    }

# Preview
sample = [generate_tick() for _ in range(5)]
display(pd.DataFrame(sample))
```

<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>timestamp</th>
      <th>price</th>
      <th>volume</th>
      <th>bid</th>
      <th>ask</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>SAP.DE</td>
      <td>2026-03-28T01:42:24.808669+00:00</td>
      <td>895.4224</td>
      <td>2710</td>
      <td>895.3121</td>
      <td>895.6138</td>
    </tr>
    <tr>
      <th>1</th>
      <td>ASML.AS</td>
      <td>2026-03-28T01:42:24.808669+00:00</td>
      <td>857.3298</td>
      <td>6499</td>
      <td>857.2716</td>
      <td>857.4697</td>
    </tr>
    <tr>
      <th>2</th>
      <td>SIE.DE</td>
      <td>2026-03-28T01:42:24.808669+00:00</td>
      <td>625.5957</td>
      <td>5149</td>
      <td>625.2853</td>
      <td>625.6701</td>
    </tr>
    <tr>
      <th>3</th>
      <td>SIE.DE</td>
      <td>2026-03-28T01:42:24.808669+00:00</td>
      <td>627.2062</td>
      <td>8418</td>
      <td>626.9840</td>
      <td>627.4667</td>
    </tr>
    <tr>
      <th>4</th>
      <td>MC.PA</td>
      <td>2026-03-28T01:42:24.808669+00:00</td>
      <td>107.8218</td>
      <td>8086</td>
      <td>107.4289</td>
      <td>108.1191</td>
    </tr>
  </tbody>
</table>

> [!tip] Related pattern
>
> For the architectural context of where streaming fits within the broader data platform — including how real-time feeds connect to batch pipelines — see [streaming-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/streaming-architecture).

## WebSocket Streaming

Full-duplex, persistent TCP connection. The server pushes ticks as they occur — no polling.
Used by every real-time trading platform (Binance, Bloomberg Terminal, Refinitiv).

#### Run WebSocket server and client for simulated tick feed using websockets over TCP

Starts a local WebSocket server in a background thread that broadcasts ticks at ~100 msg/s.
The client connects, receives ticks for 3 seconds, and collects them into a DataFrame.

**Scenario:** Real-time price dashboards, algorithmic trading, live order book feeds.
**When NOT to use:** One-shot request/response patterns — use REST instead.

```python
# WebSocket server — broadcasts ticks with embedded send_ts for one-way latency
WS_PORT = 8765

async def ws_handler(websocket):
    try:
        while True:
            t = generate_tick()
            t['send_ts'] = time.perf_counter_ns()
            await websocket.send(json.dumps(t))
            await asyncio.sleep(0)  # yield, no delay
    except websockets.ConnectionClosed:
        pass

ws_server = await websockets.serve(ws_handler, 'localhost', WS_PORT)
WS_PORT  # WebSocket server running on ws://localhost
```

      WebSocket server running on ws://localhost:8765

#### websockets.connect — WebSocket streaming client, receive ticks

```python
# WebSocket client — one-way latency (send_ts embedded by server)
ws_latencies_us = []
WARMUP_WS = 100
NUM_WS = 10_000

async def ws_bench():
    async with websockets.connect(f'ws://localhost:{WS_PORT}') as ws:
        msg_count = 0
        gc_disabled = False
        async for msg in ws:
            msg_count += 1
            if msg_count <= WARMUP_WS:
                continue
            if not gc_disabled:
                gc.disable()
                gc_disabled = True
            recv_ts = time.perf_counter_ns()
            tick = json.loads(msg)
            send_ts = tick['send_ts']
            ws_latencies_us.append((recv_ts - send_ts) / 1000)
            if len(ws_latencies_us) >= NUM_WS:
                break
        if gc_disabled:
            gc.enable()

asyncio.run(ws_bench())
ws_server.close()

ws_latencies_us.sort()
ws_p50 = ws_latencies_us[len(ws_latencies_us) // 2]
ws_p99 = ws_latencies_us[int(len(ws_latencies_us) * 0.99)]
ws_p999 = ws_latencies_us[int(len(ws_latencies_us) * 0.999)]
print(f'  {len(ws_latencies_us)} one-way measurements')
print(f'  p50: {ws_p50:.0f}µs  p99: {ws_p99:.0f}µs  p99.9: {ws_p999:.0f}µs')
```

      10000 one-way measurements
      p50: 83µs  p99: 139µs  p99.9: 233µs

## Server-Sent Events (SSE)

One-directional server→client push over HTTP. Simpler than WebSocket — works through
proxies/CDNs, auto-reconnects, text-only. Used by ChatGPT, GitHub notifications, stock tickers.

#### Run SSE server and client for simulated tick feed using aiohttp over HTTP

Starts a local aiohttp server that streams ticks as `text/event-stream`. The client reads
events using `httpx` async streaming.

**Scenario:** Live dashboards, notification feeds, AI chat token streaming.
**When NOT to use:** Bi-directional communication — use WebSocket. Binary data — use gRPC.

```python
# SSE server — streams ticks as text/event-stream
SSE_PORT = 8766
sse_running = True

async def sse_handler(request):
    resp = web.StreamResponse()
    resp.content_type = 'text/event-stream'
    resp.headers['Cache-Control'] = 'no-cache'
    resp.headers['Connection'] = 'keep-alive'
    await resp.prepare(request)
    while sse_running:
        t = generate_tick()
        t['send_ts'] = time.perf_counter_ns()
        tick = json.dumps(t)
        await resp.write(f'data: {tick}\n\n'.encode())
        await asyncio.sleep(0)
    return resp

async def start_sse_server():
    app = web.Application()
    app.router.add_get('/ticks', sse_handler)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, 'localhost', SSE_PORT)
    await site.start()
    while sse_running:
        await asyncio.sleep(0.1)
    await runner.cleanup()

sse_loop = asyncio.new_event_loop()
sse_thread = threading.Thread(target=lambda: sse_loop.run_until_complete(start_sse_server()), daemon=True)
sse_thread.start()
time.sleep(0.5)
print(f'  SSE server running on http://localhost:{SSE_PORT}/ticks')
```

      SSE server running on http://localhost:8766/ticks

#### httpx AsyncClient — SSE client, receive Server-Sent Events

```python
# SSE client — one-way latency (SSE is server→client only, can't echo)
sse_latencies_us = []
WARMUP_SSE = 100
NUM_SSE = 10_000

async def sse_bench():
    async with httpx.AsyncClient() as client:
        async with client.stream('GET', f'http://localhost:{SSE_PORT}/ticks') as resp:
            msg_count = 0
            gc_disabled = False
            async for line in resp.aiter_lines():
                if not line.startswith('data: '):
                    continue
                msg_count += 1
                # Skip warmup
                if msg_count <= WARMUP_SSE:
                    continue
                # Disable GC after warmup
                if not gc_disabled:
                    gc.disable()
                    gc_disabled = True
                recv_ts = time.perf_counter_ns()
                tick = json.loads(line[6:])
                send_ts = tick['send_ts']
                sse_latencies_us.append((recv_ts - send_ts) / 1000)
                if len(sse_latencies_us) >= NUM_SSE:
                    break
            if gc_disabled:
                gc.enable()

asyncio.run(sse_bench())
sse_running = False

sse_latencies_us.sort()
sse_p50 = sse_latencies_us[len(sse_latencies_us) // 2]
sse_p99 = sse_latencies_us[int(len(sse_latencies_us) * 0.99)]
sse_p999 = sse_latencies_us[int(len(sse_latencies_us) * 0.999)]
print(f'  {len(sse_latencies_us)} one-way measurements')
print(f'  p50: {sse_p50:.0f}µs  p99: {sse_p99:.0f}µs  p99.9: {sse_p999:.0f}µs')
```

      10000 one-way measurements
      p50: 127µs  p99: 524µs  p99.9: 654µs

## Google Cloud Pub/Sub

Managed message bus with at-least-once delivery, auto-scaling, and dead-letter queues.
Decouples publishers from subscribers — the backbone of event-driven architectures in GCP. For topic/subscription setup, dead-letter configuration, and operational patterns via `gcloud`, see [pubsub-messaging](https://alp78.github.io/elysium/06-GCP/Serverless/pubsub-messaging).

#### gcloud services enable + IAM binding — Pub/Sub API and permissions

```python
# Enable Pub/Sub API and grant admin role to the service account
!gcloud services enable pubsub.googleapis.com --project=seclab-dev-ap-26
!gcloud projects add-iam-policy-binding seclab-dev-ap-26 --member=serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com --role=roles/pubsub.admin --condition=None --quiet
```

    bindings:
    - members:
      - serviceAccount:service-922174528852@gcp-sa-artifactregistry.iam.gserviceaccount.com
      role: roles/artifactregistry.serviceAgent
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/bigquery.admin
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/cloudkms.cryptoKeyEncrypterDecrypter
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/cloudsql.admin
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/compute.instanceAdmin.v1
    - members:
      - serviceAccount:922174528852@cloudservices.gserviceaccount.com
      role: roles/compute.instanceGroupManagerServiceAgent
    - members:
      - serviceAccount:service-922174528852@compute-system.iam.gserviceaccount.com
      role: roles/compute.serviceAgent
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/datastore.owner
    - members:
      - serviceAccount:922174528852-compute@developer.gserviceaccount.com
      role: roles/editor
    - members:
      - serviceAccount:service-922174528852@firebase-rules.iam.gserviceaccount.com
      role: roles/firebaserules.system
    - members:
      - serviceAccount:service-922174528852@gcp-sa-firestore.iam.gserviceaccount.com
      role: roles/firestore.serviceAgent
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/iam.serviceAccountTokenCreator
    - members:
      - user:alexper.recovery@gmail.com
      role: roles/owner
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/pubsub.admin
    - members:
      - serviceAccount:service-922174528852@gcp-sa-pubsub.iam.gserviceaccount.com
      role: roles/pubsub.serviceAgent
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/secretmanager.admin
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/storage.admin
    etag: BwZOCmEOLbA=
    version: 1

    Updated IAM policy for project [seclab-dev-ap-26].

#### google-cloud-pubsub PublisherClient + SubscriberClient — create topic and subscription

```python
# Create topic and subscription for tick streaming (idempotent — skips if exists)
TOPIC_ID = 'tick-feed'
SUB_ID   = 'tick-feed-sub'
topic_path = publisher.topic_path(PROJECT_ID, TOPIC_ID)
sub_path   = subscriber.subscription_path(PROJECT_ID, SUB_ID)

# Get or create topic
try:
    publisher.get_topic(request={'topic': topic_path})
    print(f'  Topic exists: {topic_path}')
except Exception:
    publisher.create_topic(request={'name': topic_path})
    print(f'  Created topic: {topic_path}')

# Get or create subscription
try:
    subscriber.get_subscription(request={'subscription': sub_path})
    print(f'  Subscription exists: {sub_path}')
except Exception:
    subscriber.create_subscription(request={'name': sub_path, 'topic': topic_path, 'ack_deadline_seconds': 10})
    print(f'  Created subscription: {sub_path}')
```

      Topic exists: projects/seclab-dev-ap-26/topics/tick-feed
      Subscription exists: projects/seclab-dev-ap-26/subscriptions/tick-feed-sub

#### Publish and subscribe to tick feed using google-cloud-pubsub over gRPC

Publishes 1000 ticks to the topic, then pulls them back via the subscription.
Measures end-to-end latency (publish → receive) and throughput.

**Scenario:** Event-driven pipelines, microservice communication, IoT telemetry.
**When NOT to use:** Sub-millisecond latency requirements — use direct TCP/WebSocket.

#### Start streaming subscriber using google-cloud-pubsub subscriber.subscribe over gRPC

Starts the subscriber before publishing so the gRPC stream is established when messages arrive. Measures true transport latency, not queue wait time.

```python
# Start streaming pull FIRST — connects the gRPC stream before any messages are published
NUM_TICKS = 1000
received = []
pull_lock = threading.Lock()

def callback(message):
    receive_time = time.time()
    tick = json.loads(message.data.decode('utf-8'))
    tick['receive_ts'] = receive_time
    with pull_lock:
        received.append(tick)
    message.ack()

streaming_pull = subscriber.subscribe(sub_path, callback=callback)
time.sleep(2)  # let the gRPC stream establish
print(f'  Streaming subscriber connected on {sub_path}')
```

      Streaming subscriber connected on projects/seclab-dev-ap-26/subscriptions/tick-feed-sub

#### Publish 1000 ticks using google-cloud-pubsub publisher.publish over gRPC

Publishes 1000 ticks with wall-clock timestamps. The subscriber callback receives them in real-time.

```python
# Publish ticks — subscriber is already listening
t0 = time.perf_counter()
futures = []
for _ in range(NUM_TICKS):
    tick = generate_tick()
    tick['publish_ts'] = time.time()  # wall clock for cross-process latency
    data = json.dumps(tick).encode('utf-8')
    futures.append(publisher.publish(topic_path, data))
for f in futures:
    f.result()
pub_ms = (time.perf_counter() - t0) * 1000
print(f'  Published {NUM_TICKS} ticks in {fmt_time(pub_ms)} ({fmt_rate(NUM_TICKS, pub_ms)})')
```

      Published 1000 ticks in 737ms (1.4K msg/s)

#### Measure end-to-end Pub/Sub latency from publish to callback over gRPC

Waits for all messages to arrive, then computes publish-to-receive latency per message (avg and P99).

```python
# Pub/Sub latency: publish 500 messages at steady rate, measure delivery latency
# Uses custom 'send_ts' attribute (same machine, no clock drift) instead of
# message.publish_time (which uses Google's server clock, causing NTP offset errors).

NUM_PS = 500
WARMUP_PS = 50
ps_latencies_ms = []
ps_lock = threading.Lock()
ps_count = [0]
ps_done = threading.Event()

def ps_callback(message):
    recv_time = time.time()
    send_ts = float(message.attributes.get('send_ts', '0'))
    if send_ts > 0:
        latency = (recv_time - send_ts) * 1000
        with ps_lock:
            ps_count[0] += 1
            if ps_count[0] > WARMUP_PS:  # skip warmup
                ps_latencies_ms.append(latency)
            if len(ps_latencies_ms) >= NUM_PS:
                ps_done.set()
    message.ack()

# Start streaming subscriber FIRST
sub_client = subscriber.subscribe(sub_path, callback=ps_callback)
time.sleep(2)

# Publish at steady ~50 msg/s with send_ts as custom attribute
total_msgs = WARMUP_PS + NUM_PS
t0 = time.perf_counter()
for n in range(total_msgs):
    payload = json.dumps(generate_tick()).encode('utf-8')
    publisher.publish(topic_path, payload, send_ts=str(time.time()))
    time.sleep(0.02)  # ~50 msg/s steady rate
pub_ms = (time.perf_counter() - t0) * 1000
print(f'  Published {total_msgs} messages in {fmt_time(pub_ms)}')

# Wait for all messages to arrive
ps_done.wait(timeout=60)
sub_client.cancel()

ps_latencies_ms.sort()
if ps_latencies_ms:
    avg_latency = sum(ps_latencies_ms) / len(ps_latencies_ms)
    ps_p50 = ps_latencies_ms[len(ps_latencies_ms) // 2]
    ps_p99 = ps_latencies_ms[int(len(ps_latencies_ms) * 0.99)]
    print(f'  {len(ps_latencies_ms)} delivery latency measurements')
    print(f'  p50: {ps_p50:.0f}ms  p99: {ps_p99:.0f}ms  avg: {avg_latency:.0f}ms')
else:
    avg_latency = 0
    print('  No messages received')
```

      Published 550 messages in 11.5s
      225 delivery latency measurements
      p50: 45ms  p99: 52ms  avg: 45ms

## Firestore Real-Time Listener

Firestore’s `on_snapshot` pushes document changes to the client in real-time over gRPC.
The same mechanism that powers live sync in Firebase mobile apps and dashboards.

#### Register Firestore real-time listener using google-cloud-firestore on_snapshot over gRPC

Registers a callback that fires on every document change (ADDED, MODIFIED, REMOVED). Runs in a background thread.

**Scenario:** Live dashboards, mobile sync, collaborative editing, cache invalidation.
**When NOT to use:** High-throughput ingestion (>1K writes/s) — use Pub/Sub or streaming inserts.

```python
# Register on_snapshot listener — same measurement pattern as Pub/Sub
FS_RT_COLLECTION = 'realtime_ticks'
NUM_FS = 500
WARMUP_FS = 50
fs_latencies_ms = []
fs_lock = threading.Lock()
fs_count = [0]
fs_done = threading.Event()

def on_snapshot(col_snapshot, changes, read_time):
    recv_time = time.time()
    for change in changes:
        if change.type.name == 'ADDED':
            doc = change.document.to_dict()
            send_ts = doc.get('send_ts', 0)
            if send_ts > 0:
                latency = (recv_time - send_ts) * 1000
                with fs_lock:
                    fs_count[0] += 1
                    if fs_count[0] > WARMUP_FS:
                        fs_latencies_ms.append(latency)
                    if len(fs_latencies_ms) >= NUM_FS:
                        fs_done.set()

col_ref = fs_client.collection(FS_RT_COLLECTION)
listener = col_ref.on_snapshot(on_snapshot)
time.sleep(1)
print(f'  Listener registered on {FS_RT_COLLECTION}')
```

      Listener registered on realtime_ticks

#### Write documents to Firestore using google-cloud-firestore batch.commit over gRPC

Writes 100 documents via Firestore batch API. Each document carries a `write_ts` timestamp for latency measurement.

```python
# Write documents one at a time at steady rate — same pattern as Pub/Sub
# Individual set() instead of batch — each doc triggers a separate notification.
total_fs = WARMUP_FS + NUM_FS
t0 = time.perf_counter()
for i in range(total_fs):
    tick = generate_tick()
    tick['send_ts'] = time.time()  # same-machine clock, no drift
    tick['seq'] = i
    col_ref.document(f'tick_{i:04d}').set(tick)
    time.sleep(0.02)  # ~50 msg/s steady rate, matching Pub/Sub
write_ms = (time.perf_counter() - t0) * 1000
print(f'  Wrote {total_fs} documents in {fmt_time(write_ms)}')
```

      Wrote 550 documents in 30.5s

#### Measure Firestore listener latency from on_snapshot change events over gRPC

Waits for the background listener to receive all change events, then computes write-to-receive latency per document.

```python
# Wait for all notifications, compute latency
fs_done.wait(timeout=60)
listener.unsubscribe()

fs_latencies_ms.sort()
if fs_latencies_ms:
    fs_avg = sum(fs_latencies_ms) / len(fs_latencies_ms)
    fs_p50 = fs_latencies_ms[len(fs_latencies_ms) // 2]
    fs_p99 = fs_latencies_ms[int(len(fs_latencies_ms) * 0.99)]
    print(f'  {len(fs_latencies_ms)} delivery latency measurements')
    print(f'  p50: {fs_p50:.0f}ms  p99: {fs_p99:.0f}ms  avg: {fs_avg:.0f}ms')
else:
    fs_avg = 0
    print('  No notifications received')
```

      500 delivery latency measurements
      p50: 44ms  p99: 63ms  avg: 44ms

#### google-cloud-firestore — cleanup real-time collection

```python
# Delete test documents
for i in range(WARMUP_FS + NUM_FS):
    fs_client.collection(FS_RT_COLLECTION).document(f'tick_{i:04d}').delete()
print(f'  Deleted {WARMUP_FS + NUM_FS} documents from {FS_RT_COLLECTION}')
```

      Deleted 550 documents from realtime_ticks

## Latency Comparison

Two separate comparisons — local protocols vs GCP managed services — because mixing
localhost (0ms network) with cross-continent GCP (300ms RTT) would be meaningless.

#### Local protocols — WebSocket vs SSE throughput (localhost, no network)

```python
# Local protocols — p50 one-way latency (µs), both measured the same way
#
# WebSocket is ~1.5x faster at p50 — binary frames (2-6 byte header) have less
# per-message overhead than SSE's HTTP chunked text encoding (chunk size + 'data: ' prefix + 

# SSE tail latency (p99) is significantly worse due to HTTP line parsing edge cases
# (partial reads, buffer boundaries) that don't affect binary WebSocket framing.
# Both are sub-millisecond on localhost — in production, network RTT dominates.
# SSE trade-off: works through CDNs/proxies, built-in auto-reconnect, simpler to implement.

local_data = {
    'WebSocket': ws_p50,
    'SSE': sse_p50,
}

print(f'  WebSocket: p50={ws_p50:.0f}µs  p99={ws_p99:.0f}µs  ({len(ws_latencies_us)} msgs)')
print(f'  SSE:       p50={sse_p50:.0f}µs  p99={sse_p99:.0f}µs  ({len(sse_latencies_us)} msgs)')

fig_local = go.Figure(go.Bar(
    x=list(local_data.keys()), y=list(local_data.values()),
    text=[f'{v:.0f}µs' for v in local_data.values()],
    textposition='outside', cliponaxis=False,
))
fig_local.update_layout(
    title='Local Streaming — p50 One-Way Latency (µs, lower = better)',
    yaxis_title='Latency (µs)',
    template='plotly_dark', height=400,
    margin=dict(t=60),
)
fig_local.show()
```

      WebSocket: p50=83µs  p99=139µs  (10000 msgs)
      SSE:       p50=127µs  p99=524µs  (10000 msgs)

<iframe src="/static/plotly/sr_py_01.html" width="100%" height="500" style="border:none;border-radius:8px;" loading="lazy"></iframe>

#### GCP managed services — Pub/Sub vs Firestore vs Batch GCS (europe-west1)

```python
# Measure raw gRPC RTT to GCP as baseline (Firestore metadata call)
# This isolates network latency from protocol overhead.
rtt_samples = []
for _ in range(50):
    t0 = time.perf_counter_ns()
    # Minimal Firestore call — just reads server metadata, no data transfer
    list(fs_client.collection('rtt_probe').limit(1).stream())
    t1 = time.perf_counter_ns()
    rtt_samples.append((t1 - t0) / 1000)  # µs

rtt_samples.sort()
rtt_p50 = rtt_samples[len(rtt_samples) // 2]
rtt_p99 = rtt_samples[int(len(rtt_samples) * 0.99)]
rtt_ms = rtt_p50 / 1000
print(f'  gRPC RTT to GCP (50 samples): p50={rtt_p50/1000:.0f}ms  p99={rtt_p99/1000:.0f}ms')
```

      gRPC RTT to GCP (50 samples): p50=33ms  p99=49ms

```python
# GCP managed services — total latency and protocol overhead
#
# Network RTT dominates ~75% of total latency for both services.
# Protocol overhead is nearly identical — both use gRPC to the same GCP region.
# On a VM in the same region (RTT ≈ 0), expect ~10-15ms pure service overhead.

ps_overhead_ms = max(0, avg_latency - rtt_ms) if 'avg_latency' in dir() else 0
fs_total_ms = fs_avg if 'fs_avg' in dir() else 0
fs_overhead_ms = max(0, fs_total_ms - rtt_ms)

print(f'  Network RTT baseline:  {rtt_ms:.0f}ms')
print(f'  Pub/Sub total:         {avg_latency:.0f}ms  overhead: {ps_overhead_ms:.0f}ms')
print(f'  Firestore total:       {fs_total_ms:.0f}ms  overhead: {fs_overhead_ms:.0f}ms')

gcp_labels = ['Pub/Sub', 'Firestore']
gcp_rtt = [rtt_ms, rtt_ms]
gcp_overhead = [ps_overhead_ms, fs_overhead_ms]

fig_gcp = go.Figure()
fig_gcp.add_trace(go.Bar(name='Network RTT', x=gcp_labels, y=gcp_rtt,
    marker_color='#555'))
fig_gcp.add_trace(go.Bar(name='Protocol overhead', x=gcp_labels, y=gcp_overhead,
    marker_color='#636EFA'))
# Add total labels on top
totals = [avg_latency, fs_total_ms]
fig_gcp.add_trace(go.Scatter(x=gcp_labels, y=[t + 2 for t in totals],
    text=[f'{t:.0f}ms' for t in totals], mode='text', showlegend=False))
fig_gcp.update_layout(
    title='GCP Managed Services — Latency Breakdown (ms)',
    yaxis_title='Latency (ms)',
    barmode='stack',
    template='plotly_dark', height=450,
    margin=dict(t=60),
)
fig_gcp.show()
```

      Network RTT baseline:  33ms (p50 of 50 gRPC probes)
      Pub/Sub total:         45ms  overhead: 12ms
      Firestore total:       44ms  overhead: 11ms

<iframe src="/static/plotly/sr_py_02.html" width="100%" height="500" style="border:none;border-radius:8px;" loading="lazy"></iframe>

#### google-cloud-pubsub — delete subscription and topic

```python
# Delete subscription and topic
try:
    subscriber.delete_subscription(request={'subscription': sub_path})
    print(f'  Deleted subscription: {sub_path}')
except Exception:
    print(f'  Subscription already deleted')

try:
    publisher.delete_topic(request={'topic': topic_path})
    print(f'  Deleted topic: {topic_path}')
except Exception:
    print(f'  Topic already deleted')
```

      Deleted subscription: projects/seclab-dev-ap-26/subscriptions/tick-feed-sub
      Deleted topic: projects/seclab-dev-ap-26/topics/tick-feed

## Enterprise Transfer & Streaming Patterns (Reference)

Production patterns for large-scale data movement that go beyond what a notebook can demonstrate.
Included as architecture reference — no runnable code.

#### Enterprise Streaming — MFT (Managed File Transfer)

**What:** Dedicated gateways that handle large file transfers with multiplexing, packet-level resume,
bandwidth routing, encryption, and audit logging. Examples: IBM Sterling, Axway, GoAnywhere.

#### When to use
- Regulated industries (finance, healthcare) requiring audit trails
- Multi-partner B2B file exchange with SLA guarantees
- Files > 100 GB where resumability is critical

**When NOT to use:** Internal cloud-to-cloud transfers — use native cloud tools instead.

#### GCS Transfer Service

**What:** Managed service for scheduled, recurring transfers between GCS buckets, S3, Azure,
or HTTP endpoints. Handles retries, bandwidth throttling, and incremental sync.

#### When to use
- Scheduled cross-cloud data replication (S3 → GCS nightly)
- Large dataset migration (TB-scale, multi-day)
- On-prem NAS → GCS via Transfer Service for on-premises data

```
gcloud transfer jobs create \\
  --source-agent-pool=my-pool \\
  --source=posix:///data/exports \\
  --destination=gs://my-bucket/imports
```

#### Transfer Acceleration & Cloud Interconnect

**Transfer Acceleration:** Routes uploads through the cloud provider’s edge network (CDN PoPs)
instead of the public internet. AWS S3 Transfer Acceleration, GCS has equivalent via CDN.
Typical speedup: 2-5x for cross-continent transfers.

**Cloud Interconnect / Direct Peering:** Dedicated physical network links between your
data center and the cloud provider. Consistent bandwidth (10-100 Gbps), lower latency,
no public internet routing.

| Method | Bandwidth | Latency | Cost | Use Case |
|--------|-----------|---------|------|----------|
| Public internet | Variable | High | Free | Dev, small transfers |
| Transfer Acceleration | 2-5x faster | Medium | Per-GB fee | Cross-continent uploads |
| Dedicated Interconnect | 10-100 Gbps | Low | Monthly + port fee | Production pipelines |
| Partner Interconnect | 50 Mbps-50 Gbps | Low | Monthly | Smaller dedicated link |

#### When to Use What

| Scenario | Pattern | Why |
|----------|---------|-----|
| Live price dashboard | **WebSocket** | Full-duplex, lowest latency, server push |
| AI chat token streaming | **SSE** | One-directional, works through CDN, auto-reconnect |
| Event-driven microservices | **Pub/Sub** | Decoupled, at-least-once, auto-scaling, dead-letter |
| Mobile live sync | **Firestore listener** | Built-in offline support, per-document granularity |
| Nightly ETL batch | **GCS + BigQuery load** | Highest throughput, lowest cost per byte |
| Cross-cloud migration | **Transfer Service** | Managed, scheduled, resumable |
| Regulated B2B exchange | **Enterprise MFT** | Audit trails, SLA, encryption at rest + transit |
| High-bandwidth production | **Cloud Interconnect** | Dedicated line, consistent 10+ Gbps |
