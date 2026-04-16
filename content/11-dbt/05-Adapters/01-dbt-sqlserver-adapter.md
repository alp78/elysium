---
title: "01 - dbt: SQL Server Adapter"
tags: [pipeline, sql, dbt]
status: stable
updated: 2026-03-23
description: "SQL Server adapter installation, auth, T-SQL differences, incremental strategy, index post-hooks, and known limitations."
---

# dbt: SQL Server Adapter

> [!quote] Engineering Discipline
>
> "Practices that matured over decades in software engineering should be replicated in data — deployment processes, testing, version control."
>
> — **Tristan Handy** (creator of dbt)

> [!abstract]- Summary
>
> `dbt-sqlserver` connects dbt Core to Microsoft SQL Server and Azure SQL through ODBC, and this note defines the adapter-specific install, connection, incremental, T-SQL, and operational rules needed to run SQL Server targets reliably from Linux-based orchestration.
>
> **Adapter setup and connectivity**
> - Installs `dbt-core` and `dbt-sqlserver` as pinned version pairs, validates the Microsoft ODBC driver on Linux, and notes that driver mismatches cause runtime failures.
> - Frames the adapter as community-maintained rather than dbt Labs-maintained, which changes how cautiously versions and deployment assumptions should be handled.
>
> **Profiles and authentication**
> - Configures `profiles.yml` for SQL authentication on Linux and GCE, with Azure service principal auth only for Azure SQL targets.
> - Documents the core connection parameters: `driver`, `server`, `port`, `authentication`, `TrustServerCertificate`, `encrypt`, `connect_timeout`, and `threads`.
>
> **Incremental behavior and SQL differences**
> - Recommends `incremental_strategy = 'delete+insert'` with overlap windows and source deduplication instead of SQL Server `MERGE` for most incremental models.
> - Notes that `insert_overwrite` is unsupported and maps the recurring T-SQL differences for date arithmetic, date truncation, NULL handling, row limiting, and string functions.
>
> **Physical tuning and platform limits**
> - Uses `post_hook` DDL for nonclustered indexes, `UPDATE STATISTICS` after large incremental loads, and TempDB monitoring for sort, hash, and spool pressure during threaded dbt runs.
> - Requires explicit casting and exact T-SQL type names for contracts, and explains that each dbt thread holds its own ODBC connection for the duration of a run.
>
> **Operations and safety**
> - Warnings: pin adapter and driver versions, keep `encrypt: true`, avoid `MERGE` for duplicate-prone feeds, and size `threads` against TempDB and connection limits.
> - Recommendations table: connection parameter defaults and the known-limitations summary define the safe baseline.
> - Limitations: 7 unsupported or partial features are called out explicitly in the final summary table.

