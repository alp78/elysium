---
type: reference
category: programming-languages
technology: [csharp, dotnet]
tags: [csharp, pipeline]
aliases: [advanced pipelines, TPL Dataflow, channels, IAsyncEnumerable, cross-process]
keywords: [TPL Dataflow, TransformBlock, ActionBlock, BatchBlock, Channel, IAsyncEnumerable, SemaphoreSlim, Process, rate limiting, parallel API, concurrent pipeline]
description: "C# advanced parallel pipelines reference with executable examples and cell outputs — covers TPL Dataflow, Channel-based batching, IAsyncEnumerable for paginated APIs, rate-limited parallel fetch, and cross-process execution. See [13_py_advancedpipelines](https://alp78.github.io/elysium/02-Programming-Languages/Python/13_py_advancedpipelines) for the Python equivalent."
created: 2026-03-25
updated: 2026-03-25
status: complete
---

# 13. Advanced Parallel Pipelines - C#

> [!quote]
> "The combination of threads, remote-procedure-call interfaces, and heavyweight object-oriented design is especially dangerous. If you are ever invited onto a project that is supposed to feature all three, fleeing in terror might well be an appropriate reaction."
> — **Eric S. Raymond**

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

#### Imports and warning suppression

```csharp
// Imports — namespaces for dataflow, HTTP, JSON, channels, and diagnostics

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

#### API keys from environment variables

```csharp
// API keys from environment — .env file loading for secrets

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

      TWELVE_DATA_KEY: 70bed658...
      FRED_KEY:        16f307ff...
      FINNHUB_KEY:     d63iuhhr...

## TPL Dataflow

#### TransformBlock and ActionBlock

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

```csharp
// TPL Dataflow — build multi-stage concurrent pipelines with independent concurrency per stage
//
// WHAT: System.Threading.Tasks.Dataflow provides blocks that process items concurrently.
//   - TransformBlock<TIn, TOut>: takes input, produces output (like Select but concurrent)
//   - ActionBlock<T>: terminal consumer — processes items with no output (like ForEach)
//   - Blocks are linked together: data flows from one block to the next automatically
//
// WHY: each stage can have different concurrency limits. A 3-stage pipeline:
//   Fetch (IO, 3 concurrent) → Parse (CPU, 2 concurrent) → Save (IO, 1 sequential)
//   Without Dataflow you'd need manual Channel wiring, thread management, backpressure.
//
// WHEN TO USE: multi-stage ETL, parallel API ingestion, fan-out/fan-in processing
// ANTI-PATTERNS:
//   - Don't forget PropagateCompletion — without it, downstream blocks never finish
//   - Don't use unbounded parallelism (default) — set MaxDegreeOfParallelism explicitly
//   - Don't call .Wait() or .Result on blocks — use await (deadlock risk)

// Stage 1: Fetch — IO-bound work, 3 concurrent requests
// TransformBlock<string, (string, double)>: input = symbol name, output = (symbol, price) tuple
var fetchBlock = new TransformBlock<string, (string Symbol, double Price)>(
    async symbol =>
    {
        await Task.Delay(100); // simulate API latency
        var price = 100.0 + new Random(symbol.GetHashCode()).NextDouble() * 200;
        Console.WriteLine($"  [fetch] {symbol}: ${price:F2}");
        return (symbol, Math.Round(price, 2));
    },
    // ExecutionDataflowBlockOptions controls how the block runs
    new ExecutionDataflowBlockOptions { MaxDegreeOfParallelism = 3 }); // max 3 fetches at once

// Stage 2: Format — CPU-bound transformation, 2 concurrent
var formatBlock = new TransformBlock<(string Symbol, double Price), string>(
    input =>
    {
        var (symbol, price) = input;
        var arrow = (price > 200) ? "▲" : "▼";
        return $"{symbol}: ${price:F2} {arrow}";
    },
    new ExecutionDataflowBlockOptions { MaxDegreeOfParallelism = 2 });

// Stage 3: Print — ActionBlock is a terminal consumer (no output, just side effects)
var printBlock = new ActionBlock<string>(
    msg => Console.WriteLine($"  [result] {msg}"));

// Link blocks: fetch → format → print
// PropagateCompletion = true: when fetchBlock completes, formatBlock auto-completes too
// Without this, downstream blocks wait forever for more input
fetchBlock.LinkTo(formatBlock, new DataflowLinkOptions { PropagateCompletion = true });
formatBlock.LinkTo(printBlock, new DataflowLinkOptions { PropagateCompletion = true });

// Post items into the head of the pipeline — non-blocking, returns immediately
var symbols = new[] { "SAP", "ASML", "TTE", "UL", "DEO", "SNY", "NVS", "AZN" };
foreach (var s in symbols)
    fetchBlock.Post(s); // Post returns bool (false if block is full/completed)

// Signal no more input, then wait for the entire pipeline to drain
fetchBlock.Complete();           // tells fetchBlock: no more items coming
await printBlock.Completion;     // waits until the LAST block finishes all work
Console.WriteLine("  Pipeline complete.");
```

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

