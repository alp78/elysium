---
title: "ESG Circuit Breaker Fired"
tags: [python, sql, bigquery, financial, regulatory, esg, stoxx]
type: runbook
technology: [python, bigquery, sql-server]
status: stable
updated: 2026-04-08
parent: "[[domain-regulatory]]"
links:
  - "[[eu-bmr-benchmark-regulation]]"
  - "[[iosco-benchmark-principles]]"
  - "[[sfdr-data-requirements]]"
---

# ESG Circuit Breaker Fired

Use this runbook when ESG quality gates stop publication because the upstream data set is incomplete, out of range, internally inconsistent, or fails vendor normalization.

## Trigger Conditions

- Coverage drops below the expected issuer threshold
- A normalized score falls outside the accepted scale
- A mandatory PAI field is null after transformation
- Vendor-to-vendor reconciliation breaches the configured tolerance

## Containment Actions

1. Stop the affected ESG publication job and quarantine the failing batch.
2. Preserve the raw vendor payload, normalization logs, and validation results.
3. Freeze downstream SFDR, index, and reporting outputs that depend on the failing data.

## Recovery Checklist

1. Identify whether the failure came from source data, mapping logic, or reference-data drift.
2. Correct the normalization or vendor mapping issue and re-run validation on the quarantined batch.
3. Recompute the dependent PAI or ESG outputs and document the incident in the audit trail before resuming publication.

## Related

- [[sfdr-data-requirements]] — regulatory output that depends on normalized ESG data
- [data-sources-and-refresh](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/data-sources-and-refresh) — upstream refresh and ingestion timing
