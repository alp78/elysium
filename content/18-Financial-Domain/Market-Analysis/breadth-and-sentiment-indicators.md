---
type: reference
category: financial-domain
technology: [yfinance, python]
tags: [python, financial]
aliases: [Breadth and Sentiment Indicators, market breadth, advance decline, put call ratio, short interest, sentiment indicators]
keywords: [breadth indicators, sentiment indicators, advance decline ratio, percent above 200 day MA, new highs new lows, put call ratio, short interest ratio, market breadth, market sentiment, contrarian, bullish, bearish]
description: "Market breadth and sentiment indicators for equity index analysis — advance/decline ratio, percent above 200-day MA, new highs/lows, put/call ratio, and short interest with formulas and interpretation."
related:
  - "[daily-signal-scores](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/daily-signal-scores)"
  - "[technical-indicators](https://alp78.github.io/elysium/18-Financial-Domain/Market-Analysis/technical-indicators)"
  - "[risk-and-volatility-metrics](https://alp78.github.io/elysium/18-Financial-Domain/Market-Analysis/risk-and-volatility-metrics)"
  - "[liquidity-and-flow-metrics](https://alp78.github.io/elysium/18-Financial-Domain/Market-Analysis/liquidity-and-flow-metrics)"
  - "[chart-metrics](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/chart-metrics)"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Breadth and Sentiment Indicators

Market breadth measures how broadly a market move is supported across constituents, while sentiment indicators gauge investor psychology. These metrics help distinguish between healthy broad-based rallies and narrow, fragile ones. They complement the [dashboard's sentiment score](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/daily-signal-scores) which tracks analyst consensus.

## Breadth and Sentiment Metrics

| Metric | Formula | Use |
|--------|---------|-----|
| **Advance/Decline Ratio** | Rising stocks ÷ Falling stocks | > 1 = broad participation in rally |
| **% Above 200-day MA** | Count above SMA(200) ÷ Total | > 70% bullish breadth · < 30% bearish |
| **New Highs − New Lows** | 52-week new highs minus new lows | Positive = healthy market · Divergence from index = warning |
| **Put/Call Ratio** | Put volume ÷ Call volume | > 1.0 = bearish sentiment (contrarian bullish) |
| **Short Interest Ratio** | Short shares ÷ Avg daily volume | > 5 days = high short interest, potential squeeze |

## Advance/Decline Ratio

> [!quote]
> "The generals may win a few battles, but if the troops aren't following, the war is lost."
> — **Martin Zweig**


Measures the breadth of market participation in a given move.

| A/D Ratio | Interpretation |
|-----------|----------------|
| > 2.0 | Strong broad-based rally |
| 1.0 – 2.0 | Healthy market breadth |
| 0.5 – 1.0 | More stocks declining than advancing |
| < 0.5 | Broad-based selling |

> [!warning] Divergence Warning
> When the index makes new highs but the A/D ratio is declining, fewer stocks are driving the rally. This narrowing breadth often precedes market reversals.

## Percent Above 200-Day Moving Average

A gauge of how many constituents are in a long-term uptrend.

| % Above 200d MA | Market Condition |
|------------------|-----------------|
| > 80% | Strongly bullish (potential for overextension) |
| 60–80% | Healthy bull market |
| 40–60% | Mixed / transitional |
| 20–40% | Bearish breadth |
| < 20% | Deeply oversold (contrarian buy signal) |

## New Highs Minus New Lows

The net number of 52-week new highs vs new lows across index constituents.

- **Consistently positive**: Healthy market confirming uptrend
- **Turning negative while index rises**: Bearish divergence — narrow leadership
- **Deeply negative then improving**: Potential bottom formation

## Put/Call Ratio

> [!quote]
> "Be fearful when others are greedy and greedy when others are fearful."
> — **Warren Buffett**


> [!quote]
> "When everybody thinks alike, everyone is likely to be wrong."
> — **Humphrey Neill**


Options market sentiment indicator. High put volume indicates hedging or bearish bets.

| Put/Call Ratio | Interpretation |
|----------------|----------------|
| < 0.7 | Complacent / bullish (contrarian bearish) |
| 0.7 – 1.0 | Normal range |
| > 1.0 | Bearish sentiment (contrarian bullish signal) |
| > 1.5 | Extreme fear (historically marks bottoms) |

## Short Interest Ratio

Measures the number of days it would take to cover all short positions at average daily volume.

| Days to Cover | Interpretation |
|---------------|----------------|
| < 2 days | Normal short interest |
| 2–5 days | Moderate — manageable |
| 5–10 days | Elevated — potential short squeeze risk |
| > 10 days | Heavy short interest — high squeeze probability |

## Dashboard Sentiment Context

The [dashboard sentiment score](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/daily-signal-scores) measures analyst-derived sentiment:
- **Implied Upside**: (Target price / current) − 1
- **Recommendation**: Consensus analyst rating (1 = Strong Buy → 5 = Strong Sell)

The breadth and flow indicators described here provide **market-derived** sentiment (what traders are actually doing), complementing the **analyst-derived** sentiment on the dashboard.

## Related

- [daily-signal-scores](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/daily-signal-scores) — Dashboard sentiment composite score
- [technical-indicators](https://alp78.github.io/elysium/18-Financial-Domain/Market-Analysis/technical-indicators) — RSI, MACD momentum indicators
- [risk-and-volatility-metrics](https://alp78.github.io/elysium/18-Financial-Domain/Market-Analysis/risk-and-volatility-metrics) — VIX as a fear gauge
- [liquidity-and-flow-metrics](https://alp78.github.io/elysium/18-Financial-Domain/Market-Analysis/liquidity-and-flow-metrics) — Volume-based flow indicators
- [chart-metrics](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/chart-metrics) — Drawdown and volatility visualizations
