---
type: reference
category: programming-languages
technology: [python]
tags: [api, python]
aliases: [REST API, HTTP client, web server, FastAPI, ASP.NET, Flask, minimal API, requests]
keywords: [requests, FastAPI, Flask, httpx, REST, HTTP, JSON, authentication, middleware, routing]
description: "Python web and APIs reference with executable examples and cell outputs — covers HTTP clients with requests/httpx, REST API building with FastAPI and Flask, and authentication patterns. See [[14_cs_webapis]] for the C# equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[14_cs_webapis]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 13. Web & APIs - Python

Topics covered:
- HTTP Clients (requests, httpx)
- REST API Concepts
- Building a REST API (FastAPI)
- Data Engineering API Patterns

## 1. HTTP Clients & REST API Calls


```python
# HTTP Clients — making API calls in Python
#
# KEY CONCEPTS:
# - requests: the classic sync HTTP library. Simple, widely used.
#   C# equivalent: HttpClient
# - httpx: modern alternative — supports async, HTTP/2, timeouts by default.
#   C# equivalent: HttpClient with async/await
# - REST: Representational State Transfer — API design pattern.
#   GET (read), POST (create), PUT (replace), PATCH (update), DELETE (remove).
# - Status codes: 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized,
#   404 Not Found, 429 Too Many Requests, 500 Internal Server Error.
# - Headers: Content-Type, Authorization, Accept — metadata for the request.
# - JSON: the standard data format for REST APIs.
#
# We use httpbin.org — a free service that echoes back your requests.
# No API key needed, safe for testing.

import requests
import json

# ─── GET request — read data ───
# Most common operation: fetch data from an API.
# Financial example: fetch market quotes, index constituents, EOD prices.

resp = requests.get("https://httpbin.org/get", params={"ticker": "AAPL", "date": "2024-03-15"})

print("=== GET Request ===")
print(f"Status code: {resp.status_code}")   # 200 = OK
print(f"URL sent:    {resp.url}")             # shows query string appended
print(f"Content-Type: {resp.headers['Content-Type']}")

# Parse JSON response
data = resp.json()  # dict — same as json.loads(resp.text)
print(f"Args echoed: {data['args']}")  # httpbin echoes our params back

# ─── POST request — send data ───
# Create/submit data: submit a trade order, upload events, trigger a pipeline.

trade_order = {
    "ticker": "AAPL",
    "side": "BUY",
    "quantity": 100,
    "limit_price": 178.50,
    "order_type": "LIMIT",
}

resp = requests.post("https://httpbin.org/post", json=trade_order)
# json= sets Content-Type: application/json automatically

print("\n=== POST Request ===")
print(f"Status: {resp.status_code}")
data = resp.json()
print(f"Body echoed: {data['json']}")  # httpbin echoes our JSON body

# ─── Headers & Authentication ───
# API keys, bearer tokens — common for financial data providers.
# NEVER hardcode real keys in notebooks — use env vars.

headers = {
    "Authorization": "Bearer sk_demo_fake_key_12345",
    "X-Client-Id": "trading-pipeline-v2",
    "Accept": "application/json",
}
resp = requests.get("https://httpbin.org/headers", headers=headers)

print("\n=== Custom Headers ===")
for k, v in resp.json()["headers"].items():
    if k.startswith(("Authorization", "X-Client", "Accept")):
        print(f"  {k}: {v}")

# ─── Status code handling ───
# Always check status codes — don't assume success.

print("\n=== Status Code Handling ===")
for code in [200, 201, 400, 401, 404, 500]:
    resp = requests.get(f"https://httpbin.org/status/{code}")
    print(f"  {code}: {resp.status_code} {'OK' if resp.ok else 'FAILED'}")

# resp.raise_for_status() — raises HTTPError for 4xx/5xx
try:
    resp = requests.get("https://httpbin.org/status/500")
    resp.raise_for_status()
except requests.HTTPError as e:
    print(f"\n  raise_for_status() caught: {e}")
```

    === GET Request ===
    Status code: 200
    URL sent:    https://httpbin.org/get?ticker=AAPL&date=2024-03-15
    Content-Type: application/json
    Args echoed: {'date': '2024-03-15', 'ticker': 'AAPL'}
    
    === POST Request ===
    Status: 200
    Body echoed: {'limit_price': 178.5, 'order_type': 'LIMIT', 'quantity': 100, 'side': 'BUY', 'ticker': 'AAPL'}
    
    === Custom Headers ===
      Accept: application/json
      Accept-Encoding: gzip, deflate
      Authorization: Bearer sk_demo_fake_key_12345
      X-Client-Id: trading-pipeline-v2
    
    === Status Code Handling ===
      200: 200 OK
      201: 201 OK
      400: 400 FAILED
      401: 401 FAILED
      404: 404 FAILED
      500: 500 FAILED
    
      raise_for_status() caught: 500 Server Error: INTERNAL SERVER ERROR for url: https://httpbin.org/status/500
    


