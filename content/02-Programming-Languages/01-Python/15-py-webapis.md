---
title: "15 - Web and APIs - Python"
tags: [api, python]
aliases: [REST API, HTTP client, web server, FastAPI, Flask, requests]
description: "Python web and APIs reference with executable examples and cell outputs — covers HTTP clients with requests/httpx, REST API building with FastAPI and Flask, and authentication patterns. See [15-cs-webapis](https://alp78.github.io/elysium/02-Programming-Languages/02-CSharp/15-cs-webapis) for the C# equivalent."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 15. Web & APIs - Python

> [!quote]
> "Web programming is the science of coming up with increasingly complicated ways of concatenating strings."
>
> — **Greg Brockman**

This note covers Python web and API patterns using `requests`, `httpx`, FastAPI, and Pydantic.

### Key terms used in this note

| Term | Plain-English definition | Why it matters here | Common mistake / confusion |
|---|---|---|---|
| `requests` | Synchronous Python HTTP library | Default for simple scripts and one-off API calls | No built-in timeout — always pass `timeout=` or it hangs forever |
| `httpx` | HTTP library with sync and async support | Use in async pipelines and production services | Forgetting to close the client; use `async with` or `with` |
| `AsyncClient` | `httpx` client for async/await usage | Enables concurrent HTTP calls without threading | Must be used inside an `async def`; not interchangeable with sync `Client` |
| ASGI | Asynchronous Server Gateway Interface | Protocol that FastAPI and Starlette implement | Confused with WSGI (Flask/Django sync); ASGI required for async endpoints |
| FastAPI | Modern async Python web framework | Used to build REST APIs with automatic validation and docs | Route handlers return plain dicts or Pydantic models, not `Response` objects |
| Pydantic `BaseModel` | Data validation class for request/response shapes | FastAPI uses it for auto-validation and 422 error generation | Forgetting to inherit from `BaseModel`; using a plain dataclass instead |
| `HTTPException` | FastAPI's mechanism for returning HTTP error responses | Standard way to return 404, 409, etc. from a handler | Raising a plain Python `Exception` instead, which returns 500 |
| `raise_for_status()` | `requests`/`httpx` method that raises on 4xx/5xx | Prevents silent failures on failed API calls | Forgetting to call it; checking `status_code` manually and missing edge cases |
| Retry with backoff | Pattern of retrying a failed request after an increasing delay | Required for rate-limited or flaky APIs | Retrying immediately in a loop without delay, causing faster rate-limit exhaustion |
| 429 Too Many Requests | HTTP status indicating rate limit exceeded | Must be handled explicitly; response includes `Retry-After` header | Ignoring the `Retry-After` header and using a fixed sleep interval |
| Pagination | Strategy for retrieving large datasets in pages | Prevents memory overload and API timeouts | Assuming all data fits in one response; not handling `next` cursors or empty pages |
| Bearer token | Auth credential passed in `Authorization: Bearer <token>` header | Standard OAuth 2.0 / API key authentication method | Hardcoding tokens in source code instead of loading from environment |
| `uvicorn` | ASGI server used to run FastAPI apps | Required to serve FastAPI; not a dev-only tool | Running `python app.py` directly instead of `uvicorn app:app` |
| Connection pooling | Reusing open TCP connections across requests | Reduces latency; critical in high-throughput pipelines | Creating a new `httpx.Client` per request in a loop |
| 422 Unprocessable Entity | HTTP status FastAPI returns when request body fails Pydantic validation | Automatic — no handler code needed if models are correct | Confusing with 400 Bad Request; FastAPI uses 422 specifically for validation errors |

### What this note covers

- HTTP clients with `requests` and `httpx` (sync and async)
- REST API patterns for data engineering (pagination, retry, bulk POST, rate limiting)
- Building a REST API with FastAPI (routes, Pydantic models, error handling)
- Data validation with Pydantic (field types, validators, nested models)
- Summary quick-reference table

## HTTP Clients & REST API Calls

`requests` and `httpx` are the two standard Python HTTP libraries. `requests` is synchronous and has no default timeout — best for simple scripts and one-off calls. `httpx` adds async support, connection pooling, and enforced timeouts — better suited for production pipelines. Import the full set of libraries used across this section.

```python
import requests
import json
import asyncio
import threading
import time
import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional
import pandas as pd
from datetime import datetime, date
from enum import Enum
from pydantic import BaseModel, Field, field_validator, model_validator
from pydantic import ConfigDict, EmailStr
from typing import Literal
```

### Making HTTP requests with requests

The `requests` library covers GET, POST, and all standard HTTP verbs with a simple, consistent API. These cells cover the most common patterns: GET with query params, POST with JSON body, custom headers, and status code handling.

#### requests — REST API sync GET and response parsing

One function per HTTP method: `requests.get/post/put/delete`. `params=` for query strings, `json=` for JSON body (auto-sets `Content-Type`), `headers=` for custom headers. `resp.json()` parses response; `resp.raise_for_status()` throws on 4xx/5xx. For concurrent calls, use `httpx.AsyncClient` instead.

> [!warning] Anti-patterns
>
> - **No timeout** — `requests` has no default timeout; always pass `timeout=`
> - **New session per request** — use `requests.Session()` for connection reuse
> - **Hardcoded API keys** — use env vars or secret managers

> [!success] Best practices for requests
>
> - Always set `timeout=(connect_timeout, read_timeout)` — e.g., `timeout=(5, 30)` to avoid hanging pipelines
> - Reuse `requests.Session()` across calls to the same host for connection pooling and shared headers
> - Load API keys from environment variables or a secrets manager; never commit them to source control

```python
resp = requests.get("https://httpbin.org/get", params={"ticker": "AAPL", "date": "2024-03-15"})

resp.status_code  # Status code
resp.url  # URL sent
resp.headers['Content-Type']  # Content-Type

data = resp.json()
data['args']  # Args echoed
```

    200
    https://httpbin.org/get?ticker=AAPL&date=2024-03-15
    application/json
    {'date': '2024-03-15', 'ticker': 'AAPL'}

#### requests.post — send JSON data

Pass a Python dict to `json=` — `requests` serializes it to JSON and sets `Content-Type: application/json` automatically. The server echoes the body in `resp.json()["json"]`. Python equivalent of C#'s `HttpClient.PostAsync` with `StringContent` and explicit UTF-8 encoding.

```python
trade_order = {
    "ticker": "AAPL",
    "side": "BUY",
    "quantity": 100,
    "limit_price": 178.50,
    "order_type": "LIMIT",
}

resp = requests.post("https://httpbin.org/post", json=trade_order)

resp.status_code  # Status
data = resp.json()
data['json']  # Body echoed
```

    200
    {'limit_price': 178.5, 'order_type': 'LIMIT', 'quantity': 100, 'side': 'BUY', 'ticker': 'AAPL'}

#### requests headers — API keys and Bearer token authentication

Pass a `headers` dict to any request call. For headers shared across multiple calls, create a `requests.Session()` and call `session.headers.update(headers)` once — the session sends them on every request. Never hardcode API keys; load them from environment variables or a secrets manager.

