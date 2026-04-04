---
tags: [performance, sql, sql-server, tsql]
aliases: [execution plans, query plans, parameter sniffing, cardinality estimation, plan cache, Query Store, SARGability, SHOWPLAN, key lookup, index seek, index scan, table scan]
description: "How to read, capture, and analyze SQL Server execution plans to identify performance problems — covers plan operators, cardinality estimation errors, parameter sniffing, Query Store setup, and plan forcing to fix regressions."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Query Plan Analysis

> [!quote]
> "The query optimizer is the most sophisticated piece of software in any database system. Understanding its plan is how you meet it halfway."
>
> — **Kalen Delaney**, *SQL Server Internals*

SQL Server execution plans are the map SQL Server uses to execute a query. Reading them reveals exactly where time is being spent, why a query is slow, and what to change to fix it. Every performance investigation eventually leads here — [wait statistics](https://alp78.github.io/elysium/04-SQL-Server/Performance/wait-stats-analysis) tell you the category of the problem, execution plans tell you the specific query and operator causing it.

## How to Read an Execution Plan

When SQL Server receives a T-SQL query, the **Query Optimizer** determines *how* to execute it. The optimizer is a cost-based engine: it enumerates possible execution strategies — different join orders, index access methods, parallelism configurations — and selects the one with the lowest estimated cost, measured in abstract units of CPU and I/O work. The output is an **execution plan**: a tree of physical operators that each specify a concrete algorithm for retrieving, filtering, joining, sorting, or aggregating data. The optimizer does not guarantee the globally optimal plan; it guarantees the plan with the best *estimated* cost given current statistics. When those statistics are wrong or missing, the optimizer makes poor choices — and the execution plan is where that failure becomes visible.

SQL Server execution plans read **right-to-left, bottom-to-top**. Data sources (table/index scans and seeks) are on the right. Data flows left through transformations (joins, sorts, aggregations) until reaching the leftmost operator — the final SELECT, INSERT, or UPDATE result.

```
  SSMS Graphical Plan — read RIGHT to LEFT:

  ┌─────────────────────────────────────────────────────────────────────────┐
  │                                                                         │
  │   SELECT          Hash Match         Clustered Index    Clustered Index │
  │   Cost: 0%        (Inner Join)       Seek (silver)      Scan (bronze)  │
  │      ◄────────────  Cost: 12%  ◄──────  Cost: 28%  ◄──    Cost: 60%   │
  │                         │                                               │
  │                         │              Nonclustered                     │
  │                         ◄──────────    Index Seek         Key Lookup    │
  │                                        Cost: 0%   ◄──── Cost: 0%      │
  │                                                                         │
  │   ◄── direction of data flow                                            │
  │                                                                         │
  │   Arrows:                                                               │
  │   ═══════  thick arrow = many rows flowing                              │
  │   ───────  thin arrow  = few rows flowing                               │
  └─────────────────────────────────────────────────────────────────────────┘
```

### Plan Operators and Tree Structure

A plan tree is composed of **physical operators** — the concrete algorithms SQL Server selects to execute each step. Each operator receives input rows from the operator(s) to its right, applies its operation, and passes output rows to the left. The SSMS graphical plan renders this as a left-to-right arrow network; reading it right-to-left follows the data flow from source to output.

#### Reading the visual tree — operators, arrows, cost tooltips

1. **Start at the far right.** These are the data access operators:
   - **Index Seek** (good) — B-tree navigation to specific rows, O(log n)
   - **Index Scan** (check context) — reads all leaf pages of an index
   - **Table Scan** (usually bad) — full heap scan, reads every page
   - **Key Lookup** (expensive if frequent) — bookmark lookup from a nonclustered index to the clustered index to fetch additional columns

2. **Follow the arrows left.** Intermediate operators:
   - **Hash Match** — builds a hash table for joins or aggregations (needs memory grant)
   - **Merge Join** — merges two pre-sorted inputs (efficient if both already sorted)
   - **Nested Loops** — for each row in outer input, seeks into inner input (good for small outer sets)
   - **Sort** — sorts rows (watch for spill warnings — spills to TempDB when memory insufficient)
   - **Filter** — applies WHERE conditions that couldn't be pushed to the seek

3. **End at the far left.** Result operator: SELECT, INSERT, UPDATE, or DELETE.

4. **Check arrow thickness.** A sudden thick-to-thin transition reveals where filtering happens. Thick arrow into Nested Loops with thin inner input = many iterations = potential issue.

5. **Hover over each operator** in SSMS for the tooltip:
   - **Estimated/Actual Number of Rows** — are they close? (see cardinality section below)
   - **Estimated Operator Cost** — percentage of total query cost
   - **Number of Executions** — how many times this operator was invoked
   - **Warnings** — yellow triangle icons = spills, implicit conversions, missing indexes

### Estimated vs. Actual Plans

SQL Server can generate plans at three points in the query lifecycle. An **estimated plan** is built at compile time without executing the query — it reflects the optimizer's predictions based on statistics. An **actual plan** is generated after execution and layers real runtime measurements (row counts, memory usage, spill events, elapsed time) on top of the optimizer's predictions. The delta between estimated and actual values is the primary diagnostic signal. A **live plan** streams real-time operator progress as the query executes, useful for diagnosing long-running queries that cannot be interrupted.

| Plan Type | How to Get It | What It Shows |
|-----------|--------------|---------------|
| **Estimated** | SSMS: Ctrl+L, or `SET SHOWPLAN_XML ON` | What the optimizer predicts — no actual execution |
| **Actual** | SSMS: Ctrl+M then run, or `SET STATISTICS XML ON` | Everything above PLUS real row counts, memory, spills, elapsed time |
| **Live** | SSMS: Include Live Query Statistics | Real-time animation showing rows flowing as query runs |

> [!tip] Always Use Actual Plans for Diagnosis
>
> Estimated plans can mislead when statistics are stale. Always prefer actual plans. Estimated plans are only useful when a query is too slow to complete.

## Capturing Plans from the Pipeline (Without SSMS)

SQL Server stores compiled execution plans in the **plan cache** — a memory region within the buffer pool. When a batch executes, SQL Server first checks whether a valid, reusable plan already exists. If found, it skips compilation entirely and executes directly, saving CPU overhead. Plans remain in cache until evicted by memory pressure, a schema change invalidating the plan, or a manual `DBCC FREEPROCCACHE`. This persistence makes post-run capture possible: pipeline queries leave their plans in cache after execution, where they can be retrieved by DMVs without rerunning the query.

Four capture methods are available without SSMS: two DMV-based approaches that interrogate the live cache, one session-scoped instrumentation approach (`SET STATISTICS`), and one Query Store approach for plans that must survive restarts.

### Plan Cache and Live Capture

#### sys.dm_exec_query_plan — capture from plan cache after pipeline runs

Queries `sys.dm_exec_query_stats` for cached execution statistics and cross-applies `sys.dm_exec_query_plan` to retrieve the corresponding plan XML. The `WHERE` clause filters by query text to isolate pipeline queries. Click the XML result in SSMS to open the graphical plan viewer.

```sql
-- Find plans for pipeline queries by text snippet
SELECT
    qp.query_plan,
    qs.execution_count,
    qs.total_logical_reads / qs.execution_count AS avg_reads,
    qs.total_worker_time / qs.execution_count / 1000 AS avg_cpu_ms
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_query_plan(qs.plan_handle) qp
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
WHERE st.text LIKE '%silver.signals_daily%'
ORDER BY qs.total_worker_time DESC;
-- Click the XML result in SSMS to open the graphical plan viewer
```

#### SET STATISTICS XML ON — capture a live XML plan

Session-scoped instrumentation that outputs a full plan XML alongside the query result set. Use when you need the actual plan for a query running in your current session, rather than retrieving a previously cached plan. The XML output appears as a separate result set in the Messages tab — click it to open the graphical plan viewer.

```sql
SET STATISTICS XML ON;
-- Run the pipeline query here
SET STATISTICS XML OFF;
-- The result set includes an XML column containing the full plan
```

#### SET STATISTICS TIME/IO — get actual timing and logical reads

Reports CPU time, elapsed time, and logical read counts per table in the SSMS Messages tab. Logical reads are the most direct measure of I/O pressure: each logical read represents one 8 KB page read from the buffer pool (or disk, if not cached). CPU time isolates compute-heavy operators. These metrics are the ground truth for measuring query cost and complement the plan's percentage-based cost estimates.

```sql
SET STATISTICS TIME ON;
SET STATISTICS IO ON;

-- Run your query
SELECT ...

SET STATISTICS TIME OFF;
SET STATISTICS IO OFF;

-- Output shows:
-- Table 'signals_daily'. Scan count 1, logical reads 342, physical reads 0
-- SQL Server Execution Times: CPU time = 15 ms, elapsed time = 23 ms.
```

### Query Store Plan Capture

#### sys.query_store_plan — Query Store persisted plans across restarts

Retrieves persisted execution statistics and plan XML from Query Store. Unlike the plan cache — which is volatile and cleared on server restart — Query Store retains plan history, runtime statistics, and wait data across restarts. It is the preferred source for comparing plan performance over time or after a statistics update or index change.

```sql
SELECT
    qsqt.query_sql_text,
    TRY_CAST(qsp.query_plan AS XML) AS plan_xml,
    qsrs.avg_duration / 1000 AS avg_ms,
    qsrs.avg_logical_io_reads
FROM sys.query_store_runtime_stats qsrs
JOIN sys.query_store_plan qsp ON qsrs.plan_id = qsp.plan_id
JOIN sys.query_store_query qsq ON qsp.query_id = qsq.query_id
JOIN sys.query_store_query_text qsqt ON qsq.query_text_id = qsqt.query_text_id
ORDER BY qsrs.avg_duration DESC;
```

## Cost Analysis — Finding the Most Expensive Operator

Every operator shows an **Estimated Operator Cost** as a percentage of total query cost.

```
  Example plan with cost percentages:

  SELECT (0%)  ◄──  Sort (5%)  ◄──  Hash Match Join (15%)  ◄──┬── Clustered Index Seek (8%)
                                                               │
                                                               └── Clustered Index Scan (72%)
                                                                          ▲
                                                                          │
                                                               THIS is your bottleneck
                                                               72% of total cost
```

| Cost Range | Meaning | Action |
|-----------|---------|--------|
| 0–5% | Negligible | Ignore |
| 5–20% | Normal | Check if query is slow overall |
| 20–50% | Significant | Investigate — may benefit from index or rewrite |
| 50–100% | Dominant | This operator is the bottleneck — fix this first |

> [!warning] Cost Percentages Are Estimates
>
> Costs are based on the optimizer's statistics, not actual execution. If statistics are stale, cost distribution can be completely wrong. Always cross-reference with actual row counts and SET STATISTICS IO output.

> [!success] Safe Pattern — Validate with Actual Plans and STATISTICS IO
>
> Always run queries with **Include Actual Execution Plan** (Ctrl+M) and `SET STATISTICS IO ON` before drawing conclusions from cost percentages. Use actual row counts versus estimated row counts as the primary signal. If estimated and actual rows diverge by more than 10x on a key operator, run `UPDATE STATISTICS <table> WITH FULLSCAN` and re-examine the plan.

### Programmatic Cost Extraction

#### XML plan nodes //RelOp — extract operator costs programmatically

Each operator in the plan XML is represented by a `RelOp` element under the ShowPlan namespace. The `@EstimatedTotalSubtreeCost` attribute accumulates all costs beneath that node, making it the correct field for ranking operators by total contribution. This query retrieves and sorts all operators by subtree cost for a given plan handle — replace `<your_sql_handle>` with the value from `sys.dm_exec_query_stats`.

```sql
;WITH XMLNAMESPACES (DEFAULT 'http://schemas.microsoft.com/sqlserver/2004/07/showplan')
SELECT
    node.value('@PhysicalOp', 'varchar(50)') AS operator_name,
    node.value('@EstimatedTotalSubtreeCost', 'float') AS subtree_cost,
    node.value('@EstimateRows', 'float') AS estimated_rows,
    node.value('@EstimateIO', 'float') AS io_cost,
    node.value('@EstimateCPU', 'float') AS cpu_cost
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_query_plan(qs.plan_handle) qp
CROSS APPLY qp.query_plan.nodes('//RelOp') AS T(node)
WHERE qs.sql_handle = <your_sql_handle>
ORDER BY subtree_cost DESC;
```

## Cardinality Estimation — Detecting Bad Row Count Guesses

The **cardinality estimator** (CE) is the component of the Query Optimizer that predicts how many rows each operator will process. These predictions feed directly into the cost model: the optimizer selects join algorithms, allocates memory grants, and decides on parallelism based on estimated row counts. When predictions are wrong, the optimizer systematically makes bad decisions — choosing Nested Loops for joins that produce millions of rows, allocating a 1 MB memory grant for a Sort that needs 512 MB, or building an unnecessary intermediate Sort because it cannot infer the data is already ordered.

The CE derives row count estimates primarily from **statistics histograms** — per-column data distribution summaries created automatically when an index is built or when statistics are created manually. Each histogram is capped at **200 steps** regardless of table size, so for large tables with skewed distributions, many distinct values collapse into a single step and their individual frequencies are lost. The histogram covers only the **leftmost column** of a multi-column index; all other columns get density-based estimates (the *all density* value — the reciprocal of the number of distinct values), which are far less precise than histogram-based estimates.

SQL Server has shipped two major CE architectures:

| CE Version | Compat Level | Default Since | Key Change |
|---|---|---|---|
| CE 70 (Legacy) | ≤ 110 | SQL Server 7.0 | Pre-2014 model; more conservative join estimates |
| CE 120 (New) | 120 | SQL Server 2014 | Redesigned with four documented assumptions |
| CE 160 | 160 | SQL Server 2022 | Adds CE feedback, PSP optimization, adaptive memory grants |

The new CE (120+) is built on four assumptions: **uniformity** (values are evenly distributed within histogram steps), **independence** (predicates on different columns are uncorrelated), **containment** (matching attribute values always exist on both sides of a join), and **inclusion** (constant comparisons always match at least one row). These assumptions hold for many workloads but break badly on correlated columns, skewed distributions, and multi-predicate queries — leading to the cardinality mismatches visible in execution plans.

**The golden rule:** Compare **Estimated Number of Rows** vs. **Actual Number of Rows** for every operator. A ratio > 10x in either direction signals a problem.

```
  Example: Cardinality estimation mismatch

  ┌────────────────────────────────┐     ┌────────────────────────────────┐
  │ GOOD ESTIMATE                  │     │ BAD ESTIMATE                   │
  │                                │     │                                │
  │ Estimated Rows: 1,200          │     │ Estimated Rows: 50             │
  │ Actual Rows:    1,350          │     │ Actual Rows:    48,000         │
  │ Ratio: 1.1x ✓                 │     │ Ratio: 960x ✗                  │
  │                                │     │                                │
  │ Optimizer chose Hash Join      │     │ Optimizer chose Nested Loops   │
  │ Memory grant: 2 MB (adequate)  │     │ (because it expected 50 rows)  │
  │ No spills                      │     │ Actual: 48,000 loop iterations │
  └────────────────────────────────┘     │ Memory grant: tiny → SPILL     │
                                         └────────────────────────────────┘
```

### Diagnosing Cardinality Estimation Errors

#### SSMS Actual Execution Plan — spot bad cardinality estimates

1. Run query with **Include Actual Execution Plan** (Ctrl+M)
2. Hover over each operator — tooltip shows Estimated and Actual rows
3. Look for thick arrows where you expect thin ones (or vice versa)
4. SSMS 18+ shows a **warning icon** (yellow triangle) when estimates are off by > 10x

#### Common causes of bad cardinality estimates and fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| Estimated = 1, Actual = 50,000 | Statistics not updated after bulk load | `UPDATE STATISTICS table WITH FULLSCAN` |
| Estimated = 100,000, Actual = 5 | Stats built when table was full, then data deleted | `UPDATE STATISTICS` or `OPTION (RECOMPILE)` |
| Estimates wrong on joined columns | Multi-column correlation not captured | Create multi-column statistics: `CREATE STATISTICS stat_idx_sym ON silver.signals_daily (_index, symbol)` |
| Estimates wrong with local variables | Optimizer cannot sniff variable values | Use `OPTION (RECOMPILE)` or parameterize the query |
| Estimates wrong on filtered data | Statistics histogram has insufficient granularity | `UPDATE STATISTICS ... WITH FULLSCAN` or filtered statistics |

### CE Versions and SQL Server 2022 Improvements

#### sys.databases compatibility_level — check and set CE version

The database compatibility level determines which CE model is active. CE feedback (SQL Server 2022) requires compat level 160 and Query Store in `READ_WRITE` mode. Use trace flags `QUERYTRACEON 2312` to force the new CE on an older compat level, or `QUERYTRACEON 9481` to force the legacy CE — useful for isolating regressions introduced by a CE model upgrade. The `LEGACY_CARDINALITY_ESTIMATION` database scoped configuration applies the override at the database level without changing compat level.

```sql
-- Check which CE model your database uses
SELECT name, compatibility_level FROM sys.databases WHERE name = 'analytics_db';
-- 160 = SQL Server 2022 CE (recommended)
-- 120 = SQL Server 2014 CE
-- 70  = Legacy CE (pre-2014)

-- Force legacy CE for a specific query if the new CE gives worse estimates
SELECT * FROM silver.signals_daily
WHERE _index = 'market_index'
OPTION (USE HINT('FORCE_LEGACY_CARDINALITY_ESTIMATION'));
```

#### SQL Server 2022 — CE feedback via Query Store

SQL Server 2022 (compat level 160) introduces **Cardinality Estimation Feedback**: the optimizer detects when its CE assumptions produce large estimation errors at runtime, tests an alternate model assumption, and — if the alternate produces better plans across repeated executions — persists the corrected assumption as a Query Store hint. This happens automatically without query or index changes. CE feedback currently handles predicate selectivity (correlation model) and join predicate scenarios (containment model).

CE feedback requires Query Store to be enabled and in `READ_WRITE` mode on the database. Feedback activity is visible via `sys.query_store_plan_feedback` and the `query_feedback_analysis` extended event.

```sql
-- Disable CE feedback at database level if it causes regressions
ALTER DATABASE SCOPED CONFIGURATION SET CE_FEEDBACK = OFF;

-- Inspect what CE feedback has persisted for specific queries
SELECT
    q.query_id,
    qt.query_sql_text,
    qpf.feedback_data,
    qpf.state_desc
FROM sys.query_store_plan_feedback qpf
JOIN sys.query_store_plan qsp ON qpf.plan_id = qsp.plan_id
JOIN sys.query_store_query q ON qsp.query_id = q.query_id
JOIN sys.query_store_query_text qt ON q.query_text_id = qt.query_text_id
ORDER BY qpf.create_time DESC;
```

> [!info] CE Feedback Prerequisite
>
> CE feedback is active only when: (1) database compatibility level = 160, (2) Query Store is `ON` and `OPERATION_MODE = READ_WRITE`, (3) no manual query hint or forced plan overrides the query. If any condition is not met, CE feedback silently does nothing.

> [!tip] Extended Events for CE Diagnosis
>
> The `query_optimizer_estimate_cardinality` and `inaccurate_cardinality_estimate` extended events expose CE internals at execution time — useful for diagnosing bad estimates without needing full Profiler traces. Pair with the `query_feedback_analysis` XEvent to see CE feedback decisions in real time.

## Wait Stats Inside Execution Plans

SQL Server 2016+ embeds **query-level wait statistics** directly into the actual execution plan XML. This lets you see exactly what each query waited on, not just server-wide waits. Server-wide wait stats from `sys.dm_os_wait_stats` show aggregated totals across all queries — useful for identifying dominant wait categories, but impossible to tie to a specific query. Per-query wait stats in execution plans bridge that gap: they show exactly how many milliseconds a specific execution spent on each wait type, disambiguating performance problems that look similar from server-wide stats alone.

### Reading Wait Stats from SSMS

#### SSMS WaitStats node — per-query wait stats in execution plans

Opens the per-query wait stats breakdown embedded in the execution plan's root operator properties. The `WaitStats` node appears only in actual plans (not estimated) and only when at least one wait occurred during execution.

1. Run query with Include Actual Execution Plan (Ctrl+M)
2. Right-click on the root operator (leftmost: SELECT, INSERT, etc.)
3. Click **Properties** (F4)
4. Expand **WaitStats** node in the Properties panel

```
  SSMS Properties panel example:

  ▼ WaitStats
    ├── WaitType: PAGEIOLATCH_SH
    │   ├── WaitCount: 23
    │   └── WaitTimeMs: 142
    ├── WaitType: CXPACKET
    │   ├── WaitCount: 4
    │   └── WaitTimeMs: 38
    └── WaitType: ASYNC_NETWORK_IO
        ├── WaitCount: 1
        └── WaitTimeMs: 5

  Interpretation:
  • 142ms waiting for disk I/O (pages not in buffer pool)
  • 38ms parallelism coordination
  • 5ms waiting for client to consume rows
```

### Querying Wait Stats from Plan Cache

#### XML plan //WaitStats/Wait — extract per-query waits from plan cache

XQuery-based extraction of the `WaitStats/Wait` nodes from cached actual plans. Use this to identify which wait type dominates specific pipeline queries without opening SSMS. Results are sorted by `WaitTimeMs` descending so the most expensive wait type surfaces first.

```sql
;WITH XMLNAMESPACES (DEFAULT 'http://schemas.microsoft.com/sqlserver/2004/07/showplan')
SELECT
    SUBSTRING(st.text, 1, 200) AS query_text,
    ws.value('@WaitType', 'varchar(100)') AS wait_type,
    ws.value('@WaitTimeMs', 'bigint') AS wait_time_ms,
    ws.value('@WaitCount', 'bigint') AS wait_count
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_query_plan(qs.plan_handle) qp
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
CROSS APPLY qp.query_plan.nodes('//WaitStats/Wait') AS W(ws)
WHERE st.text LIKE '%silver.signals_daily%'
ORDER BY ws.value('@WaitTimeMs', 'bigint') DESC;
```

## Parameter Sniffing

Parameter sniffing is the mechanism by which SQL Server captures — "sniffs" — the actual parameter values at query compile time and uses them to generate a plan optimized for those specific values. Sniffing occurs for three types of batches: **stored procedures**, **queries submitted via `sp_executesql`**, and **prepared statements**. When the sniffed values are representative of the typical workload, sniffing is beneficial — it produces efficient, data-aware plans without recompiling every execution.

The problem arises when data is unevenly distributed. A plan compiled for a rare, high-selectivity parameter value (e.g., a small customer with 5 orders) will use Nested Loops — efficient for 5 rows. When the same cached plan executes for a large customer with 500,000 orders, it runs 500,000 Nested Loop iterations instead of a Hash Join, and performance collapses. The symptom is a query that runs fine sometimes and catastrophically slowly other times, with no code change between executions.

> [!warning] Statistics Updates Can Trigger Sniffing Regressions
>
> A statistics update or index rebuild forces a plan recompile. If the recompile happens to be triggered by a rare parameter value being executed first, the new plan will be suboptimal for the common case — even though the data distribution itself has not changed.

> [!success] Monitor Plan Age and Recompile Triggers
>
> Track `sys.dm_exec_query_stats.creation_time` for high-variance queries. If a plan was recently compiled (within the last few hours), check what triggered the recompile with the `sql_statement_recompile` Extended Event.

### Detecting Parameter Sniffing

#### sys.dm_exec_query_stats min/max variance — detect parameter sniffing

```sql
-- Find queries with high variance in execution time (potential sniffing)
SELECT TOP 20
    qs.max_elapsed_time / 1000      AS max_elapsed_ms,
    qs.min_elapsed_time / 1000      AS min_elapsed_ms,
    qs.max_elapsed_time / NULLIF(qs.min_elapsed_time, 0) AS variance_ratio,
    qs.max_logical_reads            AS max_reads,
    qs.min_logical_reads            AS min_reads,
    qs.execution_count,
    SUBSTRING(st.text, 1, 200)      AS query_text
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
WHERE qs.min_elapsed_time > 0
  AND qs.max_elapsed_time / qs.min_elapsed_time > 100  -- 100x variance
ORDER BY qs.max_elapsed_time DESC;
```

### Fixes for Parameter Sniffing

#### OPTIMIZE FOR UNKNOWN, RECOMPILE, and PSP — parameter sniffing fixes

Each fix trades plan quality for a different resource: `RECOMPILE` trades CPU (recompile overhead) for optimal per-execution plans; `OPTIMIZE FOR UNKNOWN` trades plan accuracy for plan stability; PSP (SQL Server 2022) is the only native fix that requires no query modification.

| Fix | When to Use | Command |
|-----|------------|---------|
| `OPTION (RECOMPILE)` | Query is cheap to compile, parameters vary widely | Add to the query |
| `OPTION (OPTIMIZE FOR UNKNOWN)` | Use average statistics instead of sniffed values | Add to the query |
| `OPTIMIZE FOR (@param = value)` | One specific value is most common | Add to the query with the common value |
| `OPTION (USE HINT('DISABLE_PARAMETER_SNIFFING'))` | Disable sniffing for a specific query without RECOMPILE | Add to the query |
| Query Store plan forcing | Lock a known-good plan for a specific query | `sp_query_store_force_plan` |
| **PSP optimization** (SQL Server 2022) | Automatic; no query change needed; compat level 160 required | `ALTER DATABASE ... COMPATIBILITY_LEVEL = 160` |
| Split into separate queries | Different parameter ranges need fundamentally different plans | Application-level routing |

> [!info] Parameter-Sensitive Plan (PSP) Optimization — SQL Server 2022
>
> PSP optimization (compat level 160) addresses parameter sniffing natively without requiring query hints. When enabled, SQL Server generates multiple plan variants — called **dispatcher plans** — for a single query, each optimized for a different range of parameter values. At execution time, the optimizer dispatches to the variant whose statistics best match the current parameter. PSP is enabled by default at compat level 160 and integrates with Query Store for plan tracking. Disable per query with `OPTION (USE HINT('DISABLE_PARAMETER_SENSITIVE_PLAN'))` or per database with `ALTER DATABASE SCOPED CONFIGURATION SET PARAMETER_SENSITIVE_PLAN_OPTIMIZATION = OFF`.

#### OPTION (RECOMPILE) — for pipeline queries with variable parameters

Forces a plan recompile on every execution. Unlike standard plan reuse, `OPTION (RECOMPILE)` treats the current parameter values as compile-time constants, allowing the optimizer to constant-fold predicates and select the most selective index for the actual values. Best suited for pipeline queries that run infrequently but with highly variable filters.

```sql
-- Forces recompile every time — optimal plan for each execution
SELECT * FROM silver.signals_daily
WHERE _index = @index_name
  AND signal_date >= @start_date
OPTION (RECOMPILE);
```

## Query Store Setup and Regression Detection

**Query Store** is SQL Server's built-in flight recorder for query performance. It captures query text, execution plans, and runtime statistics — execution count, average and total duration, logical reads, CPU time, and wait statistics — and persists all of it to disk, so the data survives server restarts. This distinguishes it from the plan cache, which is purely in-memory and volatile.

Query Store serves three primary functions: (1) **regression detection** — comparing a query's current performance against a historical baseline to identify plan regressions after statistics updates or index changes; (2) **plan forcing** — pinning a query to a known-good plan, overriding the optimizer's current choice; (3) **intelligent query processing integration** — in SQL Server 2022 (compat 160), CE feedback, PSP optimization, memory grant feedback, and DOP feedback all require Query Store to be enabled in `READ_WRITE` mode.

> [!info] SQL Server 2022 — Query Store Enabled by Default
>
> Starting with SQL Server 2022, Query Store is enabled by default for all **newly created databases** with `OPERATION_MODE = READ_WRITE` and `QUERY_CAPTURE_MODE = AUTO`. For databases upgraded from older versions, it must still be enabled manually.

### Enabling and Configuring Query Store

#### ALTER DATABASE SET QUERY_STORE — enable and configure

```sql
ALTER DATABASE analytics_db SET QUERY_STORE = ON;
ALTER DATABASE analytics_db SET QUERY_STORE (
    OPERATION_MODE = READ_WRITE,
    MAX_STORAGE_SIZE_MB = 500,
    INTERVAL_LENGTH_MINUTES = 30,
    DATA_FLUSH_INTERVAL_SECONDS = 600,
    STALE_QUERY_THRESHOLD_DAYS = 30,
    SIZE_BASED_CLEANUP_MODE = AUTO,
    QUERY_CAPTURE_MODE = AUTO,
    MAX_PLANS_PER_QUERY = 200,
    WAIT_STATS_CAPTURE_MODE = ON
);

-- Verify configuration
SELECT
    desired_state_desc,
    actual_state_desc,
    current_storage_size_mb,
    max_storage_size_mb,
    stale_query_threshold_days,
    query_capture_mode_desc
FROM sys.database_query_store_options;
```

### Finding Regressed Queries

#### sys.query_store_runtime_stats — find regressed queries vs baseline

Compares recent query performance (last 24 hours) against a 7-day historical baseline. The `regression_factor` column shows how many times slower the query has become — a value above 2 means the query is running at least twice as slow as its baseline. Filter further with `recent_executions > 5` to exclude queries that ran only once (which may have been outliers).

```sql
WITH recent AS (
    SELECT
        q.query_id,
        qt.query_sql_text,
        AVG(rs.avg_duration) / 1000.0 AS recent_avg_ms,
        AVG(rs.avg_cpu_time) / 1000.0 AS recent_avg_cpu_ms,
        AVG(rs.avg_logical_io_reads) AS recent_avg_reads,
        SUM(rs.count_executions) AS recent_executions
    FROM sys.query_store_runtime_stats rs
    JOIN sys.query_store_plan p ON rs.plan_id = p.plan_id
    JOIN sys.query_store_query q ON p.query_id = q.query_id
    JOIN sys.query_store_query_text qt ON q.query_text_id = qt.query_text_id
    WHERE rs.last_execution_time > DATEADD(HOUR, -24, GETUTCDATE())
    GROUP BY q.query_id, qt.query_sql_text
),
baseline AS (
    SELECT
        q.query_id,
        AVG(rs.avg_duration) / 1000.0 AS baseline_avg_ms,
        AVG(rs.avg_logical_io_reads) AS baseline_avg_reads
    FROM sys.query_store_runtime_stats rs
    JOIN sys.query_store_plan p ON rs.plan_id = p.plan_id
    JOIN sys.query_store_query q ON p.query_id = q.query_id
    WHERE rs.last_execution_time BETWEEN DATEADD(DAY, -7, GETUTCDATE())
                                     AND DATEADD(HOUR, -24, GETUTCDATE())
    GROUP BY q.query_id
)
SELECT TOP 20
    r.query_id,
    LEFT(r.query_sql_text, 200) AS query_text,
    r.recent_executions,
    CAST(b.baseline_avg_ms AS DECIMAL(10,1)) AS baseline_ms,
    CAST(r.recent_avg_ms AS DECIMAL(10,1)) AS recent_ms,
    CAST(r.recent_avg_ms / NULLIF(b.baseline_avg_ms, 0) AS DECIMAL(5,1)) AS regression_factor,
    CAST(r.recent_avg_reads AS INT) AS recent_reads,
    CAST(b.baseline_avg_reads AS INT) AS baseline_reads
FROM recent r
JOIN baseline b ON r.query_id = b.query_id
WHERE r.recent_avg_ms > b.baseline_avg_ms * 2
  AND r.recent_executions > 5
ORDER BY r.recent_avg_ms / NULLIF(b.baseline_avg_ms, 0) DESC;
```

### Forcing Plans and Applying Hints

#### sp_query_store_force_plan — force a known-good plan

Pins a query to a specific historical plan ID. Once forced, the optimizer will use that plan for all future executions regardless of statistics changes, index modifications, or parameter values. Forcing is appropriate when a query has regressed to a bad plan after a statistics update and a quick fix is needed while the root cause is investigated. Always document forced plans and set a review schedule — forced plans prevent the optimizer from benefiting from future improvements (new indexes, statistics corrections).

```sql
-- List available plans for a specific query
SELECT
    p.plan_id,
    p.query_id,
    p.is_forced_plan,
    rs.avg_duration / 1000.0 AS avg_ms,
    rs.avg_logical_io_reads AS avg_reads,
    rs.count_executions,
    rs.last_execution_time
FROM sys.query_store_plan p
JOIN sys.query_store_runtime_stats rs ON p.plan_id = rs.plan_id
WHERE p.query_id = @query_id  -- replace with actual query_id
ORDER BY rs.avg_duration;

-- Force the best plan
EXEC sp_query_store_force_plan @query_id = @query_id, @plan_id = @plan_id;

-- Unforce when no longer needed
-- EXEC sp_query_store_unforce_plan @query_id = @query_id, @plan_id = @plan_id;
```

#### sp_query_store_set_hints — apply query hints without modifying code (SQL Server 2022)

**Query Store Hints** (SQL Server 2022) allow applying query hints — `RECOMPILE`, `MAXDOP`, `OPTIMIZE FOR UNKNOWN`, `FORCE_LEGACY_CARDINALITY_ESTIMATION`, and others — to a specific query identified by its `query_id`, without modifying the query text or stored procedure. This is the preferred mechanism when modifying application code is not feasible, such as when queries are generated by an ORM or a third-party ETL tool.

```sql
-- Find the query_id for a target query
SELECT q.query_id, qt.query_sql_text
FROM sys.query_store_query_text qt
JOIN sys.query_store_query q ON qt.query_text_id = q.query_text_id
WHERE qt.query_sql_text LIKE '%silver.signals_daily%'
  AND qt.query_sql_text NOT LIKE '%query_store%';

-- Apply a hint to a specific query (no code change needed)
EXEC sys.sp_query_store_set_hints
    @query_id = 42,  -- replace with actual query_id
    @query_hints = N'OPTION(RECOMPILE)';

-- Combine multiple hints in one call
EXEC sys.sp_query_store_set_hints
    @query_id = 42,
    @query_hints = N'OPTION(RECOMPILE, MAXDOP 4)';

-- Remove hints when no longer needed
EXEC sys.sp_query_store_clear_hints @query_id = 42;

-- Inspect currently applied hints
SELECT q.query_id, qt.query_sql_text, qh.query_hint_text
FROM sys.query_store_query_hints qh
JOIN sys.query_store_query q ON qh.query_id = q.query_id
JOIN sys.query_store_query_text qt ON q.query_text_id = qt.query_text_id;
```

> [!warning] Query Store Hints Override CE Feedback
>
> If a query has Query Store Hints applied — whether manually via `sp_query_store_set_hints` or automatically by CE feedback — the hints take precedence. CE feedback will not apply further corrections to a query that already has active hints.

> [!success] Use Hints as a Temporary Fix, Root Cause as the Goal
>
> Query Store Hints are a surgical temporary fix. Always track which queries have active hints (`sys.query_store_query_hints`), document the reason and date, and schedule a root-cause investigation. Permanent fixes — updating statistics, creating covering indexes, or fixing implicit conversions — are always preferable to long-lived hints.

### Common Plan Problems and Fixes

| Problem | Symptom in Plan | Fix |
|---------|----------------|-----|
| **Missing index** | Table Scan or full Clustered Index Scan with high cost | Create nonclustered index on the WHERE/JOIN columns |
| **Key Lookup** | NC Index Seek followed by Key Lookup | Add INCLUDE columns to make the index covering |
| **Bad cardinality** | Estimated vs. Actual rows differ by 10x+ | Update statistics with FULLSCAN |
| **Sort spill** | Sort operator with warning icon | Add index that pre-sorts the data; increase `max server memory` |
| **Implicit conversion** | Warning on scan/seek: type conversion | Fix data types to match in WHERE clause (see [sargable-queries](https://alp78.github.io/elysium/04-SQL-Server/T-SQL/sargable-queries)) |
| **Parameter sniffing** | Same query wildly faster/slower depending on parameters | OPTION (RECOMPILE) or Query Store plan forcing |
| **Nested loops with many iterations** | Nested Loops with thick outer arrow | Add index on the inner table's join column |
| **Hash Match spill** | Hash Match with warning (spilled to TempDB) | Increase `max server memory` or fix cardinality to get correct memory grant |

### Tagging Pipeline Queries for Correlation

SQL Server surfaces query text via `sys.dm_exec_sql_text` and in Query Store's `query_sql_text` column. By embedding structured metadata in a SQL comment header — DAG id, task id, Airflow run id — every query becomes attributable to the exact pipeline execution that submitted it, enabling direct correlation between Airflow task timing and SQL Server query performance spikes.

#### Inject DAG context comment into pipeline queries

Prefixes every SQL statement submitted by a pipeline task with a structured comment block. The comment is invisible to the query optimizer but visible to monitoring queries against `sys.dm_exec_sql_text`, `sys.query_store_query_text`, and the Query Store UI.

```python
# In your pipeline task function
dag_context = f"/* dag={dag_id} task={task_id} run={run_id} */"
cursor.execute(f"{dag_context} MERGE INTO silver.stock_dim ...")
```

### Related

- [wait-stats-analysis](https://alp78.github.io/elysium/04-SQL-Server/Performance/wait-stats-analysis) — The starting point for performance diagnosis
- [memory-and-buffer-pool](https://alp78.github.io/elysium/04-SQL-Server/Performance/memory-and-buffer-pool) — Memory grants, RESOURCE_SEMAPHORE, buffer pool
- [sargable-queries](https://alp78.github.io/elysium/04-SQL-Server/T-SQL/sargable-queries) — Writing queries that use index seeks instead of scans
- [index-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/index-types-and-strategy) — Building the right indexes to support efficient plans
- [index-maintenance](https://alp78.github.io/elysium/04-SQL-Server/Performance/index-maintenance) — Fragmented indexes cause worse plans and higher I/O costs
- [server-configuration](https://alp78.github.io/elysium/04-SQL-Server/Administration/server-configuration) — MAXDOP and cost threshold settings that affect plan choices
- [essential-dba-queries](https://alp78.github.io/elysium/04-SQL-Server/Administration/essential-dba-queries) — Quick reference for plan cache queries

### References

- [Execution Plan Overview (Microsoft Docs)](https://learn.microsoft.com/en-us/sql/relational-databases/performance/execution-plans)
- [Query Store Overview (Microsoft Docs)](https://learn.microsoft.com/en-us/sql/relational-databases/performance/monitoring-performance-by-using-the-query-store)
