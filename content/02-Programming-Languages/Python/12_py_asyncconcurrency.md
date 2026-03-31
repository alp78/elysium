---
type: reference
category: programming-languages
technology: [python]
tags: [python]
aliases: [async await, concurrency, parallelism, tasks, threads, asyncio, Task]
keywords: [asyncio, async, await, coroutine, Task, threading, multiprocessing, concurrent.futures, GIL]
description: "Python async and concurrency reference with executable examples and cell outputs — covers asyncio, async/await, tasks, threading, multiprocessing, and concurrent.futures. See [12_cs_asyncconcurrency](https://alp78.github.io/elysium/02-Programming-Languages/CSharp/12_cs_asyncconcurrency) for the C# equivalent."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 12. Async & Concurrency - Python

> [!quote]
> "Everybody who learns concurrency thinks they understand it, ends up finding mysterious races they thought weren't possible, and discovers that they didn't actually understand it yet after all."
> — **Herb Sutter**, *The Free Lunch Is Over*, Dr. Dobb's Journal (2005)

```python
import asyncio
import time
import os
import sys
import random
import hashlib
import threading
import queue
import subprocess
import textwrap
import tempfile
import json as json_mod
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
```

## Async and Await

> [!info] Async fundamentals
>
> - `async def` — declares a coroutine (a function that can pause and resume)
> - `await` — pauses until the awaited task completes, releasing the event loop
> - `asyncio.run()` — entry point that starts the event loop
> - In Jupyter, the loop is already running — use `await` directly at top level

The event loop is a single-threaded scheduler that multiplexes coroutines. While one awaits I/O, the loop runs another. This is **not parallelism** — it's concurrency on one thread. Great for I/O-bound work (HTTP, DB, file); useless for CPU-bound work.

**Why async matters for data engineering:** API calls (BigQuery, GCS, REST) are I/O-bound — async lets you overlap them. A pipeline that fetches 10 APIs sequentially in 10s can do it in ~1s with async.

> [!warning] Async pitfalls
>
> - **Blocking calls** (`time.sleep`, `requests.get`) inside async code block the entire event loop — use `asyncio.sleep` and `aiohttp` instead
> - **`asyncio.run()` inside a running loop** raises `RuntimeError` in notebooks
> - **Missing `await`** — the coroutine is created but never executed
> - For **CPU-bound work**, use `ProcessPoolExecutor` instead (the GIL blocks threads)

> [!danger] Nested asyncio.run() not allowed
>
> `asyncio.run()` cannot be nested inside a running event loop.
> Calling `asyncio.run()` from within an already-running loop (Jupyter, FastAPI, Airflow tasks) raises `RuntimeError: This event loop is already running`. In notebooks, use `await` directly at top level. In sync code that may run inside an existing loop, use `nest_asyncio.apply()` as a last resort, or restructure to propagate `async` up the call chain.

#### async def / await — basic coroutine

```python
# Basic coroutine — async def with await asyncio.sleep

async def fetch_data(source: str, delay: float) -> dict:
    """Simulate fetching data from a source with network latency."""
    print(f"  [{time.strftime('%H:%M:%S')}] Starting fetch: {source}")
    await asyncio.sleep(delay)  # non-blocking sleep — yields control to the event loop
    print(f"  [{time.strftime('%H:%M:%S')}] Completed fetch: {source}")
    return {"source": source, "rows": int(delay * 1000)}
```

#### asyncio.gather — sequential vs concurrent execution

