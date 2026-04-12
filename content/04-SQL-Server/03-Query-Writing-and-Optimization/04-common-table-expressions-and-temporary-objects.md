---
title: "04 - Common Table Expressions and Temporary Objects"
tags: [sql, sql-server, tsql, cte, tempdb]
aliases: [CTE reference, temp tables, table variables, TVPs, derived tables, inline TVFs]
description: "T-SQL reference for derived tables, VALUES constructors, CTEs, recursive CTEs, temporary tables, table variables, inline table-valued functions, and table-valued parameters with a decision matrix and tested demos."
created: 2026-04-08
updated: 2026-04-11
status: complete
---

# Common Table Expressions and Temporary Objects

T-SQL offers a spectrum of intermediate shapes you can build inside a query or batch — each with different scope, durability, optimizer behaviour, and cost. This note covers every shape you will actually reach for in production: derived tables and `VALUES` constructors for inline rowsets, common table expressions (non-recursive and recursive) for statement-local naming, `#temp` tables and `@table` variables for multi-statement work, inline table-valued functions for parameterized reusable shapes, and table-valued parameters for caller-to-procedure rowsets.

Every demo in this note runs against the local `stoxx` database and shows its real output.

## Derived Tables and VALUES Constructors

> [!abstract] Inline intermediate shapes
>
> Derived tables and `VALUES` constructors are the two ways to produce a rowset **inline** inside a query — without naming anything at the schema level and without any lifetime beyond the statement that references them.
>
> - A **derived table** is a `SELECT` wrapped in parentheses in the `FROM` clause and given an alias.
> - A **VALUES constructor** is a literal rowset written directly in the `FROM` clause.
>
> Both disappear the moment the statement finishes executing.

### Derived table

*A subquery in the `FROM` clause, aliased like a regular table.*

#### Basic derived table

*Aggregate a set, then filter on the aggregate — the `WHERE` on the outer query can only see the alias `x`, never the inner columns.*

```sql
SELECT
    x.symbol,
    x.avg_close
FROM
(
    SELECT
        symbol,
        CAST(AVG([close]) AS decimal(10,2)) AS avg_close
    FROM silver.eurostoxx50_ohlcv
    GROUP BY symbol
) AS x
WHERE x.avg_close > 100
ORDER BY x.avg_close DESC;
```

| symbol | avg_close |
|---|---|
| RMS.PA | 1760.89 |
| ADYEN.AS | 1538.02 |
| ASML.AS | 677.22 |
| MC.PA | 660.07 |
| RHM.DE | 556.30 |
| ARGX.BR | 416.04 |
| OR.PA | 377.23 |
| MUV2.DE | 376.55 |
... (truncated to 8 rows)

> [!info]- Derived table anatomy
>
> - `( SELECT ... ) AS x` — the parenthesised subquery acts like a table; `AS x` gives it a name so the outer query can reference its columns.
> - The inner `GROUP BY` happens first; then the outer `WHERE x.avg_close > 100` filters the aggregated rowset.
> - The outer `WHERE` cannot reference the base columns (`[close]`, `volume`) because they are not exposed by the derived table's projection.

#### Derived table joined back to the source

*A classic "aggregate and rejoin" pattern — the derived table computes per-symbol averages, then joins back to retrieve the row for a specific date alongside that average.*

```sql
SELECT p.symbol, p.[date], p.[close], agg.avg_close
FROM silver.eurostoxx50_ohlcv AS p
JOIN
(
    SELECT symbol, AVG([close]) AS avg_close
    FROM silver.eurostoxx50_ohlcv
    GROUP BY symbol
) AS agg
    ON agg.symbol = p.symbol
WHERE p.[date] = '2025-01-02'
ORDER BY p.symbol;
```

| symbol | date | close | avg_close |
|---|---|---|---|
| ABI.BR | 2025-01-02 | 48.76 | 54.933864142538916 |
| AD.AS | 2025-01-02 | 31.73 | 29.788103192279173 |
| ADS.DE | 2025-01-02 | 236.7 | 204.5874328358207 |
| ADYEN.AS | 2025-01-02 | 1428.0 | 1538.0158871566446 |
| AI.PA | 2025-01-02 | 155.86 | 145.75594521158118 |
| AIR.PA | 2025-01-02 | 160.14 | 134.947438752784 |
| ALV.DE | 2025-01-02 | 296.8 | 253.44313432835833 |
| ARGX.BR | 2025-01-02 | 610.8 | 416.0397921306604 |
... (truncated to 8 rows)

Each row pairs the closing price on 2025-01-02 with that symbol's average across its entire history. Window functions (`AVG() OVER (PARTITION BY symbol)`) are usually a cleaner way to express this, but the derived-table form remains common in older codebases and in engines without window functions.

> [!tip] When to reach for a derived table
>
> - The intermediate result is needed **once**, in a single statement.
> - Keeping the logic close to its consumer improves readability.
> - The aggregation or filter cannot be expressed with a window function or is simpler without one.

### VALUES constructor

*A literal rowset written directly in the `FROM` clause, useful for fixtures, lookup tables, and parameter lists.*

#### Inline rowset

*Build a 3-row, 2-column lookup table out of literals.*

```sql
SELECT *
FROM
(
    VALUES
        ('EU', 'Europe'),
        ('US', 'United States'),
        ('AS', 'Asia')
) AS x(region_code, region_name);
```

| region_code | region_name |
|---|---|
| EU | Europe |
| US | United States |
| AS | Asia |

> [!info]- VALUES constructor anatomy
>
> - `VALUES (...), (...), (...)` — one tuple per row; every tuple must have the same number and type of columns.
> - `AS x(region_code, region_name)` — the alias *and* its column list are required. Without a column list the rowset has no column names and cannot be referenced.
> - The data type of each column is inferred from the highest-precedence literal; mixed types can surprise you, so cast explicitly when the types are not obvious.

#### VALUES as a fixture joined to a real table

*Use `VALUES` to supply a small mapping, then join the live data to it.*

