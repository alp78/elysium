---
tags: [csharp, pipeline]
aliases: [advanced pipelines, TPL Dataflow, channels, IAsyncEnumerable, cross-process]
description: "C# advanced parallel pipelines reference with executable examples and cell outputs — covers TPL Dataflow, Channel-based batching, IAsyncEnumerable for paginated APIs, rate-limited parallel fetch, and cross-process execution. See [13_py_advancedpipelines](https://alp78.github.io/elysium/02-Programming-Languages/Python/13_py_advancedpipelines) for the Python equivalent."
created: 2026-03-25
updated: 2026-04-04
status: complete
---

# 13. Advanced Parallel Pipelines - C#

> [!quote]
> "The combination of threads, remote-procedure-call interfaces, and heavyweight object-oriented design is especially dangerous. If you are ever invited onto a project that is supposed to feature all three, fleeing in terror might well be an appropriate reaction."
>
> — **Eric S. Raymond**, *The Art of Unix Programming* (2003)

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
    F["TransformBlock\nFetch (3 concurrent)"] --> P["TransformBlock\nFormat (2 concurrent)"]
    P --> A["ActionBlock\nPrint (1 sequential)"]
    style F fill:#292e42,stroke:#565f89
    style P fill:#292e42,stroke:#565f89
    style A fill:#292e42,stroke:#565f89
```

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
