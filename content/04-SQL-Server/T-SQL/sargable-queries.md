---
tags: [sql, sql-server, tsql]
aliases: [SARGable, search argument, index seek, non-sargable, predicate]
description: "SARGable query patterns that enable SQL Server index seeks vs non-SARGable patterns that force full scans. Includes a complete reference table and fix strategies."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# SARGable Queries

> [!quote]
> "The number one cause of slow queries is not missing indexes — it is predicates that prevent existing indexes from being used."
>
> — **Markus Winand**, *Use The Index, Luke*

**SARGable** = **S**earch **ARG**ument**able**. A predicate is SARGable if SQL Server can use an index seek to evaluate it. Non-SARGable predicates force SQL Server to scan every row and evaluate the expression per-row — often 10-100x more I/O for the same result.

**The fundamental rule:** Do not apply functions or calculations to the **column** side of a WHERE clause. Apply them to the **value** side instead.

---

### SARGable vs Non-SARGable — Functions on Columns

| Non-SARGable (Bad) | SARGable (Good) | Why |
|---|---|---|
| `WHERE YEAR(trade_date) = 2025` | `WHERE trade_date >= '2025-01-01' AND trade_date < '2026-01-01'` | Function on column prevents index seek |
| `WHERE CONVERT(VARCHAR, trade_date, 112) = '20250315'` | `WHERE trade_date = '2025-03-15'` | CONVERT wraps the column |
| `WHERE ISNULL(symbol, 'UNKNOWN') = 'ASML'` | `WHERE symbol = 'ASML'` | ISNULL wraps the column |
| `WHERE LEFT(symbol, 3) = 'ASM'` | `WHERE symbol LIKE 'ASM%'` | LEFT wraps the column; LIKE prefix is SARGable |

> [!warning] Functions on Columns Kill Index Usage
>
> `WHERE YEAR(trade_date) = 2025` scans the entire table — SQL Server
> cannot use the index on `trade_date` because the function transforms
> every row before comparison. The sargable equivalent:
> `WHERE trade_date >= '2025-01-01' AND trade_date < '2026-01-01'`.
> Same result, index seek instead of scan. This applies to ALL functions:
> `CAST()`, `CONVERT()`, `UPPER()`, `ISNULL()`, `DATEPART()`.

> [!success] Safe Pattern
>
> Move all transformations to the value (right) side of the predicate, never the column side. Replace `WHERE YEAR(trade_date) = @yr` with `WHERE trade_date >= DATEFROMPARTS(@yr, 1, 1) AND trade_date < DATEFROMPARTS(@yr + 1, 1, 1)`. The column stays bare and the index can seek.

### SARGable vs Non-SARGable — Calculations and Implicit Conversions

| Non-SARGable (Bad) | SARGable (Good) | Why |
|---|---|---|
| `WHERE price * quantity > 1000` | `WHERE price > 1000 / quantity` | Calculation on column prevents seek |
| `WHERE score + 10 > 50` | `WHERE score > 40` | Arithmetic on column; move constant to value side |
| `WHERE DATEDIFF(DAY, trade_date, GETDATE()) < 30` | `WHERE trade_date >= DATEADD(DAY, -30, GETDATE())` | DATEDIFF wraps the column |
| `WHERE varchar_col = N'text'` | `WHERE varchar_col = 'text'` | NVARCHAR vs VARCHAR forces implicit conversion |
| `WHERE symbol LIKE '%ML'` | `WHERE symbol LIKE 'AS%'` | Leading wildcard cannot seek; known prefix is seekable |

> [!danger] SARGability Is Not Auto-Flagged
>
> SARGability Is Not Flagged by SQL Server.
> SQL Server silently falls back to a full index scan when you wrap a column in a function. There is no warning, no error, and no plan hint. The query returns correct results -- just 100x slower. The only way to detect this is reading the execution plan and looking for Scan operators with a Predicate (not a Seek Predicate).

> [!success] Safe Pattern
>
> After writing or reviewing any WHERE clause, open the actual execution plan in SSMS and verify that the index operator shows a **Seek Predicate**, not just a **Predicate**. Add the `sys.dm_exec_query_stats` XML query (below) to the post-deployment checklist to surface non-SARGable predicates from the plan cache.

---

### Why Non-SARGable Predicates Are Slow

> [!info] Page Scan vs Seek
>
> - **SARGable** `WHERE trade_date >= '2025-01-01' AND trade_date < '2026-01-01'` — SQL Server navigates the B-tree root to the leaf page for `2025-01-01`, then scans forward through linked leaf pages until `2026-01-01`. Pages read: ~50 (only 2025 data).
> - **Non-SARGable** `WHERE YEAR(trade_date) = 2025` — SQL Server cannot navigate the B-tree because `YEAR()` is not a key value. Instead it reads every leaf page, computes `YEAR()` on every row, and filters. Pages read: ~5,000 (entire table). 100x more I/O for the same result.

---

### The Golden Rule Table

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

> [!info] Find Non-SARGable Cached Plans
>
> Queries cached plans for Index Scan operators that carry a Predicate (post-scan filter) rather than a Seek Predicate — the signature of a non-SARGable WHERE clause.

