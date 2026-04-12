---
title: "13 - Advanced Pipelines - Python"
tags: [python, pipeline]
aliases: [advanced pipelines, async generators, parallel ingestion, subprocess]
description: "Python advanced parallel pipelines reference with executable examples and cell outputs — covers async generators, parallel API ingestion with rate limiting, async batching, subprocess execution, and distributed task queues. See [13-cs-advancedpipelines](https://alp78.github.io/elysium/02-Programming-Languages/02-CSharp/13-cs-advancedpipelines) for the C# equivalent."
created: 2026-03-25
updated: 2026-04-04
status: complete
---

# 13. Advanced Parallel Pipelines - Python

> [!quote]
> "The combination of threads, remote-procedure-call interfaces, and heavyweight object-oriented design is especially dangerous. If you are ever invited onto a project that is supposed to feature all three, fleeing in terror might well be an appropriate reaction."
>
> — **Eric S. Raymond**, *The Art of Unix Programming* (2003)

> [!abstract]- Summary
>
> - **Async Generators** — `async def` + `yield` streams paginated API pages lazily; consumed with `async for` to avoid loading all results into memory at once.
> - **Parallel API Ingestion** — `asyncio.gather` fans out concurrent fetches; `asyncio.Semaphore(n)` caps live connections to respect rate limits (e.g., n=3 for Twelve Data free tier). `asyncio.as_completed` processes results in arrival order rather than submission order.
> - **Async Batching** — `asyncio.Queue` decouples producers from a batch consumer that flushes on either a count threshold (`max_size`) or a wall-clock timeout (`max_wait`), providing bounded memory and efficient bulk I/O.
> - **Cross-Process Execution** — `subprocess.run()` (sync) and `asyncio.create_subprocess_exec()` (async) spawn external CLI tools; always pass arguments as a list (`shell=False`) to prevent shell injection. `ThreadPoolExecutor` parallelises multiple subprocess calls within one Python process.
> - **Distributed Task Queues** — Celery or RQ dispatch tasks to a broker (Redis/RabbitMQ) consumed by N workers; Dask extends this to distributed DataFrame and ML workloads. Evolution path: `asyncio.gather` → `ProcessPoolExecutor` → Celery/RQ → Dask/Spark.
> - **Secrets** — load from `.env` via `python-dotenv` locally; use GCP Secret Manager (or equivalent) in production; never commit `.env` to git.

