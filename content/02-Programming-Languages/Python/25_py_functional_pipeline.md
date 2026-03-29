---
type: reference
category: programming-languages
technology: [python, polars, pydantic, fastapi, sqlserver]
tags: [python, pipeline, data-quality, lineage, polars, pydantic, fastapi, streamlit, sql-server, medallion, parquet, airflow, validation, plotly]
aliases: [functional pipeline, medallion pipeline, data lineage, pydantic validation]
keywords: [pipeline, medallion, bronze, silver, gold, pydantic, validation, lineage, fastapi, streamlit, plotly, airflow, parquet]
description: "End-to-end functional data pipeline with Pydantic validation, lineage tracking, Parquet export, FastAPI serving, and Plotly visualization. See [[25_cs_functional_pipeline]] for the C# equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[25_cs_functional_pipeline]]"
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
> **Landing zone** — API responses are first written to JSON files before database ingestion. This decouples fetching from loading: if the write fails, data is still on disk. If the pipeline is replayed, it reads from files without re-calling the API. In production, these files would be archived in immutable storage (GCS with object versioning and retention policies).
>
> **Validation** — Every stage boundary is guarded by a **Pydantic v2** model enforcing types, value ranges, and business rules (e.g., `high >= low`). Rows that fail are persisted to a **quarantine table** (dead letter queue) with the full error message, enabling investigation and replay.
>
> **Quality gates** — After Bronze and Silver, automated assertions check structural integrity (no nulls, no duplicates), statistical bounds (daily return within +-50%, intraday range within 50%), data freshness (most recent date within 5 days), and minimum row counts. Failures stop the pipeline before bad data propagates.
>
> **Dimension tables** — A **symbol dimension** uses [[data-modeling-patterns|SCD Type 2]] historization for point-in-time queries. A **trading calendar** dimension built from `pandas-market-calendars` provides per-exchange trading day flags with holiday detection.
>
> **Lineage** — Every row carries a `batch_id`. Each stage records timing, row counts, rejection counts, and a **SHA-256 hash** of its output. A `RunContext` JSON captures full execution metadata. Given any disputed data point, trace it from Gold back to the raw landing file with cryptographic proof.
>
> **Serving** — Gold data is exported to **Parquet** files that **FastAPI** reads directly (no database at serving time). A **Streamlit** dashboard consumes the API.
>
> **Orchestration** — An [[airflow-dag-patterns|Airflow 3.x]] DAG defines 10 tasks with retry policies (3 attempts, exponential backoff) on a Mon-Fri 18:30 UTC schedule. Runs in Docker with the pipeline code mounted as a volume.
>
> **Reliability** — API calls use **tenacity** retry logic. Bronze and Silver use **MERGE upsert** for idempotent re-runs. Gold is truncated and rebuilt from Silver on every run. Structured **logging** replaces print statements.

> [!info]- Pipeline Dependencies
>
> Standard library for hashing, logging, concurrency. Polars for DataFrames, yfinance for market data, Pydantic for validation, tenacity for retry, pyodbc/SQLAlchemy for SQL Server, FastAPI for serving, Plotly for visualization.

```python
# Standard library
import hashlib, importlib.util, logging, json, os
import subprocess, threading, time, uuid
from datetime import datetime, timezone, date as Date, timedelta
from pathlib import Path
from urllib.parse import quote_plus
```

```python
# Data, validation, database, serving, visualization
import polars as pl
import yfinance as yf
import pandas_market_calendars as mcal
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict
import pyodbc
from sqlalchemy import create_engine, text
from fastapi import FastAPI, HTTPException
import uvicorn, httpx
import plotly.graph_objects as go
from IPython.display import display, HTML
```

---

## Configuration & Constants

#### Python — define pipeline paths, SQL connection, and stock universe

```python
# Central configuration cell
DATA_DIR    = Path(r"C:\Users\aperi\DEV\LANG\data")
EXPORT_DIR  = DATA_DIR / "pipeline"
LINEAGE_DIR = EXPORT_DIR / "lineage"
LANDING_DIR = DATA_DIR / "pipeline" / "landing"
EXPORT_DIR.mkdir(parents=True, exist_ok=True)
LANDING_DIR.mkdir(parents=True, exist_ok=True)
LINEAGE_DIR.mkdir(parents=True, exist_ok=True)
```

```python
# SQL Server (local Docker instance)
SQL_CONN_STR = (
    "Driver={ODBC Driver 18 for SQL Server};"
    "Server=localhost,1434;Database=stoxx;"
    "UID=sa;PWD=EsgDev2026Pass1;"
    "Encrypt=yes;TrustServerCertificate=yes;"
)
sql_engine = create_engine(
    f"mssql+pyodbc:///?odbc_connect={quote_plus(SQL_CONN_STR)}"
)
```

```python
# Stock universe — 5 EURO STOXX 50 components for demo
SYMBOLS = ["SAP.DE", "SIE.DE", "ALV.DE", "DTE.DE", "BAS.DE"]
LOOKBACK_DAYS = 365 * 2
START_DATE = (Date.today() - timedelta(days=LOOKBACK_DAYS)).isoformat()
END_DATE   = Date.today().isoformat()
```

```python
# Exchange mapping: yfinance exchange code → mcal calendar name
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
```

    Pipeline config loaded
      Export dir:  C:\Users\aperi\DEV\LANG\data\pipeline
      Universe:    ['SAP.DE', 'SIE.DE', 'ALV.DE', 'DTE.DE', 'BAS.DE']
      Date range:  2024-03-29 → 2026-03-29

---

## Pydantic DTOs

> [!info] Schema Validation per Boundary
>
> - `RawOHLCV` — validates yfinance output (Bronze boundary)
> - `CleanOHLCV` — validates cleaned/enriched data (Silver boundary)
> - `DailySummary` / `SymbolProfile` — validates aggregated data (Gold boundary)
> - `StageLineage` — tracks what each pipeline stage produced
> - `RunContext` — captures full pipeline execution metadata

#### Pydantic — define Bronze validation model with `BaseModel` and `Field()`

> [!info] Bronze Ingestion Validation
>
> Validates raw yfinance data before Bronze persistence. Enforces types, ranges, and business rules at ingestion boundary.

```python
class RawOHLCV(BaseModel):
    """Schema for raw OHLCV data from yfinance."""
    model_config = ConfigDict(strict=True)

    symbol:       str   = Field(..., min_length=1)
    date:         Date  = Field(...)
    open:         float = Field(..., gt=0)
    high:         float = Field(..., gt=0)
    low:          float = Field(..., gt=0)
    close:        float = Field(..., gt=0)
    adj_close:    float = Field(..., gt=0)
    volume:       int   = Field(..., ge=0)
    dividends:    float = Field(default=0.0, ge=0)
    stock_splits: float = Field(default=0.0, ge=0)
```

```python
    @model_validator(mode="after")
    def high_ge_low(self):
        """Business rule: high must be >= low."""
        if self.high < self.low:
            raise ValueError(f"high ({self.high}) < low ({self.low})")
        return self
```

    RawOHLCV validated: SAP.DE 2024-01-02 close=145.2

#### Pydantic — define Silver validation model with `BaseModel` and `Field()`

> [!info] Silver Enrichment Validation
>
> Extends Bronze with computed fields: `daily_return`, `intraday_range`, `is_filled`. Validates enrichment transforms at the Silver boundary.

```python
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
    daily_return:   float = Field(...)
    intraday_range: float = Field(..., ge=0)
    sma_20:         float | None = Field(default=None)
    batch_id:       str   = Field(...)
```

    CleanOHLCV model defined — 14 fields

#### Pydantic — define Gold validation models with `BaseModel` and `Field()`

> [!info] Gold Mart Validation Models
>
> `DailySummary` (cross-sectional daily metrics across all symbols) and `SymbolProfile` (per-symbol summary statistics over full history).

```python
class DailySummary(BaseModel):
    """Daily cross-sectional summary — Gold mart."""
    date:             Date  = Field(...)
    symbols_traded:   int   = Field(..., ge=0)
    avg_return:       float = Field(...)
    max_return:       float = Field(...)
    min_return:       float = Field(...)
    total_volume:     int   = Field(..., ge=0)
    avg_intraday_pct: float = Field(..., ge=0)
    batch_id:         str   = Field(...)
```

```python
class SymbolProfile(BaseModel):
    """Per-symbol summary statistics — Gold mart."""
    symbol:              str   = Field(..., min_length=1)
    total_trading_days:  int   = Field(..., ge=0)
    avg_daily_return:    float = Field(...)
    volatility:          float = Field(..., ge=0)
    max_drawdown:        float = Field(..., le=0)
    avg_volume:          float = Field(..., ge=0)
    total_dividends:     float = Field(default=0.0, ge=0)
    first_date:          Date  = Field(...)
    last_date:           Date  = Field(...)
    batch_id:            str   = Field(...)
```

    DailySummary:  8 fields
    SymbolProfile: 10 fields

#### Pydantic — define lineage tracking models with `BaseModel` and `Field()`

> [!info] Lineage Tracking Models
>
> `StageLineage` records what each stage produced (row counts, hashes, timing). `RunContext` captures the full execution environment for reproducibility.

```python
class StageLineage(BaseModel):
    """Records what a single pipeline stage produced."""
    batch_id:       str      = Field(...)
    stage:          str      = Field(...)
    started_at:     datetime = Field(...)
    completed_at:   datetime = Field(...)
    input_rows:     int      = Field(..., ge=0)
    output_rows:    int      = Field(..., ge=0)
    rows_rejected:  int      = Field(default=0, ge=0)
    output_hash:    str      = Field(...)

    @property
    def duration_ms(self) -> float:
        return (self.completed_at - self.started_at).total_seconds() * 1000
```

