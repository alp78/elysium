---
title: "01 - Medallion Architecture"
tags: [data-architecture, architecture, pipeline, medallion, python, sql]
aliases: [medallion architecture, bronze silver gold, bronze/silver/gold, data lakehouse, three layer architecture, medallion pattern]
description: "The medallion architecture (bronze/silver/gold) implemented in SQL Server — raw data landing, cleaning and deduplication, and analytics-ready aggregation across three schema layers."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Medallion Architecture

> [!quote]+
> "The best way to protect private and sensitive data is to avoid ingesting this data in the first place."
>
> — **Joe Reis & Matt Housley**, *Fundamentals of Data Engineering* (2022)

> [!abstract]- Summary
>
> This note defines the medallion architecture as the staged bronze-silver-gold pattern for turning raw arrivals into trusted analytical outputs, then shows how layer isolation, shared connection patterns, and reproducibility rules make the pipeline rerunnable and debuggable end to end.
>
> **Architecture overview and platform fit**
> - Explains the three-layer flow, the SQL Server schema layout, and the supporting Python and C# stack used to land, transform, and serve the data.
> - Connects the pattern to ELT, shared connection factories, and namespace separation so each layer has a clear technical and operational boundary.
>
> **Layer responsibilities**
> - Defines bronze as immutable raw capture, silver as the permanent cleaned system of record, and gold as consumer-shaped analytical output.
> - Treats each layer as a different contract for quality, history, and rebuildability rather than as three copies of the same table.
>
> **Why it works and where it stops**
> - Explains how the pattern enables idempotent reruns, isolated debugging, and safe downstream change while also documenting where medallion is the wrong fit.
> - Uses reference implementations to anchor the architecture in practical Python and C# workflows instead of only conceptual diagrams.
>
> **Operations and safety**
> - Warnings: bronze must remain immutable, gold must be fully reproducible from silver, and any hidden dependency outside the stage chain breaks the architecture contract.
> - Recommendations: isolate schemas by layer, centralize connection handling, test gold full-refreshes regularly, and treat silver as the permanent validated truth.

> [!note]- Glossary
>
> **Medallion architecture**
> - A layered pipeline design that organizes data into bronze, silver, and gold stages with increasing structure and business value.
> - It matters here because the note uses this pattern as the foundational flow for the chapter's broader pipeline design guidance.
>
> > [!info] Contract by stage
> >
> > The layers are useful because each one answers a different question: what arrived, what is trusted, and what is ready for a specific consumer.
>
> ---
>
> **Bronze layer**
> - The raw landing layer that stores source data as received, with minimal or no transformation.
> - It matters here because bronze preserves the audit trail and the material needed to replay later transformations safely.
>
> > [!warning] Do not clean here
> >
> > Once bronze is corrected or deduplicated in place, the platform loses the ability to prove what the source actually sent and when it sent it.
>
> ---
>
> **Silver layer**
> - The cleaned and standardized layer where types, deduplication, validation, and history management are applied.
> - It matters here because silver is treated as the durable system of record for downstream consumers and rebuilds.
>
> > [!info] Permanent truth layer
> >
> > Bronze may be transient and gold may be disposable, but silver is the validated core that everything else depends on.
>
> ---
>
> **Gold layer**
> - The consumer-facing analytical layer shaped for dashboards, APIs, or specific business questions.
> - It matters here because gold is where the architecture turns trusted data into purpose-built outputs for actual use cases.
>
> > [!warning] Consumer-shaped, not source-shaped
> >
> > Gold tables should be optimized for the consuming workload. If they look like raw source dumps, the layer is not doing its job.
>
> ---
>
> **ELT**
> - A pipeline approach where data is extracted and loaded before transformations run inside the target analytical system.
> - It matters here because the medallion pattern naturally aligns with loading raw data first and refining it in-database across layers.
>
> > [!info] Load first, refine later
> >
> > ELT works well when the warehouse or database is strong enough to host the transformation stages directly rather than relying on external preprocessing.
>
> ---
>
> **Schema isolation**
> - The practice of separating bronze, silver, gold, and related objects into distinct database schemas or namespaces.
> - It matters here because layer clarity becomes much easier to enforce when objects cannot blur together in one shared namespace.
>
> > [!warning] Boundaries should be visible
> >
> > If engineers can no longer tell raw from curated objects by location and naming alone, accidental cross-layer coupling becomes much more likely.
>
> ---
>
> **Reprocessability**
> - The ability to rerun downstream transformations from preserved upstream data without corrupting results.
> - It matters here because reprocessability is one of the main operational reasons to accept the extra storage and stage boundaries of medallion.
>
> > [!info] Recovery mechanism
> >
> > Reprocessability turns incidents from manual repair exercises into deterministic reruns from a known earlier stage.
>
> ---
>
> **Full refresh**
> - A rebuild strategy that discards and recreates a derived layer entirely from its authoritative upstream source.
> - It matters here because gold reproducibility is validated by proving the layer can be rebuilt cleanly from silver.
>
> > [!warning] Best tested before incidents
> >
> > A full refresh path that only exists on paper is not a recovery strategy. It becomes credible only after repeated successful rehearsal.
>
> ---
>
> **Consumer contract**
> - The implicit or explicit agreement about the shape, freshness, and purpose of data delivered to downstream users or systems.
> - It matters here because gold outputs are justified by serving a specific consumer contract rather than by mirroring the upstream model.
>
> > [!info] Why gold is disposable
> >
> > Gold can be rebuilt because its value is in the served contract, not in being the canonical historical store.
>

