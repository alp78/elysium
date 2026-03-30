---
type: concept
category: data-architecture
technology: [sql-server, python, bigquery, gcp, airflow, terraform]
tags: [data-architecture, architecture, pipeline, python, sql, terraform, airflow, bigquery, gcp]
aliases: [idempotency patterns, backfill strategies, migration playbook, data architect playbook, strangler fig pattern, schema evolution, expand-and-contract, event-driven architecture, data contracts, schema registry, FinOps, cloud cost optimization, streaming windowing, Dataflow pipeline, exactly-once processing]
keywords: [idempotency, backfill, migration, strangler fig, re-platform, re-architect, lift-and-shift, shadow comparison, MERGE, upsert, delete-insert, SCD type 2, truncate-reload, schema evolution, expand-and-contract, event-driven, Pub/Sub, Cloud Functions, Cloud Run, Dataflow, Apache Beam, windowing, tumbling window, sliding window, watermark, late data, data contracts, Protobuf, Avro, schema registry, FinOps, BigQuery cost, reservations, on-demand, partition pruning, clustering, GCS lifecycle, exactly-once, idempotency key, technical debt]
description: "The data architect's playbook covering migration patterns (lift-and-shift through re-architecture, strangler fig), idempotency deep dive (truncate-reload, upsert, delete-insert, SCD Type 2), backfill strategies, exactly-once processing, schema evolution without downtime, event-driven architecture on GCP (Pub/Sub + Cloud Functions + Dataflow), data contracts (Protobuf, Avro, Schema Registry), FinOps for BigQuery, and advanced streaming patterns with Apache Beam. Includes all code examples and diagrams."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# The Data Architect's Playbook: Migration, Idempotency, and Backfills

A senior data engineer does not just build pipelines — they design systems that are safe to re-run, possible to migrate, and resilient to the inevitable chaos of production data. This note covers the architectural patterns that distinguish a reliable data platform from a fragile collection of scripts.

## Migrating On-Premises to Cloud (The Enterprise Playbook)

A large-scale data platform migration in the financial index industry — moving from an on-premises data estate to GCP — illustrates the patterns and pitfalls covered in this section, applicable to any enterprise data platform.

#### The migration spectrum

| Strategy | Description | Risk | Duration | Cost |
|---|---|---|---|---|
| **Lift and shift** | Move VMs as-is to cloud | Low technical risk, high cost (no optimization) | Fast (weeks) | High (cloud VMs are expensive) |
| **Re-platform** | Move databases to managed services (Cloud SQL, AlloyDB) | Medium | Months | Medium |
| **Re-architect** | Redesign with cloud-native services (BigQuery, Pub/Sub, Cloud Run) | High (but highest payoff) | 12-24 months | Low (operational) |
| **Strangler fig** | Incrementally replace on-prem components with cloud equivalents | Low (each step is safe) | 12-36 months | Medium |

**Example approach: Strangler Fig with Re-architecture**

```
Phase 1: Data Lake Foundation (3-6 months)
   └─▶ Set up GCS buckets with lifecycle policies
   └─▶ Replicate data from on-prem to GCS (Storage Transfer Service)
   └─▶ Stand up BigQuery datasets mirroring on-prem schemas
   └─▶ dbt project initialized with source definitions pointing to BigQuery
   └─▶ Both on-prem and cloud pipelines run in parallel

Phase 2: Pipeline Migration (6-12 months)
   └─▶ Migrate batch pipelines one at a time (lowest risk first)
   └─▶ Each pipeline: rewrite in dbt/Python → deploy to Cloud Run → validate output → cut over
   └─▶ On-prem pipeline kept running as shadow (compare outputs daily)
   └─▶ Shadow comparison automated: row counts, checksums, statistical distributions

Phase 3: Real-time Migration (12-18 months)
   └─▶ Replace on-prem messaging with Pub/Sub
   └─▶ Migrate real-time index calculators (highest risk, last to move)
   └─▶ Parallel run: on-prem and cloud calculators produce independent values
   └─▶ Tolerance check: values must match within 0.001% for 30 consecutive days

Phase 4: Decommission On-Prem (18-24 months)
   └─▶ All pipelines running on cloud, on-prem is read-only archive
   └─▶ Final data validation and regulatory approval
   └─▶ Decommission on-prem infrastructure
```

#### The shadow comparison pattern — your safety net

