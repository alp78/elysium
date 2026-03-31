---
type: reference
category: financial-domain
technology: [yfinance, sql-server]
tags: [sql, financial]
aliases: [Valuation Ratios, valuation metrics, PEG ratio, CAPE, Shiller PE, EV/Sales, FCF Yield, earnings yield, price-to-earnings, P/E ratio]
keywords: [valuation ratios, PEG ratio, CAPE, Shiller P/E, EV/Sales, free cash flow yield, FCF yield, earnings yield, price-to-earnings, P/E, price-to-book, EV/EBITDA, forward PE, trailing PE, dividend yield, valuation multiples, undervalued, overvalued]
description: "Standard equity valuation ratios beyond P/E and P/B — PEG ratio, CAPE/Shiller P/E, EV/Sales, free cash flow yield, and earnings yield with formulas, thresholds, and interpretation guidance."
related:
  - "[index-snapshot-metrics](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/index-snapshot-metrics)"
  - "[daily-signal-scores](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/daily-signal-scores)"
  - "[quarterly-signal-scores](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/quarterly-signal-scores)"
  - "[technical-indicators](https://alp78.github.io/elysium/18-Financial-Domain/Market-Analysis/technical-indicators)"
  - "[risk-and-volatility-metrics](https://alp78.github.io/elysium/18-Financial-Domain/Market-Analysis/risk-and-volatility-metrics)"
  - "[scoring-methodology](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/scoring-methodology)"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Valuation Ratios

Standard equity valuation ratios used in index analysis and stock screening, beyond the basic P/E and P/B ratios tracked in [index-snapshot-metrics](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/index-snapshot-metrics). These metrics help determine whether individual stocks or entire indices are trading at fair value relative to earnings, growth, sales, and cash generation.

## Core Valuation Ratios

| Metric | Formula | Use |
|--------|---------|-----|
| **PEG Ratio** | P/E ÷ EPS Growth Rate | Adjusts P/E for growth; < 1 = undervalued relative to growth |
| **CAPE / Shiller P/E** | Price ÷ 10-year inflation-adjusted avg EPS | Long-term valuation; > 25 historically expensive |
| **EV/Sales** | Enterprise Value ÷ Revenue | Useful for unprofitable growth companies; < 1 = cheap |
| **Free Cash Flow Yield** | FCF ÷ Market Cap | Cash return to investors; > 5% is attractive |
| **Earnings Yield** | EPS ÷ Price (inverse of P/E) | Compare directly to bond yields; > 10yr Treasury = equities attractive |

## PEG Ratio

> [!quote]
> "The P/E ratio of any company that's fairly priced will equal its growth rate."
>
> — **Peter Lynch**, *One Up on Wall Street* (1989)


The PEG ratio adjusts the price-to-earnings ratio by the company's earnings growth rate, providing a growth-adjusted valuation measure.

$$\text{PEG} = \frac{P/E}{\text{EPS Growth Rate (\%)}}$$

| PEG | Interpretation |
|-----|----------------|
| < 1.0 | Potentially undervalued relative to growth |
| 1.0 | Fairly valued (P/E matches growth rate) |
| > 1.0 | Premium to growth rate |
| > 2.0 | Expensive even accounting for growth |

> [!warning] PEG Limitations
> PEG ratios are unreliable when EPS growth is negative (negative denominator), near zero (inflates PEG), or cyclical (one-year growth misleads). Use with forward consensus estimates for best results.

## CAPE / Shiller P/E

> [!quote]
> "The price-earnings ratio, averaged over ten years, is a strong predictor of the real rate of return on stocks over the subsequent ten years."
>
> — **Robert Shiller**, *Irrational Exuberance* (2000)


The Cyclically Adjusted Price-to-Earnings ratio smooths earnings over a 10-year period, adjusting for inflation. Created by Robert Shiller, this metric reduces the impact of business cycle fluctuations.

$$\text{CAPE} = \frac{\text{Current Price}}{\text{10-year average real EPS}}$$

| CAPE Level | Historical Context |
|------------|-------------------|
| < 15 | Historically cheap (strong future returns likely) |
| 15–20 | Fair value range |
| 20–25 | Above average (moderate future returns) |
| > 25 | Historically expensive (lower future returns) |
| > 30 | Bubble territory (1929, 2000, 2021) |

## EV/Sales (Enterprise Value to Sales)

Particularly useful for high-growth companies that may not yet be profitable, where P/E is meaningless.

$$\text{EV/Sales} = \frac{\text{Market Cap} + \text{Debt} - \text{Cash}}{\text{Annual Revenue}}$$

| EV/Sales | Interpretation |
|----------|----------------|
| < 1 | Trading below revenue — potentially deep value |
| 1–3 | Reasonable for mature companies |
| 3–10 | Growth premium, justified if margins expand |
| > 10 | Requires extraordinary growth to justify |

## Free Cash Flow Yield

> [!quote]
> "In the long run, earnings and cash flow are all that matter. The rest is noise."
>
> — **Bill Miller**


Measures the cash return a company generates relative to its market capitalization. More reliable than earnings yield because [free cash flow](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/quarterly-signal-scores) is harder to manipulate than accounting earnings.

$$\text{FCF Yield} = \frac{\text{Free Cash Flow}}{\text{Market Cap}} \times 100$$

| FCF Yield | Interpretation |
|-----------|----------------|
| > 8% | Strong cash generation, potentially undervalued |
| 5–8% | Attractive |
| 2–5% | Average |
| < 2% | Growth company or low cash generation |
| Negative | Burning cash — check [health warnings](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/quarterly-signal-scores) |

## Earnings Yield

> [!quote]
> "Price is what you pay. Value is what you get."
>
> — **Benjamin Graham**, *The Intelligent Investor* (1949)


The inverse of P/E, earnings yield enables direct comparison with bond yields — the "Fed Model" framework.

$$\text{Earnings Yield} = \frac{\text{EPS}}{\text{Price}} = \frac{1}{\text{P/E}}$$

> [!tip] Bond Comparison
> When earnings yield exceeds the 10-year Treasury yield, equities are relatively attractive versus bonds. This spread widening often signals value opportunities.

## Dashboard Valuation Metrics

The [dashboard](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/index-snapshot-metrics) tracks these cap-weighted index-level valuation metrics daily:

| Metric | Source | Thresholds |
|--------|--------|------------|
| **P/E** | yfinance `forwardPE` | < 15 cheap · > 25 expensive |
| **P/B** | yfinance `priceToBook` | < 1.5 value · > 3 growth premium |
| **Dividend Yield** | yfinance `dividendYield` | > 3% attractive for income |

The [Relative Value Score](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/daily-signal-scores) uses inverted z-scores of Forward P/E, Price/Book, EV/EBITDA, and Dividend Yield to rank constituents by relative cheapness within their index.

## Related

- [index-snapshot-metrics](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/index-snapshot-metrics) — Dashboard-level P/E, P/B, dividend yield
- [daily-signal-scores](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/daily-signal-scores) — Relative value composite score using valuation z-scores
- [quarterly-signal-scores](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/quarterly-signal-scores) — Quality/moat score using fundamental ratios
- [technical-indicators](https://alp78.github.io/elysium/18-Financial-Domain/Market-Analysis/technical-indicators) — Price-based momentum and trend indicators
- [scoring-methodology](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/scoring-methodology) — Z-score calculation methodology
