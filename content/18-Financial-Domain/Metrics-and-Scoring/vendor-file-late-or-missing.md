---
title: "Vendor File Late or Missing"
type: runbook
category: financial-domain
technology: [python, sql-server, airflow]
tags: [financial, airflow, python, sql]
aliases: [missing vendor file runbook, late vendor file runbook]
keywords: [vendor file late, vendor file missing, stale data, refresh incident, bronze ingestion]
description: "Operational runbook for late or missing upstream vendor files in the financial scoring pipeline."
parent: "[[domain-metrics-and-scoring]]"
links:
  - "[[chart-metrics]]"
  - "[[daily-signal-scores]]"
  - "[[data-sources-and-refresh]]"
  - "[[factor-profile-and-composition]]"
  - "[[index-snapshot-metrics]]"
  - "[[quarterly-signal-scores]]"
  - "[[scoring-methodology]]"
created: 2026-04-08
updated: 2026-04-08
status: complete
---

# Vendor File Late or Missing

Use this runbook when the scheduled vendor extract does not arrive on time, arrives empty, or fails validation before bronze ingestion.

## Detection and Triage

1. Confirm whether the issue is transport, authentication, vendor-side delay, or malformed content.
2. Check the latest successful ingest timestamp and determine which downstream datasets would become stale.
3. Mark the affected batch as delayed rather than silently reusing prior data.

## Fallback Rules

1. Hold the bronze-to-silver promotion if the missing file would make downstream scores materially incorrect.
2. Reuse prior-day data only when the metric is explicitly allowed to tolerate staleness and the output is flagged as stale.
3. Suppress publication for metrics that depend on the missing payload if no safe fallback exists.

## Recovery and Reconciliation

1. Ingest the late file into bronze with the original vendor timestamp preserved.
2. Re-run silver and gold transformations for the impacted date range.
3. Reconcile row counts, freshness markers, and any score deltas before reopening publication.

## Related

- [[data-sources-and-refresh]] — upstream data flow and staleness impact
- [bronze-layer-loading](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/bronze-layer-loading) — raw-ingest handling patterns