```python
headers = {
    "Authorization": "Bearer sk_demo_fake_key_12345",
    "X-Client-Id": "trading-pipeline-v2",
    "Accept": "application/json",
}
resp = requests.get("https://httpbin.org/headers", headers=headers)

for k, v in resp.json()["headers"].items():
    if k.startswith(("Authorization", "X-Client", "Accept")):
        print(f"  {k}: {v}")
```

      Accept: application/json
      Accept-Encoding: gzip, deflate, br
      Authorization: Bearer sk_demo_fake_key_12345
      X-Client-Id: trading-pipeline-v2

#### requests .status_code, .raise_for_status() — HTTP error handling

`resp.ok` is `True` for 2xx status codes. `raise_for_status()` raises `requests.HTTPError` for 4xx and 5xx — equivalent to C#'s `EnsureSuccessStatusCode()`. Call it after every request in production pipelines to fail fast rather than silently processing empty responses.

```python
for status_code in [200, 201, 400, 401, 404, 500]:
    resp = requests.get(f"https://httpbin.org/status/{status_code}")
    print(f"  {status_code}: {resp.status_code} {'OK' if resp.ok else 'FAILED'}")

try:
    resp = requests.get("https://httpbin.org/status/500")
    resp.raise_for_status()
except requests.HTTPError as e:
    print(f"\n  raise_for_status() caught: {e}")
```

      200: 200 OK
      201: 201 OK
      400: 400 FAILED
      401: 401 FAILED
      404: 404 FAILED
      500: 500 FAILED
    
      raise_for_status() caught: 500 Server Error: INTERNAL SERVER ERROR for url: https://httpbin.org/status/500

### Async and concurrent calls with httpx

`httpx` is a modern drop-in replacement for `requests` that adds async support and enforces timeouts by default. Use it when you need concurrent API calls (`AsyncClient`) or connection pooling (`Client`) for high-throughput pipelines.

#### httpx — sync usage (drop-in requests replacement)

Same API as `requests` for sync usage, plus async support. `httpx.Client()` pools connections; `httpx.AsyncClient()` enables concurrent calls with `await`. Timeouts are enforced by default (unlike `requests`). Supports HTTP/2 for multiplexed connections. Use for pipelines with many API calls or any async Python application.

```python
resp = httpx.get("https://httpbin.org/get", params={"source": "httpx"})
resp.status_code  # Status
resp.json()['args']  # Args
```

    200
    {'source': 'httpx'}

#### httpx.Client — connection pooling

Use `httpx.Client` as a context manager to pool connections across multiple requests to the same host, reducing TCP handshake overhead. C# equivalent: a single long-lived `HttpClient` instance or `IHttpClientFactory` in DI.

```python
with httpx.Client(base_url="https://httpbin.org", timeout=10.0) as client:
    r1 = client.get("/get", params={"req": "1"})
    r2 = client.get("/get", params={"req": "2"})
    r3 = client.post("/post", json={"req": "3"})
    print(f"  GET /get?req=1: {r1.status_code}")
    print(f"  GET /get?req=2: {r2.status_code}")
    print(f"  POST /post:     {r3.status_code}")
```

      GET /get?req=1: 200
      GET /get?req=2: 200
      POST /post:     200

#### httpx.AsyncClient — concurrent API calls

