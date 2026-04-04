---
title: "SQL Server Change Tracking"
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
description: "Every method SQL Server offers for tracking data changes over time — manual SCD2, temporal tables, CDC, Change Tracking, dbt snapshots — with a decision matrix and side-by-side comparisons."
created: 2026-03-29
updated: 2026-04-04
status: complete
---

# SQL Server Change Tracking — Capturing Data History

> [!quote]
> "Without a reliable history of what changed and when, you cannot debug a data pipeline, satisfy an auditor, or recover from a bad load."
>
> — **Ralph Kimball**, *The Data Warehouse Toolkit*

"How do I know what changed?" is the most common question in data engineering. SQL Server has five built-in answers and two external ones. Most teams use the wrong one. For dbt's declarative approach, see [dbt-snapshots-and-scd](https://alp78.github.io/elysium/11-dbt/Advanced/dbt-snapshots-and-scd).

---

## Decision Matrix

Change tracking is the discipline of recording what data changed, when it changed, and (optionally) what the old and new values were. Every data pipeline, audit system, and synchronization pattern depends on answering at least one of these questions: "Which rows are new since my last sync?" (keys only), "What did this row look like before the update?" (before/after images), or "What was the state of this table at a specific point in time?" (time-travel). SQL Server provides five built-in mechanisms — Manual SCD2, Temporal Tables, CDC, Change Tracking, and Triggers — plus two external approaches (dbt Snapshots and application-level logging). Each trades off between capture richness, performance overhead, and implementation complexity.

### Change Tracking Methods — when to use each

> [!info] Method Comparison
>
> Choose based on what you need to capture (keys only vs full row history), who owns the logic (DB engine vs application), and performance tolerance. Performance cost estimates assume a 10M-row OLTP table with ~100K DML operations/day: "Low" adds less than 5% overhead, "Medium" adds 5–15%, "High" adds more than 15% or introduces per-statement contention.

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

A **Slowly Changing Dimension (SCD)** is a dimension table whose attributes change infrequently and unpredictably — a company's sector reclassification, an employee's department transfer, or a product's category reassignment. "Slowly" distinguishes these from rapidly changing measures (e.g., stock prices) that belong in fact tables. The SCD type number describes how the change is recorded:

- **Type 1 — Overwrite:** replace the old value in place. No history is preserved. Simplest but destroys the audit trail.
- **Type 2 — Row versioning:** close the current row (set `valid_to`, clear `is_current`) and insert a new row with the updated attributes. Full history is preserved — every past state is queryable.
- **Type 3 — Previous-value column:** add `previous_sector` alongside `current_sector`. Preserves exactly one prior value. Rarely used because it only tracks one change deep.

Type 2 is the most common in production data warehouses because it preserves the complete change history without schema changes per tracked column. The trade-off is implementation complexity: you must detect changes, close old rows, and insert new ones atomically. For SCD type definitions (Types 1–6) in the broader data warehouse context, see [data-warehouse-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/data-warehouse-architecture).

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

> [!success] Safe SCD2 Patterns
>
> - Use `DATETIME2` (not `DATE`) for `valid_from`/`valid_to` to avoid same-day collisions.
> - Always wrap NULL comparisons: `ISNULL(old_val, '') <> ISNULL(new_val, '')` or use `IS NOT DISTINCT FROM` (SQL Server 2022+).
> - Create the filtered unique index `WHERE is_current = 1` before running SCD2 logic — it enforces one active row per key and will catch close/insert bugs at the DB level.
> - For float columns, compare with `ABS(old_val - new_val) > 0.0001` instead of `<>` to avoid floating-point false-positives.

> [!tip] Hash-based change detection
>
> Instead of comparing columns one by one, compute a hash (SHA2 or MD5) over the tracked columns and compare the single hash value. This simplifies the detection logic to a single equality check regardless of how many columns are tracked, and naturally handles NULLs if you coalesce before hashing. The trade-off is that hash collisions are theoretically possible (though vanishingly rare with SHA-256) and debugging is harder — you can see that a row changed but not which column triggered it.
>
> — Source: Ralph Kimball | *The Data Warehouse Toolkit*; *Data Modeling with Snowflake*

---

## SQL Server Temporal Tables (SYSTEM_VERSIONING)

A **temporal table** (also called a system-versioned table) is a pair of tables — one current, one history — managed automatically by the Database Engine. When you UPDATE or DELETE a row in the current table, the engine copies the old row version to the history table before applying the change. This gives you a complete, tamper-proof timeline of every row state without writing any SCD2 logic yourself.