#### BatchBlock — size-bounded batching

```csharp
// BatchBlock — collect individual items into fixed-size arrays

var batchBlock = new BatchBlock<string>(3); // emit arrays of 3

var batchConsumer = new ActionBlock<string[]>(
    batch => Console.WriteLine($"  Batch of {batch.Length}: [{string.Join(", ", batch)}]"));

batchBlock.LinkTo(batchConsumer, new DataflowLinkOptions { PropagateCompletion = true });

// Post 8 items → 2 full batches of 3 + 1 partial batch of 2 (flushed on Complete)
foreach (var item in new[] { "A", "B", "C", "D", "E", "F", "G", "H" })
    batchBlock.Post(item);

batchBlock.Complete(); // flushes the remaining 2 items as a partial batch
await batchConsumer.Completion;
Console.WriteLine("  All batches processed.");
```

      Batch of 3: [A, B, C]
      Batch of 3: [D, E, F]
      Batch of 2: [G, H]
      All batches processed.

#### TPL Dataflow — multi-stage pipeline with real API

```csharp
// Multi-stage pipeline with real API — Fetch → Parse → Display

var apiKey = TWELVE_DATA_KEY;

// Stage 1: Fetch — async HTTP call, max 2 concurrent to respect Twelve Data rate limits
var fetchStage = new TransformBlock<string, (string Symbol, string Json)>(
    async symbol =>
    {
        var url = $"https://api.twelvedata.com/quote?symbol={symbol}&apikey={apiKey}";
        var json = await http.GetStringAsync(url);
        return (symbol, json);
    },
    new ExecutionDataflowBlockOptions { MaxDegreeOfParallelism = 2 });

// Stage 2: Parse — synchronous CPU work, extract fields from JSON
var parseStage = new TransformBlock<(string Symbol, string Json), (string Symbol, double Price, double Change)>(
    input =>
    {
        using var doc = JsonDocument.Parse(input.Json);
        var root = doc.RootElement;
        var price = root.TryGetProperty("close", out var p) ? double.Parse(p.GetString() ?? "0") : 0;
        var change = root.TryGetProperty("percent_change", out var c) ? double.Parse(c.GetString() ?? "0") : 0;
        return (input.Symbol, price, change);
    });

// Stage 3: Display — ActionBlock terminal consumer
var resultStage = new ActionBlock<(string Symbol, double Price, double Change)>(
    r => Console.WriteLine($"  {r.Symbol,-6} ${r.Price,8:F2}  {r.Change:F2}%"));

// Wire the pipeline — PropagateCompletion cascades Complete() through the chain
fetchStage.LinkTo(parseStage, new DataflowLinkOptions { PropagateCompletion = true });
parseStage.LinkTo(resultStage, new DataflowLinkOptions { PropagateCompletion = true });

var sw = Stopwatch.StartNew();
foreach (var sym in new[] { "SAP", "ASML", "TTE", "UL" })
    fetchStage.Post(sym);

fetchStage.Complete();
await resultStage.Completion;
Console.WriteLine($"  Done in {sw.ElapsedMilliseconds}ms");
```

      SAP    $    0.00  0.00%
      ASML   $    0.00  0.00%
      TTE    $    0.00  0.00%
      UL     $    0.00  0.00%
      Done in 260ms

## Parallel API Ingestion

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