> [!note]- Glossary
>
> **async generator**
>
> - An `async def` function that contains one or more `yield` statements, producing values lazily and asynchronously — one item per `async for` iteration without blocking the event loop.
> - Declared with `async def` + `yield`; consumed exclusively with `async for`. Using a regular `for` loop raises `TypeError` because the object is an asynchronous iterable, not a synchronous one.
>
> > [!tip] Use async generators for paginated APIs
> >
> > Yield individual records from each page response so the caller receives a uniform `async for item in paginate(url)` interface regardless of underlying page size or pagination token format.
>
>  ---
>
> **asyncio.Semaphore**
>
> - A counter-based concurrency primitive that limits how many coroutines can execute a guarded block simultaneously. `asyncio.Semaphore(n)` allows at most `n` concurrent holders; excess coroutines suspend until a slot is released.
> - Not thread-safe — designed for use within a single event loop. Crossing thread boundaries requires `threading.Semaphore` instead.
>
> > [!tip] Semaphore sizing for financial APIs
> >
> > Start at `n = 3` for Twelve Data free tier (8 req/min) and `n = 5` for Finnhub. Monitor HTTP 429 responses and halve `n` if they appear; double it if latency is acceptable and no 429s are seen.
>
>  ---
>
> **asyncio.gather**
>
> - Schedules multiple coroutines to run concurrently and returns a list of their results in submission order once all have completed. By default, one unhandled exception cancels all pending tasks.
> - Pass `return_exceptions=True` to collect exceptions as result values rather than propagating immediately — critical for resilient pipelines where partial failure is acceptable.
>
> > [!warning] gather without a Semaphore fires all tasks simultaneously
> >
> > For 50 symbols, `gather(*[fetch(s) for s in symbols])` opens 50 connections at once, exhausting rate limits and connection pools instantly.
>
>  ---
>
> **aiohttp**
>
> - An async HTTP client/server library for Python built on `asyncio`. Uses connection pooling and keep-alive for high-throughput requests without per-request TCP overhead.
> - `ClientSession` must be created once per batch and closed after use (via `async with`). Creating a new session per request defeats connection pooling and leaks file descriptors.
>
> > [!tip] Share one ClientSession per pipeline run
> >
> > Instantiate `aiohttp.ClientSession()` at the top of the async entry point and pass it into every fetch coroutine. The session manages the connection pool automatically.
>
>  ---
>
> **asyncio.as_completed**
>
> - Wraps an iterable of coroutines and returns an iterator of `Future` objects that resolve in completion order — the fastest response is yielded first regardless of its position in the input list.
> - Requires `await` on each yielded future inside the loop: `for coro in asyncio.as_completed(coros): result = await coro`. The futures are not the original coroutines.
>
> > [!tip] Use as_completed for streaming dashboards
> >
> > When rendering live price updates, `as_completed` lets you display each quote as it arrives rather than waiting for the slowest symbol in the batch.
>
>  ---
>
> **asyncio.Queue**
>
> - A thread-safe, async-aware FIFO queue that decouples producers (which `put` items) from consumers (which `get` items). `maxsize` bounds the queue, providing backpressure — producers suspend when the queue is full.
> - Sentinel value (`None`) signals the consumer to drain remaining items and exit cleanly. Without a sentinel, the consumer loop blocks indefinitely on `queue.get()`.
>
> > [!tip] Bound the queue to control memory
> >
> > Set `asyncio.Queue(maxsize=100)` when producers can outpace consumers. Unbounded queues accumulate all items in memory before the consumer starts, defeating the purpose of streaming.
>
>  ---
>
> **asyncio.wait_for**
>
> - Wraps a coroutine with a wall-clock timeout (seconds). Raises `asyncio.TimeoutError` if the coroutine does not complete within the deadline; the wrapped task is cancelled automatically.
> - Used in the batch consumer to implement time-bounded flushing: if no new item arrives within `max_wait` seconds, the accumulated partial batch is flushed immediately.
>
> > [!tip] Catch TimeoutError, not CancelledError
> >
> > `asyncio.wait_for` raises `TimeoutError` (a subclass of `asyncio.TimeoutError`). Catching `CancelledError` instead silently swallows task cancellations and hides bugs.
>
>  ---
>
> **subprocess**
>
> - A standard-library module for spawning child processes, connecting to their stdin/stdout/stderr pipes, and retrieving return codes. `subprocess.run()` is the blocking high-level API; `asyncio.create_subprocess_exec()` is the non-blocking async equivalent.
> - Shell injection is the primary risk: `shell=True` passes the command string through `/bin/sh`, allowing arbitrary execution if any part of the command contains unsanitised user input. Always use `shell=False` (default) with an argument list.
>
> > [!danger] Never interpolate user input into shell strings
> >
> > `subprocess.run(f"curl {user_url}", shell=True)` allows `user_url = "; rm -rf /"` to execute as a shell command. Use `subprocess.run(["curl", user_url])` — each list element is passed as a literal argument to `execve`, bypassing the shell entirely.
>
>  ---
>
> **asyncio.create_subprocess_exec**
>
> - The async equivalent of `subprocess.run()`. Returns a `Process` object whose `stdout` and `stderr` are `asyncio.StreamReader` instances, allowing non-blocking pipe reads within the event loop.
> - Use instead of `subprocess.run()` when the child process runs concurrently with other async tasks — blocking `subprocess.run()` inside a coroutine stalls the entire event loop for the duration of the child.
>
> > [!tip] Prefer create_subprocess_exec for long-running CLI tools
> >
> > When calling `gcloud`, `bq`, or `sqlcmd` from an async pipeline, `create_subprocess_exec` keeps the event loop alive so other coroutines (heartbeats, queue consumers) continue running while the CLI executes.
>
>  ---
>
> **ThreadPoolExecutor**
>
> - A `concurrent.futures` executor that runs callables in a pool of OS threads. Each thread has its own GIL slot, making it suitable for I/O-bound work but not for CPU-bound computation (GIL prevents true parallel CPU execution across threads).
> - Used here to parallelise multiple `subprocess.run()` calls from a single Python process: since each call blocks its thread while the child runs, a thread pool issues N calls concurrently without requiring async code.
>
> > [!tip] Use ThreadPoolExecutor for blocking subprocess calls
> >
> > Wrap `subprocess.run()` in `pool.map(run_expr, exprs)` to issue multiple external commands in parallel. The pool size should not exceed the number of child processes you want active simultaneously.
>
>  ---
>
> **python-dotenv**
>
> - A third-party package that reads `.env` files and loads their key-value pairs into `os.environ` via `load_dotenv()`. Zero configuration — call `load_dotenv()` once at process startup.
> - `.env` files must be added to `.gitignore` before the first commit. A leaked API key cannot be revoked retroactively in git history without a full rewrite.
>
> > [!danger] Never commit .env to git
> >
> > Even a single accidental commit exposes secrets in git history permanently. Rotate any leaked keys immediately and audit access logs for the interval the key was exposed.
>
>  ---
>
> **Celery**
>
> - A distributed task queue framework that uses a message broker (Redis or RabbitMQ) to dispatch tasks to a pool of worker processes on one or more machines. Workers pull task messages, execute the registered function, and optionally store results in a result backend.
> - Requires a running broker and at least one worker process — it is not an in-process concurrency library. Monitoring is typically done via the Flower web UI or Prometheus metrics.
>
> > [!tip] Configure retries and dead-letter queues from the start
> >
> > Production Celery tasks should set `max_retries`, `retry_backoff`, and route failed tasks to a dead-letter queue. Silent task disappearance (broker connection lost, worker OOM) is the most common production failure mode.
>
>  ---
>
> **Redis Queue (RQ)**
>
> - A simpler alternative to Celery that uses Redis as its sole broker and result backend. Workers are started with `rq worker` and process jobs enqueued with `q.enqueue(func, *args)`.
> - Lower operational overhead than Celery but fewer features: no advanced routing, no canvas primitives (chains/chords), and no built-in support for non-Redis brokers.
>
> > [!tip] Prefer RQ for small-to-medium workloads
> >
> > If your pipeline needs a distributed queue but does not require Celery's routing flexibility or canvas composition, RQ is operationally simpler to run and debug.
>
>  ---
>
> **Dask**
>
> - A parallel computing framework that scales Python (pandas, NumPy, scikit-learn) workloads from a single laptop to a distributed cluster. The `dask.dataframe` API mirrors pandas; computations are expressed as lazy task graphs and executed by a scheduler.
> - Occupies the step above Celery/RQ in the scaling ladder: use Dask when your data does not fit in a single machine's RAM or when ML pipeline parallelism (grid search, feature engineering) requires more than `ProcessPoolExecutor` can provide.
>
> > [!tip] Dask vs Spark for DE workloads
> >
> > Dask integrates natively with the Python data ecosystem and has lower operational overhead than Spark for medium-scale jobs (< 1 TB). Choose Spark when you need mature SQL support, ACID transactions (Delta Lake), or tight GCP Dataproc/Dataflow integration.

