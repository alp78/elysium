---
type: reference
category: programming-languages
technology: [python]
tags: [python]
aliases: [Google Cloud, BigQuery, Cloud Storage, GCS, Pub/Sub, cloud SDK]
keywords: [google-cloud, BigQuery, Cloud Storage, Pub/Sub, GCS, google-auth, service account, gcloud]
description: "Python GCP reference with executable examples and cell outputs — covers BigQuery, Cloud Storage, Pub/Sub, and authentication with the Google Cloud Python SDK. See [[17_cs_gcp]] for the C# equivalent."
related:
  - "[[moc-programming-languages]]"
  - "[[17_cs_gcp]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 17. GCP - Python

![Pipeline Architecture](/static/index_lab.jpg)

## How the Pipeline Works

<!-- 

| Step | GCP Service | What Happens |
|------|------------|--------------|
| **1. Fetch** | *yfinance* | Fetch OHLCV market data for 5 Euro Stoxx tickers (ASML, MC, SAP, SIE, TTE) — 90 days of daily prices |
| **2. Upload** | **Cloud Storage** | Upload raw CSV to `gs://bucket/bronze/ohlcv/` — this is the **Bronze** layer (raw, immutable) |
| **3. Load** | **BigQuery** | Load CSV into `bronze_ohlcv` table — partitioned by date, clustered by symbol |
| **4. Transform** | **BigQuery** | SQL window functions compute daily returns → write to `silver_ohlcv` — the **Silver** layer (cleaned) |
| **5. Score** | **BigQuery** | Compute 30-day momentum, volume ratios, composite rankings → write to `gold_scores` — the **Gold** layer (analytics-ready) |
| **6. Publish** | **Firestore** | Write gold scores to `scores_latest` collection — real-time dashboard access, no polling needed |
| **7. Notify** | **Pub/Sub** | Publish pipeline events (`ohlcv_loaded`, `silver_computed`, `gold_scored`) — downstream consumers subscribe |
| **8. Pulse** | **Firestore** | Pulse scheduler (every 60s) writes live price snapshots to `pulse_live` — real-time listeners catch changes |
| **9. Secure** | **Secret Manager** | All credentials (DB passwords, API keys) retrieved at runtime — never hardcoded |
| **10. Observe** | **Cloud Monitoring** | Structured logs + custom metrics (rows loaded, pipeline duration) — alerts and dashboards |

 -->

## Topics Covered
- Authentication & Setup
- Cloud Storage (GCS)
- BigQuery
- Pub/Sub
- Firestore (+ real-time listeners)
- Secret Manager
- Cloud Monitoring

## Authentication & Setup

**Pipeline role:** The foundation — every GCP service call is authenticated via a service account key. The key file (JSON) is set via `GOOGLE_APPLICATION_CREDENTIALS` env var. All libraries auto-detect it.

Service Account (SA) — non-human identity with specific roles. `GOOGLE_APPLICATION_CREDENTIALS` env var points to the JSON key file — all `google-cloud-*` libraries auto-detect it. ADC chain: env var → `gcloud auth` → metadata server.

```python
import os

from datetime import datetime
from datetime import datetime, timedelta
from google.api import metric_pb2
from google.cloud import bigquery
from google.cloud import firestore
from google.cloud import firestore, bigquery
from google.cloud import monitoring_v3
from google.cloud import pubsub_v1
from google.cloud import secretmanager
from google.cloud import storage
from google.protobuf.timestamp_pb2 import Timestamp
import google.cloud.logging as cloud_logging
import io
import json, time
import pandas as pd
import threading
import time
import yfinance as yf
PROJECT_ID = "index-lab-2"
REGION = "europe-west1"
BUCKET_NAME = f"{PROJECT_ID}-index-data"
BQ_DATASET = "index_data"

# Verify authentication
creds_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', 'NOT SET')
print(f"GOOGLE_APPLICATION_CREDENTIALS: {creds_path}")
print(f"File exists: {os.path.exists(creds_path) if creds_path != 'NOT SET' else False}")
print(f"Project: {PROJECT_ID}")
print(f"Region:  {REGION}")
```

    GOOGLE_APPLICATION_CREDENTIALS: NOT SET
    File exists: False
    Project: index-lab-2
    Region:  europe-west1

## Cloud Storage (GCS)

**Pipeline role: BRONZE LAYER** — Raw data lands here first. yfinance OHLCV data is fetched and uploaded as CSV to `gs://bucket/bronze/ohlcv/`. GCS is the data lake — immutable, versioned, cheap storage. Downstream services (BigQuery, pipelines) read from here. For the CLI equivalents of these operations (`gsutil cp`, `gcloud storage cp`, lifecycle rules), see [[gcs-object-operations]].

