---
title: "19 - Query Store Regressions and Plan Forcing"
tags: [performance, sql, sql-server, tsql]
aliases: [query-plan-analysis, Query Store regressions, plan forcing, Query Store hints, regressed queries]
description: "Production-focused guide to SQL Server Query Store regression analysis, plan forcing, and Query Store hints, with real stoxx outputs and a disposable forcing demo."
created: 2026-03-22
updated: 2026-04-08
status: complete
---

# Query Store Regressions and Plan Forcing

This page starts later in the workflow: Query Store is already enabled, a query has more than one plan or its runtime has drifted, and the job is to decide whether to observe, force, hint, or fix the root cause.

The focus here is operational plan governance:

- verify that Query Store is collecting enough data to be useful
- identify regression candidates where one query has materially different plan performance
- compare specific plans for the same query
- force a known-good plan temporarily
- apply Query Store hints when code cannot be changed

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
    A["Slow or unstable query"] --> B{"Query Store<br/>enabled and writable?"}
    B --> Y1([YES])
    B --> N1([NO])
    N1 --> C["Enable Query Store first<br/>or this workflow is blind"]
    Y1 --> D{"More than one plan<br/>for the same query?"}
    D --> Y2([YES])
    D --> N2([NO])
    Y2 --> E["Compare best and worst plans<br/>by duration, reads, and waits"]
    N2 --> F["Root cause is not yet a regression;<br/>inspect plans, stats, indexes, and waits"]
    E --> G{"One plan is clearly safer<br/>and root cause not yet fixed?"}
    G --> Y3([YES])
    G --> N3([NO])
    Y3 --> H["Force the known-good plan<br/>temporarily and review later"]
    N3 --> I["Use Query Store hints<br/>or fix stats, indexes, predicates"]

    classDef yesNode fill:#1f3b2d,stroke:#73d13d,stroke-width:2px,color:#c0caf5,font-weight:bold;
    classDef noNode fill:#4a1f24,stroke:#db4b4b,stroke-width:2px,color:#c0caf5,font-weight:bold;
    class Y1,Y2,Y3 yesNode;
    class N1,N2,N3 noNode;
```

## Query Store Baseline

Before using Query Store for regressions, forcing, or hints, verify that it is collecting writable runtime data and not sitting in a degraded or read-only state.

### Check Query Store state and capture mode

#### Confirm that Query Store is writable and capturing waits

> [!info]-
> `sys.database_query_store_options` is the database-level control surface for Query Store.
>
> - `desired_state_desc` is the configured target state.
> - `actual_state_desc` is the real runtime state right now. This is the column that tells you whether Query Store is actually usable.
> - `readonly_reason` is non-zero when Query Store has gone read-only for a specific reason such as memory or storage pressure.
> - `current_storage_size_mb` and `max_storage_size_mb` show whether Query Store is close to its configured size ceiling.
> - `query_capture_mode_desc` determines how aggressively Query Store captures queries.
> - `wait_stats_capture_mode_desc` determines whether per-query wait capture is enabled.
>
> *Check whether Query Store is writable, what capture mode it uses, and whether wait-stat capture is enabled.*
>
```sql
SELECT
    desired_state_desc,
    actual_state_desc,
    readonly_reason,
    current_storage_size_mb,
    max_storage_size_mb,
    query_capture_mode_desc,
    wait_stats_capture_mode_desc
