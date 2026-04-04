---
tags: [csharp]
aliases: [async await, concurrency, parallelism, tasks, threads, asyncio, Task]
description: "C# async and concurrency reference with executable examples and cell outputs — covers async/await, Task, parallel programming, CancellationToken, and Channels. See [12_py_asyncconcurrency](https://alp78.github.io/elysium/02-Programming-Languages/Python/12_py_asyncconcurrency) for the Python equivalent."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 12. Async & Concurrency - C#

> [!quote]
> "Everybody who learns concurrency thinks they understand it, ends up finding mysterious races they thought weren't possible, and discovers that they didn't actually understand it yet after all."
>
> — **Herb Sutter**, *The Free Lunch Is Over*, Dr. Dobb's Journal (2005)

```csharp
using System.Diagnostics;
using System.Threading;
using System.Threading.Channels;
using System.Net.Http;
using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Runtime.CompilerServices;
```

## Async and Await

> [!info] Async fundamentals
>
> - `async` — marks a method as asynchronous, returning `Task` or `Task<T>`
> - `await` — pauses the method until the awaited task completes; the thread is released to the pool, not blocked
> - The thread pool manages threads automatically

**Why async matters for data engineering:** API calls (BigQuery, GCS, REST) are I/O-bound — async lets you overlap them. A pipeline that fetches 10 APIs sequentially in 10s can do it in ~1s with async.

> [!warning] Async pitfalls
>
> - **`.Result` or `.Wait()`** — deadlocks in UI/web contexts; always `await`
> - **`async void`** — exceptions are unobservable; use `async Task`
> - **`await` in a loop** when `Task.WhenAll` works — sequential instead of concurrent
> - For **CPU-bound work**, use `Task.Run` or `Parallel` instead

> [!success] Correct async pattern
>
> Always `await` async methods directly. Use `async Task` (never `async void`) for all non-event-handler methods. Use `Task.WhenAll` to run independent I/O-bound tasks concurrently. Use `Task.Run` only for CPU-bound work.

> [!danger] .Result and .Wait() cause deadlocks
>
> `.Result` and `.Wait()` cause deadlocks in synchronization contexts
> Calling `.Result` or `.Wait()` on a `Task` from a thread with a `SynchronizationContext` (ASP.NET, WinForms, WPF) blocks the thread that the `await` continuation needs to resume on, causing a permanent deadlock. Always use `await` instead. In rare cases where sync-over-async is unavoidable, use `Task.Run(() => AsyncMethod()).Result` to escape the context.

> [!success] Use await instead
>
> Replace `.Result`/`.Wait()` with `await`. If you must call async code from a sync context (e.g., legacy code), wrap in `Task.Run(() => MyMethodAsync()).GetAwaiter().GetResult()` to avoid capturing the synchronization context.

> [!danger] async void
>
> `async void` — exceptions are unobservable and crash the process
> Exceptions in `async void` methods propagate to the `SynchronizationContext` and terminate the process. The caller has no `Task` to `await` or catch. Always use `async Task`. The only valid use of `async void` is UI event handlers (`async void Button_Click`).

> [!success] Use async Task
>
> Declare all async methods as `async Task` or `async Task<T>`. This makes exceptions observable and awaitable. Reserve `async void` exclusively for UI event handlers where the framework requires it.

> [!tip] ConfigureAwait(false) in library code
>
> In library code (not UI or ASP.NET controllers), add `.ConfigureAwait(false)` after every `await` to avoid capturing the synchronization context. This prevents deadlocks when callers use `.Result` and improves performance by skipping context marshaling.

#### async/await Task — basic async method

```csharp
// Basic async method — async Task<T> with await Task.Delay

async Task<Dictionary<string, object>> FetchDataAsync(string source, double delaySeconds)
{
    $"  [{DateTime.Now:HH:mm:ss}] Starting fetch: {source}"
    await Task.Delay(TimeSpan.FromSeconds(delaySeconds));  // non-blocking delay
    $"  [{DateTime.Now:HH:mm:ss}] Completed fetch: {source}"
    return new Dictionary<string, object>
    {
        ["source"] = source,
        ["rows"] = (int)(delaySeconds * 1000)
    };
}
```

#### Task.WhenAll — sequential vs concurrent execution

```csharp
// Sequential vs concurrent — await one-by-one vs Task.WhenAll

// === Sequential (one after another) ===
var sw = Stopwatch.StartNew();
var r1 = await FetchDataAsync("users_api", 1.0);
var r2 = await FetchDataAsync("events_api", 0.8);
var r3 = await FetchDataAsync("products_api", 0.5);
sw.Stop();
$"  Total: {sw.Elapsed.TotalSeconds:F2}s (sum of all delays)"
```

      [06:36:58] Starting fetch: users_api
      [06:36:59] Completed fetch: users_api
      [06:36:59] Starting fetch: events_api
      [06:37:00] Completed fetch: events_api
      [06:37:00] Starting fetch: products_api
      [06:37:00] Completed fetch: products_api
      2.32s (sum of all delays)

#### Concurrent execution with Task.WhenAll