```sql
SELECT t.symbol, d.label
FROM silver.eurostoxx50_ohlcv AS t
JOIN
(
    VALUES
        ('SAP.DE',  'Enterprise SW'),
        ('ASML.AS', 'Semi lithography'),
        ('MC.PA',   'Luxury goods')
) AS d(symbol, label)
    ON d.symbol = t.symbol
WHERE t.[date] = '2025-01-02'
ORDER BY t.symbol;
```

| symbol | label |
|---|---|
| ASML.AS | Semi lithography |
| MC.PA | Luxury goods |
| SAP.DE | Enterprise SW |

This pattern replaces both one-off lookup tables and repetitive `CASE` expressions. It also makes the mapping self-documenting: the three labels are right next to the query that uses them.

> [!tip] Reach for VALUES when
>
> - You need a tiny mapping or fixture that does not deserve a schema object.
> - The mapping is specific to one query and should not leak into the rest of the codebase.
> - You want an inline `INSERT` body: `INSERT INTO t (a, b) VALUES (1, 'x'), (2, 'y');` is the same constructor in statement position.

## Common Table Expressions

> [!abstract] Naming an intermediate result set
>
> A common table expression (**CTE**) is a named subquery that exists only for the next single statement after the `WITH` clause. CTEs exist to improve readability — they let you name each stage of a transformation and reference it by name further down the query.
>
> A CTE is **not** a view, **not** a temp table, and **not** a way to force materialization. The optimizer is free to inline the CTE's definition into its callers, which can lead to surprising re-evaluation behaviour if you are not expecting it.

### WITH common_table_expression

*Define a named intermediate rowset, then reference it in the immediately following statement.*

#### Basic CTE

*Find the most recent close for every symbol in the index.*

```sql
;WITH latest_prices AS
(
    SELECT
        symbol,
        MAX([date]) AS latest_date
    FROM silver.eurostoxx50_ohlcv
    GROUP BY symbol
)
SELECT
    p.symbol,
    p.[date],
    p.[close]
FROM silver.eurostoxx50_ohlcv AS p
JOIN latest_prices AS l
    ON p.symbol = l.symbol
   AND p.[date] = l.latest_date
ORDER BY p.symbol;
```

| symbol | date | close |
|---|---|---|
| ABI.BR | 2026-04-07 | 61.62 |
| AD.AS | 2026-04-07 | 41.69 |
| ADS.DE | 2026-04-07 | 130.85 |
| ADYEN.AS | 2026-04-07 | 844.2 |
| AI.PA | 2026-04-07 | 181.5 |
| AIR.PA | 2026-04-07 | 162.62 |
| ALV.DE | 2026-04-07 | 367.2 |
| ARGX.BR | 2026-04-07 | 648.6 |
... (truncated to 8 rows)

> [!info]- CTE anatomy
>
> - `WITH <name> AS ( <query> )` — defines the CTE; the name is visible only to the next statement.
> - `;WITH` — the leading semicolon terminates any previous statement the parser might still be attached to (see the next H4).
> - The CTE rowset behaves exactly like a derived table in every subsequent reference; SQL Server is free to inline, materialize, or execute it multiple times.

#### The leading-semicolon rule

*Why every CTE in production code begins with `;WITH`.*

The `WITH` keyword is used for several different things in T-SQL (CTEs, `XMLNAMESPACES`, change tracking context). If the parser sees `WITH` and the preceding statement is not terminated with a semicolon, it cannot tell whether you are starting a CTE or continuing the previous statement.

```sql
SELECT 1 AS prev
WITH x AS (SELECT 1 AS n)
SELECT * FROM x;
```

```text
('42000', "[42000] [Microsoft][ODBC Driver 18 for SQL Server][SQL Server]Incorrect syntax near the keyword 'with'. If this statement is a common table expression, an xmlnamespaces clause or a change tracking context clause, the previous statement must be terminated with a semicolon. (319) (SQLExecDirectW)")
```

The fix is a semicolon between the two statements — or, defensively, a leading semicolon on the CTE itself:

```sql
SELECT 1 AS prev;
WITH x AS (SELECT 1 AS n)
SELECT * FROM x;
```

| prev |
|---|
| 1 |

Both statements now run; the CTE result is produced by the second statement.

> [!warning] Always lead CTEs with `;WITH`
>
> Even when you control every line of the batch, habit pays off:
>
> - You cannot always see what is upstream (stored procedure body, batch concatenation, templating).
> - A missing trailing semicolon anywhere above your CTE silently breaks the parser.
> - `;WITH` is the single-line "defensive programming" fix that costs nothing.

### Multiple CTEs

*Chain several CTEs in one `WITH` block when each stage deserves its own name.*

#### Chained CTEs

*Define a base projection, compute the latest date per symbol from it, then join back.*

```sql
;WITH base AS
(
    SELECT symbol, [date], [close]
    FROM silver.eurostoxx50_ohlcv
    WHERE [date] >= '2025-01-01'
),
latest AS
(
    SELECT symbol, MAX([date]) AS latest_date
    FROM base
    GROUP BY symbol
)
SELECT b.symbol, b.[date], b.[close]
FROM base AS b
JOIN latest AS l
    ON b.symbol = l.symbol
   AND b.[date] = l.latest_date
ORDER BY b.symbol;
```

| symbol | date | close |
|---|---|---|
| ABI.BR | 2026-04-07 | 61.62 |
| AD.AS | 2026-04-07 | 41.69 |
| ADS.DE | 2026-04-07 | 130.85 |
| ADYEN.AS | 2026-04-07 | 844.2 |
| AI.PA | 2026-04-07 | 181.5 |
| AIR.PA | 2026-04-07 | 162.62 |
| ALV.DE | 2026-04-07 | 367.2 |
| ARGX.BR | 2026-04-07 | 648.6 |
... (truncated to 8 rows)

> [!info]- Chained CTE anatomy
>
> - `WITH a AS (...), b AS (...)` — commas separate CTE definitions; each subsequent CTE can reference any earlier CTE in the same `WITH` block.
> - `base` defines the filtered slice once; both `latest` and the final `SELECT` reference it, so the slice is expressed exactly once in the code.
> - The final statement is the **only** consumer allowed to use the CTE names — the scope ends immediately after.