> [!danger] Secrets Management
>
> Load API keys from `.env` for local development. In production, use GCP Secret Manager, AWS Secrets Manager, or Azure Key Vault. NEVER commit `.env` to git.

> [!success] Safe secrets pattern
>
> - Use `python-dotenv` with a `.env` file locally; add `.env` to `.gitignore` before the first commit
> - In production (GCP), read secrets at runtime via `google-cloud-secret-manager` — never bake them into images or config files
> - Rotate keys in the secret manager without touching code; inject via `os.environ` or a dedicated secrets-loader function

This note covers advanced parallel pipeline patterns — async generators for paginated APIs, rate-limited parallel ingestion, async batching, cross-process execution with `subprocess`, and distributed task queue architecture.

### Key terms used in this note

| Term | Plain-English definition | Why it matters here | Common mistake / confusion |
|---|---|---|---|
| **async generator** | `async def` with `yield` — produces values lazily and asynchronously, one at a time. | Stream paginated API responses without loading all pages into memory. | Must use `async for` to consume, not regular `for`. |
| **asyncio.Semaphore** | Limits concurrent async operations. `Semaphore(5)` allows 5 concurrent tasks. | Rate-limit API calls to avoid 429 (Too Many Requests) errors. | Not thread-safe — use only within a single event loop. |
| **asyncio.gather** | Runs multiple coroutines concurrently, returns all results when complete. | Fan-out: fetch N API pages or symbols in parallel. | One failure cancels all by default — use `return_exceptions=True` for resilience. |
| **aiohttp** | Async HTTP client library for Python. Uses connection pooling and keep-alive. | High-throughput API ingestion without blocking. | Must manage `ClientSession` lifecycle — create once, reuse, close at end. |
| **subprocess** | Module for launching external processes. `subprocess.run()` for sync, `asyncio.create_subprocess_exec()` for async. | Call CLI tools, shell scripts, or other language runtimes from Python. | Shell injection risk with `shell=True` — use argument lists instead. |
| **Celery** | Distributed task queue using a message broker (Redis, RabbitMQ). | Scale beyond a single machine — dispatch tasks to a pool of workers. | Requires a running broker and worker process — not an in-process library. |