FROM sys.database_query_store_options;
```

| desired_state_desc | actual_state_desc | readonly_reason | current_storage_size_mb | max_storage_size_mb | query_capture_mode_desc | wait_stats_capture_mode_desc |
|---|---|---:|---:|---:|---|---|
| `READ_WRITE` | `READ_WRITE` | 0 | 4 | 1000 | `ALL` | `ON` |

_This is the state you want for investigation. Query Store is actually writable, not just configured to be writable, and it is capturing all queries with wait statistics enabled. Storage pressure is also nowhere near the configured limit: only `4 MB` of `1000 MB` is currently in use._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `desired_state_desc` | `READ_WRITE` | &#9989; | Query Store is configured to collect writable data. | Correct baseline for troubleshooting. |
| `actual_state_desc` | `READ_WRITE` | &#9989; | Query Store is actively usable right now. | Regression queries, forcing, and hints can work. |
| `actual_state_desc` | `READ_ONLY` or not matching desired state | &#10060; | Query Store is not accepting new writable data. | Investigate why before trusting the workflow. |
| `readonly_reason` | `0` | &#9989; | No active read-only blocker. | Normal operating state. |
| `readonly_reason` | Non-zero | &#10060; | Query Store entered read-only mode for a reason. | Check size, memory, or internal limits before proceeding. |
| `query_capture_mode_desc` | `ALL` | Depends | Capture is broad and exhaustive. | Excellent for demos and audits, but can collect more than production usually needs. |
| `query_capture_mode_desc` | `AUTO` | Depends | Query Store decides what is worth capturing. | Common production default. |
| `wait_stats_capture_mode_desc` | `ON` | &#9989; | Query-level waits are persisted. | Stronger regression analysis and query triage. |

## Plan Regression Candidates

The fastest way to detect plan regression candidates is to look for queries with multiple plans and a large spread between their best and worst average runtime. This is not proof of causality, but it is the correct shortlist.

### Compare best and worst plans per query

#### Find queries whose plans have materially different runtime profiles

> [!info]-
> This query compares runtime spread across plans stored for the same `query_id`.
>
> - `COUNT(DISTINCT qsp.plan_id)` becomes `plan_count`, which is the first signal that Query Store has seen more than one plan shape for the same query.
> - `best_avg_ms` and `worst_avg_ms` are the minimum and maximum average duration values observed across those plans.
> - `regression_factor` divides worst by best, so a value of `7` means the worst plan is seven times slower than the best one.
> - The query groups by `query_id`, not by `plan_id`, because the goal is to find unstable queries, not merely expensive individual plans.
>
> *Find queries with multiple plans and the largest spread between their best and worst average duration.*
>
```sql
SELECT TOP (10)
    qsq.query_id,
    COUNT(DISTINCT qsp.plan_id) AS plan_count,
    CAST(MIN(qsrs.avg_duration) / 1000.0 AS decimal(18,2)) AS best_avg_ms,
    CAST(MAX(qsrs.avg_duration) / 1000.0 AS decimal(18,2)) AS worst_avg_ms,
    CAST(MAX(qsrs.avg_duration) * 1.0 / NULLIF(MIN(qsrs.avg_duration), 0) AS decimal(18,2)) AS regression_factor,
    LEFT(qsqt.query_sql_text, 160) AS query_text