```csharp
// Concurrent execution — start all tasks, await them together

sw.Restart();
var t1 = FetchDataAsync("users_api", 1.0);      // start task (don't await yet)
var t2 = FetchDataAsync("events_api", 0.8);      // start task
var t3 = FetchDataAsync("products_api", 0.5);    // start task
var results = await Task.WhenAll(t1, t2, t3);     // await ALL at once
sw.Stop();
$"  Total: {sw.Elapsed.TotalSeconds:F2}s (max of all delays)"
$"  Results: {results.Length} dictionaries"
```

    
      [06:37:03] Starting fetch: users_api
      [06:37:03] Starting fetch: events_api
      [06:37:03] Starting fetch: products_api
      [06:37:03] Completed fetch: products_api
      [06:37:04] Completed fetch: events_api
      [06:37:04] Completed fetch: users_api
      1.01s (max of all delays)
      3 dictionaries

#### Task.WhenAll and Task.WhenAny

```csharp
// Task.WhenAll vs Task.WhenAny — waiting strategies

async Task<string> FetchTableAsync(string name, double delay, bool fail = false)
{
    await Task.Delay(TimeSpan.FromSeconds(delay));
    if (fail) throw new InvalidOperationException($"Fetch failed: {name}");
    return $"{name}: {(int)(delay * 1000)} rows";
}
```

#### Task.WhenAll with error handling

```csharp
// Task.WhenAll with error handling — catch failures from parallel tasks

// === Task.WhenAll (error handling) ===
var allTask = Task.WhenAll(
    FetchTableAsync("events", 0.3),
    FetchTableAsync("users", 0.2, fail: true),  // this one fails
    FetchTableAsync("products", 0.1)
);

try
{
    await allTask;
}
catch
{
    // allTask.Exception contains ALL errors (AggregateException)
    foreach (var ex in allTask.Exception!.Flatten().InnerExceptions)
        ex.Message  // ERROR
}
```

      Fetch failed: users

#### Task.WhenAny — first to complete wins

```csharp
// Task.WhenAny — first to complete wins (racing replicas)

var tasks = new[]
{
    FetchTableAsync("replica-us", 0.5),
    FetchTableAsync("replica-eu", 0.3),
    FetchTableAsync("replica-asia", 0.8),
};

var fastest = await Task.WhenAny(tasks);
await fastest  // First to finish
// Note: the other tasks are still running — they don't cancel automatically.
// Use CancellationToken to cancel the rest (see next cell).
```

    
      replica-eu: 300 rows

#### CancellationToken

A CancellationToken is a cooperative cancellation mechanism — you pass it to async methods, and they periodically check `token.IsCancellationRequested` or call `token.ThrowIfCancellationRequested()` to stop early. The caller creates a `CancellationTokenSource`, which controls when cancellation is triggered (timeout, user action, or programmatic). Cancellation is cooperative: the called code must actively check the token — it's not forcefully killed.

> [!warning] Cancellation is not instant
> Passing a CancellationToken doesn't kill the operation immediately. The code must CHECK the token at regular intervals. A long-running SQL query or HTTP call won't stop until it returns — only then does the next token check abort. For true preemption, the underlying API must support cancellation natively (e.g., `HttpClient` does, raw socket reads may not).

> [!success] Design for cooperative cancellation
>
> Call `ct.ThrowIfCancellationRequested()` at logical checkpoints within loops and between pipeline stages. Pass the token to all awaited calls (e.g., `Task.Delay(ms, ct)`, `HttpClient.GetAsync(url, ct)`) so they short-circuit immediately when cancelled.

```csharp
// CancellationToken — cooperative cancellation for async operations

async Task<string> LongRunningExportAsync(string table, CancellationToken ct)
{
    table  // Starting export
    for (int i = 0; i < 10; i++)
    {
        ct.ThrowIfCancellationRequested();  // check if cancelled
        await Task.Delay(500, ct);           // also accepts token (throws if cancelled)
        $"  {table}: chunk {i + 1}/10"
    }
    return $"{table}: export complete";
}
```

#### CancellationTokenSource — cancel after timeout

```csharp
// Cancel after timeout — automatic cancellation with CancelAfter

// === CancellationToken (timeout) ===
// CancelAfter: automatically cancel after specified time
var cts = new CancellationTokenSource();
cts.CancelAfter(TimeSpan.FromSeconds(2));  // auto-cancel after 2s

try
{
    var result = await LongRunningExportAsync("huge_events", cts.Token);
    $"  {result}"
}
catch (OperationCanceledException)
{
    //   Export cancelled after 2s timeout
}
```

      huge_events
      huge_events: chunk 1/10
      huge_events: chunk 2/10
      huge_events: chunk 3/10
      Export cancelled after 2s timeout

#### CancellationTokenSource.Cancel — manual cooperative cancellation

```csharp
// Manual cancellation — cancel on demand from external trigger

var cts2 = new CancellationTokenSource();

// Start the export
var exportTask = LongRunningExportAsync("daily_clicks", cts2.Token);

// Cancel after 1.5s from a separate task
_ = Task.Run(async () =>
{
    await Task.Delay(1500);
    //   [Supervisor] Cancelling export...
    cts2.Cancel();
});

try
{
    await exportTask;
}
catch (OperationCanceledException)
{
    //   Export was manually cancelled
}
```

    
      daily_clicks
      daily_clicks: chunk 1/10
      daily_clicks: chunk 2/10
      [Supervisor] Cancelling export...
      Export was manually cancelled

