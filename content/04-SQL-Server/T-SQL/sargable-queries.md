---
type: concept
category: sql-server
technology: [sql-server]
tags: [sql]
aliases: [SARGable, search argument, index seek, non-sargable, predicate]
keywords: [SARGable, search argument, index seek, index scan, predicate, WHERE clause, YEAR function, CAST, CONVERT, LEFT, LIKE, functions on columns, implicit conversion, computed column, query optimization, execution plan, scan vs seek]
description: "SARGable query patterns that enable SQL Server index seeks vs non-SARGable patterns that force full scans. Includes a complete reference table and fix strategies."
related: [index-types-and-strategy, execution-plans, wait-stats-analysis, performance-audit-playbook]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# SARGable Queries

**SARGable** = **S**earch **ARG**ument**able**. A predicate is SARGable if SQL Server can use an index seek to evaluate it. Non-SARGable predicates force SQL Server to scan every row and evaluate the expression per-row — often 10-100x more I/O for the same result.

**The fundamental rule:** Do not apply functions or calculations to the **column** side of a WHERE clause. Apply them to the **value** side instead.

---

## SARGable vs Non-SARGable Patterns

```sql
-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  NON-SARGABLE (BAD)              SARGABLE (GOOD)               ║
-- ╠══════════════════════════════════════════════════════════════════╣
-- ║                                                                  ║
-- ║  Functions on columns:                                           ║
-- ║                                                                  ║
-- ║  WHERE YEAR(trade_date) = 2025    WHERE trade_date >= '2025-01-01║
-- ║                                     AND trade_date < '2026-01-01║
-- ║                                                                  ║
-- ║  WHERE CONVERT(DATE, created)     WHERE created >= '2025-03-10'  ║
-- ║        = '2025-03-10'               AND created < '2025-03-11'  ║
-- ║                                                                  ║
-- ║  WHERE LEFT(symbol, 2) = 'AS'     WHERE symbol LIKE 'AS%'       ║
-- ║                                                                  ║
-- ║  WHERE UPPER(sector) = 'TECH'     WHERE sector = 'TECH'         ║
-- ║  (if using case-insensitive          (CI collation matches       ║
-- ║   collation, UPPER is redundant)      regardless of case)        ║
-- ║                                                                  ║
-- ║  Calculations on columns:                                        ║
-- ║                                                                  ║
-- ║  WHERE price * quantity > 1000    WHERE price > 1000 / quantity  ║
-- ║                                   (or use a computed column)     ║
-- ║                                                                  ║
-- ║  WHERE score + 10 > 50            WHERE score > 40               ║
-- ║                                                                  ║
-- ║  WHERE DATEDIFF(DAY,              WHERE trade_date >=            ║
-- ║    trade_date, GETDATE()) < 30      DATEADD(DAY, -30, GETDATE())║
-- ║                                                                  ║
-- ║  Implicit conversions:                                           ║
-- ║                                                                  ║
-- ║  WHERE varchar_col = N'text'      WHERE varchar_col = 'text'     ║
-- ║  (nvarchar vs varchar mismatch)   (matching types)               ║
-- ║                                                                  ║
-- ║  LIKE with leading wildcard:                                     ║
-- ║                                                                  ║
-- ║  WHERE symbol LIKE '%ML'          WHERE symbol LIKE 'AS%'       ║
-- ║  (can't seek — must scan)         (seekable — known prefix)     ║
-- ║                                                                  ║
-- ╚══════════════════════════════════════════════════════════════════╝
```

---

## Why Non-SARGable Predicates Are Slow

The page-level view of what happens:

```
SARGable: WHERE trade_date >= '2025-01-01' AND trade_date < '2026-01-01'

  B-tree on trade_date:
  Root → Intermediate → Leaf page for '2025-01-01'
  Then scan forward through linked leaf pages until '2026-01-01'

  Pages read: ~50 (only 2025 data)
  ────────────────────────────────────────────

Non-SARGable: WHERE YEAR(trade_date) = 2025

  SQL Server CANNOT navigate the B-tree (YEAR() is not a key value)
  Instead: read EVERY leaf page, compute YEAR() on every row, filter

  Pages read: ~5,000 (entire table)
  100x more I/O for the same result
```

---

## The Golden Rule Table

| Never do this | Do this instead |
|---|---|
| `WHERE YEAR(date) = 2025` | `WHERE date >= '2025-01-01' AND date < '2026-01-01'` |
| `WHERE CAST(date AS DATE) = @d` | `WHERE date >= @d AND date < DATEADD(DAY, 1, @d)` |
| `WHERE ISNULL(col, 'x') = @v` | `WHERE col = @v OR (col IS NULL AND @v = 'x')` |
| `WHERE LEFT(symbol, 2) = 'AS'` | `WHERE symbol LIKE 'AS%'` |

