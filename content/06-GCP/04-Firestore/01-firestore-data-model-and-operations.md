---
title: "01 - Firestore Data Model and Operations"
tags:
  - gcp
  - firestore
  - nosql
aliases:
  - Firestore
  - Cloud Firestore
  - Datastore
  - NoSQL
  - document database
  - collection
  - subcollection
  - document reference
description: >
  Definitive reference for Cloud Firestore in data engineering pipelines. Covers
  Native mode vs Datastore mode, the document/collection/subcollection data
  model, full Python SDK CRUD and query patterns, real-time listeners, gcloud
  CLI operations, Terraform provisioning, and data engineering patterns including
  pipeline state stores, config-driven pipelines, event sourcing, and the
  Firestore vs BigQuery vs Bigtable decision matrix.
created: 2026-03-22
updated: 2026-04-12
status: complete
---

# Firestore — Data Model and Operations

> [!quote]
> "In a document database, you model your data around the questions you need to answer, not the relationships between entities."
>
> — **Rick Houlihan**, AWS NoSQL design lead

## Why Firestore for Data Engineering

Firestore's unbeatable value comes down to one thing no other GCP service does: **real-time push to clients with zero infrastructure.**

| Need                                       | Firestore                                                             | Alternative                       | Why Firestore Wins                         |
| ------------------------------------------ | --------------------------------------------------------------------- | --------------------------------- | ------------------------------------------ |
| Dashboard sees data the instant it changes | `on_snapshot()` — Firestore pushes to all connected clients in <100ms | Pub/Sub + custom WebSocket server | No server to build/deploy/scale. Zero ops. |
| Mobile/web app reads latest scores         | Direct client SDK (no backend needed)                                 | REST API → Cloud Run → BigQuery   | No backend, no cold starts, no query costs |
| Config change takes effect immediately     | Listener fires on update                                              | Redeploy, or poll a database      | No deploy cycle, no polling interval       |
| Offline-first mobile app                   | Built-in offline cache + sync                                         | Build your own sync layer         | Months of engineering vs. one line of code |

## What Is Firestore

Cloud Firestore is a fully managed, serverless, document-oriented NoSQL database hosted on GCP. It scales automatically from zero to planetary scale, requires no infrastructure provisioning, and supports real-time data synchronization to connected clients. Firestore is the recommended database for applications that need low-latency reads and writes, flexible schema evolution, and hierarchical data organization.

Firestore is distinct from traditional relational databases: there is no fixed schema, no SQL, and no joins across collections. Instead, data is organized into **documents** grouped into **collections**, with optional **subcollections** nested under documents.

> [!info] Prerequisites
>
> Enable `firestore.googleapis.com` before creating any database:
> ```bash
> gcloud services enable firestore.googleapis.com
> ```
> Required role to create and manage databases: `roles/datastore.owner` or `roles/firebase.admin`.

> [!tip] When to Use Firestore
>
> Firestore excels at pipeline state tracking, config stores, feature flags, audit logs, and any use case where you need real-time change propagation without managing infrastructure. For advanced Firestore query patterns, see [05-DB-Queries/Firestore](https://alp78.github.io/elysium/05-DB-Queries/03-Firestore/01-firestore-python). For analytics workloads, pair it with [BigQuery](https://alp78.github.io/elysium/06-GCP/03-BigQuery/03-querying-and-cost-optimization).

---

### Firestore | operating modes | Native vs Datastore

Firestore has two operating modes. The mode is chosen at database creation time and cannot be changed afterward.

| Dimension | Native Mode | Datastore Mode |
|---|---|---|
| Data model | Documents, collections, subcollections | Entities, kinds, namespaces |
| Real-time listeners | ✅ `on_snapshot` | ❌ |
| Offline support (mobile/web) | ✅ | ❌ |
| Transactions | ✅ cross-document | ✅ cross-entity |
| Strong consistency | ✅ all queries | ✅ |
| Multi-region | ✅ | ✅ |
| Python client library | `google-cloud-firestore` | `google-cloud-datastore` |
| Console UI | Firestore console | Datastore console |
| Best for | New projects, real-time, mobile/web backends | Legacy Datastore migrations |
| Collection group queries | ✅ | ❌ |
| Server-side aggregation | ✅ `count`, `sum`, `avg` | ❌ |

> [!warning] Mode selection cannot be changed after creation
>
> Once a Firestore database is created in Native mode or Datastore mode, it cannot be switched. Plan the mode choice before any data is written. For all new data engineering projects, prefer Native mode.

> [!success] Default to Native Mode
>
> Choose Native mode for all new projects. It is strictly a superset of Datastore mode: it adds real-time listeners, offline support, collection group queries, and server-side aggregations. There is no runtime cost difference. Decide before writing any data — you cannot change it later.

---

### Firestore | positioning | vs BigQuery vs Cloud SQL

| Dimension | Firestore | BigQuery | Cloud SQL |
|---|---|---|---|
| Primary workload | OLTP — real-time reads/writes | OLAP — analytical queries | OLTP — relational transactions |
| Latency | <10 ms | Seconds to minutes | <10 ms |
| Schema | Flexible (schemaless) | Fixed (typed columns) | Fixed (DDL schema) |
| Real-time updates | ✅ listeners | ❌ | ❌ |
| Joins | ❌ | ✅ SQL | ✅ SQL |
| Indexing | Auto per-field + composite | Partitioning + clustering | B-tree indexes |
| Max record size | 1 MB per document | No row limit per se | Row size depends on engine |
| Scaling model | Fully auto | Fully auto | Manual instance sizing |
| Cost driver | Per read/write/delete | Per bytes scanned | Per instance-hour |
| Best DE use case | Pipeline state, config, flags | Analytics, reporting | Transactional data with FK constraints |

See [dataset-and-table-management](https://alp78.github.io/elysium/06-GCP/03-BigQuery/01-dataset-and-table-management) for BigQuery table design patterns and [querying-and-cost-optimization](https://alp78.github.io/elysium/06-GCP/03-BigQuery/03-querying-and-cost-optimization) for BigQuery cost controls.

---

### Firestore | pricing | free tier and paid costs

Firestore pricing is operation-based, not instance-based. There is no cost when the database is idle.

#### Free tier (per day, per project)
- 50,000 document reads
- 20,000 document writes
- 20,000 document deletes
- 1 GiB stored data
- 10 GiB network egress per month

#### Paid pricing (beyond free tier, us-central1 approximate)
- Reads: $0.06 per 100,000 documents
- Writes: $0.18 per 100,000 documents
- Deletes: $0.02 per 100,000 documents
- Storage: $0.18 per GiB per month

> [!warning] Read billing counts per document, not per query
>
> Reads are charged per document returned, not per query.
> A query that returns 10,000 documents costs 10,000 read operations regardless of how many fields are projected. Design queries to be selective. Use `limit()` and filters aggressively.

> [!success] Limit and Filter Aggressively
>
> Always add `.limit()` to queries and use equality filters to narrow the result set before ordering. For dashboard-style reads, maintain a denormalized summary document per pipeline that is updated on each state transition — one document read instead of a collection scan.

---

## Data Model

Firestore organizes data as documents inside collections, with optional subcollections nested under documents. Understanding this hierarchy is a prerequisite for writing SDK code, queries, and indexes.

### Firestore | data model | documents, collections, subcollections

Firestore organizes data hierarchically. Each level in the tree is distinct — a collection holds only documents, a document holds only fields and optional subcollections.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {
  'primaryColor': '#292e42',
  'primaryTextColor': '#c0caf5',
  'primaryBorderColor': '#565f89',
  'lineColor': '#565f89',
  'secondaryColor': '#1a1b26',
  'tertiaryColor': '#24283b',
  'noteTextColor': '#c0caf5',
  'noteBkgColor': '#292e42',
  'textColor': '#c0caf5',
  'fontSize': '14px'
}}}%%
flowchart TD
    DB["🗄️ Firestore Database\n(main)"]
    C1["📁 Collection\n/stocks"]
    C2["📁 Collection\n/config"]
    C3["📁 Collection\n/pipeline_runs"]
    D1["📄 Document\n/stocks/ABI.BR"]
    D2["📄 Document\n/stocks/ASML.AS"]
    D3["📄 Document\n/config/pipeline"]
    D4["📄 Document\n/pipeline_runs/run_001"]
    SC["📁 Subcollection\n/stocks/ABI.BR/prices"]
    SD1["📄 Document\n/prices/2026-02-10"]
    SD2["📄 Document\n/prices/2026-02-11"]

    DB --> C1
    DB --> C2
    DB --> C3
    C1 --> D1
    C1 --> D2
    C2 --> D3
    C3 --> D4
    D1 --> SC
    SC --> SD1
    SC --> SD2
```

```text
/stocks                             ← collection
    /ABI.BR                         ← document
        short_name: "AB INBEV"
        country: "Belgium"
        current_price: 62.76
        /prices                     ← subcollection
            /2026-02-10             ← document
                open: 58.94
                close: 59.38
                volume: 1844169
