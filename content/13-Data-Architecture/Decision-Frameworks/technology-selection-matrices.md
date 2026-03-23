---
type: reference
category: data-architecture
technology: [sql-server, bigquery, gcp, python, bash, powershell, csharp, terraform, airflow, docker]
tags: [reference, data-architecture, decision-matrix, technology-selection, trade-offs, build-vs-buy, language-selection]
aliases: [technology selection, decision matrix, when to use, build vs buy, language comparison, Python vs C# vs bash, SQL Server vs BigQuery, Airflow vs cron, Terraform vs CLI]
keywords: [technology selection, decision matrix, language selection, build vs buy, trade-off analysis, Python vs bash, Python vs C#, SQL vs Python, SQL Server vs BigQuery, Airflow vs cron, Terraform vs gcloud, Cloud Run vs Compute Engine, Pub/Sub vs direct calls, GCS vs BigQuery, star schema vs flat, ETL vs ELT, Firestore vs Bigtable, Cloud SQL vs SQL Server, orchestration selection, compute selection, storage selection, database selection, API protocol selection, architecture selection, data model selection, infrastructure as code, cost comparison, latency comparison, scaling comparison, managed vs self-hosted, serverless vs VM, batch vs streaming, Docker vs bare metal, dbt vs custom SQL, Datadog vs Cloud Monitoring, CI/CD selection, testing strategy selection]
description: "Comprehensive decision-matrix reference for data engineering technology selection — language choice (Python/Bash/PowerShell/C#/SQL), database selection (SQL Server/BigQuery/Cloud SQL/Firestore/Bigtable), GCP component selection (compute/messaging/storage), orchestration (Airflow/cron/Cloud Scheduler/Composer), infrastructure tooling (Terraform/gcloud/Console), data modeling, API protocols, architecture patterns, and build-vs-buy frameworks. Every decision backed by trade-off analysis with specific thresholds and decision rules."
related:
  - "[[data-architecture-index]]"
  - "[[five-pillars-of-data-engineering]]"
  - "[[moc-data-pipeline-lifecycle]]"
  - "[[moc-infrastructure-as-code]]"
  - "[[sql-python-csharp-transforms]]"
  - "[[etl-vs-elt]]"
  - "[[medallion-architecture]]"
  - "[[data-warehouse-architecture]]"
  - "[[data-lake-architecture]]"
  - "[[lakehouse-architecture]]"
  - "[[data-mesh-architecture]]"
  - "[[streaming-architecture]]"
  - "[[dimensional-modeling]]"
  - "[[data-modeling-patterns]]"
  - "[[api-protocols-comparison]]"
  - "[[rest-api-design-and-consumption]]"
  - "[[grpc-for-data-pipelines]]"
  - "[[graphql-for-data-access]]"
  - "[[idempotent-pipeline-design]]"
  - "[[dbt-transformation-layer]]"
  - "[[serialization-formats]]"
  - "[[airflow-core-concepts]]"
  - "[[airflow-dag-patterns]]"
  - "[[airflow-deployment]]"
  - "[[gcp-scheduling]]"
  - "[[linux-scheduling]]"
  - "[[windows-scheduling]]"
  - "[[cloud-run-jobs-vs-services]]"
  - "[[pubsub-messaging]]"
  - "[[terraform-plan-apply-destroy]]"
  - "[[terraform-module-composition]]"
  - "[[container-lifecycle]]"
  - "[[docker-compose]]"
  - "[[querying-and-cost-optimization]]"
  - "[[firestore-data-model-and-operations]]"
  - "[[service-accounts-and-iam]]"
  - "[[datadog-architecture-overview]]"
  - "[[github-actions-workflows]]"
  - "[[database-connections]]"
  - "[[finops-cost-optimization]]"
  - "[[observability-deep-dive]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Technology Selection Matrices

Every technology decision in data engineering is a trade-off. There is no universally "best" language, database, or architecture — only the best fit for a given context of scale, team skill, budget, latency requirements, and operational complexity. This note is the lookup table. When you face a technology decision, find the relevant matrix, check the constraints, and follow the decision rule.

> [!tip] How to Use This Reference
> Each section contains a **decision matrix** (comparison table), **decision rules** (concrete thresholds and if-then logic), and **callouts** for the non-obvious gotchas. Start with the matrix, apply the decision rule, then read the detailed comparison if the choice is ambiguous.

For side-by-side code examples of SQL, Python, and C# doing the same transforms, see [[sql-python-csharp-transforms]]. For ETL vs ELT trade-offs, see [[etl-vs-elt]]. For the principles that underpin every decision here, see [[five-pillars-of-data-engineering]].

---

## Language Selection: Which Language for Which Task

### Primary Decision Matrix

| Task | Best Choice | Why | Avoid |
|------|------------|-----|-------|
| Data transformation logic | SQL (in-database) | Pushes compute to the engine, no data movement, optimizer parallelizes | Python for simple transforms that SQL handles natively |
| Complex business logic with types | Python | Rich libraries, readable, testable, type hints available | Bash (untyped, fragile for multi-step logic) |
| File operations on Linux servers | Bash | Native, fast, zero runtime overhead, pipes compose naturally | Python (overhead for simple file ops like mv/cp/chmod) |
| Windows automation | PowerShell | Native .NET integration, Windows Task Scheduler, registry access | Bash (WSL adds complexity and failure modes) |
| High-performance API serving | C# (ASP.NET) / Python (FastAPI) | Compiled speed for C#, async Python with Pydantic validation | Bash (not an API language, no HTTP framework) |
| Ad-hoc data exploration | Python (pandas/Polars) | Interactive REPL, visual output, rapid prototyping | C# (too verbose for throwaway exploration) |
| SQL Server administration | T-SQL + PowerShell | Native tooling, dbatools module, SSMS integration | Python (no advantage over native tools for DBA tasks) |
| GCP infrastructure ops | Bash + gcloud CLI | Direct CLI, scriptable, well-documented flags | PowerShell (gcloud SDK is bash-native, PS wrapper adds friction) |
| Pipeline orchestration glue | Python | Airflow is Python, rich GCP client libraries, testable | Bash (hard to unit test, poor error handling patterns) |
| One-liner text processing | Bash (awk/sed/grep) | Fastest path from data to answer, no boilerplate | Python (overhead for grep-level tasks) |
| ML feature engineering | Python (scikit-learn/numpy) | Ecosystem has no peer for ML preprocessing | SQL (limited to what the engine supports) |
| Configuration management | YAML/JSON + Python | Structured, version-controllable, parseable | Hardcoded values in any language |
| Docker image builds | Bash (in Dockerfile) | Native to the build context, minimal layers | Python scripts inside Dockerfiles (unnecessary complexity) |
| CI/CD pipeline scripts | Bash + Python | GitHub Actions runs bash natively, Python for complex steps | PowerShell in Linux CI runners (compatibility issues) |
| Database migrations | SQL (via dbt or migration tool) | Schema changes belong in SQL, version-controlled | Python ORM migrations for data warehouse schemas |
| Log parsing (structured) | Python (json module) | Handles nested JSON, filtering, aggregation | Bash (jq works for simple cases but breaks on complex nesting) |
| Log parsing (unstructured) | Bash (grep/awk) then Python | Grep for finding, Python for extracting patterns | Starting with Python when grep would answer the question |

### Detailed Comparison: Python vs Bash

Two languages every data engineer uses daily. The question is never "which one" — it is "which one *for this task*."

| Dimension | Bash | Python |
|-----------|------|--------|
| **Startup time** | ~5ms | ~50-100ms (interpreter + imports) |
| **File manipulation** | Native (mv, cp, chmod, find) | os/shutil/pathlib (works but verbose) |
| **Process management** | Native (ps, kill, nohup, &) | subprocess module (works but wraps bash) |
| **CLI tool chaining** | Pipes are first-class (`cmd1 \| cmd2 \| cmd3`) | subprocess.Popen chains (clunky) |
| **Error handling** | `set -euo pipefail` (fragile beyond that) | try/except with full stack traces |
| **Data structures** | Arrays only (no dicts, no objects, no nesting) | Lists, dicts, sets, classes, dataclasses |
| **String manipulation** | Parameter expansion (`${var##*/}`) | Full string methods, regex, f-strings |
| **Testing** | bats-core (limited) | pytest (world-class) |
| **API calls** | curl (works for simple GETs) | requests/httpx (handles auth, pagination, retries) |
| **Portability** | Linux/macOS (bash 4+ not default on macOS) | Cross-platform |
| **Debugging** | `set -x`, echo statements | pdb, IDE debuggers, logging module |

**When Bash wins:**

- File manipulation: `mv`, `cp`, `chmod`, `find`, `rsync`
- Process management: `ps aux`, `kill`, `nohup`, background jobs
- CLI tool chaining: `gcloud ... | jq ... | xargs ...`
- Cron jobs under 20 lines: extract a file, compress, upload to GCS
- Quick-and-dirty log parsing: `grep ERROR /var/log/app.log | tail -20`
- Environment setup: `.bashrc`, `.profile`, `export` chains

**When Python wins:**

- Anything with conditionals beyond simple if/else
- Loops that process data (not just files)
- Error handling that needs to be reliable
- API calls with authentication, pagination, retry logic
- Data frames, CSVs, JSON manipulation
- Anything that needs unit tests
- Any script another engineer will maintain

> [!warning] The 50-Line Rule
> If your bash script exceeds 50 lines, rewrite it in Python. Bash scripts over 50 lines become unmaintainable — they accumulate quoting bugs, lack proper error handling, and become impossible to test. The rewrite takes an hour; the debugging you avoid saves days.

**Example: Parsing a CSV**

The same task, two approaches — and when each is right:

```bash
# Bash: extract column 3 where column 1 matches "ACTIVE"
# RIGHT when: one-off investigation, piping to another command
awk -F',' '$1 == "ACTIVE" {print $3}' data.csv | sort | uniq -c | sort -rn
```

```python
# Python: same logic but with error handling and reuse
# RIGHT when: production pipeline, needs testing, output goes to a database
import pandas as pd
df = pd.read_csv("data.csv")
result = df[df["status"] == "ACTIVE"]["value"].value_counts()
```

The bash version is 1 line. The Python version is 3 lines plus imports. But when the CSV has quoted fields containing commas, the bash version silently produces wrong results while the Python version handles it correctly.

### Detailed Comparison: Python vs C#

| Dimension | Python | C# |
|-----------|--------|-----|
| **Typing** | Dynamic (optional type hints) | Static (compiled) |
| **Startup** | ~100ms | ~200ms (JIT), <50ms (AOT/trimmed) |
| **Throughput** | Moderate (GIL limits CPU parallelism) | High (true multi-threading, async/await) |
| **Data libraries** | pandas, Polars, numpy, scipy, scikit-learn | LINQ, Entity Framework, Dapper |
| **API frameworks** | FastAPI, Flask | ASP.NET Core (Kestrel) |
| **GCP SDKs** | google-cloud-* (first-class) | Google.Cloud.* (good but less documented) |
| **Airflow integration** | Native (DAGs are Python) | None (must wrap via BashOperator or API calls) |
| **Dashboard/UI** | Streamlit, Dash (adequate) | Blazor (enterprise-grade) |
| **Package management** | pip/poetry/uv (improving) | NuGet (mature, reliable) |
| **IDE experience** | VS Code + Pylance (good) | Visual Studio / Rider (excellent) |
| **Learning curve** | Low (readable, forgiving) | Medium (more ceremony, but clearer contracts) |

**When C# wins:**

- High-throughput APIs serving thousands of requests/second
- Windows services that run as background daemons
- Blazor dashboards with server-side rendering
- Strong typing at scale (100+ files, multiple contributors)
- Enterprise middleware integrating with .NET ecosystem
- Performance-critical code paths (no GIL, true parallelism)

**When Python wins:**

- Data manipulation and transformation pipelines
- ML model training and inference
- Rapid prototyping (half the lines of C# for equivalent logic)
- Airflow DAG authoring (Python is the only option)
- GCP client library usage (better docs, more examples)
- Notebook-driven analysis and exploration

> [!tip] The Hybrid Pattern
> Use Python for pipeline logic (Airflow DAGs, data transforms, GCP orchestration) and C# for the serving layer (Blazor dashboards, high-throughput APIs via Dapper + ASP.NET). This is not compromise — it is using each language where it excels. See [[database-connections]] for connection patterns in both languages.

### Detailed Comparison: SQL vs Python for Data Transforms

This is the most frequent decision a data engineer makes. The answer is almost always SQL — until it is not.

| Dimension | SQL (in-database) | Python (application layer) |
|-----------|-------------------|---------------------------|
| **Aggregations** | Native, optimized, parallelized | pandas groupby (works but slower) |
| **Joins** | Native, uses index seeks and hash joins | pandas merge (loads both sides into memory) |
| **Window functions** | ROW_NUMBER, LAG, LEAD, running totals | pandas .rank(), .shift() (equivalent but slower) |
| **GROUP BY** | Hash/sort aggregation on the engine | groupby().agg() (works, but why move the data?) |
| **String parsing** | SUBSTRING, CHARINDEX, PATINDEX (limited) | regex, string methods (far more powerful) |
| **API enrichment** | Not possible | requests/httpx during transform |
| **ML features** | Limited (basic math only) | scikit-learn, numpy (full ecosystem) |
| **Cross-database** | Not possible (within one engine only) | pandas reads from multiple sources |
| **Testability** | tSQLt, dbt tests | pytest (more flexible) |
| **Version control** | dbt models, migration files | Standard Python modules |
| **Performance at 1M rows** | Sub-second (indexed) | Seconds (pandas), sub-second (Polars) |
| **Performance at 1B rows** | Seconds to minutes (partitioned) | Out of memory (pandas), minutes (Polars/Spark) |

> [!important] The SQL-First Rule
> "If you can express it in SQL, do it in SQL. The database is faster than your code."
>
> The database engine has a query optimizer that has been refined over decades. It knows the data distribution, has indexes, can parallelize across cores, and operates directly on compressed columnar storage. Your Python code pulls data over a network, deserializes it, processes it in a single thread (GIL), and sends it back. The only exception is when the transform requires something SQL cannot do (API calls, ML, cross-database joins, complex regex).

**dbt as the bridge:** [[dbt-transformation-layer]] lets you write SQL transforms but manage them with software engineering practices — version control, testing, documentation, dependency graphs. This gives you SQL's performance with Python-level engineering discipline.

**When SQL wins (always prefer for these):**

- Aggregations: `SUM`, `AVG`, `COUNT`, `MIN`, `MAX`
- Joins: `INNER JOIN`, `LEFT JOIN`, `CROSS APPLY`
- Window functions: `ROW_NUMBER()`, `LAG()`, `LEAD()`, `SUM() OVER`
- Filtering: `WHERE`, `HAVING`
- Deduplication: `ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...) = 1`
- Pivoting: `PIVOT` / `UNPIVOT`
- Date arithmetic: `DATEADD`, `DATEDIFF`, `DATE_TRUNC`
- Type conversion: `CAST`, `CONVERT`, `TRY_CAST`

**When Python wins (SQL cannot do these well):**

- Calling external APIs during a transform
- Complex regex beyond PATINDEX capability
- ML feature engineering (z-scores, normalization, encoding)
- Cross-database joins (SQL Server table + BigQuery table)
- Reading non-database sources (APIs, files, streams)
- Custom business logic with 10+ conditional branches
- Fuzzy string matching (Levenshtein, phonetic)

### PowerShell: When and Why

PowerShell occupies a specific niche. It is not a general-purpose scripting language — it is the Windows automation language.

| Use Case | PowerShell? | Alternative |
|----------|------------|-------------|
| Windows Task Scheduler automation | Yes | — |
| SQL Server administration (dbatools) | Yes | T-SQL for query-level ops |
| Active Directory / Windows Server | Yes | — |
| .NET object manipulation | Yes | C# for complex cases |
| File operations on Windows | Yes | Bash (via WSL) for Linux-style ops |
| GCP operations | No | Bash + gcloud |
| Data pipeline logic | No | Python |
| CI/CD on Linux runners | No | Bash |
| Cross-platform scripting | No | Python or Bash |

> [!note] PowerShell on Linux
> PowerShell Core (pwsh) runs on Linux, but the ecosystem assumes Windows. gcloud, Docker, kubectl, and terraform are all bash-first tools. Using PowerShell on Linux adds friction without benefit. Reserve PowerShell for Windows-specific automation. See [[windows-scheduling]] for Task Scheduler patterns.

---

## Database Selection: Which Database for Which Workload

### Primary Decision Matrix

| Factor | SQL Server (on VM) | BigQuery | Cloud SQL (PostgreSQL) | Firestore | Bigtable |
|--------|-------------------|----------|----------------------|-----------|----------|
| **Best for** | OLTP + OLAP hybrid, existing SQL Server shops | Analytics at any scale, ML, BI backend | Small-medium OLTP, PostgreSQL ecosystem | Real-time state, config, feature flags | Time-series at massive scale, IoT |
| **Scaling model** | Vertical (bigger VM) | Automatic (serverless) | Vertical + read replicas | Automatic (serverless) | Horizontal (add nodes) |
| **Cost model** | VM + license (or Linux free) | Per TB scanned + storage | Per instance hour + storage | Per operation + storage | Per node hour + storage |
| **Schema** | Fixed (relational, normalized or star) | Fixed (columnar, nested STRUCT/ARRAY) | Fixed (relational) | Flexible (document, nested) | Column families (wide-column) |
| **Query latency** | <1ms (indexed OLTP), seconds (OLAP) | 1-30s (cold), <5s (BI Engine cached) | <5ms (indexed) | <10ms (single doc) | <10ms (single row) |
| **Max practical data** | ~16 TB per database | Petabytes | ~64 TB | ~1 TB practical (1 MB per doc) | Petabytes |
| **Managed** | No (self-managed on Compute Engine) | Fully managed | Fully managed | Fully managed | Fully managed |
| **ACID transactions** | Full (serializable isolation) | DML transactions (limited) | Full (serializable isolation) | Document-level, multi-doc with limits | Single-row only |
| **Stored procedures** | Yes (T-SQL, extensive) | Yes (SQL, JavaScript UDFs) | Yes (PL/pgSQL) | No (use Cloud Functions) | No |
| **Backup/DR** | Manual (you manage) | Automatic (time travel) | Automatic (managed backups) | Automatic (multi-region) | Automatic (replication) |
| **Ecosystem** | SSMS, dbatools, SSIS, SSRS | bq CLI, Python SDK, Looker, dbt | pgAdmin, psql, rich extension ecosystem | Firebase SDK, Firestore SDK | cbt CLI, HBase API |

### Database Decision Flowchart

Follow this top-down. The first "yes" is your answer.

```
1. Do you need sub-10ms reads for real-time serving?
   ├── Yes → Is the data key-value or document-shaped?
   │         ├── Yes → Firestore (see [[firestore-data-model-and-operations]])
   │         └── No → Is the data time-series at >1 TB?
   │                   ├── Yes → Bigtable
   │                   └── No → SQL Server or Cloud SQL (indexed reads)
   └── No ↓

2. Do you need complex SQL analytics (joins, window functions, GROUP BY)?
   ├── Yes → Is the data >10 TB or growing unpredictably?
   │         ├── Yes → BigQuery (see [[querying-and-cost-optimization]])
   │         └── No → SQL Server (if you have it) or BigQuery (if starting fresh)
   └── No ↓

3. Do you need ACID transactions with stored procedures?
   ├── Yes → Do you have existing SQL Server expertise?
   │         ├── Yes → SQL Server (see [[sql-server-index]])
   │         └── No → Cloud SQL PostgreSQL
   └── No ↓

4. Do you need a document store for application state?
   ├── Yes → Firestore
   └── No ↓

5. Default: BigQuery for analytics, Firestore for state, SQL Server if already in place.
```

> [!warning] Migration Cost Is Real
> If you already run SQL Server and it handles your workload, the cost of migrating to BigQuery or Cloud SQL is measured in months of engineering time, regression testing, and retraining. "Better" technology does not justify migration unless the current system is failing. The decision to migrate should be driven by a specific pain point (cost, scale, features), not by preference.

### Detailed Comparison: SQL Server vs BigQuery

| Dimension | SQL Server (on GCE VM) | BigQuery |
|-----------|----------------------|----------|
| **Query model** | Row-oriented, B-tree indexes | Columnar, full-scan oriented |
| **Optimization strategy** | Create indexes, avoid scans | Partition, cluster, avoid SELECT * |
| **Concurrency** | Hundreds of connections | Thousands of concurrent queries |
| **Cost at 1 TB** | ~$200/mo (VM) + license | ~$5/mo storage + per-query cost |
| **Cost at 100 TB** | ~$2,000/mo (large VM) + license | ~$500/mo storage + per-query cost |
| **Real-time inserts** | Yes (INSERT, MERGE) | Yes (streaming inserts, $0.05/GB) |
| **Batch loads** | BULK INSERT, BCP, SSIS | bq load, GCS → BigQuery (free) |
| **Stored procedures** | Extensive (T-SQL) | Limited (SQL scripting, JS UDFs) |
| **Security model** | Logins, roles, schemas, RLS, TDE | IAM, column-level, row-level, VPC-SC |
| **Monitoring** | DMVs, wait stats, Datadog integration | INFORMATION_SCHEMA, Cloud Monitoring |
| **Backup** | Full/diff/log backups (you manage) | Automatic time travel (7 days free) |
| **Best at** | Transactional + analytical hybrid | Pure analytical at any scale |

See [[backup-types-and-strategy]] for SQL Server backup patterns. See [[querying-and-cost-optimization]] for BigQuery cost control.

### When to Add a Second Database

You need a second database when one database cannot serve two workloads without conflict:

| Signal | Action |
|--------|--------|
| Analytical queries blocking OLTP inserts | Offload analytics to BigQuery |
| Real-time UI reads competing with batch loads | Add Firestore for UI state |
| Time-series data growing beyond SQL Server capacity | Add Bigtable for metrics |
| Multiple teams need different query patterns | BigQuery for analytics, SQL Server for operations |
| Need to join external data (APIs, files) with warehouse data | BigQuery (external tables, federated queries) |

> [!important] The Two-Database Rule
> Most data engineering teams need exactly two databases: one for OLTP (SQL Server or Cloud SQL) and one for OLAP (BigQuery). Anything beyond two requires strong justification. Each additional database adds operational overhead: backups, monitoring, security, connection management, and a new failure mode.

---

## GCP Component Selection

### Compute: When to Use What

| Need | Use This | Why Not Alternatives |
|------|----------|---------------------|
| Long-running stateful service (SQL Server, Airflow) | **Compute Engine VM** | Cloud Run has 1h timeout; App Engine is for stateless web apps |
| Batch pipeline job (extract, transform, load) | **Cloud Run Job** | No idle cost; scales to zero; Docker-native. See [[cloud-run-jobs-vs-services]] |
| HTTP API endpoint | **Cloud Run Service** | Auto-scales, managed TLS, custom domains, 0 to N instances |
| Schedule a triggered job | **Cloud Scheduler + Cloud Run** | Do not run a VM 24/7 for a job that runs 3 times per day. See [[gcp-scheduling]] |
| Heavy Spark/Hadoop processing | **Dataproc** | When you need distributed compute beyond a single container |
| Stream processing | **Dataflow (Apache Beam)** | Managed, auto-scaling, exactly-once semantics. See [[streaming-architecture]] |
| Lightweight event-driven function | **Cloud Functions** | Cold start latency is acceptable, function completes in <9 min |
| GPU workloads (ML training) | **Compute Engine + GPU** or **Vertex AI** | Cloud Run does not support GPUs |
| Long-running batch (>1h) | **Compute Engine VM** (ephemeral) | Cloud Run Job max 1h; use preemptible VMs for cost savings |

#### Compute Decision Flowchart

```
1. Does it need to run 24/7?
   ├── Yes → Is it stateful (data on disk)?
   │         ├── Yes → Compute Engine VM (see [[vm-lifecycle]])
   │         └── No → Cloud Run Service (min-instances=1 if needed)
   └── No ↓

2. Is it triggered by an HTTP request?
   ├── Yes → Cloud Run Service
   └── No ↓

3. Is it triggered by a schedule?
   ├── Yes → Cloud Scheduler → Cloud Run Job (see [[gcp-scheduling]])
   └── No ↓

4. Is it triggered by a Pub/Sub message?
   ├── Yes → Cloud Run Service (Pub/Sub push) or Cloud Functions
   └── No ↓

5. Does it need >1 hour of execution time?
   ├── Yes → Compute Engine VM (ephemeral, preemptible)
   └── No → Cloud Run Job
```

> [!tip] The Zero-Idle-Cost Principle
> If a workload runs less than 50% of the time, it should not be on a VM. Cloud Run Jobs and Cloud Functions scale to zero. A VM running 24/7 for a job that runs 3 times per day wastes 99.9% of its uptime cost. See [[finops-cost-optimization]] for cost analysis patterns.

### Messaging: Pub/Sub vs Direct Calls vs Firestore

| Scenario | Use This | Why |
|----------|----------|-----|
| Decouple producer and consumer | **Pub/Sub** | Producer does not need to know who consumes |
| Fan-out to multiple consumers | **Pub/Sub** (multiple subscriptions) | One message, N subscribers. See [[pubsub-messaging]] |
| Buffer traffic bursts | **Pub/Sub** | Messages queue; consumers process at their pace |
| At-least-once delivery guarantee | **Pub/Sub** | Built-in acknowledgment and retry |
| Synchronous request-response | **Direct HTTP/gRPC** | Caller needs the response immediately |
| Single known consumer | **Direct HTTP** | Pub/Sub adds unnecessary indirection |
| Low latency required (<100ms) | **Direct HTTP/gRPC** | Pub/Sub adds 50-200ms per hop |
| Real-time UI state updates | **Firestore** | Real-time listeners push to clients. See [[firestore-data-model-and-operations]] |
| Config propagation across services | **Firestore** | All services watch the same document |
| Dead letter handling | **Pub/Sub** (dead letter topic) | Failed messages route to a DLQ for investigation |
| Ordered message processing | **Pub/Sub** (ordering key) | Messages with the same key processed in order |

> [!note] The Pub/Sub Default
> When in doubt between Pub/Sub and direct calls, choose Pub/Sub. The decoupling it provides is almost always worth the added complexity. The exception is when you need synchronous responses or sub-100ms latency. See [[pubsub-topics-and-subscriptions]] for configuration patterns.

### Storage: GCS vs BigQuery vs SQL Server

Every piece of data lives somewhere. The question is where, and the answer depends on how the data will be consumed.

| Data Type | Store In | Why | Format |
|-----------|----------|-----|--------|
| Raw API responses (landing zone) | **GCS** | Cheap, immutable, reprocessable | JSON / NDJSON |
| Raw file extracts (CSV, Excel) | **GCS** | Landing zone before transformation | Original format |
| Transformed analytical data | **BigQuery** | Query engine optimized for analytics | Native tables |
| Transactional operational data | **SQL Server** | ACID, low-latency reads, stored procs | Relational tables |
| Pipeline intermediate artifacts | **GCS** | Temporary, disposable, cheap | Parquet (see [[serialization-formats]]) |
| Large objects (images, PDFs, binaries) | **GCS** | Object storage, no size limits | Original format |
| Archived historical data | **GCS** (Coldline/Archive) | $0.004/GB/mo, 90-day minimum | Parquet (compressed) |
| ML training datasets | **GCS** → BigQuery | GCS for storage, BigQuery for feature queries | Parquet or TFRecord |
| Dashboard-ready aggregations | **BigQuery** (materialized views) | Pre-computed, auto-refreshed | Native tables |
| Application state and config | **Firestore** | Real-time reads, document-oriented | Documents |

#### The Medallion Mapping

How storage maps to the [[medallion-architecture]] layers:

| Layer | Primary Storage | Secondary | Purpose |
|-------|----------------|-----------|---------|
| **Bronze** (raw) | GCS (landing zone) | SQL Server (raw tables) | Exact copy of source data, immutable |
| **Silver** (cleaned) | SQL Server or BigQuery | — | Deduplicated, typed, validated |
| **Gold** (business) | BigQuery or SQL Server | Firestore (for serving) | Business aggregations, KPIs, features |

> [!important] The Single Source of Truth Rule
> Each dataset has exactly one authoritative storage location. Other locations are copies, caches, or materializations. When copies drift from the source, the source wins. Document the authoritative location for every dataset in your catalog. See [[context-and-metadata-architecture]] for metadata patterns.

### Networking and Security Selection

| Need | Use This | Notes |
|------|----------|-------|
| Secure access to VMs from laptop | **IAP tunneling** | No public IP needed. See [[iap-tunneling]] |
| Service-to-service authentication | **Service accounts** | Workload identity for GKE. See [[service-accounts-and-iam]] |
| Restrict data access to VPC | **VPC Service Controls** | Prevents data exfiltration. See [[vpc-service-controls]] |
| Encrypt data at rest (SQL Server) | **TDE** | Transparent Data Encryption. See [[tde-encryption]] |
| API authentication | **OAuth 2.0 / API keys** | OAuth for user-context, API keys for service-context |
| Secret management | **Secret Manager** | Never hardcode credentials. See [[terraform-iam-and-secrets]] |
| Network between VMs | **VPC + firewall rules** | Least-privilege firewall rules. See [[firewalls]] |

---

## Orchestration Selection: When to Use What

### Primary Decision Matrix

| Factor | Airflow (self-hosted) | Cloud Composer | Cron (Linux) | Cloud Scheduler | Windows Task Scheduler |
|--------|----------------------|----------------|-------------|-----------------|----------------------|
| **Best for** | Complex DAGs with dependencies, retries, branching | Same as Airflow, fully managed | Simple recurring tasks, single-server | Triggering Cloud Run/Functions on schedule | Windows-only scheduled tasks |
| **Monthly cost** | ~$50-150 (VM) | $300+ minimum | Free | ~$0.10/job/month | Free (Windows license) |
| **Dependency management** | Yes (DAG graph, sensors, triggers) | Yes (same engine) | No | No | No |
| **Retry logic** | Built-in (configurable per task) | Built-in | Manual (wrapper script) | HTTP retry only | Basic retry settings |
| **Alerting** | Email, Slack, PagerDuty (via callbacks) | Same + Cloud Monitoring | Manual (mail/curl in script) | Cloud Monitoring | Windows Event Log |
| **UI** | Webserver dashboard with Gantt charts | Same (managed) | None | Console only | Task Scheduler GUI |
| **Backfill support** | Yes (date-parameterized runs) | Yes | Manual | Manual | Manual |
| **Logging** | Task logs in webserver UI | Same + Cloud Logging | stdout/stderr to files | Cloud Logging | Windows Event Log |
| **Dynamic DAGs** | Yes (generate DAGs from config) | Yes | No | No | No |
| **Cross-task data passing** | XComs (small data), GCS (large data) | Same | Files, environment variables | HTTP payload | Files, registry |
| **Setup complexity** | Medium (Docker Compose or VM install) | Low (managed) | Trivial | Low | Low |
| **Maintenance burden** | Medium (upgrades, DB cleanup, log rotation) | Low (Google manages) | Minimal | None | Minimal |

### Orchestration Decision Flowchart

```
1. How many scheduled jobs do you have?
   ├── <5, no dependencies between them
   │   ├── All on Linux → cron (see [[linux-scheduling]])
   │   ├── All on Windows → Task Scheduler (see [[windows-scheduling]])
   │   └── Triggering GCP services → Cloud Scheduler (see [[gcp-scheduling]])
   └── 5+ jobs, OR dependencies exist ↓

2. Do jobs have dependencies (Job B waits for Job A)?
   ├── No → Cloud Scheduler + Cloud Run Jobs (one per job)
   └── Yes ↓

3. What is your monthly budget for orchestration?
   ├── <$300/mo → Self-hosted Airflow on a VM (see [[airflow-deployment]])
   └── $300+/mo → Cloud Composer (if team is 3+ people)

4. Do you need backfill capability (re-run for past dates)?
   ├── Yes → Airflow (self-hosted or Composer)
   └── No → Cloud Scheduler may suffice even with light dependencies
```

> [!tip] The Orchestration Escalation Path
> Start simple, escalate when forced:
> 1. **Cron/Cloud Scheduler** — single jobs, no dependencies
> 2. **Self-hosted Airflow** — dependencies appear, need backfills, 5-20 DAGs
> 3. **Cloud Composer** — 20+ DAGs, team of 3+, want managed infrastructure
>
> Do not start with Cloud Composer. Its $300+/month minimum is wasted on <10 DAGs that a single Airflow VM handles for $50-100/month. See [[airflow-core-concepts]] for DAG design patterns.

### Airflow-Specific Decisions

| Decision | Recommendation | Why |
|----------|---------------|-----|
| Executor type (self-hosted) | **LocalExecutor** for <20 DAGs, **CeleryExecutor** for 20+ | LocalExecutor is simpler; Celery adds worker scaling |
| Database backend | **PostgreSQL** | SQLite is single-writer only; MySQL works but PostgreSQL is better supported |
| Run Airflow in Docker? | **Yes** (Docker Compose) | Reproducible, version-pinned, easy upgrades. See [[airflow-deployment]] |
| Store DAGs in Git? | **Yes** (always) | DAGs are code; they belong in version control |
| Trigger DAGs externally? | **Airflow REST API** | Better than SSH + `airflow dags trigger` |
| Pass data between tasks? | **XComs** for <48 KB, **GCS** for larger | XComs stored in Airflow DB; large data chokes the DB. See [[airflow-dag-patterns]] |
| Monitor DAG health? | **Datadog Airflow integration** | Metrics on task duration, failure rate, queue depth. See [[datadog-airflow-observability]] |

### Event-Driven Orchestration (Not Scheduled)

When work is triggered by events rather than time:

| Trigger | Mechanism | Use Case |
|---------|-----------|----------|
| File lands in GCS | GCS notification → Pub/Sub → Cloud Run | Process uploaded files on arrival |
| Database row changes | CDC → Pub/Sub → consumer | Real-time replication. See [[streaming-architecture]] |
| API webhook received | Cloud Run Service (HTTP endpoint) | SaaS integration (Stripe, GitHub, etc.) |
| Airflow DAG completes | TriggerDagRunOperator or Pub/Sub | Chain DAGs across Airflow instances |
| Manual trigger (ad hoc) | Airflow UI or REST API | Backfills, one-off reprocessing |

---

## Infrastructure: Terraform vs gcloud CLI vs Console

### Primary Decision Matrix

| Scenario | Use This | Why |
|----------|----------|-----|
| Production infrastructure | **Terraform** | Reproducible, version-controlled, reviewable in PRs |
| Quick one-off investigation | **gcloud CLI** | Fast, no state file management needed |
| Learning / exploring a new service | **Console (UI)** | Visual, discoverable, no syntax to learn |
| CI/CD pipeline operations | **gcloud CLI** | Scriptable, idempotent commands, GitHub Actions native |
| Disaster recovery rebuild | **Terraform** | `terraform apply` rebuilds the entire environment |
| Temporary dev/test resources | **gcloud CLI** | Create, test, delete — no state to clean up |
| Multi-environment (dev/staging/prod) | **Terraform** (workspaces or directories) | Same code, different variables per environment |
| IAM and security configuration | **Terraform** | Auditable history of who has access to what |
| One-time data migration | **gcloud CLI** or **bq CLI** | Terraform is overkill for a one-shot operation |
| Networking (VPC, firewall, subnets) | **Terraform** | Network changes are high-risk; review process required |

### The Infrastructure Rule

> [!important] The Terraform Rule
> - **If it exists in production, it is in Terraform.** No exceptions. If someone creates a resource via Console or gcloud and does not add it to Terraform, it will drift, be forgotten, and eventually cause an incident.
> - **If it is temporary, use gcloud CLI.** Do not pollute Terraform state with throwaway resources.
> - **If you are learning, use Console.** Then translate to Terraform once you understand the resource.
>
> See [[terraform-plan-apply-destroy]] for the apply workflow and [[moc-infrastructure-as-code]] for the full IaC reference.

### Terraform-Specific Decisions

| Decision | Recommendation | Why |
|----------|---------------|-----|
| State backend | **GCS bucket** | Remote, lockable, versioned. See [[terraform-state-management]] |
| Module structure | **One module per logical resource group** | VM + disk + firewall = one module. See [[terraform-module-composition]] |
| Variable management | **tfvars files per environment** | `dev.tfvars`, `prod.tfvars` — same code, different values |
| Secret handling | **Secret Manager** (referenced, not stored in state) | Never put secrets in tfvars or state. See [[terraform-iam-and-secrets]] |
| Plan review | **Always `terraform plan` before `apply`** | No blind applies. Review the diff. |
| Import existing resources | **`terraform import` + write matching config** | Brings Console-created resources under management |
| Provider versioning | **Pin major + minor version** | `~> 5.0` allows patch updates, blocks breaking changes |
| CI/CD integration | **GitHub Actions: plan on PR, apply on merge** | See [[github-actions-workflows]] for workflow patterns |

### gcloud CLI: When It Shines

| Task | gcloud Command Pattern | Why Not Terraform |
|------|----------------------|-------------------|
| Check VM status | `gcloud compute instances describe` | Read-only; no state change |
| Tail logs | `gcloud logging read` | Ephemeral query, not infrastructure |
| Deploy Cloud Run (dev) | `gcloud run deploy` | Faster iteration than `terraform apply` |
| List IAM bindings | `gcloud projects get-iam-policy` | Audit, not management |
| SSH into VM | `gcloud compute ssh` | Session, not infrastructure |
| Upload to GCS | `gsutil cp` / `gcloud storage cp` | Data operation, not infra |
| BigQuery query | `bq query` | Data operation, not infra |
| One-time service enable | `gcloud services enable` | If done once and never changed |

See [[gcloud-cheat-sheet]] for common command patterns.

---

## Data Model Selection

Quick decision table for choosing a data modeling approach. Each links to the detailed note with full DDL examples.

| Your Situation | Model | Key Characteristics | Detailed Reference |
|----------------|-------|--------------------|--------------------|
| Building a BI warehouse with known queries | **Star schema (Kimball)** | Fact + dimension tables, optimized for JOIN + GROUP BY | [[dimensional-modeling]] |
| Enterprise with many source systems, need auditability | **Data Vault 2.0** | Hub-link-satellite, handles schema changes gracefully | [[data-modeling-patterns]] |
| Fast dashboards from a single wide table | **One Big Table (OBT)** | Fully denormalized, no joins at query time | [[data-modeling-patterns]] |
| Event analytics, audit trails, clickstream | **Activity schema** | Entity + activity + timestamp, append-only | [[data-modeling-patterns]] |
| Market data, IoT sensor data, system metrics | **Time-series** | Timestamp-partitioned, append-heavy, range queries | [[data-modeling-patterns]] |
| Application state, feature flags, user config | **Document (Firestore)** | Nested JSON-like structure, flexible schema | [[firestore-data-model-and-operations]] |
| Relationship analysis (fraud detection, social graphs) | **Graph** | Nodes + edges, optimized for traversal queries | [[data-modeling-patterns]] |
| Multi-layer analytics pipeline | **Medallion (Bronze/Silver/Gold)** | Layered refinement from raw to business-ready | [[medallion-architecture]] |

### Model Selection Flowchart

```
1. Is the primary consumer a BI tool (dashboards, reports)?
   ├── Yes → Star schema (Kimball). Period.
   └── No ↓

2. Is the data time-series (timestamped measurements)?
   ├── Yes → Time-series model with timestamp partitioning
   └── No ↓

3. Is the data event-based (user actions, system events)?
   ├── Yes → Activity schema
   └── No ↓

4. Are there many source systems feeding one warehouse?
   ├── Yes → Data Vault 2.0 for the integration layer, star schema for the presentation layer
   └── No ↓

5. Is this application state (not analytics)?
   ├── Yes → Document model (Firestore)
   └── No ↓

6. Default: Star schema for analytics, document for application state.
```

> [!tip] The Modeling Principle
> Model for the **consumer**, not the source. A BI analyst needs star schemas. An application needs document access patterns. An ML engineer needs wide feature tables. Start from how the data will be read and work backward to how it should be stored.

---

## API Protocol Selection

Quick decision table for choosing an API protocol. Each links to the detailed note with implementation patterns.

| Your Situation | Protocol | Latency | Throughput | Detailed Reference |
|----------------|----------|---------|------------|-------------------|
| Consuming external vendor APIs | **REST** | ~100-500ms | Moderate | [[rest-api-design-and-consumption]] |
| High-throughput internal service communication | **gRPC** | ~1-10ms | Very high (streaming, binary) | [[grpc-for-data-pipelines]] |
| Flexible data queries from multiple consumers | **GraphQL** | ~50-200ms | Moderate | [[graphql-for-data-access]] |
| Real-time bidirectional data feed | **WebSocket** | ~1-5ms | High (persistent connection) | [[api-protocols-comparison]] |
| Receiving push events from SaaS platforms | **Webhook** | N/A (push) | Depends on sender | [[api-protocols-comparison]] |
| Batch data transfer between systems | **File-based (GCS)** | Minutes | Very high (bulk) | [[serialization-formats]] |

### Protocol Decision Flowchart

```
1. Are you consuming a third-party API?
   ├── Yes → Use whatever they offer (usually REST)
   └── No (building your own) ↓

2. Is this internal service-to-service?
   ├── Yes → Is latency critical (<10ms)?
   │         ├── Yes → gRPC (binary, streaming)
   │         └── No → REST (simpler, more tooling)
   └── No (external-facing) ↓

3. Do multiple consumers need different data shapes?
   ├── Yes → GraphQL (flexible queries)
   └── No ↓

4. Do you need real-time bidirectional communication?
   ├── Yes → WebSocket
   └── No → REST (default for external APIs)
```

> [!note] REST Is the Default
> When in doubt, use REST. It has the widest tooling support, the most documentation, and every engineer knows how to consume it. Only deviate to gRPC (for internal performance), GraphQL (for flexible querying), or WebSocket (for real-time bidirectional) when REST's limitations are specifically blocking you. See [[api-protocols-comparison]] for the full trade-off analysis.

---

## Architecture Selection

Choosing the right data architecture is the highest-leverage decision in a data platform. Get it right, and everything else follows. Get it wrong, and you spend years working around the mismatch.

### Primary Decision Matrix

| Your Situation | Architecture | Cost Profile | Complexity | Detailed Reference |
|----------------|-------------|-------------|------------|-------------------|
| Structured analytics, known query patterns | **Data Warehouse** | Medium (compute + storage) | Low-medium | [[data-warehouse-architecture]] |
| Unstructured data, schema-on-read flexibility | **Data Lake** | Low (storage-heavy) | Medium | [[data-lake-architecture]] |
| Both structured and unstructured, ACID needed | **Lakehouse** | Medium | Medium-high | [[lakehouse-architecture]] |
| Multiple teams, domain-driven data ownership | **Data Mesh** | High (organizational overhead) | High | [[data-mesh-architecture]] |
| Sub-second latency, event-driven processing | **Streaming** | High (always-on compute) | High | [[streaming-architecture]] |
| Standard pipeline layering (raw → clean → business) | **Medallion** | Depends on storage choice | Low | [[medallion-architecture]] |

### Architecture Decision Flowchart

```
1. Is your data primarily structured (tables, schemas)?
   ├── Yes → Do you need sub-second processing?
   │         ├── Yes → Streaming architecture
   │         └── No → Data Warehouse (Kimball star schema)
   └── No (or mixed) ↓

2. Do you have unstructured data (images, logs, text)?
   ├── Yes → Do you also need SQL analytics on it?
   │         ├── Yes → Lakehouse (BigLake, Delta Lake, Iceberg)
   │         └── No → Data Lake (GCS zones)
   └── No ↓

3. Do multiple teams need independent data products?
   ├── Yes → Data Mesh (organizational pattern, not a technology)
   └── No ↓

4. Default: Data Warehouse with Medallion layering.
```

> [!important] The Medallion Architecture Is Not an Alternative
> Medallion (Bronze/Silver/Gold) is a **layering pattern**, not a competing architecture. You can apply Medallion inside a Data Warehouse, a Data Lake, or a Lakehouse. It defines how data flows through refinement stages. Every architecture in this table benefits from Medallion layering. See [[medallion-architecture]] for the layer definitions and [[etl-vs-elt]] for where transforms happen.

### Architecture Combinations (Real-World)

Most production systems combine multiple patterns:

| Combination | When It Works | Example |
|------------|---------------|---------|
| Warehouse + Medallion | Standard analytical platform | SQL Server Bronze/Silver → BigQuery Gold |
| Lake + Warehouse | Raw storage + analytical queries | GCS landing zone → BigQuery analytical layer |
| Lakehouse + Streaming | Real-time analytics on mixed data | Pub/Sub → Dataflow → BigLake (Iceberg) |
| Mesh + Warehouse | Large org with autonomous teams | Each team owns a domain warehouse, federated via BigQuery |
| Warehouse + Streaming | Batch + real-time in one platform | BigQuery (batch) + Pub/Sub → Dataflow (real-time) |

---

## Build vs Buy Decision Framework

The most consequential decision in engineering is not which technology to use — it is whether to build the capability yourself or buy it from a vendor.

### Primary Decision Matrix

| Factor | Build (Custom Code) | Buy (Managed Service / SaaS) |
|--------|--------------------|-----------------------------|
| **Cost at low scale** | Lower (just compute + engineering time) | Higher (per-seat or per-unit pricing) |
| **Cost at high scale** | Higher (engineering time dominates) | Lower (amortized across vendor's customer base) |
| **Time to value** | Weeks to months | Days to weeks |
| **Customization** | Unlimited (you own the code) | Limited to vendor's API and configuration |
| **Maintenance burden** | On you, forever (upgrades, patches, bugs) | On the vendor (you pay for this) |
| **Vendor lock-in risk** | None | Medium to high (data gravity, API dependency) |
| **Hiring requirements** | Need specialists who can build and maintain | Less specialized team can operate |
| **Reliability** | Depends on your team's skill | Usually high (vendor's reputation depends on it) |
| **Feature velocity** | Limited by your team's bandwidth | Vendor ships features for all customers |
| **Knowledge retention** | In your codebase (risk if key people leave) | In vendor's product (survives team changes) |

### The Build vs Buy Rule

> [!important] The Core Principle (Reis & Housley)
> **"Build what differentiates your business. Buy everything else."**
>
> If a capability is your competitive advantage — the unique thing that makes your product better than alternatives — build it. You need full control, deep customization, and the ability to iterate faster than any vendor can. For everything else, buy. Your time is better spent on differentiation than on reinventing infrastructure that thousands of other companies also need.

### Applied Examples

| Capability | Build or Buy | Specific Choice | Reasoning |
|-----------|-------------|-----------------|-----------|
| Orchestration | **Buy** (managed) or **Semi-build** | Cloud Composer or self-hosted Airflow | Orchestration is not your competitive advantage; reliability is table stakes |
| Monitoring | **Buy** | Datadog or GCP Cloud Monitoring | Building an observability platform is a full-time job for a team. See [[datadog-architecture-overview]] |
| Data warehouse | **Buy** | BigQuery | Never build your own query engine. See [[querying-and-cost-optimization]] |
| Custom scoring model | **Build** | Python + SQL Server + BigQuery | This IS your competitive advantage — full control required |
| ETL framework | **Buy** for standard sources, **Build** for custom | dbt (transforms), Fivetran (ingestion), custom Python (APIs) | Standard connectors are commoditized; custom sources need custom code |
| Dashboards | **Buy** or **Semi-build** | Looker (buy) or Blazor (semi-build) | Depends on customization needs and existing skills |
| CI/CD | **Buy** | GitHub Actions | CI/CD is infrastructure, not differentiation. See [[github-actions-workflows]] |
| Secret management | **Buy** | GCP Secret Manager | Never roll your own cryptography or secret storage |
| Log aggregation | **Buy** | Datadog Logs or Cloud Logging | Building log infrastructure is not your job. See [[datadog-log-management]] |
| Data quality checks | **Semi-build** | dbt tests + custom Python assertions | dbt handles standard checks; custom business rules need custom code |
| Schema registry | **Buy** | Confluent Schema Registry or BigQuery schema | Unless you have unique schema evolution needs |
| Feature store | **Build** (usually) | BigQuery + Firestore | ML feature stores are domain-specific; generic tools rarely fit |

### The Semi-Build Pattern

Many decisions are not pure build or pure buy. The "semi-build" pattern uses a managed foundation with custom logic on top:

| Foundation (Buy) | Custom Layer (Build) | Result |
|-----------------|---------------------|--------|
| Airflow (orchestration engine) | Custom DAGs, operators, plugins | Managed scheduling + custom pipeline logic |
| dbt (transform framework) | Custom SQL models, macros, tests | Managed workflow + custom business transforms |
| BigQuery (query engine) | Custom UDFs, stored procedures, views | Managed compute + custom analytical logic |
| Docker (container runtime) | Custom Dockerfiles, entrypoints | Managed isolation + custom application packaging |
| GitHub Actions (CI engine) | Custom workflows, composite actions | Managed runners + custom deployment logic |
| Terraform (IaC engine) | Custom modules, providers | Managed state + custom infrastructure patterns |

> [!tip] The Vendor Lock-In Test
> Before choosing "buy," ask: "What happens if this vendor doubles their price or shuts down?" If the answer is "we rewrite everything," the lock-in risk is high. Mitigate by:
> 1. Using open standards (SQL, Parquet, OpenTelemetry) where possible
> 2. Keeping raw data in a format you control (GCS + Parquet, not only in the vendor's proprietary format)
> 3. Abstracting vendor-specific APIs behind your own interfaces
> See [[serialization-formats]] for portable data format choices.

---

## Monitoring and Observability Selection

### What to Monitor With What

| What You Monitor | Tool | Why |
|-----------------|------|-----|
| SQL Server performance (wait stats, queries) | **Datadog** (SQL Server integration) | Deep metrics, custom queries, alerting. See [[datadog-sql-server-integration]] |
| Airflow DAG health (task duration, failures) | **Datadog** (Airflow integration) | Correlate DAG failures with infrastructure metrics. See [[datadog-airflow-observability]] |
| GCP resource usage and billing | **Cloud Monitoring** | Native, free for GCP metrics, tight IAM integration |
| Application logs (structured) | **Cloud Logging** or **Datadog Logs** | Cloud Logging is free tier; Datadog for cross-platform. See [[cloud-logging]] |
| Pipeline SLA compliance | **Cloud Monitoring** + custom metrics | Track pipeline freshness against SLAs. See [[gcp-pipeline-health-and-sla]] |
| Infrastructure dashboards | **Datadog** | Unified view across SQL Server, Airflow, GCP. See [[datadog-dashboards]] |
| Cost anomaly detection | **GCP Billing alerts** + **Cloud Monitoring** | Catch runaway queries or forgotten VMs. See [[finops-cost-optimization]] |
| Distributed traces | **Cloud Trace** or **Datadog APM** | Track requests across services. See [[datadog-apm-traces]] |
| Data lineage and cataloging | **GCP Data Catalog** or **dbt docs** | Track where data comes from and where it goes. See [[gcp-data-lineage-and-catalog]] |
| Uptime and endpoint health | **Cloud Monitoring** (uptime checks) | Synthetic checks on HTTP endpoints. See [[gcp-cloud-monitoring-deep-dive]] |

> [!note] The Observability Stack Rule
> You need three pillars: **metrics** (how much), **logs** (what happened), and **traces** (where time went). A single tool that covers all three is better than three separate tools. Datadog covers all three but costs money. GCP Cloud Monitoring + Cloud Logging + Cloud Trace covers all three within GCP but lacks cross-platform visibility. Choose based on whether your stack is GCP-only or hybrid. See [[observability-deep-dive]] for the full framework.

---

## CI/CD and Deployment Selection

### Deployment Strategy by Workload

| Workload | Deployment Method | Why |
|----------|------------------|-----|
| Airflow DAGs | **Git push → sync to DAGs folder** | DAGs are Python files; deploy = copy to the right directory. See [[airflow-deployment]] |
| Cloud Run services/jobs | **GitHub Actions → `gcloud run deploy`** | Build Docker image, push to Artifact Registry, deploy. See [[github-actions-workflows]] |
| Terraform infrastructure | **GitHub Actions → `terraform plan/apply`** | Plan on PR, apply on merge to main |
| SQL Server schema changes | **Migration scripts (sequential, idempotent)** | Version-controlled .sql files. See [[migration-idempotency-backfills]] |
| dbt models | **GitHub Actions → `dbt build`** | Test and deploy SQL transforms. See [[dbt-transformation-layer]] |
| Python packages | **GitHub Actions → build + publish** | pip-installable packages for shared libraries |
| Docker images | **GitHub Actions → build + push to Artifact Registry** | See [[image-management]] for image patterns |

### Testing Strategy by Layer

| Layer | Test Type | Tool | When |
|-------|-----------|------|------|
| SQL transforms | **dbt tests** (schema + custom) | dbt test | On every PR, before deploy |
| Python pipeline code | **Unit tests** (pytest) | pytest | On every PR. See [[python-pipeline-execution]] |
| API endpoints | **Integration tests** | pytest + httpx | On every PR |
| Infrastructure | **Terraform plan review** | terraform plan | On every PR. See [[terraform-plan-apply-destroy]] |
| Data quality | **Row counts, null checks, uniqueness** | dbt tests or custom SQL | After every pipeline run |
| End-to-end pipeline | **Smoke test on staging** | Custom script | Before production deploy |
| Docker images | **Container scan + build test** | Trivy, `docker build` | On every PR. See [[container-lifecycle]] |

---

## Container and Runtime Selection

### Docker vs Bare Metal vs Managed Runtime

| Scenario | Use This | Why |
|----------|----------|-----|
| Pipeline jobs with specific dependencies | **Docker (Cloud Run Job)** | Isolated, reproducible, version-pinned. See [[cloud-run-jobs-vs-services]] |
| Long-running stateful service | **Docker on Compute Engine** | Need persistent disk + specific OS config |
| SQL Server | **Bare metal (on VM)** | SQL Server licensing and performance tuning need direct OS access |
| Airflow | **Docker Compose (on VM)** | Reproducible setup, easy upgrades. See [[docker-compose]] |
| Quick script execution | **Direct Python/Bash** | Docker overhead not justified for a 10-second script |
| Multi-service local dev | **Docker Compose** | Spin up DB + app + worker in one command |
| Production Kubernetes | **GKE Autopilot** | Only if you have 10+ services and a dedicated platform team |

### Docker Decision Rules

> [!tip] When to Dockerize
> - **Always Dockerize** if the code runs on Cloud Run (it requires a container image)
> - **Always Dockerize** if the code has complex dependencies (specific Python version + system libraries)
> - **Always Dockerize** if multiple engineers need to run the same environment
> - **Skip Docker** for simple scripts with no special dependencies
> - **Skip Docker** for SQL-only operations (dbt, T-SQL scripts)
> - **Skip Docker** for one-off gcloud CLI operations
>
> See [[container-lifecycle]] for image building and [[image-management]] for registry patterns.

---

## Version Control and Collaboration Selection

### Git Workflow by Team Size

| Team Size | Workflow | Why |
|-----------|---------|-----|
| Solo developer | **Trunk-based** (commit to main) | No merge overhead, fast iteration |
| 2-3 developers | **Feature branches + PRs** | Code review without ceremony. See [[pull-requests-and-code-review]] |
| 4+ developers | **Feature branches + required reviews** | Enforce standards, catch issues early |
| Multiple teams | **Feature branches + CODEOWNERS** | Automatic reviewer assignment |

See [[git-daily-workflow]] for daily patterns and [[git-branching-and-merging]] for branch strategies.

---

## Cost Optimization Decision Framework

When choosing between technologies, cost is a dimension — not the only dimension, but one that compounds over time.

### Cost Comparison by Workload Pattern

| Workload Pattern | Cheap Option | Expensive Option | Threshold |
|-----------------|-------------|-----------------|-----------|
| Compute that runs <2 hours/day | Cloud Run Job | Compute Engine VM (24/7) | VM wastes 91% of uptime cost |
| Compute that runs 24/7 | Compute Engine VM (committed use) | Cloud Run (per-request pricing) | Cloud Run per-request cost exceeds VM at ~50% utilization |
| Analytics on <1 TB | SQL Server (existing VM) | BigQuery (per-query) | If SQL Server is already running, marginal cost is zero |
| Analytics on >10 TB | BigQuery (flat-rate or per-TB) | SQL Server (massive VM) | SQL Server VM cost explodes at scale |
| Storage (frequently accessed) | GCS Standard | BigQuery storage | GCS is $0.020/GB/mo; BigQuery active is $0.020/GB/mo (same) |
| Storage (rarely accessed) | GCS Coldline ($0.004/GB/mo) | Any active storage tier | 5x savings for archival data |
| Orchestration (<10 DAGs) | Self-hosted Airflow (~$75/mo) | Cloud Composer (~$350/mo) | 4.5x cost difference for same capability |
| Orchestration (50+ DAGs) | Cloud Composer (~$500/mo) | Self-hosted Airflow (multiple VMs + ops time) | Ops time exceeds Composer premium |
| Monitoring | Cloud Monitoring (free tier) | Datadog (~$23/host/mo) | Datadog justified when managing 5+ services |

> [!tip] The FinOps Decision Rule
> Cost optimization is not about choosing the cheapest option — it is about choosing the option with the best cost-to-value ratio for your specific workload pattern. A $350/month Cloud Composer that saves 10 hours/month of ops work is cheaper than a $75/month self-hosted Airflow that requires 10 hours/month of maintenance. See [[finops-cost-optimization]] for detailed cost analysis.

### Reserved vs On-Demand Decisions

| Resource | Reserved (Committed Use) | On-Demand | Decision Rule |
|----------|------------------------|-----------|-|
| Compute Engine VMs | 1-year CUD: 37% discount, 3-year: 55% | Full price | If VM runs 24/7 for >6 months, commit |
| BigQuery | Flat-rate slots | Per-TB scanned | If monthly scan >10 TB consistently, evaluate flat-rate |
| Cloud SQL | — | Per instance hour | Use smallest instance that meets latency SLA |
| Bigtable | — | Per node hour | Nodes are expensive; auto-scaling helps but has minimums |

---

## Serialization Format Selection

When data moves between systems, the format matters for performance, compatibility, and cost.

| Scenario | Format | Why | Detailed Reference |
|----------|--------|-----|-------------------|
| Data warehouse staging (analytics) | **Parquet** | Columnar, compressed, partition-friendly | [[serialization-formats]] |
| API responses | **JSON** | Universal, human-readable, every language parses it | [[rest-api-design-and-consumption]] |
| High-throughput service communication | **Protocol Buffers** | Binary, schema-enforced, smallest wire size | [[grpc-for-data-pipelines]] |
| Configuration files | **YAML** or **JSON** | Human-readable, widely supported | — |
| Log data (append-heavy) | **NDJSON** (newline-delimited JSON) | One record per line, streamable, grep-friendly | — |
| Small CSV exchanges | **CSV** | Universal, Excel-compatible | [[data-formats-and-serialization]] |
| Large dataset archival | **Parquet + Snappy compression** | Best compression-to-read-speed ratio | [[parquet-files]] |
| ML training data | **Parquet** or **TFRecord** | Parquet for tabular, TFRecord for TensorFlow | — |
| Schema evolution required | **Avro** or **Parquet** | Both support schema evolution | [[serialization-formats]] |

> [!note] The Parquet Default
> When moving data between pipeline stages, default to Parquet. It is columnar (efficient for analytical queries), compressed (cheap to store), self-describing (schema embedded), and supported by every major tool (BigQuery, Spark, pandas, Polars, dbt). The only exceptions are when you need human readability (use JSON) or streaming (use NDJSON). See [[parquet-files]] for detailed usage patterns.

---

## Decision Anti-Patterns

Common mistakes when selecting technology — and the correction:

| Anti-Pattern | Why It Fails | Correction |
|-------------|-------------|------------|
| **Resume-driven development** | Choosing tech because it looks good on a resume, not because it fits the problem | Choose boring technology that solves the problem. Excitement fades; maintenance does not. |
| **Premature optimization** | Choosing Bigtable or Kafka "for scale" when you have 100 MB of data | Start with the simplest option. Migrate when you hit a real limit, not an imagined one. |
| **Shiny object syndrome** | Adopting every new tool (Pulumi over Terraform, Dagster over Airflow) | New tools must be 10x better to justify the switching cost. Incremental improvements do not clear the bar. |
| **Not-invented-here** | Building custom solutions for solved problems (custom orchestrator, custom monitoring) | Build only what differentiates. Buy everything else. |
| **Vendor worship** | Assuming the vendor's recommended architecture is right for your scale | Vendor architectures are designed for their largest customers. Evaluate at your actual scale. |
| **Ignoring migration cost** | Choosing the "best" database without accounting for the 6-month migration effort | The second-best technology that you already run often beats the best technology that requires migration. |
| **Over-engineering** | Kubernetes for 3 services, Data Mesh for a 2-person team, Kafka for 100 events/day | Match the solution complexity to the problem complexity. |
| **Under-engineering** | Cron + bash for 50 interconnected pipelines with retry requirements | Recognize when you have outgrown a simple tool and it is time to escalate. |
| **Single-tool thinking** | Trying to do everything in Python (including what SQL does better) or everything in SQL (including what Python does better) | Use each tool for what it does best. Polyglot engineering is a strength. |
| **Ignoring team skills** | Choosing Go because it is "better for APIs" when your entire team writes Python | The best technology is the one your team can operate reliably. Skill gaps take months to close. |

---

## Quick-Reference: "Which Tool For..." Lookup

For rapid lookup when you just need the answer:

### "I need to..."

| Task | Answer | Note Reference |
|------|--------|---------------|
| ...transform data in a database | SQL | [[sql-python-csharp-transforms]] |
| ...call an API and load results | Python | [[rest-api-design-and-consumption]] |
| ...schedule a daily job | Cloud Scheduler + Cloud Run Job | [[gcp-scheduling]] |
| ...orchestrate 10+ dependent jobs | Airflow | [[airflow-core-concepts]] |
| ...provision a VM | Terraform | [[terraform-compute]] |
| ...do a quick one-off query in BigQuery | bq CLI or Console | [[querying-and-cost-optimization]] |
| ...move files between servers | Bash (rsync/scp) | [[vm-ssh-and-file-transfer]] |
| ...build a dashboard | Blazor (C#) or Looker | — |
| ...store pipeline state | Firestore | [[firestore-data-model-and-operations]] |
| ...send data between services | Pub/Sub | [[pubsub-messaging]] |
| ...monitor SQL Server | Datadog | [[datadog-sql-server-integration]] |
| ...version-control infrastructure | Terraform + Git | [[terraform-state-management]] |
| ...containerize a Python pipeline | Docker | [[container-lifecycle]] |
| ...test data quality | dbt tests | [[dbt-transformation-layer]] |
| ...parse a log file quickly | Bash (grep/awk) | [[grep-and-pattern-matching]] |
| ...manage SQL Server backups | T-SQL + PowerShell | [[backup-types-and-strategy]] |
| ...set up CI/CD for a pipeline | GitHub Actions | [[github-actions-workflows]] |
| ...encrypt data at rest | TDE (SQL Server) or GCS encryption | [[tde-encryption]] |
| ...manage service accounts | Terraform + IAM | [[service-accounts-and-iam]] |
| ...explore a new GCP service | Console (UI), then translate to Terraform | [[gcp-projects-and-apis]] |
| ...handle schema migrations | Idempotent SQL scripts | [[migration-idempotency-backfills]] |
| ...choose a data format for transfer | Parquet | [[serialization-formats]] |
| ...set up Airflow on a VM | Docker Compose | [[airflow-deployment]] |
| ...connect Python to SQL Server | pyodbc or SQLAlchemy | [[database-connections]] |
| ...optimize BigQuery costs | Partitioning + clustering + avoid SELECT * | [[querying-and-cost-optimization]] |
| ...debug slow SQL Server queries | Wait stats + execution plans | [[wait-stats-analysis]] |
| ...design a data model for BI | Star schema (Kimball) | [[dimensional-modeling]] |
| ...audit who has access to what | IAM policy review | [[service-accounts-and-iam]] |
| ...set up alerting for pipeline failures | Datadog monitors or Cloud Alerting | [[datadog-alerting]] |
| ...process streaming data | Dataflow (Apache Beam) | [[streaming-architecture]] |

---

## Related Notes

**Architecture and modeling:**
- [[data-architecture-index]] — full section index
- [[five-pillars-of-data-engineering]] — the principles behind every decision
- [[moc-data-pipeline-lifecycle]] — end-to-end pipeline patterns
- [[moc-infrastructure-as-code]] — Terraform and IaC overview

**Comparison references:**
- [[sql-python-csharp-transforms]] — side-by-side code for the same transforms
- [[etl-vs-elt]] — when to transform outside vs inside the warehouse
- [[api-protocols-comparison]] — REST vs gRPC vs GraphQL vs WebSocket

**Implementation details:**
- [[airflow-core-concepts]] / [[airflow-dag-patterns]] / [[airflow-deployment]] — orchestration
- [[cloud-run-jobs-vs-services]] — serverless compute patterns
- [[terraform-plan-apply-destroy]] / [[terraform-module-composition]] — IaC
- [[dbt-transformation-layer]] — SQL transform management
- [[idempotent-pipeline-design]] — pipeline reliability patterns
- [[medallion-architecture]] — Bronze/Silver/Gold layering
- [[serialization-formats]] — data format selection
- [[database-connections]] — connecting Python and C# to databases
- [[container-lifecycle]] / [[docker-compose]] — containerization
- [[github-actions-workflows]] — CI/CD patterns

**Observability and operations:**
- [[datadog-architecture-overview]] — monitoring platform
- [[observability-deep-dive]] — metrics, logs, traces framework
- [[finops-cost-optimization]] — cost management
- [[gcp-pipeline-health-and-sla]] — SLA tracking
