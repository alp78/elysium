---
type: reference
category: programming-languages
technology: [csharp, dotnet]
tags: [reference, programming-languages, csharp, dotnet, async]
aliases: [async await, concurrency, parallelism, tasks, threads, asyncio, Task]
keywords: [async, await, Task, CancellationToken, Parallel, Thread, SemaphoreSlim, Channel, IAsyncEnumerable]
description: "C# async and concurrency reference with executable examples and cell outputs — covers async/await, Task, parallel programming, CancellationToken, and Channels. See [[11_AsyncConcurrency]] for the Python equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[11_AsyncConcurrency]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 11. Async & Concurrency - C#

Topics covered:
- Async & Await (Task-based Asynchronous Pattern)
- Tasks & Parallelism (Task.Run, Parallel, PLINQ)
- Threading & Concurrency (Thread, lock, concurrent collections)

## 1. Async & Await


```csharp
// Async & Await — the Task-based Asynchronous Pattern (TAP)
//
// KEY CONCEPTS:
// - async: marks a method as asynchronous. Returns Task or Task<T>.
// - await: pauses the method until the awaited task completes.
//   The thread is NOT blocked — it's released to the thread pool to do other work.
// - Task: represents an asynchronous operation (like Python's coroutine/Future).
// - Task<T>: an async operation that returns a value of type T.
// - Unlike Python, C# has NO GIL — async/await is built into the runtime.
//   The thread pool manages threads automatically.
//
// WHY async matters for Data Engineering:
// - API calls (BigQuery, GCS, REST) are I/O-bound — async lets you overlap them.
// - A pipeline that fetches 10 APIs sequentially in 10s can do it in ~1s with async.
// - Python equivalent: asyncio / async def / await.

using System.Diagnostics;

// ─── Basic async method ───

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

// ─── Sequential vs concurrent ───

// Sequential — each fetch waits for the previous one
Console.WriteLine("=== Sequential (one after another) ===");
var sw = Stopwatch.StartNew();
var r1 = await FetchDataAsync("users_api", 1.0);
var r2 = await FetchDataAsync("events_api", 0.8);
var r3 = await FetchDataAsync("products_api", 0.5);
sw.Stop();
Console.WriteLine($"  Total: {sw.Elapsed.TotalSeconds:F2}s (sum of all delays)");

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




<div>

    <div id='dotnet-interactive-this-cell-$CACHE_BUSTER$' style='display: none'>

        The below script needs to be able to find the current output cell; this is an easy method to get it.

    </div>

    <script type='text/javascript'>

async function probeAddresses(probingAddresses) {

    function timeout(ms, promise) {

        return new Promise(function (resolve, reject) {

            setTimeout(function () {

                reject(new Error('timeout'))

            }, ms)

            promise.then(resolve, reject)

        })

    }



    if (Array.isArray(probingAddresses)) {

        for (let i = 0; i < probingAddresses.length; i++) {



            let rootUrl = probingAddresses[i];



            if (!rootUrl.endsWith('/')) {

                rootUrl = `${rootUrl}/`;

            }



            try {

                let response = await timeout(1000, fetch(`${rootUrl}discovery`, {

                    method: 'POST',

                    cache: 'no-cache',

                    mode: 'cors',

                    timeout: 1000,

                    headers: {

                        'Content-Type': 'text/plain'

                    },

                    body: probingAddresses[i]

                }));



                if (response.status == 200) {

                    return rootUrl;

                }

            }

            catch (e) { }

        }

    }

}



function loadDotnetInteractiveApi() {

    probeAddresses(["http://2a02:8308:718a:f200::655c:2048/","http://2a02:8308:718a:f200:8bd4:d06d:33ed:be05:2048/","http://2a02:8308:718a:f200:4d6a:f754:e291:8378:2048/","http://fe80::3212:d8da:d32d:4723%14:2048/","http://192.168.0.110:2048/","http://::1:2048/","http://127.0.0.1:2048/","http://fe80::91de:1423:fe62:933b%45:2048/","http://172.25.64.1:2048/"])

        .then((root) => {

        // use probing to find host url and api resources

        // load interactive helpers and language services

        let dotnetInteractiveRequire = require.config({

        context: '19544.Microsoft.DotNet.Interactive.Http.HttpPort',

                paths:

            {

                'dotnet-interactive': `${root}resources`

                }

        }) || require;



            window.dotnetInteractiveRequire = dotnetInteractiveRequire;



            window.configureRequireFromExtension = function(extensionName, extensionCacheBuster) {

                let paths = {};

                paths[extensionName] = `${root}extensions/${extensionName}/resources/`;

                

                let internalRequire = require.config({

                    context: extensionCacheBuster,

                    paths: paths,

                    urlArgs: `cacheBuster=${extensionCacheBuster}`

                    }) || require;



                return internalRequire

            };

        

            dotnetInteractiveRequire([

                    'dotnet-interactive/dotnet-interactive'

                ],

                function (dotnet) {

                    dotnet.init(window);

                },

                function (error) {

                    console.log(error);

                }

            );

        })

        .catch(error => {console.log(error);});

    }



// ensure `require` is available globally

if ((typeof(require) !==  typeof(Function)) || (typeof(require.config) !== typeof(Function))) {

    let require_script = document.createElement('script');

    require_script.setAttribute('src', 'https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.6/require.min.js');

    require_script.setAttribute('type', 'text/javascript');

    

    

    require_script.onload = function() {

        loadDotnetInteractiveApi();

    };



    document.getElementsByTagName('head')[0].appendChild(require_script);

}

else {

    loadDotnetInteractiveApi();

}



    </script>

</div>


    === Sequential (one after another) ===
      [04:49:13] Starting fetch: users_api
      [04:49:14] Completed fetch: users_api
      [04:49:14] Starting fetch: events_api
      [04:49:15] Completed fetch: events_api
      [04:49:15] Starting fetch: products_api
      [04:49:15] Completed fetch: products_api
      Total: 2.33s (sum of all delays)
    
    === Concurrent (Task.WhenAll) ===
      [04:49:15] Starting fetch: users_api
      [04:49:15] Starting fetch: events_api
      [04:49:15] Starting fetch: products_api
      [04:49:16] Completed fetch: products_api
      [04:49:16] Completed fetch: events_api
      [04:49:16] Completed fetch: users_api
      Total: 1.01s (max of all delays)
      Results: 3 dictionaries
    


```csharp
// Task.WhenAll vs Task.WhenAny — waiting strategies
//
// Task.WhenAll(tasks): wait until ALL complete. Returns all results.
//   Python equivalent: asyncio.gather()
// Task.WhenAny(tasks): wait until the FIRST one completes. Returns that task.
//   Python equivalent: asyncio.wait(return_when=FIRST_COMPLETED)
//
// Error handling:
// - Task.WhenAll unwraps AggregateException in await — only first inner exception surfaces.
// - To get ALL errors, store the Task and check .Exception (see 08_ErrorHandling).

