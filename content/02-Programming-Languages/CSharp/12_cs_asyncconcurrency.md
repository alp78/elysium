---
type: reference
category: programming-languages
technology: [csharp, dotnet]
tags: [csharp]
aliases: [async await, concurrency, parallelism, tasks, threads, asyncio, Task]
keywords: [async, await, Task, CancellationToken, Parallel, Thread, SemaphoreSlim, Channel, IAsyncEnumerable]
description: "C# async and concurrency reference with executable examples and cell outputs — covers async/await, Task, parallel programming, CancellationToken, and Channels. See [[12_py_asyncconcurrency]] for the Python equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[12_py_asyncconcurrency]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 12. Async & Concurrency - C#

```csharp
// Imports used throughout this notebook
using System.Diagnostics;
using System.Threading;
using System.Threading.Channels;
using System.Net.Http;
using System.Collections.Concurrent;
using System.Security.Cryptography;
```

## Async and Await

#### Async and await basics

```csharp
// Async & Await — the Task-based Asynchronous Pattern (TAP)
//
// KEY CONCEPTS:
// - async: marks a method as asynchronous. Returns Task or Task<T>.
// - await: pauses the method until the awaited task completes.
//   The thread is NOT blocked — it's released to the thread pool to do other work.
// - Task<T>: an async operation that returns a value of type T.
//   The thread pool manages threads automatically.
//
// WHY async matters for Data Engineering:
// - API calls (BigQuery, GCS, REST) are I/O-bound — async lets you overlap them.
// - A pipeline that fetches 10 APIs sequentially in 10s can do it in ~1s with async.
```

#### Basic async method

```csharp
// Basic async method
async Task<Dictionary<string, object>> FetchDataAsync(string source, double delaySeconds)
{
    Console.WriteLine($"  [{DateTime.Now:HH:mm:ss}] Starting fetch: {source}");
    await Task.Delay(TimeSpan.FromSeconds(delaySeconds));  // non-blocking delay
    Console.WriteLine($"  [{DateTime.Now:HH:mm:ss}] Completed fetch: {source}");
    return new Dictionary<string, object>
    {
        ["source"] = source,
        ["rows"] = (int)(delaySeconds * 1000)
    };
}
```

#### Sequential vs concurrent

```csharp
// Sequential — each fetch waits for the previous one
Console.WriteLine("=== Sequential (one after another) ===");
var sw = Stopwatch.StartNew();
var r1 = await FetchDataAsync("users_api", 1.0);
var r2 = await FetchDataAsync("events_api", 0.8);
var r3 = await FetchDataAsync("products_api", 0.5);
sw.Stop();
Console.WriteLine($"  Total: {sw.Elapsed.TotalSeconds:F2}s (sum of all delays)");
```

    === Sequential (one after another) ===
      [06:36:58] Starting fetch: users_api
      [06:36:59] Completed fetch: users_api
      [06:36:59] Starting fetch: events_api
      [06:37:00] Completed fetch: events_api
      [06:37:00] Starting fetch: products_api
      [06:37:00] Completed fetch: products_api
      Total: 2.32s (sum of all delays)

```csharp
// Concurrent — all fetches run at the same time
Console.WriteLine("\n=== Concurrent (Task.WhenAll) ===");
sw.Restart();
var t1 = FetchDataAsync("users_api", 1.0);      // start task (don't await yet)
var t2 = FetchDataAsync("events_api", 0.8);      // start task
var t3 = FetchDataAsync("products_api", 0.5);    // start task
var results = await Task.WhenAll(t1, t2, t3);     // await ALL at once
sw.Stop();
Console.WriteLine($"  Total: {sw.Elapsed.TotalSeconds:F2}s (max of all delays)");
Console.WriteLine($"  Results: {results.Length} dictionaries");
```

    
    === Concurrent (Task.WhenAll) ===
      [06:37:03] Starting fetch: users_api
      [06:37:03] Starting fetch: events_api
      [06:37:03] Starting fetch: products_api
      [06:37:03] Completed fetch: products_api
      [06:37:04] Completed fetch: events_api
      [06:37:04] Completed fetch: users_api
      Total: 1.01s (max of all delays)
      Results: 3 dictionaries

<h4><code style="font-size:0.75em">Task.WhenAll</code> and <code style="font-size:0.75em">Task.WhenAny</code></h4>

```csharp
// Task.WhenAll vs Task.WhenAny — waiting strategies
//
// Task.WhenAll(tasks): wait until ALL complete. Returns all results.
// Task.WhenAny(tasks): wait until the FIRST one completes. Returns that task.
//
// Error handling:
// - Task.WhenAll unwraps AggregateException in await — only first inner exception surfaces.
// - To get ALL errors, store the Task and check .Exception (see 08_ErrorHandling).


async Task<string> FetchTableAsync(string name, double delay, bool fail = false)
{
    await Task.Delay(TimeSpan.FromSeconds(delay));
    if (fail) throw new InvalidOperationException($"Fetch failed: {name}");
    return $"{name}: {(int)(delay * 1000)} rows";
}
```

