---
type: reference
category: programming-languages
technology: [python]
tags: [api, python]
aliases: [REST API, HTTP client, web server, FastAPI, ASP.NET, Flask, minimal API, requests]
keywords: [requests, FastAPI, Flask, httpx, REST, HTTP, JSON, authentication, middleware, routing]
description: "Python web and APIs reference with executable examples and cell outputs — covers HTTP clients with requests/httpx, REST API building with FastAPI and Flask, and authentication patterns. See [[15_cs_webapis]] for the C# equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[15_cs_webapis]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 15. Web & APIs - Python

Topics covered:
- HTTP Clients (requests, httpx)
- REST API Concepts
- Building a REST API (FastAPI)
- Data Engineering API Patterns

## HTTP Clients & REST API Calls

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

#### requests — sync GET and response parsing

One function per HTTP method: `requests.get/post/put/delete`. `params=` for query strings, `json=` for JSON body (auto-sets `Content-Type`), `headers=` for custom headers. `resp.json()` parses response; `resp.raise_for_status()` throws on 4xx/5xx. For concurrent calls, use `httpx.AsyncClient` instead.

> [!warning] Anti-patterns
> - **No timeout** — `requests` has no default timeout; always pass `timeout=`
> - **New session per request** — use `requests.Session()` for connection reuse
> - **Hardcoded API keys** — use env vars or secret managers

```python
resp = requests.get("https://httpbin.org/get", params={"ticker": "AAPL", "date": "2024-03-15"})

print("=== GET Request ===")
print(f"Status code: {resp.status_code}")
print(f"URL sent:    {resp.url}")
print(f"Content-Type: {resp.headers['Content-Type']}")

data = resp.json()
print(f"Args echoed: {data['args']}")
```

    === GET Request ===
    Status code: 200
    URL sent:    https://httpbin.org/get?ticker=AAPL&date=2024-03-15
    Content-Type: application/json
    Args echoed: {'date': '2024-03-15', 'ticker': 'AAPL'}

#### requests.post — send JSON data

```python
# POST — send a JSON body to an API endpoint
# Financial example: submit trade order, upload events, trigger pipeline.

trade_order = {
    "ticker": "AAPL",
    "side": "BUY",
    "quantity": 100,
    "limit_price": 178.50,
    "order_type": "LIMIT",
}

resp = requests.post("https://httpbin.org/post", json=trade_order)

print("=== POST Request ===")
print(f"Status: {resp.status_code}")
data = resp.json()
print(f"Body echoed: {data['json']}")
```

    === POST Request ===
    Status: 200
    Body echoed: {'limit_price': 178.5, 'order_type': 'LIMIT', 'quantity': 100, 'side': 'BUY', 'ticker': 'AAPL'}

#### requests headers — API keys and Bearer token authentication

```python
# Custom headers — API keys, bearer tokens for financial data providers

headers = {
    "Authorization": "Bearer sk_demo_fake_key_12345",
    "X-Client-Id": "trading-pipeline-v2",
    "Accept": "application/json",
}
resp = requests.get("https://httpbin.org/headers", headers=headers)

print("=== Custom Headers ===")
for k, v in resp.json()["headers"].items():
    if k.startswith(("Authorization", "X-Client", "Accept")):
        print(f"  {k}: {v}")
```

    === Custom Headers ===
      Accept: application/json
      Accept-Encoding: gzip, deflate, br
      Authorization: Bearer sk_demo_fake_key_12345
      X-Client-Id: trading-pipeline-v2

#### requests .status_code, .raise_for_status() — HTTP error handling

