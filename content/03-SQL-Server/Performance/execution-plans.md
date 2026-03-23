---
type: concept
category: sql-server
technology: [sql-server]
tags: [sql]
aliases: [query execution plan, estimated plan, actual plan, graphical plan, showplan, query plan]
keywords: [execution plan, estimated plan, actual plan, SHOWPLAN_XML, STATISTICS XML, right-to-left, bottom-to-top, Index Seek, Index Scan, Key Lookup, Hash Match, Nested Loops, Sort, cardinality estimation, row count estimate, statistics, parameter sniffing, implicit conversion, batch mode, OPTION RECOMPILE, OPTIMIZE FOR UNKNOWN, wait stats in plan, WaitStats, plan cache, Query Store, cost percentage, operator cost, spill, memory grant, CXPACKET, PAGEIOLATCH, PhysicalOp]
description: "How to read SQL Server execution plans in SSMS: right-to-left data flow, estimated vs actual plans, cost analysis, cardinality estimation errors, per-query wait stats, implicit conversions, parameter sniffing, and batch mode. Includes all programmatic XML queries."
related: [wait-stats-analysis, sargable-queries, index-types-and-strategy, storage-internals, performance-audit-playbook]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Execution Plans

SQL Server execution plans are the primary diagnostic tool for query performance. They show exactly how SQL Server chose to execute a query — which indexes it used, how it joined tables, how many rows it expected vs. actually processed, and what it waited on. Reading plans correctly is the skill that turns a 60-second query into a 200ms query.

---

## Estimated vs. Actual Plans

| Plan type | How to get it | What it shows |
|---|---|---|
| **Estimated** | SSMS: Ctrl+L, or `SET SHOWPLAN_XML ON` | What the optimizer *predicts* will happen — row counts, costs, operator choices. **No actual execution.** |
| **Actual** | SSMS: Ctrl+M then run, or `SET STATISTICS XML ON` | Everything above PLUS what *actually* happened — real row counts, real memory, spills, elapsed time. |
| **Live** | SSMS: Include Live Query Statistics | Real-time animation showing rows flowing through operators as the query runs. |

> [!tip] Always Use Actual Plans for Diagnosis
> Estimated plans can mislead when statistics are stale. The estimated cost percentages are computed from optimizer predictions — when those predictions are wrong, the cost distribution is wrong too. Always cross-reference with actual row counts.

---

## Reading the Visual Tree in SSMS

SQL Server execution plans are read **right-to-left, bottom-to-top**. The rightmost operators are the data sources (table/index scans and seeks). Data flows left through transformations (joins, sorts, aggregations) until it reaches the leftmost operator — the final `SELECT`, `INSERT`, or `UPDATE` result.

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
  │   The THICKNESS of the arrow tells you the volume of data               │
  └─────────────────────────────────────────────────────────────────────────┘
```

**Step-by-step walkthrough:**

1. **Start at the far right.** These are the data access operators — where SQL Server touches tables/indexes. Look at their type:
   - **Index Seek** (good) — B-tree navigation to specific rows, O(log n)
   - **Index Scan** (check context) — reads all leaf pages of an index
   - **Table Scan** (usually bad) — full heap scan, reads every page
   - **Key Lookup** (expensive if frequent) — bookmark lookup from NC index to [[index-types-and-strategy|clustered index]]

2. **Follow the arrows left.** Data flows through intermediate operators:
   - **Hash Match** — builds a hash table for joins or aggregations
   - **Merge Join** — merges two pre-sorted inputs (efficient if both are already sorted)
   - **Nested Loops** — for each row in outer input, seeks into inner input
   - **Sort** — sorts rows (watch for spill warnings)
   - **Filter** — applies WHERE conditions that couldn't be pushed to the seek

3. **End at the far left.** The result operator: `SELECT`, `INSERT`, `UPDATE`, or `DELETE`.

4. **Check arrow thickness.** A sudden thick-to-thin transition (or vice versa) reveals where filtering or explosion happens. A thick arrow into a Nested Loops operator with a thin inner input means many iterations — potential performance issue.

5. **Hover over each operator** for the tooltip. The critical properties are:
   - **Estimated/Actual Number of Rows** — are they close? (see Cardinality Estimation below)
   - **Estimated Operator Cost** — where is time being spent? (see Cost Analysis below)
   - **Number of Executions** — how many times was this operator invoked?
   - **Warnings** — yellow triangle icons indicate problems (spills, implicit conversions, missing indexes)

---

## Getting Plans from the Pipeline (Non-SSMS)

**Capture plans programmatically from plan cache, live XML, and Query Store:**

```sql
-- Method 1: Capture from plan cache (after the pipeline runs)
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

