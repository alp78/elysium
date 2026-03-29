---
title: "Data Pipeline Testing Strategy"
type: concept
category: data-architecture
technology: [python, dbt, sql-server, bigquery, github-actions]
tags:
  - data-architecture
  - patterns
  - testing
  - data-quality
  - ci-cd
  - dbt
  - python
  - pytest
  - github-actions
aliases:
  - "Testing Strategy"
  - "Pipeline Testing"
keywords: [testing pyramid, unit test, integration test, contract test, data quality, regression test, test data, fixture, CI/CD, pytest, dbt test, schema validation, golden file]
description: "The testing pyramid for data engineering: unit, integration, contract, quality, and regression testing across bronze/silver/gold layers."
related:
  - "[[dbt-testing-framework]]"
  - "[[data-quality-framework]]"
  - "[[data-contracts]]"
  - "[[gcp-pipeline-health-and-sla]]"
  - "[[github-actions-data-engineering]]"
  - "[[10_py_testing_migration]]"
  - "[[idempotent-pipeline-design]]"
  - "[[environment-management-strategy]]"
created: 2026-03-29
updated: 2026-03-29
status: complete
---

# Data Pipeline Testing Strategy

Every page in this vault covers *how* to use a testing tool — pytest fixtures, dbt generic tests, GitHub Actions workflows. This page answers the strategy question: **what should I test, at which layer, with which tool, and when does each test run?**

---

## The Data Engineering Testing Pyramid

```mermaid
block-beta
    columns 7
    space:2 E2E["E2E — Nightly\n\nFull pipeline on test data\nSlowest, fewest tests"]:3 space:2
    space:1 INT["Integration — On Merge\n\nReal connections, test database\nMinutes per run"]:5 space:1
    CONTRACT["Contract + Quality — Every PR + Every Load\n\nSchema conformance, row counts, nulls, ranges, freshness"]:7
    UNIT["Unit Tests — Every PR\n\nTransform logic, SQL expressions, dbt generic tests\nFastest, cheapest, most tests"]:7

    style E2E fill:#cc4125,stroke:#cc4125,color:#fff
    style INT fill:#e8b84d,stroke:#e8b84d,color:#1a1a2e
    style CONTRACT fill:#4285f4,stroke:#4285f4,color:#fff
    style UNIT fill:#34a853,stroke:#34a853,color:#fff
```

| Layer | What It Tests | Speed | When It Runs | Skip It And... |
|---|---|---|---|---|
| **Unit** | Transform logic, functions, SQL expressions | Seconds | Every PR | Broken transforms reach production — wrong scores, wrong aggregations |
| **Quality** | Data properties — nulls, counts, ranges, uniqueness | Seconds | Every pipeline run | Silent data degradation — 50% NULLs in gold, nobody notices for weeks |
| **Contract** | Schema conformance — column names, types, value sets | Seconds | Every PR + on ingestion | Upstream API change silently loads NULLs into your bronze layer |
| **Integration** | Cross-system flow with real connections | Minutes | On merge to main | "Works in dev, breaks in prod" — the #1 pipeline failure mode |
| **E2E** | Full bronze → silver → gold pipeline on test data | Minutes-hours | Nightly / weekly | Multi-step regressions — a silver bug that only surfaces in gold output |

> [!tip] Where to Invest First
>
> Most pipeline teams have zero tests. If you're starting from nothing, add in this
> order: (1) dbt generic tests on gold models (unique, not_null on key columns),
> (2) row count assertions after every load, (3) pytest for transform functions.
> These three catch 80% of production data issues.

---

## What to Test at Each Pipeline Layer

