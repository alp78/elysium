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

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="9 mentions across STOXX & ISS pages (low)">▰▰ 9</span>


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
> > [!quote] Stoxx Index Guide (PDF)
> > STOXX INDEX METHODOLOGY GUIDE 464/639 17. STOXX THEMATIC INDICES » Minimum liquidity: 3-month median daily trading volume (MDTV) greater than one million USD » Minimum size: **Adjusted free-float market capitalization** greater than 200 million USD » Multiple share lines: in case a company is present with multiple listings and/or a DR line and/or multiple share classes, all of the lines are eligibl...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> > [!quote] Stoxx Index Guide (PDF)
> > STOXX INDEX METHODOLOGY GUIDE 464/639 17. STOXX THEMATIC INDICES » Minimum liquidity: 3-month median daily trading volume (MDTV) greater than one million USD » Minimum size: **Adjusted free-float market capitalization** greater than 200 million USD » Multiple share lines: in case a company is present with multiple listings and/or a DR line and/or multiple share classes, all of the lines are eligibl...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> > [!quote] Istoxx Index Guide (PDF)
> > s designed to minimize G the sum of the squares of the relative errors (SSE) over all the assets in the Target Portfolio, where the relative error for an asset is the difference between its index and Target Portfolio weights E scaled by the Target Portfolio weight. M The Target portfolio is the FOL-**adjusted free-float market capitalization**-weighted portfolio, constructed as follows: C 1. Start ...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>

---

### Announcement Date

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="30 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 30</span>


> The calendar date on which an index provider publicly discloses the results of a periodic review, including additions, deletions, and share or free-float factor changes, before they become effective.

The announcement date gives market participants advance notice of upcoming index changes so they can prepare trades and manage tracking portfolios. STOXX typically announces review changes several trading days before the effective date. The gap between announcement and implementation is critical for reducing market impact and allowing orderly rebalancing by passive funds.


- [Dax Equity Calculation Guide 20231002 (PDF)](https://www.stoxx.com/document/News/2023/October/DAX%20Equity%20Calculation%20Guide_20231002.pdf)
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
- [Hong Kong Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2022/asiapacific/Hong-Kong-Voting-Guidelines.pdf)
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)


