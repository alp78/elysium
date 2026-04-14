---
title: "02 - STOXX Index Pipeline Source Files"
tags: [gcp, pipeline, airflow, sql-server, cloud-run, bigquery, firestore, eventarc]
aliases: [STOXX GCP Pipeline Source Files, STOXX Index Pipeline Source Files]
description: "Embedded scripts, SQL files, payload samples, and helper files referenced by the STOXX index pipeline note."
created: 2026-04-14
updated: 2026-04-14
status: complete
parent: "[[domain-compute-and-messaging]]"
links:
  - "[[01-stoxx-index-pipeline]]"
---

# STOXX Index Pipeline Source Files

The source bundle referenced by [[01-stoxx-index-pipeline]] preserves the exact scripts, SQL files, payload samples, and helper files used during the validated pipeline run on **2026-04-13**. Keeping those artifacts here leaves the main pipeline note focused on architecture, deployment boundaries, and validation flow.

## Embedded source files

The blocks below preserve the deployed and validated artifacts grouped by runtime layer. Keep this note paired with [[01-stoxx-index-pipeline]] when auditing the pipeline end to end.

### Fetch layer

> [!example]- `fetch_stage.py`
>
> *Fetches yfinance index data, serializes stage payloads, and writes the manifest consumed by the bronze loader.*
> ```python
> from __future__ import annotations
>
> import argparse
> import concurrent.futures
> import json
> import logging
> import os
> import time
> from datetime import datetime, timedelta, timezone
> from pathlib import Path
> from typing import Any
> from zoneinfo import ZoneInfo
>
> from google.cloud import storage
> import yfinance as yf
>
>
> LOGGER = logging.getLogger("stoxx-stage-fetch")
> DEFINITIONS_DIR = Path(__file__).resolve().parent / "definitions"
> CET = ZoneInfo("Europe/Paris")
>
>
> def configure_logging() -> None:
>     logging.basicConfig(
>         level=os.environ.get("LOG_LEVEL", "INFO").upper(),
>         format="%(asctime)s %(levelname)s %(name)s %(message)s",
>     )
>
>
> def utc_now() -> datetime:
>     return datetime.now(timezone.utc)
>
>
> def cet_now_str(fmt: str = "%Y-%m-%d %H:%M:%S") -> str:
>     return datetime.now(CET).strftime(fmt)
>
>
> def format_epoch(epoch_val: Any, is_ms: bool = False) -> str | None:
>     if epoch_val is None:
>         return None
>     try:
>         seconds = float(epoch_val) / 1000.0 if is_ms else float(epoch_val)
>         return (datetime(1970, 1, 1) + timedelta(seconds=seconds)).strftime("%Y-%m-%d")
>     except Exception:
>         return None
>
>
> def clean_company_name(raw_name: Any) -> str | None:
>     if not raw_name:
>         return None
>     return " ".join(str(raw_name).split()).strip()
>
>
> def load_indices() -> list[dict[str, Any]]:
>     indices: list[dict[str, Any]] = []
>     for definition_file in sorted(DEFINITIONS_DIR.glob("*.json")):
>         with definition_file.open("r", encoding="utf-8") as handle:
>             definition = json.load(handle)
>         key = definition_file.stem
>         indices.append(
>             {
>                 "key": key,
>                 "name": definition["name"],
>                 "file_prefix": definition.get("file_prefix", key.replace("_", "")),
>                 "history_start": definition.get("history_start", "2021-01-01"),
>                 "symbols": definition["symbols"],
>             }
>         )
>     return indices
>
>
> def fetch_info(symbol: str, retries: int) -> dict[str, Any]:
>     for attempt in range(1, retries + 1):
>         try:
>             return dict(yf.Ticker(symbol).info or {})
>         except Exception as exc:
>             if attempt == retries:
>                 raise RuntimeError(f"info fetch failed for {symbol}: {exc}") from exc
>             sleep_seconds = min(2**attempt, 8)
>             LOGGER.warning("Retrying info fetch for %s in %ss: %s", symbol, sleep_seconds, exc)
>             time.sleep(sleep_seconds)
>     return {}
>
>
> def fetch_history(symbol: str, lookback_days: int, retries: int) -> list[dict[str, Any]]:
>     for attempt in range(1, retries + 1):
>         try:
>             frame = yf.Ticker(symbol).history(
>                 period=f"{lookback_days}d",
>                 interval="1d",
>                 auto_adjust=False,
>                 actions=True,
>             )
>             if frame.empty:
>                 return []
>             frame = frame.reset_index()
>             if "Date" not in frame.columns:
>                 return []
>             frame = frame.dropna(subset=["Open", "High", "Low", "Close"], how="all")
>             records: list[dict[str, Any]] = []
>             for _, row in frame.iterrows():
>                 raw_close = row["Close"]
>                 adj_close = row.get("Adj Close", raw_close)
>                 if raw_close is None:
>                     continue
>                 date_value = row["Date"]
>                 if hasattr(date_value, "tz_localize"):
>                     try:
>                         date_value = date_value.tz_localize(None)
>                     except TypeError:
>                         pass
>                 records.append(
>                     {
>                         "symbol": symbol,
>                         "date": pd_timestamp_to_date(date_value),
>                         "open": to_float(row.get("Open")),
>                         "high": to_float(row.get("High")),
>                         "low": to_float(row.get("Low")),
>                         "close": to_float(raw_close),
>                         "adj_close": to_float(adj_close),
>                         "volume": to_int(row.get("Volume")),
>                         "dividends": to_float(row.get("Dividends"), 0.0),
>                         "stock_splits": to_float(row.get("Stock Splits"), 0.0),
>                     }
>                 )
>             return records
>         except Exception as exc:
>             if attempt == retries:
>                 raise RuntimeError(f"history fetch failed for {symbol}: {exc}") from exc
>             sleep_seconds = min(2**attempt, 8)
>             LOGGER.warning("Retrying history fetch for %s in %ss: %s", symbol, sleep_seconds, exc)
>             time.sleep(sleep_seconds)
>     return []
>
>
> def pd_timestamp_to_date(value: Any) -> str:
>     if hasattr(value, "to_pydatetime"):
>         value = value.to_pydatetime()
>     if isinstance(value, datetime):
>         return value.date().isoformat()
>     return str(value)[:10]
>
>
> def to_float(value: Any, default: float | None = None) -> float | None:
>     if value is None:
>         return default
>     try:
>         return round(float(value), 4)
>     except Exception:
>         return default
>
>
> def to_int(value: Any, default: int | None = 0) -> int | None:
>     if value is None:
>         return default
>     try:
>         return int(value)
>     except Exception:
>         return default
>
>
> def build_index_dim(symbol: str, info: dict[str, Any], history_start: str) -> dict[str, Any]:
>     return {
>         "symbol": symbol,
>         "longName": clean_company_name(info.get("longName")),
>         "shortName": clean_company_name(info.get("shortName")),
>         "sector": info.get("sector"),
>         "sectorKey": info.get("sectorKey"),
>         "industry": info.get("industry"),
>         "industryKey": info.get("industryKey"),
>         "country": info.get("country"),
>         "city": info.get("city"),
>         "website": info.get("website"),
>         "longBusinessSummary": info.get("longBusinessSummary"),
>         "exchange": info.get("exchange"),
>         "fullExchangeName": info.get("fullExchangeName"),
>         "exchangeTimezoneName": info.get("exchangeTimezoneName"),
>         "exchangeTimezoneShortName": info.get("exchangeTimezoneShortName"),
>         "currency": info.get("currency"),
>         "financialCurrency": info.get("financialCurrency"),
>         "quoteType": info.get("quoteType"),
>         "market": info.get("market"),
>         "_range_start": format_epoch(info.get("firstTradeDateMilliseconds"), is_ms=True),
>         "_price_data_start": history_start,
>     }
>
>
> def build_daily_signal(symbol: str, info: dict[str, Any]) -> dict[str, Any]:
>     current_price = info.get("currentPrice")
>     high_52w = info.get("fiftyTwoWeekHigh")
>     target_price = info.get("targetMedianPrice")
>     dividend_yield = info.get("dividendYield")
>     if dividend_yield is not None and dividend_yield > 0.20:
>         dividend_yield = dividend_yield / 100
>     return {
>         "symbol": symbol,
>         "timestamp": cet_now_str(),
>         "price_metrics": {
>             "currentPrice": current_price,
>             "forwardPE": info.get("forwardPE"),
>             "priceToBook": info.get("priceToBook"),
>             "evToEbitda": info.get("enterpriseToEbitda"),
>             "dividendYield": dividend_yield,
>             "marketCap": info.get("marketCap"),
>             "beta": info.get("beta"),
>         },
>         "market_context": {
>             "fiftyTwoWeekChange": info.get("52WeekChange"),
>             "SandP52WeekChange": info.get("SandP52WeekChange"),
>         },
>         "momentum_signals": {
>             "fiftyDayAverage": info.get("fiftyDayAverage"),
>             "twoHundredDayAverage": info.get("twoHundredDayAverage"),
>             "distFrom52WeekHigh": (1 - (current_price / high_52w)) if (current_price is not None and high_52w) else None,
>         },
>         "sentiment_signals": {
>             "targetMedianPrice": target_price,
>             "recommendationMean": info.get("recommendationMean"),
>             "upsidePotential": (target_price / current_price - 1) if (current_price and target_price is not None) else None,
>         },
>     }
>
>
> def build_quarterly_signal(symbol: str, info: dict[str, Any]) -> dict[str, Any]:
>     return {
>         "symbol": symbol,
>         "as_of_date": cet_now_str("%Y-%m-%d"),
>         "quality_metrics": {
>             "grossMargins": info.get("grossMargins"),
>             "operatingMargins": info.get("operatingMargins"),
>             "returnOnEquity": info.get("returnOnEquity"),
>             "revenueGrowth": info.get("revenueGrowth"),
>             "earningsGrowth": info.get("earningsGrowth"),
>         },
>         "capital_structure": {
>             "sharesOutstanding": info.get("sharesOutstanding"),
>             "floatShares": info.get("floatShares") if info.get("floatShares") is not None else info.get("sharesOutstanding"),
>             "debtToEquity": info.get("debtToEquity"),
>             "currentRatio": info.get("currentRatio"),
>             "freeCashflow": info.get("freeCashflow"),
>         },
>         "fiscal_calendar": {
>             "_last_fiscal_year_end": format_epoch(info.get("lastFiscalYearEnd")),
>             "_most_recent_quarter": format_epoch(info.get("mostRecentQuarter")),
>         },
>         "governance": {
>             "overallRisk": info.get("overallRisk"),
>             "auditRisk": info.get("auditRisk"),
>             "boardRisk": info.get("boardRisk"),
>             "compensationRisk": info.get("compensationRisk"),
>             "shareHolderRightsRisk": info.get("shareHolderRightsRisk"),
>             "esgPopulated": info.get("overallRisk") is not None,
>         },
>     }
>
>
> def build_activity_scores(symbols: list[str], info_cache: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
>     scored: list[dict[str, Any]] = []
>     for symbol in symbols:
>         info = info_cache.get(symbol, {})
>         last_vol = info.get("volume")
>         avg_vol = info.get("averageDailyVolume10Day")
>         day_high = info.get("regularMarketDayHigh")
>         day_low = info.get("regularMarketDayLow")
>         prev_close = info.get("regularMarketPreviousClose")
>
>         vol_surge = (last_vol / avg_vol) if (last_vol is not None and avg_vol) else 0.0
>         range_intensity = ((day_high - day_low) / prev_close) if (day_high is not None and day_low is not None and prev_close) else 0.0
>         scored.append(
>             {
>                 "symbol": symbol,
>                 "volumeSurge": round(vol_surge, 4),
>                 "rangeIntensity": round(range_intensity, 4),
>             }
>         )
>
>     if not scored:
>         return []
>
>     def z_scores(values: list[float]) -> list[float]:
>         mean = sum(values) / len(values)
>         variance = sum((value - mean) ** 2 for value in values) / len(values)
>         std_dev = variance ** 0.5
>         if std_dev == 0:
>             return [0.0 for _ in values]
>         return [(value - mean) / std_dev for value in values]
>
>     vol_z = z_scores([item["volumeSurge"] for item in scored])
>     rng_z = z_scores([item["rangeIntensity"] for item in scored])
>     for idx, item in enumerate(scored):
>         item["volZ"] = round(vol_z[idx], 4)
>         item["rngZ"] = round(rng_z[idx], 4)
>         item["activityScore"] = round(0.5 * vol_z[idx] + 0.5 * rng_z[idx], 4)
>     return sorted(scored, key=lambda item: item["activityScore"], reverse=True)
>
>
> def build_pulse(symbol: str, info: dict[str, Any]) -> dict[str, Any]:
>     current_price = info.get("currentPrice")
>     prev_close = info.get("regularMarketPreviousClose")
>     bid = info.get("bid")
>     ask = info.get("ask")
>     volume = info.get("volume")
>     avg_volume = info.get("averageDailyVolume10Day")
>     return {
>         "symbol": symbol,
>         "timestamp": cet_now_str(),
>         "price": {
>             "current": current_price,
>             "open": info.get("regularMarketOpen"),
>             "dayHigh": info.get("regularMarketDayHigh"),
>             "dayLow": info.get("regularMarketDayLow"),
>             "previousClose": prev_close,
>             "change": round(current_price - prev_close, 4) if (current_price is not None and prev_close is not None) else None,
>             "changePct": round((current_price / prev_close - 1) * 100, 4) if (current_price is not None and prev_close) else None,
>         },
>         "book": {
>             "bid": bid,
>             "ask": ask,
>             "bidSize": info.get("bidSize"),
>             "askSize": info.get("askSize"),
>             "spread": round(ask - bid, 4) if (ask is not None and bid is not None) else None,
>         },
>         "volume": {
>             "current": volume,
>             "average10Day": avg_volume,
>             "ratio": round(volume / avg_volume, 4) if (volume is not None and avg_volume) else None,
>         },
>     }
>
>
> def prefix_path(gcs_prefix: str, relative_path: str) -> str:
>     if not gcs_prefix:
>         return relative_path
>     return f"{gcs_prefix.strip('/')}/{relative_path}"
>
>
> def upload_json(bucket: storage.Bucket, object_name: str, payload: Any, metadata: dict[str, str]) -> int:
>     body = json.dumps(payload, indent=4, ensure_ascii=False).encode("utf-8")
>     blob = bucket.blob(object_name)
>     blob.metadata = metadata
>     blob.upload_from_string(body, content_type="application/json")
>     LOGGER.info("Uploaded gs://%s/%s (%s bytes)", bucket.name, object_name, len(body))
>     return len(body)
>
>
> def run(args: argparse.Namespace) -> dict[str, Any]:
>     indices = load_indices()
>     all_symbols = sorted({symbol for index in indices for symbol in index["symbols"]})
>     LOGGER.info("Loaded %s indices and %s unique symbols", len(indices), len(all_symbols))
>
>     info_cache: dict[str, dict[str, Any]] = {}
>     history_cache: dict[str, list[dict[str, Any]]] = {}
>     errors: list[str] = []
>
>     with concurrent.futures.ThreadPoolExecutor(max_workers=args.info_workers) as executor:
>         futures = {executor.submit(fetch_info, symbol, args.retries): symbol for symbol in all_symbols}
>         for future in concurrent.futures.as_completed(futures):
>             symbol = futures[future]
>             try:
>                 info_cache[symbol] = future.result()
>             except Exception as exc:
>                 errors.append(str(exc))
>                 LOGGER.error("Info fetch failed for %s: %s", symbol, exc)
>                 info_cache[symbol] = {}
>
>     with concurrent.futures.ThreadPoolExecutor(max_workers=args.history_workers) as executor:
>         futures = {
>             executor.submit(fetch_history, symbol, args.lookback_days, args.retries): symbol
>             for symbol in all_symbols
>         }
>         for future in concurrent.futures.as_completed(futures):
>             symbol = futures[future]
>             try:
>                 history_cache[symbol] = future.result()
>             except Exception as exc:
>                 errors.append(str(exc))
>                 LOGGER.error("History fetch failed for %s: %s", symbol, exc)
>                 history_cache[symbol] = []
>
>     storage_client = storage.Client(project=args.project_id)
>     bucket = storage_client.bucket(args.bucket)
>     run_timestamp = utc_now().strftime("%Y%m%dT%H%M%SZ")
>     generated_at = utc_now().strftime("%Y-%m-%dT%H:%M:%SZ")
>
>     objects: list[dict[str, Any]] = []
>
>     for index in indices:
>         key = index["key"]
>         prefix = index["file_prefix"]
>         symbols = index["symbols"]
>
>         dim_payload = [build_index_dim(symbol, info_cache.get(symbol, {}), index["history_start"]) for symbol in symbols]
>         daily_payload = [build_daily_signal(symbol, info_cache.get(symbol, {})) for symbol in symbols]
>         quarterly_payload = [build_quarterly_signal(symbol, info_cache.get(symbol, {})) for symbol in symbols]
>         ohlcv_payload = [record for symbol in symbols for record in history_cache.get(symbol, [])]
>
>         ranked = build_activity_scores(symbols, info_cache)
>         top_ten = ranked[:10]
>         tickers_payload = {
>             "discovered_at": cet_now_str(),
>             "symbols": [item["symbol"] for item in top_ten],
>             "ranking": top_ten,
>         }
>         pulse_payload = [build_pulse(symbol, info_cache.get(symbol, {})) for symbol in tickers_payload["symbols"]]
>
>         payloads = [
>             (f"dimensions/{prefix}_dim.json", dim_payload, "index_dim"),
>             (f"stage/{prefix}_ohlcv.json", ohlcv_payload, f"{prefix}_ohlcv"),
>             (f"stage/{prefix}_signals_daily.json", daily_payload, "signals_daily"),
>             (f"stage/{prefix}_signals_quarterly.json", quarterly_payload, "signals_quarterly"),
>             (f"pulse/{prefix}_tickers.json", tickers_payload, "pulse_tickers"),
>             (f"pulse/{prefix}_pulse.json", pulse_payload, "pulse"),
>         ]
>
>         for relative_name, payload, bronze_table in payloads:
>             object_name = prefix_path(args.gcs_prefix, relative_name)
>             size_bytes = upload_json(
>                 bucket,
>                 object_name,
>                 payload,
>                 metadata={
>                     "source": "yfinance",
>                     "index_key": key,
>                     "bronze_table": bronze_table,
>                     "generated_at": generated_at,
>                 },
>             )
>             objects.append(
>                 {
>                     "index_key": key,
>                     "bronze_table": bronze_table,
>                     "object_name": object_name,
>                     "records": len(payload) if isinstance(payload, list) else len(payload.get("symbols", [])),
>                     "size_bytes": size_bytes,
>                 }
>             )
>
>     manifest = {
>         "job_name": args.job_name,
>         "generated_at": generated_at,
>         "bucket": args.bucket,
>         "project_id": args.project_id,
>         "gcs_prefix": args.gcs_prefix,
>         "lookback_days": args.lookback_days,
>         "index_count": len(indices),
>         "symbol_count": len(all_symbols),
>         "objects": objects,
>         "errors": errors,
>     }
>
>     latest_name = prefix_path(args.gcs_prefix, "manifests/stoxx-stage-fetch/latest.json")
>     dated_name = prefix_path(args.gcs_prefix, f"manifests/stoxx-stage-fetch/{run_timestamp}.json")
>     latest_size = upload_json(
>         bucket,
>         latest_name,
>         manifest,
>         metadata={"source": "yfinance", "job_name": args.job_name, "generated_at": generated_at},
>     )
>     dated_size = upload_json(
>         bucket,
>         dated_name,
>         manifest,
>         metadata={"source": "yfinance", "job_name": args.job_name, "generated_at": generated_at},
>     )
>     objects.extend(
>         [
>             {"index_key": "manifest", "bronze_table": "manifest", "object_name": latest_name, "records": len(objects), "size_bytes": latest_size},
>             {"index_key": "manifest", "bronze_table": "manifest", "object_name": dated_name, "records": len(objects), "size_bytes": dated_size},
>         ]
>     )
>
>     if not any(item["bronze_table"].endswith("_ohlcv") and item["records"] > 0 for item in objects):
>         raise RuntimeError("No OHLCV records were staged to GCS")
>     return manifest
>
>
> def parse_args() -> argparse.Namespace:
>     parser = argparse.ArgumentParser(description="Fetch STOXX bronze-stage JSON from yfinance into GCS")
>     parser.add_argument("--bucket", default=os.environ.get("STAGE_BUCKET", "stoxx-stage-bucket"))
>     parser.add_argument("--project-id", default=os.environ.get("GCP_PROJECT_ID"))
>     parser.add_argument("--gcs-prefix", default=os.environ.get("GCS_PREFIX", ""))
>     parser.add_argument("--lookback-days", type=int, default=int(os.environ.get("OHLCV_LOOKBACK_DAYS", "10")))
>     parser.add_argument("--info-workers", type=int, default=int(os.environ.get("INFO_WORKERS", "8")))
>     parser.add_argument("--history-workers", type=int, default=int(os.environ.get("HISTORY_WORKERS", "6")))
>     parser.add_argument("--retries", type=int, default=int(os.environ.get("YF_RETRIES", "3")))
>     parser.add_argument("--job-name", default=os.environ.get("JOB_NAME", "stoxx-stage-fetch"))
>     return parser.parse_args()
>
>
> if __name__ == "__main__":
>     configure_logging()
>     arguments = parse_args()
>     if not arguments.project_id:
>         raise SystemExit("GCP_PROJECT_ID or --project-id is required")
>     result = run(arguments)
>     print(json.dumps(result, indent=2, ensure_ascii=False))
> ```

> [!example]- `euro_stoxx_50.json`
>
> *Defines the Euro STOXX 50 source universe, display metadata, and historical lookback.*
> ```json
> {
>     "name": "Euro Stoxx 50",
>     "color": "#4285F4",
>     "currency": "€",
>     "symbols": [
>         "ASML.AS", "MC.PA", "RMS.PA", "OR.PA", "SAP.DE", "SIE.DE", "ITX.MC",
>         "DTE.DE", "SAN.MC", "SU.PA", "ALV.DE", "AIR.PA", "TTE.PA", "ENR.DE",
>         "SAF.PA", "IBE.MC", "ABI.BR", "BBVA.MC", "UCG.MI", "BNP.PA", "EL.PA",
>         "AI.PA", "ENEL.MI", "ISP.MI", "SAN.PA", "PRX.AS", "CS.PA", "DG.PA",
>         "RHM.DE", "MUV2.DE", "INGA.AS", "IFX.DE", "ENI.MI", "DHL.DE",
>         "RACE.MI", "NDA-FI.HE", "BMW.DE", "MBG.DE", "VOW.DE", "BN.PA",
>         "BAS.DE", "SGO.PA", "DB1.DE", "BAYN.DE", "ARGX.BR", "AD.AS",
>         "ADYEN.AS", "ADS.DE", "WKL.AS", "DSY.PA"
>     ],
>     "history_start": "2021-01-01"
> }
> ```

