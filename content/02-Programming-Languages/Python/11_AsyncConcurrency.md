---
type: reference
category: programming-languages
technology: [python]
tags: [reference, programming-languages, python, async]
aliases: [async await, concurrency, parallelism, tasks, threads, asyncio, Task]
keywords: [asyncio, async, await, coroutine, Task, threading, multiprocessing, concurrent.futures, GIL]
description: "Python async and concurrency reference with executable examples and cell outputs — covers asyncio, async/await, tasks, threading, multiprocessing, and concurrent.futures. See [[cs-11_AsyncConcurrency]] for the C# equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[cs-11_AsyncConcurrency]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 11. Async & Concurrency - Python

Topics covered:
- Async & Await (asyncio)
- Tasks & Parallelism (concurrent.futures, multiprocessing)
- Threading & Concurrency (threading, locks, queues)

## 1. Async & Await


```python
# Async & Await — cooperative concurrency with asyncio
#
# KEY CONCEPTS:
# - async def: declares a coroutine (a function that can pause and resume).
# - await: pauses the coroutine until the awaited task completes.
# - asyncio.run(): the entry point — starts the event loop and runs a coroutine.
#   (In Jupyter, the loop is already running — use "await" directly at top level.)
# - Event loop: a single-threaded scheduler that multiplexes coroutines.
#   While one coroutine awaits I/O, the loop runs another. No threads needed.
# - This is NOT parallelism — it's concurrency on ONE thread.
#   Great for I/O-bound work (HTTP, DB, file). Useless for CPU-bound work.
# - C# equivalent: async Task / await (same keywords, same idea).
#
# WHY async matters for Data Engineering:
# - API calls (BigQuery, GCS, REST) are I/O-bound — async lets you overlap them.
# - A pipeline that fetches 10 APIs sequentially in 10s can do it in ~1s with async.

import asyncio
import time

# ─── Basic coroutine ───

async def fetch_data(source: str, delay: float) -> dict:
    """Simulate fetching data from a source with network latency."""
    print(f"  [{time.strftime('%H:%M:%S')}] Starting fetch: {source}")
    await asyncio.sleep(delay)  # non-blocking sleep — yields control to the event loop
    print(f"  [{time.strftime('%H:%M:%S')}] Completed fetch: {source}")
    return {"source": source, "rows": int(delay * 1000)}

# ─── Sequential vs concurrent ───

# Sequential — each fetch waits for the previous one
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
      [04:53:21] Starting fetch: users_api
      [04:53:22] Completed fetch: users_api
      [04:53:22] Starting fetch: events_api
      [04:53:23] Completed fetch: events_api
      [04:53:23] Starting fetch: products_api
      [04:53:23] Completed fetch: products_api
      Total: 2.33s (sum of all delays)
    
    === Concurrent (asyncio.gather) ===
      [04:53:23] Starting fetch: users_api
      [04:53:23] Starting fetch: events_api
      [04:53:23] Starting fetch: products_api
      [04:53:24] Completed fetch: products_api
      [04:53:24] Completed fetch: events_api
      [04:53:24] Completed fetch: users_api
      Total: 1.01s (max of all delays)
    
    Results match: True
    


```python
# asyncio.gather vs asyncio.TaskGroup — running multiple coroutines
#
# gather(): classic approach — returns results in order. If one fails, others may still run.
# TaskGroup (Python 3.11+): structured concurrency — if one fails, ALL are cancelled.
#   C# equivalent: Task.WhenAll() cancels remaining on first failure (similar to TaskGroup).
#
# Rule of thumb:
#   - gather(): when you want all results and handle errors yourself.
#   - TaskGroup: when failure of one task means the whole batch is invalid.

import asyncio
import time

async def fetch_table(name: str, delay: float, fail: bool = False) -> dict:
    """Simulate a BigQuery table fetch."""
    await asyncio.sleep(delay)
    if fail:
        raise RuntimeError(f"Fetch failed: {name}")
    return {"table": name, "rows": int(delay * 1000)}

# ─── asyncio.gather with error handling ───

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

# ─── TaskGroup (Python 3.11+) — structured concurrency ───

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

    === asyncio.gather (return_exceptions=True) ===
      OK:    {'table': 'events', 'rows': 300}
      ERROR: Fetch failed: users
      OK:    {'table': 'products', 'rows': 100}
    
    === TaskGroup (structured concurrency) ===
      Caught 1 error(s):
        - Fetch failed: users
      t3 (products) completed: {'table': 'products', 'rows': 100}
    