```python
class RunContext(BaseModel):
    """Full pipeline execution metadata."""
    batch_id:       str            = Field(...)
    started_at:     datetime       = Field(...)
    completed_at:   datetime | None = Field(default=None)
    symbols:        list[str]      = Field(...)
    date_range:     tuple[str, str] = Field(...)
    polars_version: str            = Field(default=pl.__version__)
    stages:         list[StageLineage] = Field(default_factory=list)
    status:         str            = Field(default="running")
```

    StageLineage: 8 fields
    RunContext:   8 fields

---

## Lineage & Context Infrastructure

> [!info] Pure functions for lineage tracking
>
> - Every pipeline stage calls `start_stage()` before processing and `end_stage()` after, producing a `StageLineage` record
> - The `RunContext` aggregates all stage records and is persisted to JSON at the end of each run
> - `compute_hash()` produces a deterministic SHA-256 of any DataFrame, enabling drift detection: if the same inputs produce a different hash, something changed

#### uuid — generate unique batch ID with `uuid4()`

```python
def generate_batch_id() -> str:
    """Generate a unique batch identifier for this pipeline run."""
    return str(uuid.uuid4())
```

    Sample batch_id: 9e43b0c5-a388-4ec8-ad76-bcde6e97d37e

#### hashlib — compute deterministic DataFrame hash with `sha256()`

```python
def compute_hash(df: pl.DataFrame) -> str:
    """SHA-256 hash of DataFrame content for drift detection."""
    csv_bytes = df.sort(df.columns).write_csv().encode("utf-8")
    return hashlib.sha256(csv_bytes).hexdigest()[:16]
```

    Hash of demo frame: f67a232f1bb81bfa

#### Python — define stage start and end tracker with `datetime.now()`

```python
def start_stage(batch_id: str, stage: str, input_rows: int) -> dict:
    """Begin tracking a pipeline stage. Returns a context dict."""
    return {
        "batch_id": batch_id,
        "stage": stage,
        "started_at": datetime.now(timezone.utc),
        "input_rows": input_rows,
    }
```

```python
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
```

#### Pydantic — save run context to JSON with `model_dump_json()`

```python
def save_run_context(ctx: RunContext) -> Path:
    """Serialize RunContext to JSON file in lineage directory."""
    path = LINEAGE_DIR / f"run_{ctx.batch_id[:8]}.json"
    path.write_text(ctx.model_dump_json(indent=2), encoding="utf-8")
    return path
```

---

## SQL Server Schema

> [!info] Medallion architecture mapped to SQL Server tables
>
> - `bronze_ohlcv` — raw data exactly as received from yfinance
> - `silver_ohlcv` — cleaned and enriched with computed columns
> - `gold_daily_summary` / `gold_symbol_profile` — aggregated marts
> - `lineage_stages` — pipeline execution metadata
> - `quarantine` — dead letter queue for rejected rows
>
> Each table includes a `batch_id` column linking every row to the pipeline run that produced it.

#### SQL Server — create Bronze OHLCV table with `cursor.execute()`

> [!info] Bronze Table DDL
>
> Stores raw yfinance output exactly as received, no transforms. `UNIQUE` constraint on `(symbol, date)` enables MERGE upsert for incremental loads.

```python
cur.execute("""
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES
               WHERE TABLE_NAME = 'bronze_ohlcv')
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
```

#### SQL Server — create Silver OHLCV table with `cursor.execute()`

> [!info] Silver Table DDL
>
> Adds computed columns: `daily_return`, `intraday_range`, `sma_20`. Clustered index on `(symbol, date)` for efficient range scans.

```python
cur.execute("""
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES
               WHERE TABLE_NAME = 'silver_ohlcv')
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
```

#### SQL Server — create Gold daily summary table with `cursor.execute()`

> [!info] Gold Daily Summary DDL
>
> One row per trading day. Clustered on `date` for efficient date-range scans.

```python
cur.execute("""
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES
               WHERE TABLE_NAME = 'gold_daily_summary')
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
```

#### SQL Server — create Gold symbol profile table with `cursor.execute()`

> [!info] Gold Symbol Profile DDL
>
> One row per symbol with aggregate statistics. Clustered on `symbol` for efficient lookups.

```python
cur.execute("""
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES
               WHERE TABLE_NAME = 'gold_symbol_profile')
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
```

#### SQL Server — create SCD Type 2 symbol dimension with `cursor.execute()`

> [!info] SCD Type 2 Dimension DDL
>
> Tracks historical changes in symbol metadata. `valid_from`/`valid_to`/`is_current` enable point-in-time queries.

```python
cur.execute("""
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES
               WHERE TABLE_NAME = 'dim_symbol')
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
    valid_from              DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    valid_to                DATETIME2     NULL,
    is_current              BIT           NOT NULL DEFAULT 1
)
""")
```

#### SQL Server — create per-exchange trading calendar with `cursor.execute()`

> [!info] Trading Calendar Dimension DDL
>
> Composite PK on `(date, exchange_code)` — one row per date per exchange. Aligned with `stoxx.bronze.trading_calendar` schema.

```python
cur.execute("""
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES
               WHERE TABLE_NAME = 'dim_calendar')
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
```

#### SQL Server — create lineage tracking table with `cursor.execute()`

> [!info] Lineage Table DDL
>
> Persists `StageLineage` records to SQL Server alongside the data. Enables querying pipeline history: which batch produced what, when, how many rows.

```python
cur.execute("""
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES
               WHERE TABLE_NAME = 'lineage_stages')
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
```

#### SQL Server — create quarantine table for rejected rows with `cursor.execute()`

> [!info] Quarantine Table DDL
>
> Dead letter queue: stores every row that failed Pydantic validation. Preserves the raw data + rejection reason for investigation and replay.

```python
cur.execute("""
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES
               WHERE TABLE_NAME = 'quarantine')
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
```

#### SQL Server — define lineage persistence helper with `cursor.execute()`

> [!info] Idempotent Lineage Persistence
>
> Inserts a validated `StageLineage` into the `lineage_stages` table. Deletes any existing record for the same batch+stage first (idempotent).

```python
def persist_lineage(lineage: StageLineage) -> None:
    """Write a StageLineage record to SQL Server (idempotent)."""
    cur.execute(
        "DELETE FROM lineage_stages WHERE batch_id = ? AND stage = ?",
        lineage.batch_id, lineage.stage
    )
    cur.execute(
        """INSERT INTO lineage_stages
           (batch_id, stage, started_at, completed_at,
            input_rows, output_rows, rows_rejected, output_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        lineage.batch_id, lineage.stage,
        lineage.started_at, lineage.completed_at,
        lineage.input_rows, lineage.output_rows,
        lineage.rows_rejected, lineage.output_hash
    )
    sql_conn.commit()
```

#### SQLAlchemy — define DataFrame write helper with `to_sql()`

> [!warning] SQL Server 2100 Parameter Limit
>
> `chunksize=100` avoids the 2100 parameter limit (rows x cols < 2100). `truncate=True` wipes the table before insert (used by Gold tables only).

```python
def write_to_sql(df: pl.DataFrame, table: str, truncate: bool = True) -> int:
    """Write a Polars DataFrame to SQL Server."""
    if truncate:
        cur.execute(f"TRUNCATE TABLE {table}")
        sql_conn.commit()
    pdf = df.to_pandas()
    pdf.to_sql(table, sql_engine, if_exists="append", index=False, chunksize=100)
    return len(pdf)
```

#### SQL Server — define Bronze MERGE upsert with `MERGE INTO`

> [!info] Bronze MERGE Upsert
>
> Updates existing rows, inserts new ones. Key: `(symbol, date)` — no duplicates, safe to re-run.

```python
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
                adj_close = ?, volume = ?, dividends = ?,
                stock_splits = ?, batch_id = ?,
                ingested_at = GETUTCDATE()
            WHEN NOT MATCHED THEN INSERT
                (symbol, date, [open], high, low, [close],
                 adj_close, volume, dividends, stock_splits,
                 batch_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, ...)
        rows_affected += cur.rowcount
    sql_conn.commit()
    return rows_affected
```

#### SQL Server — define Silver MERGE upsert with `MERGE INTO`

> [!info] Silver MERGE Upsert
>
> Includes enrichment columns (`daily_return`, `sma_20`, etc.). Key: `(symbol, date)`.

```python
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
                adj_close = ?, volume = ?, dividends = ?,
                stock_splits = ?, daily_return = ?,
                intraday_range = ?, sma_20 = ?,
                batch_id = ?, processed_at = GETUTCDATE()
            WHEN NOT MATCHED THEN INSERT
                (symbol, date, [open], high, low, [close],
                 adj_close, volume, dividends, stock_splits,
                 daily_return, intraday_range, sma_20, batch_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?);
        """, ...)
        rows_affected += cur.rowcount
    sql_conn.commit()
    return rows_affected
```

#### SQL Server — define quarantine persistence helper with `cursor.execute()`

> [!info] Quarantine Dead Letter Queue
>
> Persists a rejected row to the quarantine table with its error message. Called by `validate_bronze()` and `validate_silver()` when Pydantic validation fails.

```python
def quarantine_row(batch_id: str, stage: str, row_data: dict, error: str) -> None:
    """Save a rejected row to the quarantine table."""
    cur.execute(
        """INSERT INTO quarantine
           (batch_id, stage, symbol, date, raw_data, error_message)
           VALUES (?, ?, ?, ?, ?, ?)""",
        batch_id, stage,
        row_data.get("symbol"), row_data.get("date"),
        json.dumps(row_data, default=str), str(error)[:4000],
    )
    sql_conn.commit()
```

#### tenacity — define API retry wrapper with `@retry()` exponential backoff

> [!info] API Retry with Backoff
>
> 3 attempts, exponential backoff. Catches network errors and transient failures without killing the pipeline.