```python
# Status code handling — check success/failure, raise_for_status()

print("=== Status Code Handling ===")
for status_code in [200, 201, 400, 401, 404, 500]:
    resp = requests.get(f"https://httpbin.org/status/{status_code}")
    print(f"  {status_code}: {resp.status_code} {'OK' if resp.ok else 'FAILED'}")

# raise_for_status() — raises HTTPError for 4xx/5xx
# C# equivalent: resp.EnsureSuccessStatusCode()
try:
    resp = requests.get("https://httpbin.org/status/500")
    resp.raise_for_status()
except requests.HTTPError as e:
    print(f"\n  raise_for_status() caught: {e}")
```

    === Status Code Handling ===
      200: 200 OK
      201: 201 OK
      400: 400 FAILED
      401: 401 FAILED
      404: 404 FAILED
      500: 500 FAILED
    
      raise_for_status() caught: 500 Server Error: INTERNAL SERVER ERROR for url: https://httpbin.org/status/500

#### httpx — sync usage (drop-in requests replacement)

Same API as `requests` for sync usage, plus async support. `httpx.Client()` pools connections; `httpx.AsyncClient()` enables concurrent calls with `await`. Timeouts are enforced by default (unlike `requests`). Supports HTTP/2 for multiplexed connections. Use for pipelines with many API calls or any async Python application.

```python
resp = httpx.get("https://httpbin.org/get", params={"source": "httpx"})
print("=== httpx (sync) ===")
print(f"Status: {resp.status_code}")
print(f"Args: {resp.json()['args']}")
```

    === httpx (sync) ===
    Status: 200
    Args: {'source': 'httpx'}

#### httpx.Client — connection pooling

```python
# Client with connection pooling — reuse connections across requests
# C# equivalent: single HttpClient instance (IHttpClientFactory in DI)

print("=== httpx.Client (connection pooling) ===")
with httpx.Client(base_url="https://httpbin.org", timeout=10.0) as client:
    r1 = client.get("/get", params={"req": "1"})
    r2 = client.get("/get", params={"req": "2"})
    r3 = client.post("/post", json={"req": "3"})
    print(f"  GET /get?req=1: {r1.status_code}")
    print(f"  GET /get?req=2: {r2.status_code}")
    print(f"  POST /post:     {r3.status_code}")
```

    === httpx.Client (connection pooling) ===
      GET /get?req=1: 200
      GET /get?req=2: 200
      POST /post:     200

#### httpx.AsyncClient — concurrent API calls

```python
# Async — fetch multiple tickers concurrently
# Financial example: fetch quotes for 6 tickers in parallel

async def fetch_ticker_data(client, ticker):
    resp = await client.get("/get", params={"ticker": ticker})
    return {"ticker": ticker, "status": resp.status_code}

async def fetch_all_tickers():
    tickers = ["AAPL", "MSFT", "GOOG", "AMZN", "NVDA", "META"]
    async with httpx.AsyncClient(base_url="https://httpbin.org", timeout=10.0) as client:
        tasks = [fetch_ticker_data(client, t) for t in tickers]
        results = await asyncio.gather(*tasks)
    return results

print("=== httpx.AsyncClient (concurrent fetches) ===")
start = time.perf_counter()
results = await fetch_all_tickers()
elapsed = time.perf_counter() - start
for r in results:
    print(f"  {r['ticker']}: {r['status']}")
print(f"  All {len(results)} tickers in {elapsed:.2f}s")
```

    === httpx.AsyncClient (concurrent fetches) ===
      AAPL: 200
      MSFT: 200
      GOOG: 200
      AMZN: 200
      NVDA: 200
      META: 200
      All 6 tickers in 0.95s

#### requests vs httpx comparison