> [!warning] asyncio.gather() fires ALL tasks concurrently
>
> `asyncio.gather()` fires ALL tasks concurrently — add a semaphore for rate-limited APIs
> For 50 tickers, `gather(*tasks)` opens 50 connections simultaneously. Most financial
> data APIs reject bursts above 5-10 req/s. Use `asyncio.Semaphore(5)` to cap concurrency.
> See [13-py-advancedpipelines](https://alp78.github.io/elysium/02-Programming-Languages/01-Python/13-py-advancedpipelines) for the full rate-limited pattern.

> [!success] Gate concurrent requests with a Semaphore
>
> Wrap the fetch inside `async with asyncio.Semaphore(n):` to cap concurrent connections. For free-tier financial APIs (e.g., Twelve Data 8 req/min), use `Semaphore(3)` combined with `asyncio.sleep(0.5)` between batches. See [13-py-advancedpipelines](https://alp78.github.io/elysium/02-Programming-Languages/01-Python/13-py-advancedpipelines) for the complete pattern.

```python
async def fetch_ticker_data(client, ticker):
    resp = await client.get("/get", params={"ticker": ticker})
    return {"ticker": ticker, "status": resp.status_code}

async def fetch_all_tickers():
    tickers = ["AAPL", "MSFT", "GOOG", "AMZN", "NVDA", "META"]
    async with httpx.AsyncClient(base_url="https://httpbin.org", timeout=10.0) as client:
        tasks = [fetch_ticker_data(client, t) for t in tickers]
        results = await asyncio.gather(*tasks)
    return results

start = time.perf_counter()
results = await fetch_all_tickers()
elapsed = time.perf_counter() - start
for r in results:
    print(f"  {r['ticker']}: {r['status']}")
len(results), f"{elapsed:.2f}s"  # tickers fetched, elapsed
```

      AAPL: 200
      MSFT: 200
      GOOG: 200
      AMZN: 200
      NVDA: 200
      META: 200
      All 6 tickers in 0.95s

#### requests vs httpx comparison

```python
comparison = pd.DataFrame({
    "Feature": ["Sync support", "Async support", "HTTP/2", "Default timeout",
               "Connection pooling", "Streaming", "C# equivalent"],
    "requests": ["Yes", "No", "No", "None (!)",
                "Session()", "iter_content()", "—"],
    "httpx": ["Yes", "Yes (AsyncClient)", "Yes", "5s",
             "Client()", "stream()", "HttpClient"],
})
comparison.style.set_properties(**{"text-align": "left"}).hide(axis="index")
```

<table id="T_ec28a">
  <thead>
    <tr>
      <th id="T_ec28a_level0_col0" class="col_heading level0 col0" >Feature</th>
      <th id="T_ec28a_level0_col1" class="col_heading level0 col1" >requests</th>
      <th id="T_ec28a_level0_col2" class="col_heading level0 col2" >httpx</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td id="T_ec28a_row0_col0" class="data row0 col0" >Sync support</td>
      <td id="T_ec28a_row0_col1" class="data row0 col1" >Yes</td>
      <td id="T_ec28a_row0_col2" class="data row0 col2" >Yes</td>
    </tr>
    <tr>
      <td id="T_ec28a_row1_col0" class="data row1 col0" >Async support</td>
      <td id="T_ec28a_row1_col1" class="data row1 col1" >No</td>
      <td id="T_ec28a_row1_col2" class="data row1 col2" >Yes (AsyncClient)</td>
    </tr>
    <tr>
      <td id="T_ec28a_row2_col0" class="data row2 col0" >HTTP/2</td>
      <td id="T_ec28a_row2_col1" class="data row2 col1" >No</td>
      <td id="T_ec28a_row2_col2" class="data row2 col2" >Yes</td>
    </tr>
    <tr>
      <td id="T_ec28a_row3_col0" class="data row3 col0" >Default timeout</td>
      <td id="T_ec28a_row3_col1" class="data row3 col1" >None (!)</td>
      <td id="T_ec28a_row3_col2" class="data row3 col2" >5s</td>
    </tr>
    <tr>
      <td id="T_ec28a_row4_col0" class="data row4 col0" >Connection pooling</td>
      <td id="T_ec28a_row4_col1" class="data row4 col1" >Session()</td>
      <td id="T_ec28a_row4_col2" class="data row4 col2" >Client()</td>
    </tr>
    <tr>
      <td id="T_ec28a_row5_col0" class="data row5 col0" >Streaming</td>
      <td id="T_ec28a_row5_col1" class="data row5 col1" >iter_content()</td>
      <td id="T_ec28a_row5_col2" class="data row5 col2" >stream()</td>
    </tr>
    <tr>
      <td id="T_ec28a_row6_col0" class="data row6 col0" >C# equivalent</td>
      <td id="T_ec28a_row6_col1" class="data row6 col1" >—</td>
      <td id="T_ec28a_row6_col2" class="data row6 col2" >HttpClient</td>
    </tr>
  </tbody>
</table>

## REST API Patterns for Data Engineering

### Pagination, retry, and bulk batching

The three core patterns for robust API integration: pagination to traverse large datasets, exponential backoff to recover from transient failures, and bulk batching to minimize round trips. These patterns apply equally whether you use `requests`, `httpx`, or a vendor SDK.

#### REST API pagination — fetch data in pages with requests

Three essential patterns for API integrations: **pagination** loops through pages until exhausted, **retry with exponential backoff** handles transient 429/5xx errors, and **bulk POST** batches records into one request to reduce round trips by 10-100x. For streaming APIs (WebSocket, SSE), use async streaming instead.

> [!warning] Anti-patterns
>
> - **Fetching all pages without limit** — unbounded loop if API broken
> - **Linear retry (no backoff)** — hammers the failing service
> - **One POST per record** — N round trips instead of 1

> [!success] Robust REST integration patterns
>
> - Add a `max_pages` guard to pagination loops to prevent infinite loops on broken APIs
> - Use exponential backoff (`delay = base * 2 ** attempt`) with a cap (e.g., 60s) and honour `Retry-After` headers
> - Batch records into bulk POSTs (100-1000 items) to reduce round trips by 2-3 orders of magnitude

```python
def fetch_paginated(base_url, endpoint, page_size=100):
    all_records = []
    page = 1
    while True:
        resp = httpx.get(f"{base_url}{endpoint}",
            params={"page": page, "per_page": page_size}, timeout=10.0)
        resp.raise_for_status()
        data = resp.json()
        all_records.append({"page": page, "params": data["args"]})
        if page >= 3:
            break
        page += 1
    return all_records

pages = fetch_paginated("https://httpbin.org", "/get", page_size=50)
for p in pages:
    print(f"  Page {p['page']}: fetched (params: {p['params']})")
len(pages)  # Total pages fetched
```

      Page 1: fetched (params: {'page': '1', 'per_page': '50'})
      Page 2: fetched (params: {'page': '2', 'per_page': '50'})
      Page 3: fetched (params: {'page': '3', 'per_page': '50'})
    3

#### requests retry with exponential backoff — transient error recovery

```python
def fetch_with_retry(url, max_retries=3, base_delay=0.5):
    for attempt in range(max_retries):
        try:
            resp = httpx.get(url, timeout=5.0)
            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", base_delay))
                print(f"    Rate limited. Waiting {retry_after}s...")
                time.sleep(retry_after)
                continue
            resp.raise_for_status()
            return resp
        except (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.HTTPStatusError) as e:
            delay = base_delay * (2 ** attempt)
            print(f"    Attempt {attempt + 1} failed: {e}. Retrying in {delay:.1f}s...")
            time.sleep(delay)
    raise Exception(f"Failed after {max_retries} retries: {url}")

resp = fetch_with_retry("https://httpbin.org/get?ticker=AAPL")
resp.status_code  # Success
```

    200

#### requests bulk POST — batch multiple records in one call

```python
batch = [
    {"trade_id": "TRD_001", "ticker": "AAPL", "qty": 100, "price": 178.50},
    {"trade_id": "TRD_002", "ticker": "MSFT", "qty": 50,  "price": 415.20},
    {"trade_id": "TRD_003", "ticker": "GOOG", "qty": 20,  "price": 172.30},
]

resp = httpx.post("https://httpbin.org/post", json={"trades": batch}, timeout=10.0)
data = resp.json()
len(batch)  # trades sent
resp.status_code  # Status
len(data['json']['trades'])  # trades received by server
```

      Sent 3 trades
    200
    3 trades

## Building a REST API (FastAPI)

Define Pydantic models for request and response shapes, decorate handler functions with `@app.get`/`post`/`delete`, and serve with `uvicorn`. FastAPI validates request bodies against the declared Pydantic models before the handler runs, auto-generates Swagger docs at `/docs`, and returns 422 responses for invalid input.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {
  'primaryColor': '#292e42',
  'primaryTextColor': '#c0caf5',
  'primaryBorderColor': '#565f89',
  'lineColor': '#565f89',
  'secondaryColor': '#1a1b26',
  'tertiaryColor': '#24283b',
  'noteTextColor': '#c0caf5',
  'noteBkgColor': '#292e42',
  'textColor': '#c0caf5',
  'fontSize': '14px'
}}}%%
flowchart TD
    C["HTTP Client<br/>requests / httpx"] -->|"HTTP Request"| MW["FastAPI / Starlette<br/>ASGI middleware"]
    MW --> R["Route matching<br/>@app.get / post / delete"]
    R --> V["Pydantic validation<br/>BaseModel.__init__()"]
    V --> H["Handler function<br/>Python def / async def"]
    H -->|"return dict / BaseModel"| S["JSON Response<br/>200 / 201 / 404 / 409"]
    V -->|"ValidationError"| E["422 Unprocessable Entity<br/>{detail: [...]}"]
```

### Pydantic models and app setup

Define all request and response shapes as Pydantic `BaseModel` subclasses. FastAPI uses these models to validate incoming requests automatically, generate 422 error responses on invalid input, and build Swagger documentation.

#### Pydantic models — REST API request/response schemas

Define Pydantic models for request/response validation. `@app.get`/`post`/`delete` decorators wire handlers to routes. FastAPI auto-generates Swagger docs at `/docs`. `uvicorn` serves the ASGI app. Type hints drive validation, serialization, and documentation simultaneously.

> [!warning] Anti-patterns
>
> - **Business logic in route handlers** — extract to service functions
> - **In-memory storage in production** — use a database
> - **No input validation** — Pydantic handles types, but add business rules too

> [!success] Clean FastAPI architecture
>
> - Keep route handlers thin: validate with Pydantic, delegate to a service function, return the response
> - Use a real database (PostgreSQL, BigQuery, Cloud Spanner) for persistence — in-memory dicts are for prototyping only
> - Add `@field_validator` and `@model_validator` to Pydantic models for business rules (e.g., `end_date > start_date`, valid ticker format)

```python
class Trade(BaseModel):
    trade_id: str = Field(..., description="Unique trade identifier")
    ticker: str = Field(..., min_length=1, max_length=5)
    side: str = Field(..., pattern="^(BUY|SELL)$")
    quantity: int = Field(..., gt=0)
    price: float = Field(..., gt=0)

class TradeResponse(BaseModel):
    trade_id: str
    status: str
    message: str

class PortfolioPosition(BaseModel):
    ticker: str
    shares: int
    avg_cost: float
    market_value: float