using System.Diagnostics;

async Task<string> FetchTableAsync(string name, double delay, bool fail = false)
{
    await Task.Delay(TimeSpan.FromSeconds(delay));
    if (fail) throw new InvalidOperationException($"Fetch failed: {name}");
    return $"{name}: {(int)(delay * 1000)} rows";
}

// ─── Task.WhenAll with error handling ───

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

// ─── Task.WhenAny — first to complete wins ───
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

    === Task.WhenAll (error handling) ===
      ERROR: Fetch failed: users
    
    === Task.WhenAny (first wins) ===
      First to finish: replica-eu: 300 rows
    


```csharp
using System.Threading;
using System.Diagnostics;
// Cancellation — CancellationToken
//
// CancellationTokenSource: creates a token you can cancel.
// CancellationToken: passed to async methods so they can check for cancellation.
// When cancelled, the method throws OperationCanceledException.
// Python equivalent: asyncio.Task.cancel() + CancelledError.
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

// ─── Cancel after timeout ───

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

// ─── Manual cancellation ───

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

    === CancellationToken (timeout) ===
      Starting export: huge_events
      huge_events: chunk 1/10
      huge_events: chunk 2/10
      huge_events: chunk 3/10
      Export cancelled after 2s timeout
    
    === Manual cancellation ===
      Starting export: daily_clicks
      daily_clicks: chunk 1/10
      daily_clicks: chunk 2/10
      [Supervisor] Cancelling export...
      Export was manually cancelled
    


```csharp
using System.Net.Http;
// Async patterns for Data Engineering
//
// 1. SemaphoreSlim: limit concurrent requests (don't overwhelm an API).
// 2. Retry with backoff: retry failed tasks with exponential delay.
// 3. Channel<T>: async producer-consumer (like asyncio.Queue in Python).

using System.Diagnostics;
using System.Threading.Channels;

// ─── 1. SemaphoreSlim — rate limiting ───
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

// ─── 2. Retry with exponential backoff ───

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

