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

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="23 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 23</span>


> The non-cash component of reported earnings, computed as the difference between
> net income and operating cash flow, scaled by total assets. In STOXX factor
> indices, high accruals are treated as a **negative quality signal** — firms with
> lower accruals are considered higher quality because their earnings are backed
> by real cash flows.

accruals measure how much of a company's reported profit is "paper profit" versus actual cash received. Companies where earnings mostly come from cash are viewed as higher quality because paper profits can be reversed or manipulated.

$$
\text{Accruals Ratio} = \frac{\text{Net Income} - \text{Operating Cash Flow}}{\text{Total Assets}}
$$

> [!tip] Related terms
> [Quality Factor](#quality-factor), [Net Operating Assets (Changes in)](#net-operating-assets-changes-in), [Alpha Signal](#alpha-signal)

> [!example]- Source excerpts (5)
>
> The ratio is calculated as Cash Flow from Operation (CFO) divided by total assets cash flow from
> operation CFO Ratio = t0 t0 total assets t0 - **Accruals** less than or equal to zero.
> **Accruals** are calculated as ROA minus CFO Ratio Accruals =ROA −CFO Ratio t0 t0 t0 - Positive or
> zero 1-year growth in ROA
>
> — [Istoxx Index Guide (PDF), p. 75](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> ractice, as it is generally expected that dividend payments only apply to vested shares. ISS
> already evaluates the provision of dividend payments and **accruals** on vested incentive awards
> in South Africa. The level of disclosure of companies' policies on dividend payments and
> **accruals** is growing.
>
> — [Israel And South Africa Policy Updates (PDF), p. 20](https://www.issgovernance.com/file/policy/2021/updates/Israel-and-South-Africa-Policy-Updates.pdf)
>
> weights, respectively, and is again z-scored and truncated at +/-3 standard deviations. The
> Quality Factor is a composite of the following 6 Signals: **Accruals**, Dilution, Gross
> Profitability, Change in Net Operating Assets (NOA), Carbon Emissions Intensity, and Science Based
> Targets (SBTI).  **Accruals** is giv
>
> — [Stoxx Index Guide (PDF), p. 587](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> market-cap-weighted flagship index such as the EURO STOXX 50 Index, you have a matching futures
> market to equitize cash. How do you equitize dividend **accruals** in the case of the CSIF (Lux)
> Equity EURO STOXX Multi Premia fund? As there are no perfectly-matching futures for this strategy,
> the fund uses EURO S
>
> — [Q&amp;A: Credit Suisse’s Froehlich on Multi-Premia Investing | Blog posts | S...](https://stoxx.com/qa-credit-suisses-froehlich-on-multi-premia-investing)
>
> on in definitions is substantially largerfor quality,’ according to a 2016 study.3The paper’s
> authors found that definitions range from low levels of **accruals**, gross profitability and low
> investments to bottom-line profitability measures such as return-on-equity and margins. Behind the
> iSTOXX Europe Quality
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

this is a guardrail that prevents a smart beta index from accidentally becoming a sector bet. If technology is 20% of the benchmark, the factor index might hold between 15% and 25% in technology — but never 40%.

> [!tip] Related terms
> [Industry Neutral](#industry-neutral), [Capping Constraint](#capping-constraint), [Tracking Error Budget](#tracking-error-budget)

> [!example]- Source excerpts (4)
>
> tended sector exposures. The STOXX® Industry Neutral Ax Factor Indices implement the same
> methodology of the STOXX® Factor Indices while reducing the **active industry constraint** from
> +/- 5% to near neutral. The STOXX Factor Indices and STOXX Industry Neutral Ax Factor Indices rely
> on proven factor models and seek precise expo
>
> — [Industry Neutral Factor Indices | STOXX](https://stoxx.com/industry-neutral-factor-indices)
>
> OXX Industry Neutral Ax Factor Indices were introduced in February and implement the same
> methodology of the STOXX® Factor Indices while reducing the **active industry constraint** from
> +/- 5% to near neutral. In all but eliminating industry deviations, the STOXX Industry Neutral Ax
> Factor Indices may sacrifice some factor expos
>
> — [Eurex to List Futures on STOXX Industry Neutral Ax Factor Indices | Blog post...](https://stoxx.com/eurex-to-list-futures-on-stoxx-industry-neutral-ax-factor-indices)
>
> It may also be useful to highlight that the STOXX Industry Neutral Ax Factor Indices are versions
> of the standard STOXX Factor Indices that limit the **active industry constraint** from +/- 5% to
> near neutral. This was one of the feedbacks from the joint market consultation with Eurex, where
> potential investors favored sacrifici
>
> — [Q&amp;A: What do Eurex’s new futures on STOXX Factor Indices offer? | Blog po...](https://stoxx.com/qa-what-do-eurexs-new-futures-on-stoxx-factor-indices-offer)
>
> ed risk exposures. The STOXX® Industry Neutral Factor Indices (Table 1) implement the same
> methodology of the STOXX Factor Indices while reducing the **active industry constraint** from +/-
> 5% to near neutral. In all but eliminating the overall industry deviations, the STOXX Industry
> Neutral Factor Indices may sacrifice some fac
>
> — [The diversification benefits of a multi-factor approach: the STOXX Europe 600...](https://stoxx.com/the-diversification-benefits-of-a-multi-factor-approach-the-stoxx-europe-600-industry-neutral-ax-multi-factor-index)
>

---

> [!quote]
> "The search for alpha is the oldest quest in finance."
> — **Eugene Fama**

### Alpha Signal

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="63 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 63</span>


> A quantitative score assigned to each security that predicts relative future
> returns. In STOXX multi-factor indices, the alpha signal is a composite z-score
> constructed by combining individual factor signals (e.g., value, momentum,
> quality) into a single ranking metric used during portfolio optimization.

an alpha signal is the "master score" that tells the index which stocks should be overweighted and which should be underweighted. It is the numerical translation of the factor thesis into an actionable ranking.

$$
\alpha_i = \sum_{k=1}^{K} w_k \cdot z_{i,k}
$$

where $z_{i,k}$ is the standardized score for security $i$ on factor $k$, and $w_k$ is the factor weight.

> [!tip] Related terms
> [Multifactor Signal](#multifactor-signal), [Factor Tilt](#factor-tilt), [Factor (Definition)](#factor-definition)

> [!example]- Source excerpts (5)
>
> Ang. “We continuously want to push the definitions of these factors.” Other ESG signals An
> additional example of a climate **alpha signal** can be found in companies with the most
> LEED-certified,2 or carbon-efficient, buildings.
>
> — [BlackRock’s Ang on sustainability alpha signals: ESG and factors as ‘best fri...](https://stoxx.com/blackrocks-ang-on-sustainability-alpha-signals-esg-and-factors-as-best-friends)
>
> Values are z-scored and truncated at +/- 3 standard deviations. Individual signal z-scores are set
> to 0 where data is missing. The Multi-Factor **Alpha Signal** is created by combining the
> following Factors with respective weights per index: STOXX INDEX METHODOLOGY GUIDE 589/639 18.
>
> — [Stoxx Index Guide (PDF), p. 588](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> Furthermore, these indices are expected to outperform their parent indices by using **alpha
> signal**s based on multiple measures associated with climate transition. Universe: The indices are
> derived from their parent indices as described below Index
>
> — [Istoxx Index Guide (PDF), p. 313](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> resentation, as panelists highlighted the importance of basing investment decisions on reliable
> information and eliminating the risk of greenwashing. **Alpha signal** A recent Qontigo
> whitepaper1 looked into the effectiveness of the SDI AOP’s SDI Innovation Outlook score in
> predicting equity returns.
>
> — [Asset-owner panel discusses drivers, merits of integrating SDGs into investme...](https://stoxx.com/asset-owner-panel-discusses-drivers-merits-of-integrating-sdgs-into-investment-portfolios)
>
> ) intensity relative to the parent benchmark. The indices’ methodology follows an optimization
> process that maximizes the allocation to a multifactor **alpha signal**, while satisfying a set of
> constraints to avoid unintended and uncompensated bets, and control for active risk.
>
> — [iShares adopts STOXX indices to underlie EMEA multifactor ETFs with exclusion...](https://stoxx.com/ishares-adopts-stoxx-indices-to-underlie-emea-multifactor-etfs-with-exclusionary-screens)
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

capping stops any one stock from dominating the index. Even if a factor model loves a particular stock, the cap limits its weight so that a blow-up in that single name does not destroy the whole portfolio.

> [!tip] Related terms
> [Security Weight Cap](#security-weight-cap), [Active Industry Constraint](#active-industry-constraint), [Turnover Constraint](#turnover-constraint)

> [!example]- Source excerpts (3)
>
> Developed Markets ex USA, Emerging Markets) January 2021: Clarification of rules for STOXX Minimum
> Variance and STOXX Factor indices regarding weight **capping constraint**s February 2021: Change
> of review cut-off date for STOXX Global Infrastructure indices. February 2021 (2): Addition of
> STOXX Industry Neutral Factor I
>
> — [Stoxx Index Guide (PDF), p. 16](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> Developed Markets ex USA, Emerging Markets) January 2021: Clarification of rules for STOXX Minimum
> Variance and STOXX Factor indices regarding weight **capping constraint**s February 2021: Change
> of review cut-off date for STOXX Global Infrastructure indices. February 2021 (2): Addition of
> STOXX Industry Neutral Factor I
>
> — [Stoxx Index Guide (PDF), p. 16](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> The sum of the weights of those issuers above 4.5% cannot exceed 35%. If the parent index itself
> does not satisfy the individual issuer **capping constraint**s those are not enforced on the
> corresponding child indices. Active Issuer Constraint: The maximum active issuer weight is 1%.
> Active Share Constraint
>
> — [Istoxx Index Guide (PDF), p. 685](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>

---

> [!quote]
> "The CAPM is the E=mc squared of finance."
> — **Eugene Fama**

### Capital Asset Pricing Model (CAPM)

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1 mentions across STOXX & ISS pages (ultra-low)">▰ 1</span>


> A foundational equilibrium model asserting that the expected excess return of a
> security is proportional to its systematic risk (beta) relative to the market
> portfolio. In the STOXX framework, CAPM provides the theoretical baseline
> against which factor premia are measured — factors like value, momentum, and
> quality represent returns unexplained by CAPM's single market factor.

CAPM says the only risk you get paid for is market risk. If a stock moves 1.2× as much as the market, you should earn 1.2× the market's excess return — nothing more. Factor investing exists precisely because CAPM's prediction is too simple: other characteristics (cheapness, momentum, quality) also predict returns.

$$
E[R_i] - R_f = \beta_i \cdot (E[R_m] - R_f)
$$

where $R_f$ is the risk-free rate, $R_m$ is the market return, and $\beta_i = \frac{\text{Cov}(R_i, R_m)}{\text{Var}(R_m)}$.

> [!tip] Related terms
> [Factor (Definition)](#factor-definition), [Risk Premia](#risk-premia), [Low Risk Factor](#low-risk-factor)

> [!example]- Source excerpts (1)
>
> In recent years, however, academia has shifted its focus to the explanation of the so-called low
> volatility factor. The traditional **Capital Asset Pricing Model (CAPM)** explains asset returns
> in excess of the risk-free rate as compensation for systematic, i.e. non-diversifiable, risk[3].
>
> — [The low volatility premium – An analysis of factor exposures of minimum varia...](https://stoxx.com/the-low-volatility-premium-an-analysis-of-factor-exposures-of-minimum-variance-strategies-blog)
>

---

### Carry Factor

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="19 mentions across STOXX & ISS pages (low)">▰▰ 19</span>


> A factor that captures the return earned from holding higher-yielding assets
> against lower-yielding ones, independent of price appreciation. In equities,
> STOXX carry strategies typically rank securities by dividend yield or
> shareholder yield (dividends plus buybacks minus issuance), overweighting those
> offering the highest expected income return.

carry is about getting paid to hold an asset. A stock with a 5% dividend yield "carries" better than one with 1%. The carry factor systematically tilts toward these high-income names, earning returns from the yield itself rather than betting on price changes.

$$
\text{Carry}_i = \frac{D_i}{P_i}
$$

where $D_i$ is the expected annual dividend and $P_i$ is the current price. More sophisticated versions include net buyback yield.

> [!tip] Related terms
> [Value Factor](#value-factor), [Yield Factor](#yield-factor), [Factor (Definition)](#factor-definition)

> [!example]- Source excerpts (5)
>
> The other only index in the family to have fallen in eight of the nine months so far in 2019 is
> the iSTOXX® Europe **Carry Factor** Market Neutral Index. For the whole of 2019, the iSTOXX®
> Europe Size Factor Market Neutral Index shows the worst performance — an 8.6% retreat. The i
>
> — [Monthly Index News September 2019 (PDF), p. 7](https://stoxx.com/monthly-index-news-september-2019)
>
> The index offers exposure to stocks that appear undervalued relative to earnings and cash flow. At
> the other end, the iSTOXX® Europe **Carry Factor** Market Neutral Index, which targets cheap
> stocks with high growth potential based on earnings and dividends, added 1.4%. The iSTOXX Europe
> Factor Mar
>
> — [Monthly Index News February 2020 (PDF), p. 7](https://stoxx.com/monthly-index-news-february-2020)
>
> hold a short position in STOXX Europe 600 futures to help investors neutralize systematic risk,
> had positive returns during August The iSTOXX® Europe **Carry Factor** Market Neutral Index was
> the month’s best performer after adding 1.4% on a net-return basis.
>
> — [Monthly Index News August 2020 (PDF), p. 23](https://stoxx.com/monthly-index-news-august-2020)
>
> tures on the STOXX Europe 600, posted losses. Increased bullishness may have been behind a style
> rotation among factor strategies. The iSTOXX® Europe **Carry Factor** Market Neutral Index, which
> beat all other five strategies in the iSTOXX® Europe Factor Indices in the previous month, fell
> 1.8%.
>
> — [Monthly Index News July 2018 (PDF), p. 3](https://stoxx.com/monthly-index-news-july-2018)
>
> m to have fallen out of favor with investors, perhaps reflecting their concerns about the pace of
> global expansion. By comparison, the iSTOXX® Europe **Carry Factor** Market Neutral Index is
> cementing its position as the leading factor in the past year.
>
> — [Monthly Index News June 2018 (PDF), p. 3](https://stoxx.com/monthly-index-news-june-2018)
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

the defensive factor is for investors who want to stay in equities but sleep at night. It picks "fortress" companies — profitable, conservatively financed, and not prone to wild price swings — that tend to fall less when markets crash.

$$
\text{Defensive}_i = \frac{1}{3}\left(z_{\text{low vol},i} + z_{\text{quality},i} + z_{\text{low leverage},i}\right)
$$

> [!tip] Related terms
> [Low Risk Factor](#low-risk-factor), [Quality Factor](#quality-factor), [Low Volatility Factor](#low-volatility-factor)

> [!example]- Source excerpts (2)
>
> r. The Small Size factor, for its part, is a high beta, pro-cyclical factor, relative to the Low
> Volatility factor, which is low beta and a much more **defensive factor**. Those are opposing
> factors pulling in opposite directions. And so, they each have a 5% weight so that we’re not
> moving too far away from the core.”
>
> — [BlackRock’s Jamie Forbes: Implementing ‘evolutionary’ factor advancements in ...](https://stoxx.com/blackrocks-jamie-forbes-implementing-evolutionary-factor-advancements-in-investments)
>
> ven downturn. Chart 1 Sources of out/underperformance will be explored later in this post, but we
> observe some results that match intuition. The more **defensive factor**s (Low Risk and Quality)
> had the strongest post-crisis returns. On the other hand, ‘riskier’ factors, such as Value and
> Size, had significant drawdown
>
> — [STOXX Factor Indices – Q1 2020 Review | STOXX](https://stoxx.com/stoxx-factor-indices-q1-2020-review)
>

---

### Dilution

<span style="background:red; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1,626 mentions across STOXX & ISS pages (high)">▰▰▰▰▰▰ 1,626</span>


> In the STOXX quality framework, dilution captures the change in a company's
> share count over time. Companies that consistently issue new shares dilute
> existing shareholders' ownership and are penalized in quality scoring. The
> signal is measured as the year-over-year percentage change in total shares
> outstanding.

dilution means a company is printing new shares — which shrinks your slice of the pie. STOXX's quality indices treat heavy share issuance as a red flag for governance and capital allocation discipline.

$$
\text{Dilution}_t = \frac{\text{Shares Outstanding}_t - \text{Shares Outstanding}_{t-1}}{\text{Shares Outstanding}_{t-1}}
$$

> [!tip] Related terms
> [Quality Factor](#quality-factor), [Accruals](#accruals), [Net Operating Assets (Changes in)](#net-operating-assets-changes-in)

> [!example]- Source excerpts (5)
>
> ury or purchased on the open market, shareholder approval will be required and ISS will assume
> that the plan is funded by treasury shares. 27. How is **dilution** calculated? For purposes of
> the **dilution** scoring factor, dilution is calculated as the sum of a plan's A, B, and C shares
> (as defined above with resp
>
> — [Canadian Equity Plan Scorecard Faq (PDF), p. 14](https://www.issgovernance.com/file/policy/2018/americas/Canadian-Equity-Plan-Scorecard-FAQ.pdf)
>
> However, when companies make issuances without preemptive rights, shareholders experience
> **dilution** of their economic interest and voting rights. Therefore, to protect shareholders from
> potentially excessive **dilution**, widely- accepted best practice
>
> — [6 2017 Comment Period Template Europe General Share Issuance Request Proposals (PDF), p. 1](https://www.issgovernance.com/file/policy/6-2017-comment-period-template-europe-general-share-issuance-request-proposals.pdf)
>
> , exercise period, exercise price, and performance hurdles (if any). While **dilution** is an
> important factor in evaluating options, Japanese companies' **dilution**, particularly at large
> companies, has been modest. As such, this is seldom an issue.
>
> — [2013Issjapanguidelinessummaryrev01312013 (PDF), p. 16](https://www.issgovernance.com/file/2013-policies/2013ISSJapanGuidelinesSummaryRev01312013.pdf)
>
> When evaluating equity-based compensation items on ballot, the following elements will be
> considered: Primary Considerations: › **Dilution**: Vote against plans in which the potential
> voting power **dilution** (VPD) of all shares outstanding exceeds fifteen percent. Enabling the
> financial comm
>
> — [2015 Us Public Fund Guidelines (PDF), p. 27](https://www.issgovernance.com/file/policy/2015-us-public-fund-guidelines.pdf)
>
> Policy Recommendation: Vote case-by-case on proposals regarding private placements, warrants, and
> convertible debentures taking into consideration: › **Dilution** to existing shareholders'
> position: The amount and timing of shareholder ownership **dilution** should be weighed against
> the needs and proposed sharehol
>
> — [2017 Sustainability Us Voting Guidelines (PDF), p. 37](https://www.issgovernance.com/file/policy/2017-sustainability-us-voting-guidelines.pdf)
>

---

## E

> [!quote]
> "Diversification is the only free lunch in investing."
> — **Harry Markowitz**

### Efficient Frontier

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="16 mentions across STOXX & ISS pages (low)">▰▰ 16</span>


> The set of portfolios that offer the highest expected return for each level of
> risk (standard deviation), forming a curved boundary in mean-variance space.
> STOXX risk-based indices — minimum variance, maximum diversification, and
> equal risk contribution — can be understood as targeting specific points on or
> near the efficient frontier under different objective functions and constraints.

the efficient frontier is the "best you can do" curve. Every portfolio on it is optimal: you cannot get more return without taking more risk, and you cannot reduce risk without giving up return. Portfolios below the curve are inefficient — they leave free performance on the table.

$$
\max_{w} \; E[R_p] \quad \text{s.t.} \quad \sigma_p = \sigma^*, \; \sum_i w_i = 1, \; w_i \geq 0
$$

Tracing out all $\sigma^*$ values produces the frontier.

> [!tip] Related terms
> [Mean-Variance Optimization](#mean-variance-optimization), [Minimum Variance](#minimum-variance), [Maximum Diversification](#maximum-diversification)

> [!example]- Source excerpts (5)
>
> and find out more about the active risk, active variance analysis and comparative returns of an
> optimized exclusions portfolio, click here. 1 ‘Green **efficient frontier**s. Part 1: Minimizing
> the risk impact of exclusions,’ Qontigo, March 2023.
>
> — [Green efficient frontiers: Minimizing the risk impact of exclusions in sustai...](https://stoxx.com/green-efficient-frontiers-minimizing-the-risk-impact-of-exclusions-in-sustainable-portfolios)
>
> “With the appropriate solution, we aim to help them reach the optimal spot on their new
> **efficient frontier** of impact, risk and returns.” Our DNA and philosophy Qontigo’s ESG
> framework offers access to curated databases that allow for cutting-edge index cre
>
> — [Qontigo’s ‘Enhance’ sustainable index category – optimizing ESG investing | B...](https://stoxx.com/qontigo-esg-enhance-sustainability-index-category)
>
> In diagrammatic terms, the MVP is found at the very left tip of a mean- variance **efficient
> frontier** of feasible portfolios, as shown in Figure 1. FIGURE 1: **EFFICIENT FRONTIER** OF
> FEASIBLE PORTFOLIOS. No expected returns are used in the construction o
>
> — [Stoxx Minvar Paper (PDF), p. 5](http://www.stoxx.com/document/Others/marketing/STOXX_MinVar_Paper.pdf)
>
> Research Director of the SDI AOP, discusses the latest platform developments led by its
> asset-owner led community. Index | ESG & Sustainability Green **efficient frontier**s: Minimizing
> the risk impact of exclusions in sustainable portfolios A new whitepaper from Qontigo’s research
> team explores the benefits of construct
>
> — [Portfolio Construction | STOXX](https://stoxx.com/category/portfolio-construction)
>
> “The traditional risk-and-return framework is outdated. It needs to be updated with a third
> dimension: societal impact. Therefore, new **efficient frontier**s within these three dimensions
> will have to be defined by investors.” The panel’s topic was ‘Intelligent ESG,’ and participants
> debated whether susta
>
> — [Sustainability Impact of Investments Calls for Redefined View of Asset Manage...](https://stoxx.com/sustainability-impact-of-investments-calls-for-redefined-view-of-asset-management-says-qontigos-bocquet)
>

---

### Earnings Announcement Drift

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="9 mentions across STOXX & ISS pages (low)">▰▰ 9</span>


> The empirically documented tendency for stock prices to continue moving in the
> direction of an earnings surprise for weeks or months after the announcement
> date. STOXX momentum and quality indices may exploit this anomaly by
> incorporating post-announcement return signals into their composite scores.

when a company reports earnings that beat (or miss) expectations, the stock tends to keep drifting in the same direction — the market digests the news slowly. Factor indices can capture this drift by tilting toward recent positive surprises.

> [!tip] Related terms
> [Earnings Momentum](#earnings-momentum), [Price Momentum](#price-momentum), [Momentum Factor](#momentum-factor)

> [!example]- Source excerpts (3)
>
> The Factors are combined to create a Multi-Factor Alpha Signal, as described below. The Momentum
> Factor is a composite of the following 3 Signals: **Earnings Announcement Drift**, Earnings
> Momentum, and Price Momentum.  **Earnings Announcement Drift** is given by the sum of
> idiosyncratic returns from the Axioma Risk Model on the
>
> — [Stoxx Index Guide (PDF), p. 593](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> The Factors are combined to create a Multi-Factor Alpha Signal, as described below. The Momentum
> Factor is a composite of the following 3 Signals: **Earnings Announcement Drift**, Earnings
> Momentum, and Price Momentum.  **Earnings Announcement Drift** is given by the sum of
> idiosyncratic returns from the Axioma Risk Model on the
>
> — [Stoxx Index Guide (PDF), p. 593](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> to a multifactor signal created from the following five factors: Momentum The momentum score is
> calculated from price momentum, earnings momentum and **earnings announcement drift** (i.e., the
> difference between a stock’s performance on and immediately following an earnings announcement
> date). Quality The quality score is calcula
>
> — [STOXX Equity Factor Indices | STOXX](https://stoxx.com/solutions/stoxx-equity-factor-indices)
>

---

### Earnings Momentum

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="18 mentions across STOXX & ISS pages (low)">▰▰ 18</span>


> A factor signal based on the direction and magnitude of analyst earnings
> revision activity. STOXX defines earnings momentum using the change in
> consensus EPS estimates over a trailing window (typically 3 to 6 months).
> Stocks with upward revisions receive positive scores.

earnings momentum asks: "Are analysts raising or lowering their profit forecasts for this company?" Upward revisions signal improving fundamentals and tend to predict near-term outperformance.

$$
\text{Earnings Momentum}_i = \frac{\text{EPS Estimate}_{t} - \text{EPS Estimate}_{t-n}}{\lvert \text{EPS Estimate}_{t-n} \rvert}
$$

> [!tip] Related terms
> [Earnings Announcement Drift](#earnings-announcement-drift), [Momentum Factor](#momentum-factor), [Alpha Signal](#alpha-signal)

> [!example]- Source excerpts (5)
>
> The quarterly rebalance schedule will resume as normal in June 2025. STOXX INDEX METHODOLOGY GUIDE
> 594/639 18. STOXX FACTOR INDICES  **Earnings Momentum** is given by the sum of the number of EPS
> upgrades for the current (FY1) and following (FY2) fiscal years minus the sum of the FY1 and FY2
> EPS downgra
>
> — [Stoxx Index Guide (PDF), p. 594](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> Our research has shown that combining Momentum signals across both price and fundamentals — such
> as **earnings momentum** or **earnings momentum** drift — enhances signal strength (Figure 2).
> This approach helps us avoid simplistic exposures and better reflect what Momentum
>
> — [Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX a...](https://stoxx.com/qa-with-blackrock-fourth-year-of-multifactor-collaboration-with-stoxx-amid-evolving-factor-investing-landscape)
>
> he Factors are combined to create a - Multi-Factor Alpha Signal, as described below. F The
> Momentum Factor is a composite of the following 2 Signals: **Earnings Momentum**, and Price
> Momentum. A • **Earnings Momentum** is given by the sum of the number of EPS upgrades for the
> current C (FY1) and following (FY2) fiscal years
>
> — [Istoxx Index Guide (PDF), p. 918](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> stors. “In today’s low-rate environment, investors need to broaden their sources of income as well
> as diversify them. With strong economic growth and **earnings momentum**, a number of EM companies
> can be an attractive source of returns and income for investors.” “While EMs offer an outstanding
> growth opportunity and ha
>
> — [Q&amp;A with FlexShares: Quality and ESG as risk-control tools for EM Low-Vol...](https://stoxx.com/qa-with-flexshares-quality-and-esg-as-risk-control-tools-for-em-low-vol-high-dividend-strategies)
>
> to maximize exposure to a multifactor signal created from the following five factors: Momentum The
> momentum score is calculated from price momentum, **earnings momentum** and earnings announcement
> drift (i.e., the difference between a stock’s performance on and immediately following an earnings
> announcement date). Qual
>
> — [STOXX Equity Factor Indices | STOXX](https://stoxx.com/solutions/stoxx-equity-factor-indices)
>

---

### Equal Risk Contribution

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="4 mentions across STOXX & ISS pages (ultra-low)">▰ 4</span>


> A portfolio construction method where each constituent is weighted so that it
> contributes an equal share of the total portfolio risk (volatility). STOXX
> Equal Risk indices solve for weights $w_i$ such that
> $w_i \cdot (\Sigma w)_i = \frac{\sigma_p^2}{N}$ for all $i$, where $\Sigma$
> is the covariance matrix.

instead of giving each stock equal dollars, you give each stock an equal "risk budget." A highly volatile stock gets less money; a stable stock gets more — so no single name dominates portfolio risk.

$$
\text{RC}_i = w_i \cdot \frac{\partial \sigma_p}{\partial w_i} = \frac{\sigma_p}{N} \quad \forall \; i
$$

> [!tip] Related terms
> [Risk Parity](#risk-parity), [Risk Budget](#risk-budget), [Minimum Variance](#minimum-variance), [Maximum Diversification](#maximum-diversification)

> [!example]- Source excerpts (1)
>
> ithin 0.25 standard deviations of Parent Index Active targeted style factor exposures > 0 vs
> Parent Index **Equal Risk Contribution** by targeted factors **Equal Risk Contribution** by
> targeted factors Active Risk Within 1% w.r.t. Parent Index Limit turnover 7.5% one-way on a
> quarterly basis Effective number of names Minimum of 3
>
> — [Istoxx Index Guide (PDF), p. 702](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>

---

## F

> [!quote]
> "A factor is simply a characteristic that explains differences in stock returns."
> — **Eugene Fama**

### Factor (Definition)

<span style="background:deeppink; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="5,508 mentions across STOXX & ISS pages (ultra-high)">▰▰▰▰▰▰▰ 5,508</span>


> A systematic, persistent, and economically motivated driver of security
> returns. STOXX recognizes canonical factors including value, momentum, quality,
> low volatility, and size. Each factor is operationalized through specific
> financial metrics, standardized into z-scores, and used to tilt portfolio
> weights away from market capitalization.

a factor is a measurable characteristic of stocks — like cheapness or recent performance — that has historically been rewarded with higher returns over long periods, backed by economic reasoning.

> [!tip] Related terms
> [Factor Investing](#factor-investing), [Factor-Based Index](#factor-based-index), [Smart Beta](#smart-beta)

> [!example]- Source excerpts (5)
>
> ADTV 𝐸𝑈𝑅 𝑖 𝑤 = 𝑖𝑡 ∑40 6𝑀 𝐴𝐷𝑇𝑉 𝐸𝑈𝑅 𝑗=1 𝑗 where the denominator is the sum of the six-month ADTV in
> EUR of all 40 companies in the index. The weighting **factor** of component i at time t is
> calculated as follows: 𝑤 𝑖𝑡 𝑤𝑓 =100bn∗ 𝑖𝑡 𝑝 𝑖𝑡 with 𝑝 being the closing price of component i at
> time t.
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF), p. 93](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> 1999 to Jul. 2016. Factors shown are the standard Axioma style factors. Note: cumulative
> **factor** exposures of a strategy relative to a benchmark do not generally add to zero as it is
> measured in terms of risk allocation.. STOXX LIMITED
>
> — [Stoxx Minvar Paper (PDF), p. 8](http://www.stoxx.com/document/Others/marketing/STOXX_MinVar_Paper.pdf)
>
> How are performance-based equity awards defined? For the purposes of the CEO Performance-based
> Equity **Factor**, which assesses whether the CEO has received performance- based equity, a
> performance-based equity award is defined as any form of equity award where
>
> — [Canadian Equity Plan Scorecard Faq (PDF), p. 15](https://www.issgovernance.com/file/policy/2018/americas/Canadian-Equity-Plan-Scorecard-FAQ.pdf)
>
> )∙ + ) 𝑖 𝑐𝑤 𝑤 𝑛 0.07 𝑖 𝑖=1 The previous year’s GHG intensity reduction (starting from 2022 with
> respect to 2021) is calculated as: 147 Standard decay **factor**, suggested and used by
> Riskmetrics iSTOXX® METHODOLOGY GUIDE 753/1024 103.iSTOXX GLOBAL CLIMATE CHANGE ESG INDEX 𝐼𝑛𝑑𝑒𝑥
> 𝐺𝐻𝐺 𝐼𝑛𝑡𝑒𝑛𝑠𝑖𝑡𝑦 ∙(𝐼𝑛
>
> — [Istoxx Index Guide (PDF), p. 752](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> , the Code refers to one-third independence, depending on each company’s circumstances, including
> governance structure. This proposed policy does not **factor** in outside directors’ independence.
> While independence is conceptually important, too much emphasis on independence at this stage of
> Japan’s corporat
>
> — [10 2017 Comment Period Template Japan Director Elections Outside Directors (PDF), p. 2](https://www.issgovernance.com/file/policy/10-2017-comment-period-template-japan-director-elections-outside-directors.pdf)
>

---

### Factor Diversification

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="6 mentions across STOXX & ISS pages (low)">▰▰ 6</span>


> The practice of combining multiple factor exposures within a single portfolio
> to reduce the cyclicality of returns. Because factors (e.g., value and
> momentum) often have low or negative correlations with each other, blending
> them produces a smoother return profile than any single-factor strategy.

different factors "take turns" performing well. Value might struggle when momentum shines, and vice versa. Holding both in one portfolio is like diversifying across asset classes — but within equities.

> [!tip] Related terms
> [Multi-Factor](#multi-factor), [Multifactor Signal](#multifactor-signal), [Factor Investing](#factor-investing)

> [!example]- Source excerpts (5)
>
> On the other hand, value and reversal stocks, which are described as countercyclical, slightly
> underperformed the market. Figure 1: **Factor diversification** in practice Drawdown risk The
> distribution of returns in Figure 1 highlights an essential aspect of the EURO STOXX Multi Premia
> Index: its diversific
>
> — [The Power of Factor Diversification | Blog posts | STOXX](https://stoxx.com/the-power-of-factor-diversification)
>
> The multifactor portfolio, on the other hand, did not exhibit any sustained underwater periods.
> Intra-**factor diversification** A final consideration involves the construction of individual
> factors. Just as the combination of styles in a multi-factor portfolio can perform bett
>
> — [Multifactor strategies: Proving their worth in the factor investment landscap...](https://stoxx.com/multifactor-strategies-proving-their-worth-in-the-factor-investment-landscape)
>
> These include market-relative caps on sector and country weights as well as absolute and
> market-relative limits on individual security weights. **Factor diversification** Additional
> considerations include criteria around systematic exposures, or how much the index can be tilted
> toward any single factor.
>
> — [Qontigo launches modern STOXX multifactor indices to underlie iShares ETFs ma...](https://stoxx.com/qontigo-launches-modern-stoxx-multifactor-indices-to-underlie-ishares-etfs-managed-by-blackrock)
>
> in multiple single-factor portfolios according to desired weights, but rather seek to integrate
> the different factors in an efficient way to capture **factor diversification**. For every
> security, an aggregate multifactor score is computed as the average of the individual factor
> scores.
>
> — [Introducing the STOXX Factor Indices | STOXX](https://stoxx.com/introducing-the-stoxx-factor-indices)
>
> egically seek outperformance, or implement tactical views with factor ETFs.” You highlight risk
> management. Why is it important for investors to have **factor diversification** from that
> perspective? Lukas: “Factor investing is all about accessing differentiated sources of risk and
> returns.
>
> — [BlackRock and STOXX collaboration: iShares multi-factor ETFs track STOXX indi...](https://stoxx.com/blackrock-and-stoxx-collaboration-ishares-multi-factor-etfs-track-stoxx-indices-to-deliver-consistent-risk-managed-exposure-for-a-portfolios-core)
>

---

> [!quote]
> "Factor investing is the systematic harvesting of risk premia."
> — **Cliff Asness**

### Factor Investing

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="219 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 219</span>


> An investment approach that targets specific, evidence-based return drivers
> (factors) through systematic portfolio construction. STOXX implements factor
> investing via transparent, rules-based indices that overweight securities with
> desirable factor characteristics and underweight (or exclude) those without.

instead of buying the whole market by size, factor investing deliberately tilts toward stocks that share a trait — cheapness, recent winners, financial health — that academic research has shown earns a premium over time.

> [!tip] Related terms
> [Factor (Definition)](#factor-definition), [Smart Beta](#smart-beta), [Factor-Based Index](#factor-based-index), [Risk Premia](#risk-premia)

> [!example]- Source excerpts (5)
>
> Continue active refreshing of this index's data? Continue active refreshing of this index's data?
> **Factor Investing** Most Recent **Factor Investing** A rotation out of technology and AI-related
> stocks weighed on US indices in February, while inflows into lower-valuation
>
> — [Factor Investing | STOXX](https://stoxx.com/category/factor-investing)
>
> An increase in the number of passive investment vehicles that offer such strategies in a
> systematic way has opened up the world of **factor investing** to a much larger audience. We spoke
> to Jan-Carl Plagge, head of applied research at STOXX Ltd., to ask him why factor-based passive
> strategies are pr
>
> — [Factor Investing: Q&amp;A on Flows, Outlook | Blog posts | STOXX](https://stoxx.com/factor-investing-qa-on-flows-outlook)
>
> In 2021, “alpha produced a return that was more than two percentage points higher than in 2011,
> the next-best year.” “Rumors of **factor investing**’s demise have been greatly exaggerated,” she
> concludes. We invite you to download and read the white paper. 1 Brown, M., ‘Unpacking the alpha
> compone
>
> — [Not so fast. Factor investing is alive and doing well! | Blog posts | STOXX](https://stoxx.com/not-so-fast-factor-investing-is-alive-and-doing-well)
>
> This video first appeared on Asset TV’s MASTERCLASS: **Factor Investing** – June 2023. Recent
> market developments and investing trends have prompted investors to reconsider their investment
> allocations.
>
> — [MASTERCLASS: Factor Investing - June 2023 | Blog posts | STOXX](https://stoxx.com/masterclass-factor-investing-june-2023)
>
> ting, what defines a modern factor strategy, and what the collaboration with STOXX has brought to
> the iShares offering. Below is our exchange. Priya, **factor investing** has evolved in recent
> years. How have BlackRock’s factor strategies changed? “**Factor investing**, of course, has been
> around for decades.
>
> — [Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX a...](https://stoxx.com/qa-with-blackrock-fourth-year-of-multifactor-collaboration-with-stoxx-amid-evolving-factor-investing-landscape)
>

---

> [!quote]
> "Risk premia exist because bearing risk is uncomfortable."
> — **Cliff Asness**

### Factor Premium

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="6 mentions across STOXX & ISS pages (low)">▰▰ 6</span>


> The long-run excess return attributable to systematic exposure to a specific
> factor, measured as the average return difference between a portfolio long
> high-scoring securities and short low-scoring securities on that factor. STOXX
> factor indices are designed to capture these premia in a long-only,
> investable format by overweighting high-scoring stocks relative to the
> benchmark.

the factor premium is the "payoff" for bearing factor risk. The value premium, for example, is the historical return gap between cheap and expensive stocks. Factor investing works only if these premia persist — and STOXX index design assumes they do over full market cycles.

$$
\text{Factor Premium}_k = \frac{1}{T}\sum_{t=1}^{T}\left(R_{t}^{\text{long}} - R_{t}^{\text{short}}\right)
$$

where the long (short) portfolio holds the top (bottom) quintile on factor $k$.

> [!tip] Related terms
> [Risk Premia](#risk-premia), [Factor Crowding](#factor-crowding), [Factor (Definition)](#factor-definition)

> [!example]- Source excerpts (5)
>
> Based on relevant and scientifically proven ratios, the best stocks from the investment universe
> are selected for each **factor premium** — value, size, momentum, residual momentum, reversal, low
> risk and quality.
>
> — [Q&amp;A: Credit Suisse’s Froehlich on Multi-Premia Investing | Blog posts | S...](https://stoxx.com/qa-credit-suisses-froehlich-on-multi-premia-investing)
>
> reviews the risk management, diversification and turnover constraints built into the index
> methodology, a process that upholds the harvesting of the **factor premium** in an investable and
> repeatable framework. One of the key takeaways from the study is that the customized Multifactor
> signal behind the index has a “
>
> — [A behind-the-scenes look at the STOXX Equity Factor indices | Blog posts | STOXX](https://stoxx.com/a-behind-the-scenes-look-at-the-stoxx-equity-factor-indices)
>
> r Market Neutral Indices hold a short position in futures on the STOXX Europe 600 to neutralize
> systematic risk and hence gain exposure purely to the **factor premium**. ESG strategies to pay
> off Following a difficult year, environmental, social and governance (ESG) strategies may catch up
> as more investors adopt res
>
> — [2019 Market Outlook II – Dollar Down, Risk Up? | Blog posts | STOXX](https://stoxx.com/2019-market-outlook-ii-dollar-down-risk-up)
>
> typical tracking error target of 1–2% helps ensure that the portfolio stays suitable for core
> allocations, while still aiming to deliver a persistent **factor premium**. In other words, it’s
> not about giving each factor the same weight — but rather giving them the appropriate risk budget
> within a diversified, long-te
>
> — [Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX a...](https://stoxx.com/qa-with-blackrock-fourth-year-of-multifactor-collaboration-with-stoxx-amid-evolving-factor-investing-landscape)
>
> m stocks with all constraints considered. Opportunities in 2018 Many investors say momentum will
> continue to perform well in 2018, although, like all **factor premium**s, it is subject to
> cyclicality and reversals. The BlackRock Investment Institute cites continued global economic
> expansion and a low-volatility regim
>
> — [Evaluating the true cost of momentum investing | Blog posts | STOXX](https://stoxx.com/evaluating-the-true-cost-of-momentum-investing)
>

---

### Factor Rotation

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1 mentions across STOXX & ISS pages (ultra-low)">▰ 1</span>


> A dynamic strategy that adjusts factor exposures over time based on the
> macroeconomic cycle, factor valuations, momentum of factor returns, or other
> timing signals. While STOXX's core factor indices use static factor weights,
> Qontigo research explores rotation frameworks that shift allocations between
> value, momentum, quality, and low volatility depending on regime indicators.

factor rotation is the idea of being a "factor timer" — overweighting value when value is cheap and momentum when trends are strong. It is appealing in theory but difficult in practice, which is why most STOXX indices stick to fixed multi-factor blends and leave rotation to active managers.

> [!tip] Related terms
> [Factor Diversification](#factor-diversification), [Factor Crowding](#factor-crowding), [Multi-Factor](#multi-factor)

> [!example]- Source excerpts (1)
>
> off, how has the iShares multifactor suite performed since launch three years ago? “The past three
> years have been a volatile period, marked by sharp **factor rotation**s, inflation surprises and
> diverging Growth and Value performance. Yet the suite held up well, demonstrating the benefits of
> diversification and disci
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

a factor tilt says "keep roughly the same portfolio as the benchmark, but lean more heavily toward stocks that score well on the factor." It is a moderate approach — halfway between a passive index and a pure factor portfolio.

$$
w_i^{\text{tilted}} = \frac{w_i^{\text{bench}} \cdot e^{\kappa \cdot z_i}}{\sum_{j} w_j^{\text{bench}} \cdot e^{\kappa \cdot z_j}}
$$

where $\kappa$ controls the aggressiveness of the tilt and $z_i$ is the factor z-score.

> [!tip] Related terms
> [Alpha Signal](#alpha-signal), [Factor-Based Index](#factor-based-index), [Active Industry Constraint](#active-industry-constraint)

> [!example]- Source excerpts (5)
>
> These constraints around country, sector and currency risk embedded in the methodology seek to
> provide a **factor tilt** as pure as possible, while being neutral around all other sources of
> risk. “There is a direct link between information decay, tracking error, rebalan
>
> — [Evaluating the true cost of momentum investing | Blog posts | STOXX](https://stoxx.com/evaluating-the-true-cost-of-momentum-investing)
>
> 1 The STOXX Europe 600 Industry Neutral Ax Multi-Factor Index is constructed so that it gets most
> of its risk – and therefore return – from its style **factor tilt**s, and we see that that is the
> case in most years. In a few years we see a large ‘specific return,’ or the proportion of actual
> return not explained b
>
> — [The diversification benefits of a multi-factor approach: the STOXX Europe 600...](https://stoxx.com/the-diversification-benefits-of-a-multi-factor-approach-the-stoxx-europe-600-industry-neutral-ax-multi-factor-index)
>
> d analytics of Axioma Factor Risk Models. On a global basis, Size showed the best performance last
> month while Low Risk had the weakest one. The Size **factor tilt**s towards the
> smallest-capitalization stocks. Over the entire 2023, Quality was the strongest factor. Risk and
> return characteristics Return (%) Annua
>
> — [Monthly Index News December 2023 (PDF), p. 24](https://stoxx.com/monthly-index-news-december-2023)
>
> ices that G have the lowest absolute ex-ante volatility under different ESG, Carbon and SDI
> constraints. Those indices also place controls over style **factor tilt**s, industry / country
> exposures and liquidity / tradability. W Indices: The iSTOXX APG World-X and Responsible Minimum
> Volatility Index Range is O com
>
> — [Istoxx Index Guide (PDF), p. 802](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> basis, Size showed the best performance in December while Low Risk was the weakest style,
> according to the STOXX Factor indices (Figure 5). The Size **factor tilt**s towards the
> smallest-capitalization stocks. For 2023, the STOXX® Global 1800 Ax Quality was the strongest
> factor with a 30.6% gain. Figure 5: STOXX
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

a factor-based index is like a regular stock index — the S&P 500 or EURO STOXX 50 — except the weights are tilted by a factor score instead of simply reflecting company size.

> [!tip] Related terms
> [Factor Investing](#factor-investing), [Smart Beta](#smart-beta), [Factor Tilt](#factor-tilt)

> [!example]- Source excerpts (5)
>
> TOXX Ltd., part of the ISS STOXX group of companies, today announced its expanding collaboration
> with L&G, with L&G’s launch of three developed world **factor-based index** funds tracking
> customized iSTOXX indices. These funds, built on customized iSTOXX indices, reflect L&G’s
> proprietary factor research and aim to bring
>
> — [STOXX and L&amp;G collaborate on launch of three L&amp;G developed world fact...](https://stoxx.com/stoxx-and-lg-collaborate-on-launch-of-three-lg-developed-world-factor-based-index-funds)
>
> dy period, meaning they can also serve as a great source of diversification. You mentioned low
> cost. How important is that as a driver for flows into **factor-based index** products? Our
> experience is that lower fees can be a defining variable when comparing active versus passive
> strategies. But what investors also focus
>
> — [Factor Investing: Q&amp;A on Flows, Outlook | Blog posts | STOXX](https://stoxx.com/factor-investing-qa-on-flows-outlook)
>
> Derived from the STOXX® World AC index, which covers large- and mid-cap developed and emerging
> markets, this sustainable, **factor-based index** solution uses the Axioma optimizer to balance
> multiple investment objectives and considerations.
>
> — [Q&amp;A: Building customized, sustainable portfolios based on the STOXX World...](https://stoxx.com/qa-building-customized-sustainable-portfolios-based-on-the-stoxx-world-indices)
>
> eleration of the phenomenon,” said Roberto Lazzarotto, Global Head of Sales at STOXX. ESG stands
> for environmental, social and governance strategies. **Factor-based index** strategies, which
> select stocks according to specific sources of risk and returns, attracted a net 9.7 billion
> euros, the most in at least a decade.
>
> — [ETF Inflows Grow, Assets Reach Record | STOXX](https://stoxx.com/etf-inflows-grow-assets-reach-record)
>
> t rates and sustained economic growth will help corporate earnings. Factor Investing STOXX and L&G
> collaborate on launch of three L&G developed world **factor-based index** funds STOXX Ltd. today
> announced its expanding collaboration with L&G, with L&G’s launch of three developed world
> **factor-based index** funds tracking c
>
> — [Factor Investing | STOXX](https://stoxx.com/category/factor-investing)
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

the growth factor bets on companies that are expanding quickly — fast-rising revenues, accelerating profits, or analyst forecasts pointing sharply upward. These stocks are rarely cheap, but the thesis is that the market still underestimates how long strong growth can persist.

$$
\text{Growth}_i = \frac{1}{3}\left(z_{\text{EPS growth},i} + z_{\text{Revenue growth},i} + z_{\text{Fwd growth},i}\right)
$$

> [!tip] Related terms
> [Value Factor](#value-factor), [Earnings Momentum](#earnings-momentum), [Factor (Definition)](#factor-definition)

> [!example]- Source excerpts (1)
>
> positive active exposures in the Market Sensitivity, Volatility and Liquidity factors, while also
> being more exposed to the Medium-Term Momentum and **Growth factor**s. Negative active exposures
> include those to the Dividend Yield, Exchange Rate Sensitivity and Earnings Yield factors. Figure
> 8: Active style-factor
>
> — [The AI revolution is taking place now – a look inside the STOXX Global Artifi...](https://stoxx.com/the-ai-revolution-is-taking-place-now-a-look-inside-the-stoxx-global-artificial-intelligence-index)
>

---

## I

### Industry Neutral

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="102 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 102</span>


> A portfolio construction constraint ensuring that the aggregate weight of each
> GICS industry or ICB sector in the factor portfolio exactly matches its weight
> in the parent index. STOXX industry-neutral factor indices isolate pure
> within-sector stock selection alpha by eliminating cross-sector bets entirely.

if the benchmark has 12% in pharmaceuticals, the factor index also holds exactly 12% in pharmaceuticals. All the action happens inside each sector — picking the best factor stocks within each industry — rather than across sectors.

> [!tip] Related terms
> [Active Industry Constraint](#active-industry-constraint), [Tracking Error Budget](#tracking-error-budget), [Factor Tilt](#factor-tilt)

> [!example]- Source excerpts (5)
>
> Before we dive into the analysis, let’s briefly review the methodology and offering of the STOXX
> **Industry Neutral** Single and Multi-Factor indices. STOXX **Industry Neutral** Factor Indices
> The standard STOXX® Factor Indices are built using commercially accepted and i
>
> — [The diversification benefits of a multi-factor approach: the STOXX Europe 600...](https://stoxx.com/the-diversification-benefits-of-a-multi-factor-approach-the-stoxx-europe-600-industry-neutral-ax-multi-factor-index)
>
> Solutions **Industry Neutral** Factor Indices For investors looking to accurately access pure
> factor returns, without unintended sector exposures. The STOXX® **Industry Neutral** Ax Fa
>
> — [Industry Neutral Factor Indices | STOXX](https://stoxx.com/industry-neutral-factor-indices)
>
> The futures will start trading on Apr. 26, Eurex said in a press release. The STOXX **Industry
> Neutral** Ax Factor Indices were introduced in February and implement the same methodology of the
> STOXX® Factor Indices while reducing the active industry cons
>
> — [Eurex to List Futures on STOXX Industry Neutral Ax Factor Indices | Blog post...](https://stoxx.com/eurex-to-list-futures-on-stoxx-industry-neutral-ax-factor-indices)
>
> Index represents the performance of the 60 largest Canadian companies by free-float market
> capitalization from among the 11 ICB Industries. It is an **industry neutral** index and is
> derived from the STOXX Canada 240 index. Universe: The index universe is defined as the new
> composition of the STOXX Canada 240 index wh
>
> — [Stoxx Index Guide (PDF), p. 106](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> Indices while reducing the active industry1 constraint from +/- 5% to near neutral. In all but
> eliminating the overall industry deviations, the STOXX **Industry Neutral** Factor Indices may
> sacrifice some factor exposure, but benefit from targeting lower levels of active industry risk
> and avoiding potential performance
>
> — [Introducing the STOXX Industry Neutral Ax Factor Indices | Blog posts | STOXX](https://stoxx.com/introducing-the-stoxx-industry-neutral-ax-factor-indices)
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

the low risk factor is the finding that boring, steady stocks have historically delivered better risk-adjusted returns than wild, volatile ones — contradicting the textbook idea that more risk always equals more reward.

> [!tip] Related terms
> [Low Volatility Factor](#low-volatility-factor), [Minimum Variance](#minimum-variance), [Risk Premia](#risk-premia)

> [!example]- Source excerpts (5)
>
> All indices avoided the extent of losses recorded by the STOXX Europe 600 during the month. The
> iSTOXX® Europe **Low Risk Factor** Market Neutral Index had the best return during the month,
> consolidating its outperformance during the full year.
>
> — [Monthly Index News December 2018 (PDF), p. 5](https://stoxx.com/monthly-index-news-december-2018)
>
> This does not adequately compare with MVP which gives the optimal factor allocation in order to
> reduce portfolio risk, albeit with a significant **Low Risk factor** bias. STOXX LIMITED 14 STOXX
> MINIMUM VARIANCE INDICES 5 A tale of two minimum variance indices The STOXX Minimum Variance
> Indices provide
>
> — [Stoxx Minvar Paper (PDF), p. 13](http://www.stoxx.com/document/Others/marketing/STOXX_MinVar_Paper.pdf)
>
> ESG-X Factor Indices – Regional: Asia/Pacific Key Points Within the responsibly-screened universe
> in Asia/Pacific, Momentum also led gains while the **Low Risk factor** trailed all other
> strategies. Risk and Return Characteristics Return (%) Annualized volatility (%) EUR USD EUR USD
> 1M YTD 1Y 1M YTD 1Y 1M YTD 1Y 1M Y
>
> — [Monthly Index News November 2020 (PDF), p. 22](https://stoxx.com/monthly-index-news-november-2020)
>
> Looking at the attribution for this period, we observe that the Mixed portfolio was able to better
> capitalize overall on the **Low Risk factor** (as defined by Market Sensitivity and Residual
> Volatility in the Axioma Risk Model), and Value and Size exposures acted as a drag on both
> methods.
>
> — [STOXX Factor and STOXX ESG-X Factor Indices Q2 Spotlight – Mixed Performance,...](https://stoxx.com/stoxx-factor-and-stoxx-esg-x-factor-indices-q2-spotlight-mixed-performance-strong-exposures-and-rebounding-correlations)
>
> turn basis. The iSTOXX® Europe Size Factor Market Neutral Index retreated 2.3%, its sixth straight
> monthly loss. At the other end, the iSTOXX® Europe **Low Risk Factor** Market Neutral Index
> dropped the least. The iSTOXX Europe Factor Market Neutral Indices are designed to offer exposure
> to factor investing in isolati
>
> — [Monthly Index News July 2019 (PDF), p. 7](https://stoxx.com/monthly-index-news-july-2019)
>

---

> [!quote]
> "The low-volatility anomaly is the greatest embarrassment to the efficient market hypothesis."
> — **Cliff Asness**

### Low Volatility Factor

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="14 mentions across STOXX & ISS pages (low)">▰▰ 14</span>


> The specific implementation of the low risk factor that selects or overweights
> securities with the lowest trailing realized volatility (typically measured over
> 12 months of daily returns). STOXX low volatility indices rank all constituents
> of the parent index by inverse volatility and select the least volatile subset.

you rank all stocks from calmest to most volatile, then build a portfolio heavily weighted toward the calm ones. History shows this simple strategy often beats the market on a risk-adjusted basis.

$$
\sigma_i = \sqrt{\frac{1}{T-1} \sum_{t=1}^{T} (r_{i,t} - \bar{r}_i)^2}
$$

Securities with the smallest $\sigma_i$ receive the highest weights.

> [!tip] Related terms
> [Low Risk Factor](#low-risk-factor), [Minimum Variance](#minimum-variance), [Equal Risk Contribution](#equal-risk-contribution)

> [!example]- Source excerpts (5)
>
> The Value Factor combines the 5 Signals equally at 20% weights and is again z-scored and
> truncated. The **Low Volatility Factor** is given by the standard deviation of monthly total
> returns in local currency, calculated over the 12 complete months prior to the review cut-off dat
>
> — [Stoxx Index Guide (PDF), p. 588](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> In recent years, however, academia has shifted its focus to the explanation of the so-called **low
> volatility factor**. The traditional Capital Asset Pricing Model (CAPM) explains asset returns in
> excess of the risk-free rate as compensation for systematic, i.e.
>
> — [The low volatility premium – An analysis of factor exposures of minimum varia...](https://stoxx.com/the-low-volatility-premium-an-analysis-of-factor-exposures-of-minimum-variance-strategies-blog)
>
> rket information in order to always hold the portfolio with minimum risk. Importantly, minimum
> variance does not equate to a simple allocation to the **low volatility factor**, which would be
> represented by a portfolio with long low volatility stocks and short high volatility stocks.
>
> — [Stoxx Minvar Paper (PDF), p. 7](http://www.stoxx.com/document/Others/marketing/STOXX_MinVar_Paper.pdf)
>
> s, and so they have the same weight relative to each other. The Small Size factor, for its part,
> is a high beta, pro-cyclical factor, relative to the **Low Volatility factor**, which is low beta
> and a much more defensive factor. Those are opposing factors pulling in opposite directions.
>
> — [BlackRock’s Jamie Forbes: Implementing ‘evolutionary’ factor advancements in ...](https://stoxx.com/blackrocks-jamie-forbes-implementing-evolutionary-factor-advancements-in-investments)
>
> allowed investors to allocate resources to stocks whose features can help make them less
> vulnerable in volatile markets. That’s true not just of the **low volatility factor**, but also of
> quality, high dividend and even value. Factor investing has also provided a channel for a popular
> risk-mitigation approach: that of mini
>
> — [The New Faces of Risk Management | Blog posts | STOXX](https://stoxx.com/the-new-faces-of-risk-management)
>

---

## M

> [!quote]
> "The goal is not to maximize return but to optimize the ratio of return to risk."
> — **Harry Markowitz**

### Minimum Variance

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="769 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 769</span>


> A portfolio optimization strategy that seeks the set of weights producing the
> lowest possible portfolio volatility. STOXX Minimum Variance indices use an
> estimated covariance matrix (from Axioma or similar risk models) and solve a
> quadratic program subject to weight caps, turnover limits, and sector
> constraints.

the minimum variance portfolio answers: "Given these stocks and their historical relationships, what combination produces the smoothest possible ride?" It does not try to predict returns — only to minimize risk.

$$
w^* = \arg\min_{w} \; w^\top \Sigma w \quad \text{s.t.} \quad \sum_i w_i = 1, \; w_i \geq 0
$$

> [!tip] Related terms
> [Low Volatility Factor](#low-volatility-factor), [Maximum Diversification](#maximum-diversification), [Capping Constraint](#capping-constraint)

> [!example]- Source excerpts (5)
>
> STOXX Ltd. has introduced the STOXX® Emerging Markets 800 LO **Minimum Variance** Index (STOXX EM
> 800 LO MinVar), expanding its suite of rules-based **minimum variance** strategies to the universe
> of developing nations. The new index i
>
> — [A Minimum Variance Strategy for Emerging Markets | Blog posts | STOXX](https://stoxx.com/a-minimum-variance-strategy-for-emerging-markets)
>
> the benchmark. This means that the min var version will likely have similar attributes to the
> benchmark as well as achieving the objective of having **minimum variance**. The min var approach
> is popular with a broad cross section of clients from traditional ETF product users who use it as
> an alternative to typical bet
>
> — [Minimum Variance has its ‘day in the sun’ - ETF Express](https://stoxx.com/minimum-variance-has-its-day-in-the-sun)
>
> This observation is found to exist across geographies. These findings are likely of great
> importance for investors while implementing **minimum variance** strategies. Investors need to be
> aware of interactions among factors in order to apply appropriate countermeasures.
>
> — [The low volatility premium – An analysis of factor exposures of minimum varia...](https://stoxx.com/the-low-volatility-premium-an-analysis-of-factor-exposures-of-minimum-variance-strategies-blog)
>
> One month is all it took for the **minimum variance** strategy to undo the 2018 underperformance
> carried since April. The STOXX **Minimum Variance** indices track stocks that have exhibited the
> lowest individual levels of historical volatility.
>
> — [Minimum Variance’s Prowess in Risk Protection | Blog posts | STOXX](https://stoxx.com/minimum-variances-prowess-in-risk-protection)
>
> The analysis is run on the STOXX® Global 1800 **Minimum Variance** Index, STOXX® USA 900 **Minimum
> Variance** Index, EURO STOXX® Minimum Variance Index, and respective unconstrained versions,3 as
> well as on their benchmarks. Stress test results (Table1) show that the Minimum Variance indices
> pr
>
> — [Minimum Variance Indices: A Reading Through Geopolitical Risk | Blog posts | ...](https://stoxx.com/minimum-variance-indices-a-reading-through-geopolitical-risk)
>

---

> [!quote]
> "Momentum is a fact, not a theory; returns tend to persist."
> — **Cliff Asness**

### Momentum Factor

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="50 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 50</span>


> A factor that captures the tendency of recent winners to continue outperforming
> and recent losers to continue underperforming over medium-term horizons. STOXX
> implements momentum using 12-month cumulative return with a 1-month reversal
> exclusion (i.e., months 2 through 12), following the Carhart (1997) convention.

momentum is the "hot hand" effect in markets: stocks that have gone up over the past year (excluding the most recent month) tend to keep going up for a while. Factor indices ride this trend systematically.

$$
\text{Mom}_i = \frac{P_{i,t-1}}{P_{i,t-12}} - 1
$$

The most recent month is excluded to avoid the short-term reversal effect.

> [!tip] Related terms
> [Price Momentum](#price-momentum), [Earnings Momentum](#earnings-momentum), [Earnings Announcement Drift](#earnings-announcement-drift)

> [!example]- Source excerpts (5)
>
> At each iteration, a standardized factor is calculated as: (𝑎𝑑𝑗𝑀𝑜𝑚 −𝑎𝑣𝑒) 𝑠𝑡𝑎𝑛𝑑𝑎𝑟𝑑𝑖𝑧𝑒𝑑 𝑓𝑎𝑐𝑡𝑜𝑟
> 𝑎𝑑̂𝑗𝑀𝑜𝑚 = 𝑖 𝑖 𝜎 where 𝑎𝑑𝑗𝑀𝑜𝑚 : the risk-factor adjusted **momentum factor** of stock i 𝑖 𝑎𝑣𝑒:
> factor average weighted by the stocks’ weights in the parent index 𝜎：factor standard deviation At
> each iteration, if the standardiz
>
> — [Istoxx Index Guide (PDF), p. 266](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> ntum truly represents: a behavioral phenomenon rooted in investor underreaction, and not just a
> statistical artifact.” Figure 2: Active returns – USA **Momentum factor** “It’s worth emphasizing
> here that innovating in factor design does not mean neglecting traditional factor definitions, but
> rather building on them to
>
> — [Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX a...](https://stoxx.com/qa-with-blackrock-fourth-year-of-multifactor-collaboration-with-stoxx-amid-evolving-factor-investing-landscape)
>
> The STOXX® Global 1800 Basic Resources Index (-6%)3 led losses. The STOXX® Global 1800 Technology
> Index jumped 7.2% to top all other sectors. **Momentum factor** back in favor Momentum regained
> its lead among factor strategies covering global markets, paced by a strong performance from the
> factor in the US.
>
> — [Global Stocks Rise for Fifth Straight Month in June on Continued Economic Opt...](https://stoxx.com/global-stocks-rise-for-fifth-straight-month-in-june)
>
> Europe 600 to help investors neutralize systematic risk, struggled in April. Six of the seven
> indices posted a loss for the month. The iSTOXX® Europe **Momentum Factor** Market Neutral Index
> was the exception, posting a 0.7% advance. The indices are designed to give investors exposure to
> pure factor investing. Risk an
>
> — [Monthly Index News April 2019 (PDF), p. 6](https://stoxx.com/monthly-index-news-april-2019)
>
> /stoxxnet/Documents/Resources/Data_Vendor_Codes/vendor_codes_sheet.csv STOXX INDEX METHODOLOGY
> GUIDE 587/639 18. STOXX FACTOR INDICES The **Momentum Factor** is a composite of the following 3
> Signals: Earnings Announcement Drift, Earnings Momentum, and Price Momentum.  Earnings
> Announcement Drift is given
>
> — [Stoxx Index Guide (PDF), p. 587](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>

---

> [!quote]
> "Combining factors is like combining ingredients; the blend matters more than any single one."
> — **Kenneth French**

### Multi-Factor

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="239 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 239</span>


> An index or strategy that systematically combines two or more factor signals
> into a single portfolio. STOXX multi-factor indices may use either a
> **composite scoring** approach (blending z-scores before optimization) or a
> **portfolio blending** approach (combining single-factor portfolios). The
> composite approach is more common in STOXX methodology.

instead of betting on one factor, you bet on several at once — for example, value + momentum + quality. This hedges your bets because different factors outperform in different market conditions.

> [!tip] Related terms
> [Factor Diversification](#factor-diversification), [Multifactor Signal](#multifactor-signal), [Alpha Signal](#alpha-signal)

> [!example]- Source excerpts (5)
>
> Before we dive into the analysis, let’s briefly review the methodology and offering of the STOXX
> Industry Neutral Single and **Multi-Factor** indices. STOXX Industry Neutral Factor Indices The
> standard STOXX® Factor Indices are built using commercially accepted and institutionally tested fa
>
> — [The diversification benefits of a multi-factor approach: the STOXX Europe 600...](https://stoxx.com/the-diversification-benefits-of-a-multi-factor-approach-the-stoxx-europe-600-industry-neutral-ax-multi-factor-index)
>
> Last June, BlackRock revitalized its **multi-factor** product suite with the relaunch of the
> iShares U.S. Equity Factor ETF (LRGF) and iShares International Equity Factor ETF (INTF).
>
> — [BlackRock and STOXX collaboration: iShares multi-factor ETFs track STOXX indi...](https://stoxx.com/blackrock-and-stoxx-collaboration-ishares-multi-factor-etfs-track-stoxx-indices-to-deliver-consistent-risk-managed-exposure-for-a-portfolios-core)
>
> ity, earnings yield, leverage, value and low volatility (accomplished through a minimum variance
> objective), with constituent weights determined by a **multi-factor** optimization process. ECBV
> is linked to the EURO STOXX ESG-X & Ex Nuclear Power Minimum Variance Unconstrained Index and
> takes the same approach to E
>
> — [UniCredit launches ESG-screened Eurozone multi-factor and low vol ETFs | ETF ...](https://stoxx.com/unicredit-launches-esg-screened-eurozone-multi-factor-and-low-vol-etfs)
>
> Last August, Credit Suisse Asset Management (Switzerland) Ltd. launched the first index fund
> tracking the EURO STOXX® Multi Premia Index, a **multi-factor** strategy based on cutting-edge
> research. The index integrates the academic research-based Multi Premia® methodology developed by
> Finreon, a spin-off
>
> — [Q&amp;A: Credit Suisse’s Froehlich on Multi-Premia Investing | Blog posts | S...](https://stoxx.com/qa-credit-suisses-froehlich-on-multi-premia-investing)
>
> CHANGES TO THE GUIDE BOOK Low-Carbon, iSTOXX APG World **Multi-Factor** Responsible SDI and iSTOXX
> APG World **Multi-Factor** Responsible Low-Carbon SDI Indices » May 2024: Addition of EURO iSTOXX
> 50 ESG NR Decrement 4% Index » May 2024(2): Methodology update of EURO iSTOXX
>
> — [Istoxx Index Guide (PDF), p. 43](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>

---

### Multifactor Signal

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="19 mentions across STOXX & ISS pages (low)">▰▰ 19</span>


> The composite score produced by combining individual factor z-scores into a
> single ranking metric. STOXX multi-factor indices compute this signal as a
> weighted average of standardized factor scores, typically with equal weight
> assigned to each factor unless the methodology specifies otherwise.

the multifactor signal is the "final grade" each stock gets after being scored on multiple dimensions. A stock that is cheap (value), trending up (momentum), and financially healthy (quality) gets a high composite score.

$$
S_i = \frac{1}{K} \sum_{k=1}^{K} z_{i,k}
$$

where $K$ is the number of factors and $z_{i,k}$ is the winsorized z-score for factor $k$.

> [!tip] Related terms
> [Alpha Signal](#alpha-signal), [Multi-Factor](#multi-factor), [Factor Tilt](#factor-tilt)

> [!example]- Source excerpts (5)
>
> Equity Factor index. Factor definitions The authors first explore the composition of the
> **Multifactor signal** (Figure 1), which, as reported in previous studies, is grounded in the
> latest academic research.
>
> — [A behind-the-scenes look at the STOXX Equity Factor indices | Blog posts | STOXX](https://stoxx.com/a-behind-the-scenes-look-at-the-stoxx-equity-factor-indices)
>
> Equity Factor Index | STOXX World AC Index | From the respective starting universes, constituents
> are selected and weighted to maximize exposure to a **multifactor signal** created from the
> following five factors: Momentum The momentum score is calculated from price momentum, earnings
> momentum and earnings announcement d
>
> — [STOXX Equity Factor Indices | STOXX](https://stoxx.com/solutions/stoxx-equity-factor-indices)
>
> This paper explores the design of the STOXX U.S. Equity Factor index and the **Multifactor
> signal** that lies at the core of the STOXX Equity Factor suite designed in collaboration with
> BlackRock. The STOXX Equity Factor indices were devised as core
>
> — [A behind-the-scenes look at the design of the STOXX U.S. Equity Factor index ...](https://stoxx.com/a-behind-the-scenes-look-at-the-design-of-the-stoxx-us-equity-factor-index)
>
> exposure to a multifactor alpha signal while adhering to a set of constraints intended to closely
> track their broad equity market parent indices. The **multifactor signal** is composed of the
> Momentum, Quality, Value, Low volatility and Low size factors. The STOXX® Global Equity Factor
> index has outperformed the benchmar
>
> — [Monthly Index News November 2025 (PDF), p. 21](https://stoxx.com/monthly-index-news-november-2025)
>
> he authors consider two parent universes: the STOXX® USA 900 and STOXX® Global 1800 ex USA
> indices. They select an alpha signal (a single factor, the **multifactor signal**[1], or the
> individual components used to create the factors) and then construct a portfolio that maximizes
> its exposure to that alpha signal, subject
>
> — [Multifactor strategies: Proving their worth in the factor investment landscap...](https://stoxx.com/multifactor-strategies-proving-their-worth-in-the-factor-investment-landscape)
>

---

## N

### Net Operating Assets (Changes in)

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="755 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 755</span>


> A quality signal measuring the year-over-year change in net operating assets
> (total assets minus cash minus total liabilities plus debt) scaled by lagged
> total assets. In STOXX quality scoring, a large increase in net operating
> assets is considered a negative signal — it suggests aggressive accounting or
> unsustainable asset growth.

if a company's balance sheet is rapidly expanding (excluding cash), it might be over-investing, over-acquiring, or using aggressive accounting. STOXX quality indices penalize this "asset bloat" because it often precedes poor returns.

$$
\Delta \text{NOA}_i = \frac{\text{NOA}_{t} - \text{NOA}_{t-1}}{\text{Total Assets}_{t-1}}
$$

> [!tip] Related terms
> [Accruals](#accruals), [Quality Factor](#quality-factor), [Dilution](#dilution)

> [!example]- Source excerpts (5)
>
> In such cases, the composition remains unchanged, but new weighting factors will be implemented.
> Market participants will be notified of such changes in a timely manner. 4.4.2. TURNOVER RATIO The
> annualized turnover ratio is defined as the median value of the daily traded volume to the free-
> float sha
>
> — [Stoxx World Equity Index Guide (PDF), p. 17](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)
>
> This responds to investors and traders buying or selling protection (puts) against increasing
> future moves, prompting changes in implied volatility. Although the main index VSTOXX 30 days is
> the most popular – and is usually referred to as “the VSTOXX” – eleven other main indic
>
> — [Monthly Index News August 2024 (PDF), p. 4](https://stoxx.com/monthly-index-news-august-2024)
>
> Factor Correlations (60 days) and Changes in Correlations (vs previous 60 days) 1. Correlations
> are unweighted and based on daily returns and changes in yield/spread over the past 60 business
> days. The lower left triangle of the matrix represents current correlations.
>
> — [Axioma Multi Asset Class Risk Monitor (PDF), p. 1](https://stoxx.com/axioma-multi-asset-class-risk-monitor)
>
> Note that Brazilian companies frequently seek shareholder approval to ratify even non-material
> changes in share capital. ISSGOVERNANCE.COM 4 of 19 BRAZIL PROXY VOTING GUIDELINES Change in
> Company Fiscal Term General Recommendation: Vote for reso
>
> — [Brazil Voting Guidelines (PDF), p. 4](https://www.issgovernance.com/file/policy/2021/americas/Brazil-Voting-Guidelines.pdf)
>
> No EWMA smoothing is applied.  Change in NOA is given by the negative of the monthly change in
> **net operating assets** divided by the 36-month rolling average of total assets, with **net
> operating assets** calculated as the monthly delta in operating assets (total assets
>
> — [Stoxx Index Guide (PDF), p. 587](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>

---

## P

### Price Momentum

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="17 mentions across STOXX & ISS pages (low)">▰▰ 17</span>


> The trailing total return of a security over a defined look-back window,
> typically 12 months with a 1-month skip. STOXX uses price momentum as the
> primary signal for its momentum factor indices, computed from adjusted closing
> prices to account for dividends and corporate actions.

price momentum is straightforward: how much has the stock gone up (or down) over the past year? The most recent month is skipped because very short-term returns tend to reverse rather than continue.

$$
\text{Price Mom}_i = \frac{P_{i,t-21}}{P_{i,t-252}} - 1
$$

(using trading days: skip the most recent ~21 days, look back ~252 days total)

> [!tip] Related terms
> [Momentum Factor](#momentum-factor), [Earnings Momentum](#earnings-momentum), [Factor Tilt](#factor-tilt)

> [!example]- Source excerpts (5)
>
> This ensures that the index is highly liquid. Companies must also rank among the top 80% in the
> HDAX universe, measured in terms of **price momentum**, excluding companies with a past price
> history of less than 12 months. Companies with a past price history stretching back less than 12
> months (e.g.,
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF), p. 73](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> O R A N D R iSTOXX® METHODOLOGY GUIDE 919/1024 127.iSTOXX APG WORLD MULTI- FACTOR AND RESPONSIBLE
> INDICES • **Price Momentum** is given by the sum of monthly local currency returns over the 12
> complete months prior to the review cut-off date, excluding the latest month.
>
> — [Istoxx Index Guide (PDF), p. 919](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> Their constituency is no longer simply determined by each stock’s domicile — but instead by a wide
> menu of variables ranging from revenue source to **price momentum** to the number of female board
> members. Big data has empowered the possibilities of index design, and stock selection relies on
> novel methodologies.
>
> — [The Index World and Twenty Years of Europe’s ETFs | STOXX](https://stoxx.com/the-index-world-and-twenty-years-of-europes-etfs)
>
> h, Connecticut, with almost $200 billion under management; it is known for its applied research in
> investment strategies. Large and significant alpha **Price momentum** is the well-researched
> observation that assets that have outperformed in the recent past will continue to do so in the
> immediate future, and vice ver
>
> — [Factor Performance Can Be Timed and Exploited, Study Finds Factor Performance...](https://stoxx.com/factor-performance-can-be-timed-and-exploited-study-finds-factor-performance-can-be-timed-and-exploited-study-finds)
>
> ted and weighted to maximize exposure to a multifactor signal created from the following five
> factors: Momentum The momentum score is calculated from **price momentum**, earnings momentum and
> earnings announcement drift (i.e., the difference between a stock’s performance on and immediately
> following an earnings annou
>
> — [STOXX Equity Factor Indices | STOXX](https://stoxx.com/solutions/stoxx-equity-factor-indices)
>

---

## Q

> [!quote]
> "In the short run the market is a voting machine, but in the long run it is a weighing machine."
> — **Benjamin Graham**

### Quality Factor

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="63 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 63</span>


> A composite factor that identifies companies with strong profitability, low
> leverage, stable earnings, and conservative accounting. STOXX defines quality
> using multiple sub-signals including return on equity (ROE), accruals ratio,
> change in net operating assets, and dilution. Sub-signals are standardized and
> combined into a single quality z-score.

quality is about separating well-run companies from poorly-run ones using financial statement data. High-quality companies earn strong profits on their assets, do not inflate earnings through accounting tricks, and avoid excessive debt.

$$
\text{Quality}_i = \frac{1}{M}\sum_{m=1}^{M} z_{i,m}
$$

where sub-signals $m$ include ROE, accruals, $\Delta$NOA, and dilution.

> [!tip] Related terms
> [Accruals](#accruals), [Dilution](#dilution), [Net Operating Assets (Changes in)](#net-operating-assets-changes-in), [Value Factor](#value-factor)

> [!example]- Source excerpts (5)
>
> ccruals, gross profitability and low investments to bottom-line profitability measures such as
> return-on-equity and margins. Behind the iSTOXX Europe **Quality Factor** Index The iSTOXX Europe
> **Quality Factor** Index assesses a company’s financial health through a combined approach based
> on profitability, leverage, and
>
> — [The Quality Factor | Blog posts | STOXX](https://stoxx.com/the-quality-factor)
>
> **Quality Factor**s: On a semi-annual basis in June and December, for all remaining stocks in each
> respective universe, the following **quality factor**s are calculated and two sets of percentile
> ranks are assigned to the following factors below, where rank 0 is the worst and rank 1 the best.
>
> — [Istoxx Index Guide (PDF), p. 269](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> Momentum Factor combines the Signals at 25%, 50% and 25% weights, respectively, and is again
> z-scored and truncated at +/-3 standard deviations. The **Quality Factor** is a composite of the
> following 6 Signals: Accruals, Dilution, Gross Profitability, Change in Net Operating Assets
> (NOA), Carbon Emissions Intensity,
>
> — [Stoxx Index Guide (PDF), p. 587](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> ESG portfolio construction comes from our recent work with Northern Trust’s FlexShares unit to
> produce indices that combine their own ESG scoring and **quality factor** methodology, with ISS
> climate data and Qontigo’s index construction and optimization capabilities.
>
> — [Flexible approach in use of ESG data is key driver in advancing sustainabilit...](https://stoxx.com/flexible-approach-to-use-of-esg-data-is-key-driver-in-advancing-sustainability-indices)
>
> The indices hold a short position in STOXX Europe 600 futures to help investors neutralize
> systematic risk. The iSTOXX® Europe **Quality Factor** Market Neutral Index had the highest
> return, at 1.2%. The iSTOXX Europe Factor Market Neutral Indices are designed to offer exposure to
> pure factor i
>
> — [Monthly Index News February 2021 (PDF), p. 23](https://stoxx.com/monthly-index-news-february-2021)
>

---

## R

### Risk Budget

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="6 mentions across STOXX & ISS pages (low)">▰▰ 6</span>


> The maximum contribution to total portfolio risk allocated to a single
> security, sector, or factor. STOXX risk-based indices enforce risk budgets
> during optimization — for example, no single stock may contribute more than
> a fixed percentage of total portfolio variance.

a risk budget is like a spending cap but for risk. Instead of saying "no stock above 5% of portfolio dollars," you say "no stock above 5% of portfolio risk." This is a more sophisticated way to control concentration because a small-weight volatile stock can contribute more risk than a large-weight stable one.

> [!tip] Related terms
> [Equal Risk Contribution](#equal-risk-contribution), [Risk Parity](#risk-parity), [Capping Constraint](#capping-constraint)

> [!example]- Source excerpts (5)
>
> Importantly, they show that the use of an optimizer and a risk model in the process can help
> reduce active risk, freeing up more of the **risk budget** to increase the allocation to
> sustainable holdings or to those expected to generate better returns. Brown and Stubbs analyze the
> risk profile of a po
>
> — [Green efficient frontiers: Minimizing the risk impact of exclusions in sustai...](https://stoxx.com/green-efficient-frontiers-minimizing-the-risk-impact-of-exclusions-in-sustainable-portfolios)
>
> ncrementally ‘layer in’ specific ESG filters (Exclusions, ESG Leaders, Carbon and SDI) allowing
> APG to measure and report on the impact on return and **risk budget** (measured by tracking error)
> for each of the individual criteria. The five customized indices launched are: - iSTOXX APG
> World-X Index - iSTOXX APG W
>
> — [APG and Qontigo Launch STOXX Family of Groundbreaking Responsible Indices: Bl...](https://stoxx.com/apg-and-qontigo-launch-stoxx-family-of-groundbreaking-responsible-indices)
>
> untry, and factor exposures that might emerge as an outcome of the sustainability targets; and the
> ability to measure and report on the impact of the **risk budget** on each of the ESG criteria or
> constraints. To meet all of these objectives, APG required a flexible and nimble partner with
> expertise in sustainable
>
> — [&quot;Layered&quot; Approach to ESG Results in Innovative Responsible Indices...](https://stoxx.com/layered-approach-to-esg-results-in-innovative-responsible-indices-for-apg)
>
> ng to deliver a persistent factor premium. In other words, it’s not about giving each factor the
> same weight — but rather giving them the appropriate **risk budget** within a diversified,
> long-term investment solution.” Can you briefly describe, in that context, how you build the
> multifactor portfolio? “We start b
>
> — [Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX a...](https://stoxx.com/qa-with-blackrock-fourth-year-of-multifactor-collaboration-with-stoxx-amid-evolving-factor-investing-landscape)
>
> nting a different ESG, carbon and Sustainable Development Investments (SDI) strategy and
> quantifying the resulting effect on a portfolio’s return and **risk budget**. The indices use
> Qontigo’s line of Axioma portfolio construction tools, STOXX index design capabilities and, for
> the first time ever, data derived fr
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

risk parity says: "Bonds are much less risky than stocks, so if you want equal risk contribution, you need to hold a lot more bonds (potentially using leverage) and fewer stocks." It is the multi-asset version of equal risk contribution.

> [!tip] Related terms
> [Equal Risk Contribution](#equal-risk-contribution), [Risk Budget](#risk-budget), [Maximum Diversification](#maximum-diversification)

> [!example]- Source excerpts (3)
>
> the basis to select the top third of stocks to be included in each individual risk-premium
> portfolio. The weighting of the stocks is determined by a risk-parity approach, whereby each
> constituent contributes equally to the overall risk of the portfolio.
>
> — [Equity Risk Premia with Academic Foundation | Blog posts | STOXX](https://stoxx.com/equity-risk-premia-with-academic-foundation)
>
> Within these individual factor portfolios of the EURO STOXX Multi Premia, a risk-parity approach
> is used to weight the individual securities. This promotes a high level of diversification and
> good risk-return efficiency.
>
> — [Q&amp;A: Credit Suisse’s Froehlich on Multi-Premia Investing | Blog posts | S...](https://stoxx.com/qa-credit-suisses-froehlich-on-multi-premia-investing)
>
> folio can be constructed by long positions in four non-market-cap-weighted schemes: a global
> minimum-variance portfolio, an equal-weight portfolio, a **risk parity** portfolio and a
> dividend-weighted portfolio; hedged via short positions in four respective market indices.4, 5
> DAX, the iconic blue-chip index for Ge
>
> — [What’s Behind the Edge in Equal-Weight Strategies? | Blog posts | STOXX](https://stoxx.com/whats-behind-the-edge-in-equal-weight-strategies)
>

---

> [!quote]
> "Risk and return are joined at the hip."
> — **Eugene Fama**

### Risk Premia

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="120 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 120</span>


> The excess return earned by bearing systematic, non-diversifiable risk
> associated with a specific factor. STOXX factor indices are designed to harvest
> risk premia — the value premium, momentum premium, quality premium, etc. —
> in a transparent, rules-based, and cost-efficient manner.

a risk premium is the reward investors receive for taking on a particular type of risk. The value premium, for example, compensates investors for holding cheap (often distressed) companies. Factor indices are tools for capturing these premiums systematically.

> [!tip] Related terms
> [Factor Investing](#factor-investing), [Factor (Definition)](#factor-definition), [Smart Beta](#smart-beta)

> [!example]- Source excerpts (5)
>
> ad and liquid universe of Eurozone equities that is the EURO STOXX® Index. Proven track record
> Testament to their well-researched drivers, all single **risk premia** have demonstrated their
> prowess in producing market-beating returns. Chart 1 shows the performance of the seven single
> premium indices since their da
>
> — [Equity Risk Premia with Academic Foundation | Blog posts | STOXX](https://stoxx.com/equity-risk-premia-with-academic-foundation)
>
> TOXX UNIVEST WORLD FACTOR INDEX OVERVIEW The iSTOXX Univest World Factor Index provides exposure
> to the Univest Value, Momentum, Quality and Low Risk risk-premia factors, closely tracks the STOXX
> Developed World parent index with an ex-ante tracking error of 1% while ensuring tradability and
> diversification. P
>
> — [Istoxx Index Guide (PDF), p. 710](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> Second, applying the methodology on a slightly narrower benchmark does not impede **risk premia**
> harvesting. Investors who prefer to incorporate ESG principles into their factor-based portfolios,
> can do so without sacrificing returns, whether act
>
> — [Combining ESG Screens and Factor Tilts: A Study on Portfolio Returns | Blog p...](https://stoxx.com/combining-esg-screens-and-factor-tilts-a-study-on-portfolio-returns)
>
> This is evidence that these are potentially more efficient vehicles for accessing factor **risk
> premia** than most current product offerings, the author wrote. Growing assets Smart beta and
> factor **risk premia** products have attracted strong flows in recen
>
> — [Study Shines Light on Smart Beta’s Effectiveness and Capacity | Blog posts | ...](https://stoxx.com/study-shines-light-on-smart-betas-effectiveness-and-capacity)
>
> The first of these indices is designed to exploit sources of market-excess returns, so-called
> **risk premia**, while filtering out companies deemed in contravention of ESG principles.
>
> — [Q&amp;A: UniCredit’s Kilian on ESG+Factor Strategies | Blog posts | STOXX](https://stoxx.com/qa-unicredits-kilian-on-esgfactor-strategies)
>

---

## S

> [!quote]
> "Small stocks outperform because they are riskier, and risk must be compensated."
> — **Eugene Fama**

### Size Factor

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="69 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 69</span>


> A factor that captures the historical tendency of smaller-capitalization stocks
> to outperform larger-capitalization stocks over long horizons. STOXX
> implements the size factor by selecting or overweighting constituents with
> lower free-float market capitalization within the parent universe.

small companies tend to grow faster than large ones, and their stocks have historically earned higher returns — though with more volatility. The size factor tilts toward these smaller names.

$$
\text{Size Score}_i = -\ln(\text{Market Cap}_i)
$$

Negative log ensures that smaller companies receive higher scores.

> [!tip] Related terms
> [Factor (Definition)](#factor-definition), [Smart Beta](#smart-beta), [Factor-Based Index](#factor-based-index)

> [!example]- Source excerpts (5)
>
> +7.1%). So far, this pattern has not continued in 2018. While February and March saw the STOXX®
> Europe 600 Index drop 5.7%, the iSTOXX Europe **Size Factor** Index lost ground by only 4.2%. The
> iSTOXX® Europe **Size Factor** Market Neutral Index, which neutralizes systematic risk by holding
> a short position in
>
> — [A Closer Look at the Size Factor | Blog posts | STOXX](https://stoxx.com/a-closer-look-at-the-size-factor)
>
> a year but goes through a quarterly so-called Fast Exit/Fast Entry review to account for
> significant changes in companies’ market capitalization. The **size factor** To many investors,
> small-caps are the holy grail of stock-picking. Often young companies in the early stages of
> expansion, with low analyst coverage
>
> — [Exploring SDAX, the benchmark for German small companies | Blog posts | STOXX](https://stoxx.com/exploring-sdax-the-benchmark-for-german-small-companies)
>
> ] MONTHLY INDEX NEWS / October ESG-X Factor Indices – Regional: Asia/Pacific Key Points Within the
> responsible-screened universe in Asia/Pacific, the **size factor** led losses during October, with
> the STOXX® Asia/Pacific 600 ESG-X Ax Size Index shedding 2.3%.
>
> — [Monthly Index News October 2020 (PDF), p. 22](https://stoxx.com/monthly-index-news-october-2020)
>
> TOXX Equity Factor indices upweight Quality. Value and Momentum are natural pairs, and so they
> have the same weight relative to each other. The Small **Size factor**, for its part, is a high
> beta, pro-cyclical factor, relative to the Low Volatility factor, which is low beta and a much
> more defensive factor.
>
> — [BlackRock’s Jamie Forbes: Implementing ‘evolutionary’ factor advancements in ...](https://stoxx.com/blackrocks-jamie-forbes-implementing-evolutionary-factor-advancements-in-investments)
>
> qual-weighted variant since 2002. Chart 2 Source: STOXX, total returns after taxes in USD, Mar.
> 18, 2002 – Oct. 31, 2018. From risk management to the **size factor** Various studies have put
> forward several explanations as to why an equal-weight strategy may outperform a
> market-cap-weighted one. One of the first a
>
> — [What’s Behind the Edge in Equal-Weight Strategies? | Blog posts | STOXX](https://stoxx.com/whats-behind-the-edge-in-equal-weight-strategies)
>

---

> [!quote]
> "Smart beta bridges the gap between active and passive investing."
> — **Cliff Asness**

### Smart Beta

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="84 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 84</span>


> An umbrella term for rules-based index strategies that deviate from
> traditional market-capitalization weighting in pursuit of improved risk-adjusted
> returns, lower risk, or enhanced diversification. STOXX's smart beta suite
> includes factor indices, risk-based indices (minimum variance, maximum
> diversification, equal risk contribution), and alternatively weighted indices
> (equal weight, fundamental weight).

smart beta sits between passive index investing and active management. You still follow transparent rules (like an index), but those rules are designed to be "smarter" than simply weighting by company size — for example, weighting by cheapness or equal risk.

> [!tip] Related terms
> [Factor Investing](#factor-investing), [Factor-Based Index](#factor-based-index), [Risk Premia](#risk-premia)

> [!example]- Source excerpts (5)
>
> It reflects our dedication to our clients and the innovative contribution we make to their
> businesses. Our smart-beta expertise in factor and thematic strategies allows us to address rising
> sophistication among Asian investors looking to diversify beyond traditional
>
> — [STOXX Awarded “Best Smart Beta Index Provider, Asia-Pacific” By SRP | Press r...](https://stoxx.com/stoxx-awarded-best-smart-beta-index-provider-asia-pacific-by-srp)
>
> In “An Aussie sense of style”, Axioma’s latest paper on **smart beta** products, we take a look at
> the inherent compromise between delivering target factor purity versus maximizing factor exposure.
>
> — [Smart Beta versus Dumb Alpha | Blog posts | STOXX](https://stoxx.com/smart-beta-versus-dumb-alpha)
>
> A new Qontigo report1 takes a comprehensive look at the market for ‘**smart beta**’ funds tracking
> factor strategies, to assess their prowess in boosting returns and their capacity as money inflows
> grow. The study by Frank Siu, Exec
>
> — [Study Shines Light on Smart Beta’s Effectiveness and Capacity | Blog posts | ...](https://stoxx.com/study-shines-light-on-smart-betas-effectiveness-and-capacity)
>
> IANCE INDICES 2 Characteristics of a minimum variance portfolio (MVP) There is a common
> misconception that minimum variance indices are just another “**smart beta**” product, but we
> would argue differently. Most indices can be used as building blocks as part of a greater
> portfolio and need to be used as such, bei
>
> — [Stoxx Minvar Paper (PDF), p. 7](http://www.stoxx.com/document/Others/marketing/STOXX_MinVar_Paper.pdf)
>
> Top among them are ETFs’ ease of use, market access, speed of execution, liquidity and low cost.
> **Smart beta** gains in popularity The share of institutional investors who invest in
> non-market-cap weighted ETFs, which seek to exploit specific sources of premia
>
> — [European Investors Expand Use of ETFs, Survey Finds | Blog posts | STOXX](https://stoxx.com/european-investors-expand-use-of-etfs-survey-finds)
>

---

### Tracking Error Budget

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1 mentions across STOXX & ISS pages (ultra-low)">▰ 1</span>


> The maximum permissible ex-ante tracking error (annualized standard deviation
> of active returns) between the factor index and its parent benchmark. STOXX
> factor indices may impose a tracking error constraint during optimization —
> for example, limiting tracking error to 3% or 5% — to ensure the factor
> portfolio does not deviate too aggressively from the benchmark.

tracking error measures how differently the factor index behaves compared to the plain market index. A tracking error budget is the maximum amount of deviation allowed. A tight budget (e.g., 2%) produces a portfolio close to the benchmark; a loose budget (e.g., 6%) allows aggressive factor bets.

$$
\text{TE} = \sqrt{(w - w_{\text{bench}})^\top \Sigma (w - w_{\text{bench}})} \leq \text{TE}_{\max}
$$

> [!tip] Related terms
> [Active Industry Constraint](#active-industry-constraint), [Turnover Constraint](#turnover-constraint), [Factor Tilt](#factor-tilt)

> [!example]- Source excerpts (1)
>
> may change over time, DWS’ Schiele said. “As investors become more comfortable with a particular
> topic, they will also, over time, allow for a higher **tracking error budget**” in their bespoke
> solutions, he said. More targeted themes Rounding off, the panelists mentioned some of the big
> trends they see in sustainability in
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

every time the index rebalances, stocks are bought and sold. Excessive trading raises costs (commissions, market impact) that eat into returns. A turnover constraint forces the optimizer to make only modest changes at each rebalance.

$$
\text{Turnover} = \frac{1}{2}\sum_i |w_{i,t}^{+} - w_{i,t}^{-}| \leq \tau_{\max}
$$

where $w^{+}$ and $w^{-}$ are post- and pre-rebalancing weights.

> [!tip] Related terms
> [Capping Constraint](#capping-constraint), [Security Weight Cap](#security-weight-cap), [Tracking Error Budget](#tracking-error-budget)

> [!example]- Source excerpts (5)
>
> STOXX FACTOR INDICES Maximum turnover: The indices have a 12.5% one-way **turnover constraint**,
> or 25% two-way. This means up to 12.5% of the portfolio is sold in order to purchase other
> constituents (absolute maximum annual turnover is 100%).
>
> — [Stoxx Index Guide (PDF), p. 585](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> STOXX FACTOR INDICES Maximum turnover: The indices have a 12.5% one-way **turnover constraint**,
> or 25% two-way. This means up to 12.5% of the portfolio is sold in order to purchase other
> constituents (absolute maximum annual turnover is 100%).
>
> — [Stoxx Index Guide (PDF), p. 585](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> re 1: Components of the Multifactor signal in the STOXX Equity Factor indices Risk premium The
> paper reviews the risk management, diversification and **turnover constraint**s built into the
> index methodology, a process that upholds the harvesting of the factor premium in an investable
> and repeatable framework. One of the
>
> — [A behind-the-scenes look at the STOXX Equity Factor indices | Blog posts | STOXX](https://stoxx.com/a-behind-the-scenes-look-at-the-stoxx-equity-factor-indices)
>
> ment 3.75% Index » February 2019 (2): Addition of iSTOXX Developed and Emerging Markets ex USA PK
> VN Real Estate Index » February 2019 (3): Change of **turnover constraint** and quality filter for
> both iSTOXX A.C.I. USA Pure Growth Index and iSTOXX A.C.I.
>
> — [Istoxx Index Guide (PDF), p. 32](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> eighted average days-to-trade ratio threshold for securities to avoid material build-ups in
> illiquid positions. The indices also have a 12.5% one-way **turnover constraint** per quarter,
> meaning that a maximum of 12.5% of the current index weight can be changed to meet the overall
> index objectives, using the latest data a
>
> — [Eurex to List Futures on STOXX Industry Neutral Ax Factor Indices | Blog post...](https://stoxx.com/eurex-to-list-futures-on-stoxx-industry-neutral-ax-factor-indices)
>

---

## V

> [!quote]
> "Price is what you pay; value is what you get."
> — **Warren Buffett**

### Value Factor

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="75 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 75</span>


> A factor that identifies undervalued securities by ranking them on fundamental
> valuation ratios. STOXX value indices typically use a composite of book-to-
> price, earnings-to-price, and dividend yield. Securities with high composite
> value scores are overweighted on the premise that the market systematically
> underprices cheap, out-of-favor stocks.

the value factor is the quantitative version of "buy low." It looks for stocks that are cheap relative to their fundamentals — low price compared to earnings, book value, or dividends — and bets that these bargains will eventually be recognized by the market.

$$
\text{Value Score}_i = \frac{1}{3}\left(z_{\text{B/P},i} + z_{\text{E/P},i} + z_{\text{D/P},i}\right)
$$

where B/P = book-to-price, E/P = earnings-to-price, D/P = dividend yield.

> [!tip] Related terms
> [Quality Factor](#quality-factor), [Factor (Definition)](#factor-definition), [Smart Beta](#smart-beta)

> [!example]- Source excerpts (5)
>
> ized ratio is set to -4 - with fundamental ratios not available, the normalized ratio is set to -4
> After normalization, for each stock i, a composite **value factor** is calculated as an average of
> the three normalized fundamental ratio as follows: (B̂PR +ÊPR +ĈFPR ) i i i Composite **value
> factor** = i 3 After apply
>
> — [Istoxx Index Guide (PDF), p. 259](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> At the other end, the STOXX® Global 1800 Technology Index gained 3%. Size and **Value factor**s
> post heavy losses Most factor-based strategies provided outperformance relative to markets during
> November, according to the STOXX Factor Indices.
>
> — [Stocks drop in November amid emergence of Omicron virus variant | Blog posts ...](https://stoxx.com/stocks-drop-in-november-amid-emergence-of-omicron-virus-variant)
>
> This multi-signal approach avoids the overreliance on any single distorted metric that can
> negatively impact returns.” Figure 1: Active returns – USA **Value factor** “Momentum is another
> compelling example. Traditionally, it’s been defined using a stock’s simple, 12-month share-price
> appreciation, excluding the mo
>
> — [Q&amp;A with BlackRock: fourth year of multifactor collaboration with STOXX a...](https://stoxx.com/qa-with-blackrock-fourth-year-of-multifactor-collaboration-with-stoxx-amid-evolving-factor-investing-landscape)
>
> The Quality Factor combines the Signals at 20%, 20%, 20%, 20%, 13%, and 7% weights, respectively,
> and is again z-scored and truncated. The **Value Factor** is a composite of the following 5
> Signals: Book to Price, Cash Flow Yield, Time Series Normalized Cash Flow Yield, Dividend Yield
> and Earnings Yield.
>
> — [Stoxx Index Guide (PDF), p. 588](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> The index targets cheap stocks with high growth potential based on earnings and dividends. The
> iSTOXX® Europe **Value Factor** Market Neutral Index, meanwhile, posted a ninth consecutive
> monthly retreat. The iSTOXX Europe Factor Market Neutral Indices are designed to offer ex
>
> — [Monthly Index News October 2019 (PDF), p. 7](https://stoxx.com/monthly-index-news-october-2019)
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

the yield factor targets stocks that return the most cash to investors through dividends and share repurchases. It is related to the carry factor but broader — carry focuses on dividend income, while yield also credits companies that buy back their own shares.

$$
\text{Shareholder Yield}_i = \frac{D_i + \text{Net Buybacks}_i}{P_i}
$$

where $D_i$ is dividends per share, Net Buybacks is repurchases minus issuance, and $P_i$ is the share price.

> [!tip] Related terms
> [Carry Factor](#carry-factor), [Value Factor](#value-factor), [Quality Factor](#quality-factor)

> [!example]- Source excerpts (1)
>
> Negative active exposures include those to the Dividend Yield, Exchange Rate Sensitivity and
> Earnings **Yield factor**s. Figure 8: Active style-factor exposures Conclusion The STOXX Global
> Artificial Intelligence index helps investors track a specific thematic segment
>
> — [The AI revolution is taking place now – a look inside the STOXX Global Artifi...](https://stoxx.com/the-ai-revolution-is-taking-place-now-a-look-inside-the-stoxx-global-artificial-intelligence-index)
>

---

> [!note] Methodology Disclaimer
> The definitions, formulas, and descriptions above are synthesized from publicly
> available STOXX and Qontigo methodology guides and research. For authoritative
> and up-to-date specifications, always consult the official rulebook for each
> specific index at [stoxx.com](https://stoxx.com/).