-- Method 2: Capture live XML plan
SET STATISTICS XML ON;
-- Run the pipeline query here
SET STATISTICS XML OFF;
-- The result set includes an XML column containing the full plan

-- Method 3: Query Store (persists plans across restarts)
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

---

## Cost Analysis — Finding the Most Expensive Operator

Every operator in the execution plan shows an **Estimated Operator Cost** as a percentage of the total query cost. This tells you where to focus optimization effort.

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

**How to interpret cost percentages:**

| Cost range | What it means | Action |
|---|---|---|
| 0-5% | Negligible | Ignore — not worth optimizing |
| 5-20% | Normal | Check only if query is slow overall |
| 20-50% | Significant | Investigate — might benefit from an index or query rewrite |
| 50-100% | Dominant | This operator is the bottleneck. Fix this first. |

**Extract operator costs from the XML plan programmatically:**

```sql
-- Extract operator costs from the XML plan programmatically
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

**Cost breakdown — IO vs CPU:**

Each operator's cost is split into I/O cost and CPU cost:
- **High IO cost** → the operator is reading many pages from disk/buffer pool. Solution: add [[index-types-and-strategy|indexes]] to reduce pages read, or add RAM for better buffer pool hit ratio.
- **High CPU cost** → the operator is doing heavy computation (sorting, hashing, string comparisons). Solution: reduce the number of rows reaching this operator, or simplify the expression.

> [!warning] Cost Percentages Are Based on Estimates
> Cost percentages are based on the optimizer's **estimates**, not actual execution. If statistics are stale, the cost distribution can be completely wrong. A scan showing "5%" might actually dominate execution time if the optimizer underestimated the row count. Always cross-reference costs with **actual row counts** and `SET STATISTICS TIME/IO` output.

**Get actual timing per query (validates total cost):**

```sql
-- Get actual timing per query (not per operator, but validates total)
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

---

## Cardinality Estimation — Detecting Bad Row Count Guesses

The **cardinality estimator** predicts how many rows each operator will process. When these predictions are wrong, the optimizer chooses bad strategies — wrong join types, insufficient memory grants, unnecessary sorts.

**The golden rule:** Compare **Estimated Number of Rows** vs. **Actual Number of Rows** for every operator in the actual execution plan. A ratio > 10x in either direction signals a problem.

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
  │                                │     │ Memory grant: tiny → SPILL     │
  └────────────────────────────────┘     └────────────────────────────────┘
```

**How to spot bad estimates in SSMS:**

1. Run the query with **Include Actual Execution Plan** (Ctrl+M)
2. Hover over each operator — the tooltip shows both Estimated and Actual rows
3. Look for **thick arrows** where you expect thin ones (or vice versa)
4. SSMS 18+ shows a **warning icon** (yellow triangle) when estimates are off by > 10x

**Find queries with the worst cardinality estimation errors (requires [[wait-stats-analysis|Query Store]] enabled):**

```sql
-- Find queries with the worst cardinality estimation errors
-- (requires Query Store enabled)
SELECT TOP 20
    qsqt.query_sql_text,
    qsp.query_plan,
    qsrs.avg_rowcount AS actual_avg_rows,
    qsrs.avg_logical_io_reads,
    qsrs.count_executions,
    qsrs.avg_duration / 1000 AS avg_ms