## Async patterns

#### SemaphoreSlim — rate limiting

```csharp
// SemaphoreSlim — limit concurrent async operations (rate limiting)

async Task<string> FetchWithLimitAsync(SemaphoreSlim sem, string url)
{
    await sem.WaitAsync();  // blocks if 3 tasks already inside
    try
    {
        var delay = Random.Shared.Next(100, 500);
        await Task.Delay(delay);
        return $"{url} ({delay}ms)";
    }
    finally
    {
        sem.Release();  // always release, even on error
    }
}

// === SemaphoreSlim (max 3 concurrent) ===
var sem = new SemaphoreSlim(3);  // max 3 concurrent
var sw = Stopwatch.StartNew();
var tasks = Enumerable.Range(0, 10)
    .Select(i => FetchWithLimitAsync(sem, $"https://api.example.com/page/{i}"))
    .ToArray();
var results = await Task.WhenAll(tasks);
sw.Stop();
$"  Fetched {results.Length} pages in {sw.Elapsed.TotalSeconds:F2}s"
foreach (var r in results.Take(3))
    $"    {r}"
$"    ... ({results.Length - 3} more)"
```

      Fetched 10 pages in 1.33s
        https://api.example.com/page/0 (175ms)
        https://api.example.com/page/1 (397ms)
        https://api.example.com/page/2 (491ms)
        ... (7 more)

#### Retry with exponential backoff — async transient error recovery

```csharp
// Retry with exponential backoff — recover from transient failures

var attemptCount = 0;

async Task<string> FlakyApiAsync(string endpoint)
{
    attemptCount++;
    if (attemptCount < 3)
        throw new HttpRequestException($"Connection refused (attempt {attemptCount})");
    return $"{endpoint}: ok";
}

async Task<T> RetryWithBackoffAsync<T>(Func<Task<T>> action, int maxRetries = 5, int baseDelayMs = 100)
{
    for (int attempt = 0; attempt < maxRetries; attempt++)
    {
        try
        {
            return await action();
        }
        catch (Exception ex) when (attempt < maxRetries - 1)
        {
            var delay = baseDelayMs * (int)Math.Pow(2, attempt);  // 100, 200, 400, 800...
            $"  Attempt {attempt + 1} failed: {ex.Message}. Retrying in {delay}ms..."
            await Task.Delay(delay);
        }
    }
    throw new InvalidOperationException("Unreachable");
}

attemptCount = 0;
var apiResult = await RetryWithBackoffAsync(() => FlakyApiAsync("/data/events"));
$"  Success on attempt {attemptCount}: {apiResult}"
```

    
      Connection refused (attempt 1). Retrying in 100ms...
      Connection refused (attempt 2). Retrying in 200ms...
      /data/events: ok

#### Channel<T> — async producer-consumer

A Channel is a thread-safe async queue for passing data between producers and consumers. Producers write with `WriteAsync`, consumers read with `ReadAllAsync`. Channels are bounded (backpressure when full) or unbounded (unlimited buffer). They're the modern replacement for `BlockingCollection` in async code — fully async, no thread blocking.

```csharp
// Channel producer — writes events then completes the channel

var channel = Channel.CreateBounded<Dictionary<string, string>>(5);
var processedCount = 0;

var producerTask = Task.Run(async () =>
{
    var types = new[] { "click", "view", "purchase" };
    for (int i = 0; i < 12; i++)
    {
        var evt = new Dictionary<string, string>
            { ["id"] = $"evt_{i:D3}", ["type"] = types[Random.Shared.Next(types.Length)] };
        await channel.Writer.WriteAsync(evt);
        await Task.Delay(50);
    }
    channel.Writer.Complete();
});
```

#### Channel&lt;T&gt; — consumer and pipeline execution

```csharp
// Consumer reads until channel completes, then run 3 workers

async Task ConsumeAsync(string workerName, ChannelReader<Dictionary<string, string>> reader)
{
    await foreach (var evt in reader.ReadAllAsync())
    {
        await Task.Delay(Random.Shared.Next(20, 100));
        Interlocked.Increment(ref processedCount);
    }
}

sw.Restart();
await Task.WhenAll(
    producerTask,
    ConsumeAsync("worker-1", channel.Reader),
    ConsumeAsync("worker-2", channel.Reader),
    ConsumeAsync("worker-3", channel.Reader)
);
sw.Stop();
$"  Processed {processedCount} events in {sw.Elapsed.TotalSeconds:F2}s with 3 workers"
```

    
      Processed 12 events in 0.78s with 3 workers

#### IAsyncEnumerable&lt;T&gt; — async streaming with yield

`IAsyncEnumerable<T>` enables streaming data one item at a time asynchronously. Instead of loading an entire result set into memory, you `yield return` each item as it becomes available. The consumer processes items as they arrive using `await foreach`. Essential for streaming database results, paginated API responses, or large file processing where loading everything into memory would be impractical.

