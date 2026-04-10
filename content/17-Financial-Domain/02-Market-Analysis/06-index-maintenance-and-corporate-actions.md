---
title: "06 - Index Maintenance and Corporate Actions"
type: concept
category: financial-domain
technology: [sql-server, python, bigquery]
tags: [python, sql, bigquery, financial, stoxx]
aliases: [corporate actions processing, index maintenance, financial index engineering, stock split adjustment, free-float methodology, index divisor, reconstitution pipeline, ESG data integration, point-in-time data, bi-temporal modeling]
keywords: [financial index, corporate actions, stock split, dividend, merger, spinoff, free-float, index divisor, index reconstitution, weight capping, total return, price return, net return, withholding tax, point-in-time, look-ahead bias, SCD type 2, bi-temporal, ESG, SFDR, BMR, European equity index, MSCI, rebalancing, buffer rules, index calculation, benchmark regulation]
description: "Comprehensive guide to financial index maintenance: corporate actions processing (splits, dividends, mergers, spinoffs), free-float methodology, weight capping, quarterly reconstitution, and ESG data integration. Covers the index divisor, point-in-time (PIT) temporal data, bi-temporal modeling, and EU regulatory requirements (BMR, SFDR). Essential for data engineers at financial index providers."
parent: "[[domain-market-analysis]]"
links:
  - "[[05-breadth-and-sentiment-indicators]]"
  - "[[07-corporate-action-missed]]"
  - "[[04-liquidity-and-flow-metrics]]"
  - "[[03-risk-and-volatility-metrics]]"
  - "[[01-technical-indicators]]"
  - "[[02-valuation-ratios]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Financial Index Maintenance and Corporate Actions

A senior data engineer at a financial index provider is not just a technologist — they are a domain expert who understands *why* every number matters. A single mishandled stock split cascades into incorrect ETF NAVs, failed rebalancing trades, and regulatory scrutiny. This note covers the financial domain knowledge that separates a data engineer who builds pipelines from one who builds *trusted* pipelines.

## What Is a Financial Index?

A financial index is a *rules-based, transparent calculation* that measures the performance of a defined basket of securities. It is not a portfolio you can invest in directly — it is a benchmark against which portfolios are measured.

#### The three components of any index

1. **Universe** — the pool of eligible securities (e.g., all Eurozone equities with free-float market cap > €4B)
2. **Selection rules** — which securities enter/exit the index (ranking by market cap, liquidity thresholds, buffer rules)
3. **Weighting methodology** — how much each constituent contributes to the index value

#### Common weighting schemes

| Scheme | Formula | Example |
|---|---|---|
| Free-float market cap weighted | Weight = (Free-float shares × Price) / Sum of all | a European equity index, S&P 500, MSCI World |
| Price weighted | Weight = Price / Sum of all prices | Dow Jones Industrial Average, Nikkei 225 |
| Equal weighted | Weight = 1/N for each constituent | S&P 500 Equal Weight |
| Factor weighted | Weight = Market cap × Factor score | MSCI Minimum Volatility, factor-weighted indices |
| Capped | Market cap weighted with max weight limit (e.g., 10%) | DAX (10% cap), major European equity indices (10% cap) |

#### The index divisor — the key to continuity

The divisor is the single most important number in index maintenance. It ensures that index-level changes (constituent additions/removals, corporate actions) do not create artificial jumps in the index value.

```
Index Value = Sum(Price_i × Shares_i × FreeFloatFactor_i × CapFactor_i) / Divisor
```

When a corporate action changes the numerator, the divisor is adjusted so that the index value remains continuous:

```
New Divisor = Old Divisor × (New Numerator / Old Numerator)
```

This means: the index value at market close *before* the event equals the index value at market open *after* the event — the event itself creates no return.

## Corporate Actions: The Highest-Risk Data Operation


Corporate actions are company-level events that change the capital structure, ownership, or trading characteristics of a security. For index engineers, each corporate action requires a specific data adjustment to maintain index accuracy.

#### Mandatory corporate actions (no shareholder choice)

