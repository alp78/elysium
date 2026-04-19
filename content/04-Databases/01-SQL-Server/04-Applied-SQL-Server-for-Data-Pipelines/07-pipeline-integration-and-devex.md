---
title: "07 - Pipeline Integration and Developer Experience"
tags: [pipeline, python, sql, airflow, sql-server, tsql]
aliases: [pipeline integration, SQL query tagging, Airflow SQL correlation, schema migrations, connection pool management, developer experience]
description: "Production-focused patterns for integrating SQL Server into data pipelines: stable query identity, Query Store correlation, application naming, connection monitoring, migration workflow, and monitoring integration."
created: 2026-03-22
updated: 2026-04-08
status: complete
---

# Pipeline Integration and Developer Experience

> [!abstract]- Summary
>
> This note covers the operational seam between SQL Server and the pipeline layer. The hard problems here are not SQL syntax; they are identity, correlation, connection discipline, and safe release flow. The live `stoxx` examples show how to make SQL activity attributable to pipeline components without sacrificing plan reuse or turning every DAG execution into a schema-change event.
>
> **Query identity and correlation**
> - covers which metadata belongs in query text, which belongs outside it, and how to correlate SQL activity back to durable pipeline identities
>
> **Plan cache versus Query Store behavior**
> - covers the key distinction that comment headers survive in the plan cache while Query Store normalizes query text more aggressively, making stable labels safer than volatile headers for durable correlation
>
> **Connection identity and pooling**
> - covers connection naming, session monitoring, and the controls that keep session counts predictable and attributable
>
> **Schema change workflow**
> - covers how migrations move through CI/CD separately from runtime pipeline execution so DAGs do not become ad hoc DDL engines
>
> **Monitoring integration**
> - covers the SQL Server observability hooks that make pipeline and database diagnostics meet cleanly
>
> **Operations and safety**
> - Warnings: volatile identifiers in query text destroy plan reuse, Query Store correlation is weaker when labels are unstable, pooled connections can hide ownership if application naming is sloppy, and runtime jobs that perform DDL blur the release boundary dangerously
> - Recommendations: keep query text stable, use durable labels plus `Application Name`, keep run-specific metadata in orchestration logs or session metadata, bound and monitor connection pools, and separate migration rollout from ordinary pipeline execution