### What this note covers

- **Async Generators** — paginated API streaming with `async for`
- **Parallel API Ingestion** — rate-limited concurrent fetches with `asyncio.Semaphore`
- **Async Batching** — accumulate results into batches for bulk writes
- **Cross-Process Execution** — `subprocess.run()` and async subprocess for external tools
- **Distributed Task Queues** — Celery/RQ architecture overview, scaling ladder

```python
import asyncio
import time
import os
import json
import subprocess
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor
import aiohttp
from dotenv import load_dotenv

load_dotenv()

TWELVE_DATA_KEY = os.environ.get('TWELVE_DATA_KEY', '')
FRED_KEY = os.environ.get('FRED_KEY', '')
FINNHUB_KEY = os.environ.get('FINNHUB_KEY', '')

"set" if TWELVE_DATA_KEY else "MISSING"
"set" if FRED_KEY else "MISSING"
"set" if FINNHUB_KEY else "MISSING"
```

```text
TWELVE_DATA_KEY: set
FRED_KEY:        set
FINNHUB_KEY:     set
```

## Async Generators with Real APIs

> [!info] Python vs C# pipeline frameworks
>
> C# has `TPL Dataflow` — a built-in library of composable blocks (`TransformBlock`, `ActionBlock`, `BatchBlock`) with per-stage concurrency control and automatic backpressure. Python has no equivalent built-in. Instead, Python pipelines are assembled from `asyncio.Queue` chains, async generators, and manual batching. For production-grade orchestration, use Airflow, Prefect, or Dagster.

### Paginated API streaming

#### Paginated FRED API with async for

Many REST APIs return results in pages (100 items per response with a `next_page` token). An async generator fetches each page, yields individual items, and follows pagination links — providing a clean `async for item in paginate(url)` interface that hides the pagination complexity.