#### Task.WhenAll with error handling

```csharp
// Task.WhenAll with error handling
Console.WriteLine("=== Task.WhenAll (error handling) ===");
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
        Console.WriteLine($"  ERROR: {ex.Message}");
}
```

    === Task.WhenAll (error handling) ===
      ERROR: Fetch failed: users

#### Task.WhenAny — first to complete wins

```csharp
// Scenario: query multiple replicas, use the fastest response.

Console.WriteLine("\n=== Task.WhenAny (first wins) ===");
var tasks = new[]
{
    FetchTableAsync("replica-us", 0.5),
    FetchTableAsync("replica-eu", 0.3),
    FetchTableAsync("replica-asia", 0.8),
};

var fastest = await Task.WhenAny(tasks);
Console.WriteLine($"  First to finish: {await fastest}");
// Note: the other tasks are still running — they don't cancel automatically.
// Use CancellationToken to cancel the rest (see next cell).
```

    
    === Task.WhenAny (first wins) ===
      First to finish: replica-eu: 300 rows

<h4><code style="font-size:0.75em">CancellationToken</code></h4>

```csharp
// Cancellation — CancellationToken
//
// CancellationTokenSource: creates a token you can cancel.
// CancellationToken: passed to async methods so they can check for cancellation.
// When cancelled, the method throws OperationCanceledException.
//
// Data Engineering scenario: cancel a long BigQuery export if it takes > 5s.


async Task<string> LongRunningExportAsync(string table, CancellationToken ct)
{
    Console.WriteLine($"  Starting export: {table}");
    for (int i = 0; i < 10; i++)
    {
        ct.ThrowIfCancellationRequested();  // check if cancelled
        await Task.Delay(500, ct);           // also accepts token (throws if cancelled)
        Console.WriteLine($"  {table}: chunk {i + 1}/10");
    }
    return $"{table}: export complete";
}
```

#### Cancel after timeout

```csharp
// Cancel after timeout
Console.WriteLine("=== CancellationToken (timeout) ===");
// CancelAfter: automatically cancel after specified time
var cts = new CancellationTokenSource();
cts.CancelAfter(TimeSpan.FromSeconds(2));  // auto-cancel after 2s

try
{
    var result = await LongRunningExportAsync("huge_events", cts.Token);
    Console.WriteLine($"  {result}");
}
catch (OperationCanceledException)
{
    Console.WriteLine("  Export cancelled after 2s timeout");
}
```

    === CancellationToken (timeout) ===
      Starting export: huge_events
      huge_events: chunk 1/10
      huge_events: chunk 2/10
      huge_events: chunk 3/10
      Export cancelled after 2s timeout

#### Manual cancellation

```csharp
// Manual cancellation
Console.WriteLine("\n=== Manual cancellation ===");
var cts2 = new CancellationTokenSource();

// Start the export
var exportTask = LongRunningExportAsync("daily_clicks", cts2.Token);

// Cancel after 1.5s from a separate task
_ = Task.Run(async () =>
{
    await Task.Delay(1500);
    Console.WriteLine("  [Supervisor] Cancelling export...");
    cts2.Cancel();
});

try
{
    await exportTask;
}
catch (OperationCanceledException)
{
    Console.WriteLine("  Export was manually cancelled");
}
```

    
    === Manual cancellation ===
      Starting export: daily_clicks
      daily_clicks: chunk 1/10
      daily_clicks: chunk 2/10
      [Supervisor] Cancelling export...
      Export was manually cancelled

#### Real-world async patterns

```csharp
// Async patterns for Data Engineering
//
// 1. SemaphoreSlim: limit concurrent requests (don't overwhelm an API).
// 2. Retry with backoff: retry failed tasks with exponential delay.
```

#### SemaphoreSlim — rate limiting

```csharp
// Scenario: API allows max 3 concurrent requests.

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

Console.WriteLine("=== SemaphoreSlim (max 3 concurrent) ===");
var sem = new SemaphoreSlim(3);  // max 3 concurrent
var sw = Stopwatch.StartNew();
var tasks = Enumerable.Range(0, 10)
    .Select(i => FetchWithLimitAsync(sem, $"https://api.example.com/page/{i}"))
    .ToArray();
var results = await Task.WhenAll(tasks);
sw.Stop();
Console.WriteLine($"  Fetched {results.Length} pages in {sw.Elapsed.TotalSeconds:F2}s");
foreach (var r in results.Take(3))
    Console.WriteLine($"    {r}");
Console.WriteLine($"    ... ({results.Length - 3} more)");
```

    === SemaphoreSlim (max 3 concurrent) ===
      Fetched 10 pages in 1.33s
        https://api.example.com/page/0 (175ms)
        https://api.example.com/page/1 (397ms)
        https://api.example.com/page/2 (491ms)
        ... (7 more)