```

#### FastAPI app and in-memory store

Instantiate `FastAPI()` with a title and version for the Swagger documentation header. The in-memory `dict` is sufficient for notebook testing; in production, inject a database connection via FastAPI's dependency injection (`Depends(get_db)`).

```python
app = FastAPI(title="Trading Pipeline API", version="1.0.0")

# In-memory store (in production: database)
trades_db: dict[str, dict] = {}
positions: dict[str, PortfolioPosition] = {
    "AAPL": PortfolioPosition(ticker="AAPL", shares=500, avg_cost=165.00, market_value=89_250.00),
    "MSFT": PortfolioPosition(ticker="MSFT", shares=200, avg_cost=380.50, market_value=83_040.00),
    "GOOG": PortfolioPosition(ticker="GOOG", shares=100, avg_cost=140.25, market_value=17_230.00),
}
```

### Route handlers

Each route handler is a plain Python function decorated with `@app.get`, `@app.post`, or `@app.delete`. FastAPI validates parameters and request bodies against the declared types before the handler runs. Use `HTTPException` to return error responses with the appropriate status code.

#### FastAPI REST API — GET endpoints health, positions

The health endpoint returns a fixed JSON response used by Kubernetes liveness probes. The positions endpoint accepts an optional `ticker` query parameter (`Query(None)`) and raises `HTTPException(404)` for missing tickers — FastAPI converts it to `{"detail": "..."}` automatically.

```python
@app.get("/health")
def health_check():
    """Health check endpoint — used by load balancers, K8s probes."""
    return {"status": "healthy", "service": "trading-api"}

@app.get("/positions")
def list_positions(ticker: Optional[str] = Query(None, description="Filter by ticker")):
    """List portfolio positions, optionally filtered by ticker."""
    if ticker:
        ticker = ticker.upper()
        if ticker not in positions:
            raise HTTPException(status_code=404, detail=f"No position for {ticker}")
        return {"positions": [positions[ticker]]}
    return {"positions": list(positions.values())}

@app.get("/positions/{ticker}")
def get_position(ticker: str):
    """Get a single position by ticker (path parameter)."""
    ticker = ticker.upper()
    if ticker not in positions:
        raise HTTPException(status_code=404, detail=f"No position for {ticker}")
    return positions[ticker]
```

#### FastAPI REST API — POST endpoint submit trades

`response_model=TradeResponse` tells FastAPI to serialize the return value using `TradeResponse`'s schema, excluding any extra fields from the internal `Trade` model. `status_code=201` sets the default success response code. FastAPI validates the request body against `Trade` before the handler runs.

```python
@app.post("/trades", response_model=TradeResponse, status_code=201)
def submit_trade(trade: Trade):
    """Submit a new trade order. Pydantic validates the request body."""
    if trade.trade_id in trades_db:
        raise HTTPException(status_code=409, detail=f"Trade {trade.trade_id} already exists")
    trades_db[trade.trade_id] = trade.model_dump()
    return TradeResponse(
        trade_id=trade.trade_id,
        status="ACCEPTED",
        message=f"{trade.side} {trade.quantity} {trade.ticker} @ {trade.price}",
    )

@app.get("/trades")
def list_trades():
    """List all submitted trades."""
    return {"trades": list(trades_db.values()), "count": len(trades_db)}

@app.get("/trades/{trade_id}")
def get_trade(trade_id: str):
    """Get a specific trade by ID."""
    if trade_id not in trades_db:
        raise HTTPException(status_code=404, detail=f"Trade {trade_id} not found")
    return trades_db[trade_id]
```

#### FastAPI REST API — DELETE endpoint cancel trades

`HTTPException(404)` fast-exits the handler — FastAPI converts it to `{"detail": "Trade TRD_001 not found"}`. No need to manually build error dicts or set response status codes.

```python
@app.delete("/trades/{trade_id}")
def cancel_trade(trade_id: str):
    """Cancel (delete) a trade."""
    if trade_id not in trades_db:
        raise HTTPException(status_code=404, detail=f"Trade {trade_id} not found")
    del trades_db[trade_id]
    return {"status": "CANCELLED", "trade_id": trade_id}
```

### Running and testing the server

Run the FastAPI application in a background thread for notebook testing. `uvicorn.Server` exposes a programmatic API for startup and graceful shutdown — unlike `uvicorn.run()`, it does not block the kernel.

#### uvicorn.Server — start FastAPI server programmatically in background

> [!info] Uvicorn in Background Thread
>
> `uvicorn.Server` API allows programmatic startup and shutdown from notebook cells. Unlike `uvicorn.run()` which blocks forever, the Server API runs in a background thread.

```python
PORT = 8769

config = uvicorn.Config(app, host="127.0.0.1", port=PORT, log_level="warning")
server = uvicorn.Server(config)

server_thread = threading.Thread(target=server.run, daemon=True)
server_thread.start()
time.sleep(1)

PORT  # FastAPI server running on http://127.0.0.1
# Swagger docs: http://127.0.0.1:{PORT}/docs
```

    FastAPI server running on http://127.0.0.1:8769
    http://127.0.0.1:8769/docs
    Run the next cells to test, then run the shutdown cell when done.

#### Test FastAPI GET endpoints with httpx — health and positions

Use `httpx` to call the live server, treating it exactly like any external API. This exercises the full FastAPI stack — Pydantic validation, exception handling, and response serialization — without any mocking.

```python
BASE = f"http://127.0.0.1:{PORT}"

# Health check
resp = httpx.get(f"{BASE}/health")
resp.json()  # {resp.status_code}

# GET all positions
resp = httpx.get(f"{BASE}/positions")
for p in resp.json()["positions"]:
    print(f"  {p['ticker']}: {p['shares']} shares @ ${p['avg_cost']:.2f}")

# GET single position
resp = httpx.get(f"{BASE}/positions/AAPL")
resp.json()  # {resp.status_code}

# GET missing position → 404
resp = httpx.get(f"{BASE}/positions/TSLA")
resp.json()  # {resp.status_code}
```

      200: {'status': 'healthy', 'service': 'trading-api'}
    
      AAPL: 500 shares @ $165.00
      MSFT: 200 shares @ $380.50
      GOOG: 100 shares @ $140.25
    
      200: {'ticker': 'AAPL', 'shares': 500, 'avg_cost': 165.0, 'market_value': 89250.0}
    
      404: {'detail': 'No position for TSLA'}

#### Test FastAPI POST endpoint with httpx — submit and validate trades

Submit valid trades, then test the conflict (409) and validation error (422) branches. FastAPI returns `{"detail": [...]}` for 422 responses — each element describes one failed constraint. The output may show 409 for both trades if the server state persists from the previous run.

```python
trades = [
    {"trade_id": "TRD_001", "ticker": "AAPL", "side": "BUY", "quantity": 100, "price": 178.50},
    {"trade_id": "TRD_002", "ticker": "MSFT", "side": "SELL", "quantity": 50, "price": 415.20},
]
for trade in trades:
    resp = httpx.post(f"{BASE}/trades", json=trade)
    print(f"  {resp.status_code}: {resp.json()}")

# POST duplicate → 409 Conflict
resp = httpx.post(f"{BASE}/trades", json=trades[0])
resp.json()  # {resp.status_code}