```python
# Sequential vs concurrent — await one-by-one vs asyncio.gather

async def sequential():
    print("=== Sequential (one after another) ===")
    start = time.perf_counter()
    r1 = await fetch_data("users_api", 1.0)
    r2 = await fetch_data("events_api", 0.8)
    r3 = await fetch_data("products_api", 0.5)
    elapsed = time.perf_counter() - start
    print(f"  Total: {elapsed:.2f}s (sum of all delays)")
    return [r1, r2, r3]

# Concurrent — all fetches run at the same time on the event loop
async def concurrent():
    print("\n=== Concurrent (asyncio.gather) ===")
    start = time.perf_counter()
    r1, r2, r3 = await asyncio.gather(
        fetch_data("users_api", 1.0),
        fetch_data("events_api", 0.8),
        fetch_data("products_api", 0.5),
    )
    elapsed = time.perf_counter() - start
    print(f"  Total: {elapsed:.2f}s (max of all delays)")
    return [r1, r2, r3]

seq_results = await sequential()
conc_results = await concurrent()

print(f"\nResults match: {seq_results == conc_results}")
```

    === Sequential (one after another) ===
      [06:59:52] Starting fetch: users_api
      [06:59:53] Completed fetch: users_api
      [06:59:53] Starting fetch: events_api
      [06:59:54] Completed fetch: events_api
      [06:59:54] Starting fetch: products_api
      [06:59:55] Completed fetch: products_api
      Total: 2.33s (sum of all delays)
    
    === Concurrent (asyncio.gather) ===
      [06:59:55] Starting fetch: users_api
      [06:59:55] Starting fetch: events_api
      [06:59:55] Starting fetch: products_api
      [06:59:55] Completed fetch: products_api
      [06:59:56] Completed fetch: events_api
      [06:59:56] Completed fetch: users_api
      Total: 1.00s (max of all delays)
    
    Results match: True

#### asyncio.gather and TaskGroup

```python
# asyncio.gather vs TaskGroup — two approaches to concurrent execution

async def fetch_table(name: str, delay: float, fail: bool = False) -> dict:
    """Simulate a BigQuery table fetch."""
    await asyncio.sleep(delay)
    if fail:
        raise RuntimeError(f"Fetch failed: {name}")
    return {"table": name, "rows": int(delay * 1000)}
```

#### asyncio.gather with error handling

```python
# asyncio.gather with return_exceptions — collect all results including errors

print("=== asyncio.gather (return_exceptions=True) ===")
results = await asyncio.gather(
    fetch_table("events", 0.3),
    fetch_table("users", 0.2, fail=True),   # this one fails
    fetch_table("products", 0.1),
    return_exceptions=True,  # don't raise — return exceptions as results
)
for r in results:
    if isinstance(r, Exception):
        print(f"  ERROR: {r}")
    else:
        print(f"  OK:    {r}")
```

    === asyncio.gather (return_exceptions=True) ===
      OK:    {'table': 'events', 'rows': 300}
      ERROR: Fetch failed: users
      OK:    {'table': 'products', 'rows': 100}

#### TaskGroup (Python 3.11+) — structured concurrency

```python
# TaskGroup (Python 3.11+) — structured concurrency with auto-cancellation

print("\n=== TaskGroup (structured concurrency) ===")
try:
    async with asyncio.TaskGroup() as tg:
        t1 = tg.create_task(fetch_table("events", 0.3))
        t2 = tg.create_task(fetch_table("users", 0.2, fail=True))
        t3 = tg.create_task(fetch_table("products", 0.1))
    # If we get here, all tasks succeeded
    print(f"  All done: {t1.result()}, {t2.result()}, {t3.result()}")
except* RuntimeError as eg:
    # ExceptionGroup — Python 3.11+ syntax for catching grouped exceptions
    # except* catches a specific type from the group
    print(f"  Caught {len(eg.exceptions)} error(s):")
    for exc in eg.exceptions:
        print(f"    - {exc}")
    # Successful tasks still have their results
    if not t1.cancelled():
        print(f"  t1 (events) completed: {t1.result()}")
    if not t3.cancelled():
        print(f"  t3 (products) completed: {t3.result()}")
```

    
    === TaskGroup (structured concurrency) ===
      Caught 1 error(s):
        - Fetch failed: users
      t3 (products) completed: {'table': 'products', 'rows': 100}

#### asyncio.Semaphore — concurrency rate limiting

```python
# Semaphore — limit concurrent async operations (rate limiting)

async def fetch_with_limit(sem: asyncio.Semaphore, url: str) -> str:
    async with sem:  # blocks if 3 tasks already inside
        delay = random.uniform(0.1, 0.5)
        await asyncio.sleep(delay)
        return f"{url} ({delay:.2f}s)"

print("=== Semaphore (max 3 concurrent) ===")
sem = asyncio.Semaphore(3)
start = time.perf_counter()
results = await asyncio.gather(*[
    fetch_with_limit(sem, f"https://api.example.com/page/{i}")
    for i in range(10)
])
elapsed = time.perf_counter() - start
print(f"  Fetched {len(results)} pages in {elapsed:.2f}s (max 3 at a time)")
for r in results[:3]:
    print(f"    {r}")
print(f"    ... ({len(results) - 3} more)")
```

    === Semaphore (max 3 concurrent) ===
      Fetched 10 pages in 1.28s (max 3 at a time)
        https://api.example.com/page/0 (0.28s)
        https://api.example.com/page/1 (0.27s)
        https://api.example.com/page/2 (0.45s)
        ... (7 more)

