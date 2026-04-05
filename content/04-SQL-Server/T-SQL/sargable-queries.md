---
title: "SARGable Queries"
tags: [sql, sql-server, tsql]
aliases: [SARGable, search argument, index seek, non-sargable, predicate]
description: "SARGable query patterns that enable SQL Server index seeks vs non-SARGable patterns that force full scans. Includes a complete reference table and fix strategies."
parent: "[[domain-query-craft]]"
links:
  - "[[merge-and-upsert]]"
  - "[[date-and-time-functions]]"
  - "[[execution-plans]]"
  - "[[query-plan-analysis]]"
  - "[[wait-stats-analysis]]"
  - "[[memory-and-buffer-pool]]"
  - "[[index-maintenance]]"
  - "[[performance-audit-playbook]]"
  - "[[pipeline-integration-and-devex]]"
  - "[[pit-integrity-logic]]"
created: 2026-03-22
updated: 2026-04-05
status: complete
---

# SARGable Queries

> [!quote]
> "The number one cause of slow queries is not missing indexes — it is predicates that prevent existing indexes from being used."
>
> — **Markus Winand**, *Use The Index, Luke*

A **predicate** is any condition in a WHERE, JOIN ON, or HAVING clause that SQL Server evaluates to decide whether a row qualifies — for example, `WHERE trade_date >= '2025-01-01'` or `JOIN ON t1.symbol = t2.symbol`. The query optimizer's ability to use an index depends entirely on whether each predicate is *SARGable*.

**SARGable** = **S**earch **ARG**ument**able**. A predicate is SARGable if SQL Server can use an index seek to evaluate it — meaning the optimizer can navigate the B-tree structure to find qualifying rows directly, without reading every row in the table. Non-SARGable predicates force SQL Server to scan every row and evaluate the expression per-row — often 10–100× more I/O, more CPU, and more lock contention for the same result.

**The fundamental rule:** Do not apply functions or calculations to the **column** side of a WHERE, JOIN ON, or HAVING clause. Apply them to the **value** side instead. This rule applies equally to implicit type conversions that SQL Server performs automatically.

---

## Predicate Pattern Reference

SARGability is broken by any transformation applied to the column being filtered or joined. The patterns below document the most common violations and their SARGable equivalents. Each applies equally to WHERE clauses, JOIN ON conditions, and HAVING clauses.

Not all operators are SARGable. The following operators allow the optimizer to use an index seek:

| SARGable operators | Non-SARGable operators |
|---|---|
| `=`, `>`, `>=`, `<`, `<=` | `<>`, `!=` |
| `IN (list)` (equality seek per value) | `NOT IN` |
| `BETWEEN` (range seek) | `NOT BETWEEN` |
| `LIKE 'prefix%'` (prefix match only) | `LIKE '%suffix'`, `LIKE '%middle%'` (leading wildcard forces scan) |
| `IS NULL` / `IS NOT NULL` (with a filtered index) | Functions on columns: `YEAR()`, `CAST()`, `ISNULL()`, `UPPER()`, etc. |

> [!info] Operator SARGability Rule
>
> The operator alone is not sufficient — the column must be bare (no function, no arithmetic, no implicit conversion) on at least one side of the predicate. `YEAR(trade_date) = 2025` uses the `=` operator but is not SARGable because the column is wrapped. `trade_date >= '2025-01-01'` uses `>=` and is SARGable because `trade_date` is exposed as a raw index key.

### SARGable vs Non-SARGable — Functions on Columns

When any function wraps a column in a predicate — `YEAR(trade_date)`, `ISNULL(symbol, 'x')`, `LEFT(symbol, 3)` — SQL Server cannot use the index to navigate directly to matching rows. The function must be evaluated for every row first, which eliminates the ability to perform a B-tree seek. Moving the equivalent transformation to the value side preserves the raw column as the seek key.

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