GCS organizes data into **buckets** (globally unique top-level containers) containing **blobs** (objects identified by path). Prefixes like `bronze/`, `silver/`, `gold/` simulate a folder hierarchy. C# equivalent: `Google.Cloud.Storage.V1` (`StorageClient`).

```python
# Create GCS client — authenticates using GOOGLE_APPLICATION_CREDENTIALS
# In the pipeline: this client handles all object storage operations
gcs = storage.Client(project=PROJECT_ID)
# Get a reference to our bucket — doesn't make a network call yet
bucket = gcs.bucket(BUCKET_NAME)

# ─── Fetch OHLCV from yfinance ───
tickers = ["ASML.AS", "MC.PA", "SAP.DE", "SIE.DE", "TTE.PA"]
print("=== Fetching OHLCV from yfinance ===")

end_date = datetime.now()
start_date = end_date - timedelta(days=90)

all_data = []
for ticker in tickers:
    # yfinance fetches OHLCV data from Yahoo Finance API
    # auto_adjust=False keeps both Close and Adj Close columns
    df = yf.Ticker(ticker).history(start=start_date, end=end_date, interval='1d', auto_adjust=False)
    if df.empty:
        print(f"  {ticker}: no data")
        continue
    df = df.reset_index()
    df['symbol'] = ticker
    df['Date'] = df['Date'].dt.strftime('%Y-%m-%d')
    all_data.append(df)
    print(f"  {ticker}: {len(df)} rows")

ohlcv_df = pd.concat(all_data, ignore_index=True)
print(f"\nTotal: {len(ohlcv_df)} rows")

# ─── Upload to GCS (bronze layer) ───
print("\n=== Upload to GCS ===")
csv_buffer = ohlcv_df.to_csv(index=False)
blob_path = f"bronze/ohlcv/{datetime.now().strftime('%Y%m%d')}_ohlcv.csv"
blob = bucket.blob(blob_path)
# Upload the CSV string directly to GCS (no temp file needed)
# Pipeline role: this is the BRONZE layer — raw data as-is from source
blob.upload_from_string(csv_buffer, content_type='text/csv')
print(f"  Uploaded: gs://{BUCKET_NAME}/{blob_path} ({len(csv_buffer):,} bytes)")

# ─── List blobs in bronze/ ───
print("\n=== List Bronze Blobs ===")
# List objects in a prefix — like `ls` for a folder in GCS
for blob in gcs.list_blobs(BUCKET_NAME, prefix="bronze/", max_results=10):
    print(f"  {blob.name:50s} {blob.size or 0:>10,} bytes")

# ─── Download and read back ───
print("\n=== Download & Verify ===")
# Download blob content as string — for verification or reprocessing
downloaded = bucket.blob(blob_path).download_as_text()
df_check = pd.read_csv(io.StringIO(downloaded))
print(f"  Downloaded: {len(df_check)} rows, {len(df_check.columns)} columns")
print(f"  Columns: {list(df_check.columns)}")
print(f"  Tickers: {sorted(df_check["symbol"].unique())}")
```

    === Fetching OHLCV from yfinance ===
      ASML.AS: 62 rows
      MC.PA: 62 rows
      SAP.DE: 60 rows
      SIE.DE: 60 rows
      TTE.PA: 62 rows
    
    Total: 306 rows
    
    === Upload to GCS ===
      Uploaded: gs://index-lab-2-index-data/bronze/ohlcv/20260322_ohlcv.csv (35,426 bytes)
    
    === List Bronze Blobs ===
      bronze/.keep                                                0 bytes
      bronze/ohlcv/20260322_ohlcv.csv                        35,426 bytes
    
    === Download & Verify ===
      Downloaded: 306 rows, 10 columns
      Columns: ['Date', 'Open', 'High', 'Low', 'Close', 'Adj Close', 'Volume', 'Dividends', 'Stock Splits', 'symbol']
      Tickers: ['ASML.AS', 'MC.PA', 'SAP.DE', 'SIE.DE', 'TTE.PA']

## BigQuery

**Pipeline role: SILVER + GOLD LAYERS** — The analytics engine. Bronze data is loaded from GCS into BigQuery tables. SQL transforms compute daily returns (silver) and composite scores (gold). BigQuery handles petabyte-scale data with serverless SQL — no infrastructure to manage.