FROM sys.query_store_runtime_stats qsrs
JOIN sys.query_store_plan qsp ON qsrs.plan_id = qsp.plan_id
JOIN sys.query_store_query qsq ON qsp.query_id = qsq.query_id
JOIN sys.query_store_query_text qsqt ON qsq.query_text_id = qsqt.query_text_id
WHERE qsrs.avg_duration > 1000000  -- > 1 second
ORDER BY qsrs.avg_duration DESC;
-- Open each plan XML and compare EstimateRows vs ActualRows per operator
```

**Extract estimated vs actual from the XML plan directly:**

```sql
-- Extract estimated vs actual from the XML plan directly
;WITH XMLNAMESPACES (DEFAULT 'http://schemas.microsoft.com/sqlserver/2004/07/showplan')
SELECT
    node.value('@PhysicalOp', 'varchar(50)') AS operator_name,
    node.value('@EstimateRows', 'float') AS estimated_rows,
    runtime.value('@ActualRows', 'int') AS actual_rows,
    CASE
        WHEN node.value('@EstimateRows', 'float') = 0 THEN 'N/A'
        WHEN runtime.value('@ActualRows', 'int') = 0 THEN 'N/A'
        ELSE CAST(
            runtime.value('@ActualRows', 'float') /
            NULLIF(node.value('@EstimateRows', 'float'), 0)
            AS VARCHAR(20))
    END AS actual_to_estimated_ratio
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_query_plan(qs.plan_handle) qp
CROSS APPLY qp.query_plan.nodes('//RelOp') AS T(node)
OUTER APPLY node.nodes('RunTimeInformation/RunTimeCountersPerThread') AS RT(runtime)
WHERE qs.sql_handle = <your_sql_handle>
ORDER BY runtime.value('@ActualRows', 'int') DESC;
```

**Common causes of bad estimates and their fixes:**

| Symptom | Cause | Fix |
|---|---|---|
| Estimated = 1, Actual = 50,000 | Statistics not updated after bulk load | `UPDATE STATISTICS table WITH FULLSCAN` |
| Estimated = 100,000, Actual = 5 | Statistics were built when table was full, then data was deleted | `UPDATE STATISTICS` or `OPTION (RECOMPILE)` |
| Estimates wrong on joined columns | Multi-column correlation not captured by single-column statistics | Create multi-column statistics: `CREATE STATISTICS stat_idx_sym ON silver.signals_daily (_index, symbol)` |
| Estimates wrong with local variables | Optimizer can't sniff variable values (unlike parameters) | Use `OPTION (RECOMPILE)` or convert to parameterized query |
| Estimates wrong on filtered data | Statistics histogram has insufficient granularity | `UPDATE STATISTICS ... WITH FULLSCAN` or filtered statistics |
| Consistently bad on complex predicates | CE model limitation (e.g., `WHERE a = 1 OR b = 2`) | Break into UNION ALL, or use plan guides |

**Legacy vs. New Cardinality Estimator:**

SQL Server 2014+ uses a new CE model (CE 120+). SQL Server 2022 uses CE 160. If you're seeing bizarre estimates on upgraded databases:

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

---

## Wait Stats Inside Execution Plans

SQL Server 2016+ embeds **query-level wait statistics** directly into the actual execution plan XML. Instead of correlating server-wide [[wait-stats-analysis|wait stats]] with specific queries, you can see exactly what each query waited on.

**Where to find them in SSMS:**

1. Run query with **Include Actual Execution Plan** (Ctrl+M)
2. Right-click on the **root operator** (leftmost — `SELECT`, `INSERT`, etc.)
3. Click **Properties** (or press F4)
4. Expand **WaitStats** node in the Properties panel

```
  SSMS Properties panel for the root operator:

  ┌────────────────────────────────────────────┐
  │ Properties                                  │
  ├────────────────────────────────────────────┤
  │ ▸ Actual Number of Rows: 50                │
  │ ▸ Estimated Operator Cost: 0.234           │
  │ ▸ Number of Executions: 1                  │
  │                                            │
  │ ▼ WaitStats                                │
  │   ├── WaitType: PAGEIOLATCH_SH             │
  │   │   ├── WaitCount: 23                    │
  │   │   └── WaitTimeMs: 142                  │
  │   ├── WaitType: CXPACKET                   │
  │   │   ├── WaitCount: 4                     │
  │   │   └── WaitTimeMs: 38                   │
  │   └── WaitType: ASYNC_NETWORK_IO           │
  │       ├── WaitCount: 1                     │
  │       └── WaitTimeMs: 5                    │
  │                                            │
  │   Interpretation:                          │
  │   • 142ms waiting for disk I/O (pages not  │
  │     in buffer pool)                        │
  │   • 38ms parallelism coordination          │
  │   • 5ms waiting for client to consume rows │
  └────────────────────────────────────────────┘
