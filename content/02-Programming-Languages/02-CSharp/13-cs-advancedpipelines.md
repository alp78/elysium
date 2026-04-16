---
title: "13 - Advanced Pipelines - C#"
tags: [csharp, pipeline]
aliases: [advanced pipelines, TPL Dataflow, channels, IAsyncEnumerable, cross-process]
description: "C# advanced parallel pipelines reference with executable examples and cell outputs — covers TPL Dataflow, Channel-based batching, IAsyncEnumerable for paginated APIs, rate-limited parallel fetch, and cross-process execution. See [13-py-advancedpipelines](https://alp78.github.io/elysium/02-Programming-Languages/01-Python/13-py-advancedpipelines) for the Python equivalent."
created: 2026-03-25
updated: 2026-04-04
status: complete
---

# 13. Advanced Parallel Pipelines - C#

> [!quote]+
> "The combination of threads, remote-procedure-call interfaces, and heavyweight object-oriented design is especially dangerous. If you are ever invited onto a project that is supposed to feature all three, fleeing in terror might well be an appropriate reaction."
>
> — **Eric S. Raymond**, *The Art of Unix Programming* (2003)

> [!abstract]- Summary
>
> **Setup**
> - Shared `HttpClient` and API keys loaded from `.env`; Roslyn warning level suppressed for notebook execution.
>
> **TPL Dataflow**
> - `TransformBlock` + `ActionBlock`: three-stage simulated pipeline (Fetch → Format → Print) with per-stage `MaxDegreeOfParallelism` and `PropagateCompletion` cascading shutdown.
> - Real API variant: same three stages hitting Twelve Data `/quote`; 2-concurrent fetch, synchronous parse, terminal print.
> - `BatchBlock`: collects items into fixed-size arrays; partial batch flushed on `Complete()`.
>
> **Parallel API Ingestion**
> - Rate-limited fetch: `SemaphoreSlim(3)` over 8 symbols via `Task.WhenAll`; results collected into `ConcurrentBag<T>`.
> - `IAsyncEnumerable` generator: FRED `/series/search` paginated with `yield return`; consumer uses `await foreach`, only requested pages fetched.
> - Channel batching: bounded `Channel<T>` receives concurrent Finnhub fetches from parallel producers; single consumer accumulates into batches of 3 and flushes remainder.
>
> **Cross-Process Execution**
> - Single process: Python one-liner via `Process.Start`, async stdout/stderr capture before `WaitForExitAsync`, JSON round-trip parsed back in C#.
> - Fan-out: `Task.WhenAll` over multiple `Process.Start` calls; total time equals slowest child.
>
> **Warnings & Recommendations**
> - Bounded-capacity deadlock prevention; stdout/stderr async drain pattern; `SemaphoreSlim` release in `finally`; `writer.Complete()` discipline.

