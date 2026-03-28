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

> A set of protocols, routines, and tools that allows software applications to communicate with a data provider's systems programmatically, enabling automated retrieval of index data, ESG scores, or governance analytics without manual intervention.

An API is the machine-to-machine doorway into a data provider's catalogue. STOXX offers APIs that let licensees pull real-time index levels, historical compositions, and corporate-action data directly into their portfolio management and risk systems. ISS provides API access to governance scores, proxy research, and ESG ratings through its DataDesk and Sustainability Gateway platforms. For institutional users, API integration replaces manual file downloads and enables straight-through processing.

> [!tip] Related Terms
> [[#Data Feed]], [[#DataDesk (ISS Platform)]], [[#Snowflake Delivery]], [[#Data Pipeline]]

**Sources:**
- [ISS Data Delivery Solutions — API Access](https://www.issgovernance.com/solutions/iss-data-deliveries/)
- [STOXX Data & Index Data Services](https://www.stoxx.com/data-index-data)

---

## B

### Back-Testing

> The process of applying an index methodology retroactively to historical market data in order to simulate how the index would have performed prior to its official launch date.

Back-testing lets index providers and investors see what returns a newly designed index *would have* generated had it existed in the past. STOXX publishes back-tested performance alongside live track records in its factsheets, always with a disclaimer that back-tested results do not represent actual trading and may overstate performance because the rules were crafted with knowledge of historical outcomes.

> [!tip] Related Terms
> [[#Historical Simulation]], [[#Look-Ahead Bias]], [[#Survivorship Bias]], [[#Point-in-Time Data]]

**Sources:**
- [STOXX Index Methodology Guide](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [IOSCO Principles for Financial Benchmarks — Back-Testing](https://www.iosco.org/library/pubdocs/pdf/IOSCOPD415.pdf)

---

### Benchmark Administration

> The totality of activities involved in the governance, determination, calculation, and dissemination of a financial benchmark, including oversight, methodology design, data collection, and stakeholder management.

Benchmark administration is the regulatory umbrella under which index providers like STOXX operate. Under the EU Benchmarks Regulation (BMR), a benchmark administrator must maintain transparent methodologies, conflict-of-interest policies, and a complaints-handling procedure. STOXX is registered as an EU BMR-authorised administrator.

> [!tip] Related Terms
> [[#Index Administrator]], [[#Rulebook]], [[#Quality Assurance (Data)]]

**Sources:**
- [EU Benchmarks Regulation (BMR) — EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R1011)
- [STOXX Benchmark Statement](https://www.stoxx.com/benchmark-regulation)

---

### Benchmark Statement

> A public document required under the EU Benchmarks Regulation (BMR) that discloses the key elements of an index's methodology, its limitations, the circumstances under which its administrator would exercise discretion, and how it measures the underlying market or economic reality.

A benchmark statement is a regulatory compliance document, not a marketing factsheet. STOXX publishes benchmark statements for each index family, covering the market the benchmark intends to measure, the methodology's key elements, the potential limitations of the data inputs, and the conditions under which discretion or expert judgement may be applied. Investors and product issuers are required to reference the benchmark statement in their own prospectuses when using a regulated benchmark.

> [!tip] Related Terms
> [[#Benchmark Administration]], [[#Rulebook]], [[#Index Administrator]], [[#Methodology Consultation]]

**Sources:**
- [STOXX Benchmark Statements](https://www.stoxx.com/benchmark-regulation)
- [EU BMR Article 27 — Benchmark Statement Requirements](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R1011)

---

## C

### Coverage Universe

> The total set of securities, entities, or data points that a data provider or index methodology considers eligible for inclusion before any screening, filtering, or weighting rules are applied.

Think of the coverage universe as the broadest possible "long list." For STOXX, the coverage universe for a regional index might be all listed equities on regulated exchanges in that region. For ISS, the coverage universe for ESG ratings might be all companies in the MSCI ACWI or a similar broad benchmark. The actual index or rating output is always a subset of this universe after selection criteria are applied.

> [!tip] Related Terms
> [[#Universe Construction]], [[#Selection List]], [[#Cross-Sectional Data]]

**Sources:**
- [STOXX Index Methodology Guide — Universe Definitions](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [ISS ESG Corporate Rating Methodology](https://www.issgovernance.com/esg/ratings/corporate-rating/)

---

### Cross-Sectional Data

> A dataset that captures observations across multiple entities (e.g., companies, securities) at a single point in time, as opposed to tracking a single entity across multiple time periods.

Cross-sectional data is what you get when you take a "snapshot" of every company's market capitalisation, ESG score, or governance rating on a given date. Index reviews and rebalancing decisions are fundamentally cross-sectional exercises — comparing all eligible securities against one another at the review cut-off date.

> [!tip] Related Terms
> [[#Panel Data]], [[#Time Series Data]], [[#Point-in-Time Data]]

**Sources:**
- [STOXX Index Methodology Guide](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [ISS ESG Data Methodology Overview](https://www.issgovernance.com/esg/ratings/)

---

## D

### Data Feed

> A continuous or scheduled electronic delivery of structured data — such as index levels, component weights, corporate actions, or ESG scores — from a provider to a consumer, typically via API, FTP, or a real-time streaming protocol.

Data feeds are the pipes through which institutional investors receive index and governance data. STOXX delivers index values via real-time feeds (every 15 seconds for some indices) and end-of-day files. ISS distributes governance and ESG data through platform downloads, APIs, and bulk file deliveries. The format, frequency, and latency of a data feed are critical operational considerations for asset managers and custodians.

> [!tip] Related Terms
> [[#End-of-Day Data]], [[#Data Vendor Code]], [[#Snowflake Delivery]]

**Sources:**
- [STOXX Data & Dissemination](https://www.stoxx.com/data-index-data)
- [ISS Data Delivery Solutions](https://www.issgovernance.com/solutions/iss-data-deliveries/)

---

### Data Imputation

> The process of replacing missing or unavailable data values with substituted estimates derived from statistical models, peer-group averages, or other systematic techniques, so that downstream calculations can proceed on a complete dataset.

Data imputation is what happens when a company simply does not report a data point that an index or rating methodology requires — for example, Scope 3 carbon emissions or board-diversity percentages. ISS and STOXX ESG methodologies document which fields may be imputed, the imputation technique used (e.g., sector-median fill, regression-based prediction), and how imputed values are flagged so that end users can distinguish reported from estimated figures. Imputation is closely related to but distinct from estimation modelling: imputation fills discrete gaps, while estimation models may construct entire derived metrics.

> [!tip] Related Terms
> [[#Estimation Model]], [[#Disclosure Rate]], [[#Coverage Universe]], [[#Quality Assurance (Data)]]

**Sources:**
- [ISS ESG Methodology — Data Imputation Procedures](https://www.issgovernance.com/esg/ratings/corporate-rating/)
- [STOXX ESG Index Methodology — Handling Missing Data](https://www.stoxx.com/sustainable-indices)

---

### Data Normalization

> The process of transforming raw data values onto a common scale or into a standard format so that metrics from different sources, reporting frameworks, currencies, or units of measurement can be meaningfully compared.

Raw ESG and financial data arrives in wildly inconsistent forms — carbon emissions in metric tonnes vs. short tons, revenue in local currencies, governance scores on different rating scales. Data normalisation converts these heterogeneous inputs into comparable units. STOXX normalises financial data to a common currency and adjusts for free float; ISS normalises ESG indicators to z-scores or percentile ranks within industry peer groups so that a mining company's environmental performance can be compared against other miners, not against software firms.

> [!tip] Related Terms
> [[#Data Imputation]], [[#Cross-Sectional Data]], [[#Estimation Model]], [[#Quality Assurance (Data)]]

**Sources:**
- [ISS ESG Corporate Rating Methodology — Scoring and Normalisation](https://www.issgovernance.com/esg/ratings/corporate-rating/)
- [STOXX Index Methodology Guide — Data Treatment](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

### Data Pipeline

> The end-to-end sequence of automated steps — ingestion, validation, transformation, enrichment, and loading — through which raw data flows from its original source to its final destination in a production database, index calculation engine, or client-facing platform.

A data pipeline is the plumbing behind every index level and ESG score. For STOXX, the pipeline begins with exchange feeds and corporate-action notices, passes through validation and corporate-action-adjustment engines, and ends with the publication of official index values. For ISS, the pipeline ingests company filings, third-party databases, and analyst inputs, routes them through scoring models and QA checks, and delivers final ratings to DataDesk, the Sustainability Gateway, and Snowflake. Pipeline reliability is a core operational risk — a failure at any stage can delay or corrupt data delivery.

> [!tip] Related Terms
> [[#Data Feed]], [[#API (Application Programming Interface)]], [[#Quality Assurance (Data)]], [[#Snowflake Delivery]]

**Sources:**
- [STOXX Index Operations & Data Infrastructure](https://www.stoxx.com/data-index-data)
- [ISS Data Delivery Solutions](https://www.issgovernance.com/solutions/iss-data-deliveries/)

---

### Data Vendor

> A third-party firm that collects, aggregates, standardises, and redistributes financial, governance, or ESG data to institutional clients, often serving as an intermediary between primary data sources (exchanges, companies, regulators) and end users.

Data vendors are the middlemen of the financial information ecosystem. STOXX itself acts as a data vendor when it licenses index data to Bloomberg, Refinitiv, and SIX for redistribution. Conversely, STOXX consumes data from vendors when sourcing market-cap figures, free-float estimates, or corporate-action feeds as inputs to its index calculations. ISS is both a data vendor (selling governance and ESG data) and a data consumer (purchasing financial and ownership data from other vendors). Understanding the vendor chain is important because data quality issues can originate at any link.

> [!tip] Related Terms
> [[#Data Vendor Code]], [[#Data Feed]], [[#Vendor Reconciliation]], [[#Data Pipeline]]

**Sources:**
- [STOXX Data Partners & Distribution](https://www.stoxx.com/data-index-data)
- [ISS Data Intelligence Solutions](https://www.issgovernance.com/solutions/data-intelligence/)

---

### Data Vendor Code

> A short alphanumeric identifier assigned by a data vendor (e.g., Bloomberg, Refinitiv, SIX) to uniquely reference a specific index, security, or data series within that vendor's platform.

Every STOXX index has a set of vendor codes — for example, a Bloomberg ticker, a Reuters RIC, and a STOXX internal symbol. These codes let portfolio managers, risk systems, and trading desks unambiguously refer to the same index across different technology platforms. Factsheets typically list all major vendor codes for each index.

> [!tip] Related Terms
> [[#RIC (Reuters Instrument Code)]], [[#ISIN (International Securities Identification Number)]], [[#Factsheet]]

**Sources:**
- [STOXX Factsheets — Vendor Code Listings](https://www.stoxx.com/indices)
- [Bloomberg Terminal — Index Ticker Reference](https://www.bloomberg.com/professional/solution/bloomberg-terminal/)

---

### DataDesk (ISS Platform)

> ISS Governance's online data portal that provides institutional subscribers with access to governance analytics, proxy voting research, compensation data, and ESG scores through a web-based interface.

DataDesk is the primary self-service front end for ISS clients. Users can search companies, pull governance risk scores (QualityScores), review board profiles, view proxy research reports, and export datasets. It complements ISS's bulk data feeds and API access by offering an interactive, searchable environment suited for ad hoc research and due diligence.

> [!tip] Related Terms
> [[#Sustainability Gateway (ISS Platform)]], [[#Data Feed]], [[#Quality Assurance (Data)]]

**Sources:**
- [ISS DataDesk Platform Overview](https://www.issgovernance.com/solutions/data-intelligence/)
- [ISS Product Suite](https://www.issgovernance.com/solutions/)

---

### Disclosure Rate

> The percentage of companies within a given universe or index that voluntarily or mandatorily report a specific data point — such as carbon emissions, board-diversity statistics, or executive compensation details — as opposed to having that data estimated or imputed by the provider.

Disclosure rate is a key quality-of-data metric. A high disclosure rate means the data is grounded in company-reported figures; a low rate means the provider is relying heavily on estimation models. ISS publishes disclosure rates for its ESG indicators so that clients can assess how much of a portfolio's ESG profile rests on actual company data versus modelled values. STOXX ESG index methodologies may set minimum disclosure thresholds — for example, requiring that a company report Scope 1 and 2 emissions directly to be eligible for a climate index.

> [!tip] Related Terms
> [[#Data Imputation]], [[#Estimation Model]], [[#Coverage Universe]], [[#Quality Assurance (Data)]]

**Sources:**
- [ISS ESG Methodology — Disclosure and Coverage Metrics](https://www.issgovernance.com/esg/ratings/corporate-rating/)
- [STOXX ESG & Climate Index Methodology](https://www.stoxx.com/sustainable-indices)

---

## E

### End-of-Day Data

> Index values, component lists, weights, and related analytics calculated and published after the close of trading on a given business day, representing the final official figures for that session.

End-of-day (EOD) data is the definitive record of an index for each trading day. STOXX publishes EOD files that include closing index levels, component weights, divisor values, and corporate action adjustments. Most passive fund NAV calculations, compliance checks, and performance attribution processes rely on EOD data rather than intraday snapshots.

> [!tip] Related Terms
> [[#Data Feed]], [[#Time Series Data]], [[#Back-Testing]]

**Sources:**
- [STOXX End-of-Day Data Services](https://www.stoxx.com/data-index-data)
- [STOXX Index Methodology Guide](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

### Estimation Model

> A quantitative framework used by a data provider to infer, approximate, or impute a data point (such as carbon emissions or ESG metrics) when a company has not directly reported the figure.

Not all companies disclose every data point that ESG and climate indices require. ISS and other providers fill these gaps with estimation models — statistical or machine-learning approaches that predict unreported values based on industry peers, company size, geographic location, and available partial disclosures. Methodologies typically document which fields are reported vs. estimated and the confidence level of each estimate.

> [!tip] Related Terms
> [[#Coverage Universe]], [[#Quality Assurance (Data)]], [[#Look-Ahead Bias]]

**Sources:**
- [ISS ESG Methodology — Estimation and Imputation](https://www.issgovernance.com/esg/ratings/corporate-rating/)
- [STOXX ESG Index Methodology — Data Sources and Estimation](https://www.stoxx.com/sustainable-indices)

---

## F

### Factsheet

> A standardised summary document — typically two to four pages — published by an index provider that presents an index's key characteristics, performance, top constituents, sector breakdown, and methodology highlights.

Factsheets are the "business card" of an index. STOXX publishes monthly factsheets for each index family, covering risk/return statistics, turnover, vendor codes, and a performance chart with both live and back-tested periods clearly marked. They are the most common starting point for any investor evaluating an index.

> [!tip] Related Terms
> [[#Data Vendor Code]], [[#Rulebook]], [[#Back-Testing]]

**Sources:**
- [STOXX Index Factsheets Library](https://www.stoxx.com/indices)
- [STOXX Document Library](https://www.stoxx.com/document-library)

---

## H

### Historical Simulation

> The process of reconstructing the performance of an index or strategy over a past time period using archived market data and a defined set of rules, applied as if the rules had been in effect throughout that period.

Historical simulation is closely related to back-testing but carries a slightly broader connotation — it may involve scenario analysis, stress testing, or "what-if" variations of methodology parameters, not just a single retrospective track record. STOXX simulation files allow clients to replicate historical index compositions and verify calculations independently.

> [!tip] Related Terms
> [[#Back-Testing]], [[#Simulation File]], [[#Look-Ahead Bias]], [[#Survivorship Bias]]

**Sources:**
- [STOXX Simulation Services](https://www.stoxx.com/customized-indices)
- [STOXX Index Methodology Guide](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

## I

### Index Administrator

> The legal entity responsible for the governance, calculation, and publication of a financial benchmark or index, bearing regulatory accountability under frameworks such as the EU Benchmarks Regulation (BMR).

STOXX Ltd. is the index administrator for all STOXX and DAX indices. As an administrator, STOXX must maintain a control framework, methodology governance committee, conflicts-of-interest policy, and complaint-handling process. Clients licensing an index for an ETF or structured product must verify that the administrator is authorised under the applicable regulatory regime.

> [!tip] Related Terms
> [[#Benchmark Administration]], [[#Rulebook]], [[#Review Report]]

**Sources:**
- [STOXX Benchmark Regulation Compliance](https://www.stoxx.com/benchmark-regulation)
- [EU BMR Register of Administrators — ESMA](https://www.esma.europa.eu/databases-library/registers-and-data)

---

### ISIN (International Securities Identification Number)

> A twelve-character alphanumeric code (defined by ISO 6166) that uniquely identifies a specific security — such as an equity share, bond, or fund — across global markets.

ISINs are the universal passport number for financial instruments. Every constituent in a STOXX index is identified by its ISIN, ensuring there is no ambiguity when a company is dual-listed or when local ticker symbols conflict. ISS also keys its governance and ESG data to ISINs to enable precise matching with portfolio holdings.

> [!tip] Related Terms
> [[#RIC (Reuters Instrument Code)]], [[#Data Vendor Code]], [[#Selection List]]

**Sources:**
- [ISO 6166 — ISIN Standard](https://www.iso.org/standard/78502.html)
- [ANNA — Association of National Numbering Agencies](https://www.anna-web.org/)

---

## L

### Look-Ahead Bias

> A methodological error that occurs when a back-test or simulation incorporates information that would not have been available to market participants at the historical point in time being modelled.

Look-ahead bias is one of the most dangerous pitfalls in index design and quantitative research. For example, if a back-test uses annual carbon-emissions data published in April to make a "January" portfolio decision, it is using future information. STOXX and ISS mitigate this by documenting data availability lags and enforcing point-in-time data usage in their methodologies.

> [!tip] Related Terms
> [[#Point-in-Time Data]], [[#Back-Testing]], [[#Survivorship Bias]], [[#Historical Simulation]]

**Sources:**
- [STOXX Index Methodology Guide — Back-Testing Disclaimer](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [CFA Institute — Biases in Back-Testing](https://www.cfainstitute.org/)

---

## M

### Methodology Consultation

> A formal, time-bound process in which an index administrator publicly solicits feedback from stakeholders — licensees, market participants, regulators, and advisory committees — before implementing material changes to an index methodology.

Under the EU Benchmarks Regulation, STOXX is required to consult on any proposed methodology change that would materially affect the benchmark's representativeness or the value of financial products referencing it. Consultation papers describe the proposed change, provide impact analysis, and invite written responses during a defined comment period (typically 30 to 60 days). STOXX publishes a summary of feedback received and a final decision notice. ISS follows a similar consultation model for its benchmark voting policies, issuing draft policy updates each autumn for client comment before the next proxy season.

> [!tip] Related Terms
> [[#Benchmark Administration]], [[#Benchmark Statement]], [[#Rulebook]], [[#Oversight Function]]

**Sources:**
- [STOXX Methodology Consultation Process](https://www.stoxx.com/benchmark-regulation)
- [ISS Policy Consultation & Updates](https://www.issgovernance.com/policy-gateway/voting-policies/)

---

## O

### Oversight Function

> An internal or independent committee established by a benchmark administrator to monitor and review all aspects of benchmark provision, including methodology integrity, data quality, conflict-of-interest management, and complaint handling, as required by the EU Benchmarks Regulation.

The oversight function is the governance watchdog inside an index provider. For STOXX, this takes the form of an Oversight Committee with a defined charter, meeting cadence, and escalation authority. The committee reviews methodology changes, monitors for errors or manipulation, evaluates the adequacy of data inputs, and ensures that the administrator's code of conduct is followed. It operates independently from the commercial and index-operations teams to avoid conflicts of interest. ISS maintains analogous governance structures for its benchmark-related products.

> [!tip] Related Terms
> [[#Benchmark Administration]], [[#Index Administrator]], [[#Methodology Consultation]], [[#Quality Assurance (Data)]]

**Sources:**
- [EU BMR Article 5 — Oversight Function Requirements](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R1011)
- [STOXX Benchmark Regulation — Governance & Oversight](https://www.stoxx.com/benchmark-regulation)

---

## P

### Pro-Forma Data

> Hypothetical or adjusted data that shows what an index's composition, weights, or performance would look like if a proposed methodology change, corporate action, or rebalancing had already been applied, before the change takes effect.

Pro-forma data is the "preview" of an index change. When STOXX announces a quarterly rebalancing, it often publishes pro-forma constituent lists and weights several days before the effective date, giving passive fund managers time to prepare their trades. Similarly, when a methodology consultation proposes new screening criteria, STOXX may provide pro-forma back-tests showing how the index would have behaved under the proposed rules. ISS uses pro-forma analyses when evaluating the impact of governance policy changes on voting recommendations.

> [!tip] Related Terms
> [[#Review Report]], [[#Selection List]], [[#Back-Testing]], [[#Methodology Consultation]]

**Sources:**
- [STOXX Index Reviews — Pro-Forma Announcements](https://www.stoxx.com/index-reviews)
- [STOXX Index Methodology Guide](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

### Panel Data

> A dataset that combines cross-sectional and time-series dimensions, tracking multiple entities across multiple time periods so that each observation is identified by both an entity and a date.

Panel data is the gold standard for empirical research in finance. If you have ESG scores for 3,000 companies observed quarterly over ten years, that is a panel. ISS's historical ESG and governance databases are structured as panels, enabling clients to study how governance quality evolves over time and across peer groups.

> [!tip] Related Terms
> [[#Cross-Sectional Data]], [[#Time Series Data]], [[#Point-in-Time Data]]

**Sources:**
- [ISS ESG Historical Data](https://www.issgovernance.com/esg/ratings/)
- [ISS Data Delivery Solutions](https://www.issgovernance.com/solutions/iss-data-deliveries/)

---

### Point-in-Time Data

> Data that is stored and delivered exactly as it was known on a specific historical date, preserving the original values before any subsequent revisions, restatements, or corrections.

Point-in-time (PIT) databases are essential for unbiased back-testing. If a company restates its 2023 emissions in 2025, a PIT database retains both the original 2023 figure (as known in 2023) and the restated figure (as known in 2025). Using PIT data ensures that simulations reflect only the information that was actually available to decision-makers at each historical moment.

> [!tip] Related Terms
> [[#Look-Ahead Bias]], [[#Back-Testing]], [[#Panel Data]], [[#Survivorship Bias]]

**Sources:**
- [ISS ESG Point-in-Time Data](https://www.issgovernance.com/esg/ratings/)
- [STOXX Historical Index Data](https://www.stoxx.com/data-index-data)

---

## Q

### Quality Assurance (Data)

> The systematic processes, checks, and controls that a data provider applies to ensure accuracy, completeness, timeliness, and consistency of its datasets before publication or delivery to clients.

Quality assurance (QA) in the index and ESG data world encompasses automated validation rules (e.g., a market-cap value cannot be negative), manual review by analysts, reconciliation against independent sources, and exception-handling workflows. STOXX's index operations team runs multi-layered QA on every corporate action, rebalancing, and daily calculation. ISS applies similar rigour to governance scores, flagging outliers for analyst review.

> [!tip] Related Terms
> [[#Benchmark Administration]], [[#Estimation Model]], [[#Review Report]]

**Sources:**
- [STOXX Quality Assurance & Control Framework](https://www.stoxx.com/benchmark-regulation)
- [ISS QualityScore Methodology](https://www.issgovernance.com/esg/ratings/governance-qualityscore/)

---

## R

### Restatement

> A revision to previously published data — such as financial figures, ESG metrics, or index values — issued by either the reporting company or the data provider to correct errors, reflect updated methodologies, or incorporate newly available information.

Restatements are the data world's errata. A company may restate its carbon emissions after discovering a measurement error; ISS may revise a governance score after receiving corrected board-composition data; STOXX may restate an index level if a corporate-action adjustment was applied incorrectly. Point-in-time databases preserve both the original and restated values so that historical analyses remain unbiased. High restatement frequency in a dataset can signal underlying data-quality issues and is tracked as part of quality assurance.

> [!tip] Related Terms
> [[#Point-in-Time Data]], [[#Quality Assurance (Data)]], [[#Look-Ahead Bias]], [[#Vendor Reconciliation]]

**Sources:**
- [ISS ESG Data Quality & Restatement Procedures](https://www.issgovernance.com/esg/ratings/corporate-rating/)
- [STOXX Index Methodology Guide — Corrections Policy](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

### Review Report

> A document published by an index administrator or advisory committee following a periodic index review, summarising the changes to index composition (additions, deletions, and share adjustments) and the rationale behind them.

After each quarterly or annual review, STOXX publishes a review report (sometimes called an announcement) that lists which companies are entering or leaving the index and any changes to free-float factors or share counts. These reports are closely watched by passive fund managers, who must execute rebalancing trades to match the new composition. ISS similarly publishes review and update reports for its governance and ESG rating changes.

> [!tip] Related Terms
> [[#Selection List]], [[#Rulebook]], [[#Index Administrator]]

**Sources:**
- [STOXX Index Reviews & Announcements](https://www.stoxx.com/index-reviews)
- [ISS Governance Research Reports](https://www.issgovernance.com/policy-gateway/voting-policies/)

---

### RIC (Reuters Instrument Code)

> A proprietary ticker-like identifier assigned by Refinitiv (formerly Reuters) to uniquely reference a financial instrument — such as an equity, index, or derivative — within the Refinitiv Eikon and Elektron platforms.

RICs are one of several vendor-specific codes that STOXX publishes for each index. A RIC such as `.STOXX50E` allows Refinitiv terminal users and API consumers to pull real-time and historical data for the EURO STOXX 50. Because RICs are proprietary, they are not interchangeable with Bloomberg tickers or ISINs, making cross-reference tables essential for multi-vendor environments.

> [!tip] Related Terms
> [[#Data Vendor Code]], [[#ISIN (International Securities Identification Number)]], [[#Data Feed]]

**Sources:**
- [Refinitiv (LSEG) — RIC Reference](https://www.lseg.com/en/data-analytics)
- [STOXX Factsheets — Vendor Code Listings](https://www.stoxx.com/indices)

---

### Rulebook

> The comprehensive, legally binding document published by an index administrator that specifies every aspect of an index's construction, maintenance, calculation, and governance — serving as the definitive methodology reference.

The rulebook is the single source of truth for an index. It details the universe, selection criteria, weighting scheme, rebalancing schedule, corporate-action treatment, and extraordinary-event procedures. STOXX publishes rulebooks for each index family, and any deviation from the rulebook must go through a formal governance and consultation process under BMR requirements.

> [!tip] Related Terms
> [[#Benchmark Administration]], [[#Index Administrator]], [[#Review Report]], [[#Factsheet]]

**Sources:**
- [STOXX Rulebooks & Methodology Documents](https://www.stoxx.com/document-library)
- [STOXX Benchmark Regulation — Methodology Changes](https://www.stoxx.com/benchmark-regulation)

---

## S

### Selection List

> The finalised roster of securities or entities that have passed all eligibility screens, liquidity filters, and ranking criteria during an index review and will be included in the index for the upcoming period.

The selection list is the output of the review process — the names that "made the cut." For STOXX indices, the selection list is determined by applying the rulebook's criteria to the coverage universe at the review cut-off date. The list is typically published several days before the effective date to give the market time to anticipate rebalancing flows.

> [!tip] Related Terms
> [[#Coverage Universe]], [[#Universe Construction]], [[#Review Report]]

**Sources:**
- [STOXX Index Reviews](https://www.stoxx.com/index-reviews)
- [STOXX Index Methodology Guide](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

### Simulation File

> A structured data file provided by an index administrator that contains the full historical composition, weights, and corporate actions of an index, enabling clients to independently replicate past index calculations.

Simulation files are the raw material for back-testing and audit. STOXX offers simulation files as part of its data services, allowing licensees — ETF providers, structured-product issuers, and quantitative researchers — to verify that their replication of the index matches STOXX's official values. These files are typically delivered in CSV or XML format and include daily constituent snapshots.

> [!tip] Related Terms
> [[#Back-Testing]], [[#Historical Simulation]], [[#End-of-Day Data]]

**Sources:**
- [STOXX Data & Simulation Services](https://www.stoxx.com/data-index-data)
- [STOXX Customized Indices](https://www.stoxx.com/customized-indices)

---

### Snowflake Delivery

> A data distribution method in which a provider makes datasets available through Snowflake's cloud data platform, enabling clients to access live, query-ready data directly within their own Snowflake environment without file transfers.

Snowflake delivery represents the modern evolution of data distribution. Instead of downloading CSV files or polling an FTP server, clients can access ISS and STOXX datasets as shared tables in Snowflake, running SQL queries against always-current data. This eliminates ETL overhead, reduces latency, and ensures that all consumers are working from the same version of the data.

> [!tip] Related Terms
> [[#Data Feed]], [[#DataDesk (ISS Platform)]], [[#End-of-Day Data]]

**Sources:**
- [ISS ESG on Snowflake Marketplace](https://www.issgovernance.com/solutions/iss-data-deliveries/)
- [Snowflake Data Marketplace](https://www.snowflake.com/data-marketplace/)

---

### Survivorship Bias

> A systematic distortion in historical analysis that arises when only currently existing entities (e.g., companies still listed) are included in a dataset, while entities that have been delisted, merged, or bankrupted are excluded.

Survivorship bias makes past performance look better than it actually was because the "losers" — companies that failed — disappear from the dataset. A back-test of a stock-selection strategy that only uses today's listed companies will overstate returns because it ignores companies that went bankrupt along the way. STOXX and ISS mitigate survivorship bias by maintaining records of delisted constituents in their historical databases.

> [!tip] Related Terms
> [[#Look-Ahead Bias]], [[#Back-Testing]], [[#Point-in-Time Data]], [[#Historical Simulation]]

**Sources:**
- [STOXX Index Methodology Guide — Disclaimers](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [CFA Institute — Survivorship Bias in Performance Analysis](https://www.cfainstitute.org/)

---

### Sustainability Gateway (ISS Platform)

> ISS's integrated online platform that provides clients with access to ESG ratings, climate analytics, norms-based screening, SDG alignment data, and other responsible-investment datasets through a unified web interface.

The Sustainability Gateway (sometimes referred to as ISS ESG Gateway) is the ESG-specific counterpart to DataDesk. It is purpose-built for responsible-investment workflows: portfolio-level ESG scoring, regulatory reporting (SFDR, EU Taxonomy), controversy screening, and engagement tracking. Data accessed through the Gateway feeds directly into compliance and reporting processes for asset managers and asset owners.

> [!tip] Related Terms
> [[#DataDesk (ISS Platform)]], [[#Estimation Model]], [[#Coverage Universe]]

**Sources:**
- [ISS ESG Solutions — Gateway](https://www.issgovernance.com/esg/)
- [ISS ESG Platform Overview](https://www.issgovernance.com/solutions/)

---

## T

### Time Series Data

> A sequence of data points recorded at successive, equally spaced intervals over time for a single entity or variable, such as daily closing index levels or monthly ESG scores.

Time series data is the backbone of performance measurement and trend analysis. The daily closing values of the EURO STOXX 50 from 1998 to today form a time series. STOXX provides time series data for all its indices going back to each index's base date (or earlier, for back-tested periods). Analysts use time series to compute volatility, drawdowns, correlations, and other risk metrics.

> [!tip] Related Terms
> [[#Cross-Sectional Data]], [[#Panel Data]], [[#End-of-Day Data]]

**Sources:**
- [STOXX Historical Data Services](https://www.stoxx.com/data-index-data)
- [STOXX Index Methodology Guide](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

## U

### Universe Construction

> The systematic process by which an index administrator defines the broadest eligible set of securities for an index, applying geographic, listing, liquidity, and regulatory filters to a starting population.

Universe construction is the very first step in building any index. STOXX starts with all securities in a given region's regulated exchanges, then applies minimum free-float market-cap thresholds, liquidity screens, and listing-venue requirements. The result is the coverage universe from which specific indices draw their constituents. Changes to universe construction rules are among the most impactful methodology decisions and are subject to formal consultation.

> [!tip] Related Terms
> [[#Coverage Universe]], [[#Selection List]], [[#Rulebook]], [[#Benchmark Administration]]

**Sources:**
- [STOXX Index Methodology Guide — Universe Construction](https://www.stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)
- [STOXX Benchmark Regulation — Methodology Governance](https://www.stoxx.com/benchmark-regulation)

---

## V

### Vendor Reconciliation

> The process of comparing data received from two or more independent vendors — or from a vendor against an internal source — to identify and resolve discrepancies in values, identifiers, timestamps, or coverage.

Vendor reconciliation is a daily operational discipline for index providers and asset managers. STOXX reconciles market data received from exchanges and data vendors to ensure that prices, shares outstanding, and corporate-action flags are consistent before they enter the index calculation engine. ISS reconciles company-reported ESG data against third-party sources to flag inconsistencies for analyst review. When discrepancies arise, the reconciliation process determines which source is authoritative and documents the resolution — a key audit-trail requirement under the EU Benchmarks Regulation.

> [!tip] Related Terms
> [[#Quality Assurance (Data)]], [[#Data Vendor]], [[#Data Pipeline]], [[#Restatement]]

**Sources:**
- [STOXX Quality Assurance & Reconciliation Procedures](https://www.stoxx.com/benchmark-regulation)
- [ISS Data Quality Framework](https://www.issgovernance.com/esg/ratings/corporate-rating/)

---

> [!info] Navigation
> Return to the main [[ISS-STOXX]] index or explore related glossaries in the
> [[18-Financial-Domain]] section.
