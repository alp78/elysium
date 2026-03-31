---
type: reference
category: programming-languages
technology: [python]
tags: [python, pipeline]
aliases: [advanced pipelines, async generators, parallel ingestion, subprocess]
keywords: [async generator, asyncio.gather, as_completed, semaphore, rate limiting, subprocess, aiohttp, parallel API, batch consumer, distributed task queue, celery, dask]
description: "Python advanced parallel pipelines reference with executable examples and cell outputs — covers async generators, parallel API ingestion with rate limiting, async batching, subprocess execution, and distributed task queues. See [13_cs_advancedpipelines](https://alp78.github.io/elysium/02-Programming-Languages/CSharp/13_cs_advancedpipelines) for the C# equivalent."
created: 2026-03-25
updated: 2026-03-25
status: complete
---

# 13. Advanced Parallel Pipelines - Python

> [!quote]
> "The combination of threads, remote-procedure-call interfaces, and heavyweight object-oriented design is especially dangerous. If you are ever invited onto a project that is supposed to feature all three, fleeing in terror might well be an appropriate reaction."
>
> — **Eric S. Raymond**, *The Art of Unix Programming* (2003)

```python
# Imports and API keys from .env file
import asyncio
import time
import os
import json
import subprocess
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor
import aiohttp
from dotenv import load_dotenv

# Load API keys from .env file — keeps secrets out of code
# .env file must be in the same directory (or parent) as the notebook.
# In production: use secret managers (GCP Secret Manager, AWS Secrets, Azure Key Vault).
# NEVER commit .env to git — add it to .gitignore.
load_dotenv()

TWELVE_DATA_KEY = os.environ.get('TWELVE_DATA_KEY', '')
FRED_KEY = os.environ.get('FRED_KEY', '')
FINNHUB_KEY = os.environ.get('FINNHUB_KEY', '')

print(f'  TWELVE_DATA_KEY: {"set" if TWELVE_DATA_KEY else "MISSING"}')
print(f'  FRED_KEY:        {"set" if FRED_KEY else "MISSING"}')
print(f'  FINNHUB_KEY:     {"set" if FINNHUB_KEY else "MISSING"}')
```

      TWELVE_DATA_KEY: set
      FRED_KEY:        set
      FINNHUB_KEY:     set

## Async Generators with Real APIs

#### Paginated FRED API with async for

Many REST APIs return results in pages (100 items per response with a `next_page` token). An async generator fetches each page, yields individual items, and follows pagination links — providing a clean `async for item in paginate(url)` interface that hides the pagination complexity.

```python
# Async generator for paginated FRED API — stream economic data series
#
# WHAT: async def with yield produces items one at a time from an async source.
#   async for pulls items lazily — only one page in memory at a time.
#
# WHY: FRED has thousands of series. Loading all into memory wastes resources.
#   With async generator: fetch page 1 → yield items → fetch page 2 → yield...
#   Consumer processes items as they arrive. break stops fetching further pages.
#
# WHEN TO USE: any paginated REST API, database cursors, streaming file reads
# ANTI-PATTERNS:
#   - Don't collect all items into a list unless you need random access
#   - Don't use requests (blocking) — use aiohttp (async) inside async generators

async def fetch_fred_series(search_text: str, limit: int = 10, page_size: int = 5):
    """Async generator — yields (id, title) tuples from FRED series search."""
    offset = 0
    yielded = 0
    async with aiohttp.ClientSession() as session:
        while yielded < limit:
            url = (f'https://api.stlouisfed.org/fred/series/search'
                   f'?search_text={search_text}&api_key={FRED_KEY}'
                   f'&file_type=json&limit={page_size}&offset={offset}')
            async with session.get(url) as resp:
                data = await resp.json()
            series = data.get('seriess', [])
            if not series:
                break  # no more pages
            for s in series:
                if yielded >= limit:
                    break
                yield (s['id'], s['title'])  # yield one item at a time
                yielded += 1
            offset += page_size

# async for — consume items as they stream in from FRED
print('  FRED series matching "inflation":')
async for series_id, title in fetch_fred_series('inflation', limit=8):
    print(f'    {series_id:20} {title[:50]}')
```

      FRED series matching "inflation":
        DFII10               Market Yield on U.S. Treasury Securities at 10-Yea
        FII10                Market Yield on U.S. Treasury Securities at 10-Yea
        WFII10               Market Yield on U.S. Treasury Securities at 10-Yea
        RIFLGFCY10XIINA      Market Yield on U.S. Treasury Securities at 10-Yea
        T10YIE               10-Year Breakeven Inflation Rate
        T10YIEM              10-Year Breakeven Inflation Rate
        FPCPITOTLZGUSA       Inflation, consumer prices for the United States
        CPIAUCSL             Consumer Price Index for All Urban Consumers: All

