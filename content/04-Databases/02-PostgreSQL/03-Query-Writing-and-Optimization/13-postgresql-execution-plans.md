---
title: "13 - Execution Plans"
tags:
  - postgresql
  - query-optimization
  - sql
aliases:
  - PostgreSQL query plans
  - PostgreSQL EXPLAIN
  - PostgreSQL EXPLAIN ANALYZE
description: "PostgreSQL reference for estimated versus actual plans, reading plan trees, JSON plan capture, cost and buffer interpretation, sort spills, row-estimate drift, and modern planner nodes such as Memoize and parallel query."
parent: "[[domain-postgresql-query-writing-and-optimization]]"
links:
  - "[[12-postgresql-sargable-queries]]"
  - "[[14-postgresql-wait-events-and-session-analysis]]"
status: complete
---

# Execution Plans

Execution plans are PostgreSQL's ground-truth explanation of how a query will run or actually ran. The names differ from SQL Server, and PostgreSQL does not have a built-in Query Store equivalent in core, but the tuning workflow is the same: capture the plan, compare estimates to reality, find the operators doing the work, and only then change indexes, SQL shape, or configuration.

> [!abstract] Scope
>
> This note mirrors the SQL Server execution-plan track with PostgreSQL plan surfaces and PostgreSQL terminology. It covers `EXPLAIN` versus `EXPLAIN ANALYZE`, tree reading, JSON plan capture, cost and buffer interpretation, spills, row-estimate drift, and PostgreSQL-specific nodes such as `Memoize`, `Gather`, and `Parallel Append`.
>
> - **Plan capture** covers estimated and actual plans plus the key `EXPLAIN` options worth using in day-to-day work.
> - **Tree reading** covers how to read plan nodes bottom-up and how to spot the operator that is actually doing the work.
> - **Core diagnostics** covers costs, buffers, external sort spills, and estimate-versus-actual row gaps.
> - **PostgreSQL-specific behavior** covers programmatic JSON plans, the absence of per-plan wait breakdowns, and modern nodes such as `Memoize` and parallel workers.

## Reproducible Setup

Before reading plans, confirm the runtime features that affect what PostgreSQL can show. This lab is running PostgreSQL 16, JIT is enabled, I/O timing is currently off, and the default gather limit allows up to two parallel workers.

```sql
SELECT
    current_setting('server_version') AS server_version,
    current_setting('jit') AS jit,
    current_setting('track_io_timing') AS track_io_timing,
    current_setting('max_parallel_workers_per_gather') AS max_parallel_workers_per_gather;
```

| server_version | jit | track_io_timing | max_parallel_workers_per_gather |
|---|---|---|---:|
| 16.13 (Debian 16.13-1.pgdg13+1) | on | off | 2 |

> [!info] What PostgreSQL plans do and do not include
>
> `EXPLAIN` and `EXPLAIN ANALYZE` are the main plan surfaces in core PostgreSQL. PostgreSQL does not embed per-query wait events inside the plan the way SQL Server can expose wait information in plan properties, and core PostgreSQL does not persist a historical plan store like Query Store. Use plans for access paths, row counts, memory behavior, and node timing. Use [[14-postgresql-wait-events-and-session-analysis]] and [[16-postgresql-blocking-and-locking]] for wait and blocking evidence.

## Estimated vs. Actual Plans

The baseline distinction is simple:

- `EXPLAIN` shows what the planner expects to do.
- `EXPLAIN ANALYZE` runs the query and appends runtime truth.

The example below uses a transaction-scoped temp table with a real `(symbol, price_date)` index so the same query can be shown in both forms.

```sql
BEGIN;

CREATE TEMP TABLE note13_price_demo AS
SELECT
    symbol::text AS symbol,
    date AS price_date,
    close,
    volume,
    src
FROM (
    SELECT symbol, date, close, volume, 'euro_stoxx_50'::text AS src
    FROM silver.eurostoxx50_ohlcv
    UNION ALL
    SELECT symbol, date, close, volume, 'stoxx_usa_50'::text AS src
    FROM silver.stoxxusa50_ohlcv
    UNION ALL
    SELECT symbol, date, close, volume, 'stoxx_asia_50'::text AS src
    FROM silver.stoxxasia50_ohlcv
    UNION ALL
    SELECT symbol, date, close, volume, 'oil_20'::text AS src
    FROM silver.oil20_ohlcv
) s;

CREATE INDEX note13_price_demo_symbol_date_idx
    ON note13_price_demo (symbol, price_date);

ANALYZE note13_price_demo;

SELECT COUNT(*) AS total_rows
FROM note13_price_demo;
```

