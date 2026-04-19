---
title: "04 - Common Table Expressions and Temporary Objects"
tags:
  - postgresql
  - query-optimization
  - sql
aliases:
  - PostgreSQL CTE reference
  - PostgreSQL temp tables
  - PostgreSQL unlogged tables
  - PostgreSQL set-returning functions
description: "PostgreSQL reference for inline rowsets, common table expressions, recursive CTEs, temporary tables, unlogged tables, SQL functions that return tables, and PostgreSQL patterns that replace SQL Server table variables and TVPs."
parent: "[[domain-postgresql-query-writing-and-optimization]]"
links:
  - "[[03-postgresql-joins-subqueries-and-lateral]]"
  - "[[05-postgresql-window-functions]]"
status: complete
---

# Common Table Expressions and Temporary Objects

Intermediate rowsets in PostgreSQL are a scope and optimizer decision, not only a formatting choice. Some shapes exist for one statement only, some survive for the session, some are reusable abstractions, and some are the PostgreSQL replacement for SQL Server features that do not exist here, such as table variables, global temp tables, and table-valued parameters.

> [!abstract] Scope
>
> This note mirrors the SQL Server intermediate-rowset track with PostgreSQL equivalents. It covers derived tables, `VALUES` constructors, non-recursive and recursive CTEs, temporary tables, unlogged tables, set-returning SQL functions, and caller-supplied batch patterns built from arrays and `unnest`.
>
> - **Inline rowsets** cover derived tables and `VALUES` constructors for one-statement work.
> - **Statement-local naming** covers CTEs, single-statement scope, and PostgreSQL's `MATERIALIZED` or `NOT MATERIALIZED` control.
> - **Recursive CTEs** cover bounded sequence generation and hierarchy traversal.
> - **Materialized scratch objects** cover temporary tables and unlogged tables, including where PostgreSQL differs from SQL Server temp-table features.
> - **Reusable parameterized rowsets** cover SQL functions that return tables and array-driven batch input as the nearest PostgreSQL analogue to TVPs.

## Inline Intermediate Rowsets

The lightest-weight intermediate shape is still an inline rowset. Use it when the data is consumed once, inside one statement, and there is no need for indexing, reuse, or cross-statement scope.

### Derived tables and `VALUES`

Derived tables let the outer query consume a named inline subquery. `VALUES` constructors provide a literal rowset. Both disappear as soon as the statement finishes.

#### Use a derived table when one statement needs an inline aggregate stage

Use this pattern when the query needs one intermediate aggregate or filter and the result does not need to survive beyond the statement. It is typically triggered by compact reporting queries and ad-hoc analysis. The query is read-only. Its purpose is to show the PostgreSQL equivalent of "compute an inline rowset, then filter the projected result."

| Field | Source | Type | Meaning |
|---|---|---|---|
| `sector` | `gold.scores_daily.sector` | varchar | Sector label of the aggregated scoring slice. |
| `avg_composite_score` | derived `AVG(composite_score)` | numeric | Average composite score for the sector on the latest score date. |

*This query aggregates the latest scores by sector in a derived table and then filters the derived result.*

```sql
SELECT
    sector,
    avg_composite_score
FROM (
    SELECT
        sector,
        ROUND(AVG(composite_score)::numeric, 4) AS avg_composite_score
    FROM gold.scores_daily
    WHERE score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
    GROUP BY sector
) AS x
WHERE avg_composite_score > 0.05
ORDER BY avg_composite_score DESC, sector
LIMIT 8;
```

| sector | avg_composite_score |
|---|---:|
| Technology | 0.1594 |
| Basic Materials | 0.0891 |
| Healthcare | 0.0718 |
| Energy | 0.0642 |
| Industrials | 0.0530 |

The outer query can only see the columns projected by `x`. That is the defining scope boundary of a derived table: once the inner query has projected and aliased its rowset, the outer query works against that projection rather than the original base columns.

#### Use a `VALUES` constructor for tiny literal rowsets

Use `VALUES` when the rowset is tiny, fixed at authoring time, and specific to one query. It is typically triggered by small lookup maps, test fixtures, and one-off label sets. The query is read-only. Its purpose is to show the clean PostgreSQL pattern for an inline literal table.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | inline `VALUES` rowset | text | Symbol key supplied by the literal mapping. |
| `label` | inline `VALUES` rowset | text | Human-readable label paired with the symbol. |
| `composite_score` | `gold.scores_daily.composite_score` | numeric | Latest composite score for that symbol. |

