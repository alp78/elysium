---
tags: [pipeline, python, sql, airflow, sql-server, tsql]
aliases: [pipeline integration, SQL comment tagging, Airflow SQL correlation, schema migrations, Flyway SQL Server, Liquibase SQL Server, connection pool management, developer experience]
description: "Developer experience patterns for SQL Server pipeline integration: tagging queries with Airflow context for monitoring correlation, schema migration management (Flyway/Python runner), and connection pool management for pymssql and ADO.NET."
created: 2026-03-22
updated: 2026-04-04
status: complete
---

# Pipeline Integration and Developer Experience

> [!quote]
> "Without observability into what your queries are doing, you are flying blind. Tag everything, measure everything, correlate everything."
>
> — **Charity Majors**, *Observability Engineering* (2022)

Three recurring friction points when integrating SQL Server into a data engineering pipeline: correlating SQL performance metrics with specific Airflow DAG runs, managing schema changes without breaking production, and controlling connection counts to avoid memory exhaustion on the database VM.

---

## Query Tagging for Airflow Correlation

When a DAG run causes a CPU or IO spike, the spike is visible in monitoring tools but its cause is not. You see a latency spike in Datadog at 09:05 UTC and three DAGs could have been running at that time. The two primary mechanisms for correlating SQL Server activity back to the orchestration layer are: (1) SQL comment header tagging, which embeds Airflow metadata directly in the query string and surfaces it in DMVs and the Query Store; and (2) Query Store time-window queries, which search for queries executed during a specific DAG run interval without requiring a Datadog subscription.

### Python | pymssql | query comment tagging

SQL comment headers are the simplest mechanism for correlating SQL Server activity with the orchestration system that triggered it. A comment prepended to a query string is stored verbatim in `sys.dm_exec_sql_text` — a dynamic management function (DMF) that maps a `sql_handle` (an MD5 hash of the batch text, stored in the SQL Manager cache `SQLMGR`) to its full query text — and in the Query Store's `sys.query_store_query_text.query_sql_text` column. Both storage locations preserve the comment for the lifetime of the corresponding cache entry or Query Store retention window, making it possible to filter monitoring queries by DAG name or task ID without any schema changes or additional instrumentation.

> [!info] sql_handle Lifecycle
>
> A `sql_handle` is transient: it remains valid only while at least one execution plan referencing it stays in the plan cache. Memory pressure, `DBCC FREEPROCCACHE`, or an `ALTER DATABASE` call will evict plans and drop the corresponding rows from `sys.dm_exec_query_stats`. The Query Store provides durable storage that survives both cache flushes and SQL Server restarts — use Query Store queries for post-incident correlation when the plan cache has already been cleared.

#### SQL comment header tagging — Airflow DAG, task, run metadata in queries

Prepend a structured comment to every SQL string before execution. The f-string interpolation embeds the current Airflow context variables — `dag_id`, `task_id`, `run_id` — into the comment. SQL Server stores this string as part of the batch text verbatim.

```python
dag_context = f"/* dag={dag_id} task={task_id} run={run_id} */"
cursor.execute(f"{dag_context} MERGE INTO silver.stock_dim ...")
```

These comments appear in:

- `sys.dm_exec_sql_text` (query text) — visible in all DMV-based monitoring
- Query Store (if enabled) — persists across restarts
- Datadog SQL query metrics — enables filtering and grouping

### Datadog | SQL Server | pipeline query monitoring

Datadog's Database Monitoring (DBM) feature for SQL Server integrates with the ODBC connector to continuously sample `sys.dm_exec_query_stats` and `sys.dm_exec_requests`, publishing query performance metrics to the Datadog platform. The `custom_queries` block in the agent configuration executes arbitrary DMV queries on a configurable collection interval and publishes the result columns as named time-series metrics. This is how DAG-tagged queries surface in Datadog dashboards without additional pipeline instrumentation.

#### Datadog dbm custom_queries — surface DAG-tagged SQL queries

The `custom_queries` block runs the provided T-SQL on each collection cycle and maps result columns to Datadog metric names. The `WHERE t.text LIKE '%/* dag=%'` filter restricts the DMV scan to queries containing the Airflow comment header, so the metric reflects only pipeline-generated queries. `CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle)` retrieves the full query text for each cached plan.