> [!info]- Glossary
>
> **`dbt-sqlserver`**
> - The community adapter package that lets dbt Core compile and run models against Microsoft SQL Server or Azure SQL.
> - It matters here because every installation, auth, incremental, and SQL behavior in the note depends on the adapter's T-SQL and ODBC implementation rather than on dbt Core alone.
>
> > [!warning] Community maintenance boundary
> >
> > The adapter is not maintained by dbt Labs. Treat version pinning and upgrade testing as mandatory because compatibility gaps tend to surface only at runtime.
>
> ---
>
> **Community adapter**
> - An adapter maintained outside the first-party dbt Labs adapter set.
> - It matters here because support expectations, release cadence, and feature completeness differ from adapters such as BigQuery or Snowflake.
>
> > [!warning] Support model differs
> >
> > Assume slower issue resolution and narrower feature coverage than first-party adapters. Operationally, that means pinning versions and avoiding optimistic upgrade plans.
>
> ---
>
> **`ODBC Driver 18 for SQL Server`**
> - Microsoft's ODBC driver used by Linux dbt processes to open SQL Server connections.
> - It matters here because the adapter depends on the exact installed driver string, and driver version mismatches are a common cause of failed runs.
>
> > [!warning] Exact driver string
> >
> > `profiles.yml` must match the installed driver name exactly. Mixing Driver 17 and Driver 18 settings across environments creates hard-to-diagnose deployment drift.
>
> ---
>
> **`profiles.yml`**
> - The dbt profile file that defines named targets and their adapter-specific connection settings.
> - It matters here because SQL Server authentication mode, TLS behavior, thread count, and timeout defaults are all selected there.
>
> > [!info] Runtime control surface
> >
> > Treat the profile as an operational contract, not just a credential file. Subtle changes there alter concurrency, encryption, and connection startup behavior.
>
> ---
>
> **SQL authentication**
> - Username-and-password authentication handled directly by SQL Server rather than by a Windows-integrated domain identity.
> - It matters here because it is the practical baseline for Linux, GCE, Cloud Run, and WSL deployments where Kerberos and domain join are usually unavailable.
>
> > [!warning] Default Linux path
> >
> > For Linux-hosted dbt, this is the simplest reliable option. Trying to force Windows-integrated auth into non-domain infrastructure usually adds more fragility than security value.
>
> ---
>
> **Service principal**
> - An Azure AD application identity that can authenticate to Azure SQL without using a human user account.
> - It matters here because the note distinguishes Azure SQL auth patterns from ordinary SQL Server auth patterns.
>
> > [!danger] Secret-backed identity
> >
> > Client secret handling becomes part of the data-platform security boundary. Scope the principal narrowly and store its secret outside the repo and local profile text.
>
> ---
>
> **`TrustServerCertificate`**
> - An ODBC connection property that decides whether the server certificate is validated during TLS negotiation.
> - It matters here because dev and staging often use self-signed certificates, while production should validate the certificate chain.
>
> > [!warning] Encryption is separate
> >
> > This setting does not turn TLS on or off. It only controls certificate verification, so `encrypt: true` still needs to stay enabled.
>
> ---
>
> **`encrypt`**
> - The connection setting that enables TLS for traffic between the dbt process and SQL Server.
> - It matters here because ODBC Driver 18 expects encrypted connections and the safe production baseline is to keep encryption enabled everywhere.
>
> > [!danger] Do not disable TLS
> >
> > Turning this off weakens transport security and can also diverge from modern driver defaults. The correct adjustment for self-signed certs is certificate trust policy, not disabling encryption.
>
> ---
>
> **Incremental model**
> - A dbt model that reprocesses only new or changed slices of data instead of rebuilding the full table every run.
> - It matters here because the adapter's locking, deduplication, and strategy choices directly affect correctness and runtime cost for SQL Server targets.
>
> > [!info] Adapter-specific semantics
> >
> > Incremental materialization names look portable across dbt adapters, but their generated SQL and operational behavior are not. Always check the target adapter's implementation details.
>
> ---
>
> **`delete+insert`**
> - The SQL Server incremental strategy that removes target rows matching the incremental batch keys and then inserts the replacement rows.
> - It matters here because the note treats it as the safer default for duplicate-prone source feeds and more predictable locking behavior.
>
> > [!warning] Deduplicate first
> >
> > This strategy is safer than `MERGE`, but it still assumes the incoming batch is logically clean. Use a `ROW_NUMBER()` deduplication CTE when the feed can repeat keys.
>
> ---
>
> **`MERGE`**
> - The T-SQL statement behind the adapter's merge-based incremental strategy.
> - It matters here because its duplicate-key behavior, lock escalation, and TempDB overhead make it risky for many warehouse-style dbt workloads.
>
> > [!warning] Not the safe default
> >
> > `MERGE` looks convenient, but SQL Server's edge cases are real enough that the note explicitly recommends avoiding it unless true upsert semantics are required.
>
> ---
>
> **`post_hook`**
> - A dbt configuration hook that runs SQL after a model finishes building.
> - It matters here because SQL Server indexing and statistics maintenance are attached to dbt models through post-run DDL and maintenance statements.
>
> > [!warning] Idempotence matters
> >
> > Incremental models keep the target table between runs. Any `CREATE INDEX` logic in a hook must guard against reruns or the second execution will fail.
>
> ---
>
> **TempDB**
> - SQL Server's shared system database for spills, spools, sorts, hashes, and other transient worktables.
> - It matters here because threaded dbt runs can create concurrent TempDB pressure even when the user models themselves are simple.
>
> > [!warning] Shared-instance pressure point
> >
> > TempDB becomes the first bottleneck before CPU in many warehouse runs. Raise dbt thread counts only after confirming file layout, free space, and spill behavior.
>
> ---
>
> **`UPDATE STATISTICS`**
> - A T-SQL maintenance command that refreshes optimizer statistics on a table or index.
> - It matters here because stale statistics after large incremental loads can degrade query plans for downstream analytical reads.
>
> > [!info] Accuracy versus runtime
> >
> > `FULLSCAN` improves cardinality estimates but costs more to run. Choose sampling deliberately on large tables instead of treating stats refresh as free.
>
> ---
>
> **Contracts**
> - dbt schema declarations that enforce column names and data types at build time.
> - It matters here because SQL Server contract enforcement only works cleanly when the model SQL casts explicitly and the YAML uses exact T-SQL type names.
>
> > [!warning] Type names must match
> >
> > Adapter portability stops here. A logical type name that is acceptable elsewhere can still fail on SQL Server if the schema YAML does not use the T-SQL spelling the adapter expects.
>
> ---
>
> **`threads`**
> - The dbt profile setting that controls how many models or queries dbt can execute concurrently.
> - It matters here because each SQL Server thread maps to a separate ODBC connection and increases TempDB, lock, and connection pressure on the instance.
>
> > [!warning] Concurrency is physical
> >
> > On SQL Server, thread count is not an abstract performance knob. It changes live connection load and spill pressure, so start conservatively and tune from observed behavior.