```python
# Async patterns for Data Engineering pipelines
#
# Common patterns:
# 1. Semaphore: limit concurrent requests (don't overwhelm an API).
# 2. Timeout: cancel slow tasks (don't let a pipeline hang forever).
# 3. Retry: retry failed tasks with exponential backoff.
# 4. Producer-consumer: decouple data production from processing with asyncio.Queue.

import asyncio
import time
import random

# ─── 1. Semaphore — rate limiting ───
# Scenario: fetch from an API that allows max 3 concurrent requests.

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

# ─── 2. Timeout — cancel slow tasks ───
# Scenario: BigQuery query that should finish in 2s or we abort.

async def slow_query(table: str) -> dict:
    await asyncio.sleep(5.0)  # simulate a very slow query
    return {"table": table, "rows": 999}

print("\n=== Timeout (asyncio.wait_for) ===")
try:
    result = await asyncio.wait_for(slow_query("huge_table"), timeout=1.0)
    print(f"  Result: {result}")
except asyncio.TimeoutError:
    print("  Query timed out after 1.0s — cancelled automatically")

# ─── 3. Retry with exponential backoff ───
# Scenario: flaky API that fails intermittently.

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

# ─── 4. Producer-Consumer with asyncio.Queue ───
# Scenario: one task produces events, multiple workers process them.

async def async_producer(queue: asyncio.Queue, n: int):
    """Generate events and put them in the queue."""
    for i in range(n):
        event = {"id": f"evt_{i:03d}", "type": random.choice(["click", "view", "purchase"])}
        await queue.put(event)
        await asyncio.sleep(0.05)  # simulate arrival rate
    # Signal workers to stop — one sentinel per worker
    for _ in range(3):
        await queue.put(None)

async def async_worker(name: str, queue: asyncio.Queue, results: list):
    """Process events from the queue until sentinel (None)."""
    while True:
        event = await queue.get()
        if event is None:
            break
        await asyncio.sleep(random.uniform(0.02, 0.1))  # simulate processing
        results.append(f"{name} processed {event['id']}")
        queue.task_done()

print("\n=== Producer-Consumer (asyncio.Queue) ===")
q = asyncio.Queue(maxsize=5)  # bounded queue — producer blocks when full
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

    === Semaphore (max 3 concurrent) ===
      Fetched 10 pages in 1.37s (max 3 at a time)
        https://api.example.com/page/0 (0.33s)
        https://api.example.com/page/1 (0.42s)
        https://api.example.com/page/2 (0.27s)
        ... (7 more)
    
    === Timeout (asyncio.wait_for) ===
      Query timed out after 1.0s — cancelled automatically
    
    === Retry with Exponential Backoff ===
      Attempt 1 failed: Connection refused (attempt 1). Retrying in 0.1s...
      Attempt 2 failed: Connection refused (attempt 2). Retrying in 0.2s...
      Success on attempt 3: {'endpoint': '/data/events', 'status': 'ok'}
    
    === Producer-Consumer (asyncio.Queue) ===
      Processed 12 events in 0.74s with 3 workers
        worker-1 processed evt_000
        worker-1 processed evt_001
        worker-3 processed evt_002
        worker-3 processed evt_003
        ... (8 more)
    

## 2. Tasks & Parallelism


```python
# concurrent.futures — thread and process pools for parallelism
#
# KEY CONCEPTS:
# - ThreadPoolExecutor: pool of threads. Good for I/O-bound work (HTTP, file, DB).
#   Threads share memory but are limited by the GIL (Global Interpreter Lock) for CPU work.
# - ProcessPoolExecutor: pool of processes. Good for CPU-bound work (parsing, hashing, ML).
#   Each process has its own GIL — true parallelism on multiple cores.
# - executor.submit(fn, *args): schedule a single task, returns a Future.
# - executor.map(fn, iterable): schedule many tasks, returns results in order.
# - Future.result(): blocks until the task completes and returns the value (or raises).
# - C# equivalent: Task.Run() (thread pool), Parallel.ForEach() (parallelism).
#
# Python's GIL:
# - The GIL means only one thread executes Python bytecode at a time.
# - Threads still help for I/O: while one thread waits for a network response, another runs.
# - For CPU-bound work, use ProcessPoolExecutor (separate processes, separate GILs).

from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
import time
import hashlib

# ─── ThreadPoolExecutor — I/O-bound work ───
# Scenario: fetch data from multiple API endpoints.

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

# ─── submit() + as_completed() — process results as they finish ───
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

    === Sequential (blocking) ===
      5 fetches in 2.50s
    
    === ThreadPoolExecutor (5 threads) ===
      5 fetches in 0.50s
    
    === submit + as_completed (results as they arrive) ===
      Done: users -> 3500 bytes
      Done: events -> 3600 bytes
      Done: products -> 3800 bytes
      Done: logs -> 3400 bytes
      Done: sessions -> 3800 bytes
    