**System versioning** is the SQL Server mechanism that orchestrates this: it adds two `DATETIME2` period columns (`ValidFrom`, `ValidTo`), populates them using the **UTC transaction begin time** (not wall-clock time — all rows modified in the same transaction share the same `ValidFrom`), and maintains the history table transparently. The `ValidTo` for current rows is always `9999-12-31 23:59:59.9999999`. Available in SQL Server 2016+.

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

The `FOR SYSTEM_TIME` clause supports five subclauses, each with different boundary inclusion rules. Understanding the boundary semantics is critical — `FROM...TO` and `BETWEEN...AND` look similar but differ on whether the upper endpoint is inclusive.

> [!info] FOR SYSTEM_TIME Variants
>
> | Subclause | Row qualifies when | Boundary behavior |
> |---|---|---|
> | `AS OF <dt>` | `ValidFrom <= dt AND ValidTo > dt` | Point-in-time snapshot; upper bound exclusive |
> | `FROM <s> TO <e>` | `ValidFrom < e AND ValidTo > s` | Both endpoints **exclusive** |
> | `BETWEEN <s> AND <e>` | `ValidFrom <= e AND ValidTo > s` | Upper endpoint **inclusive** (differs from `FROM...TO`) |
> | `CONTAINED IN (<s>, <e>)` | `ValidFrom >= s AND ValidTo <= e` | Both endpoints inclusive; only rows whose entire lifetime falls within the window; queries history table only — most efficient for data audit |
> | `ALL` | All rows, both tables | No filter; union of current + history |

`FOR SYSTEM_TIME` can be applied independently per table in multi-table joins, used inside CTEs, TVFs, and stored procedures.

```sql
-- Point-in-time: what was ASML's sector on January 15, 2024?
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

-- All changes within a date range (both endpoints inclusive)
SELECT symbol, sector, valid_from, valid_to
FROM silver.index_dim
FOR SYSTEM_TIME BETWEEN '2024-01-01' AND '2024-06-30'
WHERE symbol = 'ASML.AS';

-- Rows whose entire lifetime falls within a window (audit queries)
SELECT symbol, sector, valid_from, valid_to
FROM silver.index_dim
FOR SYSTEM_TIME CONTAINED IN ('2024-01-01', '2024-06-30')
WHERE symbol = 'ASML.AS';
```

### Temporal Table Gotchas

> [!warning] Temporal Table Limitations
>
> Temporal tables are powerful but have sharp edges that bite during schema changes and maintenance.

- **History grows forever:** no automatic retention policy in SQL Server 2016. `HISTORY_RETENTION_PERIOD` was introduced in SQL Server 2017 (not 2022). Supported units: `DAYS`, `WEEKS`, `MONTHS`, `YEARS`. Default if omitted: `INFINITE`. For SQL Server 2016, manually archive/purge the history table or use table partitioning
- **Retention cleanup depends on index type:** with a clustered rowstore (B+ tree) on the history table, cleanup deletes in chunks of up to 10,000 rows. With a clustered columnstore, it removes entire row groups (~1M rows each) — far more efficient for high-velocity workloads. A heap history table cannot use the retention policy at all
- **Retention disabled after restore:** after a point-in-time restore (PITR), the database-level flag `is_temporal_history_retention_enabled` is automatically set to `OFF`. Must be re-enabled manually or your history will grow unbounded without warning
- **Schema changes require OFF/ON:** `ALTER TABLE ADD COLUMN` requires `SET (SYSTEM_VERSIONING = OFF)` first, then re-enable after the change. Automate this in migration scripts
- **No TRUNCATE:** `TRUNCATE TABLE` is blocked when `SYSTEM_VERSIONING = ON`. Use `DELETE` instead (slower, fully logged)
- **HIDDEN columns:** `valid_from` and `valid_to` are excluded from `SELECT *` by default. Query them explicitly when needed
- **No CASCADE foreign keys:** `ON DELETE CASCADE` and `ON UPDATE CASCADE` are not permitted on the current table
- **Zero-duration rows:** multiple updates to the same PK within a single transaction generate rows where `ValidFrom = ValidTo`. `FOR SYSTEM_TIME` queries filter these out — to see them, query the history table directly
- **History table constraints:** the history table cannot have a primary key, foreign keys, check constraints, or triggers, and must reside in the same database as the current table