> [!note]- Glossary
>
> **Pipeline-to-database seam**
> - The operational boundary where orchestration code, connection management, and SQL Server observability meet.
> - It matters because most real integration failures happen at this boundary rather than inside a single SQL statement.
>
> > [!info] This is where technical ownership overlaps
> >
> > Database behavior, pipeline scheduling, and application connection choices all become one system here. Clean interfaces are what keep that system debuggable.
>
> ---
>
> **Stable query label**
> - A durable identifier such as DAG name, task name, or service name that can be attached to SQL activity without changing every run.
> - It matters because stable labels let operators correlate SQL behavior with pipeline components while preserving plan reuse value.
>
> > [!warning] Stability is what makes the label useful
> >
> > If the label changes every execution, it stops being a correlation aid and starts being plan-cache noise. Durability is part of the design requirement.
>
> ---
>
> **Volatile identifier**
> - A run-specific tag such as an Airflow `run_id`, execution timestamp, or task-instance UUID that changes every execution.
> - It matters because embedding these identifiers directly into SQL text creates a new statement identity each run.
>
> > [!warning] High-cardinality tags are bad SQL metadata
> >
> > Volatile identifiers belong in orchestration logs or external telemetry, not in the query text the optimizer and Query Store will treat as workload identity.
>
> ---
>
> **Query text correlation**
> - The practice of using stable text features such as labels or comments to recognize which pipeline component produced a statement.
> - It matters because many operators first try to solve observability by annotating SQL text directly.
>
> > [!info] Correlation has to respect optimizer surfaces
> >
> > Text tagging can be effective, but it has to work with plan reuse and Query Store normalization rather than against them.
>
> ---
>
> **Plan cache text**
> - The literal SQL text SQL Server retains in the plan cache alongside compiled plans.
> - It matters because comment headers can still be useful when the diagnostic target is the live plan cache rather than normalized Query Store history.
>
> > [!warning] Plan cache is useful and transient
> >
> > The plan cache is excellent for short-horizon live debugging, but it is not a durable audit trail. Correlation strategies should not depend on it alone.
>
> ---
>
> **Query Store normalization**
> - The way Query Store groups or normalizes query text more aggressively than the raw plan cache for long-lived workload analysis.
> - It matters because it changes which tagging strategies remain visible and reliable over time.
>
> > [!warning] What survives in the cache may not survive as a durable Query Store key
> >
> > A comment that helps in one tool may disappear or matter less in another. Durable pipeline observability needs to be designed for the persistence layer you actually use.
>
> ---
>
> **`Application Name`**
> - The client-supplied connection-string field SQL Server surfaces as `program_name` in session metadata.
> - It matters because it is one of the cleanest ways to tag pooled connections by service or pipeline component without rewriting SQL text.
>
> > [!info] Connection identity belongs at connection open
> >
> > If the service identity is known before the first query, the connection string is usually the right place to carry it. That keeps SQL text cleaner and session attribution stronger.
>
> ---
>
> **Connection pool discipline**
> - The practice of bounding, naming, and monitoring pooled database connections so concurrent session counts stay predictable.
> - It matters because uncontrolled pooling can create noisy SQL Server session surfaces and make ownership of activity harder to trace.
>
> > [!warning] More pooled sessions are not free
> >
> > Excess sessions consume resources and complicate troubleshooting. Pool sizing and cleanup are part of application design, not just driver defaults.
>
> ---
>
> **Migration workflow**
> - The controlled process for applying schema changes through versioned, reviewable deployment steps instead of ad hoc runtime behavior.
> - It matters because safe developer experience depends on keeping schema evolution separate from ordinary data movement.
>
> > [!warning] Runtime DDL erodes release discipline
> >
> > If pipeline jobs create or alter schema opportunistically, every run becomes a release event. That makes failures harder to reason about and rollback harder to control.
>
> ---
>
> **Session metadata**
> - The SQL Server-visible identity fields attached to a live connection, such as session id, program name, host name, and related properties.
> - It matters because database-side troubleshooting often begins by tying a session back to the pipeline component or service that opened it.
>
> > [!info] Session metadata is the SQL-side view of the caller
> >
> > Good integration design makes that view meaningful. If sessions are unlabeled or ambiguously labeled, every later diagnostic step becomes slower and noisier.
>
> ---
>
> **Release boundary**
> - The organizational separation between shipping schema changes and running ordinary pipeline workloads.
> - It matters because developer experience is better when operators know whether a failure came from new schema rollout or from steady-state runtime execution.
>
> > [!warning] Mixed boundaries create mixed incidents
> >
> > When migrations and recurring pipeline runs share the same execution path, failures are harder to classify, rollback, and communicate. Clean release boundaries reduce that operational ambiguity.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {
  'primaryColor': '#292e42',
  'primaryTextColor': '#c0caf5',
  'primaryBorderColor': '#565f89',
  'lineColor': '#565f89',
  'secondaryColor': '#1a1b26',
  'tertiaryColor': '#24283b',
  'noteTextColor': '#c0caf5',
  'noteBkgColor': '#292e42',
  'textColor': '#c0caf5',
  'fontSize': '14px'
}}}%%
flowchart TD
    A["Need pipeline observability"] --> B{"Do you need<br/>durable SQL-side correlation?"}
    B --> Y1([YES])
    B --> N1([NO])
    Y1 --> C["Use stable query labels,<br/>Application Name, and Query Store time windows"]
    N1 --> D["Plan-cache text or query-sample tools<br/>may be enough"]
    C --> E{"Does metadata change<br/>every run?"}
    E --> Y2([YES])
    E --> N2([NO])
    Y2 --> F["Keep volatile run IDs out of query text;<br/>store them in orchestration logs or session metadata"]
    N2 --> G["Stable DAG or task identity<br/>can live in query text safely"]
    F --> H{"Too many sessions<br/>or leaked connections?"}
    G --> H
    H --> Y3([YES])
    H --> N3([NO])
    Y3 --> I["Bound pools, set Application Name,<br/>and monitor sys.dm_exec_sessions"]
    N3 --> J["Keep release workflow separate<br/>from runtime pipeline execution"]

    classDef yesNode fill:#1f3b2d,stroke:#73d13d,stroke-width:2px,color:#c0caf5,font-weight:bold;
    classDef noNode fill:#4a1f24,stroke:#db4b4b,stroke-width:2px,color:#c0caf5,font-weight:bold;
    class Y1,Y2,Y3 yesNode;
    class N1,N2,N3 noNode;
