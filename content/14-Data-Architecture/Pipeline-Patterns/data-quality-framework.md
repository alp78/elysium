---
tags: [data-architecture, architecture, pipeline, testing, data-quality, python, sql, airflow, bigquery, medallion, quarantine, anomaly-detection, sla, dbt, great-expectations, soda, dataplex]
type: concept
technology: [sql-server, bigquery, airflow, python]
status: stable
updated: 2026-03-29
related:
  - "[data-pipeline-testing-strategy](/14-Data-Architecture/Pipeline-Patterns/data-pipeline-testing-strategy)"
  - "[data-contracts](/14-Data-Architecture/Pipeline-Patterns/data-contracts)"
  - "[error-handling-and-retry-patterns](/14-Data-Architecture/Pipeline-Patterns/error-handling-and-retry-patterns)"
  - "[functional-pipeline-architecture](/14-Data-Architecture/Pipeline-Patterns/functional-pipeline-architecture)"
  - "[medallion-architecture](/14-Data-Architecture/Pipeline-Patterns/medallion-architecture)"
  - "[observability-strategy-matrix](/13-Observability/observability-strategy-matrix)"
  - "[25_py_functional_pipeline](/02-Programming-Languages/Python/25_py_functional_pipeline)"
  - "[25_cs_functional_pipeline](/02-Programming-Languages/CSharp/25_cs_functional_pipeline)"
  - "[dbt-testing-framework](/11-dbt/Quality/dbt-testing-framework)"
  - "[gcp-pipeline-health-and-sla](/13-Observability/GCP-Native/gcp-pipeline-health-and-sla)"
---

# Data Quality Framework

Every data pipeline needs quality gates. In financial index calculation, a single bad price or weight produces a wrong index level that propagates to ETFs, derivatives, and regulatory filings. This page defines the six quality dimensions, maps them to medallion layers, and links to every concrete implementation in the vault.

## Data Quality Dimensions

### Completeness — all expected data is present

Completeness means every row and every required field that should exist actually exists. A dataset is incomplete when rows are missing entirely (e.g., a constituent dropped from the feed) or when required columns contain nulls.

> [!danger] Silent row loss is the hardest quality failure to detect
> If your pipeline silently drops rows during ingestion (e.g., a malformed CSV line), downstream aggregates look plausible but are wrong. A 50-constituent index calculated from 49 prices is published before anyone notices.

**How to detect:** Compare incoming row counts against expected counts (prior day, reference dimension, source manifest). Assert non-null on required columns.

