---
title: "Data Methodology"
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

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="11 mentions across STOXX & ISS pages (low)">▰▰ 11</span>


> A set of protocols, routines, and tools that allows software applications to communicate with a data provider's systems programmatically, enabling automated retrieval of index data, ESG scores, or governance analytics without manual intervention.

An API is the machine-to-machine doorway into a data provider's catalogue. STOXX offers APIs that let licensees pull real-time index levels, historical compositions, and corporate-action data directly into their portfolio management and risk systems. ISS provides API access to governance scores, proxy research, and ESG ratings through its DataDesk and Sustainability Gateway platforms. For institutional users, API integration replaces manual file downloads and enables straight-through processing.

> [!tip] Related Terms
> [[#Data Feed]], [[#DataDesk (ISS Platform)]], [[#Snowflake Delivery]], [[#Data Pipeline]]

> [!example]- Source excerpts (5)
>
> 00 European equity and exchange-traded funds €2 trillion worth of assets The Climetrics Product
> Family Integrate climate change into fund selection and monitoring processes and develop new
> low-carbon products. - Rating License and Portfolio Report - Portfolio Report - Application
> Program Interface (**API**) - Advisory Services - Index and Investment...
>
> — [Climetrics | ISS](https://www.issgovernance.com/sustainability/climetrics)
>
> . - SFDR Principal Adverse Impact (PAI) Support: Export engagement data aligned with
> sustainability themes. - Branded, Audit-Ready Outputs: Reduce manual effort and error risk. -
> Flexible Data Sources: Use ISS Governance data, internal data, or third-party data. - Easy
> Integration: Upload via SFTP, **API** or through ProxyExchange. - Transparent rep...
>
> — [Flexible Stewardship Solutions | ISS](https://www.issgovernance.com/flexible-stewardship-solutions)
>
> now warranted. Intent and Impact The policy update would broaden the scope of the information that
> is being considered in making independence classifications of directors to include publicly
> available information provided by the nominating shareholders and other publicly available
> information (e.g. **API** providing in-depth factual information on i...
>
> — [Proposed Benchmark Policy Changes 2021 (PDF)](https://www.issgovernance.com/file/policy/proposed-benchmark-policy-changes-2021.pdf)
>
> nmental Panel on Climate Change (IPCC) scenarios (SSP2–4.5 and SSP5–8.5). Structural damage and
> business interruption are assessed at the real asset level by integrating hazard probability,
> exposure, and vulnerability data. Our global-coverage analytics tools, delivered via a web-based
> interface or **API**, support user-provided Real Asset portfolio...
>
> — [Climate and Nature Ongoing Innovation | ISS](https://www.issgovernance.com/climate-and-nature/ongoing-innovation)
>
> alyze Risk ISS enables investors to search, screen, and filter data in ways that suit their needs.
> Online Platforms Use ISS’ online tools for insight into a company’s corporate governance
> structures, quick drill-downs into particular areas of concern, and deep dives into underlying
> governance data. **API** to Profiles Your internal platform to the Q...
>
> — [Research, Screen &amp; Analyze Risk | ISS](https://www.issgovernance.com/solutions/qualityscore-research-screen-analyze-risk)
>

---

## B

### Back-Testing

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="52 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 52</span>


> The process of applying an index methodology retroactively to historical market data in order to simulate how the index would have performed prior to its official launch date.

Back-testing lets index providers and investors see what returns a newly designed index *would have* generated had it existed in the past. STOXX publishes back-tested performance alongside live track records in its factsheets, always with a disclaimer that back-tested results do not represent actual trading and may overstate performance because the rules were crafted with knowledge of historical outcomes.

> [!tip] Related Terms
> [[#Historical Simulation]], [[#Look-Ahead Bias]], [[#Survivorship Bias]], [[#Point-in-Time Data]]

> [!example]- Source excerpts (5)
>
> Margin, EVA Spread, EVA Momentum vs. Sales, and EVA Momentum vs. Capital. The FPA may modify an
> Overall Quantitative Concern level from a Low to Medium (or vice-versa), or from a Medium to High
> (or vice versa), depending on the results of the three primary measures and the company's FPA
> result. ISS **back-testing** indicates that less than 10% of co...
>
> — [Us Executive Compensation Policies Faq (PDF)](https://www.issgovernance.com/file/policy/latest/americas/US-Executive-Compensation-Policies-FAQ.pdf)
>
> o reflect recent history. The final Pay-TSR Alignment measure is simply equal to the difference:
> performance slope minus the pay slope. Potential values for PTA are theoretically unbounded, but
> in practice they range from just over -100% to just over 100%, with a slightly negative median
> value (see **Back-testing**, below, for more details). Back-te...
>
> — [Evaluatingpayforperformance Final Updated 02172012 (PDF)](http://www.issgovernance.com/files/EvaluatingPayForPerformance_final_updated_02172012.pdf)
>
> EUROPE EVALUATING PAY FOR PERFORMANCE ALIGNMENT Appendix: **Back-Testing** the Model The
> distribution of scores has been tested for the three models, RDA, MOM, and PTA, by band and was
> broadly in line with that seen for the North American models, although due to the smaller sample
> size in the European model, the slope of the distribution was less sm...
>
> — [European Pay For Performance Methodology Overview (PDF)](https://www.issgovernance.com/file/policy/2020/emea/European-Pay-for-Performance-Methodology-Overview.pdf)
>
> SS conducted regression analysis to identify factors with measurable correlation to superior or
> lagging long-term shareholder return performance; certain factors, including burn rate and
> repricing authority, showed significant association with performance over time. Finally, ISS
> conducted extensive **back-testing** of prototype scorecards for variou...
>
> — [2015Faqusequityplanscorecard 042015 (PDF)](https://www.issgovernance.com/file/policy/2015faqusequityplanscorecard-042015.pdf)
>
> y’s measure is an outlier beyond that range, however, this indicates that a disconnect may exist.
> The evaluative approach thus begins by identifying companies that are significant outliers in each
> measure. The approach is based on empirical observation of the distribution of the measures within
> the **back-testing** universe, and on the relative stre...
>
> — [Pay For Performance Mechanics Dec 2016 (PDF)](https://www.issgovernance.com/file/policy/pay-for-performance-mechanics-dec-2016.pdf)
>

---

### Benchmark Administration

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="30 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 30</span>


> The totality of activities involved in the governance, determination, calculation, and dissemination of a financial benchmark, including oversight, methodology design, data collection, and stakeholder management.

Benchmark administration is the regulatory umbrella under which index providers like STOXX operate. Under the EU Benchmarks Regulation (BMR), a benchmark administrator must maintain transparent methodologies, conflict-of-interest policies, and a complaints-handling procedure. STOXX is registered as an EU BMR-authorised administrator.

> [!tip] Related Terms
> [[#Index Administrator]], [[#Rulebook]], [[#Quality Assurance (Data)]]

> [!example]- Source excerpts (5)
>
> 550 companies around the world for benchmarking purposes and as underlyings for ETFs, futures and
> options, structured products and passively managed investment funds. STOXX Ltd. is the
> administrator of the STOXX and DAX indices under the European Benchmark Regulation and exercises
> control over all **benchmark administration** processes within ISS ST...
>
> — [History &amp; Milestones | STOXX](https://stoxx.com/company/stoxx-history-milestones)
>
> 550 companies around the world for benchmarking purposes and as underlyings for ETFs, futures and
> options, structured products and passively managed investment funds. STOXX Ltd. is the
> administrator of the STOXX and DAX indices under the European Benchmark Regulation and exercises
> control over all **benchmark administration** processes within Qontig...
>
> — [Philips Pensioenfonds adopts STOXX Index to align its emerging markets equity...](https://stoxx.com/philips-pensioenfonds-adopts-stoxx-index-to-align-its-emerging-markets-equity-portfolio-with-several-un-sdgs)
>
> no assurance that investment products based on any STOXX index will accurately track the
> performance of the index itself or return positive performance. About STOXX STOXX Ltd. is the
> administrator of the STOXX® and DAX® indices under the European Benchmark Regulation and exercises
> control over all **benchmark administration** processes within Qontig...
>
> — [Monthly Index News December 2022 (PDF)](https://stoxx.com/monthly-index-news-december-2022)
>
> d and blue-chip indices for the regions Americas, Europe, Asia/Pacific and sub-regions Latin
> America and BRIC (Brazil, Russia, India and China) as well as global markets. STOXX is the
> administrator of the STOXX® and DAX® indices under the European Benchmark Regulation and exercises
> control over all **benchmark administration** processes within Qonti...
>
> — [Monthly Index News April 2021 (PDF)](https://stoxx.com/monthly-index-news-april-2021)
>
> and blue-chip indices for the Americas, Europe and Asia/Pacific regions and the Latin America and
> BRIC (Brazil, Russia, India and China) subregions, plus global markets. STOXX is the administrator
> of the STOXX® and DAX® indices under the European Benchmark Regulation and exercises control over
> all **benchmark administration** processes within Qontig...
>
> — [Monthly Index News November 2022 (PDF)](https://stoxx.com/monthly-index-news-november-2022)
>

---

### Benchmark Statement

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="360 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 360</span>


> A public document required under the EU Benchmarks Regulation (BMR) that discloses the key elements of an index's methodology, its limitations, the circumstances under which its administrator would exercise discretion, and how it measures the underlying market or economic reality.

A benchmark statement is a regulatory compliance document, not a marketing factsheet. STOXX publishes benchmark statements for each index family, covering the market the benchmark intends to measure, the methodology's key elements, the potential limitations of the data inputs, and the conditions under which discretion or expert judgement may be applied. Investors and product issuers are required to reference the benchmark statement in their own prospectuses when using a regulated benchmark.

> [!tip] Related Terms
> [[#Benchmark Administration]], [[#Rulebook]], [[#Index Administrator]], [[#Methodology Consultation]]

> [!example]- Source excerpts (5)
>
> **BENCHMARK STATEMENT** Regulation Clause Regulation Required Information STOXX LTD Statement
> Subclause 1.6 Rationale; Art. 27(2)(b) A **benchmark statement** shall contain at Rationale for
> adopting the benchmark review and approval BMR; Art. 1(5) least, the rationale for adopting the
> methodology: The STOXX
>
> — [Stoxx Factor Index Family Benchmark Statement (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Resources/Regulation/STOXX_Factor_Index_Family_Benchmark_Statement.pdf)
>
> DAX **BENCHMARK STATEMENT** Regulation Clause Regulation Required Information STOXX LTD Statement
> Subclause able to withstand, or at least address the issue of, any changes to or cessation of a
> family member. 1.6 Rationale; review Art. 27(2)(b) A **benchmark statement** shall contain at
> Rationale for adopting the benchmark and approval BMR; Art. 1(5) le...
>
> — [Dax Volatility Index Family Benchmark Statement (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Resources/Regulation/DAX_Volatility_Index_Family_Benchmark_Statement.pdf)
>
> DAX **BENCHMARK STATEMENT** Regulation Clause Regulation Required Information STOXX LTD Statement
> Subclause 1. General Disclosure Requirements 1.1 Date of Art. 1(1)(a) The **benchmark statement**
> shall state: the Publication Commission date of publication of the statement and, Date of
> Publication Delegated where applicable, the date of its last 16 Augus...
>
> — [Dax Esg Equity Family Benchmark Statement (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Resources/Regulation/DAX_ESG_Equity_Family_Benchmark_Statement.pdf)
>
> uded in DAX sector indices based on their sector affiliation. There are three types of DAX sector
> indices: the DAXsupersector, DAXsector and DAXsubsector. These comprise all companies assigned to
> the supersector, sector or subsector concerned, based on the DAX Industry Classification. Index
> Guides, **Benchmark statement**, and other reports are avai...
>
> — [DAXsupersector Basic Materials - STOXX](https://stoxx.com/index/4n7a)
>
> nds denominated in euros. The Deutsche Börse EUROGOV® Germany Money Market Index is composed of
> government bonds with a residual maturity of between two months and one year. The maximum
> weighting of a bond is limited to 25 percent. The index composition is reviewed on a monthly
> basis. Index Guides, **Benchmark statement**, and other reports are avai...
>
> — [Deutsche B&ouml;rse EUROGOV Germany Money Market - STOXX](https://stoxx.com/index/3le2)
>

---

## C

### Coverage Universe

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="136 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 136</span>


> The total set of securities, entities, or data points that a data provider or index methodology considers eligible for inclusion before any screening, filtering, or weighting rules are applied.

Think of the coverage universe as the broadest possible "long list." For STOXX, the coverage universe for a regional index might be all listed equities on regulated exchanges in that region. For ISS, the coverage universe for ESG ratings might be all companies in the MSCI ACWI or a similar broad benchmark. The actual index or rating output is always a subset of this universe after selection criteria are applied.

> [!tip] Related Terms
> [[#Universe Construction]], [[#Selection List]], [[#Cross-Sectional Data]]

> [!example]- Source excerpts (5)
>
> th local market indices, including constituents of the U.S. Russell 3000, Canadian S&P/TSX
> Composite, STOXX600, NZX15, ASX 200, JPX-Nikkei 400, and the main European local market indices
> including the UK FTSE All-Share (ex-investment trusts.) QualityScore also includes widely held
> companies in ISS’ **coverage universe** for Brazil, China, Hong Kong,...
>
> — [QualityScore | Global Coverage | ISS](https://www.issgovernance.com/solutions/qualityscore-global-coverage)
>
> X 20 A company can be excluded from the P4P model for poor or limited disclosure. However, the pay
> disclosures are reassessed annually, and if greater information is subsequently provided, the
> company may appear in the P4P model as both a subject and a peer company in future years. How
> often is the **coverage universe** updated and when? The coverag...
>
> — [European Pay For Performance Methodology Faq (PDF)](https://www.issgovernance.com/file/policy/2020/emea/European-Pay-for-Performance-Methodology-FAQ.pdf)
>
> ed free online portal to verify their company’s data and submit material changes related to their
> corporate governance practices. The site also provides monthly updated risk levels. (GRId is ISS’
> metric for assessing corporate governance risk. Issuers do not pay ISS or ICS to be evaluated. The
> GRId **coverage universe** is determined by ISS in its d...
>
> — [Dd Compliance Package 01 2014 (PDF)](https://www.issgovernance.com/file/2013/03/DD_Compliance_Package_01-2014.pdf)
>
> ........... 12 COVERAGE
> ..........................................................................................................................................
> 12 27. What is the **coverage universe** for the European P4P model?
> ............................................... 12 28. How often is the **coverage universe**
> updated and when? ..............
>
> — [European Pay For Performance Methodology Faq (PDF)](https://www.issgovernance.com/file/policy/2019/emea/European-Pay-for-Performance-Methodology-FAQ.pdf)
>
> Continental Europe Proxy Voting Guidelines **COVERAGE UNIVERSE** The following is a condensed
> version of the proxy voting recommendations contained in ISS’ European Proxy Voting Manual. ISS'
> European Policy applies to Member States of the European Union (EU) or the European Free Trade
> Association (EFTA), with the exception of the United Kingdom
>
> — [Europe Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2019/emea/Europe-Voting-Guidelines.pdf)
>

---

### Cross-Sectional Data

> A dataset that captures observations across multiple entities (e.g., companies, securities) at a single point in time, as opposed to tracking a single entity across multiple time periods.

Cross-sectional data is what you get when you take a "snapshot" of every company's market capitalisation, ESG score, or governance rating on a given date. Index reviews and rebalancing decisions are fundamentally cross-sectional exercises — comparing all eligible securities against one another at the review cut-off date.

> [!tip] Related Terms
> [[#Panel Data]], [[#Time Series Data]], [[#Point-in-Time Data]]
---

## D

### Data Feed

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="11 mentions across STOXX & ISS pages (low)">▰▰ 11</span>


> A continuous or scheduled electronic delivery of structured data — such as index levels, component weights, corporate actions, or ESG scores — from a provider to a consumer, typically via API, FTP, or a real-time streaming protocol.

Data feeds are the pipes through which institutional investors receive index and governance data. STOXX delivers index values via real-time feeds (every 15 seconds for some indices) and end-of-day files. ISS distributes governance and ESG data through platform downloads, APIs, and bulk file deliveries. The format, frequency, and latency of a data feed are critical operational considerations for asset managers and custodians.

> [!tip] Related Terms
> [[#End-of-Day Data]], [[#Data Vendor Code]], [[#Snowflake Delivery]]

> [!example]- Source excerpts (5)
>
> 1 + DP t Computational Accuracy Figures of the published Dividend Points indices are rounded to
> two decimal places. All relevant parameters for the calculation of the DAX indices are described
> in the “DAX Equity Calculation Guide”. Dissemination Days and Time The index value is disseminated
> via the **data feed** at least twice a day considering the ...
>
> — [Dax Strategy Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)
>
> DAX EQUITY INDEX CALCULATION GUIDE 9/37 44.. IINNPPUUTT DDAATTAA 4.1. SOURCES The input data
> sources for the index calculation include: Real-time and end-of-day stock prices and currency
> exchange rates provided by Refinitiv. 4.2. MONITORING The real-time input **data feed**s for the
> index calculation are monitored continuously to ensure data quality...
>
> — [Dax Equity Calculation Guide 20231002 (PDF)](https://www.stoxx.com/document/News/2023/October/DAX%20Equity%20Calculation%20Guide_20231002.pdf)
>
> particular areas of concern, and deep dives into underlying governance data. API to Profiles Your
> internal platform to the QualityScore API to directly access QualityScore Profiles and drill into
> the key risks, to easily bring governance insight into investment decisions and proxy voting
> processes. **Data Feed**s Easily ingest the files through your...
>
> — [Research, Screen &amp; Analyze Risk | ISS](https://www.issgovernance.com/solutions/qualityscore-research-screen-analyze-risk)
>
> orkplace health and safety, and many more. 450 Key Datapoints on topics such as: Business Ethics
> Labor, Health, and Safety Stakeholders and Society Workplace Diversity and Inclusion *Data as of
> March 2023. All figures are approximate. Our ESGRaw Data Solutions are available through DataDesk,
> or via **data feed**s for integration into client workflow...
>
> — [Environmental &amp; Social Raw Data | ISS](https://www.issgovernance.com/sustainability/environmental-social-raw-data)
>
> etrieve Index DAXK DAXESGK reports) Corresponding ISIN during the DE0008467440 DE000A0S3E04
> SIMULATION Phase Corresponding Short Name during the DAX (Price) EUR DAX 50 ESG (Price) EUR
> SIMULATION Phase For further description of the real time feed via Deutsche Boerse Market Data +
> Services CEF (CEF® **data feed**s), please do not hesitate to contact ...
>
> — [Dax Equity Indices Simulation Phase–From Dec 18 2023 To February 29 2024 (PDF)](https://www.stoxx.com/document/News/2023/October/DAX_Equity_Indices_Simulation_Phase–from_Dec_18_2023_to_February_29_2024.pdf)
>

---

### Data Imputation

> The process of replacing missing or unavailable data values with substituted estimates derived from statistical models, peer-group averages, or other systematic techniques, so that downstream calculations can proceed on a complete dataset.

Data imputation is what happens when a company simply does not report a data point that an index or rating methodology requires — for example, Scope 3 carbon emissions or board-diversity percentages. ISS and STOXX ESG methodologies document which fields may be imputed, the imputation technique used (e.g., sector-median fill, regression-based prediction), and how imputed values are flagged so that end users can distinguish reported from estimated figures. Imputation is closely related to but distinct from estimation modelling: imputation fills discrete gaps, while estimation models may construct entire derived metrics.

> [!tip] Related Terms
> [[#Estimation Model]], [[#Disclosure Rate]], [[#Coverage Universe]], [[#Quality Assurance (Data)]]
---

### Data Normalization

> The process of transforming raw data values onto a common scale or into a standard format so that metrics from different sources, reporting frameworks, currencies, or units of measurement can be meaningfully compared.

Raw ESG and financial data arrives in wildly inconsistent forms — carbon emissions in metric tonnes vs. short tons, revenue in local currencies, governance scores on different rating scales. Data normalisation converts these heterogeneous inputs into comparable units. STOXX normalises financial data to a common currency and adjusts for free float; ISS normalises ESG indicators to z-scores or percentile ranks within industry peer groups so that a mining company's environmental performance can be compared against other miners, not against software firms.

> [!tip] Related Terms
> [[#Data Imputation]], [[#Cross-Sectional Data]], [[#Estimation Model]], [[#Quality Assurance (Data)]]
---

### Data Pipeline

> The end-to-end sequence of automated steps — ingestion, validation, transformation, enrichment, and loading — through which raw data flows from its original source to its final destination in a production database, index calculation engine, or client-facing platform.

A data pipeline is the plumbing behind every index level and ESG score. For STOXX, the pipeline begins with exchange feeds and corporate-action notices, passes through validation and corporate-action-adjustment engines, and ends with the publication of official index values. For ISS, the pipeline ingests company filings, third-party databases, and analyst inputs, routes them through scoring models and QA checks, and delivers final ratings to DataDesk, the Sustainability Gateway, and Snowflake. Pipeline reliability is a core operational risk — a failure at any stage can delay or corrupt data delivery.

> [!tip] Related Terms
> [[#Data Feed]], [[#API (Application Programming Interface)]], [[#Quality Assurance (Data)]], [[#Snowflake Delivery]]
---

### Data Vendor

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="152 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 152</span>


> A third-party firm that collects, aggregates, standardises, and redistributes financial, governance, or ESG data to institutional clients, often serving as an intermediary between primary data sources (exchanges, companies, regulators) and end users.

Data vendors are the middlemen of the financial information ecosystem. STOXX itself acts as a data vendor when it licenses index data to Bloomberg, Refinitiv, and SIX for redistribution. Conversely, STOXX consumes data from vendors when sourcing market-cap figures, free-float estimates, or corporate-action feeds as inputs to its index calculations. ISS is both a data vendor (selling governance and ESG data) and a data consumer (purchasing financial and ownership data from other vendors). Understanding the vendor chain is important because data quality issues can originate at any link.

> [!tip] Related Terms
> [[#Data Vendor Code]], [[#Data Feed]], [[#Vendor Reconciliation]], [[#Data Pipeline]]

> [!example]- Source excerpts (5)
>
> STOXX INDEX METHODOLOGY GUIDE 93/639 9. STOXX BLUE-CHIP INDICES For a complete list please consult
> the **data vendor** code sheet on the website21. Index types and currencies: Price, net return and
> gross return in EUR, USD and other versions. For a complete list please consult the **data
> vendor** code sheet on the website22. 9.1.2. INDEX REVIEW Componen...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> viously Financial and Risk business of Thomson Reuters. The WM/Refinitiv currency fixing rates
> from 17:00 CET are used to calculate the index’s closing values. DAXplus Covered Call index is
> available in the currencies set forth in the Vendor Code Sheet which is available under
> https://www.stoxx.com/data-vendor-codes. On Xetra trading days DAXplu...
>
> — [Dax Strategy Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)
>
> r_codes.html Calculation/distribution realtime 15 sec Calculation hours 15:30:00 22:15:00 Base
> value/base date 100 as of Mar. 19, 2012 History Mar. 19, 2012 Inception date May. 29, 2019 To
> learn more about the inception date, the currency, the calculation hours and historical values,
> please see our **data vendor** code sheet. 3 STOXX data from Mar. ...
>
> — [Su5Zesgx (PDF)](https://www.stoxx.com/document/Indices/Factsheets/2019/August/SU5ZESGX.pdf)
>
> . Universe: The index universe is the STOXX Europe Total Market Index. Secondary lines are
> excluded from the universe. Weighting scheme: The indices are weighted according to their
> free-float Market Capitalization Base values and dates: 100 on March 16th, 2007 For a complete
> list please consult the **data vendor** code sheet on the website49. Custom...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> models. Various other financial and operational metrics are also considered when company practices
> and remuneration decisions are analysed as part of the qualitative review undertaken for ISS proxy
> research reports. The TSR data used in the European pay-for-performance model is provided by the
> same **data vendor** (S&P/Compustat XpressFeed) using th...
>
> — [European Pay For Performance Methodology Overview (PDF)](http://www.issgovernance.com/file/policy/european-pay-for-performance-methodology-overview.pdf)
>

---

### Data Vendor Code

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="136 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 136</span>


> A short alphanumeric identifier assigned by a data vendor (e.g., Bloomberg, Refinitiv, SIX) to uniquely reference a specific index, security, or data series within that vendor's platform.

Every STOXX index has a set of vendor codes — for example, a Bloomberg ticker, a Reuters RIC, and a STOXX internal symbol. These codes let portfolio managers, risk systems, and trading desks unambiguously refer to the same index across different technology platforms. Factsheets typically list all major vendor codes for each index.

> [!tip] Related Terms
> [[#RIC (Reuters Instrument Code)]], [[#ISIN (International Securities Identification Number)]], [[#Factsheet]]

> [!example]- Source excerpts (5)
>
> STOXX INDEX METHODOLOGY GUIDE 93/639 9. STOXX BLUE-CHIP INDICES For a complete list please consult
> the **data vendor code** sheet on the website21. Index types and currencies: Price, net return and
> gross return in EUR, USD and other versions. For a complete list please consult the **data vendor
> code** sheet on the website22. 9.1.2. INDEX REVIEW Componen...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> viously Financial and Risk business of Thomson Reuters. The WM/Refinitiv currency fixing rates
> from 17:00 CET are used to calculate the index’s closing values. DAXplus Covered Call index is
> available in the currencies set forth in the Vendor Code Sheet which is available under
> https://www.stoxx.com/data-vendor-codes. On Xetra trading days DAXplu...
>
> — [Dax Strategy Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)
>
> r_codes.html Calculation/distribution realtime 15 sec Calculation hours 15:30:00 22:15:00 Base
> value/base date 100 as of Mar. 19, 2012 History Mar. 19, 2012 Inception date May. 29, 2019 To
> learn more about the inception date, the currency, the calculation hours and historical values,
> please see our **data vendor code** sheet. 3 STOXX data from Mar. ...
>
> — [Su5Zesgx (PDF)](https://www.stoxx.com/document/Indices/Factsheets/2019/August/SU5ZESGX.pdf)
>
> . Universe: The index universe is the STOXX Europe Total Market Index. Secondary lines are
> excluded from the universe. Weighting scheme: The indices are weighted according to their
> free-float Market Capitalization Base values and dates: 100 on March 16th, 2007 For a complete
> list please consult the **data vendor code** sheet on the website49. Custom...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> dex Data displayed in each iSFTP folder. - Determination of the iSFTP path STOXX/<Main Index
> Symbol> for each DAX index, with the update of the DAX Vendor Code Sheet (see vendor_code_dax.csv
> column AC - field iSFTP Folder) available in the web section Index Data & Resources / Index Data /
> General / **Data Vendor Code**s. STOXX Customer Support: Tel....
>
> — [Technical Migration New Index Data Distribution System And New File Formats F... (PDF)](https://www.stoxx.com/document/News/2023/March/Technical_Migration-New_Index_Data_Distribution_System_and_New_File_Formats_for_DAX_Indices_20230327_3457284624.pdf)
>

---

### DataDesk (ISS Platform)

<span style="background:teal; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="36 mentions across STOXX & ISS pages (medium-low)">▰▰▰ 36</span>


> ISS Governance's online data portal that provides institutional subscribers with access to governance analytics, proxy voting research, compensation data, and ESG scores through a web-based interface.

DataDesk is the primary self-service front end for ISS clients. Users can search companies, pull governance risk scores (QualityScores), review board profiles, view proxy research reports, and export datasets. It complements ISS's bulk data feeds and API access by offering an interactive, searchable environment suited for ad hoc research and due diligence.

> [!tip] Related Terms
> [[#Sustainability Gateway (ISS Platform)]], [[#Data Feed]], [[#Quality Assurance (Data)]]

> [!example]- Source excerpts (5)
>
> ROCKVILLE, Md. (October 24, 2018) — Institutional Shareholder Services Inc. (ISS), the leading
> provider of end-to-end governance and responsible investment solutions to the global financial
> community, today announced the launch of a new, custom ratings solution via **DataDesk**, ISS’
> industry leading screening, data, and analytics platform. The Data...
>
> — [ISS Announces Release of DataDesk Custom Ratings Solution | ISS](https://www.issgovernance.com/iss-announces-release-of-datadesk-custom-ratings-solution)
>
> 2019 ISS Americas Policy Updates according to **DataDesk** data, only three companies in the S&P
> 500 had no female directors. Boards with female representation far outnumber all-male boards in
> the Russell 3000 Index too where, according to Data Desk data, 84 percent of the companies have at
> least one female on the board. Female representation at th
>
> — [Americas Policy Updates (PDF)](https://www.issgovernance.com/file/policy/2019/updates/Americas-Policy-Updates.pdf)
>
> Brief In this continuing series of analyses drawing on the capabilities of ISS Analytics, Powered
> by **DataDesk**, we examine companies in the U.S. S&P 1,500 index to gauge whether and how
> industry classification affects certain governance structures and practices. This paper provides
> inter-sectoral comparisons of average director ages and board ten...
>
> — [Industry Impacts on Director Attributes: The Expected and the Unexpected | ISS](https://www.issgovernance.com/library/industry-impacts-on-director-attributes)
>
> Our climate change experts provide financial market participants, governments and universities
> with carbon and climate data, analytics, and advisory services. The Portfolio Analytics tool on
> our proprietary **DataDesk** platform enables investors to assess the climate impact of their
> portfolios, with the click of a button. For public equity and fixe...
>
> — [Carbon &amp; Climate Data and Advisory | ISS](https://www.issgovernance.com/sustainability/climate-solutions/carbon-climate-data-and-advisory)
>
> PARs), which offer an alternative, independent point of view to proxy advisor pay for performance
> research and recommendations.” “PIRC has been a champion for good corporate governance for over 25
> years,” said Alan MacDougall, Managing Director of PIRC Ltd. “By distributing our research through
> the ISS platform, we hope that more investors may c...
>
> — [Institutional Shareholder Services Opens Platform to Select Research &amp; Da...](https://www.issgovernance.com/institutional-shareholder-services-to-open-its-platform-to-select-research-and-data-providers)
>

---

### Disclosure Rate

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1 mentions across STOXX & ISS pages (ultra-low)">▰ 1</span>


> The percentage of companies within a given universe or index that voluntarily or mandatorily report a specific data point — such as carbon emissions, board-diversity statistics, or executive compensation details — as opposed to having that data estimated or imputed by the provider.

Disclosure rate is a key quality-of-data metric. A high disclosure rate means the data is grounded in company-reported figures; a low rate means the provider is relying heavily on estimation models. ISS publishes disclosure rates for its ESG indicators so that clients can assess how much of a portfolio's ESG profile rests on actual company data versus modelled values. STOXX ESG index methodologies may set minimum disclosure thresholds — for example, requiring that a company report Scope 1 and 2 emissions directly to be eligible for a climate index.

> [!tip] Related Terms
> [[#Data Imputation]], [[#Estimation Model]], [[#Coverage Universe]], [[#Quality Assurance (Data)]]

> [!example]- Source excerpts (1)
>
> mittee of the China Association of Environmental Protection Industry. Many challenges exist with
> data pertaining to the ESG performance of Chinese corporations. China has distinct corporate
> governance requirements through its state-led governance model. Additionally, language barriers
> and different **disclosure rate**s and standards make it all the ...
>
> — [The time is ripe for investors in China to embrace a green financial system  ...](https://stoxx.com/the-time-is-ripe-for-investors-in-china-to-embrace-a-green-financial-system)
>

---

## E

### End-of-Day Data

> Index values, component lists, weights, and related analytics calculated and published after the close of trading on a given business day, representing the final official figures for that session.

End-of-day (EOD) data is the definitive record of an index for each trading day. STOXX publishes EOD files that include closing index levels, component weights, divisor values, and corporate action adjustments. Most passive fund NAV calculations, compliance checks, and performance attribution processes rely on EOD data rather than intraday snapshots.

> [!tip] Related Terms
> [[#Data Feed]], [[#Time Series Data]], [[#Back-Testing]]
---

### Estimation Model

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1 mentions across STOXX & ISS pages (ultra-low)">▰ 1</span>


> A quantitative framework used by a data provider to infer, approximate, or impute a data point (such as carbon emissions or ESG metrics) when a company has not directly reported the figure.

Not all companies disclose every data point that ESG and climate indices require. ISS and other providers fill these gaps with estimation models — statistical or machine-learning approaches that predict unreported values based on industry peers, company size, geographic location, and available partial disclosures. Methodologies typically document which fields are reported vs. estimated and the confidence level of each estimate.

> [!tip] Related Terms
> [[#Coverage Universe]], [[#Quality Assurance (Data)]], [[#Look-Ahead Bias]]

> [!example]- Source excerpts (1)
>
> ounts of information in real time without human bias,” Patricia said. “We use AI to process
> hundreds of thousands of documents per day. We can also use machine learning to learn complex
> patterns. We can clean the data and assess the reliability of data. With advanced machine
> learning, we can create **estimation model**s for all our coverage gaps. So...
>
> — [Qontigo’s Mehrotra: Innovation cutting across entire ESG data spectrum — from...](https://stoxx.com/qontigos-mehrotra-innovation-cutting-across-entire-esg-data-spectrum-from-sources-to-uses)
>

---

## F

### Factsheet

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="8 mentions across STOXX & ISS pages (low)">▰▰ 8</span>


> A standardised summary document — typically two to four pages — published by an index provider that presents an index's key characteristics, performance, top constituents, sector breakdown, and methodology highlights.

Factsheets are the "business card" of an index. STOXX publishes monthly factsheets for each index family, covering risk/return statistics, turnover, vendor codes, and a performance chart with both live and back-tested periods clearly marked. They are the most common starting point for any investor evaluating an index.

> [!tip] Related Terms
> [[#Data Vendor Code]], [[#Rulebook]], [[#Back-Testing]]

> [!example]- Source excerpts (5)
>
> Guide to Industry Classifications used by STOXX Ltd. contains general information pertaining to
> industry classifications used in DAX indices » The Guide to Reference Calculations used by STOXX
> Ltd. provides a detailed view of definitions and formulas of the calculations as utilized in the
> reports, **factsheet**s, indices and presentations produced b...
>
> — [Dax Strategy Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/DAX_Strategy_Index_Guide.pdf)
>
> rice declined more than 3%, and following the company’s December’s 2016 disclosure, the stock
> price further declined by more than 6%. This case’s court location is USDC-California (Northern)
> and is being led by co-lead counsel firms Pomerantz and Glancy Pronger & Murray. Click here to
> view the case **factsheet**. comScore – $110 Million Settlement T...
>
> — [RecoverMax Monitor: March 2018 | ISS](https://www.issgovernance.com/recovermax-monitor-march-2018)
>
> he forecast from the website and subscribe to corporate actions alerts to receive notification for
> the latest changes. 5.5 Monthly Reports The monthly reports are published each month and include
> the following data for selected indices: • Index performance • Index fundamentals • Index
> correlation • **Factsheet**s for various indices with information...
>
> — [Detailed Overview Of Equity Index Calculation Changes (PDF)](https://www.stoxx.com/document/News/2023/October/Detailed%20Overview%20of%20Equity%20Index%20Calculation%20changes.pdf)
>
> he STOXX USA 500 Index are in dollars. 2 Preliminary data, Eurostat, Aug. 14, 2020. 3 See Dalibor
> Rohac, ‘Why Europe’s Chances of a Strong Economic Recovery Are Slimmer than the U.S.’, National
> Review, Jul. 22, 2020. 4 Projected price-to-estimated-earnings excluding negative readings.
> Source: STOXX **factsheet**s. 5 MarketWatch, ‘’Companies remain c...
>
> — [US Benchmark Reaches Record High as European Stocks Struggle in Pandemic Reco...](https://stoxx.com/us-benchmark-reaches-record-high-as-european-stocks-struggle-in-pandemic-recovery)
>
> suitability assessment. This has led to a tide of new and re-labeled ‘green’ funds that are
> compliant with SFDR rules. Qontigo’s Market Intelligence Team analyzes ETFs’ data, their
> prospectus and benchmarks to classify them as either having an Environmental, Social, Governance
> or General ESG remit. **Factsheet** information can complement the analys...
>
> — [Qontigo data shows extent of climate strategies’ dominance in ESG passive ETF...](https://stoxx.com/qontigo-data-shows-extent-of-climate-strategies-dominance-in-esg-passive-etfs-space)
>

---

## H

### Historical Simulation

> The process of reconstructing the performance of an index or strategy over a past time period using archived market data and a defined set of rules, applied as if the rules had been in effect throughout that period.

Historical simulation is closely related to back-testing but carries a slightly broader connotation — it may involve scenario analysis, stress testing, or "what-if" variations of methodology parameters, not just a single retrospective track record. STOXX simulation files allow clients to replicate historical index compositions and verify calculations independently.

> [!tip] Related Terms
> [[#Back-Testing]], [[#Simulation File]], [[#Look-Ahead Bias]], [[#Survivorship Bias]]
---

## I

### Index Administrator

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="7 mentions across STOXX & ISS pages (low)">▰▰ 7</span>


> The legal entity responsible for the governance, calculation, and publication of a financial benchmark or index, bearing regulatory accountability under frameworks such as the EU Benchmarks Regulation (BMR).

STOXX Ltd. is the index administrator for all STOXX and DAX indices. As an administrator, STOXX must maintain a control framework, methodology governance committee, conflicts-of-interest policy, and complaint-handling process. Clients licensing an index for an ETF or structured product must verify that the administrator is authorised under the applicable regulatory regime.

> [!tip] Related Terms
> [[#Benchmark Administration]], [[#Rulebook]], [[#Review Report]]

> [!example]- Source excerpts (5)
>
> STOXX Ltd. on Jul. 31 was recognized as **index administrator** under the European Union’s
> Benchmarks Regulation (BMR), a rules framework devised to ensure the accuracy and integrity of
> indices in the region. The Benchmarks Regulation covers all entities that administer indices used
> in the 28-nation EU as benchmarks in financial instruments a
>
> — [STOXX Named Administrator Under EU Benchmarks Regulation STOXX Named Administ...](https://stoxx.com/stoxx-named-administrator-under-eu-benchmarks-regulation-stoxx-named-administrator-under-eu-benchmarks-regulation)
>
> STOXX indices. ISS and STOXX joined forces in 2023 to form a unified platform offering
> high-quality data, analytics and indices, underpinned by a leading governance franchise. - A more
> frequent review better captures the evolution of data and regulation. Separately, the EU in May
> 2025 mandated that **index administrator**s shall include as of Januar...
>
> — [CTB, PAB climate benchmarks evolve with investment landscape | Blog posts | S...](https://stoxx.com/ctb-pab-climate-benchmarks-evolve-with-investment-landscape)
>
> ely 98% of all indices available globally. STOXX Ltd. is a member of the IIA. Rick, what does the
> IIA do? The IIA is a non-profit organization that was set up to do two things: provide education
> on indices and do advocacy work where needed across the globe. All of our members have to be
> independent **index administrator**s, meaning that they can nei...
>
> — [Q&amp;A: Index Industry Association’s Rick Redding | Blog posts | STOXX](https://stoxx.com/qa-index-industry-associations-rick-redding-qa-index-industry-associations-rick-redding)
>
> index data reporting and index review of the EUROGOV® Bond Indices to ICE Data Indices LLC in
> accordance with Art. 10 of Regulation 2016/1011 (“Benchmark Regulation or “BMR”), referred to as
> ‘outsource service provider’ in the rest of this Guide to the EUROGOV® Bond Indices. STOXX Ltd.
> remains the **index administrator** of the EUROGOV® Bond Indices...
>
> — [Guide To Eurogov Bond Indices (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/Guide_to_EUROGOV_Bond_Indices.pdf)
>
> e. “This pioneering family of indices fill an important gap in the current index landscape and
> supports the investment-case for companies with robust governance and diversity practices” said
> Hernando Cortina, Head of Index Strategy at ISS ESG. Index methodologies are available on the
> website of the **Index Administrator**, Solactive AG, an authorize...
>
> — [ISS ESG Unveils Proprietary Indices for Diversity and Governance | ISS](https://www.issgovernance.com/iss-esg-unveils-proprietary-indices-for-diversity-and-governance)
>

---

### ISIN (International Securities Identification Number)

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="113 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 113</span>


> A twelve-character alphanumeric code (defined by ISO 6166) that uniquely identifies a specific security — such as an equity share, bond, or fund — across global markets.

ISINs are the universal passport number for financial instruments. Every constituent in a STOXX index is identified by its ISIN, ensuring there is no ambiguity when a company is dual-listed or when local ticker symbols conflict. ISS also keys its governance and ESG data to ISINs to enable precise matching with portfolio holdings.

> [!tip] Related Terms
> [[#RIC (Reuters Instrument Code)]], [[#Data Vendor Code]], [[#Selection List]]

> [!example]- Source excerpts (5)
>
> . Index Dissemination: Indices are calculated realtime from 09:00:00 – 17:50:00 CET. Official
> close price is the price as of 17:00:00 CET. Index Dissemination Calendar: STOXX Global Calendar.
> Index Composition: Indices contain only a single asset, weighted 100%. Indices are listed below:
> Index Name **ISIN** Symbol Currency STOXX Bitcoin Index CH1362...
>
> — [Stoxx Digital Asset Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_digital_asset_guide.pdf)
>
> File name: cost_to_borrow_forecast  File type: .txt  File specification: semicolon separated 
> File frequency: Monthly (published on Tuesday before the third Friday of the month) Column Data
> Attribute Description Data Format ID Type 1 VALID_FROM Effective date of the new values Date
> YYYY-MM-DD 2 **ISIN** Index **ISIN** Text 12 3 Name Index name Text 2...
>
> — [Index Files Guide 20230619 (PDF)](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)
>
> d refers to the length of transition from the 1st nearby futures contract into the 2nd contract.
> The futures roll is completed on the date preceding the last trading day of each futures contract
> series. Dissemination Calendar: STOXX Eurex Calendar 19.2. BASIC DATA Index Futures Rolling Period
> Index **ISIN** symbol symbol (days) EURO STOXX 50 Futures...
>
> — [Stoxx Strategy Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_strategy_guide.pdf)
>
> XX will use event. discretion, as detailed in Section 1.3, to ensure that the exceptional market
> event is dealt with in a way that best reflects the economic or market reality that the affected
> benchmarks aim to measure. 1.12 ISINs Art. 1(1)(b) RTS The benchmark statement shall state, STOXX
> assigns **ISIN** codes to all Benchmarks, these where avail...
>
> — [Stoxx Equity Index Family Benchmark Statement (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Resources/Regulation/STOXX_Equity_Index_Family_Benchmark_Statement.pdf)
>
> Qontigo’s index business and a global provider of innovative and tradable index concepts, today
> announced the new composition of DAX 50 ESG index as part of the regular review. The following
> table list contains all component changes effective at the start of trading on March 20th, 2023.
> Date Index **ISIN** Company Name Changes Rules Applied 06.03.20...
>
> — [Index Update Composition Changes In Dax 50 Esg Index Eng 20230306 3415342829 (PDF)](https://www.stoxx.com/document/News/2023/March/Index_Update_Composition_Changes_in_DAX_50_ESG_Index_ENG_20230306_3415342829.pdf)
>

---

## L

### Look-Ahead Bias

> A methodological error that occurs when a back-test or simulation incorporates information that would not have been available to market participants at the historical point in time being modelled.

Look-ahead bias is one of the most dangerous pitfalls in index design and quantitative research. For example, if a back-test uses annual carbon-emissions data published in April to make a "January" portfolio decision, it is using future information. STOXX and ISS mitigate this by documenting data availability lags and enforcing point-in-time data usage in their methodologies.

> [!tip] Related Terms
> [[#Point-in-Time Data]], [[#Back-Testing]], [[#Survivorship Bias]], [[#Historical Simulation]]
---

## M

### Methodology Consultation

> A formal, time-bound process in which an index administrator publicly solicits feedback from stakeholders — licensees, market participants, regulators, and advisory committees — before implementing material changes to an index methodology.

Under the EU Benchmarks Regulation, STOXX is required to consult on any proposed methodology change that would materially affect the benchmark's representativeness or the value of financial products referencing it. Consultation papers describe the proposed change, provide impact analysis, and invite written responses during a defined comment period (typically 30 to 60 days). STOXX publishes a summary of feedback received and a final decision notice. ISS follows a similar consultation model for its benchmark voting policies, issuing draft policy updates each autumn for client comment before the next proxy season.

> [!tip] Related Terms
> [[#Benchmark Administration]], [[#Benchmark Statement]], [[#Rulebook]], [[#Oversight Function]]
---

## O

### Oversight Function

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="7 mentions across STOXX & ISS pages (low)">▰▰ 7</span>


> An internal or independent committee established by a benchmark administrator to monitor and review all aspects of benchmark provision, including methodology integrity, data quality, conflict-of-interest management, and complaint handling, as required by the EU Benchmarks Regulation.

The oversight function is the governance watchdog inside an index provider. For STOXX, this takes the form of an Oversight Committee with a defined charter, meeting cadence, and escalation authority. The committee reviews methodology changes, monitors for errors or manipulation, evaluates the adequacy of data inputs, and ensures that the administrator's code of conduct is followed. It operates independently from the commercial and index-operations teams to avoid conflicts of interest. ISS maintains analogous governance structures for its benchmark-related products.

> [!tip] Related Terms
> [[#Benchmark Administration]], [[#Index Administrator]], [[#Methodology Consultation]], [[#Quality Assurance (Data)]]

> [!example]- Source excerpts (5)
>
> te effective from 21 February 2013). On 1 September 2013, the powers of the Federal Financial
> Markets Service (FFMS), Russia's securities commission, in the field of regulation, control and
> supervision in the financial markets were transferred to the Bank of Russia. The regulatory,
> supervisory, and **oversight function**s of the Bank of Russia in th...
>
> — [2016 Russia Kazakhstan Voting Guidelines Dec 2015 (PDF)](https://www.issgovernance.com/file/policy/2016-russia-kazakhstan-voting-guidelines-dec-2015.pdf)
>
> te effective from 21 February 2013). On 1 September 2013, the powers of the Federal Financial
> Markets Service (FFMS), Russia's securities commission, in the field of regulation, control and
> supervision in the financial markets were transferred to the Bank of Russia. The regulatory,
> supervisory, and **oversight function**s of the Bank of Russia in th...
>
> — [2017 Russia Kazakhstan Proxy Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2017-russia-kazakhstan-proxy-voting-guidelines.pdf)
>
> te effective from 21 February 2013). On 1 September 2013, the powers of the Federal Financial
> Markets Service (FFMS), Russia's securities commission, in the field of regulation, control and
> supervision in the financial markets were transferred to the Bank of Russia. The regulatory,
> supervisory, and **oversight function**s of the Bank of Russia in th...
>
> — [2015Russiaandkazakhstanvotingguidelines (PDF)](https://www.issgovernance.com/file/policy/2015russiaandkazakhstanvotingguidelines.pdf)
>
> te effective from 21 February 2013). On 1 September 2013, the powers of the Federal Financial
> Markets Service (FFMS), Russia's securities commission, in the field of regulation, control and
> supervision in the financial markets were transferred to the Bank of Russia. The regulatory,
> supervisory, and **oversight function**s of the Bank of Russia in th...
>
> — [Russia And Kazakhstan Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2020/emea/Russia-and-Kazakhstan-Voting-Guidelines.pdf)
>
> te effective from 21 February 2013). On 1 September 2013, the powers of the Federal Financial
> Markets Service (FFMS), Russia's securities commission, in the field of regulation, control and
> supervision in the financial markets were transferred to the Bank of Russia. The regulatory,
> supervisory, and **oversight function**s of the Bank of Russia in th...
>
> — [Russia And Kazakhstan Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2019/emea/Russia-and-Kazakhstan-Voting-Guidelines.pdf)
>

---

## P

### Pro-Forma Data

> Hypothetical or adjusted data that shows what an index's composition, weights, or performance would look like if a proposed methodology change, corporate action, or rebalancing had already been applied, before the change takes effect.

Pro-forma data is the "preview" of an index change. When STOXX announces a quarterly rebalancing, it often publishes pro-forma constituent lists and weights several days before the effective date, giving passive fund managers time to prepare their trades. Similarly, when a methodology consultation proposes new screening criteria, STOXX may provide pro-forma back-tests showing how the index would have behaved under the proposed rules. ISS uses pro-forma analyses when evaluating the impact of governance policy changes on voting recommendations.

> [!tip] Related Terms
> [[#Review Report]], [[#Selection List]], [[#Back-Testing]], [[#Methodology Consultation]]
---

### Panel Data

> A dataset that combines cross-sectional and time-series dimensions, tracking multiple entities across multiple time periods so that each observation is identified by both an entity and a date.

Panel data is the gold standard for empirical research in finance. If you have ESG scores for 3,000 companies observed quarterly over ten years, that is a panel. ISS's historical ESG and governance databases are structured as panels, enabling clients to study how governance quality evolves over time and across peer groups.

> [!tip] Related Terms
> [[#Cross-Sectional Data]], [[#Time Series Data]], [[#Point-in-Time Data]]
---

### Point-in-Time Data

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="3 mentions across STOXX & ISS pages (ultra-low)">▰ 3</span>


> Data that is stored and delivered exactly as it was known on a specific historical date, preserving the original values before any subsequent revisions, restatements, or corrections.

Point-in-time (PIT) databases are essential for unbiased back-testing. If a company restates its 2023 emissions in 2025, a PIT database retains both the original 2023 figure (as known in 2023) and the restated figure (as known in 2025). Using PIT data ensures that simulations reflect only the information that was actually available to decision-makers at each historical moment.

> [!tip] Related Terms
> [[#Look-Ahead Bias]], [[#Back-Testing]], [[#Panel Data]], [[#Survivorship Bias]]

> [!example]- Source excerpts (3)
>
> SUSTAINABILITY SOLUTIONS Solutions for Academic Professionals A robust and timely set of
> environmental, social, and governance datasets to help enrich your academic research. Access
> in-depth **point-in-time data** on global corporate directors, executive compensation, corporate
> governance, company vote results, climate and emissions data, and variou...
>
> — [Solutions for Academic Professionals](https://www.issgovernance.com/sustainability/solutions-for-academic-professionals)
>
> from 1/best to 10/worst) that is now shown in the ESG Corporate and Country Ratings gives
> investors and rated companies a relative perspective to the rating score. It is an addition to the
> absolute rating score that ranges from D- (worst) to A+ (best). - The addition of ISS Governance
> QualityScore **point-in-time data** on Open:FactSet Marketplace. ...
>
> — [ISS ESG to Present Latest Responsible Investment Solutions at PRI in Person |...](https://www.issgovernance.com/iss-esg-to-present-latest-responsible-investment-solutions-at-pri-in-person)
>
> es Inc., today announced the addition of new data sets on the Open:FactSet Marketplace to aid
> investors seeking to integrate extra-financial considerations into their investment
> decision-making. Effective today, authorized users of the Open:FactSet Marketplace can access ISS
> Governance QualityScore **point-in-time data** that covers 7,800 global com...
>
> — [ISS ESG to Provide Robust Data Sets Through the Open:FactSet Marketplace | ISS](https://www.issgovernance.com/iss-esg-to-provide-robust-data-sets-through-the-openfactset-marketplace)
>

---

## Q

### Quality Assurance (Data)

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="3 mentions across STOXX & ISS pages (ultra-low)">▰ 3</span>


> The systematic processes, checks, and controls that a data provider applies to ensure accuracy, completeness, timeliness, and consistency of its datasets before publication or delivery to clients.

Quality assurance (QA) in the index and ESG data world encompasses automated validation rules (e.g., a market-cap value cannot be negative), manual review by analysts, reconciliation against independent sources, and exception-handling workflows. STOXX's index operations team runs multi-layered QA on every corporate action, rebalancing, and daily calculation. ISS applies similar rigour to governance scores, flagging outliers for analyst review.

> [!tip] Related Terms
> [[#Benchmark Administration]], [[#Estimation Model]], [[#Review Report]]

> [!example]- Source excerpts (3)
>
> cy exchange rates provided by Refinitiv. 4.2. MONITORING The real-time input data feeds for the
> index calculation are monitored continuously to ensure data quality and availability. Data
> monitoring controls include data filters according to each exchange specification, outlier
> detection mechanisms, **quality assurance** tools and verification agains...
>
> — [Dax Equity Calculation Guide 20231002 (PDF)](https://www.stoxx.com/document/News/2023/October/DAX%20Equity%20Calculation%20Guide_20231002.pdf)
>
> orm’s partners and their research teams. Looking at revenues gives investors an objective,
> consistent and transparent dataset that has been audited and is universally available, he added.
> The data, which has grown to include negative contribution to the SDGs and SDGs-aligned patents,
> goes through a **quality assurance** process with the input of exp...
>
> — [Asset-owner panel discusses drivers, merits of integrating SDGs into investme...](https://stoxx.com/asset-owner-panel-discusses-drivers-merits-of-integrating-sdgs-into-investment-portfolios)
>
> eligibility criteria for assets and projects that can be used for Climate Bonds and Green Bonds,
> said Dr. Maximilian Horster, Head of ISS-climate. “We are proud of the reconfirmation of our
> Approved Verifier status and look forward to the continued contribution of our knowledge and
> expertise to the **quality assurance** of these bonds.“ ISS ESG offe...
>
> — [ISS Reconfirmed as Climate Bonds Standard &amp; Certification Scheme Verifier...](https://www.issgovernance.com/iss-reconfirmed-climate-bonds-standard-certification-scheme-verifier)
>

---

## R

### Restatement

<span style="background:orange; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="297 mentions across STOXX & ISS pages (medium-high)">▰▰▰▰▰ 297</span>


> A revision to previously published data — such as financial figures, ESG metrics, or index values — issued by either the reporting company or the data provider to correct errors, reflect updated methodologies, or incorporate newly available information.

Restatements are the data world's errata. A company may restate its carbon emissions after discovering a measurement error; ISS may revise a governance score after receiving corrected board-composition data; STOXX may restate an index level if a corporate-action adjustment was applied incorrectly. Point-in-time databases preserve both the original and restated values so that historical analyses remain unbiased. High restatement frequency in a dataset can signal underlying data-quality issues and is tracked as part of quality assurance.

> [!tip] Related Terms
> [[#Point-in-Time Data]], [[#Quality Assurance (Data)]], [[#Look-Ahead Bias]], [[#Vendor Reconciliation]]

> [!example]- Source excerpts (5)
>
> those related to tax compliance and preparation fees, i.e. the preparation of original and amended
> tax returns, refund claims, and tax payment planning, vs. those related to all other services in
> the tax category, such as tax advice, planning, or consulting. 18. What is ISS’ definition of
> “material **restatement**s”? When determining if a company ha...
>
> — [Issusfaqspoliciesandprocedures04302014 (PDF)](https://www.issgovernance.com/file/2014_Policies/ISSUSFAQsPoliciesandProcedures04302014.pdf)
>
> Adequate disclosure of management nominees has not been provided in a › Adequate disclosure of
> management nominees has not been provided in a timely manner; timely manner; › There are clear
> concerns over questionable finances or **restatement**s; › There are clear concerns over
> questionable finances or **restatement**s; › There have been questionable tr...
>
> — [Americas Policy Updates (PDF)](https://www.issgovernance.com/file/policy/2019/updates/Americas-Policy-Updates.pdf)
>
> 2017 U.S. Sustainability Proxy Voting Guidelines an executive's fraud, misconduct, or negligence
> significantly contributed to a **restatement** of financial results that led to the awarding of
> unearned incentive compensation. However, such policies may be narrow given that not all
> misconduct or negligence may result in significant financial restatem...
>
> — [2017 Sustainability Us Voting Guidelines (PDF)](https://www.issgovernance.com/file/policy/2017-sustainability-us-voting-guidelines.pdf)
>
> he rationale behind this decision is that the total pay prior to the **restatement** was what the
> remuneration committee intended to award the executive, and therefore that this is the best
> measure of the remuneration committee’s decisions regarding pay amounts awarded. Subsequent events
> that lead to a **restatement** of grant date values or an executiv...
>
> — [Australian Pay For Performance Faq (PDF)](https://www.issgovernance.com/file/policy/2018/asiapacific/Australian-Pay-for-Performance-FAQ.pdf)
>
> B Global ex Japan Minimum Variance and iSTOXX MUTB Global Minimum Variance) » December 2017 (2):
> Addition of iSTOXX American Century USA Indices » January 2018: Amendment in the base values of
> the iSTOXX China H 20 Equal Weight HKD Index and iSTOXX Switzerland 10 Equal Weight CHF Index,
> following a **restatement** in their history. Clarification of ...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>

---

### Review Report

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="69 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 69</span>


> A document published by an index administrator or advisory committee following a periodic index review, summarising the changes to index composition (additions, deletions, and share adjustments) and the rationale behind them.

After each quarterly or annual review, STOXX publishes a review report (sometimes called an announcement) that lists which companies are entering or leaving the index and any changes to free-float factors or share counts. These reports are closely watched by passive fund managers, who must execute rebalancing trades to match the new composition. ISS similarly publishes review and update reports for its governance and ESG rating changes.

> [!tip] Related Terms
> [[#Selection List]], [[#Rulebook]], [[#Index Administrator]]

> [!example]- Source excerpts (5)
>
> STOXX INDEX METHODOLOGY GUIDE 43/639 5. INDEX CHARACTERISTICS During review implementation month,
> the published **review report** in combination with the selection list will be used to select a
> replacement. With the public announcement of the **review report** in the review implementation
> month, the highest ranked non-component from the selection list, ...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> ESG disclosure was always set to be high on the agenda for investors in 2023, and developments so
> far confirm regulators and agencies are on track to push through some key legislative packages. In
> a midyear **review report**, ISS ESG, a leading provider of ESG data, analytics and insights, and
> a partner with STOXX in indexing solutions, recounts wha...
>
> — [Sustainability reporting regulation: midyear progress review by ISS ESG  | Bl...](https://stoxx.com/sustainability-reporting-regulation-midyear-progress-review-by-iss-esg)
>
> Asia 100, STOXX Pacific 50, STOXX BRIC 100, STOXX Latin America 50, STOXX Sub Balkan 30 and STOXX
> China A 50 indices are also part of this regular quarterly review. Additions to and deletions from
> these indices were published after the closing of markets on Sep. 1 at
> https://www.stoxx.com/periodic-review-reports. Furthermore, the STOXX France 50...
>
> — [STOXX Changes Composition Of Blue-Chip Indices - Sep. 21, 2018 | Press releas...](https://stoxx.com/stoxx-changes-composition-of-blue-chip-indices)
>
> A Preliminary Review of the 2018 US Proxy Season JULY 20, 2018 The 2018 U.S. proxy season is now
> complete, with approximately 85 percent of Russell 3000 firms having held their annual shareholder
> meetings by June 30. As a preamble to ISS’s post-season **review report**s, we take a look at some
> of the key takeaways from the 2018 proxy season. Board e...
>
> — [A Preliminary Review of the 2018 US Proxy Season | ISS](https://www.issgovernance.com/library/a-preliminary-review-of-the-2018-us-proxy-season)
>
> n week but prior to Wednesday, the intra quarter capping rule shall not be applied. If this breach
> is not subsequently resolved by the upcoming review implementation, the weighting cap factors will
> be recalculated based on Tuesday’s closing prices, and revised weighting cap factors announced in
> the **Review Report**s published on Wednesday. Where a ...
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>

---

### RIC (Reuters Instrument Code)

<span style="background:blue; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="20 mentions across STOXX & ISS pages (low)">▰▰ 20</span>


> A proprietary ticker-like identifier assigned by Refinitiv (formerly Reuters) to uniquely reference a financial instrument — such as an equity, index, or derivative — within the Refinitiv Eikon and Elektron platforms.

RICs are one of several vendor-specific codes that STOXX publishes for each index. A RIC such as `.STOXX50E` allows Refinitiv terminal users and API consumers to pull real-time and historical data for the EURO STOXX 50. Because RICs are proprietary, they are not interchangeable with Bloomberg tickers or ISINs, making cross-reference tables essential for multi-vendor environments.

> [!tip] Related Terms
> [[#Data Vendor Code]], [[#ISIN (International Securities Identification Number)]], [[#Data Feed]]

> [!example]- Source excerpts (5)
>
> . The value of the index on base date will be t 1,000. C equals 200% and is the maximum leverage
> taken. βLVI is the beta of of the LVI portfolio calculated as per formula 9. T(t) is the
> rebalancing T(t) date immediately preceding t (included) EUR012M is the Euribor 12-month rate on
> trading day t-1, **RIC** code: EURIBOR= (1Y t−1 Maturity) EUSWE is t...
>
> — [Istoxx Index Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/istoxx_index_guide.pdf)
>
> ULATION The EURO STOXX® 50 JPY TTM currency conversion index is created according to the following
> formula: 𝑈𝐿 𝐹𝑋 𝐼𝑉 = 𝐼𝑉 ( 𝑡−1 ∙ 𝑡 ) 𝑡 𝑡0 𝑈𝐿 𝐹𝑋 𝑡0−1 𝑡0 Where: 𝐼𝑉 = Index value on day t. 𝑡 𝑈𝐿 =
> Underlying Index value on day t (EURO STOXX 50 Index). 𝑡 𝐹𝑋 = Spot currency rate on day t (JPY TTM
> Rate – **RIC** = EURTTM=BTMJ). 𝑡 𝐼𝑉𝑡 = Index base date (29...
>
> — [Stoxx Strategy Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_strategy_guide.pdf)
>
> ese indices? “The indices have been designed for asset allocation, performance assessment, product
> development and research. As underlyings for investment products and as portfolio benchmarks, they
> comply with the requirements under Europe’s UCITS regulation[3] and the Regulated Investment
> Company (**RIC**) framework in the US.[4] The STOXX World In...
>
> — [STOXX’s Axel Lomholt: STOXX World indices bring flexible portfolio building b...](https://stoxx.com/qontigos-axel-lomholt-stoxx-world-indices-bring-flexible-portfolio-building-blocks-to-growing-client-base)
>
> not satisfied, the index is first capped by tier group capping, followed by company level capping
> and concentration capping. The capping limits are detailed below. Concentration Weight Tier group
> Tier Group Weight Limit Company Weight Limit Limit Tier 1a Maximum 8% Not applicable Tier 1b
> Maximum 6% **RIC** (4.5/8/45) Maximum 20% Tier 2 Maximum 4% (a...
>
> — [Stoxx Index Guide (PDF)](https://www.stoxx.com/documents/stoxxnet/Documents/Indices/Common/Indexguide/stoxx_index_guide.pdf)
>
> ttribute Description Data Data ID Type Format 1 Creation_Date Date at which the file is generated
> Date DD.MM.YYYY 2 Index_Symbol Index Symbol Text 8 3 Index Name Index Name Text 255 4 Index ISIN
> Index ISIN Text 12 5 Internal_Key Constituent unique identifier Text 6 6 ISIN Constituent ISIN
> Text 12 7 **RIC** Constituent Reuters ticker Text 21 8 Instru...
>
> — [Index Files Guide 20230619 (PDF)](https://www.stoxx.com/document/News/2023/June/Index_Files_Guide_20230619.pdf)
>

---

### Rulebook

<span style="background:green; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="78 mentions across STOXX & ISS pages (medium)">▰▰▰▰ 78</span>


> The comprehensive, legally binding document published by an index administrator that specifies every aspect of an index's construction, maintenance, calculation, and governance — serving as the definitive methodology reference.

The rulebook is the single source of truth for an index. It details the universe, selection criteria, weighting scheme, rebalancing schedule, corporate-action treatment, and extraordinary-event procedures. STOXX publishes rulebooks for each index family, and any deviation from the rulebook must go through a formal governance and consultation process under BMR requirements.

> [!tip] Related Terms
> [[#Benchmark Administration]], [[#Index Administrator]], [[#Review Report]], [[#Factsheet]]

> [!example]- Source excerpts (5)
>
> SA 900. All stocks in the index universe are ranked by free-float market cap to produce the index
> selection list. The index aims to cover the 500 largest companies in terms of free-float market
> cap of the index universe. The detailed methodology including the calculation formula can be found
> in our **rulebook**: www.stoxx.com/indices/**rulebook**s.html ...
>
> — [Sx50Ugv (PDF)](https://www.stoxx.com/document/Indices/Factsheets/2022/December/SX50UGV.pdf)
>
> 1 August after market close. The affected indices will be calculated with the new composition as
> of 24 August 2020. Given the current situation, these rule changes would apply to Wirecard AG. The
> decision will be made on the basis of the ranking list of 31 July, as well as other requirements
> in the **rulebook**. The new rule pertaining to insolvent ...
>
> — [STOXX Decides Rule Change For DAX Selection Indices | Press releases | STOXX](https://stoxx.com/stoxx-decides-rule-change-for-dax-selection-indices)
>
> STOXX® DIGITAL ASSET METHODOLOGY GUIDE 6/31 3. INDEX CHARACTERISTICS GLOSSARY OF TERMS Below is an
> explanation of crypto specific terms that are used within the **rulebook**. Coin: The term for the
> native and standalone digital asset specified by its own Layer-1 blockchain. A coin is to be
> separated from a token which has additional programmed funct...
>
> — [Stoxx Digital Asset Guide (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_digital_asset_guide.pdf)
>
> DAX EQUITY INDEX METHODOLOGY GUIDE 16/120 5. STOCK CHARACTERISTICS statements on its website at
> https://www.stoxx.com/**rulebook**s. These statements must be published annually. » Minimum
> liquidity on the FSE: o Initial eligibility: To qualify for ranking, stocks that are not an index
> component at the review cutoff date must have a minimum order boo...
>
> — [Dax Equity Index Methodology Guide 5526498614 (PDF)](https://www.stoxx.com/document/News/2026/March/DAX%20Equity%20Index%20Methodology%20Guide_5526498614.pdf)
>
> GUIDE TO INDUSTRY CLASSIFICATIONS USED BY STOXX LTD. 3/43 1. INTRODUCTION TO THE INDEX GUIDES
> PUBLISHED BY STOXX STOXX maintains and publishes several guides related to the construction,
> calculation and dissemination of its indices. All guides are available for download on
> https://www.stoxx.com/**rulebook**s. 1.1. GENERAL INDEX GUIDES » The Guide to...
>
> — [Guide To Industry Classifications Used By Stoxx Ltd (PDF)](https://www.stoxx.com/document/Indices/Common/Indexguide/Guide_to_Industry_Classifications_used_by_STOXX_Ltd.pdf)
>

---

## S

### Selection List

<span style="background:red; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="1,025 mentions across STOXX & ISS pages (high)">▰▰▰▰▰▰ 1,025</span>


> The finalised roster of securities or entities that have passed all eligibility screens, liquidity filters, and ranking criteria during an index review and will be included in the index for the upcoming period.

The selection list is the output of the review process — the names that "made the cut." For STOXX indices, the selection list is determined by applying the rulebook's criteria to the coverage universe at the review cut-off date. The list is typically published several days before the effective date to give the market time to anticipate rebalancing flows.

> [!tip] Related Terms
> [[#Coverage Universe]], [[#Universe Construction]], [[#Review Report]]

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

### Simulation File


> A structured data file provided by an index administrator that contains the full historical composition, weights, and corporate actions of an index, enabling clients to independently replicate past index calculations.

Simulation files are the raw material for back-testing and audit. STOXX offers simulation files as part of its data services, allowing licensees — ETF providers, structured-product issuers, and quantitative researchers — to verify that their replication of the index matches STOXX's official values. These files are typically delivered in CSV or XML format and include daily constituent snapshots.

> [!tip] Related Terms
> [[#Back-Testing]], [[#Historical Simulation]], [[#End-of-Day Data]]
---

### Snowflake Delivery

> A data distribution method in which a provider makes datasets available through Snowflake's cloud data platform, enabling clients to access live, query-ready data directly within their own Snowflake environment without file transfers.

Snowflake delivery represents the modern evolution of data distribution. Instead of downloading CSV files or polling an FTP server, clients can access ISS and STOXX datasets as shared tables in Snowflake, running SQL queries against always-current data. This eliminates ETL overhead, reduces latency, and ensures that all consumers are working from the same version of the data.

> [!tip] Related Terms
> [[#Data Feed]], [[#DataDesk (ISS Platform)]], [[#End-of-Day Data]]
---

### Survivorship Bias

> A systematic distortion in historical analysis that arises when only currently existing entities (e.g., companies still listed) are included in a dataset, while entities that have been delisted, merged, or bankrupted are excluded.

Survivorship bias makes past performance look better than it actually was because the "losers" — companies that failed — disappear from the dataset. A back-test of a stock-selection strategy that only uses today's listed companies will overstate returns because it ignores companies that went bankrupt along the way. STOXX and ISS mitigate survivorship bias by maintaining records of delisted constituents in their historical databases.

> [!tip] Related Terms
> [[#Look-Ahead Bias]], [[#Back-Testing]], [[#Point-in-Time Data]], [[#Historical Simulation]]
---

### Sustainability Gateway (ISS Platform)

<span style="background:purple; color:white; padding:1px 8px; border-radius:10px; font-size:0.75em; font-weight:bold; letter-spacing:1px;" title="3 mentions across STOXX & ISS pages (ultra-low)">▰ 3</span>


> ISS's integrated online platform that provides clients with access to ESG ratings, climate analytics, norms-based screening, SDG alignment data, and other responsible-investment datasets through a unified web interface.

The Sustainability Gateway (sometimes referred to as ISS ESG Gateway) is the ESG-specific counterpart to DataDesk. It is purpose-built for responsible-investment workflows: portfolio-level ESG scoring, regulatory reporting (SFDR, EU Taxonomy), controversy screening, and engagement tracking. Data accessed through the Gateway feeds directly into compliance and reporting processes for asset managers and asset owners.

> [!tip] Related Terms
> [[#DataDesk (ISS Platform)]], [[#Estimation Model]], [[#Coverage Universe]]

> [!example]- Source excerpts (3)
>
> PARs), which offer an alternative, independent point of view to proxy advisor pay for performance
> research and recommendations.” “PIRC has been a champion for good corporate governance for over 25
> years,” said Alan MacDougall, Managing Director of PIRC Ltd. “By distributing our research through
> the ISS platform, we hope that more investors may c...
>
> — [Institutional Shareholder Services Opens Platform to Select Research &amp; Da...](https://www.issgovernance.com/institutional-shareholder-services-to-open-its-platform-to-select-research-and-data-providers)
>
> Information provided via the **Sustainability Gateway** is updated monthly with any change to an
> entity’s ratings or scores reflected on the 1st of each month. Our Sustainability solutions enable
> investors to develop and integrate responsible investing policies and practices, engage on
> responsible investment issues, and monitor por
>
> — [Sustainability Gateway | ISS](https://www.issgovernance.com/sustainability/sustainability-gateway)
>
> orm at Citi. “This collaboration shows how Proxymity can effectively be used without any change to
> the systems and workflows that ISS clients already know, like and trust. This is a significant win
> for all users.” In addition to the data and workflow already available in ProxyExchange, users of
> the ISS platform can now benefit from enhanced visi...
>
> — [Citi and ISS Launch High Frequency Connection for Proxymity Voting Platform |...](https://www.issgovernance.com/citi-and-iss-launch-high-frequency-connection-for-proxymity-voting-platform)
>

---

## T

### Time Series Data

> A sequence of data points recorded at successive, equally spaced intervals over time for a single entity or variable, such as daily closing index levels or monthly ESG scores.

Time series data is the backbone of performance measurement and trend analysis. The daily closing values of the EURO STOXX 50 from 1998 to today form a time series. STOXX provides time series data for all its indices going back to each index's base date (or earlier, for back-tested periods). Analysts use time series to compute volatility, drawdowns, correlations, and other risk metrics.

> [!tip] Related Terms
> [[#Cross-Sectional Data]], [[#Panel Data]], [[#End-of-Day Data]]
---

## U

### Universe Construction

> The systematic process by which an index administrator defines the broadest eligible set of securities for an index, applying geographic, listing, liquidity, and regulatory filters to a starting population.

Universe construction is the very first step in building any index. STOXX starts with all securities in a given region's regulated exchanges, then applies minimum free-float market-cap thresholds, liquidity screens, and listing-venue requirements. The result is the coverage universe from which specific indices draw their constituents. Changes to universe construction rules are among the most impactful methodology decisions and are subject to formal consultation.

> [!tip] Related Terms
> [[#Coverage Universe]], [[#Selection List]], [[#Rulebook]], [[#Benchmark Administration]]
---

## V

### Vendor Reconciliation

> The process of comparing data received from two or more independent vendors — or from a vendor against an internal source — to identify and resolve discrepancies in values, identifiers, timestamps, or coverage.

Vendor reconciliation is a daily operational discipline for index providers and asset managers. STOXX reconciles market data received from exchanges and data vendors to ensure that prices, shares outstanding, and corporate-action flags are consistent before they enter the index calculation engine. ISS reconciles company-reported ESG data against third-party sources to flag inconsistencies for analyst review. When discrepancies arise, the reconciliation process determines which source is authoritative and documents the resolution — a key audit-trail requirement under the EU Benchmarks Regulation.

> [!tip] Related Terms
> [[#Quality Assurance (Data)]], [[#Data Vendor]], [[#Data Pipeline]], [[#Restatement]]
---

> [!info] Navigation
> Return to the main [[ISS-STOXX]] index or explore related glossaries in the
> [[18-Financial-Domain]] section.