```

## Query Identity and Correlation

The first design decision is what metadata belongs in SQL text and what metadata should stay outside it. Not all observability tags are equal.

### Stable versus volatile identifiers

Stable identifiers such as DAG name, task name, service name, or query label can be safe correlation keys. Volatile identifiers such as Airflow `run_id`, execution timestamp, or random task instance IDs are different: if you embed them directly into the SQL text, you create a different ad hoc statement every run, which hurts plan reuse and inflates plan-cache churn.

#### Recommended metadata placement

| Metadata | Put it in query text? | Better location | Reason |
|---|---|---|---|
| DAG name | Yes, if stable | `OPTION (LABEL=...)` or stable comment | Good durable correlation key. |
| Task name | Yes, if stable | `OPTION (LABEL=...)` or stable comment | Useful to separate hot spots inside one DAG. |
| Service identity | No need | `Application Name` in the connection string | SQL Server already exposes it in `program_name`. |
| Airflow `run_id` | No | Task logs, orchestration metadata, or session-scoped metadata | Embedding it in query text creates one unique statement per run. |
| Exact execution timestamp | No | Logs or external monitoring | High-cardinality tag that destroys plan reuse value. |

> [!warning] Volatile text kills plan reuse
>
> Do not put a unique `run_id` or timestamp in every production query text unless you have explicitly decided that losing plan reuse is acceptable.
>
> [!success] Keep query text stable
>
> Keep the SQL text stable. Put durable identifiers such as DAG or task labels in `OPTION (LABEL = ...)`, and keep volatile run-specific metadata in the orchestration layer or session-scoped metadata.
>

### Comment headers survive in the plan cache

SQL comment headers are still useful when you need the literal submitted text in the live plan cache or in external query-sample tooling.

#### Execute a comment-tagged batch

> [!info]-
> This query is a live demonstration of comment-based tagging.
>
> - The comment prefix contains a DAG name, task name, and run identifier.
> - The SQL text itself is otherwise a simple selective count query on `silver.eurostoxx50_ohlcv`.
> - The output count is not the point; the point is that SQL Server stores the full submitted batch text in the plan cache, including the comment.
>
> *Run a tagged batch whose SQL comment header identifies the DAG, task, and run.*
>

```sql
/* dag=daily_pipeline task=load_silver run=manual__2026-04-08T16:15:00 */
SELECT COUNT(*) AS tagged_row_count
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'ASML.AS';
```

| tagged_row_count |
|---:|
| 1347 |

_The query returned `1347` rows. The more important outcome is that the exact batch text, including the comment header, is now visible in the plan cache._

#### Read the full tagged text from the plan cache

> [!info]-
> `sys.dm_exec_sql_text` returns the batch text associated with a cached plan handle.
>
> - The `LIKE '/* dag=daily_pipeline%'` predicate is intentionally strict so the query finds only comment-prefixed batches that start with the DAG tag.
> - This is a volatile capture path: it depends on the plan still being in cache.
>
> *Find the exact tagged batch text in the live plan cache.*
>

```sql
SELECT TOP (5)
    text