| total_rows |
|---:|
| 223110 |

### Use `EXPLAIN` when you need plan shape without executing the query

```sql
EXPLAIN
SELECT close
FROM note13_price_demo
WHERE symbol = 'AAPL'
  AND price_date = DATE '2026-04-07';
```

```text
Index Scan using note13_price_demo_symbol_date_idx on note13_price_demo  (cost=0.42..8.44 rows=1 width=8)
  Index Cond: ((symbol = 'AAPL'::text) AND (price_date = '2026-04-07'::date))
```

This plan tells you the chosen path, the estimated row count, and the relative cost range. It does not tell you whether the estimate was right.

### Use `EXPLAIN ANALYZE` when runtime truth matters

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT close
FROM note13_price_demo
WHERE symbol = 'AAPL'
  AND price_date = DATE '2026-04-07';
```

```text
Index Scan using note13_price_demo_symbol_date_idx on pg_temp.note13_price_demo  (cost=0.42..8.44 rows=1 width=8) (actual time=0.019..0.020 rows=1 loops=1)
  Output: close
  Index Cond: ((note13_price_demo.symbol = 'AAPL'::text) AND (note13_price_demo.price_date = '2026-04-07'::date))
  Buffers: local hit=1 read=3
Planning Time: 0.043 ms
Execution Time: 0.031 ms
```

The same plan shape now carries runtime information: actual rows, loop count, buffer hits and reads, and separate planning versus execution time. This is why `EXPLAIN ANALYZE` is the default diagnostic surface for slow SQL in PostgreSQL.

> [!warning] Estimated cost is relative, not absolute
>
> PostgreSQL cost units are internal planner units, not milliseconds. They are useful for comparing competing plans, not for predicting wall-clock runtime.

## Reading the Plan Tree

Read PostgreSQL plans from the leaves toward the root. The lowest nodes produce rows, middle nodes reshape or join them, and the root node returns the final result. The next example shows several important plan nodes in one small query: `Seq Scan`, `Nested Loop`, `Memoize`, `Sort`, and `Limit`.

```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT s._index, s.symbol, p.close
FROM gold.scores_daily AS s
JOIN note13_price_demo AS p
  ON p.symbol = s.symbol
 AND p.price_date = s.score_date - 1
WHERE s.score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
  AND s._index IN ('euro_stoxx_50', 'stoxx_usa_50')
ORDER BY s._index, s.composite_rank
LIMIT 10;
```

```text
Limit (actual time=0.422..0.424 rows=10 loops=1)
  Buffers: shared hit=99, local hit=299 read=103
  InitPlan 1 (returns $0)
    ->  Aggregate (actual time=0.072..0.072 rows=1 loops=1)
          Buffers: shared hit=48
          ->  Seq Scan on scores_daily (actual time=0.000..0.047 rows=635 loops=1)
                Buffers: shared hit=48
  ->  Sort (actual time=0.422..0.422 rows=10 loops=1)
        Sort Key: s._index, s.composite_rank
        Sort Method: top-N heapsort  Memory: 26kB
        Buffers: shared hit=99, local hit=299 read=103
        ->  Nested Loop (actual time=0.111..0.402 rows=102 loops=1)
              Buffers: shared hit=96, local hit=299 read=103
              ->  Seq Scan on scores_daily s (actual time=0.102..0.117 rows=100 loops=1)
                    Filter: (((_index)::text = ANY ('{euro_stoxx_50,stoxx_usa_50}'::text[])) AND (score_date = $0))
                    Rows Removed by Filter: 535
                    Buffers: shared hit=96
              ->  Memoize (actual time=0.002..0.003 rows=1 loops=100)
                    Cache Key: s.symbol, (s.score_date - 1)
                    Cache Mode: logical
                    Hits: 0  Misses: 100  Evictions: 0  Overflows: 0  Memory Usage: 13kB
                    Buffers: local hit=299 read=103
                    ->  Index Scan using note13_price_demo_symbol_date_idx on note13_price_demo p (actual time=0.002..0.002 rows=1 loops=100)
                          Index Cond: ((symbol = (s.symbol)::text) AND (price_date = (s.score_date - 1)))
                          Buffers: local hit=299 read=103