```

- **Collection**: a container for documents. Collections cannot hold raw data — only documents.
- **Document**: a JSON-like object with named fields. Lives inside a collection.
- **Subcollection**: a collection nested under a document. Subcollections do not appear when the parent document is fetched — they must be queried explicitly.

A document path looks like: `projects/bq-wh-nb/databases/main/documents/stocks/ABI.BR`

In Python the path is addressed as:

*Reference a document and its subcollection using chained `.collection()` and `.document()` calls.*

```python
db.collection("stocks").document("ABI.BR")
db.collection("stocks").document("ABI.BR").collection("prices").document("2026-02-10")
```

---

### Firestore | document structure | field types and nested data

A Firestore document is a set of key-value pairs. Values can be any supported type, including nested maps and arrays.

```json
{
  "symbol": "ABI.BR",
  "short_name": "AB INBEV",
  "country": "Belgium",
  "sector": "Consumer Defensive",
  "index": "euro_stoxx_50",
  "index_weight": 0.0243,
  "current_price": 62.76,
  "scores": {
    "composite": 0.3852,
    "momentum": 0.5375,
    "value": 0.2506,
    "sentiment": 0.3676,
    "rank": 5
  },
  "tags": ["consumer_defensive", "belgium", "euro_stoxx_50"],
  "is_active": true,
  "score_date": "2026-03-12",
  "updated_at": "2026-04-05T13:08:33.114346Z"
}
```

#### Supported field types

| Type | Python representation | Notes |
|---|---|---|
| String | `str` | UTF-8, max 1,048,487 bytes |
| Integer | `int` | 64-bit signed |
| Float | `float` | IEEE 754 double |
| Boolean | `bool` | `True` / `False` |
| Timestamp | `datetime` (with tzinfo) | Server timestamps available |
| Bytes | `bytes` | Max 1,048,487 bytes |
| Reference | `DocumentReference` | Points to another doc |
| GeoPoint | `firestore.GeoPoint(lat, lon)` | Latitude/longitude pair |
| Array | `list` | Cannot contain another array |
| Map | `dict` | Nested key-value pairs |
| Null | `None` | Explicit null field |

> [!warning] Arrays cannot contain arrays
>
> Firestore arrays cannot nest other arrays directly. Use a list of maps instead when you need complex array elements.

> [!success] Use a List of Maps for Complex Elements
>
> Replace a nested array with a list of maps: `[{"key": "a", "value": 1}, {"key": "b", "value": 2}]`. Each map element can hold multiple fields and is fully queryable with `array_contains`.

---

### Firestore | document IDs | auto-generated vs custom

**Auto-generated IDs** are random, collision-resistant alphanumeric strings produced by calling `.document()` with no argument:

*Call `.document()` with no argument to receive a random, collision-resistant ID.*

```python
doc_ref = db.collection("events").document()  # e.g., "Xk2mN9pQr7..."
print(doc_ref.id)
```

**Custom IDs** are provided explicitly:

*Pass a string to `.document()` to set a known, human-readable ID.*

```python
doc_ref = db.collection("pipelines").document("daily-ingest")
```

> [!warning] Avoid Timestamp Document IDs
>
> Avoid timestamps as document IDs.
> Using timestamps or monotonically increasing integers as IDs creates a "hot spot" — all writes go to the same tablet shard. Firestore throttles hot spots. Use auto-generated IDs or hash-prefixed IDs for high-throughput write scenarios.

> [!success] Use Auto-Generated or Hash-Prefixed IDs
>
> Call `.document()` with no argument to get a random collision-resistant ID. For sequential data that must be queried by time, store the timestamp as a field and sort by it — keep the document ID random to avoid hot spots.

---

### Firestore | limits | document size and collection naming

- **Maximum document size**: 1 MiB (1,048,576 bytes). This includes field names, values, and all nested data.
- **Collection names**: must not start with `__`. Valid characters are letters, digits, hyphens, and underscores.
- **Document ID**: max 1,500 bytes. Cannot contain forward slashes.
- **Field names**: any valid UTF-8 string, but names containing special characters require backtick escaping in queries.

---

### Firestore | data modeling | subcollection nesting vs flat collections

#### Nest into a subcollection when
- The child data belongs to a single parent and is accessed via the parent.
- There are many child records per parent (e.g., pipeline run history under a pipeline document).
- You want to delete the parent without automatically removing children (subcollections are not deleted with parent documents — must be deleted manually).

#### Flatten to a top-level collection when
- You need to query across all instances of the child type regardless of parent.
- The data can be re-associated via a stored reference or ID field.

#### Pattern comparison

```text
# Nested — query runs for a specific pipeline
/pipelines/{pipeline_id}/runs/{run_id}

# Flat — query all failed runs across all pipelines
/pipeline_runs/{run_id}   with field pipeline_id: "daily-ingest"
```

Collection group queries (covered in the Querying section) allow querying nested subcollections across all parent documents, partially bridging the gap.

---

### Firestore | data modeling | patterns for data engineering

| Use Case | Recommended Structure |
|---|---|
| Pipeline run metadata | `/pipelines/{id}/runs/{run_id}` — subcollection per pipeline |
| Pipeline config | `/config/{pipeline_id}` — single document per pipeline, read at startup |
| Feature flags | `/feature_flags/{flag_name}` — simple key-value documents |
| Audit log | `/audit_log/{event_id}` — flat collection, auto-ID, immutable documents |
| Dead-letter queue | `/dlq/{message_id}` — flat collection, process and delete on retry |
| Pipeline registry | `/pipelines/{id}` — one document per registered pipeline |

---

## CRUD Operations (Python SDK)

The `google-cloud-firestore` Python client provides synchronous and asynchronous APIs for all document operations. Install it once per environment, then initialize a `Client` instance that persists for the lifetime of the process.

### Python | google-cloud-firestore | installation and client initialization

Install the client library and initialize a `firestore.Client` instance. The client uses Application Default Credentials (ADC) by default — set `GOOGLE_APPLICATION_CREDENTIALS` to a service account key file, or run `gcloud auth application-default login` for local development.

*Install the `google-cloud-firestore` Python package into the project environment.*

```bash
pip install google-cloud-firestore
```

*Initialize a Firestore client targeting the `bq-wh-nb` project and `main` named database.*

```python
from google.cloud import firestore

db = firestore.Client(project="bq-wh-nb")

# For a named database (the default name is "(default)")
db = firestore.Client(project="bq-wh-nb", database="main")
```

See [gcloud-authentication](https://alp78.github.io/elysium/06-GCP/01-Core/02-gcloud-authentication) for setting up Application Default Credentials (ADC) and [service-accounts-and-iam](https://alp78.github.io/elysium/06-GCP/08-Security/01-service-accounts-and-iam) for service account key management.

---

### Python | set() | create or overwrite a document

`set()` creates the document if it does not exist, or fully replaces it if it does.

*Create a pipeline run document in the `pipeline_runs` collection with `SERVER_TIMESTAMP`.*

```python
run_ref = db.collection("pipeline_runs").document("demo_run")

run_ref.set({
    "index": "euro_stoxx_50",
    "status": "idle",
    "started_at": firestore.SERVER_TIMESTAMP,
    "config": {"source": "yfinance", "tickers_count": 50},
    "tags": ["demo"],
})
```

```text
>>> run_ref.get().to_dict()
{
  "tags": ["demo"],
  "config": {"tickers_count": 50, "source": "yfinance"},
  "started_at": "2026-04-12T12:43:17.751000+00:00",
  "index": "euro_stoxx_50",
  "status": "idle"
}
```

**Merge instead of replace** — only update provided fields, leave others intact:

*Merge a single field into an existing document without overwriting other fields.*

```python
run_ref.set({"status": "running"}, merge=True)
```

#### Add a document with auto-generated ID

*Add an alert document with an auto-generated ID.*

```python
doc_ref = db.collection("alerts").add({
    "type": "PRICE_DROP",
    "message": "MC.PA triggered price drop alert",
    "threshold": -3.0,
    "actual": -3.42,
    "tags": ["euro_stoxx_50", "price_drop"],
    "created_at": firestore.SERVER_TIMESTAMP,
})
```

---

### Python | get() | read a document

*Read a single stock document by reference and check existence.*

```python
doc = db.collection("stocks").document("ABI.BR").get()

if doc.exists:
    data = doc.to_dict()
    print(f"{data['short_name']} | EUR {data['current_price']}")
else:
    print("Document not found")
```

```text
AB INBEV | EUR 62.76
```

#### Read multiple documents by reference

*Fetch multiple documents in a single round-trip using `get_all()`.*

```python
refs = [
    db.collection("stocks").document("ABI.BR"),
    db.collection("stocks").document("ASML.AS"),
]
docs = db.get_all(refs)
for doc in docs:
    print(doc.id, doc.to_dict()["short_name"])
```

```text
ABI.BR AB INBEV
ASML.AS ASML HOLDING
```

---

### Python | update() | partial document updates

`update()` merges changes into an existing document. Raises `NotFound` if the document does not exist.

*Merge new fields into an existing document — raises `NotFound` if the document does not exist.*

```python
run_ref = db.collection("pipeline_runs").document("demo_run")

run_ref.update({
    "status": "running",
    "rows_loaded": firestore.Increment(150),
    "tags": firestore.ArrayUnion(["validated"]),
})
```

```text
>>> run_ref.get().to_dict()
{
  "config": {"tickers_count": 50, "source": "yfinance"},
  "tags": ["demo", "validated"],
  "started_at": "2026-04-12T12:43:17.751000+00:00",
  "index": "euro_stoxx_50",
  "status": "running",
  "rows_loaded": 150
}
```

**Nested field update** using dot-notation — does not overwrite sibling fields:

*Update nested map fields using dot-notation without overwriting sibling keys.*

```python
run_ref.update({
    "config.lookback_days": 90,
    "config.source": "yfinance",
})
```

#### Atomic field transforms

*Atomically increment a counter, add array elements, and remove array elements.*

```python
run_ref.update({"rows_loaded": firestore.Increment(5000)})

