---
title: "Scoring Methodology"
type: concept
category: financial-domain
technology: [python, sql-server, numpy]
tags: [python, sql, financial]
aliases: [Scoring Methodology, z-score methodology, z-score calculation, composite scores, dense ranking, cap-weighting]
keywords: [scoring methodology, z-score, cross-sectional, composite score, dense rank, cap-weighted, standardization, normalization, ranking, mean, standard deviation, inverted z-score, sign inversion]
description: "Z-score calculation methodology, composite scoring, dense ranking, and cap-weighting formulas used across all financial data platform dashboard signals and metrics."
parent: "[[domain-metrics-and-scoring]]"
links:
  - "[[chart-metrics]]"
  - "[[daily-signal-scores]]"
  - "[[data-sources-and-refresh]]"
  - "[[factor-profile-and-composition]]"
  - "[[index-snapshot-metrics]]"
  - "[[quarterly-signal-scores]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Scoring Methodology

All daily and quarterly scores in the [financial data platform dashboard](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/daily-signal-scores) use cross-sectional z-scores to standardize and rank constituents within each index. This note documents the exact methodology for z-score calculation, composite scoring, ranking, and cap-weighting.

## Z-Score Calculation


All daily and quarterly scores use cross-sectional z-scores within a grouping (index or sector):

$$z = \frac{x - \mu_{\text{group}}}{\sigma_{\text{group}}}$$

Where μ and σ are computed across all constituents in the same group on the same date. Sector-level grouping is used when sufficient peers exist (≥ 3); otherwise falls back to index-level.

> [!info] Cross-Sectional, Not Time-Series
> These z-scores compare a stock to its **peers on the same day**, not to its own historical values. A momentum z-score of +2.0 means the stock's momentum is 2 standard deviations above the index average *today*, regardless of whether that's high or low historically.

## Composite Scores

Simple average of component z-scores:

$$\text{Composite} = \frac{1}{n}\sum_{i=1}^{n} z_i$$

Some components are sign-inverted before averaging (e.g., P/E: lower is better, so −z is used).

#### Sign inversion examples
- [Relative Value Score](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/daily-signal-scores): Forward P/E, Price/Book, EV/EBITDA are inverted (−z) because lower valuations are better
- [Sentiment Score](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/daily-signal-scores): Recommendation is inverted (−z) because lower numeric rating = more bullish
- [Quality Score](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/quarterly-signal-scores): Leverage (debt/equity) is inverted (−z) because lower debt is better

## Ranking

Dense rank within each index, descending by score:

- Rank 1 = highest score (best)
- Ties receive the same rank
- No gaps in ranking sequence

**Example:** If three stocks have composite scores of 1.5, 1.2, 1.2, 0.8, they are ranked 1, 2, 2, 3 (dense rank — no gap at rank 3).

**SQL implementation** (executed in the [gold-transforms](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/gold-transforms) layer):
```sql
DENSE_RANK() OVER (
    PARTITION BY index_key, trade_date
    ORDER BY composite_score DESC
) AS rank_in_index
```

## Index Weights (Cap-Weighting)

Cap-weighted using daily market capitalization:

$$w_i = \frac{\text{MarketCap}_i}{\sum_{j \in \text{index}} \text{MarketCap}_j}$$

Used for P/E, P/B, dividend yield, and other [index-level aggregates](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/index-snapshot-metrics).

> [!tip] Cap-Weighting vs Equal-Weighting
> Index-level metrics (P/E, volatility) are cap-weighted to reflect the index's actual composition. Individual stock scores (momentum, value, sentiment) are computed on an equal-weighted basis — each stock's z-score has equal influence regardless of market cap. The [data-quality-framework](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/data-quality-framework) defines the quality gates that validate score outputs before they reach consumers.

## Sector-Level vs Index-Level Grouping

| Grouping | When Used | Why |
|----------|-----------|-----|
| **Index-level** | Default for daily signals | Compares stock to all peers in the index |
| **Sector-level** | [Quality/moat score](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/quarterly-signal-scores) when ≥ 3 sector peers | Compares within similar business models (more meaningful) |
| **Fallback to index** | When sector has < 3 constituents | Insufficient peers for meaningful sector z-score |

## Related

- [daily-signal-scores](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/daily-signal-scores) — Momentum, value, sentiment composite scores
- [quarterly-signal-scores](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/quarterly-signal-scores) — Quality, health, governance scores
- [index-snapshot-metrics](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/index-snapshot-metrics) — Cap-weighted index aggregates
- [factor-profile-and-composition](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/factor-profile-and-composition) — Radar chart normalization (z-score → 0-100 scale)
- [gold-transforms](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/gold-transforms) — SQL implementation of scoring in the gold layer

