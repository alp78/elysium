---
title: "Index Construction"
description: "Comprehensive glossary of index construction terms extracted from STOXX and ISS Governance documentation."
tags:
  - stoxx
  - iss
  - financial-domain
  - glossary
  - index-construction
aliases:
  - "Index Construction Glossary"
date: 2026-03-28
---

# Index Construction — ISS & STOXX Glossary

> [!abstract] About This Section
> This glossary covers index construction methodology, weighting schemes, rebalancing
> rules, selection criteria, calculation formulas, and reconstitution processes. Terms
> are sourced from [STOXX](https://stoxx.com/) and [ISS Governance](https://www.issgovernance.com/)
> official documentation, methodology guides, and publications.
>
> **~60 terms** across multiple sources.

---

## A

### Adjusted Free-Float Market Capitalization

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="5 mentions across STOXX & ISS pages (ultra-low)">▰ 5</span>


> The product of a security's price, its total shares outstanding, and its free-float factor, representing the portion of market value available for public trading after excluding strategic, locked-in, or restricted holdings.

Adjusted free-float market capitalization is the standard measure STOXX uses to determine a constituent's weight within a capitalization-weighted index. By removing shares held by insiders, governments, or cross-holdings, the figure reflects only the investable portion of a company's equity. This prevents indices from overweighting companies where a large fraction of shares is illiquid or unavailable to the market.

$$
\text{AFFMC}_i = P_i \times S_i \times f_i
$$

Where $P_i$ is the closing price of security $i$, $S_i$ is total shares outstanding, and $f_i$ is the free-float factor (a value between 0 and 1).

> [!tip] Related terms
> [[#Free-Float]], [[#Free-Float Factor]], [[#Free-Float Market Capitalization Weighting]], [[#Capping Factor]]

> [!example]- Source excerpts (3)
>
> s designed to minimize G the sum of the squares of the relative errors (SSE) over all the assets
> in the Target Portfolio, where the relative error for an asset is the difference between its index
> and Target Portfolio weights E scaled by the Target Portfolio weight. M The Target portfolio is
> the FOL-**adjusted free-float market capitalization**-weigh...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> in the portfolio, the issuer’s weight is calculated by summing the adjusted free float market
> capitalization of all its eligible listings and the overall weight calculated for the issuer,
> according to the steps outlined below. This final weight is then allocated to each share line
> according to its **adjusted free-float market capitalization**. Weigh...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> in the portfolio, the issuer’s weight is calculated by summing the adjusted free float market
> capitalization of all its eligible listings and the overall weight calculated for the issuer,
> according to the steps outlined below. This final weight is then allocated to each share line
> according to its **adjusted free-float market capitalization**. Weigh...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>

---

### Announcement Date

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="27 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 27</span>


> The calendar date on which an index provider publicly discloses the results of a periodic review, including additions, deletions, and share or free-float factor changes, before they become effective.

The announcement date gives market participants advance notice of upcoming index changes so they can prepare trades and manage tracking portfolios. STOXX typically announces review changes several trading days before the effective date. The gap between announcement and implementation is critical for reducing market impact and allowing orderly rebalancing by passive funds.


- [Dax Equity Calculation Guide 20231002 (PDF)](https://www.stoxx.com/document/News/2023/October/DAX%20Equity%20Calculation%20Guide_20231002.pdf)
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
- [Hong Kong Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2022/asiapacific/Hong-Kong-Voting-Guidelines.pdf)
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)


> [!example]- Source excerpts (5)
>
> dual index methodologies of this rule book. 5.16.2. LIQUIDITY SCALING FACTORS Liquidity scaling
> factors are used in the STOXX Optimised indices. The factor is based on the average daily turnover
> (ADTV) of the stock over the most recent three-month period, measured one day before the
> underlying data **announcement date**. The factor is kept constant ...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> based on the most recent available data. The final data are published on the quarterly underlying
> data **announcement date**s and implemented on the quarterly implementation dates. The review
> cut-off date for free float and number of shares data is the trading day prior to the quarterly
> underlying data **announcement date**, i.e. usually the Thursday be...
>
> — [Dax Equity Calculation Guide 20231002 (PDF)](https://www.stoxx.com/document/News/2023/October/DAX%20Equity%20Calculation%20Guide_20231002.pdf)
>
> ng categories: (i) the ultimate controller, controlling shareholder and/or related parties
> controlled by them; (ii) investors who will obtain control over the company after the private
> placement; and (iii) strategic investors, the pricing reference date can be either the
> corresponding board meeting **announcement date**, the shareholder meeting anno...
>
> — [Hong Kong Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2022/asiapacific/Hong-Kong-Voting-Guidelines.pdf)
>
> cation dates to reflect extraordinary market movements and underlying data changes. 5.7 Index
> Review Lists Each index has defined dates, when the new constituents and the underlying data
> (shares, free- float, weighting-cap factors) is announced and implemented. The component and the
> underlying data **announcement date**s differ by index category and...
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>
> eighted to maximize exposure to a multifactor signal created from the following five factors:
> Momentum The momentum score is calculated from price momentum, earnings momentum and earnings
> announcement drift (i.e., the difference between a stock’s performance on and immediately
> following an earnings **announcement date**). Quality The quality score i...
>
> — [STOXX Equity Factor Indices | STOXX](https://stoxx.com/solutions/stoxx-equity-factor-indices)
>

---

## B

### Backfill

> The retroactive insertion of historical index data for a period before an index was officially launched, generated by applying the current methodology to historical market data.

Backfill (or back-population) extends an index's time series prior to its live date by simulating historical constituency, weights, and levels using the same rules that govern the live index. STOXX clearly labels backfilled data in its publications to distinguish it from live-calculated values. Investors should exercise caution when interpreting backfilled performance, as it may embed look-ahead bias, survivorship bias, or rely on data sources that were unavailable at the time.

> [!tip] Related terms
> [[#Simulation]], [[#Live Date]], [[#Base Date]]
---

### Base Date

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="136 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 136</span>


> The reference calendar date from which an index's historical performance begins, serving as the temporal anchor for the index level series.

The base date is the starting point of an index's time series. On this date the index is assigned its base value (e.g., 100 or 1,000), and all subsequent index levels are expressed relative to this starting point. Choosing a meaningful base date allows users to interpret index returns as cumulative performance since inception. STOXX indices typically specify both a base date and a base value in their rulebooks.

> [!tip] Related terms
> [[#Base Value]], [[#Index Level]]

> [!example]- Source excerpts (5)
>
> : Price return in EUR Dissemination calendar: STOXX Europe calendar Base values and dates: 100 as
> of December 19, 2008 Reset dates: First dissemination date following the third Friday in December.
> 26.3. CALCULATION On any Dissemination Day t the index value is calculated as follows: 𝐼𝑉 =100 if
> t is **base date** 𝑡 {𝐼𝑉 𝑡 = 𝐼𝑉 𝑡−1 +100∗ 𝑟 𝑑𝑖𝑠𝑝,𝑡 if 𝑡 ...
>
> — [Stoxx Strategy Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_strategy_guide.pdf)
>
> X VALUE CALCULATION The daily return of the index is calculated as the daily return of the
> underlying Euro Stoxx 50, plus the dividend yield, plus the daily variation in the value of the
> option portfolio In formula: 100 𝑡 =0 𝐼 𝑡 ={ 𝑆 𝑡 +∆𝑂𝑃𝐿 𝑡 𝐼 ∗( +𝐷𝑖𝑣 ) 𝑡 >0 𝑡−1 𝑆 𝑡 𝑡−1 Where: • 𝑡
> =0 is the index **base date**, as defined in section 0 • 𝑆 is the c...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> hose assets which are deemed to be ‘blue chip’ in terms of quality, activity, robustness and
> financial strength. INDEX INFORMATION The index is calculated as a price weighted index with
> capped weighting factors, in accordance with Laysperes formula as described in section 3.8. Index
> Base Values and **Base Date**s: 1000 as of 22/03/2021. Index Types ...
>
> — [Stoxx Digital Asset Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_digital_asset_guide.pdf)
>
> 0A0S3P68 3LEW Price DE000A0S3P19 3LER Deutsche Börse EUROGOV Germany 3-5 Total Return DE000A0S3P76
> 3LEX Price DE000A0S3P27 3LES Deutsche Börse EUROGOV Germany 5-10 Total Return DE000A0S3P84 3LEY
> Price DE000A0S3P35 3LET Deutsche Börse EUROGOV Germany 10+ Total Return DE000A0S3P92 3LEZ 3.3.
> BASIS The **base date** of EUROGOV® indices is 31 January 199...
>
> — [Guide To Eurogov Bond Indices (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/Guide_to_EUROGOV_Bond_Indices.pdf)
>
> = Number of shares of company i on the i0 trading day before the first inclusion in the index q =
> Number of shares of company i at iT time T t = calculation time of the index K = Index-specific
> chaining factor valid as T of chaining date T T = Date of the last chaining Base = value of the
> index at **base date** The formula set out below is equivalen...
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>

---

### Base Value

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="693 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 693</span>


> The numerical level assigned to an index on its base date, from which all subsequent index levels are derived as a ratio of current aggregate market value to the original aggregate market value.

The base value is an arbitrary scaling constant — commonly set to 100, 1,000, or 5,000 — that makes the index level easy to read and compare. It has no economic meaning in itself; it merely anchors the level on the base date. Every STOXX index rulebook specifies both the base date and the base value, enabling users to compute cumulative returns over any period.

> [!tip] Related terms
> [[#Base Date]], [[#Index Level]], [[#Divisor]]

> [!example]- Source excerpts (5)
>
> Universe: The index universe is defined as all stocks from the STOXX World AC Universal All Cap
> Index. Weighting scheme: The index is weighted proportionally to the free-float market cap of
> selected stocks multiplied by the aggregate revenue exposure of each stock to the RBICS sectors
> listed below. **Base value**s and dates: 100 on 18 June 2012. Ind...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> 0% INDEX OVERVIEW The iSTOXX Global Healthcare ESG Exclusions Select 30 NR Risk Control 10% Index
> replicates the performance of a risk control overlay applied to the iSTOXX Global Healthcare ESG
> Exclusions Select 30 Index that targets 10% volatility. Index types and currencies: Excess return
> in EUR **Base value**s and dates: 100 on March 25, 2015. D...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> the standard net return index. The decrement index may perform better than the standard price
> index that does not consider dividend investments as long as the overall net dividend yield of the
> base index is greater than the value being subtracted. The base index is the DAX 50 ESG Net Return
> Index. **Base value** and dates: 1000 on September 24, 2012...
>
> — [Dax Strategy Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)
>
> hip Index. By incorporating only Xetra eligible tokens, the index ensures a fully replicable and
> transparent investment product. INDEX INFORMATION The index is calculated as a price weighted
> index with capped weighting factors, in accordance with Laysperes formula as described in section
> 3.8. Index **Base Value**s and Base Dates: 1000 as of 22/03/20...
>
> — [Stoxx Digital Asset Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_digital_asset_guide.pdf)
>
> OGOV Germany 3-5 Total Return DE000A0S3P76 3LEX Price DE000A0S3P27 3LES Deutsche Börse EUROGOV
> Germany 5-10 Total Return DE000A0S3P84 3LEY Price DE000A0S3P35 3LET Deutsche Börse EUROGOV Germany
> 10+ Total Return DE000A0S3P92 3LEZ 3.3. BASIS The base date of EUROGOV® indices is 31 January 1999
> with a **base value** of 100. 1 Each inclusive maturity-mi...
>
> — [Guide To Eurogov Bond Indices (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/Guide_to_EUROGOV_Bond_Indices.pdf)
>

---

### Basis Point (Index)

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="6 mentions across STOXX & ISS pages (low)">▰▰ 6</span>


> A unit of measurement equal to one hundredth of one percent (0.01%), commonly used to express small changes in index levels, tracking error, or fee differentials.

In index construction, basis points provide a precise vocabulary for discussing weight changes, tracking tolerances, and return differences. For example, an index constituent whose weight changes from 3.50% to 3.55% has experienced a 5 basis-point increase. STOXX methodology documents frequently express capping thresholds, buffer tolerances, and turnover targets in basis-point terms.

$$
1 \text{ bp} = 0.01\% = 0.0001
$$

> [!tip] Related terms
> [[#Index Point]], [[#Tracking Error]], [[#Capping]]

> [!example]- Source excerpts (5)
>
> September 2019 ESG-X Indices Key points The STOXX ESG-X Indices performed largely in line with
> their benchmarks during September. The STOXX® Global 1800 ESG-X Index underperformed by less than
> 1 **basis point**. The ESG-X indices are versions of traditional, market-capitalization-weighted
> benchmarks that observe standard responsible exclusions of le...
>
> — [Monthly Index News September 2019 (PDF)](https://stoxx.com/monthly-index-news-september-2019)
>
> an alter investors’ risk appetite. Schon runs a stress test2 on the Global Smart City
> Infrastructure Index to assess the hypothetical effect by sector of five macro shocks: - a rise of
> 0.5% in the 10-year US Treasury nominal yield - a rise of 0.5% in the break-even inflation rate -
> an additional 25-**basis point** hike in the Fed Funds target rate b...
>
> — [Ukraine crisis: Looking at recent market performance through a thematic inves...](https://stoxx.com/ukraine-crisis-looking-at-recent-market-performance-through-a-thematic-investing-lens)
>
> iverse of stocks. 1 All results are total returns before taxes unless specified. 2 Throughout the
> article, all European indices are quoted in euros, while global, North America, US, Japan and
> Asia/Pacific indices are in dollars. 3 CNBC, ‘Powell says taming inflation ‘absolutely essential,’
> and a 50 **basis point** hike possible for May,’ April 21, 2...
>
> — [Stocks tumble most since 2020 in April amid interest-rate concerns | Blog pos...](https://stoxx.com/stocks-tumble-most-since-2020-in-april-amid-interest-rate-concerns)
>
> raises the cost of replicating the index versus the benchmark. The authors therefore take to
> estimate the cost of switching out of the benchmark and into the ESG index at each quarterly
> review, expressing it as a percentage of the portfolio’s value.4 Since launch the cost has
> remained well below 1 **basis point** (bp) on all occasions but one (Figur...
>
> — [New Whitepaper Looks at Trading Characteristics of EURO STOXX 50 ESG Index | ...](https://stoxx.com/new-whitepaper-looks-at-trading-characteristics-of-euro-stoxx-50-esg-index)
>
> roduce better active exposure to the ESG Score and the ESG Risk Score metrics increases as the
> portfolio goes up the tracking error scale, the study showed. A portfolio with 200 basis points of
> tracking error, regardless of industry constraints, has about twice the exposure to the ESG Score
> of a 50-**basis point** portfolio, and more than three time...
>
> — [Qontigo whitepaper examines the sustainability accomplishments of ESG funds |...](https://stoxx.com/qontigo-whitepaper-examines-the-sustainability-accomplishments-of-esg-funds)
>

---

### Benchmark Index

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="165 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 165</span>


> A broadly representative, rules-based index that serves as a standard reference point for measuring the performance of investment portfolios, defining asset allocation, or constructing derivative instruments.

Benchmark indices are the flagship products of index providers. STOXX benchmark indices — such as the EURO STOXX 50, STOXX Europe 600, and STOXX Global 1800 — are designed to capture the performance of a defined market segment with high coverage and investability. They underpin trillions of euros in passive assets, ETFs, futures, and options. Benchmark status typically requires broad market acceptance, regulatory compliance (e.g., EU BMR), and transparent, rules-based construction.

> [!tip] Related terms
> [[#Rules-Based Index]], [[#Index Universe]], [[#Free-Float Market Capitalization Weighting]]

> [!example]- Source excerpts (5)
>
> ne with international standards and new qualification criteria for the German **benchmark index**,
> which tracks the largest listed companies on the German capital market. Stephan Flaegel, Global
> Head of Benchmarks & Indices The main results on changing the index rulebook are: - From September
> 2021, the **benchmark index** DAX will be expanded by ten mem...
>
> — [German Benchmark Index DAX Will be Strengthened by Additional Qualification C...](https://stoxx.com/german-benchmark-index-dax-will-be-strengthened-by-additional-qualification-criteria-and-harmonization-with-international-standards)
>
> ZUG, July 29, 2020 – Qontigo has licensed the STOXX Europe 600 Paris-Aligned **Benchmark Index**
> to Franklin Templeton as an underlying for an ETF. The index is part of the recently launched
> family of STOXX Paris-Aligned Benchmark (PAB) Indices. These indices help reduce exposure to
> climate-related financial risks and include companies that are well...
>
> — [STOXX Europe 600 Paris-Aligned Benchmark Index Licensed To Franklin Templeton...](https://stoxx.com/stoxx-europe-600-paris-aligned-benchmark-index-licensed-to-franklin-templeton)
>
> The securities’ weights are derived through an optimization process and designed to meet the
> following requirements: EU PAB Minimum requirements STOXX Paris-Aligned Benchmark Indices Minimum
> Scope 1+2+3 GHG intensity reduction At least 60% (includes a 10% buffer) compared to the
> corresponding STOXX **Benchmark Index** The GHG intensity of a security...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> August 2018 STOXX Benchmark Indices Key points The STOXX® Global 1800 Index rose 1.2% in August,
> as gains in US stocks more than offset declines elsewhere. The **benchmark index** is now 2.3%
> below its January high when measured in US dollars. Eurozone stocks declined as some of the
> region’s largest banks suffered from a sell-off in emerging-market ...
>
> — [Monthly Index News August 2018 (PDF)](https://stoxx.com/monthly-index-news-august-2018)
>
> EU CTB) requirements outlined by the TEG on climate benchmarks. Those requirements are designed
> such that the resulting CTB portfolio is on a decarbonization trajectory. The STOXX CTBs covering
> the global market and Europe also topped their benchmarks during June. The EURO STOXX® Climate
> Transition **Benchmark Index**, for example, returned over 1 p...
>
> — [Monthly Index News June 2020 (PDF)](https://stoxx.com/monthly-index-news-june-2020)
>

---

### Buffer Rule

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="69 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 69</span>


> A threshold band applied during periodic reviews that allows existing constituents to remain in the index even if they marginally fail to meet the standard selection criteria, thereby reducing unnecessary turnover.

Buffer rules create a zone of tolerance around the selection threshold. For example, an index that selects the top 50 stocks by market capitalization might retain a current constituent as long as it ranks within the top 60, while a new entrant must rank within the top 40 to be added. This asymmetry prevents excessive churn caused by securities oscillating around the selection boundary, which would increase transaction costs for tracking portfolios.

> [!tip] Related terms
> [[#Fast Entry Rule]], [[#Fast Exit Rule]], [[#Reconstitution]], [[#Turnover]]

> [!example]- Source excerpts (5)
>
> M percentage is calculated. New components within the first 40% pass the relative ADTV 6M screen.
>  The annualized Turnover Ratio is defined as the median value of the daily traded volume to the
> free-float shares ratio over a specific period (the last 6 months or 12 months), multiplied by
> 252. A 5% **buffer rule** is applied to reduce the number of ...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> M percentage is calculated. New components within the first 40% pass the relative ADTV 6M screen.
>  The annualized Turnover Ratio is defined as the median value of the daily traded volume to the
> free-float shares ratio over a specific period (the last 6 months or 12 months), multiplied by
> 252. A 5% **buffer rule** is applied to reduce the number of ...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> ETHODOLOGY GUIDE 679/1024 89. iSTOXX WORLD A INDEX a full market cap greater (smaller) than the
> upper (lower) global consistency bound, securities with full market cap greater (smaller) or equal
> than the upper (lower) global consistency bound are added (removed). - To reduce turnover, the
> following **buffer rule** is applied: o Only securities with ...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> e widest coverage among flagship European benchmarks in the industry in terms of market
> capitalization and number of components.[3] A liquidity filter[3] supports the tradability of the
> index’s portfolio, while a quarterly review based on clear rules gives it a continuous pulse on
> market changes. A **buffer rule** ensures a moderate turnover at each...
>
> — [STOXX Europe 600 index – The continent&#039;s benchmark | Blog posts | STOXX](https://stoxx.com/stoxx-europe-600-index-the-continents-benchmark)
>
> lest security has a full company market cap greater (smaller) than the upper (lower) global
> consistency bound, securities with full company market cap greater (smaller) or equal than the
> upper (lower) global consistency bound are added (removed). - Turnover buffer: To reduce turnover,
> the following **buffer rule** is applied to existing components: ...
>
> — [Stoxx World Equity Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)
>

---

## C

### Capping

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="883 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 883</span>


> The process of imposing a maximum weight constraint on individual constituents or groups of constituents within an index to ensure diversification and regulatory compliance.

Capping prevents any single security or issuer from dominating an index. STOXX applies capping at each periodic review and, for certain indices, on a more frequent basis. For UCITS-compliant indices, the 5/10/40 rule applies: no single constituent may exceed 10% weight, and all constituents above 5% may not collectively exceed 40%. Capping is implemented by adjusting each constituent's weight to satisfy these constraints while maintaining market-cap ranking order wherever possible.

$$
w_i^{\text{capped}} = \min\!\left(w_i^{\text{uncapped}},\; W_{\max}\right)
$$

Where $w_i^{\text{uncapped}}$ is the raw weight and $W_{\max}$ is the cap limit. After capping, excess weight is redistributed proportionally among uncapped constituents, and the process iterates until all constraints are satisfied.

> [!tip] Related terms
> [[#Capping Factor]], [[#Weighting Scheme]], [[#Free-Float Market Capitalization Weighting]]

> [!example]- Source excerpts (5)
>
> - New **capping** rule will apply for DAX, MDAX, SDAX and TecDAX - Applicable for the first time
> with the index review March 2024 (Zug, November 22, 2023) – STOXX Ltd. will adjust the **capping**
> in the DAX index family from 10 to 15 per cent. This was preceded by a broad market consultation
> which lasted from 11
>
> — [DAX capping will be adjusted to 15 per cent | Press releases | STOXX](https://stoxx.com/dax-capping-will-be-adjusted-to-15-per-cent)
>
> Results of Market Consultation Zug, November 22nd, 2023 Results of Market Consultation on raising
> the DAX **capping** limit from 10% to 15% and the introduction of additional DAX **capping**
> functionalities Dear Sir and Madam, STOXX Ltd. announces the results of the market consultation on
> raising the DAX capping limit from 10% to 15% and the introductio...
>
> — [Results Of Market Consultation Dax Capping Limit 20231122 (PDF)](https://www.stoxx.com/document/Resources/MarketConsultation/Results_of_Market_Consultation_DAX_Capping_limit_20231122.pdf)
>
> G score and the top 600 companies make up the Composition List. In the event that two companies
> have identical ESG scores, the constituent with the higher free-float market capitalization is
> given priority. Review frequency: The components are reviewed annually in September. Shares, Free
> Float, and **Capping** are reviewed quarterly. For the **capping**...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> & Gas, Thermal Coal, Nuclear Power and Tobacco. Universe: The index universe is defined as all
> stocks from the STOXX World AC Universal All Cap Index. Weighting scheme: The index is
> price-weighted with weighting factors based on free-float market capitalization with group,
> company and SI commitment **capping**. Base value and date: 1000 on June 20, ...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> DAX EQUITY INDEX METHODOLOGY GUIDE 21/120 5. STOCK CHARACTERISTICS If other constituents of the
> index are breaching the 15% threshold due to the combined weight of the group entity, then the
> constituents shall also be capped respectively. This group entity **capping** rule shall only
> apply at quarterly index reviews. An intra-quarter **capping** of grou...
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>

---

### Capping Factor

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="105 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 105</span>


> A multiplicative coefficient applied to a constituent's weight at each rebalancing to enforce the index's maximum weight constraint, where a value of 1.0 means no adjustment and values below 1.0 indicate the constituent has been scaled down.

The capping factor is the operational mechanism through which capping is implemented. STOXX calculates these factors during each review or capping event and publishes them alongside share counts and free-float factors. The capped weight of a constituent equals its uncapped weight multiplied by its capping factor.

$$
w_i^{\text{capped}} = \text{CF}_i \times w_i^{\text{uncapped}}, \quad 0 < \text{CF}_i \le 1
$$

> [!tip] Related terms
> [[#Capping]], [[#Free-Float Factor]], [[#Divisor Adjustment]]

> [!example]- Source excerpts (4)
>
> weighted average, if it is larger than that average. 5.16.3. **CAPPING FACTOR**S THAT IMPLEMENT
> FOREIGN OWNERSHIP RESTRICTIONS The foreign restrictions adjusted free float is implemented via a
> **capping factor** in the sense of Section 4.1 General Definitions of the STOXX Reference
> Calculations Guide. The capping factor is defined as Capping factor = fo...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> weighted average, if it is larger than that average. 5.16.3. **CAPPING FACTOR**S THAT IMPLEMENT
> FOREIGN OWNERSHIP RESTRICTIONS The foreign restrictions adjusted free float is implemented via a
> **capping factor** in the sense of Section 4.1 General Definitions of the STOXX Reference
> Calculations Guide. The capping factor is defined as Capping factor = fo...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> (i.e. shares, free-floats and cap factors) are announced after close on the seventh dissemination
> day prior to the review implementation. This applies only for the STOXX World AC Universal All Cap
> Index, and the derived cap weighted benchmark indices, described in Chapter 6. For the calculation
> of **capping factor**s, the closing prices on the disse...
>
> — [Stoxx World Equity Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)
>
> 1. EURO iSTOXX ENVIRONMENTAL 50 EQUAL WEIGHT INDEX Review frequency: The reviews are conducted on
> a quarterly basis in March, June, September and December. The review cut-off date for the
> underlying data is the last dissemination day of February, May, August and November respectively.
> Weighting and **capping factor**s: The constituents are equal wei...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>

---

### Chaining

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="16 mentions across STOXX & ISS pages (low)">▰▰ 16</span>


> The technique of linking successive index segments across rebalancing or reconstitution events by multiplying the return of the new basket onto the cumulative index level of the old basket, ensuring a continuous time series despite changes in composition or weights.

Chaining is the mathematical mechanism that allows an index to remain a single unbroken series even as its constituents change over time. At each rebalancing or reconstitution, the new basket's performance is "chained" onto the prior index level. This is operationally achieved through the divisor adjustment: the divisor absorbs the compositional change so that the index level is continuous across the transition. Without chaining, every reconstitution would reset the index level to an arbitrary value.

$$
\text{Index}_{t+k} = \text{Index}_t \times \prod_{j=1}^{k} \left(1 + R_j^{\text{new basket}}\right)
$$

Where $R_j^{\text{new basket}}$ is the return of the post-rebalancing basket on day $j$ after the rebalancing date $t$.

> [!tip] Related terms
> [[#Divisor]], [[#Divisor Adjustment]], [[#Reconstitution]], [[#Rebalancing]]

> [!example]- Source excerpts (5)
>
> before the first inclusion in the index p = Price of share i at time t it q = Number of shares of
> company i on the i0 trading day before the first inclusion in the index q = Number of shares of
> company i at iT time T t = calculation time of the index K = Index-specific **chaining** factor
> valid as T of **chaining** date T T = Date of the last chaining B...
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>
> X indices are being expanded: the number of stocks in the MDAX is rising from 50 to 60 and the
> number of stocks in the SDAX from 50 to 70. The TecDAX index, by contrast, will remain unchanged
> and continue to consist of 30 companies. The new rules will be applied for the first time for the
> September **chaining** and will be reflected in the indices f...
>
> — [Deutsche Börse decides rule changes for MDAX, SDAX and TecDAX indices | Press...](https://stoxx.com/deutsche-borse-decides-rule-changes-for-mdax-sdax-and-tecdax-indices)
>
> nt of multiple share classes - Deletion of section 4.1.1.4 “Transition Rules” and deletion of the
> note about the relevance of the Index Guide/transition rules - Renewed introduction of sequential
> creation of the ranking list - Correction to the wording regarding the X indices - Clarification
> of the **chaining** process used with equal weighted indic...
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> ther share type is ranked”, “Exclusion List”, “30 days rule, “No VWAP”, “No Continuous Trading”,
> “ESG criteria not fulfilled”, “No ESG 16 Comment score available” or blank) Text 255 Scale Indices
> “Not traded on Xetra”, “30 Days Rule” Dax+ MaxDiv Indices, DivDAX and DivMSDAX “No dividend within
> next **chaining** period / dividend yield last period / ...
>
> — [Index Files Guide 20230619 (PDF)](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)
>
> y free float adjustments (and number of 8.2. Free Float float & number of applied to selection
> indices. Free Float shares adjustments) are applied to all indices. Factors and Share shares
> adjustments Adjustments (DAX Adjustments Guide) Extraordinary Free Changes to the number of shares
> are only 7.2 **Chaining** for Free Changes to the number of shar...
>
> — [Overview Of Methodology Changes Valid From 18 Of March 2024 (PDF)](https://www.stoxx.com/document/News/2023/October/Overview%20of%20methodology%20changes%20valid%20from%2018%20of%20March%202024.pdf)
>

---

### Component

<span style="background:red; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="3,730 mentions across STOXX & ISS pages (high)">▰▰▰▰▰▰ 3,730</span>


> A security that is currently included in an index and contributes to its level calculation; synonymous with "constituent" in STOXX documentation.

The terms "component" and "constituent" are used interchangeably throughout the index industry. Each component has an associated weight determined by the index's weighting scheme, and its price movements directly influence the index level. The set of components is determined during reconstitution events and may change between reviews through corporate actions or fast-entry/fast-exit rules.

> [!tip] Related terms
> [[#Constituent]], [[#Selection Criteria]], [[#Index Universe]]

> [!example]- Source excerpts (5)
>
> ZUG (January 8, 2025) – STOXX Ltd., part of the ISS STOXX group of companies and leading provider
> of benchmark and custom index solutions to global institutional investors, today announced an
> unscheduled **component** change in the SDAX, HDAX and TecDAX indices. Media Contact Sarah Ball
> Executive Director, Communications press@iss-stoxx.com NEXUS AG...
>
> — [Unscheduled component change in SDAX, HDAX and TecDAX (January 8, 2025) | Pre...](https://stoxx.com/unscheduled-component-change-in-sdax-hdax-and-tecdax-jan-8-2025)
>
> IDE 395/1024 12198. E.EUURROO i SiSTTOOXXXX N NEEXXTT 3 300 29.1. EURO iSTOXX NEXT 30 INDEX
> OVERVIEW The EURO iSTOXX Next 30 Index is a representation of liquid and large companies belonging
> to the Eurozone that are not part of the EURO STOXX 50. This index represents the performance of
> the next 30 **component**s from the EURO STOXX universe based o...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> DAX EQUITY INDEX METHODOLOGY GUIDE 93/120 12. INTERNATIONAL REGION-ORIENTED INDICES Weights
> calculation: The target weight of **component** i at time t is calculated as follows: 6M ADTV 𝐸𝑈𝑅
> 𝑖 𝑤 = 𝑖𝑡 ∑40 6𝑀 𝐴𝐷𝑇𝑉 𝐸𝑈𝑅 𝑗=1 𝑗 where the denominator is the sum of the six-month ADTV in EUR of
> all 40 companies in the index. The weighting factor of **component** ...
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> STOXX WORLD EQUITY INDEX METHODOLOGY GUIDE 29/37 6. STOXX WORLD EQUITY INDEX SERIES Tradability
> screens: Only securities with an annualized turnover ratio of at least 15% are selected (10% for
> current **component**s). The annualized turnover ratio is defined as the median value of the daily
> traded volume10 to the FOR adjusted free-float shares ratio...
>
> — [Stoxx World Equity Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)
>
> 10% - Minimum trading liquidity - Legal or operating headquarters in Germany - Timely publication
> of an audited annual financial report, half-yearly financial reports and quarterly statements -
> Adherence to specific German Corporate Governance Codex requirements. Figure 3 shows the index’s
> largest **component**s as of June 24, 2024. Hypoport, which ...
>
> — [Exploring SDAX, the benchmark for German small companies | Blog posts | STOXX](https://stoxx.com/exploring-sdax-the-benchmark-for-german-small-companies)
>

---

### Concentration Limit

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="2 mentions across STOXX & ISS pages (ultra-low)">▰ 2</span>


> A maximum threshold on the aggregate weight of a defined group of constituents — such as a single country, sector, or issuer group — designed to ensure diversification within the index beyond individual constituent caps.

Concentration limits operate at a higher level than individual capping. While capping constrains the weight of a single security, concentration limits constrain the combined weight of a group. For example, a STOXX index might impose a rule that no single country may represent more than 30% of total index weight, or that the top five constituents combined may not exceed 40%. These limits are enforced during rebalancing through iterative weight redistribution, similar to the capping process.

$$
\sum_{i \in G} w_i \le W_{\max}^{\text{group}}
$$

Where $G$ is the set of constituents belonging to the group and $W_{\max}^{\text{group}}$ is the concentration limit for that group.

> [!tip] Related terms
> [[#Capping]], [[#Country Weighting]], [[#Sector Weighting]], [[#Weighting Scheme]]

> [!example]- Source excerpts (1)
>
> sinesses that do not adhere to these critical standards. O Universe: STOXX Developed World All Cap
> S Weighting scheme: The index is free-float market capitalization weighted D Capping: Components
> are capped with an iterative process to guarantee that an absolute ICB Industry capping and the
> 5/10/40 **concentration limit**s are met E Base value and d...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>

---

### Constituent

<span style="background:red; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="2,410 mentions across STOXX & ISS pages (high)">▰▰▰▰▰▰ 2,410</span>


> An individual security that is a member of an index at a given point in time and whose price, shares, and weighting factors contribute to the computation of the index level.

"Constituent" is the preferred formal term in STOXX methodology documentation. Each constituent is characterized by its price, number of shares, free-float factor, and any applicable capping factor. The complete list of constituents for each STOXX index is published and updated at each periodic review.

> [!tip] Related terms
> [[#Component]], [[#Eligibility Criteria]], [[#Selection List]]

> [!example]- Source excerpts (5)
>
> On September 20, Germany’s flagship DAX® Index will expand from 30 to 40 **constituent**s,
> concluding the biggest reform in the benchmark’s +30-year history. The enlargement is the final
> step in a comprehensive overhaul of rules announced in November 2020 that took into account the
> responses of more than 600 participants in an extensive market consu...
>
> — [DAX Index Grows to 40 Constituents – Looking at Impact on Market Cap and Liqu...](https://stoxx.com/dax-index-grows-to-40-constituents-looking-at-impact-on-market-cap-and-liquidity)
>
> NDICES (PERFORMANCE DEDUCTIONS) 1+v(t), v(t) > 0 i i V(t) = { 1 i , else 1−v(t) i V(t) wV(t) = i i
> ∑V(t) i A Quality sub-score, wQ(t), where ROE is the Return on Equity: i q(t) =
> (ROE(t−1)−R̅̅O̅̅E̅(̅t̅̅−̅̅1̅̅)) i 1+q(t), q(t) > 0 i i Q(t) = { 1 i , else 1−q(t) i Q(t) w Q (t) =
> i i ∑Q (t) i where, i **constituent** of the EURO STOXX 50 𝑥̅ average of ...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> STOXX INDEX METHODOLOGY GUIDE 584/639 18. STOXX FACTOR INDICES which gives an accurate measure of
> the number of **constituent**s that affect a portfolio. The number of **constituent**s in an index
> that is weighted by optimization must be defined, so that the optimization process does not result
> in too many constituents with insignificant weights. The co...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> now applied to STOXX600 **constituent**s. Pay-for-performance tests also apply in Canada both to
> TSX/S&P Composite companies and those whose ballot features a say-on-pay resolution, along with
> nearly 4,000 companies in the U.S. where the concept was first unveiled in 2012. For the benefit
> of all market **constituent**s, ISS will release additional infor...
>
> — [ISS Announces New Pay-for-Performance Evaluation for ASX300 Constituents | ISS](https://www.issgovernance.com/iss-announces-new-pay-performance-evaluation-asx300-constituents)
>
> DAX® closed above 20,000 on December 3 for the first time in the German benchmark’s 36-year
> history, as its **constituent**s’ overseas sales of everything from AI software to industrial
> parts helped offset economic stagnation at home. The blue-chip index has gained 19% in 20241, with
> its 40 companies adding EUR 214 billion in market value. While Ger...
>
> — [DAX tops 20,000 for first time on strength of international-focused constitue...](https://stoxx.com/dax-tops-20000-for-first-time-on-strength-of-international-focused-constituents)
>

---

### Corporate Action Treatment

> The set of rules governing how an index is adjusted in response to events such as stock splits, rights issues, special dividends, spin-offs, mergers, and delistings to maintain continuity in the index level.

Corporate actions can alter a constituent's price, share count, or both. Without adjustment, such events would create artificial jumps or drops in the index level. STOXX applies standardized procedures — typically adjusting the divisor, share count, or both — to neutralize the mechanical effect of corporate actions. The goal is to ensure the index level reflects only genuine market movements, not structural changes in constituent securities.

> [!tip] Related terms
> [[#Divisor Adjustment]], [[#Divisor]], [[#Fast Exit Rule]]
---

### Country Weighting


> The aggregate weight of all constituents domiciled in or listed within a specific country, reflecting that country's representation in the index at a given point in time.

Country weighting is a key dimension of index analytics and is closely monitored by asset allocators. In a free-float capitalization-weighted index, country weights emerge naturally from the market capitalizations of constituent companies. STOXX publishes country weight breakdowns for its indices and may apply concentration limits to prevent a single country from dominating. Country weighting is particularly relevant for regional indices like the STOXX Europe 600, where relative country exposure is a primary consideration for investors.

> [!tip] Related terms
> [[#Concentration Limit]], [[#Sector Weighting]], [[#Weighting Scheme]]
---

## D

### Divisor

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="85 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 85</span>


> A scaling factor in the index formula that preserves continuity of the index level across non-market events such as constituent changes, corporate actions, and rebalancing; it absorbs the mechanical impact of these events so the index level changes only due to price movements.

The divisor is the single most important technical element in index maintenance. When an index is first created, the divisor is set so that the formula produces the desired base value. Thereafter, every time a non-market event would otherwise cause a discontinuity — an addition, deletion, share change, or capping adjustment — the divisor is recalculated to keep the index level unchanged at the moment of the change.

$$
D_{t+1} = D_t \times \frac{\sum_{i=1}^{n'} P_i^{t} \times S_i^{\text{new}} \times f_i^{\text{new}} \times \text{CF}_i^{\text{new}}}{\sum_{i=1}^{n} P_i^{t} \times S_i^{\text{old}} \times f_i^{\text{old}} \times \text{CF}_i^{\text{old}}}
$$

The numerator uses the new composition (post-event) and the denominator uses the old composition, both evaluated at the same closing prices $P_i^t$. This ensures the index level is continuous across the event.

> [!tip] Related terms
> [[#Divisor Adjustment]], [[#Index Formula (Laspeyres)]], [[#Base Value]]

> [!example]- Source excerpts (5)
>
> t = Time the index is computed. n = Number of assets in the index. p it = Reference price of asset
> (i) at time (t). wf it = Weight factor of asset (i) at time (t) . x it = Exchange rate from
> reference price currency to index currency at time (t). M t = Total ‘units’ of the index at time
> (t). D t = **Divisor** of the index at time (t). 3.8.2. **DIVISOR**...
>
> — [Stoxx Digital Asset Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_digital_asset_guide.pdf)
>
> FILES GUIDE 2.2. Equity Index Files 2.2.1. Index **Divisor**s (as from 01.11.2023) This report
> contains all **divisor**s and market capitalizations of Equity indices for current and next
> dissemination day.  File name: o index_divisors.csv o index_divisors_europe.csv  File type: .txt
> and .csv  File specification: semicolon separated  File frequency: da
>
> — [Index Files Guide 20230619 (PDF)](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)
>
> Y INDEX METHODOLOGY GUIDE 11/120 4. INDEX CHARACTERISTICS Last trading t-6: Closing day of
> previous price for month: cutoff calculating for data the UDA is t: Review is collection fixed
> implemented 3rd/4thtrading day: t-5: UDA is t+1: Review Components are published takes effect
> announced The index **divisor** is recalculated on the review implement...
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> condary sources. 4.3. DATA ACCURACY The data accuracy for the following factors of the index
> calculation is defined as (unless stated differently in the individual index methodologies): •
> Input data (e.g. pricing and currency rates) and other underlying data: rounded to seven decimal
> places • Index **divisor**s: rounded to integer numbers • Market c...
>
> — [Dax Equity Calculation Guide 20231002 (PDF)](https://www.stoxx.com/document/News/2023/October/DAX%20Equity%20Calculation%20Guide_20231002.pdf)
>
> . Changes to the DAX Index Calculation and Corporate Actions Treatment Affected Index Methodology
> Former Rule Applicable chapter New Rule Applicable chapter Change in former index in new index
> guide 1 guide2 All DAX Equity Index Formula4 Laspeyres index formula; implementation of 6.1 Index
> Formulas **Divisor**-based Laspeyres index formula; 7.1. Ind...
>
> — [Overview Of Methodology Changes Valid From 18 Of March 2024 (PDF)](https://www.stoxx.com/document/News/2023/October/Overview%20of%20methodology%20changes%20valid%20from%2018%20of%20March%202024.pdf)
>

---

### Divisor Adjustment

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="5 mentions across STOXX & ISS pages (ultra-low)">▰ 5</span>


> The recalculation of the index divisor triggered by any non-market event — including constituent additions or deletions, share changes, free-float factor updates, corporate actions, or capping factor modifications — to ensure continuity of the index level.

A divisor adjustment is performed whenever the aggregate capitalization of the index would change for reasons unrelated to market price movements. The adjustment is timed to take effect at the close of trading on the day before the event becomes effective. By solving for the new divisor that equates the pre-event and post-event index levels, STOXX ensures a seamless transition.

> [!tip] Related terms
> [[#Divisor]], [[#Corporate Action Treatment]], [[#Rebalancing]]

> [!example]- Source excerpts (2)
>
> Guidance - DAX Equity Index Calculation 8.1.11 Free-Float and Shares Changes No price adjustments
> are made. The change in market capitalization (for price weighted indices: the change in units)
> determines the **divisor adjustment**. Please refer to 8.2 for further details. a) For free-float
> market capitalization weighted indices: If the change in ma...
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>
> DAX EQUITY INDEX CALCULATION GUIDE 23/37 8. CORPORATE ACTIONS AND ADJUSTMENTS 8.1.11. FREE FLOAT
> AND SHARES CHANGES No price adjustments are made. The change in market capitalization (for price
> weighted indices: the change in units) determines the **divisor adjustment**. Please refer to 8.2
> for further details. a) For free float market capitalizatio...
>
> — [Dax Equity Calculation Guide 20231002 (PDF)](https://www.stoxx.com/document/News/2023/October/DAX%20Equity%20Calculation%20Guide_20231002.pdf)
>

---

## E

### Effective Date

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="357 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 357</span>


> The calendar date on which announced index changes — including additions, deletions, share updates, and rebalanced weights — take effect in the live index calculation.

The effective date is the implementation point for all changes disclosed on the announcement date. STOXX index changes are typically implemented at the opening of trading on the effective date, using the closing prices from the preceding trading day to compute the divisor adjustment. The gap between announcement and effective date (usually several trading days) is designed to give market participants time to adjust their portfolios in an orderly manner, minimizing market impact.

> [!tip] Related terms
> [[#Announcement Date]], [[#Periodic Review]], [[#Divisor Adjustment]]

> [!example]- Source excerpts (5)
>
> & Gas, Thermal Coal, Nuclear Power and Tobacco. Universe: The index universe is defined as all
> stocks from the STOXX Global Total Market index. Weighting scheme: The index constituents are
> weighted according to adjusted equal weights. Weight factors are published seven dissemination
> days before the **effective date** of the Review/Rebalance month an...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> FILES GUIDE past 6 months from the review **effective date** - DivDAX &DivMSDAX -> Dividend yield
> for the past 12 months from the cut-off date Projected dividend yield 40 Dividend_Yield_Projected
> - DAXplus Maximum Dividend -> Projected dividend yield Number 9 for the next 6 months from the
> review **effective date** Note related to the comment field: • F...
>
> — [Index Files Guide 20230619 (PDF)](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)
>
> Guidance - DAX Equity Index Calculation confidentiality has been requested by the respective
> Stakeholders. The **effective date** for benchmark methodology changes is aligned, where feasible,
> with the periodic benchmark reviews dates when the benchmark composition is changed, and a
> rebalancing is triggered to avoid extra ordinary impact for clients....
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>
> DAX EQUITY INDEX CALCULATION GUIDE 24/37 8. CORPORATE ACTIONS AND ADJUSTMENTS An extraordinary
> free float and share adjustment that would be effective during the quarterly review implementation
> week will become effective on review **effective date**, provided that minimum 2 trading days’
> notice can be given. The standard notice period of 2 trading d...
>
> — [Dax Equity Calculation Guide 20231002 (PDF)](https://www.stoxx.com/document/News/2023/October/DAX%20Equity%20Calculation%20Guide_20231002.pdf)
>
> DAX EQUITY INDEX METHODOLOGY GUIDE 34/120 7. DAX BLUE-CHIP INDICES order book volume. As described
> above for newly listed companies, the first 20 trading days after the deletion **effective date**
> are ignored and the remaining data is extrapolated linearly over the 12 months. The following
> provisions apply to the DAX only: To be considered eligible ...
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>

---

### Eligibility Criteria

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="22 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 22</span>


> The set of minimum requirements — covering domicile, listing venue, security type, liquidity, free-float, and sector classification — that a security must satisfy before it can be considered for inclusion in an index.

Eligibility criteria act as the first filter in the index construction process. STOXX indices typically require that a security be a common equity share (no preferred shares, warrants, or convertibles), listed on a recognized exchange within the index's geographic scope, and meet minimum thresholds for free-float and trading liquidity. Only securities passing all eligibility screens enter the selection universe from which constituents are chosen.

> [!tip] Related terms
> [[#Selection Criteria]], [[#Index Universe]], [[#Free-Float]]

> [!example]- Source excerpts (5)
>
> 100 Index is reviewed annually on the first dissemination day after the third Friday in December.
> The cut-off date is the last business day of the previous month (November). 7.11.3. ONGOING
> MAINTENANCE Selection list: The selection list is created annually in the review month by applying
> the three **eligibility criteria** in Section ‘Index Review’ o...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> oval is determined by the Verifier’s levels of experience and expertise in the different technical
> sectors covered by the Climate Bonds Standard. “Confidence in the green credentials of green bonds
> is essential to a sustainable market with the Climate Bonds Standard providing clear,
> sector-specific **eligibility criteria** for assets and projects th...
>
> — [ISS Reconfirmed as Climate Bonds Standard &amp; Certification Scheme Verifier...](https://www.issgovernance.com/iss-reconfirmed-climate-bonds-standard-certification-scheme-verifier)
>
> er $1.4 million from previously traded losses. * Figures are taken from 32 total settlements of
> S&P 500 companies during 2013 – 2016 using the average recovery per share from each of the legal
> Settlements Notices; actual recoveries will vary based upon specific trading data in the claims
> submitted. **ELIGIBILITY CRITERIA** AND PARTICIPATION REQUIREM...
>
> — [A Case Study Involving S&amp;P 500 Companies | ISS](https://www.issgovernance.com/a-case-study-involving-sp-500-companies)
>
> o Industry Classifications Used by STOXX. ASSET UNIVERSE The universe of assets for the STOXX
> Digital Asset Indices is reviewed bi-annually in March and September. The universe consists of any
> asset classified in the Bitcoin Suisse Index Reference Classification List (xRCL), for which the
> following **eligibility criteria** are met: • Digital assets ...
>
> — [Stoxx Digital Asset Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_digital_asset_guide.pdf)
>
> ted market value. Inclusion is based on quantitative factors such as size, liquidity,
> investability and financial viability (members must be profitable over the past 12 months,
> including the most recent quarter). However, constituent selection is at the discretion of an
> Index Committee based on the **eligibility criteria**.1 Driving outperformance A...
>
> — [Tesla’s place in a US stock benchmark | Blog posts | STOXX](https://stoxx.com/teslas-place-in-a-us-stock-benchmark)
>

---

### Equal Weighting

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="28 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 28</span>


> A weighting scheme in which every constituent of an index receives the same weight at each rebalancing date, regardless of market capitalization, price, or any fundamental metric.

In an equally weighted index with $n$ constituents, each security receives a weight of $1/n$ at rebalancing. Between rebalancing dates, weights drift as prices diverge, requiring periodic realignment. Equal weighting tilts exposure toward smaller-capitalization names relative to a cap-weighted benchmark and increases turnover due to the need for regular rebalancing.

$$
w_i = \frac{1}{n}, \quad \forall\; i \in \{1, 2, \ldots, n\}
$$

> [!tip] Related terms
> [[#Weighting Scheme]], [[#Market Capitalization Weighting]], [[#Fundamental Weighting]], [[#Rebalancing]]

> [!example]- Source excerpts (5)
>
> e. By nature, thematic portfolios also carry a higher risk than do broader strategies and can
> therefore be more volatile in times of market stress. But volatility can work both ways, which
> means that many of the themes are likely to outperform the market in the eventual recovery. Also,
> the adjusted **equal weighting** of constituents in many themati...
>
> — [Thematic investing offers alternative approach amid market volatility  | Blog...](https://stoxx.com/thematic-investing-offers-alternative-approach-amid-market-volatility)
>
> ROIC* ROA* ROE EBITDA Growth Equipment 4530 Semiconductors & Semiconductor ROIC ROA ROE Operating
> Cash Equipment Flow Growth 5010 Telecommunication Services ROA ROE ROIC EBITDA Growth 5510
> Utilities ROIC ROA ROE EBITDA Growth 6010 Real Estate ROIC ROA ROE Operating Cash Flow Growth *
> Indicates **equal weighting** for two metrics within an indust...
>
> — [Pay For Performance Mechanics (PDF)](https://www.issgovernance.com/file/policy/2018/americas/Pay-for-Performance-Mechanics.pdf)
>
> X ASEAN SELECT DIVIDEND 30 Index aims to select from the ASEAN universe the 30 highest dividend
> paying companies. Universe: All stocks in the investable universe (ASEAN region) Weighting scheme:
> The indices are modified equal weighted. This means price-weighted with a weighting factor to
> achieve an **equal weighting** and limiting the maximum weight...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> Qontigo and BlackRock’s thematic collaboration started in 2016 and now includes eight ETFs
> covering themes such as Automation & Robotics, Healthcare Innovation, Digitalization and Ageing
> Population. The funds track STOXX indices and have USD 8.9 billion in assets.5 1 The index employs
> an ‘adjusted’ **equal weighting** scheme: constituents are equall...
>
> — [iShares thematic ETF targets transformational move to digital in entertainmen...](https://stoxx.com/ishares-thematic-etf-targets-transformational-move-to-digital-in-entertainment-and-education)
>
> per look into Qontigo’s entire thematics offering, please see our dedicated page or visit one of
> our past articles. 1 ‘Mind the (Generation) Gap,’ Qontigo, August 2021. 2 Melissa Brown is
> Managing Director, Head of Applied Research at Qontigo. Anran Su is Associate at Qontigo Client
> Services. 3 The equal-weighting methodology in these thematic i...
>
> — [Well-Off Baby Boomers vs. Tech-Savvy Millennials: A Performance Analysis of T...](https://stoxx.com/well-off-baby-boomers-vs-tech-savvy-millennials-thematic-investing)
>

---

## F

### Fast Entry Rule

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="22 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 22</span>


> A provision that allows a security to be added to an index outside the regular periodic review schedule when it rapidly meets pre-defined criteria, typically related to a sharp increase in market capitalization or a significant corporate event such as an IPO or spin-off.

Fast entry rules ensure that indices remain representative of the market between scheduled reviews. If a newly listed company or a rapidly growing stock rises to a level that would clearly qualify it for inclusion under normal review criteria, the fast entry rule triggers an interim addition. STOXX defines specific ranking thresholds for fast entry that are typically more stringent than the standard inclusion threshold.

> [!tip] Related terms
> [[#Fast Exit Rule]], [[#Buffer Rule]], [[#Periodic Review]]

> [!example]- Source excerpts (5)
>
> DEX METHODOLOGY GUIDE 35/120 7. DAX BLUE-CHIP INDICES abroad (this is a discretionary rule; see
> section 2.3 “Discretion” in the DAX Equity Index Calculation Guide). Component selection: The
> composition of the DAX, MDAX, SDAX and TecDAX indices is reviewed quarterly on the basis of the
> Fast Exit and **Fast Entry rule**s, and semi-annually on the basi...
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> ). The following table summarizes the cases in which STOXX Committee(s) may exercise discretion
> regarding the index methodology and its application: Responsible Case STOXX Committee Index
> Termination and Transition IMC, IGC Sector Affiliation IGC Exclusion from Rankings IGC Deviation
> from Fast Exit/**Fast Entry rule**s and Regular Exit/Regular Entry...
>
> — [Guide To Eurogov Bond Indices (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/Guide_to_EUROGOV_Bond_Indices.pdf)
>
> Ltd. announced a component change in the EURO STOXX 50 Index. Infineon Technologies AG
> (DE0006231004) will be added to the EURO STOXX 50 Index effective as of the opening of European
> markets on March 22, 2021. Nokia Corp. (FI0009000681) will be deleted from the index. These
> changes are based on the **fast entry rule** as defined in section 9.2.3 Ong...
>
> — [Fast entry in the EURO STOXX 50 Index | Press releases | STOXX](https://stoxx.com/fast-entry-in-the-euro-stoxx-50-index)
>
> ddressed in a fast-track way (e.g., herein. In such cases STOXX Ltd. may exceptionally Pandemic)
> issue the notification either subsequently - Index Selection and Index Review such as immediately
> following such an event or in any case by Exclusion from Rankings, Deviation from other means.
> Fast Exit/**Fast Entry rule**s and Regular Any measures will ...
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>
> derived indices. August 2013: Clarification of the process to determine Emerging and Developed
> Markets in chapter 4.3. September 2013: Addition of the STOXX Global Broad Infrastructure index.
> September 2013: Addition of the STOXX ASEAN-Five Select Dividend 50 index September 2013:
> Amendments if the **Fast Entry rule** in chapters 9 October 2013: Add...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>

---

### Fast Exit Rule

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="25 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 25</span>


> A provision that triggers the removal of a constituent from an index between periodic reviews when it becomes ineligible due to events such as delisting, bankruptcy, or a severe decline in liquidity or market capitalization below a specified floor.

Fast exit rules protect index integrity by promptly removing securities that no longer meet minimum standards. Without such rules, a bankrupt or illiquid stock could remain in the index for months until the next scheduled review, distorting returns and creating tracking difficulties. STOXX applies fast exit removals effective at the close of the day before the event or as soon as practicable.

> [!tip] Related terms
> [[#Fast Entry Rule]], [[#Buffer Rule]], [[#Corporate Action Treatment]]

> [!example]- Source excerpts (5)
>
> August 2019 (3): Methodology change to STOXX Europe Christian Index August 2019 (4): Methodology
> change to STOXX Activist Indices: Change of liquidity screen from USD 1 million to EUR 1 million
> August 2019 (5): Methodology change to STOXX Optimised Country Indices: Removal of the quarterly
> applied **fast exit rule** with respect to share availabilit...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> STOXX Ltd. 14 EURO STOXX 50® ESG INDEX – INTEGRATING SUSTAINABILITY APPENDIX B THe **FAST eXiT
> rULe** iN PrACTiCe STOXX used its **fast exit rule** to become the first index provider to remove
> volkswagen (vw) from its eSG indices. FIGURE 13: Controversy risk screening Significant Low
> Moderate has a significant impact High Severe Qualitative The controve...
>
> — [Stoxx Research   Euro Stoxx 50%C2%Ae Esg   Integrating Sustainability (Septem... (PDF)](https://www.stoxx.com/document/Research/STOXX%20Research%20-%20EURO%20STOXX%2050%C2%AE%20ESG%20-%20Integrating%20Sustainability%20(September%202019).pdf)
>
> (e) ESG Controversy STOXX will exclude companies that Sustainalytics identifies to have a
> Controversy Rating of Category 5 (Severe) (f) ESG Risk Ratings STOXX will exclude companies that
> Sustainalytics identifies to have a “Severe” ESG Risk Rating. Furthermore, STOXX will implement an
> intra-quarter **fast exit rule** for severe ESG Controversies. Fo...
>
> — [Results Of Market Consultation Euro Stoxx 50 Esg And Stoxx Broad Market Esg 2... (PDF)](https://www.stoxx.com/document/Resources/MarketConsultation/Results_of_Market_Consultation_EURO_STOXX_50_ESG_and_STOXX_Broad_Market_ESG_20230206.pdf)
>
> nternational index, it replaces the non-surviving stock in the index at the same date the
> non-surviving stock is deleted from the index. If the surviving stock is already included in the
> index or does not meet the basic criteria, the non-surviving stock is replaced by a new company
> according to the **Fast Exit rule** (cf. section xx of the DAX Equit...
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>
> Frankfurt (Mar. 04, 2020) – On Wednesday, Qontigo announced changes to the DAX index family, which
> will become effective on 23 March 2020. The shares of HelloFresh will be included in the MDAX
> index and will replace the shares of Dialog Semiconductor PLC which will leave MDAX based on the
> **fast exit rule**. Media Contact General Inquiries: media@qo...
>
> — [HelloFresh to be included in MDAX | Press releases | STOXX](https://stoxx.com/hellofresh-to-be-included-in-mdax)
>

---

### Free-Float

<span style="background:red; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1,163 mentions across STOXX & ISS pages (high)">▰▰▰▰▰▰ 1,163</span>


> The proportion of a company's total shares outstanding that is available for trading by public investors, excluding shares held by strategic investors, company insiders, governments, and other long-term locked-in holders.

Free-float is a critical concept in modern index construction. STOXX defines strategic holdings as those exceeding 5% of outstanding shares held by a single entity with an apparent long-term intent (e.g., founding families, governments, cross-holdings). These shares are excluded from the free-float calculation. A higher free-float indicates greater investability and liquidity, and ensures index weights reflect tradeable market value.

> [!tip] Related terms
> [[#Free-Float Factor]], [[#Adjusted Free-Float Market Capitalization]], [[#Eligibility Criteria]]

> [!example]- Source excerpts (5)
>
> STOXX INDEX METHODOLOGY GUIDE 533/639 17. STOXX THEMATIC INDICES Step1: The companies in the
> portfolio are sorted by their **free-float** market capitalization in ascending order, and their
> initial weight is defined as: ffmcap w = (cid:2919) (cid:2919) ∑(cid:2898) ffmcap (cid:2920)
> (cid:2919)(cid:2924) (cid:2913)(cid:2925)(cid:2923)(cid:2926) (cid:2...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> METHODOLOGY GUIDE 29/37 6. STOXX WORLD EQUITY INDEX SERIES Tradability screens: Only securities
> with an annualized turnover ratio of at least 15% are selected (10% for current components). The
> annualized turnover ratio is defined as the median value of the daily traded volume10 to the FOR
> adjusted **free-float** shares ratio over the last 12 months ...
>
> — [Stoxx World Equity Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)
>
> DAX EQUITY INDEX METHODOLOGY GUIDE 18/120 5. STOCK CHARACTERISTICS EQS News. Where no regulatory
> announcements are available, other publicly available sources are consulted in addition to
> determine the number of shares. 5.8. **FREE-FLOAT** FACTORS 5.8.1. FIXED HOLDINGS Shares of a
> company that are not assigned to the free float are known as “fixed h...
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> XXTT 3 300 29.1. EURO iSTOXX NEXT 30 INDEX OVERVIEW The EURO iSTOXX Next 30 Index is a
> representation of liquid and large companies belonging to the Eurozone that are not part of the
> EURO STOXX 50. This index represents the performance of the next 30 components from the EURO STOXX
> universe based on **free-float** market capitalization, after the exc...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> lation is defined as (unless stated differently in the individual index methodologies): • Input
> data (e.g., pricing and currency rates) and other underlying data: rounded to seven decimal
> places. • Index divisors: rounded to integer numbers. • Market capitalization: rounded to two
> decimal places. • **Free-float** factors: rounded to four decimal pla...
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>

---

### Free-Float Factor

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="30 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 30</span>


> A decimal coefficient between 0 and 1, typically rounded to the nearest 5% increment, representing the fraction of a company's shares that are freely available for public trading.

STOXX assigns free-float factors in bands (e.g., 0.05, 0.10, 0.15, ..., 0.95, 1.00). A company with 70% free-float receives a factor of 0.70. This factor is multiplied by total shares outstanding to arrive at free-float shares, which in turn determine the constituent's weight in a free-float capitalization-weighted index. ISS provides underlying ownership data that STOXX uses to compute these factors.

$$
f_i = \frac{\text{Free-Float Shares}_i}{\text{Total Shares Outstanding}_i}
$$

Rounded to the nearest 0.05.

> [!tip] Related terms
> [[#Free-Float]], [[#Adjusted Free-Float Market Capitalization]], [[#Capping Factor]]

> [!example]- Source excerpts (5)
>
> DAX EQUITY INDEX METHODOLOGY GUIDE 18/120 5. STOCK CHARACTERISTICS EQS News. Where no regulatory
> announcements are available, other publicly available sources are consulted in addition to
> determine the number of shares. 5.8. **FREE-FLOAT FACTOR**S 5.8.1. FIXED HOLDINGS Shares of a
> company that are not assigned to the free float are known as “fixed h...
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> lation is defined as (unless stated differently in the individual index methodologies): • Input
> data (e.g., pricing and currency rates) and other underlying data: rounded to seven decimal
> places. • Index divisors: rounded to integer numbers. • Market capitalization: rounded to two
> decimal places. • **Free-float factor**s: rounded to four decimal pla...
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>
> R adjusted free float of the spun-off company will reflect the adjustment, if any, on its second
> trading day. FREE-FLOAT MARKET CAPITALIZATION The free-float market capitalization is the share of
> a stocks’ total market capitalization that is available for trading: Free-float market
> capitalization = **free-float factor** × full market capitalization ...
>
> — [Stoxx World Equity Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)
>
> STOXX INDEX METHODOLOGY GUIDE 41/639 5. INDEX CHARACTERISTICS 1. Determination of free-float
> market capitalization weights: p n  ff w  it it it it n p n  ff it it it i1 p it = Price of
> company (i) at time (t) n it = Number of shares of company (i) at time (t) ff it = **Free-float
> factor** of company (i) at time (t) n = Number of shares 2. Cal...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> NEUTRAL ESG 600 INDEX Determination of free-float market capitalization weights: p ⋅n ⋅ff it it it
> w = it ∑n p ⋅n ⋅ff i=1 it it it wit = Free-Float Market Capitalization weight of company (i) at
> time (t) pit = Price of company (i) at time (t) nit = Number of shares of company (i) at time (t)
> ffit = **Free-float factor** of company (i) at time (t) ni...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>

---

### Free-Float Market Capitalization Weighting

> A weighting methodology in which each constituent's weight in the index is proportional to its free-float-adjusted market capitalization, i.e., the product of its share price, total shares outstanding, and free-float factor.

This is the dominant weighting scheme in modern benchmark indices, including the EURO STOXX 50 and STOXX Europe 600. It balances representativeness with investability by ensuring that weights reflect only the portion of a company's market value that investors can actually trade. This approach reduces the risk of index portfolios being unable to replicate their benchmark due to illiquid, locked-in shares.

$$
w_i = \frac{P_i \times S_i \times f_i}{\sum_{j=1}^{n} P_j \times S_j \times f_j}
$$

> [!tip] Related terms
> [[#Market Capitalization Weighting]], [[#Equal Weighting]], [[#Adjusted Free-Float Market Capitalization]]
---

### Fundamental Weighting

> A weighting scheme in which constituent weights are determined by fundamental economic metrics — such as revenue, earnings, dividends, or book value — rather than by share price or market capitalization.

Fundamental weighting breaks the link between a company's stock price and its index weight, which proponents argue removes the systematic overweighting of overvalued stocks inherent in cap-weighted indices. STOXX offers several fundamentally weighted index variants. Weights are recalculated at each rebalancing using the most recently available financial data and are subject to the same capping and diversification rules as other index types.

> [!tip] Related terms
> [[#Weighting Scheme]], [[#Equal Weighting]], [[#Market Capitalization Weighting]]
---

## G

### Gross Return Index

<span style="background:red; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1,730 mentions across STOXX & ISS pages (high)">▰▰▰▰▰▰ 1,730</span>


> An index variant that measures total performance by reinvesting the full amount of all ordinary cash dividends on the ex-date at the closing price of the paying constituent, without deducting any withholding taxes.

The gross return index represents the maximum theoretical return achievable by an investor who captures all dividends without any tax leakage. It serves as a useful upper bound for performance comparison. STOXX calculates gross return indices alongside price return and net return variants for most of its index families.

$$
\text{GRI}_t = \text{GRI}_{t-1} \times \frac{\sum_{i=1}^{n} P_i^t \times S_i \times f_i \times \text{CF}_i + \sum_{i \in \text{ex}} D_i \times S_i \times f_i \times \text{CF}_i}{\sum_{i=1}^{n} P_i^{t-1} \times S_i \times f_i \times \text{CF}_i}
$$

Where $D_i$ is the gross (pre-tax) dividend per share for constituent $i$ going ex-dividend on day $t$.

> [!tip] Related terms
> [[#Net Return Index]], [[#Price Return Index]], [[#Total Return Index]]

> [!example]- Source excerpts (5)
>
> Currency: Price in EUR 9.89.1.2. INDEX FORMULA The index value for the iSTOXX Transatlantic 150 GR
> Decrement 50 Index is calculated as follows: U ACT(t−1,t) t IV =(IV × )−(D ) t t−1 U 365 t−1
> Where, IV index value on day t t U index value of underlying index on day t (iSTOXX Transatlantic
> 150 EUR t **Gross Return index**) ACT(t−1,t) number of actual...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> . Data as of Apr. 30, 2021. * Indices are the Ex Global Compact Controversial Weapons & Tobacco
> versions. Source: Qontigo. Index and Volatility Performance 140 120% 100% 130 80% 120 60% 110 40%
> 100 20% 0% 90 1 2 3 4 5 6 May-20 Jul-20 Sep-20 Nov-20 Jan-21 Mar-21 1 2 3 4 5 6 April 2021 Figure
> 21: EUR **Gross Return Index** Performance. May. 2020 – Apr...
>
> — [Monthly Index News April 2021 (PDF)](https://stoxx.com/monthly-index-news-april-2021)
>
> ENCHMARK STATEMENT Regulation Clause Regulation Required Information STOXX LTD Statement Subclause
> 7. Key Term Definitions Art. 27(2) BMR A benchmark statement shall contain at See below for
> Glossary of Key Terms least: the definitions for all key terms relating to the benchmark Key Term
> Definition **Gross Return Index** Shall mean an Index in which...
>
> — [Dax Volatility Index Family Benchmark Statement (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Resources/Regulation/DAX_Volatility_Index_Family_Benchmark_Statement.pdf)
>
> dance with the methodology; Benchmarks can be calculated using different (b) where relevant, a
> description of calculation rules. For example: instances when the accuracy and - they are
> calculated as a Price Index, without dividends; reliability of the methodology used for - they are
> calculated as a **Gross Return Index**; with determining the benchm...
>
> — [Stoxx Equity Index Family Benchmark Statement (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Resources/Regulation/STOXX_Equity_Index_Family_Benchmark_Statement.pdf)
>
> ecrement version replicates the Euro iStoxx 50 ESG Focus **Gross Return Index**, assuming a
> constant 5% performance deduction per annum. The deduction accrues constantly on a daily basis.
> Consequently, due to the percentage of performance being subtracted, the decrement index
> underperforms the standard **gross return index** that includes a gross divide...
>
> — [Barclays licenses iStoxx ESG Focus indices and targets private banking | Stru...](https://stoxx.com/barclays-licenses-istoxx-esg-focus-indices-and-targets-private-banking)
>

---

## I

### Index Calculation

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="270 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 270</span>


> The continuous or end-of-day computational process by which constituent prices, shares, free-float factors, and capping factors are combined via the index formula to produce the index level at each point in time.

STOXX calculates its indices in real time during exchange trading hours and publishes end-of-day official closing levels based on closing auction prices. The calculation engine applies the Laspeyres-type formula, maintaining the divisor to ensure continuity. Intra-day calculations typically use last-traded prices, while end-of-day calculations use official closing prices from the primary listing exchange.

> [!tip] Related terms
> [[#Index Formula (Laspeyres)]], [[#Divisor]], [[#Index Level]]

> [!example]- Source excerpts (5)
>
> ) will be deducted from the daily deviation of the index future from its underlying index (DAX).
> The X-DAX is calculated as follows: 1 Index = FDAX t D t t Where: FDAX ∑N i i=1 DAX D = i t N
> Here, ∑N FDAXi is the sum of all ratios i=1 to N of the future and index values measured on a i=1
> DAXi given **index calculation** date t between the start of t...
>
> — [Dax Strategy Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)
>
> iSTOXX® METHODOLOGY GUIDE 59/1024 5. DYNAMIC VSTOXX INDEX 6. On any **Index Calculation** Day d,
> the value of the Total Return Index at time t is calculated as: TIt R = T R Id − 1   E R ItE R
> Id 1 − + C R d − 1  d a y 3 sd − 6 0 1 , d  CR = Official Close Value of €STR rate on **Index
> Calculation** Day d d days = Number of actual calendar days b...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> STOXX® STRATEGY INDEX GUIDE 90/99 32.iSTOXX DYNAMIC EXPOSURE VOLATILITY INDICES Determination of
> Leveraged Target Weight On any **index calculation** date t, the leveraged target weight is
> calculated as follows: 𝑇𝑔𝑡𝑉𝑜𝑙 𝑇𝑔𝑡𝑤 = +100% 𝑡 𝑀𝑎𝑥𝑅𝑒𝑎𝑙𝑖𝑧𝑒𝑑𝑉𝑜𝑙 𝑡,(20,60) Where: 𝑇𝑔𝑡𝑉𝑜𝑙 = The
> pre-determined Target Volatility (10%). And: 𝑀𝑎𝑥𝑅𝑒𝑎𝑙𝑖𝑧𝑒𝑑𝑉𝑜𝑙 = max (𝑅𝑒𝑎𝑙𝑖...
>
> — [Stoxx Strategy Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_strategy_guide.pdf)
>
> 2.3 “Discretion” in the DAX Equity **Index Calculation** Guide). The IMC is in charge of
> initiating ad hoc methodology reviews in case of limitations or where another STOXX committee
> recommends initiating a methodology review (this is a discretionary rule; see section 2.3
> “Discretion” in the DAX Equity **Index Calculation** Guide). 14.2.2. DECISION AND ...
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> Guidance - DAX Equity **Index Calculation** Cash dividends and bonus distributions are only
> corrected in performance and net return indices. Special distributions are taken account of in all
> performance, net return, and price indices. Within the framework of **index calculation**, the
> share price is thus modified by the amount o
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>

---

### Index Committee

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1 mentions across STOXX & ISS pages (ultra-low)">▰ 1</span>


> A governance body composed of senior professionals within the index provider organization responsible for overseeing index methodology, approving rule changes, exercising discretion in exceptional circumstances, and ensuring the integrity and representativeness of the index.

The STOXX Index Committee (or equivalent governance body) serves as the ultimate decision-making authority for all methodology-related matters. It convenes periodically to review the results of periodic reviews, approve exceptional treatments, and consider methodology enhancements. The committee may exercise expert judgment in situations not fully covered by the rulebook — for example, during market disruptions or unprecedented corporate events. Its composition, mandate, and decision-making procedures are disclosed in compliance with the EU Benchmark Regulation (BMR) and IOSCO Principles.

> [!tip] Related terms
> [[#Periodic Review]], [[#Rules-Based Index]], [[#Stakeholder Consultation]]

> [!example]- Source excerpts (1)
>
> weighted by their float-adjusted market value. Inclusion is based on quantitative factors such as
> size, liquidity, investability and financial viability (members must be profitable over the past
> 12 months, including the most recent quarter). However, constituent selection is at the discretion
> of an **Index Committee** based on the eligibility criter...
>
> — [Tesla’s place in a US stock benchmark | Blog posts | STOXX](https://stoxx.com/teslas-place-in-a-us-stock-benchmark)
>

---

### Index Formula (Laspeyres)

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="72 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 72</span>


> The mathematical expression used to compute a capitalization-weighted index level, based on the Laspeyres aggregation method, where quantities (shares) are held fixed between rebalancing dates and the index reflects only price changes.

The Laspeyres framework underpins virtually all modern capitalization-weighted indices. In the STOXX implementation, the formula divides the sum of all constituents' adjusted free-float market capitalizations by the divisor. The divisor is calibrated so that the formula yields the base value on the base date, and it is subsequently adjusted to absorb all non-price changes.

$$
\text{Index}_t = \frac{\sum_{i=1}^{n} P_i^t \times S_i \times f_i \times \text{CF}_i}{D_t}
$$

Where:
- $P_i^t$ = price of constituent $i$ at time $t$
- $S_i$ = number of shares of constituent $i$
- $f_i$ = free-float factor of constituent $i$
- $\text{CF}_i$ = capping factor of constituent $i$ (1.0 if uncapped)
- $D_t$ = divisor at time $t$

> [!tip] Related terms
> [[#Laspeyres Price Index Formula]], [[#Divisor]], [[#Index Calculation]]

> [!example]- Source excerpts (5)
>
> 213358786 ISXEDE10 Exposure Volatility 10% SX5E 10% 100 on 27/03/2003 Ind ex EURO iSTOXX 50
> Dynamic CH1213358794 ISXTDE10 Exposure Volatility 10% SX5T 10% 100 on 27/03/2003 Index EURO iSTOXX
> 50 Dynamic CH1213358802 ISXGDE10 Exposure Volatility 10% SX5GT 10% 100 on 27/03/2003 Index 32.3.
> CALCULATION **Index Formula** The index is calculated as follow...
>
> — [Stoxx Strategy Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_strategy_guide.pdf)
>
> 4) with Sharpe Ratio as the tie breaker (descending). Based on the ranking as determined in the
> previous step, with respect to the Index Rebalancing Day t , a target weight 𝑤 is then assigned to
> each Index Component as per the following Reb i,tReb table: Fund Ranking 𝒘 𝐢,𝐭𝐑𝐞𝐛 1 50% 2 35% 3
> 10% 4 5% **Index formula**: 4 𝐼𝑉 =∑ 𝑤𝑓 ∙𝑁𝐴𝑉 𝑡 𝑖,𝑡 𝑖,𝑡 𝑖=1 𝐼𝑉...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> Methodology Changes 1. Changes to the DAX Index Calculation and Corporate Actions Treatment
> Affected Index Methodology Former Rule Applicable chapter New Rule Applicable chapter Change in
> former index in new index guide 1 guide2 All DAX Equity Index Formula4 Laspeyres **index
> formula**; implementation of 6.1 Index Formulas Divisor-based Laspeyres in...
>
> — [Overview Of Methodology Changes Valid From 18 Of March 2024 (PDF)](https://www.stoxx.com/document/News/2023/October/Overview%20of%20methodology%20changes%20valid%20from%2018%20of%20March%202024.pdf)
>
> DAX EQUITY INDEX CALCULATION GUIDE 7. INDEX VALUE CALCULATION 14/37 7.1. INDEX FORMULAS The
> indices are calculated with the Laspeyres formula, which measures price changes against a fixed
> base quantity weight. Each index has a unique index divisor, which is adjusted to maintain the
> continuity of the index’s values across changes due to corporate...
>
> — [Dax Equity Calculation Guide 20231002 (PDF)](https://www.stoxx.com/document/News/2023/October/DAX%20Equity%20Calculation%20Guide_20231002.pdf)
>
> Guidance - DAX Equity Index Calculation 6 Calculation 6.1 Index Formulas 6.1.1 **Index Formula**
> for free float market capitalization weighted indices The selection indices of the DAX® family are
> capital weighted. Only the shares in the free float are considered when calculating the
> capitalization. The indices are each calculated as price and perfor...
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>

---

### Index Level

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="130 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 130</span>


> The numerical value of an index at a given point in time, representing the cumulative effect of constituent price changes since the base date, scaled by the base value and maintained via the divisor.

The index level is the single number quoted in financial markets — for example, "the EURO STOXX 50 closed at 4,285.50." It is calculated by dividing the aggregate adjusted free-float market capitalization of all constituents by the divisor. Changes in the index level between two dates (expressed as a percentage) represent the index return over that period.

> [!tip] Related terms
> [[#Base Value]], [[#Base Date]], [[#Index Calculation]]

> [!example]- Source excerpts (5)
>
> of 0, for Base Dates please consult the data vendor code sheet on the STOXX website. Dissemination
> Calendar: STOXX Europe Calendar CALCULATIONS 0 𝑡=0 𝑛 𝐼 ={ 𝑡 (𝐼 +∑(𝐷𝑖𝑣𝑎𝑛𝑛𝑜𝑢𝑛𝑐𝑒𝑑 ∙𝐹𝑋 ∙𝐾 ∙(1−𝑊𝐻𝑇
> )))∙𝑅 𝑡>0 𝑡−1 𝑖,𝑡 𝑖,𝑡 𝑖,𝑡 𝑖,𝑡 𝑡 𝑖=1 𝐴𝐷𝐽_𝐼 =𝐼 ∙∏𝑅 𝑡 𝑡 𝑡′ 𝑡′>𝑡 Where: • I is the unadjusted equity
> dividend **index level** • ADJ_I is the adjusted equity divid...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> lly the Wednesday prior to the second last Friday of the respective maturity month, if this is an
> exchange day; otherwise the exchange day immediately preceding that day. Self-financing constraint
> (II) 𝐼𝑉𝑃𝑜𝑠𝑡 =𝐼𝑉𝑃𝑟𝑒−(𝐶𝑃𝑜𝑠𝑡−𝐶𝑃𝑟𝑒)(𝑃∗ −𝑃𝑀)−(𝐶𝑃𝑜𝑠𝑡−𝐶𝑃𝑟𝑒)(𝑃∗ −𝑃𝑀) 𝑡 𝑡 1𝑡 1𝑡 1𝑡 1𝑡 2𝑡 2𝑡 2𝑡 2𝑡 The
> post-roll **index level** has to be equal to the pre-roll ind...
>
> — [Stoxx Strategy Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_strategy_guide.pdf)
>
> on System”, is a system where users with commercial agreements with Qontigo are entitled to
> retrieve Index Data for purposes as defined in the commercial agreements. The Index Data
> Distribution System contains various permission levels such as entity and users accesses, per
> commercial packages, per **Index level** and subject to Licenses of Third-Pa...
>
> — [Technical Migration New Index Data Distribution System And New File Formats F... (PDF)](https://www.stoxx.com/document/News/2023/March/Technical_Migration-New_Index_Data_Distribution_System_and_New_File_Formats_for_DAX_Indices_20230327_3457284624.pdf)
>
> STOXX’S SFDR ARTICLE 2(17) SUSTAINABLE INVESMENT METHODOLOGY 10/13 3.4 Aggregation methodology at
> **index level** STOXX uses a market value-weighted approach to aggregate the SI % (positive
> contribution) at portfolio level. We think this methodology is the most robust approach and
> properly reflects the actual aggregated positive contribution, since ...
>
> — [Stoxx Sfdrarticle2 17 Sustainableinvestmentmethodology 202501 (PDF)](https://stoxx.com/wp-content/uploads/2025/03/STOXX_SFDRArticle2_17_SustainableInvestmentMethodology_202501.pdf)
>
> DAX STRATEGY INDEX GUIDE 25/57 6. DAX RISK CONTROL INDICES €𝑆𝑇𝑅 = The €STR rate on the **Index
> Level** Determination Date t-1 in respect of day 𝑡−1 t-2. 𝐷𝑖𝑓𝑓(𝑡−1,𝑡) = Difference between t-1 and
> t measured in calendar days Determination of the Target Weight (Tgtw) On any **Index Level**
> Determination Date t, the Target Weight shall be determined as follo...
>
> — [Dax Strategy Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)
>

---

### Index Point

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="75 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 75</span>


> A unit of change in the index level, where a movement of one index point represents a change of 1.0 in the numerical index value, distinct from a percentage or basis-point change.

Index points are the raw unit of index level movement. A move from 4,200.00 to 4,215.00 is a 15-point move. Because the meaning of an index point depends on the level of the index, percentage returns are preferred for performance comparison. However, index points are commonly used in quoting futures and options on indices, in daily market commentary, and in specifying settlement values of index derivatives.

$$
\Delta \text{pts} = \text{Index}_t - \text{Index}_{t-1}
$$

$$
\Delta \% = \frac{\Delta \text{pts}}{\text{Index}_{t-1}} \times 100
$$

> [!tip] Related terms
> [[#Index Level]], [[#Basis Point (Index)]], [[#Index Calculation]]

> [!example]- Source excerpts (5)
>
> iSTOXX® METHODOLOGY GUIDE 166/1024 9. DECREMENT INDICES (PERFORMANCE DEDUCTIONS) Underlying Index:
> iSTOXX France ESG 40 index (EUR Gross Return) Decrement Amount (in **index point**s): 50
> Dissemination calendar: STOXX Europe calendar Index Type: Price Index Currency: EUR 9.69.1.6.
> CALCULATION The index value for the iSTOXX France ESG 40 Decrement 50...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> A correction is applied, when a dividend is declared unpaid (payment default) or the dividend
> amount is changed by the company after the ex-date2. The following rules apply: » For indices that
> held the affected company on the ex-date a reinvestment is applied via a divisor adjustment to
> correct the **index point**s have been previously added. A posi...
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>
> DAX STRATEGY INDEX GUIDE 18/57 4. LEVERAGED AND SHORT INDICES Reverse Split If the closing value
> of a daily leverage or short index drops below 100 **index point**s, a reverse split is carried
> out. The leverage index is multiplied with a factor of 1000 whereas the Short index is multiplied
> with a factor of 1000. The reverse split is carried out base...
>
> — [Dax Strategy Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)
>
> when business slows down. Companies resist cutting dividends unless it’s imperative, because of
> the negative message the move sends. At the same time, dividends are an important factor
> underpinning equities as many income investors and pension funds are attracted to the stable cash
> flows. Dividend **index point**s The EURO STOXX 50® Index Dividend F...
>
> — [Dividend Futures Point to Historical Payments Slump | Blog posts | STOXX](https://stoxx.com/dividend-futures-point-to-historical-payments-slump)
>
> nderlying index assuming a constant deduction per annum. The performance deduction accrues
> constantly on a daily basis (using an Actual/365 Fixed day count convention). The amount of
> deduction can either be a performance deduction, in which case it is expressed in percentage
> points, or it can be an **index point**s deduction in which case it is expr...
>
> — [Stoxx Strategy Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_strategy_guide.pdf)
>

---

### Index Universe

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="349 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 349</span>


> The broadest set of securities from which an index's constituents may be selected, defined by geographic, exchange, sector, or asset-class criteria.

The index universe is the starting pool before any eligibility or selection screens are applied. For example, the STOXX Europe 600 draws from the STOXX Europe Total Market Index, which itself covers securities listed in 17 European countries. The universe definition determines the geographic and economic scope of the index and is specified in the index rulebook.

> [!tip] Related terms
> [[#Eligibility Criteria]], [[#Selection Criteria]], [[#Selection List]]

> [!example]- Source excerpts (5)
>
> INDICES STOXX GLOBAL 150 9.4.1. OVERVIEW The STOXX Global 150 Blue-Chip Index is a combination of
> the regional STOXX Blue-Chip indices for North America, Asia Pacific and Europe which cover the
> supersector leaders of the respective region in terms of free-float market capitalization.
> Universe: The **index universe** is defined as all stocks of the d...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> Contraceptives, Human Embryonic Stem Cells, Genetically Modified Plants and Seeds, Pesticides,
> Palm Oil, Predatory Lending, Unconventional Oil & Gas (Arctic Oil and Gas Exploration, Oil Sands
> and Shale Energy), Conventional Oil & Gas, Thermal Coal, and Nuclear Power are also excluded.
> Universe: The **index universe** is defined as all stocks from th...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> in research and applications to the overall activities of each company. Secondly, Blockchain
> Contribution is defined as the ratio of the number of blockchain patents awarded to a company over
> the most recent three-year period to the total number of blockchain patents awarded to all
> companies in the **index universe**. It provides an indication of th...
>
> — [Stoxx, Yewno launch developed markets blockchain index | ETF Strategy - ETF S...](https://stoxx.com/stoxx-yewno-launch-developed-markets-blockchain-index)
>
> MONTHLY INDEX NEWS / August Factor Indices (Regional: US) Key points In the US, momentum continued
> to yield the highest returns within the STOXX® USA 500 **Index universe**. Within the broader
> STOXX® USA 900 **Index universe**, quality trumped momentum in August. The two are the
> best-performing factors in US stocks in the past 12 months. Risk and return...
>
> — [Monthly Index News August 2020 (PDF)](https://stoxx.com/monthly-index-news-august-2020)
>
> chnology as one of the three thematic megatrends; one index that captures this megatrend is the
> iSTOXX FactSet Automation & Robotics Index. Each of our thematic concepts on its own has the
> potential to be a fantastic growth and transformation story,” said Inderpal Gujral, STOXX Head of
> Product. The **index universe** is defined as all stocks from th...
>
> — [iSTOXX FactSet Automation &amp; Robotics Index Licensed To BlackRock | Press ...](https://stoxx.com/istoxx-factset-automation-robotics-index-licensed-to-blackrock)
>

---

### Investability

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="11 mentions across STOXX & ISS pages (low)">▰▰ 11</span>


> The degree to which an index can be practically replicated by a real-world portfolio, determined by the liquidity, free-float, and trading volumes of its constituents, as well as the index's turnover and weight concentration characteristics.

Investability is a core design objective for benchmark indices. STOXX ensures investability by imposing minimum liquidity and free-float requirements at the eligibility stage, applying free-float adjustments to weights, and using buffer rules to limit turnover. An index with poor investability would generate excessive tracking error for replicating portfolios, defeating its purpose as a benchmark. Investability considerations also inform the choice of review frequency, capping thresholds, and fast entry/exit rules.

> [!tip] Related terms
> [[#Free-Float]], [[#Eligibility Criteria]], [[#Tracking Error]], [[#Turnover]]

> [!example]- Source excerpts (5)
>
> kets, with the view that if you want to create a sustainable outcome you might want to use
> different thresholds and criteria. In using the STOXX World indices as building blocks, you can do
> this without compromising the consistent index-construction methodology. Can you tell us a bit
> more as to why **investability** is so important in emerging marke...
>
> — [Q&amp;A: Building customized, sustainable portfolios based on the STOXX World...](https://stoxx.com/qa-building-customized-sustainable-portfolios-based-on-the-stoxx-world-indices)
>
> nager will need to have beaten their benchmark over a three-year period. Fewer than 25% of
> managers tracked by Citywire achieve this, and they will either receive a Citywire+, A, AA, or the
> top AAA rating, according to their track record. STOXX ensures that all selected funds meet
> replicability and **investability** principles, and monitors for any ...
>
> — [Innovative Index Offers Exposure to Best-Performing Mutual Funds | Blog posts...](https://stoxx.com/innovative-index-offers-exposure-to-best-performing-mutual-funds)
>
> onal contracts. Open interest in MDAX derivatives stood at EUR 2 billion at the end of 2025.
> Additionally, more than 2,300 investment certificates on the MDAX are currently available at the
> Frankfurt Stock Exchange (FSE). “Very few national markets worldwide offer a mid-cap index with
> this level of **investability**, showcasing the strength and mome...
>
> — [MDAX index: 30 years benchmarking Germany’s Mittelstand | Blog posts | STOXX](https://stoxx.com/mdax-index-30-years-benchmarking-germanys-mittelstand)
>
> provide market participants with an easy way to track MVPs in specific markets. For each market –
> global, regional and country-specific – two versions are made available: Constrained and
> Unconstrained. The Unconstrained version is optimized with minimal constraints, which pertain to
> tradability and **investability**, and aims to be on the efficient ...
>
> — [Stoxx Minvar Paper (PDF)](http://www.stoxx.com/document/Others/marketing/STOXX_MinVar_Paper.pdf)
>
> mization and portfolio analytics. Invest with precision Maximize the allocation to the desired
> factor while constraining the exposure to non-targeted factors, other attributes and unintended
> sources of risk. Manage liquidity Aim for higher capacity and reduced trading costs by managing
> turnover and **investability**, and avoiding potentially problem...
>
> — [Industry Neutral Factor Indices | STOXX](https://stoxx.com/industry-neutral-factor-indices)
>

---

## L

### Laspeyres Price Index Formula

> The general class of index calculation in which a fixed basket of goods (securities) is valued at current prices and compared to the same basket valued at base-period prices, named after the 19th-century economist Etienne Laspeyres.

In securities indexing the Laspeyres approach holds quantities (shares) constant between rebalancing dates, so the index tracks pure price changes of its constituents. This is the theoretical foundation for the STOXX index formula. The key property is that between rebalancing events only prices vary; quantities, free-float factors, and capping factors remain frozen.

$$
L_t = \frac{\sum_{i=1}^{n} P_i^t \times q_i^0}{\sum_{i=1}^{n} P_i^0 \times q_i^0} \times \text{Base Value}
$$

Where $q_i^0$ represents the fixed quantity (shares $\times$ free-float factor $\times$ capping factor) determined at the most recent rebalancing.

> [!tip] Related terms
> [[#Index Formula (Laspeyres)]], [[#Index Calculation]], [[#Divisor]]
---

### Live Date

> The calendar date on which an index begins to be calculated and published in real time using live market data, as opposed to back-tested or simulated historical values.

The live date marks the transition from simulated (backfilled) data to actual, real-time index calculation. Before the live date, any historical index values are hypothetical reconstructions. After the live date, the index is computed using contemporaneous market data and published through official dissemination channels. STOXX clearly identifies the live date for each index and labels all pre-live-date data as simulated in its publications.

> [!tip] Related terms
> [[#Simulation]], [[#Backfill]], [[#Base Date]], [[#Effective Date]]
---

## M

### Market Capitalization Weighting

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="3 mentions across STOXX & ISS pages (ultra-low)">▰ 3</span>


> A weighting methodology in which each constituent's weight is proportional to its full (non-free-float-adjusted) market capitalization, calculated as share price multiplied by total shares outstanding.

Full market-cap weighting was the original method used by early indices. It weights companies by their total equity value regardless of how much of that value is available for trading. Most modern benchmark indices, including those from STOXX, have moved to free-float-adjusted market-cap weighting, but full-cap weighting is still used in certain research and strategy indices.

$$
w_i = \frac{P_i \times S_i}{\sum_{j=1}^{n} P_j \times S_j}
$$

> [!tip] Related terms
> [[#Free-Float Market Capitalization Weighting]], [[#Equal Weighting]], [[#Price Weighting]]

> [!example]- Source excerpts (3)
>
> The launch of the DAX® Equal Weight Index this month presents a good opportunity to review the
> virtues of an equal-weight equity strategy. Looking across different markets and time periods, a
> portfolio whose holdings have had an equal allocation to them has outperformed the traditional
> market-capitalization-weighting positioning. The latter stra...
>
> — [What’s Behind the Edge in Equal-Weight Strategies? | Blog posts | STOXX](https://stoxx.com/whats-behind-the-edge-in-equal-weight-strategies)
>
> to-native metrics including the scope of adoption, the size of the developer community, the fees
> paid by users and the age of the protocol. This, together with robust exchange-based pricing,
> ensures the investable tokens present quality standards that are acceptable to a larger pool of
> investors. A **market capitalization weighting** scheme with a c...
>
> — [Valour launches ETP on first STOXX crypto blue-chip index | Blog posts | STOXX](https://stoxx.com/valour-launches-etp-on-first-stoxx-crypto-blue-chip-index)
>
> lection of the crypto universe today. The list of eligible tokens is derived from all assets
> classified under the Bitcoin Suisse Global Crypto Taxonomy (GCT). Selection is based on a
> multi-step procedure which seeks to identify the strongest and most representative assets in each
> eligible sector. A **market capitalization weighting** scheme with a c...
>
> — [STOXX licences first crypto Blue Chip Index, co-developed with Bitcoin Suisse...](https://stoxx.com/stoxx-licences-first-crypto-blue-chip-index-co-developed-with-bitcoin-suisse-to-valour-inc)
>

---

### Modified Market Cap Weighting

> A weighting methodology that begins with market-capitalization weights but applies systematic adjustments — such as capping, free-float adjustment, liquidity scaling, or minimum-weight floors — to achieve specific diversification, investability, or regulatory objectives.

Modified market-cap weighting is a broad category that encompasses any deviation from pure full-capitalization weighting. Free-float capitalization weighting is the most common form, but the category also includes capped indices, indices with minimum weight constraints, and indices that apply liquidity haircuts. STOXX benchmark indices are, strictly speaking, modified market-cap weighted because they apply free-float factors and, in many cases, capping factors.

$$
w_i^{\text{mod}} = g\!\left(\frac{P_i \times S_i \times f_i}{\sum_{j=1}^{n} P_j \times S_j \times f_j}\right)
$$

Where $g(\cdot)$ is a modification function that may include capping, flooring, or other adjustments.

> [!tip] Related terms
> [[#Market Capitalization Weighting]], [[#Free-Float Market Capitalization Weighting]], [[#Capping]], [[#Weighting Scheme]]
---

## N

### Net Return Index

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="171 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 171</span>


> An index variant that reinvests dividends after deducting withholding taxes at the applicable rate for a specified investor domicile, reflecting the return achievable by a foreign or domestic investor subject to standard withholding tax regimes.

The net return index provides a more realistic performance measure than the gross return index for investors who cannot fully reclaim dividend withholding taxes. STOXX applies country-specific withholding tax rates, typically the maximum rate applicable to a non-treaty institutional investor. This makes the net return index the most commonly used benchmark for comparing fund performance.

$$
\text{NRI}_t = \text{NRI}_{t-1} \times \frac{\sum_{i=1}^{n} P_i^t \times S_i \times f_i \times \text{CF}_i + \sum_{i \in \text{ex}} D_i \times (1 - \tau_i) \times S_i \times f_i \times \text{CF}_i}{\sum_{i=1}^{n} P_i^{t-1} \times S_i \times f_i \times \text{CF}_i}
$$

Where $\tau_i$ is the withholding tax rate applicable to the dividend of constituent $i$.

> [!tip] Related terms
> [[#Gross Return Index]], [[#Price Return Index]], [[#Total Return Index]]

> [!example]- Source excerpts (5)
>
> is underperforming the standard **net return index**. The decrement index may perform better than
> the standard price index that does not consider dividend investments as long as the overall net
> dividend yield of the base index is greater than the value being subtracted. The base index is the
> DAX 50 ESG **Net Return Index**. Base value and dates: 1000 on...
>
> — [Dax Strategy Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)
>
> ate, as defined in section 0 • 𝑆 is the closing index value of Euro Stoxx 50 EUR Price index
> (symbol SX5E) at time t 𝑡 • 𝐷𝑖𝑣 represents the net dividend yield earned on day t and is
> calculated as: 𝑡 𝑆𝑋5𝑇 𝑆𝑋5𝐸 𝑡 𝑡 𝐷𝑖𝑣 = − 𝑡 𝑆𝑋5𝑇 𝑆𝑋5𝐸 𝑡−1 𝑡−1 where 𝑆𝑋5𝑇 is the closing index value
> of Euro Stoxx 50 EUR **Net Return index**. 𝑡 • ∆𝑂𝑃𝐿 is the variation in ...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> e definition of STOXX® Customized Indices, which can be tailored to specific client or mandate
> needs. STOXX offers customization in almost unlimited forms for example in terms of component
> selection, weighting schemes and personalized calculation methodologies. 3 Net dividend yield is
> calculated as **net return index** return minus price index retur...
>
> — [Ixarobu (PDF)](https://www.stoxx.com/document/Bookmarks/CurrentFactsheets/IXAROBU.pdf)
>
> ce: STOXX. Number of High Quality Patents in AI sub-themes 5,000 4,661 4,000 3,000 2,000 1,000
> 1,515 644 0 AI in Semiconductor/GPU HQ Patents AI in Cloud HQ Patents AI in Big Data HQ Patents
> Source: EconSight. 5 Based on the composition as of September 30, 2024. 6Net dividend yield is
> calculated as **net return index** return minus price index retur...
>
> — [Product Brief Stoxx Global Ai Infastructure Index (PDF)](https://stoxx.com/wp-content/uploads/2023/11/Product-brief-STOXX-Global-AI-Infastructure-Index.pdf)
>
> Figure 1: Companies ineligible for DAX 30 ESG Figure 2: DAX 30 ESG top components Figure 3: Risk
> and return characteristics Decrement version Together with the introduction of the DAX 30 ESG, the
> idDAX® 30 ESG Decrement 4.0% index was launched. The index replicates the performance of the DAX
> 30 ESG **net return index** assuming a constant 4% perform...
>
> — [New DAX index expands responsible-investing options in German equities | Blog...](https://stoxx.com/new-dax-index-expands-responsible-investing-options-in-german-equities)
>

---

### Number of Components (Fixed vs. Variable)

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="120 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 120</span>


> The rule specifying whether an index maintains a predetermined fixed count of constituents (e.g., exactly 50 stocks) or allows the count to vary based on eligibility and selection criteria at each review.

Fixed-count indices such as the EURO STOXX 50 always maintain exactly the target number of constituents. When a constituent is removed, a replacement is added to maintain the count. Variable-count indices, such as the STOXX Europe Total Market Index, include all securities that satisfy the eligibility and selection thresholds, and the number of constituents may change at each review. Fixed-count indices typically require more elaborate buffer rules and ranking procedures.

> [!tip] Related terms
> [[#Buffer Rule]], [[#Constituent]], [[#Reconstitution]]

> [!example]- Source excerpts (5)
>
> DE 434/1024 44. iSTOXX GLOBAL ESG EX- CONTROVERSIAL ACTIVITIES SELECT 30 INDEX ▪ North America :
> components of the STOXX North America 600 Index ▪ Europe: components of the STOXX Europe 600 Index
> ▪ Asia/Pacific: components of the STOXX Asia/Pacific 600 Index c. Country For each country i, a
> maximum **number of components** is calculated as follows, ...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> MONTHLY INDEX NEWS / September 2022 Featured index September brought more changes to the
> methodology behind the blue-chip DAX®. For the first time since the index was introduced in 1988,
> the **number of components**’ shares, weight factors and caps affected by the quarterly review was
> fixed using data as of the close on t-6 (six trading days before ...
>
> — [Monthly Index News September 2022 (PDF)](https://stoxx.com/monthly-index-news-september-2022)
>
> GUIDE 64/639 7. STOXX BENCHMARK INDICES (BMI) 7.1.3. ONGOING MAINTENANCE Selection list: The
> selection list is updated on a monthly basis according to the review component selection process
> and Selection list definition in section 5.2 of STOXX Index Methodology Guide. Replacements: To
> maintain the **number of components** constant, a deleted stock i...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> UNITED STATES FAQ: EXECUTIVE COMPENSATION POLICIES ▪ The portion of the EMI’s management fee that
> is allocated to NEO compensation paid by the external manager (aggregated values for all NEOs is
> acceptable); ▪ Of this compensation, the breakdown of fixed vs. variable/incentive pay; and ▪ The
> metrics utilized to measure performance to determine N...
>
> — [Us Executive Compensation Policies Faq (PDF)](https://www.issgovernance.com/file/policy/latest/americas/US-Executive-Compensation-Policies-FAQ.pdf)
>
> Summary The STOXX Nordic Total Market Index (TMI) is a regional subset of the STOXX Europe TMI
> Index, which covers approximately 95 percent of the free float market capitalisation of Europe.
> With a variable **number of components**, the STOXX Nordic TMI Index covers Denmark, Finland,
> Norway and Sweden. With a variable **number of components**, the STOXX...
>
> — [STOXX&reg; Nordic Total Market - STOXX](https://stoxx.com/index/bdxdgv)
>

---

## O

### Optimization-Based Weighting

> A weighting methodology in which constituent weights are determined by solving a mathematical optimization problem — typically minimizing portfolio variance, maximizing diversification, or targeting a specific risk-factor exposure — subject to constraints such as turnover limits, weight bounds, and sector neutrality.

Optimization-based weighting represents a departure from simple mechanical rules (like equal weighting or cap weighting) toward quantitative portfolio construction techniques embedded in the index methodology. STOXX offers several index families that use optimization, including minimum variance and maximum diversification indices. The optimization is re-solved at each rebalancing using updated covariance estimates and constraint parameters specified in the rulebook.

$$
\min_{w} \quad w^\top \Sigma \, w \quad \text{subject to} \quad \sum_{i} w_i = 1, \quad w_i \ge 0, \quad w_i \le W_{\max}
$$

Where $\Sigma$ is the estimated covariance matrix of constituent returns and $W_{\max}$ is the maximum weight per constituent.

> [!tip] Related terms
> [[#Weighting Scheme]], [[#Modified Market Cap Weighting]], [[#Fundamental Weighting]], [[#Systematic Index]]
---

## P

### Periodic Review

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="15 mentions across STOXX & ISS pages (low)">▰▰ 15</span>


> The scheduled process — typically conducted quarterly, semi-annually, or annually — during which an index provider reassesses constituency, share counts, free-float factors, and other parameters against current data.

Periodic reviews are the primary governance mechanism for index maintenance. STOXX conducts reviews on predefined calendar dates published in advance. During a review, the index provider re-applies eligibility and selection criteria to the index universe, updates share counts and free-float factors, recalculates capping factors if applicable, and announces the resulting changes before the effective date.

> [!tip] Related terms
> [[#Reconstitution]], [[#Review Frequency]], [[#Announcement Date]], [[#Rebalancing]]

> [!example]- Source excerpts (5)
>
> STOXX INDEX METHODOLOGY GUIDE 305/639 16. STOXX RISK BASED INDICES Review frequency The index
> composition is reviewed annually in December. All changes are implemented on the third Friday and
> effective the next trading day following the STOXX **periodic review** calendar. The cut-off date
> for the selection list and the ADTV data to calculate the wei...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> STOXX WORLD EQUITY INDEX METHODOLOGY GUIDE 17/37 4. INDEX CHARACTERISTICS BUFFERS Buffers are used
> in the **periodic review**s to reduce turnover. Based on an index-specific characteristic, an
> upper and a lower limit is set around the index target coverage. Stocks ranked at and above the
> upper limit are selected for the index. The remaining stocks n...
>
> — [Stoxx World Equity Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)
>
> ocedure in case of material changes of the index IGC methodology Deviations from notification
> procedure in case of non-material changes of the IMC index methodology Extreme or exceptional
> market conditions or analogous extraordinary IGC situations to be addressed in a fast track way
> (e.g. Pandemic) **Periodic review** of current index methodologies ...
>
> — [Guide To Eurogov Bond Indices (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/Guide_to_EUROGOV_Bond_Indices.pdf)
>
> s whether this data is adequate. If STOXX assesses that the quantity of Transaction Data is
> inadequate it will deem this to be a Limitation and the IGC will then exercise Discretion in how
> to resolve the situation. STOXX does not use any models or methods of extrapolation in relation to
> Input Data. **Periodic review**s of all benchmarks are undertak...
>
> — [Stoxx Equity Index Family Benchmark Statement (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Resources/Regulation/STOXX_Equity_Index_Family_Benchmark_Statement.pdf)
>
> 00, STOXX Asia 100, STOXX Pacific 50, STOXX BRIC 100, STOXX Latin America 50, STOXX Sub Balkan 30
> and STOXX China A 50 indices are also part of this regular quarterly review. Additions to and
> deletions from these indices were published after the closing of markets on Sep. 1 at
> https://www.stoxx.com/periodic-review-reports. Furthermore, the STOXX...
>
> — [STOXX Changes Composition Of Blue-Chip Indices - Sep. 21, 2018 | Press releas...](https://stoxx.com/stoxx-changes-composition-of-blue-chip-indices)
>

---

### Price Return Index

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="38 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 38</span>


> An index variant that measures the performance of the constituent basket based solely on price changes, without accounting for dividend distributions or other income.

The price return index is the simplest form of index calculation. When a constituent pays a dividend, the price drops by approximately the dividend amount on the ex-date, and this decline is reflected in the index level. No reinvestment adjustment is made. Price return indices understate total investor returns but are widely quoted in the media (e.g., the headline Dow Jones Industrial Average level is a price return figure).

$$
\text{PRI}_t = \frac{\sum_{i=1}^{n} P_i^t \times S_i \times f_i \times \text{CF}_i}{D_t}
$$

> [!tip] Related terms
> [[#Gross Return Index]], [[#Net Return Index]], [[#Total Return Index]]

> [!example]- Source excerpts (5)
>
> STOXX® DIGITAL ASSET METHODOLOGY GUIDE 12/31 3. INDEX CHARACTERISTICS INDEX CALCULATION The
> indices are calculated using Laysperes formula as described in this section. 3.8.1. **PRICE RETURN
> INDEX** The indices are weighted based on the components’ reference prices and weighting factors:
> ∑𝑛 (𝑝 ∙ 𝑤𝑓 ∙𝑥 ) 𝑀 𝑖=1 𝑖𝑡 𝑖𝑡 𝑖𝑡 𝑡 𝐼𝑛𝑑𝑒𝑥 𝑡 = 𝐷 = 𝐷 𝑡 𝑡 Where: t ...
>
> — [Stoxx Digital Asset Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_digital_asset_guide.pdf)
>
> Index stated in conventional terms. Maturity / WAL Years to effective maturity date of the bond or
> years to the closest coupon reset date prior to maturity. Yrs To Worst Index level Years to Worst
> PRR Index Val LOC **Price return index** value in local currency PRR % MTD LOC Month-to-date
> return of the **price return index** in local currency
>
> — [Guide To Eurogov Bond Indices (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/Guide_to_EUROGOV_Bond_Indices.pdf)
>
> Digital assets indices, price return. Data as of June 28, 2024. Source: STOXX. Index and
> volatility performance 230 100% 140% 210 90% 120% 80% 190 100% 70% 170 60% 80% 150 50% 60% 130 40%
> 30% 40% 110 20% 20% 90 10% 70 0% 0% Jul,23 Sep,23 Nov,23 Jan,24 Mar,24 May,24 1 2 June 2024 1 2
> Figure 27: EUR **price return index** performance. July 2023 – June...
>
> — [Monthly Index News June 2024 (PDF)](https://stoxx.com/monthly-index-news-june-2024)
>
> X Digital Assets indices, price return. Data as of March 28, 2024. Source: STOXX. Index and
> volatility performance 220 100% 140% 90% 200 120% 80% 180 100% 70% 160 60% 80% 50% 140 60% 40% 120
> 30% 40% 20% 100 20% 10% 80 0% 0% Apr,23 Jun,23 Aug,23 Oct,23 Dec,23 Feb,24 1 2 March 2024 1 2
> Figure 27: EUR **price return index** performance. Apr. 2023 – Mar...
>
> — [Monthly Index News March 2024 (PDF)](https://stoxx.com/monthly-index-news-march-2024)
>
> he STOXX Digital Asset Blue Chip X must be eligible for the FSE’s Xetra venue. Index and
> volatility performance 230 100% 140% 210 90% 120% 80% 190 100% 70% 170 60% 80% 150 50% 60% 130 40%
> 30% 40% 110 20% 20% 90 10% 70 0% 0% May-23 Jul-23 Sep-23 Nov-23 Jan-24 Mar-24 1 2 April 2024 1 2
> Figure 27: EUR **price return index** performance. May 2023 – Apr....
>
> — [Monthly Index News April 2024 (PDF)](https://stoxx.com/monthly-index-news-april-2024)
>

---

### Price Weighting

> A weighting methodology in which each constituent's weight in the index is proportional to its absolute share price, without regard to the company's market capitalization or number of shares outstanding.

Price weighting is the oldest and simplest weighting method, used notably by the Dow Jones Industrial Average. A stock trading at USD 200 has twice the weight of a stock trading at USD 100, regardless of their respective market values. STOXX does not typically employ price weighting for its benchmark indices, as it produces arbitrary weights driven by stock-split history rather than economic significance.

$$
w_i = \frac{P_i}{\sum_{j=1}^{n} P_j}
$$

> [!tip] Related terms
> [[#Market Capitalization Weighting]], [[#Equal Weighting]], [[#Weighting Scheme]]
---

### Pro-Forma Index

> A hypothetical version of an index constructed to illustrate the impact of a proposed methodology change, a new selection rule, or an anticipated corporate action before the change is officially implemented.

Pro-forma indices are analytical tools used by index providers, asset managers, and regulators to assess the potential effects of rule changes. STOXX may publish pro-forma indices during stakeholder consultations to demonstrate how a proposed methodology amendment would alter constituency, weights, or historical performance. Pro-forma data is clearly labeled as illustrative and is not used for benchmarking or product settlement purposes.

> [!tip] Related terms
> [[#Simulation]], [[#Stakeholder Consultation]], [[#Index Committee]]
---

## R

### Rebalancing

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="278 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 278</span>


> The periodic process of realigning constituent weights to their target values as defined by the weighting scheme, which may also involve updating share counts, free-float factors, and capping factors.

Rebalancing corrects the weight drift that accumulates between review dates as constituent prices diverge. For equally weighted indices, rebalancing resets all weights to $1/n$. For capped free-float indices, rebalancing recalculates capping factors so that no constituent exceeds its weight ceiling. Rebalancing triggers a divisor adjustment to maintain index level continuity and is a key driver of turnover in index-tracking portfolios.

> [!tip] Related terms
> [[#Reconstitution]], [[#Divisor Adjustment]], [[#Capping]], [[#Turnover]]

> [!example]- Source excerpts (5)
>
> Price weighted with a weighting factor to achieve an equally weighting Base values and dates: 100
> as of Dec 31, 2004 Index types and currencies: Price, net return and gross return in EUR and USD.
> INDEX REVIEW Selection list: The review cut-off date is the last trading day of the month
> preceding the **rebalancing** date. At cutoff date, for each stoc...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> The weighting factor of component i at time t is calculated as follows: 𝑤 𝑖𝑡 𝑤𝑓 =100bn ∗ 𝑖𝑡 𝑝 𝑖𝑡
> with 𝑝 being the closing price of component i at time t. The weighting factor 𝑤𝑓 is rounded to 𝑖𝑡
> 𝑖𝑡 the next integer. Review frequency: The components are reviewed semi-annually in March and
> September. **Rebalancing** takes place on a quarterly basis. 1...
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> least 7% starting from 2022 with respect trajectory in line with to 2021. The year-on-year carbon
> reduction included is calculated as: review schedule 1−( 𝐼𝑛𝑑𝑒𝑥 𝐺𝐻𝐺 𝐼𝑛𝑡𝑒𝑛𝑠𝑖𝑡𝑦𝑐𝑢𝑟𝑟𝑒𝑛𝑡 ∙𝐶𝑢𝑚𝑢𝑙𝑎𝑡𝑖𝑣𝑒
> 𝐼𝑛𝑓𝑙𝑎𝑡𝑖𝑜𝑛 𝐴𝑑𝑗𝑢𝑠𝑡𝑚𝑒𝑛𝑡 𝐹𝑎𝑐𝑡𝑜𝑟 ) 1/(𝑌 4) 𝐼𝑛𝑑𝑒𝑥 𝐺𝐻𝐺 𝐼𝑛𝑡𝑒𝑛𝑠𝑖𝑡𝑦2021 𝑦𝑒𝑎𝑟−𝑒𝑛𝑑 where Y is the number of
> quarterly **rebalancing**s since December 2021. g Index revie...
>
> — [Results Of Market Consultation On Proposed Changes To The Methodology Of The ... (PDF)](https://www.stoxx.com/document/Resources/MarketConsultation/Results%20of%20Market%20Consultation%20on%20proposed%20changes%20to%20the%20methodology%20of%20the%20STOXX%20Paris-Aligned%20and%20Climate%20Transition%20Benchmark%20Indices.pdf)
>
> Solutions eb.rexx Bond indices German government bond indices based on ICE data The eb.rexx Bond
> indices cover the German government bond market with both total return and price return indices
> with monthly **rebalancing**. In December 2024, STOXX partnered with ICE to calculate, maintain
> and report the indices. Key eb.rexx Bond indices Search Search...
>
> — [eb.rexx Bond indices | STOXX](https://stoxx.com/fixed-income-indices/eb-rexx-bond-indices)
>
> Guidance - DAX Equity Index Calculation confidentiality has been requested by the respective
> Stakeholders. The effective date for benchmark methodology changes is aligned, where feasible,
> with the periodic benchmark reviews dates when the benchmark composition is changed, and a
> **rebalancing** is triggered to avoid extra ordinary impact for clients....
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>

---

### Reconstitution

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="3 mentions across STOXX & ISS pages (ultra-low)">▰ 3</span>


> The process of redetermining the membership of an index by re-applying eligibility and selection criteria to the full index universe, resulting in additions of newly qualifying securities and deletions of those that no longer qualify.

Reconstitution is distinct from rebalancing: reconstitution changes *which* securities are in the index, while rebalancing changes *how much weight* each security carries. In practice, both often occur simultaneously during periodic reviews. STOXX reconstitution follows a transparent, rules-based methodology that ranks eligible securities and applies buffer rules to manage turnover.

> [!tip] Related terms
> [[#Rebalancing]], [[#Periodic Review]], [[#Buffer Rule]], [[#Selection Criteria]]

> [!example]- Source excerpts (3)
>
> Implications of Index **Reconstitution**s: Free Carbon Alpha? SEPTEMBER 22, 2022 KEY TAKEAWAYS -
> ISS ESG’s Climate Impact Report provides a detailed analysis of a portfolio’s carbon footprint,
> with 99.85% of coverage of the Russell 3000 Index. In preparing this report, the authors analysed
> the climate profile of $100 billion
>
> — [Implications of Index Reconstitutions: Free Carbon Alpha? | ISS](https://www.issgovernance.com/library/implications-of-index-reconstitutions-free-carbon-alpha)
>
> Background Key Events TPG-Axon, the company’s third-largest shareholder at 6.7%, is requesting Nov
> 8, 2012—TPG-Axon, a 4.5% holder, delivers letter to SandRidge board re- shareholders act by
> written consent to replace all 7 incumbents, including the questing declassification and
> **reconstitution** of the board in consultation founder CEO/Chairman, o...
>
> — [Ma Analysis (PDF)](https://www.issgovernance.com/file/2013/02/MA_analysis.pdf)
>
> -compliant with the UN’s Global Compact Principles – a set of core values in the areas of human
> rights, labour standards, the environment, and anti-corruption – are also excluded. The remaining
> constituents are weighted by free float-adjusted market capitalization subject to a 20% cap per
> security. **Reconstitution** and rebalancing occur quarterly....
>
> — [Stoxx introduces Stoxx Europe 600 ESG-X Index | ETF Strategy - ETF Strategy](https://stoxx.com/stoxx-introduces-stoxx-europe-600-esg-x-index)
>

---

### Review Frequency

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="492 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 492</span>


> The cadence at which an index provider conducts periodic reviews, commonly expressed as quarterly (March, June, September, December), semi-annually, or annually.

STOXX uses different review frequencies across its index families. The EURO STOXX 50, for example, conducts a full reconstitution annually in September, with quarterly reviews for share and free-float updates only. More frequent reviews improve representativeness but increase turnover. The review frequency is a fundamental design choice that balances accuracy against transaction costs for index-tracking investors.

> [!tip] Related terms
> [[#Periodic Review]], [[#Reconstitution]], [[#Turnover]]

> [!example]- Source excerpts (5)
>
> Domestic Revenue is defined as revenue generated within Japan, which is the region represented by
> the parent index, STOXX Japan Universal Index86. 2. STOXX Japan Foreign Focus Index: From the
> Universe, the remaining companies which were not included in the Domestic Index, define the
> Foreign Index. **Review frequency**: The index is reviewed semi-ann...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> enominator is the sum of the six-month ADTV in EUR of all 40 companies in the index. The weighting
> factor of component i at time t is calculated as follows: 𝑤 𝑖𝑡 𝑤𝑓 =100bn∗ 𝑖𝑡 𝑝 𝑖𝑡 with 𝑝 being the
> closing price of component i at time t. The weighting factor 𝑤𝑓 is rounded to 𝑖𝑡 𝑖𝑡 the next
> integer. **Review frequency**: The index is reviewed once a ...
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> AC Universal All Cap Equity Index. The base value, the base dates and the index types are as of
> the parent STOXX World AC Universal All Cap Equity Index, unless specified otherwise. 6.3.2. INDEX
> REVIEW Component selection: The indices consist of the components of the relevant STOXX Country
> Indices. **Review frequency**: The **review frequency** of each ...
>
> — [Stoxx World Equity Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)
>
> STOXX® DIGITAL ASSET METHODOLOGY GUIDE 24/31 5. STOXX DIGITAL ASSET BLUE CHIP INDEX confined to
> the index capping limit and excess weight will redistributed to the remaining constituents that
> are below the capping limit, proportionally to their current index weights. 5.3.3. **REVIEW
> FREQUENCY** The review is conducted on a quarterly basis in March, ...
>
> — [Stoxx Digital Asset Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_digital_asset_guide.pdf)
>
> 1081603 SXXAGU .SXXAGU Cap factor no cap for Nordic Index Net Return AUD CH0271081629 SXXAU .SXXAU
> 600 for the three regional indices; 1,800 for the combined index; No. of components Net Return AUD
> CH0271081629 SXXAU .SXXAU variable for Eurozone and Nordic subset Price AUD CH0271081645 SXXAA
> .SXXAA **Review frequency** Quarterly (Mar., Jun., Sep., D...
>
> — [Sxxgr (PDF)](https://www.stoxx.com/document/Indices/Factsheets/2020/July/SXXGR.pdf)
>

---

### Rules-Based Index

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1 mentions across STOXX & ISS pages (ultra-low)">▰ 1</span>


> An index constructed and maintained according to a transparent, pre-defined, and publicly documented set of rules covering universe definition, eligibility, selection, weighting, rebalancing, and corporate action treatment, minimizing discretionary judgment by the index provider.

All STOXX indices are rules-based, meaning that their methodology is fully codified and published. This transparency is a regulatory requirement under the EU Benchmark Regulation (BMR) and IOSCO Principles for Financial Benchmarks. A rules-based approach ensures replicability, auditability, and consistency, and allows market participants to anticipate index changes before they are officially announced.

> [!tip] Related terms
> [[#Eligibility Criteria]], [[#Selection Criteria]], [[#Weighting Scheme]]

> [!example]- Source excerpts (1)
>
> The STOXX® Digital Asset Blue Chip index aims to track high-quality assets that represent the
> crypto universe. The index was launched in partnership with Bitcoin Suisse, a leading Swiss
> crypto-financial services provider and brings together STOXX’s transparent and **rules-based
> index** methodology with Bitcoin Suisse’s expertise in the crypto space....
>
> — [Digital Asset Indices | STOXX](https://stoxx.com/digital-asset-indices)
>

---

## S

### Sector Weighting

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="5 mentions across STOXX & ISS pages (ultra-low)">▰ 5</span>


> The aggregate weight of all constituents classified within a specific industry sector or supersector, reflecting that sector's representation in the index at a given point in time.

Sector weighting is a fundamental dimension of index risk and return attribution. STOXX uses the ICB (Industry Classification Benchmark) system to classify constituents into industries and supersectors. In a free-float capitalization-weighted index, sector weights emerge organically from constituent market capitalizations. Some STOXX index variants impose sector concentration limits to prevent dominance by a single industry. Investors routinely monitor sector weights to understand the economic exposures embedded in their benchmark.

> [!tip] Related terms
> [[#Country Weighting]], [[#Concentration Limit]], [[#Weighting Scheme]]

> [!example]- Source excerpts (5)
>
> and Information Technology are two of the most important ones, as it happens with the larger DAX.
> This implies that the core, global-leading prowess of Germany’s corporate sector in those two
> industries is equally present in both the large and small companies segments. Further, the rest of
> the Super**sector weighting**s show a highly diversified ind...
>
> — [Exploring SDAX, the benchmark for German small companies | Blog posts | STOXX](https://stoxx.com/exploring-sdax-the-benchmark-for-german-small-companies)
>
> est components as of July 15, 2024. Figure 3: Top 10 index components Figure 4 displays the
> index’s Supersectors distribution. Banks, Technology and Industrial Goods & Services all surpass a
> 10% weight threshold. Overall, the Supersector distribution shows a highly diversified index.
> Figure 4: Super**sector weighting**s Asia’s growth story With a po...
>
> — [Indian stocks shine bright, outperforming Asian markets  | Blog posts | STOXX](https://stoxx.com/indian-stocks-shine-bright-outperforming-asian-markets)
>
> tly in recent years as clients have come to define sustainability in different, more nuanced ways.
> Today, investing sustainably often means integrating ESG considerations into traditional exposures
> in a measured, pragmatic way — and this ETF was designed precisely with that in mind.” Figure 1:
> Super**sector weighting**s (top 10 of benchmark) What ma...
>
> — [BlackRock’s Thurner on why iShares EURO STOXX 50 ESG ETF is attractive propos...](https://stoxx.com/blackrocks-thurner-on-why-ishares-euro-stoxx-50-esg-etf-is-attractive-proposition-for-both-retail-and-institutional-investors)
>
> ndicates a less U.S. Equities expensive market valuation. 14.1x STOXX Europe 600 21.7x U.S. 14.8x
> Asia Pacific Source: STOXX. Data as of March 31st, 2025. The U.S. and Asia-Pacific are represented
> by STOXX USA 500 and STOXX Asia/Pacific 600 indices. S E C T O R W E I G H T I N G S Europe Versus
> the **Sector weighting**s of the STOXX Europe 600 skew ...
>
> — [Stoxx Infographic Stoxxeurope600 (PDF)](https://stoxx.com/wp-content/uploads/2025/06/STOXX_Infographic_STOXXEurope600.pdf)
>
> indices In this paper we evaluate two thematic investment strategies – STOXX® Global Ageing
> Population (“Ageing Population”) and STOXX® Global Millennials (“Millennials”) – which seek
> exposure to these two distinct generations. Our research identified vast differences across style
> characteristics, **sector weighting**s and especially performance, wi...
>
> — [Mind the (Generation) Gap | Whitepapers | STOXX](https://stoxx.com/mind-the-generation-gap-whitepaper)
>

---

### Selection Criteria

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="66 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 66</span>


> The specific quantitative and qualitative rules — beyond basic eligibility — used to rank and choose constituents from the eligible universe, typically based on market capitalization rank, liquidity thresholds, sector representation, or factor scores.

Selection criteria determine which securities from the eligible universe actually enter the index. For a benchmark like the STOXX Europe 600, selection is primarily by free-float market capitalization rank within size segments (large, mid, small). For thematic or strategy indices, selection may incorporate ESG scores, factor exposures, or fundamental metrics. Buffer rules are applied during selection to manage turnover.

> [!tip] Related terms
> [[#Eligibility Criteria]], [[#Buffer Rule]], [[#Index Universe]], [[#Selection List]]

> [!example]- Source excerpts (5)
>
> STOXX INDEX METHODOLOGY GUIDE 490/639 17. STOXX THEMATIC INDICES Multiple share lines: in case a
> company is present with multiple listings and/or DR lines and/or multiple share classes, all of
> the lines are eligible, subject to the screening and **selection criteria**. ESG Screening: all
> securities must pass all of the following ESG criteria:  Glob...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> ther the direct ownership stake of the owner-dominated holding company nor the calculated adjusted
> ownership stake may exceed the 75% threshold (Criterion 2). 3) The company’s post-IPO age does not
> exceed ten years. The post-IPO age is calculated as the period between the review cutoff date for
> the **selection criteria** and the date of the company’...
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> EUROGOV® indices, no explicit liquidity filter is applied. The applied **selection criteria** of
> the index constituents facilitate the selection of liquid constituents due to filtering by issuer,
> country as well as minimum nominal amount outstanding for a bond. Consequently, stricter
> constraints on the **selection criteria** favour the selection of the ...
>
> — [Guide To Eurogov Bond Indices (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/Guide_to_EUROGOV_Bond_Indices.pdf)
>
> STOXX WORLD EQUITY INDEX METHODOLOGY GUIDE 10/37 3. COVERAGE Application of the **selection
> criteria** for the STOXX World country classification in 2022: Criteria Developed Emerging
> Frontier Economic Development Country GNI per capita 25% above the World Bank GNI Per Capita* No
> requirement No requirement high income threshold for 3 consecutive year...
>
> — [Stoxx World Equity Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)
>
> The DAX ESG Target Index aims to mirror the risk and return characteristics of DAX while applying
> ESG screens, integrating ESG scores and reducing the portfolio’s carbon intensity by at least 30%.
> The index has the same number of constituents as DAX, replacing those stocks that fail to meet the
> ESG **selection criteria** with stocks in the HDAX® uni...
>
> — [Benchmark DAX Grows to 40 Stocks – What’s the Impact on the DAX ESG Target In...](https://stoxx.com/dax_esg_target_and_dax_reform_2021)
>

---

### Selection List

<span style="background:red; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1,025 mentions across STOXX & ISS pages (high)">▰▰▰▰▰▰ 1,025</span>


> The ordered ranking of eligible securities — typically sorted by free-float market capitalization or another primary criterion — from which the final index constituents are drawn during reconstitution.

The selection list is the intermediate output of the index construction process, produced after eligibility screening but before the application of buffer rules and final constituent determination. STOXX constructs the selection list at each periodic review by ranking all eligible securities according to the index's primary selection criterion. Buffer rules are then applied to determine which securities are added or retained and which are removed.

> [!tip] Related terms
> [[#Selection Criteria]], [[#Reconstitution]], [[#Buffer Rule]]

> [!example]- Source excerpts (10)
>
> STOXX INDEX METHODOLOGY GUIDE 113/639 10. STOXX DIVIDEND INDICES where ADTVi represents the
> Average Daily Traded Value of the ith non-component stock over the 3- month period ending on the
> month prior to the review month. 4. Outperformance factor calculation To obtain the **selection
> list** all companies are ranked according to an outperformance fac...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> OBAL WATER INDEX Core: the largest 40 companies in terms of free-float market capitalization of
> the **selection list** are selected from the core composition list. Satellite: The Satellite
> composition list with 10 securities is derived by following the steps below: 1) For each security
> in the satellite **selection list**, the revenue coming from water r...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> STOXX INDEX METHODOLOGY GUIDE 113/639 10. STOXX DIVIDEND INDICES where ADTVi represents the
> Average Daily Traded Value of the ith non-component stock over the 3- month period ending on the
> month prior to the review month. 4. Outperformance factor calculation To obtain the **selection
> list** all companies are ranked according to an outperformance fac...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> OBAL WATER INDEX Core: the largest 40 companies in terms of free-float market capitalization of
> the **selection list** are selected from the core composition list. Satellite: The Satellite
> composition list with 10 securities is derived by following the steps below: 1) For each security
> in the satellite **selection list**, the revenue coming from water r...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> DAX EQUITY INDEX METHODOLOGY GUIDE 17/120 5. STOCK CHARACTERISTICS If a company that has been
> excluded from the indices subsequently meets the financial reporting requirements, its stock can
> again be ranked on the next **selection list** if it meets the necessary criteria. The standard
> notice period of two trading days for all of the breaches above ...
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> FILES GUIDE 13 FF Mcap (MEUR) Free float market capitalization in Millions in currency EUR Number
> 8 14 Rank (FINAL) Rank in the **selection list** Number 0 15 Rank (PREVIOUS) Previous rank in the
> **selection list** Number 0 16 Comment Text 255 New Ranking of constituents, applicable for
> indices which are 17 Rank 2 (FINAL) Number 0 using a double ranking...
>
> — [Index Files Guide 20230619 (PDF)](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)
>
> DAX EQUITY INDEX METHODOLOGY GUIDE 17/120 5. STOCK CHARACTERISTICS If a company that has been
> excluded from the indices subsequently meets the financial reporting requirements, its stock can
> again be ranked on the next **selection list** if it meets the necessary criteria. The standard
> notice period of two trading days for all of the breaches above ...
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> FILES GUIDE 13 FF Mcap (MEUR) Free float market capitalization in Millions in currency EUR Number
> 8 14 Rank (FINAL) Rank in the **selection list** Number 0 15 Rank (PREVIOUS) Previous rank in the
> **selection list** Number 0 16 Comment Text 255 New Ranking of constituents, applicable for
> indices which are 17 Rank 2 (FINAL) Number 0 using a double ranking...
>
> — [Index Files Guide 20230619 (PDF)](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)
>
> renewable-energy initiatives, according to the thorough environmental data rankings from CDP. It
> excludes firms deemed in contravention of UN Global Compact Principles by Sustainalytics, as well
> as those involved in controversial weapons activities, and in the coal and tobacco sectors.
> Creating the **selection list** Within the benchmark universe, t...
>
> — [ESG Index Geared to Structured Products | Blog posts | STOXX](https://stoxx.com/esg-index-geared-to-structured-products)
>
> renewable-energy initiatives, according to the thorough environmental data rankings from CDP. It
> excludes firms deemed in contravention of UN Global Compact Principles by Sustainalytics, as well
> as those involved in controversial weapons activities, and in the coal and tobacco sectors.
> Creating the **selection list** Within the benchmark universe, t...
>
> — [ESG Index Geared to Structured Products | Blog posts | STOXX](https://stoxx.com/esg-index-geared-to-structured-products)
>

---

### Simulation

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="27 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 27</span>


> The process of applying an index methodology retroactively to historical data to generate a hypothetical back-tested performance track record for a period before the index was officially launched.

Simulated (back-tested) data allows index users to evaluate how an index would have performed under various market conditions. STOXX clearly distinguishes between live and simulated data in its publications. It is important to note that simulated performance does not reflect actual trading, does not account for transaction costs, and may incorporate survivorship bias or look-ahead bias. Regulatory standards require clear disclosure when simulated data is presented.

> [!tip] Related terms
> [[#Base Date]], [[#Base Value]], [[#Tracking Error]]

> [!example]- Source excerpts (5)
>
> y Indices. DAX **Simulation** data will be displayed in the New Index Data Distribution System
> throughout the whole **simulation** phase (i.e. from December 18th, 2023 to February 29th, 2024).
> - Official DAX Equity Indices data will only be displayed in the Current Index Data Distribution
> System during the Simulation phase. For the convenience of our cl...
>
> — [Dax Equity Indices Simulation Phase–From Dec 18 2023 To February 29 2024 (PDF)](https://www.stoxx.com/document/News/2023/October/DAX_Equity_Indices_Simulation_Phase–from_Dec_18_2023_to_February_29_2024.pdf)
>
> cas of physical assets — or digital twins. Digital twins: more than just an online **simulation**
> Digital twins are virtual representations of real-world objects or processes that can be used to
> model entire factories, product lifecycles and supply chains. But what distinguishes them from
> simple online **simulation**s is the fact that they are linked to...
>
> — [The industrial Metaverse – beyond gaming and social media | Blog posts | STOXX](https://stoxx.com/the-industrial-metaverse-beyond-gaming-and-social-media)
>
> (Web & iSFTP) granted - October 2023: New iSFTP folder structure is available and DAX clients can
> access “new set of Index Data for live DAX Strategy and Fixed Income Indices”, as well as Ranking
> Lists for applicable DAX Equity Indices - December 2023: Index Data are displayed for the
> temporary DAX **Simulation** of the DAX Equity indices (see Annou...
>
> — [Technical Migration New Index Data Distribution System And New File Formats F... (PDF)](https://www.stoxx.com/document/News/2023/March/Technical_Migration-New_Index_Data_Distribution_System_and_New_File_Formats_for_DAX_Indices_20230327_3457284624.pdf)
>
> ates based on the **simulation** show that Tesla accounted for more than 1 percentage point of the
> benchmark’s gross performance. The extra returns would not have come at the cost of any
> significant increase in volatility, decrease in the overall dividend yield or material tracking
> error, based on this **simulation**. The extra return may also help expl...
>
> — [Tesla’s place in a US stock benchmark | Blog posts | STOXX](https://stoxx.com/teslas-place-in-a-us-stock-benchmark)
>
> liquidity, risk and diversification. To gauge the potential impact of such optimized strategies on
> the capacity of smart beta, Siu repeated the earlier break-even capacity analysis but now assuming
> that the STOXX Factor Indices have a 20% share of the current smart beta ETF market. Performing
> this **simulation** resulted in break-even capacity sizes...
>
> — [Study Shines Light on Smart Beta’s Effectiveness and Capacity | Blog posts | ...](https://stoxx.com/study-shines-light-on-smart-betas-effectiveness-and-capacity)
>

---

### Stakeholder Consultation

> A formal process in which an index provider solicits feedback from market participants, licensees, and other stakeholders before implementing material changes to an index methodology, in accordance with governance best practices and regulatory requirements.

Stakeholder consultations are a key element of index governance under the EU Benchmark Regulation (BMR) and IOSCO Principles. STOXX conducts consultations when considering significant methodology changes, such as alterations to selection criteria, weighting schemes, or review frequency. The consultation typically includes a public notice, a comment period, review of feedback by the Index Committee, and a final decision announcement. This process ensures transparency and gives affected parties an opportunity to assess the impact of proposed changes.

> [!tip] Related terms
> [[#Index Committee]], [[#Rules-Based Index]], [[#Pro-Forma Index]]
---

### Systematic Index

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="3 mentions across STOXX & ISS pages (ultra-low)">▰ 3</span>


> An index constructed using a transparent, rules-based methodology that systematically targets a specific investment factor, theme, or strategy — such as value, momentum, low volatility, or ESG — rather than simply capturing broad market-capitalization exposure.

Systematic indices (also called strategy or smart beta indices) go beyond traditional benchmark construction by embedding an investment thesis directly into the index rules. STOXX offers a wide range of systematic indices that select and weight constituents based on factor scores, optimization targets, or thematic criteria. Despite the added complexity, systematic indices adhere to the same governance, transparency, and rules-based standards as traditional benchmark indices.

> [!tip] Related terms
> [[#Rules-Based Index]], [[#Optimization-Based Weighting]], [[#Fundamental Weighting]], [[#Weighting Scheme]]

> [!example]- Source excerpts (3)
>
> ed products, most use carbon emissions to target carbon reduction.” In the CTI indices, we move
> beyond carbon emissions and “look at what the valuation risk is going to be at the company level,
> and bring that to life in an index.” The index methodology translates “the CTVaR data into a
> rules-based, **systematic index** and the key is the probability...
>
> — [A view from COP26: navigating the climate transition with investable indices ...](https://stoxx.com/a-view-from-cop26-navigating-the-climate-transition-with-investable-indices)
>
> e Transition Analytics Senior Director, Willis Towers Watson “Understanding and addressing climate
> transition risk is essential to investment decisions today. Together with Willis Towers Watson, we
> leveraged our open architecture to translate the Willis Towers Watson CTVaR model into a
> transparent, **systematic index** solution.” Neal Pawar, Chief O...
>
> — [Willis Towers Watson and Qontigo launch pioneering STOXX Global Index Series ...](https://stoxx.com/willis-towers-watson-and-qontigo-launch-pioneering-stoxx-global-index-series-that-quantifies-the-climate-transition-risk-of-companies)
>
> hence indicating a relatively favorable stock selection. A bias towards growth was observed in
> most of the thematic indices, which could be expected since thematic indices attempt to obtain
> exposure to megatrends as they are evolving. Particular risk and return characteristics as key
> elements Using **systematic index**-based approaches, investors ma...
>
> — [An Analysis of Thematic Portfolios Construction, Risk and Returns | Blog post...](https://stoxx.com/an-analysis-of-thematic-portfolios-construction-risk-and-returns)
>

---

## T

### Total Return Index

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="33 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 33</span>


> A generic term for an index variant that accounts for both price appreciation and the reinvestment of dividends and other cash distributions, encompassing both gross return and net return variants.

"Total return index" is often used as a shorthand for either the gross or net return version, depending on context. The key distinction from a price return index is that dividends are treated as reinvested (in full or after tax) rather than lost. For performance measurement and fund benchmarking, total return indices are the appropriate comparison because they reflect the full economic return earned by an equity investor.

> [!tip] Related terms
> [[#Gross Return Index]], [[#Net Return Index]], [[#Price Return Index]]

> [!example]- Source excerpts (5)
>
> .2. CALCULATION The excess return index is calculated as follows: 𝐹 𝐼ER =𝐼ER ⋅ k,t 𝑡 𝑡−1 𝐹 k,t−1
> The **total return index** is calculated as follows: 𝐹 𝑑 𝐼TR =𝐼TR ⋅( k,t + ⋅𝑅 ) 𝑡 𝑡−1 𝐹 360 f, t−1
> k,t−1 Where: 𝐼ER = Excess return index value on day (t) - Unrounded t-1 value used for 𝑡
> calculation. 𝐼TR = **Total return index** value on day (t) - Unrounded...
>
> — [Dax Strategy Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)
>
> F e ed = ( S E R + M E R )  R C  d a 3 y 6 sR 5 ,d RC = Replication Cost, R C = 1 . 0 0 % p.a.
> days = Number of calendar days between the immediately preceding Rebalancing Day R, d R (excluded)
> and the current Index Calculation Day d (included). 8. On any Index Calculation Day d, the value
> of the **Total Return Index** at time t is calculated as: ...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> _xxxxx o eod_indices_xxxxx_YYYYMMDD  With xxxxx being the Main Index Symbol  File type: .csv 
> File specification: comma separated  File frequency: daily at COB Column Data Data Format
> Attribute Description ID Type 1 Date Report date Date YYYY-MM-DD 2 ISIN_CPi Price index ISIN Text
> 12 3 ISIN_TRi **Total return index** ISIN Text 12 4 CODE_CPi Pric...
>
> — [Index Files Guide 20230619 (PDF)](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)
>
> mination Calendar: STOXX Eurex Calendar 11.2. BASIC DATA Index ISIN Symbol EURO STOXX
> Volatility-Balanced (Excess Return) CH0128045587 SX5EVBE EURO STOXX Volatility-Balanced (Total
> Return) CH0128045595 SX5EVBT 11.3. CALCULATION The EURO STOXX 50 Volatility-Balanced index is
> calculated as excess and **total return index** on every Index Business Day ...
>
> — [Stoxx Strategy Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_strategy_guide.pdf)
>
> uros, respectively, and remain headed for the first annual loss since 2011. Commodities markets
> showed one of the clearest signs of investors’ lingering concern about a global economic slowdown.
> Brent crude price in London tumbled 22% to $51 a barrel over November. The Thomson Reuters CRB
> Commodity **Total Return Index**, which tracks metals prices,...
>
> — [Late Rally Helps Stocks Rebound in November | Blog posts | STOXX](https://stoxx.com/late-rally-helps-stocks-rebound-in-november)
>

---

### Tracking Error

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="432 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 432</span>


> The annualized standard deviation of the difference in returns between a portfolio (or fund) and its benchmark index, measuring the consistency of replication.

Tracking error is the primary metric for evaluating how closely an index-tracking fund matches its benchmark. A tracking error of zero would indicate perfect replication. In practice, tracking error arises from transaction costs, cash drag, sampling, dividend timing, and corporate action handling. Index construction choices — such as capping frequency, buffer rules, and review frequency — directly influence the tracking error experienced by funds following the index.

$$
\text{TE} = \sigma\!\left(R_p - R_b\right) \times \sqrt{252}
$$

Where $R_p$ and $R_b$ are daily portfolio and benchmark returns, respectively, and 252 is the standard number of trading days per year.

> [!tip] Related terms
> [[#Turnover]], [[#Rebalancing]], [[#Simulation]]

> [!example]- Source excerpts (10)
>
> This article provides a high-level refresher of what **tracking error** means, and how we can
> embed it directly into portfolio construction. When we design a benchmarked portfolio, every
> design choice that takes us away from the benchmark has a consequence, and every consequence has a
> risk. **Tracking error** (TE) – the humble statistic that serves as a...
>
> — [Tracking Error 101: The Intuition Behind Measurement and Control | Whitepaper...](https://stoxx.com/tracking-error-101-the-intuition-behind-measurement-and-control)
>
> ESG scores vs. **tracking error**. So, what does a TE of x% really mean? As Seegopaul writes, TE
> is the annualized standard deviation of the difference between the portfolio’s returns and those
> of its benchmark. However, there seems to be less discussion about what the results imply. To
> visualize what **tracking error** means in practice, the author ran...
>
> — [Tracking error: making sense of a key investment statistic | Blog posts | STOXX](https://stoxx.com/tracking-error-making-sense-of-a-key-investment-statistic)
>
> This article provides a high-level refresher of what **tracking error** means, and how we can
> embed it directly into portfolio construction. When we design a benchmarked portfolio, every
> design choice that takes us away from the benchmark has a consequence, and every consequence has a
> risk. **Tracking error** (TE) – the humble statistic that serves as a...
>
> — [Tracking Error 101: The Intuition Behind Measurement and Control | Whitepaper...](https://stoxx.com/tracking-error-101-the-intuition-behind-measurement-and-control)
>
> ESG scores vs. **tracking error**. So, what does a TE of x% really mean? As Seegopaul writes, TE
> is the annualized standard deviation of the difference between the portfolio’s returns and those
> of its benchmark. However, there seems to be less discussion about what the results imply. To
> visualize what **tracking error** means in practice, the author ran...
>
> — [Tracking error: making sense of a key investment statistic | Blog posts | STOXX](https://stoxx.com/tracking-error-making-sense-of-a-key-investment-statistic)
>
> STOXX INDEX METHODOLOGY GUIDE 298/639 16. STOXX RISK BASED INDICES For the **tracking error**
> constrained version it is defined as: H ≥H ∙60%
> (cid:2897)(cid:2919)(cid:2924)(cid:2906)(cid:2911)(cid:2928)
> (cid:2886)(cid:2911)(cid:2929)(cid:2915) Maximum turnover The Unconstrained version has a 5%
> one-way turnover constraint, or 10% two-way. This means...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> STOXX INDEX METHODOLOGY GUIDE 298/639 16. STOXX RISK BASED INDICES For the **tracking error**
> constrained version it is defined as: H ≥H ∙60%
> (cid:2897)(cid:2919)(cid:2924)(cid:2906)(cid:2911)(cid:2928)
> (cid:2886)(cid:2911)(cid:2929)(cid:2915) Maximum turnover The Unconstrained version has a 5%
> one-way turnover constraint, or 10% two-way. This means...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> -date peak in May, **tracking error** declined until last week, when it skyrocketed following the
> beating of FAANGs stocks on earnings announcements. In five days, active risk jumped 150 basis
> points. Those tech-related bets have become a lot riskier this year. Figure 9 – FAANGs vs. STOXX
> USA 900 index **tracking error** In summary, the FAANGs fell abru...
>
> — [From pandemic profiteers to stagflation hostages: FAANGs stranglehold weighs ...](https://stoxx.com/from-pandemic-profiteers-to-stagflation-hostages-faangs-stranglehold-weighs-on-us-market)
>
> STOXX® Developed World Optimal 100 - STOXX® Developed Europe Optimal 100 - STOXX® Emerging Markets
> Optimal 100 - STOXX® Europe 600 Optimal 100 The companies and weights in a STOXX Optimal 100 index
> are determined by optimization based on a covariance matrix from an Axioma Risk Model, that
> minimizes **tracking error** to the parent index while holdin...
>
> — [New STOXX Optimal 100 indices offer optimized replication strategies on bench...](https://stoxx.com/new-stoxx-optimal-100-indices-offer-optimized-replication-strategies-on-benchmark-portfolios)
>
> -date peak in May, **tracking error** declined until last week, when it skyrocketed following the
> beating of FAANGs stocks on earnings announcements. In five days, active risk jumped 150 basis
> points. Those tech-related bets have become a lot riskier this year. Figure 9 – FAANGs vs. STOXX
> USA 900 index **tracking error** In summary, the FAANGs fell abru...
>
> — [From pandemic profiteers to stagflation hostages: FAANGs stranglehold weighs ...](https://stoxx.com/from-pandemic-profiteers-to-stagflation-hostages-faangs-stranglehold-weighs-on-us-market)
>
> STOXX® Developed World Optimal 100 - STOXX® Developed Europe Optimal 100 - STOXX® Emerging Markets
> Optimal 100 - STOXX® Europe 600 Optimal 100 The companies and weights in a STOXX Optimal 100 index
> are determined by optimization based on a covariance matrix from an Axioma Risk Model, that
> minimizes **tracking error** to the parent index while holdin...
>
> — [New STOXX Optimal 100 indices offer optimized replication strategies on bench...](https://stoxx.com/new-stoxx-optimal-100-indices-offer-optimized-replication-strategies-on-benchmark-portfolios)
>

---

### Turnover

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="642 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 642</span>


> The percentage of an index's total weight that changes at a rebalancing or reconstitution event, measured as the sum of all absolute weight changes divided by two.

Turnover quantifies the trading activity required to maintain an index-tracking portfolio. Higher turnover implies greater transaction costs, which erode net returns for passive investors. STOXX index construction rules — particularly buffer rules and review frequency — are designed with turnover management as an explicit objective. Turnover is typically expressed as a one-way figure.

$$
\text{Turnover} = \frac{1}{2} \sum_{i=1}^{n} \left| w_i^{\text{new}} - w_i^{\text{old}} \right|
$$

Where $w_i^{\text{old}}$ and $w_i^{\text{new}}$ are the weights before and after the rebalancing event.

> [!tip] Related terms
> [[#Rebalancing]], [[#Buffer Rule]], [[#Tracking Error]], [[#Review Frequency]]

> [!example]- Source excerpts (10)
>
> STOXX INDEX METHODOLOGY GUIDE 298/639 16. STOXX RISK BASED INDICES For the tracking error
> constrained version it is defined as: H ≥H ∙60%
> (cid:2897)(cid:2919)(cid:2924)(cid:2906)(cid:2911)(cid:2928)
> (cid:2886)(cid:2911)(cid:2929)(cid:2915) Maximum **turnover** The Unconstrained version has a 5%
> one-way **turnover** constraint, or 10% two-way. This means...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> STOXX WORLD EQUITY INDEX METHODOLOGY GUIDE 29/37 6. STOXX WORLD EQUITY INDEX SERIES Tradability
> screens: Only securities with an annualized **turnover** ratio of at least 15% are selected (10%
> for current components). The annualized **turnover** ratio is defined as the median value of the
> daily traded volume10 to the FOR adjusted free-float shares ratio...
>
> — [Stoxx World Equity Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)
>
> STOXX INDEX METHODOLOGY GUIDE 298/639 16. STOXX RISK BASED INDICES For the tracking error
> constrained version it is defined as: H ≥H ∙60%
> (cid:2897)(cid:2919)(cid:2924)(cid:2906)(cid:2911)(cid:2928)
> (cid:2886)(cid:2911)(cid:2929)(cid:2915) Maximum **turnover** The Unconstrained version has a 5%
> one-way **turnover** constraint, or 10% two-way. This means...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> STOXX WORLD EQUITY INDEX METHODOLOGY GUIDE 29/37 6. STOXX WORLD EQUITY INDEX SERIES Tradability
> screens: Only securities with an annualized **turnover** ratio of at least 15% are selected (10%
> for current components). The annualized **turnover** ratio is defined as the median value of the
> daily traded volume10 to the FOR adjusted free-float shares ratio...
>
> — [Stoxx World Equity Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)
>
> Larger portfolios would lead to longer trading periods. “This increase in the time taken to trade
> is unlikely to be a huge concern in the case of portfolio sizes of similar order of magnitude,”
> the authors write. Figure 1 – Increase in estimated trading days for the index over the benchmark
> Higher **turnover** Because the EURO STOXX 50 ESG Index is ...
>
> — [New Whitepaper Looks at Trading Characteristics of EURO STOXX 50 ESG Index | ...](https://stoxx.com/new-whitepaper-looks-at-trading-characteristics-of-euro-stoxx-50-esg-index)
>
> Larger portfolios would lead to longer trading periods. “This increase in the time taken to trade
> is unlikely to be a huge concern in the case of portfolio sizes of similar order of magnitude,”
> the authors write. Figure 1 – Increase in estimated trading days for the index over the benchmark
> Higher **turnover** Because the EURO STOXX 50 ESG Index is ...
>
> — [New Whitepaper Looks at Trading Characteristics of EURO STOXX 50 ESG Index | ...](https://stoxx.com/new-whitepaper-looks-at-trading-characteristics-of-euro-stoxx-50-esg-index)
>
> sal in the past month. Limiting **turnover** in a world of fast information decay Portfolios are
> constantly trading newly available information, but must do so bearing transaction costs in mind.
> Because today there is a high information decay – faster, real-time news becomes old news soon –
> the rate of **turnover** becomes a crucial component. The iSTOX...
>
> — [Evaluating the true cost of momentum investing | Blog posts | STOXX](https://stoxx.com/evaluating-the-true-cost-of-momentum-investing)
>
> lion from EUR 40.8 billion, Qontigo data show. While most entrants are smaller than existing
> constituents, there is one exception with Airbus SE. The maker of airplanes is the fifth-largest
> company on the Frankfurt Stock Exchange (FSE), but had up to now failed to enter the DAX as its
> local trading **turnover** was smaller than that of other candida...
>
> — [DAX Index Grows to 40 Constituents – Looking at Impact on Market Cap and Liqu...](https://stoxx.com/dax-index-grows-to-40-constituents-looking-at-impact-on-market-cap-and-liquidity)
>
> sal in the past month. Limiting **turnover** in a world of fast information decay Portfolios are
> constantly trading newly available information, but must do so bearing transaction costs in mind.
> Because today there is a high information decay – faster, real-time news becomes old news soon –
> the rate of **turnover** becomes a crucial component. The iSTOX...
>
> — [Evaluating the true cost of momentum investing | Blog posts | STOXX](https://stoxx.com/evaluating-the-true-cost-of-momentum-investing)
>
> lion from EUR 40.8 billion, Qontigo data show. While most entrants are smaller than existing
> constituents, there is one exception with Airbus SE. The maker of airplanes is the fifth-largest
> company on the Frankfurt Stock Exchange (FSE), but had up to now failed to enter the DAX as its
> local trading **turnover** was smaller than that of other candida...
>
> — [DAX Index Grows to 40 Constituents – Looking at Impact on Market Cap and Liqu...](https://stoxx.com/dax-index-grows-to-40-constituents-looking-at-impact-on-market-cap-and-liquidity)
>

---

## W

### Weighting Scheme

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="583 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 583</span>


> The methodology that determines how the index's total value is allocated across its constituents, defining each security's influence on the index level; common schemes include free-float market-capitalization weighting, equal weighting, price weighting, and fundamental weighting.

The weighting scheme is one of the most consequential design decisions in index construction. It determines the risk-return profile, sector tilts, capacity, and rebalancing needs of any portfolio tracking the index. STOXX offers indices across all major weighting schemes, though free-float market-capitalization weighting is the default for its flagship benchmark families. The choice of weighting scheme directly affects turnover, tracking error, and the economic exposures embedded in the index.

> [!tip] Related terms
> [[#Free-Float Market Capitalization Weighting]], [[#Market Capitalization Weighting]], [[#Equal Weighting]], [[#Fundamental Weighting]], [[#Price Weighting]]

> [!example]- Source excerpts (5)
>
> EW The STOXX Balkan 50 Equal Weight index represents blue-chip stocks from eight Balkan countries
> in terms of free-float market capitalization. Universe: The index universe is defined as the
> following eight Balkan countries: Bulgaria, Croatia, Macedonia, Romania, Serbia, Slovenia Greece
> and Turkey. **Weighting scheme**: The index is price-weighted w...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> URO iSTOXX Select Dividend 30 Dynamic Gold Hedge SD3DUO EURO STOXX® Select Dividend 30 (SD3E)
> Dissemination calendar: The index is calculated on any day, that is a calculation day according to
> Stoxx Europe Calendar and is not a holiday or a half-trading day in the UK or the 1st of May.
> CALCULATIONS **Weighting scheme**: Equity allocation is calculat...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> DAX EQUITY INDEX METHODOLOGY GUIDE 5/120 1. INTRODUCTION 1.1. INTRODUCTION TO THE DAX INDEX GUIDES
> » The DAX Equity Index Methodology Guide contains information on the equity index-specific rules
> for constructing and deriving portfolio-based indices, the individual component selection process
> and **weighting scheme**s » The DAX Equity Index Calculat...
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> preted as an indication of actual performance. CUSTOMIZATION The index can be used as a basis for
> the definition of STOXX® Customized Indices, which can be tailored to specific client or mandate
> needs. STOXX offers customization in almost unlimited forms for example in terms of component
> selection, **weighting scheme**s and personalized calculation ...
>
> — [Ixarobu (PDF)](https://www.stoxx.com/document/Bookmarks/CurrentFactsheets/IXAROBU.pdf)
>
> Investment (“SI”) commitment has been integrated into the index methodology of the thematic
> indices. This ensures a minimum level of environmental and social contribution of the theme. The
> SI commitment for the eight indices underlying iShares ETFs ranges between 5% and 50% and is
> considered in the **weighting scheme** for the annual review and quar...
>
> — [STOXX Thematic annual rebalance shows themes evolvement  | Blog posts | STOXX](https://stoxx.com/stoxx-thematic-annual-rebalance-shows-themes-evolvement)
>
