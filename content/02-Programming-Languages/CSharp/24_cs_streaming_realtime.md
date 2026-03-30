---
type: reference
category: programming-languages
technology: [csharp, dotnet, gcp]
tags: [csharp, gcp, pipeline, streaming]
aliases: [Streaming CSharp, Real-Time Data CSharp, WebSocket, SSE, Pub/Sub]
keywords: [streaming, real-time, WebSocket, SSE, server-sent events, Pub/Sub, Firestore listener, ClientWebSocket, HttpClient, latency, throughput, MFT, Transfer Service]
description: "C# streaming and real-time data reference — WebSocket, SSE, Pub/Sub, Firestore listeners, and latency benchmarks. See [24_py_streaming_realtime](https://alp78.github.io/elysium/02-Programming-Languages/Python/24_py_streaming_realtime) for the Python equivalent."
created: 2026-03-28
updated: 2026-03-28
status: complete
---

# 24. Streaming & Real-Time Data — WebSocket, SSE, Pub/Sub, Firestore

> [!quote]
> "The best way to predict the future is to invent it."
> — **Alan Kay**

### Technologies Overview

| Technology | Protocol | Direction | Latency | Use Case |
|------------|----------|-----------|---------|----------|
| **WebSocket** | TCP (upgrade from HTTP) | Full-duplex (bi-directional) | Sub-ms to ~10ms | Live trading, gaming, collaborative editing |
| **SSE (Server-Sent Events)** | HTTP/1.1 long-lived | Server → Client only | ~10-50ms | Dashboards, notifications, AI chat streaming |
| **Google Cloud Pub/Sub** | gRPC | Decoupled (pub/sub) | 50-200ms | Event-driven pipelines, microservices, IoT |
| **Firestore Listener** | gRPC (bi-directional stream) | Server → Client push | 100-500ms | Mobile sync, live dashboards, cache invalidation |

**WebSocket** opens a persistent TCP connection where both sides can send messages at any time — the lowest-latency option.

**SSE** is a simpler one-way alternative: the server holds an HTTP connection open and pushes `text/event-stream` lines.

**Pub/Sub** is a managed message bus — publishers and subscribers are fully decoupled. Messages are durably stored until acknowledged.

**Firestore Listener** uses gRPC bidirectional streaming. The server pushes document-level change events as they happen.

```csharp
// Suppress CS1701/CS1702 assembly version warnings in .NET Interactive.
using System.Reflection;
using Microsoft.DotNet.Interactive;
using Microsoft.DotNet.Interactive.CSharp;

var csharpKernel = (CSharpKernel)Kernel.Root.FindKernelByName("csharp");
var optionsField = typeof(CSharpKernel).GetField("_scriptOptions",
    BindingFlags.NonPublic | BindingFlags.Instance);
var scriptOptions = optionsField.GetValue(csharpKernel);
var withWarningLevel = scriptOptions.GetType().GetMethod("WithWarningLevel");
var newOptions = withWarningLevel.Invoke(scriptOptions, new object[] { 0 });
optionsField.SetValue(csharpKernel, newOptions);
```

```csharp
#r "nuget: DotNetEnv"
#r "nuget: Google.Cloud.PubSub.V1"
#r "nuget: Google.Cloud.Firestore"
#r "nuget: Microsoft.Bcl.AsyncInterfaces, 9.0.5"
#r "nuget: Newtonsoft.Json"
#r "nuget: Plotly.NET, 5.1.0"
#r "nuget: Plotly.NET.Interactive, 5.0.0"
#r "nuget: Plotly.NET.CSharp, 0.13.0"

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using DotNetEnv;
using Google.Cloud.Firestore;
using Google.Cloud.PubSub.V1;
using Newtonsoft.Json;
using Plotly.NET;
using Plotly.NET.CSharp;
using Plotly.NET.LayoutObjects;
```