```python
# requests vs httpx feature comparison

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

<style type="text/css">
#T_ec28a_row0_col0, #T_ec28a_row0_col1, #T_ec28a_row0_col2, #T_ec28a_row1_col0, #T_ec28a_row1_col1, #T_ec28a_row1_col2, #T_ec28a_row2_col0, #T_ec28a_row2_col1, #T_ec28a_row2_col2, #T_ec28a_row3_col0, #T_ec28a_row3_col1, #T_ec28a_row3_col2, #T_ec28a_row4_col0, #T_ec28a_row4_col1, #T_ec28a_row4_col2, #T_ec28a_row5_col0, #T_ec28a_row5_col1, #T_ec28a_row5_col2, #T_ec28a_row6_col0, #T_ec28a_row6_col1, #T_ec28a_row6_col2 {
  text-align: left;
}
</style>
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

#### REST API pagination — fetch data in pages with requests

Three essential patterns for API integrations: **pagination** loops through pages until exhausted, **retry with exponential backoff** handles transient 429/5xx errors, and **bulk POST** batches records into one request to reduce round trips by 10-100x. For streaming APIs (WebSocket, SSE), use async streaming instead.

> [!warning] Anti-patterns
> - **Fetching all pages without limit** — unbounded loop if API broken
> - **Linear retry (no backoff)** — hammers the failing service
> - **One POST per record** — N round trips instead of 1

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

print("=== Pagination ===")
pages = fetch_paginated("https://httpbin.org", "/get", page_size=50)
for p in pages:
    print(f"  Page {p['page']}: fetched (params: {p['params']})")
print(f"  Total pages fetched: {len(pages)}")
```

    === Pagination ===
      Page 1: fetched (params: {'page': '1', 'per_page': '50'})
      Page 2: fetched (params: {'page': '2', 'per_page': '50'})
      Page 3: fetched (params: {'page': '3', 'per_page': '50'})
      Total pages fetched: 3

#### requests retry with exponential backoff — transient error recovery

```python
# Retry — recover from transient API failures with increasing delay

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

print("=== Retry with Backoff ===")
resp = fetch_with_retry("https://httpbin.org/get?ticker=AAPL")
print(f"  Success: {resp.status_code}")
```

    === Retry with Backoff ===
      Success: 200

#### requests bulk POST — batch multiple records in one call

```python
# Bulk POST — send multiple records in one request
# Financial example: batch-submit trade confirmations

print("=== Bulk POST ===")
batch = [
    {"trade_id": "TRD_001", "ticker": "AAPL", "qty": 100, "price": 178.50},
    {"trade_id": "TRD_002", "ticker": "MSFT", "qty": 50,  "price": 415.20},
    {"trade_id": "TRD_003", "ticker": "GOOG", "qty": 20,  "price": 172.30},
]

resp = httpx.post("https://httpbin.org/post", json={"trades": batch}, timeout=10.0)
data = resp.json()
print(f"  Sent {len(batch)} trades")
print(f"  Status: {resp.status_code}")
print(f"  Server received: {len(data['json']['trades'])} trades")
```

    === Bulk POST ===
      Sent 3 trades
      Status: 200
      Server received: 3 trades

## Building a REST API (FastAPI)

#### Pydantic models — request/response schemas

Define Pydantic models for request/response validation. `@app.get`/`post`/`delete` decorators wire handlers to routes. FastAPI auto-generates Swagger docs at `/docs`. `uvicorn` serves the ASGI app. Type hints drive validation, serialization, and documentation simultaneously.

> [!warning] Anti-patterns
> - **Business logic in route handlers** — extract to service functions
> - **In-memory storage in production** — use a database
> - **No input validation** — Pydantic handles types, but add business rules too

```python
# Pydantic models — like C# record types
# FastAPI auto-validates incoming requests against these.

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

```python
# FastAPI app instance + in-memory data store

app = FastAPI(title="Trading Pipeline API", version="1.0.0")

# In-memory store (in production: database)
trades_db: dict[str, dict] = {}
positions: dict[str, PortfolioPosition] = {
    "AAPL": PortfolioPosition(ticker="AAPL", shares=500, avg_cost=165.00, market_value=89_250.00),
    "MSFT": PortfolioPosition(ticker="MSFT", shares=200, avg_cost=380.50, market_value=83_040.00),
    "GOOG": PortfolioPosition(ticker="GOOG", shares=100, avg_cost=140.25, market_value=17_230.00),
}
```

#### GET endpoints — health, positions

```python
# GET endpoints — read data from the API

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