> [!tip] When to chain CTEs
>
> - Each stage has a clear semantic role (filter → aggregate → join).
> - Naming each stage makes the query read top-to-bottom like a data pipeline.
> - The alternative is deeply nested subqueries, which are much harder to review.

### CTE scope and re-evaluation

*The two things about CTEs that surprise every first-time user.*

#### Single-statement scope

*A CTE exists only for the statement that immediately follows its definition.*

```sql
WITH x AS (SELECT 1 AS n) SELECT * FROM x; SELECT * FROM x;
```

The first `SELECT * FROM x` succeeds and returns `1`. The second `SELECT * FROM x` runs in a separate statement and fails because the CTE name is no longer in scope:

```text
('42S02', "[42S02] [Microsoft][ODBC Driver 18 for SQL Server][SQL Server]Invalid object name 'x'. (208) (SQLExecDirectW)")
```

> [!failure] CTEs are not temp tables
>
> If you want to reference a named rowset across multiple statements, a CTE is the wrong tool:
>
> - Use a `#temp` table when you need multi-statement reuse.
> - Use a view when you need cross-session reuse.
> - A CTE only exists for the single statement glued directly to its `WITH` clause.

#### Re-evaluation trap

*A CTE referenced more than once is evaluated more than once — it is not memoized.*

```sql
;WITH r AS (SELECT NEWID() AS g)
SELECT g FROM r
UNION ALL
SELECT g FROM r;
```

| g |
|---|
| 85898BD3-F240-4830-8732-BA576182B799 |
| 8517A851-9D82-4B97-A60E-9553AA359CAF |

The two `SELECT g FROM r` references produce **different** `NEWID()` values — proof that SQL Server inlined the CTE and ran it twice. Contrast with a temp table:

```sql
IF OBJECT_ID('tempdb..#r') IS NOT NULL DROP TABLE #r;
SELECT NEWID() AS g INTO #r;
SELECT g FROM #r
UNION ALL
SELECT g FROM #r;
```

| g |
|---|
| FB6D792C-2EC2-42B2-9170-AF701FFC7833 |
| FB6D792C-2EC2-42B2-9170-AF701FFC7833 |

The temp table holds a single concrete value and both `SELECT`s see it.

> [!danger] CTE re-evaluation can silently double your work
>
> When a CTE wraps an expensive aggregation or scan and is referenced multiple times:
>
> - The optimizer may inline it and run the expensive work once per reference.
> - Non-deterministic functions (`NEWID()`, `GETDATE()`, `RAND()`) return different values on each reference.
> - The fix is to materialize: write the result to a `#temp` table first, then reference the temp table.

## Recursive CTEs

> [!abstract] Iterative result construction
>
> A **recursive CTE** lets a query reference itself. This is the T-SQL tool for walking hierarchies (org charts, bills of material, category trees), building date spines, and any problem where the next row depends on a previous row. A recursive CTE has three parts: an **anchor member** that produces the starting rowset, a **recursive member** that produces the next rowset by referencing the CTE itself, and a **termination condition** inside the recursive member's `WHERE` clause.
>
> The recursive member stops running when it returns zero rows. If it never returns zero rows, `MAXRECURSION` saves you.

### Anatomy

*The three parts every recursive CTE must have.*

#### Anchor, recursive member, termination

*A recursive CTE that counts from 1 to 5.*

```sql
;WITH x AS
(
    SELECT 1 AS n                      -- anchor member
    UNION ALL
    SELECT n + 1 FROM x WHERE n < 5    -- recursive member + termination
)
SELECT * FROM x;
```

| n |
|---|
| 1 |
| 2 |
| 3 |
| 4 |
| 5 |

> [!info]- Recursive CTE anatomy
>
> - **Anchor member**: a non-recursive `SELECT` that produces the starting rowset. Here: `SELECT 1 AS n`.
> - `UNION ALL`: mandatory — a recursive CTE must use `UNION ALL`, never plain `UNION`.
> - **Recursive member**: a `SELECT` that references the CTE name (`FROM x`). Each invocation sees only the rows produced by the previous invocation, not every row ever produced.
> - **Termination condition**: the `WHERE n < 5` filter eventually makes the recursive member return zero rows, ending the recursion.

#### UNION ALL is mandatory

*Replacing `UNION ALL` with `UNION` produces a hard parse error.*

```sql
;WITH x AS
(
    SELECT 1 AS n
    UNION
    SELECT n + 1 FROM x WHERE n < 5
)
SELECT * FROM x;
```

```text
('42000', "[42000] [Microsoft][ODBC Driver 18 for SQL Server][SQL Server]Recursive common table expression 'x' does not contain a top-level UNION ALL operator. (252) (SQLExecDirectW)")
```

> [!warning] Never write `UNION` in a recursive CTE
>
> SQL Server rejects `UNION` at parse time (error 252). The reason:
>
> - `UNION` would need to deduplicate across every recursion level, which changes the semantics and kills the pipelined evaluation the engine relies on.
> - Even if your data is naturally unique, use `UNION ALL` — it is the only form the parser accepts.

### Date spine

*Generate a contiguous sequence of dates — a recursive CTE is the classical tool when a calendar table is unavailable.*

#### Seven-day window

*Anchor on January 1st, add one day on each recursion, stop at January 7th.*

```sql
;WITH dates AS
(
    SELECT CAST('2025-01-01' AS date) AS d
    UNION ALL
    SELECT DATEADD(DAY, 1, d)
    FROM dates
    WHERE d < '2025-01-07'
)
SELECT d FROM dates
OPTION (MAXRECURSION 100);
```

| d |
|---|
| 2025-01-01 |
| 2025-01-02 |
| 2025-01-03 |
| 2025-01-04 |
| 2025-01-05 |
| 2025-01-06 |
| 2025-01-07 |

