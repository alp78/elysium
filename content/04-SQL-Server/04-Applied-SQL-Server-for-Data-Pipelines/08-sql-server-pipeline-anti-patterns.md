---
title: "08 - SQL Server Pipeline Anti-Patterns"
tags:
  - sql-server
  - tsql
  - data-engineering
  - patterns
  - anti-patterns
  - performance
  - data-quality
aliases: [Anti-Patterns, Pipeline Mistakes, SQL Server Gotchas, Common Mistakes]
description: "Production checklist of SQL Server pipeline anti-patterns, with live sanity checks from `stoxx` and links to the canonical deep-dive notes."
parent: "[[domain-applied-sql-server-pipelines]]"
links:
  - "[[01-sql-server-loading-patterns]]"
  - "[[05-sql-server-schema-layering]]"
  - "[[10-sql-server-change-tracking]]"
  - "[[05-sql-server-incremental-transforms]]"
  - "[[02-bronze-layer-loading]]"
  - "[[03-silver-transforms]]"
  - "[[04-gold-transforms]]"
created: 2026-03-29
updated: 2026-04-08
status: complete
---

# SQL Server Pipeline Anti-Patterns

This page is a production checklist of failure modes that repeatedly show up in SQL Server data pipelines. It does not try to be the deepest execution-plan or loading tutorial. Instead, it focuses on the mistakes that cause incidents, corruption, blocking, or avoidable performance collapse, and it points to the canonical note when a full lab or deeper walkthrough already exists elsewhere in the vault.

---

## Live Sanity Checks

Before diagnosing anti-patterns in the abstract, verify the basic protections the current database already has or lacks.

### Verify schema separation exists

#### Count user tables by core pipeline schema

> [!info]-
> This query counts user tables in the four most relevant schemas for pipeline design.
>
> - `sys.tables` returns user tables.
> - `sys.schemas` maps tables to schemas.
> - Restricting to `bronze`, `silver`, `gold`, and `dbo` shows whether the environment is organized by layer or whether everything is collapsing into the default schema.
>
> *This query counts user tables by schema so the reader can immediately see whether layer isolation exists or whether `dbo` is absorbing most of the workload.*
>
```sql
SELECT s.name AS schema_name,
       COUNT(*) AS table_count
FROM sys.tables AS t
JOIN sys.schemas AS s
    ON s.schema_id = t.schema_id
WHERE s.name IN ('bronze', 'silver', 'gold', 'dbo')
GROUP BY s.name
ORDER BY s.name;
```

| schema_name | table_count |
|---|---:|
| `bronze` | 12 |
| `dbo` | 19 |
| `gold` | 3 |
| `silver` | 7 |

_`stoxx` does have explicit bronze, silver, and gold schemas, which is the correct architectural direction. The presence of many `dbo` tables means you still need discipline: demo or helper tables often drift there first, and production tables should not follow them._

### Verify bronze metadata columns exist

#### Inspect which bronze tables currently carry `_index` and `_ingested_at`

> [!info]-
> This query inspects whether bronze tables expose the minimum metadata fields needed to trace batch origin and freshness.
>
> - `INFORMATION_SCHEMA.COLUMNS` is used because the goal is schema readability, not low-level storage metadata.
> - Filtering to `_index` and `_ingested_at` surfaces whether bronze tables can be scoped by business slice and traced by load time.
> - `STRING_AGG` condenses the metadata presence into one row per table.
>
> *This query shows which bronze tables already include the key operational metadata columns `_index` and `_ingested_at`.*
>
```sql
SELECT TABLE_SCHEMA,
       TABLE_NAME,
       STRING_AGG(COLUMN_NAME, ', ') WITHIN GROUP (ORDER BY ORDINAL_POSITION) AS metadata_columns
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'bronze'
  AND COLUMN_NAME IN ('_ingested_at', '_index')
GROUP BY TABLE_SCHEMA, TABLE_NAME
ORDER BY TABLE_NAME;
```