```csharp
// Set Windows timer resolution to 1ms (default is 15.6ms)
// Without this, Task.Delay(10) rounds to 15.6ms on Windows.
[System.Runtime.InteropServices.DllImport("winmm.dll")]
static extern uint timeBeginPeriod(uint period);
[System.Runtime.InteropServices.DllImport("winmm.dll")]
static extern uint timeEndPeriod(uint period);
timeBeginPeriod(1);

// Load .env and define project constants
DotNetEnv.Env.Load();

var PROJECT_ID   = "seclab-dev-ap-26";
var REGION       = "europe-west1";
var BUCKET_NAME  = $"{PROJECT_ID}-data";
var FIRESTORE_DB = "seclab-scores";
var SA_KEY_PATH  = Environment.GetEnvironmentVariable("GCP_SA_KEY_PATH") ?? "./gcp-sa-key.json";

Environment.SetEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS", SA_KEY_PATH);

var publisher  = await new PublisherServiceApiClientBuilder().BuildAsync();
var subscriber = await new SubscriberServiceApiClientBuilder().BuildAsync();
var fsDb       = new FirestoreDbBuilder { ProjectId = PROJECT_ID, DatabaseId = FIRESTORE_DB }.Build();

Console.WriteLine($"  Project:   {PROJECT_ID}");
Console.WriteLine($"  Firestore: {FIRESTORE_DB}");
```

      Project:   seclab-dev-ap-26
      Firestore: seclab-scores

#### Formatting helpers

```csharp
string FmtTime(double ms)
{
    if (ms < 1) return $"{ms * 1000:F0}µs";
    if (ms < 1000) return $"{ms:F0}ms";
    if (ms < 60_000) return $"{ms / 1000:F1}s";
    var m = (int)(ms / 60_000); var s = (ms % 60_000) / 1000;
    return s == 0 ? $"{m}min" : $"{m}m{s:F0}s";
}

string FmtRate(int n, double ms)
{
    if (ms <= 0) return "-";
    var rate = n / (ms / 1000.0);
    if (rate < 1000) return $"{rate:F0} msg/s";
    if (rate < 1_000_000) return $"{rate / 1000:F1}K msg/s";
    return $"{rate / 1_000_000:F1}M msg/s";
}
```

#### Simulated OHLCV tick generator

Generates synthetic tick data for 5 symbols — used as the data source for all streaming patterns below.

```csharp
// Simulated tick generator — produces OHLCV-like ticks with realistic price movement
var SYMBOLS = new[] { "ASML.AS", "SAP.DE", "SIE.DE", "MC.PA", "TTE.PA" };
var rng = new Random();
var prices = SYMBOLS.ToDictionary(s => s, s => 50.0 + rng.NextDouble() * 850);

Dictionary<string, object> GenerateTick()
{
    var symbol = SYMBOLS[rng.Next(SYMBOLS.Length)];
    var price = prices[symbol];
    var change = price * (rng.NextDouble() * 0.004 - 0.002);
    prices[symbol] = price + change;
    return new Dictionary<string, object>
    {
        ["symbol"] = symbol,
        ["timestamp"] = DateTime.UtcNow.ToString("o"),
        ["price"] = Math.Round(prices[symbol], 4),
        ["volume"] = rng.Next(100, 10_000),
        ["bid"] = Math.Round(prices[symbol] - rng.NextDouble() * 0.5, 4),
        ["ask"] = Math.Round(prices[symbol] + rng.NextDouble() * 0.5, 4),
    };
}

// Preview
for (int i = 0; i < 3; i++)
{
    var tick = GenerateTick();
    Console.WriteLine($"  {tick["symbol"],-8} {tick["price"],10} vol={tick["volume"]}");
}
```

      ASML.AS    494.3035 vol=327
      MC.PA      231.8838 vol=2458
      TTE.PA      832.032 vol=1651

## WebSocket Streaming

Full-duplex, persistent TCP connection. The server pushes ticks as they occur — no polling.
Used by every real-time trading platform (Binance, Bloomberg Terminal, Refinitiv).

#### Run WebSocket server and client for simulated tick feed using System.Net.WebSockets over TCP

Starts a local `HttpListener` WebSocket server in a background thread that broadcasts ticks at ~100 msg/s.
The client connects, receives ticks for 3 seconds, and collects them.

**Scenario:** Real-time price dashboards, algorithmic trading, live order book feeds.
**When NOT to use:** One-shot request/response — use REST instead.