#### asyncio.wait_for — timeout and cancel slow tasks

```python
# Timeout — cancel slow tasks with asyncio.wait_for

async def slow_query(table: str) -> dict:
    await asyncio.sleep(5.0)  # simulate a very slow query
    return {"table": table, "rows": 999}

print("\n=== Timeout (asyncio.wait_for) ===")
try:
    result = await asyncio.wait_for(slow_query("huge_table"), timeout=1.0)
    print(f"  Result: {result}")
except asyncio.TimeoutError:
    print("  Query timed out after 1.0s — cancelled automatically")
```

    
    === Timeout (asyncio.wait_for) ===
      Query timed out after 1.0s — cancelled automatically

#### Retry with exponential backoff — asyncio transient error recovery

```python
# Retry with exponential backoff — recover from transient failures

attempt_count = 0

async def flaky_api(endpoint: str) -> dict:
    global attempt_count
    attempt_count += 1
    if attempt_count < 3:  # fail first 2 attempts
        raise ConnectionError(f"Connection refused (attempt {attempt_count})")
    return {"endpoint": endpoint, "status": "ok"}

async def retry_with_backoff(coro_func, *args, max_retries: int = 5, base_delay: float = 0.1):
    """Retry a coroutine with exponential backoff."""
    for attempt in range(max_retries):
        try:
            return await coro_func(*args)
        except Exception as e:
            if attempt == max_retries - 1:
                raise  # give up after max retries
            delay = base_delay * (2 ** attempt)  # exponential: 0.1, 0.2, 0.4, 0.8...
            print(f"  Attempt {attempt + 1} failed: {e}. Retrying in {delay:.1f}s...")
            await asyncio.sleep(delay)

print("\n=== Retry with Exponential Backoff ===")
attempt_count = 0
result = await retry_with_backoff(flaky_api, "/data/events")
print(f"  Success on attempt {attempt_count}: {result}")
```

    
    === Retry with Exponential Backoff ===
      Attempt 1 failed: Connection refused (attempt 1). Retrying in 0.1s...
      Attempt 2 failed: Connection refused (attempt 2). Retrying in 0.2s...
      Success on attempt 3: {'endpoint': '/data/events', 'status': 'ok'}

#### Producer-Consumer with asyncio.Queue

```python
# Producer and worker coroutines for asyncio.Queue pipeline

async def async_producer(queue: asyncio.Queue, n: int):
    """Generate events and put them in the queue."""
    for i in range(n):
        event = {"id": f"evt_{i:03d}", "type": random.choice(["click", "view", "purchase"])}
        await queue.put(event)
        await asyncio.sleep(0.05)
    for _ in range(3):  # one sentinel per worker
        await queue.put(None)

async def async_worker(name: str, queue: asyncio.Queue, results: list):
    """Process events from the queue until sentinel (None)."""
    while True:
        event = await queue.get()
        if event is None:
            break
        await asyncio.sleep(random.uniform(0.02, 0.1))
        results.append(f"{name} processed {event['id']}")
        queue.task_done()
```

#### asyncio.Queue — run producer-consumer pipeline

```python
# Bounded queue with 3 concurrent workers

print("\n=== Producer-Consumer (asyncio.Queue) ===")
q = asyncio.Queue(maxsize=5)
results = []
start = time.perf_counter()

await asyncio.gather(
    async_producer(q, 12),
    async_worker("worker-1", q, results),
    async_worker("worker-2", q, results),
    async_worker("worker-3", q, results),
)

elapsed = time.perf_counter() - start
print(f"  Processed {len(results)} events in {elapsed:.2f}s with 3 workers")
for r in results[:4]:
    print(f"    {r}")
print(f"    ... ({len(results) - 4} more)")
```

    
    === Producer-Consumer (asyncio.Queue) ===
      Processed 12 events in 0.73s with 3 workers
        worker-1 processed evt_000
        worker-2 processed evt_001
        worker-3 processed evt_002
        worker-3 processed evt_003
        ... (8 more)

