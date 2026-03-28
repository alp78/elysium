---
type: concept
category: data-architecture
technology: [sql-server, python, airflow]
tags: [architecture, pipeline, python, sql, airflow]
aliases: [idempotent pipelines, idempotency, idempotent loads, safe re-runs, replayable pipelines]
keywords: [idempotent, idempotency, safe re-run, replay, backfill, data pipeline, atomic load, upsert, MERGE, delete-insert, truncate-reload, exactly-once, at-least-once]
description: "Idempotent pipeline design ensures running a pipeline multiple times with the same input produces the same result without duplicates or corruption — the foundation of reliable data engineering."
related:
  - "[[medallion-architecture]]"
  - "[[merge-and-upsert]]"
  - "[[silver-transforms]]"
  - "[[five-pillars-of-data-engineering]]"
  - "[[backup-types-and-strategy]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Idempotent Pipeline Design

An idempotent pipeline produces the same result whether it runs once or ten times with the same input. This is the single most important property of any production data pipeline — it makes re-runs safe, backfills reliable, and incident recovery straightforward.

## Why It Matters

Without idempotency, every pipeline failure becomes a crisis:
- **Re-running** a failed load creates duplicate rows
- **Backfilling** historical data corrupts existing records
- **Retrying** after a timeout inserts partial + duplicate data
- **Testing** in production is impossible without risking data corruption

With idempotency, you can re-run any step at any time with confidence.

## Core Patterns

### DELETE-INSERT (Partition Swap)

Delete all data for the target partition, then insert fresh data. The partition key (usually a date) scopes the delete. The [[bronze-layer-loading]] module uses this exact pattern to reload daily partitions safely.

```sql
-- Idempotent daily load: delete today's data, then re-insert
BEGIN TRANSACTION;
DELETE FROM silver.daily_prices WHERE trade_date = @trade_date;
INSERT INTO silver.daily_prices (trade_date, ticker, close_price, volume)
SELECT trade_date, ticker, close_price, volume
FROM bronze.raw_prices
WHERE trade_date = @trade_date;
COMMIT;
```

> [!tip] Why DELETE-INSERT over TRUNCATE
> DELETE with a WHERE clause is partition-scoped — it only affects the target date. TRUNCATE removes ALL data and cannot be rolled back inside a transaction. Use TRUNCATE only for full-reload patterns on small tables.

### MERGE (Upsert)

Match on a business key. Update if exists, insert if new. See [[merge-and-upsert]] for the full T-SQL MERGE pattern. In dbt, the [[dbt-materializations|incremental materialization]] generates a MERGE statement under the hood, providing idempotency declaratively.

```sql
MERGE INTO silver.index_dim AS target
USING bronze.raw_index_data AS source
ON target.index_code = source.index_code
WHEN MATCHED THEN UPDATE SET target.display_name = source.display_name
WHEN NOT MATCHED THEN INSERT (index_code, display_name) VALUES (source.index_code, source.display_name);
```

### Staging Table Pattern

Load into a staging table first, then atomic swap into the target:

1. TRUNCATE staging table
2. Bulk load new data into staging
3. BEGIN TRANSACTION
4. DELETE target partition
5. INSERT INTO target SELECT FROM staging
6. COMMIT

This isolates the slow I/O (bulk load) from the fast atomic swap.

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| INSERT without duplicate check | Re-run creates duplicate rows | Use MERGE or DELETE-INSERT |
| No transaction around multi-step load | Partial failure leaves inconsistent state | Wrap in explicit transaction |
| Using IDENTITY columns as business keys | Cannot match records across re-runs | Use natural business keys for matching |
| Appending timestamps without dedup | Same data with different load timestamps | Deduplicate on business key before insert |

> [!tip] Related pattern
> Without idempotency, concurrent pipeline runs can trigger [[race-conditions]] — two instances inserting the same partition simultaneously, producing duplicates or deadlocks. Idempotent designs eliminate this class of failure by making the outcome independent of execution order.

## Related

- [[medallion-architecture]] — The bronze/silver/gold pattern relies on idempotent transforms at each layer
- [[merge-and-upsert]] — T-SQL MERGE statement for upsert operations
- [[silver-transforms]] — Silver layer cleaning and deduplication patterns
- [[five-pillars-of-data-engineering]] — Idempotency is the foundation of Pillar 1 (Reliability)