```

**Extract wait stats from the plan XML programmatically:**

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

**Interpreting per-query wait stats:**

| Wait type in plan | Meaning | Action |
|---|---|---|
| `PAGEIOLATCH_SH` / `PAGEIOLATCH_EX` | Query waited for pages to be read from disk into buffer pool | Not enough RAM (buffer pool too small) or missing indexes causing unnecessary scans |
| `WRITELOG` | Query waited for transaction log flush to disk | Slow log disk, or too many individual COMMITs (batch them) |
| `CXPACKET` / `CXCONSUMER` | Parallelism coordination waits | Usually harmless. If excessive: check for skewed thread distribution or lower MAXDOP |
| `ASYNC_NETWORK_IO` | SQL Server produced rows faster than the client consumed them | Client (dashboard/pipeline) is slow processing results, or network latency |
| `LCK_M_S` / `LCK_M_X` | Query was blocked by another session's lock | Contention — check for long-running transactions, consider [[merge-and-upsert|RCSI]] |
| `MEMORY_GRANT_QUEUE` | Query waited in the memory grant queue before it could start | Too many concurrent queries requesting sort/hash memory — reduce parallelism or add RAM |
| `SOS_SCHEDULER_YIELD` | CPU was overloaded, query had to yield its time slice | CPU pressure — optimize the query or add vCPUs |

**Correlation with server-wide wait stats:**

Per-query waits tell you "this specific query waited on X." Server-wide waits (from `sys.dm_os_wait_stats`) tell you "the entire workload is bottlenecked on X." Use both:

1. Check server-wide [[wait-stats-analysis|wait stats]] → identify the category (I/O? locks? CPU?)
2. Find the specific queries contributing → per-query wait stats in execution plans
3. Fix the worst offenders

---

## Critical Plan Operators for Batch Workloads

| Operator | Expected in Pipeline | Red Flag |
|----------|---------------------|----------|
| **Clustered Index Insert** | Normal for bulk INSERT | — |
| **Clustered Index Scan** | Expected for full-table MERGE source | Red flag if appearing in WHERE-filtered queries |
| **Table Scan** | Never acceptable on silver/gold tables | Add clustered index |
| **Hash Match (Inner Join)** | Normal for large MERGE joins | Check memory grant — spills to TempDB are costly |
| **Sort** | Often needed for MERGE | Watch for sort spills (yellow warning in plan) |
| **Nested Loops** | Good for small lookups | Red flag if outer input is large (> 1000 rows) |
| **Key Lookup** | Covering index missing columns | Add INCLUDE columns to index |
| **Parallelism (Gather Streams)** | Normal for large operations | Check for skewed thread distribution |

---

## Implicit Conversions — The Silent Performance Killer

The most common silent performance killer in Python-to-SQL pipelines. Python's pyodbc sends parameters as `NVARCHAR` by default, but SQL columns may be `VARCHAR`. This forces a per-row conversion and prevents [[sargable-queries|index seeks]].

**Detect implicit conversions:**

```sql
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
;WITH XMLNAMESPACES (DEFAULT 'http://schemas.microsoft.com/sqlserver/2004/07/showplan')
SELECT TOP 20
    st.text AS query_text,
    qp.query_plan,
    qs.execution_count,
    qs.total_logical_reads / qs.execution_count AS avg_reads
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_query_plan(qs.plan_handle) qp
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
WHERE qp.query_plan.exist('//Warnings/PlanAffectingConvert') = 1
ORDER BY qs.total_logical_reads DESC;
```

**Fix in Python — force pyodbc to send VARCHAR instead of NVARCHAR:**

```python
# In your pipeline connection setup
conn.setdecoding(pyodbc.SQL_CHAR, encoding='utf-8')
conn.setdecoding(pyodbc.SQL_WCHAR, encoding='utf-8')
conn.setencoding(encoding='utf-8')