run_ref.update({"tags": firestore.ArrayUnion(["validated"])})

run_ref.update({"tags": firestore.ArrayRemove(["demo"])})
```

---

### Python | delete() | remove documents and fields

*Delete an entire document, or remove a single field from an existing document.*

```python
db.collection("pipeline_runs").document("demo_run").delete()

db.collection("stocks").document("ABI.BR").update({
    "score_date": firestore.DELETE_FIELD
})
```

---

### Python | WriteBatch | atomic batch operations

A batch groups up to 500 operations (set, update, delete) into a single atomic commit. Either all succeed or all fail. No reads are allowed in a batch.

*Commit a batch of set, update, and set operations across three collections atomically.*

```python
batch = db.batch()

run_ref = db.collection("pipeline_runs").document()
batch.set(run_ref, {
    "index": "euro_stoxx_50",
    "status": "running",
    "started_at": firestore.SERVER_TIMESTAMP,
})

stock_ref = db.collection("stocks").document("ABI.BR")
batch.update(stock_ref, {
    "is_active": True,
    "updated_at": firestore.SERVER_TIMESTAMP,
})

alert_ref = db.collection("alerts").document()
batch.set(alert_ref, {
    "type": "PIPELINE_STARTED",
    "message": "euro_stoxx_50 pipeline run started",
    "run_id": run_ref.id,
    "created_at": firestore.SERVER_TIMESTAMP,
})

batch.commit()
```

> [!tip] Use transactions when writes depend on current document state
>
> Batch writes are atomic but do not read existing data. Use a transaction when you need to read a value and conditionally write based on it.

---

### Python | transaction | read-then-write atomicity

Use transactions when a write depends on the current value of a document — for example, incrementing a counter or enforcing a state machine transition. Firestore retries the transaction automatically if a concurrent write modifies any read document before the commit.

Transactions allow read-then-write atomicity across multiple documents. If a concurrent write modifies a document between the transaction's read and write, Firestore retries automatically (up to 5 times by default).

*Atomically read and increment the `stock_count` field on a sector document.*

```python
@firestore.transactional
def increment_stock_count(transaction, sector_ref):
    snapshot = sector_ref.get(transaction=transaction)
    current = snapshot.get("stock_count") or 0
    transaction.update(sector_ref, {"stock_count": current + 1})
    return current + 1

sector_ref = db.collection("sectors").document("Technology")
t = db.transaction()
new_count = increment_stock_count(t, sector_ref)
```

```text
>>> print(f"New stock_count: {new_count}")
New stock_count: 6
```

---

## Querying

Firestore queries are scoped to a single collection or collection group and run entirely server-side. All filters are applied before results are returned — Firestore never does a full table scan on the client side.

### Python | where() | simple collection queries

Filter a collection using `.where()` and chain `.order_by()` and `.limit()` for sorting and result-set control. Call `.stream()` to iterate over matching documents without loading all of them into memory at once.

*Filter the `stocks` collection by country and print matching documents.*

```python
query = db.collection("stocks").where("country", "==", "Belgium")
for doc in query.stream():
    data = doc.to_dict()
    print(f"{doc.id}: {data['short_name']} | EUR {data['current_price']}")
```

```text
ABI.BR: AB INBEV | EUR 62.76
```

*Filter with ordering and limit — retrieve the 5 cheapest French stocks.*

```python
from google.cloud.firestore_v1 import FieldFilter

query = (
    db.collection("stocks")
    .where(filter=FieldFilter("country", "==", "France"))
    .order_by("current_price", direction=firestore.Query.ASCENDING)
    .limit(5)
)
for doc in query.stream():
    data = doc.to_dict()
    print(f"{doc.id}: {data['short_name']} | EUR {data['current_price']}")
```

```text
DSY.PA: DASSAULT SYSTEMES | EUR 18.37
CS.PA: AXA | EUR 37.96
BN.PA: DANONE | EUR 69.24
TTE.PA: TOTALENERGIES | EUR 69.8
SGO.PA: SAINT GOBAIN | EUR 73.22
```

**Supported filter operators:** `==`, `!=`, `<`, `<=`, `>`, `>=`, `in`, `not-in`, `array_contains`, `array_contains_any`

*Filter using `in` and `array_contains` operators.*

```python
db.collection("stocks").where(
    filter=FieldFilter("sector", "in", ["Technology", "Financials"])
)

db.collection("stocks").where(
    filter=FieldFilter("tags", "array_contains", "euro_stoxx_50")
)
```

```text
>>> # sector in [Technology, Financials]
ADYEN.AS: ADYEN | Technology
ASML.AS: ASML HOLDING | Technology
DSY.PA: DASSAULT SYSTEMES | Technology
IFX.DE: INFINEON TECHNOLOGIES AG | Technology
SAP.DE: SAP SE | Technology
```

---

### Python | where() | compound filter queries

Multiple `where()` clauses are ANDed together:

*Chain multiple `where()` clauses to filter `pipeline_runs` by ID, status, and time range simultaneously.*

```python
query = (
    db.collection("pipeline_runs")
    .where("pipeline_id", "==", "daily-ingest")
    .where("status", "==", "failed")
    .where("started_at", ">=", datetime(2026, 3, 1, tzinfo=timezone.utc))
)
```

> [!warning] Single-Field Inequality Only
>
> Inequality filters on a single field only.
> Firestore only allows inequality filters (`<`, `<=`, `>`, `>=`, `!=`) on **one field per query**. Filtering on two different fields with inequalities requires a composite index and is not supported as a standard query — restructure your data model or use equality for one field.

> [!success] Use Equality for One Field, Inequality for the Other
>
> Convert one of the range conditions into an equality filter by bucketing the value (e.g., status `== "failed"` instead of `!= "success"`), or split into two queries and merge results in Python. Alternatively, denormalize a combined field (e.g., `pipeline_status_date`) to enable a single inequality query.

> [!info] Native OR Queries (added 2023)
>
> Firestore now supports native disjunctive queries via `Filter.or()`. Cross-field OR is supported with up to 30 disjunctions in disjunctive normal form. Combine with `Filter.and()` for complex compound filters.
>
> - `array_contains` is limited to one per disjunction group.
> - `not-in` cannot combine with `in`, `array_contains_any`, or `or` in the same query.
> - Range/inequality filters on multiple fields are supported (up to 10 fields per query).

*Query stocks that are in Technology OR have a composite score above 0.4 using `Filter.or()`.*

```python
from google.cloud.firestore_v1 import FieldFilter, Or

or_query = db.collection("stocks").where(
    filter=Or(filters=[
        FieldFilter("sector", "==", "Technology"),
        FieldFilter("scores.composite", ">", 0.4),
    ])
)
for doc in or_query.stream():
    data = doc.to_dict()
    print(f"{doc.id}: {data['short_name']} | {data['sector']}")
```

> [!tip] Legacy OR pattern still works for simple cases
>
> For same-field OR, the `in` operator remains the simplest approach: `.where("sector", "in", ["Technology", "Financials"])`. Use `Filter.or()` when you need OR across different fields or mixed operator types.

---

### Python | collection_group() | cross-subcollection queries

Query across all subcollections with the same name, regardless of parent:

*Query all `prices` subcollections across every stock, returning the highest closing prices.*

```python
prices_query = (
    db.collection_group("prices")
    .where(filter=FieldFilter("close", ">", 150.0))
    .order_by("close", direction=firestore.Query.DESCENDING)
    .limit(5)
)
for doc in prices_query.stream():
    stock_id = doc.reference.parent.parent.id
    data = doc.to_dict()
    print(f"{stock_id}/{doc.id}: close={data['close']} vol={data['volume']:,}")
```

```text
RMS.PA/2026-02-12: close=2174.0 vol=80,726
RMS.PA/2026-02-13: close=2147.0 vol=67,806
RMS.PA/2026-02-10: close=2124.0 vol=61,064
RMS.PA/2026-02-11: close=2120.0 vol=55,669
RMS.PA/2026-02-20: close=2112.0 vol=68,857
```

> [!tip] Collection group queries need a composite index created first
>
> Collection group queries require a composite index.
> Before running a collection group query with filters or ordering, create a collection group index via the Firestore console or `gcloud`. The console will provide the exact command when a query fails due to a missing index.

---

### gcloud firestore | indexes composite | create and manage indexes

Firestore auto-creates single-field indexes for every field. Queries with multiple `where()` or `order_by()` on different fields require a manually created composite index.

#### gcloud | Create a composite index

Create the index from the command line, or copy the exact command from the error message Firestore returns when a query fails due to a missing index.

*Create a 3-field composite index on `pipeline_runs` covering `pipeline_id`, `status`, and `started_at`.*

```bash
gcloud firestore indexes composite create \
  --collection-group=pipeline_runs \
  --field-config=field-path=pipeline_id,order=ASCENDING \
  --field-config=field-path=status,order=ASCENDING \
  --field-config=field-path=started_at,order=DESCENDING
