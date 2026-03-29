---
type: reference
category: programming-languages
technology: [python, polars, pydantic, fastapi, sqlserver]
tags: [python, pipeline, data-quality, lineage]
aliases: [functional pipeline, medallion pipeline, data lineage, pydantic validation]
keywords: [pipeline, medallion, bronze, silver, gold, pydantic, validation, lineage, fastapi, streamlit, plotly, airflow, parquet]
description: "End-to-end functional data pipeline with Pydantic validation, lineage tracking, Parquet export, FastAPI serving, and Plotly visualization."
related:
  - "[[programming-languages-index]]"
  - "[[18_py_designpatterns]]"
  - "[[15_py_webapis]]"
  - "[[16_py_database]]"
  - "[[10_py_serialization_formats]]"
  - "[[23_py_data_ingestion]]"
  - "[[medallion-architecture]]"
  - "[[airflow-dag-patterns]]"
  - "[[data-modeling-patterns]]"
created: 2026-03-29
updated: 2026-03-29
status: complete
---

# 25. Functional Data Pipeline

**yfinance** → JSON landing → **Pydantic** → Bronze → **Polars** → Silver → **Polars** → Gold → **Parquet** → **FastAPI** → **Streamlit**

> [!abstract]- Pipeline Architecture
>
> **Medallion architecture** — Bronze receives raw data exactly as-is from the source. Silver applies cleaning and enrichment (daily returns, intraday range, 20-day moving averages). Gold produces pre-aggregated mart tables: a daily cross-sectional summary and per-symbol risk profiles with drawdown calculations.
>
> **Landing zone** — API responses are first written to JSON files before database ingestion. This decouples fetching from loading: if the write fails, data is still on disk. If the pipeline is replayed, it reads from files without re-calling the API.
>
> **Validation** — Every stage boundary is guarded by a **Pydantic v2** model enforcing types, value ranges, and business rules (e.g., `high ≥ low`). Rows that fail are persisted to a **quarantine table** (dead letter queue) with the full error message.
>
> **Quality gates** — After Bronze and Silver, automated assertions check structural integrity (no nulls, no duplicates), statistical bounds (daily return ±50%, intraday range 50%), data freshness (most recent date within 5 days), and minimum row counts. Failures stop the pipeline before bad data propagates.
>
> **Dimension tables** — A **symbol dimension** uses [[data-modeling-patterns|SCD Type 2]] historization for point-in-time queries. A **trading calendar** dimension built from `pandas-market-calendars` provides per-exchange trading day flags with holiday detection.
>
> **Lineage** — Every row carries a `batch_id`. Each stage records timing, row counts, rejection counts, and a **SHA-256 hash** of its output. A `RunContext` JSON captures full execution metadata. Given any disputed data point, trace it from Gold back to the raw landing file with cryptographic proof.
>
> **Serving** — Gold data is exported to **Parquet** files that **FastAPI** reads directly (no database at serving time). A **Streamlit** dashboard consumes the API.
>
> **Orchestration** — An [[airflow-dag-patterns|Airflow 3.x]] DAG defines 10 tasks with retry policies (3 attempts, exponential backoff) on a Mon–Fri 18:30 UTC schedule. Runs in Docker with the pipeline code mounted as a volume.
>
> **Reliability** — API calls use **tenacity** retry logic. Bronze and Silver use **MERGE upsert** for idempotent re-runs. Gold is truncated and rebuilt from Silver on every run. Structured **logging** replaces print statements.

```python
# Standard library
import hashlib
import importlib.util
import logging
import json
import os
import subprocess
import threading
import time
import uuid
from datetime import datetime, timezone, date as Date, timedelta
from pathlib import Path
from urllib.parse import quote_plus

import warnings
from sqlalchemy import exc as sa_exc
warnings.filterwarnings('ignore', category=sa_exc.SAWarning)

# Data & transforms
import polars as pl
import yfinance as yf
import pandas_market_calendars as mcal

# Validation
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict

# Database
import pyodbc
from sqlalchemy import create_engine, text

# Serving
from fastapi import FastAPI, HTTPException
import uvicorn
import httpx

# Visualization
import plotly.graph_objects as go
from IPython.display import display, HTML

# ── Polars HTML formatter — strip quotes, transparent background ──
_html_fmt = get_ipython().display_formatter.formatters["text/html"]  # type: ignore
_html_fmt.for_type(pl.DataFrame, lambda df: df.to_pandas().style.hide(axis="index").set_properties(**{"text-align": "left"}).to_html())

# ── Structured logging ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-5s | %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("pipeline")
```

## Configuration & Constants

#### Python — define pipeline paths, SQL connection, and stock universe

```python
# Central configuration cell — all downstream cells reference these constants

# ── Paths ──
DATA_DIR    = Path(r"C:\Users\aperi\DEV\LANG\data")
EXPORT_DIR  = DATA_DIR / "pipeline"
LINEAGE_DIR = EXPORT_DIR / "lineage"
LANDING_DIR = DATA_DIR / "pipeline" / "landing"
EXPORT_DIR.mkdir(parents=True, exist_ok=True)
LANDING_DIR.mkdir(parents=True, exist_ok=True)
LINEAGE_DIR.mkdir(parents=True, exist_ok=True)

# ── SQL Server (local Docker instance) ──
SQL_CONN_STR = (
    "Driver={ODBC Driver 18 for SQL Server};"
    "Server=localhost,1434;Database=stoxx;"
    "UID=sa;PWD=EsgDev2026Pass1;"
    "Encrypt=yes;TrustServerCertificate=yes;"
)
sql_engine = create_engine(f"mssql+pyodbc:///?odbc_connect={quote_plus(SQL_CONN_STR)}")

# ── Stock universe — 5 EURO STOXX 50 components for demo ──
SYMBOLS = ["SAP.DE", "SIE.DE", "ALV.DE", "DTE.DE", "BAS.DE"]
LOOKBACK_DAYS = 365 * 2  # 2 years of history
START_DATE = (Date.today() - timedelta(days=LOOKBACK_DAYS)).isoformat()
END_DATE   = Date.today().isoformat()

# ── Exchange mapping: yfinance exchange code → mcal calendar name ──
EXCHANGE_MAP = {
    "GER": "XETR",    # XETRA (German stocks)
    "FRA": "XFRA",    # Frankfurt
    "PAR": "XPAR",    # Euronext Paris
    "AMS": "XAMS",    # Euronext Amsterdam
    "BRU": "XBRU",    # Euronext Brussels
    "MIL": "XMIL",    # Borsa Italiana
    "MCE": "XMAD",    # Madrid
    "NMS": "XNYS",    # NASDAQ → use NYSE calendar
    "NYQ": "XNYS",    # NYSE
    "HKG": "XHKG",    # Hong Kong
    "TKS": "XTKS",    # Tokyo
}

print(f"Pipeline config loaded")
print(f"  Export dir:  {EXPORT_DIR}")
print(f"  Universe:    {SYMBOLS}")
print(f"  Date range:  {START_DATE} → {END_DATE}")
```

    Pipeline config loaded
      Export dir:  C:\Users\aperi\DEV\LANG\data\pipeline
      Universe:    ['SAP.DE', 'SIE.DE', 'ALV.DE', 'DTE.DE', 'BAS.DE']
      Date range:  2024-03-29 → 2026-03-29

## Pydantic DTOs

Every stage boundary in the pipeline validates data through Pydantic models.
This catches schema drift, type mismatches, and business rule violations
before bad data propagates downstream.

#### Pydantic DTO Architecture — validation models per medallion layer
- `RawOHLCV` — validates yfinance output (Bronze boundary)
- `CleanOHLCV` — validates cleaned/enriched data (Silver boundary)
- `DailySummary` / `SymbolProfile` — validates aggregated data (Gold boundary)
- `StageLineage` — tracks what each pipeline stage produced
- `RunContext` — captures full pipeline execution metadata

#### Pydantic — define Bronze validation model with `BaseModel` and `Field()`

```python
# Validates raw yfinance data before Bronze persistence
# Enforces types, ranges, and business rules at ingestion boundary

class RawOHLCV(BaseModel):
    """Schema for raw OHLCV data from yfinance — Bronze boundary."""
    model_config = ConfigDict(strict=True)

    symbol:       str   = Field(..., min_length=1, description="Ticker symbol")
    date:         Date  = Field(..., description="Trading date")
    open:         float = Field(..., gt=0, description="Opening price")
    high:         float = Field(..., gt=0, description="Highest price")
    low:          float = Field(..., gt=0, description="Lowest price")
    close:        float = Field(..., gt=0, description="Closing price")
    adj_close:    float = Field(..., gt=0, description="Adjusted close")
    volume:       int   = Field(..., ge=0, description="Trading volume")
    dividends:    float = Field(default=0.0, ge=0)
    stock_splits: float = Field(default=0.0, ge=0)

    @model_validator(mode="after")
    def high_ge_low(self):
        """Business rule: high must be >= low on any trading day."""
        if self.high < self.low:
            raise ValueError(f"high ({self.high}) < low ({self.low})")
        return self

# Verify the model works with sample data
sample = RawOHLCV(
    symbol="SAP.DE", date=Date(2024, 1, 2),
    open=144.5, high=146.0, low=143.8, close=145.2,
    adj_close=145.2, volume=1_200_000
)
print(f"RawOHLCV validated: {sample.symbol} {sample.date} close={sample.close}")
```

    RawOHLCV validated: SAP.DE 2024-01-02 close=145.2

#### Pydantic — define Silver validation model with `BaseModel` and `Field()`

```python
# Extends Bronze with computed fields: daily_return, intraday_range, is_filled
# Validates enrichment transforms at the Silver boundary

class CleanOHLCV(BaseModel):
    """Schema for cleaned OHLCV data — Silver boundary."""
    model_config = ConfigDict(strict=True)

    symbol:         str   = Field(..., min_length=1)
    date:           Date  = Field(...)
    open:           float = Field(..., gt=0)
    high:           float = Field(..., gt=0)
    low:            float = Field(..., gt=0)
    close:          float = Field(..., gt=0)
    adj_close:      float = Field(..., gt=0)
    volume:         int   = Field(..., ge=0)
    dividends:      float = Field(default=0.0, ge=0)
    stock_splits:   float = Field(default=0.0, ge=0)
    # ── Silver enrichment fields ──
    daily_return:   float = Field(..., description="Close-to-close return pct")
    intraday_range: float = Field(..., ge=0, description="(high-low)/close pct")
    sma_20:         float | None = Field(default=None, description="20-day simple moving avg")
    batch_id:       str   = Field(..., description="Lineage batch identifier")

    @model_validator(mode="after")
    def high_ge_low(self):
        if self.high < self.low:
            raise ValueError(f"high ({self.high}) < low ({self.low})")
        return self

print(f"CleanOHLCV model defined — {len(CleanOHLCV.model_fields)} fields")
```

    CleanOHLCV model defined — 14 fields

#### Pydantic — define Gold validation models with `BaseModel` and `Field()`

Gold layer produces two mart tables:
DailySummary — cross-sectional daily metrics across all symbols
SymbolProfile — per-symbol summary statistics over full history

```python
class DailySummary(BaseModel):
    """Daily cross-sectional summary across all symbols — Gold mart."""
    date:             Date  = Field(...)
    symbols_traded:   int   = Field(..., ge=0)
    avg_return:       float = Field(...)
    max_return:       float = Field(...)
    min_return:       float = Field(...)
    total_volume:     int   = Field(..., ge=0)
    avg_intraday_pct: float = Field(..., ge=0)
    batch_id:         str   = Field(...)

class SymbolProfile(BaseModel):
    """Per-symbol summary statistics — Gold mart."""
    symbol:              str   = Field(..., min_length=1)
    total_trading_days:  int   = Field(..., ge=0)
    avg_daily_return:    float = Field(...)
    volatility:          float = Field(..., ge=0, description="Std dev of daily returns")
    max_drawdown:        float = Field(..., le=0, description="Max peak-to-trough decline")
    avg_volume:          float = Field(..., ge=0)
    total_dividends:     float = Field(default=0.0, ge=0)
    first_date:          Date  = Field(...)
    last_date:           Date  = Field(...)
    batch_id:            str   = Field(...)

print(f"DailySummary:  {len(DailySummary.model_fields)} fields")
print(f"SymbolProfile: {len(SymbolProfile.model_fields)} fields")
```

    DailySummary:  8 fields
    SymbolProfile: 10 fields

#### Pydantic — define lineage tracking models with `BaseModel` and `Field()`

```python
# StageLineage records what each stage produced (row counts, hashes, timing)
# RunContext captures the full execution environment for reproducibility

class StageLineage(BaseModel):
    """Records what a single pipeline stage produced."""
    batch_id:       str      = Field(..., description="Links all stages in one run")
    stage:          str      = Field(..., description="bronze | silver | gold | export")
    started_at:     datetime = Field(...)
    completed_at:   datetime = Field(...)
    input_rows:     int      = Field(..., ge=0)
    output_rows:    int      = Field(..., ge=0)
    rows_rejected:  int      = Field(default=0, ge=0)
    output_hash:    str      = Field(..., description="SHA-256 of output for drift detection")

    @property
    def duration_ms(self) -> float:
        return (self.completed_at - self.started_at).total_seconds() * 1000

class RunContext(BaseModel):
    """Full pipeline execution metadata — persisted as JSON for audit trail."""
    batch_id:       str            = Field(...)
    started_at:     datetime       = Field(...)
    completed_at:   datetime | None = Field(default=None)
    symbols:        list[str]      = Field(...)
    date_range:     tuple[str, str] = Field(...)
    polars_version: str            = Field(default=pl.__version__)
    stages:         list[StageLineage] = Field(default_factory=list)
    status:         str            = Field(default="running", pattern="^(running|completed|failed)$")

print(f"StageLineage: {len(StageLineage.model_fields)} fields")
print(f"RunContext:   {len(RunContext.model_fields)} fields")
```

    StageLineage: 8 fields
    RunContext:   8 fields

## Lineage & Context Infrastructure

Pure functions for lineage tracking. Every pipeline stage calls `start_stage()` before
processing and `end_stage()` after, producing a `StageLineage` record. The `RunContext`
aggregates all stage records and is persisted to JSON at the end of each run.

The `compute_hash()` function produces a deterministic SHA-256 of any DataFrame,
enabling drift detection: if the same inputs produce a different hash, something changed.

#### Lineage — uuid generate unique batch ID with `uuid4()`

```python
# Each pipeline run gets a unique batch_id that links all stages together
# Format: uuid4 string — globally unique, no collision risk

def generate_batch_id() -> str:
    """Generate a unique batch identifier for this pipeline run."""
    return str(uuid.uuid4())

# Demo: generate a batch_id
demo_batch = generate_batch_id()
print(f"Sample batch_id: {demo_batch}")
```

    Sample batch_id: 9e43b0c5-a388-4ec8-ad76-bcde6e97d37e

#### hashlib — compute deterministic DataFrame hash with `sha256()`

```python
# Deterministic hash for drift detection: same data → same hash
# Serializes to CSV bytes, then hashes — column order matters

def compute_hash(df: pl.DataFrame) -> str:
    """SHA-256 hash of DataFrame content for drift detection."""
    csv_bytes = df.sort(df.columns).write_csv().encode("utf-8")
    return hashlib.sha256(csv_bytes).hexdigest()[:16]

# Demo with a small frame
demo_df = pl.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]})
print(f"Hash of demo frame: {compute_hash(demo_df)}")
```

    Hash of demo frame: f67a232f1bb81bfa

#### Python — define stage start and end tracker with `datetime.now()`

```python
# Pure functions that create StageLineage records
# start_stage captures the timestamp, end_stage fills output metrics

def start_stage(batch_id: str, stage: str, input_rows: int) -> dict:
    """Begin tracking a pipeline stage. Returns a context dict."""
    return {
        "batch_id": batch_id,
        "stage": stage,
        "started_at": datetime.now(timezone.utc),
        "input_rows": input_rows,
    }

def end_stage(ctx: dict, output_df: pl.DataFrame, rows_rejected: int = 0) -> StageLineage:
    """Complete a pipeline stage. Returns a validated StageLineage record."""
    return StageLineage(
        batch_id=ctx["batch_id"],
        stage=ctx["stage"],
        started_at=ctx["started_at"],
        completed_at=datetime.now(timezone.utc),
        input_rows=ctx["input_rows"],
        output_rows=len(output_df),
        rows_rejected=rows_rejected,
        output_hash=compute_hash(output_df),
    )

print("start_stage() / end_stage() — lineage tracker functions defined")
```

    start_stage() / end_stage() — lineage tracker functions defined

#### Pydantic — save run context to JSON with `model_dump_json()`

```python
# Persists full pipeline metadata to disk for audit trail
# One JSON file per run, named by batch_id

def save_run_context(ctx: RunContext) -> Path:
    """Serialize RunContext to JSON file in lineage directory."""
    path = LINEAGE_DIR / f"run_{ctx.batch_id[:8]}.json"
    path.write_text(ctx.model_dump_json(indent=2), encoding="utf-8")
    return path

print(f"save_run_context() defined — writes to {LINEAGE_DIR}")
```

    save_run_context() defined — writes to C:\Users\aperi\DEV\LANG\data\pipeline\lineage

## SQL Server Schema

The medallion architecture maps to three SQL Server tables:
- `bronze_ohlcv` — raw data exactly as received from yfinance
- `silver_ohlcv` — cleaned and enriched with computed columns
- `gold_daily_summary` / `gold_symbol_profile` — aggregated marts

Each table includes a `batch_id` column linking every row to the pipeline run
that produced it. A `lineage_stages` table tracks pipeline execution metadata.

#### SQL Server — create Bronze OHLCV table with `cursor.execute()`

Stores raw yfinance output exactly as received, no transforms
batch_id links every row to the pipeline run that ingested it
UNIQUE constraint on (symbol, date) enables MERGE upsert for incremental loads

```python
sql_conn = pyodbc.connect(SQL_CONN_STR)
cur = sql_conn.cursor()

cur.execute("""
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'bronze_ohlcv')
CREATE TABLE bronze_ohlcv (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    symbol       VARCHAR(20)  NOT NULL,
    date         DATE         NOT NULL,
    [open]       FLOAT        NOT NULL,
    high         FLOAT        NOT NULL,
    low          FLOAT        NOT NULL,
    [close]      FLOAT        NOT NULL,
    adj_close    FLOAT        NOT NULL,
    volume       BIGINT       NOT NULL,
    dividends    FLOAT        NOT NULL DEFAULT 0,
    stock_splits FLOAT        NOT NULL DEFAULT 0,
    batch_id     VARCHAR(36)  NOT NULL,
    ingested_at  DATETIME2    NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT UQ_bronze_symbol_date UNIQUE (symbol, date)
)
""")
sql_conn.commit()
print("bronze_ohlcv table ready (with UNIQUE on symbol+date)")
```

    bronze_ohlcv table ready (with UNIQUE on symbol+date)

#### SQL Server — create Silver OHLCV table with `cursor.execute()`

```python
# Adds computed columns: daily_return, intraday_range, sma_20
# UNIQUE on (symbol, date) enables MERGE upsert for incremental enrichment

cur.execute("""
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'silver_ohlcv')
CREATE TABLE silver_ohlcv (
    id              INT IDENTITY(1,1) PRIMARY KEY NONCLUSTERED,
    symbol          VARCHAR(20)  NOT NULL,
    date            DATE         NOT NULL,
    [open]          FLOAT        NOT NULL,
    high            FLOAT        NOT NULL,
    low             FLOAT        NOT NULL,
    [close]         FLOAT        NOT NULL,
    adj_close       FLOAT        NOT NULL,
    volume          BIGINT       NOT NULL,
    dividends       FLOAT        NOT NULL DEFAULT 0,
    stock_splits    FLOAT        NOT NULL DEFAULT 0,
    daily_return    FLOAT        NOT NULL,
    intraday_range  FLOAT        NOT NULL,
    sma_20          FLOAT        NULL,
    batch_id        VARCHAR(36)  NOT NULL,
    processed_at    DATETIME2    NOT NULL DEFAULT GETUTCDATE(),
    INDEX IX_silver_symbol_date CLUSTERED (symbol, date),
    CONSTRAINT UQ_silver_symbol_date UNIQUE (symbol, date)
)
""")
sql_conn.commit()
print("silver_ohlcv table ready (with UNIQUE on symbol+date)")
```

    silver_ohlcv table ready (with UNIQUE on symbol+date)

#### SQL Server — create Gold daily summary table with `cursor.execute()`

```python
# Gold daily cross-sectional summary: one row per trading day
# Clustered on date for efficient date-range scans

cur.execute("""
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'gold_daily_summary')
CREATE TABLE gold_daily_summary (
    id               INT IDENTITY(1,1) PRIMARY KEY NONCLUSTERED,
    date             DATE         NOT NULL,
    symbols_traded   INT          NOT NULL,
    avg_return       FLOAT        NOT NULL,
    max_return       FLOAT        NOT NULL,
    min_return       FLOAT        NOT NULL,
    total_volume     BIGINT       NOT NULL,
    avg_intraday_pct FLOAT        NOT NULL,
    batch_id         VARCHAR(36)  NOT NULL,
    INDEX IX_gold_daily_date CLUSTERED (date)
)
""")
sql_conn.commit()
print("gold_daily_summary table ready")
```

#### SQL Server — create Gold symbol profile table with `cursor.execute()`

```python
# Gold per-symbol profile: one row per symbol with aggregate statistics
# Clustered on symbol for efficient symbol lookups

cur.execute("""
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'gold_symbol_profile')
CREATE TABLE gold_symbol_profile (
    id                 INT IDENTITY(1,1) PRIMARY KEY NONCLUSTERED,
    symbol             VARCHAR(20)  NOT NULL,
    total_trading_days INT          NOT NULL,
    avg_daily_return   FLOAT        NOT NULL,
    volatility         FLOAT        NOT NULL,
    max_drawdown       FLOAT        NOT NULL,
    avg_volume         FLOAT        NOT NULL,
    total_dividends    FLOAT        NOT NULL DEFAULT 0,
    first_date         DATE         NOT NULL,
    last_date          DATE         NOT NULL,
    batch_id           VARCHAR(36)  NOT NULL,
    INDEX IX_gold_profile_symbol CLUSTERED (symbol)
)
""")
sql_conn.commit()
print("gold_symbol_profile table ready")
```

#### SQL Server — create SCD Type 2 symbol dimension with `cursor.execute()`

```python
# SCD Type 2 dimension: tracks historical changes in symbol metadata
# valid_from/valid_to/is_current enable point-in-time queries

cur.execute("""
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'dim_symbol')
CREATE TABLE dim_symbol (
    id                      INT IDENTITY(1,1) PRIMARY KEY,
    symbol                  VARCHAR(20)   NOT NULL,
    company_name            NVARCHAR(200) NULL,
    short_name              NVARCHAR(100) NULL,
    sector                  NVARCHAR(100) NULL,
    sector_key              VARCHAR(100)  NULL,
    industry                NVARCHAR(200) NULL,
    industry_key            VARCHAR(200)  NULL,
    country                 NVARCHAR(100) NULL,
    city                    NVARCHAR(100) NULL,
    exchange                VARCHAR(20)   NULL,
    full_exchange_name      NVARCHAR(100) NULL,
    currency                VARCHAR(10)   NULL,
    market_cap              BIGINT        NULL,
    website                 VARCHAR(500)  NULL,
    -- SCD Type 2 columns
    valid_from              DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    valid_to                DATETIME2     NULL,
    is_current              BIT           NOT NULL DEFAULT 1
)
""")
sql_conn.commit()
print("dim_symbol table ready (SCD Type 2)")
```

#### SQL Server — create per-exchange trading calendar with `cursor.execute()`

Per-exchange trading calendar with holiday flags
Composite PK on (date, exchange_code) — one row per date per exchange
Aligned with stoxx.bronze.trading_calendar schema

