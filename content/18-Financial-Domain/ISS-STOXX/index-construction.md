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

> [!quote]
> "The market is a weighing machine."
>
> — **Benjamin Graham**, *The Intelligent Investor* (1949)



The product of a security's price, its total shares outstanding, and its free-float factor, representing the portion of market value available for public trading after excluding strategic, locked-in, or restricted holdings.

> [!note]
> Adjusted free-float market capitalization is the standard measure STOXX uses to determine a constituent's weight within a capitalization-weighted index. By removing shares held by insiders, governments, or cross-holdings, the figure reflects only the investable portion of a company's equity. This prevents indices from overweighting companies where a large fraction of shares is illiquid or unavailable to the market.

$$
\text{AFFMC}_i = P_i \times S_i \times f_i
$$

Where $P_i$ is the closing price of security $i$, $S_i$ is total shares outstanding, and $f_i$ is the free-float factor (a value between 0 and 1).

> [!tip] Related terms
> [Free-Float](#free-float), [Free-Float Factor](#free-float-factor), [Free-Float Market Capitalization Weighting](#free-float-market-capitalization-weighting), [Capping Factor](#capping-factor)

> [!example]- Source excerpts (3)
>
> This final weight is then allocated to each share line according to its **adjusted free-float
> market capitalization**. Weighting: In June, the index constituents are initially weighted by
> their adjusted free float market capitalization.
>
> — [Stoxx Index Guide (PDF), p. 471](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> This final weight is then allocated to each share line according to its **adjusted free-float
> market capitalization**. Weighting: In June, the index constituents are initially weighted by
> their adjusted free float market capitalization.
>
> — [Stoxx Index Guide (PDF), p. 471](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> an asset is the difference between its index and Target Portfolio weights E scaled by the Target
> Portfolio weight. M The Target portfolio is the FOL-**adjusted free-float market
> capitalization**-weighted portfolio, constructed as follows: C 1. Start with the STOXX Emerging
> Markets index. 2. Apply the following exclusions: a.
>
> — [Istoxx Index Guide (PDF), p. 1002](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>

---

### Announcement Date

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="28 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 28</span>


The calendar date on which an index provider publicly discloses the results of a periodic review, including additions, deletions, and share or free-float factor changes, before they become effective.

> [!note]
> The announcement date gives market participants advance notice of upcoming index changes so they can prepare trades and manage tracking portfolios. STOXX typically announces review changes several trading days before the effective date. The gap between announcement and implementation is critical for reducing market impact and allowing orderly rebalancing by passive funds.


- [Dax Equity Calculation Guide 20231002 (PDF)](https://www.stoxx.com/document/News/2023/October/DAX%20Equity%20Calculation%20Guide_20231002.pdf)
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
- [Hong Kong Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2022/asiapacific/Hong-Kong-Voting-Guidelines.pdf)
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)


> [!example]- Source excerpts (5)
>
> actor is based on the average daily turnover (ADTV) of the stock over the most recent three-month
> period, measured one day before the underlying data **announcement date**. The factor is kept
> constant between reviews and is calculated as follows: STOXX INDEX METHODOLOGY GUIDE 41/639 5.
>
> — [Stoxx Index Guide (PDF), p. 40](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> The review cut-off date for free float and number of shares data is the trading day prior to the
> quarterly underlying data **announcement date**, i.e. usually the Thursday before the second
> Friday of the review month.
>
> — [Dax Equity Calculation Guide 20231002 (PDF), p. 23](https://www.stoxx.com/document/News/2023/October/DAX%20Equity%20Calculation%20Guide_20231002.pdf)
>
> .75% Index » April 2022(3): Addition of the iSTOXX Europe 600 Oil & Gas Futures Roll TR Decrement
> 5% Index » April 2022(4): Change in Underlying Data **Announcement date** to five days for the
> iSTOXX Europe Next Dividend Low Risk 50 Index, iSTOXX Europe Select High Beta 50 Index, and EURO
> iSTOXX Next 30 Index; and Addit
>
> — [Istoxx Index Guide (PDF), p. 38](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> over the company after the private placement; and (iii) strategic investors, the pricing reference
> date can be either the corresponding board meeting **announcement date**, the shareholder meeting
> resolution **announcement date**, or the first day of the share issuance period; ▪ In the
> aforementioned cases, the share lock-u
>
> — [China Voting Guidelines (PDF), p. 10](https://www.issgovernance.com/file/policy/2019/asiapacific/China-Voting-Guidelines.pdf)
>
> constituents and the underlying data (shares, free- float, weighting-cap factors) is announced and
> implemented. The component and the underlying data **announcement date**s differ by index category
> and are therefore covered in the respective DAX Methodology Guides.
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF), p. 34](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>

---

## B

### Base Date

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="88 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 88</span>



The reference calendar date from which an index's historical performance begins, serving as the temporal anchor for the index level series.

> [!note]
> The base date is the starting point of an index's time series. On this date the index is assigned its base value (e.g., 100 or 1,000), and all subsequent index levels are expressed relative to this starting point. Choosing a meaningful base date allows users to interpret index returns as cumulative performance since inception. STOXX indices typically specify both a base date and a base value in their rulebooks.

> [!tip] Related terms
> [Base Value](#base-value), [Index Level](#index-level)

> [!example]- Source excerpts (5)
>
> CALCULATION On any Dissemination Day t the index value is calculated as follows: 𝐼𝑉 =100 if t is
> **base date** 𝑡 {𝐼𝑉 𝑡 = 𝐼𝑉 𝑡−1 +100∗ 𝑟 𝑑𝑖𝑠𝑝,𝑡 if 𝑡 is not a reset date 𝐼𝑉 =100+100∗ 𝑟 if 𝑡 is a
> reset date 𝑡 𝑑𝑖𝑠𝑝,𝑡 𝑛 𝑟 =(∑𝑤 ∙|𝑟 |)−|𝑟 | 𝑑𝑖𝑠𝑝,𝑡 𝑖,𝑡−1 𝑖,𝑡 𝑖𝑑𝑥,𝑡 𝑖=1
>
> — [Stoxx Strategy Guide (PDF), p. 80](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_strategy_guide.pdf)
>
> Germany 5-10 Total Return DE000A0S3P84 3LEY Price DE000A0S3P35 3LET Deutsche Börse EUROGOV Germany
> 10+ Total Return DE000A0S3P92 3LEZ 3.3. BASIS The **base date** of EUROGOV® indices is 31 January
> 1999 with a base value of 100. 1 Each inclusive maturity-minimum level and exclusive
> maturity-upper limit. [PAGE 6
>
> — [Guide To Eurogov Bond Indices (PDF), p. 5](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/Guide_to_EUROGOV_Bond_Indices.pdf)
>
> Therefore, investing in short indices yields the reverse performance of the underlying index. Base
> value and dates: **Base date**s and base values of the DAX Future Leverage indices can be found in
> the table below. ISIN Index Name Leverage Base **Base Date** Factor Value DE000A3DZD0
>
> — [Dax Strategy Index Guide (PDF), p. 18](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)
>
> G+ Index August 2022 (2): Addition of GCC Total Market Index August 2022 (3): Addition of STOXX
> Global Metaverse Index August 2022 (4): Change in the **base date** and value of STOXX USA 900
> Index August 2022 (5): Update to Section 6.4.1 STOXX INDEX METHODOLOGY GUIDE 18/639 2.
>
> — [Stoxx Index Guide (PDF), p. 17](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> X .IXAROBS Calculation/distribution Net Return (USD) in real time, others at day end Price USD
> CH0325904396 IXAROBK IXAROBK INDEX .IXAROBK Base value/**base date** 1000 on Jun. 20, 2011
> Complete list available here: www.stoxx.com/data/vendor_codes.html History Daily index value since
> Jun.
>
> — [Ixarobu (PDF), p. 2](https://www.stoxx.com/document/Bookmarks/CurrentFactsheets/IXAROBU.pdf)
>

---

### Base Value

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="659 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 659</span>



The numerical level assigned to an index on its base date, from which all subsequent index levels are derived as a ratio of current aggregate market value to the original aggregate market value.

> [!note]
> The base value is an arbitrary scaling constant — commonly set to 100, 1,000, or 5,000 — that makes the index level easy to read and compare. It has no economic meaning in itself; it merely anchors the level on the base date. Every STOXX index rulebook specifies both the base date and the base value, enabling users to compute cumulative returns over any period.

> [!tip] Related terms
> [Base Date](#base-date), [Index Level](#index-level), [Divisor](#divisor)

> [!example]- Source excerpts (5)
>
> Gross Return, Excess Return – Price, Excess Return – Net Return and Excess Return – Gross Return
> in EUR. Dissemination calendar: STOXX Eurex Calendar **Base value**s and dates: 1000 on Feb 28,
> 2003 CALCULATION The EURO iSTOXX 50 Futures Leveraged Index is calculated as follows: IV =IV ×[1+w
> ∗( UIt 1 −1)+w ∗( UIt
>
> — [Istoxx Index Guide (PDF), p. 352](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> A0S3P35 3LET Deutsche Börse EUROGOV Germany 10+ Total Return DE000A0S3P92 3LEZ 3.3. BASIS The base
> date of EUROGOV® indices is 31 January 1999 with a **base value** of 100. 1 Each inclusive
> maturity-minimum level and exclusive maturity-upper limit. GUIDE TO THE EUROGOV® BOND INDICES 6/30
> 3.
>
> — [Guide To Eurogov Bond Indices (PDF), p. 5](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/Guide_to_EUROGOV_Bond_Indices.pdf)
>
> STOXX BENCHMARK INDICES (BMI) Weighting scheme: The indices are weighted according to free-float
> market capitalization. **Base value**s and dates: The following **base value**s and dates apply:
> 100 on January 31, 2011, except for STOXX USA 900, which has a base date of 15.03.2002 and bas
>
> — [Stoxx Index Guide (PDF), p. 62](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> ng as the overall net dividend yield of the base index is greater than the value being subtracted.
> The base index is the DAX 50 ESG Net Return Index. **Base value** and dates: 1000 on September 24,
> 2012. 8.1.2. CALCULATION The index is calculated as follows: U ACT(t−1,t) t IV =IV × ( −D ) t t−1
> U 365 t−1 Whereby:
>
> — [Dax Strategy Index Guide (PDF), p. 32](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)
>
> -largest component exceeds 7.5%, it is capped at this figure. Step D) Step C) is repeated until
> all components meet the restrictions contained in it. **Base value** and dates: 1,000 on December
> 29, 2023. Dissemination calendar: Xetra calendar. Opening criterion: The same as for the CDAX.
> 6.3.2.
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF), p. 27](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>

---

### Basis Point (Index)

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="6 mentions across STOXX & ISS pages (low)">▰▰ 6</span>



A unit of measurement equal to one hundredth of one percent (0.01%), commonly used to express small changes in index levels, tracking error, or fee differentials.

> [!note]
> In index construction, basis points provide a precise vocabulary for discussing weight changes, tracking tolerances, and return differences. For example, an index constituent whose weight changes from 3.50% to 3.55% has experienced a 5 basis-point increase. STOXX methodology documents frequently express capping thresholds, buffer tolerances, and turnover targets in basis-point terms.

$$
1 \text{ bp} = 0.01\% = 0.0001
$$

> [!tip] Related terms
> [Index Point](#index-point), [Tracking Error](#tracking-error), [Capping](#capping)

> [!example]- Source excerpts (5)
>
> TOXX ESG-X Indices performed largely in line with their benchmarks during September. The STOXX®
> Global 1800 ESG-X Index underperformed by less than 1 **basis point**. The ESG-X indices are
> versions of traditional, market-capitalization-weighted benchmarks that observe standard
> responsible exclusions of leading ass
>
> — [Monthly Index News September 2019 (PDF), p. 3](https://stoxx.com/monthly-index-news-september-2019)
>
> A portfolio with 200 basis points of tracking error, regardless of industry constraints, has about
> twice the exposure to the ESG Score of a 50-**basis point** portfolio, and more than three times
> the exposure to the ESG Risk Score.
>
> — [Qontigo whitepaper examines the sustainability accomplishments of ESG funds |...](https://stoxx.com/qontigo-whitepaper-examines-the-sustainability-accomplishments-of-esg-funds)
>
> of five macro shocks: - a rise of 0.5% in the 10-year US Treasury nominal yield - a rise of 0.5%
> in the break-even inflation rate - an additional 25-**basis point** hike in the Fed Funds target
> rate beyond what is priced through 2022 - a 20% drop in the oil price - a 10% decline in the cost
> of non-energy commodit
>
> — [Ukraine crisis: Looking at recent market performance through a thematic inves...](https://stoxx.com/ukraine-crisis-looking-at-recent-market-performance-through-a-thematic-investing-lens)
>
> hile global, North America, US, Japan and Asia/Pacific indices are in dollars. 3 CNBC, ‘Powell
> says taming inflation ‘absolutely essential,’ and a 50 **basis point** hike possible for May,’
> April 21, 2022. 4 Figures in parentheses show last month’s gross returns.
>
> — [Stocks tumble most since 2020 in April amid interest-rate concerns | Blog pos...](https://stoxx.com/stocks-tumble-most-since-2020-in-april-amid-interest-rate-concerns)
>
> sured in US dollars and including dividends[1], after gaining 23.9% in 2023 — its best annual
> showing since 2019. The benchmark traded at less than 1 **basis point** away from a record high on
> a price level. It rose 3% in January when measured in euros.
>
> — [Stocks extend 2023’s positive tone into January on interest rates outlook | B...](https://stoxx.com/stocks-extend-2023s-positive-tone-into-january-on-interest-rates-outlook)
>

---

### Benchmark Index

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="152 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 152</span>

> [!quote]
> "The index fund is a most unlikely hero for the typical investor."
>
> — **John C. Bogle**, *The Little Book of Common Sense Investing* (2007)



A broadly representative, rules-based index that serves as a standard reference point for measuring the performance of investment portfolios, defining asset allocation, or constructing derivative instruments.

> [!note]
> Benchmark indices are the flagship products of index providers. STOXX benchmark indices — such as the EURO STOXX 50, STOXX Europe 600, and STOXX Global 1800 — are designed to capture the performance of a defined market segment with high coverage and investability. They underpin trillions of euros in passive assets, ETFs, futures, and options. Benchmark status typically requires broad market acceptance, regulatory compliance (e.g., EU BMR), and transparent, rules-based construction.

> [!tip] Related terms
> [Rules-Based Index](#rules-based-index), [Index Universe](#index-universe), [Free-Float Market Capitalization Weighting](#free-float-market-capitalization-weighting)

> [!example]- Source excerpts (5)
>
> capital market. Stephan Flaegel, Global Head of Benchmarks & Indices The main results on changing
> the index rulebook are: - From September 2021, the **benchmark index** DAX will be expanded by ten
> members, to a total of 40 constituents. This means that it will cover the largest listed companies
> in Germany even more c
>
> — [German Benchmark Index DAX Will be Strengthened by Additional Qualification C...](https://stoxx.com/german-benchmark-index-dax-will-be-strengthened-by-additional-qualification-criteria-and-harmonization-with-international-standards)
>
> The STOXX PAB Index offers comparable volatility, returns, and diversification as its parent
> benchmark. Along with our EU Climate Transition **Benchmark Index**, the STOXX PAB is an important
> part of the overall Qontigo ESG Framework, helping investors integrate climate-change risks and
> opportunities into por
>
> — [STOXX Europe 600 Paris-Aligned Benchmark Index Licensed To Franklin Templeton...](https://stoxx.com/stoxx-europe-600-paris-aligned-benchmark-index-licensed-to-franklin-templeton)
>
> Paris-Aligned Benchmark Indices Minimum Scope 1+2+3 GHG intensity reduction At least 60% (includes
> a 10% buffer) compared to the corresponding STOXX **Benchmark Index** The GHG intensity of a
> security is calculated as: (cid:1845)(cid:1855)(cid:1867)(cid:1868)(cid:1857)
> 1+(cid:1845)(cid:1855)(cid:1867)(cid:1868)(cid:1
>
> — [Stoxx Index Guide (PDF), p. 630](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> It shows the share of the free float market 65 Number 2 Universe_Free_Float_Market_Capitalization
> cap of PAB/CTB **benchmark index** in the free float market cap of parent index. Date when report
> is produced and the update reason 66 Update_Date Text 255 ("Update due to regular inde
>
> — [Index Files Guide 20230619 (PDF), p. 101](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)
>
> 8 STOXX Benchmark Indices Key points The STOXX® Global 1800 Index rose 1.2% in August, as gains in
> US stocks more than offset declines elsewhere. The **benchmark index** is now 2.3% below its
> January high when measured in US dollars. Eurozone stocks declined as some of the region’s largest
> banks suffered from a sell-o
>
> — [Monthly Index News August 2018 (PDF), p. 2](https://stoxx.com/monthly-index-news-august-2018)
>

---

### Buffer Rule

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="65 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 65</span>

> [!quote]
> "Buffer rules are the index world's answer to unnecessary turnover — they keep borderline stocks from churning in and out."
>
> — **Antti Petajisto**, *The Index Premium and Its Hidden Cost for Index Funds* (2011)

A threshold band applied during periodic reviews that allows existing constituents to remain in the index even if they marginally fail to meet the standard selection criteria, thereby reducing unnecessary turnover.

> [!note]
> Buffer rules create a zone of tolerance around the selection threshold. For example, an index that selects the top 50 stocks by market capitalization might retain a current constituent as long as it ranks within the top 60, while a new entrant must rank within the top 40 to be added. This asymmetry prevents excessive churn caused by securities oscillating around the selection boundary, which would increase transaction costs for tracking portfolios.

> [!tip] Related terms
> [Fast Entry Rule](#fast-entry-rule), [Fast Exit Rule](#fast-exit-rule), [Reconstitution](#reconstitution), [Turnover](#turnover)

> [!example]- Source excerpts (5)
>
> Components are selected based on the free-float market capitalization and a 10% **buffer rule**
> applies for the ranking. If the number of stocks selected is still below the required component
> count after applying the **buffer rule**s, the largest re
>
> — [Stoxx Index Guide (PDF), p. 93](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> Components are selected based on the free-float market capitalization and a 10% **buffer rule**
> applies for the ranking. If the number of stocks selected is still below the required component
> count after applying the **buffer rule**s, the largest re
>
> — [Stoxx Index Guide (PDF), p. 93](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> 600 (Global/Global ex Japan) stocks with the highest momentum score are selected for the
> respective index. In order to reduce turnover, the following **buffer rule**s are applied.
> Targeted number of Upper buffer bound Lower buffer bound constituents Japan 300 210 390 iSTOXX®
> METHODOLOGY GUIDE 267/1024
>
> — [Istoxx Index Guide (PDF), p. 266](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> [3] supports the tradability of the index’s portfolio, while a quarterly review based on clear
> rules gives it a continuous pulse on market changes. A **buffer rule** ensures a moderate turnover
> at each review. The STOXX Europe 600’s free-float market cap has surpassed EUR 11 trillion after
> the index reached an all
>
> — [STOXX Europe 600 index – The continent&#039;s benchmark | Blog posts | STOXX](https://stoxx.com/stoxx-europe-600-index-the-continents-benchmark)
>
> greater (smaller) or equal than the upper (lower) global consistency bound are added (removed). -
> Turnover buffer: To reduce turnover, the following **buffer rule** is applied to existing
> components: o Only securities with LCP lower than 68% can be newly added to the Large Cap index o
> Only securities with LCP hig
>
> — [Stoxx World Equity Index Guide (PDF), p. 30](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)
>

---

## C

### Capping

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="898 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 898</span>

> [!quote]
> "Diversification is the only free lunch in investing."
>
> — **Harry Markowitz**



The process of imposing a maximum weight constraint on individual constituents or groups of constituents within an index to ensure diversification and regulatory compliance.

> [!note]
> Capping prevents any single security or issuer from dominating an index. STOXX applies capping at each periodic review and, for certain indices, on a more frequent basis. For UCITS-compliant indices, the 5/10/40 rule applies: no single constituent may exceed 10% weight, and all constituents above 5% may not collectively exceed 40%. Capping is implemented by adjusting each constituent's weight to satisfy these constraints while maintaining market-cap ranking order wherever possible.

$$
w_i^{\text{capped}} = \min\!\left(w_i^{\text{uncapped}},\; W_{\max}\right)
$$

Where $w_i^{\text{uncapped}}$ is the raw weight and $W_{\max}$ is the cap limit. After capping, excess weight is redistributed proportionally among uncapped constituents, and the process iterates until all constraints are satisfied.

> [!tip] Related terms
> [Capping Factor](#capping-factor), [Weighting Scheme](#weighting-scheme), [Free-Float Market Capitalization Weighting](#free-float-market-capitalization-weighting)

> [!example]- Source excerpts (5)
>
> The responses reflected a wide range of considerations from different stakeholders. A majority of
> participants were in favour of raising the **capping** limit to 15 percent. Media Contact Andreas
> von Brevern +49 (0) 69 211 14284 With this **capping** limit, STOXX is aligning the DAX index
> family with inte
>
> — [DAX capping will be adjusted to 15 per cent | Press releases | STOXX](https://stoxx.com/dax-capping-will-be-adjusted-to-15-per-cent)
>
> djusted free float is implemented via a **capping** factor in the sense of Section 4.1 General
> Definitions of the STOXX Reference Calculations Guide. The **capping** factor is defined as
> Capping factor = foreign restrictions adjusted free float / free float. STOXX INDEX METHODOLOGY
> GUIDE 42/639 5.
>
> — [Stoxx Index Guide (PDF), p. 41](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> Results of Market Consultation Zug, November 22nd, 2023 Results of Market Consultation on raising
> the DAX **capping** limit from 10% to 15% and the introduction of additional DAX **capping**
> functionalities Dear Sir and Madam, STOXX Ltd.
>
> — [Results Of Market Consultation Dax Capping Limit 20231122 (PDF), p. 1](https://www.stoxx.com/document/Resources/MarketConsultation/Results_of_Market_Consultation_DAX_Capping_limit_20231122.pdf)
>
> As a result, it consists of a variable number of companies (normally less than 40). Universe: DAX.
> Weighting scheme: The same as for the DAX. **Capping**: Since this is a derived index, its
> **capping** rules are the same as for its parent index, the DAX.
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF), p. 44](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> gher free-float market capitalization is given priority. Review frequency: The components are
> reviewed annually in September. Shares, Free Float, and **Capping** are reviewed quarterly. For
> the **capping** procedure, the benchmark is defined as the new composition of the STOXX Global
> 1800 which becomes effective o
>
> — [Istoxx Index Guide (PDF), p. 387](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>

---

### Capping Factor

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="104 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 104</span>



A multiplicative coefficient applied to a constituent's weight at each rebalancing to enforce the index's maximum weight constraint, where a value of 1.0 means no adjustment and values below 1.0 indicate the constituent has been scaled down.

> [!note]
> The capping factor is the operational mechanism through which capping is implemented. STOXX calculates these factors during each review or capping event and publishes them alongside share counts and free-float factors. The capped weight of a constituent equals its uncapped weight multiplied by its capping factor.

$$
w_i^{\text{capped}} = \text{CF}_i \times w_i^{\text{uncapped}}, \quad 0 < \text{CF}_i \le 1
$$

> [!tip] Related terms
> [Capping](#capping), [Free-Float Factor](#free-float-factor), [Divisor Adjustment](#divisor-adjustment)

> [!example]- Source excerpts (4)
>
> djusted free float is implemented via a **capping factor** in the sense of Section 4.1 General
> Definitions of the STOXX Reference Calculations Guide. The **capping factor** is defined as
> Capping factor = foreign restrictions adjusted free float / free float. STOXX INDEX METHODOLOGY
> GUIDE 42/639 5.
>
> — [Stoxx Index Guide (PDF), p. 41](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> djusted free float is implemented via a **capping factor** in the sense of Section 4.1 General
> Definitions of the STOXX Reference Calculations Guide. The **capping factor** is defined as
> Capping factor = foreign restrictions adjusted free float / free float. STOXX INDEX METHODOLOGY
> GUIDE 42/639 5.
>
> — [Stoxx Index Guide (PDF), p. 41](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> The review cut-off date for the underlying data is the last calculation day of February, May,
> August and November respectively. Weighting and **capping factor**s: Target weights are calculated
> based on the inverse of the historical volatility of the selected components (using the same
> volatility as in the Sel
>
> — [Istoxx Index Guide (PDF), p. 360](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> s only for the STOXX World AC Universal All Cap Index, and the derived cap weighted benchmark
> indices, described in Chapter 6. For the calculation of **capping factor**s, the closing prices on
> the dissemination day before the announcements are used. Diverging underlying announcement
> schedules may occur and are define
>
> — [Stoxx World Equity Index Guide (PDF), p. 16](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)
>

---

### Chaining

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="18 mentions across STOXX & ISS pages (low)">▰▰ 18</span>



The technique of linking successive index segments across rebalancing or reconstitution events by multiplying the return of the new basket onto the cumulative index level of the old basket, ensuring a continuous time series despite changes in composition or weights.

> [!note]
> Chaining is the mathematical mechanism that allows an index to remain a single unbroken series even as its constituents change over time. At each rebalancing or reconstitution, the new basket's performance is "chained" onto the prior index level. This is operationally achieved through the divisor adjustment: the divisor absorbs the compositional change so that the index level is continuous across the transition. Without chaining, every reconstitution would reset the index level to an arbitrary value.

$$
\text{Index}_{t+k} = \text{Index}_t \times \prod_{j=1}^{k} \left(1 + R_j^{\text{new basket}}\right)
$$

Where $R_j^{\text{new basket}}$ is the return of the post-rebalancing basket on day $j$ after the rebalancing date $t$.

> [!tip] Related terms
> [Divisor](#divisor), [Divisor Adjustment](#divisor-adjustment), [Reconstitution](#reconstitution), [Rebalancing](#rebalancing)

> [!example]- Source excerpts (5)
>
> Underlying Data Announcement This report displays future index composition and underlying data
> that will be implemented at the next **chaining** date. 4.8.1.1. eb.rexx Indices  File name:
> mn_P###_xxxxx_YYYYMMDD.csv, where YYYYMMDD is the publication date  With xxxxx being the Main
> Index Symb
>
> — [Index Files Guide 20230619 (PDF), p. 89](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)
>
> Unscheduled Admission of extraordinary replacements based on 12.2. DAXglobal Replacements same
> weight as the deleted stock. **Chaining** free-float market capitalization. BRIC STOXX Customer
> Support: Tel. + 41 43 430 72 72, E-Mail: customersupport@stoxx.com Methodology Change
>
> — [Overview Of Methodology Changes Valid From 18 Of March 2024 (PDF), p. 6](https://www.stoxx.com/document/News/2023/October/Overview%20of%20methodology%20changes%20valid%20from%2018%20of%20March%202024.pdf)
>
> The acquired are met: companies are deleted if they are no longer listed on » All conditions of
> the event are currently the stock exchange and **chaining** takes place. If the fulfilled (i.e.,
> shareholder & authorities’ new company is not created from the continuation of approval, minimum
> acceptances, ot
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF), p. 8](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>
> on rules - Renewed introduction of sequential creation of the ranking list - Correction to the
> wording regarding the X indices - Clarification of the **chaining** process used with equal
> weighted indices Effective Version 9.2.1 Sept. 24, 2018 - Termination of calculation and
> dissemination of the Midcap Market i
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF), p. 110](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> index, by contrast, will remain unchanged and continue to consist of 30 companies. The new rules
> will be applied for the first time for the September **chaining** and will be reflected in the
> indices from 24 September 2018 onwards. Media Contact General Inquiries: media@qontigo.com Index
> Inquiries: Andreas von
>
> — [Deutsche Börse decides rule changes for MDAX, SDAX and TecDAX indices | Press...](https://stoxx.com/deutsche-borse-decides-rule-changes-for-mdax-sdax-and-tecdax-indices)
>

---

### Component

<span style="background:red; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="3,668 mentions across STOXX & ISS pages (high)">▰▰▰▰▰▰ 3,668</span>



A security that is currently included in an index and contributes to its level calculation; synonymous with "constituent" in STOXX documentation.

> [!note]
> The terms "component" and "constituent" are used interchangeably throughout the index industry. Each component has an associated weight determined by the index's weighting scheme, and its price movements directly influence the index level. The set of components is determined during reconstitution events and may change between reviews through corporate actions or fast-entry/fast-exit rules.

> [!tip] Related terms
> [Constituent](#constituent), [Selection Criteria](#selection-criteria), [Index Universe](#index-universe)

> [!example]- Source excerpts (5)
>
> OXX group of companies and leading provider of benchmark and custom index solutions to global
> institutional investors, today announced an unscheduled **component** change in the SDAX, HDAX and
> TecDAX indices. Media Contact Sarah Ball Executive Director, Communications press@iss-stoxx.com
> NEXUS AG will leave the
>
> — [Unscheduled component change in SDAX, HDAX and TecDAX (January 8, 2025) | Pre...](https://stoxx.com/unscheduled-component-change-in-sdax-hdax-and-tecdax-jan-8-2025)
>
> 5 Financials Industry 30 Real Estate Industry 35 Technology Industry 10 For each industry j of the
> 11 industrial groupings above, a maximum number of **component**s is calculated as follows and
> rounded to the nearest integer: D =(SXW1 +10%)∗N j j where: D maximum number of **component**s
> from industry j, allowed for
>
> — [Istoxx Index Guide (PDF), p. 481](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> INTERNATIONAL REGION-ORIENTED INDICES Weights calculation: The target weight of **component** i at
> time t is calculated as follows: 6M ADTV 𝐸𝑈𝑅 𝑖 𝑤 = 𝑖𝑡 ∑40 6𝑀 𝐴𝐷𝑇𝑉 𝐸𝑈𝑅 𝑗=1 𝑗 where the denominator
> is the sum of the six-month ADTV in EUR of all
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF), p. 93](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> STOXX WORLD EQUITY INDEX SERIES Tradability screens: Only securities with an annualized turnover
> ratio of at least 15% are selected (10% for current **component**s). The annualized turnover ratio
> is defined as the median value of the daily traded volume10 to the FOR adjusted free-float shares
> ratio over the las
>
> — [Stoxx World Equity Index Guide (PDF), p. 29](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)
>
> STOXX offers customization in almost unlimited forms for example in terms of **component**
> selection, weighting schemes and personalized calculation methodologies. 3 Net dividend yield is
> calculated as net return index return minus price in
>
> — [Ixarobu (PDF), p. 2](https://www.stoxx.com/document/Bookmarks/CurrentFactsheets/IXAROBU.pdf)
>

---

### Concentration Limit

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="2 mentions across STOXX & ISS pages (ultra-low)">▰ 2</span>



A maximum threshold on the aggregate weight of a defined group of constituents — such as a single country, sector, or issuer group — designed to ensure diversification within the index beyond individual constituent caps.

> [!note]
> Concentration limits operate at a higher level than individual capping. While capping constrains the weight of a single security, concentration limits constrain the combined weight of a group. For example, a STOXX index might impose a rule that no single country may represent more than 30% of total index weight, or that the top five constituents combined may not exceed 40%. These limits are enforced during rebalancing through iterative weight redistribution, similar to the capping process.

$$
\sum_{i \in G} w_i \le W_{\max}^{\text{group}}
$$

Where $G$ is the set of constituents belonging to the group and $W_{\max}^{\text{group}}$ is the concentration limit for that group.

> [!tip] Related terms
> [Capping](#capping), [Country Weighting](#country-weighting), [Sector Weighting](#sector-weighting), [Weighting Scheme](#weighting-scheme)

> [!example]- Source excerpts (1)
>
> capitalization weighted D Capping: Components are capped with an iterative process to guarantee
> that an absolute ICB Industry capping and the 5/10/40 **concentration limit**s are met E Base
> value and dates: 100 on March 18, 2022 V Index types and currencies: Price, net and gross return
> in EUR E Dissemination calendar: STO
>
> — [Istoxx Index Guide (PDF), p. 1005](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>

---

### Constituent

<span style="background:red; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="2,462 mentions across STOXX & ISS pages (high)">▰▰▰▰▰▰ 2,462</span>



An individual security that is a member of an index at a given point in time and whose price, shares, and weighting factors contribute to the computation of the index level.

> [!note]
> "Constituent" is the preferred formal term in STOXX methodology documentation. Each constituent is characterized by its price, number of shares, free-float factor, and any applicable capping factor. The complete list of constituents for each STOXX index is published and updated at each periodic review.

> [!tip] Related terms
> [Component](#component), [Eligibility Criteria](#eligibility-criteria), [Selection List](#selection-list)

> [!example]- Source excerpts (5)
>
> On September 20, Germany’s flagship DAX® Index will expand from 30 to 40 **constituent**s,
> concluding the biggest reform in the benchmark’s +30-year history. The enlargement is the final
> step in a comprehensive overhaul of rules announced
>
> — [DAX Index Grows to 40 Constituents – Looking at Impact on Market Cap and Liqu...](https://stoxx.com/dax-index-grows-to-40-constituents-looking-at-impact-on-market-cap-and-liquidity)
>
> e assessment for select Australian companies follows the approach most recently implemented in
> Europe where such measures are now applied to STOXX600 **constituent**s. Pay-for-performance tests
> also apply in Canada both to TSX/S&P Composite companies and those whose ballot features a
> say-on-pay resolution, along w
>
> — [ISS Announces New Pay-for-Performance Evaluation for ASX300 Constituents | ISS](https://www.issgovernance.com/iss-announces-new-pay-performance-evaluation-asx300-constituents)
>
> 19, including Deutsche Bank AG, BlackRock Inc. and Nikon Corp. Spanish lender CaixaBank SA joined
> with the third-biggest weight among index **constituent**s. Germany’s BASF AG, General Mills Inc.
> of the US, and France’s LVMH SE are among 44 companies that have exited. Following the review, the
> index comp
>
> — [New STOXX Global ESG Leaders index constituents announced | Blog posts | STOXX](https://stoxx.com/new-stoxx-global-esg-leaders-index-constituents-announced)
>
> It can only be applied once per **constituent**, which means that an index **constituent** cannot
> fall under the normal minimum and leadership filter threshold for two consecutive periods.
> Component changes are announced on the second Frida
>
> — [Stoxx Index Guide (PDF), p. 290](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> ̅)) i 1+q(t), q(t) > 0 i i Q(t) = { 1 i , else 1−q(t) i Q(t) w Q (t) = i i ∑Q (t) i where, i
> **constituent** of the EURO STOXX 50 𝑥̅ average of x for all **constituent**s of the EURO STOXX 50
> The overall score, 𝑤(𝑡), is calculated as following: 𝑖 w Q (t)+wV(t)+wS(t) w(t) = i i i i 3 The
> components of the index are sor
>
> — [Istoxx Index Guide (PDF), p. 84](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>

---

### Divisor

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="84 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 84</span>

> [!quote]
> "The divisor is what makes an index a continuous time series rather than a disjointed sequence of portfolios."
>
> — **David Blitzer**, former Chairman of the S&P Index Committee

A scaling factor in the index formula that preserves continuity of the index level across non-market events such as constituent changes, corporate actions, and rebalancing; it absorbs the mechanical impact of these events so the index level changes only due to price movements.

> [!note]
> The divisor is the single most important technical element in index maintenance. When an index is first created, the divisor is set so that the formula produces the desired base value. Thereafter, every time a non-market event would otherwise cause a discontinuity — an addition, deletion, share change, or capping adjustment — the divisor is recalculated to keep the index level unchanged at the moment of the change.

$$
D_{t+1} = D_t \times \frac{\sum_{i=1}^{n'} P_i^{t} \times S_i^{\text{new}} \times f_i^{\text{new}} \times \text{CF}_i^{\text{new}}}{\sum_{i=1}^{n} P_i^{t} \times S_i^{\text{old}} \times f_i^{\text{old}} \times \text{CF}_i^{\text{old}}}
$$

The numerator uses the new composition (post-event) and the denominator uses the old composition, both evaluated at the same closing prices $P_i^t$. This ensures the index level is continuous across the event.

> [!tip] Related terms
> [Divisor Adjustment](#divisor-adjustment), [Index Formula (Laspeyres)](#index-formula-laspeyres), [Base Value](#base-value)

> [!example]- Source excerpts (5)
>
> ) at time (t) . x it = Exchange rate from reference price currency to index currency at time (t).
> M t = Total ‘units’ of the index at time (t). D t = **Divisor** of the index at time (t). 3.8.2.
> **DIVISOR** CALCULATION The index divisor is calculated as follows: ∑𝑛 (𝑝 ∙ 𝑤𝑓 ∙𝑥 )± ∆𝑀𝐶 𝑖=1 𝑖𝑡 𝑖𝑡
> 𝑖𝑡 𝑡+1 𝐷 𝑡+1 = 𝐷 𝑡 ∙
>
> — [Stoxx Digital Asset Guide (PDF), p. 12](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_digital_asset_guide.pdf)
>
> 10 FILES GUIDE 2.2. Equity Index Files 2.2.1. Index **Divisor**s (as from 01.11.2023) This report
> contains all **divisor**s and market capitalizations of Equity indices for current and next
> dissemination day.  File name: o index_divisors.csv o index_divisors_europe.csv 
>
> — [Index Files Guide 20230619 (PDF), p. 11](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)
>
> INDEX VALUE CALCULATION 7.2. INDEX **DIVISOR** CALCULATION 7.2.1. MARKET CAPITALIZATION-WEIGHTED
> Each index has a unique index **divisor** that is adjusted to maintain the continuity of the
> index’s values across changes due to corporate actions.
>
> — [Dax Equity Calculation Guide 20231002 (PDF), p. 15](https://www.stoxx.com/document/News/2023/October/DAX%20Equity%20Calculation%20Guide_20231002.pdf)
>
> DA is t: Review is collection fixed implemented 3rd/4thtrading day: t-5: UDA is t+1: Review
> Components are published takes effect announced The index **divisor** is recalculated on the
> review implementation date as described in the DAX Equity Index Calculation Guide, thus
> maintaining the continuity of the inde
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF), p. 11](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> 600 ex-REITs universe, then this sub item is excluded from the calculation of the respective sub
> score. » Long Term View Score (25 sub items but the **divisor** is 26 due to the score for 14.
> Retirement age for full time employee) 1.
>
> — [Istoxx Index Guide (PDF), p. 292](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>

---

### Divisor Adjustment

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="5 mentions across STOXX & ISS pages (ultra-low)">▰ 5</span>



The recalculation of the index divisor triggered by any non-market event — including constituent additions or deletions, share changes, free-float factor updates, corporate actions, or capping factor modifications — to ensure continuity of the index level.

> [!note]
> A divisor adjustment is performed whenever the aggregate capitalization of the index would change for reasons unrelated to market price movements. The adjustment is timed to take effect at the close of trading on the day before the event becomes effective. By solving for the new divisor that equates the pre-event and post-event index levels, STOXX ensures a seamless transition.

> [!tip] Related terms
> [Divisor](#divisor), [Corporate Action Treatment](#corporate-action-treatment), [Rebalancing](#rebalancing)

> [!example]- Source excerpts (2)
>
> The change in market capitalization (for price weighted indices: the change in units) determines
> the **divisor adjustment**. a) For free-float market capitalization weighted indices: If the
> change in market capitalization between added and deleted companies of an index inc
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF), p. 36](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>
> The change in market capitalization (for price weighted indices: the change in units) determines
> the **divisor adjustment**. a) For free float market capitalization weighted indices: If the
> change in market capitalization between added and deleted companies of an index inc
>
> — [Dax Equity Calculation Guide 20231002 (PDF), p. 22](https://www.stoxx.com/document/News/2023/October/DAX%20Equity%20Calculation%20Guide_20231002.pdf)
>

---

## E

### Effective Date

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="346 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 346</span>



The calendar date on which announced index changes — including additions, deletions, share updates, and rebalanced weights — take effect in the live index calculation.

> [!note]
> The effective date is the implementation point for all changes disclosed on the announcement date. STOXX index changes are typically implemented at the opening of trading on the effective date, using the closing prices from the preceding trading day to compute the divisor adjustment. The gap between announcement and effective date (usually several trading days) is designed to give market participants time to adjust their portfolios in an orderly manner, minimizing market impact.

> [!tip] Related terms
> [Announcement Date](#announcement-date), [Periodic Review](#periodic-review), [Divisor Adjustment](#divisor-adjustment)

> [!example]- Source excerpts (5)
>
> t i effective new,i,t on day t+1 • S refers to the official closing price for component i on day
> t, or in the case where the old,i,t corporate action **effective date** is identical to the
> ex-date of a cash dividend, 𝐷𝑖𝑣𝑎𝑛𝑛𝑜𝑢𝑛𝑐𝑒𝑑, 𝑖,𝑡 then it is the official closing price minus the cash
> dividend amount, 𝐷𝑖𝑣𝑎𝑛𝑛𝑜𝑢𝑛𝑐𝑒𝑑.
>
> — [Istoxx Index Guide (PDF), p. 504](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> All calculated measures are based on closing data of quarterly review **effective date**.  File
> Name: esg_report_xxxxx  File Type: .csv  File specification: semicolon separated  File
> Frequency: Quarterly (after review implementation)
>
> — [Index Files Guide 20230619 (PDF), p. 94](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)
>
> 1 day before the review **effective date** about a China Connect Security ineligibility (not
> eligible to “both buy and sell”) effective after the review **effective date**, the equivalent
> China A share will be deleted in line with Section 8.6.4. Delisting of the STOXX Calculation
> Guide. Weighting cap factors: Index weig
>
> — [Stoxx Index Guide (PDF), p. 382](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> DAX DIVIDEND POINTS AND DIVDAX DIVIDEND POINTS Calculation on an Ongoing Basis The Dividend Points
> indices are reset to zero on the review **effective date** of the underlying indices in December.
> Accordingly, for the calculation of the Dividend Points indices the ongoing value is the sum of
> the Dividend P
>
> — [Dax Strategy Index Guide (PDF), p. 38](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)
>
> The standard notice period of 2 trading days will be extended such that the **effective date**
> will be aligned with the review **effective date**. 8.3. MERGERS AND TAKEOVERS 8.3.1.
>
> — [Dax Equity Calculation Guide 20231002 (PDF), p. 24](https://www.stoxx.com/document/News/2023/October/DAX%20Equity%20Calculation%20Guide_20231002.pdf)
>

---

### Eligibility Criteria

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="25 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 25</span>

> [!quote]
> "The essence of investment management is the management of risks, not the management of returns."
>
> — **Benjamin Graham**, *The Intelligent Investor* (1949)



The set of minimum requirements — covering domicile, listing venue, security type, liquidity, free-float, and sector classification — that a security must satisfy before it can be considered for inclusion in an index.

> [!note]
> Eligibility criteria act as the first filter in the index construction process. STOXX indices typically require that a security be a common equity share (no preferred shares, warrants, or convertibles), listed on a recognized exchange within the index's geographic scope, and meet minimum thresholds for free-float and trading liquidity. Only securities passing all eligibility screens enter the selection universe from which constituents are chosen.

> [!tip] Related terms
> [Selection Criteria](#selection-criteria), [Index Universe](#index-universe), [Free-Float](#free-float)

> [!example]- Source excerpts (5)
>
> ONGOING MAINTENANCE Selection list: The selection list is created annually in the review month by
> applying the three **eligibility criteria** in Section ‘Index Review’ of ‘STOXX US Nexus 100
> Index’ to the components of the STOXX US Universal All Cap Index and ranking them by their full
> mark
>
> — [Stoxx Index Guide (PDF), p. 85](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> The universe consists of any asset classified in the Bitcoin Suisse Index Reference Classification
> List (xRCL), for which the following **eligibility criteria** are met: • Digital assets must be
> ranked in the Top 75 in regards to market capitalization, in accordance with the most recent
> publication of the Bit
>
> — [Stoxx Digital Asset Guide (PDF), p. 7](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_digital_asset_guide.pdf)
>
> recovery per share from each of the legal Settlements Notices; actual recoveries will vary based
> upon specific trading data in the claims submitted. **ELIGIBILITY CRITERIA** AND PARTICIPATION
> REQUIREMENTS Criteria for participating in a securities class action lawsuit is relatively
> straightforward: an investor must simply
>
> — [A Case Study Involving S&amp;P 500 Companies | ISS](https://www.issgovernance.com/a-case-study-involving-sp-500-companies)
>
> f April 30th, 2025. M O R E O N T H E D A X I N D E X F A M I L Y How Is the DAX Constructed?
> Simplified illustration, not all criteria are shown. 1. **Eligibility Criteria** 3. Selection &
> Reviews Companies must be listed on 5. Administration the Frankfurt Stock Exchange, Components are
> & Holdings traded on Xetra®, have a
>
> — [Stoxx Infographic Dax 20250701 (PDF), p. 1](https://stoxx.com/wp-content/uploads/2025/07/STOXX_Infographic_DAX_20250701.pdf)
>
> However, constituent selection is at the discretion of an Index Committee based on the
> **eligibility criteria**.1 Driving outperformance Amid increased profitability and investors’
> favor, Tesla’s outperformance has left its mark on US markets in the past year.
>
> — [Tesla’s place in a US stock benchmark | Blog posts | STOXX](https://stoxx.com/teslas-place-in-a-us-stock-benchmark)
>

---

### Equal Weighting

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="27 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 27</span>

> [!quote]
> "Equal weighting is the simplest diversification strategy — it says every stock deserves the same chance."
>
> — **Victor DeMiguel et al.**, *Optimal Versus Naive Diversification* (2009)

A weighting scheme in which every constituent of an index receives the same weight at each rebalancing date, regardless of market capitalization, price, or any fundamental metric.

> [!note]
> In an equally weighted index with $n$ constituents, each security receives a weight of $1/n$ at rebalancing. Between rebalancing dates, weights drift as prices diverge, requiring periodic realignment. Equal weighting tilts exposure toward smaller-capitalization names relative to a cap-weighted benchmark and increases turnover due to the need for regular rebalancing.

$$
w_i = \frac{1}{n}, \quad \forall\; i \in \{1, 2, \ldots, n\}
$$

> [!tip] Related terms
> [Weighting Scheme](#weighting-scheme), [Market Capitalization Weighting](#market-capitalization-weighting), [Fundamental Weighting](#fundamental-weighting), [Rebalancing](#rebalancing)

> [!example]- Source excerpts (5)
>
> t volatility can work both ways, which means that many of the themes are likely to outperform the
> market in the eventual recovery. Also, the adjusted **equal weighting** of constituents in many
> thematic ETFs ensures that the portfolios are often more diversified than corresponding sector or
> market indices. Still, the
>
> — [Thematic investing offers alternative approach amid market volatility  | Blog...](https://stoxx.com/thematic-investing-offers-alternative-approach-amid-market-volatility)
>
> The overall exposure to Tiers 2 and 3 is also capped at 50%. Components are initially weighted by
> the adjusted **equal weighting** mechanism with a multiplier set as L = 5. The resulting weights
> are capped such that both the security and group level weights are met.
>
> — [Stoxx Index Guide (PDF), p. 532](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> The funds track STOXX indices and have USD 8.9 billion in assets.5 1 The index employs an
> ‘adjusted’ **equal weighting** scheme: constituents are equally weighted but capped at five times
> their free-float market cap weight.
>
> — [iShares thematic ETF targets transformational move to digital in entertainmen...](https://stoxx.com/ishares-thematic-etf-targets-transformational-move-to-digital-in-entertainment-and-education)
>
> tigo, August 2021. 2 Melissa Brown is Managing Director, Head of Applied Research at Qontigo.
> Anran Su is Associate at Qontigo Client Services. 3 The equal-weighting methodology in these
> thematic indices goes through an adjustment formula. To find out more about it, please see the
> index guide.
>
> — [Well-Off Baby Boomers vs. Tech-Savvy Millennials: A Performance Analysis of T...](https://stoxx.com/well-off-baby-boomers-vs-tech-savvy-millennials-thematic-investing)
>
> included in the EURO STOXX, as observed on the review effective date. Weighting scheme: the index
> is price-weighted with weighting factors to achieve **equal weighting** Base values and dates: 100
> on March 16, 2012 Index types and currencies: Price, Net and Gross Return in EUR, USD
> Dissemination calendar: STOXX Europe
>
> — [Istoxx Index Guide (PDF), p. 483](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>

---

## F

### Fast Entry Rule

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="21 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 21</span>



A provision that allows a security to be added to an index outside the regular periodic review schedule when it rapidly meets pre-defined criteria, typically related to a sharp increase in market capitalization or a significant corporate event such as an IPO or spin-off.

> [!note]
> Fast entry rules ensure that indices remain representative of the market between scheduled reviews. If a newly listed company or a rapidly growing stock rises to a level that would clearly qualify it for inclusion under normal review criteria, the fast entry rule triggers an interim addition. STOXX defines specific ranking thresholds for fast entry that are typically more stringent than the standard inclusion threshold.

> [!tip] Related terms
> [Fast Exit Rule](#fast-exit-rule), [Buffer Rule](#buffer-rule), [Periodic Review](#periodic-review)

> [!example]- Source excerpts (5)
>
> 1 Group SE (crossover from MDAX) - Vantage Towers AG replaces Koenig & Bauer AG (fast exit rule) -
> Grenke AG replaces Corestate Capital Holding S.A. (**fast entry rule**) - Nagarro SE replaces
> Leoni AG (**fast entry rule**) The constituents of DAX and TecDAX remain unchanged. The next
> scheduled index review of the DAX ind
>
> — [Auto1 Group Changes into MDAX | Press releases | STOXX](https://stoxx.com/auto1-group-changes-into-mdax)
>
> STOXX Global Broad Infrastructure index. September 2013: Addition of the STOXX ASEAN-Five Select
> Dividend 50 index September 2013: Amendments if the **Fast Entry rule** in chapters 9 October
> 2013: Addition of STOXX Strong Quality indices March 2014: Addition of STOXX Nordic Strong Quality
> indices March 2014: Addition
>
> — [Stoxx Index Guide (PDF), p. 11](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> Nokia Corp. (FI0009000681) will be deleted from the index. These changes are based on the **fast
> entry rule** as defined in section 9.2.3 Ongoing maintenance of the STOXX Index Methodology Guide.
> Media Contact General Inquiries: media@qontigo.com Index Inquir
>
> — [Fast entry in the EURO STOXX 50 Index | Press releases | STOXX](https://stoxx.com/fast-entry-in-the-euro-stoxx-50-index)
>
> lection and Index Review such as immediately following such an event or in any case by Exclusion
> from Rankings, Deviation from other means. Fast Exit/**Fast Entry rule**s and Regular Any measures
> will be implemented two dissemination Exit/Regular Entry rules in exceptional days later and will
> enter into effect the nex
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF), p. 24](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>
> lation Guide). Component selection: The composition of the DAX, MDAX, SDAX and TecDAX indices is
> reviewed quarterly on the basis of the Fast Exit and **Fast Entry rule**s, and semi-annually on
> the basis of the Regular Exit and Regular Entry rules. The review on the basis of the Fast Exit
> and **Fast Entry rule**s aims to a
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF), p. 35](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>

---

### Fast Exit Rule

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="24 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 24</span>



A provision that triggers the removal of a constituent from an index between periodic reviews when it becomes ineligible due to events such as delisting, bankruptcy, or a severe decline in liquidity or market capitalization below a specified floor.

> [!note]
> Fast exit rules protect index integrity by promptly removing securities that no longer meet minimum standards. Without such rules, a bankrupt or illiquid stock could remain in the index for months until the next scheduled review, distorting returns and creating tracking difficulties. STOXX applies fast exit removals effective at the close of the day before the event or as soon as practicable.

> [!tip] Related terms
> [Fast Entry Rule](#fast-entry-rule), [Buffer Rule](#buffer-rule), [Corporate Action Treatment](#corporate-action-treatment)

> [!example]- Source excerpts (5)
>
> 14 EURO STOXX 50® ESG INDEX – INTEGRATING SUSTAINABILITY APPENDIX B THe **FAST eXiT rULe** iN
> PrACTiCe STOXX used its **fast exit rule** to become the first index provider to remove volkswagen
> (vw) from its eSG indices. FIGURE 13: Controversy r
>
> — [Stoxx Research   Euro Stoxx 50%C2%Ae Esg   Integrating Sustainability (Septem... (PDF), p. 14](https://www.stoxx.com/document/Research/STOXX%20Research%20-%20EURO%20STOXX%2050%C2%AE%20ESG%20-%20Integrating%20Sustainability%20(September%202019).pdf)
>
> ONGOING MAINTENANCE Replacements: Deleted companies are replaced using the **Fast Exit rule**,
> based on the most recent DAX 50 ESG selection list. Ad hoc exit: On a monthly basis, in case a
> company which is an index constituent has a Norms Bas
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF), p. 53](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> ESG Controversy Rating March 2020 (3): Change the weight factor notional for the STOXX Low Risk
> Weighted Indices March 2020 (4): Clarification on the **fast exit rule**s of Select Dividend and
> Maximum Dividend indices April 2020: Addition of STOXX Health & Weight Loss and STOXX Video Gaming
> & eSports indices April 20
>
> — [Stoxx Index Guide (PDF), p. 15](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> ing stock is already included in the index or does not meet the basic criteria, the non-surviving
> stock is replaced by a new company according to the **Fast Exit rule** (cf. section xx of the DAX
> Equity Index Methodology Guide). For All Share indices, the non-surviving stocks are deleted if
> they are no longer listed
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF), p. 9](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>
> Auto1 Group SE will be included in the MDAX and will replace Siltronic AG (moves to SDAX), based
> on the **fast exit rule**. Changes in SDAX: Media Contact General Inquiries: media@qontigo.com
> Index Inquiries: Andreas von Brevern +49 (0) 69 211 14284 - Siltronic AG replace
>
> — [Auto1 Group Changes into MDAX | Press releases | STOXX](https://stoxx.com/auto1-group-changes-into-mdax)
>

---

### Free-Float

<span style="background:red; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1,168 mentions across STOXX & ISS pages (high)">▰▰▰▰▰▰ 1,168</span>

> [!quote]
> "Free-float adjustment ensures that index weights reflect tradeable reality, not theoretical ownership."
>
> — **MSCI Barra**, *Free Float Adjustment Methodology* (2001)

The proportion of a company's total shares outstanding that is available for trading by public investors, excluding shares held by strategic investors, company insiders, governments, and other long-term locked-in holders.

> [!note]
> Free-float is a critical concept in modern index construction. STOXX defines strategic holdings as those exceeding 5% of outstanding shares held by a single entity with an apparent long-term intent (e.g., founding families, governments, cross-holdings). These shares are excluded from the free-float calculation. A higher free-float indicates greater investability and liquidity, and ensures index weights reflect tradeable market value.

> [!tip] Related terms
> [Free-Float Factor](#free-float-factor), [Adjusted Free-Float Market Capitalization](#adjusted-free-float-market-capitalization), [Eligibility Criteria](#eligibility-criteria)

> [!example]- Source excerpts (5)
>
> OVERVIEW The STOXX Balkan 50 Equal Weight index represents blue-chip stocks from eight Balkan
> countries in terms of **free-float** market capitalization. Universe: The index universe is
> defined as the following eight Balkan countries: Bulgaria, Croatia, Macedonia, Romania, Serbia
>
> — [Stoxx Index Guide (PDF), p. 104](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> The annualized turnover ratio is defined as the median value of the daily traded volume10 to the
> FOR adjusted **free-float** shares ratio over the last 12 months prior to the cut-off date,
> multiplied by 25211.
>
> — [Stoxx World Equity Index Guide (PDF), p. 29](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)
>
> hat would have led to a different **free-float** factor being determined had they been known at
> the time of determination. 5.9. MARKET CAPITALIZATION AND **FREE-FLOAT** MARKET CAPITALIZATION The
> full market capitalization for a company’s share class is defined as the product of the number of
> shares in a company’s sha
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF), p. 19](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> It provides as well referential information related to each constituent, such as SEDOL code, ICB
> classification, shares, **free-float** and close prices in the major currency versions. The file
> should be read in conjunction with close and open composition files valid from September 21
>
> — [Index Files Guide 20230619 (PDF), p. 13](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)
>
> This index represents the performance of the next 30 components from the EURO STOXX universe based
> on **free-float** market capitalization, after the exclusion of the current components of the EURO
> STOXX 50. Universe: The universe is defined as the composition of th
>
> — [Istoxx Index Guide (PDF), p. 395](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>

---

### Free-Float Factor

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="25 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 25</span>



A decimal coefficient between 0 and 1, typically rounded to the nearest 5% increment, representing the fraction of a company's shares that are freely available for public trading.

> [!note]
> STOXX assigns free-float factors in bands (e.g., 0.05, 0.10, 0.15, ..., 0.95, 1.00). A company with 70% free-float receives a factor of 0.70. This factor is multiplied by total shares outstanding to arrive at free-float shares, which in turn determine the constituent's weight in a free-float capitalization-weighted index. ISS provides underlying ownership data that STOXX uses to compute these factors.

$$
f_i = \frac{\text{Free-Float Shares}_i}{\text{Total Shares Outstanding}_i}
$$

Rounded to the nearest 0.05.

> [!tip] Related terms
> [Free-Float](#free-float), [Adjusted Free-Float Market Capitalization](#adjusted-free-float-market-capitalization), [Capping Factor](#capping-factor)

> [!example]- Source excerpts (5)
>
> Where no regulatory announcements are available, other publicly available sources are consulted in
> addition to determine the number of shares. 5.8. **FREE-FLOAT FACTOR**S 5.8.1. FIXED HOLDINGS
> Shares of a company that are not assigned to the free float are known as “fixed holdings.” These
> cannot be freely traded by de
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF), p. 18](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> defines Free Float as the proportion of total shares that are available for trading by the public
> in the open market. Each stock is assigned a unique **free-float factor** within the STOXX
> universe. The **free-float factor** reduces the number of shares to the actual amount available on
> the market.
>
> — [Stoxx Index Guide (PDF), p. 36](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> issuer of the security, but not earlier than one (1) calendar year after exclusion became
> effective. 5.1.4 Extraordinary Free Float Adjustments 8.2. **Free-Float Factor**s and Share
> Adjustments If the free float factor of a company included in a Ordinary adjustments: selection
> index changes by more than 10 percentage T
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF), p. 6](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>
> rket Capitalization weight of company (i) at time (t) pit = Price of company (i) at time (t) nit =
> Number of shares of company (i) at time (t) ffit = **Free-float factor** of company (i) at time
> (t) nit = Number of shares Weighting cap factors: A capping algorithm is applied to calculate
> component weights so that the IC
>
> — [Istoxx Index Guide (PDF), p. 388](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> defines Free Float as the proportion of total shares that are available for trading by the public
> in the open market. Each stock is assigned a unique **free-float factor** within the STOXX
> universe. The **free-float factor** reduces the number of shares to the actual amount available on
> the market.
>
> — [Stoxx Index Guide (PDF), p. 36](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>

---

### Gross Return Index

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="21 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 21</span>

> [!quote]
> "It is not the return on my money that I am concerned about; it is the return of my money."
>
> — **Will Rogers**



An index variant that measures total performance by reinvesting the full amount of all ordinary cash dividends on the ex-date at the closing price of the paying constituent, without deducting any withholding taxes.

> [!note]
> The gross return index represents the maximum theoretical return achievable by an investor who captures all dividends without any tax leakage. It serves as a useful upper bound for performance comparison. STOXX calculates gross return indices alongside price return and net return variants for most of its index families.

$$
\text{GRI}_t = \text{GRI}_{t-1} \times \frac{\sum_{i=1}^{n} P_i^t \times S_i \times f_i \times \text{CF}_i + \sum_{i \in \text{ex}} D_i \times S_i \times f_i \times \text{CF}_i}{\sum_{i=1}^{n} P_i^{t-1} \times S_i \times f_i \times \text{CF}_i}
$$

Where $D_i$ is the gross (pre-tax) dividend per share for constituent $i$ going ex-dividend on day $t$.

> [!tip] Related terms
> [Net Return Index](#net-return-index), [Price Return Index](#price-return-index), [Total Return Index](#total-return-index)

> [!example]- Source excerpts (5)
>
> 50 component i on day t 𝑖,𝑡 𝑟 = log gross return of EURO STOXX 50 component i on day t 𝑖,𝑡 The
> return is adjusted for corporate actions affecting the **gross return index**. The log return is
> capped/floored at +/-15%. 𝑟 = log return of the EURO STOXX 50 **Gross Return Index** 𝑖𝑑𝑥,𝑡 The log
> return is capped/floored at +/-15%.
>
> — [Stoxx Strategy Guide (PDF), p. 80](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_strategy_guide.pdf)
>
> Consequently, due to the index points being subtracted, the iSTOXX France ESG 40 Decrement 50
> index is underperforming the standard **gross return index** that includes a full dividend
> investment. 9.69.1.5. DEFINITIONS Base value and date: 1000 as of 6 Dec 2021 iSTOXX® METHODOLOGY
> GUIDE 166/
>
> — [Istoxx Index Guide (PDF), p. 165](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> s when the accuracy and - they are calculated as a Price Index, without dividends; reliability of
> the methodology used for - they are calculated as a **Gross Return Index**; with determining the
> benchmark can no dividends reinvested; longer be ensured, such as when the - they are calculated
> as a Net Return Index; with ad
>
> — [Stoxx Equity Index Family Benchmark Statement (PDF), p. 3](https://www.stoxx.com/documents/stoxxnet/Documents/Resources/Regulation/STOXX_Equity_Index_Family_Benchmark_Statement.pdf)
>
> statement shall contain at See below for Glossary of Key Terms least: the definitions for all key
> terms relating to the benchmark Key Term Definition **Gross Return Index** Shall mean an Index in
> which dividend payments are fully reinvested, calculated with a full dividend.
>
> — [Dax Volatility Index Family Benchmark Statement (PDF), p. 18](https://www.stoxx.com/documents/stoxxnet/Documents/Resources/Regulation/DAX_Volatility_Index_Family_Benchmark_Statement.pdf)
>
> Consequently, due to the percentage of performance being subtracted, the decrement index
> underperforms the standard **gross return index** that includes a gross dividend investment. The
> new indices will enable investors to overweight Eurostoxx 50 companies that rank highest in terms
> of E
>
> — [Barclays licenses iStoxx ESG Focus indices and targets private banking | Stru...](https://stoxx.com/barclays-licenses-istoxx-esg-focus-indices-and-targets-private-banking)
>

---

## I

### Index Calculation

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="253 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 253</span>



The continuous or end-of-day computational process by which constituent prices, shares, free-float factors, and capping factors are combined via the index formula to produce the index level at each point in time.

> [!note]
> STOXX calculates its indices in real time during exchange trading hours and publishes end-of-day official closing levels based on closing auction prices. The calculation engine applies the Laspeyres-type formula, maintaining the divisor to ensure continuity. Intra-day calculations typically use last-traded prices, while end-of-day calculations use official closing prices from the primary listing exchange.

> [!tip] Related terms
> [Index Formula (Laspeyres)](#index-formula-laspeyres), [Divisor](#divisor), [Index Level](#index-level)

> [!example]- Source excerpts (5)
>
> 0 0 % p.a. days = Number of calendar days between the immediately preceding Rebalancing Day R, d R
> (excluded) and the current **Index Calculation** Day d (included). 8. On any **Index Calculation**
> Day d, the value of the Total Return Index at time t is calculated as: TIt R = T R Id-1   E R
> ItE R
>
> — [Istoxx Index Guide (PDF), p. 63](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> 2 𝑅𝑒𝑎𝑙𝑖𝑧𝑒𝑑 𝑉𝑜𝑙 =√ ∙∑(ln( 𝑠 )) 𝑡,𝑛 𝑛 𝐼𝐷𝑋 𝑠−1 𝑠 Where: 𝑛 = 19 or 59. 𝑠 = Ranging from t to t-18 or t
> to t-58. Determination of Leveraged Weight On any **index calculation** date t, the leveraged
> weight is calculated as follows: 𝑤 =min (𝐶𝑎𝑝,𝑇𝑔𝑤𝑡 ) 𝑡 𝑡−1 Where the Cap is set at 200% and the
> Tolerance is 0%, so the weight i
>
> — [Stoxx Strategy Guide (PDF), p. 90](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_strategy_guide.pdf)
>
> + 41 43 430 72 72, E-Mail: customersupport@stoxx.com Guidance - DAX Equity **Index Calculation**
> trading system(s). The rules below are only applied if at least one company in this transaction is
> a component of the Blue Chip or International indi
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF), p. 9](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>
> STOXX discloses the index objective in every case. METHODOLOGY REVIEW POLICIES STOXX constantly
> monitors the execution of the **index calculation** rules in order to ensure the validity of the
> index methodology. STOXX also conducts general methodology reviews in a periodic and ad-hoc basis,
> to re
>
> — [Stoxx Index Guide (PDF), p. 26](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> D t t Where: FDAX ∑N i i=1 DAX D = i t N Here, ∑N FDAXi is the sum of all ratios i=1 to N of the
> future and index values measured on a i=1 DAXi given **index calculation** date t between the
> start of the DAX and 17:15 CET. To prevent distortions due to outliers, the lower and upper
> deciles of the ratios FDAXi are not DA
>
> — [Dax Strategy Index Guide (PDF), p. 35](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)
>

---

### Index Committee

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1 mentions across STOXX & ISS pages (ultra-low)">▰ 1</span>



A governance body composed of senior professionals within the index provider organization responsible for overseeing index methodology, approving rule changes, exercising discretion in exceptional circumstances, and ensuring the integrity and representativeness of the index.

> [!note]
> The STOXX Index Committee (or equivalent governance body) serves as the ultimate decision-making authority for all methodology-related matters. It convenes periodically to review the results of periodic reviews, approve exceptional treatments, and consider methodology enhancements. The committee may exercise expert judgment in situations not fully covered by the rulebook — for example, during market disruptions or unprecedented corporate events. Its composition, mandate, and decision-making procedures are disclosed in compliance with the EU Benchmark Regulation (BMR) and IOSCO Principles.

> [!tip] Related terms
> [Periodic Review](#periodic-review), [Rules-Based Index](#rules-based-index), [Stakeholder Consultation](#stakeholder-consultation)

> [!example]- Source excerpts (1)
>
> ty (members must be profitable over the past 12 months, including the most recent quarter).
> However, constituent selection is at the discretion of an **Index Committee** based on the
> eligibility criteria.1 Driving outperformance Amid increased profitability and investors’ favor,
> Tesla’s outperformance has left its mar
>
> — [Tesla’s place in a US stock benchmark | Blog posts | STOXX](https://stoxx.com/teslas-place-in-a-us-stock-benchmark)
>

---

### Index Formula (Laspeyres)

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="72 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 72</span>

> [!quote]
> "The Laspeyres method holds quantities fixed and lets prices tell the story — the natural choice for a market index."
>
> — **Irving Fisher**, *The Making of Index Numbers* (1922)

The mathematical expression used to compute a capitalization-weighted index level, based on the Laspeyres aggregation method, where quantities (shares) are held fixed between rebalancing dates and the index reflects only price changes.

> [!note]
> The Laspeyres framework underpins virtually all modern capitalization-weighted indices. In the STOXX implementation, the formula divides the sum of all constituents' adjusted free-float market capitalizations by the divisor. The divisor is calibrated so that the formula yields the base value on the base date, and it is subsequently adjusted to absorb all non-price changes.

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
> [Laspeyres Price Index Formula](#laspeyres-price-index-formula), [Divisor](#divisor), [Index Calculation](#index-calculation)

> [!example]- Source excerpts (5)
>
> Global Equity 20% Global Fixed Income 30% High Yield 30% Mixed Allocation 20% iSTOXX® METHODOLOGY
> GUIDE 532/1024 61. iSTOXX FUND INDICES **Index formula**: 4 𝐼𝑉 =∑ 𝑤𝑓 ∙𝑁𝐴𝑉 𝑡 𝑖,𝑡 𝑖,𝑡 𝑖=1 𝐼𝑉 =1000 0
> whereby the weighting factor is calculated as 𝑤𝑓 = 𝑤𝑖,𝑡𝑅𝑒𝑏 ∙𝐼𝑉 and t refers to the Index 𝑖,𝑡
> 𝑁𝐴𝑉𝑖,𝑡𝑅𝑒𝑏 𝑡𝑅𝑒𝑏
>
> — [Istoxx Index Guide (PDF), p. 532](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> 10% 100 on 27/03/2003 Index EURO iSTOXX 50 Dynamic CH1213358802 ISXGDE10 Exposure Volatility 10%
> SX5GT 10% 100 on 27/03/2003 Index 32.3. CALCULATION **Index Formula** The index is calculated as
> follows: 𝐼𝐷𝑋 𝐴𝐶𝑇(𝑡−1,𝑡) 𝐼𝑉 =𝐼𝑉 ∙(1+𝑤 ∙( 𝑡 −1)+(1−𝑤 )∙𝐼𝑅 ∙ ) 𝑡 𝑡−1 𝑡−1 𝐼𝐷𝑋 𝑡−1 𝑡−1 360 𝑡−1 Where:
> 𝐼𝑉 = The index value as o
>
> — [Stoxx Strategy Guide (PDF), p. 89](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_strategy_guide.pdf)
>
> INDEX VALUE CALCULATION 14/37 7.1. INDEX FORMULAS The indices are calculated with the Laspeyres
> formula, which measures price changes against a fixed base quantity weight.
>
> — [Dax Equity Calculation Guide 20231002 (PDF), p. 14](https://www.stoxx.com/document/News/2023/October/DAX%20Equity%20Calculation%20Guide_20231002.pdf)
>
> ation of Version 4.8 - Addition of DAX Covered Call ATM Index 22/08/2025 Effective 22//08/2025
> Published Creation of Version 4.7 - Enhancement in the **index formula** of DAXplus Option Indices
> 24/03/2025 Effective 24//03/2025 Published Creation of Version 4.6 - Deletion of idDAX 50 Equal
> Weight Decrement 4% Index 2
>
> — [Dax Strategy Index Guide (PDF), p. 51](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)
>
> indices will become effective on 18 March, which were announced in March 2023, these relate to
> changes in the treatment of corporate actions and the **index formula**; and to an adjustment of
> the capping in the DAX index family from 10 to 15 per cent, announced in November 2023. The next
> scheduled index review of t
>
> — [Two changes each in MDAX, SDAX and TecDAX | Press releases | STOXX](https://stoxx.com/two-changes-each-in-mdax-sdax-and-tecdax)
>

---

### Index Level

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="106 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 106</span>



The numerical value of an index at a given point in time, representing the cumulative effect of constituent price changes since the base date, scaled by the base value and maintained via the divisor.

> [!note]
> The index level is the single number quoted in financial markets — for example, "the EURO STOXX 50 closed at 4,285.50." It is calculated by dividing the aggregate adjusted free-float market capitalization of all constituents by the divisor. Changes in the index level between two dates (expressed as a percentage) represent the index return over that period.

> [!tip] Related terms
> [Base Value](#base-value), [Base Date](#base-date), [Index Calculation](#index-calculation)

> [!example]- Source excerpts (5)
>
> Return Index Index Rounding: 2 d.p. Dissemination Calendar: STOXX Europe Calendar. Index Types and
> Currencies: Excess Return in EUR. INDEX REVIEW The **Index Level** is determined by: 𝑈𝐿 𝐴𝐶𝑇(𝑡−1,𝑡)
> 𝑡 𝐼𝑉 =𝐼𝑉 ∙[1+𝑤 ( −1)−𝑤 (𝐼𝑅 )] 𝑡 𝑡−1 𝑡−1 𝑈𝐿 𝑡−1 𝑡−1 360 𝑡−1 Where: IV = Excess Return **Index
> level** on index level deter
>
> — [Istoxx Index Guide (PDF), p. 653](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> The Index Data Distribution System contains various permission levels such as entity and users
> accesses, per commercial packages, per **Index level** and subject to Licenses of Third-Party
> Data. - The “Current Index Data Distribution System” refers to MD+Si and / or iSFTP solution,
> which is current
>
> — [Technical Migration New Index Data Distribution System And New File Formats F... (PDF), p. 1](https://www.stoxx.com/document/News/2023/March/Technical_Migration-New_Index_Data_Distribution_System_and_New_File_Formats_for_DAX_Indices_20230327_3457284624.pdf)
>
> preceding that day. Self-financing constraint (II) 𝐼𝑉𝑃𝑜𝑠𝑡 =𝐼𝑉𝑃𝑟𝑒−(𝐶𝑃𝑜𝑠𝑡−𝐶𝑃𝑟𝑒)(𝑃∗
> −𝑃𝑀)−(𝐶𝑃𝑜𝑠𝑡−𝐶𝑃𝑟𝑒)(𝑃∗ −𝑃𝑀) 𝑡 𝑡 1𝑡 1𝑡 1𝑡 1𝑡 2𝑡 2𝑡 2𝑡 2𝑡 The post-roll **index level** has to be
> equal to the pre-roll **index level** minus cost the of trading. Hereby 𝑃∗ refers to either the
> bid price 𝑃𝐵 or ask price 𝑃𝐴 depending on wheth
>
> — [Stoxx Strategy Guide (PDF), p. 49](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_strategy_guide.pdf)
>
> This specialized product permits seasonal investment strategies by locking in the **index level**
> achieved during August and September (**index level**s are traditionally lower during these
> months). The index comprises the 40 DAX components and is cal
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF), p. 84](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> Index Fundamentals The aim of the file is to provide fundamental ratios at **index level** such as
> net dividend yield, price to book and price to sales ratio. It provides as well referential
> information such as date of the report, index sym
>
> — [Index Files Guide 20230619 (PDF), p. 93](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)
>

---

### Index Point

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="79 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 79</span>


A unit of change in the index level, where a movement of one index point represents a change of 1.0 in the numerical index value, distinct from a percentage or basis-point change.

> [!note]
> Index points are the raw unit of index level movement. A move from 4,200.00 to 4,215.00 is a 15-point move. Because the meaning of an index point depends on the level of the index, percentage returns are preferred for performance comparison. However, index points are commonly used in quoting futures and options on indices, in daily market commentary, and in specifying settlement values of index derivatives.

$$
\Delta \text{pts} = \text{Index}_t - \text{Index}_{t-1}
$$

$$
\Delta \% = \frac{\Delta \text{pts}}{\text{Index}_{t-1}} \times 100
$$

> [!tip] Related terms
> [Index Level](#index-level), [Basis Point (Index)](#basis-point-index), [Index Calculation](#index-calculation)

> [!example]- Source excerpts (5)
>
> , dividends are an important factor underpinning equities as many income investors and pension
> funds are attracted to the stable cash flows. Dividend **index point**s The EURO STOXX 50® Index
> Dividend Futures are based upon the underlying calculation of dividends for the constituents of
> the EURO STOXX 50 Index, th
>
> — [Dividend Futures Point to Historical Payments Slump | Blog posts | STOXX](https://stoxx.com/dividend-futures-point-to-historical-payments-slump)
>
> The amount of deduction can either be a performance deduction, in which case it is expressed in
> percentage points, or it can be an **index point**s deduction in which case it is expressed in
> **index point**s. Decrement indices have floor value of zero.
>
> — [Stoxx Strategy Guide (PDF), p. 74](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_strategy_guide.pdf)
>
> The new EURO STOXX 50® ESG DVP index will enable the construction of hedges around dividend
> payments in the EURO STOXX 50 ESG. Dividend **index point**s The STOXX DVP indices are calculated
> as the sum of all gross cash or cash equivalent payments from the underlying index components each
> calendar yea
>
> — [STOXX extends EURO STOXX 50 ESG offering with dividend points index | Blog po...](https://stoxx.com/stoxx-extends-euro-stoxx-50-esg-offering-with-dividend-points-index)
>
> Put index uses the values of the constituent elements (applying currency conversion, if necessary)
> in calculation its index value and is expressed in **Index point**s, reflecting the index-specific
> currency. The intraday currency conversion is based on the spot rates provided by Refinitiv
> previously Financial and
>
> — [Dax Strategy Index Guide (PDF), p. 9](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)
>
> ACTIONS AND ADJUSTMENTS » For indices that held the affected company on the ex-date a reinvestment
> is applied via a divisor adjustment to correct the **index point**s have been previously added. A
> positive (negative) reinvestment is applied, if the difference between the new amount and old
> amount is larger (smalle
>
> — [Dax Equity Calculation Guide 20231002 (PDF), p. 29](https://www.stoxx.com/document/News/2023/October/DAX%20Equity%20Calculation%20Guide_20231002.pdf)
>

---

### Index Universe

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="360 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 360</span>

> [!quote]
> "Wide diversification is only required when investors do not understand what they are doing."
>
> — **Warren Buffett**



The broadest set of securities from which an index's constituents may be selected, defined by geographic, exchange, sector, or asset-class criteria.

> [!note]
> The index universe is the starting pool before any eligibility or selection screens are applied. For example, the STOXX Europe 600 draws from the STOXX Europe Total Market Index, which itself covers securities listed in 17 European countries. The universe definition determines the geographic and economic scope of the index and is specified in the index rulebook.

> [!tip] Related terms
> [Eligibility Criteria](#eligibility-criteria), [Selection Criteria](#selection-criteria), [Selection List](#selection-list)

> [!example]- Source excerpts (5)
>
> TOXX Balkan 50 Equal Weight index represents blue-chip stocks from eight Balkan countries in terms
> of free-float market capitalization. Universe: The **index universe** is defined as the following
> eight Balkan countries: Bulgaria, Croatia, Macedonia, Romania, Serbia, Slovenia Greece and Turkey.
> Weighting scheme: The
>
> — [Stoxx Index Guide (PDF), p. 104](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> Arctic Oil and Gas Exploration, Oil Sands and Shale Energy), Conventional Oil & Gas, Thermal Coal,
> and Nuclear Power are also excluded. Universe: The **index universe** is defined as all stocks
> from the STOXX Global 1800 index Weighting scheme: The indices are price-weighted with a weighting
> factor based on the inver
>
> — [Istoxx Index Guide (PDF), p. 542](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> HLY INDEX NEWS / August Factor Indices (Regional: US) Key points In the US, momentum continued to
> yield the highest returns within the STOXX® USA 500 **Index universe**. Within the broader STOXX®
> USA 900 **Index universe**, quality trumped momentum in August.
>
> — [Monthly Index News August 2020 (PDF), p. 17](https://stoxx.com/monthly-index-news-august-2020)
>
> South Africa, Tunisia To cover depositary receipts and the different share classes of companies
> from China, Taiwan and Hong Kong, the following STOXX **index universe** and regions exist: Index
> family Shares classes covered Region STOXX China A A shares Separate family outside of the STOXX
> Global **index universe** STOXX
>
> — [Stoxx World Equity Index Guide (PDF), p. 14](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)
>
> The index aims to cover the 500 largest companies in terms of free-float market cap of the **index
> universe**. The detailed methodology including the calculation formula can be found in our
> rulebook: www.stoxx.com/indices/rulebooks.html Versions and symbols Q
>
> — [Sx50Ugv (PDF), p. 2](https://www.stoxx.com/document/Indices/Factsheets/2022/December/SX50UGV.pdf)
>

---

### Investability

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="11 mentions across STOXX & ISS pages (low)">▰▰ 11</span>

> [!quote]
> "Liquidity is a coward — it disappears at the first sign of trouble."
>
> — **Nassim Nicholas Taleb**, *The Black Swan* (2007)



The degree to which an index can be practically replicated by a real-world portfolio, determined by the liquidity, free-float, and trading volumes of its constituents, as well as the index's turnover and weight concentration characteristics.

> [!note]
> Investability is a core design objective for benchmark indices. STOXX ensures investability by imposing minimum liquidity and free-float requirements at the eligibility stage, applying free-float adjustments to weights, and using buffer rules to limit turnover. An index with poor investability would generate excessive tracking error for replicating portfolios, defeating its purpose as a benchmark. Investability considerations also inform the choice of review frequency, capping thresholds, and fast entry/exit rules.

> [!tip] Related terms
> [Free-Float](#free-float), [Eligibility Criteria](#eligibility-criteria), [Tracking Error](#tracking-error), [Turnover](#turnover)

> [!example]- Source excerpts (5)
>
> indices as building blocks, you can do this without compromising the consistent index-construction
> methodology. Can you tell us a bit more as to why **investability** is so important in emerging
> markets? Emerging markets cannot necessarily be accessed in the same way as developed markets.
>
> — [Q&amp;A: Building customized, sustainable portfolios based on the STOXX World...](https://stoxx.com/qa-building-customized-sustainable-portfolios-based-on-the-stoxx-world-indices)
>
> 4. The S&P 500 tracks stocks weighted by their float-adjusted market value. Inclusion is based on
> quantitative factors such as size, liquidity, **investability** and financial viability (members
> must be profitable over the past 12 months, including the most recent quarter).
>
> — [Tesla’s place in a US stock benchmark | Blog posts | STOXX](https://stoxx.com/teslas-place-in-a-us-stock-benchmark)
>
> Currently, such a review only takes place in September. - In order to simplify the rules without
> foregoing **investability**, the constituents will be selected by market capitalization only from
> the September 2021 review onward.
>
> — [German Benchmark Index DAX Will be Strengthened by Additional Qualification C...](https://stoxx.com/german-benchmark-index-dax-will-be-strengthened-by-additional-qualification-criteria-and-harmonization-with-international-standards)
>
> At the same time, ETF issuers and end investors must prioritize both thematic “purity” and
> **investability**, striking a balance in the construction of indices. Among the most popular
> investment themes in 2025 were AI, European defense and technology-related
>
> — [Eurex Derivatives Forum explores growth of options-based, thematic index stra...](https://stoxx.com/eurex-derivatives-forum-explores-growth-of-options-based-thematic-index-strategies)
>
> are made available: Constrained and Unconstrained. The Unconstrained version is optimized with
> minimal constraints, which pertain to tradability and **investability**, and aims to be on the
> efficient frontier. The Constrained version seeks to also reduce different risks, such as peer and
> benchmark risks.
>
> — [Stoxx Minvar Paper (PDF), p. 14](http://www.stoxx.com/document/Others/marketing/STOXX_MinVar_Paper.pdf)
>

---

## L

### Market Capitalization Weighting

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="3 mentions across STOXX & ISS pages (ultra-low)">▰ 3</span>

> [!quote]
> "Don't look for the needle in the haystack — just buy the haystack."
>
> — **John C. Bogle**, *The Little Book of Common Sense Investing* (2007)



A weighting methodology in which each constituent's weight is proportional to its full (non-free-float-adjusted) market capitalization, calculated as share price multiplied by total shares outstanding.

> [!note]
> Full market-cap weighting was the original method used by early indices. It weights companies by their total equity value regardless of how much of that value is available for trading. Most modern benchmark indices, including those from STOXX, have moved to free-float-adjusted market-cap weighting, but full-cap weighting is still used in certain research and strategy indices.

$$
w_i = \frac{P_i \times S_i}{\sum_{j=1}^{n} P_j \times S_j}
$$

> [!tip] Related terms
> [Free-Float Market Capitalization Weighting](#free-float-market-capitalization-weighting), [Equal Weighting](#equal-weighting), [Price Weighting](#price-weighting)

> [!example]- Source excerpts (3)
>
> Selection is based on a multi-step procedure which seeks to identify the strongest and most
> representative assets in each eligible sector. A **market capitalization weighting** scheme with a
> cap of 30 percent limits exposure to typically dominant tokens such as Bitcoin and Ethereum. “With
> its maximum weighting limit of 30 pe
>
> — [STOXX licences first crypto Blue Chip Index, co-developed with Bitcoin Suisse...](https://stoxx.com/stoxx-licences-first-crypto-blue-chip-index-co-developed-with-bitcoin-suisse-to-valour-inc)
>
> . Looking across different markets and time periods, a portfolio whose holdings have had an equal
> allocation to them has outperformed the traditional market-capitalization-weighting positioning.
> The latter strategy has been the core offering since the inception of equity indices and still
> governs a majority of benchmarked portfol
>
> — [What’s Behind the Edge in Equal-Weight Strategies? | Blog posts | STOXX](https://stoxx.com/whats-behind-the-edge-in-equal-weight-strategies)
>
> ther with robust exchange-based pricing, ensures the investable tokens present quality standards
> that are acceptable to a larger pool of investors. A **market capitalization weighting** scheme
> with a cap of 30% limits exposure to dominant tokens — such as Bitcoin and Ethereum currently —
> while keeping the strategy representative of t
>
> — [Valour launches ETP on first STOXX crypto blue-chip index | Blog posts | STOXX](https://stoxx.com/valour-launches-etp-on-first-stoxx-crypto-blue-chip-index)
>

---

### Net Return Index

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="64 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 64</span>

> [!quote]
> "In this world nothing can be said to be certain, except death and taxes."
>
> — **Benjamin Franklin**



An index variant that reinvests dividends after deducting withholding taxes at the applicable rate for a specified investor domicile, reflecting the return achievable by a foreign or domestic investor subject to standard withholding tax regimes.

> [!note]
> The net return index provides a more realistic performance measure than the gross return index for investors who cannot fully reclaim dividend withholding taxes. STOXX applies country-specific withholding tax rates, typically the maximum rate applicable to a non-treaty institutional investor. This makes the net return index the most commonly used benchmark for comparing fund performance.

$$
\text{NRI}_t = \text{NRI}_{t-1} \times \frac{\sum_{i=1}^{n} P_i^t \times S_i \times f_i \times \text{CF}_i + \sum_{i \in \text{ex}} D_i \times (1 - \tau_i) \times S_i \times f_i \times \text{CF}_i}{\sum_{i=1}^{n} P_i^{t-1} \times S_i \times f_i \times \text{CF}_i}
$$

Where $\tau_i$ is the withholding tax rate applicable to the dividend of constituent $i$.

> [!tip] Related terms
> [Gross Return Index](#gross-return-index), [Price Return Index](#price-return-index), [Total Return Index](#total-return-index)

> [!example]- Source excerpts (5)
>
> Fixed day count convention). Consequently, due to the percentage of performance being subtracted,
> the decrement index is underperforming the standard **net return index**. The Underlying Index is
> the iStoxx Europe Origin 100 Equal Weight **Net Return Index**. DEFINITIONS Base value: 100 Base
> date: 24 September 2007 Underly
>
> — [Istoxx Index Guide (PDF), p. 99](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> orms for example in terms of component selection, weighting schemes and personalized calculation
> methodologies. 3 Net dividend yield is calculated as **net return index** return minus price index
> return 4 STOXX data from Jun. 20, 2011 to Aug. 31, 2023 (USD, net return), all data as of Aug.
>
> — [Ixarobu (PDF), p. 2](https://www.stoxx.com/document/Bookmarks/CurrentFactsheets/IXAROBU.pdf)
>
> investments as long as the overall net dividend yield of the base index is greater than the value
> being subtracted. The base index is the DAX 50 ESG **Net Return Index**. Base value and dates:
> 1000 on September 24, 2012. 8.1.2. CALCULATION The index is calculated as follows: U ACT(t−1,t) t
> IV =IV × ( −D ) t t−1 U 365
>
> — [Dax Strategy Index Guide (PDF), p. 32](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)
>
> oud HQ Patents AI in Big Data HQ Patents Source: EconSight. 5 Based on the composition as of
> September 30, 2024. 6Net dividend yield is calculated as **net return index** return minus price
> index return. STOXX Ltd. (“STOXX”), ISS STOXX Index GmbH (“ISS STOXX”), Deutsche Boerse Group and
> their licensors, research partne
>
> — [Product Brief Stoxx Global Ai Infastructure Index (PDF), p. 3](https://stoxx.com/wp-content/uploads/2023/11/Product-brief-STOXX-Global-AI-Infastructure-Index.pdf)
>
> IR +𝑥)Diff(𝑡−1,t) )] 𝑡 𝑡−1 𝑡−1 360 𝑡−1 SX5T𝑡−1 𝑡−1 𝑡−1 360 where: IndexERt = Excess Return Index
> level on index level determination date t IndexTRt = **Net Return Index** level on index level
> determination date t wt = Equity Weight on index level determination date t Level of the EURO
> STOXX 50 Net Return on index level
>
> — [Stoxx Strategy Guide (PDF), p. 53](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_strategy_guide.pdf)
>

---

### Number of Components (Fixed vs. Variable)

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="122 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 122</span>


The rule specifying whether an index maintains a predetermined fixed count of constituents (e.g., exactly 50 stocks) or allows the count to vary based on eligibility and selection criteria at each review.

> [!note]
> Fixed-count indices such as the EURO STOXX 50 always maintain exactly the target number of constituents. When a constituent is removed, a replacement is added to maintain the count. Variable-count indices, such as the STOXX Europe Total Market Index, include all securities that satisfy the eligibility and selection thresholds, and the number of constituents may change at each review. Fixed-count indices typically require more elaborate buffer rules and ranking procedures.

> [!tip] Related terms
> [Buffer Rule](#buffer-rule), [Constituent](#constituent), [Reconstitution](#reconstitution)

> [!example]- Source excerpts (5)
>
> EX For each country i, a maximum **number of components** is calculated as follows, rounded to the
> nearest integer: K =(SXW1 +10%)∗N i i where: K maximum **number of components** from country i,
> allowed for inclusion in the iSTOXX 𝑖 Global Low Carbon ex-Controversial Activities Select 30
> Index SXW1 weight of the components com
>
> — [Istoxx Index Guide (PDF), p. 442](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> STOXX BENCHMARK INDICES (BMI) Fast Exit: Not applicable. Replacements To maintain the **number of
> components** constant, a deleted stock is replaced by the highest ranked non-component on the
> selection list, which is a US company and does not belong to the ICB
>
> — [Stoxx Index Guide (PDF), p. 88](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> Thus, MDAX is growing to 60 from 50 stocks, and SDAX has been expanded to 70 from 50. In TecDAX, a
> sector-specific index, the **number of components** remains unchanged. Rules-based methodology The
> systematic and rules-based methodology that characterizes the three indices will remain intact, as
> wil
>
> — [Comprehensive Overhaul for DAX Index Family | Blog posts | STOXX](https://stoxx.com/comprehensive-overhaul-for-dax-index-family)
>
> -called effective number of assets, which measures the breadth of holdings in a portfolio. For an
> equal-weighted index this number is the same as the **number of components**: the effective number
> of assets of the EURO STOXX 50 Equal Weight, for example, is 50.
>
> — [What’s Behind the Edge in Equal-Weight Strategies? | Blog posts | STOXX](https://stoxx.com/whats-behind-the-edge-in-equal-weight-strategies)
>
> Changes in weights due to corporate actions are distributed proportionally across all index The Fi
> factors provide information on the **number of components**. The index divisors are calculated as
> shares required from each company to track the follows: underlying index portfolio. ∑𝑛 (𝑝 ⋅𝑠 ⋅ff
> ⋅cf ⋅𝑥 )±𝛥MC 𝐷
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF), p. 12](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>

---

## O

### Periodic Review

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="14 mentions across STOXX & ISS pages (low)">▰▰ 14</span>



The scheduled process — typically conducted quarterly, semi-annually, or annually — during which an index provider reassesses constituency, share counts, free-float factors, and other parameters against current data.

> [!note]
> Periodic reviews are the primary governance mechanism for index maintenance. STOXX conducts reviews on predefined calendar dates published in advance. During a review, the index provider re-applies eligibility and selection criteria to the index universe, updates share counts and free-float factors, recalculates capping factors if applicable, and announces the resulting changes before the effective date.

> [!tip] Related terms
> [Reconstitution](#reconstitution), [Review Frequency](#review-frequency), [Announcement Date](#announcement-date), [Rebalancing](#rebalancing)

> [!example]- Source excerpts (5)
>
> All changes are implemented on the third Friday and effective the next trading day following the
> STOXX **periodic review** calendar. The cut-off date for the selection list and the ADTV data to
> calculate the weights is the last business day of the month preceding the revi
>
> — [Stoxx Index Guide (PDF), p. 305](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> STOXX does not use any models or methods of extrapolation in relation to Input Data. **Periodic
> review**s of all benchmarks are undertaken to ensure their current constituents are best suited to
> measure their defined market or economic reality.
>
> — [Stoxx Equity Index Family Benchmark Statement (PDF), p. 7](https://www.stoxx.com/documents/stoxxnet/Documents/Resources/Regulation/STOXX_Equity_Index_Family_Benchmark_Statement.pdf)
>
> /announcements.html>  Row 9, Column B: Text<Selection Lists> and
> Hyperlink<http://www.stoxx.com/news/stoxx_selections.html>  Row 10, Column B: Text<**Periodic
> Review**s> and Hyperlink<http://www.stoxx.com/news/review_dates.html>  Row 12, Column A:
> Text<Please see the disclosures at the end of this report> and Hyper
>
> — [Index Files Guide 20230619 (PDF), p. 92](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)
>
> ex methodology Extreme or exceptional market conditions or analogous extraordinary IGC situations
> to be addressed in a fast track way (e.g. Pandemic) **Periodic review** of current index
> methodologies (e.g. matching of underlying interest) including initiation of ad-hoc reviews of
> benchmarks or benchmark IGC families
>
> — [Guide To Eurogov Bond Indices (PDF), p. 27](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/Guide_to_EUROGOV_Bond_Indices.pdf)
>
> stoxx.com/news/review_dates.html STOXX WORLD EQUITY INDEX METHODOLOGY GUIDE 17/37 4. INDEX
> CHARACTERISTICS BUFFERS Buffers are used in the **periodic review**s to reduce turnover. Based on
> an index-specific characteristic, an upper and a lower limit is set around the index target
> coverage.
>
> — [Stoxx World Equity Index Guide (PDF), p. 17](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)
>

---

### Price Return Index

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="2 mentions across STOXX & ISS pages (ultra-low)">▰ 2</span>



An index variant that measures the performance of the constituent basket based solely on price changes, without accounting for dividend distributions or other income.

> [!note]
> The price return index is the simplest form of index calculation. When a constituent pays a dividend, the price drops by approximately the dividend amount on the ex-date, and this decline is reflected in the index level. No reinvestment adjustment is made. Price return indices understate total investor returns but are widely quoted in the media (e.g., the headline Dow Jones Industrial Average level is a price return figure).

$$
\text{PRI}_t = \frac{\sum_{i=1}^{n} P_i^t \times S_i \times f_i \times \text{CF}_i}{D_t}
$$

> [!tip] Related terms
> [Gross Return Index](#gross-return-index), [Net Return Index](#net-return-index), [Total Return Index](#total-return-index)

> [!example]- Source excerpts (2)
>
> INDEX CHARACTERISTICS INDEX CALCULATION The indices are calculated using Laysperes formula as
> described in this section. 3.8.1. **PRICE RETURN INDEX** The indices are weighted based on the
> components’ reference prices and weighting factors: ∑𝑛 (𝑝 ∙ 𝑤𝑓 ∙𝑥 ) 𝑀 𝑖=1 𝑖𝑡 𝑖𝑡 𝑖𝑡 𝑡 𝐼𝑛𝑑𝑒𝑥 𝑡 = 𝐷 =
> 𝐷 𝑡 𝑡 Where:
>
> — [Stoxx Digital Asset Guide (PDF), p. 12](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_digital_asset_guide.pdf)
>
> tive maturity date of the bond or years to the closest coupon reset date prior to maturity. Yrs To
> Worst Index level Years to Worst PRR Index Val LOC **Price return index** value in local currency
> PRR % MTD LOC Month-to-date return of the **price return index** in local currency GUIDE TO THE
> EUROGOV® BOND INDICES
>
> — [Guide To Eurogov Bond Indices (PDF), p. 15](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/Guide_to_EUROGOV_Bond_Indices.pdf)
>

---

### Rebalancing

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="271 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 271</span>

> [!quote]
> "Rebalancing is a discipline that forces you to sell high and buy low."
>
> — **William Bernstein**, *The Four Pillars of Investing* (2002)



The periodic process of realigning constituent weights to their target values as defined by the weighting scheme, which may also involve updating share counts, free-float factors, and capping factors.

> [!note]
> Rebalancing corrects the weight drift that accumulates between review dates as constituent prices diverge. For equally weighted indices, rebalancing resets all weights to $1/n$. For capped free-float indices, rebalancing recalculates capping factors so that no constituent exceeds its weight ceiling. Rebalancing triggers a divisor adjustment to maintain index level continuity and is a key driver of turnover in index-tracking portfolios.

> [!tip] Related terms
> [Reconstitution](#reconstitution), [Divisor Adjustment](#divisor-adjustment), [Capping](#capping), [Turnover](#turnover)

> [!example]- Source excerpts (5)
>
> 𝑉 =∑ 𝑤𝑓 ∙𝑁𝐴𝑉 𝑡 𝑖,𝑡 𝑖,𝑡 𝑖=1 𝐼𝑉 =1000 0 whereby the weighting factor is calculated as 𝑤𝑓 = 𝑤𝑖,𝑡𝑅𝑒𝑏
> ∙𝐼𝑉 and t refers to the Index 𝑖,𝑡 𝑁𝐴𝑉𝑖,𝑡𝑅𝑒𝑏 𝑡𝑅𝑒𝑏 Reb **Rebalancing** Day immediately preceding
> Dissemination Day 𝑡. ONGOING MAINTENANCE Index replicability: If STOXX becomes aware through
> public information or market f
>
> — [Istoxx Index Guide (PDF), p. 518](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> New issues must settle on or before the following calendar month end **rebalancing** date in order
> to qualify for the coming month. No changes are made to constituent holdings other than on month
> end **rebalancing** dates.
>
> — [Guide To Eurogov Bond Indices (PDF), p. 6](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/Guide_to_EUROGOV_Bond_Indices.pdf)
>
> They are shown in Figure 2. Figure 2: Scenario analysis of trading volume on **rebalancing** days
> In the median scenario, the one close to an average SAP quarterly performance in recent history,
> the selling volume from index trackers on the d
>
> — [DAX: A trading impact analysis of the 15% stock cap | Blog posts | STOXX](https://stoxx.com/dax-a-trading-impact-analysis-of-the-15-stock-cap)
>
> values (x) are given in the following table: Long Short Leverage Trigger Value Leverage Trigger
> Value 5 -14% -5 14% 7 -11% -7 11% Within the intraday **rebalancing** process, the base value when
> the minimum/maximum occurs in time t* is calculated as: If L>0: IDX t∗= min [θ,θ+] IDX t DAX
> STRATEGY INDEX G
>
> — [Dax Strategy Index Guide (PDF), p. 19](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)
>
> In this framework, we apply the following two constraints: All indices comply with UCITS
> regulation at **rebalancing**; in fact the component capping applied is even stricter than UCITS
> requirements.
>
> — [Stoxx Minvar Paper (PDF), p. 16](http://www.stoxx.com/document/Others/marketing/STOXX_MinVar_Paper.pdf)
>

---

### Reconstitution

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="2 mentions across STOXX & ISS pages (ultra-low)">▰ 2</span>

> [!quote]
> "Reconstitution is the moment when an index refreshes itself — new blood in, old blood out — based purely on the rules."
>
> — **Antti Petajisto**, *The Index Premium and Its Hidden Cost for Index Funds* (2011)

The process of redetermining the membership of an index by re-applying eligibility and selection criteria to the full index universe, resulting in additions of newly qualifying securities and deletions of those that no longer qualify.

> [!note]
> Reconstitution is distinct from rebalancing: reconstitution changes *which* securities are in the index, while rebalancing changes *how much weight* each security carries. In practice, both often occur simultaneously during periodic reviews. STOXX reconstitution follows a transparent, rules-based methodology that ranks eligible securities and applies buffer rules to manage turnover.

> [!tip] Related terms
> [Rebalancing](#rebalancing), [Periodic Review](#periodic-review), [Buffer Rule](#buffer-rule), [Selection Criteria](#selection-criteria)

> [!example]- Source excerpts (2)
>
> , delivers letter to SandRidge board re- shareholders act by written consent to replace all 7
> incumbents, including the questing declassification and **reconstitution** of the board in
> consultation founder CEO/Chairman, on the board of SandRidge Energy.
>
> — [Ma Analysis (PDF), p. 10](https://www.issgovernance.com/file/2013/02/MA_analysis.pdf)
>
> rruption – are also excluded. The remaining constituents are weighted by free float-adjusted
> market capitalization subject to a 20% cap per security. **Reconstitution** and rebalancing occur
> quarterly. According to Stoxx, the new index shows a risk-return profile similar to its parent
> index while offering investors a
>
> — [Stoxx introduces Stoxx Europe 600 ESG-X Index | ETF Strategy - ETF Strategy](https://stoxx.com/stoxx-introduces-stoxx-europe-600-esg-x-index)
>

---

### Review Frequency

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="502 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 502</span>



The cadence at which an index provider conducts periodic reviews, commonly expressed as quarterly (March, June, September, December), semi-annually, or annually.

> [!note]
> STOXX uses different review frequencies across its index families. The EURO STOXX 50, for example, conducts a full reconstitution annually in September, with quarterly reviews for share and free-float updates only. More frequent reviews improve representativeness but increase turnover. The review frequency is a fundamental design choice that balances accuracy against transaction costs for index-tracking investors.

> [!tip] Related terms
> [Periodic Review](#periodic-review), [Reconstitution](#reconstitution), [Turnover](#turnover)

> [!example]- Source excerpts (5)
>
> Index consist of the components of the parent STOXX World AC Universal All Cap Equity Index, that
> belong to the respective country, see Section 4.6. **Review frequency**: The **review frequency**
> of each STOXX Country Index is the same as the review frequency of the parent STOXX World AC
> Universal All Cap Equity Index, un
>
> — [Stoxx World Equity Index Guide (PDF), p. 33](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)
>
> If the ROE ranking is the same, the stock with the highest free-float market capitalization will
> be selected. **Review frequency**: The reviews are conducted on a semi-annual basis in June and
> December. The review cut-off date for the underlying data is the last trading day of th
>
> — [Istoxx Index Guide (PDF), p. 237](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> E, respectively. The Regulated Market All Share contains all stocks listed on the regulated market
> (i.e., Prime Standard or General Standard) of FSE. **Review frequency**: The indices are
> rebalanced on a quarterly basis. DAX EQUITY INDEX METHODOLOGY GUIDE 26/120 6. DAX ALL SHARE
> INDICES 6.1.3.
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF), p. 25](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> To learn more about the adjustment level and the calculation formula, please see our rulebook:
> **Review frequency** End-of-day: 7:15 pm CET www.stoxx.com/indices/rulebooks.html
> Calculation/distribution 100 as of Oct.
>
> — [Sx5Evbt (PDF), p. 2](https://www.stoxx.com/document/Indices/Factsheets/2020/May/SX5EVBT.pdf)
>
> Companies not already assigned to the Large or Mid segments are assigned to the Small segment.
> **Review frequency**: The reviews are conducted on a quarterly basis together with the STOXX
> Global Total Market indices. STOXX INDEX METHODOLOGY GUIDE 52/639
>
> — [Stoxx Index Guide (PDF), p. 51](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>

---

### Rules-Based Index

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1 mentions across STOXX & ISS pages (ultra-low)">▰ 1</span>

> [!quote]
> "A good index is a set of published rules, applied consistently, with no room for discretion to creep in."
>
> — **IOSCO**, *Principles for Financial Benchmarks* (2013)

An index constructed and maintained according to a transparent, pre-defined, and publicly documented set of rules covering universe definition, eligibility, selection, weighting, rebalancing, and corporate action treatment, minimizing discretionary judgment by the index provider.

> [!note]
> All STOXX indices are rules-based, meaning that their methodology is fully codified and published. This transparency is a regulatory requirement under the EU Benchmark Regulation (BMR) and IOSCO Principles for Financial Benchmarks. A rules-based approach ensures replicability, auditability, and consistency, and allows market participants to anticipate index changes before they are officially announced.

> [!tip] Related terms
> [Eligibility Criteria](#eligibility-criteria), [Selection Criteria](#selection-criteria), [Weighting Scheme](#weighting-scheme)

> [!example]- Source excerpts (1)
>
> index was launched in partnership with Bitcoin Suisse, a leading Swiss crypto-financial services
> provider and brings together STOXX’s transparent and **rules-based index** methodology with
> Bitcoin Suisse’s expertise in the crypto space. A blue-chip focus means the index does not just
> select the largest crypto assets by
>
> — [Digital Asset Indices | STOXX](https://stoxx.com/digital-asset-indices)
>

---

## S

### Sector Weighting

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="5 mentions across STOXX & ISS pages (ultra-low)">▰ 5</span>

> [!quote]
> "Diversification is the only free lunch in investing."
>
> — **Harry Markowitz**



The aggregate weight of all constituents classified within a specific industry sector or supersector, reflecting that sector's representation in the index at a given point in time.

> [!note]
> Sector weighting is a fundamental dimension of index risk and return attribution. STOXX uses the ICB (Industry Classification Benchmark) system to classify constituents into industries and supersectors. In a free-float capitalization-weighted index, sector weights emerge organically from constituent market capitalizations. Some STOXX index variants impose sector concentration limits to prevent dominance by a single industry. Investors routinely monitor sector weights to understand the economic exposures embedded in their benchmark.

> [!tip] Related terms
> [Country Weighting](#country-weighting), [Concentration Limit](#concentration-limit), [Weighting Scheme](#weighting-scheme)

> [!example]- Source excerpts (5)
>
> Overall, the Supersector distribution shows a highly diversified index. Figure 4: Super**sector
> weighting**s Asia’s growth story With a population of 1.4 billion, a rising middle class and an
> increasingly important position as a global services and products
>
> — [Indian stocks shine bright, outperforming Asian markets  | Blog posts | STOXX](https://stoxx.com/indian-stocks-shine-bright-outperforming-asian-markets)
>
> f Germany’s corporate sector in those two industries is equally present in both the large and
> small companies segments. Further, the rest of the Super**sector weighting**s show a highly
> diversified index. Figure 4: Super**sector weighting**s Capping alternatives The weighting of
> index constituents is capped at 15%.
>
> — [Exploring SDAX, the benchmark for German small companies | Blog posts | STOXX](https://stoxx.com/exploring-sdax-the-benchmark-for-german-small-companies)
>
> The U.S. and Asia-Pacific are represented by STOXX USA 500 and STOXX Asia/Pacific 600 indices. S E
> C T O R W E I G H T I N G S Europe Versus the **Sector weighting**s of the STOXX Europe 600 skew
> towards defensive sectors, which tend to be more stable U.S.
>
> — [Stoxx Infographic Stoxxeurope600 (PDF), p. 1](https://stoxx.com/wp-content/uploads/2025/06/STOXX_Infographic_STOXXEurope600.pdf)
>
> g ESG considerations into traditional exposures in a measured, pragmatic way — and this ETF was
> designed precisely with that in mind.” Figure 1: Super**sector weighting**s (top 10 of benchmark)
> What makes the iShares EURO STOXX 50 ESG ETF attractive for both retail and institutional
> investors? “The ETF’s methodology of
>
> — [BlackRock’s Thurner on why iShares EURO STOXX 50 ESG ETF is attractive propos...](https://stoxx.com/blackrocks-thurner-on-why-ishares-euro-stoxx-50-esg-etf-is-attractive-proposition-for-both-retail-and-institutional-investors)
>
> nials (“Millennials”) – which seek exposure to these two distinct generations. Our research
> identified vast differences across style characteristics, **sector weighting**s and especially
> performance, with Millennials consistently outpacing the older folks.
>
> — [Mind the (Generation) Gap | Whitepapers | STOXX](https://stoxx.com/mind-the-generation-gap-whitepaper)
>

---

### Selection Criteria

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="59 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 59</span>



The specific quantitative and qualitative rules — beyond basic eligibility — used to rank and choose constituents from the eligible universe, typically based on market capitalization rank, liquidity thresholds, sector representation, or factor scores.

> [!note]
> Selection criteria determine which securities from the eligible universe actually enter the index. For a benchmark like the STOXX Europe 600, selection is primarily by free-float market capitalization rank within size segments (large, mid, small). For thematic or strategy indices, selection may incorporate ESG scores, factor exposures, or fundamental metrics. Buffer rules are applied during selection to manage turnover.

> [!tip] Related terms
> [Eligibility Criteria](#eligibility-criteria), [Buffer Rule](#buffer-rule), [Index Universe](#index-universe), [Selection List](#selection-list)

> [!example]- Source excerpts (5)
>
> The post-IPO age is calculated as the period between the review cutoff date for the **selection
> criteria** and the date of the company’s initial public offering (IPO) or the date on which the
> ordinary shares were listed (Criterion 3). In addition, GEX comp
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF), p. 87](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> 35%, also defined as High Foreign Investment Restrictions. STOXX WORLD EQUITY INDEX METHODOLOGY
> GUIDE 10/37 3. COVERAGE Application of the **selection criteria** for the STOXX World country
> classification in 2022: Criteria Developed Emerging Frontier Economic Development Country GNI per
> capita 25% above the Wo
>
> — [Stoxx World Equity Index Guide (PDF), p. 10](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)
>
> Official close price is the price as of 17:00:00 CET. Index Dissemination Calendar: STOXX Global
> Calendar. INDEX REVIEW 5.3.1. **SELECTION CRITERIA** Assets are selected based on a multi-step
> procedure which seeks to identify the strongest and most representative assets in each eligible
> sector of t
>
> — [Stoxx Digital Asset Guide (PDF), p. 20](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_digital_asset_guide.pdf)
>
> The aim has been to bolster the quality of constituent companies, bring **selection criteria** in
> line with international standards and improve representativeness. The methodology upgrade has
> resulted in widely reported and well-received change
>
> — [DAX’s two-year methodology overhaul cements German benchmark’s standing with ...](https://stoxx.com/daxs-two-year-methodology-overhaul-cements-german-benchmarks-standing-with-investors-issuers-2)
>
> Liquidity requirements For the EUROGOV® indices, no explicit liquidity filter is applied. The
> applied **selection criteria** of the index constituents facilitate the selection of liquid
> constituents due to filtering by issuer, country as well as minimum nominal amount outst
>
> — [Guide To Eurogov Bond Indices (PDF), p. 6](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/Guide_to_EUROGOV_Bond_Indices.pdf)
>

---

### Selection List

<span style="background:red; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1,008 mentions across STOXX & ISS pages (high)">▰▰▰▰▰▰ 1,008</span>



The ordered ranking of eligible securities — typically sorted by free-float market capitalization or another primary criterion — from which the final index constituents are drawn during reconstitution.

> [!note]
> The selection list is the intermediate output of the index construction process, produced after eligibility screening but before the application of buffer rules and final constituent determination. STOXX constructs the selection list at each periodic review by ranking all eligible securities according to the index's primary selection criterion. Buffer rules are then applied to determine which securities are added or retained and which are removed.

> [!tip] Related terms
> [Selection Criteria](#selection-criteria), [Reconstitution](#reconstitution), [Buffer Rule](#buffer-rule)

> [!example]- Source excerpts (5)
>
> cut-off date for the **selection list** and the ADTV data to calculate the weights is the last
> business day of the month preceding the review month. The **selection list** is produced annually.
> Weighting and capping factors: Weight of company i is calculated as following: 3(cid:1839)
> (cid:1827)(cid:1830)(cid:1846)(cid:1
>
> — [Stoxx Index Guide (PDF), p. 305](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> A breach of these criteria means that the stock concerned will not be ranked in the relevant
> monthly **selection list** and until the next index review. The stock will then be removed from
> the index during the index review process. In all of the cases above, the index
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF), p. 17](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> % revenues from involvement in military equipment and services For the resulting list of
> securities, the following steps are applied before the final **selection list** is obtained: 1)
> For each security in the resulting list, an ESG trend score is calculated as follows: ESG trend
> =ESG score − ESG score t t t−1 [PAGE
>
> — [Istoxx Index Guide (PDF), p. 479](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> 78 FILES GUIDE 4.3.4. **Selection List** - Select Dividend Indices The aim of the file is to
> provide the **selection list**s which are produced for Select Dividend Indices with a fixed number
> of constituents in order to determine replacements for any stock deleted from the
>
> — [Index Files Guide 20230619 (PDF), p. 79](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)
>
> Data Content Providers/Sites, Other Clearing and Settlement Services, and Retail Advisory and
> Brokerage Services. The largest 20 constituents in the **selection list**, based on free-float
> market capitalization, make it into the index. Chart 1 shows the ETF industry has outperformed the
> broader US financial sector i
>
> — [Monthly Index News April 2022 (PDF), p. 4](https://stoxx.com/monthly-index-news-april-2022)
>

---

### Simulation

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="26 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 26</span>

> [!quote]
> "All models are wrong, but some are useful."
>
> — **George E.P. Box**, *Empirical Model-Building and Response Surfaces* (1987)



The process of applying an index methodology retroactively to historical data to generate a hypothetical back-tested performance track record for a period before the index was officially launched.

> [!note]
> Simulated (back-tested) data allows index users to evaluate how an index would have performed under various market conditions. STOXX clearly distinguishes between live and simulated data in its publications. It is important to note that simulated performance does not reflect actual trading, does not account for transaction costs, and may incorporate survivorship bias or look-ahead bias. Regulatory standards require clear disclosure when simulated data is presented.

> [!tip] Related terms
> [Base Date](#base-date), [Base Value](#base-value), [Tracking Error](#tracking-error)

> [!example]- Source excerpts (5)
>
> DAX **Simulation** data will be displayed in the New Index Data Distribution System throughout the
> whole **simulation** phase (i.e. from December 18th, 2023 to February 29th, 2024). - Official DAX
> Equity Indices data will only be displayed in the Current Index Data Dis
>
> — [Dax Equity Indices Simulation Phase–From Dec 18 2023 To February 29 2024 (PDF), p. 1](https://www.stoxx.com/document/News/2023/October/DAX_Equity_Indices_Simulation_Phase–from_Dec_18_2023_to_February_29_2024.pdf)
>
> ses to simulate and optimize their manufacturing and supply chains in a virtual environment. The
> applications range from remote monitoring and online **simulation**s, to virtual replicas of
> physical assets — or digital twins. Digital twins: more than just an online **simulation** Digital
> twins are virtual representat
>
> — [The industrial Metaverse – beyond gaming and social media | Blog posts | STOXX](https://stoxx.com/the-industrial-metaverse-beyond-gaming-and-social-media)
>
> On September 30, 2020, the predicted volatility of the STOXX USA 9003 was ‘only’ 21%. We repeated
> the **simulation** with an analysis date of June 22, 2020 when the predicted market volatility was
> 32%.
>
> — [Climate Transition Risk – The Market Impact You Get for the Climate Impact Yo...](https://stoxx.com/climate-transition-risk-the-market-impact-you-get-for-the-climate-impact-you-had)
>
> icial Intelligence, where sub-themes such as Cloud Computing or Semiconductors are mature, but
> some specific segments such as Neuro-Symbolic AI or AI **Simulation** are still in their infancy.
> Effectively, a theme can have a head in one stage and a tail in another. Cryptocurrencies as theme
> and asset class One of
>
> — [How to capture investment themes at different stages of their lifecycle | Blo...](https://stoxx.com/how-to-capture-investment-themes-at-different-stages-of-their-lifecycle)
>
> ated version that excludes Tesla’s stock. Figure 2 – STOXX USA 500 simulated without Tesla In the
> 12 months shown on Figure 2, estimates based on the **simulation** show that Tesla accounted for
> more than 1 percentage point of the benchmark’s gross performance.
>
> — [Tesla’s place in a US stock benchmark | Blog posts | STOXX](https://stoxx.com/teslas-place-in-a-us-stock-benchmark)
>

---

### Systematic Index

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="2 mentions across STOXX & ISS pages (ultra-low)">▰ 2</span>



An index constructed using a transparent, rules-based methodology that systematically targets a specific investment factor, theme, or strategy — such as value, momentum, low volatility, or ESG — rather than simply capturing broad market-capitalization exposure.

> [!note]
> Systematic indices (also called strategy or smart beta indices) go beyond traditional benchmark construction by embedding an investment thesis directly into the index rules. STOXX offers a wide range of systematic indices that select and weight constituents based on factor scores, optimization targets, or thematic criteria. Despite the added complexity, systematic indices adhere to the same governance, transparency, and rules-based standards as traditional benchmark indices.

> [!tip] Related terms
> [Rules-Based Index](#rules-based-index), [Optimization-Based Weighting](#optimization-based-weighting), [Fundamental Weighting](#fundamental-weighting), [Weighting Scheme](#weighting-scheme)

> [!example]- Source excerpts (2)
>
> n risk is going to be at the company level, and bring that to life in an index.” The index
> methodology translates “the CTVaR data into a rules-based, **systematic index** and the key is the
> probability distribution of that data equated into the weights within the companies in the index.”
> By using the CTVaR projections,
>
> — [A view from COP26: navigating the climate transition with investable indices ...](https://stoxx.com/a-view-from-cop26-navigating-the-climate-transition-with-investable-indices)
>
> ince thematic indices attempt to obtain exposure to megatrends as they are evolving. Particular
> risk and return characteristics as key elements Using **systematic index**-based approaches,
> investors may obtain exposure to megatrends that are shaping or expected to shape the future.
>
> — [An Analysis of Thematic Portfolios Construction, Risk and Returns | Blog post...](https://stoxx.com/an-analysis-of-thematic-portfolios-construction-risk-and-returns)
>

---

## T

### Total Return Index

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="25 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 25</span>

> [!quote]
> "The miracle of compounding returns is overwhelmed by the tyranny of compounding costs."
>
> — **John C. Bogle**, *The Little Book of Common Sense Investing* (2007)



A generic term for an index variant that accounts for both price appreciation and the reinvestment of dividends and other cash distributions, encompassing both gross return and net return variants.

> [!note]
> "Total return index" is often used as a shorthand for either the gross or net return version, depending on context. The key distinction from a price return index is that dividends are treated as reinvested (in full or after tax) rather than lost. For performance measurement and fund benchmarking, total return indices are the appropriate comparison because they reflect the full economic return earned by an equity investor.

> [!tip] Related terms
> [Gross Return Index](#gross-return-index), [Net Return Index](#net-return-index), [Price Return Index](#price-return-index)

> [!example]- Source excerpts (5)
>
> CALCULATION The excess return index is calculated as follows: 𝐹 𝐼ER =𝐼ER ⋅ k,t 𝑡 𝑡−1 𝐹 k,t−1 The
> **total return index** is calculated as follows: 𝐹 𝑑 𝐼TR =𝐼TR ⋅( k,t + ⋅𝑅 ) 𝑡 𝑡−1 𝐹 360 f, t−1
> k,t−1 Where: 𝐼ER = Excess return index value on day (t) - Unrounded t-1 value
>
> — [Dax Strategy Index Guide (PDF), p. 34](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)
>
> Sheet “REX Indices” Table format: Column Data Data Attribute Description ID Type Format 1 Index
> REX® index and its respective sub-indices Text 255 2 **Total Return Index** Numeric value of index
> or respective sub-index Number next table 3 Price Index Numeric value of index or respective
> sub-index Number next table 4 Yie
>
> — [Index Files Guide 20230619 (PDF), p. 65](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)
>
> Please consult ICE Bond Index Methodologies’ Guide at www.ice.com for further details around
> transaction cost calculation. For **total return index**, the monthly adjustment involves the
> reinvestment of coupon payments in the overall portfolio at the reference date fixed for any
> adjustment of the i
>
> — [Guide To Eurogov Bond Indices (PDF), p. 14](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/Guide_to_EUROGOV_Bond_Indices.pdf)
>
> IEW The STOXX Futures Replication indices aim to replicate the performance of STOXX Indices by
> simulating an investment into the a STOXX Futures Roll **Total Return index**, adjusted for
> dividends. Index types, currencies, base values and dates: Index Types Currency Base value and
> date EURO STOXX 50 Quanto Futures Price,
>
> — [Stoxx Strategy Guide (PDF), p. 70](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_strategy_guide.pdf)
>
> 2007 − Changes to withholding tax − Changes to the adjustment of the DAXglobal Emerging 11 **total
> return index** using net dividends Effective Version 1.11 A ug. 2007 − Change in the calculation
> frequency for the DAXglobal BRIC Effective Version 1.10 J uly 2007
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF), p. 119](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>

---

### Tracking Error

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="501 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 501</span>

> [!quote]
> "The biggest risk is not volatility but the permanent loss of capital."
>
> — **Benjamin Graham**, *The Intelligent Investor* (1949)



The annualized standard deviation of the difference in returns between a portfolio (or fund) and its benchmark index, measuring the consistency of replication.

> [!note]
> Tracking error is the primary metric for evaluating how closely an index-tracking fund matches its benchmark. A tracking error of zero would indicate perfect replication. In practice, tracking error arises from transaction costs, cash drag, sampling, dividend timing, and corporate action handling. Index construction choices — such as capping frequency, buffer rules, and review frequency — directly influence the tracking error experienced by funds following the index.

$$
\text{TE} = \sigma\!\left(R_p - R_b\right) \times \sqrt{252}
$$

Where $R_p$ and $R_b$ are daily portfolio and benchmark returns, respectively, and 252 is the standard number of trading days per year.

> [!tip] Related terms
> [Turnover](#turnover), [Rebalancing](#rebalancing), [Simulation](#simulation)

> [!example]- Source excerpts (5)
>
> This article provides a high-level refresher of what **tracking error** means, and how we can
> embed it directly into portfolio construction. When we design a benchmarked portfolio, every
> design choice that takes us away f
>
> — [Tracking Error 101: The Intuition Behind Measurement and Control | Whitepaper...](https://stoxx.com/tracking-error-101-the-intuition-behind-measurement-and-control)
>
> ESG score of a sustainable portfolio rises, the investment manager implements a bigger deviation
> in weights vs. the benchmark, and takes on a higher **tracking error**, in order to achieve their
> overarching objective. Figure 1 shows this pattern in the form of ESG score vs. realized
> **tracking error**.
>
> — [Tracking error: making sense of a key investment statistic | Blog posts | STOXX](https://stoxx.com/tracking-error-making-sense-of-a-key-investment-statistic)
>
> )(cid:2911)(cid:2928) (cid:2886)(cid:2911)(cid:2929)(cid:2915) STOXX INDEX METHODOLOGY GUIDE
> 298/639 16. STOXX RISK BASED INDICES For the **tracking error** constrained version it is defined
> as: H ≥H ∙60% (cid:2897)(cid:2919)(cid:2924)(cid:2906)(cid:2911)(cid:2928)
> (cid:2886)(cid:2911)(cid:2929)(cid:2915)
>
> — [Stoxx Index Guide (PDF), p. 298](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> For much of 2022, **tracking error** has been above the 10-year median of 14% (Figure 9). After
> reaching a year-to-date peak in May, **tracking error** declined until last week, when it
> skyrocketed following the beating of FAANGs stocks on earnings announcements.
>
> — [From pandemic profiteers to stagflation hostages: FAANGs stranglehold weighs ...](https://stoxx.com/from-pandemic-profiteers-to-stagflation-hostages-faangs-stranglehold-weighs-on-us-market)
>
> — the usage of constraints allows for the efficient management of these trade-offs. Here, we will
> examine the compromises and pay-offs of sector and **tracking error** (TE) constraints. Industry
> caps The STOXX Factor Indices embed a 5% active weight constraint on ICB Industries (Level 1),
> meaning the industry weight
>
> — [STOXX Factor Indices Q3 Spotlight – To Constrain or not to Constrain | Blog p...](https://stoxx.com/stoxx-factor-indices-q3-spotlight)
>

---

### Turnover

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="668 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 668</span>

> [!quote]
> "The real cost of indexing is not the management fee — it is the turnover and the market impact of rebalancing trades."
>
> — **John C. Bogle**, *Common Sense on Mutual Funds* (1999)

The percentage of an index's total weight that changes at a rebalancing or reconstitution event, measured as the sum of all absolute weight changes divided by two.

> [!note]
> Turnover quantifies the trading activity required to maintain an index-tracking portfolio. Higher turnover implies greater transaction costs, which erode net returns for passive investors. STOXX index construction rules — particularly buffer rules and review frequency — are designed with turnover management as an explicit objective. Turnover is typically expressed as a one-way figure.

$$
\text{Turnover} = \frac{1}{2} \sum_{i=1}^{n} \left| w_i^{\text{new}} - w_i^{\text{old}} \right|
$$

Where $w_i^{\text{old}}$ and $w_i^{\text{new}}$ are the weights before and after the rebalancing event.

> [!tip] Related terms
> [Rebalancing](#rebalancing), [Buffer Rule](#buffer-rule), [Tracking Error](#tracking-error), [Review Frequency](#review-frequency)

> [!example]- Source excerpts (5)
>
> Market participants will be notified of such changes in a timely manner. 4.4.2. **TURNOVER** RATIO
> The annualized **turnover** ratio is defined as the median value of the daily traded volume to the
> free- float shares ratio over the previous 12 mo
>
> — [Stoxx World Equity Index Guide (PDF), p. 17](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)
>
> Because today there is a high information decay – faster, real-time news becomes old news soon –
> the rate of **turnover** becomes a crucial component. The iSTOXX Factor indices have a monthly
> **turnover** limit of 25% of their constituents’ value, a marginal point under whic
>
> — [Evaluating the true cost of momentum investing | Blog posts | STOXX](https://stoxx.com/evaluating-the-true-cost-of-momentum-investing)
>
> r Because the EURO STOXX 50 ESG Index is reviewed and rebalanced every quarter, as opposed to
> annually as is the benchmark, the former sees increased **turnover** as the portfolio accommodates
> changes in weights and constituency. Venkataraman and Williams estimate that the rolling 12-month
> **turnover** for the ESG
>
> — [New Whitepaper Looks at Trading Characteristics of EURO STOXX 50 ESG Index | ...](https://stoxx.com/new-whitepaper-looks-at-trading-characteristics-of-euro-stoxx-50-esg-index)
>
> December 3, 2021. 1 Initial eligibility: minimum trading volume over the last 12 months of either
> EUR 1 billion at the Frankfurt Stock Exchange or a **turnover** rate of 20%. Continued
> eligibility: a minimum trading volume over the last 12 months of either at least EUR 0.8 billion
> or a **turnover** rate of 10%.
>
> — [DAX Index Grows to 40 Constituents – Looking at Impact on Market Cap and Liqu...](https://stoxx.com/dax-index-grows-to-40-constituents-looking-at-impact-on-market-cap-and-liquidity)
>
> AVERAGE DAILY TRADED VALUE Average daily traded value refers to the average of the daily
> **turnover**s of a specific stock recorded over a defined period of time. The following applies to
> liquidity-weighted indices: All prices and traded quantities av
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF), p. 24](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>

---

## W

### Weighting Scheme

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="570 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 570</span>

> [!quote]
> "Capitalization weighting is the only weighting method that is both self-rebalancing and reflects the aggregate opinion of all market participants."
>
> — **William F. Sharpe**, *Capital Asset Prices* (1964)

The methodology that determines how the index's total value is allocated across its constituents, defining each security's influence on the index level; common schemes include free-float market-capitalization weighting, equal weighting, price weighting, and fundamental weighting.

> [!note]
> The weighting scheme is one of the most consequential design decisions in index construction. It determines the risk-return profile, sector tilts, capacity, and rebalancing needs of any portfolio tracking the index. STOXX offers indices across all major weighting schemes, though free-float market-capitalization weighting is the default for its flagship benchmark families. The choice of weighting scheme directly affects turnover, tracking error, and the economic exposures embedded in the index.

> [!tip] Related terms
> [Free-Float Market Capitalization Weighting](#free-float-market-capitalization-weighting), [Market Capitalization Weighting](#market-capitalization-weighting), [Equal Weighting](#equal-weighting), [Fundamental Weighting](#fundamental-weighting), [Price Weighting](#price-weighting)

> [!example]- Source excerpts (5)
>
> The index universe is defined as all stocks of the developed markets in Europe, North America and
> the Asia/Pacific region as defined in section 4.3. **Weighting scheme**: The index is weighted
> according to free-float market capitalization. Base value and date: 1,000 on December 31, 1991.
> Index types and currencies: Pr
>
> — [Stoxx Index Guide (PDF), p. 103](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> STOXX offers customization in almost unlimited forms for example in terms of component selection,
> **weighting scheme**s and personalized calculation methodologies. 3 gr. div. yield is calculated
> as gr.
>
> — [Sx50Ugv (PDF), p. 2](https://www.stoxx.com/document/Indices/Factsheets/2022/December/SX50UGV.pdf)
>
> Oil & Gas, Thermal Coal, and Nuclear Power are also excluded. Universe: The index universe is
> defined as all stocks from the STOXX Global 1800 index **Weighting scheme**: The indices are
> price-weighted with a weighting factor based on the inverse of the historical volatility (maximum
> between 3-month and 12-month histo
>
> — [Istoxx Index Guide (PDF), p. 542](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> NATO countries have called to boost defense investment from 2% of gross domestic product to
> 3.5%.[2] Selection and **weighting scheme** Companies in the STOXX Europe All Country All Cap
> index are assessed by their military equipment and services revenue, based on ISS ESG research.
>
> — [BlackRock launches Europe Defence UCITS ETF tracking STOXX index | Blog posts...](https://stoxx.com/blackrock-launches-european-defence-ucits-etf-tracking-stoxx-index)
>
> The STOXX Europe 600 ESG-X shares its benchmark’s rules, sector composition and methodology –
> including the same transparent free-float market-cap **weighting scheme**. This results in a
> similar risk-return profile and a low tracking error, and enables familiarized investors to easily
> implement and adopt an ESG-scre
>
> — [Introducing STOXX ESG-X | Blog posts | STOXX](https://stoxx.com/introducing-stoxx-esg-x)
>