A **dataset** is a container for tables (like a schema in SQL Server). Tables use columnar storage with partitioning and clustering for performance. Data is loaded via **load jobs** (from GCS, DataFrames, or JSONL) and queried with standard SQL on Google's distributed engine. C# equivalent: `Google.Cloud.BigQuery.V2` (`BigQueryClient`).

```python
# Create BigQuery client — all queries and loads go through this
bq = bigquery.Client(project=PROJECT_ID)

# ─── Load DataFrame into BigQuery (bronze) ───
print("=== Load into BigQuery bronze_ohlcv ===")

# Rename columns to match BigQuery schema
load_df = ohlcv_df.rename(columns={
    'Date': 'date', 'Open': 'open', 'High': 'high', 'Low': 'low',
    'Close': 'close', 'Adj Close': 'adj_close', 'Volume': 'volume',
    'Dividends': 'dividends', 'Stock Splits': 'stock_splits',
})
# Convert date string to proper date type (BigQuery partitioning requires DATE, not STRING)
load_df['date'] = pd.to_datetime(load_df['date']).dt.date
# Add ingestion timestamp
load_df['_ingested_at'] = datetime.now(tz=__import__('datetime').timezone.utc)
load_df = load_df[['symbol', 'date', 'open', 'high', 'low', 'close', 'adj_close', 'volume', 'dividends', 'stock_splits', '_ingested_at']]

table_id = f'{PROJECT_ID}.{BQ_DATASET}.bronze_ohlcv'
job_config = bigquery.LoadJobConfig(write_disposition='WRITE_TRUNCATE')  # overwrite for demo
# Load DataFrame into BigQuery — WRITE_TRUNCATE replaces existing data
# Pipeline role: BRONZE layer in BigQuery — raw OHLCV data from GCS
job = bq.load_table_from_dataframe(load_df, table_id, job_config=job_config)
job.result()  # wait for completion
print(f"  Loaded {job.output_rows} rows into {table_id}")

# ─── Query: bronze → silver (add daily returns) ───
print("\n=== BigQuery: Bronze → Silver ===")
silver_sql = f'''
    SELECT *,
        SAFE_DIVIDE(close - LAG(close) OVER (PARTITION BY symbol ORDER BY date),
                    LAG(close) OVER (PARTITION BY symbol ORDER BY date)) AS daily_return,
        FALSE AS is_filled
    FROM `{PROJECT_ID}.{BQ_DATASET}.bronze_ohlcv`
    -- Note: no ORDER BY here — BigQuery can't write ordered results to a partitioned table
'''

silver_table = f'{PROJECT_ID}.{BQ_DATASET}.silver_ohlcv'
job_config = bigquery.QueryJobConfig(destination=silver_table, write_disposition='WRITE_TRUNCATE')
# Execute the silver SQL and write results to the silver table
# Pipeline role: SILVER layer — cleaned data with computed daily returns
job = bq.query(silver_sql, job_config=job_config)
job.result()
print(f"  Silver table: {bq.get_table(silver_table).num_rows} rows")

# ─── Query: silver → gold (compute scores) ───
print("\n=== BigQuery: Silver → Gold ===")
gold_sql = f'''
    WITH latest AS (
        SELECT symbol, date AS score_date, close, daily_return, volume,
            AVG(close) OVER (PARTITION BY symbol ORDER BY date ROWS BETWEEN 29 PRECEDING AND CURRENT ROW) AS sma_30,
            STDDEV(daily_return) OVER (PARTITION BY symbol ORDER BY date ROWS BETWEEN 29 PRECEDING AND CURRENT ROW) AS volatility_30d,
            AVG(CAST(volume AS FLOAT64)) OVER (PARTITION BY symbol ORDER BY date ROWS BETWEEN 9 PRECEDING AND CURRENT ROW) AS avg_volume_10d,
            ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) AS rn
        FROM `{PROJECT_ID}.{BQ_DATASET}.silver_ohlcv`
    )
    SELECT symbol, score_date, close, daily_return,
        volatility_30d, avg_volume_10d,
        SAFE_DIVIDE(close - sma_30, sma_30) AS momentum_score,
        SAFE_DIVIDE(CAST(volume AS FLOAT64), avg_volume_10d) AS volume_score,
        RANK() OVER (ORDER BY SAFE_DIVIDE(close - sma_30, sma_30) DESC) AS composite_rank,
        CURRENT_TIMESTAMP() AS _scored_at
    FROM latest WHERE rn = 1
'''

gold_table = f'{PROJECT_ID}.{BQ_DATASET}.gold_scores'
job_config = bigquery.QueryJobConfig(destination=gold_table, write_disposition='WRITE_TRUNCATE')
# Execute the gold SQL and write results to the gold table
# Pipeline role: GOLD layer — analytics-ready scores and rankings
job = bq.query(gold_sql, job_config=job_config)
job.result()
print(f"  Gold scores: {bq.get_table(gold_table).num_rows} rows")

# ─── Query results ───
print("\n=== Gold Scores ===")
results = bq.query(f'''
    SELECT symbol, score_date, ROUND(close, 2) AS close,
        ROUND(momentum_score * 100, 2) AS momentum_pct,
        ROUND(volume_score, 2) AS vol_ratio,
        composite_rank
    FROM `{gold_table}` ORDER BY composite_rank
''')
for row in results:
    print(f"  {row.composite_rank:>2d}. {row.symbol:10s} close={row.close:>8.2f}  momentum={row.momentum_pct:>+6.2f}%  vol_ratio={row.vol_ratio:.2f}")
```

    === Load into BigQuery bronze_ohlcv ===
      Loaded 306 rows into index-lab-2.index_data.bronze_ohlcv
    
    === BigQuery: Bronze → Silver ===
      Silver table: 306 rows
    
    === BigQuery: Silver → Gold ===
      Gold scores: 5 rows
    
    === Gold Scores ===
       1. TTE.PA     close=   76.96  momentum=+12.82%  vol_ratio=1.61
       2. ASML.AS    close= 1128.20  momentum= -6.15%  vol_ratio=3.01
       3. SAP.DE     close=  153.82  momentum= -8.70%  vol_ratio=2.84
       4. MC.PA      close=  457.95  momentum=-10.90%  vol_ratio=1.97
       5. SIE.DE     close=  203.75  momentum=-13.24%  vol_ratio=2.33