FROM sys.dm_exec_cached_plans AS cp
CROSS APPLY sys.dm_exec_sql_text(cp.plan_handle)
WHERE text LIKE '/* dag=daily_pipeline%'
ORDER BY usecounts DESC;
```

| text |
|---|
| `/* dag=daily_pipeline task=load_silver run=manual__2026-04-08T16:15:00 */ SELECT COUNT(*) AS tagged_row_count FROM silver.eurostoxx50_ohlcv WHERE symbol = 'ASML.AS';` |

_The comment header survives intact in the plan cache. This is why comment tagging works well with live DMV-based correlation and external query-sample tools that read batch text directly._

## Query Store Normalizes Text More Aggressively

The same comment-tagged query above does not survive into Query Store in the same literal form. Query Store stores a normalized query text shape that is better for plan tracking, but worse for naive comment-based correlation.

### Comment tags are not a durable Query Store key

#### Inspect the Query Store text for the tagged query

> [!info]-
> This query looks up the previous statement by the result alias `tagged_row_count`.
>
> - The stored text in Query Store is the important part of the output.
> - Notice that Query Store parameterized the predicate and dropped the comment header entirely.
> - This is why searching Query Store by raw comment prefix is unreliable.
>
> *Inspect how Query Store stored the earlier comment-tagged query.*
>

```sql
SELECT TOP (5)
    q.query_id,
    qt.query_sql_text,
    q.last_execution_time,
    q.avg_compile_duration,
    q.count_compiles
FROM sys.query_store_query_text AS qt
JOIN sys.query_store_query AS q ON qt.query_text_id = q.query_text_id
WHERE qt.query_sql_text LIKE '%tagged_row_count%'
  AND qt.query_sql_text NOT LIKE '%sys.query_store_query_text%'
ORDER BY q.last_execution_time DESC;
```

| query_id | query_sql_text | last_execution_time | avg_compile_duration | count_compiles |
|---:|---|---|---:|---:|
| 3166 | `(@1 varchar(8000))SELECT COUNT(*) [tagged_row_count] FROM [silver].[eurostoxx50_ohlcv] WHERE [symbol]=@1` | `2026-04-08 14:19:47.5970000 +00:00` | 477.0 | 1 |

_The comment header is gone, and the literal predicate became a parameterized shape. This is not a bug; it is a reminder that Query Store stores a normalized form of the query text. If you need a durable SQL-side identifier inside Query Store, comments are not the right primary key._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `query_id` | Stable numeric identifier | Depends | Logical query identity inside Query Store. | Use it for forcing, hints, and regression tracking. |
| `query_sql_text` | Parameterized shape | Depends | Query Store normalized the statement text. | Good for plan tracking, but poor for exact comment matching. |
| `last_execution_time` | Recent timestamp | Depends | Last time Query Store saw the query execute. | Useful for time-window correlation. |
| `count_compiles` | Low | Depends | Query has compiled only a few times. | Normal for one-off tests; evaluate differently on hot paths. |

### Query labels survive into Query Store

If you need a durable, SQL-native identifier that survives into Query Store text, a stable `OPTION (LABEL = ...)` value is much more reliable than a volatile comment header.

#### Execute a labeled query

> [!info]-
> This query uses a stable label instead of a comment prefix.
>
> - The label identifies the pipeline operation, not the individual run.
> - The SQL text stays stable across executions as long as the label stays stable.
> - This preserves plan reuse while giving Query Store a durable marker.
>
> *Run a stable labeled query that Query Store can retain verbatim.*
>

```sql
SELECT COUNT(*) AS labeled_row_count
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'ASML.AS'
OPTION (LABEL = 'pipeline_daily_load_silver');
```

| labeled_row_count |
|---:|
| 1347 |

_The row count is the same `1347`, but the identity mechanism is better suited to Query Store than a volatile comment header._

#### Read the labeled query from Query Store

> [!info]-
> This query proves that the label survived into Query Store text.
>
> - The `LIKE 'SELECT COUNT(*) AS labeled_row_count%'` predicate is strict enough to isolate the real labeled statement.
> - Unlike the comment example, the Query Store text keeps the `OPTION (LABEL = ...)` clause.
>
> *Find the labeled query text exactly as stored by Query Store.*
>

```sql
SELECT TOP (5)
    q.query_id,
    qt.query_sql_text,
    q.last_execution_time,
    q.avg_compile_duration,
    q.count_compiles