# Or per-cursor: use fast_executemany with explicit types
cursor.fast_executemany = True
cursor.executemany("INSERT INTO ...", rows)
```

> [!info] Full SARGability Reference
> For the complete list of SARGable vs. non-SARGable patterns, the detection query, and the data pipeline quick-reference table, see [[sargable-queries]].

---

## Parameter Sniffing

Parameter sniffing is less common in pipelines (queries use literal values, not stored procedures), but it affects parameterized queries from pyodbc.

**Detect high plan variance (sign of parameter sniffing):**

```sql
-- Check if auto-parameterization is causing issues
SELECT
    qs.execution_count,
    qs.total_worker_time / qs.execution_count / 1000 AS avg_cpu_ms,
    qs.min_worker_time / 1000 AS min_cpu_ms,
    qs.max_worker_time / 1000 AS max_cpu_ms,
    CAST((qs.max_worker_time - qs.min_worker_time) * 1.0 /
         NULLIF(qs.min_worker_time, 0) AS DECIMAL(10,1)) AS variance_ratio,
    SUBSTRING(st.text, 1, 200) AS query_text
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
WHERE qs.execution_count > 10
  AND qs.max_worker_time > qs.min_worker_time * 10
ORDER BY variance_ratio DESC;
```

**Mitigations:**

```sql
-- Option 1: OPTIMIZE FOR UNKNOWN for variable queries
SELECT * FROM silver.signals_daily
WHERE _index = @index AND signal_date >= @from
OPTION (OPTIMIZE FOR UNKNOWN);

-- Option 2: RECOMPILE for infrequent but variable queries
SELECT * FROM gold.scores_daily
WHERE [index] = @idx
OPTION (RECOMPILE);
```

> [!tip] When to Use RECOMPILE
> Use `OPTION (RECOMPILE)` sparingly — only on queries that run a few times per pipeline (not thousands of times in a loop). Recompilation has CPU overhead.

---

## Batch Mode Execution

SQL Server 2022 supports **batch mode on rowstore** (no columnstore index required). This dramatically accelerates analytical queries (groupby, window functions).

**Check if your queries are using batch mode:**

```sql
-- Check if your queries are using batch mode
SELECT
    qs.execution_count,
    qs.total_worker_time / 1000 AS total_cpu_ms,
    SUBSTRING(st.text, 1, 200) AS query_text,
    qp.query_plan
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
CROSS APPLY sys.dm_exec_query_plan(qs.plan_handle) qp
WHERE st.text LIKE '%gold.%'
ORDER BY qs.total_worker_time DESC;
-- In the XML plan, look for ActualExecutionMode="Batch" vs "Row"
```

**Force batch mode if the optimizer doesn't choose it:**

```sql
-- Compatibility level must be 150+ (SQL 2019+)
ALTER DATABASE analytics_db SET COMPATIBILITY_LEVEL = 160;  -- SQL 2022

-- Hint to encourage batch mode
SELECT [index], score_date,
    AVG(momentum_score) OVER (PARTITION BY [index]) AS avg_momentum
FROM gold.scores_daily
WHERE score_date = @date
OPTION (USE HINT('ENABLE_BATCH_MODE_ON_ROWSTORE'));
```

---

## Missing Indexes for Pipeline Queries

SQL Server surfaces missing index recommendations directly in the execution plan (yellow warning icon) and stores them in DMVs. Typical clustered indexes needed for a bronze→silver→gold MERGE pipeline:

```sql
-- Silver signal tables: MERGE joins on (_index, symbol, signal_date)
CREATE UNIQUE CLUSTERED INDEX CIX_signals_daily
ON silver.signals_daily (_index, symbol, signal_date);