## Pub/Sub

**Pipeline role: EVENT BUS** — Decouples pipeline steps. After each ETL stage completes, a message is published ("ohlcv_loaded", "silver_computed", "gold_scored"). Downstream consumers (dashboards, alerting, other pipelines) subscribe to these events. Enables async, event-driven architecture. For topic/subscription management and dead-letter configuration via `gcloud`, see [[pubsub-messaging]].

Messages are published to **topics** (named channels) and consumed via **subscriptions** (pull or push). Each message carries a bytes payload plus optional string attributes as metadata. Messages must be **acknowledged** after processing — unacknowledged messages are redelivered after the ack deadline. C# equivalent: `Google.Cloud.PubSub.V1` (`PublisherClient`, `SubscriberClient`).

```python
TOPIC = "pipeline-events"
SUBSCRIPTION = "pipeline-events-sub"

# Create publisher client — sends messages to topics
# Pipeline role: after each ETL step, publish an event so downstream
# consumers (dashboards, alerts, other pipelines) know data is ready
publisher = pubsub_v1.PublisherClient()
# Create subscriber client — pulls messages from subscriptions
subscriber = pubsub_v1.SubscriberClient()
topic_path = publisher.topic_path(PROJECT_ID, TOPIC)
sub_path = subscriber.subscription_path(PROJECT_ID, SUBSCRIPTION)

# ─── Publish pipeline events ───
print("=== Publish Pipeline Events ===")
events = [
    {"event": "ohlcv_loaded", "table": "bronze_ohlcv", "rows": len(ohlcv_df), "tickers": tickers},
    {"event": "silver_computed", "table": "silver_ohlcv", "status": "success"},
    {"event": "gold_scored", "table": "gold_scores", "status": "success"},
]

for event in events:
    data = json.dumps(event).encode('utf-8')
    # Publish event to topic — data is bytes, attributes are string key-value metadata
    # future.result() blocks until the message is confirmed delivered
    future = publisher.publish(topic_path, data, source='notebook', pipeline='index_etl')
    msg_id = future.result()
    print(f"  Published: {event['event']} (msg_id={msg_id})")

time.sleep(2)  # let messages propagate

# ─── Pull and process messages ───
print("\n=== Pull Messages ===")
# Pull messages — synchronous pull (for batch processing)
# In production, use streaming pull for real-time processing
response = subscriber.pull(request={'subscription': sub_path, 'max_messages': 10})

ack_ids = []
for msg in response.received_messages:
    data = json.loads(msg.message.data.decode('utf-8'))
    attrs = dict(msg.message.attributes)
    print(f"  [{msg.message.publish_time.strftime('%H:%M:%S')}] {data['event']:20s} | attrs={attrs}")
    ack_ids.append(msg.ack_id)

if ack_ids:
    # Acknowledge messages — tells Pub/Sub we've processed them
    # Un-acked messages are redelivered after the ack deadline (60s)
    subscriber.acknowledge(request={'subscription': sub_path, 'ack_ids': ack_ids})
    print(f"\n  Acknowledged {len(ack_ids)} messages")
else:
    print("  No messages to pull")
```

    === Publish Pipeline Events ===
      Published: ohlcv_loaded (msg_id=18105666298433432)
      Published: silver_computed (msg_id=18105683355927302)
      Published: gold_scored (msg_id=18105673114676996)
    
    === Pull Messages ===
      [13:48:15] ohlcv_loaded         | attrs={'pipeline': 'index_etl', 'source': 'notebook'}
      [13:48:16] silver_computed      | attrs={'pipeline': 'index_etl', 'source': 'notebook'}
      [13:48:16] gold_scored          | attrs={'pipeline': 'index_etl', 'source': 'notebook'}
    
      Acknowledged 3 messages

