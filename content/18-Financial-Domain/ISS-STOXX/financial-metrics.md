---
title: "ISS & STOXX Glossary — Financial Metrics"
description: "Comprehensive glossary of return calculations, risk metrics, volatility measures, and performance analytics from STOXX and ISS Governance."
tags:
  - stoxx
  - iss
  - financial-domain
  - glossary
  - financial-metrics
aliases:
  - "Financial Metrics Glossary"
date: 2026-03-28
---

# Financial Metrics — ISS & STOXX Glossary

> [!abstract] About This Section
> This glossary covers return calculations, volatility measures, risk-adjusted
> performance metrics, and factor exposures used in index analytics. Terms are
> sourced from [STOXX](https://stoxx.com/) and [ISS Governance](https://www.issgovernance.com/)
> official documentation.
>
> **~59 terms** across multiple sources.

---

## A

### Active Return

> The difference between a portfolio's return and its benchmark return over a given period, representing the value added (or lost) by active management decisions.

In plain terms, active return tells you how much better or worse a fund did compared to the index it tracks. If a portfolio gained 12% and the benchmark gained 10%, the active return is +2%.

$$
R_{\text{active}} = R_{\text{portfolio}} - R_{\text{benchmark}}
$$

> [!tip] Related terms
> [[#Alpha]], [[#Tracking Error]], [[#Information Ratio]]

**Sources:**
- [STOXX Index Methodology Guide](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [STOXX Analytics & Statistics](https://www.stoxx.com/analytics-and-statistics)

---

### Alpha

> The excess return of a portfolio relative to the return predicted by the Capital Asset Pricing Model (CAPM), given the portfolio's systematic risk exposure (beta). Alpha isolates manager skill from market movement.

Alpha is the portion of a portfolio's return that cannot be explained by broad market moves. Positive alpha means the manager outperformed what the market risk alone would have predicted.

$$
\alpha = R_{\text{portfolio}} - \bigl[R_f + \beta \cdot (R_m - R_f)\bigr]
$$

Where $R_f$ is the risk-free rate and $R_m$ is the market return.

> [!tip] Related terms
> [[#Beta]], [[#Active Return]], [[#Risk-Adjusted Return]], [[#Equity Risk Premium]]

**Sources:**
- [STOXX Factor Indices Methodology](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [ISS EVA Methodology](https://www.issgovernance.com/solutions/iss-analytics/)

---

### Annualized Return

> The geometric average amount of money earned by an investment each year over a specified time period, compounding gains and losses into a single annual rate.

Annualized return converts a total multi-period return into a yearly figure so you can compare investments held over different time spans on equal footing.

$$
R_{\text{ann}} = \left(1 + R_{\text{total}}\right)^{\frac{1}{n}} - 1
$$

Where $n$ is the number of years in the holding period.

> [!tip] Related terms
> [[#Total Return]], [[#Gross Return]], [[#Net Return]]

**Sources:**
- [STOXX Calculation Guide](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_calculation_guide.pdf)

---

## B

### Basis Point

> One hundredth of one percentage point (0.01%), used to express small changes in interest rates, yields, spreads, and fund fees. 100 basis points equal 1 percentage point.

Basis points remove ambiguity when discussing rate changes. Saying "rates rose 50 basis points" is unambiguous, whereas "rates rose half a percent" could be confused with a relative change. Nearly every STOXX and ISS yield, spread, and fee figure is quoted in basis points.

$$
1\;\text{bp} = 0.01\% = 0.0001
$$

So a move from 2.50% to 3.00% is a change of 50 bp.

> [!tip] Related terms
> [[#Spread (Credit)]], [[#Yield Curve]], [[#Risk-Free Rate]]

**Sources:**
- [STOXX Calculation Guide](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_calculation_guide.pdf)

---

### Beta

> A measure of a security's or portfolio's systematic risk relative to the overall market. A beta of 1.0 indicates the asset moves in lockstep with the market; values above or below 1.0 indicate amplified or dampened sensitivity.

Beta tells you how much a stock tends to move when the market moves. A stock with a beta of 1.5 historically rises or falls 50% more than the market in either direction.

$$
\beta = \frac{\text{Cov}(R_i,\, R_m)}{\text{Var}(R_m)}
$$

> [!tip] Related terms
> [[#Alpha]], [[#Equity Risk Premium]], [[#Factor Exposure]]

**Sources:**
- [STOXX Risk and Factor Indices](https://www.stoxx.com/index-details?symbol=SXXFMVP)
- [ISS Governance Analytics](https://www.issgovernance.com/solutions/iss-analytics/)

---

### Book-to-Price Ratio

> The ratio of a company's book value of equity to its market capitalisation. It is the inverse of the more commonly cited price-to-book ratio and is widely used as a value factor in index construction.

Book-to-price tells you how much of a company's accounting net worth you get for each dollar of market price. Higher values suggest the stock may be undervalued relative to its assets.

$$
\text{B/P} = \frac{\text{Book Value of Equity}}{\text{Market Capitalisation}}
$$

> [!tip] Related terms
> [[#Price-to-Earnings Ratio]], [[#Earnings Yield]], [[#Cash Flow Yield]]

**Sources:**
- [STOXX Factor Index Methodology](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [STOXX Style Indices](https://www.stoxx.com/indices/index-details?symbol=SX5GRT)

---

## C

### Calmar Ratio

> The ratio of a portfolio's annualized return to its maximum drawdown over a specified period (typically three years). It measures the return earned per unit of worst-case downside risk.

The Calmar ratio rewards strategies that deliver strong returns without stomach-churning drops. A ratio above 3.0 is generally considered excellent. It is particularly popular in evaluating hedge fund and managed futures performance.

$$
\text{Calmar Ratio} = \frac{R_{\text{ann}}}{\left|\text{Maximum Drawdown}\right|}
$$

> [!tip] Related terms
> [[#Maximum Drawdown]], [[#Sharpe Ratio]], [[#Sortino Ratio]], [[#Drawdown]]

**Sources:**
- [STOXX Risk Analytics](https://www.stoxx.com/analytics-and-statistics)

---

### Cash Flow Yield

> The ratio of operating cash flow per share to the current share price. It measures how much cash a business generates relative to its market valuation and is used as a value factor in index screening.

Cash flow yield is like dividend yield's more comprehensive cousin: it looks at all the cash the business produces, not just what it pays out. Higher values can signal undervaluation.

$$
\text{Cash Flow Yield} = \frac{\text{Operating Cash Flow per Share}}{\text{Price per Share}}
$$

> [!tip] Related terms
> [[#Earnings Yield]], [[#Dividend Yield]], [[#Book-to-Price Ratio]]

**Sources:**
- [STOXX Factor Indices](https://www.stoxx.com/index-details?symbol=SXXFVAL)
- [ISS EVA Framework](https://www.issgovernance.com/solutions/eva/)

---

### Compound Annual Growth Rate (CAGR)

> The constant annual rate of return that would take an investment from its beginning value to its ending value over a specified period, assuming profits are reinvested. It smooths out year-to-year volatility into a single annualized figure.

CAGR is the go-to metric for comparing growth rates across different time horizons. Unlike simple average returns, it accounts for compounding and gives the true geometric growth rate.

$$
\text{CAGR} = \left(\frac{V_{\text{end}}}{V_{\text{begin}}}\right)^{\frac{1}{n}} - 1
$$

Where $V_{\text{begin}}$ and $V_{\text{end}}$ are the starting and ending values, and $n$ is the number of years.

> [!tip] Related terms
> [[#Annualized Return]], [[#Total Return]]

**Sources:**
- [STOXX Calculation Guide](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_calculation_guide.pdf)
- [STOXX Index Research](https://www.stoxx.com/pulse)

---

### Correlation

> A statistical measure that quantifies the strength and direction of the linear relationship between two variables' returns, ranging from -1 (perfect negative) to +1 (perfect positive). A value of 0 indicates no linear relationship.

Correlation tells you whether two assets tend to move together, apart, or independently. It is a cornerstone of portfolio construction: combining assets with low or negative correlation reduces overall portfolio risk.

$$
\rho_{X,Y} = \frac{\text{Cov}(X, Y)}{\sigma_X \cdot \sigma_Y}
$$

> [!tip] Related terms
> [[#Covariance]], [[#Beta]], [[#Volatility]], [[#Standard Deviation]]

**Sources:**
- [STOXX Risk Analytics](https://www.stoxx.com/analytics-and-statistics)
- [STOXX Factor Indices](https://www.stoxx.com/factor-indices)

---

### Covariance

> A measure of the joint variability of two random variables. In finance, it quantifies how the returns of two assets move together. Positive covariance means they tend to move in the same direction; negative means opposite directions.

Covariance is the raw building block behind both correlation and beta. While its absolute magnitude is hard to interpret (it depends on the scale of returns), it feeds directly into portfolio variance calculations and the Capital Asset Pricing Model.

$$
\text{Cov}(X, Y) = \frac{1}{n-1}\sum_{t=1}^{n}(X_t - \bar{X})(Y_t - \bar{Y})
$$

> [!tip] Related terms
> [[#Correlation]], [[#Beta]], [[#Standard Deviation]], [[#Factor Exposure]]

**Sources:**
- [STOXX Risk Analytics](https://www.stoxx.com/analytics-and-statistics)

---

### Current Ratio

> The ratio of a company's current assets to its current liabilities, measuring its ability to pay short-term obligations due within one year. It is a fundamental liquidity metric used in credit screening and quality factor construction.

The current ratio answers: "Can this company cover its near-term bills with the assets it could readily convert to cash?" A ratio above 1.0 means current assets exceed current liabilities; below 1.0 signals potential liquidity stress.

$$
\text{Current Ratio} = \frac{\text{Current Assets}}{\text{Current Liabilities}}
$$

> [!tip] Related terms
> [[#Debt-to-Equity Ratio]], [[#Free Cash Flow (FCF)]], [[#Gross Profitability]]

**Sources:**
- [ISS Governance Quality Metrics](https://www.issgovernance.com/solutions/iss-analytics/)
- [STOXX Quality Factor Indices](https://www.stoxx.com/index-details?symbol=SXXFQUA)

---

## D

### Debt-to-Equity Ratio

> The ratio of a company's total debt to its total shareholders' equity. It measures financial leverage, indicating how much of the company's capital structure is financed by creditors versus owners.

Debt-to-equity is one of the most watched leverage gauges. A high ratio means the company relies heavily on borrowed money, which amplifies both gains and losses. STOXX and ISS use it in quality screening and ESG risk assessment.

$$
\text{D/E} = \frac{\text{Total Debt}}{\text{Total Shareholders' Equity}}
$$

> [!tip] Related terms
> [[#Current Ratio]], [[#Enterprise Value (EV)]], [[#EBITDA]]

**Sources:**
- [ISS Governance Quality Metrics](https://www.issgovernance.com/solutions/iss-analytics/)
- [STOXX Quality Factor Indices](https://www.stoxx.com/index-details?symbol=SXXFQUA)

---

### Dividend Yield

> The annual dividends paid per share divided by the share price, expressed as a percentage. In index methodology, it typically refers to the indicated (forward-looking) annual dividend.

Dividend yield shows the percentage income return you earn from owning a stock at today's price, ignoring any capital gains. It is a core input for STOXX's dividend-weighted and high-dividend indices.

$$
\text{Dividend Yield} = \frac{\text{Annual Dividends per Share}}{\text{Price per Share}} \times 100\%
$$

> [!tip] Related terms
> [[#Total Return]], [[#Net Return]], [[#Gross Return]], [[#Earnings Yield]]

**Sources:**
- [STOXX Select Dividend Indices](https://www.stoxx.com/index-details?symbol=SD3P)
- [STOXX Calculation Guide](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_calculation_guide.pdf)

---

### Duration (Bond)

> A measure of the sensitivity of a bond's price to changes in interest rates, expressed in years. Modified duration estimates the percentage price change for a 1% change in yield; Macaulay duration is the weighted average time to receive the bond's cash flows.

Duration is the bond investor's most important risk number. A duration of 5 years means that if interest rates rise by 1%, the bond's price falls by approximately 5%. Longer-duration bonds are more sensitive to rate changes.

$$
D_{\text{Macaulay}} = \frac{\sum_{t=1}^{T} t \cdot \frac{C_t}{(1+y)^t}}{\sum_{t=1}^{T} \frac{C_t}{(1+y)^t}}
\qquad
D_{\text{Modified}} = \frac{D_{\text{Macaulay}}}{1 + y}
$$

Where $C_t$ is the cash flow at time $t$ and $y$ is the yield to maturity.

> [!tip] Related terms
> [[#Yield Curve]], [[#Spread (Credit)]], [[#Risk-Free Rate]], [[#Basis Point]]

**Sources:**
- [STOXX Fixed Income Index Methodology](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [ISS Analytics](https://www.issgovernance.com/solutions/iss-analytics/)

---

### Drawdown

> The peak-to-trough decline of an investment or index, measured from the highest value to the subsequent lowest value before a new peak is established. Drawdown is expressed as a percentage loss.

Drawdown captures how far an investment fell from its best point before recovering. It answers the question: "If I bought at the worst time, how bad would the ride down have been?"

$$
D(t) = \frac{V(t) - V_{\text{peak}}}{V_{\text{peak}}}
$$

Where $V(t)$ is the value at time $t$ and $V_{\text{peak}}$ is the highest value prior to $t$.

> [!tip] Related terms
> [[#Maximum Drawdown]], [[#Volatility]], [[#Value at Risk (VaR)]]

**Sources:**
- [STOXX Risk Reporting](https://www.stoxx.com/analytics-and-statistics)

---

## E

### Earnings Per Share (EPS)

> The portion of a company's net income allocated to each outstanding share of common stock. It is the most widely used single measure of corporate profitability and serves as the denominator of the P/E ratio.

EPS is the bottom-line number that drives most valuation conversations. When analysts say a company "beat earnings," they typically mean actual EPS exceeded the consensus forecast. STOXX uses EPS in value/growth style classification.

$$
\text{EPS} = \frac{\text{Net Income} - \text{Preferred Dividends}}{\text{Weighted Average Shares Outstanding}}
$$

> [!tip] Related terms
> [[#Net Income]], [[#Price-to-Earnings Ratio]], [[#Earnings Yield]], [[#PEG Ratio]]

**Sources:**
- [STOXX Style Indices](https://www.stoxx.com/index-details?symbol=SX5GRT)
- [ISS EVA Framework](https://www.issgovernance.com/solutions/eva/)

---

### Earnings Yield

> The ratio of earnings per share to the current share price, equivalent to the inverse of the price-to-earnings ratio. Used as a value factor in STOXX and ISS index construction.

Earnings yield expresses how much profit a company generates for every dollar of its stock price. It flips the familiar P/E ratio to make comparisons with bond yields more intuitive.

$$
\text{Earnings Yield} = \frac{\text{EPS}}{\text{Price per Share}} = \frac{1}{\text{P/E}}
$$

> [!tip] Related terms
> [[#Price-to-Earnings Ratio]], [[#Cash Flow Yield]], [[#Book-to-Price Ratio]]

**Sources:**
- [STOXX Value Factor Indices](https://www.stoxx.com/index-details?symbol=SXXFVAL)

---

### EBITDA

> Earnings Before Interest, Taxes, Depreciation, and Amortization. A proxy for a company's operating cash flow that strips out financing decisions, tax jurisdiction effects, and non-cash accounting charges, enabling comparisons across firms with different capital structures.

EBITDA is the analyst's favourite shortcut for "how much cash does the core business throw off?" It is the denominator of the widely used EV/EBITDA valuation multiple and a key input to credit analysis.

$$
\text{EBITDA} = \text{Net Income} + \text{Interest} + \text{Taxes} + \text{Depreciation} + \text{Amortization}
$$

Or equivalently:

$$
\text{EBITDA} = \text{Operating Income} + \text{Depreciation} + \text{Amortization}
$$

> [!tip] Related terms
> [[#Enterprise Value (EV)]], [[#Net Income]], [[#Operating Margin]], [[#Free Cash Flow (FCF)]]

**Sources:**
- [ISS EVA Framework](https://www.issgovernance.com/solutions/eva/)
- [STOXX Analytics](https://www.stoxx.com/analytics-and-statistics)

---

### Economic Value Added (EVA)

> A proprietary measure of a company's financial performance defined as after-tax operating profit minus a charge for the capital employed to generate that profit. EVA quantifies whether a firm is creating or destroying shareholder value.

EVA asks a simple question: did the company earn more than the cost of the money it used? If EVA is positive, the business is generating wealth beyond what investors could have earned elsewhere at the same risk.

$$
\text{EVA} = \text{NOPAT} - (\text{WACC} \times \text{Invested Capital})
$$

> [!tip] Related terms
> [[#EVA Margin]], [[#Net Operating Profit After Tax (NOPAT)]], [[#Gross Profitability]]

**Sources:**
- [ISS EVA Methodology](https://www.issgovernance.com/solutions/eva/)
- [ISS EVA Quality Score](https://www.issgovernance.com/esg/sub-scores/eva-quality-score/)

---

### EVA Margin

> The ratio of Economic Value Added to revenue, indicating how much economic profit a company earns per unit of sales. It adjusts for both operating efficiency and capital efficiency.

EVA Margin tells you what fraction of each sales dollar turns into true economic profit after accounting for the full cost of capital. It rewards companies that are both operationally lean and capital-light.

$$
\text{EVA Margin} = \frac{\text{EVA}}{\text{Revenue}} \times 100\%
$$

> [!tip] Related terms
> [[#Economic Value Added (EVA)]], [[#Net Operating Profit After Tax (NOPAT)]], [[#Gross Profitability]]

**Sources:**
- [ISS EVA Framework](https://www.issgovernance.com/solutions/eva/)

---

### Equity Risk Premium

> The expected return of the broad equity market in excess of the risk-free rate. It represents the additional compensation investors demand for bearing systematic market risk.

The equity risk premium is the extra reward you expect for putting money in stocks instead of risk-free government bonds. It is a key input to CAPM and drives the calculation of alpha and beta.

$$
\text{ERP} = E(R_m) - R_f
$$

> [!tip] Related terms
> [[#Alpha]], [[#Beta]], [[#Risk-Adjusted Return]], [[#Sharpe Ratio]]

**Sources:**
- [STOXX Index Research](https://www.stoxx.com/pulse)
- [ISS Analytics](https://www.issgovernance.com/solutions/iss-analytics/)

---

### Enterprise Value (EV)

> The total value of a company as seen by all capital providers -- equity holders, debt holders, and minority interests -- minus cash and equivalents. It represents the theoretical takeover price and is the numerator in capital-structure-neutral valuation multiples like EV/EBITDA.

Enterprise value gives you the full price tag of a business, not just the equity slice. It is preferred over market capitalisation when comparing companies with different debt levels because it puts them on an equal footing.

$$
\text{EV} = \text{Market Cap} + \text{Total Debt} + \text{Minority Interest} + \text{Preferred Equity} - \text{Cash \& Equivalents}
$$

> [!tip] Related terms
> [[#EBITDA]], [[#Debt-to-Equity Ratio]], [[#Earnings Yield]], [[#Price-to-Earnings Ratio]]

**Sources:**
- [ISS EVA Framework](https://www.issgovernance.com/solutions/eva/)
- [STOXX Analytics](https://www.stoxx.com/analytics-and-statistics)

---

## F

### Factor Exposure

> The sensitivity of a portfolio or index to a specific systematic return driver (factor) such as value, momentum, size, or volatility. Measured as the loading coefficient in a factor regression model.

Factor exposure quantifies how much a portfolio tilts towards a particular characteristic. A high momentum exposure, for example, means the portfolio is heavily loaded with stocks that have been rising.

$$
R_i = \alpha_i + \sum_{k=1}^{K} \beta_{ik} \cdot F_k + \epsilon_i
$$

Where $\beta_{ik}$ is the exposure of asset $i$ to factor $k$, and $F_k$ is the factor return.

> [!tip] Related terms
> [[#Factor Return]], [[#Beta]], [[#Return Attribution]]

**Sources:**
- [STOXX Factor Index Framework](https://www.stoxx.com/factor-indices)
- [STOXX Factor Index Methodology](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

### Factor Return

> The return attributable to a specific systematic factor over a given period. It represents the payoff to a long-short portfolio that is long stocks with high exposure to the factor and short stocks with low exposure.

Factor return measures how much a particular investment style (e.g., value, momentum) paid off during a period. When the value factor return is positive, cheap stocks outperformed expensive ones.

$$
F_k = R_{\text{high exposure}} - R_{\text{low exposure}}
$$

> [!tip] Related terms
> [[#Factor Exposure]], [[#Return Attribution]], [[#Active Return]]

**Sources:**
- [STOXX Factor Indices](https://www.stoxx.com/factor-indices)

---

### Free Cash Flow (FCF)

> The cash generated by a company's operations after deducting capital expenditures necessary to maintain or expand its asset base. FCF represents the cash available to pay dividends, reduce debt, buy back shares, or fund acquisitions.

Free cash flow is the ultimate reality check: no matter what the income statement says, FCF shows how much actual cash the business produced. Companies can manipulate earnings, but cash is cash.

$$
\text{FCF} = \text{Operating Cash Flow} - \text{Capital Expenditures}
$$

> [!tip] Related terms
> [[#Cash Flow Yield]], [[#EBITDA]], [[#Net Income]], [[#Revenue]]

**Sources:**
- [ISS EVA Framework](https://www.issgovernance.com/solutions/eva/)
- [STOXX Quality Factor Indices](https://www.stoxx.com/index-details?symbol=SXXFQUA)

---

## G

### Gross Margin

> The percentage of revenue remaining after subtracting the cost of goods sold (COGS). It measures how efficiently a company converts raw materials and direct labour into revenue before operating expenses.

Gross margin reveals the basic economics of a company's product or service. A high gross margin means the company has pricing power or a low-cost production advantage, leaving more room for operating expenses and profit.

$$
\text{Gross Margin} = \frac{\text{Revenue} - \text{COGS}}{\text{Revenue}} \times 100\%
$$

> [!tip] Related terms
> [[#Gross Profitability]], [[#Operating Margin]], [[#Revenue]], [[#EBITDA]]

**Sources:**
- [ISS EVA Framework](https://www.issgovernance.com/solutions/eva/)
- [STOXX Quality Factor Indices](https://www.stoxx.com/index-details?symbol=SXXFQUA)

---

### Gross Profitability

> The ratio of gross profit (revenue minus cost of goods sold) to total assets. Introduced by Novy-Marx (2013) as a quality factor, it measures how efficiently a firm converts its asset base into profit before overhead costs.

Gross profitability strips away everything except the most fundamental question: how much raw profit does the company squeeze out of every dollar of assets? It tends to identify high-quality firms.

$$
\text{Gross Profitability} = \frac{\text{Revenue} - \text{COGS}}{\text{Total Assets}}
$$

> [!tip] Related terms
> [[#Economic Value Added (EVA)]], [[#EVA Margin]], [[#Earnings Yield]]

**Sources:**
- [STOXX Quality Factor Indices](https://www.stoxx.com/index-details?symbol=SXXFQUA)
- [ISS Governance Quality Metrics](https://www.issgovernance.com/solutions/iss-analytics/)

---

### Gross Return

> The total return of an index calculated assuming dividends are reinvested at the gross amount, before any withholding tax is deducted. This represents the theoretical maximum return for a tax-exempt investor.

Gross return shows what you would earn if every dividend were reinvested in full with zero tax. It is the upper bound of performance and is used as the standard total return variant for many STOXX indices.

$$
\text{Gross Return Index}_t = \text{Gross Return Index}_{t-1} \times \frac{\sum_i w_i \cdot p_{i,t} + \sum_i w_i \cdot d_{i,t}}{\sum_i w_i \cdot p_{i,t-1}}
$$

> [!tip] Related terms
> [[#Net Return]], [[#Total Return]], [[#Dividend Yield]]

**Sources:**
- [STOXX Calculation Guide](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_calculation_guide.pdf)

---

## I

### Information Ratio

> The ratio of a portfolio's active return to its tracking error. It measures the consistency with which a manager outperforms the benchmark per unit of active risk taken.

The information ratio is the active manager's report card: it tells you how much excess return they delivered for every unit of uncertainty they introduced by deviating from the benchmark. Higher is better.

$$
\text{IR} = \frac{R_{\text{portfolio}} - R_{\text{benchmark}}}{\sigma_{\text{active}}}
$$

Where $\sigma_{\text{active}}$ is the tracking error (standard deviation of active returns).

> [!tip] Related terms
> [[#Active Return]], [[#Tracking Error]], [[#Sharpe Ratio]], [[#Sortino Ratio]]

**Sources:**
- [STOXX Index Analytics](https://www.stoxx.com/analytics-and-statistics)

---

### iNAV (Intraday Net Asset Value)

> The estimated per-share value of an exchange-traded fund (ETF) or index fund calculated and disseminated continuously throughout the trading day, based on the real-time prices of the fund's underlying holdings.

iNAV gives traders a live fair-value estimate of an ETF so they can judge whether the market price represents a premium or discount. STOXX calculates iNAV for numerous ETFs tracking its indices.

$$
\text{iNAV}_t = \frac{\sum_{i=1}^{N} \bigl(n_i \times p_{i,t}\bigr) + \text{Cash}_{t}}{{\text{Shares Outstanding}}}
$$

Where $n_i$ is the number of shares of constituent $i$ and $p_{i,t}$ is its price at time $t$.

> [!tip] Related terms
> [[#Total Return]], [[#Gross Return]], [[#Net Return]]

**Sources:**
- [STOXX iNAV Service](https://www.stoxx.com/inav)
- [STOXX Customized Solutions](https://www.stoxx.com/customized-solutions)

---

## M

### Maximum Drawdown

> The largest peak-to-trough decline observed over a specified time period. It quantifies the worst-case loss scenario an investor would have experienced.

Maximum drawdown is the single scariest number in a fund's history: the worst cumulative loss from a peak before a recovery. It matters because investors feel losses more acutely than equivalent gains.

$$
\text{MDD} = \max_{t \in [0,T]} \left[\frac{V_{\text{peak}}(t) - V_{\text{trough}}(t)}{V_{\text{peak}}(t)}\right]
$$

> [!tip] Related terms
> [[#Drawdown]], [[#Value at Risk (VaR)]], [[#Volatility]], [[#Sortino Ratio]]

**Sources:**
- [STOXX Risk Analytics](https://www.stoxx.com/analytics-and-statistics)

---

### Market Premium

> The realized or expected excess return of the broad equity market over the risk-free rate for a given period. It is synonymous with the equity risk premium when expressed as an expectation, and with the market excess return when measured historically.

Market premium is the compensation investors actually received (or expect to receive) for choosing equities over risk-free government bonds. It is a core input to CAPM and drives cost-of-equity estimates throughout STOXX and ISS analytics.

$$
\text{Market Premium} = R_m - R_f
$$

Where $R_m$ is the market return and $R_f$ is the risk-free rate.

> [!tip] Related terms
> [[#Equity Risk Premium]], [[#Risk-Free Rate]], [[#Alpha]], [[#Beta]]

**Sources:**
- [STOXX Index Research](https://www.stoxx.com/pulse)
- [ISS Analytics](https://www.issgovernance.com/solutions/iss-analytics/)

---

### Momentum (Price Momentum)

> The tendency of securities that have performed well (poorly) over a recent period to continue performing well (poorly) in the near future. In index construction, momentum is typically measured as the total return over the past 6 to 12 months, often excluding the most recent month.

Momentum captures the market's tendency to trend. STOXX momentum indices select stocks with the strongest recent price performance, betting that winners keep winning for a while.

$$
\text{Momentum}_{i} = \frac{P_{i,t-1}}{P_{i,t-12}} - 1
$$

Commonly using a 12-month lookback with a 1-month skip.

> [!tip] Related terms
> [[#Factor Exposure]], [[#Factor Return]], [[#Realized Volatility]]

**Sources:**
- [STOXX Momentum Factor Index](https://www.stoxx.com/index-details?symbol=SXXFMOM)
- [STOXX Factor Index Methodology](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

## N

### Net Return

> The total return of an index calculated by reinvesting dividends after deducting the maximum applicable withholding tax rate for non-resident institutional investors. It provides a more realistic return measure for cross-border investors.

Net return is the after-tax version of total return. It reflects what a foreign institutional investor would actually receive after dividend withholding taxes are taken, making it the most commonly benchmarked return variant.

$$
\text{Net Return Index}_t = \text{Net Return Index}_{t-1} \times \frac{\sum_i w_i \cdot p_{i,t} + \sum_i w_i \cdot d_{i,t} \cdot (1 - \tau_i)}{\sum_i w_i \cdot p_{i,t-1}}
$$

Where $\tau_i$ is the applicable withholding tax rate for constituent $i$.

> [!tip] Related terms
> [[#Gross Return]], [[#Total Return]], [[#Dividend Yield]]

**Sources:**
- [STOXX Calculation Guide](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_calculation_guide.pdf)

---

### Net Income

> The total profit of a company after all expenses, taxes, interest, and depreciation have been subtracted from revenue. It is the "bottom line" of the income statement and the starting point for EPS calculation.

Net income is the final profit number that flows to shareholders. While not as clean as EVA or free cash flow for analytical purposes, it remains the most widely reported profitability metric and anchors the P/E ratio.

$$
\text{Net Income} = \text{Revenue} - \text{COGS} - \text{Operating Expenses} - \text{Interest} - \text{Taxes}
$$

> [!tip] Related terms
> [[#Earnings Per Share (EPS)]], [[#Revenue]], [[#EBITDA]], [[#Return on Equity (ROE)]]

**Sources:**
- [ISS EVA Framework](https://www.issgovernance.com/solutions/eva/)
- [STOXX Analytics](https://www.stoxx.com/analytics-and-statistics)

---

### Net Operating Profit After Tax (NOPAT)

> A company's after-tax operating profit, excluding the effects of capital structure (i.e., interest expense). NOPAT isolates the profitability of core business operations and is the starting point for EVA calculation.

NOPAT strips out how a company is financed and focuses purely on what the business earns from operations after tax. It is the numerator of the value creation equation in the ISS EVA framework.

$$
\text{NOPAT} = \text{Operating Profit} \times (1 - \text{Tax Rate})
$$

> [!tip] Related terms
> [[#Economic Value Added (EVA)]], [[#EVA Margin]], [[#Gross Profitability]]

**Sources:**
- [ISS EVA Methodology](https://www.issgovernance.com/solutions/eva/)

---

### Operating Margin

> The ratio of operating income (revenue minus operating expenses) to revenue, expressed as a percentage. It measures the proportion of revenue left after covering the costs of production and day-to-day operations, but before interest and taxes.

Operating margin isolates the profitability of the core business, stripping away financing and tax effects. It is one of the key quality metrics used in STOXX factor index construction and ISS governance screening.

$$
\text{Operating Margin} = \frac{\text{Operating Income}}{\text{Revenue}} \times 100\%
$$

> [!tip] Related terms
> [[#Gross Margin]], [[#EBITDA]], [[#Net Income]], [[#EVA Margin]]

**Sources:**
- [ISS EVA Framework](https://www.issgovernance.com/solutions/eva/)
- [STOXX Quality Factor Indices](https://www.stoxx.com/index-details?symbol=SXXFQUA)

---

## P

### PEG Ratio

> The price-to-earnings ratio divided by the expected earnings growth rate. It adjusts the P/E ratio for growth, helping investors determine whether a stock's valuation is justified by its earnings growth trajectory.

PEG attempts to answer a question P/E alone cannot: "Is this high-P/E stock expensive, or is it just growing fast?" A PEG of 1.0 is often cited as fair value; below 1.0 suggests the stock may be undervalued relative to its growth.

$$
\text{PEG} = \frac{\text{P/E Ratio}}{\text{Annual EPS Growth Rate (\%)}}
$$

> [!tip] Related terms
> [[#Price-to-Earnings Ratio]], [[#Earnings Per Share (EPS)]], [[#Earnings Yield]]

**Sources:**
- [STOXX Style Indices](https://www.stoxx.com/index-details?symbol=SX5GRT)
- [ISS Analytics](https://www.issgovernance.com/solutions/iss-analytics/)

---

### Price-to-Earnings Ratio

> The ratio of a company's current share price to its earnings per share (EPS). It indicates how much investors are willing to pay for each unit of earnings and is a primary valuation metric in STOXX value and growth index classification.

P/E is the most widely quoted valuation metric. A high P/E suggests investors expect strong future growth; a low P/E may indicate undervaluation or declining prospects.

$$
\text{P/E} = \frac{\text{Price per Share}}{\text{Earnings per Share}}
$$

> [!tip] Related terms
> [[#Earnings Yield]], [[#Book-to-Price Ratio]], [[#Cash Flow Yield]], [[#Dividend Yield]]

**Sources:**
- [STOXX Style Indices](https://www.stoxx.com/index-details?symbol=SX5GRT)
- [STOXX Analytics](https://www.stoxx.com/analytics-and-statistics)

---

## R

### Realized Volatility

> The actual historical volatility of an asset or index, computed as the standard deviation of returns over a past observation window. It is distinguished from implied volatility, which is forward-looking and derived from options prices.

Realized volatility looks backward to measure how bumpy the ride actually was. STOXX uses it to construct minimum-variance and low-volatility indices that favour calmer stocks.

$$
\sigma_{\text{realized}} = \sqrt{\frac{252}{n-1} \sum_{t=1}^{n} \left(r_t - \bar{r}\right)^2}
$$

Where $r_t$ are daily log returns and 252 is the standard annualization factor.

> [!tip] Related terms
> [[#Volatility]], [[#Standard Deviation]], [[#Beta]], [[#Value at Risk (VaR)]]

**Sources:**
- [STOXX Minimum Variance Indices](https://www.stoxx.com/index-details?symbol=SXXFMVP)
- [STOXX Risk Analytics](https://www.stoxx.com/analytics-and-statistics)

---

### Return Attribution

> The decomposition of a portfolio's or index's return into contributions from various sources such as asset allocation, security selection, currency effects, and factor exposures.

Return attribution breaks a result into its ingredients. It answers questions like: "Did the fund outperform because it picked the right sectors, or because it picked the right stocks within those sectors?"

$$
R_{\text{total}} = \sum_{s=1}^{S} w_s \cdot R_s = \underbrace{\sum_{s} (w_s - W_s) \cdot R_{B,s}}_{\text{Allocation}} + \underbrace{\sum_{s} W_s \cdot (R_s - R_{B,s})}_{\text{Selection}} + \text{Interaction}
$$

Where $w_s$ and $W_s$ are portfolio and benchmark weights for sector $s$.

> [!tip] Related terms
> [[#Active Return]], [[#Factor Exposure]], [[#Factor Return]]

**Sources:**
- [STOXX Index Analytics](https://www.stoxx.com/analytics-and-statistics)
- [ISS Governance Analytics](https://www.issgovernance.com/solutions/iss-analytics/)

---

### Return on Assets (ROA)

> The ratio of net income to total assets, measuring how efficiently a company uses its entire asset base to generate profit. It is a key profitability metric in quality factor screening.

ROA answers: "For every dollar of assets the company controls, how many cents of profit does it produce?" It penalises asset-heavy businesses and rewards capital-light models, making it a useful complement to ROE.

$$
\text{ROA} = \frac{\text{Net Income}}{\text{Total Assets}} \times 100\%
$$

> [!tip] Related terms
> [[#Return on Equity (ROE)]], [[#Net Income]], [[#Gross Profitability]]

**Sources:**
- [ISS EVA Framework](https://www.issgovernance.com/solutions/eva/)
- [STOXX Quality Factor Indices](https://www.stoxx.com/index-details?symbol=SXXFQUA)

---

### Return on Equity (ROE)

> The ratio of net income to shareholders' equity, measuring how effectively a company generates profit from the money shareholders have invested. It is one of the most watched profitability metrics in equity analysis.

ROE tells you the return earned on the owners' stake in the business. High ROE can signal a competitive advantage, but it can also be inflated by excessive leverage, so it should be read alongside the debt-to-equity ratio.

$$
\text{ROE} = \frac{\text{Net Income}}{\text{Shareholders' Equity}} \times 100\%
$$

> [!tip] Related terms
> [[#Return on Assets (ROA)]], [[#Debt-to-Equity Ratio]], [[#Net Income]], [[#Earnings Per Share (EPS)]]

**Sources:**
- [ISS EVA Framework](https://www.issgovernance.com/solutions/eva/)
- [STOXX Quality Factor Indices](https://www.stoxx.com/index-details?symbol=SXXFQUA)

---

### Revenue

> The total amount of income generated by the sale of goods or services related to a company's primary operations, before any expenses are deducted. Also referred to as "top line" or "sales."

Revenue is the starting point of every profitability calculation. While it says nothing about whether the company is profitable, sustained revenue growth is a prerequisite for long-term value creation and is a key input to STOXX growth factor screens.

Revenue is reported as an absolute currency figure and does not have a ratio formula per se. Growth is commonly expressed as:

$$
\text{Revenue Growth} = \frac{\text{Revenue}_{t} - \text{Revenue}_{t-1}}{\text{Revenue}_{t-1}} \times 100\%
$$

> [!tip] Related terms
> [[#Net Income]], [[#Gross Margin]], [[#Operating Margin]], [[#EBITDA]]

**Sources:**
- [ISS EVA Framework](https://www.issgovernance.com/solutions/eva/)
- [STOXX Style Indices](https://www.stoxx.com/index-details?symbol=SX5GRT)

---

### Risk-Adjusted Return

> A return metric that accounts for the amount of risk taken to achieve it. Common expressions include the Sharpe ratio, Sortino ratio, and information ratio.

Raw returns can be misleading if one fund took enormous risk to achieve them. Risk-adjusted return normalizes performance by the volatility or downside risk endured, enabling fair comparisons.

$$
\text{Risk-Adjusted Return} = \frac{R_p - R_f}{\sigma_p}
$$

This is the general form (Sharpe ratio). Alternative specifications replace $\sigma_p$ with downside deviation (Sortino) or tracking error (Information ratio).

> [!tip] Related terms
> [[#Sharpe Ratio]], [[#Sortino Ratio]], [[#Information Ratio]], [[#Alpha]]

**Sources:**
- [STOXX Risk Reporting](https://www.stoxx.com/analytics-and-statistics)

---

### Risk-Free Rate

> The theoretical rate of return on an investment with zero risk of financial loss, typically proxied by the yield on short-term government securities such as U.S. Treasury bills or German Bunds. It serves as the baseline against which all risky investments are measured.

The risk-free rate is the anchor of modern portfolio theory. Every risk premium, every Sharpe ratio, and every CAPM calculation starts by subtracting this rate. In practice, it shifts with central bank policy and sovereign credit conditions.

The risk-free rate is observed from government bond yields rather than calculated from a formula. It is commonly denoted:

$$
R_f \approx \text{Yield on short-term government bonds}
$$

> [!tip] Related terms
> [[#Equity Risk Premium]], [[#Market Premium]], [[#Sharpe Ratio]], [[#Alpha]]

**Sources:**
- [STOXX Index Research](https://www.stoxx.com/pulse)
- [STOXX Calculation Guide](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_calculation_guide.pdf)

---

### Risk-Return Tradeoff

> The principle that potential return rises with an increase in risk. It states that investors must accept higher uncertainty (volatility) if they seek higher expected returns, and that low-risk investments tend to offer lower returns.

The risk-return tradeoff is the foundational concept behind portfolio construction. It explains why equities historically outperform bonds (higher risk, higher reward) and why the efficient frontier exists. STOXX risk-controlled indices explicitly optimize along this tradeoff.

There is no single formula for the tradeoff itself, but it is embodied in frameworks like CAPM:

$$
E(R_i) = R_f + \beta_i \cdot (E(R_m) - R_f)
$$

Higher $\beta$ (risk) corresponds to higher expected return $E(R_i)$.

> [!tip] Related terms
> [[#Sharpe Ratio]], [[#Volatility]], [[#Risk-Adjusted Return]], [[#Equity Risk Premium]]

**Sources:**
- [STOXX Risk Analytics](https://www.stoxx.com/analytics-and-statistics)
- [STOXX Factor Indices](https://www.stoxx.com/factor-indices)

---

## S

### Sharpe Ratio

> The ratio of a portfolio's excess return over the risk-free rate to its total standard deviation. Developed by William Sharpe, it is the most widely used measure of risk-adjusted performance.

The Sharpe ratio asks: "For every unit of total volatility I endured, how much extra return did I get beyond the risk-free rate?" Values above 1.0 are generally considered good; above 2.0, excellent.

$$
S = \frac{R_p - R_f}{\sigma_p}
$$

> [!tip] Related terms
> [[#Sortino Ratio]], [[#Information Ratio]], [[#Standard Deviation]], [[#Risk-Adjusted Return]]

**Sources:**
- [STOXX Risk Analytics](https://www.stoxx.com/analytics-and-statistics)

---

### Sortino Ratio

> A modification of the Sharpe ratio that uses downside deviation instead of total standard deviation as the risk measure. It penalizes only harmful volatility (returns below a target), not overall variability.

The Sortino ratio recognizes that upside volatility is desirable. By focusing only on bad surprises, it gives a more investor-relevant picture of risk-adjusted performance than the Sharpe ratio.

$$
\text{Sortino} = \frac{R_p - R_f}{\sigma_{\text{downside}}}
$$

Where $\sigma_{\text{downside}} = \sqrt{\frac{1}{n}\sum_{t=1}^{n}\min(r_t - R_f,\, 0)^2}$.

> [!tip] Related terms
> [[#Sharpe Ratio]], [[#Maximum Drawdown]], [[#Standard Deviation]], [[#Risk-Adjusted Return]]

**Sources:**
- [STOXX Analytics](https://www.stoxx.com/analytics-and-statistics)

---

### Standard Deviation

> A statistical measure of the dispersion of returns around their mean. In finance, it serves as the primary measure of total risk (volatility).

Standard deviation tells you how spread out an investment's returns are. A higher standard deviation means wider swings in value and therefore greater uncertainty about future outcomes.

$$
\sigma = \sqrt{\frac{1}{n-1}\sum_{t=1}^{n}(r_t - \bar{r})^2}
$$

> [!tip] Related terms
> [[#Volatility]], [[#Realized Volatility]], [[#Sharpe Ratio]], [[#Tracking Error]]

**Sources:**
- [STOXX Calculation Guide](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_calculation_guide.pdf)
- [STOXX Risk Analytics](https://www.stoxx.com/analytics-and-statistics)

---

### Spread (Credit)

> The difference in yield between a corporate bond (or other credit instrument) and a risk-free government bond of comparable maturity. It compensates the investor for default risk, liquidity risk, and other credit-related uncertainties.

Credit spread is the market's real-time verdict on a borrower's riskiness. When spreads widen, investors are demanding more compensation for the perceived risk of default; when they tighten, confidence is rising.

$$
\text{Credit Spread} = Y_{\text{corporate}} - Y_{\text{risk-free}}
$$

Typically expressed in basis points.

> [!tip] Related terms
> [[#Basis Point]], [[#Yield Curve]], [[#Duration (Bond)]], [[#Risk-Free Rate]]

**Sources:**
- [STOXX Fixed Income Index Methodology](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [ISS Analytics](https://www.issgovernance.com/solutions/iss-analytics/)

---

## T

### Total Return

> The complete return on an investment including both price appreciation and income from dividends or interest, assuming all distributions are reinvested. STOXX publishes total return indices in both gross and net variants.

Total return captures the full picture: not just whether the stock price went up, but also the dividends you collected along the way. It is the only honest way to evaluate long-term investment performance.

$$
R_{\text{total}} = \frac{P_{t} + D_{t} - P_{t-1}}{P_{t-1}}
$$

Where $P_t$ is the price at time $t$ and $D_t$ is the dividend received.

> [!tip] Related terms
> [[#Gross Return]], [[#Net Return]], [[#Annualized Return]], [[#Dividend Yield]]

**Sources:**
- [STOXX Calculation Guide](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_calculation_guide.pdf)

---

### Tracking Error

> The standard deviation of the difference between a portfolio's returns and its benchmark's returns. It measures the consistency of a portfolio's deviation from its benchmark, also known as active risk.

Tracking error quantifies how tightly a fund follows its benchmark. An index-tracking ETF should have near-zero tracking error; an active manager with high conviction will have a large one.

$$
\text{TE} = \sigma(R_p - R_b) = \sqrt{\frac{1}{n-1}\sum_{t=1}^{n}\bigl[(R_{p,t} - R_{b,t}) - \overline{(R_p - R_b)}\bigr]^2}
$$

> [!tip] Related terms
> [[#Active Return]], [[#Information Ratio]], [[#Standard Deviation]]

**Sources:**
- [STOXX Index Methodology Guide](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

### Turnover

> In index methodology, the proportion of an index's weight that changes at each rebalancing, reflecting the cost of maintaining the portfolio. It is typically expressed as one-way turnover (the sum of additions or deletions, not both).

Turnover measures how much trading an index forces at each rebalance. Higher turnover means higher transaction costs and potential tax consequences for funds tracking the index.

$$
\text{Turnover} = \frac{1}{2}\sum_{i=1}^{N}\left|w_{i,\text{new}} - w_{i,\text{old}}\right|
$$

> [!tip] Related terms
> [[#Weighted Average]], [[#Tracking Error]]

**Sources:**
- [STOXX Index Methodology Guide](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

## V

### Value at Risk (VaR)

> The maximum expected loss of a portfolio over a specified time horizon at a given confidence level. For example, a one-day 95% VaR of $1 million means there is a 5% probability of losing more than $1 million in a single day.

VaR puts a dollar figure on potential losses. It answers: "On 95 out of 100 days, I expect to lose no more than this amount." It does not, however, tell you how bad things could get in the remaining 5 days.

$$
P\bigl(L \leq \text{VaR}_{\alpha}\bigr) = \alpha
$$

Under the parametric (normal) assumption:

$$
\text{VaR}_{\alpha} = \mu - z_{\alpha} \cdot \sigma
$$

Where $z_{\alpha}$ is the z-score at confidence level $\alpha$.

> [!tip] Related terms
> [[#Maximum Drawdown]], [[#Volatility]], [[#Standard Deviation]], [[#Drawdown]]

**Sources:**
- [STOXX Risk Analytics](https://www.stoxx.com/analytics-and-statistics)

---

### Volatility

> A general term for the degree of variation in a trading price series over time. In quantitative finance, it is most commonly measured as the annualized standard deviation of returns.

Volatility is the heartbeat of financial markets. Low volatility means calm, predictable price action; high volatility means wild swings. STOXX uses it to build minimum-variance and low-volatility indices.

$$
\sigma_{\text{ann}} = \sigma_{\text{daily}} \times \sqrt{252}
$$

> [!tip] Related terms
> [[#Realized Volatility]], [[#Standard Deviation]], [[#Beta]], [[#Value at Risk (VaR)]]

**Sources:**
- [STOXX Low Volatility Indices](https://www.stoxx.com/index-details?symbol=SXXFMVP)
- [STOXX Calculation Guide](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_calculation_guide.pdf)

---

## W

### Weighted Average

> A calculation in which each constituent's value is multiplied by its index weight before summation, producing an aggregate that reflects the relative importance of each component. Used extensively in index-level statistics such as weighted-average P/E, dividend yield, and market capitalisation.

A simple average treats all stocks equally; a weighted average gives larger stocks more influence. Nearly every aggregate index statistic you see -- average P/E, average yield, average beta -- is a weighted average.

$$
\bar{x}_w = \sum_{i=1}^{N} w_i \cdot x_i \quad \text{where} \quad \sum_{i=1}^{N} w_i = 1
$$

> [!tip] Related terms
> [[#Turnover]], [[#Factor Exposure]], [[#Return Attribution]]

**Sources:**
- [STOXX Calculation Guide](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_calculation_guide.pdf)
- [STOXX Index Methodology Guide](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

## Y

### Yield Curve

> A graphical representation of the relationship between bond yields and their maturities, typically for government securities. A normal (upward-sloping) curve indicates that longer-term bonds pay higher yields; an inverted curve, where short-term rates exceed long-term rates, has historically been a recession predictor.

The yield curve is one of the most watched indicators in finance. Its shape reflects market expectations about future interest rates, inflation, and economic growth. STOXX fixed-income indices are segmented by maturity buckets that correspond to different points on the curve.

The yield curve is an empirical observation rather than a single formula. The term structure can be modelled as:

$$
y(t) = \beta_0 + \beta_1 \cdot e^{-t/\tau} + \beta_2 \cdot \frac{t}{\tau} \cdot e^{-t/\tau}
$$

This is the Nelson-Siegel model, where $\beta_0$ is the long-run level, $\beta_1$ captures slope, $\beta_2$ captures curvature, and $\tau$ is a decay parameter.

> [!tip] Related terms
> [[#Duration (Bond)]], [[#Spread (Credit)]], [[#Risk-Free Rate]], [[#Basis Point]]

**Sources:**
- [STOXX Fixed Income Index Methodology](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [ISS Analytics](https://www.issgovernance.com/solutions/iss-analytics/)

---

> [!info] Disclaimer
> Definitions are synthesised from publicly available STOXX and ISS Governance
> documentation for educational purposes. Always consult the latest official
> methodology guides for authoritative specifications.