```csharp
// Parallel fetch with SemaphoreSlim rate limiting
//
// WHAT: SemaphoreSlim(n) limits how many tasks can run a critical section concurrently.
//   WaitAsync() blocks if n tasks are already inside; Release() lets the next one in.
//   ConcurrentBag<T> is a thread-safe unordered collection for collecting results.
//
// WHY: APIs have rate limits (e.g., 8 requests/minute). Without throttling, all 8
//   requests fire simultaneously → API returns 429 Too Many Requests → data loss.
//   SemaphoreSlim(3) ensures at most 3 concurrent requests at any time.
//
// WHEN TO USE: any parallel I/O with rate limits — API calls, DB connections, file handles
// ANTI-PATTERNS:
//   - Don't forget Release() in finally — a crash without release = permanent deadlock
//   - Don't use SemaphoreSlim for CPU-bound work — use Parallel.ForEachAsync instead
//   - Don't create one SemaphoreSlim per call — share ONE across all concurrent tasks
var tdSymbols = new[] { "SAP", "ASML", "TTE", "UL", "DEO", "SNY", "NVS", "AZN" };
var tdKey = TWELVE_DATA_KEY;

// SemaphoreSlim(3): allow max 3 HTTP requests in flight at once
var semaphore = new SemaphoreSlim(3);
// ConcurrentBag: thread-safe collection — multiple tasks Add() simultaneously without locks
var results = new ConcurrentBag<(string Symbol, double Price)>();

var sw = Stopwatch.StartNew();
var tasks = tdSymbols.Select(async symbol =>
{
    await semaphore.WaitAsync(); // blocks here if 3 tasks are already inside
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
    finally { semaphore.Release(); } // ALWAYS release — even if the request throws
}).ToArray();

await Task.WhenAll(tasks);
Console.WriteLine($"\n  Fetched {results.Count} quotes in {sw.ElapsedMilliseconds}ms (3 concurrent max)");
```

      ASML   $    0.00  (108ms)
      SAP    $    0.00  (109ms)
      TTE    $    0.00  (139ms)
      UL     $    0.00  (216ms)
      DEO    $    0.00  (224ms)
      SNY    $    0.00  (258ms)
      NVS    $    0.00  (325ms)
      AZN    $    0.00  (332ms)
    
      Fetched 8 quotes in 332ms (3 concurrent max)

#### IAsyncEnumerable for paginated FRED API

```csharp
// IAsyncEnumerable for paginated APIs — stream pages without buffering all

var fredKey = FRED_KEY;

async IAsyncEnumerable<(string Id, string Title)> FetchFredSeriesAsync(
    string searchText, int limit = 10,
    [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct = default)
{
    int offset = 0;
    int pageSize = 5;   // small pages to demonstrate pagination
    int yielded = 0;

    while (yielded < limit)
    {
        // Fetch one page from FRED API
        var url = $"https://api.stlouisfed.org/fred/series/search?search_text={searchText}" +
                  $"&api_key={fredKey}&file_type=json&limit={pageSize}&offset={offset}";
        var json = await http.GetStringAsync(url, ct);
        using var doc = JsonDocument.Parse(json);

        if (!doc.RootElement.TryGetProperty("seriess", out var seriess)) yield break;

        var items = seriess.EnumerateArray().ToList();
        if (items.Count == 0) yield break; // no more pages

        // Yield each item individually — consumer sees them one at a time
        foreach (var item in items)
        {
            if (yielded >= limit) yield break; // early stop if limit reached
            var id = item.GetProperty("id").GetString() ?? "";
            var title = item.GetProperty("title").GetString() ?? "";
            yield return (id, title);  // pause here, resume when consumer calls MoveNextAsync()
            yielded++;
        }
        offset += pageSize; // next page
    }
}

// await foreach — consume the stream as items arrive (pull-based)
Console.WriteLine("  FRED series matching 'GDP':");
await foreach (var (id, title) in FetchFredSeriesAsync("GDP", limit: 8))
{
    Console.WriteLine($"    {id,-20} {title[..Math.Min(title.Length, 50)]}");
}
```

      FRED series matching 'GDP':
        GFDEGDQ188S          Federal Debt: Total Public Debt as Percent of Gros
        FYFSGDA188S          Federal Surplus or Deficit [-] as Percent of Gross
        FYFSDFYGDP           Federal Surplus or Deficit [-] as Percent of Gross
        GDP                  Gross Domestic Product
        FYONGDA188S          Federal Net Outlays as Percent of Gross Domestic P
        GFDGDPA188S          Gross Federal Debt as Percent of Gross Domestic Pr
        FYOIGDA188S          Federal Outlays: Interest as Percent of Gross Dome
        FYFRGDA188S          Federal Receipts as Percent of Gross Domestic Prod

#### Parallel fetch with Channel batching

