---
title: "Data Flow Architecture"
tags:
  - data-architecture
  - pipeline
  - data-transfer
  - gcp
  - sql-server
  - bigquery
  - patterns
  - parquet
  - csv
  - streaming
  - pubsub
  - firestore
  - cloud-run
  - airflow
  - networking
aliases:
  - "Data Movement Patterns"
  - "Data Flow Topology"
description: "Complete data movement topology, transfer method selection, format decisions, and flow patterns for the GCP + SQL Server stack."
created: 2026-03-29
updated: 2026-03-29
status: complete
---

# Data Flow Architecture

> [!quote]
> "As data accumulates, it begins to have gravity — it attracts services, applications, and more data toward it. Moving compute to data is almost always cheaper than moving data to compute."
>
> — **Dave McCrory** (coined the term "data gravity")

This page is the topology map for the entire stack. Every other page in the vault covers *how* to use a specific tool — this page answers *which* tool, *what format*, and *what pattern* for moving data from any A to any B.

---

## The Complete Data Flow Topology

```mermaid
graph TD
    subgraph External
        API[External APIs<br>yfinance, FRED, Finnhub]
        GHA[GitHub Actions<br>CI/CD]
    end

    subgraph Workstation[Local Workstation]
        DEV[Developer Machine]
    end

    subgraph GCP[Google Cloud Platform]
        GCS[Cloud Storage<br>gs://data-lake]
        BQ[BigQuery<br>Warehouse]
        CR[Cloud Run<br>Jobs/Services]
        PS[Pub/Sub<br>Events]
        FS[Firestore<br>Real-time]
    end

    subgraph VM[Compute Engine VMs]
        SQL[SQL Server<br>bronze → silver → gold]
        AF[Airflow<br>Orchestration]
        DD[Datadog Agent<br>Monitoring]
    end

    API -->|Python loaders| SQL
    API -->|Python fetch| GCS
    SQL -->|bcp export → gsutil| GCS
    GCS -->|bq load| BQ
    SQL -->|CDC| PS
    PS -->|streaming insert| BQ
    PS -->|Python consumer| FS
    DEV -->|IAP tunnel| SQL
    DEV -->|gcloud scp / rsync| VM
    DEV -->|gcloud storage cp| GCS
    GHA -->|WIF auth| GCP
    AF -->|orchestrates| SQL
    AF -->|orchestrates| BQ
    CR -->|scheduled jobs| SQL

    style API fill:#e8b84d,stroke:#333,color:#000
    style GCS fill:#4285f4,stroke:#333,color:#fff
    style BQ fill:#669df6,stroke:#333,color:#fff
    style SQL fill:#cc4125,stroke:#333,color:#fff
    style AF fill:#017cee,stroke:#333,color:#fff
    style PS fill:#34a853,stroke:#333,color:#fff
    style FS fill:#ff9100,stroke:#333,color:#fff
```

### Flow inventory — every data movement in the stack