> [!example]- `stoxx_asia_50.json`
>
> *Defines the STOXX Asia/Pacific 50 source universe, display metadata, and historical lookback.*
> ```json
> {
>     "name": "STOXX Asia/Pacific 50",
>     "color": "#EF5350",
>     "currency": "",
>     "symbols": [
>         "7203.T", "BHP.AX", "6758.T", "1299.HK", "CBA.AX", "6861.T",
>         "CSL.AX", "8306.T", "8058.T", "9432.T", "4063.T", "4568.T",
>         "9983.T", "8031.T", "6367.T", "6501.T", "8001.T", "8316.T",
>         "NAB.AX", "6098.T", "7974.T", "4502.T", "WBC.AX", "8035.T",
>         "7267.T", "9984.T", "8766.T", "0388.HK", "ANZ.AX", "9433.T",
>         "WDS.AX", "MQG.AX", "4661.T", "7741.T", "D05.SI", "WES.AX",
>         "8411.T", "6981.T", "6954.T", "3382.T", "6273.T", "TLS.AX",
>         "WOW.AX", "6594.T", "RIO.AX", "4503.T", "9022.T", "6702.T",
>         "2269.HK", "1810.HK"
>     ],
>     "history_start": "2021-01-01"
> }
> ```

> [!example]- `stoxx_usa_50.json`
>
> *Defines the STOXX USA 50 source universe, display metadata, and historical lookback.*
> ```json
> {
>     "name": "STOXX USA 50",
>     "color": "#FFFFFF",
>     "currency": "$",
>     "symbols": [
>         "NVDA", "AAPL", "GOOGL", "MSFT", "AMZN", "META", "AVGO",
>         "TSLA", "BRK-B", "WMT", "LLY", "JPM", "XOM", "V", "JNJ", "MU",
>         "MA", "COST", "ORCL", "ABBV", "NFLX", "PG", "HD", "CVX", "BAC",
>         "GE", "KO", "CAT", "PLTR", "AMD", "CSCO", "MRK", "AMAT", "LRCX",
>         "PM", "RTX", "UNH", "MS", "GS", "WFC", "MCD", "TMUS", "LIN",
>         "PEP", "INTC", "IBM", "AXP", "VZ", "CRM", "UBER"
>     ],
>     "history_start": "2021-01-01"
> }
> ```

### Bronze load and SQL setup

> [!example]- `load_stage.py`
>
> *Loads staged GCS JSON into SQL bronze tables with per-entity merge and reload rules.*
> ```python
> from __future__ import annotations
>
> import argparse
> import json
> import logging
> import math
> import os
> from dataclasses import dataclass
> from datetime import datetime, timezone
> from typing import Any
>
> from google.cloud import storage
> import pyodbc
>
>
> LOGGER = logging.getLogger("stoxx-bronze-load")
> DEFAULT_MANIFEST_URI = "gs://stoxx-stage-bucket/manifests/stoxx-stage-fetch/latest.json"
>
>
> @dataclass(frozen=True)
> class ManifestObject:
>     index_key: str
>     bronze_table: str
>     object_name: str
>     records: int
>     size_bytes: int
>
>
> def configure_logging() -> None:
>     logging.basicConfig(
>         level=os.environ.get("LOG_LEVEL", "INFO").upper(),
>         format="%(asctime)s %(levelname)s %(name)s %(message)s",
>     )
>
>
> def utc_now_iso() -> str:
>     return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
>
>
> def parse_gs_uri(uri: str) -> tuple[str, str]:
>     if not uri.startswith("gs://"):
>         raise ValueError(f"Expected gs:// URI, got: {uri}")
>     remainder = uri[5:]
>     bucket, _, blob = remainder.partition("/")
>     if not bucket or not blob:
>         raise ValueError(f"Invalid gs:// URI: {uri}")
>     return bucket, blob
>
>
> def get_storage_client(project_id: str | None) -> storage.Client:
>     return storage.Client(project=project_id or None)
>
>
> def get_db_connection() -> pyodbc.Connection:
>     host = os.environ["SQL_HOST"]
>     port = os.environ.get("SQL_PORT", "1433")
>     database = os.environ.get("SQL_DATABASE", "stoxx")
>     user = os.environ["SQL_USER"]
>     password = os.environ["SQL_PASSWORD"]
>     driver = os.environ.get("SQL_DRIVER", "ODBC Driver 18 for SQL Server")
>
>     conn_str = (
>         f"DRIVER={{{driver}}};"
>         f"SERVER={host},{port};"
>         f"DATABASE={database};"
>         f"UID={user};"
>         f"PWD={password};"
>         "Encrypt=yes;"
>         "TrustServerCertificate=yes;"
>     )
>     return pyodbc.connect(conn_str, autocommit=False)
>
>
> def download_json(client: storage.Client, bucket_name: str, blob_name: str) -> Any:
>     blob = client.bucket(bucket_name).blob(blob_name)
>     return json.loads(blob.download_as_text())
>
>
> def to_float(value: Any) -> float | None:
>     if value is None or value == "":
>         return None
>     number = float(value)
>     if math.isnan(number) or math.isinf(number):
>         return None
>     return number
>
>
> def to_int(value: Any) -> int | None:
>     if value is None or value == "":
>         return None
>     number = float(value)
>     if math.isnan(number) or math.isinf(number):
>         return None
>     return int(number)
>
>
> def get_index_prefixes() -> dict[str, str]:
>     return {
>         "euro_stoxx_50": "eurostoxx50",
>         "stoxx_usa_50": "stoxxusa50",
>         "stoxx_asia_50": "stoxxasia50",
>     }
>
>
> def bronze_ohlcv_table(index_key: str) -> str:
>     prefixes = get_index_prefixes()
>     return f"bronze.{prefixes[index_key]}_ohlcv"
>
>
> def count_rows(cursor: pyodbc.Cursor, table: str, index_key: str | None = None) -> int:
>     if index_key is None:
>         cursor.execute(f"SELECT COUNT(*) FROM {table}")
>     else:
>         cursor.execute(f"SELECT COUNT(*) FROM {table} WHERE _index = ?", index_key)
>     return int(cursor.fetchone()[0])
>
>
> def load_index_dim(cursor: pyodbc.Cursor, index_key: str, records: list[dict[str, Any]]) -> dict[str, int]:
>     before = count_rows(cursor, "bronze.index_dim", index_key)
>     cursor.execute("DELETE FROM bronze.index_dim WHERE _index = ?", index_key)
>
>     rows: list[tuple[Any, ...]] = []
>     for rec in records:
>         symbol = rec.get("symbol")
>         if not symbol:
>             continue
>         rows.append((
>             index_key,
>             symbol,
>             rec.get("longName"),
>             rec.get("shortName"),
>             rec.get("sector"),
>             rec.get("sectorKey"),
>             rec.get("industry"),
>             rec.get("industryKey"),
>             rec.get("country"),
>             rec.get("city"),
>             rec.get("website"),
>             rec.get("longBusinessSummary"),
>             rec.get("exchange"),
>             rec.get("fullExchangeName"),
>             rec.get("exchangeTimezoneName"),
>             rec.get("exchangeTimezoneShortName"),
>             rec.get("currency"),
>             rec.get("financialCurrency"),
>             rec.get("quoteType"),
>             rec.get("market"),
>             rec.get("_range_start"),
>             rec.get("_price_data_start"),
>         ))
>
>     if rows:
>         cursor.fast_executemany = True
>         cursor.executemany(
>             """
>             INSERT INTO bronze.index_dim (
>                 _index, symbol, long_name, short_name, sector, sector_key,
>                 industry, industry_key, country, city, website,
>                 long_business_summary, exchange, full_exchange_name,
>                 exchange_timezone_name, exchange_timezone_short, currency,
>                 financial_currency, quote_type, market, range_start, price_data_start
>             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
>             """,
>             rows,
>         )
>
>     after = count_rows(cursor, "bronze.index_dim", index_key)
>     return {"before": before, "deleted": before, "inserted": len(rows), "after": after}
>
>
> def load_ohlcv(cursor: pyodbc.Cursor, index_key: str, records: list[dict[str, Any]]) -> dict[str, int]:
>     table = bronze_ohlcv_table(index_key)
>     before = count_rows(cursor, table)
>     cursor.execute(f"SELECT symbol, CONVERT(VARCHAR(10), [date], 120), ISNULL(volume, 0) FROM {table}")
>     existing = {(row[0], row[1]): row[2] for row in cursor.fetchall()}
>
>     inserts: list[tuple[Any, ...]] = []
>     updates: list[tuple[Any, ...]] = []
>     for rec in records:
>         symbol = rec.get("symbol")
>         date_value = rec.get("date")
>         if not symbol or not date_value:
>             continue
>         key = (symbol, date_value)
>         values = (
>             to_float(rec.get("open")),
>             to_float(rec.get("high")),
>             to_float(rec.get("low")),
>             to_float(rec.get("close")),
>             to_float(rec.get("adj_close")),
>             to_int(rec.get("volume")),
>             to_float(rec.get("dividends")),
>             to_float(rec.get("stock_splits")),
>         )
>
>         if key not in existing:
>             inserts.append((symbol, date_value) + values)
>         elif (existing[key] or 0) == 0 and (to_int(rec.get("volume")) or 0) > 0:
>             updates.append(values + (symbol, date_value))
>
>     if inserts:
>         cursor.fast_executemany = True
>         cursor.executemany(
>             f"""
>             INSERT INTO {table} (
>                 symbol, [date], [open], high, low, [close],
>                 adj_close, volume, dividends, stock_splits
>             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
>             """,
>             inserts,
>         )
>     if updates:
>         cursor.fast_executemany = True
>         cursor.executemany(
>             f"""
>             UPDATE {table}
>             SET [open] = ?, high = ?, low = ?, [close] = ?,
>                 adj_close = ?, volume = ?, dividends = ?, stock_splits = ?
>             WHERE symbol = ? AND [date] = ?
>             """,
>             updates,
>         )
>
>     after = count_rows(cursor, table)
>     return {"before": before, "inserted": len(inserts), "updated": len(updates), "after": after}
>
>
> def load_signals_daily(cursor: pyodbc.Cursor, index_key: str, records: list[dict[str, Any]]) -> dict[str, int]:
>     before = count_rows(cursor, "bronze.signals_daily", index_key)
>     cursor.execute("DELETE FROM bronze.signals_daily WHERE _index = ?", index_key)
>
>     rows: list[tuple[Any, ...]] = []
>     for rec in records:
>         symbol = rec.get("symbol")
>         if not symbol:
>             continue
>         pm = rec.get("price_metrics", {})
>         mc = rec.get("market_context", {})
>         ms = rec.get("momentum_signals", {})
>         ss = rec.get("sentiment_signals", {})
>         rows.append((
>             index_key,
>             symbol,
>             rec.get("timestamp"),
>             to_float(pm.get("currentPrice")),
>             to_float(pm.get("forwardPE")),
>             to_float(pm.get("priceToBook")),
>             to_float(pm.get("evToEbitda")),
>             to_float(pm.get("dividendYield")),
>             to_int(pm.get("marketCap")),
>             to_float(pm.get("beta")),
>             to_float(mc.get("fiftyTwoWeekChange")),
>             to_float(mc.get("SandP52WeekChange")),
>             to_float(ms.get("fiftyDayAverage")),
>             to_float(ms.get("twoHundredDayAverage")),
>             to_float(ms.get("distFrom52WeekHigh")),
>             to_float(ss.get("targetMedianPrice")),
>             to_float(ss.get("recommendationMean")),
>             to_float(ss.get("upsidePotential")),
>         ))
>
>     if rows:
>         cursor.fast_executemany = True
>         cursor.executemany(
>             """
>             INSERT INTO bronze.signals_daily (
>                 _index, symbol, timestamp,
>                 current_price, forward_pe, price_to_book, ev_to_ebitda,
>                 dividend_yield, market_cap, beta,
>                 fifty_two_week_change, sandp_52_week_change,
>                 fifty_day_average, two_hundred_day_average, dist_from_52_week_high,
>                 target_median_price, recommendation_mean, upside_potential
>             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
>             """,
>             rows,
>         )
>
>     after = count_rows(cursor, "bronze.signals_daily", index_key)
>     return {"before": before, "deleted": before, "inserted": len(rows), "after": after}
>
>
> def load_signals_quarterly(cursor: pyodbc.Cursor, index_key: str, records: list[dict[str, Any]]) -> dict[str, int]:
>     before = count_rows(cursor, "bronze.signals_quarterly", index_key)
>     cursor.execute("DELETE FROM bronze.signals_quarterly WHERE _index = ?", index_key)
>
>     rows: list[tuple[Any, ...]] = []
>     for rec in records:
>         symbol = rec.get("symbol")
>         if not symbol:
>             continue
>         qm = rec.get("quality_metrics", {})
>         cs = rec.get("capital_structure", {})
>         fc = rec.get("fiscal_calendar", {})
>         gov = rec.get("governance", {})
>         rows.append((
>             index_key,
>             symbol,
>             rec.get("as_of_date"),
>             to_float(qm.get("grossMargins")),
>             to_float(qm.get("operatingMargins")),
>             to_float(qm.get("returnOnEquity")),
>             to_float(qm.get("revenueGrowth")),
>             to_float(qm.get("earningsGrowth")),
>             to_int(cs.get("sharesOutstanding")),
>             to_int(cs.get("floatShares")),
>             to_float(cs.get("debtToEquity")),
>             to_float(cs.get("currentRatio")),
>             to_int(cs.get("freeCashflow")),
>             fc.get("_last_fiscal_year_end"),
>             fc.get("_most_recent_quarter"),
>             to_int(gov.get("overallRisk")),
>             to_int(gov.get("auditRisk")),
>             to_int(gov.get("boardRisk")),
>             to_int(gov.get("compensationRisk")),
>             to_int(gov.get("shareHolderRightsRisk")),
>             1 if gov.get("esgPopulated") else 0,
>         ))
>
>     if rows:
>         cursor.fast_executemany = True
>         cursor.executemany(
>             """
>             INSERT INTO bronze.signals_quarterly (
>                 _index, symbol, as_of_date,
>                 gross_margins, operating_margins, return_on_equity,
>                 revenue_growth, earnings_growth,
>                 shares_outstanding, float_shares, debt_to_equity,
>                 current_ratio, free_cashflow,
>                 last_fiscal_year_end, most_recent_quarter,
>                 overall_risk, audit_risk, board_risk,
>                 compensation_risk, shareholder_rights_risk, esg_populated
>             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
>             """,
>             rows,
>         )
>
>     after = count_rows(cursor, "bronze.signals_quarterly", index_key)
>     return {"before": before, "deleted": before, "inserted": len(rows), "after": after}
>
>
> def load_pulse_tickers(cursor: pyodbc.Cursor, index_key: str, payload: dict[str, Any]) -> dict[str, int]:
>     before = count_rows(cursor, "bronze.pulse_tickers", index_key)
>     cursor.execute("DELETE FROM bronze.pulse_tickers WHERE _index = ?", index_key)
>
>     discovered_at = payload.get("discovered_at")
>     ranking = payload.get("ranking", [])
>     rows: list[tuple[Any, ...]] = []
>     for i, item in enumerate(ranking):
>         symbol = item.get("symbol")
>         if not symbol:
>             continue
>         rows.append((
>             index_key,
>             discovered_at,
>             symbol,
>             i + 1,
>             to_float(item.get("volumeSurge")),
>             to_float(item.get("rangeIntensity")),
>             to_float(item.get("volZ")),
>             to_float(item.get("rngZ")),
>             to_float(item.get("activityScore")),
>         ))
>
>     if rows:
>         cursor.fast_executemany = True
>         cursor.executemany(
>             """
>             INSERT INTO bronze.pulse_tickers (
>                 _index, discovered_at, symbol, rank,
>                 volume_surge, range_intensity, vol_z, rng_z, activity_score
>             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
>             """,
>             rows,
>         )
>
>     after = count_rows(cursor, "bronze.pulse_tickers", index_key)
>     return {"before": before, "deleted": before, "inserted": len(rows), "after": after}
>
>
> def load_pulse(cursor: pyodbc.Cursor, index_key: str, records: list[dict[str, Any]]) -> dict[str, int]:
>     before = count_rows(cursor, "bronze.pulse", index_key)
>     cursor.execute("DELETE FROM bronze.pulse WHERE _index = ?", index_key)
>
>     rows: list[tuple[Any, ...]] = []
>     for rec in records:
>         symbol = rec.get("symbol")
>         if not symbol:
>             continue
>         price = rec.get("price", {})
>         book = rec.get("book", {})
>         volume = rec.get("volume", {})
>         rows.append((
>             index_key,
>             symbol,
>             rec.get("timestamp"),
>             to_float(price.get("current")),
>             to_float(price.get("open")),
>             to_float(price.get("dayHigh")),
>             to_float(price.get("dayLow")),
>             to_float(price.get("previousClose")),
>             to_float(price.get("change")),
>             to_float(price.get("changePct")),
>             to_float(book.get("bid")),
>             to_float(book.get("ask")),
>             to_int(book.get("bidSize")),
>             to_int(book.get("askSize")),
>             to_float(book.get("spread")),
>             to_int(volume.get("current")),
>             to_int(volume.get("average10Day")),
>             to_float(volume.get("ratio")),
>         ))
>
>     if rows:
>         cursor.fast_executemany = True
>         cursor.executemany(
>             """
>             INSERT INTO bronze.pulse (
>                 _index, symbol, timestamp,
>                 current_price, open_price, day_high, day_low,
>                 previous_close, price_change, price_change_pct,
>                 bid, ask, bid_size, ask_size, spread,
>                 current_volume, average_volume_10day, volume_ratio
>             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
>             """,
>             rows,
>         )
>
>     after = count_rows(cursor, "bronze.pulse", index_key)
>     return {"before": before, "deleted": before, "inserted": len(rows), "after": after}
>
>
> def manifest_objects(payload: dict[str, Any]) -> list[ManifestObject]:
>     return [
>         ManifestObject(
>             index_key=item["index_key"],
>             bronze_table=item["bronze_table"],
>             object_name=item["object_name"],
>             records=int(item.get("records", 0)),
>             size_bytes=int(item.get("size_bytes", 0)),
>         )
>         for item in payload.get("objects", [])
>         if item.get("index_key") != "manifest"
>     ]
>
>
> def object_rank(item: ManifestObject) -> tuple[int, str, str]:
>     order = {
>         "index_dim": 1,
>         "eurostoxx50_ohlcv": 2,
>         "stoxxusa50_ohlcv": 2,
>         "stoxxasia50_ohlcv": 2,
>         "signals_daily": 3,
>         "signals_quarterly": 4,
>         "pulse_tickers": 5,
>         "pulse": 6,
>     }
>     return order.get(item.bronze_table, 99), item.index_key, item.object_name
>
>
> def run(args: argparse.Namespace) -> dict[str, Any]:
>     manifest_bucket, manifest_blob = parse_gs_uri(args.manifest_uri)
>     storage_client = get_storage_client(args.project_id)
>     manifest = download_json(storage_client, manifest_bucket, manifest_blob)
>     objects = sorted(manifest_objects(manifest), key=object_rank)
>
>     result: dict[str, Any] = {
>         "job_name": args.job_name,
>         "started_at": utc_now_iso(),
>         "manifest_uri": args.manifest_uri,
>         "source_generated_at": manifest.get("generated_at"),
>         "database": os.environ.get("SQL_DATABASE", "stoxx"),
>         "objects_processed": [],
>         "errors": [],
>     }
>
>     conn = get_db_connection()
>     cursor = conn.cursor()
>     try:
>         for item in objects:
>             payload = download_json(storage_client, manifest_bucket, item.object_name)
>             LOGGER.info("Loading %s for %s from gs://%s/%s", item.bronze_table, item.index_key, manifest_bucket, item.object_name)
>             try:
>                 if item.bronze_table == "index_dim":
>                     stats = load_index_dim(cursor, item.index_key, payload)
>                 elif item.bronze_table.endswith("_ohlcv"):
>                     stats = load_ohlcv(cursor, item.index_key, payload)
>                 elif item.bronze_table == "signals_daily":
>                     stats = load_signals_daily(cursor, item.index_key, payload)
>                 elif item.bronze_table == "signals_quarterly":
>                     stats = load_signals_quarterly(cursor, item.index_key, payload)
>                 elif item.bronze_table == "pulse_tickers":
>                     stats = load_pulse_tickers(cursor, item.index_key, payload)
>                 elif item.bronze_table == "pulse":
>                     stats = load_pulse(cursor, item.index_key, payload)
>                 else:
>                     raise ValueError(f"Unhandled bronze_table: {item.bronze_table}")
>
>                 conn.commit()
>                 result["objects_processed"].append(
>                     {
>                         "index_key": item.index_key,
>                         "bronze_table": item.bronze_table,
>                         "object_name": item.object_name,
>                         **stats,
>                     }
>                 )
>             except Exception as exc:
>                 conn.rollback()
>                 LOGGER.exception("Failed to load %s for %s", item.bronze_table, item.index_key)
>                 result["errors"].append(
>                     {
>                         "index_key": item.index_key,
>                         "bronze_table": item.bronze_table,
>                         "object_name": item.object_name,
>                         "error": str(exc),
>                     }
>                 )
>                 if not args.continue_on_error:
>                     raise
>     finally:
>         cursor.close()
>         conn.close()
>
>     result["finished_at"] = utc_now_iso()
>     return result
>
>
> def parse_args() -> argparse.Namespace:
>     parser = argparse.ArgumentParser(description="Load STOXX bronze-stage JSON from GCS into SQL Server")
>     parser.add_argument("--manifest-uri", default=os.environ.get("MANIFEST_URI", DEFAULT_MANIFEST_URI))
>     parser.add_argument("--project-id", default=os.environ.get("GCP_PROJECT_ID"))
>     parser.add_argument("--job-name", default=os.environ.get("JOB_NAME", "stoxx-bronze-load"))
>     parser.add_argument("--continue-on-error", action="store_true")
>     return parser.parse_args()
>
>
> if __name__ == "__main__":
>     configure_logging()
>     args = parse_args()
>     summary = run(args)
>     print(json.dumps(summary, indent=2))
>     if summary["errors"]:
>         raise SystemExit(1)
> ```