> [!example]- Source excerpts (5)
>
> > [!quote] Dax Equity Calculation Guide 20231002 (PDF)
> > based on the most recent available data. The final data are published on the quarterly underlying data **announcement date**s and implemented on the quarterly implementation dates. The review cut-off date for free float and number of shares data is the trading day prior to the quarterly underlying data **announcement date**, i.e. usually the Thursday before the second Friday of the review month. Data a...
>
> — [Dax Equity Calculation Guide 20231002 (PDF)](https://www.stoxx.com/document/News/2023/October/DAX%20Equity%20Calculation%20Guide_20231002.pdf)
>
> > [!quote] Stoxx Index Guide (PDF)
> > gy of STOXX TM Style indices and STOXX Strong Style indices: parts of the methodologies have been rewritten and enriched with additional details to better and more transparently represent the actual review process.The methodology implementation remains unaltered. March 2018 (2): Change of component **announcement date**s for major blue-chip and major benchmark indices in section 5.3; change of revi...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> > [!quote] Detailed Overview Of Equity Index Calculation Changes (PDF)
> > can be given. The standard notice later and effective the next trading day after period of 2 trading days will be extended such implementation. that the effective date will be aligned with the review » All other applicable changes are announced on effective date. the next quarterly underlying data **announcement date**, implemented on the quarterly implementation date and effective the next trading...
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>
> > [!quote] Hong Kong Voting Guidelines (PDF)
> > ng categories: (i) the ultimate controller, controlling shareholder and/or related parties controlled by them; (ii) investors who will obtain control over the company after the private placement; and (iii) strategic investors, the pricing reference date can be either the corresponding board meeting **announcement date**, the shareholder meeting **announcement date**, or the first day of the share issua...
>
> — [Hong Kong Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2022/asiapacific/Hong-Kong-Voting-Guidelines.pdf)
>
> > [!quote] Istoxx Index Guide (PDF)
> > » April 2022(2): Addition of the 3 iSTOXX on Single Stock Indices, iSTOXX® Eurozone ESG 50 NR Decrement 5% Index and EURO iSTOXX 50 ESG NR Decrement 4.75% Index » April 2022(3): Addition of the iSTOXX Europe 600 Oil & Gas Futures Roll TR Decrement 5% Index » April 2022(4): Change in Underlying Data **Announcement date** to five days for the iSTOXX Europe Next Dividend Low Risk 50 Index, iSTOXX Euro...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
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

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="153 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 153</span>


> The reference calendar date from which an index's historical performance begins, serving as the temporal anchor for the index level series.

The base date is the starting point of an index's time series. On this date the index is assigned its base value (e.g., 100 or 1,000), and all subsequent index levels are expressed relative to this starting point. Choosing a meaningful base date allows users to interpret index returns as cumulative performance since inception. STOXX indices typically specify both a base date and a base value in their rulebooks.

> [!tip] Related terms
> [[#Base Value]], [[#Index Level]]

> [!example]- Source excerpts (5)
>
> > [!quote] Stoxx Index Guide (PDF)
> > STOXX INDEX METHODOLOGY GUIDE 62/639 7. STOXX BENCHMARK INDICES (BMI) Weighting scheme: The indices are weighted according to free-float market capitalization. Base values and dates: The following base values and dates apply: 100 on January 31, 2011, except for STOXX USA 900, which has a **base date** of 15.03.2002 and base value as per the vendor code sheet. For a complete list please consult the ...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> > [!quote] Detailed Overview Of Equity Index Calculation Changes (PDF)
> > = Number of shares of company i on the i0 trading day before the first inclusion in the index q = Number of shares of company i at iT time T t = calculation time of the index K = Index-specific chaining factor valid as T of chaining date T T = Date of the last chaining Base = value of the index at **base date** The formula set out below is equivalent in analytic terms, but designed to achieve relat...
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>
> > [!quote] Sx5Evbt (PDF)
> > adjusted. To learn more about the adjustment level and the calculation formula, please see our rulebook: Review frequency End-of-day: 7:15 pm CET www.stoxx.com/indices/rulebooks.html Calculation/distribution 100 as of Oct. 18, 2005 Calculation hours Available daily back to Oct. 18, 2005 Base value/**base date** Jun. 1, 2011 Versions and symbols Index ISIN Symbol Bloomberg Reuters Excess Return EUR ...
>
> — [Sx5Evbt (PDF)](https://www.stoxx.com/document/Indices/Factsheets/2020/May/SX5EVBT.pdf)
>
> > [!quote] Istoxx Index Guide (PDF)
> > HE GUIDE BOOK » September 2021 (7): Addition of the iSTOXX Univest Sustainable World Index. » October 2021: Methodology change for iSTOXX Northern Trust Indices. » October 2021(2): Deletion of iSTOXX Europe Minimum Variance and STOXX Europe Minimum Variance High Dividend Indices. » October 2021(3): **Base date** update for iSTOXX Global ESG 120 Decrement Index. » October 2021(4): Addition of the iS...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> > [!quote] Guide To Eurogov Bond Indices (PDF)
> > 0A0S3P68 3LEW Price DE000A0S3P19 3LER Deutsche Börse EUROGOV Germany 3-5 Total Return DE000A0S3P76 3LEX Price DE000A0S3P27 3LES Deutsche Börse EUROGOV Germany 5-10 Total Return DE000A0S3P84 3LEY Price DE000A0S3P35 3LET Deutsche Börse EUROGOV Germany 10+ Total Return DE000A0S3P92 3LEZ 3.3. BASIS The **base date** of EUROGOV® indices is 31 January 1999 with a base value of 100. 1 Each inclusive matur...
>
> — [Guide To Eurogov Bond Indices (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/Guide_to_EUROGOV_Bond_Indices.pdf)
>

---

### Base Value

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="716 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 716</span>


> The numerical level assigned to an index on its base date, from which all subsequent index levels are derived as a ratio of current aggregate market value to the original aggregate market value.

The base value is an arbitrary scaling constant — commonly set to 100, 1,000, or 5,000 — that makes the index level easy to read and compare. It has no economic meaning in itself; it merely anchors the level on the base date. Every STOXX index rulebook specifies both the base date and the base value, enabling users to compute cumulative returns over any period.

> [!tip] Related terms
> [[#Base Date]], [[#Index Level]], [[#Divisor]]

> [!example]- Source excerpts (5)
>
> > [!quote] Stoxx Index Guide (PDF)
> > STOXX INDEX METHODOLOGY GUIDE 62/639 7. STOXX BENCHMARK INDICES (BMI) Weighting scheme: The indices are weighted according to free-float market capitalization. **Base value**s and dates: The following **base value**s and dates apply: 100 on January 31, 2011, except for STOXX USA 900, which has a base date of 15.03.2002 and base value as per the vendor code sheet. For a complete list please consult the ...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> > [!quote] Stoxx Strategy Guide (PDF)
> > that the returns from both the price appreciation of the underlying constituents and their overall distributions to shareholders are reflected, while at the same time deducting on a daily basis the funding cost of the futures contract to account for the cost of funding of the futures position. The **base value** of the index is such that the index level equates the one of the EURO STOXX 50 Price in...
>
> — [Stoxx Strategy Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_strategy_guide.pdf)
>
> > [!quote] Dax Strategy Index Guide (PDF)
> > ated real-time between 09:00 - 19:15 CET Europe. On roll dates, the index will not be disseminated intraday after the old DAX call option ceases trading at 13:00 CET until 15:00 CET, after which, the calculation shall follow the respective non-roll day calculations based on the new DAX call option. **Base Value**s and Dates: 100 as of January 18, 2019 3.3.2. CALCULATION DAX Covered Call ATM index c...
>
> — [Dax Strategy Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)
>
> > [!quote] Sx5Evbt (PDF)
> > -day may be adjusted. To learn more about the adjustment level and the calculation formula, please see our rulebook: Review frequency End-of-day: 7:15 pm CET www.stoxx.com/indices/rulebooks.html Calculation/distribution 100 as of Oct. 18, 2005 Calculation hours Available daily back to Oct. 18, 2005 **Base value**/base date Jun. 1, 2011 Versions and symbols Index ISIN Symbol Bloomberg Reuters Excess...
>
> — [Sx5Evbt (PDF)](https://www.stoxx.com/document/Indices/Factsheets/2020/May/SX5EVBT.pdf)
>
> > [!quote] Stoxx Digital Asset Guide (PDF)
> > performance of those assets which are deemed to be ‘blue chip’ in terms of quality, activity, robustness and financial strength. INDEX INFORMATION The index is calculated as a price weighted index with capped weighting factors, in accordance with Laysperes formula as described in section 3.8. Index **Base Value**s and Base Dates: 1000 as of 22/03/2021. Index Types and Currencies: Price Return in US...
>
> — [Stoxx Digital Asset Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_digital_asset_guide.pdf)
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
> > [!quote] Monthly Index News September 2019 (PDF)
> > September 2019 ESG-X Indices Key points The STOXX ESG-X Indices performed largely in line with their benchmarks during September. The STOXX® Global 1800 ESG-X Index underperformed by less than 1 **basis point**. The ESG-X indices are versions of traditional, market-capitalization-weighted benchmarks that observe standard responsible exclusions of leading asset owners. They incorporate basic norm- a...
>
> — [Monthly Index News September 2019 (PDF)](https://stoxx.com/monthly-index-news-september-2019)
>
> > [!quote] Ukraine crisis: Looking at recent market performance through a thematic inves...
> > an alter investors’ risk appetite. Schon runs a stress test2 on the Global Smart City Infrastructure Index to assess the hypothetical effect by sector of five macro shocks: - a rise of 0.5% in the 10-year US Treasury nominal yield - a rise of 0.5% in the break-even inflation rate - an additional 25-**basis point** hike in the Fed Funds target rate beyond what is priced through 2022 - a 20% drop in ...
>
> — [Ukraine crisis: Looking at recent market performance through a thematic inves...](https://stoxx.com/ukraine-crisis-looking-at-recent-market-performance-through-a-thematic-investing-lens) — "WHITEPAPER"
>
> > [!quote] Stocks tumble most since 2020 in April amid interest-rate concerns | Blog pos...
> > iverse of stocks. 1 All results are total returns before taxes unless specified. 2 Throughout the article, all European indices are quoted in euros, while global, North America, US, Japan and Asia/Pacific indices are in dollars. 3 CNBC, ‘Powell says taming inflation ‘absolutely essential,’ and a 50 **basis point** hike possible for May,’ April 21, 2022. 4 Figures in parentheses show last month’s gr...
>
> — [Stocks tumble most since 2020 in April amid interest-rate concerns | Blog pos...](https://stoxx.com/stocks-tumble-most-since-2020-in-april-amid-interest-rate-concerns) — "WHITEPAPER"
>
> > [!quote] New Whitepaper Looks at Trading Characteristics of EURO STOXX 50 ESG Index | ...
> > raises the cost of replicating the index versus the benchmark. The authors therefore take to estimate the cost of switching out of the benchmark and into the ESG index at each quarterly review, expressing it as a percentage of the portfolio’s value.4 Since launch the cost has remained well below 1 **basis point** (bp) on all occasions but one (Figure 2). Figure 2 – Estimated cost of switching to ES...
>
> — [New Whitepaper Looks at Trading Characteristics of EURO STOXX 50 ESG Index | ...](https://stoxx.com/new-whitepaper-looks-at-trading-characteristics-of-euro-stoxx-50-esg-index) — "WHITEPAPER"
>
> > [!quote] Qontigo whitepaper examines the sustainability accomplishments of ESG funds |...
> > roduce better active exposure to the ESG Score and the ESG Risk Score metrics increases as the portfolio goes up the tracking error scale, the study showed. A portfolio with 200 basis points of tracking error, regardless of industry constraints, has about twice the exposure to the ESG Score of a 50-**basis point** portfolio, and more than three times the exposure to the ESG Risk Score. Loosening th...
>
> — [Qontigo whitepaper examines the sustainability accomplishments of ESG funds |...](https://stoxx.com/qontigo-whitepaper-examines-the-sustainability-accomplishments-of-esg-funds) — "WHITEPAPER"
>

---

### Benchmark Index

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="177 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 177</span>


> A broadly representative, rules-based index that serves as a standard reference point for measuring the performance of investment portfolios, defining asset allocation, or constructing derivative instruments.

Benchmark indices are the flagship products of index providers. STOXX benchmark indices — such as the EURO STOXX 50, STOXX Europe 600, and STOXX Global 1800 — are designed to capture the performance of a defined market segment with high coverage and investability. They underpin trillions of euros in passive assets, ETFs, futures, and options. Benchmark status typically requires broad market acceptance, regulatory compliance (e.g., EU BMR), and transparent, rules-based construction.

> [!tip] Related terms
> [[#Rules-Based Index]], [[#Index Universe]], [[#Free-Float Market Capitalization Weighting]]

> [!example]- Source excerpts (5)
>
> > [!quote] German Benchmark Index DAX Will be Strengthened by Additional Qualification C...
> > ne with international standards and new qualification criteria for the German **benchmark index**, which tracks the largest listed companies on the German capital market. Stephan Flaegel, Global Head of Benchmarks & Indices The main results on changing the index rulebook are: - From September 2021, the **benchmark index** DAX will be expanded by ten members, to a total of 40 constituents. This means th...
>
> — [German Benchmark Index DAX Will be Strengthened by Additional Qualification C...](https://stoxx.com/german-benchmark-index-dax-will-be-strengthened-by-additional-qualification-criteria-and-harmonization-with-international-standards) — "WHITEPAPER"
>
> > [!quote] STOXX Europe 600 Paris-Aligned Benchmark Index Licensed To Franklin Templeton...
> > ies: Andreas von Brevern +49 (0) 69 211 14284 Rafaelle Lennox, Vice President, ETF Product Strategy, Franklin Templeton, commented: “We are delighted to collaborate with Qontigo and are pleased to be the first provider to offer a Paris Aligned Climate ETF tracking the STOXX Europe 600 Paris-Aligned **Benchmark Index**. We believe that the STOXX Europe 600 is the key parent European benchmark for ou...
>
> — [STOXX Europe 600 Paris-Aligned Benchmark Index Licensed To Franklin Templeton...](https://stoxx.com/stoxx-europe-600-paris-aligned-benchmark-index-licensed-to-franklin-templeton) — "WHITEPAPER"
>
> > [!quote] Stoxx Index Guide (PDF)
> > owing constraints, using the selection list created in the previous section. The resulting number of index constituents may be lower than the number of securities on the selection list. The following constraints aim to ensure tradability and diversification. ESG Performance Score: For each separate **benchmark index**, an ESG Z-Score is computed by subtracting off the cap-weighted mean ESG performa...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> > [!quote] Istoxx Index Guide (PDF)
> > gion> **Benchmark index**. E.g. the STOXX Europe 600 serves as basis for the STOXX Europe Large 200 Index. For the iSTOXX Börsen-Zeitung Global 600 Index the three “<Regional> Large 200” indices are aggregated (North America, Asia/Pacific, Europe). Selection list: After the review of the STOXX regional **Benchmark Index** has been conducted according to chapters 7.1 and 7.2 in the STOXX Index Methodolo...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> > [!quote] Index Files Guide 20230619 (PDF)
> > cenario Text 255 energy-model/sustainable-development-scenario" for CTB/PAB indices. This value is reported only if the benchmark is a PAB or Share_of_Benchmark_in_Investable_ CTB index. It shows the share of the free float market 65 Number 2 Universe_Free_Float_Market_Capitalization cap of PAB/CTB **benchmark index** in the free float market cap of parent index. Date when report is produced and th...
>
> — [Index Files Guide 20230619 (PDF)](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)
>

---

### Buffer Rule

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="71 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 71</span>


> A threshold band applied during periodic reviews that allows existing constituents to remain in the index even if they marginally fail to meet the standard selection criteria, thereby reducing unnecessary turnover.

Buffer rules create a zone of tolerance around the selection threshold. For example, an index that selects the top 50 stocks by market capitalization might retain a current constituent as long as it ranks within the top 60, while a new entrant must rank within the top 40 to be added. This asymmetry prevents excessive churn caused by securities oscillating around the selection boundary, which would increase transaction costs for tracking portfolios.

> [!tip] Related terms
> [[#Fast Entry Rule]], [[#Fast Exit Rule]], [[#Reconstitution]], [[#Turnover]]

> [!example]- Source excerpts (5)
>
> > [!quote] Stoxx Index Guide (PDF)
> > r code sheet on the website22. 9.1.2. INDEX REVIEW Component selection: There is a minimum liquidity requirement for components: to be eligible, the 3-month average daily trading volume has to be at least EUR 1 million. Components are selected based on the free-float market capitalization and a 10% **buffer rule** applies for the ranking. If the number of stocks selected is still below the required...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> > [!quote] Stoxx Index Guide (PDF)
> > r code sheet on the website22. 9.1.2. INDEX REVIEW Component selection: There is a minimum liquidity requirement for components: to be eligible, the 3-month average daily trading volume has to be at least EUR 1 million. Components are selected based on the free-float market capitalization and a 10% **buffer rule** applies for the ranking. If the number of stocks selected is still below the required...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> > [!quote] Istoxx Index Guide (PDF)
> > tum score of each stock is calculated using the following formula: 1 𝑀𝑜𝑚𝑒𝑛𝑡𝑢𝑚 𝑆𝑐𝑜𝑟𝑒 = 𝑖 1+𝑒𝑥𝑝(−2𝑎𝑑̂𝑗𝑀𝑜𝑚 ) 𝑖 Composition list: The top 300 (Japan) and 600 (Global/Global ex Japan) stocks with the highest momentum score are selected for the respective index. In order to reduce turnover, the following **buffer rule**s are applied. Targeted number of Upper buffer bound Lower buffer bound constituents J...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> > [!quote] Stoxx World Equity Index Guide (PDF)
> > lest security has a full company market cap greater (smaller) than the upper (lower) global consistency bound, securities with full company market cap greater (smaller) or equal than the upper (lower) global consistency bound are added (removed). - Turnover buffer: To reduce turnover, the following **buffer rule** is applied to existing components: o Only securities with LCP lower than 68% can be n...
>
> — [Stoxx World Equity Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)
>
> > [!quote] STOXX Europe 600 index – The continent&#039;s benchmark | Blog posts | STOXX
> > e widest coverage among flagship European benchmarks in the industry in terms of market capitalization and number of components.[3] A liquidity filter[3] supports the tradability of the index’s portfolio, while a quarterly review based on clear rules gives it a continuous pulse on market changes. A **buffer rule** ensures a moderate turnover at each review. The STOXX Europe 600’s free-float market ...
>
> — [STOXX Europe 600 index – The continent&#039;s benchmark | Blog posts | STOXX](https://stoxx.com/stoxx-europe-600-index-the-continents-benchmark) — "WHITEPAPER"
>

---

## C

### Capping

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="925 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 925</span>


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
> > [!quote] DAX capping will be adjusted to 15 per cent | Press releases | STOXX
> > the **capping** in the DAX index family from 10 to 15 per cent. This was preceded by a broad market consultation which lasted from 11 October to 8 November 2023. The responses reflected a wide range of considerations from different stakeholders. A majority of participants were in favour of raising the **capping** limit to 15 percent. Media Contact Andreas von Brevern +49 (0) 69 211 14284 With this capp...
>
> — [DAX capping will be adjusted to 15 per cent | Press releases | STOXX](https://stoxx.com/dax-capping-will-be-adjusted-to-15-per-cent) — "WHITEPAPER"
>
> > [!quote] DAX: A trading impact analysis of the 15% stock cap | Blog posts | STOXX
> > ion concluded that the 15% cap most appropriately allows passive investors to comply with the regulation. To continue to provide active investors with benchmarks that are aligned with the active 10% UCITS limit, STOXX this year introduced the DAX UCITS Capped index series. For more on the automatic **capping** process, please see Section 5.10 of the DAX Equity Index Methodology Guide. Conclusion A ...
>
> — [DAX: A trading impact analysis of the 15% stock cap | Blog posts | STOXX](https://stoxx.com/dax-a-trading-impact-analysis-of-the-15-stock-cap) — "WHITEPAPER"
>
> > [!quote] Istoxx Index Guide (PDF)
> > G score and the top 600 companies make up the Composition List. In the event that two companies have identical ESG scores, the constituent with the higher free-float market capitalization is given priority. Review frequency: The components are reviewed annually in September. Shares, Free Float, and **Capping** are reviewed quarterly. For the **capping** procedure, the benchmark is defined as the new co...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> > [!quote] Stoxx Index Guide (PDF)
> > s SRI Indices July 2023(2): Change in the name of STOXX Biodiversity Broad Market Index to ISS STOXX Biodiversity Broad Market Indices July 2023(3): Methodology clarification under Step 4 of ISS STOXX Biodiversity Focus SRI Indices July 2023(4): Addition of 2 sub-sections ‘Anticipated intra-quarter **capping** due to upcoming corporate actions’ & ‘Anticipated intra-quarter **capping** due to upcoming c...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> > [!quote] Sri International Policy Updates (PDF)
> > ing boardroom composition. While the majority of the countries covered in the region lack a legal framework regarding independent director tenure limits, Argentina, Brazil, and Peru have recently adopted hard and/or soft laws with references to tenure. Argentina has recently implemented a hard law, **capping** independent directors' tenures at 10 years; any director with a tenure greater than 10 ye...
>
> — [Sri International Policy Updates (PDF)](https://www.issgovernance.com/file/policy/2019/specialty/SRI-International-Policy-Updates.pdf)
>

---

### Capping Factor

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="110 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 110</span>


> A multiplicative coefficient applied to a constituent's weight at each rebalancing to enforce the index's maximum weight constraint, where a value of 1.0 means no adjustment and values below 1.0 indicate the constituent has been scaled down.

The capping factor is the operational mechanism through which capping is implemented. STOXX calculates these factors during each review or capping event and publishes them alongside share counts and free-float factors. The capped weight of a constituent equals its uncapped weight multiplied by its capping factor.

$$
w_i^{\text{capped}} = \text{CF}_i \times w_i^{\text{uncapped}}, \quad 0 < \text{CF}_i \le 1
$$

> [!tip] Related terms
> [[#Capping]], [[#Free-Float Factor]], [[#Divisor Adjustment]]

> [!example]- Source excerpts (5)
>
> > [!quote] Stoxx Index Guide (PDF)
> > weighted average, if it is larger than that average. 5.16.3. **CAPPING FACTOR**S THAT IMPLEMENT FOREIGN OWNERSHIP RESTRICTIONS The foreign restrictions adjusted free float is implemented via a **capping factor** in the sense of Section 4.1 General Definitions of the STOXX Reference Calculations Guide. The capping factor is defined as Capping factor = foreign restrictions adjusted free float / free float.
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> > [!quote] Istoxx Index Guide (PDF)
> > st dividend yield) stocks are selected in the index. Review frequency: The reviews are conducted on a quarterly basis in March, June, September and December. The review cut-off date for the underlying data is the last calculation day of February, May, August and November respectively. Weighting and **capping factor**s: Target weights are calculated based on the inverse of the historical volatility ...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> > [!quote] Stoxx World Equity Index Guide (PDF)
> > (i.e. shares, free-floats and cap factors) are announced after close on the seventh dissemination day prior to the review implementation. This applies only for the STOXX World AC Universal All Cap Index, and the derived cap weighted benchmark indices, described in Chapter 6. For the calculation of **capping factor**s, the closing prices on the dissemination day before the announcements are used. Di...
>
> — [Stoxx World Equity Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)
>
> > [!quote] DAX - STOXX
> > e to the DAX Equity Indices for a complete overview Diversified across sectors DAX is well diversified across sectors and generally covers over three quarters of the aggregated market cap of companies listed on the Regulated Market of FSE Well balanced Diversification is achieved by incorporating a **capping factor** of 15% at component level, which ensures that no component can dominate the index ...
>
> — [DAX - STOXX](https://stoxx.com/index/1-dax-total-return-eur-dax-de0008469008) — "WHITEPAPER"
>
> > [!quote] Index Files Guide 20230619 (PDF)
> > _Key Unique identifier of the constituent Text 6 12 ISIN Constituent ISIN Text 12 13 Instrument_Name Constituent name Text 50 14 Currency Constituent ISO currency code Text 3 15 Shares Number of the shares of the constituent Number 0 16 Free_Float Free float of the constituent Number 4 17 Capfactor **Capping factor** of the constituent Number 7 18 Weightfactor factor used to calculate units in pric...
>
> — [Index Files Guide 20230619 (PDF)](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)
>

---

### Chaining

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="24 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 24</span>


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
> > [!quote] Detailed Overview Of Equity Index Calculation Changes (PDF)
> > share i on the trading i0 day before the first inclusion in the index p = Price of share i at time t it q = Number of shares of company i on the i0 trading day before the first inclusion in the index q = Number of shares of company i at iT time T t = calculation time of the index K = Index-specific **chaining** factor valid as T of **chaining** date T T = Date of the last chaining Base = value of the i...
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>
> > [!quote] Overview Of Methodology Changes Valid From 18 Of March 2024 (PDF)
> > Methodology Changes (DAXglobal Guide) World Luxury 13.3. World Luxury Index 2.6.3. Unscheduled Index **Chaining** (World Luxury Guide) General All Share Weighting Scheme Full market capitalization weighted 3. General Index Free float market capitalization weighted 6. DAX All Share Information (DAX Indices Scale All Share Guide) 7.7. Scale 30 DAXsector All 3.3 Weighting and Share Capping Methods 13....
>
> — [Overview Of Methodology Changes Valid From 18 Of March 2024 (PDF)](https://www.stoxx.com/document/News/2023/October/Overview%20of%20methodology%20changes%20valid%20from%2018%20of%20March%202024.pdf)
>
> > [!quote] Index Files Guide 20230619 (PDF)
> > asset class Number 0 12 FINAL_SELECTION Indicator whether fund is in the final selection (“Y” or “N”) Text 1 4.8. Fixed Income Index Files (as from 01.11.2023) 4.8.1. Underlying Data Announcement This report displays future index composition and underlying data that will be implemented at the next **chaining** date. 4.8.1.1. eb.rexx Indices  File name: mn_P###_xxxxx_YYYYMMDD.csv, where YYYYMMDD is...
>
> — [Index Files Guide 20230619 (PDF)](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)
>
> > [!quote] Dax Strategy Index Guide (PDF)
> > 2.2 17/12/2010 − Consideration of cost of borrow in Short Indices Effective Creation of Version 2.1 27/09/2010 − Launch of LevDAX x2 Monthly, ShortDAX x2 Monthly Effective Creation of Version 2.0 04/01/2010 − Introduction DAXplus Familiy Index Effective Creation of Version 1.19 28/08/2009 − Changed **chaining** date of DAXplus Maximum Dividend
>
> — [Dax Strategy Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)
>
> > [!quote] Dax Equity Index Methodology Guide 5526498614 (PDF)
> > nt of multiple share classes - Deletion of section 4.1.1.4 “Transition Rules” and deletion of the note about the relevance of the Index Guide/transition rules - Renewed introduction of sequential creation of the ranking list - Correction to the wording regarding the X indices - Clarification of the **chaining** process used with equal weighted indices Effective Version 9.2.1 Sept. 24, 2018 - Termin...
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>

---

### Component

<span style="background:red; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="4,165 mentions across STOXX & ISS pages (high)">▰▰▰▰▰▰ 4,165</span>


> A security that is currently included in an index and contributes to its level calculation; synonymous with "constituent" in STOXX documentation.

The terms "component" and "constituent" are used interchangeably throughout the index industry. Each component has an associated weight determined by the index's weighting scheme, and its price movements directly influence the index level. The set of components is determined during reconstitution events and may change between reviews through corporate actions or fast-entry/fast-exit rules.

> [!tip] Related terms
> [[#Constituent]], [[#Selection Criteria]], [[#Index Universe]]

> [!example]- Source excerpts (5)
>
> > [!quote] Unscheduled component change in SDAX, HDAX and TecDAX (January 8, 2025) | Pre...
> > ZUG (January 8, 2025) – STOXX Ltd., part of the ISS STOXX group of companies and leading provider of benchmark and custom index solutions to global institutional investors, today announced an unscheduled **component** change in the SDAX, HDAX and TecDAX indices. Media Contact Sarah Ball Executive Director, Communications press@iss-stoxx.com NEXUS AG will leave the SDAX, HDAX and TecDAX due to a bre...
>
> — [Unscheduled component change in SDAX, HDAX and TecDAX (January 8, 2025) | Pre...](https://stoxx.com/unscheduled-component-change-in-sdax-hdax-and-tecdax-jan-8-2025) — "WHITEPAPER"
>
> > [!quote] STOXX&reg; Nordic Total Market - STOXX
> > Summary The STOXX Nordic Total Market Index (TMI) is a regional subset of the STOXX Europe TMI Index, which covers approximately 95 percent of the free float market capitalisation of Europe. With a variable number of **component**s, the STOXX Nordic TMI Index covers Denmark, Finland, Norway and Sweden. With a variable number of **component**s, the STOXX Nordic TMI Index covers Denmark, Finland, Norway ...
>
> — [STOXX&reg; Nordic Total Market - STOXX](https://stoxx.com/index/bdxdgv) — "WHITEPAPER"
>
> > [!quote] European defense stocks: A look at purity through military revenues’ exposure...
> > ilitary equipment is based on international arms export control standards. Corporate involvement is differentiated by equipment type, based on its lethality. Combat equipment includes lethal items such as tanks, combat aircraft, missiles and combat ammunition. It also covers certain sub-systems and **component**s directly tied to the lethality of weapons, such as fire control, arming, deployment an...
>
> — [European defense stocks: A look at purity through military revenues’ exposure...](https://stoxx.com/european-defense-stocks-a-look-at-purity-through-military-revenues-exposure) — "WHITEPAPER"
>
> > [!quote] Carbon Risk Rating | ISS
> > about CO2-related risks. The Carbon Risk Rating considers the following parameters: Performance development of the company Climate targets, measures and strategies to reduce emissions Emissions along the entire value chain, from the procurement of raw materials to the disposal phase of products THE **COMPONENT**S OF CARBON RISK RATING CARBON PERFORMANCE SCORE Carbon Performance Score looks at a com...
>
> — [Carbon Risk Rating | ISS](https://www.issgovernance.com/sustainability/climate-solutions/carbon-risk-rating) — "SUSTAINABILITY SOLUTIONS/CLIMATE SOLUTIONS"
>
> > [!quote] MDAX index: 30 years benchmarking Germany’s Mittelstand | Blog posts | STOXX
> > nged several times over its history. In 2003, membership was reduced to 50 companies, before rising to 60 in 2018 following the end of a separate index classification for technology firms. The constituent count returned to 50 in 2021 as part of the broader overhaul announced in 2020. MDAX: timeline **Component**s highlights Of the MDAX’s original constituents at its 1996 launch, Hochtief AG — a con...
>
> — [MDAX index: 30 years benchmarking Germany’s Mittelstand | Blog posts | STOXX](https://stoxx.com/mdax-index-30-years-benchmarking-germanys-mittelstand) — "WHITEPAPER"
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
> > [!quote] Istoxx Index Guide (PDF)
> > sinesses that do not adhere to these critical standards. O Universe: STOXX Developed World All Cap S Weighting scheme: The index is free-float market capitalization weighted D Capping: Components are capped with an iterative process to guarantee that an absolute ICB Industry capping and the 5/10/40 **concentration limit**s are met E Base value and dates: 100 on March 18, 2022 V Index types and curr...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>

---

### Constituent

<span style="background:red; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="2,597 mentions across STOXX & ISS pages (high)">▰▰▰▰▰▰ 2,597</span>


> An individual security that is a member of an index at a given point in time and whose price, shares, and weighting factors contribute to the computation of the index level.

"Constituent" is the preferred formal term in STOXX methodology documentation. Each constituent is characterized by its price, number of shares, free-float factor, and any applicable capping factor. The complete list of constituents for each STOXX index is published and updated at each periodic review.

> [!tip] Related terms
> [[#Component]], [[#Eligibility Criteria]], [[#Selection List]]

> [!example]- Source excerpts (5)
>
> > [!quote] New STOXX Global ESG Leaders index constituents announced | Blog posts | STOXX
> > and standards, enshrined in the United Nations Global Compact (UNGC) Principles, the Organisation for Economic Co-operation and Development (OECD) Guidelines for Multinational Enterprises, the UN Guiding Principles on Business and Human Rights (UNGPs), and their underlying conventions. 2 In case a **constituent** increases its ESG Controversy Rating to Category 5 and becomes non-compliant based on ...
>
> — [New STOXX Global ESG Leaders index constituents announced | Blog posts | STOXX](https://stoxx.com/new-stoxx-global-esg-leaders-index-constituents-announced) — "WHITEPAPER"
>
> > [!quote] ISS Announces New Pay-for-Performance Evaluation for ASX300 Constituents | ISS
> > now applied to STOXX600 **constituent**s. Pay-for-performance tests also apply in Canada both to TSX/S&P Composite companies and those whose ballot features a say-on-pay resolution, along with nearly 4,000 companies in the U.S. where the concept was first unveiled in 2012. For the benefit of all market **constituent**s, ISS will release additional information on the Australian pay-for-performance measu...
>
> — [ISS Announces New Pay-for-Performance Evaluation for ASX300 Constituents | ISS](https://www.issgovernance.com/iss-announces-new-pay-performance-evaluation-asx300-constituents) — "ISS Announces New Pay-for-Performance  Evaluation for ASX300 Constituents"
>
> > [!quote] DAX Index Grows to 40 Constituents – Looking at Impact on Market Cap and Liqu...
> > On September 20, Germany’s flagship DAX® Index will expand from 30 to 40 **constituent**s, concluding the biggest reform in the benchmark’s +30-year history. The enlargement is the final step in a comprehensive overhaul of rules announced in November 2020 that took into account the responses of more than 600 participants in an extensive market consultation. Qontigo’s global
>
> — [DAX Index Grows to 40 Constituents – Looking at Impact on Market Cap and Liqu...](https://stoxx.com/dax-index-grows-to-40-constituents-looking-at-impact-on-market-cap-and-liquidity) — "WHITEPAPER"
>
> > [!quote] DAX tops 20,000 for first time on strength of international-focused constitue...
> > DAX® closed above 20,000 on December 3 for the first time in the German benchmark’s 36-year history, as its **constituent**s’ overseas sales of everything from AI software to industrial parts helped offset economic stagnation at home. The blue-chip index has gained 19% in 20241, with its 40 companies adding EUR 214 billion in market value. While Germany’s economy may post little to no growth in 202...
>
> — [DAX tops 20,000 for first time on strength of international-focused constitue...](https://stoxx.com/dax-tops-20000-for-first-time-on-strength-of-international-focused-constituents) — "WHITEPAPER"
>
> > [!quote] Institutional Shareholder Services Releases Annual Policy Survey | ISS
> > ent of ISS. “The significant input we receive from all market **constituent**s ensures that ISS’ policies reflect market best practices, create dialogue around important issues and, most importantly, serve the proxy voting needs of our institutional clients worldwide. We encourage all interested market **constituent**s, investors and companies alike, to provide input through our survey or by writing di...
>
> — [Institutional Shareholder Services Releases Annual Policy Survey | ISS](https://www.issgovernance.com/institutional-shareholder-services-releases-annual-policy-survey) — "Institutional Shareholder Services Releases Annual Policy Survey"
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

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="97 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 97</span>


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
> > [!quote] Stoxx Digital Asset Guide (PDF)
> > t = Time the index is computed. n = Number of assets in the index. p it = Reference price of asset (i) at time (t). wf it = Weight factor of asset (i) at time (t) . x it = Exchange rate from reference price currency to index currency at time (t). M t = Total ‘units’ of the index at time (t). D t = **Divisor** of the index at time (t). 3.8.2. **DIVISOR** CALCULATION The index divisor is calculated as fo...
>
> — [Stoxx Digital Asset Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_digital_asset_guide.pdf)
>
> > [!quote] Overview Of Methodology Changes Valid From 18 Of March 2024 (PDF)
> > rmula4 Laspeyres index formula; implementation of 6.1 Index Formulas **Divisor**-based Laspeyres index formula; 7.1. Index Formulas Indices3 corporate actions and index reviews via (DAX Guide) implementation of corporate actions and index reviews adjustment to the c and K factors. via adjustment to the **divisor**. it T Dividend Dividends smaller than or equal to 10% of the 8.1. Distributions Dividends...
>
> — [Overview Of Methodology Changes Valid From 18 Of March 2024 (PDF)](https://www.stoxx.com/document/News/2023/October/Overview%20of%20methodology%20changes%20valid%20from%2018%20of%20March%202024.pdf)
>
> > [!quote] Dax Equity Calculation Guide 20231002 (PDF)
> > ON 7.2.1. MARKET CAPITALIZATION-WEIGHTED Each index has a unique index **divisor** that is adjusted to maintain the continuity of the index’s values across changes due to corporate actions. Changes in weights due to corporate actions are distributed proportionally across all index components. The index **divisor**s are calculated as follows: ∑𝑛 (𝑝 ⋅𝑠 ⋅ff ⋅cf ⋅𝑥 )±𝛥MC 𝐷 =𝐷 ⋅ 𝑖=1 it it it it it 𝑡+1 𝑡+1 𝑡...
>
> — [Dax Equity Calculation Guide 20231002 (PDF)](https://www.stoxx.com/document/News/2023/October/DAX%20Equity%20Calculation%20Guide_20231002.pdf)
>
> > [!quote] Istoxx Index Guide (PDF)
> > iSTOXX® METHODOLOGY GUIDE 292/1024 10. iSTOXX MUTB INDICES calculation are not available for the STOXX Japan 600 ex-REITs universe, then this sub item is excluded from the calculation of the respective sub score. » Long Term View Score (25 sub items but the **divisor** is 26 due to the score for 14. Retirement age for full time employee) 1. Ratio of acquiring paid leaves (Last FY) [A00244] If ratio...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> > [!quote] Dax Equity Index Methodology Guide 5526498614 (PDF)
> > Y INDEX METHODOLOGY GUIDE 11/120 4. INDEX CHARACTERISTICS Last trading t-6: Closing day of previous price for month: cutoff calculating for data the UDA is t: Review is collection fixed implemented 3rd/4thtrading day: t-5: UDA is t+1: Review Components are published takes effect announced The index **divisor** is recalculated on the review implementation date as described in the DAX Equity Index Ca...
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
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
> > [!quote] Dax Equity Calculation Guide 20231002 (PDF)
> > ed indices with weighting factors: Adjusted prices will unchanged be calculated as above a) to c) 𝑤𝑓 𝑎𝑑𝑗 =𝑤𝑓 𝑡−1 ×𝑝 𝑡−1 /𝑝 𝑎𝑑𝑗 8.1.10. ADDITION / DELETION OF A COMPANY No price adjustments are made. The change in market capitalization (for price weighted indices: the change in units) determines the **divisor adjustment**. a) For free float market capitalization weighted indices: If the change in ma...
>
> — [Dax Equity Calculation Guide 20231002 (PDF)](https://www.stoxx.com/document/News/2023/October/DAX%20Equity%20Calculation%20Guide_20231002.pdf)
>
> > [!quote] Detailed Overview Of Equity Index Calculation Changes (PDF)
> > indices with weighting factors: Adjusted prices will be calculated unchanged as above a) to c) 𝑤𝑓 =𝑤𝑓 ×𝑝 /𝑝 i. 𝑎𝑑𝑗 𝑡−1 𝑡−1 𝑎𝑑𝑗 8.1.10 Addition / Deletion of A Company No price adjustments are made. The change in market capitalization (for price weighted indices: the change in units) determines the **divisor adjustment**. a) For free-float market capitalization weighted indices: If the change in mar...
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>

---

## E

### Effective Date

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="366 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 366</span>


> The calendar date on which announced index changes — including additions, deletions, share updates, and rebalanced weights — take effect in the live index calculation.

The effective date is the implementation point for all changes disclosed on the announcement date. STOXX index changes are typically implemented at the opening of trading on the effective date, using the closing prices from the preceding trading day to compute the divisor adjustment. The gap between announcement and effective date (usually several trading days) is designed to give market participants time to adjust their portfolios in an orderly manner, minimizing market impact.

> [!tip] Related terms
> [[#Announcement Date]], [[#Periodic Review]], [[#Divisor Adjustment]]

> [!example]- Source excerpts (5)
>
> > [!quote] Stoxx Index Guide (PDF)
> > METHODOLOGY GUIDE 382/639 17. STOXX THEMATIC INDICES The China A securities are monitored against their equivalent Stock Connect Securities. China Connect Securities are screened on a daily basis between the cut-off date and the review **effective date**. » If STOXX is informed 3 days before the review **effective date** about a China Connect Security ineligibility (not eligible to “both buy and sell”)...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> > [!quote] Stoxx World Equity Index Guide (PDF)
> > ember, after the **effective date** of the formal membership change, and announced in a timely manner subject to market conditions • Countries leaving: the changes would usually be effective on the Monday after the 3rd Friday in the previous quarter in March, June, September, or December, preceding the **effective date** of the formal membership change, and announced in a timely manner subject to marke...
>
> — [Stoxx World Equity Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)
>
> > [!quote] Dax Equity Calculation Guide 20231002 (PDF)
> > DAX EQUITY INDEX CALCULATION GUIDE 24/37 8. CORPORATE ACTIONS AND ADJUSTMENTS An extraordinary free float and share adjustment that would be effective during the quarterly review implementation week will become effective on review **effective date**, provided that minimum 2 trading days’ notice can be given. The standard notice period of 2 trading days will be extended such that the **effective date** ...
>
> — [Dax Equity Calculation Guide 20231002 (PDF)](https://www.stoxx.com/document/News/2023/October/DAX%20Equity%20Calculation%20Guide_20231002.pdf)
>
> > [!quote] Index Files Guide 20230619 (PDF)
> > FILES GUIDE past 6 months from the review **effective date** - DivDAX &DivMSDAX -> Dividend yield for the past 12 months from the cut-off date Projected dividend yield 40 Dividend_Yield_Projected - DAXplus Maximum Dividend -> Projected dividend yield Number 9 for the next 6 months from the review **effective date** Note related to the comment field: • For DAX Selection indices: The comments are display...
>
> — [Index Files Guide 20230619 (PDF)](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)
>
> > [!quote] Guide To Eurogov Bond Indices (PDF)
> > ses STOXX Ltd. may exceptionally issue the notification either subsequently immediately following such an event or in any case by other means. Any measures will be implemented two dissemination days later and will enter into effect the next dissemination day after implementation, unless a different **effective date** is specified in the notification.
>
> — [Guide To Eurogov Bond Indices (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/Guide_to_EUROGOV_Bond_Indices.pdf)
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
> > [!quote] A Case Study Involving S&amp;P 500 Companies | ISS
> > er $1.4 million from previously traded losses. * Figures are taken from 32 total settlements of S&P 500 companies during 2013 – 2016 using the average recovery per share from each of the legal Settlements Notices; actual recoveries will vary based upon specific trading data in the claims submitted. **ELIGIBILITY CRITERIA** AND PARTICIPATION REQUIREMENTS Criteria for participating in a securities cl...
>
> — [A Case Study Involving S&amp;P 500 Companies | ISS](https://www.issgovernance.com/a-case-study-involving-sp-500-companies) — "NOTABLE CASES"
>
> > [!quote] Stoxx Index Guide (PDF)
> > and country combinations. The company’s listing must be in the same region (Americas, Europe, Asia / Pacific) as the country assignment to be eligible. Country and regional assignments in the STOXX Investable Growth Universe » According to chapters 4.3 and 5.7 of the STOXX Index Methodology Guide. **Eligibility Criteria** » Non-trading day screenings: Companies are screened for their non-trading da...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> > [!quote] ISS Reconfirmed as Climate Bonds Standard &amp; Certification Scheme Verifier...
> > oval is determined by the Verifier’s levels of experience and expertise in the different technical sectors covered by the Climate Bonds Standard. “Confidence in the green credentials of green bonds is essential to a sustainable market with the Climate Bonds Standard providing clear, sector-specific **eligibility criteria** for assets and projects that can be used for Climate Bonds and Green Bonds, ...
>
> — [ISS Reconfirmed as Climate Bonds Standard &amp; Certification Scheme Verifier...](https://www.issgovernance.com/iss-reconfirmed-climate-bonds-standard-certification-scheme-verifier) — "ISS Reconfirmed as Climate Bonds Standard & Certification Scheme Verifier"
>
> > [!quote] Stoxx Digital Asset Guide (PDF)
> > o Industry Classifications Used by STOXX. ASSET UNIVERSE The universe of assets for the STOXX Digital Asset Indices is reviewed bi-annually in March and September. The universe consists of any asset classified in the Bitcoin Suisse Index Reference Classification List (xRCL), for which the following **eligibility criteria** are met: • Digital assets must be ranked in the Top 75 in regards to market ...
>
> — [Stoxx Digital Asset Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_digital_asset_guide.pdf)
>
> > [!quote] Tesla’s place in a US stock benchmark | Blog posts | STOXX
> > ted market value. Inclusion is based on quantitative factors such as size, liquidity, investability and financial viability (members must be profitable over the past 12 months, including the most recent quarter). However, constituent selection is at the discretion of an Index Committee based on the **eligibility criteria**.1 Driving outperformance Amid increased profitability and investors’ favor, ...
>
> — [Tesla’s place in a US stock benchmark | Blog posts | STOXX](https://stoxx.com/teslas-place-in-a-us-stock-benchmark) — "WHITEPAPER"
>

---

### Equal Weighting

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="29 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 29</span>


> A weighting scheme in which every constituent of an index receives the same weight at each rebalancing date, regardless of market capitalization, price, or any fundamental metric.

In an equally weighted index with $n$ constituents, each security receives a weight of $1/n$ at rebalancing. Between rebalancing dates, weights drift as prices diverge, requiring periodic realignment. Equal weighting tilts exposure toward smaller-capitalization names relative to a cap-weighted benchmark and increases turnover due to the need for regular rebalancing.

$$
w_i = \frac{1}{n}, \quad \forall\; i \in \{1, 2, \ldots, n\}
$$

> [!tip] Related terms
> [[#Weighting Scheme]], [[#Market Capitalization Weighting]], [[#Fundamental Weighting]], [[#Rebalancing]]

> [!example]- Source excerpts (5)
>
> > [!quote] Thematic investing offers alternative approach amid market volatility  | Blog...
> > e. By nature, thematic portfolios also carry a higher risk than do broader strategies and can therefore be more volatile in times of market stress. But volatility can work both ways, which means that many of the themes are likely to outperform the market in the eventual recovery. Also, the adjusted **equal weighting** of constituents in many thematic ETFs ensures that the portfolios are often more ...
>
> — [Thematic investing offers alternative approach amid market volatility  | Blog...](https://stoxx.com/thematic-investing-offers-alternative-approach-amid-market-volatility) — "WHITEPAPER"
>
> > [!quote] Istoxx Index Guide (PDF)
> > t in a selection of leaders with regards to environmental, social, and governance criteria. Universe: The index universe is defined by all the stocks included in the EURO STOXX, as observed on the review effective date. Weighting scheme: the index is price-weighted with weighting factors to achieve **equal weighting** Base values and dates: 100 on March 16, 2012 Index types and currencies: Price, N...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> > [!quote] Well-Off Baby Boomers vs. Tech-Savvy Millennials: A Performance Analysis of T...
> > per look into Qontigo’s entire thematics offering, please see our dedicated page or visit one of our past articles. 1 ‘Mind the (Generation) Gap,’ Qontigo, August 2021. 2 Melissa Brown is Managing Director, Head of Applied Research at Qontigo. Anran Su is Associate at Qontigo Client Services. 3 The equal-weighting methodology in these thematic indices goes through an adjustment formula. To find...
>
> — [Well-Off Baby Boomers vs. Tech-Savvy Millennials: A Performance Analysis of T...](https://stoxx.com/well-off-baby-boomers-vs-tech-savvy-millennials-thematic-investing) — "WHITEPAPER"
>
> > [!quote] Pay For Performance Mechanics (PDF)
> > ROIC* ROA* ROE EBITDA Growth Equipment 4530 Semiconductors & Semiconductor ROIC ROA ROE Operating Cash Equipment Flow Growth 5010 Telecommunication Services ROA ROE ROIC EBITDA Growth 5510 Utilities ROIC ROA ROE EBITDA Growth 6010 Real Estate ROIC ROA ROE Operating Cash Flow Growth * Indicates **equal weighting** for two metrics within an industry. These metrics are listed adjacently in this ta...
>
> — [Pay For Performance Mechanics (PDF)](https://www.issgovernance.com/file/policy/2018/americas/Pay-for-Performance-Mechanics.pdf)
>
> > [!quote] Capturing the upside of a digital future through thematic indices | Blog post...
> > companies most exposed to the theme in question. This screening relies on FactSet’s Revere (RBICS) granular business taxonomy. - Stock selection is sector-agnostic; therefore, a thematic portfolio will look very different from a traditional industry-focused one. - Stocks are weighted by an adjusted equal-weighting scheme to balance between diversification and liquidity. - Additionally, the indi...
>
> — [Capturing the upside of a digital future through thematic indices | Blog post...](https://stoxx.com/capturing-the-upside-of-a-digital-future-through-thematic-indices) — "WHITEPAPER"
>

---

## F

### Fast Entry Rule

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="27 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 27</span>


> A provision that allows a security to be added to an index outside the regular periodic review schedule when it rapidly meets pre-defined criteria, typically related to a sharp increase in market capitalization or a significant corporate event such as an IPO or spin-off.

Fast entry rules ensure that indices remain representative of the market between scheduled reviews. If a newly listed company or a rapidly growing stock rises to a level that would clearly qualify it for inclusion under normal review criteria, the fast entry rule triggers an interim addition. STOXX defines specific ranking thresholds for fast entry that are typically more stringent than the standard inclusion threshold.

> [!tip] Related terms
> [[#Fast Exit Rule]], [[#Buffer Rule]], [[#Periodic Review]]

> [!example]- Source excerpts (5)
>
> > [!quote] Dax Equity Index Methodology Guide 5526498614 (PDF)
> > DEX METHODOLOGY GUIDE 35/120 7. DAX BLUE-CHIP INDICES abroad (this is a discretionary rule; see section 2.3 “Discretion” in the DAX Equity Index Calculation Guide). Component selection: The composition of the DAX, MDAX, SDAX and TecDAX indices is reviewed quarterly on the basis of the Fast Exit and **Fast Entry rule**s, and semi-annually on the basis of the Regular Exit and Regular Entry rules. The...
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> > [!quote] Detailed Overview Of Equity Index Calculation Changes (PDF)
> > ddressed in a fast-track way (e.g., herein. In such cases STOXX Ltd. may exceptionally Pandemic) issue the notification either subsequently - Index Selection and Index Review such as immediately following such an event or in any case by Exclusion from Rankings, Deviation from other means. Fast Exit/**Fast Entry rule**s and Regular Any measures will be implemented two dissemination Exit/Regular Entr...
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>
> > [!quote] Guide To Eurogov Bond Indices (PDF)
> > ). The following table summarizes the cases in which STOXX Committee(s) may exercise discretion regarding the index methodology and its application: Responsible Case STOXX Committee Index Termination and Transition IMC, IGC Sector Affiliation IGC Exclusion from Rankings IGC Deviation from Fast Exit/**Fast Entry rule**s and Regular Exit/Regular Entry rules in IGC exceptional cases Procedure in case ...
>
> — [Guide To Eurogov Bond Indices (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/Guide_to_EUROGOV_Bond_Indices.pdf)
>
> > [!quote] Stoxx Index Guide (PDF)
> > derived indices. August 2013: Clarification of the process to determine Emerging and Developed Markets in chapter 4.3. September 2013: Addition of the STOXX Global Broad Infrastructure index. September 2013: Addition of the STOXX ASEAN-Five Select Dividend 50 index September 2013: Amendments if the **Fast Entry rule** in chapters 9 October 2013: Addition of STOXX Strong Quality indices March 2014: ...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> > [!quote] Scout24, Delivery Hero and Puma to be included in MDAX | Press releases | STOXX
> > the shares of STADA Arzneimittel AG, Krones AG and alstria office REIT-AG. As of 13 July 2018, STADA will change from the segment Prime Standard into General Standard and therefore no longer fulfils the criteria to remain in the indices. The inclusion of Delivery Hero AG and Puma SE is based on the **fast entry rule**; both companies are eligible for the index inclusion due to their market capitali...
>
> — [Scout24, Delivery Hero and Puma to be included in MDAX | Press releases | STOXX](https://stoxx.com/scout24-delivery-hero-and-puma-to-be-included-in-mdax) — "WHITEPAPER"
>

---

### Fast Exit Rule

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="27 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 27</span>


> A provision that triggers the removal of a constituent from an index between periodic reviews when it becomes ineligible due to events such as delisting, bankruptcy, or a severe decline in liquidity or market capitalization below a specified floor.

Fast exit rules protect index integrity by promptly removing securities that no longer meet minimum standards. Without such rules, a bankrupt or illiquid stock could remain in the index for months until the next scheduled review, distorting returns and creating tracking difficulties. STOXX applies fast exit removals effective at the close of the day before the event or as soon as practicable.

> [!tip] Related terms
> [[#Fast Entry Rule]], [[#Buffer Rule]], [[#Corporate Action Treatment]]

> [!example]- Source excerpts (5)
>
> > [!quote] Stoxx Research   Euro Stoxx 50%C2%Ae Esg   Integrating Sustainability (Septem... (PDF)
> > ase from the same iCB supersector of the eUrO STOXX universe (includes the eUrO STOXX 50®). where an eligible company has the same eSG score as a potential replacement, the company with the higher free float market capitalization is selected. replacement constituents must have an eSG score of > 50. **FAST eXiT rULe** The eUrO STOXX 50®eSG index methodology includes a **fast exit rule** that ensures a s...
>
> — [Stoxx Research   Euro Stoxx 50%C2%Ae Esg   Integrating Sustainability (Septem... (PDF)](https://www.stoxx.com/document/Research/STOXX%20Research%20-%20EURO%20STOXX%2050%C2%AE%20ESG%20-%20Integrating%20Sustainability%20(September%202019).pdf)
>
> > [!quote] Dax Equity Index Methodology Guide 5526498614 (PDF)
> > Removal of the requirement for a Prime Standard listing from the idDAX 50 Equal Weight (section 1.16) Effective Version 3.9 Jan. 18, 20 21 − Changes to the index calculation times due to the introduction of the Xetra Trade-at- Close trading phase Effective Version 3.8 Nov. 5, 202 0 − Change to the **Fast Exit rule** for the DivDAX and DivMSDAX Effective Version 3.7 June 26, 20 20 − Launch of the DA...
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> > [!quote] Detailed Overview Of Equity Index Calculation Changes (PDF)
> > nternational index, it replaces the non-surviving stock in the index at the same date the non-surviving stock is deleted from the index. If the surviving stock is already included in the index or does not meet the basic criteria, the non-surviving stock is replaced by a new company according to the **Fast Exit rule** (cf. section xx of the DAX Equity Index Methodology Guide). For All Share indices,...
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>
> > [!quote] Stoxx Index Guide (PDF)
> > August 2019 (3): Methodology change to STOXX Europe Christian Index August 2019 (4): Methodology change to STOXX Activist Indices: Change of liquidity screen from USD 1 million to EUR 1 million August 2019 (5): Methodology change to STOXX Optimised Country Indices: Removal of the quarterly applied **fast exit rule** with respect to share availability to foreign institutional investors August 2019 (...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> > [!quote] Results Of Market Consultation Euro Stoxx 50 Esg And Stoxx Broad Market Esg 2... (PDF)
> > (e) ESG Controversy STOXX will exclude companies that Sustainalytics identifies to have a Controversy Rating of Category 5 (Severe) (f) ESG Risk Ratings STOXX will exclude companies that Sustainalytics identifies to have a “Severe” ESG Risk Rating. Furthermore, STOXX will implement an intra-quarter **fast exit rule** for severe ESG Controversies. For the EURO STOXX 50 ESG only: • Spin-offs will onl...
>
> — [Results Of Market Consultation Euro Stoxx 50 Esg And Stoxx Broad Market Esg 2... (PDF)](https://www.stoxx.com/document/Resources/MarketConsultation/Results_of_Market_Consultation_EURO_STOXX_50_ESG_and_STOXX_Broad_Market_ESG_20230206.pdf)
>

---

### Free-Float

<span style="background:red; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1,251 mentions across STOXX & ISS pages (high)">▰▰▰▰▰▰ 1,251</span>


> The proportion of a company's total shares outstanding that is available for trading by public investors, excluding shares held by strategic investors, company insiders, governments, and other long-term locked-in holders.

Free-float is a critical concept in modern index construction. STOXX defines strategic holdings as those exceeding 5% of outstanding shares held by a single entity with an apparent long-term intent (e.g., founding families, governments, cross-holdings). These shares are excluded from the free-float calculation. A higher free-float indicates greater investability and liquidity, and ensures index weights reflect tradeable market value.

> [!tip] Related terms
> [[#Free-Float Factor]], [[#Adjusted Free-Float Market Capitalization]], [[#Eligibility Criteria]]

> [!example]- Source excerpts (5)
>
> > [!quote] DAX Index Grows to 40 Constituents – Looking at Impact on Market Cap and Liqu...
> > increase the DAX’s representativeness of the domestic economy and foster its diversification. But what does it mean for the index’s profile in terms of market capitalization and equity turnover? In this article we’ll look at the effects of the change from these two perspectives Figure 1 – Impact on **free-float** market cap The addition of ten new companies in the index lowers the average free-floa...
>
> — [DAX Index Grows to 40 Constituents – Looking at Impact on Market Cap and Liqu...](https://stoxx.com/dax-index-grows-to-40-constituents-looking-at-impact-on-market-cap-and-liquidity) — "WHITEPAPER"
>
> > [!quote] Stoxx Index Guide (PDF)
> > STOXX INDEX METHODOLOGY GUIDE 32/639 55.. ININDDEXE XC CHAHARARACCTETREIRSITSICTICS S The following framework described in chapter 5 is used for all STOXX, iSTOXX and customized indices calculated by STOXX. MARKET CAPITALIZATION-WEIGHTED INDICES AND PRICE- WEIGHTED INDICES The **Free-Float** Market Capitalization determines the weights of each constituent in **Free-Float** Market Capitalization weighte...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> > [!quote] Sx50Ugv (PDF)
> > ms to cover the 500 largest companies in terms of **free-float** market cap of the index universe. The detailed methodology including the calculation formula can be found in our rulebook: www.stoxx.com/indices/rulebooks.html Versions and symbols Quick facts Index ISIN Symbol Bloomberg Reuters Weighting **Free-float** market cap Gross Return EUR CH0375047138 SX50UGR .SX50UGR No. of components 500 Gross ...
>
> — [Sx50Ugv (PDF)](https://www.stoxx.com/document/Indices/Factsheets/2022/December/SX50UGV.pdf)
>
> > [!quote] Istoxx Index Guide (PDF)
> > or a given cut-off date have the same ESG Risk Score, priority is given to the one with the highest **free-float** market capitalization. The top 240 companies with the lowest ESG Risk Score remain in the selection for the iSTOXX Eurozone 50 Index. Composition list: The largest 50 companies in terms of **free-float** market capitalization are selected. Review frequency: The reviews are conducted on a q...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> > [!quote] Detailed Overview Of Equity Index Calculation Changes (PDF)
> > lation is defined as (unless stated differently in the individual index methodologies): • Input data (e.g., pricing and currency rates) and other underlying data: rounded to seven decimal places. • Index divisors: rounded to integer numbers. • Market capitalization: rounded to two decimal places. • **Free-float** factors: rounded to four decimal places. • Product of (number of shares x **Free-float** f...
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>

---

### Free-Float Factor

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="31 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 31</span>


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
> > [!quote] Detailed Overview Of Equity Index Calculation Changes (PDF)
> > lation is defined as (unless stated differently in the individual index methodologies): • Input data (e.g., pricing and currency rates) and other underlying data: rounded to seven decimal places. • Index divisors: rounded to integer numbers. • Market capitalization: rounded to two decimal places. • **Free-float factor**s: rounded to four decimal places. • Product of (number of shares x Free-float f...
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>
> > [!quote] Dax Equity Index Methodology Guide 5526498614 (PDF)
> > DAX EQUITY INDEX METHODOLOGY GUIDE 18/120 5. STOCK CHARACTERISTICS EQS News. Where no regulatory announcements are available, other publicly available sources are consulted in addition to determine the number of shares. 5.8. **FREE-FLOAT FACTOR**S 5.8.1. FIXED HOLDINGS Shares of a company that are not assigned to the free float are known as “fixed holdings.” These cannot be freely traded by definit...
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> > [!quote] Stoxx World Equity Index Guide (PDF)
> > R adjusted free float of the spun-off company will reflect the adjustment, if any, on its second trading day. FREE-FLOAT MARKET CAPITALIZATION The free-float market capitalization is the share of a stocks’ total market capitalization that is available for trading: Free-float market capitalization = **free-float factor** × full market capitalization The weighting factor multiplied by the price of th...
>
> — [Stoxx World Equity Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)
>
> > [!quote] Stoxx Index Guide (PDF)
> > g factors are adjusted for corporate actions. Please consult the STOXX Calculation Guide for further details. FREE-FLOAT MARKET CAPITALIZATION The free-float market capitalization is the share of a stocks’ total market capitalization that is available for trading: Free-float market capitalization = **free-float factor** × full market capitalization The weighting factor multiplied by the price of th...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> > [!quote] Istoxx Index Guide (PDF)
> > NEUTRAL ESG 600 INDEX Determination of free-float market capitalization weights: p ⋅n ⋅ff it it it w = it ∑n p ⋅n ⋅ff i=1 it it it wit = Free-Float Market Capitalization weight of company (i) at time (t) pit = Price of company (i) at time (t) nit = Number of shares of company (i) at time (t) ffit = **Free-float factor** of company (i) at time (t) nit = Number of shares Weighting cap factors: A capp...
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

<span style="background:red; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1,934 mentions across STOXX & ISS pages (high)">▰▰▰▰▰▰ 1,934</span>


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
> > [!quote] Stoxx Equity Index Family Benchmark Statement (PDF)
> > dance with the methodology; Benchmarks can be calculated using different (b) where relevant, a description of calculation rules. For example: instances when the accuracy and - they are calculated as a Price Index, without dividends; reliability of the methodology used for - they are calculated as a **Gross Return Index**; with determining the benchmark can no dividends reinvested; longer be ensured...
>
> — [Stoxx Equity Index Family Benchmark Statement (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Resources/Regulation/STOXX_Equity_Index_Family_Benchmark_Statement.pdf)
>
> > [!quote] Istoxx Index Guide (PDF)
> > with a constant dividend markdown expressed in percentage of the index performance that is subtracted on an accrued basis (using an Actual/365 Fixed day count convention). Consequently, due to the percentage of performance being subtracted, the Decrement Index is underperforming the standard net / **gross return index** that include a net / gross dividend investment. The Decrement Index may perform...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> > [!quote] Barclays licenses iStoxx ESG Focus indices and targets private banking | Stru...
> > ecrement version replicates the Euro iStoxx 50 ESG Focus **Gross Return Index**, assuming a constant 5% performance deduction per annum. The deduction accrues constantly on a daily basis. Consequently, due to the percentage of performance being subtracted, the decrement index underperforms the standard **gross return index** that includes a gross dividend investment. The new indices will enable investo...
>
> — [Barclays licenses iStoxx ESG Focus indices and targets private banking | Stru...](https://stoxx.com/barclays-licenses-istoxx-esg-focus-indices-and-targets-private-banking) — "Industry Insights"
>
> > [!quote] Stoxx Strategy Guide (PDF)
> > 𝑠𝑝,𝑡 𝑖,𝑡−1 𝑖,𝑡 𝑖𝑑𝑥,𝑡 𝑖=1 Where: 𝐼𝑉 = index value on day t (unrounded) 𝑡 𝑟 𝑑𝑖𝑠𝑝,𝑡 = dispersion return on day t 𝑤 = adjusted close weight of EURO STOXX 50 component i on day t 𝑖,𝑡 𝑟 = log gross return of EURO STOXX 50 component i on day t 𝑖,𝑡 The return is adjusted for corporate actions affecting the **gross return index**. The log return is capped/floored at +/-15%. 𝑟 = log return of the EURO STOXX ...
>
> — [Stoxx Strategy Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_strategy_guide.pdf)
>
> > [!quote] Monthly Index News September 2024 (PDF)
> > XX Benchmark indices, gross return. Data as of September 30, 2024. Source: STOXX. Index and volatility performance 135 100% 130 90% 125 80% 120 70% 115 60% 50% 110 40% 105 30% 100 20% 95 10% 90 0% Oct-23 Dec-23 Feb-24 Apr-24 Jun-24 Aug-24 1 2 3 4 5 6 7 8 1 2 3 4 5 6 7 8 September 2024 Figure 1: EUR **gross return index** performance. Oct. 2023 – Sep. Figure 2: Monthly annualized volatility analysis...
>
> — [Monthly Index News September 2024 (PDF)](https://stoxx.com/monthly-index-news-september-2024)
>

---

## I

### Index Calculation

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="309 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 309</span>


> The continuous or end-of-day computational process by which constituent prices, shares, free-float factors, and capping factors are combined via the index formula to produce the index level at each point in time.

STOXX calculates its indices in real time during exchange trading hours and publishes end-of-day official closing levels based on closing auction prices. The calculation engine applies the Laspeyres-type formula, maintaining the divisor to ensure continuity. Intra-day calculations typically use last-traded prices, while end-of-day calculations use official closing prices from the primary listing exchange.

> [!tip] Related terms
> [[#Index Formula (Laspeyres)]], [[#Divisor]], [[#Index Level]]

> [!example]- Source excerpts (5)
>
> > [!quote] Detailed Overview Of Equity Index Calculation Changes (PDF)
> > f new Index Guides for its DAX Index offering pursuant to methodological changes of the DAX Equity Index Framework announced March 27th, 2023. The current Guide to the DAX Equity Indices has been restructured to provide a more transparent guidance to the rules underlying the Index methodologies and **Index calculation**. On March 18th, 2024, the currently applicable Guide to the DAX Equity Indices ...
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>
> > [!quote] Istoxx Index Guide (PDF)
> > ndex types and currencies: Total return and excess return, in EUR, in real-time. Dissemination calendar: STOXX Eurex Calendar Index value formula: 1. A Trading Signal is calculated as follow: T S d = In In d d e e x A x B d d 5. DYNAMIC VSTOXX INDEX Index A = Closing level of VSTOXX index (V2TX) on **Index Calculation** Day d and Index d Index B = Closing level of VSTOXX120 days index (VSTX120) on ...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> > [!quote] Dax Equity Index Methodology Guide 5526498614 (PDF)
> > as on the next review date (this is a discretionary rule; see section 2.3 “Discretion” in the DAX Equity **Index Calculation** Guide). 5.6. CORPORATE ACTIONS All index components are adjusted for corporate actions. Individual events are treated in the same way in all indices. Please see the DAX Equity **Index Calculation** Guide for details. 5.7. NUMBER OF SHARES Each stock in the DAX universe is uniqu...
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> > [!quote] Index Files Guide 20230619 (PDF)
> > FILES GUIDE 2.4.1. Dividend Point Indices The Dividend Point Indices reports provide detailed dividend data used in **index calculation**. The historical index value reports follow the standard format described in Section 2.1.5.  File name: xxxxx  File type: .txt  File specification: semicolon separated  File frequency: daily Column Data Attribute Description Data Format ID Type 1 Date Dividend...
>
> — [Index Files Guide 20230619 (PDF)](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)
>
> > [!quote] Stoxx Index Guide (PDF)
> > odology in order to achieve the index objective. STOXX performs intensive research and may conduct conversations with market participants and third parties for this purpose. STOXX discloses the index objective in every case. METHODOLOGY REVIEW POLICIES STOXX constantly monitors the execution of the **index calculation** rules in order to ensure the validity of the index methodology. STOXX also cond...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
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
> > [!quote] Tesla’s place in a US stock benchmark | Blog posts | STOXX
> > weighted by their float-adjusted market value. Inclusion is based on quantitative factors such as size, liquidity, investability and financial viability (members must be profitable over the past 12 months, including the most recent quarter). However, constituent selection is at the discretion of an **Index Committee** based on the eligibility criteria.1 Driving outperformance Amid increased profita...
>
> — [Tesla’s place in a US stock benchmark | Blog posts | STOXX](https://stoxx.com/teslas-place-in-a-us-stock-benchmark) — "WHITEPAPER"
>

---

### Index Formula (Laspeyres)

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="80 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 80</span>


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
> > [!quote] Detailed Overview Of Equity Index Calculation Changes (PDF)
> > Guidance - DAX Equity Index Calculation 6 Calculation 6.1 Index Formulas 6.1.1 **Index Formula** for free float market capitalization weighted indices The selection indices of the DAX® family are capital weighted. Only the shares in the free float are considered when calculating the capitalization. The indices are each calculated as price and performance indices. The indices in th
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>
> > [!quote] Stoxx Strategy Guide (PDF)
> > : Addition of EURO STOXX 50 Covered Call ATM index • January 2025: Change in STOXX logo, alignment of fonts to STOXX Brandbooks • March 2025: Formula clarification for EURO STOXX 50 Covered Call ATM Index and removed reference of STOXX ESG Index Methodology Guide • March 2025(2): Enhancement in the **index formula** of EURO STOXX 50 BuyWrite Index • July 2025: Addition of footnote in section STOXX ...
>
> — [Stoxx Strategy Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_strategy_guide.pdf)
>
> > [!quote] Istoxx Index Guide (PDF)
> > iSTOXX® METHODOLOGY GUIDE 52/1024 4. RISK BASED INDICES Any variation in βLVI on a rebalancing date would therefore result in a variation of exposure of T SXLABR to LVI which is capped at 20%. In addition, the exposure of SXLABR to LVI will always be comprised between 50% and C. **INDEX FORMULA** The SXLABR is calculated as follows: 1 LVI t SXLABR t = SXLABR t−1 1+Max(50%,Min(C, βLVI ))( LVI −1) T(...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> > [!quote] Overview Of Methodology Changes Valid From 18 Of March 2024 (PDF)
> > Methodology Changes 1. Changes to the DAX Index Calculation and Corporate Actions Treatment Affected Index Methodology Former Rule Applicable chapter New Rule Applicable chapter Change in former index in new index guide 1 guide2 All DAX Equity Index Formula4 Laspeyres **index formula**; implementation of 6.1 Index Formulas Divisor-based Laspeyres **index formula**; 7.1. Index Formulas Indices3 corporat...
>
> — [Overview Of Methodology Changes Valid From 18 Of March 2024 (PDF)](https://www.stoxx.com/document/News/2023/October/Overview%20of%20methodology%20changes%20valid%20from%2018%20of%20March%202024.pdf)
>
> > [!quote] Dax Strategy Index Guide (PDF)
> > ation of Version 4.8.1 - Change of return type terminology for DAX from “Total Return” to 20/02/2026 “Gross Return” Effective 20/02/2026 Published Creation of Version 4.8 - Addition of DAX Covered Call ATM Index 22/08/2025 Effective 22//08/2025 Published Creation of Version 4.7 - Enhancement in the **index formula** of DAXplus Option Indices 24/03/2025 Effective 24//03/2025 Published Creation of Ve...
>
> — [Dax Strategy Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)
>

---

### Index Level

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="143 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 143</span>


> The numerical value of an index at a given point in time, representing the cumulative effect of constituent price changes since the base date, scaled by the base value and maintained via the divisor.

The index level is the single number quoted in financial markets — for example, "the EURO STOXX 50 closed at 4,285.50." It is calculated by dividing the aggregate adjusted free-float market capitalization of all constituents by the divisor. Changes in the index level between two dates (expressed as a percentage) represent the index return over that period.

> [!tip] Related terms
> [[#Base Value]], [[#Base Date]], [[#Index Calculation]]

> [!example]- Source excerpts (5)
>
> > [!quote] Stoxx Strategy Guide (PDF)
> > lly the Wednesday prior to the second last Friday of the respective maturity month, if this is an exchange day; otherwise the exchange day immediately preceding that day. Self-financing constraint (II) 𝐼𝑉𝑃𝑜𝑠𝑡 =𝐼𝑉𝑃𝑟𝑒−(𝐶𝑃𝑜𝑠𝑡−𝐶𝑃𝑟𝑒)(𝑃∗ −𝑃𝑀)−(𝐶𝑃𝑜𝑠𝑡−𝐶𝑃𝑟𝑒)(𝑃∗ −𝑃𝑀) 𝑡 𝑡 1𝑡 1𝑡 1𝑡 1𝑡 2𝑡 2𝑡 2𝑡 2𝑡 The post-roll **index level** has to be equal to the pre-roll **index level** minus cost the of trading. Hereby 𝑃∗ refe...
>
> — [Stoxx Strategy Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_strategy_guide.pdf)
>
> > [!quote] Istoxx Index Guide (PDF)
> > STOXX Europe Calendar INDEX FORMULA UI Diff(t−1,t) TR =TR ∗{1+w ∗( t −1 )+(1−w )∗[IR ∗ ]} t t−1 t−1 UI t−1 t−1 360 t−1 Diff(t−1,t) UI Diff(t−1,t) ER =ER ∗[1−IR ∗ ]∗{1+w ∗( t −1 )+(1−w )∗[IR ∗ ]} t t−1 t−1 360 t−1 UI t−1 t−1 360 t−1 where: TR iSTOXX Global Millennials Risk Control 5% RV Total Return **index level** on index t level determination date t w Equity Weight on **index level** determination da...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> > [!quote] Dax Equity Index Methodology Guide 5526498614 (PDF)
> > ITY INDEX METHODOLOGY GUIDE 104/120 1155.. AAPPPPEENNDDIIXX 15.1. HISTORICAL DATA Index histories exist for all indices as from their baseline dates at the latest. The DAX price index is a continuation of the Börsen-Zeitung Index, which historically extends back to October 1959. However, historical **index level**s for the DAX performance index are only available as from its baseline date in Decemb...
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> > [!quote] Stoxx Sfdrarticle2 17 Sustainableinvestmentmethodology 202501 (PDF)
> > STOXX’S SFDR ARTICLE 2(17) SUSTAINABLE INVESMENT METHODOLOGY 10/13 3.4 Aggregation methodology at **index level** STOXX uses a market value-weighted approach to aggregate the SI % (positive contribution) at portfolio level. We think this methodology is the most robust approach and properly reflects the actual aggregated positive contribution, since it is aligned with the regulatory recommendation fo
>
> — [Stoxx Sfdrarticle2 17 Sustainableinvestmentmethodology 202501 (PDF)](https://stoxx.com/wp-content/uploads/2025/03/STOXX_SFDRArticle2_17_SustainableInvestmentMethodology_202501.pdf)
>
> > [!quote] Technical Migration New Index Data Distribution System And New File Formats F... (PDF)
> > on System”, is a system where users with commercial agreements with Qontigo are entitled to retrieve Index Data for purposes as defined in the commercial agreements. The Index Data Distribution System contains various permission levels such as entity and users accesses, per commercial packages, per **Index level** and subject to Licenses of Third-Party Data. - The “Current Index Data Distribution S...
>
> — [Technical Migration New Index Data Distribution System And New File Formats F... (PDF)](https://www.stoxx.com/document/News/2023/March/Technical_Migration-New_Index_Data_Distribution_System_and_New_File_Formats_for_DAX_Indices_20230327_3457284624.pdf)
>

---

### Index Point

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="80 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 80</span>


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
> > [!quote] STOXX extends EURO STOXX 50 ESG offering with dividend points index | Blog po...
> > d traders to gain targeted exposure on corporate payments. As such, they can hedge their portfolios’ dividend risk, separate from the underlying share performance. The new EURO STOXX 50® ESG DVP index will enable the construction of hedges around dividend payments in the EURO STOXX 50 ESG. Dividend **index point**s The STOXX DVP indices are calculated as the sum of all gross cash or cash equivalent...
>
> — [STOXX extends EURO STOXX 50 ESG offering with dividend points index | Blog po...](https://stoxx.com/stoxx-extends-euro-stoxx-50-esg-offering-with-dividend-points-index) — "WHITEPAPER"
>
> > [!quote] Istoxx Index Guide (PDF)
> > X Equal Weighted Constant 50 index replicates the returns of an investment into the Underlying Index (gross return versions) with a constant dividend markdown expressed in **index point**s that are subtracted on an accrued basis (using an Actual/365 Fixed day count convention). Consequently, due to the **index point**s being subtracted, the iSTOXX Constant indices are underperforming the standard gross...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> > [!quote] Dividend Futures Point to Historical Payments Slump | Blog posts | STOXX
> > when business slows down. Companies resist cutting dividends unless it’s imperative, because of the negative message the move sends. At the same time, dividends are an important factor underpinning equities as many income investors and pension funds are attracted to the stable cash flows. Dividend **index point**s The EURO STOXX 50® Index Dividend Futures are based upon the underlying calculation o...
>
> — [Dividend Futures Point to Historical Payments Slump | Blog posts | STOXX](https://stoxx.com/dividend-futures-point-to-historical-payments-slump) — "WHITEPAPER"
>
> > [!quote] Stoxx Strategy Guide (PDF)
> > lue of the Decrement Index for the base date Ut = The value of the Underlying Index for calculation day t Ut-1 = the value of the Underlying Index for calculation day t-1 Act(t-1,t) = The number of calendar days between calculation day t-1 and calculation day t D = The Decrement Amount expressed in **index point**s 22.3.2. DECREMENT INDEX CALCULATION (DECREMENT IN PERCENTAGE POINTS) The Decrement I...
>
> — [Stoxx Strategy Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_strategy_guide.pdf)
>
> > [!quote] Q&amp;A with Eurex and STOXX: A perspective on volatility indices | Blog post...
> > are quoted just a few ticks wide, and in some cases there’s over 5,000 contracts being posted on the bid/ask.” Thomas, with different economic realities and monetary policy in the two markets, what are volatility indices telling us today? “The VSTOXX and VIX are currently quoted at around 17 and 15 **index point**s respectively. This is lower than the average value across the lifetimes of these two...
>
> — [Q&amp;A with Eurex and STOXX: A perspective on volatility indices | Blog post...](https://stoxx.com/qa-with-eurex-and-stoxx-a-perspective-on-volatility-indices) — "WHITEPAPER"
>

---

### Index Universe

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="363 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 363</span>


> The broadest set of securities from which an index's constituents may be selected, defined by geographic, exchange, sector, or asset-class criteria.

The index universe is the starting pool before any eligibility or selection screens are applied. For example, the STOXX Europe 600 draws from the STOXX Europe Total Market Index, which itself covers securities listed in 17 European countries. The universe definition determines the geographic and economic scope of the index and is specified in the index rulebook.

> [!tip] Related terms
> [[#Eligibility Criteria]], [[#Selection Criteria]], [[#Selection List]]

> [!example]- Source excerpts (5)
>
> > [!quote] Stoxx Index Guide (PDF)
> > de a low tracking error to the benchmark index while ensuring an improved ESG score. The weighting of each constituent security is determined through an optimization process that is designed to ensure diversification and uses Axioma’s risk model and optimizer to construct the indices. Universe: The **index Universe**s for the STOXX ESG Target TE indices are defined by all the stocks in the correspo...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> > [!quote] Stoxx Sfdrarticle2 17 Sustainableinvestmentmethodology 202501 (PDF)
> > the evolution of the data available to qualify companies’ performance in the four dimensions of good governance, so as to aid the future evolution of its methodology. Our research led to the conclusion that insufficient data is available at this stage to permit consistent implementation across our **index universe**. 3.3 Positive contribution: product and service revenues STOXX’s recent research sh...
>
> — [Stoxx Sfdrarticle2 17 Sustainableinvestmentmethodology 202501 (PDF)](https://stoxx.com/wp-content/uploads/2025/03/STOXX_SFDRArticle2_17_SustainableInvestmentMethodology_202501.pdf)
>
> > [!quote] Dax Equity Index Methodology Guide 5526498614 (PDF)
> > PPENDIX − Change to the quarterly review process methodology to introduce quarterly underlying data announcement (UDA) dates, plus change in the review date to the second Friday (t-5). The changes can be found in section 2.6. Effective Version 1.2 Mar. 2022 − Exclusion of Russian companies from the **index universe** Effective Version 1.1 Oct. 2008 − Change to calculation period Effective Version 1...
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> > [!quote] Monthly Index News March 2021 (PDF)
> > MONTHLY INDEX NEWS / March 2021 ESG-X Factor Indices – Regional: US Key Points Within the STOXX® USA 900 ESG-X Index and STOXX® USA 500 ESG-X **Index universe**s, Value was the leading factor in terms of returns for a second consecutive month. As it happened with the standard universes, Momentum trailed in March. Risk and Return Characteristics Return (%) Annualized volatility (%) EUR USD EUR USD 1...
>
> — [Monthly Index News March 2021 (PDF)](https://stoxx.com/monthly-index-news-march-2021)
>
> > [!quote] Overview Of Methodology Changes Valid From 18 Of March 2024 (PDF)
> > na Universe Hongkong Stock Exchange, Singapore Stock 2.1.3 DAXglobal China Deletion of Singapore Stock Exchange as eligible 12.3. DAXglobal Exchange, London Stock Exchange, Nasdaq and (DAXglobal Guide) exchange China New Stock Exchange as eligible exchanges DAXglobal Gold Universe Outdated scope of **index universe** 8.2 Eligible and non- Updated scope of **index universe** 13.2. DAXglobal Miners eligi...
>
> — [Overview Of Methodology Changes Valid From 18 Of March 2024 (PDF)](https://www.stoxx.com/document/News/2023/October/Overview%20of%20methodology%20changes%20valid%20from%2018%20of%20March%202024.pdf)
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
> > [!quote] Q&amp;A: Building customized, sustainable portfolios based on the STOXX World...
> > kets, with the view that if you want to create a sustainable outcome you might want to use different thresholds and criteria. In using the STOXX World indices as building blocks, you can do this without compromising the consistent index-construction methodology. Can you tell us a bit more as to why **investability** is so important in emerging markets? Emerging markets cannot necessarily be accesse...
>
> — [Q&amp;A: Building customized, sustainable portfolios based on the STOXX World...](https://stoxx.com/qa-building-customized-sustainable-portfolios-based-on-the-stoxx-world-indices) — "WHITEPAPER"
>
> > [!quote] MDAX index: 30 years benchmarking Germany’s Mittelstand | Blog posts | STOXX
> > onal contracts. Open interest in MDAX derivatives stood at EUR 2 billion at the end of 2025. Additionally, more than 2,300 investment certificates on the MDAX are currently available at the Frankfurt Stock Exchange (FSE). “Very few national markets worldwide offer a mid-cap index with this level of **investability**, showcasing the strength and momentum of Germany’s mid‑cap leaders, and powered by ...
>
> — [MDAX index: 30 years benchmarking Germany’s Mittelstand | Blog posts | STOXX](https://stoxx.com/mdax-index-30-years-benchmarking-germanys-mittelstand) — "WHITEPAPER"
>
> > [!quote] Stoxx Minvar Paper (PDF)
> > provide market participants with an easy way to track MVPs in specific markets. For each market – global, regional and country-specific – two versions are made available: Constrained and Unconstrained. The Unconstrained version is optimized with minimal constraints, which pertain to tradability and **investability**, and aims to be on the efficient frontier. The Constrained version seeks to also re...
>
> — [Stoxx Minvar Paper (PDF)](http://www.stoxx.com/document/Others/marketing/STOXX_MinVar_Paper.pdf)
>
> > [!quote] Tesla’s place in a US stock benchmark | Blog posts | STOXX
> > t of competitors General Motors Co. and Ford Motors Co. By contrast, Tesla failed to find a place in the widely followed S&P 500 in an index review on Sep. 4. The S&P 500 tracks stocks weighted by their float-adjusted market value. Inclusion is based on quantitative factors such as size, liquidity, **investability** and financial viability (members must be profitable over the past 12 months, includ...
>
> — [Tesla’s place in a US stock benchmark | Blog posts | STOXX](https://stoxx.com/teslas-place-in-a-us-stock-benchmark) — "WHITEPAPER"
>
> > [!quote] Industry Neutral Factor Indices | STOXX
> > mization and portfolio analytics. Invest with precision Maximize the allocation to the desired factor while constraining the exposure to non-targeted factors, other attributes and unintended sources of risk. Manage liquidity Aim for higher capacity and reduced trading costs by managing turnover and **investability**, and avoiding potentially problematic illiquid positions. Easily tradable Access yo...
>
> — [Industry Neutral Factor Indices | STOXX](https://stoxx.com/industry-neutral-factor-indices) — "WHITEPAPER"
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
> > [!quote] Valour launches ETP on first STOXX crypto blue-chip index | Blog posts | STOXX
> > to-native metrics including the scope of adoption, the size of the developer community, the fees paid by users and the age of the protocol. This, together with robust exchange-based pricing, ensures the investable tokens present quality standards that are acceptable to a larger pool of investors. A **market capitalization weighting** scheme with a cap of 30% limits exposure to dominant tokens — suc...
>
> — [Valour launches ETP on first STOXX crypto blue-chip index | Blog posts | STOXX](https://stoxx.com/valour-launches-etp-on-first-stoxx-crypto-blue-chip-index) — "WHITEPAPER"
>
> > [!quote] STOXX licences first crypto Blue Chip Index, co-developed with Bitcoin Suisse...
> > lection of the crypto universe today. The list of eligible tokens is derived from all assets classified under the Bitcoin Suisse Global Crypto Taxonomy (GCT). Selection is based on a multi-step procedure which seeks to identify the strongest and most representative assets in each eligible sector. A **market capitalization weighting** scheme with a cap of 30 percent limits exposure to typically domi...
>
> — [STOXX licences first crypto Blue Chip Index, co-developed with Bitcoin Suisse...](https://stoxx.com/stoxx-licences-first-crypto-blue-chip-index-co-developed-with-bitcoin-suisse-to-valour-inc) — "WHITEPAPER"
>
> > [!quote] What’s Behind the Edge in Equal-Weight Strategies? | Blog posts | STOXX
> > The launch of the DAX® Equal Weight Index this month presents a good opportunity to review the virtues of an equal-weight equity strategy. Looking across different markets and time periods, a portfolio whose holdings have had an equal allocation to them has outperformed the traditional market-capitalization-weighting positioning. The latter strategy has been the core offering since the inceptio...
>
> — [What’s Behind the Edge in Equal-Weight Strategies? | Blog posts | STOXX](https://stoxx.com/whats-behind-the-edge-in-equal-weight-strategies) — "WHITEPAPER"
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

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="180 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 180</span>


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
> > [!quote] Istoxx Index Guide (PDF)
> > turn index assuming a constant 5% performance deduction per annum. The performance deduction accrues constantly on a daily basis (using an Actual/365 Fixed day count convention). Consequently, due to the percentage of performance being subtracted, the decrement index is underperforming the standard **net return index**. The Underlying Index is the iStoxx Europe Origin 100 Equal Weight Net Return In...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> > [!quote] Dax Strategy Index Guide (PDF)
> > is underperforming the standard **net return index**. The decrement index may perform better than the standard price index that does not consider dividend investments as long as the overall net dividend yield of the base index is greater than the value being subtracted. The base index is the DAX 50 ESG **Net Return Index**. Base value and dates: 1000 on September 24, 2012. 8.1.2. CALCULATION The index ...
>
> — [Dax Strategy Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)
>
> > [!quote] Ixarobu (PDF)
> > e definition of STOXX® Customized Indices, which can be tailored to specific client or mandate needs. STOXX offers customization in almost unlimited forms for example in terms of component selection, weighting schemes and personalized calculation methodologies. 3 Net dividend yield is calculated as **net return index** return minus price index return 4 STOXX data from Jun. 20, 2011 to Aug. 31, 2023...
>
> — [Ixarobu (PDF)](https://www.stoxx.com/document/Bookmarks/CurrentFactsheets/IXAROBU.pdf)
>
> > [!quote] Stoxx Equity Index Family Benchmark Statement (PDF)
> > nstances when the accuracy and - they are calculated as a Price Index, without dividends; reliability of the methodology used for - they are calculated as a Gross Return Index; with determining the benchmark can no dividends reinvested; longer be ensured, such as when the - they are calculated as a **Net Return Index**; with administrator deems the liquidity in the dividends reinvested net of withh...
>
> — [Stoxx Equity Index Family Benchmark Statement (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Resources/Regulation/STOXX_Equity_Index_Family_Benchmark_Statement.pdf)
>
> > [!quote] Dax Esg Equity Family Benchmark Statement (PDF)
> > uption which results in the performance of the Index being unable to be tracked. Limitation Shall refer to circumstances where the Index Methodology contains an Insufficient Rule or Unclear Rule or if it fails to produce Index Values as intended. Examples: Data Insufficiency; Extreme Market Events. **Net Return Index** Shall mean an Index in which dividend payments are fully reinvested, calculated ...
>
> — [Dax Esg Equity Family Benchmark Statement (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Resources/Regulation/DAX_ESG_Equity_Family_Benchmark_Statement.pdf)
>

---

### Number of Components (Fixed vs. Variable)

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="123 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 123</span>


> The rule specifying whether an index maintains a predetermined fixed count of constituents (e.g., exactly 50 stocks) or allows the count to vary based on eligibility and selection criteria at each review.

Fixed-count indices such as the EURO STOXX 50 always maintain exactly the target number of constituents. When a constituent is removed, a replacement is added to maintain the count. Variable-count indices, such as the STOXX Europe Total Market Index, include all securities that satisfy the eligibility and selection thresholds, and the number of constituents may change at each review. Fixed-count indices typically require more elaborate buffer rules and ranking procedures.

> [!tip] Related terms
> [[#Buffer Rule]], [[#Constituent]], [[#Reconstitution]]

> [!example]- Source excerpts (5)
>
> > [!quote] Monthly Index News September 2022 (PDF)
> > MONTHLY INDEX NEWS / September 2022 Featured index September brought more changes to the methodology behind the blue-chip DAX®. For the first time since the index was introduced in 1988, the **number of components**’ shares, weight factors and caps affected by the quarterly review was fixed using data as of the close on t-6 (six trading days before the effective rebalance date on the third Friday o...
>
> — [Monthly Index News September 2022 (PDF)](https://stoxx.com/monthly-index-news-september-2022)
>
> > [!quote] Sxxgr (PDF)
> > diversification of all regions: Europe, North America and Asia/Pacific developed markets of Europe, North America and Asia/Pacific, are each represented by 600 components represented by the STOXX Europe 600, the STOXX North America 600 and the STOXX Asia/Pacific 600 indices.The STOXX Global » Broad **number of components** 1800 Index is a combination of all three indices. The EURO STOXX » Index com...
>
> — [Sxxgr (PDF)](https://www.stoxx.com/document/Indices/Factsheets/2020/July/SXXGR.pdf)
>
> > [!quote] Stoxx Index Guide (PDF)
> > GUIDE 64/639 7. STOXX BENCHMARK INDICES (BMI) 7.1.3. ONGOING MAINTENANCE Selection list: The selection list is updated on a monthly basis according to the review component selection process and Selection list definition in section 5.2 of STOXX Index Methodology Guide. Replacements: To maintain the **number of components** constant, a deleted stock is replaced by the highest ranked non-component on ...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> > [!quote] Detailed Overview Of Equity Index Calculation Changes (PDF)
> > ), which adjusted to maintain the continuity of the index’s remains constant until the index composition is values across changes due to corporate actions. modified. Changes in weights due to corporate actions are distributed proportionally across all index The Fi factors provide information on the **number of components**. The index divisors are calculated as shares required from each company to t...
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>
> > [!quote] Us Executive Compensation Policies Faq 16 March 2016 (PDF)
> > closure to allow for an informed say-on-pay vote, ISS will look for all of the following disclosures: › The portion of the EMI’s management fee that is allocated to NEO compensation paid by the external manager (aggregated values for all NEOs is acceptable); › Of this compensation, the breakdown of fixed vs. variable/incentive pay; and › The metrics utilized to measure performance to determine ...
>
> — [Us Executive Compensation Policies Faq 16 March 2016 (PDF)](https://www.issgovernance.com/file/policy/us-executive-compensation-policies-faq-16-march-2016.pdf)
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

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="20 mentions across STOXX & ISS pages (low)">▰▰ 20</span>


> The scheduled process — typically conducted quarterly, semi-annually, or annually — during which an index provider reassesses constituency, share counts, free-float factors, and other parameters against current data.

Periodic reviews are the primary governance mechanism for index maintenance. STOXX conducts reviews on predefined calendar dates published in advance. During a review, the index provider re-applies eligibility and selection criteria to the index universe, updates share counts and free-float factors, recalculates capping factors if applicable, and announces the resulting changes before the effective date.

> [!tip] Related terms
> [[#Reconstitution]], [[#Review Frequency]], [[#Announcement Date]], [[#Rebalancing]]

> [!example]- Source excerpts (5)
>
> > [!quote] Stoxx Index Guide (PDF)
> > STOXX INDEX METHODOLOGY GUIDE 305/639 16. STOXX RISK BASED INDICES Review frequency The index composition is reviewed annually in December. All changes are implemented on the third Friday and effective the next trading day following the STOXX **periodic review** calendar. The cut-off date for the selection list and the ADTV data to calculate the weights is the last business day of the month precedi...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> > [!quote] Guide To Eurogov Bond Indices (PDF)
> > ocedure in case of material changes of the index IGC methodology Deviations from notification procedure in case of non-material changes of the IMC index methodology Extreme or exceptional market conditions or analogous extraordinary IGC situations to be addressed in a fast track way (e.g. Pandemic) **Periodic review** of current index methodologies (e.g. matching of underlying interest) including i...
>
> — [Guide To Eurogov Bond Indices (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/Guide_to_EUROGOV_Bond_Indices.pdf)
>
> > [!quote] Stoxx World Equity Index Guide (PDF)
> > STOXX WORLD EQUITY INDEX METHODOLOGY GUIDE 17/37 4. INDEX CHARACTERISTICS BUFFERS Buffers are used in the **periodic review**s to reduce turnover. Based on an index-specific characteristic, an upper and a lower limit is set around the index target coverage. Stocks ranked at and above the upper limit are selected for the index. The remaining stocks necessary to achieve the target coverage (fixed num...
>
> — [Stoxx World Equity Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)
>
> > [!quote] ESG Labels &amp; Standards Solution | ISS
> > s well as product specific labels or awards which can often take a combined approach. ISS ESG’s Labels & Standards Solutions can help asset managers and asset owners to meet the requirements set out in one, simple and easy to use offering. ROBUST PROCESS FOR REVIEW & VERIFICATION - ISS ESG conducts **periodic review**s scheduled to coincide with the update cycle for each regime BENEFIT FROM ISS ESG...
>
> — [ESG Labels &amp; Standards Solution | ISS](https://www.issgovernance.com/sustainability/regulatory/esg-labels-standards) — "ISS ESG|REGULATORY SOLUTIONS"
>
> > [!quote] Dax Esg Equity Family Benchmark Statement (PDF)
> > s whether this data is adequate. If STOXX assesses that the quantity of Transaction Data is inadequate it will deem this to be a Limitation and the IGC will then exercise Discretion in how to resolve the situation. STOXX does not use any models or methods of extrapolation in relation to Input Data. **Periodic review**s of all benchmarks are undertaken to ensure their Copyright © 2025 STOXX Ltd. 8
>
> — [Dax Esg Equity Family Benchmark Statement (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Resources/Regulation/DAX_ESG_Equity_Family_Benchmark_Statement.pdf)
>

---

### Price Return Index

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="88 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 88</span>


> An index variant that measures the performance of the constituent basket based solely on price changes, without accounting for dividend distributions or other income.

The price return index is the simplest form of index calculation. When a constituent pays a dividend, the price drops by approximately the dividend amount on the ex-date, and this decline is reflected in the index level. No reinvestment adjustment is made. Price return indices understate total investor returns but are widely quoted in the media (e.g., the headline Dow Jones Industrial Average level is a price return figure).

$$
\text{PRI}_t = \frac{\sum_{i=1}^{n} P_i^t \times S_i \times f_i \times \text{CF}_i}{D_t}
$$

> [!tip] Related terms
> [[#Gross Return Index]], [[#Net Return Index]], [[#Total Return Index]]

> [!example]- Source excerpts (5)
>
> > [!quote] Stoxx Digital Asset Guide (PDF)
> > STOXX® DIGITAL ASSET METHODOLOGY GUIDE 12/31 3. INDEX CHARACTERISTICS INDEX CALCULATION The indices are calculated using Laysperes formula as described in this section. 3.8.1. **PRICE RETURN INDEX** The indices are weighted based on the components’ reference prices and weighting factors: ∑𝑛 (𝑝 ∙ 𝑤𝑓 ∙𝑥 ) 𝑀 𝑖=1 𝑖𝑡 𝑖𝑡 𝑖𝑡 𝑡 𝐼𝑛𝑑𝑒𝑥 𝑡 = 𝐷 = 𝐷 𝑡 𝑡 Where: t = Time the index is computed. n = Number of assets...
>
> — [Stoxx Digital Asset Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_digital_asset_guide.pdf)
>
> > [!quote] Guide To Eurogov Bond Indices (PDF)
> > stated in conventional terms. Mod Dur To Worst The modified duration to worst of the Index stated in conventional terms. Maturity / WAL Years to effective maturity date of the bond or years to the closest coupon reset date prior to maturity. Yrs To Worst Index level Years to Worst PRR Index Val LOC **Price return index** value in local currency PRR % MTD LOC Month-to-date return of the price return...
>
> — [Guide To Eurogov Bond Indices (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/Guide_to_EUROGOV_Bond_Indices.pdf)
>
> > [!quote] Monthly Index News February 2022 (PDF)
> > 0 12000 20 3800 40 11000 3700 15 20 10000 3600 0 3500 10 9000 Jan-21 Apr-21 Jul-21 Sep-21 Dec-21 Jan-21 Apr-21 Jul-21 Sep-21 Dec-21 V-STOXX V-VSTOXX EURO STOXX 50 VDAX DAX Figure 59: V-STOXX and V-VSTOXX (primary axis). EURO STOXX 50 Figure 60: VDAX (primary axis). DAX gross return index (secondary **price return Index** (secondary axis). Mar. 2021 – Feb. 2022. Source: axis). Mar. 2021 – Feb. 2022....
>
> — [Monthly Index News February 2022 (PDF)](https://stoxx.com/monthly-index-news-february-2022)
>
> > [!quote] Monthly Index News September 2025 (PDF)
> > rmance figures for STOXX Digital assets indices, price return. Data as of Sept. 30, 2025. Source: STOXX. Index and volatility performance 700 300% 600 250% 500 200% 400 150% 300 100% 200 50% 100 0% 0 1 2 3 4 5 6 7 Oct,24 Dec,24 Feb,25 Apr,25 Jun,25 Aug,25 1 2 3 4 5 6 7 September 2025 Figure 29: EUR **price return index** performance. Oct. 2024 – Sept. Figure 30: Monthly annualized volatility analys...
>
> — [Monthly Index News September 2025 (PDF)](https://stoxx.com/monthly-index-news-september-2025)
>
> > [!quote] Monthly Index News April 2024 (PDF)
> > he STOXX Digital Asset Blue Chip X must be eligible for the FSE’s Xetra venue. Index and volatility performance 230 100% 140% 210 90% 120% 80% 190 100% 70% 170 60% 80% 150 50% 60% 130 40% 30% 40% 110 20% 20% 90 10% 70 0% 0% May-23 Jul-23 Sep-23 Nov-23 Jan-24 Mar-24 1 2 April 2024 1 2 Figure 27: EUR **price return index** performance. May 2023 – Apr. Figure 28: Monthly annualized volatility analysis...
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

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="318 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 318</span>


> The periodic process of realigning constituent weights to their target values as defined by the weighting scheme, which may also involve updating share counts, free-float factors, and capping factors.

Rebalancing corrects the weight drift that accumulates between review dates as constituent prices diverge. For equally weighted indices, rebalancing resets all weights to $1/n$. For capped free-float indices, rebalancing recalculates capping factors so that no constituent exceeds its weight ceiling. Rebalancing triggers a divisor adjustment to maintain index level continuity and is a key driver of turnover in index-tracking portfolios.

> [!tip] Related terms
> [[#Reconstitution]], [[#Divisor Adjustment]], [[#Capping]], [[#Turnover]]

> [!example]- Source excerpts (5)
>
> > [!quote] DAX: A trading impact analysis of the 15% stock cap | Blog posts | STOXX
> > oduced the DAX UCITS Capped index series. For more on the automatic capping process, please see Section 5.10 of the DAX Equity Index Methodology Guide. Conclusion A 15% capping rule has very limited impact on trading flows, representing only a small fraction of the regular trading volume around DAX **rebalancing** days, even in the case of very strong quarters for a dominant stock. With respect to ...
>
> — [DAX: A trading impact analysis of the 15% stock cap | Blog posts | STOXX](https://stoxx.com/dax-a-trading-impact-analysis-of-the-15-stock-cap) — "WHITEPAPER"
>
> > [!quote] Stoxx Strategy Guide (PDF)
> > ect EUR Net Return CH0321427129 SXW1BDSR STOXX Global Basket Diversification Select EUR Gross Return CH0321427145 SXW1BDSG 21.3. CALCULATION The index values are calculated as following: 3 𝑈 𝑡,𝑖 𝐼𝑉 =𝐼𝑉 ×∑𝑤 × 𝑡 𝑟𝑒𝑏 𝑖 𝑈 𝑟𝑒𝑏,𝑖 𝑖=1 With wi target weight of sub-index i Ureb close value of sub-index i on **rebalancing** day IVt Index value IVreb Index value on **rebalancing** day
>
> — [Stoxx Strategy Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_strategy_guide.pdf)
>
> > [!quote] Istoxx Index Guide (PDF)
> > 1Y Maturity), was used) €STR is the €STR overnight rate on trading day t-1. t−1 360 is the day-count convention for the above interest rates D is the number of calendar days between two immediate trading days t (excluded) t,t−1 and t-1 (included). I is a dummy variable calculated in respect of each **rebalancing** date T(t) (which is T(t) the **rebalancing** date immediately preceding t (included)): I ...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> > [!quote] Guide To Eurogov Bond Indices (PDF)
> > GUIDE TO THE EUROGOV® BOND INDICES 29/30 8. APPENDIX 8. APPENDIX 8.1. LIST OF FORMULA NOTATIONS AND ABBREVATIONS Ai = Accrued interest of bond i on the **rebalancing** day Ai,t = Accrued interest of bond i at time t Ai,t-s = Accrued interest of bond i on the last trading day of previous month 𝑖 = bond i = 1,…,n n = Number of bonds in the index N+ = Outstanding issue size of bond i after **rebalancing**...
>
> — [Guide To Eurogov Bond Indices (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/Guide_to_EUROGOV_Bond_Indices.pdf)
>
> > [!quote] Market Consultation Stoxx Index 20250925 (PDF)
> > 𝑦 𝑓 𝑒 𝑙 𝑎 𝑎 𝑟 𝑡 − 𝑖𝑜 𝑒𝑛 𝑛 𝑑 𝐴 𝑑𝑗𝑢𝑠𝑡𝑚𝑒𝑛𝑡 𝐹𝑎𝑐𝑡𝑜𝑟 ) 1/𝑇 1−( 𝐼𝑛𝑑𝑒𝑥 𝐺𝐻𝐺 𝐼𝑛𝑡𝑒𝑛𝑠𝑖 𝐼 𝑡 𝑛 𝑦 𝑑 𝑐𝑢 𝑒 𝑟 𝑥 𝑟𝑒 𝐺 𝑛𝑡 𝐻 ∙ 𝐺 𝐶 𝐼 𝑢 𝑛 𝑚 𝑡𝑒 𝑢 𝑛 𝑙𝑎 𝑠𝑖 𝑡 𝑡 𝑖 𝑦 𝑣 2 𝑒 0 𝐼 2 𝑛 1 𝑦 𝑓 𝑒 𝑙 𝑎 𝑎 𝑟 𝑡 − 𝑖 𝑒 𝑜 𝑛 𝑛 𝑑 𝐴 𝑑𝑗𝑢𝑠𝑡𝑚𝑒𝑛𝑡 𝐹𝑎𝑐𝑡𝑜𝑟 ) 1/(𝑌 4) where T is the number of years since 2021 schedule where Y is the number of quarterly **rebalancing**s since December 2021. g Change The review is conducted on an annual basis The review ...
>
> — [Market Consultation Stoxx Index 20250925 (PDF)](https://www.stoxx.com/document/Resources/MarketConsultation/Market_Consultation_STOXX_Index_20250925.pdf)
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
> > [!quote] Implications of Index Reconstitutions: Free Carbon Alpha? | ISS
> > Implications of Index **Reconstitution**s: Free Carbon Alpha? SEPTEMBER 22, 2022 KEY TAKEAWAYS - ISS ESG’s Climate Impact Report provides a detailed analysis of a portfolio’s carbon footprint, with 99.85% of coverage of the Russell 3000 Index. In preparing this report, the authors analysed the climate profile of $100 billion
>
> — [Implications of Index Reconstitutions: Free Carbon Alpha? | ISS](https://www.issgovernance.com/library/implications-of-index-reconstitutions-free-carbon-alpha) — "Implications of Index Reconstitutions: Free Carbon Alpha?"
>
> > [!quote] Stoxx introduces Stoxx Europe 600 ESG-X Index | ETF Strategy - ETF Strategy
> > -compliant with the UN’s Global Compact Principles – a set of core values in the areas of human rights, labour standards, the environment, and anti-corruption – are also excluded. The remaining constituents are weighted by free float-adjusted market capitalization subject to a 20% cap per security. **Reconstitution** and rebalancing occur quarterly. According to Stoxx, the new index shows a risk-re...
>
> — [Stoxx introduces Stoxx Europe 600 ESG-X Index | ETF Strategy - ETF Strategy](https://stoxx.com/stoxx-introduces-stoxx-europe-600-esg-x-index) — "Stoxx introduces Stoxx Europe 600 ESG-X Index"
>
> > [!quote] Ma Analysis (PDF)
> > Background Key Events TPG-Axon, the company’s third-largest shareholder at 6.7%, is requesting Nov 8, 2012—TPG-Axon, a 4.5% holder, delivers letter to SandRidge board re- shareholders act by written consent to replace all 7 incumbents, including the questing declassification and **reconstitution** of the board in consultation founder CEO/Chairman, on the board of SandRidge Energy. with large shareh...
>
> — [Ma Analysis (PDF)](https://www.issgovernance.com/file/2013/02/MA_analysis.pdf)
>

---

### Review Frequency

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="521 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 521</span>


> The cadence at which an index provider conducts periodic reviews, commonly expressed as quarterly (March, June, September, December), semi-annually, or annually.

STOXX uses different review frequencies across its index families. The EURO STOXX 50, for example, conducts a full reconstitution annually in September, with quarterly reviews for share and free-float updates only. More frequent reviews improve representativeness but increase turnover. The review frequency is a fundamental design choice that balances accuracy against transaction costs for index-tracking investors.

> [!tip] Related terms
> [[#Periodic Review]], [[#Reconstitution]], [[#Turnover]]

> [!example]- Source excerpts (5)
>
> > [!quote] Stoxx World Equity Index Guide (PDF)
> > s of the parent STOXX World AC Universal All Cap Equity Index, unless specified otherwise. 6.2.2. INDEX REVIEW Component selection: Each STOXX Country Index consist of the components of the parent STOXX World AC Universal All Cap Equity Index, that belong to the respective country, see Section 4.6. **Review frequency**: The **review frequency** of each STOXX Country Index is the same as the review freq...
>
> — [Stoxx World Equity Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)
>
> > [!quote] Sx5Evbt (PDF)
> > atility (VSTOXX) one-month back are observed. Depending on the relationship between realized and expected volatility, the exposure No. of components Excess, gross return (EUR): end-of-day may be adjusted. To learn more about the adjustment level and the calculation formula, please see our rulebook: **Review frequency** End-of-day: 7:15 pm CET www.stoxx.com/indices/rulebooks.html Calculation/distrib...
>
> — [Sx5Evbt (PDF)](https://www.stoxx.com/document/Indices/Factsheets/2020/May/SX5EVBT.pdf)
>
> > [!quote] Stoxx Digital Asset Guide (PDF)
> > STOXX® DIGITAL ASSET METHODOLOGY GUIDE 24/31 5. STOXX DIGITAL ASSET BLUE CHIP INDEX confined to the index capping limit and excess weight will redistributed to the remaining constituents that are below the capping limit, proportionally to their current index weights. 5.3.3. **REVIEW FREQUENCY** The review is conducted on a quarterly basis in March, June, September and December, based on the eligibl...
>
> — [Stoxx Digital Asset Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_digital_asset_guide.pdf)
>
> > [!quote] Dax Equity Index Methodology Guide 5526498614 (PDF)
> > e, General All Share and Scale All Share indices consist of all securities listed in the Prime Standard, General Standard and Scale segments of the FSE, respectively. The Regulated Market All Share contains all stocks listed on the regulated market (i.e., Prime Standard or General Standard) of FSE. **Review frequency**: The indices are rebalanced on a quarterly basis.
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> > [!quote] Stoxx Index Guide (PDF)
> > STOXX Paris-Aligned Benchmark Indices September 2024: Addition of STOXX World AC AI Market Leaders Index October 2024: Methodology update for STOXX World AC Real Estate Focused, STOXX Developed World Real Estate Focused and STOXX Europe 600 Real Estate Focused Index and minor update in the section ‘**Review Frequency**’ of STOXX Regional Industry Neutral ESG and STOXX Regional Excluding Tobacco Ind...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
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
> > [!quote] Digital Asset Indices | STOXX
> > The STOXX® Digital Asset Blue Chip index aims to track high-quality assets that represent the crypto universe. The index was launched in partnership with Bitcoin Suisse, a leading Swiss crypto-financial services provider and brings together STOXX’s transparent and **rules-based index** methodology with Bitcoin Suisse’s expertise in the crypto space. A blue-chip focus means the index does not just s...
>
> — [Digital Asset Indices | STOXX](https://stoxx.com/digital-asset-indices) — "WHITEPAPER"
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
> > [!quote] Exploring SDAX, the benchmark for German small companies | Blog posts | STOXX
> > and Information Technology are two of the most important ones, as it happens with the larger DAX. This implies that the core, global-leading prowess of Germany’s corporate sector in those two industries is equally present in both the large and small companies segments. Further, the rest of the Super**sector weighting**s show a highly diversified index. Figure 4: Super**sector weighting**s Capping alter...
>
> — [Exploring SDAX, the benchmark for German small companies | Blog posts | STOXX](https://stoxx.com/exploring-sdax-the-benchmark-for-german-small-companies) — "WHITEPAPER"
>
> > [!quote] Indian stocks shine bright, outperforming Asian markets  | Blog posts | STOXX
> > est components as of July 15, 2024. Figure 3: Top 10 index components Figure 4 displays the index’s Supersectors distribution. Banks, Technology and Industrial Goods & Services all surpass a 10% weight threshold. Overall, the Supersector distribution shows a highly diversified index. Figure 4: Super**sector weighting**s Asia’s growth story With a population of 1.4 billion, a rising middle class and...
>
> — [Indian stocks shine bright, outperforming Asian markets  | Blog posts | STOXX](https://stoxx.com/indian-stocks-shine-bright-outperforming-asian-markets) — "WHITEPAPER"
>
> > [!quote] BlackRock’s Thurner on why iShares EURO STOXX 50 ESG ETF is attractive propos...
> > tly in recent years as clients have come to define sustainability in different, more nuanced ways. Today, investing sustainably often means integrating ESG considerations into traditional exposures in a measured, pragmatic way — and this ETF was designed precisely with that in mind.” Figure 1: Super**sector weighting**s (top 10 of benchmark) What makes the iShares EURO STOXX 50 ESG ETF attractive f...
>
> — [BlackRock’s Thurner on why iShares EURO STOXX 50 ESG ETF is attractive propos...](https://stoxx.com/blackrocks-thurner-on-why-ishares-euro-stoxx-50-esg-etf-is-attractive-proposition-for-both-retail-and-institutional-investors) — "WHITEPAPER"
>
> > [!quote] Stoxx Infographic Stoxxeurope600 (PDF)
> > ndicates a less U.S. Equities expensive market valuation. 14.1x STOXX Europe 600 21.7x U.S. 14.8x Asia Pacific Source: STOXX. Data as of March 31st, 2025. The U.S. and Asia-Pacific are represented by STOXX USA 500 and STOXX Asia/Pacific 600 indices. S E C T O R W E I G H T I N G S Europe Versus the **Sector weighting**s of the STOXX Europe 600 skew towards defensive sectors, which tend to be more s...
>
> — [Stoxx Infographic Stoxxeurope600 (PDF)](https://stoxx.com/wp-content/uploads/2025/06/STOXX_Infographic_STOXXEurope600.pdf)
>
> > [!quote] Mind the (Generation) Gap | Whitepapers | STOXX
> > indices In this paper we evaluate two thematic investment strategies – STOXX® Global Ageing Population (“Ageing Population”) and STOXX® Global Millennials (“Millennials”) – which seek exposure to these two distinct generations. Our research identified vast differences across style characteristics, **sector weighting**s and especially performance, with Millennials consistently outpacing the older fo...
>
> — [Mind the (Generation) Gap | Whitepapers | STOXX](https://stoxx.com/mind-the-generation-gap-whitepaper) — "WHITEPAPER"
>

---

### Selection Criteria

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="70 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 70</span>


> The specific quantitative and qualitative rules — beyond basic eligibility — used to rank and choose constituents from the eligible universe, typically based on market capitalization rank, liquidity thresholds, sector representation, or factor scores.

Selection criteria determine which securities from the eligible universe actually enter the index. For a benchmark like the STOXX Europe 600, selection is primarily by free-float market capitalization rank within size segments (large, mid, small). For thematic or strategy indices, selection may incorporate ESG scores, factor exposures, or fundamental metrics. Buffer rules are applied during selection to manage turnover.

> [!tip] Related terms
> [[#Eligibility Criteria]], [[#Buffer Rule]], [[#Index Universe]], [[#Selection List]]

> [!example]- Source excerpts (5)
>
> > [!quote] Monthly Index News June 2023 (PDF)
> > ay, the DAX family serves as underlying for hundreds of thousands of financial products — from ETFs to listed derivatives and structured products. In 2020, the DAX’s biggest methodology reform since inception kicked off. New rules were introduced to bolster the quality of member companies and bring **selection criteria** in line with international standards. The number of constituents was expanded ...
>
> — [Monthly Index News June 2023 (PDF)](https://stoxx.com/monthly-index-news-june-2023)
>
> > [!quote] Stoxx Digital Asset Guide (PDF)
> > and Base Dates: 1000 as of 22/03/2021. Index Types and Currencies: Price Return in USD and EUR. Index Dissemination: Index calculated realtime from 09:00:00 – 17:50:00 CET. Official close price is the price as of 17:00:00 CET. Index Dissemination Calendar: STOXX Global Calendar. INDEX REVIEW 5.3.1. **SELECTION CRITERIA** Assets are selected based on a multi-step procedure which seeks to identify th...
>
> — [Stoxx Digital Asset Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_digital_asset_guide.pdf)
>
> > [!quote] Stoxx World Equity Index Guide (PDF)
> > STOXX WORLD EQUITY INDEX METHODOLOGY GUIDE 10/37 3. COVERAGE Application of the **selection criteria** for the STOXX World country classification in 2022: Criteria Developed Emerging Frontier Economic Development Country GNI per capita 25% above the World Bank GNI Per Capita* No requirement No requirement high income threshold for 3 consecutive years Governance Score Governance S
>
> — [Stoxx World Equity Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)
>
> > [!quote] Dax Equity Index Methodology Guide 5526498614 (PDF)
> > the DAXplus Family 30 is updated and published on the fourth trading day in March. The cutoff date is the last trading day in February. Component selection: The DAXplus Family is an all-share index comprising all stocks listed on the Frankfurt Stock Exchange’s Prime Standard that meet the specific **selection criteria** for family enterprises. For this purpose, family enterprises are characterized ...
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> > [!quote] New thematic ETF tracks booming ETF industry | Blog posts | STOXX
> > turn to the cost-efficient and practical vehicles to implement investment strategies and manage portfolios. Among the latest developments spurring growth are factor-based and thematic strategies, funds covering fixed-income markets, new strategies following ESG principles and so-called active ETFs. **Selection criteria** Stock selection into the STOXX USA ETF Industry index starts with all securiti...
>
> — [New thematic ETF tracks booming ETF industry | Blog posts | STOXX](https://stoxx.com/new-thematic-etf-tracks-booming-etf-industry) — "WHITEPAPER"
>

---

### Selection List

<span style="background:red; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1,065 mentions across STOXX & ISS pages (high)">▰▰▰▰▰▰ 1,065</span>


> The ordered ranking of eligible securities — typically sorted by free-float market capitalization or another primary criterion — from which the final index constituents are drawn during reconstitution.

The selection list is the intermediate output of the index construction process, produced after eligibility screening but before the application of buffer rules and final constituent determination. STOXX constructs the selection list at each periodic review by ranking all eligible securities according to the index's primary selection criterion. Buffer rules are then applied to determine which securities are added or retained and which are removed.

> [!tip] Related terms
> [[#Selection Criteria]], [[#Reconstitution]], [[#Buffer Rule]]

> [!example]- Source excerpts (10)
>
> > [!quote] Stoxx Index Guide (PDF)
> > X Emerging Markets Equity Factor Index, STOXX International Small-Cap Equity Factor Index and STOXX Global Equity Factor Index. December 2022(2): Amendment of the methodology of the STOXX Global Metaverse Index. Changes to be effective with March 2023 review. December 2022(3): Rule clarification of **selection list**s during review month. This is a correction to the November 2022(2): Rule clarifica...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> > [!quote] Index Files Guide 20230619 (PDF)
> > FILES GUIDE 13 FF Mcap (MEUR) Free float market capitalization in Millions in currency EUR Number 8 14 Rank (FINAL) Rank in the **selection list** Number 0 15 Rank (PREVIOUS) Previous rank in the **selection list** Number 0 16 Comment Text 255 New Ranking of constituents, applicable for indices which are 17 Rank 2 (FINAL) Number 0 using a double ranking methodology. Rank 2 Previous Ranking of constitue...
>
> — [Index Files Guide 20230619 (PDF)](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)
>
> > [!quote] Dax Equity Index Methodology Guide 5526498614 (PDF)
> > mine their individual constituents’ weights. Price-weighted indices are weighted by the price plus another weighting factor. For details on the calculation formula used, see the DAX Equity Index Calculation Guide and the definition of weighting factors provided in section 5.9 of this document. 4.2. **SELECTION LIST**S **Selection list**s are produced for indices that have a fixed number of constituents...
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> > [!quote] Stoxx Index Guide (PDF)
> > X Emerging Markets Equity Factor Index, STOXX International Small-Cap Equity Factor Index and STOXX Global Equity Factor Index. December 2022(2): Amendment of the methodology of the STOXX Global Metaverse Index. Changes to be effective with March 2023 review. December 2022(3): Rule clarification of **selection list**s during review month. This is a correction to the November 2022(2): Rule clarifica...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> > [!quote] Index Files Guide 20230619 (PDF)
> > FILES GUIDE 13 FF Mcap (MEUR) Free float market capitalization in Millions in currency EUR Number 8 14 Rank (FINAL) Rank in the **selection list** Number 0 15 Rank (PREVIOUS) Previous rank in the **selection list** Number 0 16 Comment Text 255 New Ranking of constituents, applicable for indices which are 17 Rank 2 (FINAL) Number 0 using a double ranking methodology. Rank 2 Previous Ranking of constitue...
>
> — [Index Files Guide 20230619 (PDF)](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)
>
> > [!quote] Dax Equity Index Methodology Guide 5526498614 (PDF)
> > mine their individual constituents’ weights. Price-weighted indices are weighted by the price plus another weighting factor. For details on the calculation formula used, see the DAX Equity Index Calculation Guide and the definition of weighting factors provided in section 5.9 of this document. 4.2. **SELECTION LIST**S **Selection list**s are produced for indices that have a fixed number of constituents...
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> > [!quote] ESG Index Geared to Structured Products | Blog posts | STOXX
> > renewable-energy initiatives, according to the thorough environmental data rankings from CDP. It excludes firms deemed in contravention of UN Global Compact Principles by Sustainalytics, as well as those involved in controversial weapons activities, and in the coal and tobacco sectors. Creating the **selection list** Within the benchmark universe, the following selection filters are applied: - The ...
>
> — [ESG Index Geared to Structured Products | Blog posts | STOXX](https://stoxx.com/esg-index-geared-to-structured-products) — "WHITEPAPER"
>
> > [!quote] Dax Equity Indices Simulation Phase–From Dec 18 2023 To February 29 2024 (PDF)
> > ices is scheduled from December 18th, 2023 to February 29th, 2024. On December 18th, 2023, the DAX Equity Indices Simulation phase will start with the display of DAX Daily Equity files, and Corporate Actions Forecasts available to all DAX Licensees. The Review files for the Review of December 2023 (**Selection List**s, Components Announcements and Underlying Data Announcements) will be produced bas...
>
> — [Dax Equity Indices Simulation Phase–From Dec 18 2023 To February 29 2024 (PDF)](https://www.stoxx.com/document/News/2023/October/DAX_Equity_Indices_Simulation_Phase–from_Dec_18_2023_to_February_29_2024.pdf)
>
> > [!quote] ESG Index Geared to Structured Products | Blog posts | STOXX
> > renewable-energy initiatives, according to the thorough environmental data rankings from CDP. It excludes firms deemed in contravention of UN Global Compact Principles by Sustainalytics, as well as those involved in controversial weapons activities, and in the coal and tobacco sectors. Creating the **selection list** Within the benchmark universe, the following selection filters are applied: - The ...
>
> — [ESG Index Geared to Structured Products | Blog posts | STOXX](https://stoxx.com/esg-index-geared-to-structured-products) — "WHITEPAPER"
>
> > [!quote] Dax Equity Indices Simulation Phase–From Dec 18 2023 To February 29 2024 (PDF)
> > ices is scheduled from December 18th, 2023 to February 29th, 2024. On December 18th, 2023, the DAX Equity Indices Simulation phase will start with the display of DAX Daily Equity files, and Corporate Actions Forecasts available to all DAX Licensees. The Review files for the Review of December 2023 (**Selection List**s, Components Announcements and Underlying Data Announcements) will be produced bas...
>
> — [Dax Equity Indices Simulation Phase–From Dec 18 2023 To February 29 2024 (PDF)](https://www.stoxx.com/document/News/2023/October/DAX_Equity_Indices_Simulation_Phase–from_Dec_18_2023_to_February_29_2024.pdf)
>

---

### Simulation

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="37 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 37</span>


> The process of applying an index methodology retroactively to historical data to generate a hypothetical back-tested performance track record for a period before the index was officially launched.

Simulated (back-tested) data allows index users to evaluate how an index would have performed under various market conditions. STOXX clearly distinguishes between live and simulated data in its publications. It is important to note that simulated performance does not reflect actual trading, does not account for transaction costs, and may incorporate survivorship bias or look-ahead bias. Regulatory standards require clear disclosure when simulated data is presented.

> [!tip] Related terms
> [[#Base Date]], [[#Base Value]], [[#Tracking Error]]

> [!example]- Source excerpts (5)
>
> > [!quote] Dax Equity Indices Simulation Phase–From Dec 18 2023 To February 29 2024 (PDF)
> > bruary 29th, 2024 Dear Customer, STOXX Ltd., the operator of Qontigo’s index business and a global provider of innovative and tradable index concepts, provides hereafter information related to the **Simulation** Phase for DAX Equity Indices scheduled from December 18th, 2023 to February 29th, 2024. The **Simulation** Phase for DAX Equity Indices aims at allowing DAX Index Licensees to understand the ap...
>
> — [Dax Equity Indices Simulation Phase–From Dec 18 2023 To February 29 2024 (PDF)](https://www.stoxx.com/document/News/2023/October/DAX_Equity_Indices_Simulation_Phase–from_Dec_18_2023_to_February_29_2024.pdf)
>
> > [!quote] The industrial Metaverse – beyond gaming and social media | Blog posts | STOXX
> > cas of physical assets — or digital twins. Digital twins: more than just an online **simulation** Digital twins are virtual representations of real-world objects or processes that can be used to model entire factories, product lifecycles and supply chains. But what distinguishes them from simple online **simulation**s is the fact that they are linked to, and continuously collect data from, their physic...
>
> — [The industrial Metaverse – beyond gaming and social media | Blog posts | STOXX](https://stoxx.com/the-industrial-metaverse-beyond-gaming-and-social-media) — "WHITEPAPER"
>
> > [!quote] Technical Migration New Index Data Distribution System And New File Formats F... (PDF)
> > (Web & iSFTP) granted - October 2023: New iSFTP folder structure is available and DAX clients can access “new set of Index Data for live DAX Strategy and Fixed Income Indices”, as well as Ranking Lists for applicable DAX Equity Indices - December 2023: Index Data are displayed for the temporary DAX **Simulation** of the DAX Equity indices (see Announcement related to the Index Methodology changes t...
>
> — [Technical Migration New Index Data Distribution System And New File Formats F... (PDF)](https://www.stoxx.com/document/News/2023/March/Technical_Migration-New_Index_Data_Distribution_System_and_New_File_Formats_for_DAX_Indices_20230327_3457284624.pdf)
>
> > [!quote] CSP Reports | STOXX
> > ks Withholding tax Sector classification changes Country classification Dissemination Data and reports End of the day data Index values & divisors Currency rates Historical component changes DAX legacy reports Corporate actions Periodic review information Selection lists Review reports Monthly data **Simulation** files Services Index licensing License agreement form Academic data iNAV Announcements...
>
> — [CSP Reports | STOXX](https://stoxx.com/csp-reports) — "WHITEPAPER"
>
> > [!quote] Tesla’s place in a US stock benchmark | Blog posts | STOXX
> > ates based on the **simulation** show that Tesla accounted for more than 1 percentage point of the benchmark’s gross performance. The extra returns would not have come at the cost of any significant increase in volatility, decrease in the overall dividend yield or material tracking error, based on this **simulation**. The extra return may also help explain some of this year’s outperformance of the STOX...
>
> — [Tesla’s place in a US stock benchmark | Blog posts | STOXX](https://stoxx.com/teslas-place-in-a-us-stock-benchmark) — "WHITEPAPER"
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
> > [!quote] A view from COP26: navigating the climate transition with investable indices ...
> > ed products, most use carbon emissions to target carbon reduction.” In the CTI indices, we move beyond carbon emissions and “look at what the valuation risk is going to be at the company level, and bring that to life in an index.” The index methodology translates “the CTVaR data into a rules-based, **systematic index** and the key is the probability distribution of that data equated into the weight...
>
> — [A view from COP26: navigating the climate transition with investable indices ...](https://stoxx.com/a-view-from-cop26-navigating-the-climate-transition-with-investable-indices) — "WHITEPAPER"
>
> > [!quote] Willis Towers Watson and Qontigo launch pioneering STOXX Global Index Series ...
> > e Transition Analytics Senior Director, Willis Towers Watson “Understanding and addressing climate transition risk is essential to investment decisions today. Together with Willis Towers Watson, we leveraged our open architecture to translate the Willis Towers Watson CTVaR model into a transparent, **systematic index** solution.” Neal Pawar, Chief Operating Officer at Qontigo About Willis Towers Wa...
>
> — [Willis Towers Watson and Qontigo launch pioneering STOXX Global Index Series ...](https://stoxx.com/willis-towers-watson-and-qontigo-launch-pioneering-stoxx-global-index-series-that-quantifies-the-climate-transition-risk-of-companies) — "WHITEPAPER"
>
> > [!quote] An Analysis of Thematic Portfolios Construction, Risk and Returns | Blog post...
> > hence indicating a relatively favorable stock selection. A bias towards growth was observed in most of the thematic indices, which could be expected since thematic indices attempt to obtain exposure to megatrends as they are evolving. Particular risk and return characteristics as key elements Using **systematic index**-based approaches, investors may obtain exposure to megatrends that are shaping o...
>
> — [An Analysis of Thematic Portfolios Construction, Risk and Returns | Blog post...](https://stoxx.com/an-analysis-of-thematic-portfolios-construction-risk-and-returns) — "WHITEPAPER"
>

---

## T

### Total Return Index

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="46 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 46</span>


> A generic term for an index variant that accounts for both price appreciation and the reinvestment of dividends and other cash distributions, encompassing both gross return and net return variants.

"Total return index" is often used as a shorthand for either the gross or net return version, depending on context. The key distinction from a price return index is that dividends are treated as reinvested (in full or after tax) rather than lost. For performance measurement and fund benchmarking, total return indices are the appropriate comparison because they reflect the full economic return earned by an equity investor.

> [!tip] Related terms
> [[#Gross Return Index]], [[#Net Return Index]], [[#Price Return Index]]

> [!example]- Source excerpts (5)
>
> > [!quote] Dax Strategy Index Guide (PDF)
> > .2. CALCULATION The excess return index is calculated as follows: 𝐹 𝐼ER =𝐼ER ⋅ k,t 𝑡 𝑡−1 𝐹 k,t−1 The **total return index** is calculated as follows: 𝐹 𝑑 𝐼TR =𝐼TR ⋅( k,t + ⋅𝑅 ) 𝑡 𝑡−1 𝐹 360 f, t−1 k,t−1 Where: 𝐼ER = Excess return index value on day (t) - Unrounded t-1 value used for 𝑡 calculation. 𝐼TR = **Total return index** value on day (t) - Unrounded t-1 value used for calculation. 𝑡 𝐹 = Settlement ...
>
> — [Dax Strategy Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)
>
> > [!quote] Index Files Guide 20230619 (PDF)
> > , where YYYYMMDD is the publication date  With xxxxx being the Main Index Symbol  File type: .csv  File specification: comma separated  File frequency: Monthly Column Data Data Attribute Description ID Type Format 1 Date Report date Date yyyy-mm-dd 2 ISIN_CPi Price index ISIN Text 12 3 ISIN_TRi **Total return index** ISIN Text 12 4 Index Index name Text 255 5 ISIN Bond ISIN Text 12 6 Issuer Nam...
>
> — [Index Files Guide 20230619 (PDF)](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)
>
> > [!quote] Dax Equity Index Methodology Guide 5526498614 (PDF)
> > e DAXglobal Austria Mid-Cap Effective Version 1.13 O ct. 2007 − Launch of the DAXglobal Sarasin Sustainability Germany − Launch of the DAXglobal Sarasin Sustainability Switzerland Effective Version 1.12 Sept. 2007 − Changes to withholding tax − Changes to the adjustment of the DAXglobal Emerging 11 **total return index** using net dividends Effective Version 1.11 A ug. 2007 − Change in the calculat...
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> > [!quote] Guide To Eurogov Bond Indices (PDF)
> > alancing. The calculated transaction cost will be applied to the first day’s performance and will be constant throughout the calendar month until the following rebalancing. Please consult ICE Bond Index Methodologies’ Guide at www.ice.com for further details around transaction cost calculation. For **total return index**, the monthly adjustment involves the reinvestment of coupon payments in the ov...
>
> — [Guide To Eurogov Bond Indices (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/Guide_to_EUROGOV_Bond_Indices.pdf)
>
> > [!quote] Landesbank Baden-Württemberg lizenziert DAX 50 ESG Decrement-Index für strukt...
> > z. Der Decrement-Mechanismus hilft Emittenten, das Dividendenrisiko abzusichern. Er beinhaltet den täglichen Abzug eines vorab festgelegten Betrags in absoluten Zahlen oder Prozentsätzen vom Niveau des Basiswerts oder der Gesamtrendite. Durch den Verkauf eines strukturierten Produkts, das auf einem Total-Return-Index mit einem Abschlag basiert, ist der Emittent gegen Dividendenausfälle geschütz...
>
> — [Landesbank Baden-Württemberg lizenziert DAX 50 ESG Decrement-Index für strukt...](https://stoxx.com/landesbank-baden-wurttemberg-lizenziert-dax-50-esg-decrement-index-fur-strukturierte-produkte) — "WHITEPAPER"
>

---

### Tracking Error

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="468 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 468</span>


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
> > [!quote] Tracking error: making sense of a key investment statistic | Blog posts | STOXX
> > hese days with the growth of sustainable strategies. While the pursuit of environmental, social or governance (ESG) objectives can exist outside the traditional risk/return matrix, in reality, returns and risk cannot simply be ignored. This notion is a key reason why many sustainable strategies are **tracking error**-aware. With this in mind, a new article[1] from Hamish Seegopaul, Global Head for ...
>
> — [Tracking error: making sense of a key investment statistic | Blog posts | STOXX](https://stoxx.com/tracking-error-making-sense-of-a-key-investment-statistic) — "WHITEPAPER"
>
> > [!quote] Tracking error: making sense of a key investment statistic | Blog posts | STOXX
> > hese days with the growth of sustainable strategies. While the pursuit of environmental, social or governance (ESG) objectives can exist outside the traditional risk/return matrix, in reality, returns and risk cannot simply be ignored. This notion is a key reason why many sustainable strategies are **tracking error**-aware. With this in mind, a new article[1] from Hamish Seegopaul, Global Head for ...
>
> — [Tracking error: making sense of a key investment statistic | Blog posts | STOXX](https://stoxx.com/tracking-error-making-sense-of-a-key-investment-statistic) — "WHITEPAPER"
>
> > [!quote] Tracking Error 101: The Intuition Behind Measurement and Control | Whitepaper...
> > This article provides a high-level refresher of what **tracking error** means, and how we can embed it directly into portfolio construction. When we design a benchmarked portfolio, every design choice that takes us away from the benchmark has a consequence, and every consequence has a risk. **Tracking error** (TE) – the humble statistic that serves as a measu
>
> — [Tracking Error 101: The Intuition Behind Measurement and Control | Whitepaper...](https://stoxx.com/tracking-error-101-the-intuition-behind-measurement-and-control) — "WHITEPAPER"
>
> > [!quote] Tracking Error 101: The Intuition Behind Measurement and Control | Whitepaper...
> > This article provides a high-level refresher of what **tracking error** means, and how we can embed it directly into portfolio construction. When we design a benchmarked portfolio, every design choice that takes us away from the benchmark has a consequence, and every consequence has a risk. **Tracking error** (TE) – the humble statistic that serves as a measu
>
> — [Tracking Error 101: The Intuition Behind Measurement and Control | Whitepaper...](https://stoxx.com/tracking-error-101-the-intuition-behind-measurement-and-control) — "WHITEPAPER"
>
> > [!quote] APG, BlackRock and the SDI AOP: Ways to align portfolios with the UN SDGs | B...
> > tfolio that invests with all criteria, including the SDGs (Figure 1). Figure 1 – iSTOXX APG RI index family The trade-off between impact and **tracking error** Hamish Seegopaul, Head of Index R&D at Qontigo, explained during the panel that one overall aim of the iSTOXX APG RI indices is to minimize the **tracking error** to the benchmark, a key consideration for benchmark-focused investors. “There is a...
>
> — [APG, BlackRock and the SDI AOP: Ways to align portfolios with the UN SDGs | B...](https://stoxx.com/apg-blackrock-and-the-sdi-aop-ways-to-align-portfolios-with-the-un-sdgs) — "WHITEPAPER"
>
> > [!quote] APG, BlackRock and the SDI AOP: Ways to align portfolios with the UN SDGs | B...
> > tfolio that invests with all criteria, including the SDGs (Figure 1). Figure 1 – iSTOXX APG RI index family The trade-off between impact and **tracking error** Hamish Seegopaul, Head of Index R&D at Qontigo, explained during the panel that one overall aim of the iSTOXX APG RI indices is to minimize the **tracking error** to the benchmark, a key consideration for benchmark-focused investors. “There is a...
>
> — [APG, BlackRock and the SDI AOP: Ways to align portfolios with the UN SDGs | B...](https://stoxx.com/apg-blackrock-and-the-sdi-aop-ways-to-align-portfolios-with-the-un-sdgs) — "WHITEPAPER"
>
> > [!quote] Green efficient frontiers: Minimizing the risk impact of exclusions in sustai...
> > or is consistently lower for the optimized portfolio over time. Furthermore, the analysts also found a more consistent stream of active returns in the optimized portfolio relative to the standard one. How does the optimizer work? The authors then explore how the optimizer is able to achieve a lower **tracking error** and what the resulting portfolio looks like. The study shows that the optimized po...
>
> — [Green efficient frontiers: Minimizing the risk impact of exclusions in sustai...](https://stoxx.com/green-efficient-frontiers-minimizing-the-risk-impact-of-exclusions-in-sustainable-portfolios) — "WHITEPAPER"
>
> > [!quote] Green efficient frontiers: Minimizing the risk impact of exclusions in sustai...
> > or is consistently lower for the optimized portfolio over time. Furthermore, the analysts also found a more consistent stream of active returns in the optimized portfolio relative to the standard one. How does the optimizer work? The authors then explore how the optimizer is able to achieve a lower **tracking error** and what the resulting portfolio looks like. The study shows that the optimized po...
>
> — [Green efficient frontiers: Minimizing the risk impact of exclusions in sustai...](https://stoxx.com/green-efficient-frontiers-minimizing-the-risk-impact-of-exclusions-in-sustainable-portfolios) — "WHITEPAPER"
>
> > [!quote] Market Consultation Stoxx Index 20250925 (PDF)
> > Budget Risk is calculated 𝑗 𝑐𝑎𝑟𝑏𝑜𝑛 𝑏𝑢𝑑𝑔𝑒𝑡 𝑖,𝑗 as: 𝐶𝐵𝑅 = 𝑖 ∑𝜑 𝑗 𝐶𝐵𝑅 𝑖 ∑𝑐𝑎𝑟𝑏𝑜𝑛 𝑏𝑢𝑑𝑔𝑒𝑡 − ∑𝑐𝑎𝑟𝑏𝑜𝑛 𝑒𝑚𝑖𝑠𝑠𝑖𝑜𝑛𝑠 𝑖,𝑗 𝑖,𝑘 =− where: ∑𝑐𝑎𝑟𝑏𝑜𝑛 𝑏𝑢𝑑𝑔𝑒𝑡 𝑖,𝑗 𝜑 𝑗 =(1−𝜆)∗𝜆𝑗, 𝑗 Where: =0,… ,2050−𝑐𝑢𝑟𝑟𝑒𝑛𝑡 𝑦𝑒𝑎𝑟 j = 2020, …, 2050 𝜆=0.94 (standard decay factor) k = 2020, …, current year e Add tracking At most 1.5% ex-ante **tracking error** relative to the error parent index. To compute the **tracking error**, constraint STOX...
>
> — [Market Consultation Stoxx Index 20250925 (PDF)](https://www.stoxx.com/document/Resources/MarketConsultation/Market_Consultation_STOXX_Index_20250925.pdf)
>
> > [!quote] Market Consultation Stoxx Index 20250925 (PDF)
> > Budget Risk is calculated 𝑗 𝑐𝑎𝑟𝑏𝑜𝑛 𝑏𝑢𝑑𝑔𝑒𝑡 𝑖,𝑗 as: 𝐶𝐵𝑅 = 𝑖 ∑𝜑 𝑗 𝐶𝐵𝑅 𝑖 ∑𝑐𝑎𝑟𝑏𝑜𝑛 𝑏𝑢𝑑𝑔𝑒𝑡 − ∑𝑐𝑎𝑟𝑏𝑜𝑛 𝑒𝑚𝑖𝑠𝑠𝑖𝑜𝑛𝑠 𝑖,𝑗 𝑖,𝑘 =− where: ∑𝑐𝑎𝑟𝑏𝑜𝑛 𝑏𝑢𝑑𝑔𝑒𝑡 𝑖,𝑗 𝜑 𝑗 =(1−𝜆)∗𝜆𝑗, 𝑗 Where: =0,… ,2050−𝑐𝑢𝑟𝑟𝑒𝑛𝑡 𝑦𝑒𝑎𝑟 j = 2020, …, 2050 𝜆=0.94 (standard decay factor) k = 2020, …, current year e Add tracking At most 1.5% ex-ante **tracking error** relative to the error parent index. To compute the **tracking error**, constraint STOX...
>
> — [Market Consultation Stoxx Index 20250925 (PDF)](https://www.stoxx.com/document/Resources/MarketConsultation/Market_Consultation_STOXX_Index_20250925.pdf)
>

---

### Turnover

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="692 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 692</span>


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
> > [!quote] DAX Index Grows to 40 Constituents – Looking at Impact on Market Cap and Liqu...
> > lion from EUR 40.8 billion, Qontigo data show. While most entrants are smaller than existing constituents, there is one exception with Airbus SE. The maker of airplanes is the fifth-largest company on the Frankfurt Stock Exchange (FSE), but had up to now failed to enter the DAX as its local trading **turnover** was smaller than that of other candidate stocks. Elimination of **turnover** requirement Tha...
>
> — [DAX Index Grows to 40 Constituents – Looking at Impact on Market Cap and Liqu...](https://stoxx.com/dax-index-grows-to-40-constituents-looking-at-impact-on-market-cap-and-liquidity) — "WHITEPAPER"
>
> > [!quote] New Whitepaper Looks at Trading Characteristics of EURO STOXX 50 ESG Index | ...
> > Larger portfolios would lead to longer trading periods. “This increase in the time taken to trade is unlikely to be a huge concern in the case of portfolio sizes of similar order of magnitude,” the authors write. Figure 1 – Increase in estimated trading days for the index over the benchmark Higher **turnover** Because the EURO STOXX 50 ESG Index is reviewed and rebalanced every quarter, as opposed ...
>
> — [New Whitepaper Looks at Trading Characteristics of EURO STOXX 50 ESG Index | ...](https://stoxx.com/new-whitepaper-looks-at-trading-characteristics-of-euro-stoxx-50-esg-index) — "WHITEPAPER"
>
> > [!quote] Evaluating the true cost of momentum investing | Blog posts | STOXX
> > sal in the past month. Limiting **turnover** in a world of fast information decay Portfolios are constantly trading newly available information, but must do so bearing transaction costs in mind. Because today there is a high information decay – faster, real-time news becomes old news soon – the rate of **turnover** becomes a crucial component. The iSTOXX Factor indices have a monthly turnover limit of ...
>
> — [Evaluating the true cost of momentum investing | Blog posts | STOXX](https://stoxx.com/evaluating-the-true-cost-of-momentum-investing) — "WHITEPAPER"
>
> > [!quote] DAX Index Grows to 40 Constituents – Looking at Impact on Market Cap and Liqu...
> > lion from EUR 40.8 billion, Qontigo data show. While most entrants are smaller than existing constituents, there is one exception with Airbus SE. The maker of airplanes is the fifth-largest company on the Frankfurt Stock Exchange (FSE), but had up to now failed to enter the DAX as its local trading **turnover** was smaller than that of other candidate stocks. Elimination of **turnover** requirement Tha...
>
> — [DAX Index Grows to 40 Constituents – Looking at Impact on Market Cap and Liqu...](https://stoxx.com/dax-index-grows-to-40-constituents-looking-at-impact-on-market-cap-and-liquidity) — "WHITEPAPER"
>
> > [!quote] New Whitepaper Looks at Trading Characteristics of EURO STOXX 50 ESG Index | ...
> > Larger portfolios would lead to longer trading periods. “This increase in the time taken to trade is unlikely to be a huge concern in the case of portfolio sizes of similar order of magnitude,” the authors write. Figure 1 – Increase in estimated trading days for the index over the benchmark Higher **turnover** Because the EURO STOXX 50 ESG Index is reviewed and rebalanced every quarter, as opposed ...
>
> — [New Whitepaper Looks at Trading Characteristics of EURO STOXX 50 ESG Index | ...](https://stoxx.com/new-whitepaper-looks-at-trading-characteristics-of-euro-stoxx-50-esg-index) — "WHITEPAPER"
>
> > [!quote] Evaluating the true cost of momentum investing | Blog posts | STOXX
> > sal in the past month. Limiting **turnover** in a world of fast information decay Portfolios are constantly trading newly available information, but must do so bearing transaction costs in mind. Because today there is a high information decay – faster, real-time news becomes old news soon – the rate of **turnover** becomes a crucial component. The iSTOXX Factor indices have a monthly turnover limit of ...
>
> — [Evaluating the true cost of momentum investing | Blog posts | STOXX](https://stoxx.com/evaluating-the-true-cost-of-momentum-investing) — "WHITEPAPER"
>
> > [!quote] New ESG-X Select Dividend Indices Combine Income Strategy with Sustainability...
> > ional market, hence choosing stand-out payers in each market and avoiding unintended country tilts. Those ranked highest enter the index whenever an existing constituent falls below a pre-determined threshold. In this way, current members are given precedence over candidate stocks to keep the index **turnover** low. The indices are price-weighted with a weighting factor based on the dividend yield....
>
> — [New ESG-X Select Dividend Indices Combine Income Strategy with Sustainability...](https://stoxx.com/new-esg-x-select-dividend-indices-combine-income-sustainability) — "WHITEPAPER"
>
> > [!quote] New ESG-X Select Dividend Indices Combine Income Strategy with Sustainability...
> > ional market, hence choosing stand-out payers in each market and avoiding unintended country tilts. Those ranked highest enter the index whenever an existing constituent falls below a pre-determined threshold. In this way, current members are given precedence over candidate stocks to keep the index **turnover** low. The indices are price-weighted with a weighting factor based on the dividend yield....
>
> — [New ESG-X Select Dividend Indices Combine Income Strategy with Sustainability...](https://stoxx.com/new-esg-x-select-dividend-indices-combine-income-sustainability) — "WHITEPAPER"
>
> > [!quote] Stoxx World Equity Index Guide (PDF)
> > , the liquidity requirements can be lowered or the period index review can be postponed to the next quarterly review date. In such cases, the composition remains unchanged, but new weighting factors will be implemented. Market participants will be notified of such changes in a timely manner. 4.4.2. **TURNOVER** RATIO The annualized **turnover** ratio is defined as the median value of the daily traded v...
>
> — [Stoxx World Equity Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)
>
> > [!quote] Stoxx World Equity Index Guide (PDF)
> > , the liquidity requirements can be lowered or the period index review can be postponed to the next quarterly review date. In such cases, the composition remains unchanged, but new weighting factors will be implemented. Market participants will be notified of such changes in a timely manner. 4.4.2. **TURNOVER** RATIO The annualized **turnover** ratio is defined as the median value of the daily traded v...
>
> — [Stoxx World Equity Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)
>

---

## W

### Weighting Scheme

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="631 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 631</span>


> The methodology that determines how the index's total value is allocated across its constituents, defining each security's influence on the index level; common schemes include free-float market-capitalization weighting, equal weighting, price weighting, and fundamental weighting.

The weighting scheme is one of the most consequential design decisions in index construction. It determines the risk-return profile, sector tilts, capacity, and rebalancing needs of any portfolio tracking the index. STOXX offers indices across all major weighting schemes, though free-float market-capitalization weighting is the default for its flagship benchmark families. The choice of weighting scheme directly affects turnover, tracking error, and the economic exposures embedded in the index.

> [!tip] Related terms
> [[#Free-Float Market Capitalization Weighting]], [[#Market Capitalization Weighting]], [[#Equal Weighting]], [[#Fundamental Weighting]], [[#Price Weighting]]

> [!example]- Source excerpts (5)
>
> > [!quote] Stoxx Index Guide (PDF)
> > lio based indices, the individual component selection process and **weighting scheme**s » The STOXX World Equity Index Methodology guide contains the index specific rules regarding the construction and derivation of the STOXX World portfolio based indices, the individual component selection process and **weighting scheme**s » The STOXX Strategy Index guide contains the formulas and description of all s...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> > [!quote] New iShares UCITS ETF tracking STOXX index targets quantum computing leaders ...
> > um Computing Score. Companies are ranked in descending order based on this last score. The top 30 companies with more than one active quantum computing patent are selected for inclusion in the STOXX Global Quantum Computing Index. Figure 1: Number of quantum patents identified in index construction **Weighting scheme** Index constituents are weighted according to their exponential quantum computing...
>
> — [New iShares UCITS ETF tracking STOXX index targets quantum computing leaders ...](https://stoxx.com/new-ishares-ucits-etf-tracking-stoxx-index-targets-quantum-computing-leaders) — "WHITEPAPER"
>
> > [!quote] Results Of Market Consultation Euro Stoxx 50 Esg 20210322 (PDF)
> > hodology of the EURO STOXX 50 ESG index, published on February 17th, 2021. In specific, the consultation related to the introduction of a new exclusion screen (Military Contracting), the increase in the number of securities excluded in Steps 1 and 2 of the methodology, the replacement rules and the **weighting scheme** of the EURO STOXX 50 ESG index. Results Overall, the respondents agreed with the...
>
> — [Results Of Market Consultation Euro Stoxx 50 Esg 20210322 (PDF)](https://www.stoxx.com/document/Resources/MarketConsultation/Results_of_Market_Consultation_EURO_STOXX_50_ESG_20210322.pdf)
>
> > [!quote] BlackRock launches Europe Defence UCITS ETF tracking STOXX index | Blog posts...
> > rioritize European companies. The EC in March presented a package to help European Union nations spend over EUR 800 billion in defense and in military research from European providers. NATO countries have called to boost defense investment from 2% of gross domestic product to 3.5%.[2] Selection and **weighting scheme** Companies in the STOXX Europe All Country All Cap index are assessed by their mi...
>
> — [BlackRock launches Europe Defence UCITS ETF tracking STOXX index | Blog posts...](https://stoxx.com/blackrock-launches-european-defence-ucits-etf-tracking-stoxx-index) — "WHITEPAPER"
>
> > [!quote] Overview Of Methodology Changes Valid From 18 Of March 2024 (PDF)
> > Methodology Changes (DAXglobal Guide) World Luxury 13.3. World Luxury Index 2.6.3. Unscheduled Index Chaining (World Luxury Guide) General All Share **Weighting Scheme** Full market capitalization weighted 3. General Index Free float market capitalization weighted 6. DAX All Share Information (DAX Indices Scale All Share Guide) 7.7. Scale 30 DAXsector All 3.3 Weighting and Share Capping Methods 13....
>
> — [Overview Of Methodology Changes Valid From 18 Of March 2024 (PDF)](https://www.stoxx.com/document/News/2023/October/Overview%20of%20methodology%20changes%20valid%20from%2018%20of%20March%202024.pdf)
>
