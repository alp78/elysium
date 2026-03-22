---
type: concept
category: python-ecosystem
technology: [python, fastapi, polars, pydantic, cloud-run]
tags: [python, fastapi, polars, pydantic, data-pipelines, api, performance, concept]
aliases: [FastAPI data API, Polars DataFrame, modern Python data engineering, Starlette ASGI, pandas alternative]
keywords: [fastapi, polars, pydantic, ASGI, WSGI, async, dataframe, lazy evaluation, streaming, pandas alternative, cloud run, dependency injection, lifespan, uvicorn, rolling mean, window functions, group-by, financial data, OHLCV, schema drift, data validation]
description: "FastAPI and Polars represent the modern Python ecosystem for data engineering: FastAPI replaces Flask for high-performance async data APIs with Pydantic validation, while Polars replaces pandas for production pipeline processing at 5-10x speed with lazy evaluation and streaming."
related:
  - "[[idempotent-pipeline-design]]"
  - "[[five-pillars-of-data-engineering]]"
  - "[[datadog-architecture-overview]]"
  - "[[dbt-transformation-layer]]"
  - "[[observability-deep-dive]]"
  - "[[12_Testing|Python testing]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# FastAPI and Polars: Modern Python Ecosystem for Data Engineering

FastAPI and Polars represent the current standard for production Python data engineering. FastAPI (built on Starlette/ASGI and Pydantic) replaces Flask for data service APIs with native async, automatic validation, and OpenAPI documentation. Polars (written in Rust with Python bindings) replaces pandas for large-dataset processing with lazy evaluation, 5-10x speed improvements, and streaming support for datasets larger than RAM.

> [!info] Industry Context
> Major financial data companies require FastAPI experience and list Polars as a key skill for optimizing large-dataset processing. Both tools are central to modern data platform development.

## 28.1 FastAPI for Data Engineering APIs

FastAPI is not a web framework for building websites — it is a high-performance API framework built on Starlette (ASGI) and Pydantic (validation). For data engineers, it replaces Flask for building pipeline trigger endpoints, data serving APIs, and internal microservices.

**Why FastAPI over Flask:**

| Feature | Flask | FastAPI |
|---|---|---|
| Performance | Synchronous (WSGI) | Asynchronous (ASGI), 2-5x faster |
| Type safety | None (manual validation) | Pydantic models with automatic validation |
| API documentation | Manual (Swagger via flask-restx) | Automatic OpenAPI + Swagger UI |
| Async support | Bolt-on (requires asyncio workarounds) | Native async/await |
| Dependency injection | Flask-Inject (third-party) | Built-in, first-class support |
| Data validation | Manual or marshmallow | Pydantic v2 (Rust-powered, very fast) |

**Production FastAPI structure for a data pipeline service:**

```
pipeline_api/
├── main.py              # FastAPI app, lifespan, middleware
├── routers/
│   ├── pipeline.py      # /pipeline/trigger, /pipeline/status
│   ├── data.py          # /data/ohlcv, /data/signals
│   └── health.py        # /health, /ready
├── models/
│   ├── requests.py      # Pydantic request models
│   └── responses.py     # Pydantic response models
├── dependencies.py      # DB connections, auth
├── services/
│   ├── pipeline.py      # Business logic
│   └── data.py          # Data access layer
└── config.py            # Settings from environment
```

### Application Setup with Lifespan Events

**main.py — application setup with lifespan events:**

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from routers import pipeline, data, health
from dependencies import init_db_pool, close_db_pool