Planning:
  Buffers: shared hit=148, local hit=3 read=6
Planning Time: 0.300 ms
Execution Time: 0.449 ms
```

Read this tree in order:

- The `InitPlan` computes the latest `score_date` once.
- The outer `Seq Scan` on `scores_daily` finds the 100 latest Euro and USA rows.
- The inner `Index Scan` probes `note13_price_demo` for each outer row.
- `Memoize` caches repeated lookup keys so repeated probes can be avoided when keys recur.
- `Sort` applies the final ordering, and `Limit` returns only the first 10 rows.

## Getting Plans Programmatically

The visual tree is convenient, but structured output is better for repeatable analysis. PostgreSQL's easiest machine-readable surface is `EXPLAIN (FORMAT JSON)`.

```sql
EXPLAIN (FORMAT JSON)
SELECT close
FROM note13_price_demo
WHERE symbol = 'AAPL'
  AND price_date = DATE '2026-04-07';
```

```text
[
  {
    "Plan": {
      "Node Type": "Index Scan",
      "Parallel Aware": false,
      "Async Capable": false,
      "Scan Direction": "Forward",
      "Index Name": "note13_price_demo_symbol_date_idx",
      "Relation Name": "note13_price_demo",
      "Alias": "note13_price_demo",
      "Startup Cost": 0.42,
      "Total Cost": 8.44,
      "Plan Rows": 1,
      "Plan Width": 8,
      "Index Cond": "((symbol = 'AAPL'::text) AND (price_date = '2026-04-07'::date))"
    }
  }
]
```

This is the right format when plans need to be stored, diffed, or inspected by tooling. JSON is also the cleanest way to automate plan linting without scraping human-readable text.

## Costs, Buffers, and Spill Signals

The next step after plan shape is resource interpretation. PostgreSQL plans can show memory behavior, shared or local buffer activity, and temp-file usage when an operator spills.

### A forced low `work_mem` makes an external sort obvious

```sql
SET LOCAL work_mem = '64kB';

EXPLAIN (ANALYZE, BUFFERS, SETTINGS)
SELECT symbol, price_date, close
FROM note13_price_demo
ORDER BY close DESC;
```

```text
Sort  (cost=37833.52..38391.29 rows=223110 width=17) (actual time=63.955..73.166 rows=223110 loops=1)
  Sort Key: close DESC
  Sort Method: external merge  Disk: 6976kB
  Buffers: local read=2048, temp read=3477 written=3725
  ->  Seq Scan on note13_price_demo  (cost=0.00..4279.10 rows=223110 width=17) (actual time=0.010..11.178 rows=223110 loops=1)
        Buffers: local read=2048
Settings: work_mem = '64kB'
Planning:
  Buffers: shared hit=10
Planning Time: 0.029 ms
Execution Time: 78.463 ms
```

Three lines matter most here:

- `Sort Method: external merge` proves the sort spilled to disk.
- `Disk: 6976kB` shows the temp-file footprint of the spill.
- `temp read` and `temp written` in `Buffers` confirm extra I/O outside the base table scan.

When sorts or hashes spill, look first at row count, sort width, and `work_mem` assumptions before reaching for more exotic fixes.

## Cardinality Estimation and Statistics Drift

Most bad plans are downstream effects of wrong row-count expectations. PostgreSQL puts the estimate and the actual row count on the same line, which makes estimate drift easy to spot.

### Stale statistics create bad row-count guesses

This demo analyzes a temp table, inserts a large skewed batch for `AAPL`, and then queries before refreshing stats.

```sql
CREATE TEMP TABLE note13_skew_demo AS
SELECT symbol::text AS symbol, close
FROM silver.stoxxusa50_ohlcv
WHERE date >= DATE '2026-01-01';

