---
type: concept
category: data-architecture
technology: [sql-server, python, pyodbc]
tags: [data-architecture, architecture, pipeline, medallion, python, sql]
aliases: [medallion architecture, bronze silver gold, bronze/silver/gold, data lakehouse, three layer architecture, medallion pattern]
keywords: [medallion architecture, bronze, silver, gold, raw data, cleaned data, analytics, pipeline, schema, layers, data warehouse, data-pipeline, sql server, pyodbc, parameterized queries]
description: "The medallion architecture (bronze/silver/gold) implemented in SQL Server — raw data landing, cleaning and deduplication, and analytics-ready aggregation across three schema layers."
related:
  - "[[idempotent-pipeline-design]]"
  - "[[bronze-layer-loading]]"
  - "[[silver-transforms]]"
  - "[[gold-transforms]]"
  - "the pipeline steps"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Medallion Architecture

The medallion architecture organizes data into three layers — bronze, silver, and gold — each with increasing quality, structure, and business value. This is the core data pattern for the the pipeline steps.

### Medallion Architecture Overview

| Layer | Schema | Purpose | Refresh |
|-------|--------|---------|---------|
| **Bronze** | `bronze.*` | Raw data, 1:1 with source JSON | Every pipeline run |
| **Silver** | `silver.*` | Cleaned, deduplicated, gap-filled | Derived from bronze |
| **Gold** | `gold.*` | Pre-computed analytics, dashboard-ready | Derived from silver |

**Pipeline flow:** yfinance API → JSON files → Bronze → Silver → Gold → Dashboard

### Medallion Technology Stack

- SQL Server (ODBC Driver 18)
- Python + [[bronze-layer-loading|pyodbc]] (parameterized queries, `?` placeholders)
- Pandas + NumPy for gold-layer analytics
- Dapper (C#) for dashboard reads

The medallion pattern aligns naturally with the ELT paradigm — raw data lands first, then transforms run inside the warehouse. In dbt projects, [[dbt-staging-models]] correspond to the bronze-to-silver transition, while [[dbt-mart-models]] produce the gold layer.

### Database Connection Pattern

All Python modules share a single connection factory with credentials from `.env`:

```python
# utils/db.py — creates pyodbc connections from .env config

def get_connection(autocommit=False, database=None):
    # Load .env from project root (SA_PASSWORD, SQL_HOST, etc.)
    env_path = Path(__file__).resolve().parent.parent / ".env"
    load_dotenv(env_path)

    host     = os.getenv("SQL_HOST", "localhost")      # SQL Server hostname
    port     = os.getenv("SQL_PORT", "1434")            # SQL Server port
    db       = database or os.getenv("SQL_DATABASE", "data-pipeline")  # target database
    user     = os.getenv("SQL_USER", "sa")              # SQL Server login
    password = os.getenv("SA_PASSWORD")                 # SA password from .env
    driver   = os.getenv("SQL_DRIVER", "ODBC Driver 18 for SQL Server")

    conn_str = (
        f"DRIVER={{{driver}}};"
        f"SERVER={host},{port};"
        f"DATABASE={db};"
        f"UID={user};"
        f"PWD={password};"
        f"TrustServerCertificate=yes"
    )
    return pyodbc.connect(conn_str, autocommit=autocommit)
```

> [!tip] Credentials Never Hardcoded
> Every loader and transform imports `get_connection()` to get a database handle. Credentials come from environment variables or `.env` files, never from source code.

### Medallion Schema Isolation

Each layer has its own SQL Server schema, providing clean namespace separation:

```sql
CREATE SCHEMA bronze;
CREATE SCHEMA silver;
CREATE SCHEMA gold;
CREATE SCHEMA ref;   -- reference data (static lookups)
```

## Layer Responsibilities

> [!warning] Bronze must be immutable
>
> Never UPDATE or DELETE bronze rows. The entire medallion architecture depends on bronze being a faithful record of what arrived from the source. If you apply corrections or deduplication in bronze, you lose the ability to reprocess silver/gold from scratch. All cleaning, deduplication, and type casting belongs in silver. If source data is genuinely wrong, append a correction row with a later `_ingested_at` timestamp -- do not overwrite the original.

### Bronze (Raw)
- 1:1 mapping with source data
- No transformations -- data lands exactly as received
- Enables reprocessing from source if transforms change
- See [[bronze-layer-loading]]

### Silver (Cleaned)
- Deduplication, gap-filling, type casting
- [[silver-transforms|SCD Type 2]] for slowly changing dimensions
- Business key validation
- See [[silver-transforms]]

### Gold (Analytics)
- Pre-computed scores, rankings, aggregations
- Dashboard-ready format -- no further computation needed
- See [[gold-transforms]]

> [!danger] Gold must be reproducible from silver
>
> If you cannot rebuild gold entirely from silver (and silver from bronze), your medallion architecture is broken. Test this regularly by running a full-refresh of gold in a dev environment. Any gold table that depends on external state (API calls, cached files) outside the silver layer is a hidden dependency that will cause silent failures during reprocessing.

### Why Medallion Architecture Matters

The medallion architecture enables [[idempotent-pipeline-design|idempotent pipelines]]:
1. Bronze preserves raw data — you can always reprocess
2. Each layer is independently re-runnable
3. Debugging is easy — query any layer to see intermediate state
4. Schema changes in gold don't affect bronze or silver

## Related

**General SQL Server patterns:**
- [[sql-server-schema-layering]] — Schema organization for multi-layer architectures
- [[sql-server-loading-patterns]] — Loading methods, benchmarks, minimal logging
- [[sql-server-change-tracking]] — SCD2, temporal tables, CDC — decision matrix
- [[sql-server-incremental-transforms]] — Watermark loading, gap-fill, pre-computed aggregations

**Worked implementation (financial index pipeline):**
- [[bronze-layer-loading]] — How data enters the bronze layer
- [[silver-transforms]] — Cleaning and deduplication patterns
- [[gold-transforms]] — Analytics and scoring patterns

**Theory:**
- [[idempotent-pipeline-design]] — Safe re-run patterns
- the pipeline steps — project-specific pipeline execution