| Action | Data Adjustment | Risk Level |
|---|---|---|
| **Stock split** (e.g., 1:4) | Divide all historical prices by split ratio. Multiply shares in index by ratio. Adjust divisor. | CRITICAL — wrong ratio corrupts all time series |
| **Reverse split** (e.g., 5:1) | Multiply prices by ratio. Divide shares. Adjust divisor. | HIGH — price spike looks like a real move if missed |
| **Special dividend** | Price return index: no adjustment. Total return index: reinvest dividend at ex-date. Net return: apply withholding tax. | HIGH — affects total return calculations |
| **Spin-off** | Parent price reduced by spin-off value. New entity evaluated against index rules. Divisor adjusted. | CRITICAL — two entities where one existed |
| **Merger/Acquisition** | Target removed at last trading price. Acquirer weight may change. Divisor adjusted. | HIGH — timing must match exchange delisting |
| **Name/Ticker change** | Update reference data. No price adjustment. | LOW — but missed changes break downstream joins |
| **Rights issue** | New shares issued at a discount. Adjust theoretical ex-rights price (TERP). Adjust divisor. | MEDIUM — TERP calculation is formulaic but error-prone |

#### Voluntary corporate actions (shareholder chooses)

| Action | Data Adjustment |
|---|---|
| **Tender offer** | If tender succeeds and stock delists: treat as merger. If partial: adjust free-float. |
| **Stock dividend / Scrip dividend** | Shareholder receives shares instead of cash. Adjust shares outstanding. |
| **Convertible bond exercise** | New equity shares created. Update shares outstanding. |

#### The corporate actions processing pipeline

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Data Sources    │     │  Validation      │     │  Application    │
│                  │     │                  │     │                 │
│ Bloomberg BVAL   │────▶│ Cross-reference  │────▶│ Adjust prices   │
│ Exchange feeds   │     │ Exchange vs BBG  │     │ Adjust shares   │
│ Company filings  │     │ vs Reuters       │     │ Adjust divisor  │
│ Reuters          │     │ Flag conflicts   │     │ Verify index    │
│                  │     │ Manual review    │     │ continuity      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                         │
                                                         ▼
                                                  ┌─────────────────┐
                                                  │  Verification   │
                                                  │                 │
                                                  │ |Before - After|│
                                                  │ < 0.01 = PASS  │
                                                  │ > 0.01 = SEV-1 │
                                                  └─────────────────┘
```

#### Stock split processing — step by step

```sql
-- Deutsche Telekom announces 1:4 stock split, effective 2026-03-10

-- Step 1: Adjust all historical OHLCV data
UPDATE silver.daily_ohlcv
SET open_price  = open_price  / 4.0,
    high_price  = high_price  / 4.0,
    low_price   = low_price   / 4.0,
    close_price = close_price / 4.0,
    volume      = volume * 4  -- more shares trading, each worth 1/4
WHERE symbol = 'DTE.DE'
  AND trade_date < '2026-03-10';

-- Step 2: Update shares in index
UPDATE silver.index_constituents
SET shares_in_index = shares_in_index * 4,
    free_float_factor = free_float_factor  -- unchanged
WHERE symbol = 'DTE.DE'
  AND index_key = 'target_index';

-- Step 3: Recalculate and verify index divisor
-- The divisor adjustment ensures index value continuity
DECLARE @old_numerator DECIMAL(28,6), @new_numerator DECIMAL(28,6);

