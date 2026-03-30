---
type: reference
category: financial-domain
technology: [yfinance, sql-server]
tags: [sql, financial]
aliases: [Chart Metrics, Dashboard Charts, Time Series Charts]
keywords: [chart metrics, synthetic portfolio return, rolling return, drawdown, peak to trough, volatility, Sharpe ratio, risk-adjusted return, annualized volatility, bear market, correction]
description: "Five synchronized time-series charts in the financial data platform dashboard: portfolio return, rolling 30d return, drawdown from peak, annualized volatility, and rolling Sharpe ratio."
related:
  - "[index-snapshot-metrics](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/index-snapshot-metrics)"
  - "[risk-and-volatility-metrics](https://alp78.github.io/elysium/18-Financial-Domain/Market-Analysis/risk-and-volatility-metrics)"
  - "[scoring-methodology](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/scoring-methodology)"
  - "[data-sources-and-refresh](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/data-sources-and-refresh)"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Chart Metrics

Five time-series charts are stacked vertically with synchronized zoom/pan in the financial data platform dashboard. Together they provide a comprehensive view of index return, momentum, risk, and risk-adjusted performance over time.

## Synthetic Portfolio Return (%)

Equal-weight portfolio holding all index constituents, rebased to 0% at period start.

#### Formula for cumulative portfolio return

$$\text{Return}_t = \left(\frac{\text{CumulativeFactor}_t}{\text{CumulativeFactor}_{\text{start}}} - 1\right) \times 100$$

**Interpretation**: Positive slope = index gaining value. A flattening curve signals exhaustion.

## Rolling 30d Return (%)

Trailing 30-day cumulative return, plotted daily. Uses a baseline series (green above zero, red below).

**Interpretation**: Positive = recent momentum is bullish. Sustained values > +5% indicate a strong trend. Zero crossings mark regime changes.

## Drawdown from Peak (%)

Distance from the running all-time high of the cumulative factor. This metric is always less than or equal to zero.

#### Formula for drawdown

$$\text{Drawdown}_t = \left(\frac{\text{CumulativeFactor}_t}{\max_{s \le t}(\text{CumulativeFactor}_s)} - 1\right) \times 100$$

**Interpretation**: Depth shows tail risk. Recovery time (from trough back to 0%) measures market resilience.

#### Drawdown severity classification

| Drawdown | Severity |
|----------|----------|
| 0% to −5% | Normal fluctuation |
| −5% to −10% | Correction |
| −10% to −20% | Bear territory |
| > −20% | Severe bear market |

## Annualized Volatility (%)

Rolling 30-day standard deviation of daily returns, annualized by multiplying by the square root of 252 trading days.

#### Formula for annualized 30-day volatility

$$\sigma_{30d} = \text{std}(r_{t-29}, \ldots, r_t) \times \sqrt{252} \times 100$$

A horizontal dashed line marks the historical average for the selected index.

#### Volatility regime classification

| Volatility | Regime |
|------------|--------|
| < 15% | Low / calm |
| 15–25% | Elevated |
| > 25% | High risk |
| > 40% | Crisis-level (e.g. 2020 COVID, 2022 rate shock) |

## Rolling 30d Sharpe Ratio

Risk-adjusted return: rolling return divided by rolling volatility. This measures how much return the index generates per unit of risk.

#### Formula for rolling 30-day Sharpe ratio

$$\text{Sharpe}_{30d} = \frac{\text{Rolling30dReturn}}{\text{Rolling30dVolatility}}$$

#### Sharpe ratio interpretation

| Sharpe | Interpretation |
|--------|----------------|
| > 2.0 | Exceptional (rarely sustained) |
| 1.0–2.0 | Strong risk-adjusted returns |
| 0–1.0 | Modest positive returns relative to risk |
| < 0 | Losing money |

> [!info] Cross-Reference
> For additional risk metrics beyond what the dashboard charts display, see [risk-and-volatility-metrics](https://alp78.github.io/elysium/18-Financial-Domain/Market-Analysis/risk-and-volatility-metrics) (Sortino ratio, Calmar ratio, VaR).

## Related

- [index-snapshot-metrics](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/index-snapshot-metrics) for the snapshot panel that accompanies these charts
- [risk-and-volatility-metrics](https://alp78.github.io/elysium/18-Financial-Domain/Market-Analysis/risk-and-volatility-metrics) for extended risk measures
- [scoring-methodology](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/scoring-methodology) for the mathematical foundations
- [data-sources-and-refresh](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/data-sources-and-refresh) for price data sourcing