FROM sys.query_store_query_text AS qt
JOIN sys.query_store_query AS q ON qt.query_text_id = q.query_text_id
WHERE qt.query_sql_text LIKE 'SELECT COUNT(*) AS labeled_row_count%'
ORDER BY q.last_execution_time DESC;
```

| query_id | query_sql_text | last_execution_time | avg_compile_duration | count_compiles |
|---:|---|---|---:|---:|
| 3178 | `SELECT COUNT(*) AS labeled_row_count FROM silver.eurostoxx50_ohlcv WHERE symbol = 'ASML.AS' OPTION (LABEL = 'pipeline_daily_load_silver')` | `2026-04-08 14:21:18.8230000 +00:00` | 460.0 | 1 |

_This is the durable-correlation pattern to prefer inside Query Store. The label is preserved, the statement shape is stable, and the query remains easy to find later without relying on a high-cardinality comment prefix._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `query_sql_text` | Stable labeled text | &#9989; | Query Store preserved the label verbatim. | Good durable search key for pipeline SQL. |
| `last_execution_time` | Recent | Depends | Query executed recently. | Use to align with DAG windows. |
| `avg_compile_duration` | Small one-off compile | Depends | Query compiled successfully. | Low operational concern here; included mainly as proof of capture. |

## Connection Identity and Pooling

Every pipeline service should identify itself consistently at the connection level. SQL Server already gives you a native place for that identity: `program_name`, which comes from the client `Application Name`.

### Set `Application Name` deliberately

For SQL Server-side observability, `Application Name` is usually more valuable than trying to infer the client from raw login activity. It lets you monitor session counts and sleeping connections per service without parsing SQL text.

#### Connection string examples

| Client | Example |
|---|---|
| ADO.NET | `Server=localhost,1434;Initial Catalog=stoxx;User ID=pipeline_svc;Password=...;Encrypt=True;TrustServerCertificate=True;Application Name=pipeline_loader;Min Pool Size=2;Max Pool Size=20;` |
| SQLAlchemy / pyodbc | `mssql+pyodbc://pipeline_svc:***@localhost,1434/stoxx?driver=ODBC+Driver+18+for+SQL+Server&Encrypt=yes&TrustServerCertificate=yes&Application Name=pipeline_loader` |

> [!warning] Generic client names are useless
>
> Do not rely on default client names in production. `SQLCMD`, `Microsoft SQL Server Management Studio`, and generic driver names are too coarse for service-level monitoring.
>
> [!success] Set stable application names
>
> Set a stable `Application Name` per service or per worker type, not per individual run. That gives you usable `program_name` grouping without fragmenting the connection identity space.
>

### Monitor sessions by application name

#### Group user sessions by `program_name`

> [!info]-
> This query groups `sys.dm_exec_sessions` by application and login identity.
>
> - `program_name` is the client application name supplied by the connection string.
> - `total_sessions` counts all user sessions in that group.
> - `sleeping_sessions` counts sessions that are connected but not actively running a request.
> - `active_sessions` counts sessions whose status is not `sleeping`.
>
> *Group user sessions by application name and login to measure current connection footprint.*
>

```sql
SELECT
    program_name,
    login_name,
    COUNT(*) AS total_sessions,
    SUM(CASE WHEN status = 'sleeping' THEN 1 ELSE 0 END) AS sleeping_sessions,
    SUM(CASE WHEN status <> 'sleeping' THEN 1 ELSE 0 END) AS active_sessions
FROM sys.dm_exec_sessions
WHERE is_user_process = 1
GROUP BY program_name, login_name
ORDER BY total_sessions DESC, program_name;
```