# POST invalid data → 422 (Pydantic validation)
resp = httpx.post(f"{BASE}/trades", json={"trade_id": "TRD_X", "ticker": "", "side": "INVALID", "quantity": -1, "price": 0})
resp.json()['detail'][0]['msg']  # {resp.status_code}
```

      409: {'detail': 'Trade TRD_001 already exists'}
      409: {'detail': 'Trade TRD_002 already exists'}
    
      409: {'detail': 'Trade TRD_001 already exists'}
    
      422: String should have at least 1 character

#### Test FastAPI GET and DELETE endpoints with httpx — list and cancel trades

Verify that `DELETE /trades/{id}` removes the trade and that subsequent `GET /trades` reflects the updated count. Tests the full lifecycle: submit → list → delete → verify.

```python
resp = httpx.get(f"{BASE}/trades")
resp.json()['count']  # trades

# DELETE trade
resp = httpx.delete(f"{BASE}/trades/TRD_001")
resp.json()  # {resp.status_code}

# Verify deletion
resp = httpx.get(f"{BASE}/trades")
resp.json()['count']  # Remaining trades
```

      2 trades
    
      200: {'status': 'CANCELLED', 'trade_id': 'TRD_001'}
    1

#### uvicorn graceful shutdown — stop FastAPI server

Set `server.should_exit = True` and join the thread to ensure the server finishes handling in-flight requests before releasing the port. Without this, the server continues running until the Jupyter kernel restarts, and subsequent cells cannot rebind to the same port.

```python
server.should_exit = True
server_thread.join(timeout=3)

if server_thread.is_alive():
    print("Server still shutting down...")
else:
    print(f"Server on port {PORT} stopped.")
```

    Server on port 8769 stopped.

#### FastAPI vs C# ASP.NET mapping

```python
pd.DataFrame({
    "Feature": ["Define GET route", "Define POST route", "Define DELETE route",
               "404 error", "Return JSON", "Request model",
               "Optional query param", "Path parameter", "Server", "API docs"],
    "FastAPI (Python)": [
        '@app.get("/path")', '@app.post("/path")', '@app.delete("/path")',
        "HTTPException(404)", "return {dict}", "BaseModel (Pydantic)",
        "Query(None)", "{id} in path", "uvicorn", "/docs (auto)"],
    "ASP.NET Minimal API (C#)": [
        'app.MapGet("/path", handler)', 'app.MapPost("/path", handler)', 'app.MapDelete("/path", handler)',
        "Results.NotFound()", "Results.Ok(new { ... })", "record (C# record)",
        "string? param", "{id} in route", "Kestrel (built-in)", "/swagger (AddSwaggerGen)"],
}).style.set_properties(**{"text-align": "left"}).hide(axis="index")
```

<table id="T_ebb27">
  <thead>
    <tr>
      <th id="T_ebb27_level0_col0" class="col_heading level0 col0" >Feature</th>
      <th id="T_ebb27_level0_col1" class="col_heading level0 col1" >FastAPI (Python)</th>
      <th id="T_ebb27_level0_col2" class="col_heading level0 col2" >ASP.NET Minimal API (C#)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td id="T_ebb27_row0_col0" class="data row0 col0" >Define GET route</td>
      <td id="T_ebb27_row0_col1" class="data row0 col1" >@app.get("/path")</td>
      <td id="T_ebb27_row0_col2" class="data row0 col2" >app.MapGet("/path", handler)</td>
    </tr>
    <tr>
      <td id="T_ebb27_row1_col0" class="data row1 col0" >Define POST route</td>
      <td id="T_ebb27_row1_col1" class="data row1 col1" >@app.post("/path")</td>
      <td id="T_ebb27_row1_col2" class="data row1 col2" >app.MapPost("/path", handler)</td>
    </tr>
    <tr>
      <td id="T_ebb27_row2_col0" class="data row2 col0" >Define DELETE route</td>
      <td id="T_ebb27_row2_col1" class="data row2 col1" >@app.delete("/path")</td>
      <td id="T_ebb27_row2_col2" class="data row2 col2" >app.MapDelete("/path", handler)</td>
    </tr>
    <tr>
      <td id="T_ebb27_row3_col0" class="data row3 col0" >404 error</td>
      <td id="T_ebb27_row3_col1" class="data row3 col1" >HTTPException(404)</td>
      <td id="T_ebb27_row3_col2" class="data row3 col2" >Results.NotFound()</td>
    </tr>
    <tr>
      <td id="T_ebb27_row4_col0" class="data row4 col0" >Return JSON</td>
      <td id="T_ebb27_row4_col1" class="data row4 col1" >return {dict}</td>
      <td id="T_ebb27_row4_col2" class="data row4 col2" >Results.Ok(new { ... })</td>
    </tr>
    <tr>
      <td id="T_ebb27_row5_col0" class="data row5 col0" >Request model</td>
      <td id="T_ebb27_row5_col1" class="data row5 col1" >BaseModel (Pydantic)</td>
      <td id="T_ebb27_row5_col2" class="data row5 col2" >record (C# record)</td>
    </tr>
    <tr>
      <td id="T_ebb27_row6_col0" class="data row6 col0" >Optional query param</td>
      <td id="T_ebb27_row6_col1" class="data row6 col1" >Query(None)</td>
      <td id="T_ebb27_row6_col2" class="data row6 col2" >string? param</td>
    </tr>
    <tr>
      <td id="T_ebb27_row7_col0" class="data row7 col0" >Path parameter</td>
      <td id="T_ebb27_row7_col1" class="data row7 col1" >{id} in path</td>
      <td id="T_ebb27_row7_col2" class="data row7 col2" >{id} in route</td>
    </tr>
    <tr>
      <td id="T_ebb27_row8_col0" class="data row8 col0" >Server</td>
      <td id="T_ebb27_row8_col1" class="data row8 col1" >uvicorn</td>
      <td id="T_ebb27_row8_col2" class="data row8 col2" >Kestrel (built-in)</td>
    </tr>
    <tr>
      <td id="T_ebb27_row9_col0" class="data row9 col0" >API docs</td>
      <td id="T_ebb27_row9_col1" class="data row9 col1" >/docs (auto)</td>
      <td id="T_ebb27_row9_col2" class="data row9 col2" >/swagger (AddSwaggerGen)</td>
    </tr>
  </tbody>
</table>

## Pydantic — Data Validation for Production APIs

Pydantic is Python’s standard for **runtime data validation**. You define a model class with type-annotated fields, and Pydantic:

1. **Validates** every value on construction — wrong types raise `ValidationError` immediately, not deep inside your pipeline
2. **Coerces** compatible types automatically — string `"42"` becomes `int 42` (disable with `strict=True`)
3. **Constrains** values via `Field()` — `gt=0`, `max_length=5`, `pattern=r"^[A-Z]+$"` reject garbage at the door
4. **Serializes** to dict/JSON with `model_dump()` / `model_dump_json()` — with alias support for camelCase APIs
5. **Generates JSON Schema** with `model_json_schema()` — FastAPI uses this to auto-build Swagger docs

FastAPI is built on top of Pydantic — every `@app.post` request body is a Pydantic model that’s validated before your handler runs.

This section covers Pydantic from basics to production patterns:
- BaseModel, Field constraints, Literal, Enum
- Custom validators (`@field_validator`, `@model_validator`)
- Nested models for complex API schemas
- Serialization with aliases (snake_case → camelCase)
- Immutability (`frozen=True`) and strict mode (`strict=True`)
- JSON Schema generation for API documentation
- Production checklist — 12 rules for safe APIs

### Field types and constraints

`BaseModel` is Pydantic's core class. Fields are declared as typed class attributes; Pydantic validates and coerces values on construction. `Field()` adds constraints, descriptions, and aliases to individual fields.

#### BaseModel basics — field types, defaults, and validation

Define a model with typed fields. Pydantic validates on construction: wrong types raise `ValidationError`.
Auto-coercion converts compatible types (`"25"` → `int 25`). `model_dump()` serializes to dict.
Fields without defaults are required; fields with defaults are optional.

```python
class User(BaseModel):
    name: str                          # required — no default
    age: int                           # required, auto-coerces "30" -> 30
    email: str                         # required
    active: bool = True                # optional with default
    tags: list[str] = []               # mutable default is safe in Pydantic