| TABLE_SCHEMA | TABLE_NAME | metadata_columns |
|---|---|---|
| `bronze` | `eurostoxx50_ohlcv` | `_ingested_at` |
| `bronze` | `index_dim` | `_index, _ingested_at` |
| `bronze` | `oil20_ohlcv` | `_ingested_at` |
| `bronze` | `pulse` | `_index, _ingested_at` |
| `bronze` | `pulse_tickers` | `_index, _ingested_at` |
| `bronze` | `signals_daily` | `_index, _ingested_at` |
| `bronze` | `signals_quarterly` | `_index, _ingested_at` |
| `bronze` | `stoxxasia50_ohlcv` | `_ingested_at` |
| `bronze` | `stoxxusa50_ohlcv` | `_ingested_at` |

_This is a healthy sign. The core bronze tables already carry load-time metadata, and most business-sliced tables also carry `_index`. That makes the "missing metadata columns" anti-pattern a known rule, not just a theory, in this environment._

### Verify SCD2 protection exists where history is intended

#### Inspect the filtered unique index on `silver.index_dim`

> [!info]-
> This query inspects the index set on the live dimension table and checks whether the current-row uniqueness rule is enforced correctly.
>
> - `is_unique` tells you whether duplicates are blocked.
> - `filter_definition` is the key field: SCD2 protection depends on the unique index applying only to active rows.
>
> *This query verifies whether the live dimension table has the filtered unique index that prevents duplicate current rows.*
>
```sql
SELECT OBJECT_SCHEMA_NAME(i.object_id) AS schema_name,
       OBJECT_NAME(i.object_id) AS table_name,
       i.name AS index_name,
       i.is_unique,
       i.filter_definition
FROM sys.indexes AS i
WHERE i.object_id = OBJECT_ID('silver.index_dim')
ORDER BY i.index_id;
```

| schema_name | table_name | index_name | is_unique | filter_definition |
|---|---|---|---:|---|
| `silver` | `index_dim` | `PK__index_di__3213E83F590AA69E` | 1 | `NULL` |
| `silver` | `index_dim` | `UX_silver_index_dim_current` | 1 | `([is_current]=(1))` |

_The filtered unique index is present, which is exactly what prevents the "multiple current rows for one business key" SCD2 anti-pattern. If that second index were missing, history logic could silently corrupt the dimension._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `is_unique` | `1` | &#9989; | Duplicate key values are blocked within the index scope. | Required for dependable SCD2 enforcement. |
| `is_unique` | `0` | &#10060; | Duplicate key values are allowed. | Duplicate current rows can survive unnoticed. |
| `filter_definition` | `([is_current]=(1))` | &#9989; | Only current rows participate in uniqueness. | Historical versions remain legal while active duplicates are blocked. |
| `filter_definition` | `NULL` on the business-key index | &#10060; | The index is not filtered. | Either history inserts fail or current-row duplication is not constrained properly. |

---

## Loading Anti-Patterns

These mistakes corrupt state before the transformation layer even starts.

### Row-by-row client inserts for large batches

This is still one of the most common self-inflicted performance failures. A client loop that sends one statement per row turns a batch load into an OLTP chatty workload.

```python
for row in rows:
    cursor.execute(
        "INSERT INTO bronze.signals_daily (_index, symbol, [timestamp], current_price) VALUES (?, ?, ?, ?)",
        row,
    )
```

Use batched interfaces such as `fast_executemany`, `SqlBulkCopy`, `bcp`, or `BULK INSERT` instead. The canonical guidance is in [[01-sql-server-loading-patterns]].

### Loading directly into the published table

This removes the validation gate. If a file is malformed, the published table becomes the first place you discover it.

Use a stage table, validate row count and business keys there, then publish. The reproducible pattern is in [[01-sql-server-loading-patterns]].

### Multi-step loads with no explicit transaction

> [!danger]
> `DELETE` followed by `INSERT` without an explicit transaction is a partial-state anti-pattern. If the process dies after the delete, the target is empty or incomplete.
>
> [!success]
> Wrap multi-step refresh logic in one transaction so the target only moves from one valid state to the next valid state.
>
> [!info]-
> This pair of snippets contrasts the unsafe pattern with the safe transactional version.
>
> *These snippets show why a multi-step load must be wrapped in one explicit transaction.*
>
```sql
DELETE FROM silver.signals_daily
WHERE _index = @key;

INSERT INTO silver.signals_daily (...)
SELECT ...
FROM bronze.signals_daily;
```