> [!example]- `provision_pipeline_login.sql`
>
> *Creates or updates the `stoxx_pipeline` SQL login, database user, and bronze loader role membership.*
> ```sql
> SET NOCOUNT ON;
>
> IF NOT EXISTS (
>     SELECT 1
>     FROM sys.server_principals
>     WHERE name = N'stoxx_pipeline'
> )
> BEGIN
>     PRINT 'Creating SQL login [stoxx_pipeline]';
>     CREATE LOGIN [stoxx_pipeline]
>         WITH PASSWORD = '$(PipelinePwd)',
>              CHECK_POLICY = ON,
>              CHECK_EXPIRATION = OFF,
>              DEFAULT_DATABASE = [stoxx];
> END
> ELSE
> BEGIN
>     PRINT 'Updating password for existing login [stoxx_pipeline]';
>     ALTER LOGIN [stoxx_pipeline]
>         WITH PASSWORD = '$(PipelinePwd)',
>              CHECK_POLICY = ON,
>              CHECK_EXPIRATION = OFF,
>              DEFAULT_DATABASE = [stoxx];
> END;
> GO
>
> USE [stoxx];
> GO
>
> IF NOT EXISTS (
>     SELECT 1
>     FROM sys.database_principals
>     WHERE name = N'stoxx_pipeline'
> )
> BEGIN
>     PRINT 'Creating database user [stoxx_pipeline]';
>     CREATE USER [stoxx_pipeline] FOR LOGIN [stoxx_pipeline];
> END;
> GO
>
> IF NOT EXISTS (
>     SELECT 1
>     FROM sys.database_principals
>     WHERE name = N'bronze_loader'
> )
> BEGIN
>     PRINT 'Creating database role [bronze_loader]';
>     CREATE ROLE [bronze_loader];
> END;
> GO
>
> GRANT CONNECT TO [stoxx_pipeline];
> GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[bronze] TO [bronze_loader];
> GO
>
> IF NOT EXISTS (
>     SELECT 1
>     FROM sys.database_role_members drm
>     JOIN sys.database_principals role_p ON role_p.principal_id = drm.role_principal_id
>     JOIN sys.database_principals member_p ON member_p.principal_id = drm.member_principal_id
>     WHERE role_p.name = N'bronze_loader'
>       AND member_p.name = N'stoxx_pipeline'
> )
> BEGIN
>     PRINT 'Adding [stoxx_pipeline] to [bronze_loader]';
>     ALTER ROLE [bronze_loader] ADD MEMBER [stoxx_pipeline];
> END;
> GO
>
> SELECT
>     sp.name AS login_name,
>     sp.type_desc AS login_type,
>     sp.default_database_name
> FROM sys.server_principals sp
> WHERE sp.name = N'stoxx_pipeline';
> GO
>
> SELECT
>     dp.name AS user_name,
>     dr.name AS role_name
> FROM sys.database_principals dp
> LEFT JOIN sys.database_role_members drm
>     ON drm.member_principal_id = dp.principal_id
> LEFT JOIN sys.database_principals dr
>     ON dr.principal_id = drm.role_principal_id
> WHERE dp.name = N'stoxx_pipeline';
> GO
> ```

> [!example]- `grant_pipeline_transform_permissions.sql`
>
> *Grants the pipeline login the silver and gold permissions required by the transform job.*
> ```sql
> USE [stoxx];
> GO
>
> SET NOCOUNT ON;
>
> IF DATABASE_PRINCIPAL_ID('pipeline_transformer') IS NULL
> BEGIN
>     CREATE ROLE [pipeline_transformer];
> END;
> GO
>
> GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[silver] TO [pipeline_transformer];
> GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[gold] TO [pipeline_transformer];
> GRANT SELECT ON SCHEMA::[bronze] TO [pipeline_transformer];
> GO
>
> IF NOT EXISTS (
>     SELECT 1
>     FROM sys.database_role_members drm
>     INNER JOIN sys.database_principals r ON r.principal_id = drm.role_principal_id
>     INNER JOIN sys.database_principals m ON m.principal_id = drm.member_principal_id
>     WHERE r.name = 'pipeline_transformer'
>       AND m.name = 'stoxx_pipeline'
> )
> BEGIN
>     ALTER ROLE [pipeline_transformer] ADD MEMBER [stoxx_pipeline];
> END;
> GO
>
> SELECT
>     r.name AS role_name,
>     m.name AS member_name
> FROM sys.database_role_members drm
> INNER JOIN sys.database_principals r ON r.principal_id = drm.role_principal_id
> INNER JOIN sys.database_principals m ON m.principal_id = drm.member_principal_id
> WHERE r.name IN ('bronze_loader', 'pipeline_transformer')
> ORDER BY r.name, m.name;
> GO
> ```

### Transform layer

> [!example]- `run_pipeline.py`
>
> *Defines the operational step runner used by the transform container.*
> ```python
> """STOXX ingestion pipeline orchestrator — daily operational steps only.
>
> Runs all pipeline steps in the correct order: fetch -> load -> transform.
> Each step checks per-index preconditions and skips indices that already
> have data or whose prerequisites are missing/corrupt.
>
> Prerequisite: run setup_index.py first to create tables, fetch dims,
> and populate initial data (OHLCV history, signals, pulse).
>
> Usage:
>   python run_pipeline.py              # Run all steps
>   python run_pipeline.py --step 3     # Run only step 3
>   python run_pipeline.py --from 5     # Run steps 5 through end
> """
>
> import json
> import sys
> import argparse
> from datetime import datetime
> from pathlib import Path
> from zoneinfo import ZoneInfo
>
> sys.path.insert(0, str(Path(__file__).resolve().parent))
> sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "ingestion"))
> from config import INDICES, data_path, get_all_keys, bronze_ohlcv, silver_ohlcv
> from db import get_connection
> from logger import get_logger, log_info, log_warning, log_error, StepTimer
>
> logger = get_logger("pipeline")
>
> try:
>     from ddtrace import tracer
> except ImportError:
>     tracer = None
>
> _REBUILD_HINT = "To rebuild: python utils/drop_index.py {key} && python utils/setup_index.py {key} && python utils/run_pipeline.py"
>
>
> def _preflight():
>     """Log per-index status: set up vs not set up."""
>     conn = get_connection()
>     cursor = conn.cursor()
>
>     try:
>         cursor.execute("SELECT DISTINCT _index FROM bronze.index_dim")
>         loaded_indices = {r[0] for r in cursor.fetchall()}
>
>         for idx in INDICES:
>             key = idx["key"]
>
>             if key not in loaded_indices:
>                 log_warning(logger, f"Index: {key} [NOT SETUP] — run setup_index.py first",
>                             step="pipeline", index=key, name=idx["name"])
>                 continue
>
>             table = idx["ohlcv_table"]
>             cursor.execute(f"""
>                 SELECT COUNT(*) FROM sys.tables t
>                 JOIN sys.schemas s ON t.schema_id = s.schema_id
>                 WHERE s.name = 'bronze' AND t.name = ?
>             """, table)
>             has_table = cursor.fetchone()[0] > 0
>
>             if has_table:
>                 cursor.execute(f"SELECT COUNT(*) FROM bronze.{table}")
>                 ohlcv_count = cursor.fetchone()[0]
>             else:
>                 ohlcv_count = 0
>
>             status = "READY" if ohlcv_count > 0 else "NEW (no OHLCV data)"
>             log_info(logger, f"Index: {key} [{status}]",
>                      step="pipeline", index=key, name=idx["name"], status=status)
>     finally:
>         cursor.close()
>         conn.close()
>
>
> def _file_ok(path):
>     """Check file exists and contains valid non-empty JSON."""
>     if not path.exists():
>         return False
>     try:
>         with open(path, 'r', encoding='utf-8') as f:
>             data = json.load(f)
>         return bool(data)
>     except Exception:
>         return False
>
>
> def _skip(key, reason):
>     """Log a skipped index with rebuild instructions."""
>     log_warning(logger, f"Skipping: {reason}",
>                 step="pipeline", index=key,
>                 rebuild=_REBUILD_HINT.format(key=key))
>
>
> # ---------------------------------------------------------------------------
> # Step 0: Sync definitions (add new symbols, purge removed ones)
> # ---------------------------------------------------------------------------
>
> def step_00_sync_definitions():
>     """Sync definitions with dim JSONs and DB: fetch new symbols, purge removed ones."""
>     from transforms.sync_definitions import run
>     run()
>
>
> # ---------------------------------------------------------------------------
> # Steps 1-3: OHLCV  (smart fetch -> load -> transform + trim)
> # ---------------------------------------------------------------------------
>
> def step_01_fetch_ohlcv():
>     """Smart OHLCV fetch: detect gaps, fetch only missing data.
>     Falls back to DB for stock symbols when dim file is missing (Cloud Run)."""
>     from fetchers.fetch_ohlcv import fetch_ohlcv
>     for idx in INDICES:
>         key = idx["key"]
>         try:
>             fetch_ohlcv(key)
>         except Exception as e:
>             _skip(key, f"ohlcv fetch failed: {e}")
>
>
> def step_02_load_ohlcv():
>     """Load OHLCV JSON -> bronze (merge)."""
>     from loaders.load_ohlcv import load
>     for idx in INDICES:
>         key = idx["key"]
>         f = data_path(key, "ohlcv")
>         if not f.exists():
>             log_info(logger, "No OHLCV JSON file found — skipping bronze load for this index",
>                      step="pipeline", index=key)
>             continue
>         if not _file_ok(f):
>             _skip(key, "ohlcv file is corrupt or empty")
>             continue
>         try:
>             load(f, bronze_ohlcv(key))
>         except Exception as e:
>             _skip(key, f"ohlcv load failed: {e}")
>
>
> def step_03_transform_ohlcv():
>     """Gap-fill bronze OHLCV -> silver OHLCV, then trim bronze."""
>     from transforms.transform_ohlcv import run
>     run()
>
>
> # ---------------------------------------------------------------------------
> # Steps 4-9: Signals  (fetch -> load -> transform)
> # ---------------------------------------------------------------------------
>
> def step_04_fetch_signals_daily():
>     """Fetch daily trading signals from yfinance -> JSON."""
>     from fetchers.fetch_signals_daily import fetch_daily_signals
>     for idx in INDICES:
>         key = idx["key"]
>         try:
>             fetch_daily_signals(key, data_path(key, "signals_daily"))
>         except Exception as e:
>             _skip(key, f"signals_daily fetch failed: {e}")
>
>
> def step_05_load_signals_daily():
>     """Load daily signals JSON -> bronze."""
>     from loaders.load_signals_daily import load
>     for key in get_all_keys():
>         f = data_path(key, "signals_daily")
>         if not f.exists():
>             log_info(logger, "No daily signals JSON file — skipping bronze load for this index",
>                      step="pipeline", index=key)
>             continue
>         if not _file_ok(f):
>             _skip(key, "signals_daily file is corrupt or empty")
>             continue
>         try:
>             load(f, key)
>         except Exception as e:
>             _skip(key, f"signals_daily load failed: {e}")
>
>
> def step_06_fetch_signals_quarterly():
>     """Fetch quarterly fundamental signals from yfinance -> JSON."""
>     from fetchers.fetch_signals_quarterly import fetch_quarterly_fundamentals
>     for idx in INDICES:
>         key = idx["key"]
>         try:
>             fetch_quarterly_fundamentals(key, data_path(key, "signals_quarterly"))
>         except Exception as e:
>             _skip(key, f"signals_quarterly fetch failed: {e}")
>
>
> def step_07_load_signals_quarterly():
>     """Load quarterly signals JSON -> bronze."""
>     from loaders.load_signals_quarterly import load
>     for key in get_all_keys():
>         f = data_path(key, "signals_quarterly")
>         if not f.exists():
>             log_info(logger, "No quarterly signals JSON file — skipping bronze load for this index",
>                      step="pipeline", index=key)
>             continue
>         if not _file_ok(f):
>             _skip(key, "signals_quarterly file is corrupt or empty")
>             continue
>         try:
>             load(f, key)
>         except Exception as e:
>             _skip(key, f"signals_quarterly load failed: {e}")
>
>
> def step_08_transform_signals_daily():
>     """Upsert bronze.signals_daily -> silver.signals_daily."""
>     from transforms.transform_signals_daily import run
>     run()
>
>
> def step_09_transform_signals_quarterly():
>     """Upsert bronze.signals_quarterly -> silver.signals_quarterly."""
>     from transforms.transform_signals_quarterly import run
>     run()
>
>
> # ---------------------------------------------------------------------------
> # Steps 10-13: Pulse  (discover tickers -> load -> fetch pulse -> load)
> # ---------------------------------------------------------------------------
>
> def step_10_fetch_pulse_tickers():
>     """Discover most active tickers from yfinance -> JSON."""
>     from fetchers.fetch_pulse import discover_pulse_tickers
>     for idx in INDICES:
>         key = idx["key"]
>         try:
>             discover_pulse_tickers(key, data_path(key, "tickers"))
>         except Exception as e:
>             _skip(key, f"pulse ticker discovery failed: {e}")
>
>
> def step_11_load_pulse_tickers():
>     """Load pulse tickers JSON -> bronze."""
>     from loaders.load_pulse_tickers import load
>     for key in get_all_keys():
>         f = data_path(key, "tickers")
>         if not f.exists():
>             log_info(logger, "No tickers JSON file — skipping bronze load for this index",
>                      step="pipeline", index=key)
>             continue
>         if not _file_ok(f):
>             _skip(key, "tickers file is corrupt or empty")
>             continue
>         try:
>             load(f, key)
>         except Exception as e:
>             _skip(key, f"pulse tickers load failed: {e}")
>
>
> def step_12_fetch_pulse():
>     """Fetch real-time pulse snapshots from yfinance -> JSON.
>     Falls back to DB for ticker symbols when JSON file is missing (Cloud Run)."""
>     from fetchers.fetch_pulse import fetch_pulse
>     for idx in INDICES:
>         key = idx["key"]
>         try:
>             fetch_pulse(data_path(key, "tickers"), data_path(key, "pulse"),
>                         idx["name"], index_key=key)
>         except Exception as e:
>             _skip(key, f"pulse fetch failed: {e}")
>
>
> def step_13_load_pulse():
>     """Load pulse JSON -> bronze."""
>     from loaders.load_pulse import load
>     for key in get_all_keys():
>         f = data_path(key, "pulse")
>         if not f.exists():
>             log_info(logger, "No pulse JSON file — skipping bronze load for this index",
>                      step="pipeline", index=key)
>             continue
>         if not _file_ok(f):
>             _skip(key, "pulse file is corrupt or empty")
>             continue
>         try:
>             load(f, key)
>         except Exception as e:
>             _skip(key, f"pulse load failed: {e}")
>
>
> # ---------------------------------------------------------------------------
> # Steps 14-16: Gold  (daily scores -> quarterly scores -> index performance)
> # ---------------------------------------------------------------------------
>
> def step_14_transform_scores_daily():
>     """Compute daily analytics scores (relative value, momentum, sentiment)."""
>     from transforms.transform_scores_daily import run
>     run()
>
>
> def step_15_transform_scores_quarterly():
>     """Compute quarterly analytics scores (quality, health flags, governance)."""
>     from transforms.transform_scores_quarterly import run
>     run()
>
>
> def step_16_transform_index_performance():
>     """Compute index-level daily returns and cross-sectional aggregates."""
>     from transforms.transform_index_performance import run
>     run()
>
>
> # ---------------------------------------------------------------------------
> # Step registry and main
> # ---------------------------------------------------------------------------
>
> STEPS = [
>     (0,  "sync_definitions",            step_00_sync_definitions),
>     (1,  "fetch_ohlcv",                step_01_fetch_ohlcv),
>     (2,  "load_ohlcv",                 step_02_load_ohlcv),
>     (3,  "transform_ohlcv",            step_03_transform_ohlcv),
>     (4,  "fetch_signals_daily",         step_04_fetch_signals_daily),
>     (5,  "load_signals_daily",          step_05_load_signals_daily),
>     (6,  "fetch_signals_quarterly",     step_06_fetch_signals_quarterly),
>     (7,  "load_signals_quarterly",      step_07_load_signals_quarterly),
>     (8,  "transform_signals_daily",     step_08_transform_signals_daily),
>     (9,  "transform_signals_quarterly", step_09_transform_signals_quarterly),
>     (10, "fetch_pulse_tickers",         step_10_fetch_pulse_tickers),
>     (11, "load_pulse_tickers",          step_11_load_pulse_tickers),
>     (12, "fetch_pulse",                 step_12_fetch_pulse),
>     (13, "load_pulse",                  step_13_load_pulse),
>     (14, "transform_scores_daily",      step_14_transform_scores_daily),
>     (15, "transform_scores_quarterly",  step_15_transform_scores_quarterly),
>     (16, "transform_index_performance", step_16_transform_index_performance),
> ]
>
>
> def main():
>     parser = argparse.ArgumentParser(description="STOXX ingestion pipeline")
>     parser.add_argument("--step", type=int, help="Run a single step")
>     parser.add_argument("--steps", type=str, help="Comma-separated step numbers (e.g., 4,5,8)")
>     parser.add_argument("--from", type=int, dest="from_step", help="Resume from step N")
>     parser.add_argument("--to", type=int, dest="to_step", help="Stop after step N (use with --from)")
>     args = parser.parse_args()
>
>     if args.steps:
>         step_nums = [int(s) for s in args.steps.split(",")]
>         steps = [(n, name, fn) for n, name, fn in STEPS if n in step_nums]
>     elif args.step:
>         steps = [(n, name, fn) for n, name, fn in STEPS if n == args.step]
>     elif args.from_step:
>         lo = args.from_step
>         hi = args.to_step or STEPS[-1][0]
>         steps = [(n, name, fn) for n, name, fn in STEPS if lo <= n <= hi]
>     else:
>         steps = STEPS
>
>     log_info(logger, "Daily pipeline started — running operational fetch/load/transform steps",
>              step="pipeline", steps=len(steps), indices=len(INDICES))
>     _preflight()
>
>     with StepTimer() as total_timer:
>         failed = []
>         for num, name, fn in steps:
>             log_info(logger, f"Running step {num}/{len(steps)}: {name}", step="pipeline", step_num=num)
>             try:
>                 with StepTimer() as step_timer:
>                     if tracer:
>                         with tracer.trace("pipeline.step", service="stoxx-pipeline",
>                                           resource=name) as span:
>                             span.set_tag("step.num", num)
>                             span.set_tag("step.name", name)
>                             fn()
>                     else:
>                         fn()
>                 log_info(logger, f"Step {num} ({name}) complete", step="pipeline",
>                          step_num=num, step_name=name,
>                          duration_ms=step_timer.duration_ms)
>             except Exception:
>                 log_error(logger, f"Step {num} ({name}) failed", exc_info=True,
>                           step="pipeline", step_num=num, step_name=name)
>                 failed.append(name)
>
>     if failed:
>         log_error(logger, "Daily pipeline finished with errors — check failed steps above",
>                   step="pipeline", failed_steps=failed,
>                   duration_ms=total_timer.duration_ms)
>         sys.exit(1)
>     else:
>         log_info(logger, "Daily pipeline complete — all steps succeeded",
>                  step="pipeline", duration_ms=total_timer.duration_ms)
>
>
> if __name__ == "__main__":
>     main()
> ```

> [!example]- `transform_ohlcv.py`
>
> *Gap-fills bronze OHLCV rows into silver history and trims bronze back to the latest operational window.*
> ```python
> """Gap-fill transform: bronze OHLCV -> silver OHLCV (per index).
>
> Uses bronze.trading_calendar per-exchange to identify missing trading days,
> then forward-fills. Each symbol uses its own exchange's calendar.
>
> After silver is updated, trims bronze to keep only the latest day per symbol.
> """
>
> import sys
> from datetime import datetime
> from pathlib import Path
> from zoneinfo import ZoneInfo
>
> sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
> sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
> from utils.db import get_connection
> from utils.config import get_all_keys, bronze_ohlcv, silver_ohlcv
> from utils.logger import get_logger, log_info, log_warning, log_error, StepTimer
>
> logger = get_logger(__name__)
>
>
> def run():
>     conn = get_connection()
>     cursor = conn.cursor()
>
>     try:
>         for key in get_all_keys():
>             _transform_index(cursor, conn, key, bronze_ohlcv(key), silver_ohlcv(key))
>     finally:
>         cursor.close()
>         conn.close()
>
>
> def _transform_index(cursor, conn, index_name, bronze_table, silver_table):
>     log_info(logger, "Gap-filling OHLCV from bronze to silver using exchange trading calendars",
>              step="transform", index=index_name, source=bronze_table, target=silver_table)
>
>     try:
>         with StepTimer() as timer:
>             # --- Phase 1: Append to silver (gap-fill) ---
>
>             # Get symbol -> exchange mapping from bronze.index_dim
>             cursor.execute("""
>                 SELECT symbol, exchange FROM bronze.index_dim WHERE _index = ?
>             """, index_name)
>             symbol_exchange = {r[0]: r[1] for r in cursor.fetchall()}
>
>             if not symbol_exchange:
>                 log_warning(logger, "Cannot gap-fill — no symbols found in bronze.index_dim for this index",
>                             step="transform", index=index_name)
>                 return
>
>             # Pre-load trading calendars per exchange
>             exchanges = set(symbol_exchange.values())
>             cal_by_exchange = {}
>             for exc in exchanges:
>                 cursor.execute("""
>                     SELECT date FROM bronze.trading_calendar
>                     WHERE exchange_code = ? AND is_trading_day = 1
>                     ORDER BY date
>                 """, exc)
>                 cal_by_exchange[exc] = [r[0] for r in cursor.fetchall()]
>
>             if not any(cal_by_exchange.values()):
>                 log_warning(logger, "Cannot gap-fill — no trading days found in calendar for any exchange",
>                             step="transform", index=index_name)
>                 return
>
>             # Get existing silver (symbol, date) with fill flag
>             cursor.execute(f"""
>                 SELECT symbol, CONVERT(VARCHAR(10), date, 120), is_filled FROM {silver_table}
>             """)
>             existing = {(r[0], r[1]): r[2] for r in cursor.fetchall()}
>
>             inserted = 0
>             filled = 0
>
>             # Get exchange timezone mapping to determine "today" per exchange
>             cursor.execute("""
>                 SELECT DISTINCT exchange, exchange_timezone_name
>                 FROM bronze.index_dim WHERE _index = ?
>             """, index_name)
>             tz_by_exchange = {r[0]: r[1] for r in cursor.fetchall()}
>
>             for symbol, exchange in symbol_exchange.items():
>                 trading_days = cal_by_exchange.get(exchange, [])
>                 if not trading_days:
>                     log_warning(logger, "Skipping symbol — no trading calendar available for its exchange",
>                                 step="transform", symbol=symbol, exchange=exchange)
>                     continue
>
>                 # Cap forward-fill at today in the exchange's timezone
>                 tz_name = tz_by_exchange.get(exchange, "UTC")
>                 try:
>                     today_str = datetime.now(ZoneInfo(tz_name)).strftime("%Y-%m-%d")
>                 except Exception:
>                     today_str = datetime.now(ZoneInfo("UTC")).strftime("%Y-%m-%d")
>
>                 # Load bronze data for this symbol
>                 cursor.execute(f"""
>                     SELECT date, [open], high, low, [close], adj_close,
>                            volume, dividends, stock_splits
>                     FROM {bronze_table}
>                     WHERE symbol = ?
>                     ORDER BY date
>                 """, symbol)
>                 bronze_rows = {str(r[0]): r for r in cursor.fetchall()}
>
>                 if not bronze_rows:
>                     continue
>
>                 first_date = min(bronze_rows.keys())
>                 last_fill = None
>
>                 for td in trading_days:
>                     td_str = str(td)
>                     if td_str < first_date:
>                         continue
>                     if td_str > today_str:
>                         break
>
>                     key = (symbol, td_str)
>                     if key in existing:
>                         if td_str in bronze_rows:
>                             last_fill = bronze_rows[td_str]
>                             # Replace gap-filled row with real bronze data
>                             if existing[key]:
>                                 r = bronze_rows[td_str]
>                                 cursor.execute(f"""
>                                     UPDATE {silver_table}
>                                     SET [open] = ?, high = ?, low = ?, [close] = ?,
>                                         adj_close = ?, volume = ?, dividends = ?,
>                                         stock_splits = ?, is_filled = 0
>                                     WHERE symbol = ? AND date = ?
>                                 """, r[1], r[2], r[3], r[4], r[5],
>                                     r[6], r[7], r[8], symbol, td_str)
>                                 inserted += 1
>                         continue
>
>                     if td_str in bronze_rows:
>                         r = bronze_rows[td_str]
>                         cursor.execute(f"""
>                             INSERT INTO {silver_table}
>                                 (symbol, date, [open], high, low, [close], adj_close,
>                                  volume, dividends, stock_splits, is_filled)
>                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
>                         """, symbol, td_str, r[1], r[2], r[3], r[4], r[5],
>                             r[6], r[7], r[8])
>                         last_fill = r
>                         inserted += 1
>                     elif last_fill is not None and td_str < today_str:
>                         close = last_fill[4]
>                         adj = last_fill[5]
>                         cursor.execute(f"""
>                             INSERT INTO {silver_table}
>                                 (symbol, date, [open], high, low, [close], adj_close,
>                                  volume, dividends, stock_splits, is_filled)
>                             VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 1)
>                         """, symbol, td_str, close, close, close, close, adj)
>                         filled += 1
>
>                 if (inserted + filled) % 5000 == 0 and (inserted + filled) > 0:
>                     conn.commit()
>
>             conn.commit()
>
>             # --- Phase 2: Trim bronze to latest day per symbol ---
>             trimmed = _trim_bronze(cursor, conn, bronze_table)
>
>         log_info(logger, "OHLCV transform complete — silver updated with gap-filled history, bronze trimmed to latest day",
>                  step="transform", index=index_name, target=silver_table,
>                  records_inserted=inserted, records_filled=filled,
>                  symbols=len(symbol_exchange), bronze_trimmed=trimmed,
>                  duration_ms=timer.duration_ms)
>     except Exception:
>         conn.rollback()
>         log_error(logger, "OHLCV transform failed", exc_info=True,
>                   step="transform", index=index_name, target=silver_table)
>         raise
>
>
> def _trim_bronze(cursor, conn, bronze_table):
>     """Delete all but the latest row per symbol from bronze."""
>     cursor.execute(f"""
>         DELETE b FROM {bronze_table} b
>         INNER JOIN (
>             SELECT symbol, MAX(date) AS max_date
>             FROM {bronze_table}
>             GROUP BY symbol
>             HAVING COUNT(*) > 1
>         ) m ON b.symbol = m.symbol AND b.date < m.max_date
>     """)
>     trimmed = cursor.rowcount
>     conn.commit()
>
>     if trimmed > 0:
>         log_info(logger, "Bronze OHLCV trimmed — kept only latest day per symbol",
>                  step="transform", table=bronze_table, rows_trimmed=trimmed)
>
>     return trimmed
>
>
> if __name__ == "__main__":
>     run()
> ```

