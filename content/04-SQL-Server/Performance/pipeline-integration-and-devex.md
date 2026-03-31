---
type: how-to
category: sql-server
technology: [sql-server, python, airflow]
tags: [pipeline, python, sql, airflow, sql-server, tsql]
aliases: [pipeline integration, SQL comment tagging, Airflow SQL correlation, schema migrations, Flyway SQL Server, Liquibase SQL Server, connection pool management, developer experience]
keywords: [query tagging, SQL comment, dag_id, task_id, run_id, dm_exec_sql_text, Query Store, schema migrations, Flyway, Liquibase, sqlpackage, dacpac, migration runner, schema_migrations table, connection pool, pymssql, sqlalchemy, ADO.NET, pool_size, max_overflow, connection count, dm_exec_sessions, Datadog tagging, pipeline observability, CI/CD SQL, GitHub Actions, PARSEONLY, idempotent migration]
description: "Developer experience patterns for SQL Server pipeline integration: tagging queries with Airflow context for monitoring correlation, schema migration management (Flyway/Python runner), and connection pool management for pymssql and ADO.NET."
created: 2026-03-22
updated: 2026-03-22
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

**Problem:** when a DAG run causes a CPU or IO spike, it's hard to correlate SQL metrics with the specific DAG that triggered them. You see a latency spike in Datadog at 09:05 UTC but have three DAGs that could have been running at that time.

**Solution:** tag every SQL query with Airflow metadata in a comment header so monitoring tools can slice by DAG, task, and run.

#### SQL comment header tagging — Airflow DAG, task, run metadata in queries

```python
# In your pipeline task function
dag_context = f"/* dag={dag_id} task={task_id} run={run_id} */"
cursor.execute(f"{dag_context} MERGE INTO silver.stock_dim ...")
```

These comments appear in:

- `sys.dm_exec_sql_text` (query text) — visible in all DMV-based monitoring
- Query Store (if enabled) — persists across restarts
- Datadog SQL query metrics — enables filtering and grouping

#### Datadog dbm custom_queries — surface DAG-tagged SQL queries

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
    # Custom query to tag slow queries by DAG
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

#### sys.query_store_query_text — correlate pipeline queries without Datadog

```sql
-- Find the most expensive queries during a specific time window (when DAG ran)
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

**Problem:** index changes, new columns, new tables are applied ad-hoc via SSMS or scripts. No version control, no rollback path, no audit trail.

#### Flyway, Liquibase, sqlcmd, dacpac — schema migration tool comparison

| Tool | Type | SQL Server Support | How It Works |
|---|---|---|---|
| Flyway | Migration-based | Excellent | Sequential numbered SQL scripts: V001__create_bronze.sql, V002__add_index.sql |
| Liquibase | Changelog-based | Good | XML/YAML/SQL changelogs with preconditions and rollback blocks |
| sqlcmd scripts | Manual | Native | Folder of .sql files run in order, with a version table |
| dacpac / sqlpackage | State-based | Native (MS) | Compare desired state vs current, generate diff script |

**Recommended approach for the data pipeline** (simple, no extra tools):

```
pipeline/
└── migrations/
    ├── V001__initial_schema.sql
    ├── V002__add_ohlcv_indexes.sql
    ├── V003__create_gold_views.sql
    ├── V004__add_pulse_tables.sql
    └── V005__scd_type2_stock_dim.sql
```

#### pymssql migration runner — sequential SQL scripts with version table

```python
import pymssql
import os
import glob

def run_migrations(conn_params: dict):
    conn = pymssql.connect(**conn_params)
    cursor = conn.cursor()

    # Create migration tracking table
    cursor.execute("""
        IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'schema_migrations')
        CREATE TABLE dbo.schema_migrations (
            version VARCHAR(100) PRIMARY KEY,
            applied_at DATETIME2 DEFAULT GETUTCDATE(),
            checksum VARCHAR(64)
        )
    """)

    # Get already-applied migrations
    cursor.execute("SELECT version FROM dbo.schema_migrations")
    applied = {row[0] for row in cursor.fetchall()}

    # Find and run pending migrations
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

```python
# In the DAG definition, run migrations as the first task
run_migrations_task = PythonOperator(
    task_id='run_schema_migrations',
    python_callable=run_migrations,
    op_kwargs={'conn_params': SQL_CONN_PARAMS},
)
run_migrations_task >> load_bronze >> transform_silver >> compute_gold
```