| program_name | login_name | total_sessions | sleeping_sessions | active_sessions |
|---|---|---:|---:|---:|
| `pipeline_loader_demo` | `sa` | 1 | 1 | 0 |
| `SQL Server Management Studio` | `sa` | 1 | 1 | 0 |
| `SQLCMD` | `sa` | 1 | 0 | 1 |
| `SQLServerCEIP` | `NT AUTHORITY\SYSTEM` | 1 | 1 | 0 |

_This is the exact operational payoff of setting `Application Name`. `pipeline_loader_demo` is visible as its own session group immediately, independent of the login name. That makes service-level connection counting and leak detection much easier than trying to infer intent from query text alone._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `program_name` | Custom service name | &#9989; | Application identity is explicit. | Easy grouping and alerting by service. |
| `program_name` | Generic client name | &#10060; for production services | Identity is too coarse. | Harder to separate pipeline traffic from admin traffic. |
| `sleeping_sessions` | High and growing | &#10060; | Many idle connections remain open. | Possible pool oversizing, leaks, or slow task cleanup. |
| `active_sessions` | Close to pool ceiling | Depends | Many sessions are actively in use. | Validate against expected concurrency and worker count. |

#### Find long-sleeping user sessions

> [!info]-
> This query looks for user sessions that have been sleeping for more than one hour.
>
> - `last_request_end_time` is the key field: it shows when the last request on the session completed.
> - Sleeping sessions are not automatically a problem, but long-sleeping sessions deserve inspection because they often reflect abandoned clients or oversized pools.
>
> *Find user sessions that have been idle for more than one hour.*
>

```sql
SELECT
    session_id,
    login_name,
    program_name,
    status,
    last_request_end_time
FROM sys.dm_exec_sessions
WHERE is_user_process = 1
  AND status = 'sleeping'
  AND last_request_end_time < DATEADD(HOUR, -1, GETDATE())
ORDER BY last_request_end_time;
```

| session_id | login_name | program_name | status | last_request_end_time |
|---:|---|---|---|---|
| 73 | `sa` | `SQL Server Management Studio` | `sleeping` | `2026-04-08 08:43:07.397` |

_This is a real idle-session example. It is not a pipeline leak; it is an old SSMS session. That is exactly why this query should be reviewed manually before any action is taken. A long-sleeping session is a clue, not a kill command._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `status` | `sleeping` | Depends | Session is connected but not running a request. | Often normal; evaluate age and owner. |
| `last_request_end_time` | Very old | &#10060; only after review | Session has been idle for a long time. | Candidate for manual investigation. |
| `program_name` | Known admin tool | Depends | Session belongs to a human or admin utility. | Usually review with the operator before acting. |
| `program_name` | Pipeline service | Depends | Session belongs to an application component. | Check pool settings and task cleanup behavior. |

## Schema Change Workflow

Schema changes should be a release concern, not a normal per-run pipeline behavior. The safest production model is:

1. CI validates migration scripts.
2. CD applies migrations once per release window.
3. Runtime DAGs verify the expected schema version and fail fast if the database is behind.

### Recommended ownership model

| Responsibility | Best owner | Why |
|---|---|---|
| Script authoring | Application or data engineering repo | Version control, review, rollback context |
| Syntax validation | CI | Catch errors before deployment |
| DDL application | Release pipeline | Controlled blast radius and auditability |
| Runtime schema check | DAG startup task | Fast failure when environments drift |

> [!warning] Do not run DDL on every DAG
>
> Do not apply schema migrations automatically on every Airflow DAG run unless the environment is intentionally small, serialized, and you have accepted DDL-at-runtime as a design choice.
>
> [!success] Separate checks from deployment
>
> Use runtime DAGs to verify schema version, not to own production DDL. Keep actual schema changes in a dedicated deployment workflow.
>

### Migration tool choices

#### Compare the main migration styles