```sql
BEGIN TRAN;

DELETE FROM silver.signals_daily
WHERE _index = @key;

INSERT INTO silver.signals_daily (...)
SELECT ...
FROM bronze.signals_daily;

COMMIT;
```

### Using `IDENTITY` as a cross-system business key

`IDENTITY` is stable only inside one database lifecycle. It can reset on truncate, diverge across environments, and contain gaps after rollbacks. It is appropriate as an internal surrogate key, not as an externally meaningful business identifier.

---

## Schema And Modeling Anti-Patterns

These mistakes make pipelines hard to secure, hard to debug, and expensive to change.

### Everything in `dbo`

If raw, transformed, and published tables all live in `dbo`, schema-level permissions and lifecycle boundaries collapse. Naming prefixes are not a substitute for real schema separation.

`stoxx` already demonstrates the correct direction with `bronze`, `silver`, and `gold`. Preserve that pattern and avoid letting production tables drift back into `dbo`.

### Missing metadata columns in bronze

Without `_ingested_at`, freshness becomes guesswork. Without a slice key such as `_index`, scoped reloads and traceability become harder.

The live bronze tables already show why this matters: most of them expose `_ingested_at`, and several also expose `_index`. Preserve that contract for every new raw landing table.

### No control-table or run-ledger layer

Pipelines that store watermarks, retry state, run status, and quality events ad hoc in `dbo` or not at all eventually lose the ability to answer basic operational questions:

- what was the last successful watermark
- which run published the current table state
- was a row-count anomaly detected and accepted or ignored

Use a dedicated `meta` or `control` schema for pipeline state instead of scattering control-plane tables through business schemas or job code.

### Automatic schema evolution with no review gate

Blindly allowing additive or type-changing schema drift may keep ingestion alive, but it pushes the breakage downstream where it is harder to diagnose. Reports, dbt models, ETL inserts, and typed applications can all fail after the raw load "succeeds".

The safe pattern is schema enforcement plus an explicit review path:

- capture the change
- classify it as additive, compatible, or breaking
- approve the downstream contract update deliberately
- only then publish the new shape beyond the landing edge

### `VARCHAR(MAX)` by default

Unbounded string declarations increase storage uncertainty, loader memory pressure, and index awkwardness. Use realistic maximum widths until the data proves otherwise.

---

## Query And Performance Anti-Patterns

These are the query-shape mistakes that quietly turn ETL jobs into scans, spills, and blocking chains.

### `SELECT *` in ETL

This couples the pipeline to every future schema change. A new source column can break the insert shape or silently misalign data if the target statement is also sloppy.

Always list columns explicitly in both `SELECT` and `INSERT`.

### Implicit type conversions in predicates

If SQL Server has to convert the column rather than the literal or parameter, the index becomes far less useful and the query can fall back to a scan.

Use the exact target types in parameters and predicates. The full plan-level demonstration lives in [[12-execution-plans]] and [[11-sargable-queries]].

### `NOLOCK` as a pipeline fix

`NOLOCK` does not solve contention safely. It allows dirty reads and unstable results, which is the exact opposite of what a pipeline needs.

If readers block writers or writers block readers, solve the isolation design. Do not solve it by making the data unreliable.

### Window functions without ordering support

Window functions are not inherently bad. The anti-pattern is running them on large tables that cannot deliver rows in the required `PARTITION BY` and `ORDER BY` order. Then SQL Server sorts, asks for memory, and may spill to TempDB.

Check the supporting index before scaling the query. The live example is in [[05-sql-server-incremental-transforms]].

### Table variables for large ETL intermediates

Table variables and TVPs are useful tools, but they do not carry the same statistics behavior as well-indexed temp tables. For large ETL intermediates, that often leads to poor cardinality estimates, bad join choices, and unstable memory grants.

Use temp tables for large intermediate sets that need indexing, statistics, or repeated joins. Keep table variables and TVPs for genuinely small, scoped rowsets.

---

## History And Change-Capture Anti-Patterns

These mistakes destroy traceability or corrupt version chains.

### Overwriting history in place