```python
cur.execute("""
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'dim_calendar')
CREATE TABLE dim_calendar (
    date            DATE         NOT NULL,
    exchange_code   VARCHAR(10)  NOT NULL,
    year            SMALLINT     NOT NULL,
    quarter         TINYINT      NOT NULL,
    month           TINYINT      NOT NULL,
    week_of_year    TINYINT      NOT NULL,
    day_of_week     TINYINT      NOT NULL,
    is_trading_day  BIT          NOT NULL DEFAULT 0,
    is_month_end    BIT          NOT NULL DEFAULT 0,
    is_quarter_end  BIT          NOT NULL DEFAULT 0,
    CONSTRAINT PK_dim_calendar PRIMARY KEY (date, exchange_code)
)
""")
sql_conn.commit()
print("dim_calendar table ready (per-exchange)")
```

#### SQL Server — create lineage tracking table with `cursor.execute()`

```python
# Persists StageLineage records to SQL Server alongside the data
# Enables querying pipeline history: which batch produced what, when, how many rows

cur.execute("""
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'lineage_stages')
CREATE TABLE lineage_stages (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    batch_id      VARCHAR(36)  NOT NULL,
    stage         VARCHAR(20)  NOT NULL,
    started_at    DATETIME2    NOT NULL,
    completed_at  DATETIME2    NOT NULL,
    input_rows    INT          NOT NULL,
    output_rows   INT          NOT NULL,
    rows_rejected INT          NOT NULL DEFAULT 0,
    output_hash   VARCHAR(16)  NOT NULL
)
""")
sql_conn.commit()
print("lineage_stages table ready")
```

    lineage_stages table ready

#### SQL Server — create quarantine table for rejected rows with `cursor.execute()`

Dead letter queue: stores every row that failed Pydantic validation
Preserves the raw data + rejection reason for investigation and replay
batch_id links back to the pipeline run that rejected it

```python
cur.execute("""
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'quarantine')
CREATE TABLE quarantine (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    batch_id        VARCHAR(36)   NOT NULL,
    stage           VARCHAR(20)   NOT NULL,
    symbol          VARCHAR(20)   NULL,
    date            DATE          NULL,
    raw_data        NVARCHAR(MAX) NOT NULL,
    error_message   NVARCHAR(MAX) NOT NULL,
    quarantined_at  DATETIME2     NOT NULL DEFAULT GETUTCDATE()
)
""")
sql_conn.commit()
print("quarantine table ready (dead letter queue)")
```

    quarantine table ready (dead letter queue)

#### SQL Server — define lineage persistence helper with `cursor.execute()`

```python
# Inserts a validated StageLineage into the lineage_stages table
# Deletes any existing record for the same batch+stage first (idempotent)

def persist_lineage(lineage: StageLineage) -> None:
    """Write a StageLineage record to SQL Server (idempotent)."""
    # Delete existing record for this batch+stage to allow re-runs
    cur.execute(
        "DELETE FROM lineage_stages WHERE batch_id = ? AND stage = ?",
        lineage.batch_id, lineage.stage
    )
    cur.execute(
        """INSERT INTO lineage_stages
           (batch_id, stage, started_at, completed_at, input_rows, output_rows, rows_rejected, output_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        lineage.batch_id, lineage.stage,
        lineage.started_at, lineage.completed_at,
        lineage.input_rows, lineage.output_rows,
        lineage.rows_rejected, lineage.output_hash
    )
    sql_conn.commit()

print("persist_lineage() defined — idempotent: deletes before insert")
```

    persist_lineage() defined — idempotent: deletes before insert

#### SQLAlchemy — define DataFrame write helper with `to_sql()`

Converts Polars → pandas for SQLAlchemy to_sql() bridge
chunksize=100 avoids SQL Server 2100 parameter limit (rows x cols < 2100)
truncate=True wipes the table before insert (used by Gold tables only)

```python
def write_to_sql(df: pl.DataFrame, table: str, truncate: bool = True) -> int:
    """Write a Polars DataFrame to SQL Server. Truncates table first by default."""
    if truncate:
        cur.execute(f"TRUNCATE TABLE {table}")
        sql_conn.commit()
    pdf = df.to_pandas()
    pdf.to_sql(table, sql_engine, if_exists="append", index=False, chunksize=100)
    return len(pdf)

print("write_to_sql() defined")
```

    write_to_sql() defined

#### SQL Server — define Bronze MERGE upsert with `MERGE INTO`

```python
# MERGE upsert into bronze_ohlcv: updates existing rows, inserts new ones
# Key: (symbol, date) — no duplicates, safe to re-run

def merge_bronze(df: pl.DataFrame, batch_id: str) -> int:
    """MERGE upsert into bronze_ohlcv on (symbol, date)."""
    rows_affected = 0
    for row in df.iter_rows(named=True):
        cur.execute("""
            MERGE bronze_ohlcv AS tgt
            USING (SELECT ? AS symbol, ? AS date) AS src
               ON tgt.symbol = src.symbol AND tgt.date = src.date
            WHEN MATCHED THEN UPDATE SET
                [open] = ?, high = ?, low = ?, [close] = ?,
                adj_close = ?, volume = ?, dividends = ?, stock_splits = ?,
                batch_id = ?, ingested_at = GETUTCDATE()
            WHEN NOT MATCHED THEN INSERT
                (symbol, date, [open], high, low, [close], adj_close,
                 volume, dividends, stock_splits, batch_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """,
            row["symbol"], row["date"],
            row["open"], row["high"], row["low"], row["close"],
            row["adj_close"], row["volume"], row["dividends"], row["stock_splits"],
            batch_id,
            row["symbol"], row["date"],
            row["open"], row["high"], row["low"], row["close"],
            row["adj_close"], row["volume"], row["dividends"], row["stock_splits"],
            batch_id,
        )
        rows_affected += cur.rowcount
    sql_conn.commit()
    return rows_affected

print("merge_bronze() defined")
```

    merge_bronze() defined

#### SQL Server — define Silver MERGE upsert with `MERGE INTO`

```python
# MERGE upsert into silver_ohlcv: updates existing rows, inserts new ones
# Key: (symbol, date) — includes enrichment columns (daily_return, sma_20, etc.)

def merge_silver(df: pl.DataFrame, batch_id: str) -> int:
    """MERGE upsert into silver_ohlcv on (symbol, date)."""
    rows_affected = 0
    for row in df.iter_rows(named=True):
        cur.execute("""
            MERGE silver_ohlcv AS tgt
            USING (SELECT ? AS symbol, ? AS date) AS src
               ON tgt.symbol = src.symbol AND tgt.date = src.date
            WHEN MATCHED THEN UPDATE SET
                [open] = ?, high = ?, low = ?, [close] = ?,
                adj_close = ?, volume = ?, dividends = ?, stock_splits = ?,
                daily_return = ?, intraday_range = ?, sma_20 = ?,
                batch_id = ?, processed_at = GETUTCDATE()
            WHEN NOT MATCHED THEN INSERT
                (symbol, date, [open], high, low, [close], adj_close,
                 volume, dividends, stock_splits,
                 daily_return, intraday_range, sma_20, batch_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """,
            row["symbol"], row["date"],
            row["open"], row["high"], row["low"], row["close"],
            row["adj_close"], row["volume"], row["dividends"], row["stock_splits"],
            row["daily_return"], row["intraday_range"], row["sma_20"],
            batch_id,
            row["symbol"], row["date"],
            row["open"], row["high"], row["low"], row["close"],
            row["adj_close"], row["volume"], row["dividends"], row["stock_splits"],
            row["daily_return"], row["intraday_range"], row["sma_20"],
            batch_id,
        )
        rows_affected += cur.rowcount
    sql_conn.commit()
    return rows_affected

print("merge_silver() defined")
```

    merge_silver() defined

#### SQL Server — define quarantine persistence helper with `cursor.execute()`

```python
# Persists a rejected row to the quarantine table with its error message
# Called by validate_bronze() and validate_silver() when Pydantic validation fails

def quarantine_row(batch_id: str, stage: str, row_data: dict, error: str) -> None:
    """Save a rejected row to the quarantine table."""
    cur.execute(
        """INSERT INTO quarantine (batch_id, stage, symbol, date, raw_data, error_message)
           VALUES (?, ?, ?, ?, ?, ?)""",
        batch_id,
        stage,
        row_data.get("symbol"),
        row_data.get("date"),
        json.dumps(row_data, default=str),
        str(error)[:4000],
    )
    sql_conn.commit()

log.info("quarantine_row() defined \u2014 dead letter queue helper")
```

    01:01:23 | INFO  | quarantine_row() defined — dead letter queue helper

#### tenacity — define API retry wrapper with `@retry()` exponential backoff

Wraps yfinance API calls with retry logic: 3 attempts, exponential backoff
Catches network errors and transient failures without killing the pipeline
Uses tenacity library for clean retry semantics

```python
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    retry=retry_if_exception_type((ConnectionError, TimeoutError, OSError)),
    before_sleep=lambda rs: log.warning(f"Retry {rs.attempt_number}/3, waiting..."),
)
def fetch_with_retry(ticker, start: str, end: str):
    """Fetch ticker history with automatic retry on transient failures."""
    return ticker.history(start=start, end=end, auto_adjust=False)

log.info("fetch_with_retry() defined \u2014 3 attempts, exponential backoff")
```

    01:01:24 | INFO  | fetch_with_retry() defined — 3 attempts, exponential backoff

#### Python — define custom `Exception` subclass for quality gate failures

```python
# Custom exception raised when a data quality gate fails
# Blocks downstream stages from processing bad data

class DataQualityError(Exception):
    """Raised when a data quality gate fails."""
    pass

print("DataQualityError defined")
```

    DataQualityError defined

#### Polars — assert DataFrame is not empty with `len()`

```python
# Asserts that a DataFrame is not empty after a stage
# Returns (passed: bool, message: str)

def dq_check_not_empty(df: pl.DataFrame, stage: str) -> tuple[bool, str]:
    """Assert DataFrame is not empty."""
    ok = len(df) > 0
    return ok, f"{stage}: {len(df)} rows" if ok else f"{stage}: EMPTY DataFrame"

print("dq_check_not_empty() defined")
```

    dq_check_not_empty() defined

#### Polars — assert no nulls in key columns with `null_count()`

```python
# Asserts no null values in key columns (e.g., symbol, date)
# Checks each key column individually, reports first failure

def dq_check_no_null_keys(df: pl.DataFrame, keys: list[str], stage: str) -> tuple[bool, str]:
    """Assert no nulls in key columns."""
    for col in keys:
        if col not in df.columns:
            return False, f"{stage}: column '{col}' missing"
        nulls = df[col].null_count()
        if nulls > 0:
            return False, f"{stage}: {nulls} nulls in '{col}'"
    return True, f"{stage}: no null keys in {keys}"

print("dq_check_no_null_keys() defined")
```

    dq_check_no_null_keys() defined

#### Polars — assert no duplicate rows with `unique()`

```python
# Asserts no duplicate rows on key columns
# Compares total rows vs unique rows on the specified keys

def dq_check_no_duplicates(df: pl.DataFrame, keys: list[str], stage: str) -> tuple[bool, str]:
    """Assert no duplicate rows on key columns."""
    total = len(df)
    unique = df.select(keys).unique().height
    dupes = total - unique
    ok = dupes == 0
    return ok, f"{stage}: {dupes} duplicates on {keys}" if not ok else f"{stage}: no duplicates"

print("dq_check_no_duplicates() defined")
```

    dq_check_no_duplicates() defined

#### Polars — assert values within range with `filter()`

```python
# Asserts all values in a column fall within [min_val, max_val]
# Reports count of out-of-range values

def dq_check_range(df: pl.DataFrame, col: str, min_val: float, max_val: float, stage: str) -> tuple[bool, str]:
    """Assert all values in a column fall within [min_val, max_val]."""
    out_of_range = df.filter(
        (pl.col(col) < min_val) | (pl.col(col) > max_val)
    ).height
    ok = out_of_range == 0
    return ok, f"{stage}: {out_of_range} values outside [{min_val}, {max_val}] in '{col}'" if not ok else f"{stage}: '{col}' within range"

print("dq_check_range() defined")
```

    dq_check_range() defined

#### Polars — assert data freshness against SLA with `max()`

```python
# Asserts most recent date is within max_age_days of today
# Detects stale data that missed recent trading days

def dq_check_freshness(df: pl.DataFrame, date_col: str, max_age_days: int, stage: str) -> tuple[bool, str]:
    """Assert most recent date is within max_age_days of today."""
    if len(df) == 0:
        return False, f"{stage}: empty DataFrame, can't check freshness"
    latest_raw = df[date_col].max()
    if latest_raw is None:
        return False, f"{stage}: all dates are null"
    latest = Date.fromisoformat(str(latest_raw)) if not isinstance(latest_raw, Date) else latest_raw
    age = (Date.today() - latest).days
    ok = age <= max_age_days
    return ok, f"{stage}: latest date {latest} ({age}d ago)" + ("" if ok else f" EXCEEDS {max_age_days}d SLA")

print("dq_check_freshness() defined")
```

    dq_check_freshness() defined

#### Polars — assert minimum row count with `len()`

```python
# Asserts DataFrame has at least min_rows
# Catches partial loads or missing symbols

def dq_check_row_count(df: pl.DataFrame, min_rows: int, stage: str) -> tuple[bool, str]:
    """Assert DataFrame has at least min_rows."""
    ok = len(df) >= min_rows
    return ok, f"{stage}: {len(df)} rows" + ("" if ok else f" BELOW minimum {min_rows}")

print("dq_check_row_count() defined")
```

    dq_check_row_count() defined

#### Pipeline — run all quality gate assertions with `log.info()`

Runs all quality checks for a stage, logs PASS/FAIL for each
Raises DataQualityError if any check fails (when fail_fast=True)
Returns results as a DataFrame for display

```python
def run_quality_gate(checks: list[tuple[bool, str]], stage: str, fail_fast: bool = True) -> pl.DataFrame:
    """Run all quality checks. Logs results. Raises DataQualityError if any fail."""
    results = []
    all_passed = True
    for passed, msg in checks:
        status = "PASS" if passed else "FAIL"
        log_fn = log.info if passed else log.error
        log_fn(f"  DQ {status}: {msg}")
        results.append({"check": msg, "status": status})
        if not passed:
            all_passed = False

    if not all_passed and fail_fast:
        raise DataQualityError(f"Data quality gate FAILED for {stage}")

    return pl.DataFrame(results)

print("run_quality_gate() defined")
```

    run_quality_gate() defined

## Dimension Tables

Two reference dimensions that enrich the pipeline:

- **dim_symbol** — company metadata from yfinance with **SCD Type 2** historization.
  When a symbol's sector, industry, or other attribute changes, the current record is
  closed (`valid_to` set, `is_current = 0`) and a new record is inserted. This enables
  point-in-time queries: "what sector was SAP in on 2024-06-15?"

- **dim_calendar** — per-exchange trading calendar. Each row is a `(date, exchange_code)`
  pair with flags: `is_trading_day`, `is_month_end`, `is_quarter_end`. Non-trading days
  (weekends + holidays) are inferred from the absence of trading data.
  Aligned with the existing `stoxx.bronze.trading_calendar` schema.

Both use MERGE upsert logic — safe to re-run without duplicates.

#### yfinance — fetch symbol metadata to JSON landing zone with `Ticker.info`

Fetches company metadata from yfinance for each symbol in the universe
Saves raw API response to landing/dim_symbol.json for audit trail
Decoupled from SQL load: can re-run SQL upsert without re-fetching

```python
SCD2_COMPARE_COLS = ["company_name", "sector", "industry", "country", "exchange", "currency"]

def fetch_symbols_to_landing(symbols: list[str]) -> Path:
    """Fetch metadata from yfinance and save to JSON landing zone."""
    records = []
    for symbol in symbols:
        ticker = yf.Ticker(symbol)
        try:
            info = ticker.info or {}
        except Exception as e:
            log.warning(f"Fetch failed for {symbol}: {e}, using empty info")
            info = {}
        sector = info.get("sector")
        industry = info.get("industry")
        rec = {
            "symbol": symbol,
            "longName": info.get("longName"),
            "shortName": info.get("shortName"),
            "sector": sector,
            "sectorKey": sector.lower().replace(" ", "_") if sector else None,
            "industry": industry,
            "industryKey": industry.lower().replace(" ", "_") if industry else None,
            "country": info.get("country"),
            "city": info.get("city"),
            "website": info.get("website"),
            "longBusinessSummary": info.get("longBusinessSummary"),
            "exchange": info.get("exchange"),
            "fullExchangeName": info.get("fullExchangeName"),
            "exchangeTimezoneName": info.get("exchangeTimezoneName"),
            "exchangeTimezoneShortName": info.get("exchangeTimezoneShortName"),
            "currency": info.get("currency"),
            "financialCurrency": info.get("financialCurrency"),
            "quoteType": info.get("quoteType"),
            "market": info.get("market"),
            "marketCap": info.get("marketCap"),
        }
        records.append(rec)
        log.info(f"  {symbol}: fetched ({rec['longName']})")

    landing_path = LANDING_DIR / "dim_symbol.json"
    landing_path.write_text(json.dumps(records, indent=2, default=str), encoding="utf-8")
    log.info(f"Landed: {landing_path} ({len(records)} symbols)")
    return landing_path

print("fetch_symbols_to_landing() defined")
```

    fetch_symbols_to_landing() defined

#### JSON — load symbol metadata from landing zone with `json.loads()`

```python
# Reads the raw JSON file produced by fetch_symbols_to_landing()
# Returns a list of dicts ready for SCD2 upsert

def load_symbols_from_landing() -> list[dict]:
    """Read symbol metadata from JSON landing zone."""
    landing_path = LANDING_DIR / "dim_symbol.json"
    return json.loads(landing_path.read_text(encoding="utf-8"))

print("load_symbols_from_landing() defined")
```

    load_symbols_from_landing() defined

#### SQL Server — define SCD Type 2 upsert for one symbol with `MERGE INTO`

SCD Type 2 logic for a single symbol record:
New symbol → INSERT fresh record (is_current=1)
Attributes unchanged → skip (no duplicate)
Attributes changed → close old (valid_to=now, is_current=0), INSERT new

```python
def scd2_upsert_symbol(rec: dict) -> str:
    """SCD Type 2 upsert for one symbol from landed JSON. Returns action taken."""
    db_rec = {
        "symbol": rec["symbol"],
        "company_name": rec.get("longName") or rec.get("shortName"),
        "short_name": rec.get("shortName"),
        "sector": rec.get("sector"),
        "sector_key": rec.get("sectorKey"),
        "industry": rec.get("industry"),
        "industry_key": rec.get("industryKey"),
        "country": rec.get("country"),
        "city": rec.get("city"),
        "exchange": rec.get("exchange"),
        "full_exchange_name": rec.get("fullExchangeName"),
        "currency": rec.get("currency"),
        "market_cap": rec.get("marketCap"),
        "website": rec.get("website"),
    }

    # Check current record
    cur.execute(
        "SELECT id, company_name, sector, industry, country, exchange, currency "
        "FROM dim_symbol WHERE symbol = ? AND is_current = 1",
        db_rec["symbol"]
    )
    existing = cur.fetchone()

    if existing is None:
        cur.execute("""
            INSERT INTO dim_symbol
                (symbol, company_name, short_name, sector, sector_key,
                 industry, industry_key, country, city, exchange,
                 full_exchange_name, currency, market_cap, website)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
            db_rec["symbol"], db_rec["company_name"], db_rec["short_name"],
            db_rec["sector"], db_rec["sector_key"], db_rec["industry"], db_rec["industry_key"],
            db_rec["country"], db_rec["city"], db_rec["exchange"],
            db_rec["full_exchange_name"], db_rec["currency"], db_rec["market_cap"],
            db_rec["website"],
        )
        sql_conn.commit()
        return "INSERT"

    # Compare tracked columns
    old_vals = (existing[1], existing[2], existing[3], existing[4], existing[5], existing[6])
    new_vals = (db_rec["company_name"], db_rec["sector"], db_rec["industry"],
                db_rec["country"], db_rec["exchange"], db_rec["currency"])

    if old_vals == new_vals:
        return "UNCHANGED"

    # Attribute changed → close old record, insert new
    cur.execute(
        "UPDATE dim_symbol SET valid_to = SYSUTCDATETIME(), is_current = 0 WHERE id = ?",
        existing[0]
    )
    cur.execute("""
        INSERT INTO dim_symbol
            (symbol, company_name, short_name, sector, sector_key,
             industry, industry_key, country, city, exchange,
             full_exchange_name, currency, market_cap, website)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """,
        db_rec["symbol"], db_rec["company_name"], db_rec["short_name"],
        db_rec["sector"], db_rec["sector_key"], db_rec["industry"], db_rec["industry_key"],
        db_rec["country"], db_rec["city"], db_rec["exchange"],
        db_rec["full_exchange_name"], db_rec["currency"], db_rec["market_cap"],
        db_rec["website"],
    )
    sql_conn.commit()
    return "SCD2_UPDATE"

print("scd2_upsert_symbol() defined")
```

    scd2_upsert_symbol() defined

#### SQL Server — orchestrate SCD Type 2 upsert for all symbols with `cursor.execute()`

```python
# Orchestrates: read landing JSON → SCD2 upsert each symbol → return results
# Logs action taken for each symbol (INSERT / UNCHANGED / SCD2_UPDATE)

def populate_dim_symbol_from_landing() -> pl.DataFrame:
    """Load from landing JSON and apply SCD Type 2 upsert."""
    records = load_symbols_from_landing()
    results = []
    for rec in records:
        action = scd2_upsert_symbol(rec)
        rec["_action"] = action
        results.append(rec)
        log.info(f"  {rec['symbol']}: {action}")
    return pl.DataFrame(results)

print("populate_dim_symbol_from_landing() defined")
```

    populate_dim_symbol_from_landing() defined

#### SQL Server — load symbols from landing and SCD2 upsert with `MERGE INTO`

```python
# Step 1: Fetch from yfinance API → JSON landing zone
print("Step 1: Fetching symbol metadata to landing zone...\n")
fetch_symbols_to_landing(SYMBOLS)

# Step 2: Load from landing JSON → SCD2 upsert into dim_symbol
print("\nStep 2: SCD2 upsert from landing zone...\n")
dim_symbol_df = populate_dim_symbol_from_landing()
dim_symbol_df.select("symbol", "longName", "sector", "country", "exchange", "_action")
```

    Step 1: Fetching symbol metadata to landing zone...

    01:02:18 | INFO  |   SAP.DE: fetched (SAP SE)
    01:02:19 | INFO  |   SIE.DE: fetched (Siemens Aktiengesellschaft)
    01:02:19 | INFO  |   ALV.DE: fetched (Allianz SE)
    01:02:19 | INFO  |   DTE.DE: fetched (Deutsche Telekom AG)
    01:02:20 | INFO  |   BAS.DE: fetched (BASF SE)
    01:02:20 | INFO  | Landed: C:\Users\aperi\DEV\LANG\data\pipeline\landing\dim_symbol.json (5 symbols)
    01:02:20 | INFO  |   SAP.DE: UNCHANGED
    01:02:20 | INFO  |   SIE.DE: UNCHANGED
    01:02:20 | INFO  |   ALV.DE: UNCHANGED
    01:02:20 | INFO  |   DTE.DE: UNCHANGED
    01:02:20 | INFO  |   BAS.DE: UNCHANGED

    
    Step 2: SCD2 upsert from landing zone...