## Firestore

**Pipeline role: REAL-TIME LAYER** — The live dashboard backend. Gold scores and pulse snapshots are written here for instant access. Firestore supports real-time listeners — dashboards get push notifications when data changes, without polling. Think of it as the "hot" layer vs BigQuery's "warm" layer.

Data is organized into **collections** (groups of documents, like tables) containing **documents** (JSON-like records with fields, like rows). Documents can have **subcollections** for nested hierarchies. Firestore's killer feature is **real-time listeners** — push notifications on data changes without polling. C# equivalent: `Google.Cloud.Firestore` (`FirestoreDb`).

```python
# Create Firestore client — connects to the document database
# Pipeline role: Firestore serves as the REAL-TIME layer
# Gold scores are written here for instant dashboard access
db = firestore.Client(project=PROJECT_ID)
# Create BigQuery client — all queries and loads go through this
bq = bigquery.Client(project=PROJECT_ID)

# --- Write gold scores to Firestore ---
print("=== Write Scores to Firestore ===")

# Query the gold table to display final rankings
results = bq.query(f'SELECT * FROM `{PROJECT_ID}.{BQ_DATASET}.gold_scores` ORDER BY composite_rank')

# Batch write — commits all operations atomically (all or nothing)
# More efficient than individual writes for bulk updates
batch = db.batch()
count = 0
for row in results:
    doc_ref = db.collection('scores_latest').document(row.symbol)
    # Set (upsert) a document — creates or overwrites the entire document
    batch.set(doc_ref, {
        'symbol': row.symbol,
        'close': row.close,
        'daily_return': row.daily_return,
        'momentum_score': row.momentum_score,
        'volume_score': row.volume_score,
        'composite_rank': row.composite_rank,
        'updated_at': datetime.now(tz=__import__("datetime").timezone.utc),
    })
    count += 1

# Commit the batch — all documents written in a single network round-trip
batch.commit()
print(f"  Written {count} scores to Firestore (scores_latest collection)")

# --- Read pulse_live (latest snapshots from scheduler) ---
print("\n=== Read Pulse Live Data ===")
docs = db.collection('pulse_live').stream()
pulse_count = 0
for doc in docs:
    d = doc.to_dict() or {}
    price = d.get('current_price', 'N/A')
    chg_pct = d.get('price_change_pct')
    vol_ratio = d.get('volume_ratio')
    ts = d.get('timestamp', '')
    print(f"  {doc.id:10s}  price={price:>10}  change={f'{chg_pct:+.2f}%' if chg_pct else 'N/A':>8s}  "
          f"vol_ratio={f'{vol_ratio:.2f}' if vol_ratio else 'N/A':>6s}  ts={ts[-8:]}")
    pulse_count += 1

if pulse_count == 0:
    print('  No pulse data yet. Run: python pulse_scheduler.py --once')
```

    === Write Scores to Firestore ===
      Written 5 scores to Firestore (scores_latest collection)
    
    === Read Pulse Live Data ===
      ASML.AS     price=    1128.2  change=  -3.46%  vol_ratio=  3.01  ts=03+00:00
      MC.PA       price=    457.95  change=  -0.50%  vol_ratio=  1.97  ts=59+00:00
      SAP.DE      price=    153.82  change=  -3.86%  vol_ratio=  2.84  ts=74+00:00
      SIE.DE      price=    203.75  change=  -3.11%  vol_ratio=  2.33  ts=01+00:00
      TTE.PA      price=     76.96  change=  -2.07%  vol_ratio=  1.61  ts=45+00:00

The `on_snapshot()` callback fires every time any document in the collection changes — this is how dashboards get push updates without polling. The `pulse_scheduler.py` writes to `pulse_live` every 60 seconds, and this listener catches each update as it happens. C# equivalent: `FirestoreDb.Collection().Listen()`.