#### Async generators — async def with yield

```python
# Async generators — async def with yield for streaming data

async def fetch_pages(total_pages: int, items_per_page: int):
    """Simulate a paginated API — yields items one at a time across pages."""
    for page in range(1, total_pages + 1):
        await asyncio.sleep(0.1)  # simulate network latency per page
        print(f"  Fetching page {page}...")
        for i in range(items_per_page):
            yield f"page{page}_item{i + 1}"  # yield one item at a time

# async for — consumer pulls items as they stream in
count = 0
async for item in fetch_pages(3, 2):
    count += 1
    print(f"    Received: {item}")
print(f"  Total: {count} items")

# Early exit with break — generator is cleaned up automatically
print("\n  First 4 items only:")
async for item in fetch_pages(10, 3):
    print(f"    {item}")
    count += 1
    if count >= 4:
        break  # stops the generator — no more pages fetched
```

      Fetching page 1...
        Received: page1_item1
        Received: page1_item2
      Fetching page 2...
        Received: page2_item1
        Received: page2_item2
      Fetching page 3...
        Received: page3_item1
        Received: page3_item2
      Total: 6 items
    
      First 4 items only:
      Fetching page 1...
        page1_item1

#### asyncio.as_completed — process fastest results first

```python
# asyncio.as_completed — process results in completion order

async def fetch_with_delay(name: str, delay: float) -> str:
    """Simulate an API call with variable latency."""
    await asyncio.sleep(delay)
    return f"{name} ({delay}s)"

# Create tasks with different latencies
tasks = [
    fetch_with_delay("fast_api", 0.1),
    fetch_with_delay("slow_api", 0.5),
    fetch_with_delay("medium_api", 0.3),
    fetch_with_delay("very_slow_api", 0.8),
]

# as_completed yields futures in completion order — fastest first
print("  Results in completion order:")
start = time.perf_counter()
for coro in asyncio.as_completed(tasks):
    result = await coro  # await each future as it resolves
    elapsed = time.perf_counter() - start
    print(f"    {elapsed:.2f}s: {result}")
```

      Results in completion order:
        0.11s: fast_api (0.1s)
        0.31s: medium_api (0.3s)
        0.50s: slow_api (0.5s)
        0.81s: very_slow_api (0.8s)

#### asyncio.Lock and asyncio.Event

```python
# asyncio.Lock and asyncio.Event — async-safe synchronization

token_cache = {"access_token": "old_token", "expires_at": 0}
lock = asyncio.Lock()

async def get_token():
    """Refresh token if expired — lock prevents two coroutines refreshing simultaneously."""
    async with lock:  # only one coroutine can be inside this block at a time
        if token_cache["expires_at"] < time.perf_counter():
            await asyncio.sleep(0.1)  # simulate token refresh API call
            token_cache["access_token"] = f"new_token_{int(time.perf_counter()*1000)}"
            token_cache["expires_at"] = time.perf_counter() + 300
            print(f"    Refreshed: {token_cache['access_token']}")
    return token_cache["access_token"]

# Multiple coroutines try to get token — only first one refreshes
results = await asyncio.gather(get_token(), get_token(), get_token())
print(f"  All got same token: {len(set(results)) == 1}")

# asyncio.Event — workers wait for a "ready" signal before processing
print("\n  asyncio.Event:")
ready = asyncio.Event()  # starts unset — wait() will block

async def worker(name: str):
    print(f"    {name}: waiting for ready signal...")
    await ready.wait()  # blocks until ready.set() is called
    print(f"    {name}: proceeding!")

# Start workers, then signal after init
worker_tasks = [asyncio.create_task(worker(f"w{i}")) for i in range(3)]
await asyncio.sleep(0.2)  # simulate initialization
print("    Main: signaling ready")
ready.set()  # unblocks ALL waiting coroutines
await asyncio.gather(*worker_tasks)
```

        Refreshed: new_token_76055257
      All got same token: True
    
      asyncio.Event:
        w0: waiting for ready signal...
        w1: waiting for ready signal...
        w2: waiting for ready signal...
        Main: signaling ready
        w0: proceeding!
        w1: proceeding!
        w2: proceeding!

    [None, None, None]