#### IF NOT EXISTS, IF COL_LENGTH — rules for idempotent migrations

- Always idempotent (use `IF NOT EXISTS`, `IF COL_LENGTH IS NULL`, etc.)
- Never modify a migration that has already been applied
- Large data migrations: run in batches, not one giant transaction
- Test migrations on a restored backup before running on production
- Include both UP and DOWN logic as comments (even if you don't automate rollback)

#### GitHub Actions — migration validation in CI with sqlcmd

```yaml
# .github/workflows/validate-migrations.yml
- name: Validate SQL migrations
  run: |
    for f in pipeline/migrations/V*.sql; do
      echo "Checking syntax: $f"
      # Parse-only check (catches syntax errors without executing)
      sqlcmd -S localhost -U sa -P $SA_PASSWORD -d tempdb \
        -Q "SET PARSEONLY ON; $(cat $f)" -C
    done
```

---

## Connection Pool Management

**Why it matters:** each SQL Server connection consumes approximately 2 MB of memory. Uncontrolled pooling can exhaust server memory on a 16 GB VM (8 GB reserved for SQL Server, 8 GB for OS — 400 connections would consume all OS memory).

#### pymssql connection pooling — one connection per task, sqlalchemy pool

pymssql does NOT pool connections natively. Each `pymssql.connect()` opens a new TCP connection.

- For the pipeline: open one connection per task, close when done. Don't open per-query.
- For high-throughput: use `sqlalchemy` with `create_engine(..., pool_size=5, max_overflow=2)`

#### ADO.NET Min/Max Pool Size — C# connection pooling configuration

ADO.NET pools by default (per connection string). Configure pool limits in the connection string:

```csharp
// Connection string with pool settings
"Server=127.0.0.1,1435;Database=analytics_db;User Id=dashboard_svc;Password=...;
 Min Pool Size=2;Max Pool Size=20;Connection Timeout=15;"
```

#### sys.dm_exec_sessions program_name — monitor connection count by application

```sql
-- Current connection count by application
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

-- Kill orphaned sleeping connections (idle > 1 hour)
-- First identify them, then kill manually — never automate kills without review
SELECT session_id, login_name, program_name, last_request_end_time
FROM sys.dm_exec_sessions
WHERE is_user_process = 1
  AND status = 'sleeping'
  AND last_request_end_time < DATEADD(HOUR, -1, GETDATE());
```

> [!warning] Never Automate Session Kills
>
> Automatically killing sleeping sessions can terminate legitimate long-running transactions mid-write, causing data corruption or extended rollback times. Always identify the session and understand why it's sleeping before killing it manually with `KILL <session_id>`.

---

## Datadog SQL Server Agent — Full Configuration

The complete Datadog agent configuration for the example SQL Server instance, with deep monitoring enabled and custom queries for pipeline-critical metrics:

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

#### Datadog sqlserver.buffer, sqlserver.waits — alert thresholds

| Metric | Warning | Alert | Action |
|---|---|---|---|
| `sqlserver.buffer.page_life_expectancy` | < 600 | < 300 | [memory-and-buffer-pool](https://alp78.github.io/elysium/04-SQL-Server/Performance/memory-and-buffer-pool) — check buffer pool, add RAM |
| `sqlserver.waits.io_ms` (rate) | > 500ms/s | > 1000ms/s | [wait-stats-analysis](https://alp78.github.io/elysium/04-SQL-Server/Performance/wait-stats-analysis) — check PAGEIOLATCH, add indexes |
| `sqlserver.waits.lock_ms` (rate) | > 100ms/s | > 500ms/s | [blocking-and-locking](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/blocking-and-locking) — check for blocking chains |
| `sqlserver.blocked_processes` | > 0 | > 5 | [blocking-and-locking](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/blocking-and-locking) — find head blocker |

#### CREATE LOGIN datadog — Datadog monitoring with minimum permissions

```sql
-- Create Datadog SQL Server login with read-only system view access
CREATE LOGIN dd_agent WITH PASSWORD = 'DD_AGENT_PASSWORD';
CREATE USER dd_agent FOR LOGIN dd_agent;

-- Grant minimum permissions for Datadog deep monitoring (DBM)
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