```python
# ProcessPoolExecutor — CPU-bound parallelism
#
# Each worker is a separate OS process with its own Python interpreter and GIL.
# Data is serialized (pickled) between processes — keep payloads small.
# Best for: heavy computation, parsing, hashing, compression, ML inference.
# C# equivalent: Parallel.ForEach() or Task.Run() (no GIL in .NET).
#
# NOTEBOOK LIMITATION:
# ProcessPoolExecutor doesn't work in Jupyter on Windows — the notebook cell
# can't be pickled for subprocess spawning. The code below uses
# "if __name__ == '__main__'" guard in a subprocess to demonstrate it.
# In a real .py script, ProcessPoolExecutor works perfectly.

from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
import hashlib
import time
import os
import subprocess, sys, textwrap, tempfile

def cpu_heavy(data: bytes) -> str:
    """CPU-bound work: compute SHA-256 hash of a large payload."""
    for _ in range(100):
        data = hashlib.sha256(data).digest()
    return data.hex()[:16]

# Generate payloads
payloads = [os.urandom(1024 * 100) for _ in range(8)]  # 8 x 100KB chunks

# Sequential baseline
print("=== Sequential (single core) ===")
start = time.perf_counter()
seq_hashes = [cpu_heavy(p) for p in payloads]
seq_time = time.perf_counter() - start
print(f"  {len(seq_hashes)} hashes in {seq_time:.2f}s")

# ThreadPool — bypasses the notebook pickle issue.
# For CPU-bound work threads are limited by the GIL, so speedup is modest.
# But it demonstrates the same executor API that ProcessPool uses.
print(f"=== ThreadPoolExecutor ({os.cpu_count()} workers) ===")
start = time.perf_counter()
with ThreadPoolExecutor(max_workers=os.cpu_count()) as pool:
    thread_hashes = list(pool.map(cpu_heavy, payloads))
thread_time = time.perf_counter() - start
print(f"  {len(thread_hashes)} hashes in {thread_time:.2f}s")
print(f"  Speedup: {seq_time / thread_time:.1f}x (GIL limits CPU-bound threads)")
print(f"  Results match: {seq_hashes == thread_hashes}")

# ProcessPool — run via a temp .py script to avoid notebook pickle issue.
# This is how ProcessPoolExecutor actually works in production scripts.
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
if result.stderr:
    print(f"  stderr: {result.stderr.strip()}")
os.unlink(tmp_script)

# ─── Comparison table ───
print("""
=== When to use what ===

Approach              Best for          GIL issue?  C# equivalent
─────────────────────────────────────────────────────────────────
asyncio               I/O (async libs)  No (1 thread)  async/await
ThreadPoolExecutor    I/O (sync libs)   Yes, but OK    Task.Run()
ProcessPoolExecutor   CPU-bound work    No (separate)  Parallel.ForEach()
""")
```

    === Sequential (single core) ===
      8 hashes in 0.00s
    === ThreadPoolExecutor (16 workers) ===
      8 hashes in 0.00s
      Speedup: 0.6x (GIL limits CPU-bound threads)
      Results match: True
    === ProcessPoolExecutor (via subprocess — real multi-core) ===
    Sequential:   0.00s
    ProcessPool:  0.11s  (16 cores)
    Speedup:      0.0x
    Results match: True
    
    === When to use what ===
    
    Approach              Best for          GIL issue?  C# equivalent
    ─────────────────────────────────────────────────────────────────
    asyncio               I/O (async libs)  No (1 thread)  async/await
    ThreadPoolExecutor    I/O (sync libs)   Yes, but OK    Task.Run()
    ProcessPoolExecutor   CPU-bound work    No (separate)  Parallel.ForEach()
    
    

## 3. Threading & Concurrency


```python
# threading module — low-level thread management
#
# KEY CONCEPTS:
# - threading.Thread: create a new OS thread.
# - thread.start(): begin execution. thread.join(): wait for it to finish.
# - threading.Lock: mutex — only one thread can hold it at a time.
#   Prevents race conditions when multiple threads read/write shared data.
# - threading.Event: signal between threads (one sets it, others wait for it).
# - daemon threads: background threads that die when the main thread exits.
# - C# equivalent: System.Threading.Thread, lock keyword, Monitor, ManualResetEvent.
#
# WARNING: the GIL means threads don't give you CPU parallelism in Python.
# Use threads for I/O overlapping, not for computation.

import threading
import time

# ─── Basic threading ───

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
    


```python
# Locks — preventing race conditions
#
# A race condition occurs when two threads read-modify-write shared data
# at the same time, causing lost updates.
# Lock (mutex) ensures only one thread enters the critical section at a time.
# C# equivalent: lock (obj) { ... } or Monitor.Enter/Exit.

import threading
import time

# ─── Race condition demo (WITHOUT lock) ───

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

