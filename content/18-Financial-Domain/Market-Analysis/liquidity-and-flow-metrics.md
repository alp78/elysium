---
title: "Liquidity and Flow Metrics"
type: reference
category: financial-domain
technology: [yfinance, python]
tags: [python, financial]
aliases: [Liquidity and Flow Metrics, liquidity metrics, bid-ask spread, turnover ratio, Money Flow Index, MFI, On-Balance Volume, OBV]
keywords: [liquidity metrics, flow metrics, bid-ask spread, turnover ratio, Money Flow Index, MFI, On-Balance Volume, OBV, trading volume, market liquidity, volume analysis, flow indicators]
description: "Liquidity and flow metrics for equity index analysis — bid-ask spread, turnover ratio, Money Flow Index, and On-Balance Volume with formulas, thresholds, and interpretation."
parent: "[[domain-market-analysis]]"
links:
  - "[[breadth-and-sentiment-indicators]]"
  - "[[index-maintenance-and-corporate-actions]]"
  - "[[risk-and-volatility-metrics]]"
  - "[[technical-indicators]]"
  - "[[valuation-ratios]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Liquidity and Flow Metrics

Liquidity metrics measure how easily stocks can be traded without significant price impact, while flow metrics track the direction and strength of money entering or leaving the market. These volume-based indicators often provide early signals before price moves are visible.

## Liquidity and Flow Indicators

| Metric | Formula | Use |
|--------|---------|-----|
| **Bid-Ask Spread** | (Ask − Bid) ÷ Mid | Tight = liquid · Wide = illiquid or stressed |
| **Turnover Ratio** | Volume ÷ Shares Outstanding | High = active trading interest |
| **Money Flow Index** | Volume-weighted RSI | > 80 overbought · < 20 oversold |
| **On-Balance Volume** | Cumulative volume on up vs down days | Divergence from price = early signal |

## Bid-Ask Spread

> [!quote]
> "Liquidity is the oxygen of financial markets — you only notice it when it's gone."
>
> — **Howard Marks**, *The Most Important Thing* (2011)


The bid-ask spread is the most direct measure of market liquidity and transaction costs.

$$\text{Spread} = \frac{\text{Ask} - \text{Bid}}{\text{Mid Price}} \times 100$$

| Spread | Liquidity Level |
|--------|-----------------|
| < 0.05% | Extremely liquid (mega-cap, major indices) |
| 0.05–0.2% | Highly liquid (large-cap) |
| 0.2–1.0% | Moderately liquid (mid-cap) |
| > 1.0% | Illiquid (small-cap, stressed markets) |

> [!warning] Spread Widening
> Sudden spread widening in normally liquid stocks signals market stress. During the 2020 COVID crash, even large-cap European index constituents saw spreads widen 5-10x their normal levels.

## Turnover Ratio

Measures trading activity relative to total shares outstanding — how quickly ownership is cycling.

$$\text{Turnover} = \frac{\text{Daily Volume}}{\text{Shares Outstanding}}$$

- **High turnover** (> 1% daily): Strong trading interest, often around earnings or events
- **Low turnover** (< 0.1% daily): Limited interest, potentially illiquid
- **Rising turnover + rising price**: Confirmation of bullish trend
- **Rising turnover + falling price**: Institutional selling, bearish

## Money Flow Index (MFI)

A volume-weighted version of [RSI](https://alp78.github.io/elysium/18-Financial-Domain/Market-Analysis/technical-indicators) that incorporates trading volume to measure buying and selling pressure.

| MFI Level | Interpretation |
|-----------|----------------|
| > 80 | Overbought — potential for reversal |
| 50–80 | Bullish money flow |
| 20–50 | Bearish money flow |
| < 20 | Oversold — potential for bounce |

> [!tip] MFI vs RSI
> MFI is often more reliable than plain RSI for detecting divergences because it weights volume. A stock making new highs on declining volume shows up as an MFI divergence before RSI catches it.

## On-Balance Volume (OBV)

> [!quote]
> "Volume is the fuel that drives the market. When volume expands on a move, it confirms the move."
>
> — **Joseph Granville**, *New Strategy of Daily Stock Market Timing* (1976)


A cumulative indicator that adds volume on up days and subtracts volume on down days.

$$\text{OBV}_t = \text{OBV}_{t-1} + \begin{cases} +V_t & \text{if } P_t > P_{t-1} \\ -V_t & \text{if } P_t < P_{t-1} \\ 0 & \text{if } P_t = P_{t-1} \end{cases}$$

#### Key signals
- **OBV rising while price flat**: Accumulation — smart money buying before price moves
- **OBV falling while price flat**: Distribution — selling before price drops
- **OBV confirms price trend**: Trend is healthy and likely to continue
- **OBV diverges from price**: Warning sign — trend may reverse

## Related

- [breadth-and-sentiment-indicators](https://alp78.github.io/elysium/18-Financial-Domain/Market-Analysis/breadth-and-sentiment-indicators) — Market breadth and put/call sentiment
- [technical-indicators](https://alp78.github.io/elysium/18-Financial-Domain/Market-Analysis/technical-indicators) — RSI, MACD, and trend indicators
- [daily-signal-scores](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/daily-signal-scores) — Volume is incorporated into dashboard momentum metrics
- [chart-metrics](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/chart-metrics) — Dashboard chart visualizations
