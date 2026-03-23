---
tags: [architecture, pipeline, testing, data-quality, python, sql, airflow, bigquery]
type: concept
technology: [sql-server, bigquery, airflow, python]
status: stable
updated: 2026-03-23
---

# Data Quality Framework

> [!abstract] When You Need This
> Every data pipeline needs quality gates. In financial index calculation, a single bad price or weight produces a wrong index level that propagates to ETFs, derivatives, and regulatory filings.

## Quality Dimensions

| Dimension | Definition | Index Domain Example |
|-----------|-----------|---------------------|
| **Completeness** | All expected data is present | All 50 constituents have prices for today |
| **Accuracy** | Data values are correct | Close price matches the exchange official close |
| **Consistency** | Data agrees across systems | SQL Server gold matches BigQuery published values |
| **Timeliness** | Data arrives within SLA | Market data file arrives by 18:00 UTC |
| **Uniqueness** | No unwanted duplicates | One row per instrument per trade date |
| **Validity** | Data conforms to business rules | Weights sum to 1.00000000, ESG scores in 0-100 range |

## Quality Gates by Medallion Layer

### Bronze (Landing / Raw)

| Check | Implementation | Action on Failure |
|-------|---------------|-------------------|
| Schema conformance | Column names and types match expected | Reject file, alert |
| Row count sanity | Count within 80-120% of previous load | Warn if outside range |
| Null rate | Less than 5% nulls in required fields | Quarantine rows with nulls |
| Duplicate detection | Hash-based dedup on natural key | Deduplicate, log count |
| File hash verification | SHA-256 matches source manifest | Reject, re-download |

### Silver (Cleaned / Validated)

| Check | Implementation | Action on Failure |
|-------|---------------|-------------------|
| Business rule validation | Price > 0, volume >= 0, date is trading day | Quarantine failing rows |
| Deduplication verified | No duplicate (instrument, date) pairs | Fail pipeline |
| Referential integrity | All instruments exist in dimension table | Quarantine orphans |
| Staleness check | Data freshness within tolerance | Warn or use T-1 fallback |

### Gold (Consumption / Publication)

| Check | Implementation | Action on Failure |
|-------|---------------|-------------------|
| Weights sum to 1.0 | ABS(SUM(weight) - 1.0) < 1e-9 | HALT PUBLICATION |
| No missing constituents | Count matches target (e.g., 50) | Halt, investigate |
| Index level sanity | Daily change within +/-15% | Circuit breaker |
| Cross-dataset consistency | SQL Server gold = BigQuery published | Halt, reconcile |
| ESG score range | All normalized scores in 0-100 | Quarantine out-of-range |

## Tooling Comparison

| Tool | Approach | Best For |
|------|---------|---------|
| **dbt tests** | SQL assertions in YAML | Schema and business rule validation |
| **Great Expectations** | Python assertions with profiling | Statistical anomaly detection |
| **Soda Core** | YAML-defined checks (SodaCL) | Quick setup, multi-team |
| **Custom SQL** | Stored procedures / scripts | Legacy systems, edge cases |
| **Dataplex Quality** | GCP-native quality scans | BigQuery-centric pipelines |

## Quarantine Pattern

When rows fail validation, quarantine for investigation instead of discarding.

## Anomaly Detection for Financial Time Series

Use rolling z-score (30-day window, 3-sigma threshold) to flag unusual values. Apply Bollinger-style bands to row counts to detect ingestion anomalies.

## Airflow Integration

Use `ShortCircuitOperator` as a quality gate task. If critical checks fail, the operator returns False and skips all downstream tasks, preventing bad data from reaching publication.

## SLA Definitions by Dataset

| Dataset | Freshness SLA | Quality Threshold | Fallback |
|---------|-------------|-------------------|----------|
| Market data (OHLCV) | T+0 by 18:30 UTC | 100% completeness | Exchange backup feed |
| ESG scores | T+0 by Monday 08:00 UTC | 95% coverage | Use T-1 scores |
| Corporate actions | T-1 by 06:00 UTC | 100% mandatory actions | Manual sourcing |

## Related

- [[data-contracts]] — Schema and SLA agreements
- [[medallion-architecture]] — Bronze/Silver/Gold layer definitions
- [[esg-data-ingestion-framework]] — Circuit breaker pattern
- [[pit-integrity-logic]] — Weight normalization and validation
- [[idempotent-pipeline-design]] — Safe re-run patterns