> [!tip] Run pulse_scheduler.py in a separate
>
> Run `pulse_scheduler.py` in a separate terminal first
> `python pulse_scheduler.py --minutes 5`

```python
# Create Firestore client — connects to the document database
# Pipeline role: Firestore serves as the REAL-TIME layer
# Gold scores are written here for instant dashboard access
db = firestore.Client(project=PROJECT_ID)

# Track events received
events_received = []

def on_snapshot(doc_snapshot, changes, read_time):
    """Callback fired on every change to pulse_live collection."""
    for change in changes:
        doc = change.document
        d = doc.to_dict() or {}
        change_type = change.type.name  # ADDED, MODIFIED, REMOVED
        price = d.get('current_price', 'N/A')
        chg_pct = d.get('price_change_pct')
        ts = d.get('timestamp', '')[-8:]
        events_received.append({'symbol': doc.id, 'type': change_type, 'price': price})
        print(f"  [{change_type:8s}] {doc.id:10s}  price={price:>10}  "
              f"change={f'{chg_pct:+.2f}%' if chg_pct else 'N/A':>8s}  ts={ts}")

# --- Start listening ---
# on_snapshot fires immediately with current state (ADDED events),
# then fires again on every subsequent change (MODIFIED events).

print('=== Firestore Real-Time Listener ===')
print('Listening to pulse_live collection...')
print('(Run pulse_scheduler.py in another terminal to see live updates)\n')

# Subscribe to changes
query = db.collection('pulse_live')
# Register real-time listener — fires callback on every document change
# This is Firestore's killer feature: push notifications, not polling
# The pulse_scheduler.py writes to pulse_live every 60s,
# and this listener catches each update as it happens
listener = query.on_snapshot(on_snapshot)

# Wait for events (listen for 2 minutes, then unsubscribe)
LISTEN_SECONDS = 120
print(f'Listening for {LISTEN_SECONDS}s...\n')
time.sleep(LISTEN_SECONDS)

# Unsubscribe
# Stop listening — releases the gRPC stream to Firestore
listener.unsubscribe()
print(f'\nListener stopped. Total events received: {len(events_received)}')

# Show summary
if events_received:
    from collections import Counter
    type_counts = Counter(e['type'] for e in events_received)
    print(f'  ADDED:    {type_counts.get("ADDED", 0)} (initial state)')
    print(f'  MODIFIED: {type_counts.get("MODIFIED", 0)} (live updates from scheduler)')
    print(f'  REMOVED:  {type_counts.get("REMOVED", 0)}')
```

    === Firestore Real-Time Listener ===
    Listening to pulse_live collection...
    (Run pulse_scheduler.py in another terminal to see live updates)
    
    Listening for 120s...
    
      [ADDED   ] ASML.AS     price=    1128.2  change=  -3.46%  ts=03+00:00
      [ADDED   ] MC.PA       price=    457.95  change=  -0.50%  ts=59+00:00
      [ADDED   ] SAP.DE      price=    153.82  change=  -3.86%  ts=74+00:00
      [ADDED   ] SIE.DE      price=    203.75  change=  -3.11%  ts=01+00:00
      [ADDED   ] TTE.PA      price=     76.96  change=  -2.07%  ts=45+00:00
      [MODIFIED] ASML.AS     price=    1128.2  change=  -3.46%  ts=13+00:00
      [MODIFIED] MC.PA       price=    457.95  change=  -0.50%  ts=43+00:00
      [MODIFIED] SAP.DE      price=    153.82  change=  -3.86%  ts=69+00:00
      [MODIFIED] SIE.DE      price=    203.75  change=  -3.11%  ts=16+00:00
      [MODIFIED] TTE.PA      price=     76.96  change=  -2.07%  ts=56+00:00
      [MODIFIED] ASML.AS     price=    1128.2  change=  -3.46%  ts=66+00:00
      [MODIFIED] MC.PA       price=    457.95  change=  -0.50%  ts=59+00:00
      [MODIFIED] SAP.DE      price=    153.82  change=  -3.86%  ts=59+00:00
      [MODIFIED] SIE.DE      price=    203.75  change=  -3.11%  ts=10+00:00
      [MODIFIED] TTE.PA      price=     76.96  change=  -2.07%  ts=78+00:00
    
    Listener stopped. Total events received: 15
      ADDED:    5 (initial state)
      MODIFIED: 10 (live updates from scheduler)
      REMOVED:  0

## Secret Manager