| Approach | Type | Best use case | Main tradeoff |
|---|---|---|---|
| Flyway | Migration-based | Teams already comfortable with numbered SQL migrations | Extra tool, but very mature workflow |
| Liquibase | Changelog-based | Complex preconditions and richer deployment policy | More abstraction and maintenance overhead |
| Plain `sqlcmd` scripts + version table | Migration-based | Small teams that want native SQL Server tooling only | More house-keeping logic to maintain yourself |
| DACPAC / `sqlpackage` | State-based | Centralized schema ownership and state diff workflows | Diff-driven model can be harder to reason about for data migrations |

#### Keep scripts idempotent and append-only

| Rule | Why it matters |
|---|---|
| Guard DDL with existence checks | Reruns and partially applied environments are real. |
| Never edit an already-applied migration | The database has already recorded that version. |
| Keep large data backfills batched | Avoid giant transaction logs and rollback pain. |
| Record checksums | Detect drift between files and applied versions. |

### CI validation pattern

#### Validate migration syntax in CI with `sqlcmd`

> [!info]-
> This example validates migration syntax without executing the statements.
>
> - `SET PARSEONLY ON` asks SQL Server to parse and compile the T-SQL without running it.
> - The loop validates every migration file in the folder.
> - This belongs in CI, not in the production runtime DAG.
>
> *Validate migration syntax in CI before any deployment workflow can apply the scripts.*
>

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

## Monitoring Integration

Datadog, OpenTelemetry collectors, or internal database-monitoring agents all benefit from the same discipline:

- stable SQL identity for query correlation
- explicit `Application Name`
- a low-cardinality metric strategy
- alerting on symptoms that matter to pipelines rather than on every raw DMV value

### Minimal SQL-side signals worth exporting

| Signal | Why it matters for pipelines |
|---|---|
| Query duration and logical reads | Detect expensive ETL statements and regressions |
| Blocking count | Pipelines often create short bursts of blocking during bulk operations or merges |
| Connection count by `program_name` | Detect pool explosions and leaked workers |
| Wait families (`PAGEIOLATCH`, `WRITELOG`, `LCK_M`) | Distinguish I/O, log, and locking pain quickly |

### Minimum permission model for a monitoring login

#### Grant the monitoring login only the read surface it needs

> [!warning] Monitoring is not administration
>
> Do not make the monitoring login `sysadmin`. Monitoring agents need visibility, not control.
>
> [!success] Grant read visibility only
>
> Grant only the server and database read permissions required by the specific DMVs and metadata views you intend to query.
>
> [!info]-
> This is a minimum viable SQL Server monitoring login pattern.
>
> - `VIEW SERVER STATE` is the key server-level permission for most performance DMVs.
> - `VIEW ANY DEFINITION` supports metadata inspection.
> - `CONNECT ANY DATABASE` allows the login to enumerate databases.
> - `db_datareader` is granted per monitored database when the agent needs regular table-level reads for deeper inspection.
>
> *Create a monitoring login with the minimum read surface needed for SQL Server performance telemetry.*
>

```sql
CREATE LOGIN dd_agent WITH PASSWORD = 'DD_AGENT_PASSWORD';
CREATE USER dd_agent FOR LOGIN dd_agent;

GRANT VIEW SERVER STATE TO dd_agent;
GRANT VIEW ANY DEFINITION TO dd_agent;
GRANT CONNECT ANY DATABASE TO dd_agent;
EXEC sp_addrolemember 'db_datareader', 'dd_agent';
```

## References

- [sys.dm_exec_sql_text](https://learn.microsoft.com/en-us/sql/relational-databases/system-dynamic-management-views/sys-dm-exec-sql-text-transact-sql)
- [sys.query_store_query_text](https://learn.microsoft.com/en-us/sql/relational-databases/system-catalog-views/sys-query-store-query-text-transact-sql)
- [sys.dm_exec_sessions](https://learn.microsoft.com/en-us/sql/relational-databases/system-dynamic-management-views/sys-dm-exec-sessions-transact-sql)
- [Query hints and `OPTION (LABEL = ...)`](https://learn.microsoft.com/en-us/sql/t-sql/queries/hints-transact-sql-query)