> [!success] Temporal Table Safe Practices
>
> - On SQL Server 2017+, set a retention policy at table creation: `HISTORY_RETENTION_PERIOD = 2 YEARS`. On SQL Server 2016, schedule a periodic `DELETE FROM history.index_dim WHERE valid_to < DATEADD(YEAR, -2, SYSUTCDATETIME())`. After any point-in-time restore, verify and re-enable `is_temporal_history_retention_enabled` at the database level.
> - Automate schema migrations with the OFF/ON dance: `SET (SYSTEM_VERSIONING = OFF)` → `ALTER TABLE` on both current and history tables → `SET (SYSTEM_VERSIONING = ON)`. Add a post-migration check to verify `temporal_type_desc = 'SYSTEM_VERSIONED_TEMPORAL_TABLE'`.
> - Use `DELETE` (not `TRUNCATE`) for targeted removals; for full rebuilds, disable versioning first, truncate, then re-enable.
> - Query temporal columns explicitly: `SELECT valid_from, valid_to FROM silver.index_dim FOR SYSTEM_TIME ALL WHERE symbol = 'ASML.AS'`.

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

> [!success] Safe Temporal Migration Pattern
>
> Wrap every schema migration for a temporal table in a three-step script and include the verification query as the final step:
> ```sql
> ALTER TABLE silver.index_dim SET (SYSTEM_VERSIONING = OFF);
> ALTER TABLE silver.index_dim    ADD new_column NVARCHAR(100) NULL;
> ALTER TABLE history.index_dim   ADD new_column NVARCHAR(100) NULL;
> ALTER TABLE silver.index_dim SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = history.index_dim));
> -- Verify
> SELECT temporal_type_desc FROM sys.tables WHERE name = 'index_dim';
> ```
> Include this pattern as a reusable template in your migration scripts folder so it is never skipped.

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

**Change Data Capture (CDC)** is a SQL Server feature that asynchronously reads committed DML operations (INSERT, UPDATE, DELETE) from the **transaction log** and writes them into system-generated **change tables** — one per tracked source table. Unlike Change Tracking (which records only primary keys), CDC captures full before-and-after row images, making it suitable for ETL pipelines, streaming to Kafka/Debezium, and data warehouse loading.

CDC uses the same internal stored procedure (`sp_replcmds`) as transactional replication to scan the log. A dedicated **SQL Server Agent capture job** calls this procedure on a polling interval and writes changes to `cdc.<capture_instance>_CT` tables. A separate **cleanup job** periodically purges old change rows based on a configurable retention period. CDC requires **Standard or Enterprise edition** — it is not available on Express or Developer editions.

Each CDC-enabled table has a **capture instance** — a named snapshot of the table's schema at the time CDC was enabled. The change table's column structure is fixed to the capture instance's schema. A source table can have at most two capture instances simultaneously, which enables zero-downtime schema migrations (create a second instance with the new schema, transition consumers, then drop the old instance).

### CDC Setup — enable on database and table

> [!info] CDC Architecture
>
> CDC runs a log reader agent (SQL Server Agent job) that reads the transaction log and writes changes to system-generated change tables. Changes are identified by **Log Sequence Numbers (LSNs)** — monotonically increasing identifiers that the transaction log assigns to every write operation. An LSN uniquely positions a change in the log's timeline, and CDC uses LSN ranges to define query windows (e.g., "give me all changes between LSN X and LSN Y").

```sql
-- Enable CDC on the database
EXEC sys.sp_cdc_enable_db;
GO

-- Enable CDC on a specific table
EXEC sys.sp_cdc_enable_table
    @source_schema = 'bronze',
    @source_name   = 'signals_daily',
    @role_name     = NULL;    -- NULL = no gating role (any db_owner can query change tables)
                              -- Set to a role name to restrict access to change data
GO
```

### CDC Query — read changes since last sync

To query CDC changes, you specify an LSN range using two boundary functions: `sys.fn_cdc_get_min_lsn()` returns the low watermark (oldest available change) for a capture instance, and `sys.fn_cdc_get_max_lsn()` returns the high watermark (most recently processed log entry). Both endpoints must fall within the capture instance's validity interval or the query fails.

The third parameter of `fn_cdc_get_all_changes_*` controls how updates are returned: `'all'` returns one row per update (after-image only), while `'all update old'` returns two rows per update — one with the before-image (`__$operation = 3`) and one with the after-image (`__$operation = 4`). Use `'all update old'` when your downstream system needs to know what changed from and to.