Arithmetic on a column (`price * quantity`, `score + 10`) has the same effect as a function: it prevents the optimizer from using the column's index value directly. The same is true for JOIN ON conditions — `ON CONVERT(INT, t1.ProdID) = t2.ProductID` forces a full scan of `t1` because the converted value cannot be compared against the stored index key without computing it per-row. Implicit conversions (e.g., comparing a `VARCHAR` column to an `NVARCHAR` parameter) are particularly dangerous because SQL Server performs the conversion silently with no error or warning.

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

A B-tree index stores rows in sorted order, with internal pages holding key ranges that point to child pages, and leaf pages holding the actual row data (or row pointers for non-clustered indexes). An index seek works by traversing the tree from root to leaf — the optimizer compares the search value against key ranges at each level to navigate directly to the qualifying leaf page, then follows the doubly-linked leaf chain to read only the rows in the result range. A non-SARGable predicate breaks this navigation: because the column value is transformed before comparison, it is no longer a known key value. SQL Server cannot determine which branch of the B-tree to follow, so it reads every leaf page and evaluates the expression per-row.

The consequences are not just slow queries. Non-SARGable scans:
- Read far more pages than needed, causing high disk I/O and buffer pool eviction
- Consume significantly more CPU cycles evaluating expressions per-row at scale
- Acquire a lock on every row or page scanned, increasing the risk of lock escalation to a full table lock that blocks all concurrent access

> [!info] Page Scan vs Seek
>
> - **SARGable** `WHERE trade_date >= '2025-01-01' AND trade_date < '2026-01-01'` — SQL Server navigates the B-tree root to the leaf page for `2025-01-01`, then scans forward through linked leaf pages until `2026-01-01`. Pages read: ~50 (only 2025 data).
> - **Non-SARGable** `WHERE YEAR(trade_date) = 2025` — SQL Server cannot navigate the B-tree because `YEAR()` is not a key value. Instead it reads every leaf page, computes `YEAR()` on every row, and filters. Pages read: ~5,000 (entire table). 100x more I/O for the same result.

---

### SARGability in JOIN Conditions

SARGability violations are not limited to WHERE clauses. Any function or type conversion applied to a column in a JOIN ON condition has the same effect: SQL Server cannot use the joined table's index to perform a seek and must instead scan the entire table. This is a common source of invisible performance degradation in multi-table queries where the joined columns have mismatched data types.

| Non-SARGable JOIN (Bad) | SARGable JOIN (Good) | Why |
|---|---|---|
| `ON CONVERT(INT, t1.ProdID) = t2.ProductID` | `ON t1.ProdID = t2.ProductID` (fix column type) | CONVERT wraps the join column; full scan on t1 |
| `ON CAST(t1.symbol AS NVARCHAR) = t2.symbol` | `ON t1.symbol = t2.symbol` (align types) | Implicit or explicit cast prevents index seek |
| `ON UPPER(t1.name) = UPPER(t2.name)` | Use a case-insensitive collation or persist a computed column | Function on both sides blocks seeks on both tables |

> [!warning] JOIN Conversions Are Harder to Spot
>
> Non-SARGable JOIN conditions are less visible than WHERE clause violations because they appear inside JOIN syntax, not WHERE predicates. The execution plan for a non-SARGable join shows a full scan on the inner table regardless of whether an index exists on the join column. Check both the Predicate and Seek Predicate properties of Nested Loops and Hash Match operators, not just Scan operators.

> [!success] Safe Pattern
>
> When joining tables with different data types on the join key, fix the mismatch at the schema level by aligning column types. If you cannot change the schema, create a persisted computed column with the conversion and index it — `ON t1.IntProdID = t2.ProductID` where `IntProdID AS CONVERT(INT, ProdID) PERSISTED`. Never cast the column inline in the JOIN condition.

### Composite Index SARGability — Left-Prefix Rule