```python
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    retry=retry_if_exception_type((ConnectionError, TimeoutError, OSError)),
    before_sleep=lambda rs: log.warning(f"Retry {rs.attempt_number}/3, waiting..."),
)
def fetch_with_retry(ticker, start: str, end: str):
    """Fetch ticker history with automatic retry."""
    return ticker.history(start=start, end=end, auto_adjust=False)
```

#### Python — define custom `Exception` subclass for quality gate failures

```python
class DataQualityError(Exception):
    """Raised when a data quality gate fails."""
    pass
```

#### Polars — assert DataFrame is not empty with `len()`

```python
def dq_check_not_empty(df: pl.DataFrame, stage: str) -> tuple[bool, str]:
    ok = len(df) > 0
    return ok, f"{stage}: {len(df)} rows" if ok else f"{stage}: EMPTY DataFrame"
```

#### Polars — assert no nulls in key columns with `null_count()`

```python
def dq_check_no_null_keys(df: pl.DataFrame, keys: list[str], stage: str) -> tuple[bool, str]:
    for col in keys:
        if col not in df.columns:
            return False, f"{stage}: column '{col}' missing"
        nulls = df[col].null_count()
        if nulls > 0:
            return False, f"{stage}: {nulls} nulls in '{col}'"
    return True, f"{stage}: no null keys in {keys}"
```

#### Polars — assert no duplicate rows with `unique()`

```python
def dq_check_no_duplicates(df: pl.DataFrame, keys: list[str], stage: str) -> tuple[bool, str]:
    total = len(df)
    unique = df.select(keys).unique().height
    dupes = total - unique
    ok = dupes == 0
    return ok, f"{stage}: {dupes} duplicates on {keys}" if not ok else f"{stage}: no duplicates"
```

#### Polars — assert values within range with `filter()`

```python
def dq_check_range(df: pl.DataFrame, col: str, min_val: float, max_val: float, stage: str) -> tuple[bool, str]:
    out_of_range = df.filter(
        (pl.col(col) < min_val) | (pl.col(col) > max_val)
    ).height
    ok = out_of_range == 0
    return ok, (f"{stage}: {out_of_range} values outside [{min_val}, {max_val}] in '{col}'"
                if not ok else f"{stage}: '{col}' within range")
```

#### Polars — assert data freshness against SLA with `max()`

```python
def dq_check_freshness(df: pl.DataFrame, date_col: str, max_age_days: int, stage: str) -> tuple[bool, str]:
    latest_raw = df[date_col].max()
    latest = Date.fromisoformat(str(latest_raw)) if not isinstance(latest_raw, Date) else latest_raw
    age = (Date.today() - latest).days
    ok = age <= max_age_days
    return ok, f"{stage}: latest date {latest} ({age}d ago)" + ("" if ok else f" EXCEEDS {max_age_days}d SLA")
```

#### Polars — assert minimum row count with `len()`

```python
def dq_check_row_count(df: pl.DataFrame, min_rows: int, stage: str) -> tuple[bool, str]:
    ok = len(df) >= min_rows
    return ok, f"{stage}: {len(df)} rows" + ("" if ok else f" BELOW minimum {min_rows}")
```

#### Pipeline — run all quality gate assertions with `log.info()`

> [!info] Quality Gate Runner
>
> Runs all quality checks for a stage, logs PASS/FAIL for each. Raises `DataQualityError` if any check fails (when `fail_fast=True`). Returns results as a DataFrame for display.

```python
def run_quality_gate(checks: list[tuple[bool, str]], stage: str, fail_fast: bool = True) -> pl.DataFrame:
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
```

---

## Dimension Tables

> [!info] Two reference dimensions that enrich the pipeline
>
> - **dim_symbol** — company metadata from yfinance with **SCD Type 2** historization. When an attribute changes, the old record is closed (`valid_to` set, `is_current = 0`) and a new record is inserted. Enables point-in-time queries.
> - **dim_calendar** — per-exchange trading calendar. Each row is a `(date, exchange_code)` pair with flags: `is_trading_day`, `is_month_end`, `is_quarter_end`. Built from `pandas-market-calendars`.

#### yfinance — fetch symbol metadata to JSON landing zone with `Ticker.info`

```python
def fetch_symbols_to_landing(symbols: list[str]) -> Path:
    """Fetch metadata from yfinance and save to JSON landing zone."""
    records = []
    for symbol in symbols:
        ticker = yf.Ticker(symbol)
        info = ticker.info or {}
        rec = {
            "symbol": symbol,
            "longName": info.get("longName"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "country": info.get("country"),
            "exchange": info.get("exchange"),
            "currency": info.get("currency"),
            "marketCap": info.get("marketCap"),
            # ... additional fields
        }
        records.append(rec)
    landing_path = LANDING_DIR / "dim_symbol.json"
    landing_path.write_text(json.dumps(records, indent=2, default=str))
    return landing_path
```

#### JSON — load symbol metadata from landing zone with `json.loads()`

```python
def load_symbols_from_landing() -> list[dict]:
    """Read symbol metadata from JSON landing zone."""
    landing_path = LANDING_DIR / "dim_symbol.json"
    return json.loads(landing_path.read_text(encoding="utf-8"))
```

#### SQL Server — define SCD Type 2 upsert for one symbol with `MERGE INTO`

> [!info] SCD Type 2 Upsert Logic
>
> New symbol gets INSERT, unchanged attributes get skipped, changed attributes close old record and INSERT new version.

```python
def scd2_upsert_symbol(rec: dict) -> str:
    """SCD Type 2 upsert for one symbol. Returns action taken."""
    cur.execute(
        "SELECT id, company_name, sector, industry, country, exchange, currency "
        "FROM dim_symbol WHERE symbol = ? AND is_current = 1",
        db_rec["symbol"]
    )
    existing = cur.fetchone()

    if existing is None:
        # INSERT fresh record
        cur.execute("INSERT INTO dim_symbol (...) VALUES (...)")
        return "INSERT"

    # Compare tracked columns
    if old_vals == new_vals:
        return "UNCHANGED"

    # Attribute changed: close old, insert new
    cur.execute("UPDATE dim_symbol SET valid_to = SYSUTCDATETIME(), is_current = 0 WHERE id = ?", existing[0])
    cur.execute("INSERT INTO dim_symbol (...) VALUES (...)")
    return "SCD2_UPDATE"
```

#### SQL Server — orchestrate SCD Type 2 upsert for all symbols with `cursor.execute()`

```python
def populate_dim_symbol_from_landing() -> pl.DataFrame:
    """Load from landing JSON and apply SCD Type 2 upsert."""
    records = load_symbols_from_landing()
    results = []
    for rec in records:
        action = scd2_upsert_symbol(rec)
        rec["_action"] = action
        results.append(rec)
    return pl.DataFrame(results)
```

#### SQL Server — load symbols from landing and SCD2 upsert with `MERGE INTO`

```python
# Step 1: Fetch from yfinance API → JSON landing zone
fetch_symbols_to_landing(SYMBOLS)

# Step 2: Load from landing JSON → SCD2 upsert into dim_symbol
dim_symbol_df = populate_dim_symbol_from_landing()
dim_symbol_df.select("symbol", "longName", "sector", "country", "exchange", "_action")
```

    SAP.DE: fetched (SAP SE)
    SIE.DE: fetched (Siemens Aktiengesellschaft)
    ALV.DE: fetched (Allianz SE)
    DTE.DE: fetched (Deutsche Telekom AG)
    BAS.DE: fetched (BASF SE)

| symbol | longName | sector | country | exchange | _action |
|--------|----------|--------|---------|----------|---------|
| SAP.DE | SAP SE | Technology | Germany | GER | UNCHANGED |
| SIE.DE | Siemens Aktiengesellschaft | Industrials | Germany | GER | UNCHANGED |
| ALV.DE | Allianz SE | Financial Services | Germany | GER | UNCHANGED |
| DTE.DE | Deutsche Telekom AG | Communication Services | Germany | GER | UNCHANGED |
| BAS.DE | BASF SE | Basic Materials | Germany | GER | UNCHANGED |

#### pandas-market-calendars — generate trading calendar with `get_calendar().schedule()`

> [!info] Exchange-Specific Trading Calendar
>
> Uses `pandas-market-calendars` to get accurate trading days per exchange. Each exchange has its own holiday schedule (e.g., XETR has German holidays). Builds a `(date, exchange_code)` grid with precise `is_trading_day` flags.

```python
def generate_dim_calendar(start: str, end: str, exchange_codes: list[str]) -> pl.DataFrame:
    for yf_code in exchange_codes:
        mcal_name = EXCHANGE_MAP.get(yf_code, yf_code)
        cal = mcal.get_calendar(mcal_name)
        schedule = cal.schedule(start_date=start, end_date=end)
        trading_dates = {d.date() for d in schedule.index}
        # Build full date range with flags
        all_dates = pl.date_range(Date.fromisoformat(start), Date.fromisoformat(end), eager=True)
        df = pl.DataFrame({"date": all_dates}).with_columns(
            pl.col("date").is_in(trading_list).cast(pl.Int8).alias("is_trading_day"),
            # ... year, quarter, month, week_of_year, day_of_week
        )
    return pl.concat(frames).sort(["exchange_code", "date"])
```

    Building calendar for exchanges: ['GER']
      GER (XETR): 505 trading days, 226 non-trading
    Calendar total: 731 rows

#### SQL Server — persist calendar dimension with `MERGE INTO`