# Valid
user = User(name="Alice", age=30, email="alice@example.com")
user  # Valid
user.model_dump()  # Dict

# Coercion — string "25" becomes int 25
user2 = User(name="Bob", age="25", email="bob@test.com")
user2.age, type(user2.age).__name__  # coerced value, type

# Invalid — raises ValidationError
try:
    User(name="Bad", age="not_a_number", email="x")
except Exception as e:
    print(f"Error:  {e.errors()[0]['msg']}")
```

    name='Alice' age=30 email='alice@example.com' active=True tags=[]
    {'name': 'Alice', 'age': 30, 'email': 'alice@example.com', 'active': True, 'tags': []}
    25 (type: int)
    Input should be a valid integer, unable to parse string as an integer

#### Field constraints — min, max, regex, Literal for value restrictions

Use `Field(gt=0, max_length=5, pattern=r"^[A-Z]+$")` to constrain values at the schema level.
`Literal["BUY", "SELL"]` restricts to an exact set of allowed values (like a C# enum).
Demonstrates rejection of: too-short IDs, lowercase tickers, invalid sides, negative quantities, zero prices.

```python
class TradeOrder(BaseModel):
    trade_id: str = Field(..., min_length=3, max_length=20, description="Unique trade ID")
    ticker: str = Field(..., min_length=1, max_length=5, pattern=r"^[A-Z]+$",
                        description="Stock ticker (uppercase letters only)")
    side: Literal["BUY", "SELL"]       # only these two values allowed
    quantity: int = Field(..., gt=0, le=1_000_000, description="Number of shares")
    price: float = Field(..., gt=0, description="Price per share in USD")
    notes: str | None = Field(None, max_length=500, description="Optional notes")

# Valid order
order = TradeOrder(trade_id="TRD_001", ticker="AAPL", side="BUY", quantity=100, price=178.50)
order  # Valid

# Invalid — ticker must be uppercase letters, quantity must be > 0
for bad_data, label in [
    ({"trade_id": "T", "ticker": "AAPL", "side": "BUY", "quantity": 1, "price": 1}, "trade_id too short"),
    ({"trade_id": "TRD_X", "ticker": "aapl", "side": "BUY", "quantity": 1, "price": 1}, "ticker lowercase"),
    ({"trade_id": "TRD_X", "ticker": "AAPL", "side": "HOLD", "quantity": 1, "price": 1}, "invalid side"),
    ({"trade_id": "TRD_X", "ticker": "AAPL", "side": "BUY", "quantity": -5, "price": 1}, "negative qty"),
    ({"trade_id": "TRD_X", "ticker": "AAPL", "side": "BUY", "quantity": 1, "price": 0}, "zero price"),
]:
    try:
        TradeOrder(**bad_data)
        print(f"  {label}: PASSED (unexpected)")
    except Exception as e:
        print(f"  {label}: REJECTED — {e.errors()[0]['msg']}")
```

    trade_id='TRD_001' ticker='AAPL' side='BUY' quantity=100 price=178.5 notes=None
      trade_id too short: REJECTED — String should have at least 3 characters
      ticker lowercase: REJECTED — String should match pattern '^[A-Z]+$'
      invalid side: REJECTED — Input should be 'BUY' or 'SELL'
      negative qty: REJECTED — Input should be greater than 0
      zero price: REJECTED — Input should be greater than 0

### Custom validators

For validation logic that cannot be expressed as a `Field()` constraint — format checks, normalization, or cross-field rules — use `@field_validator` and `@model_validator`.

#### Custom validators — `@field_validator` and `@model_validator`

`@field_validator("name")` adds custom validation to a single field (e.g. enforce snake_case, require dataset.table format).
`@model_validator(mode="after")` validates across multiple fields (e.g. `end_date` must be after `start_date`).
Both raise `ValueError` with a descriptive message that Pydantic wraps into `ValidationError`.

```python
class PipelineConfig(BaseModel):
    name: str
    source_table: str
    target_table: str
    batch_size: int = Field(default=1000, gt=0)
    start_date: date
    end_date: date

    @field_validator("name")
    @classmethod
    def name_must_be_snake_case(cls, v: str) -> str:
        if not v.replace("_", "").isalnum() or v != v.lower():
            raise ValueError("name must be snake_case (lowercase + underscores)")
        return v

    @field_validator("source_table", "target_table")
    @classmethod
    def table_must_have_dataset(cls, v: str) -> str:
        if "." not in v:
            raise ValueError("table must be dataset.table format (e.g. raw.events)")
        return v

    @model_validator(mode="after")
    def end_after_start(self):
        if self.end_date <= self.start_date:
            raise ValueError(f"end_date ({self.end_date}) must be after start_date ({self.start_date})")
        return self

# Valid config
cfg = PipelineConfig(
    name="daily_etl", source_table="raw.events", target_table="analytics.events_agg",
    batch_size=5000, start_date="2024-01-01", end_date="2024-03-15"
)
cfg.name, cfg.source_table, cfg.target_table  # valid config

# Invalid — various validation failures
for bad, label in [
    ({"name": "DailyETL", "source_table": "raw.events", "target_table": "analytics.out",
      "start_date": "2024-01-01", "end_date": "2024-03-15"}, "non-snake_case name"),
    ({"name": "daily_etl", "source_table": "events", "target_table": "analytics.out",
      "start_date": "2024-01-01", "end_date": "2024-03-15"}, "table without dataset"),
    ({"name": "daily_etl", "source_table": "raw.events", "target_table": "analytics.out",
      "start_date": "2024-06-01", "end_date": "2024-01-01"}, "end before start"),
]:
    try:
        PipelineConfig(**bad)
    except Exception as e:
        msg = e.errors()[0]["msg"]
        print(f"  {label}: REJECTED — {msg}")
```

    daily_etl | raw.events -> analytics.events_agg
      non-snake_case name: REJECTED — Value error, name must be snake_case (lowercase + underscores)
      table without dataset: REJECTED — Value error, table must be dataset.table format (e.g. raw.events)
      end before start: REJECTED — Value error, end_date (2024-01-01) must be after start_date (2024-06-01)

### Nested models and enums

Build complex schemas by composing Pydantic models. Nested models are validated recursively; `Enum` and `Literal` restrict fields to fixed value sets.

#### Nested models and enums — compose complex API schemas

Pydantic models can contain other models (`legs: list[OrderLeg]`) and enums (`status: OrderStatus`).
`Field(min_length=2, max_length=10)` constrains list length. `@model_validator` enforces
cross-field rules (PAIRS strategy requires exactly 2 legs). `model_dump_json()` serializes the entire tree.

```python
class OrderStatus(str, Enum):
    PENDING = "pending"
    FILLED = "filled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"