*This query builds a three-row inline lookup table and joins it to the latest live score rows.*

```sql
SELECT
    v.symbol,
    v.label,
    ROUND(s.composite_score::numeric, 4) AS composite_score
FROM (
    VALUES
        ('ASML.AS', 'Semicap leader'),
        ('BNP.PA', 'Banking leader'),
        ('TTE.PA', 'Energy major')
) AS v(symbol, label)
JOIN gold.scores_daily AS s
  ON s.symbol = v.symbol
WHERE s.score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
ORDER BY v.symbol;
```

| symbol | label | composite_score |
|---|---|---:|
| ASML.AS | Semicap leader | 0.0156 |
| BNP.PA | Banking leader | 0.5967 |
| TTE.PA | Energy major | 0.4954 |

This is usually clearer than a long `CASE` expression or a throwaway persistent lookup table. The mapping stays next to the query that uses it.

## Common Table Expressions

CTEs name statement-local rowsets. In PostgreSQL they are not temp tables, and they do not automatically imply physical materialization. Their value is readability, staged transformation, and in recursive form, bounded iterative logic.

### Statement-local named rowsets

A `WITH` clause attaches one or more auxiliary statements to the immediately following statement. PostgreSQL 16 also lets the author control whether a CTE is forced to materialize or allowed to inline with `MATERIALIZED` and `NOT MATERIALIZED`.

#### Chain CTE stages when one statement has multiple readable steps

Use chained CTEs when a single query has several conceptual stages and naming those stages makes the transformation easier to reason about. It is typically triggered by scoring, filtering, and pre-aggregation pipelines. The query is read-only. Its purpose is to show that a CTE is a statement-local naming tool, not a persistent object.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | `gold.scores_daily.symbol` | varchar | Symbol from the latest score slice. |
| `sector` | `gold.scores_daily.sector` | varchar | Sector classification carried through the pipeline. |
| `composite_score` | `gold.scores_daily.composite_score` | numeric | Rounded score after the first CTE stage has isolated the current slice. |
| `composite_rank` | `gold.scores_daily.composite_rank` | smallint | Existing rank for the latest score row. |

*This query uses one CTE to isolate the latest USA scoring slice and a second CTE to keep only positive high-signal rows.*

```sql
WITH latest_scores AS (
    SELECT
        symbol,
        sector,
        composite_score,
        composite_rank
    FROM gold.scores_daily
    WHERE score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
      AND _index = 'stoxx_usa_50'
),
ranked_scores AS (
    SELECT
        symbol,
        sector,
        ROUND(composite_score::numeric, 4) AS composite_score,
        composite_rank
    FROM latest_scores
    WHERE composite_score IS NOT NULL
      AND composite_score > 0.20
)
SELECT
    symbol,
    sector,
    composite_score,
    composite_rank
FROM ranked_scores
ORDER BY composite_rank
LIMIT 5;
```

| symbol | sector | composite_score | composite_rank |
|---|---|---:|---:|
| MU | Technology | 1.3617 | 1 |
| AMD | Technology | 0.5408 | 2 |
| AVGO | Technology | 0.5251 | 3 |
| AMZN | Consumer Cyclical | 0.4947 | 4 |
| NVDA | Technology | 0.4905 | 5 |

This query reads top to bottom like a pipeline. That is the main reason to use a non-recursive CTE in PostgreSQL.

#### A CTE exists for one statement only

Use this example when explaining scope boundaries or debugging "relation does not exist" errors after a `WITH` query has already finished. It is typically triggered by authors who expect a CTE to behave like a temp table. The first statement is read-only and succeeds; the second statement fails because the CTE name no longer exists. Its purpose is to make the one-statement scope rule concrete.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `n` | literal `1 AS n` inside `one_row` | integer | Column projected by the statement-local CTE. |

*This pair of statements shows that the CTE name is valid only for the statement immediately following `WITH`.*

```sql
WITH one_row AS (
    SELECT 1 AS n
)
SELECT n FROM one_row;

SELECT n FROM one_row;
```

```text
 n
---
 1
(1 row)

ERROR:  relation "one_row" does not exist
LINE 1: SELECT n FROM one_row;
                      ^
```

That second statement fails because `one_row` was never a real relation. PostgreSQL discarded the CTE as soon as the first `SELECT` completed.

#### PostgreSQL can inline or force materialization explicitly