```python
def persist_dim_calendar(cal_df: pl.DataFrame) -> int:
    """MERGE upsert calendar dimension into SQL Server."""
    for row in cal_df.iter_rows(named=True):
        cur.execute("""
            MERGE dim_calendar AS tgt
            USING (SELECT ? AS date, ? AS exchange_code) AS src
               ON tgt.date = src.date AND tgt.exchange_code = src.exchange_code
            WHEN MATCHED THEN UPDATE SET ...
            WHEN NOT MATCHED THEN INSERT ...;
        """, ...)
    sql_conn.commit()
```

    dim_calendar: 731 rows upserted

#### Polars — display detected exchange holidays with `filter()`

```python
holidays = cal_df.filter(
    (pl.col("day_of_week").is_between(1, 5)) &
    (pl.col("is_trading_day") == 0)
).select("date", "exchange_code", "day_of_week").sort("exchange_code", "date")
```

    Holidays detected: 16 (weekdays with no trading)

| date | exchange_code | day_of_week |
|------|---------------|-------------|
| 2024-03-29 | GER | 5 |
| 2024-04-01 | GER | 1 |
| 2024-05-01 | GER | 3 |
| 2024-12-24 | GER | 2 |
| 2024-12-25 | GER | 3 |

---

## Bronze Layer

> [!info] Landing zone pattern
>
> - **Fetch** — download OHLCV data from yfinance to JSON files in `landing/`
> - **Validate** — parse JSON through Pydantic `RawOHLCV` model
> - **Load** — MERGE upsert validated data into `bronze_ohlcv`
>
> This decouples API calls from SQL ingestion: re-run the SQL load without re-fetching (replay from landing files), raw JSON files show exactly what the API returned, and incremental loads only fetch new data since last known date per symbol.

#### yfinance — fetch OHLCV to JSON landing zone with `Ticker.history()`

> [!info] Landing Zone Fetch Pattern
>
> Downloads OHLCV data from yfinance and saves to `landing/ohlcv_{symbol}.json`. Each symbol gets its own JSON file with raw API response. Uses `fetch_with_retry()` for transient failure handling.

```python
def fetch_ohlcv_to_landing(symbol: str, start: str, end: str) -> Path | None:
    """Download OHLCV data from yfinance and save to JSON landing zone."""
    ticker = yf.Ticker(symbol)
    pdf = fetch_with_retry(ticker, start, end)
    if pdf.empty:
        return None
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
        })
    safe_symbol = symbol.replace(".", "_")
    landing_path = LANDING_DIR / f"ohlcv_{safe_symbol}.json"
    landing_path.write_text(json.dumps(records, indent=2))
    return landing_path
```

#### Polars — load OHLCV from JSON landing zone with `pl.DataFrame()`

```python
def load_ohlcv_from_landing(symbol: str) -> pl.DataFrame:
    """Read OHLCV data from JSON landing zone into Polars DataFrame."""
    safe_symbol = symbol.replace(".", "_")
    landing_path = LANDING_DIR / f"ohlcv_{safe_symbol}.json"
    if not landing_path.exists():
        return pl.DataFrame()
    records = json.loads(landing_path.read_text(encoding="utf-8"))
    df = pl.DataFrame(records)
    df = df.with_columns(pl.col("date").str.to_date("%Y-%m-%d"))
    return df
```

#### yfinance — test single symbol landing zone fetch with `fetch_ohlcv_to_landing()`

```python
test_path = fetch_ohlcv_to_landing("SAP.DE", "2024-06-01", "2024-06-30")
test_df = load_ohlcv_from_landing("SAP.DE")
```

    Landed: ohlcv_SAP_DE.json (5.8 KB)
    Loaded: 20 rows, columns: ['symbol', 'date', 'open', 'high', 'low', 'close', 'adj_close', 'volume', 'dividends', 'stock_splits']

#### Pydantic — validate Bronze rows with `BaseModel()` row-level check

> [!info] Row-Level Pydantic Validation
>
> Validates each row through `RawOHLCV` Pydantic model. Valid rows are collected; rejected rows go to quarantine table with error details.

```python
def validate_bronze(df: pl.DataFrame, batch_id: str = "") -> tuple[pl.DataFrame, int]:
    """Validate each row through RawOHLCV. Quarantines rejected rows."""
    valid_rows = []
    rejected = 0
    for row in df.iter_rows(named=True):
        try:
            record = RawOHLCV(**row)
            valid_rows.append(record.model_dump())
        except Exception as e:
            rejected += 1
            if batch_id:
                quarantine_row(batch_id, "bronze", dict(row), str(e))
    return pl.DataFrame(valid_rows), rejected
```

#### Pydantic — test Bronze validation on sample data

```python
valid_df, rejected = validate_bronze(test_df, batch_id="test")
```

    Valid: 20 rows | Rejected: 0 rows

#### Bronze — define incremental ingestion pipeline with landing zone + `MERGE INTO`

> [!info] Bronze Incremental Pipeline
>
> Checks last known date per symbol, fetches only new data to JSON landing zone, validates through Pydantic, and MERGE upserts into `bronze_ohlcv`. Returns the FULL bronze dataset from SQL for downstream stages.

```python
def ingest_bronze(symbols: list[str], start: str, end: str, batch_id: str) -> tuple[pl.DataFrame, StageLineage]:
    """Incrementally fetch to landing zone, validate, and MERGE upsert."""
    stage_ctx = start_stage(batch_id, "bronze", input_rows=0)
    for symbol in symbols:
        cur.execute("SELECT MAX(date) FROM bronze_ohlcv WHERE symbol = ?", symbol)
        last_date = cur.fetchone()[0]
        fetch_start = (last_date + timedelta(days=1)).isoformat() if last_date else start
        landing_path = fetch_ohlcv_to_landing(symbol, fetch_start, end)
        raw_df = load_ohlcv_from_landing(symbol)
        valid_df, rejected = validate_bronze(raw_df, batch_id)
        merged = merge_bronze(valid_df, batch_id)
    lineage = end_stage(stage_ctx, new_df, total_rejected)
    persist_lineage(lineage)
    # Return FULL bronze dataset
    bronze_full = pl.read_database("SELECT ... FROM bronze_ohlcv", connection=sql_engine)
    return bronze_full, lineage
```

#### Bronze — execute incremental ingestion for all symbols

```python
batch_id = generate_batch_id()
t0 = time.time()
bronze_df, bronze_lineage = ingest_bronze(SYMBOLS, START_DATE, END_DATE, batch_id)
elapsed = (time.time() - t0) * 1000
```

    Pipeline batch_id: bc9d3a23...
    Fetching 5 symbols, range 2024-03-29 → 2026-03-29
    (incremental: only new data since last ingestion)
    SAP.DE: 1 landed (0.3 KB), 1 valid, 0 rejected, 1 merged
    SIE.DE: 1 landed (0.3 KB), 1 valid, 0 rejected, 1 merged
    ALV.DE: 1 landed (0.3 KB), 1 valid, 0 rejected, 1 merged
    DTE.DE: 1 landed (0.3 KB), 1 valid, 0 rejected, 1 merged
    BAS.DE: 1 landed (0.3 KB), 1 valid, 0 rejected, 1 merged
    Bronze complete: 2530 total rows in 744ms
    Output hash: bf7713401ce6f144

#### Polars — display Bronze row counts per symbol with `group_by().agg()`

```python
bronze_df.group_by("symbol").agg(
    pl.col("date").count().alias("rows"),
    pl.col("date").min().alias("first_date"),
    pl.col("date").max().alias("last_date"),
).sort("symbol")
```

| symbol | rows | first_date | last_date |
|--------|------|------------|-----------|
| ALV.DE | 506 | 2024-03-28 | 2026-03-27 |
| BAS.DE | 506 | 2024-03-28 | 2026-03-27 |
| DTE.DE | 506 | 2024-03-28 | 2026-03-27 |
| SAP.DE | 506 | 2024-03-28 | 2026-03-27 |
| SIE.DE | 506 | 2024-03-28 | 2026-03-27 |

#### Pipeline — run Bronze data quality gate with `run_quality_gate()`

```python
bronze_dq = run_quality_gate([
    dq_check_not_empty(bronze_df, "bronze"),
    dq_check_no_null_keys(bronze_df, ["symbol", "date"], "bronze"),
    dq_check_no_duplicates(bronze_df, ["symbol", "date"], "bronze"),
    dq_check_range(bronze_df, "close", 0.01, 100_000, "bronze"),
    dq_check_range(bronze_df, "volume", 0, 10_000_000_000, "bronze"),
    dq_check_freshness(bronze_df, "date", 5, "bronze"),
    dq_check_row_count(bronze_df, len(SYMBOLS) * 200, "bronze"),
], stage="bronze")
```

    DQ PASS: bronze: 2530 rows
    DQ PASS: bronze: no null keys in ['symbol', 'date']
    DQ PASS: bronze: no duplicates
    DQ PASS: bronze: 'close' within range
    DQ PASS: bronze: 'volume' within range
    DQ PASS: bronze: latest date 2026-03-27 (2d ago)
    DQ PASS: bronze: 2530 rows

---

## Silver Layer

> [!info] Silver enrichment transforms
>
> - **daily_return** — close-to-close percentage return
> - **intraday_range** — (high - low) / close as percentage
> - **sma_20** — 20-day simple moving average of close price
>
> All transforms are pure Polars expressions using `with_columns()` and `rolling_mean()`. The Silver output is validated row-by-row through the `CleanOHLCV` Pydantic model before persistence.
>
> Key design: transforms are pure functions (DataFrame in -> DataFrame out), infrastructure (SQL write, lineage) is handled separately.

#### Polars — compute daily returns with `pct_change().over()`

```python
def compute_daily_returns(df: pl.DataFrame) -> pl.DataFrame:
    """Add daily_return column: close-to-close % change per symbol."""
    return df.sort(["symbol", "date"]).with_columns(
        pl.col("close")
          .pct_change()
          .over("symbol")
          .fill_null(0.0)
          .round(6)
          .alias("daily_return")
    )
```