#### Retry with exponential backoff

```csharp
// Retry with exponential backoff
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
            Console.WriteLine($"  Attempt {attempt + 1} failed: {ex.Message}. Retrying in {delay}ms...");
            await Task.Delay(delay);
        }
    }
    throw new InvalidOperationException("Unreachable");
}

Console.WriteLine("\n=== Retry with Exponential Backoff ===");
attemptCount = 0;
var apiResult = await RetryWithBackoffAsync(() => FlakyApiAsync("/data/events"));
Console.WriteLine($"  Success on attempt {attemptCount}: {apiResult}");
```

    
    === Retry with Exponential Backoff ===
      Attempt 1 failed: Connection refused (attempt 1). Retrying in 100ms...
      Attempt 2 failed: Connection refused (attempt 2). Retrying in 200ms...
      Success on attempt 3: /data/events: ok

#### Channel<T> — async producer-consumer

```csharp
// BoundedChannel: fixed capacity (producer waits when full).
// UnboundedChannel: unlimited capacity (producer never waits).

Console.WriteLine("\n=== Channel<T> (async producer-consumer) ===");
var channel = Channel.CreateBounded<Dictionary<string, string>>(5);  // max 5 items buffered
var processedCount = 0;

// Producer: write events to channel
var producerTask = Task.Run(async () =>
{
    var types = new[] { "click", "view", "purchase" };
    for (int i = 0; i < 12; i++)
    {
        var evt = new Dictionary<string, string>
        {
            ["id"] = $"evt_{i:D3}",
            ["type"] = types[Random.Shared.Next(types.Length)]
        };
        await channel.Writer.WriteAsync(evt);
        await Task.Delay(50);  // simulate arrival rate
    }
    channel.Writer.Complete();  // signal: no more items
});

// Consumer: read events from channel
async Task ConsumeAsync(string workerName, ChannelReader<Dictionary<string, string>> reader)
{
    await foreach (var evt in reader.ReadAllAsync())  // async iteration!
    {
        await Task.Delay(Random.Shared.Next(20, 100));  // simulate processing
        Interlocked.Increment(ref processedCount);
    }
}

// Start 3 consumers
sw.Restart();
await Task.WhenAll(
    producerTask,
    ConsumeAsync("worker-1", channel.Reader),
    ConsumeAsync("worker-2", channel.Reader),
    ConsumeAsync("worker-3", channel.Reader)
);
sw.Stop();
Console.WriteLine($"  Processed {processedCount} events in {sw.Elapsed.TotalSeconds:F2}s with 3 workers");
```

    
    === Channel<T> (async producer-consumer) ===
      Processed 12 events in 0.78s with 3 workers

<h4><code style="font-size:0.75em">IAsyncEnumerable&lt;T&gt;</code> — async streaming with yield</h4>

```csharp
// IAsyncEnumerable<T> — async streaming with yield return
//
// WHAT: an async version of IEnumerable<T>. The method yields items one at a time
//   using "yield return" inside an async method. The consumer pulls items with "await foreach".
//   Each yield pauses the producer until the consumer calls MoveNextAsync().
//
// WHY: process data as it arrives without buffering everything in memory.
//   Paginated API: fetch page 1 → yield items → fetch page 2 → yield items → ...
//   Only one page is in memory at a time, regardless of total dataset size.
//
// WHEN TO USE: paginated REST APIs, streaming DB queries, reading large files line by line
// ANTI-PATTERNS:
//   - Don't call .ToList() on the stream unless you need all items — defeats streaming
//   - Don't do heavy work inside the producer — keep it to fetch + yield
//   - Don't forget that yield return suspends the method — local variables survive across yields

// Simulate a paginated API that returns pages of data
async IAsyncEnumerable<string> FetchPagesAsync(int totalPages, int itemsPerPage)
{
    for (int page = 1; page <= totalPages; page++)
    {
        await Task.Delay(100); // simulate network latency per page
        Console.WriteLine($"  Fetching page {page}...");
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
    Console.WriteLine($"    Received: {item}");
}
Console.WriteLine($"  Total: {count} items in {sw.ElapsedMilliseconds}ms");
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
      Total: 6 items in 326ms

<h4><code style="font-size:0.75em">IAsyncEnumerable</code> with cancellation and LINQ</h4>

```csharp
// IAsyncEnumerable with CancellationToken — gracefully stop an infinite or long stream
//
// WHAT: [EnumeratorCancellation] attribute wires the token from .WithCancellation(ct)
//   on the consumer side to the ct parameter on the producer side automatically.
//   When the token is cancelled, the next await inside the producer throws OperationCanceledException.
//
// WHY: infinite generators (real-time feeds, polling loops) need a way to stop cleanly.
//   Without cancellation, await foreach runs forever. With it, the consumer can say "stop after 5s".
//
// WHEN TO USE: long-running streams, polling APIs with timeout, user-cancellable operations
// ANTI-PATTERNS:
//   - Don't forget [EnumeratorCancellation] — .WithCancellation() silently does nothing without it
//   - Don't catch OperationCanceledException inside the producer — let it propagate to the consumer
using System.Runtime.CompilerServices;