A **composite index** covers multiple columns (e.g., `(symbol, trade_date, price)`). SARGability on a composite index depends on the **leftmost column(s)** in the index key: the optimizer can use the index to seek only if the WHERE clause provides a SARGable condition on the leading key column(s) in order. A condition on the second column alone cannot use the index for a seek — SQL Server cannot navigate the B-tree without a fixed starting point for the first key.

| Query predicate | Composite index `(symbol, trade_date)` | Behavior |
|---|---|---|
| `WHERE symbol = 'ASML'` | Seek on first key | Index seek, then range scan within ASML rows |
| `WHERE symbol = 'ASML' AND trade_date >= '2025-01-01'` | Seek on both keys | Full composite seek (most efficient) |
| `WHERE trade_date >= '2025-01-01'` | No seek possible | Index scan — second column without first |
| `WHERE symbol = 'ASML' AND YEAR(trade_date) = 2025` | Seek on first key only | Non-SARGable second predicate; seek on symbol + per-row filter on date |

> [!warning] Middle-Column Predicate Breaks the Seek Chain
>
> A non-SARGable predicate on any column in a composite index key stops the B-tree navigation at that column. Columns to the right of the non-SARGable predicate become unreachable via seek and are evaluated as post-scan filters. Always verify that every predicate on a composite key column is SARGable to get the full multi-column seek.

> [!success] Safe Pattern
>
> Design composite indexes with the most selective SARGable predicate column first. When reviewing queries, check that all key columns used in the composite index are referenced as raw (unwrapped) values in the WHERE clause — not inside functions or arithmetic expressions.

### The Golden Rule Table

A condensed reference for the most common non-SARGable patterns and their direct SARGable replacements. Use this when reviewing any WHERE clause before committing it to production.

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
   - **Seek Predicate** = SARGable — the index was used to navigate to the qualifying range
   - **Predicate** = non-SARGable — the filter is applied row-by-row *after* the entire index was read

A **Seek Predicate** means SQL Server passed the condition to the B-tree traversal as the navigation key. A **Predicate** means SQL Server read all rows first and then applied the condition as a post-scan filter — the index was used for access, not for selection. Only the Seek Predicate form uses the index efficiently.

### SQL Server | sys.dm_db_index_usage_stats | monitor seek/scan ratio

`sys.dm_db_index_usage_stats` accumulates seek, scan, lookup, and update counts for every index since the last SQL Server restart. A healthy index should be used predominantly for seeks; a high scan-to-seek ratio is a leading indicator that non-SARGable predicates are preventing seek usage. The practical guideline is **1,000 seeks per 1 scan** — indexes below this ratio are candidates for investigation.

```sql
SELECT
    OBJECT_NAME(ius.object_id) AS table_name,
    i.name                     AS index_name,
    ius.user_seeks,
    ius.user_scans,
    ius.user_lookups,
    CASE
        WHEN ius.user_scans = 0 THEN NULL
        ELSE ius.user_seeks / ius.user_scans
    END AS seeks_per_scan
FROM sys.dm_db_index_usage_stats ius
JOIN sys.indexes i ON ius.object_id = i.object_id
                   AND ius.index_id  = i.index_id
WHERE ius.database_id = DB_ID()
  AND ius.user_scans  > 0
ORDER BY IIF(seeks_per_scan IS NULL, 1, 0), seeks_per_scan ASC;
```

> [!info] Seek/Scan Ratio Guideline
>
> A `seeks_per_scan` value below 1,000 suggests the index is being scanned frequently relative to seeks — investigate WHERE clauses on that table for non-SARGable predicates. A value of 0 seeks with high scans means the index is never used for navigation, only for sequential reads; consider whether it is covering an unindexed table or whether non-SARGable predicates are entirely blocking seeks.

### SQL Server | sys.dm_exec_query_stats | detect non-SARGable cached plans

SQL Server caches query execution plans in the plan cache (`sys.dm_exec_query_stats`). You can query the XML plan representation to identify queries that perform Index Scans with a `Predicate` element (post-scan filter) rather than a `SeekPredicates` element — the structural signature of a non-SARGable WHERE clause. This lets you surface non-SARGable patterns across the entire workload without examining each query manually.

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

