---
title: "07 - Corporate Action Missed"
type: runbook
category: financial-domain
technology: [sql-server, python, bigquery]
tags: [financial, stoxx, sql, python]
aliases: [missed corporate action runbook, corporate action incident]
keywords: [corporate action missed, restatement, divisor correction, split missed, dividend missed, benchmark incident]
description: "Operational runbook for missed or misprocessed corporate actions in an index pipeline."
created: 2026-04-08
updated: 2026-04-08
status: complete
---

# Corporate Action Missed

Run this procedure when a split, dividend, merger, spinoff, deletion, or free-float change was missed or applied incorrectly in the production index pipeline.

## Immediate Containment

1. Freeze downstream publication for the affected benchmark and date range.
2. Record the impacted constituent, action type, effective date, and first incorrect published value.
3. Pull the original vendor notice, exchange bulletin, and any manual override records into the incident folder.

## Correction Workflow

1. Reconstruct the correct event payload and effective-date treatment.
2. Recompute divisor, constituent weights, adjusted prices, and any total-return logic from the earliest impacted date forward.
3. Compare corrected outputs against the published series to quantify the variance before restating.
4. Re-run the affected gold outputs and dependent dashboard metrics only after the corrected corporate action passes validation.

## Publication and Audit Trail

1. Publish the corrected series with a restatement note that references the incident ticket.
2. Preserve both the incorrect and corrected values in the audit trail.
3. Notify downstream users if the error crossed a materiality threshold or changed official benchmark history.

## Related


- [eu-bmr-benchmark-regulation](https://alp78.github.io/elysium/17-Financial-Domain/Regulatory/eu-bmr-benchmark-regulation) — restatement and record-keeping obligations