// Infinite generator — yields 0, 1, 2, ... forever until cancelled
async IAsyncEnumerable<int> GenerateNumbersAsync(
    [EnumeratorCancellation] CancellationToken ct = default)
{
    int n = 0;
    while (!ct.IsCancellationRequested)
    {
        await Task.Delay(50, ct); // throws OperationCanceledException when cancelled
        yield return n++;
    }
}

// Cancel after 200ms — consumer catches the cancellation cleanly
var cts = new CancellationTokenSource(200);
var collected = new List<int>();
try
{
    await foreach (var n in GenerateNumbersAsync().WithCancellation(cts.Token))
        collected.Add(n);
}
catch (OperationCanceledException) { } // expected — not an error
Console.WriteLine($"  Collected {collected.Count} items before cancellation: [{string.Join(", ", collected)}]");

// Early exit with break — stops fetching further pages
Console.WriteLine("\n  First 5 from paginated source:");
count = 0;
await foreach (var item in FetchPagesAsync(10, 3))
{
    Console.WriteLine($"    {item}");
    count++;
    if (count >= 5) break; // break disposes the enumerator — producer stops cleanly
}
```

      Collected 3 items before cancellation: [0, 1, 2]
    
      First 5 from paginated source:
      Fetching page 1...
        page1_item1
        page1_item2
        page1_item3
      Fetching page 2...
        page2_item1
        page2_item2

## Tasks and Parallelism

<h4><code style="font-size:0.75em">Task.Run</code> and <code style="font-size:0.75em">Parallel</code></h4>

```csharp
// Task.Run & Parallel — CPU-bound parallelism
//
// KEY CONCEPTS:
// - Task.Run(): schedules work on the thread pool. Returns a Task.
//   Use for CPU-bound work you want off the current thread.
// - Parallel.ForEach(): partition a collection and process chunks on multiple threads.
//   Automatically uses the thread pool. Blocks until all done.
// - Parallel.ForEachAsync() (.NET 6+): async version of Parallel.ForEach.
// - C# has NO GIL — multiple threads can execute code truly in parallel.
```

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
Console.WriteLine("=== Sequential (single thread) ===");
var sw = Stopwatch.StartNew();
var seqHashes = payloads.Select(ComputeHash).ToArray();
var seqTime = sw.Elapsed;
Console.WriteLine($"  {seqHashes.Length} hashes in {seqTime.TotalSeconds:F2}s");

// Parallel with Task.Run
Console.WriteLine($"\n=== Task.Run (thread pool, {Environment.ProcessorCount} cores) ===");
sw.Restart();
var parallelTasks = payloads.Select(p => Task.Run(() => ComputeHash(p))).ToArray();
var parHashes = await Task.WhenAll(parallelTasks);
var parTime = sw.Elapsed;
Console.WriteLine($"  {parHashes.Length} hashes in {parTime.TotalSeconds:F2}s");
Console.WriteLine($"  Speedup: {seqTime / parTime:F1}x");
Console.WriteLine($"  Results match: {seqHashes.SequenceEqual(parHashes)}");
```

    === Sequential (single thread) ===
      8 hashes in 0.00s
    
    === Task.Run (thread pool, 16 cores) ===
      8 hashes in 0.00s
      Speedup: 0.5x
      Results match: True

#### Parallel.ForEach — partition and process

```csharp
// Blocks the calling thread until all items are processed.

Console.WriteLine("\n=== Parallel.ForEach ===");
var hashResults = new string[payloads.Length];
sw.Restart();
Parallel.ForEach(
    Enumerable.Range(0, payloads.Length),
    new ParallelOptions { MaxDegreeOfParallelism = 4 },  // limit to 4 threads
    i => hashResults[i] = ComputeHash(payloads[i])
);
sw.Stop();
Console.WriteLine($"  {hashResults.Length} hashes in {sw.Elapsed.TotalSeconds:F2}s (max 4 threads)");
Console.WriteLine($"  Results match: {seqHashes.SequenceEqual(hashResults)}");
```

    
    === Parallel.ForEach ===
      8 hashes in 0.00s (max 4 threads)
      Results match: True

<h4><code style="font-size:0.75em">Parallel.ForEachAsync</code> and PLINQ</h4>

```csharp
// Parallel.ForEachAsync & PLINQ
//
// Parallel.ForEachAsync (.NET 6+): process items concurrently with async lambdas.
//   Great for I/O-bound work with controlled parallelism.
//
// PLINQ (Parallel LINQ): add .AsParallel() to a LINQ query for multi-core execution.
```

#### Parallel.ForEachAsync — async I/O with controlled concurrency