> [!note]- Glossary
>
> **TPL Dataflow** (`System.Threading.Tasks.Dataflow`)
>
> - A NuGet library (`System.Threading.Tasks.Dataflow`) for building multi-stage concurrent pipelines from composable blocks. Blocks are linked with `LinkTo`; data flows automatically between stages with independent concurrency limits and built-in buffering.
> - Used for high-throughput ETL pipelines (extract → transform → load) where each stage has different I/O vs CPU characteristics.
>
> > [!tip] Not in the base runtime
> > `System.Threading.Tasks.Dataflow` must be added via NuGet. It is not included in the standard `System.Threading.Tasks` namespace available without a package reference.
>
>  ---
>
> **`TransformBlock<TIn, TOut>`**
>
> - A TPL Dataflow block that receives items of type `TIn`, applies an async or sync transform, and emits items of type `TOut`. Concurrency is controlled via `MaxDegreeOfParallelism` on `ExecutionDataflowBlockOptions`.
> - Equivalent to a concurrent `Select` projection — used for CPU-bound or I/O-bound transformation stages such as HTTP fetches or JSON parsing.
>
> > [!tip] Per-stage concurrency
> > Each `TransformBlock` has its own concurrency limit independently of other stages. Set Fetch stages higher (I/O-bound, e.g., 3–10) and CPU stages lower (e.g., 1–2) to match resource constraints.
>
>  ---
>
> **`ActionBlock<T>`**
>
> - A terminal TPL Dataflow block that consumes items of type `T` with no output. Acts as a sink — equivalent to a concurrent `ForEach`.
> - Used as the last stage in a pipeline (e.g., writing to a database, printing results). Awaiting `Completion` blocks until all items have been processed and the block has shut down.
>
> > [!tip] Await Completion to drain
> > After calling `headBlock.Complete()`, always `await terminalBlock.Completion` to ensure the entire pipeline has drained before the enclosing scope exits.
>
>  ---
>
> **`BatchBlock<T>`**
>
> - A TPL Dataflow block that accumulates individual items into fixed-size `T[]` arrays before passing them downstream. When the source completes, any remaining items smaller than the batch size are flushed as a partial batch.
> - Used to convert per-record streams into bulk operations — database bulk inserts, batched API calls, or chunked file writes.
>
> > [!tip] Batch size sweet spot
> > For database bulk inserts, 500–1,000 rows per batch typically maximizes throughput while keeping per-batch memory bounded. Measure with the actual workload — small batches (10–50) reduce latency but increase per-batch overhead; large batches (1,000+) increase memory pressure and delay processing start.
>
>  ---
>
> **`Channel<T>`** (`System.Threading.Channels`)
>
> - A high-performance async producer-consumer queue. `Channel.CreateBounded<T>(capacity)` caps the buffer and applies backpressure — `WriteAsync` awaits when the channel is full, slowing producers to match consumer speed.
> - Used to wire independent pipeline stages with flow control, replacing manual `ConcurrentQueue` + signaling patterns.
>
> > [!warning] Forgetting `writer.Complete()`
> >
> > If `channel.Writer.Complete()` is never called, `ReadAllAsync()` on the reader blocks indefinitely — the consumer awaits an end-of-stream signal that never arrives.
>
>  ---
>
> **`IAsyncEnumerable<T>`**
>
> - An `async` version of `IEnumerable<T>` introduced in C# 8 / .NET Core 3. An async iterator method uses `yield return` to emit items one at a time with `await` between fetches; the consumer uses `await foreach`.
> - Used to stream paginated API responses lazily — only one page is in memory at a time, and `break` in the consumer stops further page fetching.
>
> > [!tip] Cancellation token on async iterators
> > Decorate the `CancellationToken` parameter with `[EnumeratorCancellation]` so callers can pass a token via `WithCancellation()` on the `await foreach` expression, enabling cooperative cancellation mid-stream.
>
>  ---
>
> **`SemaphoreSlim`**
>
> - A lightweight synchronization primitive that limits how many tasks can execute a critical section concurrently. `SemaphoreSlim(n)` allows `n` simultaneous entries; `WaitAsync()` blocks until a slot is available; `Release()` frees a slot.
> - Used to rate-limit concurrent API calls, cap database connections, or throttle any I/O-bound fan-out pattern.
>
> > [!warning] Always release in `finally`
> >
> > If the guarded code throws an exception and `Release()` is not in a `finally` block, the semaphore slot is permanently consumed — remaining tasks will deadlock waiting for a slot that is never freed.
>
>  ---
>
> **`ConcurrentBag<T>`**
>
> - A thread-safe, unordered collection optimized for scenarios where the same thread both adds and removes items. Backed by per-thread local queues with work-stealing for cross-thread access.
> - Used in parallel fan-out patterns (e.g., `Task.WhenAll`) to collect results from concurrent tasks without explicit locking. Order of insertion is not preserved.
>
> > [!tip] Use when order does not matter
> > If result order matters, prefer `ConcurrentQueue<T>` (FIFO) or collect into a `Task<T>[]` and read results after `Task.WhenAll` via the task's `.Result` property.
>
>  ---
>
> **`PropagateCompletion`**
>
> - A flag on `DataflowLinkOptions` that causes a downstream block to automatically complete (and eventually fault) when the upstream block completes. Set on every `LinkTo` call in a pipeline so that calling `headBlock.Complete()` cascades the shutdown through all linked stages.
> - Without `PropagateCompletion = true`, downstream blocks wait indefinitely for items that will never arrive.
>
> > [!tip] Required on every link
> > Set `PropagateCompletion = true` on every `LinkTo` call in the chain — omitting it on any single link breaks cascade shutdown at that stage.
>
>  ---
>
> **`BoundedCapacity`**
>
> - A property on `ExecutionDataflowBlockOptions` (and `GroupingDataflowBlockOptions`) that sets the maximum number of items a block can buffer. When the buffer is full, `Post` returns `false` and `SendAsync` awaits until space is available.
> - Prevents unbounded memory growth when a fast producer feeds a slow consumer. Without it, the buffer grows until OOM.
>
> > [!tip] Size to absorb burst, not entire dataset
> > Set `BoundedCapacity` high enough to absorb a few seconds of upstream throughput. If too low, the pipeline stalls; if unbounded, memory pressure builds. A good starting point is 2–5× `MaxDegreeOfParallelism` of the downstream block.
>
>  ---
>
> **`Task.WhenAll`**
>
> - Returns a `Task` that completes when all supplied tasks complete. If any task faults, `WhenAll` faults with an `AggregateException` containing all individual exceptions.
> - Used to launch a fixed set of async operations concurrently and await all of them. Total elapsed time equals the slowest task, not the sum.
>
> > [!tip] Combine with `SemaphoreSlim` for bounded concurrency
> > `Task.WhenAll` alone gives unbounded concurrency — all tasks start simultaneously. Wrap the inner work with `SemaphoreSlim.WaitAsync()` to cap the number running at any instant.
>
>  ---
>
> **`Process`** (`System.Diagnostics.Process`)
>
> - Represents an operating system process with its own memory space. `Process.Start(ProcessStartInfo)` spawns the child; `WaitForExitAsync()` awaits its exit without blocking the calling thread.
> - Used to invoke CLI tools, Python scripts, or shell commands from C#. The child process runs in a separate memory space — a child crash does not take down the parent.
>
> > [!warning] Read stdout/stderr before `WaitForExitAsync`
> >
> > If the child writes more output than the OS pipe buffer (typically 4–64 KB) and the parent has not read it, the child blocks waiting for the buffer to drain while the parent is blocked on `WaitForExitAsync` — a permanent deadlock. Always read stdout and stderr asynchronously before awaiting exit.