> [!example]- `transform_signals_daily.py`
>
> *Upserts bronze daily signal snapshots into the historized silver daily fact table.*
> ```python
> """Upsert transform: bronze.signals_daily -> silver.signals_daily.
>
> Bronze holds only the current day's snapshot (truncate & reload per run).
> This transform compares bronze against silver and:
>   - Inserts a new row if the date doesn't exist in silver yet
>   - Updates the existing silver row if values have changed
>   - Skips if values are identical (market hasn't moved since last fetch)
> """
>
> import sys
> from pathlib import Path
>
> sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
> sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
> from utils.db import get_connection
> from utils.logger import get_logger, log_info, log_error, StepTimer
>
> logger = get_logger(__name__)
>
> _VALUE_COLS = [
>     "current_price", "forward_pe", "price_to_book", "ev_to_ebitda",
>     "dividend_yield", "market_cap", "beta",
>     "fifty_two_week_change", "sandp_52_week_change",
>     "fifty_day_average", "two_hundred_day_average", "dist_from_52_week_high",
>     "target_median_price", "recommendation_mean", "upside_potential",
> ]
>
> _ALL_COLS = ["_index", "symbol", "signal_date"] + _VALUE_COLS
>
>
> def run():
>     log_info(logger, "Upserting daily signals from bronze to silver (insert new dates, update changed values)",
>              step="transform", target="silver.signals_daily")
>
>     conn = get_connection()
>     cursor = conn.cursor()
>
>     try:
>         with StepTimer() as timer:
>             # Load existing silver data for comparison
>             cursor.execute(f"""
>                 SELECT _index, symbol, CONVERT(VARCHAR(10), signal_date, 120),
>                        {', '.join(_VALUE_COLS)}
>                 FROM silver.signals_daily
>             """)
>             silver = {}
>             for r in cursor.fetchall():
>                 silver[(r[0], r[1], r[2])] = tuple(r[3:])
>
>             # Read current bronze snapshot (one row per symbol per index)
>             cursor.execute(f"""
>                 SELECT _index, symbol, CAST(timestamp AS DATE) AS signal_date,
>                        {', '.join(_VALUE_COLS)}
>                 FROM bronze.signals_daily
>             """)
>
>             inserted = 0
>             updated = 0
>             unchanged = 0
>
>             set_clause = ", ".join(f"{c} = ?" for c in _VALUE_COLS)
>             placeholders = ", ".join(["?"] * len(_ALL_COLS))
>
>             for row in cursor.fetchall():
>                 key = (row[0], row[1], str(row[2]))
>                 values = tuple(row[3:])
>
>                 if key not in silver:
>                     cursor.execute(f"""
>                         INSERT INTO silver.signals_daily ({', '.join(_ALL_COLS)})
>                         VALUES ({placeholders})
>                     """, *list(row))
>                     inserted += 1
>                 elif silver[key] != values:
>                     cursor.execute(f"""
>                         UPDATE silver.signals_daily
>                         SET {set_clause}
>                         WHERE _index = ? AND symbol = ? AND signal_date = ?
>                     """, *list(row[3:]), row[0], row[1], row[2])
>                     updated += 1
>                 else:
>                     unchanged += 1
>
>             conn.commit()
>
>         log_info(logger, "Daily signals upsert complete — silver updated with latest market data",
>                  step="transform", target="silver.signals_daily",
>                  records_inserted=inserted, records_updated=updated,
>                  records_unchanged=unchanged, duration_ms=timer.duration_ms)
>     except Exception:
>         conn.rollback()
>         log_error(logger, "Daily signals upsert failed", exc_info=True,
>                   step="transform", target="silver.signals_daily")
>         raise
>     finally:
>         cursor.close()
>         conn.close()
>
>
> if __name__ == "__main__":
>     run()
> ```

> [!example]- `transform_signals_quarterly.py`
>
> *Upserts bronze quarterly fundamentals into the historized silver quarterly fact table.*
> ```python
> """Upsert transform: bronze.signals_quarterly -> silver.signals_quarterly.
>
> Bronze holds only the current snapshot (truncate & reload per run).
> Groups by actual fiscal quarter (most_recent_quarter from yfinance).
> This transform compares bronze against silver and:
>   - Inserts a new row when a company reports a new quarter
>   - Updates the existing silver row if fundamentals have been revised
>   - Skips if values are identical
> """
>
> import sys
> from pathlib import Path
>
> sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
> sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
> from utils.db import get_connection
> from utils.logger import get_logger, log_info, log_error, StepTimer
>
> logger = get_logger(__name__)
>
> _VALUE_COLS = [
>     "gross_margins", "operating_margins", "return_on_equity",
>     "revenue_growth", "earnings_growth",
>     "shares_outstanding", "float_shares", "debt_to_equity",
>     "current_ratio", "free_cashflow",
>     "last_fiscal_year_end", "most_recent_quarter",
>     "overall_risk", "audit_risk", "board_risk",
>     "compensation_risk", "shareholder_rights_risk", "esg_populated",
> ]
>
> _ALL_COLS = ["_index", "symbol", "as_of_date"] + _VALUE_COLS
>
>
> def run():
>     log_info(logger, "Upserting quarterly signals from bronze to silver (keyed by fiscal quarter)",
>              step="transform", target="silver.signals_quarterly")
>
>     conn = get_connection()
>     cursor = conn.cursor()
>
>     try:
>         with StepTimer() as timer:
>             # Load existing silver data for comparison
>             cursor.execute(f"""
>                 SELECT _index, symbol, CONVERT(VARCHAR(10), as_of_date, 120),
>                        {', '.join(_VALUE_COLS)}
>                 FROM silver.signals_quarterly
>             """)
>             silver = {}
>             for r in cursor.fetchall():
>                 silver[(r[0], r[1], r[2])] = tuple(r[3:])
>
>             # Read current bronze snapshot.
>             # Use most_recent_quarter as silver as_of_date (actual fiscal quarter).
>             # Fall back to as_of_date if most_recent_quarter is NULL.
>             cursor.execute(f"""
>                 SELECT _index, symbol,
>                        COALESCE(most_recent_quarter, as_of_date) AS as_of_date,
>                        {', '.join(_VALUE_COLS)}
>                 FROM bronze.signals_quarterly
>             """)
>
>             inserted = 0
>             updated = 0
>             unchanged = 0
>
>             set_clause = ", ".join(f"{c} = ?" for c in _VALUE_COLS)
>             placeholders = ", ".join(["?"] * len(_ALL_COLS))
>
>             for row in cursor.fetchall():
>                 key = (row[0], row[1], str(row[2]))
>                 values = tuple(row[3:])
>
>                 if key not in silver:
>                     cursor.execute(f"""
>                         INSERT INTO silver.signals_quarterly ({', '.join(_ALL_COLS)})
>                         VALUES ({placeholders})
>                     """, *list(row))
>                     inserted += 1
>                 elif silver[key] != values:
>                     cursor.execute(f"""
>                         UPDATE silver.signals_quarterly
>                         SET {set_clause}
>                         WHERE _index = ? AND symbol = ? AND as_of_date = ?
>                     """, *list(row[3:]), row[0], row[1], row[2])
>                     updated += 1
>                 else:
>                     unchanged += 1
>
>             conn.commit()
>
>         log_info(logger, "Quarterly signals upsert complete — silver updated with latest fundamentals",
>                  step="transform", target="silver.signals_quarterly",
>                  records_inserted=inserted, records_updated=updated,
>                  records_unchanged=unchanged, duration_ms=timer.duration_ms)
>     except Exception:
>         conn.rollback()
>         log_error(logger, "Quarterly signals upsert failed", exc_info=True,
>                   step="transform", target="silver.signals_quarterly")
>         raise
>     finally:
>         cursor.close()
>         conn.close()
>
>
> if __name__ == "__main__":
>     run()
> ```

> [!example]- `transform_scores_daily.py`
>
> *Calculates daily gold scores for value, momentum, sentiment, and composite ranking.*
> ```python
> """Gold transform: silver.signals_daily + silver.index_dim -> gold.scores_daily.
>
> Computes per-stock analytics for the latest signal date:
>   - Relative value z-scores (within sector, cheap = positive)
>   - Momentum signals (relative strength, SMA ratios)
>   - Analyst sentiment (implied upside, divergence flags)
>   - Composite score and ranks
> """
>
> import sys
> from pathlib import Path
>
> import numpy as np
> import pandas as pd
>
> sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
> sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
> from utils.db import get_connection
> from utils.config import get_all_keys, silver_ohlcv
> from utils.logger import get_logger, log_info, log_warning, log_error, StepTimer
> from transforms._gold_utils import zscore_by_group, composite_score, dense_rank_asc
>
> logger = get_logger(__name__)
>
>
> def run():
>     log_info(logger, "Computing daily gold scores (relative value, momentum, sentiment)",
>              step="transform", target="gold.scores_daily")
>
>     conn = get_connection()
>     cursor = conn.cursor()
>
>     try:
>         with StepTimer() as timer:
>             # --- 1. Find the latest signal date ---
>             cursor.execute("SELECT MAX(signal_date) FROM silver.signals_daily")
>             row = cursor.fetchone()
>             if not row or not row[0]:
>                 log_warning(logger, "No data in silver.signals_daily — skipping gold daily scores",
>                             step="transform")
>                 return
>             score_date = row[0]
>
>             # --- 2. Pull silver data for that date + sector from index_dim ---
>             cursor.execute("""
>                 SELECT s._index, s.symbol, s.signal_date,
>                        s.current_price, s.forward_pe, s.price_to_book,
>                        s.ev_to_ebitda, s.dividend_yield, s.market_cap, s.beta,
>                        s.fifty_two_week_change, s.sandp_52_week_change,
>                        s.fifty_day_average, s.two_hundred_day_average,
>                        s.dist_from_52_week_high,
>                        s.target_median_price, s.recommendation_mean,
>                        s.upside_potential,
>                        d.sector, d.short_name, d.country, d.currency
>                 FROM silver.signals_daily s
>                 JOIN silver.index_dim d
>                     ON s._index = d._index AND s.symbol = d.symbol AND d.is_current = 1
>                 WHERE s.signal_date = ?
>             """, score_date)
>
>             cols = [desc[0] for desc in cursor.description]
>             rows = cursor.fetchall()
>
>             if not rows:
>                 log_warning(logger, "No rows for latest signal date — skipping",
>                             step="transform", score_date=str(score_date))
>                 return
>
>             df = pd.DataFrame.from_records(rows, columns=cols)
>
>             # --- 2b. Data validation: sanitize outliers ---
>             sanitized = 0
>             for col, condition in [
>                 ('market_cap', df['market_cap'] <= 0),
>                 ('current_price', df['current_price'] <= 0),
>                 ('forward_pe', df['forward_pe'].abs() > 500),
>                 ('price_to_book', df['price_to_book'].abs() > 100),
>                 ('ev_to_ebitda', df['ev_to_ebitda'].abs() > 500),
>             ]:
>                 mask = condition & df[col].notna()
>                 count = mask.sum()
>                 if count > 0:
>                     df.loc[mask, col] = np.nan
>                     sanitized += count
>             if sanitized > 0:
>                 log_warning(logger, f"Sanitized {sanitized} outlier values to NaN",
>                             step="transform", target="gold.scores_daily",
>                             score_date=str(score_date))
>
>             # --- 3. Relative Value z-scores ---
>             # Invert PE/PB/EV (lower = cheaper = positive z-score)
>             df['pe_zscore'] = -zscore_by_group(df, 'forward_pe', ['_index', 'sector'],
>                                                fallback_cols=['_index'])
>             df['pb_zscore'] = -zscore_by_group(df, 'price_to_book', ['_index', 'sector'],
>                                                fallback_cols=['_index'])
>             df['ev_ebitda_zscore'] = -zscore_by_group(df, 'ev_to_ebitda', ['_index', 'sector'],
>                                                       fallback_cols=['_index'])
>             # Yield: higher = better (no inversion)
>             df['yield_zscore'] = zscore_by_group(df, 'dividend_yield', ['_index', 'sector'],
>                                                  fallback_cols=['_index'])
>
>             df['relative_value_score'] = composite_score(
>                 df['pe_zscore'].values, df['pb_zscore'].values,
>                 df['ev_ebitda_zscore'].values, df['yield_zscore'].values
>             )
>             df['relative_value_rank'] = df.groupby('_index')['relative_value_score'].transform(
>                 lambda s: s.rank(method='dense', ascending=False, na_option='keep')
>             ).astype('Int16')
>
>             # --- 4. Momentum ---
>             df['relative_strength'] = df['fifty_two_week_change'] - df['sandp_52_week_change']
>
>             df['sma_50_ratio'] = np.where(
>                 df['fifty_day_average'].notna() & (df['fifty_day_average'] != 0),
>                 df['current_price'] / df['fifty_day_average'], np.nan
>             )
>             df['sma_200_ratio'] = np.where(
>                 df['two_hundred_day_average'].notna() & (df['two_hundred_day_average'] != 0),
>                 df['current_price'] / df['two_hundred_day_average'], np.nan
>             )
>
>             # Z-score each momentum metric within _index, then composite
>             mom_z_rs = zscore_by_group(df, 'relative_strength', ['_index'])
>             mom_z_50 = zscore_by_group(df, 'sma_50_ratio', ['_index'])
>             mom_z_200 = zscore_by_group(df, 'sma_200_ratio', ['_index'])
>             # dist_from_52w_high is negative (closer to 0 = stronger), invert
>             mom_z_high = -zscore_by_group(df, 'dist_from_52_week_high', ['_index'])
>
>             df['momentum_score'] = composite_score(
>                 mom_z_rs.values, mom_z_50.values, mom_z_200.values, mom_z_high.values
>             )
>             df['momentum_rank'] = df.groupby('_index')['momentum_score'].transform(
>                 lambda s: s.rank(method='dense', ascending=False, na_option='keep')
>             ).astype('Int16')
>
>             # --- 5. Analyst Sentiment ---
>             df['implied_upside'] = np.where(
>                 df['current_price'].notna() & (df['current_price'] != 0),
>                 (df['target_median_price'] / df['current_price']) - 1, np.nan
>             )
>
>             df['price_falling_analysts_bullish'] = (
>                 (df['recommendation_mean'] < 2.5) &
>                 (df['fifty_two_week_change'] < -0.10)
>             ).astype('Int16')
>
>             # Composite: z-score upside (higher = better) + inverted recommendation (lower = better)
>             sent_z_upside = zscore_by_group(df, 'implied_upside', ['_index'])
>             df['_rec_inverted'] = -df['recommendation_mean']
>             sent_z_rec = zscore_by_group(df, '_rec_inverted', ['_index'])
>
>             df['sentiment_score'] = composite_score(
>                 sent_z_upside.values, sent_z_rec.values
>             )
>             df['sentiment_rank'] = df.groupby('_index')['sentiment_score'].transform(
>                 lambda s: s.rank(method='dense', ascending=False, na_option='keep')
>             ).astype('Int16')
>
>             # --- 6. Composite ---
>             df['composite_score'] = composite_score(
>                 df['relative_value_score'].values,
>                 df['momentum_score'].values,
>                 df['sentiment_score'].values
>             )
>             df['composite_rank'] = df.groupby('_index')['composite_score'].transform(
>                 lambda s: s.rank(method='dense', ascending=False, na_option='keep')
>             ).astype('Int16')
>
>             # --- 7. Index weight (market_cap / sum per index) ---
>             df['market_cap'] = pd.to_numeric(df['market_cap'], errors='coerce')
>             df['index_weight'] = df.groupby('_index')['market_cap'].transform(
>                 lambda s: s / s.sum()
>             )
>
>             # --- 8. Moving averages + price changes from silver OHLCV ---
>             ohlcv_frames = []
>             for key in get_all_keys():
>                 table = silver_ohlcv(key)
>                 cursor.execute(f"""
>                     WITH ranked AS (
>                         SELECT symbol, date, [close],
>                                ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) AS rn,
>                                AVG([close]) OVER (PARTITION BY symbol ORDER BY date
>                                     ROWS BETWEEN 29 PRECEDING AND CURRENT ROW) AS sma_30,
>                                AVG([close]) OVER (PARTITION BY symbol ORDER BY date
>                                     ROWS BETWEEN 89 PRECEDING AND CURRENT ROW) AS sma_90,
>                                COUNT([close]) OVER (PARTITION BY symbol ORDER BY date
>                                     ROWS BETWEEN 29 PRECEDING AND CURRENT ROW) AS cnt_30,
>                                COUNT([close]) OVER (PARTITION BY symbol ORDER BY date
>                                     ROWS BETWEEN 89 PRECEDING AND CURRENT ROW) AS cnt_90,
>                                LAG([close], 1) OVER (PARTITION BY symbol ORDER BY date) AS prev_close,
>                                LAG([close], 5) OVER (PARTITION BY symbol ORDER BY date) AS close_5d_ago
>                         FROM {table}
>                         WHERE [close] IS NOT NULL
>                     ),
>                     ytd AS (
>                         SELECT symbol,
>                                MAX(CASE WHEN rn = 1 THEN [close] END) AS latest_close,
>                                MAX(CASE WHEN date <= DATEFROMPARTS(YEAR(GETDATE()), 1, 1)
>                                     THEN date END) AS ytd_date
>                         FROM ranked
>                         GROUP BY symbol
>                     ),
>                     ytd_price AS (
>                         SELECT y.symbol, r.[close] AS ytd_close
>                         FROM ytd y
>                         JOIN ranked r ON y.symbol = r.symbol AND r.date = y.ytd_date
>                     )
>                     SELECT r.symbol,
>                            CASE WHEN cnt_30 >= 30 THEN sma_30 END AS sma_30_close,
>                            CASE WHEN cnt_90 >= 90 THEN sma_90 END AS sma_90_close,
>                            CASE WHEN prev_close > 0
>                                 THEN (r.[close] - prev_close) / prev_close END AS day_change_pct,
>                            CASE WHEN close_5d_ago > 0
>                                 THEN (r.[close] - close_5d_ago) / close_5d_ago END AS five_day_change_pct,
>                            CASE WHEN yp.ytd_close > 0
>                                 THEN (r.[close] - yp.ytd_close) / yp.ytd_close END AS ytd_change_pct
>                     FROM ranked r
>                     LEFT JOIN ytd_price yp ON r.symbol = yp.symbol
>                     WHERE r.rn = 1
>                 """)
>                 cols_ohlcv = [desc[0] for desc in cursor.description]
>                 rows_ohlcv = cursor.fetchall()
>                 if rows_ohlcv:
>                     ohlcv_df = pd.DataFrame.from_records(rows_ohlcv, columns=cols_ohlcv)
>                     ohlcv_df['_index'] = key
>                     ohlcv_frames.append(ohlcv_df)
>
>             if ohlcv_frames:
>                 ohlcv_all = pd.concat(ohlcv_frames, ignore_index=True)
>                 df = df.merge(ohlcv_all, on=['_index', 'symbol'], how='left')
>             else:
>                 df['sma_30_close'] = np.nan
>                 df['sma_90_close'] = np.nan
>                 df['day_change_pct'] = np.nan
>                 df['five_day_change_pct'] = np.nan
>                 df['ytd_change_pct'] = np.nan
>
>             # --- 9. Write to gold ---
>             cursor.execute("DELETE FROM gold.scores_daily WHERE score_date = ?", score_date)
>             deleted = cursor.rowcount
>
>             insert_cols = [
>                 '_index', 'symbol', 'score_date', 'sector',
>                 'pe_zscore', 'pb_zscore', 'ev_ebitda_zscore', 'yield_zscore',
>                 'relative_value_score', 'relative_value_rank',
>                 'relative_strength', 'sma_50_ratio', 'sma_200_ratio', 'dist_from_52_week_high',
>                 'momentum_score', 'momentum_rank',
>                 'implied_upside', 'recommendation_mean', 'price_falling_analysts_bullish',
>                 'sentiment_score', 'sentiment_rank',
>                 'composite_score', 'composite_rank',
>                 'sma_30_close', 'sma_90_close',
>                 'market_cap', 'index_weight',
>                 'short_name', 'country', 'current_price',
>                 'day_change_pct', 'five_day_change_pct', 'ytd_change_pct',
>                 'currency',
>             ]
>
>             # Rename signal_date -> score_date for insert
>             df['score_date'] = df['signal_date']
>             # Replace pandas NaN/NA with None for pyodbc
>             insert_df = df[insert_cols].where(df[insert_cols].notna(), None)
>
>             # Map DataFrame column to DB column name
>             col_map = {'dist_from_52_week_high': 'dist_from_52w_high'}
>             db_cols = [col_map.get(c, c) for c in insert_cols]
>             placeholders = ', '.join(['?'] * len(insert_cols))
>             col_list = ', '.join(db_cols)
>
>             def _clean(v):
>                 if v is None or v is pd.NA or (isinstance(v, float) and np.isnan(v)):
>                     return None
>                 if hasattr(v, 'item'):
>                     return v.item()
>                 return v
>
>             rows = [tuple(_clean(v) for v in row) for row in insert_df.itertuples(index=False, name=None)]
>             cursor.fast_executemany = True
>             cursor.executemany(
>                 f"INSERT INTO gold.scores_daily ({col_list}) VALUES ({placeholders})",
>                 rows
>             )
>             inserted = len(rows)
>             conn.commit()
>
>         log_info(logger, "Daily gold scores computed — relative value, momentum, sentiment ranked",
>                  step="transform", target="gold.scores_daily",
>                  score_date=str(score_date), records_inserted=inserted,
>                  records_replaced=deleted, duration_ms=timer.duration_ms)
>     except Exception:
>         conn.rollback()
>         log_error(logger, "Daily gold scores transform failed", exc_info=True,
>                   step="transform", target="gold.scores_daily")
>         raise
>     finally:
>         cursor.close()
>         conn.close()
>
>
> if __name__ == "__main__":
>     run()
> ```