```python
import pandas as pd
from dataclasses import dataclass

@dataclass
class ComparisonResult:
    table: str
    on_prem_rows: int
    cloud_rows: int
    row_diff: int
    matching_pct: float
    max_numeric_diff: float
    status: str  # PASS, WARN, FAIL

def compare_outputs(on_prem_df: pd.DataFrame, cloud_df: pd.DataFrame,
                     key_cols: list[str], numeric_cols: list[str],
                     tolerance: float = 0.0001) -> ComparisonResult:
    """Compare on-prem and cloud pipeline outputs row by row."""
    merged = on_prem_df.merge(cloud_df, on=key_cols, suffixes=('_onprem', '_cloud'), how='outer')

    total = len(merged)
    matched = 0
    max_diff = 0.0

    for col in numeric_cols:
        diff = (merged[f'{col}_onprem'] - merged[f'{col}_cloud']).abs()
        max_diff = max(max_diff, diff.max())
        matched += (diff < tolerance).sum()

    match_pct = matched / (total * len(numeric_cols)) * 100

    return ComparisonResult(
        table=f"comparison_{key_cols[0]}",
        on_prem_rows=len(on_prem_df),
        cloud_rows=len(cloud_df),
        row_diff=abs(len(on_prem_df) - len(cloud_df)),
        matching_pct=match_pct,
        max_numeric_diff=max_diff,
        status="PASS" if match_pct >= 99.99 and max_diff < tolerance else
               "WARN" if match_pct >= 99.9 else "FAIL"
    )
```

## Idempotency: The Foundation of Reliable Pipelines

An idempotent operation produces the same result whether you run it once or ten times. In data engineering, idempotency is not optional — it is the difference between a pipeline you can safely retry and one that corrupts data on every failure recovery.

#### The four idempotency patterns

| Pattern | Mechanism | Use Case | Trade-off |
|---|---|---|---|
| **Truncate-reload** | Delete all data for the scope, then reload | Small-medium tables, reference data | Simple but requires full reload every time |
| **Upsert (MERGE)** | Insert if new, update if exists (match on key) | Dimension tables, slowly changing data | Requires a reliable natural or business key |
| **Delete-insert** | Delete rows for the date/partition, then insert | Fact tables, daily loads | Atomic if wrapped in a transaction |
| **SCD Type 2** | Never update; insert new version with effective dates | Audit trail, regulatory compliance | Storage grows over time, queries need date filtering |

#### Truncate-reload (Bronze layer)

```sql
-- Idempotent: safe to rerun — always produces the same result
BEGIN TRANSACTION;
    TRUNCATE TABLE bronze.yahoo_ohlcv;

    INSERT INTO bronze.yahoo_ohlcv (symbol, trade_date, open_price, high_price, low_price, close_price, volume, load_timestamp)
    SELECT symbol, trade_date, open_price, high_price, low_price, close_price, volume, SYSUTCDATETIME()
    FROM staging.yahoo_raw_load;
COMMIT;
```

#### Upsert / MERGE (Silver layer)

```sql
-- Idempotent: running twice produces the same result (second run updates with same values)
MERGE silver.daily_signals AS target
USING (
    SELECT symbol, trade_date, momentum_score, value_score, sentiment_score
    FROM bronze.computed_signals
) AS source
ON target.symbol = source.symbol AND target.trade_date = source.trade_date
WHEN MATCHED THEN
    UPDATE SET
        momentum_score = source.momentum_score,
        value_score = source.value_score,
        sentiment_score = source.sentiment_score,
        updated_at = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
    INSERT (symbol, trade_date, momentum_score, value_score, sentiment_score, created_at)
    VALUES (source.symbol, source.trade_date, source.momentum_score, source.value_score,
            source.sentiment_score, SYSUTCDATETIME());
```

#### Delete-insert (fact tables with date partitioning)

```sql
-- Idempotent: deletes today's data first, then inserts fresh
BEGIN TRANSACTION;
    DELETE FROM gold.index_performance
    WHERE trade_date = @target_date AND index_key = @index_key;

    INSERT INTO gold.index_performance (index_key, trade_date, index_value, daily_return, ytd_return, ...)
    SELECT ...computed values...
    FROM silver.daily_ohlcv
    WHERE trade_date = @target_date;
COMMIT;
```

#### Anti-patterns that break idempotency

| Anti-pattern | Why It Breaks | Fix |
|---|---|---|
| `INSERT` without checking for duplicates | Second run creates duplicate rows | Use MERGE or delete-insert |
| Auto-incrementing IDs as business keys | Each run creates new IDs for the same data | Use natural keys (symbol + date) |
| `UPDATE SET counter = counter + 1` | Each run increments again | Use `SET counter = <absolute value>` |
| Reading from a queue without acknowledgment tracking | Retry processes the message again | Use exactly-once semantics or idempotency keys |
| Appending to a file without truncating first | Second run doubles the file size | Truncate or write to a new file with a deterministic name |

## Backfill Strategies: Rewriting History Safely

Every data pipeline will eventually need to backfill — reprocess historical data because a bug was found, a calculation changed, or a new data source was added. Backfills are the most dangerous operation in data engineering because they affect data that downstream consumers have already used.

#### The backfill safety checklist

1. **Scope the impact**: Which tables, date ranges, and downstream consumers are affected?
2. **Communicate before you start**: Notify all consumers that historical data will change
3. **Take a backup**: Snapshot the current state before overwriting
4. **Run in a separate transaction scope**: Don't mix backfill writes with live pipeline writes
5. **Process in date-range chunks**: Don't backfill 3 years in one transaction (lock escalation, memory)
6. **Validate each chunk**: Row counts, checksums, spot-check values against an independent source
7. **Preserve audit trail**: Log what was backfilled, when, why, and by whom