**Pipeline role: CREDENTIAL VAULT** — All secrets (DB passwords, API keys, connection strings) live here. Pipeline code retrieves them at runtime — never hardcoded, never in git. Supports versioning and rotation. In production, Cloud Run and GKE inject secrets automatically. For the broader secrets management strategy including rotation policies and workload identity, see [[secrets-management]].

A **secret** is a named container for sensitive data. Each update creates a new immutable **version** — old versions can be disabled or destroyed for rotation. Secrets are retrieved at runtime via **access** calls (latest or specific version). C# equivalent: `Google.Cloud.SecretManager.V1` (`SecretManagerServiceClient`).

```python
# Create Secret Manager client
# Pipeline role: ALL credentials come from here — never hardcoded
# DB passwords, API keys, connection strings are stored as secrets
sm = secretmanager.SecretManagerServiceClient()

# ─── Read a secret ───
print("=== Read Secrets ===")
for secret_id in ['index-db-password', 'index-api-key']:
    name = f'projects/{PROJECT_ID}/secrets/{secret_id}/versions/latest'
    # Access the latest version of a secret — returns encrypted bytes
    response = sm.access_secret_version(request={'name': name})
    value = response.payload.data.decode('utf-8')
    # Never print real secrets — mask them
    masked = value[:3] + '*' * (len(value) - 3)
    print(f"  {secret_id}: {masked}")

# ─── Create a new secret + version ───
print("\n=== Create New Secret ===")
parent = f'projects/{PROJECT_ID}'
try:
    # Create a new secret container (the value is added separately as a 'version')
    sm.create_secret(request={
        'parent': parent,
        'secret_id': 'index-notebook-demo',
        'secret': {'replication': {'automatic': {}}},
    })
    print('  Created secret: index-notebook-demo')
except Exception as e:
    if 'ALREADY_EXISTS' in str(e):
        print('  Secret already exists: index-notebook-demo')

# Add a version
# Add a version — each update creates a new immutable version
# Old versions can be disabled/destroyed for rotation
sm.add_secret_version(request={
    'parent': f'{parent}/secrets/index-notebook-demo',
    'payload': {'data': b'my-secret-value-v1'},
})
print('  Added version 1')

# Read it back
    # Access the latest version of a secret — returns encrypted bytes
resp = sm.access_secret_version(request={
    'name': f'{parent}/secrets/index-notebook-demo/versions/latest'
})
print(f'  Value: {resp.payload.data.decode()}')

# ─── List all secrets ───
print("\n=== List Secrets ===")
for secret in sm.list_secrets(request={'parent': parent}):
    print(f'  {secret.name.split("/")[-1]}')

# ─── Cleanup demo secret ───
# Delete the entire secret and all its versions
sm.delete_secret(request={'name': f'{parent}/secrets/index-notebook-demo'})
print('\n  Deleted: index-notebook-demo')
```

    === Read Secrets ===
      index-db-password: Esg************
      index-api-key: dem***************
    
    === Create New Secret ===
      Created secret: index-notebook-demo
      Added version 1
      Value: my-secret-value-v1
    
    === List Secrets ===
      index-api-key
      index-db-password
      index-notebook-demo
    
      Deleted: index-notebook-demo

## Cloud Monitoring

**Pipeline role: OBSERVABILITY** — Two components: Cloud Logging (structured log entries for every pipeline event) and Cloud Monitoring (custom metrics for quantitative KPIs). Enables alerting ("pipeline failed", "row count dropped 50%"), dashboards, and post-mortem debugging.

Two components: **Cloud Logging** writes structured log entries queryable in Log Explorer, and **custom metrics** write time series data (row counts, latency, errors) viewable in Metrics Explorer. **Alerts** trigger notifications when metrics cross thresholds. C# equivalent: `Google.Cloud.Monitoring.V3` (`MetricServiceClient`).

