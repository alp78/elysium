---
title: "SQL Server Change Tracking"
type: reference
category: data-engineering
technology: [sql-server]
tags:
  - sql-server
  - tsql
  - data-engineering
  - patterns
  - scd
  - change-tracking
  - cdc
  - temporal-tables
aliases: [Change Tracking, SCD2 SQL Server, Temporal Tables, CDC, Change Data Capture, Slowly Changing Dimensions]
keywords: [change tracking, SCD Type 2, temporal tables, SYSTEM_VERSIONING, CDC, change data capture, change tracking CT, triggers, dbt snapshots, valid_from, valid_to, is_current, filtered unique index, history table, FOR SYSTEM_TIME, audit trail, data history, slowly changing dimension]
description: "Every method SQL Server offers for tracking data changes over time — manual SCD2, temporal tables, CDC, Change Tracking, dbt snapshots — with a decision matrix and side-by-side comparisons."
created: 2026-03-29
updated: 2026-03-29
status: complete
---

# SQL Server Change Tracking — Capturing Data History

> [!quote]
> "Without a reliable history of what changed and when, you cannot debug a data pipeline, satisfy an auditor, or recover from a bad load."
> — **Ralph Kimball**, *The Data Warehouse Toolkit*

"How do I know what changed?" is the most common question in data engineering. SQL Server has five built-in answers and two external ones. Most teams use the wrong one. For SCD type definitions (Types 1-6), see [data-warehouse-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/data-warehouse-architecture). For dbt's declarative approach, see [dbt-snapshots-and-scd](https://alp78.github.io/elysium/11-dbt/Advanced/dbt-snapshots-and-scd).

---

## Decision Matrix

### Change Tracking Methods — when to use each

> [!info] Method Comparison
>
> Choose based on what you need to capture (keys only vs full row history), who owns the logic (DB engine vs application), and performance tolerance.

| Method | Tracks What | Granularity | Perf Cost | Complexity | Best For |
|--------|-------------|-------------|-----------|------------|----------|
| Manual SCD2 | Attribute changes | Row-level | Low (you control it) | Medium | Custom history requirements |
| Temporal Tables | All column changes | Row-level | Low-Medium | Low | Full audit trail, regulatory |
| CDC | INSERT/UPDATE/DELETE | Row-level | Medium (log reader) | Medium | Streaming, Kafka/Debezium |
| Change Tracking (CT) | Which rows changed | Keys only | Low | Low | Sync scenarios, "what's new?" |
| Triggers | Any DML event | Row-level | High (per-statement) | High | Legacy — avoid in new systems |
| dbt Snapshots | Attribute changes | Row-level | Varies | Low | dbt-managed pipelines |
| Application-level | Whatever you log | Custom | None on DB | High | When DB-level isn't possible |

---

## Manual SCD Type 2

The classic pattern for tracking dimension attribute changes. You control the detection logic, the temporal columns, and the close/insert flow.

### SCD2 Schema — valid_from, valid_to, is_current

> [!info] SCD2 Column Pattern
>
> `valid_to = NULL` means the row is still current. `is_current = 1` is a redundant but useful flag for simpler queries. The filtered unique index enforces one active row per key.

```sql
CREATE TABLE silver.index_dim (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    _index      VARCHAR(20)  NOT NULL,
    symbol      VARCHAR(20)  NOT NULL,
    sector      NVARCHAR(100),
    -- ... other attribute columns ...

    valid_from  DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME(),
    valid_to    DATETIME2    NULL,          -- NULL = still current
    is_current  BIT          NOT NULL DEFAULT 1
);
GO

-- Filtered unique index: one active row per (_index, symbol)
CREATE UNIQUE INDEX UX_dim_current
    ON silver.index_dim (_index, symbol)
    WHERE is_current = 1;
```

### SCD2 Three-Step Process — detect, close, insert

> [!info] SCD2 Flow
>
> Compare source snapshot against active dimension rows. Close changed rows, insert new versions. All three steps must run in a single transaction to prevent inconsistent state.

```sql
-- Step 1: Detect change (Python or SQL comparison)
-- Compare each attribute: sector, name, country, etc.

-- Step 2: Close the old row
UPDATE silver.index_dim
SET valid_to = SYSUTCDATETIME(),
    is_current = 0
WHERE _index = @key AND symbol = @sym
  AND is_current = 1;

-- Step 3: Insert the new version
INSERT INTO silver.index_dim (
    _index, symbol, sector, ...
    -- valid_from defaults to SYSUTCDATETIME(), is_current defaults to 1
) VALUES (@key, @sym, @new_sector, ...);
```