```sql
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

### Fixing Non-SARGable Predicates When You Can't Change the Query

If you cannot modify the query (e.g., it comes from a third-party tool), there are two workarounds:

**Option 1: Computed column + index**

```sql
ALTER TABLE silver.ohlcv_market_index
ADD trade_year AS YEAR(date) PERSISTED;

CREATE NONCLUSTERED INDEX IX_ohlcv_year
ON silver.ohlcv_market_index (trade_year);
```

> [!tip] Computed Column Enables Seek
>
> After adding the persisted computed column and index, `WHERE trade_year = 2025` uses an index seek instead of scanning and evaluating `YEAR()` per row.

> [!warning] Computed Columns Must Be PERSISTED
>
> To create an index on a computed column, it must be deterministic. If the expression uses non-deterministic functions, the column must be marked `PERSISTED` — SQL Server stores the computed value physically instead of recalculating on every read. Also, certain SET options (ANSI_NULLS ON, QUOTED_IDENTIFIER ON) must be active when the index is created AND when queries run — pyodbc connections may not set these by default.

> [!success] Safe Pattern
>
> Always mark computed columns `PERSISTED` when adding an index on them. In pyodbc, add `ANSI_NULLS=yes;QUOTED_IDENTIFIER=yes;` to the connection string, or execute `SET ANSI_NULLS ON; SET QUOTED_IDENTIFIER ON;` at session start, to ensure the filtered index is eligible for use.

**Option 2: Filtered index (if the predicate is always the same value)**

```sql
CREATE NONCLUSTERED INDEX IX_signals_2025
ON silver.signals_daily (symbol, signal_date)
WHERE YEAR(signal_date) = 2025;
```

> [!warning] Filtered Index Predicate Must Match
>
> The query must use the exact same predicate expression as the filtered index definition. Even logically equivalent rewrites will not match.

> [!success] Safe Pattern
>
> When creating a filtered index, document the exact predicate string and add a code-review rule that WHERE clauses targeting that column must match it verbatim. If the query needs a different predicate form, create a separate filtered index or use a computed column approach instead.

> [!warning] Filtered Index SET Option Requirements
>
> Filtered indexes require specific SET options active for both creation and query use: ANSI_NULLS ON, ANSI_PADDING ON, ANSI_WARNINGS ON, ARITHABORT ON, CONCAT_NULL_YIELDS_NULL ON, QUOTED_IDENTIFIER ON. If pyodbc or another driver doesn't set these, SQL Server silently ignores the filtered index and falls back to a table scan.

> [!success] Safe Pattern
>
> In pyodbc, set all required options at connection time: `cursor.execute("SET ANSI_NULLS, ANSI_PADDING, ANSI_WARNINGS, ARITHABORT, CONCAT_NULL_YIELDS_NULL, QUOTED_IDENTIFIER ON")`. Verify the filtered index is being used by checking the execution plan for the index name in the Seek Predicate after applying these settings.

---

## Implicit Conversions — The Silent Killer

> [!danger] Implicit Conversions Kill Performance
>
> Implicit Conversions Cause Full Table Scans with Zero Warnings.
> When `pyodbc` sends an `NVARCHAR` parameter against a `VARCHAR` column, SQL Server silently converts every row in the table to `NVARCHAR` for comparison. This means: correct results, zero errors, but a full clustered index scan on every query. A table with 50M rows that used to seek in 2ms now scans for 8 seconds. The execution plan shows a `PlanAffectingConvert` warning, but only if you look for it.

> [!success] Safe Pattern
>
> In pyodbc, call `conn.setencoding(encoding='utf-8')` and `conn.setdecoding(pyodbc.SQL_CHAR, encoding='utf-8')` on the connection, or cast the parameter in SQL: `WHERE symbol = CAST(? AS VARCHAR(12))`. In C# Dapper, use `new DbString { Value = val, IsAnsi = true, Length = 12 }` for `VARCHAR` columns to prevent the default `NVARCHAR` mapping.

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

### SARGability Quick Reference for the Pipeline

> [!warning] Parameter Sniffing Interaction
>
> A SARGable predicate with a parameterized query can still perform poorly if SQL Server "sniffs" an atypical parameter value on the first execution and caches a plan optimized for that value. Subsequent executions with typical values use the misoptimized plan. Monitor with `sys.dm_exec_query_stats` and consider `OPTION (RECOMPILE)` for volatile parameter distributions.

> [!success] Safe Pattern
>
> For stored procedures with highly skewed parameter distributions (e.g., flagship index with 8,000 rows vs boutique index with 12 rows), add `OPTION (RECOMPILE)` to the query or use `OPTION (OPTIMIZE FOR UNKNOWN)` to prevent the optimizer from sniffing any single value. Enable Query Store to detect plan regressions after the first atypical execution.

At-a-glance reference for common predicate patterns — use this when reviewing WHERE clauses in pipeline SQL.

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

### Related

- [index-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/index-types-and-strategy) — index types that SARGable queries exploit
- [execution-plans](https://alp78.github.io/elysium/04-SQL-Server/Performance/execution-plans) — how to read execution plans to spot scans
- [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/Performance/performance-audit-playbook) — structured audit process
- [wait-stats-analysis](https://alp78.github.io/elysium/04-SQL-Server/Performance/wait-stats-analysis) — diagnosing I/O pressure from non-SARGable queries