#### POST endpoint — submit trades

```python
# POST endpoint — create new trade orders with Pydantic validation

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

#### DELETE endpoint — cancel trades

```python
# DELETE endpoint — remove a trade by ID

@app.delete("/trades/{trade_id}")
def cancel_trade(trade_id: str):
    """Cancel (delete) a trade."""
    if trade_id not in trades_db:
        raise HTTPException(status_code=404, detail=f"Trade {trade_id} not found")
    del trades_db[trade_id]
    return {"status": "CANCELLED", "trade_id": trade_id}
```

#### uvicorn.Server — start FastAPI server programmatically in background

```python
# Run uvicorn in a background thread so we can test from the next cells
# uvicorn.Server API allows programmatic shutdown (unlike uvicorn.run)

PORT = 8769

config = uvicorn.Config(app, host="127.0.0.1", port=PORT, log_level="warning")
server = uvicorn.Server(config)

server_thread = threading.Thread(target=server.run, daemon=True)
server_thread.start()
time.sleep(1)

print(f"FastAPI server running on http://127.0.0.1:{PORT}")
print(f"Swagger docs: http://127.0.0.1:{PORT}/docs")
print(f"Run the next cells to test, then run the shutdown cell when done.")
```

    FastAPI server running on http://127.0.0.1:8769
    Swagger docs: http://127.0.0.1:8769/docs
    Run the next cells to test, then run the shutdown cell when done.

#### Test GET endpoints with httpx — health and positions

```python
# Test the API with httpx — same as calling any external API

BASE = "http://127.0.0.1:8765"

# Health check
print("=== Health Check ===")
resp = httpx.get(f"{BASE}/health")
print(f"  {resp.status_code}: {resp.json()}")

# GET all positions
print("\n=== GET /positions ===")
resp = httpx.get(f"{BASE}/positions")
for p in resp.json()["positions"]:
    print(f"  {p['ticker']}: {p['shares']} shares @ ${p['avg_cost']:.2f}")

# GET single position
print("\n=== GET /positions/AAPL ===")
resp = httpx.get(f"{BASE}/positions/AAPL")
print(f"  {resp.status_code}: {resp.json()}")

# GET missing position → 404
print("\n=== GET /positions/TSLA (not found) ===")
resp = httpx.get(f"{BASE}/positions/TSLA")
print(f"  {resp.status_code}: {resp.json()}")
```

    === Health Check ===
      200: {'status': 'healthy', 'service': 'trading-api'}
    
    === GET /positions ===
      AAPL: 500 shares @ $165.00
      MSFT: 200 shares @ $380.50
      GOOG: 100 shares @ $140.25
    
    === GET /positions/AAPL ===
      200: {'ticker': 'AAPL', 'shares': 500, 'avg_cost': 165.0, 'market_value': 89250.0}
    
    === GET /positions/TSLA (not found) ===
      404: {'detail': 'No position for TSLA'}

#### Test POST endpoint with httpx — submit and validate trades

```python
# POST trades — submit orders and test validation

print("=== POST /trades ===")
trades = [
    {"trade_id": "TRD_001", "ticker": "AAPL", "side": "BUY", "quantity": 100, "price": 178.50},
    {"trade_id": "TRD_002", "ticker": "MSFT", "side": "SELL", "quantity": 50, "price": 415.20},
]
for trade in trades:
    resp = httpx.post(f"{BASE}/trades", json=trade)
    print(f"  {resp.status_code}: {resp.json()}")

# POST duplicate → 409 Conflict
print("\n=== POST duplicate trade (conflict) ===")
resp = httpx.post(f"{BASE}/trades", json=trades[0])
print(f"  {resp.status_code}: {resp.json()}")