### SCD2 Edge Cases

> [!warning] SCD2 Gotchas
>
> These edge cases cause silent data corruption if not handled. Each one has been seen in production pipelines.

- **Same-day changes:** if two changes happen on the same day, `valid_from` collides. Use `DATETIME2` (not `DATE`) for sub-second precision
- **Retroactive corrections:** source sends a correction for a past date. Decide upfront: close and reopen the chain, or update the current row in place (Type 1)
- **NULL comparison:** `NULL != NULL` in SQL Server. Comparing NULLable columns requires `ISNULL(a, sentinel) = ISNULL(b, sentinel)` or `IS NOT DISTINCT FROM` (SQL Server 2022+)
- **Forgetting the filtered index:** without `WHERE is_current = 1`, the unique index prevents inserting a new version because the old `(_index, symbol)` pair still exists
- **Float comparison:** `3.14 <> 3.14000000001` — never compare floats for change detection. Round to a fixed precision or use `ABS(a - b) < epsilon`

---

## SQL Server Temporal Tables (SYSTEM_VERSIONING)

Native SCD2 built into the engine. SQL Server automatically maintains a history table and supports time-travel queries. Available in SQL Server 2016+.

### Temporal Table Setup — SYSTEM_VERSIONING = ON

> [!info] Temporal Tables
>
> SQL Server manages `valid_from` and `valid_to` automatically. Every UPDATE or DELETE copies the old row to the history table. You get point-in-time queries for free.

```sql
-- Add temporal columns (hidden from normal SELECT *)
ALTER TABLE silver.index_dim
    ADD valid_from DATETIME2 GENERATED ALWAYS AS ROW START HIDDEN
        DEFAULT SYSUTCDATETIME(),
    ADD valid_to   DATETIME2 GENERATED ALWAYS AS ROW END HIDDEN
        DEFAULT CONVERT(DATETIME2, '9999-12-31 23:59:59.9999999'),
    ADD PERIOD FOR SYSTEM_TIME (valid_from, valid_to);
GO

-- Enable versioning with a named history table
ALTER TABLE silver.index_dim
    SET (SYSTEM_VERSIONING = ON (
        HISTORY_TABLE = history.index_dim
    ));
```

### Temporal Queries — time-travel with FOR SYSTEM_TIME

> [!tip] Point-in-Time Queries
>
> Temporal tables let you query the state of any row at any past point in time — invaluable for regulatory audit, debugging, and "what did we think on date X?" questions.

```sql
-- What was ASML's sector on January 15, 2024?
SELECT symbol, sector, valid_from, valid_to
FROM silver.index_dim
FOR SYSTEM_TIME AS OF '2024-01-15T00:00:00'
WHERE symbol = 'ASML.AS';

-- Full change history for a specific stock
SELECT symbol, sector, valid_from, valid_to
FROM silver.index_dim
FOR SYSTEM_TIME ALL
WHERE symbol = 'ASML.AS'
ORDER BY valid_from;
```

### Temporal Table Gotchas

> [!warning] Temporal Table Limitations
>
> Temporal tables are powerful but have sharp edges that bite during schema changes and maintenance.

- **History grows forever:** no automatic retention policy in SQL Server 2016-2019. SQL Server 2022 adds `HISTORY_RETENTION_PERIOD`. For older versions, manually archive/purge the history table
- **Schema changes require OFF/ON:** `ALTER TABLE ADD COLUMN` requires `SET (SYSTEM_VERSIONING = OFF)` first, then re-enable after the change. Automate this in migration scripts
- **No TRUNCATE:** `TRUNCATE TABLE` is not allowed on temporal tables. Use `DELETE` instead (slower, fully logged)
- **HIDDEN columns:** `valid_from` and `valid_to` are excluded from `SELECT *` by default. Query them explicitly when needed

---

## Manual SCD2 vs Temporal Tables — Side-by-Side

### Feature Comparison — choosing between the two

> [!info] Decision Guide
>
> Use temporal tables for audit/compliance where you need every column change tracked automatically. Use manual SCD2 for pipeline-driven dimensions where you control which columns trigger a new version.

| Feature | Manual SCD2 | Temporal Tables |
|---------|------------|-----------------|
| SQL Server version | Any | 2016+ |
| Change detection | You define which columns matter | All columns tracked automatically |
| History maintenance | You manage close/insert | Engine manages automatically |
| Time-travel queries | Manual `WHERE valid_to IS NULL` | Built-in `FOR SYSTEM_TIME AS OF` |
| Schema changes | Normal `ALTER TABLE` | Must disable/re-enable versioning |
| Custom logic | Full control (e.g., only track sector changes) | All-or-nothing on the table |
| Performance overhead | Only on your transform runs | On every UPDATE/DELETE (small) |

