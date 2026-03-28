---
title: "ISS & STOXX Glossary — Smart Beta & Factors"
description: "Comprehensive glossary of factor investing, smart beta strategies, and quantitative methodology from STOXX and ISS Governance."
tags:
  - stoxx
  - iss
  - financial-domain
  - glossary
  - smart-beta
aliases:
  - "Smart Beta & Factors Glossary"
date: 2026-03-28
---

# Smart Beta & Factors — ISS & STOXX Glossary

> [!abstract] About This Section
> This glossary covers factor investing strategies, smart beta methodologies,
> factor definitions, and quantitative portfolio construction concepts. Terms are
> sourced from [STOXX](https://stoxx.com/) official documentation and methodology
> guides.
>
> **~45 terms** across multiple sources.

---

## A

### Accruals

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="30 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 30</span>


> The non-cash component of reported earnings, computed as the difference between
> net income and operating cash flow, scaled by total assets. In STOXX factor
> indices, high accruals are treated as a **negative quality signal** — firms with
> lower accruals are considered higher quality because their earnings are backed
> by real cash flows.

In plain terms, accruals measure how much of a company's reported profit is "paper profit" versus actual cash received. Companies where earnings mostly come from cash are viewed as higher quality because paper profits can be reversed or manipulated.

$$
\text{Accruals Ratio} = \frac{\text{Net Income} - \text{Operating Cash Flow}}{\text{Total Assets}}
$$

> [!tip] Related terms
> [[#Quality Factor]], [[#Net Operating Assets (Changes in)]], [[#Alpha Signal]]




> [!quote] Stoxx Index Guide (PDF)
> l is z-scored using the Parent Index weights and truncated at +/- 3 standard deviations. The Momentum Factor combines the Signals at 25%, 50% and 25% weights, respectively, and is again z-scored and truncated at +/-3 standard deviations. The Quality Factor is a composite of the following 6 Signals: **Accruals**, Dilution, Gross Profitability, Change in Net Operating Assets (NOA), Carbon Emissions I...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] Istoxx Index Guide (PDF)
> ore extraordinary items divided by total assets net income before extraordinary items ROA = t0 t0 total assets t0 - CFO ratio greater than or equal to zero. The ratio is calculated as Cash Flow from Operation (CFO) divided by total assets cash flow from operation CFO Ratio = t0 t0 total assets t0 - **Accruals** less than or equal to zero. **Accruals** are calculated as ROA minus CFO Ratio Accruals =ROA...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

> [!quote] Q&amp;A: Credit Suisse’s Froehlich on Multi-Premia Investing | Blog posts | S...
> at there is less overweighting of large caps. And thirdly, multi premia gains exposure to very diverse factor premia. Normally, for a fund tracking a market-cap-weighted flagship index such as the EURO STOXX 50 Index, you have a matching futures market to equitize cash. How do you equitize dividend **accruals** in the case of the CSIF (Lux) Equity EURO STOXX Multi Premia fund? As there are no perfe...
> — [Q&amp;A: Credit Suisse’s Froehlich on Multi-Premia Investing | Blog posts | S...](https://stoxx.com/qa-credit-suisses-froehlich-on-multi-premia-investing) — "WHITEPAPER"

> [!quote] Israel And South Africa Policy Updates (PDF)
> ested awards delivered through an equity incentive scheme, whether it be in the form of options or shares, is not considered to be in line with best practice, as it is generally expected that dividend payments only apply to vested shares. ISS already evaluates the provision of dividend payments and **accruals** on vested incentive awards in South Africa. The level of disclosure of companies' polici...
> — [Israel And South Africa Policy Updates (PDF)](https://www.issgovernance.com/file/policy/2021/updates/Israel-and-South-Africa-Policy-Updates.pdf)

> [!quote] The Quality Factor | Blog posts | STOXX
> ace known as smart beta, however, the strategy is a relatively new addition to the factor mix. This may be why compared to other factors ‘the dispersion in definitions is substantially largerfor quality,’ according to a 2016 study.3The paper’s authors found that definitions range from low levels of **accruals**, gross profitability and low investments to bottom-line profitability measures such as r...
> — [The Quality Factor | Blog posts | STOXX](https://stoxx.com/the-quality-factor) — "WHITEPAPER"

**Sources:**
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
- [Q&amp;A: Credit Suisse’s Froehlich on Multi-Premia Investing | Blog posts | STOXX](https://stoxx.com/qa-credit-suisses-froehlich-on-multi-premia-investing) — "WHITEPAPER"
- [Israel And South Africa Policy Updates (PDF)](https://www.issgovernance.com/file/policy/2021/updates/Israel-and-South-Africa-Policy-Updates.pdf)
- [The Quality Factor | Blog posts | STOXX](https://stoxx.com/the-quality-factor) — "WHITEPAPER"

---

### Active Industry Constraint

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="4 mentions across STOXX & ISS pages (ultra-low)">▰ 4</span>


> A portfolio construction rule that limits the deviation of each industry's
> weight in the optimized portfolio from its weight in the parent (benchmark)
> index. STOXX methodology typically imposes a maximum active industry weight of
> +/- 5% relative to the parent index, ensuring the factor-tilted portfolio does
> not introduce unintended sector bets.

In plain terms, this is a guardrail that prevents a smart beta index from accidentally becoming a sector bet. If technology is 20% of the benchmark, the factor index might hold between 15% and 25% in technology — but never 40%.

> [!tip] Related terms
> [[#Industry Neutral]], [[#Capping Constraint]], [[#Tracking Error Budget]]




> [!quote] Industry Neutral Factor Indices | STOXX
> Solutions Industry Neutral Factor Indices For investors looking to accurately access pure factor returns, without unintended sector exposures. The STOXX® Industry Neutral Ax Factor Indices implement the same methodology of the STOXX® Factor Indices while reducing the **active industry constraint** from +/- 5% to near neutral. The STOXX Factor Indices and STOXX Industry Neutral Ax Factor Indices rel...
> — [Industry Neutral Factor Indices | STOXX](https://stoxx.com/industry-neutral-factor-indices) — "WHITEPAPER"

> [!quote] Eurex to List Futures on STOXX Industry Neutral Ax Factor Indices | Blog post...
> ix styles: Value, Momentum, Size, Low Risk, Quality and Multi-Factor. The futures will start trading on Apr. 26, Eurex said in a press release. The STOXX Industry Neutral Ax Factor Indices were introduced in February and implement the same methodology of the STOXX® Factor Indices while reducing the **active industry constraint** from +/- 5% to near neutral. In all but eliminating industry deviation...
> — [Eurex to List Futures on STOXX Industry Neutral Ax Factor Indices | Blog post...](https://stoxx.com/eurex-to-list-futures-on-stoxx-industry-neutral-ax-factor-indices) — "WHITEPAPER"

> [!quote] Q&amp;A: What do Eurex’s new futures on STOXX Factor Indices offer? | Blog po...
> hirdly, the index methodology upholds diversification through constraints on country and industry exposures, as well as individual security weights. “It may also be useful to highlight that the STOXX Industry Neutral Ax Factor Indices are versions of the standard STOXX Factor Indices that limit the **active industry constraint** from +/- 5% to near neutral. This was one of the feedbacks from the jo...
> — [Q&amp;A: What do Eurex’s new futures on STOXX Factor Indices offer? | Blog po...](https://stoxx.com/qa-what-do-eurexs-new-futures-on-stoxx-factor-indices-offer) — "WHITEPAPER"

> [!quote] The diversification benefits of a multi-factor approach: the STOXX Europe 600...
> -construction tools and risk models. The indices target high exposures to proven sources of excess returns and, as well, manage liquidity and unintended risk exposures. The STOXX® Industry Neutral Factor Indices (Table 1) implement the same methodology of the STOXX Factor Indices while reducing the **active industry constraint** from +/- 5% to near neutral. In all but eliminating the overall indust...
> — [The diversification benefits of a multi-factor approach: the STOXX Europe 600...](https://stoxx.com/the-diversification-benefits-of-a-multi-factor-approach-the-stoxx-europe-600-industry-neutral-ax-multi-factor-index) — "WHITEPAPER"

**Sources:**
- [Industry Neutral Factor Indices | STOXX](https://stoxx.com/industry-neutral-factor-indices) — "WHITEPAPER"
- [Eurex to List Futures on STOXX Industry Neutral Ax Factor Indices | Blog posts | STOXX](https://stoxx.com/eurex-to-list-futures-on-stoxx-industry-neutral-ax-factor-indices) — "WHITEPAPER"
- [Q&amp;A: What do Eurex’s new futures on STOXX Factor Indices offer? | Blog posts | STOXX](https://stoxx.com/qa-what-do-eurexs-new-futures-on-stoxx-factor-indices-offer) — "WHITEPAPER"
- [The diversification benefits of a multi-factor approach: the STOXX Europe 600 Industry Neutral Ax Multi-Factor Index | Blog posts | STOXX](https://stoxx.com/the-diversification-benefits-of-a-multi-factor-approach-the-stoxx-europe-600-industry-neutral-ax-multi-factor-index) — "WHITEPAPER"

---

### Alpha Signal

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="70 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 70</span>


> A quantitative score assigned to each security that predicts relative future
> returns. In STOXX multi-factor indices, the alpha signal is a composite z-score
> constructed by combining individual factor signals (e.g., value, momentum,
> quality) into a single ranking metric used during portfolio optimization.

In plain terms, an alpha signal is the "master score" that tells the index which stocks should be overweighted and which should be underweighted. It is the numerical translation of the factor thesis into an actionable ranking.

$$
\alpha_i = \sum_{k=1}^{K} w_k \cdot z_{i,k}
$$

where $z_{i,k}$ is the standardized score for security $i$ on factor $k$, and $w_k$ is the factor weight.

> [!tip] Related terms
> [[#Multifactor Signal]], [[#Factor Tilt]], [[#Factor (Definition)]]




> [!quote] BlackRock’s Ang on sustainability alpha signals: ESG and factors as ‘best fri...
> ating complementary ESG metrics into historically rewarded sources of returns, the latter can become more robust. “This is part of a longer journey for our investors,” said Dr. Ang. “We continuously want to push the definitions of these factors.” Other ESG signals An additional example of a climate **alpha signal** can be found in companies with the most LEED-certified,2 or carbon-efficient, buildi...
> — [BlackRock’s Ang on sustainability alpha signals: ESG and factors as ‘best fri...](https://stoxx.com/blackrocks-ang-on-sustainability-alpha-signals-esg-and-factors-as-best-friends) — "WHITEPAPER"

> [!quote] Istoxx Index Guide (PDF)
> oss return in USD and EUR. L Dissemination calendar: STOXX Global calendar T FACTOR DEFINATIONS I The Multi-Factor **Alpha Signal** is derived from sixteen Signals, which are combined to create 5 Factors - Momentum, Quality, Value, and Low Volatility. The Factors are combined to create a - Multi-Factor **Alpha Signal**, as described below. F The Momentum Factor is a composite of the following 2 Signals...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

> [!quote] Asset-owner panel discusses drivers, merits of integrating SDGs into investme...
> they understand how we derive the overall percentage that we consider is aligned with SDGs.” Data transparency was a recurrent point throughout the presentation, as panelists highlighted the importance of basing investment decisions on reliable information and eliminating the risk of greenwashing. **Alpha signal** A recent Qontigo whitepaper1 looked into the effectiveness of the SDI AOP’s SDI Innov...
> — [Asset-owner panel discusses drivers, merits of integrating SDGs into investme...](https://stoxx.com/asset-owner-panel-discusses-drivers-merits-of-integrating-sdgs-into-investment-portfolios) — "WHITEPAPER"

> [!quote] Monthly Index News February 2023 (PDF)
> ic exposures, and offering low tracking error. The new indices are derived from STOXX’s broadest equity market universe, STOXX® World. Constituents are selected and weighted through an optimization process that leverages the Axioma portfolio optimizer and seeks to maximize exposure to a multifactor **alpha signal**, derived from the five targeted factors. The optimization applies caps across sector...
> — [Monthly Index News February 2023 (PDF)](https://stoxx.com/monthly-index-news-february-2023)

> [!quote] iShares adopts STOXX indices to underlie EMEA multifactor ETFs with exclusion...
> e and diversified exposure while controlling for systematic risk. The indices also implement baseline exclusions[2] and reduce the greenhouse gas (GHG) intensity relative to the parent benchmark. The indices’ methodology follows an optimization process that maximizes the allocation to a multifactor **alpha signal**, while satisfying a set of constraints to avoid unintended and uncompensated bets, a...
> — [iShares adopts STOXX indices to underlie EMEA multifactor ETFs with exclusion...](https://stoxx.com/ishares-adopts-stoxx-indices-to-underlie-emea-multifactor-etfs-with-exclusionary-screens) — "WHITEPAPER"

**Sources:**
- [BlackRock’s Ang on sustainability alpha signals: ESG and factors as ‘best friends’  | Blog posts | STOXX](https://stoxx.com/blackrocks-ang-on-sustainability-alpha-signals-esg-and-factors-as-best-friends) — "WHITEPAPER"
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
- [Asset-owner panel discusses drivers, merits of integrating SDGs into investment portfolios | Blog posts | STOXX](https://stoxx.com/asset-owner-panel-discusses-drivers-merits-of-integrating-sdgs-into-investment-portfolios) — "WHITEPAPER"
- [Monthly Index News February 2023 (PDF)](https://stoxx.com/monthly-index-news-february-2023)
- [iShares adopts STOXX indices to underlie EMEA multifactor ETFs with exclusionary screens  | Blog posts | STOXX](https://stoxx.com/ishares-adopts-stoxx-indices-to-underlie-emea-multifactor-etfs-with-exclusionary-screens) — "WHITEPAPER"

---

## C

### Capping Constraint

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="7 mentions across STOXX & ISS pages (low)">▰▰ 7</span>


> A hard upper bound on the weight any single security (or issuer) can hold in
> the index. STOXX indices commonly apply caps of 5% or 10% at each
> rebalancing, complying with UCITS diversification requirements. In the EURO
> STOXX 50 Risk Control indices, individual security caps interact with risk
> budgets to prevent concentration.

In plain terms, capping stops any one stock from dominating the index. Even if a factor model loves a particular stock, the cap limits its weight so that a blow-up in that single name does not destroy the whole portfolio.

> [!tip] Related terms
> [[#Security Weight Cap]], [[#Active Industry Constraint]], [[#Turnover Constraint]]




> [!quote] Stoxx Index Guide (PDF)
> breaching these thresholds, and reduce the gravity of the breaches if and when they occur. There is the additional limit that the individual weights cannot be greater than 20 times the company’s weight in the corresponding parent benchmark. If the parent index itself does not satisfy the individual **capping constraint**s those are not enforced on the corresponding single and multi-factor indices. ...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] Stoxx Index Guide (PDF)
> breaching these thresholds, and reduce the gravity of the breaches if and when they occur. There is the additional limit that the individual weights cannot be greater than 20 times the company’s weight in the corresponding parent benchmark. If the parent index itself does not satisfy the individual **capping constraint**s those are not enforced on the corresponding single and multi-factor indices. ...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] Istoxx Index Guide (PDF)
> zero): The minimum nonzero weight of each asset in the index is limited to 0.5 bp. Individual Issuer Capping: The maximum weight of each issuer in the index is 8%. The sum of the weights of those issuers above 4.5% cannot exceed 35%. If the parent index itself does not satisfy the individual issuer **capping constraint**s those are not enforced on the corresponding child indices. Active Issuer Cons...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

**Sources:**
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

---

### Capital Asset Pricing Model (CAPM)

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1 mentions across STOXX & ISS pages (ultra-low)">▰ 1</span>


> A foundational equilibrium model asserting that the expected excess return of a
> security is proportional to its systematic risk (beta) relative to the market
> portfolio. In the STOXX framework, CAPM provides the theoretical baseline
> against which factor premia are measured — factors like value, momentum, and
> quality represent returns unexplained by CAPM's single market factor.

In plain terms, CAPM says the only risk you get paid for is market risk. If a stock moves 1.2× as much as the market, you should earn 1.2× the market's excess return — nothing more. Factor investing exists precisely because CAPM's prediction is too simple: other characteristics (cheapness, momentum, quality) also predict returns.

$$
E[R_i] - R_f = \beta_i \cdot (E[R_m] - R_f)
$$

where $R_f$ is the risk-free rate, $R_m$ is the market return, and $\beta_i = \frac{\text{Cov}(R_i, R_m)}{\text{Var}(R_m)}$.

> [!tip] Related terms
> [[#Factor (Definition)]], [[#Risk Premia]], [[#Low Risk Factor]]




> [!quote] The low volatility premium – An analysis of factor exposures of minimum varia...
> rk, a vast number of empirical studies looked into characteristics of minimum variance portfolios with a focus on how to best implement such strategies in practice[2]. In recent years, however, academia has shifted its focus to the explanation of the so-called low volatility factor. The traditional **Capital Asset Pricing Model (CAPM)** explains asset returns in excess of the risk-free rate as comp...
> — [The low volatility premium – An analysis of factor exposures of minimum varia...](https://stoxx.com/the-low-volatility-premium-an-analysis-of-factor-exposures-of-minimum-variance-strategies-blog) — "WHITEPAPER"

**Sources:**
- [The low volatility premium – An analysis of factor exposures of minimum variance strategies | Blog posts | STOXX](https://stoxx.com/the-low-volatility-premium-an-analysis-of-factor-exposures-of-minimum-variance-strategies-blog) — "WHITEPAPER"

---

### Carry Factor

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="103 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 103</span>


> A factor that captures the return earned from holding higher-yielding assets
> against lower-yielding ones, independent of price appreciation. In equities,
> STOXX carry strategies typically rank securities by dividend yield or
> shareholder yield (dividends plus buybacks minus issuance), overweighting those
> offering the highest expected income return.

In plain terms, carry is about getting paid to hold an asset. A stock with a 5% dividend yield "carries" better than one with 1%. The carry factor systematically tilts toward these high-income names, earning returns from the yield itself rather than betting on price changes.

$$
\text{Carry}_i = \frac{D_i}{P_i}
$$

where $D_i$ is the expected annual dividend and $P_i$ is the current price. More sophisticated versions include net buyback yield.

> [!tip] Related terms
> [[#Value Factor]], [[#Yield Factor]], [[#Factor (Definition)]]




> [!quote] Monthly Index News September 2019 (PDF)
> systematic risk, had a loss for the month. The iSTOXX® Europe Value Factor Market Neutral Index posted the narrowest loss, although it was still its eighth consecutive monthly retreat. The other only index in the family to have fallen in eight of the nine months so far in 2019 is the iSTOXX® Europe **Carry Factor** Market Neutral Index. For the whole of 2019, the iSTOXX® Europe Size Factor Market N...
> — [Monthly Index News September 2019 (PDF)](https://stoxx.com/monthly-index-news-september-2019)

> [!quote] Monthly Index News August 2018 (PDF)
> ormer in the group was the iSTOXX® Europe **Carry Factor** Market Neutral Index, which rebounded from July’s losses with a 1.3% gain. The iSTOXX® Europe Value Factor Market Neutral Index was the worst strategy in August after falling 0.5%. It is now down 5.3% this year, leading losses. By contrast, the **Carry Factor** Market Neutral Index – which tracks stocks with high growth potential based on earni...
> — [Monthly Index News August 2018 (PDF)](https://stoxx.com/monthly-index-news-august-2018)

> [!quote] Monthly Index News February 2018 (PDF)
> short position in futures on the STOXX® Europe 600 index, posted gains in February. The iSTOXX® Europe **Carry Factor** Market Neutral index came on top, with a 1.5% advance. Risk and return characteristics Return (%) Annualised volatility (%) Volatility 1M YTD 1Y 1M YTD 1 Y Percentile 1. iSTOXX Europe **Carry Factor** Market Neutral 1.5 1.1 3.2 3.5 3.5 3.3 32nd 2. iSTOXX Europe Low Risk Factor Market ...
> — [Monthly Index News February 2018 (PDF)](https://stoxx.com/monthly-index-news-february-2018)

> [!quote] Monthly Index News July 2018 (PDF)
> ive results over the month. All seven iSTOXX® Europe Factor Market Neutral Indices, which neutralize systematic risk by holding a short position in futures on the STOXX Europe 600, posted losses. Increased bullishness may have been behind a style rotation among factor strategies. The iSTOXX® Europe **Carry Factor** Market Neutral Index, which beat all other five strategies in the iSTOXX® Europe Fac...
> — [Monthly Index News July 2018 (PDF)](https://stoxx.com/monthly-index-news-july-2018)

> [!quote] Monthly Index News June 2018 (PDF)
> The index, which includes stocks that trade at lower prices than the market’s average, which tend to do better in times of market upswings. These seem to have fallen out of favor with investors, perhaps reflecting their concerns about the pace of global expansion. By comparison, the iSTOXX® Europe **Carry Factor** Market Neutral Index is cementing its position as the leading factor in the past year...
> — [Monthly Index News June 2018 (PDF)](https://stoxx.com/monthly-index-news-june-2018)

**Sources:**
- [Monthly Index News September 2019 (PDF)](https://stoxx.com/monthly-index-news-september-2019)
- [Monthly Index News August 2018 (PDF)](https://stoxx.com/monthly-index-news-august-2018)
- [Monthly Index News February 2018 (PDF)](https://stoxx.com/monthly-index-news-february-2018)
- [Monthly Index News July 2018 (PDF)](https://stoxx.com/monthly-index-news-july-2018)
- [Monthly Index News June 2018 (PDF)](https://stoxx.com/monthly-index-news-june-2018)

---

## D

### Defensive Factor

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="2 mentions across STOXX & ISS pages (ultra-low)">▰ 2</span>


> A factor strategy that selects securities exhibiting stable earnings, low
> financial leverage, and low price volatility — combining elements of quality
> and low risk into a single defensive composite. STOXX defensive indices
> typically blend low-beta selection with profitability and balance sheet
> strength screens to build portfolios that aim to protect capital during market
> downturns.

In plain terms, the defensive factor is for investors who want to stay in equities but sleep at night. It picks "fortress" companies — profitable, conservatively financed, and not prone to wild price swings — that tend to fall less when markets crash.

$$
\text{Defensive}_i = \frac{1}{3}\left(z_{\text{low vol},i} + z_{\text{quality},i} + z_{\text{low leverage},i}\right)
$$

> [!tip] Related terms
> [[#Low Risk Factor]], [[#Quality Factor]], [[#Low Volatility Factor]]




> [!quote] BlackRock’s Jamie Forbes: Implementing ‘evolutionary’ factor advancements in ...
> s such, the STOXX Equity Factor indices upweight Quality. Value and Momentum are natural pairs, and so they have the same weight relative to each other. The Small Size factor, for its part, is a high beta, pro-cyclical factor, relative to the Low Volatility factor, which is low beta and a much more **defensive factor**. Those are opposing factors pulling in opposite directions. And so, they each ha...
> — [BlackRock’s Jamie Forbes: Implementing ‘evolutionary’ factor advancements in ...](https://stoxx.com/blackrocks-jamie-forbes-implementing-evolutionary-factor-advancements-in-investments) — "WHITEPAPER"

> [!quote] STOXX Factor Indices – Q1 2020 Review | STOXX
> . returns in excess of the benchmark) for the quarter, broken down into pre- and post-Feb. 19, 2020, the day that marked the peak before the virus-driven downturn. Chart 1 Sources of out/underperformance will be explored later in this post, but we observe some results that match intuition. The more **defensive factor**s (Low Risk and Quality) had the strongest post-crisis returns. On the other hand...
> — [STOXX Factor Indices – Q1 2020 Review | STOXX](https://stoxx.com/stoxx-factor-indices-q1-2020-review) — "WHITEPAPER"

**Sources:**
- [BlackRock’s Jamie Forbes: Implementing ‘evolutionary’ factor advancements in investments | Blog posts | STOXX](https://stoxx.com/blackrocks-jamie-forbes-implementing-evolutionary-factor-advancements-in-investments) — "WHITEPAPER"
- [STOXX Factor Indices – Q1 2020 Review | STOXX](https://stoxx.com/stoxx-factor-indices-q1-2020-review) — "WHITEPAPER"

---

### Dilution

<span style="background:red; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1,743 mentions across STOXX & ISS pages (high)">▰▰▰▰▰▰ 1,743</span>


> In the STOXX quality framework, dilution captures the change in a company's
> share count over time. Companies that consistently issue new shares dilute
> existing shareholders' ownership and are penalized in quality scoring. The
> signal is measured as the year-over-year percentage change in total shares
> outstanding.

In plain terms, dilution means a company is printing new shares — which shrinks your slice of the pie. STOXX's quality indices treat heavy share issuance as a red flag for governance and capital allocation discipline.

$$
\text{Dilution}_t = \frac{\text{Shares Outstanding}_t - \text{Shares Outstanding}_{t-1}}{\text{Shares Outstanding}_{t-1}}
$$

> [!tip] Related terms
> [[#Quality Factor]], [[#Accruals]], [[#Net Operating Assets (Changes in)]]




> [!quote] 1 2016 China Voting Guidelines Dec 2015 (PDF)
> or a mature company and 10 percent for a growth company. However, ISS will support plans at mature companies with **dilution** levels up to 10 percent if the plan includes other positive features such as challenging performance criteria and meaningful vesting periods, as these features partially offset **dilution** concerns by reducing the likelihood that options will become exercisable unless there is...
> — [1 2016 China Voting Guidelines Dec 2015 (PDF)](https://www.issgovernance.com/file/policy/1_2016-china-voting-guidelines-dec-2015.pdf)

> [!quote] Western Union (PDF)
> The Western Union Company (WU) Meeting Date: 30 May 2013 POLICY: United States Meeting ID: 795284 **Dilution** & Burn Rate **DILUTION** BURN RATE Dilution (%) Non-Adjusted (%) Adjusted (%) The Western Union Company 11.96 1-year 0.89 1.56 Peer group median 18.37 3-year average 0.79 1.30 Peer group weighted average 13.63 Peer group 75th percentile 27.94 Dilution is the sum of the total amount of shares av
> — [Western Union (PDF)](https://www.issgovernance.com/file/2013/02/western_union.pdf)

> [!quote] Us Equity Compensation Plans Faq (PDF)
> equity compensation program is estimated to dilute shareholders' holdings by more than 20 percent (for the S&P 500 model) or 25 percent (for the Russell 3000 model). This overriding factor does not apply to the Non-Russell 3000 or Special Cases models. This overriding factor examines share capital **dilution** (as opposed to voting power **dilution**) calculated as: (A + B + C) ÷ CSO, where: A = # new ...
> — [Us Equity Compensation Plans Faq (PDF)](https://www.issgovernance.com/file/policy/2022/americas/US-Equity-Compensation-Plans-FAQ.pdf)

> [!quote] Australia Policy Updates (PDF)
> exercise of options should be ▪ Methodology for determining exercise price should be disclosed. disclosed. ▪ Sufficient information should be presented to demonstrate that the scheme will reward superior future performance. ▪ Proposed volume of securities which may be issued should be disclosed to **Dilution** of Existing Shareholders' Equity enable shareholders to assess the **dilution**ary impact. ▪ ...
> — [Australia Policy Updates (PDF)](https://www.issgovernance.com/file/policy/2024/updates/Australia-Policy-Updates.pdf)

> [!quote] Stoxx Index Guide (PDF)
> red using the Parent Index weights and truncated at +/- 3 standard deviations. The Momentum Factor combines the Signals at 25%, 50% and 25% weights, respectively, and is again z-scored and truncated at +/-3 standard deviations. The Quality Factor is a composite of the following 6 Signals: Accruals, **Dilution**, Gross Profitability, Change in Net Operating Assets (NOA), Carbon Emissions Intensity, ...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

**Sources:**
- [1 2016 China Voting Guidelines Dec 2015 (PDF)](https://www.issgovernance.com/file/policy/1_2016-china-voting-guidelines-dec-2015.pdf)
- [Western Union (PDF)](https://www.issgovernance.com/file/2013/02/western_union.pdf)
- [Us Equity Compensation Plans Faq (PDF)](https://www.issgovernance.com/file/policy/2022/americas/US-Equity-Compensation-Plans-FAQ.pdf)
- [Australia Policy Updates (PDF)](https://www.issgovernance.com/file/policy/2024/updates/Australia-Policy-Updates.pdf)
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

## E

### Efficient Frontier

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="21 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 21</span>


> The set of portfolios that offer the highest expected return for each level of
> risk (standard deviation), forming a curved boundary in mean-variance space.
> STOXX risk-based indices — minimum variance, maximum diversification, and
> equal risk contribution — can be understood as targeting specific points on or
> near the efficient frontier under different objective functions and constraints.

In plain terms, the efficient frontier is the "best you can do" curve. Every portfolio on it is optimal: you cannot get more return without taking more risk, and you cannot reduce risk without giving up return. Portfolios below the curve are inefficient — they leave free performance on the table.

$$
\max_{w} \; E[R_p] \quad \text{s.t.} \quad \sigma_p = \sigma^*, \; \sum_i w_i = 1, \; w_i \geq 0
$$

Tracing out all $\sigma^*$ values produces the frontier.

> [!tip] Related terms
> [[#Mean-Variance Optimization]], [[#Minimum Variance]], [[#Maximum Diversification]]




> [!quote] Green efficient frontiers: Minimizing the risk impact of exclusions in sustai...
> indices and funds increasing, the optimal allocation of a portfolio’s risk budget will become only more crucial with time. To download the whitepaper and find out more about the active risk, active variance analysis and comparative returns of an optimized exclusions portfolio, click here. 1 ‘Green **efficient frontier**s. Part 1: Minimizing the risk impact of exclusions,’ Qontigo, March 2023.
> — [Green efficient frontiers: Minimizing the risk impact of exclusions in sustai...](https://stoxx.com/green-efficient-frontiers-minimizing-the-risk-impact-of-exclusions-in-sustainable-portfolios) — "WHITEPAPER"

> [!quote] Qontigo’s ‘Enhance’ sustainable index category – optimizing ESG investing | B...
> dices in the families that compose our Enhance category cover the world’s major markets. “Overall, our new sustainability suite offers investors a flexible menu to address their different needs,” said Seegopaul. “With the appropriate solution, we aim to help them reach the optimal spot on their new **efficient frontier** of impact, risk and returns.” Our DNA and philosophy Qontigo’s ESG framework o...
> — [Qontigo’s ‘Enhance’ sustainable index category – optimizing ESG investing | B...](https://stoxx.com/qontigo-esg-enhance-sustainability-index-category) — "WHITEPAPER"

> [!quote] Stoxx Minvar Paper (PDF)
> sk of the portfolio and their returns are irrelevant for the estimation. Any portfolio on the **efficient frontier** has an optimal risk-return ratio. No other portfolio can have a higher return for the same level of risk, or a lower risk for the same return. Therefore, any portfolio that is not on the **efficient frontier** is dominated by a superior portfolio on the frontier. Of all portfolios, the M...
> — [Stoxx Minvar Paper (PDF)](http://www.stoxx.com/document/Others/marketing/STOXX_MinVar_Paper.pdf)

> [!quote] Portfolio Construction | STOXX
> this, with continuously growing datasets updated quarterly, to assess companies’ contributions to the UN Sustainable Development Goals. James Leaton, Research Director of the SDI AOP, discusses the latest platform developments led by its asset-owner led community. Index | ESG & Sustainability Green **efficient frontier**s: Minimizing the risk impact of exclusions in sustainable portfolios A new whi...
> — [Portfolio Construction | STOXX](https://stoxx.com/category/portfolio-construction) — "WHITEPAPER"

> [!quote] Sustainability Impact of Investments Calls for Redefined View of Asset Manage...
> world of tomorrow in the same way we thought about the world of yesterday,” Bocquet said during a panel at the Sustainable Investment Forum Europe 2021 on April 20. “The traditional risk-and-return framework is outdated. It needs to be updated with a third dimension: societal impact. Therefore, new **efficient frontier**s within these three dimensions will have to be defined by investors.” The pane...
> — [Sustainability Impact of Investments Calls for Redefined View of Asset Manage...](https://stoxx.com/sustainability-impact-of-investments-calls-for-redefined-view-of-asset-management-says-qontigos-bocquet) — "WHITEPAPER"

**Sources:**
- [Green efficient frontiers: Minimizing the risk impact of exclusions in sustainable portfolios | Blog posts | STOXX](https://stoxx.com/green-efficient-frontiers-minimizing-the-risk-impact-of-exclusions-in-sustainable-portfolios) — "WHITEPAPER"
- [Qontigo’s ‘Enhance’ sustainable index category – optimizing ESG investing | Blog posts | STOXX](https://stoxx.com/qontigo-esg-enhance-sustainability-index-category) — "WHITEPAPER"
- [Stoxx Minvar Paper (PDF)](http://www.stoxx.com/document/Others/marketing/STOXX_MinVar_Paper.pdf)
- [Portfolio Construction | STOXX](https://stoxx.com/category/portfolio-construction) — "WHITEPAPER"
- [Sustainability Impact of Investments Calls for Redefined View of Asset Management, Says Qontigo’s Bocquet | Blog posts | STOXX](https://stoxx.com/sustainability-impact-of-investments-calls-for-redefined-view-of-asset-management-says-qontigos-bocquet) — "WHITEPAPER"

---

### Earnings Announcement Drift

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="13 mentions across STOXX & ISS pages (low)">▰▰ 13</span>


> The empirically documented tendency for stock prices to continue moving in the
> direction of an earnings surprise for weeks or months after the announcement
> date. STOXX momentum and quality indices may exploit this anomaly by
> incorporating post-announcement return signals into their composite scores.

In plain terms, when a company reports earnings that beat (or miss) expectations, the stock tends to keep drifting in the same direction — the market digests the news slowly. Factor indices can capture this drift by tilting toward recent positive surprises.

> [!tip] Related terms
> [[#Earnings Momentum]], [[#Price Momentum]], [[#Momentum Factor]]




> [!quote] Stoxx Index Guide (PDF)
> STOXX INDEX METHODOLOGY GUIDE 587/639 18. STOXX FACTOR INDICES The Momentum Factor is a composite of the following 3 Signals: **Earnings Announcement Drift**, Earnings Momentum, and Price Momentum.  **Earnings Announcement Drift** is given by the sum of idiosyncratic returns from the Axioma Risk Model on the most recent earnings announcement date and the next business day. Idiosyncratic returns are de...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] Stoxx Index Guide (PDF)
> STOXX INDEX METHODOLOGY GUIDE 587/639 18. STOXX FACTOR INDICES The Momentum Factor is a composite of the following 3 Signals: **Earnings Announcement Drift**, Earnings Momentum, and Price Momentum.  **Earnings Announcement Drift** is given by the sum of idiosyncratic returns from the Axioma Risk Model on the most recent earnings announcement date and the next business day. Idiosyncratic returns are de...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] STOXX Equity Factor Indices | STOXX
> obal Equity Factor Index | STOXX World AC Index | From the respective starting universes, constituents are selected and weighted to maximize exposure to a multifactor signal created from the following five factors: Momentum The momentum score is calculated from price momentum, earnings momentum and **earnings announcement drift** (i.e., the difference between a stock’s performance on and immediatel...
> — [STOXX Equity Factor Indices | STOXX](https://stoxx.com/solutions/stoxx-equity-factor-indices) — "WHITEPAPER"

**Sources:**
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [STOXX Equity Factor Indices | STOXX](https://stoxx.com/solutions/stoxx-equity-factor-indices) — "WHITEPAPER"

---

### Earnings Momentum

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="22 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 22</span>


> A factor signal based on the direction and magnitude of analyst earnings
> revision activity. STOXX defines earnings momentum using the change in
> consensus EPS estimates over a trailing window (typically 3 to 6 months).
> Stocks with upward revisions receive positive scores.

In plain terms, earnings momentum asks: "Are analysts raising or lowering their profit forecasts for this company?" Upward revisions signal improving fundamentals and tend to predict near-term outperformance.

$$
\text{Earnings Momentum}_i = \frac{\text{EPS Estimate}_{t} - \text{EPS Estimate}_{t-n}}{\lvert \text{EPS Estimate}_{t-n} \rvert}
$$

> [!tip] Related terms
> [[#Earnings Announcement Drift]], [[#Momentum Factor]], [[#Alpha Signal]]




> [!quote] Istoxx Index Guide (PDF)
> he Multi-Factor Alpha Signal is derived from sixteen Signals, which are combined to create 5 Factors - Momentum, Quality, Value, and Low Volatility. The Factors are combined to create a - Multi-Factor Alpha Signal, as described below. F The Momentum Factor is a composite of the following 2 Signals: **Earnings Momentum**, and Price Momentum. A • **Earnings Momentum** is given by the sum of the number of...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

> [!quote] Stoxx Index Guide (PDF)
> STOXX INDEX METHODOLOGY GUIDE 587/639 18. STOXX FACTOR INDICES The Momentum Factor is a composite of the following 3 Signals: Earnings Announcement Drift, **Earnings Momentum**, and Price Momentum.  Earnings Announcement Drift is given by the sum of idiosyncratic returns from the Axioma Risk Model on the most recent earnings announcement date and the next business day. Idiosyncratic returns are de...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX a...
> , 12-month share-price appreciation, excluding the most recent month to avoid short-term reversal effects. But today’s markets are faster, flooded with information and more prone to short-term noise. Our research has shown that combining Momentum signals across both price and fundamentals — such as **earnings momentum** or **earnings momentum** drift — enhances signal strength (Figure 2). This approach...
> — [Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX a...](https://stoxx.com/qa-with-blackrock-fourth-year-of-multifactor-collaboration-with-stoxx-amid-evolving-factor-investing-landscape) — "WHITEPAPER"

> [!quote] Q&amp;A with FlexShares: Quality and ESG as risk-control tools for EM Low-Vol...
> hnology adoption grows rapidly, and incomes and quality of life continue to improve. This presents a robust, long-term investment opportunity for investors. “In today’s low-rate environment, investors need to broaden their sources of income as well as diversify them. With strong economic growth and **earnings momentum**, a number of EM companies can be an attractive source of returns and income for...
> — [Q&amp;A with FlexShares: Quality and ESG as risk-control tools for EM Low-Vol...](https://stoxx.com/qa-with-flexshares-quality-and-esg-as-risk-control-tools-for-em-low-vol-high-dividend-strategies) — "WHITEPAPER"

> [!quote] STOXX Equity Factor Indices | STOXX
> Cap Index | | STOXX Global Equity Factor Index | STOXX World AC Index | From the respective starting universes, constituents are selected and weighted to maximize exposure to a multifactor signal created from the following five factors: Momentum The momentum score is calculated from price momentum, **earnings momentum** and earnings announcement drift (i.e., the difference between a stock’s perform...
> — [STOXX Equity Factor Indices | STOXX](https://stoxx.com/solutions/stoxx-equity-factor-indices) — "WHITEPAPER"

**Sources:**
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX amid evolving factor investing landscape | Blog posts | STOXX](https://stoxx.com/qa-with-blackrock-fourth-year-of-multifactor-collaboration-with-stoxx-amid-evolving-factor-investing-landscape) — "WHITEPAPER"
- [Q&amp;A with FlexShares: Quality and ESG as risk-control tools for EM Low-Vol, High-Dividend strategies | Blog posts | STOXX](https://stoxx.com/qa-with-flexshares-quality-and-esg-as-risk-control-tools-for-em-low-vol-high-dividend-strategies) — "WHITEPAPER"
- [STOXX Equity Factor Indices | STOXX](https://stoxx.com/solutions/stoxx-equity-factor-indices) — "WHITEPAPER"

---

### Equal Risk Contribution

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="7 mentions across STOXX & ISS pages (low)">▰▰ 7</span>


> A portfolio construction method where each constituent is weighted so that it
> contributes an equal share of the total portfolio risk (volatility). STOXX
> Equal Risk indices solve for weights $w_i$ such that
> $w_i \cdot (\Sigma w)_i = \frac{\sigma_p^2}{N}$ for all $i$, where $\Sigma$
> is the covariance matrix.

In plain terms, instead of giving each stock equal dollars, you give each stock an equal "risk budget." A highly volatile stock gets less money; a stable stock gets more — so no single name dominates portfolio risk.

$$
\text{RC}_i = w_i \cdot \frac{\partial \sigma_p}{\partial w_i} = \frac{\sigma_p}{N} \quad \forall \; i
$$

> [!tip] Related terms
> [[#Risk Parity]], [[#Risk Budget]], [[#Minimum Variance]], [[#Maximum Diversification]]




> [!quote] Istoxx Index Guide (PDF)
> CITS style 4.5/8/35% constraints Active sector (ICB Level 3) exposures Within 0.1% of Parent Index Active country exposures Within 0.1% of Parent Index Active untargeted style factor exposures Within 0.25 standard deviations of Parent Index Active targeted style factor exposures > 0 vs Parent Index **Equal Risk Contribution** by targeted factors **Equal Risk Contribution** by targeted factors Active Ri...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

**Sources:**
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

---

## F

### Factor (Definition)

<span style="background:deeppink; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="18,289 mentions across STOXX & ISS pages (ultra-high)">▰▰▰▰▰▰▰ 18,289</span>


> A systematic, persistent, and economically motivated driver of security
> returns. STOXX recognizes canonical factors including value, momentum, quality,
> low volatility, and size. Each factor is operationalized through specific
> financial metrics, standardized into z-scores, and used to tilt portfolio
> weights away from market capitalization.

In plain terms, a factor is a measurable characteristic of stocks — like cheapness or recent performance — that has historically been rewarded with higher returns over long periods, backed by economic reasoning.

> [!tip] Related terms
> [[#Factor Investing]], [[#Factor-Based Index]], [[#Smart Beta]]




> [!quote] Axioma Multi Asset Class Risk Monitor (PDF)
> Analysis Date | 2024-08-30 Axioma Multi-Asset Class Risk Monitor Figure 1. **Factor** Correlations (60 days) and Changes in Correlations (vs previous 60 days) 1. Correlations are unweighted and based on daily returns and changes in yield/spread over the past 60 business days. The lower left triangle of the matrix represents current correlations. The upper right triangle contai
> — [Axioma Multi Asset Class Risk Monitor (PDF)](https://stoxx.com/axioma-multi-asset-class-risk-monitor)

> [!quote] Climate Us Policy Updates (PDF)
> ere is a pattern (i.e. committee responsible for approving/setting non-employee director two or more years) of awarding excessive non-employee director compensation compensation if there is a pattern (i.e. two or more consecutive or non- without disclosing a compelling rationale or other mitigating factors. consecutive years/across multiple years) of awarding excessive or otherwise problematic7...
> — [Climate Us Policy Updates (PDF)](https://www.issgovernance.com/file/policy/active/specialty/Climate-US-Policy-Updates.pdf)

> [!quote] Asia Pacific Policy Updates (PDF)
> oom in a manner that would have a meaningful impact on an individual's ability to satisfy requisite fiduciary would have a meaningful impact on an individual's ability to satisfy requisite fiduciary standards on behalf of shareholders. standards on behalf of shareholders. [3] “Relative” follows the definition of “immediate family members” which covers [3] “Relative” follows the definition of “i...
> — [Asia Pacific Policy Updates (PDF)](https://www.issgovernance.com/file/policy/2020/updates/Asia-Pacific-Policy-Updates.pdf)

> [!quote] Dax Equity Calculation Guide 20231002 (PDF)
> ULATION 5 7. INDEX VALUE CALCULATION 14 2.2. ADVISORY BODY 5 7.1. INDEX FORMULAS 14 2.3. DISCRETION 5 7.2. INDEX DIVISOR CALCULATION 15 2.4. INDEX TERMINATION POLICY 6 8. CORPORATE ACTIONS AND ADJUSTMENTS 17 3. DISSEMINATION 8 8.1. CORPORATE ACTIONS 17 3.1. DISSEMINATION CALENDARS 8 8.2. FREE FLOAT FACTORS AND SHARE ADJUSTMENTS 23 3.2. DISSEMINATION PERIOD 8 8.3. MERGERS AND TAKEOVERS 24 3.3. R...
> — [Dax Equity Calculation Guide 20231002 (PDF)](https://www.stoxx.com/document/News/2023/October/DAX%20Equity%20Calculation%20Guide_20231002.pdf)

> [!quote] Steven Hall & Partners (PDF)
> We bbelieve that oour clients wwould benefitt from a totallly transpareent methodology that givess them the abbility to preddict ISS’ equity plan votee recommenddation prior to filing the proxyy. Finally, we note tthat the draftt policies aree silent on a number of ffactors, suchh as the overaall weightings of categorries and the weightings oof factors within the cateegories. Wee urge you to pu...
> — [Steven Hall & Partners (PDF)](https://www.issgovernance.com/file/policy/Steven_Hall_&_Partners.pdf)

**Sources:**
- [Axioma Multi Asset Class Risk Monitor (PDF)](https://stoxx.com/axioma-multi-asset-class-risk-monitor)
- [Climate Us Policy Updates (PDF)](https://www.issgovernance.com/file/policy/active/specialty/Climate-US-Policy-Updates.pdf)
- [Asia Pacific Policy Updates (PDF)](https://www.issgovernance.com/file/policy/2020/updates/Asia-Pacific-Policy-Updates.pdf)
- [Dax Equity Calculation Guide 20231002 (PDF)](https://www.stoxx.com/document/News/2023/October/DAX%20Equity%20Calculation%20Guide_20231002.pdf)
- [Steven Hall & Partners (PDF)](https://www.issgovernance.com/file/policy/Steven_Hall_&_Partners.pdf)

---

### Factor Crowding

> The condition that arises when a large number of investors simultaneously hold
> the same factor-tilted positions, compressing the factor's expected premium and
> increasing the risk of sharp reversals. STOXX and Qontigo research highlights
> crowding risk as a key consideration in factor timing — when a factor becomes
> "crowded," its valuation spread narrows and its vulnerability to rapid
> unwinding increases.

In plain terms, factor crowding is what happens when everyone piles into the same trade. If every quant fund is overweight the same cheap, high-momentum stocks, those stocks become less cheap (crowding erodes the premium) and more fragile (a rush for the exits can cause violent drawdowns).

> [!tip] Related terms
> [[#Factor Premium]], [[#Factor Rotation]], [[#Risk Premia]]

**Sources:**

---

### Factor Diversification

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="6 mentions across STOXX & ISS pages (low)">▰▰ 6</span>


> The practice of combining multiple factor exposures within a single portfolio
> to reduce the cyclicality of returns. Because factors (e.g., value and
> momentum) often have low or negative correlations with each other, blending
> them produces a smoother return profile than any single-factor strategy.

In plain terms, different factors "take turns" performing well. Value might struggle when momentum shines, and vice versa. Holding both in one portfolio is like diversifying across asset classes — but within equities.

> [!tip] Related terms
> [[#Multi-Factor]], [[#Multifactor Signal]], [[#Factor Investing]]




> [!quote] The Power of Factor Diversification | Blog posts | STOXX
> phase such as in 2018, quality and low-risk stocks, well-known for their defensive characteristics, outperformed by 6.3 percentage points and 3.9 points, respectively. On the other hand, value and reversal stocks, which are described as countercyclical, slightly underperformed the market. Figure 1: **Factor diversification** in practice Drawdown risk The distribution of returns in Figure 1 highligh...
> — [The Power of Factor Diversification | Blog posts | STOXX](https://stoxx.com/the-power-of-factor-diversification) — "WHITEPAPER"

> [!quote] Multifactor strategies: Proving their worth in the factor investment landscap...
> r approach becomes evident. Several of the single-factor portfolios — including Low Risk at different times, and Value and Small Size most recently — showed significant periods of underperformance. The multifactor portfolio, on the other hand, did not exhibit any sustained underwater periods. Intra-**factor diversification** A final consideration involves the construction of individual factors. Jus...
> — [Multifactor strategies: Proving their worth in the factor investment landscap...](https://stoxx.com/multifactor-strategies-proving-their-worth-in-the-factor-investment-landscape) — "WHITEPAPER"

> [!quote] Qontigo launches modern STOXX multifactor indices to underlie iShares ETFs ma...
> e-average exposures to multiple factors, with practical portfolio and trading elements such as diversification, turnover and tracking error considerations. These include market-relative caps on sector and country weights as well as absolute and market-relative limits on individual security weights. **Factor diversification** Additional considerations include criteria around systematic exposures, or...
> — [Qontigo launches modern STOXX multifactor indices to underlie iShares ETFs ma...](https://stoxx.com/qontigo-launches-modern-stoxx-multifactor-indices-to-underlie-ishares-etfs-managed-by-blackrock) — "WHITEPAPER"

> [!quote] Introducing the STOXX Factor Indices | STOXX
> e factors that have positive performance but different cyclicality and often uncorrelated return profiles. The STOXX Multifactor Indices do not invest in multiple single-factor portfolios according to desired weights, but rather seek to integrate the different factors in an efficient way to capture **factor diversification**. For every security, an aggregate multifactor score is computed as the ave...
> — [Introducing the STOXX Factor Indices | STOXX](https://stoxx.com/introducing-the-stoxx-factor-indices) — "WHITEPAPER"

> [!quote] BlackRock and STOXX collaboration: iShares multi-factor ETFs track STOXX indi...
> time-tested strategies through an ETF. It’s convenient, it’s transparent and it’s low cost. We can take exposures in the core of our portfolios, strategically seek outperformance, or implement tactical views with factor ETFs.” You highlight risk management. Why is it important for investors to have **factor diversification** from that perspective? Lukas: “Factor investing is all about accessing dif...
> — [BlackRock and STOXX collaboration: iShares multi-factor ETFs track STOXX indi...](https://stoxx.com/blackrock-and-stoxx-collaboration-ishares-multi-factor-etfs-track-stoxx-indices-to-deliver-consistent-risk-managed-exposure-for-a-portfolios-core) — "WHITEPAPER"

**Sources:**
- [The Power of Factor Diversification | Blog posts | STOXX](https://stoxx.com/the-power-of-factor-diversification) — "WHITEPAPER"
- [Multifactor strategies: Proving their worth in the factor investment landscape | Blog posts | STOXX](https://stoxx.com/multifactor-strategies-proving-their-worth-in-the-factor-investment-landscape) — "WHITEPAPER"
- [Qontigo launches modern STOXX multifactor indices to underlie iShares ETFs managed by BlackRock | Blog posts | STOXX](https://stoxx.com/qontigo-launches-modern-stoxx-multifactor-indices-to-underlie-ishares-etfs-managed-by-blackrock) — "WHITEPAPER"
- [Introducing the STOXX Factor Indices | STOXX](https://stoxx.com/introducing-the-stoxx-factor-indices) — "WHITEPAPER"
- [BlackRock and STOXX collaboration: iShares multi-factor ETFs track STOXX indices to deliver consistent, risk-managed exposure for a portfolio’s core | Blog posts | STOXX](https://stoxx.com/blackrock-and-stoxx-collaboration-ishares-multi-factor-etfs-track-stoxx-indices-to-deliver-consistent-risk-managed-exposure-for-a-portfolios-core) — "WHITEPAPER"

---

### Factor Investing

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="229 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 229</span>


> An investment approach that targets specific, evidence-based return drivers
> (factors) through systematic portfolio construction. STOXX implements factor
> investing via transparent, rules-based indices that overweight securities with
> desirable factor characteristics and underweight (or exclude) those without.

In plain terms, instead of buying the whole market by size, factor investing deliberately tilts toward stocks that share a trait — cheapness, recent winners, financial health — that academic research has shown earns a premium over time.

> [!tip] Related terms
> [[#Factor (Definition)]], [[#Smart Beta]], [[#Factor-Based Index]], [[#Risk Premia]]




> [!quote] Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX a...
> line with traditional core solutions.” What does a systematic, index-based methodology add to **factor investing**? And what is the benefit of collaborating with an index provider like STOXX? “A systematic, index-based approach brings transparency, consistency and cost efficiency — hallmarks of modern **factor investing**. By clearly defining, weighting and rebalancing factors, this methodology ensures...
> — [Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX a...](https://stoxx.com/qa-with-blackrock-fourth-year-of-multifactor-collaboration-with-stoxx-amid-evolving-factor-investing-landscape) — "WHITEPAPER"

> [!quote] Factor Investing | STOXX
> Continue active refreshing of this index's data? Continue active refreshing of this index's data? **Factor Investing** Most Recent **Factor Investing** A rotation out of technology and AI-related stocks weighed on US indices in February, while inflows into lower-valuation, more traditional sectors lifted European benchmarks for an eighth straight month. Stocks rose in January on optimism that global eco
> — [Factor Investing | STOXX](https://stoxx.com/category/factor-investing) — "WHITEPAPER"

> [!quote] Factor Investing: Q&amp;A on Flows, Outlook | Blog posts | STOXX
> of **factor investing** to a much larger audience. We spoke to Jan-Carl Plagge, head of applied research at STOXX Ltd., to ask him why factor-based passive strategies are proving so popular, and what the outlook for the sector is going forward. Jan, why have passive factor strategies become so popular? **Factor investing** has been around for quite a while now, and passive products tracking these strat...
> — [Factor Investing: Q&amp;A on Flows, Outlook | Blog posts | STOXX](https://stoxx.com/factor-investing-qa-on-flows-outlook) — "WHITEPAPER"

> [!quote] Not so fast. Factor investing is alive and doing well! | Blog posts | STOXX
> **Factor investing** has received much attention in recent years as a source of above-market returns. It’s also been the target of some criticism, mainly due to recent years’ underperformance of styles such as Value and Size. Contrary to skeptics’ views, a well-constructed portfolio that invests along r
> — [Not so fast. Factor investing is alive and doing well! | Blog posts | STOXX](https://stoxx.com/not-so-fast-factor-investing-is-alive-and-doing-well) — "WHITEPAPER"

> [!quote] MASTERCLASS: Factor Investing - June 2023 | Blog posts | STOXX
> This video first appeared on Asset TV’s MASTERCLASS: **Factor Investing** – June 2023. Recent market developments and investing trends have prompted investors to reconsider their investment allocations. Factors assist investors in understanding the present market and informing their investment decisions. Melissa Brown, Managing Director of Applied Researc
> — [MASTERCLASS: Factor Investing - June 2023 | Blog posts | STOXX](https://stoxx.com/masterclass-factor-investing-june-2023) — "WHITEPAPER"

**Sources:**
- [Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX amid evolving factor investing landscape | Blog posts | STOXX](https://stoxx.com/qa-with-blackrock-fourth-year-of-multifactor-collaboration-with-stoxx-amid-evolving-factor-investing-landscape) — "WHITEPAPER"
- [Factor Investing | STOXX](https://stoxx.com/category/factor-investing) — "WHITEPAPER"
- [Factor Investing: Q&amp;A on Flows, Outlook | Blog posts | STOXX](https://stoxx.com/factor-investing-qa-on-flows-outlook) — "WHITEPAPER"
- [Not so fast. Factor investing is alive and doing well! | Blog posts | STOXX](https://stoxx.com/not-so-fast-factor-investing-is-alive-and-doing-well) — "WHITEPAPER"
- [MASTERCLASS: Factor Investing - June 2023 | Blog posts | STOXX](https://stoxx.com/masterclass-factor-investing-june-2023) — "WHITEPAPER"

---

### Factor Premium

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="6 mentions across STOXX & ISS pages (low)">▰▰ 6</span>


> The long-run excess return attributable to systematic exposure to a specific
> factor, measured as the average return difference between a portfolio long
> high-scoring securities and short low-scoring securities on that factor. STOXX
> factor indices are designed to capture these premia in a long-only,
> investable format by overweighting high-scoring stocks relative to the
> benchmark.

In plain terms, the factor premium is the "payoff" for bearing factor risk. The value premium, for example, is the historical return gap between cheap and expensive stocks. Factor investing works only if these premia persist — and STOXX index design assumes they do over full market cycles.

$$
\text{Factor Premium}_k = \frac{1}{T}\sum_{t=1}^{T}\left(R_{t}^{\text{long}} - R_{t}^{\text{short}}\right)
$$

where the long (short) portfolio holds the top (bottom) quintile on factor $k$.

> [!tip] Related terms
> [[#Risk Premia]], [[#Factor Crowding]], [[#Factor (Definition)]]




> [!quote] A behind-the-scenes look at the STOXX Equity Factor indices | Blog posts | STOXX
> tially smoother investment profile over time. Figure 1: Components of the Multifactor signal in the STOXX Equity Factor indices Risk premium The paper reviews the risk management, diversification and turnover constraints built into the index methodology, a process that upholds the harvesting of the **factor premium** in an investable and repeatable framework. One of the key takeaways from the study...
> — [A behind-the-scenes look at the STOXX Equity Factor indices | Blog posts | STOXX](https://stoxx.com/a-behind-the-scenes-look-at-the-stoxx-equity-factor-indices) — "WHITEPAPER"

> [!quote] Evaluating the true cost of momentum investing | Blog posts | STOXX
> monthly, stocks with weaker momentum scores are reduced or sold. The methodology ensures that the portfolio is made up of each month’s best-of-momentum stocks with all constraints considered. Opportunities in 2018 Many investors say momentum will continue to perform well in 2018, although, like all **factor premium**s, it is subject to cyclicality and reversals. The BlackRock Investment Institute c...
> — [Evaluating the true cost of momentum investing | Blog posts | STOXX](https://stoxx.com/evaluating-the-true-cost-of-momentum-investing) — "WHITEPAPER"

> [!quote] Q&amp;A: Credit Suisse’s Froehlich on Multi-Premia Investing | Blog posts | S...
> roach with those of passive replication is a very good proposition. Can you briefly describe the stock selection methodology? The multi-premia methodology was developed by Finreon. Based on relevant and scientifically proven ratios, the best stocks from the investment universe are selected for each **factor premium** — value, size, momentum, residual momentum, reversal, low risk and quality. Within...
> — [Q&amp;A: Credit Suisse’s Froehlich on Multi-Premia Investing | Blog posts | S...](https://stoxx.com/qa-credit-suisses-froehlich-on-multi-premia-investing) — "WHITEPAPER"

> [!quote] Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX a...
> ies and correlations. We aim to maximize the multifactor exposure subject to risk and also cost constraints, not equal exposure for its own sake. Our typical tracking error target of 1–2% helps ensure that the portfolio stays suitable for core allocations, while still aiming to deliver a persistent **factor premium**. In other words, it’s not about giving each factor the same weight — but rather gi...
> — [Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX a...](https://stoxx.com/qa-with-blackrock-fourth-year-of-multifactor-collaboration-with-stoxx-amid-evolving-factor-investing-landscape) — "WHITEPAPER"

> [!quote] 2019 Market Outlook II – Dollar Down, Risk Up? | Blog posts | STOXX
> , shedding 7.7%. The value index has underperformed the average of the other six factor gauges in all but one year since 2013. The iSTOXX Europe Factor Market Neutral Indices hold a short position in futures on the STOXX Europe 600 to neutralize systematic risk and hence gain exposure purely to the **factor premium**. ESG strategies to pay off Following a difficult year, environmental, social and g...
> — [2019 Market Outlook II – Dollar Down, Risk Up? | Blog posts | STOXX](https://stoxx.com/2019-market-outlook-ii-dollar-down-risk-up) — "WHITEPAPER"

**Sources:**
- [A behind-the-scenes look at the STOXX Equity Factor indices | Blog posts | STOXX](https://stoxx.com/a-behind-the-scenes-look-at-the-stoxx-equity-factor-indices) — "WHITEPAPER"
- [Evaluating the true cost of momentum investing | Blog posts | STOXX](https://stoxx.com/evaluating-the-true-cost-of-momentum-investing) — "WHITEPAPER"
- [Q&amp;A: Credit Suisse’s Froehlich on Multi-Premia Investing | Blog posts | STOXX](https://stoxx.com/qa-credit-suisses-froehlich-on-multi-premia-investing) — "WHITEPAPER"
- [Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX amid evolving factor investing landscape | Blog posts | STOXX](https://stoxx.com/qa-with-blackrock-fourth-year-of-multifactor-collaboration-with-stoxx-amid-evolving-factor-investing-landscape) — "WHITEPAPER"
- [2019 Market Outlook II – Dollar Down, Risk Up? | Blog posts | STOXX](https://stoxx.com/2019-market-outlook-ii-dollar-down-risk-up) — "WHITEPAPER"

---

### Factor Rotation

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="3 mentions across STOXX & ISS pages (ultra-low)">▰ 3</span>


> A dynamic strategy that adjusts factor exposures over time based on the
> macroeconomic cycle, factor valuations, momentum of factor returns, or other
> timing signals. While STOXX's core factor indices use static factor weights,
> Qontigo research explores rotation frameworks that shift allocations between
> value, momentum, quality, and low volatility depending on regime indicators.

In plain terms, factor rotation is the idea of being a "factor timer" — overweighting value when value is cheap and momentum when trends are strong. It is appealing in theory but difficult in practice, which is why most STOXX indices stick to fixed multi-factor blends and leave rotation to active managers.

> [!tip] Related terms
> [[#Factor Diversification]], [[#Factor Crowding]], [[#Multi-Factor]]




> [!quote] ISS EVA Resource Center | ISS
> VA, not EBITDA: A Better Measure of Investment Value The Four Key EVA Performance Ratios Insights Into Value Creation: Using EVA to Measure Performance The Link Between TSR and EVA The EVA Measurement Formula: A Primer on Economic Value Added (EVA) Using EVA in Pay-for-Performance Analysis WEBINARS **Factor Rotation**s: When Do Growth and Value Outperform? Manage Risk by Managing Expectations Getti...
> — [ISS EVA Resource Center | ISS](https://www.issgovernance.com/eva/iss-eva-resource-center) — "ISS EVA"

> [!quote] Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX a...
> arket cycles. These ETFs are designed to replace traditional core equity holdings with balanced exposures to long-term drivers of returns.” To finish off, how has the iShares multifactor suite performed since launch three years ago? “The past three years have been a volatile period, marked by sharp **factor rotation**s, inflation surprises and diverging Growth and Value performance. Yet the suite h...
> — [Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX a...](https://stoxx.com/qa-with-blackrock-fourth-year-of-multifactor-collaboration-with-stoxx-amid-evolving-factor-investing-landscape) — "WHITEPAPER"

**Sources:**
- [ISS EVA Resource Center | ISS](https://www.issgovernance.com/eva/iss-eva-resource-center) — "ISS EVA"
- [Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX amid evolving factor investing landscape | Blog posts | STOXX](https://stoxx.com/qa-with-blackrock-fourth-year-of-multifactor-collaboration-with-stoxx-amid-evolving-factor-investing-landscape) — "WHITEPAPER"

---

### Factor Tilt

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="6 mentions across STOXX & ISS pages (low)">▰▰ 6</span>


> The deliberate overweighting or underweighting of securities based on their
> factor scores relative to a benchmark. STOXX factor-tilted indices apply a
> multiplier to each security's benchmark weight proportional to its factor
> z-score, then renormalize to sum to 100%.

In plain terms, a factor tilt says "keep roughly the same portfolio as the benchmark, but lean more heavily toward stocks that score well on the factor." It is a moderate approach — halfway between a passive index and a pure factor portfolio.

$$
w_i^{\text{tilted}} = \frac{w_i^{\text{bench}} \cdot e^{\kappa \cdot z_i}}{\sum_{j} w_j^{\text{bench}} \cdot e^{\kappa \cdot z_j}}
$$

where $\kappa$ controls the aggressiveness of the tilt and $z_i$ is the factor z-score.

> [!tip] Related terms
> [[#Alpha Signal]], [[#Factor-Based Index]], [[#Active Industry Constraint]]




> [!quote] Evaluating the true cost of momentum investing | Blog posts | STOXX
> . Other constraints the iSTOXX factor indices methodology include a limit in the number of stocks and a cap on each stock’s weight. Methodology and optimization approach help trigger sell signal A strict sell discipline is a function of the iSTOXX factor indices’ process. The indices aim for a high **factor tilt**, a proxy for a stock’s expected return. Constituents get a larger weighting the highe...
> — [Evaluating the true cost of momentum investing | Blog posts | STOXX](https://stoxx.com/evaluating-the-true-cost-of-momentum-investing) — "WHITEPAPER"

> [!quote] Monthly Index News December 2023 (PDF)
> s offer robust factor definitions and targeted factor exposures, and ensure the tradability of component stocks. They employ the institutionally tested analytics of Axioma Factor Risk Models. On a global basis, Size showed the best performance last month while Low Risk had the weakest one. The Size **factor tilt**s towards the smallest-capitalization stocks. Over the entire 2023, Quality was the st...
> — [Monthly Index News December 2023 (PDF)](https://stoxx.com/monthly-index-news-december-2023)

> [!quote] The diversification benefits of a multi-factor approach: the STOXX Europe 600...
> ontribution, only overshadowed by very strong performances from a few other factors. Exhibit 4: Heat map of targeted factor contributions, 2002 to 2021 The STOXX Europe 600 Industry Neutral Ax Multi-Factor Index is constructed so that it gets most of its risk – and therefore return – from its style **factor tilt**s, and we see that that is the case in most years. In a few years we see a large ‘spec...
> — [The diversification benefits of a multi-factor approach: the STOXX Europe 600...](https://stoxx.com/the-diversification-benefits-of-a-multi-factor-approach-the-stoxx-europe-600-industry-neutral-ax-multi-factor-index) — "WHITEPAPER"

> [!quote] Istoxx Index Guide (PDF)
> and Responsible Minimum Volatility Indices are a set of indices designed by optimizing the parent index (iSTOXX World A index) to produce a set of indices that G have the lowest absolute ex-ante volatility under different ESG, Carbon and SDI constraints. Those indices also place controls over style **factor tilt**s, industry / country exposures and liquidity / tradability. W Indices: The iSTOXX APG...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

> [!quote] Stocks extend gains in December, lifting indices to record highs | Blog posts...
> r the entire year, all markets except Hong Kong gained. Sixteen of 20 emerging markets tracked by STOXX rose in the year. Factor investing On a global basis, Size showed the best performance in December while Low Risk was the weakest style, according to the STOXX Factor indices (Figure 5). The Size **factor tilt**s towards the smallest-capitalization stocks. For 2023, the STOXX® Global 1800 Ax Qual...
> — [Stocks extend gains in December, lifting indices to record highs | Blog posts...](https://stoxx.com/stocks-extend-gains-in-december-lifting-indices-to-record-highs) — "WHITEPAPER"

**Sources:**
- [Evaluating the true cost of momentum investing | Blog posts | STOXX](https://stoxx.com/evaluating-the-true-cost-of-momentum-investing) — "WHITEPAPER"
- [Monthly Index News December 2023 (PDF)](https://stoxx.com/monthly-index-news-december-2023)
- [The diversification benefits of a multi-factor approach: the STOXX Europe 600 Industry Neutral Ax Multi-Factor Index | Blog posts | STOXX](https://stoxx.com/the-diversification-benefits-of-a-multi-factor-approach-the-stoxx-europe-600-industry-neutral-ax-multi-factor-index) — "WHITEPAPER"
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
- [Stocks extend gains in December, lifting indices to record highs | Blog posts | STOXX](https://stoxx.com/stocks-extend-gains-in-december-lifting-indices-to-record-highs) — "WHITEPAPER"

---

### Factor-Based Index

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="8 mentions across STOXX & ISS pages (low)">▰▰ 8</span>


> A rules-based, transparent index whose weighting scheme is derived from one or
> more factor signals rather than pure market capitalization. STOXX offers
> single-factor indices (e.g., STOXX Europe 600 Value) and multi-factor indices
> (e.g., STOXX Global Multi-Factor) as investable benchmarks for factor
> strategies.

In plain terms, a factor-based index is like a regular stock index — the S&P 500 or EURO STOXX 50 — except the weights are tilted by a factor score instead of simply reflecting company size.

> [!tip] Related terms
> [[#Factor Investing]], [[#Smart Beta]], [[#Factor Tilt]]




> [!quote] STOXX and L&amp;G collaborate on launch of three L&amp;G developed world fact...
> ZUG, Switzerland (September 11, 2025) – STOXX Ltd., part of the ISS STOXX group of companies, today announced its expanding collaboration with L&G, with L&G’s launch of three developed world **factor-based index** funds tracking customized iSTOXX indices. These funds, built on customized iSTOXX indices, reflect L&G’s proprietary factor research and aim to bring institutional-grade strategies to the...
> — [STOXX and L&amp;G collaborate on launch of three L&amp;G developed world fact...](https://stoxx.com/stoxx-and-lg-collaborate-on-launch-of-three-lg-developed-world-factor-based-index-funds) — "WHITEPAPER"

> [!quote] Factor Investing: Q&amp;A on Flows, Outlook | Blog posts | STOXX
> etween the market-neutral factor indices, i.e. the risk premia, and the benchmark STOXX® Europe 600 index were very low and even negative over the study period, meaning they can also serve as a great source of diversification. You mentioned low cost. How important is that as a driver for flows into **factor-based index** products? Our experience is that lower fees can be a defining variable when co...
> — [Factor Investing: Q&amp;A on Flows, Outlook | Blog posts | STOXX](https://stoxx.com/factor-investing-qa-on-flows-outlook) — "WHITEPAPER"

> [!quote] Factor Investing | STOXX
> ed. Stocks rose for the sixth consecutive month in September, the longest positive run in four years, on investor expectations that falling US interest rates and sustained economic growth will help corporate earnings. Factor Investing STOXX and L&G collaborate on launch of three L&G developed world **factor-based index** funds STOXX Ltd. today announced its expanding collaboration with L&G, with L&...
> — [Factor Investing | STOXX](https://stoxx.com/category/factor-investing) — "WHITEPAPER"

> [!quote] LGIM switches to iSTOXX World Min Vol ESG index for pension fund mandate | Bl...
> Legal & General Investment Management (LGIM), the biggest UK-based asset manager, has switched to the iSTOXX® World Min Vol ESG index to manage a mandate for a large pension-fund client. At the center of this sustainable, **factor-based index** solution is a systematic process that uses the Axioma optimizer to balance multiple investment objectives and considerations. They include minimizing portfo...
> — [LGIM switches to iSTOXX World Min Vol ESG index for pension fund mandate | Bl...](https://stoxx.com/lgim-switches-to-istoxx-world-min-vol-esg-index-for-pension-fund-mandate) — "WHITEPAPER"

> [!quote] ETF Inflows Grow, Assets Reach Record | STOXX
> OXX’s parent Qontigo. “The transformation of investment universes with an ESG focus is catching up with the most important benchmarks, creating an acceleration of the phenomenon,” said Roberto Lazzarotto, Global Head of Sales at STOXX. ESG stands for environmental, social and governance strategies. **Factor-based index** strategies, which select stocks according to specific sources of risk and retu...
> — [ETF Inflows Grow, Assets Reach Record | STOXX](https://stoxx.com/etf-inflows-grow-assets-reach-record) — "WHITEPAPER"

**Sources:**
- [STOXX and L&amp;G collaborate on launch of three L&amp;G developed world factor-based index funds | Press releases | STOXX](https://stoxx.com/stoxx-and-lg-collaborate-on-launch-of-three-lg-developed-world-factor-based-index-funds) — "WHITEPAPER"
- [Factor Investing: Q&amp;A on Flows, Outlook | Blog posts | STOXX](https://stoxx.com/factor-investing-qa-on-flows-outlook) — "WHITEPAPER"
- [Factor Investing | STOXX](https://stoxx.com/category/factor-investing) — "WHITEPAPER"
- [LGIM switches to iSTOXX World Min Vol ESG index for pension fund mandate | Blog posts | STOXX](https://stoxx.com/lgim-switches-to-istoxx-world-min-vol-esg-index-for-pension-fund-mandate) — "WHITEPAPER"
- [ETF Inflows Grow, Assets Reach Record | STOXX](https://stoxx.com/etf-inflows-grow-assets-reach-record) — "WHITEPAPER"

---

## G

### Growth Factor

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1 mentions across STOXX & ISS pages (ultra-low)">▰ 1</span>


> A factor that selects securities exhibiting above-average earnings growth,
> revenue growth, or expected future growth rates. In the STOXX factor taxonomy,
> growth is often positioned as the complement of value: growth stocks trade at
> high valuation multiples justified by superior fundamental expansion, while
> value stocks trade at low multiples on weaker growth expectations.

In plain terms, the growth factor bets on companies that are expanding quickly — fast-rising revenues, accelerating profits, or analyst forecasts pointing sharply upward. These stocks are rarely cheap, but the thesis is that the market still underestimates how long strong growth can persist.

$$
\text{Growth}_i = \frac{1}{3}\left(z_{\text{EPS growth},i} + z_{\text{Revenue growth},i} + z_{\text{Fwd growth},i}\right)
$$

> [!tip] Related terms
> [[#Value Factor]], [[#Earnings Momentum]], [[#Factor (Definition)]]




> [!quote] The AI revolution is taking place now – a look inside the STOXX Global Artifi...
> Figure 8 shows the active style-factor exposures of the AI index relative to the parent universe of the STOXX® World AC. The AI index has its largest positive active exposures in the Market Sensitivity, Volatility and Liquidity factors, while also being more exposed to the Medium-Term Momentum and **Growth factor**s. Negative active exposures include those to the Dividend Yield, Exchange Rate Sensi...
> — [The AI revolution is taking place now – a look inside the STOXX Global Artifi...](https://stoxx.com/the-ai-revolution-is-taking-place-now-a-look-inside-the-stoxx-global-artificial-intelligence-index) — "WHITEPAPER"

**Sources:**
- [The AI revolution is taking place now – a look inside the STOXX Global Artificial Intelligence index | Blog posts | STOXX](https://stoxx.com/the-ai-revolution-is-taking-place-now-a-look-inside-the-stoxx-global-artificial-intelligence-index) — "WHITEPAPER"

---

## I

### Industry Neutral

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="860 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 860</span>


> A portfolio construction constraint ensuring that the aggregate weight of each
> GICS industry or ICB sector in the factor portfolio exactly matches its weight
> in the parent index. STOXX industry-neutral factor indices isolate pure
> within-sector stock selection alpha by eliminating cross-sector bets entirely.

In plain terms, if the benchmark has 12% in pharmaceuticals, the factor index also holds exactly 12% in pharmaceuticals. All the action happens inside each sector — picking the best factor stocks within each industry — rather than across sectors.

> [!tip] Related terms
> [[#Active Industry Constraint]], [[#Tracking Error Budget]], [[#Factor Tilt]]




> [!quote] Eurex to List Futures on STOXX Industry Neutral Ax Factor Indices | Blog post...
> Eurex is listing futures tracking 12 STOXX® **Industry Neutral** Ax Factor Indices covering the European and US markets, allowing investors to target well-researched and robust factor strategies relying on Axioma’s Risk Models and optimization tools. The STOXX **Industry Neutral** Ax Factor Indices are derived from two well-established market-capitalization regional benchmarks, the STOXX® Europe 600 In...
> — [Eurex to List Futures on STOXX Industry Neutral Ax Factor Indices | Blog post...](https://stoxx.com/eurex-to-list-futures-on-stoxx-industry-neutral-ax-factor-indices) — "WHITEPAPER"

> [!quote] Introducing the STOXX Industry Neutral Ax Factor Indices | Blog posts | STOXX
> xposures and access the ‘pure’ return of the factor. The STOXX® **Industry Neutral** Ax Factor Indices implement the same methodology of the STOXX Factor Indices while reducing the active industry1 constraint from +/- 5% to near neutral. In all but eliminating the overall industry deviations, the STOXX **Industry Neutral** Factor Indices may sacrifice some factor exposure, but benefit from targeting lo...
> — [Introducing the STOXX Industry Neutral Ax Factor Indices | Blog posts | STOXX](https://stoxx.com/introducing-the-stoxx-industry-neutral-ax-factor-indices) — "WHITEPAPER"

> [!quote] The diversification benefits of a multi-factor approach: the STOXX Europe 600...
> iversification benefit and should weather all different kinds of markets. The purpose of this article is to analyze the performance — and showcase the benefits — of a multi-factor strategy through time. Before we dive into the analysis, let’s briefly review the methodology and offering of the STOXX **Industry Neutral** Single and Multi-Factor indices. STOXX **Industry Neutral** Factor Indices The stand...
> — [The diversification benefits of a multi-factor approach: the STOXX Europe 600...](https://stoxx.com/the-diversification-benefits-of-a-multi-factor-approach-the-stoxx-europe-600-industry-neutral-ax-multi-factor-index) — "WHITEPAPER"

> [!quote] Istoxx Index Guide (PDF)
> iSTOXX® METHODOLOGY GUIDE 386/1024 12158. i.SiSTTOOXXXX G GLLOOBBAALL I NINDDUUSSTTRRYY NEUNTERUATLR EASL GE S6G00 6 I0N0D IENXD EX 25.1. iSTOXX GLOBAL **INDUSTRY NEUTRAL** ESG 600 INDEX OVERVIEW The iSTOXX Global **Industry Neutral** ESG 600 index tracks the performance of the leading companies with regard to Environmental, Social and Governance criteria, based on ESG exclusion screens applied for Nor...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

> [!quote] Stoxx Index Guide (PDF)
> Maximum Dividend Indices October 2016 (5): Addition of revised Minimum Variance methodology in chapter 16.1, STOXX Minimum Variance and Minimum Variance Unconstrained October 2016 (6): Addition of STOXX China A 900 Minimum Variance Indices in chapter 16.1. November 2016: Addition of STOXX Regional **Industry Neutral** ESG and STOXX Regional Excluding Tobacco **Industry Neutral** ESG indices in chapter ...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

**Sources:**
- [Eurex to List Futures on STOXX Industry Neutral Ax Factor Indices | Blog posts | STOXX](https://stoxx.com/eurex-to-list-futures-on-stoxx-industry-neutral-ax-factor-indices) — "WHITEPAPER"
- [Introducing the STOXX Industry Neutral Ax Factor Indices | Blog posts | STOXX](https://stoxx.com/introducing-the-stoxx-industry-neutral-ax-factor-indices) — "WHITEPAPER"
- [The diversification benefits of a multi-factor approach: the STOXX Europe 600 Industry Neutral Ax Multi-Factor Index | Blog posts | STOXX](https://stoxx.com/the-diversification-benefits-of-a-multi-factor-approach-the-stoxx-europe-600-industry-neutral-ax-multi-factor-index) — "WHITEPAPER"
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

## L

### Low Risk Factor

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="100 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 100</span>


> A broad factor category encompassing strategies that overweight securities
> exhibiting lower realized or predicted risk metrics. In STOXX's framework, low
> risk subsumes both low volatility (based on historical standard deviation) and
> low beta (based on market sensitivity), and may be combined with other signals
> in multi-factor constructions.

In plain terms, the low risk factor is the finding that boring, steady stocks have historically delivered better risk-adjusted returns than wild, volatile ones — contradicting the textbook idea that more risk always equals more reward.

> [!tip] Related terms
> [[#Low Volatility Factor]], [[#Minimum Variance]], [[#Risk Premia]]




> [!quote] Stoxx Minvar Paper (PDF)
> variance index than a simple risk-reduction strategy. Drawdowns are smaller and occur less often for the MVP and it has a higher average return. Further, the market capitalization weighted benchmark has fatter tails. In other words, a low risk weighted portfolio is an impure attempt at achieving a **Low Risk factor** allocation. This does not adequately compare with MVP which gives the optimal fact...
> — [Stoxx Minvar Paper (PDF)](http://www.stoxx.com/document/Others/marketing/STOXX_MinVar_Paper.pdf)

> [!quote] Monthly Index News August 2023 (PDF)
> tralize systematic risk and tap exposure to pure factor investing. All indices had a positive return last month. Risk and return characteristics (EUR) Return (%) (EUR) Annualized volatility (%) 1M YTD 1Y 1M YTD 1Y 1. iSTOXX Europe Carry Factor Market Neutral 1.4 2.6 0.3 3.9 3.7 3.8 2. iSTOXX Europe **Low Risk Factor** Market Neutral 0.8 0.7 -0.6 3.1 3.2 3.2 3. iSTOXX Europe Momentum Factor Market N...
> — [Monthly Index News August 2023 (PDF)](https://stoxx.com/monthly-index-news-august-2023)

> [!quote] STOXX Global 1800 climbs to record in February on US economy, earnings outloo...
> ests investors are paying up for puts that offer insurance against stock price drops. The VDAX-New®, which measures volatility in German equities, eased to 12.9 from 14.2 in January. Factor investing The Momentum signal ruled across geographies, according to the STOXX Factor indices (Figure 5). The **Low Risk factor** was the weakest signal in the month. Figure 5: STOXX Factor (Global) indices’ Feb...
> — [STOXX Global 1800 climbs to record in February on US economy, earnings outloo...](https://stoxx.com/stoxx-global-1800-climbs-to-record-in-february-on-us-economy-earnings-outlook) — "WHITEPAPER"

> [!quote] Monthly Index News December 2020 (PDF)
> indices hold a short position in STOXX Europe 600 futures to help investors neutralize systematic risk. Size was, as with the STOXX Factor Indices, the best-performing strategy. The iSTOXX® Europe Size Factor Market Neutral Index added 2.5% on a net-return basis during the month. The iSTOXX® Europe **Low Risk Factor** Market Neutral Index, on the other hand, retreated 0.6% in the month. The iSTOXX®...
> — [Monthly Index News December 2020 (PDF)](https://stoxx.com/monthly-index-news-december-2020)

> [!quote] Monthly Index News December 2021 (PDF)
> MONTHLY INDEX NEWS / December 2021 Factor indices – Regional: US Key points Within US markets, the **Low Risk factor** fared as well as Value in December. Multi-Factor also led gains in 2021, and by a wide margin. Risk and return characteristics Return (%) Annualized volatility (%) EUR USD EUR USD 1M YTD 1Y 1M YTD 1Y 1M YTD 1Y 1M YTD 1Y 1. STOXX USA 500 Ax Low Risk 5.5 33.5 33.5 6.6 24.1 24.1 13.7 12
> — [Monthly Index News December 2021 (PDF)](https://stoxx.com/monthly-index-news-december-2021)

**Sources:**
- [Stoxx Minvar Paper (PDF)](http://www.stoxx.com/document/Others/marketing/STOXX_MinVar_Paper.pdf)
- [Monthly Index News August 2023 (PDF)](https://stoxx.com/monthly-index-news-august-2023)
- [STOXX Global 1800 climbs to record in February on US economy, earnings outlook | Blog posts | STOXX](https://stoxx.com/stoxx-global-1800-climbs-to-record-in-february-on-us-economy-earnings-outlook) — "WHITEPAPER"
- [Monthly Index News December 2020 (PDF)](https://stoxx.com/monthly-index-news-december-2020)
- [Monthly Index News December 2021 (PDF)](https://stoxx.com/monthly-index-news-december-2021)

---

### Low Volatility Factor

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="14 mentions across STOXX & ISS pages (low)">▰▰ 14</span>


> The specific implementation of the low risk factor that selects or overweights
> securities with the lowest trailing realized volatility (typically measured over
> 12 months of daily returns). STOXX low volatility indices rank all constituents
> of the parent index by inverse volatility and select the least volatile subset.

In plain terms, you rank all stocks from calmest to most volatile, then build a portfolio heavily weighted toward the calm ones. History shows this simple strategy often beats the market on a risk-adjusted basis.

$$
\sigma_i = \sqrt{\frac{1}{T-1} \sum_{t=1}^{T} (r_{i,t} - \bar{r}_i)^2}
$$

Securities with the smallest $\sigma_i$ receive the highest weights.

> [!tip] Related terms
> [[#Low Risk Factor]], [[#Minimum Variance]], [[#Equal Risk Contribution]]




> [!quote] Stoxx Index Guide (PDF)
> is given by the latest 12-month net income divided by the total market capitalization. Signals are z-scored using the Parent Index weights and outliers are truncated at +/- 3 standard deviations. The Value Factor combines the 5 Signals equally at 20% weights and is again z-scored and truncated. The **Low Volatility Factor** is given by the standard deviation of monthly total returns in local curren...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] BlackRock’s Jamie Forbes: Implementing ‘evolutionary’ factor advancements in ...
> ortfolio and offers that little bit lower risk profile. As such, the STOXX Equity Factor indices upweight Quality. Value and Momentum are natural pairs, and so they have the same weight relative to each other. The Small Size factor, for its part, is a high beta, pro-cyclical factor, relative to the **Low Volatility factor**, which is low beta and a much more defensive factor. Those are opposing fac...
> — [BlackRock’s Jamie Forbes: Implementing ‘evolutionary’ factor advancements in ...](https://stoxx.com/blackrocks-jamie-forbes-implementing-evolutionary-factor-advancements-in-investments) — "WHITEPAPER"

> [!quote] Stoxx Minvar Paper (PDF)
> n order to reduce risk. This involves dynamically rotating around stock, industry, geographical and factor allocations, taking into account current market information in order to always hold the portfolio with minimum risk. Importantly, minimum variance does not equate to a simple allocation to the **low volatility factor**, which would be represented by a portfolio with long low volatility stocks ...
> — [Stoxx Minvar Paper (PDF)](http://www.stoxx.com/document/Others/marketing/STOXX_MinVar_Paper.pdf)

> [!quote] The low volatility premium – An analysis of factor exposures of minimum varia...
> 1952][1]. In the years following his work, a vast number of empirical studies looked into characteristics of minimum variance portfolios with a focus on how to best implement such strategies in practice[2]. In recent years, however, academia has shifted its focus to the explanation of the so-called **low volatility factor**. The traditional Capital Asset Pricing Model (CAPM) explains asset returns ...
> — [The low volatility premium – An analysis of factor exposures of minimum varia...](https://stoxx.com/the-low-volatility-premium-an-analysis-of-factor-exposures-of-minimum-variance-strategies-blog) — "WHITEPAPER"

> [!quote] The New Faces of Risk Management | Blog posts | STOXX
> k as much as they are used to target higher-growth areas. Factors and minimum variance The boom in factor-based strategies in the past decade has also allowed investors to allocate resources to stocks whose features can help make them less vulnerable in volatile markets. That’s true not just of the **low volatility factor**, but also of quality, high dividend and even value. Factor investing has al...
> — [The New Faces of Risk Management | Blog posts | STOXX](https://stoxx.com/the-new-faces-of-risk-management) — "WHITEPAPER"

**Sources:**
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [BlackRock’s Jamie Forbes: Implementing ‘evolutionary’ factor advancements in investments | Blog posts | STOXX](https://stoxx.com/blackrocks-jamie-forbes-implementing-evolutionary-factor-advancements-in-investments) — "WHITEPAPER"
- [Stoxx Minvar Paper (PDF)](http://www.stoxx.com/document/Others/marketing/STOXX_MinVar_Paper.pdf)
- [The low volatility premium – An analysis of factor exposures of minimum variance strategies | Blog posts | STOXX](https://stoxx.com/the-low-volatility-premium-an-analysis-of-factor-exposures-of-minimum-variance-strategies-blog) — "WHITEPAPER"
- [The New Faces of Risk Management | Blog posts | STOXX](https://stoxx.com/the-new-faces-of-risk-management) — "WHITEPAPER"

---

## M

### Mean-Variance Optimization

> The mathematical framework — introduced by Markowitz (1952) — that constructs
> portfolios by maximizing expected return for a given level of risk, or
> equivalently minimizing risk for a given expected return. STOXX risk-based
> indices rely on variants of mean-variance optimization: minimum variance
> indices set expected returns to zero and minimize variance; factor-tilted
> indices incorporate alpha signals as expected return proxies within the
> optimizer.

In plain terms, mean-variance optimization is the engine under the hood of most STOXX smart beta indices. You feed it expected returns, a covariance matrix, and constraints (weight caps, turnover limits), and it spits out the "best" set of portfolio weights. The challenge is that small errors in inputs can produce wildly different outputs — which is why STOXX adds heavy constraints.

$$
w^* = \arg\max_{w} \left\{ w^\top \mu - \frac{\lambda}{2} w^\top \Sigma w \right\} \quad \text{s.t.} \quad \sum_i w_i = 1, \; w_i \geq 0
$$

where $\mu$ is the vector of expected returns, $\Sigma$ is the covariance matrix, and $\lambda$ is the risk-aversion parameter.

> [!tip] Related terms
> [[#Efficient Frontier]], [[#Minimum Variance]], [[#Maximum Diversification]]

**Sources:**

---

### Maximum Diversification

> A portfolio optimization approach that maximizes the diversification ratio —
> the ratio of the weighted average of individual asset volatilities to the
> portfolio's total volatility. STOXX Maximum Diversification indices solve for
> the weight vector that maximizes this ratio subject to long-only and capping
> constraints.

In plain terms, the strategy seeks the portfolio that gets the biggest "diversification discount." It finds weights where correlation effects reduce total portfolio risk by the largest possible amount relative to the stocks' standalone risks.

$$
\text{DR}(w) = \frac{\sum_i w_i \sigma_i}{\sqrt{w^\top \Sigma w}}
$$

The optimizer finds $w^*$ that maximizes $\text{DR}(w)$.

> [!tip] Related terms
> [[#Minimum Variance]], [[#Equal Risk Contribution]], [[#Risk Parity]]

**Sources:**

---

### Minimum Variance

<span style="background:red; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1,249 mentions across STOXX & ISS pages (high)">▰▰▰▰▰▰ 1,249</span>


> A portfolio optimization strategy that seeks the set of weights producing the
> lowest possible portfolio volatility. STOXX Minimum Variance indices use an
> estimated covariance matrix (from Axioma or similar risk models) and solve a
> quadratic program subject to weight caps, turnover limits, and sector
> constraints.

In plain terms, the minimum variance portfolio answers: "Given these stocks and their historical relationships, what combination produces the smoothest possible ride?" It does not try to predict returns — only to minimize risk.

$$
w^* = \arg\min_{w} \; w^\top \Sigma w \quad \text{s.t.} \quad \sum_i w_i = 1, \; w_i \geq 0
$$

> [!tip] Related terms
> [[#Low Volatility Factor]], [[#Maximum Diversification]], [[#Capping Constraint]]




> [!quote] Minimum Variance Indices | STOXX
> Based on Modern Portfolio Theory, the STOXX **Minimum Variance** indices aim to limit volatility using a consistently applied and rules-based methodology. The index suite, which uses our factor-model approach two versions of every benchmark — constrained and unconstrained. Key indices STOXX Europe 600 **Minimum Variance** Loading… STOXX USA 900 Minim
> — [Minimum Variance Indices | STOXX](https://stoxx.com/minimum-variance-indices) — "WHITEPAPER"

> [!quote] Minimum Variance’s Prowess in Risk Protection | Blog posts | STOXX
> potential is further reinforced as low-volatility stocks are cheaper to hedge through derivatives than are more volatile shares. Yet **minimum variance** has also paid off in times of rising markets. One explanation is that market cap-weighted indices take on systematic, or undiversifiable, risk that a **minimum variance** strategy does not. The second reason is the so-called low-volatility anomaly, or...
> — [Minimum Variance’s Prowess in Risk Protection | Blog posts | STOXX](https://stoxx.com/minimum-variances-prowess-in-risk-protection) — "WHITEPAPER"

> [!quote] Minimum Variance Indices: A Reading Through Geopolitical Risk | Blog posts | ...
> rior risk-return characteristics in times of market stress. While this is a welcome relief in an increasingly uncertain geopolitical world, investors should approach the strategies with full knowledge of the resulting portfolio constitution and characteristics. Featured indices - STOXX® Global 1800 **Minimum Variance** Index - STOXX® USA 900 **Minimum Variance** Index - EURO STOXX® Minimum Variance Ind...
> — [Minimum Variance Indices: A Reading Through Geopolitical Risk | Blog posts | ...](https://stoxx.com/minimum-variance-indices-a-reading-through-geopolitical-risk) — "WHITEPAPER"

> [!quote] The low volatility premium – An analysis of factor exposures of minimum varia...
> **Minimum variance** strategies have gained significant traction especially since the global financial crisis. They aim at reducing or minimizing variance, i.e. the square of volatility as measured by standard deviation, or, in this case, price fluctuations of portfolio prices around their mean. Continu
> — [The low volatility premium – An analysis of factor exposures of minimum varia...](https://stoxx.com/the-low-volatility-premium-an-analysis-of-factor-exposures-of-minimum-variance-strategies) — "WHITEPAPER"

> [!quote] Minimum Variance has its ‘day in the sun’ - ETF Express
> filter which involves looking at the factors’ exposures of the min var portfolio and setting a threshold for those to remain within a certain range of the benchmark. This means that the min var version will likely have similar attributes to the benchmark as well as achieving the objective of having **minimum variance**. The min var approach is popular with a broad cross section of clients from trad...
> — [Minimum Variance has its ‘day in the sun’ - ETF Express](https://stoxx.com/minimum-variance-has-its-day-in-the-sun) — "Minimum Variance has its ‘day in the sun’"

**Sources:**
- [Minimum Variance Indices | STOXX](https://stoxx.com/minimum-variance-indices) — "WHITEPAPER"
- [Minimum Variance’s Prowess in Risk Protection | Blog posts | STOXX](https://stoxx.com/minimum-variances-prowess-in-risk-protection) — "WHITEPAPER"
- [Minimum Variance Indices: A Reading Through Geopolitical Risk | Blog posts | STOXX](https://stoxx.com/minimum-variance-indices-a-reading-through-geopolitical-risk) — "WHITEPAPER"
- [The low volatility premium – An analysis of factor exposures of minimum variance strategies | Whitepapers | STOXX](https://stoxx.com/the-low-volatility-premium-an-analysis-of-factor-exposures-of-minimum-variance-strategies) — "WHITEPAPER"
- [Minimum Variance has its ‘day in the sun’ - ETF Express](https://stoxx.com/minimum-variance-has-its-day-in-the-sun) — "Minimum Variance has its ‘day in the sun’"

---

### Momentum Factor

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="151 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 151</span>


> A factor that captures the tendency of recent winners to continue outperforming
> and recent losers to continue underperforming over medium-term horizons. STOXX
> implements momentum using 12-month cumulative return with a 1-month reversal
> exclusion (i.e., months 2 through 12), following the Carhart (1997) convention.

In plain terms, momentum is the "hot hand" effect in markets: stocks that have gone up over the past year (excluding the most recent month) tend to keep going up for a while. Factor indices ride this trend systematically.

$$
\text{Mom}_i = \frac{P_{i,t-1}}{P_{i,t-12}} - 1
$$

The most recent month is excluded to avoid the short-term reversal effect.

> [!tip] Related terms
> [[#Price Momentum]], [[#Earnings Momentum]], [[#Earnings Announcement Drift]]




> [!quote] Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX a...
> entum or earnings momentum drift — enhances signal strength (Figure 2). This approach helps us avoid simplistic exposures and better reflect what Momentum truly represents: a behavioral phenomenon rooted in investor underreaction, and not just a statistical artifact.” Figure 2: Active returns – USA **Momentum factor** “It’s worth emphasizing here that innovating in factor design does not mean negle...
> — [Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX a...](https://stoxx.com/qa-with-blackrock-fourth-year-of-multifactor-collaboration-with-stoxx-amid-evolving-factor-investing-landscape) — "WHITEPAPER"

> [!quote] Istoxx Index Guide (PDF)
> 𝑖𝑧𝑒 𝑖=𝑁 𝐵̂𝑃𝑅 𝑖=𝑁 𝜀 𝑖=𝑁 where 𝛽 ̂𝑀𝑜𝑚 : standardized 12-month momentum adjusted with market beta factor of stock i 𝑎𝑑𝑗 𝑖 𝑠̂𝑖𝑧𝑒 : standardized size factor of stock i 𝑖 𝐵̂𝑃𝑅 : standardized BPR of stock i 𝑖 ε : residual error i α* : alpha N : number of stocks in the parent index The risk-factor adjusted **momentum factor** is defined as the residual error from the above equation: 𝑎𝑑𝑗𝑀𝑜𝑚 = 𝜀 𝑖 𝑖 The risk...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

> [!quote] Global Stocks Rise for Fifth Straight Month in June on Continued Economic Opt...
> kets 1500 Index, however, rose 0.3% in dollars and 3.4% in euros. Technology on top Eleven of 20 Supersectors in the STOXX Global 1800 declined in the month. The STOXX® Global 1800 Basic Resources Index (-6%)3 led losses. The STOXX® Global 1800 Technology Index jumped 7.2% to top all other sectors. **Momentum factor** back in favor Momentum regained its lead among factor strategies covering global ...
> — [Global Stocks Rise for Fifth Straight Month in June on Continued Economic Opt...](https://stoxx.com/global-stocks-rise-for-fifth-straight-month-in-june) — "WHITEPAPER"

> [!quote] Stoxx Index Guide (PDF)
> STOXX INDEX METHODOLOGY GUIDE 587/639 18. STOXX FACTOR INDICES The **Momentum Factor** is a composite of the following 3 Signals: Earnings Announcement Drift, Earnings Momentum, and Price Momentum.  Earnings Announcement Drift is given by the sum of idiosyncratic returns from the Axioma Risk Model on the most recent earnings announcement date and the next business day
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] Index Files Guide 20230619 (PDF)
> 2 ISIN Fund ISIN Text 12 3 NAME Name of the fund Text 255 4 CURRENCY ISO currency of the fund Text 3 5 COUNTRY ISO country code of the fund Text 2 6 SECTOR Citywire sector of the fund Text 255 7 ASSET_CLASS Asset class of the fund Text 19 8 RATING Citywire rating of the fund Text 3 MOMENTUM_FACT 9 **Momentum factor** of the fund Number 15 OR 10 WEIGHT Target weight of the fund Number 2 11 WEIGHT_FA...
> — [Index Files Guide 20230619 (PDF)](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)

**Sources:**
- [Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX amid evolving factor investing landscape | Blog posts | STOXX](https://stoxx.com/qa-with-blackrock-fourth-year-of-multifactor-collaboration-with-stoxx-amid-evolving-factor-investing-landscape) — "WHITEPAPER"
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
- [Global Stocks Rise for Fifth Straight Month in June on Continued Economic Optimism | Blog posts | STOXX](https://stoxx.com/global-stocks-rise-for-fifth-straight-month-in-june) — "WHITEPAPER"
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [Index Files Guide 20230619 (PDF)](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)

---

### Multi-Factor

<span style="background:red; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1,338 mentions across STOXX & ISS pages (high)">▰▰▰▰▰▰ 1,338</span>


> An index or strategy that systematically combines two or more factor signals
> into a single portfolio. STOXX multi-factor indices may use either a
> **composite scoring** approach (blending z-scores before optimization) or a
> **portfolio blending** approach (combining single-factor portfolios). The
> composite approach is more common in STOXX methodology.

In plain terms, instead of betting on one factor, you bet on several at once — for example, value + momentum + quality. This hedges your bets because different factors outperform in different market conditions.

> [!tip] Related terms
> [[#Factor Diversification]], [[#Multifactor Signal]], [[#Alpha Signal]]




> [!quote] The diversification benefits of a multi-factor approach: the STOXX Europe 600...
> ss returns over time, but they do not all work at the same time. In other words, the use of multiple factors provides a significant diversification benefit and should weather all different kinds of markets. The purpose of this article is to analyze the performance — and showcase the benefits — of a **multi-factor** strategy through time. Before we dive into the analysis, let’s briefly review the me...
> — [The diversification benefits of a multi-factor approach: the STOXX Europe 600...](https://stoxx.com/the-diversification-benefits-of-a-multi-factor-approach-the-stoxx-europe-600-industry-neutral-ax-multi-factor-index) — "WHITEPAPER"

> [!quote] BlackRock and STOXX collaboration: iShares multi-factor ETFs track STOXX indi...
> of the STOXX Equity Factor indices is to offer systematic and diversified access to a portfolio that tilts towards five historical drivers of returns: Quality, Value, Momentum, Low Size and Low Volatility. The indices select stocks through an optimization process that maximizes the allocation to a **multi-factor** alpha signal, while limiting undesirable exposures or deviations from the benchmark t...
> — [BlackRock and STOXX collaboration: iShares multi-factor ETFs track STOXX indi...](https://stoxx.com/blackrock-and-stoxx-collaboration-ishares-multi-factor-etfs-track-stoxx-indices-to-deliver-consistent-risk-managed-exposure-for-a-portfolios-core) — "WHITEPAPER"

> [!quote] UniCredit launches ESG-screened Eurozone multi-factor and low vol ETFs | ETF ...
> inciples, controversial weapons, thermal coal, nuclear power and tobacco producers. The index then seeks to diversify across the factors of profitability, earnings yield, leverage, value and low volatility (accomplished through a minimum variance objective), with constituent weights determined by a **multi-factor** optimization process. ECBV is linked to the EURO STOXX ESG-X & Ex Nuclear Power Mini...
> — [UniCredit launches ESG-screened Eurozone multi-factor and low vol ETFs | ETF ...](https://stoxx.com/unicredit-launches-esg-screened-eurozone-multi-factor-and-low-vol-etfs) — "UniCredit launches ESG-screened Eurozone multi-factor and low vol ETFs"

> [!quote] Eurex to List Futures on STOXX Industry Neutral Ax Factor Indices | Blog post...
> parent index’s exposure to each factor is computed and the single factor index is constrained to be within a quarter standard deviation of that. These constraints make sure the index is closely related in structure to the parent index for the style factors that are not being targeted. b) Outliers (**multi-factor** only): The **Multi-Factor** index will not hold any overweight in constituents in the wor...
> — [Eurex to List Futures on STOXX Industry Neutral Ax Factor Indices | Blog post...](https://stoxx.com/eurex-to-list-futures-on-stoxx-industry-neutral-ax-factor-indices) — "WHITEPAPER"

> [!quote] Istoxx Index Guide (PDF)
> iSTOXX® METHODOLOGY GUIDE CONTENTS 24/1024 126.2. iSTOXX LONGEVITY 10 INDEX 914 ONGOING MAINTENANCE 952 OVERVIEW 914 INDEX REVIEW 914 129.4. BSG INDEX ON iSTOXX DEVELOPED WORLD ONGOING MAINTENANCE 916 SMALL CAP INDEX 953 OVERVIEW 953 INDEX REVIEW 953 127. iSTOXX APG WORLD **MULTI-FACTOR** AND ONGOING MAINTENANCE 958 RESPONSIBLE INDICES 918 130. ISTOXX EUROPE 600 ESG-X FINTECH TILTED 127.1. iSTOXX A...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

**Sources:**
- [The diversification benefits of a multi-factor approach: the STOXX Europe 600 Industry Neutral Ax Multi-Factor Index | Blog posts | STOXX](https://stoxx.com/the-diversification-benefits-of-a-multi-factor-approach-the-stoxx-europe-600-industry-neutral-ax-multi-factor-index) — "WHITEPAPER"
- [BlackRock and STOXX collaboration: iShares multi-factor ETFs track STOXX indices to deliver consistent, risk-managed exposure for a portfolio’s core | Blog posts | STOXX](https://stoxx.com/blackrock-and-stoxx-collaboration-ishares-multi-factor-etfs-track-stoxx-indices-to-deliver-consistent-risk-managed-exposure-for-a-portfolios-core) — "WHITEPAPER"
- [UniCredit launches ESG-screened Eurozone multi-factor and low vol ETFs | ETF Strategy - ETF Strategy](https://stoxx.com/unicredit-launches-esg-screened-eurozone-multi-factor-and-low-vol-etfs) — "UniCredit launches ESG-screened Eurozone multi-factor and low vol ETFs"
- [Eurex to List Futures on STOXX Industry Neutral Ax Factor Indices | Blog posts | STOXX](https://stoxx.com/eurex-to-list-futures-on-stoxx-industry-neutral-ax-factor-indices) — "WHITEPAPER"
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

---

### Multifactor Signal

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="19 mentions across STOXX & ISS pages (low)">▰▰ 19</span>


> The composite score produced by combining individual factor z-scores into a
> single ranking metric. STOXX multi-factor indices compute this signal as a
> weighted average of standardized factor scores, typically with equal weight
> assigned to each factor unless the methodology specifies otherwise.

In plain terms, the multifactor signal is the "final grade" each stock gets after being scored on multiple dimensions. A stock that is cheap (value), trending up (momentum), and financially healthy (quality) gets a high composite score.

$$
S_i = \frac{1}{K} \sum_{k=1}^{K} z_{i,k}
$$

where $K$ is the number of factors and $z_{i,k}$ is the winsorized z-score for factor $k$.

> [!tip] Related terms
> [[#Alpha Signal]], [[#Multi-Factor]], [[#Factor Tilt]]




> [!quote] A behind-the-scenes look at the STOXX Equity Factor indices | Blog posts | STOXX
> Head of Factor and Quantitative Strategies, and Gimani Vidanagamage, Product Research and Development, Factor and Quantitative Strategies, unpicks the design of the indices by looking closely at the STOXX® U.S. Equity Factor index. Factor definitions The authors first explore the composition of the **Multifactor signal** (Figure 1), which, as reported in previous studies, is grounded in the latest ...
> — [A behind-the-scenes look at the STOXX Equity Factor indices | Blog posts | STOXX](https://stoxx.com/a-behind-the-scenes-look-at-the-stoxx-equity-factor-indices) — "WHITEPAPER"

> [!quote] Monthly Index News January 2026 (PDF)
> hey employ the institutionally tested analytics of Axioma Factor Risk Models. The STOXX Equity Factor indices are constructed by maximizing the index exposure to a multifactor alpha signal while adhering to a set of constraints intended to closely track their broad equity market parent indices. The **multifactor signal** is composed of the Momentum, Quality, Value, Low volatility and Low size facto...
> — [Monthly Index News January 2026 (PDF)](https://stoxx.com/monthly-index-news-january-2026)

> [!quote] Whitepapers | STOXX
> capture the different aspects and development stages of the targeted theme. This paper uses the AI theme to discuss thematic investing, and explore the identification of key subthemes and construction of thematic indices. This paper explores the design of the STOXX U.S. Equity Factor index and the **Multifactor signal** that lies at the core of the STOXX Equity Factor suite designed in collaboratio...
> — [Whitepapers | STOXX](https://stoxx.com/post-type/whitepapers) — "WHITEPAPER"

> [!quote] Multifactor strategies: Proving their worth in the factor investment landscap...
> nghal; and SimCorp’s Melissa Brown, analyze the performance of five single-factor portfolios and a multifactor one between March 2002 and June 2023. The authors consider two parent universes: the STOXX® USA 900 and STOXX® Global 1800 ex USA indices. They select an alpha signal (a single factor, the **multifactor signal**[1], or the individual components used to create the factors) and then construc...
> — [Multifactor strategies: Proving their worth in the factor investment landscap...](https://stoxx.com/multifactor-strategies-proving-their-worth-in-the-factor-investment-landscape) — "WHITEPAPER"

> [!quote] STOXX Equity Factor Indices | STOXX
> Emerging Markets Index | | STOXX International Small-Cap Equity Factor Index | STOXX International Developed Markets Small Cap Index | | STOXX Global Equity Factor Index | STOXX World AC Index | From the respective starting universes, constituents are selected and weighted to maximize exposure to a **multifactor signal** created from the following five factors: Momentum The momentum score is calcul...
> — [STOXX Equity Factor Indices | STOXX](https://stoxx.com/solutions/stoxx-equity-factor-indices) — "WHITEPAPER"

**Sources:**
- [A behind-the-scenes look at the STOXX Equity Factor indices | Blog posts | STOXX](https://stoxx.com/a-behind-the-scenes-look-at-the-stoxx-equity-factor-indices) — "WHITEPAPER"
- [Monthly Index News January 2026 (PDF)](https://stoxx.com/monthly-index-news-january-2026)
- [Whitepapers | STOXX](https://stoxx.com/post-type/whitepapers) — "WHITEPAPER"
- [Multifactor strategies: Proving their worth in the factor investment landscape | Blog posts | STOXX](https://stoxx.com/multifactor-strategies-proving-their-worth-in-the-factor-investment-landscape) — "WHITEPAPER"
- [STOXX Equity Factor Indices | STOXX](https://stoxx.com/solutions/stoxx-equity-factor-indices) — "WHITEPAPER"

---

## N

### Net Operating Assets (Changes in)

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="830 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 830</span>


> A quality signal measuring the year-over-year change in net operating assets
> (total assets minus cash minus total liabilities plus debt) scaled by lagged
> total assets. In STOXX quality scoring, a large increase in net operating
> assets is considered a negative signal — it suggests aggressive accounting or
> unsustainable asset growth.

In plain terms, if a company's balance sheet is rapidly expanding (excluding cash), it might be over-investing, over-acquiring, or using aggressive accounting. STOXX quality indices penalize this "asset bloat" because it often precedes poor returns.

$$
\Delta \text{NOA}_i = \frac{\text{NOA}_{t} - \text{NOA}_{t-1}}{\text{Total Assets}_{t-1}}
$$

> [!tip] Related terms
> [[#Accruals]], [[#Quality Factor]], [[#Dilution]]




> [!quote] Axioma Multi Asset Class Risk Monitor (PDF)
> Analysis Date | 2024-08-30 Axioma Multi-Asset Class Risk Monitor Figure 1. Factor Correlations (60 days) and Changes in Correlations (vs previous 60 days) 1. Correlations are unweighted and based on daily returns and changes in yield/spread over the past 60 business days. The lower left triangle of the matrix represents current correlations. The upper right triangle contains changes in correlat...
> — [Axioma Multi Asset Class Risk Monitor (PDF)](https://stoxx.com/axioma-multi-asset-class-risk-monitor)

> [!quote] Executive Summary Of Key 2016 Updates And Policy (PDF)
> pril 2, 2016. The Act also permits a board facing an unsolicited takeover to adopt anti-takeover provisions without shareholder approval – but also allows companies to opt-out of this feature as well, if they receive shareholder approval for such a bylaw amendment. ISS has formulated several policy changes in response. Double Voting: At French companies that did not have a bylaw allowing double...
> — [Executive Summary Of Key 2016 Updates And Policy (PDF)](https://www.issgovernance.com/file/policy/executive-summary-of-key-2016-updates-and-policy.pdf)

> [!quote] Detailed Overview Of Equity Index Calculation Changes (PDF)
> ributions 8.1. Corporate Actions 8.1.1 Cash Dividends and Other Distributions 8.1.1. Cash Dividends 8.1.2. Special Cash Dividend 8.1.2 Stock Dividends 8.1.5. Stock Dividend 8.1.5.1. Ordinary Stock Dividend 8.1.5.3. Stock Dividend from Redeemable Shares 8.1.5.4. Stock Dividend of Another Company 8.2 Changes in Share Capital 8.1.4. Rights Offering 8.2.1 Capital Increases 8.1.4.1. Standard Rights ...
> — [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)

> [!quote] Overview Of Methodology Changes Valid From 18 Of March 2024 (PDF)
> to the DAX Strategy Indices (Version 3.48 – August 2023) 2 Unless stated otherwise, please find applicable chapters in the new DAX Equity Index Calculation Guide 3 Corresponds to all indices referred to in the new DAX Equity Index Methodology Guide. 4 Please see Annex for a detailed overview of the changes in the DAX Equity Index calculation formula. STOXX Customer Support: Tel. + 41 43 430 72 ...
> — [Overview Of Methodology Changes Valid From 18 Of March 2024 (PDF)](https://www.stoxx.com/document/News/2023/October/Overview%20of%20methodology%20changes%20valid%20from%2018%20of%20March%202024.pdf)

> [!quote] Stoxx Digital Asset Guide (PDF)
> The current eligible universe of contributing exchanges is available on the STOXX website. More information regarding procedures to select, add, or remove exchanges can be found in the following sections. 3.4.2. BASE EXCHANGE SCORE The Bitcoin Suisse Base Exchange Score (BES) is used to rank the exchanges in the Bitcoin Suisse Exchange Universe. The Bitcoin Suisse BES Methodology is a risk asse...
> — [Stoxx Digital Asset Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_digital_asset_guide.pdf)

**Sources:**
- [Axioma Multi Asset Class Risk Monitor (PDF)](https://stoxx.com/axioma-multi-asset-class-risk-monitor)
- [Executive Summary Of Key 2016 Updates And Policy (PDF)](https://www.issgovernance.com/file/policy/executive-summary-of-key-2016-updates-and-policy.pdf)
- [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
- [Overview Of Methodology Changes Valid From 18 Of March 2024 (PDF)](https://www.stoxx.com/document/News/2023/October/Overview%20of%20methodology%20changes%20valid%20from%2018%20of%20March%202024.pdf)
- [Stoxx Digital Asset Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_digital_asset_guide.pdf)

---

## P

### Price Momentum

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="26 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 26</span>


> The trailing total return of a security over a defined look-back window,
> typically 12 months with a 1-month skip. STOXX uses price momentum as the
> primary signal for its momentum factor indices, computed from adjusted closing
> prices to account for dividends and corporate actions.

In plain terms, price momentum is straightforward: how much has the stock gone up (or down) over the past year? The most recent month is skipped because very short-term returns tend to reverse rather than continue.

$$
\text{Price Mom}_i = \frac{P_{i,t-21}}{P_{i,t-252}} - 1
$$

(using trading days: skip the most recent ~21 days, look back ~252 days total)

> [!tip] Related terms
> [[#Momentum Factor]], [[#Earnings Momentum]], [[#Factor Tilt]]




> [!quote] Dax Equity Index Methodology Guide 5526498614 (PDF)
> top 80% in the HDAX universe, measured in terms of **price momentum**, excluding companies with a past price history of less than 12 months. Companies with a past price history stretching back less than 12 months (e.g., IPOs and spin-offs) are not eligible for inclusion. The formula for calculating the **price momentum** of share i is set out below: 𝑡=𝑡𝑛 𝑃 𝑖𝑡 𝑃𝑟𝑖𝑐𝑒𝑀𝑜𝑚𝑒𝑛𝑡𝑢𝑚 = ∏( )−1 𝑖 𝑂 𝑖𝑡 𝑡=𝑡1 where: 𝑃...
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)

> [!quote] Istoxx Index Guide (PDF)
> iSTOXX® METHODOLOGY GUIDE 374/1024 24. iSTOXX DYNAMIC STYLE INDICES • Earnings Revision o 3-month lookback FY1 earnings revision factor o 3-month lookback FY2 earnings revision factor o 3-month **price momentum** Composition list: The selection of stocks and the calculation of the weights of the iSTOXX USA Income Index are determined from an optimisation approach based on the calculated Income Scor...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

> [!quote] Stoxx Index Guide (PDF)
> STOXX INDEX METHODOLOGY GUIDE 587/639 18. STOXX FACTOR INDICES The Momentum Factor is a composite of the following 3 Signals: Earnings Announcement Drift, Earnings Momentum, and **Price Momentum**.  Earnings Announcement Drift is given by the sum of idiosyncratic returns from the Axioma Risk Model on the most recent earnings announcement date and the next business day. Idiosyncratic returns are de...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] Factor Performance Can Be Timed and Exploited, Study Finds Factor Performance...
> ly large and statistically significant alpha after controlling for stock momentum,” they added. AQR is an investment management firm based in Greenwich, Connecticut, with almost $200 billion under management; it is known for its applied research in investment strategies. Large and significant alpha **Price momentum** is the well-researched observation that assets that have outperformed in the recen...
> — [Factor Performance Can Be Timed and Exploited, Study Finds Factor Performance...](https://stoxx.com/factor-performance-can-be-timed-and-exploited-study-finds-factor-performance-can-be-timed-and-exploited-study-finds) — "WHITEPAPER"

> [!quote] The Index World and Twenty Years of Europe’s ETFs | STOXX
> ing grown assets by an annual 20% in the previous five years.3 Indices have become more granular in their target and more innovative in their approach. Their constituency is no longer simply determined by each stock’s domicile — but instead by a wide menu of variables ranging from revenue source to **price momentum** to the number of female board members. Big data has empowered the possibilities of...
> — [The Index World and Twenty Years of Europe’s ETFs | STOXX](https://stoxx.com/the-index-world-and-twenty-years-of-europes-etfs) — "WHITEPAPER"

**Sources:**
- [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [Factor Performance Can Be Timed and Exploited, Study Finds Factor Performance Can Be Timed and Exploited, Study Finds | Blog posts | STOXX](https://stoxx.com/factor-performance-can-be-timed-and-exploited-study-finds-factor-performance-can-be-timed-and-exploited-study-finds) — "WHITEPAPER"
- [The Index World and Twenty Years of Europe’s ETFs | STOXX](https://stoxx.com/the-index-world-and-twenty-years-of-europes-etfs) — "WHITEPAPER"

---

## Q

### Quality Factor

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="159 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 159</span>


> A composite factor that identifies companies with strong profitability, low
> leverage, stable earnings, and conservative accounting. STOXX defines quality
> using multiple sub-signals including return on equity (ROE), accruals ratio,
> change in net operating assets, and dilution. Sub-signals are standardized and
> combined into a single quality z-score.

In plain terms, quality is about separating well-run companies from poorly-run ones using financial statement data. High-quality companies earn strong profits on their assets, do not inflate earnings through accounting tricks, and avoid excessive debt.

$$
\text{Quality}_i = \frac{1}{M}\sum_{m=1}^{M} z_{i,m}
$$

where sub-signals $m$ include ROE, accruals, $\Delta$NOA, and dilution.

> [!tip] Related terms
> [[#Accruals]], [[#Dilution]], [[#Net Operating Assets (Changes in)]], [[#Value Factor]]




> [!quote] The Quality Factor | Blog posts | STOXX
> n in definitions is substantially largerfor quality,’ according to a 2016 study.3The paper’s authors found that definitions range from low levels of accruals, gross profitability and low investments to bottom-line profitability measures such as return-on-equity and margins. Behind the iSTOXX Europe **Quality Factor** Index The iSTOXX Europe **Quality Factor** Index assesses a company’s financial health...
> — [The Quality Factor | Blog posts | STOXX](https://stoxx.com/the-quality-factor) — "WHITEPAPER"

> [!quote] Istoxx Index Guide (PDF)
> ons and white phosphorus weapons. The criteria for involvement are: » Internal production or sale of controversial weapons » The ultimate holding company owns >10% of voting rights of an involved company » >10% of voting rights of a company is owned by the involved company For the remaining stocks, **Quality Factor**s and ESG scores are calculated as follows: 1. **Quality Factor**s: On a semi-annual ba...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

> [!quote] Monthly Index News September 2020 (PDF)
> MONTHLY INDEX NEWS / September ESG-X Factor Indices (Regional: Europe) Key points In Europe, all ESG-X Factor Indices did better than the STOXX® Europe 600 ESG-X Index’s 1.3% retreat during September. As it happened with the standard factor indices, the **quality factor** had the strongest returns within the ESG-X universe. Risk and return characteristics Return (%) Annualized volatility (%) EUR US...
> — [Monthly Index News September 2020 (PDF)](https://stoxx.com/monthly-index-news-september-2020)

> [!quote] Stoxx Index Guide (PDF)
> thed using an EWMA with a half-life of 1 month. Each Signal is z-scored using the Parent Index weights and truncated at +/- 3 standard deviations. The Momentum Factor combines the Signals at 25%, 50% and 25% weights, respectively, and is again z-scored and truncated at +/-3 standard deviations. The **Quality Factor** is a composite of the following 6 Signals: Accruals, Dilution, Gross Profitability...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] BlackRock’s Ang on sustainability alpha signals: ESG and factors as ‘best fri...
> mance. “What is really going on is that this manifests as an attitude of these companies towards higher efficiency,” Dr. Ang said. “If we want to get the most value for our buck, all companies today would wish to produce more goods and services with lower energy input costs.” “This is a form of the **Quality factor**,” he added. “We integrate these sustainability signals into the definitions of our...
> — [BlackRock’s Ang on sustainability alpha signals: ESG and factors as ‘best fri...](https://stoxx.com/blackrocks-ang-on-sustainability-alpha-signals-esg-and-factors-as-best-friends) — "WHITEPAPER"

**Sources:**
- [The Quality Factor | Blog posts | STOXX](https://stoxx.com/the-quality-factor) — "WHITEPAPER"
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
- [Monthly Index News September 2020 (PDF)](https://stoxx.com/monthly-index-news-september-2020)
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [BlackRock’s Ang on sustainability alpha signals: ESG and factors as ‘best friends’  | Blog posts | STOXX](https://stoxx.com/blackrocks-ang-on-sustainability-alpha-signals-esg-and-factors-as-best-friends) — "WHITEPAPER"

---

## R

### Risk Budget

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="6 mentions across STOXX & ISS pages (low)">▰▰ 6</span>


> The maximum contribution to total portfolio risk allocated to a single
> security, sector, or factor. STOXX risk-based indices enforce risk budgets
> during optimization — for example, no single stock may contribute more than
> a fixed percentage of total portfolio variance.

In plain terms, a risk budget is like a spending cap but for risk. Instead of saying "no stock above 5% of portfolio dollars," you say "no stock above 5% of portfolio risk." This is a more sophisticated way to control concentration because a small-weight volatile stock can contribute more risk than a large-weight stable one.

> [!tip] Related terms
> [[#Equal Risk Contribution]], [[#Risk Parity]], [[#Capping Constraint]]




> [!quote] APG and Qontigo Launch STOXX Family of Groundbreaking Responsible Indices: Bl...
> k – Managing Director at APG Asset Management Using the iSTOXX World-A Index, a World Developed Markets Index, as the starting universe, the indices incrementally ‘layer in’ specific ESG filters (Exclusions, ESG Leaders, Carbon and SDI) allowing APG to measure and report on the impact on return and **risk budget** (measured by tracking error) for each of the individual criteria. The five customized...
> — [APG and Qontigo Launch STOXX Family of Groundbreaking Responsible Indices: Bl...](https://stoxx.com/apg-and-qontigo-launch-stoxx-family-of-groundbreaking-responsible-indices) — "WHITEPAPER"

> [!quote] Green efficient frontiers: Minimizing the risk impact of exclusions in sustai...
> he construction of sustainability portfolios, Qontigo analysts Melissa Brown and Rob Stubbs look into the risk implications of a basic negative screening strategy. Importantly, they show that the use of an optimizer and a risk model in the process can help reduce active risk, freeing up more of the **risk budget** to increase the allocation to sustainable holdings or to those expected to generate b...
> — [Green efficient frontiers: Minimizing the risk impact of exclusions in sustai...](https://stoxx.com/green-efficient-frontiers-minimizing-the-risk-impact-of-exclusions-in-sustainable-portfolios) — "WHITEPAPER"

> [!quote] &quot;Layered&quot; Approach to ESG Results in Innovative Responsible Indices...
> criteria and proprietary data; minimization of tracking error relative to the broad developed market by managing unintended bets including sector, country, and factor exposures that might emerge as an outcome of the sustainability targets; and the ability to measure and report on the impact of the **risk budget** on each of the ESG criteria or constraints. To meet all of these objectives, APG requi...
> — [&quot;Layered&quot; Approach to ESG Results in Innovative Responsible Indices...](https://stoxx.com/layered-approach-to-esg-results-in-innovative-responsible-indices-for-apg) — "WHITEPAPER"

> [!quote] Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX a...
> sure for its own sake. Our typical tracking error target of 1–2% helps ensure that the portfolio stays suitable for core allocations, while still aiming to deliver a persistent factor premium. In other words, it’s not about giving each factor the same weight — but rather giving them the appropriate **risk budget** within a diversified, long-term investment solution.” Can you briefly describe, in th...
> — [Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX a...](https://stoxx.com/qa-with-blackrock-fourth-year-of-multifactor-collaboration-with-stoxx-amid-evolving-factor-investing-landscape) — "WHITEPAPER"

> [!quote] Qontigo’s Seegopaul and Gu: ‘iSTOXX APG Responsible Investment Indices Design...
> t of various layers of ESG investing on a global equities portfolio. The new suite consists of five indices (Figure 1), each one incrementally implementing a different ESG, carbon and Sustainable Development Investments (SDI) strategy and quantifying the resulting effect on a portfolio’s return and **risk budget**. The indices use Qontigo’s line of Axioma portfolio construction tools, STOXX index d...
> — [Qontigo’s Seegopaul and Gu: ‘iSTOXX APG Responsible Investment Indices Design...](https://stoxx.com/qontigos-seegopaul-and-gu-istoxx-apg-responsible-investment-indices) — "WHITEPAPER"

**Sources:**
- [APG and Qontigo Launch STOXX Family of Groundbreaking Responsible Indices: BlackRock Selected to Implement the Developed Equities Mandate | Press releases | STOXX](https://stoxx.com/apg-and-qontigo-launch-stoxx-family-of-groundbreaking-responsible-indices) — "WHITEPAPER"
- [Green efficient frontiers: Minimizing the risk impact of exclusions in sustainable portfolios | Blog posts | STOXX](https://stoxx.com/green-efficient-frontiers-minimizing-the-risk-impact-of-exclusions-in-sustainable-portfolios) — "WHITEPAPER"
- [&quot;Layered&quot; Approach to ESG Results in Innovative Responsible Indices for APG | Case studies | STOXX](https://stoxx.com/layered-approach-to-esg-results-in-innovative-responsible-indices-for-apg) — "WHITEPAPER"
- [Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX amid evolving factor investing landscape | Blog posts | STOXX](https://stoxx.com/qa-with-blackrock-fourth-year-of-multifactor-collaboration-with-stoxx-amid-evolving-factor-investing-landscape) — "WHITEPAPER"
- [Qontigo’s Seegopaul and Gu: ‘iSTOXX APG Responsible Investment Indices Designed for New Era of Sustainability’ | Blog posts | STOXX](https://stoxx.com/qontigos-seegopaul-and-gu-istoxx-apg-responsible-investment-indices) — "WHITEPAPER"

---

### Risk Parity

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="3 mentions across STOXX & ISS pages (ultra-low)">▰ 3</span>


> A portfolio construction strategy that allocates risk equally across asset
> classes, factors, or individual securities. STOXX Risk Parity indices extend
> the Equal Risk Contribution concept across multiple asset classes (equities,
> bonds, commodities) by leveraging lower-risk assets and deleveraging
> higher-risk assets until each contributes equally to total volatility.

In plain terms, risk parity says: "Bonds are much less risky than stocks, so if you want equal risk contribution, you need to hold a lot more bonds (potentially using leverage) and fewer stocks." It is the multi-asset version of equal risk contribution.

> [!tip] Related terms
> [[#Equal Risk Contribution]], [[#Risk Budget]], [[#Maximum Diversification]]




> [!quote] Equity Risk Premia with Academic Foundation | Blog posts | STOXX
> emia, stocks are selected using academically founded and widely recognized criteria. An aggregated score is calculated for each factor, and is used as the basis to select the top third of stocks to be included in each individual risk-premium portfolio. The weighting of the stocks is determined by a risk-parity approach, whereby each constituent contributes equally to the overall risk of the por...
> — [Equity Risk Premia with Academic Foundation | Blog posts | STOXX](https://stoxx.com/equity-risk-premia-with-academic-foundation) — "WHITEPAPER"

> [!quote] Q&amp;A: Credit Suisse’s Froehlich on Multi-Premia Investing | Blog posts | S...
> d by Finreon. Based on relevant and scientifically proven ratios, the best stocks from the investment universe are selected for each factor premium — value, size, momentum, residual momentum, reversal, low risk and quality. Within these individual factor portfolios of the EURO STOXX Multi Premia, a risk-parity approach is used to weight the individual securities. This promotes a high level of d...
> — [Q&amp;A: Credit Suisse’s Froehlich on Multi-Premia Investing | Blog posts | S...](https://stoxx.com/qa-credit-suisses-froehlich-on-multi-premia-investing) — "WHITEPAPER"

> [!quote] What’s Behind the Edge in Equal-Weight Strategies? | Blog posts | STOXX
> vide a tool for investors seeking to capture a premium to the market’s move. Gianluca Oderda at Ersel Asset Management has argued that an optimal portfolio can be constructed by long positions in four non-market-cap-weighted schemes: a global minimum-variance portfolio, an equal-weight portfolio, a **risk parity** portfolio and a dividend-weighted portfolio; hedged via short positions in four respe...
> — [What’s Behind the Edge in Equal-Weight Strategies? | Blog posts | STOXX](https://stoxx.com/whats-behind-the-edge-in-equal-weight-strategies) — "WHITEPAPER"

**Sources:**
- [Equity Risk Premia with Academic Foundation | Blog posts | STOXX](https://stoxx.com/equity-risk-premia-with-academic-foundation) — "WHITEPAPER"
- [Q&amp;A: Credit Suisse’s Froehlich on Multi-Premia Investing | Blog posts | STOXX](https://stoxx.com/qa-credit-suisses-froehlich-on-multi-premia-investing) — "WHITEPAPER"
- [What’s Behind the Edge in Equal-Weight Strategies? | Blog posts | STOXX](https://stoxx.com/whats-behind-the-edge-in-equal-weight-strategies) — "WHITEPAPER"

---

### Risk Premia

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="124 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 124</span>


> The excess return earned by bearing systematic, non-diversifiable risk
> associated with a specific factor. STOXX factor indices are designed to harvest
> risk premia — the value premium, momentum premium, quality premium, etc. —
> in a transparent, rules-based, and cost-efficient manner.

In plain terms, a risk premium is the reward investors receive for taking on a particular type of risk. The value premium, for example, compensates investors for holding cheap (often distressed) companies. Factor indices are tools for capturing these premiums systematically.

> [!tip] Related terms
> [[#Factor Investing]], [[#Factor (Definition)]], [[#Smart Beta]]




> [!quote] Equity Risk Premia with Academic Foundation | Blog posts | STOXX
> Factor investing has gained enormous traction in recent years as a transparent and low-cost way to exploit widely-acknowledged sources of market-excess returns, so-called **risk premia**. To complement our continuous effort in that space we have launched the EURO STOXX® Multi Premia® and Single Premium Indices, which integrate the academic research-based Multi Premia® methodology developed by Finre...
> — [Equity Risk Premia with Academic Foundation | Blog posts | STOXX](https://stoxx.com/equity-risk-premia-with-academic-foundation) — "WHITEPAPER"

> [!quote] Eurex to List Futures on STOXX Industry Neutral Ax Factor Indices | Blog post...
> eptember and December, coinciding with the expiration of futures. Facilitating the access to **risk premia** Factor-based investing has become one of the most popular indexing segments in recent years. The new futures bring an innovative alternative to access the strategies, combining proven sources of **risk premia**, a transparent and state-of-the-art index methodology, and the cost-efficiency, safet...
> — [Eurex to List Futures on STOXX Industry Neutral Ax Factor Indices | Blog post...](https://stoxx.com/eurex-to-list-futures-on-stoxx-industry-neutral-ax-factor-indices) — "WHITEPAPER"

> [!quote] Istoxx Index Guide (PDF)
> iSTOXX® METHODOLOGY GUIDE 710/1024 95. iSTOXX UNIVEST INDICES 95.4. iSTOXX UNIVEST WORLD FACTOR INDEX OVERVIEW The iSTOXX Univest World Factor Index provides exposure to the Univest Value, Momentum, Quality and Low Risk risk-premia factors, closely tracks the STOXX Developed World parent index with an ex-ante tracking error of 1% while ensuring tradability and diversification. Parent Index: STO...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

> [!quote] Bank credit spread contagion – how bad could it get? | Blog posts | STOXX
> elevated levels. But traditional defensive sectors, such as utilities, consumer staples or healthcare, could provide some protection, with losses projected to remain in the low single digits. For most of the past two decades, spreads on bank debt have vacillated largely in line with overall credit **risk premia**. The dark blue line in Figure 1 shows the 5-year yield pickup of USD-denominated, sing...
> — [Bank credit spread contagion – how bad could it get? | Blog posts | STOXX](https://stoxx.com/bank-credit-spread-contagion-how-bad-could-it-get) — "WHITEPAPER"

> [!quote] Navigating market turbulence: The power of minimum-volatility strategies | Bl...
> tfolio delivers the return of the parent benchmark with two-thirds its volatility and 1.5 times its Sharpe ratio. Besides higher Sharpe ratios and lower portfolio risk, minimum-variance indices also stand out for their emphasis on low-beta stocks, consideration of intra-asset correlations, improved **risk premia** and enhanced diversification, Ioannis and Kartik write. Further analysis The authors ...
> — [Navigating market turbulence: The power of minimum-volatility strategies | Bl...](https://stoxx.com/navigating-market-turbulence-the-power-of-minimum-volatility-strategies-2) — "WHITEPAPER"

**Sources:**
- [Equity Risk Premia with Academic Foundation | Blog posts | STOXX](https://stoxx.com/equity-risk-premia-with-academic-foundation) — "WHITEPAPER"
- [Eurex to List Futures on STOXX Industry Neutral Ax Factor Indices | Blog posts | STOXX](https://stoxx.com/eurex-to-list-futures-on-stoxx-industry-neutral-ax-factor-indices) — "WHITEPAPER"
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
- [Bank credit spread contagion – how bad could it get? | Blog posts | STOXX](https://stoxx.com/bank-credit-spread-contagion-how-bad-could-it-get) — "WHITEPAPER"
- [Navigating market turbulence: The power of minimum-volatility strategies | Blog posts | STOXX](https://stoxx.com/navigating-market-turbulence-the-power-of-minimum-volatility-strategies-2) — "WHITEPAPER"

---

## S

### Security Weight Cap

> The maximum permissible weight for a single security in the index at each
> rebalancing date. STOXX employs various cap levels: 5% for indices designed
> under UCITS 5/10/40 rules, 10% for broader factor indices, and occasionally
> lower caps for concentrated strategies. Excess weight above the cap is
> redistributed pro-rata among uncapped constituents.

In plain terms, this is the hard ceiling on how big any single stock can get in the index. If optimization wants to put 15% in one stock but the cap is 10%, the extra 5% gets spread across other holdings.

> [!tip] Related terms
> [[#Capping Constraint]], [[#Turnover Constraint]], [[#Active Industry Constraint]]

**Sources:**

---

### Size Factor

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="161 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 161</span>


> A factor that captures the historical tendency of smaller-capitalization stocks
> to outperform larger-capitalization stocks over long horizons. STOXX
> implements the size factor by selecting or overweighting constituents with
> lower free-float market capitalization within the parent universe.

In plain terms, small companies tend to grow faster than large ones, and their stocks have historically earned higher returns — though with more volatility. The size factor tilts toward these smaller names.

$$
\text{Size Score}_i = -\ln(\text{Market Cap}_i)
$$

Negative log ensures that smaller companies receive higher scores.

> [!tip] Related terms
> [[#Factor (Definition)]], [[#Smart Beta]], [[#Factor-Based Index]]




> [!quote] A Closer Look at the Size Factor | Blog posts | STOXX
> on in futures on the STOXX Europe 600, returned 1.4%. As markets recovered in April and May, the **size factor**’s outperformance has grown. The iSTOXX Europe **Size Factor** Index rose 8% between Apr. 1 and May 15, while the STOXX Europe 600 Index added 7.3%. The theory behind the size premium What is the size factor, anyway? The relationship between a stock’s total market value and its return was fir...
> — [A Closer Look at the Size Factor | Blog posts | STOXX](https://stoxx.com/a-closer-look-at-the-size-factor) — "WHITEPAPER"

> [!quote] Dax Equity Index Family Benchmark Statement (PDF)
> methodology used for dividends reinvested net of withholding taxes; determining the benchmark can no - they are calculated on individual countries and longer be ensured, such as when the regional combinations of countries; administrator deems the liquidity in the - they are calculated according to **size factor**s, underlying market as insufficient; - they are calculated according to industrial Any...
> — [Dax Equity Index Family Benchmark Statement (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Resources/Regulation/DAX_Equity_Index_Family_Benchmark_Statement.pdf)

> [!quote] Stoxx Index Guide (PDF)
> es are then multiplied by -1 and are converted to percentage ranks within the eligible universe and truncated at the 1st and 99th percentiles. The percentage ranks are then transformed into scores using the inverse of cumulative normal distribution and are truncated at +/- 3 standard deviations The **Size Factor** is given by the negative of the natural logarithm of the total market capitalization ...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] Exploring SDAX, the benchmark for German small companies | Blog posts | STOXX
> SDAX dividends are reinvested in the whole index portfolio rather than in the distributing stock as it happened earlier. The index is reviewed twice a year but goes through a quarterly so-called Fast Exit/Fast Entry review to account for significant changes in companies’ market capitalization. The **size factor** To many investors, small-caps are the holy grail of stock-picking. Often young compani...
> — [Exploring SDAX, the benchmark for German small companies | Blog posts | STOXX](https://stoxx.com/exploring-sdax-the-benchmark-for-german-small-companies) — "WHITEPAPER"

> [!quote] Istoxx Index Guide (PDF)
> r -4 respectively. If the factor for size and BPR is NA, the standardized factor is set to zero. For the 12-month momentum adjusted with market beta, the standardized factor remains as NA. The standardized 12-month momentum adjusted with market beta factor is then regressed against the standardized **size factor** and standardized BPR factor, and the residual error of this regression is calculated.
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

**Sources:**
- [A Closer Look at the Size Factor | Blog posts | STOXX](https://stoxx.com/a-closer-look-at-the-size-factor) — "WHITEPAPER"
- [Dax Equity Index Family Benchmark Statement (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Resources/Regulation/DAX_Equity_Index_Family_Benchmark_Statement.pdf)
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [Exploring SDAX, the benchmark for German small companies | Blog posts | STOXX](https://stoxx.com/exploring-sdax-the-benchmark-for-german-small-companies) — "WHITEPAPER"
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

---

### Smart Beta

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="87 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 87</span>


> An umbrella term for rules-based index strategies that deviate from
> traditional market-capitalization weighting in pursuit of improved risk-adjusted
> returns, lower risk, or enhanced diversification. STOXX's smart beta suite
> includes factor indices, risk-based indices (minimum variance, maximum
> diversification, equal risk contribution), and alternatively weighted indices
> (equal weight, fundamental weight).

In plain terms, smart beta sits between passive index investing and active management. You still follow transparent rules (like an index), but those rules are designed to be "smarter" than simply weighting by company size — for example, weighting by cheapness or equal risk.

> [!tip] Related terms
> [[#Factor Investing]], [[#Factor-Based Index]], [[#Risk Premia]]




> [!quote] STOXX Awarded “Best Smart Beta Index Provider, Asia-Pacific” By SRP | Press r...
> Zurich/Singapore (April 30, 2018) – STOXX Ltd., the operator of Deutsche Boerse Group’s index business and a global provider of innovative and tradable index concepts, has been recognized as 2018’s “Best **Smart Beta** Index Provider, Asia-Pacific” by Structured Retail Products (SRP). This is the first time STOXX Ltd. has received this award. The awards ceremony was held in Singapore. “This award i...
> — [STOXX Awarded “Best Smart Beta Index Provider, Asia-Pacific” By SRP | Press r...](https://stoxx.com/stoxx-awarded-best-smart-beta-index-provider-asia-pacific-by-srp) — "WHITEPAPER"

> [!quote] Study Shines Light on Smart Beta’s Effectiveness and Capacity | Blog posts | ...
> A new Qontigo report1 takes a comprehensive look at the market for ‘**smart beta**’ funds tracking factor strategies, to assess their prowess in boosting returns and their capacity as money inflows grow. The study by Frank Siu, Executive Director of Quantitative and Multi-Asset Solutions at Qontigo, looked at exchange-traded funds (ETFs) tracking equity **smart beta** and f
> — [Study Shines Light on Smart Beta’s Effectiveness and Capacity | Blog posts | ...](https://stoxx.com/study-shines-light-on-smart-betas-effectiveness-and-capacity) — "WHITEPAPER"

> [!quote] Smart Beta versus Dumb Alpha | Blog posts | STOXX
> More emphasis (certainly more marketing dollars) is usually given to the objective function behind **smart beta** portfolios, but constraints play a leading role (ultimately exaggerated into a central one), in their performance and predictability. In this paper we construct four variants of each of our **smart beta** portfolios, as well as two variants of a Low Volatility portfolio. We use the Growth, ...
> — [Smart Beta versus Dumb Alpha | Blog posts | STOXX](https://stoxx.com/smart-beta-versus-dumb-alpha) — "WHITEPAPER"

> [!quote] Q&amp;A: UniCredit’s Kilian on ESG+Factor Strategies | Blog posts | STOXX
> -screened base universe and a factor-based stock selection? The results we achieved with these new indices were quite astonishing. We are not only outperforming regular benchmark indices but offering the same or even better performance compared to standard factor indices. The combination of ESG and **smart beta** is emerging as an innovative option. Will such solutions become a niche sector, or can...
> — [Q&amp;A: UniCredit’s Kilian on ESG+Factor Strategies | Blog posts | STOXX](https://stoxx.com/qa-unicredits-kilian-on-esgfactor-strategies) — "WHITEPAPER"

> [!quote] The Index World and Twenty Years of Europe’s ETFs | STOXX
> ection of assets, index choice and static factor exposure.2 That means that when an investor picks an ETF, not only are they buying an entire market — they are also actively choosing an asset class, geography, an index methodology, a style and a factor exposure and the timing of the purchase. Enter **smart beta** The menu of index choices has also ballooned with the inception of strategies that see...
> — [The Index World and Twenty Years of Europe’s ETFs | STOXX](https://stoxx.com/the-index-world-and-twenty-years-of-europes-etfs) — "WHITEPAPER"

**Sources:**
- [STOXX Awarded “Best Smart Beta Index Provider, Asia-Pacific” By SRP | Press releases | STOXX](https://stoxx.com/stoxx-awarded-best-smart-beta-index-provider-asia-pacific-by-srp) — "WHITEPAPER"
- [Study Shines Light on Smart Beta’s Effectiveness and Capacity | Blog posts | STOXX](https://stoxx.com/study-shines-light-on-smart-betas-effectiveness-and-capacity) — "WHITEPAPER"
- [Smart Beta versus Dumb Alpha | Blog posts | STOXX](https://stoxx.com/smart-beta-versus-dumb-alpha) — "WHITEPAPER"
- [Q&amp;A: UniCredit’s Kilian on ESG+Factor Strategies | Blog posts | STOXX](https://stoxx.com/qa-unicredits-kilian-on-esgfactor-strategies) — "WHITEPAPER"
- [The Index World and Twenty Years of Europe’s ETFs | STOXX](https://stoxx.com/the-index-world-and-twenty-years-of-europes-etfs) — "WHITEPAPER"

---

### Style Drift

> The unintended migration of a portfolio's factor exposures away from its stated
> investment objective over time. In STOXX index design, style drift is controlled
> through periodic rebalancing (typically quarterly), capping constraints, and
> tracking error budgets that pull the portfolio back toward its target factor
> profile.

In plain terms, style drift is when a fund or index labeled "value" gradually starts looking more like a "growth" portfolio — because stock prices moved and nobody rebalanced. STOXX combats this with regular, rules-based rebalancing that forces the index to re-select and re-weight based on current factor scores.

> [!tip] Related terms
> [[#Factor Rotation]], [[#Tracking Error Budget]], [[#Turnover Constraint]]

**Sources:**

---

## T

### Tracking Error Budget

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1 mentions across STOXX & ISS pages (ultra-low)">▰ 1</span>


> The maximum permissible ex-ante tracking error (annualized standard deviation
> of active returns) between the factor index and its parent benchmark. STOXX
> factor indices may impose a tracking error constraint during optimization —
> for example, limiting tracking error to 3% or 5% — to ensure the factor
> portfolio does not deviate too aggressively from the benchmark.

In plain terms, tracking error measures how differently the factor index behaves compared to the plain market index. A tracking error budget is the maximum amount of deviation allowed. A tight budget (e.g., 2%) produces a portfolio close to the benchmark; a loose budget (e.g., 6%) allows aggressive factor bets.

$$
\text{TE} = \sqrt{(w - w_{\text{bench}})^\top \Sigma (w - w_{\text{bench}})} \leq \text{TE}_{\max}
$$

> [!tip] Related terms
> [[#Active Industry Constraint]], [[#Turnover Constraint]], [[#Factor Tilt]]




> [!quote] Navigating Europe’s equities and sustainable investing landscape  | Blog post...
> till get others that come along for the ride. That’s good news as well.” A limited tracking error is almost a universal demand of investors, but this may change over time, DWS’ Schiele said. “As investors become more comfortable with a particular topic, they will also, over time, allow for a higher **tracking error budget**” in their bespoke solutions, he said. More targeted themes Rounding off, th...
> — [Navigating Europe’s equities and sustainable investing landscape  | Blog post...](https://stoxx.com/navigating-europes-equities-and-sustainable-investing-landscape) — "WHITEPAPER"

**Sources:**
- [Navigating Europe’s equities and sustainable investing landscape  | Blog posts | STOXX](https://stoxx.com/navigating-europes-equities-and-sustainable-investing-landscape) — "WHITEPAPER"

---

### Turnover Constraint

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="18 mentions across STOXX & ISS pages (low)">▰▰ 18</span>


> A limit on the total amount of trading (buying plus selling) permitted at each
> index rebalancing. STOXX methodology may impose one-way turnover caps
> (e.g., maximum 10% per quarter) to control transaction costs and ensure the
> index remains practically investable for tracking funds and ETFs.

In plain terms, every time the index rebalances, stocks are bought and sold. Excessive trading raises costs (commissions, market impact) that eat into returns. A turnover constraint forces the optimizer to make only modest changes at each rebalance.

$$
\text{Turnover} = \frac{1}{2}\sum_i |w_{i,t}^{+} - w_{i,t}^{-}| \leq \tau_{\max}
$$

where $w^{+}$ and $w^{-}$ are post- and pre-rebalancing weights.

> [!tip] Related terms
> [[#Capping Constraint]], [[#Security Weight Cap]], [[#Tracking Error Budget]]




> [!quote] Stoxx Index Guide (PDF)
> STOXX INDEX METHODOLOGY GUIDE 298/639 16. STOXX RISK BASED INDICES For the tracking error constrained version it is defined as: H ≥H ∙60% (cid:2897)(cid:2919)(cid:2924)(cid:2906)(cid:2911)(cid:2928) (cid:2886)(cid:2911)(cid:2929)(cid:2915) Maximum turnover The Unconstrained version has a 5% one-way **turnover constraint**, or 10% two-way. This means up to 5% of the portfolio is sold in order to pur...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] Stoxx Index Guide (PDF)
> STOXX INDEX METHODOLOGY GUIDE 298/639 16. STOXX RISK BASED INDICES For the tracking error constrained version it is defined as: H ≥H ∙60% (cid:2897)(cid:2919)(cid:2924)(cid:2906)(cid:2911)(cid:2928) (cid:2886)(cid:2911)(cid:2929)(cid:2915) Maximum turnover The Unconstrained version has a 5% one-way **turnover constraint**, or 10% two-way. This means up to 5% of the portfolio is sold in order to pur...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] A behind-the-scenes look at the STOXX Equity Factor indices | Blog posts | STOXX
> Combining factors with low correlations to each other can offer diversification benefits and a potentially smoother investment profile over time. Figure 1: Components of the Multifactor signal in the STOXX Equity Factor indices Risk premium The paper reviews the risk management, diversification and **turnover constraint**s built into the index methodology, a process that upholds the harvesting of t...
> — [A behind-the-scenes look at the STOXX Equity Factor indices | Blog posts | STOXX](https://stoxx.com/a-behind-the-scenes-look-at-the-stoxx-equity-factor-indices) — "WHITEPAPER"

> [!quote] Eurex to List Futures on STOXX Industry Neutral Ax Factor Indices | Blog post...
> chmark at 5% and limit the tracking error to a maximum of 5%. Other constraints are employed to ensure liquidity and tradability. There is a minimum weighted average days-to-trade ratio threshold for securities to avoid material build-ups in illiquid positions. The indices also have a 12.5% one-way **turnover constraint** per quarter, meaning that a maximum of 12.5% of the current index weight can ...
> — [Eurex to List Futures on STOXX Industry Neutral Ax Factor Indices | Blog post...](https://stoxx.com/eurex-to-list-futures-on-stoxx-industry-neutral-ax-factor-indices) — "WHITEPAPER"

> [!quote] Istoxx Index Guide (PDF)
> ruary 2019: Addition of EURO iSTOXX ESG Leaders 50 GR Decrement 5% Index, EURO iSTOXX ESG Leaders 50 NR Decrement 5% Index and EURO iSTOXX 50 GR Decrement 3.75% Index » February 2019 (2): Addition of iSTOXX Developed and Emerging Markets ex USA PK VN Real Estate Index » February 2019 (3): Change of **turnover constraint** and quality filter for both iSTOXX A.C.I. USA Pure Growth Index and iSTOXX A....
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

**Sources:**
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [A behind-the-scenes look at the STOXX Equity Factor indices | Blog posts | STOXX](https://stoxx.com/a-behind-the-scenes-look-at-the-stoxx-equity-factor-indices) — "WHITEPAPER"
- [Eurex to List Futures on STOXX Industry Neutral Ax Factor Indices | Blog posts | STOXX](https://stoxx.com/eurex-to-list-futures-on-stoxx-industry-neutral-ax-factor-indices) — "WHITEPAPER"
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

---

## V

### Value Factor

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="178 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 178</span>


> A factor that identifies undervalued securities by ranking them on fundamental
> valuation ratios. STOXX value indices typically use a composite of book-to-
> price, earnings-to-price, and dividend yield. Securities with high composite
> value scores are overweighted on the premise that the market systematically
> underprices cheap, out-of-favor stocks.

In plain terms, the value factor is the quantitative version of "buy low." It looks for stocks that are cheap relative to their fundamentals — low price compared to earnings, book value, or dividends — and bets that these bargains will eventually be recognized by the market.

$$
\text{Value Score}_i = \frac{1}{3}\left(z_{\text{B/P},i} + z_{\text{E/P},i} + z_{\text{D/P},i}\right)
$$

where B/P = book-to-price, E/P = earnings-to-price, D/P = dividend yield.

> [!tip] Related terms
> [[#Quality Factor]], [[#Factor (Definition)]], [[#Smart Beta]]




> [!quote] Istoxx Index Guide (PDF)
> iSTOXX® METHODOLOGY GUIDE 257/1024 10. iSTOXX MUTB INDICES 10.7. iSTOXX MUTB VALUE INDICES OVERVIEW The iSTOXX MUTB Value indices select companies based on a normalized **value factor** which is adjusted to account for regional and industry specific biases. The **value factor** is captured by the ratios: book to price, earnings to price and cash-flow from operations to price. High volatility and low vo...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

> [!quote] Europe, Value Lead Global Stocks to Fourth Straight Monthly Gain in May | Blo...
> Index rose 3.8% in dollars and 2.2% in euros. Banks on top All but five of 20 Supersectors in the STOXX Global 1800 climbed in the month. The STOXX® Global 1800 Banks Index (+6.2%)3 led gains. The STOXX® Global 1800 Retail Index came last with a 3% decline, after topping all other sectors in April. **Value factor** back in favor After pausing in April, investors resumed their move towards Value sto...
> — [Europe, Value Lead Global Stocks to Fourth Straight Monthly Gain in May | Blo...](https://stoxx.com/europe-value-lead-global-stocks-to-fourth-straight-monthly-gain-in-may) — "WHITEPAPER"

> [!quote] Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX a...
> ltifactor ETF range, we use a composite Value signal that includes price-to-earnings, price-to-sales and enterprise-value-to-cash-flow, among others. This multi-signal approach avoids the overreliance on any single distorted metric that can negatively impact returns.” Figure 1: Active returns – USA **Value factor** “Momentum is another compelling example. Traditionally, it’s been defined using a st...
> — [Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX a...](https://stoxx.com/qa-with-blackrock-fourth-year-of-multifactor-collaboration-with-stoxx-amid-evolving-factor-investing-landscape) — "WHITEPAPER"

> [!quote] Can ESG and Factor Tilts Be Combined? — Yes | Blog posts | STOXX
> ces Next, we turn our attention to comparing the target factor exposures between the STOXX ESG-X Factor Indices and the standard STOXX Factor Indices. When looking at the target factor exposures for both Multi-Factor and Single-Factor indices (Exhibit 3), the differences are minimal, except for the **Value factor** index in the Asia/Pacific 600 and Japan universes. For example, the STOXX® Japan 600...
> — [Can ESG and Factor Tilts Be Combined? — Yes | Blog posts | STOXX](https://stoxx.com/can-esg-and-factor-tilts-be-combined-yes) — "WHITEPAPER"

> [!quote] Monthly Index News January 2019 (PDF)
> OXX® Europe **Value Factor** Market Neutral Index has had poorer results in the past 12 months. The iSTOXX® Europe Size Factor Market Neutral Index had the best performance during January, rising nearly 1%, its best monthly showing since December 2017. The market-neutral gauges tracking the quality and **value factor**s also rose during the month. Overall, investing in factors in isolation of the marke...
> — [Monthly Index News January 2019 (PDF)](https://stoxx.com/monthly-index-news-january-2019)

**Sources:**
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
- [Europe, Value Lead Global Stocks to Fourth Straight Monthly Gain in May | Blog posts | STOXX](https://stoxx.com/europe-value-lead-global-stocks-to-fourth-straight-monthly-gain-in-may) — "WHITEPAPER"
- [Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX amid evolving factor investing landscape | Blog posts | STOXX](https://stoxx.com/qa-with-blackrock-fourth-year-of-multifactor-collaboration-with-stoxx-amid-evolving-factor-investing-landscape) — "WHITEPAPER"
- [Can ESG and Factor Tilts Be Combined? — Yes | Blog posts | STOXX](https://stoxx.com/can-esg-and-factor-tilts-be-combined-yes) — "WHITEPAPER"
- [Monthly Index News January 2019 (PDF)](https://stoxx.com/monthly-index-news-january-2019)

---

## Y

### Yield Factor

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1 mentions across STOXX & ISS pages (ultra-low)">▰ 1</span>


> A factor that ranks securities by their total cash return to shareholders,
> encompassing dividend yield, buyback yield, and — in some specifications —
> debt reduction yield. STOXX yield-oriented indices select or overweight
> constituents offering the highest sustainable shareholder yield, often
> combining the raw yield signal with quality screens to avoid "yield traps"
> (high-yielding stocks on the verge of cutting dividends).

In plain terms, the yield factor targets stocks that return the most cash to investors through dividends and share repurchases. It is related to the carry factor but broader — carry focuses on dividend income, while yield also credits companies that buy back their own shares.

$$
\text{Shareholder Yield}_i = \frac{D_i + \text{Net Buybacks}_i}{P_i}
$$

where $D_i$ is dividends per share, Net Buybacks is repurchases minus issuance, and $P_i$ is the share price.

> [!tip] Related terms
> [[#Carry Factor]], [[#Value Factor]], [[#Quality Factor]]




> [!quote] The AI revolution is taking place now – a look inside the STOXX Global Artifi...
> AC. The AI index has its largest positive active exposures in the Market Sensitivity, Volatility and Liquidity factors, while also being more exposed to the Medium-Term Momentum and Growth factors. Negative active exposures include those to the Dividend Yield, Exchange Rate Sensitivity and Earnings **Yield factor**s. Figure 8: Active style-factor exposures Conclusion The STOXX Global Artificial Int...
> — [The AI revolution is taking place now – a look inside the STOXX Global Artifi...](https://stoxx.com/the-ai-revolution-is-taking-place-now-a-look-inside-the-stoxx-global-artificial-intelligence-index) — "WHITEPAPER"

**Sources:**
- [The AI revolution is taking place now – a look inside the STOXX Global Artificial Intelligence index | Blog posts | STOXX](https://stoxx.com/the-ai-revolution-is-taking-place-now-a-look-inside-the-stoxx-global-artificial-intelligence-index) — "WHITEPAPER"

---

> [!note] Methodology Disclaimer
> The definitions, formulas, and descriptions above are synthesized from publicly
> available STOXX and Qontigo methodology guides and research. For authoritative
> and up-to-date specifications, always consult the official rulebook for each
> specific index at [stoxx.com](https://stoxx.com/).