| Pipeline Layer | What to Test | Primary Tool | Vault Reference |
|---|---|---|---|
| **Bronze** | Schema matches source, row count > 0, no all-NULL columns, source freshness | dbt source tests, Python assertions | [[data-quality-framework#Medallion Bronze Quality Gate — Landing / Raw]] |
| **Silver** | Business logic correctness, dedup worked, SCD2 integrity, gap-fill completeness | dbt tests, pytest with fixtures | [[dbt-testing-framework#dbt Built-in Generic Tests]] |
| **Gold** | Output shape matches expectations, z-scores in bounds, no NaN in scores, ranks are contiguous | dbt tests, pandas assertions | [[data-quality-framework#Medallion Gold Quality Gate -- Consumption / Publication]] |
| **Cross-layer** | Row count preservation (bronze → silver minus expected dedup), referential integrity | dbt cross-model tests, SQL assertions | [[data-quality-framework#Data Quality Quarantine Pattern]] |

> [!danger] Gold Quality Is Last Defense
>
> Gold tables feed dashboards, APIs, and downstream consumers. A quality bug in gold
> is visible to the business. Every gold model must have at minimum: `unique` + `not_null`
> on the primary key, `accepted_values` on categorical columns, and a row count assertion
> comparing today vs yesterday (detect data loss or explosion).

---

## Test Types — Detailed Breakdown

### Unit tests — transform logic

Test individual functions, SQL transforms, and dbt models in isolation. These are the fastest tests and should make up the majority of your test suite.

**Python (pytest):** Test transform functions with sample DataFrames as fixtures. See [[10_py_testing_migration]] for Pandas/Polars testing patterns.

**C# (xUnit):** Test transform methods with test DataFrames. See [[10_cs_testing_migration]] for Deedle/Polars.NET patterns.

**dbt:** Schema tests in `schema.yml` — `unique`, `not_null`, `accepted_values`, `relationships`. See [[dbt-testing-framework#dbt Built-in Generic Tests]] for the full list.

> [!info] The unit test rule
>
> Every transform function must have at least one test that verifies correct output
> for known input. If a function calculates a z-score, test it with a known dataset
> where you can verify the expected z-score by hand. If a function deduplicates, test
> it with a dataset containing known duplicates and verify the count drops correctly.

### Data quality assertions

Validate data properties at layer boundaries. These run after every pipeline execution, not just in CI.

**Checks to implement:**

| Check | What It Catches | Tool |
|---|---|---|
| Row count > 0 | Empty table after failed load | dbt `dbt_utils.at_least_one`, SQL assertion |
| Row count ± 20% of yesterday | Data explosion from bad join or data loss from filter bug | Custom dbt test, Python assertion |
| Null percentage < threshold | Silent schema change producing NULLs | dbt `not_null`, custom threshold test |
| Value ranges | Out-of-bounds scores, negative prices, future dates | dbt `accepted_range`, custom SQL |
| Uniqueness on business key | Duplicates from failed dedup or bad merge | dbt `unique`, `unique_combination_of_columns` |
| Freshness | Stale data — source hasn't updated | dbt `source freshness`, custom metric |

See [[data-quality-framework#Data Quality Dimensions]] for the full quality taxonomy and [[gcp-pipeline-health-and-sla#Row Count Validation]] for production monitoring integration.

> [!warning] Quality Checks Need Production Too
>
> Data quality degrades between deploys — source schemas change, APIs return different
> data, volumes shift. dbt tests in CI catch code bugs. Production quality checks catch
> data bugs. You need both.

### Contract tests — schema conformance

Verify that source data matches the expected schema before any transform runs.

**The problem:** An upstream API changes a field name from `price` to `current_price`. Your pipeline loads NULLs into the `price` column — every row, every day — until someone notices the dashboard is wrong.

**Implementation:**
- Define the contract (column names, types, nullability, value ranges): see [[data-contracts#What a Data Contract Contains]]
- Validate on ingestion with a Python validator or dbt source test: see [[context-and-metadata-architecture#Schema Drift Detection]]
- dbt contracts: see [[dbt-data-contracts-implementation#What Is a dbt Data Contract?]]

> [!danger] Schema Changes Kill Silently
>
> Code bugs raise exceptions. Data volume changes are visible in monitoring. But a
> renamed column silently loads NULLs — the pipeline reports success, row counts match,
> and nobody notices until a business user asks why the dashboard shows zero. Contract
> tests are the only defense against this.

### Integration tests

Test the pipeline end-to-end with real connections but test data.

**Scope:** Full bronze → silver → gold flow with a small dataset (100-1000 rows).

**Pattern:** Dedicated test database/dataset, seeded with fixture data, torn down after each test run.

**GitHub Actions implementation:** Spin up a SQL Server Docker container, load test fixtures, run the pipeline, assert output shape and values.

See [[github-actions-data-engineering#Full Python Lint + Test Workflow]] for the CI workflow and [[github-actions-data-engineering#dbt Build Against Dev Schema]] for dbt integration tests in CI.

> [!warning] Integration Tests Need Real Infra
>
> Mocking a database doesn't test your SQL. Mocking GCS doesn't test your upload logic.
> Integration tests must use real connections — even if that's a Docker SQL Server in
> GitHub Actions. The cost is minutes of CI time; the payoff is catching "works in dev,
> breaks in prod" before it reaches prod.

### Regression tests — snapshot comparison

Verify today's output matches yesterday's expected output after a code change.

**The problem:** A code change alters the z-score calculation subtly. Unit tests pass (they test the new formula). But production output is different from what downstream consumers expect — scores shift, ranks change, dashboards look wrong.

**Implementation:**
- Save expected output as a "golden file" (CSV/Parquet fixture)
- After pipeline run, compare actual output against golden file
- Flag differences above a threshold (exact match for integers, ±0.01 for floats)

**dbt:** Custom test comparing current model output against a seeded reference table.

**Python:** pytest with golden file fixtures — `pd.testing.assert_frame_equal()` with `atol` for numeric tolerance.

---

## Test Data Management

| Approach | When to Use | Gotcha |
|---|---|---|
| **Hand-crafted fixtures** | Unit tests — known edge cases (NULLs, duplicates, boundary dates) | Time-consuming to maintain as schema evolves |
| **Sampled from production** | Integration tests — realistic data shape and volume | Must anonymize PII; may miss edge cases |
| **Synthetic generation** | Load testing, edge case coverage | May not reflect real data distributions |

> [!tip] Test Data Edge Case Rule
>
> Test data must include at least one example of every edge case your code handles:
> NULL values, duplicate keys, missing dates, out-of-range values, Unicode characters,
> empty strings, and zero-length files. If your code has a `try/except` for a specific
> condition, your test data must trigger that condition.

> [!warning] Production Data Only Is Insufficient
>
> Production data tests the happy path — the data your pipeline already handles correctly.
> It never tests the edge cases that will crash your pipeline when they first appear.
> Always supplement production samples with hand-crafted edge case fixtures.

---

## CI/CD Test Automation

The complete testing pipeline on every PR and merge. For GitHub Actions workflow syntax, see [[github-actions-data-engineering#End-to-End Pipeline: PR to Lint to Test to Build to Deploy to Verify]].

```yaml
# Conceptual workflow — link to implementation pages for full YAML
on:
  pull_request:
    branches: [main]

jobs:
  lint-and-type-check:     # ruff, mypy, sqlfluff
  unit-tests:              # pytest -m "not integration"
  dbt-tests:               # dbt test --select state:modified+
  schema-validation:       # contract tests against source schemas
  # --- runs only on merge to main ---
  integration-test:        # Docker SQL Server + test data + pipeline run
  data-quality:            # assertions on integration test output
```

### When each test type runs

| Test Type | On Every PR | On Merge | Nightly | On Every Pipeline Run |
|---|---|---|---|---|
| Unit tests | Yes | Yes | — | — |
| dbt generic tests | Yes | Yes | — | Yes (in production) |
| Contract tests | Yes | Yes | — | Yes (on ingestion) |
| Integration tests | — | Yes | — | — |
| Regression tests | — | — | Yes | — |
| Data quality assertions | — | — | — | Yes |

> [!info] Test Timing Cost-Benefit
>
> Unit tests and contract tests are cheap (seconds, no infrastructure) — run on every PR.
> Integration tests need infrastructure (Docker containers, real connections) — run on
> merge only. Regression tests compare large datasets — run nightly to avoid slowing CI.
> Data quality assertions run in production after every load — they catch data problems
> that code tests can't.

---

## Production Monitoring Is Not Testing

| Concern | Testing (pre-deployment) | Monitoring (post-deployment) |
|---|---|---|
| **Question** | Does the code work correctly? | Is the pipeline healthy in production? |
| **When** | Before code reaches production | After every production run |
| **Tool** | pytest, dbt test, GitHub Actions | Datadog, Cloud Monitoring, custom metrics |
| **Catches** | Logic bugs, schema violations, regression | Data drift, volume changes, latency, failures |

Data quality checks are the exception — they span both worlds. Run them in CI (testing) AND after every production load (monitoring).

- Testing side: [[dbt-testing-framework]] + [[github-actions-data-engineering]]
- Monitoring side: [[gcp-pipeline-health-and-sla]] + [[data-quality-framework#Quality Gate Airflow Integration]]

---

## Anti-Patterns

> [!danger] Pipeline Testing Anti-Patterns
>
> | Anti-Pattern | Consequence | Fix |
> |---|---|---|
> | No tests at all ("it worked in my notebook") | Every deploy is a gamble | Start with dbt `not_null` + `unique` on gold PKs |
> | Testing only the happy path | First NULL crashes production | Add edge case fixtures: NULLs, duplicates, empty, boundary dates |
> | Testing transforms but not schemas | Code correct, but input changed — garbage in, garbage out | Add contract tests on every source |
> | Tests only in CI, never in production | Data quality degrades silently between deploys | Run dbt tests + row count checks after every production load |
> | Production data as only test data | Never tests edge cases | Supplement with synthetic fixtures |
> | Testing by visual inspection | "I looked at it and it seems right" — not reproducible | Automated assertions with explicit expected values |
> | dbt tests without thresholds | Test passes with 99% NULLs (technically not ALL NULL) | Use `dbt-expectations` with `accepted_range` and percentage thresholds |
> | Mocking the database | SQL logic never tested against a real engine | Use Docker SQL Server in CI for integration tests |

---

## Related

- [[dbt-testing-framework]] — dbt generic tests, custom tests, severity levels, store-failures
- [[data-quality-framework]] — Quality dimensions, medallion quality gates, quarantine pattern
- [[data-contracts]] — Contract specification, breaking vs non-breaking changes, CI validation
- [[dbt-data-contracts-implementation]] — dbt-native contracts, model versions, access control
- [[gcp-pipeline-health-and-sla]] — Production monitoring: freshness, row counts, SLA tracking, alerting
- [[github-actions-data-engineering]] — CI/CD workflows for data pipelines, dbt in CI, WIF auth
- [[context-and-metadata-architecture]] — Schema drift detection, schema evolution patterns
- [[10_py_testing_migration]] — pytest patterns for Pandas/Polars DataFrame testing
- [[10_cs_testing_migration]] — xUnit patterns for Deedle/Polars.NET DataFrame testing
- [[environment-management-strategy]] — How testing fits into the dev/staging/prod promotion workflow