```python
from datetime import date, timedelta
import logging

logger = logging.getLogger("backfill")

def safe_backfill(engine, start_date: date, end_date: date,
                  chunk_days: int = 7, dry_run: bool = True):
    """
    Backfill a date range in chunks, with validation after each chunk.
    Always runs in dry_run mode first.
    """
    current = start_date
    total_rows = 0

    while current <= end_date:
        chunk_end = min(current + timedelta(days=chunk_days - 1), end_date)
        logger.info(f"Processing chunk: {current} to {chunk_end}")

        if dry_run:
            # Count rows that would be affected
            count = engine.execute(
                f"SELECT COUNT(*) FROM gold.index_performance "
                f"WHERE trade_date BETWEEN '{current}' AND '{chunk_end}'"
            ).scalar()
            logger.info(f"  DRY RUN: would affect {count} rows")
        else:
            # Step 1: Backup current data
            engine.execute(f"""
                SELECT * INTO backfill_backup.index_performance_{current.strftime('%Y%m%d')}
                FROM gold.index_performance
                WHERE trade_date BETWEEN '{current}' AND '{chunk_end}'
            """)

            # Step 2: Delete-insert (idempotent)
            with engine.begin() as txn:
                deleted = engine.execute(f"""
                    DELETE FROM gold.index_performance
                    WHERE trade_date BETWEEN '{current}' AND '{chunk_end}'
                """).rowcount

                inserted = engine.execute(f"""
                    INSERT INTO gold.index_performance (...)
                    SELECT ...new calculation...
                    WHERE trade_date BETWEEN '{current}' AND '{chunk_end}'
                """).rowcount

                # Step 3: Validate
                if abs(deleted - inserted) > deleted * 0.05:  # >5% row count change
                    logger.error(f"  Row count mismatch: deleted={deleted}, inserted={inserted}")
                    txn.rollback()
                    raise ValueError("Backfill validation failed — rolled back")

                logger.info(f"  OK: deleted={deleted}, inserted={inserted}")
                total_rows += inserted

        current = chunk_end + timedelta(days=1)

    logger.info(f"Backfill complete: {total_rows} rows processed")
```

### Exactly-Once Processing in Financial Pipelines

In financial data, processing a record twice is as bad as not processing it at all. A dividend reinvested twice inflates the total return index. A [[index-maintenance-and-corporate-actions|corporate action]] applied twice reverses itself (a 1:4 split applied twice becomes a 1:16 split).

**Pattern: Idempotency key tracking**

```sql
-- Create a processing log table
CREATE TABLE pipeline.processing_log (
    idempotency_key NVARCHAR(200) PRIMARY KEY,  -- e.g., 'corp_action_DTE_SPLIT_20260310'
    pipeline_name   NVARCHAR(100) NOT NULL,
    processed_at    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    input_hash      CHAR(64) NOT NULL,  -- SHA-256 of input data
    row_count       INT NOT NULL,
    status          NVARCHAR(20) NOT NULL  -- SUCCESS, FAILED, ROLLED_BACK
);

-- Before processing a corporate action:
IF NOT EXISTS (
    SELECT 1 FROM pipeline.processing_log
    WHERE idempotency_key = 'corp_action_DTE_SPLIT_20260310'
      AND status = 'SUCCESS'
)
BEGIN
    -- Process the corporate action
    BEGIN TRANSACTION;
        -- ... apply split adjustments ...

        INSERT INTO pipeline.processing_log (idempotency_key, pipeline_name, input_hash, row_count, status)
        VALUES ('corp_action_DTE_SPLIT_20260310', 'corporate_actions', @input_hash, @affected_rows, 'SUCCESS');
    COMMIT;
END
ELSE
BEGIN
    PRINT 'Corporate action already processed — skipping (idempotent)';
END
```

## Schema Evolution Without Downtime

Production databases serve live dashboards and APIs. Schema changes must not break running queries.

#### Safe migration patterns

| Change | Safe Approach | Dangerous Approach |
|---|---|---|
| Add a column | `ALTER TABLE ADD column DEFAULT value` | Adding NOT NULL without default |
| Remove a column | Stop writing → deploy code that ignores column → drop column | Dropping while code still reads it |
| Rename a column | Add new column → backfill → deploy code to use new → drop old | Direct rename breaks all queries |
| Change data type | Add new column with new type → migrate data → swap | `ALTER COLUMN` on a large table (long lock) |
| Add an index | `CREATE INDEX ... WITH (ONLINE = ON)` | `CREATE INDEX` without ONLINE (blocks writes) |

#### The expand-and-contract pattern

```
Step 1 (Expand):    Add new column, keep old column
Step 2 (Migrate):   Backfill new column from old column
Step 3 (Dual-write): Application writes to both columns
Step 4 (Cut over):  Application reads from new column only
Step 5 (Contract):  Drop old column after validation period
```

Each step is a separate deployment. If anything goes wrong, you can stop at any step without data loss.

## Serverless and Event-Driven Architecture for Data Pipelines