```python
# httpx — modern async-capable HTTP client
#
# KEY DIFFERENCES from requests:
# - Async support: async with httpx.AsyncClient() for concurrent API calls
# - HTTP/2 support (requests is HTTP/1.1 only)
# - Timeouts enforced by default (requests has no timeout by default!)
# - Connection pooling built-in with Client()
#
# For pipelines making many API calls, httpx with async is much faster.

import httpx
import time

# ─── Sync usage (same API as requests) ───

resp = httpx.get("https://httpbin.org/get", params={"source": "httpx"})
print("=== httpx (sync) ===")
print(f"Status: {resp.status_code}")
print(f"Args: {resp.json()['args']}")

# ─── Client with connection pooling ───
# Reuse connections across multiple requests — faster for batch API calls.
# C# equivalent: single HttpClient instance reused (IHttpClientFactory in DI).

print("\n=== httpx.Client (connection pooling) ===")
with httpx.Client(base_url="https://httpbin.org", timeout=10.0) as client:
    # base_url — all paths are relative, like HttpClient.BaseAddress in C#
    r1 = client.get("/get", params={"req": "1"})
    r2 = client.get("/get", params={"req": "2"})
    r3 = client.post("/post", json={"req": "3"})
    print(f"  GET /get?req=1: {r1.status_code}")
    print(f"  GET /get?req=2: {r2.status_code}")
    print(f"  POST /post:     {r3.status_code}")

# ─── Async usage (for concurrent API calls) ───
# Financial DE example: fetch quotes for multiple tickers concurrently.

import asyncio

async def fetch_ticker_data(client, ticker):
    """Simulate fetching market data for a ticker."""
    resp = await client.get("/get", params={"ticker": ticker})
    return {"ticker": ticker, "status": resp.status_code}

async def fetch_all_tickers():
    tickers = ["AAPL", "MSFT", "GOOG", "AMZN", "NVDA", "META"]
    async with httpx.AsyncClient(base_url="https://httpbin.org", timeout=10.0) as client:
        tasks = [fetch_ticker_data(client, t) for t in tickers]
        results = await asyncio.gather(*tasks)
    return results

print("\n=== httpx.AsyncClient (concurrent fetches) ===")
start = time.perf_counter()
results = await fetch_all_tickers()
elapsed = time.perf_counter() - start
for r in results:
    print(f"  {r['ticker']}: {r['status']}")
print(f"  All {len(results)} tickers in {elapsed:.2f}s")

# ─── Comparison ───
print("\n=== requests vs httpx ===")
print("""
Feature              requests            httpx
───────────────────  ──────────────────  ──────────────────
Sync support         Yes                 Yes
Async support        No                  Yes (AsyncClient)
HTTP/2               No                  Yes
Default timeout      None (!)            5s
Connection pooling   Session()           Client()
Streaming            iter_content()      stream()
C# equivalent        —                   HttpClient
""")
```

    === httpx (sync) ===
    Status: 200
    Args: {'source': 'httpx'}
    
    === httpx.Client (connection pooling) ===
      GET /get?req=1: 502
      GET /get?req=2: 200
      POST /post:     200
    
    === httpx.AsyncClient (concurrent fetches) ===
      AAPL: 200
      MSFT: 200
      GOOG: 200
      AMZN: 200
      NVDA: 200
      META: 200
      All 6 tickers in 0.82s
    
    === requests vs httpx ===
    
    Feature              requests            httpx
    ───────────────────  ──────────────────  ──────────────────
    Sync support         Yes                 Yes
    Async support        No                  Yes (AsyncClient)
    HTTP/2               No                  Yes
    Default timeout      None (!)            5s
    Connection pooling   Session()           Client()
    Streaming            iter_content()      stream()
    C# equivalent        —                   HttpClient
    
    

## 2. REST API Patterns for Data Engineering