```

```text
Create request issued for: [...]
Waiting for operation [...] to complete...done.
Created index [...].
```

#### gcloud | List composite indexes

*List all composite indexes for the project to confirm READY state before running compound queries.*

```bash
gcloud firestore indexes composite list
```

```text
+--------------+------------------+------------------+-------+-----------+---------------+------------+
|     NAME     | COLLECTION_GROUP |   QUERY_SCOPE    | STATE |  FIELD_PATHS  |   ORDER    |
+--------------+------------------+------------------+-------+-----------+---------------+------------+
| CICAgJim14AK | prices           | COLLECTION_GROUP | READY | date          | ASCENDING  |
|              |                  |                  |       | close         | DESCENDING |
| CICAgOjXh4EK | stocks           | COLLECTION       | READY | country       | ASCENDING  |
|              |                  |                  |       | current_price | ASCENDING  |
+--------------+------------------+------------------+-------+-----------+---------------+------------+
```

---

### Python | start_after() | cursor-based pagination

Use `start_after()` with the last document from the previous page:

*Paginate through the `stocks` collection using `start_after()` with the last document as cursor.*

```python
def get_page(page_size=3, cursor_doc=None):
    query = db.collection("stocks").order_by("symbol").limit(page_size)
    if cursor_doc:
        query = query.start_after(cursor_doc)
    docs = list(query.stream())
    return docs, (docs[-1] if docs else None)

page1, cursor = get_page(page_size=3)
page2, _ = get_page(page_size=3, cursor_doc=cursor)
```

```text
>>> # Page 1
ABI.BR: AB INBEV
AD.AS: KONINKLIJKE AHOLD DELHAIZE N.V.
ADS.DE: adidas AG
>>> # Page 2 (start_after last doc of page 1)
ADYEN.AS: ADYEN
AI.PA: AIR LIQUIDE
AIR.PA: AIRBUS SE
```

---

### Python | count() sum() avg() | server-side aggregations

Avoid fetching all documents just to count them:

*Count documents, sum a numeric field, and compute an average — each billed as a single read.*

```python
count_result = db.collection("stocks").count().get()
total_stocks = count_result[0][0].value

sum_result = db.collection("sectors").sum("stock_count").get()
total_across_sectors = sum_result[0][0].value

avg_result = db.collection("sectors").avg("avg_score").get()
global_avg_score = avg_result[0][0].value
```

```text
>>> print(f"Total stocks: {total_stocks}")
Total stocks: 50
>>> print(f"Sum of sector stock_counts: {int(total_across_sectors)}")
Sum of sector stock_counts: 50
>>> print(f"Global avg sector score: {round(global_avg_score, 4)}")
Global avg sector score: 0.0715
```

> [!tip] count() sum() avg() are billed as a single read regardless of documents scanned
>
> A `count()`, `sum()`, or `avg()` aggregation query is billed as one read operation, regardless of the number of documents it scans. This makes aggregations significantly cheaper than fetching all documents.

---

## Real-Time Listeners

Firestore pushes document and query changes to connected clients in real time using `on_snapshot()`. Listeners operate on individual documents or filtered collection queries and fire immediately with the current snapshot, then once per change thereafter.

### Python | on_snapshot() | document change listener

Register a callback with `.on_snapshot()` on a `DocumentReference`. The callback fires immediately with the current state, then once each time the document is modified. The returned `unsubscribe` callable stops the listener.

*Register a document-level listener that fires on every change to a pipeline run document.*

```python
def on_pipeline_change(doc_snapshot, changes, read_time):
    for doc in doc_snapshot:
        print(f"Pipeline {doc.id} updated: {doc.to_dict()}")

pipeline_ref = db.collection("pipelines").document("daily-ingest")
unsubscribe = pipeline_ref.on_snapshot(on_pipeline_change)

# Stop listening
unsubscribe()
```

### Python | on_snapshot() | collection query watcher

Attach `.on_snapshot()` to a query to watch all documents matching its filters. The `changes` list provides typed events (`ADDED`, `MODIFIED`, `REMOVED`) so the callback can react to specific change types rather than processing the full snapshot.

*Watch a filtered query and handle ADDED, MODIFIED, and REMOVED change events.*

```python
def on_collection_change(col_snapshot, changes, read_time):
    for change in changes:
        if change.type.name == "ADDED":
            print(f"New document: {change.document.id}")
        elif change.type.name == "MODIFIED":
            print(f"Modified: {change.document.id}")
        elif change.type.name == "REMOVED":
            print(f"Removed: {change.document.id}")

query = db.collection("pipeline_runs").where("status", "==", "failed")
unsubscribe = query.on_snapshot(on_collection_change)
```

---

### Firestore | real-time patterns | data engineering use cases

**Pipeline status dashboard**
Write pipeline run state (start, progress, completion) to Firestore documents. A frontend or monitoring tool subscribes with `on_snapshot()` and reflects status changes without polling.

*Write pipeline run lifecycle state to a `pipeline_runs` document so dashboards can react via `on_snapshot()`.*

```python
# Pipeline writes its own status
run_ref = db.collection("pipeline_runs").document(run_id)
run_ref.set({"status": "running", "progress_pct": 0, "started_at": firestore.SERVER_TIMESTAMP})

# Mid-run progress update
run_ref.update({"progress_pct": 45, "rows_processed": firestore.Increment(50000)})

# Completion
run_ref.update({"status": "complete", "progress_pct": 100, "completed_at": firestore.SERVER_TIMESTAMP})
```

**Config-driven pipelines**
Store runtime configuration in a Firestore document. A pipeline listener detects changes and updates its behavior without restarting.

*Listen to a `config` document and apply updated settings to a running pipeline without restart.*

```python
config_ref = db.collection("config").document("daily-ingest")

def apply_config(doc_snapshot, changes, read_time):
    for doc in doc_snapshot:
        cfg = doc.to_dict()
        update_pipeline_settings(
            batch_size=cfg.get("batch_size", 5000),
            enabled=cfg.get("enabled", True),
        )

unsubscribe = config_ref.on_snapshot(apply_config)
```

**Feature flags**
Toggle pipeline behavior without redeployment. Store flags as boolean fields in a document.

*Read a feature flag document at pipeline startup to branch between logic versions.*

```python
flags_ref = db.collection("feature_flags").document("pipeline-v2")
flags = flags_ref.get().to_dict()

if flags.get("use_new_dedup_logic", False):
    run_new_dedup()
else:
    run_legacy_dedup()
```

**Event-driven triggers via Cloud Functions**
A Firestore trigger fires a [Cloud Function](https://alp78.github.io/elysium/06-GCP/06-Serverless/03-cloud-run-jobs-vs-services) whenever a document is created or updated. Useful for fan-out patterns: a pipeline writes a "job request" document; a Cloud Function picks it up and triggers downstream processing.

A Cloud Function triggered by Firestore document creation can be deployed via Firebase Functions or Cloud Functions 2nd gen using a `functions_framework` handler.

*Handle a Firestore document-creation event in a Cloud Function 2nd gen using `functions_framework`.*

```python
@functions_framework.cloud_event
def on_job_request(cloud_event):
    data = cloud_event.data
    document_path = data["value"]["name"]
    fields = data["value"]["fields"]
    # trigger downstream pipeline...
```

---

## gcloud CLI Operations

The `gcloud firestore` command group manages databases, indexes, and data exports. Requires `firestore.googleapis.com` to be enabled on the project (`gcloud services enable firestore.googleapis.com`).

### gcloud firestore | databases | create, list, describe, update

Create and inspect Firestore databases. A project can have multiple named databases alongside the `(default)` database — useful for environment isolation (dev/staging/prod) or per-tenant separation. Required role: `roles/datastore.owner` or `roles/firebase.admin`.

#### gcloud firestore databases create — create the default database

Creates a Firestore database in Native mode in the specified region. Must be run before any SDK access. The `--location` flag is required and cannot be changed after creation.

*Create the default Firestore database in `us-central1`.*

```bash
gcloud firestore databases create --location=us-central1
```

```text
Create request issued for: [(default)]
Waiting for operation [projects/bq-wh-nb/operations/...] to complete...done.
Created database [(default)].
```

#### gcloud firestore databases create — create a named database

Creates a named non-default database. Multiple named databases can coexist in one project. Use `--type=firestore-native` to explicitly enforce Native mode (the default).

*Create the `main` named database in `europe-west1` with Native mode explicitly set.*

```bash
gcloud firestore databases create \
  --database=main \
  --location=europe-west1 \
  --type=firestore-native