## Parallel API Ingestion

> [!danger] asyncio.gather() without a semaphore fires
>
> `asyncio.gather()` without a semaphore fires ALL requests simultaneously
> For 50 symbols, `gather(*[fetch(s) for s in symbols])` opens 50 connections at once.
> Most financial data APIs have strict rate limits (Twelve Data: 8/min, Alpha Vantage:
> 5/min). Without a semaphore, every request after the limit returns `429 Too Many
> Requests` — and your pipeline processes empty/error responses as valid data.

#### asyncio.Semaphore + aiohttp — parallel fetch with rate limiting

Combines rate limiting (semaphore) with async HTTP (aiohttp) for parallel API fetches that respect rate limits. The semaphore caps concurrent requests; aiohttp reuses connections via a session pool. This is the standard pattern for fetching data from rate-limited financial APIs.

```python
# Parallel fetch with asyncio.Semaphore — limit concurrent API requests
#
# WHAT: asyncio.Semaphore(n) limits how many coroutines run a section concurrently.
#   Like SemaphoreSlim in C#. Combined with aiohttp for non-blocking HTTP.
#
# WHY: APIs have rate limits (e.g., 8 req/min for Twelve Data free tier).
#   Without throttling: all requests fire at once → 429 Too Many Requests.
#   Semaphore(3) ensures max 3 requests in flight at any time.
#
# ANTI-PATTERNS:
#   - Don't use requests library in async code — it blocks the event loop
#   - Don't create a new ClientSession per request — reuse one session
#   - Don't forget to close the session (use async with)

# Euro Stoxx 50 companies (ADR tickers available on Twelve Data free tier)
SYMBOLS = ['SAP', 'ASML', 'TTE', 'UL', 'DEO', 'SNY', 'NVS', 'AZN']

async def fetch_price(session, symbol, semaphore):
    """Fetch a single stock price with rate limiting."""
    async with semaphore:  # limits concurrent requests
        url = f'https://api.twelvedata.com/price?symbol={symbol}&apikey={TWELVE_DATA_KEY}'
        async with session.get(url) as resp:
            data = await resp.json()
            price = float(data.get('price', 0))
            return (symbol, price)

start = time.perf_counter()
sem = asyncio.Semaphore(3)  # max 3 concurrent requests

async with aiohttp.ClientSession() as session:
    tasks = [fetch_price(session, sym, sem) for sym in SYMBOLS]
    results = await asyncio.gather(*tasks)

elapsed = time.perf_counter() - start
for symbol, price in results:
    print(f'  {symbol:6} €{price:>8.2f}')
print(f'\n  Fetched {len(results)} quotes in {elapsed:.2f}s (3 concurrent max)')
```

      SAP    €  171.05
      ASML   € 1399.48
      TTE    €   88.81
      UL     €   60.65
      DEO    €   72.47
      SNY    €   45.13
      NVS    €  148.64
      AZN    €  185.84
    
      Fetched 8 quotes in 0.65s (3 concurrent max)

#### asyncio.as_completed with real API

