---
type: index
category: db-queries
technology: [sql-server, bigquery, firestore]
tags: [sql, bigquery, firestore]
aliases: [DB Queries Index, Database Queries, Query Reference]
keywords: [sql queries, bigquery queries, firestore queries, t-sql, standard sql, nosql, select, join, window functions, cte, partitioning, transactions, real-time]
description: "Index for the DB Queries section — executable query references for SQL Server, BigQuery, and Firestore with rendered cell outputs showing actual results."
related:
  - "[[index|Elysium]]"
  - "[[sql-server-index]]"
  - "[[gcp-index]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# DB Queries

Executable query references with **rendered cell outputs** — every query has been run and its results are shown inline. These are converted Jupyter notebooks preserving both the query code and the actual output, so you can see exactly what each statement returns.

## SQL Server (T-SQL)

Query patterns for SQL Server, from basics through advanced analytics to engineering concerns. See [[sql-server-index|SQL Server]] for administration, performance, and architecture notes.

| Note | Description |
|------|-------------|
| [[sql-fundamentals]] | SELECT, filtering, joins (INNER/LEFT/RIGHT/FULL/CROSS), aggregation (GROUP BY, HAVING), subqueries, set operations (UNION, INTERSECT, EXCEPT), CASE expressions, NULL handling |
| [[sql-advanced]] | Window functions (ROW_NUMBER, RANK, LAG, LEAD, running totals, moving averages), CTEs (recursive and non-recursive), PIVOT/UNPIVOT, CROSS APPLY/OUTER APPLY, JSON (FOR JSON, OPENJSON), temporal queries |
| [[sql-engineering]] | Transactions (isolation levels, TRY/CATCH), temp tables vs table variables, dynamic SQL, stored procedures, user-defined functions, indexing strategies, query hints, SET STATISTICS, execution plan analysis |

## BigQuery (Standard SQL)

Query patterns for Google BigQuery, from fundamentals through advanced analytics to cost-conscious engineering. See [[gcp-index|GCP]] for BigQuery administration and [[gcp-billing-and-pricing]] for cost details.

| Note | Description |
|------|-------------|
| [[bq-fundamentals]] | Standard SQL basics, BigQuery-specific data types, arrays and STRUCTs, UNNEST, date/time functions, string functions, SAFE_CAST, COUNTIF, ANY_VALUE, EXCEPT/REPLACE syntax |
| [[bq-advanced]] | Analytic/window functions, approximate aggregation (HLL_COUNT, APPROX_QUANTILES), scripting (DECLARE, LOOP), JSON functions, geospatial (ST_GEOGPOINT), BQML (ML.PREDICT), JavaScript UDFs |
| [[bq-engineering]] | Partitioning (time, range, ingestion), clustering, DML (INSERT/UPDATE/DELETE/MERGE), INFORMATION_SCHEMA queries, slot usage analysis, cost optimization, materialized views, external tables, row/column-level security, authorized views |

## Firestore (NoSQL)

Document database operations in both Python and C#. See [[firestore-data-model-and-operations]] for architecture and data modeling patterns.

| Note | Description |
|------|-------------|
| [[firestore-python]] | Python SDK: CRUD operations, queries (where, order_by, limit), compound queries, array_contains, subcollections, batch writes, transactions, real-time listeners (on_snapshot), pagination |
| [[firestore-csharp]] | C# SDK: CRUD with typed models, queries, DocumentReference/CollectionReference, WriteBatch, transactions, snapshots, FieldValue operations, async patterns |

## Cross-References

- **SQL Server administration** — [[sql-server-index]] for backup, restore, security, HA
- **BigQuery cost** — [[gcp-billing-and-pricing]] for per-TB pricing, [[gcp-cost-monitoring-and-budgets]] for budget alerts
- **Data modeling** — [[dimensional-modeling]] and [[data-modeling-patterns]] for schema design
- **Comparison** — [[sql-python-csharp-transforms]] for side-by-side transform syntax
- **Architecture** — [[data-warehouse-architecture]] for when to use SQL Server vs BigQuery
- **Programming languages** — [[15_py_database|Python Database]] and [[15_py_database|C# Database]] for connection patterns

> *This table renders in Obsidian via Dataview. On the web, browse the notes listed above or use the Explorer sidebar.*