If the business needs historical truth, a plain update destroys it. Use manual SCD2, temporal tables, CDC, or an external snapshot pattern instead of pretending the latest row is enough.

### SCD2 with no filtered unique index

If a dimension tracks history but does not enforce one active row per business key, duplicate current rows can slip in during retries, race conditions, or buggy close-plus-insert logic.

`silver.index_dim` currently avoids this anti-pattern with `UX_silver_index_dim_current`.

### Comparing nullable columns naïvely

`NULL` does not compare like an ordinary value. Change detection that ignores nullable semantics misses real changes or creates false ones.

Normalize nullable comparisons explicitly or use null-safe comparison features available in the engine version you run.

### Comparing floating-point values with raw equality

Binary floating-point representation makes exact equality a poor change detector for business attributes. Use fixed-precision numeric types when possible, or compare within an epsilon band when floats are unavoidable.

### Using `rowversion` as business time

`rowversion` is a technical version stamp, not an event timestamp and not a business-valid-from date. Treating it as chronology or using it as a durable business key creates confusing history semantics and brittle downstream logic.

Use `rowversion` only as a technical delta token, and keep real business time in explicit date or datetime columns.

---

## Concurrency And Operations Anti-Patterns

These mistakes do not always show up in unit tests, but they show up under real workload pressure.

### Long-running write transactions during the business day

Large write scopes extend lock lifetimes and magnify blocking. Break work into smaller committed units or schedule the heavy path away from the hottest concurrency window.

### Blind `MERGE`

`MERGE` is not automatically wrong, but it is frequently used as if it were a magic upsert shortcut. Without a clean key, careful semantics, and concurrency testing, it becomes a bug magnet.

For ETL workloads, explicit `UPDATE` plus `INSERT` is usually easier to reason about.

### No retry logic for transient deadlocks

Deadlocks are not always proof of broken logic; sometimes they are transient concurrency collisions. A pipeline with zero retry policy turns a recoverable event into an avoidable job failure.

Retries do not replace real deadlock analysis, but production jobs should distinguish transient failure from hard data failure.

---

## Current Recommendation For `stoxx`

The current `stoxx` environment supports a strong baseline:

- keep enforcing layer separation with `bronze`, `silver`, and `gold`
- introduce a dedicated control-plane schema when the platform needs durable run state, watermarks, or schema-governance tables
- keep requiring metadata columns on bronze landing tables
- gate schema evolution explicitly instead of letting raw-landed changes leak downstream by accident
- keep protecting historical dimensions with filtered unique indexes when SCD2 is used
- keep loading through staged or transactional patterns rather than direct publish writes
- keep large ETL intermediates on temp-table patterns instead of defaulting to table variables
- keep detailed plan and loading investigations in the canonical notes instead of duplicating ad hoc fixes here

Use this page as the checklist. Use the companion notes for the full reproduction:

- [[01-sql-server-loading-patterns]]
- [[05-sql-server-incremental-transforms]]
- [[10-sql-server-change-tracking]]
- [[05-sql-server-schema-layering]]
- [[12-execution-plans]]

---

## Related

- [[01-sql-server-loading-patterns]]
- [[05-sql-server-incremental-transforms]]
- [[10-sql-server-change-tracking]]
- [[05-sql-server-schema-layering]]
- [[02-bronze-layer-loading]]
- [[03-silver-transforms]]
- [[04-gold-transforms]]

## References

- Microsoft Learn: [Table hints (Transact-SQL)](https://learn.microsoft.com/en-us/sql/t-sql/queries/hints-transact-sql-table)
- Microsoft Learn: [Create filtered indexes](https://learn.microsoft.com/en-us/sql/relational-databases/indexes/create-filtered-indexes)
- Microsoft Learn: [rowversion (Transact-SQL)](https://learn.microsoft.com/en-us/sql/t-sql/data-types/rowversion-transact-sql)
- ChromaDB supporting context:
  - `The Data Warehouse Toolkit.epub`
  - `Fundamentals of Data Engineering.epub`
  - `Data Engineering Design Patterns.pdf`
  - `Expert Performance Indexing in Azure SQL and SQL Server 2022, Fourth Edition Toward Faster Results and Lower Maintenance Both….pdf`