| Flow | Source | Destination | Tool | Format | Frequency | Vault Reference |
|---|---|---|---|---|---|---|
| API ingestion | External APIs | SQL Server bronze | Python (pyodbc) | JSON → SQL INSERT | Daily (Airflow) | [bronze-layer-loading > Strategy 1: Truncate & Reload (Most Loaders)](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/bronze-layer-loading#strategy-1-truncate--reload-most-loaders) |
| OHLCV merge | External APIs | SQL Server bronze | Python (pyodbc) | JSON → SQL MERGE | Daily (Airflow) | [bronze-layer-loading > Strategy 2: Merge (OHLCV Only)](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/bronze-layer-loading#strategy-2-merge-ohlcv-only) |
| Bronze → Silver | SQL Server bronze | SQL Server silver | Python transforms | In-database | Daily (Airflow) | [medallion-architecture > Silver (Cleaned)](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/medallion-architecture#silver-cleaned) |
| Silver → Gold | SQL Server silver | SQL Server gold | Python transforms | In-database | Daily (Airflow) | [medallion-architecture > Gold (Analytics)](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/medallion-architecture#gold-analytics) |
| SQL → BigQuery | SQL Server gold | BigQuery | bcp → GCS → bq load | CSV/Parquet | Daily | See cross-database join below |
| CDC streaming | SQL Server | Pub/Sub → BigQuery | CDC + Python | JSON events | Near-real-time | [sql-server-change-tracking > CDC → Pub/Sub — streaming changes to GCP](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-change-tracking#cdc--pubsub--streaming-changes-to-gcp) |
| CDC to Firestore | SQL Server | Firestore | CDC + Python | JSON docs | Event-driven | [sql-server-change-tracking > CDC → Firestore — push dimension changes to real-time store](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-change-tracking#cdc--firestore--push-dimension-changes-to-real-time-store) |
| GCS → BigQuery | Cloud Storage | BigQuery | bq load | Parquet/CSV | On-demand | [data-loading-and-export > bq load --source_format=PARQUET — load Parquet from GCS (recommended)](https://alp78.github.io/elysium/06-GCP/BigQuery/data-loading-and-export#bq-load---sourceformatparquet--load-parquet-from-gcs-recommended) |
| File transfer | Local | GCE VM | gcloud scp / rsync | Any | Ad-hoc | [data-transfer > gcloud compute scp — push and pull files to/from GCE VMs](https://alp78.github.io/elysium/01-Shell/File-Operations/data-transfer#gcloud-compute-scp--push-and-pull-files-tofrom-gce-vms) |
| File upload | Local | GCS | gcloud storage cp | Any | Ad-hoc | [data-transfer > gcloud storage — modern replacement for gsutil (20-94% faster)](https://alp78.github.io/elysium/01-Shell/File-Operations/data-transfer#gcloud-storage--modern-replacement-for-gsutil-20-94-faster) |
| Orchestration | Airflow | All systems | DAG tasks | N/A | Scheduled | [airflow-dag-patterns > Medallion Architecture DAG — Bronze to Silver to Gold](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-dag-patterns#medallion-architecture-dag--bronze-to-silver-to-gold) |

---

## Transfer Method Decision Matrix

"I need to move data from X to Y — which tool?"

| Source | Destination | Volume | Best Tool | Why | Reference |
|---|---|---|---|---|---|
| Local file | GCE VM | < 1 GB | `gcloud compute scp` | Simple, IAP-integrated | [data-transfer > gcloud compute scp — push and pull files to/from GCE VMs](https://alp78.github.io/elysium/01-Shell/File-Operations/data-transfer#gcloud-compute-scp--push-and-pull-files-tofrom-gce-vms) |
| Local file | GCE VM | > 1 GB | `rsync -avzP` through IAP | Resume, delta, compression | [data-transfer > rsync through IAP tunnel — transferring to GCE VMs with no public IP](https://alp78.github.io/elysium/01-Shell/File-Operations/data-transfer#rsync-through-iap-tunnel--transferring-to-gce-vms-with-no-public-ip) |
| Local file | GCS | Any | `gcloud storage cp` | Parallel composite upload, resumable | [data-transfer > gcloud storage — modern replacement for gsutil (20-94% faster)](https://alp78.github.io/elysium/01-Shell/File-Operations/data-transfer#gcloud-storage--modern-replacement-for-gsutil-20-94-faster) |
| GCS | BigQuery | Any | `bq load` | Native, no intermediate step | [data-loading-and-export > bq load --source_format=PARQUET — load Parquet from GCS (recommended)](https://alp78.github.io/elysium/06-GCP/BigQuery/data-loading-and-export#bq-load---sourceformatparquet--load-parquet-from-gcs-recommended) |
| BigQuery | GCS | Any | `bq extract` | Native export with compression | [data-loading-and-export > Exporting BigQuery Data to GCS](https://alp78.github.io/elysium/06-GCP/BigQuery/data-loading-and-export#exporting-bigquery-data-to-gcs) |
| JSON/CSV | SQL Server | < 100K rows | pyodbc `fast_executemany` | Transactional, Python-native | [sql-server-loading-patterns > cursor.fast_executemany = True — batch mode activation](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-loading-patterns#cursorfastexecutemany--true--batch-mode-activation) |
| JSON/CSV | SQL Server | > 1M rows | `bcp` bulk load | Fastest path, minimal logging | [sql-server-loading-patterns > bcp BULK LOAD — command-line syntax](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-loading-patterns#bcp-bulk-load--command-line-syntax) |
| SQL Server | CSV file | Any | `bcp queryout` | Maximum throughput | [data-transfer > bcp queryout — export a query result to CSV](https://alp78.github.io/elysium/01-Shell/File-Operations/data-transfer#bcp-queryout--export-a-query-result-to-csv) |
| GCS ↔ GCS | Same region | Any | `gsutil cp gs:// gs://` | Server-side, zero egress | [data-transfer > gsutil cp gs:// gs:// — server-side copy between GCS buckets](https://alp78.github.io/elysium/01-Shell/File-Operations/data-transfer#gsutil-cp-gs-gs--server-side-copy-between-gcs-buckets) |
| Directory sync | Local ↔ GCS | Ongoing | `gsutil rsync` / `gcloud storage rsync` | Delta sync, delete support | [data-transfer > gsutil rsync — delta sync to Cloud Storage](https://alp78.github.io/elysium/01-Shell/File-Operations/data-transfer#gsutil-rsync--delta-sync-to-cloud-storage) |
| VM ↔ VM | Same VPC | Any | `rsync` over private IP | No IAP needed, direct path | [data-transfer > rsync -avzP over SSH — local to remote and back](https://alp78.github.io/elysium/01-Shell/File-Operations/data-transfer#rsync--avzp-over-ssh--local-to-remote-and-back) |
| VM ↔ VM | Cross-VPC | Any | `rsync` through IAP | IAP for secure cross-VPC | [iap-tunneling](https://alp78.github.io/elysium/01-Shell/Networking/iap-tunneling) |

---

## Format Selection by Scenario

When to use CSV vs JSON vs Parquet vs Avro. For the deep codec comparison with benchmarks, see [serialization-formats](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/serialization-formats).

| Scenario | Format | Compression | Why |
|---|---|---|---|
| API response landing (bronze) | JSON | None (small files) | Preserves source structure exactly |
| Pipeline intermediate files | Parquet | snappy (default) | Columnar, fast reads, schema embedded |
| BigQuery loading from GCS | Parquet | snappy | Native BQ support, schema auto-detect |
| SQL Server bcp export | CSV | gzip or zstd | bcp native format, universal |
| Long-term archive in GCS | Parquet | zstd -19 | Maximum compression for cold storage |
| Streaming / messaging (Pub/Sub) | JSON | None | Human-readable, schema-flexible |
| Cross-system data contract | Avro | deflate | Schema evolution, compact binary |

> [!tip] Format selection rule of thumb
>
> - **Landing zone (bronze):** Keep the source format (JSON from APIs, CSV from bcp)
> - **Processing (silver/gold):** Parquet with snappy — columnar reads, schema enforcement
> - **Warehouse (BigQuery):** Parquet for bulk loads, JSON for streaming inserts
> - **Messaging (Pub/Sub):** JSON — schema validation at the consumer, not the broker
>
> For compression algorithm selection (gzip vs zstd vs snappy), see
> [compression > Compression strategy matrix — choosing the right algorithm for data pipelines](https://alp78.github.io/elysium/01-Shell/File-Operations/compression#compression-strategy-matrix--choosing-the-right-algorithm-for-data-pipelines).

---

## Push vs Pull Architecture

Three models for data flow direction. Most production stacks use all three.

```mermaid
graph LR
    subgraph Pull["Pull Model"]
        C1[Consumer] -->|requests data| S1[Source]
    end
    subgraph Push["Push Model"]
        S2[Source] -->|sends on change| C2[Consumer]
    end
    subgraph Staged["Staged Model"]
        S3[Source] -->|writes to| I[Intermediate<br>Storage] -->|reads from| C3[Consumer]
    end

    style Pull fill:#1a1a2e,stroke:#4285f4,color:#fff
    style Push fill:#1a1a2e,stroke:#34a853,color:#fff
    style Staged fill:#1a1a2e,stroke:#e8b84d,color:#fff
```

| Model | How It Works | Stack Example | Best For |
|---|---|---|---|
| **Pull** | Consumer requests data when needed | BigQuery query, `SELECT` from SQL Server, API call | Low coupling, consumer controls timing |
| **Push** | Producer sends data when it changes | CDC → Pub/Sub, Firestore trigger, webhook | Low latency, event-driven reactions |
| **Staged** | Producer writes to storage, consumer reads at own pace | API → JSON → GCS → `bq load` | Decoupled, fault-tolerant, replayable |

> [!info] When to choose each model
>
> - **Pull** when the consumer needs data on-demand and can tolerate latency (dashboards,
>   ad-hoc queries, backfills)
> - **Push** when changes must propagate within seconds (dimension updates to Firestore,
>   alerting on anomalies)
> - **Staged** when source and destination have different availability, speed, or schema
>   requirements (the default for batch pipelines — producer and consumer never need to be
>   online simultaneously)

---

## Batch vs Streaming vs Micro-Batch

For the full streaming architecture theory (Lambda, Kappa, event sourcing, windowing), see [streaming-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/streaming-architecture).

| Pattern | Latency | Tool in Stack | Use Case |
|---|---|---|---|
| **Batch** (scheduled) | Hours | Airflow DAG → Python → SQL Server / BigQuery | Daily pipeline, backfills, full refresh |
| **Micro-batch** | Minutes | Cloud Scheduler → Cloud Run Job | 5-minute price snapshots (pulse) |
| **Streaming** | Seconds | CDC → Pub/Sub → BigQuery streaming insert | Dimension change propagation |

```mermaid
graph TD
    subgraph Batch["Batch (Daily)"]
        B1[Airflow Scheduler] -->|triggers| B2[Python Loaders]
        B2 -->|INSERT/MERGE| B3[SQL Server]
        B3 -->|bcp export| B4[GCS]
        B4 -->|bq load| B5[BigQuery]
    end

    subgraph Micro["Micro-Batch (5 min)"]
        M1[Cloud Scheduler] -->|triggers| M2[Cloud Run Job]
        M2 -->|fetch + INSERT| M3[SQL Server pulse]
    end

    subgraph Stream["Streaming (seconds)"]
        ST1[SQL Server CDC] -->|change events| ST2[Pub/Sub]
        ST2 -->|streaming insert| ST3[BigQuery]
        ST2 -->|consumer| ST4[Firestore]
    end

    style Batch fill:#1a1a2e,stroke:#4285f4,color:#fff
    style Micro fill:#1a1a2e,stroke:#e8b84d,color:#fff
    style Stream fill:#1a1a2e,stroke:#34a853,color:#fff
```

> [!warning] Choosing the right pattern
>
> - Batch is correct for 90% of data engineering workloads. Don't add streaming
>   complexity unless you have a latency requirement under 5 minutes.
> - Micro-batch (Cloud Run on a schedule) is the sweet spot for "near-real-time"
>   without the operational cost of streaming infrastructure.
> - Streaming is justified only when: (a) downstream consumers need sub-minute data,
>   AND (b) the source supports change capture.
>
> See [streaming-architecture > Streaming vs Batch Decision Matrix](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/streaming-architecture#streaming-vs-batch-decision-matrix) for the full
> decision framework.

> [!success] Default to Batch, Escalate Deliberately
>
> Start every new pipeline as a daily Airflow DAG. If stakeholders request faster data, move to micro-batch (Cloud Scheduler → Cloud Run) — this delivers near-real-time refresh with no streaming infrastructure. Only introduce CDC + Pub/Sub streaming when a documented latency SLA of under 5 minutes cannot be met by micro-batch and the source system supports change capture.

---

## The Cross-Database Join Problem

"I need data from SQL Server AND BigQuery in the same query." There is no direct connector between them. Three options:

### Option A: Export BigQuery → load into SQL Server (small datasets)

```mermaid
graph LR
    BQ[BigQuery] -->|bq extract| GCS[GCS bucket]
    GCS -->|gsutil cp| VM[GCE VM]
    VM -->|bcp in| SQL[SQL Server]

    style BQ fill:#669df6,stroke:#333,color:#fff
    style SQL fill:#cc4125,stroke:#333,color:#fff
```

Best for < 1M rows. Use when SQL Server has the complex logic and BigQuery has a small reference table.

- `bq extract` to GCS as CSV: [data-loading-and-export > Exporting BigQuery Data to GCS](https://alp78.github.io/elysium/06-GCP/BigQuery/data-loading-and-export#exporting-bigquery-data-to-gcs)
- `gsutil cp` / `gcloud storage cp` to VM: [gcs-object-operations > Copying Files with gcloud storage cp](https://alp78.github.io/elysium/06-GCP/Storage/gcs-object-operations#copying-files-with-gcloud-storage-cp)
- `bcp in` to SQL Server: [sql-server-loading-patterns > bcp BULK LOAD — command-line syntax](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-loading-patterns#bcp-bulk-load--command-line-syntax)

### Option B: Export SQL Server → load into BigQuery (analytical queries)

```mermaid
graph LR
    SQL[SQL Server] -->|bcp queryout| CSV[CSV on VM]
    CSV -->|gcloud storage cp| GCS[GCS bucket]
    GCS -->|bq load| BQ[BigQuery]

    style SQL fill:#cc4125,stroke:#333,color:#fff
    style BQ fill:#669df6,stroke:#333,color:#fff
```

Best for analytical queries over large datasets. Use when BigQuery is the analytical engine and SQL Server has the source data.

- `bcp queryout` from SQL Server: [data-transfer > bcp queryout — export a query result to CSV](https://alp78.github.io/elysium/01-Shell/File-Operations/data-transfer#bcp-queryout--export-a-query-result-to-csv)
- Upload to GCS: [data-transfer > gcloud storage — modern replacement for gsutil (20-94% faster)](https://alp78.github.io/elysium/01-Shell/File-Operations/data-transfer#gcloud-storage--modern-replacement-for-gsutil-20-94-faster)
- `bq load` into BigQuery: [data-loading-and-export > bq load --source_format=CSV — load CSV from GCS](https://alp78.github.io/elysium/06-GCP/BigQuery/data-loading-and-export#bq-load---sourceformatcsv--load-csv-from-gcs)

### Option C: Pull both into Python DataFrames (ad-hoc analysis)

```mermaid
graph LR
    SQL[SQL Server] -->|pyodbc / pd.read_sql| PY[Python<br>pandas/polars]
    BQ[BigQuery] -->|bigquery.Client| PY
    PY -->|merge / join| R[Result DataFrame]

    style SQL fill:#cc4125,stroke:#333,color:#fff
    style BQ fill:#669df6,stroke:#333,color:#fff
    style PY fill:#306998,stroke:#333,color:#fff
```

Best for ad-hoc analysis and small-to-medium joins. Use when both datasets fit in memory.

- SQL Server via pyodbc: [sql-server-loading-patterns > cursor.fast_executemany = True — batch mode activation](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-loading-patterns#cursorfastexecutemany--true--batch-mode-activation)
- BigQuery via Python client: [bq-advanced](https://alp78.github.io/elysium/05-DB-Queries/BigQuery/bq-advanced)

> [!tip] Cross-Database Join Decision
>
> Move the **smaller, more static** dataset to where the **larger, more dynamic** dataset
> lives. If BigQuery has 10B rows and SQL Server has 1K dimension rows, export the
> dimension to BigQuery — never pull 10B rows to SQL Server. If both datasets are small,
> Option C (Python) is the fastest path to an answer.

---

## Data Flow Anti-Patterns

> [!danger] Data Flow Anti-Patterns
>
> | Anti-Pattern | Problem | Fix |
> |---|---|---|
> | **Laptop as ETL server** | Doesn't scale, single point of failure, network bottleneck | Run pipelines on GCE VMs or Cloud Run |
> | **Direct SQL Server ↔ BigQuery** | No connector exists — people waste hours looking | Use the staged pattern: bcp → GCS → bq load |
> | **Uncompressed network transfers** | Wastes bandwidth, 3-10x slower | Always compress: `rsync -z`, `gzip`, `zstd` |
> | **No intermediate storage** | If destination fails, restart from source | Stage in GCS first — replay without re-fetching |
> | **Mixed push and pull for same flow** | CDC to Pub/Sub AND a batch pull = duplicates | Choose one: event-driven OR batch, not both |
> | **No source-destination validation** | Row count mismatches go unnoticed | Compare `COUNT(*)` after every load — see [idempotent-pipeline-design](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design) |
> | **Loading directly to production** | No validation, no rollback | Always load to staging first — see [sql-server-loading-patterns > Loading Directly to Production — no staging, no validation](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-loading-patterns#loading-directly-to-production--no-staging-no-validation) |

> [!success] Safe Data Flow Patterns
>
> Run all pipeline jobs on GCE VMs or Cloud Run — never on a local machine. Always stage data in GCS before loading to BigQuery (`bcp queryout` → `gcloud storage cp` → `bq load`). Compress all network transfers with `rsync -z` or `zstd`. Always compare `COUNT(*)` source vs destination after every load. Use a single flow model per dataset (either CDC streaming or batch — not both) and load to a staging table first, then swap or merge into production.

---

## Related

- [data-transfer](https://alp78.github.io/elysium/01-Shell/File-Operations/data-transfer) — CLI tools for every transfer scenario (rsync, scp, bcp, gsutil)
- [compression](https://alp78.github.io/elysium/01-Shell/File-Operations/compression) — Algorithm selection for pipeline data
- [serialization-formats](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/serialization-formats) — Format comparison with benchmarks
- [medallion-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/medallion-architecture) — Bronze → Silver → Gold layer design
- [idempotent-pipeline-design](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design) — Load patterns that are safe to re-run
- [streaming-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/streaming-architecture) — Full streaming theory (Lambda, Kappa, CDC, windowing)
- [sql-server-loading-patterns](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-loading-patterns) — SQL Server bulk load methods and benchmarks
- [data-loading-and-export](https://alp78.github.io/elysium/06-GCP/BigQuery/data-loading-and-export) — BigQuery load and export operations
- [gcs-object-operations](https://alp78.github.io/elysium/06-GCP/Storage/gcs-object-operations) — GCS file operations and transfer optimization
- [airflow-dag-patterns](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-dag-patterns) — Orchestration patterns for all flows above