```csharp
// Scenario: fetch metadata for 10 tables, max 3 concurrent.

Console.WriteLine("=== Parallel.ForEachAsync (max 3 concurrent) ===");
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
Console.WriteLine($"  Fetched {fetchedTables.Count} tables in {sw.Elapsed.TotalSeconds:F2}s");
foreach (var t in fetchedTables.Take(3))
    Console.WriteLine($"    {t}");
```

    === Parallel.ForEachAsync (max 3 concurrent) ===
      Fetched 10 tables in 1.20s
        table_08: 1841 rows
        table_09: 6788 rows
        table_07: 2097 rows

#### PLINQ (Parallel LINQ)

```csharp
// .AsParallel() partitions the data and processes chunks on multiple threads.
// Order is NOT guaranteed unless you add .AsOrdered().

Console.WriteLine("\n=== PLINQ (.AsParallel()) ===");

// Data Engineering scenario: parse and validate a large batch of records.
var rawRecords = Enumerable.Range(0, 1_000_000)
    .Select(i => $"evt_{i:D7},user_{i % 100:D3},{i * 0.01:F2}")
    .ToArray();

sw.Restart();
var parsed = rawRecords
    .AsParallel()                    // enable parallel execution
    .WithDegreeOfParallelism(4)      // use 4 cores
    .Where(r => !r.Contains("user_000"))  // filter out user_000
    .Select(r =>
    {
        var parts = r.Split(',');
        return new { EventId = parts[0], User = parts[1], Value = double.Parse(parts[2]) };
    })
    .Where(r => r.Value > 50.0)      // predicate pushdown
    .ToArray();
sw.Stop();

Console.WriteLine($"  Parsed {rawRecords.Length:N0} records -> {parsed.Length:N0} filtered in {sw.Elapsed.TotalSeconds:F2}s");
Console.WriteLine($"  Sample: {parsed[0]}");

// Sequential comparison
sw.Restart();
var seqParsed = rawRecords
    .Where(r => !r.Contains("user_000"))
    .Select(r =>
    {
        var parts = r.Split(',');
        return new { EventId = parts[0], User = parts[1], Value = double.Parse(parts[2]) };
    })
    .Where(r => r.Value > 50.0)
    .ToArray();
sw.Stop();
Console.WriteLine($"  Sequential: {sw.Elapsed.TotalSeconds:F2}s  |  PLINQ was faster on large data");
```

    
    === PLINQ (.AsParallel()) ===
      Parsed 1'000'000 records -> 985'050 filtered in 0.10s
      Sample: { EventId = evt_0005001, User = user_001, Value = 50.01 }
      Sequential: 0.16s  |  PLINQ was faster on large data

## Threading and Concurrency

#### Thread basics

```csharp
// Threading — low-level thread management
//
// KEY CONCEPTS:
// - Thread: create a new OS thread manually.
// - thread.Start(): begin execution. thread.Join(): wait for it to finish.
// - lock: mutual exclusion — only one thread can enter at a time.
//   Syntactic sugar for Monitor.Enter/Monitor.Exit.
// - Interlocked: atomic operations on shared variables (no lock needed).
//   Interlocked.Increment, Interlocked.Add, Interlocked.Exchange.
// - IsBackground: daemon thread — dies when the main thread exits.
//
// NOTE: in modern C#, prefer Task/async over raw threads.
// Use threads only when you need explicit control.
```

#### Basic threading

```csharp
#nullable enable
// Basic threading
Console.WriteLine("=== Basic Threads ===");
var threadResults = new System.Collections.Concurrent.ConcurrentBag<string>();

void WorkerMethod(object? state)
{
    var (name, delay) = ((string, int))state!;
    Console.WriteLine($"  [{Thread.CurrentThread.ManagedThreadId}] {name} starting");
    Thread.Sleep(delay);  // BLOCKING sleep (unlike Task.Delay)
    threadResults.Add($"{name} done");
    Console.WriteLine($"  [{Thread.CurrentThread.ManagedThreadId}] {name} finished");
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

Console.WriteLine($"  Results: [{string.Join(", ", threadResults)}]");
```

    === Basic Threads ===
      [104] fetch_users starting
      [102] fetch_events starting
      [101] fetch_products starting
      [101] fetch_products finished
      [104] fetch_users finished
      [102] fetch_events finished
      Results: [fetch_events done, fetch_users done, fetch_products done]

<h4><code style="font-size:0.75em">lock</code> and <code style="font-size:0.75em">Interlocked</code></h4>

```csharp
// lock & Interlocked — preventing race conditions
//
// Race condition: two threads read-modify-write a shared variable simultaneously,
// causing lost updates. The lock keyword prevents this.
```

#### Race condition demo (WITHOUT lock)