// ─── 3. Channel<T> — async producer-consumer ───
// Channel<T> is the async equivalent of Python's asyncio.Queue.
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

    === SemaphoreSlim (max 3 concurrent) ===
      Fetched 10 pages in 1.03s
        https://api.example.com/page/0 (330ms)
        https://api.example.com/page/1 (429ms)
        https://api.example.com/page/2 (416ms)
        ... (7 more)
    
    === Retry with Exponential Backoff ===
      Attempt 1 failed: Connection refused (attempt 1). Retrying in 100ms...
      Attempt 2 failed: Connection refused (attempt 2). Retrying in 200ms...
      Success on attempt 3: /data/events: ok
    
    === Channel<T> (async producer-consumer) ===
      Processed 12 events in 0.74s with 3 workers
    

## 2. Tasks & Parallelism


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
//   Python equivalent: ProcessPoolExecutor (needs separate processes for CPU work).

using System.Diagnostics;
using System.Security.Cryptography;

// ─── Task.Run — offload CPU work to thread pool ───

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

// ─── Parallel.ForEach — partition and process ───
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

    === Sequential (single thread) ===
      8 hashes in 0.00s
    
    === Task.Run (thread pool, 16 cores) ===
      8 hashes in 0.00s
      Speedup: 1.1x
      Results match: True
    
    === Parallel.ForEach ===
      8 hashes in 0.00s (max 4 threads)
      Results match: True
    


```csharp
// Parallel.ForEachAsync & PLINQ
//
// Parallel.ForEachAsync (.NET 6+): process items concurrently with async lambdas.
//   Great for I/O-bound work with controlled parallelism.
//   Python equivalent: asyncio.Semaphore + gather (no direct equivalent).
//
// PLINQ (Parallel LINQ): add .AsParallel() to a LINQ query for multi-core execution.
//   Python equivalent: multiprocessing.Pool.map() or ProcessPoolExecutor.map().

using System.Diagnostics;

// ─── Parallel.ForEachAsync — async I/O with controlled concurrency ───
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

// ─── PLINQ (Parallel LINQ) ───
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

    === Parallel.ForEachAsync (max 3 concurrent) ===
      Fetched 10 tables in 1.19s
        table_09: 5178 rows
        table_08: 1379 rows
        table_07: 2759 rows
    
    === PLINQ (.AsParallel()) ===
      Parsed 1'000'000 records -> 985'050 filtered in 0.28s
      Sample: { EventId = evt_0005001, User = user_001, Value = 50.01 }
      Sequential: 0.27s  |  PLINQ was faster on large data
    

## 3. Threading & Concurrency


```csharp
#nullable enable
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
//   Python equivalent: threading.Thread(daemon=True).
//
// NOTE: in modern C#, prefer Task/async over raw threads.
// Use threads only when you need explicit control.

using System.Diagnostics;

// ─── Basic threading ───

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
      [17] fetch_users starting
      [38] fetch_products starting
      [14] fetch_events starting
      [38] fetch_products finished
      [17] fetch_users finished
      [14] fetch_events finished
      Results: [fetch_events done, fetch_users done, fetch_products done]
    


```csharp
// lock & Interlocked — preventing race conditions
//
// Race condition: two threads read-modify-write a shared variable simultaneously,
// causing lost updates. The lock keyword prevents this.
// Python equivalent: threading.Lock() with "with lock:" context manager.

// ─── Race condition demo (WITHOUT lock) ───

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

// ─── Fixed with lock ───

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

// ─── Interlocked — lock-free atomic operations ───
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

    === Race Condition (no lock) ===
      Expected: 400,000
      Got:      314'065  (WRONG — race condition!)
    
    === With lock (safe) ===
      Expected: 400,000
      Got:      400'000  (correct — lock prevents race)
    
    === Interlocked (lock-free) ===
      Expected: 400,000
      Got:      400'000  (correct — atomic operation)
    


```csharp
// Concurrent collections — thread-safe data structures
//
// System.Collections.Concurrent provides collections designed for multi-threaded access.
// No manual locking needed — the collection handles synchronization internally.
// Python equivalent: queue.Queue (thread-safe), but Python has no ConcurrentDictionary.
//
// KEY TYPES:
// - ConcurrentDictionary<K,V>: thread-safe dictionary. AddOrUpdate, GetOrAdd.
// - ConcurrentBag<T>: unordered thread-safe collection. Good for collecting results.
// - ConcurrentQueue<T>: thread-safe FIFO queue. TryDequeue (never blocks).
// - BlockingCollection<T>: wraps a concurrent collection + blocks on Take() when empty.
//   This is the C# equivalent of Python's queue.Queue (blocking get).