```python
# REST API patterns commonly used in DE/finance pipelines.
#
# KEY PATTERNS:
# - Pagination: APIs return data in pages (offset/limit, cursor-based).
# - Rate limiting: APIs limit requests per minute/hour. Respect 429 responses.
# - Retry with backoff: transient failures (500, timeout) → retry with delay.
# - Bulk endpoints: send multiple records in one request.

import httpx
import time

# ─── Pattern 1: Pagination ───
# Most APIs don't return all data at once.
# Common patterns: offset+limit, cursor/next_token, Link header.
# Financial example: paginating through trade history.

def fetch_paginated(base_url, endpoint, page_size=100):
    """Fetch all pages from a paginated API."""
    all_records = []
    page = 1
    while True:
        resp = httpx.get(
            f"{base_url}{endpoint}",
            params={"page": page, "per_page": page_size},
            timeout=10.0,
        )
        resp.raise_for_status()
        data = resp.json()

        # httpbin echoes params — simulate pagination logic
        all_records.append({"page": page, "params": data["args"]})

        # Stop condition: in a real API, check if len(data) < page_size
        # or if there's no 'next' cursor/link
        if page >= 3:  # demo: stop after 3 pages
            break
        page += 1

    return all_records

print("=== Pagination ===")
pages = fetch_paginated("https://httpbin.org", "/get", page_size=50)
for p in pages:
    print(f"  Page {p['page']}: fetched (params: {p['params']})")
print(f"  Total pages fetched: {len(pages)}")

# ─── Pattern 2: Retry with exponential backoff ───
# Network errors and 500s happen. Retry with increasing delay.
# Financial example: exchange API gateway timeouts during market open.

def fetch_with_retry(url, max_retries=3, base_delay=0.5):
    """GET with exponential backoff retry."""
    for attempt in range(max_retries):
        try:
            resp = httpx.get(url, timeout=5.0)
            if resp.status_code == 429:  # rate limited
                retry_after = int(resp.headers.get("Retry-After", base_delay))
                print(f"    Rate limited. Waiting {retry_after}s...")
                time.sleep(retry_after)
                continue
            resp.raise_for_status()
            return resp
        except (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.HTTPStatusError) as e:
            delay = base_delay * (2 ** attempt)  # exponential: 0.5, 1.0, 2.0
            print(f"    Attempt {attempt + 1} failed: {e}. Retrying in {delay:.1f}s...")
            time.sleep(delay)
    raise Exception(f"Failed after {max_retries} retries: {url}")

print("\n=== Retry with Backoff ===")
resp = fetch_with_retry("https://httpbin.org/get?ticker=AAPL")
print(f"  Success: {resp.status_code}")

# ─── Pattern 3: Bulk POST (batch insert) ───
# Send multiple records in one request — common for event ingestion.
# Financial example: batch-submit trade confirmations.

print("\n=== Bulk POST ===")
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

    === Pagination ===
      Page 1: fetched (params: {'page': '1', 'per_page': '50'})
      Page 2: fetched (params: {'page': '2', 'per_page': '50'})
      Page 3: fetched (params: {'page': '3', 'per_page': '50'})
      Total pages fetched: 3
    
    === Retry with Backoff ===
      Success: 200
    
    === Bulk POST ===
      Sent 3 trades
      Status: 200
      Server received: 3 trades
    

## 3. Building a REST API (FastAPI)


```python
# FastAPI — modern Python web framework for building REST APIs.
#
# KEY CONCEPTS:
# - FastAPI: async-first, auto-generates OpenAPI docs, type validation with Pydantic.
#   C# equivalent: ASP.NET Minimal APIs.
# - Pydantic models: define request/response schemas with type hints.
#   C# equivalent: record types + [Required] attributes.
# - Path parameters: /trades/{trade_id} — variable in the URL path.
# - Query parameters: /trades?ticker=AAPL — optional filters.
# - uvicorn: ASGI server that runs FastAPI apps.
#   C# equivalent: Kestrel (built into ASP.NET).
#
# NOTEBOOK NOTE:
# We define the app here and run it in a background thread so we can
# test it from the same notebook. In production: `uvicorn main:app --reload`.

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional
import uvicorn
import threading
import time
import httpx

# ─── Pydantic models (request/response schemas) ───
# Like C# record types — define the shape of your data.
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

# ─── FastAPI app ───

app = FastAPI(title="Trading Pipeline API", version="1.0.0")

# In-memory store (in production: database)
trades_db: dict[str, dict] = {}
positions: dict[str, PortfolioPosition] = {
    "AAPL": PortfolioPosition(ticker="AAPL", shares=500, avg_cost=165.00, market_value=89_250.00),
    "MSFT": PortfolioPosition(ticker="MSFT", shares=200, avg_cost=380.50, market_value=83_040.00),
    "GOOG": PortfolioPosition(ticker="GOOG", shares=100, avg_cost=140.25, market_value=17_230.00),
}

# ─── GET endpoints ───

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

# ─── POST endpoint ───

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

# ─── DELETE endpoint ───

@app.delete("/trades/{trade_id}")
def cancel_trade(trade_id: str):
    """Cancel (delete) a trade."""
    if trade_id not in trades_db:
        raise HTTPException(status_code=404, detail=f"Trade {trade_id} not found")
    del trades_db[trade_id]
    return {"status": "CANCELLED", "trade_id": trade_id}