-- Silver OHLCV tables: MERGE on (symbol, date)
CREATE UNIQUE CLUSTERED INDEX CIX_ohlcv
ON silver.ohlcv_market_index (symbol, date);

-- Gold scores: dashboard reads by (index, score_date) with ORDER BY rank
CREATE UNIQUE CLUSTERED INDEX CIX_scores_daily
ON gold.scores_daily ([index], score_date, symbol);

-- Index performance: dashboard reads by (index, perf_date)
CREATE UNIQUE CLUSTERED INDEX CIX_index_performance
ON gold.index_performance ([index], perf_date);

-- Pulse tables: read by (_index) with ORDER BY activity_score
CREATE NONCLUSTERED INDEX IX_pulse_tickers_index
ON bronze.pulse_tickers (_index) INCLUDE (symbol, rank, activity_score, volume_surge);
```

> [!info] Missing Index DMVs
> For the systematic missing index detection query using `sys.dm_db_missing_index_details`, see [[index-types-and-strategy#Missing Index DMV Queries]].

---

## Quick Wins for Query Performance (Ordered by Impact)

| Optimization | Effort | Impact | When to Apply |
|-------------|--------|--------|---------------|
| Clustered indexes on all tables | Low | High | Immediately if any heaps exist |
| `OPTION (RECOMPILE)` on pipeline queries | Low | Medium | If you see parameter sniffing issues |
| Enable RCSI | Low | High | Immediately — eliminates reader/writer blocking |
| Covering indexes | Medium | Medium | When dashboard queries show Key Lookups |
| Page compression on gold tables | Medium | Medium | When buffer pool starts filling up |
| Statistics update after loads | Low | High | Add to pipeline post-load step |

**Check for heap tables (no clustered index — full scan on every query):**

```sql
-- Check for heap tables (no clustered index)
SELECT
    SCHEMA_NAME(t.schema_id) + '.' + t.name AS table_name,
    p.rows
FROM sys.tables t
JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id = 0
WHERE p.rows > 0
ORDER BY p.rows DESC;
```

**Enable RCSI to eliminate reader/writer blocking:**

```sql
-- Check current setting
SELECT name, is_read_committed_snapshot_on
FROM sys.databases WHERE name = 'analytics_db';

-- Enable RCSI (requires exclusive access — no other connections)
ALTER DATABASE analytics_db SET READ_COMMITTED_SNAPSHOT ON;
```

After enabling, `SELECT` queries no longer take shared locks, so they never block `INSERT`/`UPDATE`/`DELETE` and vice versa.

**Check compression savings before applying:**

```sql
-- Check current compression and potential savings
EXEC sp_estimate_data_compression_savings
    @schema_name = 'gold',
    @object_name = 'index_performance',
    @index_id = NULL,
    @partition_number = NULL,
    @data_compression = 'PAGE';

-- Apply page compression
ALTER INDEX CIX_index_performance ON gold.index_performance
REBUILD WITH (DATA_COMPRESSION = PAGE);
```

Page compression typically saves 60-80% space on time-series financial data, meaning more data fits in the buffer pool without increasing RAM.

**Keep statistics fresh after bulk loads:**

```sql
EXEC sp_updatestats;

-- Or target specific tables after bulk load
UPDATE STATISTICS gold.scores_daily WITH FULLSCAN, PERSIST_SAMPLE_PERCENT = ON;
UPDATE STATISTICS gold.index_performance WITH FULLSCAN, PERSIST_SAMPLE_PERCENT = ON;
```

---

## Related

- [[sargable-queries]] — predicate patterns that enable vs. prevent index seeks
- [[wait-stats-analysis]] — server-wide wait stats to correlate with per-query plan waits
- [[index-types-and-strategy]] — index types, missing index DMVs, and covering index strategy
- [[storage-internals]] — buffer pool, B-tree mechanics that explain what plans show
- [[performance-audit-playbook]] — structured audit using execution plans as the primary tool
