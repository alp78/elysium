---
title: "Medallion Architecture"
tags: [data-architecture, architecture, pipeline, medallion, python, sql]
aliases: [medallion architecture, bronze silver gold, bronze/silver/gold, data lakehouse, three layer architecture, medallion pattern]
description: "The medallion architecture (bronze/silver/gold) implemented in SQL Server — raw data landing, cleaning and deduplication, and analytics-ready aggregation across three schema layers."
parent: "[[domain-pipeline-construction]]"
links:
  - "[[functional-pipeline-architecture]]"
  - "[[data-flow-architecture]]"
  - "[[idempotent-pipeline-design]]"
  - "[[dbt-transformation-layer]]"
  - "[[serialization-formats]]"
  - "[[migration-idempotency-backfills]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Medallion Architecture

> [!quote]
> "The best way to protect private and sensitive data is to avoid ingesting this data in the first place."
>
> — **Joe Reis & Matt Housley**, *Fundamentals of Data Engineering* (2022)

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
- Python + [pyodbc](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/bronze-layer-loading) (parameterized queries, `?` placeholders)
- Pandas + NumPy for gold-layer analytics
- Dapper (C#) for dashboard reads

The medallion pattern aligns naturally with the ELT paradigm — raw data lands first, then transforms run inside the warehouse. In dbt projects, [dbt-staging-models](https://alp78.github.io/elysium/11-dbt/Modeling/dbt-staging-models) correspond to the bronze-to-silver transition, while [dbt-mart-models](https://alp78.github.io/elysium/11-dbt/Modeling/dbt-mart-models) produce the gold layer.

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

> [!success] Append corrections to bronze — never overwrite
>
> When a source sends a corrected value, insert the new row with a later `_ingested_at` timestamp alongside the original. The silver deduplication step selects the latest row per business key. Bronze stays immutable, the correction is captured, and you retain a full audit trail of what the source sent and when.

### Bronze (Raw)
- 1:1 mapping with source data
- No transformations -- data lands exactly as received
- Enables reprocessing from source if transforms change
- See [bronze-layer-loading](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/bronze-layer-loading)

"1:1 with source" means column names match the API response or file schema exactly. There is no casting `string` to `decimal`, no renaming `adj_close` to `adjusted_close`, no deduplication of rows that arrived twice. What does NOT happen in bronze: no gap-filling for missing trading days, no null imputation, no calculated fields like returns or z-scores. Bronze is a faithful snapshot of what the source system sent. It is ephemeral by design — once silver is validated, bronze can be truncated or archived to cold storage because its only purpose is reprocessability.

### Silver (Cleaned)
- Deduplication, gap-filling, type casting
- [SCD Type 2](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/silver-transforms) for slowly changing dimensions
- Business key validation
- See [silver-transforms](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/silver-transforms)

Silver is where real data engineering happens. Type casting converts strings to their proper types (`DECIMAL(18,6)` for prices, `DATE` for trade dates). Deduplication removes rows that arrived more than once due to retries or overlapping API windows. SCD2 tracks slowly changing dimensions by closing old rows and opening new ones rather than overwriting history. Gap-filling inserts placeholder rows for missing trading days so downstream queries do not silently skip dates. Computed columns like daily returns or moving averages are added here. Silver is the PERMANENT layer — it is the system of record. While bronze is ephemeral and gold is derived, silver must be preserved indefinitely because it represents the cleaned, validated truth that every downstream consumer depends on.

### Gold (Analytics)
- Pre-computed scores, rankings, aggregations
- Dashboard-ready format -- no further computation needed
- See [gold-transforms](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/gold-transforms)

Gold tables are pre-computed for specific consumers — a dashboard, a comparison view, an API endpoint. The shape of a gold table is dictated by the CONSUMER, not by the data model. If a dashboard needs a sector-level ESG comparison with 30-day trailing averages, gold contains exactly that — pre-joined, pre-aggregated, ready to SELECT without further transformation. Gold tables are fully derived and disposable; they can be rebuilt from silver at any time. Multiple gold tables can serve different consumers from the same silver source, each shaped differently for its use case.

> [!danger] Gold must be reproducible from silver
>
> If you cannot rebuild gold entirely from silver (and silver from bronze), your medallion architecture is broken. Test this regularly by running a full-refresh of gold in a dev environment. Any gold table that depends on external state (API calls, cached files) outside the silver layer is a hidden dependency that will cause silent failures during reprocessing.

> [!success] Run a full-refresh of gold from silver in dev on every schema change
>
> Add a CI step that runs `TRUNCATE gold.*; INSERT INTO gold.* SELECT ... FROM silver.*` in the dev environment on every PR that touches transform logic. If the full-refresh fails or produces unexpected row counts, the PR is blocked before it reaches staging. Gold must always be fully reproducible from silver — this gate enforces it.

### Why Medallion Architecture Matters

The medallion architecture enables [idempotent pipelines](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design):
1. Bronze preserves raw data — you can always reprocess
2. Each layer is independently re-runnable
3. Debugging is easy — query any layer to see intermediate state
4. Schema changes in gold don't affect bronze or silver

### When Medallion Is Not the Right Pattern

> [!warning] Medallion Is Not Universal
>
> Medallion assumes batch-first processing with clear stage boundaries. It is
> NOT the right pattern for: real-time feature stores (need sub-second latency,
> not stage-by-stage processing), event sourcing architectures (events are
> immutable by design — no need for a "bronze" preservation layer), or
> streaming-first systems where data flows continuously through transformations
> without landing in intermediate tables.

> [!success] Use the kappa/streaming pattern for sub-second latency requirements
>
> When the use case demands continuous processing without stage-boundary landing, use a streaming architecture (Pub/Sub + Dataflow) instead of medallion. The two are complementary: financial index platforms typically run medallion for official end-of-day values and streaming for intraday approximations. See [streaming-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/streaming-architecture).

For streaming-first alternatives, see [streaming-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/streaming-architecture).

### Reference Implementations

> [!info] Reference Implementations
>
> Two complete medallion implementations exist in the vault:
> - The SQL Server medallion project: [bronze-layer-loading](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/bronze-layer-loading) → [silver-transforms](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/silver-transforms) → [gold-transforms](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/gold-transforms)
> - The functional pipeline notebooks: [25_py_functional_pipeline](https://alp78.github.io/elysium/02-Programming-Languages/Python/25_py_functional_pipeline) (Python) and [25_cs_functional_pipeline](https://alp78.github.io/elysium/02-Programming-Languages/CSharp/25_cs_functional_pipeline) (C#)
>
> The functional pipeline adds five architectural principles ON TOP of medallion:
> contract validation, quality gates, lineage tracking, context propagation,
> and pure functional transforms. See [functional-pipeline-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/functional-pipeline-architecture).

## Related

**General SQL Server patterns:**
- [sql-server-schema-layering](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-schema-layering) — Schema organization for multi-layer architectures
- [sql-server-loading-patterns](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-loading-patterns) — Loading methods, benchmarks, minimal logging
- [sql-server-change-tracking](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-change-tracking) — SCD2, temporal tables, CDC — decision matrix
- [sql-server-incremental-transforms](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-incremental-transforms) — Watermark loading, gap-fill, pre-computed aggregations

**Worked implementation (financial index pipeline):**
- [bronze-layer-loading](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/bronze-layer-loading) — How data enters the bronze layer
- [silver-transforms](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/silver-transforms) — Cleaning and deduplication patterns
- [gold-transforms](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/gold-transforms) — Analytics and scoring patterns

**Theory:**
- [idempotent-pipeline-design](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design) — Safe re-run patterns
- the pipeline steps — project-specific pipeline execution