```csharp
// IAsyncEnumerable<T> — async streaming with yield return

async IAsyncEnumerable<string> FetchPagesAsync(int totalPages, int itemsPerPage)
{
    for (int page = 1; page <= totalPages; page++)
    {
        await Task.Delay(100); // simulate network latency per page
        $"  Fetching page {page}..."
        for (int i = 0; i < itemsPerPage; i++)
            yield return $"page{page}_item{i + 1}"; // yield one item at a time
    }
}

// await foreach — consumer pulls items as they become available
var sw = Stopwatch.StartNew();
int count = 0;
await foreach (var item in FetchPagesAsync(3, 2))
{
    count++;
    item  // Received
}
$"  Total: {count} items in {sw.ElapsedMilliseconds}ms"
```

      Fetching page 1...
        page1_item1
        page1_item2
      Fetching page 2...
        page2_item1
        page2_item2
      Fetching page 3...
        page3_item1
        page3_item2
      6 items in 326ms

#### IAsyncEnumerable with cancellation and LINQ

```csharp
// IAsyncEnumerable with CancellationToken — graceful stream termination

async IAsyncEnumerable<int> GenerateNumbersAsync(
    [EnumeratorCancellation] CancellationToken ct = default)
{
    int n = 0;
    while (!ct.IsCancellationRequested)
    {
        await Task.Delay(50, ct);
        yield return n++;
    }
}

var cts = new CancellationTokenSource(200);
var collected = new List<int>();
try
{
    await foreach (var n in GenerateNumbersAsync().WithCancellation(cts.Token))
        collected.Add(n);
}
catch (OperationCanceledException) { }
$"  Collected {collected.Count} items before cancellation: [{string.Join(", ", collected)}]"
```

      [0, 1, 2]

#### IAsyncEnumerable with break — early exit disposes the enumerator

```csharp
// break disposes the enumerator — producer stops cleanly

count = 0;
await foreach (var item in FetchPagesAsync(10, 3))
{
    $"    {item}"
    count++;
    if (count >= 5) break;
}
```

      First 5 from paginated source:
      Fetching page 1...
        page1_item1
        page1_item2
        page1_item3
      Fetching page 2...
        page2_item1
        page2_item2

## Tasks and Parallelism

> [!info] Task and parallel APIs
>
> - `Task.Run()` — schedules work on the thread pool (returns a `Task`)
> - `Parallel.ForEach()` — partitions a collection, processes on multiple threads, blocks until done
> - `Parallel.ForEachAsync()` (.NET 6+) — async version
> - C# has **no GIL** — multiple threads execute truly in parallel

> [!warning] CPU parallelism pitfalls
>
> - `Task.Run` for I/O-bound work — use `async`/`await` instead (no thread needed)
> - Too many `Task.Run` calls — thread pool exhaustion
> - Shared mutable state without locking — race conditions

> [!success] Match the tool to the workload
>
> Use `async`/`await` for I/O-bound operations (no thread consumed while waiting). Use `Task.Run` or `Parallel.ForEach` for CPU-bound work. Protect shared state with `lock`, `Interlocked`, or `ConcurrentDictionary` — never share plain mutable fields across threads.

#### Task.Run — offload CPU work to thread pool

```csharp
// Task.Run — offload CPU work to thread pool

string ComputeHash(byte[] data)
{
    // CPU-bound: compute SHA-256 hash repeatedly
    for (int i = 0; i < 100; i++)
        data = SHA256.HashData(data);
    return Convert.ToHexString(data)[..16];
}

// Generate payloads
var payloads = Enumerable.Range(0, 8)
    .Select(_ => RandomNumberGenerator.GetBytes(100 * 1024))  // 8 x 100KB
    .ToArray();

// Sequential
// === Sequential (single thread) ===
var sw = Stopwatch.StartNew();
var seqHashes = payloads.Select(ComputeHash).ToArray();
var seqTime = sw.Elapsed;
$"  {seqHashes.Length} hashes in {seqTime.TotalSeconds:F2}s"

// Parallel with Task.Run
$"\n=== Task.Run (thread pool, {Environment.ProcessorCount} cores) ==="
sw.Restart();
var parallelTasks = payloads.Select(p => Task.Run(() => ComputeHash(p))).ToArray();
var parHashes = await Task.WhenAll(parallelTasks);
var parTime = sw.Elapsed;
$"  {parHashes.Length} hashes in {parTime.TotalSeconds:F2}s"
$"  Speedup: {seqTime / parTime:F1}x"
seqHashes.SequenceEqual(parHashes)  // Results match
```

      8 hashes in 0.00s
    
      8 hashes in 0.00s
      0.5x
      True

#### Parallel.ForEach — partition and process

```csharp
// Parallel.ForEach — partition and process collection items in parallel

var hashResults = new string[payloads.Length];
sw.Restart();
Parallel.ForEach(
    Enumerable.Range(0, payloads.Length),
    new ParallelOptions { MaxDegreeOfParallelism = 4 },  // limit to 4 threads
    i => hashResults[i] = ComputeHash(payloads[i])
);
sw.Stop();
$"  {hashResults.Length} hashes in {sw.Elapsed.TotalSeconds:F2}s (max 4 threads)"
seqHashes.SequenceEqual(hashResults)  // Results match
```

    
      8 hashes in 0.00s (max 4 threads)
      True