> [!tip] Prefer a real calendar table in production
>
> Date-spine recursive CTEs are pedagogically useful but rarely the best choice in operational code:
>
> - A persistent calendar table (`dbo.dim_calendar` in the `stoxx` database has 732 rows) joins cheaply and carries holiday flags, fiscal periods, and week numbers for free.
> - A tally table with a `ROW_NUMBER()` projection scales to hundreds of thousands of rows without touching recursion.
> - Use a recursive CTE when a calendar table does not exist and the spine is small (days, weeks, months, not milliseconds).

### Hierarchy traversal

*The canonical use case for recursive CTEs — walking a parent/child relationship of unknown depth.*

#### Org chart walk with level and path

*Produce every employee, their depth in the tree, and the path from the root.*

```sql
;WITH emp(id, name, manager_id) AS
(
    SELECT * FROM (VALUES
        (1, 'Alice',    NULL),
        (2, 'Bob',      1),
        (3, 'Carol',    1),
        (4, 'Dan',      2),
        (5, 'Eve',      2),
        (6, 'Frank',    3)
    ) v(id, name, manager_id)
),
walk AS
(
    SELECT id, name, manager_id,
           0 AS level,
           CAST(name AS varchar(200)) AS path
    FROM emp
    WHERE manager_id IS NULL          -- anchor: top of tree
    UNION ALL
    SELECT e.id, e.name, e.manager_id,
           w.level + 1,
           CAST(w.path + ' > ' + e.name AS varchar(200))
    FROM emp AS e
    JOIN walk AS w ON e.manager_id = w.id
)
SELECT level, id, name, manager_id, path
FROM walk
ORDER BY path;
```

| level | id | name | manager_id | path |
|---|---|---|---|---|
| 0 | 1 | Alice | NULL | Alice |
| 1 | 2 | Bob | 1 | Alice > Bob |
| 2 | 4 | Dan | 2 | Alice > Bob > Dan |
| 2 | 5 | Eve | 2 | Alice > Bob > Eve |
| 1 | 3 | Carol | 1 | Alice > Carol |
| 2 | 6 | Frank | 3 | Alice > Carol > Frank |

The `level` column is incremented on every recursive step, giving you the depth for free. The `path` column builds a human-readable breadcrumb by concatenating names, making it easy to sort the output in tree order.

> [!info]- Hierarchy-walk anatomy
>
> - `emp` is a non-recursive CTE acting as a fixture; the actual recursion is `walk`.
> - Anchor: `WHERE manager_id IS NULL` selects the single root node (Alice).
> - Recursive member: joins `emp` to `walk` on `e.manager_id = w.id` — each iteration finds every employee whose manager is already in `walk`.
> - `CAST(... AS varchar(200))` on both sides is required: the anchor and recursive members must produce identical column types, and recursive string concatenation needs a bounded length.

> [!tip] Cycle detection with a path array
>
> If the parent/child graph could contain cycles (rare in org charts, common in bill-of-material graphs), extend the recursive member with a `WHERE CHARINDEX('>' + CAST(e.id AS varchar) + '>', w.path) = 0` guard. This prevents the recursion from visiting a node it has already seen and is the standard way to detect cycles in a recursive CTE.

### MAXRECURSION

*The safety net that turns runaway recursion into an error rather than a hung server.*

#### Default recursion cap

*Exceeding the default cap of 100 produces a hard error.*

```sql
;WITH n AS
(
    SELECT 1 AS i
    UNION ALL
    SELECT i + 1 FROM n WHERE i < 200
)
SELECT MAX(i) FROM n;
```

```text
('42000', '[42000] [Microsoft][ODBC Driver 18 for SQL Server][SQL Server]The statement terminated. The maximum recursion 100 has been exhausted before statement completion. (530) (SQLExecDirectW)')
```

#### Overriding the cap

*Use `OPTION (MAXRECURSION n)` on the statement to allow deeper recursion.*

```sql
;WITH n AS
(
    SELECT 1 AS i
    UNION ALL
    SELECT i + 1 FROM n WHERE i < 200
)
SELECT MAX(i) FROM n
OPTION (MAXRECURSION 500);
```

|  |
|---|
| 200 |

The query now terminates cleanly and returns 200 — the natural stopping point of the recursion, reached well before the 500-level cap.

> [!danger] MAXRECURSION 0 disables the cap entirely
>
> Writing `OPTION (MAXRECURSION 0)` removes the upper bound on recursion depth. Use it only when:
>
> - The termination condition is provably sound and bounded by data, not by a constant in the query.
> - You have explicit approval from a DBA, because a runaway recursion with `MAXRECURSION 0` will exhaust memory and the server's worker threads.
> - There is no safer alternative like a `WHILE` loop with an explicit counter.

## Temporary Tables

> [!abstract] Session-scoped rowsets in tempdb
>
> A **temporary table** is a real table that lives in the `tempdb` system database. It has a schema, statistics, indexes, and participates in transactions like any other table — but its lifetime is tied to the session (local temp tables) or to explicit drops (global temp tables). Temp tables are the go-to T-SQL shape when you need to materialize an intermediate result that is reused across multiple statements, large enough to justify statistics, or that would benefit from an index.

### Local temp tables `#temp`

*A table prefixed with a single `#` — visible only to the session that created it.*

#### CREATE, INSERT, SELECT

*The canonical shape: build the temp table, load it, then query it in subsequent statements.*

```sql
IF OBJECT_ID('tempdb..#latest_prices') IS NOT NULL DROP TABLE #latest_prices;
CREATE TABLE #latest_prices
(
    symbol varchar(20) NOT NULL PRIMARY KEY,
    latest_date date NOT NULL
);
INSERT INTO #latest_prices (symbol, latest_date)
SELECT symbol, MAX([date]) FROM silver.eurostoxx50_ohlcv GROUP BY symbol;
SELECT TOP (5) symbol, latest_date FROM #latest_prices ORDER BY symbol;
```

| symbol | latest_date |
|---|---|
| ABI.BR | 2026-04-07 |
| AD.AS | 2026-04-07 |
| ADS.DE | 2026-04-07 |
| ADYEN.AS | 2026-04-07 |
| AI.PA | 2026-04-07 |

