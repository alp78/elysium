---
type: index
category: financial-domain
technology: [yfinance, sql-server, python]
tags: [python, sql, financial]
aliases: [Financial Domain, Finance Section, Financial Knowledge Base]
keywords: [financial domain, metrics, scoring, encyclopedia, market analysis, index maintenance, corporate actions, valuation, trading, payments, banking, insurance]
description: "Central index for all financial domain knowledge including dashboard metrics, scoring methodology, market analysis indicators, corporate actions, and a comprehensive financial terms encyclopedia."
related:
  - "[[medallion-architecture]]"
  - "[[data-sources-and-refresh]]"
  - "[[gold-transforms]]"
  - "[[scoring-methodology]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Financial Domain Knowledge

This section contains financial domain knowledge essential for data engineers working with equity index data, market analytics, and financial data pipelines. It covers dashboard metrics and scoring methodology used in the financial data platform project, standard market analysis indicators, index maintenance operations, and a comprehensive encyclopedia of 150+ financial and business terms.

## Section Overview

### Metrics and Scoring

Notes covering the financial data platform dashboard metrics, composite scoring methodology, and data sources.

| Note | Description |
|------|-------------|
| [[index-snapshot-metrics]] | Cap-weighted index aggregates: YTD return, volatility, P/E, P/B, dividend yield |
| [[chart-metrics]] | Five synchronized time-series charts: portfolio return, rolling return, drawdown, volatility, Sharpe ratio |
| [[daily-signal-scores]] | Cross-sectional z-score signals: momentum, relative value, sentiment, and divergence alerts |
| [[quarterly-signal-scores]] | Earnings-based scores: quality/moat, health warnings, governance risk |
| [[factor-profile-and-composition]] | Radar chart factor tilts and donut chart index composition |
| [[scoring-methodology]] | Z-score calculation, composite scores, dense ranking, and cap-weighting formulas |
| [[data-sources-and-refresh]] | yfinance data sources, refresh cadences, and pipeline schedule |

### Market Analysis

Standard indicators used in equity index analysis including technical, risk, breadth, liquidity, and valuation metrics, plus index maintenance operations from [[index-maintenance-and-corporate-actions]].

| Note | Description |
|------|-------------|
| [[valuation-ratios]] | PEG ratio, CAPE/Shiller P/E, EV/Sales, FCF yield, earnings yield |
| [[technical-indicators]] | RSI, MACD, Bollinger Bands, ADX, Golden/Death Cross |
| [[risk-and-volatility-metrics]] | Beta, VIX, maximum drawdown, Sortino ratio, Calmar ratio, Value at Risk |
| [[breadth-and-sentiment-indicators]] | Advance/Decline ratio, percent above 200-day MA, put/call ratio, short interest |
| [[liquidity-and-flow-metrics]] | Bid-ask spread, turnover ratio, Money Flow Index, On-Balance Volume |
| [[index-maintenance-and-corporate-actions]] | Financial index fundamentals, weighting schemes, divisor, corporate actions pipeline, reconstitution |

### Encyclopedia

Comprehensive definitions of 150+ financial and business terms grouped thematically. Each entry includes definitions, real-world context from major equity index constituents, examples, and cross-references.

| Note | Description |
|------|-------------|
| [[payments-and-settlement]] | Acquiring, issuing, authorization, clearing, settlement, gateway, merchant services, tokenization |
| [[banking-and-lending]] | Commercial, retail, wholesale, digital banking, consumer finance, mortgages, leasing, credit cards |
| [[insurance-and-risk]] | Life, property-casualty, reinsurance, premiums, underwriting, parametric, unit-linked, bancassurance |
| [[capital-markets-and-trading]] | Capital markets, securities, equities, fixed income, derivatives, futures and options |
| [[investment-management]] | Asset management, portfolio management, mutual funds, hedge funds, private equity, venture capital, wealth management |
| [[corporate-finance-and-strategy]] | Investment banking, M&A, corporate finance advisory, capital raising, spin-offs, restructuring |
| [[technology-and-digital]] | Cloud computing, IaaS, PaaS, SaaS, IoT, AI/ML, cybersecurity, ERP, digital transformation |
| [[energy-and-commodities]] | Upstream, midstream, downstream, refining, petrochemicals, LNG, renewable energy, green hydrogen |
| [[pharma-and-healthcare]] | Clinical trials, biosimilars, generic drugs, CDMO, recombinant therapies, regulatory approval |
| [[structured-finance]] | Structured finance, project finance, loan syndication, warehouse financing, non-bank lenders |
| [[esg-and-sustainability]] | ESG criteria, sustainable finance, carbon capture, net-zero, energy storage |
| [[exchanges-and-market-infrastructure]] | Stock exchanges, clearing houses, custodian services, market-making, prime brokerage |
| [[compliance-and-risk-management]] | Compliance, risk management, regulatory approval, intellectual property, patents, royalties |
| [[real-estate-and-industrial]] | Real estate, concessions, fleet management, logistics, supply chain, OEM, aftermarket, MRO |
| [[business-models-and-commerce]] | E-commerce, B2B, B2C, franchise, licensing, platform models, subscription, omnichannel |
| [[trade-and-treasury]] | Trade finance, cash management, treasury services, working capital, export credit agency finance |

## Cross-References

- **Data Pipeline**: [[data-sources-and-refresh]] | [[medallion-architecture]] | [[gold-transforms]]
- **Scoring Details**: [[scoring-methodology]] | [[daily-signal-scores]] | [[quarterly-signal-scores]]
- **SQL Patterns**: [[silver-transforms]] | [[bronze-layer-loading]]
- **Orchestration**: the Airflow DAGs

> *This table renders in Obsidian via Dataview. On the web, browse the notes listed above or use the Explorer sidebar.*