## SQL Server Adapter Installation

```bash
# Pin both packages together — mismatches cause silent runtime errors
pip install dbt-core==1.8.* dbt-sqlserver==1.8.*

# Verify ODBC driver is present (Linux prerequisite)
odbcinst -q -d | grep -i sql
# Expected: [ODBC Driver 18 for SQL Server]
```

Install the Microsoft ODBC driver on Debian/Ubuntu before installing the Python package:

```bash
curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add -
curl https://packages.microsoft.com/config/ubuntu/22.04/prod.list \
  > /etc/apt/sources.list.d/mssql-release.list
apt-get update && ACCEPT_EULA=Y apt-get install -y msodbcsql18
```

> [!warning] Driver version matters
>
> `dbt-sqlserver` ≥ 1.7 defaults to ODBC Driver 18. Driver 17 is still accepted but requires setting `driver: ODBC Driver 17 for SQL Server` explicitly in `profiles.yml`. Do not mix driver versions across environments.

> [!success] Pin driver version explicitly
>
> Always set `driver: "ODBC Driver 18 for SQL Server"` explicitly in every `profiles.yml` output block. Verify with `odbcinst -q -d` before deploying to a new environment. Use the same driver string in dev, staging, and prod to prevent environment-specific failures.

---

## profiles.yml

### SQL Authentication (recommended on Linux / GCE)

Kerberos and Windows Integrated Auth require domain-joined machines. On GCE Linux VMs, **SQL auth is the only method that works without significant infrastructure overhead**.

```yaml
# ~/.dbt/profiles.yml
financial_index:
  target: dev
  outputs:

    dev:
      type: sqlserver
      driver: "ODBC Driver 18 for SQL Server"
      server: 10.0.0.5          # or FQDN / Cloud SQL proxy address
      port: 1433
      database: FinancialIndex
      schema: dbt_dev
      user: "{{ env_var('DBT_SQL_USER') }}"
      password: "{{ env_var('DBT_SQL_PASSWORD') }}"
      authentication: sql
      # TLS — set to 1 when using a self-signed cert (dev/staging)
      TrustServerCertificate: true
      encrypt: true
      connect_timeout: 30
      threads: 4

    prod:
      type: sqlserver
      driver: "ODBC Driver 18 for SQL Server"
      server: sql-prod.internal
      port: 1433
      database: FinancialIndex
      schema: dbt_prod
      user: "{{ env_var('DBT_SQL_USER') }}"
      password: "{{ env_var('DBT_SQL_PASSWORD') }}"
      authentication: sql
      TrustServerCertificate: false   # prod must have a valid cert
      encrypt: true
      connect_timeout: 60
      threads: 8
```