```csharp
// WebSocket server — broadcasts ticks with embedded send_ts for one-way latency
var WS_PORT = 8775;
var wsRunning = true;
var wsListener = new HttpListener();
wsListener.Prefixes.Add($"http://localhost:{WS_PORT}/");
wsListener.Start();

_ = Task.Run(async () =>
{
    while (wsRunning)
    {
        var ctx = await wsListener.GetContextAsync();
        if (!ctx.Request.IsWebSocketRequest) { ctx.Response.StatusCode = 400; ctx.Response.Close(); continue; }
        var wsCtx = await ctx.AcceptWebSocketAsync(null);
        _ = Task.Run(async () =>
        {
            var ws = wsCtx.WebSocket;
            while (ws.State == WebSocketState.Open && wsRunning)
            {
                var tickData = GenerateTick();
                tickData["send_ts"] = Stopwatch.GetTimestamp();
                var tick = JsonConvert.SerializeObject(tickData);
                var bytes = System.Text.Encoding.UTF8.GetBytes(tick);
                await ws.SendAsync(bytes, WebSocketMessageType.Text, true, CancellationToken.None);
                await Task.Delay(10);
            }
        });
    }
});
Console.WriteLine($"  WebSocket server running on ws://localhost:{WS_PORT}");
```

      WebSocket server running on ws://localhost:8775

#### WebSocket streaming client — receive ticks for 3 seconds

```csharp
// WebSocket client — one-way latency (send_ts embedded by server)
var NUM_WS = 1_000;
var WARMUP_WS = 100;
var wsLatUs = new List<double>(NUM_WS);
var wsClient = new ClientWebSocket();
await wsClient.ConnectAsync(new Uri($"ws://localhost:{WS_PORT}"), CancellationToken.None);

var buffer = new byte[4096];
var freq = (double)Stopwatch.Frequency;
int wsCount = 0;

// Warmup + measurement in single loop
GC.Collect(); GC.WaitForPendingFinalizers(); GC.Collect();
while (wsLatUs.Count < NUM_WS)
{
    var result = await wsClient.ReceiveAsync(buffer, CancellationToken.None);
    var recvTs = Stopwatch.GetTimestamp();
    wsCount++;
    if (wsCount <= WARMUP_WS) continue;
    var msg = System.Text.Encoding.UTF8.GetString(buffer, 0, result.Count);
    var tick = JsonConvert.DeserializeObject<Dictionary<string, object>>(msg)!;
    var sendTs = Convert.ToInt64(tick["send_ts"]);
    wsLatUs.Add((recvTs - sendTs) / freq * 1_000_000);
}

wsRunning = false;
wsClient.Abort();
wsListener.Stop();

wsLatUs.Sort();
var wsP50 = wsLatUs[wsLatUs.Count / 2];
var wsP99 = wsLatUs[(int)(wsLatUs.Count * 0.99)];
Console.WriteLine($"  {wsLatUs.Count} one-way measurements");
Console.WriteLine($"  p50: {wsP50:F0}µs  p99: {wsP99:F0}µs");
```

      1000 one-way measurements
      p50: 69µs  p99: 158µs

## Server-Sent Events (SSE)

One-directional server→client push over HTTP. Simpler than WebSocket — works through
proxies/CDNs, auto-reconnects, text-only. Used by ChatGPT, GitHub notifications, stock tickers.

#### Run SSE server and client for simulated tick feed using HttpListener over HTTP

Starts a local HttpListener SSE server that streams ticks as `text/event-stream`.

**Scenario:** Live dashboards, notification feeds, AI chat token streaming.
**When NOT to use:** Bi-directional communication — use WebSocket. Binary data — use gRPC.

```csharp
// SSE server — streams ticks with embedded send_ts as text/event-stream
var SSE_PORT = 8776;
var sseRunning = true;
var sseListener = new HttpListener();
sseListener.Prefixes.Add($"http://localhost:{SSE_PORT}/");
sseListener.Start();

_ = Task.Run(async () =>
{
    while (sseRunning)
    {
        try
        {
            var ctx = await sseListener.GetContextAsync();
            ctx.Response.ContentType = "text/event-stream";
            ctx.Response.Headers.Add("Cache-Control", "no-cache");
            var output = ctx.Response.OutputStream;
            _ = Task.Run(async () =>
            {
                try
                {
                    while (sseRunning)
                    {
                        var tickData = GenerateTick();
                        tickData["send_ts"] = Stopwatch.GetTimestamp();
                        var tick = JsonConvert.SerializeObject(tickData);
                        var data = System.Text.Encoding.UTF8.GetBytes($"data: {tick}\n\n");
                        await output.WriteAsync(data);
                        await output.FlushAsync();
                        await Task.Delay(10);
                    }
                }
                catch { /* client disconnected */ }
            });
        }
        catch { if (!sseRunning) break; }
    }
});
Console.WriteLine($"  SSE server running on http://localhost:{SSE_PORT}");
```

      SSE server running on http://localhost:8776