## Fixing Non-SARGable Predicates When You Can't Change the Query

When a non-SARGable query comes from a third-party tool, an ORM, or legacy code that cannot be modified, the only alternative is to make the index match the expression rather than rewriting the predicate. SQL Server provides two mechanisms for this: persisted computed columns with an index, and filtered indexes.

### Option 1 — Computed Column with Index

A **persisted computed column** stores the result of an expression physically in the row, so SQL Server can index it like a regular column. Adding an index on `YEAR(date)` directly is not possible, but adding a computed column `trade_year AS YEAR(date) PERSISTED` and indexing it achieves the same result. Queries that use `WHERE trade_year = 2025` (the expression form) are automatically matched to the index on the computed column by the optimizer, without modifying the query.

#### SQL Server | ALTER TABLE | add persisted computed column with index

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

### Option 2 — Filtered Index

A **filtered index** is a non-clustered index that includes only the rows matching a specific predicate expression. Unlike a computed column approach, a filtered index doesn't add a column — it creates a partial index covering only a known subset of rows. This is most effective when the non-SARGable query always targets a fixed value (e.g., always filtering on a specific year or status) and the filter selectivity is high.

#### SQL Server | CREATE INDEX | create a filtered non-clustered index

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

An **implicit conversion** occurs when SQL Server automatically converts a value from one data type to another during comparison — for example, when a query parameter is `NVARCHAR` but the column is `VARCHAR`. SQL Server must convert every row in the column to match the parameter type before comparing, which eliminates index seeks entirely and forces a full clustered index scan. The conversion appears nowhere in the T-SQL source — it is inserted silently by the query optimizer at compile time and surfaces only in the execution plan XML as a `PlanAffectingConvert` warning. The most common source in Python-to-SQL pipelines is `pyodbc`, which sends all string parameters as `NVARCHAR` by default regardless of the target column's declared type.

> [!danger] Implicit Conversions Kill Performance
>
> Implicit Conversions Cause Full Table Scans with Zero Warnings.
> When `pyodbc` sends an `NVARCHAR` parameter against a `VARCHAR` column, SQL Server silently converts every row in the table to `NVARCHAR` for comparison. This means: correct results, zero errors, but a full clustered index scan on every query. A table with 50M rows that used to seek in 2ms now scans for 8 seconds. The execution plan shows a `PlanAffectingConvert` warning, but only if you look for it.

> [!success] Safe Pattern
>
> In pyodbc, call `conn.setencoding(encoding='utf-8')` and `conn.setdecoding(pyodbc.SQL_CHAR, encoding='utf-8')` on the connection, or cast the parameter in SQL: `WHERE symbol = CAST(? AS VARCHAR(12))`. In C# Dapper, use `new DbString { Value = val, IsAnsi = true, Length = 12 }` for `VARCHAR` columns to prevent the default `NVARCHAR` mapping.

### SQL Server | plan cache | detect implicit conversions

SQL Server records a `PlanAffectingConvert` warning in the execution plan XML for any query where an implicit type conversion was inserted by the optimizer. Querying this warning across all cached plans surfaces every active query in the workload that is silently scanning rather than seeking due to a data type mismatch.

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

### pyodbc / C# | connection setup | fix implicit type conversion

The fix is applied at the driver level, before any query is sent. For `pyodbc`, setting the encoding at connection time instructs the driver to send string parameters as `VARCHAR` (8-bit) rather than `NVARCHAR` (16-bit Unicode). For C# with Dapper, the default ADO.NET mapping sends `string` parameters as `NVARCHAR`; using `DbString` with `IsAnsi = true` overrides this to match `VARCHAR` columns.

#### pyodbc setencoding — fix implicit NVARCHAR→VARCHAR conversion