## Tasks and Parallelism

> [!tip] Related pattern
>
> The concurrency patterns below (task fan-out, semaphore-bounded parallelism) parallel how [airflow-dag-patterns](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-dag-patterns) manages DAG task concurrency — both control how many units of work execute simultaneously, just at different abstraction levels.

`concurrent.futures` provides two pool executors with a uniform API — swap one for the other with a single line change:

- **`ThreadPoolExecutor`** — pool of threads for I/O-bound parallelism (HTTP, file, DB). Threads share memory but are limited by the GIL for CPU work.
- **`ProcessPoolExecutor`** — pool of processes for CPU-bound parallelism (parsing, hashing, ML). Each process has its own GIL — true multi-core parallelism.
- `executor.submit(fn, *args)` schedules a single task (returns a `Future`). `executor.map(fn, iterable)` schedules many tasks (returns results in order). `Future.result()` blocks until complete.

> [!info] Python's GIL
>
> The Global Interpreter Lock means only one thread executes Python bytecode at a time. Threads still help for I/O (while one waits for a network response, another runs), but for CPU-bound work you need `ProcessPoolExecutor` (separate processes, separate GILs).

> [!warning] Concurrency pitfalls
>
> - `ThreadPoolExecutor` for CPU-bound work — GIL limits to ~1 core
> - `ProcessPoolExecutor` for I/O — unnecessary overhead from process creation and pickling
> - Not setting `max_workers` — defaults may spawn too many threads
> - For simple async I/O, `asyncio` is lighter than thread pools

#### ThreadPoolExecutor — I/O-bound work

```python
# ThreadPoolExecutor — I/O-bound parallelism with blocking libraries

def fetch_sync(url: str) -> dict:
    """Simulate a blocking HTTP call (like requests.get)."""
    time.sleep(0.5)  # simulate network latency
    return {"url": url, "status": 200, "size": len(url) * 100}

urls = [f"https://api.example.com/table/{t}" for t in ["events", "users", "products", "sessions", "logs"]]

# Sequential
print("=== Sequential (blocking) ===")
start = time.perf_counter()
seq_results = [fetch_sync(u) for u in urls]
print(f"  {len(seq_results)} fetches in {time.perf_counter() - start:.2f}s")

# ThreadPool
print("\n=== ThreadPoolExecutor (5 threads) ===")
start = time.perf_counter()
with ThreadPoolExecutor(max_workers=5) as pool:
    # map() preserves order — results come back in the same order as inputs
    thread_results = list(pool.map(fetch_sync, urls))
print(f"  {len(thread_results)} fetches in {time.perf_counter() - start:.2f}s")
```

    === Sequential (blocking) ===
      5 fetches in 2.50s
    
    === ThreadPoolExecutor (5 threads) ===
      5 fetches in 0.50s

#### submit() + as_completed() — process results as they finish

```python
# submit() + as_completed() — process results as they finish

print("\n=== submit + as_completed (results as they arrive) ===")
with ThreadPoolExecutor(max_workers=5) as pool:
    # submit() returns a Future for each task
    future_to_url = {pool.submit(fetch_sync, url): url for url in urls}
    
    for future in as_completed(future_to_url):
        url = future_to_url[future]
        try:
            result = future.result()  # blocks until this specific future is done
            print(f"  Done: {url.split('/')[-1]} -> {result['size']} bytes")
        except Exception as e:
            print(f"  Error: {url} -> {e}")
```

    
    === submit + as_completed (results as they arrive) ===
      Done: events -> 3600 bytes
      Done: users -> 3500 bytes
      Done: sessions -> 3800 bytes
      Done: logs -> 3400 bytes
      Done: products -> 3800 bytes

#### ProcessPoolExecutor

```python
# ProcessPoolExecutor — CPU-bound parallelism bypassing the GIL

def cpu_heavy(data: bytes) -> str:
    """CPU-bound work: compute SHA-256 hash of a large payload."""
    for _ in range(100):
        data = hashlib.sha256(data).digest()
    return data.hex()[:16]

# Generate payloads
payloads = [os.urandom(1024 * 100) for _ in range(8)]  # 8 x 100KB chunks

# Sequential baseline — single core, no parallelism
print("=== Sequential (single core) ===")
start = time.perf_counter()
seq_hashes = [cpu_heavy(p) for p in payloads]
seq_time = time.perf_counter() - start
print(f"  {len(seq_hashes)} hashes in {seq_time:.2f}s")
```

    === Sequential (single core) ===
      8 hashes in 0.00s