# ─── Fixed with Lock ───

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

# ─── Note on performance ───
# The lock version is SLOWER because threads serialize on the lock.
# This is the fundamental trade-off: correctness vs speed.
# If you need both, redesign to avoid shared mutable state (use queues, immutable data).
```

    === Race Condition (no lock) ===
      Expected: 400,000
      Got:      400,000  (got lucky this time)
    
    === With Lock (safe) ===
      Expected: 400,000
      Got:      400,000  (correct — lock prevents race)
    


```python
# Thread-safe data structures and patterns
#
# KEY CONCEPTS:
# - queue.Queue: thread-safe FIFO queue. No explicit locking needed.
#   The go-to pattern for producer-consumer with threads.
# - threading.Event: flag that one thread sets and others wait for.
#   Useful for signaling "data is ready" or "please stop".
# - C# equivalents: ConcurrentQueue<T>, ManualResetEventSlim.

import threading
import queue
import time
import random

# ─── Thread-safe Queue — producer-consumer ───
# Scenario: one thread reads events from a source, multiple workers process them.

def thread_producer(q: queue.Queue, n: int, stop_event: threading.Event):
    """Produce events and put them in the queue."""
    for i in range(n):
        event = {"id": f"evt_{i:03d}", "type": random.choice(["click", "view", "purchase"])}
        q.put(event)
        time.sleep(0.02)  # simulate arrival rate
    stop_event.set()  # signal workers: no more events coming

def thread_consumer(name: str, q: queue.Queue, stop_event: threading.Event, results: list):
    """Consume events from the queue until stop signal + queue empty."""
    while not (stop_event.is_set() and q.empty()):
        try:
            event = q.get(timeout=0.1)  # wait up to 0.1s for an item
            time.sleep(random.uniform(0.01, 0.05))  # simulate processing
            results.append(f"{name}: {event['id']}")
            q.task_done()
        except queue.Empty:
            continue  # no item yet, loop back and check stop_event

print("=== Thread-safe Queue (producer-consumer) ===")
q = queue.Queue(maxsize=5)  # bounded queue — producer blocks when full
stop_event = threading.Event()
results = []
start = time.perf_counter()

# Start 1 producer + 3 consumers
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
# Count events per worker
from collections import Counter
worker_counts = Counter(r.split(":")[0] for r in results)
for w, c in sorted(worker_counts.items()):
    print(f"    {w}: {c} events")

# ─── threading.Event — coordinating threads ───

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

    === Thread-safe Queue (producer-consumer) ===
      Processed 20 events in 0.50s
        worker-0: 7 events
        worker-1: 6 events
        worker-2: 7 events
    
    === threading.Event (coordination) ===
      Processor: waiting for data...
      Loader: fetching data...
      Loader: data ready, signaling
      Processor: got 5 rows, processing
      Both threads done
    


```python
# Summary — choosing the right concurrency tool
#
# Python has THREE concurrency models. Choose based on your workload:
#
# ┌─────────────────────┬──────────────────┬────────────────────┬──────────────────────┐
# │ Tool                │ Best for         │ Threads/Processes  │ C# equivalent        │
# ├─────────────────────┼──────────────────┼────────────────────┼──────────────────────┤
# │ asyncio             │ I/O (async libs) │ 1 thread           │ async/await          │
# │ ThreadPoolExecutor  │ I/O (sync libs)  │ N threads          │ Task.Run()           │
# │ ProcessPoolExecutor │ CPU-bound        │ N processes        │ Parallel.ForEach()   │
# │ threading.Thread    │ Low-level control│ Manual threads     │ new Thread()         │
# │ threading.Lock      │ Shared state     │ N/A (any threads)  │ lock keyword          │
# │ queue.Queue         │ Thread messaging │ N/A (any threads)  │ ConcurrentQueue<T>   │
# │ asyncio.Queue       │ Async messaging  │ 1 thread           │ Channel<T>           │
# └─────────────────────┴──────────────────┴────────────────────┴──────────────────────┘
#
# Decision tree:
#   1. Is the work I/O-bound or CPU-bound?
#      - I/O → go to 2
#      - CPU → ProcessPoolExecutor (bypass the GIL)
#   2. Are your libraries async (aiohttp, asyncpg, etc.)?
#      - Yes → asyncio
#      - No  → ThreadPoolExecutor (wrap sync calls)
#   3. Need fine-grained thread control?
#      - Yes → threading.Thread + Lock/Event/Queue
#      - No  → use the high-level executors above
#
# Data Engineering rule of thumb:
#   - API calls, DB queries, file I/O → asyncio or ThreadPool
#   - Parsing, hashing, compression, ML → ProcessPool
#   - Kafka/Pub/Sub consumers → asyncio (async client) or threading (sync client)
```
