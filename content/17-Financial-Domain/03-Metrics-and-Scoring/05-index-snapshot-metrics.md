---
title: "05 - Index Snapshot Metrics"
type: reference
category: financial-domain
technology: [yfinance, sql-server]
tags: [sql, financial]
aliases: [Index Snapshot, Index Aggregates, Dashboard Snapshot]
keywords: [index snapshot, YTD return, 30d return, 90d return, volatility, P/E ratio, P/B ratio, dividend yield, cap-weighted, return interpretation, trend reversal]
description: "Cap-weighted index-level aggregate metrics displayed in the financial data platform dashboard snapshot panel, including return periods, volatility, and valuation ratios."
parent: "[[domain-metrics-and-scoring]]"
links:
  - "[[06-chart-metrics]]"
  - "[[03-daily-signal-scores]]"
  - "[[07-data-sources-and-refresh]]"
  - "[[02-factor-profile-and-composition]]"
  - "[[04-quarterly-signal-scores]]"
  - "[[01-scoring-methodology]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Index Snapshot Metrics

The index snapshot panel displays cap-weighted aggregates computed daily from constituent data in the financial data platform dashboard. These metrics provide an at-a-glance view of index performance, risk regime, and valuation level.

## Index Snapshot Metrics Table

| Metric | Formula | Thresholds |
|--------|---------|------------|
| **YTD Return** | Cumulative equal-weight return from Jan 1 | > +10% strong · < −10% drawdown |
| **30d Return** | Rolling 30 trading-day return | Compare with 90d (see below) |
| **90d Return** | Rolling 90 trading-day return | Compare with 30d (see below) |
| **30d Volatility** | Annualized std dev of daily returns (×√252) | < 15% calm · 15–25% elevated · > 25% high risk |
| **P/E** | Cap-weighted avg forward price-to-earnings | < 15 cheap · > 25 expensive |
| **P/B** | Cap-weighted avg price-to-book | < 1.5 value · > 3 growth premium |
| **Dividend Yield** | Cap-weighted avg yield across constituents | > 3% attractive for income |

## vs 90d Return Interpretation

Comparing the 30-day and 90-day rolling returns reveals the trend direction and acceleration. This is a key signal for identifying momentum shifts and potential regime changes.

| Scenario | Meaning |
|----------|---------|
| 30d > 90d, both positive | Strong rally gaining steam |
| 30d < 90d, both positive | Rally decelerating |
| 30d > 90d, both negative | Selloff moderating |
| 30d < 90d, both negative | Deepening selloff |
| Mixed signs | Potential trend reversal |

> [!tip] Practical Use
> When 30d and 90d returns show mixed signs, cross-reference with [technical-indicators](https://alp78.github.io/elysium/17-Financial-Domain/Market-Analysis/technical-indicators) (RSI, MACD) and [breadth-and-sentiment-indicators](https://alp78.github.io/elysium/17-Financial-Domain/Market-Analysis/breadth-and-sentiment-indicators) to confirm whether a genuine trend reversal is underway.

## Cap-Weighting Formula

All index-level metrics use market-capitalization weighting. See [scoring-methodology](https://alp78.github.io/elysium/17-Financial-Domain/Metrics-and-Scoring/scoring-methodology) for the full formula:

$$w_i = \frac{\text{MarketCap}_i}{\sum_{j \in \text{index}} \text{MarketCap}_j}$$

## Related

- [chart-metrics](https://alp78.github.io/elysium/17-Financial-Domain/Metrics-and-Scoring/chart-metrics) for time-series visualizations of these metrics
- [scoring-methodology](https://alp78.github.io/elysium/17-Financial-Domain/Metrics-and-Scoring/scoring-methodology) for how cap-weighted averages are computed
- [valuation-ratios](https://alp78.github.io/elysium/17-Financial-Domain/Market-Analysis/valuation-ratios) for additional valuation metrics beyond P/E and P/B
- [data-sources-and-refresh](https://alp78.github.io/elysium/17-Financial-Domain/Metrics-and-Scoring/data-sources-and-refresh) for data sourcing and refresh schedule