Use this pattern when the same CTE is referenced more than once or when plan shape depends on whether the intermediate rowset should be produced once and reused versus pushed down into each reference site. It is typically triggered during performance tuning and plan review. The commands are read-only `EXPLAIN` statements. Their purpose is to show PostgreSQL's CTE-specific optimizer control, which differs from SQL Server's CTE behavior.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `recent` | CTE over `gold.index_performance` | rowset | Recent performance slice used twice by the outer query. |
| `MATERIALIZED` | CTE modifier | keyword | Forces PostgreSQL to build the intermediate rowset once before consumers read it. |
| `NOT MATERIALIZED` | CTE modifier | keyword | Allows PostgreSQL to inline the CTE into each consumer when profitable. |

*This `EXPLAIN` forces the CTE to materialize once and then scans the produced rowset twice.*

```sql
EXPLAIN (COSTS OFF)
WITH recent AS MATERIALIZED (
    SELECT _index, perf_date, daily_return
    FROM gold.index_performance
    WHERE perf_date >= DATE '2026-04-02'
)
SELECT COUNT(*)
FROM recent AS r1
JOIN recent AS r2
  ON r1._index = r2._index
WHERE r2.perf_date = DATE '2026-04-07';
```

```text
Aggregate
  CTE recent
    ->  Seq Scan on index_performance
          Filter: (perf_date >= '2026-04-02'::date)
  ->  Hash Join
        Hash Cond: ((r1._index)::text = (r2._index)::text)
        ->  CTE Scan on recent r1
        ->  Hash
              ->  CTE Scan on recent r2
                    Filter: (perf_date = '2026-04-07'::date)
```

*This `EXPLAIN` permits inlining, so PostgreSQL can push filters directly into the base-table scans instead of reading a prebuilt CTE result.*

```sql
EXPLAIN (COSTS OFF)
WITH recent AS NOT MATERIALIZED (
    SELECT _index, perf_date, daily_return
    FROM gold.index_performance
    WHERE perf_date >= DATE '2026-04-02'
)
SELECT COUNT(*)
FROM recent AS r1
JOIN recent AS r2
  ON r1._index = r2._index
WHERE r2.perf_date = DATE '2026-04-07';
```

```text
Aggregate
  ->  Nested Loop
        Join Filter: ((index_performance._index)::text = (index_performance_1._index)::text)
        ->  Seq Scan on index_performance index_performance_1
              Filter: ((perf_date >= '2026-04-02'::date) AND (perf_date = '2026-04-07'::date))
        ->  Seq Scan on index_performance
              Filter: (perf_date >= '2026-04-02'::date)
```

The first plan has a named `CTE recent` section and two `CTE Scan` consumers. The second plan has no `CTE Scan` at all because PostgreSQL pushed the work back into the base-table scans. That is the practical difference between CTE naming and CTE materialization control.

## Recursive CTEs

Recursive CTEs are PostgreSQL's general SQL mechanism for iterative row production. They are most useful for hierarchies and bounded recursive expansion. For simple sequences and date ranges, PostgreSQL often has a more direct function such as `generate_series`, but recursive CTEs are still important because they generalize beyond simple series generation.

### Iterative rowsets with a real termination condition

A recursive CTE always has an anchor term, a recursive term, and a stop condition that eventually yields no new rows. PostgreSQL evaluates these queries iteratively even though the SQL is written recursively.

#### Generate a bounded date spine with `WITH RECURSIVE`

Use this pattern when the next row depends on the previous row and the range is intentionally small and bounded. It is typically triggered by teaching recursion, bounded calendar expansion, or engines where a series generator is unavailable. The query is read-only. Its purpose is to show the canonical anchor-plus-recursive-member shape.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `d` | recursive CTE column | date | Current generated date in the bounded spine. |

> [!info] Prefer `generate_series` for simple ranges
>
> PostgreSQL has a native set-returning function, `generate_series`, that is usually simpler and faster for straight numeric or date ranges. Recursive CTEs are still the general tool when each iteration depends on state from the prior iteration or when the recursive shape is not a simple sequence.

*This query starts at `2026-04-02` and adds one day at a time until the explicit stop condition is reached.*

```sql
WITH RECURSIVE date_spine(d) AS (
    VALUES (DATE '2026-04-02')
  UNION ALL
    SELECT d + 1
    FROM date_spine
    WHERE d < DATE '2026-04-07'
)
SELECT d
FROM date_spine;
```