# POST invalid data → 422 (Pydantic validation)
print("\n=== POST invalid trade (validation error) ===")
resp = httpx.post(f"{BASE}/trades", json={"trade_id": "TRD_X", "ticker": "", "side": "INVALID", "quantity": -1, "price": 0})
print(f"  {resp.status_code}: {resp.json()['detail'][0]['msg']}")
```

    === POST /trades ===
      409: {'detail': 'Trade TRD_001 already exists'}
      409: {'detail': 'Trade TRD_002 already exists'}
    
    === POST duplicate trade (conflict) ===
      409: {'detail': 'Trade TRD_001 already exists'}
    
    === POST invalid trade (validation error) ===
      422: String should have at least 1 character

#### Test GET and DELETE endpoints with httpx — list and cancel trades

```python
# GET all trades and DELETE one

print("=== GET /trades ===")
resp = httpx.get(f"{BASE}/trades")
print(f"  {resp.json()['count']} trades")

# DELETE trade
print("\n=== DELETE /trades/TRD_001 ===")
resp = httpx.delete(f"{BASE}/trades/TRD_001")
print(f"  {resp.status_code}: {resp.json()}")

# Verify deletion
resp = httpx.get(f"{BASE}/trades")
print(f"  Remaining trades: {resp.json()['count']}")
```

    === GET /trades ===
      2 trades
    
    === DELETE /trades/TRD_001 ===
      200: {'status': 'CANCELLED', 'trade_id': 'TRD_001'}
      Remaining trades: 1

#### uvicorn graceful shutdown — stop FastAPI server

```python
# ─── Shutdown the FastAPI server ───
# Call server.should_exit to gracefully stop uvicorn.
# Without this, the server keeps running until the kernel restarts.

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
# Python FastAPI vs C# ASP.NET Minimal API comparison

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

<style type="text/css">
#T_ebb27_row0_col0, #T_ebb27_row0_col1, #T_ebb27_row0_col2, #T_ebb27_row1_col0, #T_ebb27_row1_col1, #T_ebb27_row1_col2, #T_ebb27_row2_col0, #T_ebb27_row2_col1, #T_ebb27_row2_col2, #T_ebb27_row3_col0, #T_ebb27_row3_col1, #T_ebb27_row3_col2, #T_ebb27_row4_col0, #T_ebb27_row4_col1, #T_ebb27_row4_col2, #T_ebb27_row5_col0, #T_ebb27_row5_col1, #T_ebb27_row5_col2, #T_ebb27_row6_col0, #T_ebb27_row6_col1, #T_ebb27_row6_col2, #T_ebb27_row7_col0, #T_ebb27_row7_col1, #T_ebb27_row7_col2, #T_ebb27_row8_col0, #T_ebb27_row8_col1, #T_ebb27_row8_col2, #T_ebb27_row9_col0, #T_ebb27_row9_col1, #T_ebb27_row9_col2 {
  text-align: left;
}
</style>
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

#### BaseModel basics — field types, defaults, and validation

Define a model with typed fields. Pydantic validates on construction: wrong types raise `ValidationError`.
Auto-coercion converts compatible types (`"25"` → `int 25`). `model_dump()` serializes to dict.
Fields without defaults are required; fields with defaults are optional.

```python
# Basic model — fields with types, defaults, and required markers
class User(BaseModel):
    name: str                          # required — no default
    age: int                           # required, auto-coerces "30" -> 30
    email: str                         # required
    active: bool = True                # optional with default
    tags: list[str] = []               # mutable default is safe in Pydantic

# Valid
user = User(name="Alice", age=30, email="alice@example.com")
print(f"Valid:   {user}")
print(f"Dict:   {user.model_dump()}")

# Coercion — string "25" becomes int 25
user2 = User(name="Bob", age="25", email="bob@test.com")
print(f"Coerced: {user2.age} (type: {type(user2.age).__name__})")

# Invalid — raises ValidationError
try:
    User(name="Bad", age="not_a_number", email="x")
except Exception as e:
    print(f"Error:  {e.errors()[0]['msg']}")
```

    Valid:   name='Alice' age=30 email='alice@example.com' active=True tags=[]
    Dict:   {'name': 'Alice', 'age': 30, 'email': 'alice@example.com', 'active': True, 'tags': []}
    Coerced: 25 (type: int)
    Error:  Input should be a valid integer, unable to parse string as an integer