> [!info]- Temp table creation anatomy
>
> - `IF OBJECT_ID('tempdb..#latest_prices') IS NOT NULL DROP TABLE #latest_prices;` — defensive cleanup so the script is re-runnable inside the same session.
> - `CREATE TABLE #latest_prices ( ... PRIMARY KEY ... )` — the `#` prefix makes it session-local; the `PRIMARY KEY` creates a clustered index automatically.
> - Subsequent statements see the table normally, exactly like a permanent table.

#### SELECT INTO shortcut

*Create and populate a temp table in a single statement by projecting directly into a new table name.*

```sql
IF OBJECT_ID('tempdb..#summary') IS NOT NULL DROP TABLE #summary;
SELECT symbol,
       COUNT(*)    AS row_count,
       MIN([date]) AS first_date,
       MAX([date]) AS last_date
INTO #summary
FROM silver.eurostoxx50_ohlcv
GROUP BY symbol;
SELECT TOP (5) symbol, row_count, first_date, last_date
FROM #summary
ORDER BY symbol;
```

| symbol | row_count | first_date | last_date |
|---|---|---|---|
| ABI.BR | 1347 | 2021-01-04 | 2026-04-07 |
| AD.AS | 1347 | 2021-01-04 | 2026-04-07 |
| ADS.DE | 1340 | 2021-01-04 | 2026-04-07 |
| ADYEN.AS | 1347 | 2021-01-04 | 2026-04-07 |
| AI.PA | 1347 | 2021-01-04 | 2026-04-07 |

`SELECT INTO` infers column names, types, and nullability from the source query. It is faster to write and (slightly) faster to execute than the explicit `CREATE TABLE` / `INSERT` pair, because the engine can perform a minimally-logged operation under the right database recovery model.

> [!tip] Explicit CREATE TABLE still has its place
>
> - When you need a `PRIMARY KEY` or explicit index at creation time — `SELECT INTO` produces a heap with no constraints.
> - When the column types matter for downstream performance (e.g., you want `varchar(20)` not `varchar(8000)`).
> - When the code is a stored procedure and you want the temp table to exist with a stable shape the plan cache can reuse.

#### Post-load indexing

*Create an index on a temp table after it has been populated to support downstream queries.*

```sql
IF OBJECT_ID('tempdb..#t') IS NOT NULL DROP TABLE #t;
SELECT symbol, [date], [close] INTO #t FROM silver.eurostoxx50_ohlcv;
CREATE INDEX ix_t_symbol_date ON #t(symbol, [date]);
SELECT i.name AS index_name, i.type_desc,
       COUNT(*) OVER () AS total_indexes
FROM tempdb.sys.indexes AS i
WHERE i.object_id = OBJECT_ID('tempdb..#t')
  AND i.type_desc <> 'HEAP';
```

| index_name | type_desc | total_indexes |
|---|---|---|
| ix_t_symbol_date | NONCLUSTERED | 1 |

The pattern "bulk-load first, index second" is faster than creating the index up-front: the engine avoids maintaining the index during the load, then builds it in one pass on a populated table.

> [!success] Temp tables keep statistics
>
> Unlike table variables (covered below), temp tables maintain column statistics that the optimizer can use:
>
> - Cardinality estimates on a temp table reflect the actual row count.
> - Statistics are created automatically on index columns and on columns referenced in `WHERE` clauses (depending on database settings).
> - For intermediate results with skewed distributions, this is often the difference between a good plan and a bad one.

### Global temp tables `##temp`

*A table prefixed with two `##` — visible to every session for as long as any session holds a reference to it.*

#### Cross-session visibility

*Create a global temp table in one session; any other session can read or write it.*

```sql
IF OBJECT_ID('tempdb..##shared') IS NOT NULL DROP TABLE ##shared;
CREATE TABLE ##shared (n int);
INSERT INTO ##shared VALUES (1), (2), (3);
SELECT n FROM ##shared;
```

| n |
|---|
| 1 |
| 2 |
| 3 |

The table `##shared` will remain in `tempdb` until every session that references it disconnects, at which point SQL Server drops it automatically.

> [!warning] Global temp tables are rarely the right default
>
> They carry serious operational risks in shared environments:
>
> - Any session can read and write them — no isolation between concurrent batches.
> - Naming collisions across unrelated jobs or users are likely.
> - Lifetime rules are non-obvious: the table disappears when the last referencing session closes, which is hard to predict in connection-pooled application code.
> - Use them only for controlled DBA or orchestration scenarios where cross-session sharing is the explicit goal.

### Scope and transaction semantics

*Two traps that catch engineers new to temp tables.*

#### Nested procedure visibility

*A local temp table created inside a procedure is visible to any procedure **it** calls, but not to the caller.*

The rule is subtle but important:

- A `#temp` created in the outer batch is visible to every procedure the batch calls.
- A `#temp` created inside a procedure is visible to inner procedures it calls, but disappears when the procedure returns.
- This is different from variable scope, which is strictly per-batch.

> [!tip] Use the outer batch for shared state
>
> If two sibling procedures need to share a temp table, either:
>
> - Create the temp table in the caller and let both procedures reference it by name.
> - Pass a `TVP` (covered later in this note) from the caller, which makes the dependency explicit in the procedure signature.

#### Temp tables participate in transactions

*A temp table's data is transactional — rollback reverts INSERTs, UPDATEs, and DELETEs inside the transaction.*

```sql
IF OBJECT_ID('tempdb..#t') IS NOT NULL DROP TABLE #t;
CREATE TABLE #t (n int);
INSERT INTO #t VALUES (99);
BEGIN TRAN;
INSERT INTO #t VALUES (1), (2), (3);
ROLLBACK;
SELECT n FROM #t ORDER BY n;
```

| n |
|---|
| 99 |

The pre-transaction `INSERT INTO #t VALUES (99)` survives. The three rows inserted inside `BEGIN TRAN ... ROLLBACK` are reverted. The temp table itself survives because the `CREATE TABLE` happened outside the explicit transaction — if `CREATE TABLE #t` had been inside `BEGIN TRAN`, the rollback would also drop the table.