```python
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
                break
            for s in series:
                if yielded >= limit:
                    break
                yield (s['id'], s['title'])
                yielded += 1
            offset += page_size

async for series_id, title in fetch_fred_series('inflation', limit=8):
    print(f'    {series_id:20} {title[:50]}')
```

```text
FRED series matching "inflation":
  DFII10               Market Yield on U.S. Treasury Securities at 10-Yea
  FII10                Market Yield on U.S. Treasury Securities at 10-Yea
  WFII10               Market Yield on U.S. Treasury Securities at 10-Yea
  RIFLGFCY10XIINA      Market Yield on U.S. Treasury Securities at 10-Yea
  T10YIE               10-Year Breakeven Inflation Rate
  T10YIEM              10-Year Breakeven Inflation Rate
  FPCPITOTLZGUSA       Inflation, consumer prices for the United States
  CPIAUCSL             Consumer Price Index for All Urban Consumers: All
```

## Parallel API Ingestion

> [!danger] asyncio.gather() without a semaphore fires
>
> `asyncio.gather()` without a semaphore fires ALL requests simultaneously
> For 50 symbols, `gather(*[fetch(s) for s in symbols])` opens 50 connections at once.
> Most financial data APIs have strict rate limits (Twelve Data: 8/min, Alpha Vantage:
> 5/min). Without a semaphore, every request after the limit returns `429 Too Many
> Requests` — and your pipeline processes empty/error responses as valid data.

> [!success] Always gate gather() with a Semaphore
>
> - Wrap the fetch coroutine in `async with semaphore:` to cap concurrent requests (e.g., `asyncio.Semaphore(3)` for Twelve Data free tier)
> - Check `resp.status` for 429 inside the coroutine and raise so gather reports the error instead of silently returning empty data
> - For strict rate limits (requests-per-minute), combine the semaphore with `asyncio.sleep` between batches

### Rate-limited parallel fetch

#### asyncio.Semaphore + aiohttp — parallel fetch with rate limiting

Combines rate limiting (semaphore) with async HTTP (aiohttp) for parallel API fetches that respect rate limits. The semaphore caps concurrent requests; aiohttp reuses connections via a session pool. This is the standard pattern for fetching data from rate-limited financial APIs.

```python
SYMBOLS = ['SAP', 'ASML', 'TTE', 'UL', 'DEO', 'SNY', 'NVS', 'AZN']

async def fetch_price(session, symbol, semaphore):
    """Fetch a single stock price with rate limiting."""
    async with semaphore:
        url = f'https://api.twelvedata.com/price?symbol={symbol}&apikey={TWELVE_DATA_KEY}'
        async with session.get(url) as resp:
            data = await resp.json()
            price = float(data.get('price', 0))
            return (symbol, price)

start = time.perf_counter()
sem = asyncio.Semaphore(3)

async with aiohttp.ClientSession() as session:
    tasks = [fetch_price(session, sym, sem) for sym in SYMBOLS]
    results = await asyncio.gather(*tasks)

elapsed = time.perf_counter() - start
for symbol, price in results:
    print(f'  {symbol:6} €{price:>8.2f}')
print(f"Fetched {len(results)} quotes in {elapsed:.2f}s (3 concurrent max)")
```

```text
SAP    €  171.05
ASML   € 1399.48
TTE    €   88.81
UL     €   60.65
DEO    €   72.47
SNY    €   45.13
NVS    €  148.64
AZN    €  185.84

Fetched 8 quotes in 0.65s (3 concurrent max)
```

### Completion-order processing

#### asyncio.as_completed with real API

Returns an iterator of futures that yields results in completion order (fastest first), not submission order. Use when you want to process results as they arrive rather than waiting for all to finish.

> [!info] as_completed — Fastest First
>
> Wraps coroutines and yields futures in completion order, not submission order. The fastest API response is processed first, even if submitted last. Use when you want to start processing results immediately rather than waiting for all.

