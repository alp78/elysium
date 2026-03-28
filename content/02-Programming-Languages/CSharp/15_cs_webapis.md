---
type: reference
category: programming-languages
technology: [csharp, dotnet]
tags: [api, csharp]
aliases: [REST API, HTTP client, web server, FastAPI, ASP.NET, Flask, minimal API, requests]
keywords: [HttpClient, ASP.NET, minimal API, controller, middleware, routing, authentication, Swagger, IHttpClientFactory]
description: "C# web and APIs reference with executable examples and cell outputs — covers HttpClient, ASP.NET Core minimal APIs, controllers, middleware, and authentication. See [[15_py_webapis]] for the Python equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[15_py_webapis]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 15. Web & APIs - C#

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
```

#### HttpClient setup and GET request

```csharp
// HttpClient — the standard .NET HTTP client for all HTTP operations

var client = new HttpClient();
client.DefaultRequestHeaders.Add("Accept", "application/json");

// GET request — fetch data from an API endpoint
// Financial example: fetch quotes, index data, EOD prices.
Console.WriteLine("=== GET Request ===");
var resp = await client.GetAsync("https://httpbin.org/get?ticker=AAPL&date=2024-03-15");
Console.WriteLine($"Status: {(int)resp.StatusCode} {resp.StatusCode}");

// Parse JSON response
var json = await resp.Content.ReadAsStringAsync();
var doc = JsonDocument.Parse(json);
var args = doc.RootElement.GetProperty("args");
Console.WriteLine($"Args: ticker={args.GetProperty("ticker").GetString()}, date={args.GetProperty("date").GetString()}");
```

    === GET Request ===
    Status: 200 OK
    Args: ticker=AAPL, date=2024-03-15

#### GET with typed JSON deserialization

```csharp
// ReadFromJsonAsync deserializes the response body directly into a typed object
Console.WriteLine("=== GET with JSON deserialization ===");
var dataResp = await client.GetAsync("https://httpbin.org/get?source=dotnet");
var data = JsonSerializer.Deserialize<JsonElement>(await dataResp.Content.ReadAsStringAsync());
Console.WriteLine($"Origin: {data.GetProperty("origin").GetString()}");
```

    === GET with JSON deserialization ===
    Origin: 86.49.254.12

#### POST request — send JSON data

```csharp
// POST request — send a JSON body to an API endpoint
// Financial example: submit trade order, upload events.
Console.WriteLine("=== POST Request ===");
var tradeOrder = new
{
    ticker = "AAPL",
    side = "BUY",
    quantity = 100,
    limit_price = 178.50,
    order_type = "LIMIT"
};

// PostAsync with StringContent: serialize + set Content-Type manually.
// Python equivalent: requests.post(url, json=data)
resp = await client.PostAsync("https://httpbin.org/post",
    new StringContent(JsonSerializer.Serialize(tradeOrder), Encoding.UTF8, "application/json"));
var postData = JsonSerializer.Deserialize<JsonElement>(await resp.Content.ReadAsStringAsync());
Console.WriteLine($"Status: {(int)resp.StatusCode}");
Console.WriteLine($"Body echoed: {postData.GetProperty("json")}");
```

    === POST Request ===
    Status: 200
    Body echoed: {
        "limit_price": 178.5, 
        "order_type": "LIMIT", 
        "quantity": 100, 
        "side": "BUY", 
        "ticker": "AAPL"
      }

#### Headers and authentication

```csharp
// Custom headers — API keys, bearer tokens for financial data providers
Console.WriteLine("=== Custom Headers ===");
var authClient = new HttpClient();
authClient.DefaultRequestHeaders.Add("Authorization", "Bearer sk_demo_fake_key_12345");
authClient.DefaultRequestHeaders.Add("X-Client-Id", "trading-pipeline-v2");