Batch pipelines scheduled on cron are sufficient for daily index calculations, but real-time data ingestion — price ticks, corporate action announcements, regulatory filings — demands an event-driven architecture. GCP's Pub/Sub + Cloud Functions pattern replaces polling loops with reactive triggers that scale to zero when idle.

#### The event-driven pipeline pattern

```
                          ┌───────────────────────────────────────────┐
  Data Sources            │            GCP EVENT MESH                  │
  ┌──────────┐            │                                            │
  │ Market   │──publish──▶│  Pub/Sub Topic: market-data-raw            │
  │ Feed API │            │    ├── Sub: cloud-function-ingest          │
  └──────────┘            │    │     └──▶ Cloud Function: validate     │
                          │    │          & write to bronze GCS/BQ     │
  ┌──────────┐            │    └── Sub: monitoring-consumer            │
  │ Corporate│──publish──▶│         └──▶ Datadog: track lag metrics    │
  │ Actions  │            │                                            │
  │ Feed     │            │  Pub/Sub Topic: pipeline-stage-complete     │
  └──────────┘            │    └── Sub: trigger-next-stage             │
                          │         └──▶ Cloud Function: run silver    │
  ┌──────────┐            │              transforms when bronze ready  │
  │ News /   │──publish──▶│                                            │
  │ Filings  │            │  Pub/Sub Topic: dead-letter                │
  └──────────┘            │    └── Sub: alert-on-failure               │
                          │         └──▶ Datadog alert + Slack notify  │
                          └───────────────────────────────────────────┘
```

#### Cloud Function as an event-driven ingest worker

```python
# functions/ingest_market_data/main.py
import base64
import json
import functions_framework
from google.cloud import bigquery, storage
from datetime import datetime, timezone

bq_client = bigquery.Client()
gcs_client = storage.Client()

@functions_framework.cloud_event
def handle_event(cloud_event):
    """
    Triggered by Pub/Sub message containing market data.
    Validates, writes to GCS (bronze archive), and inserts into BigQuery.
    """
    message_data = base64.b64decode(cloud_event.data["message"]["data"])
    payload = json.loads(message_data)

    # Validate required fields
    required = ["symbol", "price", "volume", "timestamp"]
    missing = [f for f in required if f not in payload]
    if missing:
        raise ValueError(f"Missing fields: {missing}")

    # Price sanity check — reject clearly invalid ticks
    if payload["price"] <= 0 or payload["price"] > 1_000_000:
        raise ValueError(f"Invalid price: {payload['price']} for {payload['symbol']}")

    # Write to GCS (bronze archive — immutable, partitioned by date)
    trade_date = datetime.fromisoformat(payload["timestamp"]).strftime("%Y-%m-%d")
    blob = gcs_client.bucket("data-pipeline-bronze-archive").blob(
        f"market_data/{trade_date}/{payload['symbol']}_{payload['timestamp']}.json"
    )
    blob.upload_from_string(json.dumps(payload))

    # Insert into BigQuery (bronze table)
    errors = bq_client.insert_rows_json(
        "data-platform-prod.bronze.market_ticks",
        [payload]
    )
    if errors:
        raise RuntimeError(f"BigQuery insert failed: {errors}")
```

#### When to use each pattern

| Pattern | Use When | GCP Services | Latency |
|---|---|---|---|
| **Scheduled batch** (Airflow + cron) | Daily index calculations, EOD reports | Cloud Composer / GCE Airflow | Minutes–hours |
| **Event-driven** (Pub/Sub + Cloud Functions) | Real-time ticks, corporate action alerts | Pub/Sub, Cloud Functions | Seconds |
| **Streaming** (Pub/Sub + Dataflow) | Continuous aggregation, windowed metrics | Pub/Sub, Dataflow (Apache Beam) | Sub-second |
| **Hybrid** (events trigger batch) | Event arrives → enriches → triggers DAG | Pub/Sub → Cloud Function → Airflow API | Seconds + batch |

#### Cost optimization for event-driven pipelines

- Cloud Functions scale to zero — you pay nothing when no events arrive (unlike always-on VMs)
- Set `max_instance_count` to prevent runaway scaling during market data bursts
- Use Pub/Sub message filtering to route only relevant events to each function
- Batch multiple small messages into a single function invocation using Pub/Sub's `max_messages` setting on pull subscriptions

> [!tip] The ICOS Pattern
> A financial index calculation platform's Index Calculation and Operations System combines batch and event-driven patterns. Reconstitution and quarterly reviews are batch (scheduled, deterministic). But intraday corporate action alerts — a surprise merger announcement at 2 PM — trigger an event-driven pipeline: Pub/Sub message → validation function → index analyst notification → manual review → automated recalculation. The architecture must support both modes without one blocking the other.

## Data Contracts: Schema Agreements Between Producers and Consumers

A data contract is a formal agreement between a data producer and its consumers that specifies the schema, semantics, quality guarantees, and SLAs of a data interface. Without data contracts, upstream schema changes silently break downstream pipelines — the #1 source of data incidents in large organizations.

#### Why data contracts matter at scale