> [!note] Certificate vs encryption settings
>
> These are distinct ODBC connection string properties. `encrypt=true` enables TLS negotiation; `TrustServerCertificate=true` skips certificate validation. Always use `encrypt=true` — the certificate setting controls only whether the cert is verified, not whether the channel is encrypted.

### Azure AD / Service Principal (Azure SQL only)

```yaml
    azure_prod:
      type: sqlserver
      driver: "ODBC Driver 18 for SQL Server"
      server: esg-provider.database.windows.net
      port: 1433
      database: ESGScores
      schema: dbt_prod
      authentication: serviceprincipal
      tenant_id: "{{ env_var('AZURE_TENANT_ID') }}"
      client_id: "{{ env_var('AZURE_CLIENT_ID') }}"
      client_secret: "{{ env_var('AZURE_CLIENT_SECRET') }}"
      encrypt: true
      TrustServerCertificate: false
      threads: 4
```

---

### SQL Server Connection Parameters Reference

| Parameter | Type | Notes |
|---|---|---|
| `driver` | string | Full ODBC driver string — must match `odbcinst -q -d` output |
| `server` | string | Hostname, IP, or named instance (`host\INSTANCE`) |
| `port` | int | Default 1433; named instances often use dynamic ports |
| `authentication` | string | `sql`, `ActiveDirectoryPassword`, `serviceprincipal`, `ActiveDirectoryIntegrated` |
| `TrustServerCertificate` | bool | Set `true` only in dev/staging with self-signed certs |
| `encrypt` | bool | Always `true`; required by ODBC Driver 18 by default |
| `connect_timeout` | int | Seconds before connection attempt fails; default 0 (infinite) |
| `threads` | int | dbt parallelism — each thread holds one ODBC connection |

---

## Incremental Strategy: delete+insert

SQL Server's `MERGE` statement has well-documented edge conditions. The `dbt-sqlserver` adapter's `merge` strategy can produce duplicate rows when the source contains duplicate keys — a real risk with ESG raw feed data. **Prefer `delete+insert`** for most incremental models.

```sql
-- models/int/int_esg_scores_incremental.sql
{{
  config(
    materialized   = 'incremental',
    unique_key     = 'score_id',
    incremental_strategy = 'delete+insert',
    on_schema_change = 'append_new_columns'
  )
}}

with source as (
    select
        score_id,
        isin,
        provider_code,
        score_date,
        environmental_score,
        social_score,
        governance_score,
        composite_score,
        GETDATE()           as dbt_loaded_at
    from {{ ref('stg_esg_raw_scores') }}
    {% if is_incremental() %}
    where score_date > (
        select DATEADD(day, -3, MAX(score_date))   -- 3-day overlap window
        from {{ this }}
    )
    {% endif %}
)

select * from source
```

> [!warning] MERGE gotchas on SQL Server
>
> The `merge` incremental strategy issues a T-SQL `MERGE` statement. Known issues:
> - **Non-deterministic updates**: if the source has duplicate `unique_key` values, SQL Server raises an error or silently picks a row depending on the version.
> - **Table-level lock escalation**: `MERGE` can escalate to a table lock on large targets, blocking concurrent reads from BI tools.
> - **Halloween protection overhead**: SQL Server applies extra spool operators inside `MERGE` plans, increasing TempDB usage.
>
> Use `delete+insert` unless you specifically need the upsert semantics of `merge`.

> [!success] Use delete+insert with a deduplication CTE
>
> Set `incremental_strategy = 'delete+insert'` and wrap the source query in a CTE that deduplicates on `unique_key` using `ROW_NUMBER()`. This avoids MERGE lock escalation and produces deterministic results even when the upstream feed delivers duplicate rows.

### insert_overwrite is not supported

Unlike BigQuery or Spark adapters, `dbt-sqlserver` does not implement `insert_overwrite`. Partition-swap patterns must be emulated with pre/post hooks or custom incremental logic.

---

## T-SQL Differences From Standard SQL

These surface constantly when porting models from BigQuery or Snowflake.

### Date and Time

