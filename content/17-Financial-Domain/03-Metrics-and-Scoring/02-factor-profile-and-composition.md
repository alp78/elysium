---
title: "02 - Factor Profile and Composition"
type: reference
category: financial-domain
technology: [yfinance, sql-server]
tags: [sql, financial]
aliases: [Factor Profile, Radar Chart, Index Composition, Donut Chart]
keywords: [factor profile, radar chart, factor tilt, value, momentum, sentiment, quality, governance, index composition, donut chart, sector allocation, cap-weighted, cube-root scaling]
description: "Factor profile radar chart and index composition donut chart from the financial data platform dashboard, showing five-axis factor tilts and dual-ring sector/stock weight breakdowns."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Factor Profile and Index Composition

The financial data platform dashboard includes two visualization panels that synthesize the individual signal scores into high-level index characterizations: a five-axis radar chart for factor tilts and a dual-ring donut chart for index composition.

## Factor Profile (Radar Chart)

> [!quote]+
> "Your portfolio's returns are overwhelmingly determined by your exposure to a few common risk factors."
>
> — **Eugene Fama**


The factor profile radar chart displays the average factor tilt of the selected index across five axes. Raw z-scores from daily and quarterly signal calculations are normalized to a 0–100 scale for visualization.

#### Radar chart axes

| Axis | Source |
|------|--------|
| Value | Daily relative value z-scores (see [daily-signal-scores](https://alp78.github.io/elysium/17-Financial-Domain/Metrics-and-Scoring/daily-signal-scores)) |
| Momentum | Daily momentum z-scores (see [daily-signal-scores](https://alp78.github.io/elysium/17-Financial-Domain/Metrics-and-Scoring/daily-signal-scores)) |
| Sentiment | Daily sentiment z-scores (see [daily-signal-scores](https://alp78.github.io/elysium/17-Financial-Domain/Metrics-and-Scoring/daily-signal-scores)) |
| Quality | Quarterly quality z-scores (see [quarterly-signal-scores](https://alp78.github.io/elysium/17-Financial-Domain/Metrics-and-Scoring/quarterly-signal-scores)) |
| Governance | Quarterly governance scores (see [quarterly-signal-scores](https://alp78.github.io/elysium/17-Financial-Domain/Metrics-and-Scoring/quarterly-signal-scores)) |

**Interpretation**: A larger filled area on the radar chart indicates a stronger overall index profile. Compare across indices to spot factor tilts — for example, one index may skew toward value while another skews toward momentum. This helps identify the dominant investment style embedded in each index.

> [!tip] Comparative Analysis
> Overlay radar charts for different indices (e.g., a European equity index vs a US equity index) to identify which factor dimensions differentiate them most. A high-quality, low-momentum profile suggests a mature, stable index; high-momentum, low-value suggests a growth-oriented index.

## Index Composition (Donut Chart)

The index composition donut chart is a dual-ring visualization showing how the index is constructed.

#### Ring breakdown

| Ring | What it shows |
|------|---------------|
| **Outer ring** | Individual stock weights (cap-weighted) |
| **Inner ring** | Sector allocation (aggregated stock weights) |

Weights are cube-root scaled for display so small-cap constituents remain visible alongside mega-cap names.

> [!info] Weight Calculation
> Stock weights use daily market capitalization. See [scoring-methodology](https://alp78.github.io/elysium/17-Financial-Domain/Metrics-and-Scoring/scoring-methodology) for the cap-weighting formula and [weight capping](https://alp78.github.io/elysium/17-Financial-Domain/Market-Analysis/index-maintenance-and-corporate-actions) for the free-float methodology and capping rules that constrain maximum weights.

## Related

- [daily-signal-scores](https://alp78.github.io/elysium/17-Financial-Domain/Metrics-and-Scoring/daily-signal-scores) for the daily factor components feeding the radar chart
- [quarterly-signal-scores](https://alp78.github.io/elysium/17-Financial-Domain/Metrics-and-Scoring/quarterly-signal-scores) for the quarterly factor components
- [scoring-methodology](https://alp78.github.io/elysium/17-Financial-Domain/Metrics-and-Scoring/scoring-methodology) for normalization and weighting formulas
- [weight capping](https://alp78.github.io/elysium/17-Financial-Domain/Market-Analysis/index-maintenance-and-corporate-actions) for weight capping rules