| symbol | date | close | daily_return |
|--------|------|-------|-------------|
| SAP.DE | 2024-03-28 | 180.460007 | 0.0 |
| SAP.DE | 2024-04-02 | 177.059998 | -0.018841 |
| SAP.DE | 2024-04-03 | 178.220001 | 0.006551 |
| SAP.DE | 2024-04-04 | 178.020004 | -0.001122 |
| SAP.DE | 2024-04-05 | 177.419998 | -0.00337 |

#### Polars — compute intraday range with `with_columns()`

```python
def compute_intraday_range(df: pl.DataFrame) -> pl.DataFrame:
    """Add intraday_range column: (high - low) / close as percentage."""
    return df.with_columns(
        ((pl.col("high") - pl.col("low")) / pl.col("close"))
        .round(6)
        .alias("intraday_range")
    )
```

#### Polars — compute 20-day moving average with `rolling_mean().over()`

```python
def compute_sma(df: pl.DataFrame, window: int = 20) -> pl.DataFrame:
    """Add sma_20 column: rolling mean of close price per symbol."""
    return df.sort(["symbol", "date"]).with_columns(
        pl.col("close")
          .rolling_mean(window_size=window)
          .over("symbol")
          .round(4)
          .alias(f"sma_{window}")
    )
```

| symbol | date | close | sma_20 |
|--------|------|-------|--------|
| SAP.DE | 2026-03-23 | 153.860001 | 166.034 |
| SAP.DE | 2026-03-24 | 147.619995 | 165.123 |
| SAP.DE | 2026-03-25 | 146.899994 | 164.129 |
| SAP.DE | 2026-03-26 | 144.639999 | 162.75 |
| SAP.DE | 2026-03-27 | 142.559998 | 161.33 |

#### Polars — compose all Silver transforms with function chaining

```python
def transform_silver(bronze_df: pl.DataFrame) -> pl.DataFrame:
    """Apply all Silver enrichment transforms in sequence."""
    df = bronze_df.drop("batch_id") if "batch_id" in bronze_df.columns else bronze_df
    df = compute_daily_returns(df)
    df = compute_intraday_range(df)
    df = compute_sma(df, window=20)
    return df
```

#### Pydantic — validate Silver rows with `BaseModel()` row-level check

```python
def validate_silver(df: pl.DataFrame, batch_id: str) -> tuple[pl.DataFrame, int]:
    """Validate each row through CleanOHLCV. Quarantines rejected rows."""
    valid_rows = []
    rejected = 0
    for row in df.iter_rows(named=True):
        try:
            record = CleanOHLCV(**row, batch_id=batch_id)
            valid_rows.append(record.model_dump())
        except Exception as e:
            rejected += 1
            quarantine_row(batch_id, "silver", dict(row), str(e))
    return pl.DataFrame(valid_rows), rejected
```

#### Silver — define enrichment pipeline with transform + `MERGE INTO`

> [!info] Silver Enrichment Pipeline
>
> Transforms the FULL bronze dataset (needed for correct SMA/returns), validates through Pydantic, MERGE upserts into `silver_ohlcv`. Returns the FULL silver dataset for downstream stages.

```python
def process_silver(bronze_df: pl.DataFrame, batch_id: str) -> tuple[pl.DataFrame, StageLineage]:
    """Transform, validate, and MERGE upsert Silver data."""
    stage_ctx = start_stage(batch_id, "silver", input_rows=len(bronze_df))
    enriched_df = transform_silver(bronze_df)
    valid_df, rejected = validate_silver(enriched_df, batch_id)
    if len(valid_df) > 0:
        merged = merge_silver(valid_df, batch_id)
    lineage = end_stage(stage_ctx, valid_df, rejected)
    persist_lineage(lineage)
    silver_full = pl.read_database("SELECT ... FROM silver_ohlcv", connection=sql_engine)
    return silver_full, lineage
```

#### Silver — execute enrichment on full Bronze data

```python
silver_df, silver_lineage = process_silver(bronze_df, batch_id)
```

    Silver: 2530 rows merged (2530 valid, 0 rejected)
    Silver complete: 2530 total rows in 3182ms
    Output hash: 309f651b6d140961

#### Polars — display Silver enriched columns with `filter().select()`

| symbol | date | close | daily_return | intraday_range | sma_20 |
|--------|------|-------|-------------|----------------|--------|
| SAP.DE | 2026-03-23 | 153.860001 | 0.00026 | 0.072274 | 166.034 |
| SAP.DE | 2026-03-24 | 147.619995 | -0.040556 | 0.034142 | 165.123 |
| SAP.DE | 2026-03-25 | 146.899994 | -0.004874 | 0.036216 | 164.129 |
| SAP.DE | 2026-03-26 | 144.639999 | -0.015384 | 0.041755 | 162.75 |
| SAP.DE | 2026-03-27 | 142.559998 | -0.014373 | 0.037883 | 161.33 |

#### Polars — display Silver statistics per symbol with `group_by().agg()`

| symbol | avg_return | volatility | avg_intraday | sma_nulls | rows |
|--------|-----------|-----------|-------------|-----------|------|
| ALV.DE | 0.000745 | 0.013737 | 0.017103 | 19 | 506 |
| BAS.DE | -0.000362 | 0.016427 | 0.018983 | 19 | 506 |
| DTE.DE | 0.000714 | 0.013587 | 0.014893 | 19 | 506 |
| SAP.DE | -0.000055 | 0.020662 | 0.021118 | 19 | 506 |
| SIE.DE | 0.000472 | 0.016671 | 0.018437 | 19 | 506 |

#### Pipeline — run Silver data quality gate with `run_quality_gate()`

```python
silver_dq = run_quality_gate([
    dq_check_not_empty(silver_df, "silver"),
    dq_check_no_null_keys(silver_df, ["symbol", "date"], "silver"),
    dq_check_no_duplicates(silver_df, ["symbol", "date"], "silver"),
    dq_check_range(silver_df, "daily_return", -0.5, 0.5, "silver"),
    dq_check_range(silver_df, "intraday_range", 0.0, 0.5, "silver"),
    dq_check_freshness(silver_df, "date", 5, "silver"),
    dq_check_row_count(silver_df, len(SYMBOLS) * 200, "silver"),
], stage="silver")
```

    DQ PASS: silver: 2530 rows
    DQ PASS: silver: no null keys in ['symbol', 'date']
    DQ PASS: silver: no duplicates
    DQ PASS: silver: 'daily_return' within range
    DQ PASS: silver: 'intraday_range' within range
    DQ PASS: silver: latest date 2026-03-27 (2d ago)
    DQ PASS: silver: 2530 rows

---

## Gold Layer

> [!info] Two pre-aggregated mart tables from Silver data
>
> - **Daily Summary** — cross-sectional metrics for each trading day (avg return, max/min return, total volume, avg intraday range). Used for market overview dashboards.
> - **Symbol Profile** — per-symbol statistics over full history (avg return, volatility, max drawdown, total dividends). Used for stock comparison views.
>
> Both are validated through Pydantic models and persisted to SQL Server + Parquet. Gold tables are truncated and rebuilt from Silver on every run.

#### Polars — build daily cross-sectional summary with `group_by().agg()`

```python
def build_daily_summary(silver_df: pl.DataFrame, batch_id: str) -> pl.DataFrame:
    """Aggregate Silver data into daily cross-sectional summary."""
    return silver_df.group_by("date").agg(
        pl.col("symbol").n_unique().alias("symbols_traded"),
        pl.col("daily_return").mean().round(6).alias("avg_return"),
        pl.col("daily_return").max().alias("max_return"),
        pl.col("daily_return").min().alias("min_return"),
        pl.col("volume").sum().alias("total_volume"),
        pl.col("intraday_range").mean().round(6).alias("avg_intraday_pct"),
    ).sort("date").with_columns(pl.lit(batch_id).alias("batch_id"))
```

    Daily summary: 506 trading days

#### Polars — build per-symbol profile with `cum_max()` drawdown

> [!info] Max Drawdown Calculation
>
> Worst peak-to-trough decline using `cum_max` of close price. Computes avg return, volatility, max drawdown, and total dividends per symbol.

```python
def build_symbol_profile(silver_df: pl.DataFrame, batch_id: str) -> pl.DataFrame:
    profiles = []
    for symbol in silver_df.select("symbol").unique().sort("symbol").to_series():
        sym_df = silver_df.filter(pl.col("symbol") == symbol).sort("date")
        cum_max = sym_df.select(pl.col("close").cum_max().alias("peak"))
        drawdowns = (sym_df["close"] - cum_max["peak"]) / cum_max["peak"]
        max_dd = round(min(drawdowns.to_list()), 6)
        profiles.append({
            "symbol": symbol,
            "total_trading_days": len(sym_df),
            "avg_daily_return": round(float(sym_df["daily_return"].mean()), 6),
            "volatility": round(float(sym_df["daily_return"].std()), 6),
            "max_drawdown": max_dd,
            "avg_volume": round(float(sym_df["volume"].mean()), 2),
            "total_dividends": round(float(sym_df["dividends"].sum()), 4),
            "first_date": sym_df["date"].min(),
            "last_date": sym_df["date"].max(),
            "batch_id": batch_id,
        })
    return pl.DataFrame(profiles)
```

    Symbol profiles: 5 symbols

#### Pydantic — validate Gold daily summary with `BaseModel()` row-level check

```python
def validate_gold_daily(df: pl.DataFrame) -> tuple[pl.DataFrame, int]:
    valid_rows = []
    rejected = 0
    for row in df.iter_rows(named=True):
        try:
            record = DailySummary(**row)
            valid_rows.append(record.model_dump())
        except Exception:
            rejected += 1
    return pl.DataFrame(valid_rows), rejected
```

    Daily summary validation: 506 valid, 0 rejected