CREATE INDEX note13_skew_demo_symbol_idx
    ON note13_skew_demo (symbol);

ANALYZE note13_skew_demo;

INSERT INTO note13_skew_demo (symbol, close)
SELECT 'AAPL', close
FROM silver.stoxxusa50_ohlcv
CROSS JOIN generate_series(1, 50)
WHERE symbol = 'AAPL'
  AND date >= DATE '2026-01-01';

EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*)
FROM note13_skew_demo
WHERE symbol = 'AAPL';
```

```text
Aggregate  (cost=55.56..55.57 rows=1 width=8) (actual time=0.240..0.240 rows=1 loops=1)
  Buffers: local hit=26
  ->  Bitmap Heap Scan on note13_skew_demo  (cost=5.06..55.31 rows=100 width=0) (actual time=0.028..0.159 rows=3315 loops=1)
        Recheck Cond: (symbol = 'AAPL'::text)
        Heap Blocks: exact=22
        Buffers: local hit=26
        ->  Bitmap Index Scan on note13_skew_demo_symbol_idx  (cost=0.00..5.03 rows=100 width=0) (actual time=0.024..0.024 rows=3315 loops=1)
              Index Cond: (symbol = 'AAPL'::text)
              Buffers: local hit=4
Planning:
  Buffers: shared hit=8
Planning Time: 0.055 ms
Execution Time: 0.252 ms
```

The critical mismatch is `rows=100` estimated versus `rows=3315` actual on the bitmap nodes. That 33x gap is enough to contaminate join, sort, and memory decisions in larger queries.

### Refreshing stats can change both the estimate and the chosen plan

```sql
ANALYZE note13_skew_demo;

EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*)
FROM note13_skew_demo
WHERE symbol = 'AAPL';
```

```text
ANALYZE
Aggregate  (cost=138.54..138.55 rows=1 width=8) (actual time=0.310..0.310 rows=1 loops=1)
  Buffers: local hit=49
  ->  Seq Scan on note13_skew_demo  (cost=0.00..130.25 rows=3315 width=0) (actual time=0.003..0.230 rows=3315 loops=1)
        Filter: (symbol = 'AAPL'::text)
        Rows Removed by Filter: 3185
        Buffers: local hit=49
Planning:
  Buffers: shared hit=7, local hit=1
Planning Time: 0.051 ms
Execution Time: 0.319 ms
```

After `ANALYZE`, the estimate matches reality and PostgreSQL decides a `Seq Scan` is now cheaper than an index-driven bitmap path. This is the deeper lesson: good statistics do not merely validate a plan. They can produce a different and better plan.

## Modern PostgreSQL Plan Features

Recent PostgreSQL versions add plan nodes and execution strategies that did not exist in older mental models. `Memoize` already appeared earlier in this note. Parallel query is another high-value feature worth recognizing immediately when reading plans.

```sql
SET LOCAL max_parallel_workers_per_gather = 2;
SET LOCAL min_parallel_table_scan_size = 0;
SET LOCAL parallel_setup_cost = 0;
SET LOCAL parallel_tuple_cost = 0;