#### SSE client — receive ticks for 3 seconds

```csharp
// SSE client — one-way latency (send_ts embedded by server)
var NUM_SSE = 1_000;
var WARMUP_SSE = 100;
var sseLatUs = new List<double>(NUM_SSE);
var httpClient = new HttpClient();
var stream = await httpClient.GetStreamAsync($"http://localhost:{SSE_PORT}");
var reader = new StreamReader(stream);
var freq2 = (double)Stopwatch.Frequency;

int sseCount = 0;
GC.Collect(); GC.WaitForPendingFinalizers(); GC.Collect();
while (sseLatUs.Count < NUM_SSE)
{
    var line = await reader.ReadLineAsync();
    var recvTs = Stopwatch.GetTimestamp();
    sseCount++;
    if (sseCount <= WARMUP_SSE) continue;
    if (line != null && line.StartsWith("data: "))
    {
        var tick = JsonConvert.DeserializeObject<Dictionary<string, object>>(line[6..])!;
        var sendTs = Convert.ToInt64(tick["send_ts"]);
        sseLatUs.Add((recvTs - sendTs) / freq2 * 1_000_000);
    }
}

sseRunning = false;
sseListener.Stop();

sseLatUs.Sort();
var sseP50 = sseLatUs[sseLatUs.Count / 2];
var sseP99 = sseLatUs[(int)(sseLatUs.Count * 0.99)];
Console.WriteLine($"  {sseLatUs.Count} one-way measurements");
Console.WriteLine($"  p50: {sseP50:F0}µs  p99: {sseP99:F0}µs");
```

      1000 one-way measurements
      p50: 58µs  p99: 154µs

## Google Cloud Pub/Sub

Managed message bus with at-least-once delivery, auto-scaling, and dead-letter queues.
Decouples publishers from subscribers — the backbone of event-driven architectures in GCP.

#### Create Pub/Sub topic and subscription

```csharp
// Create topic and subscription (idempotent — skips if exists)
var TOPIC_ID = "tick-feed";
var SUB_ID   = "tick-feed-sub";
var topicName = new TopicName(PROJECT_ID, TOPIC_ID);
var subName   = new SubscriptionName(PROJECT_ID, SUB_ID);

try { publisher.GetTopic(topicName); Console.WriteLine($"  Topic exists: {topicName}"); }
catch { publisher.CreateTopic(topicName); Console.WriteLine($"  Created topic: {topicName}"); }

try { subscriber.GetSubscription(subName); Console.WriteLine($"  Subscription exists: {subName}"); }
catch { subscriber.CreateSubscription(subName, topicName, null, 10); Console.WriteLine($"  Created subscription: {subName}"); }
```

      Topic exists: projects/seclab-dev-ap-26/topics/tick-feed
      Subscription exists: projects/seclab-dev-ap-26/subscriptions/tick-feed-sub

#### Start streaming subscriber using Google.Cloud.PubSub.V1 SubscriberClient over gRPC

Starts the subscriber before publishing so the gRPC stream is established when messages arrive.

