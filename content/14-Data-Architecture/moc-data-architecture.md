---
title: "MOC: Data Architecture"
tags:
  - moc
  - data-architecture
  - architecture
  - patterns
  - pipeline
---

# MOC: Data Architecture

The complete map of data architecture knowledge — from system blueprints to protocol selection. Six domains covering how to DESIGN systems (blueprints, models), how to BUILD pipelines (construction, reliability), how data MOVES between systems (integration), and how to CHOOSE between options (principles, decisions).

## System Blueprints — Platform Architecture Patterns

What does the overall data platform look like? These are the big structural decisions — chosen once, lived with for years. Each blueprint defines a structural approach with components, trade-offs, and selection criteria.

* [[data-warehouse-architecture]] — Star/snowflake schema, Kimball vs Inmon, SCD types, Data Vault 2.0, cloud warehouse comparison. Start here if your data is structured and analytical.

* [[data-lake-architecture]] — Zone architecture (landing/cleansed/curated), file formats, governance, anti-patterns. Start here if you work with unstructured or semi-structured data at scale.

* [[lakehouse-architecture]] — Combining lake storage with warehouse semantics: ACID on object storage, open table formats, query engines. Where most modern platforms are converging.

* [[data-mesh-architecture]] — Domain-driven data ownership, data products, federated governance. When centralized architecture creates organizational bottlenecks.

* [[streaming-architecture]] — Lambda vs Kappa, event-driven design, CDC, Kafka/Pub/Sub, windowing, exactly-once semantics. When batch latency isn't acceptable.

* [[open-table-formats]] — Delta Lake, Apache Iceberg, Apache Hudi — format internals, time travel, schema evolution, maintenance operations. The technology layer that enables lakehouse.

* [[context-and-metadata-architecture]] — The five types of pipeline context (run, provenance, temporal, quality, business), context propagation patterns, bi-temporal modeling, schema evolution. The semantic layer that makes data self-describing.

## Data Modeling — Structuring Data for Purpose

How to structure data inside each system for analytics, operations, and compliance. Each modeling approach has full DDL examples using a financial index provider domain.

* [[dimensional-modeling]] — Kimball four-step process, star schema, all SCD types, bus matrix, bridge tables, physical implementation in SQL Server + BigQuery, dbt integration. The dominant approach for analytical workloads.

* [[data-modeling-patterns]] — Normalized (3NF), Data Vault 2.0, wide/flat OBT, activity schema, time-series, document (Firestore), graph — decision framework for choosing the right model. Covers every major modeling paradigm with full DDL and naming conventions.

## Pipeline Construction — Building Reliable Data Pipelines

How to structure the pipeline code — data layering, idempotent operations, transform architecture, data movement topology, serialization, and migration. These patterns define how data flows from source to consumer.

* [[medallion-architecture]] — Bronze/Silver/Gold layered processing. The most widely adopted pipeline pattern for both warehouses and lakehouses. Start here.

* [[functional-pipeline-architecture]] — Five architectural principles (functional core/imperative shell, contract validation, quality gates, data provenance, immutable value objects) applied to pipeline construction. The theory behind the reference implementations.

* [[data-flow-architecture]] — Complete data movement topology for the stack: every source-destination pair, transfer method decision matrix, format selection, push/pull/staged patterns, batch vs streaming vs micro-batch.

* [[idempotent-pipeline-design]] — DELETE-INSERT, MERGE, staging table patterns for safe re-runs. The foundation for pipelines that can be retried without producing duplicates.

* [[dbt-transformation-layer]] — dbt Core vs Cloud, project structure, testing, macros, incremental models, Airflow integration. The SQL-first transformation approach.

* [[serialization-formats]] — JSON/YAML/CSV/Protobuf/Avro/Parquet/Pickle comparison, compression codecs (gzip, zstd, snappy), format selection by scenario.

* [[migration-idempotency-backfills]] — Migration strategies (strangler fig), backfill chunking, schema evolution, data contracts for safe evolution.