```sql
DECLARE @from_lsn BINARY(10) = sys.fn_cdc_get_min_lsn('bronze_signals_daily');
DECLARE @to_lsn   BINARY(10) = sys.fn_cdc_get_max_lsn();

SELECT *
FROM cdc.fn_cdc_get_all_changes_bronze_signals_daily(
    @from_lsn, @to_lsn, 'all update old'
);
```

> [!info] CDC Metadata Columns
>
> Every row in a CDC change table includes four metadata columns:
>
> | Column | Type | Meaning |
> |---|---|---|
> | `__$start_lsn` | `BINARY(10)` | Commit LSN of the transaction — rows from the same transaction share this value |
> | `__$seqval` | `BINARY(10)` | Orders multiple changes within one transaction |
> | `__$operation` | `INT` | `1` = DELETE, `2` = INSERT, `3` = UPDATE before-image, `4` = UPDATE after-image |
> | `__$update_mask` | `VARBINARY` | Bitmask where each set bit represents a captured column that changed |
>
> Use `sys.fn_cdc_map_lsn_to_time()` to translate LSNs to wall-clock timestamps, and `sys.fn_cdc_increment_lsn()` to build non-overlapping query windows across consecutive sync cycles.

### CDC Gotchas

> [!warning] CDC Operational Overhead
>
> CDC is not "set and forget." The log reader agent must be running, change tables grow unbounded without cleanup, and schema changes can break the capture instance.