#### ThreadPoolExecutor — GIL limits CPU-bound speedup

> [!danger] GIL blocks CPU-bound threads
>
> GIL makes threads *slower* than sequential for CPU-bound work.
> The GIL forces only one thread to execute Python bytecode at a time. For CPU-bound tasks, threads add context-switching overhead with zero parallelism gain. The result below shows a speedup less than 1.0x. Use `ProcessPoolExecutor` for CPU-bound work.

```python
# ThreadPoolExecutor for CPU-bound — demonstrates GIL limitation

print(f"=== ThreadPoolExecutor ({os.cpu_count()} workers) ===")
start = time.perf_counter()
with ThreadPoolExecutor(max_workers=os.cpu_count()) as pool:
    thread_hashes = list(pool.map(cpu_heavy, payloads))
thread_time = time.perf_counter() - start
print(f"  {len(thread_hashes)} hashes in {thread_time:.2f}s")
print(f"  Speedup vs sequential: {seq_time / thread_time:.1f}x (GIL limits CPU-bound threads)")
print(f"  Results match: {seq_hashes == thread_hashes}")
```

    === ThreadPoolExecutor (16 workers) ===
      8 hashes in 0.00s
      Speedup vs sequential: 0.6x (GIL limits CPU-bound threads)
      Results match: True

#### ProcessPoolExecutor — true multi-core speedup

```python
# ProcessPoolExecutor — true multi-core speedup for CPU-bound work

script = textwrap.dedent("""
    from concurrent.futures import ProcessPoolExecutor
    import hashlib, time, os

    def cpu_heavy(data: bytes) -> str:
        for _ in range(100):
            data = hashlib.sha256(data).digest()
        return data.hex()[:16]

    if __name__ == "__main__":
        payloads = [os.urandom(1024 * 100) for _ in range(8)]

        start = time.perf_counter()
        seq = [cpu_heavy(p) for p in payloads]
        seq_time = time.perf_counter() - start

        start = time.perf_counter()
        with ProcessPoolExecutor() as pool:
            proc = list(pool.map(cpu_heavy, payloads))
        proc_time = time.perf_counter() - start

        print(f"Sequential:   {seq_time:.2f}s")
        print(f"ProcessPool:  {proc_time:.2f}s  ({os.cpu_count()} cores)")
        print(f"Speedup:      {seq_time / proc_time:.1f}x")
        print(f"Results match: {seq == proc}")
""")

print(f"=== ProcessPoolExecutor (via subprocess — real multi-core) ===")
with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
    f.write(script)
    tmp_script = f.name

result = subprocess.run([sys.executable, tmp_script], capture_output=True, text=True)
print(result.stdout.strip())
os.unlink(tmp_script)
```

    === ProcessPoolExecutor (via subprocess — real multi-core) ===
    Sequential:   0.00s
    ProcessPool:  0.10s  (16 cores)
    Speedup:      0.0x
    Results match: True

#### Comparison table

```python
# Comparison table — asyncio vs threads vs processes

print("""
=== When to use what ===

Approach              Best for          GIL issue?  C# equivalent
─────────────────────────────────────────────────────────────────
asyncio               I/O (async libs)  No (1 thread)  async/await
ThreadPoolExecutor    I/O (sync libs)   Yes, but OK    Task.Run()
ProcessPoolExecutor   CPU-bound work    No (separate)  Parallel.ForEach()
""")
```

    
    === When to use what ===
    
    Approach              Best for          GIL issue?  C# equivalent
    ─────────────────────────────────────────────────────────────────
    asyncio               I/O (async libs)  No (1 thread)  async/await
    ThreadPoolExecutor    I/O (sync libs)   Yes, but OK    Task.Run()
    ProcessPoolExecutor   CPU-bound work    No (separate)  Parallel.ForEach()

#### multiprocessing.Queue — inter-process communication