**Implementation references:**
* [[25_py_functional_pipeline]] — Python reference implementation
* [[25_cs_functional_pipeline]] — C# reference implementation

## Pipeline Reliability — Keeping Data Trustworthy

How to ensure the pipeline produces correct data and recovers from failures. Quality gates, contracts, testing strategy, error handling, and environment management. These patterns prevent bad data from reaching consumers.

* [[data-quality-framework]] — Six quality dimensions (completeness, uniqueness, validity, timeliness, accuracy, consistency), quality gates per medallion layer, tooling comparison, quarantine pattern, anomaly detection.

* [[data-contracts]] — Schema + SLA + semantics agreements between data producers and consumers. Breaking vs non-breaking changes, CI validation, contract versioning.

* [[data-pipeline-testing-strategy]] — The testing pyramid for data engineering: unit tests, data quality assertions, contract tests, integration tests, E2E validation. Where each test type runs and what it catches.

* [[error-handling-and-retry-patterns]] — Error classification (transient/permanent/data-dependent/resource/partial), retry strategies (exponential backoff with jitter), circuit breaker, dead letter queue, failure propagation.

* [[environment-management-strategy]] — Environment topology (two-tier vs three-tier), what differs per environment, tool-by-tool separation (gcloud/Terraform/dbt/Airflow/GitHub Actions), promotion workflow, cost model.

## Integration & Protocols — How Data Moves Between Systems

API design, protocol selection, and integration patterns. Covers the full spectrum from REST to gRPC to GraphQL, with decision frameworks for choosing the right protocol for each use case.

* [[api-protocols-comparison]] — Master decision framework: REST vs gRPC vs GraphQL vs WebSocket vs SSE vs MQTT vs AMQP vs Webhooks vs SFTP vs FIX. Comparison tables, decision matrices, working code for each.

* [[rest-api-design-and-consumption]] — Consuming and building REST APIs: authentication, pagination (4 patterns), rate limiting, backoff, async ingestion, FastAPI, curl reference, OpenAPI.

* [[grpc-for-data-pipelines]] — Protocol Buffers, all 4 RPC types, Python server+client, interceptors, load balancing, GCP Cloud Run deployment. For high-throughput internal service communication.

* [[graphql-for-data-access]] — Schema definition, queries/mutations/subscriptions, Strawberry+FastAPI, N+1/DataLoader, cursor pagination, federation. For flexible client-driven data access.

## Principles & Decisions — Choosing the Right Approach

Foundational principles and decision frameworks for every technology and architecture choice. Start with the golden rules for the mindset, then use the matrices and scenarios for specific decisions.

* [[five-pillars-of-data-engineering]] — Reliability, observability, efficiency, security, operability. The five concerns that separate junior from senior engineering thinking.

* [[golden-rules-of-data-engineering]] — 10 foundational principles: serve the business, choose boring technology, optimize for change, raw data is sacred, complexity is debt. Each with decision tests and anti-patterns.

* [[technology-selection-matrices]] — Decision tables for every choice: Python vs Bash vs C# vs SQL, SQL Server vs BigQuery, Airflow vs cron, Terraform vs gcloud, data models, APIs, build vs buy. 30+ lookup entries.

* [[scenario-based-decision-guide]] — 10 real-world scenarios with Mermaid architecture diagrams: daily batch pipeline, streaming, data warehouse, multi-source integration, cost optimization. Follow the scenario that matches your situation.

## Cross-References

- [[bronze-layer-loading]], [[silver-transforms]], [[gold-transforms]] — SQL Server implementations of medallion layers
- [[etl-vs-elt]] — ETL vs ELT comparison table
- [[airflow-dag-patterns]] — pipeline scheduling patterns for Airflow
- [[gcp-scheduling]] — Cloud Scheduler to Cloud Run patterns
- [[moc-dbt|dbt]] — full dbt transformation layer section
- [[dbt-transformation-layer]] — concise code-heavy dbt overview