#### Parallel.ForEachAsync — async I/O with controlled concurrency

```csharp
// Parallel.ForEachAsync — async I/O with controlled concurrency

// === Parallel.ForEachAsync (max 3 concurrent) ===
var tables = Enumerable.Range(0, 10).Select(i => $"table_{i:D2}").ToArray();
var fetchedTables = new System.Collections.Concurrent.ConcurrentBag<string>();

var sw = Stopwatch.StartNew();
await Parallel.ForEachAsync(
    tables,
    new ParallelOptions { MaxDegreeOfParallelism = 3 },
    async (table, ct) =>
    {
        await Task.Delay(Random.Shared.Next(100, 500), ct);  // simulate API call
        fetchedTables.Add($"{table}: {Random.Shared.Next(100, 10000)} rows");
    }
);
sw.Stop();
$"  Fetched {fetchedTables.Count} tables in {sw.Elapsed.TotalSeconds:F2}s"
foreach (var t in fetchedTables.Take(3))
    $"    {t}"
```

      Fetched 10 tables in 1.20s
        table_08: 1841 rows
        table_09: 6788 rows
        table_07: 2097 rows

#### PLINQ (Parallel LINQ)

```csharp
// PLINQ — parallel LINQ with AsParallel()

var rawRecords = Enumerable.Range(0, 1_000_000)
    .Select(i => $"evt_{i:D7},user_{i % 100:D3},{i * 0.01:F2}")
    .ToArray();

sw.Restart();
var parsed = rawRecords
    .AsParallel()
    .WithDegreeOfParallelism(4)
    .Where(r => !r.Contains("user_000"))
    .Select(r => { var p = r.Split(','); return new { EventId = p[0], User = p[1], Value = double.Parse(p[2]) }; })
    .Where(r => r.Value > 50.0)
    .ToArray();
sw.Stop();
$"  Parsed {rawRecords.Length:N0} -> {parsed.Length:N0} filtered in {sw.Elapsed.TotalSeconds:F2}s"
```

#### PLINQ vs sequential — speedup comparison

```csharp
// Sequential comparison to show PLINQ speedup on large data

sw.Restart();
var seqParsed = rawRecords
    .Where(r => !r.Contains("user_000"))
    .Select(r => { var p = r.Split(','); return new { EventId = p[0], User = p[1], Value = double.Parse(p[2]) }; })
    .Where(r => r.Value > 50.0)
    .ToArray();
sw.Stop();
$"  Sequential: {sw.Elapsed.TotalSeconds:F2}s  |  PLINQ was faster on large data"
```

    
      Parsed 1'000'000 records -> 985'050 filtered in 0.10s
      { EventId = evt_0005001, User = user_001, Value = 50.01 }
      0.16s  |  PLINQ was faster on large data

## Threading and Concurrency

> [!info] Threading primitives
>
> - `new Thread(method)` — creates an OS thread
> - `.Start()` — begins execution; `.Join()` — blocks until complete
> - `lock` — mutual exclusion (sugar for `Monitor.Enter`/`Exit`)
> - `Interlocked` — atomic operations without locks (`Increment`, `Add`, `Exchange`)
> - `IsBackground = true` — daemon thread that dies when main exits

> [!tip] In modern C#, prefer Task/async
>
> In modern C#, prefer `Task`/`async` over raw threads. Use threads only when you need explicit control (priority, apartment state, dedicated long-running work).

> [!warning] Threading pitfalls
>
> - Creating threads for short work — use `Task.Run` (thread pool) instead
> - Not joining threads — orphaned threads may prevent shutdown
> - Shared mutable state without synchronization — race conditions

> [!success] Use the thread pool for short-lived work
>
> Use `Task.Run` for short CPU-bound work — it draws from the managed thread pool, avoiding OS thread creation overhead. Always `Join` or `await` threads you start. Mark background threads with `IsBackground = true` so they don't prevent process shutdown.

#### Thread class — basic thread creation and Join

```csharp
// Basic threading — create, start, join, and collect results

#nullable enable
// Basic threading
// === Basic Threads ===
var threadResults = new System.Collections.Concurrent.ConcurrentBag<string>();

void WorkerMethod(object? state)
{
    var (name, delay) = ((string, int))state!;
    $"  [{Thread.CurrentThread.ManagedThreadId}] {name} starting"
    Thread.Sleep(delay);  // BLOCKING sleep (unlike Task.Delay)
    threadResults.Add($"{name} done");
    $"  [{Thread.CurrentThread.ManagedThreadId}] {name} finished"
}

var threads = new List<Thread>();
foreach (var (name, delay) in new[] { ("fetch_users", 300), ("fetch_events", 500), ("fetch_products", 200) })
{
    var t = new Thread(WorkerMethod) { Name = $"T-{name}" };
    threads.Add(t);
    t.Start((name, delay));  // pass state to the thread
}

// Join — wait for all threads to finish
foreach (var t in threads)
    t.Join();

$"  Results: [{string.Join(", ", threadResults)}]"
```

      [104] fetch_users starting
      [102] fetch_events starting
      [101] fetch_products starting
      [101] fetch_products finished
      [104] fetch_users finished
      [102] fetch_events finished
      [fetch_events done, fetch_users done, fetch_products done]