```sql
-- Current timestamp
GETDATE()               -- T-SQL specific; returns datetime
CURRENT_TIMESTAMP       -- ANSI SQL; identical result in SQL Server — prefer this for portability
SYSDATETIMEOFFSET()     -- Returns datetimeoffset with timezone; use for audit columns

-- Date arithmetic — SQL Server has no interval arithmetic
-- BigQuery: DATE_ADD(score_date, INTERVAL 1 MONTH)
-- SQL Server:
DATEADD(month, 1, score_date)
DATEADD(day,  -3, GETDATE())

-- Date truncation — SQL Server has no DATE_TRUNC
-- Truncate to month start:
DATEADD(month, DATEDIFF(month, 0, score_date), 0)
-- Truncate to week (Monday):
DATEADD(week,  DATEDIFF(week,  0, score_date), 0)
```

### NULL Handling

```sql
-- Prefer COALESCE (ANSI) over ISNULL (T-SQL only)
-- ISNULL truncates to the datatype of the first argument
ISNULL(composite_score, 0)       -- truncates if composite_score is float but 0 is int
COALESCE(composite_score, 0.0)   -- safer, ANSI compliant

-- Safe division
-- BigQuery: SAFE_DIVIDE(a, b)
-- SQL Server: use NULLIF to avoid divide-by-zero
CASE WHEN denominator = 0 THEN NULL
     ELSE numerator * 1.0 / denominator
END
-- Or equivalently:
numerator * 1.0 / NULLIF(denominator, 0)
```

### Row Limiting

```sql
-- No LIMIT in T-SQL
-- BigQuery / Postgres:
SELECT * FROM stg_index_constituents LIMIT 100;

-- SQL Server:
SELECT TOP 100 * FROM stg_index_constituents;
-- With ORDER BY (required for deterministic results):
SELECT TOP 100 * FROM stg_index_constituents ORDER BY as_of_date DESC;

-- For pagination: use OFFSET/FETCH (SQL Server 2012+)
SELECT * FROM stg_index_constituents
ORDER BY as_of_date DESC
OFFSET 0 ROWS FETCH NEXT 100 ROWS ONLY;
```

### String Functions

```sql
-- Concatenation: use + or CONCAT() — do not use || (Postgres syntax)
SELECT isin + '_' + provider_code   AS score_key   -- breaks if either is NULL
SELECT CONCAT(isin, '_', provider_code) AS score_key  -- NULL-safe

-- String splitting: STRING_SPLIT (SQL Server 2016+)
SELECT value FROM STRING_SPLIT(tag_list, ',')
```

---

### SQL Server Post-Hook Indexes

SQL Server does not auto-create indexes on dbt-managed tables. For guidance on choosing between clustered, non-clustered, and columnstore indexes, see [index-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/index-types-and-strategy). For incremental models queried by date range or ISIN, add non-clustered indexes via `post_hook`.

```sql
-- models/mart/mart_esg_scores.sql
{{
  config(
    materialized = 'table',
    post_hook    = [
      "IF NOT EXISTS (
         SELECT 1 FROM sys.indexes
         WHERE name = 'nci_mart_esg_scores_isin_date'
           AND object_id = OBJECT_ID('{{ this }}')
       )
       CREATE NONCLUSTERED INDEX nci_mart_esg_scores_isin_date
         ON {{ this }} (isin, score_date)
         INCLUDE (composite_score, environmental_score, social_score, governance_score)",

      "IF NOT EXISTS (
         SELECT 1 FROM sys.indexes
         WHERE name = 'nci_mart_esg_scores_provider_date'
           AND object_id = OBJECT_ID('{{ this }}')
       )
       CREATE NONCLUSTERED INDEX nci_mart_esg_scores_provider_date
         ON {{ this }} (provider_code, score_date DESC)"
    ]
  )
}}
```

> [!tip] Idempotent index creation
>
> Always guard `CREATE INDEX` with an existence check. dbt `table` models drop and recreate the object, so the index is rebuilt every run — but `incremental` models keep the table, meaning the post-hook will fail on the second run without the guard.

---

### Statistics Update After Incremental Loads

SQL Server's query optimizer relies on column statistics. After large incremental appends, stale statistics cause poor query plans. Add an `UPDATE STATISTICS` post-hook on high-churn incremental models.