FROM sys.query_store_runtime_stats AS qsrs
JOIN sys.query_store_plan AS qsp ON qsrs.plan_id = qsp.plan_id
JOIN sys.query_store_query AS qsq ON qsp.query_id = qsq.query_id
JOIN sys.query_store_query_text AS qsqt ON qsq.query_text_id = qsqt.query_text_id
GROUP BY qsq.query_id, qsqt.query_sql_text
HAVING COUNT(DISTINCT qsp.plan_id) > 1
ORDER BY regression_factor DESC, worst_avg_ms DESC;
```

| query_id | plan_count | best_avg_ms | worst_avg_ms | regression_factor | query_text |
|---:|---:|---:|---:|---:|---|
| 249 | 2 | 0.33 | 3.48 | 10.68 | `DELETE b FROM bronze.stoxxusa50_ohlcv b         INNER JOIN (             SELECT symbol, MAX(date) AS max_date             FROM bronze.stoxxusa50_ohlcv` |
| 235 | 2 | 0.44 | 3.17 | 7.18 | `DELETE b FROM bronze.stoxxasia50_ohlcv b         INNER JOIN (             SELECT symbol, MAX(date) AS max_date             FROM bronze.stoxxasia50_ohlcv` |
| 228 | 2 | 0.45 | 3.12 | 6.98 | `DELETE b FROM bronze.eurostoxx50_ohlcv b         INNER JOIN (             SELECT symbol, MAX(date) AS max_date             FROM bronze.eurostoxx50_ohlcv` |
| 2766 | 2 | 0.21 | 0.76 | 3.56 | `(@_msparam_0 nvarchar(4000),@_msparam_1 nvarchar(4000),@_msparam_2 nvarchar(4000),@_msparam_3 nvarchar(4000))SELECT clmns.name AS [Name], clmns.column_id AS [ID` |
| 3007 | 3 | 762.17 | 1813.89 | 2.38 | `ALTER INDEX ALL ON dbo.demo_idxmaint_rowstore REBUILD WITH (ONLINE = ON, MAXDOP = 2)` |
| 1881 | 5 | 7.29 | 13.64 | 1.87 | `UPDATE STATISTICS [silver].[eurostoxx50_ohlcv]` |
| 1879 | 4 | 10.19 | 15.72 | 1.54 | `UPDATE STATISTICS [silver].[stoxxasia50_ohlcv]` |
| 1880 | 4 | 10.21 | 14.92 | 1.46 | `UPDATE STATISTICS [silver].[stoxxusa50_ohlcv]` |
| 2995 | 2 | 1675.26 | 2329.01 | 1.39 | `WITH n AS (     SELECT 1 AS batch_no UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 ) INSERT INTO dbo.demo_idxmaint_rowstore (batch` |
| 3033 | 2 | 97.19 | 122.65 | 1.26 | `UPDATE STATISTICS dbo.demo_idxmaint_rowstore WITH FULLSCAN` |

_This output is exactly what Query Store is for: the same logical query can have multiple plans with materially different runtime. The strongest current candidates are the `DELETE ... MAX(date)` bronze cleanup statements, where the worst plan is about `7-11x` slower than the best one. That is not a command to force a plan blindly, but it is a strong signal to inspect those queries first._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `plan_count` | `1` | Depends | Query currently has only one tracked plan. | No plan-regression comparison is available yet. |
| `plan_count` | `> 1` | &#9989; for analysis | Query has multiple tracked plan variants. | Candidate for regression investigation. |
| `regression_factor` | Close to `1` | &#9989; | Plans perform similarly. | Plan variability is not the first suspect. |
| `regression_factor` | `> 2` | &#10060; | Worst plan is at least twice as slow as the best plan. | Strong regression shortlist. |
| `best_avg_ms` vs `worst_avg_ms` | Large spread | Depends | Runtime changes materially across plans. | Check plan shape, stats, parameter sensitivity, and indexing. |
| `query_text` | Maintenance/admin statement | Depends | Regression may belong to maintenance activity, not business workload. | Prioritize according to workload criticality, not just numeric spread. |

## Controlled Force-Plan Workflow

The next section is a disposable example on `stoxx`. It creates a temporary lab table, generates two plans for the same query, forces the better plan, then demonstrates a Query Store hint. This is not a production-change pattern; it is a reproducible verification workflow.

> [!example]
> This walkthrough uses `dbo.qs_force_demo`, a disposable copy of `silver.eurostoxx50_ohlcv`. It is safe to drop after testing and does not change the real indexed tables used by the application.
>
### Build a disposable demo table

#### Create the demo table from real `stoxx` data

> [!info]-
> The table below is intentionally simple.
>
> - It copies `symbol`, `date`, `close`, and `volume` from `silver.eurostoxx50_ohlcv`.
> - The clustered primary key is on `id`, not on the predicate columns, so the first execution has no good supporting access path.
> - The row-count output proves the demo table is populated with real data rather than synthetic tiny samples.
>
> *Create a disposable demo table that starts without a supporting index on the predicate columns.*
>
```sql
USE stoxx;
IF OBJECT_ID('dbo.qs_force_demo', 'U') IS NOT NULL
    DROP TABLE dbo.qs_force_demo;

CREATE TABLE dbo.qs_force_demo
(
    id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_qs_force_demo PRIMARY KEY,
    symbol nvarchar(32) NOT NULL,
    [date] date NOT NULL,
    [close] decimal(19,4) NULL,
    volume bigint NULL
);

INSERT INTO dbo.qs_force_demo (symbol, [date], [close], volume)
SELECT symbol, [date], [close], volume
FROM silver.eurostoxx50_ohlcv;

SELECT COUNT(*) AS row_count
FROM dbo.qs_force_demo;
```

| row_count |
|---:|
| 67155 |

_The demo table contains the full `silver.eurostoxx50_ohlcv` rowset, so the later scan-versus-seek difference is based on real table size and real data distribution._

### Generate two plans for the same query

#### Run the same tagged query before and after adding the index

> [!info]-
> This batch is the core of the demonstration.
>
> - First, it removes the support index if it already exists.
> - It then runs the same `COUNT(*)` query with a stable Query Store label.
> - After that, it creates `IX_qs_force_demo_symbol_date`.
> - It runs the exact same tagged query again, which lets Query Store store a second plan for the same `query_id`.
> - The output row count stays the same in both executions; only the plan shape changes.
>
> *Execute the same tagged query once without the support index and once after creating it.*
>
```sql
USE stoxx;
IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.qs_force_demo')
      AND name = 'IX_qs_force_demo_symbol_date'
)
    DROP INDEX IX_qs_force_demo_symbol_date ON dbo.qs_force_demo;

SELECT COUNT(*) AS matching_rows
FROM dbo.qs_force_demo
WHERE symbol = 'ASML.AS'
  AND [date] BETWEEN '2025-03-01' AND '2025-04-30'
OPTION (LABEL = 'qs_force_demo_count');

CREATE INDEX IX_qs_force_demo_symbol_date
    ON dbo.qs_force_demo(symbol, [date]);

SELECT COUNT(*) AS matching_rows
FROM dbo.qs_force_demo
WHERE symbol = 'ASML.AS'
  AND [date] BETWEEN '2025-03-01' AND '2025-04-30'
OPTION (LABEL = 'qs_force_demo_count');
```

| matching_rows |
|---:|
| 41 |

<!-- table separator -->

| matching_rows |
|---:|
| 41 |

_Both executions return the same `41` rows, which is exactly what you want in a plan-forcing example. The query semantics did not change; only the available access path did._

#### Compare the two plans stored for the tagged query

> [!info]-
> This query reads Query Store for the tagged statement and compares the two recorded plans.
>
> - `query_id` identifies the logical statement.
> - `plan_id` identifies the individual plan variant.
> - `access_pattern` is derived from the stored plan XML text to keep the output human-readable.
> - `avg_ms` and `avg_logical_io_reads` reveal whether the alternate plan is actually better, not just different.
>
> *Compare the scan and seek plans stored by Query Store for the same tagged query.*
>
```sql
SELECT
    qsq.query_id,
    qsp.plan_id,
    CASE
        WHEN qsp.query_plan LIKE '%Clustered Index Scan%' THEN 'Clustered Index Scan'
        WHEN qsp.query_plan LIKE '%Index Seek%' THEN 'Index Seek'
        WHEN qsp.query_plan LIKE '%Table Scan%' THEN 'Table Scan'
        ELSE 'Other'
    END AS access_pattern,
    qsp.is_forced_plan,
    qsp.last_force_failure_reason_desc,
    CAST(AVG(qsrs.avg_duration) / 1000.0 AS decimal(18,3)) AS avg_ms,
    CAST(AVG(qsrs.avg_logical_io_reads) AS decimal(18,2)) AS avg_logical_io_reads,
    LEFT(qsqt.query_sql_text, 180) AS query_text
FROM sys.query_store_runtime_stats AS qsrs
JOIN sys.query_store_plan AS qsp ON qsrs.plan_id = qsp.plan_id
JOIN sys.query_store_query AS qsq ON qsp.query_id = qsq.query_id
JOIN sys.query_store_query_text AS qsqt ON qsq.query_text_id = qsqt.query_text_id
WHERE qsqt.query_sql_text LIKE '%qs_force_demo_count%'
GROUP BY qsq.query_id, qsp.plan_id, qsp.query_plan, qsp.is_forced_plan, qsp.last_force_failure_reason_desc, qsqt.query_sql_text
ORDER BY avg_logical_io_reads DESC;
```

| query_id | plan_id | access_pattern | is_forced_plan | last_force_failure_reason_desc | avg_ms | avg_logical_io_reads | query_text |
|---:|---:|---|---:|---|---:|---:|---|
| 3161 | 595 | `Clustered Index Scan` | 0 | `NONE` | 2.393 | 411.00 | `SELECT COUNT(*) AS matching_rows FROM dbo.qs_force_demo WHERE symbol = 'ASML.AS'   AND [date] BETWEEN '2025-03-01' AND '2025-04-30' OPTION (LABEL = 'qs_force_demo_count')` |
| 3161 | 594 | `Index Seek` | 0 | `NONE` | 0.057 | 4.00 | `SELECT COUNT(*) AS matching_rows FROM dbo.qs_force_demo WHERE symbol = 'ASML.AS'   AND [date] BETWEEN '2025-03-01' AND '2025-04-30' OPTION (LABEL = 'qs_force_demo_count')` |

_This is a clean forcing candidate. The query has two valid plans for the same `query_id`, and the `Index Seek` plan is clearly better than the `Clustered Index Scan`: `4` logical reads versus `411`, and `0.057 ms` versus `2.393 ms`. That is the kind of gap that justifies temporary forcing while the underlying cause is stabilized._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `query_id` | Same across rows | &#9989; | One logical query has multiple plans. | True regression comparison. |
| `plan_id` | Different across rows | &#9989; | Distinct plan variants exist. | Query Store can compare and force among them. |
| `access_pattern` | `Clustered Index Scan` | &#10060; in this example | Full base-structure scan. | Poorer access path for this selective predicate. |
| `access_pattern` | `Index Seek` | &#9989; in this example | Targeted access path. | Lower reads and lower latency. |
| `is_forced_plan` | `0` | Depends | Plan is not currently forced. | Observation-only state. |
| `last_force_failure_reason_desc` | `NONE` | &#9989; | No force failure has been recorded. | Safe to proceed if forcing is justified. |
| `avg_logical_io_reads` | Very different between plans | &#10060; for the worse plan | Plans impose materially different data-access cost. | Strong sign that plan choice matters. |

### Force the better plan

#### Force the low-read plan and verify the force state

> [!warning]
> Plan forcing is a temporary operational control, not a substitute for root-cause analysis. Forced plans can become stale after schema changes, data-distribution shifts, or index maintenance.
>
> [!success]
> Force only a plan you have validated, record why it was forced, and review forced plans on a schedule. Unforce them when the underlying issue has been corrected.
>
> [!info]-
> This batch forces plan `594`, the lower-read seek plan from the previous output, and then verifies the force state directly from `sys.query_store_plan`.
>
> - `sp_query_store_force_plan` marks one historical plan as the preferred plan for that `query_id`.
> - `is_forced_plan` should become `1` for the chosen plan.
> - `force_failure_count` and `last_force_failure_reason_desc` tell you whether SQL Server had trouble applying the forced plan.
>
> *Force the validated seek plan and verify that Query Store now marks it as forced.*
>
```sql
DECLARE @query_id bigint = 3161;
DECLARE @plan_id bigint = 594;

EXEC sys.sp_query_store_force_plan
    @query_id = @query_id,
    @plan_id = @plan_id;

SELECT
    plan_id,
    is_forced_plan,
    force_failure_count,
    last_force_failure_reason_desc,
    CAST(AVG(qsrs.avg_duration) / 1000.0 AS decimal(18,3)) AS avg_ms,
    CAST(AVG(qsrs.avg_logical_io_reads) AS decimal(18,2)) AS avg_logical_io_reads
FROM sys.query_store_plan AS qsp
JOIN sys.query_store_runtime_stats AS qsrs ON qsp.plan_id = qsrs.plan_id
WHERE qsp.query_id = @query_id
GROUP BY plan_id, is_forced_plan, force_failure_count, last_force_failure_reason_desc
ORDER BY avg_logical_io_reads DESC;
```

| plan_id | is_forced_plan | force_failure_count | last_force_failure_reason_desc | avg_ms | avg_logical_io_reads |
|---:|---:|---:|---|---:|---:|
| 595 | 0 | 0 | `NONE` | 2.393 | 411.00 |
| 594 | 1 | 0 | `NONE` | 0.057 | 4.00 |

_The force worked cleanly. Plan `594` is now forced, `force_failure_count = 0`, and there is no recorded failure reason. This is the exact verification step to perform in production after forcing a plan: do not assume the force succeeded just because the stored procedure returned without error._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `is_forced_plan` | `1` | &#9989; | This plan is currently forced. | Query Store will try to keep this plan in effect. |
| `is_forced_plan` | `0` | Depends | Plan is not forced. | Normal for alternative or historical plans. |
| `force_failure_count` | `0` | &#9989; | No force failures recorded. | Forcing is currently healthy. |
| `force_failure_count` | `> 0` | &#10060; | SQL Server has failed to apply the forced plan. | Investigate validity, schema changes, and failure reason before trusting the force. |
| `last_force_failure_reason_desc` | `NONE` | &#9989; | No last-known failure. | Normal state. |
| `last_force_failure_reason_desc` | Anything else | &#10060; | Query Store recorded a force-application problem. | The forced plan may not actually be active. |

### Apply a Query Store hint

#### Add a Query Store hint without changing code

> [!warning]
> Hints are safer than emergency code edits, but they still create operational debt. A hint can outlive the condition that made it useful and then quietly become the new problem.
>
> [!success]
> Use Query Store hints when code cannot be changed quickly, then remove them after the root cause is fixed. Track every active hint explicitly.
>
> [!info]-
> This batch first unforces the demo plan, then applies a Query Store hint to the same `query_id`.
>
> - `sp_query_store_unforce_plan` removes the force so the hint example is isolated.
> - `sp_query_store_set_hints` applies an `OPTION(...)` clause to the query without editing the source text.
> - `sys.query_store_query_hints` is the source of truth for which hints exist, who created them, and whether they failed to apply.
> - The final `sp_query_store_clear_hints` keeps the environment clean after the demonstration.
>
> *Apply a Query Store hint to the same query, inspect the hint metadata, and then clear it.*
>
```sql
DECLARE @query_id bigint = 3161;
DECLARE @plan_id bigint = 594;

EXEC sys.sp_query_store_unforce_plan
    @query_id = @query_id,
    @plan_id = @plan_id;

EXEC sys.sp_query_store_set_hints
    @query_id = @query_id,
    @query_hints = N'OPTION(RECOMPILE, MAXDOP 1)';

SELECT
    query_hint_id,
    query_id,
    query_hint_text,
    source_desc,
    last_query_hint_failure_reason_desc,
    query_hint_failure_count,
    comment
FROM sys.query_store_query_hints
WHERE query_id = @query_id;

EXEC sys.sp_query_store_clear_hints
    @query_id = @query_id;
```

| query_hint_id | query_id | query_hint_text | source_desc | last_query_hint_failure_reason_desc | query_hint_failure_count | comment |
|---:|---:|---|---|---|---:|---|
| 2 | 3161 | `OPTION(RECOMPILE, MAXDOP 1)` | `User` | `NONE` | 0 | `NULL` |

_The hint was created successfully and has no failure history. The key columns to verify in production are the hint text itself, `source_desc`, and the last failure fields. If a hint exists but repeatedly fails to apply, it is not a working mitigation._

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `query_hint_text` | Explicit `OPTION(...)` text | Depends | The exact hint Query Store will try to apply. | Always review this text literally; small mistakes matter. |
| `source_desc` | `User` | Depends | A person or explicit process created the hint. | Operationally trackable. |
| `source_desc` | Non-user source | Depends | Hint came from another subsystem. | Verify why it exists before changing it. |
| `last_query_hint_failure_reason_desc` | `NONE` | &#9989; | No known hint-application failure. | Hint is syntactically and operationally viable so far. |
| `last_query_hint_failure_reason_desc` | Anything else | &#10060; | Hint failed to apply at least once. | Investigate before assuming the hint is helping. |
| `query_hint_failure_count` | `0` | &#9989; | No recorded failures. | Healthy hint state. |
| `query_hint_failure_count` | `> 0` | &#10060; | The hint has failed to apply one or more times. | Possible mismatch, unsupported hint, or invalid context. |
| `comment` | `NULL` | Depends | No extra annotation stored. | Fine technically, but teams should document hints elsewhere. |

## Operational Guidance

Query Store gives you three different control levels. Choose the least invasive one that actually addresses the problem.

### Force, hint, or fix

| Action | Use it when | Strength | Main risk | Preferred exit |
|---|---|---|---|---|
| Observe only | The query has multiple plans but no clearly dominant winner yet | Low | Wasting time on noise | Collect more runtime and compare again |
| Force a plan | One historical plan is clearly safer and the root cause is not fixed yet | Medium | Forced plan becomes stale after schema or data changes | Unforce after fixing stats, indexes, or query design |
| Query Store hint | Code cannot be changed quickly and you need a targeted mitigation | Medium | Hint becomes long-lived technical debt | Remove after permanent fix lands |
| Root-cause fix | Stats, indexing, predicates, parameterization, or schema are the real issue | High | Requires more effort and testing | Keep Query Store as validation, not as a crutch |

### What to watch after forcing or hinting

| Signal | Healthy | Concerning | Next step |
|---|---|---|---|
| `is_forced_plan` | Forced plan stays active | Forced plan disappears or force failures rise | Re-check `last_force_failure_reason_desc` and schema changes |
| Runtime spread | Best and worst plans converge after fix | Forced/hinted plan still underperforms | Re-open root-cause analysis; forcing was not enough |
| Query Store hint failures | `NONE`, count `0` | Failure reason not `NONE` or count rising | Remove or correct the hint |
| Plan count | Stable small set | Continues growing unexpectedly | Check parameter sensitivity, context settings, and workload churn |

## References

- [Query Store overview](https://learn.microsoft.com/en-us/sql/relational-databases/performance/monitoring-performance-by-using-the-query-store)
- [sys.database_query_store_options](https://learn.microsoft.com/en-us/sql/relational-databases/system-catalog-views/sys-database-query-store-options-transact-sql)
- [sys.query_store_plan](https://learn.microsoft.com/en-us/sql/relational-databases/system-catalog-views/sys-query-store-plan-transact-sql)
- [sys.query_store_query_hints](https://learn.microsoft.com/en-us/sql/relational-databases/system-catalog-views/sys-query-store-query-hints-transact-sql)
- [sp_query_store_force_plan](https://learn.microsoft.com/en-us/sql/relational-databases/system-stored-procedures/sp-query-store-force-plan-transact-sql)
- [sp_query_store_set_hints](https://learn.microsoft.com/en-us/sql/relational-databases/system-stored-procedures/sys-sp-query-store-set-hints-transact-sql)