- Python row count assertion: [25_py_functional_pipeline > Polars — assert minimum row count with len()](/02-Programming-Languages/Python/25_py_functional_pipeline#polars--assert-minimum-row-count-with-len)
- Full quality gate runner: [25_py_functional_pipeline > Pipeline — run all quality gate assertions with log.info()](/02-Programming-Languages/Python/25_py_functional_pipeline#pipeline--run-all-quality-gate-assertions-with-loginfo)
- dbt row count tests: [dbt-testing-framework > dbt-expectations — row count and statistical tests](/11-dbt/Quality/dbt-testing-framework#dbt-expectations--row-count-and-statistical-tests)
- GCP row count monitoring: [gcp-pipeline-health-and-sla > Row Count Validation](/13-Observability/GCP-Native/gcp-pipeline-health-and-sla#row-count-validation)

### Uniqueness — no unwanted duplicates

Uniqueness means each entity appears exactly once per grain. Duplicate rows inflate aggregates, double-count weights, and corrupt joins.

> [!danger] Duplicate rows silently corrupt every downstream aggregate
> A duplicated price row doubles a constituent's weight contribution in a market-cap-weighted index. The index level shifts, and because the number looks reasonable, no human catches it until an investor reconciles against the exchange.

**How to detect:** Assert uniqueness on natural keys (instrument + trade_date). Hash-based dedup on composite keys.

- Python duplicate assertion: [25_py_functional_pipeline > Polars — assert no duplicate rows with unique()](/02-Programming-Languages/Python/25_py_functional_pipeline#polars--assert-no-duplicate-rows-with-unique)
- dbt composite uniqueness: [dbt-testing-framework > dbt-utils test — unique_combination_of_columns](/11-dbt/Quality/dbt-testing-framework#dbt-utils-test--uniquecombinationofcolumns)
- dbt built-in unique/not_null: [dbt-testing-framework > dbt Built-in Generic Tests](/11-dbt/Quality/dbt-testing-framework#dbt-built-in-generic-tests)

### Validity — data conforms to business rules

Validity means values fall within acceptable domains and pass business logic rules. Prices must be positive. Weights must sum to 1.0. ESG scores must be 0-100.

> [!warning] Business rules that live only in someone's head are never enforced
> If the rule "weights must sum to 1.0" is documented in a wiki but not coded as an assertion, it will eventually be violated. Encode every business rule as a testable assertion.

**How to detect:** Range checks, regex patterns, enum membership, cross-field logic (e.g., open <= high, low <= close).

- Python row-level validation: [25_py_functional_pipeline > Pydantic — validate Bronze rows with BaseModel() row-level check](/02-Programming-Languages/Python/25_py_functional_pipeline#pydantic--validate-bronze-rows-with-basemodel-row-level-check)
- dbt expression assertions: [dbt-testing-framework > dbt-utils test — expression_is_true](/11-dbt/Quality/dbt-testing-framework#dbt-utils-test--expressionistrue)
- dbt range checks: [dbt-testing-framework > dbt-utils test — accepted_range](/11-dbt/Quality/dbt-testing-framework#dbt-utils-test--acceptedrange)
- Weight sum validation: [pit-integrity-logic > Validation: Weight Sum Check](/04-SQL-Server/Performance/pit-integrity-logic#validation-weight-sum-check)
- Data contracts: [dbt-data-contracts-implementation](/11-dbt/Quality/dbt-data-contracts-implementation)

### Timeliness — data arrives within SLA

Timeliness means data is available when downstream consumers need it. Late data delays index publication, triggers SLA breaches, and may force fallback to stale values.

> [!danger] A pipeline that succeeds with stale data is worse than one that fails
> If your pipeline runs on schedule but processes yesterday's file because today's hasn't arrived, you publish stale index values with no alert. Always assert data freshness, not just pipeline completion.

**How to detect:** Compare max timestamp in the dataset against expected freshness SLA. Implement dead man's switch for expected-but-missing loads.

- Python freshness assertion: [25_py_functional_pipeline > Polars — assert data freshness against SLA with max()](/02-Programming-Languages/Python/25_py_functional_pipeline#polars--assert-data-freshness-against-sla-with-max)
- GCP freshness monitoring: [gcp-pipeline-health-and-sla > Data Freshness Monitoring](/13-Observability/GCP-Native/gcp-pipeline-health-and-sla#data-freshness-monitoring)
- Dead man's switch: [gcp-pipeline-health-and-sla > Dead Man's Switch (Heartbeat Monitoring)](/13-Observability/GCP-Native/gcp-pipeline-health-and-sla#dead-mans-switch-heartbeat-monitoring)

> [!info] Three Types of Freshness
>
> **Source freshness**: when the source system last updated the data.
> **Pipeline freshness**: when the pipeline last successfully processed
> the data. **Serving freshness**: when the consumer last received
> updated data. A pipeline can be "fresh" (ran on time) while serving
> stale data (the source was late). Monitor all three independently.

### Accuracy — data values are correct

Accuracy means recorded values match the real-world truth. A price of 150.00 is complete, unique, valid, and timely, but if the actual close was 151.00, it is inaccurate.

> [!warning] Accuracy is the hardest dimension to automate
> You cannot validate accuracy without an independent reference source. For financial data, corroborate against a second vendor, an exchange API, or a manual check for high-impact values.

**How to detect:** Cross-reference against independent sources. Statistical anomaly detection (z-score) to flag outliers for manual review. Reconciliation queries between systems.

- Python API corroboration: [25_py_functional_pipeline > yfinance — corroborate with live API data using Ticker.history()](/02-Programming-Languages/Python/25_py_functional_pipeline#yfinance--corroborate-with-live-api-data-using-tickerhistory)
- Regression snapshot comparison: [data-pipeline-testing-strategy > Regression tests — snapshot comparison](/14-Data-Architecture/Pipeline-Patterns/data-pipeline-testing-strategy#regression-tests--snapshot-comparison)

### Consistency — data agrees across systems

Consistency means the same logical entity has the same value in every system that stores it. SQL Server gold must match BigQuery published values. Dimension attributes must agree across fact tables.

> [!warning] Cross-system inconsistency erodes trust faster than any other quality failure
> When a client sees one index level on a website and a different level in a downloaded file, they lose confidence in all your data, even the parts that are correct.

**How to detect:** Reconciliation queries comparing row counts, checksums, and key aggregates across systems. Hash-based comparison of entire datasets.

- Python deterministic hash: [25_py_functional_pipeline > hashlib — compute deterministic DataFrame hash with sha256()](/02-Programming-Languages/Python/25_py_functional_pipeline#hashlib--compute-deterministic-dataframe-hash-with-sha256)
- SCD Type 2 consistency: [silver-transforms > silver.index_dim — SCD Type 2 Dimension](/04-SQL-Server/Medallion-Project/silver-transforms#silverindexdim--scd-type-2-dimension)
- Upsert consistency: [sql-server-loading-patterns > Upsert (INSERT + UPDATE)](/04-SQL-Server/Patterns/sql-server-loading-patterns#upsert-insert--update)

## Quality Gates by Medallion Layer

Each [medallion-architecture](/14-Data-Architecture/Pipeline-Patterns/medallion-architecture) layer has different quality priorities. Bronze gates protect ingestion integrity. Silver gates enforce business rules. Gold gates guard publication correctness.

### Bronze Quality Gate

Bronze ([medallion-architecture > Bronze (Raw)](/14-Data-Architecture/Pipeline-Patterns/medallion-architecture#bronze-raw)) validates that raw data landed correctly before any transformation.

> [!danger] Tier 1 — Critical (halt pipeline)
> - Schema conformance: column names and types match expected contract
> - File hash verification: SHA-256 matches source manifest
> - Zero-byte / empty file detection

> [!warning] Tier 2 — Standard (quarantine bad rows)
> - Null rate exceeds threshold on required fields (>5%)
> - Duplicate detection on natural keys
> - Malformed rows (parse failures, encoding errors)

> [!abstract] Tier 3 — Advisory (log for review)
> - Row count outside 80-120% of prior load
> - New enum values not in reference table
> - Column order changed (schema evolution signal)

- Bronze gate implementation: [25_py_functional_pipeline > Pipeline — run Bronze data quality gate with run_quality_gate()](/02-Programming-Languages/Python/25_py_functional_pipeline#pipeline--run-bronze-data-quality-gate-with-runqualitygate)
- Quality gate pattern: [functional-pipeline-architecture > Quality Gate Pattern](/14-Data-Architecture/Pipeline-Patterns/functional-pipeline-architecture#quality-gate-pattern)
- Data quality assertions: [data-pipeline-testing-strategy > Data quality assertions](/14-Data-Architecture/Pipeline-Patterns/data-pipeline-testing-strategy#data-quality-assertions)

### Silver Quality Gate

Silver ([medallion-architecture > Silver (Cleaned)](/14-Data-Architecture/Pipeline-Patterns/medallion-architecture#silver-cleaned)) enforces business rules and referential integrity on cleaned data.

> [!danger] Tier 1 — Critical (halt pipeline)
> - Business rule violation on mandatory fields (price <= 0, negative volume)
> - Referential integrity failure (instrument not in dimension table)
> - Deduplication check fails after cleaning

> [!warning] Tier 2 — Standard (quarantine bad rows)
> - Values outside expected statistical range (z-score > 3)
> - Staleness: data older than freshness SLA
> - Cross-field logic violations (open > high, low > close)

> [!abstract] Tier 3 — Advisory (log for review)
> - Rows requiring fallback to T-1 values
> - Minor schema drift (new nullable columns)
> - Data distribution shift beyond 1 standard deviation

> [!info] What Is Schema Drift?
>
> Schema drift occurs when a data source changes its schema without
> notice — a column is renamed, a type changes, a new field appears,
> or a field disappears. The pipeline's contract expects the OLD schema.
> The source delivers the NEW schema. Without detection, the pipeline
> silently loads NULLs (renamed column), fails mid-transform (type
> change), or ignores new data (unknown column). Detection methods:
> compare incoming columns against the contract, hash the schema,
> alert on mismatch.

- Silver gate implementation: [25_py_functional_pipeline > Pipeline — run Silver data quality gate with run_quality_gate()](/02-Programming-Languages/Python/25_py_functional_pipeline#pipeline--run-silver-data-quality-gate-with-runqualitygate)
- Row-level Pydantic validation: [25_py_functional_pipeline > Pydantic — validate Bronze rows with BaseModel() row-level check](/02-Programming-Languages/Python/25_py_functional_pipeline#pydantic--validate-bronze-rows-with-basemodel-row-level-check)
- dbt test severity: [dbt-testing-framework > dbt Test severity: warn vs error](/11-dbt/Quality/dbt-testing-framework#dbt-test-severity-warn-vs-error)

### Gold Quality Gate

Gold ([medallion-architecture > Gold (Analytics)](/14-Data-Architecture/Pipeline-Patterns/medallion-architecture#gold-analytics)) is the last line of defense before data reaches clients, regulatory filings, and downstream systems.

> [!danger] Gold is publication — treat every Gold check as a circuit breaker
> If a quality gate at the Gold layer fails and the pipeline continues anyway (e.g., because the check was set to `severity: warn` instead of `error`), incorrect index values reach clients and regulatory filings. Gold-layer checks that affect publication integrity must ALWAYS halt the pipeline. See esg circuit breaker fired for a real incident where this saved us.

> [!danger] Tier 1 — Critical (halt publication)
> - Weights sum to 1.0: `ABS(SUM(weight) - 1.0) < 1e-9`
> - No missing constituents: count matches target (e.g., 50)
> - Index level sanity: daily change within +/-15%
> - Cross-dataset consistency: SQL Server gold = BigQuery published

> [!warning] Tier 2 — Standard (quarantine and alert)
> - ESG score outside normalized 0-100 range
> - Sector allocation drift beyond threshold
> - Turnover exceeds rebalance limits

> [!abstract] Tier 3 — Advisory (log for review)
> - Minor rounding differences across systems (<1e-6)
> - Constituent weight below minimum threshold
> - Publication timestamp later than typical

- Weight validation: [pit-integrity-logic > Validation: Weight Sum Check](/04-SQL-Server/Performance/pit-integrity-logic#validation-weight-sum-check)
- Circuit breaker incident: esg circuit breaker fired
- Store test failures for audit: [dbt-testing-framework > dbt --store-failures](/11-dbt/Quality/dbt-testing-framework#dbt---store-failures)

## Data Quality Tooling

### dbt Tests — SQL assertions in YAML

**Best for:** Schema validation, business rule checks, referential integrity in warehouse-centric pipelines.

**Strengths:** Version-controlled with models, runs in CI/CD, built-in severity levels, test failure storage for audit.

**Limitations:** SQL-only (no Python logic), limited statistical capability without dbt-expectations, test runs add warehouse cost.

> [!warning] Anti-pattern: writing dbt tests that duplicate warehouse constraints
> If your warehouse enforces NOT NULL and UNIQUE via DDL constraints, dbt tests on the same columns are redundant cost. Use dbt tests for business rules the warehouse cannot enforce.

- Built-in generic tests: [dbt-testing-framework > dbt Built-in Generic Tests](/11-dbt/Quality/dbt-testing-framework#dbt-built-in-generic-tests)
- Statistical tests: [dbt-testing-framework > dbt-expectations — row count and statistical tests](/11-dbt/Quality/dbt-testing-framework#dbt-expectations--row-count-and-statistical-tests)
- CI/CD integration: [data-pipeline-testing-strategy > CI/CD Test Automation](/14-Data-Architecture/Pipeline-Patterns/data-pipeline-testing-strategy#cicd-test-automation)

### Great Expectations — Python assertion suites with profiling

**Best for:** Statistical profiling, data documentation, complex multi-column expectations that are awkward in SQL.

**Strengths:** Rich expectation library, auto-profiling to bootstrap suites, data docs for stakeholder visibility.

**Limitations:** Heavy dependency footprint, slower than native SQL checks, checkpoint configuration complexity.

> [!warning] Anti-pattern: auto-profiling in production without review
> Great Expectations can auto-generate expectations from data. If you deploy auto-profiled suites without human review, you encode current data quirks as rules — including bugs. Always review and curate generated expectations.

### Soda Core — YAML-defined checks with SodaCL

**Best for:** Quick setup across multiple data sources, team-friendly YAML syntax, Soda Cloud dashboards for non-technical stakeholders.

**Strengths:** Multi-source (SQL, Spark, Pandas), SodaCL is readable by analysts, anomaly detection built in.

**Limitations:** Advanced checks require Soda Cloud (paid), fewer community extensions than dbt or GE.

### Custom SQL / Python — stored procedures and scripts

**Best for:** Legacy systems, highly specific edge cases, environments where adding a framework is impractical.

**Strengths:** Full flexibility, no dependency overhead, can run in any environment.

**Limitations:** No standardization, no built-in reporting, maintenance burden grows with pipeline count.

- Python quality gate: [25_py_functional_pipeline > Pipeline — run all quality gate assertions with log.info()](/02-Programming-Languages/Python/25_py_functional_pipeline#pipeline--run-all-quality-gate-assertions-with-loginfo)
- C# functional pipeline: [25_cs_functional_pipeline](/02-Programming-Languages/CSharp/25_cs_functional_pipeline)

### Dataplex Quality (GCP) — native BigQuery quality scans

**Best for:** BigQuery-centric pipelines on GCP, teams already using Dataplex for data governance.

**Strengths:** Zero infrastructure to manage, native BigQuery integration, results in Cloud Monitoring.

**Limitations:** GCP-only, limited custom logic, no cross-cloud support.

- GCP pipeline health: [gcp-pipeline-health-and-sla > Row Count Validation](/13-Observability/GCP-Native/gcp-pipeline-health-and-sla#row-count-validation)

### When to Combine Tools

No single tool covers all six quality dimensions. A practical stack for financial pipelines:

| Layer | Tool | Covers |
|-------|------|--------|
| Bronze ingestion | Custom Python (Pydantic + Polars) | Completeness, Validity, Uniqueness |
| Silver / Gold warehouse | dbt tests + dbt-expectations | All six dimensions in SQL |
| Cross-system reconciliation | Custom SQL / Python | Consistency, Accuracy |
| Monitoring and alerting | GCP Dataplex + Cloud Monitoring | Timeliness, Completeness |

> [!tip] Start with dbt tests and custom Python gates, then add Great Expectations or Soda only when you need statistical profiling or multi-source checks that justify the extra dependency.

## The Quarantine Pattern

### What Is a Quarantine?

A quarantine isolates rows that fail quality checks so they can be investigated and replayed without blocking the pipeline. Good rows continue downstream; bad rows are persisted with failure metadata.

> [!danger] Never silently drop bad rows
> Dropping rows that fail validation means you lose evidence of upstream data issues. Quarantined rows are your forensic trail: they tell you what went wrong, when, and how often. Without quarantine, you discover data loss only when a client reports it.

- Quarantine pattern overview: [functional-pipeline-architecture > The Quarantine Pattern](/14-Data-Architecture/Pipeline-Patterns/functional-pipeline-architecture#the-quarantine-pattern)
- Dead letter queue (same concept, different name): [error-handling-and-retry-patterns > Dead Letter Queue (DLQ) — don't drop, don't retry forever](/14-Data-Architecture/Pipeline-Patterns/error-handling-and-retry-patterns#dead-letter-queue-dlq--dont-drop-dont-retry-forever)

### Quarantine Table Design

Every quarantine table needs the original row, the failure reason, and enough metadata to replay.

```sql
-- Quarantine table DDL — one per source or shared across Bronze
CREATE TABLE bronze.quarantine (
    quarantine_id   INT IDENTITY(1,1) PRIMARY KEY,
    source_table    NVARCHAR(128)   NOT NULL,
    source_row_json NVARCHAR(MAX)   NOT NULL,
    failure_reason  NVARCHAR(512)   NOT NULL,
    gate_name       NVARCHAR(128)   NOT NULL,
    rejected_at     DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
    replayed_at     DATETIME2       NULL
);
```

- Python quarantine table creation: [25_py_functional_pipeline > SQL Server — create quarantine table for rejected rows with cursor.execute()](/02-Programming-Languages/Python/25_py_functional_pipeline#sql-server--create-quarantine-table-for-rejected-rows-with-cursorexecute)
- Python quarantine persistence: [25_py_functional_pipeline > SQL Server — define quarantine persistence helper with cursor.execute()](/02-Programming-Languages/Python/25_py_functional_pipeline#sql-server--define-quarantine-persistence-helper-with-cursorexecute)

### Reject-Persist-Investigate Workflow

1. **Reject** — Quality gate identifies failing rows and separates them from the good batch
2. **Persist** — Failing rows are written to the quarantine table with failure metadata (reason, gate name, timestamp)
3. **Investigate** — Data engineers query the quarantine table to diagnose root cause (bad source, schema drift, business rule change)
4. **Fix** — Correct the upstream issue or update the validation rule
5. **Replay** — Re-ingest corrected rows through the pipeline; mark `replayed_at` in quarantine

### Quarantine Metrics

Track these metrics to measure data quality over time:

- **Quarantine rate** — percentage of rows rejected per load (target: <1% for Bronze, <0.1% for Silver)
- **Mean time to replay** — how long quarantined rows sit before investigation (target: <24 hours)
- **Repeat offenders** — source_table + failure_reason combinations that recur (signals upstream fix needed)
- **Quarantine growth** — if the table grows faster than replays, investigation is falling behind

### Replay Pattern

Replaying quarantined rows must be idempotent. The replay process re-ingests rows through the same pipeline (not a direct insert into Silver/Gold) so all quality gates run again.

> [!tip] Mark replayed rows, don't delete them
> Set `replayed_at` on successfully replayed rows instead of deleting them. The quarantine table is an audit log; deleting rows destroys the quality history.

## Anomaly Detection for Financial Time Series

Statistical anomaly detection catches data issues that pass business rule validation but are still wrong (e.g., a price that is positive and within range but 10x the prior day's close).

**Z-score formula:**

```python
# Rolling z-score for anomaly detection
z_score = (value - rolling_mean) / rolling_std
is_anomaly = abs(z_score) > threshold
```

**Window size guidance:**

| Data type | Window | Threshold | Rationale |
|-----------|--------|-----------|-----------|
| Prices (daily close) | 30 trading days | 3 sigma | Prices are relatively stable; 3 sigma catches true outliers |
| Volumes (daily) | 90 trading days | 2 sigma | Volumes are noisier; 2 sigma with longer window smooths seasonal patterns |
| Row counts (per load) | 30 loads | 2 sigma | Catches ingestion anomalies without over-alerting |

> [!warning] Seasonal adjustment is critical for volume data
> Trading volumes spike predictably around index rebalance dates, options expiry, and quarter-end. A naive z-score flags every predictable spike as anomalous. Either exclude known event dates from the rolling window or use a seasonal decomposition model.

## Quality Gate Orchestration

### Airflow Integration — ShortCircuitOperator as quality gate

Use Airflow's `ShortCircuitOperator` to implement quality gates as pipeline tasks. If critical checks fail, the operator returns `False` and skips all downstream tasks, preventing bad data from reaching publication.

```python
# Airflow ShortCircuitOperator quality gate
quality_gate = ShortCircuitOperator(
    task_id="bronze_quality_gate",
    python_callable=run_quality_checks,
)
```

> [!info] ShortCircuitOperator vs BranchPythonOperator
> Use `ShortCircuitOperator` when failure means "stop everything." Use `BranchPythonOperator` when failure means "take an alternate path" (e.g., quarantine and continue with good rows).

- Airflow DAG patterns: [airflow-dag-patterns](/12-Orchestration/Airflow/airflow-dag-patterns)

### GitHub Actions Integration — dbt test in CI/CD

Run `dbt test --select state:modified+` on every pull request to catch quality regressions before they reach production. Only modified models and their downstream dependents are tested, keeping CI fast.

```yaml
# GitHub Actions step for dbt quality checks
- run: dbt test --select state:modified+ --defer --state prod-manifest/
```

- CI/CD test automation: [data-pipeline-testing-strategy > CI/CD Test Automation](/14-Data-Architecture/Pipeline-Patterns/data-pipeline-testing-strategy#cicd-test-automation)

## SLA Definitions by Dataset

| Dataset | Freshness SLA | Quality Threshold | Fallback |
|---------|---------------|-------------------|----------|
| Market data (OHLCV) | T+0 by 18:30 UTC | 100% completeness | Exchange backup feed |
| ESG scores | T+0 by Monday 08:00 UTC | 95% coverage | Use T-1 scores |
| Corporate actions | T-1 by 06:00 UTC | 100% mandatory actions | Manual sourcing |
| Index levels (published) | T+0 by 19:00 UTC | 100% accuracy | Hold publication |
| Reference data (dimensions) | T-1 by 04:00 UTC | 100% completeness | Use prior version |

> [!info] SLAs are per-dataset, not per-pipeline
> A single pipeline may load multiple datasets with different SLAs. Define freshness and quality thresholds at the dataset level, then map pipeline tasks to the strictest SLA they serve.

## Related

- [data-pipeline-testing-strategy](/14-Data-Architecture/Pipeline-Patterns/data-pipeline-testing-strategy) — Testing pyramid that coordinates quality checks with unit, integration, and contract tests
- [data-contracts](/14-Data-Architecture/Pipeline-Patterns/data-contracts) — Schema and SLA agreements between producers and consumers
- [error-handling-and-retry-patterns](/14-Data-Architecture/Pipeline-Patterns/error-handling-and-retry-patterns) — Retry logic, dead letter queues, and circuit breakers
- [functional-pipeline-architecture](/14-Data-Architecture/Pipeline-Patterns/functional-pipeline-architecture) — Quality gate and quarantine patterns in functional style
- [medallion-architecture](/14-Data-Architecture/Pipeline-Patterns/medallion-architecture) — Bronze / Silver / Gold layer definitions and responsibilities
- [observability-strategy-matrix](/13-Observability/observability-strategy-matrix) — Logging, metrics, and alerting strategy across pipeline layers
- [25_py_functional_pipeline](/02-Programming-Languages/Python/25_py_functional_pipeline) — Full Python implementation of quality gates, quarantine, and anomaly detection
- [25_cs_functional_pipeline](/02-Programming-Languages/CSharp/25_cs_functional_pipeline) — C# implementation of the same patterns
- [dbt-testing-framework](/11-dbt/Quality/dbt-testing-framework) — dbt test types, severity levels, and store-failures
- [gcp-pipeline-health-and-sla](/13-Observability/GCP-Native/gcp-pipeline-health-and-sla) — GCP-native freshness monitoring and alerting
