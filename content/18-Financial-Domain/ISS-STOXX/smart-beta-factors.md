---
title: "Smart Beta & Factors"
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

> [!example]- Source excerpts (5)
>
> ore extraordinary items divided by total assets net income before extraordinary items ROA = t0 t0
> total assets t0 - CFO ratio greater than or equal to zero. The ratio is calculated as Cash Flow
> from Operation (CFO) divided by total assets cash flow from operation CFO Ratio = t0 t0 total
> assets t0 - **Accruals** less than or equal to zero. **Accruals** a...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> ested awards delivered through an equity incentive scheme, whether it be in the form of options or
> shares, is not considered to be in line with best practice, as it is generally expected that
> dividend payments only apply to vested shares. ISS already evaluates the provision of dividend
> payments and **accruals** on vested incentive awards in South Af...
>
> — [Israel And South Africa Policy Updates (PDF)](https://www.issgovernance.com/file/policy/2021/updates/Israel-and-South-Africa-Policy-Updates.pdf)
>
> l is z-scored using the Parent Index weights and truncated at +/- 3 standard deviations. The
> Momentum Factor combines the Signals at 25%, 50% and 25% weights, respectively, and is again
> z-scored and truncated at +/-3 standard deviations. The Quality Factor is a composite of the
> following 6 Signals: **Accruals**, Dilution, Gross Profitability, Change...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> at there is less overweighting of large caps. And thirdly, multi premia gains exposure to very
> diverse factor premia. Normally, for a fund tracking a market-cap-weighted flagship index such as
> the EURO STOXX 50 Index, you have a matching futures market to equitize cash. How do you equitize
> dividend **accruals** in the case of the CSIF (Lux) Equity E...
>
> — [Q&amp;A: Credit Suisse’s Froehlich on Multi-Premia Investing | Blog posts | S...](https://stoxx.com/qa-credit-suisses-froehlich-on-multi-premia-investing)
>
> ace known as smart beta, however, the strategy is a relatively new addition to the factor mix.
> This may be why compared to other factors ‘the dispersion in definitions is substantially
> largerfor quality,’ according to a 2016 study.3The paper’s authors found that definitions range
> from low levels of **accruals**, gross profitability and low investmen...
>
> — [The Quality Factor | Blog posts | STOXX](https://stoxx.com/the-quality-factor)
>

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

> [!example]- Source excerpts (4)
>
> Solutions Industry Neutral Factor Indices For investors looking to accurately access pure factor
> returns, without unintended sector exposures. The STOXX® Industry Neutral Ax Factor Indices
> implement the same methodology of the STOXX® Factor Indices while reducing the **active industry
> constraint** from +/- 5% to near neutral. The STOXX Factor Indice...
>
> — [Industry Neutral Factor Indices | STOXX](https://stoxx.com/industry-neutral-factor-indices)
>
> -construction tools and risk models. The indices target high exposures to proven sources of excess
> returns and, as well, manage liquidity and unintended risk exposures. The STOXX® Industry Neutral
> Factor Indices (Table 1) implement the same methodology of the STOXX Factor Indices while reducing
> the **active industry constraint** from +/- 5% to near ...
>
> — [The diversification benefits of a multi-factor approach: the STOXX Europe 600...](https://stoxx.com/the-diversification-benefits-of-a-multi-factor-approach-the-stoxx-europe-600-industry-neutral-ax-multi-factor-index)
>
> ix styles: Value, Momentum, Size, Low Risk, Quality and Multi-Factor. The futures will start
> trading on Apr. 26, Eurex said in a press release. The STOXX Industry Neutral Ax Factor Indices
> were introduced in February and implement the same methodology of the STOXX® Factor Indices while
> reducing the **active industry constraint** from +/- 5% to near ...
>
> — [Eurex to List Futures on STOXX Industry Neutral Ax Factor Indices | Blog post...](https://stoxx.com/eurex-to-list-futures-on-stoxx-industry-neutral-ax-factor-indices)
>
> hirdly, the index methodology upholds diversification through constraints on country and industry
> exposures, as well as individual security weights. “It may also be useful to highlight that the
> STOXX Industry Neutral Ax Factor Indices are versions of the standard STOXX Factor Indices that
> limit the **active industry constraint** from +/- 5% to near ...
>
> — [Q&amp;A: What do Eurex’s new futures on STOXX Factor Indices offer? | Blog po...](https://stoxx.com/qa-what-do-eurexs-new-futures-on-stoxx-factor-indices-offer)
>

---

### Alpha Signal

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="69 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 69</span>


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

> [!example]- Source excerpts (5)
>
> ating complementary ESG metrics into historically rewarded sources of returns, the latter can
> become more robust. “This is part of a longer journey for our investors,” said Dr. Ang. “We
> continuously want to push the definitions of these factors.” Other ESG signals An additional
> example of a climate **alpha signal** can be found in companies with the...
>
> — [BlackRock’s Ang on sustainability alpha signals: ESG and factors as ‘best fri...](https://stoxx.com/blackrocks-ang-on-sustainability-alpha-signals-esg-and-factors-as-best-friends)
>
> STOXX INDEX METHODOLOGY GUIDE 586/639 18. STOXX FACTOR INDICES STOXX EQUITY FACTOR INDEX FAMILY
> 18.4.1. OVERVIEW The STOXX Equity Factor Index Family are constructed by maximizing the index
> exposure to a multi- factor **alpha signal** while satisfying a set of constraints intended to
> closely track their parent indices. Universe: The constituents of ...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> XX MUTB EURO Paris Aligned indices provide investors with investable portfolios that meet the
> Paris Agreement objectives without greenwashing. The indices are compliant with the Paris- Aligned
> Benchmark regulations. Furthermore, these indices are expected to outperform their parent indices
> by using **alpha signal**s based on multiple measures associ...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> Equity Factor indices is to offer systematic and diversified access to a portfolio that tilts
> towards five historical drivers of returns: Quality, Value, Momentum, Low Size and Low Volatility.
> The indices select stocks through an optimization process that maximizes the allocation to a
> multi-factor **alpha signal**, while limiting undesirable exposur...
>
> — [BlackRock and STOXX collaboration: iShares multi-factor ETFs track STOXX indi...](https://stoxx.com/blackrock-and-stoxx-collaboration-ishares-multi-factor-etfs-track-stoxx-indices-to-deliver-consistent-risk-managed-exposure-for-a-portfolios-core)
>
> they understand how we derive the overall percentage that we consider is aligned with SDGs.” Data
> transparency was a recurrent point throughout the presentation, as panelists highlighted the
> importance of basing investment decisions on reliable information and eliminating the risk of
> greenwashing. **Alpha signal** A recent Qontigo whitepaper1 looked...
>
> — [Asset-owner panel discusses drivers, merits of integrating SDGs into investme...](https://stoxx.com/asset-owner-panel-discusses-drivers-merits-of-integrating-sdgs-into-investment-portfolios)
>

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

> [!example]- Source excerpts (3)
>
> THODOLOGY GUIDE 937/1024 128.iSTOXX APG EMERGING MARKETS-X AND RESPONSIBLE INDICES Individual
> Issuer Capping: The maximum weight of each issuer in the index is 8%. The sum of the weights of
> those issuers above 4.5% cannot exceed 35%. If the parent index itself does not satisfy the
> individual issuer **capping constraint**s, then those constraints are...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> breaching these thresholds, and reduce the gravity of the breaches if and when they occur. There
> is the additional limit that the individual weights cannot be greater than 20 times the company’s
> weight in the corresponding parent benchmark. If the parent index itself does not satisfy the
> individual **capping constraint**s those are not enforced on t...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> breaching these thresholds, and reduce the gravity of the breaches if and when they occur. There
> is the additional limit that the individual weights cannot be greater than 20 times the company’s
> weight in the corresponding parent benchmark. If the parent index itself does not satisfy the
> individual **capping constraint**s those are not enforced on t...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>

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

> [!example]- Source excerpts (1)
>
> rk, a vast number of empirical studies looked into characteristics of minimum variance portfolios
> with a focus on how to best implement such strategies in practice[2]. In recent years, however,
> academia has shifted its focus to the explanation of the so-called low volatility factor. The
> traditional **Capital Asset Pricing Model (CAPM)** explains ass...
>
> — [The low volatility premium – An analysis of factor exposures of minimum varia...](https://stoxx.com/the-low-volatility-premium-an-analysis-of-factor-exposures-of-minimum-variance-strategies-blog)
>

---

### Carry Factor

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="20 mentions across STOXX & ISS pages (low)">▰▰ 20</span>


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

> [!example]- Source excerpts (5)
>
> Neutral Indices posted a positive return, while the remaining two still outperformed the benchmark
> index. The iSTOXX Europe Factor Market Neutral Indices neutralize systematic risk by holding a
> short position in futures on the STOXX Europe 600. The best performer in the group was the iSTOXX®
> Europe **Carry Factor** Market Neutral Index, which reboun...
>
> — [Monthly Index News August 2018 (PDF)](https://stoxx.com/monthly-index-news-august-2018)
>
> The index, which includes stocks that trade at lower prices than the market’s average, which tend
> to do better in times of market upswings. These seem to have fallen out of favor with investors,
> perhaps reflecting their concerns about the pace of global expansion. By comparison, the iSTOXX®
> Europe **Carry Factor** Market Neutral Index is cementing i...
>
> — [Monthly Index News June 2018 (PDF)](https://stoxx.com/monthly-index-news-june-2018)
>
> MONTHLY INDEX NEWS / October Europe Factor Market Neutral Indices Key Points There were mixed
> performances in October from the iSTOXX® Europe Factor Market Neutral Indices, which hold a short
> position in STOXX Europe 600 futures to help investors neutralize systematic risk. The iSTOXX®
> Europe **Carry Factor** Market Neutral Index was the month’s bes...
>
> — [Monthly Index News October 2020 (PDF)](https://stoxx.com/monthly-index-news-october-2020)
>
> systematic risk, had a loss for the month. The iSTOXX® Europe Value Factor Market Neutral Index
> posted the narrowest loss, although it was still its eighth consecutive monthly retreat. The other
> only index in the family to have fallen in eight of the nine months so far in 2019 is the iSTOXX®
> Europe **Carry Factor** Market Neutral Index. For the whol...
>
> — [Monthly Index News September 2019 (PDF)](https://stoxx.com/monthly-index-news-september-2019)
>
> ary. Five of the seven indices posted a loss during the month on a net-return basis, with the
> iSTOXX® Europe Value Market Neutral Index showing the worst performance. The index offers exposure
> to stocks that appear undervalued relative to earnings and cash flow. At the other end, the
> iSTOXX® Europe **Carry Factor** Market Neutral Index, which target...
>
> — [Monthly Index News February 2020 (PDF)](https://stoxx.com/monthly-index-news-february-2020)
>

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

> [!example]- Source excerpts (2)
>
> . returns in excess of the benchmark) for the quarter, broken down into pre- and post-Feb. 19,
> 2020, the day that marked the peak before the virus-driven downturn. Chart 1 Sources of
> out/underperformance will be explored later in this post, but we observe some results that match
> intuition. The more **defensive factor**s (Low Risk and Quality) had th...
>
> — [STOXX Factor Indices – Q1 2020 Review | STOXX](https://stoxx.com/stoxx-factor-indices-q1-2020-review)
>
> s such, the STOXX Equity Factor indices upweight Quality. Value and Momentum are natural pairs,
> and so they have the same weight relative to each other. The Small Size factor, for its part, is a
> high beta, pro-cyclical factor, relative to the Low Volatility factor, which is low beta and a
> much more **defensive factor**. Those are opposing factors pu...
>
> — [BlackRock’s Jamie Forbes: Implementing ‘evolutionary’ factor advancements in ...](https://stoxx.com/blackrocks-jamie-forbes-implementing-evolutionary-factor-advancements-in-investments)
>

---

### Dilution

<span style="background:red; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1,648 mentions across STOXX & ISS pages (high)">▰▰▰▰▰▰ 1,648</span>


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

> [!example]- Source excerpts (5)
>
> 29. How is **dilution** calculated? For purposes of the **dilution** scoring factor, dilution is
> calculated as the sum of a plan's A, B, and C shares (as defined above with respect to SVT)
> divided by the number of shares outstanding as disclosed in the most recent circular. For
> informational purposes, full dilution (i.e. including shares allocated from ...
>
> — [Canada Equity Plan Scorecard (PDF)](https://www.issgovernance.com/file/policy/2022/americas/Canada-Equity-Plan-Scorecard.pdf)
>
> hree years. ▪ Performance is measured over a period shorter than three years. ▪ The plan allows
> for option repricing or issue of options at a discount or ▪ The plan allows for option repricing
> or issue of options at a discount or backdating of options. backdating of options. ▪ The potential
> maximum **dilution** under all share incentive schemes exce...
>
> — [Emea Policy Updates (PDF)](https://www.issgovernance.com/file/policy/2021/updates/EMEA-Policy-Updates.pdf)
>
> Corporations Act (British Columbia), permit companies to have an unlimited authorized capital. ISS
> prefers to see companies with a fixed maximum limit on authorized capital, with at least 30
> percent of the authorized stock issued and outstanding. Limited capital structures protect against
> excessive **dilution** and can be increased when needed with ...
>
> — [2015Canadaventurevotingguidelines (PDF)](https://www.issgovernance.com/file/policy/2015canadaventurevotingguidelines.pdf)
>
> 2016 Taft-Hartley U.S. Proxy Voting Guidelines Voting Power **Dilution** (VPD) Calculation Voting
> power **dilution**, or VPD, measures the amount of voting power represented by the number of
> shares reserved over the life of the plan. Industry norm dictates that ten percent dilution over
> the life of a ten‐year plan is reasonable for most mature companies...
>
> — [2016 Taft Hartley Advisory Services Us Guidelines (PDF)](https://www.issgovernance.com/file/policy/2016-taft-hartley-advisory-services-us-guidelines.pdf)
>
> -scored using the Parent Index weights and truncated at +/- 3 standard deviations. The Momentum
> Factor combines the Signals at 50%, and 50% weights, respectively, and is again z-scored and
> truncated at +/-3 standard deviations. The Quality Factor is a composite of the following 4
> Signals: Accruals, **Dilution**, Gross Profitability, and Change in Ne...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>

---

## E

### Efficient Frontier

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="16 mentions across STOXX & ISS pages (low)">▰▰ 16</span>


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

> [!example]- Source excerpts (5)
>
> indices and funds increasing, the optimal allocation of a portfolio’s risk budget will become only
> more crucial with time. To download the whitepaper and find out more about the active risk, active
> variance analysis and comparative returns of an optimized exclusions portfolio, click here. 1
> ‘Green **efficient frontier**s. Part 1: Minimizing the risk...
>
> — [Green efficient frontiers: Minimizing the risk impact of exclusions in sustai...](https://stoxx.com/green-efficient-frontiers-minimizing-the-risk-impact-of-exclusions-in-sustainable-portfolios)
>
> STOXX LIMITED 5 STOXX MINIMUM VARIANCE INDICES 1 Overview of minimum variance investing As
> mentioned above, the theoretical MVP has been widely known since the seminal paper by Harry
> Markowitz was published in 1952. In diagrammatic terms, the MVP is found at the very left tip of a
> mean- variance **efficient frontier** of feasible portfolios, as show...
>
> — [Stoxx Minvar Paper (PDF)](http://www.stoxx.com/document/Others/marketing/STOXX_MinVar_Paper.pdf)
>
> dices in the families that compose our Enhance category cover the world’s major markets. “Overall,
> our new sustainability suite offers investors a flexible menu to address their different needs,”
> said Seegopaul. “With the appropriate solution, we aim to help them reach the optimal spot on
> their new **efficient frontier** of impact, risk and returns....
>
> — [Qontigo’s ‘Enhance’ sustainable index category – optimizing ESG investing | B...](https://stoxx.com/qontigo-esg-enhance-sustainability-index-category)
>
> this, with continuously growing datasets updated quarterly, to assess companies’ contributions to
> the UN Sustainable Development Goals. James Leaton, Research Director of the SDI AOP, discusses
> the latest platform developments led by its asset-owner led community. Index | ESG &
> Sustainability Green **efficient frontier**s: Minimizing the risk impact...
>
> — [Portfolio Construction | STOXX](https://stoxx.com/category/portfolio-construction)
>
> world of tomorrow in the same way we thought about the world of yesterday,” Bocquet said during a
> panel at the Sustainable Investment Forum Europe 2021 on April 20. “The traditional
> risk-and-return framework is outdated. It needs to be updated with a third dimension: societal
> impact. Therefore, new **efficient frontier**s within these three dimensio...
>
> — [Sustainability Impact of Investments Calls for Redefined View of Asset Manage...](https://stoxx.com/sustainability-impact-of-investments-calls-for-redefined-view-of-asset-management-says-qontigos-bocquet)
>

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

> [!example]- Source excerpts (3)
>
> STOXX INDEX METHODOLOGY GUIDE 587/639 18. STOXX FACTOR INDICES The Momentum Factor is a composite
> of the following 3 Signals: **Earnings Announcement Drift**, Earnings Momentum, and Price
> Momentum.  **Earnings Announcement Drift** is given by the sum of idiosyncratic returns from the
> Axioma Risk Model on the most recent earnings announcement date and t...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> STOXX INDEX METHODOLOGY GUIDE 587/639 18. STOXX FACTOR INDICES The Momentum Factor is a composite
> of the following 3 Signals: **Earnings Announcement Drift**, Earnings Momentum, and Price
> Momentum.  **Earnings Announcement Drift** is given by the sum of idiosyncratic returns from the
> Axioma Risk Model on the most recent earnings announcement date and t...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> obal Equity Factor Index | STOXX World AC Index | From the respective starting universes,
> constituents are selected and weighted to maximize exposure to a multifactor signal created from
> the following five factors: Momentum The momentum score is calculated from price momentum,
> earnings momentum and **earnings announcement drift** (i.e., the differen...
>
> — [STOXX Equity Factor Indices | STOXX](https://stoxx.com/solutions/stoxx-equity-factor-indices)
>

---

### Earnings Momentum

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="21 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 21</span>


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

> [!example]- Source excerpts (5)
>
> , 12-month share-price appreciation, excluding the most recent month to avoid short-term reversal
> effects. But today’s markets are faster, flooded with information and more prone to short-term
> noise. Our research has shown that combining Momentum signals across both price and fundamentals —
> such as **earnings momentum** or **earnings momentum** drift — ...
>
> — [Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX a...](https://stoxx.com/qa-with-blackrock-fourth-year-of-multifactor-collaboration-with-stoxx-amid-evolving-factor-investing-landscape)
>
> STOXX INDEX METHODOLOGY GUIDE 587/639 18. STOXX FACTOR INDICES The Momentum Factor is a composite
> of the following 3 Signals: Earnings Announcement Drift, **Earnings Momentum**, and Price
> Momentum.  Earnings Announcement Drift is given by the sum of idiosyncratic returns from the
> Axioma Risk Model on the most recent earnings announcement date and t...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> he Multi-Factor Alpha Signal is derived from sixteen Signals, which are combined to create 5
> Factors - Momentum, Quality, Value, and Low Volatility. The Factors are combined to create a -
> Multi-Factor Alpha Signal, as described below. F The Momentum Factor is a composite of the
> following 2 Signals: **Earnings Momentum**, and Price Momentum. A • Earn...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> Cap Index | | STOXX Global Equity Factor Index | STOXX World AC Index | From the respective
> starting universes, constituents are selected and weighted to maximize exposure to a multifactor
> signal created from the following five factors: Momentum The momentum score is calculated from
> price momentum, **earnings momentum** and earnings announcement dri...
>
> — [STOXX Equity Factor Indices | STOXX](https://stoxx.com/solutions/stoxx-equity-factor-indices)
>
> hnology adoption grows rapidly, and incomes and quality of life continue to improve. This presents
> a robust, long-term investment opportunity for investors. “In today’s low-rate environment,
> investors need to broaden their sources of income as well as diversify them. With strong economic
> growth and **earnings momentum**, a number of EM companies can...
>
> — [Q&amp;A with FlexShares: Quality and ESG as risk-control tools for EM Low-Vol...](https://stoxx.com/qa-with-flexshares-quality-and-esg-as-risk-control-tools-for-em-low-vol-high-dividend-strategies)
>

---

### Equal Risk Contribution

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="3 mentions across STOXX & ISS pages (ultra-low)">▰ 3</span>


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

> [!example]- Source excerpts (1)
>
> IVEST INDICES Active Risk: The active risk of the index relative to the Parent Index is
> constrained to a maximum of 1%. Limit turnover: The Index has a quarterly one-way turnover limit
> of 7.5%. Effective number of names: The minimum effective number of names in the Index is 30% of
> the Parent Index. **Equal Risk Contribution** by targeted factors: Ri...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>

---

## F

### Factor (Definition)

<span style="background:deeppink; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="6,492 mentions across STOXX & ISS pages (ultra-high)">▰▰▰▰▰▰▰ 6,492</span>


> A systematic, persistent, and economically motivated driver of security
> returns. STOXX recognizes canonical factors including value, momentum, quality,
> low volatility, and size. Each factor is operationalized through specific
> financial metrics, standardized into z-scores, and used to tilt portfolio
> weights away from market capitalization.

In plain terms, a factor is a measurable characteristic of stocks — like cheapness or recent performance — that has historically been rewarded with higher returns over long periods, backed by economic reasoning.

> [!tip] Related terms
> [[#Factor Investing]], [[#Factor-Based Index]], [[#Smart Beta]]

> [!example]- Source excerpts (5)
>
> STOXX INDEX METHODOLOGY GUIDE 113/639 10. STOXX DIVIDEND INDICES where ADTVi represents the
> Average Daily Traded Value of the ith non-component stock over the 3- month period ending on the
> month prior to the review month. 4. Outperformance **factor** calculation To obtain the selection
> list all companies are ranked according to an outperformance fac...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> CANADA FAQ: EQUITY PLAN SCORECARD 29. How are performance-based equity awards defined? For the
> purposes of the CEO Performance-based Equity **Factor**, which assesses whether the CEO has
> received performance-based equity, a performance-based equity award is defined as any form of
> equity award where: ▪ the ultimate value of the award is tied, through...
>
> — [Canada Equity Plan Scorecard (PDF)](https://www.issgovernance.com/file/policy/2020/americas/Canada-Equity-Plan-Scorecard.pdf)
>
> -1)+Fn+4(t-1)] is the numbers of contracts 12.3.3. ROLLING On December expiry of year n, the
> number of contracts has to be adjusted by a rolling **factor** RFN- N+1 so that the index notional
> is invested in a new number of contracts in the next five EURO STOXX 50 DVP futures after the
> roll. The rolling **factor** RFN-N+1 is calculated as follows: 𝐹 (𝑡)+...
>
> — [Stoxx Strategy Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_strategy_guide.pdf)
>
> 30 or above, then 1, else if the ratio is 15 or below 30, then 0.5, else zero ▪ Day care facility
> or allowance. If exists, then 1, else zero ▪ Re-employment plan. If exists, then 1, else zero The
> empowering women score is calculated as the average of the three sub-items The human capital
> investment **factor** is calculated as the average of the five...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> Transparency. Inclusiveness. Global Expertise. DEFINITIONS AND EXPLANATIONS The term "widely held"
> refers to companies that ISS designates as such based on their membership in a major index and/or
> the number of ISS clients holding the securities. For stylistic purposes, this document may use
> the adjectival form of country names to refer to compa
>
> — [Europeansummaryguidelines (PDF)](https://www.issgovernance.com/file/2014_Policies/EuropeanSummaryGuidelines.pdf)
>

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

> [!example]- Source excerpts (5)
>
> phase such as in 2018, quality and low-risk stocks, well-known for their defensive
> characteristics, outperformed by 6.3 percentage points and 3.9 points, respectively. On the other
> hand, value and reversal stocks, which are described as countercyclical, slightly underperformed
> the market. Figure 1: **Factor diversification** in practice Drawdown ris...
>
> — [The Power of Factor Diversification | Blog posts | STOXX](https://stoxx.com/the-power-of-factor-diversification)
>
> e factors that have positive performance but different cyclicality and often uncorrelated return
> profiles. The STOXX Multifactor Indices do not invest in multiple single-factor portfolios
> according to desired weights, but rather seek to integrate the different factors in an efficient
> way to capture **factor diversification**. For every security, an ...
>
> — [Introducing the STOXX Factor Indices | STOXX](https://stoxx.com/introducing-the-stoxx-factor-indices)
>
> r approach becomes evident. Several of the single-factor portfolios — including Low Risk at
> different times, and Value and Small Size most recently — showed significant periods of
> underperformance. The multifactor portfolio, on the other hand, did not exhibit any sustained
> underwater periods. Intra-**factor diversification** A final consideration in...
>
> — [Multifactor strategies: Proving their worth in the factor investment landscap...](https://stoxx.com/multifactor-strategies-proving-their-worth-in-the-factor-investment-landscape)
>
> e-average exposures to multiple factors, with practical portfolio and trading elements such as
> diversification, turnover and tracking error considerations. These include market-relative caps on
> sector and country weights as well as absolute and market-relative limits on individual security
> weights. **Factor diversification** Additional consideration...
>
> — [Qontigo launches modern STOXX multifactor indices to underlie iShares ETFs ma...](https://stoxx.com/qontigo-launches-modern-stoxx-multifactor-indices-to-underlie-ishares-etfs-managed-by-blackrock)
>
> time-tested strategies through an ETF. It’s convenient, it’s transparent and it’s low cost. We can
> take exposures in the core of our portfolios, strategically seek outperformance, or implement
> tactical views with factor ETFs.” You highlight risk management. Why is it important for investors
> to have **factor diversification** from that perspective? L...
>
> — [BlackRock and STOXX collaboration: iShares multi-factor ETFs track STOXX indi...](https://stoxx.com/blackrock-and-stoxx-collaboration-ishares-multi-factor-etfs-track-stoxx-indices-to-deliver-consistent-risk-managed-exposure-for-a-portfolios-core)
>

---

### Factor Investing

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="170 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 170</span>


> An investment approach that targets specific, evidence-based return drivers
> (factors) through systematic portfolio construction. STOXX implements factor
> investing via transparent, rules-based indices that overweight securities with
> desirable factor characteristics and underweight (or exclude) those without.

In plain terms, instead of buying the whole market by size, factor investing deliberately tilts toward stocks that share a trait — cheapness, recent winners, financial health — that academic research has shown earns a premium over time.

> [!tip] Related terms
> [[#Factor (Definition)]], [[#Smart Beta]], [[#Factor-Based Index]], [[#Risk Premia]]

> [!example]- Source excerpts (5)
>
> Continue active refreshing of this index's data? Continue active refreshing of this index's data?
> **Factor Investing** Most Recent **Factor Investing** A rotation out of technology and AI-related
> stocks weighed on US indices in February, while inflows into lower-valuation, more traditional
> sectors lifted European benchmarks for an eighth straight month....
>
> — [Factor Investing | STOXX](https://stoxx.com/category/factor-investing)
>
> line with traditional core solutions.” What does a systematic, index-based methodology add to
> **factor investing**? And what is the benefit of collaborating with an index provider like STOXX?
> “A systematic, index-based approach brings transparency, consistency and cost efficiency —
> hallmarks of modern **factor investing**. By clearly defining, weighting...
>
> — [Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX a...](https://stoxx.com/qa-with-blackrock-fourth-year-of-multifactor-collaboration-with-stoxx-amid-evolving-factor-investing-landscape)
>
> **Factor investing** has received much attention in recent years as a source of above-market
> returns. It’s also been the target of some criticism, mainly due to recent years’ underperformance
> of styles such as Value and Size. Contrary to skeptics’ views, a well-constructed portfolio that
> invests along r
>
> — [Not so fast. Factor investing is alive and doing well! | Blog posts | STOXX](https://stoxx.com/not-so-fast-factor-investing-is-alive-and-doing-well)
>
> This video first appeared on Asset TV’s MASTERCLASS: **Factor Investing** – June 2023. Recent
> market developments and investing trends have prompted investors to reconsider their investment
> allocations. Factors assist investors in understanding the present market and informing their
> investment decisions. Melissa Brown, Managing Director of Applied R...
>
> — [MASTERCLASS: Factor Investing - June 2023 | Blog posts | STOXX](https://stoxx.com/masterclass-factor-investing-june-2023)
>
> of **factor investing** to a much larger audience. We spoke to Jan-Carl Plagge, head of applied
> research at STOXX Ltd., to ask him why factor-based passive strategies are proving so popular, and
> what the outlook for the sector is going forward. Jan, why have passive factor strategies become
> so popular? **Factor investing** has been around for quite a wh...
>
> — [Factor Investing: Q&amp;A on Flows, Outlook | Blog posts | STOXX](https://stoxx.com/factor-investing-qa-on-flows-outlook)
>

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

> [!example]- Source excerpts (5)
>
> , shedding 7.7%. The value index has underperformed the average of the other six factor gauges in
> all but one year since 2013. The iSTOXX Europe Factor Market Neutral Indices hold a short position
> in futures on the STOXX Europe 600 to neutralize systematic risk and hence gain exposure purely to
> the **factor premium**. ESG strategies to pay off Follo...
>
> — [2019 Market Outlook II – Dollar Down, Risk Up? | Blog posts | STOXX](https://stoxx.com/2019-market-outlook-ii-dollar-down-risk-up)
>
> monthly, stocks with weaker momentum scores are reduced or sold. The methodology ensures that the
> portfolio is made up of each month’s best-of-momentum stocks with all constraints considered.
> Opportunities in 2018 Many investors say momentum will continue to perform well in 2018, although,
> like all **factor premium**s, it is subject to cyclicality a...
>
> — [Evaluating the true cost of momentum investing | Blog posts | STOXX](https://stoxx.com/evaluating-the-true-cost-of-momentum-investing)
>
> iodic rebalancings, he estimated the transaction costs of trading and rebalancing the portfolios
> of each factor strategy. Costs were then compared against the factor risk premia associated with
> these ETFs, using the Axioma Equity Factor Risk Model.2 For all but two of 14 strategy types, the
> average **factor premium** exceeded the average rebalancing...
>
> — [Study Shines Light on Smart Beta’s Effectiveness and Capacity | Blog posts | ...](https://stoxx.com/study-shines-light-on-smart-betas-effectiveness-and-capacity)
>
> tially smoother investment profile over time. Figure 1: Components of the Multifactor signal in
> the STOXX Equity Factor indices Risk premium The paper reviews the risk management,
> diversification and turnover constraints built into the index methodology, a process that upholds
> the harvesting of the **factor premium** in an investable and repeatable ...
>
> — [A behind-the-scenes look at the STOXX Equity Factor indices | Blog posts | STOXX](https://stoxx.com/a-behind-the-scenes-look-at-the-stoxx-equity-factor-indices)
>
> roach with those of passive replication is a very good proposition. Can you briefly describe the
> stock selection methodology? The multi-premia methodology was developed by Finreon. Based on
> relevant and scientifically proven ratios, the best stocks from the investment universe are
> selected for each **factor premium** — value, size, momentum, residua...
>
> — [Q&amp;A: Credit Suisse’s Froehlich on Multi-Premia Investing | Blog posts | S...](https://stoxx.com/qa-credit-suisses-froehlich-on-multi-premia-investing)
>

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

> [!example]- Source excerpts (2)
>
> ISS EVA RESOURCE CENTER REPORTS Giving Credit Where and When Credit is Due **Factor Rotation**s:
> When Do Growth and Value Outperform? Manage Risk by Managing Expectations ESG Matters: How ESG and
> EVA Indicators Relate to Market Performance EVA and Governance QualityScore – Emerging Markets
> Getting Tangible About Intangibles ESG Matters (Part II) Dri...
>
> — [ISS EVA Resource Center | ISS](https://www.issgovernance.com/eva/iss-eva-resource-center)
>
> arket cycles. These ETFs are designed to replace traditional core equity holdings with balanced
> exposures to long-term drivers of returns.” To finish off, how has the iShares multifactor suite
> performed since launch three years ago? “The past three years have been a volatile period, marked
> by sharp **factor rotation**s, inflation surprises and diver...
>
> — [Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX a...](https://stoxx.com/qa-with-blackrock-fourth-year-of-multifactor-collaboration-with-stoxx-amid-evolving-factor-investing-landscape)
>

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

> [!example]- Source excerpts (5)
>
> . Other constraints the iSTOXX factor indices methodology include a limit in the number of stocks
> and a cap on each stock’s weight. Methodology and optimization approach help trigger sell signal A
> strict sell discipline is a function of the iSTOXX factor indices’ process. The indices aim for a
> high **factor tilt**, a proxy for a stock’s expected ret...
>
> — [Evaluating the true cost of momentum investing | Blog posts | STOXX](https://stoxx.com/evaluating-the-true-cost-of-momentum-investing)
>
> s offer robust factor definitions and targeted factor exposures, and ensure the tradability of
> component stocks. They employ the institutionally tested analytics of Axioma Factor Risk Models.
> On a global basis, Size showed the best performance last month while Low Risk had the weakest one.
> The Size **factor tilt**s towards the smallest-capitalizatio...
>
> — [Monthly Index News December 2023 (PDF)](https://stoxx.com/monthly-index-news-december-2023)
>
> ontribution, only overshadowed by very strong performances from a few other factors. Exhibit 4:
> Heat map of targeted factor contributions, 2002 to 2021 The STOXX Europe 600 Industry Neutral Ax
> Multi-Factor Index is constructed so that it gets most of its risk – and therefore return – from
> its style **factor tilt**s, and we see that that is the case ...
>
> — [The diversification benefits of a multi-factor approach: the STOXX Europe 600...](https://stoxx.com/the-diversification-benefits-of-a-multi-factor-approach-the-stoxx-europe-600-industry-neutral-ax-multi-factor-index)
>
> and Responsible Minimum Volatility Indices are a set of indices designed by optimizing the parent
> index (iSTOXX World A index) to produce a set of indices that G have the lowest absolute ex-ante
> volatility under different ESG, Carbon and SDI constraints. Those indices also place controls over
> style **factor tilt**s, industry / country exposures and ...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> r the entire year, all markets except Hong Kong gained. Sixteen of 20 emerging markets tracked by
> STOXX rose in the year. Factor investing On a global basis, Size showed the best performance in
> December while Low Risk was the weakest style, according to the STOXX Factor indices (Figure 5).
> The Size **factor tilt**s towards the smallest-capitalizatio...
>
> — [Stocks extend gains in December, lifting indices to record highs | Blog posts...](https://stoxx.com/stocks-extend-gains-in-december-lifting-indices-to-record-highs)
>

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

> [!example]- Source excerpts (5)
>
> ZUG, Switzerland (September 11, 2025) – STOXX Ltd., part of the ISS STOXX group of companies,
> today announced its expanding collaboration with L&G, with L&G’s launch of three developed world
> **factor-based index** funds tracking customized iSTOXX indices. These funds, built on customized
> iSTOXX indices, reflect L&G’s proprietary factor research and ...
>
> — [STOXX and L&amp;G collaborate on launch of three L&amp;G developed world fact...](https://stoxx.com/stoxx-and-lg-collaborate-on-launch-of-three-lg-developed-world-factor-based-index-funds)
>
> etween the market-neutral factor indices, i.e. the risk premia, and the benchmark STOXX® Europe
> 600 index were very low and even negative over the study period, meaning they can also serve as a
> great source of diversification. You mentioned low cost. How important is that as a driver for
> flows into **factor-based index** products? Our experience is ...
>
> — [Factor Investing: Q&amp;A on Flows, Outlook | Blog posts | STOXX](https://stoxx.com/factor-investing-qa-on-flows-outlook)
>
> ed. Stocks rose for the sixth consecutive month in September, the longest positive run in four
> years, on investor expectations that falling US interest rates and sustained economic growth will
> help corporate earnings. Factor Investing STOXX and L&G collaborate on launch of three L&G
> developed world **factor-based index** funds STOXX Ltd. today annou...
>
> — [Factor Investing | STOXX](https://stoxx.com/category/factor-investing)
>
> Legal & General Investment Management (LGIM), the biggest UK-based asset manager, has switched to
> the iSTOXX® World Min Vol ESG index to manage a mandate for a large pension-fund client. At the
> center of this sustainable, **factor-based index** solution is a systematic process that uses the
> Axioma optimizer to balance multiple investment objectives ...
>
> — [LGIM switches to iSTOXX World Min Vol ESG index for pension fund mandate | Bl...](https://stoxx.com/lgim-switches-to-istoxx-world-min-vol-esg-index-for-pension-fund-mandate)
>
> OXX’s parent Qontigo. “The transformation of investment universes with an ESG focus is catching up
> with the most important benchmarks, creating an acceleration of the phenomenon,” said Roberto
> Lazzarotto, Global Head of Sales at STOXX. ESG stands for environmental, social and governance
> strategies. **Factor-based index** strategies, which select sto...
>
> — [ETF Inflows Grow, Assets Reach Record | STOXX](https://stoxx.com/etf-inflows-grow-assets-reach-record)
>

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

> [!example]- Source excerpts (1)
>
> Figure 8 shows the active style-factor exposures of the AI index relative to the parent universe
> of the STOXX® World AC. The AI index has its largest positive active exposures in the Market
> Sensitivity, Volatility and Liquidity factors, while also being more exposed to the Medium-Term
> Momentum and **Growth factor**s. Negative active exposures includ...
>
> — [The AI revolution is taking place now – a look inside the STOXX Global Artifi...](https://stoxx.com/the-ai-revolution-is-taking-place-now-a-look-inside-the-stoxx-global-artificial-intelligence-index)
>

---

## I

### Industry Neutral

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="201 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 201</span>


> A portfolio construction constraint ensuring that the aggregate weight of each
> GICS industry or ICB sector in the factor portfolio exactly matches its weight
> in the parent index. STOXX industry-neutral factor indices isolate pure
> within-sector stock selection alpha by eliminating cross-sector bets entirely.

In plain terms, if the benchmark has 12% in pharmaceuticals, the factor index also holds exactly 12% in pharmaceuticals. All the action happens inside each sector — picking the best factor stocks within each industry — rather than across sectors.

> [!tip] Related terms
> [[#Active Industry Constraint]], [[#Tracking Error Budget]], [[#Factor Tilt]]

> [!example]- Source excerpts (5)
>
> Eurex is listing futures tracking 12 STOXX® **Industry Neutral** Ax Factor Indices covering the
> European and US markets, allowing investors to target well-researched and robust factor strategies
> relying on Axioma’s Risk Models and optimization tools. The STOXX **Industry Neutral** Ax Factor
> Indices are derived from two well-established market-capitaliza...
>
> — [Eurex to List Futures on STOXX Industry Neutral Ax Factor Indices | Blog post...](https://stoxx.com/eurex-to-list-futures-on-stoxx-industry-neutral-ax-factor-indices)
>
> Solutions **Industry Neutral** Factor Indices For investors looking to accurately access pure
> factor returns, without unintended sector exposures. The STOXX® **Industry Neutral** Ax Factor
> Indices implement the same methodology of the STOXX® Factor Indices while reducing the active
> industry constraint from +/- 5% to
>
> — [Industry Neutral Factor Indices | STOXX](https://stoxx.com/industry-neutral-factor-indices)
>
> The STOXX® Europe 600 **Industry Neutral** Ax Multi-Factor index provides investors with a broadly
> diversified portfolio designed to maximize exposure to several well-known style factors while
> minimizing exposures to industries and other style factors that may add to a portfolio’s risk but
> are not typically compensated. The
>
> — [The diversification benefits of a multi-factor approach: the STOXX Europe 600...](https://stoxx.com/the-diversification-benefits-of-a-multi-factor-approach-the-stoxx-europe-600-industry-neutral-ax-multi-factor-index)
>
> Maximum Dividend Indices October 2016 (5): Addition of revised Minimum Variance methodology in
> chapter 16.1, STOXX Minimum Variance and Minimum Variance Unconstrained October 2016 (6): Addition
> of STOXX China A 900 Minimum Variance Indices in chapter 16.1. November 2016: Addition of STOXX
> Regional **Industry Neutral** ESG and STOXX Regional Excludin...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> procedure, the benchmark is defined as the new composition of the STOXX Global 1800 which becomes
> effective on the review date on the 3rd Friday of March, June, September and December. Weighting
> scheme: All components are free float market cap weighted with a capping algorithm which delivers
> an ICB **Industry Neutral** weighting compared to the benc...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>

---

## L

### Low Risk Factor

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="14 mentions across STOXX & ISS pages (low)">▰▰ 14</span>


> A broad factor category encompassing strategies that overweight securities
> exhibiting lower realized or predicted risk metrics. In STOXX's framework, low
> risk subsumes both low volatility (based on historical standard deviation) and
> low beta (based on market sensitivity), and may be combined with other signals
> in multi-factor constructions.

In plain terms, the low risk factor is the finding that boring, steady stocks have historically delivered better risk-adjusted returns than wild, volatile ones — contradicting the textbook idea that more risk always equals more reward.

> [!tip] Related terms
> [[#Low Volatility Factor]], [[#Minimum Variance]], [[#Risk Premia]]

> [!example]- Source excerpts (5)
>
> Market Neutral Indices, which hold a short position in futures on the STOXX Europe 600 to help
> investors neutralize systematic risk, fell on a net-return basis. The iSTOXX® Europe Size Factor
> Market Neutral Index retreated 2.3%, its sixth straight monthly loss. At the other end, the
> iSTOXX® Europe **Low Risk Factor** Market Neutral Index dropped the...
>
> — [Monthly Index News July 2019 (PDF)](https://stoxx.com/monthly-index-news-july-2019)
>
> Index, which seeks to extract the risk premium of small-capitalization shares, fell 1.8%.
> Investing in factors in isolation of the market risk has been a winning proposition in the past
> year, with all iSTOXX Europe Factor Market Neutral Indices outperforming the STOXX Europe 600. The
> iSTOXX® Europe **Low Risk Factor** Market Neutral Index has been t...
>
> — [Monthly Index News October 2018 (PDF)](https://stoxx.com/monthly-index-news-october-2018)
>
> May 2019 Europe Factor Market Neutral Indices Key points Only two of the seven iSTOXX® Europe
> Factor Market Neutral Indices, which hold a short position in futures on the STOXX Europe 600 to
> help investors neutralize systematic risk, posted a positive return during May. The iSTOXX® Europe
> **Low Risk Factor** Market Neutral Index advanced 1% and the ...
>
> — [Monthly Index News May 2019 (PDF)](https://stoxx.com/monthly-index-news-may-2019)
>
> variance index than a simple risk-reduction strategy. Drawdowns are smaller and occur less often
> for the MVP and it has a higher average return. Further, the market capitalization weighted
> benchmark has fatter tails. In other words, a low risk weighted portfolio is an impure attempt at
> achieving a **Low Risk factor** allocation. This does not adequa...
>
> — [Stoxx Minvar Paper (PDF)](http://www.stoxx.com/document/Others/marketing/STOXX_MinVar_Paper.pdf)
>
> For the first half of 2020, the illustrative Mixed portfolio has underperformed the benchmark,
> while the Integrated approach has fared only slightly better, with a poorer Q2. Looking at the
> attribution for this period, we observe that the Mixed portfolio was able to better capitalize
> overall on the **Low Risk factor** (as defined by Market Sensitivi...
>
> — [STOXX Factor and STOXX ESG-X Factor Indices Q2 Spotlight – Mixed Performance,...](https://stoxx.com/stoxx-factor-and-stoxx-esg-x-factor-indices-q2-spotlight-mixed-performance-strong-exposures-and-rebounding-correlations)
>

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

> [!example]- Source excerpts (5)
>
> 1952][1]. In the years following his work, a vast number of empirical studies looked into
> characteristics of minimum variance portfolios with a focus on how to best implement such
> strategies in practice[2]. In recent years, however, academia has shifted its focus to the
> explanation of the so-called **low volatility factor**. The traditional Capital ...
>
> — [The low volatility premium – An analysis of factor exposures of minimum varia...](https://stoxx.com/the-low-volatility-premium-an-analysis-of-factor-exposures-of-minimum-variance-strategies-blog)
>
> is given by the latest 12-month net income divided by the total market capitalization. Signals are
> z-scored using the Parent Index weights and outliers are truncated at +/- 3 standard deviations.
> The Value Factor combines the 5 Signals equally at 20% weights and is again z-scored and
> truncated. The **Low Volatility Factor** is given by the standard ...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> ortfolio and offers that little bit lower risk profile. As such, the STOXX Equity Factor indices
> upweight Quality. Value and Momentum are natural pairs, and so they have the same weight relative
> to each other. The Small Size factor, for its part, is a high beta, pro-cyclical factor, relative
> to the **Low Volatility factor**, which is low beta and a ...
>
> — [BlackRock’s Jamie Forbes: Implementing ‘evolutionary’ factor advancements in ...](https://stoxx.com/blackrocks-jamie-forbes-implementing-evolutionary-factor-advancements-in-investments)
>
> n order to reduce risk. This involves dynamically rotating around stock, industry, geographical
> and factor allocations, taking into account current market information in order to always hold the
> portfolio with minimum risk. Importantly, minimum variance does not equate to a simple allocation
> to the **low volatility factor**, which would be represent...
>
> — [Stoxx Minvar Paper (PDF)](http://www.stoxx.com/document/Others/marketing/STOXX_MinVar_Paper.pdf)
>
> k as much as they are used to target higher-growth areas. Factors and minimum variance The boom in
> factor-based strategies in the past decade has also allowed investors to allocate resources to
> stocks whose features can help make them less vulnerable in volatile markets. That’s true not just
> of the **low volatility factor**, but also of quality, hig...
>
> — [The New Faces of Risk Management | Blog posts | STOXX](https://stoxx.com/the-new-faces-of-risk-management)
>

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
---

### Minimum Variance

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="872 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 872</span>


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

> [!example]- Source excerpts (5)
>
> Based on Modern Portfolio Theory, the STOXX **Minimum Variance** indices aim to limit volatility
> using a consistently applied and rules-based methodology. The index suite, which uses our
> factor-model approach two versions of every benchmark — constrained and unconstrained. Key indices
> STOXX Europe 600 **Minimum Variance** Loading… STOXX USA 900 Minim
>
> — [Minimum Variance Indices | STOXX](https://stoxx.com/minimum-variance-indices)
>
> **Minimum Variance** Indices are designed to achieve the lowest return volatility in a given
> investable universe. Every index in the family is constructed via an optimization process using
> the Axioma optimizer, risk models and an estimated covariance matrix. A new study1 by Qontigo
> examines whether the **Minimum Variance** indices can still deliver thei...
>
> — [Minimum Variance Indices: A Reading Through Geopolitical Risk | Blog posts | ...](https://stoxx.com/minimum-variance-indices-a-reading-through-geopolitical-risk)
>
> , climbed 3.7% between January and September and fell 4.5% in October. Quick math shows that the
> MinVar index is now outperforming its market cap-weighted benchmark this year, after an extremely
> volatile month that came to disrupt tranquil spring and summer trading. One month is all it took
> for the **minimum variance** strategy to undo the 2018 unde...
>
> — [Minimum Variance’s Prowess in Risk Protection | Blog posts | STOXX](https://stoxx.com/minimum-variances-prowess-in-risk-protection)
>
> filter which involves looking at the factors’ exposures of the min var portfolio and setting a
> threshold for those to remain within a certain range of the benchmark. This means that the min var
> version will likely have similar attributes to the benchmark as well as achieving the objective of
> having **minimum variance**. The min var approach is popul...
>
> — [Minimum Variance has its ‘day in the sun’ - ETF Express](https://stoxx.com/minimum-variance-has-its-day-in-the-sun)
>
> The STOXX® Global Select 100 EUR Index, which is measured in euros, climbed 6.1%. The index blends
> increasing dividend yields with low volatility. All three indices had lost 20% in March. Despite
> the gains, all three gauges posted in April their second-highest monthly volatility reading on
> record. **Minimum variance** lags behind Also lagging benchm...
>
> — [Stocks Post Best Month in 11 Years in April, Paring 2020 Losses | STOXX](https://stoxx.com/stocks-post-best-month-in-11-years-in-april-paring-2020-losses)
>

---

### Momentum Factor

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="58 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 58</span>


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

> [!example]- Source excerpts (5)
>
> 𝑖𝑧𝑒 𝑖=𝑁 𝐵̂𝑃𝑅 𝑖=𝑁 𝜀 𝑖=𝑁 where 𝛽 ̂𝑀𝑜𝑚 : standardized 12-month momentum adjusted with market beta
> factor of stock i 𝑎𝑑𝑗 𝑖 𝑠̂𝑖𝑧𝑒 : standardized size factor of stock i 𝑖 𝐵̂𝑃𝑅 : standardized BPR of
> stock i 𝑖 ε : residual error i α* : alpha N : number of stocks in the parent index The risk-factor
> adjusted **momentum factor** is defined as the residual erro...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> Europe Factor Market Neutral Indices Key points The iSTOXX® Europe Factor Market Neutral Indices,
> which hold a short position in futures on the STOXX Europe 600 to help investors neutralize
> systematic risk, struggled in April. Six of the seven indices posted a loss for the month. The
> iSTOXX® Europe **Momentum Factor** Market Neutral Index was the ex...
>
> — [Monthly Index News April 2019 (PDF)](https://stoxx.com/monthly-index-news-april-2019)
>
> STOXX INDEX METHODOLOGY GUIDE 587/639 18. STOXX FACTOR INDICES The **Momentum Factor** is a
> composite of the following 3 Signals: Earnings Announcement Drift, Earnings Momentum, and Price
> Momentum.  Earnings Announcement Drift is given by the sum of idiosyncratic returns from the
> Axioma Risk Model on the most recent earnings announcement date and t...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> entum or earnings momentum drift — enhances signal strength (Figure 2). This approach helps us
> avoid simplistic exposures and better reflect what Momentum truly represents: a behavioral
> phenomenon rooted in investor underreaction, and not just a statistical artifact.” Figure 2:
> Active returns – USA **Momentum factor** “It’s worth emphasizing here th...
>
> — [Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX a...](https://stoxx.com/qa-with-blackrock-fourth-year-of-multifactor-collaboration-with-stoxx-amid-evolving-factor-investing-landscape)
>
> 2 ISIN Fund ISIN Text 12 3 NAME Name of the fund Text 255 4 CURRENCY ISO currency of the fund Text
> 3 5 COUNTRY ISO country code of the fund Text 2 6 SECTOR Citywire sector of the fund Text 255 7
> ASSET_CLASS Asset class of the fund Text 19 8 RATING Citywire rating of the fund Text 3
> MOMENTUM_FACT 9 **Momentum factor** of the fund Number 15 OR 10 WEIG...
>
> — [Index Files Guide 20230619 (PDF)](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)
>

---

### Multi-Factor

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="317 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 317</span>


> An index or strategy that systematically combines two or more factor signals
> into a single portfolio. STOXX multi-factor indices may use either a
> **composite scoring** approach (blending z-scores before optimization) or a
> **portfolio blending** approach (combining single-factor portfolios). The
> composite approach is more common in STOXX methodology.

In plain terms, instead of betting on one factor, you bet on several at once — for example, value + momentum + quality. This hedges your bets because different factors outperform in different market conditions.

> [!tip] Related terms
> [[#Factor Diversification]], [[#Multifactor Signal]], [[#Alpha Signal]]

> [!example]- Source excerpts (5)
>
> The STOXX® Europe 600 Industry Neutral Ax **Multi-Factor** index provides investors with a broadly
> diversified portfolio designed to maximize exposure to several well-known style factors while
> minimizing exposures to industries and other style factors that may add to a portfolio’s risk but
> are not typically compensated. The expectation — and be
>
> — [The diversification benefits of a multi-factor approach: the STOXX Europe 600...](https://stoxx.com/the-diversification-benefits-of-a-multi-factor-approach-the-stoxx-europe-600-industry-neutral-ax-multi-factor-index)
>
> Last June, BlackRock revitalized its **multi-factor** product suite with the relaunch of the
> iShares U.S. Equity Factor ETF (LRGF) and iShares International Equity Factor ETF (INTF). We sat
> down with Lukas Smart, Head of US iShares Sustainable and Factors Product Segments, and Arun
> Singhal, Global Head of Index Product Management at STOXX,
>
> — [BlackRock and STOXX collaboration: iShares multi-factor ETFs track STOXX indi...](https://stoxx.com/blackrock-and-stoxx-collaboration-ishares-multi-factor-etfs-track-stoxx-indices-to-deliver-consistent-risk-managed-exposure-for-a-portfolios-core)
>
> inciples, controversial weapons, thermal coal, nuclear power and tobacco producers. The index then
> seeks to diversify across the factors of profitability, earnings yield, leverage, value and low
> volatility (accomplished through a minimum variance objective), with constituent weights
> determined by a **multi-factor** optimization process. ECBV is link...
>
> — [UniCredit launches ESG-screened Eurozone multi-factor and low vol ETFs | ETF ...](https://stoxx.com/unicredit-launches-esg-screened-eurozone-multi-factor-and-low-vol-etfs)
>
> Last August, Credit Suisse Asset Management (Switzerland) Ltd. launched the first index fund
> tracking the EURO STOXX® Multi Premia Index, a **multi-factor** strategy based on cutting-edge
> research. The index integrates the academic research-based Multi Premia® methodology developed by
> Finreon, a spin-off from University of St. Gallen in Switzerland....
>
> — [Q&amp;A: Credit Suisse’s Froehlich on Multi-Premia Investing | Blog posts | S...](https://stoxx.com/qa-credit-suisses-froehlich-on-multi-premia-investing)
>
> STOXX INDEX METHODOLOGY GUIDE 573/639 18. STOXX FACTOR INDICES STOXX Asia/Pacific 600 Ax Momentum
> STOXX Asia/Pacific 600 Ax Quality STOXX Asia/Pacific 600 Ax Low Risk STOXX Asia/Pacific 600 Ax
> Size STOXX Asia/Pacific 600 Ax **Multi-Factor** STOXX Japan 600 Ax Value STOXX Japan 600 Ax
> Momentum STOXX Japan 600 Ax Quality STOXX Japan 600 STOXX Japan 60...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>

---

### Multifactor Signal

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="18 mentions across STOXX & ISS pages (low)">▰▰ 18</span>


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

> [!example]- Source excerpts (5)
>
> Head of Factor and Quantitative Strategies, and Gimani Vidanagamage, Product Research and
> Development, Factor and Quantitative Strategies, unpicks the design of the indices by looking
> closely at the STOXX® U.S. Equity Factor index. Factor definitions The authors first explore the
> composition of the **Multifactor signal** (Figure 1), which, as report...
>
> — [A behind-the-scenes look at the STOXX Equity Factor indices | Blog posts | STOXX](https://stoxx.com/a-behind-the-scenes-look-at-the-stoxx-equity-factor-indices)
>
> This paper explores the design of the STOXX U.S. Equity Factor index and the **Multifactor
> signal** that lies at the core of the STOXX Equity Factor suite designed in collaboration with
> BlackRock. The STOXX Equity Factor indices were devised as core solutions that deliver
> above-average exposure to five factors — Quality, Value, Momentum, Small Size ...
>
> — [A behind-the-scenes look at the design of the STOXX U.S. Equity Factor index ...](https://stoxx.com/a-behind-the-scenes-look-at-the-design-of-the-stoxx-us-equity-factor-index)
>
> hey employ the institutionally tested analytics of Axioma Factor Risk Models. The STOXX Equity
> Factor indices are constructed by maximizing the index exposure to a multifactor alpha signal
> while adhering to a set of constraints intended to closely track their broad equity market parent
> indices. The **multifactor signal** is composed of the Momentum,...
>
> — [Monthly Index News October 2025 (PDF)](https://stoxx.com/monthly-index-news-october-2025)
>
> capture the different aspects and development stages of the targeted theme. This paper uses the AI
> theme to discuss thematic investing, and explore the identification of key subthemes and
> construction of thematic indices. This paper explores the design of the STOXX U.S. Equity Factor
> index and the **Multifactor signal** that lies at the core of the ...
>
> — [Whitepapers | STOXX](https://stoxx.com/post-type/whitepapers)
>
> nghal; and SimCorp’s Melissa Brown, analyze the performance of five single-factor portfolios and a
> multifactor one between March 2002 and June 2023. The authors consider two parent universes: the
> STOXX® USA 900 and STOXX® Global 1800 ex USA indices. They select an alpha signal (a single
> factor, the **multifactor signal**[1], or the individual compon...
>
> — [Multifactor strategies: Proving their worth in the factor investment landscap...](https://stoxx.com/multifactor-strategies-proving-their-worth-in-the-factor-investment-landscape)
>

---

## N

### Net Operating Assets (Changes in)

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="760 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 760</span>


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

> [!example]- Source excerpts (5)
>
> concept of a high-performance workplace has been endorsed by the U.S. Department of Labor and
> refers to a workplace that is designed to provide workers with the information, skills,
> incentives, and responsibility to make decisions essential for innovation, quality improvement and
> rapid response to changes in the marketplace. These standards embr...
>
> — [Public Fund Us Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2021/specialty/Public-Fund-US-Voting-Guidelines.pdf)
>
> et capitalization of entire markets, the liquidity requirements can be lowered or the period index
> review can be postponed to the next quarterly review date. In such cases, the composition remains
> unchanged, but new weighting factors will be implemented. Market participants will be notified of
> such changes in a timely manner. 4.4.2. TURNOVER RAT...
>
> — [Stoxx World Equity Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)
>
> The current eligible universe of contributing exchanges is available on the STOXX website. More
> information regarding procedures to select, add, or remove exchanges can be found in the following
> sections. 3.4.2. BASE EXCHANGE SCORE The Bitcoin Suisse Base Exchange Score (BES) is used to rank
> the exchanges in the Bitcoin Suisse Exchange Universe....
>
> — [Stoxx Digital Asset Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_digital_asset_guide.pdf)
>
> The IMA Principles55 advise that where remuneration committees seek to increase base pay, salary
> increases should not be approved purely on the basis of benchmarking against peer companies.
> Pension contribution payments for executives should be clearly disclosed. Any compensation to
> executives for changes in the tax treatment of pensions is not ...
>
> — [2015Ukandirelandproxyvotingguidelines (PDF)](https://www.issgovernance.com/file/policy/2015ukandirelandproxyvotingguidelines.pdf)
>
> sk. The relevance of climate transition risk means that “we are not going to come anywhere near
> meeting our climate goals just by decarbonizing our supply chains and buying offsets,” said David.
> “There is a much more fundamental transition. Policy and regulation will develop, there will be
> complete changes in the markets that we operate in, ther...
>
> — [STOXX WTW Climate Transition Indices: Replacing decarbonized portfolios with ...](https://stoxx.com/stoxx-wtw-climate-transition-indices-replacing-decarbonized-portfolios-with-portfolios-for-a-decarbonized-world)
>

---

## P

### Price Momentum

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="25 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 25</span>


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

> [!example]- Source excerpts (5)
>
> STOXX INDEX METHODOLOGY GUIDE 587/639 18. STOXX FACTOR INDICES The Momentum Factor is a composite
> of the following 3 Signals: Earnings Announcement Drift, Earnings Momentum, and **Price
> Momentum**.  Earnings Announcement Drift is given by the sum of idiosyncratic returns from the
> Axioma Risk Model on the most recent earnings announcement date and t...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> nk among the top 80% in the HDAX in terms of their free-float market capitalization, and among the
> top 80% for liquidity, measured in terms of their three-month ADTVs. This ensures that the index
> is highly liquid. Companies must also rank among the top 80% in the HDAX universe, measured in
> terms of **price momentum**, excluding companies with a past...
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> iSTOXX® METHODOLOGY GUIDE 374/1024 24. iSTOXX DYNAMIC STYLE INDICES • Earnings Revision o 3-month
> lookback FY1 earnings revision factor o 3-month lookback FY2 earnings revision factor o 3-month
> **price momentum** Composition list: The selection of stocks and the calculation of the weights of
> the iSTOXX USA Income Index are determined from an optimis...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> ly large and statistically significant alpha after controlling for stock momentum,” they added.
> AQR is an investment management firm based in Greenwich, Connecticut, with almost $200 billion
> under management; it is known for its applied research in investment strategies. Large and
> significant alpha **Price momentum** is the well-researched observati...
>
> — [Factor Performance Can Be Timed and Exploited, Study Finds Factor Performance...](https://stoxx.com/factor-performance-can-be-timed-and-exploited-study-finds-factor-performance-can-be-timed-and-exploited-study-finds)
>
> ing grown assets by an annual 20% in the previous five years.3 Indices have become more granular
> in their target and more innovative in their approach. Their constituency is no longer simply
> determined by each stock’s domicile — but instead by a wide menu of variables ranging from revenue
> source to **price momentum** to the number of female board me...
>
> — [The Index World and Twenty Years of Europe’s ETFs | STOXX](https://stoxx.com/the-index-world-and-twenty-years-of-europes-etfs)
>

---

## Q

### Quality Factor

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="62 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 62</span>


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

> [!example]- Source excerpts (5)
>
> 1 Focus on a quality track record Most recently, quality strategies gained traction following the
> subprime crisis that brought banks‘ poor financials to light and made stocks with solid accounts
> all the more attractive. Since then, quality strategies have proved quite successful. The iSTOXX®
> Europe **Quality Factor** Index, part of the iSTOXX® Europ...
>
> — [The Quality Factor | Blog posts | STOXX](https://stoxx.com/the-quality-factor)
>
> “Non-Ambitious Target”, then SBTI = 0; Otherwise, SBTI = -1. Signals are z-scored (apart from
> SBTI) using the Parent Index weights and outliers are truncated at +/- 3 standard deviations. For
> Carbon Emission Intensity in particular, values are z-scored relative to each stock’s ICB
> Supersector. The **Quality Factor** combines the Signals at 20%, 20%,...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> X NEWS / February 2021 Europe Factor Market Neutral Indices Key Points Four of the seven iSTOXX®
> Europe Factor Market Neutral Indices had a positive return during February. The indices hold a
> short position in STOXX Europe 600 futures to help investors neutralize systematic risk. The
> iSTOXX® Europe **Quality Factor** Market Neutral Index had the hig...
>
> — [Monthly Index News February 2021 (PDF)](https://stoxx.com/monthly-index-news-february-2021)
>
> iSTOXX® METHODOLOGY GUIDE 370/1024 24. iSTOXX DYNAMIC STYLE INDICES The discrete scores for the
> raw quality components are then aggregated41 to calculate the **Quality Factor** Score (e.g.
> Profitability Score, Earnings Quality Score etc.) and the **Quality Factor** Scores are then
> averaged to arrive at a final Value Quality Score. • Profitability o Free...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> (value factor) systematically beat the market and can better explain stock returns. Later on,
> additional sources of excess returns were uncovered. Nowadays, the generally accepted ones besides
> the classical market factor include the size, value, momentum, residual momentum, reversal, low
> risk, and **quality factor**s. Multi- and single-factor perfor...
>
> — [The Power of Factor Diversification | Blog posts | STOXX](https://stoxx.com/the-power-of-factor-diversification)
>

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

> [!example]- Source excerpts (5)
>
> k – Managing Director at APG Asset Management Using the iSTOXX World-A Index, a World Developed
> Markets Index, as the starting universe, the indices incrementally ‘layer in’ specific ESG filters
> (Exclusions, ESG Leaders, Carbon and SDI) allowing APG to measure and report on the impact on
> return and **risk budget** (measured by tracking error) for ea...
>
> — [APG and Qontigo Launch STOXX Family of Groundbreaking Responsible Indices: Bl...](https://stoxx.com/apg-and-qontigo-launch-stoxx-family-of-groundbreaking-responsible-indices)
>
> he construction of sustainability portfolios, Qontigo analysts Melissa Brown and Rob Stubbs look
> into the risk implications of a basic negative screening strategy. Importantly, they show that the
> use of an optimizer and a risk model in the process can help reduce active risk, freeing up more
> of the **risk budget** to increase the allocation to susta...
>
> — [Green efficient frontiers: Minimizing the risk impact of exclusions in sustai...](https://stoxx.com/green-efficient-frontiers-minimizing-the-risk-impact-of-exclusions-in-sustainable-portfolios)
>
> criteria and proprietary data; minimization of tracking error relative to the broad developed
> market by managing unintended bets including sector, country, and factor exposures that might
> emerge as an outcome of the sustainability targets; and the ability to measure and report on the
> impact of the **risk budget** on each of the ESG criteria or const...
>
> — [&quot;Layered&quot; Approach to ESG Results in Innovative Responsible Indices...](https://stoxx.com/layered-approach-to-esg-results-in-innovative-responsible-indices-for-apg)
>
> sure for its own sake. Our typical tracking error target of 1–2% helps ensure that the portfolio
> stays suitable for core allocations, while still aiming to deliver a persistent factor premium. In
> other words, it’s not about giving each factor the same weight — but rather giving them the
> appropriate **risk budget** within a diversified, long-term inv...
>
> — [Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX a...](https://stoxx.com/qa-with-blackrock-fourth-year-of-multifactor-collaboration-with-stoxx-amid-evolving-factor-investing-landscape)
>
> t of various layers of ESG investing on a global equities portfolio. The new suite consists of
> five indices (Figure 1), each one incrementally implementing a different ESG, carbon and
> Sustainable Development Investments (SDI) strategy and quantifying the resulting effect on a
> portfolio’s return and **risk budget**. The indices use Qontigo’s line of ...
>
> — [Qontigo’s Seegopaul and Gu: ‘iSTOXX APG Responsible Investment Indices Design...](https://stoxx.com/qontigos-seegopaul-and-gu-istoxx-apg-responsible-investment-indices)
>

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

> [!example]- Source excerpts (3)
>
> emia, stocks are selected using academically founded and widely recognized criteria. An aggregated
> score is calculated for each factor, and is used as the basis to select the top third of stocks to
> be included in each individual risk-premium portfolio. The weighting of the stocks is determined
> by a risk-parity approach, whereby each constituent ...
>
> — [Equity Risk Premia with Academic Foundation | Blog posts | STOXX](https://stoxx.com/equity-risk-premia-with-academic-foundation)
>
> d by Finreon. Based on relevant and scientifically proven ratios, the best stocks from the
> investment universe are selected for each factor premium — value, size, momentum, residual
> momentum, reversal, low risk and quality. Within these individual factor portfolios of the EURO
> STOXX Multi Premia, a risk-parity approach is used to weight the indi...
>
> — [Q&amp;A: Credit Suisse’s Froehlich on Multi-Premia Investing | Blog posts | S...](https://stoxx.com/qa-credit-suisses-froehlich-on-multi-premia-investing)
>
> vide a tool for investors seeking to capture a premium to the market’s move. Gianluca Oderda at
> Ersel Asset Management has argued that an optimal portfolio can be constructed by long positions
> in four non-market-cap-weighted schemes: a global minimum-variance portfolio, an equal-weight
> portfolio, a **risk parity** portfolio and a dividend-weighted p...
>
> — [What’s Behind the Edge in Equal-Weight Strategies? | Blog posts | STOXX](https://stoxx.com/whats-behind-the-edge-in-equal-weight-strategies)
>

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

> [!example]- Source excerpts (5)
>
> Factor investing has gained enormous traction in recent years as a transparent and low-cost way to
> exploit widely-acknowledged sources of market-excess returns, so-called **risk premia**. To
> complement our continuous effort in that space we have launched the EURO STOXX® Multi Premia® and
> Single Premium Indices, which integrate the academic research-...
>
> — [Equity Risk Premia with Academic Foundation | Blog posts | STOXX](https://stoxx.com/equity-risk-premia-with-academic-foundation)
>
> eptember and December, coinciding with the expiration of futures. Facilitating the access to
> **risk premia** Factor-based investing has become one of the most popular indexing segments in
> recent years. The new futures bring an innovative alternative to access the strategies, combining
> proven sources of **risk premia**, a transparent and state-of-the-art...
>
> — [Eurex to List Futures on STOXX Industry Neutral Ax Factor Indices | Blog post...](https://stoxx.com/eurex-to-list-futures-on-stoxx-industry-neutral-ax-factor-indices)
>
> AX Covered Call ATM index, designed to reflect a hypothetical portfolio invested in the DAX and
> that simultaneously sells a DAX ATM call traded at Eurex.1 Covered call strategies provide extra
> income to holders of the underlying asset from the proceeds of writing the option, offering an
> alternative **risk premia** from the monetization of volatility...
>
> — [Monthly Index News November 2025 (PDF)](https://stoxx.com/monthly-index-news-november-2025)
>
> STOXX INDEX METHODOLOGY GUIDE 572/639 1188.. STSOTOXXX XF AFACCTOTOR RIN INDDICICESE S STOXX
> FACTOR INDICES 18.1.1. OVERVIEW STOXX single and multi-factor indices aim to harvest the **risk
> premia** of several academically validated style factors – Value, Momentum, Quality, Size and Low
> Risk. At the same time the index rules ensure tradability and di...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> -compliant indices track the standard factor indices closely in terms of target factor exposure
> and performance. This is, firstly, because excluded stocks contribute only a small amount to the
> target factor exposures. Second, applying the methodology on a slightly narrower benchmark does
> not impede **risk premia** harvesting. Investors who prefer to...
>
> — [Combining ESG Screens and Factor Tilts: A Study on Portfolio Returns | Blog p...](https://stoxx.com/combining-esg-screens-and-factor-tilts-a-study-on-portfolio-returns)
>

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
---

### Size Factor

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="70 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 70</span>


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

> [!example]- Source excerpts (5)
>
> on in futures on the STOXX Europe 600, returned 1.4%. As markets recovered in April and May, the
> **size factor**’s outperformance has grown. The iSTOXX Europe **Size Factor** Index rose 8%
> between Apr. 1 and May 15, while the STOXX Europe 600 Index added 7.3%. The theory behind the size
> premium What is the size factor, anyway? The relationship between a...
>
> — [A Closer Look at the Size Factor | Blog posts | STOXX](https://stoxx.com/a-closer-look-at-the-size-factor)
>
> SDAX dividends are reinvested in the whole index portfolio rather than in the distributing stock
> as it happened earlier. The index is reviewed twice a year but goes through a quarterly so-called
> Fast Exit/Fast Entry review to account for significant changes in companies’ market
> capitalization. The **size factor** To many investors, small-caps are th...
>
> — [Exploring SDAX, the benchmark for German small companies | Blog posts | STOXX](https://stoxx.com/exploring-sdax-the-benchmark-for-german-small-companies)
>
> iSTOXX® METHODOLOGY GUIDE 266/1024 10. iSTOXX MUTB INDICES 𝛽𝑎𝑑̂𝑗𝑀𝑜𝑚 𝑖=1 𝑠̂𝑖𝑧𝑒 𝑖=1 𝐵̂𝑃𝑅 𝑖=1 𝜀 𝑖=1 (
> ⋮ )= 𝛽 ( ⋮ )+𝛽 ( ⋮ )+𝛼∗+( ⋮ ) 𝑠𝑖𝑧𝑒 𝐵𝑃𝑅 𝛽𝑎𝑑̂𝑗𝑀𝑜𝑚 𝑖=𝑁 𝑠̂𝑖𝑧𝑒 𝑖=𝑁 𝐵̂𝑃𝑅 𝑖=𝑁 𝜀 𝑖=𝑁 where 𝛽 ̂𝑀𝑜𝑚 :
> standardized 12-month momentum adjusted with market beta factor of stock i 𝑎𝑑𝑗 𝑖 𝑠̂𝑖𝑧𝑒 :
> standardized **size factor** of stock i 𝑖 𝐵̂𝑃𝑅 : standardized BPR of st...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> January 2019 EURO STOXX® Multi Premia® and Single Premium Indices Key points Five of the eight
> EURO STOXX® Multi Premia® and Single Premium Indices outperformed the market during January.
> Again, it was the **size factor** – which seeks to exploit the ‘small-cap’ premium – that
> performed best during the month among the index family. The indices integ...
>
> — [Monthly Index News January 2019 (PDF)](https://stoxx.com/monthly-index-news-january-2019)
>
> methodology used for dividends reinvested net of withholding taxes; determining the benchmark can
> no - they are calculated on individual countries and longer be ensured, such as when the regional
> combinations of countries; administrator deems the liquidity in the - they are calculated
> according to **size factor**s, underlying market as insufficient;...
>
> — [Dax Equity Index Family Benchmark Statement (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Resources/Regulation/DAX_Equity_Index_Family_Benchmark_Statement.pdf)
>

---

### Smart Beta

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="84 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 84</span>


> An umbrella term for rules-based index strategies that deviate from
> traditional market-capitalization weighting in pursuit of improved risk-adjusted
> returns, lower risk, or enhanced diversification. STOXX's smart beta suite
> includes factor indices, risk-based indices (minimum variance, maximum
> diversification, equal risk contribution), and alternatively weighted indices
> (equal weight, fundamental weight).

In plain terms, smart beta sits between passive index investing and active management. You still follow transparent rules (like an index), but those rules are designed to be "smarter" than simply weighting by company size — for example, weighting by cheapness or equal risk.

> [!tip] Related terms
> [[#Factor Investing]], [[#Factor-Based Index]], [[#Risk Premia]]

> [!example]- Source excerpts (5)
>
> In “An Aussie sense of style”, Axioma’s latest paper on **smart beta** products, we take a look at
> the inherent compromise between delivering target factor purity versus maximizing factor exposure.
> The decision has to be made at the portfolio construction stage and constraints are the weapon of
> choice in this battle for investment compliance. Armed ...
>
> — [Smart Beta versus Dumb Alpha | Blog posts | STOXX](https://stoxx.com/smart-beta-versus-dumb-alpha)
>
> A new Qontigo report1 takes a comprehensive look at the market for ‘**smart beta**’ funds tracking
> factor strategies, to assess their prowess in boosting returns and their capacity as money inflows
> grow. The study by Frank Siu, Executive Director of Quantitative and Multi-Asset Solutions at
> Qontigo, looked at exchange-traded funds (ETFs) tracking eq...
>
> — [Study Shines Light on Smart Beta’s Effectiveness and Capacity | Blog posts | ...](https://stoxx.com/study-shines-light-on-smart-betas-effectiveness-and-capacity)
>
> Zurich/Singapore (April 30, 2018) – STOXX Ltd., the operator of Deutsche Boerse Group’s index
> business and a global provider of innovative and tradable index concepts, has been recognized as
> 2018’s “Best **Smart Beta** Index Provider, Asia-Pacific” by Structured Retail Products (SRP).
> This is the first time STOXX Ltd. has received this award. The aw...
>
> — [STOXX Awarded “Best Smart Beta Index Provider, Asia-Pacific” By SRP | Press r...](https://stoxx.com/stoxx-awarded-best-smart-beta-index-provider-asia-pacific-by-srp)
>
> ection of assets, index choice and static factor exposure.2 That means that when an investor picks
> an ETF, not only are they buying an entire market — they are also actively choosing an asset
> class, geography, an index methodology, a style and a factor exposure and the timing of the
> purchase. Enter **smart beta** The menu of index choices has also b...
>
> — [The Index World and Twenty Years of Europe’s ETFs | STOXX](https://stoxx.com/the-index-world-and-twenty-years-of-europes-etfs)
>
> STOXX LIMITED 7 STOXX MINIMUM VARIANCE INDICES 2 Characteristics of a minimum variance portfolio
> (MVP) There is a common misconception that minimum variance indices are just another “**smart
> beta**” product, but we would argue differently. Most indices can be used as building blocks as
> part of a greater portfolio and need to be used as such, being u...
>
> — [Stoxx Minvar Paper (PDF)](http://www.stoxx.com/document/Others/marketing/STOXX_MinVar_Paper.pdf)
>

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

> [!example]- Source excerpts (1)
>
> till get others that come along for the ride. That’s good news as well.” A limited tracking error
> is almost a universal demand of investors, but this may change over time, DWS’ Schiele said. “As
> investors become more comfortable with a particular topic, they will also, over time, allow for a
> higher **tracking error budget**” in their bespoke solutio...
>
> — [Navigating Europe’s equities and sustainable investing landscape  | Blog post...](https://stoxx.com/navigating-europes-equities-and-sustainable-investing-landscape)
>

---

### Turnover Constraint

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="14 mentions across STOXX & ISS pages (low)">▰▰ 14</span>


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

> [!example]- Source excerpts (5)
>
> STOXX INDEX METHODOLOGY GUIDE 298/639 16. STOXX RISK BASED INDICES For the tracking error
> constrained version it is defined as: H ≥H ∙60%
> (cid:2897)(cid:2919)(cid:2924)(cid:2906)(cid:2911)(cid:2928)
> (cid:2886)(cid:2911)(cid:2929)(cid:2915) Maximum turnover The Unconstrained version has a 5%
> one-way **turnover constraint**, or 10% two-way. This means...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> STOXX INDEX METHODOLOGY GUIDE 298/639 16. STOXX RISK BASED INDICES For the tracking error
> constrained version it is defined as: H ≥H ∙60%
> (cid:2897)(cid:2919)(cid:2924)(cid:2906)(cid:2911)(cid:2928)
> (cid:2886)(cid:2911)(cid:2929)(cid:2915) Maximum turnover The Unconstrained version has a 5%
> one-way **turnover constraint**, or 10% two-way. This means...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> Combining factors with low correlations to each other can offer diversification benefits and a
> potentially smoother investment profile over time. Figure 1: Components of the Multifactor signal
> in the STOXX Equity Factor indices Risk premium The paper reviews the risk management,
> diversification and **turnover constraint**s built into the index metho...
>
> — [A behind-the-scenes look at the STOXX Equity Factor indices | Blog posts | STOXX](https://stoxx.com/a-behind-the-scenes-look-at-the-stoxx-equity-factor-indices)
>
> chmark at 5% and limit the tracking error to a maximum of 5%. Other constraints are employed to
> ensure liquidity and tradability. There is a minimum weighted average days-to-trade ratio
> threshold for securities to avoid material build-ups in illiquid positions. The indices also have
> a 12.5% one-way **turnover constraint** per quarter, meaning that a...
>
> — [Eurex to List Futures on STOXX Industry Neutral Ax Factor Indices | Blog post...](https://stoxx.com/eurex-to-list-futures-on-stoxx-industry-neutral-ax-factor-indices)
>
> ruary 2019: Addition of EURO iSTOXX ESG Leaders 50 GR Decrement 5% Index, EURO iSTOXX ESG Leaders
> 50 NR Decrement 5% Index and EURO iSTOXX 50 GR Decrement 3.75% Index » February 2019 (2): Addition
> of iSTOXX Developed and Emerging Markets ex USA PK VN Real Estate Index » February 2019 (3):
> Change of **turnover constraint** and quality filter for both...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>

---

## V

### Value Factor

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="85 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 85</span>


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

> [!example]- Source excerpts (5)
>
> Bound, the normalized ratio is set to -4 - with fundamental ratios not available, the normalized
> ratio is set to -4 After normalization, for each stock i, a composite **value factor** is
> calculated as an average of the three normalized fundamental ratio as follows: (B̂PR +ÊPR +ĈFPR
> ) i i i Composite **value factor** = i 3 After applying the screening,...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> MONTHLY INDEX NEWS / July 2021 Europe Factor Market Neutral Indices Key Points The **Value
> factor** was a strong underperformer among the iSTOXX® Europe Factor Market Neutral Indices, which
> assume a short position in STOXX Europe 600 futures to help investors neutralize systematic risk.
> The indices are designed to offer exposure to pure factor inves...
>
> — [Monthly Index News July 2021 (PDF)](https://stoxx.com/monthly-index-news-july-2021)
>
> .9% in the US currency and 0.1% in euros. Travel & Leisure hit All but two of 20 Supersectors in
> the STOXX Global 1800 declined in the month. The STOXX® Global 1800 Travel & Leisure Index
> (-8.7%)3 yielded the widest loss. At the other end, the STOXX® Global 1800 Technology Index gained
> 3%. Size and **Value factor**s post heavy losses Most factor-bas...
>
> — [Stocks drop in November amid emergence of Omicron virus variant | Blog posts ...](https://stoxx.com/stocks-drop-in-november-amid-emergence-of-omicron-virus-variant)
>
> STOXX INDEX METHODOLOGY GUIDE 595/639 18. STOXX FACTOR INDICES each stock’s ICB Supersector. The
> Quality Factor combines the Signals at 20%, 20%, 20%, 20%, 13%, and 7% weights, respectively, and
> is again z-scored and truncated. The **Value Factor** is a composite of the following 5 Signals:
> Book to Price, Cash Flow Yield, Time Series Normalized Cash...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> OXX® Europe **Value Factor** Market Neutral Index has had poorer results in the past 12 months.
> The iSTOXX® Europe Size Factor Market Neutral Index had the best performance during January,
> rising nearly 1%, its best monthly showing since December 2017. The market-neutral gauges tracking
> the quality and **value factor**s also rose during the month. Overa...
>
> — [Monthly Index News January 2019 (PDF)](https://stoxx.com/monthly-index-news-january-2019)
>

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

> [!example]- Source excerpts (1)
>
> AC. The AI index has its largest positive active exposures in the Market Sensitivity, Volatility
> and Liquidity factors, while also being more exposed to the Medium-Term Momentum and Growth
> factors. Negative active exposures include those to the Dividend Yield, Exchange Rate Sensitivity
> and Earnings **Yield factor**s. Figure 8: Active style-factor ex...
>
> — [The AI revolution is taking place now – a look inside the STOXX Global Artifi...](https://stoxx.com/the-ai-revolution-is-taking-place-now-a-look-inside-the-stoxx-global-artificial-intelligence-index)
>

---

> [!note] Methodology Disclaimer
> The definitions, formulas, and descriptions above are synthesized from publicly
> available STOXX and Qontigo methodology guides and research. For authoritative
> and up-to-date specifications, always consult the official rulebook for each
> specific index at [stoxx.com](https://stoxx.com/).
