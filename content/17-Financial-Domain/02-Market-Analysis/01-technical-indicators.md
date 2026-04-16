---
title: "01 - Technical Indicators"
type: reference
category: financial-domain
technology: [yfinance, python]
tags: [python, financial]
aliases: [Technical Indicators, technical analysis, RSI, MACD, Bollinger Bands, ADX, Golden Cross, Death Cross, moving averages]
keywords: [technical indicators, RSI, relative strength index, MACD, moving average convergence divergence, Bollinger Bands, ADX, average directional index, Golden Cross, Death Cross, SMA, EMA, overbought, oversold, momentum, trend, technical analysis]
description: "Standard technical analysis indicators for equity index analysis — RSI, MACD, Bollinger Bands, ADX, and Golden/Death Cross patterns with formulas, thresholds, and trading interpretation."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Technical Indicators

Standard momentum and trend indicators used in equity index analysis. These complement the [dashboard's momentum score](https://alp78.github.io/elysium/17-Financial-Domain/Metrics-and-Scoring/daily-signal-scores) with additional signal dimensions commonly used in market analysis.

## Momentum and Trend Indicators

| Metric | Formula | Use |
|--------|---------|-----|
| **RSI (14-day)** | 100 − 100/(1 + avg gain/avg loss) | > 70 overbought · < 30 oversold |
| **MACD** | EMA(12) − EMA(26), signal = EMA(9) of MACD | Crossover signals trend changes |
| **Bollinger Bands** | SMA(20) ± 2×std(20) | Price outside bands = potential reversal |
| **ADX** | Average Directional Index | > 25 trending · < 20 range-bound |
| **Golden/Death Cross** | SMA(50) crossing SMA(200) | Golden (up) = bullish · Death (down) = bearish |

## RSI (Relative Strength Index)

> [!quote]+
> "The RSI is the single most useful indicator I have ever found for determining when prices are overextended."
>
> — **J. Welles Wilder**, *New Concepts in Technical Trading Systems* (1978)


The RSI measures the speed and magnitude of recent price changes to evaluate overbought or oversold conditions.

$$\text{RSI} = 100 - \frac{100}{1 + \frac{\text{avg gain (14d)}}{\text{avg loss (14d)}}}$$

| RSI Level | Interpretation |
|-----------|----------------|
| > 70 | Overbought — potential pullback |
| 50–70 | Bullish momentum |
| 30–50 | Bearish momentum |
| < 30 | Oversold — potential bounce |

> [!tip] RSI Divergence
> When price makes new highs but RSI fails to confirm (lower highs on RSI), this bearish divergence often precedes reversals. The opposite (price new lows, RSI higher lows) is a bullish divergence.

## MACD (Moving Average Convergence Divergence)

$$\text{MACD Line} = \text{EMA}(12) - \text{EMA}(26)$$
$$\text{Signal Line} = \text{EMA}(9\text{ of MACD Line})$$
$$\text{Histogram} = \text{MACD Line} - \text{Signal Line}$$

#### Signals
- **Bullish crossover**: MACD crosses above signal line
- **Bearish crossover**: MACD crosses below signal line
- **Zero line cross**: MACD crossing zero confirms trend direction

## Bollinger Bands

> [!quote]+
> "Bollinger Bands are not meant to be used in isolation. They are meant to provide a framework within which price action can be assessed."
>
> — **John Bollinger**, *Bollinger on Bollinger Bands* (2001)


$$\text{Upper Band} = \text{SMA}(20) + 2 \times \sigma(20)$$
$$\text{Lower Band} = \text{SMA}(20) - 2 \times \sigma(20)$$

Price touching the upper band signals potential overbought conditions; touching the lower band signals oversold. Band squeeze (narrowing) often precedes significant moves.

## ADX (Average Directional Index)

| ADX Value | Trend Strength |
|-----------|----------------|
| < 20 | No trend (range-bound) |
| 20–25 | Emerging trend |
| 25–50 | Strong trend |
| 50–75 | Very strong trend |
| > 75 | Extremely strong (rarely sustained) |

> [!info] ADX and Direction
> ADX measures trend *strength* only, not direction. Combine with +DI/-DI (directional indicators) to determine if the trend is up or down.

## Golden Cross and Death Cross

> [!quote]+
> "The trend is your friend until the end when it bends."
>
> — **Ed Seykota**


- **Golden Cross**: SMA(50) crosses **above** SMA(200) — bullish long-term signal
- **Death Cross**: SMA(50) crosses **below** SMA(200) — bearish long-term signal

These are lagging indicators — by the time the cross occurs, a significant portion of the move has already happened. Best used for confirming trend changes rather than timing entries.

## Relationship to Dashboard Signals

The [dashboard momentum score](https://alp78.github.io/elysium/17-Financial-Domain/Metrics-and-Scoring/daily-signal-scores) incorporates related but distinct metrics:
- **SMA-50 Ratio** (price / 50-day moving average) — related to Golden/Death Cross concepts
- **SMA-200 Ratio** (price / 200-day moving average) — long-term trend proximity
- **52-Week High Proximity** — similar to RSI in measuring relative position within a range
- **Relative Strength** — 52-week return vs index return, related to RSI concept but cross-sectional

## Related

- [daily-signal-scores](https://alp78.github.io/elysium/17-Financial-Domain/Metrics-and-Scoring/daily-signal-scores) — Dashboard momentum score using z-scored trend indicators
- [chart-metrics](https://alp78.github.io/elysium/17-Financial-Domain/Metrics-and-Scoring/chart-metrics) — Rolling return and volatility chart visualizations
- [risk-and-volatility-metrics](https://alp78.github.io/elysium/17-Financial-Domain/Market-Analysis/risk-and-volatility-metrics) — Beta, VIX, drawdown, and risk-adjusted ratios
- [valuation-ratios](https://alp78.github.io/elysium/17-Financial-Domain/Market-Analysis/valuation-ratios) — Fundamental valuation complement to technical analysis
- [breadth-and-sentiment-indicators](https://alp78.github.io/elysium/17-Financial-Domain/Market-Analysis/breadth-and-sentiment-indicators) — Market breadth and sentiment metrics