#### Pydantic — validate Gold symbol profiles with `BaseModel()` row-level check

```python
def validate_gold_profiles(df: pl.DataFrame) -> tuple[pl.DataFrame, int]:
    valid_rows = []
    rejected = 0
    for row in df.iter_rows(named=True):
        try:
            record = SymbolProfile(**row)
            valid_rows.append(record.model_dump())
        except Exception as e:
            rejected += 1
    return pl.DataFrame(valid_rows), rejected
```

    Symbol profile validation: 5 valid, 0 rejected

#### SQL Server — persist Gold marts with `TRUNCATE` + `to_sql()`

```python
def persist_gold(daily_df: pl.DataFrame, profile_df: pl.DataFrame, batch_id: str) -> StageLineage:
    """Persist Gold mart tables to SQL Server with lineage tracking."""
    stage_ctx = start_stage(batch_id, "gold", input_rows=len(daily_df) + len(profile_df))
    write_to_sql(daily_df, "gold_daily_summary")
    write_to_sql(profile_df, "gold_symbol_profile")
    combined = pl.concat([
        daily_df.select(pl.all().cast(pl.Utf8)),
        profile_df.select(pl.all().cast(pl.Utf8)),
    ], how="diagonal")
    lineage = end_stage(stage_ctx, combined, 0)
    persist_lineage(lineage)
    return lineage
```

    Gold persisted: hash=7e21b5203a7ab58d

#### Polars — display Gold daily summary with `sort().tail()`

| date | symbols_traded | avg_return | max_return | min_return | total_volume | avg_intraday_pct |
|------|---------------|-----------|-----------|-----------|-------------|-----------------|
| 2026-03-21 | 5 | -0.008218 | 0.001098 | -0.020072 | 22729800 | 0.022012 |
| 2026-03-23 | 5 | 0.003284 | 0.021498 | -0.007296 | 23780600 | 0.027218 |
| 2026-03-24 | 5 | -0.015508 | -0.00228 | -0.040556 | 27474600 | 0.025068 |
| 2026-03-25 | 5 | 0.006246 | 0.01855 | -0.004874 | 20476900 | 0.021782 |
| 2026-03-27 | 5 | -0.003992 | 0.008738 | -0.015384 | 23700900 | 0.025684 |

#### Polars — display Gold symbol profiles with `select()`

| symbol | total_trading_days | avg_daily_return | volatility | max_drawdown | avg_volume | total_dividends |
|--------|--------------------|-----------------|-----------|-------------|-----------|----------------|
| ALV.DE | 506 | 0.000745 | 0.013737 | -0.116994 | 1702917.89 | 13.8 |
| BAS.DE | 506 | -0.000362 | 0.016427 | -0.268693 | 3167449.8 | 6.66 |
| DTE.DE | 506 | 0.000714 | 0.013587 | -0.098654 | 8620178.06 | 1.55 |
| SAP.DE | 506 | -0.000055 | 0.020662 | -0.311289 | 3449367.41 | 2.2 |
| SIE.DE | 506 | 0.000472 | 0.016671 | -0.193044 | 2457102.93 | 5.2 |

---

## Parquet Export

> [!info] Pre-materialized views pattern
>
> - The serving layer (FastAPI) does not query SQL Server at runtime
> - Pipeline exports Gold data to Parquet files that the API reads directly
> - Deployment is a file copy, not a database migration
> - Cache invalidation = re-run the pipeline

#### Polars — export daily summary to Parquet with `write_parquet()`

```python
daily_path = EXPORT_DIR / "gold_daily_summary.parquet"
valid_daily.write_parquet(daily_path)
```

    Exported: gold_daily_summary.parquet (21.2 KB, 506 rows)

#### Polars — export symbol profiles to Parquet with `write_parquet()`

```python
profile_path = EXPORT_DIR / "gold_symbol_profile.parquet"
valid_profiles.write_parquet(profile_path)
```

    Exported: gold_symbol_profile.parquet (3.9 KB, 5 rows)

#### Polars — export Silver data to Parquet with `write_parquet()`

```python
silver_path = EXPORT_DIR / "silver_ohlcv.parquet"
silver_df.write_parquet(silver_path)
```

    Exported: silver_ohlcv.parquet (96.9 KB, 2530 rows)

#### Lineage — record export stage with `end_stage()`

```python
export_ctx = start_stage(batch_id, "export", input_rows=len(valid_daily) + len(valid_profiles) + len(silver_df))
export_combined = pl.concat([
    valid_daily.select(pl.all().cast(pl.Utf8)),
    valid_profiles.select(pl.all().cast(pl.Utf8)),
    silver_df.select(pl.all().cast(pl.Utf8)),
], how="diagonal")
export_lineage = end_stage(export_ctx, export_combined, 0)
persist_lineage(export_lineage)
```

    Export lineage recorded: 3041 total rows, hash=c418628dd0f329a9

#### Polars — verify exported Parquet files with `read_parquet()`

```python
for name in ["gold_daily_summary", "gold_symbol_profile", "silver_ohlcv"]:
    path = EXPORT_DIR / f"{name}.parquet"
    df = pl.read_parquet(path)
    print(f"  {name}: {len(df)} rows, {len(df.columns)} cols")
```

    gold_daily_summary: 506 rows, 8 cols
    gold_symbol_profile: 5 rows, 10 cols
    silver_ohlcv: 2530 rows, 14 cols

---

## Lineage Review

> [!info] After all stages complete, review the full pipeline execution trail. Each stage recorded its timing, row counts, and output hash. The `RunContext` aggregates everything and is persisted to JSON.

#### Pydantic — build and save run context with `RunContext()`

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
ctx_path = save_run_context(run_context)
```

    RunContext saved: run_bc9d3a23.json
    Batch: bc9d3a23...
    Processing time: 3939ms (3.9s)

#### Polars — display lineage summary as DataFrame

| stage | input_rows | output_rows | rejected | duration_ms | output_hash |
|-------|-----------|------------|---------|------------|------------|
| bronze | 5 | 5 | 0 | 725.3 | bf7713401ce6f144 |
| silver | 2530 | 2530 | 0 | 3165.0 | 309f651b6d140961 |
| gold | 511 | 511 | 0 | 47.9 | 7e21b5203a7ab58d |
| export | 3041 | 3041 | 0 | 0.8 | c418628dd0f329a9 |

#### JSON — read back persisted run context with `json.loads()`

```python
ctx_json = json.loads(ctx_path.read_text(encoding="utf-8"))
```

    {
      "batch_id": "bc9d3a23-b825-4e59-be6a-f0efa6e72c90",
      "started_at": "2026-03-29T00:03:09.696012Z",
      "completed_at": "2026-03-29T00:04:27.974153Z",
      "symbols": ["SAP.DE", "SIE.DE", "ALV.DE", "DTE.DE", "BAS.DE"],
      "date_range": ["2024-03-29", "2026-03-29"],
      "polars_version": "1.39.3",
      "status": "completed"
    }

#### Polars — query lineage table with `read_database()`

| stage | input_rows | output_rows | rows_rejected | output_hash |
|-------|-----------|------------|--------------|------------|
| bronze | 5 | 5 | 0 | bf7713401ce6f144 |
| silver | 2530 | 2530 | 0 | 309f651b6d140961 |
| gold | 511 | 511 | 0 | 7e21b5203a7ab58d |
| export | 3041 | 3041 | 0 | c418628dd0f329a9 |

#### Polars — review quarantined rows with `read_database()`

    No quarantined rows — all data passed validation

---

## FastAPI Serving Layer

> [!info] Pre-materialized Parquet API
>
> - `GET /health` — healthcheck: verifies Parquet files exist and reports their sizes
> - `GET /daily-summary` — cross-sectional daily metrics with optional date filter
> - `GET /symbol-profile` — per-symbol statistics
> - `GET /symbol/{symbol}/timeseries` — daily OHLCV + enrichment for one symbol
> - `GET /lineage/{batch_id}` — pipeline execution metadata
>
> The server runs in a background thread. No database connection at runtime -- the API reads Parquet files that the pipeline produced.

#### Pydantic — define daily summary API response model with `BaseModel`

```python
class DailySummaryResponse(BaseModel):
    date:             Date
    symbols_traded:   int
    avg_return:       float
    max_return:       float
    min_return:       float
    total_volume:     int
    avg_intraday_pct: float
```

#### Pydantic — define symbol profile API response model with `BaseModel`

```python
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
```

#### Pydantic — define timeseries row API response model with `BaseModel`

```python
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
```

#### FastAPI — create application instance with `FastAPI()`

```python
app = FastAPI(title="Gold Data Pipeline API", version="1.0.0")
```

#### FastAPI — define health endpoint with `@app.get()`

```python
@app.get("/health")
def health():
    """Healthcheck — verify Parquet files exist."""
    files = {f.stem: f.stat().st_size for f in EXPORT_DIR.glob("*.parquet")}
    return {"status": "healthy", "files": files}
```

#### FastAPI — define daily summary endpoint with `@app.get()`

```python
@app.get("/daily-summary", response_model=list[DailySummaryResponse])
def get_daily_summary(start_date: Date | None = None, end_date: Date | None = None):
    """Return daily cross-sectional summary, optionally filtered by date range."""
    df = pl.read_parquet(EXPORT_DIR / "gold_daily_summary.parquet")
    if start_date:
        df = df.filter(pl.col("date") >= start_date)
    if end_date:
        df = df.filter(pl.col("date") <= end_date)
    return df.drop("batch_id").sort("date").to_dicts()
```

#### FastAPI — define symbol profile endpoint with `@app.get()`

```python
@app.get("/symbol-profile", response_model=list[SymbolProfileResponse])
def get_symbol_profiles():
    """Return per-symbol summary statistics."""
    df = pl.read_parquet(EXPORT_DIR / "gold_symbol_profile.parquet")
    return df.drop("batch_id").sort("symbol").to_dicts()