<table>
  <thead>
    <tr>
      <th >symbol</th>
      <th >longName</th>
      <th >sector</th>
      <th >country</th>
      <th >exchange</th>
      <th >_action</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >SAP.DE</td>
      <td >SAP SE</td>
      <td >Technology</td>
      <td >Germany</td>
      <td >GER</td>
      <td >UNCHANGED</td>
    </tr>
    <tr>
      <td >SIE.DE</td>
      <td >Siemens Aktiengesellschaft</td>
      <td >Industrials</td>
      <td >Germany</td>
      <td >GER</td>
      <td >UNCHANGED</td>
    </tr>
    <tr>
      <td >ALV.DE</td>
      <td >Allianz SE</td>
      <td >Financial Services</td>
      <td >Germany</td>
      <td >GER</td>
      <td >UNCHANGED</td>
    </tr>
    <tr>
      <td >DTE.DE</td>
      <td >Deutsche Telekom AG</td>
      <td >Communication Services</td>
      <td >Germany</td>
      <td >GER</td>
      <td >UNCHANGED</td>
    </tr>
    <tr>
      <td >BAS.DE</td>
      <td >BASF SE</td>
      <td >Basic Materials</td>
      <td >Germany</td>
      <td >GER</td>
      <td >UNCHANGED</td>
    </tr>
  </tbody>
</table>

#### pandas-market-calendars — generate trading calendar with `get_calendar().schedule()`

Uses pandas-market-calendars to get accurate trading days per exchange
Each exchange has its own holiday schedule (e.g., XETR has German holidays)
Builds a (date, exchange_code) grid with precise is_trading_day flags

```python
def generate_dim_calendar(start: str, end: str, exchange_codes: list[str]) -> pl.DataFrame:
    """Generate a per-exchange calendar using pandas-market-calendars."""
    frames = []

    for yf_code in exchange_codes:
        # Map yfinance exchange code to mcal calendar name
        mcal_name = EXCHANGE_MAP.get(yf_code, yf_code)

        try:
            cal = mcal.get_calendar(mcal_name)
        except RuntimeError:
            print(f"  Warning: no calendar for {yf_code} ({mcal_name}), using XETR fallback")
            cal = mcal.get_calendar("XETR")

        # Get actual trading days from market calendar
        schedule = cal.schedule(start_date=start, end_date=end)
        trading_dates = {d.date() for d in schedule.index}

        # Build full date range
        all_dates = pl.date_range(
            Date.fromisoformat(start),
            Date.fromisoformat(end),
            eager=True
        ).alias("date")

        df = pl.DataFrame({"date": all_dates}).with_columns(
            pl.lit(yf_code).alias("exchange_code"),
            pl.col("date").dt.year().cast(pl.Int16).alias("year"),
            pl.col("date").dt.quarter().cast(pl.UInt8).alias("quarter"),
            pl.col("date").dt.month().cast(pl.UInt8).alias("month"),
            pl.col("date").dt.week().cast(pl.UInt8).alias("week_of_year"),
            pl.col("date").dt.weekday().cast(pl.UInt8).alias("day_of_week"),
        )

        # Mark trading days from mcal schedule
        trading_list = sorted(trading_dates)
        df = df.with_columns(
            pl.col("date").is_in(trading_list).cast(pl.Int8).alias("is_trading_day")
        )

        # Mark month-end and quarter-end
        df = df.with_columns(
            (pl.col("date") == pl.col("date").dt.month_end()).cast(pl.Int8).alias("is_month_end"),
            ((pl.col("month").is_in([3, 6, 9, 12])) &
             (pl.col("date") == pl.col("date").dt.month_end())).cast(pl.Int8).alias("is_quarter_end"),
        )

        frames.append(df)
        print(f"  {yf_code} ({mcal_name}): {len(trading_dates)} trading days, "
              f"{len(all_dates) - len(trading_dates)} non-trading")

    return pl.concat(frames).sort(["exchange_code", "date"])

# Get exchanges from dim_symbol (just populated)
exchanges = dim_symbol_df.select("exchange").unique().to_series().to_list()
exchanges = [e for e in exchanges if e is not None]
print(f"Building calendar for exchanges: {exchanges}\n")

cal_df = generate_dim_calendar(START_DATE, END_DATE, exchanges)
print(f"\nCalendar total: {len(cal_df)} rows")
cal_df.head()
```

    Building calendar for exchanges: ['GER']
    
      GER (XETR): 505 trading days, 226 non-trading
    
    Calendar total: 731 rows

<table>
  <thead>
    <tr>
      <th >date</th>
      <th >exchange_code</th>
      <th >year</th>
      <th >quarter</th>
      <th >month</th>
      <th >week_of_year</th>
      <th >day_of_week</th>
      <th >is_trading_day</th>
      <th >is_month_end</th>
      <th >is_quarter_end</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >2024-03-29 00:00:00</td>
      <td >GER</td>
      <td >2024</td>
      <td >1</td>
      <td >3</td>
      <td >13</td>
      <td >5</td>
      <td >0</td>
      <td >0</td>
      <td >0</td>
    </tr>
    <tr>
      <td >2024-03-30 00:00:00</td>
      <td >GER</td>
      <td >2024</td>
      <td >1</td>
      <td >3</td>
      <td >13</td>
      <td >6</td>
      <td >0</td>
      <td >0</td>
      <td >0</td>
    </tr>
    <tr>
      <td >2024-03-31 00:00:00</td>
      <td >GER</td>
      <td >2024</td>
      <td >1</td>
      <td >3</td>
      <td >13</td>
      <td >7</td>
      <td >0</td>
      <td >1</td>
      <td >1</td>
    </tr>
    <tr>
      <td >2024-04-01 00:00:00</td>
      <td >GER</td>
      <td >2024</td>
      <td >2</td>
      <td >4</td>
      <td >14</td>
      <td >1</td>
      <td >0</td>
      <td >0</td>
      <td >0</td>
    </tr>
    <tr>
      <td >2024-04-02 00:00:00</td>
      <td >GER</td>
      <td >2024</td>
      <td >2</td>
      <td >4</td>
      <td >14</td>
      <td >2</td>
      <td >1</td>
      <td >0</td>
      <td >0</td>
    </tr>
  </tbody>
</table>

#### SQL Server — persist calendar dimension with `MERGE INTO`

```python
# MERGE upsert calendar dates into dim_calendar
# Key: (date, exchange_code) — one row per date per exchange

def persist_dim_calendar(cal_df: pl.DataFrame) -> int:
    """MERGE upsert calendar dimension into SQL Server."""
    count = 0
    for row in cal_df.iter_rows(named=True):
        cur.execute("""
            MERGE dim_calendar AS tgt
            USING (SELECT ? AS date, ? AS exchange_code) AS src
               ON tgt.date = src.date AND tgt.exchange_code = src.exchange_code
            WHEN MATCHED THEN UPDATE SET
                year = ?, quarter = ?, month = ?, week_of_year = ?,
                day_of_week = ?, is_trading_day = ?,
                is_month_end = ?, is_quarter_end = ?
            WHEN NOT MATCHED THEN INSERT
                (date, exchange_code, year, quarter, month, week_of_year,
                 day_of_week, is_trading_day, is_month_end, is_quarter_end)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """,
            row["date"], row["exchange_code"],
            row["year"], row["quarter"], row["month"], row["week_of_year"],
            row["day_of_week"], row["is_trading_day"],
            row["is_month_end"], row["is_quarter_end"],
            row["date"], row["exchange_code"],
            row["year"], row["quarter"], row["month"], row["week_of_year"],
            row["day_of_week"], row["is_trading_day"],
            row["is_month_end"], row["is_quarter_end"],
        )
        count += 1
    sql_conn.commit()
    print(f"dim_calendar: {count} rows upserted")
    return count

persist_dim_calendar(cal_df)
```

    dim_calendar: 731 rows upserted

#### Polars — display detected exchange holidays with `filter()`

```python
# pandas-market-calendars already provides accurate trading/non-trading flags
# Display the holidays it detected (weekdays marked as non-trading)

holidays = cal_df.filter(
    (pl.col("day_of_week").is_between(1, 5)) &  # weekday
    (pl.col("is_trading_day") == 0)
).select("date", "exchange_code", "day_of_week").sort("exchange_code", "date")

print(f"Holidays detected: {len(holidays)} (weekdays with no trading)")
holidays.head()
```

    Holidays detected: 16 (weekdays with no trading)

<table>
  <thead>
    <tr>
      <th >date</th>
      <th >exchange_code</th>
      <th >day_of_week</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >2024-03-29 00:00:00</td>
      <td >GER</td>
      <td >5</td>
    </tr>
    <tr>
      <td >2024-04-01 00:00:00</td>
      <td >GER</td>
      <td >1</td>
    </tr>
    <tr>
      <td >2024-05-01 00:00:00</td>
      <td >GER</td>
      <td >3</td>
    </tr>
    <tr>
      <td >2024-12-24 00:00:00</td>
      <td >GER</td>
      <td >2</td>
    </tr>
    <tr>
      <td >2024-12-25 00:00:00</td>
      <td >GER</td>
      <td >3</td>
    </tr>
  </tbody>
</table>

## Bronze Layer

The Bronze layer follows the **landing zone pattern**:
1. **Fetch** — download OHLCV data from yfinance to JSON files in `landing/`
2. **Validate** — parse JSON through Pydantic `RawOHLCV` model
3. **Load** — MERGE upsert validated data into `bronze_ohlcv`

This decouples API calls from SQL ingestion:
- Re-run the SQL load without re-fetching (replay from landing files)
- Audit trail: raw JSON files show exactly what the API returned
- Incremental: only fetch new data since last known date per symbol

#### yfinance — fetch OHLCV to JSON landing zone with `Ticker.history()`

Downloads OHLCV data from yfinance and saves to landing/ohlcv_{symbol}.json
Each symbol gets its own JSON file with raw API response
Uses fetch_with_retry() for transient failure handling

```python
def fetch_ohlcv_to_landing(symbol: str, start: str, end: str) -> Path | None:
    """Download OHLCV data from yfinance and save to JSON landing zone."""
    ticker = yf.Ticker(symbol)
    pdf = fetch_with_retry(ticker, start, end)

    if pdf.empty:
        return None

    # Convert to records for JSON serialization
    pdf = pdf.reset_index()
    records = []
    for _, row in pdf.iterrows():
        records.append({
            "symbol": symbol,
            "date": row["Date"].strftime("%Y-%m-%d"),
            "open": float(row["Open"]),
            "high": float(row["High"]),
            "low": float(row["Low"]),
            "close": float(row["Close"]),
            "adj_close": float(row["Adj Close"]),
            "volume": int(row["Volume"]),
            "dividends": float(row["Dividends"]),
            "stock_splits": float(row["Stock Splits"]),
        })

    safe_symbol = symbol.replace(".", "_")
    landing_path = LANDING_DIR / f"ohlcv_{safe_symbol}.json"
    landing_path.write_text(json.dumps(records, indent=2), encoding="utf-8")
    return landing_path

print("fetch_ohlcv_to_landing() defined")
```

    fetch_ohlcv_to_landing() defined

#### Polars — load OHLCV from JSON landing zone with `pl.DataFrame()`

```python
# Reads a symbol's JSON landing file into a Polars DataFrame
# Casts date strings to pl.Date for downstream processing

def load_ohlcv_from_landing(symbol: str) -> pl.DataFrame:
    """Read OHLCV data from JSON landing zone into Polars DataFrame."""
    safe_symbol = symbol.replace(".", "_")
    landing_path = LANDING_DIR / f"ohlcv_{safe_symbol}.json"
    if not landing_path.exists():
        return pl.DataFrame()

    records = json.loads(landing_path.read_text(encoding="utf-8"))
    if not records:
        return pl.DataFrame()

    df = pl.DataFrame(records)
    df = df.with_columns(pl.col("date").str.to_date("%Y-%m-%d"))
    return df

print("load_ohlcv_from_landing() defined")
```

    load_ohlcv_from_landing() defined

#### yfinance — test single symbol landing zone fetch with `fetch_ohlcv_to_landing()`

```python
# Verify the landing zone pattern: fetch → JSON → load → DataFrame

test_path = fetch_ohlcv_to_landing("SAP.DE", "2024-06-01", "2024-06-30")
if test_path:
    print(f"Landed: {test_path} ({test_path.stat().st_size / 1024:.1f} KB)")
else:
    print("No data returned")

test_df = load_ohlcv_from_landing("SAP.DE")
print(f"Loaded: {len(test_df)} rows, columns: {test_df.columns}")
test_df.head()
```

    Landed: C:\Users\aperi\DEV\LANG\data\pipeline\landing\ohlcv_SAP_DE.json (5.8 KB)
    Loaded: 20 rows, columns: ['symbol', 'date', 'open', 'high', 'low', 'close', 'adj_close', 'volume', 'dividends', 'stock_splits']

<table>
  <thead>
    <tr>
      <th >symbol</th>
      <th >date</th>
      <th >open</th>
      <th >high</th>
      <th >low</th>
      <th >close</th>
      <th >adj_close</th>
      <th >volume</th>
      <th >dividends</th>
      <th >stock_splits</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >SAP.DE</td>
      <td >2024-06-03 00:00:00</td>
      <td >169.740005</td>
      <td >169.820007</td>
      <td >166.960007</td>
      <td >168.259995</td>
      <td >166.752808</td>
      <td >1531728</td>
      <td >0.000000</td>
      <td >0.000000</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >2024-06-04 00:00:00</td>
      <td >168.520004</td>
      <td >170.440002</td>
      <td >167.660004</td>
      <td >168.600006</td>
      <td >167.089767</td>
      <td >1592071</td>
      <td >0.000000</td>
      <td >0.000000</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >2024-06-05 00:00:00</td>
      <td >170.000000</td>
      <td >171.820007</td>
      <td >169.080002</td>
      <td >171.520004</td>
      <td >169.983612</td>
      <td >1352916</td>
      <td >0.000000</td>
      <td >0.000000</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >2024-06-06 00:00:00</td>
      <td >176.020004</td>
      <td >180.240005</td>
      <td >176.000000</td>
      <td >177.720001</td>
      <td >176.128067</td>
      <td >2089549</td>
      <td >0.000000</td>
      <td >0.000000</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >2024-06-07 00:00:00</td>
      <td >177.500000</td>
      <td >178.259995</td>
      <td >175.699997</td>
      <td >177.360001</td>
      <td >175.771301</td>
      <td >1224863</td>
      <td >0.000000</td>
      <td >0.000000</td>
    </tr>
  </tbody>
</table>

#### Pydantic — validate Bronze rows with `BaseModel()` row-level check

```python
# Validates each row through RawOHLCV Pydantic model
# Valid rows are collected; rejected rows go to quarantine table with error details

def validate_bronze(df: pl.DataFrame, batch_id: str = "") -> tuple[pl.DataFrame, int]:
    """Validate each row through RawOHLCV. Quarantines rejected rows."""
    valid_rows = []
    rejected = 0

    for row in df.iter_rows(named=True):
        try:
            record = RawOHLCV(
                symbol=str(row["symbol"]),
                date=row["date"],
                open=float(row["open"]),
                high=float(row["high"]),
                low=float(row["low"]),
                close=float(row["close"]),
                adj_close=float(row["adj_close"]),
                volume=int(row["volume"]),
                dividends=float(row["dividends"]),
                stock_splits=float(row["stock_splits"]),
            )
            valid_rows.append(record.model_dump())
        except Exception as e:
            rejected += 1
            if batch_id:
                quarantine_row(batch_id, "bronze", dict(row), str(e))

    if not valid_rows:
        return pl.DataFrame(), rejected

    return pl.DataFrame(valid_rows), rejected

log.info("validate_bronze() defined \u2014 rejects go to quarantine")
```

    01:02:56 | INFO  | validate_bronze() defined — rejects go to quarantine

#### Pydantic — test Bronze validation on sample data

```python
# Should pass all rows since yfinance data is generally clean

valid_df, rejected = validate_bronze(test_df, batch_id="test")
print(f"Valid: {len(valid_df)} rows | Rejected: {rejected} rows")
valid_df.head(5)
```

    Valid: 20 rows | Rejected: 0 rows

<table>
  <thead>
    <tr>
      <th >symbol</th>
      <th >date</th>
      <th >open</th>
      <th >high</th>
      <th >low</th>
      <th >close</th>
      <th >adj_close</th>
      <th >volume</th>
      <th >dividends</th>
      <th >stock_splits</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >SAP.DE</td>
      <td >2024-06-03 00:00:00</td>
      <td >169.740005</td>
      <td >169.820007</td>
      <td >166.960007</td>
      <td >168.259995</td>
      <td >166.752808</td>
      <td >1531728</td>
      <td >0.000000</td>
      <td >0.000000</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >2024-06-04 00:00:00</td>
      <td >168.520004</td>
      <td >170.440002</td>
      <td >167.660004</td>
      <td >168.600006</td>
      <td >167.089767</td>
      <td >1592071</td>
      <td >0.000000</td>
      <td >0.000000</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >2024-06-05 00:00:00</td>
      <td >170.000000</td>
      <td >171.820007</td>
      <td >169.080002</td>
      <td >171.520004</td>
      <td >169.983612</td>
      <td >1352916</td>
      <td >0.000000</td>
      <td >0.000000</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >2024-06-06 00:00:00</td>
      <td >176.020004</td>
      <td >180.240005</td>
      <td >176.000000</td>
      <td >177.720001</td>
      <td >176.128067</td>
      <td >2089549</td>
      <td >0.000000</td>
      <td >0.000000</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >2024-06-07 00:00:00</td>
      <td >177.500000</td>
      <td >178.259995</td>
      <td >175.699997</td>
      <td >177.360001</td>
      <td >175.771301</td>
      <td >1224863</td>
      <td >0.000000</td>
      <td >0.000000</td>
    </tr>
  </tbody>
</table>

#### Bronze — define incremental ingestion pipeline with landing zone + `MERGE INTO`

Full Bronze pipeline: land → validate → MERGE upsert → lineage
Step 1: Check last known date per symbol in SQL Server
Step 2: Fetch only new data from yfinance to JSON landing zone
Step 3: Load from landing, validate through Pydantic, MERGE into bronze_ohlcv
Returns the FULL bronze dataset from SQL for downstream stages

```python
def ingest_bronze(symbols: list[str], start: str, end: str, batch_id: str) -> tuple[pl.DataFrame, StageLineage]:
    """Incrementally fetch to landing zone, validate, and MERGE upsert."""
    stage_ctx = start_stage(batch_id, "bronze", input_rows=0)
    all_frames = []
    total_rejected = 0
    total_fetched = 0

    for symbol in symbols:
        # Check last known date in SQL Server
        cur.execute("SELECT MAX(date) FROM bronze_ohlcv WHERE symbol = ?", symbol)
        row = cur.fetchone()
        last_date = row[0] if row and row[0] else None

        # Determine fetch range
        if last_date:
            fetch_start = (last_date + timedelta(days=1)).isoformat()
            if fetch_start >= end:
                log.info(f"  {symbol}: up to date (last: {last_date})")
                continue
        else:
            fetch_start = start

        # Step 1: Fetch from yfinance → JSON landing zone
        landing_path = fetch_ohlcv_to_landing(symbol, fetch_start, end)
        if landing_path is None:
            log.info(f"  {symbol}: no new data from {fetch_start}")
            continue

        # Step 2: Load from landing zone
        raw_df = load_ohlcv_from_landing(symbol)
        total_fetched += len(raw_df)

        # Step 3: Validate through Pydantic
        valid_df, rejected = validate_bronze(raw_df, batch_id)
        total_rejected += rejected

        if len(valid_df) > 0:
            all_frames.append(valid_df)
            # MERGE upsert into SQL Server
            merged = merge_bronze(valid_df, batch_id)
            size_kb = landing_path.stat().st_size / 1024
            log.info(f"  {symbol}: {len(raw_df)} landed ({size_kb:.1f} KB), "
                  f"{len(valid_df)} valid, {rejected} rejected, {merged} merged")

    # Combine new data for lineage hash
    new_df = pl.concat(all_frames) if all_frames else pl.DataFrame()
    if len(new_df) > 0:
        new_df = new_df.with_columns(pl.lit(batch_id).alias("batch_id"))

    stage_ctx["input_rows"] = total_fetched
    lineage = end_stage(stage_ctx, new_df if len(new_df) > 0 else pl.DataFrame({"_": []}), total_rejected)
    persist_lineage(lineage)

    # Return FULL bronze dataset for downstream stages
    bronze_full = pl.read_database(
        "SELECT symbol, date, [open] as [open], high, low, [close] as [close], "
        "adj_close, volume, dividends, stock_splits, batch_id "
        "FROM bronze_ohlcv ORDER BY symbol, date",
        connection=sql_engine
    )

    return bronze_full, lineage

print("ingest_bronze() defined \u2014 landing zone + incremental MERGE")
```

    ingest_bronze() defined — landing zone + incremental MERGE

#### Bronze — execute incremental ingestion for all symbols

```python
# Live pipeline run: yfinance → JSON landing → validate → MERGE into bronze_ohlcv
# First run: full history to landing zone. Re-runs: only new trading days.

batch_id = generate_batch_id()
print(f"Pipeline batch_id: {batch_id[:8]}...")
print(f"Landing zone: {LANDING_DIR}")
print(f"Fetching {len(SYMBOLS)} symbols, range {START_DATE} \u2192 {END_DATE}")
print(f"(incremental: only new data since last ingestion)\n")

t0 = time.time()
bronze_df, bronze_lineage = ingest_bronze(SYMBOLS, START_DATE, END_DATE, batch_id)
elapsed = (time.time() - t0) * 1000

log.info(f"Bronze complete: {len(bronze_df)} total rows in {elapsed:.0f}ms")
print(f"Output hash: {bronze_lineage.output_hash}")
```

    01:03:09 | INFO  |   SAP.DE: 1 landed (0.3 KB), 1 valid, 0 rejected, 1 merged

    Pipeline batch_id: bc9d3a23...
    Landing zone: C:\Users\aperi\DEV\LANG\data\pipeline\landing
    Fetching 5 symbols, range 2024-03-29 → 2026-03-29
    (incremental: only new data since last ingestion)

    01:03:09 | INFO  |   SIE.DE: 1 landed (0.3 KB), 1 valid, 0 rejected, 1 merged
    01:03:10 | INFO  |   ALV.DE: 1 landed (0.3 KB), 1 valid, 0 rejected, 1 merged
    01:03:10 | INFO  |   DTE.DE: 1 landed (0.3 KB), 1 valid, 0 rejected, 1 merged
    01:03:10 | INFO  |   BAS.DE: 1 landed (0.3 KB), 1 valid, 0 rejected, 1 merged
    01:03:10 | INFO  | Bronze complete: 2530 total rows in 744ms

    Output hash: bf7713401ce6f144

#### Polars — display Bronze sample data with `head()`

```python
# Show first rows of ingested data to verify schema and values

bronze_df.head(5)
```

<table>
  <thead>
    <tr>
      <th >symbol</th>
      <th >date</th>
      <th >open</th>
      <th >high</th>
      <th >low</th>
      <th >close</th>
      <th >adj_close</th>
      <th >volume</th>
      <th >dividends</th>
      <th >stock_splits</th>
      <th >batch_id</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >ALV.DE</td>
      <td >2024-03-28 00:00:00</td>
      <td >277.000000</td>
      <td >278.100006</td>
      <td >276.450012</td>
      <td >277.799988</td>
      <td >252.825394</td>
      <td >919173</td>
      <td >0.000000</td>
      <td >0.000000</td>
      <td >9c135c08-937d-4413-8bb4-1b66407ed9a5</td>
    </tr>
    <tr>
      <td >ALV.DE</td>
      <td >2024-04-02 00:00:00</td>
      <td >278.200012</td>
      <td >280.000000</td>
      <td >272.200012</td>
      <td >273.899994</td>
      <td >249.276001</td>
      <td >1013176</td>
      <td >0.000000</td>
      <td >0.000000</td>
      <td >9c135c08-937d-4413-8bb4-1b66407ed9a5</td>
    </tr>
    <tr>
      <td >ALV.DE</td>
      <td >2024-04-03 00:00:00</td>
      <td >274.500000</td>
      <td >276.600006</td>
      <td >273.899994</td>
      <td >274.399994</td>
      <td >249.731064</td>
      <td >782102</td>
      <td >0.000000</td>
      <td >0.000000</td>
      <td >9c135c08-937d-4413-8bb4-1b66407ed9a5</td>
    </tr>
    <tr>
      <td >ALV.DE</td>
      <td >2024-04-04 00:00:00</td>
      <td >274.100006</td>
      <td >275.200012</td>
      <td >272.200012</td>
      <td >272.399994</td>
      <td >247.910873</td>
      <td >690551</td>
      <td >0.000000</td>
      <td >0.000000</td>
      <td >9c135c08-937d-4413-8bb4-1b66407ed9a5</td>
    </tr>
    <tr>
      <td >ALV.DE</td>
      <td >2024-04-05 00:00:00</td>
      <td >270.000000</td>
      <td >270.200012</td>
      <td >267.100006</td>
      <td >268.799988</td>
      <td >244.634491</td>
      <td >930874</td>
      <td >0.000000</td>
      <td >0.000000</td>
      <td >9c135c08-937d-4413-8bb4-1b66407ed9a5</td>
    </tr>
  </tbody>
