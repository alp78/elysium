---
title: "ISS & STOXX Glossary — Market Structure"
description: "Comprehensive glossary of exchange, trading, settlement, sector classification, and market structure terms from STOXX and ISS Governance."
tags:
  - stoxx
  - iss
  - financial-domain
  - glossary
  - market-structure
aliases:
  - "Market Structure Glossary"
date: 2026-03-28
---

# Market Structure — ISS & STOXX Glossary

> [!abstract] About This Section
> This glossary covers exchanges, trading mechanisms, settlement, free float,
> market capitalization, liquidity, and sector/industry classification systems.
> Terms are sourced from [STOXX](https://stoxx.com/) and
> [ISS Governance](https://www.issgovernance.com/) official documentation.
>
> **~60 terms** across multiple sources.

---

## A

### Average Daily Trading Volume (ADTV)

> The mean number of shares (or contracts) traded per day over a defined
> look-back period, typically three months. ADTV is a core input to liquidity
> screening in STOXX index methodologies.

In plain language, ADTV tells you how busy a stock is on a normal day. Index providers like STOXX use it to decide whether a stock trades frequently enough to be included in an index -- if daily volume is too thin, large investors cannot enter or exit positions without moving the price.

> [!tip] Related Terms
> [[#Liquidity]] | [[#Liquidity Screening]] | [[#Trading Volume]] | [[#Turnover Velocity]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf) | [STOXX Rulebooks](https://stoxx.com/rulebooks)

---

### Ask Price

> The lowest price at which a seller is willing to sell a security at a given
> moment. In an order-driven market, the ask price sits on the sell side of the
> order book and, together with the bid price, defines the bid-ask spread.

The ask price is what you pay when you buy a stock at market. If a STOXX index constituent has an ask of EUR 50.02 and a bid of EUR 50.00, buyers crossing the spread will execute at EUR 50.02. Index calculations typically use last-trade or mid-point prices rather than raw ask prices, but the ask is essential for understanding transaction costs.

> [!tip] Related Terms
> [[#Bid Price]] | [[#Bid-Ask Spread]] | [[#Order Book]] | [[#Market Order]]

**Sources:** [Eurex Exchange — Trading](https://www.eurex.com/ex-en/trade) | [Deutsche Borse Cash Market](https://www.deutsche-boerse.com/) | [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

### Auction (Opening/Closing)

> A price-determination mechanism in which buy and sell orders are collected
> over a defined period and then matched at a single price that maximises
> executable volume. Opening auctions set the first traded price of the day;
> closing auctions set the official closing price used by index providers.

Auctions matter enormously for index funds. The closing auction price on an exchange is typically the price STOXX uses for end-of-day index calculations. On rebalancing days, massive order flow concentrates in the closing auction as trackers adjust their portfolios, sometimes representing a significant share of a stock's daily volume.

> [!tip] Related Terms
> [[#Order Book]] | [[#Market Order]] | [[#Limit Order]] | [[#Exchange]]

**Sources:** [Deutsche Borse — Xetra Trading Model](https://www.deutsche-boerse.com/) | [Eurex Exchange](https://www.eurex.com/) | [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

## B

### Bear Market

> A sustained decline in market prices, conventionally defined as a drop of
> 20% or more from a recent peak. Bear markets can affect index composition
> reviews as falling capitalisation pushes companies below size thresholds.

A bear market is the opposite of good times for equity investors. When a STOXX index enters a bear market, constituent weights shift as different stocks fall at different rates, and companies near size-tier boundaries may be reclassified from mid-cap to small-cap at the next review.

> [!tip] Related Terms
> [[#Bull Market]] | [[#Correction]] | [[#Crash]] | [[#Circuit Breaker]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf) | [Qontigo — Market Insights](https://qontigo.com/insights/)

---

### Bid Price

> The highest price a buyer is willing to pay for a security at a given moment.
> The bid price appears on the buy side of the order book and represents the
> best available price for a seller executing immediately.

The bid price is what you receive when you sell a stock at market. For highly liquid STOXX index constituents, the bid is usually only a fraction of a cent away from the ask. For less liquid names, the gap widens, increasing implicit trading costs for index-tracking funds.

> [!tip] Related Terms
> [[#Ask Price]] | [[#Bid-Ask Spread]] | [[#Order Book]] | [[#Market Maker]]

**Sources:** [Eurex Exchange — Trading](https://www.eurex.com/ex-en/trade) | [Deutsche Borse Cash Market](https://www.deutsche-boerse.com/)

---

### Bid-Ask Spread

> The difference between the highest bid price and the lowest ask price for a
> security. The spread is a key indicator of liquidity and transaction cost;
> tighter spreads signal greater liquidity.

The bid-ask spread is the hidden cost of trading. When STOXX evaluates whether a stock is liquid enough for index inclusion, narrow spreads complement high volume as evidence that the stock can be traded efficiently. Wider spreads increase the cost of replicating an index.

> [!tip] Related Terms
> [[#Bid Price]] | [[#Ask Price]] | [[#Liquidity]] | [[#Market Maker]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf) | [Eurex Exchange](https://www.eurex.com/)

---

### Block Trade

> A large privately negotiated transaction in securities that is executed
> outside the open order book, typically at or near the prevailing market price.
> Block trades are common among institutional investors managing index-tracking
> portfolios.

Block trades allow large investors to move sizable positions without disrupting the open market. On STOXX index rebalancing days, asset managers may use block trades to efficiently adjust holdings in line with new index weights, avoiding the price impact that would result from placing the full order on the order book.

> [!tip] Related Terms
> [[#Dark Pool]] | [[#Order Book]] | [[#Liquidity]] | [[#Market Maker]]

**Sources:** [Eurex Exchange — Block Trades](https://www.eurex.com/ex-en/trade) | [Deutsche Borse Cash Market](https://www.deutsche-boerse.com/)

---

### Blue Chip

> An informal term for shares of large, well-established, financially sound
> companies with a long track record of reliable performance. Blue-chip stocks
> are typically the core constituents of flagship indices such as the
> EURO STOXX 50 and DAX.

Blue chips are the anchor stocks of major STOXX indices. They tend to have the largest free-float market capitalisation, the highest liquidity, and the greatest analyst coverage. The EURO STOXX 50, for example, is essentially a blue-chip index for the eurozone.

> [!tip] Related Terms
> [[#Large-Cap]] | [[#Market Capitalization]] | [[#Liquidity]] | [[#Free Float]]

**Sources:** [STOXX — EURO STOXX 50](https://stoxx.com/index/sx5e/) | [Qontigo — Index Families](https://qontigo.com/)

---

### Bull Market

> A sustained period of rising market prices, typically characterised by
> investor optimism and strong economic fundamentals. Bull markets can broaden
> index eligible universes as more companies exceed minimum capitalisation
> thresholds.

A bull market is when equities are broadly climbing. During bull markets, STOXX indices tend to see more candidates meeting inclusion thresholds at review dates, and the selection process becomes more about ranking than about finding stocks that clear minimum bars.

> [!tip] Related Terms
> [[#Bear Market]] | [[#Rally]] | [[#Market Capitalization]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf) | [Qontigo — Market Insights](https://qontigo.com/insights/)

---

## C

### Country Classification

> The assignment of a security or market to a specific country based on its
> primary listing, domicile of incorporation, or principal place of business.
> STOXX uses country classification to determine index eligibility and regional
> index membership.

Country classification answers the question "Where does this company belong?" A firm incorporated in Luxembourg but primarily listed in Frankfurt may be classified differently depending on the index provider's rules. STOXX relies on country classification for its regional and single-country index families (e.g., STOXX Europe 600 vs. DAX).

> [!tip] Related Terms
> [[#Primary Listing]] | [[#Primary Market]] | [[#Regulated Market]] | [[#Dual Listing]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf) | [STOXX Country Classification](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_country_classification.pdf)

---

### Circuit Breaker

> An automatic mechanism that temporarily halts or restricts trading on an
> exchange when prices move beyond predefined thresholds within a short period.
> Circuit breakers are designed to prevent panic-driven cascading sell-offs and
> give participants time to absorb information.

Circuit breakers are the emergency brakes of a stock exchange. If a STOXX index constituent drops (or rises) too fast, the exchange can trigger a volatility interruption that pauses trading for a few minutes. During market-wide stress events, broader circuit breakers may halt all trading on an exchange simultaneously.

> [!tip] Related Terms
> [[#Volatility Halt]] | [[#Halt (Trading)]] | [[#Crash]] | [[#Exchange]]

**Sources:** [Deutsche Borse — Volatility Interruptions](https://www.deutsche-boerse.com/) | [Eurex Exchange — Risk Management](https://www.eurex.com/ex-en/trade) | [STOXX Rulebooks](https://stoxx.com/rulebooks)

---

### Clearing (Market)

> The post-trade process of reconciling and confirming the obligations of buyer
> and seller after a trade is executed, but before final settlement. In Europe,
> central counterparties (CCPs) such as Eurex Clearing interpose themselves
> between trading parties to manage counterparty risk.

Clearing sits between trade execution and settlement. When a STOXX index futures contract is traded on Eurex, Eurex Clearing steps in as the buyer to every seller and the seller to every buyer, guaranteeing that both sides will fulfil their obligations even if one party defaults.

> [!tip] Related Terms
> [[#Settlement]] | [[#Settlement Cycle (T+2)]] | [[#Eurex]] | [[#Exchange]]

**Sources:** [Eurex Clearing](https://www.eurex.com/ec-en/) | [Deutsche Borse Group — Clearstream](https://www.clearstream.com/)

---

### Correction

> A decline of 10% or more from a recent peak in a stock, index, or market,
> but less than the 20% threshold that defines a bear market. Corrections are
> considered normal, periodic resets within longer-term uptrends.

A correction is the market taking a breather. For a STOXX index, a 10-15% pullback may not trigger any special index action, but it can shift the relative rankings of constituents and affect which stocks are near size-tier boundaries at the next review.

> [!tip] Related Terms
> [[#Bear Market]] | [[#Crash]] | [[#Bull Market]] | [[#Rally]]

**Sources:** [Qontigo — Market Insights](https://qontigo.com/insights/) | [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

### Crash

> A sudden, severe, and often unexpected decline in market prices, typically
> exceeding 20% over days or weeks. Market crashes stress-test index
> methodologies, particularly fast-entry and fast-exit rules, circuit breakers,
> and corporate action handling.

A crash is the extreme scenario that index providers must plan for. STOXX methodologies include provisions for extraordinary events -- such as suspensions, delistings, or exchange closures -- that can accompany crashes. Historical crashes (1987, 2008, 2020) have shaped how modern index rules handle stressed markets.

> [!tip] Related Terms
> [[#Bear Market]] | [[#Circuit Breaker]] | [[#Correction]] | [[#Volatility Halt]]

**Sources:** [STOXX Rulebooks](https://stoxx.com/rulebooks) | [Qontigo — Market Insights](https://qontigo.com/insights/)

---

### Custodian

> A financial institution that holds and safeguards securities on behalf of
> investors. Custodians maintain records of ownership, process corporate
> actions, and facilitate settlement. In an index context, custodians report
> holdings data that feeds into free-float and ownership analysis.

Custodians are the vaults of the financial world. When ISS or STOXX needs to determine who owns a company's shares (to calculate free float or identify strategic holdings), custodian records and regulatory filings are key data sources. Global custodians like Clearstream (a Deutsche Borse Group subsidiary) are critical infrastructure.

> [!tip] Related Terms
> [[#Settlement]] | [[#Clearing (Market)]] | [[#Free Float]] | [[#Strategic Holding]]

**Sources:** [Deutsche Borse Group — Clearstream](https://www.clearstream.com/) | [ISS Governance](https://www.issgovernance.com/)

---

## D

### Depositary Receipt

> A negotiable financial instrument issued by a depositary bank that represents
> shares in a foreign company. Common forms include American Depositary Receipts
> (ADRs) and Global Depositary Receipts (GDRs).

A depositary receipt lets investors trade foreign shares on their home exchange without dealing with currency conversion or foreign settlement systems directly. STOXX indices may include or exclude depositary receipts depending on whether the underlying ordinary shares are already represented, to avoid double-counting.

> [!tip] Related Terms
> [[#Dual Listing]] | [[#Primary Listing]] | [[#Exchange]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

### Deutsche Borse Group

> The parent company of the Frankfurt Stock Exchange, Eurex, Clearstream, and
> Qontigo (the index and analytics arm that operates STOXX and DAX indices).
> Deutsche Borse Group is one of the largest exchange organisations globally.

Deutsche Borse Group is the corporate umbrella under which the STOXX index family lives. When you see a STOXX or DAX index, the calculation, licensing, and governance ultimately trace back to Deutsche Borse Group's subsidiary Qontigo.

> [!tip] Related Terms
> [[#Qontigo]] | [[#Frankfurt Stock Exchange]] | [[#Eurex]] | [[#Exchange]]

**Sources:** [Deutsche Borse Group](https://www.deutsche-boerse.com/) | [Qontigo — About](https://qontigo.com/about/)

---

### Dual Listing

> The admission of a company's shares to trading on two or more stock exchanges,
> either through ordinary shares or depositary receipts. Dual listings can
> affect free-float calculations and liquidity aggregation in index
> construction.

When a company lists on multiple exchanges, index providers must decide which listing counts as the "primary" one and how to aggregate trading volume. STOXX generally selects a single primary listing for index inclusion to prevent the same economic exposure from appearing twice.

> [!tip] Related Terms
> [[#Primary Listing]] | [[#Depositary Receipt]] | [[#Liquidity]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

### Dark Pool

> A private, off-exchange trading venue where institutional investors can
> execute large orders without displaying them on the public order book. Dark
> pools reduce market impact for large trades but raise transparency concerns
> regulated under MiFID II in Europe.

Dark pools are the quiet rooms of equity trading. When an index fund needs to rebalance a large position in a STOXX constituent, it may route part of the order through a dark pool to avoid signalling its intentions and moving the price. STOXX index calculations rely on lit-market (public exchange) prices, but dark pool volume can represent a meaningful share of total trading activity.

> [!tip] Related Terms
> [[#Block Trade]] | [[#Order Book]] | [[#Exchange]] | [[#Liquidity]]

**Sources:** [Deutsche Borse — Xetra MidPoint](https://www.deutsche-boerse.com/) | [Eurex Exchange](https://www.eurex.com/) | [STOXX Rulebooks](https://stoxx.com/rulebooks)

---

## E

### Eurex

> One of the world's largest derivatives exchanges, operated by Deutsche Borse
> Group. Eurex provides a venue for trading futures and options on STOXX and DAX
> indices, individual equities, fixed income, and other asset classes.

Eurex is where many STOXX index derivatives trade. If an asset manager wants to hedge exposure to the EURO STOXX 50, the futures and options contracts for that index are listed on Eurex. It plays a central role in European derivatives markets.

> [!tip] Related Terms
> [[#Deutsche Borse Group]] | [[#Exchange]] | [[#Frankfurt Stock Exchange]]

**Sources:** [Eurex Exchange](https://www.eurex.com/) | [Qontigo — About](https://qontigo.com/about/)

---

### Exchange

> A regulated marketplace where securities, derivatives, commodities, or other
> financial instruments are bought and sold under a defined set of rules. In
> STOXX methodologies, only securities listed on eligible exchanges qualify for
> index inclusion.

An exchange provides the infrastructure -- order books, price discovery, clearing links -- that makes orderly trading possible. STOXX maintains a list of eligible exchanges for each index family; a stock must be listed on one of those exchanges to be considered.

> [!tip] Related Terms
> [[#Regulated Market]] | [[#Frankfurt Stock Exchange]] | [[#Eurex]] | [[#Primary Listing]]

**Sources:** [STOXX Rulebooks](https://stoxx.com/rulebooks) | [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

### Equity

> An ownership interest in a company, represented by shares of stock. Equity
> holders have a residual claim on the company's assets after all debts are
> paid. STOXX equity indices track baskets of equity securities across regions,
> sectors, and size segments.

Equity is the foundational asset class that STOXX indices measure. When someone says "equity index," they mean an index composed of ownership stakes in companies -- as opposed to fixed-income, commodity, or other asset classes. The STOXX index family is predominantly an equity index franchise.

> [!tip] Related Terms
> [[#Stock]] | [[#Market Capitalization]] | [[#Free Float]] | [[#Exchange]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf) | [Qontigo — Equity Indices](https://qontigo.com/) | [ISS Governance](https://www.issgovernance.com/)

---

## F

### Frankfurt Stock Exchange

> Germany's principal securities exchange (Frankfurter Wertpapierborse),
> operated by Deutsche Borse Group. It is one of the largest exchanges in
> Europe by market capitalisation and the home exchange of the DAX index.

Frankfurt Stock Exchange is the venue where most German blue-chip stocks are traded. Because Deutsche Borse Group also owns the STOXX index business (through Qontigo), there is a close operational relationship between the exchange and the indices that reference stocks listed there.

> [!tip] Related Terms
> [[#Deutsche Borse Group]] | [[#Exchange]] | [[#Regulated Market]] | [[#Qontigo]]

**Sources:** [Deutsche Borse Cash Market](https://www.deutsche-boerse.com/) | [Frankfurt Stock Exchange](https://www.boerse-frankfurt.de/)

---

### Free Float

> The proportion of a company's total issued shares that are available for
> public trading, excluding strategic holdings, government stakes, treasury
> shares, and other locked-up shares. STOXX uses free-float factors to weight
> index constituents.

Free float answers the question "How much of this company can the market actually buy and sell?" A company with 1 billion shares outstanding but 600 million held by a founding family has a free float of roughly 40%. STOXX multiplies market capitalisation by the free-float factor so that index weights reflect investable reality.

> [!tip] Related Terms
> [[#Free-Float Shares]] | [[#Strategic Holding]] | [[#Market Capitalization]] | [[#Investable Market]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf) | [STOXX Free Float Methodology](https://stoxx.com/rulebooks)

---

### Free-Float Shares

> The absolute number of shares classified as freely tradable in the open
> market, calculated as total shares outstanding minus restricted or
> strategically held shares.

While free float is expressed as a percentage, free-float shares give you the actual share count. STOXX multiplies a stock's price by its free-float shares to arrive at the free-float market capitalisation used for index weighting.

> [!tip] Related Terms
> [[#Free Float]] | [[#Strategic Holding]] | [[#Market Capitalization]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

### Float

> The total number of a company's shares that are available for trading by the
> general public, often used interchangeably with free float. Float excludes
> restricted shares, insider holdings, and other locked-up blocks.

Float is the everyday shorthand for free float. When traders say "the float is tight," they mean there are relatively few shares available for public trading, which can amplify price moves. STOXX formalises this concept through its free-float factor, but in casual market discussion, "float" is the term you will hear most often.

> [!tip] Related Terms
> [[#Free Float]] | [[#Free-Float Shares]] | [[#Strategic Holding]] | [[#Market Capitalization]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf) | [STOXX Free Float Methodology](https://stoxx.com/rulebooks)

---

## G

### GICS (Global Industry Classification Standard)

> A four-tiered sector classification system developed by MSCI and S&P Dow
> Jones Indices. GICS organises companies into 11 sectors, 25 industry groups,
> 74 industries, and 163 sub-industries. Some STOXX indices reference GICS for
> sector-based analysis and comparison.

GICS is the industry taxonomy you hear about most often in the context of S&P and MSCI indices. Although STOXX primarily uses ICB (Industry Classification Benchmark), GICS is relevant when comparing STOXX indices against S&P or MSCI benchmarks or when investors map holdings across classification systems.

> [!tip] Related Terms
> [[#ICB (Industry Classification Benchmark)]] | [[#Sector]] | [[#Sector Classification]] | [[#Supersector]]

**Sources:** [MSCI GICS](https://www.msci.com/gics) | [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

## H

### Halt (Trading)

> A temporary suspension of trading in a particular security or across an
> entire exchange, imposed by the exchange or a regulator. Trading halts are
> triggered by pending news, order imbalances, or regulatory concerns.

A trading halt freezes all order matching for a security. When a STOXX index constituent is halted, the index calculator typically uses the last traded price until trading resumes. Prolonged halts may trigger special index treatment, such as using fair-value estimates or removing the stock if the halt extends beyond a defined period.

> [!tip] Related Terms
> [[#Circuit Breaker]] | [[#Volatility Halt]] | [[#Exchange]] | [[#Crash]]

**Sources:** [Deutsche Borse — Volatility Interruptions](https://www.deutsche-boerse.com/) | [STOXX Rulebooks](https://stoxx.com/rulebooks) | [Eurex Exchange](https://www.eurex.com/)

---

## I

### ICB (Industry Classification Benchmark)

> A comprehensive classification system maintained by FTSE Russell that
> categorises companies into 11 industries, 20 supersectors, 45 sectors, and
> 173 subsectors. STOXX uses ICB as its primary sector classification framework
> for index construction and sector indices.

ICB is the classification backbone behind STOXX sector indices. When you see a "STOXX Europe 600 Banks" index, the constituent selection relies on ICB codes to identify which companies are classified as banks. ICB was originally developed by Dow Jones and FTSE and is now maintained by FTSE Russell.

> [!tip] Related Terms
> [[#GICS (Global Industry Classification Standard)]] | [[#Sector]] | [[#Supersector]] | [[#Sector Classification]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf) | [FTSE Russell ICB](https://www.ftserussell.com/data/industry-classification-benchmark-icb)

---

### Investable Market

> The universe of securities that meet minimum requirements for liquidity, free
> float, and market capitalisation, making them practically accessible to
> institutional investors. STOXX defines investable markets through its
> eligibility screens.

Not every listed stock is investable in a meaningful sense. A company trading three times a week with a USD 5 million free-float market cap is technically public, but impractical for large funds. STOXX's investable market definition filters out such securities so that indices represent portfolios investors can actually replicate.

> [!tip] Related Terms
> [[#Liquidity Screening]] | [[#Free Float]] | [[#Market Capitalization]] | [[#Small-Cap]] | [[#Micro-Cap]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

## L

### Large-Cap

> A classification for companies with the highest free-float market
> capitalisation within a given index universe, typically the top tier by size.
> In the STOXX Total Market Index framework, large-cap generally covers the top
> portion of the investable market.

Large-cap stocks are the household names -- the biggest companies by market value. In a STOXX context, the EURO STOXX 50 is effectively a large-cap index for the eurozone. Large-cap thresholds vary by region and index family.

> [!tip] Related Terms
> [[#Mid-Cap]] | [[#Small-Cap]] | [[#Micro-Cap]] | [[#Market Capitalization]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf) | [STOXX Size Indices](https://stoxx.com/index-families)

---

### Liquidity

> The ease with which a security can be bought or sold in the market without
> causing a significant movement in its price. STOXX measures liquidity through
> metrics such as Average Daily Trading Volume (ADTV) and turnover velocity.

Liquidity is the lifeblood of index replicability. If a stock in an index is illiquid, funds tracking that index will incur high transaction costs or slippage when rebalancing. STOXX therefore applies liquidity screens during index reviews to ensure all constituents trade actively enough.

> [!tip] Related Terms
> [[#Average Daily Trading Volume (ADTV)]] | [[#Turnover Velocity]] | [[#Liquidity Screening]] | [[#Trading Volume]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

### Liquidity Screening

> The process of applying minimum thresholds for trading activity (such as ADTV
> or turnover velocity) to filter out insufficiently liquid securities from an
> index universe. STOXX applies liquidity screening at regular index reviews.

Liquidity screening is the gate that keeps thinly traded stocks out of an index. During quarterly or semi-annual reviews, STOXX checks each candidate stock against its liquidity criteria. Stocks that fall below the threshold are either excluded from entry or, if already in the index, may be removed subject to buffer rules.

> [!tip] Related Terms
> [[#Liquidity]] | [[#Average Daily Trading Volume (ADTV)]] | [[#Turnover Velocity]] | [[#Investable Market]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf) | [STOXX Rulebooks](https://stoxx.com/rulebooks)

---

### Limit Order

> An order to buy or sell a security at a specified price or better. A buy
> limit order executes only at the limit price or lower; a sell limit order
> executes only at the limit price or higher. Limit orders populate the
> order book and provide liquidity.

A limit order gives the trader price control at the expense of execution certainty. Index fund managers often use limit orders during rebalancing to avoid paying more than a target price for new constituents. In contrast to market orders, limit orders can sit unfilled on the order book until the price reaches the specified level.

> [!tip] Related Terms
> [[#Market Order]] | [[#Order Book]] | [[#Ask Price]] | [[#Bid Price]]

**Sources:** [Deutsche Borse — Xetra Order Types](https://www.deutsche-boerse.com/) | [Eurex Exchange — Trading](https://www.eurex.com/ex-en/trade)

---

### Long Position

> Owning a security outright, or having a net positive exposure to it,
> with the expectation that its price will rise. Most index-tracking funds
> hold long positions in every constituent of the index they replicate.

A long position is the most basic form of equity exposure. When a fund tracks the EURO STOXX 50, it holds long positions in all 50 constituent stocks in proportion to their index weights. The concept of being "long" contrasts with short selling, where an investor profits from price declines.

> [!tip] Related Terms
> [[#Short Selling]] | [[#Equity]] | [[#Stock]] | [[#Market Order]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf) | [Eurex Exchange](https://www.eurex.com/)

---

## M

### Market Capitalization

> The total market value of a company's outstanding shares, calculated as the
> share price multiplied by the number of shares outstanding. In STOXX index
> methodologies, free-float market capitalisation (price multiplied by
> free-float shares) is the standard weighting measure.

Market capitalisation is the most fundamental size metric in equity indexing. STOXX almost always uses the free-float-adjusted version so that index weights reflect the portion of each company that the market can actually trade, rather than the total theoretical value.

> [!tip] Related Terms
> [[#Free Float]] | [[#Free-Float Shares]] | [[#Large-Cap]] | [[#Mid-Cap]] | [[#Small-Cap]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

### Micro-Cap

> A classification for companies at the smallest end of the market
> capitalisation spectrum, below the small-cap threshold. Micro-cap stocks are
> often excluded from standard benchmark indices due to liquidity constraints.

Micro-cap stocks sit at the tail end of the size distribution. They appear in broad total-market indices but are typically absent from headline benchmarks like the STOXX Europe 600. Their inclusion or exclusion has a minimal effect on index performance but matters for completeness-oriented investors.

> [!tip] Related Terms
> [[#Small-Cap]] | [[#Large-Cap]] | [[#Mid-Cap]] | [[#Market Capitalization]] | [[#Investable Market]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

### Mid-Cap

> A classification for companies that fall between large-cap and small-cap
> thresholds in terms of free-float market capitalisation. STOXX mid-cap indices
> capture this segment of the market.

Mid-cap companies are the "middle children" of the equity market -- large enough to be liquid and well-followed, but small enough to offer growth potential that mega-caps may lack. STOXX publishes dedicated mid-cap indices (e.g., STOXX Europe Mid 200) for investors targeting this segment.

> [!tip] Related Terms
> [[#Large-Cap]] | [[#Small-Cap]] | [[#Market Capitalization]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf) | [STOXX Size Indices](https://stoxx.com/index-families)

---

### Market Maker

> A firm or individual that continuously quotes both bid and ask prices for a
> security, standing ready to buy or sell at those prices. Market makers provide
> liquidity and help ensure orderly trading, particularly for less actively
> traded index constituents.

Market makers are the lubricant of the order book. On exchanges like Xetra, designated sponsors (a form of market maker) are required for certain securities to maintain minimum quote sizes and maximum spreads. Their presence improves the liquidity metrics that STOXX evaluates when screening stocks for index inclusion.

> [!tip] Related Terms
> [[#Bid-Ask Spread]] | [[#Bid Price]] | [[#Ask Price]] | [[#Order Book]] | [[#Liquidity]]

**Sources:** [Deutsche Borse — Designated Sponsors](https://www.deutsche-boerse.com/) | [Eurex Exchange — Market Making](https://www.eurex.com/ex-en/trade)

---

### Market Order

> An order to buy or sell a security immediately at the best available price.
> Market orders guarantee execution but not the price at which the trade will
> be filled.

A market order is the simplest way to get into or out of a position right now. For highly liquid STOXX blue chips, a market order will typically fill at or very near the displayed bid or ask. For less liquid constituents, the execution price may deviate noticeably from the last traded price, particularly for large order sizes.

> [!tip] Related Terms
> [[#Limit Order]] | [[#Ask Price]] | [[#Bid Price]] | [[#Order Book]]

**Sources:** [Deutsche Borse — Xetra Order Types](https://www.deutsche-boerse.com/) | [Eurex Exchange — Trading](https://www.eurex.com/ex-en/trade)

---

## O

### Order Book

> The electronic record of all outstanding buy and sell orders for a security,
> organised by price level. The order book shows the depth of supply and demand
> and is the mechanism through which price discovery occurs on modern exchanges.

The order book is the central nervous system of an exchange. It shows how many shares are available at each price level on both the bid and ask sides. For STOXX index constituents, deep order books signal healthy liquidity, while thin books raise concerns about replicability and transaction costs for index-tracking funds.

> [!tip] Related Terms
> [[#Bid Price]] | [[#Ask Price]] | [[#Limit Order]] | [[#Market Order]] | [[#Market Maker]]

**Sources:** [Deutsche Borse — Xetra Trading](https://www.deutsche-boerse.com/) | [Eurex Exchange](https://www.eurex.com/)

---

### Over-the-Counter (OTC)

> Trading that occurs directly between two parties without the supervision of
> a formal exchange. OTC markets handle a wide range of instruments including
> bonds, derivatives, and some equities. Securities traded exclusively OTC are
> generally excluded from STOXX indices.

OTC trading happens off-exchange, often via dealer networks or bilateral agreements. STOXX index methodologies typically require that eligible securities be listed on a regulated exchange, which means purely OTC-traded instruments do not qualify. However, some post-trade reporting of exchange-listed stocks occurs OTC (e.g., systematic internaliser trades in Europe).

> [!tip] Related Terms
> [[#Exchange]] | [[#Regulated Market]] | [[#Dark Pool]] | [[#Block Trade]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf) | [Deutsche Borse Cash Market](https://www.deutsche-boerse.com/) | [STOXX Rulebooks](https://stoxx.com/rulebooks)

---

## P

### Primary Listing

> The stock exchange on which a company's shares are principally admitted to
> trading and where the majority of trading volume typically occurs. STOXX uses
> the primary listing to determine a security's eligible price and exchange for
> index purposes.

For dual-listed companies, the primary listing is the "home" exchange that STOXX treats as authoritative for pricing and liquidity measurement. Getting this designation right matters because it determines which price feed drives the index calculation.

> [!tip] Related Terms
> [[#Dual Listing]] | [[#Exchange]] | [[#Primary Market]] | [[#Depositary Receipt]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

### Primary Market

> The country or exchange jurisdiction designated as a security's home market
> for index classification purposes. The primary market drives country
> assignment, currency denomination, and eligibility for regional indices.

Primary market is closely related to primary listing but operates at the country level rather than the exchange level. A company's primary market determines whether it appears in, say, a German index or a French index within the STOXX family.

> [!tip] Related Terms
> [[#Primary Listing]] | [[#Country Classification]] | [[#Regulated Market]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

## Q

### Qontigo

> A Deutsche Borse Group company that combines the STOXX index business with
> the DAX indices and the Axioma analytics platform. Qontigo is the entity
> responsible for index design, calculation, governance, and licensing of STOXX
> and DAX index families.

Qontigo is the brand name under which STOXX indices are developed and maintained. When you read a STOXX methodology document, Qontigo is the legal entity behind it. It was formed in 2019 by merging the STOXX, DAX, and Axioma businesses within Deutsche Borse Group.

> [!tip] Related Terms
> [[#Deutsche Borse Group]] | [[#Frankfurt Stock Exchange]] | [[#Eurex]]

**Sources:** [Qontigo](https://qontigo.com/) | [Qontigo — About](https://qontigo.com/about/)

---

## R

### Regulated Market

> A multilateral trading system operated or managed by a market operator that
> meets the regulatory requirements of the jurisdiction in which it operates
> (e.g., MiFID II in Europe). STOXX requires that eligible securities be listed
> on a regulated market.

A regulated market is an exchange that operates under an official regulatory framework, providing investor protections such as disclosure requirements and fair-access rules. STOXX's insistence on regulated-market listings ensures that index constituents meet baseline transparency and governance standards.

> [!tip] Related Terms
> [[#Exchange]] | [[#Primary Listing]] | [[#Frankfurt Stock Exchange]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf) | [STOXX Rulebooks](https://stoxx.com/rulebooks)

---

### Rally

> A sustained increase in the prices of securities or a market index,
> often following a period of decline or consolidation. Rallies can be
> broad-based (affecting entire indices) or sector-specific.

A rally is a period when the market climbs with conviction. For STOXX indices, a broad rally lifts the aggregate index level and often compresses the performance dispersion among constituents. Sharp rallies can also affect index reviews if previously marginal stocks surge past capitalisation thresholds.

> [!tip] Related Terms
> [[#Bull Market]] | [[#Bear Market]] | [[#Correction]] | [[#Market Capitalization]]

**Sources:** [Qontigo — Market Insights](https://qontigo.com/insights/) | [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

## S

### Sector

> A grouping of companies that operate in the same area of the economy,
> defined by an industry classification system such as ICB. STOXX publishes
> sector indices (e.g., STOXX Europe 600 Technology) that track specific
> economic segments.

A sector is a broad economic category -- Banks, Technology, Health Care, and so on. STOXX sector indices allow investors to gain targeted exposure to one part of the economy or to analyse how different parts of the market are performing relative to each other.

> [!tip] Related Terms
> [[#Sector Classification]] | [[#Supersector]] | [[#ICB (Industry Classification Benchmark)]] | [[#GICS (Global Industry Classification Standard)]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf) | [STOXX Sector Indices](https://stoxx.com/index-families)

---

### Sector Classification

> The process of assigning each company to a specific sector, supersector,
> and subsector within an industry classification taxonomy. STOXX relies on
> ICB sector classification to build its sector index families.

Sector classification is the act of labelling a company -- deciding, for example, that a fintech firm belongs under "Financial Services" rather than "Technology." These decisions directly affect which sector index a stock appears in and can influence portfolio construction when investors use sector-based strategies.

> [!tip] Related Terms
> [[#Sector]] | [[#ICB (Industry Classification Benchmark)]] | [[#GICS (Global Industry Classification Standard)]] | [[#Supersector]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf) | [FTSE Russell ICB](https://www.ftserussell.com/data/industry-classification-benchmark-icb)

---

### Settlement

> The process by which a securities transaction is finalised: the buyer
> receives the securities and the seller receives payment. Settlement cycles
> (e.g., T+2) vary by market and can affect index rebalancing logistics.

Settlement is the back-office conclusion of a trade. When STOXX schedules an index rebalancing, it must account for the settlement cycle so that index-tracking funds can execute trades and have them settle by the effective date. In Europe, most equity markets operate on a T+2 settlement cycle.

> [!tip] Related Terms
> [[#Exchange]] | [[#Regulated Market]] | [[#Trading Volume]]

**Sources:** [Deutsche Borse Group — Clearstream](https://www.clearstream.com/) | [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

### Small-Cap

> A classification for companies in the lower tier of market capitalisation
> within an index universe, above micro-cap but below mid-cap thresholds. The
> STOXX Europe Small 200 is an example of a small-cap index.

Small-cap stocks offer exposure to smaller, often faster-growing companies. They tend to be less liquid and more volatile than large-caps. In STOXX's European index framework, the Small 200 captures companies ranked below the top 400 by free-float market capitalisation.

> [!tip] Related Terms
> [[#Micro-Cap]] | [[#Mid-Cap]] | [[#Large-Cap]] | [[#Market Capitalization]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf) | [STOXX Size Indices](https://stoxx.com/index-families)

---

### Strategic Holding

> A block of shares held by an investor (such as a founding family, government,
> or corporate cross-holder) that is not considered available for public trading.
> Strategic holdings are subtracted from total shares outstanding to calculate
> free float.

Strategic holdings are the shares that never really hit the open market. A founding family's 30% stake or a government's golden share are examples. STOXX identifies these holdings and excludes them from the free-float calculation so that index weights reflect only the genuinely tradable portion of each company.

> [!tip] Related Terms
> [[#Free Float]] | [[#Free-Float Shares]] | [[#Market Capitalization]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf) | [STOXX Free Float Data](https://stoxx.com/rulebooks)

---

### Settlement Cycle (T+2)

> The standardised time frame between the execution of a trade and its final
> settlement. T+2 means the trade settles two business days after the
> transaction date. Most major European and US equity markets operate on a
> T+2 cycle, though some markets are moving toward T+1.

The settlement cycle dictates the logistics of index rebalancing. When STOXX announces a rebalancing effective date, index-tracking funds must execute their trades early enough for settlement to complete by that date. A T+2 cycle means trades placed on the effective date would not settle until two days later, so managers typically trade on or before the effective date to align.

> [!tip] Related Terms
> [[#Settlement]] | [[#Clearing (Market)]] | [[#Custodian]] | [[#Exchange]]

**Sources:** [Deutsche Borse Group — Clearstream](https://www.clearstream.com/) | [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf) | [Eurex Clearing](https://www.eurex.com/ec-en/)

---

### Short Selling

> The practice of selling a security that the seller does not own, typically
> by borrowing shares, with the intention of buying them back later at a lower
> price. Short selling is regulated and, in some European markets, subject to
> disclosure requirements and temporary bans during periods of stress.

Short selling allows investors to profit from declining prices. While STOXX indices themselves are long-only constructs, short selling of index constituents is a critical market activity that affects price discovery and liquidity. Short-selling bans (as seen during the 2020 COVID crisis in some European markets) can distort index constituent pricing and trading volumes.

> [!tip] Related Terms
> [[#Long Position]] | [[#Stock]] | [[#Equity]] | [[#Bear Market]]

**Sources:** [STOXX Rulebooks](https://stoxx.com/rulebooks) | [Eurex Exchange](https://www.eurex.com/) | [ISS Governance](https://www.issgovernance.com/)

---

### Stock

> A type of security that represents an ownership share in a corporation.
> Stocks are the fundamental building blocks of equity indices. Each STOXX
> index constituent is an individual stock (or depositary receipt representing
> a stock) that meets the index's eligibility criteria.

Stock is the most basic unit of equity investing. When a data engineer works with STOXX index data, each row in a constituent file typically represents one stock, identified by its ISIN, SEDOL, or ticker. The stock's price, shares outstanding, and free-float factor are the core inputs to index weight calculations.

> [!tip] Related Terms
> [[#Equity]] | [[#Market Capitalization]] | [[#Free Float]] | [[#Primary Listing]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf) | [Deutsche Borse Cash Market](https://www.deutsche-boerse.com/)

---

### Supersector

> A grouping level in the ICB classification hierarchy that sits between
> Industry (the broadest level) and Sector. ICB defines 20 supersectors,
> and STOXX publishes supersector indices such as EURO STOXX Banks.

Supersectors provide a middle layer of granularity. They are broader than sectors but narrower than the top-level industry grouping. The EURO STOXX supersector indices are among the most widely followed benchmarks for European sector analysis.

> [!tip] Related Terms
> [[#Sector]] | [[#ICB (Industry Classification Benchmark)]] | [[#Sector Classification]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf) | [FTSE Russell ICB](https://www.ftserussell.com/data/industry-classification-benchmark-icb)

---

## T

### Trading Volume

> The total number of shares (or contracts) traded during a given period.
> Trading volume is a raw input to liquidity measures such as ADTV and turnover
> velocity used in STOXX index eligibility screening.

Trading volume is the simplest count of activity -- how many shares changed hands. On its own it does not tell you much about liquidity quality, but averaged over time (ADTV) or normalised by shares outstanding (turnover velocity), it becomes a powerful screening tool.

> [!tip] Related Terms
> [[#Average Daily Trading Volume (ADTV)]] | [[#Turnover Velocity]] | [[#Liquidity]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf)

---

### Tick Size

> The minimum price increment at which a security can trade on an exchange.
> Tick sizes are set by the exchange or regulator and vary by price level and
> instrument type. Smaller tick sizes allow finer price discovery but can
> reduce displayed liquidity at each price level.

Tick size determines the granularity of the order book. A stock trading at EUR 50 might have a tick size of EUR 0.01, meaning the next possible price is EUR 50.01 or EUR 49.99. For STOXX index constituents, tick size regimes affect bid-ask spreads and, indirectly, the transaction costs of replicating an index.

> [!tip] Related Terms
> [[#Bid-Ask Spread]] | [[#Order Book]] | [[#Market Maker]] | [[#Liquidity]]

**Sources:** [Deutsche Borse — Xetra Tick Sizes](https://www.deutsche-boerse.com/) | [Eurex Exchange](https://www.eurex.com/) | [STOXX Rulebooks](https://stoxx.com/rulebooks)

---

### Turnover Velocity

> The ratio of a stock's cumulative trading volume over a period to its total
> shares outstanding (or free-float shares), expressed as a percentage. STOXX
> uses turnover velocity as a liquidity measure alongside ADTV to screen
> securities for index eligibility.

Turnover velocity normalises trading volume by the size of the company. A stock that trades 1 million shares a day sounds liquid, but if it has 10 billion shares outstanding, the turnover velocity is tiny. Conversely, a stock trading 100,000 shares a day with only 1 million shares outstanding has very high turnover velocity. STOXX uses this ratio to ensure that constituent stocks are liquid relative to their size.

> [!tip] Related Terms
> [[#Average Daily Trading Volume (ADTV)]] | [[#Trading Volume]] | [[#Liquidity Screening]] | [[#Free-Float Shares]]

**Sources:** [STOXX Index Methodology Guide](https://stoxx.com/document/Indices/Common/Indexguide/stoxx_index_guide.pdf) | [STOXX Rulebooks](https://stoxx.com/rulebooks)

---

## V

### Volatility Halt

> An automatic, short-duration trading pause triggered when a security's price
> moves beyond a dynamic or static price corridor within a defined time window.
> Volatility halts (also called volatility interruptions on Xetra) are a form
> of circuit breaker applied at the individual security level.

A volatility halt is the exchange saying "slow down" when a stock price is moving too fast. On Xetra, the exchange calculates dynamic and static price ranges; if an incoming order would execute outside those ranges, trading pauses and an intraday auction is triggered. For STOXX index calculations, the last price before the halt is typically used until continuous trading resumes.

> [!tip] Related Terms
> [[#Circuit Breaker]] | [[#Halt (Trading)]] | [[#Crash]] | [[#Exchange]]

**Sources:** [Deutsche Borse — Volatility Interruptions](https://www.deutsche-boerse.com/) | [Eurex Exchange — Risk Management](https://www.eurex.com/ex-en/trade) | [STOXX Rulebooks](https://stoxx.com/rulebooks)

---

> [!info] Maintenance
> This glossary is maintained as part of the ISS-STOXX financial domain
> knowledge base. Terms are aligned with STOXX and ISS official documentation
> as of 2026-03-28. For updates, consult the latest
> [STOXX Rulebooks](https://stoxx.com/rulebooks) and
> [ISS Governance QualityScore documentation](https://www.issgovernance.com/).