### When to Choose Manual SCD2 vs Temporal Tables — Real-World Scenarios

> [!tip] The practical decision
>
> The comparison table above lists features. Here is how the choice actually plays out in production.

**Choose Manual SCD2 when:**
- You only care about changes to SPECIFIC columns (e.g., sector, country) while ignoring noisy columns (e.g., last_updated timestamp) — temporal tables track ALL columns, generating history rows for irrelevant changes
- Your pipeline already runs in Python/C# and you want detection logic in application code where it can be unit-tested
- You need to control WHEN history is captured (only on pipeline runs, not on every ad-hoc UPDATE by a DBA fixing data)
- You run SQL Server 2014 or earlier (temporal tables require 2016+)
- Schema changes are frequent — temporal tables require `SYSTEM_VERSIONING = OFF` before any `ALTER TABLE`, which is operationally painful in CI/CD pipelines

**Choose Temporal Tables when:**
- Regulatory/compliance requirements demand tracking EVERY column change with tamper-proof timestamps (auditors love `FOR SYSTEM_TIME AS OF`)
- You need to answer "what was the state at time X?" frequently — temporal tables have native query syntax; manual SCD2 requires complex self-joins
- Multiple applications write to the same table and you can't guarantee all of them will call your SCD2 logic — temporal tables capture changes regardless of the writer
- You want minimal application code — temporal tables are set-and-forget (minus retention management)

**The hybrid approach (common in practice):**
Use temporal tables on core reference/audit tables (e.g., customer master, regulatory filings) where you need complete history. Use manual SCD2 on pipeline-driven dimensions (e.g., stock metadata, product catalog) where you control the refresh cycle and want selective change detection.

> [!warning] Schema migration with temporal tables
>
> Every `ALTER TABLE ADD COLUMN` migration requires:
> 1. `ALTER TABLE ... SET (SYSTEM_VERSIONING = OFF)`
> 2. Apply the schema change to BOTH the current and history tables
> 3. `ALTER TABLE ... SET (SYSTEM_VERSIONING = ON)`
>
> In a GitHub Actions pipeline, this means your migration scripts must handle the OFF/ON dance. Forgetting step 3 leaves the table without history tracking — silently. Add a post-migration check:
> ```sql
> SELECT temporal_type_desc FROM sys.tables WHERE name = 'index_dim';
> -- Must return 'SYSTEM_VERSIONED_TEMPORAL_TABLE', not 'NON_TEMPORAL_TABLE'
> ```

### SCD2 Change Detection in Python — the comparison engine

> [!info] Python-driven SCD2
>
> The T-SQL above handles the close/insert. This Python code drives the comparison logic — reading both bronze and silver, comparing row by row, and executing the appropriate SQL for each case.

```python
TRACKED_COLUMNS = ["sector", "industry", "country", "long_name", "short_name"]

def detect_scd2_changes(bronze_rows: dict, silver_rows: dict) -> tuple[list, list, list]:
    """Compare bronze snapshot against active silver rows.
    Returns (new_symbols, changed_symbols, removed_symbols)."""
    new, changed, removed = [], [], []

    for key, bronze_row in bronze_rows.items():
        if key not in silver_rows:
            new.append(bronze_row)
        else:
            silver_row = silver_rows[key]
            if any(bronze_row.get(col) != silver_row.get(col) for col in TRACKED_COLUMNS):
                changed.append(bronze_row)

    for key in silver_rows:
        if key not in bronze_rows:
            removed.append(silver_rows[key])

    return new, changed, removed
```

---

## Change Data Capture (CDC)

Captures INSERT, UPDATE, and DELETE operations from the transaction log. Used for streaming changes to downstream systems like Kafka/Debezium.

### CDC Setup — enable on database and table

> [!info] CDC Architecture
>
> CDC runs a log reader agent (SQL Server Agent job) that reads the transaction log and writes changes to system-generated change tables. You query these tables to get a stream of changes.

```sql
-- Enable CDC on the database
EXEC sys.sp_cdc_enable_db;
GO

-- Enable CDC on a specific table
EXEC sys.sp_cdc_enable_table
    @source_schema = 'bronze',
    @source_name   = 'signals_daily',
    @role_name     = NULL;    -- NULL = no gating role
GO
```