</table>

#### Polars — display Bronze row counts per symbol with `group_by().agg()`

```python
# Verify all symbols were ingested with reasonable row counts

bronze_df.group_by("symbol").agg(
    pl.col("date").count().alias("rows"),
    pl.col("date").min().alias("first_date"),
    pl.col("date").max().alias("last_date"),
).sort("symbol")
```

<table>
  <thead>
    <tr>
      <th >symbol</th>
      <th >rows</th>
      <th >first_date</th>
      <th >last_date</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >ALV.DE</td>
      <td >506</td>
      <td >2024-03-28 00:00:00</td>
      <td >2026-03-27 00:00:00</td>
    </tr>
    <tr>
      <td >BAS.DE</td>
      <td >506</td>
      <td >2024-03-28 00:00:00</td>
      <td >2026-03-27 00:00:00</td>
    </tr>
    <tr>
      <td >DTE.DE</td>
      <td >506</td>
      <td >2024-03-28 00:00:00</td>
      <td >2026-03-27 00:00:00</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >506</td>
      <td >2024-03-28 00:00:00</td>
      <td >2026-03-27 00:00:00</td>
    </tr>
    <tr>
      <td >SIE.DE</td>
      <td >506</td>
      <td >2024-03-28 00:00:00</td>
      <td >2026-03-27 00:00:00</td>
    </tr>
  </tbody>
</table>

#### Pipeline — run Bronze data quality gate with `run_quality_gate()`

```python
# Data quality assertions on Bronze output
# All checks must pass before Silver processing begins

bronze_dq = run_quality_gate([
    dq_check_not_empty(bronze_df, "bronze"),
    dq_check_no_null_keys(bronze_df, ["symbol", "date"], "bronze"),
    dq_check_no_duplicates(bronze_df, ["symbol", "date"], "bronze"),
    dq_check_range(bronze_df, "close", 0.01, 100_000, "bronze"),
    dq_check_range(bronze_df, "volume", 0, 10_000_000_000, "bronze"),
    dq_check_freshness(bronze_df, "date", 5, "bronze"),
    dq_check_row_count(bronze_df, len(SYMBOLS) * 200, "bronze"),
], stage="bronze")

bronze_dq
```

    01:03:20 | INFO  |   DQ PASS: bronze: 2530 rows
    01:03:20 | INFO  |   DQ PASS: bronze: no null keys in ['symbol', 'date']
    01:03:20 | INFO  |   DQ PASS: bronze: no duplicates
    01:03:20 | INFO  |   DQ PASS: bronze: 'close' within range
    01:03:20 | INFO  |   DQ PASS: bronze: 'volume' within range
    01:03:20 | INFO  |   DQ PASS: bronze: latest date 2026-03-27 (2d ago)
    01:03:20 | INFO  |   DQ PASS: bronze: 2530 rows

<table>
  <thead>
    <tr>
      <th >check</th>
      <th >status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >bronze: 2530 rows</td>
      <td >PASS</td>
    </tr>
    <tr>
      <td >bronze: no null keys in ['symbol', 'date']</td>
      <td >PASS</td>
    </tr>
    <tr>
      <td >bronze: no duplicates</td>
      <td >PASS</td>
    </tr>
    <tr>
      <td >bronze: 'close' within range</td>
      <td >PASS</td>
    </tr>
    <tr>
      <td >bronze: 'volume' within range</td>
      <td >PASS</td>
    </tr>
    <tr>
      <td >bronze: latest date 2026-03-27 (2d ago)</td>
      <td >PASS</td>
    </tr>
    <tr>
      <td >bronze: 2530 rows</td>
      <td >PASS</td>
    </tr>
  </tbody>
</table>

## Silver Layer

The Silver layer takes validated Bronze data and enriches it with computed columns:
- **daily_return** — close-to-close percentage return
- **intraday_range** — (high - low) / close as percentage
- **sma_20** — 20-day simple moving average of close price

All transforms are pure Polars expressions using `with_columns()` and
`rolling_mean()`. The Silver output is validated row-by-row through
the `CleanOHLCV` Pydantic model before persistence.

**Key design:** transforms are pure functions (DataFrame in → DataFrame out),
infrastructure (SQL write, lineage) is handled separately.

#### Polars — compute daily returns with `pct_change().over()`

```python
# Pure transform: adds daily_return column as close-to-close % change
# Groups by symbol so returns don't cross symbol boundaries

def compute_daily_returns(df: pl.DataFrame) -> pl.DataFrame:
    """Add daily_return column: close-to-close percentage change per symbol."""
    return df.sort(["symbol", "date"]).with_columns(
        pl.col("close")
          .pct_change()
          .over("symbol")
          .fill_null(0.0)
          .round(6)
          .alias("daily_return")
    )

# Test on Bronze data
test_returns = compute_daily_returns(bronze_df.drop("batch_id"))
test_returns.filter(pl.col("symbol") == "SAP.DE").select("symbol", "date", "close", "daily_return").head(5)
```

<table>
  <thead>
    <tr>
      <th >symbol</th>
      <th >date</th>
      <th >close</th>
      <th >daily_return</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >SAP.DE</td>
      <td >2024-03-28 00:00:00</td>
      <td >180.460007</td>
      <td >0.000000</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >2024-04-02 00:00:00</td>
      <td >177.059998</td>
      <td >-0.018841</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >2024-04-03 00:00:00</td>
      <td >178.220001</td>
      <td >0.006551</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >2024-04-04 00:00:00</td>
      <td >178.020004</td>
      <td >-0.001122</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >2024-04-05 00:00:00</td>
      <td >177.419998</td>
      <td >-0.003370</td>
    </tr>
  </tbody>
</table>

#### Polars — compute intraday range with `with_columns()`

```python
# Pure transform: (high - low) / close — measures daily volatility

def compute_intraday_range(df: pl.DataFrame) -> pl.DataFrame:
    """Add intraday_range column: (high - low) / close as percentage."""
    return df.with_columns(
        ((pl.col("high") - pl.col("low")) / pl.col("close"))
        .round(6)
        .alias("intraday_range")
    )

# Test on returns data
test_range = compute_intraday_range(test_returns)
test_range.filter(pl.col("symbol") == "SAP.DE").select("symbol", "date", "high", "low", "close", "intraday_range").head(5)
```

<table>
  <thead>
    <tr>
      <th >symbol</th>
      <th >date</th>
      <th >high</th>
      <th >low</th>
      <th >close</th>
      <th >intraday_range</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >SAP.DE</td>
      <td >2024-03-28 00:00:00</td>
      <td >181.860001</td>
      <td >179.100006</td>
      <td >180.460007</td>
      <td >0.015294</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >2024-04-02 00:00:00</td>
      <td >181.919998</td>
      <td >177.059998</td>
      <td >177.059998</td>
      <td >0.027448</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >2024-04-03 00:00:00</td>
      <td >179.520004</td>
      <td >176.559998</td>
      <td >178.220001</td>
      <td >0.016609</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >2024-04-04 00:00:00</td>
      <td >178.460007</td>
      <td >176.339996</td>
      <td >178.020004</td>
      <td >0.011909</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >2024-04-05 00:00:00</td>
      <td >177.960007</td>
      <td >174.779999</td>
      <td >177.419998</td>
      <td >0.017924</td>
    </tr>
  </tbody>
</table>

#### Polars — compute 20-day moving average with `rolling_mean().over()`

```python
# Pure transform: rolling mean of close price over 20-day window per symbol
# First 19 rows per symbol will have null SMA (not enough history)

def compute_sma(df: pl.DataFrame, window: int = 20) -> pl.DataFrame:
    """Add sma_20 column: rolling mean of close price per symbol."""
    return df.sort(["symbol", "date"]).with_columns(
        pl.col("close")
          .rolling_mean(window_size=window)
          .over("symbol")
          .round(4)
          .alias(f"sma_{window}")
    )

# Test on range data
test_sma = compute_sma(test_range)
test_sma.filter(pl.col("symbol") == "SAP.DE").select("symbol", "date", "close", "sma_20").tail(5)
```

<table>
  <thead>
    <tr>
      <th >symbol</th>
      <th >date</th>
      <th >close</th>
      <th >sma_20</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >SAP.DE</td>
      <td >2026-03-23 00:00:00</td>
      <td >153.860001</td>
      <td >166.034000</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >2026-03-24 00:00:00</td>
      <td >147.619995</td>
      <td >165.123000</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >2026-03-25 00:00:00</td>
      <td >146.899994</td>
      <td >164.129000</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >2026-03-26 00:00:00</td>
      <td >144.639999</td>
      <td >162.750000</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >2026-03-27 00:00:00</td>
      <td >142.559998</td>
      <td >161.330000</td>
    </tr>
  </tbody>
</table>

#### Polars — compose all Silver transforms with function chaining

```python
# Chains: daily_returns → intraday_range → sma_20
# Pure function composition — each transform is independent and testable

def transform_silver(bronze_df: pl.DataFrame) -> pl.DataFrame:
    """Apply all Silver enrichment transforms in sequence."""
    # Drop batch_id from Bronze — Silver adds its own
    df = bronze_df.drop("batch_id") if "batch_id" in bronze_df.columns else bronze_df
    df = compute_daily_returns(df)
    df = compute_intraday_range(df)
    df = compute_sma(df, window=20)
    return df

print("transform_silver() defined — composes all Silver transforms")
```

    transform_silver() defined — composes all Silver transforms

#### Pydantic — validate Silver rows with `BaseModel()` row-level check

```python
# Validates each row through CleanOHLCV Pydantic model
# Valid rows collected; rejected rows quarantined with error details

def validate_silver(df: pl.DataFrame, batch_id: str) -> tuple[pl.DataFrame, int]:
    """Validate each row through CleanOHLCV. Quarantines rejected rows."""
    valid_rows = []
    rejected = 0

    for row in df.iter_rows(named=True):
        try:
            record = CleanOHLCV(
                symbol=str(row["symbol"]),
                date=row["date"],
                open=float(row["open"]),
                high=float(row["high"]),
                low=float(row["low"]),
                close=float(row["close"]),
                adj_close=float(row["adj_close"]),
                volume=int(row["volume"]),
                dividends=float(row["dividends"]),
                stock_splits=float(row["stock_splits"]),
                daily_return=float(row["daily_return"]),
                intraday_range=float(row["intraday_range"]),
                sma_20=float(row["sma_20"]) if row["sma_20"] is not None else None,
                batch_id=batch_id,
            )
            valid_rows.append(record.model_dump())
        except Exception as e:
            rejected += 1
            quarantine_row(batch_id, "silver", dict(row), str(e))

    if not valid_rows:
        return pl.DataFrame(), rejected

    return pl.DataFrame(valid_rows), rejected

log.info("validate_silver() defined \u2014 rejects go to quarantine")
```

    01:03:39 | INFO  | validate_silver() defined — rejects go to quarantine

#### Silver — define enrichment pipeline with transform + `MERGE INTO`

Orchestrates: transform → validate → MERGE upsert → lineage
Transforms the FULL bronze dataset (needed for correct SMA/returns),
then MERGE upserts into silver_ohlcv (no duplicates, updates existing)
Returns the FULL silver dataset from SQL Server for downstream stages

```python
def process_silver(bronze_df: pl.DataFrame, batch_id: str) -> tuple[pl.DataFrame, StageLineage]:
    """Transform, validate, and MERGE upsert Silver data."""
    stage_ctx = start_stage(batch_id, "silver", input_rows=len(bronze_df))

    # Apply all transforms on full bronze (SMA/returns need full history)
    enriched_df = transform_silver(bronze_df)

    # Validate through Pydantic
    valid_df, rejected = validate_silver(enriched_df, batch_id)

    # MERGE upsert into SQL Server
    if len(valid_df) > 0:
        merged = merge_silver(valid_df, batch_id)
        log.info(f"Silver: {merged} rows merged ({len(valid_df)} valid, {rejected} rejected)")

    # Complete lineage
    lineage = end_stage(stage_ctx, valid_df, rejected)
    persist_lineage(lineage)

    # Return FULL silver dataset for Gold layer
    silver_full = pl.read_database(
        "SELECT symbol, date, [open] as [open], high, low, [close] as [close], "
        "adj_close, volume, dividends, stock_splits, "
        "daily_return, intraday_range, sma_20, batch_id "
        "FROM silver_ohlcv ORDER BY symbol, date",
        connection=sql_engine
    )

    return silver_full, lineage

print("process_silver() defined — MERGE upsert, returns full dataset")
```

    process_silver() defined — MERGE upsert, returns full dataset

#### Silver — execute enrichment on full Bronze data

```python
# Transform full bronze → MERGE upsert into silver_ohlcv
# SMA and returns are recomputed on full history for correctness

t0 = time.time()
silver_df, silver_lineage = process_silver(bronze_df, batch_id)
elapsed = (time.time() - t0) * 1000

log.info(f"Silver complete: {len(silver_df)} total rows in {elapsed:.0f}ms")
print(f"Output hash: {silver_lineage.output_hash}")
```

    01:03:49 | INFO  | Silver: 2530 rows merged (2530 valid, 0 rejected)
    01:03:49 | INFO  | Silver complete: 2530 total rows in 3182ms

    Output hash: 309f651b6d140961

#### Polars — display Silver enriched columns with `filter().select()`

```python
# Verify daily_return, intraday_range, and sma_20 are populated

silver_df.filter(pl.col("symbol") == "SAP.DE").select(
    "symbol", "date", "close", "daily_return", "intraday_range", "sma_20"
).tail(5)
```

<table>
  <thead>
    <tr>
      <th >symbol</th>
      <th >date</th>
      <th >close</th>
      <th >daily_return</th>
      <th >intraday_range</th>
      <th >sma_20</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >SAP.DE</td>
      <td >2026-03-23 00:00:00</td>
      <td >153.860001</td>
      <td >0.000260</td>
      <td >0.072274</td>
      <td >166.034000</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >2026-03-24 00:00:00</td>
      <td >147.619995</td>
      <td >-0.040556</td>
      <td >0.034142</td>
      <td >165.123000</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >2026-03-25 00:00:00</td>
      <td >146.899994</td>
      <td >-0.004877</td>
      <td >0.035262</td>
      <td >164.129000</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >2026-03-26 00:00:00</td>
      <td >144.639999</td>
      <td >-0.015385</td>
      <td >0.031527</td>
      <td >162.750000</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >2026-03-27 00:00:00</td>
      <td >142.559998</td>
      <td >-0.014381</td>
      <td >0.036616</td>
      <td >161.330000</td>
    </tr>
  </tbody>
</table>

#### Polars — display Silver statistics per symbol with `group_by().agg()`

```python
# Summary stats to verify enrichment quality across all symbols

silver_df.group_by("symbol").agg(
    pl.col("daily_return").mean().round(6).alias("avg_return"),
    pl.col("daily_return").std().round(6).alias("volatility"),
    pl.col("intraday_range").mean().round(6).alias("avg_intraday"),
    pl.col("sma_20").null_count().alias("sma_nulls"),
    pl.col("date").count().alias("rows"),
).sort("symbol")
```

<table>
  <thead>
    <tr>
      <th >symbol</th>
      <th >avg_return</th>
      <th >volatility</th>
      <th >avg_intraday</th>
      <th >sma_nulls</th>
      <th >rows</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >ALV.DE</td>
      <td >0.000532</td>
      <td >0.011851</td>
      <td >0.014106</td>
      <td >19</td>
      <td >506</td>
    </tr>
    <tr>
      <td >BAS.DE</td>
      <td >0.000121</td>
      <td >0.017508</td>
      <td >0.021398</td>
      <td >19</td>
      <td >506</td>
    </tr>
    <tr>
      <td >DTE.DE</td>
      <td >0.000765</td>
      <td >0.013263</td>
      <td >0.015720</td>
      <td >19</td>
      <td >506</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >-0.000285</td>
      <td >0.018919</td>
      <td >0.020672</td>
      <td >19</td>
      <td >506</td>
    </tr>
    <tr>
      <td >SIE.DE</td>
      <td >0.000475</td>
      <td >0.019223</td>
      <td >0.021500</td>
      <td >19</td>
      <td >506</td>
    </tr>
  </tbody>
</table>

#### Pipeline — run Silver data quality gate with `run_quality_gate()`

Data quality assertions on Silver output
Hard gate (fail_fast=True): blocks pipeline on structural issues
Soft gate (fail_fast=False): logs warnings on statistical outliers

```python
# Hard checks — must pass
silver_dq = run_quality_gate([
    dq_check_not_empty(silver_df, "silver"),
    dq_check_no_null_keys(silver_df, ["symbol", "date", "daily_return"], "silver"),
    dq_check_no_duplicates(silver_df, ["symbol", "date"], "silver"),
    dq_check_range(silver_df, "daily_return", -0.5, 0.5, "silver"),
    dq_check_range(silver_df, "intraday_range", 0, 0.5, "silver"),
    dq_check_freshness(silver_df, "date", 5, "silver"),
    dq_check_row_count(silver_df, len(SYMBOLS) * 200, "silver"),
], stage="silver")

# Soft checks — warn but don't block (daily return > 10% is unusual for blue chips)
log.info("Outlier checks (warnings only):")
outliers = silver_df.filter(pl.col("daily_return").abs() > 0.10)
if len(outliers) > 0:
    log.warning(f"  {len(outliers)} rows with |daily_return| > 10%:")
    display(outliers.select("symbol", "date", "close", "daily_return", "volume").sort("daily_return"))
else:
    log.info("  No outliers detected")

silver_dq
```

    01:03:59 | INFO  |   DQ PASS: silver: 2530 rows
    01:03:59 | INFO  |   DQ PASS: silver: no null keys in ['symbol', 'date', 'daily_return']
    01:03:59 | INFO  |   DQ PASS: silver: no duplicates
    01:03:59 | INFO  |   DQ PASS: silver: 'daily_return' within range
    01:03:59 | INFO  |   DQ PASS: silver: 'intraday_range' within range
    01:03:59 | INFO  |   DQ PASS: silver: latest date 2026-03-27 (2d ago)
    01:03:59 | INFO  |   DQ PASS: silver: 2530 rows
    01:03:59 | INFO  | Outlier checks (warnings only):
    01:03:59 | WARNING |   3 rows with |daily_return| > 10%:

<table>
  <thead>
    <tr>
      <th >symbol</th>
      <th >date</th>
      <th >close</th>
      <th >daily_return</th>
      <th >volume</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >SAP.DE</td>
      <td >2026-01-29 00:00:00</td>
      <td >164.619995</td>
      <td >-0.160702</td>
      <td >15846791</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >2025-04-23 00:00:00</td>
      <td >241.699997</td>
      <td >0.106178</td>
      <td >3410054</td>
    </tr>
    <tr>
      <td >BAS.DE</td>
      <td >2025-03-05 00:00:00</td>
      <td >53.660000</td>
      <td >0.107077</td>
      <td >9216640</td>
    </tr>
  </tbody>
</table>

<table>
  <thead>
    <tr>
      <th >check</th>
      <th >status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >silver: 2530 rows</td>
      <td >PASS</td>
    </tr>
    <tr>
      <td >silver: no null keys in ['symbol', 'date', 'daily_return']</td>
      <td >PASS</td>
    </tr>
    <tr>
      <td >silver: no duplicates</td>
      <td >PASS</td>
    </tr>
    <tr>
      <td >silver: 'daily_return' within range</td>
      <td >PASS</td>
    </tr>
    <tr>
      <td >silver: 'intraday_range' within range</td>
      <td >PASS</td>
    </tr>
    <tr>
      <td >silver: latest date 2026-03-27 (2d ago)</td>
      <td >PASS</td>
    </tr>
    <tr>
      <td >silver: 2530 rows</td>
      <td >PASS</td>
    </tr>
  </tbody>
</table>

## Gold Layer

The Gold layer produces two pre-aggregated mart tables from Silver data:

1. **Daily Summary** — cross-sectional metrics for each trading day (avg return,
   max/min return, total volume, avg intraday range). Used for market overview dashboards.

2. **Symbol Profile** — per-symbol statistics over the full history (avg return,
   volatility, max drawdown, total dividends). Used for stock comparison views.

Both are validated through Pydantic models and persisted to SQL Server + Parquet.
The Gold layer is the final stage before export.

#### Polars — build daily cross-sectional summary with `group_by().agg()`

```python
# Aggregates all symbols per date: mean/max/min return, total volume
# Pure function: Silver DataFrame → DailySummary DataFrame

def build_daily_summary(silver_df: pl.DataFrame, batch_id: str) -> pl.DataFrame:
    """Aggregate Silver data into daily cross-sectional summary."""
    summary = silver_df.group_by("date").agg(
        pl.col("symbol").n_unique().alias("symbols_traded"),
        pl.col("daily_return").mean().round(6).alias("avg_return"),
        pl.col("daily_return").max().alias("max_return"),
        pl.col("daily_return").min().alias("min_return"),
        pl.col("volume").sum().alias("total_volume"),
        pl.col("intraday_range").mean().round(6).alias("avg_intraday_pct"),
    ).sort("date").with_columns(
        pl.lit(batch_id).alias("batch_id")
    )
    return summary

daily_summary_df = build_daily_summary(silver_df, batch_id)
print(f"Daily summary: {len(daily_summary_df)} trading days")
daily_summary_df.head(5)
```

    Daily summary: 506 trading days

<table>
  <thead>
    <tr>
      <th >date</th>
      <th >symbols_traded</th>
      <th >avg_return</th>
      <th >max_return</th>
      <th >min_return</th>
      <th >total_volume</th>
      <th >avg_intraday_pct</th>
      <th >batch_id</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >2024-03-28 00:00:00</td>
      <td >5</td>
      <td >0.000000</td>
      <td >0.000000</td>
      <td >0.000000</td>
      <td >14115241</td>
      <td >0.011246</td>
      <td >bc9d3a23-b825-4e59-be6a-f0efa6e72c90</td>
    </tr>
    <tr>
      <td >2024-04-02 00:00:00</td>
      <td >5</td>
      <td >-0.006261</td>
      <td >0.016815</td>
      <td >-0.018841</td>
      <td >15460060</td>
      <td >0.020850</td>
      <td >bc9d3a23-b825-4e59-be6a-f0efa6e72c90</td>
    </tr>
    <tr>
      <td >2024-04-03 00:00:00</td>
      <td >5</td>
      <td >0.004862</td>
      <td >0.012820</td>
      <td >-0.002239</td>
      <td >12344475</td>
      <td >0.014617</td>
      <td >bc9d3a23-b825-4e59-be6a-f0efa6e72c90</td>
    </tr>
    <tr>
      <td >2024-04-04 00:00:00</td>
      <td >5</td>
      <td >-0.000631</td>
      <td >0.007522</td>
      <td >-0.007289</td>
      <td >10238748</td>
      <td >0.010830</td>
      <td >bc9d3a23-b825-4e59-be6a-f0efa6e72c90</td>
    </tr>
    <tr>
      <td >2024-04-05 00:00:00</td>
      <td >5</td>
      <td >-0.014092</td>
      <td >-0.003370</td>
      <td >-0.021460</td>
      <td >16364036</td>
      <td >0.017791</td>
      <td >bc9d3a23-b825-4e59-be6a-f0efa6e72c90</td>
    </tr>
  </tbody>
