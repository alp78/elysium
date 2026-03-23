---
type: reference
category: data-architecture
technology: [sql-server, bigquery, python]
tags: [python, sql, bigquery]
aliases: [ETL vs ELT, extract transform load, extract load transform, ETL comparison]
keywords: [etl, elt, extract transform load, extract load transform, comparison, data pipeline, data warehouse, medallion architecture, bigquery, sql server]
description: "Comparison of ETL (Extract-Transform-Load) vs ELT (Extract-Load-Transform) patterns — when to use each, trade-offs, and how they map to the medallion architecture."
related:
  - "[[medallion-architecture]]"
  - "[[idempotent-pipeline-design]]"
  - "[[bronze-layer-loading]]"
  - "[[silver-transforms]]"
  - "[[gold-transforms]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# ETL vs ELT

Two fundamental patterns for moving and transforming data. The choice between them drives your architecture, tool selection, and cost profile.

## Comparison

| Dimension | ETL | ELT |
|-----------|-----|-----|
| **Transform location** | External process (Python, Spark, Airflow) | Inside the data warehouse (SQL) |
| **Load sequence** | Extract → Transform → Load | Extract → Load → Transform |
| **Raw data preserved?** | No (only transformed data reaches the warehouse) | Yes (raw data lands first, transforms happen in-place) |
| **Compute cost** | Application server CPU | Warehouse compute (BigQuery slots, SQL Server CPU) |
| **Best for** | Complex transformations, API enrichment, ML preprocessing | SQL-native transforms, large-scale aggregation, warehouse-native operations |
| **Medallion mapping** | Transform happens outside the warehouse | Bronze = raw load, Silver/Gold = SQL transforms |
| **Debugging** | Harder (intermediate state in memory/logs) | Easier (intermediate layers are queryable tables) |
| **Schema flexibility** | High (code handles any structure) | Moderate (warehouse schema must accommodate raw data) |

## When to Use ETL

- Transformations require external APIs, ML models, or complex Python logic
- Data must be cleaned/validated before it enters the warehouse
- The warehouse has limited compute and you want to offload processing
- You are working with unstructured data (images, PDFs, raw text)

## When to Use ELT

- Most transformations are SQL-expressible (joins, aggregations, window functions)
- You want to preserve raw data for audit and reprocessing ([[idempotent-pipeline-design|idempotency]])
- The warehouse has elastic compute (BigQuery auto-scales, SQL Server has headroom)
- Multiple teams need different views of the same raw data

## Hybrid ETL/ELT in Practice

The the pipeline steps uses a hybrid approach:

1. **ETL phase** — Python extracts from yfinance API, transforms JSON into tabular format, loads into [[bronze-layer-loading|bronze layer]]
2. **ELT phase** — SQL transforms bronze → [[silver-transforms|silver]] → [[gold-transforms|gold]] inside SQL Server

This hybrid leverages Python's strengths (API calls, JSON parsing) and SQL's strengths (joins, aggregations, window functions).

## Related

- [[medallion-architecture]] — Bronze/Silver/Gold is inherently an ELT pattern
- [[idempotent-pipeline-design]] — Both ETL and ELT must be idempotent