```csharp
// Race condition demo (WITHOUT lock)
var unsafeCounter = 0;

void IncrementUnsafe()
{
    for (int i = 0; i < 100_000; i++)
        unsafeCounter++;  // NOT atomic: read, add, write — threads can interleave
}

Console.WriteLine("=== Race Condition (no lock) ===");
unsafeCounter = 0;
var unsafeThreads = Enumerable.Range(0, 4)
    .Select(_ => new Thread(IncrementUnsafe))
    .ToArray();
foreach (var t in unsafeThreads) t.Start();
foreach (var t in unsafeThreads) t.Join();
Console.WriteLine($"  Expected: 400,000");
Console.WriteLine($"  Got:      {unsafeCounter:N0}  {(unsafeCounter != 400_000 ? "(WRONG — race condition!)" : "(got lucky this time)")}");
```

    === Race Condition (no lock) ===
      Expected: 400,000
      Got:      398'731  (WRONG — race condition!)

#### Fixed with lock

```csharp
// Fixed with lock
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

Console.WriteLine("\n=== With lock (safe) ===");
safeCounter = 0;
var safeThreads = Enumerable.Range(0, 4)
    .Select(_ => new Thread(IncrementSafe))
    .ToArray();
foreach (var t in safeThreads) t.Start();
foreach (var t in safeThreads) t.Join();
Console.WriteLine($"  Expected: 400,000");
Console.WriteLine($"  Got:      {safeCounter:N0}  (correct — lock prevents race)");
```

    
    === With lock (safe) ===
      Expected: 400,000
      Got:      400'000  (correct — lock prevents race)

#### Interlocked — lock-free atomic operations

```csharp
// Faster than lock for simple operations (increment, add, exchange).
// Uses CPU-level atomic instructions — no context switching.

var atomicCounter = 0;

void IncrementAtomic()
{
    for (int i = 0; i < 100_000; i++)
        Interlocked.Increment(ref atomicCounter);  // atomic: guaranteed correct
}

Console.WriteLine("\n=== Interlocked (lock-free) ===");
atomicCounter = 0;
var atomicThreads = Enumerable.Range(0, 4)
    .Select(_ => new Thread(IncrementAtomic))
    .ToArray();
foreach (var t in atomicThreads) t.Start();
foreach (var t in atomicThreads) t.Join();
Console.WriteLine($"  Expected: 400,000");
Console.WriteLine($"  Got:      {atomicCounter:N0}  (correct — atomic operation)");
```

    
    === Interlocked (lock-free) ===
      Expected: 400,000
      Got:      400'000  (correct — atomic operation)

#### Concurrent collections

```csharp
// Concurrent collections — thread-safe data structures
//
// System.Collections.Concurrent provides collections designed for multi-threaded access.
// No manual locking needed — the collection handles synchronization internally.
//
// KEY TYPES:
// - ConcurrentDictionary<K,V>: thread-safe dictionary. AddOrUpdate, GetOrAdd.
// - ConcurrentBag<T>: unordered thread-safe collection. Good for collecting results.
// - ConcurrentQueue<T>: thread-safe FIFO queue. TryDequeue (never blocks).
// - BlockingCollection<T>: wraps a concurrent collection + blocks on Take() when empty.
```

#### ConcurrentDictionary — thread-safe aggregation

```csharp
// Scenario: multiple threads process events and aggregate counts by type.

Console.WriteLine("=== ConcurrentDictionary (thread-safe aggregation) ===");
var eventCounts = new ConcurrentDictionary<string, int>();
var eventTypes = new[] { "click", "view", "purchase", "signup" };

Parallel.For(0, 100_000, i =>
{
    var evtType = eventTypes[i % eventTypes.Length];
    // AddOrUpdate: if key exists, update; if not, add.
    // Both the add and update are atomic.
    eventCounts.AddOrUpdate(evtType, 1, (key, oldVal) => oldVal + 1);
});

Console.WriteLine("  Event counts (100K events across 4 types):");
foreach (var kvp in eventCounts.OrderBy(k => k.Key))
    Console.WriteLine($"    {kvp.Key}: {kvp.Value:N0}");
Console.WriteLine($"  Total: {eventCounts.Values.Sum():N0}");
```

    === ConcurrentDictionary (thread-safe aggregation) ===
      Event counts (100K events across 4 types):
        click: 25'000
        purchase: 25'000
        signup: 25'000
        view: 25'000
      Total: 100'000

#### BlockingCollection — producer-consumer with threads

```csharp
// CompleteAdding() signals consumers that no more items will come.

Console.WriteLine("\n=== BlockingCollection (producer-consumer) ===");
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

Console.WriteLine($"  Processed {processed.Count} events in {sw.Elapsed.TotalSeconds:F2}s");
// Count per worker
foreach (var g in processed.GroupBy(p => p.Split(":")[0]).OrderBy(g => g.Key))
    Console.WriteLine($"    {g.Key}: {g.Count()} events");
```

    
    === BlockingCollection (producer-consumer) ===
      Processed 20 events in 0.63s
        worker-1: 7 events
        worker-2: 7 events
        worker-3: 6 events

## Advanced Synchronization