```
Without contracts:                    With contracts:
┌──────────┐    silent break    ┌──────────┐    ┌──────────┐    validated    ┌──────────┐
│ Producer │───── column ──────▶│ Consumer │    │ Producer │───── schema ──▶│ Consumer │
│ renames  │     renamed        │ crashes  │    │ proposes │     registry    │ validates│
│ a field  │                    │ at 3 AM  │    │ change   │     checks      │ before   │
└──────────┘                    └──────────┘    └──────────┘     contract    │ accepting│
                                                                             └──────────┘
```

#### Protobuf for data contracts

Protocol Buffers (Protobuf) enforce schema at the serialization level. If a producer adds or removes a field, the Protobuf definition makes it explicit, versioned, and backward-compatible.

```protobuf
// contracts/market_data.proto
syntax = "proto3";
package data-pipeline.market_data;

// v1: initial contract between market data feed and bronze layer
message DailyOHLCV {
  string symbol         = 1;   // ISIN or ticker
  string index_key      = 2;   // e.g., "market_index"
  string trade_date     = 3;   // ISO 8601 date
  double open_price     = 4;
  double high_price     = 5;
  double low_price      = 6;
  double close_price    = 7;
  int64  volume         = 8;
  string currency       = 9;   // ISO 4217

  // Added in v2 — backward compatible (new field, new number)
  double adjusted_close = 10;  // split/dividend adjusted
  string exchange_mic   = 11;  // ISO 10383 Market Identifier Code
}

message CorporateAction {
  string symbol         = 1;
  string action_type    = 2;   // SPLIT, DIVIDEND, MERGER, SPINOFF
  string effective_date = 3;
  double ratio          = 4;   // split ratio (e.g., 4.0 for 1:4 split)
  double amount         = 5;   // dividend amount
  string currency       = 6;
  string description    = 7;
}
```

#### Avro for streaming data contracts (Kafka/Pub/Sub)

```json
{
  "type": "record",
  "name": "DailyOHLCV",
  "namespace": "data-pipeline.market_data",
  "fields": [
    {"name": "symbol",      "type": "string"},
    {"name": "index_key",   "type": "string"},
    {"name": "trade_date",  "type": "string"},
    {"name": "open_price",  "type": "double"},
    {"name": "high_price",  "type": "double"},
    {"name": "low_price",   "type": "double"},
    {"name": "close_price", "type": "double"},
    {"name": "volume",      "type": "long"},
    {"name": "currency",    "type": "string"},
    {"name": "adjusted_close", "type": ["null", "double"], "default": null},
    {"name": "exchange_mic",   "type": ["null", "string"], "default": null}
  ]
}
```

#### Schema Registry — the contract enforcement layer

```python
# Using Confluent Schema Registry (works with Kafka and Pub/Sub via connectors)
from confluent_kafka.schema_registry import SchemaRegistryClient
from confluent_kafka.schema_registry.avro import AvroSerializer

schema_registry = SchemaRegistryClient({"url": "http://schema-registry:8081"})

# Register schema (producer side)
schema_str = open("contracts/daily_ohlcv.avsc").read()
schema_registry.register("daily-ohlcv-value", Schema(schema_str, "AVRO"))

# Compatibility check — rejects breaking changes
# BACKWARD: new schema can read old data (safe to evolve)
# FORWARD: old schema can read new data (consumers don't need immediate update)
# FULL: both backward and forward compatible
schema_registry.set_compatibility("daily-ohlcv-value", "BACKWARD")
```

#### Data contract enforcement in practice

| Level | Enforcement | Tool |
|---|---|---|
| **Serialization** | Message cannot be sent if it doesn't match schema | Protobuf, Avro |
| **Schema Registry** | Schema changes rejected if not backward-compatible | Confluent Schema Registry, GCP Schema Registry |
| **Pipeline validation** | dbt tests validate schema expectations after load | dbt schema tests, Great Expectations |
| **CI/CD** | PR that changes a `.proto` file triggers contract compatibility check | GitHub Actions + `buf lint` + `buf breaking` |

#### Protobuf vs Avro — when to use which

| Aspect | Protobuf | Avro |
|---|---|---|
| Schema location | Separate `.proto` file, compiled | Embedded in data file header |
| Language support | Excellent (gRPC, 10+ languages) | Good (Java/Python-centric) |
| Schema evolution | Field numbers preserve compatibility | Field names preserve compatibility |
| Best for | API contracts, gRPC services, cross-team interfaces | Streaming (Kafka), data files, schema-on-read |
| File size | Smallest | Small (slightly larger than Protobuf) |
| Human readability | No (binary) | Schema is JSON (readable), data is binary |

> [!warning] Contracts are organizational
>
> The hardest part of data contracts is not the Protobuf definition — it is getting agreement from the producing team that they will not change the schema without going through the contract evolution process. This requires management support, documented ownership (RACI matrix), and CI/CD enforcement. A contract without enforcement is just documentation.

## FinOps: Cloud Cost Optimization for Data Platforms