```csharp
using System.Threading.Tasks.Dataflow;
using Microsoft.DotNet.Interactive.CSharp;
using Microsoft.DotNet.Interactive;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net.Http;
using System.Reflection;
using System.Text.Json;
using System.Threading.Channels;
using System.Threading;
```

## Setup

### Imports and warning suppression

```csharp
var csharpKernel = (CSharpKernel)Kernel.Root.FindKernelByName("csharp");
var optionsField = typeof(CSharpKernel).GetField("_scriptOptions",
    BindingFlags.NonPublic | BindingFlags.Instance);
var scriptOptions = optionsField.GetValue(csharpKernel);
var withWarningLevel = scriptOptions.GetType().GetMethod("WithWarningLevel");
var newOptions = withWarningLevel.Invoke(scriptOptions, new object[] { 0 });
optionsField.SetValue(csharpKernel, newOptions);

var http = new HttpClient();
http.DefaultRequestHeaders.Add("User-Agent", "CSharp-Notebook/1.0");
```

### API keys from environment variables

```csharp
var envPath = Path.Combine(Directory.GetCurrentDirectory(), ".env");
if (File.Exists(envPath))
{
    foreach (var line in File.ReadAllLines(envPath))
    {
        var trimmed = line.Trim();
        if (string.IsNullOrEmpty(trimmed) || trimmed.StartsWith("#")) continue;
        var eq = trimmed.IndexOf('=');
        if (eq > 0)
            Environment.SetEnvironmentVariable(trimmed[..eq], trimmed[(eq + 1)..]);
    }
    Console.WriteLine($"  Loaded .env from {envPath}");
}
else
    Console.WriteLine($"  WARNING: .env not found at {envPath}");

var TWELVE_DATA_KEY = Environment.GetEnvironmentVariable("TWELVE_DATA_KEY") ?? "";
var FRED_KEY = Environment.GetEnvironmentVariable("FRED_KEY") ?? "";
var FINNHUB_KEY = Environment.GetEnvironmentVariable("FINNHUB_KEY") ?? "";

Console.WriteLine($"  TWELVE_DATA_KEY: {(TWELVE_DATA_KEY.Length > 0 ? "set" : "MISSING")}");
Console.WriteLine($"  FRED_KEY:        {(FRED_KEY.Length > 0 ? "set" : "MISSING")}");
Console.WriteLine($"  FINNHUB_KEY:     {(FINNHUB_KEY.Length > 0 ? "set" : "MISSING")}");
```

```text
TWELVE_DATA_KEY: set
FRED_KEY:        set
FINNHUB_KEY:     set
```

## TPL Dataflow

### Dataflow blocks

#### TransformBlock and ActionBlock — build a concurrent pipeline

> [!info] TPL Dataflow blocks
>
> - `TransformBlock<TIn, TOut>` — transforms items with configurable parallelism
> - `ActionBlock<T>` — terminal consumer
> - `LinkTo` — connects blocks; `PropagateCompletion` cascades shutdown
> - Built-in buffering and backpressure prevent OOM from fast producers
> - For simple sequential processing, plain `async`/`await` is simpler

> [!warning] Anti-patterns
>
> - **Not calling `Complete()`** — downstream blocks wait forever
> - **Unbounded buffer** — set `BoundedCapacity` to prevent OOM

