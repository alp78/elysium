---
type: concept
category: data-architecture
technology: [sql-server, python, airflow]
tags: [data-architecture, architecture, pipeline, python, sql, airflow]
aliases: [idempotent pipelines, idempotency, idempotent loads, safe re-runs, replayable pipelines]
keywords: [idempotent, idempotency, safe re-run, replay, backfill, data pipeline, atomic load, upsert, MERGE, delete-insert, truncate-reload, exactly-once, at-least-once]
description: "Idempotent pipeline design ensures running a pipeline multiple times with the same input produces the same result without duplicates or corruption — the foundation of reliable data engineering."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Idempotent Pipeline Design

> [!quote]
> "Simplicity is a prerequisite for reliability."
> — **Edsger W. Dijkstra**

An idempotent pipeline produces the same result whether it runs once or ten times with the same input. This is the single most important property of any production data pipeline — it makes re-runs safe, backfills reliable, and incident recovery straightforward.

> [!info] Formal Definition
>
> A function f is idempotent if f(f(x)) = f(x) — applying it twice
> produces the same result as applying it once. For pipelines: running
> the same pipeline with the same input data, any number of times,
> produces the same output rows in the target table. No duplicates,
> no missing rows, no corrupted state.

### Why Idempotent Pipeline Design Matters

Without idempotency, every pipeline failure becomes a crisis:
- **Re-running** a failed load creates duplicate rows
- **Backfilling** historical data corrupts existing records
- **Retrying** after a timeout inserts partial + duplicate data
- **Testing** in production is impossible without risking data corruption

With idempotency, you can re-run any step at any time with confidence.

## Core Patterns

### DELETE-INSERT (Partition Swap)

Delete all data for the target partition, then insert fresh data. The partition key (usually a date) scopes the delete. The [bronze-layer-loading](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/bronze-layer-loading) module uses this exact pattern to reload daily partitions safely.

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

> [!danger] DELETE-INSERT with Foreign Keys
>
> If gold tables have foreign keys referencing silver, a DELETE-INSERT
> on silver cascades the DELETE to gold — destroying gold data. Either
> drop FKs before the load (re-create after), disable the FK constraint
> temporarily (`ALTER TABLE NOCHECK CONSTRAINT`), or use MERGE instead
> of DELETE-INSERT when FK relationships exist.

### MERGE (Upsert)

Match on a business key. Update if exists, insert if new. See [merge-and-upsert](https://alp78.github.io/elysium/04-SQL-Server/T-SQL/merge-and-upsert) for the full T-SQL MERGE pattern. In dbt, the [incremental materialization](https://alp78.github.io/elysium/11-dbt/Modeling/dbt-materializations) generates a MERGE statement under the hood, providing idempotency declaratively.

```sql
MERGE INTO silver.index_dim AS target
USING bronze.raw_index_data AS source
ON target.index_code = source.index_code
WHEN MATCHED THEN UPDATE SET target.display_name = source.display_name
WHEN NOT MATCHED THEN INSERT (index_code, display_name) VALUES (source.index_code, source.display_name);
```

> [!danger] MERGE Without a Partition Filter Can Full-Scan the Target Table
> A `MERGE INTO silver.index_dim` without a `WHERE` clause on the source CTE scans every row in both the source and target. On a 100M-row table, this turns a 2-second incremental load into a 30-minute full scan. Always scope the MERGE source to the current partition (e.g., `WHERE trade_date = @trade_date`) and ensure the target has a matching index on the join key.

> [!warning] Idempotency Is Not Exactly-Once
>
> Idempotency means "safe to re-run." Exactly-once means "processed
> exactly one time." A MERGE upsert is idempotent (re-running produces
> the same result) but executes MORE than once on retry. In streaming
> systems (Pub/Sub, Kafka), exactly-once requires deduplication at the
> consumer — the message may be DELIVERED multiple times but must be
> PROCESSED only once. Idempotent writes make exactly-once achievable:
> if the write is idempotent, duplicate deliveries don't corrupt state.

### Staging Table Pattern

Load into a staging table first, then atomic swap into the target:

1. TRUNCATE staging table
2. Bulk load new data into staging
3. BEGIN TRANSACTION
4. DELETE target partition
5. INSERT INTO target SELECT FROM staging
6. COMMIT

This isolates the slow I/O (bulk load) from the fast atomic swap.

> [!warning] TRUNCATE Cannot Be Rolled Back Inside a Transaction in SQL Server
> `TRUNCATE TABLE` is minimally logged and cannot be wrapped in an explicit transaction for rollback purposes in all isolation levels. If the INSERT after TRUNCATE fails, the staging table is empty with no recovery path. Use `DELETE FROM staging` (which is transactional) instead of TRUNCATE when the staging table participates in a multi-statement transaction, or accept that TRUNCATE on the staging table is safe because staging is always repopulated.

### Idempotency Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| INSERT without duplicate check | Re-run creates duplicate rows | Use MERGE or DELETE-INSERT |
| No transaction around multi-step load | Partial failure leaves inconsistent state | Wrap in explicit transaction |
| Using IDENTITY columns as business keys | Cannot match records across re-runs | Use natural business keys for matching |
| Appending timestamps without dedup | Same data with different load timestamps | Deduplicate on business key before insert |

> [!tip] Related pattern
> Without idempotency, concurrent pipeline runs can trigger [race-conditions](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/race-conditions) — two instances inserting the same partition simultaneously, producing duplicates or deadlocks. Idempotent designs eliminate this class of failure by making the outcome independent of execution order.

## Related

- [error-handling-and-retry-patterns](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/error-handling-and-retry-patterns) — Idempotency is a prerequisite for safe retries — the error handling framework depends on it
- [medallion-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/medallion-architecture) — The bronze/silver/gold pattern relies on idempotent transforms at each layer
- [merge-and-upsert](https://alp78.github.io/elysium/04-SQL-Server/T-SQL/merge-and-upsert) — T-SQL MERGE statement for upsert operations
- [silver-transforms](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/silver-transforms) — Silver layer cleaning and deduplication patterns
- [five-pillars-of-data-engineering](https://alp78.github.io/elysium/14-Data-Architecture/five-pillars-of-data-engineering) — Idempotency is the foundation of Pillar 1 (Reliability)