```python
conn.setdecoding(pyodbc.SQL_CHAR, encoding='utf-8')
conn.setdecoding(pyodbc.SQL_WCHAR, encoding='utf-8')
conn.setencoding(encoding='utf-8')
```

---

## Pipeline Reference

### SARGability Quick Reference for the Pipeline

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

### Parameter Sniffing and Plan Cache Interaction

**Parameter sniffing** is the process by which SQL Server captures the parameter values passed on the *first* execution of a parameterized query and uses those values to compile and cache the execution plan. If the first execution uses an atypical parameter value — one that produces an unusually small or large result set — the cached plan is optimized for that atypical distribution and performs poorly for all subsequent executions with typical values.

`OPTION (RECOMPILE)` instructs SQL Server to recompile the query plan on every execution, using the current parameter values rather than cached ones. This eliminates plan reuse but guarantees the plan matches the actual data distribution. It is appropriate for queries where parameter values are highly skewed and the cost of a bad plan (full scan instead of seek) exceeds the cost of recompilation.

`OPTION (OPTIMIZE FOR UNKNOWN)` instructs the optimizer to generate a plan based on average distribution statistics rather than the specific sniffed value. This produces a plan that is not optimal for any single value but avoids catastrophic misfits. It is appropriate when no single "typical" value can be nominated but the variance is manageable.

A common symptom of parameter sniffing is a stored procedure that runs fast in isolation (tested with a specific parameter value) but runs slowly in production, often degrading immediately after a statistics update or manual `sp_recompile` that triggers a new compilation. The ARITHABORT SET option difference between SSMS (`ARITHABORT ON`) and .NET/pyodbc connections (`ARITHABORT OFF`) causes SQL Server to maintain separate cache entries for the same query — so testing from SSMS can show a different plan than what production uses.

`sp_recompile 'proc_name'` marks the stored procedure for recompilation on its next execution. It does not recompile immediately — the next call triggers a fresh compile with the new parameter values. This is a temporary diagnostic tool, not a permanent fix.

> [!info] SQL Server 2022 Parameter-Sensitive Plan Optimization
>
> SQL Server 2022 introduces **Parameter-Sensitive Plan (PSP) optimization** (database compatibility level 160+). The optimizer automatically detects skewed parameter distributions and generates multiple cached plans for a single parameterized statement — one per distinct "bucket" of cardinality. Executions with low-cardinality values use a seek-based plan; executions with high-cardinality values use a scan-based plan. This resolves many classic parameter sniffing cases without requiring `OPTION (RECOMPILE)`. Monitor with Query Store to verify that PSP is activating for skewed queries.

> [!warning] Parameter Sniffing Interaction
>
> A SARGable predicate with a parameterized query can still perform poorly if SQL Server "sniffs" an atypical parameter value on the first execution and caches a plan optimized for that value. Subsequent executions with typical values use the misoptimized plan. Monitor with `sys.dm_exec_query_stats` and consider `OPTION (RECOMPILE)` for volatile parameter distributions.

> [!success] Safe Pattern
>
> For stored procedures with highly skewed parameter distributions (e.g., flagship index with 8,000 rows vs boutique index with 12 rows), add `OPTION (RECOMPILE)` to the query or use `OPTION (OPTIMIZE FOR UNKNOWN)` to prevent the optimizer from sniffing any single value. On SQL Server 2022 at compatibility level 160, enable PSP optimization via Query Store and verify that multi-plan dispatch is active before adding query hints. Enable Query Store to detect plan regressions after the first atypical execution.

---

### Related

- [index-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/Storage-and-Indexes/index-types-and-strategy) — index types that SARGable queries exploit
- [execution-plans](https://alp78.github.io/elysium/04-SQL-Server/Performance/execution-plans) — how to read execution plans to spot scans
- [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/Performance/performance-audit-playbook) — structured audit process
- [wait-stats-analysis](https://alp78.github.io/elysium/04-SQL-Server/Performance/wait-stats-analysis) — diagnosing I/O pressure from non-SARGable queries