| d |
|---|
| 2026-04-02 |
| 2026-04-03 |
| 2026-04-04 |
| 2026-04-05 |
| 2026-04-06 |
| 2026-04-07 |

The termination rule is `WHERE d < DATE '2026-04-07'`. Without a real stop condition, the recursive member would continue generating rows until PostgreSQL exhausted resources or the author added explicit cycle protection.

#### Traverse a hierarchy and keep the path

Use a recursive CTE for hierarchical walks when each row needs to discover its children based on the prior level's output. It is typically triggered by org charts, bill-of-materials trees, lineage traversal, and parent-child navigation. The query is read-only. Its purpose is to show a hierarchy walk that also records path order for stable output.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `employee_id` | inline employee rowset | integer | Employee key in the hierarchy. |
| `manager_id` | inline employee rowset | integer | Parent employee key; `NULL` marks the root. |
| `full_name` | inline employee rowset | text | Employee name carried through the traversal. |
| `depth` | recursive expression | integer | Distance from the root node. |
| `path` | recursive array expression | integer[] | Traversal path used for stable parent-before-child ordering. |

*This query walks an inline org chart from the root manager downward and records both level and path.*

```sql
WITH RECURSIVE employees(employee_id, manager_id, full_name) AS (
    VALUES
        (1, NULL::int, 'Amelia Reed'),
        (2, 1, 'Ravi Bhat'),
        (3, 1, 'Mei Tanaka'),
        (4, 2, 'Sofia Marchetti'),
        (5, 2, 'Luca Moretti'),
        (6, 3, 'Hannah Okafor'),
        (7, 3, 'Pablo Fernandez')
),
org(employee_id, manager_id, full_name, depth, path) AS (
    SELECT employee_id, manager_id, full_name, 0, ARRAY[employee_id]
    FROM employees
    WHERE manager_id IS NULL
  UNION ALL
    SELECT
        e.employee_id,
        e.manager_id,
        e.full_name,
        o.depth + 1,
        o.path || e.employee_id
    FROM employees AS e
    JOIN org AS o
      ON e.manager_id = o.employee_id
)
SELECT
    employee_id,
    manager_id,
    full_name,
    depth,
    path
FROM org
ORDER BY path;
```

| employee_id | manager_id | full_name | depth | path |
|---:|---:|---|---:|---|
| 1 |  | Amelia Reed | 0 | {1} |
| 2 | 1 | Ravi Bhat | 1 | {1,2} |
| 4 | 2 | Sofia Marchetti | 2 | {1,2,4} |
| 5 | 2 | Luca Moretti | 2 | {1,2,5} |
| 3 | 1 | Mei Tanaka | 1 | {1,3} |
| 6 | 3 | Hannah Okafor | 2 | {1,3,6} |
| 7 | 3 | Pablo Fernandez | 2 | {1,3,7} |

The path array makes the output stable and readable. PostgreSQL 16 also supports `SEARCH DEPTH FIRST` and `SEARCH BREADTH FIRST` syntax for ordered recursive output, but the explicit path technique remains widely readable and portable.

## Materialized Scratch Objects

When the rowset must survive across statements, benefit from indexing, or be shared by later steps in the same session, PostgreSQL moves from inline syntax to real relations. The main options are temporary tables for session-local scratch work and unlogged tables for persistent but minimally durable staging.

### Session-local temp tables and broader-scope scratch tables

PostgreSQL has temporary tables, but it does not have SQL Server-style global temp tables or table variables. The nearest broader-scope analogue is an unlogged table, which is a real table visible to other sessions but skips WAL for the table's data.

#### Create a temp table, index it, and verify its temp schema placement

Use a temp table when the intermediate rowset spans multiple statements in the same session and benefits from indexing or manual `ANALYZE`. It is typically triggered by ETL staging, multi-step diagnostics, and expensive intermediate transforms that should not be recomputed. The script is state-changing inside a transaction and rolls back at the end. Its purpose is to show the lifecycle and catalog visibility of a PostgreSQL temp table.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | `gold.scores_daily.symbol` | varchar | Symbol copied into the temp rowset. |
| `composite_score` | `gold.scores_daily.composite_score` | numeric | Score materialized into the temp rowset. |
| `composite_rank` | `gold.scores_daily.composite_rank` | smallint | Rank value used for the temp-table index. |
| `schemaname` | `pg_tables.schemaname` | text | Temporary schema name chosen for the session. |
| `tablename` | `pg_tables.tablename` | text | Temp table name recorded in the session temp schema. |
| `indexname` | `pg_indexes.indexname` | text | Index name built against the temp table. |