> [!example]- `transform_scores_quarterly.py`
>
> *Calculates quarterly gold scores for quality, health risk, and governance.*
> ```python
> """Gold transform: silver.signals_quarterly + silver.index_dim -> gold.scores_quarterly.
>
> Computes per-stock analytics for the latest quarterly data:
>   - Quality / moat z-scores (margins, ROE, leverage, FCF yield)
>   - Financial health risk flags (rules-based thresholds)
>   - Governance composite (ISS risk scores)
>   - Cross-domain comparison (governance vs quality gap)
> """
>
> import sys
> import warnings
> from pathlib import Path
>
> import numpy as np
> import pandas as pd
>
> sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
> sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
> from utils.db import get_connection
> from utils.logger import get_logger, log_info, log_warning, log_error, StepTimer
> from transforms._gold_utils import zscore_by_group, composite_score
>
> logger = get_logger(__name__)
>
> _RISK_LEVELS = {0: 'healthy', 1: 'watch', 2: 'warning', 3: 'critical', 4: 'critical'}
>
>
> def run():
>     log_info(logger, "Computing quarterly gold scores (quality, health flags, governance)",
>              step="transform", target="gold.scores_quarterly")
>
>     conn = get_connection()
>     cursor = conn.cursor()
>
>     try:
>         with StepTimer() as timer:
>             # --- 1. Get latest as_of_date per (_index, symbol) ---
>             cursor.execute("""
>                 SELECT q._index, q.symbol, q.as_of_date,
>                        q.gross_margins, q.operating_margins, q.return_on_equity,
>                        q.revenue_growth, q.earnings_growth,
>                        q.debt_to_equity, q.current_ratio, q.free_cashflow,
>                        q.overall_risk, q.audit_risk, q.board_risk,
>                        q.compensation_risk, q.shareholder_rights_risk,
>                        d.sector
>                 FROM silver.signals_quarterly q
>                 JOIN silver.index_dim d
>                     ON q._index = d._index AND q.symbol = d.symbol AND d.is_current = 1
>                 WHERE q.as_of_date = (
>                     SELECT MAX(q2.as_of_date)
>                     FROM silver.signals_quarterly q2
>                     WHERE q2._index = q._index AND q2.symbol = q.symbol
>                 )
>             """)
>             cols = [desc[0] for desc in cursor.description]
>             rows = cursor.fetchall()
>
>             if not rows:
>                 log_warning(logger, "No data in silver.signals_quarterly — skipping gold quarterly scores",
>                             step="transform")
>                 return
>
>             df = pd.DataFrame.from_records(rows, columns=cols)
>
>             # --- 2. Get latest market_cap + beta from silver.signals_daily ---
>             cursor.execute("""
>                 SELECT s._index, s.symbol, s.market_cap, s.beta
>                 FROM silver.signals_daily s
>                 WHERE s.signal_date = (
>                     SELECT MAX(s2.signal_date)
>                     FROM silver.signals_daily s2
>                     WHERE s2._index = s._index AND s2.symbol = s.symbol
>                 )
>             """)
>             daily_cols = [desc[0] for desc in cursor.description]
>             daily_rows = cursor.fetchall()
>             daily_df = pd.DataFrame.from_records(daily_rows, columns=daily_cols)
>
>             if not daily_df.empty:
>                 df = df.merge(daily_df, on=['_index', 'symbol'], how='left')
>             else:
>                 df['market_cap'] = np.nan
>                 df['beta'] = np.nan
>
>             # --- 3. Quality / Moat z-scores ---
>             # FCF yield = free_cashflow / market_cap
>             df['fcf_yield'] = np.where(
>                 df['market_cap'].notna() & (df['market_cap'] != 0),
>                 df['free_cashflow'] / df['market_cap'], np.nan
>             )
>
>             # Higher = better for margins, ROE, FCF yield
>             df['gross_margin_zscore'] = zscore_by_group(df, 'gross_margins', ['_index', 'sector'],
>                                                         fallback_cols=['_index'])
>             df['roe_zscore'] = zscore_by_group(df, 'return_on_equity', ['_index', 'sector'],
>                                                fallback_cols=['_index'])
>             df['operating_margin_zscore'] = zscore_by_group(df, 'operating_margins', ['_index', 'sector'],
>                                                             fallback_cols=['_index'])
>             df['fcf_yield_zscore'] = zscore_by_group(df, 'fcf_yield', ['_index', 'sector'],
>                                                      fallback_cols=['_index'])
>
>             # Lower D/E = better → invert
>             df['leverage_zscore'] = -zscore_by_group(df, 'debt_to_equity', ['_index', 'sector'],
>                                                      fallback_cols=['_index'])
>
>             df['quality_score'] = composite_score(
>                 df['gross_margin_zscore'].values, df['roe_zscore'].values,
>                 df['operating_margin_zscore'].values, df['leverage_zscore'].values,
>                 df['fcf_yield_zscore'].values
>             )
>             df['quality_rank'] = df.groupby('_index')['quality_score'].transform(
>                 lambda s: s.rank(method='dense', ascending=False, na_option='keep')
>             ).astype('Int16')
>
>             # --- 4. Financial Health Flags ---
>             df['flag_liquidity'] = (df['current_ratio'].notna() & (df['current_ratio'] < 1)).astype('Int16')
>             df['flag_leverage'] = (df['debt_to_equity'].notna() & (df['debt_to_equity'] > 200)).astype('Int16')
>             df['flag_cashburn'] = (df['free_cashflow'].notna() & (df['free_cashflow'] < 0)).astype('Int16')
>             df['flag_double_decline'] = (
>                 df['earnings_growth'].notna() & (df['earnings_growth'] < 0) &
>                 df['revenue_growth'].notna() & (df['revenue_growth'] < 0)
>             ).astype('Int16')
>
>             df['health_flags_count'] = (
>                 df['flag_liquidity'].fillna(0) + df['flag_leverage'].fillna(0) +
>                 df['flag_cashburn'].fillna(0) + df['flag_double_decline'].fillna(0)
>             ).astype('Int16')
>
>             df['health_risk_level'] = df['health_flags_count'].map(_RISK_LEVELS)
>
>             # --- 5. Governance ---
>             risk_cols = ['overall_risk', 'audit_risk', 'board_risk',
>                          'compensation_risk', 'shareholder_rights_risk']
>
>             # governance_score = 10 - avg(risk scores), higher = better governance
>             risk_values = df[risk_cols].values.astype(float)
>             with np.errstate(invalid='ignore'), warnings.catch_warnings():
>                 warnings.simplefilter('ignore', RuntimeWarning)
>                 avg_risk = np.nanmean(risk_values, axis=1)
>             df['governance_score'] = np.where(np.isnan(avg_risk), np.nan, 10.0 - avg_risk)
>
>             df['governance_rank'] = df.groupby('_index')['governance_score'].transform(
>                 lambda s: s.rank(method='dense', ascending=False, na_option='keep')
>             ).astype('Int16')
>
>             # governance vs quality gap (positive = governance outpaces fundamentals)
>             df['governance_vs_quality'] = df['governance_score'] - df['quality_score']
>
>             # --- 6. Write to gold ---
>             # Get the distinct as_of_dates we're inserting
>             as_of_dates = df['as_of_date'].dropna().unique()
>             for aod in as_of_dates:
>                 cursor.execute("DELETE FROM gold.scores_quarterly WHERE as_of_date = ?", aod)
>             deleted = cursor.rowcount
>
>             insert_cols = [
>                 '_index', 'symbol', 'as_of_date', 'sector',
>                 'gross_margin_zscore', 'roe_zscore', 'operating_margin_zscore',
>                 'leverage_zscore', 'fcf_yield', 'fcf_yield_zscore',
>                 'quality_score', 'quality_rank',
>                 'flag_liquidity', 'flag_leverage', 'flag_cashburn', 'flag_double_decline',
>                 'health_flags_count', 'health_risk_level',
>                 'overall_risk', 'audit_risk', 'board_risk',
>                 'compensation_risk', 'shareholder_rights_risk',
>                 'governance_score', 'governance_rank',
>                 'beta', 'governance_vs_quality',
>             ]
>
>             insert_df = df[insert_cols].where(df[insert_cols].notna(), None)
>             placeholders = ', '.join(['?'] * len(insert_cols))
>             col_list = ', '.join(insert_cols)
>
>             def _clean(v):
>                 if v is None or v is pd.NA or (isinstance(v, float) and np.isnan(v)):
>                     return None
>                 if hasattr(v, 'item'):
>                     return v.item()
>                 return v
>
>             rows = [tuple(_clean(v) for v in row) for row in insert_df.itertuples(index=False, name=None)]
>             cursor.fast_executemany = True
>             cursor.executemany(
>                 f"INSERT INTO gold.scores_quarterly ({col_list}) VALUES ({placeholders})",
>                 rows
>             )
>             inserted = len(rows)
>             conn.commit()
>
>         log_info(logger, "Quarterly gold scores computed — quality, health flags, governance ranked",
>                  step="transform", target="gold.scores_quarterly",
>                  records_inserted=inserted, records_replaced=deleted,
>                  duration_ms=timer.duration_ms)
>     except Exception:
>         conn.rollback()
>         log_error(logger, "Quarterly gold scores transform failed", exc_info=True,
>                   step="transform", target="gold.scores_quarterly")
>         raise
>     finally:
>         cursor.close()
>         conn.close()
>
>
> if __name__ == "__main__":
>     run()
> ```

> [!example]- `transform_index_performance.py`
>
> *Builds the gold index-performance time series from silver OHLCV and signal data.*
> ```python
> """Gold transform: silver OHLCV + silver.signals_daily -> gold.index_performance.
>
> Computes per-index daily time series:
>   - Market-cap-weighted daily price return (close, not [close]) across all stocks
>   - Cumulative return factor (rebased from first trading day)
>   - Rolling 30d/90d returns and annualized volatility
>   - YTD return
>   - Cap-weighted cross-sectional aggregates (PE, PB, yield, market cap)
>
> Strategy: incremental — only insert dates newer than the latest existing row.
> """
>
> import sys
> from math import sqrt
> from pathlib import Path
>
> import numpy as np
> import pandas as pd
>
> sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
> sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
> from utils.db import get_connection
> from utils.config import get_all_keys, silver_ohlcv
> from utils.logger import get_logger, log_info, log_warning, log_error, StepTimer
>
> logger = get_logger(__name__)
>
> _ANNUALIZATION = sqrt(252)
>
>
> def run():
>     log_info(logger, "Computing cap-weighted index performance time series",
>              step="transform", target="gold.index_performance")
>
>     conn = get_connection()
>     cursor = conn.cursor()
>
>     try:
>         with StepTimer() as timer:
>             total_inserted = 0
>
>             for key in get_all_keys():
>                 inserted = _transform_index(cursor, conn, key)
>                 total_inserted += inserted
>
>             conn.commit()
>
>         log_info(logger, "Index performance transform complete",
>                  step="transform", target="gold.index_performance",
>                  records_inserted=total_inserted, duration_ms=timer.duration_ms)
>     except Exception:
>         conn.rollback()
>         log_error(logger, "Index performance transform failed", exc_info=True,
>                   step="transform", target="gold.index_performance")
>         raise
>     finally:
>         cursor.close()
>         conn.close()
>
>
> def _transform_index(cursor, conn, key):
>     """Compute and insert cap-weighted index performance rows for a single index."""
>     table = silver_ohlcv(key)
>
>     # Check if the silver OHLCV table exists
>     schema, tbl = table.split('.')
>     cursor.execute("""
>         SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
>         WHERE s.name = ? AND t.name = ?
>     """, schema, tbl)
>     if not cursor.fetchone():
>         log_warning(logger, "Silver OHLCV table does not exist — skipping",
>                     step="transform", index=key, table=table)
>         return 0
>
>     # Find the latest date already in gold for this index (for incremental)
>     cursor.execute("""
>         SELECT MAX(perf_date) FROM gold.index_performance WHERE _index = ?
>     """, key)
>     row = cursor.fetchone()
>     max_existing = row[0] if row and row[0] else None
>
>     # --- 1. Pull all OHLCV ([close]) from silver ---
>     cursor.execute(f"""
>         SELECT symbol, date, [close]
>         FROM {table}
>         WHERE [close] IS NOT NULL
>         ORDER BY symbol, date
>     """)
>     ohlcv_rows = [tuple(r) for r in cursor.fetchall()]
>
>     if not ohlcv_rows:
>         log_warning(logger, "No OHLCV data in silver — skipping",
>                     step="transform", index=key, table=table)
>         return 0
>
>     prices = pd.DataFrame(ohlcv_rows, columns=['symbol', 'date', 'close'])
>     prices['date'] = pd.to_datetime(prices['date'])
>
>     # --- 2. Compute daily returns per stock ---
>     prices = prices.sort_values(['symbol', 'date'])
>     prices['daily_ret'] = prices.groupby('symbol')['close'].pct_change()
>
>     # --- 3. Pull market cap + fundamentals from silver.signals_daily ---
>     cursor.execute("""
>         SELECT symbol, CAST(signal_date AS DATE) AS sig_date,
>                market_cap, forward_pe, price_to_book,
>                dividend_yield
>         FROM silver.signals_daily
>         WHERE _index = ? AND market_cap IS NOT NULL AND market_cap > 0
>         ORDER BY symbol, signal_date
>     """, key)
>     sig_rows = [tuple(r) for r in cursor.fetchall()]
>
>     if sig_rows:
>         signals = pd.DataFrame(sig_rows, columns=['symbol', 'date', 'market_cap',
>                                                    'forward_pe', 'price_to_book',
>                                                    'dividend_yield'])
>         signals['date'] = pd.to_datetime(signals['date'])
>         signals['market_cap'] = signals['market_cap'].astype(float)
>     else:
>         # Fallback: no signals available, use equal weights
>         log_warning(logger, "No market cap data in signals — falling back to equal weights",
>                     step="transform", index=key)
>         signals = None
>
>     # --- 4. Merge market cap onto prices for weighting ---
>     if signals is not None:
>         # Keep only market_cap for the merge (fundamentals handled separately)
>         mcap = signals[['symbol', 'date', 'market_cap']].copy()
>
>         # merge_asof: for each (symbol, date) in prices, find nearest signal date
>         prices = prices.sort_values(['symbol', 'date'])
>         mcap = mcap.sort_values(['symbol', 'date'])
>
>         merged = []
>         for sym in prices['symbol'].unique():
>             sym_prices = prices[prices['symbol'] == sym].copy()
>             sym_mcap = mcap[mcap['symbol'] == sym].copy()
>             if sym_mcap.empty:
>                 sym_prices['market_cap'] = np.nan
>             else:
>                 sym_prices = pd.merge_asof(
>                     sym_prices, sym_mcap[['date', 'market_cap']],
>                     on='date', direction='backward',
>                     tolerance=pd.Timedelta('7D')
>                 )
>             merged.append(sym_prices)
>
>         prices = pd.concat(merged, ignore_index=True)
>     else:
>         prices['market_cap'] = 1.0  # equal weight fallback
>
>     # --- 5. Cap-weighted daily index return per date ---
>     # Drop rows without a return (first day per stock) or without market cap
>     ret_df = prices.dropna(subset=['daily_ret']).copy()
>
>     def _cap_weighted_return(group):
>         mcaps = group['market_cap']
>         rets = group['daily_ret']
>         valid = mcaps.notna() & (mcaps > 0)
>         if valid.sum() == 0:
>             # fallback to equal weight for this date
>             return pd.Series({
>                 'daily_return': rets.mean(),
>                 'stocks_count': len(rets),
>             })
>         w = mcaps[valid]
>         r = rets[valid]
>         total_w = w.sum()
>         weighted_ret = (r * w).sum() / total_w
>         return pd.Series({
>             'daily_return': weighted_ret,
>             'stocks_count': valid.sum(),
>         })
>
>     idx_ret = ret_df.groupby('date').apply(_cap_weighted_return).reset_index()
>     idx_ret['stocks_count'] = idx_ret['stocks_count'].astype(int)
>     idx_ret = idx_ret.sort_values('date')
>
>     if idx_ret.empty:
>         return 0
>
>     # --- 6. Cumulative factor ---
>     idx_ret['cumulative_factor'] = (1 + idx_ret['daily_return']).cumprod()
>
>     # --- 7. Rolling returns ---
>     idx_ret['rolling_30d_return'] = (
>         (1 + idx_ret['daily_return']).rolling(30, min_periods=30).apply(np.prod, raw=True) - 1
>     )
>     idx_ret['rolling_90d_return'] = (
>         (1 + idx_ret['daily_return']).rolling(90, min_periods=90).apply(np.prod, raw=True) - 1
>     )
>
>     # --- 8. YTD return ---
>     idx_ret['year'] = idx_ret['date'].dt.year
>     ytd_returns = []
>     for _, year_df in idx_ret.groupby('year'):
>         ytd = (1 + year_df['daily_return']).cumprod() - 1
>         ytd_returns.append(ytd)
>     idx_ret['ytd_return'] = pd.concat(ytd_returns)
>     idx_ret.drop(columns=['year'], inplace=True)
>
>     # --- 9. Rolling 30d volatility (annualized) ---
>     idx_ret['rolling_30d_volatility'] = (
>         idx_ret['daily_return'].rolling(30, min_periods=30).std() * _ANNUALIZATION
>     )
>
>     # --- 10. Cap-weighted cross-sectional aggregates ---
>     if signals is not None:
>         # Clamp dividend_yield to [0, 0.15] — yfinance occasionally returns
>         # outlier values that skew the cap-weighted average. No stock in a
>         # major index realistically yields above 15%.
>         signals['dividend_yield'] = signals['dividend_yield'].clip(lower=0, upper=0.15)
>
>         def _cap_weighted_aggs(group):
>             mcaps = group['market_cap']
>             valid = mcaps.notna() & (mcaps > 0)
>             if valid.sum() == 0:
>                 return pd.Series({
>                     'avg_pe': np.nan, 'avg_pb': np.nan,
>                     'avg_dividend_yield': np.nan, 'avg_market_cap': np.nan,
>                 })
>             w = mcaps[valid]
>
>             def _wmean(col):
>                 vals = group.loc[valid, col]
>                 mask = vals.notna()
>                 if mask.sum() == 0:
>                     return np.nan
>                 return (vals[mask] * w[mask]).sum() / w[mask].sum()
>
>             def _whmean(col, floor=0.5):
>                 """Weighted harmonic mean — industry standard for P/E and P/B.
>                 Values below floor are excluded to prevent near-zero outliers
>                 (e.g. BRK-B P/B 0.001) from dominating the harmonic mean."""
>                 vals = group.loc[valid, col]
>                 mask = vals.notna() & (vals >= floor)
>                 if mask.sum() == 0:
>                     return np.nan
>                 return w[mask].sum() / (w[mask] / vals[mask]).sum()
>
>             return pd.Series({
>                 'avg_pe': _whmean('forward_pe'),
>                 'avg_pb': _whmean('price_to_book'),
>                 'avg_dividend_yield': _wmean('dividend_yield'),
>                 'avg_market_cap': w.mean(),
>             })
>
>         agg_df = signals.groupby('date').apply(_cap_weighted_aggs).reset_index()
>         agg_df = agg_df.sort_values('date')
>
>         idx_ret = pd.merge_asof(
>             idx_ret.sort_values('date'),
>             agg_df,
>             on='date',
>             direction='nearest',
>             tolerance=pd.Timedelta('3D')
>         )
>     else:
>         idx_ret['avg_pe'] = np.nan
>         idx_ret['avg_pb'] = np.nan
>         idx_ret['avg_dividend_yield'] = np.nan
>         idx_ret['avg_market_cap'] = np.nan
>
>     # Forward-fill aggregates (signals are daily snapshots, OHLCV has more dates)
>     for col in ['avg_pe', 'avg_pb', 'avg_dividend_yield', 'avg_market_cap']:
>         idx_ret[col] = idx_ret[col].ffill()
>
>     # --- 11. Filter to only new dates (incremental) ---
>     # Always refresh the last 7 days so late-arriving signals (PE, PB, yield)
>     # get merged onto existing OHLCV dates.
>     if max_existing:
>         max_existing_dt = pd.Timestamp(max_existing)
>         refresh_from = max_existing_dt - pd.Timedelta('7D')
>         cursor.execute("""
>             DELETE FROM gold.index_performance
>             WHERE _index = ? AND perf_date >= ?
>         """, key, refresh_from.strftime('%Y-%m-%d'))
>         idx_ret = idx_ret[idx_ret['date'] >= refresh_from]
>
>     if idx_ret.empty:
>         log_info(logger, "Index performance already up to date — no new dates",
>                  step="transform", index=key)
>         return 0
>
>     # --- 12. Insert into gold ---
>     idx_ret['_index'] = key
>
>     insert_cols = [
>         '_index', 'perf_date', 'daily_return', 'cumulative_factor',
>         'rolling_30d_return', 'rolling_90d_return', 'ytd_return',
>         'rolling_30d_volatility', 'stocks_count',
>         'avg_pe', 'avg_pb', 'avg_dividend_yield', 'avg_market_cap',
>     ]
>
>     placeholders = ', '.join(['?'] * len(insert_cols))
>     col_list = ', '.join(insert_cols)
>
>     rows = []
>     for _, row in idx_ret.iterrows():
>         rows.append((
>             key,
>             row['date'].strftime('%Y-%m-%d'),
>             _safe(row['daily_return']),
>             _safe(row['cumulative_factor']),
>             _safe(row['rolling_30d_return']),
>             _safe(row['rolling_90d_return']),
>             _safe(row['ytd_return']),
>             _safe(row['rolling_30d_volatility']),
>             int(row['stocks_count']) if pd.notna(row['stocks_count']) else None,
>             _safe(row['avg_pe']),
>             _safe(row['avg_pb']),
>             _safe(row['avg_dividend_yield']),
>             int(row['avg_market_cap']) if pd.notna(row['avg_market_cap']) else None,
>         ))
>
>     cursor.fast_executemany = True
>     cursor.executemany(
>         f"INSERT INTO gold.index_performance ({col_list}) VALUES ({placeholders})",
>         rows
>     )
>     inserted = len(rows)
>     conn.commit()
>
>     log_info(logger, "Index performance rows inserted",
>              step="transform", index=key, records_inserted=inserted)
>
>     return inserted
>
>
> def _safe(val):
>     """Convert pandas NaN/NaT to None for pyodbc."""
>     if val is None or (isinstance(val, float) and np.isnan(val)):
>         return None
>     return float(val)
>
>
> if __name__ == "__main__":
>     run()
> ```