<h4><code style="font-size:0.75em">ReaderWriterLockSlim</code></h4>

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
        Console.WriteLine($"  Reader {i}: ETL_001 = {status}");
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
        Console.WriteLine("  Writer: updated ETL_002 → completed");
    }
    finally { rwLock.ExitWriteLock(); }
});

await Task.WhenAll(readTasks.Append(writeTask));
Console.WriteLine($"  Final cache: {string.Join(", ", cache.Select(kv => $"{kv.Key}={kv.Value}"))}");
```

      Writer: updated ETL_002 → completed
      Reader 3: ETL_001 = success
      Reader 2: ETL_001 = success
      Reader 0: ETL_001 = success
      Reader 4: ETL_001 = success
      Reader 1: ETL_001 = success
      Final cache: ETL_001=success, ETL_002=completed

<h4><code style="font-size:0.75em">ManualResetEventSlim</code> and <code style="font-size:0.75em">CountdownEvent</code></h4>

```csharp
// ManualResetEventSlim — a gate that threads wait at until signaled
//
// WHAT: starts non-signaled (gate closed). Threads calling Wait() block.
//   Set() opens the gate — ALL waiting threads proceed. Gate stays open.
//   Reset() closes the gate again (manual reset — you control when it closes).
//   "Slim" = lightweight, no OS kernel object unless needed (faster for short waits).
//
// WHY: coordinate startup — workers wait for initialization to complete.
//   Without signaling: workers poll a shared flag in a loop (wastes CPU).
//   With ManualResetEvent: workers sleep efficiently until the signal arrives.
//
// WHEN TO USE: "everyone wait until X is ready", gate/barrier patterns, init coordination
// ANTI-PATTERNS:
//   - Don't forget to call Set() — waiting threads block forever
//   - Don't use for one-at-a-time signaling — use AutoResetEvent or SemaphoreSlim instead
var gate = new ManualResetEventSlim(false); // starts closed — threads will block

var workers = Enumerable.Range(0, 3).Select(i => Task.Run(() =>
{
    Console.WriteLine($"  Worker {i}: waiting for signal...");
    gate.Wait();  // blocks until gate.Set() is called — efficient OS-level wait
    Console.WriteLine($"  Worker {i}: proceeding!");
})).ToArray();

await Task.Delay(200);  // simulate initialization work
Console.WriteLine("  Main: initialization done, signaling workers");
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
Console.WriteLine("\n  CountdownEvent:");
var countdown = new CountdownEvent(3);  // wait for 3 signals

var setupTasks = Enumerable.Range(0, 3).Select(i => Task.Run(async () =>
{
    await Task.Delay(50 * (i + 1));  // simulate setup work
    Console.WriteLine($"  Worker {i}: setup done");
    countdown.Signal();  // decrement count by 1
})).ToArray();

countdown.Wait();  // blocks until count reaches 0 (all 3 workers signaled)
Console.WriteLine("  Main: all 3 workers finished setup, proceeding");
```

      Worker 0: waiting for signal...
      Worker 1: waiting for signal...
      Worker 2: waiting for signal...
      Main: initialization done, signaling workers
      Worker 2: proceeding!
      Worker 0: proceeding!
      Worker 1: proceeding!
    
      CountdownEvent:
      Worker 0: setup done
      Worker 1: setup done
      Worker 2: setup done
      Main: all 3 workers finished setup, proceeding

<h4><code style="font-size:0.75em">Barrier</code> — phased synchronization</h4>

```csharp
// Barrier — phased synchronization where all participants must reach a checkpoint
//
// WHAT: Barrier(n, postPhaseAction) creates a synchronization point for n participants.
//   SignalAndWait(): "I'm done with this phase — wait for everyone else."
//   When all n participants call SignalAndWait(), the postPhaseAction runs, then all proceed.
//   CurrentPhaseNumber increments after each phase.
//
// WHY: multi-phase ETL where all workers must finish phase 1 before any starts phase 2.
//   Without Barrier: use N CountdownEvents + manual reset — complex and error-prone.
//   With Barrier: one primitive handles multi-phase coordination automatically.
//
// WHEN TO USE: parallel simulations with time steps, multi-phase data processing,
//   any algorithm where workers must synchronize between phases
// ANTI-PATTERNS:
//   - Don't change participant count at runtime without AddParticipant/RemoveParticipant
//   - Don't mix Barrier with async/await — SignalAndWait is blocking (thread-affine)
//   - Don't use for single-phase sync — CountdownEvent is simpler
var barrier = new Barrier(
    3, // 3 participants
    b => Console.WriteLine($"  === All workers reached phase {b.CurrentPhaseNumber} ===")
);

