---
title: "01 - EU BMR Benchmark Regulation"
tags: [sql, bigquery, gcp, financial, regulatory, stoxx]
type: reference
technology: [sql-server, bigquery, gcp]
status: stable
updated: 2026-03-23
---

# EU BMR — Benchmark Regulation

> [!abstract] What a Data Engineer Needs to Know
> EU Regulation 2016/1011 (Benchmark Regulation) governs the provision of benchmarks. As a data engineer at an index provider, you must ensure: complete audit trails, 5-year data retention, reproducible calculations, and documented methodology. This note focuses on the technical requirements, not legal theory.

## Administrator Obligations (Articles 5-16)

### Input Data Requirements (Article 11)

> [!quote]+
> "A benchmark is only as good as the data that goes into it."
>
> — **Jean-Paul Servais** (IOSCO Board Chair)


- All input data must be **traceable to its source** (vendor file, API call, manual entry)
- Input data must be **verifiable and auditable** — keep the raw files
- Procedures for dealing with **errors in input data** must be documented — the [compliance-and-auditability](https://alp78.github.io/elysium/13-Observability/Monitoring/compliance-and-auditability) framework provides the audit trail implementation that satisfies this requirement
- Internal review at least **annually**

#### What this means for the pipeline
- Bronze layer in GCS must be immutable (never overwrite raw files)
- Every pipeline run records source file path and SHA-256 hash in [lineage metadata](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/pit-integrity-logic)
- Quality gates at each medallion layer catch errors before publication

### Methodology Documentation (Article 12)

- The methodology must be **published and freely available**
- Changes must follow a **defined consultation process**
- The methodology document must include: calculation formula, data sources, weighting scheme, rebalancing rules, corporate action treatment

#### What this means for the pipeline
- Methodology parameters stored as version-controlled YAML (see [methodology-as-code](https://alp78.github.io/elysium/15-DataOps/dataops-for-indices))
- Every calculation uses the methodology version that was active on that date
- Changes tracked via Git history and ADRs

### Record Keeping (Article 8)

| Record Type | Minimum Retention | Storage Recommendation |
|-------------|-------------------|----------------------|
| All input data | 5 years | GCS Coldline/Archive |
| Calculation results | 5 years | SQL Server + BigQuery |
| Pipeline lineage | 5 years | SQL Server |
| Methodology versions | 5 years after last use | Git + document archive |
| Corporate action decisions | 5 years | SQL Server audit table |
| Complaints and resolutions | 5 years | Document management |
| Oversight function minutes | 5 years | Document management |

### Oversight Function (Article 5)

- Independent oversight of the benchmark provision process
- Reviews methodology, data quality, and operational integrity
- Must have access to all calculation data and audit trails

### Restatement and Cessation (Article 13-14)

- If a published benchmark value is materially incorrect: **restate and notify** — this is a formal Article 13 event requiring a documented correction process
- Document the error, correction, and notification in the audit trail; [audit-logging](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/01-Server-Operations/audit-logging) in SQL Server provides the evidence chain
- See the data restatement procedure for the operational runbook
- If cessation is planned: 6-month notice to users

## Technical Compliance Checklist

- [ ] Raw input data retained for 5 years (GCS lifecycle policy)
- [ ] Pipeline lineage table records every run with source hash
- [ ] Reproducibility test can re-derive any published value
- [ ] Corporate action audit log captures every adjustment
- [ ] Weight validation (sum = 1.0) runs before every publication
- [ ] Methodology YAML version-controlled in Git
- [ ] Annual internal review conducted and documented
- [ ] Restatement procedure documented and tested
- [ ] Oversight function has read access to all data and audit tables

## ISS & STOXX Glossary

- [Benchmark Regulation (EU BMR)](https://alp78.github.io/elysium/17-Financial-Domain/ISS-STOXX/regulatory#Benchmark%20Regulation%20(EU%20BMR)) — formal definition and scope
- [Benchmark Administrator](https://alp78.github.io/elysium/17-Financial-Domain/ISS-STOXX/regulatory#Benchmark%20Administrator) — administrator obligations
- [CTB](https://alp78.github.io/elysium/17-Financial-Domain/ISS-STOXX/regulatory#Climate%20Transition%20Benchmark%20(CTB)) and [PAB](https://alp78.github.io/elysium/17-Financial-Domain/ISS-STOXX/regulatory#PAB%20(Paris-Aligned%20Benchmark)) — climate benchmark definitions
- [Index Construction Glossary](https://alp78.github.io/elysium/17-Financial-Domain/ISS-STOXX/index-construction) — methodology terms referenced in BMR compliance

## Related

- [compliance-and-auditability](https://alp78.github.io/elysium/13-Observability/Monitoring/compliance-and-auditability) — Implementation details for lineage and audit
- [pit-integrity-logic](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/pit-integrity-logic) — Point-in-time data integrity and weight validation
- Data restatement procedure — Restatement runbook
- [sfdr-data-requirements](https://alp78.github.io/elysium/17-Financial-Domain/Regulatory/sfdr-data-requirements) — SFDR data pipeline requirements
- [iosco-benchmark-principles](https://alp78.github.io/elysium/17-Financial-Domain/Regulatory/iosco-benchmark-principles) — International benchmark standards