A senior data engineer is often the person closest to the cloud bill — and the person best positioned to reduce it. On a large data platform, BigQuery alone can account for tens of thousands of dollars monthly if left unoptimized. FinOps (Financial Operations) is the practice of making cloud spending visible, accountable, and optimized.

#### BigQuery pricing models — the most consequential choice

| Model | How You Pay | Best For | Risk |
|---|---|---|---|
| **On-demand** | $6.25/TB scanned | Ad hoc queries, low/unpredictable volume | A single `SELECT *` on a 10 TB table costs $62.50 |
| **Standard edition** | $0.04/slot-hour (100 slot minimum) | Steady workloads, predictable scheduling | Pay for idle slots during off-hours |
| **Enterprise edition** | $0.06/slot-hour + features | Multi-region, VPC-SC, CMEK, advanced security | Higher per-slot cost, lower total cost at scale |
| **Enterprise Plus** | $0.10/slot-hour + all features | Mission-critical, sub-second BI queries | Highest cost, highest performance |

#### When to switch from on-demand to reservations

```python
# Calculate the break-even point
on_demand_monthly = avg_tb_scanned_per_month * 6.25  # $/TB
reservation_monthly = num_slots * 0.04 * 24 * 30     # $/slot-hour

# Example: Enterprise pipelines scan ~200 TB/month across all pipelines
on_demand = 200 * 6.25           # = $1,250/month
reservation_100_slots = 100 * 0.04 * 24 * 30  # = $2,880/month — MORE expensive

# But if scans grow to 1,000 TB/month (index recalculation + backtesting):
on_demand = 1000 * 6.25          # = $6,250/month
reservation_100_slots = 2880     # = $2,880/month — saves $3,370/month

# Rule of thumb: switch to reservations when on-demand exceeds ~$3,000/month
```

#### BigQuery cost reduction techniques (immediate impact)

| Technique | Savings | Implementation |
|---|---|---|
| **Partition pruning** | 80-95% | Partition by `trade_date`, always filter on it |
| **Clustering** | 30-60% | Cluster by `index_key, symbol` — reduces bytes scanned |
| **SELECT specific columns** | 50-90% | Never `SELECT *` — columnar storage charges per column |
| **Materialized views** | 70-90% | Pre-compute expensive aggregations, auto-refresh |
| **BI Engine reservation** | Up to 100% | Free cached reads for dashboards hitting the same data |
| **INFORMATION_SCHEMA queries** | 0% cost | Query metadata (table sizes, slot usage) without scanning data |
| **Dry runs** | Prevention | `bq query --dry_run` shows bytes scanned before executing |

```sql
-- Before: costs $62.50 per run (scans 10 TB)
SELECT * FROM bronze.yahoo_ohlcv;

-- After: costs $0.31 per run (scans 50 GB — 200x cheaper)
SELECT symbol, trade_date, close_price, volume
FROM bronze.yahoo_ohlcv
WHERE trade_date BETWEEN '2026-01-01' AND '2026-03-10'
  AND index_key = 'market_index';

-- Monitor: who is running expensive queries?
SELECT
    user_email,
    COUNT(*) AS query_count,
    SUM(total_bytes_billed) / POW(1024, 4) AS tb_billed,
    SUM(total_bytes_billed) / POW(1024, 4) * 6.25 AS estimated_cost_usd
FROM `region-eu`.INFORMATION_SCHEMA.JOBS
WHERE creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
  AND job_type = 'QUERY'
  AND state = 'DONE'
GROUP BY user_email
ORDER BY tb_billed DESC;
```

#### GCP cost optimization beyond BigQuery

| Service | Cost Trap | Fix |
|---|---|---|
| **Cloud Run** | Min instances > 0 keeps containers warm 24/7 | Set min-instances=0 for non-latency-critical pipelines |
| **GCE VMs** | Running 24/7 when only needed during market hours | Scheduled start/stop (Instance Schedule) or preemptible/spot VMs for batch |
| **GCS** | Storing raw data in Standard class forever | Lifecycle policies: Standard → Nearline (30d) → Coldline (90d) → Archive (365d) |
| **Pub/Sub** | High message volume with large payloads | Batch messages, compress payloads, use Pub/Sub Lite for high-volume topics |
| **Cloud Functions** | Long-running functions billed per 100ms | Move functions >5 min to Cloud Run (cheaper per-second billing) |
| **Data Transfer** | Egress charges between regions | Co-locate all services in the same region (europe-west1) |

#### Building a FinOps dashboard

```sql
-- GCP billing export to BigQuery (enabled in Billing → Billing Export)
-- This query shows daily cost by service for the last 30 days
SELECT
    DATE(usage_start_time) AS usage_date,
    service.description AS service,
    SUM(cost) AS daily_cost,
    SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0)) AS credits,
    SUM(cost) + SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0)) AS net_cost
FROM `data-platform-prod.billing_export.gcp_billing_export_v1`
WHERE usage_start_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY usage_date, service
ORDER BY usage_date DESC, net_cost DESC;
```

#### Cost alerting with Terraform