```python
# ─── Cloud Logging ───
print("=== Cloud Logging ===")
# Create Cloud Logging client
# Pipeline role: structured logs for every pipeline step
# Queryable in Log Explorer — filter by event, severity, timestamp
log_client = cloud_logging.Client(project=PROJECT_ID)
logger = log_client.logger('index-pipeline')

# Write structured log entries
logger.log_struct({
    'event': 'pipeline_completed',
    'rows_loaded': len(ohlcv_df),
    'tickers': tickers,
    'status': 'success',
}, severity='INFO')
print("  Wrote INFO log: pipeline_completed")

logger.log_struct({
    'event': 'scores_computed',
    'table': 'gold_scores',
    'rows': 5,
}, severity='INFO')
print("  Wrote INFO log: scores_computed")

# ─── Custom Metrics ───
print("\n=== Custom Metrics ===")
# Create Monitoring client for custom metrics
# Pipeline role: track quantitative KPIs over time
# Examples: rows loaded, pipeline duration, error count, data freshness
metric_client = monitoring_v3.MetricServiceClient()
project_name = f'projects/{PROJECT_ID}'

# Create a custom metric descriptor
descriptor = metric_pb2.MetricDescriptor()
descriptor.type = "custom.googleapis.com/index_pipeline/rows_loaded"
descriptor.metric_kind = metric_pb2.MetricDescriptor.MetricKind.GAUGE
descriptor.value_type = metric_pb2.MetricDescriptor.ValueType.INT64
descriptor.description = "Number of OHLCV rows loaded per pipeline run"

try:
    # Register the metric type with Cloud Monitoring
    # Only needed once — subsequent writes just add data points
    metric_client.create_metric_descriptor(
        request={'name': project_name, 'metric_descriptor': descriptor}
    )
    print("  Created metric: custom.googleapis.com/index_pipeline/rows_loaded")
except Exception as e:
    if 'ALREADY_EXISTS' in str(e):
        print("  Metric already exists")
    else:
        print(f'  {e}')

# Write a data point
now = time.time()
interval = monitoring_v3.TimeInterval(
    {'end_time': {'seconds': int(now), 'nanos': int((now % 1) * 1e9)}})
point = monitoring_v3.Point({'interval': interval, 'value': {'int64_value': len(ohlcv_df)}})

series = monitoring_v3.TimeSeries()
series.metric.type = "custom.googleapis.com/index_pipeline/rows_loaded"
series.resource.type = "global"
series.points = [point]

# Write the data point — appears in Metrics Explorer within ~60 seconds
metric_client.create_time_series(request={'name': project_name, 'time_series': [series]})
print(f"  Wrote metric: rows_loaded = {len(ohlcv_df)}")

print("\n=== View in GCP Console ===")
print(f"  Logs:    https://console.cloud.google.com/logs?project={PROJECT_ID}")
print(f"  Metrics: https://console.cloud.google.com/monitoring/metrics-explorer?project={PROJECT_ID}")
```

    === Cloud Logging ===
      Wrote INFO log: pipeline_completed
      Wrote INFO log: scores_computed
    
    === Custom Metrics ===
      Created metric: custom.googleapis.com/index_pipeline/rows_loaded
      Wrote metric: rows_loaded = 306
    
    === View in GCP Console ===
      Logs:    https://console.cloud.google.com/logs?project=index-lab-2
      Metrics: https://console.cloud.google.com/monitoring/metrics-explorer?project=index-lab-2

## Summary

> [!abstract]- GCP Python Quick Reference
>
> | Service | Pattern | Description |
> |---|---|---|
> | **Auth** | `os.environ['GOOGLE_APPLICATION_CREDENTIALS']` | Service account key |
> | **Auth** | `Client(project=PROJECT_ID)` | All libraries use this |
> | **GCS** | `storage.Client()` | Create client |
> | **GCS** | `bucket.blob(path).upload_from_string(data)` | Upload |
> | **GCS** | `bucket.blob(path).download_as_text()` | Download |
> | **GCS** | `client.list_blobs(bucket, prefix=...)` | List objects |
> | **BigQuery** | `client.load_table_from_dataframe(df, table)` | Load DataFrame |
> | **BigQuery** | `client.query(sql)` | Run SQL query |
> | **BigQuery** | `job.result()` | Wait for completion |
> | **Pub/Sub** | `publisher.publish(topic, data, **attrs)` | Publish message |
> | **Pub/Sub** | `subscriber.pull(subscription, max_messages)` | Pull messages |
> | **Firestore** | `db.collection('name').document('id').set({})` | Write document |
> | **Firestore** | `db.collection('name').stream()` | Read all docs |
> | **Firestore** | `db.batch()` | Batch writes |
> | **Secrets** | `sm.access_secret_version(name)` | Read secret |
> | **Monitoring** | `logger.log_struct({...}, severity='INFO')` | Structured log |
>
> **C# equivalents:** `google-cloud-storage` → `Google.Cloud.Storage.V1` | `google-cloud-bigquery` → `Google.Cloud.BigQuery.V2` | `google-cloud-pubsub` → `Google.Cloud.PubSub.V1` | `google-cloud-firestore` → `Google.Cloud.Firestore` | `google-cloud-secret-mgr` → `Google.Cloud.SecretManager.V1`