> [!example]- `reset_recent_stoxx_demo_window.sql`
>
> *Deletes the recent replay window from bronze, silver, and gold so the pipeline can be rerun with observable fresh inserts.*
> ```sql
> :setvar DaysBack 3
>
> USE [stoxx];
> GO
>
> SET NOCOUNT ON;
>
> DECLARE @DaysBack int = TRY_CAST('$(DaysBack)' AS int);
>
> IF @DaysBack IS NULL OR @DaysBack < 1
> BEGIN
>     THROW 51000, 'DaysBack must be an integer >= 1.', 1;
> END;
>
> CREATE TABLE #results (
>     section_name nvarchar(64) NOT NULL,
>     table_name nvarchar(128) NOT NULL,
>     rows_before bigint NOT NULL,
>     rows_deleted bigint NOT NULL,
>     rows_after bigint NOT NULL,
>     window_start date NULL,
>     window_end date NULL
> );
>
> DECLARE @ohlcv_targets TABLE (
>     section_name nvarchar(64) NOT NULL,
>     schema_name sysname NOT NULL,
>     table_name sysname NOT NULL
> );
>
> INSERT INTO @ohlcv_targets (section_name, schema_name, table_name)
> VALUES
>     ('bronze_ohlcv', 'bronze', 'eurostoxx50_ohlcv'),
>     ('bronze_ohlcv', 'bronze', 'stoxxasia50_ohlcv'),
>     ('bronze_ohlcv', 'bronze', 'stoxxusa50_ohlcv'),
>     ('silver_ohlcv', 'silver', 'eurostoxx50_ohlcv'),
>     ('silver_ohlcv', 'silver', 'stoxxasia50_ohlcv'),
>     ('silver_ohlcv', 'silver', 'stoxxusa50_ohlcv');
>
> DECLARE
>     @section_name nvarchar(64),
>     @schema_name sysname,
>     @table_name sysname,
>     @sql nvarchar(max);
>
> DECLARE ohlcv_cursor CURSOR FAST_FORWARD FOR
>     SELECT section_name, schema_name, table_name
>     FROM @ohlcv_targets
>     ORDER BY section_name, table_name;
>
> OPEN ohlcv_cursor;
> FETCH NEXT FROM ohlcv_cursor INTO @section_name, @schema_name, @table_name;
>
> WHILE @@FETCH_STATUS = 0
> BEGIN
>     SET @sql = N'
> DECLARE @rows_before bigint = (SELECT COUNT(*) FROM ' + QUOTENAME(@schema_name) + N'.' + QUOTENAME(@table_name) + N');
> DECLARE @target_dates TABLE ([date] date PRIMARY KEY);
>
> INSERT INTO @target_dates ([date])
> SELECT [date]
> FROM (
>     SELECT DISTINCT
>         [date],
>         DENSE_RANK() OVER (ORDER BY [date] DESC) AS rn
>     FROM ' + QUOTENAME(@schema_name) + N'.' + QUOTENAME(@table_name) + N'
> ) AS ranked
> WHERE rn <= @DaysBack;
>
> DECLARE @window_start date = (SELECT MIN([date]) FROM @target_dates);
> DECLARE @window_end date = (SELECT MAX([date]) FROM @target_dates);
>
> DELETE tgt
> FROM ' + QUOTENAME(@schema_name) + N'.' + QUOTENAME(@table_name) + N' AS tgt
> INNER JOIN @target_dates AS td
>     ON td.[date] = tgt.[date];
>
> DECLARE @rows_deleted bigint = @@ROWCOUNT;
> DECLARE @rows_after bigint = (SELECT COUNT(*) FROM ' + QUOTENAME(@schema_name) + N'.' + QUOTENAME(@table_name) + N');
>
> INSERT INTO #results (section_name, table_name, rows_before, rows_deleted, rows_after, window_start, window_end)
> VALUES (@SectionName, @SchemaName + ''.'' + @TableName, @rows_before, @rows_deleted, @rows_after, @window_start, @window_end);';
>
>     EXEC sys.sp_executesql
>         @sql,
>         N'@DaysBack int, @SectionName nvarchar(64), @SchemaName sysname, @TableName sysname',
>         @DaysBack = @DaysBack,
>         @SectionName = @section_name,
>         @SchemaName = @schema_name,
>         @TableName = @table_name;
>
>     FETCH NEXT FROM ohlcv_cursor INTO @section_name, @schema_name, @table_name;
> END;
>
> CLOSE ohlcv_cursor;
> DEALLOCATE ohlcv_cursor;
>
> DECLARE @daily_dates TABLE ([date] date PRIMARY KEY);
> INSERT INTO @daily_dates ([date])
> SELECT signal_date
> FROM (
>     SELECT DISTINCT
>         signal_date,
>         DENSE_RANK() OVER (ORDER BY signal_date DESC) AS rn
>     FROM silver.signals_daily
>     WHERE _index IN ('euro_stoxx_50', 'stoxx_asia_50', 'stoxx_usa_50')
> ) AS ranked
> WHERE rn <= @DaysBack;
>
> DECLARE @rows_before bigint = (
>     SELECT COUNT(*)
>     FROM silver.signals_daily
>     WHERE _index IN ('euro_stoxx_50', 'stoxx_asia_50', 'stoxx_usa_50')
> );
>
> DELETE FROM silver.signals_daily
> WHERE _index IN ('euro_stoxx_50', 'stoxx_asia_50', 'stoxx_usa_50')
>   AND signal_date IN (SELECT [date] FROM @daily_dates);
>
> INSERT INTO #results
> SELECT
>     'silver_daily_signals',
>     'silver.signals_daily',
>     @rows_before,
>     @@ROWCOUNT,
>     (
>         SELECT COUNT(*)
>         FROM silver.signals_daily
>         WHERE _index IN ('euro_stoxx_50', 'stoxx_asia_50', 'stoxx_usa_50')
>     ),
>     (SELECT MIN([date]) FROM @daily_dates),
>     (SELECT MAX([date]) FROM @daily_dates);
>
> DECLARE @quarter_dates TABLE ([date] date PRIMARY KEY);
> INSERT INTO @quarter_dates ([date])
> SELECT as_of_date
> FROM (
>     SELECT DISTINCT
>         as_of_date,
>         DENSE_RANK() OVER (ORDER BY as_of_date DESC) AS rn
>     FROM silver.signals_quarterly
>     WHERE _index IN ('euro_stoxx_50', 'stoxx_asia_50', 'stoxx_usa_50')
> ) AS ranked
> WHERE rn = 1;
>
> SET @rows_before = (
>     SELECT COUNT(*)
>     FROM silver.signals_quarterly
>     WHERE _index IN ('euro_stoxx_50', 'stoxx_asia_50', 'stoxx_usa_50')
> );
>
> DELETE FROM silver.signals_quarterly
> WHERE _index IN ('euro_stoxx_50', 'stoxx_asia_50', 'stoxx_usa_50')
>   AND as_of_date IN (SELECT [date] FROM @quarter_dates);
>
> INSERT INTO #results
> SELECT
>     'silver_quarterly_signals',
>     'silver.signals_quarterly',
>     @rows_before,
>     @@ROWCOUNT,
>     (
>         SELECT COUNT(*)
>         FROM silver.signals_quarterly
>         WHERE _index IN ('euro_stoxx_50', 'stoxx_asia_50', 'stoxx_usa_50')
>     ),
>     (SELECT MIN([date]) FROM @quarter_dates),
>     (SELECT MAX([date]) FROM @quarter_dates);
>
> DECLARE @gold_perf_dates TABLE ([date] date PRIMARY KEY);
> INSERT INTO @gold_perf_dates ([date])
> SELECT perf_date
> FROM (
>     SELECT DISTINCT
>         perf_date,
>         DENSE_RANK() OVER (ORDER BY perf_date DESC) AS rn
>     FROM gold.index_performance
>     WHERE _index IN ('euro_stoxx_50', 'stoxx_asia_50', 'stoxx_usa_50')
> ) AS ranked
> WHERE rn <= @DaysBack;
>
> SET @rows_before = (
>     SELECT COUNT(*)
>     FROM gold.index_performance
>     WHERE _index IN ('euro_stoxx_50', 'stoxx_asia_50', 'stoxx_usa_50')
> );
>
> DELETE FROM gold.index_performance
> WHERE _index IN ('euro_stoxx_50', 'stoxx_asia_50', 'stoxx_usa_50')
>   AND perf_date IN (SELECT [date] FROM @gold_perf_dates);
>
> INSERT INTO #results
> SELECT
>     'gold_index_performance',
>     'gold.index_performance',
>     @rows_before,
>     @@ROWCOUNT,
>     (
>         SELECT COUNT(*)
>         FROM gold.index_performance
>         WHERE _index IN ('euro_stoxx_50', 'stoxx_asia_50', 'stoxx_usa_50')
>     ),
>     (SELECT MIN([date]) FROM @gold_perf_dates),
>     (SELECT MAX([date]) FROM @gold_perf_dates);
>
> DECLARE @gold_daily_dates TABLE ([date] date PRIMARY KEY);
> INSERT INTO @gold_daily_dates ([date])
> SELECT score_date
> FROM (
>     SELECT DISTINCT
>         score_date,
>         DENSE_RANK() OVER (ORDER BY score_date DESC) AS rn
>     FROM gold.scores_daily
>     WHERE _index IN ('euro_stoxx_50', 'stoxx_asia_50', 'stoxx_usa_50')
> ) AS ranked
> WHERE rn <= @DaysBack;
>
> SET @rows_before = (
>     SELECT COUNT(*)
>     FROM gold.scores_daily
>     WHERE _index IN ('euro_stoxx_50', 'stoxx_asia_50', 'stoxx_usa_50')
> );
>
> DELETE FROM gold.scores_daily
> WHERE _index IN ('euro_stoxx_50', 'stoxx_asia_50', 'stoxx_usa_50')
>   AND score_date IN (SELECT [date] FROM @gold_daily_dates);
>
> INSERT INTO #results
> SELECT
>     'gold_daily_scores',
>     'gold.scores_daily',
>     @rows_before,
>     @@ROWCOUNT,
>     (
>         SELECT COUNT(*)
>         FROM gold.scores_daily
>         WHERE _index IN ('euro_stoxx_50', 'stoxx_asia_50', 'stoxx_usa_50')
>     ),
>     (SELECT MIN([date]) FROM @gold_daily_dates),
>     (SELECT MAX([date]) FROM @gold_daily_dates);
>
> DECLARE @gold_quarter_dates TABLE ([date] date PRIMARY KEY);
> INSERT INTO @gold_quarter_dates ([date])
> SELECT as_of_date
> FROM (
>     SELECT DISTINCT
>         as_of_date,
>         DENSE_RANK() OVER (ORDER BY as_of_date DESC) AS rn
>     FROM gold.scores_quarterly
>     WHERE _index IN ('euro_stoxx_50', 'stoxx_asia_50', 'stoxx_usa_50')
> ) AS ranked
> WHERE rn = 1;
>
> SET @rows_before = (
>     SELECT COUNT(*)
>     FROM gold.scores_quarterly
>     WHERE _index IN ('euro_stoxx_50', 'stoxx_asia_50', 'stoxx_usa_50')
> );
>
> DELETE FROM gold.scores_quarterly
> WHERE _index IN ('euro_stoxx_50', 'stoxx_asia_50', 'stoxx_usa_50')
>   AND as_of_date IN (SELECT [date] FROM @gold_quarter_dates);
>
> INSERT INTO #results
> SELECT
>     'gold_quarterly_scores',
>     'gold.scores_quarterly',
>     @rows_before,
>     @@ROWCOUNT,
>     (
>         SELECT COUNT(*)
>         FROM gold.scores_quarterly
>         WHERE _index IN ('euro_stoxx_50', 'stoxx_asia_50', 'stoxx_usa_50')
>     ),
>     (SELECT MIN([date]) FROM @gold_quarter_dates),
>     (SELECT MAX([date]) FROM @gold_quarter_dates);
>
> SELECT section_name, table_name, rows_before, rows_deleted, rows_after, window_start, window_end
> FROM #results
> ORDER BY section_name, table_name;
> GO
> ```

