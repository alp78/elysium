---
type: concept
category: performance
technology: [sql-server]
tags: [performance, sql, sql-server, tsql]
aliases: [execution plans, query plans, parameter sniffing, cardinality estimation, plan cache, Query Store, SARGability, SHOWPLAN, key lookup, index seek, index scan, table scan]
keywords: [execution plan, query plan, SSMS, estimated rows, actual rows, cardinality estimation, parameter sniffing, plan cache, Query Store, index seek, index scan, table scan, key lookup, nested loops, hash match, merge join, STATISTICS XML, SET STATISTICS TIME, SET STATISTICS IO, logical reads, plan regression, force plan, sp_query_store_force_plan, implicit conversion, plan reuse, OPTION RECOMPILE]
description: "How to read, capture, and analyze SQL Server execution plans to identify performance problems — covers plan operators, cardinality estimation errors, parameter sniffing, Query Store setup, and plan forcing to fix regressions."
related: [wait-stats-analysis, memory-and-buffer-pool, sargable-queries, index-types-and-strategy, index-maintenance, server-configuration, essential-dba-queries]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Query Plan Analysis

SQL Server execution plans are the map SQL Server uses to execute a query. Reading them reveals exactly where time is being spent, why a query is slow, and what to change to fix it. Every performance investigation eventually leads here — [[wait-stats-analysis|wait statistics]] tell you the category of the problem, execution plans tell you the specific query and operator causing it.

## How to Read an Execution Plan

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

| Plan Type | How to Get It | What It Shows |
|-----------|--------------|---------------|
| **Estimated** | SSMS: Ctrl+L, or `SET SHOWPLAN_XML ON` | What the optimizer predicts — no actual execution |
| **Actual** | SSMS: Ctrl+M then run, or `SET STATISTICS XML ON` | Everything above PLUS real row counts, memory, spills, elapsed time |
| **Live** | SSMS: Include Live Query Statistics | Real-time animation showing rows flowing as query runs |

> [!tip] Always Use Actual Plans for Diagnosis
>
> Estimated plans can mislead when statistics are stale. Always prefer actual plans. Estimated plans are only useful when a query is too slow to complete.

## Capturing Plans from the Pipeline (Without SSMS)

#### sys.dm_exec_query_plan — capture from plan cache after pipeline runs

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

```sql
SET STATISTICS XML ON;
-- Run the pipeline query here
SET STATISTICS XML OFF;
-- The result set includes an XML column containing the full plan
```

#### SET STATISTICS TIME/IO — get actual timing and logical reads

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

#### sys.query_store_plan — Query Store persisted plans across restarts

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

#### XML plan nodes //RelOp — extract operator costs programmatically

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

The **cardinality estimator** predicts how many rows each operator will process. When predictions are wrong, the optimizer chooses bad strategies — wrong join types, insufficient memory grants, unnecessary sorts.

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

#### sys.databases compatibility_level — check and set CE version

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

## Wait Stats Inside Execution Plans

SQL Server 2016+ embeds **query-level wait statistics** directly into the actual execution plan XML. This lets you see exactly what each query waited on, not just server-wide waits.

#### SSMS WaitStats node — per-query wait stats in execution plans

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

#### XML plan //WaitStats/Wait — extract per-query waits from plan cache

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

Parameter sniffing occurs when SQL Server compiles a query plan based on the first set of parameters it sees, then reuses that plan for all subsequent executions — even when different parameters would benefit from a different plan.

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

#### OPTIMIZE FOR UNKNOWN, RECOMPILE — parameter sniffing fixes

| Fix | When to Use | Command |
|-----|------------|---------|
| `OPTION (RECOMPILE)` | Query is cheap to compile, parameters vary widely | Add to the query |
| `OPTION (OPTIMIZE FOR UNKNOWN)` | Use average statistics instead of sniffed values | Add to the query |
| `OPTIMIZE FOR (@param = value)` | One specific value is most common | Add to the query with the common value |
| Query Store plan forcing | Lock a known-good plan for a specific query | `sp_query_store_force_plan` |
| Split into separate queries | Different parameter ranges need fundamentally different plans | Application-level routing |

#### OPTION (RECOMPILE) — for pipeline queries with variable parameters

```sql
-- Forces recompile every time — optimal plan for each execution
SELECT * FROM silver.signals_daily
WHERE _index = @index_name
  AND signal_date >= @start_date
OPTION (RECOMPILE);
```

## Query Store Setup and Regression Detection

Query Store persists execution statistics and plans across restarts, enabling before/after comparison and plan forcing.

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

#### sys.query_store_runtime_stats — find regressed queries vs baseline

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

#### sp_query_store_force_plan — force a known-good plan

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

### Common Plan Problems and Fixes

| Problem | Symptom in Plan | Fix |
|---------|----------------|-----|
| **Missing index** | Table Scan or full Clustered Index Scan with high cost | Create nonclustered index on the WHERE/JOIN columns |
| **Key Lookup** | NC Index Seek followed by Key Lookup | Add INCLUDE columns to make the index covering |
| **Bad cardinality** | Estimated vs. Actual rows differ by 10x+ | Update statistics with FULLSCAN |
| **Sort spill** | Sort operator with warning icon | Add index that pre-sorts the data; increase `max server memory` |
| **Implicit conversion** | Warning on scan/seek: type conversion | Fix data types to match in WHERE clause (see [[sargable-queries]]) |
| **Parameter sniffing** | Same query wildly faster/slower depending on parameters | OPTION (RECOMPILE) or Query Store plan forcing |
| **Nested loops with many iterations** | Nested Loops with thick outer arrow | Add index on the inner table's join column |
| **Hash Match spill** | Hash Match with warning (spilled to TempDB) | Increase `max server memory` or fix cardinality to get correct memory grant |

### Tagging Pipeline Queries for Correlation

Add a SQL comment header to every pipeline query with DAG context so monitoring tools can slice by DAG, task, and run:

```python
# In your pipeline task function
dag_context = f"/* dag={dag_id} task={task_id} run={run_id} */"
cursor.execute(f"{dag_context} MERGE INTO silver.stock_dim ...")
```

These comments appear in `sys.dm_exec_sql_text` and in Query Store, enabling correlation between Airflow DAG timing and SQL Server query performance spikes.

### Related

- [[wait-stats-analysis]] — The starting point for performance diagnosis
- [[memory-and-buffer-pool]] — Memory grants, RESOURCE_SEMAPHORE, buffer pool
- [[sargable-queries]] — Writing queries that use index seeks instead of scans
- [[index-types-and-strategy]] — Building the right indexes to support efficient plans
- [[index-maintenance]] — Fragmented indexes cause worse plans and higher I/O costs
- [[server-configuration]] — MAXDOP and cost threshold settings that affect plan choices
- [[essential-dba-queries]] — Quick reference for plan cache queries

### References

- [Execution Plan Overview (Microsoft Docs)](https://learn.microsoft.com/en-us/sql/relational-databases/performance/execution-plans)
- [Query Store Overview (Microsoft Docs)](https://learn.microsoft.com/en-us/sql/relational-databases/performance/monitoring-performance-by-using-the-query-store)