```python
async def fetch_quote_fh(session, symbol):
    """Fetch a quote from Finnhub — returns current price and percent change."""
    url = f'https://finnhub.io/api/v1/quote?symbol={symbol}&token={FINNHUB_KEY}'
    start = time.perf_counter()
    async with session.get(url) as resp:
        data = await resp.json()
    elapsed = time.perf_counter() - start
    price = data.get('c', 0)
    change = data.get('dp', 0)
    return (symbol, price, change, elapsed)

async with aiohttp.ClientSession() as session:
    coros = [fetch_quote_fh(session, s) for s in ['SAP', 'ASML', 'TTE', 'UL']]
    for coro in asyncio.as_completed(coros):
        symbol, price, change, elapsed = await coro
        print(f'    {symbol:6} €{price:>8.2f}  {change:+.2f}%  ({elapsed:.3f}s)')
```

```text
Results in completion order (fastest first):
  TTE    €   88.79  -0.39%  (0.186s)
  ASML   € 1399.42  +2.18%  (0.190s)
  UL     €   60.62  -0.74%  (0.190s)
  SAP    €  171.00  -4.02%  (0.191s)
```

## Async Batching

### Time and count bounded batching

#### Async batching — flush by count or timeout

Combines an async queue with a batch consumer: producers push individual items to the queue, a consumer drains N items at a time and processes them as a batch. Provides backpressure (bounded queue) and efficient batched I/O.

```python
async def batch_consumer(queue: asyncio.Queue, max_size: int = 3, max_wait: float = 0.5):
    """Consume items from queue, flush when batch is full or timeout expires."""
    batch = []
    while True:
        try:
            item = await asyncio.wait_for(queue.get(), timeout=max_wait)
            if item is None:
                break
            batch.append(item)
            if len(batch) >= max_size:
                print(f'  Flush (size={len(batch)}): {batch}')
                batch = []
        except asyncio.TimeoutError:
            if batch:
                print(f'  Flush (time={len(batch)}): {batch}')
                batch = []
    if batch:
        print(f'  Flush (final={len(batch)}): {batch}')

q = asyncio.Queue()
consumer_task = asyncio.create_task(batch_consumer(q, max_size=3, max_wait=0.5))

for i in range(7):
    await q.put(f'item_{i}')
    await asyncio.sleep(0.1 if i < 5 else 0.8)

await q.put(None)
await consumer_task
```

```text
Flush (size=3): ['item_0', 'item_1', 'item_2']
Flush (size=3): ['item_3', 'item_4', 'item_5']
Flush (time=1): ['item_6']
```

## Cross-Process Execution

### subprocess — spawn and capture output

#### subprocess — spawn external programs

The `subprocess` module spawns external programs from Python. `subprocess.run()` is the simple synchronous API; `asyncio.create_subprocess_exec()` is the async version. Use for invoking CLI tools (gcloud, bq, sqlcmd) from pipeline scripts.

> [!danger] subprocess with shell=True
>
> `subprocess.run(cmd, shell=True)` passes the command through a shell, enabling command injection if `cmd` contains user input. Always use `shell=False` (default) with a list of arguments: `subprocess.run(["gcloud", "compute", "instances", "list"])`.

> [!success] Use shell=False with a list of arguments
>
> - Always pass commands as a list: `subprocess.run(["gcloud", "compute", "instances", "list"])` — each element is a separate token, never shell-interpreted
> - Pass secrets via environment variables (`env={"MY_SECRET": value}`) rather than as command arguments, which are visible in `ps` output
> - Set `timeout=` on every `subprocess.run()` call to prevent hung child processes from blocking the pipeline