```yaml
# datadog-agent sql_server.d/conf.yaml
instances:
  - host: 127.0.0.1,1433
    username: datadog
    password: ...
    query_metrics:
      enabled: true
    query_activity:
      enabled: true
    custom_queries:
      - query: |
          SELECT TOP 10
            SUBSTRING(t.text, 1, 200) AS query_text,
            qs.total_elapsed_time / qs.execution_count / 1000 AS avg_ms,
            qs.execution_count,
            qs.total_logical_reads / qs.execution_count AS avg_reads
          FROM sys.dm_exec_query_stats qs
          CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) t
          WHERE t.text LIKE '%/* dag=%'
          ORDER BY qs.total_elapsed_time DESC
        columns:
          - name: query_text
            type: source
          - name: avg_ms
            type: gauge
          - name: execution_count
            type: monotonic_count
          - name: avg_reads
            type: gauge
        tags:
          - 'service:analytics-pipeline'
```

#### Datadog correlation dashboard — CPU, I/O, and DAG timeline overlay

Create a dashboard with two graphs:

1. **SQL Server CPU/IO metrics** (from the SQL Server integration) — `sqlserver.cpu_percent`, `sqlserver.io.stall_ms`
2. **Airflow DAG run timeline** (from the Airflow integration or a custom metric) — `airflow.dag_run.duration`

Overlay with markers for DAG run start/end times. This lets you visually correlate "CPU spiked at 09:05" with "the `daily_pipeline` DAG started at 09:04."

### SQL Server | Query Store | pipeline query correlation

The Query Store is an internal per-database feature that acts as a flight recorder for query plans and runtime statistics. It persists query text, execution plans, and aggregate runtime statistics to system tables inside the user database itself — not in `tempdb`. Unlike `sys.dm_exec_query_stats`, whose rows are dropped whenever a plan is evicted from the plan cache (due to memory pressure, `DBCC FREEPROCCACHE`, or restart), Query Store data survives SQL Server restarts and cache flushes, making it the right tool for post-incident pipeline correlation.

> [!info] Query Store Default Enablement by Version
>
> - **SQL Server 2016, 2017, 2019:** Query Store is **not enabled by default**. Enable per database: `ALTER DATABASE [db_name] SET QUERY_STORE = ON`.
> - **SQL Server 2022:** Query Store is **enabled by default** in `READ_WRITE` mode for all new databases.
>
> Default `MAX_STORAGE_SIZE_MB` is 100 MB on SQL Server 2016/2017 and **1,000 MB** starting with SQL Server 2019. `QUERY_CAPTURE_MODE` defaults to `ALL` in 2016/2017 and to `AUTO` in 2019+. In `AUTO` mode, infrequent or low-cost queries are filtered out — expensive pipeline queries will still be captured; brief ad hoc queries may not.

> [!warning] Query Store Silent Read-Only Transition
>
> When Query Store reaches its storage quota (`MAX_STORAGE_SIZE_MB`), it automatically switches from `READ_WRITE` to `READ_ONLY` mode and silently stops recording new query data. Diagnose with: `SELECT actual_state_desc, desired_state_desc, current_storage_size_mb, max_storage_size_mb, readonly_reason FROM sys.database_query_store_options`. A `readonly_reason` of `65536` means the quota was exceeded.

> [!success] Prevent Quota-Triggered Read-Only Mode
>
> Set `MAX_STORAGE_SIZE_MB` explicitly: `ALTER DATABASE [db_name] SET QUERY_STORE (MAX_STORAGE_SIZE_MB = 2048)`. Add a Datadog custom query on `sys.database_query_store_options` that alerts when `current_storage_size_mb` exceeds 80% of `max_storage_size_mb`.

#### sys.query_store_query_text — correlate pipeline queries without Datadog

This query finds the most expensive queries executed during a specific time window — for example, the 30-minute window when a DAG ran. It joins `sys.query_store_runtime_stats` (per-interval aggregated execution metrics) to `sys.query_store_plan` (execution plan metadata) and `sys.query_store_query_text` (the stored query text). The `WHERE` clause on `last_execution_time` filters to the DAG run window; `ORDER BY avg_duration DESC` surfaces the slowest queries first. `avg_duration` is reported in microseconds — divide by 1,000 for milliseconds.