> [!danger] ++ and += are not atomic
>
> `++` and `+=` are not atomic — they cause race conditions without synchronization
> `counter++` in C# compiles to read-increment-write which can interleave across threads. Use `lock`, `Interlocked.Increment`, or `ConcurrentDictionary` for thread-safe mutation. Unlike Python's GIL, C# has true parallelism, making races more frequent and harder to reproduce.

> [!success] Use Interlocked or lock for shared counters
>
> Replace `counter++` with `Interlocked.Increment(ref counter)` for simple integer counters — it's lock-free and faster than `lock`. For compound operations or non-integer types, use `lock(obj) { ... }`. For aggregation over keys, use `ConcurrentDictionary.AddOrUpdate`.

#### Threading race condition demo (WITHOUT lock)

```csharp
// Race condition demo — without lock shows data corruption

var unsafeCounter = 0;

void IncrementUnsafe()
{
    for (int i = 0; i < 100_000; i++)
        unsafeCounter++;  // NOT atomic: read, add, write — threads can interleave
}

// === Race Condition (no lock) ===
unsafeCounter = 0;
var unsafeThreads = Enumerable.Range(0, 4)
    .Select(_ => new Thread(IncrementUnsafe))
    .ToArray();
foreach (var t in unsafeThreads) t.Start();
foreach (var t in unsafeThreads) t.Join();
$"  Expected: 400,000"
$"  Got:      {unsafeCounter:N0}  {(unsafeCounter != 400_000 ? "(WRONG — race condition!)" : "(got lucky this time)")}"
```

      400,000
      398'731  (WRONG — race condition!)

#### lock statement — fix race condition with mutual exclusion

```csharp
// Fixed with lock — mutual exclusion prevents lost updates

var safeCounter = 0;
var lockObj = new object();  // lock requires a reference type object

void IncrementSafe()
{
    for (int i = 0; i < 100_000; i++)
    {
        lock (lockObj)  // only one thread can enter this block at a time
        {
            safeCounter++;
        }
    }
}

safeCounter = 0;
var safeThreads = Enumerable.Range(0, 4)
    .Select(_ => new Thread(IncrementSafe))
    .ToArray();
foreach (var t in safeThreads) t.Start();
foreach (var t in safeThreads) t.Join();
$"  Expected: 400,000"
$"  Got:      {safeCounter:N0}  (correct — lock prevents race)"
```

    
      400,000
      400'000  (correct — lock prevents race)

#### Interlocked — lock-free atomic operations

```csharp
// Interlocked — lock-free atomic operations using CPU instructions

var atomicCounter = 0;

void IncrementAtomic()
{
    for (int i = 0; i < 100_000; i++)
        Interlocked.Increment(ref atomicCounter);  // atomic: guaranteed correct
}

atomicCounter = 0;
var atomicThreads = Enumerable.Range(0, 4)
    .Select(_ => new Thread(IncrementAtomic))
    .ToArray();
foreach (var t in atomicThreads) t.Start();
foreach (var t in atomicThreads) t.Join();
$"  Expected: 400,000"
$"  Got:      {atomicCounter:N0}  (correct — atomic operation)"
```

    
      400,000
      400'000  (correct — atomic operation)

#### ConcurrentDictionary — thread-safe aggregation

`ConcurrentDictionary` is a dictionary that multiple threads can read and write simultaneously without explicit locking. It uses fine-grained locking internally (lock striping), so concurrent writes to different keys don't block each other. Use `AddOrUpdate` and `GetOrAdd` for atomic read-modify-write operations.

> [!danger] AddOrUpdate is not atomic end-to-end
> The update delegate in `AddOrUpdate` may be called multiple times if there's contention — it's optimistic, not locked. Don't put side effects (database writes, API calls) inside the delegate. Only use it for pure computations.

> [!success] Keep delegates pure
>
> Ensure the `AddOrUpdate` factory and update delegates are pure functions — no I/O, no side effects, no external calls. For operations that must be atomic with side effects, use `lock` or a dedicated synchronization primitive instead.

```csharp
// ConcurrentDictionary — thread-safe aggregation with AddOrUpdate

// === ConcurrentDictionary (thread-safe aggregation) ===
var eventCounts = new ConcurrentDictionary<string, int>();
var eventTypes = new[] { "click", "view", "purchase", "signup" };

Parallel.For(0, 100_000, i =>
{
    var evtType = eventTypes[i % eventTypes.Length];
    // AddOrUpdate: if key exists, update; if not, add.
    // Both the add and update are atomic.
    eventCounts.AddOrUpdate(evtType, 1, (key, oldVal) => oldVal + 1);
});

foreach (var kvp in eventCounts.OrderBy(k => k.Key))
    $"    {kvp.Key}: {kvp.Value:N0}"
eventCounts.Values.Sum():N0  // Total
```

      Event counts (100K events across 4 types):
        click: 25'000
        purchase: 25'000
        signup: 25'000
        view: 25'000
      100'000