```hcl
# terraform — budget alerts
resource "google_billing_budget" "monthly_budget" {
  billing_account = var.billing_account_id
  display_name    = "the data pipeline project Monthly Budget"

  amount {
    specified_amount {
      currency_code = "USD"
      units         = "5000"
    }
  }

  threshold_rules {
    threshold_percent = 0.5   # Alert at 50%
  }
  threshold_rules {
    threshold_percent = 0.8   # Alert at 80%
  }
  threshold_rules {
    threshold_percent = 1.0   # Alert at 100%
  }

  all_updates_rule {
    pubsub_topic = google_pubsub_topic.budget_alerts.id
  }
}
```

> [!tip] The FinOps Conversation
> When your team's BigQuery bill jumps from $2,000 to $8,000 in a month, management will ask "what happened?" A senior engineer should already have the answer: "The new backtesting pipeline scans 500 TB/month. Switching to 200 reserved slots would bring the cost to $5,760/month and also give us predictable query performance. Here is the ADR." Having the data, the solution, and the tradeoff analysis ready before you are asked is what separates senior from staff.

## Advanced Streaming Patterns: Dataflow, Windowing, and Stream-Table Joins

Batch pipelines calculate index values once per day after market close. But real-time index products — live NAV calculations, intraday risk monitors, and streaming dashboards — require continuous processing of market data ticks joined against slowly-changing reference data. This is where Apache Beam (via Cloud Dataflow) fills the gap between Pub/Sub's messaging and BigQuery's analytics.

#### The streaming pipeline architecture

```
Market Data Feed (WebSocket / FIX protocol)
    │
    ▼
Pub/Sub Topic: raw-market-ticks
    │
    ▼
Cloud Dataflow (Apache Beam pipeline)
    ├── Window: 1-minute tumbling windows
    ├── Stream-Table Join: ticks × index_weights (BigQuery side input)
    ├── Aggregate: compute intraday index value per window
    └── Output:
         ├── Pub/Sub Topic: intraday-index-values (downstream consumers)
         ├── BigQuery: silver.intraday_index_values (analytics)
         └── Bigtable: real-time dashboard reads (sub-ms latency)
```

#### Windowing strategies for financial data

| Window Type | Definition | Financial Use Case |
|---|---|---|
| **Tumbling** (Fixed) | Non-overlapping, fixed-size intervals | 1-minute OHLCV bars, hourly aggregations |
| **Sliding** (Hop) | Overlapping windows (size > hop) | 5-min moving average updated every 1 min |
| **Session** | Gap-based, dynamic size | Group trades by activity bursts (e.g., around earnings announcements) |
| **Global** | Single window for all time | Cumulative daily statistics (reset at market open) |

#### Apache Beam on Dataflow — real-time index calculation pipeline