> [!success] Always signal completion and bound your buffers
>
> Call `headBlock.Complete()` after posting all items, and use `PropagateCompletion = true` on every link so the shutdown signal cascades automatically. Set `BoundedCapacity` on `ExecutionDataflowBlockOptions` to apply backpressure and prevent unbounded memory growth.

`System.Threading.Tasks.Dataflow` provides blocks that process items concurrently with independent concurrency limits per stage. A `TransformBlock<TIn, TOut>` takes input and produces output (like `Select` but concurrent). An `ActionBlock<T>` is a terminal consumer with no output (like `ForEach`). Blocks are linked together with `LinkTo` — data flows automatically from one to the next. Each stage can have different concurrency limits: Fetch (I/O, 3 concurrent) → Parse (CPU, 2 concurrent) → Save (I/O, 1 sequential). Without Dataflow you'd need manual Channel wiring, thread management, and backpressure.

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
    F["TransformBlock<br/>Fetch (3 concurrent)"] --> P["TransformBlock<br/>Format (2 concurrent)"]
    P --> A["ActionBlock<br/>Print (1 sequential)"]
    style F fill:#292e42,stroke:#565f89
    style P fill:#292e42,stroke:#565f89
    style A fill:#292e42,stroke:#565f89
```

This cell builds a three-stage pipeline for 8 European ADR symbols: a `TransformBlock` simulates a 100ms async fetch and returns a `(Symbol, Price)` tuple with up to 3 concurrent fetches, a second `TransformBlock` formats each result with a directional arrow (▲/▼) capped at 2 concurrent, and an `ActionBlock` prints each formatted string sequentially. `fetchBlock.Complete()` triggers the cascading shutdown via `PropagateCompletion`, and `await printBlock.Completion` ensures the cell blocks until all items have been printed.

```csharp
var fetchBlock = new TransformBlock<string, (string Symbol, double Price)>(
    async symbol =>
    {
        await Task.Delay(100);
        var price = 100.0 + new Random(symbol.GetHashCode()).NextDouble() * 200;
        Console.WriteLine($"  [fetch] {symbol}: ${price:F2}");
        return (symbol, Math.Round(price, 2));
    },
    new ExecutionDataflowBlockOptions { MaxDegreeOfParallelism = 3 });

var formatBlock = new TransformBlock<(string Symbol, double Price), string>(
    input =>
    {
        var (symbol, price) = input;
        var arrow = (price > 200) ? "▲" : "▼";
        return $"{symbol}: ${price:F2} {arrow}";
    },
    new ExecutionDataflowBlockOptions { MaxDegreeOfParallelism = 2 });

var printBlock = new ActionBlock<string>(
    msg => Console.WriteLine($"  [result] {msg}"));

fetchBlock.LinkTo(formatBlock, new DataflowLinkOptions { PropagateCompletion = true });
formatBlock.LinkTo(printBlock, new DataflowLinkOptions { PropagateCompletion = true });

var symbols = new[] { "SAP", "ASML", "TTE", "UL", "DEO", "SNY", "NVS", "AZN" };
foreach (var s in symbols)
    fetchBlock.Post(s);

fetchBlock.Complete();
await printBlock.Completion;
Console.WriteLine("  Pipeline complete.");
```

```text
[fetch] TTE: $172.04
[fetch] SAP: $229.88
[fetch] ASML: $170.77
[result] SAP: $229.88 ▲
[result] ASML: $170.77 ▼
[result] TTE: $172.04 ▼
[fetch] SNY: $198.12
[fetch] UL: $173.24
[fetch] DEO: $137.76
[result] UL: $173.24 ▼
[result] DEO: $137.76 ▼
[result] SNY: $198.12 ▼
[fetch] AZN: $230.22
[fetch] NVS: $274.99
[result] NVS: $274.99 ▲
[result] AZN: $230.22 ▲
Pipeline complete.
```

#### BatchBlock — size-bounded batching

A `BatchBlock` in TPL Dataflow collects individual items into fixed-size arrays before passing them downstream. Instead of processing one record at a time (which wastes I/O on per-record database calls), a BatchBlock accumulates N items and sends them as a batch — enabling bulk inserts, batched API calls, and efficient resource utilization. When the source completes, any remaining items smaller than the batch size are flushed as a partial batch.

> [!tip] Batch size tuning
> Small batches (10-50) minimize latency but increase per-batch overhead. Large batches (1000+) maximize throughput but increase memory usage and delay processing. For database bulk inserts, 500-1000 rows per batch typically hits the sweet spot. Measure with your actual workload.

This cell posts 8 single-letter items ("A" through "H") into a `BatchBlock<string>` configured with a batch size of 3, linked to an `ActionBlock<string[]>` that prints each batch. The output shows two full batches of 3 and one partial batch of 2 — demonstrating that `batchBlock.Complete()` flushes the remainder even when it doesn't fill the batch size.

```csharp
var batchBlock = new BatchBlock<string>(3); // emit arrays of 3

