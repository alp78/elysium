---
tags: [financial, regulatory]
type: reference
technology: []
status: stable
updated: 2026-03-23
---

# IOSCO Benchmark Principles

> [!abstract] When You Need This
> The 19 IOSCO Principles for Financial Benchmarks are the international standard that EU BMR is based on. Most regulators worldwide reference these principles. This note maps each principle to what the data engineering team must provide.

## The 19 Principles by Theme

### Governance (Principles 1-5)

| # | Principle | DE Team Responsibility |
|---|-----------|----------------------|
| 1 | Overall responsibility of administrator | Ensure systems support oversight function access |
| 2 | Oversight of third parties | Vendor SLA monitoring, fallback procedures |
| 3 | Conflicts of interest | Segregated service accounts (read vs write) |
| 4 | Control framework | Automated quality gates, circuit breakers |
| 5 | Internal oversight | Audit logs, pipeline lineage, quarterly reviews |

### Quality of the Benchmark (Principles 6-10)

| # | Principle | DE Team Responsibility |
|---|-----------|----------------------|
| 6 | Benchmark design | Methodology-as-code in version control |
| 7 | Data sufficiency | Coverage checks (>95% of universe), fallback logic |
| 8 | Hierarchy of data inputs | Priority: exchange data > broker quotes > estimates |
| 9 | Transparency of determinations | Published methodology, reproducible calculations |
| 10 | Periodic review | Annual review of data sources, quality metrics, methodology |

### Quality of Methodology (Principles 11-13)

| # | Principle | DE Team Responsibility |
|---|-----------|----------------------|
| 11 | Content of methodology | All formulas, parameters, rules documented and versioned |
| 12 | Changes to methodology | ADR process, consultation period, migration plan |
| 13 | Transition | Parallel calculation during methodology changes |

### Accountability (Principles 14-19)

| # | Principle | DE Team Responsibility |
|---|-----------|----------------------|
| 14 | Complaints | Complaint log accessible to oversight function |
| 15 | Audit trail | 5-year retention, lineage metadata, reproducibility |
| 16 | Cooperation with authorities | Data export capability for regulatory requests |
| 17 | Audit | External audit access to all systems and data |
| 18 | Benchmark cessation | 6-month notice, transition plan, data archive |
| 19 | Submitter code of conduct | If applicable: contributor data governance |

## Compliance Checkpoints for Data Engineers

### Every Pipeline Run
- [ ] Source data hash recorded in lineage table
- [ ] Row count and null rate within expected bounds
- [ ] Weights sum to 1.00000000
- [ ] No missing constituents

### Weekly
- [ ] Vendor SLA compliance reviewed
- [ ] Data quality metrics trending correctly
- [ ] No unresolved quarantined records

### Quarterly
- [ ] Reproducibility test on randomly selected historical dates
- [ ] Cross-system reconciliation (SQL Server vs BigQuery)
- [ ] Corporate action audit review
- [ ] ESG score coverage assessment

### Annually
- [ ] Full methodology review with oversight function
- [ ] Data source review (are vendors still appropriate?)
- [ ] Quality metric trends over the year
- [ ] Record retention verification (5-year compliance)
- [ ] Disaster recovery test (backup restore drill)

## Related

- [[eu-bmr-benchmark-regulation]] — EU implementation of IOSCO principles
- [[sfdr-data-requirements]] — ESG disclosure requirements
- [[compliance-and-auditability]] — Audit trail implementation
- [[data-quality-framework]] — Quality gates and SLA monitoring
- [[backup-restore-drill]] — Disaster recovery validation