EXPLAIN (ANALYZE, BUFFERS, SETTINGS)
SELECT avg(close)
FROM (
    SELECT close FROM silver.eurostoxx50_ohlcv
    UNION ALL
    SELECT close FROM silver.stoxxusa50_ohlcv
    UNION ALL
    SELECT close FROM silver.stoxxasia50_ohlcv
    UNION ALL
    SELECT close FROM silver.oil20_ohlcv
) AS q;
```

```text
Finalize Aggregate  (cost=4930.86..4930.87 rows=1 width=8) (actual time=12.183..13.482 rows=1 loops=1)
  Buffers: shared hit=3304
  ->  Gather  (cost=4930.84..4930.85 rows=2 width=32) (actual time=12.096..13.476 rows=3 loops=1)
        Workers Planned: 2
        Workers Launched: 2
        Buffers: shared hit=3304
        ->  Partial Aggregate  (cost=4930.84..4930.85 rows=1 width=32) (actual time=10.028..10.029 rows=1 loops=3)
              Buffers: shared hit=3304
              ->  Parallel Append  (cost=0.00..4698.44 rows=92962 width=8) (actual time=0.004..7.393 rows=74370 loops=3)
                    Buffers: shared hit=3304
                    ->  Parallel Seq Scan on eurostoxx50_ohlcv  (cost=0.00..1279.81 rows=27981 width=8) (actual time=0.003..3.761 rows=67155 loops=1)
                          Buffers: shared hit=1000
                    ->  Parallel Seq Scan on stoxxusa50_ohlcv  (cost=0.00..1275.00 rows=27500 width=8) (actual time=0.005..4.035 rows=66000 loops=1)
                          Buffers: shared hit=1000
                    ->  Parallel Seq Scan on stoxxasia50_ohlcv  (cost=0.00..1206.31 rows=27031 width=8) (actual time=0.003..1.288 rows=21625 loops=3)
                          Buffers: shared hit=936
                    ->  Parallel Seq Scan on oil20_ohlcv  (cost=0.00..472.50 rows=10450 width=8) (actual time=0.003..1.691 rows=25080 loops=1)
                          Buffers: shared hit=368
Settings: min_parallel_table_scan_size = '0', parallel_setup_cost = '0', parallel_tuple_cost = '0'
Planning:
  Buffers: shared hit=120
Planning Time: 0.250 ms
Execution Time: 13.563 ms
```

Recognize this pattern quickly:

- `Gather` means the leader is collecting rows from worker processes.
- `Partial Aggregate` means workers are doing local aggregation before the final combine step.
- `Parallel Append` means PostgreSQL is distributing branches of a union-like workload across workers.

These nodes are not edge cases anymore. They are normal parts of PostgreSQL 16 plan reading.

## Operator Reference for Pipeline Workloads

| Node family | Normal meaning | Watch for |
|---|---|---|
| `Seq Scan` | Reads the table in physical row order. | Fine for small tables or broad predicates; red flag when a selective predicate should have become an `Index Cond`. |
| `Index Scan` / `Index Only Scan` | Uses B-tree order directly. | Check estimated versus actual rows and whether heap fetches or visibility checks are eroding the win. |
| `Bitmap Index Scan` + `Bitmap Heap Scan` | Collects qualifying TIDs first, then visits heap pages. | Normal for medium-sized result sets; watch for poor selectivity or many heap rechecks. |
| `Nested Loop` | Repeats inner work for each outer row. | Excellent with a selective indexed inner path; dangerous when the outer side is much larger than expected. |
| `Hash Join` | Builds a hash table on one side and probes from the other. | Watch memory use and batch counts if the build side is larger than expected. |
| `Sort` / `Incremental Sort` | Produces required ordering. | Check `Sort Method`, memory, and temp-file usage for spill evidence. |
| `Aggregate` / `HashAggregate` / `GroupAggregate` | Collapses rows to grouped results. | Watch whether input cardinality or sort requirements are exploding upstream cost. |
| `Memoize` | Caches repeated parameterized inner lookups. | Helpful in nested loops with repeated keys; low hit rate can mean the node adds little value. |
| `Gather` / `Gather Merge` / `Parallel Append` | Parallel execution across worker processes. | Check worker counts and whether the workload is large enough to justify the overhead. |

## Review Checklist and Cleanup

Use this sequence when a PostgreSQL query is slow:

1. Capture `EXPLAIN (ANALYZE, BUFFERS)` for the exact statement.
2. Compare estimated rows and actual rows at the nodes doing the most work.
3. Check whether the predicate landed in `Index Cond` or only in `Filter`.
4. Look for spill signals such as `external merge`, temp buffers, or unexpectedly large hash inputs.
5. Confirm whether the chosen join type still makes sense given the actual row counts.
6. Only then change SQL shape, indexes, statistics, or session settings.

Close the temp-table session cleanly when the note's walkthrough is complete:

```sql
RESET work_mem;
RESET max_parallel_workers_per_gather;
RESET min_parallel_table_scan_size;
RESET parallel_setup_cost;
RESET parallel_tuple_cost;
ROLLBACK;
```