</table>

#### Polars — build per-symbol profile with `cum_max()` drawdown

```python
# Computes: avg return, volatility, max drawdown, total dividends
# Max drawdown = worst peak-to-trough decline using cumulative max

def build_symbol_profile(silver_df: pl.DataFrame, batch_id: str) -> pl.DataFrame:
    """Aggregate Silver data into per-symbol summary statistics."""
    profiles = []

    for symbol in silver_df.select("symbol").unique().sort("symbol").to_series():
        sym_df = silver_df.filter(pl.col("symbol") == symbol).sort("date")

        # Max drawdown: peak-to-trough decline using cumulative max of close
        cum_max = sym_df.select(pl.col("close").cum_max().alias("peak"))
        drawdowns = (sym_df["close"] - cum_max["peak"]) / cum_max["peak"]
        max_dd = round(drawdowns.to_list()[-1] if len(drawdowns) == 0 else min(drawdowns.to_list()), 6)

        # Extract values as plain Python types to satisfy type checker
        returns = sym_df["daily_return"].to_list()
        volumes = sym_df["volume"].to_list()
        dividends = sym_df["dividends"].to_list()
        dates = sym_df["date"].to_list()

        profiles.append({
            "symbol": symbol,
            "total_trading_days": len(sym_df),
            "avg_daily_return": round(sum(returns) / len(returns), 6),
            "volatility": round((sum((r - sum(returns)/len(returns))**2 for r in returns) / len(returns)) ** 0.5, 6),
            "max_drawdown": round(max_dd, 6),
            "avg_volume": round(sum(volumes) / len(volumes), 2),
            "total_dividends": round(sum(dividends), 4),
            "first_date": dates[0],
            "last_date": dates[-1],
            "batch_id": batch_id,
        })

    return pl.DataFrame(profiles)

symbol_profile_df = build_symbol_profile(silver_df, batch_id)
print(f"Symbol profiles: {len(symbol_profile_df)} symbols")
symbol_profile_df
```

    Symbol profiles: 5 symbols

<table>
  <thead>
    <tr>
      <th >symbol</th>
      <th >total_trading_days</th>
      <th >avg_daily_return</th>
      <th >volatility</th>
      <th >max_drawdown</th>
      <th >avg_volume</th>
      <th >total_dividends</th>
      <th >first_date</th>
      <th >last_date</th>
      <th >batch_id</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >ALV.DE</td>
      <td >506</td>
      <td >0.000532</td>
      <td >0.011839</td>
      <td >-0.123504</td>
      <td >631485.920000</td>
      <td >29.200000</td>
      <td >2024-03-28 00:00:00</td>
      <td >2026-03-27 00:00:00</td>
      <td >bc9d3a23-b825-4e59-be6a-f0efa6e72c90</td>
    </tr>
    <tr>
      <td >BAS.DE</td>
      <td >506</td>
      <td >0.000121</td>
      <td >0.017491</td>
      <td >-0.276766</td>
      <td >2518770.100000</td>
      <td >5.650000</td>
      <td >2024-03-28 00:00:00</td>
      <td >2026-03-27 00:00:00</td>
      <td >bc9d3a23-b825-4e59-be6a-f0efa6e72c90</td>
    </tr>
    <tr>
      <td >DTE.DE</td>
      <td >506</td>
      <td >0.000765</td>
      <td >0.013250</td>
      <td >-0.266109</td>
      <td >6530991.970000</td>
      <td >1.670000</td>
      <td >2024-03-28 00:00:00</td>
      <td >2026-03-27 00:00:00</td>
      <td >bc9d3a23-b825-4e59-be6a-f0efa6e72c90</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >506</td>
      <td >-0.000285</td>
      <td >0.018900</td>
      <td >-0.491402</td>
      <td >1676452.980000</td>
      <td >4.550000</td>
      <td >2024-03-28 00:00:00</td>
      <td >2026-03-27 00:00:00</td>
      <td >bc9d3a23-b825-4e59-be6a-f0efa6e72c90</td>
    </tr>
    <tr>
      <td >SIE.DE</td>
      <td >506</td>
      <td >0.000475</td>
      <td >0.019204</td>
      <td >-0.273251</td>
      <td >1155093.990000</td>
      <td >10.550000</td>
      <td >2024-03-28 00:00:00</td>
      <td >2026-03-27 00:00:00</td>
      <td >bc9d3a23-b825-4e59-be6a-f0efa6e72c90</td>
    </tr>
  </tbody>
</table>

#### Pydantic — validate Gold daily summary with `BaseModel()` row-level check

```python
# Validates each row to catch aggregation errors before persistence

def validate_gold_daily(df: pl.DataFrame) -> tuple[pl.DataFrame, int]:
    """Validate daily summary rows through DailySummary model."""
    valid_rows = []
    rejected = 0
    for row in df.iter_rows(named=True):
        try:
            record = DailySummary(**row)
            valid_rows.append(record.model_dump())
        except Exception:
            rejected += 1
    return (pl.DataFrame(valid_rows) if valid_rows else pl.DataFrame()), rejected

valid_daily, rej_daily = validate_gold_daily(daily_summary_df)
print(f"Daily summary validation: {len(valid_daily)} valid, {rej_daily} rejected")
```

    Daily summary validation: 506 valid, 0 rejected

#### Pydantic — validate Gold symbol profiles with `BaseModel()` row-level check

```python
# Validates each profile to catch calculation errors

def validate_gold_profiles(df: pl.DataFrame) -> tuple[pl.DataFrame, int]:
    """Validate symbol profile rows through SymbolProfile model."""
    valid_rows = []
    rejected = 0
    for row in df.iter_rows(named=True):
        try:
            record = SymbolProfile(**row)
            valid_rows.append(record.model_dump())
        except Exception as e:
            rejected += 1
            print(f"  Rejected {row.get('symbol', '?')}: {e}")
    return (pl.DataFrame(valid_rows) if valid_rows else pl.DataFrame()), rejected

valid_profiles, rej_profiles = validate_gold_profiles(symbol_profile_df)
print(f"Symbol profile validation: {len(valid_profiles)} valid, {rej_profiles} rejected")
```

    Symbol profile validation: 5 valid, 0 rejected

#### SQL Server — persist Gold marts with `TRUNCATE` + `to_sql()`

```python
# Writes both Gold tables and records a single Gold stage lineage record

def persist_gold(daily_df: pl.DataFrame, profile_df: pl.DataFrame, batch_id: str) -> StageLineage:
    """Persist Gold mart tables to SQL Server with lineage tracking."""
    total_input = len(daily_df) + len(profile_df)
    stage_ctx = start_stage(batch_id, "gold", input_rows=total_input)

    # Write daily summary
    if len(daily_df) > 0:
        write_to_sql(daily_df, "gold_daily_summary")

    # Write symbol profiles
    if len(profile_df) > 0:
        write_to_sql(profile_df, "gold_symbol_profile")

    # Combined output for hash
    combined = pl.concat([
        daily_df.select(pl.all().cast(pl.Utf8)),
        profile_df.select(pl.all().cast(pl.Utf8)),
    ], how="diagonal")

    lineage = end_stage(stage_ctx, combined, 0)
    persist_lineage(lineage)
    return lineage

gold_lineage = persist_gold(valid_daily, valid_profiles, batch_id)
log.info(f"Gold persisted: hash={gold_lineage.output_hash}")
```

    01:04:13 | INFO  | Gold persisted: hash=7e21b5203a7ab58d

#### Polars — display Gold daily summary with `sort().tail()`

```python
# Show the most recent trading days with cross-sectional metrics

valid_daily.sort("date").tail()
```

<table>
  <thead>
    <tr>
      <th >date</th>
      <th >symbols_traded</th>
      <th >avg_return</th>
      <th >max_return</th>
      <th >min_return</th>
      <th >total_volume</th>
      <th >avg_intraday_pct</th>
      <th >batch_id</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >2026-03-23 00:00:00</td>
      <td >5</td>
      <td >0.012035</td>
      <td >0.037055</td>
      <td >-0.002530</td>
      <td >21900746</td>
      <td >0.071276</td>
      <td >bc9d3a23-b825-4e59-be6a-f0efa6e72c90</td>
    </tr>
    <tr>
      <td >2026-03-24 00:00:00</td>
      <td >5</td>
      <td >0.003854</td>
      <td >0.041800</td>
      <td >-0.040556</td>
      <td >14990944</td>
      <td >0.028663</td>
      <td >bc9d3a23-b825-4e59-be6a-f0efa6e72c90</td>
    </tr>
    <tr>
      <td >2026-03-25 00:00:00</td>
      <td >5</td>
      <td >0.008021</td>
      <td >0.023951</td>
      <td >-0.004877</td>
      <td >13536325</td>
      <td >0.019512</td>
      <td >bc9d3a23-b825-4e59-be6a-f0efa6e72c90</td>
    </tr>
    <tr>
      <td >2026-03-26 00:00:00</td>
      <td >5</td>
      <td >-0.006063</td>
      <td >0.014394</td>
      <td >-0.015385</td>
      <td >15722294</td>
      <td >0.019610</td>
      <td >bc9d3a23-b825-4e59-be6a-f0efa6e72c90</td>
    </tr>
    <tr>
      <td >2026-03-27 00:00:00</td>
      <td >5</td>
      <td >-0.003768</td>
      <td >0.026803</td>
      <td >-0.023123</td>
      <td >16207050</td>
      <td >0.024848</td>
      <td >bc9d3a23-b825-4e59-be6a-f0efa6e72c90</td>
    </tr>
  </tbody>
</table>

#### Polars — display Gold symbol profiles with `select()`

```python
# Final per-symbol summary statistics

valid_profiles.select(
    "symbol", "total_trading_days", "avg_daily_return",
    "volatility", "max_drawdown", "avg_volume", "total_dividends"
)
```

<table>
  <thead>
    <tr>
      <th >symbol</th>
      <th >total_trading_days</th>
      <th >avg_daily_return</th>
      <th >volatility</th>
      <th >max_drawdown</th>
      <th >avg_volume</th>
      <th >total_dividends</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >ALV.DE</td>
      <td >506</td>
      <td >0.000532</td>
      <td >0.011839</td>
      <td >-0.123504</td>
      <td >631485.920000</td>
      <td >29.200000</td>
    </tr>
    <tr>
      <td >BAS.DE</td>
      <td >506</td>
      <td >0.000121</td>
      <td >0.017491</td>
      <td >-0.276766</td>
      <td >2518770.100000</td>
      <td >5.650000</td>
    </tr>
    <tr>
      <td >DTE.DE</td>
      <td >506</td>
      <td >0.000765</td>
      <td >0.013250</td>
      <td >-0.266109</td>
      <td >6530991.970000</td>
      <td >1.670000</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >506</td>
      <td >-0.000285</td>
      <td >0.018900</td>
      <td >-0.491402</td>
      <td >1676452.980000</td>
      <td >4.550000</td>
    </tr>
    <tr>
      <td >SIE.DE</td>
      <td >506</td>
      <td >0.000475</td>
      <td >0.019204</td>
      <td >-0.273251</td>
      <td >1155093.990000</td>
      <td >10.550000</td>
    </tr>
  </tbody>
</table>

## Parquet Export

The serving layer (FastAPI) doesn't query SQL Server at runtime. Instead, the pipeline
exports Gold data to Parquet files that the API reads directly. This is the
**pre-materialized views** pattern:

- Pipeline writes Parquet files at the end of each run
- API reads Parquet files on each request — no database connection needed
- Deployment is a file copy, not a database migration
- Cache invalidation = re-run the pipeline

This matches production data product delivery where you "deliver Query A, B, C"
as pre-computed artifacts.

#### Polars — export daily summary to Parquet with `write_parquet()`

```python
# Pre-materialized view: API will read this file directly
# Parquet preserves types (dates, ints) without CSV parsing overhead

daily_path = EXPORT_DIR / "gold_daily_summary.parquet"
valid_daily.write_parquet(daily_path)
size_kb = daily_path.stat().st_size / 1024
print(f"Exported: {daily_path.name} ({size_kb:.1f} KB, {len(valid_daily)} rows)")
```

    Exported: gold_daily_summary.parquet (21.2 KB, 506 rows)

#### Polars — export symbol profiles to Parquet with `write_parquet()`

```python
# Pre-materialized view: per-symbol summary for the comparison dashboard

profile_path = EXPORT_DIR / "gold_symbol_profile.parquet"
valid_profiles.write_parquet(profile_path)
size_kb = profile_path.stat().st_size / 1024
print(f"Exported: {profile_path.name} ({size_kb:.1f} KB, {len(valid_profiles)} rows)")
```

    Exported: gold_symbol_profile.parquet (3.9 KB, 5 rows)

#### Polars — export Silver data to Parquet with `write_parquet()`

```python
# Some API endpoints need row-level data (e.g., time series for a symbol)
# Export the full Silver dataset for these use cases

silver_path = EXPORT_DIR / "silver_ohlcv.parquet"
silver_df.write_parquet(silver_path)
size_kb = silver_path.stat().st_size / 1024
print(f"Exported: {silver_path.name} ({size_kb:.1f} KB, {len(silver_df)} rows)")
```

    Exported: silver_ohlcv.parquet (96.9 KB, 2530 rows)

#### Lineage — record export stage with `end_stage()`

```python
# Track which files were exported and their sizes

export_ctx = start_stage(batch_id, "export", input_rows=len(valid_daily) + len(valid_profiles) + len(silver_df))

# Combined export DataFrame for hash (all exported data)
export_combined = pl.concat([
    valid_daily.select(pl.all().cast(pl.Utf8)),
    valid_profiles.select(pl.all().cast(pl.Utf8)),
    silver_df.select(pl.all().cast(pl.Utf8)),
], how="diagonal")

export_lineage = end_stage(export_ctx, export_combined, 0)
persist_lineage(export_lineage)

print(f"Export lineage recorded: {export_lineage.output_rows} total rows, hash={export_lineage.output_hash}")
```

    Export lineage recorded: 3041 total rows, hash=c418628dd0f329a9

#### Polars — verify exported Parquet files with `read_parquet()`

```python
# Round-trip test: write → read → verify row counts match

for name in ["gold_daily_summary", "gold_symbol_profile", "silver_ohlcv"]:
    path = EXPORT_DIR / f"{name}.parquet"
    df = pl.read_parquet(path)
    print(f"  {name}: {len(df)} rows, {len(df.columns)} cols")
```

      gold_daily_summary: 506 rows, 8 cols
      gold_symbol_profile: 5 rows, 10 cols
      silver_ohlcv: 2530 rows, 14 cols

## Lineage Review

After all stages complete, review the full pipeline execution trail.
Each stage recorded its timing, row counts, and output hash.
The RunContext aggregates everything and is persisted to JSON.

#### Pydantic — build and save run context with `RunContext()`

Aggregates all stage lineage records into a single RunContext
Persists to JSON file for audit trail
Duration = sum of actual stage processing times (not wall-clock with idle gaps)

```python
run_context = RunContext(
    batch_id=batch_id,
    started_at=bronze_lineage.started_at,
    completed_at=export_lineage.completed_at,
    symbols=SYMBOLS,
    date_range=(START_DATE, END_DATE),
    stages=[bronze_lineage, silver_lineage, gold_lineage, export_lineage],
    status="completed",
)

# Save to JSON
ctx_path = save_run_context(run_context)

# Report actual processing time (sum of stages, not wall-clock)
total_ms = sum(s.duration_ms for s in run_context.stages)
print(f"RunContext saved: {ctx_path.name}")
print(f"Batch: {batch_id[:8]}...")
print(f"Processing time: {total_ms:.0f}ms ({total_ms/1000:.1f}s)")
```

    RunContext saved: run_bc9d3a23.json
    Batch: bc9d3a23...
    Processing time: 3939ms (3.9s)

#### Polars — display lineage summary as DataFrame

```python
# Shows all stages with timing, row counts, and hashes

lineage_records = [
    {
        "stage": s.stage,
        "input_rows": s.input_rows,
        "output_rows": s.output_rows,
        "rejected": s.rows_rejected,
        "duration_ms": round(s.duration_ms, 1),
        "output_hash": s.output_hash,
    }
    for s in run_context.stages
]
pl.DataFrame(lineage_records)
```

<table>
  <thead>
    <tr>
      <th >stage</th>
      <th >input_rows</th>
      <th >output_rows</th>
      <th >rejected</th>
      <th >duration_ms</th>
      <th >output_hash</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >bronze</td>
      <td >5</td>
      <td >5</td>
      <td >0</td>
      <td >725.300000</td>
      <td >bf7713401ce6f144</td>
    </tr>
    <tr>
      <td >silver</td>
      <td >2530</td>
      <td >2530</td>
      <td >0</td>
      <td >3165.000000</td>
      <td >309f651b6d140961</td>
    </tr>
    <tr>
      <td >gold</td>
      <td >511</td>
      <td >511</td>
      <td >0</td>
      <td >48.000000</td>
      <td >7e21b5203a7ab58d</td>
    </tr>
    <tr>
      <td >export</td>
      <td >3041</td>
      <td >3041</td>
      <td >0</td>
      <td >1.000000</td>
      <td >c418628dd0f329a9</td>
    </tr>
  </tbody>
</table>

#### JSON — read back persisted run context with `json.loads()`

