---
title: "03 - Daily Signal Scores"
type: reference
category: financial-domain
technology: [yfinance, sql-server, python]
tags: [python, sql, financial]
aliases: [Daily Signals, Daily Scores, Momentum Score, Value Score, Sentiment Score, Divergence Alerts]
keywords: [daily signals, momentum score, relative strength, SMA-50, SMA-200, 52-week high, divergence alert, relative value score, forward P/E, price-to-book, EV/EBITDA, dividend yield, sentiment score, analyst target, recommendation, z-score, cross-sectional, contrarian]
description: "Daily cross-sectional z-score signals computed across index constituents: momentum score, divergence alerts, relative value score, and sentiment score with component breakdowns and interpretation."
parent: "[[domain-metrics-and-scoring]]"
links:
  - "[[06-chart-metrics]]"
  - "[[07-data-sources-and-refresh]]"
  - "[[02-factor-profile-and-composition]]"
  - "[[05-index-snapshot-metrics]]"
  - "[[04-quarterly-signal-scores]]"
  - "[[01-scoring-methodology]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Daily Signal Scores

Daily signal scores are cross-sectional z-scores computed daily across all index constituents in the financial data platform dashboard. Each composite score averages its component z-scores and is ranked with dense rank (no gaps, ties allowed). See [scoring-methodology](https://alp78.github.io/elysium/17-Financial-Domain/Metrics-and-Scoring/scoring-methodology) for the underlying z-score and ranking mechanics.

## Momentum Score

> [!quote]
> "An object in motion tends to stay in motion. So does a stock price."
>
> — **Cliff Asness**


The momentum score measures sustained price trend strength across four dimensions.

#### Component breakdown

| Component | Source | Method |
|-----------|--------|--------|
| Relative Strength | 52-week return − index 52-week return | z-score within index |
| SMA-50 Ratio | Price / 50-day moving average | z-score within index |
| SMA-200 Ratio | Price / 200-day moving average | z-score within index |
| 52-Week High Proximity | (Price − 52w high) / 52w high | Inverted z-score (closer to peak = higher) |

#### Composite momentum formula

$$\text{MomentumScore} = \text{mean}(z_{\text{RS}},\ z_{\text{SMA50}},\ z_{\text{SMA200}},\ z_{\text{52wHigh}})$$

**Interpretation**: Rank #1 has the strongest uptrend across all four dimensions. Scores > 1.5 indicate exceptionally strong momentum.

> [!tip] Cross-Reference
> For standalone technical indicators like RSI, MACD, and ADX that complement the momentum score, see [technical-indicators](https://alp78.github.io/elysium/17-Financial-Domain/Market-Analysis/technical-indicators).

## Divergence Alerts


Divergence alerts are contrarian signals that fire when price is falling but analysts still rate the stock a buy. This can indicate either a market overreaction (opportunity) or a value trap (analysts lagging reality).

#### Trigger conditions (both must be true simultaneously)

| Condition | Criteria |
|-----------|----------|
| Price falling | 52-week change < −10% |
| Analysts bullish | Recommendation mean ≤ 2.5 and implied upside > 0 |

#### Alert columns

- **Upside** — (analyst target price / current price) − 1
- **Rec** — consensus recommendation (1.0 = Strong Buy → 5.0 = Strong Sell)

> [!warning] Caution
> Always cross-reference divergence alerts with fundamentals. A stock with falling price and bullish analysts may be a value trap if the fundamental thesis has changed. Check [quarterly-signal-scores](https://alp78.github.io/elysium/17-Financial-Domain/Metrics-and-Scoring/quarterly-signal-scores) quality scores and health warnings.

## Relative Value Score

The relative value score measures how cheaply a stock trades relative to its index peers. All valuation multiples are inverted (lower = better) except dividend yield.

#### Component breakdown

| Component | Source | Method |
|-----------|--------|--------|
| Forward P/E | yfinance `forwardPE` | Inverted z-score within index |
| Price/Book | yfinance `priceToBook` | Inverted z-score within index |
| EV/EBITDA | yfinance `enterpriseToEbitda` | Inverted z-score within index |
| Dividend Yield | yfinance `dividendYield` | z-score within index (higher yield = higher score) |

#### Composite value formula

$$\text{ValueScore} = \text{mean}(-z_{\text{PE}},\ -z_{\text{PB}},\ -z_{\text{EV}},\ z_{\text{Yield}})$$

**Interpretation**: Top-ranked stocks trade at the deepest discount to index median. Scores > 1.0 indicate significant undervaluation. Always verify — cheap can mean value trap.

> [!info] Extended Valuation
> For additional valuation ratios (PEG, CAPE, EV/Sales, FCF Yield), see [valuation-ratios](https://alp78.github.io/elysium/17-Financial-Domain/Market-Analysis/valuation-ratios).

## Sentiment Score

The sentiment score combines analyst upside with consensus recommendation strength to measure the direction and intensity of Wall Street sentiment.

#### Component breakdown

| Component | Source | Method |
|-----------|--------|--------|
| Implied Upside | (Target price / current) − 1 | z-score within index |
| Recommendation | Consensus analyst rating | Inverted z-score (lower mean = more bullish) |

#### Composite sentiment formula

$$\text{SentimentScore} = \text{mean}(z_{\text{Upside}},\ -z_{\text{Rec}})$$

#### Recommendation scale reference

1.0 (Strong Buy) → 2.0 (Buy) → 3.0 (Hold) → 4.0 (Sell) → 5.0 (Strong Sell)

## Related

- [quarterly-signal-scores](https://alp78.github.io/elysium/17-Financial-Domain/Metrics-and-Scoring/quarterly-signal-scores) for earnings-based scores (quality, governance)
- [scoring-methodology](https://alp78.github.io/elysium/17-Financial-Domain/Metrics-and-Scoring/scoring-methodology) for z-score calculation and ranking details
- [factor-profile-and-composition](https://alp78.github.io/elysium/17-Financial-Domain/Metrics-and-Scoring/factor-profile-and-composition) for the radar chart synthesizing all factor scores
- [data-sources-and-refresh](https://alp78.github.io/elysium/17-Financial-Domain/Metrics-and-Scoring/data-sources-and-refresh) for yfinance field mappings and refresh cadence