```sql
{{
  config(
    materialized         = 'incremental',
    unique_key           = 'score_id',
    incremental_strategy = 'delete+insert',
    post_hook            = "UPDATE STATISTICS {{ this }} WITH FULLSCAN"
  )
}}
```

For very large tables, `WITH SAMPLE 30 PERCENT` is faster at the cost of some accuracy. `FULLSCAN` is appropriate for tables under ~50 million rows.

---

### TempDB Impact During dbt Runs

SQL Server uses TempDB for intermediate spools, sort operations, and hash joins. Multi-threaded dbt runs generate concurrent TempDB activity.

Key points:

- **Threads setting**: each thread runs queries concurrently. On a shared instance, `threads: 4` is a safe default. Increase only after confirming TempDB has adequate space and the instance is not shared with OLTP workloads.
- **Spill monitoring**: query `sys.dm_exec_query_stats` or use Extended Events to detect sort/hash spills during dbt runs.
- **TempDB file count**: pre-create TempDB data files equal to the number of logical CPU cores (up to 8) to reduce allocation contention.

```sql
-- Check TempDB space usage during a run
SELECT
    SUM(unallocated_extent_page_count) * 8 / 1024.0  AS free_mb,
    SUM(internal_object_reserved_page_count) * 8 / 1024.0  AS internal_objects_mb,
    SUM(user_object_reserved_page_count) * 8 / 1024.0  AS user_objects_mb
FROM sys.dm_db_file_space_usage
WHERE database_id = 2;  -- TempDB is always DB 2
```

---

### SQL Server Column Type Inference Limitation

`dbt-sqlserver` does not infer column data types from Python type annotations or schema YAML `data_type` fields in the same way as the Snowflake adapter. Explicit casting is required in model SQL.

```sql
-- Do not rely on implicit casting
SELECT
    CAST(isin AS NVARCHAR(12))              AS isin,
    CAST(score_date AS DATE)                AS score_date,
    CAST(composite_score AS DECIMAL(10,4))  AS composite_score,
    CAST(is_constituent AS BIT)             AS is_constituent
FROM {{ ref('stg_esg_raw_scores') }}
```

When using `contracts` with `dbt-sqlserver`, all columns must have explicit `data_type` in the schema YAML, and the types must match T-SQL names exactly (`nvarchar`, `decimal`, `bit`, not `varchar`, `numeric`, `boolean`).

---

### SQL Server Connection Pooling and Threads

`dbt-sqlserver` does not use a persistent connection pool — each thread opens a new ODBC connection at the start of the run and holds it for the duration. Implications:

- **SQL Server max connections**: `threads: N` means N simultaneous connections. On SQL Server Express (32,767 connection limit) this is not a concern; on Azure SQL Basic tier it is.
- **Connection timeout under load**: with 8+ threads hitting a cold SQL Server instance, increase `connect_timeout` to 60.
- **No connection reuse between dbt invocations**: each `dbt run` opens fresh connections. CI pipelines running many dbt invocations in parallel need to account for connection count multiplied by concurrent jobs.

```yaml
# Safe starting point for a shared SQL Server instance
threads: 4
connect_timeout: 60
```

---

### SQL Server Adapter Known Limitations Summary

| Feature | Status | Notes |
|---|---|---|
| `insert_overwrite` strategy | Not supported | Emulate with pre/post hooks |
| `on_conflict` clause | Not supported | Use `delete+insert` |
| Column data type inference | Partial | Explicit casts required in SQL |
| Materialized views | Not supported | Use `table` materialization |
| `dbt clone` | Not supported | No `CREATE TABLE ... CLONE` in T-SQL |
| Python models | Not supported | No dbt-sqlserver Python runtime |
| `copy_grants` | Not applicable | SQL Server uses schema-level permissions |

---

## Related

- [moc-sql-server](https://alp78.github.io/elysium/04-SQL-Server/moc-sql-server)
- [dbt-performance-tuning](https://alp78.github.io/elysium/11-dbt/Operations/dbt-performance-tuning)
- [sqlcmd-connection-and-usage](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/sqlcmd-connection-and-usage)
- [dbt-cross-adapter-patterns](https://alp78.github.io/elysium/11-dbt/Adapters/dbt-cross-adapter-patterns)