```csharp
// Pub/Sub latency: publish 500 messages at steady rate, measure delivery latency
// Uses custom 'send_ts' attribute (same machine clock, no NTP drift).
// Steady rate (~50 msg/s) keeps the pipeline warm.

var NUM_PS = 500;
var WARMUP_PS = 50;
var psLatMs = new ConcurrentBag<double>();
var psCount = 0;
var psDone = new ManualResetEventSlim(false);

// Streaming subscriber callback
var subClient = await new SubscriberClientBuilder { SubscriptionName = subName }.BuildAsync();
var subTask = subClient.StartAsync(async (msg, ct) =>
{
    var recvTime = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() / 1000.0;
    var sendTs = double.Parse(msg.Attributes["send_ts"]);
    var latency = (recvTime - sendTs) * 1000;
    var n = Interlocked.Increment(ref psCount);
    if (n > WARMUP_PS) psLatMs.Add(latency);
    if (psLatMs.Count >= NUM_PS) psDone.Set();
    return SubscriberClient.Reply.Ack;
});
await Task.Delay(2000);

// Publish at steady ~50 msg/s
var pubClient = await new PublisherClientBuilder { TopicName = topicName }.BuildAsync();
var totalPs = WARMUP_PS + NUM_PS;
for (int n = 0; n < totalPs; n++)
{
    var tick = GenerateTick();
    var sendTs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() / 1000.0;
    var data = JsonConvert.SerializeObject(tick);
    await pubClient.PublishAsync(new PubsubMessage
    {
        Data = Google.Protobuf.ByteString.CopyFromUtf8(data),
        Attributes = { ["send_ts"] = sendTs.ToString() },
    });
    await Task.Delay(20); // ~50 msg/s
}
Console.WriteLine($"  Published {totalPs} messages");

psDone.Wait(TimeSpan.FromSeconds(60));
await subClient.StopAsync(CancellationToken.None);

var psSorted = psLatMs.OrderBy(x => x).ToList();
var psAvgLatency = psSorted.Average();
var psP50 = psSorted[psSorted.Count / 2];
var psP99 = psSorted[(int)(psSorted.Count * 0.99)];
Console.WriteLine($"  {psSorted.Count} delivery latency measurements");
Console.WriteLine($"  p50: {psP50:F0}ms  p99: {psP99:F0}ms  avg: {psAvgLatency:F0}ms");
```

      Published 550 messages
      468 delivery latency measurements
      p50: 44ms  p99: 54ms  avg: 43ms

## Firestore Real-Time Listener

Firestore’s `Listen()` pushes document changes to the client in real-time over gRPC.
The same mechanism that powers live sync in Firebase mobile apps and dashboards.

#### Register Firestore real-time listener using Google.Cloud.Firestore Listen over gRPC

Registers a callback on every document change. Runs as a background gRPC stream.

**Scenario:** Live dashboards, mobile sync, cache invalidation.
**When NOT to use:** High-throughput ingestion (>1K writes/s) — use Pub/Sub.

```csharp
// Firestore listener — same measurement pattern as Pub/Sub
var FS_RT_COLLECTION = "realtime_ticks";
var NUM_FS = 500;
var WARMUP_FS = 50;
var fsLatMs = new ConcurrentBag<double>();
var fsCount = 0;
var fsDone = new ManualResetEventSlim(false);

var fsListener = fsDb.Collection(FS_RT_COLLECTION).Listen(snapshot =>
{
    var recvTime = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() / 1000.0;
    foreach (var change in snapshot.Changes)
    {
        if (change.ChangeType == DocumentChange.Type.Added && change.Document.ContainsField("send_ts"))
        {
            var sendTs = change.Document.GetValue<double>("send_ts");
            var latency = (recvTime - sendTs) * 1000;
            var n = Interlocked.Increment(ref fsCount);
            if (n > WARMUP_FS) fsLatMs.Add(latency);
            if (fsLatMs.Count >= NUM_FS) fsDone.Set();
        }
    }
});
await Task.Delay(1000);
Console.WriteLine($"  Listener registered on {FS_RT_COLLECTION}");
```

      Listener registered on realtime_ticks

#### Write documents to Firestore using Google.Cloud.Firestore WriteBatch over gRPC

Writes 100 documents. Each carries a `write_ts` for latency measurement.

```csharp
// Write documents one at a time at steady rate — same pattern as Pub/Sub
var totalFs = WARMUP_FS + NUM_FS;
var colRef = fsDb.Collection(FS_RT_COLLECTION);
for (int n = 0; n < totalFs; n++)
{
    var tick = GenerateTick();
    tick["send_ts"] = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() / 1000.0;
    tick["seq"] = n;
    await colRef.Document($"tick_{n:D4}").SetAsync(tick);
    await Task.Delay(20); // ~50 msg/s
}
Console.WriteLine($"  Wrote {totalFs} documents");
```

      Wrote 550 documents

#### Measure Firestore listener latency from Listen change events over gRPC

Waits for the listener to receive all events, computes write-to-receive latency.

