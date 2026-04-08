---
title: "Data Sources and Refresh"
type: reference
category: financial-domain
technology: [yfinance, python, sql-server, airflow]
tags: [python, sql, airflow, financial]
aliases: [Data Sources and Refresh, yfinance data sources, data refresh, pipeline schedule, yfinance data pipeline]
keywords: [data sources, refresh cadence, yfinance, pipeline schedule, price data, volume, market cap, forward PE, analyst target, recommendation, dividend yield, quarterly financials, governance, ticker membership, pulse, intraday]
description: "Data sources, refresh cadences, and pipeline schedule for the financial data platform dashboard — yfinance data feeds, update frequencies, and the relationship between data freshness and scoring accuracy."
parent: "[[domain-metrics-and-scoring]]"
links:
  - "[[chart-metrics]]"
  - "[[daily-signal-scores]]"
  - "[[factor-profile-and-composition]]"
  - "[[index-snapshot-metrics]]"
  - "[[quarterly-signal-scores]]"
  - "[[scoring-methodology]]"
  - "[[vendor-file-late-or-missing]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Data Sources and Refresh

All data for the the project architecture dashboard flows through the [medallion pipeline](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/medallion-architecture) from yfinance API to the gold layer. This note documents every data source, its refresh cadence, and the pipeline schedule.

## Data Sources

| Data | Source | Refresh |
|------|--------|---------|
| Price, volume, market cap | yfinance (via daily pipeline) | 3×/day (09:00, 17:00, 22:00 UTC) |
| Forward P/E, P/B, EV/EBITDA | yfinance `info` dict | Daily with signals |
| Analyst target, recommendation | yfinance `info` dict | Daily with signals |
| Dividend yield, beta | yfinance `info` dict | Daily with signals |
| Quarterly financials | yfinance quarterly data | When new quarter reported |
| Governance risk scores | yfinance quarterly data | When new quarter reported |
| Ticker membership | Index composition reference data | Hourly refresh |
| Pulse (intraday price) | yfinance | Every 5 minutes |

## Pipeline Schedule

The [Airflow DAGs](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-dag-patterns) orchestrate three daily pipeline runs timed to capture market closes across global regions:

| Run Time (UTC) | Purpose | Markets Captured |
|----------------|---------|-----------------|
| 09:00 | Morning run | Asia/Pacific index close |
| 17:00 | Afternoon run | European equity index close |
| 22:00 | Evening run | US equity index close |

> [!info] Why Three Runs
> The three tracked indices — a European equity index, an Asia-Pacific equity index, and a US equity index — close at different times across different time zones. Running the pipeline three times per day ensures each index's closing prices are captured promptly. See [date-and-time-handling](https://alp78.github.io/elysium/01-Shell/Text-Processing/date-and-time-handling) for timezone management in the pipeline.

## Data Flow

```
yfinance API → JSON files → Bronze (raw) → Silver (cleaned) → Gold (scored) → Dashboard
```

1. **[Bronze](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/bronze-layer-loading)**: Raw yfinance data lands as-is in `bronze.*` tables — when a vendor file is late or missing, follow the [[vendor-file-late-or-missing]] runbook
2. **[Silver](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/silver-transforms)**: Deduplication, type casting, gap-filling in `silver.*` tables
3. **[Gold](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/gold-transforms)**: Z-scores, composite scores, rankings in `gold.*` tables

## Refresh Impact on Scoring

| Data Type | Staleness Tolerance | Impact of Stale Data |
|-----------|--------------------|--------------------|
| Price/volume | Minutes | [Momentum scores](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/daily-signal-scores) lag, intraday pulse stale |
| Analyst consensus | Hours | [Sentiment scores](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/daily-signal-scores) slightly off |
| Quarterly financials | Days | [Quality scores](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/quarterly-signal-scores) use prior quarter |
| Governance scores | Weeks | Slow-moving, minimal impact |
| Index composition | Hours | Wrong constituents if not refreshed |

## Related

- the pipeline steps — Detailed pipeline execution stages
- the Airflow DAGs — DAG scheduling and configuration
- [bronze-layer-loading](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/bronze-layer-loading) — How raw data enters the pipeline
- [medallion-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/medallion-architecture) — Three-layer data architecture
- [index-snapshot-metrics](https://alp78.github.io/elysium/18-Financial-Domain/Metrics-and-Scoring/index-snapshot-metrics) — Cap-weighted metrics computed from this data

