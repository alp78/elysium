---
type: index
category: data-architecture
technology: []
tags: [architecture]
aliases: [Data Architecture Index, Architecture Index, Data Engineering Architecture]
keywords: [data architecture, data warehouse, data lake, lakehouse, data mesh, streaming, medallion, star schema, dimensional modeling, Kimball, Inmon, Lambda, Kappa, event-driven, CDC, idempotent, dbt, delta lake, iceberg, pipeline patterns, ETL, ELT]
description: "Index for the Data Architecture section — modern data architectures (warehouse, lake, lakehouse, mesh, streaming), pipeline design patterns (medallion, idempotency, dbt), and data format standards."
related:
  - "[[Dashboard]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Data Architecture

This section covers **what** you build (architectures) and **how** you build it (patterns). Architecture notes define the structural blueprints — data warehouse, data lake, lakehouse, data mesh, streaming. Pattern notes define the reusable techniques — medallion layers, idempotent pipelines, transformation tools. For the commands that implement these patterns, see [[shell-index|Shell]], [[sql-server-index|SQL Server]], [[programming-languages-index|Python]], and [[terraform-index|Terraform]].

## Architectures

Structural blueprints for organizing data at scale. Each note defines the architecture, its components, trade-offs, and when to choose it.

| Note | Description |
|------|-------------|
| [[data-warehouse-architecture]] | Star schema, snowflake schema, Kimball vs Inmon, SCD types, Data Vault 2.0, cloud warehouse comparison |
| [[data-lake-architecture]] | Zone architecture (landing/cleansed/curated), file formats, governance, anti-patterns, GCS/S3/ADLS |
| [[lakehouse-architecture]] | Combining lake + warehouse: ACID on object storage, open table formats, query engines, Databricks/BigLake |
| [[data-mesh-architecture]] | Domain-driven data ownership, data products, federated governance, data contracts, when it fits |
| [[streaming-architecture]] | Lambda vs Kappa, event-driven, CDC, Kafka/Pub/Sub, Flink/Beam/Dataflow, windowing, exactly-once |
| [[open-table-formats]] | Delta Lake, Apache Iceberg, Apache Hudi — deep dive on format internals, time travel, maintenance |
| [[context-and-metadata-architecture]] | The five types of pipeline context (run, provenance, temporal, quality, business), context propagation patterns, bi-temporal modeling, data contracts, schema evolution, anti-patterns |

## Data Modeling

How to structure data for analytics, operations, and compliance. Each note covers a modeling approach with full DDL examples from a financial index provider domain.

| Note | Description |
|------|-------------|
| [[dimensional-modeling]] | Kimball four-step process, star schema, complete fact/dimension DDL (index valuation, constituents, corporate actions), all SCD types, bus matrix, bridge tables, aggregate tables, physical implementation (SQL Server + BigQuery), dbt integration, modeling tools |
| [[data-modeling-patterns]] | Normalized (3NF), Data Vault 2.0 (hubs/links/satellites), wide/flat OBT, activity schema, time-series, document (Firestore), graph — decision framework, full DDL for each, naming conventions |

## Pipeline Patterns

Reusable design patterns for building reliable data pipelines.

| Note | Description |
|------|-------------|
| [[medallion-architecture]] | Bronze/Silver/Gold layered processing — the standard pattern for both warehouses and lakehouses |
| [[idempotent-pipeline-design]] | DELETE-INSERT, MERGE, staging table patterns for safe re-runs |
| [[dbt-transformation-layer]] | dbt Core vs Cloud, project structure, testing, macros, incremental models, Airflow integration |
| [[migration-idempotency-backfills]] | Migration strategies (strangler fig), backfill chunking, schema evolution, data contracts |
| [[serialization-formats]] | JSON/YAML/CSV/Protobuf/Avro/Parquet/Pickle comparison and compression codecs |

## APIs and Protocols

How data moves between systems — API design, protocol selection, and integration patterns for data pipelines.

| Note | Description |
|------|-------------|
| [[api-protocols-comparison]] | Master decision framework: REST vs gRPC vs GraphQL vs WebSocket vs SSE vs MQTT vs AMQP vs Webhooks vs SFTP vs FIX — comparison tables, decision matrices, working code for each |
| [[rest-api-design-and-consumption]] | Consuming and building REST APIs: authentication, pagination (4 patterns), rate limiting, backoff, async ingestion, FastAPI, curl reference, OpenAPI |
| [[grpc-for-data-pipelines]] | Protocol Buffers, all 4 RPC types (unary, server/client/bidirectional streaming), Python server+client, interceptors, load balancing, GCP Cloud Run |
| [[graphql-for-data-access]] | Schema definition, queries/mutations/subscriptions, Strawberry+FastAPI, N+1/DataLoader, cursor pagination, federation, GitHub API automation |

## Decision Frameworks

How to choose the right technology, architecture, data model, and protocol for any business need. Start with the golden rules, then use the matrices and scenarios for specific decisions.

| Note | Description |
|------|-------------|
| [[golden-rules-of-data-engineering]] | 10 foundational principles: serve the business, choose boring technology, optimize for change, raw data is sacred, complexity is debt, cost is architecture — each with decision tests and anti-patterns |
| [[technology-selection-matrices]] | Decision tables for every choice: Python vs Bash vs C# vs SQL, SQL Server vs BigQuery, Airflow vs cron, Terraform vs gcloud, data models, APIs, build vs buy — 30+ lookup entries |
| [[scenario-based-decision-guide]] | 10 real-world scenarios with Mermaid architecture diagrams: daily batch pipeline, streaming, data warehouse, multi-source integration, small team, large team, index calculation, ML features, migration, cost optimization |

## Principles

| Note | Description |
|------|-------------|
| [[five-pillars-of-data-engineering]] | Reliability, observability, efficiency, security, operability — the senior engineering mindset |

## Maps of Content

Curated, narrated link collections for cross-cutting themes.

- [[moc-data-pipeline-lifecycle]] — Design → provisioning → ingestion → transformation → orchestration → monitoring
- [[moc-infrastructure-as-code]] — Terraform foundations → GCP resources → patterns → operations → CI/CD

## Key Concepts

- **[[data-warehouse-architecture]]** — Start here if you work with structured analytical data
- **[[data-lake-architecture]]** — Start here if you work with unstructured/semi-structured data at scale
- **[[lakehouse-architecture]]** — The convergence point — most modern platforms are moving here
- **[[medallion-architecture]]** — The most widely adopted pipeline layering pattern
- **[[streaming-architecture]]** — When batch isn't fast enough

## Cross-References

- **SQL Server** — [[bronze-layer-loading]], [[silver-transforms]], [[gold-transforms]] implement medallion layers
- **Reference** — [[etl-vs-elt]] comparison table
- **Python** — [[parquet-files]] for columnar data format details
- **Orchestration** — [[airflow-dag-patterns]] for pipeline scheduling patterns
- **GCP** — [[gcp-scheduling]] for Cloud Scheduler → Cloud Run patterns

> *This table renders in Obsidian via Dataview. On the web, browse the notes listed above or use the Explorer sidebar.*

### dbt
- [[dbt-index]] — Full dbt transformation layer section
- [[dbt-transformation-layer]] — Concise overview
