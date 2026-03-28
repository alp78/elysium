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

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="51 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 51</span>


> The difference between a portfolio's return and its benchmark return over a given period, representing the value added (or lost) by active management decisions.

In plain terms, active return tells you how much better or worse a fund did compared to the index it tracks. If a portfolio gained 12% and the benchmark gained 10%, the active return is +2%.

$$
R_{\text{active}} = R_{\text{portfolio}} - R_{\text{benchmark}}
$$

> [!tip] Related terms
> [[#Alpha]], [[#Tracking Error]], [[#Information Ratio]]




> [!quote] The diversification benefits of a multi-factor approach: the STOXX Europe 600...
> ver, and it is also important to note that the **active return** was positive far more often than it was negative, both on a quarterly and an annual basis. Exhibit 2: Scatterplot of active vs. market returns, annual (left) and quarterly (right) Returns attribution Attribution can tell us if the index’s **active return**s largely come from its factor exposures, and indeed we see that that is the case. U...
> — [The diversification benefits of a multi-factor approach: the STOXX Europe 600...](https://stoxx.com/the-diversification-benefits-of-a-multi-factor-approach-the-stoxx-europe-600-industry-neutral-ax-multi-factor-index) — "WHITEPAPER"

> [!quote] Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX a...
> such as earnings momentum or earnings momentum drift — enhances signal strength (Figure 2). This approach helps us avoid simplistic exposures and better reflect what Momentum truly represents: a behavioral phenomenon rooted in investor underreaction, and not just a statistical artifact.” Figure 2: **Active return**s – USA Momentum factor “It’s worth emphasizing here that innovating in factor design...
> — [Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX a...](https://stoxx.com/qa-with-blackrock-fourth-year-of-multifactor-collaboration-with-stoxx-amid-evolving-factor-investing-landscape) — "WHITEPAPER"

> [!quote] Harnessing factor strategies: Controlling risk and sustainability efficiently...
> hat you see over the long term, but you don’t feel the short-term cyclicality of single factors?” Figure 1 displays, from top to bottom, the best- to worst-performing factors in Europe each year. As the chart shows, there is a high shift in performance of single factors from year to year. Figure 1: **Active return**s of STOXX European factor indices A multifactor strategy can smooth out that cyclic...
> — [Harnessing factor strategies: Controlling risk and sustainability efficiently...](https://stoxx.com/harnessing-factor-strategies-controlling-risk-and-sustainability-efficiently) — "WHITEPAPER"

> [!quote] DAX ESG Target: An optimal solution to risk, return and impact in German stoc...
> ear periods active risk has been consistently very close to target.4 Figure 1 – Risk and return characteristics Risk exposures The DAX ESG Target’s outperformance has been consistent, too, with the notable exception of the COVID-19-induced sell-off in early 2020. Figure 2 shows the DAX ESG Target’s **active return** in a dotted line. ‘Specific returns’ refers to the idiosyncratic component from eac...
> — [DAX ESG Target: An optimal solution to risk, return and impact in German stoc...](https://stoxx.com/dax-esg-target-an-optimal-solution-to-risk-return-and-impact) — "WHITEPAPER"

> [!quote] STOXX Factor and STOXX ESG-X Factor Indices Q2 Spotlight – Mixed Performance,...
> or and sustainable investing. These show a similar picture to the standard factor indices. Figures 1 and 2 Source: Qontigo. Data prior to index launch simulated. USD Gross Returns. Benchmarks are the STOXX® Global 1800 Index and its ESG-X version. It is likely worth noting that the recent quarterly **active return**s in the area of +/-10% are much larger than one would expect during less turbulent ...
> — [STOXX Factor and STOXX ESG-X Factor Indices Q2 Spotlight – Mixed Performance,...](https://stoxx.com/stoxx-factor-and-stoxx-esg-x-factor-indices-q2-spotlight-mixed-performance-strong-exposures-and-rebounding-correlations) — "WHITEPAPER"

**Sources:**
- [The diversification benefits of a multi-factor approach: the STOXX Europe 600 Industry Neutral Ax Multi-Factor Index | Blog posts | STOXX](https://stoxx.com/the-diversification-benefits-of-a-multi-factor-approach-the-stoxx-europe-600-industry-neutral-ax-multi-factor-index) — "WHITEPAPER"
- [Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX amid evolving factor investing landscape | Blog posts | STOXX](https://stoxx.com/qa-with-blackrock-fourth-year-of-multifactor-collaboration-with-stoxx-amid-evolving-factor-investing-landscape) — "WHITEPAPER"
- [Harnessing factor strategies: Controlling risk and sustainability efficiently | Blog posts | STOXX](https://stoxx.com/harnessing-factor-strategies-controlling-risk-and-sustainability-efficiently) — "WHITEPAPER"
- [DAX ESG Target: An optimal solution to risk, return and impact in German stocks | Blog posts | STOXX](https://stoxx.com/dax-esg-target-an-optimal-solution-to-risk-return-and-impact) — "WHITEPAPER"
- [STOXX Factor and STOXX ESG-X Factor Indices Q2 Spotlight – Mixed Performance, Strong Exposures and Rebounding Correlations | STOXX](https://stoxx.com/stoxx-factor-and-stoxx-esg-x-factor-indices-q2-spotlight-mixed-performance-strong-exposures-and-rebounding-correlations) — "WHITEPAPER"

---

### Alpha

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="218 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 218</span>


> The excess return of a portfolio relative to the return predicted by the Capital Asset Pricing Model (CAPM), given the portfolio's systematic risk exposure (beta). Alpha isolates manager skill from market movement.

Alpha is the portion of a portfolio's return that cannot be explained by broad market moves. Positive alpha means the manager outperformed what the market risk alone would have predicted.

$$
\alpha = R_{\text{portfolio}} - \bigl[R_f + \beta \cdot (R_m - R_f)\bigr]
$$

Where $R_f$ is the risk-free rate and $R_m$ is the market return.

> [!tip] Related terms
> [[#Beta]], [[#Active Return]], [[#Risk-Adjusted Return]], [[#Equity Risk Premium]]




> [!quote] BlackRock’s Ang on sustainability alpha signals: ESG and factors as ‘best fri...
> gnals can be an important part of factor investing – where the former can, through a quantitatively-driven and systematic investment process, complement or reinforce a factor strategy.3 The result should lead to excess returns and improved climate or ESG scores. “This talk was all about sustainable **alpha**,” Dr. Ang concluded. “That is the real opportunity for all of us. If we, as investors, use ...
> — [BlackRock’s Ang on sustainability alpha signals: ESG and factors as ‘best fri...](https://stoxx.com/blackrocks-ang-on-sustainability-alpha-signals-esg-and-factors-as-best-friends) — "WHITEPAPER"

> [!quote] Smart Beta versus Dumb Alpha | Blog posts | STOXX
> none at all (i.e. an unconstrained portfolios). The paper discussed in detail the individual results for each variant on our four style portfolios. One clear consequence of striving for target factor purity via constraints on other systematic sources of risk, is that stock specific risk (i.e. dumb **alpha** since there was no stock-level research inputs), becomes more and more influential in the pe...
> — [Smart Beta versus Dumb Alpha | Blog posts | STOXX](https://stoxx.com/smart-beta-versus-dumb-alpha) — "WHITEPAPER"

> [!quote] iss-esg-implications-of-index-reconstitutions-free-carbon-alpha-24 | ISS
> iss-esg-implications-of-index-reconstitutions-free-carbon-**alpha**-242022-09-222022-09-22/file/images/iss_logo_header-1.pngISS/file/images/iss_logo_header-1.png200px200px
> — [iss-esg-implications-of-index-reconstitutions-free-carbon-alpha-24 | ISS](https://www.issgovernance.com/library/implications-of-index-reconstitutions-free-carbon-alpha/iss-implications-of-index-reconstitutions-free-carbon-alpha-24) — "iss-esg-implications-of-index-reconstitutions-free-carbon-alpha-24"

> [!quote] Not so fast. Factor investing is alive and doing well! | Blog posts | STOXX
> cerned. The FMP has generated a return of 40 percentage points since 2000 with no market exposure, the study shows. Its return has been consistently positive, thereby proving its value as a basis for building the index. The analysis then digs even deeper to examine the five factor components of the **alpha** score described above: Value, Momentum, Quality, Low Size and Low Volatility. Since 2002, f...
> — [Not so fast. Factor investing is alive and doing well! | Blog posts | STOXX](https://stoxx.com/not-so-fast-factor-investing-is-alive-and-doing-well) — "WHITEPAPER"

> [!quote] Factor Performance Can Be Timed and Exploited, Study Finds Factor Performance...
> omically large and statistically significant **alpha** after controlling for stock momentum,” they added. AQR is an investment management firm based in Greenwich, Connecticut, with almost $200 billion under management; it is known for its applied research in investment strategies. Large and significant **alpha** Price momentum is the well-researched observation that assets that have outperformed in the...
> — [Factor Performance Can Be Timed and Exploited, Study Finds Factor Performance...](https://stoxx.com/factor-performance-can-be-timed-and-exploited-study-finds-factor-performance-can-be-timed-and-exploited-study-finds) — "WHITEPAPER"

**Sources:**
- [BlackRock’s Ang on sustainability alpha signals: ESG and factors as ‘best friends’  | Blog posts | STOXX](https://stoxx.com/blackrocks-ang-on-sustainability-alpha-signals-esg-and-factors-as-best-friends) — "WHITEPAPER"
- [Smart Beta versus Dumb Alpha | Blog posts | STOXX](https://stoxx.com/smart-beta-versus-dumb-alpha) — "WHITEPAPER"
- [iss-esg-implications-of-index-reconstitutions-free-carbon-alpha-24 | ISS](https://www.issgovernance.com/library/implications-of-index-reconstitutions-free-carbon-alpha/iss-implications-of-index-reconstitutions-free-carbon-alpha-24) — "iss-esg-implications-of-index-reconstitutions-free-carbon-alpha-24"
- [Not so fast. Factor investing is alive and doing well! | Blog posts | STOXX](https://stoxx.com/not-so-fast-factor-investing-is-alive-and-doing-well) — "WHITEPAPER"
- [Factor Performance Can Be Timed and Exploited, Study Finds Factor Performance Can Be Timed and Exploited, Study Finds | Blog posts | STOXX](https://stoxx.com/factor-performance-can-be-timed-and-exploited-study-finds-factor-performance-can-be-timed-and-exploited-study-finds) — "WHITEPAPER"

---

### Annualized Return

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="24 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 24</span>


> The geometric average amount of money earned by an investment each year over a specified time period, compounding gains and losses into a single annual rate.

Annualized return converts a total multi-period return into a yearly figure so you can compare investments held over different time spans on equal footing.

$$
R_{\text{ann}} = \left(1 + R_{\text{total}}\right)^{\frac{1}{n}} - 1
$$

Where $n$ is the number of years in the holding period.

> [!tip] Related terms
> [[#Total Return]], [[#Gross Return]], [[#Net Return]]




> [!quote] From pandemic profiteers to stagflation hostages: FAANGs stranglehold weighs ...
> n the FAANGs last week. Figure 2 – Cumulative excess return FAANGs vs. STOXX USA 900 index Still, the tremendous gains accumulated by the FAANGs during the pandemic years have not been fully wiped out yet (Figure 3). Propelled by their stellar performance in 2020, the FAANGs portfolio has posted an **annualized return** for the 2020-2022 period of 14%, outperforming the STOXX USA 900 index by 6 per...
> — [From pandemic profiteers to stagflation hostages: FAANGs stranglehold weighs ...](https://stoxx.com/from-pandemic-profiteers-to-stagflation-hostages-faangs-stranglehold-weighs-on-us-market) — "WHITEPAPER"

> [!quote] Monthly Index News January 2024 (PDF)
> 600 SRI has had, since 2014, an average ESG score that is 7.4% higher than that of the benchmark. As of December 2023, it had lowered the carbon emission intensity by more than 85%. Figure 1: Risk and return characteristics Source: STOXX, daily data for the period March 24, 2014, to Dec. 29, 2023. **Annualized return**s, annualized volatility (standard deviation), annualized tracking error and annu...
> — [Monthly Index News January 2024 (PDF)](https://stoxx.com/monthly-index-news-january-2024)

> [!quote] Measuring the difficulty of market timing | Blog posts | STOXX
> g market moves are real. Figure 1 shows in black dots the annualized performance of STOXX Thematic indices from 2019 to 2024. The blue crosses represent adjusted index returns when the year’s best or worst days are excluded. In the case of the best-performing index, the STOXX® Semiconductor 30, its **annualized return** of 24% over the period jumps to 35% if an investor had held the index while avo...
> — [Measuring the difficulty of market timing | Blog posts | STOXX](https://stoxx.com/measuring-the-difficulty-of-market-timing) — "WHITEPAPER"

> [!quote] Why Artificial Intelligence Outperformed Digital Security – A Factor Analysis...
> ed with their objectives and do not introduce unwanted biases into their investments. A strong run for tech No other market sector has performed as well as technology in recent years.2 All four tech-oriented STOXX thematic indices have reflected this bullish investor sentiment, posting double-digit **annualized return**s in the past nine years (Figure 1). While the Artificial Intelligence and Finte...
> — [Why Artificial Intelligence Outperformed Digital Security – A Factor Analysis...](https://stoxx.com/why-artificial-intelligence-outperformed-digital-security-a-factor-analysis-of-technology-oriented-thematic-indices) — "WHITEPAPER"

> [!quote] Ixarobu (PDF)
> an Largest Smallest Largest Smallest Last 12 months STOXX Global Automation & Robotics N/A 10.7 0.1 0.0 0.2 0.0 1.8 0.0 41.0 STOXX Global Total Market 85,453.5 72,194.6 6.4 0.7 2,811.7 0.0 3.9 0.0 2.8 Supersector weighting (top 10) Country weighting Risk and return figures1 Index returns Return (%) **Annualized return** (%) Last month YTD 1Y 3Y 5Y Last month YTD 1Y 3Y 5Y STOXX Global Automation & R...
> — [Ixarobu (PDF)](https://www.stoxx.com/document/Bookmarks/CurrentFactsheets/IXAROBU.pdf)

**Sources:**
- [From pandemic profiteers to stagflation hostages: FAANGs stranglehold weighs on US market | Blog posts | STOXX](https://stoxx.com/from-pandemic-profiteers-to-stagflation-hostages-faangs-stranglehold-weighs-on-us-market) — "WHITEPAPER"
- [Monthly Index News January 2024 (PDF)](https://stoxx.com/monthly-index-news-january-2024)
- [Measuring the difficulty of market timing | Blog posts | STOXX](https://stoxx.com/measuring-the-difficulty-of-market-timing) — "WHITEPAPER"
- [Why Artificial Intelligence Outperformed Digital Security – A Factor Analysis of Technology-Oriented Thematic Indices | Blog posts | STOXX](https://stoxx.com/why-artificial-intelligence-outperformed-digital-security-a-factor-analysis-of-technology-oriented-thematic-indices) — "WHITEPAPER"
- [Ixarobu (PDF)](https://www.stoxx.com/document/Bookmarks/CurrentFactsheets/IXAROBU.pdf)

---

## B

### Basis Point

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="505 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 505</span>


> One hundredth of one percentage point (0.01%), used to express small changes in interest rates, yields, spreads, and fund fees. 100 basis points equal 1 percentage point.

Basis points remove ambiguity when discussing rate changes. Saying "rates rose 50 basis points" is unambiguous, whereas "rates rose half a percent" could be confused with a relative change. Nearly every STOXX and ISS yield, spread, and fee figure is quoted in basis points.

$$
1\;\text{bp} = 0.01\% = 0.0001
$$

So a move from 2.50% to 3.00% is a change of 50 bp.

> [!tip] Related terms
> [[#Spread (Credit)]], [[#Yield Curve]], [[#Risk-Free Rate]]




> [!quote] Monthly Index News April 2021 (PDF)
> OXX® USA 900 Index by 34 **basis point**s. The STOXX ESG Impact Indices offer a broad market exposure that is tilted towards companies that score better with respect to a small set of environmental, social, and governance key performance indicators. The EURO STOXX 50® ESG Index beat its benchmark by 12 **basis point**s. The index is derived from the flagship EURO STOXX 50 and implements a set of standa...
> — [Monthly Index News April 2021 (PDF)](https://stoxx.com/monthly-index-news-april-2021)

> [!quote] Monthly Index News May 2021 (PDF)
> on the Sustainalytics Global Standards Screening assessment or are involved in controversial weapons are not eligible for selection. Additional filters exclude companies involved in tobacco production, thermal coal and military contracting. The STOXX® Global 1800 ESG Broad Market Index returned 34 **basis point**s more than the benchmark STOXX Global 1800 during May. The EURO STOXX® ESG Broad Marke...
> — [Monthly Index News May 2021 (PDF)](https://stoxx.com/monthly-index-news-may-2021)

> [!quote] Monthly Index News August 2019 (PDF)
> bal 1800 ESG-X Index underperformed marginally, by 10 **basis point**s. The STOXX® North America 600 ESG-X Index underperformed by 16 **basis point**s, whereas the STOXX® Asia/Pacific 600 ESG-X Index came ahead of its benchmark by 8 basis points and the STOXX® Europe 600 ESG-X Index beat its benchmark by 2 basis points. The ESG-X indices are versions of traditional, market-capitalization-weighted bench...
> — [Monthly Index News August 2019 (PDF)](https://stoxx.com/monthly-index-news-august-2019)

> [!quote] Index Files Guide 20230619 (PDF)
> ncy: Monthly (published on Tuesday before the third Friday of the month) Column Data Attribute Description Data Format ID Type 1 VALID_FROM Effective date of the new values Date YYYY-MM-DD 2 ISIN Index ISIN Text 12 3 Name Index name Text 255 Cost to Borrow 4 Value of the cost to borrow expressed in **basis point**s Number 5 (BPS) 4.6.2. Cost to Borrow This file is a forecast of cost to borrow that ...
> — [Index Files Guide 20230619 (PDF)](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)

> [!quote] Monthly Index News August 2021 (PDF)
> MONTHLY INDEX NEWS / August 2021 Premia Indices Key Points Among the EURO STOXX® Multi Premia® and Single Premium Indices, the EURO STOXX® Momentum Premium Index outperformed the benchmark EURO STOXX® Index’s 2.6% advance in August by 121 **basis point**s. The EURO STOXX Multi Premia and Single Premium Indices track seven distinctive sources of equity risk and returns on a broad and liquid universe...
> — [Monthly Index News August 2021 (PDF)](https://stoxx.com/monthly-index-news-august-2021)

**Sources:**
- [Monthly Index News April 2021 (PDF)](https://stoxx.com/monthly-index-news-april-2021)
- [Monthly Index News May 2021 (PDF)](https://stoxx.com/monthly-index-news-may-2021)
- [Monthly Index News August 2019 (PDF)](https://stoxx.com/monthly-index-news-august-2019)
- [Index Files Guide 20230619 (PDF)](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)
- [Monthly Index News August 2021 (PDF)](https://stoxx.com/monthly-index-news-august-2021)

---

### Beta

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="259 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 259</span>


> A measure of a security's or portfolio's systematic risk relative to the overall market. A beta of 1.0 indicates the asset moves in lockstep with the market; values above or below 1.0 indicate amplified or dampened sensitivity.

Beta tells you how much a stock tends to move when the market moves. A stock with a beta of 1.5 historically rises or falls 50% more than the market in either direction.

$$
\beta = \frac{\text{Cov}(R_i,\, R_m)}{\text{Var}(R_m)}
$$

> [!tip] Related terms
> [[#Alpha]], [[#Equity Risk Premium]], [[#Factor Exposure]]




> [!quote] STOXX Awarded “Best Smart Beta Index Provider, Asia-Pacific” By SRP | Press r...
> Zurich/Singapore (April 30, 2018) – STOXX Ltd., the operator of Deutsche Boerse Group’s index business and a global provider of innovative and tradable index concepts, has been recognized as 2018’s “Best Smart **Beta** Index Provider, Asia-Pacific” by Structured Retail Products (SRP). This is the first time STOXX Ltd. has received this award. The awards ceremony was held in Singapore. “This award i...
> — [STOXX Awarded “Best Smart Beta Index Provider, Asia-Pacific” By SRP | Press r...](https://stoxx.com/stoxx-awarded-best-smart-beta-index-provider-asia-pacific-by-srp) — "WHITEPAPER"

> [!quote] Study Shines Light on Smart Beta’s Effectiveness and Capacity | Blog posts | ...
> A new Qontigo report1 takes a comprehensive look at the market for ‘smart **beta**’ funds tracking factor strategies, to assess their prowess in boosting returns and their capacity as money inflows grow. The study by Frank Siu, Executive Director of Quantitative and Multi-Asset Solutions at Qontigo, looked at exchange-traded funds (ETFs) tracking equity smart **beta** and factor
> — [Study Shines Light on Smart Beta’s Effectiveness and Capacity | Blog posts | ...](https://stoxx.com/study-shines-light-on-smart-betas-effectiveness-and-capacity) — "WHITEPAPER"

> [!quote] Smart Beta versus Dumb Alpha | Blog posts | STOXX
> mphasis (certainly more marketing dollars) is usually given to the objective function behind smart **beta** portfolios, but constraints play a leading role (ultimately exaggerated into a central one), in their performance and predictability. In this paper we construct four variants of each of our smart **beta** portfolios, as well as two variants of a Low Volatility portfolio. We use the Growth, Moment...
> — [Smart Beta versus Dumb Alpha | Blog posts | STOXX](https://stoxx.com/smart-beta-versus-dumb-alpha) — "WHITEPAPER"

> [!quote] iSTOXX® MUTB Global Ex Australia Quality Leaders Index AUD Hedged Licensed To...
> Zug 12 June 2020 – Qontigo has licensed the iSTOXX® MUTB Global ex Australia Quality Leaders Index AUD Hedged to Australian ETF manager **Beta**Shares, for use in their newly launched ETF. Based on a combined screening and ranking of fundamental indicators, the index selects the highest quality companies from the STOXX Global 1800 ex Australia Index. Media Contact General Inquiries: media@qontigo.c...
> — [iSTOXX® MUTB Global Ex Australia Quality Leaders Index AUD Hedged Licensed To...](https://stoxx.com/istoxx-mutb-global-ex-australia-quality-leaders-index-aud-hedged-licensed-to-betashares) — "WHITEPAPER"

> [!quote] The Index World and Twenty Years of Europe’s ETFs | STOXX
> of assets, index choice and static factor exposure.2 That means that when an investor picks an ETF, not only are they buying an entire market — they are also actively choosing an asset class, geography, an index methodology, a style and a factor exposure and the timing of the purchase. Enter smart **beta** The menu of index choices has also ballooned with the inception of strategies that seek to ex...
> — [The Index World and Twenty Years of Europe’s ETFs | STOXX](https://stoxx.com/the-index-world-and-twenty-years-of-europes-etfs) — "WHITEPAPER"

**Sources:**
- [STOXX Awarded “Best Smart Beta Index Provider, Asia-Pacific” By SRP | Press releases | STOXX](https://stoxx.com/stoxx-awarded-best-smart-beta-index-provider-asia-pacific-by-srp) — "WHITEPAPER"
- [Study Shines Light on Smart Beta’s Effectiveness and Capacity | Blog posts | STOXX](https://stoxx.com/study-shines-light-on-smart-betas-effectiveness-and-capacity) — "WHITEPAPER"
- [Smart Beta versus Dumb Alpha | Blog posts | STOXX](https://stoxx.com/smart-beta-versus-dumb-alpha) — "WHITEPAPER"
- [iSTOXX® MUTB Global Ex Australia Quality Leaders Index AUD Hedged Licensed To BetaShares | Press releases | STOXX](https://stoxx.com/istoxx-mutb-global-ex-australia-quality-leaders-index-aud-hedged-licensed-to-betashares) — "WHITEPAPER"
- [The Index World and Twenty Years of Europe’s ETFs | STOXX](https://stoxx.com/the-index-world-and-twenty-years-of-europes-etfs) — "WHITEPAPER"

---

### Book-to-Price Ratio

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1 mentions across STOXX & ISS pages (ultra-low)">▰ 1</span>


> The ratio of a company's book value of equity to its market capitalisation. It is the inverse of the more commonly cited price-to-book ratio and is widely used as a value factor in index construction.

Book-to-price tells you how much of a company's accounting net worth you get for each dollar of market price. Higher values suggest the stock may be undervalued relative to its assets.

$$
\text{B/P} = \frac{\text{Book Value of Equity}}{\text{Market Capitalisation}}
$$

> [!tip] Related terms
> [[#Price-to-Earnings Ratio]], [[#Earnings Yield]], [[#Cash Flow Yield]]




> [!quote] Istoxx Index Guide (PDF)
> ions can be provided upon request. Index types and currencies: Price, net and gross return in EUR, USD and JPY. Dissemination calendar: STOXX Global calendar INDEX REVIEW Selection list: On a quarterly basis, the momentum factor is calculated for each stock after adjusting for market beta, size and **book-to-price ratio**. First, the beta and alpha of each stock is calculated using the formula belo...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

**Sources:**
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

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

---

### Cash Flow Yield

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="29 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 29</span>


> The ratio of operating cash flow per share to the current share price. It measures how much cash a business generates relative to its market valuation and is used as a value factor in index screening.

Cash flow yield is like dividend yield's more comprehensive cousin: it looks at all the cash the business produces, not just what it pays out. Higher values can signal undervaluation.

$$
\text{Cash Flow Yield} = \frac{\text{Operating Cash Flow per Share}}{\text{Price per Share}}
$$

> [!tip] Related terms
> [[#Earnings Yield]], [[#Dividend Yield]], [[#Book-to-Price Ratio]]




> [!quote] Stoxx Index Guide (PDF)
> on Intensity in particular, values are z-scored relative to each stock’s ICB Supersector. The Quality Factor combines the Signals at 20%, 20%, 20%, 20%, 13%, and 7% weights, respectively, and is again z-scored and truncated. The Value Factor is a composite of the following 5 Signals: Book to Price, **Cash Flow Yield**, Time Series Normalized **Cash Flow Yield**, Dividend Yield and Earnings Yield.  Boo...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] Stoxx Index Guide (PDF)
> on Intensity in particular, values are z-scored relative to each stock’s ICB Supersector. The Quality Factor combines the Signals at 20%, 20%, 20%, 20%, 13%, and 7% weights, respectively, and is again z-scored and truncated. The Value Factor is a composite of the following 5 Signals: Book to Price, **Cash Flow Yield**, Time Series Normalized **Cash Flow Yield**, Dividend Yield and Earnings Yield.  Boo...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] Istoxx Index Guide (PDF)
> e z-scored using the Parent Index weights and outliers are truncated at +/- 3 standard deviations. The Quality Factor combines the Signals at 25%, 25%, 25%, and 25% weights, respectively, and is again z-scored and truncated. The Value Factor is a composite of the following 4 Signals: Book to Price, **Cash Flow Yield**, Time Series Normalized **Cash Flow Yield**, and Earnings Yield. Book to Price is giv...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

> [!quote] STOXX Equity Factor Indices | STOXX
> ental signals including carbon emissions intensity and science-based targets, both as reported by the Institutional Shareholder Services group of companies. Value The value score is calculated from the following current book value to price ratio, 12-month trailing dividend yield, earnings yield and **cash flow yield** (i.e., cash flow divided by the full market capitalization), and time series norm...
> — [STOXX Equity Factor Indices | STOXX](https://stoxx.com/solutions/stoxx-equity-factor-indices) — "WHITEPAPER"

**Sources:**
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
- [STOXX Equity Factor Indices | STOXX](https://stoxx.com/solutions/stoxx-equity-factor-indices) — "WHITEPAPER"

---

### Compound Annual Growth Rate (CAGR)

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="7 mentions across STOXX & ISS pages (low)">▰▰ 7</span>


> The constant annual rate of return that would take an investment from its beginning value to its ending value over a specified period, assuming profits are reinvested. It smooths out year-to-year volatility into a single annualized figure.

CAGR is the go-to metric for comparing growth rates across different time horizons. Unlike simple average returns, it accounts for compounding and gives the true geometric growth rate.

$$
\text{CAGR} = \left(\frac{V_{\text{end}}}{V_{\text{begin}}}\right)^{\frac{1}{n}} - 1
$$

Where $V_{\text{begin}}$ and $V_{\text{end}}$ are the starting and ending values, and $n$ is the number of years.

> [!tip] Related terms
> [[#Annualized Return]], [[#Total Return]]




> [!quote] Monthly Index News April 2024 (PDF)
> investment exclusions and also integrates companies’ ESG scores into the stock selection, replacing controversial companies and the least sustainable ones with peers from the same ICB Supersector group. Figure 1: EURO STOXX 50 ESG derivatives volume Source: STOXX, Eurex. Only roll months are shown. **Compound annual growth rate** is based on total annual volume per year. Just this year the evolutio...
> — [Monthly Index News April 2024 (PDF)](https://stoxx.com/monthly-index-news-april-2024)

> [!quote] Q&amp;A with Invesco: Modernizing thematic strategies in fast-changing techno...
> etite for exposure to longer-term, secular trends is growing. And they have recognized that, in order to get exposure to those trends, you must cross over multiple sectors and industries. So, yes, we are seeing more demand for focused themes rather than sector-based allocations. We see very healthy compound annual growth rates in thematics.” Brett: “We are approaching the crossing point where a...
> — [Q&amp;A with Invesco: Modernizing thematic strategies in fast-changing techno...](https://stoxx.com/qa-with-invesco-modernizing-thematic-strategies-in-fast-changing-technology-segments) — "WHITEPAPER"

> [!quote] Western Union (PDF)
> ce-based stock vests based on achievement during performance metrics/goals period of:  Compound annual constant currency growth rate for revenue, measured against 2011 revenue (34% weighting)  Compound annual constant currency growth rate for EBITDA, measured against 2011 EBITDA (33% weighting)  **Compound annual growth rate** for registered customers, measured against 2011 registered customers ...
> — [Western Union (PDF)](https://www.issgovernance.com/file/2013/02/western_union.pdf)

> [!quote] ISS Market Intelligence Releases Annual 529 Industry Analysis Report | ISS
> ustry assets continue to grow, totaling $346.3 billion at the close of 2019, according to ISS Market Intelligence data. When comparing today’s 529 savings plan asset levels to those of 11 years ago ($88.5 billion in 2008), the growth is marked, representing a 391 percent increase, or a 13.2 percent **compound annual growth rate (CAGR)**. The main driver of this growth has been annual net inflows, w...
> — [ISS Market Intelligence Releases Annual 529 Industry Analysis Report | ISS](https://www.issgovernance.com/iss-market-intelligence-releases-annual-529-industry-analysis-report) — "ISS Market Intelligence Releases Annual 529 Industry Analysis Report"

> [!quote] B.R.AI.N. Index Tracks Disruptive Technologies | Blog posts | STOXX
> ives. In Biotechnology, biological processes and engineering techniques are combined to develop new technologies and products that can improve lives. Biotechnology is now extensively used in the medical industry, biofuels and agribiotech. The global Robotics market is expected to boost revenue at a **compound annual growth rate** of 16% between 2017 and 2025, to $154 billion.1 Lower costs and incre...
> — [B.R.AI.N. Index Tracks Disruptive Technologies | Blog posts | STOXX](https://stoxx.com/b-r-ai-n-index-tracks-disruptive-technologies) — "WHITEPAPER"

**Sources:**
- [Monthly Index News April 2024 (PDF)](https://stoxx.com/monthly-index-news-april-2024)
- [Q&amp;A with Invesco: Modernizing thematic strategies in fast-changing technology segments | Blog posts | STOXX](https://stoxx.com/qa-with-invesco-modernizing-thematic-strategies-in-fast-changing-technology-segments) — "WHITEPAPER"
- [Western Union (PDF)](https://www.issgovernance.com/file/2013/02/western_union.pdf)
- [ISS Market Intelligence Releases Annual 529 Industry Analysis Report | ISS](https://www.issgovernance.com/iss-market-intelligence-releases-annual-529-industry-analysis-report) — "ISS Market Intelligence Releases Annual 529 Industry Analysis Report"
- [B.R.AI.N. Index Tracks Disruptive Technologies | Blog posts | STOXX](https://stoxx.com/b-r-ai-n-index-tracks-disruptive-technologies) — "WHITEPAPER"

---

### Correlation

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="458 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 458</span>


> A statistical measure that quantifies the strength and direction of the linear relationship between two variables' returns, ranging from -1 (perfect negative) to +1 (perfect positive). A value of 0 indicates no linear relationship.

Correlation tells you whether two assets tend to move together, apart, or independently. It is a cornerstone of portfolio construction: combining assets with low or negative correlation reduces overall portfolio risk.

$$
\rho_{X,Y} = \frac{\text{Cov}(X, Y)}{\sigma_X \cdot \sigma_Y}
$$

> [!tip] Related terms
> [[#Covariance]], [[#Beta]], [[#Volatility]], [[#Standard Deviation]]




> [!quote] STOXX Factor and STOXX ESG-X Factor Indices Q2 Spotlight – Mixed Performance,...
> as defined by Market Sensitivity and Residual Volatility in the Axioma Risk Model), and Value and Size exposures acted as a drag on both methods. However, the accumulated exposure to Other Factors (primarily Industries) can account for the bulk of the Mixed portfolio’s underperformance. Spotlight – **correlation**s As we noted in our Q1 post, the COVID-19 crisis caused cross-asset **correlation**s to i...
> — [STOXX Factor and STOXX ESG-X Factor Indices Q2 Spotlight – Mixed Performance,...](https://stoxx.com/stoxx-factor-and-stoxx-esg-x-factor-indices-q2-spotlight-mixed-performance-strong-exposures-and-rebounding-correlations) — "WHITEPAPER"

> [!quote] 15 years of STOXX Thematic indices: What the track record shows | Blog posts ...
> in the long term but rebounded strongly on a relative basis in 2025. Figure 2: Thematic categories’ returns Individual performance Figure 3 shows the performance over the four different periods considered, for all STOXX Thematic indices with 10-year data history. Figure 3: Index returns by category **Correlation**s Beyond returns, **correlation** with broader benchmarks is a key consideration for many ...
> — [15 years of STOXX Thematic indices: What the track record shows | Blog posts ...](https://stoxx.com/15-years-of-stoxx-thematic-indices-what-the-track-record-shows) — "WHITEPAPER"

> [!quote] Green efficient frontiers: Minimizing the risk impact of exclusions in sustai...
> that the optimized portfolio ends up with fewer constituents and a slightly lower representation of the parent index’s weights than does the standard exclusions-only portfolio. These differences, however, were small considering the improvement in active risk. As they explain, the optimizer exploits **correlation**s between different risk model components (such as specific industries) and excluded s...
> — [Green efficient frontiers: Minimizing the risk impact of exclusions in sustai...](https://stoxx.com/green-efficient-frontiers-minimizing-the-risk-impact-of-exclusions-in-sustainable-portfolios) — "WHITEPAPER"

> [!quote] Public Fund Us Policy Updates (PDF)
> ximately 140 basis points (1.4 percent).8 Error! Bookmark not defined. As highlighted a **correlation** exists between company performance and overboarding. Various scenarios of director overboarding were evaluated against Economic Value Added's (EVA) Margin & Momentum, ISS' proprietary measures; and a **correlation** was found between overboarding and economic under performance. This correlation could...
> — [Public Fund Us Policy Updates (PDF)](https://www.issgovernance.com/file/policy/2021/specialty/Public-Fund-US-Policy-Updates.pdf)

> [!quote] Monthly Index News April 2021 (PDF)
> across their entire expiration curve. The V-VSTOXX measures the implied volatility of options on VSTOXX futures, hence reflecting expectations regarding the volatility of volatility. All three are significantly lower than their March 2020 peaks. The three measures showed a relatively high negative **correlation** to the underlying stock market in April. Risk and Return Characteristics Index Level C...
> — [Monthly Index News April 2021 (PDF)](https://stoxx.com/monthly-index-news-april-2021)

**Sources:**
- [STOXX Factor and STOXX ESG-X Factor Indices Q2 Spotlight – Mixed Performance, Strong Exposures and Rebounding Correlations | STOXX](https://stoxx.com/stoxx-factor-and-stoxx-esg-x-factor-indices-q2-spotlight-mixed-performance-strong-exposures-and-rebounding-correlations) — "WHITEPAPER"
- [15 years of STOXX Thematic indices: What the track record shows | Blog posts | STOXX](https://stoxx.com/15-years-of-stoxx-thematic-indices-what-the-track-record-shows) — "WHITEPAPER"
- [Green efficient frontiers: Minimizing the risk impact of exclusions in sustainable portfolios | Blog posts | STOXX](https://stoxx.com/green-efficient-frontiers-minimizing-the-risk-impact-of-exclusions-in-sustainable-portfolios) — "WHITEPAPER"
- [Public Fund Us Policy Updates (PDF)](https://www.issgovernance.com/file/policy/2021/specialty/Public-Fund-US-Policy-Updates.pdf)
- [Monthly Index News April 2021 (PDF)](https://stoxx.com/monthly-index-news-april-2021)

---

### Covariance

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="63 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 63</span>


> A measure of the joint variability of two random variables. In finance, it quantifies how the returns of two assets move together. Positive covariance means they tend to move in the same direction; negative means opposite directions.

Covariance is the raw building block behind both correlation and beta. While its absolute magnitude is hard to interpret (it depends on the scale of returns), it feeds directly into portfolio variance calculations and the Capital Asset Pricing Model.

$$
\text{Cov}(X, Y) = \frac{1}{n-1}\sum_{t=1}^{n}(X_t - \bar{X})(Y_t - \bar{Y})
$$

> [!tip] Related terms
> [[#Correlation]], [[#Beta]], [[#Standard Deviation]], [[#Factor Exposure]]




> [!quote] Dax Equity Index Methodology Guide 5526498614 (PDF)
> lculated as follows, based on the returns that were calculated in Step 1 for all DAX constituents: 𝐻𝑇 1 2 𝜎 =√𝐻𝑇⋅ ∑(𝜆 −𝜆)) 𝑖 𝐻𝑇−1 𝑖𝑘 𝑖 𝑘=1 where: 𝜎 = standard deviation of share i =1, …, 40 𝑖 𝜆 = average yield of share i =1, …, 40 𝑖 𝐻𝑇 1 𝐶𝑜𝑣 =𝐻𝑇⋅ ∑(𝜆 −𝜆)⋅(𝜆 −𝜆) i,j 𝐻𝑇−1 𝑖𝑘 𝑖 𝑗𝑘 𝑗 𝑘=1 whereby: 𝐶𝑜𝑣 = **covariance**17 of share 𝑖=1,…,40 to share 𝑗=1,…,40 i,j Step 3) The optimized portfolio weights can ...
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)

> [!quote] Istoxx Index Guide (PDF)
> iSTOXX® METHODOLOGY GUIDE 803/1024 110. iSTOXX APG WORLD-X AND RESPONSIBLE MINIMUM VOLATILITY INDICES w = Index weights B = Exposure matrix, its elements denote each asset’s exposure/loading to a particular factor V = Factor **covariance** matrix from Axioma Risk Model ∆2 = Specific variance matrix from Axioma Risk Model 𝜆 , 𝜆 = Factor Weight and Specific Weight in the **covariance** matrix. 𝜆 = 1, 𝜆 =...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

> [!quote] Stoxx Minvar Paper (PDF)
> of estimating the **covariance** of a portfolio: simple historical **covariance** or using a factor model. Using the historical covariance approach, if we take the STOXX Global 1800 portfolio as an example, we need to create a matrix, C, of size 1,800 by 1,800, which shows the 1,618,200 different pairwise covariances: 𝑃𝑜𝑟𝑡𝑓𝑜𝑙𝑖𝑜 𝑉𝑎𝑟𝑖𝑎𝑛𝑐𝑒 = 𝑤′𝐶𝑤 Where w is the vector of weights. This is a huge number of ...
> — [Stoxx Minvar Paper (PDF)](http://www.stoxx.com/document/Others/marketing/STOXX_MinVar_Paper.pdf)

> [!quote] Axioma Multi Asset Class Risk Monitor (PDF)
> ent of the overall portfolio. Standard Deviation (Weighted) is standalone volatility multiplied with the bucket weight; it implicitly assumes perfect correlation between categories and does not take diversification effects from other asset classes into account. Standard Deviation Contribution takes **covariance**s into account and contributions add up to total risk. page 5
> — [Axioma Multi Asset Class Risk Monitor (PDF)](https://stoxx.com/axioma-multi-asset-class-risk-monitor)

> [!quote] Dispersion Trading in Focus: Q&amp;A with Optiver and Ellipsis AM | Blog post...
> sion (VolSwap or VarSwap) and listed dispersion. In Europe, OTC dispersion is mainly traded in VolSwap. Because the VolSwap payoff can’t be replicated with listed options, it’s really not the same expected return.” Anand: “Indeed, when you are trading listed dispersion, you are mainly looking for a **covariance** move, i.e.,not only a correlation move. You are looking for really important moves on ...
> — [Dispersion Trading in Focus: Q&amp;A with Optiver and Ellipsis AM | Blog post...](https://stoxx.com/dispersion-trading-in-focus-with-optiver-and-ellipsis) — "WHITEPAPER"

**Sources:**
- [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
- [Stoxx Minvar Paper (PDF)](http://www.stoxx.com/document/Others/marketing/STOXX_MinVar_Paper.pdf)
- [Axioma Multi Asset Class Risk Monitor (PDF)](https://stoxx.com/axioma-multi-asset-class-risk-monitor)
- [Dispersion Trading in Focus: Q&amp;A with Optiver and Ellipsis AM | Blog posts | STOXX](https://stoxx.com/dispersion-trading-in-focus-with-optiver-and-ellipsis) — "WHITEPAPER"

---

### Current Ratio

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="2 mentions across STOXX & ISS pages (ultra-low)">▰ 2</span>


> The ratio of a company's current assets to its current liabilities, measuring its ability to pay short-term obligations due within one year. It is a fundamental liquidity metric used in credit screening and quality factor construction.

The current ratio answers: "Can this company cover its near-term bills with the assets it could readily convert to cash?" A ratio above 1.0 means current assets exceed current liabilities; below 1.0 signals potential liquidity stress.

$$
\text{Current Ratio} = \frac{\text{Current Assets}}{\text{Current Liabilities}}
$$

> [!tip] Related terms
> [[#Debt-to-Equity Ratio]], [[#Free Cash Flow (FCF)]], [[#Gross Profitability]]




> [!quote] Istoxx Index Guide (PDF)
> iSTOXX® METHODOLOGY GUIDE 76/1024 8. iSTOXX QUALITY INCOME INDICES - Positive or zero 1-year growth in Liquidity Ratio (1YΔLR). The LR is calculated as the ratio of current assets to current liabilities (also called **current ratio**) 1YΔLR =**current ratio** −current ratio t0 t0 t−1 - 1-year growth in the Number of Shares Outstanding (1YΔNBO) less than or equal to 5%7. number of shares outstanding 1YΔ...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

> [!quote] Stoxx Digital Asset Guide (PDF)
> l Information and Transparency: This set of criteria measures the financial health of an exchange. Primary criteria here include: checking the willingness and frequency to provide up-to-date financial statements, adhering to financial requirements (such as profitability, leverage ratio, cash ratio, **current ratio** and debt to equity ratio) and the auditing of financial statements. Transparency cr...
> — [Stoxx Digital Asset Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_digital_asset_guide.pdf)

**Sources:**
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
- [Stoxx Digital Asset Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_digital_asset_guide.pdf)

---

## D

### Debt-to-Equity Ratio

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="72 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 72</span>


> The ratio of a company's total debt to its total shareholders' equity. It measures financial leverage, indicating how much of the company's capital structure is financed by creditors versus owners.

Debt-to-equity is one of the most watched leverage gauges. A high ratio means the company relies heavily on borrowed money, which amplifies both gains and losses. STOXX and ISS use it in quality screening and ESG risk assessment.

$$
\text{D/E} = \frac{\text{Total Debt}}{\text{Total Shareholders' Equity}}
$$

> [!tip] Related terms
> [[#Current Ratio]], [[#Enterprise Value (EV)]], [[#EBITDA]]




> [!quote] 2015 Taft Hartley Advisory Services International Guidelines (PDF)
> ally attached to a debt issuance in order to enhance the marketability of the accompanying fixed income security. When evaluating a debt issuance request, Taft-Hartley Advisory Services examines the issuing company’s present financial situation. The main factor for analysis is the company’s current **debt-to-equity ratio**, or gearing level. A high gearing level may incline markets and financial an...
> — [2015 Taft Hartley Advisory Services International Guidelines (PDF)](https://www.issgovernance.com/file/policy/2015-taft-hartley-advisory-services-international-guidelines.pdf)

> [!quote] Hong Kong Voting Guidelines (PDF)
> this limit is therefore legally required. ISS’ analysis of borrowing power increase requests takes into account management's stated need for the increase, the size of the increase, and the company's current gearing level. Large increases in borrowing powers can sometimes result in dangerously high **debt-to-equity ratio**s that could harm shareholder value. If no information regarding the limit on ...
> — [Hong Kong Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2022/asiapacific/Hong-Kong-Voting-Guidelines.pdf)

> [!quote] Hong Kong Voting Guidelines (PDF)
> n addition to the above criteria, we will oppose such proposal if it could result in a potentially excessive increase in debt. A potential increase in debt may be considered excessive when: › The proposed maximum amount is more than twice the company's total debt; › It could result in the company's **debt-to-equity ratio** exceeding 300 percent (for non-financial companies); and › The maximum hypot...
> — [Hong Kong Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2018/asiapacific/Hong-Kong-Voting-Guidelines.pdf)

> [!quote] Asia Pacific Policy Updates (PDF)
> he potential increase in debt is considered excessive: the potential increase in debt is considered excessive: › The proposed maximum amount is more than twice the company's total › The proposed maximum amount is more than twice the company's total debt; debt; › It could result in the company's net **debt-to-equity ratio**, or gearing level, › It could result in the company's **debt-to-equity ratio**, ...
> — [Asia Pacific Policy Updates (PDF)](https://www.issgovernance.com/file/policy/2018/updates/Asia-Pacific-Policy-Updates.pdf)

> [!quote] India2014Votingrecommendations Final (PDF)
> rn regarding the terms and conditions of the debt. For non-financial companies, the following criteria are used to assess whether the potential increase in debt is considered excessive:  The proposed maximum amount is more than twice the company's total debt;  It could result in the company's net **debt-to-equity ratio**, or gearing level, exceeding 300 percent; and  The maximum hypothetical deb...
> — [India2014Votingrecommendations Final (PDF)](https://www.issgovernance.com/file/2014_Policies/India2014VotingRecommendations_FINAL.pdf)

**Sources:**
- [2015 Taft Hartley Advisory Services International Guidelines (PDF)](https://www.issgovernance.com/file/policy/2015-taft-hartley-advisory-services-international-guidelines.pdf)
- [Hong Kong Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2022/asiapacific/Hong-Kong-Voting-Guidelines.pdf)
- [Hong Kong Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2018/asiapacific/Hong-Kong-Voting-Guidelines.pdf)
- [Asia Pacific Policy Updates (PDF)](https://www.issgovernance.com/file/policy/2018/updates/Asia-Pacific-Policy-Updates.pdf)
- [India2014Votingrecommendations Final (PDF)](https://www.issgovernance.com/file/2014_Policies/India2014VotingRecommendations_FINAL.pdf)

---

### Dividend Yield

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="822 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 822</span>


> The annual dividends paid per share divided by the share price, expressed as a percentage. In index methodology, it typically refers to the indicated (forward-looking) annual dividend.

Dividend yield shows the percentage income return you earn from owning a stock at today's price, ignoring any capital gains. It is a core input for STOXX's dividend-weighted and high-dividend indices.

$$
\text{Dividend Yield} = \frac{\text{Annual Dividends per Share}}{\text{Price per Share}} \times 100\%
$$

> [!tip] Related terms
> [[#Total Return]], [[#Net Return]], [[#Gross Return]], [[#Earnings Yield]]




> [!quote] Global X ETFs Europe, STOXX launch first EURO STOXX 50 covered call ETF | Blo...
> g in flat to falling markets. The ETF launch comes as European stocks have rallied this year but suffered heightened volatility — and losses — in March and April amid a global markets pullback. Figure 1 shows how the income generated by a covered call strategy on the EURO STOXX 50 compares with the **dividend yield** on the index. The former can be several times higher, depending on the period. Fig...
> — [Global X ETFs Europe, STOXX launch first EURO STOXX 50 covered call ETF | Blo...](https://stoxx.com/global-x-etfs-europe-stoxx-launch-first-euro-stoxx-50-covered-call-etf) — "WHITEPAPER"

> [!quote] Istoxx Index Guide (PDF)
> iSTOXX® METHODOLOGY GUIDE 98/1024 9. DECREMENT INDICES (PERFORMANCE DEDUCTIONS) w target weight of component (i) i N number of constituents dy trailing 12-month gross **dividend yield** of component (i) as of review cut-off date. i If a company has a **dividend yield** of 0 or missing, it is attributed the lowest non- zero dividend yield among all selected components in order to calculate its weight We...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

> [!quote] Us Executive Compensation Policies Faq (PDF)
> S Stock Price Proxy E Exercise Price Proxy Historical three-year stock price volatility measured on a daily basis from the date of grant. If a company has not been publicly traded σ Volatility XpressFeed for at least three years, ISS measures volatility from the IPO date through grant date. Average **dividend yield** over five years. If a company has not been publicly traded for at least five years...
> — [Us Executive Compensation Policies Faq (PDF)](https://www.issgovernance.com/file/policy/latest/americas/US-Executive-Compensation-Policies-FAQ.pdf)

> [!quote] Dax Equity Index Methodology Guide 5526498614 (PDF)
> DAX EQUITY INDEX METHODOLOGY GUIDE 71/120 9. DAX DIVIDEND INDICES 9.1. DIVDAX AND DIVMSDAX 9.1.1. OVERVIEW The DivDAX and DivMSDAX are constructed using the **dividend yield** as the selection criterion. The DivDAX comprises the 15 companies with the highest **dividend yield**s in the DAX, the German blue- chip index, while the DivMSDAX is based on companies included in the MDAX and SDAX. Universe: Div...
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)

> [!quote] Product Brief Stoxx Global Ai Infastructure Index (PDF)
> 20.6 20.6 3.0 2.4 1.8 14.6 Source: STOXX. Number of High Quality Patents in AI sub-themes 5,000 4,661 4,000 3,000 2,000 1,000 1,515 644 0 AI in Semiconductor/GPU HQ Patents AI in Cloud HQ Patents AI in Big Data HQ Patents Source: EconSight. 5 Based on the composition as of September 30, 2024. 6Net **dividend yield** is calculated as net return index return minus price index return. STOXX Ltd. (“STO...
> — [Product Brief Stoxx Global Ai Infastructure Index (PDF)](https://stoxx.com/wp-content/uploads/2023/11/Product-brief-STOXX-Global-AI-Infastructure-Index.pdf)

**Sources:**
- [Global X ETFs Europe, STOXX launch first EURO STOXX 50 covered call ETF | Blog posts | STOXX](https://stoxx.com/global-x-etfs-europe-stoxx-launch-first-euro-stoxx-50-covered-call-etf) — "WHITEPAPER"
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
- [Us Executive Compensation Policies Faq (PDF)](https://www.issgovernance.com/file/policy/latest/americas/US-Executive-Compensation-Policies-FAQ.pdf)
- [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
- [Product Brief Stoxx Global Ai Infastructure Index (PDF)](https://stoxx.com/wp-content/uploads/2023/11/Product-brief-STOXX-Global-AI-Infastructure-Index.pdf)

---

### Duration (Bond)

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="948 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 948</span>


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




> [!quote] Dax Esg Equity Family Benchmark Statement (PDF)
> e benchmarks under Regulation (EU) 2016/1011; 5.2 Way of Art. 5(b) RTS a statement indicating how users will be Not applicable. information of any informed of any delay in the publication of delay in publication the benchmark or of any re-determination of the benchmark and indicating the (expected) **duration** of measures. Copyright © 2025 STOXX Ltd. 17
> — [Dax Esg Equity Family Benchmark Statement (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Resources/Regulation/DAX_ESG_Equity_Family_Benchmark_Statement.pdf)

> [!quote] Meridian Compensation Partners (PDF)
> l transfer of shareholder value to employees and other plan participants and, hence, is the category with the greatest direct impact on shareholders. Therefore, we recommend that this category be assigned the greatest weight. Grant 30% A number of Grant Practices factors (e.g., burn rate, estimated **duration** of Practices the share pool) provide important data on actual and projected transfer of ...
> — [Meridian Compensation Partners (PDF)](https://www.issgovernance.com/file/policy/Meridian_Compensation_Partners.pdf)

> [!quote] Japan Voting Guidelines (PDF)
> ning of procedures for removing a director from office; ▪ The company posts its proxy circular on the stock exchange website at least four weeks prior to the meeting, to give shareholders sufficient time to study the details of the proposal and question management about them; and ▪ The pill’s total duration12 does not exceed three years. (Second stage of analysis, to be applied only when all ne...
> — [Japan Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2022/asiapacific/Japan-Voting-Guidelines.pdf)

> [!quote] Catholic Faith Based International Policy Updates (PDF)
> pear in remuneration policies giving investors the necessary framework to assess the role and actions of the remuneration committee and/or board. 1 Termination payments' means any payment linked to early termination of contracts for executive or managing directors, including payments related to the **duration** of a notice period or a non-competition clause included in the contract. 2 In cases wher...
> — [Catholic Faith Based International Policy Updates (PDF)](https://www.issgovernance.com/file/policy/2020/specialty/Catholic-Faith-Based-International-Policy-Updates.pdf)

> [!quote] Canada Tsx Voting Guidelines (PDF)
> CANADA TSX-LISTED COMPANIES PROXY VOTING GUIDELINES ▪ Misapplication of applicable accounting standards; or ▪ Material weaknesses identified in the internal control process. Severity, breadth, chronological sequence and **duration**, as well as the company's efforts at remediation or corrective actions, will be examined in determining whether withhold votes are warranted. Rationale: The policy addr...
> — [Canada Tsx Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2020/americas/Canada-TSX-Voting-Guidelines.pdf)

**Sources:**
- [Dax Esg Equity Family Benchmark Statement (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Resources/Regulation/DAX_ESG_Equity_Family_Benchmark_Statement.pdf)
- [Meridian Compensation Partners (PDF)](https://www.issgovernance.com/file/policy/Meridian_Compensation_Partners.pdf)
- [Japan Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2022/asiapacific/Japan-Voting-Guidelines.pdf)
- [Catholic Faith Based International Policy Updates (PDF)](https://www.issgovernance.com/file/policy/2020/specialty/Catholic-Faith-Based-International-Policy-Updates.pdf)
- [Canada Tsx Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2020/americas/Canada-TSX-Voting-Guidelines.pdf)

---

### Drawdown

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="68 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 68</span>


> The peak-to-trough decline of an investment or index, measured from the highest value to the subsequent lowest value before a new peak is established. Drawdown is expressed as a percentage loss.

Drawdown captures how far an investment fell from its best point before recovering. It answers the question: "If I bought at the worst time, how bad would the ride down have been?"

$$
D(t) = \frac{V(t) - V_{\text{peak}}}{V_{\text{peak}}}
$$

Where $V(t)$ is the value at time $t$ and $V_{\text{peak}}$ is the highest value prior to $t$.

> [!tip] Related terms
> [[#Maximum Drawdown]], [[#Volatility]], [[#Value at Risk (VaR)]]




> [!quote] August market turmoil highlights benefit of dynamic volatility allocation  | ...
> STOXX 50 Volatility-Balanced index For example, the EURO STOXX 50 Volatility-Balanced index moved to an ‘unpredicted volatility regime’ on July 29 this year, lifting the allocation to VSTOXX futures to 10%. It raised that exposure to 20% on August 1 and then to 30% a day later. The effect of large **drawdown**s Of course, having a 2.5% volatility hedge during stable and/or bull markets is a drag on...
> — [August market turmoil highlights benefit of dynamic volatility allocation  | ...](https://stoxx.com/august-market-turmoil-highlights-benefit-of-dynamic-volatility-allocation) — "WHITEPAPER"

> [!quote] The Power of Factor Diversification | Blog posts | STOXX
> otential of systematic factor investing, Figure 2 highlights two important measures of a portfolio’s risk profile. The left panel shows the underperformance probability of each factor and the Multi Premia portfolio vis-à-vis the benchmark, over a one-year period. The right panel tracks the relative **drawdown**, which measures the maximum loss an investor has faced relative to the benchmark. The Mu...
> — [The Power of Factor Diversification | Blog posts | STOXX](https://stoxx.com/the-power-of-factor-diversification) — "WHITEPAPER"

> [!quote] DAX covered call ETF launched in new Global X ETFs Europe, STOXX collaboratio...
> investors the opportunity to stay exposed to German equities while potentially generating steady income in a challenging market environment.” Other benefits of covered call strategies may include correlation reduction, diversification, risk mitigation and regular income distributions. Hedge against **drawdown**s Figure 1 shows the performance of the DAX and DAX Covered Call ATM indices since the st...
> — [DAX covered call ETF launched in new Global X ETFs Europe, STOXX collaboratio...](https://stoxx.com/dax-covered-call-etf-launched-in-new-global-x-etfs-europe-stoxx-collaboration) — "WHITEPAPER"

> [!quote] Stoxx Minvar Paper (PDF)
> PING A BETA OF 1. 350 300 250 200 150 100 50 0 Jan-04 Jan-05 Jan-06 Jan-07 Jan-08 Jan-09 Jan-10 Jan-11 Jan-12 Jan-13 Jan-14 Jan-15 Jan-16 STOXX Global 1800 Composite Portfolio Key figures STOXX Global 1800 Composite portfolio Return (annualized) 7.4% 8.8% Volatility (annualized) 15.4% 12.4% Maximum **drawdown** 53.7% 49.2% Return/volatility 0.48 0.71 Source: STOXX daily data from Jan. 2, 2004 to Ju...
> — [Stoxx Minvar Paper (PDF)](http://www.stoxx.com/document/Others/marketing/STOXX_MinVar_Paper.pdf)

> [!quote] Stoxx Research   Euro Stoxx 50%C2%Ae Esg   Integrating Sustainability (Septem... (PDF)
> 11% 5.29% 3y return 10.32% 9.47% 9.53% 1y return 8.98% 8.63% 8.74% volatility since inception 17.85% 17.85% 17.71% 5y volatility 17.92% 17.86% 17.80% 3y volatility 12.55% 12.45% 12.38% 1y volatility 14.08% 13.89% 13.96% Sharpe ratio since inception 0.55 0.54 0.55 5y Sharpe ratio 0.39 0.37 0.38 Max. **drawdown** since inception –27.82% –27.64% –27.14% 5y max. **drawdown** –27.82% –27.64% –27.14% Trackin...
> — [Stoxx Research   Euro Stoxx 50%C2%Ae Esg   Integrating Sustainability (Septem... (PDF)](https://www.stoxx.com/document/Research/STOXX%20Research%20-%20EURO%20STOXX%2050%C2%AE%20ESG%20-%20Integrating%20Sustainability%20(September%202019).pdf)

**Sources:**
- [August market turmoil highlights benefit of dynamic volatility allocation  | Blog posts | STOXX](https://stoxx.com/august-market-turmoil-highlights-benefit-of-dynamic-volatility-allocation) — "WHITEPAPER"
- [The Power of Factor Diversification | Blog posts | STOXX](https://stoxx.com/the-power-of-factor-diversification) — "WHITEPAPER"
- [DAX covered call ETF launched in new Global X ETFs Europe, STOXX collaboration | Blog posts | STOXX](https://stoxx.com/dax-covered-call-etf-launched-in-new-global-x-etfs-europe-stoxx-collaboration) — "WHITEPAPER"
- [Stoxx Minvar Paper (PDF)](http://www.stoxx.com/document/Others/marketing/STOXX_MinVar_Paper.pdf)
- [Stoxx Research   Euro Stoxx 50%C2%Ae Esg   Integrating Sustainability (September 2019) (PDF)](https://www.stoxx.com/document/Research/STOXX%20Research%20-%20EURO%20STOXX%2050%C2%AE%20ESG%20-%20Integrating%20Sustainability%20(September%202019).pdf)

---

## E

### Earnings Per Share (EPS)

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="81 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 81</span>


> The portion of a company's net income allocated to each outstanding share of common stock. It is the most widely used single measure of corporate profitability and serves as the denominator of the P/E ratio.

EPS is the bottom-line number that drives most valuation conversations. When analysts say a company "beat earnings," they typically mean actual EPS exceeded the consensus forecast. STOXX uses EPS in value/growth style classification.

$$
\text{EPS} = \frac{\text{Net Income} - \text{Preferred Dividends}}{\text{Weighted Average Shares Outstanding}}
$$

> [!tip] Related terms
> [[#Net Income]], [[#Price-to-Earnings Ratio]], [[#Earnings Yield]], [[#PEG Ratio]]




> [!quote] Stoxx Index Guide (PDF)
> ble. » Payout ratio of less than or equal to 60% (applies quarterly for non-components only). Alternative thresholds may apply for specified regions when mentioned in the following section. DPS Payout ratio= (cid:2919) EPS (cid:2919) DPS i = indicated annualized gross Dividend per Share (i) EPS i = **Earnings per Share** (i) 28 » Non-negative payout ratio using the prior stated payout ratio formula...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] Australia Voting Guidelines (PDF)
> efits; ▪ Whether there is sufficient capacity within the previously approved aggregate fee cap to accommodate any proposed increases in director's fees; ▪ The company’s absolute and relative performance over (at least) the past three years based on measures such as (but not limited to) share price, **earnings per share** and return on capital employed; ▪ The company’s policy and practices on non-ex...
> — [Australia Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2022/asiapacific/Australia-Voting-Guidelines.pdf)

> [!quote] Public Fund Us Voting Guidelines (PDF)
> equity, outstanding warrants, or debt The formula can be applied as follows: A + B + C A + B + C + D Fair Market Value, Dilution and Repricing Consideration will be made as to whether the proposed plan is being offered at fair market value or at a discount; whether the plan excessively dilutes the **earnings per share** of the outstanding shares; and whether the plan gives management the ability to...
> — [Public Fund Us Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2021/specialty/Public-Fund-US-Voting-Guidelines.pdf)

> [!quote] Istoxx Index Guide (PDF)
> l Health rank (FHR) and Business Stability rank (BSR) between 0.2 and 1. The combined rank is calculated as: (FHR + BSR) / 2 » All stocks having a gross dividend yield of 30% or below » All stocks having the inverse of the payout ratio of 1 or above. The inverse of the payout ratio is calculated as **earnings per share (EPS)** divided by gross dividend per share (DPS 15 WSPIT Item number 09402 - Di...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

> [!quote] Australia New Zealand Policy Updates (PDF)
> avourably by many shareholders compared to a hurdle that specifies an favourably by many shareholders compared to a hurdle that specifies an absolute share price target or an insufficient accounting measure of absolute share price target or an insufficient accounting measure of performance (such as **earnings per share (EPS)**). performance (such as **earnings per share (EPS)**). › Where a relative hur...
> — [Australia New Zealand Policy Updates (PDF)](https://www.issgovernance.com/file/policy/2018/updates/Australia-New-Zealand-Policy-Updates.pdf)

**Sources:**
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [Australia Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2022/asiapacific/Australia-Voting-Guidelines.pdf)
- [Public Fund Us Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2021/specialty/Public-Fund-US-Voting-Guidelines.pdf)
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
- [Australia New Zealand Policy Updates (PDF)](https://www.issgovernance.com/file/policy/2018/updates/Australia-New-Zealand-Policy-Updates.pdf)

---

### Earnings Yield

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="37 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 37</span>


> The ratio of earnings per share to the current share price, equivalent to the inverse of the price-to-earnings ratio. Used as a value factor in STOXX and ISS index construction.

Earnings yield expresses how much profit a company generates for every dollar of its stock price. It flips the familiar P/E ratio to make comparisons with bond yields more intuitive.

$$
\text{Earnings Yield} = \frac{\text{EPS}}{\text{Price per Share}} = \frac{1}{\text{P/E}}
$$

> [!tip] Related terms
> [[#Price-to-Earnings Ratio]], [[#Cash Flow Yield]], [[#Book-to-Price Ratio]]




> [!quote] Stoxx Index Guide (PDF)
> Supersector. The Quality Factor combines the Signals at 20%, 20%, 20%, 20%, 13%, and 7% weights, respectively, and is again z-scored and truncated. The Value Factor is a composite of the following 5 Signals: Book to Price, Cash Flow Yield, Time Series Normalized Cash Flow Yield, Dividend Yield and **Earnings Yield**.  Book to Price is given by the latest book value divided by the total market capi...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] Istoxx Index Guide (PDF)
> iSTOXX® METHODOLOGY GUIDE 371/1024 24. iSTOXX DYNAMIC STYLE INDICES o B/P o Fwd S/P (left out for Financials) • **Earnings Yield** (Fwd E/P and Fwd EBITDA/EV) o Fwd E/P o Fwd EBITDA/EV (left out for Financials) • CF Yield (OCF/P and FCF/P) o OCF/P o FCF/P All raw valuation components (i.e. B/P, Fwd S/P, Fwd E/P, Fwd EBITDA/EV, OCF/P and FCF/P) are discretized in 25 equal sized buckets based on thei...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

> [!quote] Q&amp;A: UniCredit’s Kilian on ESG+Factor Strategies | Blog posts | STOXX
> the United Nations Global Compact principles or active in controversial weapons, tobacco, thermal coal and nuclear energy, are screened out, meeting the standard sustainable policies of investors. The multi-factor index seeks to diversify across the following sources of risk premia: profitability, **earnings yield**, leverage, value and low volatility. The EURO STOXX ESG-X & Ex Nuclear Power Minimu...
> — [Q&amp;A: UniCredit’s Kilian on ESG+Factor Strategies | Blog posts | STOXX](https://stoxx.com/qa-unicredits-kilian-on-esgfactor-strategies) — "WHITEPAPER"

> [!quote] Risky Stocks Are Getting Cheaper… But They Haven’t Reached 2008 Crisis Levels...
> nt valuation techniques and the accounting nuances behind these methodologies is most certainly beyond the scope of this commentary. Here we will conveniently rely on the corresponding Value factor index, where potentially undervalued stocks are identified using the Axioma Value (book-to-price) and **Earnings Yield** (both historical and analyst forecast) risk model factors. One additional advantag...
> — [Risky Stocks Are Getting Cheaper… But They Haven’t Reached 2008 Crisis Levels...](https://stoxx.com/risky-stocks-are-getting-cheaper-but-they-havent-reached-2008-crisis-levels-yet) — "WHITEPAPER"

> [!quote] When 40 is the New 30 – What DAX Gains Following Enlargement | Blog posts | S...
> itability and growth, but leans toward higher-volatility stocks than its original version. Exposures to **Earnings Yield** and Exchange Rate Sensitivity were small and negative for both DAX iterations, but they were slightly higher in magnitude following the DAX overhaul. The small negative exposure to **Earnings Yield** indicates that DAX (either with 30 or 40 components) contains stocks with lower ea...
> — [When 40 is the New 30 – What DAX Gains Following Enlargement | Blog posts | S...](https://stoxx.com/when-40-is-the-new-30-what-dax-gains-following-enlargement) — "WHITEPAPER"

**Sources:**
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
- [Q&amp;A: UniCredit’s Kilian on ESG+Factor Strategies | Blog posts | STOXX](https://stoxx.com/qa-unicredits-kilian-on-esgfactor-strategies) — "WHITEPAPER"
- [Risky Stocks Are Getting Cheaper… But They Haven’t Reached 2008 Crisis Levels — Yet | STOXX](https://stoxx.com/risky-stocks-are-getting-cheaper-but-they-havent-reached-2008-crisis-levels-yet) — "WHITEPAPER"
- [When 40 is the New 30 – What DAX Gains Following Enlargement | Blog posts | STOXX](https://stoxx.com/when-40-is-the-new-30-what-dax-gains-following-enlargement) — "WHITEPAPER"

---

### EBITDA

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="88 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 88</span>


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




> [!quote] ISS EVA Resource Center | ISS
> Part II) Drivers of Growth Finding The Investment Gems Introducing Best-Practice EVA Rightsizing the EVA Way in the COVID Economy Don’t Be Fooled by Earnings: Trust EVA A Case of Mistaken Identity ESG Matters Profitability Drives Value How EVA Can Enhance DCF and P/E Analysis: A Case Study EVA, not **EBITDA**: A Better Measure of Investment Value The Four Key EVA Performance Ratios Insights Into Va...
> — [ISS EVA Resource Center | ISS](https://www.issgovernance.com/eva/iss-eva-resource-center) — "ISS EVA"

> [!quote] Istoxx Index Guide (PDF)
> iSTOXX® METHODOLOGY GUIDE 371/1024 24. iSTOXX DYNAMIC STYLE INDICES o B/P o Fwd S/P (left out for Financials) • Earnings Yield (Fwd E/P and Fwd **EBITDA**/EV) o Fwd E/P o Fwd **EBITDA**/EV (left out for Financials) • CF Yield (OCF/P and FCF/P) o OCF/P o FCF/P All raw valuation components (i.e. B/P, Fwd S/P, Fwd E/P, Fwd EBITDA/EV, OCF/P and FCF/P) are discretized in 25 equal sized buckets based on thei...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

> [!quote] Ma Analysis (PDF)
> 6 23.4 B 4.8x 1.1x H/(L) Peer Median $ ( 3,282) 0.1x (14.1) (1.0) (4) notches 2.8x 0.5x Source: Bloomberg LP. Data as of 2/8/2013. Recycle Ratio measures the efficiency of turning a barrel of reserves into a barrel of production. More profitable companies have higher ratios relative to their peers. **EBITDA**X is **EBITDA** including exploration expense. BOE is Barrel of Oil Equivalent. Total Productio...
> — [Ma Analysis (PDF)](https://www.issgovernance.com/file/2013/02/MA_analysis.pdf)

> [!quote] 20181113 Generation Investment Management Llp (PDF)
> ng the data on which it is calculated is transparent and freely distributed  TSR is dependent on overall stock-market performance (mitigated if you consider relative TSR and not absolute TSR) and is not fully in the control of managers.  EVA is a useful metric and much better than metrics such as **EBITDA** or Adj. **EBITDA** (see question below)
> — [20181113 Generation Investment Management Llp (PDF)](https://www.issgovernance.com/file/policy/2019/comment/20181113_Generation_Investment_Management_LLP.pdf)

> [!quote] Pay For Performance Mechanics (PDF)
> ecently available QDD data applicable to the company’s next annual meeting. For more information on the EVA methodology, including the adjustments used to calculate EVA, and to download your company’s free EVA Profile, visit the ISS EVA Resource Center. Note: the GAAP metrics of ROE, ROA, ROIC, and **EBITDA** Growth (Cash Flow Growth for certain industries) will continue to be displayed in research...
> — [Pay For Performance Mechanics (PDF)](https://www.issgovernance.com/file/policy/2020/americas/Pay-for-Performance-Mechanics.pdf)

**Sources:**
- [ISS EVA Resource Center | ISS](https://www.issgovernance.com/eva/iss-eva-resource-center) — "ISS EVA"
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
- [Ma Analysis (PDF)](https://www.issgovernance.com/file/2013/02/MA_analysis.pdf)
- [20181113 Generation Investment Management Llp (PDF)](https://www.issgovernance.com/file/policy/2019/comment/20181113_Generation_Investment_Management_LLP.pdf)
- [Pay For Performance Mechanics (PDF)](https://www.issgovernance.com/file/policy/2020/americas/Pay-for-Performance-Mechanics.pdf)

---

### Economic Value Added (EVA)

<span style="background:red; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="3,180 mentions across STOXX & ISS pages (high)">▰▰▰▰▰▰ 3,180</span>


> A proprietary measure of a company's financial performance defined as after-tax operating profit minus a charge for the capital employed to generate that profit. EVA quantifies whether a firm is creating or destroying shareholder value.

EVA asks a simple question: did the company earn more than the cost of the money it used? If EVA is positive, the business is generating wealth beyond what investors could have earned elsewhere at the same risk.

$$
\text{EVA} = \text{NOPAT} - (\text{WACC} \times \text{Invested Capital})
$$

> [!tip] Related terms
> [[#EVA Margin]], [[#Net Operating Profit After Tax (NOPAT)]], [[#Gross Profitability]]




> [!quote] ISS EVA Resource Center | ISS
> tability Drives Value How EVA Can Enhance DCF and P/E Analysis: A Case Study EVA, not EBITDA: A Better Measure of Investment Value The Four Key EVA Performance Ratios Insights Into Value Creation: Using EVA to Measure Performance The Link Between TSR and EVA The EVA Measurement Formula: A Primer on **Economic Value Added (EVA)** Using EVA in Pay-for-Performance Analysis WEBINARS Factor Rotations: W...
> — [ISS EVA Resource Center | ISS](https://www.issgovernance.com/eva/iss-eva-resource-center) — "ISS EVA"

> [!quote] 20181023 Exchange Income Corp (PDF)
> mentary regarding benchmarking policies used by ISS. In regards to the financial performance assessment methodology for the U.S. and Canada entities, the feedback from us on the two specific questions is noted below and we feel our responses below are self-explanatory. Overall the implementation of **Economic Value Added** (“EVA”) based measures does bring some subjectivity with the assumptions use...
> — [20181023 Exchange Income Corp (PDF)](https://www.issgovernance.com/file/policy/2019/comment/20181023_Exchange_Income_Corp.pdf)

> [!quote] Canada Executive Compensation Faq (PDF)
> r a 3-year period; ▪ Multiple of Median (MOM) is the total compensation in the last reported fiscal year relative to the median compensation of the peer group; and ▪ The Financial Performance Assessment (FPA) compares the percentile ranks of a company’s CEO pay and financial performance across four **Economic Value Added (EVA)** metrics, relative to an ISS-developed comparison group, over the prior...
> — [Canada Executive Compensation Faq (PDF)](https://www.issgovernance.com/file/policy/2021/americas/Canada-Executive-Compensation-FAQ.pdf)

> [!quote] Executive Summary Of Iss Policy Updates And Process (PDF)
> on roundtable with 13 institutional investors in New York City on Oct. 16, 2018 and 12 institutional investors in Boston on Oct. 23, 2018. Each of these roundtables included discussions on board gender diversity; director track record and accountability; excessive director pay; the potential use of **Economic Value Added (EVA)** measures in the ISS pay-for-performance model; the alternative calcula...
> — [Executive Summary Of Iss Policy Updates And Process (PDF)](https://www.issgovernance.com/file/policy/2019/updates/Executive-Summary-of-ISS-Policy-Updates-and-Process.pdf)

> [!quote] Us Compensation Policies Faq (PDF)
> FAQ: U.S. Executive Compensation Policies No. There will be no changes to the quantitative screens for 2019. The Financial Performance Assessment screen will continue to use GAAP/accounting performance measures. However, ISS will continue to explore the potential for future use of **Economic Value Added (EVA)** measures to add additional insight into a company's financial performance. To that end, ...
> — [Us Compensation Policies Faq (PDF)](https://www.issgovernance.com/file/policy/2019/americas/US-Compensation-Policies-FAQ.pdf)

**Sources:**
- [ISS EVA Resource Center | ISS](https://www.issgovernance.com/eva/iss-eva-resource-center) — "ISS EVA"
- [20181023 Exchange Income Corp (PDF)](https://www.issgovernance.com/file/policy/2019/comment/20181023_Exchange_Income_Corp.pdf)
- [Canada Executive Compensation Faq (PDF)](https://www.issgovernance.com/file/policy/2021/americas/Canada-Executive-Compensation-FAQ.pdf)
- [Executive Summary Of Iss Policy Updates And Process (PDF)](https://www.issgovernance.com/file/policy/2019/updates/Executive-Summary-of-ISS-Policy-Updates-and-Process.pdf)
- [Us Compensation Policies Faq (PDF)](https://www.issgovernance.com/file/policy/2019/americas/US-Compensation-Policies-FAQ.pdf)

---

### EVA Margin

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="48 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 48</span>


> The ratio of Economic Value Added to revenue, indicating how much economic profit a company earns per unit of sales. It adjusts for both operating efficiency and capital efficiency.

EVA Margin tells you what fraction of each sales dollar turns into true economic profit after accounting for the full cost of capital. It rewards companies that are both operationally lean and capital-light.

$$
\text{EVA Margin} = \frac{\text{EVA}}{\text{Revenue}} \times 100\%
$$

> [!tip] Related terms
> [[#Economic Value Added (EVA)]], [[#Net Operating Profit After Tax (NOPAT)]], [[#Gross Profitability]]




> [!quote] ESG Index Solutions
> medium or high ISS ESG Corporate Rating and comply with standards related to international norms and controversial weapons. EVA LEADERS INDEX ESG + F ESG + F (financial materiality) is here to stay, as ISS’ proprietary research demonstrates that firms that exhibit both high-ESG performance and high-**EVA Margin** significantly outperform firms that are low-ESG and low-**EVA Margin**. ISS ESG EVA LEADER...
> — [ESG Index Solutions](https://www.issgovernance.com/sustainability/esg-index-solutions-2) — "ESG INDEX SOLUTIONS"

> [!quote] 20181101 Compensation Advisory Partners (PDF)
> ses to update ISS' secondary FPA screen… by replacing existing unadjusted GAAP accounting measures with improved EVA-based measures… Specifically, the FPA would shift its capital productivity and profitability measures from GAAP-based measures of ROA, ROE, and ROIC to EVA concepts of EVA Spread and **EVA Margin**, measured over a three-year period. In addition, measures of company progress no longe...
> — [20181101 Compensation Advisory Partners (PDF)](https://www.issgovernance.com/file/policy/2019/comment/20181101_Compensation_Advisory_Partners.pdf)

> [!quote] European Pay For Performance Methodology Faq (PDF)
> scoring element. As such, ISS will explore the potential for future use of Economic Value Added (EVA) measures to add additional insight into a company's financial performance. The EVA display will apply only to companies under pay-for-performance coverage. The four EVA metrics to be displayed are: **EVA Margin**, EVA Spread, EVA Momentum vs. Sales, and EVA Momentum vs. Capital. EVA Metrics are cal...
> — [European Pay For Performance Methodology Faq (PDF)](https://www.issgovernance.com/file/policy/2020/emea/European-Pay-for-Performance-Methodology-FAQ.pdf)

> [!quote] Us Executive Compensation Policies Faq (PDF)
> e FPA operates as a secondary measure after the three primary measures (RDA, MOM, PTA) have been calculated. The FPA compares the company’s financial and operational performance over the long term versus the ISS-derived peer group. The FPA generally utilizes four equally weighted EVA-based metrics: **EVA Margin**, EVA Spread, EVA Momentum vs. Sales, and EVA Momentum vs. Capital. The FPA may modify ...
> — [Us Executive Compensation Policies Faq (PDF)](https://www.issgovernance.com/file/policy/latest/americas/US-Executive-Compensation-Policies-FAQ.pdf)

> [!quote] EVA and Governance QualityScore – Emerging Markets | ISS
> ial materiality and governance quality. EVA deducts the “cost” of giving shareholders a minimum acceptable return for their investment. EVA measures the returns generated on all capital against a strategic, long-run, weighted average cost of capital that is based on a blend of debt and equity. When **EVA Margin** is above zero, the firm is returning above its cost of capital and creating an economi...
> — [EVA and Governance QualityScore – Emerging Markets | ISS](https://www.issgovernance.com/library/esg-eva-and-gov-qualityscore-emerging-markets) — "EVA and Governance QualityScore – Emerging Markets"

**Sources:**
- [ESG Index Solutions](https://www.issgovernance.com/sustainability/esg-index-solutions-2) — "ESG INDEX SOLUTIONS"
- [20181101 Compensation Advisory Partners (PDF)](https://www.issgovernance.com/file/policy/2019/comment/20181101_Compensation_Advisory_Partners.pdf)
- [European Pay For Performance Methodology Faq (PDF)](https://www.issgovernance.com/file/policy/2020/emea/European-Pay-for-Performance-Methodology-FAQ.pdf)
- [Us Executive Compensation Policies Faq (PDF)](https://www.issgovernance.com/file/policy/latest/americas/US-Executive-Compensation-Policies-FAQ.pdf)
- [EVA and Governance QualityScore – Emerging Markets | ISS](https://www.issgovernance.com/library/esg-eva-and-gov-qualityscore-emerging-markets) — "EVA and Governance QualityScore – Emerging Markets"

---

### Equity Risk Premium

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="2 mentions across STOXX & ISS pages (ultra-low)">▰ 2</span>


> The expected return of the broad equity market in excess of the risk-free rate. It represents the additional compensation investors demand for bearing systematic market risk.

The equity risk premium is the extra reward you expect for putting money in stocks instead of risk-free government bonds. It is a key input to CAPM and drives the calculation of alpha and beta.

$$
\text{ERP} = E(R_m) - R_f
$$

> [!tip] Related terms
> [[#Alpha]], [[#Beta]], [[#Risk-Adjusted Return]], [[#Sharpe Ratio]]




> [!quote] 2015Executivesummary (PDF)
> g (meaning that ROE in the most recent fiscal year is at or above 5 percent), and in cases where the senior executives have recently joined the company in connection with a bailout or a major restructuring. The 5 percent threshold was chosen as a minimum ROE level which investors could accept as an **equity risk premium**, based on discussions with institutional investors in Japan holding Japanese ...
> — [2015Executivesummary (PDF)](https://www.issgovernance.com/file/policy/2015ExecutiveSummary.pdf)

> [!quote] 2015Asia Pacificpolicyupdates (PDF)
> gally binding nomination committees. Therefore, it is unrealistic to expect that board members could remove top executives when necessary. The updated policy reflects the unique market circumstances of Japan. The five percent threshold was chosen as a minimum ROE level acceptable to investors as an **equity risk premium**, based on discussions with institutional investors in Japan holding Japanese ...
> — [2015Asia Pacificpolicyupdates (PDF)](https://www.issgovernance.com/file/policy/2015Asia-PacificPolicyUpdates.pdf)

**Sources:**
- [2015Executivesummary (PDF)](https://www.issgovernance.com/file/policy/2015ExecutiveSummary.pdf)
- [2015Asia Pacificpolicyupdates (PDF)](https://www.issgovernance.com/file/policy/2015Asia-PacificPolicyUpdates.pdf)

---

### Enterprise Value (EV)

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="107 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 107</span>


> The total value of a company as seen by all capital providers -- equity holders, debt holders, and minority interests -- minus cash and equivalents. It represents the theoretical takeover price and is the numerator in capital-structure-neutral valuation multiples like EV/EBITDA.

Enterprise value gives you the full price tag of a business, not just the equity slice. It is preferred over market capitalisation when comparing companies with different debt levels because it puts them on an equal footing.

$$
\text{EV} = \text{Market Cap} + \text{Total Debt} + \text{Minority Interest} + \text{Preferred Equity} - \text{Cash \& Equivalents}
$$

> [!tip] Related terms
> [[#EBITDA]], [[#Debt-to-Equity Ratio]], [[#Earnings Yield]], [[#Price-to-Earnings Ratio]]




> [!quote] Stoxx Index Guide (PDF)
> utions Assessment data are given 0. After the selection step, the GHG intensity relative to the parent index is assessed using the capped free-float market capitalization weights of the index components. GHG Intensity is defined as the sum of Scope 1, Scope 2 and Scope 3 emissions from ISS ESG over **Enterprise Value** Including Cash (EVIC). If the GHG intensity reduction is not at least 30% versus...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] Ma Analysis (PDF)
> Peer Comparison—Trading Multiples Enterprise **Enterprise Value** / EBITDA for: Price/Earnings Price/ Company Value (mils) LTM 2013 2014 Trailing Forward Cash Flow CLR Continental Resources Inc. $ 18,553 10.2x 9.9x 7.1x 46.9x 26.7x 10.0x CXO Concho Resources Inc $ 13,698 9.7x 9.3x 8.0x 23.2x 25.3x 7.7x DNR Denbury Resources Inc $ 10,331 5.9x 6.8x
> — [Ma Analysis (PDF)](https://www.issgovernance.com/file/2013/02/MA_analysis.pdf)

> [!quote] ESG Performance and Enterprise Value: Do Firms with Stronger ESG Performance ...
> Economic Value Added (EVA) framework. Notable features of the research design include: - A large global sample of companies observed over a five-year window (2017-2022); and - The use of regression analysis to control for a company’s size and other factors which may affect both ESG performance and **enterprise value**. - Controlling for a company’s size, industry, and country of domicile, the study...
> — [ESG Performance and Enterprise Value: Do Firms with Stronger ESG Performance ...](https://www.issgovernance.com/library/esg-performance-and-enterprise-value-do-firms-with-stronger-esg-performance-have-higher-valuation-ratios) — "ESG Performance and Enterprise Value: Do Firms with Stronger ESG Performance Have Higher Valuation Ratios?"

> [!quote] Vestar Capital Partners to Acquire ISS from MSCI in $364 Million Transaction ...
> rtners Vestar Capital Partners is a leading U.S. middle market private equity firm specializing in management buyouts and growth capital investments. Vestar invests and collaborates with incumbent management teams and private owners in a creative, flexible and entrepreneurial way to build long-term **enterprise value**. Vestar is targeting equity investments in the range of $50 million to $150 mill...
> — [Vestar Capital Partners to Acquire ISS from MSCI in $364 Million Transaction ...](https://www.issgovernance.com/vestar-capital-partners-acquire-institutional-shareholder-services-msci-364-million-transaction) — "Vestar Capital Partners to Acquire ISS from MSCI in $364 Million Transaction"

> [!quote] World, investors gear up action to combat biodiversity loss and related risks...
> te change adaptation, sustainable use and protection of water and marine resources, transition to a circular economy, pollution prevention and control, and protection and restoration of biodiversity and ecosystems. [13] Qontigo is a signatory to the Principles for Responsible Investment (PRI). [14] **Enterprise Value** Including Cash (EVIC) is the sum of the market capitalization of all issued equi...
> — [World, investors gear up action to combat biodiversity loss and related risks...](https://stoxx.com/world-investors-gear-up-action-to-combat-biodiversity-loss-and-related-risks) — "WHITEPAPER"

**Sources:**
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [Ma Analysis (PDF)](https://www.issgovernance.com/file/2013/02/MA_analysis.pdf)
- [ESG Performance and Enterprise Value: Do Firms with Stronger ESG Performance Have Higher Valuation Ratios? | ISS](https://www.issgovernance.com/library/esg-performance-and-enterprise-value-do-firms-with-stronger-esg-performance-have-higher-valuation-ratios) — "ESG Performance and Enterprise Value: Do Firms with Stronger ESG Performance Have Higher Valuation Ratios?"
- [Vestar Capital Partners to Acquire ISS from MSCI in $364 Million Transaction | ISS](https://www.issgovernance.com/vestar-capital-partners-acquire-institutional-shareholder-services-msci-364-million-transaction) — "Vestar Capital Partners to Acquire ISS from MSCI in $364 Million Transaction"
- [World, investors gear up action to combat biodiversity loss and related risks  | Blog posts | STOXX](https://stoxx.com/world-investors-gear-up-action-to-combat-biodiversity-loss-and-related-risks) — "WHITEPAPER"

---

## F

### Factor Exposure

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="314 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 314</span>


> The sensitivity of a portfolio or index to a specific systematic return driver (factor) such as value, momentum, size, or volatility. Measured as the loading coefficient in a factor regression model.

Factor exposure quantifies how much a portfolio tilts towards a particular characteristic. A high momentum exposure, for example, means the portfolio is heavily loaded with stocks that have been rising.

$$
R_i = \alpha_i + \sum_{k=1}^{K} \beta_{ik} \cdot F_k + \epsilon_i
$$

Where $\beta_{ik}$ is the exposure of asset $i$ to factor $k$, and $F_k$ is the factor return.

> [!tip] Related terms
> [[#Factor Return]], [[#Beta]], [[#Return Attribution]]




> [!quote] The low volatility premium – An analysis of factor exposures of minimum varia...
> s are likely of great importance for investors while implementing minimum variance strategies. Investors need to be aware of interactions among factors in order to apply appropriate countermeasures. In this context, the empirical findings indicate that applying constraints to limit unintended style **factor exposure**s relative to the benchmark may help reduce the negative performance contribution ...
> — [The low volatility premium – An analysis of factor exposures of minimum varia...](https://stoxx.com/the-low-volatility-premium-an-analysis-of-factor-exposures-of-minimum-variance-strategies-blog) — "WHITEPAPER"

> [!quote] STOXX Factor and STOXX ESG-X Factor Indices Q2 Spotlight – Mixed Performance,...
> (so far) V-shaped market returns have led to significantly larger active returns and active risk than are usually reported. In this note, we spotlight a few portfolio construction aspects of the STOXX factor index suite, and how they fared recently. We start with the ESG-X family. Spotlight – ESG-X **factor exposure**s A key focus of the ESG-X factor indices, as highlighted in our recent blog post,...
> — [STOXX Factor and STOXX ESG-X Factor Indices Q2 Spotlight – Mixed Performance,...](https://stoxx.com/stoxx-factor-and-stoxx-esg-x-factor-indices-q2-spotlight-mixed-performance-strong-exposures-and-rebounding-correlations) — "WHITEPAPER"

> [!quote] Two years of STOXX-BlackRock multifactor collaboration | Blog posts | STOXX
> ctor create diversified factor profiles and prevent the indices from loading too much (or not enough) on one individual factor, which is a common issue faced by many existing multifactor strategies. As individual factors can be in or out of favor at different points of the market cycle, diversified **factor exposure**s can play an important role in mitigating prolonged periods of underperformance. ...
> — [Two years of STOXX-BlackRock multifactor collaboration | Blog posts | STOXX](https://stoxx.com/two-years-of-stoxx-blackrock-multifactor-collaboration) — "WHITEPAPER"

> [!quote] When 40 is the New 30 – What DAX Gains Following Enlargement | Blog posts | S...
> ocks with lower earnings yield than the average in the model universe. The small exposure to Exchange Rate Sensitivity signifies that only a small proportion of the 30 and 40 companies’ business may come from non-domestic sources. Note, however, that this is a point-in-time analysis and these style **factor exposure**s may change in the near future. Figure 6 – Style **factor exposure**s New entrants’ p...
> — [When 40 is the New 30 – What DAX Gains Following Enlargement | Blog posts | S...](https://stoxx.com/when-40-is-the-new-30-what-dax-gains-following-enlargement) — "WHITEPAPER"

> [!quote] The AI revolution is taking place now – a look inside the STOXX Global Artifi...
> lity as a multi-year structural story. Having a revenue-based selection methodology appears as an appropriate strategy for an industry where earnings growth is happening now, rather than in the future. Investors targeting a technologically disruptive theme such as AI must be aware of the sector and **factor exposure**s involved in such a strategy. As with many other technology-focused themes, inves...
> — [The AI revolution is taking place now – a look inside the STOXX Global Artifi...](https://stoxx.com/the-ai-revolution-is-taking-place-now-a-look-inside-the-stoxx-global-artificial-intelligence-index) — "WHITEPAPER"

**Sources:**
- [The low volatility premium – An analysis of factor exposures of minimum variance strategies | Blog posts | STOXX](https://stoxx.com/the-low-volatility-premium-an-analysis-of-factor-exposures-of-minimum-variance-strategies-blog) — "WHITEPAPER"
- [STOXX Factor and STOXX ESG-X Factor Indices Q2 Spotlight – Mixed Performance, Strong Exposures and Rebounding Correlations | STOXX](https://stoxx.com/stoxx-factor-and-stoxx-esg-x-factor-indices-q2-spotlight-mixed-performance-strong-exposures-and-rebounding-correlations) — "WHITEPAPER"
- [Two years of STOXX-BlackRock multifactor collaboration | Blog posts | STOXX](https://stoxx.com/two-years-of-stoxx-blackrock-multifactor-collaboration) — "WHITEPAPER"
- [When 40 is the New 30 – What DAX Gains Following Enlargement | Blog posts | STOXX](https://stoxx.com/when-40-is-the-new-30-what-dax-gains-following-enlargement) — "WHITEPAPER"
- [The AI revolution is taking place now – a look inside the STOXX Global Artificial Intelligence index | Blog posts | STOXX](https://stoxx.com/the-ai-revolution-is-taking-place-now-a-look-inside-the-stoxx-global-artificial-intelligence-index) — "WHITEPAPER"

---

### Factor Return

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="30 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 30</span>


> The return attributable to a specific systematic factor over a given period. It represents the payoff to a long-short portfolio that is long stocks with high exposure to the factor and short stocks with low exposure.

Factor return measures how much a particular investment style (e.g., value, momentum) paid off during a period. When the value factor return is positive, cheap stocks outperformed expensive ones.

$$
F_k = R_{\text{high exposure}} - R_{\text{low exposure}}
$$

> [!tip] Related terms
> [[#Factor Exposure]], [[#Return Attribution]], [[#Active Return]]




> [!quote] How efficient an inflation hedge is real estate? | Blog posts | STOXX
> Reserve raised rates for the first time since 2018 on March 16 this year and the Bank of England followed suit. This change in sentiment had an impact on the returns of the inflation expectation factors in the Macroeconomic Projection Model (Figure 2). Figure 2: Expected inflation – YTD cumulative **factor return** Contribution to returns The combination of factor exposures and **factor return**s trans...
> — [How efficient an inflation hedge is real estate? | Blog posts | STOXX](https://stoxx.com/how-efficient-an-inflation-hedge-is-real-estate) — "WHITEPAPER"

> [!quote] Infrastructure: a portfolio’s barrier against inflation | Blog posts | STOXX
> rease in Europe and US expected inflation contributed the most to the 2020—2022 index return (right-hand chart in Figure 3). This is not surprising given that 60% of index assets are located in these two regions, with both regions seeing positive average exposures to expected inflation and positive **factor return**s. Figure 3 – Exposures, **factor return**s, and factor contributions (2020-2022) Factor...
> — [Infrastructure: a portfolio’s barrier against inflation | Blog posts | STOXX](https://stoxx.com/infrastructure-a-portfolios-barrier-against-inflation) — "WHITEPAPER"

> [!quote] Monthly Index News July 2019 (PDF)
> July 2019 Premia Indices Key points **Factor return**s did better during July as measured by the EURO STOXX® Multi Premia® and Single Premium Indices, which integrate the academic-research-based Multi Premia methodology developed by STOXX’s partner Finreon. The indices track seven distinctive sources of equity risk and returns on a broad
> — [Monthly Index News July 2019 (PDF)](https://stoxx.com/monthly-index-news-july-2019)

> [!quote] BlackRock’s Jamie Forbes: Implementing ‘evolutionary’ factor advancements in ...
> the body of research in factors is constantly evolving. BlackRock has a seasoned factor research group that constantly looks at improving the industry’s insights. We stay ahead of new developments in factor insights, evaluating and ensuring that they are additive to our high standards of explaining **factor return** drivers. I would describe recent factor advancements as evolutionary rather than re...
> — [BlackRock’s Jamie Forbes: Implementing ‘evolutionary’ factor advancements in ...](https://stoxx.com/blackrocks-jamie-forbes-implementing-evolutionary-factor-advancements-in-investments) — "WHITEPAPER"

> [!quote] Factor Investing: Q&amp;A on Flows, Outlook | Blog posts | STOXX
> advantages up and compare it to an active approach, the result goes much farther than just a cost advantage. Is there a risk that factor indices become too popular, ‘crowding’ some strategies? As with all asset classes, any equity strategy will be susceptible to and defined by its risk premium. Any **factor return** can be explained as a reward for taking on risk. If too many investors flock to a m...
> — [Factor Investing: Q&amp;A on Flows, Outlook | Blog posts | STOXX](https://stoxx.com/factor-investing-qa-on-flows-outlook) — "WHITEPAPER"

**Sources:**
- [How efficient an inflation hedge is real estate? | Blog posts | STOXX](https://stoxx.com/how-efficient-an-inflation-hedge-is-real-estate) — "WHITEPAPER"
- [Infrastructure: a portfolio’s barrier against inflation | Blog posts | STOXX](https://stoxx.com/infrastructure-a-portfolios-barrier-against-inflation) — "WHITEPAPER"
- [Monthly Index News July 2019 (PDF)](https://stoxx.com/monthly-index-news-july-2019)
- [BlackRock’s Jamie Forbes: Implementing ‘evolutionary’ factor advancements in investments | Blog posts | STOXX](https://stoxx.com/blackrocks-jamie-forbes-implementing-evolutionary-factor-advancements-in-investments) — "WHITEPAPER"
- [Factor Investing: Q&amp;A on Flows, Outlook | Blog posts | STOXX](https://stoxx.com/factor-investing-qa-on-flows-outlook) — "WHITEPAPER"

---

### Free Cash Flow (FCF)

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="13 mentions across STOXX & ISS pages (low)">▰▰ 13</span>


> The cash generated by a company's operations after deducting capital expenditures necessary to maintain or expand its asset base. FCF represents the cash available to pay dividends, reduce debt, buy back shares, or fund acquisitions.

Free cash flow is the ultimate reality check: no matter what the income statement says, FCF shows how much actual cash the business produced. Companies can manipulate earnings, but cash is cash.

$$
\text{FCF} = \text{Operating Cash Flow} - \text{Capital Expenditures}
$$

> [!tip] Related terms
> [[#Cash Flow Yield]], [[#EBITDA]], [[#Net Income]], [[#Revenue]]




> [!quote] Stoxx Index Guide (PDF)
> 871) (cid:3047) (cid:1839)(cid:1829)(cid:1853)(cid:1868) (cid:1839)(cid:1829)(cid:1853)(cid:1868) (cid:3047) (cid:3047)(cid:2879)(cid:2871) where, (cid:1872) cut-off date (cid:1872)−3 3 years prior to the cut-off date; if this is not a trading day, then the next trading day should be considered FCF **Free Cash Flow** Net CapEx Capital Expenditure on Fixed Assets Mcap Free-float Market Capitalizatio...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] 20181113 Generation Investment Management Llp (PDF)
> sed update, the framework of the primary ISS pay-for-performance model methodology is unchanged and will continue to use TSR as its main performance metric. Does your organization agree with that approach? If not, please explain.  Not entirely. TSR is not an optimal metric; we think a 5-yr rolling **free cash flow**/ share would be a preferred primary metric.  EVA is a useful metric, assuming the...
> — [20181113 Generation Investment Management Llp (PDF)](https://www.issgovernance.com/file/policy/2019/comment/20181113_Generation_Investment_Management_LLP.pdf)

> [!quote] Istoxx Index Guide (PDF)
> iSTOXX® METHODOLOGY GUIDE 380/1024 24. iSTOXX DYNAMIC STYLE INDICES Factor Scores are finally aggregated using the weights in brackets below to arrive at the final Quality Score. • Profitability o **Free Cash Flow**/Assets o Return On Assets o Return On Equity o Gross Profitability (Gross Profit / Assets) o Gross Margin o Asset Turnover • Earnings Quality o Balance sheet accruals o Cash-Flow accrua...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

> [!quote] Ma Analysis (PDF)
> al infrastructure they manifest. This is particularly a concern for shareholders since the former to help lower its lease operating expenses—effectively investing up front for a would necessarily provide flexibility for the unknown, particularly in the long- return, through lower costs and improved **free cash flow**, in the future. The term planning assumptions around commodity prices, competitive...
> — [Ma Analysis (PDF)](https://www.issgovernance.com/file/2013/02/MA_analysis.pdf)

> [!quote] Q&amp;A with WTW’s David Nelson: Managing a portfolio’s climate transition ri...
> ach company’s cash flows. How does that work and how is it reflected in the weights allocated to every stock in a portfolio? “Our analysis begins with the basic principle that the value of an investment is the revenue that it will generate over its lifetime; that is, the net present value of future free cash flows. From that starting point we examine the changes to those cash flows relative to ...
> — [Q&amp;A with WTW’s David Nelson: Managing a portfolio’s climate transition ri...](https://stoxx.com/qa-with-wtws-david-nelson-managing-a-portfolios-climate-transition-risk-with-a-forward-looking-focus) — "WHITEPAPER"

**Sources:**
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [20181113 Generation Investment Management Llp (PDF)](https://www.issgovernance.com/file/policy/2019/comment/20181113_Generation_Investment_Management_LLP.pdf)
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
- [Ma Analysis (PDF)](https://www.issgovernance.com/file/2013/02/MA_analysis.pdf)
- [Q&amp;A with WTW’s David Nelson: Managing a portfolio’s climate transition risk with a forward-looking focus  | Blog posts | STOXX](https://stoxx.com/qa-with-wtws-david-nelson-managing-a-portfolios-climate-transition-risk-with-a-forward-looking-focus) — "WHITEPAPER"

---

## G

### Gross Margin

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="11 mentions across STOXX & ISS pages (low)">▰▰ 11</span>


> The percentage of revenue remaining after subtracting the cost of goods sold (COGS). It measures how efficiently a company converts raw materials and direct labour into revenue before operating expenses.

Gross margin reveals the basic economics of a company's product or service. A high gross margin means the company has pricing power or a low-cost production advantage, leaving more room for operating expenses and profit.

$$
\text{Gross Margin} = \frac{\text{Revenue} - \text{COGS}}{\text{Revenue}} \times 100\%
$$

> [!tip] Related terms
> [[#Gross Profitability]], [[#Operating Margin]], [[#Revenue]], [[#EBITDA]]




> [!quote] Istoxx Index Guide (PDF)
> X® METHODOLOGY GUIDE 380/1024 24. iSTOXX DYNAMIC STYLE INDICES Factor Scores are finally aggregated using the weights in brackets below to arrive at the final Quality Score. • Profitability o Free Cash Flow/Assets o Return On Assets o Return On Equity o Gross Profitability (Gross Profit / Assets) o **Gross Margin** o Asset Turnover • Earnings Quality o Balance sheet accruals o Cash-Flow accruals o ...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

> [!quote] Stoxx Index Guide (PDF)
> spective subtheme based on its profitability. A company is part of the subtheme group if its aggregate exposure to the subtheme is greater than zero. Companies must pass one of the following indicators in at least one of the subthemes: - Companies must rank in the top 80% of their subtheme group in **Gross Margin** or, - Companies with a **Gross Margin** greater than or equal to 50%. Individual indicat...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] Stoxx Index Guide (PDF)
> spective subtheme based on its profitability. A company is part of the subtheme group if its aggregate exposure to the subtheme is greater than zero. Companies must pass one of the following indicators in at least one of the subthemes: - Companies must rank in the top 80% of their subtheme group in **Gross Margin** or, - Companies with a **Gross Margin** greater than or equal to 50%. Individual indicat...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

**Sources:**
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

### Gross Profitability

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="22 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 22</span>


> The ratio of gross profit (revenue minus cost of goods sold) to total assets. Introduced by Novy-Marx (2013) as a quality factor, it measures how efficiently a firm converts its asset base into profit before overhead costs.

Gross profitability strips away everything except the most fundamental question: how much raw profit does the company squeeze out of every dollar of assets? It tends to identify high-quality firms.

$$
\text{Gross Profitability} = \frac{\text{Revenue} - \text{COGS}}{\text{Total Assets}}
$$

> [!tip] Related terms
> [[#Economic Value Added (EVA)]], [[#EVA Margin]], [[#Earnings Yield]]




> [!quote] Stoxx Index Guide (PDF)
> the Parent Index weights and truncated at +/- 3 standard deviations. The Momentum Factor combines the Signals at 25%, 50% and 25% weights, respectively, and is again z-scored and truncated at +/-3 standard deviations. The Quality Factor is a composite of the following 6 Signals: Accruals, Dilution, **Gross Profitability**, Change in Net Operating Assets (NOA), Carbon Emissions Intensity, and Scienc...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] Stoxx Index Guide (PDF)
> the Parent Index weights and truncated at +/- 3 standard deviations. The Momentum Factor combines the Signals at 25%, 50% and 25% weights, respectively, and is again z-scored and truncated at +/-3 standard deviations. The Quality Factor is a composite of the following 6 Signals: Accruals, Dilution, **Gross Profitability**, Change in Net Operating Assets (NOA), Carbon Emissions Intensity, and Scienc...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] Istoxx Index Guide (PDF)
> iSTOXX® METHODOLOGY GUIDE 380/1024 24. iSTOXX DYNAMIC STYLE INDICES Factor Scores are finally aggregated using the weights in brackets below to arrive at the final Quality Score. • Profitability o Free Cash Flow/Assets o Return On Assets o Return On Equity o **Gross Profitability** (Gross Profit / Assets) o Gross Margin o Asset Turnover • Earnings Quality o Balance sheet accruals o Cash-Flow accrua...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

> [!quote] The Quality Factor | Blog posts | STOXX
> as smart beta, however, the strategy is a relatively new addition to the factor mix. This may be why compared to other factors ‘the dispersion in definitions is substantially largerfor quality,’ according to a 2016 study.3The paper’s authors found that definitions range from low levels of accruals, **gross profitability** and low investments to bottom-line profitability measures such as return-on-e...
> — [The Quality Factor | Blog posts | STOXX](https://stoxx.com/the-quality-factor) — "WHITEPAPER"

> [!quote] STOXX Equity Factor Indices | STOXX
> the following five factors: Momentum The momentum score is calculated from price momentum, earnings momentum and earnings announcement drift (i.e., the difference between a stock’s performance on and immediately following an earnings announcement date). Quality The quality score is calculated from **gross profitability**, dilution, accruals and changes in net operating assets as well as environment...
> — [STOXX Equity Factor Indices | STOXX](https://stoxx.com/solutions/stoxx-equity-factor-indices) — "WHITEPAPER"

**Sources:**
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
- [The Quality Factor | Blog posts | STOXX](https://stoxx.com/the-quality-factor) — "WHITEPAPER"
- [STOXX Equity Factor Indices | STOXX](https://stoxx.com/solutions/stoxx-equity-factor-indices) — "WHITEPAPER"

---

### Gross Return

<span style="background:deeppink; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="6,722 mentions across STOXX & ISS pages (ultra-high)">▰▰▰▰▰▰▰ 6,722</span>


> The total return of an index calculated assuming dividends are reinvested at the gross amount, before any withholding tax is deducted. This represents the theoretical maximum return for a tax-exempt investor.

Gross return shows what you would earn if every dividend were reinvested in full with zero tax. It is the upper bound of performance and is used as the standard total return variant for many STOXX indices.

$$
\text{Gross Return Index}_t = \text{Gross Return Index}_{t-1} \times \frac{\sum_i w_i \cdot p_{i,t} + \sum_i w_i \cdot d_{i,t}}{\sum_i w_i \cdot p_{i,t-1}}
$$

> [!tip] Related terms
> [[#Net Return]], [[#Total Return]], [[#Dividend Yield]]




> [!quote] The Metaverse: investing at the new digital frontier | Blog posts | STOXX
> s return of the STOXX Global Metaverse since March 2012. The light green area exhibits its excess performance over the STOXX® Global 3000 Technology benchmark (depicted in light blue). The dark blue line represents the total return of the broader STOXX Global TMI universe. Figure 3 – Cumulative USD **gross return**s since March 19, 2012 Recent market turmoil Like many other technology and growth-fo...
> — [The Metaverse: investing at the new digital frontier | Blog posts | STOXX](https://stoxx.com/the-metaverse-investing-at-the-new-digital-frontier) — "WHITEPAPER"

> [!quote] Istoxx Index Guide (PDF)
> ng Index (**gross return** versions) with a constant dividend markdown expressed in index points that are subtracted on an accrued basis (using an Actual/365 Fixed day count convention). Consequently, due to the index points being subtracted, the iSTOXX Constant indices are underperforming the standard **gross return** indices that include a full dividend investment. The iSTOXX Constant Indices perform...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

> [!quote] Sx50Ugv (PDF)
> rgest companies in terms of free-float market cap of the index universe. The detailed methodology including the calculation formula can be found in our rulebook: www.stoxx.com/indices/rulebooks.html Versions and symbols Quick facts Index ISIN Symbol Bloomberg Reuters Weighting Free-float market cap **Gross Return** EUR CH0375047138 SX50UGR .SX50UGR No. of components 500 **Gross Return** EUR CH037504713...
> — [Sx50Ugv (PDF)](https://www.stoxx.com/document/Indices/Factsheets/2022/December/SX50UGV.pdf)

> [!quote] Stoxx Strategy Guide (PDF)
> et Return CH0321426980 SXW1BSER STOXX Global Basket Select EUR **Gross Return** CH0321427038 SXW1BSEG STOXX Global Basket Diversification Select EUR Price CH0321427079 SXW1BDSE STOXX Global Basket Diversification Select EUR Net Return CH0321427129 SXW1BDSR STOXX Global Basket Diversification Select EUR **Gross Return** CH0321427145 SXW1BDSG 21.3. CALCULATION The index values are calculated as following...
> — [Stoxx Strategy Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_strategy_guide.pdf)

> [!quote] Monthly Index News June 2022 (PDF)
> Electronic Devices. The index applies liquidity and market-capitalization filters in the selection of stocks, which are finally weighted by adjusted equal weight. The methodology also implements standard exclusionary ESG screens provided by Sustainalytics. Chart 1: Performance Source: Qontigo. USD **gross return**s, June 30, 2015 – June 30, 2022. 3/35 Copyright © 2022 Qontigo GmbH.
> — [Monthly Index News June 2022 (PDF)](https://stoxx.com/monthly-index-news-june-2022)

**Sources:**
- [The Metaverse: investing at the new digital frontier | Blog posts | STOXX](https://stoxx.com/the-metaverse-investing-at-the-new-digital-frontier) — "WHITEPAPER"
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
- [Sx50Ugv (PDF)](https://www.stoxx.com/document/Indices/Factsheets/2022/December/SX50UGV.pdf)
- [Stoxx Strategy Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_strategy_guide.pdf)
- [Monthly Index News June 2022 (PDF)](https://stoxx.com/monthly-index-news-june-2022)

---

## I

### Information Ratio

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="13 mentions across STOXX & ISS pages (low)">▰▰ 13</span>


> The ratio of a portfolio's active return to its tracking error. It measures the consistency with which a manager outperforms the benchmark per unit of active risk taken.

The information ratio is the active manager's report card: it tells you how much excess return they delivered for every unit of uncertainty they introduced by deviating from the benchmark. Higher is better.

$$
\text{IR} = \frac{R_{\text{portfolio}} - R_{\text{benchmark}}}{\sigma_{\text{active}}}
$$

Where $\sigma_{\text{active}}$ is the tracking error (standard deviation of active returns).

> [!tip] Related terms
> [[#Active Return]], [[#Tracking Error]], [[#Sharpe Ratio]], [[#Sortino Ratio]]




> [!quote] Three Different Flavors for a Sustainable US Equity Portfolio | Blog posts | ...
> ustainable indices’ framework All three ESG variants have delivered as expected in terms of having higher ESG scores than the parent index and low tracking errors (Figure 2). The ESG Target index has provided the highest ESG score, but also has the highest tracking error (as well as lowest realized **information ratio**, fewest holdings and highest stock concentration). Although higher than that of...
> — [Three Different Flavors for a Sustainable US Equity Portfolio | Blog posts | ...](https://stoxx.com/three-different-flavors-for-a-sustainable-us-equity-portfolio) — "WHITEPAPER"

> [!quote] Ixarobu (PDF)
> al Automation & Robotics N/A N/A 22.0 22.5 22.8 N/A N/A 0.7 0.3 0.4 STOXX Global Total Market N/A N/A 14.9 15.0 17.6 N/A N/A 0.7 0.5 0.4 Index to benchmark Correlation Tracking error (%) STOXX Global Automation & Robotics 0.9 0.9 0.9 0.9 0.9 7.9 9.0 10.3 11.0 10.5 Index to benchmark Beta Annualized **information ratio** STOXX Global Automation & Robotics 1.5 1.3 1.4 1.4 1.2 -2.2 1.2 0.7 -0.1 0.1 1 ...
> — [Ixarobu (PDF)](https://www.stoxx.com/document/Bookmarks/CurrentFactsheets/IXAROBU.pdf)

> [!quote] Low Volatility Strategies: Why the Wheels Came Off (Temporarily) in 2020 | Bl...
> d in 2020. From 2006 through August 2020, the Low Risk 200 returned 5.4% on an annualized basis, versus a return of 4.1% for the benchmark STOXX® Global 1800 Index (‘Global 1800’). Prior to 2020, the outperformance was fairly steady (Figure 1). Realized tracking error was just over 8%, producing an **information ratio** of 0.15. While that **information ratio** may not sound dramatic, the strategy has ...
> — [Low Volatility Strategies: Why the Wheels Came Off (Temporarily) in 2020 | Bl...](https://stoxx.com/low-volatility-strategies-why-the-wheels-came-off-temporarily-in-2020-blog) — "WHITEPAPER"

> [!quote] Multifactor strategies: Proving their worth in the factor investment landscap...
> om the STOXX USA 900 universe beat the Momentum, Value and Low Risk portfolios by around 1 percentage point per annum over the period (Table 1). Multifactor also significantly outperformed the Small Size factor portfolio, and came ahead of the Quality tilt only slightly. The multifactor portfolio’s **Information Ratio** (IR) was higher than all single-factor portfolios except for Quality. Table 1 –...
> — [Multifactor strategies: Proving their worth in the factor investment landscap...](https://stoxx.com/multifactor-strategies-proving-their-worth-in-the-factor-investment-landscape) — "WHITEPAPER"

> [!quote] Unpacking the alpha components behind the STOXX U.S. Equity Factor Index | Wh...
> nage risk relative to a capitalization-weighted benchmark. The STOXX U.S. Equity Factor Index has beaten its parent index, the STOXX USA 900, by roughly 126 basis points a year since 2003. What is more, it has done so with a relatively small level of predicted and realized active risk, producing an **information ratio** very close to 1. Performance has been consistent as well: The factor index has ...
> — [Unpacking the alpha components behind the STOXX U.S. Equity Factor Index | Wh...](https://stoxx.com/unpacking-the-alpha-components-behind-the-stoxx-u-s-equity-factor-index) — "WHITEPAPER"

**Sources:**
- [Three Different Flavors for a Sustainable US Equity Portfolio | Blog posts | STOXX](https://stoxx.com/three-different-flavors-for-a-sustainable-us-equity-portfolio) — "WHITEPAPER"
- [Ixarobu (PDF)](https://www.stoxx.com/document/Bookmarks/CurrentFactsheets/IXAROBU.pdf)
- [Low Volatility Strategies: Why the Wheels Came Off (Temporarily) in 2020 | Blog posts | STOXX](https://stoxx.com/low-volatility-strategies-why-the-wheels-came-off-temporarily-in-2020-blog) — "WHITEPAPER"
- [Multifactor strategies: Proving their worth in the factor investment landscape | Blog posts | STOXX](https://stoxx.com/multifactor-strategies-proving-their-worth-in-the-factor-investment-landscape) — "WHITEPAPER"
- [Unpacking the alpha components behind the STOXX U.S. Equity Factor Index | Whitepapers | STOXX](https://stoxx.com/unpacking-the-alpha-components-behind-the-stoxx-u-s-equity-factor-index) — "WHITEPAPER"

---

### iNAV (Intraday Net Asset Value)

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="18 mentions across STOXX & ISS pages (low)">▰▰ 18</span>


> The estimated per-share value of an exchange-traded fund (ETF) or index fund calculated and disseminated continuously throughout the trading day, based on the real-time prices of the fund's underlying holdings.

iNAV gives traders a live fair-value estimate of an ETF so they can judge whether the market price represents a premium or discount. STOXX calculates iNAV for numerous ETFs tracking its indices.

$$
\text{iNAV}_t = \frac{\sum_{i=1}^{N} \bigl(n_i \times p_{i,t}\bigr) + \text{Cash}_{t}}{{\text{Shares Outstanding}}}
$$

Where $n_i$ is the number of shares of constituent $i$ and $p_{i,t}$ is its price at time $t$.

> [!tip] Related terms
> [[#Total Return]], [[#Gross Return]], [[#Net Return]]




> [!quote] Dax Equity Index Methodology Guide 5526498614 (PDF)
> Guide describes the processes for calculating and disseminating the DAX equity indices, including information on index formulas and adjustments to be made due to corporate actions » The DAX Strategy Index Guide contains the formulas for, and descriptions of, all DAX strategy indices » The Guide to **iNAV** Calculation contains details on how to calculate indicative net asset values (“iNAVs”) » The ...
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)

> [!quote] Roundtable Multi Faktor Losung Euro Stoxx (PDF)
> reich auf Kooperati- ment (Schweiz) AG in Zürich. Er ist seit Oktober Vertrieb der bestehenden Indizes von stoxx alle Smart Beta Anlagen. Er ist ein ausge- onen und Partnerschaften. cdp liefert Die in 2016 erfolgte Lancierung des 2000 in dem Bereich tätig und übernahm Ltd. für die dach-Region, Skandinavien und wiesener Experte für Multi-Faktor basierte uns z.B. die umfassendste Sammlung csif (c...
> — [Roundtable Multi Faktor Losung Euro Stoxx (PDF)](https://stoxx.com/roundtable-multi-faktor-losung-euro-stoxx)

> [!quote] CSP Reports | STOXX
> nation Data and reports End of the day data Index values & divisors Currency rates Historical component changes DAX legacy reports Corporate actions Periodic review information Selection lists Review reports Monthly data Simulation files Services Index licensing License agreement form Academic data **iNAV** Announcements Index updates Dissemination Methodology Systems & IT Help Index Regulations In...
> — [CSP Reports | STOXX](https://stoxx.com/csp-reports) — "WHITEPAPER"

> [!quote] Ethix SRI Advisors Acquired by Institutional Shareholder Services in Responsi...
> tal and social research and analysis, we are poised to offer our clients a truly integrated solution to meet both the depth and breadth of institutions‘ ESG needs, ” said Hasselgren. Hasselgren, will also lead ISS‘ overall responsible investment business initiatives and continue to be based in Scandinavia. “We are very pleased to welcome Ulrika and the entire Ethix team to the ISS family,” said...
> — [Ethix SRI Advisors Acquired by Institutional Shareholder Services in Responsi...](https://www.issgovernance.com/ethix-sri-advisors-acquired-by-institutional-shareholder-services-in-responsible-investment-business-expansion) — "Ethix SRI Advisors Acquired by Institutional Shareholder Services in Responsible Investment Business Expansion"

> [!quote] Manage and Hedge Portfolio with Listed Derivatives on ESG Benchmark Indices |...
> Trading Desks Fund Managers Portfolio Managers The Need Investors need new indices that can accurately reflect sustainable mandates and underlie appropriate investment instruments such as listed derivatives to better manage and hedge portfolios. The Challenge When one of Scandinavia’s largest asset managers extended its responsible investing principles to all types of instruments, its trading a...
> — [Manage and Hedge Portfolio with Listed Derivatives on ESG Benchmark Indices |...](https://stoxx.com/derivatives-on-esg-benchmarks) — "WHITEPAPER"

**Sources:**
- [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
- [Roundtable Multi Faktor Losung Euro Stoxx (PDF)](https://stoxx.com/roundtable-multi-faktor-losung-euro-stoxx)
- [CSP Reports | STOXX](https://stoxx.com/csp-reports) — "WHITEPAPER"
- [Ethix SRI Advisors Acquired by Institutional Shareholder Services in Responsible Investment Business Expansion | ISS](https://www.issgovernance.com/ethix-sri-advisors-acquired-by-institutional-shareholder-services-in-responsible-investment-business-expansion) — "Ethix SRI Advisors Acquired by Institutional Shareholder Services in Responsible Investment Business Expansion"
- [Manage and Hedge Portfolio with Listed Derivatives on ESG Benchmark Indices | Case studies | STOXX](https://stoxx.com/derivatives-on-esg-benchmarks) — "WHITEPAPER"

---

## M

### Maximum Drawdown

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="11 mentions across STOXX & ISS pages (low)">▰▰ 11</span>


> The largest peak-to-trough decline observed over a specified time period. It quantifies the worst-case loss scenario an investor would have experienced.

Maximum drawdown is the single scariest number in a fund's history: the worst cumulative loss from a peak before a recovery. It matters because investors feel losses more acutely than equivalent gains.

$$
\text{MDD} = \max_{t \in [0,T]} \left[\frac{V_{\text{peak}}(t) - V_{\text{trough}}(t)}{V_{\text{peak}}(t)}\right]
$$

> [!tip] Related terms
> [[#Drawdown]], [[#Value at Risk (VaR)]], [[#Volatility]], [[#Sortino Ratio]]




> [!quote] Stoxx Minvar Paper (PDF)
> HILE KEEPING A BETA OF 1. 350 300 250 200 150 100 50 0 Jan-04 Jan-05 Jan-06 Jan-07 Jan-08 Jan-09 Jan-10 Jan-11 Jan-12 Jan-13 Jan-14 Jan-15 Jan-16 STOXX Global 1800 Composite Portfolio Key figures STOXX Global 1800 Composite portfolio Return (annualized) 7.4% 8.8% Volatility (annualized) 15.4% 12.4% **Maximum drawdown** 53.7% 49.2% Return/volatility 0.48 0.71 Source: STOXX daily data from Jan. 2, 20...
> — [Stoxx Minvar Paper (PDF)](http://www.stoxx.com/document/Others/marketing/STOXX_MinVar_Paper.pdf)

> [!quote] New Study: Gauging the Effect of ESG Exclusions Through the STOXX USA 500 ESG...
> on of a more detailed analysis we ran in the report. Here, we focused on the effect on risk and returns of implementing the four ESG-X exclusions on the STOXX USA 500. Data show that the exclusions increased volatility relative to the benchmark, although did so only marginally. The Sharpe ratio and **maximum drawdown**s for the benchmark, ESG-X index and individual exclusions were broadly in line. ...
> — [New Study: Gauging the Effect of ESG Exclusions Through the STOXX USA 500 ESG...](https://stoxx.com/new-study-gauging-the-effect-of-esg-exclusions-through-the-stoxx-usa-500-esg-x) — "WHITEPAPER"

> [!quote] New Possibilities in Options-Based Index Strategies | Blog posts | STOXX
> STOXX 50 Collar Index, which has a shorter history of data, a measure like volatility may be better suited to analyze its performance given its goal of lowering risk. The index shows an annualized volatility of 6.8% in the past three years, while the EURO STOXX 50’s is 14.6%. Since data starts, the **maximum drawdown** for the collar index has been 12.9%, compared with a 17.5% fall for the EURO STO...
> — [New Possibilities in Options-Based Index Strategies | Blog posts | STOXX](https://stoxx.com/new-possibilities-in-options-based-index-strategies) — "WHITEPAPER"

> [!quote] STOXX SRI Indices: Target the Best ESG and Emissions Performers | Blog posts ...
> 600 ESG-X Index.3 The SRI index’s tracking error is larger than that of the ESG-X Index. It’s worth noting, however, that the SRI index has shown to be the least volatile index among the three, both in terms of realized annualized volatility (as measured by standard deviation of daily returns) and **maximum drawdown**. Figure 3 – Risk and return characteristics Turning now to the SRI indices’ by-de...
> — [STOXX SRI Indices: Target the Best ESG and Emissions Performers | Blog posts ...](https://stoxx.com/stoxx-sri-indices-target-the-best-esg-and-emissions-performers) — "WHITEPAPER"

> [!quote] European Stocks Enter Bear Market | Blog posts | STOXX
> Global 1800 Index, North America 600 Index and STOXX Asia/Pacific 600 Index have shed, respectively, 17.5%, 19% and 11.3% during the period. Chart 1 – Benchmarks performance since Feb. 19 There have been three bear markets, other than this latest one, for the STOXX Europe 600 Index since 2000. The **maximum drawdown** during each one was reached, respectively, in March 2003 (-52.8%), March 2009 (-5...
> — [European Stocks Enter Bear Market | Blog posts | STOXX](https://stoxx.com/european-stocks-enter-bear-market) — "WHITEPAPER"

**Sources:**
- [Stoxx Minvar Paper (PDF)](http://www.stoxx.com/document/Others/marketing/STOXX_MinVar_Paper.pdf)
- [New Study: Gauging the Effect of ESG Exclusions Through the STOXX USA 500 ESG-X | STOXX](https://stoxx.com/new-study-gauging-the-effect-of-esg-exclusions-through-the-stoxx-usa-500-esg-x) — "WHITEPAPER"
- [New Possibilities in Options-Based Index Strategies | Blog posts | STOXX](https://stoxx.com/new-possibilities-in-options-based-index-strategies) — "WHITEPAPER"
- [STOXX SRI Indices: Target the Best ESG and Emissions Performers | Blog posts | STOXX](https://stoxx.com/stoxx-sri-indices-target-the-best-esg-and-emissions-performers) — "WHITEPAPER"
- [European Stocks Enter Bear Market | Blog posts | STOXX](https://stoxx.com/european-stocks-enter-bear-market) — "WHITEPAPER"

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

---

### Momentum (Price Momentum)

<span style="background:red; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1,932 mentions across STOXX & ISS pages (high)">▰▰▰▰▰▰ 1,932</span>


> The tendency of securities that have performed well (poorly) over a recent period to continue performing well (poorly) in the near future. In index construction, momentum is typically measured as the total return over the past 6 to 12 months, often excluding the most recent month.

Momentum captures the market's tendency to trend. STOXX momentum indices select stocks with the strongest recent price performance, betting that winners keep winning for a while.

$$
\text{Momentum}_{i} = \frac{P_{i,t-1}}{P_{i,t-12}} - 1
$$

Commonly using a 12-month lookback with a 1-month skip.

> [!tip] Related terms
> [[#Factor Exposure]], [[#Factor Return]], [[#Realized Volatility]]




> [!quote] Monthly Index News April 2021 (PDF)
> MONTHLY INDEX NEWS / April 2021 ESG-X Factor Indices – Regional: Europe Key Points In Europe, the STOXX ESG-X Factor Indices showed a similar performance to the standard factor indices. Quality and **Momentum** outperformed in this group. Risk and Return Characteristics Return (%) Annualized volatility (%) EUR USD EUR USD 1M YTD 1Y 1M YTD 1Y 1M YTD 1Y 1M YTD 1Y 1. STOXX Europe 600 ESG-X Ax Low Risk...
> — [Monthly Index News April 2021 (PDF)](https://stoxx.com/monthly-index-news-april-2021)

> [!quote] Dax Equity Index Methodology Guide 5526498614 (PDF)
> % in the HDAX universe, measured in terms of price **momentum**, excluding companies with a past price history of less than 12 months. Companies with a past price history stretching back less than 12 months (e.g., IPOs and spin-offs) are not eligible for inclusion. The formula for calculating the price **momentum** of share i is set out below: 𝑡=𝑡𝑛 𝑃 𝑖𝑡 𝑃𝑟𝑖𝑐𝑒𝑀𝑜𝑚𝑒𝑛𝑡𝑢𝑚 = ∏( )−1 𝑖 𝑂 𝑖𝑡 𝑡=𝑡1 where: 𝑃 = clo...
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)

> [!quote] 20181101 Pearl Meyer (PDF)
> n assessment of company performance currently based on unadjusted Generally Accepted Accounting Principles (GAAP) accounting data. For 2019, ISS proposes to modify the FPA methodology to use Economic Value Added (EVA) metrics in place of unadjusted GAAP metrics. “EVA Spread,” “EVA Margin,” and “EVA **Momentum**” will replace Return on Assets (ROA), Return on Equity (ROE), Return on Invested Capital...
> — [20181101 Pearl Meyer (PDF)](https://www.issgovernance.com/file/policy/2019/comment/20181101_Pearl_Meyer.pdf)

> [!quote] Stoxx Minvar Paper (PDF)
> o assume that there is a return trade off; however there is much academic research and increasing empirical evidence that a minimum variance portfolio provides strong historical total returns and Sharpe ratios. This evidence has seen the MVP become much more commonplace across the marketplace, with **momentum** growing among institutional investors, mutual funds and ETF sponsors. STOXX has partnere...
> — [Stoxx Minvar Paper (PDF)](http://www.stoxx.com/document/Others/marketing/STOXX_MinVar_Paper.pdf)

> [!quote] Index Files Guide 20230619 (PDF)
> score available” or blank) Text 255 Scale Indices “Not traded on Xetra”, “30 Days Rule” Dax+ MaxDiv Indices, DivDAX and DivMSDAX “No dividend within next chaining period / dividend yield last period / rank value = minimum dividend yield next period”; “ADTV and/or Free-Float Market Cap and/or Price **Momentum** below limit” New Ranking of constituents, applicable for indices which 17 Rank 2 (FINAL) ...
> — [Index Files Guide 20230619 (PDF)](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)

**Sources:**
- [Monthly Index News April 2021 (PDF)](https://stoxx.com/monthly-index-news-april-2021)
- [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
- [20181101 Pearl Meyer (PDF)](https://www.issgovernance.com/file/policy/2019/comment/20181101_Pearl_Meyer.pdf)
- [Stoxx Minvar Paper (PDF)](http://www.stoxx.com/document/Others/marketing/STOXX_MinVar_Paper.pdf)
- [Index Files Guide 20230619 (PDF)](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)

---

## N

### Net Return

<span style="background:red; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1,332 mentions across STOXX & ISS pages (high)">▰▰▰▰▰▰ 1,332</span>


> The total return of an index calculated by reinvesting dividends after deducting the maximum applicable withholding tax rate for non-resident institutional investors. It provides a more realistic return measure for cross-border investors.

Net return is the after-tax version of total return. It reflects what a foreign institutional investor would actually receive after dividend withholding taxes are taken, making it the most commonly benchmarked return variant.

$$
\text{Net Return Index}_t = \text{Net Return Index}_{t-1} \times \frac{\sum_i w_i \cdot p_{i,t} + \sum_i w_i \cdot d_{i,t} \cdot (1 - \tau_i)}{\sum_i w_i \cdot p_{i,t-1}}
$$

Where $\tau_i$ is the applicable withholding tax rate for constituent $i$.

> [!tip] Related terms
> [[#Gross Return]], [[#Total Return]], [[#Dividend Yield]]




> [!quote] Dax Esg Equity Family Benchmark Statement (PDF)
> uption which results in the performance of the Index being unable to be tracked. Limitation Shall refer to circumstances where the Index Methodology contains an Insufficient Rule or Unclear Rule or if it fails to produce Index Values as intended. Examples: Data Insufficiency; Extreme Market Events. **Net Return** Index Shall mean an Index in which dividend payments are fully reinvested, calculated ...
> — [Dax Esg Equity Family Benchmark Statement (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Resources/Regulation/DAX_ESG_Equity_Family_Benchmark_Statement.pdf)

> [!quote] Ixarobu (PDF)
> ber of 80 components. It is adjusted equal-weighted and reviewed annually in June. The detailed methodology including the calculation formula can be found in our rulebooks: www.stoxx.com/rulebooks Versions and symbols Quick facts Index ISIN Symbol Bloomberg Reuters Weighting Adjusted Equal-weighted **Net Return** USD CH0325904388 IXAROBU IXAROBU INDEX .IXAROBU Cap factor None Price EUR CH0325904362...
> — [Ixarobu (PDF)](https://www.stoxx.com/document/Bookmarks/CurrentFactsheets/IXAROBU.pdf)

> [!quote] Dax Strategy Index Guide (PDF)
> is underperforming the standard **net return** index. The decrement index may perform better than the standard price index that does not consider dividend investments as long as the overall net dividend yield of the base index is greater than the value being subtracted. The base index is the DAX 50 ESG **Net Return** Index. Base value and dates: 1000 on September 24, 2012. 8.1.2. CALCULATION The index ...
> — [Dax Strategy Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)

> [!quote] Istoxx Index Guide (PDF)
> W The iSTOXX Europe Low Variance Adjusted Beta index leverages a low volatility investment, the iSTOXX Europe Low Risk Weighted 120 index, with the view to obtain a similar beta exposure as its underlying index, the STOXX Europe 600 index. Universe: The index universe is the iSTOXX Low Variance 120 **Net return** (EUR) (LVI) index. Index types and currencies: **Net return** in EUR The beta of the LVI (...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

> [!quote] Detailed Overview Of Equity Index Calculation Changes (PDF)
> Guidance - DAX Equity Index Calculation Cash dividends and bonus distributions are only corrected in performance and **net return** indices. Special distributions are taken account of in all performance, **net return**, and price indices. Within the framework of index calculation, the share price is thus modified by the amount of the respective cash distribution, as defined of Section 2.1. The cash div...
> — [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)

**Sources:**
- [Dax Esg Equity Family Benchmark Statement (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Resources/Regulation/DAX_ESG_Equity_Family_Benchmark_Statement.pdf)
- [Ixarobu (PDF)](https://www.stoxx.com/document/Bookmarks/CurrentFactsheets/IXAROBU.pdf)
- [Dax Strategy Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
- [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)

---

### Net Income

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="96 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 96</span>


> The total profit of a company after all expenses, taxes, interest, and depreciation have been subtracted from revenue. It is the "bottom line" of the income statement and the starting point for EPS calculation.

Net income is the final profit number that flows to shareholders. While not as clean as EVA or free cash flow for analytical purposes, it remains the most widely reported profitability metric and anchors the P/E ratio.

$$
\text{Net Income} = \text{Revenue} - \text{COGS} - \text{Operating Expenses} - \text{Interest} - \text{Taxes}
$$

> [!tip] Related terms
> [[#Earnings Per Share (EPS)]], [[#Revenue]], [[#EBITDA]], [[#Return on Equity (ROE)]]




> [!quote] Us Compensation Policies Faq (PDF)
> ation Profile from Standard & Poor's Compustat and Research Insight. Here is a link to their data dictionary. 10. How does Compustat calculate a company's TSRs and financial/operational measures? For information on how Compustat calculates TSR and financial/operational measures, such as revenue and **net income**, see the data dictionary. 11. Why does CEO pay as percent of revenue or **net income** sho...
> — [Us Compensation Policies Faq (PDF)](https://www.issgovernance.com/file/policy/2018/americas/US-Compensation-Policies-FAQ.pdf)

> [!quote] Istoxx Index Guide (PDF)
> nce Sheet Risk Score are calculated as following. The quality score is defined as the number of criteria that a company meets and can range from 0 to 9: - Return On Assets (ROA) greater than or equal to zero. The ROA is calculated as the **net income** before extraordinary items divided by total assets **net income** before extraordinary items ROA = t0 t0 total assets t0 - CFO ratio greater than or equ...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

> [!quote] Issuscompensationfaqs03282014 (PDF)
> Insight calculate company **net income** (loss)? ......................................................................... 9 13. Why is the CEO pay as percent of a company's revenue showing NA (not applicable)? .......................................... 9 14. Why is the CEO pay as percent of company's **net income** showing NA? ................................................................ 10 MANAGEM...
> — [Issuscompensationfaqs03282014 (PDF)](https://www.issgovernance.com/file/2014_Policies/ISSUSCompensationFAQs03282014.pdf)

> [!quote] Stoxx Index Guide (PDF)
> sidered FCF Free Cash Flow Net CapEx Capital Expenditure on Fixed Assets Mcap Free-float Market Capitalization Composition list: Each stock in the eligible universe is given a standardized score (z-score) for each of the 3 metrics: 12-month historical dividend yield, payout ratio and 3-year FCF (or **net income**) yield growth rate using the following calculation: ((cid:1876) −(cid:1876)̅) (cid:187...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] Western Union (PDF)
> Compared to Peers – 2012 All currency in USD 2008 2009 2010 2011 2012 IVZ FIS FISV NTRS AMP Earnings Invesco Fidelity Fiserv, Inc. Northern Ameriprise Ltd. National Trust Financial, Information Corporation Inc. Services, Inc. Revenue (M) 5,282 5,084 5,193 5,491 5,665 4,177 5,808 4,482 4,194 10,263 **Net Income** (M) 919 849 910 1,165 1,026 677 461 611 687 1,029 EBITDA (M) 1,582 1,508 1,536 1,650 1,...
> — [Western Union (PDF)](https://www.issgovernance.com/file/2013/02/western_union.pdf)

**Sources:**
- [Us Compensation Policies Faq (PDF)](https://www.issgovernance.com/file/policy/2018/americas/US-Compensation-Policies-FAQ.pdf)
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
- [Issuscompensationfaqs03282014 (PDF)](https://www.issgovernance.com/file/2014_Policies/ISSUSCompensationFAQs03282014.pdf)
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [Western Union (PDF)](https://www.issgovernance.com/file/2013/02/western_union.pdf)

---

### Net Operating Profit After Tax (NOPAT)

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="7 mentions across STOXX & ISS pages (low)">▰▰ 7</span>


> A company's after-tax operating profit, excluding the effects of capital structure (i.e., interest expense). NOPAT isolates the profitability of core business operations and is the starting point for EVA calculation.

NOPAT strips out how a company is financed and focuses purely on what the business earns from operations after tax. It is the numerator of the value creation equation in the ISS EVA framework.

$$
\text{NOPAT} = \text{Operating Profit} \times (1 - \text{Tax Rate})
$$

> [!tip] Related terms
> [[#Economic Value Added (EVA)]], [[#EVA Margin]], [[#Gross Profitability]]




> [!quote] Pay For Performance Mechanics (PDF)
> models (asset-heavy vs. asset- light), different business cycles, and companies with peers that span across multiple industries, among other cases. EVA represents the economic profit a company earns after meeting all its obligations – including the demands of capital providers. As a formula, EVA is net operating profit after taxes (NOPAT), less a capital charge computed by multiplying the firm’...
> — [Pay For Performance Mechanics (PDF)](https://www.issgovernance.com/file/policy/2022/americas/Pay-for-Performance-Mechanics.pdf)

> [!quote] European Pay For Performance Methodology Overview (PDF)
> below serves as guidance for understanding the methodology behind the EVA metrics and analysis displayed in the report. Economic Value Added (EVA). EVA represents the economic profit a company earns after meeting all its obligations – including the demands of capital providers. As a formula, EVA is net operating profit after taxes (NOPAT), less a capital charge computed by multiplying the firm’...
> — [European Pay For Performance Methodology Overview (PDF)](https://www.issgovernance.com/file/policy/2020/emea/European-Pay-for-Performance-Methodology-Overview.pdf)

> [!quote] Pay For Performance Mechanics (PDF)
> models (asset-heavy vs. asset-light), different business cycles, and companies with peers that span across multiple industries, among other cases. EVA represents the economic profit a company earns after meeting all its obligations – including the demands of capital providers. As a formula, EVA is net operating profit after taxes (NOPAT), less a capital charge computed by multiplying the firm’s...
> — [Pay For Performance Mechanics (PDF)](https://www.issgovernance.com/file/policy/2020/americas/Pay-for-Performance-Mechanics.pdf)

> [!quote] Pay For Performance Mechanics (PDF)
> models (asset-heavy vs. asset- light), different business cycles, and companies with peers that span across multiple industries, among other cases. EVA represents the economic profit a company earns after meeting all its obligations – including the demands of capital providers. As a formula, EVA is net operating profit after taxes (NOPAT), less a capital charge computed by multiplying the firm’...
> — [Pay For Performance Mechanics (PDF)](https://www.issgovernance.com/file/policy/active/americas/Pay-for-Performance-Mechanics.pdf)

> [!quote] ISS EVA | ISS
> ue, and Growth investment opportunities Global coverage Coverage spans 21,000+ companies globally, with historical data going back two decades Leading indicators EVA metrics could provide information that may lead to future stock prices DEFINING EVA EVA = Sales – Operating Costs* – Capital Costs ***Net operating profit after tax** Cost of cap% x net business assets EVA converts accounting profi...
> — [ISS EVA | ISS](https://www.issgovernance.com/eva) — "ISS EVA"

**Sources:**
- [Pay For Performance Mechanics (PDF)](https://www.issgovernance.com/file/policy/2022/americas/Pay-for-Performance-Mechanics.pdf)
- [European Pay For Performance Methodology Overview (PDF)](https://www.issgovernance.com/file/policy/2020/emea/European-Pay-for-Performance-Methodology-Overview.pdf)
- [Pay For Performance Mechanics (PDF)](https://www.issgovernance.com/file/policy/2020/americas/Pay-for-Performance-Mechanics.pdf)
- [Pay For Performance Mechanics (PDF)](https://www.issgovernance.com/file/policy/active/americas/Pay-for-Performance-Mechanics.pdf)
- [ISS EVA | ISS](https://www.issgovernance.com/eva) — "ISS EVA"

---

### Operating Margin

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1 mentions across STOXX & ISS pages (ultra-low)">▰ 1</span>


> The ratio of operating income (revenue minus operating expenses) to revenue, expressed as a percentage. It measures the proportion of revenue left after covering the costs of production and day-to-day operations, but before interest and taxes.

Operating margin isolates the profitability of the core business, stripping away financing and tax effects. It is one of the key quality metrics used in STOXX factor index construction and ISS governance screening.

$$
\text{Operating Margin} = \frac{\text{Operating Income}}{\text{Revenue}} \times 100\%
$$

> [!tip] Related terms
> [[#Gross Margin]], [[#EBITDA]], [[#Net Income]], [[#EVA Margin]]




> [!quote] Istoxx Index Guide (PDF)
> liabilities (also called current ratio) 1YΔLR =current ratio −current ratio t0 t0 t−1 - 1-year growth in the Number of Shares Outstanding (1YΔNBO) less than or equal to 5%7. number of shares outstanding 1YΔNBO = t0 −1 t0 number of shares outstanding t−1 - Positive or zero 1-year growth in the Gross **Operating Margin** (1YΔGOM). The GOM is calculated as the ratio of Gross Incomes to Sales. gross in...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

**Sources:**
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

---

## P

### PEG Ratio

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="2 mentions across STOXX & ISS pages (ultra-low)">▰ 2</span>


> The price-to-earnings ratio divided by the expected earnings growth rate. It adjusts the P/E ratio for growth, helping investors determine whether a stock's valuation is justified by its earnings growth trajectory.

PEG attempts to answer a question P/E alone cannot: "Is this high-P/E stock expensive, or is it just growing fast?" A PEG of 1.0 is often cited as fair value; below 1.0 suggests the stock may be undervalued relative to its growth.

$$
\text{PEG} = \frac{\text{P/E Ratio}}{\text{Annual EPS Growth Rate (\%)}}
$$

> [!tip] Related terms
> [[#Price-to-Earnings Ratio]], [[#Earnings Per Share (EPS)]], [[#Earnings Yield]]




> [!quote] Europe defense, AI take center stage at Deutsche Börse’s ETF Forum event amid...
> es a company’s P/E ratio with its expected earnings growth rate. The **PEG ratio** is calculated by dividing P/E by the annual earnings-per-share (EPS) growth rate, thereby accounting for how quickly earnings are growing and providing a more comprehensive view of a stock’s valuation. Figure 2 plots the **PEG ratio** on the vertical axis for three baskets representing defense stocks, industrial companie...
> — [Europe defense, AI take center stage at Deutsche Börse’s ETF Forum event amid...](https://stoxx.com/europe-defense-ai-take-center-stage-at-deutsche-borses-etf-forum-event-amid-stocks-rally) — "WHITEPAPER"

**Sources:**
- [Europe defense, AI take center stage at Deutsche Börse’s ETF Forum event amid stocks rally | Blog posts | STOXX](https://stoxx.com/europe-defense-ai-take-center-stage-at-deutsche-borses-etf-forum-event-amid-stocks-rally) — "WHITEPAPER"

---

### Price-to-Earnings Ratio

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="3 mentions across STOXX & ISS pages (ultra-low)">▰ 3</span>


> The ratio of a company's current share price to its earnings per share (EPS). It indicates how much investors are willing to pay for each unit of earnings and is a primary valuation metric in STOXX value and growth index classification.

P/E is the most widely quoted valuation metric. A high P/E suggests investors expect strong future growth; a low P/E may indicate undervaluation or declining prospects.

$$
\text{P/E} = \frac{\text{Price per Share}}{\text{Earnings per Share}}
$$

> [!tip] Related terms
> [[#Earnings Yield]], [[#Book-to-Price Ratio]], [[#Cash Flow Yield]], [[#Dividend Yield]]




> [!quote] Stoxx Infographic Stoxxeurope600 (PDF)
> eden 51.3 Luxembourg Finland 11.5 39.8 Denmark United Kingdom 202.6 211.7 Ireland Poland 15.9 15.7 France 149.7 Germany 251.8 Austria 19.8 Italy Portugal Spain Switzerland 82.9 8.2 95.7 248.0 Source: STOXX. Data as of March 31st, 2025. FORWARD PRICE-TO-EARNINGS (P/E) Valuation of European A forward **Price-to-Earnings ratio** shows Equities Is Low how a company’s current stock price compares to the...
> — [Stoxx Infographic Stoxxeurope600 (PDF)](https://stoxx.com/wp-content/uploads/2025/06/STOXX_Infographic_STOXXEurope600.pdf)

> [!quote] Stoxx European Equities Infographic 202404 (PDF)
> iconic brands, its stock universe offers Nestlé additional opportunities that may be lesser known. Moët Hennessy Louis Vuitton (LVMH) ATTRACTIVE European equities offer lower or comparable VALUATIONS valuations to most North American and Asian markets. Valuations as of Feb. 2024 Price-to-Book Ratio **Price-to-Earnings Ratio** EURO 2.2 14.9 On average, European STOXX 50 valuations are nearly 50% low...
> — [Stoxx European Equities Infographic 202404 (PDF)](https://stoxx.com/wp-content/uploads/2024/05/STOXX_European_Equities_Infographic_202404.pdf)

> [!quote] Sector watch: Europe bank stocks lead gains in 2024, have best year since 202...
> EURO STOXX® Banks index exchanged hands. Value sector While the banking sector in Europe lags behind others in terms of earnings growth, investors can nonetheless tap those profits at lower relative prices, following years of underperformance. The STOXX Europe 600 Banks index has the second-lowest **price-to-earnings ratio** among the 20 STOXX Europe 600 sector indices.[2] The Banks index has the h...
> — [Sector watch: Europe bank stocks lead gains in 2024, have best year since 202...](https://stoxx.com/sector-watch-europe-bank-stocks-have-second-best-year-ever) — "WHITEPAPER"

**Sources:**
- [Stoxx Infographic Stoxxeurope600 (PDF)](https://stoxx.com/wp-content/uploads/2025/06/STOXX_Infographic_STOXXEurope600.pdf)
- [Stoxx European Equities Infographic 202404 (PDF)](https://stoxx.com/wp-content/uploads/2024/05/STOXX_European_Equities_Infographic_202404.pdf)
- [Sector watch: Europe bank stocks lead gains in 2024, have best year since 2021 | Blog posts | STOXX](https://stoxx.com/sector-watch-europe-bank-stocks-have-second-best-year-ever) — "WHITEPAPER"

---

## R

### Realized Volatility

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="30 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 30</span>


> The actual historical volatility of an asset or index, computed as the standard deviation of returns over a past observation window. It is distinguished from implied volatility, which is forward-looking and derived from options prices.

Realized volatility looks backward to measure how bumpy the ride actually was. STOXX uses it to construct minimum-variance and low-volatility indices that favour calmer stocks.

$$
\sigma_{\text{realized}} = \sqrt{\frac{252}{n-1} \sum_{t=1}^{n} \left(r_t - \bar{r}\right)^2}
$$

Where $r_t$ are daily log returns and 252 is the standard annualization factor.

> [!tip] Related terms
> [[#Volatility]], [[#Standard Deviation]], [[#Beta]], [[#Value at Risk (VaR)]]




> [!quote] Stoxx Strategy Guide (PDF)
> . INDEX FORMULA FOR IMPLIED VOLATILITY INDICES 52 15.3.2. INDEX FORMULA FOR **REALIZED VOLATILITY** INDICES 12.1. OVERVIEW 39 53 15.3.3. DETERMINATION OF THE TARGET WEIGHT (TGTW) 12.2. BASIC DATA 39 USING IMPLIED VOLATILITY 53 15.3.4. DETERMINATION OF THE TARGET WEIGHT (TGTW) 12.3. CALCULATION 39 USING **REALIZED VOLATILITY** 54 12.3.1. INPUT DATA 39 15.3.5. DETERMINATION OF EQUITY WEIGHT (W) AND INDEX...
> — [Stoxx Strategy Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_strategy_guide.pdf)

> [!quote] Sx5Evbt (PDF)
> STRATEGY INDICES 2 EURO STOXX® 50 VOLATILITY-BALANCED INDEX Quick facts Methodology Weighting 97.5%/90%/70% To capture the anticipated changes in the volatility environment, the one-month **realized volatility** and the value of one-month implied Cap factor 2.5%/10%/30% volatility (VSTOXX) one-month back are observed. Depending on the relationship between realized and expected volatility, the expos...
> — [Sx5Evbt (PDF)](https://www.stoxx.com/document/Indices/Factsheets/2020/May/SX5EVBT.pdf)

> [!quote] Index Files Guide 20230619 (PDF)
> index closing value calculation. The reports include historical index and parameter values. The historical index value reports follow the standard format described in Section 2.1.5.  File name: close_xxxxx  File type: .csv  File specification: semicolon separated  File frequency: daily 2.4.4.1. **Realized volatility** Column Data Attribute Description Data Format ID Type 1 Date Report date Date...
> — [Index Files Guide 20230619 (PDF)](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)

> [!quote] Istoxx Index Guide (PDF)
> 23(4): Addition of iSTOXX Univest Emerging World Index, iSTOXX Global ESG Index in JPY, iSTOXX Global ESG Composite 150 Index and iSTOXX Global ESG Composite 150 GR Decrement 50 JPY Index » March 2023(5): Addition of iSTOXX MUTB Paris Aligned Index Family » April 2023: Correction in the formula for **Realized Volatility** in iSTOXX Global Transformation Select 30 NR Risk Control 10% Index, iSTOXX G...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

> [!quote] Why have emerging markets become less risky than their developed counterparts...
> d to be riskier than their developed counterparts. They haven’t been recently. Leon Serfaty, CFA. Leon is Principal at Qontigo’s Applied Research team, which provides unique insights into risk trends. For all of 2022 and into 2023, the STOXX® Emerging Markets 1500 index has shown lower forecast and **realized volatility** than the STOXX® Global 1800, a benchmark for developed economies (DMs). While...
> — [Why have emerging markets become less risky than their developed counterparts...](https://stoxx.com/why-have-emerging-markets-become-less-risky-than-their-developed-counterparts) — "WHITEPAPER"

**Sources:**
- [Stoxx Strategy Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_strategy_guide.pdf)
- [Sx5Evbt (PDF)](https://www.stoxx.com/document/Indices/Factsheets/2020/May/SX5EVBT.pdf)
- [Index Files Guide 20230619 (PDF)](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
- [Why have emerging markets become less risky than their developed counterparts? | Blog posts | STOXX](https://stoxx.com/why-have-emerging-markets-become-less-risky-than-their-developed-counterparts) — "WHITEPAPER"

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

---

### Return on Assets (ROA)

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="21 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 21</span>


> The ratio of net income to total assets, measuring how efficiently a company uses its entire asset base to generate profit. It is a key profitability metric in quality factor screening.

ROA answers: "For every dollar of assets the company controls, how many cents of profit does it produce?" It penalises asset-heavy businesses and rewards capital-light models, making it a useful complement to ROE.

$$
\text{ROA} = \frac{\text{Net Income}}{\text{Total Assets}} \times 100\%
$$

> [!tip] Related terms
> [[#Return on Equity (ROE)]], [[#Net Income]], [[#Gross Profitability]]




> [!quote] 20181101 Pearl Meyer (PDF)
> performance currently based on unadjusted Generally Accepted Accounting Principles (GAAP) accounting data. For 2019, ISS proposes to modify the FPA methodology to use Economic Value Added (EVA) metrics in place of unadjusted GAAP metrics. “EVA Spread,” “EVA Margin,” and “EVA Momentum” will replace **Return on Assets (ROA)**, Return on Equity (ROE), Return on Invested Capital (ROIC), Earnings Before...
> — [20181101 Pearl Meyer (PDF)](https://www.issgovernance.com/file/policy/2019/comment/20181101_Pearl_Meyer.pdf)

> [!quote] Istoxx Index Guide (PDF)
> ate is the last trading day of the month preceding the rebalancing date. At cutoff date, for each stock of the universe, a Quality Score and Balance Sheet Risk Score are calculated as following. The quality score is defined as the number of criteria that a company meets and can range from 0 to 9: - **Return On Assets (ROA)** greater than or equal to zero. The ROA is calculated as the net income bef...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

> [!quote] Pay For Performance Mechanics Dec 2016 (PDF)
> o years). ISS uses Compustat as the source for financial and TSR data. Metric definitions are below, along with the formula ISS uses for each calculation: Return on Invested Capital (ROIC) o Description: 3-Year Average Return on Invested Capital o Calculation: (ROIC[0Y] + ROIC[-1Y] + ROIC[-2Y]) / 3 **Return on Assets (ROA)** o Description: 3-Year Average **Return on Assets** o Calculation: (ROA[0Y] + R...
> — [Pay For Performance Mechanics Dec 2016 (PDF)](https://www.issgovernance.com/file/policy/pay-for-performance-mechanics-dec-2016.pdf)

> [!quote] Western Union (PDF)
> 1,619 1,008 1,629 1,423 2,171 1,784 EPS (USD) 1.26 1.21 1.37 1.85 1.70 1.50 1.85 4.40 2.82 4.71 EPS Y/Y Growth (%) 12 -4 13 35 -8 -5 13 28 14 0 Profitability Net Margin (%) 24 22 22 23 21 21 14 20 24 12 EBITDA Margin (%) 30 30 30 30 29 24 28 32 52 17 Return on Equity (%) 240 156 130 109 8 8 18 9 11 **Return on Assets** (%) 17 12 12 13 11 4 4 7 1 1 ROIC (%) 36 25 29 28 22 5 5 9 6 6 Liquidity Debt/As...
> — [Western Union (PDF)](https://www.issgovernance.com/file/2013/02/western_union.pdf)

> [!quote] Stoxx Index Guide (PDF)
> : Each company in the starting universe is evaluated within its respective group2. Companies must pass one of the two profitability definitions: 3.1. Profitability Leaders: o Companies must rank in the top 25% of their group in Gross Margin or, o Companies must rank in the top 25% of their group in **Return on Assets (ROA)** or, o Companies with a Gross Margin greater than or equal to 50%. 3.2. Pro...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

**Sources:**
- [20181101 Pearl Meyer (PDF)](https://www.issgovernance.com/file/policy/2019/comment/20181101_Pearl_Meyer.pdf)
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
- [Pay For Performance Mechanics Dec 2016 (PDF)](https://www.issgovernance.com/file/policy/pay-for-performance-mechanics-dec-2016.pdf)
- [Western Union (PDF)](https://www.issgovernance.com/file/2013/02/western_union.pdf)
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

### Return on Equity (ROE)

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="74 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 74</span>


> The ratio of net income to shareholders' equity, measuring how effectively a company generates profit from the money shareholders have invested. It is one of the most watched profitability metrics in equity analysis.

ROE tells you the return earned on the owners' stake in the business. High ROE can signal a competitive advantage, but it can also be inflated by excessive leverage, so it should be read alongside the debt-to-equity ratio.

$$
\text{ROE} = \frac{\text{Net Income}}{\text{Shareholders' Equity}} \times 100\%
$$

> [!tip] Related terms
> [[#Return on Assets (ROA)]], [[#Debt-to-Equity Ratio]], [[#Net Income]], [[#Earnings Per Share (EPS)]]




> [!quote] 20181101 Pearl Meyer (PDF)
> ased on unadjusted Generally Accepted Accounting Principles (GAAP) accounting data. For 2019, ISS proposes to modify the FPA methodology to use Economic Value Added (EVA) metrics in place of unadjusted GAAP metrics. “EVA Spread,” “EVA Margin,” and “EVA Momentum” will replace Return on Assets (ROA), **Return on Equity (ROE)**, Return on Invested Capital (ROIC), Earnings Before Interest, Tax, Depreci...
> — [20181101 Pearl Meyer (PDF)](https://www.issgovernance.com/file/policy/2019/comment/20181101_Pearl_Meyer.pdf)

> [!quote] Istoxx Index Guide (PDF)
> ified by ICB Industry Code 30 and 35.) need to have a positive sum of Net Property, Plant and Equipment, Inventories and Accounts Receivables to be eligible. » Liquidity: calculated as the three month Average Daily Traded Value (ADTV). The higher the liquidity, the higher the rank to be assigned. » **Return on Equity (ROE)**: calculated as Net Income divided by Shareholder’s Equity. The higher the ...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

> [!quote] Canada Executive Compensation Faq Dec 2015 (PDF)
> rics may vary considerably from industry to industry and from company to company depending on the company's particular business strategy at any given time. Therefore, the qualitative assessment of the company's pay for performance alignment may consider other measures of company performance such as **Return on Equity**, Return on Invested Capital, and other relevant metrics. Hence, ISS does not adv...
> — [Canada Executive Compensation Faq Dec 2015 (PDF)](https://www.issgovernance.com/file/policy/canada-executive-compensation-faq-dec-2015.pdf)

> [!quote] 2015Asia Pacificpolicyupdates (PDF)
> 2015 Asia-Pacific Proxy Voting Guidelines Updates › ISS will recommend a vote against top executive(s) of companies posting average **return on equity (ROE)** of less than five percent over the past five fiscal years, unless an improvement is observed (i.e., ROE was five percent or greater in the most recent fiscal year). › Starting in 2016, a new policy will be implemented to recommend a vote agai...
> — [2015Asia Pacificpolicyupdates (PDF)](https://www.issgovernance.com/file/policy/2015Asia-PacificPolicyUpdates.pdf)

> [!quote] 2015 Us Comp Faqs (PDF)
> would be at least 50 percent of the shares awarded to each of the named executive officers. Performance-based equity awards are earned or paid out based on the achievement of pre-established, measurable performance targets. The company should disclose the details of the performance criteria (e.g., **return on equity**) and the hurdle rates (e.g., 15 percent) associated with the performance awards a...
> — [2015 Us Comp Faqs (PDF)](https://www.issgovernance.com/file/policy/2015-us-comp-faqs.pdf)

**Sources:**
- [20181101 Pearl Meyer (PDF)](https://www.issgovernance.com/file/policy/2019/comment/20181101_Pearl_Meyer.pdf)
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
- [Canada Executive Compensation Faq Dec 2015 (PDF)](https://www.issgovernance.com/file/policy/canada-executive-compensation-faq-dec-2015.pdf)
- [2015Asia Pacificpolicyupdates (PDF)](https://www.issgovernance.com/file/policy/2015Asia-PacificPolicyUpdates.pdf)
- [2015 Us Comp Faqs (PDF)](https://www.issgovernance.com/file/policy/2015-us-comp-faqs.pdf)

---

### Revenue

<span style="background:red; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="4,654 mentions across STOXX & ISS pages (high)">▰▰▰▰▰▰ 4,654</span>


> The total amount of income generated by the sale of goods or services related to a company's primary operations, before any expenses are deducted. Also referred to as "top line" or "sales."

Revenue is the starting point of every profitability calculation. While it says nothing about whether the company is profitable, sustained revenue growth is a prerequisite for long-term value creation and is a key input to STOXX growth factor screens.

Revenue is reported as an absolute currency figure and does not have a ratio formula per se. Growth is commonly expressed as:

$$
\text{Revenue Growth} = \frac{\text{Revenue}_{t} - \text{Revenue}_{t-1}}{\text{Revenue}_{t-1}} \times 100\%
$$

> [!tip] Related terms
> [[#Net Income]], [[#Gross Margin]], [[#Operating Margin]], [[#EBITDA]]




> [!quote] European defense stocks: A look at purity through military revenues’ exposure...
> h portfolios’ exposure to military **revenue**s. Figure 3 shows that more than 80% of the STOXX Europe Targeted Defence is allocated to companies with a high share of military sales, as opposed to just under 40% for the sector benchmark. Figure 3: Index exposure (weight %) to ISS ESG Military Equipment **Revenue**s Military revenue tier performance Market returns suggest investors have favored exposure...
> — [European defense stocks: A look at purity through military revenues’ exposure...](https://stoxx.com/european-defense-stocks-a-look-at-purity-through-military-revenues-exposure) — "WHITEPAPER"

> [!quote] Global AI Revenue Seen Growing Twentyfold by 2025 | Blog posts | STOXX
> dologies: one follows a thematic approach based on **revenue** exposure, and the other uses a progressive concept tracking AI innovators selected by AI technology. The first one, the STOXX® Global Artificial Intelligence Index, is based on FactSet’s Revere industry hierarchy. Companies with the highest **revenue** exposure to pre-defined sectors are selected for the index. The second option is the STOX...
> — [Global AI Revenue Seen Growing Twentyfold by 2025 | Blog posts | STOXX](https://stoxx.com/global-ai-revenue-seen-growing-twentyfold-by-2025) — "WHITEPAPER"

> [!quote] Revenue-Based Thematic Indices | STOXX
> omy displaces established business models and industries. Digitalisation refers to the transformation of activities via intelligent technologies. At consumer level, this shift has been epitomized by the adoption of the mobile phone in our daily lives, but digitalisation has impacted all industries. **Revenue**s from global digital transformation are expected to expand at more than 20% a year this d...
> — [Revenue-Based Thematic Indices | STOXX](https://stoxx.com/thematic-indices/revenue-based-thematic-indices) — "WHITEPAPER"

> [!quote] carbon-revenue | ISS
> nt Logins ISS Data Desk ProxyExchange QualityScore (via Link) eSource ISS EVA Investor Express Securities Class Action Services Governance Analytics (Corporate Issuer Data Verification) Beacon(Retirement) Financial Clarity Flowspring Mortgage Clarity Simfund LiquidMetrix ISS Cyber Risk Score carbon-**revenue** Start typing and press Enter to search
> — [carbon-revenue | ISS](https://www.issgovernance.com/sustainability/climate-solutions/carbon-footprint-report/carbon-revenue) — "carbon-revenue"

> [!quote] 2013 Comprehensive US Compensation Policy | ISS
> ed as disclosed under the relevant termination scenario in the Change in Control Table and/or narrative of the proxy statement Financial Data — Total Shareholder Return and **Revenue** - Where does ISS obtain a company’s 1-year fiscal total shareholder return, 3-year fiscal total shareholder return and **revenue**? ISS obtains all financial data in the Compensation Profile from Standard & Poor’s Resear...
> — [2013 Comprehensive US Compensation Policy | ISS](https://www.issgovernance.com/policy-gateway/2013-comprehensive-us-compensation-policy) — "2013 Comprehensive US Compensation Policy"

**Sources:**
- [European defense stocks: A look at purity through military revenues’ exposure | Blog posts | STOXX](https://stoxx.com/european-defense-stocks-a-look-at-purity-through-military-revenues-exposure) — "WHITEPAPER"
- [Global AI Revenue Seen Growing Twentyfold by 2025 | Blog posts | STOXX](https://stoxx.com/global-ai-revenue-seen-growing-twentyfold-by-2025) — "WHITEPAPER"
- [Revenue-Based Thematic Indices | STOXX](https://stoxx.com/thematic-indices/revenue-based-thematic-indices) — "WHITEPAPER"
- [carbon-revenue | ISS](https://www.issgovernance.com/sustainability/climate-solutions/carbon-footprint-report/carbon-revenue) — "carbon-revenue"
- [2013 Comprehensive US Compensation Policy | ISS](https://www.issgovernance.com/policy-gateway/2013-comprehensive-us-compensation-policy) — "2013 Comprehensive US Compensation Policy"

---

### Risk-Adjusted Return

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="39 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 39</span>


> A return metric that accounts for the amount of risk taken to achieve it. Common expressions include the Sharpe ratio, Sortino ratio, and information ratio.

Raw returns can be misleading if one fund took enormous risk to achieve them. Risk-adjusted return normalizes performance by the volatility or downside risk endured, enabling fair comparisons.

$$
\text{Risk-Adjusted Return} = \frac{R_p - R_f}{\sigma_p}
$$

This is the general form (Sharpe ratio). Alternative specifications replace $\sigma_p$ with downside deviation (Sortino) or tracking error (Information ratio).

> [!tip] Related terms
> [[#Sharpe Ratio]], [[#Sortino Ratio]], [[#Information Ratio]], [[#Alpha]]




> [!quote] Artificial Intelligence Theme Gets Investors’ Attention | STOXX
> ff. Table 1 In 2020, markets have been rattled by the spread of the COVID-19 virus, so the trend may not persist. Should the volatility seen in February and March this year persist, a performance analysis of the AI indices would be warranted to understand the drivers and factors behind the returns. **Risk-adjusted return**s Yet absolute returns show only part of the story. Qontigo’s three AI indice...
> — [Artificial Intelligence Theme Gets Investors’ Attention | STOXX](https://stoxx.com/artificial-intelligence-theme-gets-investors-attention) — "WHITEPAPER"

> [!quote] The New Faces of Risk Management | Blog posts | STOXX
> at don’t state risk management as a primary role do actually play a part in risk control in as much as they address particular sources of market stress. That facet has only strengthened the appeal of those strategies in the eyes of investors in the post-crisis world. ESG – sustainability meets high **risk-adjusted return**s One example is environmental, social and governance (ESG) strategies. While...
> — [The New Faces of Risk Management | Blog posts | STOXX](https://stoxx.com/the-new-faces-of-risk-management) — "WHITEPAPER"

> [!quote] Stoxx Minvar Paper (PDF)
> STOXX LIMITED TABLE OF CONTENTS Introduction 4 1 Overview of minimum variance investing 5 2 Characteristics of a minimum variance portfolio (MVP) 7 3 Why minimum variance portfolios provide better **risk-adjusted return**s 9 4 Methodology of STOXX Minimum Variance Indices, highlighting the unique approach for the index series 11 5 A tale of two minimum variance indices 14 6 Minimum variance perform...
> — [Stoxx Minvar Paper (PDF)](http://www.stoxx.com/document/Others/marketing/STOXX_MinVar_Paper.pdf)

> [!quote] BlackRock and STOXX collaboration: iShares multi-factor ETFs track STOXX indi...
> role an investment plays in a portfolio. Integrating factors in a single investment allows us to seek outperformance from all of the factors, which means, for a similar level of performance, we don’t have to lean into any one factor as much. This means that, for a core exposure, we can improve our **risk-adjusted return**s. There are also operational benefits for the investor with an integrated sol...
> — [BlackRock and STOXX collaboration: iShares multi-factor ETFs track STOXX indi...](https://stoxx.com/blackrock-and-stoxx-collaboration-ishares-multi-factor-etfs-track-stoxx-indices-to-deliver-consistent-risk-managed-exposure-for-a-portfolios-core) — "WHITEPAPER"

> [!quote] Ossiam’s Lacroix: Maximizing the benefits of an ESG index strategy with an eq...
> : indices weighted by market capitalization are skewed towards mega-caps. For example, the top 20 holdings of the STOXX Europe 600 Index weigh 28%, compared to only 3.3% for the Equal Weight version as of December 31, 2021. Increased diversification limits idiosyncratic risks and improves long-term **risk-adjusted return**s. “The second driver of outperformance is the small-cap premium. The weight ...
> — [Ossiam’s Lacroix: Maximizing the benefits of an ESG index strategy with an eq...](https://stoxx.com/ossiams-lacroix-maximizing-the-benefits-of-an-esg-index-strategy-with-an-equal-weight-approach) — "WHITEPAPER"

**Sources:**
- [Artificial Intelligence Theme Gets Investors’ Attention | STOXX](https://stoxx.com/artificial-intelligence-theme-gets-investors-attention) — "WHITEPAPER"
- [The New Faces of Risk Management | Blog posts | STOXX](https://stoxx.com/the-new-faces-of-risk-management) — "WHITEPAPER"
- [Stoxx Minvar Paper (PDF)](http://www.stoxx.com/document/Others/marketing/STOXX_MinVar_Paper.pdf)
- [BlackRock and STOXX collaboration: iShares multi-factor ETFs track STOXX indices to deliver consistent, risk-managed exposure for a portfolio’s core | Blog posts | STOXX](https://stoxx.com/blackrock-and-stoxx-collaboration-ishares-multi-factor-etfs-track-stoxx-indices-to-deliver-consistent-risk-managed-exposure-for-a-portfolios-core) — "WHITEPAPER"
- [Ossiam’s Lacroix: Maximizing the benefits of an ESG index strategy with an equal-weight approach | Blog posts | STOXX](https://stoxx.com/ossiams-lacroix-maximizing-the-benefits-of-an-esg-index-strategy-with-an-equal-weight-approach) — "WHITEPAPER"

---

### Risk-Free Rate

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="27 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 27</span>


> The theoretical rate of return on an investment with zero risk of financial loss, typically proxied by the yield on short-term government securities such as U.S. Treasury bills or German Bunds. It serves as the baseline against which all risky investments are measured.

The risk-free rate is the anchor of modern portfolio theory. Every risk premium, every Sharpe ratio, and every CAPM calculation starts by subtracting this rate. In practice, it shifts with central bank policy and sovereign credit conditions.

The risk-free rate is observed from government bond yields rather than calculated from a formula. It is commonly denoted:

$$
R_f \approx \text{Yield on short-term government bonds}
$$

> [!tip] Related terms
> [[#Equity Risk Premium]], [[#Market Premium]], [[#Sharpe Ratio]], [[#Alpha]]




> [!quote] ECB Eyes Repo Market for Risk-Free Rate | Blog posts | STOXX
> The problem here: unsecured transactions have fallen to as low as 20% of the overall lending volume. EONIA is currently under review by its administrator amid concerns about its lack of representativeness. US and Swiss authorities have already resorted to the collateralized market to establish key **risk-free rate**s. Transparency sought for the bloodstream of financial markets The search for a tra...
> — [ECB Eyes Repo Market for Risk-Free Rate | Blog posts | STOXX](https://stoxx.com/ecb-eyes-repo-market-for-risk-free-rate) — "WHITEPAPER"

> [!quote] Bank credit spread contagion – how bad could it get? | Blog posts | STOXX
> ark blue line in Figure 1 shows the 5-year yield pickup of USD-denominated, single-A-rated bank bonds over **risk-free rate**s since 2007, while the green line represents the average spread of all corporate securities with the same currency and credit quality. Figure 1 – Average 5-year spreads over USD **risk-free rate**s for global corporates and banks As seen from the light blue area, the two major e...
> — [Bank credit spread contagion – how bad could it get? | Blog posts | STOXX](https://stoxx.com/bank-credit-spread-contagion-how-bad-could-it-get) — "WHITEPAPER"

> [!quote] Us Executive Compensation Policies Faq (PDF)
> UNITED STATES FAQ: EXECUTIVE COMPENSATION POLICIES Variable Item Source Comments U.S. Government Bond Yield on the date of grant corresponding to Dept of the term of the option. For example, if the option has a 10-year R Risk Free Rate Treasury term, the **risk-free rate** is the 10-year U.S. Government Bond Yield website on the date of grant. Term/Expected T Proxy Full term of the option. Life Bas...
> — [Us Executive Compensation Policies Faq (PDF)](https://www.issgovernance.com/file/policy/latest/americas/US-Executive-Compensation-Policies-FAQ.pdf)

> [!quote] Stoxx Strategy Guide (PDF)
> position in a series of STOXX index futures contracts. The excess return index replicates the financial outcome of a portfolio rolling the 1st nearby STOXX index futures contract into the 2nd nearby contract; the total return index, in addition, replicates the remuneration of the cash component at **risk-free rate**. The futures contracts series is not amended between roll dates. Rolling period ref...
> — [Stoxx Strategy Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_strategy_guide.pdf)

> [!quote] Istoxx Index Guide (PDF)
> return of 𝐼 ∗( 𝑆𝑡 +𝐷𝑖𝑣 ). In order to 𝑡−1 𝑆𝑡−1 𝑡 implement the Option strategy on that day and get exposure to the variation in the Option Portfolio Level, we need to borrow the cash amount corresponding to the current value of the Option Portfolio, which is equal to 𝑂𝑃𝐿𝑀𝑇𝑀 times the de-annualized **risk-free rate** used 𝑡−1 for borrowing. In formula: 𝑆𝐺𝐶𝑃𝑂𝑁 𝐴𝑐𝑡(𝑡−1,𝑡) ∆𝑂𝑃𝐿 = 𝑂𝑃𝐿 − 𝑂𝑃𝐿 −𝑂𝑃𝐿𝑀𝑇𝑀∗ 𝑡−1...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

**Sources:**
- [ECB Eyes Repo Market for Risk-Free Rate | Blog posts | STOXX](https://stoxx.com/ecb-eyes-repo-market-for-risk-free-rate) — "WHITEPAPER"
- [Bank credit spread contagion – how bad could it get? | Blog posts | STOXX](https://stoxx.com/bank-credit-spread-contagion-how-bad-could-it-get) — "WHITEPAPER"
- [Us Executive Compensation Policies Faq (PDF)](https://www.issgovernance.com/file/policy/latest/americas/US-Executive-Compensation-Policies-FAQ.pdf)
- [Stoxx Strategy Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_strategy_guide.pdf)
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

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

---

## S

### Sharpe Ratio

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="98 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 98</span>


> The ratio of a portfolio's excess return over the risk-free rate to its total standard deviation. Developed by William Sharpe, it is the most widely used measure of risk-adjusted performance.

The Sharpe ratio asks: "For every unit of total volatility I endured, how much extra return did I get beyond the risk-free rate?" Values above 1.0 are generally considered good; above 2.0, excellent.

$$
S = \frac{R_p - R_f}{\sigma_p}
$$

> [!tip] Related terms
> [[#Sortino Ratio]], [[#Information Ratio]], [[#Standard Deviation]], [[#Risk-Adjusted Return]]




> [!quote] Stoxx Index Guide (PDF)
> STOXX INDEX METHODOLOGY GUIDE 306/639 16. STOXX RISK BASED INDICES STOXX **SHARPE RATIO** INDICES 16.5.1. OVERVIEW The STOXX **Sharpe Ratio** indices include stocks from the respective benchmarks that have the highest Sharpe ratios, while excluding those with low dividend yields and low liquidity. Universe: STOXX Global 1800 for the Global version, STOXX [Region] 600 for the reg
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] Istoxx Index Guide (PDF)
> iSTOXX® METHODOLOGY GUIDE 377/1024 24. iSTOXX DYNAMIC STYLE INDICES 𝒙 = number of daily returns (20, 40, 60) 𝑼 = index value on day t 𝒕 𝒄𝒖𝒕𝒐𝒇𝒇 = data cut-off date (four dissemination days before review date) In case that for at least one window (20-, 40-, or 60-day) the average return in the **Sharpe ratio** calculation for both the Value and Income index is negative the **Sharpe ratio** formula is rep...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

> [!quote] Stoxx Minvar Paper (PDF)
> ust be answered to provide clarity in the industry. With the focus on reduction of risk, it is natural to assume that there is a return trade off; however there is much academic research and increasing empirical evidence that a minimum variance portfolio provides strong historical total returns and **Sharpe ratio**s. This evidence has seen the MVP become much more commonplace across the marketplace...
> — [Stoxx Minvar Paper (PDF)](http://www.stoxx.com/document/Others/marketing/STOXX_MinVar_Paper.pdf)

> [!quote] Dax Strategy Index Guide (PDF)
> 2 − Methodology Change of quarterly Review Process by introduction of the quarterly underlying data announcement and preponement of review schedule to 2nd Friday (t-5) for DivDAX, DivMSDAX, DAXplus Seasonal Strategy, DAXplus Export Strategy, DAXplus Family, DAXplus Minimum Variance, DAXplus Maximum **Sharpe Ratio**, idDAX 50 Equal Weight, DAX Equal Weight, DAX ESG Target, DAX ESG Screened, MDAX ESG...
> — [Dax Strategy Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)

> [!quote] Technical Migration New Index Data Distribution System And New File Formats F... (PDF)
> 0Z23Q23 .DXFAMT Return Net DAXplus Maximum Dividend EUR DE000A2L0415 DXMDIVNR BBG00WS5PZV8 .DAXMDIVNR Return DAXplus Maximum Dividend EUR Price DE000A0XXEA4 DXMDIVPR BBG000RRHSB8 .DAXMDIVPR Total DAXplus Maximum Dividend EUR DE000A0XXDZ3 DXMDIVTR BBG000RRHVV9 .DAXMDIVTR Return Total DAXplus Maximum **Sharpe Ratio** Germany EUR DE000A0METL2 DXMSG BBG000WCDLT5 .DAXMSG Return Total DAXplus Maximum Sha...
> — [Technical Migration New Index Data Distribution System And New File Formats F... (PDF)](https://www.stoxx.com/document/News/2023/March/Technical_Migration-New_Index_Data_Distribution_System_and_New_File_Formats_for_DAX_Indices_20230327_3457284624.pdf)

**Sources:**
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
- [Stoxx Minvar Paper (PDF)](http://www.stoxx.com/document/Others/marketing/STOXX_MinVar_Paper.pdf)
- [Dax Strategy Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)
- [Technical Migration New Index Data Distribution System And New File Formats For Dax Indices 20230327 3457284624 (PDF)](https://www.stoxx.com/document/News/2023/March/Technical_Migration-New_Index_Data_Distribution_System_and_New_File_Formats_for_DAX_Indices_20230327_3457284624.pdf)

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

---

### Standard Deviation

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="330 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 330</span>


> A statistical measure of the dispersion of returns around their mean. In finance, it serves as the primary measure of total risk (volatility).

Standard deviation tells you how spread out an investment's returns are. A higher standard deviation means wider swings in value and therefore greater uncertainty about future outcomes.

$$
\sigma = \sqrt{\frac{1}{n-1}\sum_{t=1}^{n}(r_t - \bar{r})^2}
$$

> [!tip] Related terms
> [[#Volatility]], [[#Realized Volatility]], [[#Sharpe Ratio]], [[#Tracking Error]]




> [!quote] Axioma Multi Asset Class Risk Monitor (PDF)
> lass Standalone Volatilities and Volatility Contributions 7.-8. Analysis is based on a multi-asset class model portfolio in Axioma Risk. Short-term risk numbers are based on daily unweighted returns over 60 business days. Long-term risk uses weekly returns over five years with a one-year half-life. **Standard Deviation** (Standalone) is the volatility of the bucket independent of the overall portfo...
> — [Axioma Multi Asset Class Risk Monitor (PDF)](https://stoxx.com/axioma-multi-asset-class-risk-monitor)

> [!quote] Europeansummaryguidelines (PDF)
> s shall remain subject to performance criteria for all beneficiaries. Finally, for large- and mid-cap companies, the company's average three year unadjusted burn rate (or, if lower, on the maximum volume per year implied by the proposal made at the general meeting) must not exceed the mean plus one **standard deviation** of its sector but no more than one percentage point from the prior year sector...
> — [Europeansummaryguidelines (PDF)](https://www.issgovernance.com/file/2014_Policies/EuropeanSummaryGuidelines.pdf)

> [!quote] Stoxx Index Guide (PDF)
> sity value for company (i) at time (t) (cid:2919)(cid:2930) X(cid:3365) = Mean of the sample (cid:2929) S = **Standard Deviation** of the sample (cid:2929) For the STOXX Global Climate Change Leaders and the EURO STOXX 50 Low Carbon index: Calculate the Z-Score for the population (the population mean & **standard deviation** are calculated): x − X(cid:3365) (cid:2919)(cid:2930) (cid:2926) z = (cid:2919...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] Dax Equity Index Methodology Guide 5526498614 (PDF)
> rn and the risk-free return, divided by the portfolio’s **standard deviation**. 𝑟 =𝜋 ⋅𝑥 +⋯+𝜋 ⋅𝑥 𝑝 1 1 𝑛 𝑛 𝑆ℎ𝑎𝑟𝑒 𝑖𝐸𝑛𝑑𝑜𝑓𝑡ℎ𝑒𝑦𝑒𝑎𝑟 𝜋 =𝑙𝑛( ) 𝑖 𝑆ℎ𝑎𝑟𝑒 𝑖𝐵𝑒𝑔𝑖𝑛𝑛𝑖𝑛𝑔𝑜𝑓𝑡ℎ𝑒𝑦𝑒𝑎𝑟−1 𝜋 = annual return of constituent i =1, …, 40 𝑖 𝑟 = designated return for the entire portfolio 𝑝 𝜎 𝑃𝑜𝑟𝑡𝑓𝑜𝑙𝑖𝑜 =√𝜎 𝑃 2 𝑜𝑟𝑡𝑓𝑜𝑙𝑖𝑜 𝜎 𝑃𝑜𝑟𝑡𝑓𝑜𝑙𝑖𝑜 = **standard deviation** of the entire portfolio 𝑟 = risk-free return on the capital market 𝑓 Following...
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)

> [!quote] Dax Strategy Index Guide (PDF)
> tility is a measure of the level of uncertainty prevailing in certain markets, or with respect to individual underlying instruments. In principle, there are two different approaches for the estimation of volatility: on the one hand, it is possible to determine historical volatility by measuring the **standard deviation** of prices for any particular security over a given period of time. On the othe...
> — [Dax Strategy Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)

**Sources:**
- [Axioma Multi Asset Class Risk Monitor (PDF)](https://stoxx.com/axioma-multi-asset-class-risk-monitor)
- [Europeansummaryguidelines (PDF)](https://www.issgovernance.com/file/2014_Policies/EuropeanSummaryGuidelines.pdf)
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
- [Dax Strategy Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)

---

### Spread (Credit)

<span style="background:red; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1,131 mentions across STOXX & ISS pages (high)">▰▰▰▰▰▰ 1,131</span>


> The difference in yield between a corporate bond (or other credit instrument) and a risk-free government bond of comparable maturity. It compensates the investor for default risk, liquidity risk, and other credit-related uncertainties.

Credit spread is the market's real-time verdict on a borrower's riskiness. When spreads widen, investors are demanding more compensation for the perceived risk of default; when they tighten, confidence is rising.

$$
\text{Credit Spread} = Y_{\text{corporate}} - Y_{\text{risk-free}}
$$

Typically expressed in basis points.

> [!tip] Related terms
> [[#Basis Point]], [[#Yield Curve]], [[#Duration (Bond)]], [[#Risk-Free Rate]]




> [!quote] Axioma Multi Asset Class Risk Monitor (PDF)
> Analysis Date | 2024-08-30 Axioma Multi-Asset Class Risk Monitor Figure 1. Factor Correlations (60 days) and Changes in Correlations (vs previous 60 days) 1. Correlations are unweighted and based on daily returns and changes in yield/**spread** over the past 60 business days. The lower left triangle of the matrix represents current correlations. The upper right triangle contains changes in correlat...
> — [Axioma Multi Asset Class Risk Monitor (PDF)](https://stoxx.com/axioma-multi-asset-class-risk-monitor)

> [!quote] Catholic Us Voting Guidelines (PDF)
> ducts they receive from those contractors have not been made using forced labor, child labor, or sweatshop labor. These companies are asked to adopt formal vendor standards that, among other things, include some sort of monitoring mechanism. Globalization, relocation of production overseas, and widespread use of subcontractors and vendors, often make it difficult to obtain a complete picture of...
> — [Catholic Us Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2018/specialty/Catholic-US-Voting-Guidelines.pdf)

> [!quote] Sustainability International Policy Updates (PDF)
> R 2022 Meanwhile, it is recognized that there is a case for greater flexibility in shareholder meeting formats given the COVID-19 pandemic. Therefore, Sustainability Advisory Services supports article amendments allowing companies to hold virtual only meetings only in unusual situations such as the **spread** of an infectious disease or the occurrence of a natural disaster. Australia While there is...
> — [Sustainability International Policy Updates (PDF)](https://www.issgovernance.com/file/policy/2022/specialty/Sustainability-International-Policy-Updates.pdf)

> [!quote] Sri International Voting Guidelines (PDF)
> ) during the most recently concluded financial year under review professional services[4] to the company, to an affiliate of the company, or to an individual officer of the company or of one of its affiliates in the last fiscal year in excess of USD 10,000 per year; ▪ Represents customer, supplier, creditor, banker, or other entity with which the company maintains a transactional/commercial rel...
> — [Sri International Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/active/specialty/SRI-International-Voting-Guidelines.pdf)

> [!quote] Istoxx Index Guide (PDF)
> OIL & GAS EW 124. ISTOXX BDFG ESG INDICES 906 INDEX 877 124.1. iSTOXX BDFG ESG INDICES 906 121.1. iSTOXX BANK AUTO AND OIL & GAS EW INDEX OVERVIEW 906 877 INDEX REVIEW 906 OVERVIEW 877 ONGOING MAINTENANCE 907 INDEX FORMULA 877 125. EURO iSTOXX 50 GR DECREMENT TRF 122. EURO iSTOXX ALH CTB INDEX 878 **SPREAD** 10X INDEX 908 122.1. EURO iSTOXX ALH CTB INDEX 878 125.1. EURO iSTOXX 50 GR DECREMENT TRF O...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

**Sources:**
- [Axioma Multi Asset Class Risk Monitor (PDF)](https://stoxx.com/axioma-multi-asset-class-risk-monitor)
- [Catholic Us Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2018/specialty/Catholic-US-Voting-Guidelines.pdf)
- [Sustainability International Policy Updates (PDF)](https://www.issgovernance.com/file/policy/2022/specialty/Sustainability-International-Policy-Updates.pdf)
- [Sri International Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/active/specialty/SRI-International-Voting-Guidelines.pdf)
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

---

## T

### Total Return

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="668 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 668</span>


> The complete return on an investment including both price appreciation and income from dividends or interest, assuming all distributions are reinvested. STOXX publishes total return indices in both gross and net variants.

Total return captures the full picture: not just whether the stock price went up, but also the dividends you collected along the way. It is the only honest way to evaluate long-term investment performance.

$$
R_{\text{total}} = \frac{P_{t} + D_{t} - P_{t-1}}{P_{t-1}}
$$

Where $P_t$ is the price at time $t$ and $D_t$ is the dividend received.

> [!tip] Related terms
> [[#Gross Return]], [[#Net Return]], [[#Annualized Return]], [[#Dividend Yield]]




> [!quote] Pandemic Fuels Trading in EURO STOXX 50 Dividend and Total Return Futures | B...
> t in EURO STOXX Banks Index dividend futures **Total return** futures A record 1.9 million **total return** futures on the EURO STOXX 50 Index traded in March this year (Figure 4). Last month, volume amounted to 2.5 times the monthly average of 2019. Figure 4 – Traded volume and open interest EURO STOXX 50 Total Return Futures TRFs provide cost-efficient access to the total returns of an underlying ind...
> — [Pandemic Fuels Trading in EURO STOXX 50 Dividend and Total Return Futures | B...](https://stoxx.com/pandemic-fuels-trading-in-euro-stoxx-50-dividend-and-total-return-futures) — "WHITEPAPER"

> [!quote] Qontigo and Eurex Launch First Collateral Indices Total Return Futures | STOXX
> updates monthly to include eligible securities. The listed, centrally cleared futures tracking the index offer analogous performance to total-return swaps with reduced counterparty risk, capital costs, collateral usage and bilateral margining charges. Gaining exposure to the implied repo rate “The **total return** futures provide cost-efficient access to the **total return**s of Europe’s benchmark blue...
> — [Qontigo and Eurex Launch First Collateral Indices Total Return Futures | STOXX](https://stoxx.com/qontigo-and-eurex-launch-first-collateral-indices-total-return-futures) — "WHITEPAPER"

> [!quote] Eurex, STOXX expand Equity and Basket Total Return Futures collaboration with...
> Read more: Q&A with Eurex: Switching OTC swaps to a capital-efficient alternative under Uncleared Margin Rules | For more details on the ETRF/BTRF offering, please visit: Trade Equity & Basket TRFs at Eurex | Improved Capital Efficiency. For additional information on Index TRFs, please visit Index **Total Return** Futures | Eurex Listed **Total Return** Swaps.
> — [Eurex, STOXX expand Equity and Basket Total Return Futures collaboration with...](https://stoxx.com/eurex-stoxx-expand-equity-and-basket-total-return-futures-collaboration-with-new-etrfs-on-us-stocks) — "WHITEPAPER"

> [!quote] Q&amp;A with Eurex’s Stuart Heath: STOXX Europe 600 total return futures | Bl...
> to forecast and bake dividends into the calculation of forward prices – it’s done automatically. So, they have less pricing sensitivity to dividends than do price-return futures and therefore help users avoid dividend risk.” Who are the main users of TRFs? “Because TRFs are designed to reflect the **total return** of the index, they serve a different purpose than do traditional index futures. One o...
> — [Q&amp;A with Eurex’s Stuart Heath: STOXX Europe 600 total return futures | Bl...](https://stoxx.com/qa-with-eurexs-stuart-heath-stoxx-europe-600-total-return-futures) — "WHITEPAPER"

> [!quote] STOXX Europe 600 index underlies new Total Return Futures on Eurex | Blog pos...
> Eurex has introduced **Total Return** Futures (TRFs) on the STOXX® Europe 600[1], expanding an increasingly popular type of exchange-traded derivatives to a broad pan-European benchmark for the first time. The new product was listed on September 30 and follows in the footsteps of strong demand for EURO STOXX® 50 index TRFs.
> — [STOXX Europe 600 index underlies new Total Return Futures on Eurex | Blog pos...](https://stoxx.com/stoxx-europe-600-index-underlies-new-total-return-futures-on-eurex) — "WHITEPAPER"

**Sources:**
- [Pandemic Fuels Trading in EURO STOXX 50 Dividend and Total Return Futures | Blog posts | STOXX](https://stoxx.com/pandemic-fuels-trading-in-euro-stoxx-50-dividend-and-total-return-futures) — "WHITEPAPER"
- [Qontigo and Eurex Launch First Collateral Indices Total Return Futures | STOXX](https://stoxx.com/qontigo-and-eurex-launch-first-collateral-indices-total-return-futures) — "WHITEPAPER"
- [Eurex, STOXX expand Equity and Basket Total Return Futures collaboration with new ETRFs on US stocks | Blog posts | STOXX](https://stoxx.com/eurex-stoxx-expand-equity-and-basket-total-return-futures-collaboration-with-new-etrfs-on-us-stocks) — "WHITEPAPER"
- [Q&amp;A with Eurex’s Stuart Heath: STOXX Europe 600 total return futures | Blog posts | STOXX](https://stoxx.com/qa-with-eurexs-stuart-heath-stoxx-europe-600-total-return-futures) — "WHITEPAPER"
- [STOXX Europe 600 index underlies new Total Return Futures on Eurex | Blog posts | STOXX](https://stoxx.com/stoxx-europe-600-index-underlies-new-total-return-futures-on-eurex) — "WHITEPAPER"

---

### Tracking Error

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="537 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 537</span>


> The standard deviation of the difference between a portfolio's returns and its benchmark's returns. It measures the consistency of a portfolio's deviation from its benchmark, also known as active risk.

Tracking error quantifies how tightly a fund follows its benchmark. An index-tracking ETF should have near-zero tracking error; an active manager with high conviction will have a large one.

$$
\text{TE} = \sigma(R_p - R_b) = \sqrt{\frac{1}{n-1}\sum_{t=1}^{n}\bigl[(R_{p,t} - R_{b,t}) - \overline{(R_p - R_b)}\bigr]^2}
$$

> [!tip] Related terms
> [[#Active Return]], [[#Information Ratio]], [[#Standard Deviation]]




> [!quote] Tracking error: making sense of a key investment statistic | Blog posts | STOXX
> hese days with the growth of sustainable strategies. While the pursuit of environmental, social or governance (ESG) objectives can exist outside the traditional risk/return matrix, in reality, returns and risk cannot simply be ignored. This notion is a key reason why many sustainable strategies are **tracking error**-aware. With this in mind, a new article[1] from Hamish Seegopaul, Global Head for ...
> — [Tracking error: making sense of a key investment statistic | Blog posts | STOXX](https://stoxx.com/tracking-error-making-sense-of-a-key-investment-statistic) — "WHITEPAPER"

> [!quote] Tracking error: making sense of a key investment statistic | Blog posts | STOXX
> hese days with the growth of sustainable strategies. While the pursuit of environmental, social or governance (ESG) objectives can exist outside the traditional risk/return matrix, in reality, returns and risk cannot simply be ignored. This notion is a key reason why many sustainable strategies are **tracking error**-aware. With this in mind, a new article[1] from Hamish Seegopaul, Global Head for ...
> — [Tracking error: making sense of a key investment statistic | Blog posts | STOXX](https://stoxx.com/tracking-error-making-sense-of-a-key-investment-statistic) — "WHITEPAPER"

> [!quote] Tracking Error 101: The Intuition Behind Measurement and Control | Whitepaper...
> This article provides a high-level refresher of what **tracking error** means, and how we can embed it directly into portfolio construction. When we design a benchmarked portfolio, every design choice that takes us away from the benchmark has a consequence, and every consequence has a risk. **Tracking error** (TE) – the humble statistic that serves as a measu
> — [Tracking Error 101: The Intuition Behind Measurement and Control | Whitepaper...](https://stoxx.com/tracking-error-101-the-intuition-behind-measurement-and-control) — "WHITEPAPER"

> [!quote] Tracking Error 101: The Intuition Behind Measurement and Control | Whitepaper...
> This article provides a high-level refresher of what **tracking error** means, and how we can embed it directly into portfolio construction. When we design a benchmarked portfolio, every design choice that takes us away from the benchmark has a consequence, and every consequence has a risk. **Tracking error** (TE) – the humble statistic that serves as a measu
> — [Tracking Error 101: The Intuition Behind Measurement and Control | Whitepaper...](https://stoxx.com/tracking-error-101-the-intuition-behind-measurement-and-control) — "WHITEPAPER"

> [!quote] APG, BlackRock and the SDI AOP: Ways to align portfolios with the UN SDGs | B...
> tfolio that invests with all criteria, including the SDGs (Figure 1). Figure 1 – iSTOXX APG RI index family The trade-off between impact and **tracking error** Hamish Seegopaul, Head of Index R&D at Qontigo, explained during the panel that one overall aim of the iSTOXX APG RI indices is to minimize the **tracking error** to the benchmark, a key consideration for benchmark-focused investors. “There is a...
> — [APG, BlackRock and the SDI AOP: Ways to align portfolios with the UN SDGs | B...](https://stoxx.com/apg-blackrock-and-the-sdi-aop-ways-to-align-portfolios-with-the-un-sdgs) — "WHITEPAPER"

> [!quote] APG, BlackRock and the SDI AOP: Ways to align portfolios with the UN SDGs | B...
> tfolio that invests with all criteria, including the SDGs (Figure 1). Figure 1 – iSTOXX APG RI index family The trade-off between impact and **tracking error** Hamish Seegopaul, Head of Index R&D at Qontigo, explained during the panel that one overall aim of the iSTOXX APG RI indices is to minimize the **tracking error** to the benchmark, a key consideration for benchmark-focused investors. “There is a...
> — [APG, BlackRock and the SDI AOP: Ways to align portfolios with the UN SDGs | B...](https://stoxx.com/apg-blackrock-and-the-sdi-aop-ways-to-align-portfolios-with-the-un-sdgs) — "WHITEPAPER"

> [!quote] Green efficient frontiers: Minimizing the risk impact of exclusions in sustai...
> or is consistently lower for the optimized portfolio over time. Furthermore, the analysts also found a more consistent stream of active returns in the optimized portfolio relative to the standard one. How does the optimizer work? The authors then explore how the optimizer is able to achieve a lower **tracking error** and what the resulting portfolio looks like. The study shows that the optimized po...
> — [Green efficient frontiers: Minimizing the risk impact of exclusions in sustai...](https://stoxx.com/green-efficient-frontiers-minimizing-the-risk-impact-of-exclusions-in-sustainable-portfolios) — "WHITEPAPER"

> [!quote] Green efficient frontiers: Minimizing the risk impact of exclusions in sustai...
> or is consistently lower for the optimized portfolio over time. Furthermore, the analysts also found a more consistent stream of active returns in the optimized portfolio relative to the standard one. How does the optimizer work? The authors then explore how the optimizer is able to achieve a lower **tracking error** and what the resulting portfolio looks like. The study shows that the optimized po...
> — [Green efficient frontiers: Minimizing the risk impact of exclusions in sustai...](https://stoxx.com/green-efficient-frontiers-minimizing-the-risk-impact-of-exclusions-in-sustainable-portfolios) — "WHITEPAPER"

> [!quote] Market Consultation Stoxx Index 20250925 (PDF)
> Budget Risk is calculated 𝑗 𝑐𝑎𝑟𝑏𝑜𝑛 𝑏𝑢𝑑𝑔𝑒𝑡 𝑖,𝑗 as: 𝐶𝐵𝑅 = 𝑖 ∑𝜑 𝑗 𝐶𝐵𝑅 𝑖 ∑𝑐𝑎𝑟𝑏𝑜𝑛 𝑏𝑢𝑑𝑔𝑒𝑡 − ∑𝑐𝑎𝑟𝑏𝑜𝑛 𝑒𝑚𝑖𝑠𝑠𝑖𝑜𝑛𝑠 𝑖,𝑗 𝑖,𝑘 =− where: ∑𝑐𝑎𝑟𝑏𝑜𝑛 𝑏𝑢𝑑𝑔𝑒𝑡 𝑖,𝑗 𝜑 𝑗 =(1−𝜆)∗𝜆𝑗, 𝑗 Where: =0,… ,2050−𝑐𝑢𝑟𝑟𝑒𝑛𝑡 𝑦𝑒𝑎𝑟 j = 2020, …, 2050 𝜆=0.94 (standard decay factor) k = 2020, …, current year e Add tracking At most 1.5% ex-ante **tracking error** relative to the error parent index. To compute the **tracking error**, constraint STOX...
> — [Market Consultation Stoxx Index 20250925 (PDF)](https://www.stoxx.com/document/Resources/MarketConsultation/Market_Consultation_STOXX_Index_20250925.pdf)

> [!quote] Market Consultation Stoxx Index 20250925 (PDF)
> Budget Risk is calculated 𝑗 𝑐𝑎𝑟𝑏𝑜𝑛 𝑏𝑢𝑑𝑔𝑒𝑡 𝑖,𝑗 as: 𝐶𝐵𝑅 = 𝑖 ∑𝜑 𝑗 𝐶𝐵𝑅 𝑖 ∑𝑐𝑎𝑟𝑏𝑜𝑛 𝑏𝑢𝑑𝑔𝑒𝑡 − ∑𝑐𝑎𝑟𝑏𝑜𝑛 𝑒𝑚𝑖𝑠𝑠𝑖𝑜𝑛𝑠 𝑖,𝑗 𝑖,𝑘 =− where: ∑𝑐𝑎𝑟𝑏𝑜𝑛 𝑏𝑢𝑑𝑔𝑒𝑡 𝑖,𝑗 𝜑 𝑗 =(1−𝜆)∗𝜆𝑗, 𝑗 Where: =0,… ,2050−𝑐𝑢𝑟𝑟𝑒𝑛𝑡 𝑦𝑒𝑎𝑟 j = 2020, …, 2050 𝜆=0.94 (standard decay factor) k = 2020, …, current year e Add tracking At most 1.5% ex-ante **tracking error** relative to the error parent index. To compute the **tracking error**, constraint STOX...
> — [Market Consultation Stoxx Index 20250925 (PDF)](https://www.stoxx.com/document/Resources/MarketConsultation/Market_Consultation_STOXX_Index_20250925.pdf)

**Sources:**
- [Tracking error: making sense of a key investment statistic | Blog posts | STOXX](https://stoxx.com/tracking-error-making-sense-of-a-key-investment-statistic) — "WHITEPAPER"
- [Tracking Error 101: The Intuition Behind Measurement and Control | Whitepapers | STOXX](https://stoxx.com/tracking-error-101-the-intuition-behind-measurement-and-control) — "WHITEPAPER"
- [APG, BlackRock and the SDI AOP: Ways to align portfolios with the UN SDGs | Blog posts | STOXX](https://stoxx.com/apg-blackrock-and-the-sdi-aop-ways-to-align-portfolios-with-the-un-sdgs) — "WHITEPAPER"
- [Green efficient frontiers: Minimizing the risk impact of exclusions in sustainable portfolios | Blog posts | STOXX](https://stoxx.com/green-efficient-frontiers-minimizing-the-risk-impact-of-exclusions-in-sustainable-portfolios) — "WHITEPAPER"
- [Market Consultation Stoxx Index 20250925 (PDF)](https://www.stoxx.com/document/Resources/MarketConsultation/Market_Consultation_STOXX_Index_20250925.pdf)

---

### Turnover

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="724 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 724</span>


> In index methodology, the proportion of an index's weight that changes at each rebalancing, reflecting the cost of maintaining the portfolio. It is typically expressed as one-way turnover (the sum of additions or deletions, not both).

Turnover measures how much trading an index forces at each rebalance. Higher turnover means higher transaction costs and potential tax consequences for funds tracking the index.

$$
\text{Turnover} = \frac{1}{2}\sum_{i=1}^{N}\left|w_{i,\text{new}} - w_{i,\text{old}}\right|
$$

> [!tip] Related terms
> [[#Weighted Average]], [[#Tracking Error]]




> [!quote] DAX Index Grows to 40 Constituents – Looking at Impact on Market Cap and Liqu...
> lion from EUR 40.8 billion, Qontigo data show. While most entrants are smaller than existing constituents, there is one exception with Airbus SE. The maker of airplanes is the fifth-largest company on the Frankfurt Stock Exchange (FSE), but had up to now failed to enter the DAX as its local trading **turnover** was smaller than that of other candidate stocks. Elimination of **turnover** requirement Tha...
> — [DAX Index Grows to 40 Constituents – Looking at Impact on Market Cap and Liqu...](https://stoxx.com/dax-index-grows-to-40-constituents-looking-at-impact-on-market-cap-and-liquidity) — "WHITEPAPER"

> [!quote] New Whitepaper Looks at Trading Characteristics of EURO STOXX 50 ESG Index | ...
> Larger portfolios would lead to longer trading periods. “This increase in the time taken to trade is unlikely to be a huge concern in the case of portfolio sizes of similar order of magnitude,” the authors write. Figure 1 – Increase in estimated trading days for the index over the benchmark Higher **turnover** Because the EURO STOXX 50 ESG Index is reviewed and rebalanced every quarter, as opposed ...
> — [New Whitepaper Looks at Trading Characteristics of EURO STOXX 50 ESG Index | ...](https://stoxx.com/new-whitepaper-looks-at-trading-characteristics-of-euro-stoxx-50-esg-index) — "WHITEPAPER"

> [!quote] Evaluating the true cost of momentum investing | Blog posts | STOXX
> sal in the past month. Limiting **turnover** in a world of fast information decay Portfolios are constantly trading newly available information, but must do so bearing transaction costs in mind. Because today there is a high information decay – faster, real-time news becomes old news soon – the rate of **turnover** becomes a crucial component. The iSTOXX Factor indices have a monthly turnover limit of ...
> — [Evaluating the true cost of momentum investing | Blog posts | STOXX](https://stoxx.com/evaluating-the-true-cost-of-momentum-investing) — "WHITEPAPER"

> [!quote] DAX Index Grows to 40 Constituents – Looking at Impact on Market Cap and Liqu...
> lion from EUR 40.8 billion, Qontigo data show. While most entrants are smaller than existing constituents, there is one exception with Airbus SE. The maker of airplanes is the fifth-largest company on the Frankfurt Stock Exchange (FSE), but had up to now failed to enter the DAX as its local trading **turnover** was smaller than that of other candidate stocks. Elimination of **turnover** requirement Tha...
> — [DAX Index Grows to 40 Constituents – Looking at Impact on Market Cap and Liqu...](https://stoxx.com/dax-index-grows-to-40-constituents-looking-at-impact-on-market-cap-and-liquidity) — "WHITEPAPER"

> [!quote] New Whitepaper Looks at Trading Characteristics of EURO STOXX 50 ESG Index | ...
> Larger portfolios would lead to longer trading periods. “This increase in the time taken to trade is unlikely to be a huge concern in the case of portfolio sizes of similar order of magnitude,” the authors write. Figure 1 – Increase in estimated trading days for the index over the benchmark Higher **turnover** Because the EURO STOXX 50 ESG Index is reviewed and rebalanced every quarter, as opposed ...
> — [New Whitepaper Looks at Trading Characteristics of EURO STOXX 50 ESG Index | ...](https://stoxx.com/new-whitepaper-looks-at-trading-characteristics-of-euro-stoxx-50-esg-index) — "WHITEPAPER"

> [!quote] Evaluating the true cost of momentum investing | Blog posts | STOXX
> sal in the past month. Limiting **turnover** in a world of fast information decay Portfolios are constantly trading newly available information, but must do so bearing transaction costs in mind. Because today there is a high information decay – faster, real-time news becomes old news soon – the rate of **turnover** becomes a crucial component. The iSTOXX Factor indices have a monthly turnover limit of ...
> — [Evaluating the true cost of momentum investing | Blog posts | STOXX](https://stoxx.com/evaluating-the-true-cost-of-momentum-investing) — "WHITEPAPER"

> [!quote] New ESG-X Select Dividend Indices Combine Income Strategy with Sustainability...
> ional market, hence choosing stand-out payers in each market and avoiding unintended country tilts. Those ranked highest enter the index whenever an existing constituent falls below a pre-determined threshold. In this way, current members are given precedence over candidate stocks to keep the index **turnover** low. The indices are price-weighted with a weighting factor based on the dividend yield....
> — [New ESG-X Select Dividend Indices Combine Income Strategy with Sustainability...](https://stoxx.com/new-esg-x-select-dividend-indices-combine-income-sustainability) — "WHITEPAPER"

> [!quote] New ESG-X Select Dividend Indices Combine Income Strategy with Sustainability...
> ional market, hence choosing stand-out payers in each market and avoiding unintended country tilts. Those ranked highest enter the index whenever an existing constituent falls below a pre-determined threshold. In this way, current members are given precedence over candidate stocks to keep the index **turnover** low. The indices are price-weighted with a weighting factor based on the dividend yield....
> — [New ESG-X Select Dividend Indices Combine Income Strategy with Sustainability...](https://stoxx.com/new-esg-x-select-dividend-indices-combine-income-sustainability) — "WHITEPAPER"

> [!quote] Stoxx World Equity Index Guide (PDF)
> , the liquidity requirements can be lowered or the period index review can be postponed to the next quarterly review date. In such cases, the composition remains unchanged, but new weighting factors will be implemented. Market participants will be notified of such changes in a timely manner. 4.4.2. **TURNOVER** RATIO The annualized **turnover** ratio is defined as the median value of the daily traded v...
> — [Stoxx World Equity Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)

> [!quote] Stoxx World Equity Index Guide (PDF)
> , the liquidity requirements can be lowered or the period index review can be postponed to the next quarterly review date. In such cases, the composition remains unchanged, but new weighting factors will be implemented. Market participants will be notified of such changes in a timely manner. 4.4.2. **TURNOVER** RATIO The annualized **turnover** ratio is defined as the median value of the daily traded v...
> — [Stoxx World Equity Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)

**Sources:**
- [DAX Index Grows to 40 Constituents – Looking at Impact on Market Cap and Liquidity | Blog posts | STOXX](https://stoxx.com/dax-index-grows-to-40-constituents-looking-at-impact-on-market-cap-and-liquidity) — "WHITEPAPER"
- [New Whitepaper Looks at Trading Characteristics of EURO STOXX 50 ESG Index | Blog posts | STOXX](https://stoxx.com/new-whitepaper-looks-at-trading-characteristics-of-euro-stoxx-50-esg-index) — "WHITEPAPER"
- [Evaluating the true cost of momentum investing | Blog posts | STOXX](https://stoxx.com/evaluating-the-true-cost-of-momentum-investing) — "WHITEPAPER"
- [New ESG-X Select Dividend Indices Combine Income Strategy with Sustainability Screenings | Blog posts | STOXX](https://stoxx.com/new-esg-x-select-dividend-indices-combine-income-sustainability) — "WHITEPAPER"
- [Stoxx World Equity Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)

---

## V

### Value at Risk (VaR)

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="83 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 83</span>


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




> [!quote] Monthly Index News April 2022 (PDF)
> MONTHLY INDEX NEWS / April 2022 Climate Indices - Willis Towers Watson Climate Transition Indices Key points The STOXX Willis Towers Watson Climate Transition Indices (CTI) employ a unique Climate Transition **Value at Risk** (CTVaR) methodology that quantifies the anticipated impact of an economic transition on equity valuations. The CTIs enable a more sophisticated way of managing climate transit...
> — [Monthly Index News April 2022 (PDF)](https://stoxx.com/monthly-index-news-april-2022)

> [!quote] Stoxx Index Guide (PDF)
> ition Indices is to align a broad based equity index, from a valuation and financial perspective, with a global economic transition that would limit greenhouse gas concentrations to levels consistent with United Nations objectives for global temperature rises. The index relies on Climate Transition **Value at Risk** (CTVaR) metrics from Willis Towers Watson, and incorporates screens for Global Stan...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] Financial Impact of Transition Risk and Opportunities | ISS
> and how investors need to assess their portfolios’ exposure to transition risks and opportunities as companies aim to achieve their Net Zero targets. Our team of climate experts provide an overview of the concept of transition risk analysis, explain the methodology behind our new Climate Transition **Value at Risk** Solution and review the changes that have been made to the ISS ESG Climate Impact R...
> — [Financial Impact of Transition Risk and Opportunities | ISS](https://www.issgovernance.com/financial-impact-of-transition-risk-and-opportunities) — "Financial Impact of Transition Risk and Opportunities"

> [!quote] WTW: Why it is key to manage a portfolio’s climate-transition risk beyond car...
> current expectations are for the value of a company, and then we compare them to what those cash flows look like once we apply climate-transition scenarios. The difference between the two is what we view to be the financial risk for each company.” This is the premise behind WTW’s Climate Transition **Value at Risk** (CTVaR) measure, which quantifies the anticipated impact on equity and fixed-income...
> — [WTW: Why it is key to manage a portfolio’s climate-transition risk beyond car...](https://stoxx.com/wtw-why-it-is-key-to-manage-a-portfolios-climate-transition-risk-beyond-carbon-emissions) — "WHITEPAPER"

> [!quote] Willis Towers Watson and Qontigo launch pioneering STOXX Global Index Series ...
> omy that values and manages climate risks. “Investors need a robust framework that can quantify and incorporate the financial impact of climate risk, but this is something that just hasn’t been widely available until now. We believe that understanding this transition, through our Climate Transition **Value at Risk** methodology (CTVaR), should be one of the biggest sources of alpha across all asset...
> — [Willis Towers Watson and Qontigo launch pioneering STOXX Global Index Series ...](https://stoxx.com/willis-towers-watson-and-qontigo-launch-pioneering-stoxx-global-index-series-that-quantifies-the-climate-transition-risk-of-companies) — "WHITEPAPER"

**Sources:**
- [Monthly Index News April 2022 (PDF)](https://stoxx.com/monthly-index-news-april-2022)
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [Financial Impact of Transition Risk and Opportunities | ISS](https://www.issgovernance.com/financial-impact-of-transition-risk-and-opportunities) — "Financial Impact of Transition Risk and Opportunities"
- [WTW: Why it is key to manage a portfolio’s climate-transition risk beyond carbon emissions | Blog posts | STOXX](https://stoxx.com/wtw-why-it-is-key-to-manage-a-portfolios-climate-transition-risk-beyond-carbon-emissions) — "WHITEPAPER"
- [Willis Towers Watson and Qontigo launch pioneering STOXX Global Index Series that quantifies the climate transition risk of companies | Press releases | STOXX](https://stoxx.com/willis-towers-watson-and-qontigo-launch-pioneering-stoxx-global-index-series-that-quantifies-the-climate-transition-risk-of-companies) — "WHITEPAPER"

---

### Volatility

<span style="background:deeppink; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="10,785 mentions across STOXX & ISS pages (ultra-high)">▰▰▰▰▰▰▰ 10,785</span>


> A general term for the degree of variation in a trading price series over time. In quantitative finance, it is most commonly measured as the annualized standard deviation of returns.

Volatility is the heartbeat of financial markets. Low volatility means calm, predictable price action; high volatility means wild swings. STOXX uses it to build minimum-variance and low-volatility indices.

$$
\sigma_{\text{ann}} = \sigma_{\text{daily}} \times \sqrt{252}
$$

> [!tip] Related terms
> [[#Realized Volatility]], [[#Standard Deviation]], [[#Beta]], [[#Value at Risk (VaR)]]




> [!quote] August market turmoil highlights benefit of dynamic volatility allocation  | ...
> . A systematic allocation model Investing in protection against **volatility** can represent a significant drag on returns during stable or bull markets. As such, replacing a fixed hedge allocation with a systematic and flexible one can make a crucial difference for overall results. At the heart of the **Volatility**-Balanced index’s methodology and allocation model is a prevailing volatility environme...
> — [August market turmoil highlights benefit of dynamic volatility allocation  | ...](https://stoxx.com/august-market-turmoil-highlights-benefit-of-dynamic-volatility-allocation) — "WHITEPAPER"

> [!quote] Low Volatility’s Edge in Europe | Blog posts | STOXX
> atility, low-**volatility** strategies have managed to do well,” Daniel Ung, Senior Smart Beta ETF Strategist at SSGA, said in an interview. “Meanwhile, the US has seen extraordinary growth for years and the economy is going into a late-cycle phase, something that often accompanies heightened levels of **volatility**,” Ung added. Naturally more volatile The EURO STOXX Low Risk Weighted 100 Index repres...
> — [Low Volatility’s Edge in Europe | Blog posts | STOXX](https://stoxx.com/low-volatilitys-edge-in-europe) — "WHITEPAPER"

> [!quote] Q&amp;A with Eurex and STOXX: A perspective on volatility indices | Blog post...
> how both indices track market sentiment and what they are telling us about “market fear” right now. Matthew Koren, Eurex Thomas Shuttlewood, STOXX Thomas, let’s start with an introduction of what VSTOXX measures and how the index is calculated. “The VSTOXX aims to reflect the market expectation of **volatility** over a given time period, with the main VSTOXX index covering 30 days. It does so by me...
> — [Q&amp;A with Eurex and STOXX: A perspective on volatility indices | Blog post...](https://stoxx.com/qa-with-eurex-and-stoxx-a-perspective-on-volatility-indices) — "WHITEPAPER"

> [!quote] Volatility – An Investable Asset Class | Blog posts | STOXX
> Ever since the onset of the financial crisis in 2008, **volatility** has become a critical aspect for investors to consider in their portfolios. The slump in asset prices and the jump in the price of options offering downside protection reflected what is a fundamental variable in investment returns. **Volatility** – a measure of the level of uncertainty in fin
> — [Volatility – An Investable Asset Class | Blog posts | STOXX](https://stoxx.com/volatility-an-investable-asset-class) — "WHITEPAPER"

> [!quote] Low Volatility Strategies: Why the Wheels Came Off (Temporarily) in 2020 | Wh...
> any ways, it has also produced results in Low **Volatility** strategies counter to these expectations. As with so many aspects of our lives in “the new normal” of today, many components of Low **Volatility** strategies have similarly been upended. However, we do not believe this is the “new normal” for Low Volatility.
> — [Low Volatility Strategies: Why the Wheels Came Off (Temporarily) in 2020 | Wh...](https://stoxx.com/low-volatility-strategies-why-the-wheels-came-off-temporarily-in-2020) — "WHITEPAPER"

**Sources:**
- [August market turmoil highlights benefit of dynamic volatility allocation  | Blog posts | STOXX](https://stoxx.com/august-market-turmoil-highlights-benefit-of-dynamic-volatility-allocation) — "WHITEPAPER"
- [Low Volatility’s Edge in Europe | Blog posts | STOXX](https://stoxx.com/low-volatilitys-edge-in-europe) — "WHITEPAPER"
- [Q&amp;A with Eurex and STOXX: A perspective on volatility indices | Blog posts | STOXX](https://stoxx.com/qa-with-eurex-and-stoxx-a-perspective-on-volatility-indices) — "WHITEPAPER"
- [Volatility – An Investable Asset Class | Blog posts | STOXX](https://stoxx.com/volatility-an-investable-asset-class) — "WHITEPAPER"
- [Low Volatility Strategies: Why the Wheels Came Off (Temporarily) in 2020 | Whitepapers | STOXX](https://stoxx.com/low-volatility-strategies-why-the-wheels-came-off-temporarily-in-2020) — "WHITEPAPER"

---

## W

### Weighted Average

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="189 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 189</span>


> A calculation in which each constituent's value is multiplied by its index weight before summation, producing an aggregate that reflects the relative importance of each component. Used extensively in index-level statistics such as weighted-average P/E, dividend yield, and market capitalisation.

A simple average treats all stocks equally; a weighted average gives larger stocks more influence. Nearly every aggregate index statistic you see -- average P/E, average yield, average beta -- is a weighted average.

$$
\bar{x}_w = \sum_{i=1}^{N} w_i \cdot x_i \quad \text{where} \quad \sum_{i=1}^{N} w_i = 1
$$

> [!tip] Related terms
> [[#Turnover]], [[#Factor Exposure]], [[#Return Attribution]]




> [!quote] Climate Analytics | ISS
> bsolute and intensity greenhouse gas emissions data from production emissions (as reported to the United Nations Framework Convention on Climate Change (UNFCCC)), aligned with the PCAF methodology - Scope 1, LULUCF emissions and relevant emissions intensities of sub-sovereigns - Includes the TCFD’s **weighted average** carbon intensity by scope. Transition Risk and Climate Policy Ratification, incl...
> — [Climate Analytics | ISS](https://www.issgovernance.com/sustainability/climate-solutions/climate-analytics) — "SUSTAINABILITY SOLUTIONS/CLIMATE SOLUTIONS"

> [!quote] Equity Plan Data Verification (PDF)
> ars, as used in the computation of basic EPS? This question asks how many **weighted average** common shares were outstanding in the past 3 fiscal years, as used in the computation of basic EPS. For real estate investment trusts (REITs) that issue operating partnership (OP) units, OP units are added to **weighted average** common shares outstanding. Equity Grant Activity 21. What is the total number of...
> — [Equity Plan Data Verification (PDF)](http://www.issgovernance.com/file/faq/equity-plan-data-verification.pdf)

> [!quote] Dax Equity Index Methodology Guide 5526498614 (PDF)
> uncement, STOXX will announce at earliest possible date the breaches with an implementation for the capping 3 trading days later. For the avoidance of doubt, the announced review will be implemented first, and any re-calculation of weighting cap factors shall be implemented thereafter. 5.12. VOLUME-**WEIGHTED AVERAGE** PRICE The volume-**weighted average** price (VWAP) is defined as the sum of the prod...
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)

> [!quote] Pay For Performance Mechanics (PDF)
> rank, in a similar fashion to the operation of the Relative Degree of Alignment (RDA) test, creating a relative financial performance result. This may range from -100 to +100, with -100 representing high pay for low performance. A negative result indicates that the CEO pay rank is greater than the **weighted average** financial performance rank, and a positive result means that the CEO pay rank is ...
> — [Pay For Performance Mechanics (PDF)](https://www.issgovernance.com/file/policy/2018/americas/Pay-for-Performance-Mechanics.pdf)

> [!quote] Asia Pacific Policy Updates (PDF)
> nt smaller than 10 percent of the amount that the board has authority to authority to grant a certain amount of stock options, it still requires grant. shareholders' approval. Exercise price Up to 70 percent discount to the reference price that is the arithmetic The arithmetic average of the volume-**weighted average** share price of average of the volume-**weighted average** share price of one month, ...
> — [Asia Pacific Policy Updates (PDF)](https://www.issgovernance.com/file/policy/2018/updates/Asia-Pacific-Policy-Updates.pdf)

**Sources:**
- [Climate Analytics | ISS](https://www.issgovernance.com/sustainability/climate-solutions/climate-analytics) — "SUSTAINABILITY SOLUTIONS/CLIMATE SOLUTIONS"
- [Equity Plan Data Verification (PDF)](http://www.issgovernance.com/file/faq/equity-plan-data-verification.pdf)
- [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
- [Pay For Performance Mechanics (PDF)](https://www.issgovernance.com/file/policy/2018/americas/Pay-for-Performance-Mechanics.pdf)
- [Asia Pacific Policy Updates (PDF)](https://www.issgovernance.com/file/policy/2018/updates/Asia-Pacific-Policy-Updates.pdf)

---

## Y

### Yield Curve

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="12 mentions across STOXX & ISS pages (low)">▰▰ 12</span>


> A graphical representation of the relationship between bond yields and their maturities, typically for government securities. A normal (upward-sloping) curve indicates that longer-term bonds pay higher yields; an inverted curve, where short-term rates exceed long-term rates, has historically been a recession predictor.

The yield curve is one of the most watched indicators in finance. Its shape reflects market expectations about future interest rates, inflation, and economic growth. STOXX fixed-income indices are segmented by maturity buckets that correspond to different points on the curve.

The yield curve is an empirical observation rather than a single formula. The term structure can be modelled as:

$$
y(t) = \beta_0 + \beta_1 \cdot e^{-t/\tau} + \beta_2 \cdot \frac{t}{\tau} \cdot e^{-t/\tau}
$$

This is the Nelson-Siegel model, where $\beta_0$ is the long-run level, $\beta_1$ captures slope, $\beta_2$ captures curvature, and $\tau$ is a decay parameter.

> [!tip] Related terms
> [[#Duration (Bond)]], [[#Spread (Credit)]], [[#Risk-Free Rate]], [[#Basis Point]]




> [!quote] How moves in bond yield curves affect the International Real Estate Index | B...
> negative exposure to term spreads in Europe since 2019 (a widening of the term spread in that region would negatively impact the index’s returns), although that changed in 2021. Throughout the entire period (2019-2022), the index has largely had a positive exposure to the US term spread, as the US **yield curve** steepened. The exposures to the US, European, UK and Japanese term-spread factors, com...
> — [How moves in bond yield curves affect the International Real Estate Index | B...](https://stoxx.com/how-moves-in-bond-yield-curves-affect-the-international-real-estate-index) — "WHITEPAPER"

> [!quote] Axioma Multi Asset Class Risk Monitor (PDF)
> ad volatilities (light blue bars in the middle) are shown on a different scale (on the right hand side) compared to the return volatilities of equity indices, currencies and commodities. The white bars represent volatilities from the previous 60 business day period. Figure 3. Government Zero Coupon **Yield Curve**s US EU GB JP 3. Zero coupon bond curves built from vanilla bonds issued by the respec...
> — [Axioma Multi Asset Class Risk Monitor (PDF)](https://stoxx.com/axioma-multi-asset-class-risk-monitor)

> [!quote] Stocks Fall in August on Trade, Growth Woes | Blog posts | STOXX
> ts economy contracted in the three months to June, and China released data that pointed to the slowest economic growth in 27 years in the second quarter. That same day, the yield on 10-year Treasuries went below the yield on two-year notes for the first time since 2007, a so-called inversion of the **yield curve** that economists say is a harbinger of recessions. Losses span world Twenty-two of the...
> — [Stocks Fall in August on Trade, Growth Woes | Blog posts | STOXX](https://stoxx.com/stocks-fall-in-august-on-trade-growth-woes) — "WHITEPAPER"

> [!quote] The New Active-Passive Debate | Blog posts | STOXX
> sive equity funds in a portfolio can yield the best returns.1 The two approaches perform differently depending on market timing and type, as well as on particular conditions such as the level of correlation between stocks, the dispersion of earnings estimates and even the shape of the US Treasury’s **yield curve**. A greater breadth of capabilities For asset managers, the shift of focus in the acti...
> — [The New Active-Passive Debate | Blog posts | STOXX](https://stoxx.com/the-new-active-passive-debate) — "WHITEPAPER"

> [!quote] Minimum Variance Indices: A Reading Through Geopolitical Risk | Blog posts | ...
> e months from December 2018 during which the US and China were in promising trade negotiations; the run-up to the 2017 French presidential election; rising inflation fears in January 2018; an escalation of the trade war rhetoric between China and the US in May 2019; the inversion of the US Treasury **yield curve** in July 2019; the immediate aftermath of an initial ‘Brexit’ agreement in December 20...
> — [Minimum Variance Indices: A Reading Through Geopolitical Risk | Blog posts | ...](https://stoxx.com/minimum-variance-indices-a-reading-through-geopolitical-risk) — "WHITEPAPER"

**Sources:**
- [How moves in bond yield curves affect the International Real Estate Index | Blog posts | STOXX](https://stoxx.com/how-moves-in-bond-yield-curves-affect-the-international-real-estate-index) — "WHITEPAPER"
- [Axioma Multi Asset Class Risk Monitor (PDF)](https://stoxx.com/axioma-multi-asset-class-risk-monitor)
- [Stocks Fall in August on Trade, Growth Woes | Blog posts | STOXX](https://stoxx.com/stocks-fall-in-august-on-trade-growth-woes) — "WHITEPAPER"
- [The New Active-Passive Debate | Blog posts | STOXX](https://stoxx.com/the-new-active-passive-debate) — "WHITEPAPER"
- [Minimum Variance Indices: A Reading Through Geopolitical Risk | Blog posts | STOXX](https://stoxx.com/minimum-variance-indices-a-reading-through-geopolitical-risk) — "WHITEPAPER"

---

> [!info] Disclaimer
> Definitions are synthesised from publicly available STOXX and ISS Governance
> documentation for educational purposes. Always consult the latest official
> methodology guides for authoritative specifications.