```

#### FastAPI — define symbol timeseries endpoint with `@app.get()`

```python
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
```

#### FastAPI — define lineage endpoint with `@app.get()`

```python
@app.get("/lineage/{batch_id_prefix}")
def get_lineage(batch_id_prefix: str):
    """Return RunContext JSON for a batch (matches by prefix)."""
    matches = list(LINEAGE_DIR.glob(f"run_{batch_id_prefix}*.json"))
    if not matches:
        raise HTTPException(status_code=404, detail="Batch not found")
    return json.loads(matches[0].read_text(encoding="utf-8"))
```

#### uvicorn — start API server in background with `threading.Thread()`

```python
API_PORT = 8099

def run_server():
    config = uvicorn.Config(app, host="127.0.0.1", port=API_PORT, log_level="warning")
    server = uvicorn.Server(config)
    server.run()

server_thread = threading.Thread(target=run_server, daemon=True)
server_thread.start()
time.sleep(2)
```

    FastAPI server running at http://127.0.0.1:8099
    Swagger docs: http://127.0.0.1:8099/docs

![alt text](gold_docs.png)

#### httpx — test health endpoint with `httpx.get()`

```python
resp = httpx.get(f"http://127.0.0.1:{API_PORT}/health")
print(json.dumps(resp.json(), indent=2))
```

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
resp = httpx.get(f"http://127.0.0.1:{API_PORT}/daily-summary", params={"start_date": five_days_ago})
pl.DataFrame(resp.json())
```

    Status: 200, rows: 7

#### httpx — test symbol profile endpoint with `httpx.get()`

```python
resp = httpx.get(f"http://127.0.0.1:{API_PORT}/symbol-profile")
pl.DataFrame(resp.json())
```

    Status: 200, profiles: 5

#### httpx — test symbol timeseries endpoint with `httpx.get()`

```python
resp = httpx.get(f"http://127.0.0.1:{API_PORT}/symbol/SAP.DE/timeseries", params={"limit": 10})
pl.DataFrame(resp.json())
```

    Status: 200, rows: 10

#### httpx — test lineage endpoint with `httpx.get()`

```python
resp = httpx.get(f"http://127.0.0.1:{API_PORT}/lineage/{batch_id[:8]}")
data = resp.json()
pl.DataFrame(data["stages"]).select("stage", "input_rows", "output_rows", "rows_rejected", "output_hash")
```

    Status: 200
    Batch: bc9d3a23... | Status: completed

| stage | input_rows | output_rows | rows_rejected | output_hash |
|-------|-----------|------------|--------------|------------|
| bronze | 5 | 5 | 0 | bf7713401ce6f144 |
| silver | 2530 | 2530 | 0 | 309f651b6d140961 |
| gold | 511 | 511 | 0 | 7e21b5203a7ab58d |
| export | 3041 | 3041 | 0 | c418628dd0f329a9 |

---

## Audit — Investigating a Disputed Data Point

> [!info] Scenario
>
> A stakeholder at SAP challenges the -16% drop on 2026-01-29, claiming the data is wrong and the pipeline produced a bad data point.
>
> Using the pipeline's lineage infrastructure, we trace every step from source to Gold mart and prove the data is authentic:
>
> 1. **Landing zone** — raw JSON file from yfinance, untouched
> 2. **Bronze table** — exact values as ingested, with `batch_id` + timestamp
> 3. **Silver table** — computed daily return matches the close-to-close change
> 4. **Gold table** — the data point propagated correctly to the aggregation
> 5. **Lineage record** — the pipeline run that produced it, with hash
> 6. **RunContext** — zero rejections, pipeline completed successfully
> 7. **Landing file** — raw file on disk matches Bronze exactly

#### JSON — verify raw landing zone file with `json.loads()`

```python
landing_file = LANDING_DIR / "ohlcv_SAP_DE.json"
raw_records = json.loads(landing_file.read_text(encoding="utf-8"))
jan29_raw = next(r for r in raw_records if r["date"] == "2026-01-29")
pl.DataFrame([jan29_raw])
```

| symbol | date | open | high | low | close | adj_close | volume | dividends | stock_splits |
|--------|------|------|------|-----|-------|-----------|--------|-----------|-------------|
| SAP.DE | 2026-01-29 | 179.0 | 180.16 | 162.12 | 164.62 | 164.62 | 15846791 | 0.0 | 0.0 |

#### SQL Server — query Bronze table for raw ingested values with `read_database()`

```python
bronze_audit = pl.read_database(
    "SELECT symbol, date, [open], high, low, [close], adj_close, volume, batch_id, ingested_at "
    "FROM bronze_ohlcv WHERE symbol = 'SAP.DE' AND date = '2026-01-29'",
    connection=sql_engine
)
```

    Bronze table (raw ingested):

#### SQL Server — query Silver table for enriched values with `read_database()`

> [!info] Return Calculation Verification
>
> Manually verifies: `daily_return = (close - prev_close) / prev_close`

```python
silver_audit = pl.read_database(
    "SELECT symbol, date, [close], daily_return, intraday_range, sma_20, batch_id "
    "FROM silver_ohlcv WHERE symbol = 'SAP.DE' AND date BETWEEN '2026-01-28' AND '2026-01-30' "
    "ORDER BY date",
    connection=sql_engine
)
```

    Previous close (Jan 28): 196.14
    Current close  (Jan 29): 164.62
    Expected return: (164.62 - 196.14) / 196.14 = -0.160702
    Actual return:   -0.160702
    Match: True

#### SQL Server — query Gold tables for aggregated impact with `read_database()`

```python
gold_daily_audit = pl.read_database(
    "SELECT date, symbols_traded, avg_return, min_return, max_return, total_volume "
    "FROM gold_daily_summary WHERE date = '2026-01-29'",
    connection=sql_engine
)
```

    Gold daily summary (Jan 29):
      The min_return on this day should reflect SAP's -16% drop

#### SQL Server — query lineage table for pipeline run metadata with `read_database()`

> [!info] Lineage Chain Trace
>
> Every row in Bronze carries a `batch_id` — disputed row `(symbol, date)` → `batch_id` → `lineage_stages` → full pipeline audit. The output hash is a SHA-256 fingerprint — if anyone modified data post-ingestion, the hash breaks.

```python
batch_from_bronze = pl.read_database(
    "SELECT batch_id FROM bronze_ohlcv WHERE symbol = 'SAP.DE' AND date = '2026-01-29'",
    connection=sql_engine
)["batch_id"][0]

lineage_audit = pl.read_database(
    f"SELECT stage, started_at, completed_at, input_rows, output_rows, rows_rejected, output_hash "
    f"FROM lineage_stages WHERE batch_id = '{batch_from_bronze}' ORDER BY started_at",
    connection=sql_engine
)
```

    Disputed row: SAP.DE / 2026-01-29
    Batch ID (from row): 9c135c08-937d-4413-8bb4-1b66407ed9a5

| stage | input_rows | output_rows | rows_rejected | output_hash |
|-------|-----------|------------|--------------|------------|
| bronze | 2530 | 2530 | 0 | 914eccd231d933a2 |
| silver | 2530 | 2530 | 0 | ... |
| gold | 511 | 511 | 0 | ... |
| export | 3041 | 3041 | 0 | ... |

#### JSON — verify RunContext execution metadata with `json.loads()`

> [!info] RunContext Execution Proof
>
> Proves which symbols were processed, date range, Polars version, pipeline status, zero rejected rows, and output hash (cryptographic integrity proof).

```python
ctx_files = list(LINEAGE_DIR.glob(f"run_{batch_from_bronze[:8]}*.json"))
ctx = json.loads(ctx_files[0].read_text(encoding="utf-8"))
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
landing_file = LANDING_DIR / "ohlcv_SAP_DE.json"
raw_records = json.loads(landing_file.read_text(encoding="utf-8"))
jan29_in_file = [r for r in raw_records if r["date"] == "2026-01-29"]
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
      Bronze close: 164.62
      Landing close: 164.6199951171875
      Match: True

#### Polars — display full audit trail summary as DataFrame

```python
audit_summary = pl.DataFrame([
    {"step": "1. Landing zone", "source": "landing/ohlcv_SAP_DE.json", "evidence": "Raw API response on disk"},
    {"step": "2. Bronze table", "source": "bronze_ohlcv",              "evidence": f"Batch {batch_from_bronze[:8]}"},
    {"step": "3. Silver table", "source": "silver_ohlcv",              "evidence": "Return = -16.07% verified"},
    {"step": "4. Gold table",   "source": "gold_daily_summary",        "evidence": "min_return reflects the drop"},
    {"step": "5. Lineage",      "source": "lineage_stages",            "evidence": "Hash: tamper-proof"},
    {"step": "6. RunContext",   "source": "run_{batch}.json",          "evidence": "0 rejected, status=completed"},
    {"step": "7. Landing file", "source": "ohlcv_SAP_DE.json",         "evidence": "File on disk matches Bronze"},
])
```

    AUDIT CONCLUSION: The SAP.DE -16% drop on 2026-01-29 is AUTHENTIC.
      - Same close price at every layer: landing, Bronze, Silver
      - Daily return verified mathematically from consecutive closes
      - Zero rows rejected by Pydantic validation
      - Output hash proves no post-ingestion tampering

---

## Streamlit Frontend

> [!info] Consuming the Gold API
>
> A minimal Streamlit dashboard that consumes the FastAPI endpoints. Written to a `.py` file and launched as a subprocess.
>
> **Views:**
> - Market overview (daily summary chart)
> - Symbol comparison (profile table + bar chart)
> - Symbol detail (time series with SMA overlay)
>
> The Streamlit app only knows about the API -- it has no direct database or file access. This enforces the data product boundary: consumers interact with the API contract, not the implementation.

#### Streamlit — write dashboard app to file with `Path.write_text()`

```python
app_code = '''
import streamlit as st
import httpx
import polars as pl
import plotly.graph_objects as go
from datetime import date, timedelta

API_BASE = "http://127.0.0.1:8099"
st.set_page_config(page_title="Gold Pipeline Dashboard", layout="wide")
st.title("Gold Data Pipeline Dashboard")

profiles_resp = httpx.get(f"{API_BASE}/symbol-profile")
profiles = pl.DataFrame(profiles_resp.json())
symbols = sorted(profiles["symbol"].to_list())

tab1, tab2, tab3 = st.tabs(["Market Overview", "Symbol Comparison", "Symbol Detail"])
# ... dashboard tabs with plotly charts
'''

