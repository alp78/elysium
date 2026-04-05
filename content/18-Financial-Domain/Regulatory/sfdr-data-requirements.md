---
title: "SFDR Data Requirements"
tags: [python, sql, bigquery, financial, regulatory, esg, stoxx]
type: reference
technology: [python, bigquery, sql-server]
status: stable
updated: 2026-03-23
parent: "[[domain-regulatory]]"
links:
  - "[[eu-bmr-benchmark-regulation]]"
  - "[[iosco-benchmark-principles]]"
---

# SFDR Data Requirements

> [!abstract] When You Need This
> The Sustainable Finance Disclosure Regulation (EU 2019/2088) requires financial market participants to disclose sustainability risks and impacts. As a data engineer building ESG data pipelines, you need to know which data points to collect, compute, and publish.

## Article Classification (Pipeline Perspective)

| Article | Fund Type | Data Requirement | Pipeline Impact |
|---------|-----------|-----------------|----------------|
| **Article 6** | No sustainability claims | Basic risk disclosure | Minimal — text-only disclosures |
| **Article 8** | Promotes E/S characteristics | PAI indicators for promoted characteristics | Moderate — compute selected PAIs |
| **Article 9** | Sustainable investment objective | Full PAI disclosure + positive contribution proof | Heavy — compute all mandatory PAIs + taxonomy alignment |

## Principal Adverse Impact (PAI) Indicators

### Mandatory Indicators (Table 1 of SFDR RTS)

> [!quote]
> "What gets measured gets managed — and what gets disclosed gets scrutinized."
>
> — **Hiro Mizuno** (former CIO, Japan Government Pension Investment Fund)


| # | Indicator | Data Needed | Vendor Source | Computation |
|---|-----------|-------------|--------------|-------------|
| 1 | GHG emissions (Scope 1, 2, 3) | tonnes CO2e per company | MSCI, Sustainalytics, CDP | WACI = SUM(weight * emissions / revenue) |
| 2 | Carbon footprint | tonnes CO2e per EUR invested | Same + EVIC | CF = SUM(weight * emissions / evic) * portfolio_value |
| 3 | GHG intensity of investee companies | tonnes CO2e / EUR revenue | Same | Weighted average |
| 4 | Exposure to fossil fuels | % revenue from fossil fuels | MSCI, Bloomberg | Binary flag + revenue share |
| 5 | Non-renewable energy share | % energy consumption | CDP, MSCI | Weighted average |
| 6 | Energy consumption intensity | GWh / EUR revenue per sector | CDP | Sector-level calculation |
| 7 | Biodiversity impact | Operations near sensitive areas | MSCI, Sustainalytics | Binary flag |
| 8 | Water emissions | tonnes discharged | CDP | Weighted average |
| 9 | Hazardous waste | tonnes generated | CDP, MSCI | Weighted average |
| 10 | UNGC/OECD violations | Number of violations | MSCI, ISS | Binary flag per company |
| 11 | Gender pay gap | % difference | Company reports | Weighted average |
| 12 | Board gender diversity | % female directors | Bloomberg, MSCI | Weighted average |
| 13 | Controversial weapons exposure | Binary | MSCI, Sustainalytics | Binary flag |
| 14 | GHG intensity of sovereigns | tonnes CO2e / GDP | World Bank, UNFCCC | Direct lookup |

### Data Pipeline for PAI Computation

See  for the full vendor normalization pipeline (when the ESG quality checks fail, follow the [[esg-circuit-breaker-fired]] runbook). The PAI computation sits on top of the normalized ESG scores:

```
ESG vendor data (raw) → Normalize (0-100 scale) → PAI calculation → SFDR disclosure report
```

### Key Computation: WACI


```python
def compute_waci(weights: pd.DataFrame, emissions: pd.DataFrame) -> float:
    """Weighted Average Carbon Intensity (PAI Indicator 3).
    WACI = SUM(weight_i * scope1_2_emissions_i / revenue_i)
    """
    merged = weights.merge(emissions, on='instrument_isin')
    merged['carbon_intensity'] = merged['scope1_2_tonnes'] / merged['revenue_eur_millions']
    return (merged['weight_pct'] * merged['carbon_intensity']).sum()
```

## Data Vendor Mapping to PAI Indicators

| PAI Indicator | Primary Vendor | Backup Vendor | Coverage |
|--------------|----------------|---------------|----------|
| GHG Scope 1+2 | MSCI ESG | CDP | ~85% of large caps |
| GHG Scope 3 | CDP | MSCI (estimated) | ~40% reported, rest estimated |
| Fossil fuel revenue | MSCI | Bloomberg | ~90% |
| UNGC violations | MSCI | ISS | ~95% |
| Board diversity | Bloomberg | MSCI | ~90% |
| Controversial weapons | MSCI | Sustainalytics | ~98% |

> [!warning] Coverage Gaps
> Scope 3 emissions and some social indicators have low reported coverage. Vendors fill gaps with estimates. Your pipeline must track whether a value is reported or estimated — SFDR requires disclosure of estimation methodology. [LLM extraction pipelines](https://alp78.github.io/elysium/16-AI-and-Prompts/LLM-Pipelines/ai-augmented-data-engineering) can help parse unstructured sustainability reports to fill these gaps with source-attributed data.

## ISS & STOXX Glossary

- [SFDR](https://alp78.github.io/elysium/18-Financial-Domain/ISS-STOXX/regulatory#SFDR%20(Sustainable%20Finance%20Disclosure%20Regulation)) — formal regulatory definition and scope
- [Article 8](https://alp78.github.io/elysium/18-Financial-Domain/ISS-STOXX/regulatory#Article%208%20Fund%20(SFDR)) and [Article 9](https://alp78.github.io/elysium/18-Financial-Domain/ISS-STOXX/regulatory#Article%209%20Fund%20(SFDR)) — fund classification definitions
- [PAI](https://alp78.github.io/elysium/18-Financial-Domain/ISS-STOXX/regulatory#PAI%20(Principal%20Adverse%20Impact)) and [PAI Indicators](https://alp78.github.io/elysium/18-Financial-Domain/ISS-STOXX/regulatory#PAI%20Indicators) — indicator framework
- [WACI](https://alp78.github.io/elysium/18-Financial-Domain/ISS-STOXX/sustainability-themes#Weighted%20Average%20Carbon%20Intensity%20(WACI)) — carbon intensity methodology
- [Emissions Scopes](https://alp78.github.io/elysium/18-Financial-Domain/ISS-STOXX/sustainability-themes#Emissions%20Scopes) — Scope 1, 2, 3 definitions
- [Norm-Based Screening](https://alp78.github.io/elysium/18-Financial-Domain/ISS-STOXX/esg-ratings#Norm-Based%20Screening) — UNGC violations screening methodology

## Related

- [eu-bmr-benchmark-regulation](https://alp78.github.io/elysium/18-Financial-Domain/Regulatory/eu-bmr-benchmark-regulation) — Benchmark administrator obligations
- [iosco-benchmark-principles](https://alp78.github.io/elysium/18-Financial-Domain/Regulatory/iosco-benchmark-principles) — International standards
- [compliance-and-auditability](https://alp78.github.io/elysium/13-Observability/Monitoring/compliance-and-auditability) — Audit trail for ESG data
- [data-quality-framework](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/data-quality-framework) — Quality gates for ESG data completeness
