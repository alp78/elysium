---
tags: [adr, data-architecture, medallion]
type: reference
status: accepted
updated: 2026-03-23
---

# ADR-004: Medallion Architecture over Data Vault 2.0

## Status
Accepted | 2026-03-23

## Context
The platform needs a layered data processing pattern. Options: Medallion (bronze/silver/gold), Data Vault 2.0, or Kimball star schema directly.

## Decision
Use the Medallion architecture for the pipeline layer pattern.

**Why:**
- Conceptually simple: raw, cleaned, aggregated maps naturally to ETL stages
- Small team can understand and maintain without Data Vault modeling expertise
- SQL Server MERGE and DELETE-INSERT patterns map cleanly to bronze/silver/gold
- dbt staging/intermediate/marts maps 1:1
- Raw data preserved in bronze (EU BMR regulatory requirement)

## Consequences
- **Easier:** Simple to explain, implement, and debug. New engineers productive in days.
- **Harder:** Less flexible for many-source integration, less formal lineage
- **Trade-off:** Accepted lower modeling formality for faster development velocity

## Alternatives Considered
- **Data Vault 2.0:** Hub/link/satellite with excellent auditability. But requires modeling expertise, verbose DDL (3x tables), overhead not justified for 5-10 sources.
- **Kimball star schema only:** Great for analytics but lacks raw-data-preservation layer needed for audit.
- **Lambda architecture:** Batch + streaming overkill for daily-frequency pipelines.

## Related
- [[medallion-architecture]]
- [[data-warehouse-architecture]]
- [[data-modeling-patterns]]