```sql
SELECT TOP 10
    qsqt.query_sql_text,
    qsp.last_execution_time,
    qsrs.avg_duration / 1000 AS avg_ms,
    qsrs.avg_logical_io_reads,
    qsrs.count_executions
FROM sys.query_store_runtime_stats qsrs
JOIN sys.query_store_plan qsp ON qsrs.plan_id = qsp.plan_id
JOIN sys.query_store_query qsq ON qsp.query_id = qsq.query_id
JOIN sys.query_store_query_text qsqt ON qsq.query_text_id = qsqt.query_text_id
WHERE qsrs.last_execution_time BETWEEN '2026-03-10 09:00:00' AND '2026-03-10 09:30:00'
ORDER BY qsrs.avg_duration DESC;
```

---

## CI/CD for Schema Changes

Ad-hoc schema changes applied directly through SSMS or one-off scripts have no version control, no audit trail, and no rollback path. When a change is applied on staging but missed on production, or when an emergency fix needs to be reversed, there is no systematic way to determine what state the database is currently in relative to the codebase.

Schema migration tools solve this by maintaining a version tracking table inside the database. Every migration script is recorded in this table (by filename, version, checksum, and timestamp) when first applied. On subsequent runs the tool compares the tracking table to the available scripts and executes only the pending ones — always in sequential order, never re-applying what has already run.

### Migration tools | schema versioning | tool comparison

The four approaches differ primarily in how "version state" is modeled: migration-based tools track which scripts have been run; state-based tools compare desired schema to current schema and generate a diff. The choice affects rollback strategy and CI/CD complexity.

#### Flyway, Liquibase, sqlcmd, dacpac — schema migration tool comparison

| Tool | Type | SQL Server Support | How It Works |
|---|---|---|---|
| Flyway | Migration-based | Excellent | Sequential numbered SQL scripts: V001__create_bronze.sql, V002__add_index.sql |
| Liquibase | Changelog-based | Good | XML/YAML/SQL changelogs with preconditions and rollback blocks |
| sqlcmd scripts | Manual | Native | Folder of .sql files run in order, with a version table |
| dacpac / sqlpackage | State-based | Native (MS) | Compare desired state vs current, generate diff script |

Recommended approach for the data pipeline (simple, no extra tools):

```text
pipeline/
└── migrations/
    ├── V001__initial_schema.sql
    ├── V002__add_ohlcv_indexes.sql
    ├── V003__create_gold_views.sql
    ├── V004__add_pulse_tables.sql
    └── V005__scd_type2_stock_dim.sql
```

### Python | pymssql | migration runner

A lightweight Python migration runner replaces a dedicated migration tool when the stack is already Python-heavy and the infrastructure overhead of Flyway or Liquibase is not warranted. The runner creates a `dbo.schema_migrations` tracking table if it does not already exist, queries it to determine which versions have been applied, and executes remaining scripts in filename-sorted order.

#### pymssql migration runner — sequential SQL scripts with version table

The version key is extracted from the filename prefix (the portion before `__`, e.g., `V001` from `V001__initial_schema.sql`) and used as the primary key in the tracking table. After each script executes successfully, the runner inserts a row and commits, so a script that fails mid-execution leaves the database in a known partial state that can be inspected before retrying.

```python
import pymssql
import os
import glob

def run_migrations(conn_params: dict):
    conn = pymssql.connect(**conn_params)
    cursor = conn.cursor()

    cursor.execute("""
        IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'schema_migrations')
        CREATE TABLE dbo.schema_migrations (
            version VARCHAR(100) PRIMARY KEY,
            applied_at DATETIME2 DEFAULT GETUTCDATE(),
            checksum VARCHAR(64)
        )
    """)

    cursor.execute("SELECT version FROM dbo.schema_migrations")
    applied = {row[0] for row in cursor.fetchall()}

    migration_files = sorted(glob.glob("pipeline/migrations/V*.sql"))
    for f in migration_files:
        version = os.path.basename(f).split("__")[0]  # e.g., "V001"
        if version in applied:
            continue

        print(f"Applying migration: {os.path.basename(f)}")
        with open(f) as sql_file:
            sql = sql_file.read()

        cursor.execute(sql)
        cursor.execute(
            "INSERT INTO dbo.schema_migrations (version) VALUES (%s)",
            (version,)
        )
        conn.commit()
        print(f"  ✓ {version} applied")

    conn.close()
```