## Table Variables

> [!abstract] Variable-scoped rowsets
>
> A **table variable** is declared like any other variable (`DECLARE @t TABLE (...)`) but holds a rowset instead of a scalar. Table variables live in `tempdb` just like temp tables, but they follow variable scoping rules: they are only visible inside the batch or procedure that declared them, and they are not affected by explicit `ROLLBACK`. They are convenient for small parameter-like rowsets and for function return types, but they have important optimizer limitations you need to understand before reaching for them as a default "lightweight temp table".

### DECLARE @t TABLE

*Declare the variable, insert rows, query it — all in the same batch.*

#### Basic table variable

*Same workload as the temp table example above, rewritten with a table variable.*

```sql
DECLARE @latest_prices TABLE
(
    symbol varchar(20) PRIMARY KEY,
    latest_date date NOT NULL
);
INSERT INTO @latest_prices (symbol, latest_date)
SELECT symbol, MAX([date]) FROM silver.eurostoxx50_ohlcv GROUP BY symbol;
SELECT TOP (5) symbol, latest_date FROM @latest_prices ORDER BY symbol;
```

| symbol | latest_date |
|---|---|
| ABI.BR | 2026-04-07 |
| AD.AS | 2026-04-07 |
| ADS.DE | 2026-04-07 |
| ADYEN.AS | 2026-04-07 |
| AI.PA | 2026-04-07 |

> [!info]- Table variable anatomy
>
> - `DECLARE @latest_prices TABLE ( ... )` — the table schema is declared inline; there is no `CREATE TABLE` statement and no object in the database.
> - `PRIMARY KEY` inside a table variable declaration creates the clustered index, exactly like a real table.
> - The variable is visible until the batch ends; it cannot be referenced from inner procedures called by the batch.

### Transaction semantics

*The single biggest behavioural difference between table variables and temp tables.*

#### Table variables survive ROLLBACK

*DML against a table variable is **not** transactional — a `ROLLBACK` leaves the rows in place.*

```sql
DECLARE @t TABLE (n int);
INSERT INTO @t VALUES (99);
BEGIN TRAN;
INSERT INTO @t VALUES (1), (2), (3);
ROLLBACK;
SELECT n FROM @t ORDER BY n;
```

| n |
|---|
| 1 |
| 2 |
| 3 |
| 99 |

The pre-transaction `99` and the three rows inserted inside `BEGIN TRAN ... ROLLBACK` are **all** present after the rollback. This is exactly the opposite of the temp table behaviour one section above.

> [!danger] Do not rely on ROLLBACK to undo table variable writes
>
> This is the most common production bug with table variables:
>
> - An `INSERT` inside a failed transaction is **still there** after the rollback.
> - Procedures that accumulate state in a table variable must explicitly clean up on error, not assume the transaction will.
> - If you need transactional semantics for your intermediate rowset, use a `#temp` table instead.

### Cardinality limitation

*Why the optimizer estimates "one row" for a table variable — and what that does to your query plans.*

The optimizer does not maintain column statistics on table variables. This has one specific consequence: when a query references `@table` in a `JOIN` or `WHERE` clause, the optimizer estimates that exactly **one row** will be produced (prior to SQL Server 2019 trace flag / deferred compilation changes). If the variable actually contains 100,000 rows, the estimate is off by five orders of magnitude and the chosen plan — loop joins, nested seeks, single-threaded execution — will be catastrophic.

> [!warning] Table variable cardinality trap
>
> Observed symptoms of a too-big table variable:
>
> - The execution plan shows a nested-loop join against a multi-million-row table with "estimated rows = 1".
> - CPU and duration scale non-linearly with the variable's actual size.
> - Query Store shows the same query running fast with small inputs and hanging with larger ones.
> - The fix is usually to switch to a `#temp` table or to add `OPTION (RECOMPILE)` to the referencing statement.

#### OPTION (RECOMPILE) workaround

*Force the optimizer to recompile the statement with the actual row count of the table variable.*

Adding `OPTION (RECOMPILE)` to the statement that references `@t` allows the optimizer to sniff the real cardinality at runtime. It is cheaper than switching to a temp table in some cases but costs a recompile on every execution:

```sql
-- Reference pattern, not a runnable demo:
SELECT p.symbol, p.[close]
FROM silver.eurostoxx50_ohlcv AS p
JOIN @latest_prices AS lp ON lp.symbol = p.symbol
OPTION (RECOMPILE);
```

> [!tip] When to keep the table variable
>
> - The variable holds a small, predictable number of rows (single digits to low hundreds).
> - You need a `RETURN` type for a multi-statement TVF (where temp tables are not available).
> - You need transaction-independent accumulation (write survives rollback).
> - The calling pattern is a stored procedure parameter — use a TVP instead (see below).

## Inline Table-Valued Functions

> [!abstract] Parameterized reusable queries
>
> An **inline table-valued function** (inline TVF) is a named, parameterized query that returns a rowset. It behaves like a parameterized view: the function body is a single `SELECT` statement, and the optimizer **inlines** it into the caller's query at compile time, exactly as if you had pasted the function body into a derived table. Inline TVFs are the most performant way to package reusable query logic in T-SQL — far more so than multi-statement TVFs or scalar UDFs.

### Creating and calling an inline TVF

*A function that returns the latest price row for a given symbol.*

#### CREATE FUNCTION RETURNS TABLE

*Define the function with a single `RETURN (SELECT ...)` body — no `BEGIN`, no `END`, no intermediate variables.*

```sql
CREATE FUNCTION dbo.fn_latest_price_for_symbol (@symbol varchar(20))
RETURNS TABLE
AS
RETURN
(
    SELECT TOP (1) symbol, [date], [close]
    FROM silver.eurostoxx50_ohlcv
    WHERE symbol = @symbol
    ORDER BY [date] DESC
);
```