#### BlockingCollection — thread concurrency producer-consumer

`BlockingCollection` is the synchronous (thread-based) equivalent of Channel. Producers call `Add()` (blocks if bounded and full), consumers call `Take()` (blocks if empty). Use `GetConsumingEnumerable()` for a foreach-friendly consumer loop. Prefer `Channel<T>` in async code; use `BlockingCollection` only when working with thread-based (non-async) consumers.

```csharp
// BlockingCollection — producer-consumer with blocking threads

var collection = new BlockingCollection<string>(boundedCapacity: 5);
var processed = new ConcurrentBag<string>();
var sw = Stopwatch.StartNew();

// Producer thread
var producerThread = new Thread(() =>
{
    for (int i = 0; i < 20; i++)
    {
        collection.Add($"evt_{i:D3}");  // blocks if full
        Thread.Sleep(20);
    }
    collection.CompleteAdding();  // signal: no more items
});

// Consumer threads
void Consume(string name)
{
    // GetConsumingEnumerable blocks on each iteration until an item is available
    // or CompleteAdding() is called.
    foreach (var item in collection.GetConsumingEnumerable())
    {
        Thread.Sleep(Random.Shared.Next(10, 50));
        processed.Add($"{name}: {item}");
    }
}

var consumers = Enumerable.Range(1, 3)
    .Select(i => new Thread(() => Consume($"worker-{i}")))
    .ToArray();

producerThread.Start();
foreach (var c in consumers) c.Start();
producerThread.Join();
foreach (var c in consumers) c.Join();
sw.Stop();

$"  Processed {processed.Count} events in {sw.Elapsed.TotalSeconds:F2}s"
// Count per worker
foreach (var g in processed.GroupBy(p => p.Split(":")[0]).OrderBy(g => g.Key))
    $"    {g.Key}: {g.Count()} events"
```

    
      Processed 20 events in 0.63s
        worker-1: 7 events
        worker-2: 7 events
        worker-3: 6 events

## Advanced Synchronization

#### ReaderWriterLockSlim

> [!info] ReaderWriterLockSlim
>
> - `EnterReadLock` — allows multiple concurrent readers
> - `EnterWriteLock` — gives exclusive access (blocks readers and other writers)
> - `UpgradeableReadLock` — promotes a reader to writer without releasing
> - Optimized for read-heavy workloads; for write-heavy, a simple `lock` is better

> [!warning] Always release in finally
>
> Always release in `finally` — deadlock on exception otherwise.

> [!success] Wrap lock operations in try/finally
>
> Always pair `EnterReadLock`/`EnterWriteLock` with `ExitReadLock`/`ExitWriteLock` inside a `try/finally` block. This guarantees the lock is released even if an exception is thrown, preventing permanent deadlock for all waiting threads.

```csharp
// ReaderWriterLockSlim — allows many concurrent readers OR one exclusive writer
//
// WHAT: a synchronization primitive optimized for read-heavy workloads.
//   EnterReadLock(): multiple threads can hold read locks simultaneously.
//   EnterWriteLock(): exclusive — blocks ALL readers AND other writers.
//   The "Slim" variant is lighter than ReaderWriterLock (no OS kernel object).
//
// WHY: a plain lock blocks ALL threads (readers AND writers) even when multiple
//   threads just want to read. ReaderWriterLockSlim lets N readers proceed in parallel.
//   Example: 100 threads reading a config cache, 1 thread updating it every 5 minutes.
//   With lock: 100 threads serialize. With RWLock: 100 readers run in parallel.
//
// WHEN TO USE: in-memory caches, lookup tables, config stores, shared dictionaries
//   where reads vastly outnumber writes (>90% reads)
// ANTI-PATTERNS:
//   - Don't use for write-heavy workloads — RWLock overhead > plain lock when writes are frequent
//   - Don't hold the lock across await — RWLockSlim is thread-affine (not async-safe)
//   - Always use try/finally to ensure ExitReadLock/ExitWriteLock runs
var rwLock = new ReaderWriterLockSlim();
var cache = new Dictionary<string, string>
{
    ["ETL_001"] = "success",
    ["ETL_002"] = "running",
};

// Multiple readers — all enter simultaneously, no blocking between them
var readTasks = Enumerable.Range(0, 5).Select(i => Task.Run(() =>
{
    rwLock.EnterReadLock();   // multiple threads can hold this at the same time
    try
    {
        var status = cache.GetValueOrDefault("ETL_001", "unknown");
        $"  Reader {i}: ETL_001 = {status}"
    }
    finally { rwLock.ExitReadLock(); } // ALWAYS release in finally
}));

// Writer — gets exclusive access, blocks all readers and other writers
var writeTask = Task.Run(() =>
{
    rwLock.EnterWriteLock();  // waits until ALL readers exit, then blocks new readers
    try
    {
        cache["ETL_002"] = "completed";
        //   Writer: updated ETL_002 → completed
    }
    finally { rwLock.ExitWriteLock(); }
});

await Task.WhenAll(readTasks.Append(writeTask));
$"  Final cache: {string.Join(", ", cache.Select(kv => $"{kv.Key}={kv.Value}"))}"
```

      updated ETL_002 → completed
      ETL_001 = success
      ETL_001 = success
      ETL_001 = success
      ETL_001 = success
      ETL_001 = success
      ETL_001=success, ETL_002=completed