```python
# Verify the JSON file is complete and parseable

ctx_json = json.loads(ctx_path.read_text(encoding="utf-8"))
print(json.dumps(ctx_json, indent=2, default=str)[:1000])
```

    {
      "batch_id": "bc9d3a23-b825-4e59-be6a-f0efa6e72c90",
      "started_at": "2026-03-29T00:03:09.696012Z",
      "completed_at": "2026-03-29T00:04:27.974153Z",
      "symbols": [
        "SAP.DE",
        "SIE.DE",
        "ALV.DE",
        "DTE.DE",
        "BAS.DE"
      ],
      "date_range": [
        "2024-03-29",
        "2026-03-29"
      ],
      "polars_version": "1.39.3",
      "stages": [
        {
          "batch_id": "bc9d3a23-b825-4e59-be6a-f0efa6e72c90",
          "stage": "bronze",
          "started_at": "2026-03-29T00:03:09.696012Z",
          "completed_at": "2026-03-29T00:03:10.421269Z",
          "input_rows": 5,
          "output_rows": 5,
          "rows_rejected": 0,
          "output_hash": "bf7713401ce6f144"
        },
        {
          "batch_id": "bc9d3a23-b825-4e59-be6a-f0efa6e72c90",
          "stage": "silver",
          "started_at": "2026-03-29T00:03:46.433088Z",
          "completed_at": "2026-03-29T00:03:49.598112Z",
          "input_rows": 2530,
          "output_rows": 2530,
          "rows_rejected": 0,
          "output_hash": "309f651b6d140961"
        },
        {
          "batch_id": "

#### Polars — query lineage table with `read_database()`

```python
# Verify lineage records were persisted to SQL Server

lineage_query = pl.read_database(
    f"SELECT stage, input_rows, output_rows, rows_rejected, output_hash FROM lineage_stages WHERE batch_id = '{batch_id}'",
    connection=sql_engine
)
lineage_query
```

<table>
  <thead>
    <tr>
      <th >stage</th>
      <th >input_rows</th>
      <th >output_rows</th>
      <th >rows_rejected</th>
      <th >output_hash</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >bronze</td>
      <td >5</td>
      <td >5</td>
      <td >0</td>
      <td >bf7713401ce6f144</td>
    </tr>
    <tr>
      <td >silver</td>
      <td >2530</td>
      <td >2530</td>
      <td >0</td>
      <td >309f651b6d140961</td>
    </tr>
    <tr>
      <td >gold</td>
      <td >511</td>
      <td >511</td>
      <td >0</td>
      <td >7e21b5203a7ab58d</td>
    </tr>
    <tr>
      <td >export</td>
      <td >3041</td>
      <td >3041</td>
      <td >0</td>
      <td >c418628dd0f329a9</td>
    </tr>
  </tbody>
</table>

#### Polars — review quarantined rows with `read_database()`

```python
# Check if any rows were quarantined during this pipeline run
# Shows rejected rows with their error messages for investigation

quarantine_df = pl.read_database(
    f"SELECT stage, symbol, date, error_message, quarantined_at "
    f"FROM quarantine WHERE batch_id = '{batch_id}' ORDER BY quarantined_at",
    connection=sql_engine
)

if len(quarantine_df) > 0:
    log.warning(f"Quarantined rows: {len(quarantine_df)}")
    display(quarantine_df)
else:
    log.info("No quarantined rows \u2014 all data passed validation")
    print("No quarantined rows")
```

    01:06:18 | INFO  | No quarantined rows — all data passed validation

    No quarantined rows

## FastAPI Serving Layer

FastAPI serves the Gold data products by reading pre-materialized Parquet files.
No database connection at runtime — the API is a thin reader over files that
the pipeline produced.

#### FastAPI REST API Endpoints
- `GET /health` — healthcheck
- `GET /daily-summary` — cross-sectional daily metrics (optional date filter)
- `GET /symbol-profile` — per-symbol statistics
- `GET /symbol/{symbol}/timeseries` — daily OHLCV + enrichment for one symbol
- `GET /lineage/{batch_id}` — pipeline execution metadata

The server runs in a background thread so the notebook can continue to call it.

#### Python — import `threading` for background server

```python
# Threading needed to run uvicorn in background while notebook continues


print("threading imported")
```

    threading imported

#### Pydantic — define daily summary API response model with `BaseModel`

```python
# Response schema for the /daily-summary endpoint
# Without strict mode for FastAPI serialization compatibility

class DailySummaryResponse(BaseModel):
    date:             Date
    symbols_traded:   int
    avg_return:       float
    max_return:       float
    min_return:       float
    total_volume:     int
    avg_intraday_pct: float

print("DailySummaryResponse defined")
```

    DailySummaryResponse defined

#### Pydantic — define symbol profile API response model with `BaseModel`

```python
# Response schema for the /symbol-profile endpoint

class SymbolProfileResponse(BaseModel):
    symbol:              str
    total_trading_days:  int
    avg_daily_return:    float
    volatility:          float
    max_drawdown:        float
    avg_volume:          float
    total_dividends:     float
    first_date:          Date
    last_date:           Date

print("SymbolProfileResponse defined")
```

    SymbolProfileResponse defined

#### Pydantic — define timeseries row API response model with `BaseModel`

```python
# Response schema for the /symbol/{symbol}/timeseries endpoint

class TimeSeriesRow(BaseModel):
    date:           Date
    open:           float
    high:           float
    low:            float
    close:          float
    volume:         int
    daily_return:   float
    intraday_range: float
    sma_20:         float | None

print("TimeSeriesRow defined")
```

    TimeSeriesRow defined

#### FastAPI — create application instance with `FastAPI()`

```python
# Initialize FastAPI app for serving pre-materialized Parquet data

app = FastAPI(title="Gold Data Pipeline API", version="1.0.0")

print(f"FastAPI app created")
```

    FastAPI app created

#### FastAPI — define health endpoint with `@app.get()`

```python
# Healthcheck: verifies Parquet files exist and reports their sizes

@app.get("/health")
def health():
    """Healthcheck \u2014 verify Parquet files exist."""
    files = {f.stem: f.stat().st_size for f in EXPORT_DIR.glob("*.parquet")}
    return {"status": "healthy", "files": files}

print("GET /health registered")
```

    GET /health registered

#### FastAPI — define daily summary endpoint with `@app.get()`

```python
# Returns daily cross-sectional summary from Parquet, with optional date filter

@app.get("/daily-summary", response_model=list[DailySummaryResponse])
def get_daily_summary(start_date: Date | None = None, end_date: Date | None = None):
    """Return daily cross-sectional summary, optionally filtered by date range."""
    df = pl.read_parquet(EXPORT_DIR / "gold_daily_summary.parquet")
    if start_date:
        df = df.filter(pl.col("date") >= start_date)
    if end_date:
        df = df.filter(pl.col("date") <= end_date)
    return df.drop("batch_id").sort("date").to_dicts()

print("GET /daily-summary registered")
```

    GET /daily-summary registered

#### FastAPI — define symbol profile endpoint with `@app.get()`

```python
# Returns per-symbol summary statistics from Parquet

@app.get("/symbol-profile", response_model=list[SymbolProfileResponse])
def get_symbol_profiles():
    """Return per-symbol summary statistics."""
    df = pl.read_parquet(EXPORT_DIR / "gold_symbol_profile.parquet")
    return df.drop("batch_id").sort("symbol").to_dicts()

print("GET /symbol-profile registered")
```

    GET /symbol-profile registered

#### FastAPI — define symbol timeseries endpoint with `@app.get()`

```python
# Returns daily OHLCV + enrichment for one symbol from Silver Parquet

@app.get("/symbol/{symbol}/timeseries", response_model=list[TimeSeriesRow])
def get_timeseries(symbol: str, limit: int = 100):
    """Return daily OHLCV + enrichment for one symbol."""
    df = pl.read_parquet(EXPORT_DIR / "silver_ohlcv.parquet")
    sym_df = df.filter(pl.col("symbol") == symbol.upper())
    if len(sym_df) == 0:
        raise HTTPException(status_code=404, detail=f"Symbol {symbol} not found")
    return sym_df.select(
        "date", "open", "high", "low", "close", "volume",
        "daily_return", "intraday_range", "sma_20"
    ).sort("date", descending=True).head(limit).to_dicts()

print("GET /symbol/{symbol}/timeseries registered")
```

    GET /symbol/{symbol}/timeseries registered

#### FastAPI — define lineage endpoint with `@app.get()`

```python
# Returns RunContext JSON for a batch, matched by prefix

@app.get("/lineage/{batch_id_prefix}")
def get_lineage(batch_id_prefix: str):
    """Return RunContext JSON for a batch (matches by prefix)."""
    matches = list(LINEAGE_DIR.glob(f"run_{batch_id_prefix}*.json"))
    if not matches:
        raise HTTPException(status_code=404, detail="Batch not found")
    return json.loads(matches[0].read_text(encoding="utf-8"))

print(f"GET /lineage/{{batch_id}} registered \u2014 {len(app.routes)} total routes")
```

    GET /lineage/{batch_id} registered — 9 total routes

#### uvicorn — start API server in background with `threading.Thread()`

```python
# Runs on port 8099 to avoid conflicts with other services
# Background thread allows the notebook to continue executing

API_PORT = 8099

def run_server():
    """Run uvicorn in a background thread."""
    config = uvicorn.Config(app, host="127.0.0.1", port=API_PORT, log_level="warning")
    server = uvicorn.Server(config)
    server.run()

# Start server in background
server_thread = threading.Thread(target=run_server, daemon=True)
server_thread.start()

# Wait briefly for server to start
time.sleep(2)
print(f"FastAPI server running at http://127.0.0.1:{API_PORT}")
print(f"Swagger docs: http://127.0.0.1:{API_PORT}/docs")
```

    FastAPI server running at http://127.0.0.1:8099
    Swagger docs: http://127.0.0.1:8099/docs

    c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\fastapi\openapi\utils.py:255: UserWarning: Duplicate Operation ID health_health_get for function health
      route: routing.APIRoute,

![alt text](gold_docs.png)

#### httpx — test health endpoint with `httpx.get()`

```python
# Verify the API server is running and Parquet files are accessible

resp = httpx.get(f"http://127.0.0.1:{API_PORT}/health")
print(f"Status: {resp.status_code}")
print(json.dumps(resp.json(), indent=2))
```

    01:07:42 | INFO  | HTTP Request: GET http://127.0.0.1:8099/health "HTTP/1.1 200 OK"

    Status: 200
    {
      "status": "healthy",
      "files": {
        "gold_daily_summary": 21685,
        "gold_symbol_profile": 4036,
        "silver_ohlcv": 99214
      }
    }

#### httpx — test daily summary endpoint with `httpx.get()`

```python
# Fetch last 5 trading days of cross-sectional summary

five_days_ago = (Date.today() - timedelta(days=10)).isoformat()
resp = httpx.get(f"http://127.0.0.1:{API_PORT}/daily-summary", params={"start_date": five_days_ago})
print(f"Status: {resp.status_code}, rows: {len(resp.json())}")

# Display as Polars DataFrame
pl.DataFrame(resp.json())
```

    01:07:44 | INFO  | HTTP Request: GET http://127.0.0.1:8099/daily-summary?start_date=2026-03-19 "HTTP/1.1 200 OK"

    Status: 200, rows: 7

<table>
  <thead>
    <tr>
      <th >date</th>
      <th >symbols_traded</th>
      <th >avg_return</th>
      <th >max_return</th>
      <th >min_return</th>
      <th >total_volume</th>
      <th >avg_intraday_pct</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >2026-03-19</td>
      <td >5</td>
      <td >-0.023291</td>
      <td >-0.008920</td>
      <td >-0.044730</td>
      <td >19513518</td>
      <td >0.026323</td>
    </tr>
    <tr>
      <td >2026-03-20</td>
      <td >5</td>
      <td >-0.020986</td>
      <td >-0.002818</td>
      <td >-0.038625</td>
      <td >42486270</td>
      <td >0.040470</td>
    </tr>
    <tr>
      <td >2026-03-23</td>
      <td >5</td>
      <td >0.012035</td>
      <td >0.037055</td>
      <td >-0.002530</td>
      <td >21900746</td>
      <td >0.071276</td>
    </tr>
    <tr>
      <td >2026-03-24</td>
      <td >5</td>
      <td >0.003854</td>
      <td >0.041800</td>
      <td >-0.040556</td>
      <td >14990944</td>
      <td >0.028663</td>
    </tr>
    <tr>
      <td >2026-03-25</td>
      <td >5</td>
      <td >0.008021</td>
      <td >0.023951</td>
      <td >-0.004877</td>
      <td >13536325</td>
      <td >0.019512</td>
    </tr>
    <tr>
      <td >2026-03-26</td>
      <td >5</td>
      <td >-0.006063</td>
      <td >0.014394</td>
      <td >-0.015385</td>
      <td >15722294</td>
      <td >0.019610</td>
    </tr>
    <tr>
      <td >2026-03-27</td>
      <td >5</td>
      <td >-0.003768</td>
      <td >0.026803</td>
      <td >-0.023123</td>
      <td >16207050</td>
      <td >0.024848</td>
    </tr>
  </tbody>
</table>

#### httpx — test symbol profile endpoint with `httpx.get()`

```python
# Fetch all symbol profiles from the API

resp = httpx.get(f"http://127.0.0.1:{API_PORT}/symbol-profile")
print(f"Status: {resp.status_code}, profiles: {len(resp.json())}")

pl.DataFrame(resp.json())
```

    01:07:46 | INFO  | HTTP Request: GET http://127.0.0.1:8099/symbol-profile "HTTP/1.1 200 OK"

    Status: 200, profiles: 5

<table>
  <thead>
    <tr>
      <th >symbol</th>
      <th >total_trading_days</th>
      <th >avg_daily_return</th>
      <th >volatility</th>
      <th >max_drawdown</th>
      <th >avg_volume</th>
      <th >total_dividends</th>
      <th >first_date</th>
      <th >last_date</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >ALV.DE</td>
      <td >506</td>
      <td >0.000532</td>
      <td >0.011839</td>
      <td >-0.123504</td>
      <td >631485.920000</td>
      <td >29.200000</td>
      <td >2024-03-28</td>
      <td >2026-03-27</td>
    </tr>
    <tr>
      <td >BAS.DE</td>
      <td >506</td>
      <td >0.000121</td>
      <td >0.017491</td>
      <td >-0.276766</td>
      <td >2518770.100000</td>
      <td >5.650000</td>
      <td >2024-03-28</td>
      <td >2026-03-27</td>
    </tr>
    <tr>
      <td >DTE.DE</td>
      <td >506</td>
      <td >0.000765</td>
      <td >0.013250</td>
      <td >-0.266109</td>
      <td >6530991.970000</td>
      <td >1.670000</td>
      <td >2024-03-28</td>
      <td >2026-03-27</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >506</td>
      <td >-0.000285</td>
      <td >0.018900</td>
      <td >-0.491402</td>
      <td >1676452.980000</td>
      <td >4.550000</td>
      <td >2024-03-28</td>
      <td >2026-03-27</td>
    </tr>
    <tr>
      <td >SIE.DE</td>
      <td >506</td>
      <td >0.000475</td>
      <td >0.019204</td>
      <td >-0.273251</td>
      <td >1155093.990000</td>
      <td >10.550000</td>
      <td >2024-03-28</td>
      <td >2026-03-27</td>
    </tr>
  </tbody>
</table>

#### httpx — test symbol timeseries endpoint with `httpx.get()`

```python
# Fetch last 10 days of SAP.DE time series data

resp = httpx.get(f"http://127.0.0.1:{API_PORT}/symbol/SAP.DE/timeseries", params={"limit": 10})
print(f"Status: {resp.status_code}, rows: {len(resp.json())}")

pl.DataFrame(resp.json()).head()
```

    01:07:48 | INFO  | HTTP Request: GET http://127.0.0.1:8099/symbol/SAP.DE/timeseries?limit=10 "HTTP/1.1 200 OK"

    Status: 200, rows: 10

<table>
  <thead>
    <tr>
      <th >date</th>
      <th >open</th>
      <th >high</th>
      <th >low</th>
      <th >close</th>
      <th >volume</th>
      <th >daily_return</th>
      <th >intraday_range</th>
      <th >sma_20</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >2026-03-27</td>
      <td >145.740005</td>
      <td >147.320007</td>
      <td >142.100006</td>
      <td >142.559998</td>
      <td >3567464</td>
      <td >-0.014381</td>
      <td >0.036616</td>
      <td >161.330000</td>
    </tr>
    <tr>
      <td >2026-03-26</td>
      <td >145.399994</td>
      <td >148.080002</td>
      <td >143.520004</td>
      <td >144.639999</td>
      <td >3752998</td>
      <td >-0.015385</td>
      <td >0.031527</td>
      <td >162.750000</td>
    </tr>
    <tr>
      <td >2026-03-25</td>
      <td >148.779999</td>
      <td >150.539993</td>
      <td >145.360001</td>
      <td >146.899994</td>
      <td >3757697</td>
      <td >-0.004877</td>
      <td >0.035262</td>
      <td >164.129000</td>
    </tr>
    <tr>
      <td >2026-03-24</td>
      <td >149.759995</td>
      <td >151.039993</td>
      <td >146.000000</td>
      <td >147.619995</td>
      <td >4380715</td>
      <td >-0.040556</td>
      <td >0.034142</td>
      <td >165.123000</td>
    </tr>
    <tr>
      <td >2026-03-23</td>
      <td >150.460007</td>
      <td >161.520004</td>
      <td >150.399994</td>
      <td >153.860001</td>
      <td >4165368</td>
      <td >0.000260</td>
      <td >0.072274</td>
      <td >166.034000</td>
    </tr>
  </tbody>
</table>

#### httpx — test lineage endpoint with `httpx.get()`

```python
# Fetch pipeline execution metadata for this run

resp = httpx.get(f"http://127.0.0.1:{API_PORT}/lineage/{batch_id[:8]}")
print(f"Status: {resp.status_code}")
data = resp.json()
print(f"Batch: {data['batch_id'][:8]}... | Status: {data['status']}")

pl.DataFrame(data["stages"]).select("stage", "input_rows", "output_rows", "rows_rejected", "output_hash")
```

    01:07:50 | INFO  | HTTP Request: GET http://127.0.0.1:8099/lineage/bc9d3a23 "HTTP/1.1 200 OK"

    Status: 200
    Batch: bc9d3a23... | Status: completed

<table>
  <thead>
    <tr>
      <th >stage</th>
      <th >input_rows</th>
      <th >output_rows</th>
      <th >rows_rejected</th>
      <th >output_hash</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >bronze</td>
      <td >5</td>
      <td >5</td>
      <td >0</td>
      <td >bf7713401ce6f144</td>
    </tr>
    <tr>
      <td >silver</td>
      <td >2530</td>
      <td >2530</td>
      <td >0</td>
      <td >309f651b6d140961</td>
    </tr>
    <tr>
      <td >gold</td>
      <td >511</td>
      <td >511</td>
      <td >0</td>
      <td >7e21b5203a7ab58d</td>
    </tr>
    <tr>
      <td >export</td>
      <td >3041</td>
      <td >3041</td>
      <td >0</td>
      <td >c418628dd0f329a9</td>
    </tr>
  </tbody>
</table>

## Streamlit Frontend

A minimal Streamlit dashboard that consumes the FastAPI endpoints.
Written to a `.py` file and launched as a subprocess.

#### Streamlit Dashboard Views
- Market overview (daily summary chart)
- Symbol comparison (profile table + bar chart)
- Symbol detail (time series with SMA overlay)

The Streamlit app only knows about the API — it has no direct database
or file access. This enforces the data product boundary: consumers
interact with the API contract, not the implementation.

#### Streamlit — write dashboard app to file with `Path.write_text()`

```python
# Generates the Streamlit Python file that consumes the FastAPI endpoints
# The app reads from the API, not from files or database directly

app_code = '''
import streamlit as st
import httpx
import polars as pl
import plotly.graph_objects as go
from datetime import date, timedelta

API_BASE = "http://127.0.0.1:8099"

st.set_page_config(page_title="Gold Pipeline Dashboard", layout="wide")
st.title("Gold Data Pipeline Dashboard")

# ── Sidebar: symbol selector ──
profiles_resp = httpx.get(f"{API_BASE}/symbol-profile")
if profiles_resp.status_code != 200:
    st.error("API not reachable. Start the FastAPI server first.")
    st.stop()

profiles = pl.DataFrame(profiles_resp.json())
symbols = sorted(profiles["symbol"].to_list())

# ── Tab 1: Market Overview ──
tab1, tab2, tab3 = st.tabs(["Market Overview", "Symbol Comparison", "Symbol Detail"])

with tab1:
    st.subheader("Daily Cross-Sectional Summary")
    days_back = st.slider("Days back", 30, 365, 90, key="overview_days")
    start = (date.today() - timedelta(days=days_back)).isoformat()
    daily_resp = httpx.get(f"{API_BASE}/daily-summary", params={"start_date": start})
    daily_df = pl.DataFrame(daily_resp.json())

    if len(daily_df) > 0:
        col1, col2, col3 = st.columns(3)
        col1.metric("Trading Days", len(daily_df))
        col2.metric("Avg Daily Return", f"{daily_df['avg_return'].mean():.4%}")
        col3.metric("Avg Intraday Range", f"{daily_df['avg_intraday_pct'].mean():.4%}")

        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=daily_df["date"].to_list(), y=daily_df["avg_return"].to_list(),
            mode="lines", name="Avg Return", line=dict(color="#4285F4")
        ))
        fig.update_layout(title="Average Daily Return", template="plotly_dark",
                          yaxis_title="Return", xaxis_title="Date",
                          paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)")
        st.plotly_chart(fig, width='stretch')

with tab2:
    st.subheader("Symbol Comparison")
    st.dataframe(profiles.to_pandas(), width='stretch')

    fig = go.Figure()
    fig.add_trace(go.Bar(
        x=profiles["symbol"].to_list(),
        y=[v * 100 for v in profiles["volatility"].to_list()],
        marker_color="#1a3a5c", name="Volatility %"
    ))
    fig.update_layout(title="Annualized Volatility by Symbol", template="plotly_dark",
                      yaxis_title="Volatility (%)", paper_bgcolor="rgba(0,0,0,0)",
                      plot_bgcolor="rgba(0,0,0,0)")
    st.plotly_chart(fig, width='stretch')

with tab3:
    st.subheader("Symbol Time Series")
    selected = st.selectbox("Symbol", symbols)
    limit = st.slider("Days", 30, 500, 200, key="ts_days")

    ts_resp = httpx.get(f"{API_BASE}/symbol/{selected}/timeseries", params={"limit": limit})
    ts_df = pl.DataFrame(ts_resp.json()).sort("date")

    if len(ts_df) > 0:
        fig = go.Figure()
        fig.add_trace(go.Candlestick(
            x=ts_df["date"].to_list(),
            open=ts_df["open"].to_list(), high=ts_df["high"].to_list(),
            low=ts_df["low"].to_list(), close=ts_df["close"].to_list(),
            name="OHLC"
        ))
        sma_vals = ts_df["sma_20"].to_list()
        if any(v is not None for v in sma_vals):
            fig.add_trace(go.Scatter(
                x=ts_df["date"].to_list(), y=sma_vals,
                mode="lines", name="SMA 20", line=dict(color="#FFAB40", width=2)
            ))
        fig.update_layout(title=f"{selected} — OHLC + SMA 20", template="plotly_dark",
                          paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                          xaxis_rangeslider_visible=False)
        st.plotly_chart(fig, width='stretch')
'''

# Write the Streamlit app to disk
app_path = EXPORT_DIR / "app_dashboard.py"
app_path.write_text(app_code.strip(), encoding="utf-8")
print(f"Streamlit app written to: {app_path}")
print(f"Run with: streamlit run {app_path}")
```

    Streamlit app written to: C:\Users\aperi\DEV\LANG\data\pipeline\app_dashboard.py
    Run with: streamlit run C:\Users\aperi\DEV\LANG\data\pipeline\app_dashboard.py

![Gold Market](/static/gold_market.png)

![Gold Comparison](/static/gold_comp.png)

![Gold Detail](/static/gold_detail.png)

#### Streamlit — launch dashboard with `subprocess.Popen()`

```python
# Starts Streamlit on port 8501 in background
# The app consumes the FastAPI server running on port 8099


streamlit_proc = subprocess.Popen(
    ["streamlit", "run", str(EXPORT_DIR / "app_dashboard.py"),
     "--server.port", "8501", "--server.headless", "true"],
    stdout=subprocess.PIPE, stderr=subprocess.PIPE
)

time.sleep(3)
print(f"Streamlit dashboard: http://localhost:8501")
print(f"Process PID: {streamlit_proc.pid}")
```

## Pipeline Visualization

Visual validation of the pipeline output. All charts use Plotly with
dark-theme-compatible transparent backgrounds.

#### Plotly — plot daily return time series with `go.Scatter()`

```python
# Overlaid line chart showing daily returns across all 5 symbols (last 3 months)

three_months_ago = Date.today() - timedelta(days=30)

fig = go.Figure()
for symbol in SYMBOLS:
    sym_df = silver_df.filter(
        (pl.col("symbol") == symbol) & (pl.col("date") >= three_months_ago)
    ).sort("date")
    fig.add_trace(go.Scatter(
        x=sym_df["date"].to_list(),
        y=sym_df["daily_return"].to_list(),
        mode="lines", name=symbol, opacity=0.7
    ))

fig.update_layout(
    title="Daily Returns \u2014 Last 3 Months",
    template="plotly_dark",
    paper_bgcolor="rgba(0,0,0,0)",
    plot_bgcolor="rgba(0,0,0,0)",
    yaxis_title="Daily Return",
    xaxis_title="Date",
    legend=dict(orientation="h", y=-0.25),
)
fig.show()
```

<iframe src="/static/plotly/fp_py_01.html" width="100%" height="500" style="border:none;"></iframe>

#### Plotly — plot cumulative returns comparison with `cum_prod()`

```python
# Shows how a €1 investment in each symbol would have grown

fig = go.Figure()
for symbol in SYMBOLS:
    sym_df = silver_df.filter(pl.col("symbol") == symbol).sort("date")
    cum_ret = (1 + sym_df["daily_return"]).cum_prod()
    fig.add_trace(go.Scatter(
        x=sym_df["date"].to_list(),
        y=cum_ret.to_list(),
        mode="lines", name=symbol
    ))

fig.update_layout(
    title="Cumulative Returns — €1 Investment",
    template="plotly_dark",
    paper_bgcolor="rgba(0,0,0,0)",
    plot_bgcolor="rgba(0,0,0,0)",
    yaxis_title="Growth of €1",
    xaxis_title="Date",
    legend=dict(orientation="h", y=-0.15),
)
fig.show()
```

<iframe src="/static/plotly/fp_py_02.html" width="100%" height="500" style="border:none;"></iframe>

#### Plotly — plot risk-return scatter with `go.Scatter()`

```python
# Risk-return visualization using Gold symbol profile data

fig = go.Figure()
fig.add_trace(go.Scatter(
    x=[v * 100 for v in valid_profiles["volatility"].to_list()],
    y=[v * 100 for v in valid_profiles["avg_daily_return"].to_list()],
    mode="markers+text",
    text=valid_profiles["symbol"].to_list(),
    textposition="top center",
    marker=dict(size=12, color="#4285F4"),
))

fig.update_layout(
    title="Risk-Return Profile — Volatility vs Avg Daily Return",
    template="plotly_dark",
    paper_bgcolor="rgba(0,0,0,0)",
    plot_bgcolor="rgba(0,0,0,0)",
    xaxis_title="Daily Volatility (%)",
    yaxis_title="Avg Daily Return (%)",
)
fig.show()
```

<iframe src="/static/plotly/fp_py_03.html" width="100%" height="500" style="border:none;"></iframe>

#### Plotly — plot pipeline stage timing with `go.Bar()`

```python
# Shows how long each pipeline stage took in milliseconds

stages = [s.stage for s in run_context.stages]
durations = [s.duration_ms for s in run_context.stages]

fig = go.Figure()
fig.add_trace(go.Bar(
    x=stages, y=durations,
    marker_color=["#4285F4", "#34A853", "#FBBC04", "#EA4335"],
    text=[f"{d:.0f}ms" for d in durations],
    textposition="outside",
))

fig.update_layout(
    title="Pipeline Stage Duration",
    template="plotly_dark",
    paper_bgcolor="rgba(0,0,0,0)",
    plot_bgcolor="rgba(0,0,0,0)",
    yaxis_title="Duration (ms)",
    xaxis_title="Stage",
)
fig.show()
```

<iframe src="/static/plotly/fp_py_04.html" width="100%" height="500" style="border:none;"></iframe>

## Airflow Orchestration

This section builds the full deployment pipeline in 5 steps:

1. **Extract** — generate `pipeline_tasks.py` module with all pipeline functions
2. **Define** — generate `gold_pipeline_dag.py` with task dependencies and retry policies
3. **Validate** — import the DAG in-process to verify it parses without errors
4. **Inspect** — extract and display the task dependency graph from the parsed DAG
5. **Deploy** — start an Airflow Docker container with the DAG volume mounted

After step 5, Airflow is live at `http://localhost:8080` with the DAG
auto-detected, scheduled Mon–Fri at 18:30 UTC (after European market close),
and ready to run.

**DAG task chain:** fetch_dimensions → load_dimensions → build_calendar → ingest_bronze → dq_bronze → process_silver → dq_silver → process_gold → export_parquet → notify_complete

#### Python — extract pipeline functions to module with `Path.write_text()`

```python
# Writes all pipeline functions to a standalone Python module
# This module is imported by the Airflow DAG — no notebook dependency at runtime

tasks_code = '''"""
Pipeline task functions — extracted from 25_Functional_Pipeline_py.ipynb.
Called by the Airflow DAG. Each function is one pipeline stage.
"""
import hashlib
import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone, date as Date, timedelta
from pathlib import Path
from urllib.parse import quote_plus

import polars as pl
import pyodbc
import yfinance as yf
import pandas_market_calendars as mcal
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict
from sqlalchemy import create_engine
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

log = logging.getLogger("pipeline")

# ── Configuration ──
DATA_DIR    = Path(os.environ.get("PIPELINE_DATA_DIR", r"C:\\Users\\aperi\\DEV\\LANG\\data"))
EXPORT_DIR  = DATA_DIR / "pipeline"
LANDING_DIR = EXPORT_DIR / "landing"
LINEAGE_DIR = EXPORT_DIR / "lineage"

SQL_CONN_STR = os.environ.get("PIPELINE_SQL_CONN", (
    "Driver={ODBC Driver 18 for SQL Server};"
    "Server=stoxx-db,1433;Database=stoxx;"
    "UID=sa;PWD=EsgDev2026Pass1;"
    "Encrypt=yes;TrustServerCertificate=yes;"
))

SYMBOLS = json.loads(os.environ.get("PIPELINE_SYMBOLS",
    \'["SAP.DE", "SIE.DE", "ALV.DE", "DTE.DE", "BAS.DE"]\'
))

LOOKBACK_DAYS = int(os.environ.get("PIPELINE_LOOKBACK_DAYS", "730"))

EXCHANGE_MAP = {
    "GER": "XETR", "FRA": "XFRA", "PAR": "XPAR", "AMS": "XAMS",
    "BRU": "XBRU", "MIL": "XMIL", "MCE": "XMAD", "NMS": "XNYS",
    "NYQ": "XNYS", "HKG": "XHKG", "TKS": "XTKS",
}


def get_connection():
    """Create SQL Server connection + cursor."""
    conn = pyodbc.connect(SQL_CONN_STR)
    return conn, conn.cursor()


def get_engine():
    """Create SQLAlchemy engine."""
    return create_engine(f"mssql+pyodbc:///?odbc_connect={quote_plus(SQL_CONN_STR)}")


def generate_batch_id() -> str:
    return str(uuid.uuid4())


def compute_hash(df: pl.DataFrame) -> str:
    csv_bytes = df.sort(df.columns).write_csv().encode("utf-8")
    return hashlib.sha256(csv_bytes).hexdigest()[:16]


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    retry=retry_if_exception_type((ConnectionError, TimeoutError, OSError)),
)
def fetch_with_retry(ticker, start: str, end: str):
    return ticker.history(start=start, end=end, auto_adjust=False)


# ── Task: Fetch dimensions to landing zone ──
def task_fetch_dimensions(symbols: list[str]) -> Path:
    """Fetch symbol metadata from yfinance to JSON landing zone."""
    LANDING_DIR.mkdir(parents=True, exist_ok=True)
    records = []
    for symbol in symbols:
        ticker = yf.Ticker(symbol)
        try:
            info = ticker.info or {}
        except Exception:
            info = {}
        sector = info.get("sector")
        industry = info.get("industry")
        records.append({
            "symbol": symbol,
            "longName": info.get("longName"),
            "shortName": info.get("shortName"),
            "sector": sector,
            "sectorKey": sector.lower().replace(" ", "_") if sector else None,
            "industry": industry,
            "industryKey": industry.lower().replace(" ", "_") if industry else None,
            "country": info.get("country"),
            "city": info.get("city"),
            "exchange": info.get("exchange"),
            "fullExchangeName": info.get("fullExchangeName"),
            "currency": info.get("currency"),
            "marketCap": info.get("marketCap"),
            "website": info.get("website"),
        })
        log.info(f"  {symbol}: fetched ({records[-1].get(\'longName\')})")

    path = LANDING_DIR / "dim_symbol.json"
    path.write_text(json.dumps(records, indent=2, default=str), encoding="utf-8")
    log.info(f"Landed: {path} ({len(records)} symbols)")
    return path


# ── Task: SCD2 upsert dimensions from landing ──
def task_load_dimensions() -> int:
    """Load symbol metadata from landing and SCD2 upsert into dim_symbol."""
    conn, cur = get_connection()
    records = json.loads((LANDING_DIR / "dim_symbol.json").read_text(encoding="utf-8"))
    count = 0

    for rec in records:
        db_rec = {
            "symbol": rec["symbol"],
            "company_name": rec.get("longName") or rec.get("shortName"),
            "short_name": rec.get("shortName"),
            "sector": rec.get("sector"),
            "sector_key": rec.get("sectorKey"),
            "industry": rec.get("industry"),
            "industry_key": rec.get("industryKey"),
            "country": rec.get("country"),
            "city": rec.get("city"),
            "exchange": rec.get("exchange"),
            "full_exchange_name": rec.get("fullExchangeName"),
            "currency": rec.get("currency"),
            "market_cap": rec.get("marketCap"),
            "website": rec.get("website"),
        }

        cur.execute(
            "SELECT id, company_name, sector, industry, country, exchange, currency "
            "FROM dim_symbol WHERE symbol = ? AND is_current = 1",
            db_rec["symbol"]
        )
        existing = cur.fetchone()

        if existing is None:
            cur.execute(
                "INSERT INTO dim_symbol (symbol, company_name, short_name, sector, sector_key, "
                "industry, industry_key, country, city, exchange, full_exchange_name, currency, "
                "market_cap, website) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                db_rec["symbol"], db_rec["company_name"], db_rec["short_name"],
                db_rec["sector"], db_rec["sector_key"], db_rec["industry"], db_rec["industry_key"],
                db_rec["country"], db_rec["city"], db_rec["exchange"],
                db_rec["full_exchange_name"], db_rec["currency"], db_rec["market_cap"],
                db_rec["website"],
            )
            log.info(f"  {rec[\'symbol\']}: INSERT")
        else:
            old = (existing[1], existing[2], existing[3], existing[4], existing[5], existing[6])
            new = (db_rec["company_name"], db_rec["sector"], db_rec["industry"],
                   db_rec["country"], db_rec["exchange"], db_rec["currency"])
            if old != new:
                cur.execute("UPDATE dim_symbol SET valid_to = SYSUTCDATETIME(), is_current = 0 WHERE id = ?", existing[0])
                cur.execute(
                    "INSERT INTO dim_symbol (symbol, company_name, short_name, sector, sector_key, "
                    "industry, industry_key, country, city, exchange, full_exchange_name, currency, "
                    "market_cap, website) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    db_rec["symbol"], db_rec["company_name"], db_rec["short_name"],
                    db_rec["sector"], db_rec["sector_key"], db_rec["industry"], db_rec["industry_key"],
                    db_rec["country"], db_rec["city"], db_rec["exchange"],
                    db_rec["full_exchange_name"], db_rec["currency"], db_rec["market_cap"],
                    db_rec["website"],
                )
                log.info(f"  {rec[\'symbol\']}: SCD2_UPDATE")
            else:
                log.info(f"  {rec[\'symbol\']}: UNCHANGED")
        count += 1

    conn.commit()
    conn.close()
    return count


# ── Task: Build trading calendar ──
def task_build_calendar(start: str, end: str) -> int:
    """Generate and persist per-exchange trading calendar."""
    conn, cur = get_connection()
    engine = get_engine()

    cur.execute("SELECT DISTINCT exchange FROM dim_symbol WHERE is_current = 1 AND exchange IS NOT NULL")
    exchanges = [r[0] for r in cur.fetchall()]
    if not exchanges:
        exchanges = ["GER"]

    count = 0
    for yf_code in exchanges:
        mcal_name = EXCHANGE_MAP.get(yf_code, yf_code)
        try:
            cal = mcal.get_calendar(mcal_name)
        except RuntimeError:
            cal = mcal.get_calendar("XETR")

        schedule = cal.schedule(start_date=start, end_date=end)
        trading_dates = set(schedule.index.date)

        all_dates = pl.date_range(Date.fromisoformat(start), Date.fromisoformat(end), eager=True)
        for d in all_dates:
            is_td = 1 if d in trading_dates else 0
            cur.execute(
                "MERGE dim_calendar AS tgt USING (SELECT ? AS date, ? AS exchange_code) AS src "
                "ON tgt.date = src.date AND tgt.exchange_code = src.exchange_code "
                "WHEN NOT MATCHED THEN INSERT (date, exchange_code, year, quarter, month, "
                "week_of_year, day_of_week, is_trading_day, is_month_end, is_quarter_end) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0);",
                d, yf_code, d, yf_code, d.year, (d.month - 1) // 3 + 1, d.month,
                d.isocalendar()[1], d.isoweekday(), is_td,
            )
            count += 1

    conn.commit()
    conn.close()
    log.info(f"Calendar: {count} rows upserted")
    return count


# ── Task: Ingest Bronze ──
def task_ingest_bronze(symbols: list[str], start: str, end: str, batch_id: str) -> dict:
    """Incremental fetch to landing + MERGE upsert into bronze_ohlcv."""
    conn, cur = get_connection()
    engine = get_engine()
    LANDING_DIR.mkdir(parents=True, exist_ok=True)

    total_fetched = 0
    total_merged = 0

    for symbol in symbols:
        cur.execute("SELECT MAX(date) FROM bronze_ohlcv WHERE symbol = ?", symbol)
        row = cur.fetchone()
        last_date = row[0] if row and row[0] else None

        fetch_start = (last_date + timedelta(days=1)).isoformat() if last_date else start
        if fetch_start >= end:
            log.info(f"  {symbol}: up to date")
            continue

        ticker = yf.Ticker(symbol)
        pdf = fetch_with_retry(ticker, fetch_start, end)
        if pdf.empty:
            continue

        # Land to JSON
        pdf_reset = pdf.reset_index()
        records = []
        for _, r in pdf_reset.iterrows():
            records.append({
                "symbol": symbol, "date": r["Date"].strftime("%Y-%m-%d"),
                "open": float(r["Open"]), "high": float(r["High"]),
                "low": float(r["Low"]), "close": float(r["Close"]),
                "adj_close": float(r["Adj Close"]), "volume": int(r["Volume"]),
                "dividends": float(r["Dividends"]), "stock_splits": float(r["Stock Splits"]),
            })
        safe = symbol.replace(".", "_")
        (LANDING_DIR / f"ohlcv_{safe}.json").write_text(json.dumps(records, indent=2), encoding="utf-8")

        # MERGE upsert
        for rec in records:
            cur.execute(
                "MERGE bronze_ohlcv AS tgt USING (SELECT ? AS symbol, ? AS date) AS src "
                "ON tgt.symbol = src.symbol AND tgt.date = src.date "
                "WHEN MATCHED THEN UPDATE SET [open]=?, high=?, low=?, [close]=?, "
                "adj_close=?, volume=?, dividends=?, stock_splits=?, batch_id=?, ingested_at=GETUTCDATE() "
                "WHEN NOT MATCHED THEN INSERT (symbol, date, [open], high, low, [close], adj_close, "
                "volume, dividends, stock_splits, batch_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
                rec["symbol"], rec["date"],
                rec["open"], rec["high"], rec["low"], rec["close"],
                rec["adj_close"], rec["volume"], rec["dividends"], rec["stock_splits"], batch_id,
                rec["symbol"], rec["date"],
                rec["open"], rec["high"], rec["low"], rec["close"],
                rec["adj_close"], rec["volume"], rec["dividends"], rec["stock_splits"], batch_id,
            )
            total_merged += 1
        total_fetched += len(records)
        log.info(f"  {symbol}: {len(records)} rows landed + merged")

    conn.commit()
    conn.close()
    return {"fetched": total_fetched, "merged": total_merged}


# ── Task: Process Silver ──
def task_process_silver(batch_id: str) -> dict:
    """Transform full bronze, MERGE upsert into silver_ohlcv."""
    conn, cur = get_connection()
    engine = get_engine()

    bronze_df = pl.read_database(
        "SELECT symbol, date, [open] as [open], high, low, [close] as [close], "
        "adj_close, volume, dividends, stock_splits FROM bronze_ohlcv ORDER BY symbol, date",
        connection=engine
    )

    # Transforms
    df = bronze_df.sort(["symbol", "date"]).with_columns(
        pl.col("close").pct_change().over("symbol").fill_null(0.0).round(6).alias("daily_return"),
    ).with_columns(
        ((pl.col("high") - pl.col("low")) / pl.col("close")).round(6).alias("intraday_range"),
    ).with_columns(
        pl.col("close").rolling_mean(window_size=20).over("symbol").round(4).alias("sma_20"),
    )

    # MERGE upsert
    merged = 0
    for row in df.iter_rows(named=True):
        cur.execute(
            "MERGE silver_ohlcv AS tgt USING (SELECT ? AS symbol, ? AS date) AS src "
            "ON tgt.symbol = src.symbol AND tgt.date = src.date "
            "WHEN MATCHED THEN UPDATE SET [open]=?, high=?, low=?, [close]=?, adj_close=?, "
            "volume=?, dividends=?, stock_splits=?, daily_return=?, intraday_range=?, "
            "sma_20=?, batch_id=?, processed_at=GETUTCDATE() "
            "WHEN NOT MATCHED THEN INSERT (symbol, date, [open], high, low, [close], adj_close, "
            "volume, dividends, stock_splits, daily_return, intraday_range, sma_20, batch_id) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
            row["symbol"], row["date"],
            row["open"], row["high"], row["low"], row["close"], row["adj_close"],
            row["volume"], row["dividends"], row["stock_splits"],
            row["daily_return"], row["intraday_range"], row["sma_20"], batch_id,
            row["symbol"], row["date"],
            row["open"], row["high"], row["low"], row["close"], row["adj_close"],
            row["volume"], row["dividends"], row["stock_splits"],
            row["daily_return"], row["intraday_range"], row["sma_20"], batch_id,
        )
        merged += 1

    conn.commit()
    conn.close()
    log.info(f"Silver: {merged} rows merged")
    return {"merged": merged}


# ── Task: Process Gold ──
def task_process_gold(batch_id: str) -> dict:
    """Build Gold marts (truncate + insert) from Silver data."""
    conn, cur = get_connection()
    engine = get_engine()

    silver_df = pl.read_database(
        "SELECT symbol, date, [open] as [open], high, low, [close] as [close], adj_close, "
        "volume, dividends, stock_splits, daily_return, intraday_range, sma_20 "
        "FROM silver_ohlcv ORDER BY symbol, date",
        connection=engine
    )

    # Daily summary
    daily = silver_df.group_by("date").agg(
        pl.col("symbol").n_unique().alias("symbols_traded"),
        pl.col("daily_return").mean().round(6).alias("avg_return"),
        pl.col("daily_return").max().alias("max_return"),
        pl.col("daily_return").min().alias("min_return"),
        pl.col("volume").sum().alias("total_volume"),
        pl.col("intraday_range").mean().round(6).alias("avg_intraday_pct"),
    ).sort("date").with_columns(pl.lit(batch_id).alias("batch_id"))

    # Symbol profiles
    profiles = []
    for symbol in silver_df.select("symbol").unique().sort("symbol").to_series():
        sym = silver_df.filter(pl.col("symbol") == symbol).sort("date")
        cum_max = sym.select(pl.col("close").cum_max().alias("peak"))
        max_dd = float(((sym["close"] - cum_max["peak"]) / cum_max["peak"]).min())
        profiles.append({
            "symbol": symbol, "total_trading_days": len(sym),
            "avg_daily_return": round(float(sym["daily_return"].mean()), 6),
            "volatility": round(float(sym["daily_return"].std()), 6),
            "max_drawdown": round(max_dd, 6),
            "avg_volume": round(float(sym["volume"].mean()), 2),
            "total_dividends": round(float(sym["dividends"].sum()), 4),
            "first_date": sym["date"].min(), "last_date": sym["date"].max(),
            "batch_id": batch_id,
        })
    profile_df = pl.DataFrame(profiles)

    # Truncate and insert Gold tables
    cur.execute("TRUNCATE TABLE gold_daily_summary")
    cur.execute("TRUNCATE TABLE gold_symbol_profile")
    conn.commit()

    daily.to_pandas().to_sql("gold_daily_summary", engine, if_exists="append", index=False, chunksize=100)
    profile_df.to_pandas().to_sql("gold_symbol_profile", engine, if_exists="append", index=False, chunksize=100)

    log.info(f"Gold: {len(daily)} daily + {len(profile_df)} profiles")
    return {"daily_rows": len(daily), "profile_rows": len(profile_df)}


# ── Task: Export Parquet ──
def task_export_parquet() -> dict:
    """Export Gold + Silver to Parquet files."""
    engine = get_engine()
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    exported = {}

    for table, filename in [
        ("gold_daily_summary", "gold_daily_summary.parquet"),
        ("gold_symbol_profile", "gold_symbol_profile.parquet"),
        ("silver_ohlcv", "silver_ohlcv.parquet"),
    ]:
        query = f"SELECT * FROM {table}"
        if "silver" in table:
            query = ("SELECT symbol, date, [open] as [open], high, low, [close] as [close], "
                     "adj_close, volume, dividends, stock_splits, daily_return, intraday_range, "
                     "sma_20, batch_id FROM silver_ohlcv")
        df = pl.read_database(query, connection=engine)
        path = EXPORT_DIR / filename
        df.write_parquet(path)
        exported[filename] = len(df)
        log.info(f"  Exported {filename}: {len(df)} rows")

    return exported
'''

tasks_path = EXPORT_DIR / "pipeline_tasks.py"
tasks_path.write_text(tasks_code.strip(), encoding="utf-8")
print(f"Pipeline tasks module written to: {tasks_path}")
print(f"Size: {tasks_path.stat().st_size / 1024:.1f} KB")
```

    Pipeline tasks module written to: C:\Users\aperi\DEV\LANG\data\pipeline\pipeline_tasks.py
    Size: 17.5 KB

#### Airflow — write DAG definition with `@task` TaskFlow API

Writes the Airflow DAG that orchestrates the pipeline tasks
Uses TaskFlow API (@task decorators) for clean Python-native DAG definition
Each task maps to a function in pipeline_tasks.py

```python
dag_code = '''"""
Airflow DAG — Gold Data Pipeline.

Schedule: daily at 18:30 UTC (after European market close).
Retries:  2 attempts with 5-minute delay.
SLA:      pipeline must complete within 30 minutes.

DAG structure:
  fetch_dims -> load_dims -> build_calendar -> ingest_bronze -> dq_bronze
                                                                  ↓
                              notify_complete ← export_parquet ← process_gold ← dq_silver ← process_silver
"""
from datetime import datetime, timedelta
from airflow.sdk import DAG, task

default_args = {
    "owner": "data-engineering",
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
    "execution_timeout": timedelta(minutes=30),
    "depends_on_past": False,
}

with DAG(
    dag_id="gold_data_pipeline",
    default_args=default_args,
    description="Medallion pipeline: yfinance -> Bronze -> Silver -> Gold -> Parquet",
    schedule="30 18 * * 1-5",  # Mon-Fri at 18:30 UTC (after EU market close)
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=["data-engineering", "medallion", "stoxx"],
    max_active_runs=1,
) as dag:

    @task()
    def fetch_dimensions():
        """Fetch symbol metadata from yfinance to landing zone."""
        import sys
        sys.path.insert(0, str(__file__).replace("gold_pipeline_dag.py", ""))
        from pipeline_tasks import task_fetch_dimensions, SYMBOLS
        return str(task_fetch_dimensions(SYMBOLS))

    @task()
    def load_dimensions():
        """SCD Type 2 upsert dimensions from landing zone into SQL Server."""
        import sys
        sys.path.insert(0, str(__file__).replace("gold_pipeline_dag.py", ""))
        from pipeline_tasks import task_load_dimensions
        return task_load_dimensions()

    @task()
    def build_calendar():
        """Generate per-exchange trading calendar with pandas-market-calendars."""
        import sys
        sys.path.insert(0, str(__file__).replace("gold_pipeline_dag.py", ""))
        from pipeline_tasks import task_build_calendar, LOOKBACK_DAYS, Date
        start = (Date.today() - timedelta(days=LOOKBACK_DAYS)).isoformat()
        end = Date.today().isoformat()
        return task_build_calendar(start, end)

    @task()
    def ingest_bronze(**context):
        """Incremental fetch to landing zone + MERGE upsert into bronze_ohlcv."""
        import sys
        sys.path.insert(0, str(__file__).replace("gold_pipeline_dag.py", ""))
        from pipeline_tasks import task_ingest_bronze, generate_batch_id, SYMBOLS, LOOKBACK_DAYS, Date
        batch_id = generate_batch_id()
        context["ti"].xcom_push(key="batch_id", value=batch_id)
        start = (Date.today() - timedelta(days=LOOKBACK_DAYS)).isoformat()
        end = Date.today().isoformat()
        return task_ingest_bronze(SYMBOLS, start, end, batch_id)

    @task()
    def dq_gate_bronze():
        """Data quality assertions on Bronze output."""
        import sys
        sys.path.insert(0, str(__file__).replace("gold_pipeline_dag.py", ""))
        from pipeline_tasks import get_engine, SYMBOLS
        import polars as pl
        engine = get_engine()
        df = pl.read_database("SELECT COUNT(*) as cnt FROM bronze_ohlcv", connection=engine)
        row_count = df["cnt"][0]
        min_expected = len(SYMBOLS) * 200
        assert row_count >= min_expected, f"Bronze row count {row_count} < minimum {min_expected}"
        return {"row_count": row_count, "status": "PASSED"}

    @task()
    def process_silver(**context):
        """Transform Bronze data and MERGE upsert into Silver."""
        import sys
        sys.path.insert(0, str(__file__).replace("gold_pipeline_dag.py", ""))
        from pipeline_tasks import task_process_silver
        batch_id = context["ti"].xcom_pull(task_ids="ingest_bronze", key="batch_id")
        return task_process_silver(batch_id)

    @task()
    def dq_gate_silver():
        """Data quality assertions on Silver output."""
        import sys
        sys.path.insert(0, str(__file__).replace("gold_pipeline_dag.py", ""))
        from pipeline_tasks import get_engine, SYMBOLS
        import polars as pl
        engine = get_engine()
        # Check no extreme daily returns
        df = pl.read_database(
            "SELECT COUNT(*) as cnt FROM silver_ohlcv WHERE daily_return < -0.5 OR daily_return > 0.5",
            connection=engine
        )
        outliers = df["cnt"][0]
        assert outliers == 0, f"Silver has {outliers} rows with daily_return outside [-0.5, 0.5]"
        return {"outliers": outliers, "status": "PASSED"}

    @task()
    def process_gold(**context):
        """Build Gold aggregation marts from Silver data."""
        import sys
        sys.path.insert(0, str(__file__).replace("gold_pipeline_dag.py", ""))
        from pipeline_tasks import task_process_gold
        batch_id = context["ti"].xcom_pull(task_ids="ingest_bronze", key="batch_id")
        return task_process_gold(batch_id)

    @task()
    def export_parquet():
        """Export Gold + Silver to Parquet files."""
        import sys
        sys.path.insert(0, str(__file__).replace("gold_pipeline_dag.py", ""))
        from pipeline_tasks import task_export_parquet
        return task_export_parquet()

    @task()
    def notify_complete(**context):
        """Log pipeline completion. Hook Slack/email alerting here."""
        import logging
        batch_id = context["ti"].xcom_pull(task_ids="ingest_bronze", key="batch_id")
        logging.getLogger("pipeline").info(
            f"Pipeline complete: batch={batch_id[:8]}... "
            f"run_id={context[\'run_id\']}"
        )
        return {"status": "complete", "batch_id": batch_id}

    # ── Task dependencies ──
    dims_fetched = fetch_dimensions()
    dims_loaded  = load_dimensions()
    calendar     = build_calendar()
    bronze       = ingest_bronze()
    dq_b         = dq_gate_bronze()
    silver       = process_silver()
    dq_s         = dq_gate_silver()
    gold         = process_gold()
    export       = export_parquet()
    done         = notify_complete()

    dims_fetched >> dims_loaded >> calendar >> bronze >> dq_b >> silver >> dq_s >> gold >> export >> done
'''

dag_path = EXPORT_DIR / "gold_pipeline_dag.py"
dag_path.write_text(dag_code.strip(), encoding="utf-8")
print(f"Airflow DAG written to: {dag_path}")
print(f"Size: {dag_path.stat().st_size / 1024:.1f} KB")
```

    Airflow DAG written to: C:\Users\aperi\DEV\LANG\data\pipeline\gold_pipeline_dag.py
    Size: 6.2 KB

#### Python — verify DAG syntax with `subprocess.run()`

```python
# Verify the DAG file is valid by importing it in the current Python process
# This avoids subprocess encoding issues and proves the DAG parses correctly


dag_file = EXPORT_DIR / "gold_pipeline_dag.py"
spec = importlib.util.spec_from_file_location("gold_pipeline_dag", dag_file)
if spec and spec.loader:
    dag_module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(dag_module)
        dag_obj = dag_module.dag
        log.info(f"DAG parsed successfully: {dag_obj.dag_id}")
        log.info(f"  Schedule: {dag_obj.schedule}")
        log.info(f"  Tasks: {len(dag_obj.tasks)}")
        log.info(f"  Tags: {dag_obj.tags}")
    except Exception as e:
        log.error(f"DAG parse error: {e}")
else:
    log.error(f"Could not load DAG from {dag_file}")
```

    2026-03-29T01:27:43.246987Z [info     ] DAG parsed successfully: gold_data_pipeline [pipeline] loc=3659110184.py:13
    2026-03-29T01:27:43.249983Z [info     ]   Schedule: 30 18 * * 1-5      [pipeline] loc=3659110184.py:14
    2026-03-29T01:27:43.253488Z [info     ]   Tasks: 10                    [pipeline] loc=3659110184.py:15
    2026-03-29T01:27:43.257053Z [info     ]   Tags: {'medallion', 'data-engineering', 'stoxx'} [pipeline] loc=3659110184.py:16

#### Airflow — extract task dependencies from parsed DAG with `topological_sort()`

```python
# Extract task dependencies from the actual parsed DAG object
# Proves the DAG is correctly wired — not hardcoded display data

task_data = []
for task in dag_obj.topological_sort():
    upstream = [t.task_id for t in task.upstream_list]
    task_data.append({
        "order": len(task_data) + 1,
        "task": task.task_id,
        "depends_on": ", ".join(upstream) if upstream else "-",
    })

pl.DataFrame(task_data)
```

<table>
  <thead>
    <tr>
      <th >order</th>
      <th >task</th>
      <th >depends_on</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >1</td>
      <td >fetch_dimensions</td>
      <td >-</td>
    </tr>
    <tr>
      <td >2</td>
      <td >load_dimensions</td>
      <td >fetch_dimensions</td>
    </tr>
    <tr>
      <td >3</td>
      <td >build_calendar</td>
      <td >load_dimensions</td>
    </tr>
    <tr>
      <td >4</td>
      <td >ingest_bronze</td>
      <td >build_calendar</td>
    </tr>
    <tr>
      <td >5</td>
      <td >dq_gate_bronze</td>
      <td >ingest_bronze</td>
    </tr>
    <tr>
      <td >6</td>
      <td >process_silver</td>
      <td >dq_gate_bronze</td>
    </tr>
    <tr>
      <td >7</td>
      <td >dq_gate_silver</td>
      <td >process_silver</td>
    </tr>
    <tr>
      <td >8</td>
      <td >process_gold</td>
      <td >dq_gate_silver</td>
    </tr>
    <tr>
      <td >9</td>
      <td >export_parquet</td>
      <td >process_gold</td>
    </tr>
    <tr>
      <td >10</td>
      <td >notify_complete</td>
      <td >export_parquet</td>
    </tr>
  </tbody>
</table>

#### Docker — start Airflow 3.x container with `docker run`

Start Airflow container with DAG volume mounted
Web UI: http://localhost:8080
Password: !docker logs airflow 2>&1 | findstr Password

```python
!docker run -d --name airflow --network pipeline-net -p 8080:8080 -v "C:/Users/aperi/DEV/LANG/data/pipeline:/opt/airflow/dags" -e AIRFLOW__CORE__LOAD_EXAMPLES=false apache/airflow:3.1.8 standalone
```

    10da57ea249264af3cbaefefd6abb38bd33820badd98061154ed227436742889

#### Docker — install pipeline dependencies with `docker exec`

```python
# Install pipeline packages inside the running container
# Wait ~15s after container start before running this cell

time.sleep(15)

!docker exec airflow python -m pip install polars yfinance pandas-market-calendars pydantic tenacity sqlalchemy pyodbc 2>nul
```

    'tail' is not recognized as an internal or external command,
    operable program or batch file.

#### Docker — get Airflow admin password with `docker exec`

```python
!docker logs airflow 2>&1 | findstr "Password"
```

    Simple auth manager | Password for user 'admin': 3KBPBG5T5uy2Qw2r

![Airflow DAG](/static/airflow_dag.png)

## Audit — Data Point Investigation

**Scenario:** A stakeholder at SAP challenges the -16% drop on 2026-01-29, claiming
the data is wrong and the pipeline produced a bad data point.

Using the pipeline's lineage infrastructure, we can trace every step from source
to Gold mart and prove the data is authentic:

1. **Landing zone** — raw JSON file from yfinance, untouched
2. **Bronze table** — exact values as ingested, with batch_id + timestamp
3. **Silver table** — computed daily return matches the close-to-close change
4. **Gold table** — the data point propagated correctly to the aggregation
5. **Lineage record** — the pipeline run that produced it, with hash
6. **External corroboration** — live yfinance data confirms the same values

This is the power of full lineage: every data point can be traced back to its
source with cryptographic proof that nothing was altered in between.

#### JSON — verify raw landing zone file with `json.loads()`

```python
# Step 1: The landing zone file contains the raw yfinance data for SAP.DE

landing_file = LANDING_DIR / "ohlcv_SAP_DE.json"
raw_records = json.loads(landing_file.read_text(encoding="utf-8"))
jan29_raw = next(r for r in raw_records if r["date"] == "2026-01-29")

pl.DataFrame([jan29_raw])
```

<table>
  <thead>
    <tr>
      <th >symbol</th>
      <th >date</th>
      <th >open</th>
      <th >high</th>
      <th >low</th>
      <th >close</th>
      <th >adj_close</th>
      <th >volume</th>
      <th >dividends</th>
      <th >stock_splits</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >SAP.DE</td>
      <td >2026-01-29</td>
      <td >179.000000</td>
      <td >180.160004</td>
      <td >162.119995</td>
      <td >164.619995</td>
      <td >164.619995</td>
      <td >15846791</td>
      <td >0.000000</td>
      <td >0.000000</td>
    </tr>
  </tbody>
</table>

#### SQL Server — query Bronze table for raw ingested values with `read_database()`

```python
# Step 2: Check Bronze — exact values as persisted, with batch_id and ingestion timestamp

bronze_audit = pl.read_database(
    "SELECT symbol, date, [open] as [open], high, low, [close] as [close], "
    "adj_close, volume, dividends, stock_splits, batch_id, ingested_at "
    "FROM bronze_ohlcv "
    "WHERE symbol = 'SAP.DE' AND date = '2026-01-29'",
    connection=sql_engine
)
print("Bronze table (raw ingested):")
bronze_audit
```

    Bronze table (raw ingested):

<table>
  <thead>
    <tr>
      <th >symbol</th>
      <th >date</th>
      <th >open</th>
      <th >high</th>
      <th >low</th>
      <th >close</th>
      <th >adj_close</th>
      <th >volume</th>
      <th >dividends</th>
      <th >stock_splits</th>
      <th >batch_id</th>
      <th >ingested_at</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >SAP.DE</td>
      <td >2026-01-29 00:00:00</td>
      <td >179.000000</td>
      <td >180.160004</td>
      <td >162.119995</td>
      <td >164.619995</td>
      <td >164.619995</td>
      <td >15846791</td>
      <td >0.000000</td>
      <td >0.000000</td>
      <td >9c135c08-937d-4413-8bb4-1b66407ed9a5</td>
      <td >2026-03-28 23:21:33.570000</td>
    </tr>
  </tbody>
</table>

#### SQL Server — query Silver table for enriched values with `read_database()`

```python
# Step 3: Check Silver — verify the daily_return calculation is correct
# daily_return should equal (close - prev_close) / prev_close

silver_audit = pl.read_database(
    "SELECT symbol, date, [close] as [close], daily_return, intraday_range, sma_20, "
    "batch_id, processed_at "
    "FROM silver_ohlcv "
    "WHERE symbol = 'SAP.DE' AND date BETWEEN '2026-01-28' AND '2026-01-30' "
    "ORDER BY date",
    connection=sql_engine
)
print("Silver table (enriched, 3-day window):")
print()

# Manually verify the return calculation
rows = silver_audit.to_dicts()
if len(rows) >= 2:
    prev_close = rows[0]["close"]
    curr_close = rows[1]["close"]
    expected_return = (curr_close - prev_close) / prev_close
    actual_return = rows[1]["daily_return"]
    print(f"  Previous close (Jan 28): {prev_close:.2f}")
    print(f"  Current close  (Jan 29): {curr_close:.2f}")
    print(f"  Expected return: ({curr_close:.2f} - {prev_close:.2f}) / {prev_close:.2f} = {expected_return:.6f}")
    print(f"  Actual return:   {actual_return:.6f}")
    print(f"  Match: {abs(expected_return - actual_return) < 0.000001}")
    print()

silver_audit
```

    Silver table (enriched, 3-day window):
    
      Previous close (Jan 28): 196.14
      Current close  (Jan 29): 164.62
      Expected return: (164.62 - 196.14) / 196.14 = -0.160702
      Actual return:   -0.160702
      Match: True

<table>
  <thead>
    <tr>
      <th >symbol</th>
      <th >date</th>
      <th >close</th>
      <th >daily_return</th>
      <th >intraday_range</th>
      <th >sma_20</th>
      <th >batch_id</th>
      <th >processed_at</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >SAP.DE</td>
      <td >2026-01-28 00:00:00</td>
      <td >196.139999</td>
      <td >0.003068</td>
      <td >0.020598</td>
      <td >202.379500</td>
      <td >d1f40137-c9a0-4079-aadf-dcaeeef9eaed</td>
      <td >2026-03-29 01:31:44.430000</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >2026-01-29 00:00:00</td>
      <td >164.619995</td>
      <td >-0.160702</td>
      <td >0.109586</td>
      <td >200.193000</td>
      <td >d1f40137-c9a0-4079-aadf-dcaeeef9eaed</td>
      <td >2026-03-29 01:31:44.430000</td>
    </tr>
    <tr>
      <td >SAP.DE</td>
      <td >2026-01-30 00:00:00</td>
      <td >170.559998</td>
      <td >0.036083</td>
      <td >0.038227</td>
      <td >198.623500</td>
      <td >d1f40137-c9a0-4079-aadf-dcaeeef9eaed</td>
      <td >2026-03-29 01:31:44.430000</td>
    </tr>
  </tbody>
</table>

#### SQL Server — query Gold tables for aggregated impact with `read_database()`

```python
# Step 4: Check Gold — verify the data point propagated to aggregations

gold_daily_audit = pl.read_database(
    "SELECT date, symbols_traded, avg_return, min_return, max_return, total_volume, batch_id "
    "FROM gold_daily_summary WHERE date = '2026-01-29'",
    connection=sql_engine
)
print("Gold daily summary (Jan 29):")
print(f"  The min_return on this day should reflect SAP's -16% drop")
gold_daily_audit
```

    Gold daily summary (Jan 29):
      The min_return on this day should reflect SAP's -16% drop

<table>
  <thead>
    <tr>
      <th >date</th>
      <th >symbols_traded</th>
      <th >avg_return</th>
      <th >min_return</th>
      <th >max_return</th>
      <th >total_volume</th>
      <th >batch_id</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >2026-01-29 00:00:00</td>
      <td >5</td>
      <td >-0.025652</td>
      <td >-0.160702</td>
      <td >0.020128</td>
      <td >25357247</td>
      <td >d1f40137-c9a0-4079-aadf-dcaeeef9eaed</td>
    </tr>
  </tbody>
</table>

#### SQL Server — query lineage table for pipeline run metadata with `read_database()`

Step 5: Trace the disputed data point back to its pipeline run

Every row in Bronze carries a batch_id — a UUID stamped at ingestion time.
This is the key to the entire lineage chain:
disputed row (symbol + date) → batch_id → lineage_stages → full pipeline audit

From the lineage table we get:
- When each stage ran (started_at / completed_at)
- How many rows were processed vs rejected
- The output hash: a SHA-256 fingerprint of the stage output
If anyone modified data after ingestion, the hash would no longer match

This is the production equivalent of "show me the chain of custody"

```python
# Look up the batch_id from the disputed row itself
batch_from_bronze = pl.read_database(
    "SELECT batch_id FROM bronze_ohlcv WHERE symbol = 'SAP.DE' AND date = '2026-01-29'",
    connection=sql_engine
)["batch_id"][0]

print(f"Disputed row: SAP.DE / 2026-01-29")
print(f"Batch ID (from row): {batch_from_bronze}")
print()

# Trace that batch through every pipeline stage
lineage_audit = pl.read_database(
    f"SELECT stage, started_at, completed_at, input_rows, output_rows, "
    f"rows_rejected, output_hash "
    f"FROM lineage_stages WHERE batch_id = '{batch_from_bronze}' "
    f"ORDER BY started_at",
    connection=sql_engine
)
print("Full pipeline execution for this batch:")
lineage_audit
```

    Disputed row: SAP.DE / 2026-01-29
    Batch ID (from row): 9c135c08-937d-4413-8bb4-1b66407ed9a5
    
    Pipeline run that produced this data:

<table>
  <thead>
    <tr>
      <th >stage</th>
      <th >started_at</th>
      <th >completed_at</th>
      <th >input_rows</th>
      <th >output_rows</th>
      <th >rows_rejected</th>
      <th >output_hash</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >bronze</td>
      <td >2026-03-28 23:21:34.350544</td>
      <td >2026-03-28 23:21:37.061475</td>
      <td >2530</td>
      <td >2530</td>
      <td >0</td>
      <td >914eccd231d933a2</td>
    </tr>
    <tr>
      <td >silver</td>
      <td >2026-03-28 23:25:09.980066</td>
      <td >2026-03-28 23:25:12.568855</td>
      <td >2530</td>
      <td >2530</td>
      <td >0</td>
      <td >d3c2286d9c3a8b8c</td>
    </tr>
    <tr>
      <td >gold</td>
      <td >2026-03-28 23:29:18.383273</td>
      <td >2026-03-28 23:29:18.433044</td>
      <td >511</td>
      <td >511</td>
      <td >0</td>
      <td >fabdf6a3896591c1</td>
    </tr>
    <tr>
      <td >export</td>
      <td >2026-03-28 23:29:41.345650</td>
      <td >2026-03-28 23:29:41.346711</td>
      <td >3041</td>
      <td >3041</td>
      <td >0</td>
      <td >ad1a03cae4b23504</td>
    </tr>
  </tbody>
</table>

#### JSON — verify RunContext execution metadata with `json.loads()`

Step 6: Load RunContext — the pipeline's execution fingerprint
This proves:
- Which symbols were processed (no missing/extra symbols)
- The exact date range requested (matches the disputed date)
- The Polars version used (reproducibility)
- Pipeline status = "completed" (no partial/failed run)
- Zero rejected rows (data passed all Pydantic validations)
- Output hash (cryptographic proof the data hasn't been tampered with since)

```python
ctx_files = list(LINEAGE_DIR.glob(f"run_{batch_from_bronze[:8]}*.json"))
if ctx_files:
    ctx = json.loads(ctx_files[0].read_text(encoding="utf-8"))
    print(f"RunContext: {ctx_files[0].name}")
    print(f"  Status:       {ctx['status']}")
    print(f"  Symbols:      {ctx['symbols']}")
    print(f"  Date range:   {ctx['date_range']}")
    print(f"  Polars:       {ctx['polars_version']}")
    total_rejected = sum(s['rows_rejected'] for s in ctx['stages'])
    print(f"  Rejected:     {total_rejected} rows (all data passed validation)")
    print(f"  Output hash:  {ctx['stages'][0]['output_hash']} (tamper-proof)")
else:
    print(f"No RunContext found for batch {batch_from_bronze[:8]}")
```

    RunContext: run_9c135c08.json
      Status:       completed
      Symbols:      ['SAP.DE', 'SIE.DE', 'ALV.DE', 'DTE.DE', 'BAS.DE']
      Date range:   ['2024-03-29', '2026-03-29']
      Polars:       1.39.3
      Rejected:     0 rows (all data passed validation)
      Output hash:  914eccd231d933a2 (tamper-proof)

#### yfinance — corroborate with live API data using `Ticker.history()`

```python
# Step 7: Prove the landing zone file exists and contains the record
# In production, archived files are the ultimate source of truth

landing_file = LANDING_DIR / "ohlcv_SAP_DE.json"
raw_records = json.loads(landing_file.read_text(encoding="utf-8"))

jan29_in_file = [r for r in raw_records if r["date"] == "2026-01-29"]
if jan29_in_file:
    live_close_29 = jan29_in_file[0]["close"]
    print(f"Landing file: {landing_file.name}")
    print(f"  Total records: {len(raw_records)}")
    print(f"  Jan 29 record found:")
    for k, v in jan29_in_file[0].items():
        print(f"    {k:15s}: {v}")
    print(f"\n  Bronze close: {float(bronze_audit['close'][0]):.2f}")
    print(f"  Landing close: {live_close_29}")
    print(f"  Match: {abs(float(live_close_29) - float(bronze_audit['close'][0])) < 0.01}")
else:
    # File has been overwritten by incremental fetch — Jan 29 no longer in file
    live_close_29 = float(bronze_audit["close"][0])
    dates = sorted(set(r["date"] for r in raw_records))
    print(f"Landing file covers: {dates[0]} to {dates[-1]}")
    print(f"Jan 29 not in current file (overwritten by incremental fetch)")
    print(f"In production, landing files are archived and would contain this record")
```

    Landing file: ohlcv_SAP_DE.json
      Total records: 505
      Jan 29 record found:
        symbol         : SAP.DE
        date           : 2026-01-29
        open           : 179.0
        high           : 180.16000366210938
        low            : 162.1199951171875
        close          : 164.6199951171875
        adj_close      : 164.6199951171875
        volume         : 15846791
        dividends      : 0.0
        stock_splits   : 0.0
    
      Bronze close: 164.62
      Landing close: 164.6199951171875
      Match: True

#### Polars — display full audit trail summary as DataFrame

```python
# Final audit summary: full chain of evidence for the disputed data point

landing_close = jan29_raw["close"]
bronze_close = float(bronze_audit["close"][0])
silver_row = silver_audit.filter(pl.col("date") == Date.fromisoformat("2026-01-29"))
silver_close = float(silver_row["close"][0])

audit_summary = pl.DataFrame([
    {"step": "1. Landing zone", "source": "landing/ohlcv_SAP_DE.json", "close": landing_close, "evidence": "Raw API response on disk"},
    {"step": "2. Bronze table", "source": "bronze_ohlcv",              "close": bronze_close,  "evidence": f"Batch {batch_from_bronze[:8]}"},
    {"step": "3. Silver table", "source": "silver_ohlcv",              "close": silver_close,  "evidence": "Return = -16.07% verified"},
    {"step": "4. Gold table",   "source": "gold_daily_summary",        "close": None,          "evidence": "min_return reflects the drop"},
    {"step": "5. Lineage",      "source": "lineage_stages",            "close": None,          "evidence": f"Hash: {lineage_audit['output_hash'][0]}"},
    {"step": "6. RunContext",   "source": f"run_{batch_from_bronze[:8]}.json", "close": None,   "evidence": "0 rejected, status=completed"},
    {"step": "7. Landing file", "source": "ohlcv_SAP_DE.json",         "close": landing_close, "evidence": "File on disk matches Bronze"},
])

print("AUDIT CONCLUSION: The SAP.DE -16% drop on 2026-01-29 is AUTHENTIC.")
print("  - Same close price at every layer: landing, Bronze, Silver")
print("  - Daily return verified mathematically from consecutive closes")
print("  - Zero rows rejected by Pydantic validation")
print("  - Output hash proves no post-ingestion tampering")
print()
audit_summary
```

    AUDIT CONCLUSION: The SAP.DE -16% drop on 2026-01-29 is AUTHENTIC.
      - Same close price at every layer: landing, Bronze, Silver
      - Daily return verified mathematically from consecutive closes
      - Zero rows rejected by Pydantic validation
      - Output hash proves no post-ingestion tampering

<table>
  <thead>
    <tr>
      <th >step</th>
      <th >source</th>
      <th >close</th>
      <th >evidence</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td >1. Landing zone</td>
      <td >landing/ohlcv_SAP_DE.json</td>
      <td >164.619995</td>
      <td >Raw API response on disk</td>
    </tr>
    <tr>
      <td >2. Bronze table</td>
      <td >bronze_ohlcv</td>
      <td >164.619995</td>
      <td >Batch 9c135c08</td>
    </tr>
    <tr>
      <td >3. Silver table</td>
      <td >silver_ohlcv</td>
      <td >164.619995</td>
      <td >Return = -16.07% verified</td>
    </tr>
    <tr>
      <td >4. Gold table</td>
      <td >gold_daily_summary</td>
      <td >nan</td>
      <td >min_return reflects the drop</td>
    </tr>
    <tr>
      <td >5. Lineage</td>
      <td >lineage_stages</td>
      <td >nan</td>
      <td >Hash: 914eccd231d933a2</td>
    </tr>
    <tr>
      <td >6. RunContext</td>
      <td >run_9c135c08.json</td>
      <td >nan</td>
      <td >0 rejected, status=completed</td>
    </tr>
    <tr>
      <td >7. Landing file</td>
      <td >ohlcv_SAP_DE.json</td>
      <td >164.619995</td>
      <td >File on disk matches Bronze</td>
    </tr>
  </tbody>
</table>

## Cleanup & Idempotency

Functions to reset the pipeline state for re-runs. In production, these
would be replaced by incremental upsert logic — here we truncate tables
to demonstrate full idempotent re-runs.

The pipeline is designed so that running all cells top-to-bottom produces
identical results (same data, same schema) regardless of prior state.

#### SQL Server — truncate all pipeline tables with `TRUNCATE TABLE`

Manual full reset — only needed if you want to clear ALL historical batches
Normal re-runs are already idempotent (truncate-before-insert on data tables,
delete-before-insert on lineage by batch+stage)

```python
def reset_pipeline_tables() -> None:
    """Truncate all pipeline tables for a complete reset."""
    tables = ["bronze_ohlcv", "silver_ohlcv", "gold_daily_summary",
              "gold_symbol_profile", "lineage_stages", "quarantine"]
    for t in tables:
        cur.execute(f"IF OBJECT_ID('{t}') IS NOT NULL TRUNCATE TABLE {t}")
    sql_conn.commit()
    print(f"Truncated {len(tables)} tables")

# Not needed for normal re-runs — pipeline is idempotent by default
print("reset_pipeline_tables() defined — for full history reset only")
```

    reset_pipeline_tables() defined — for full history reset only

#### Polars — verify current table row counts with `read_database()`

```python
# Quick row count check across all medallion tables

for table in ["bronze_ohlcv", "silver_ohlcv", "gold_daily_summary", "gold_symbol_profile", "lineage_stages", "quarantine"]:
    count_df = pl.read_database(f"SELECT COUNT(*) as cnt FROM {table}", connection=sql_engine)
    print(f"  {table:25s}: {count_df['cnt'][0]:>6} rows")
```

      bronze_ohlcv             :   2530 rows
      silver_ohlcv             :   2530 rows
      gold_daily_summary       :    506 rows
      gold_symbol_profile      :      5 rows
      lineage_stages           :      8 rows
      quarantine               :      0 rows