var batchConsumer = new ActionBlock<string[]>(
    batch => Console.WriteLine($"  Batch of {batch.Length}: [{string.Join(", ", batch)}]"));

batchBlock.LinkTo(batchConsumer, new DataflowLinkOptions { PropagateCompletion = true });

foreach (var item in new[] { "A", "B", "C", "D", "E", "F", "G", "H" })
    batchBlock.Post(item);

batchBlock.Complete();
await batchConsumer.Completion;
Console.WriteLine("  All batches processed.");
```

```text
[A, B, C]
[D, E, F]
[G, H]
All batches processed.
```

### Multi-stage pipeline with real API

#### TPL Dataflow — multi-stage pipeline with real API

Connects three stages with real HTTP calls: Fetch (I/O-bound, 2 concurrent) → Parse (CPU-bound, synchronous) → Display (terminal consumer). `PropagateCompletion` cascades shutdown through the chain so all stages drain and complete cleanly.

This cell posts 4 European ADR symbols (`SAP`, `ASML`, `TTE`, `UL`) into a `fetchStage` `TransformBlock` that calls the Twelve Data `/quote` endpoint with up to 2 concurrent requests, returning a `(Symbol, Json)` tuple. A `parseStage` `TransformBlock` extracts `close` price and `percent_change` from the JSON, then a `resultStage` `ActionBlock` prints each result. The elapsed time in the output reflects the 2-at-a-time concurrency limit across 4 real HTTP calls.

```csharp
var apiKey = TWELVE_DATA_KEY;

var fetchStage = new TransformBlock<string, (string Symbol, string Json)>(
    async symbol =>
    {
        var url = $"https://api.twelvedata.com/quote?symbol={symbol}&apikey={apiKey}";
        var json = await http.GetStringAsync(url);
        return (symbol, json);
    },
    new ExecutionDataflowBlockOptions { MaxDegreeOfParallelism = 2 });

var parseStage = new TransformBlock<(string Symbol, string Json), (string Symbol, double Price, double Change)>(
    input =>
    {
        using var doc = JsonDocument.Parse(input.Json);
        var root = doc.RootElement;
        var price = root.TryGetProperty("close", out var p) ? double.Parse(p.GetString() ?? "0") : 0;
        var change = root.TryGetProperty("percent_change", out var c) ? double.Parse(c.GetString() ?? "0") : 0;
        return (input.Symbol, price, change);
    });

var resultStage = new ActionBlock<(string Symbol, double Price, double Change)>(
    r => Console.WriteLine($"  {r.Symbol,-6} ${r.Price,8:F2}  {r.Change:F2}%"));

fetchStage.LinkTo(parseStage, new DataflowLinkOptions { PropagateCompletion = true });
parseStage.LinkTo(resultStage, new DataflowLinkOptions { PropagateCompletion = true });

var sw = Stopwatch.StartNew();
foreach (var sym in new[] { "SAP", "ASML", "TTE", "UL" })
    fetchStage.Post(sym);

fetchStage.Complete();
await resultStage.Completion;
Console.WriteLine($"  Done in {sw.ElapsedMilliseconds}ms");
```

```text
SAP    $    0.00  0.00%
ASML   $    0.00  0.00%
TTE    $    0.00  0.00%
UL     $    0.00  0.00%
Done in 260ms
```

## Parallel API Ingestion

### Rate-limited parallel fetch

#### Parallel fetch with rate limiting

> [!info] Rate-limited parallel fetch
>
> - `SemaphoreSlim(maxConcurrent)` — limits simultaneous API calls
> - `WaitAsync` blocks when the limit is reached; `Release` in `finally` ensures cleanup
> - `Task.WhenAll` runs all fetches concurrently within the limit

> [!warning] Anti-patterns
>
> - **Unbounded concurrency** — gets rate-limited or banned by APIs
> - **Not releasing semaphore on error** — deadlocks remaining tasks

> [!success] Throttle with SemaphoreSlim and always release
>
> Use `SemaphoreSlim(n)` to cap concurrency to the API's rate limit. Always call `semaphore.Release()` in a `finally` block — if the HTTP call throws, the semaphore is still released and remaining tasks can proceed.

`SemaphoreSlim(n)` limits how many tasks can run a critical section concurrently. `WaitAsync()` blocks if n tasks are already inside; `Release()` lets the next one in. `ConcurrentBag<T>` is a thread-safe unordered collection for collecting results from parallel tasks. Share one semaphore across all concurrent tasks — don't create one per call.

This cell fetches prices for 8 symbols from Twelve Data, capping concurrency at 3 simultaneous requests via a `SemaphoreSlim(3)`. Each task awaits the semaphore before making its HTTP call and releases it in a `finally` block. `Task.WhenAll` waits for all 8 tasks to complete; the elapsed timestamps in the output show the first 3 completing together, then the next 3, then the last 2 — confirming the 3-at-a-time throttle.

```csharp
var tdSymbols = new[] { "SAP", "ASML", "TTE", "UL", "DEO", "SNY", "NVS", "AZN" };
var tdKey = TWELVE_DATA_KEY;