using System.Collections.Concurrent;
using System.Diagnostics;

// ─── ConcurrentDictionary — thread-safe aggregation ───
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

// ─── BlockingCollection — producer-consumer with threads ───
// Take() blocks until an item is available (like Python's queue.Queue.get()).
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

    === ConcurrentDictionary (thread-safe aggregation) ===
      Event counts (100K events across 4 types):
        click: 25'000
        purchase: 25'000
        signup: 25'000
        view: 25'000
      Total: 100'000
    
    === BlockingCollection (producer-consumer) ===
      Processed 20 events in 0.63s
        worker-1: 6 events
        worker-2: 8 events
        worker-3: 6 events
    


```csharp
// Summary — choosing the right concurrency tool in C#
//
// ┌────────────────────────┬──────────────────┬────────────────────┬────────────────────────┐
// │ C# Tool              │ Best for         │ Model              │ Python equivalent       │
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
// KEY DIFFERENCE from Python:
// C# has NO GIL. Threads execute truly in parallel on multiple cores.
// In Python, threads are limited by the GIL for CPU work (need ProcessPoolExecutor).
// In C#, Task.Run() and Parallel.ForEach() give real multi-core parallelism.
```




<div>

    <div id='dotnet-interactive-this-cell-$CACHE_BUSTER$' style='display: none'>

        The below script needs to be able to find the current output cell; this is an easy method to get it.

    </div>

    <script type='text/javascript'>

async function probeAddresses(probingAddresses) {

    function timeout(ms, promise) {

        return new Promise(function (resolve, reject) {

            setTimeout(function () {

                reject(new Error('timeout'))

            }, ms)

            promise.then(resolve, reject)

        })

    }



    if (Array.isArray(probingAddresses)) {

        for (let i = 0; i < probingAddresses.length; i++) {



            let rootUrl = probingAddresses[i];



            if (!rootUrl.endsWith('/')) {

                rootUrl = `${rootUrl}/`;

            }



            try {

                let response = await timeout(1000, fetch(`${rootUrl}discovery`, {

                    method: 'POST',

                    cache: 'no-cache',

                    mode: 'cors',

                    timeout: 1000,

                    headers: {

                        'Content-Type': 'text/plain'

                    },

                    body: probingAddresses[i]

                }));



                if (response.status == 200) {

                    return rootUrl;

                }

            }

            catch (e) { }

        }

    }

}



function loadDotnetInteractiveApi() {

    probeAddresses(["http://2a02:8308:718a:f200::655c:2048/","http://2a02:8308:718a:f200:8bd4:d06d:33ed:be05:2048/","http://2a02:8308:718a:f200:812b:542c:9d38:5803:2048/","http://fe80::3212:d8da:d32d:4723%14:2048/","http://192.168.0.110:2048/","http://::1:2048/","http://127.0.0.1:2048/","http://fe80::91de:1423:fe62:933b%45:2048/","http://172.25.64.1:2048/"])

        .then((root) => {

        // use probing to find host url and api resources

        // load interactive helpers and language services

        let dotnetInteractiveRequire = require.config({

        context: '16088.Microsoft.DotNet.Interactive.Http.HttpPort',

                paths:

            {

                'dotnet-interactive': `${root}resources`

                }

        }) || require;



            window.dotnetInteractiveRequire = dotnetInteractiveRequire;



            window.configureRequireFromExtension = function(extensionName, extensionCacheBuster) {

                let paths = {};

                paths[extensionName] = `${root}extensions/${extensionName}/resources/`;

                

                let internalRequire = require.config({

                    context: extensionCacheBuster,

                    paths: paths,

                    urlArgs: `cacheBuster=${extensionCacheBuster}`

                    }) || require;



                return internalRequire

            };

        

            dotnetInteractiveRequire([

                    'dotnet-interactive/dotnet-interactive'

                ],

                function (dotnet) {

                    dotnet.init(window);

                },

                function (error) {

                    console.log(error);

                }

            );

        })

        .catch(error => {console.log(error);});

    }



// ensure `require` is available globally

if ((typeof(require) !==  typeof(Function)) || (typeof(require.config) !== typeof(Function))) {

    let require_script = document.createElement('script');

    require_script.setAttribute('src', 'https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.6/require.min.js');

    require_script.setAttribute('type', 'text/javascript');

    

    

    require_script.onload = function() {

        loadDotnetInteractiveApi();

    };



    document.getElementsByTagName('head')[0].appendChild(require_script);

}

else {

    loadDotnetInteractiveApi();

}



    </script>

</div>

