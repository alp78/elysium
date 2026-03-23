---
type: reference
category: programming-languages
technology: [csharp, dotnet]
tags: [api, csharp]
aliases: [REST API, HTTP client, web server, FastAPI, ASP.NET, Flask, minimal API, requests]
keywords: [HttpClient, ASP.NET, minimal API, controller, middleware, routing, authentication, Swagger, IHttpClientFactory]
description: "C# web and APIs reference with executable examples and cell outputs — covers HttpClient, ASP.NET Core minimal APIs, controllers, middleware, and authentication. See [[13_WebAPIs]] for the Python equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[13_WebAPIs]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 13. Web & APIs - C#

Topics covered:
- HTTP Clients (HttpClient)
- REST API Concepts
- Building a REST API (ASP.NET Minimal APIs)
- Data Engineering API Patterns

## 1. HTTP Clients & REST API Calls


```csharp
using System.Net.Http;
using System.Text;
using System.Text.Json;

// HttpClient — the standard .NET HTTP client.
//
// KEY CONCEPTS:
// - HttpClient: single class for all HTTP methods (GET, POST, PUT, DELETE).
//   Python equivalent: requests / httpx
// - Async by default: all methods return Task<HttpResponseMessage>.
// - IMPORTANT: reuse HttpClient instances — don't create one per request.
//   In production, use IHttpClientFactory (DI) to manage connections.
// - System.Net.Http.Json: extension methods for JSON serialization.
//
// We use httpbin.org — free echo service, no API key needed.

var client = new HttpClient();
client.DefaultRequestHeaders.Add("Accept", "application/json");

// ─── GET request — read data ───
// Financial example: fetch quotes, index data, EOD prices.

Console.WriteLine("=== GET Request ===");
var resp = await client.GetAsync("https://httpbin.org/get?ticker=AAPL&date=2024-03-15");
Console.WriteLine($"Status: {(int)resp.StatusCode} {resp.StatusCode}");

// Parse JSON response
var json = await resp.Content.ReadAsStringAsync();
var doc = JsonDocument.Parse(json);
var args = doc.RootElement.GetProperty("args");
Console.WriteLine($"Args: ticker={args.GetProperty("ticker").GetString()}, date={args.GetProperty("date").GetString()}");

// ─── GET with ReadFromJsonAsync (typed deserialization) ───
Console.WriteLine("\n=== GET with JSON deserialization ===");
var dataResp = await client.GetAsync("https://httpbin.org/get?source=dotnet");
var data = JsonSerializer.Deserialize<JsonElement>(await dataResp.Content.ReadAsStringAsync());
Console.WriteLine($"Origin: {data.GetProperty("origin").GetString()}");

// ─── POST request — send data ───
// Financial example: submit trade order, upload events.

Console.WriteLine("\n=== POST Request ===");
var tradeOrder = new
{
    ticker = "AAPL",
    side = "BUY",
    quantity = 100,
    limit_price = 178.50,
    order_type = "LIMIT"
};

// PostAsJsonAsync: serializes to JSON + sets Content-Type header automatically.
// Python equivalent: requests.post(url, json=data)
resp = await client.PostAsync("https://httpbin.org/post",
    new StringContent(JsonSerializer.Serialize(tradeOrder), Encoding.UTF8, "application/json"));
var postData = JsonSerializer.Deserialize<JsonElement>(await resp.Content.ReadAsStringAsync());
Console.WriteLine($"Status: {(int)resp.StatusCode}");
Console.WriteLine($"Body echoed: {postData.GetProperty("json")}");

// ─── Headers & Authentication ───
// API keys, bearer tokens — common for financial data providers.

Console.WriteLine("\n=== Custom Headers ===");
var authClient = new HttpClient();
authClient.DefaultRequestHeaders.Add("Authorization", "Bearer sk_demo_fake_key_12345");
authClient.DefaultRequestHeaders.Add("X-Client-Id", "trading-pipeline-v2");

resp = await authClient.GetAsync("https://httpbin.org/headers");
var headers = (JsonSerializer.Deserialize<JsonElement>(await resp.Content.ReadAsStringAsync())).GetProperty("headers");
Console.WriteLine($"  Authorization: {headers.GetProperty("Authorization").GetString()}");
Console.WriteLine($"  X-Client-Id: {headers.GetProperty("X-Client-Id").GetString()}");

// ─── Status code handling ───

Console.WriteLine("\n=== Status Code Handling ===");
foreach (var code in new[] { 200, 201, 400, 401, 404, 500 })
{
    resp = await client.GetAsync($"https://httpbin.org/status/{code}");
    Console.WriteLine($"  {code}: {(int)resp.StatusCode} {(resp.IsSuccessStatusCode ? "OK" : "FAILED")}");
}

// EnsureSuccessStatusCode() — throws HttpRequestException for 4xx/5xx
// Python equivalent: resp.raise_for_status()
try
{
    resp = await client.GetAsync("https://httpbin.org/status/500");
    resp.EnsureSuccessStatusCode();
}
catch (HttpRequestException ex)
{
    Console.WriteLine($"\n  EnsureSuccessStatusCode() caught: {ex.Message}");
}
```

    === GET Request ===
    Status: 200 OK
    Args: ticker=AAPL, date=2024-03-15
    
    === GET with JSON deserialization ===
    Origin: 86.49.240.4
    
    === POST Request ===
    Status: 200
    Body echoed: {
        "limit_price": 178.5, 
        "order_type": "LIMIT", 
        "quantity": 100, 
        "side": "BUY", 
        "ticker": "AAPL"
      }
    
    === Custom Headers ===
      Authorization: Bearer sk_demo_fake_key_12345
      X-Client-Id: trading-pipeline-v2
    
    === Status Code Handling ===
      200: 200 OK
      201: 201 OK
      400: 400 FAILED
      401: 401 FAILED
      404: 404 FAILED
      500: 500 FAILED
    
      EnsureSuccessStatusCode() caught: Response status code does not indicate success: 500 (INTERNAL SERVER ERROR).
    