```csharp
// Wait for notifications, compute latency
fsDone.Wait(TimeSpan.FromSeconds(60));
await fsListener.StopAsync();

var fsSorted = fsLatMs.OrderBy(x => x).ToList();
var fsAvgLatency = fsSorted.Count > 0 ? fsSorted.Average() : 0;
var fsP50 = fsSorted.Count > 0 ? fsSorted[fsSorted.Count / 2] : 0;
var fsP99 = fsSorted.Count > 0 ? fsSorted[(int)(fsSorted.Count * 0.99)] : 0;
Console.WriteLine($"  {fsSorted.Count} delivery latency measurements");
Console.WriteLine($"  p50: {fsP50:F0}ms  p99: {fsP99:F0}ms  avg: {fsAvgLatency:F0}ms");
```

      500 delivery latency measurements
      p50: 41ms  p99: 58ms  avg: 41ms

#### Cleanup Firestore real-time collection

```csharp
// Delete test documents
for (int i = 0; i < totalFs; i++)
    await fsDb.Collection(FS_RT_COLLECTION).Document($"tick_{i:D4}").DeleteAsync();
Console.WriteLine($"  Deleted {totalFs} documents");
```

      Deleted 550 documents

## Latency Comparison

Two separate comparisons — local protocols vs GCP managed services — because mixing
localhost (0ms network) with cross-continent GCP (~300ms RTT) would be meaningless.

#### Local protocols — WebSocket vs SSE throughput (localhost, no network)

```csharp
// Local protocols — p50 one-way latency (µs), both measured the same way

var localMethods = new[] { "WebSocket", "SSE" };
var localLatencies = new[] { wsP50, sseP50 };
var localTexts = localLatencies.Select(v => $"{v:F0}µs").ToArray();

Console.WriteLine($"  WebSocket: p50={wsP50:F0}µs  p99={wsP99:F0}µs  ({wsLatUs.Count} msgs)");
Console.WriteLine($"  SSE:       p50={sseP50:F0}µs  p99={sseP99:F0}µs  ({sseLatUs.Count} msgs)");

Plotly.NET.CSharp.Chart.Column<double, string, string>(
    values: localLatencies, Keys: localMethods, Name: "p50 latency",
    MultiText: localTexts, TextPosition: StyleParam.TextPosition.Outside)
.WithTitle("Local Streaming — p50 One-Way Latency (µs, lower = better)")
.WithYAxisStyle(Title.init("Latency (µs)"))
.WithSize(700, 450)
.WithLayout(Layout.init<string>(
    PaperBGColor: Color.fromString("transparent"),
    PlotBGColor: Color.fromString("transparent"),
    Font: Font.init(Color: Color.fromHex("#cccccc")),
    Margin: Margin.init<int, int, int, int, int, int>(Top: 50)))
```

      WebSocket: p50=69µs  p99=158µs  (1000 msgs)
      SSE:       p50=58µs  p99=154µs  (1000 msgs)

<iframe src="/static/plotly/sr_cs_01.html" width="100%" height="500" style="border:none;border-radius:8px;" loading="lazy"></iframe>

#### GCP managed services — Pub/Sub vs Firestore (europe-west1)

```csharp
// Measure raw gRPC RTT to GCP as baseline (Firestore metadata call)
var rttSamples = new List<double>();
for (int r = 0; r < 50; r++)
{
    var t0 = Stopwatch.GetTimestamp();
    await fsDb.Collection("rtt_probe").Limit(1).GetSnapshotAsync();
    var t1 = Stopwatch.GetTimestamp();
    rttSamples.Add((t1 - t0) / (double)Stopwatch.Frequency * 1000); // ms
}
rttSamples.Sort();
var rttP50Ms = rttSamples[rttSamples.Count / 2];
Console.WriteLine($"  gRPC RTT to GCP (50 samples): p50={rttP50Ms:F0}ms");
```

      gRPC RTT to GCP (50 samples): p50=33ms