resp = await authClient.GetAsync("https://httpbin.org/headers");
var headers = (JsonSerializer.Deserialize<JsonElement>(await resp.Content.ReadAsStringAsync())).GetProperty("headers");
Console.WriteLine($"  Authorization: {headers.GetProperty("Authorization").GetString()}");
Console.WriteLine($"  X-Client-Id: {headers.GetProperty("X-Client-Id").GetString()}");
```

    === Custom Headers ===
      Authorization: Bearer sk_demo_fake_key_12345
      X-Client-Id: trading-pipeline-v2

#### Status code handling

```csharp
// Status code handling — check success/failure and EnsureSuccessStatusCode
Console.WriteLine("=== Status Code Handling ===");
foreach (var statusCode in new[] { 200, 201, 400, 401, 404, 500 })
{
    resp = await client.GetAsync($"https://httpbin.org/status/{statusCode}");
    Console.WriteLine($"  {statusCode}: {(int)resp.StatusCode} {(resp.IsSuccessStatusCode ? "OK" : "FAILED")}");
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

    === Status Code Handling ===
      200: 200 OK
      201: 201 OK
      400: 400 FAILED
      401: 401 FAILED
      404: 404 FAILED
      500: 500 FAILED
    
      EnsureSuccessStatusCode() caught: Response status code does not indicate success: 500 (INTERNAL SERVER ERROR).

## 2. REST API Patterns for Data Engineering

#### Pagination — fetch data in pages

> [!warning] REST API patterns — pagination, retry, and bulk operations
> REST API patterns — pagination, retry, and bulk operations
>
> Technique: Pagination loops through pages until exhausted. Retry with
>   exponential backoff handles transient 429/5xx errors. Bulk POST
>   batches multiple records into one request to reduce round trips.
>
> Benefits:
>   - Pagination handles unbounded result sets without OOM
>   - Exponential backoff prevents overwhelming failing services
>   - Bulk POST reduces network round trips by 10-100x
>   - 429 handling with Retry-After respects the API's rate limit
>
> Anti-patterns:
>   - Fetching all pages without a limit — unbounded loop if API is broken
>   - Linear retry (no backoff) — hammers the failing service
>   - One POST per record — N round trips instead of 1
>   - Not checking Retry-After header on 429 — guessing the wait time
>
> When to use:
>   - Any API integration in data pipelines — these three patterns cover 90% of cases
>
> When NOT to use:
>   - Streaming APIs (WebSocket, SSE) — use async streaming instead

```csharp
var client = new HttpClient();

// Pagination — loop through pages, collect all results
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

#### Retry with exponential backoff

```csharp
// Retry with exponential backoff — recover from transient API failures
// Python equivalent: for attempt in range(max_retries): try/except with time.sleep()
Console.WriteLine("=== Retry with Backoff ===");

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
```

    === Retry with Backoff ===
      Success: 200

#### Bulk POST — batch multiple records

```csharp
// Bulk POST — send multiple records in one request
// Financial example: batch-submit trade confirmations.
Console.WriteLine("=== Bulk POST ===");
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

    === Bulk POST ===
      Sent 3 trades
      Status: 200
      Server received: 3 trades

## 3. Building a REST API (ASP.NET Minimal APIs)

#### DTO record declarations

> [!warning] ASP.NET Minimal APIs — building REST endpoints in C#
> ASP.NET Minimal APIs — building REST endpoints in C#
>
> Technique: Define record DTOs (like Pydantic models), write handler
>   functions that return typed results, and wire them to routes with
>   app.MapGet/MapPost/MapDelete. Each handler is a pure function
>   that can be tested independently — we demonstrate that here.
>
> Benefits:
>   - Record DTOs give compile-time type safety and auto-generated Equals/ToString
>   - Handler functions are testable without a running web server
>   - Same patterns work in ASP.NET Minimal APIs — just add route wiring
>   - Results.Ok/NotFound/Created map directly to HTTP status codes
>
> Anti-patterns:
>   - Business logic in route handlers — extract to testable functions
>   - Dictionary<string, object> for API models — use typed records
>   - In-memory storage in production — use a database
>
> When to use:
>   - Internal APIs, microservices, data pipeline endpoints
>
> When NOT to use:
>   - Complex APIs with middleware — use full ASP.NET MVC controllers
>
> DTOs — C# records = Python Pydantic models
> Immutable, value equality, auto-generated ToString.

```csharp
record Trade(string TradeId, string Ticker, string Side, int Quantity, double Price);
record TradeResponse(string TradeId, string Status, string Message);
record PortfolioPosition(string Ticker, int Shares, double AvgCost, double MarketValue);
```

#### In-memory store and health check

```csharp
// In-memory store — simulates a database for the API
// In production: replace with EF Core, Dapper, or direct SQL.

var tradesDb = new Dictionary<string, Trade>();
var positions = new Dictionary<string, PortfolioPosition>
{
    ["AAPL"] = new("AAPL", 500, 165.00, 89_250.00),
    ["MSFT"] = new("MSFT", 200, 380.50, 83_040.00),
    ["GOOG"] = new("GOOG", 100, 140.25, 17_230.00),
};

// Health check — K8s liveness probe
// ASP.NET: app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));
// Python:  @app.get("/health")
Console.WriteLine("=== GET /health ===");
Console.WriteLine($"  {{ status: healthy }}");
```

    === GET /health ===
      { status: healthy }

#### GET /positions — list with optional filter

```csharp
#nullable enable
// List positions — with optional ticker filter
// ASP.NET: app.MapGet("/positions", (string? ticker) => { ... });
// Python:  @app.get("/positions")

// Handler function — testable without a web server
(string status, object body) GetPositions(string? ticker = null)
{
    if (ticker is not null)
    {
        ticker = ticker.ToUpper();
        return positions.TryGetValue(ticker, out var pos)
            ? ("200 OK", pos)
            : ("404 Not Found", $"No position for {ticker}");
    }
    return ("200 OK", positions.Values.ToList());
}

Console.WriteLine("=== GET /positions ===");
var (s1, b1) = GetPositions();
Console.WriteLine($"  {s1}: {((List<PortfolioPosition>)b1).Count} positions");

Console.WriteLine("\n=== GET /positions?ticker=AAPL ===");
var (s2, b2) = GetPositions("AAPL");
Console.WriteLine($"  {s2}: {b2}");

Console.WriteLine("\n=== GET /positions?ticker=TSLA ===");
var (s3, b3) = GetPositions("TSLA");
Console.WriteLine($"  {s3}: {b3}");
```

    === GET /positions ===
      200 OK: 3 positions
    
    === GET /positions?ticker=AAPL ===
      200 OK: PortfolioPosition { Ticker = AAPL, Shares = 500, AvgCost = 165, MarketValue = 89250 }
    
    === GET /positions?ticker=TSLA ===
      404 Not Found: No position for TSLA

#### GET /positions/{ticker} — single position lookup

```csharp
// Get single position by ticker — path parameter
// ASP.NET: app.MapGet("/positions/{ticker}", (string ticker) => { ... });
// Python:  @app.get("/positions/{ticker}")

(string status, object body) GetPosition(string ticker)
{
    return positions.TryGetValue(ticker.ToUpper(), out var pos)
        ? ("200 OK", (object)pos)
        : ("404 Not Found", (object)$"No position for {ticker}");
}

Console.WriteLine("=== GET /positions/MSFT ===");
var (s1, b1) = GetPosition("MSFT");
Console.WriteLine($"  {s1}: {b1}");

Console.WriteLine("\n=== GET /positions/TSLA ===");
var (s2, b2) = GetPosition("TSLA");
Console.WriteLine($"  {s2}: {b2}");
```

    === GET /positions/MSFT ===
      200 OK: PortfolioPosition { Ticker = MSFT, Shares = 200, AvgCost = 380.5, MarketValue = 83040 }
    
    === GET /positions/TSLA ===
      404 Not Found: No position for TSLA

#### POST /trades — submit a trade order

```csharp
// Submit a new trade — returns 201 Created or 409 Conflict
// ASP.NET: app.MapPost("/trades", (Trade trade) => { ... });
// Python:  @app.post("/trades", status_code=201)

(string status, object body) PostTrade(Trade trade)
{
    if (tradesDb.ContainsKey(trade.TradeId))
        return ("409 Conflict", (object)$"Trade {trade.TradeId} already exists");
    tradesDb[trade.TradeId] = trade;
    return ("201 Created", (object)new TradeResponse(trade.TradeId, "ACCEPTED",
        $"{trade.Side} {trade.Quantity} {trade.Ticker} @ {trade.Price}"));
}

Console.WriteLine("=== POST /trades (new order) ===");
var (s1, b1) = PostTrade(new Trade("TRD_001", "AAPL", "BUY", 100, 178.50));
Console.WriteLine($"  {s1}: {b1}");

Console.WriteLine("\n=== POST /trades (duplicate) ===");
var (s2, b2) = PostTrade(new Trade("TRD_001", "AAPL", "BUY", 100, 178.50));
Console.WriteLine($"  {s2}: {b2}");
```

    === POST /trades (new order) ===
      201 Created: TradeResponse { TradeId = TRD_001, Status = ACCEPTED, Message = BUY 100 AAPL @ 178.5 }
    
    === POST /trades (duplicate) ===
      409 Conflict: Trade TRD_001 already exists

#### DELETE /trades/{tradeId} — cancel a trade

```csharp
// Cancel a trade — returns 200 OK or 404 Not Found
// ASP.NET: app.MapDelete("/trades/{tradeId}", (string tradeId) => { ... });
// Python:  @app.delete("/trades/{trade_id}")

(string status, object body) DeleteTrade(string tradeId)
{
    if (!tradesDb.Remove(tradeId))
        return ("404 Not Found", (object)$"Trade {tradeId} not found");
    return ("200 OK", (object)new { status = "CANCELLED", trade_id = tradeId });
}

Console.WriteLine("=== DELETE /trades/TRD_001 ===");
var (s1, b1) = DeleteTrade("TRD_001");
Console.WriteLine($"  {s1}: {b1}");

Console.WriteLine("\n=== DELETE /trades/TRD_999 (not found) ===");
var (s2, b2) = DeleteTrade("TRD_999");
Console.WriteLine($"  {s2}: {b2}");
```

    === DELETE /trades/TRD_001 ===
      200 OK: { status = CANCELLED, trade_id = TRD_001 }
    
    === DELETE /trades/TRD_999 (not found) ===
      404 Not Found: Trade TRD_999 not found

#### Python FastAPI vs C# ASP.NET Minimal API mapping

> [!info] How to wire these handlers in ASP.NET Minimal APIs (outside notebooks):
> How to wire these handlers in ASP.NET Minimal APIs (outside notebooks):
>
>   var builder = WebApplication.CreateBuilder(args);
>   builder.Services.AddEndpointsApiExplorer();
>   builder.Services.AddSwaggerGen();
>   var app = builder.Build();
>
>   app.MapGet("/health",             () => Results.Ok(new { status = "healthy" }));
>   app.MapGet("/positions",          (string? ticker) => GetPositions(ticker));
>   app.MapGet("/positions/{ticker}", (string ticker) => GetPosition(ticker));
>   app.MapPost("/trades",            (Trade trade) => PostTrade(trade));
>   app.MapDelete("/trades/{id}",     (string id) => DeleteTrade(id));
>
>   app.Run();
>

## 4. Data Validation — Records, Data Annotations, and FluentValidation

C# has three layers of validation for API models, from simple to powerful:

1. **Records with init-only properties** — immutable DTOs with compile-time type safety (like Pydantic `BaseModel`)
2. **Data Annotations** — `[Required]`, `[Range]`, `[StringLength]`, `[RegularExpression]` attributes on properties (like Pydantic `Field()` constraints)
3. **FluentValidation** — separate validator classes with chainable rules for complex business logic (like Pydantic `@field_validator` / `@model_validator`)

ASP.NET Minimal APIs validate annotated models automatically on `[FromBody]` parameters.

**Python equivalent**: Pydantic `BaseModel` + `Field()` + `@field_validator` + `@model_validator`.

This section covers:
- Record DTOs with Data Annotations
- Custom validation with `IValidatableObject`
- FluentValidation for complex business rules
- Nested models and enum constraints
- Immutability patterns and JSON serialization control
- Production checklist — validation rules for safe APIs

#### Record DTOs with Data Annotations — attribute-based constraints

Decorate record properties with `[Required]`, `[Range(1, 1000000)]`, `[StringLength(5)]`,
`[RegularExpression]` to constrain values. ASP.NET validates these automatically before
the handler runs. Invalid requests get a 400 Bad Request with detailed error messages.

> [!warning] Data Annotations — attribute-based validation on record properties
> Data Annotations — attribute-based validation on record properties
>
> Technique: Decorate properties with [Required], [Range], [StringLength],
>   [RegularExpression]. ASP.NET validates automatically on model binding.
>   System.ComponentModel.DataAnnotations namespace provides all attributes.
>
> Benefits:
>   - Declarative — constraints are on the property, not in handler code
>   - ASP.NET auto-validates — invalid requests get 400 before your code runs
>   - Standard .NET — works with EF Core, Blazor, WinForms, not just APIs
>   - Error messages auto-generated or customizable
>
> Anti-patterns:
>   - Validation logic in handlers — use annotations or FluentValidation
>   - Missing [Required] on non-nullable fields — null slips through
>   - [Range] on string properties — use [StringLength] instead
>
> When to use:
>   - Simple constraints: required, range, length, regex pattern
>
> When NOT to use:
>   - Complex cross-field rules — use FluentValidation or IValidatableObject

```csharp
#nullable enable
using System.ComponentModel.DataAnnotations;

// TradeOrder — record with Data Annotation constraints
// Python equivalent: Pydantic BaseModel with Field(gt=0, max_length=5, pattern=...)
record TradeOrderDto(
    [Required, StringLength(20, MinimumLength = 3)]
    string TradeId,

    [Required, StringLength(5, MinimumLength = 1), RegularExpression(@"^[A-Z]+$",
        ErrorMessage = "Ticker must be uppercase letters only")]
    string Ticker,

    [Required, RegularExpression(@"^(BUY|SELL)$",
        ErrorMessage = "Side must be BUY or SELL")]
    string Side,

    [Range(1, 1_000_000, ErrorMessage = "Quantity must be between 1 and 1,000,000")]
    int Quantity,

    [Range(0.01, double.MaxValue, ErrorMessage = "Price must be greater than 0")]
    double Price,

    [StringLength(500)]
    string? Notes = null
);

// Valid order
var order = new TradeOrderDto("TRD_001", "AAPL", "BUY", 100, 178.50);
Console.WriteLine($"Valid: {order}");

// Validate manually (ASP.NET does this automatically for [FromBody])
var ctx = new ValidationContext(order);
var results = new List<ValidationResult>();
bool isValid = Validator.TryValidateObject(order, ctx, results, true);
Console.WriteLine($"Valid: {isValid}");

// Invalid — test each constraint
var badCases = new (string label, TradeOrderDto dto)[] {
    ("short ID", new("T", "AAPL", "BUY", 1, 1.0)),
    ("lowercase ticker", new("TRD_X", "aapl", "BUY", 1, 1.0)),
    ("invalid side", new("TRD_X", "AAPL", "HOLD", 1, 1.0)),
    ("zero quantity", new("TRD_X", "AAPL", "BUY", 0, 1.0)),
    ("zero price", new("TRD_X", "AAPL", "BUY", 1, 0)),
};

foreach (var (label, dto) in badCases)
{
    var r = new List<ValidationResult>();
    var valid = Validator.TryValidateObject(dto, new ValidationContext(dto), r, true);
    Console.WriteLine($"  {label}: {(valid ? "PASSED" : $"REJECTED — {r[0].ErrorMessage}")}");
}
```

    Valid: TradeOrderDto { TradeId = TRD_001, Ticker = AAPL, Side = BUY, Quantity = 100, Price = 178.5, Notes =  }
    Valid: True
      short ID: PASSED
      lowercase ticker: PASSED
      invalid side: PASSED
      zero quantity: PASSED
      zero price: PASSED

#### IValidatableObject — custom cross-field validation

Implement `IValidatableObject.Validate()` for rules that span multiple fields
(e.g. `EndDate` must be after `StartDate`). Called automatically after Data Annotation
validation passes. Python equivalent: `@model_validator(mode="after")`.

```csharp
// PipelineConfigDto — record with IValidatableObject for cross-field validation
// Type declarations must be in their own cell in .NET Interactive

record PipelineConfigDto(
    [Required, RegularExpression(@"^[a-z][a-z0-9_]*$",
        ErrorMessage = "Name must be snake_case")]
    string Name,

    [Required, RegularExpression(@"^\w+\.\w+$",
        ErrorMessage = "Table must be dataset.table format")]
    string SourceTable,

    [Required, RegularExpression(@"^\w+\.\w+$",
        ErrorMessage = "Table must be dataset.table format")]
    string TargetTable,

    [Range(1, int.MaxValue)]
    int BatchSize = 1000,

    DateOnly StartDate = default,
    DateOnly EndDate = default
) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext ctx)
    {
        if (EndDate != default && StartDate != default && EndDate <= StartDate)
            yield return new ValidationResult(
                $"EndDate ({EndDate}) must be after StartDate ({StartDate})",
                new[] { nameof(EndDate) });
    }
}
```

#### Using IValidatableObject — test cross-field rules

```csharp
// Test IValidatableObject validation

// Valid config
var cfg = new PipelineConfigDto("daily_etl", "raw.events", "analytics.events_agg",
    5000, new DateOnly(2024, 1, 1), new DateOnly(2024, 3, 15));
var cfgResults = new List<ValidationResult>();
Validator.TryValidateObject(cfg, new ValidationContext(cfg), cfgResults, true);
Console.WriteLine($"Valid config: {cfgResults.Count == 0}");

// Invalid — end before start
var badCfg = new PipelineConfigDto("daily_etl", "raw.events", "analytics.out",
    1000, new DateOnly(2024, 6, 1), new DateOnly(2024, 1, 1));
var badResults = new List<ValidationResult>();
Validator.TryValidateObject(badCfg, new ValidationContext(badCfg), badResults, true);
Console.WriteLine($"End before start: {(badResults.Count > 0 ? $"REJECTED — {badResults[0].ErrorMessage}" : "PASSED")}");

// Invalid — non-snake_case name
var badName = new PipelineConfigDto("DailyETL", "raw.events", "analytics.out");
var nameResults = new List<ValidationResult>();
Validator.TryValidateObject(badName, new ValidationContext(badName), nameResults, true);
Console.WriteLine($"Non-snake_case: {(nameResults.Count > 0 ? $"REJECTED — {nameResults[0].ErrorMessage}" : "PASSED")}");
```

    Valid config: True
    End before start: REJECTED — EndDate (01-Jan-24) must be after StartDate (01-Jun-24)
    Non-snake_case: PASSED

#### Nested records and enums — compose complex API schemas

Records can contain other records (`OrderLeg[]`) and enums (`OrderStatus`).
Data Annotations validate each nested object. `JsonStringEnumConverter`
serializes enums as strings (not integers) in JSON output.

```csharp
// Nested records and enums — type declarations
// Python equivalent: nested Pydantic models + str Enum

enum OrderStatus { Pending, Filled, Cancelled, Rejected }

record OrderLeg(
    [Required, RegularExpression(@"^[A-Z]{1,5}$")] string Ticker,
    [Required, RegularExpression(@"^(BUY|SELL)$")] string Side,
    [Range(1, int.MaxValue)] int Quantity,
    [Range(0.01, double.MaxValue)] double Price
);

record MultiLegOrder(
    [Required] string OrderId,
    [Required, RegularExpression(@"^(PAIRS|SPREAD|BASKET)$")] string Strategy,
    [Required, MinLength(2), MaxLength(10)] OrderLeg[] Legs,
    OrderStatus Status = OrderStatus.Pending
) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext ctx)
    {
        if (Strategy == "PAIRS" && Legs?.Length != 2)
            yield return new ValidationResult(
                "PAIRS strategy requires exactly 2 legs",
                new[] { nameof(Legs) });
    }
}
```

#### Using nested records — test multi-leg order validation

```csharp
// Test nested records and validation

// Valid multi-leg order
var mlo = new MultiLegOrder("MLO_001", "PAIRS", new[] {
    new OrderLeg("AAPL", "BUY", 100, 178.50),
    new OrderLeg("MSFT", "SELL", 50, 415.20),
});
Console.WriteLine($"Order: {mlo.OrderId} | {mlo.Strategy} | {mlo.Legs.Length} legs | {mlo.Status}");

// Invalid — PAIRS with 3 legs
var bad3 = new MultiLegOrder("X", "PAIRS", new[] {
    new OrderLeg("A", "BUY", 1, 1), new OrderLeg("B", "SELL", 1, 1), new OrderLeg("C", "BUY", 1, 1),
});
var r3 = new List<ValidationResult>();
Validator.TryValidateObject(bad3, new ValidationContext(bad3), r3, true);
Console.WriteLine($"PAIRS+3 legs: {(r3.Count > 0 ? $"REJECTED — {r3[0].ErrorMessage}" : "PASSED")}");
```

    Order: MLO_001 | PAIRS | 2 legs | Pending
    PAIRS+3 legs: REJECTED — PAIRS strategy requires exactly 2 legs

#### JSON serialization control — `JsonPropertyName`, `JsonStringEnumConverter`

Use `[JsonPropertyName("camelCase")]` for API output naming.
`JsonStringEnumConverter` serializes enums as `"Pending"` not `0`.
`JsonIgnore` excludes fields from serialization. Python equivalent: Pydantic `Field(alias=...)`.

```csharp
// JSON serialization control — naming, enums, exclusion
// Python equivalent: Pydantic model_dump(by_alias=True), ConfigDict

var jsonOpts = new JsonSerializerOptions
{
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,      // PascalCase -> camelCase
    Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() },  // enum as string
    WriteIndented = true,
};

// Serialize with camelCase + string enums
var json = JsonSerializer.Serialize(mlo, jsonOpts);
Console.WriteLine("=== JSON output (camelCase + string enum) ===");
Console.WriteLine(json);

// Deserialize back
var deserialized = JsonSerializer.Deserialize<MultiLegOrder>(json, jsonOpts);
Console.WriteLine($"\nDeserialized: {deserialized?.OrderId} | {deserialized?.Status}");
```

    === JSON output (camelCase + string enum) ===
    {
      "orderId": "MLO_001",
      "strategy": "PAIRS",
      "legs": [
        {
          "ticker": "AAPL",
          "side": "BUY",
          "quantity": 100,
          "price": 178.5
        },
        {
          "ticker": "MSFT",
          "side": "SELL",
          "quantity": 50,
          "price": 415.2
        }
      ],
      "status": "Pending"
    }
    
    Deserialized: MLO_001 | Pending

#### Immutable records and init-only properties

Records are immutable by default — positional properties are `init`-only.
Assignment after construction is a compile error. Use `with` expression for
modified copies. Python equivalent: Pydantic `ConfigDict(frozen=True)`.

```csharp
// ImmutableConfig — record with init-only properties
// Python equivalent: Pydantic frozen=True

record ImmutableConfig(string DbHost, int DbPort = 5432, bool Ssl = true);
```

#### Using immutable records — init-only and with expressions

```csharp
// Test immutability and non-destructive mutation

var config = new ImmutableConfig("db.prod.internal");
Console.WriteLine($"Config: {config}");

// config.DbPort = 9999;  // Compile error! init-only property
Console.WriteLine("config.DbPort = 9999 → Compile error (init-only)");

// Non-destructive mutation with 'with'
var devConfig = config with { DbHost = "localhost", Ssl = false };
Console.WriteLine($"Dev:    {devConfig}");

// C# is always strict — no implicit string-to-int coercion
// int qty = "100";  // Compile error
Console.WriteLine("int qty = \"100\" → Compile error (C# is always strict, unlike Python)");
```

    Config: ImmutableConfig { DbHost = db.prod.internal, DbPort = 5432, Ssl = True }
    config.DbPort = 9999 → Compile error (init-only)
    Dev:    ImmutableConfig { DbHost = localhost, DbPort = 5432, Ssl = False }
    int qty = "100" → Compile error (C# is always strict, unlike Python)

#### Production checklist — validation rules for safe C# APIs

Summary table of production best practices for C# API validation,
mapped to Python/Pydantic equivalents.

```csharp
// Production validation checklist — C# rules mapped to Python equivalents

Console.WriteLine(@"
  Rule                                          C# Approach                    Python Equivalent
  ───────────────────────────────────────────── ────────────────────────────── ──────────────────────────
  Use typed DTOs, not Dictionary                record / class                 Pydantic BaseModel
  Constrain every field                         [Range], [StringLength]        Field(gt=0, max_length=5)
  Restrict to fixed values                      enum / [RegularExpression]     Literal[""BUY"",""SELL""]
  Cross-field validation                        IValidatableObject             @model_validator
  Per-field custom rules                        Custom [ValidationAttribute]   @field_validator
  camelCase JSON output                         JsonNamingPolicy.CamelCase     Field(alias=""camelCase"")
  Enum as string in JSON                        JsonStringEnumConverter        str, Enum
  Immutable models                              record (init-only)             frozen=True
  No implicit type coercion                     Built-in (C# is always strict) strict=True
  Auto-generate API docs                        Swagger via AddSwaggerGen      model_json_schema()
  Complex validation rules                      FluentValidation NuGet         @field_validator chains
  Validate on model binding                     ASP.NET auto-validates         FastAPI auto-validates
");
```

## 5. Summary

#### Web and APIs cheat sheet

> [!abstract]- Summary — C# Web & APIs cheat sheet
> Summary — C# Web & APIs cheat sheet
>
> HTTP CLIENT:
> var client = new HttpClient();
> await client.GetAsync(url)                      GET request
> await client.PostAsJsonAsync(url, obj)           POST with JSON body
> await resp.Content.ReadFromJsonAsync<T>()        Deserialize response
> resp.EnsureSuccessStatusCode()                   Throw on 4xx/5xx
> client.DefaultRequestHeaders.Add(k, v)           Set headers
>
> ASP.NET MINIMAL APIS:
> app.MapGet("/path", handler)                     Define GET endpoint
> app.MapPost("/path", handler)                    Define POST endpoint
> Results.Ok(data)                                 200 response
> Results.NotFound(msg)                            404 response
> Results.Created(url, data)                       201 response
> Results.Conflict(msg)                            409 response
>
> REST PATTERNS:
> Pagination           Loop with page/offset parameter
> Retry + backoff      Catch HttpRequestException, delay, retry
> Bulk POST            Batch records in single request
> Rate limit           Check 429 + Retry-After header
>
> PYTHON EQUIVALENTS:
> HttpClient           → requests / httpx
> PostAsJsonAsync       → requests.post(url, json=...)
> EnsureSuccessStatus   → resp.raise_for_status()
> ASP.NET Minimal       → FastAPI
> record                → Pydantic BaseModel
> Results.NotFound()    → HTTPException(404)
> IHttpClientFactory    → httpx.Client()
>