logger = logging.getLogger("pipeline_api")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage resources that live for the application lifetime."""
    # Startup: initialize database connection pool
    app.state.db_pool = await init_db_pool()
    logger.info("Database pool initialized")
    yield
    # Shutdown: close database connections
    await close_db_pool(app.state.db_pool)
    logger.info("Database pool closed")

app = FastAPI(
    title="the data pipeline project Pipeline API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET", "POST"])

app.include_router(health.router, tags=["Health"])
app.include_router(pipeline.router, prefix="/pipeline", tags=["Pipeline"])
app.include_router(data.router, prefix="/data", tags=["Data"])
```

### Pydantic Models for Financial Data Validation

**Pydantic models for financial data validation:**

```python
from pydantic import BaseModel, Field, field_validator
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

class OHLCVRecord(BaseModel):
    """Validated OHLCV record — Pydantic v2 with Rust-powered validation."""
    symbol: str = Field(..., min_length=1, max_length=20, pattern=r'^[A-Z0-9.]+$')
    trade_date: date
    open_price: Decimal = Field(..., gt=0, max_digits=12, decimal_places=4)
    high_price: Decimal = Field(..., gt=0, max_digits=12, decimal_places=4)
    low_price: Decimal = Field(..., gt=0, max_digits=12, decimal_places=4)
    close_price: Decimal = Field(..., gt=0, max_digits=12, decimal_places=4)
    volume: int = Field(..., ge=0)

    @field_validator('high_price')
    @classmethod
    def high_must_be_highest(cls, v, info):
        if 'open_price' in info.data and v < info.data['open_price']:
            raise ValueError('high_price must be >= open_price')
        return v

    @field_validator('low_price')
    @classmethod
    def low_must_be_lowest(cls, v, info):
        if 'high_price' in info.data and v > info.data['high_price']:
            raise ValueError('low_price must be <= high_price')
        return v

class CorporateAction(BaseModel):
    """Validated corporate action — catches data errors before they reach the database."""
    symbol: str
    action_type: str = Field(..., pattern=r'^(SPLIT|DIVIDEND|MERGER|SPINOFF|RIGHTS_ISSUE)$')
    effective_date: date
    ratio_numerator: Optional[int] = Field(None, gt=0)
    ratio_denominator: Optional[int] = Field(None, gt=0)
    dividend_amount: Optional[Decimal] = Field(None, ge=0)
    currency: str = Field(default='EUR', pattern=r'^[A-Z]{3}$')
    source: str  # Bloomberg, Reuters, Exchange

class PipelineTriggerRequest(BaseModel):
    index_key: str = Field(..., pattern=r'^[a-z_]+$')
    target_date: date
    force_reload: bool = False
    dry_run: bool = False

class PipelineStatusResponse(BaseModel):
    run_id: str
    index_key: str
    status: str  # RUNNING, SUCCESS, FAILED
    started_at: datetime
    completed_at: Optional[datetime] = None
    rows_processed: int = 0
    error_message: Optional[str] = None
```

### Dependency Injection for Database Connections

**Dependency injection for database connections:**

```python
from fastapi import Depends, Request
from typing import AsyncGenerator
import aioodbc

async def get_db(request: Request) -> AsyncGenerator:
    """Yield a database connection from the pool, auto-return on completion."""
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        yield conn

# Usage in a router:
from fastapi import APIRouter, Depends

router = APIRouter()

@router.get("/ohlcv/{symbol}")
async def get_ohlcv(symbol: str, days: int = 30, db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT TOP (?) * FROM gold.daily_ohlcv WHERE symbol = ? ORDER BY trade_date DESC",
        [days, symbol]
    )
    rows = await cursor.fetchall()
    return [dict(zip([col[0] for col in cursor.description], row)) for row in rows]

@router.post("/trigger")
async def trigger_pipeline(req: PipelineTriggerRequest, db=Depends(get_db)):
    """Trigger a pipeline run via API — used by Airflow or Cloud Scheduler."""
    # Pydantic already validated the request body
    run_id = await start_pipeline(db, req.index_key, req.target_date, req.force_reload, req.dry_run)
    return {"run_id": run_id, "status": "STARTED"}
```

### Deploying FastAPI on Cloud Run

**Dockerfile for Cloud Run deployment:**

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Cloud Run sets PORT env var; uvicorn listens on it
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "${PORT:-8080}", "--workers", "2"]
```

**gcloud CLI deployment command:**

```bash
gcloud run deploy pipeline-api \
  --source=. \
  --region=europe-west1 \
  --min-instances=1 \
  --memory=1Gi \
  --set-env-vars=DB_HOST=10.132.0.2,DB_NAME=data-pipeline
```

> [!tip] Cloud Run + FastAPI
> Set `--min-instances=1` to avoid cold starts for pipeline trigger endpoints — a cold start on a critical path can add 2-5 seconds of latency when Airflow calls the API to start a pipeline run.

---

## 28.2 Polars: The Next-Generation DataFrame Library

Polars is a DataFrame library written in Rust with Python bindings. It is not a pandas replacement for all use cases — it is a specialized tool for when pandas is too slow, too memory-hungry, or when you need lazy evaluation and query optimization.

**When to use which:**

| Scenario | Best Choice | Why |
|---|---|---|
| Quick EDA in a notebook | pandas | Richer ecosystem, more tutorials, familiar API |
| Production pipeline processing 10M+ rows | **Polars** | 5-10x faster, lower memory, lazy evaluation |
| Distributed processing across a cluster | **PySpark** | Polars is single-node only |
| Small transforms in a Blazor/Flask app | pandas | Simpler, well-known |
| Complex window functions on large datasets | **Polars** | Expressions are optimized by the query planner |
| Interop with ML libraries (scikit-learn, etc.) | pandas | ML ecosystem expects pandas DataFrames |

> [!warning] Polars is Single-Node
> Polars runs on a single machine. For datasets requiring distributed processing across a cluster, use PySpark or BigQuery instead. Polars streaming mode can handle datasets larger than RAM on a single node, but it is not a substitute for distributed compute.

### Polars Fundamentals

**Polars fundamentals — the key differences from pandas:**

```python
import polars as pl

# Reading data — Polars is 3-5x faster than pandas for CSV/Parquet
df = pl.read_parquet("gs://data-pipeline-data/daily_ohlcv_2025.parquet")

# Polars uses EXPRESSIONS, not method chains on Series
# pandas: df['return'] = df['close'].pct_change()
# Polars:
df = df.with_columns(
    (pl.col("close_price") / pl.col("close_price").shift(1) - 1).alias("daily_return")
)

# Multiple columns at once — vectorized, optimized by the query planner
df = df.with_columns(
    pl.col("close_price").rolling_mean(window_size=30).alias("ma_30"),
    pl.col("close_price").rolling_std(window_size=30).alias("std_30"),
    pl.col("volume").rolling_mean(window_size=20).alias("avg_volume_20"),
)

# Group-by with aggregations (Polars is 5-20x faster than pandas groupby)
index_stats = df.group_by("index_key").agg(
    pl.col("daily_return").mean().alias("avg_return"),
    pl.col("daily_return").std().alias("volatility"),
    pl.col("volume").sum().alias("total_volume"),
    pl.len().alias("trading_days"),
)

# Window functions (equivalent to pandas groupby().transform())
df = df.with_columns(
    pl.col("close_price")
      .rank(method="ordinal", descending=True)
      .over("index_key", "trade_date")
      .alias("rank_in_index")
)
```

### Lazy Evaluation — The Killer Feature

**Lazy evaluation — Polars builds an optimized query plan before executing:**

```python
# Lazy mode: Polars builds a query plan but does NOT execute until .collect()
# This enables optimizations: predicate pushdown, projection pushdown, join reordering

lazy_result = (
    pl.scan_parquet("gs://data-pipeline-data/daily_ohlcv_*.parquet")  # scan, don't read
    .filter(pl.col("trade_date") >= pl.lit("2025-01-01"))     # pushed down to file reader
    .select(["symbol", "trade_date", "close_price", "volume"]) # only read needed columns
    .with_columns(
        (pl.col("close_price") / pl.col("close_price").shift(1).over("symbol") - 1)
        .alias("daily_return")
    )
    .group_by("symbol")
    .agg(
        pl.col("daily_return").mean().alias("avg_return"),
        pl.col("daily_return").std().alias("volatility"),
    )
    .sort("volatility", descending=True)
)

# Nothing has executed yet! Polars optimized the query plan.
# Now execute:
result = lazy_result.collect()

# To see the optimized plan:
print(lazy_result.explain(optimized=True))
```

### Streaming Mode — Process Datasets Larger Than RAM

**Streaming mode — process 500GB+ datasets without loading into memory:**

```python
# For datasets that don't fit in memory, use streaming
result = (
    pl.scan_parquet("gs://data-pipeline-data/tick_data_2025_*.parquet")  # 500GB of tick data
    .filter(pl.col("exchange") == "XETRA")
    .group_by("symbol", pl.col("timestamp").dt.date().alias("date"))
    .agg(
        pl.col("price").first().alias("open"),
        pl.col("price").max().alias("high"),
        pl.col("price").min().alias("low"),
        pl.col("price").last().alias("close"),
        pl.col("volume").sum().alias("total_volume"),
    )
    .collect(streaming=True)  # processes in chunks, never loads all into RAM
)
```

### Financial Calculations in Polars

**Z-score normalization, weighted harmonic mean, and rolling Sharpe ratio:**

```python
# Z-score normalization per index
df = df.with_columns(
    ((pl.col("momentum_score") - pl.col("momentum_score").mean().over("index_key"))
     / pl.col("momentum_score").std().over("index_key"))
    .alias("momentum_z")
)

# Weighted harmonic mean (for P/E ratios)
def weighted_harmonic_mean(values: pl.Expr, weights: pl.Expr) -> pl.Expr:
    return weights.sum() / (weights / values).sum()

pe_harmonic = df.group_by("index_key").agg(
    weighted_harmonic_mean(pl.col("pe_ratio"), pl.col("market_cap")).alias("index_pe")
)

# Rolling Sharpe ratio
df = df.with_columns(
    (pl.col("daily_return").rolling_mean(window_size=252)
     / pl.col("daily_return").rolling_std(window_size=252)
     * (252 ** 0.5))
    .over("symbol")
    .alias("sharpe_252d")
)
```

---

## 28.3 Testing FastAPI and Polars in Production

### Testing FastAPI with httpx

**Testing FastAPI endpoints using httpx AsyncClient:**

```python
import pytest
from httpx import AsyncClient, ASGITransport
from main import app

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

@pytest.mark.anyio
async def test_trigger_pipeline(client):
    response = await client.post("/pipeline/trigger", json={
        "index_key": "market_index",
        "target_date": "2026-03-10",
        "dry_run": True
    })
    assert response.status_code == 200
    assert response.json()["status"] == "STARTED"

@pytest.mark.anyio
async def test_invalid_index_key_rejected(client):
    response = await client.post("/pipeline/trigger", json={
        "index_key": "INVALID KEY WITH SPACES",  # violates pattern regex
        "target_date": "2026-03-10"
    })
    assert response.status_code == 422  # Pydantic validation error

@pytest.mark.anyio
async def test_ohlcv_validation():
    """Pydantic catches invalid financial data before it reaches the DB."""
    with pytest.raises(ValueError, match="high_price must be >= open_price"):
        OHLCVRecord(
            symbol="SAP.DE", trade_date="2026-03-10",
            open_price=200.50, high_price=195.00,  # high < open = invalid
            low_price=190.00, close_price=198.00, volume=1000000
        )
```

### Testing Polars Transforms

**Testing Polars DataFrame transformations with assert_frame_equal:**

```python
import polars as pl
from polars.testing import assert_frame_equal

def test_daily_return_calculation():
    df = pl.DataFrame({
        "symbol": ["SAP", "SAP", "SAP"],
        "close_price": [100.0, 105.0, 102.0],
    })
    result = df.with_columns(
        (pl.col("close_price") / pl.col("close_price").shift(1) - 1).alias("return")
    )
    expected_returns = [None, 0.05, -0.02857]  # approximate
    assert result["return"][0] is None
    assert abs(result["return"][1] - 0.05) < 0.0001
    assert abs(result["return"][2] - (-0.02857)) < 0.001
```

> [!tip] Polars Testing
> Use `polars.testing.assert_frame_equal` instead of manual comparisons for DataFrames — it handles null values, floating-point tolerances, and schema comparison automatically.

---

## Gotchas & Edge Cases

- **Polars expressions vs pandas methods:** Polars does not have in-place operations (`df['col'] = ...`). All transformations return a new DataFrame. Use `with_columns()` to add columns.
- **Lazy mode and side effects:** Never put side effects (logging, DB writes) inside a Polars lazy expression — the expression may be reordered or optimized away. Execute side effects after `.collect()`.
- **FastAPI lifespan replaces `@app.on_event`:** The `@app.on_event("startup")` decorator is deprecated in FastAPI 0.93+. Use the `asynccontextmanager` lifespan pattern shown above.
- **Pydantic v2 breaking changes:** `validator` is replaced by `field_validator`. `__fields__` is replaced by `model_fields`. Import paths changed from `pydantic` to `pydantic.v1` if you need backward compat.
- **Cloud Run PORT env var:** Cloud Run sets the `PORT` environment variable. Do not hardcode port 8080 — use `${PORT:-8080}` as shown.

## Related
- [[dbt-transformation-layer]] — the SQL transformation layer that consumes data produced by these pipelines
- [[observability-deep-dive]] — DataDog instrumentation for FastAPI endpoints and Polars pipelines
- [[idempotent-pipeline-design]] — design patterns for the pipelines this API triggers
- [[five-pillars-of-data-engineering]] — broader Python data engineering context
- [[open-table-formats]] — Iceberg/Delta Lake as storage backends for Polars pipelines

## References
- [FastAPI documentation](https://fastapi.tiangolo.com/)
- [Polars user guide](https://docs.pola.rs/)
- [Pydantic v2 migration guide](https://docs.pydantic.dev/latest/migration/)
- [Starlette ASGI framework](https://www.starlette.io/)