*This transaction creates a temp table, adds an index, inspects its data and catalog placement, then rolls everything back.*

```sql
BEGIN;

CREATE TEMP TABLE note04_temp_scores
ON COMMIT DROP
AS
SELECT
    symbol,
    composite_score,
    composite_rank
FROM gold.scores_daily
WHERE score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
  AND _index = 'stoxx_usa_50'
ORDER BY composite_score DESC NULLS LAST
LIMIT 5;

CREATE INDEX note04_temp_scores_rank_idx
    ON note04_temp_scores (composite_rank);

ANALYZE note04_temp_scores;

SELECT
    symbol,
    ROUND(composite_score::numeric, 4) AS composite_score,
    composite_rank
FROM note04_temp_scores
ORDER BY composite_rank;

SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname LIKE 'pg_temp%'
  AND tablename = 'note04_temp_scores';

SELECT indexname
FROM pg_indexes
WHERE schemaname LIKE 'pg_temp%'
  AND tablename = 'note04_temp_scores'
ORDER BY indexname;

ROLLBACK;
```

```text
BEGIN
SELECT 5
CREATE INDEX
ANALYZE
```

| symbol | composite_score | composite_rank |
|---|---:|---:|
| MU | 1.3617 | 1 |
| AMD | 0.5408 | 2 |
| AVGO | 0.5251 | 3 |
| AMZN | 0.4947 | 4 |
| NVDA | 0.4905 | 5 |

| schemaname | tablename |
|---|---|
| pg_temp_3 | note04_temp_scores |

| indexname |
|---|
| note04_temp_scores_rank_idx |

```text
ROLLBACK
```

The temp table lived in a session-specific `pg_temp_*` schema, and its index was temporary as well. That is the main PostgreSQL temp-table model: session-local relation, real catalog entry, normal indexing, and explicit `ON COMMIT` behavior.

#### Use an unlogged table when scratch data must outlive one session

Use an unlogged table when the scratch object must be a real schema object visible to other sessions, but full crash durability is not required. It is typically triggered by transient staging, bulk-reload landing zones, and ETL work tables. The script is state-changing inside a transaction and rolls back at the end. Its purpose is to show the PostgreSQL replacement for "shared scratch table" scenarios that SQL Server users often try to model with global temp tables.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `schema_name` | `pg_namespace.nspname` | text | Schema that owns the created relation. |
| `relation_name` | `pg_class.relname` | text | Created scratch table name. |
| `relpersistence` | `pg_class.relpersistence` | char | Persistence code: `u` means unlogged. |

*This transaction creates an unlogged table, proves its persistence class in the catalog, and then rolls it back.*

```sql
BEGIN;

CREATE UNLOGGED TABLE demo_stc.note04_unlogged_demo AS
SELECT
    symbol,
    composite_rank
FROM gold.scores_daily
WHERE score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
ORDER BY composite_rank
LIMIT 3;

SELECT
    n.nspname AS schema_name,
    c.relname AS relation_name,
    c.relpersistence
FROM pg_class AS c
JOIN pg_namespace AS n
  ON n.oid = c.relnamespace
WHERE n.nspname = 'demo_stc'
  AND c.relname = 'note04_unlogged_demo';

ROLLBACK;
```

```text
BEGIN
SELECT 3
```

| schema_name | relation_name | relpersistence |
|---|---|---|
| demo_stc | note04_unlogged_demo | u |

```text
ROLLBACK
```

`u` means unlogged. That gives the table broader visibility than a temp table, but PostgreSQL can truncate unlogged tables after a crash because their data is not WAL-protected. They are a performance-oriented staging tool, not a durability feature.

## Reusable Parameterized Rowsets

Some intermediate rowsets deserve an interface rather than one-off inline SQL. In PostgreSQL that usually means a function that returns a table, or a caller-supplied batch encoded as an array, JSONB recordset, or temp staging table.

### SQL functions and batch-input patterns

PostgreSQL does not implement table-valued parameters. The practical substitutes are set-returning functions for reusable query logic and array or JSON expansion for small caller-supplied batches.

#### Package reusable rowset logic in a SQL function that returns a table

