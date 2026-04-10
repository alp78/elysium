---
title: "04 - Quarterly Signal Scores"
type: reference
category: financial-domain
technology: [yfinance, sql-server, python]
tags: [python, sql, financial]
aliases: [Quarterly Signals, Quality Score, Moat Score, Health Warnings, Governance Risk Score]
keywords: [quarterly signals, quality score, moat score, gross margin, ROE, operating margin, leverage, debt-to-equity, FCF yield, free cash flow, health warnings, liquidity flag, leverage flag, cash burn, revenue decline, governance risk, audit risk, board risk, compensation risk, shareholder rights, ISS]
description: "Quarterly earnings-based scores in the financial data platform dashboard: quality/moat score, binary health warning flags, and ISS-style governance risk score with component breakdowns."
parent: "[[domain-metrics-and-scoring]]"
links:
  - "[[06-chart-metrics]]"
  - "[[03-daily-signal-scores]]"
  - "[[07-data-sources-and-refresh]]"
  - "[[02-factor-profile-and-composition]]"
  - "[[05-index-snapshot-metrics]]"
  - "[[01-scoring-methodology]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Quarterly Signal Scores

Quarterly signal scores are updated with earnings reports and use the most recent quarterly financial data from yfinance. Unlike [daily-signal-scores](https://alp78.github.io/elysium/17-Financial-Domain/Metrics-and-Scoring/daily-signal-scores), these scores change infrequently and reflect fundamental business health rather than market sentiment.

## Quality / Moat Score

> [!quote]
> "A truly great business must have an enduring 'moat' that protects excellent returns on invested capital."
>
> — **Warren Buffett**


The quality score (also called the moat score) measures fundamental strength across profitability, efficiency, and cash generation. Z-scores are computed within sectors when sufficient peers exist (3 or more); otherwise falls back to index-level grouping.

#### Component breakdown

| Component | Source | Method |
|-----------|--------|--------|
| Gross Margin | Quarterly financials | z-score within sector |
| ROE | Return on equity | z-score within sector |
| Operating Margin | Quarterly financials | z-score within sector |
| Leverage | Debt-to-equity | Inverted z-score (lower debt = higher) |
| FCF Yield | Free cash flow / market cap | z-score within sector |

#### Composite quality formula

$$\text{QualityScore} = \text{mean}(z_{\text{GM}},\ z_{\text{ROE}},\ z_{\text{OpM}},\ -z_{\text{Lev}},\ z_{\text{FCF}})$$

**Interpretation**: High score = superior profitability, low debt, strong cash generation. Scores > 1.0 indicate clear fundamental superiority.

## Health Warnings

Health warnings are binary flags derived from quarterly balance sheet data. Stocks with 2 or more flags appear in the health warnings table on the dashboard.

#### Flag definitions

| Flag | Condition | Color | Risk |
|------|-----------|-------|------|
| **Liq** (Liquidity) | Current ratio < 1.0 | Blue | Cannot cover short-term obligations |
| **Lev** (Leverage) | Debt/Equity > 200% | Orange | Excessive debt burden |
| **Cash** (Cash Burn) | Free cash flow < 0 | Red | Consuming cash, not generating it |
| **Decl** (Decline) | Revenue AND margin both falling QoQ | Purple | Deteriorating business fundamentals |

#### Risk level classification

| Flags | Risk Level |
|-------|------------|
| 0 | Healthy |
| 1 | Watch |
| 2 | Warning |
| 3+ | Critical |

> [!warning] Critical Signal
> Low quality score + many health flags = strong caution signal. Critical-level stocks may face dividend cuts, credit downgrades, or restructuring. Cross-reference with [daily-signal-scores](https://alp78.github.io/elysium/17-Financial-Domain/Metrics-and-Scoring/daily-signal-scores) divergence alerts.

## Governance Risk Score

> [!quote]
> "Good corporate governance is about having the right processes to make and implement decisions."
>
> — **Robert Monks**, *Corporate Governance* (1995)


A composite of ISS-style risk dimensions sourced from yfinance quarterly data. This score measures the quality of corporate governance practices.

#### Sub-score breakdown

| Sub-Score | What it measures | Scale |
|-----------|------------------|-------|
| Audit Risk | Financial reporting integrity | 1 (low) – 10 (high risk) |
| Board Risk | Board independence and effectiveness | 1 – 10 |
| Compensation Risk | Executive pay alignment with shareholders | 1 – 10 |
| Shareholder Rights Risk | Minority shareholder protections | 1 – 10 |

#### Composite governance formula (inverted so higher = better)

$$\text{GovernanceScore} = 10 - \text{mean}(\text{AuditRisk}, \text{BoardRisk}, \text{CompRisk}, \text{ShareholderRisk})$$

**Scale**: 0 (worst governance) – 10 (best governance). Scores below 5 warrant attention.

> [!info] ESG Connection
> Governance risk is one pillar of ESG evaluation. For broader ESG data integration including environmental and social scores, see  and [esg-and-sustainability](https://alp78.github.io/elysium/17-Financial-Domain/Encyclopedia/esg-and-sustainability).

## Related

- [daily-signal-scores](https://alp78.github.io/elysium/17-Financial-Domain/Metrics-and-Scoring/daily-signal-scores) for market-driven daily scores
- [scoring-methodology](https://alp78.github.io/elysium/17-Financial-Domain/Metrics-and-Scoring/scoring-methodology) for the z-score and ranking mathematics
- [factor-profile-and-composition](https://alp78.github.io/elysium/17-Financial-Domain/Metrics-and-Scoring/factor-profile-and-composition) for how quarterly scores feed the radar chart
- [data-sources-and-refresh](https://alp78.github.io/elysium/17-Financial-Domain/Metrics-and-Scoring/data-sources-and-refresh) for quarterly data refresh timing