> [!info]- Inline TVF anatomy
>
> - `RETURNS TABLE` — signals an inline TVF; there is no column list here because the shape is inferred from the inner `SELECT`.
> - `AS RETURN ( <single SELECT> )` — the entire body is one parenthesised `SELECT`; no local variables, no `BEGIN/END`, no flow control.
> - The optimizer inlines this definition into the caller, so the plan looks as if the body was pasted directly into the calling query.

#### Calling an inline TVF

*Invoke the function like a table in the `FROM` clause, passing the parameter in parentheses.*

```sql
SELECT * FROM dbo.fn_latest_price_for_symbol('SAP.DE');
```

| symbol | date | close |
|---|---|---|
| SAP.DE | 2026-04-07 | 145.22 |

#### CROSS APPLY with an inline TVF

*The classic pattern — call the function once per row of an outer rowset.*

```sql
SELECT d.symbol, x.[date], x.[close]
FROM (VALUES ('SAP.DE'), ('ASML.AS'), ('MC.PA')) AS d(symbol)
CROSS APPLY dbo.fn_latest_price_for_symbol(d.symbol) AS x;
```

| symbol | date | close |
|---|---|---|
| SAP.DE | 2026-04-07 | 145.22 |
| ASML.AS | 2026-04-07 | 1113.8 |
| MC.PA | 2026-04-07 | 466.85 |

The `CROSS APPLY` operator invokes the inline TVF once for every row of the outer rowset and concatenates the results. Because the inline TVF is inlined into the plan, the whole query compiles into a single efficient join — there is no per-row function-call overhead.

> [!success] Inline TVFs are the right way to share query logic
>
> Compared to the alternatives:
>
> - **vs views**: inline TVFs accept parameters; views do not.
> - **vs multi-statement TVFs**: inline TVFs are inlined; multi-statement TVFs are opaque boxes with a fixed cardinality estimate.
> - **vs scalar UDFs**: inline TVFs run inside the set-based plan; scalar UDFs (prior to SQL 2019 inlining) ran row-by-row.

### Multi-statement TVFs — the anti-pattern

*Why `RETURNS @t TABLE ... BEGIN ... END` functions should be avoided in new code.*

A multi-statement TVF wraps a table variable declaration, imperative statements, and an `INSERT INTO @t` block inside `BEGIN ... END`. It looks more flexible than an inline TVF, but it pays a heavy price:

- The function body is opaque to the outer query's optimizer. Its output is treated as a black box.
- The cardinality estimate is a fixed constant (100 rows prior to SQL 2014, 1 row from SQL 2014 onward) regardless of the actual output.
- Calls are not inlined — they are invoked in a separate execution context.
- Nesting a multi-statement TVF inside a join almost always produces a poor plan.

> [!failure] Avoid multi-statement TVFs in new code
>
> Rewrite them as:
>
> - An **inline TVF** — almost every multi-statement TVF can be collapsed into a single `RETURN (SELECT ...)`.
> - A **stored procedure** — if the logic is genuinely imperative, a procedure is more honest and does not pretend to be a table.
> - A **CTE** or **temp table** inlined into the calling query — if the reuse across queries is minimal.

Starting with SQL Server 2019, some scalar UDFs and multi-statement TVFs are inlined automatically by the optimizer (the **Scalar UDF Inlining** and **TVF Inlining** features). These features significantly improve the performance of legacy code, but they are not a license to write new multi-statement TVFs: inline TVFs remain the clearest, most performant shape.

## Table-Valued Parameters

> [!abstract] Caller-supplied rowsets
>
> A **table-valued parameter** (TVP) is a strongly-typed way for a caller — another T-SQL batch, or an application using ADO.NET / JDBC — to hand a rowset to a stored procedure or function. TVPs replace the old pattern of repeated singleton inserts followed by a procedure call with a single batched round-trip, and they express the caller/callee contract cleanly in the procedure's signature.
>
> TVPs always use a user-defined table type, and they are always `READONLY` inside the procedure.

### User-defined table type

*The schema object that defines the TVP's shape.*

#### CREATE TYPE ... AS TABLE

*Create a named type that acts like a reusable table schema.*

```sql
CREATE TYPE dbo.SymbolList AS TABLE
(
    symbol varchar(20) PRIMARY KEY
);
```

> [!info]- User-defined table type anatomy
>
> - `CREATE TYPE ... AS TABLE` — creates a reusable schema definition in the database; it is not a table, it is a type that can be used wherever a table variable declaration is allowed.
> - `PRIMARY KEY` inside a UDTT creates the clustered index on every instance of the type.
> - The type cannot be altered once it is referenced by a procedure; you must drop every referencing object, drop the type, and recreate it. This is the single biggest operational constraint on TVPs.

### Procedure with a TVP

*A stored procedure that accepts a list of symbols and returns the latest price for each.*

#### CREATE PROCEDURE ... READONLY

*The `READONLY` keyword is required on every TVP parameter.*

```sql
CREATE PROCEDURE dbo.usp_get_latest_prices
    @symbols dbo.SymbolList READONLY
AS
BEGIN
    SET NOCOUNT ON;
    SELECT p.symbol, p.[date], p.[close]
    FROM silver.eurostoxx50_ohlcv AS p
    JOIN @symbols AS s ON s.symbol = p.symbol
    JOIN
    (
        SELECT symbol, MAX([date]) AS latest_date
        FROM silver.eurostoxx50_ohlcv
        GROUP BY symbol
    ) AS l
        ON l.symbol = p.symbol AND l.latest_date = p.[date];
END;
```

> [!info]- TVP procedure anatomy
>
> - `@symbols dbo.SymbolList READONLY` — the parameter's type is the UDTT; `READONLY` is mandatory (see the next H4 for why).
> - Inside the procedure, `@symbols` is referenced exactly like any table variable of that type.
> - The procedure body joins `@symbols` to the underlying `silver.eurostoxx50_ohlcv` table and filters to the latest date per symbol.

#### Invoking the procedure

*Declare a variable of the TVP type, populate it, and pass it to `EXEC`.*

```sql
DECLARE @in dbo.SymbolList;
INSERT INTO @in (symbol) VALUES ('SAP.DE'), ('ASML.AS'), ('MC.PA');
EXEC dbo.usp_get_latest_prices @symbols = @in;
```