### CDC Query — read changes since last sync

```sql
-- Get all changes since the last processed LSN
DECLARE @from_lsn BINARY(10) = sys.fn_cdc_get_min_lsn('bronze_signals_daily');
DECLARE @to_lsn   BINARY(10) = sys.fn_cdc_get_max_lsn();

SELECT *
FROM cdc.fn_cdc_get_all_changes_bronze_signals_daily(
    @from_lsn, @to_lsn, 'all update old'
);
```

### CDC Gotchas

> [!warning] CDC Operational Overhead
>
> CDC is not "set and forget." The log reader agent must be running, change tables grow unbounded without cleanup, and schema changes can break the capture instance.

- **Log reader agent must be running:** CDC depends on SQL Server Agent (see [sql-server-agent-jobs](https://alp78.github.io/elysium/04-SQL-Server/Administration/sql-server-agent-jobs) for Agent on Linux). If the agent stops, changes accumulate in the transaction log, potentially filling it
- **Cleanup:** CDC change tables grow until you configure retention: `EXEC sys.sp_cdc_change_job @job_type = 'cleanup', @retention = 4320;` (minutes)
- **Schema changes break CDC:** adding or dropping a column requires disabling and re-enabling CDC on that table — the capture instance must match the current schema

### CDC → Pub/Sub — streaming changes to GCP

> [!info] SQL Server CDC to Pub/Sub pipeline
>
> In the broader ecosystem, teams use Kafka/Debezium for CDC streaming. In this GCP stack, the equivalent is Pub/Sub. This Python script polls CDC change tables and publishes each change as a Pub/Sub message. Run it as an [Airflow task](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-dag-patterns) or a Cloud Run job on a schedule (e.g., every 5 minutes).

```python
import pyodbc, json
from google.cloud import pubsub_v1

publisher = pubsub_v1.PublisherClient()
topic_path = publisher.topic_path("my-project", "sql-server-changes")

conn = pyodbc.connect(conn_str)
cursor = conn.cursor()

# Read CDC changes since last processed LSN
cursor.execute("""
    DECLARE @from_lsn BINARY(10) = sys.fn_cdc_get_min_lsn('bronze_signals_daily');
    DECLARE @to_lsn   BINARY(10) = sys.fn_cdc_get_max_lsn();
    SELECT __$operation, symbol, signal_date, current_price
    FROM cdc.fn_cdc_get_all_changes_bronze_signals_daily(
        @from_lsn, @to_lsn, 'all update old'
    );
""")
```

```python
# Publish each change as a Pub/Sub message
OP_MAP = {1: "DELETE", 2: "INSERT", 3: "UPDATE_OLD", 4: "UPDATE_NEW"}

for row in cursor.fetchall():
    message = json.dumps({
        "operation": OP_MAP.get(row[0], "UNKNOWN"),
        "symbol": row[1],
        "signal_date": str(row[2]),
        "current_price": row[3]
    }).encode("utf-8")
    publisher.publish(topic_path, message, source="sql-server-cdc")
```

### CDC → BigQuery — replicate changes to the warehouse

> [!info] CDC to BigQuery replication
>
> Read CDC changes, transform to BigQuery-compatible rows, and stream them using the BigQuery streaming insert API. This is the pattern for near-real-time replication without a dedicated CDC tool like Debezium.

```python
from google.cloud import bigquery
from datetime import datetime

bq_client = bigquery.Client()
table_ref = bq_client.dataset("silver").table("signals_daily")

# Transform CDC rows to BigQuery format (INSERT and UPDATE_NEW only)
rows_to_insert = [
    {
        "symbol": row.symbol,
        "signal_date": str(row.signal_date),
        "current_price": row.current_price,
        "_cdc_operation": "UPSERT",
        "_cdc_timestamp": datetime.utcnow().isoformat()
    }
    for row in cdc_changes
    if row.operation in (2, 4)   # INSERT or UPDATE_NEW only
]

errors = bq_client.insert_rows_json(table_ref, rows_to_insert)
if errors:
    raise RuntimeError(f"BigQuery insert failed: {errors}")
```

### CDC → Firestore — push dimension changes to real-time store

> [!info] CDC to Firestore for real-time updates
>
> When stock metadata changes (sector reclassification, name change), push the update to Firestore so dashboards and APIs see it immediately without polling SQL Server.

```python
from google.cloud import firestore

db = firestore.Client()

for change in dimension_changes:
    doc_ref = db.collection("stocks").document(change.symbol)
    doc_ref.set({
        "symbol": change.symbol,
        "sector": change.new_sector,
        "long_name": change.new_name,
        "updated_at": firestore.SERVER_TIMESTAMP
    }, merge=True)   # merge=True preserves fields not in this update
```

---

## Change Tracking (CT)

Lightweight alternative to CDC: tracks **which rows** changed but not **what** changed. Keys only, no old/new values.

### CT Setup and Query — sync-oriented change detection

> [!info] Change Tracking vs CDC
>
> CT gives you the primary keys of changed rows. CDC gives you the full before/after values. CT is simpler and cheaper; CDC is richer. Use CT for "give me everything new since my last sync" and re-read the full rows.

```sql
-- Enable on database
ALTER DATABASE analytics_db
SET CHANGE_TRACKING = ON
    (CHANGE_RETENTION = 7 DAYS, AUTO_CLEANUP = ON);

-- Enable on table
ALTER TABLE silver.signals_daily
ENABLE CHANGE_TRACKING WITH (TRACK_COLUMNS_UPDATED = ON);

-- Query changes since last sync version
SELECT ct.symbol, ct.signal_date, ct.SYS_CHANGE_OPERATION
FROM CHANGETABLE(CHANGES silver.signals_daily, @last_sync_version) AS ct;
```

> [!warning] Version Window
>
> CT is version-based, not time-based. If you miss the retention window (don't sync within `CHANGE_RETENTION` days), the version history is purged and you must do a full sync.

---

## dbt Snapshots

Declarative SCD2: dbt handles the close/insert logic automatically. Two detection strategies.

### dbt Snapshot Strategies — timestamp vs check

> [!info] dbt Snapshot
>
> dbt snapshots generate `dbt_valid_from`, `dbt_valid_to`, and `dbt_scd_id` columns automatically. Choose `timestamp` strategy when the source has a reliable `updated_at` column; use `check` strategy to compare specific column values. See [dbt-snapshots-and-scd](https://alp78.github.io/elysium/11-dbt/Advanced/dbt-snapshots-and-scd) for full syntax and configuration.

- **Timestamp strategy:** detects changes when `updated_at` advances — fast but misses changes where only non-timestamp columns change
- **Check strategy:** compares listed columns on every run — catches all changes but slower (full table scan)
- **Trade-off:** dbt manages the history lifecycle, but you lose fine-grained control over detection logic. For SQL Server-managed history, use temporal tables instead

---

## Anti-Patterns

### Triggers for Change Tracking — per-row overhead nightmare

Triggers fire once per statement (or per row in some configurations), adding overhead to every DML operation. They're hard to debug, invisible to callers, and create hidden dependencies. Use CDC or temporal tables instead.

### SCD2 Without a Filtered Unique Index

Without `CREATE UNIQUE INDEX ... WHERE is_current = 1`, nothing prevents two rows with `is_current = 1` for the same key. A bug in the close/insert logic silently creates duplicate current rows — caught only when a dashboard shows wrong data.

### Comparing Floats for Change Detection

`FLOAT` equality is unreliable: `3.14` stored as `3.1400000000000001` fails an equality check against `3.14`. Use `ABS(old - new) < 0.0001` or round both sides to a fixed decimal precision before comparing.

### CDC Without Cleanup

CDC change tables grow unbounded. A table with 10M changes/day accumulates 300M rows/month in the change table — eventually filling the disk. Always configure retention: `sp_cdc_change_job @retention = 4320` (3 days in minutes).

### Temporal Tables With No Retention Policy

The history table grows at least as fast as the rate of changes to the source table. For high-update tables, the history table can be 10x larger than the source within a year. Archive or purge periodically.

### Overwriting History in Place

`UPDATE dim_stock SET sector = 'New Sector' WHERE symbol = 'ASML'` destroys the audit trail. You can never answer "what sector was ASML in last quarter?" Use SCD2 or temporal tables instead of in-place updates on dimension tables.

---

## Medallion-Project Reference

> [!example]- Medallion-Project: SCD2 on stock dimensions
>
> The financial index pipeline implements manual SCD2 on `silver.index_dim`:
>
> 1. Read full bronze snapshot of company attributes
> 2. Read active silver rows (`WHERE is_current = 1`)
> 3. Python compares each `(_index, symbol)` pair attribute by attribute
> 4. Changed stocks: `UPDATE SET is_current = 0, valid_to = SYSUTCDATETIME()` → `INSERT` new version
> 5. Filtered unique index `UX_silver_index_dim_current` enforces one active row per stock
>
> See [silver-transforms](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/silver-transforms) for the full detect/close/insert implementation.