```

```text
Create request issued for: [main]
Waiting for operation [projects/bq-wh-nb/operations/...] to complete...done.
Created database [main].
```

#### gcloud firestore databases list — list all databases

Lists all Firestore databases in the current project, including the `(default)` database.

*List all Firestore databases in the current project to verify name, location, and protection state.*

```bash
gcloud firestore databases list
```

```text
NAME    LOCATION_ID   TYPE               DELETE_PROTECTION_STATE
main    europe-west1  FIRESTORE_NATIVE   DELETE_PROTECTION_DISABLED
```

| Column | Meaning |
|---|---|
| NAME | Database identifier. `(default)` for the default database; custom name for named databases. |
| LOCATION_ID | GCP region where the database is hosted. Cannot be changed after creation. |
| TYPE | `FIRESTORE_NATIVE` (document model) or `DATASTORE_MODE` (entity/kind model). |
| DELETE_PROTECTION_STATE | `DELETE_PROTECTION_DISABLED` allows deletion; `DELETE_PROTECTION_ENABLED` prevents accidental `gcloud firestore databases delete`. |

The `bq-wh-nb` project has a single named database `main` in `europe-west1` with Native mode and no deletion protection.

#### gcloud firestore databases describe — inspect a database

Returns full configuration for a named database including PITR status, concurrency mode, and version retention period.

*Inspect the full configuration of the `main` database, including PITR state and concurrency mode.*

```bash
gcloud firestore databases describe --database=main
```

```text
appEngineIntegrationMode: DISABLED
concurrencyMode: PESSIMISTIC
createTime: '2026-04-05T07:38:52.956876Z'
databaseEdition: STANDARD
deleteProtectionState: DELETE_PROTECTION_DISABLED
earliestVersionTime: '2026-04-12T11:42:08.056276Z'
locationId: europe-west1
name: projects/bq-wh-nb/databases/main
pointInTimeRecoveryEnablement: POINT_IN_TIME_RECOVERY_DISABLED
realtimeUpdatesMode: REALTIME_UPDATES_MODE_ENABLED
type: FIRESTORE_NATIVE
uid: e3538990-2117-436b-9026-aadd63e1096a
versionRetentionPeriod: 3600s
```

The output shows `main` is a standard-edition Native mode database created on 2026-04-05. PITR is disabled (`POINT_IN_TIME_RECOVERY_DISABLED`) — enable it with `--enable-pitr` for 7-day restore capability. The `versionRetentionPeriod` of 3600s (1 hour) is the default for databases without PITR; enabling PITR extends this to 7 days. `concurrencyMode: PESSIMISTIC` means transactions acquire locks before writing — appropriate for pipeline state stores where write conflicts are infrequent.

#### gcloud firestore databases update — enable Point-in-Time Recovery

Enables PITR on an existing database. PITR allows restoring the database to any point within the last 7 days.

*Enable Point-in-Time Recovery on the `main` database to allow 7-day restore capability.*

```bash
gcloud firestore databases update \
  --database=main \
  --enable-pitr
```

```text
Updated database [main].
```

| Flag | Syntax | Description |
|---|---|---|
| `--location` | `--location=us-central1` | Region for the new database. Cannot be changed after creation. |
| `--database` | `--database=NAME` | Name of the database. Omit for the `(default)` database. |
| `--type` | `--type=firestore-native` | Database type: `firestore-native` (default) or `datastore-mode`. |
| `--enable-pitr` | `--enable-pitr` | Enables Point-in-Time Recovery (7-day restore window). |
| `--delete-protection` | `--delete-protection` | Prevents accidental database deletion. |

---

### gcloud firestore | indexes composite | create, list, delete

Firestore auto-indexes every field in every document. Composite indexes — covering multiple fields — must be created manually before compound queries or collection group queries can run. The Firestore console provides the exact `gcloud` command when a query fails due to a missing index.

#### gcloud firestore indexes composite create — create a composite index

Creates an index on a collection for compound queries combining `where()` on one field with `order_by()` on another.

*Create a composite index on `pipeline_runs` to support filtering by `pipeline_id` ordered by `started_at`.*

```bash
gcloud firestore indexes composite create \
  --collection-group=pipeline_runs \
  --field-config=field-path=pipeline_id,order=ASCENDING \
  --field-config=field-path=started_at,order=DESCENDING
```

```text
Create request issued for: [projects/bq-wh-nb/databases/(default)/collectionGroups/pipeline_runs/indexes/...]
Waiting for operation [...] to complete...done.
Created index [...].
```

#### gcloud firestore indexes composite create — create a collection group index

Creates a composite index scoped to all subcollections with the same name, enabling `db.collection_group()` queries across parent documents.

*Create a COLLECTION_GROUP index on all `runs` subcollections to enable cross-pipeline status queries.*

```bash
gcloud firestore indexes composite create \
  --collection-group=runs \
  --query-scope=COLLECTION_GROUP \
  --field-config=field-path=status,order=ASCENDING \
  --field-config=field-path=started_at,order=DESCENDING
```

```text
Create request issued for: [...]
Waiting for operation [...] to complete...done.
Created index [...].
```

#### gcloud firestore indexes composite list — list all composite indexes

Lists all manually created composite indexes with their IDs, collection groups, scopes, and current states.

*List all composite indexes in the project to verify ready state and field configurations.*

```bash
gcloud firestore indexes composite list
```

```text
+--------------+------------------+------------------+-------+-----------+---------------+------------+
|     NAME     | COLLECTION_GROUP |   QUERY_SCOPE    | STATE |  FIELD_PATHS  |   ORDER    |
+--------------+------------------+------------------+-------+-----------+---------------+------------+
| CICAgJim14AK | prices           | COLLECTION_GROUP | READY | date          | ASCENDING  |
|              |                  |                  |       | close         | DESCENDING |
| CICAgOjXh4EK | stocks           | COLLECTION       | READY | country       | ASCENDING  |
|              |                  |                  |       | current_price | ASCENDING  |
+--------------+------------------+------------------+-------+-----------+---------------+------------+
```

#### gcloud firestore indexes composite delete — delete a composite index

Deletes a composite index by ID. Retrieve the ID from `gcloud firestore indexes composite list`.

*Delete a composite index by its ID, removing the query requirement it supported.*

```bash
gcloud firestore indexes composite delete INDEX_ID
```

```text
Deleted index [INDEX_ID].
```

| Flag | Syntax | Description |
|---|---|---|
| `--collection-group` | `--collection-group=NAME` | Collection name the index applies to. |
| `--query-scope` | `--query-scope=COLLECTION_GROUP` | Scope: `COLLECTION` (default) or `COLLECTION_GROUP` for subcollection queries. |
| `--field-config` | `--field-config=field-path=F,order=ASC` | Field and sort order. Repeat for each field. |
| `--database` | `--database=NAME` | Target database. Omit for `(default)`. |

---

### gcloud firestore | export / import | backup and restore

Exports write a full or partial snapshot of the database to a GCS bucket. Imports restore from a prior export. The Firestore service account must have `storage.objects.create` on the destination bucket. See [gcs-buckets-and-lifecycle](https://alp78.github.io/elysium/06-GCP/05-Storage/01-gcs-buckets-and-lifecycle) for bucket setup and [gcs-object-operations](https://alp78.github.io/elysium/06-GCP/05-Storage/02-gcs-object-operations) for managing backup files.

#### gcloud firestore export — export entire database

Exports all collections to a GCS path. The operation runs asynchronously as a managed long-running operation.

*Export all collections to a GCS path as a managed long-running operation.*

```bash
gcloud firestore export gs://bq-wh-nb-backups/firestore/2026-03-22
```

```text
Waiting for operation [projects/bq-wh-nb/operations/...] to complete...done.
metadata:
  outputUriPrefix: gs://bq-wh-nb-backups/firestore/2026-03-22
  operationState: SUCCESSFUL
```

#### gcloud firestore export — export specific collections

Exports only the listed collection IDs. Useful for partial backups of operational collections without including large historical data.

*Export only operational collections to a partial backup path, excluding large historical data.*

```bash
gcloud firestore export gs://bq-wh-nb-backups/firestore/partial \
  --collection-ids=pipelines,pipeline_runs,config
```

```text
Waiting for operation [...] to complete...done.
metadata:
  outputUriPrefix: gs://bq-wh-nb-backups/firestore/partial
  operationState: SUCCESSFUL
```

#### gcloud firestore import — restore from a full export

Imports all collections from a prior export. Import does not delete existing documents — it upserts into the target database.

*Restore all collections from a full export, upserting into the target database.*

```bash
gcloud firestore import gs://bq-wh-nb-backups/firestore/2026-03-22
```

```text
Waiting for operation [...] to complete...done.
metadata:
  operationState: SUCCESSFUL
```

#### gcloud firestore import — restore specific collections

Imports only the listed collection IDs from a prior export. Use this to restore a single operational collection without overwriting others.

*Restore only the `config` collection from a prior export without touching other collections.*

```bash
gcloud firestore import gs://bq-wh-nb-backups/firestore/2026-03-22 \
  --collection-ids=config
```

```text
Waiting for operation [...] to complete...done.
metadata:
  operationState: SUCCESSFUL
```

| Flag | Syntax | Description |
|---|---|---|
| `--collection-ids` | `--collection-ids=A,B` | Comma-separated collection IDs to export/import. Omit for all collections. |
| `--database` | `--database=NAME` | Source or target database. Omit for `(default)`. |
| `--async` | `--async` | Return immediately without waiting for the operation to complete. |

> [!tip] Automate exports with Cloud Scheduler and Cloud Run Jobs
>
> Automate Firestore backups by triggering `gcloud firestore export` from a [Cloud Run Job](https://alp78.github.io/elysium/06-GCP/06-Serverless/03-cloud-run-jobs-vs-services) on a schedule, or use the Firestore managed export via the console. Store exports in a lifecycle-managed GCS bucket to control retention costs.

> [!info] Managed backups are now available as an alternative
>
> Firestore also offers managed backup schedules (daily or weekly) with up to 14-week retention, stored and managed by Google without requiring a GCS bucket. See [managed backups](#firestore--managed-backups--scheduled-backup-and-restore) in the Performance and Limits section for configuration commands and a feature comparison table.

---

## Firestore Security Rules

Security rules apply to **client-side SDK access** (web and mobile apps). When accessing Firestore from a **server-side Python SDK using a service account**, security rules are bypassed — the service account's IAM role governs access instead.

### Firestore | IAM | server-side access control

For server-side pipelines using the `google-cloud-firestore` Python client, access is controlled exclusively by IAM roles bound to the service account. Security rules have no effect.

#### Required IAM roles for server-side access

| Role | Access level |
|---|---|
| `roles/datastore.user` | Read and write documents |
| `roles/datastore.viewer` | Read-only |
| `roles/datastore.owner` | Full control including index management |
| `roles/datastore.importExportAdmin` | Export/import only |

Grant a service account Firestore read/write access at the project level:

*Bind `roles/datastore.user` to a pipeline service account to grant Firestore read/write access.*

```bash
gcloud projects add-iam-policy-binding bq-wh-nb \
  --member="serviceAccount:pipeline-sa@bq-wh-nb.iam.gserviceaccount.com" \
  --role="roles/datastore.user"