app_path = EXPORT_DIR / "app_dashboard.py"
app_path.write_text(app_code.strip(), encoding="utf-8")
```

    Streamlit app written to: C:\Users\aperi\DEV\LANG\data\pipeline\app_dashboard.py

![Gold Market](/static/gold_market.png)

![Gold Comparison](/static/gold_comp.png)

![Gold Detail](/static/gold_detail.png)

#### Streamlit — launch dashboard with `subprocess.Popen()`

```python
streamlit_proc = subprocess.Popen(
    ["streamlit", "run", str(EXPORT_DIR / "app_dashboard.py"),
     "--server.port", "8501", "--server.headless", "true"],
    stdout=subprocess.PIPE, stderr=subprocess.PIPE
)
```

---

## Pipeline Visualization

> [!info] Visual validation of the pipeline output. All charts use Plotly with dark-theme-compatible transparent backgrounds.

#### Plotly — plot daily return time series with `go.Scatter()`

> [!info] Overlaid line chart showing daily returns across all 5 symbols (last 3 months).

```python
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
fig.update_layout(title="Daily Returns — Last 3 Months", template="plotly_dark",
                  paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)")
```

<iframe src="/static/plotly/fp_py_01.html" width="100%" height="500" style="border:none;"></iframe>

#### Plotly — plot cumulative returns comparison with `cum_prod()`

> [!info] Shows how a 1 euro investment in each symbol would have grown over the full 2-year history.

```python
fig = go.Figure()
for symbol in SYMBOLS:
    sym_df = silver_df.filter(pl.col("symbol") == symbol).sort("date")
    cum_ret = (1 + sym_df["daily_return"]).cum_prod()
    fig.add_trace(go.Scatter(
        x=sym_df["date"].to_list(), y=cum_ret.to_list(),
        mode="lines", name=symbol
    ))
fig.update_layout(title="Cumulative Returns", template="plotly_dark",
                  paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)")
```

<iframe src="/static/plotly/fp_py_02.html" width="100%" height="500" style="border:none;"></iframe>

#### Plotly — plot risk-return scatter with `go.Scatter()`

> [!info] Risk-return visualization using Gold symbol profile data. X-axis is daily volatility (%), Y-axis is average daily return (%).

```python
fig = go.Figure()
fig.add_trace(go.Scatter(
    x=[v * 100 for v in valid_profiles["volatility"].to_list()],
    y=[v * 100 for v in valid_profiles["avg_daily_return"].to_list()],
    mode="markers+text",
    text=valid_profiles["symbol"].to_list(),
    textposition="top center",
    marker=dict(size=12, color="#4285F4"),
))
fig.update_layout(title="Risk-Return Profile", template="plotly_dark",
                  paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)")
```

<iframe src="/static/plotly/fp_py_03.html" width="100%" height="500" style="border:none;"></iframe>

#### Plotly — plot pipeline stage timing with `go.Bar()`

> [!info] Shows how long each pipeline stage took in milliseconds.

```python
stages = [s.stage for s in run_context.stages]
durations = [s.duration_ms for s in run_context.stages]
fig = go.Figure()
fig.add_trace(go.Bar(
    x=stages, y=durations,
    marker_color=["#4285F4", "#34A853", "#FBBC04", "#EA4335"],
    text=[f"{d:.0f}ms" for d in durations],
    textposition="outside",
))
fig.update_layout(title="Pipeline Stage Duration", template="plotly_dark",
                  paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)")
```

<iframe src="/static/plotly/fp_py_04.html" width="100%" height="500" style="border:none;"></iframe>

---

## Airflow Orchestration

> [!info] Build, Validate, Deploy
>
> 1. **Extract** — generate `pipeline_tasks.py` module with all pipeline functions
> 2. **Define** — generate `gold_pipeline_dag.py` with task dependencies and retry policies
> 3. **Validate** — import the DAG in-process to verify it parses without errors
> 4. **Inspect** — extract and display the task dependency graph from the parsed DAG
> 5. **Deploy** — start an Airflow Docker container with the DAG volume mounted
>
> DAG task chain: `fetch_dimensions` -> `load_dimensions` -> `build_calendar` -> `ingest_bronze` -> `dq_bronze` -> `process_silver` -> `dq_silver` -> `process_gold` -> `export_parquet` -> `notify_complete`

#### Python — extract pipeline functions to module with `Path.write_text()`

> [!info] Pipeline Tasks Module
>
> Writes all pipeline functions to a standalone Python module. Imported by the Airflow DAG — no notebook dependency at runtime.

```python
tasks_code = '''
# Pipeline task functions — extracted from notebook.
# Called by the Airflow DAG. Each function is one pipeline stage.

def get_connection():
    """Create SQL Server connection + cursor."""
    conn = pyodbc.connect(SQL_CONN_STR)
    return conn, conn.cursor()

def task_fetch_dimensions(symbols): ...
def task_load_dimensions(): ...
def task_build_calendar(start, end): ...
def task_ingest_bronze(symbols, start, end, batch_id): ...
def task_process_silver(batch_id): ...
def task_process_gold(batch_id): ...
def task_export_parquet(): ...
'''

tasks_path = EXPORT_DIR / "pipeline_tasks.py"
tasks_path.write_text(tasks_code.strip(), encoding="utf-8")
```

    Pipeline tasks module written to: pipeline_tasks.py (17.5 KB)

#### Airflow — write DAG definition with `@task` TaskFlow API

> [!info] Airflow 3.x TaskFlow DAG
>
> Uses `@task` decorators for Python-native DAG definition. Schedule: daily at 18:30 UTC (after European market close). Retries: 2 attempts with 5-minute delay. SLA: 30-minute execution timeout.

```python
dag_code = '''
from datetime import datetime, timedelta
from airflow.sdk import DAG, task

default_args = {
    "owner": "data-engineering",
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
    "execution_timeout": timedelta(minutes=30),
}

with DAG(
    dag_id="gold_data_pipeline",
    default_args=default_args,
    schedule="30 18 * * 1-5",
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=["data-engineering", "medallion", "stoxx"],
    max_active_runs=1,
) as dag:

    @task()
    def fetch_dimensions(): ...

    @task()
    def load_dimensions(): ...

    @task()
    def build_calendar(): ...

    @task()
    def ingest_bronze(**context): ...

    @task()
    def dq_gate_bronze(): ...

    @task()
    def process_silver(**context): ...

    @task()
    def dq_gate_silver(): ...

    @task()
    def process_gold(**context): ...

    @task()
    def export_parquet(): ...

    @task()
    def notify_complete(**context): ...

    # Task dependencies
    (fetch_dimensions() >> load_dimensions() >> build_calendar()
     >> ingest_bronze() >> dq_gate_bronze() >> process_silver()
     >> dq_gate_silver() >> process_gold() >> export_parquet()
     >> notify_complete())
'''

dag_path = EXPORT_DIR / "gold_pipeline_dag.py"
dag_path.write_text(dag_code.strip(), encoding="utf-8")
```

    Airflow DAG written to: gold_pipeline_dag.py (6.2 KB)

#### Python — verify DAG syntax with `subprocess.run()`

```python
spec = importlib.util.spec_from_file_location("gold_pipeline_dag", dag_file)
dag_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dag_module)
dag_obj = dag_module.dag
```

    DAG parsed successfully: gold_data_pipeline
      Schedule: 30 18 * * 1-5
      Tasks: 10
      Tags: {'medallion', 'data-engineering', 'stoxx'}

#### Airflow — extract task dependencies from parsed DAG with `topological_sort()`

```python
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

| order | task | depends_on |
|-------|------|-----------|
| 1 | fetch_dimensions | - |
| 2 | load_dimensions | fetch_dimensions |
| 3 | build_calendar | load_dimensions |
| 4 | ingest_bronze | build_calendar |
| 5 | dq_gate_bronze | ingest_bronze |
| 6 | process_silver | dq_gate_bronze |
| 7 | dq_gate_silver | process_silver |
| 8 | process_gold | dq_gate_silver |
| 9 | export_parquet | process_gold |
| 10 | notify_complete | export_parquet |

#### Docker — start Airflow 3.x container with `docker run`

```python
!docker run -d --name airflow --network pipeline-net \
    -p 8080:8080 \
    -v "C:/Users/aperi/DEV/LANG/data/pipeline:/opt/airflow/dags" \
    -e AIRFLOW__CORE__LOAD_EXAMPLES=false \
    apache/airflow:3.1.8 standalone
```

#### Docker — install pipeline dependencies with `docker exec`

```python
!docker exec airflow python -m pip install \
    polars yfinance pandas-market-calendars pydantic tenacity sqlalchemy pyodbc
```

#### Docker — get Airflow admin password

```python
!docker logs airflow 2>&1 | findstr "Password"
```

    Simple auth manager | Password for user 'admin': 3KBPBG5T5uy2Qw2r

![Airflow DAG](/static/airflow_dag.png)