class OrderLeg(BaseModel):
    ticker: str = Field(..., pattern=r"^[A-Z]{1,5}$")
    side: Literal["BUY", "SELL"]
    quantity: int = Field(..., gt=0)
    price: float = Field(..., gt=0)

class MultiLegOrder(BaseModel):
    order_id: str
    strategy: Literal["PAIRS", "SPREAD", "BASKET"]
    legs: list[OrderLeg] = Field(..., min_length=2, max_length=10)
    status: OrderStatus = OrderStatus.PENDING
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @model_validator(mode="after")
    def pairs_must_have_two_legs(self):
        if self.strategy == "PAIRS" and len(self.legs) != 2:
            raise ValueError("PAIRS strategy requires exactly 2 legs")
        return self

# Valid multi-leg order
order = MultiLegOrder(
    order_id="MLO_001",
    strategy="PAIRS",
    legs=[
        OrderLeg(ticker="AAPL", side="BUY", quantity=100, price=178.50),
        OrderLeg(ticker="MSFT", side="SELL", quantity=50, price=415.20),
    ]
)
order.order_id, order.strategy, len(order.legs), order.status.value  # order summary
[(l.ticker, l.side, l.quantity) for l in order.legs]  # legs
order.model_dump_json()[:100]  # JSON preview

# Invalid — PAIRS with 3 legs
try:
    MultiLegOrder(order_id="X", strategy="PAIRS", legs=[
        OrderLeg(ticker="A", side="BUY", quantity=1, price=1),
        OrderLeg(ticker="B", side="SELL", quantity=1, price=1),
        OrderLeg(ticker="C", side="BUY", quantity=1, price=1),
    ])
except Exception as e:
    print(f"PAIRS+3 legs: REJECTED — {e.errors()[0]['msg']}")
```

    MLO_001 | PAIRS | 2 legs | pending
    [('AAPL', 'BUY', 100), ('MSFT', 'SELL', 50)]
    {"order_id":"MLO_001","strategy":"PAIRS","legs":[{"ticker":"AAPL","side":"BUY","quantity":100,"price...
    PAIRS+3 legs: REJECTED — Value error, PAIRS strategy requires exactly 2 legs

### Serialization and immutability

Control how models serialize to JSON. Use field aliases to produce camelCase API responses while keeping Python's snake_case internally. Frozen models prevent mutation after construction.

#### Serialization — `model_dump`, `model_dump_json`, and field aliases

Control JSON output with `by_alias=True` for camelCase API responses (`pipeline_id` → `pipelineId`).
`exclude=` and `include=` filter which fields appear. `model_dump_json(indent=2)` produces
formatted JSON strings. `ConfigDict(populate_by_name=True)` accepts both alias and field name on input.

```python
class APIResponse(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,      # accept both alias and field name
    )

    pipeline_id: str = Field(..., alias="pipelineId")    # JSON uses camelCase
    row_count: int = Field(..., alias="rowCount")
    status: str
    processed_at: datetime = Field(default_factory=datetime.utcnow)

# Create with Python snake_case names
resp = APIResponse(pipeline_id="etl_daily", row_count=15000, status="success")

resp.model_dump(by_alias=True)  # by_alias=True (for API response)

# Serialize with field names (for internal use)
resp.model_dump()  # by_alias=False (for internal)

# Exclude fields, include only specific fields
resp.model_dump(exclude={'processed_at'})  # exclude processed_at
resp.model_dump(include={'pipeline_id', 'status'})  # include only status

# JSON string output
resp.model_dump_json(by_alias=True, indent=2)  # JSON
```

    {'pipelineId': 'etl_daily', 'rowCount': 15000, 'status': 'success', 'processed_at': datetime.datetime(2026, 3, 27, 21, 34, 48, 392382)}
    
    {'pipeline_id': 'etl_daily', 'row_count': 15000, 'status': 'success', 'processed_at': datetime.datetime(2026, 3, 27, 21, 34, 48, 392382)}
    
    {'pipeline_id': 'etl_daily', 'row_count': 15000, 'status': 'success'}
    {'pipeline_id': 'etl_daily', 'status': 'success'}
    
    {
      "pipelineId": "etl_daily",
      "rowCount": 15000,
      "status": "success",
      "processed_at": "2026-03-27T21:34:48.392382"
    }

#### Immutability and strict mode — `frozen=True`, `strict=True`

`frozen=True` makes the model immutable — any assignment after construction raises `ValidationError`.
Use for config objects that must never change. `strict=True` disables auto-coercion —
`"100"` is rejected for an `int` field instead of being silently converted. Critical for financial data.

```python
# Frozen model — immutable after creation (like frozen dataclass)

class ImmutableConfig(BaseModel):
    model_config = ConfigDict(frozen=True)   # assignment raises ValidationError

    db_host: str
    db_port: int = 5432
    ssl: bool = True

cfg = ImmutableConfig(db_host="db.prod.internal")
cfg  # Config

try:
    cfg.db_port = 9999   # frozen — can't modify
except Exception as e:
    print(f"Frozen: {e.errors()[0]['msg']}")

# Strict mode — no coercion, types must match exactly
class StrictTrade(BaseModel):
    model_config = ConfigDict(strict=True)

    ticker: str
    quantity: int          # "100" will NOT be coerced to 100
    price: float

# Strict: string "100" rejected for int field
try:
    StrictTrade(ticker="AAPL", quantity="100", price=178.5)
except Exception as e:
    print(f"Strict: {e.errors()[0]['msg']}")