## 2. REST API Patterns for Data Engineering


```csharp
using System.Net.Http;
using System.Text.Json;

// REST API patterns for DE/finance pipelines.
//
// KEY PATTERNS:
// - Pagination: fetch data in pages.
// - Retry with exponential backoff: handle transient failures.
// - Bulk POST: batch multiple records in one request.

var client = new HttpClient();

// ─── Pattern 1: Pagination ───
// Most APIs return data in pages. Loop until no more data.
// Financial example: paginating through trade history.

Console.WriteLine("=== Pagination ===");
var allPages = new List<JsonElement>();
for (int page = 1; page <= 3; page++)
{
    var resp = await client.GetAsync($"https://httpbin.org/get?page={page}&per_page=50");
    resp.EnsureSuccessStatusCode();
    var data = JsonSerializer.Deserialize<JsonElement>(await resp.Content.ReadAsStringAsync());
    allPages.Add(data);
    Console.WriteLine($"  Page {page}: fetched (args: {data.GetProperty("args")})" );
}
Console.WriteLine($"  Total pages: {allPages.Count}");

// ─── Pattern 2: Retry with exponential backoff ───
// Python equivalent: for attempt in range(max_retries): try/except with time.sleep()

Console.WriteLine("\n=== Retry with Backoff ===");

async Task<HttpResponseMessage> FetchWithRetry(HttpClient c, string url, int maxRetries = 3)
{
    double baseDelay = 0.5;
    for (int attempt = 0; attempt < maxRetries; attempt++)
    {
        try
        {
            var r = await c.GetAsync(url);
            if ((int)r.StatusCode == 429) // rate limited
            {
                var retryAfter = int.Parse(r.Headers.RetryAfter?.Delta?.TotalSeconds.ToString() ?? "1");
                Console.WriteLine($"    Rate limited. Waiting {retryAfter}s...");
                await Task.Delay(retryAfter * 1000);
                continue;
            }
            r.EnsureSuccessStatusCode();
            return r;
        }
        catch (HttpRequestException ex)
        {
            var delay = baseDelay * Math.Pow(2, attempt);
            Console.WriteLine($"    Attempt {attempt + 1} failed: {ex.Message}. Retrying in {delay:F1}s...");
            await Task.Delay((int)(delay * 1000));
        }
    }
    throw new Exception($"Failed after {maxRetries} retries: {url}");
}

var result = await FetchWithRetry(client, "https://httpbin.org/get?ticker=AAPL");
Console.WriteLine($"  Success: {(int)result.StatusCode}");

// ─── Pattern 3: Bulk POST ───
// Send multiple records in one request.
// Financial example: batch-submit trade confirmations.

Console.WriteLine("\n=== Bulk POST ===");
var batch = new[]
{
    new { trade_id = "TRD_001", ticker = "AAPL", qty = 100, price = 178.50 },
    new { trade_id = "TRD_002", ticker = "MSFT", qty = 50,  price = 415.20 },
    new { trade_id = "TRD_003", ticker = "GOOG", qty = 20,  price = 172.30 },
};

var postResp = await client.PostAsync("https://httpbin.org/post",
    new StringContent(JsonSerializer.Serialize(new { trades = batch }), Encoding.UTF8, "application/json"));
var postData = JsonSerializer.Deserialize<JsonElement>(await postResp.Content.ReadAsStringAsync());
Console.WriteLine($"  Sent {batch.Length} trades");
Console.WriteLine($"  Status: {(int)postResp.StatusCode}");
Console.WriteLine($"  Server received: {postData.GetProperty("json").GetProperty("trades").GetArrayLength()} trades");
```

    === Pagination ===
      Page 1: fetched (args: {
        "page": "1", 
        "per_page": "50"
      })
      Page 2: fetched (args: {
        "page": "2", 
        "per_page": "50"
      })
      Page 3: fetched (args: {
        "page": "3", 
        "per_page": "50"
      })
      Total pages: 3
    
    === Retry with Backoff ===
      Success: 200
    
    === Bulk POST ===
      Sent 3 trades
      Status: 200
      Server received: 3 trades
    