#### PythonOperator run_migrations — Airflow DAG migration task

Placing the migration runner as the first task in the DAG ensures that every pipeline run verifies schema state before any data loading begins. The DAG fails at the migration task if a pending migration cannot be applied cleanly, preventing downstream tasks from running against an unexpected schema.

```python
run_migrations_task = PythonOperator(
    task_id='run_schema_migrations',
    python_callable=run_migrations,
    op_kwargs={'conn_params': SQL_CONN_PARAMS},
)
run_migrations_task >> load_bronze >> transform_silver >> compute_gold
```

### SQL | migration | idempotency rules

An idempotent migration script produces the same result whether it runs against a fresh database or one that already has the change applied. Idempotency is required because migration history can be lost, the same script may target multiple environments in different states, and partial failures can leave a database in an unknown intermediate state.

#### IF NOT EXISTS, IF COL_LENGTH — rules for idempotent migrations

- Always guard DDL with existence checks: use `IF NOT EXISTS` for new objects, `IF COL_LENGTH('table', 'column') IS NULL` before adding a column
- Never modify a migration script that has already been applied — create a new versioned script instead
- For large data migrations: run in batches, not a single transaction
- Test migrations on a restored backup before running on production
- Include both UP and DOWN logic as comments (even if rollback is not automated)

### GitHub Actions | sqlcmd | migration validation in CI

CI syntax validation catches errors before any script reaches a staging or production database. `sqlcmd`'s `SET PARSEONLY ON` mode instructs SQL Server to parse the T-SQL statement without executing it, detecting syntax errors and unresolved object references at compile time. This step runs against a throwaway `tempdb` on a SQL Server container in the CI environment.

#### GitHub Actions — migration validation in CI with sqlcmd

```yaml
# .github/workflows/validate-migrations.yml
- name: Validate SQL migrations
  run: |
    for f in pipeline/migrations/V*.sql; do
      echo "Checking syntax: $f"
      sqlcmd -S localhost -U sa -P $SA_PASSWORD -d tempdb \
        -Q "SET PARSEONLY ON; $(cat $f)" -C
    done
```

---

## Connection Pool Management

Each SQL Server connection consumes approximately 2 MB of server memory (TDS protocol buffers, session metadata, and working memory). On a 16 GB VM where SQL Server is configured to use 8 GB — leaving 8 GB for the OS and other processes — 400 uncontrolled connections would exhaust all available OS memory. Connection pool management bounds this count by reusing physical connections across logical operations rather than opening a new TCP connection for every query.

### Python | pymssql / SQLAlchemy | connection pooling

pymssql opens a new raw TCP connection to SQL Server on every `pymssql.connect()` call using the TDS (Tabular Data Stream) protocol. There is no built-in connection pool — the library delegates lifecycle management entirely to the calling application. Opening connections without closing them leaks both OS socket descriptors and SQL Server session objects, which accumulate until the server exhausts its worker thread pool.

#### pymssql connection pooling — one connection per task, sqlalchemy pool

For the Airflow pipeline: open one connection per task function, execute all queries within that connection, and close when done. Do not open a new connection per query — each `pymssql.connect()` is a TCP handshake plus SQL Server login negotiation.

For high-throughput use cases (web services, concurrent workers): use `sqlalchemy` with `create_engine(..., pool_size=5, max_overflow=2)`. SQLAlchemy's connection pool recycles physical connections across logical `with engine.connect()` blocks, keeping the physical connection count bounded.

### C# | ADO.NET | connection pool configuration

ADO.NET implements connection pooling entirely client-side, transparent to the application. The pool is maintained per exact connection string: two strings that differ only in whitespace or keyword ordering are treated as distinct strings and each creates a separate pool. The default `Max Pool Size` is **100 connections** per pool. At `Min Pool Size = 0` (the default), idle connections are returned to the OS when the application is idle; a positive `Min Pool Size` keeps a floor of live connections open, reducing latency on the first request after a quiet period.

> [!warning] Pool Fragmentation with Windows Authentication
>
> When using Integrated Security (Windows Authentication), ADO.NET creates one connection pool per Windows identity. In multi-user scenarios this produces many separate pools — each with up to 100 connections — consuming far more server connections than expected. Use SQL Server Authentication with a dedicated service account for pipeline workloads to keep the pool count predictable and bounded.