Use a SQL function returning `TABLE(...)` when the rowset logic should be reusable and parameterized, but still stay transparent and compact. It is typically triggered by repeated "top-N for key" or "latest slice for parameter" patterns. The statements are state-changing only within the session temp schema. Their purpose is to show the PostgreSQL equivalent of a lightweight reusable rowset abstraction.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | function output from `gold.scores_daily.symbol` | text | Returned symbol from the parameterized scoring slice. |
| `composite_score` | function output from `gold.scores_daily.composite_score` | numeric | Rounded composite score from the function body. |
| `composite_rank` | function output from `gold.scores_daily.composite_rank` | smallint | Rank emitted by the function body. |

*This session-local function returns the top scoring symbols for any requested index key and limit.*

```sql
CREATE OR REPLACE FUNCTION pg_temp.note04_top_scores(p_index text, p_limit int)
RETURNS TABLE(symbol text, composite_score numeric, composite_rank smallint)
LANGUAGE sql
AS $$
    SELECT
        s.symbol,
        ROUND(s.composite_score::numeric, 4) AS composite_score,
        s.composite_rank
    FROM gold.scores_daily AS s
    WHERE s._index = p_index
      AND s.score_date = (
          SELECT MAX(score_date)
          FROM gold.scores_daily
          WHERE _index = p_index
      )
    ORDER BY s.composite_score DESC NULLS LAST
    LIMIT p_limit
$$;

SELECT *
FROM pg_temp.note04_top_scores('euro_stoxx_50', 3);
```

```text
CREATE FUNCTION
```

| symbol | composite_score | composite_rank |
|---|---:|---:|
| BNP.PA | 0.5967 | 1 |
| TTE.PA | 0.4954 | 2 |
| ENI.MI | 0.4807 | 3 |

This is the PostgreSQL-friendly reusable-rowset pattern when the logic is query-shaped and parameterized. It is closer to an inline TVF than to a procedural temp-object pattern.

#### Use arrays and `unnest` when the caller needs to pass a small batch of keys

Use this pattern when the caller must supply a small in-memory batch of identifiers and the query should treat them as a rowset. It is typically triggered by API-driven point lookups, notebook filters, and application-side batches. The query is read-only. Its purpose is to show the most common PostgreSQL replacement for SQL Server TVP-style usage.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | `unnest(...)` output and join key | text | Caller-supplied symbol expanded into rows. |
| `composite_score` | `gold.scores_daily.composite_score` | numeric | Latest composite score for the supplied symbol. |
| `composite_rank` | `gold.scores_daily.composite_rank` | smallint | Rank associated with the supplied symbol. |

*This query expands an array into a rowset and joins it to the latest live score slice.*

```sql
WITH input_symbols AS (
    SELECT unnest(ARRAY['ASML.AS', 'BNP.PA', 'TTE.PA']) AS symbol
)
SELECT
    i.symbol,
    ROUND(s.composite_score::numeric, 4) AS composite_score,
    s.composite_rank
FROM input_symbols AS i
JOIN gold.scores_daily AS s
  ON s.symbol = i.symbol
WHERE s.score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
ORDER BY s.composite_rank;
```

| symbol | composite_score | composite_rank |
|---|---:|---:|
| BNP.PA | 0.5967 | 1 |
| TTE.PA | 0.4954 | 2 |
| ASML.AS | 0.0156 | 28 |

For small batches this is simple and effective. For larger batches or repeat use across multiple statements, a temp table or staged file load is usually the better boundary.

## Decision Guide

Choose the rowset shape by lifetime, optimizer needs, and calling boundary rather than habit.

| Need | PostgreSQL shape | Why |
|---|---|---|
| One inline aggregate or filter used once | Derived table | Minimal scope and no extra object lifecycle. |
| Tiny literal lookup set | `VALUES` constructor | Keeps small fixed mappings next to the query. |
| Multi-stage logic in one statement | Non-recursive CTE | Improves readability without forcing a temp object. |
| Hierarchy walk or bounded iterative expansion | Recursive CTE | Expresses anchor plus recursive member directly in SQL. |
| Reuse across statements in one session, with indexes or manual analyze | Temporary table | Real relation, session-local scope, normal indexing. |
| Shared scratch relation with lower durability | Unlogged table | Real schema object visible beyond one session, but crash-truncatable. |
| Reusable parameterized rowset logic | SQL function returning `TABLE(...)` | Packages query-shaped logic behind parameters. |
| Small caller-supplied batch of keys | Array plus `unnest` | Simple PostgreSQL-native replacement for TVP-style input. |