```

See [service-accounts-and-iam](https://alp78.github.io/elysium/06-GCP/08-Security/01-service-accounts-and-iam) for service account creation and key management.

### Firestore | Security Rules | client-side access control

Security rules govern which documents a web or mobile client can read or write. They are evaluated by the Firestore service before any client SDK request is fulfilled, and are expressed in a rules DSL. The following example is shown for reference only — for data engineering pipelines, use IAM roles (see above).

#### Basic rules for a web app exposing Firestore (for reference)

*Define client-side security rules: public read for feature flags, user-scoped read/write, deny all else.*

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Public read, authenticated write
    match /feature_flags/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Authenticated users can only read their own data
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth.uid == userId;
    }

    // Deny everything else
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

> [!warning] Rules Skip Server-Side Access
>
> Security rules do not apply to Admin SDK or service accounts.
> Rules only affect client-side Firebase/Firestore SDKs. All server-side Python (`google-cloud-firestore`) access is governed purely by IAM. Never assume rules protect server-side pipeline data access.

> [!success] Use IAM Roles for Server-Side Access Control
>
> Grant `roles/datastore.user` for read/write and `roles/datastore.viewer` for read-only to the pipeline's service account. Apply IAM at the project level for broad access, or use per-database IAM conditions for fine-grained control. See [service-accounts-and-iam](https://alp78.github.io/elysium/06-GCP/08-Security/01-service-accounts-and-iam) for binding commands.

---

## Terraform Provisioning

The examples below show the core Terraform resources for provisioning Firestore infrastructure. For a complete IaC reference including module patterns and state management, see [07-Terraform/GCP](https://alp78.github.io/elysium/07-Terraform/04-GCP/terraform-gcp-resources).

### Terraform | google_firestore_database | provision a database

Provision a Native mode Firestore database with PITR enabled. The `name` field sets the database ID — use `"(default)"` for the default database.

*Provision a Native-mode Firestore database with PITR enabled using `google_firestore_database`.*

```hcl
resource "google_firestore_database" "pipeline_state" {
  project     = var.project_id
  name        = "pipeline-state"
  location_id = "us-central1"
  type        = "FIRESTORE_NATIVE"

  # Enable point-in-time recovery (PITR)
  point_in_time_recovery_enablement = "POINT_IN_TIME_RECOVERY_ENABLED"

  # Deletion protection
  deletion_policy = "DELETE"
}
```

### Terraform | google_firestore_index | composite index as code

Version-control composite indexes as code. This eliminates the manual `gcloud firestore indexes composite create` step that breaks deployments in new environments.

*Declare a composite index on `pipeline_runs` as Terraform code to version-control it alongside pipeline infrastructure.*

```hcl
resource "google_firestore_index" "runs_by_status_and_time" {
  project    = var.project_id
  database   = google_firestore_database.pipeline_state.name
  collection = "pipeline_runs"

  fields {
    field_path = "pipeline_id"
    order      = "ASCENDING"
  }

  fields {
    field_path = "status"
    order      = "ASCENDING"
  }

  fields {
    field_path = "started_at"
    order      = "DESCENDING"
  }
}
```

### Terraform | google_firestore_document | seed initial config data

Seed an initial configuration document at apply time. Useful for bootstrapping pipeline config in new environments. Field values must use Firestore's typed value syntax (`integerValue`, `stringValue`, `booleanValue`).

*Seed an initial `config/daily-ingest` document at `terraform apply` time using `google_firestore_document`.*

```hcl
resource "google_firestore_document" "pipeline_config" {
  project     = var.project_id
  database    = google_firestore_database.pipeline_state.name
  collection  = "config"
  document_id = "daily-ingest"

  fields = jsonencode({
    batch_size    = { integerValue = "5000" }
    enabled       = { booleanValue = true }
    source_bucket = { stringValue = "raw-data-bucket" }
    retry_count   = { integerValue = "3" }
  })
}
```

> [!tip] Terraform Manages Index State
>
> Terraform manages index state.
> Use `google_firestore_index` resources to version-control indexes alongside your pipeline code. Avoids the manual index creation step that often breaks deployments in new environments.

---

## Data Engineering Patterns with Firestore

These patterns apply Firestore's document model to common data engineering problems: pipeline state tracking, runtime configuration, audit logging, and real-time data ingestion. All patterns below use the `google-cloud-firestore` Python SDK against a Native mode database.

### Pattern | pipeline state store | track run lifecycle

Track every pipeline run's metadata, status, and statistics. Query for recent failures, calculate SLAs, and surface run history to dashboards.

*Record pipeline lifecycle events (start, complete, fail) to a subcollection with `collection_group` query for recent failures.*

```python
import uuid
from datetime import datetime, timezone
from google.cloud import firestore

db = firestore.Client()

def record_pipeline_start(pipeline_id: str) -> str:
    run_id = str(uuid.uuid4())
    run_ref = (
        db.collection("pipelines")
        .document(pipeline_id)
        .collection("runs")
        .document(run_id)
    )
    run_ref.set({
        "run_id": run_id,
        "pipeline_id": pipeline_id,
        "status": "running",
        "started_at": firestore.SERVER_TIMESTAMP,
        "rows_read": 0,
        "rows_written": 0,
        "errors": [],
    })
    # Update parent pipeline document
    db.collection("pipelines").document(pipeline_id).set(
        {"status": "running", "last_run_id": run_id, "last_run_started": firestore.SERVER_TIMESTAMP},
        merge=True,
    )
    return run_id


def record_pipeline_complete(pipeline_id: str, run_id: str, rows_read: int, rows_written: int):
    run_ref = (
        db.collection("pipelines")
        .document(pipeline_id)
        .collection("runs")
        .document(run_id)
    )
    run_ref.update({
        "status": "complete",
        "completed_at": firestore.SERVER_TIMESTAMP,
        "rows_read": rows_read,
        "rows_written": rows_written,
    })
    db.collection("pipelines").document(pipeline_id).update({
        "status": "idle",
        "last_run_status": "complete",
    })


def record_pipeline_failure(pipeline_id: str, run_id: str, error: Exception):
    run_ref = (
        db.collection("pipelines")
        .document(pipeline_id)
        .collection("runs")
        .document(run_id)
    )
    run_ref.update({
        "status": "failed",
        "failed_at": firestore.SERVER_TIMESTAMP,
        "error_message": str(error),
        "error_type": type(error).__name__,
    })
    db.collection("pipelines").document(pipeline_id).update({
        "status": "idle",
        "last_run_status": "failed",
    })


# Query recent failures across all pipelines
def get_recent_failures(limit: int = 20):
    return list(
        db.collection_group("runs")
        .where("status", "==", "failed")
        .order_by("failed_at", direction=firestore.Query.DESCENDING)
        .limit(limit)
        .stream()
    )
```

---

### Pattern | config-driven pipelines | runtime config from Firestore

Store pipeline configuration in Firestore and read it at runtime. Update configuration without touching code or redeploying.

#### Config document structure (`/config/daily-ingest`)

```json
{
  "enabled": true,
  "batch_size": 5000,
  "source_bucket": "raw-data-bucket",
  "destination_dataset": "analytics_prod",
  "retry_count": 3,
  "alert_on_failure": true,
  "max_rows_per_run": 1000000
}
```

#### Python — read config at pipeline start

*Read a `config` document at pipeline startup and exit early if the pipeline is disabled.*

```python
def load_pipeline_config(pipeline_id: str) -> dict:
    doc = db.collection("config").document(pipeline_id).get()
    if not doc.exists:
        raise ValueError(f"No config found for pipeline: {pipeline_id}")
    cfg = doc.to_dict()
    if not cfg.get("enabled", True):
        raise SystemExit(f"Pipeline {pipeline_id} is disabled via config")
    return cfg


def run_pipeline(pipeline_id: str):
    cfg = load_pipeline_config(pipeline_id)
    run_id = record_pipeline_start(pipeline_id)
    try:
        process_data(
            source=cfg["source_bucket"],
            destination=cfg["destination_dataset"],
            batch_size=cfg["batch_size"],
            max_rows=cfg.get("max_rows_per_run", 500000),
        )
        record_pipeline_complete(pipeline_id, run_id, rows_read=..., rows_written=...)
    except Exception as e:
        record_pipeline_failure(pipeline_id, run_id, e)
        raise
```

---

### Pattern | event sourcing | immutable audit log

Write an immutable event document for every significant pipeline action. This creates a queryable audit trail for debugging and compliance.

*Append audit events to a flat `audit_log` collection with auto-generated IDs for high-throughput immutable writes.*

```python
def write_audit_event(event_type: str, pipeline_id: str, run_id: str = None, metadata: dict = None):
    event = {
        "event_type": event_type,
        "pipeline_id": pipeline_id,
        "run_id": run_id,
        "timestamp": firestore.SERVER_TIMESTAMP,
        **(metadata or {}),
    }
    # Flat collection with auto-ID for high-throughput writes
    db.collection("audit_log").add(event)