var phasedWorkers = Enumerable.Range(0, 3).Select(i => Task.Run(async () =>
{
    // Phase 0: Extract — each worker does its own extract work
    await Task.Delay(50 * (i + 1)); // worker 0 finishes first, worker 2 last
    Console.WriteLine($"  Worker {i}: extract done");
    barrier.SignalAndWait(); // blocks until all 3 call SignalAndWait

    // Phase 1: Transform — no one gets here until ALL finished extract
    await Task.Delay(30 * (i + 1));
    Console.WriteLine($"  Worker {i}: transform done");
    barrier.SignalAndWait(); // blocks until all 3 finish transform

    Console.WriteLine($"  Worker {i}: load done");
})).ToArray();

await Task.WhenAll(phasedWorkers);
```

      Worker 0: extract done
      Worker 1: extract done
      Worker 2: extract done
      === All workers reached phase 0 ===
      Worker 0: transform done
      Worker 1: transform done
      Worker 2: transform done
      === All workers reached phase 1 ===
      Worker 2: load done
      Worker 0: load done
      Worker 1: load done

<h4><code style="font-size:0.75em">PeriodicTimer</code> — modern scheduled polling</h4>

```csharp
// PeriodicTimer — modern .NET 6+ async-friendly timer for scheduled polling
//
// WHAT: PeriodicTimer(interval) ticks at fixed intervals. WaitForNextTickAsync()
//   returns true on each tick, false if the timer is disposed. Integrates with
//   async/await natively — no callback delegates, no thread pool threads.
//
// WHY: replaces legacy System.Timers.Timer and System.Threading.Timer which use
//   callbacks on thread pool threads (risk of overlapping if tick takes > interval).
//   PeriodicTimer waits for the consumer to finish before starting the next interval,
//   so ticks never overlap. Supports CancellationToken for clean shutdown.
//
// WHEN TO USE: poll an API every N seconds, check queue depth, refresh cache,
//   heartbeat monitoring, periodic data export
// ANTI-PATTERNS:
//   - Don't use Thread.Sleep in a loop — wastes a thread; PeriodicTimer is async
//   - Don't use Task.Delay in a loop — drift accumulates; PeriodicTimer compensates for drift
//   - Don't forget to Dispose — timer keeps running otherwise
var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(100)); // tick every 100ms
var timerCts = new CancellationTokenSource(350); // auto-cancel after 350ms
int ticks = 0;

try
{
    // WaitForNextTickAsync returns true on each tick, respects cancellation
    while (await timer.WaitForNextTickAsync(timerCts.Token))
    {
        ticks++;
        Console.WriteLine($"  Tick {ticks} at {DateTime.Now:HH:mm:ss.fff}");
        // In production: await FetchLatestDataAsync(); or await CheckQueueDepthAsync();
    }
}
catch (OperationCanceledException) { } // expected — timer stopped by cancellation

Console.WriteLine($"  Timer stopped after {ticks} ticks");
timer.Dispose(); // release the timer
```

      Tick 1 at 06:36:48.456
      Tick 2 at 06:36:48.549
      Tick 3 at 06:36:48.642
      Timer stopped after 3 ticks

#### Choosing the right concurrency tool

```csharp
// Summary — choosing the right concurrency tool in C#
//
// ┌────────────────────────┬──────────────────┬────────────────────┬────────────────────────┐
// ├────────────────────────┼──────────────────┼────────────────────┼────────────────────────┤
// │ async/await          │ I/O-bound        │ Thread pool        │ asyncio                │
// │ Task.Run()           │ CPU offload       │ Thread pool        │ ThreadPoolExecutor     │
// │ Parallel.ForEach     │ CPU parallelism   │ Thread pool        │ ProcessPoolExecutor    │
// │ Parallel.ForEachAsync│ I/O + throttle    │ Async + pool       │ Semaphore + gather     │
// │ PLINQ                │ Data transforms   │ Thread pool        │ multiprocessing.map    │
// │ Channel<T>           │ Async messaging   │ Async producer/    │ asyncio.Queue          │
// │                      │                  │ consumer           │                        │
// │ Thread + lock        │ Low-level control│ Manual threads     │ threading.Thread+Lock  │
// │ Interlocked          │ Atomic counters   │ Lock-free          │ (no equivalent)        │
// │ ConcurrentDictionary │ Shared state      │ Lock-free dict     │ (no equivalent)        │
// │ BlockingCollection   │ Thread messaging  │ Blocking queue     │ queue.Queue            │
// └────────────────────────┴──────────────────┴────────────────────┴────────────────────────┘
//
// Decision tree:
//   1. Is the work I/O-bound or CPU-bound?
//      - I/O → async/await (or Parallel.ForEachAsync for throttling)
//      - CPU → Parallel.ForEach or Task.Run
//   2. Need producer-consumer pattern?
//      - Async → Channel<T>
//      - Threads → BlockingCollection<T>
//   3. Need shared state across threads?
//      - Simple counters → Interlocked
//      - Key-value → ConcurrentDictionary
//      - Complex state → lock
//
// C# has NO GIL. Threads execute truly in parallel on multiple cores.
// In C#, Task.Run() and Parallel.ForEach() give real multi-core parallelism.
```