### Medallion Architecture Overview

| Layer | Schema | Purpose | Refresh |
|-------|--------|---------|---------|
| **Bronze** | `bronze.*` | Raw data, 1:1 with source JSON | Every pipeline run |
| **Silver** | `silver.*` | Cleaned, deduplicated, gap-filled | Derived from bronze |
| **Gold** | `gold.*` | Pre-computed analytics, dashboard-ready | Derived from silver |

**Pipeline flow:** yfinance API → JSON files → Bronze → Silver → Gold → Dashboard

### Medallion Technology Stack

- SQL Server (ODBC Driver 18)
- Python + [pyodbc](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/bronze-layer-loading) (parameterized queries, `?` placeholders)
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
- See [bronze-layer-loading](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/bronze-layer-loading)

"1:1 with source" means column names match the API response or file schema exactly. There is no casting `string` to `decimal`, no renaming `adj_close` to `adjusted_close`, no deduplication of rows that arrived twice. What does NOT happen in bronze: no gap-filling for missing trading days, no null imputation, no calculated fields like returns or z-scores. Bronze is a faithful snapshot of what the source system sent. It is ephemeral by design — once silver is validated, bronze can be truncated or archived to cold storage because its only purpose is reprocessability.

### Silver (Cleaned)
- Deduplication, gap-filling, type casting
- [SCD Type 2](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/silver-transforms) for slowly changing dimensions
- Business key validation
- See [silver-transforms](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/silver-transforms)

Silver is where real data engineering happens. Type casting converts strings to their proper types (`DECIMAL(18,6)` for prices, `DATE` for trade dates). Deduplication removes rows that arrived more than once due to retries or overlapping API windows. SCD2 tracks slowly changing dimensions by closing old rows and opening new ones rather than overwriting history. Gap-filling inserts placeholder rows for missing trading days so downstream queries do not silently skip dates. Computed columns like daily returns or moving averages are added here. Silver is the PERMANENT layer — it is the system of record. While bronze is ephemeral and gold is derived, silver must be preserved indefinitely because it represents the cleaned, validated truth that every downstream consumer depends on.

### Gold (Analytics)
- Pre-computed scores, rankings, aggregations
- Dashboard-ready format -- no further computation needed
- See [gold-transforms](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/gold-transforms)

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
> - The SQL Server medallion project: [bronze-layer-loading](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/bronze-layer-loading) → [silver-transforms](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/silver-transforms) → [gold-transforms](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/gold-transforms)
> - The functional pipeline notebooks: [25_py_functional_pipeline](https://alp78.github.io/elysium/02-Programming-Languages/Python/25_py_functional_pipeline) (Python) and [25_cs_functional_pipeline](https://alp78.github.io/elysium/02-Programming-Languages/CSharp/25_cs_functional_pipeline) (C#)
>
> The functional pipeline adds five architectural principles ON TOP of medallion:
> contract validation, quality gates, lineage tracking, context propagation,
> and pure functional transforms. See [functional-pipeline-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/functional-pipeline-architecture).

## Related

**General SQL Server patterns:**
- [sql-server-schema-layering](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/02-Database-Design-and-Storage/sql-server-schema-layering) — Schema organization for multi-layer architectures
- [sql-server-loading-patterns](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/sql-server-loading-patterns) — Loading methods, benchmarks, minimal logging
- [sql-server-change-tracking](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/02-Database-Design-and-Storage/sql-server-change-tracking) — SCD2, temporal tables, CDC — decision matrix
- [sql-server-incremental-transforms](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/sql-server-incremental-transforms) — Watermark loading, gap-fill, pre-computed aggregations

**Worked implementation (financial index pipeline):**
- [bronze-layer-loading](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/bronze-layer-loading) — How data enters the bronze layer
- [silver-transforms](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/silver-transforms) — Cleaning and deduplication patterns
- [gold-transforms](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/gold-transforms) — Analytics and scoring patterns

**Theory:**
- [idempotent-pipeline-design](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design) — Safe re-run patterns
- the pipeline steps — project-specific pipeline execution