```csharp
// Channel with parallel producers and batching consumer

var finnhubKey = FINNHUB_KEY;
var finnhubSymbols = new[] { "SAP", "ASML", "TTE", "UL", "DEO" };

// BoundedChannel(20): max 20 items buffered; producers wait if channel is full
var channel = Channel.CreateBounded<(string Symbol, double Price, double Change)>(20);

// Producer: fetch all symbols concurrently, write each result to the channel
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
        await channel.Writer.WriteAsync((symbol, price, change)); // async write to channel
    });
    await Task.WhenAll(fetchTasks);
    channel.Writer.Complete(); // signal: no more items will be written
});

// Consumer: read from channel as items arrive, batch into groups of 3
var batch = new List<(string Symbol, double Price, double Change)>();
await foreach (var item in channel.Reader.ReadAllAsync()) // stops when channel is complete + drained
{
    batch.Add(item);
    if (batch.Count >= 3) // flush batch when it reaches target size
    {
        Console.WriteLine($"  Batch: [{string.Join(", ", batch.Select(b => $"{b.Symbol}=${b.Price:F2}"))}]");
        batch.Clear();
    }
}
// Flush the remaining partial batch
if (batch.Count > 0)
    Console.WriteLine($"  Batch: [{string.Join(", ", batch.Select(b => $"{b.Symbol}=${b.Price:F2}"))}]");

await producer; // ensure producer completed without exceptions
```

      Batch: [SAP=$171.00, ASML=$1399.42, TTE=$88.79]
      Batch: [DEO=$72.47, UL=$60.62]

## Cross-Process Execution

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

```csharp
// System.Diagnostics.Process — spawn a child OS process, capture its output
//
// WHAT: Process.Start() creates a new operating system process (separate memory space).
//   ProcessStartInfo configures: executable, arguments, stdio redirection, window behavior.
//   RedirectStandardOutput = true: stdout goes to a pipe you can read from C#.
//   UseShellExecute = false: required for stdio redirection (no shell involved).
//
// WHY: strict memory isolation — a crash in the child doesn't take down the parent.
//   Use when: invoking Python/R scripts from a C# pipeline, running CLI tools (gcloud, bq),
//   executing untrusted code safely, launching crash-resilient worker processes.
//
// ANTI-PATTERNS:
//   - Don't read stdout AFTER WaitForExit — can deadlock if the pipe buffer fills up.
//     Always read stdout/stderr BEFORE WaitForExitAsync.
//   - Don't forget to Dispose the Process — leaks OS handles.
//   - Don't pass user input directly into Arguments without sanitization — command injection risk.
var pyCode = "import json; print(json.dumps({'source': 'python', 'value': 42}))";
var psi = new ProcessStartInfo
{
    FileName = "python",                      // executable to run
    Arguments = $"-c \"{pyCode}\"",           // -c = run this code string
    RedirectStandardOutput = true,            // capture stdout as a stream
    RedirectStandardError = true,             // capture stderr too
    UseShellExecute = false,                  // required for redirection
    CreateNoWindow = true,                    // don't open a console window
};

var proc = Process.Start(psi)!;
// Read stdout/stderr FIRST, then wait — prevents deadlock on full pipe buffer
var stdout = await proc.StandardOutput.ReadToEndAsync();
var stderr = await proc.StandardError.ReadToEndAsync();
await proc.WaitForExitAsync();

Console.WriteLine($"  Exit code: {proc.ExitCode}");
Console.WriteLine($"  stdout: {stdout.Trim()}");
proc.Dispose(); // release OS process handle

// Parse the structured JSON output from the Python process
var jsonDoc = JsonDocument.Parse(stdout);
var source = jsonDoc.RootElement.GetProperty("source").GetString();
var value = jsonDoc.RootElement.GetProperty("value").GetInt32();
jsonDoc.Dispose();
Console.WriteLine($"  Parsed: source={source}, value={value}");
```

      Exit code: 0
      stdout: {"source": "python", "value": 42}
      Parsed: source=python, value=42

#### Concurrent process execution

```csharp
// Concurrent process execution — fan-out to multiple child processes

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
    var result = await proc.StandardOutput.ReadToEndAsync(); // read before wait
    await proc.WaitForExitAsync();
    proc.Dispose();
    return result.Trim();
}

// Launch 3 Python processes concurrently — each evaluates a different expression
var expressions = new[] { "2**10", "sum(range(100))", "3.14159 * 2" };
var sw = Stopwatch.StartNew();

// Select + ToArray starts all tasks immediately; WhenAll waits for all to finish
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

      2**10                     = 1024
      sum(range(100))           = 4950
      3.14159 * 2               = 6.28318
      All 3 processes completed in 31ms