```python
# Inter-process communication — subprocess for cross-process data exchange

result = subprocess.run(
    ["python", "-c", "import json; print(json.dumps({'source': 'child', 'pid': __import__('os').getpid(), 'result': sum(range(100))}))"],
    capture_output=True, text=True, timeout=10,
)
print(f"  Exit code: {result.returncode}")
parsed = json_mod.loads(result.stdout)
print(f"  Parsed: source={parsed['source']}, pid={parsed['pid']}, result={parsed['result']}")

# Run multiple subprocesses concurrently using ThreadPoolExecutor
# (asyncio.create_subprocess_exec doesn't work on Windows ProactorEventLoop in notebooks)
def run_python_expr(expr: str) -> tuple[str, str]:
    """Run a Python expression in a child process, return (expr, result)."""
    r = subprocess.run(["python", "-c", f"print({expr})"], capture_output=True, text=True, timeout=10)
    return (expr, r.stdout.strip())

expressions = ["2**10", "sum(range(1000))", "3.14159 * 2"]
with ThreadPoolExecutor(max_workers=3) as pool:
    results = list(pool.map(run_python_expr, expressions))

for expr, result in results:
    print(f"  {expr:25} = {result}")
```

      Exit code: 0
      Parsed: source=child, pid=40052, result=4950
      2**10                     = 1024
      sum(range(1000))          = 499500
      3.14159 * 2               = 6.28318

## Threading and Concurrency

> [!info] Threading primitives
>
> - `threading.Thread(target=func, args=())` — creates an OS thread
> - `.start()` — begins execution; `.join()` — waits for completion
> - Threads share memory — use `Lock` for shared mutable state
> - `threading.Event` — signals between threads (one sets, others wait)
> - Daemon threads die when the main thread exits

Threads provide true concurrency for I/O-bound work (the GIL is released during I/O) with lower overhead than processes (no pickling, no process creation). Use threads when asyncio isn't an option.

> [!warning] Threading pitfalls
>
> - **Threads for CPU-bound work** — GIL limits to ~1 core. Use `multiprocessing` instead.
> - **Shared mutable state without locks** — race conditions
> - **Not joining threads** — main thread may exit before workers finish
> - For async I/O, prefer `asyncio` (lighter than thread pools)

#### threading.Thread — basic thread creation and join

```python
# Basic threading — create, start, join, and collect results

def worker(name: str, delay: float, results: list):
    """A simple worker that simulates work and appends to shared list."""
    print(f"  [{threading.current_thread().name}] {name} starting")
    time.sleep(delay)
    results.append(f"{name} done")
    print(f"  [{threading.current_thread().name}] {name} finished")

print("=== Basic Threads ===")
results = []
threads = []
for name, delay in [("fetch_users", 0.3), ("fetch_events", 0.5), ("fetch_products", 0.2)]:
    t = threading.Thread(target=worker, args=(name, delay, results), name=f"T-{name}")
    threads.append(t)
    t.start()  # start the thread — it runs concurrently

# join() — wait for all threads to finish before continuing
for t in threads:
    t.join()

print(f"  Results: {results}")
print(f"  Active threads: {threading.active_count()}")
```

    === Basic Threads ===
      [T-fetch_users] fetch_users starting
      [T-fetch_events] fetch_events starting
      [T-fetch_products] fetch_products starting
      [T-fetch_products] fetch_products finished
      [T-fetch_users] fetch_users finished
      [T-fetch_events] fetch_events finished
      Results: ['fetch_products done', 'fetch_users done', 'fetch_events done']
      Active threads: 7

#### Threading Locks

> [!danger] += is not thread-safe
>
> Python's `+=` on an integer involves three operations (read, add, write) that can interleave across threads. Even though the GIL ensures atomicity of single bytecode instructions, `+=` compiles to multiple instructions. Always use `threading.Lock` or `queue.Queue` for shared mutable state between threads.

#### Threading race condition demo (WITHOUT lock)

```python
# Race condition demo — without lock shows data corruption

counter_unsafe = 0

def increment_unsafe(n: int):
    global counter_unsafe
    for _ in range(n):
        # This is NOT atomic: read counter, add 1, write back.
        # Two threads can read the same value, both add 1, and one update is lost.
        counter_unsafe += 1

print("=== Race Condition (no lock) ===")
counter_unsafe = 0
threads = [threading.Thread(target=increment_unsafe, args=(100_000,)) for _ in range(4)]
for t in threads: t.start()
for t in threads: t.join()
print(f"  Expected: 400,000")
print(f"  Got:      {counter_unsafe:,}  {'(WRONG — race condition!)' if counter_unsafe != 400_000 else '(got lucky this time)'}")
```

    === Race Condition (no lock) ===
      Expected: 400,000
      Got:      400,000  (got lucky this time)