Returns an iterator of futures that yields results in completion order (fastest first), not submission order. Use when you want to process results as they arrive rather than waiting for all to finish.

```python
# asyncio.as_completed — process results as they arrive, not in submission order
#
# WHAT: wraps a list of coroutines and yields futures in completion order.
#   The fastest API response is processed first, even if it was submitted last.
#
# WHY: in a pipeline, you want to feed results to the next stage ASAP.
#   gather waits for the slowest; as_completed starts processing immediately.
#
# NOTE: uses Finnhub (separate rate limit from Twelve Data used in previous cell)

async def fetch_quote_fh(session, symbol):
    """Fetch a quote from Finnhub — returns current price and percent change."""
    url = f'https://finnhub.io/api/v1/quote?symbol={symbol}&token={FINNHUB_KEY}'
    start = time.perf_counter()
    async with session.get(url) as resp:
        data = await resp.json()
    elapsed = time.perf_counter() - start
    price = data.get('c', 0)  # 'c' = current price in Finnhub API
    change = data.get('dp', 0)  # 'dp' = percent change
    return (symbol, price, change, elapsed)

print('  Results in completion order (fastest first):')
async with aiohttp.ClientSession() as session:
    coros = [fetch_quote_fh(session, s) for s in ['SAP', 'ASML', 'TTE', 'UL']]
    for coro in asyncio.as_completed(coros):
        symbol, price, change, elapsed = await coro
        print(f'    {symbol:6} €{price:>8.2f}  {change:+.2f}%  ({elapsed:.3f}s)')
```

      Results in completion order (fastest first):
        TTE    €   88.79  -0.39%  (0.186s)
        ASML   € 1399.42  +2.18%  (0.190s)
        UL     €   60.62  -0.74%  (0.190s)
        SAP    €  171.00  -4.02%  (0.191s)

## Async Batching

#### Async Batching — asyncio.Queue + asyncio.wait_for, time and count bounded

Combines an async queue with a batch consumer: producers push individual items to the queue, a consumer drains N items at a time and processes them as a batch. Provides backpressure (bounded queue) and efficient batched I/O.

```python
# Async batching — accumulate items by count OR time, whichever comes first
#
# WHAT: an asyncio.Queue feeds items to a consumer that flushes:
#   - when batch reaches max_size (e.g., 3 items), OR
#   - when max_wait seconds elapse (e.g., 2s), whichever comes first.
#
# WHY: inserting rows one-by-one into BigQuery/Postgres = 1000 round trips.
#   Batching into groups of 100 = 10 round trips. But you also need a time limit
#   so the last partial batch doesn't wait forever for more items.
#
# WHEN TO USE: streaming ingestion, high-velocity event pipelines, DB bulk inserts
# ANTI-PATTERNS:
#   - Don't batch too large — increases latency and memory
#   - Don't forget the time flush — last batch waits forever without it

async def batch_consumer(queue: asyncio.Queue, max_size: int = 3, max_wait: float = 0.5):
    """Consume items from queue, flush when batch is full or timeout expires."""
    batch = []
    while True:
        try:
            item = await asyncio.wait_for(queue.get(), timeout=max_wait)
            if item is None:  # sentinel — producer is done
                break
            batch.append(item)
            if len(batch) >= max_size:  # size trigger
                print(f'  Flush (size={len(batch)}): {batch}')
                batch = []
        except asyncio.TimeoutError:  # time trigger
            if batch:
                print(f'  Flush (time={len(batch)}): {batch}')
                batch = []
    if batch:  # flush remaining
        print(f'  Flush (final={len(batch)}): {batch}')

# Producer pushes items at irregular intervals
q = asyncio.Queue()
consumer_task = asyncio.create_task(batch_consumer(q, max_size=3, max_wait=0.5))

# Push 7 items with varying delays
for i in range(7):
    await q.put(f'item_{i}')
    await asyncio.sleep(0.1 if i < 5 else 0.8)  # slow down after item 5

await q.put(None)  # sentinel to stop consumer
await consumer_task
```

      Flush (size=3): ['item_0', 'item_1', 'item_2']
      Flush (size=3): ['item_3', 'item_4', 'item_5']
      Flush (time=1): ['item_6']