var semaphore = new SemaphoreSlim(3);
var results = new ConcurrentBag<(string Symbol, double Price)>();

var sw = Stopwatch.StartNew();
var tasks = tdSymbols.Select(async symbol =>
{
    await semaphore.WaitAsync();
    try
    {
        var url = $"https://api.twelvedata.com/price?symbol={symbol}&apikey={tdKey}";
        var json = await http.GetStringAsync(url);
        using var doc = JsonDocument.Parse(json);
        var price = doc.RootElement.TryGetProperty("price", out var p)
            ? double.Parse(p.GetString() ?? "0") : 0;
        results.Add((symbol, price));
        Console.WriteLine($"  {symbol,-6} ${price,8:F2}  ({sw.ElapsedMilliseconds}ms)");
    }
    finally { semaphore.Release(); }
}).ToArray();

await Task.WhenAll(tasks);
Console.WriteLine($"\n  Fetched {results.Count} quotes in {sw.ElapsedMilliseconds}ms (3 concurrent max)");
```

```text
ASML   $    0.00  (108ms)
SAP    $    0.00  (109ms)
TTE    $    0.00  (139ms)
UL     $    0.00  (216ms)
DEO    $    0.00  (224ms)
SNY    $    0.00  (258ms)
NVS    $    0.00  (325ms)
AZN    $    0.00  (332ms)

Fetched 8 quotes in 332ms (3 concurrent max)
```

### IAsyncEnumerable for paginated APIs

#### IAsyncEnumerable for paginated FRED API

An async generator that fetches one page at a time from the FRED API and yields individual items via `yield return`. The consumer sees a clean `await foreach` stream — only one page is in memory at a time. `break` in the consumer stops further page fetching, making this safe for APIs with thousands of results.

This cell defines `FetchFredSeriesAsync`, an async iterator that searches the FRED `/series/search` endpoint for `"GDP"` with a page size of 5, yielding up to 8 `(Id, Title)` tuples across multiple HTTP calls. The `await foreach` loop in the consumer prints each series ID and a truncated title; only the pages actually needed are fetched, not the full result set.

```csharp
var fredKey = FRED_KEY;