```python
result = subprocess.run(
    ["python", "-c", "import json, os; print(json.dumps({'pid': os.getpid(), 'result': sum(range(1000))}))"],
    capture_output=True, text=True, timeout=10,
)
parsed = json.loads(result.stdout)
print(f'Child PID: {parsed["pid"]}, result: {parsed["result"]}')

def run_expr(expr: str) -> tuple:
    r = subprocess.run(["python", "-c", f"print({expr})"], capture_output=True, text=True)
    return (expr, r.stdout.strip())

exprs = ['2**20', 'sum(range(10000))', '3.14159 * 100']
with ThreadPoolExecutor(max_workers=3) as pool:
    results = list(pool.map(run_expr, exprs))
for expr, val in results:
    print(f'  {expr:25} = {val}')
```

```text
Child PID: 31988, result: 499500
  2**20                     = 1048576
  sum(range(10000))         = 49995000
  3.14159 * 100             = 314.159
```

## Distributed Task Queues — Architecture Overview

### Architecture and evolution

A broker (Redis/RabbitMQ) distributes tasks to workers on multiple machines. Workers pull tasks from the queue, execute them, and report results. This is the standard architecture for production data engineering at scale.

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
flowchart LR
    P["Producer<br/>(pipeline script)"] --> B["Broker<br/>(Redis / RabbitMQ)"]
    B --> W1["Worker 1"]
    B --> W2["Worker 2"]
    B --> W3["Worker N"]
    W1 --> R["Results<br/>(DB / object store)"]
    W2 --> R
    W3 --> R
```

| Framework | Description | Use for |
|---|---|---|
| **Celery** | Most popular distributed task queue. Workers subscribe to a broker. | ETL jobs, API ingestion, scheduled pipeline triggers |
| **Redis Queue (RQ)** | Simpler alternative to Celery. Less config. | Small/medium workloads |
| **Dask** | Parallel computing, scales from laptop to cluster. Integrates with pandas/numpy. | Large DataFrame processing, ML pipelines |

#### Evolution path — from single process to distributed

Each step adds a layer of scalability. Start with the simplest model that meets your throughput requirements and scale up only when needed.

1. `asyncio.gather` → single process, concurrent I/O
2. `ProcessPoolExecutor` → single machine, multiple cores
3. Celery/RQ → multiple machines, distributed workers
4. Dask/Spark → distributed data processing at scale

> [!guide] Celery example (requires Redis +
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

## Warnings

> [!warning] No rate limiting causes API bans
>
> Launching hundreds of concurrent requests without a semaphore triggers rate limits (HTTP 429) or IP bans from the API provider.

> [!success] Correct pattern
>
> Use `asyncio.Semaphore(n)` to cap concurrency. Start with n=5–10 and tune based on the API's rate limit headers.

> [!warning] `shell=True` in subprocess enables shell injection
>
> `subprocess.run(f"curl {user_input}", shell=True)` allows arbitrary command execution if `user_input` is untrusted.

> [!success] Correct pattern
>
> Use argument lists: `subprocess.run(["curl", url])`. Never interpolate user input into shell strings.

## Recommendations

- **Start with the simplest concurrency model** — `asyncio.gather` first, then `ProcessPoolExecutor`, then Celery only when you outgrow a single machine.
- **Use `asyncio.Semaphore` for all external API calls** — prevents rate limiting and protects downstream services.
- **Use async generators for paginated APIs** — memory-efficient streaming without loading all pages at once.
- **Batch writes for bulk database inserts** — accumulate records and flush in configurable batch sizes.
- **Use `subprocess` argument lists, not shell strings** — prevents injection and works cross-platform.

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| HTTP 429 Too Many Requests | Too many concurrent requests | Add `asyncio.Semaphore(n)` to limit concurrency |
| `aiohttp.ClientSession` closed prematurely | Session created per-request instead of shared | Create one session with `async with aiohttp.ClientSession()` for the entire batch |
| Subprocess hangs indefinitely | Child process waiting for stdin or producing too much output | Use `timeout=` parameter; pipe and read stdout/stderr |
| Celery task silently disappears | Broker connection lost or worker crashed | Monitor with Flower; configure task retries and dead-letter queues |