## 3. Building a REST API (ASP.NET Minimal APIs)


```csharp
// ASP.NET Minimal APIs — building REST APIs in C#.
//
// KEY CONCEPTS:
// - Minimal APIs: lightweight syntax for defining endpoints (like FastAPI).
//   Python equivalent: FastAPI.
// - app.MapGet(), app.MapPost(), etc. — define routes with lambdas.
//   Python equivalent: @app.get(), @app.post() decorators.
// - Results.Ok(), Results.NotFound() — return typed HTTP responses.
//   Python equivalent: HTTPException(status_code=404)
// - record types for DTOs — like Pydantic models.
//
// NOTEBOOK LIMITATION:
// ASP.NET requires a hosted process — it can't run inside .NET Interactive.
// So we print the code as a reference and explain each part.
// To run it: create a project with `dotnet new webapi -o TradingApi`,
// then paste this code into Program.cs.

Console.WriteLine(@"
// ══════════════════════════════════════════════════════════
// Program.cs — Trading Pipeline API (ASP.NET Minimal APIs)
// ══════════════════════════════════════════════════════════
// Create project:  dotnet new webapi -o TradingApi
// Run:             dotnet run
// Swagger:         https://localhost:5001/swagger

// ─── DTOs (Data Transfer Objects) ───
// C# records = Python Pydantic models
// Auto-validated by ASP.NET model binding.

record Trade(string TradeId, string Ticker, string Side, int Quantity, double Price);
record TradeResponse(string TradeId, string Status, string Message);
record PortfolioPosition(string Ticker, int Shares, double AvgCost, double MarketValue);

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddEndpointsApiExplorer();  // Swagger support
builder.Services.AddSwaggerGen();
var app = builder.Build();
app.UseSwagger();
app.UseSwaggerUI();

// In-memory store (in production: database)
var tradesDb = new Dictionary<string, Trade>();
var positions = new Dictionary<string, PortfolioPosition>
{
    [""AAPL""] = new(""AAPL"", 500, 165.00, 89_250.00),
    [""MSFT""] = new(""MSFT"", 200, 380.50, 83_040.00),
    [""GOOG""] = new(""GOOG"", 100, 140.25, 17_230.00),
};

// ─── GET endpoints ───

// Health check — K8s liveness probe
// Python: @app.get(""/health"")
app.MapGet(""/health"", () => Results.Ok(new { status = ""healthy"" }));

// List positions — with optional query filter
// Python: @app.get(""/positions"")
//         def list_positions(ticker: Optional[str] = Query(None)):
app.MapGet(""/positions"", (string? ticker) =>
{
    if (ticker is not null)
    {
        ticker = ticker.ToUpper();
        return positions.TryGetValue(ticker, out var pos)
            ? Results.Ok(new { positions = new[] { pos } })
            : Results.NotFound(new { detail = $""No position for {ticker}"" });
    }
    return Results.Ok(new { positions = positions.Values.ToList() });
});

// Get single position — path parameter
// Python: @app.get(""/positions/{ticker}"")
app.MapGet(""/positions/{ticker}"", (string ticker) =>
    positions.TryGetValue(ticker.ToUpper(), out var pos)
        ? Results.Ok(pos)
        : Results.NotFound(new { detail = $""No position for {ticker}"" }));

// ─── POST endpoint ───
// Python: @app.post(""/trades"", status_code=201)
app.MapPost(""/trades"", (Trade trade) =>
{
    if (tradesDb.ContainsKey(trade.TradeId))
        return Results.Conflict(new { detail = $""Trade {trade.TradeId} already exists"" });
    tradesDb[trade.TradeId] = trade;
    return Results.Created($""/trades/{trade.TradeId}"",
        new TradeResponse(trade.TradeId, ""ACCEPTED"",
            $""{trade.Side} {trade.Quantity} {trade.Ticker} @ {trade.Price}""));
});

// ─── DELETE endpoint ───
// Python: @app.delete(""/trades/{trade_id}"")
app.MapDelete(""/trades/{tradeId}"", (string tradeId) =>
{
    if (!tradesDb.Remove(tradeId))
        return Results.NotFound(new { detail = $""Trade {tradeId} not found"" });
    return Results.Ok(new { status = ""CANCELLED"", trade_id = tradeId });
});

app.Run();
");

Console.WriteLine("\n" + new string('─', 60));
Console.WriteLine(@"
PYTHON → C# MAPPING:

  FastAPI                          ASP.NET Minimal API
  ─────────────────────────────    ─────────────────────────────
  @app.get(""/path"")               app.MapGet(""/path"", handler)
  @app.post(""/path"")              app.MapPost(""/path"", handler)
  @app.delete(""/path"")            app.MapDelete(""/path"", handler)
  HTTPException(404)               Results.NotFound()
  return {dict}                    Results.Ok(new { ... })
  BaseModel (Pydantic)             record (C# record type)
  Query(None)                      nullable parameter: string?
  Path parameter: {id}             Route parameter: {id}
  uvicorn                          Kestrel (built-in)
  /docs (Swagger auto)             /swagger (AddSwaggerGen)
");
```

    
    // ══════════════════════════════════════════════════════════
    // Program.cs — Trading Pipeline API (ASP.NET Minimal APIs)
    // ══════════════════════════════════════════════════════════
    // Create project:  dotnet new webapi -o TradingApi
    // Run:             dotnet run
    // Swagger:         https://localhost:5001/swagger
    
    // ─── DTOs (Data Transfer Objects) ───
    // C# records = Python Pydantic models
    // Auto-validated by ASP.NET model binding.
    
    record Trade(string TradeId, string Ticker, string Side, int Quantity, double Price);
    record TradeResponse(string TradeId, string Status, string Message);
    record PortfolioPosition(string Ticker, int Shares, double AvgCost, double MarketValue);
    
    var builder = WebApplication.CreateBuilder(args);
    builder.Services.AddEndpointsApiExplorer();  // Swagger support
    builder.Services.AddSwaggerGen();
    var app = builder.Build();
    app.UseSwagger();
    app.UseSwaggerUI();
    
    // In-memory store (in production: database)
    var tradesDb = new Dictionary<string, Trade>();
    var positions = new Dictionary<string, PortfolioPosition>
    {
        ["AAPL"] = new("AAPL", 500, 165.00, 89_250.00),
        ["MSFT"] = new("MSFT", 200, 380.50, 83_040.00),
        ["GOOG"] = new("GOOG", 100, 140.25, 17_230.00),
    };
    
    // ─── GET endpoints ───
    
    // Health check — K8s liveness probe
    // Python: @app.get("/health")
    app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));
    
    // List positions — with optional query filter
    // Python: @app.get("/positions")
    //         def list_positions(ticker: Optional[str] = Query(None)):
    app.MapGet("/positions", (string? ticker) =>
    {
        if (ticker is not null)
        {
            ticker = ticker.ToUpper();
            return positions.TryGetValue(ticker, out var pos)
                ? Results.Ok(new { positions = new[] { pos } })
                : Results.NotFound(new { detail = $"No position for {ticker}" });
        }
        return Results.Ok(new { positions = positions.Values.ToList() });
    });
    
    // Get single position — path parameter
    // Python: @app.get("/positions/{ticker}")
    app.MapGet("/positions/{ticker}", (string ticker) =>
        positions.TryGetValue(ticker.ToUpper(), out var pos)
            ? Results.Ok(pos)
            : Results.NotFound(new { detail = $"No position for {ticker}" }));
    
    // ─── POST endpoint ───
    // Python: @app.post("/trades", status_code=201)
    app.MapPost("/trades", (Trade trade) =>
    {
        if (tradesDb.ContainsKey(trade.TradeId))
            return Results.Conflict(new { detail = $"Trade {trade.TradeId} already exists" });
        tradesDb[trade.TradeId] = trade;
        return Results.Created($"/trades/{trade.TradeId}",
            new TradeResponse(trade.TradeId, "ACCEPTED",
                $"{trade.Side} {trade.Quantity} {trade.Ticker} @ {trade.Price}"));
    });
    
    // ─── DELETE endpoint ───
    // Python: @app.delete("/trades/{trade_id}")
    app.MapDelete("/trades/{tradeId}", (string tradeId) =>
    {
        if (!tradesDb.Remove(tradeId))
            return Results.NotFound(new { detail = $"Trade {tradeId} not found" });
        return Results.Ok(new { status = "CANCELLED", trade_id = tradeId });
    });
    
    app.Run();
    
    
    ────────────────────────────────────────────────────────────
    
    PYTHON → C# MAPPING:
    
      FastAPI                          ASP.NET Minimal API
      ─────────────────────────────    ─────────────────────────────
      @app.get("/path")               app.MapGet("/path", handler)
      @app.post("/path")              app.MapPost("/path", handler)
      @app.delete("/path")            app.MapDelete("/path", handler)
      HTTPException(404)               Results.NotFound()
      return {dict}                    Results.Ok(new { ... })
      BaseModel (Pydantic)             record (C# record type)
      Query(None)                      nullable parameter: string?
      Path parameter: {id}             Route parameter: {id}
      uvicorn                          Kestrel (built-in)
      /docs (Swagger auto)             /swagger (AddSwaggerGen)
    
    

## 4. Summary


```csharp
// Summary — C# Web & APIs cheat sheet
//
// HTTP CLIENT:
// var client = new HttpClient();
// await client.GetAsync(url)                      GET request
// await client.PostAsJsonAsync(url, obj)           POST with JSON body
// await resp.Content.ReadFromJsonAsync<T>()        Deserialize response
// resp.EnsureSuccessStatusCode()                   Throw on 4xx/5xx
// client.DefaultRequestHeaders.Add(k, v)           Set headers
//
// ASP.NET MINIMAL APIS:
// app.MapGet("/path", handler)                     Define GET endpoint
// app.MapPost("/path", handler)                    Define POST endpoint
// Results.Ok(data)                                 200 response
// Results.NotFound(msg)                            404 response
// Results.Created(url, data)                       201 response
// Results.Conflict(msg)                            409 response
//
// REST PATTERNS:
// Pagination           Loop with page/offset parameter
// Retry + backoff      Catch HttpRequestException, delay, retry
// Bulk POST            Batch records in single request
// Rate limit           Check 429 + Retry-After header
//
// PYTHON EQUIVALENTS:
// HttpClient           → requests / httpx
// PostAsJsonAsync       → requests.post(url, json=...)
// EnsureSuccessStatus   → resp.raise_for_status()
// ASP.NET Minimal       → FastAPI
// record                → Pydantic BaseModel
// Results.NotFound()    → HTTPException(404)
// IHttpClientFactory    → httpx.Client()
```