#### Field constraints — min, max, regex, Literal for value restrictions

Use `Field(gt=0, max_length=5, pattern=r"^[A-Z]+$")` to constrain values at the schema level.
`Literal["BUY", "SELL"]` restricts to an exact set of allowed values (like a C# enum).
Demonstrates rejection of: too-short IDs, lowercase tickers, invalid sides, negative quantities, zero prices.

```python
# Field() — add constraints, descriptions, and examples to fields

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
print(f"Valid: {order}")

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

    Valid: trade_id='TRD_001' ticker='AAPL' side='BUY' quantity=100 price=178.5 notes=None
      trade_id too short: REJECTED — String should have at least 3 characters
      ticker lowercase: REJECTED — String should match pattern '^[A-Z]+$'
      invalid side: REJECTED — Input should be 'BUY' or 'SELL'
      negative qty: REJECTED — Input should be greater than 0
      zero price: REJECTED — Input should be greater than 0

#### Custom validators — `@field_validator` and `@model_validator`

`@field_validator("name")` adds custom validation to a single field (e.g. enforce snake_case, require dataset.table format).
`@model_validator(mode="after")` validates across multiple fields (e.g. `end_date` must be after `start_date`).
Both raise `ValueError` with a descriptive message that Pydantic wraps into `ValidationError`.

```python
# @field_validator — custom validation logic per field
# @model_validator — cross-field validation (access multiple fields)

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
print(f"Valid: {cfg.name} | {cfg.source_table} -> {cfg.target_table}")

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

    Valid: daily_etl | raw.events -> analytics.events_agg
      non-snake_case name: REJECTED — Value error, name must be snake_case (lowercase + underscores)
      table without dataset: REJECTED — Value error, table must be dataset.table format (e.g. raw.events)
      end before start: REJECTED — Value error, end_date (2024-01-01) must be after start_date (2024-06-01)

#### Nested models and enums — compose complex API schemas

Pydantic models can contain other models (`legs: list[OrderLeg]`) and enums (`status: OrderStatus`).
`Field(min_length=2, max_length=10)` constrains list length. `@model_validator` enforces
cross-field rules (PAIRS strategy requires exactly 2 legs). `model_dump_json()` serializes the entire tree.

```python
# Nested models — compose complex schemas from smaller models

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
print(f"Order: {order.order_id} | {order.strategy} | {len(order.legs)} legs | {order.status.value}")
print(f"Legs:  {[(l.ticker, l.side, l.quantity) for l in order.legs]}")
print(f"JSON:  {order.model_dump_json()[:100]}...")

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

    Order: MLO_001 | PAIRS | 2 legs | pending
    Legs:  [('AAPL', 'BUY', 100), ('MSFT', 'SELL', 50)]
    JSON:  {"order_id":"MLO_001","strategy":"PAIRS","legs":[{"ticker":"AAPL","side":"BUY","quantity":100,"price...
    PAIRS+3 legs: REJECTED — Value error, PAIRS strategy requires exactly 2 legs

#### Serialization — `model_dump`, `model_dump_json`, and field aliases

Control JSON output with `by_alias=True` for camelCase API responses (`pipeline_id` → `pipelineId`).
`exclude=` and `include=` filter which fields appear. `model_dump_json(indent=2)` produces
formatted JSON strings. `ConfigDict(populate_by_name=True)` accepts both alias and field name on input.

```python
# Serialization — convert models to dict/JSON with control over output

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

# Serialize with aliases (camelCase for JSON API)
print("by_alias=True (for API response):")
print(f"  {resp.model_dump(by_alias=True)}")

# Serialize with field names (for internal use)
print("\nby_alias=False (for internal):")
print(f"  {resp.model_dump()}")

# Exclude fields, include only specific fields
print(f"\nexclude processed_at: {resp.model_dump(exclude={'processed_at'})}")
print(f"include only status:  {resp.model_dump(include={'pipeline_id', 'status'})}")

# JSON string output
print(f"\nJSON: {resp.model_dump_json(by_alias=True, indent=2)}")
```

    by_alias=True (for API response):
      {'pipelineId': 'etl_daily', 'rowCount': 15000, 'status': 'success', 'processed_at': datetime.datetime(2026, 3, 27, 21, 34, 48, 392382)}
    
    by_alias=False (for internal):
      {'pipeline_id': 'etl_daily', 'row_count': 15000, 'status': 'success', 'processed_at': datetime.datetime(2026, 3, 27, 21, 34, 48, 392382)}
    
    exclude processed_at: {'pipeline_id': 'etl_daily', 'row_count': 15000, 'status': 'success'}
    include only status:  {'pipeline_id': 'etl_daily', 'status': 'success'}
    
    JSON: {
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
print(f"Config: {cfg}")

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
print(f"Valid strict: {trade}")
```

    Config: db_host='db.prod.internal' db_port=5432 ssl=True
    Frozen: Instance is frozen
    Strict: Input should be a valid integer
    Valid strict: ticker='AAPL' quantity=100 price=178.5

#### JSON Schema generation — `model_json_schema()` for API docs

Pydantic auto-generates a JSON Schema from the model definition. FastAPI uses this to build
Swagger/OpenAPI documentation automatically. The schema includes field types, constraints,
descriptions, and required/optional markers — no manual documentation needed.

```python
# model_json_schema() — generate JSON Schema for API documentation
# FastAPI uses this automatically to build Swagger/OpenAPI docs

schema = TradeOrder.model_json_schema()
print("=== TradeOrder JSON Schema ===")
print(json.dumps(schema, indent=2))
```

    === TradeOrder JSON Schema ===
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

#### Production checklist — 12 rules for safe Pydantic APIs

Summary table of production best practices: always use `BaseModel` (not dicts), always add
`Field()` constraints, use `Literal`/`Enum` for fixed options, add validators for business rules,
use aliases for public APIs, freeze config models, enable strict mode for financial data.

```python
# Production Pydantic checklist — rules for safe, maintainable APIs

checklist = pd.DataFrame({
    "Rule": [
        "Always use BaseModel for request/response",
        "Use Field() with constraints on every field",
        "Use Literal[] for fixed option sets",
        "Use Enum for status/state fields",
        "Add @field_validator for business rules",
        "Add @model_validator for cross-field rules",
        "Use aliases for camelCase API output",
        "Use frozen=True for config models",
        "Use strict=True when coercion is dangerous",
        "Return model_dump(by_alias=True) in responses",
        "Never expose internal field names in APIs",
        "Generate JSON schema for documentation",
    ],
    "Why": [
        "Validates all input — catches bad data at the door",
        "gt=0, max_length, pattern prevent garbage values",
        "Compile-time restriction — only valid values accepted",
        "Type-safe states — no magic strings for status",
        "snake_case enforcement, format checks, normalization",
        "end_date > start_date, at least 2 legs for PAIRS",
        "Python uses snake_case, APIs use camelCase",
        "Config should never change after loading",
        "Financial data — string 100 must not silently become int 100",
        "Consistent JSON output matching API contract",
        "Aliases decouple internal naming from public API",
        "Swagger/OpenAPI docs auto-generated from models",
    ],
})
checklist.style.set_properties(**{"text-align": "left"}).hide(axis="index")
```

<style type="text/css">
#T_46908_row0_col0, #T_46908_row0_col1, #T_46908_row1_col0, #T_46908_row1_col1, #T_46908_row2_col0, #T_46908_row2_col1, #T_46908_row3_col0, #T_46908_row3_col1, #T_46908_row4_col0, #T_46908_row4_col1, #T_46908_row5_col0, #T_46908_row5_col1, #T_46908_row6_col0, #T_46908_row6_col1, #T_46908_row7_col0, #T_46908_row7_col1, #T_46908_row8_col0, #T_46908_row8_col1, #T_46908_row9_col0, #T_46908_row9_col1, #T_46908_row10_col0, #T_46908_row10_col1, #T_46908_row11_col0, #T_46908_row11_col1 {
  text-align: left;
}
</style>
<table id="T_46908">
  <thead>
    <tr>
      <th id="T_46908_level0_col0" class="col_heading level0 col0" >Rule</th>
      <th id="T_46908_level0_col1" class="col_heading level0 col1" >Why</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td id="T_46908_row0_col0" class="data row0 col0" >Always use BaseModel for request/response</td>
      <td id="T_46908_row0_col1" class="data row0 col1" >Validates all input — catches bad data at the door</td>
    </tr>
    <tr>
      <td id="T_46908_row1_col0" class="data row1 col0" >Use Field() with constraints on every field</td>
      <td id="T_46908_row1_col1" class="data row1 col1" >gt=0, max_length, pattern prevent garbage values</td>
    </tr>
    <tr>
      <td id="T_46908_row2_col0" class="data row2 col0" >Use Literal[] for fixed option sets</td>
      <td id="T_46908_row2_col1" class="data row2 col1" >Compile-time restriction — only valid values accepted</td>
    </tr>
    <tr>
      <td id="T_46908_row3_col0" class="data row3 col0" >Use Enum for status/state fields</td>
      <td id="T_46908_row3_col1" class="data row3 col1" >Type-safe states — no magic strings for status</td>
    </tr>
    <tr>
      <td id="T_46908_row4_col0" class="data row4 col0" >Add @field_validator for business rules</td>
      <td id="T_46908_row4_col1" class="data row4 col1" >snake_case enforcement, format checks, normalization</td>
    </tr>
    <tr>
      <td id="T_46908_row5_col0" class="data row5 col0" >Add @model_validator for cross-field rules</td>
      <td id="T_46908_row5_col1" class="data row5 col1" >end_date > start_date, at least 2 legs for PAIRS</td>
    </tr>
    <tr>
      <td id="T_46908_row6_col0" class="data row6 col0" >Use aliases for camelCase API output</td>
      <td id="T_46908_row6_col1" class="data row6 col1" >Python uses snake_case, APIs use camelCase</td>
    </tr>
    <tr>
      <td id="T_46908_row7_col0" class="data row7 col0" >Use frozen=True for config models</td>
      <td id="T_46908_row7_col1" class="data row7 col1" >Config should never change after loading</td>
    </tr>
    <tr>
      <td id="T_46908_row8_col0" class="data row8 col0" >Use strict=True when coercion is dangerous</td>
      <td id="T_46908_row8_col1" class="data row8 col1" >Financial data — string 100 must not silently become int 100</td>
    </tr>
    <tr>
      <td id="T_46908_row9_col0" class="data row9 col0" >Return model_dump(by_alias=True) in responses</td>
      <td id="T_46908_row9_col1" class="data row9 col1" >Consistent JSON output matching API contract</td>
    </tr>
    <tr>
      <td id="T_46908_row10_col0" class="data row10 col0" >Never expose internal field names in APIs</td>
      <td id="T_46908_row10_col1" class="data row10 col1" >Aliases decouple internal naming from public API</td>
    </tr>
    <tr>
      <td id="T_46908_row11_col0" class="data row11 col0" >Generate JSON schema for documentation</td>
      <td id="T_46908_row11_col1" class="data row11 col1" >Swagger/OpenAPI docs auto-generated from models</td>
    </tr>
  </tbody>
</table>

## Summary

> [!abstract]- Quick Reference
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