- **Edition requirement:** CDC requires Standard or Enterprise edition. Attempting to attach or restore a CDC-enabled database on Express edition produces error 932
- **Log reader agent must be running:** CDC depends on SQL Server Agent (see [sql-server-agent-jobs](https://alp78.github.io/elysium/04-SQL-Server/Administration/sql-server-agent-jobs) for Agent on Linux). If the agent stops, changes accumulate in the transaction log — even under Simple recovery model, the log truncation point does not advance past unprocessed CDC changes, eventually filling the log
- **Capture job defaults:** `maxtrans = 1000` (max transactions per scan cycle), `maxscans = 10` (max cycles before a WAITFOR), `pollinginterval = 5` seconds. Changes via `sys.sp_cdc_change_job` take effect only after the job is stopped and restarted
- **Cleanup:** CDC change tables grow until you configure retention. The default cleanup runs daily at 2:00 AM with `retention = 4320` minutes (3 days) and `threshold = 5000` rows deleted per DELETE statement (the threshold prevents one giant DELETE from holding locks too long)
- **Schema changes break CDC:** adding or dropping a column does not update the existing capture instance — new columns are silently ignored, dropped columns return NULL. For zero-downtime migration, create a second capture instance (max 2 per table) with the new schema, transition consumers, then drop the old instance

> [!success] CDC Operational Safeguards
>
> - Configure cleanup retention immediately after enabling CDC: `EXEC sys.sp_cdc_change_job @job_type = 'cleanup', @retention = 4320;` (3 days). Monitor change table size weekly.
> - Add a SQL Server Agent alert (or Airflow sensor) that fires when the log reader job is not running. Catching agent downtime early prevents transaction log fill — check `sys.dm_cdc_log_scan_sessions` for latency metrics.
> - For schema migrations, create a second capture instance with the new schema instead of disabling and re-enabling CDC (which loses change history during the gap): `EXEC sys.sp_cdc_enable_table @source_schema = 'bronze', @source_name = 'signals_daily', @capture_instance = 'signals_daily_v2', @role_name = NULL;`. Transition consumers to the new instance, then drop the old one with `sys.sp_cdc_disable_table`.
> - Monitor the `cdc.ddl_history` table to detect schema changes that may require a new capture instance.

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

**Change Tracking (CT)** is a lightweight, synchronous mechanism that records **which rows** changed but not **what** changed — only the primary key values of affected rows, the operation type, and (optionally) a bitmask of which columns were modified. Unlike CDC (which reads the transaction log asynchronously and stores full before/after images), CT writes tracking data in-line with each DML operation in the same transaction. This makes CT immediate (no latency), agent-free (no dependency on SQL Server Agent), and available on **all editions including Express**.

CT uses a **version-based model**: the database maintains a monotonically increasing `bigint` version counter. Every committed transaction that touches a CT-enabled table increments this counter. Consumers store the version number after each sync cycle and query "give me everything that changed since version X" on the next cycle.

### CT Setup and Query — sync-oriented change detection

> [!info] Change Tracking vs CDC
>
> CT gives you the primary keys of changed rows plus a change type (`I`/`U`/`D`). CDC gives you full before/after values with LSN ordering. CT is simpler and cheaper; CDC is richer. Use CT for "give me everything new since my last sync" where you re-read the full rows from the source table.

`TRACK_COLUMNS_UPDATED = ON` enables column-level tracking: `SYS_CHANGE_COLUMNS` in the `CHANGETABLE` output will contain a bitmask identifying which columns changed. Use `CHANGE_TRACKING_IS_COLUMN_IN_MASK(column_id, SYS_CHANGE_COLUMNS)` to test specific columns. Without this option, you only know that a row changed, not which columns.

```sql
-- Enable on database
ALTER DATABASE analytics_db
SET CHANGE_TRACKING = ON
    (CHANGE_RETENTION = 7 DAYS, AUTO_CLEANUP = ON);

-- Enable on table with column-level tracking
ALTER TABLE silver.signals_daily
ENABLE CHANGE_TRACKING WITH (TRACK_COLUMNS_UPDATED = ON);

-- Query changes since last sync version
SELECT ct.symbol, ct.signal_date,
       ct.SYS_CHANGE_OPERATION,    -- 'I' = INSERT, 'U' = UPDATE, 'D' = DELETE
       ct.SYS_CHANGE_VERSION,      -- version at which this row changed
       ct.SYS_CHANGE_COLUMNS       -- bitmask of changed columns (if TRACK_COLUMNS_UPDATED = ON)
FROM CHANGETABLE(CHANGES silver.signals_daily, @last_sync_version) AS ct;
```

> [!info] CT Version Functions
>
> | Function | Purpose |
> |---|---|
> | `CHANGE_TRACKING_CURRENT_VERSION()` | Returns the version of the last committed transaction — use as the bookmark for the next sync |
> | `CHANGE_TRACKING_MIN_VALID_VERSION(OBJECT_ID('table'))` | Oldest version still available for the table — if your stored version is older, you must do a full sync |
> | `CHANGETABLE(CHANGES table, version)` | Returns all changed PKs since the given version with operation type and column bitmask |
> | `CHANGETABLE(VERSION table, (pk_cols), (pk_vals))` | Returns CT metadata for a single specific row — used for conflict detection in two-way sync |
> | `CHANGE_TRACKING_IS_COLUMN_IN_MASK(col_id, mask)` | Tests whether a specific column changed by interpreting the `SYS_CHANGE_COLUMNS` bitmask |

> [!warning] Version Window
>
> CT is version-based, not time-based. If you miss the retention window (don't sync within `CHANGE_RETENTION` days), the version history is purged and you must do a full sync. The auto-cleanup thread runs every 30 minutes (SQL Server 2022 and earlier). SQL Server 2025 introduces adaptive shallow cleanup that processes incrementally instead of scanning the full side table.

> [!success] Handling an Expired CT Version
>
> Detect a version gap before querying: call `CHANGE_TRACKING_MIN_VALID_VERSION(OBJECT_ID('silver.signals_daily'))` and compare against your stored `@last_sync_version`. If the stored version is older than the minimum valid version, fall back to a full sync and reset the stored version to `CHANGE_TRACKING_CURRENT_VERSION()`. Increase `CHANGE_RETENTION` to cover your worst-case sync latency:
> ```sql
> ALTER DATABASE analytics_db
>     SET CHANGE_TRACKING (CHANGE_RETENTION = 14 DAYS, AUTO_CLEANUP = ON);
> ```
>
> Use snapshot isolation to prevent race conditions between cleanup and reads — without it, cleanup can invalidate your version between the validation check and the `CHANGETABLE()` call:
> ```sql
> ALTER DATABASE analytics_db SET ALLOW_SNAPSHOT_ISOLATION ON;
> SET TRANSACTION ISOLATION LEVEL SNAPSHOT;
> BEGIN TRAN;
>     -- 1. Validate @last_sync_version >= CHANGE_TRACKING_MIN_VALID_VERSION(...)
>     -- 2. Capture @next_version = CHANGE_TRACKING_CURRENT_VERSION()
>     -- 3. Query CHANGETABLE(CHANGES ..., @last_sync_version)
> COMMIT TRAN;
> ```
>
> After a database restore, a consumer's stored `@last_sync_version` may still pass the `MIN_VALID_VERSION` check, but tracked changes from the restored-away period are silently missing. Store a database ID/version stamp and detect mismatches on reconnect.

---

## dbt Snapshots

**dbt snapshots** implement SCD Type 2 declaratively: you define which source table to track and how to detect changes, and dbt handles the close/insert logic — setting `dbt_valid_from`, `dbt_valid_to`, and generating a unique `dbt_scd_id` for each row version. This is the standard approach for SCD2 in dbt-managed pipelines, removing the need for hand-written close/insert SQL.

### dbt Snapshot Strategies — timestamp vs check

> [!info] dbt Snapshot Strategies
>
> dbt provides two change detection strategies. Both produce identical SCD2 output (versioned rows with `dbt_valid_from`/`dbt_valid_to`), but they differ in how they detect whether a row has changed. See [dbt-snapshots-and-scd](https://alp78.github.io/elysium/11-dbt/Advanced/dbt-snapshots-and-scd) for full syntax and configuration.

- **Timestamp strategy:** detects changes when the source's `updated_at` column advances past the snapshot's recorded `dbt_valid_from`. Fast (only compares timestamps) but misses changes where the source data changes without updating the timestamp — for example, a direct `UPDATE` that skips the application layer's timestamp logic
- **Check strategy:** compares specified column values on every run using equality checks. Catches all changes regardless of timestamp behavior but requires a full table scan on every execution — `O(n)` per run where `n` is the source row count
- **Trade-off:** dbt manages the history lifecycle end-to-end, but you lose fine-grained control over detection logic (e.g., you cannot apply epsilon comparisons for float columns or custom NULL handling). For SQL Server-managed history with engine-level guarantees, use temporal tables instead

---

## Anti-Patterns

These are the most common mistakes in change tracking implementations. Each one has caused production incidents.

### Triggers for Change Tracking — per-row overhead nightmare

Triggers fire once per statement (or per row in some configurations), adding overhead to every DML operation. They're hard to debug, invisible to callers, and create hidden dependencies. `INSTEAD OF` triggers are outright blocked on temporal tables. Use CDC or temporal tables instead.

### SCD2 Without a Filtered Unique Index

Without `CREATE UNIQUE INDEX ... WHERE is_current = 1`, nothing prevents two rows with `is_current = 1` for the same key. A bug in the close/insert logic silently creates duplicate current rows — caught only when a dashboard shows wrong data.

### Comparing Floats for Change Detection

`FLOAT` equality is unreliable: `3.14` stored as `3.1400000000000001` fails an equality check against `3.14`. Use `ABS(old - new) < 0.0001` or round both sides to a fixed decimal precision before comparing. This applies to both manual SCD2 and dbt check-strategy snapshots.

### CDC Without Cleanup

CDC change tables grow unbounded. A table with 10M changes/day accumulates 300M rows/month in the change table — eventually filling the disk. Always configure retention: `sp_cdc_change_job @retention = 4320` (3 days in minutes). Set the `threshold` parameter to control the maximum rows deleted per statement (default: 5,000) to avoid lock escalation.

### CDC Schema Change Without a Second Capture Instance

Adding a column to a CDC-enabled table does not update the existing capture instance — the new column is silently ignored in change data. Disabling and re-enabling CDC creates a gap during which changes are lost. Instead, create a second capture instance with the new schema (max 2 per table), transition consumers, then drop the old instance.

### Temporal Tables With No Retention Policy

The history table grows at least as fast as the rate of changes to the source table. For high-update tables, the history table can be 10x larger than the source within a year. On SQL Server 2017+, set `HISTORY_RETENTION_PERIOD` at table creation. On 2016, schedule periodic purges. Remember that `is_temporal_history_retention_enabled` is automatically disabled after a point-in-time restore.

### Overwriting History in Place

`UPDATE dim_stock SET sector = 'New Sector' WHERE symbol = 'ASML'` destroys the audit trail. You can never answer "what sector was ASML in last quarter?" Use SCD2 or temporal tables instead of in-place updates on dimension tables.

### CT Sync Without Snapshot Isolation

Querying `CHANGETABLE()` without snapshot isolation allows a race condition: the auto-cleanup thread can purge your `@last_sync_version` between your validation check and the actual `CHANGETABLE()` call, causing silent data loss. Always wrap the validate-capture-query cycle in a snapshot transaction.

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