---

## Detecting Non-SARGable Predicates in Execution Plans

The telltale sign is an **Index Scan** (or **Clustered Index Scan**) with a **Predicate** property (not a **Seek Predicate**). In SSMS:

1. Hover over a Scan operator
2. Check the tooltip:
   - **Seek Predicate** = SARGable (index used to navigate)
   - **Predicate** = non-SARGable filter applied AFTER reading all rows

#### sys.dm_exec_query_plan XML — find non-SARGable predicates in cached plans

```sql
-- Find non-SARGable predicates in cached plans (look for scans with predicates)
;WITH XMLNAMESPACES (DEFAULT 'http://schemas.microsoft.com/sqlserver/2004/07/showplan')
SELECT TOP 20
    SUBSTRING(st.text, 1, 300) AS query_text,
    node.value('@PhysicalOp', 'varchar(50)') AS operator,
    node.value('(IndexScan/Predicate/ScalarOperator/@ScalarString)[1]', 'varchar(500)') AS filter_predicate,
    node.value('(IndexScan/SeekPredicates/SeekPredicateNew/SeekKeys/Prefix/RangeColumns/ColumnReference/@Column)[1]',
               'varchar(100)') AS seek_column,
    qs.total_logical_reads / qs.execution_count AS avg_reads,
    qs.execution_count
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_query_plan(qs.plan_handle) qp
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
CROSS APPLY qp.query_plan.nodes('//RelOp') AS T(node)
WHERE node.value('@PhysicalOp', 'varchar(50)') LIKE '%Scan%'
  AND node.exist('IndexScan/Predicate') = 1
ORDER BY qs.total_logical_reads DESC;
```

---

## Fixing Non-SARGable Predicates When You Can't Change the Query

If you cannot modify the query (e.g., it comes from a third-party tool), there are two workarounds:

**Option 1: Computed column + index**

```sql
-- Option 1: Computed column + index
ALTER TABLE silver.ohlcv_market_index
ADD trade_year AS YEAR(date) PERSISTED;

CREATE NONCLUSTERED INDEX IX_ohlcv_year
ON silver.ohlcv_market_index (trade_year);

-- Now WHERE trade_year = 2025 uses an index seek
```

**Option 2: Filtered index (if the predicate is always the same value)**

```sql
-- Option 2: Filtered index (if the predicate is always the same value)
CREATE NONCLUSTERED INDEX IX_signals_2025
ON silver.signals_daily (symbol, signal_date)
WHERE YEAR(signal_date) = 2025;
-- Only works when the query uses the exact same predicate expression
```

---

## Implicit Conversions — The Silent Killer

The most common silent performance killer in Python-to-SQL pipelines. Python's `pyodbc` sends parameters as `NVARCHAR` by default, but SQL columns may be `VARCHAR`. This forces a per-row conversion and prevents index seeks.

#### PlanAffectingConvert XML query — detect implicit conversions

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

#### pyodbc setencoding — fix implicit NVARCHAR→VARCHAR conversion

```python
# In your pipeline connection setup
conn.setdecoding(pyodbc.SQL_CHAR, encoding='utf-8')
conn.setdecoding(pyodbc.SQL_WCHAR, encoding='utf-8')
conn.setencoding(encoding='utf-8')

# Or per-cursor: use fast_executemany with explicit types
cursor.fast_executemany = True
cursor.executemany("INSERT INTO ...", rows)
```

---

## SARGability Quick Reference for the Pipeline

| Common pipeline pattern | SARGable? | Fix |
|---|---|---|
| `WHERE trade_date BETWEEN @start AND @end` | Yes | Already optimal |
| `WHERE CAST(trade_date AS DATE) = @date` | No | `WHERE trade_date >= @date AND trade_date < DATEADD(DAY, 1, @date)` |
| `WHERE _index = @index AND symbol = @sym` | Yes | Already optimal (composite index seek) |
| `WHERE ISNULL(sector, 'Unknown') = @sec` | No | `WHERE (sector = @sec OR (sector IS NULL AND @sec = 'Unknown'))` |
| `WHERE symbol IN (SELECT symbol FROM ...)` | Yes | Already optimal (semi-join) |
| `WHERE ABS(momentum_score) > 0.5` | No | `WHERE momentum_score > 0.5 OR momentum_score < -0.5` |
| `WHERE DATEDIFF(DAY, signal_date, GETDATE()) <= 7` | No | `WHERE signal_date >= DATEADD(DAY, -7, GETDATE())` |

---

## Related

- [[index-types-and-strategy]] — index types that SARGable queries exploit
- [[execution-plans]] — how to read execution plans to spot scans
- [[performance-audit-playbook]] — structured audit process
- [[wait-stats-analysis]] — diagnosing I/O pressure from non-SARGable queries