```csharp
// GCP managed services — total latency and protocol overhead
//
// C# shows the same ~33ms RTT + ~10ms overhead as Python — the GCP service latency
// is network-bound, not language-bound. Both use gRPC under the hood.
// Local WebSocket/SSE differ (C# HTTP.sys kernel vs Python asyncio user-space),
// but GCP latency is identical because the bottleneck is network + server processing.

var psOverheadMs = Math.Max(0, psAvgLatency - rttP50Ms);
var fsOverheadMs = Math.Max(0, fsAvgLatency - rttP50Ms);

Console.WriteLine($"  Network RTT baseline:  {rttP50Ms:F0}ms");
Console.WriteLine($"  Pub/Sub total:         {psAvgLatency:F0}ms  overhead: {psOverheadMs:F0}ms");
Console.WriteLine($"  Firestore total:       {fsAvgLatency:F0}ms  overhead: {fsOverheadMs:F0}ms");

var gcpLabels = new[] { "Pub/Sub", "Firestore" };
var gcpRtt = new[] { rttP50Ms, rttP50Ms };
var gcpOverhead = new[] { psOverheadMs, fsOverheadMs };
var gcpTotals = new[] { psAvgLatency, fsAvgLatency };
var gcpTotalTexts = gcpTotals.Select(v => $"{v:F0}ms").ToArray();

Plotly.NET.CSharp.Chart.Combine(new[] {
    Chart2D.Chart.StackedColumn<double, string, string, string, string>(
        values: gcpRtt, Keys: gcpLabels, Name: "Network RTT",
        MarkerColor: Plotly.NET.Color.fromString("#555")),
    Chart2D.Chart.StackedColumn<double, string, string, string, string>(
        values: gcpOverhead, Keys: gcpLabels, Name: "Protocol overhead",
        MarkerColor: Plotly.NET.Color.fromString("#636EFA"),
        MultiText: gcpTotalTexts, TextPosition: StyleParam.TextPosition.Outside),
})
.WithTitle("GCP Managed Services — Latency Breakdown (ms)")
.WithYAxisStyle(Title.init("Latency (ms)"))
.WithSize(700, 450)
.WithLayout(Layout.init<string>(
    PaperBGColor: Color.fromString("transparent"),
    PlotBGColor: Color.fromString("transparent"),
    Font: Font.init(Color: Color.fromHex("#cccccc")),
    Margin: Margin.init<int, int, int, int, int, int>(Top: 60)))
```

      Network RTT baseline:  33ms
      Pub/Sub total:         43ms  overhead: 10ms
      Firestore total:       41ms  overhead: 8ms

<iframe src="/static/plotly/sr_cs_02.html" width="100%" height="500" style="border:none;border-radius:8px;" loading="lazy"></iframe>

#### Cleanup Pub/Sub resources

```csharp
// Delete subscription and topic
try { subscriber.DeleteSubscription(subName); Console.WriteLine($"  Deleted subscription"); }
catch { Console.WriteLine($"  Subscription already deleted"); }
try { publisher.DeleteTopic(topicName); Console.WriteLine($"  Deleted topic"); }
catch { Console.WriteLine($"  Topic already deleted"); }
```

      Deleted subscription
      Deleted topic

## Enterprise Transfer & Streaming Patterns (Reference)

Production patterns for large-scale data movement. Included as architecture reference — no runnable code.

#### Enterprise Streaming — MFT (Managed File Transfer)

**What:** Dedicated gateways for large file transfers with multiplexing, packet-level resume, encryption, audit.

**When to use:** Regulated industries, multi-partner B2B exchange, files > 100 GB.
**When NOT to use:** Internal cloud-to-cloud transfers.

#### GCS Transfer Service

**What:** Managed service for scheduled transfers between GCS/S3/Azure/HTTP endpoints.

**When to use:** Cross-cloud replication, TB-scale migration, on-prem NAS → GCS.

#### Transfer Acceleration & Cloud Interconnect

| Method | Bandwidth | Latency | Use Case |
|--------|-----------|---------|----------|
| Public internet | Variable | High | Dev, small transfers |
| Transfer Acceleration | 2-5x faster | Medium | Cross-continent uploads |
| Dedicated Interconnect | 10-100 Gbps | Low | Production pipelines |
| Partner Interconnect | 50 Mbps-50 Gbps | Low | Smaller dedicated link |

#### When to Use What

| Scenario | Pattern | Why |
|----------|---------|-----|
| Live price dashboard | **WebSocket** | Full-duplex, lowest latency, server push |
| AI chat token streaming | **SSE** | One-directional, works through CDN, auto-reconnect |
| Event-driven microservices | **Pub/Sub** | Decoupled, at-least-once, auto-scaling |
| Mobile live sync | **Firestore listener** | Offline support, per-document granularity |
| Nightly ETL batch | **GCS + BigQuery load** | Highest throughput, lowest cost per byte |
| Cross-cloud migration | **Transfer Service** | Managed, scheduled, resumable |
| High-bandwidth production | **Cloud Interconnect** | Dedicated line, consistent 10+ Gbps |