# Usage throughout the pipeline
write_audit_event("pipeline_started", "daily-ingest", run_id)
write_audit_event("schema_validated", "daily-ingest", run_id, {"schema_version": "v3"})
write_audit_event("rows_loaded", "daily-ingest", run_id, {"rows": 119850, "destination": "analytics_prod.raw_events"})
write_audit_event("pipeline_completed", "daily-ingest", run_id)
```

#### Query audit history for a pipeline run

*Query the `audit_log` collection for all events matching a specific pipeline run, ordered by timestamp.*

```python
def get_run_events(pipeline_id: str, run_id: str):
    return list(
        db.collection("audit_log")
        .where("pipeline_id", "==", pipeline_id)
        .where("run_id", "==", run_id)
        .order_by("timestamp")
        .stream()
    )
```

---

### Pattern | real-time ingestion | micro-batch writes and BigQuery export

Write streaming or micro-batch data to Firestore for applications that need low-latency access to fresh records. Combine with [BigQuery](https://alp78.github.io/elysium/06-GCP/03-BigQuery/03-querying-and-cost-optimization) for historical analytics via periodic export.

#### Write micro-batches to Firestore

*Write a large list of events to Firestore in chunks of 500 using batched writes.*

```python
def write_events_batch(events: list[dict]):
    # Use batched writes — up to 500 per commit
    for i in range(0, len(events), 500):
        batch = db.batch()
        for event in events[i:i+500]:
            doc_ref = db.collection("live_events").document()
            batch.set(doc_ref, {
                **event,
                "ingested_at": firestore.SERVER_TIMESTAMP,
            })
        batch.commit()
```

#### Export hot data to BigQuery for analytics
Run a [Cloud Run Job](https://alp78.github.io/elysium/06-GCP/06-Serverless/03-cloud-run-jobs-vs-services) on a schedule that queries recent Firestore documents and streams them to BigQuery via the BigQuery Storage Write API. See [data-loading-and-export](https://alp78.github.io/elysium/06-GCP/03-BigQuery/02-data-loading-and-export) for BigQuery ingestion patterns.

*Query recent `live_events` documents and stream them to a BigQuery table via `insert_rows_json`.*

```python
from google.cloud import bigquery

def export_recent_events_to_bigquery(hours_back: int = 1):
    cutoff = datetime.now(tz=timezone.utc) - timedelta(hours=hours_back)
    events = (
        db.collection("live_events")
        .where("ingested_at", ">=", cutoff)
        .stream()
    )
    rows = [doc.to_dict() for doc in events]

    bq = bigquery.Client()
    table_ref = bq.dataset("analytics_prod").table("raw_events")
    errors = bq.insert_rows_json(table_ref, rows)
    if errors:
        raise RuntimeError(f"BigQuery insert errors: {errors}")
```

---

## Performance and Limits

Firestore scales automatically but enforces hard limits that affect high-throughput pipeline design. The two most impactful issues at scale are hot spots (sequential document IDs saturating a single shard) and index explosion (large maps multiplying write costs).

### Firestore | limits | throughput and size constraints

| Limit | Value | Notes |
|---|---|---|
| Writes per second (database) | 10,000 | Soft limit; can be increased via quota request |
| Reads per second (database) | 1,000,000 | Effectively unlimited at most scales |
| Documents per batch write | 500 | Hard limit |
| Transaction size | 500 operations | Hard limit |
| Document size | 1 MiB | Hard limit |
| Field name length | 1,500 bytes | Hard limit |
| Nested depth (maps/arrays) | 20 levels | Hard limit |
| Collections per database | Unlimited | |
| Subcollection depth | 100 levels | Hard limit |

---

### Firestore | performance | hot spot avoidance

Firestore splits data across shards based on document ID lexicographic order. If many writes target adjacent document IDs (e.g., timestamps like `2026-03-22T00:00:01`, `2026-03-22T00:00:02`, ...), all writes hit the same shard and Firestore throttles.

#### Avoid

Using timestamps or monotonically increasing integers as document IDs concentrates writes on a single shard.

*Hot-spot anti-pattern: using an ISO timestamp as the document ID concentrates writes on a single shard.*

```python
doc_ref = db.collection("events").document(datetime.utcnow().isoformat())
```

#### Prefer

Use auto-generated IDs for maximum shard distribution, or hash-prefix sequential IDs to disperse writes across multiple shards while preserving sortability.

*Use auto-generated IDs to distribute writes evenly across Firestore shards.*

```python
doc_ref = db.collection("events").document()
```

*Use a 4-character MD5 hash prefix on sequential IDs to disperse writes while keeping the timestamp queryable as a field.*

```python
import hashlib
ts = datetime.utcnow().isoformat()
prefix = hashlib.md5(ts.encode()).hexdigest()[:4]
doc_ref = db.collection("events").document(f"{prefix}_{ts}")
```

---

### Firestore | performance | index explosion

Firestore auto-indexes every field in every document. If a document contains a large map with many keys, Firestore creates one index entry per field per value combination, which can multiply write costs.

#### Example of index explosion
A document with a `metadata` map containing 50 dynamic keys creates 50 index entries on write, charged as additional write operations.

#### Mitigation

Exempt the high-cardinality map field from auto-indexing using a single-field index exemption.

*Exempt the `metadata` map field in `pipeline_runs` from auto-indexing to eliminate index explosion write costs.*

```bash
gcloud firestore indexes fields update metadata \
  --collection-group=pipeline_runs \
  --index-config=no-index
```

Or restructure to store dynamic keys as an array of `{key, value}` objects rather than a flat map.

> [!warning] Large Maps Inflate Costs
>
> Large maps can silently inflate costs.
> Monitor write costs if you store variable-key maps (e.g., arbitrary metadata dicts). A document with 100 map keys costs 100+ index write units per document write.

> [!success] Exempt High-Cardinality Maps From Indexing
>
> Use a single-field index exemption to disable auto-indexing on the dynamic map field: `gcloud firestore indexes fields update metadata --collection-group=pipeline_runs --index-config=no-index`. Alternatively, serialize the map to a JSON string field — one indexed string instead of N index entries.

---

### Firestore | vector search | find_nearest() GA

Firestore Native mode supports K-nearest-neighbor (KNN) vector similarity search via `find_nearest()` on a vector-typed field. This enables semantic search, recommendation, and embedding lookup directly on Firestore data without an external vector store. Firestore does not generate embeddings — use a service such as Vertex AI to create vector values and store them back in Firestore documents.

#### Supported distance measures

| Measure | Range | Best for | Notes |
|---|---|---|---|
| `COSINE` | 0–2 | General-purpose | Normalization built in. 0 = identical, 2 = opposite. |
| `DOT_PRODUCT` | varies | Pre-normalized embeddings | Faster than cosine but requires unit vectors. |
| `EUCLIDEAN` | 0–∞ | Spatial distance | Sensitive to vector magnitude. |

#### Vector index creation

A vector index must exist on the field before `find_nearest()` can run. The index type must be `flat` and the maximum dimension is **2048**.

*Create a vector index on the `embedding` field of the `stocks` collection.*

```bash
gcloud firestore indexes composite create \
  --database=main \
  --collection-group=stocks \
  --field-config=field-path=embedding,vector-config='{"dimension":"768","flat":"{}"}' \
  --field-config=field-path=sector,order=ASCENDING
```

#### Python | find_nearest() — query similar documents

*Find the 5 stocks with embeddings most similar to a query vector using cosine distance.*

```python
from google.cloud.firestore_v1.vector import Vector
from google.cloud.firestore_v1.base_vector_query import DistanceMeasure

query_embedding = Vector([0.12, -0.34, ...])  # 768-dim vector from Vertex AI

results = (
    db.collection("stocks")
    .find_nearest(
        vector_field="embedding",
        query_vector=query_embedding,
        distance_measure=DistanceMeasure.COSINE,
        limit=5,
    )
    .stream()
)
for doc in results:
    print(doc.id, doc.to_dict()["short_name"])
```

> [!tip] Combine vector search with pre-filters
>
> Add standard `where()` filters before `find_nearest()` to narrow the candidate set. For example, filter by `sector == "Technology"` first, then find the nearest vectors within that subset. Pre-filtering reduces the search space and improves latency.

---

### Firestore | pricing | billing gotchas

- **Reads are per document, not per query**: fetching a collection of 10,000 documents costs 10,000 reads even if you only look at one field per document. Use `select()` projections where supported.
- **Listeners count as reads**: the initial snapshot delivery for `on_snapshot()` counts as reads for every document sent. Subsequent updates are charged per changed document.
- **Deletes are not free**: deleting documents costs $0.02 per 100,000 — relevant for high-volume cleanup jobs.
- **Index writes cost extra**: each indexed field adds to the write cost. See index explosion above.
- **Network egress**: data leaving GCP (to other clouds or the internet) is billed. Same-region access is free.
- **TTL deletions are billed**: documents deleted by TTL policies count as regular delete operations at $0.02 per 100,000.

---

### Firestore | TTL | automatic document expiration

Firestore TTL (time-to-live) policies automatically delete documents after a designated timestamp field expires. TTL is designed for cleanup of stale data — sessions, temporary tokens, rate-limiting records, and log entries with retention periods.

#### How TTL works

Designate a `Date and time` field as the expiration timestamp for a collection group. Firestore deletes expired documents within **24 hours** of the expiration time. Deletion is not instantaneous — expired documents continue to appear in queries until the TTL process removes them.

| Constraint | Value |
|---|---|
| TTL fields per collection group | 1 |
| Maximum field-level configurations | 500 |
| Deletion latency | Up to 24 hours after expiration |
| Subcollection behavior | Parent deletion does not cascade — subcollections remain |
| Billing | Deletions count as regular delete operations |

> [!warning] TTL is for cleanup, not access control
>
> The 24-hour deletion delay means application code must still validate timestamps before granting access. A verification code that expires after 10 minutes should be checked in code — TTL handles the eventual cleanup, not the real-time enforcement.

> [!success] Validate expiration in code, use TTL for garbage collection
>
> Check the expiration timestamp in your query or application logic for time-sensitive access decisions. TTL runs as a low-priority background process to reclaim storage without manual intervention.

#### gcloud | Create a TTL policy

*Mark the `expires_at` field as the TTL field for the `alerts` collection group.*

```bash
gcloud firestore fields ttls update expires_at \
  --collection-group=alerts \
  --database=main \
  --enable-ttl