> [!success] Predictable Connection Counts for Pipeline Services
>
> Use a dedicated SQL Server login (`dashboard_svc`, `pipeline_svc`) with explicit `Min Pool Size` and `Max Pool Size` in the connection string. One connection string → one pool → bounded connection count. Monitor actual connection counts via `sys.dm_exec_sessions` (see next section).

#### ADO.NET Min/Max Pool Size — C# connection pooling configuration

The connection string below sets a minimum of 2 warm connections (kept open even when the application is idle) and a hard ceiling of 20. When all 20 connections are checked out and the application requests another, ADO.NET waits up to `Connection Timeout` seconds (default 15) before throwing an `InvalidOperationException`.

```csharp
"Server=127.0.0.1,1435;Database=analytics_db;User Id=dashboard_svc;Password=...;
 Min Pool Size=2;Max Pool Size=20;Connection Timeout=15;"
```

### SQL Server | DMV | connection monitoring

`sys.dm_exec_sessions` is a server-scoped dynamic management view that returns one row per active connection, including both user sessions and internal SQL Server background processes. The `is_user_process = 1` filter restricts results to application-created connections, excluding the engine's own workers. The `status` column distinguishes connections actively executing SQL (`running`) from those waiting for a new command from the client (`sleeping`).

#### sys.dm_exec_sessions program_name — monitor connection count by application

The first query groups sessions by `program_name` (the application name set in the connection string, e.g., `SSMS`, `pymssql`, or a custom value via `Application Name=pipeline`) and `login_name`, counting total, idle, and active connections per group. Use this to verify that pool bounds are being respected and to detect leaks where idle connections accumulate over time.

The second query identifies sessions that have been sleeping for more than one hour — a common symptom of a crashed Airflow task that exited without calling `conn.close()`.

```sql
SELECT
    program_name,
    login_name,
    COUNT(*) AS connections,
    SUM(CASE WHEN status = 'sleeping' THEN 1 ELSE 0 END) AS idle,
    SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) AS active
FROM sys.dm_exec_sessions
WHERE is_user_process = 1
GROUP BY program_name, login_name
ORDER BY connections DESC;

-- Identify sessions sleeping for more than 1 hour
SELECT session_id, login_name, program_name, last_request_end_time
FROM sys.dm_exec_sessions
WHERE is_user_process = 1
  AND status = 'sleeping'
  AND last_request_end_time < DATEADD(HOUR, -1, GETDATE());
```

> [!warning] Never Automate Session Kills
>
> Automatically killing sleeping sessions can terminate legitimate long-running transactions mid-write, causing data corruption or extended rollback times. Always identify the session and understand why it's sleeping before killing it manually with `KILL <session_id>`.

> [!success] Safe Pattern — Manual Review Before Kill
>
> Use the identification query to inspect `login_name`, `program_name`, and `last_request_end_time` before acting. If the session belongs to an Airflow task that crashed without closing its connection, coordinate with the pipeline team and close the connection at the application level first. Only use `KILL <session_id>` after confirming the session is truly orphaned and holds no active transaction.

---

## Datadog SQL Server Agent — Full Configuration

The complete Datadog agent configuration for the example SQL Server instance, with deep monitoring enabled and custom queries for pipeline-critical metrics.

### Datadog | SQL Server | agent configuration file

The `dbm: true` flag enables Database Monitoring, which unlocks query samples, wait event collection, and execution plan capture. The three `custom_queries` blocks track Page Life Expectancy (buffer pool health), cumulative wait times by category (IO, lock, log), and the current count of blocked processes — the three metrics most directly affected by heavy pipeline workloads.

#### Datadog sqlserver.d conf.yaml — full DBM configuration with custom queries

