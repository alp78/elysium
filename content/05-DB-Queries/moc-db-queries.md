---
title: "MOC: Database Queries"
tags:
  - moc
  - sql
  - bigquery
  - sql-server
---

# MOC: Database Queries

Executable query references with rendered cell outputs — every query has been run and its results are shown inline. All SQL notebooks use the same stoxx Euro Stoxx 50 medallion-architecture database, so patterns translate directly between engines. Firestore notebooks cover document-oriented operations in both Python and C#.

## SQL Fundamentals and Advanced Patterns — Querying Data

Core SQL through advanced analytical patterns. Fundamentals cover SELECT, JOINs, aggregation, and CTEs. Advanced notebooks add window functions, PIVOT/UNPIVOT, recursive CTEs, MERGE, JSON handling, and set operations.

* [[sql-fundamentals]] — T-SQL SELECT, filtering, JOINs across medallion layers, basic window functions, CTEs, subqueries, and data quality checks

* [[bq-fundamentals]] — BigQuery Standard SQL SELECT, arrays/structs/UNNEST, BigQuery-specific functions (SAFE_CAST, COUNTIF, ANY_VALUE), and medallion-layer JOINs

* [[sql-advanced]] — T-SQL window frames (PERCENT_RANK, CUME_DIST, running totals), recursive CTEs, CROSS/OUTER APPLY, PIVOT/UNPIVOT, MERGE, grouping sets, and temp table trade-offs

* [[bq-advanced]] — BigQuery window functions, approximate aggregation (HLL_COUNT), scripting with DECLARE/LOOP, JavaScript UDFs, JSON extraction, geospatial queries, and BQML

## Database Engineering — Objects, Performance, and Security

Database objects and operational patterns: views, stored procedures, UDFs, indexing, partitioning, DML quotas, INFORMATION_SCHEMA introspection, and transaction isolation.

* [[sql-engineering]] — T-SQL views, stored procedures, scalar/table-valued UDFs, clustered/columnstore indexes, SCD Type 1 and 2, execution plans, transaction isolation, and bulk loading

* [[bq-engineering]] — BigQuery partitioning and clustering, materialized views, DML quotas, INFORMATION_SCHEMA job/cost analysis, authorized views, row/column-level security, and scripting patterns

## NoSQL — Firestore Document Operations

Firestore CRUD, queries, transactions, batches, real-time listeners, subcollections, pagination, and collection group queries against the stoxx dataset.

* [[firestore-python]] — Python SDK for Firestore reads, writes, filtering, ordering, nested fields, array queries, batch operations, transactions, real-time listeners, and aggregation

* [[firestore-csharp]] — C# SDK and REST API for Firestore CRUD, typed document mapping, batch writes, transactions, snapshots, and the .NET 10 SDK read workaround

## Cross-References

- [[moc-sql-server|SQL Server]] — Administration, backup, restore, security, and high availability
- [[gcp-billing-and-pricing]] — Per-TB pricing for BigQuery queries and storage
- [[dimensional-modeling]] — Star and snowflake schema design patterns
- [[data-modeling-patterns]] — Reusable schema patterns across engines

- [[data-warehouse-architecture]] — When to use SQL Server vs BigQuery
- [[16_py_database|Python Database]] — Python connection and query patterns