# ─── Run server in background thread ───
# Use uvicorn.Server API so we can shut it down programmatically.
# Plain uvicorn.run() blocks forever and can't be stopped from another cell.

PORT = 8765

config = uvicorn.Config(app, host="127.0.0.1", port=PORT, log_level="warning")
server = uvicorn.Server(config)

server_thread = threading.Thread(target=server.run, daemon=True)
server_thread.start()
time.sleep(1)  # wait for server to start

print(f"FastAPI server running on http://127.0.0.1:{PORT}")
print(f"Swagger docs: http://127.0.0.1:{PORT}/docs")
print(f"OpenAPI spec: http://127.0.0.1:{PORT}/openapi.json")
print(f"Run the next cells to test, then run the shutdown cell when done.")
```

    FastAPI server running on http://127.0.0.1:8765
    Swagger docs: http://127.0.0.1:8765/docs
    OpenAPI spec: http://127.0.0.1:8765/openapi.json
    Run the next cells to test, then run the shutdown cell when done.
    


```python
# ─── Test the API with httpx ───
# Now we call our own API as a client — same as calling any external API.

import httpx

BASE = "http://127.0.0.1:8765"

# Health check
print("=== Health Check ===")
resp = httpx.get(f"{BASE}/health")
print(f"  {resp.status_code}: {resp.json()}")

# GET positions
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

# POST trades
print("\n=== POST /trades ===")
trades = [
    {"trade_id": "TRD_001", "ticker": "AAPL", "side": "BUY", "quantity": 100, "price": 178.50},
    {"trade_id": "TRD_002", "ticker": "MSFT", "side": "SELL", "quantity": 50, "price": 415.20},
]
for trade in trades:
    resp = httpx.post(f"{BASE}/trades", json=trade)
    print(f"  {resp.status_code}: {resp.json()}")

# POST duplicate → 409
print("\n=== POST duplicate trade (conflict) ===")
resp = httpx.post(f"{BASE}/trades", json=trades[0])
print(f"  {resp.status_code}: {resp.json()}")

# POST invalid data → 422 (Pydantic validation)
print("\n=== POST invalid trade (validation error) ===")
resp = httpx.post(f"{BASE}/trades", json={"trade_id": "TRD_X", "ticker": "", "side": "INVALID", "quantity": -1, "price": 0})
print(f"  {resp.status_code}: {resp.json()['detail'][0]['msg']}")

# GET all trades
print("\n=== GET /trades ===")
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
    
    === POST /trades ===
      201: {'trade_id': 'TRD_001', 'status': 'ACCEPTED', 'message': 'BUY 100 AAPL @ 178.5'}
      201: {'trade_id': 'TRD_002', 'status': 'ACCEPTED', 'message': 'SELL 50 MSFT @ 415.2'}
    
    === POST duplicate trade (conflict) ===
      409: {'detail': 'Trade TRD_001 already exists'}
    
    === POST invalid trade (validation error) ===
      422: String should have at least 1 character
    
    === GET /trades ===
      2 trades
    
    === DELETE /trades/TRD_001 ===
      200: {'status': 'CANCELLED', 'trade_id': 'TRD_001'}
      Remaining trades: 1
    


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

    Server on port 8765 stopped.
    

## 4. Summary


```python
# Summary — Python Web & APIs cheat sheet
#
# HTTP CLIENTS:
# requests.get(url, params=...)         Sync GET
# requests.post(url, json=...)          Sync POST with JSON body
# resp.json()                           Parse JSON response
# resp.raise_for_status()               Raise on 4xx/5xx
# httpx.AsyncClient()                   Async client for concurrent calls
# httpx.Client(base_url=...)            Connection pooling
#
# FASTAPI:
# @app.get("/path")                     Define GET endpoint
# @app.post("/path", status_code=201)   Define POST endpoint
# Trade(BaseModel)                      Pydantic model for validation
# HTTPException(status_code=404)        Return error response
# Query(), Path(), Body()               Parameter declarations
# uvicorn main:app --reload             Run the server
#
# REST PATTERNS:
# Pagination                            offset/limit, cursor-based
# Retry + backoff                       Handle transient failures
# Rate limit handling                   Respect 429 + Retry-After
# Bulk POST                             Batch multiple records
#
# C# EQUIVALENTS:
# requests / httpx      → HttpClient
# FastAPI               → ASP.NET Minimal APIs
# Pydantic              → record + DataAnnotations
# uvicorn               → Kestrel (built-in)
# @app.get              → app.MapGet()
# HTTPException         → Results.NotFound()
```