```yaml
# /etc/datadog-agent/conf.d/sqlserver.d/conf.yaml
init_config:

instances:
  - host: localhost,1433
    username: dd_agent
    password: <DD_AGENT_PASSWORD>
    connector: odbc
    driver: ODBC Driver 18 for SQL Server
    TrustServerCertificate: 'yes'
    database: analytics_db

    # Enable deep monitoring
    dbm: true
    query_metrics:
      enabled: true
    query_samples:
      enabled: true
    query_activity:
      enabled: true

    # Custom queries for pipeline monitoring
    custom_queries:
      - query: >
          SELECT
            cntr_value AS page_life_expectancy
          FROM sys.dm_os_performance_counters
          WHERE counter_name = 'Page life expectancy'
            AND object_name LIKE '%Buffer Manager%'
        columns:
          - name: sqlserver.buffer.page_life_expectancy
            type: gauge
        tags:
          - db:analytics_db
          - env:production

      - query: >
          SELECT
            SUM(CASE WHEN wait_type LIKE 'PAGEIOLATCH%' THEN wait_time_ms ELSE 0 END) AS io_waits_ms,
            SUM(CASE WHEN wait_type LIKE 'LCK_M%' THEN wait_time_ms ELSE 0 END) AS lock_waits_ms,
            SUM(CASE WHEN wait_type = 'WRITELOG' THEN wait_time_ms ELSE 0 END) AS log_waits_ms
          FROM sys.dm_os_wait_stats
        columns:
          - name: sqlserver.waits.io_ms
            type: monotonic_count
          - name: sqlserver.waits.lock_ms
            type: monotonic_count
          - name: sqlserver.waits.log_ms
            type: monotonic_count
        min_collection_interval: 30

      - query: >
          SELECT COUNT(*) AS blocked_count
          FROM sys.dm_exec_requests
          WHERE blocking_session_id > 0
        columns:
          - name: sqlserver.blocked_processes
            type: gauge
        min_collection_interval: 15
```

### Datadog | SQL Server | alert thresholds and permissions

Alert thresholds for the four pipeline-critical metrics, and the minimum SQL Server permissions required by the Datadog agent login.

#### Datadog sqlserver.buffer, sqlserver.waits — alert thresholds

| Metric | Warning | Alert | Action |
|---|---|---|---|
| `sqlserver.buffer.page_life_expectancy` | < 600 | < 300 | [memory-and-buffer-pool](https://alp78.github.io/elysium/04-SQL-Server/Performance/memory-and-buffer-pool) — check buffer pool, add RAM |
| `sqlserver.waits.io_ms` (rate) | > 500ms/s | > 1000ms/s | [wait-stats-analysis](https://alp78.github.io/elysium/04-SQL-Server/Performance/wait-stats-analysis) — check PAGEIOLATCH, add indexes |
| `sqlserver.waits.lock_ms` (rate) | > 100ms/s | > 500ms/s | [blocking-and-locking](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/blocking-and-locking) — check for blocking chains |
| `sqlserver.blocked_processes` | > 0 | > 5 | [blocking-and-locking](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/blocking-and-locking) — find head blocker |

#### CREATE LOGIN datadog — Datadog monitoring with minimum permissions

The Datadog agent requires `VIEW SERVER STATE` to read DMVs, `VIEW ANY DEFINITION` to inspect object metadata, `CONNECT ANY DATABASE` to enumerate all databases, and `db_datareader` role membership on each monitored database to support deep monitoring query sampling.

```sql
CREATE LOGIN dd_agent WITH PASSWORD = 'DD_AGENT_PASSWORD';
CREATE USER dd_agent FOR LOGIN dd_agent;

GRANT VIEW SERVER STATE TO dd_agent;
GRANT VIEW ANY DEFINITION TO dd_agent;
GRANT CONNECT ANY DATABASE TO dd_agent;
EXEC sp_addrolemember 'db_datareader', 'dd_agent';  -- on each database to monitor
```

---

### Related

- [execution-plans](https://alp78.github.io/elysium/04-SQL-Server/Performance/execution-plans) — using Query Store to find the most expensive queries during a specific DAG run window
- [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/Performance/performance-audit-playbook) — Phase 5 (expensive queries) using the same DMVs as the Datadog custom query
- [wait-stats-analysis](https://alp78.github.io/elysium/04-SQL-Server/Performance/wait-stats-analysis) — wait types generated by pipeline queries: PAGEIOLATCH, WRITELOG, LCK_M
- [race-conditions](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/race-conditions) — Airflow `max_active_runs=1` as the primary pipeline serialization defense
- [blocking-and-locking](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/blocking-and-locking) — understanding why a sleeping connection might be holding locks
- [merge-and-upsert](https://alp78.github.io/elysium/04-SQL-Server/T-SQL/merge-and-upsert) — transaction management patterns that affect connection lifecycle