#### threading.Lock — fix race condition with mutual exclusion

```python
# Fixed with Lock — mutual exclusion prevents lost updates

counter_safe = 0
lock = threading.Lock()

def increment_safe(n: int):
    global counter_safe
    for _ in range(n):
        with lock:  # acquire lock, do work, release — only one thread at a time
            counter_safe += 1

print("\n=== With Lock (safe) ===")
counter_safe = 0
threads = [threading.Thread(target=increment_safe, args=(100_000,)) for _ in range(4)]
for t in threads: t.start()
for t in threads: t.join()
print(f"  Expected: 400,000")
print(f"  Got:      {counter_safe:,}  (correct — lock prevents race)")
```

    
    === With Lock (safe) ===
      Expected: 400,000
      Got:      400,000  (correct — lock prevents race)

#### Thread-safe data structures and patterns

#### Thread-safe Queue — producer-consumer

```python
# Producer and consumer functions for thread-safe queue

def thread_producer(q: queue.Queue, n: int, stop_event: threading.Event):
    """Produce events and put them in the queue."""
    for i in range(n):
        event = {"id": f"evt_{i:03d}", "type": random.choice(["click", "view", "purchase"])}
        q.put(event)
        time.sleep(0.02)
    stop_event.set()  # signal workers: no more events coming

def thread_consumer(name: str, q: queue.Queue, stop_event: threading.Event, results: list):
    """Consume events from the queue until stop signal + queue empty."""
    while not (stop_event.is_set() and q.empty()):
        try:
            event = q.get(timeout=0.1)
            time.sleep(random.uniform(0.01, 0.05))
            results.append(f"{name}: {event['id']}")
            q.task_done()
        except queue.Empty:
            continue
```

#### queue.Queue — run threaded producer-consumer pipeline

```python
# 1 producer + 3 consumers with bounded queue

print("=== Thread-safe Queue (producer-consumer) ===")
q = queue.Queue(maxsize=5)
stop_event = threading.Event()
results = []
start = time.perf_counter()

prod_thread = threading.Thread(target=thread_producer, args=(q, 20, stop_event))
cons_threads = [
    threading.Thread(target=thread_consumer, args=(f"worker-{i}", q, stop_event, results))
    for i in range(3)
]
prod_thread.start()
for t in cons_threads: t.start()
prod_thread.join()
for t in cons_threads: t.join()

elapsed = time.perf_counter() - start
print(f"  Processed {len(results)} events in {elapsed:.2f}s")
worker_counts = Counter(r.split(":")[0] for r in results)
for w, c in sorted(worker_counts.items()):
    print(f"    {w}: {c} events")
```

    === Thread-safe Queue (producer-consumer) ===
      Processed 20 events in 0.49s
        worker-0: 7 events
        worker-1: 7 events
        worker-2: 6 events

#### threading.Event — coordinating threads

```python
# threading.Event — coordinating threads with signals

print("\n=== threading.Event (coordination) ===")
data_ready = threading.Event()
shared_data = {}

def data_loader():
    print("  Loader: fetching data...")
    time.sleep(0.5)
    shared_data["rows"] = [1, 2, 3, 4, 5]
    print("  Loader: data ready, signaling")
    data_ready.set()  # signal that data is available

def data_processor():
    print("  Processor: waiting for data...")
    data_ready.wait()  # blocks until set() is called
    print(f"  Processor: got {len(shared_data['rows'])} rows, processing")

loader = threading.Thread(target=data_loader)
processor = threading.Thread(target=data_processor)
processor.start()  # starts first but waits for the event
loader.start()
loader.join()
processor.join()
print("  Both threads done")
```

    
    === threading.Event (coordination) ===
      Processor: waiting for data...
      Loader: fetching data...
      Loader: data ready, signaling
      Processor: got 5 rows, processing
      Both threads done

#### Threading and Concurrency — Summary and Decision Guide