| symbol | date | close |
|---|---|---|
| ASML.AS | 2026-04-07 | 1113.8 |
| MC.PA | 2026-04-07 | 466.85 |
| SAP.DE | 2026-04-07 | 145.22 |

The three symbols are passed as a single batched parameter; the procedure returns the latest-price row for each one in a single result set.

#### READONLY is not negotiable

*Attempting to create a procedure that modifies a TVP fails at compile time.*

```sql
CREATE PROCEDURE dbo.usp_mutate_tvp
    @symbols dbo.SymbolList READONLY
AS
BEGIN
    INSERT INTO @symbols (symbol) VALUES ('NEW');
END;
```

```text
('42000', '[42000] [Microsoft][ODBC Driver 18 for SQL Server][SQL Server]The table-valued parameter "@symbols" is READONLY and cannot be modified. (10700) (SQLExecDirectW)')
```

> [!failure] TVPs cannot be modified inside the procedure
>
> The `READONLY` keyword is not advisory — it is enforced at compile time. Every `INSERT`, `UPDATE`, `DELETE`, or `MERGE` against the TVP produces error 10700. If you need a writable local rowset, copy the TVP into a local table variable at the top of the procedure body and work with the copy.

### Calling TVPs from application code

*How a C# application on top of ADO.NET passes a `DataTable` as a TVP argument.*

TVPs are not just a T-SQL construct — their primary value is that a managed client can populate a strongly-typed batch of rows and send it in a single round-trip. The ADO.NET pattern is `SqlDbType.Structured` on the parameter and a `DataTable` as the value:

```csharp
using var conn = new SqlConnection(connectionString);
await conn.OpenAsync();

var symbols = new DataTable();
symbols.Columns.Add("symbol", typeof(string));
symbols.Rows.Add("SAP.DE");
symbols.Rows.Add("ASML.AS");
symbols.Rows.Add("MC.PA");

using var cmd = new SqlCommand("dbo.usp_get_latest_prices", conn)
{
    CommandType = CommandType.StoredProcedure
};

var param = cmd.Parameters.AddWithValue("@symbols", symbols);
param.SqlDbType = SqlDbType.Structured;
param.TypeName = "dbo.SymbolList";

using var reader = await cmd.ExecuteReaderAsync();
// Read rows...
```

> [!tip] TVPs replace three older anti-patterns
>
> - **Repeated singleton INSERTs into a staging table** — one network round-trip per row; TVP collapses this to a single call.
> - **Comma-delimited string parameters with a T-SQL split function** — fragile, no type safety, hard to parameterize sensibly.
> - **Dynamic SQL with an `IN (...)` list built in application code** — SQL injection risk, plan cache pollution from parameterless `IN` lists.

> [!warning] Evolving a TVP type is painful
>
> Altering a user-defined table type that is referenced by an existing procedure requires dropping every referencing object, dropping and recreating the type, then recreating every object. In long-lived systems the usual pattern is to introduce a new versioned type (`dbo.SymbolList_v2`) rather than modifying the existing one.

## Decision Matrix

> [!abstract] Choosing the right intermediate shape
>
> Every section in this note is an answer to the same question: *where should I put this intermediate rowset?* The table below summarizes the trade-offs so you can pick the right shape on the first try. Read the rows for the properties that matter most to your use case, then pick the shape that ticks every column.

| Shape | Scope | Statistics | Indexable | Rollback-affected | Recompile-friendly | Parallel DML | Best fit |
|---|---|---|---|---|---|---|---|
| Derived table | Single statement | Via inlined stats | No | N/A | N/A | Yes | One-off aggregate/filter |
| `VALUES` constructor | Single statement | No | No | N/A | N/A | Yes | Inline fixtures and lookups |
| CTE | Single statement | Via inlined stats | No | N/A | N/A | Yes | Naming stages, recursion |
| Recursive CTE | Single statement | Pipelined | No | N/A | N/A | No | Hierarchy / date spine |
| `#temp` table | Session (or procedure) | Yes | Yes | Yes | Yes | Yes | Multi-statement materialization |
| `##temp` table | Global across sessions | Yes | Yes | Yes | Yes | Yes | Cross-session orchestration |
| `@table` variable | Batch / procedure | No (1-row estimate) | Partial | No | Only via `OPTION (RECOMPILE)` | No | Small rowsets, TVF returns |
| Inline TVF | Statement-level inlining | Via caller | Yes (on source) | N/A | N/A | Yes | Parameterized reusable query |
| Multi-statement TVF | Opaque box | Fixed 1 or 100 | No | N/A | No | No | Avoid in new code |
| TVP | Procedure parameter | No (1-row estimate) | No | No | Only via `OPTION (RECOMPILE)` | No | Caller-supplied batches |

## Practical Guidance

> [!tip] Defaults for new code
>
> - **Start with a CTE** to name one stage of a single statement. It is free and readable.
> - **Switch to a `#temp` table** the moment the intermediate needs to span more than one statement, exceeds a few thousand rows, or would benefit from an index.
> - **Use a table variable** for small parameter-like rowsets, for TVF return types, and for state that must survive `ROLLBACK`.
> - **Use an inline TVF** when the same parameterized query is needed from more than one calling site.
> - **Use a TVP** when a caller (application or another procedure) needs to supply a batch of rows.
> - **Use a recursive CTE** for hierarchy walks and tiny date spines; prefer a persistent calendar table for operational code.
> - **Avoid multi-statement TVFs and global temp tables** in new code unless you have a reason you can defend at a code review.

> [!warning] Production-grade checklist
>
> Before shipping any intermediate-rowset code:
>
> - Have you verified the row count for the real workload, not just the test data?
> - If you picked a table variable, have you measured the plan with production-sized input?
> - If you picked a `#temp` table, does it live long enough to benefit from statistics, and does it drop cleanly on every error path?
> - If you picked a TVP, is the UDTT versioned in case the schema needs to change?
> - If you picked a recursive CTE, is the termination condition bounded by data rather than by a constant?