#### ManualResetEventSlim and CountdownEvent

```csharp
// ManualResetEventSlim and CountdownEvent — thread signaling

var gate = new ManualResetEventSlim(false); // starts closed — threads will block

var workers = Enumerable.Range(0, 3).Select(i => Task.Run(() =>
{
    $"  Worker {i}: waiting for signal..."
    gate.Wait();  // blocks until gate.Set() is called — efficient OS-level wait
    $"  Worker {i}: proceeding!"
})).ToArray();

await Task.Delay(200);  // simulate initialization work
//   Main: initialization done, signaling workers
gate.Set();  // opens the gate — ALL 3 workers unblock simultaneously
await Task.WhenAll(workers);

// CountdownEvent — wait until N signals received
//
// WHAT: initialized with count N. Each Signal() decrements the count.
//   Wait() blocks until count reaches 0. Like a barrier countdown.
//
// WHY: main thread needs to wait for N workers to finish setup before proceeding.
//   Without CountdownEvent: track a shared counter with Interlocked + busy wait.
//   With CountdownEvent: each worker signals, main waits — clean and efficient.
//
// WHEN TO USE: "wait for all N workers to report ready", phased initialization
var countdown = new CountdownEvent(3);  // wait for 3 signals

var setupTasks = Enumerable.Range(0, 3).Select(i => Task.Run(async () =>
{
    await Task.Delay(50 * (i + 1));  // simulate setup work
    $"  Worker {i}: setup done"
    countdown.Signal();  // decrement count by 1
})).ToArray();

countdown.Wait();  // blocks until count reaches 0 (all 3 workers signaled)
//   Main: all 3 workers finished setup, proceeding
```

      waiting for signal...
      waiting for signal...
      waiting for signal...
      initialization done, signaling workers
      proceeding!
      proceeding!
      proceeding!
    
      setup done
      setup done
      setup done
      all 3 workers finished setup, proceeding

#### Barrier — phased synchronization

A Barrier synchronizes multiple threads at a checkpoint: all participants must arrive at the barrier before any can proceed to the next phase. This is useful when parallel tasks must complete a step before the next step can begin — like a data pipeline where all partition loads must finish before the merge step starts. Each call to `SignalAndWait()` blocks until all participants have signaled.

```csharp
// Barrier — phased synchronization where all participants reach a checkpoint

var barrier = new Barrier(
    3, // 3 participants
    b => Console.WriteLine($"  === All workers reached phase {b.CurrentPhaseNumber} ===")
);

var phasedWorkers = Enumerable.Range(0, 3).Select(i => Task.Run(async () =>
{
    // Phase 0: Extract — each worker does its own extract work
    await Task.Delay(50 * (i + 1)); // worker 0 finishes first, worker 2 last
    $"  Worker {i}: extract done"
    barrier.SignalAndWait(); // blocks until all 3 call SignalAndWait

    // Phase 1: Transform — no one gets here until ALL finished extract
    await Task.Delay(30 * (i + 1));
    $"  Worker {i}: transform done"
    barrier.SignalAndWait(); // blocks until all 3 finish transform

    $"  Worker {i}: load done"
})).ToArray();

await Task.WhenAll(phasedWorkers);
```

      extract done
      extract done
      extract done
      transform done
      transform done
      transform done
      load done
      load done
      load done

#### PeriodicTimer — modern scheduled polling

`PeriodicTimer` (introduced in .NET 6) provides async-friendly periodic ticking without thread blocking. Unlike `System.Timers.Timer` (callback-based, easy to overlap) or `Task.Delay` in a loop (drift accumulation), `PeriodicTimer` provides a clean `WaitForNextTickAsync()` that respects cancellation tokens and doesn't fire overlapping callbacks.

```csharp
// PeriodicTimer — modern .NET 6+ async-friendly scheduled polling

var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(100)); // tick every 100ms
var timerCts = new CancellationTokenSource(350); // auto-cancel after 350ms
int ticks = 0;

try
{
    // WaitForNextTickAsync returns true on each tick, respects cancellation
    while (await timer.WaitForNextTickAsync(timerCts.Token))
    {
        ticks++;
        $"  Tick {ticks} at {DateTime.Now:HH:mm:ss.fff}"
        // In production: await FetchLatestDataAsync(); or await CheckQueueDepthAsync();
    }
}
catch (OperationCanceledException) { } // expected — timer stopped by cancellation

$"  Timer stopped after {ticks} ticks"
timer.Dispose(); // release the timer
```

      Tick 1 at 06:36:48.456
      Tick 2 at 06:36:48.549
      Tick 3 at 06:36:48.642
      Timer stopped after 3 ticks

#### Choosing the right concurrency tool