```python
import apache_beam as beam
from apache_beam.options.pipeline_options import PipelineOptions
from apache_beam.transforms.window import FixedWindows, SlidingWindows
from apache_beam.transforms.trigger import AfterWatermark, AfterProcessingTime, AccumulationMode

def run_streaming_pipeline():
    options = PipelineOptions(
        runner='DataflowRunner',
        project='data-platform-prod',
        region='europe-west1',
        streaming=True,
        job_name='intraday-index-calculator',
        max_num_workers=10,
        autoscaling_algorithm='THROUGHPUT_BASED',
    )

    with beam.Pipeline(options=options) as p:
        # Read market ticks from Pub/Sub
        ticks = (
            p
            | 'ReadTicks' >> beam.io.ReadFromPubSub(
                topic='projects/data-platform-prod/topics/raw-market-ticks',
                timestamp_attribute='event_timestamp'
            )
            | 'ParseJSON' >> beam.Map(parse_tick_json)
        )

        # Apply 1-minute tumbling windows with late data handling
        windowed_ticks = (
            ticks
            | 'Window1Min' >> beam.WindowInto(
                FixedWindows(60),  # 60-second windows
                trigger=AfterWatermark(
                    early=AfterProcessingTime(10),  # emit partial results every 10s
                    late=AfterProcessingTime(30)     # handle late-arriving ticks
                ),
                accumulation_mode=AccumulationMode.ACCUMULATING,
                allowed_lateness=300  # accept ticks up to 5 minutes late
            )
        )

        # Stream-table join: enrich ticks with index weights
        # Side input refreshed every 5 minutes from BigQuery
        weights_side = (
            p
            | 'ReadWeights' >> beam.io.ReadFromBigQuery(
                query='''
                    SELECT symbol, index_key, weight_pct, shares_in_index,
                           free_float_factor, cap_factor
                    FROM gold.constituent_weights
                    WHERE is_current = TRUE
                ''',
                use_standard_sql=True
            )
            | 'KeyWeights' >> beam.Map(lambda row: (row['symbol'], row))
        )

        # Join ticks with weights and compute index contribution
        enriched = (
            windowed_ticks
            | 'KeyBySymbol' >> beam.Map(lambda tick: (tick['symbol'], tick))
            | 'JoinWeights' >> beam.Map(
                enrich_tick_with_weight,
                weights=beam.pvalue.AsDict(weights_side)
            )
        )

        # Aggregate: sum contributions per index per window
        index_values = (
            enriched
            | 'KeyByIndex' >> beam.Map(lambda t: (t['index_key'], t))
            | 'GroupByIndex' >> beam.GroupByKey()
            | 'ComputeIndexValue' >> beam.Map(compute_windowed_index_value)
        )

        # Write results to multiple sinks
        index_values | 'WritePubSub' >> beam.io.WriteToPubSub(
            topic='projects/data-platform-prod/topics/intraday-index-values'
        )
        index_values | 'WriteBQ' >> beam.io.WriteToBigQuery(
            'data-platform-prod:silver.intraday_index_values',
            write_disposition=beam.io.BigQueryDisposition.WRITE_APPEND
        )


def parse_tick_json(message):
    """Parse Pub/Sub message into a tick dict."""
    import json
    tick = json.loads(message)
    return {
        'symbol': tick['symbol'],
        'price': float(tick['price']),
        'volume': int(tick['volume']),
        'index_key': tick.get('index_key', 'unknown'),
        'timestamp': tick['timestamp']
    }


def enrich_tick_with_weight(symbol_tick, weights):
    """Join a market tick with its index weight (stream-table join)."""
    symbol, tick = symbol_tick
    weight = weights.get(symbol, {})
    tick['weight_pct'] = weight.get('weight_pct', 0)
    tick['shares_in_index'] = weight.get('shares_in_index', 0)
    tick['free_float_factor'] = weight.get('free_float_factor', 1.0)
    tick['cap_factor'] = weight.get('cap_factor', 1.0)
    tick['contribution'] = (
        tick['price'] * tick['shares_in_index'] *
        tick['free_float_factor'] * tick['cap_factor']
    )
    return tick


def compute_windowed_index_value(index_ticks):
    """Compute the index value from all constituent contributions in a window."""
    index_key, ticks = index_ticks
    ticks = list(ticks)
    # Use the latest tick per symbol within the window
    latest_by_symbol = {}
    for t in ticks:
        sym = t['symbol']
        if sym not in latest_by_symbol or t['timestamp'] > latest_by_symbol[sym]['timestamp']:
            latest_by_symbol[sym] = t

    total_contribution = sum(t['contribution'] for t in latest_by_symbol.values())
    # divisor would be fetched from reference data in production
    return {
        'index_key': index_key,
        'constituent_count': len(latest_by_symbol),
        'total_contribution': total_contribution,
        'window_timestamp': max(t['timestamp'] for t in latest_by_symbol.values())
    }
```

#### Late data and watermarks — the streaming reliability challenge

In financial markets, data arrives late for multiple reasons: exchange feed delays, network congestion, retry queues, and cross-region replication lag. A streaming pipeline must handle late data without either dropping it (incorrect) or waiting forever (high latency).

```
Event Time:     |---Window 1 (10:00-10:01)---|---Window 2 (10:01-10:02)---|
                                              ↑ watermark
Processing Time: ─────────────────────────────┼────────────────────────────
                                              │
                    ● tick A (on time)         │  ● tick C (on time)
                         ● tick B (late - arrived during window 2,
                                    but belongs to window 1)
```

| Strategy | Behavior | Tradeoff |
|---|---|---|
| **Drop late data** | Fastest, simplest | Index value may be slightly wrong during high-latency periods |
| **Accumulating** | Re-emit corrected result when late data arrives | Downstream must handle updates/corrections |
| **Retracting** | Emit retraction of old result + new corrected result | Most correct, most complex for consumers |

**For financial index calculation:** Use **accumulating mode** with a 5-minute allowed lateness. The intraday value is approximate anyway — end-of-day official values are always recalculated from the full batch pipeline.

> [!tip] Batch vs streaming hybrid
>
> The "lambda architecture" (run both batch and streaming in parallel) has fallen out of favor because maintaining two codepaths is expensive. The "kappa architecture" (streaming only, replay when needed) is theoretically cleaner but operationally harder. In practice, financial index platforms and similar firms use a **pragmatic hybrid**: streaming for intraday approximations, batch for official end-of-day values. The batch pipeline is the system of record. The streaming pipeline is a best-effort preview. Never let a streaming pipeline produce the official index value — that requires the determinism and auditability that only batch processing guarantees.

## Related

- [[index-maintenance-and-corporate-actions]] — Financial index domain, corporate actions, PIT temporal data
- [ai-augmented-data-engineering](/16-AI-and-Prompts/LLM-Pipelines/ai-augmented-data-engineering) — LLM pipelines that complement these data architecture patterns
- [leadership-and-collaboration](/15-DataOps/leadership-and-collaboration) — Data contracts, ADRs, technical debt management, and incident response

## References

- Apache Beam documentation: https://beam.apache.org/documentation/
- Confluent Schema Registry: https://docs.confluent.io/platform/current/schema-registry/index.html
- GCP Pub/Sub documentation: https://cloud.google.com/pubsub/docs
- BigQuery pricing: https://cloud.google.com/bigquery/pricing
- Flyway database migrations: https://flywaydb.org/documentation/