```

#### Python | Set a document with TTL expiration

*Create an alert document that auto-expires 7 days from now.*

```python
from datetime import datetime, timezone, timedelta

db.collection("alerts").add({
    "type": "PRICE_DROP",
    "message": "MC.PA triggered price drop alert",
    "created_at": firestore.SERVER_TIMESTAMP,
    "expires_at": datetime.now(tz=timezone.utc) + timedelta(days=7),
})
```

---

### Firestore | managed backups | scheduled backup and restore

Firestore managed backups automatically back up the database at scheduled intervals, stored and managed by Google internally without requiring a GCS bucket. This is separate from the manual `gcloud firestore export` workflow. Managed backups provide longer retention (up to 14 weeks) compared to PITR (7 days).

| Feature | Managed Backups | Manual Export | PITR |
|---|---|---|---|
| Trigger | Automatic (daily/weekly schedule) | Manual (`gcloud firestore export`) | Continuous |
| Storage | Google-managed (no GCS bucket) | User-managed GCS bucket | Built-in |
| Retention | Up to 14 weeks | Until deleted from GCS | 7 days |
| Restore target | New database only | Same or different database | Same database (any point in window) |
| Includes indexes | ✅ | ✅ | ✅ |
| Includes TTL policies | ❌ | ❌ | ✅ |
| Includes Security Rules | ❌ | ❌ | N/A |

#### gcloud | Create a daily backup schedule

*Create a daily backup schedule for the `main` database with 7-day retention.*

```bash
gcloud firestore backups schedules create \
  --database=main \
  --recurrence=daily \
  --retention=7d
```

#### gcloud | List backup schedules

*List all configured backup schedules for the `main` database.*

```bash
gcloud firestore backups schedules list \
  --database=main
```

> [!tip] Use managed backups for disaster recovery, exports for analytics
>
> Managed backups are optimized for point-in-time restore to a new database. Use manual exports when you need to load Firestore data into BigQuery or process it outside Firestore. Both can coexist — configure a daily managed backup for DR and a weekly export for analytics pipelines.

---

## Firestore vs Alternatives — Decision Matrix

| Feature | Firestore | BigQuery | Cloud SQL | Bigtable |
|---|---|---|---|---|
| Primary use case | Real-time state, config, flags | Analytics and reporting | Relational OLTP | Time-series at scale |
| Typical latency | <10 ms | Seconds to minutes | <10 ms | <10 ms |
| Schema model | Flexible (schemaless) | Fixed (typed columns) | Fixed (DDL schema) | Column families |
| Real-time listeners | ✅ `on_snapshot` | ❌ | ❌ | ❌ |
| SQL support | ❌ | ✅ Standard SQL | ✅ PostgreSQL/MySQL | ❌ |
| Joins | ❌ | ✅ | ✅ | ❌ |
| Transactions | ✅ cross-document | ❌ DML is not ACID cross-row | ✅ ACID | Row-level only |
| Auto-scaling | Fully serverless | Fully serverless | Manual instance sizing | Manual node scaling |
| Cost model | Per read/write/delete | Per bytes scanned | Per instance-hour | Per node-hour |
| Free tier | ✅ generous | ✅ 1 TB scan/month | ❌ | ❌ |
| Max record size | 1 MiB | No practical limit | Row-level limits | 10 MB per row |
| Best for DE | Pipeline state, config | Analytics queries | Structured transactional data | IoT, time-series, wide rows |
| Companion service | BigQuery (analytics) | Firestore (hot path) | — | BigQuery (export) |

### Decision Guidance

Use the following rules to select the right storage service. When multiple criteria apply, the first matching rule wins.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {
  'primaryColor': '#292e42',
  'primaryTextColor': '#c0caf5',
  'primaryBorderColor': '#565f89',
  'lineColor': '#565f89',
  'secondaryColor': '#1a1b26',
  'tertiaryColor': '#24283b',
  'noteTextColor': '#c0caf5',
  'noteBkgColor': '#292e42',
  'textColor': '#c0caf5',
  'fontSize': '14px'
}}}%%
flowchart TD
    START["What is your primary need?"]
    Q1{"Real-time listeners<br>or push updates?"}
    Q2{"SQL analytics on<br>large datasets?"}
    Q3{"ACID transactions<br>with foreign keys?"}
    Q4{"High-throughput<br>time-series writes<br>(>10 GB/s)?"}
    Q5{"Pipeline state,<br>config, or flags?"}

    FS["✅ Firestore<br>Real-time, schemaless,<br>fully serverless"]
    BQ["✅ BigQuery<br>Analytics, reporting,<br>per-bytes-scanned cost"]
    SQL["✅ Cloud SQL<br>PostgreSQL / MySQL,<br>ACID, FK constraints"]
    BT["✅ Bigtable<br>IoT, time-series,<br>wide-row column store"]
    FS2["✅ Firestore<br>Purpose-built for<br>operational state"]

    Y1["YES"]:::yes
    N1["NO"]:::no
    Y2["YES"]:::yes
    N2["NO"]:::no
    Y3["YES"]:::yes
    N3["NO"]:::no
    Y4["YES"]:::yes
    N4["NO"]:::no
    Y5["YES"]:::yes

    START --> Q1
    Q1 --> Y1 --> FS
    Q1 --> N1 --> Q2
    Q2 --> Y2 --> BQ
    Q2 --> N2 --> Q3
    Q3 --> Y3 --> SQL
    Q3 --> N3 --> Q4
    Q4 --> Y4 --> BT
    Q4 --> N4 --> Q5
    Q5 --> Y5 --> FS2

    classDef yes fill:#1f3b2d,stroke:#73d13d,color:#c0caf5
    classDef no fill:#4a1f24,stroke:#db4b4b,color:#c0caf5
```

#### Firestore vs Alternatives — decision guidance
- Need real-time updates or listeners → **Firestore**
- Need SQL analytics on large datasets → **BigQuery** (see [querying-and-cost-optimization](https://alp78.github.io/elysium/06-GCP/03-BigQuery/03-querying-and-cost-optimization))
- Need ACID transactions with foreign keys → **Cloud SQL**
- Need >10 GB/s write throughput on time-series → **Bigtable**
- Need pipeline state, config, feature flags → **Firestore** (purpose-built for this)

---

## Quick Reference

One-liners and minimal command references for copy-paste use in pipeline code or terminal sessions.

### Python | quick reference | common one-liners

Frequently used one-liners for the Python SDK. All examples assume `db = firestore.Client(project="my-project")`.

*Common Python SDK one-liners: reference shortcuts, timestamp writes, increments, field deletes, streaming, and aggregation counts.*

```python
from google.cloud import firestore
from datetime import datetime, timezone

db = firestore.Client(project="my-project")

# Reference shortcuts
col = lambda name: db.collection(name)
doc = lambda col_name, doc_id: db.collection(col_name).document(doc_id)

# Write with server timestamp
doc("pipelines", "my-pipeline").set({
    "status": "running",
    "started_at": firestore.SERVER_TIMESTAMP,
})

# Atomic increment
doc("pipelines", "my-pipeline").update({
    "rows_processed": firestore.Increment(1000),
})

# Delete a field
doc("pipelines", "my-pipeline").update({
    "temp_field": firestore.DELETE_FIELD,
})

# Stream all docs in a collection
for d in col("pipelines").stream():
    print(d.id, d.to_dict())

# Count without fetching documents
count = col("pipelines").where("status", "==", "failed").count().get()[0][0].value
```

### gcloud | quick reference | daily operations

Minimal `gcloud` commands for daily Firestore operations. For full flag references and output examples, see [gcloud CLI Operations](#gcloud-cli-operations) above.

*Quick-reference cheat sheet for the most common `gcloud firestore` commands: database create, export, import, and index management.*

```bash
# Create database
gcloud firestore databases create --location=us-central1

# Export to GCS
gcloud firestore export gs://BUCKET/PATH

# Import from GCS
gcloud firestore import gs://BUCKET/PATH

# List indexes
gcloud firestore indexes composite list

# Create composite index
gcloud firestore indexes composite create \
  --collection-group=COLLECTION \
  --field-config=field-path=FIELD1,order=ASCENDING \
  --field-config=field-path=FIELD2,order=DESCENDING
```