> [!example]- `reset_recent_stoxx_demo_window.ps1`
>
> *Uploads the reset SQL to the VM and executes it remotely through the break-glass SQL login.*
> ```powershell
> param(
>     [int]$DaysBack = 3,
>     [string]$ProjectId = "bq-wh-nb",
>     [string]$Zone = "europe-west1-b",
>     [string]$VmName = "stoxx-vm",
>     [string]$LocalSqlPath = "C:\Users\aperi\My Drive\VAULT\.codex-temp\stoxx-transforms\reset_recent_stoxx_demo_window.sql",
>     [string]$RemoteSqlPath = "/tmp/reset_recent_stoxx_demo_window.sql",
>     [string]$RemoteHelperPath = "/tmp/run_reset_recent_stoxx_demo_window.sh"
> )
>
> $ErrorActionPreference = "Stop"
>
> if ($DaysBack -lt 1) {
>     throw "DaysBack must be >= 1."
> }
>
> Write-Host "Uploading $LocalSqlPath to ${VmName}:$RemoteSqlPath"
> & gcloud compute scp `
>     --project=$ProjectId `
>     --zone=$Zone `
>     --tunnel-through-iap `
>     $LocalSqlPath `
>     "${VmName}:${RemoteSqlPath}"
>
> Write-Host "Preparing remote helper $RemoteHelperPath"
> $helperTemplate = @'
> #!/usr/bin/env bash
> set -euo pipefail
> sed -i 's/\r$//' {0}
> source /root/.stoxx_sql_login.env
> /opt/mssql-tools18/bin/sqlcmd -C -S tcp:localhost,1433 -U "$BREAK_GLASS_LOGIN" -P "$BREAK_GLASS_PWD" -d stoxx -i {0} -v DaysBack={1}
> '@
>
> $helperContent = $helperTemplate -f $RemoteSqlPath, $DaysBack
> $localHelperPath = Join-Path $env:TEMP "run_reset_recent_stoxx_demo_window.sh"
> [System.IO.File]::WriteAllText($localHelperPath, ($helperContent -replace "`r`n", "`n"), [System.Text.UTF8Encoding]::new($false))
>
> & gcloud compute scp `
>     --project=$ProjectId `
>     --zone=$Zone `
>     --tunnel-through-iap `
>     $localHelperPath `
>     "${VmName}:${RemoteHelperPath}"
>
> Write-Host "Executing reset script on $VmName for the last $DaysBack daily windows and latest quarterly windows"
> & gcloud compute ssh `
>     $VmName `
>     --project=$ProjectId `
>     --zone=$Zone `
>     --tunnel-through-iap `
>     --command "sudo bash $RemoteHelperPath"
> ```

### Orchestration

> [!example]- `docker-compose.yaml`
>
> *Defines the Airflow 3.2 Docker Compose deployment used on the orchestration VM.*
> ```yaml
> ---
> x-airflow-common:
>   &airflow-common
>   image: ${AIRFLOW_IMAGE_NAME:-stoxx-airflow:3.2.0}
>   build: .
>   env_file:
>     - .env
>   environment:
>     &airflow-common-env
>     AIRFLOW__CORE__EXECUTOR: CeleryExecutor
>     AIRFLOW__CORE__AUTH_MANAGER: airflow.providers.fab.auth_manager.fab_auth_manager.FabAuthManager
>     AIRFLOW__DATABASE__SQL_ALCHEMY_CONN: postgresql+psycopg2://airflow:airflow@postgres/airflow
>     AIRFLOW__CELERY__RESULT_BACKEND: db+postgresql+psycopg2://airflow:airflow@postgres/airflow
>     AIRFLOW__CELERY__BROKER_URL: redis://:@redis:6379/0
>     AIRFLOW__CORE__FERNET_KEY: ${FERNET_KEY}
>     AIRFLOW__CORE__DAGS_ARE_PAUSED_AT_CREATION: "true"
>     AIRFLOW__CORE__LOAD_EXAMPLES: "false"
>     AIRFLOW__CORE__EXECUTION_API_SERVER_URL: "http://airflow-apiserver:8080/execution/"
>     AIRFLOW__API_AUTH__JWT_SECRET: ${AIRFLOW__API_AUTH__JWT_SECRET}
>     AIRFLOW__API_AUTH__JWT_ISSUER: ${AIRFLOW__API_AUTH__JWT_ISSUER:-airflow}
>     AIRFLOW__SCHEDULER__ENABLE_HEALTH_CHECK: "true"
>     AIRFLOW_CONFIG: "/opt/airflow/config/airflow.cfg"
>     GCP_PROJECT_ID: ${GCP_PROJECT_ID}
>     GCP_REGION: ${GCP_REGION}
>     STAGE_BUCKET: ${STAGE_BUCKET}
>     STAGE_FETCH_JOB: ${STAGE_FETCH_JOB}
>     STAGE_LOAD_JOB: ${STAGE_LOAD_JOB}
>     TRANSFORM_JOB: ${TRANSFORM_JOB}
>     SERVING_JOB: ${SERVING_JOB:-stoxx-serving}
>   volumes:
>     - ${AIRFLOW_PROJ_DIR:-.}/dags:/opt/airflow/dags
>     - ${AIRFLOW_PROJ_DIR:-.}/logs:/opt/airflow/logs
>     - ${AIRFLOW_PROJ_DIR:-.}/config:/opt/airflow/config
>     - ${AIRFLOW_PROJ_DIR:-.}/plugins:/opt/airflow/plugins
>   user: "${AIRFLOW_UID:-50000}:0"
>   depends_on:
>     &airflow-common-depends-on
>     redis:
>       condition: service_healthy
>     postgres:
>       condition: service_healthy
>
> services:
>   postgres:
>     image: postgres:16
>     environment:
>       POSTGRES_USER: airflow
>       POSTGRES_PASSWORD: airflow
>       POSTGRES_DB: airflow
>     volumes:
>       - postgres-db-volume:/var/lib/postgresql/data
>     healthcheck:
>       test: ["CMD", "pg_isready", "-U", "airflow"]
>       interval: 10s
>       retries: 5
>       start_period: 5s
>     restart: always
>
>   redis:
>     image: redis:7.2-bookworm
>     expose:
>       - 6379
>     healthcheck:
>       test: ["CMD", "redis-cli", "ping"]
>       interval: 10s
>       timeout: 30s
>       retries: 50
>       start_period: 30s
>     restart: always
>
>   airflow-apiserver:
>     <<: *airflow-common
>     command: api-server
>     ports:
>       - "8080:8080"
>     healthcheck:
>       test: ["CMD", "curl", "--fail", "http://localhost:8080/api/v2/monitor/health"]
>       interval: 30s
>       timeout: 10s
>       retries: 5
>       start_period: 30s
>     restart: always
>     depends_on:
>       <<: *airflow-common-depends-on
>       airflow-init:
>         condition: service_completed_successfully
>
>   airflow-scheduler:
>     <<: *airflow-common
>     command: scheduler
>     healthcheck:
>       test: ["CMD", "curl", "--fail", "http://localhost:8974/health"]
>       interval: 30s
>       timeout: 10s
>       retries: 5
>       start_period: 30s
>     restart: always
>     depends_on:
>       <<: *airflow-common-depends-on
>       airflow-init:
>         condition: service_completed_successfully
>
>   airflow-dag-processor:
>     <<: *airflow-common
>     command: dag-processor
>     healthcheck:
>       test: ["CMD-SHELL", "airflow jobs check --job-type DagProcessorJob --hostname \"$$HOSTNAME\""]
>       interval: 30s
>       timeout: 10s
>       retries: 5
>       start_period: 30s
>     restart: always
>     depends_on:
>       <<: *airflow-common-depends-on
>       airflow-init:
>         condition: service_completed_successfully
>
>   airflow-worker:
>     <<: *airflow-common
>     command: celery worker
>     healthcheck:
>       test: ["CMD-SHELL", "celery --app airflow.providers.celery.executors.celery_executor.app inspect ping -d \"celery@$$HOSTNAME\" || celery --app airflow.executors.celery_executor.app inspect ping -d \"celery@$$HOSTNAME\""]
>       interval: 30s
>       timeout: 10s
>       retries: 5
>       start_period: 30s
>     environment:
>       <<: *airflow-common-env
>       DUMB_INIT_SETSID: "0"
>     restart: always
>     depends_on:
>       <<: *airflow-common-depends-on
>       airflow-apiserver:
>         condition: service_healthy
>       airflow-init:
>         condition: service_completed_successfully
>
>   airflow-triggerer:
>     <<: *airflow-common
>     command: triggerer
>     healthcheck:
>       test: ["CMD-SHELL", "airflow jobs check --job-type TriggererJob --hostname \"$$HOSTNAME\""]
>       interval: 30s
>       timeout: 10s
>       retries: 5
>       start_period: 30s
>     restart: always
>     depends_on:
>       <<: *airflow-common-depends-on
>       airflow-init:
>         condition: service_completed_successfully
>
>   airflow-init:
>     <<: *airflow-common
>     entrypoint: /bin/bash
>     command:
>       - -c
>       - |
>         mkdir -p /opt/airflow/{logs,dags,plugins,config}
>         /entrypoint airflow config list >/dev/null
>         chown -R "${AIRFLOW_UID}:0" /opt/airflow/logs /opt/airflow/dags /opt/airflow/plugins /opt/airflow/config
>     environment:
>       <<: *airflow-common-env
>       _AIRFLOW_DB_MIGRATE: "true"
>       _AIRFLOW_WWW_USER_CREATE: "true"
>       _AIRFLOW_WWW_USER_USERNAME: ${_AIRFLOW_WWW_USER_USERNAME:-admin}
>       _AIRFLOW_WWW_USER_PASSWORD: ${_AIRFLOW_WWW_USER_PASSWORD:-admin}
>     user: "0:0"
>
>   airflow-cli:
>     <<: *airflow-common
>     profiles:
>       - debug
>     environment:
>       <<: *airflow-common-env
>       CONNECTION_CHECK_MAX_COUNT: "0"
>     command:
>       - bash
>       - -c
>       - airflow
>
> volumes:
>   postgres-db-volume:
> ```

> [!example]- `stoxx_stage_yfinance.py`
>
> *Defines the end-to-end Airflow DAG that orchestrates fetch, load, transform, serving, and validation steps.*
> ```python
> """Manual Airflow DAG that triggers the Cloud Run yfinance fetch job."""
>
> from __future__ import annotations
>
> import os
> from datetime import timedelta
>
> from airflow import DAG
> from airflow.providers.google.cloud.operators.cloud_run import CloudRunExecuteJobOperator
> import pendulum
>
>
> PROJECT_ID = os.environ.get("GCP_PROJECT_ID", "bq-wh-nb")
> REGION = os.environ.get("GCP_REGION", "europe-west1")
> FETCH_JOB_NAME = os.environ.get("STAGE_FETCH_JOB", "stoxx-stage-fetch")
> LOAD_JOB_NAME = os.environ.get("STAGE_LOAD_JOB", "stoxx-bronze-load")
> TRANSFORM_JOB_NAME = os.environ.get("TRANSFORM_JOB", "stoxx-transforms")
> SERVING_JOB_NAME = os.environ.get("SERVING_JOB", "stoxx-serving")
>
>
> with DAG(
>     dag_id="stoxx_stage_yfinance",
>     description="Fetch STOXX bronze-stage JSON from yfinance into GCS via Cloud Run",
>     start_date=pendulum.datetime(2026, 4, 13, tz="Europe/Prague"),
>     schedule=None,
>     catchup=False,
>     max_active_runs=1,
>     default_args={
>         "retries": 1,
>         "retry_delay": timedelta(minutes=5),
>         "execution_timeout": timedelta(minutes=45),
>     },
>     tags=["stoxx", "bronze", "gcs", "yfinance", "cloud-run"],
> ) as dag:
>     fetch_bronze_stage_into_gcs = CloudRunExecuteJobOperator(
>         task_id="fetch_bronze_stage_into_gcs",
>         project_id=PROJECT_ID,
>         region=REGION,
>         job_name=FETCH_JOB_NAME,
>         deferrable=False,
>         overrides={
>             "task_count": 1,
>             "container_overrides": [{
>                 "clear_args": False,
>             }],
>         },
>     )
>
>     load_bronze_into_sql = CloudRunExecuteJobOperator(
>         task_id="load_bronze_into_sql",
>         project_id=PROJECT_ID,
>         region=REGION,
>         job_name=LOAD_JOB_NAME,
>         deferrable=False,
>         overrides={
>             "task_count": 1,
>             "container_overrides": [{
>                 "clear_args": False,
>             }],
>         },
>     )
>
>     transform_ohlcv_to_silver = CloudRunExecuteJobOperator(
>         task_id="transform_ohlcv_to_silver",
>         project_id=PROJECT_ID,
>         region=REGION,
>         job_name=TRANSFORM_JOB_NAME,
>         deferrable=False,
>         overrides={
>             "task_count": 1,
>             "container_overrides": [{
>                 "clear_args": False,
>                 "args": ["--step=3"],
>             }],
>         },
>     )
>
>     transform_signals_daily_to_silver = CloudRunExecuteJobOperator(
>         task_id="transform_signals_daily_to_silver",
>         project_id=PROJECT_ID,
>         region=REGION,
>         job_name=TRANSFORM_JOB_NAME,
>         deferrable=False,
>         overrides={
>             "task_count": 1,
>             "container_overrides": [{
>                 "clear_args": False,
>                 "args": ["--step=8"],
>             }],
>         },
>     )
>
>     transform_signals_quarterly_to_silver = CloudRunExecuteJobOperator(
>         task_id="transform_signals_quarterly_to_silver",
>         project_id=PROJECT_ID,
>         region=REGION,
>         job_name=TRANSFORM_JOB_NAME,
>         deferrable=False,
>         overrides={
>             "task_count": 1,
>             "container_overrides": [{
>                 "clear_args": False,
>                 "args": ["--step=9"],
>             }],
>         },
>     )
>
>     build_gold_scores = CloudRunExecuteJobOperator(
>         task_id="build_gold_scores",
>         project_id=PROJECT_ID,
>         region=REGION,
>         job_name=TRANSFORM_JOB_NAME,
>         deferrable=False,
>         overrides={
>             "task_count": 1,
>             "container_overrides": [{
>                 "clear_args": False,
>                 "args": ["--from=14", "--to=15"],
>             }],
>         },
>     )
>
>     build_gold_index_performance = CloudRunExecuteJobOperator(
>         task_id="build_gold_index_performance",
>         project_id=PROJECT_ID,
>         region=REGION,
>         job_name=TRANSFORM_JOB_NAME,
>         deferrable=False,
>         overrides={
>             "task_count": 1,
>             "container_overrides": [{
>                 "clear_args": False,
>                 "args": ["--step=16"],
>             }],
>         },
>     )
>
>     sync_gold_to_bigquery = CloudRunExecuteJobOperator(
>         task_id="sync_gold_to_bigquery",
>         project_id=PROJECT_ID,
>         region=REGION,
>         job_name=SERVING_JOB_NAME,
>         deferrable=False,
>         overrides={
>             "task_count": 1,
>             "container_overrides": [{
>                 "clear_args": False,
>                 "args": ["--mode=sync-replica"],
>             }],
>         },
>     )
>
>     build_bigquery_marts = CloudRunExecuteJobOperator(
>         task_id="build_bigquery_marts",
>         project_id=PROJECT_ID,
>         region=REGION,
>         job_name=SERVING_JOB_NAME,
>         deferrable=False,
>         overrides={
>             "task_count": 1,
>             "container_overrides": [{
>                 "clear_args": False,
>                 "args": ["--mode=build-marts"],
>             }],
>         },
>     )
>
>     publish_serving_to_firestore = CloudRunExecuteJobOperator(
>         task_id="publish_serving_to_firestore",
>         project_id=PROJECT_ID,
>         region=REGION,
>         job_name=SERVING_JOB_NAME,
>         deferrable=False,
>         overrides={
>             "task_count": 1,
>             "container_overrides": [{
>                 "clear_args": False,
>                 "args": ["--mode=publish-firestore"],
>             }],
>         },
>     )
>
>     validate_serving_layer = CloudRunExecuteJobOperator(
>         task_id="validate_serving_layer",
>         project_id=PROJECT_ID,
>         region=REGION,
>         job_name=SERVING_JOB_NAME,
>         deferrable=False,
>         overrides={
>             "task_count": 1,
>             "container_overrides": [{
>                 "clear_args": False,
>                 "args": ["--mode=validate"],
>             }],
>         },
>     )
>
>     fetch_bronze_stage_into_gcs >> load_bronze_into_sql
>     load_bronze_into_sql >> [
>         transform_ohlcv_to_silver,
>         transform_signals_daily_to_silver,
>         transform_signals_quarterly_to_silver,
>     ]
>     [
>         transform_ohlcv_to_silver,
>         transform_signals_daily_to_silver,
>         transform_signals_quarterly_to_silver,
>     ] >> build_gold_scores >> build_gold_index_performance
>     build_gold_index_performance >> sync_gold_to_bigquery >> build_bigquery_marts
>     build_bigquery_marts >> publish_serving_to_firestore >> validate_serving_layer
> ```

### Serving and events

> [!example]- `stoxx_serving.py`
>
> *Syncs SQL replicas into BigQuery, builds marts, publishes Firestore documents, and validates the serving layer.*
> ```python
> from __future__ import annotations
>
> import argparse
> import json
> import logging
> import os
> import re
> from dataclasses import dataclass
> from datetime import UTC, date, datetime
> from decimal import Decimal
> from typing import Any
>
> from google.cloud import bigquery
> from google.cloud import firestore
> from google.cloud.bigquery import SchemaField, TimePartitioning
> import pyodbc
>
>
> LOGGER = logging.getLogger("stoxx-serving")
> VALID_INDEXES = ("euro_stoxx_50", "stoxx_asia_50", "stoxx_usa_50")
>
>
> @dataclass(frozen=True)
> class ReplicaTable:
>     dataset: str
>     table: str
>     query: str
>     schema: list[SchemaField]
>     partition_field: str | None = None
>     clustering_fields: list[str] | None = None
>
>     @property
>     def fq_name(self) -> str:
>         project = os.environ.get("GCP_PROJECT_ID", os.environ.get("GOOGLE_CLOUD_PROJECT", "bq-wh-nb"))
>         return f"{project}.{self.dataset}.{self.table}"
>
>
> def configure_logging() -> None:
>     logging.basicConfig(
>         level=os.environ.get("LOG_LEVEL", "INFO").upper(),
>         format="%(asctime)s %(levelname)s %(name)s %(message)s",
>     )
>
>
> def get_env(name: str, default: str | None = None) -> str:
>     value = os.environ.get(name, default)
>     if value is None or value == "":
>         raise RuntimeError(f"Missing required environment variable: {name}")
>     return value
>
>
> def get_sql_connection() -> pyodbc.Connection:
>     host = get_env("SQL_HOST")
>     port = os.environ.get("SQL_PORT", "1433")
>     database = os.environ.get("SQL_DATABASE", "stoxx")
>     user = get_env("SQL_USER")
>     password = get_env("SQL_PASSWORD")
>     driver = os.environ.get("SQL_DRIVER", "ODBC Driver 18 for SQL Server")
>
>     conn_str = (
>         f"DRIVER={{{driver}}};"
>         f"SERVER={host},{port};"
>         f"DATABASE={database};"
>         f"UID={user};"
>         f"PWD={password};"
>         "Encrypt=yes;"
>         "TrustServerCertificate=yes;"
>     )
>     return pyodbc.connect(conn_str, autocommit=False)
>
>
> def get_bq_client() -> bigquery.Client:
>     project = os.environ.get("GCP_PROJECT_ID", os.environ.get("GOOGLE_CLOUD_PROJECT", "bq-wh-nb"))
>     return bigquery.Client(project=project)
>
>
> def get_firestore_client() -> firestore.Client:
>     project = os.environ.get("GCP_PROJECT_ID", os.environ.get("GOOGLE_CLOUD_PROJECT", "bq-wh-nb"))
>     database = os.environ.get("FIRESTORE_DATABASE", "main")
>     return firestore.Client(project=project, database=database)
>
>
> def ensure_dataset(client: bigquery.Client, dataset_id: str) -> None:
>     project = client.project
>     location = os.environ.get("BQ_LOCATION", "europe-west1")
>     dataset_ref = bigquery.Dataset(f"{project}.{dataset_id}")
>     dataset_ref.location = location
>     client.create_dataset(dataset_ref, exists_ok=True)
>     LOGGER.info("Ensured dataset %s in %s", dataset_id, location)
>
>
> def ensure_table(client: bigquery.Client, spec: ReplicaTable) -> None:
>     client.delete_table(spec.fq_name, not_found_ok=True)
>     table = bigquery.Table(spec.fq_name, schema=spec.schema)
>     if spec.partition_field:
>         table.time_partitioning = TimePartitioning(field=spec.partition_field)
>     if spec.clustering_fields:
>         table.clustering_fields = spec.clustering_fields
>     client.create_table(table, exists_ok=True)
>     LOGGER.info("Recreated table %s", spec.fq_name)
>
>
> def normalize_scalar(value: Any) -> Any:
>     if isinstance(value, Decimal):
>         return float(value)
>     if isinstance(value, (datetime, date)):
>         return value.isoformat()
>     if isinstance(value, bytes):
>         return value.decode("utf-8")
>     return value
>
>
> def fetch_rows(conn: pyodbc.Connection, query: str) -> list[dict[str, Any]]:
>     cursor = conn.cursor()
>     cursor.execute(query)
>     columns = [column[0] for column in cursor.description]
>     rows = []
>     for raw in cursor.fetchall():
>         item = {}
>         for index, col in enumerate(columns):
>             item[col] = normalize_scalar(raw[index])
>         rows.append(item)
>     cursor.close()
>     return rows
>
>
> def load_rows(
>     client: bigquery.Client,
>     spec: ReplicaTable,
>     rows: list[dict[str, Any]],
> ) -> None:
>     job_config = bigquery.LoadJobConfig(
>         schema=spec.schema,
>         write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
>     )
>     load_job = client.load_table_from_json(rows, spec.fq_name, job_config=job_config)
>     load_job.result()
>     table = client.get_table(spec.fq_name)
>     LOGGER.info("Loaded %s rows into %s", table.num_rows, spec.fq_name)
>
>
> def run_bq_query(client: bigquery.Client, sql: str) -> list[bigquery.table.Row]:
>     LOGGER.info("Running BigQuery SQL:\n%s", sql)
>     query_job = client.query(sql)
>     result = list(query_job.result())
>     LOGGER.info("BigQuery query completed with %s rows returned", len(result))
>     return result
>
>
> def slugify(value: str) -> str:
>     slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
>     return slug or "unknown"
>
>
> def batched_commit(db: firestore.Client, operations: list[tuple[str, firestore.DocumentReference, Any]]) -> None:
>     if not operations:
>         return
>     batch = db.batch()
>     count = 0
>     for op, ref, payload in operations:
>         if op == "set":
>             batch.set(ref, payload)
>         elif op == "delete":
>             batch.delete(ref)
>         else:
>             raise ValueError(f"Unsupported Firestore batch operation: {op}")
>         count += 1
>         if count == 400:
>             batch.commit()
>             batch = db.batch()
>             count = 0
>     if count:
>         batch.commit()
>
>
> def table_specs() -> list[ReplicaTable]:
>     silver_dataset = os.environ.get("BQ_SILVER_DATASET", "stoxx_silver")
>     gold_dataset = os.environ.get("BQ_GOLD_DATASET", "stoxx_gold")
>     return [
>         ReplicaTable(
>             dataset=silver_dataset,
>             table="index_dim",
>             query="""
>                 SELECT
>                     id, _index, symbol, long_name, short_name, sector, sector_key,
>                     industry, industry_key, country, city, website, long_business_summary,
>                     exchange, full_exchange_name, exchange_timezone_name,
>                     exchange_timezone_short, currency, financial_currency, quote_type,
>                     market, range_start, price_data_start, valid_from, valid_to, is_current
>                 FROM silver.index_dim
>                 WHERE _index IN ('euro_stoxx_50', 'stoxx_asia_50', 'stoxx_usa_50')
>             """,
>             schema=[
>                 SchemaField("id", "INT64"),
>                 SchemaField("_index", "STRING"),
>                 SchemaField("symbol", "STRING"),
>                 SchemaField("long_name", "STRING"),
>                 SchemaField("short_name", "STRING"),
>                 SchemaField("sector", "STRING"),
>                 SchemaField("sector_key", "STRING"),
>                 SchemaField("industry", "STRING"),
>                 SchemaField("industry_key", "STRING"),
>                 SchemaField("country", "STRING"),
>                 SchemaField("city", "STRING"),
>                 SchemaField("website", "STRING"),
>                 SchemaField("long_business_summary", "STRING"),
>                 SchemaField("exchange", "STRING"),
>                 SchemaField("full_exchange_name", "STRING"),
>                 SchemaField("exchange_timezone_name", "STRING"),
>                 SchemaField("exchange_timezone_short", "STRING"),
>                 SchemaField("currency", "STRING"),
>                 SchemaField("financial_currency", "STRING"),
>                 SchemaField("quote_type", "STRING"),
>                 SchemaField("market", "STRING"),
>                 SchemaField("range_start", "DATE"),
>                 SchemaField("price_data_start", "DATE"),
>                 SchemaField("valid_from", "TIMESTAMP"),
>                 SchemaField("valid_to", "TIMESTAMP"),
>                 SchemaField("is_current", "BOOL"),
>             ],
>             clustering_fields=["_index", "symbol", "is_current"],
>         ),
>         ReplicaTable(
>             dataset=gold_dataset,
>             table="scores_daily",
>             query="""
>                 SELECT
>                     id, _index, symbol, score_date, sector,
>                     pe_zscore, pb_zscore, ev_ebitda_zscore, yield_zscore,
>                     relative_value_score, relative_value_rank,
>                     relative_strength, sma_50_ratio, sma_200_ratio, dist_from_52w_high,
>                     momentum_score, momentum_rank,
>                     implied_upside, recommendation_mean, price_falling_analysts_bullish,
>                     sentiment_score, sentiment_rank,
>                     composite_score, composite_rank, _scored_at,
>                     sma_30_close, sma_90_close, market_cap, index_weight,
>                     short_name, country, current_price, day_change_pct,
>                     five_day_change_pct, ytd_change_pct, currency
>                 FROM gold.scores_daily
>                 WHERE _index IN ('euro_stoxx_50', 'stoxx_asia_50', 'stoxx_usa_50')
>             """,
>             schema=[
>                 SchemaField("id", "INT64"),
>                 SchemaField("_index", "STRING"),
>                 SchemaField("symbol", "STRING"),
>                 SchemaField("score_date", "DATE"),
>                 SchemaField("sector", "STRING"),
>                 SchemaField("pe_zscore", "FLOAT64"),
>                 SchemaField("pb_zscore", "FLOAT64"),
>                 SchemaField("ev_ebitda_zscore", "FLOAT64"),
>                 SchemaField("yield_zscore", "FLOAT64"),
>                 SchemaField("relative_value_score", "FLOAT64"),
>                 SchemaField("relative_value_rank", "INT64"),
>                 SchemaField("relative_strength", "FLOAT64"),
>                 SchemaField("sma_50_ratio", "FLOAT64"),
>                 SchemaField("sma_200_ratio", "FLOAT64"),
>                 SchemaField("dist_from_52w_high", "FLOAT64"),
>                 SchemaField("momentum_score", "FLOAT64"),
>                 SchemaField("momentum_rank", "INT64"),
>                 SchemaField("implied_upside", "FLOAT64"),
>                 SchemaField("recommendation_mean", "FLOAT64"),
>                 SchemaField("price_falling_analysts_bullish", "BOOL"),
>                 SchemaField("sentiment_score", "FLOAT64"),
>                 SchemaField("sentiment_rank", "INT64"),
>                 SchemaField("composite_score", "FLOAT64"),
>                 SchemaField("composite_rank", "INT64"),
>                 SchemaField("_scored_at", "TIMESTAMP"),
>                 SchemaField("sma_30_close", "FLOAT64"),
>                 SchemaField("sma_90_close", "FLOAT64"),
>                 SchemaField("market_cap", "INT64"),
>                 SchemaField("index_weight", "FLOAT64"),
>                 SchemaField("short_name", "STRING"),
>                 SchemaField("country", "STRING"),
>                 SchemaField("current_price", "FLOAT64"),
>                 SchemaField("day_change_pct", "FLOAT64"),
>                 SchemaField("five_day_change_pct", "FLOAT64"),
>                 SchemaField("ytd_change_pct", "FLOAT64"),
>                 SchemaField("currency", "STRING"),
>             ],
>             partition_field="score_date",
>             clustering_fields=["_index", "symbol", "sector"],
>         ),
>         ReplicaTable(
>             dataset=gold_dataset,
>             table="scores_quarterly",
>             query="""
>                 SELECT
>                     id, _index, symbol, as_of_date, sector,
>                     gross_margin_zscore, roe_zscore, operating_margin_zscore,
>                     leverage_zscore, fcf_yield, fcf_yield_zscore,
>                     quality_score, quality_rank,
>                     flag_liquidity, flag_leverage, flag_cashburn, flag_double_decline,
>                     health_flags_count, health_risk_level,
>                     overall_risk, audit_risk, board_risk, compensation_risk,
>                     shareholder_rights_risk, governance_score, governance_rank,
>                     beta, governance_vs_quality, _scored_at
>                 FROM gold.scores_quarterly
>                 WHERE _index IN ('euro_stoxx_50', 'stoxx_asia_50', 'stoxx_usa_50')
>             """,
>             schema=[
>                 SchemaField("id", "INT64"),
>                 SchemaField("_index", "STRING"),
>                 SchemaField("symbol", "STRING"),
>                 SchemaField("as_of_date", "DATE"),
>                 SchemaField("sector", "STRING"),
>                 SchemaField("gross_margin_zscore", "FLOAT64"),
>                 SchemaField("roe_zscore", "FLOAT64"),
>                 SchemaField("operating_margin_zscore", "FLOAT64"),
>                 SchemaField("leverage_zscore", "FLOAT64"),
>                 SchemaField("fcf_yield", "FLOAT64"),
>                 SchemaField("fcf_yield_zscore", "FLOAT64"),
>                 SchemaField("quality_score", "FLOAT64"),
>                 SchemaField("quality_rank", "INT64"),
>                 SchemaField("flag_liquidity", "BOOL"),
>                 SchemaField("flag_leverage", "BOOL"),
>                 SchemaField("flag_cashburn", "BOOL"),
>                 SchemaField("flag_double_decline", "BOOL"),
>                 SchemaField("health_flags_count", "INT64"),
>                 SchemaField("health_risk_level", "STRING"),
>                 SchemaField("overall_risk", "FLOAT64"),
>                 SchemaField("audit_risk", "FLOAT64"),
>                 SchemaField("board_risk", "FLOAT64"),
>                 SchemaField("compensation_risk", "FLOAT64"),
>                 SchemaField("shareholder_rights_risk", "FLOAT64"),
>                 SchemaField("governance_score", "FLOAT64"),
>                 SchemaField("governance_rank", "INT64"),
>                 SchemaField("beta", "FLOAT64"),
>                 SchemaField("governance_vs_quality", "FLOAT64"),
>                 SchemaField("_scored_at", "TIMESTAMP"),
>             ],
>             partition_field="as_of_date",
>             clustering_fields=["_index", "symbol", "sector"],
>         ),
>         ReplicaTable(
>             dataset=gold_dataset,
>             table="index_performance",
>             query="""
>                 SELECT
>                     id, _index, perf_date, daily_return, cumulative_factor,
>                     rolling_30d_return, rolling_90d_return, ytd_return,
>                     rolling_30d_volatility, stocks_count, avg_pe, avg_pb,
>                     avg_dividend_yield, avg_market_cap, _computed_at
>                 FROM gold.index_performance
>                 WHERE _index IN ('euro_stoxx_50', 'stoxx_asia_50', 'stoxx_usa_50')
>             """,
>             schema=[
>                 SchemaField("id", "INT64"),
>                 SchemaField("_index", "STRING"),
>                 SchemaField("perf_date", "DATE"),
>                 SchemaField("daily_return", "FLOAT64"),
>                 SchemaField("cumulative_factor", "FLOAT64"),
>                 SchemaField("rolling_30d_return", "FLOAT64"),
>                 SchemaField("rolling_90d_return", "FLOAT64"),
>                 SchemaField("ytd_return", "FLOAT64"),
>                 SchemaField("rolling_30d_volatility", "FLOAT64"),
>                 SchemaField("stocks_count", "INT64"),
>                 SchemaField("avg_pe", "FLOAT64"),
>                 SchemaField("avg_pb", "FLOAT64"),
>                 SchemaField("avg_dividend_yield", "FLOAT64"),
>                 SchemaField("avg_market_cap", "INT64"),
>                 SchemaField("_computed_at", "TIMESTAMP"),
>             ],
>             partition_field="perf_date",
>             clustering_fields=["_index"],
>         ),
>     ]
>
>
> def sync_replica_tables() -> None:
>     bq_client = get_bq_client()
>     ensure_dataset(bq_client, os.environ.get("BQ_SILVER_DATASET", "stoxx_silver"))
>     ensure_dataset(bq_client, os.environ.get("BQ_GOLD_DATASET", "stoxx_gold"))
>
>     conn = get_sql_connection()
>     try:
>         for spec in table_specs():
>             ensure_table(bq_client, spec)
>             rows = fetch_rows(conn, spec.query)
>             load_rows(bq_client, spec, rows)
>     finally:
>         conn.close()
>
>
> def mart_sql(project: str, marts_dataset: str, silver_dataset: str, gold_dataset: str) -> list[str]:
>     screener = f"""
> CREATE OR REPLACE TABLE `{project}.{marts_dataset}.mart_constituent_screener_latest`
> CLUSTER BY _index, sector, symbol AS
> WITH latest_daily AS (
>   SELECT * EXCEPT(rn)
>   FROM (
>     SELECT sd.*, ROW_NUMBER() OVER (PARTITION BY _index, symbol ORDER BY score_date DESC) AS rn
>     FROM `{project}.{gold_dataset}.scores_daily` sd
>   )
>   WHERE rn = 1
> ),
> latest_quarterly AS (
>   SELECT * EXCEPT(rn)
>   FROM (
>     SELECT sq.*, ROW_NUMBER() OVER (PARTITION BY _index, symbol ORDER BY as_of_date DESC) AS rn
>     FROM `{project}.{gold_dataset}.scores_quarterly` sq
>   )
>   WHERE rn = 1
> ),
> current_dim AS (
>   SELECT *
>   FROM `{project}.{silver_dataset}.index_dim`
>   WHERE is_current = TRUE
> )
> SELECT
>   ld._index,
>   ld.symbol,
>   ld.score_date,
>   lq.as_of_date,
>   COALESCE(ld.short_name, cd.short_name) AS short_name,
>   COALESCE(ld.sector, cd.sector) AS sector,
>   cd.industry,
>   COALESCE(ld.country, cd.country) AS country,
>   COALESCE(ld.currency, cd.currency) AS currency,
>   ld.market_cap,
>   ld.index_weight,
>   ld.current_price,
>   ld.day_change_pct,
>   ld.five_day_change_pct,
>   ld.ytd_change_pct,
>   ld.relative_value_score,
>   ld.relative_value_rank,
>   ld.momentum_score,
>   ld.momentum_rank,
>   ld.sentiment_score,
>   ld.sentiment_rank,
>   ld.composite_score,
>   ld.composite_rank,
>   lq.quality_score,
>   lq.quality_rank,
>   lq.governance_score,
>   lq.governance_rank,
>   lq.health_flags_count,
>   lq.health_risk_level,
>   lq.beta,
>   lq.fcf_yield,
>   lq.governance_vs_quality,
>   ld.implied_upside,
>   ld.recommendation_mean,
>   ld.price_falling_analysts_bullish,
>   CASE
>     WHEN ld.market_cap IS NULL THEN NULL
>     WHEN ld.market_cap >= 200000000000 THEN 'mega'
>     WHEN ld.market_cap >= 10000000000 THEN 'large'
>     WHEN ld.market_cap >= 2000000000 THEN 'mid'
>     ELSE 'small'
>   END AS market_cap_bucket,
>   CURRENT_TIMESTAMP() AS _built_at
> FROM latest_daily ld
> LEFT JOIN latest_quarterly lq
>   ON ld._index = lq._index AND ld.symbol = lq.symbol
> LEFT JOIN current_dim cd
>   ON ld._index = cd._index AND ld.symbol = cd.symbol
> WHERE ld._index IN ('euro_stoxx_50', 'stoxx_asia_50', 'stoxx_usa_50')
> """
>
>     sector_heatmap = f"""
> CREATE OR REPLACE TABLE `{project}.{marts_dataset}.mart_sector_heatmap_latest`
> CLUSTER BY _index, sector AS
> SELECT
>   _index,
>   score_date,
>   sector,
>   COUNT(*) AS stock_count,
>   ROUND(SUM(COALESCE(index_weight, 0)), 6) AS total_weight,
>   AVG(relative_value_score) AS avg_relative_value_score,
>   AVG(momentum_score) AS avg_momentum_score,
>   AVG(sentiment_score) AS avg_sentiment_score,
>   AVG(composite_score) AS avg_composite_score,
>   AVG(quality_score) AS avg_quality_score,
>   AVG(governance_score) AS avg_governance_score,
>   SUM(COALESCE(health_flags_count, 0)) AS health_flags_total,
>   CURRENT_TIMESTAMP() AS _built_at
> FROM `{project}.{marts_dataset}.mart_constituent_screener_latest`
> GROUP BY _index, score_date, sector
> """
>
>     compare_history = f"""
> CREATE OR REPLACE TABLE `{project}.{marts_dataset}.mart_index_compare_history`
> PARTITION BY perf_date
> CLUSTER BY _index AS
> WITH base AS (
>   SELECT
>     _index,
>     perf_date,
>     daily_return,
>     cumulative_factor,
>     rolling_30d_return,
>     rolling_90d_return,
>     ytd_return,
>     rolling_30d_volatility,
>     stocks_count,
>     avg_pe,
>     avg_pb,
>     avg_dividend_yield,
>     avg_market_cap,
>     _computed_at,
>     MAX(cumulative_factor) OVER (
>       PARTITION BY _index
>       ORDER BY perf_date
>       ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
>     ) AS running_peak
>   FROM `{project}.{gold_dataset}.index_performance`
> )
> SELECT
>   _index,
>   perf_date,
>   daily_return,
>   cumulative_factor,
>   cumulative_factor * 100 AS base_100,
>   rolling_30d_return,
>   rolling_90d_return,
>   ytd_return,
>   rolling_30d_volatility,
>   stocks_count,
>   avg_pe,
>   avg_pb,
>   avg_dividend_yield,
>   avg_market_cap,
>   SAFE_DIVIDE(cumulative_factor, NULLIF(running_peak, 0)) - 1 AS drawdown,
>   CASE
>     WHEN rolling_30d_volatility IS NULL THEN NULL
>     WHEN rolling_30d_volatility < 0.15 THEN 'low'
>     WHEN rolling_30d_volatility < 0.30 THEN 'medium'
>     ELSE 'high'
>   END AS volatility_regime,
>   _computed_at,
>   CURRENT_TIMESTAMP() AS _built_at
> FROM base
> WHERE _index IN ('euro_stoxx_50', 'stoxx_asia_50', 'stoxx_usa_50')
> """
>
>     factsheet = f"""
> CREATE OR REPLACE TABLE `{project}.{marts_dataset}.mart_index_factsheet_latest`
> CLUSTER BY _index AS
> WITH latest_perf AS (
>   SELECT * EXCEPT(rn)
>   FROM (
>     SELECT h.*, ROW_NUMBER() OVER (PARTITION BY _index ORDER BY perf_date DESC) AS rn
>     FROM `{project}.{marts_dataset}.mart_index_compare_history` h
>   )
>   WHERE rn = 1
> ),
> constituents AS (
>   SELECT *
>   FROM `{project}.{marts_dataset}.mart_constituent_screener_latest`
> ),
> country_weights AS (
>   SELECT
>     _index,
>     country,
>     COUNT(*) AS stock_count,
>     ROUND(SUM(COALESCE(index_weight, 0)), 6) AS total_weight
>   FROM constituents
>   GROUP BY _index, country
> ),
> top_constituents AS (
>   SELECT
>     _index,
>     ARRAY_AGG(
>       STRUCT(
>         symbol,
>         short_name,
>         sector,
>         country,
>         composite_rank,
>         composite_score,
>         index_weight,
>         current_price,
>         day_change_pct
>       )
>       ORDER BY composite_rank ASC, index_weight DESC, symbol
>       LIMIT 10
>     ) AS top_constituents
>   FROM constituents
>   GROUP BY _index
> ),
> sector_weights AS (
>   SELECT
>     _index,
>     ARRAY_AGG(
>       STRUCT(
>         sector,
>         stock_count,
>         total_weight,
>         avg_relative_value_score,
>         avg_momentum_score,
>         avg_sentiment_score,
>         avg_composite_score,
>         avg_quality_score,
>         avg_governance_score,
>         health_flags_total
>       )
>       ORDER BY total_weight DESC, sector
>     ) AS sector_weights
>   FROM `{project}.{marts_dataset}.mart_sector_heatmap_latest`
>   GROUP BY _index
> ),
> country_weight_arrays AS (
>   SELECT
>     _index,
>     ARRAY_AGG(
>       STRUCT(
>         country,
>         stock_count,
>         total_weight
>       )
>       ORDER BY total_weight DESC, country
>     ) AS country_weights
>   FROM country_weights
>   GROUP BY _index
> ),
> constituent_rollup AS (
>   SELECT
>     _index,
>     MAX(score_date) AS as_of_date,
>     AVG(composite_score) AS avg_composite_score,
>     AVG(quality_score) AS avg_quality_score,
>     AVG(governance_score) AS avg_governance_score
>   FROM constituents
>   GROUP BY _index
> )
> SELECT
>   p._index,
>   cr.as_of_date,
>   p.perf_date,
>   p.daily_return,
>   p.base_100,
>   p.rolling_30d_return,
>   p.rolling_90d_return,
>   p.ytd_return,
>   p.rolling_30d_volatility,
>   p.drawdown,
>   p.volatility_regime,
>   p.stocks_count,
>   p.avg_pe,
>   p.avg_pb,
>   p.avg_dividend_yield,
>   p.avg_market_cap,
>   cr.avg_composite_score,
>   cr.avg_quality_score,
>   cr.avg_governance_score,
>   tc.top_constituents,
>   sw.sector_weights,
>   cwa.country_weights,
>   CURRENT_TIMESTAMP() AS _built_at
> FROM latest_perf p
> JOIN constituent_rollup cr
>   ON p._index = cr._index
> LEFT JOIN top_constituents tc
>   ON p._index = tc._index
> LEFT JOIN sector_weights sw
>   ON p._index = sw._index
> LEFT JOIN country_weight_arrays cwa
>   ON p._index = cwa._index
> """
>
>     return [screener, sector_heatmap, compare_history, factsheet]
>
>
> def build_marts() -> None:
>     client = get_bq_client()
>     marts_dataset = os.environ.get("BQ_MARTS_DATASET", "stoxx_marts")
>     ensure_dataset(client, marts_dataset)
>     project = client.project
>     silver_dataset = os.environ.get("BQ_SILVER_DATASET", "stoxx_silver")
>     gold_dataset = os.environ.get("BQ_GOLD_DATASET", "stoxx_gold")
>     for statement in mart_sql(project, marts_dataset, silver_dataset, gold_dataset):
>         run_bq_query(client, statement)
>
>
> def normalize_firestore_value(value: Any) -> Any:
>     if isinstance(value, datetime):
>         return value
>     if isinstance(value, date):
>         return value.isoformat()
>     if isinstance(value, Decimal):
>         return float(value)
>     if isinstance(value, list):
>         return [normalize_firestore_value(item) for item in value]
>     if hasattr(value, "items"):
>         return {key: normalize_firestore_value(item) for key, item in value.items()}
>     if isinstance(value, dict):
>         return {key: normalize_firestore_value(item) for key, item in value.items()}
>     return value
>
>
> def row_to_plain_dict(row: bigquery.table.Row) -> dict[str, Any]:
>     return {key: normalize_firestore_value(value) for key, value in dict(row).items()}
>
>
> def sync_subcollection(
>     db: firestore.Client,
>     parent_ref: firestore.DocumentReference,
>     name: str,
>     docs_by_id: dict[str, dict[str, Any]],
> ) -> None:
>     existing_ids = {doc.id for doc in parent_ref.collection(name).stream()}
>     operations: list[tuple[str, firestore.DocumentReference, Any]] = []
>     for stale_id in sorted(existing_ids - set(docs_by_id)):
>         operations.append(("delete", parent_ref.collection(name).document(stale_id), None))
>     for doc_id, payload in docs_by_id.items():
>         operations.append(("set", parent_ref.collection(name).document(doc_id), payload))
>     batched_commit(db, operations)
>
>
> def publish_control_doc(
>     db: firestore.Client,
>     *,
>     indexes: list[str],
>     root_doc_count: int,
>     constituent_doc_count: int,
>     sector_doc_count: int,
>     performance_doc_count: int,
> ) -> None:
>     control_collection = os.environ.get("FIRESTORE_CONTROL_COLLECTION", "serving_control")
>     control_document = os.environ.get("FIRESTORE_CONTROL_DOCUMENT", "current")
>     publish_id = datetime.now(UTC).strftime("%Y%m%dT%H%M%S.%fZ")
>     payload = {
>         "publish_id": publish_id,
>         "pipeline": "stoxx_stage_yfinance",
>         "publisher": "stoxx-serving",
>         "database": os.environ.get("FIRESTORE_DATABASE", "main"),
>         "indexes": indexes,
>         "root_doc_count": root_doc_count,
>         "constituent_doc_count": constituent_doc_count,
>         "sector_doc_count": sector_doc_count,
>         "performance_doc_count": performance_doc_count,
>         "published_at": firestore.SERVER_TIMESTAMP,
>         "updated_at": firestore.SERVER_TIMESTAMP,
>     }
>     db.collection(control_collection).document(control_document).set(payload, merge=True)
>     LOGGER.info(
>         "Updated Firestore control document %s/%s for publish_id=%s",
>         control_collection,
>         control_document,
>         publish_id,
>     )
>
>
> def publish_firestore() -> None:
>     bq = get_bq_client()
>     db = get_firestore_client()
>     project = bq.project
>     marts_dataset = os.environ.get("BQ_MARTS_DATASET", "stoxx_marts")
>     collection_name = os.environ.get("FIRESTORE_COLLECTION", "stoxx_indices")
>
>     factsheet_rows = run_bq_query(
>         bq,
>         f"SELECT * FROM `{project}.{marts_dataset}.mart_index_factsheet_latest` ORDER BY _index",
>     )
>     constituent_rows = run_bq_query(
>         bq,
>         f"SELECT * FROM `{project}.{marts_dataset}.mart_constituent_screener_latest` ORDER BY _index, composite_rank, index_weight DESC, symbol",
>     )
>     sector_rows = run_bq_query(
>         bq,
>         f"SELECT * FROM `{project}.{marts_dataset}.mart_sector_heatmap_latest` ORDER BY _index, total_weight DESC, sector",
>     )
>     performance_rows = run_bq_query(
>         bq,
>         f"SELECT * FROM `{project}.{marts_dataset}.mart_index_compare_history` ORDER BY _index, perf_date",
>     )
>
>     expected_indexes = {row["_index"] for row in factsheet_rows}
>     top_collection = db.collection(collection_name)
>     for doc in top_collection.stream():
>         if doc.id not in expected_indexes:
>             db.recursive_delete(doc.reference)
>
>     by_index_constituents: dict[str, dict[str, dict[str, Any]]] = {idx: {} for idx in expected_indexes}
>     for row in constituent_rows:
>         payload = row_to_plain_dict(row)
>         index_key = payload["_index"]
>         symbol = payload["symbol"]
>         payload["updated_at"] = firestore.SERVER_TIMESTAMP
>         by_index_constituents.setdefault(index_key, {})[symbol] = payload
>
>     by_index_sectors: dict[str, dict[str, dict[str, Any]]] = {idx: {} for idx in expected_indexes}
>     for row in sector_rows:
>         payload = row_to_plain_dict(row)
>         index_key = payload["_index"]
>         sector_id = slugify(str(payload["sector"]))
>         payload["updated_at"] = firestore.SERVER_TIMESTAMP
>         by_index_sectors.setdefault(index_key, {})[sector_id] = payload
>
>     by_index_performance: dict[str, dict[str, dict[str, Any]]] = {idx: {} for idx in expected_indexes}
>     for row in performance_rows:
>         payload = row_to_plain_dict(row)
>         index_key = payload["_index"]
>         perf_id = str(payload["perf_date"])
>         payload["updated_at"] = firestore.SERVER_TIMESTAMP
>         by_index_performance.setdefault(index_key, {})[perf_id] = payload
>
>     root_ops: list[tuple[str, firestore.DocumentReference, Any]] = []
>     for row in factsheet_rows:
>         payload = row_to_plain_dict(row)
>         index_key = payload["_index"]
>         payload["updated_at"] = firestore.SERVER_TIMESTAMP
>         doc_ref = top_collection.document(index_key)
>         root_ops.append(("set", doc_ref, payload))
>         sync_subcollection(db, doc_ref, "constituents", by_index_constituents.get(index_key, {}))
>         sync_subcollection(db, doc_ref, "sectors", by_index_sectors.get(index_key, {}))
>         sync_subcollection(db, doc_ref, "performance", by_index_performance.get(index_key, {}))
>     batched_commit(db, root_ops)
>     publish_control_doc(
>         db,
>         indexes=sorted(expected_indexes),
>         root_doc_count=len(factsheet_rows),
>         constituent_doc_count=len(constituent_rows),
>         sector_doc_count=len(sector_rows),
>         performance_doc_count=len(performance_rows),
>     )
>     LOGGER.info(
>         "Published Firestore serving layer: %s root docs, %s constituent docs, %s sector docs, %s performance docs",
>         len(factsheet_rows),
>         len(constituent_rows),
>         len(sector_rows),
>         len(performance_rows),
>     )
>
>
> def validate_serving() -> None:
>     bq = get_bq_client()
>     db = get_firestore_client()
>     project = bq.project
>     marts_dataset = os.environ.get("BQ_MARTS_DATASET", "stoxx_marts")
>     collection_name = os.environ.get("FIRESTORE_COLLECTION", "stoxx_indices")
>
>     validation_sql = f"""
> WITH counts AS (
>   SELECT 'mart_constituent_screener_latest' AS table_name, COUNT(*) AS row_count
>   FROM `{project}.{marts_dataset}.mart_constituent_screener_latest`
>   UNION ALL
>   SELECT 'mart_sector_heatmap_latest', COUNT(*) FROM `{project}.{marts_dataset}.mart_sector_heatmap_latest`
>   UNION ALL
>   SELECT 'mart_index_compare_history', COUNT(*) FROM `{project}.{marts_dataset}.mart_index_compare_history`
>   UNION ALL
>   SELECT 'mart_index_factsheet_latest', COUNT(*) FROM `{project}.{marts_dataset}.mart_index_factsheet_latest`
> )
> SELECT * FROM counts ORDER BY table_name
> """
>     bq_rows = run_bq_query(bq, validation_sql)
>     counts = [row_to_plain_dict(row) for row in bq_rows]
>
>     firestore_summary = []
>     for index_key in VALID_INDEXES:
>         doc_ref = db.collection(collection_name).document(index_key)
>         snap = doc_ref.get()
>         constituents_count = sum(1 for _ in doc_ref.collection("constituents").stream())
>         sectors_count = sum(1 for _ in doc_ref.collection("sectors").stream())
>         performance_count = sum(1 for _ in doc_ref.collection("performance").stream())
>         firestore_summary.append(
>             {
>                 "_index": index_key,
>                 "exists": snap.exists,
>                 "constituents_count": constituents_count,
>                 "sectors_count": sectors_count,
>                 "performance_count": performance_count,
>             }
>         )
>
>     print(json.dumps({"bigquery_counts": counts, "firestore_summary": firestore_summary}, indent=2))
>
>
> def parse_args() -> argparse.Namespace:
>     parser = argparse.ArgumentParser(description="Sync STOXX SQL gold to BigQuery marts and Firestore.")
>     parser.add_argument(
>         "--mode",
>         choices=["sync-replica", "build-marts", "publish-firestore", "validate", "all"],
>         default="all",
>     )
>     return parser.parse_args()
>
>
> def main() -> None:
>     configure_logging()
>     args = parse_args()
>     LOGGER.info("Starting mode %s", args.mode)
>     if args.mode in ("sync-replica", "all"):
>         sync_replica_tables()
>     if args.mode in ("build-marts", "all"):
>         build_marts()
>     if args.mode in ("publish-firestore", "all"):
>         publish_firestore()
>     if args.mode in ("validate", "all"):
>         validate_serving()
>
>
> if __name__ == "__main__":
>     try:
>         main()
>     except Exception:
>         LOGGER.exception("stoxx-serving failed")
>         raise
> ```

> [!example]- `app.py`
>
> *Receives Firestore control-document CloudEvents from Eventarc and writes them to Cloud Logging.*
> ```python
> from __future__ import annotations
>
> import json
> import logging
> import os
> from typing import Any
>
> from flask import Flask, Request, Response, request
>
>
> logging.basicConfig(
>     level=os.environ.get("LOG_LEVEL", "INFO").upper(),
>     format="%(asctime)s %(levelname)s %(name)s %(message)s",
> )
> LOGGER = logging.getLogger("firestore-control-eventarc-receiver")
> app = Flask(__name__)
>
>
> def extract_headers(req: Request) -> dict[str, str]:
>     interesting = {}
>     for key, value in req.headers.items():
>         key_lower = key.lower()
>         if key_lower.startswith("ce-") or key_lower in {"content-type", "user-agent"}:
>             interesting[key_lower] = value
>     return interesting
>
>
> def decode_json_body(raw: bytes) -> Any:
>     if not raw:
>         return None
>     try:
>         return json.loads(raw.decode("utf-8"))
>     except Exception:
>         return {"raw_body_preview": raw[:512].decode("utf-8", errors="replace")}
>
>
> @app.post("/")
> def receive_event() -> Response:
>     raw = request.get_data(cache=False)
>     payload = decode_json_body(raw)
>     event_summary = {
>         "message": "Firestore control-doc event received",
>         "ce_id": request.headers.get("ce-id"),
>         "ce_type": request.headers.get("ce-type"),
>         "ce_source": request.headers.get("ce-source"),
>         "ce_subject": request.headers.get("ce-subject"),
>         "ce_time": request.headers.get("ce-time"),
>         "body_size_bytes": len(raw),
>         "headers": extract_headers(request),
>         "payload": payload,
>     }
>     LOGGER.info(json.dumps(event_summary, ensure_ascii=True, sort_keys=True))
>     return Response(status=204)
>
>
> @app.get("/healthz")
> def healthz() -> tuple[dict[str, str], int]:
>     return {"status": "ok"}, 200
>
>
> if __name__ == "__main__":
>     app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))
> ```