# Strict: correct types work
trade = StrictTrade(ticker="AAPL", quantity=100, price=178.5)
trade  # Valid strict
```

    db_host='db.prod.internal' db_port=5432 ssl=True
    Instance is frozen
    Input should be a valid integer
    ticker='AAPL' quantity=100 price=178.5

#### JSON Schema generation — `model_json_schema()` for API docs

Pydantic auto-generates a JSON Schema from the model definition. FastAPI uses this to build
Swagger/OpenAPI documentation automatically. The schema includes field types, constraints,
descriptions, and required/optional markers — no manual documentation needed.

```python
schema = TradeOrder.model_json_schema()
json.dumps(schema, indent=2)
```

    {
      "properties": {
        "trade_id": {
          "description": "Unique trade ID",
          "maxLength": 20,
          "minLength": 3,
          "title": "Trade Id",
          "type": "string"
        },
        "ticker": {
          "description": "Stock ticker (uppercase letters only)",
          "maxLength": 5,
          "minLength": 1,
          "pattern": "^[A-Z]+$",
          "title": "Ticker",
          "type": "string"
        },
        "side": {
          "enum": [
            "BUY",
            "SELL"
          ],
          "title": "Side",
          "type": "string"
        },
        "quantity": {
          "description": "Number of shares",
          "exclusiveMinimum": 0,
          "maximum": 1000000,
          "title": "Quantity",
          "type": "integer"
        },
        "price": {
          "description": "Price per share in USD",
          "exclusiveMinimum": 0,
          "title": "Price",
          "type": "number"
        },
        "notes": {
          "anyOf": [
            {
              "maxLength": 500,
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "default": null,
          "description": "Optional notes",
          "title": "Notes"
        }
      },
      "required": [
        "trade_id",
        "ticker",
        "side",
        "quantity",
        "price"
      ],
      "title": "TradeOrder",
      "type": "object"
    }

### Production patterns

The checklist below distills 12 rules for production Pydantic APIs — from constraint coverage to alias usage to strict mode. Each rule includes the reason it matters.

#### Production checklist — 12 rules for safe Pydantic APIs

Summary table of production best practices: always use `BaseModel` (not dicts), always add
`Field()` constraints, use `Literal`/`Enum` for fixed options, add validators for business rules,
use aliases for public APIs, freeze config models, enable strict mode for financial data.

| Rule | Why |
|---|---|
| Always use `BaseModel` for request/response | Validates all input — catches bad data at the door |
| Use `Field()` with constraints on every field | `gt=0`, `max_length`, `pattern` prevent garbage values |
| Use `Literal[]` for fixed option sets | Compile-time restriction — only valid values accepted |
| Use `Enum` for status/state fields | Type-safe states — no magic strings for status |
| Add `@field_validator` for business rules | snake_case enforcement, format checks, normalization |
| Add `@model_validator` for cross-field rules | `end_date > start_date`, at least 2 legs for PAIRS |
| Use aliases for camelCase API output | Python uses snake_case, APIs use camelCase |
| Use `frozen=True` for config models | Config should never change after loading |
| Use `strict=True` when coercion is dangerous | Financial data — string `"100"` must not silently become int `100` |
| Return `model_dump(by_alias=True)` in responses | Consistent JSON output matching API contract |
| Never expose internal field names in APIs | Aliases decouple internal naming from public API |
| Generate JSON schema for documentation | Swagger/OpenAPI docs auto-generated from models |

## Summary

> [!abstract]- Quick Reference
>
> **HTTP Clients**
> | Pattern | Description |
> |---|---|
> | `requests.get(url, params=...)` | Sync GET |
> | `requests.post(url, json=...)` | Sync POST with JSON body |
> | `resp.json()` | Parse JSON response |
> | `resp.raise_for_status()` | Raise on 4xx/5xx |
> | `httpx.AsyncClient()` | Async client for concurrent calls |
> | `httpx.Client(base_url=...)` | Connection pooling |
>
> **FastAPI**
> | Pattern | Description |
> |---|---|
> | `@app.get("/path")` | Define GET endpoint |
> | `@app.post("/path", status_code=201)` | Define POST endpoint |
> | `Trade(BaseModel)` | Pydantic model for validation |
> | `HTTPException(status_code=404)` | Return error response |
> | `uvicorn main:app --reload` | Run the server |
>
> **REST Patterns:** pagination (offset/limit, cursor-based), retry + backoff, rate limit handling (429 + Retry-After), bulk POST
>
> **C# Equivalents:** `requests`/`httpx` → `HttpClient` | `FastAPI` → ASP.NET Minimal APIs | `Pydantic` → `record` + DataAnnotations | `uvicorn` → Kestrel | `@app.get` → `app.MapGet()` | `HTTPException` → `Results.NotFound()`

## Warnings

> [!warning] No default timeout in `requests`
> `requests.get(url)` has no timeout. It will block indefinitely if the server is slow or unresponsive.

> [!success] Always pass `timeout=`
> ```python
> resp = requests.get(url, timeout=10)
> ```

> [!warning] Creating a new `httpx.Client` per request in a loop
> Instantiating a client inside a loop bypasses connection pooling and degrades performance significantly.

> [!success] Instantiate once and reuse
> ```python
> with httpx.Client(base_url=BASE_URL) as client:
>     for item in items:
>         client.get(f"/endpoint/{item}")
> ```

> [!warning] Hardcoding Bearer tokens or API keys in source code
> Credentials committed to version control are a permanent security liability.

> [!success] Load credentials from environment variables
> ```python
> import os
> headers = {"Authorization": f"Bearer {os.environ['API_TOKEN']}"}
> ```

> [!warning] Ignoring `raise_for_status()` and checking `status_code` manually
> Manual status checks are easy to miss and often incomplete (e.g., only checking for 200, missing 201 or 204).

> [!success] Call `raise_for_status()` unconditionally after every request
> ```python
> resp = requests.get(url, timeout=10)
> resp.raise_for_status()
> ```

> [!warning] Raising plain `Exception` inside a FastAPI route instead of `HTTPException`
> A plain exception propagates as an unhandled 500 error with no useful response body for clients.

> [!success] Use `HTTPException` with an explicit `status_code`
> ```python
> from fastapi import HTTPException
> raise HTTPException(status_code=404, detail="Trade not found")
> ```

## Recommendations

- Always set an explicit `timeout=` on every `requests` or `httpx` call. Use 10–30 seconds for interactive APIs and 60–120 seconds for bulk or slow endpoints.
- Use `httpx.AsyncClient` (with `async with`) for any pipeline that makes more than one HTTP call per job execution — parallelism is free with `asyncio.gather`.
- Define all request and response shapes as Pydantic `BaseModel` subclasses before writing route handlers. FastAPI's validation, docs, and error responses all depend on correct model definitions.
- Handle pagination explicitly: never assume a single response contains all data. Implement cursor-based pagination when the API supports it; fall back to offset/limit only when cursors are unavailable.
- Implement retry with exponential backoff for all external API calls. Use `tenacity` or a manual loop. Always respect `Retry-After` headers on 429 responses.
- Store all credentials (tokens, API keys, secrets) in environment variables or a secrets manager. Never hardcode them.
- Use `httpx.Client(base_url=..., headers=...)` at the module level (or as a dependency-injected singleton) to share connection pools across requests in the same process.
- In FastAPI, return typed Pydantic models as `response_model=` on route decorators to enforce output validation and generate accurate OpenAPI schema.

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| `requests` call hangs indefinitely | No timeout set | Add `timeout=10` (or appropriate value) to every call |
| `ConnectionError` or `ReadTimeout` | Network instability or slow server | Wrap in retry with exponential backoff; check server health |
| `HTTPError: 429 Too Many Requests` | Rate limit exceeded | Read `Retry-After` header; sleep that duration before retrying |
| FastAPI returns 422 for valid-looking JSON | Pydantic model field type mismatch or missing required field | Check the `detail` array in the 422 response; verify model field types and aliases |
| `RuntimeError: no running event loop` | Calling `asyncio.run()` inside a Jupyter cell after another async call | Use `await` directly in Jupyter; avoid nested `asyncio.run()` |
| `httpx.AsyncClient` raises `RuntimeError: client is not open` | Client used after exiting the `async with` block | Keep all requests inside the `async with httpx.AsyncClient() as client:` block |
| Pydantic `ValidationError` on nested models | Inner model not defined as `BaseModel` subclass | Ensure every nested type is a `BaseModel`; plain dicts are not validated |
| `ImportError: No module named 'fastapi'` | `fastapi` not installed in the active virtual environment | Run `pip install fastapi uvicorn` in the correct environment |
| Bearer token rejected (401) | Token expired or wrong header format | Refresh the token; confirm header is `Authorization: Bearer <token>` (capital B) |
| Paginated API returns duplicate records across pages | Offset pagination with concurrent writes; item inserted between requests | Prefer cursor-based pagination; add deduplication by unique ID after collection |

