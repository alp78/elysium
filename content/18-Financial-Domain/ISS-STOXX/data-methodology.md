---
title: "ISS & STOXX Glossary — Data Methodology"
description: "Comprehensive glossary of data collection, quality, coverage, estimation models, back-testing, and methodology terms from STOXX and ISS Governance."
tags:
  - stoxx
  - iss
  - financial-domain
  - glossary
  - index-construction
aliases:
  - "Data Methodology Glossary"
date: 2026-03-28
---

# Data Methodology — ISS & STOXX Glossary

> [!abstract] About This Section
> This glossary covers data collection methods, quality assurance, coverage
> universes, estimation models, back-testing, and data delivery mechanisms. Terms
> are sourced from [STOXX](https://stoxx.com/) and
> [ISS Governance](https://www.issgovernance.com/) official documentation.
>
> **~39 terms** across multiple sources.

---

## A

### API (Application Programming Interface)

<span style="background:deeppink; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="10,982 mentions across STOXX & ISS pages (ultra-high)">▰▰▰▰▰▰▰ 10,982</span>


> A set of protocols, routines, and tools that allows software applications to communicate with a data provider's systems programmatically, enabling automated retrieval of index data, ESG scores, or governance analytics without manual intervention.

An API is the machine-to-machine doorway into a data provider's catalogue. STOXX offers APIs that let licensees pull real-time index levels, historical compositions, and corporate-action data directly into their portfolio management and risk systems. ISS provides API access to governance scores, proxy research, and ESG ratings through its DataDesk and Sustainability Gateway platforms. For institutional users, API integration replaces manual file downloads and enables straight-through processing.

> [!tip] Related Terms
> [[#Data Feed]], [[#DataDesk (ISS Platform)]], [[#Snowflake Delivery]], [[#Data Pipeline]]




> [!quote] Monthly Index News April 2020 (PDF)
> MONTHLY INDEX NEWS / April ESG-X Indices Key points The STOXX ESG-X Indices performed broadly in line with their benchmarks during April, allowing investors to track the respective markets’ moves while complying with sustainable policies. The ESG-X indices are versions of traditional, market-capitalization-weighted benchmarks that observe standard responsible exclusions of leading asset owners....
> — [Monthly Index News April 2020 (PDF)](https://stoxx.com/monthly-index-news-april-2020)

> [!quote] Hong Kong Voting Guidelines (PDF)
> roxy Voting Guidelines Hong Kong companies routinely ask shareholders to grant the board of directors a "general mandate to issue shares" without preemptive rights, at least once every year. This mandate, pursuant to the Listing Rules, allows companies to issue shares of up to 20 percent of issued capital without preemptive rights at a discount to market prices of up to 20 percent (or more unde...
> — [Hong Kong Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2018/asiapacific/Hong-Kong-Voting-Guidelines.pdf)

> [!quote] Iss2014Canadaventureguidelines (PDF)
> Transparency. Inclusiveness. Global Expertise. 4. Capital/Restructuring Mergers and Corporate Restructurings Overall Approach For mergers and acquisitions, review and evaluate the merits and drawbacks of the proposed transaction, balancing the various and sometimes countervailing factors including:  Valuation – Is the value to be received by the ta
> — [Iss2014Canadaventureguidelines (PDF)](https://www.issgovernance.com/file/2014_Policies/ISS2014CanadaVentureGuidelines.pdf)

> [!quote] Canada Executive Compensation Faq (PDF)
> that the CEO pay rank is below the average financial performance rank. Note that the FPA will not be applicable to subject companies in the GICS industry 601010 Real Estate Investment Trusts (REITs). Also, the methodology for EVA metrics excludes financial periods in which the company's revenue or capital was below $5 million. After such an exclusion, some companies may lack sufficient data for...
> — [Canada Executive Compensation Faq (PDF)](https://www.issgovernance.com/file/policy/2021/americas/Canada-Executive-Compensation-FAQ.pdf)

> [!quote] Ingersoll Rand (PDF)
> s todisapplypreemptionrights.Theseare importantdistinctionsandpriorversionsoftheU.K.and IrelandVotingPolicieshaverecognizedthe differences. WeareinterpretingthecurrentpolicyproposaltomeanthatISSwouldrecommendin favorofshareissuanceauthorities withoutpreemptionrightsofupto20percentofcurrentlyissued capitalandthat ISSisnotseekingtofurtherlimitthegeneralissuance authorities.Ifthisis the intendedch...
> — [Ingersoll Rand (PDF)](https://www.issgovernance.com/file/policy/ingersoll_rand.pdf)

**Sources:**
- [Monthly Index News April 2020 (PDF)](https://stoxx.com/monthly-index-news-april-2020)
- [Hong Kong Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2018/asiapacific/Hong-Kong-Voting-Guidelines.pdf)
- [Iss2014Canadaventureguidelines (PDF)](https://www.issgovernance.com/file/2014_Policies/ISS2014CanadaVentureGuidelines.pdf)
- [Canada Executive Compensation Faq (PDF)](https://www.issgovernance.com/file/policy/2021/americas/Canada-Executive-Compensation-FAQ.pdf)
- [Ingersoll Rand (PDF)](https://www.issgovernance.com/file/policy/ingersoll_rand.pdf)

---

## B

### Back-Testing

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="64 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 64</span>


> The process of applying an index methodology retroactively to historical market data in order to simulate how the index would have performed prior to its official launch date.

Back-testing lets index providers and investors see what returns a newly designed index *would have* generated had it existed in the past. STOXX publishes back-tested performance alongside live track records in its factsheets, always with a disclaimer that back-tested results do not represent actual trading and may overstate performance because the rules were crafted with knowledge of historical outcomes.

> [!tip] Related Terms
> [[#Historical Simulation]], [[#Look-Ahead Bias]], [[#Survivorship Bias]], [[#Point-in-Time Data]]




> [!quote] Evaluatingpayforperformance Final Updated 02172012 (PDF)
> o reflect recent history. The final Pay-TSR Alignment measure is simply equal to the difference: performance slope minus the pay slope. Potential values for PTA are theoretically unbounded, but in practice they range from just over -100% to just over 100%, with a slightly negative median value (see **Back-testing**, below, for more details). **Back-testing** the Measures To back-test these measures, IS...
> — [Evaluatingpayforperformance Final Updated 02172012 (PDF)](http://www.issgovernance.com/files/EvaluatingPayForPerformance_final_updated_02172012.pdf)

> [!quote] Us Executive Compensation Policies Faq (PDF)
> Margin, EVA Spread, EVA Momentum vs. Sales, and EVA Momentum vs. Capital. The FPA may modify an Overall Quantitative Concern level from a Low to Medium (or vice-versa), or from a Medium to High (or vice versa), depending on the results of the three primary measures and the company's FPA result. ISS **back-testing** indicates that less than 10% of companies subject to the quantitative screen will ha...
> — [Us Executive Compensation Policies Faq (PDF)](https://www.issgovernance.com/file/policy/latest/americas/US-Executive-Compensation-Policies-FAQ.pdf)

> [!quote] Canada Executive Compensation Faq (PDF)
> hat range, however, it begins to raise some degree of concern that a potential misalignment may exist. The evaluative approach begins by identifying companies that are significant outliers in each measure. The approach is based on empirical observation of the distribution of the measures within the **back-testing** universe. Additionally, the methodology, where possible, avoids arbitrary threshold ...
> — [Canada Executive Compensation Faq (PDF)](https://www.issgovernance.com/file/policy/2022/americas/Canada-Executive-Compensation-FAQ.pdf)

> [!quote] European Pay For Performance Methodology Faq (PDF)
> s. The thresholds that trigger concern for all tests will be updated for 2020. Thresholds for each test (RDA, MOM, and PTA) are determined for each market, ultimately deriving different sets of thresholds for STOXX600 vs. non- STOXX600 companies, and segmenting those by country pay band. To see the **back-testing** results for the 2020 thresholds, see the ISS Pay-for-Performance white paper. What a...
> — [European Pay For Performance Methodology Faq (PDF)](https://www.issgovernance.com/file/policy/2020/emea/European-Pay-for-Performance-Methodology-FAQ.pdf)

> [!quote] Canadian Equity Plan Scorecard Faq (PDF)
> e use of performance-based equity, the presence of a clawback provision, the strength of vesting provisions, and plan disclosure, should also be considered when determining whether to support a plan. In addition to seeking and applying feedback throughout policy development, ISS conducted extensive **back-testing** using prototype scorecards applied to previously submitted equity plan proposals. Th...
> — [Canadian Equity Plan Scorecard Faq (PDF)](https://www.issgovernance.com/file/policy/2018/americas/Canadian-Equity-Plan-Scorecard-FAQ.pdf)

**Sources:**
- [Evaluatingpayforperformance Final Updated 02172012 (PDF)](http://www.issgovernance.com/files/EvaluatingPayForPerformance_final_updated_02172012.pdf)
- [Us Executive Compensation Policies Faq (PDF)](https://www.issgovernance.com/file/policy/latest/americas/US-Executive-Compensation-Policies-FAQ.pdf)
- [Canada Executive Compensation Faq (PDF)](https://www.issgovernance.com/file/policy/2022/americas/Canada-Executive-Compensation-FAQ.pdf)
- [European Pay For Performance Methodology Faq (PDF)](https://www.issgovernance.com/file/policy/2020/emea/European-Pay-for-Performance-Methodology-FAQ.pdf)
- [Canadian Equity Plan Scorecard Faq (PDF)](https://www.issgovernance.com/file/policy/2018/americas/Canadian-Equity-Plan-Scorecard-FAQ.pdf)

---

### Benchmark Administration

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="41 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 41</span>


> The totality of activities involved in the governance, determination, calculation, and dissemination of a financial benchmark, including oversight, methodology design, data collection, and stakeholder management.

Benchmark administration is the regulatory umbrella under which index providers like STOXX operate. Under the EU Benchmarks Regulation (BMR), a benchmark administrator must maintain transparent methodologies, conflict-of-interest policies, and a complaints-handling procedure. STOXX is registered as an EU BMR-authorised administrator.

> [!tip] Related Terms
> [[#Index Administrator]], [[#Rulebook]], [[#Quality Assurance (Data)]]




> [!quote] Monthly Index News April 2021 (PDF)
> d and blue-chip indices for the regions Americas, Europe, Asia/Pacific and sub-regions Latin America and BRIC (Brazil, Russia, India and China) as well as global markets. STOXX is the administrator of the STOXX® and DAX® indices under the European Benchmark Regulation and exercises control over all **benchmark administration** processes within Qontigo. STOXX indices are licensed to more than 600 co...
> — [Monthly Index News April 2021 (PDF)](https://stoxx.com/monthly-index-news-april-2021)

> [!quote] Monthly Index News December 2022 (PDF)
> no assurance that investment products based on any STOXX index will accurately track the performance of the index itself or return positive performance. About STOXX STOXX Ltd. is the administrator of the STOXX® and DAX® indices under the European Benchmark Regulation and exercises control over all **benchmark administration** processes within Qontigo. STOXX and DAX indices by Qontigo comprise a glo...
> — [Monthly Index News December 2022 (PDF)](https://stoxx.com/monthly-index-news-december-2022)

> [!quote] Monthly Index News August 2023 (PDF)
> 550 companies around the world for benchmarking purposes and as underlyings for ETFs, futures and options, structured products and passively managed investment funds. STOXX Ltd. is the administrator of the STOXX and DAX indices under the European Benchmark Regulation and exercises control over all **benchmark administration** processes. 36/36 Copyright © 2023 STOXX Ltd.
> — [Monthly Index News August 2023 (PDF)](https://stoxx.com/monthly-index-news-august-2023)

> [!quote] History &amp; Milestones | STOXX
> 550 companies around the world for benchmarking purposes and as underlyings for ETFs, futures and options, structured products and passively managed investment funds. STOXX Ltd. is the administrator of the STOXX and DAX indices under the European Benchmark Regulation and exercises control over all **benchmark administration** processes within ISS STOXX. ISS STOXX is a leading provider of comprehens...
> — [History &amp; Milestones | STOXX](https://stoxx.com/company/stoxx-history-milestones) — "WHITEPAPER"

> [!quote] Philips Pensioenfonds adopts STOXX Index to align its emerging markets equity...
> 550 companies around the world for benchmarking purposes and as underlyings for ETFs, futures and options, structured products and passively managed investment funds. STOXX Ltd. is the administrator of the STOXX and DAX indices under the European Benchmark Regulation and exercises control over all **benchmark administration** processes within Qontigo. Disclaimers This press release does not constit...
> — [Philips Pensioenfonds adopts STOXX Index to align its emerging markets equity...](https://stoxx.com/philips-pensioenfonds-adopts-stoxx-index-to-align-its-emerging-markets-equity-portfolio-with-several-un-sdgs) — "WHITEPAPER"

**Sources:**
- [Monthly Index News April 2021 (PDF)](https://stoxx.com/monthly-index-news-april-2021)
- [Monthly Index News December 2022 (PDF)](https://stoxx.com/monthly-index-news-december-2022)
- [Monthly Index News August 2023 (PDF)](https://stoxx.com/monthly-index-news-august-2023)
- [History &amp; Milestones | STOXX](https://stoxx.com/company/stoxx-history-milestones) — "WHITEPAPER"
- [Philips Pensioenfonds adopts STOXX Index to align its emerging markets equity portfolio with several United Nations Sustainable Development Goals | Press releases | STOXX](https://stoxx.com/philips-pensioenfonds-adopts-stoxx-index-to-align-its-emerging-markets-equity-portfolio-with-several-un-sdgs) — "WHITEPAPER"

---

### Benchmark Statement

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="386 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 386</span>


> A public document required under the EU Benchmarks Regulation (BMR) that discloses the key elements of an index's methodology, its limitations, the circumstances under which its administrator would exercise discretion, and how it measures the underlying market or economic reality.

A benchmark statement is a regulatory compliance document, not a marketing factsheet. STOXX publishes benchmark statements for each index family, covering the market the benchmark intends to measure, the methodology's key elements, the potential limitations of the data inputs, and the conditions under which discretion or expert judgement may be applied. Investors and product issuers are required to reference the benchmark statement in their own prospectuses when using a regulated benchmark.

> [!tip] Related Terms
> [[#Benchmark Administration]], [[#Rulebook]], [[#Index Administrator]], [[#Methodology Consultation]]




> [!quote] Stoxx Factor Index Family Benchmark Statement (PDF)
> **BENCHMARK STATEMENT** Regulation Clause Regulation Required Information STOXX LTD Statement Subclause 1.6 Rationale; Art. 27(2)(b) A **benchmark statement** shall contain at Rationale for adopting the benchmark review and approval BMR; Art. 1(5) least, the rationale for adopting the methodology: The STOXX
> — [Stoxx Factor Index Family Benchmark Statement (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Resources/Regulation/STOXX_Factor_Index_Family_Benchmark_Statement.pdf)

> [!quote] Dax Esg Equity Family Benchmark Statement (PDF)
> DAX **BENCHMARK STATEMENT** Regulation Clause Regulation Required Information STOXX LTD Statement Subclause - they are calculated as a total return basis; with dividends reinvested; - they are calculated as a total return basis; with dividends reinvested net of withholding taxes; - they are calculated accor
> — [Dax Esg Equity Family Benchmark Statement (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Resources/Regulation/DAX_ESG_Equity_Family_Benchmark_Statement.pdf)

> [!quote] Dax Equity Index Family Benchmark Statement (PDF)
> the measurement of the performance cessation of a Family member. These financial of investment funds. contracts, financial products and investment funds must be able to withstand, or at least address the issue of, any changes to or cessation of a family member. 1.6 Rationale; review Art. 27(2)(b) A **benchmark statement** shall contain at Rationale for adopting the benchmark and approval BMR; Art. ...
> — [Dax Equity Index Family Benchmark Statement (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Resources/Regulation/DAX_Equity_Index_Family_Benchmark_Statement.pdf)

> [!quote] STOXX&reg; Nordic Diversification Select 30 SEK - STOXX
> he highest 12-month historical dividend yields are selected to be included in the index. The percentage of exclusion/inclusion at each step is the same. Those constituents are weighted according to the inverse of their volatility, with a cap at 10%. The indices are reviewed quarterly. Index Guides, **Benchmark statement**, and other reports are available under the Data tab. Details Top 10 Component...
> — [STOXX&reg; Nordic Diversification Select 30 SEK - STOXX](https://stoxx.com/index/bdxdssz) — "WHITEPAPER"

> [!quote] General All Share - STOXX
> ral Standard. Subsequent admission requirements of the official or regulated markets thus apply for companies in the General Standard and include: Publication of ad hoc disclosures Application of international accounting standards (IFRS/IAS or US GAAP) Publication of an interim report Index Guides, **Benchmark statement**, and other reports are available under the "Data & Methodology" tab. Details ...
> — [General All Share - STOXX](https://stoxx.com/index/3btt) — "WHITEPAPER"

**Sources:**
- [Stoxx Factor Index Family Benchmark Statement (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Resources/Regulation/STOXX_Factor_Index_Family_Benchmark_Statement.pdf)
- [Dax Esg Equity Family Benchmark Statement (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Resources/Regulation/DAX_ESG_Equity_Family_Benchmark_Statement.pdf)
- [Dax Equity Index Family Benchmark Statement (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Resources/Regulation/DAX_Equity_Index_Family_Benchmark_Statement.pdf)
- [STOXX&reg; Nordic Diversification Select 30 SEK - STOXX](https://stoxx.com/index/bdxdssz) — "WHITEPAPER"
- [General All Share - STOXX](https://stoxx.com/index/3btt) — "WHITEPAPER"

---

## C

### Coverage Universe

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="174 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 174</span>


> The total set of securities, entities, or data points that a data provider or index methodology considers eligible for inclusion before any screening, filtering, or weighting rules are applied.

Think of the coverage universe as the broadest possible "long list." For STOXX, the coverage universe for a regional index might be all listed equities on regulated exchanges in that region. For ISS, the coverage universe for ESG ratings might be all companies in the MSCI ACWI or a similar broad benchmark. The actual index or rating output is always a subset of this universe after selection criteria are applied.

> [!tip] Related Terms
> [[#Universe Construction]], [[#Selection List]], [[#Cross-Sectional Data]]




> [!quote] QualityScore | Global Coverage | ISS
> th local market indices, including constituents of the U.S. Russell 3000, Canadian S&P/TSX Composite, STOXX600, NZX15, ASX 200, JPX-Nikkei 400, and the main European local market indices including the UK FTSE All-Share (ex-investment trusts.) QualityScore also includes widely held companies in ISS’ **coverage universe** for Brazil, China, Hong Kong, and India. The term “widely held” refers to compa...
> — [QualityScore | Global Coverage | ISS](https://www.issgovernance.com/solutions/qualityscore-global-coverage) — "Global Coverage"

> [!quote] Emea P4P Faq June 2016 (PDF)
> he P4P model for poor or limited disclosure, it is excluded for the year. However, the pay disclosures will be reassessed annually, and if greater information is subsequently provided, the company may appear in the P4P model as both a subject and a peer company in future years. 26. How often is the **coverage universe** updated and when? For the first year, the **coverage universe** will be updated in ...
> — [Emea P4P Faq June 2016 (PDF)](https://www.issgovernance.com/file/faq/emea-p4p-faq-june-2016.pdf)

> [!quote] European Pay For Performance Methodology Faq (PDF)
> input when the model was being developed, and the consensus was that only European peers should be included in the model. This methodology was carried forward into the latest year, and is consistent with the region-specific approach of the US, Canada, and Australia P4P models. Coverage What is the **coverage universe** for the European P4P model? The **coverage universe** for the model in 2016 was the ...
> — [European Pay For Performance Methodology Faq (PDF)](https://www.issgovernance.com/file/policy/2020/emea/European-Pay-for-Performance-Methodology-FAQ.pdf)

> [!quote] Australian Pay For Performance Faq (PDF)
> ll relevant qualitative and quantitative factors. For institutional investor clients who partner with ISS on their own customised voting policies, the Australian Pay-for- Performance model and/or underlying data may also be an input into their final vote considerations and decisions. 2. What is the **coverage universe** for the Australian Pay-for-Performance model? The Australian PFP coverage unive...
> — [Australian Pay For Performance Faq (PDF)](https://www.issgovernance.com/file/policy/2018/asiapacific/Australian-Pay-for-Performance-FAQ.pdf)

> [!quote] Europe Voting Guidelines (PDF)
> Continental Europe Proxy Voting Guidelines **COVERAGE UNIVERSE** The following is a condensed version of the proxy voting recommendations contained in ISS’ European Proxy Voting Manual. ISS' European Policy applies to Member States of the European Union (EU) or the European Free Trade Association (EFTA), with the exception of the United Kingdom
> — [Europe Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2019/emea/Europe-Voting-Guidelines.pdf)

**Sources:**
- [QualityScore | Global Coverage | ISS](https://www.issgovernance.com/solutions/qualityscore-global-coverage) — "Global Coverage"
- [Emea P4P Faq June 2016 (PDF)](https://www.issgovernance.com/file/faq/emea-p4p-faq-june-2016.pdf)
- [European Pay For Performance Methodology Faq (PDF)](https://www.issgovernance.com/file/policy/2020/emea/European-Pay-for-Performance-Methodology-FAQ.pdf)
- [Australian Pay For Performance Faq (PDF)](https://www.issgovernance.com/file/policy/2018/asiapacific/Australian-Pay-for-Performance-FAQ.pdf)
- [Europe Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2019/emea/Europe-Voting-Guidelines.pdf)

---

### Cross-Sectional Data

> A dataset that captures observations across multiple entities (e.g., companies, securities) at a single point in time, as opposed to tracking a single entity across multiple time periods.

Cross-sectional data is what you get when you take a "snapshot" of every company's market capitalisation, ESG score, or governance rating on a given date. Index reviews and rebalancing decisions are fundamentally cross-sectional exercises — comparing all eligible securities against one another at the review cut-off date.

> [!tip] Related Terms
> [[#Panel Data]], [[#Time Series Data]], [[#Point-in-Time Data]]

**Sources:**

---

## D

### Data Feed

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="14 mentions across STOXX & ISS pages (low)">▰▰ 14</span>


> A continuous or scheduled electronic delivery of structured data — such as index levels, component weights, corporate actions, or ESG scores — from a provider to a consumer, typically via API, FTP, or a real-time streaming protocol.

Data feeds are the pipes through which institutional investors receive index and governance data. STOXX delivers index values via real-time feeds (every 15 seconds for some indices) and end-of-day files. ISS distributes governance and ESG data through platform downloads, APIs, and bulk file deliveries. The format, frequency, and latency of a data feed are critical operational considerations for asset managers and custodians.

> [!tip] Related Terms
> [[#End-of-Day Data]], [[#Data Vendor Code]], [[#Snowflake Delivery]]




> [!quote] Research, Screen &amp; Analyze Risk | ISS
> particular areas of concern, and deep dives into underlying governance data. API to Profiles Your internal platform to the QualityScore API to directly access QualityScore Profiles and drill into the key risks, to easily bring governance insight into investment decisions and proxy voting processes. **Data Feed**s Easily ingest the files through your own internal processes and highlight scores withi...
> — [Research, Screen &amp; Analyze Risk | ISS](https://www.issgovernance.com/solutions/qualityscore-research-screen-analyze-risk) — "Research, Screen & Analyze Risk"

> [!quote] Environmental &amp; Social Raw Data | ISS
> orkplace health and safety, and many more. 450 Key Datapoints on topics such as: Business Ethics Labor, Health, and Safety Stakeholders and Society Workplace Diversity and Inclusion *Data as of March 2023. All figures are approximate. Our ESGRaw Data Solutions are available through DataDesk, or via **data feed**s for integration into client workflows. Access Detailed and Up-To-Date Research Data vi...
> — [Environmental &amp; Social Raw Data | ISS](https://www.issgovernance.com/sustainability/environmental-social-raw-data) — "SUSTAINABILITY SOLUTIONS"

> [!quote] Dax Equity Indices Simulation Phase–From Dec 18 2023 To February 29 2024 (PDF)
> via Deutsche Boerse Market Data + Services CEF (CEF® **data feed**s), please do not hesitate to contact the Functional Operations Team at +49-(0) 69-2 11-1 15 40 or send an e-mail to datafeeds@deutsche-boerse.com Please note that STOXX Ltd, is also publishing information related to real time feed (CEF® **data feed**s) changes affecting DAX Indices effective March 18th, 2024. The information is availabl...
> — [Dax Equity Indices Simulation Phase–From Dec 18 2023 To February 29 2024 (PDF)](https://www.stoxx.com/document/News/2023/October/DAX_Equity_Indices_Simulation_Phase–from_Dec_18_2023_to_February_29_2024.pdf)

> [!quote] Dax Equity Calculation Guide 20231002 (PDF)
> DAX EQUITY INDEX CALCULATION GUIDE 9/37 44.. IINNPPUUTT DDAATTAA 4.1. SOURCES The input data sources for the index calculation include: Real-time and end-of-day stock prices and currency exchange rates provided by Refinitiv. 4.2. MONITORING The real-time input **data feed**s for the index calculation are monitored continuously to ensure data quality and availability. Data monitoring controls includ...
> — [Dax Equity Calculation Guide 20231002 (PDF)](https://www.stoxx.com/document/News/2023/October/DAX%20Equity%20Calculation%20Guide_20231002.pdf)

> [!quote] Meeting Results Data | ISS
> ssuer to Issuer. With coverage of more than 50,000 meetings across 115 markets annually, ISS proactively collects this data, which can be delivered in a consistent and standardised format, either integrated into your clients proxy voting workflow on our ProxyExchange platform, via SWIFT or a custom **data feed**. Get Valuable Insight As well as the actual vote result, proposal by proposal, and the ...
> — [Meeting Results Data | ISS](https://www.issgovernance.com/intermediary-outsource/meeting-results-data) — "Meeting Results Data"

**Sources:**
- [Research, Screen &amp; Analyze Risk | ISS](https://www.issgovernance.com/solutions/qualityscore-research-screen-analyze-risk) — "Research, Screen & Analyze Risk"
- [Environmental &amp; Social Raw Data | ISS](https://www.issgovernance.com/sustainability/environmental-social-raw-data) — "SUSTAINABILITY SOLUTIONS"
- [Dax Equity Indices Simulation Phase–From Dec 18 2023 To February 29 2024 (PDF)](https://www.stoxx.com/document/News/2023/October/DAX_Equity_Indices_Simulation_Phase–from_Dec_18_2023_to_February_29_2024.pdf)
- [Dax Equity Calculation Guide 20231002 (PDF)](https://www.stoxx.com/document/News/2023/October/DAX%20Equity%20Calculation%20Guide_20231002.pdf)
- [Meeting Results Data | ISS](https://www.issgovernance.com/intermediary-outsource/meeting-results-data) — "Meeting Results Data"

---

### Data Imputation

> The process of replacing missing or unavailable data values with substituted estimates derived from statistical models, peer-group averages, or other systematic techniques, so that downstream calculations can proceed on a complete dataset.

Data imputation is what happens when a company simply does not report a data point that an index or rating methodology requires — for example, Scope 3 carbon emissions or board-diversity percentages. ISS and STOXX ESG methodologies document which fields may be imputed, the imputation technique used (e.g., sector-median fill, regression-based prediction), and how imputed values are flagged so that end users can distinguish reported from estimated figures. Imputation is closely related to but distinct from estimation modelling: imputation fills discrete gaps, while estimation models may construct entire derived metrics.

> [!tip] Related Terms
> [[#Estimation Model]], [[#Disclosure Rate]], [[#Coverage Universe]], [[#Quality Assurance (Data)]]

**Sources:**

---

### Data Normalization

> The process of transforming raw data values onto a common scale or into a standard format so that metrics from different sources, reporting frameworks, currencies, or units of measurement can be meaningfully compared.

Raw ESG and financial data arrives in wildly inconsistent forms — carbon emissions in metric tonnes vs. short tons, revenue in local currencies, governance scores on different rating scales. Data normalisation converts these heterogeneous inputs into comparable units. STOXX normalises financial data to a common currency and adjusts for free float; ISS normalises ESG indicators to z-scores or percentile ranks within industry peer groups so that a mining company's environmental performance can be compared against other miners, not against software firms.

> [!tip] Related Terms
> [[#Data Imputation]], [[#Cross-Sectional Data]], [[#Estimation Model]], [[#Quality Assurance (Data)]]

**Sources:**

---

### Data Pipeline

> The end-to-end sequence of automated steps — ingestion, validation, transformation, enrichment, and loading — through which raw data flows from its original source to its final destination in a production database, index calculation engine, or client-facing platform.

A data pipeline is the plumbing behind every index level and ESG score. For STOXX, the pipeline begins with exchange feeds and corporate-action notices, passes through validation and corporate-action-adjustment engines, and ends with the publication of official index values. For ISS, the pipeline ingests company filings, third-party databases, and analyst inputs, routes them through scoring models and QA checks, and delivers final ratings to DataDesk, the Sustainability Gateway, and Snowflake. Pipeline reliability is a core operational risk — a failure at any stage can delay or corrupt data delivery.

> [!tip] Related Terms
> [[#Data Feed]], [[#API (Application Programming Interface)]], [[#Quality Assurance (Data)]], [[#Snowflake Delivery]]

**Sources:**

---

### Data Vendor

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="157 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 157</span>


> A third-party firm that collects, aggregates, standardises, and redistributes financial, governance, or ESG data to institutional clients, often serving as an intermediary between primary data sources (exchanges, companies, regulators) and end users.

Data vendors are the middlemen of the financial information ecosystem. STOXX itself acts as a data vendor when it licenses index data to Bloomberg, Refinitiv, and SIX for redistribution. Conversely, STOXX consumes data from vendors when sourcing market-cap figures, free-float estimates, or corporate-action feeds as inputs to its index calculations. ISS is both a data vendor (selling governance and ESG data) and a data consumer (purchasing financial and ownership data from other vendors). Understanding the vendor chain is important because data quality issues can originate at any link.

> [!tip] Related Terms
> [[#Data Vendor Code]], [[#Data Feed]], [[#Vendor Reconciliation]], [[#Data Pipeline]]




> [!quote] Stoxx Index Guide (PDF)
> STOXX INDEX METHODOLOGY GUIDE 93/639 9. STOXX BLUE-CHIP INDICES For a complete list please consult the **data vendor** code sheet on the website21. Index types and currencies: Price, net return and gross return in EUR, USD and other versions. For a complete list please consult the **data vendor** code sheet on the website22. 9.1.2. INDEX REVIEW Component selection: There is a minimum liquidity requirem...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] Stoxx World Equity Index Guide (PDF)
> aintained by the competent financial supervisory authority are classified as Investment Companies. Private Equity and Venture Capital- Shares held by private equity firms and venture capital funds larger than or equal to 5%. Private Equity and Venture Capital Firms are defined based on Third- Party **Data Vendor**s. Exception – In Germany, Private Equity and Venture Capital firms which are identifi...
> — [Stoxx World Equity Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)

> [!quote] European Pay For Performance Methodology Overview (PDF)
> models. Various other financial and operational metrics are also considered when company practices and remuneration decisions are analysed as part of the qualitative review undertaken for ISS proxy research reports. The TSR data used in the European pay-for-performance model is provided by the same **data vendor** (S&P/Compustat XpressFeed) using the same TSR methodology (S&P’s standard TSR methodo...
> — [European Pay For Performance Methodology Overview (PDF)](http://www.issgovernance.com/file/policy/european-pay-for-performance-methodology-overview.pdf)

> [!quote] Dax Strategy Index Guide (PDF)
> viously Financial and Risk business of Thomson Reuters. The WM/Refinitiv currency fixing rates from 17:00 CET are used to calculate the index’s closing values. DAXplus Covered Call index is available in the currencies set forth in the Vendor Code Sheet which is available under https://www.stoxx.com/data-vendor-codes. On Xetra trading days DAXplus Covered Call is calculated as follows: 𝐷𝐴𝑋 −𝐶 𝑡 ...
> — [Dax Strategy Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)

> [!quote] CSP Reports | STOXX
> ch Back Insights & Research Blog posts Case studies Whitepapers ALL Newsletters Monthly index news News & Events Press releases News & media mentions Events WHITEPAPER VSTOXX 101: Understanding Europe’s volatility benchmark Download Index Resources Back Index Data General Indices Customized indices **Data vendor** codes Factsheets & components Market consultation Exchange traded products Technical ...
> — [CSP Reports | STOXX](https://stoxx.com/csp-reports) — "WHITEPAPER"

**Sources:**
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [Stoxx World Equity Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)
- [European Pay For Performance Methodology Overview (PDF)](http://www.issgovernance.com/file/policy/european-pay-for-performance-methodology-overview.pdf)
- [Dax Strategy Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)
- [CSP Reports | STOXX](https://stoxx.com/csp-reports) — "WHITEPAPER"

---

### Data Vendor Code

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="141 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 141</span>


> A short alphanumeric identifier assigned by a data vendor (e.g., Bloomberg, Refinitiv, SIX) to uniquely reference a specific index, security, or data series within that vendor's platform.

Every STOXX index has a set of vendor codes — for example, a Bloomberg ticker, a Reuters RIC, and a STOXX internal symbol. These codes let portfolio managers, risk systems, and trading desks unambiguously refer to the same index across different technology platforms. Factsheets typically list all major vendor codes for each index.

> [!tip] Related Terms
> [[#RIC (Reuters Instrument Code)]], [[#ISIN (International Securities Identification Number)]], [[#Factsheet]]




> [!quote] Stoxx Index Guide (PDF)
> STOXX INDEX METHODOLOGY GUIDE 93/639 9. STOXX BLUE-CHIP INDICES For a complete list please consult the **data vendor code** sheet on the website21. Index types and currencies: Price, net return and gross return in EUR, USD and other versions. For a complete list please consult the **data vendor code** sheet on the website22. 9.1.2. INDEX REVIEW Component selection: There is a minimum liquidity requirem...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] Dax Strategy Index Guide (PDF)
> viously Financial and Risk business of Thomson Reuters. The WM/Refinitiv currency fixing rates from 17:00 CET are used to calculate the index’s closing values. DAXplus Covered Call index is available in the currencies set forth in the Vendor Code Sheet which is available under https://www.stoxx.com/data-vendor-codes. On Xetra trading days DAXplus Covered Call is calculated as follows: 𝐷𝐴𝑋 −𝐶 𝑡 ...
> — [Dax Strategy Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)

> [!quote] Stoxx Strategy Guide (PDF)
> fts between a risk free money market investment and a risky asset (measured by the respective underlying equity index). 16.2. BASIC DATA Various versions of the STOXX Risk Control indices are available for a broad number of countries and target volatility levels. For more details please consult the **Data Vendor Code** sheet on the STOXX website7. 16.3. CALCULATION 16.3.1. INDEX FORMULA STOXX Diff(...
> — [Stoxx Strategy Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_strategy_guide.pdf)

> [!quote] Su5Zesgx (PDF)
> r_codes.html Calculation/distribution realtime 15 sec Calculation hours 15:30:00 22:15:00 Base value/base date 100 as of Mar. 19, 2012 History Mar. 19, 2012 Inception date May. 29, 2019 To learn more about the inception date, the currency, the calculation hours and historical values, please see our **data vendor code** sheet. 3 STOXX data from Mar. 19, 2012 to Aug. 30, 2019 4 gr. div. yield is calc...
> — [Su5Zesgx (PDF)](https://www.stoxx.com/document/Indices/Factsheets/2019/August/SU5ZESGX.pdf)

> [!quote] CSP Reports | STOXX
> ch Back Insights & Research Blog posts Case studies Whitepapers ALL Newsletters Monthly index news News & Events Press releases News & media mentions Events WHITEPAPER VSTOXX 101: Understanding Europe’s volatility benchmark Download Index Resources Back Index Data General Indices Customized indices **Data vendor code**s Factsheets & components Market consultation Exchange traded products Technical ...
> — [CSP Reports | STOXX](https://stoxx.com/csp-reports) — "WHITEPAPER"

**Sources:**
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [Dax Strategy Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)
- [Stoxx Strategy Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_strategy_guide.pdf)
- [Su5Zesgx (PDF)](https://www.stoxx.com/document/Indices/Factsheets/2019/August/SU5ZESGX.pdf)
- [CSP Reports | STOXX](https://stoxx.com/csp-reports) — "WHITEPAPER"

---

### DataDesk (ISS Platform)

<span style="background:red; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="3,172 mentions across STOXX & ISS pages (high)">▰▰▰▰▰▰ 3,172</span>


> ISS Governance's online data portal that provides institutional subscribers with access to governance analytics, proxy voting research, compensation data, and ESG scores through a web-based interface.

DataDesk is the primary self-service front end for ISS clients. Users can search companies, pull governance risk scores (QualityScores), review board profiles, view proxy research reports, and export datasets. It complements ISS's bulk data feeds and API access by offering an interactive, searchable environment suited for ad hoc research and due diligence.

> [!tip] Related Terms
> [[#Sustainability Gateway (ISS Platform)]], [[#Data Feed]], [[#Quality Assurance (Data)]]




> [!quote] Home | ISS
> ty Methodology Thought Leadership Biodiversity Impact Assessment Tool Regulatory Solutions Cyber Risk Score ESG Fund Rating ESG Ratings Impact & UN SDG Screening & Controversies Climate Solutions ESG Index Solutions ESG Raw Data Solutions for Academic Professionals Collaborative Engagement Services **DataDesk** Australia | ISS ESG ISS-Corporate Second Party Opinions Market Intelligence (MI) Visit I...
> — [Home | ISS](https://www.issgovernance.com/) — "ISS Announces Creation of ISS STOXX"

> [!quote] Citi and ISS Launch High Frequency Connection for Proxymity Voting Platform |...
> orm at Citi. “This collaboration shows how Proxymity can effectively be used without any change to the systems and workflows that ISS clients already know, like and trust. This is a significant win for all users.” In addition to the data and workflow already available in ProxyExchange, users of the ISS platform can now benefit from enhanced visibility for supported company meetings by casting v...
> — [Citi and ISS Launch High Frequency Connection for Proxymity Voting Platform |...](https://www.issgovernance.com/citi-and-iss-launch-high-frequency-connection-for-proxymity-voting-platform) — "Citi and ISS Launch High Frequency Connection for Proxymity Voting Platform"

> [!quote] Americas Policy Updates (PDF)
> 2019 ISS Americas Policy Updates according to **DataDesk** data, only three companies in the S&P 500 had no female directors. Boards with female representation far outnumber all-male boards in the Russell 3000 Index too where, according to Data Desk data, 84 percent of the companies have at least one female on the board. Female representation at th
> — [Americas Policy Updates (PDF)](https://www.issgovernance.com/file/policy/2019/updates/Americas-Policy-Updates.pdf)

> [!quote] Open Class on ISS ESG&#039;s Net Zero Solution - APAC Session | ISS
> Open Class on ISS ESG’s Net Zero Solution – APAC Session AGENDA: - Context - Net Zero: what is the challenge? - The IEA’s Net Zero scenario - Net Zero Frameworks - ISS ESG Net Zero Solution - Go through ISS ESG Net Zero report pages - Brief demo of Net Zero on **DataDesk** to illustrate granularity of available data - Q&A The session is moderated by Suk Yun Chun, ESG Specialist APAC at ISS ESG.
> — [Open Class on ISS ESG&#039;s Net Zero Solution - APAC Session | ISS](https://www.issgovernance.com/open-class-on-iss-esgs-net-zero-solution-apac-session) — "Open Class on ISS ESG’s Net Zero Solution – APAC Session"

> [!quote] Site Map | ISS
> Look Back at 2020 and What’s Ahead in 2021 - Climate Impact Report | What’s New? - Die EU-Taxonomie im Fokus Webinar - EU Taxonomy in Focus Webinar - ISS FWW bietet neues ESG-Fondsrating an - ISS stellt innovatives ESG-Fondsrating vor - Pandemic Toolkit Functionality within the Custom Rating Tab in **DataDesk** - Protected: FNG-Siegel 2021 und Umsetzung - 2020 ISS Bulletin Podcast Series - A Look B...
> — [Site Map | ISS](https://www.issgovernance.com/site-map) — "Site Map"

**Sources:**
- [Home | ISS](https://www.issgovernance.com/) — "ISS Announces Creation of ISS STOXX"
- [Citi and ISS Launch High Frequency Connection for Proxymity Voting Platform | ISS](https://www.issgovernance.com/citi-and-iss-launch-high-frequency-connection-for-proxymity-voting-platform) — "Citi and ISS Launch High Frequency Connection for Proxymity Voting Platform"
- [Americas Policy Updates (PDF)](https://www.issgovernance.com/file/policy/2019/updates/Americas-Policy-Updates.pdf)
- [Open Class on ISS ESG&#039;s Net Zero Solution - APAC Session | ISS](https://www.issgovernance.com/open-class-on-iss-esgs-net-zero-solution-apac-session) — "Open Class on ISS ESG’s Net Zero Solution – APAC Session"
- [Site Map | ISS](https://www.issgovernance.com/site-map) — "Site Map"

---

### Disclosure Rate

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1 mentions across STOXX & ISS pages (ultra-low)">▰ 1</span>


> The percentage of companies within a given universe or index that voluntarily or mandatorily report a specific data point — such as carbon emissions, board-diversity statistics, or executive compensation details — as opposed to having that data estimated or imputed by the provider.

Disclosure rate is a key quality-of-data metric. A high disclosure rate means the data is grounded in company-reported figures; a low rate means the provider is relying heavily on estimation models. ISS publishes disclosure rates for its ESG indicators so that clients can assess how much of a portfolio's ESG profile rests on actual company data versus modelled values. STOXX ESG index methodologies may set minimum disclosure thresholds — for example, requiring that a company report Scope 1 and 2 emissions directly to be eligible for a climate index.

> [!tip] Related Terms
> [[#Data Imputation]], [[#Estimation Model]], [[#Coverage Universe]], [[#Quality Assurance (Data)]]




> [!quote] The time is ripe for investors in China to embrace a green financial system  ...
> mittee of the China Association of Environmental Protection Industry. Many challenges exist with data pertaining to the ESG performance of Chinese corporations. China has distinct corporate governance requirements through its state-led governance model. Additionally, language barriers and different **disclosure rate**s and standards make it all the more difficult for international providers to full...
> — [The time is ripe for investors in China to embrace a green financial system  ...](https://stoxx.com/the-time-is-ripe-for-investors-in-china-to-embrace-a-green-financial-system) — "WHITEPAPER"

**Sources:**
- [The time is ripe for investors in China to embrace a green financial system  | Blog posts | STOXX](https://stoxx.com/the-time-is-ripe-for-investors-in-china-to-embrace-a-green-financial-system) — "WHITEPAPER"

---

## E

### End-of-Day Data

> Index values, component lists, weights, and related analytics calculated and published after the close of trading on a given business day, representing the final official figures for that session.

End-of-day (EOD) data is the definitive record of an index for each trading day. STOXX publishes EOD files that include closing index levels, component weights, divisor values, and corporate action adjustments. Most passive fund NAV calculations, compliance checks, and performance attribution processes rely on EOD data rather than intraday snapshots.

> [!tip] Related Terms
> [[#Data Feed]], [[#Time Series Data]], [[#Back-Testing]]

**Sources:**

---

### Estimation Model

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1 mentions across STOXX & ISS pages (ultra-low)">▰ 1</span>


> A quantitative framework used by a data provider to infer, approximate, or impute a data point (such as carbon emissions or ESG metrics) when a company has not directly reported the figure.

Not all companies disclose every data point that ESG and climate indices require. ISS and other providers fill these gaps with estimation models — statistical or machine-learning approaches that predict unreported values based on industry peers, company size, geographic location, and available partial disclosures. Methodologies typically document which fields are reported vs. estimated and the confidence level of each estimate.

> [!tip] Related Terms
> [[#Coverage Universe]], [[#Quality Assurance (Data)]], [[#Look-Ahead Bias]]




> [!quote] Qontigo’s Mehrotra: Innovation cutting across entire ESG data spectrum — from...
> ounts of information in real time without human bias,” Patricia said. “We use AI to process hundreds of thousands of documents per day. We can also use machine learning to learn complex patterns. We can clean the data and assess the reliability of data. With advanced machine learning, we can create **estimation model**s for all our coverage gaps. So clearly, there is huge potential.” Patricia added...
> — [Qontigo’s Mehrotra: Innovation cutting across entire ESG data spectrum — from...](https://stoxx.com/qontigos-mehrotra-innovation-cutting-across-entire-esg-data-spectrum-from-sources-to-uses) — "WHITEPAPER"

**Sources:**
- [Qontigo’s Mehrotra: Innovation cutting across entire ESG data spectrum — from sources to uses | Blog posts | STOXX](https://stoxx.com/qontigos-mehrotra-innovation-cutting-across-entire-esg-data-spectrum-from-sources-to-uses) — "WHITEPAPER"

---

## F

### Factsheet

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="16 mentions across STOXX & ISS pages (low)">▰▰ 16</span>


> A standardised summary document — typically two to four pages — published by an index provider that presents an index's key characteristics, performance, top constituents, sector breakdown, and methodology highlights.

Factsheets are the "business card" of an index. STOXX publishes monthly factsheets for each index family, covering risk/return statistics, turnover, vendor codes, and a performance chart with both live and back-tested periods clearly marked. They are the most common starting point for any investor evaluating an index.

> [!tip] Related Terms
> [[#Data Vendor Code]], [[#Rulebook]], [[#Back-Testing]]




> [!quote] Stoxx Index Guide (PDF)
> vidual component selection process and weighting schemes » The STOXX Reference Rates guide contains the rules and methodologies of the reference rate indices » The STOXX Reference Calculations guide provides a detailed view of definitions and formulas of the calculations as utilized in the reports, **factsheet**s, indices and presentations produced by STOXX » The STOXX Currency Rates Indices Method...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] RecoverMax Monitor: March 2018 | ISS
> rice declined more than 3%, and following the company’s December’s 2016 disclosure, the stock price further declined by more than 6%. This case’s court location is USDC-California (Northern) and is being led by co-lead counsel firms Pomerantz and Glancy Pronger & Murray. Click here to view the case **factsheet**. comScore – $110 Million Settlement This large settlement is a combination of cash ($27...
> — [RecoverMax Monitor: March 2018 | ISS](https://www.issgovernance.com/recovermax-monitor-march-2018) — "Cases in the News"

> [!quote] CSP Reports | STOXX
> Research Blog posts Case studies Whitepapers ALL Newsletters Monthly index news News & Events Press releases News & media mentions Events WHITEPAPER VSTOXX 101: Understanding Europe’s volatility benchmark Download Index Resources Back Index Data General Indices Customized indices Data vendor codes **Factsheet**s & components Market consultation Exchange traded products Technical documentation Metho...
> — [CSP Reports | STOXX](https://stoxx.com/csp-reports) — "WHITEPAPER"

> [!quote] Detailed Overview Of Equity Index Calculation Changes (PDF)
> he forecast from the website and subscribe to corporate actions alerts to receive notification for the latest changes. 5.5 Monthly Reports The monthly reports are published each month and include the following data for selected indices: • Index performance • Index fundamentals • Index correlation • **Factsheet**s for various indices with information on fundamental ratios, performance data and other...
> — [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)

> [!quote] US Benchmark Reaches Record High as European Stocks Struggle in Pandemic Reco...
> he STOXX USA 500 Index are in dollars. 2 Preliminary data, Eurostat, Aug. 14, 2020. 3 See Dalibor Rohac, ‘Why Europe’s Chances of a Strong Economic Recovery Are Slimmer than the U.S.’, National Review, Jul. 22, 2020. 4 Projected price-to-estimated-earnings excluding negative readings. Source: STOXX **factsheet**s. 5 MarketWatch, ‘’Companies remain cautious’ as eurozone flash PMI eases to two-month ...
> — [US Benchmark Reaches Record High as European Stocks Struggle in Pandemic Reco...](https://stoxx.com/us-benchmark-reaches-record-high-as-european-stocks-struggle-in-pandemic-recovery) — "WHITEPAPER"

**Sources:**
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [RecoverMax Monitor: March 2018 | ISS](https://www.issgovernance.com/recovermax-monitor-march-2018) — "Cases in the News"
- [CSP Reports | STOXX](https://stoxx.com/csp-reports) — "WHITEPAPER"
- [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
- [US Benchmark Reaches Record High as European Stocks Struggle in Pandemic Recovery | Blog posts | STOXX](https://stoxx.com/us-benchmark-reaches-record-high-as-european-stocks-struggle-in-pandemic-recovery) — "WHITEPAPER"

---

## H

### Historical Simulation

> The process of reconstructing the performance of an index or strategy over a past time period using archived market data and a defined set of rules, applied as if the rules had been in effect throughout that period.

Historical simulation is closely related to back-testing but carries a slightly broader connotation — it may involve scenario analysis, stress testing, or "what-if" variations of methodology parameters, not just a single retrospective track record. STOXX simulation files allow clients to replicate historical index compositions and verify calculations independently.

> [!tip] Related Terms
> [[#Back-Testing]], [[#Simulation File]], [[#Look-Ahead Bias]], [[#Survivorship Bias]]

**Sources:**

---

## I

### Index Administrator

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="8 mentions across STOXX & ISS pages (low)">▰▰ 8</span>


> The legal entity responsible for the governance, calculation, and publication of a financial benchmark or index, bearing regulatory accountability under frameworks such as the EU Benchmarks Regulation (BMR).

STOXX Ltd. is the index administrator for all STOXX and DAX indices. As an administrator, STOXX must maintain a control framework, methodology governance committee, conflicts-of-interest policy, and complaint-handling process. Clients licensing an index for an ETF or structured product must verify that the administrator is authorised under the applicable regulatory regime.

> [!tip] Related Terms
> [[#Benchmark Administration]], [[#Rulebook]], [[#Review Report]]




> [!quote] Index Files Guide 20230619 (PDF)
> ated measures are based on closing data of quarterly review effective date.  File Name: esg_report_xxxxx  File Type: .csv  File specification: semicolon separated  File Frequency: Quarterly (after review implementation) Row Data Data Attribute Description ID Type Format 1 Item1_BM_Administrator **Index administrator** (text "STOXX Ltd.") Text 10 2 Item2_Asset_Class Asset class of the index (cur...
> — [Index Files Guide 20230619 (PDF)](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)

> [!quote] Q&amp;A: Index Industry Association’s Rick Redding | Blog posts | STOXX
> ely 98% of all indices available globally. STOXX Ltd. is a member of the IIA. Rick, what does the IIA do? The IIA is a non-profit organization that was set up to do two things: provide education on indices and do advocacy work where needed across the globe. All of our members have to be independent **index administrator**s, meaning that they can neither trade the underlying securities in the indice...
> — [Q&amp;A: Index Industry Association’s Rick Redding | Blog posts | STOXX](https://stoxx.com/qa-index-industry-associations-rick-redding-qa-index-industry-associations-rick-redding) — "WHITEPAPER"

> [!quote] Guide To Eurogov Bond Indices (PDF)
> index data reporting and index review of the EUROGOV® Bond Indices to ICE Data Indices LLC in accordance with Art. 10 of Regulation 2016/1011 (“Benchmark Regulation or “BMR”), referred to as ‘outsource service provider’ in the rest of this Guide to the EUROGOV® Bond Indices. STOXX Ltd. remains the **index administrator** of the EUROGOV® Bond Indices in accordance with Art. 3 BMR. STOXX Ltd. develop...
> — [Guide To Eurogov Bond Indices (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/Guide_to_EUROGOV_Bond_Indices.pdf)

> [!quote] STOXX Named Administrator Under EU Benchmarks Regulation STOXX Named Administ...
> STOXX Ltd. on Jul. 31 was recognized as **index administrator** under the European Union’s Benchmarks Regulation (BMR), a rules framework devised to ensure the accuracy and integrity of indices in the region. The Benchmarks Regulation covers all entities that administer indices used in the 28-nation EU as benchmarks in financial instruments a
> — [STOXX Named Administrator Under EU Benchmarks Regulation STOXX Named Administ...](https://stoxx.com/stoxx-named-administrator-under-eu-benchmarks-regulation-stoxx-named-administrator-under-eu-benchmarks-regulation) — "WHITEPAPER"

> [!quote] CTB, PAB climate benchmarks evolve with investment landscape | Blog posts | S...
> STOXX indices. ISS and STOXX joined forces in 2023 to form a unified platform offering high-quality data, analytics and indices, underpinned by a leading governance franchise. - A more frequent review better captures the evolution of data and regulation. Separately, the EU in May 2025 mandated that **index administrator**s shall include as of January 2026 the acronyms ‘CTB’ in the name of Climate T...
> — [CTB, PAB climate benchmarks evolve with investment landscape | Blog posts | S...](https://stoxx.com/ctb-pab-climate-benchmarks-evolve-with-investment-landscape) — "WHITEPAPER"

**Sources:**
- [Index Files Guide 20230619 (PDF)](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)
- [Q&amp;A: Index Industry Association’s Rick Redding | Blog posts | STOXX](https://stoxx.com/qa-index-industry-associations-rick-redding-qa-index-industry-associations-rick-redding) — "WHITEPAPER"
- [Guide To Eurogov Bond Indices (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/Guide_to_EUROGOV_Bond_Indices.pdf)
- [STOXX Named Administrator Under EU Benchmarks Regulation STOXX Named Administrator Under EU Benchmarks Regulation | Blog posts | STOXX](https://stoxx.com/stoxx-named-administrator-under-eu-benchmarks-regulation-stoxx-named-administrator-under-eu-benchmarks-regulation) — "WHITEPAPER"
- [CTB, PAB climate benchmarks evolve with investment landscape | Blog posts | STOXX](https://stoxx.com/ctb-pab-climate-benchmarks-evolve-with-investment-landscape) — "WHITEPAPER"

---

### ISIN (International Securities Identification Number)

<span style="background:red; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="2,027 mentions across STOXX & ISS pages (high)">▰▰▰▰▰▰ 2,027</span>


> A twelve-character alphanumeric code (defined by ISO 6166) that uniquely identifies a specific security — such as an equity share, bond, or fund — across global markets.

ISINs are the universal passport number for financial instruments. Every constituent in a STOXX index is identified by its ISIN, ensuring there is no ambiguity when a company is dual-listed or when local ticker symbols conflict. ISS also keys its governance and ESG data to ISINs to enable precise matching with portfolio holdings.

> [!tip] Related Terms
> [[#RIC (Reuters Instrument Code)]], [[#Data Vendor Code]], [[#Selection List]]




> [!quote] Monthly Index News April 2018 (PDF)
> April 2018 STOXX Thematic Indices Key points Thematic investing underperformed in April amid the broader rally in market-capitalization benchmarks. The iSTOXX® FactSet Digitalisation Index was the exception, rising 3%. At the other end, the iSTOXX® FactSet Automation & Robotics Index fell 1.3%. The STOXX thematic indices are composed of companies with the highest revenue exposure to respective ...
> — [Monthly Index News April 2018 (PDF)](https://stoxx.com/monthly-index-news-april-2018)

> [!quote] Canada Tsx Voting Guidelines (PDF)
> the problematic pay practices listed in this policy; Egregious employment contracts: ▪ Contracts containing multiyear guarantees for salary increases, bonuses, or equity compensation; Employee Loans: ▪ Interest free or low interest loans extended by the company to employees for the purpose of exercising options or acquiring equity to meet holding requirements or as compensation; Excessive sever...
> — [Canada Tsx Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2020/americas/Canada-TSX-Voting-Guidelines.pdf)

> [!quote] Ingersoll Rand (PDF)
> recognizedthe differences. WeareinterpretingthecurrentpolicyproposaltomeanthatISSwouldrecommendin favorofshareissuanceauthorities withoutpreemptionrightsofupto20percentofcurrentlyissued capitalandthat ISSisnotseekingtofurtherlimitthegeneralissuance authorities.Ifthisis the intendedchange,wesupportraisingthecurrentlimitations onshareissuances. Wewouldfurther arguethatthislimitshouldbeuncappedas ...
> — [Ingersoll Rand (PDF)](https://www.issgovernance.com/file/policy/ingersoll_rand.pdf)

> [!quote] Ixarobu (PDF)
> pplies liquidity and size screens and aims to have a minimum number of 80 components. It is adjusted equal-weighted and reviewed annually in June. The detailed methodology including the calculation formula can be found in our rulebooks: www.stoxx.com/rulebooks Versions and symbols Quick facts Index **ISIN** Symbol Bloomberg Reuters Weighting Adjusted Equal-weighted Net Return USD CH0325904388 IXARO...
> — [Ixarobu (PDF)](https://www.stoxx.com/document/Bookmarks/CurrentFactsheets/IXAROBU.pdf)

> [!quote] Us Procedures And Policies Faq (PDF)
> ccessful; › Increasing the vote requirement for shareholders to amend charter/bylaws; › Adopting a plurality vote standard in uncontested director elections, or a majority vote standard in contested director elections; › Removing or restricting the right of shareholders to call a special meeting (raising thresholds, restricting agenda items); and › Removing or materially restricting the shareho...
> — [Us Procedures And Policies Faq (PDF)](https://www.issgovernance.com/file/policy/2018/americas/US-Procedures-and-Policies-FAQ.pdf)

**Sources:**
- [Monthly Index News April 2018 (PDF)](https://stoxx.com/monthly-index-news-april-2018)
- [Canada Tsx Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2020/americas/Canada-TSX-Voting-Guidelines.pdf)
- [Ingersoll Rand (PDF)](https://www.issgovernance.com/file/policy/ingersoll_rand.pdf)
- [Ixarobu (PDF)](https://www.stoxx.com/document/Bookmarks/CurrentFactsheets/IXAROBU.pdf)
- [Us Procedures And Policies Faq (PDF)](https://www.issgovernance.com/file/policy/2018/americas/US-Procedures-and-Policies-FAQ.pdf)

---

## L

### Look-Ahead Bias

> A methodological error that occurs when a back-test or simulation incorporates information that would not have been available to market participants at the historical point in time being modelled.

Look-ahead bias is one of the most dangerous pitfalls in index design and quantitative research. For example, if a back-test uses annual carbon-emissions data published in April to make a "January" portfolio decision, it is using future information. STOXX and ISS mitigate this by documenting data availability lags and enforcing point-in-time data usage in their methodologies.

> [!tip] Related Terms
> [[#Point-in-Time Data]], [[#Back-Testing]], [[#Survivorship Bias]], [[#Historical Simulation]]

**Sources:**

---

## M

### Methodology Consultation

> A formal, time-bound process in which an index administrator publicly solicits feedback from stakeholders — licensees, market participants, regulators, and advisory committees — before implementing material changes to an index methodology.

Under the EU Benchmarks Regulation, STOXX is required to consult on any proposed methodology change that would materially affect the benchmark's representativeness or the value of financial products referencing it. Consultation papers describe the proposed change, provide impact analysis, and invite written responses during a defined comment period (typically 30 to 60 days). STOXX publishes a summary of feedback received and a final decision notice. ISS follows a similar consultation model for its benchmark voting policies, issuing draft policy updates each autumn for client comment before the next proxy season.

> [!tip] Related Terms
> [[#Benchmark Administration]], [[#Benchmark Statement]], [[#Rulebook]], [[#Oversight Function]]

**Sources:**

---

## O

### Oversight Function

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="7 mentions across STOXX & ISS pages (low)">▰▰ 7</span>


> An internal or independent committee established by a benchmark administrator to monitor and review all aspects of benchmark provision, including methodology integrity, data quality, conflict-of-interest management, and complaint handling, as required by the EU Benchmarks Regulation.

The oversight function is the governance watchdog inside an index provider. For STOXX, this takes the form of an Oversight Committee with a defined charter, meeting cadence, and escalation authority. The committee reviews methodology changes, monitors for errors or manipulation, evaluates the adequacy of data inputs, and ensures that the administrator's code of conduct is followed. It operates independently from the commercial and index-operations teams to avoid conflicts of interest. ISS maintains analogous governance structures for its benchmark-related products.

> [!tip] Related Terms
> [[#Benchmark Administration]], [[#Index Administrator]], [[#Methodology Consultation]], [[#Quality Assurance (Data)]]




> [!quote] 2016 Russia Kazakhstan Voting Guidelines Dec 2015 (PDF)
> te effective from 21 February 2013). On 1 September 2013, the powers of the Federal Financial Markets Service (FFMS), Russia's securities commission, in the field of regulation, control and supervision in the financial markets were transferred to the Bank of Russia. The regulatory, supervisory, and **oversight function**s of the Bank of Russia in the field of financial markets will be fulfilled by ...
> — [2016 Russia Kazakhstan Voting Guidelines Dec 2015 (PDF)](https://www.issgovernance.com/file/policy/2016-russia-kazakhstan-voting-guidelines-dec-2015.pdf)

> [!quote] 2017 Russia Kazakhstan Proxy Voting Guidelines (PDF)
> te effective from 21 February 2013). On 1 September 2013, the powers of the Federal Financial Markets Service (FFMS), Russia's securities commission, in the field of regulation, control and supervision in the financial markets were transferred to the Bank of Russia. The regulatory, supervisory, and **oversight function**s of the Bank of Russia in the field of financial markets will be fulfilled by ...
> — [2017 Russia Kazakhstan Proxy Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2017-russia-kazakhstan-proxy-voting-guidelines.pdf)

> [!quote] 2015Russiaandkazakhstanvotingguidelines (PDF)
> te effective from 21 February 2013). On 1 September 2013, the powers of the Federal Financial Markets Service (FFMS), Russia's securities commission, in the field of regulation, control and supervision in the financial markets were transferred to the Bank of Russia. The regulatory, supervisory, and **oversight function**s of the Bank of Russia in the field of financial markets will be fulfilled by ...
> — [2015Russiaandkazakhstanvotingguidelines (PDF)](https://www.issgovernance.com/file/policy/2015russiaandkazakhstanvotingguidelines.pdf)

> [!quote] Russia And Kazakhstan Voting Guidelines (PDF)
> te effective from 21 February 2013). On 1 September 2013, the powers of the Federal Financial Markets Service (FFMS), Russia's securities commission, in the field of regulation, control and supervision in the financial markets were transferred to the Bank of Russia. The regulatory, supervisory, and **oversight function**s of the Bank of Russia in the field of financial markets will be fulfilled by ...
> — [Russia And Kazakhstan Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2020/emea/Russia-and-Kazakhstan-Voting-Guidelines.pdf)

> [!quote] Russia And Kazakhstan Voting Guidelines (PDF)
> te effective from 21 February 2013). On 1 September 2013, the powers of the Federal Financial Markets Service (FFMS), Russia's securities commission, in the field of regulation, control and supervision in the financial markets were transferred to the Bank of Russia. The regulatory, supervisory, and **oversight function**s of the Bank of Russia in the field of financial markets will be fulfilled by ...
> — [Russia And Kazakhstan Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2019/emea/Russia-and-Kazakhstan-Voting-Guidelines.pdf)

**Sources:**
- [2016 Russia Kazakhstan Voting Guidelines Dec 2015 (PDF)](https://www.issgovernance.com/file/policy/2016-russia-kazakhstan-voting-guidelines-dec-2015.pdf)
- [2017 Russia Kazakhstan Proxy Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2017-russia-kazakhstan-proxy-voting-guidelines.pdf)
- [2015Russiaandkazakhstanvotingguidelines (PDF)](https://www.issgovernance.com/file/policy/2015russiaandkazakhstanvotingguidelines.pdf)
- [Russia And Kazakhstan Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2020/emea/Russia-and-Kazakhstan-Voting-Guidelines.pdf)
- [Russia And Kazakhstan Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2019/emea/Russia-and-Kazakhstan-Voting-Guidelines.pdf)

---

## P

### Pro-Forma Data

> Hypothetical or adjusted data that shows what an index's composition, weights, or performance would look like if a proposed methodology change, corporate action, or rebalancing had already been applied, before the change takes effect.

Pro-forma data is the "preview" of an index change. When STOXX announces a quarterly rebalancing, it often publishes pro-forma constituent lists and weights several days before the effective date, giving passive fund managers time to prepare their trades. Similarly, when a methodology consultation proposes new screening criteria, STOXX may provide pro-forma back-tests showing how the index would have behaved under the proposed rules. ISS uses pro-forma analyses when evaluating the impact of governance policy changes on voting recommendations.

> [!tip] Related Terms
> [[#Review Report]], [[#Selection List]], [[#Back-Testing]], [[#Methodology Consultation]]

**Sources:**

---

### Panel Data

> A dataset that combines cross-sectional and time-series dimensions, tracking multiple entities across multiple time periods so that each observation is identified by both an entity and a date.

Panel data is the gold standard for empirical research in finance. If you have ESG scores for 3,000 companies observed quarterly over ten years, that is a panel. ISS's historical ESG and governance databases are structured as panels, enabling clients to study how governance quality evolves over time and across peer groups.

> [!tip] Related Terms
> [[#Cross-Sectional Data]], [[#Time Series Data]], [[#Point-in-Time Data]]

**Sources:**

---

### Point-in-Time Data

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="3 mentions across STOXX & ISS pages (ultra-low)">▰ 3</span>


> Data that is stored and delivered exactly as it was known on a specific historical date, preserving the original values before any subsequent revisions, restatements, or corrections.

Point-in-time (PIT) databases are essential for unbiased back-testing. If a company restates its 2023 emissions in 2025, a PIT database retains both the original 2023 figure (as known in 2023) and the restated figure (as known in 2025). Using PIT data ensures that simulations reflect only the information that was actually available to decision-makers at each historical moment.

> [!tip] Related Terms
> [[#Look-Ahead Bias]], [[#Back-Testing]], [[#Panel Data]], [[#Survivorship Bias]]




> [!quote] Solutions for Academic Professionals
> SUSTAINABILITY SOLUTIONS Solutions for Academic Professionals A robust and timely set of environmental, social, and governance datasets to help enrich your academic research. Access in-depth **point-in-time data** on global corporate directors, executive compensation, corporate governance, company vote results, climate and emissions data, and various other sustainability datasets. Enhance your Rese...
> — [Solutions for Academic Professionals](https://www.issgovernance.com/sustainability/solutions-for-academic-professionals) — "SUSTAINABILITY SOLUTIONS"

> [!quote] ISS ESG to Present Latest Responsible Investment Solutions at PRI in Person |...
> from 1/best to 10/worst) that is now shown in the ESG Corporate and Country Ratings gives investors and rated companies a relative perspective to the rating score. It is an addition to the absolute rating score that ranges from D- (worst) to A+ (best). - The addition of ISS Governance QualityScore **point-in-time data** on Open:FactSet Marketplace. The data covers 7,800 global companies on topics r...
> — [ISS ESG to Present Latest Responsible Investment Solutions at PRI in Person |...](https://www.issgovernance.com/iss-esg-to-present-latest-responsible-investment-solutions-at-pri-in-person) — "ISS ESG to Present Latest Responsible Investment Solutions at PRI in Person"

> [!quote] ISS ESG to Provide Robust Data Sets Through the Open:FactSet Marketplace | ISS
> es Inc., today announced the addition of new data sets on the Open:FactSet Marketplace to aid investors seeking to integrate extra-financial considerations into their investment decision-making. Effective today, authorized users of the Open:FactSet Marketplace can access ISS Governance QualityScore **point-in-time data** that covers 7,800 global companies on topics ranging from compensation to shar...
> — [ISS ESG to Provide Robust Data Sets Through the Open:FactSet Marketplace | ISS](https://www.issgovernance.com/iss-esg-to-provide-robust-data-sets-through-the-openfactset-marketplace) — "ISS ESG to Provide Robust Data Sets  Through the Open:FactSet Marketplace"

**Sources:**
- [Solutions for Academic Professionals](https://www.issgovernance.com/sustainability/solutions-for-academic-professionals) — "SUSTAINABILITY SOLUTIONS"
- [ISS ESG to Present Latest Responsible Investment Solutions at PRI in Person | ISS](https://www.issgovernance.com/iss-esg-to-present-latest-responsible-investment-solutions-at-pri-in-person) — "ISS ESG to Present Latest Responsible Investment Solutions at PRI in Person"
- [ISS ESG to Provide Robust Data Sets Through the Open:FactSet Marketplace | ISS](https://www.issgovernance.com/iss-esg-to-provide-robust-data-sets-through-the-openfactset-marketplace) — "ISS ESG to Provide Robust Data Sets  Through the Open:FactSet Marketplace"

---

## Q

### Quality Assurance (Data)

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="3 mentions across STOXX & ISS pages (ultra-low)">▰ 3</span>


> The systematic processes, checks, and controls that a data provider applies to ensure accuracy, completeness, timeliness, and consistency of its datasets before publication or delivery to clients.

Quality assurance (QA) in the index and ESG data world encompasses automated validation rules (e.g., a market-cap value cannot be negative), manual review by analysts, reconciliation against independent sources, and exception-handling workflows. STOXX's index operations team runs multi-layered QA on every corporate action, rebalancing, and daily calculation. ISS applies similar rigour to governance scores, flagging outliers for analyst review.

> [!tip] Related Terms
> [[#Benchmark Administration]], [[#Estimation Model]], [[#Review Report]]




> [!quote] Dax Equity Calculation Guide 20231002 (PDF)
> cy exchange rates provided by Refinitiv. 4.2. MONITORING The real-time input data feeds for the index calculation are monitored continuously to ensure data quality and availability. Data monitoring controls include data filters according to each exchange specification, outlier detection mechanisms, **quality assurance** tools and verification against secondary sources. 4.3. DATA ACCURACY The data a...
> — [Dax Equity Calculation Guide 20231002 (PDF)](https://www.stoxx.com/document/News/2023/October/DAX%20Equity%20Calculation%20Guide_20231002.pdf)

> [!quote] Asset-owner panel discusses drivers, merits of integrating SDGs into investme...
> orm’s partners and their research teams. Looking at revenues gives investors an objective, consistent and transparent dataset that has been audited and is universally available, he added. The data, which has grown to include negative contribution to the SDGs and SDGs-aligned patents, goes through a **quality assurance** process with the input of expert analysts, and benefits from the continuous fee...
> — [Asset-owner panel discusses drivers, merits of integrating SDGs into investme...](https://stoxx.com/asset-owner-panel-discusses-drivers-merits-of-integrating-sdgs-into-investment-portfolios) — "WHITEPAPER"

> [!quote] ISS Reconfirmed as Climate Bonds Standard &amp; Certification Scheme Verifier...
> eligibility criteria for assets and projects that can be used for Climate Bonds and Green Bonds, said Dr. Maximilian Horster, Head of ISS-climate. “We are proud of the reconfirmation of our Approved Verifier status and look forward to the continued contribution of our knowledge and expertise to the **quality assurance** of these bonds.“ ISS ESG offers a broad range of Green Bond Services delivered ...
> — [ISS Reconfirmed as Climate Bonds Standard &amp; Certification Scheme Verifier...](https://www.issgovernance.com/iss-reconfirmed-climate-bonds-standard-certification-scheme-verifier) — "ISS Reconfirmed as Climate Bonds Standard & Certification Scheme Verifier"

**Sources:**
- [Dax Equity Calculation Guide 20231002 (PDF)](https://www.stoxx.com/document/News/2023/October/DAX%20Equity%20Calculation%20Guide_20231002.pdf)
- [Asset-owner panel discusses drivers, merits of integrating SDGs into investment portfolios | Blog posts | STOXX](https://stoxx.com/asset-owner-panel-discusses-drivers-merits-of-integrating-sdgs-into-investment-portfolios) — "WHITEPAPER"
- [ISS Reconfirmed as Climate Bonds Standard &amp; Certification Scheme Verifier | ISS](https://www.issgovernance.com/iss-reconfirmed-climate-bonds-standard-certification-scheme-verifier) — "ISS Reconfirmed as Climate Bonds Standard & Certification Scheme Verifier"

---

## R

### Restatement

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="299 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 299</span>


> A revision to previously published data — such as financial figures, ESG metrics, or index values — issued by either the reporting company or the data provider to correct errors, reflect updated methodologies, or incorporate newly available information.

Restatements are the data world's errata. A company may restate its carbon emissions after discovering a measurement error; ISS may revise a governance score after receiving corrected board-composition data; STOXX may restate an index level if a corporate-action adjustment was applied incorrectly. Point-in-time databases preserve both the original and restated values so that historical analyses remain unbiased. High restatement frequency in a dataset can signal underlying data-quality issues and is tracked as part of quality assurance.

> [!tip] Related Terms
> [[#Point-in-Time Data]], [[#Quality Assurance (Data)]], [[#Look-Ahead Bias]], [[#Vendor Reconciliation]]




> [!quote] Issusfaqspoliciesandprocedures04302014 (PDF)
> those related to tax compliance and preparation fees, i.e. the preparation of original and amended tax returns, refund claims, and tax payment planning, vs. those related to all other services in the tax category, such as tax advice, planning, or consulting. 18. What is ISS’ definition of “material **restatement**s”? When determining if a company has a material **restatement**, ISS’ guidelines are:  H...
> — [Issusfaqspoliciesandprocedures04302014 (PDF)](https://www.issgovernance.com/file/2014_Policies/ISSUSFAQsPoliciesandProcedures04302014.pdf)

> [!quote] Australian Pay For Performance Faq (PDF)
> he rationale behind this decision is that the total pay prior to the **restatement** was what the remuneration committee intended to award the executive, and therefore that this is the best measure of the remuneration committee’s decisions regarding pay amounts awarded. Subsequent events that lead to a **restatement** of grant date values or an executive declining pay-related awards may be included in ...
> — [Australian Pay For Performance Faq (PDF)](https://www.issgovernance.com/file/policy/2018/asiapacific/Australian-Pay-for-Performance-FAQ.pdf)

> [!quote] 2015Southafricavotingguidelines (PDF)
> rectors. Each director must be categorised as either executive, non-executive or independent (LR s3.84(f)). General Recommendation: Vote for the re-election of directors, unless: › Adequate disclosure has not been provided in a timely manner; › There are clear concerns over questionable finances or **restatement**s, questionable transactions with conflicts of interest or records of abuses against m...
> — [2015Southafricavotingguidelines (PDF)](https://www.issgovernance.com/file/policy/2015southafricavotingguidelines.pdf)

> [!quote] Sustainability Us Voting Guidelines (PDF)
> ses where an executive's fraud, misconduct, or negligence significantly contributed to a **restatement** of financial results that led to the awarding of unearned incentive compensation. However, such policies may be narrow given that not all misconduct or negligence may result in significant financial **restatement**s. Misconduct, negligence or lack of sufficient oversight by senior executives may lea...
> — [Sustainability Us Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2021/specialty/Sustainability-US-Voting-Guidelines.pdf)

> [!quote] Istoxx Index Guide (PDF)
> B Global ex Japan Minimum Variance and iSTOXX MUTB Global Minimum Variance) » December 2017 (2): Addition of iSTOXX American Century USA Indices » January 2018: Amendment in the base values of the iSTOXX China H 20 Equal Weight HKD Index and iSTOXX Switzerland 10 Equal Weight CHF Index, following a **restatement** in their history. Clarification of index-specific dissemination calendars in line wit...
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

**Sources:**
- [Issusfaqspoliciesandprocedures04302014 (PDF)](https://www.issgovernance.com/file/2014_Policies/ISSUSFAQsPoliciesandProcedures04302014.pdf)
- [Australian Pay For Performance Faq (PDF)](https://www.issgovernance.com/file/policy/2018/asiapacific/Australian-Pay-for-Performance-FAQ.pdf)
- [2015Southafricavotingguidelines (PDF)](https://www.issgovernance.com/file/policy/2015southafricavotingguidelines.pdf)
- [Sustainability Us Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2021/specialty/Sustainability-US-Voting-Guidelines.pdf)
- [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)

---

### Review Report

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="72 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 72</span>


> A document published by an index administrator or advisory committee following a periodic index review, summarising the changes to index composition (additions, deletions, and share adjustments) and the rationale behind them.

After each quarterly or annual review, STOXX publishes a review report (sometimes called an announcement) that lists which companies are entering or leaving the index and any changes to free-float factors or share counts. These reports are closely watched by passive fund managers, who must execute rebalancing trades to match the new composition. ISS similarly publishes review and update reports for its governance and ESG rating changes.

> [!tip] Related Terms
> [[#Selection List]], [[#Rulebook]], [[#Index Administrator]]




> [!quote] Stoxx Index Guide (PDF)
> STOXX INDEX METHODOLOGY GUIDE 43/639 5. INDEX CHARACTERISTICS During review implementation month, the published **review report** in combination with the selection list will be used to select a replacement. With the public announcement of the **review report** in the review implementation month, the highest ranked non-component from the selection list, which is not announced an addition to the affected...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] Uk And Ireland Voting Guidelines (PDF)
> org/sites/default/files/2019-05/ERWG%20Final%20Report%20July%202016.pdf The GC100 and Investor Group Directors' Remuneration Reporting Guidance (2019) http://uk.practicallaw.com/groups/uk-gc100-investor-group Hampton-Alexander Review (2019) https://ftsewomenleaders.com/wp-content/uploads/2019/11/HA-Review-Report-2019.pdf The Investment Association Principles of Remuneration (2021) https://www.i...
> — [Uk And Ireland Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2022/emea/UK-and-Ireland-Voting-Guidelines.pdf)

> [!quote] CSP Reports | STOXX
> entation Methodology Rulebooks Withholding tax Sector classification changes Country classification Dissemination Data and reports End of the day data Index values & divisors Currency rates Historical component changes DAX legacy reports Corporate actions Periodic review information Selection lists **Review report**s Monthly data Simulation files Services Index licensing License agreement form Acad...
> — [CSP Reports | STOXX](https://stoxx.com/csp-reports) — "WHITEPAPER"

> [!quote] Dax Equity Index Methodology Guide 5526498614 (PDF)
> n week but prior to Wednesday, the intra quarter capping rule shall not be applied. If this breach is not subsequently resolved by the upcoming review implementation, the weighting cap factors will be recalculated based on Tuesday’s closing prices, and revised weighting cap factors announced in the **Review Report**s published on Wednesday. Where a capping breach occurs from Wednesday onwards, then...
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)

> [!quote] U.K. Regulators Revamp Banker Pay Rules | ISS
> e U.K. banking sector, and subsequent recommendations for legislative and other action. Allied with the requirement to propose binding remuneration policy votes for U.K.-incorporated companies, and the Europe-wide CRD IV regulatory regime for EU banks (see the 2015 ISS United Kingdom Voting Season P**review Report** for more information), the new regulatory environment for bankers’ pay in the U.K. ...
> — [U.K. Regulators Revamp Banker Pay Rules | ISS](https://www.issgovernance.com/u-k-regulators-revamp-banker-pay-rules) — "U.K. Regulators Revamp Banker Pay Rules"

**Sources:**
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [Uk And Ireland Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2022/emea/UK-and-Ireland-Voting-Guidelines.pdf)
- [CSP Reports | STOXX](https://stoxx.com/csp-reports) — "WHITEPAPER"
- [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
- [U.K. Regulators Revamp Banker Pay Rules | ISS](https://www.issgovernance.com/u-k-regulators-revamp-banker-pay-rules) — "U.K. Regulators Revamp Banker Pay Rules"

---

### RIC (Reuters Instrument Code)

<span style="background:deeppink; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="23,322 mentions across STOXX & ISS pages (ultra-high)">▰▰▰▰▰▰▰ 23,322</span>


> A proprietary ticker-like identifier assigned by Refinitiv (formerly Reuters) to uniquely reference a financial instrument — such as an equity, index, or derivative — within the Refinitiv Eikon and Elektron platforms.

RICs are one of several vendor-specific codes that STOXX publishes for each index. A RIC such as `.STOXX50E` allows Refinitiv terminal users and API consumers to pull real-time and historical data for the EURO STOXX 50. Because RICs are proprietary, they are not interchangeable with Bloomberg tickers or ISINs, making cross-reference tables essential for multi-vendor environments.

> [!tip] Related Terms
> [[#Data Vendor Code]], [[#ISIN (International Securities Identification Number)]], [[#Data Feed]]




> [!quote] Monthly Index News April 2020 (PDF)
> n March that dragged the index to its lowest level since 2016. April marked the index’s strongest monthly performance since April 2009, when equities rebounded from the global financial crisis, and its second-steepest monthly gain on record. The index is now down 12.2% for 2020. The STOXX® North America 600 Index posted its best monthly showing since data begins in 2004, leading gains among the...
> — [Monthly Index News April 2020 (PDF)](https://stoxx.com/monthly-index-news-april-2020)

> [!quote] Canadian Equity Plan Scorecard Faq (PDF)
> ................................................................ 11 20. What constitutes repricing? ................................................................................................................................. 12 21. What is ISS' policy regarding options with declining exercise prices? ................................................................. 12 Factor Methodology Qu...
> — [Canadian Equity Plan Scorecard Faq (PDF)](https://www.issgovernance.com/file/policy/2018/americas/Canadian-Equity-Plan-Scorecard-FAQ.pdf)

> [!quote] Israel 2014 2015 Policy (PDF)
> t shareholder of the company; › Any director who is also an employee or executive of a significant shareholder of the company; › Any director who is nominated by a dissenting significant shareholder, unless there is a clear lack of material[5] connection with the dissident, either currently or historically; › Beneficial owner (direct or indirect) of at least 10 percent of the company's stock, e...
> — [Israel 2014 2015 Policy (PDF)](https://www.issgovernance.com/file/policy/israel-2014-2015-policy.pdf)

> [!quote] Stoxx Digital Asset Guide (PDF)
> 6 5. STOXX DIGITAL ASSET BLUE CHIP INDEX 20 GLOSSARY OF TERMS 6 SECTOR CLASSIFICATIONS 7 INDEX DESCRIPTION 20 ASSET UNIVERSE 7 INDEX INFORMATION 20 EXCHANGE SELECTION 8 INDEX REVIEW 20 3.4.1. UNIVERSE OF CONTRIBUTING EXCHANGES 8 5.3.1. SELECTION CRITERIA 20 3.4.2. BASE EXCHANGE SCORE 8 5.3.1.1. METRIC DEFINITIONS 20 3.4.3. VOLUME ADJUSTED SCORE 9 5.3.1.2. METRIC FORMULAE 21 3.4.4. DECAYED VOLUM...
> — [Stoxx Digital Asset Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_digital_asset_guide.pdf)

> [!quote] Monthly Index News July 2023 (PDF)
> metal. The methodology uses FactSet’s granular RBICS Focus business classification and revenue datasets to target relevant companies. The brown-to-green revolution requires substantial amounts of metals such as copper, lithium, nickel, cobalt and aluminum, which are good conductors of heat and electricity, and are ductile and malleable. The minerals are enabling the structural boom in solar and...
> — [Monthly Index News July 2023 (PDF)](https://stoxx.com/monthly-index-news-july-2023)

**Sources:**
- [Monthly Index News April 2020 (PDF)](https://stoxx.com/monthly-index-news-april-2020)
- [Canadian Equity Plan Scorecard Faq (PDF)](https://www.issgovernance.com/file/policy/2018/americas/Canadian-Equity-Plan-Scorecard-FAQ.pdf)
- [Israel 2014 2015 Policy (PDF)](https://www.issgovernance.com/file/policy/israel-2014-2015-policy.pdf)
- [Stoxx Digital Asset Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_digital_asset_guide.pdf)
- [Monthly Index News July 2023 (PDF)](https://stoxx.com/monthly-index-news-july-2023)

---

### Rulebook

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="86 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 86</span>


> The comprehensive, legally binding document published by an index administrator that specifies every aspect of an index's construction, maintenance, calculation, and governance — serving as the definitive methodology reference.

The rulebook is the single source of truth for an index. It details the universe, selection criteria, weighting scheme, rebalancing schedule, corporate-action treatment, and extraordinary-event procedures. STOXX publishes rulebooks for each index family, and any deviation from the rulebook must go through a formal governance and consultation process under BMR requirements.

> [!tip] Related Terms
> [[#Benchmark Administration]], [[#Index Administrator]], [[#Review Report]], [[#Factsheet]]




> [!quote] MDAX index: 30 years benchmarking Germany’s Mittelstand | Blog posts | STOXX
> ex with this level of investability, showcasing the strength and momentum of Germany’s mid‑cap leaders, and powered by a methodology engineered for liquidity and reliable, rules‑based stability,” said Serkan Batir, Managing Director, Global Head of Index Product Development and Benchmarks at STOXX. **Rulebook** changes The MDAX has undergone adjustments to its methodology in the past three decades....
> — [MDAX index: 30 years benchmarking Germany’s Mittelstand | Blog posts | STOXX](https://stoxx.com/mdax-index-30-years-benchmarking-germanys-mittelstand) — "WHITEPAPER"

> [!quote] Sx5Evbt (PDF)
> 0%/30% volatility (VSTOXX) one-month back are observed. Depending on the relationship between realized and expected volatility, the exposure No. of components Excess, gross return (EUR): end-of-day may be adjusted. To learn more about the adjustment level and the calculation formula, please see our **rulebook**: Review frequency End-of-day: 7:15 pm CET www.stoxx.com/indices/**rulebook**s.html Calculati...
> — [Sx5Evbt (PDF)](https://www.stoxx.com/document/Indices/Factsheets/2020/May/SX5EVBT.pdf)

> [!quote] Ixarobu (PDF)
> s that display high ESG Controversy Ratings are also excluded. The index applies liquidity and size screens and aims to have a minimum number of 80 components. It is adjusted equal-weighted and reviewed annually in June. The detailed methodology including the calculation formula can be found in our **rulebook**s: www.stoxx.com/**rulebook**s Versions and symbols Quick facts Index ISIN Symbol Bloomberg R...
> — [Ixarobu (PDF)](https://www.stoxx.com/document/Bookmarks/CurrentFactsheets/IXAROBU.pdf)

> [!quote] Dax Equity Index Methodology Guide 5526498614 (PDF)
> DAX EQUITY INDEX METHODOLOGY GUIDE 16/120 5. STOCK CHARACTERISTICS statements on its website at https://www.stoxx.com/**rulebook**s. These statements must be published annually. » Minimum liquidity on the FSE: o Initial eligibility: To qualify for ranking, stocks that are not an index component at the review cutoff date must have a minimum order book volume over the last 12 months of EUR 1bn, or a ...
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)

> [!quote] Stoxx World Equity Index Guide (PDF)
> political changes and developments in the investment industry. As result of these activities, STOXX introduces changes to the methodology books. Material changes are notified to subscribers and the media through the usual communication channels. Clarifications of the methodology are updated in the **rulebook**. All changes are tracked in the section 7.1. INDEX TERMINATION POLICY For the termination...
> — [Stoxx World Equity Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)

**Sources:**
- [MDAX index: 30 years benchmarking Germany’s Mittelstand | Blog posts | STOXX](https://stoxx.com/mdax-index-30-years-benchmarking-germanys-mittelstand) — "WHITEPAPER"
- [Sx5Evbt (PDF)](https://www.stoxx.com/document/Indices/Factsheets/2020/May/SX5EVBT.pdf)
- [Ixarobu (PDF)](https://www.stoxx.com/document/Bookmarks/CurrentFactsheets/IXAROBU.pdf)
- [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
- [Stoxx World Equity Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_world_equity_index_guide.pdf)

---

## S

### Selection List

<span style="background:red; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1,076 mentions across STOXX & ISS pages (high)">▰▰▰▰▰▰ 1,076</span>


> The finalised roster of securities or entities that have passed all eligibility screens, liquidity filters, and ranking criteria during an index review and will be included in the index for the upcoming period.

The selection list is the output of the review process — the names that "made the cut." For STOXX indices, the selection list is determined by applying the rulebook's criteria to the coverage universe at the review cut-off date. The list is typically published several days before the effective date to give the market time to anticipate rebalancing flows.

> [!tip] Related Terms
> [[#Coverage Universe]], [[#Universe Construction]], [[#Review Report]]




> [!quote] Stoxx Index Guide (PDF)
> X Emerging Markets Equity Factor Index, STOXX International Small-Cap Equity Factor Index and STOXX Global Equity Factor Index. December 2022(2): Amendment of the methodology of the STOXX Global Metaverse Index. Changes to be effective with March 2023 review. December 2022(3): Rule clarification of **selection list**s during review month. This is a correction to the November 2022(2): Rule clarifica...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] Index Files Guide 20230619 (PDF)
> FILES GUIDE 13 FF Mcap (MEUR) Free float market capitalization in Millions in currency EUR Number 8 14 Rank (FINAL) Rank in the **selection list** Number 0 15 Rank (PREVIOUS) Previous rank in the **selection list** Number 0 16 Comment Text 255 New Ranking of constituents, applicable for indices which are 17 Rank 2 (FINAL) Number 0 using a double ranking methodology. Rank 2 Previous Ranking of constitue...
> — [Index Files Guide 20230619 (PDF)](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)

> [!quote] Dax Equity Index Methodology Guide 5526498614 (PDF)
> mine their individual constituents’ weights. Price-weighted indices are weighted by the price plus another weighting factor. For details on the calculation formula used, see the DAX Equity Index Calculation Guide and the definition of weighting factors provided in section 5.9 of this document. 4.2. **SELECTION LIST**S **Selection list**s are produced for indices that have a fixed number of constituents...
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)

> [!quote] Stoxx Index Guide (PDF)
> X Emerging Markets Equity Factor Index, STOXX International Small-Cap Equity Factor Index and STOXX Global Equity Factor Index. December 2022(2): Amendment of the methodology of the STOXX Global Metaverse Index. Changes to be effective with March 2023 review. December 2022(3): Rule clarification of **selection list**s during review month. This is a correction to the November 2022(2): Rule clarifica...
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)

> [!quote] Index Files Guide 20230619 (PDF)
> FILES GUIDE 13 FF Mcap (MEUR) Free float market capitalization in Millions in currency EUR Number 8 14 Rank (FINAL) Rank in the **selection list** Number 0 15 Rank (PREVIOUS) Previous rank in the **selection list** Number 0 16 Comment Text 255 New Ranking of constituents, applicable for indices which are 17 Rank 2 (FINAL) Number 0 using a double ranking methodology. Rank 2 Previous Ranking of constitue...
> — [Index Files Guide 20230619 (PDF)](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)

> [!quote] Dax Equity Index Methodology Guide 5526498614 (PDF)
> mine their individual constituents’ weights. Price-weighted indices are weighted by the price plus another weighting factor. For details on the calculation formula used, see the DAX Equity Index Calculation Guide and the definition of weighting factors provided in section 5.9 of this document. 4.2. **SELECTION LIST**S **Selection list**s are produced for indices that have a fixed number of constituents...
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)

> [!quote] ESG Index Geared to Structured Products | Blog posts | STOXX
> renewable-energy initiatives, according to the thorough environmental data rankings from CDP. It excludes firms deemed in contravention of UN Global Compact Principles by Sustainalytics, as well as those involved in controversial weapons activities, and in the coal and tobacco sectors. Creating the **selection list** Within the benchmark universe, the following selection filters are applied: - The ...
> — [ESG Index Geared to Structured Products | Blog posts | STOXX](https://stoxx.com/esg-index-geared-to-structured-products) — "WHITEPAPER"

> [!quote] Sx50Ugv (PDF)
> railing STOXX USA 500 Index 23.3 18.2 19.4 17.1 0.1 1.3 2.4 17.6 STOXX USA Total Market Index 24.1 18.4 18.0 16.3 0.1 1.2 2.1 18.2 Performance and annual returns4 Methodology The universe is the STOXX USA 900. All stocks in the index universe are ranked by free-float market cap to produce the index **selection list**. The index aims to cover the 500 largest companies in terms of free-float market c...
> — [Sx50Ugv (PDF)](https://www.stoxx.com/document/Indices/Factsheets/2022/December/SX50UGV.pdf)

> [!quote] ESG Index Geared to Structured Products | Blog posts | STOXX
> renewable-energy initiatives, according to the thorough environmental data rankings from CDP. It excludes firms deemed in contravention of UN Global Compact Principles by Sustainalytics, as well as those involved in controversial weapons activities, and in the coal and tobacco sectors. Creating the **selection list** Within the benchmark universe, the following selection filters are applied: - The ...
> — [ESG Index Geared to Structured Products | Blog posts | STOXX](https://stoxx.com/esg-index-geared-to-structured-products) — "WHITEPAPER"

> [!quote] Sx50Ugv (PDF)
> railing STOXX USA 500 Index 23.3 18.2 19.4 17.1 0.1 1.3 2.4 17.6 STOXX USA Total Market Index 24.1 18.4 18.0 16.3 0.1 1.2 2.1 18.2 Performance and annual returns4 Methodology The universe is the STOXX USA 900. All stocks in the index universe are ranked by free-float market cap to produce the index **selection list**. The index aims to cover the 500 largest companies in terms of free-float market c...
> — [Sx50Ugv (PDF)](https://www.stoxx.com/document/Indices/Factsheets/2022/December/SX50UGV.pdf)

**Sources:**
- [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [Index Files Guide 20230619 (PDF)](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)
- [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
- [ESG Index Geared to Structured Products | Blog posts | STOXX](https://stoxx.com/esg-index-geared-to-structured-products) — "WHITEPAPER"
- [Sx50Ugv (PDF)](https://www.stoxx.com/document/Indices/Factsheets/2022/December/SX50UGV.pdf)

---

### Simulation File

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="2 mentions across STOXX & ISS pages (ultra-low)">▰ 2</span>


> A structured data file provided by an index administrator that contains the full historical composition, weights, and corporate actions of an index, enabling clients to independently replicate past index calculations.

Simulation files are the raw material for back-testing and audit. STOXX offers simulation files as part of its data services, allowing licensees — ETF providers, structured-product issuers, and quantitative researchers — to verify that their replication of the index matches STOXX's official values. These files are typically delivered in CSV or XML format and include daily constituent snapshots.

> [!tip] Related Terms
> [[#Back-Testing]], [[#Historical Simulation]], [[#End-of-Day Data]]




> [!quote] CSP Reports | STOXX
> ks Withholding tax Sector classification changes Country classification Dissemination Data and reports End of the day data Index values & divisors Currency rates Historical component changes DAX legacy reports Corporate actions Periodic review information Selection lists Review reports Monthly data **Simulation file**s Services Index licensing License agreement form Academic data iNAV Announcements...
> — [CSP Reports | STOXX](https://stoxx.com/csp-reports) — "WHITEPAPER"

> [!quote] Dax Equity Indices Simulation Phase–From Dec 18 2023 To February 29 2024 (PDF)
> after. It will contain the new set of files per index and will allow DAX Licensees to retrieve DAX Equity daily files as well as DAX Selection Lists and DAX Index Review files. • A dedicated Web page available on www.stoxx.com > Home > Resources > Reports > Simulation - Files (https://www.stoxx.com/simulation-files) accessible to all clients based on index and third party data permission. • A d...
> — [Dax Equity Indices Simulation Phase–From Dec 18 2023 To February 29 2024 (PDF)](https://www.stoxx.com/document/News/2023/October/DAX_Equity_Indices_Simulation_Phase–from_Dec_18_2023_to_February_29_2024.pdf)

**Sources:**
- [CSP Reports | STOXX](https://stoxx.com/csp-reports) — "WHITEPAPER"
- [Dax Equity Indices Simulation Phase–From Dec 18 2023 To February 29 2024 (PDF)](https://www.stoxx.com/document/News/2023/October/DAX_Equity_Indices_Simulation_Phase–from_Dec_18_2023_to_February_29_2024.pdf)

---

### Snowflake Delivery

> A data distribution method in which a provider makes datasets available through Snowflake's cloud data platform, enabling clients to access live, query-ready data directly within their own Snowflake environment without file transfers.

Snowflake delivery represents the modern evolution of data distribution. Instead of downloading CSV files or polling an FTP server, clients can access ISS and STOXX datasets as shared tables in Snowflake, running SQL queries against always-current data. This eliminates ETL overhead, reduces latency, and ensures that all consumers are working from the same version of the data.

> [!tip] Related Terms
> [[#Data Feed]], [[#DataDesk (ISS Platform)]], [[#End-of-Day Data]]

**Sources:**

---

### Survivorship Bias

> A systematic distortion in historical analysis that arises when only currently existing entities (e.g., companies still listed) are included in a dataset, while entities that have been delisted, merged, or bankrupted are excluded.

Survivorship bias makes past performance look better than it actually was because the "losers" — companies that failed — disappear from the dataset. A back-test of a stock-selection strategy that only uses today's listed companies will overstate returns because it ignores companies that went bankrupt along the way. STOXX and ISS mitigate survivorship bias by maintaining records of delisted constituents in their historical databases.

> [!tip] Related Terms
> [[#Look-Ahead Bias]], [[#Back-Testing]], [[#Point-in-Time Data]], [[#Historical Simulation]]

**Sources:**

---

### Sustainability Gateway (ISS Platform)

<span style="background:red; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="3,130 mentions across STOXX & ISS pages (high)">▰▰▰▰▰▰ 3,130</span>


> ISS's integrated online platform that provides clients with access to ESG ratings, climate analytics, norms-based screening, SDG alignment data, and other responsible-investment datasets through a unified web interface.

The Sustainability Gateway (sometimes referred to as ISS ESG Gateway) is the ESG-specific counterpart to DataDesk. It is purpose-built for responsible-investment workflows: portfolio-level ESG scoring, regulatory reporting (SFDR, EU Taxonomy), controversy screening, and engagement tracking. Data accessed through the Gateway feeds directly into compliance and reporting processes for asset managers and asset owners.

> [!tip] Related Terms
> [[#DataDesk (ISS Platform)]], [[#Estimation Model]], [[#Coverage Universe]]




> [!quote] Home | ISS
> e ProxyExchange Vote Preference ISS Communicator Vote Disclosure Services Global Meeting Results GOVERNANCE SOLUTIONS ISS Nordic Investor Services Engagement Letter Writing PRI Signatories Asset Owners ISS Australia Solutions Custodians & Intermediaries Hedge Funds Sustainability Solutions OVERVIEW **Sustainability Gateway** Sustainability Methodology Thought Leadership Biodiversity Impact Assessme...
> — [Home | ISS](https://www.issgovernance.com/) — "ISS Announces Creation of ISS STOXX"

> [!quote] Citi and ISS Launch High Frequency Connection for Proxymity Voting Platform |...
> orm at Citi. “This collaboration shows how Proxymity can effectively be used without any change to the systems and workflows that ISS clients already know, like and trust. This is a significant win for all users.” In addition to the data and workflow already available in ProxyExchange, users of the ISS platform can now benefit from enhanced visibility for supported company meetings by casting v...
> — [Citi and ISS Launch High Frequency Connection for Proxymity Voting Platform |...](https://www.issgovernance.com/citi-and-iss-launch-high-frequency-connection-for-proxymity-voting-platform) — "Citi and ISS Launch High Frequency Connection for Proxymity Voting Platform"

> [!quote] Sustainability Gateway | ISS
> Information provided via the **Sustainability Gateway** is updated monthly with any change to an entity’s ratings or scores reflected on the 1st of each month. Our Sustainability solutions enable investors to develop and integrate responsible investing policies and practices, engage on responsible investment issues, and monitor por
> — [Sustainability Gateway | ISS](https://www.issgovernance.com/sustainability/sustainability-gateway) — "SUSTAINABILITY GATEWAY"

> [!quote] Institutional Shareholder Services Opens Platform to Select Research &amp; Da...
> PARs), which offer an alternative, independent point of view to proxy advisor pay for performance research and recommendations.” “PIRC has been a champion for good corporate governance for over 25 years,” said Alan MacDougall, Managing Director of PIRC Ltd. “By distributing our research through the ISS platform, we hope that more investors may consider our analysis of companies, to inform their...
> — [Institutional Shareholder Services Opens Platform to Select Research &amp; Da...](https://www.issgovernance.com/institutional-shareholder-services-to-open-its-platform-to-select-research-and-data-providers) — "Institutional Shareholder Services Opens Platform to Select Research & Data Providers"

> [!quote] Site Map | ISS
> erse Impact Solution - SFDR Principal Adverse Impact Solution - Research & Analyze Company Performance - RI Policy Development - Screen for Company Performance - Screening & Controversies - Screening, Research & Analytics - Solutions for Academic Professionals - Support Engagement & Communication - **Sustainability Gateway** - Thank You - Thought Leadership - Terms of Use - Terry Shen - Tesco Compe...
> — [Site Map | ISS](https://www.issgovernance.com/site-map) — "Site Map"

**Sources:**
- [Home | ISS](https://www.issgovernance.com/) — "ISS Announces Creation of ISS STOXX"
- [Citi and ISS Launch High Frequency Connection for Proxymity Voting Platform | ISS](https://www.issgovernance.com/citi-and-iss-launch-high-frequency-connection-for-proxymity-voting-platform) — "Citi and ISS Launch High Frequency Connection for Proxymity Voting Platform"
- [Sustainability Gateway | ISS](https://www.issgovernance.com/sustainability/sustainability-gateway) — "SUSTAINABILITY GATEWAY"
- [Institutional Shareholder Services Opens Platform to Select Research &amp; Data Providers | ISS](https://www.issgovernance.com/institutional-shareholder-services-to-open-its-platform-to-select-research-and-data-providers) — "Institutional Shareholder Services Opens Platform to Select Research & Data Providers"
- [Site Map | ISS](https://www.issgovernance.com/site-map) — "Site Map"

---

## T

### Time Series Data

> A sequence of data points recorded at successive, equally spaced intervals over time for a single entity or variable, such as daily closing index levels or monthly ESG scores.

Time series data is the backbone of performance measurement and trend analysis. The daily closing values of the EURO STOXX 50 from 1998 to today form a time series. STOXX provides time series data for all its indices going back to each index's base date (or earlier, for back-tested periods). Analysts use time series to compute volatility, drawdowns, correlations, and other risk metrics.

> [!tip] Related Terms
> [[#Cross-Sectional Data]], [[#Panel Data]], [[#End-of-Day Data]]

**Sources:**

---

## U

### Universe Construction

> The systematic process by which an index administrator defines the broadest eligible set of securities for an index, applying geographic, listing, liquidity, and regulatory filters to a starting population.

Universe construction is the very first step in building any index. STOXX starts with all securities in a given region's regulated exchanges, then applies minimum free-float market-cap thresholds, liquidity screens, and listing-venue requirements. The result is the coverage universe from which specific indices draw their constituents. Changes to universe construction rules are among the most impactful methodology decisions and are subject to formal consultation.

> [!tip] Related Terms
> [[#Coverage Universe]], [[#Selection List]], [[#Rulebook]], [[#Benchmark Administration]]

**Sources:**

---

## V

### Vendor Reconciliation

> The process of comparing data received from two or more independent vendors — or from a vendor against an internal source — to identify and resolve discrepancies in values, identifiers, timestamps, or coverage.

Vendor reconciliation is a daily operational discipline for index providers and asset managers. STOXX reconciles market data received from exchanges and data vendors to ensure that prices, shares outstanding, and corporate-action flags are consistent before they enter the index calculation engine. ISS reconciles company-reported ESG data against third-party sources to flag inconsistencies for analyst review. When discrepancies arise, the reconciliation process determines which source is authoritative and documents the resolution — a key audit-trail requirement under the EU Benchmarks Regulation.

> [!tip] Related Terms
> [[#Quality Assurance (Data)]], [[#Data Vendor]], [[#Data Pipeline]], [[#Restatement]]

**Sources:**

---

> [!info] Navigation
> Return to the main [[ISS-STOXX]] index or explore related glossaries in the
> [[18-Financial-Domain]] section.