## Cross-Process Execution

#### subprocess — spawn external programs

The `subprocess` module spawns external programs from Python. `subprocess.run()` is the simple synchronous API; `asyncio.create_subprocess_exec()` is the async version. Use for invoking CLI tools (gcloud, bq, sqlcmd) from pipeline scripts.

> [!danger] subprocess with shell=True
>
> `subprocess.run(cmd, shell=True)` passes the command through a shell, enabling command injection if `cmd` contains user input. Always use `shell=False` (default) with a list of arguments: `subprocess.run(["gcloud", "compute", "instances", "list"])`.

```python
# subprocess — spawn child processes with full isolation
#
# WHAT: subprocess.run() launches an OS process, waits for it, captures output.
#   Each process has its own memory, GIL, and crash boundary.
#
# WHY: crash resilience (child crash doesn't kill parent), invoke external tools
#   (gcloud, bq, dbt, C# scripts), bypass GIL for CPU-bound code.
#
# ANTI-PATTERNS:
#   - Don't use shell=True with user input — command injection risk
#   - Don't pass secrets via arguments — visible in process listings

# Single subprocess — run a computation in an isolated process
result = subprocess.run(
    ["python", "-c", "import json, os; print(json.dumps({'pid': os.getpid(), 'result': sum(range(1000))}))"],
    capture_output=True, text=True, timeout=10,
)
parsed = json.loads(result.stdout)
print(f'  Child PID: {parsed["pid"]}, result: {parsed["result"]}')

# Concurrent subprocesses via ThreadPoolExecutor
def run_expr(expr: str) -> tuple:
    r = subprocess.run(["python", "-c", f"print({expr})"], capture_output=True, text=True)
    return (expr, r.stdout.strip())

exprs = ['2**20', 'sum(range(10000))', '3.14159 * 100']
with ThreadPoolExecutor(max_workers=3) as pool:
    results = list(pool.map(run_expr, exprs))
for expr, val in results:
    print(f'  {expr:25} = {val}')
```

      Child PID: 31988, result: 499500
      2**20                     = 1048576
      sum(range(10000))         = 49995000
      3.14159 * 100             = 314.159

## Distributed Task Queues — Architecture Overview

A broker (Redis/RabbitMQ) distributes tasks to workers on multiple machines. Workers pull tasks from the queue, execute them, and report results. This is the standard architecture for production data engineering at scale.

**Architecture:** `Producer → Broker (Redis) → Workers (N machines)`

| Framework | Description | Use for |
|---|---|---|
| **Celery** | Most popular distributed task queue. Workers subscribe to a broker. | ETL jobs, API ingestion, scheduled pipeline triggers |
| **Redis Queue (RQ)** | Simpler alternative to Celery. Less config. | Small/medium workloads |
| **Dask** | Parallel computing, scales from laptop to cluster. Integrates with pandas/numpy. | Large DataFrame processing, ML pipelines |

#### Evolution path
1. `asyncio.gather` → single process, concurrent I/O
2. `ProcessPoolExecutor` → single machine, multiple cores
3. Celery/RQ → multiple machines, distributed workers
4. Dask/Spark → distributed data processing at scale

> [!example] Celery example (requires Redis +
>
> Celery example (requires Redis + worker process)
> ```python
> from celery import Celery
> app = Celery("tasks", broker="redis://localhost:6379/0")
>
> @app.task
> def fetch_and_store(symbol):
>     data = requests.get(f"api/{symbol}").json()
>     db.insert(data)
>
> # Dispatch 100 tasks — workers pick them up from Redis:
> for sym in symbols:
>     fetch_and_store.delay(sym)  # sends to broker, returns immediately
> ```