-- Old numerator (before split, using yesterday's close)
SELECT @old_numerator = SUM(
    CASE WHEN symbol = 'DTE.DE'
         THEN 42.80 * 500000000 * free_float_factor * cap_factor  -- pre-split price × pre-split shares
         ELSE close_price * shares_in_index * free_float_factor * cap_factor
    END)
FROM silver.index_constituents c
JOIN silver.daily_ohlcv o ON c.symbol = o.symbol AND o.trade_date = '2026-03-09'
WHERE c.index_key = 'target_index';

-- New numerator (after split)
SELECT @new_numerator = SUM(
    CASE WHEN symbol = 'DTE.DE'
         THEN 10.70 * 2000000000 * free_float_factor * cap_factor  -- post-split price × post-split shares
         ELSE close_price * shares_in_index * free_float_factor * cap_factor
    END)
FROM silver.index_constituents c
JOIN silver.daily_ohlcv o ON c.symbol = o.symbol AND o.trade_date = '2026-03-09'
WHERE c.index_key = 'target_index';

-- Divisor adjustment: New Divisor = Old Divisor × (New Numerator / Old Numerator)
-- In a correct split, @old_numerator = @new_numerator (price halved, shares doubled → product unchanged)
-- So the divisor should NOT change for a clean split
```

## Index Reconstitution: The Quarterly Event

> [!quote]
> "When you buy an index fund, you are also buying all the transaction costs of all those stock trades that an index manager has to make."
>
> — **John Bogle**, *The Little Book of Common Sense Investing* (2007)


Index reconstitution is the periodic review where constituents are added or removed based on the index methodology rules. For a major European equity index, this happens quarterly (March, June, September, December).

#### The reconstitution pipeline

```
Week 1: Universe Screening
   └─▶ Load all eligible securities from reference data system
   └─▶ Apply domicile rules (Eurozone countries only)
   └─▶ Apply instrument type filter (common equity only — no REITs, ETFs, preference shares)
   └─▶ Calculate free-float market capitalization

Week 2: Selection
   └─▶ Rank all eligible securities by free-float market cap
   └─▶ Apply buffer rules:
        • Current constituent stays if ranked ≤ 60 (not 50)
        • New entry qualifies only if ranked ≤ 40 (not 50)
        • This hysteresis prevents excessive turnover ("churning")
   └─▶ Determine additions and deletions

Week 3: Announcement
   └─▶ Index Advisory Committee reviews and approves
   └─▶ Public announcement: T-10 business days before effective date
   └─▶ Publish pro-forma constituent list with new weights

Week 4: Implementation
   └─▶ Effective date (usually 3rd Friday of the month, after market close)
   └─▶ Rebalance: new weights become active
   └─▶ ETF providers execute rebalancing trades at the closing auction
   └─▶ Updated divisor applied for the next trading day
```

#### Why buffer rules exist (the math)

Without buffers, a stock ranked #51 today would be removed, then re-added next quarter when it's ranked #49. Each time, ETFs tracking the index must trade millions of shares — a cost passed to investors.

With the 40/60 buffer:
- A stock ranked #45 is NOT added (must be ≤ 40 to enter)
- A stock ranked #55 is NOT removed (must be > 60 to exit)
- Result: ~30% fewer constituent changes per year, saving ETF investors ~5-15 basis points in tracking difference

## Total Return vs Price Return vs Net Return Indices

Every major index is published in three variants:

| Variant | Dividend Treatment | Use Case |
|---|---|---|
| **Price Return** | Dividends ignored (price drops on ex-date) | Media headlines ("the DAX fell 2% today") |
| **Gross Total Return** | Dividends reinvested at full value | Institutional benchmarks (no tax consideration) |
| **Net Total Return** | Dividends reinvested minus withholding tax | ETF tracking (reflects actual investor experience) |

#### Withholding tax rates by country (simplified)

| Country | Standard Rate | Treaty Rate (typical) |
|---|---|---|
| Germany | 26.375% (25% + 5.5% solidarity) | 15% |
| France | 30% | 15% |
| Netherlands | 15% | 15% |
| Italy | 26% | 15% |
| Spain | 19% | 15% |
| Finland | 30% | 15% |
| Ireland | 25% | 15% |

#### The total return calculation

```python
# On the ex-dividend date for stock i:
# Gross return index: reinvest full dividend
gross_adjustment = 1 + (dividend_per_share / close_price_day_before_ex)

# Net return index: reinvest after withholding tax
net_adjustment = 1 + (dividend_per_share * (1 - withholding_rate) / close_price_day_before_ex)

# Price return index: no adjustment (price naturally drops by ~dividend amount)
```

## Free-Float Methodology

Not all shares outstanding are available for trading. Shares held by founders, governments, strategic investors, or locked by regulations are excluded from the weighting calculation via the **free-float factor**.

#### Shares excluded from free-float

- Government holdings > 5%
- Strategic holdings by other corporations > 5%
- Founder/family holdings (pre-IPO shareholders)
- Locked shares (regulatory, vesting periods)
- Treasury shares (company's own shares)
- Cross-holdings between companies

#### Free-float factor bands (index provider methodology)

| Actual Free-Float | Assigned Factor |
|---|---|
| > 95% | 1.00 |
| 90-95% | 0.95 |
| 85-90% | 0.90 |
| 80-85% | 0.85 |
| ... | (5% increments) |
| 15-20% | 0.20 |
| 10-15% | 0.15 |
| < 10% | Not eligible for index |

> [!warning] High Impact on ETF Allocation
> Free-float factors are updated quarterly and affect every weight calculation. A wrong free-float factor for a large constituent (e.g., SAP at 8% of the index) means billions of dollars of ETF money is allocated incorrectly.

## Weight Capping and Rebalancing

Most indices impose a maximum weight cap to prevent single-stock dominance. A typical European equity index caps constituents at **10%** of the index.

#### The capping algorithm

```python
import pandas as pd

def apply_weight_cap(weights: pd.Series, cap: float = 0.10) -> pd.Series:
    """
    Iteratively cap weights and redistribute excess pro-rata.
    Must iterate because redistributing excess can push other stocks over the cap.
    """
    capped = weights.copy()
    for _ in range(100):  # converges in 3-5 iterations typically
        excess = capped[capped > cap] - cap
        if excess.sum() == 0:
            break
        # Cap the overweight stocks
        capped[capped > cap] = cap
        # Redistribute excess pro-rata to uncapped stocks
        uncapped_mask = capped < cap
        uncapped_total = capped[uncapped_mask].sum()
        if uncapped_total > 0:
            capped[uncapped_mask] += excess.sum() * (capped[uncapped_mask] / uncapped_total)

    # Normalize to ensure weights sum to 1.0
    return capped / capped.sum()

# Example: SAP grew to 12% of the target index
weights = pd.Series({
    'SAP': 0.12, 'ASML': 0.09, 'LVMH': 0.08, 'TOTAL': 0.07,
    'SIEMENS': 0.06, 'OTHER_45': 0.58
})
capped_weights = apply_weight_cap(weights, cap=0.10)
# SAP: 0.10, excess 0.02 redistributed to remaining 49 stocks
```

## Unscheduled Adjustments: When Markets Surprise You

Not everything happens on schedule. These events require immediate index adjustments outside the regular reconstitution cycle:

| Event | Response | Timeline |
|---|---|---|
| **IPO of a large company** | May be fast-tracked into index if eligible | 5-10 business days |
| **Sudden delisting** (fraud, bankruptcy) | Removed at last traded price or zero | Same day or T+1 |
| **Tender offer / takeover** | Removed when tender completes, shares delist | On completion date |
| **Trading suspension** | Last available price used until trading resumes | Ongoing |
| **Market circuit breaker** | Index calculation paused, resumed when trading resumes | Real-time |
| **Country sanctions** | Constituents from sanctioned countries removed | 1-5 business days |
| **Stock exchange migration** | Update exchange codes, trading hours, currency | On migration date |

> [!warning] NULL Price Is Not "No Trade Today"
> Your pipeline must handle all these edge cases. When a corporate action is missed or misprocessed, follow the [[07-corporate-action-missed]] runbook for immediate remediation. A `NULL` price is not the same as "not traded today" — it might mean "suspended pending material news" and requires different treatment than a weekend or holiday.

## The Regulatory Landscape

Since the EU Benchmarks Regulation (BMR, 2018) and IOSCO Principles for Financial Benchmarks (2013), financial indices are regulated products:

#### What this means for data engineers

- **Audit trail**: Every data transformation must be traceable. You must be able to explain *why* the index value was 4,521.37 on a specific date, down to the individual stock prices, weights, and corporate actions applied.
- **Input data validation**: Benchmark administrators must verify that input data is "sufficient, accurate, and reliable" — this is not a suggestion, it is a legal requirement.
- **Change management**: Changes to the calculation methodology must go through a formal governance process with public consultation.
- **Conflict of interest**: Personnel involved in index calculation must not have personal trading positions in constituent stocks.
- **Record retention**: All input data, calculation logs, and methodology documents must be retained for at least 5 years (10 years in some jurisdictions).

#### Regulatory audit query — reconstruct index value for a specific date

```sql
SELECT
    c.symbol,
    c.shares_in_index,
    c.free_float_factor,
    c.cap_factor,
    o.close_price,
    c.shares_in_index * c.free_float_factor * c.cap_factor * o.close_price AS contribution,
    c.shares_in_index * c.free_float_factor * c.cap_factor * o.close_price
        / SUM(c.shares_in_index * c.free_float_factor * c.cap_factor * o.close_price) OVER() AS weight_pct,
    d.divisor_value,
    SUM(c.shares_in_index * c.free_float_factor * c.cap_factor * o.close_price) OVER() / d.divisor_value AS index_value
FROM silver.index_constituents c
JOIN silver.daily_ohlcv o ON c.symbol = o.symbol AND o.trade_date = '2026-03-09'
CROSS JOIN silver.index_divisors d
WHERE c.index_key = 'target_index'
  AND d.index_key = 'target_index'
  AND d.effective_date <= '2026-03-09'
  AND (d.end_date IS NULL OR d.end_date > '2026-03-09')
ORDER BY weight_pct DESC;
```

## Point-in-Time (PIT) Temporal Data: Querying History Without Look-Ahead Bias

> [!quote]
> "It is easy to see the past as inevitable, because it already happened. The hard part is remembering it was once uncertain."
>
> — **Marcos Lopez de Prado**, *Advances in Financial Machine Learning* (2018)


Point-in-Time (PIT) data management answers the question: "What did we *know* about this index on a specific date?" This is fundamentally different from "What was the *correct* composition on that date?" — the distinction is critical for backtesting, regulatory audits, and quantitative research.

#### The look-ahead bias problem

```
Timeline:
Mar 1:  Index composition is {A, B, C, D, E}
Mar 10: Company C announces fraud, stock suspended
Mar 12: Index provider removes C, adds F (effective Mar 13)
Mar 15: Historical data corrected — C's financials restated

Question: What was the index composition on March 5th?

WRONG (look-ahead bias):  {A, B, D, E, F}  ← uses future knowledge of C's removal
CORRECT (PIT-accurate):   {A, B, C, D, E}  ← what we knew on March 5th
```

If a backtesting system uses the "corrected" composition, it assumes traders had knowledge they did not possess. This is look-ahead bias, and it invalidates any performance analysis built on the data.

**SCD Type 2: The foundation of PIT queries**

PIT queries require [SCD Type 2](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/migration-idempotency-backfills) (Slowly Changing Dimension) tables that track *when* each fact was known, not just what it was. The [silver-transforms](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/silver-transforms) layer implements SCD Type 2 for constituent tracking, and [dbt-snapshots-and-scd](https://alp78.github.io/elysium/11-dbt/Advanced/dbt-snapshots-and-scd) automates snapshot generation for dimension history:

```sql
-- silver.index_constituents — SCD Type 2 design
CREATE TABLE silver.index_constituents (
    constituent_sk  BIGINT IDENTITY PRIMARY KEY,  -- surrogate key
    index_key       NVARCHAR(50)  NOT NULL,
    symbol          NVARCHAR(20)  NOT NULL,
    shares_in_index DECIMAL(18,4) NOT NULL,
    free_float_factor DECIMAL(8,6) NOT NULL,
    cap_factor      DECIMAL(8,6) NOT NULL DEFAULT 1.0,
    effective_date  DATE NOT NULL,   -- when this record became effective
    end_date        DATE NULL,       -- NULL = currently active
    is_current      BIT NOT NULL DEFAULT 1,
    loaded_at       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    source_file     NVARCHAR(200)    -- audit: which file/API provided this
);

-- Index on the PIT query pattern
CREATE INDEX IX_constituents_pit
ON silver.index_constituents (index_key, effective_date, end_date)
INCLUDE (symbol, shares_in_index, free_float_factor, cap_factor);
```

#### PIT query pattern — "What was the composition on date X?"

```sql
-- Returns the index composition as it was known on @pit_date
DECLARE @pit_date DATE = '2026-03-05';
DECLARE @index_key NVARCHAR(50) = 'target_index';

SELECT
    c.symbol,
    c.shares_in_index,
    c.free_float_factor,
    c.cap_factor,
    o.close_price,
    c.shares_in_index * c.free_float_factor * c.cap_factor * o.close_price AS market_cap_contribution
FROM silver.index_constituents c
JOIN silver.daily_ohlcv o
    ON c.symbol = o.symbol
    AND o.trade_date = @pit_date
WHERE c.index_key = @index_key
  AND c.effective_date <= @pit_date
  AND (c.end_date IS NULL OR c.end_date > @pit_date)
ORDER BY market_cap_contribution DESC;
```

#### Bi-temporal modeling — the gold standard for regulated data

Bi-temporal tables track two independent time dimensions:
1. **Valid time** (business time): when the fact was true in the real world
2. **Transaction time** (system time): when the fact was recorded in the database

```sql
-- gold.index_composition_bitemporal
CREATE TABLE gold.index_composition_bitemporal (
    index_key       NVARCHAR(50)  NOT NULL,
    symbol          NVARCHAR(20)  NOT NULL,
    weight_pct      DECIMAL(8,6)  NOT NULL,

    -- Valid time: when was this weight in effect?
    valid_from      DATE NOT NULL,
    valid_to        DATE NULL,      -- NULL = currently valid

    -- Transaction time: when did we record this?
    recorded_from   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    recorded_to     DATETIME2 NULL,  -- NULL = current version

    PRIMARY KEY (index_key, symbol, valid_from, recorded_from)
);

-- Query 1: "What is the current composition?" (latest valid, latest recorded)
SELECT * FROM gold.index_composition_bitemporal
WHERE valid_to IS NULL AND recorded_to IS NULL;

-- Query 2: "What did we think the composition was on March 5, as of March 8?"
-- (PIT valid time = March 5, PIT transaction time = March 8)
SELECT * FROM gold.index_composition_bitemporal
WHERE valid_from <= '2026-03-05' AND (valid_to IS NULL OR valid_to > '2026-03-05')
  AND recorded_from <= '2026-03-08' AND (recorded_to IS NULL OR recorded_to > '2026-03-08');

-- Query 3: "Show me every version of SAP's weight we ever recorded"
-- (full audit trail for regulatory compliance)
SELECT * FROM gold.index_composition_bitemporal
WHERE index_key = 'target_index' AND symbol = 'SAP.DE'
ORDER BY valid_from, recorded_from;
```

#### PIT-correct joins for backtesting

```python
import polars as pl

def pit_join(facts: pl.LazyFrame, dim: pl.LazyFrame,
             join_keys: list[str], pit_date_col: str,
             dim_valid_from: str = "effective_date",
             dim_valid_to: str = "end_date") -> pl.LazyFrame:
    """
    Point-in-Time join: join facts to the dimension row that was
    valid at the time of each fact row, avoiding look-ahead bias.
    """
    return (
        facts
        .join(dim, on=join_keys, how="inner")
        .filter(
            (pl.col(dim_valid_from) <= pl.col(pit_date_col)) &
            (pl.col(dim_valid_to).is_null() | (pl.col(dim_valid_to) > pl.col(pit_date_col)))
        )
    )

# Usage: join daily prices to the composition that was valid on each trade_date
daily_prices = pl.scan_parquet("data/daily_ohlcv.parquet")
compositions = pl.scan_parquet("data/index_constituents_scd2.parquet")

pit_data = pit_join(
    daily_prices, compositions,
    join_keys=["index_key", "symbol"],
    pit_date_col="trade_date"
).collect()
```

> [!warning] EU BMR Compliance Requirement
> [EU BMR](https://alp78.github.io/elysium/17-Financial-Domain/Regulatory/eu-bmr-benchmark-regulation) Article 11 requires benchmark administrators to maintain "adequate records" of all input data and calculations. A regulatory auditor may ask: "Reconstruct the index value for March 5, 2024, using only the data available on that date." If your tables only store the latest version, you cannot answer this question — and that is a compliance violation.

## ESG and Sustainability Data: Integrating Unstructured Data into Financial Warehouses

ISS ESG is one of the world's largest providers of ESG ratings, climate data, and corporate governance assessments. Integrating this data into index calculations is a growing requirement — the EU's Sustainable Finance Disclosure Regulation (SFDR), Corporate Sustainability Reporting Directive (CSRD), and EU Taxonomy require financial products to disclose sustainability metrics.

#### The ESG data challenge

| Challenge | Why It's Hard | Data Engineering Solution |
|---|---|---|
| **Unstructured sources** | Corporate sustainability reports are 200-page PDFs, not APIs | NLP extraction → structured tables |
| **No universal standard** | SASB, GRI, TCFD, CSRD all define different metrics | Map to internal canonical schema |
| **Delayed availability** | ESG ratings updated quarterly or annually, not daily | Separate update cadence from price data |
| **Subjectivity** | ESG scores involve analyst judgment, not just math | Track score + methodology version + analyst ID |
| **Retroactive revisions** | Scores revised when new information surfaces | SCD Type 2 for all ESG scores |

#### ESG data model (silver layer)

```sql
-- silver.esg_scores — company-level ESG ratings
CREATE TABLE silver.esg_scores (
    score_sk         BIGINT IDENTITY PRIMARY KEY,
    symbol           NVARCHAR(20)  NOT NULL,
    provider         NVARCHAR(50)  NOT NULL,  -- ISS_ESG, MSCI, Sustainalytics
    rating_date      DATE          NOT NULL,

    -- Pillar scores (normalized 0-100)
    environmental_score  DECIMAL(5,2),
    social_score         DECIMAL(5,2),
    governance_score     DECIMAL(5,2),
    overall_esg_score    DECIMAL(5,2),

    -- Climate-specific metrics
    carbon_intensity     DECIMAL(12,4),  -- tCO2e per $M revenue
    scope1_emissions     DECIMAL(15,2),  -- direct emissions (tonnes CO2e)
    scope2_emissions     DECIMAL(15,2),  -- electricity/heat (tonnes CO2e)
    scope3_emissions     DECIMAL(15,2),  -- value chain (tonnes CO2e, often estimated)
    temperature_alignment DECIMAL(4,2),  -- implied temperature rise (°C)

    -- Controversy and flags
    controversy_flag     BIT DEFAULT 0,
    un_global_compact    NVARCHAR(20),   -- PASS, FAIL, WATCHLIST
    eu_taxonomy_aligned_pct DECIMAL(5,2), -- % revenue aligned with EU Taxonomy

    -- SCD Type 2 tracking
    effective_date   DATE NOT NULL,
    end_date         DATE NULL,
    is_current       BIT NOT NULL DEFAULT 1,
    methodology_version NVARCHAR(20),
    loaded_at        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

-- silver.esg_controversies — event-level data
CREATE TABLE silver.esg_controversies (
    controversy_id   BIGINT IDENTITY PRIMARY KEY,
    symbol           NVARCHAR(20) NOT NULL,
    event_date       DATE NOT NULL,
    category         NVARCHAR(100),  -- Human Rights, Environment, Labor, Governance
    severity         NVARCHAR(20),   -- LOW, MEDIUM, HIGH, CRITICAL
    description      NVARCHAR(MAX),
    source_url       NVARCHAR(500),
    resolved_date    DATE NULL,
    loaded_at        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
```

#### Ingesting ESG data from unstructured sources (using [LLM pipelines](https://alp78.github.io/elysium/16-AI-and-Prompts/LLM-Pipelines/ai-augmented-data-engineering))

```python
from anthropic import Anthropic
import pdfplumber
import json

client = Anthropic()

def extract_esg_from_report(pdf_path: str, symbol: str) -> dict:
    """
    Extract structured ESG metrics from a corporate sustainability report PDF.
    Uses LLM to parse unstructured text into standardized fields.
    """
    # Extract text from PDF (first 50 pages — ESG metrics are usually in summary)
    with pdfplumber.open(pdf_path) as pdf:
        text = "\n".join(page.extract_text() or "" for page in pdf.pages[:50])

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        messages=[{
            "role": "user",
            "content": f"""Extract ESG metrics from this sustainability report for {symbol}.
Return a JSON object with these fields (use null if not found):
- environmental_score: 0-100 (if the company provides an overall E score)
- carbon_intensity: tonnes CO2e per $M revenue
- scope1_emissions: tonnes CO2e (direct)
- scope2_emissions: tonnes CO2e (electricity/heat)
- scope3_emissions: tonnes CO2e (value chain)
- renewable_energy_pct: percentage of energy from renewables
- water_intensity: cubic meters per $M revenue
- waste_recycling_pct: percentage of waste recycled
- gender_diversity_board_pct: percentage of women on board
- employee_turnover_pct: annual employee turnover
- fatality_count: workplace fatalities
- governance_score: 0-100
- un_global_compact_status: PASS, FAIL, or WATCHLIST
- eu_taxonomy_aligned_revenue_pct: % of revenue aligned

Report text:
{text[:15000]}

Return ONLY valid JSON."""
        }]
    )
    return json.loads(response.content[0].text)
```

#### ESG-weighted index construction

```sql
-- gold.esg_tilted_weights — tilt standard index weights by ESG score
WITH base_weights AS (
    SELECT symbol, weight_pct
    FROM gold.constituent_weights
    WHERE index_key = 'target_index' AND is_current = 1
),
esg AS (
    SELECT symbol, overall_esg_score
    FROM silver.esg_scores
    WHERE provider = 'ISS_ESG' AND is_current = 1
),
tilted AS (
    SELECT
        b.symbol,
        b.weight_pct,
        e.overall_esg_score,
        -- Tilt: multiply weight by normalized ESG score
        b.weight_pct * (e.overall_esg_score / AVG(e.overall_esg_score) OVER())
            AS raw_tilted_weight
    FROM base_weights b
    JOIN esg e ON b.symbol = e.symbol
)
SELECT
    symbol,
    weight_pct AS original_weight,
    overall_esg_score,
    -- Normalize so weights sum to 100%
    raw_tilted_weight / SUM(raw_tilted_weight) OVER() * 100 AS esg_tilted_weight
FROM tilted
ORDER BY esg_tilted_weight DESC;
```

#### EU regulatory requirements for ESG data

| Regulation | Effective | Requirement for Index Providers |
|---|---|---|
| **SFDR** (Sustainable Finance Disclosure Regulation) | 2021 | Disclose ESG methodology for benchmarks marketed as sustainable |
| **EU BMR Climate Benchmarks** | 2022 | Paris-Aligned Benchmarks (PAB) and Climate Transition Benchmarks (CTB) must meet specific decarbonization trajectories |
| **CSRD** (Corporate Sustainability Reporting Directive) | 2024-2026 | ~50,000 EU companies must report standardized sustainability data — massively increases available ESG input data |
| **EU Taxonomy** | 2020+ | Define which economic activities are "environmentally sustainable" — index providers must report taxonomy alignment |

> [!tip] ESG Data Quality Is the Next Frontier
> ESG data in 2026 is where financial price data was in the 1990s — fragmented, inconsistent, and full of gaps. Scope 3 emissions are largely estimated. ESG scores from different providers correlate at only 0.4-0.6 (compared to 0.99+ for credit ratings). A senior data engineer building ESG pipelines must treat every input with skepticism, implement cross-provider reconciliation, and version every score with its methodology. The companies that solve ESG data quality first will dominate the sustainable finance market.

## ISS & STOXX Glossary Cross-References

For formal definitions of the index construction terms discussed above, see the [ISS & STOXX Glossary](https://alp78.github.io/elysium/17-Financial-Domain/Domains/domain-iss-stoxx-glossary):

- [Divisor](https://alp78.github.io/elysium/17-Financial-Domain/ISS-STOXX/index-construction#Divisor) and [Divisor Adjustment](https://alp78.github.io/elysium/17-Financial-Domain/ISS-STOXX/index-construction#Divisor%20Adjustment) — formal definition and formula
- [Free-Float](https://alp78.github.io/elysium/17-Financial-Domain/ISS-STOXX/index-construction#Free-Float) and [Free-Float Factor](https://alp78.github.io/elysium/17-Financial-Domain/ISS-STOXX/index-construction#Free-Float%20Factor) — weighting methodology
- [Capping](https://alp78.github.io/elysium/17-Financial-Domain/ISS-STOXX/index-construction#Capping) and [Capping Factor](https://alp78.github.io/elysium/17-Financial-Domain/ISS-STOXX/index-construction#Capping%20Factor) — weight cap mechanics
- [Reconstitution](https://alp78.github.io/elysium/17-Financial-Domain/ISS-STOXX/index-construction#Reconstitution) and [Buffer Rule](https://alp78.github.io/elysium/17-Financial-Domain/ISS-STOXX/index-construction#Buffer%20Rule) — periodic review process
- [Corporate Action Treatment](https://alp78.github.io/elysium/17-Financial-Domain/ISS-STOXX/index-construction#Corporate%20Action%20Treatment) — how indices handle splits, mergers, dividends
- [Total Return Index](https://alp78.github.io/elysium/17-Financial-Domain/ISS-STOXX/index-construction#Total%20Return%20Index) vs [Net Return Index](https://alp78.github.io/elysium/17-Financial-Domain/ISS-STOXX/index-construction#Net%20Return%20Index) vs [Price Return Index](https://alp78.github.io/elysium/17-Financial-Domain/ISS-STOXX/index-construction#Price%20Return%20Index)
- [EU BMR](https://alp78.github.io/elysium/17-Financial-Domain/ISS-STOXX/regulatory#Benchmark%20Regulation%20(EU%20BMR)) and [SFDR](https://alp78.github.io/elysium/17-Financial-Domain/ISS-STOXX/regulatory#SFDR%20(Sustainable%20Finance%20Disclosure%20Regulation)) — regulatory framework details

## Related

- [migration-idempotency-backfills](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/migration-idempotency-backfills) — Migration patterns, idempotency, and backfill strategies used in financial pipelines
- [ai-augmented-data-engineering](https://alp78.github.io/elysium/16-AI-and-Prompts/LLM-Pipelines/ai-augmented-data-engineering) — LLM pipelines for ESG data extraction and anomaly explanation
- [leadership-and-collaboration](https://alp78.github.io/elysium/15-DataOps/leadership-and-collaboration) — Incident response and post-mortems for financial data incidents

## References

- EU Benchmarks Regulation (BMR): https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R1011
- IOSCO Principles for Financial Benchmarks: https://www.iosco.org/library/pubdocs/pdf/IOSCOPD415.pdf
- Index Methodology Documentation: available from the index provider
- SFDR Regulation: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32019R2088