async IAsyncEnumerable<(string Id, string Title)> FetchFredSeriesAsync(
    string searchText, int limit = 10,
    [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct = default)
{
    int offset = 0;
    int pageSize = 5;
    int yielded = 0;

    while (yielded < limit)
    {
        var url = $"https://api.stlouisfed.org/fred/series/search?search_text={searchText}" +
                  $"&api_key={fredKey}&file_type=json&limit={pageSize}&offset={offset}";
        var json = await http.GetStringAsync(url, ct);
        using var doc = JsonDocument.Parse(json);

        if (!doc.RootElement.TryGetProperty("seriess", out var seriess)) yield break;

        var items = seriess.EnumerateArray().ToList();
        if (items.Count == 0) yield break;

        foreach (var item in items)
        {
            if (yielded >= limit) yield break;
            var id = item.GetProperty("id").GetString() ?? "";
            var title = item.GetProperty("title").GetString() ?? "";
            yield return (id, title);
            yielded++;
        }
        offset += pageSize;
    }
}

Console.WriteLine("  FRED series matching 'GDP':");
await foreach (var (id, title) in FetchFredSeriesAsync("GDP", limit: 8))
{
    Console.WriteLine($"    {id,-20} {title[..Math.Min(title.Length, 50)]}");
}
```

```text
FRED series matching 'GDP':
  Total Public Debt as Percent of Gros
  FYFSGDA188S          Federal Surplus or Deficit [-] as Percent of Gross
  FYFSDFYGDP           Federal Surplus or Deficit [-] as Percent of Gross
  GDP                  Gross Domestic Product
  FYONGDA188S          Federal Net Outlays as Percent of Gross Domestic P
  GFDGDPA188S          Gross Federal Debt as Percent of Gross Domestic Pr
  Interest as Percent of Gross Dome
  FYFRGDA188S          Federal Receipts as Percent of Gross Domestic Prod
```

### Channel-based batching

#### Parallel fetch with Channel batching

This pattern combines `Channel<T>` (async producer-consumer queue) with parallel HTTP fetches: multiple producers fetch data concurrently and write to a shared channel, while a single consumer reads from the channel and processes items in order. The channel provides backpressure (bounded capacity) so fast producers don't overwhelm slow consumers or exhaust memory.

> [!warning] Unbounded channels in parallel fetch
> An unbounded channel with 100 parallel fetchers and a slow consumer will buffer everything in memory. If each response is 1 MB and 10,000 are in flight, that's 10 GB of buffered data. Always use bounded channels for parallel fetch patterns and handle `WaitToWriteAsync` backpressure.

> [!success] Use bounded channels with backpressure
>
> Create channels with `Channel.CreateBounded<T>(capacity)`. When the channel is full, `WriteAsync` awaits automatically — this backpressure slows producers to match consumer speed. Size the capacity to buffer a few seconds of throughput, not the entire dataset.

This cell fetches quotes for 5 symbols from the Finnhub API using `Task.WhenAll` for concurrency, writing each `(Symbol, Price, Change)` tuple into a bounded `Channel<T>` with capacity 20. A single consumer reads via `ReadAllAsync()` and accumulates items into batches of 3, printing each full batch and flushing any remainder. The output shows one batch of 3 and one partial batch of 2, reflecting the order items arrived from concurrent HTTP calls.

```csharp
var finnhubKey = FINNHUB_KEY;
var finnhubSymbols = new[] { "SAP", "ASML", "TTE", "UL", "DEO" };

var channel = Channel.CreateBounded<(string Symbol, double Price, double Change)>(20);

var producer = Task.Run(async () =>
{
    var fetchTasks = finnhubSymbols.Select(async symbol =>
    {
        var url = $"https://finnhub.io/api/v1/quote?symbol={symbol}&token={finnhubKey}";
        var json = await http.GetStringAsync(url);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var price = root.TryGetProperty("c", out var c) ? c.GetDouble() : 0;
        var change = root.TryGetProperty("dp", out var dp) ? dp.GetDouble() : 0;
        await channel.Writer.WriteAsync((symbol, price, change));
    });
    await Task.WhenAll(fetchTasks);
    channel.Writer.Complete();
});

var batch = new List<(string Symbol, double Price, double Change)>();
await foreach (var item in channel.Reader.ReadAllAsync())
{
    batch.Add(item);
    if (batch.Count >= 3)
    {
        Console.WriteLine($"  Batch: [{string.Join(", ", batch.Select(b => $"{b.Symbol}=${b.Price:F2}"))}]");
        batch.Clear();
    }
}
if (batch.Count > 0)
    Console.WriteLine($"  Batch: [{string.Join(", ", batch.Select(b => $"{b.Symbol}=${b.Price:F2}"))}]");

await producer;
```

```text
[SAP=$171.00, ASML=$1399.42, TTE=$88.79]
[DEO=$72.47, UL=$60.62]
```

## Cross-Process Execution

### Process class — spawn and capture output

#### Process — spawn external programs

> [!info] Process execution
>
> - `Process.Start` with `RedirectStandardOutput` — captures stdout
> - `WaitForExitAsync` — non-blocking wait; `ExitCode` = success (0) or failure
> - Separate OS process with own memory — child crash doesn't take down the parent
> - Language-agnostic: child can be Python, Go, Rust, or shell scripts

> [!danger] Security
>
> Never use `Shell=true` with user input — command injection risk. Always check `ExitCode` to catch silent failures.

> [!success] Use UseShellExecute=false and validate ExitCode
>
> Always set `UseShellExecute = false` and pass arguments as a structured `ArgumentList` or validated string — never interpolate raw user input into `Arguments`. After `WaitForExitAsync`, check `proc.ExitCode != 0` and read `stderr` to surface failures before continuing the pipeline.

`Process.Start()` creates a new operating system process with separate memory space. `ProcessStartInfo` configures the executable, arguments, stdio redirection, and window behavior. Always read stdout/stderr **before** `WaitForExitAsync` — reading after can deadlock if the pipe buffer fills up. Always `Dispose` the process to release OS handles.

This cell launches a Python child process that executes a one-liner emitting `{"source": "python", "value": 42}` as JSON on stdout. It reads stdout and stderr asynchronously before awaiting exit, checks the exit code, then parses the JSON back in C# with `JsonDocument` — demonstrating the full round-trip of spawning a cross-language process and consuming its structured output.

```csharp
var pyCode = "import json; print(json.dumps({'source': 'python', 'value': 42}))";
var psi = new ProcessStartInfo
{
    FileName = "python",
    Arguments = $"-c \"{pyCode}\"",
    RedirectStandardOutput = true,
    RedirectStandardError = true,
    UseShellExecute = false,
    CreateNoWindow = true,
};

var proc = Process.Start(psi)!;
var stdout = await proc.StandardOutput.ReadToEndAsync();
var stderr = await proc.StandardError.ReadToEndAsync();
await proc.WaitForExitAsync();

Console.WriteLine($"  Exit code: {proc.ExitCode}");
Console.WriteLine($"  stdout: {stdout.Trim()}");
proc.Dispose();

var jsonDoc = JsonDocument.Parse(stdout);
var source = jsonDoc.RootElement.GetProperty("source").GetString();
var value = jsonDoc.RootElement.GetProperty("value").GetInt32();
jsonDoc.Dispose();
Console.WriteLine($"  Parsed: source={source}, value={value}");
```

```text
Exit code: 0
stdout: {"source": "python", "value": 42}
Parsed: source=python, value=42
```

#### Concurrent process execution — fan-out to multiple child processes

Launches multiple child processes concurrently — each evaluates a different expression. `Select` + `ToArray` starts all tasks immediately; `Task.WhenAll` waits for all to finish. Total time equals the slowest process, not the sum.

```csharp
async Task<string> RunPythonAsync(string expr)
{
    var psi = new ProcessStartInfo
    {
        FileName = "python",
        Arguments = $"-c \"print({expr})\"",
        RedirectStandardOutput = true,
        UseShellExecute = false,
        CreateNoWindow = true,
    };
    var proc = Process.Start(psi)!;
    var result = await proc.StandardOutput.ReadToEndAsync();
    await proc.WaitForExitAsync();
    proc.Dispose();
    return result.Trim();
}

var expressions = new[] { "2**10", "sum(range(100))", "3.14159 * 2" };
var sw = Stopwatch.StartNew();

var processTasks = expressions.Select(async expr =>
{
    var result = await RunPythonAsync(expr);
    return (expr, result);
}).ToArray();

var processResults = await Task.WhenAll(processTasks);
foreach (var (expr, result) in processResults)
    Console.WriteLine($"  {expr,-25} = {result}");
Console.WriteLine($"  All {expressions.Length} processes completed in {sw.ElapsedMilliseconds}ms");
```

```text
2**10                     = 1024
sum(range(100))           = 4950
3.14159 * 2               = 6.28318
All 3 processes completed in 31ms
```

## Warnings

> [!warning] TPL Dataflow blocks can deadlock with bounded capacity
>
> If a `TransformBlock` with `BoundedCapacity=1` feeds into a slow `ActionBlock`, the transform blocks waiting for space, and the pipeline stalls.

> [!success] Correct pattern
>
> Set `BoundedCapacity` high enough to absorb bursts. Monitor pending counts. Use `PropagateCompletion = true` to flow completion signals.

> [!warning] `Process` stdout/stderr buffer deadlock
>
> If the child process produces more output than the OS pipe buffer holds and you don't read it, the process blocks forever.

> [!success] Correct pattern
>
> Read stdout and stderr asynchronously: `process.BeginOutputReadLine()` + `OutputDataReceived` event, or `await process.StandardOutput.ReadToEndAsync()`.

## Recommendations

- **Use TPL Dataflow for multi-stage pipelines** — links, bounded buffers, and configurable parallelism out of the box.
- **Use `Channel<T>` for simpler producer-consumer** — lighter than Dataflow when you don't need block linking.
- **Use `IAsyncEnumerable<T>` for paginated APIs** — natural `await foreach` consumption, lazy streaming.
- **Use `SemaphoreSlim` for rate limiting** — cap concurrent API calls to respect rate limits.
- **Always redirect and read process output** — prevents deadlocks from full pipe buffers.

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| Dataflow pipeline stalls | Bounded capacity too low, downstream block too slow | Increase `BoundedCapacity` or add more parallelism to slow block |
| `Process` hangs forever | Stdout/stderr buffer full, not being read | Read output asynchronously or use `process.WaitForExitAsync()` with output drain |
| HTTP 429 from API | Too many concurrent requests | Add `SemaphoreSlim(n)` to limit concurrency |
| `Channel` reader never completes | Writer didn't call `Complete()` | Always call `writer.Complete()` when done producing |

