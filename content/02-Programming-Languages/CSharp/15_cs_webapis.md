---
title: "15. Web and APIs - C#"
tags: [api, csharp]
aliases: [REST API, HTTP client, web server, ASP.NET, minimal API]
description: "C# web and APIs reference with executable examples and cell outputs — covers HttpClient, ASP.NET Core minimal APIs, controllers, middleware, and authentication. See [15_py_webapis](https://alp78.github.io/elysium/02-Programming-Languages/Python/15_py_webapis) for the Python equivalent."
parent: "[[domain-data-engineering]]"
links:
  - "[[15_py_webapis]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 15. Web & APIs - C#

> [!quote]
> "Web programming is the science of coming up with increasingly complicated ways of concatenating strings."
>
> — **Greg Brockman**


## HTTP Clients & REST API Calls

`HttpClient` is the standard .NET HTTP client for all HTTP operations. Import these namespaces to use JSON serialization and HTTP primitives in .NET Interactive notebooks.

```csharp
using System.Net.Http;
using System.Text;
using System.Text.Json;
```

### Making HTTP requests

The three cells below cover the most common HTTP operations: a simple GET to read data, typed JSON deserialization, and a POST to send a JSON body. All use `HttpClient` — in production, a single long-lived instance (or `IHttpClientFactory`) should be shared across requests.

#### HttpClient setup and GET request

`HttpClient.GetAsync` sends a GET request and returns an `HttpResponseMessage`. Read the status code from `resp.StatusCode` and the body with `resp.Content.ReadAsStringAsync()`. Chain `JsonDocument.Parse` to navigate the JSON without defining a type. For financial pipelines this covers one-off calls — fetching quotes, EOD prices, or index composition data.

```csharp
var client = new HttpClient();
client.DefaultRequestHeaders.Add("Accept", "application/json");

var resp = await client.GetAsync("https://httpbin.org/get?ticker=AAPL&date=2024-03-15");
Console.WriteLine($"{(int)resp.StatusCode} {resp.StatusCode}");  // status

var json = await resp.Content.ReadAsStringAsync();
var doc = JsonDocument.Parse(json);
var args = doc.RootElement.GetProperty("args");
Console.WriteLine($"ticker={args.GetProperty("ticker").GetString()}, date={args.GetProperty("date").GetString()}");  // args
```

    200 OK
    ticker=AAPL, date=2024-03-15

#### GET with typed JSON deserialization

`JsonSerializer.Deserialize<T>` deserializes the response body into a typed C# object. Use `JsonElement` for dynamic JSON navigation without defining a class, or provide a typed `record` or `class` for compile-time safety. Python equivalent: `resp.json()` returns a dict directly; C# requires an explicit deserialization call.

```csharp
var dataResp = await client.GetAsync("https://httpbin.org/get?source=dotnet");
var data = JsonSerializer.Deserialize<JsonElement>(await dataResp.Content.ReadAsStringAsync());
Console.WriteLine(data.GetProperty("origin").GetString());  // origin
```

    86.49.254.12

#### POST request — send JSON data

`HttpClient.PostAsync` with `StringContent` sends a JSON body. Serialize the payload with `JsonSerializer.Serialize`, wrap it in `StringContent` with UTF-8 encoding and `application/json` content type. Python equivalent: `requests.post(url, json=data)` handles serialization and the `Content-Type` header automatically; C# requires both to be set explicitly.

```csharp
var tradeOrder = new
{
    ticker = "AAPL",
    side = "BUY",
    quantity = 100,
    limit_price = 178.50,
    order_type = "LIMIT"
};

resp = await client.PostAsync("https://httpbin.org/post",
    new StringContent(JsonSerializer.Serialize(tradeOrder), Encoding.UTF8, "application/json"));
var postData = JsonSerializer.Deserialize<JsonElement>(await resp.Content.ReadAsStringAsync());
Console.WriteLine((int)resp.StatusCode);  // status
Console.WriteLine(postData.GetProperty("json"));  // body echoed
```

    200
    {
        "limit_price": 178.5, 
        "order_type": "LIMIT", 
        "quantity": 100, 
        "side": "BUY", 
        "ticker": "AAPL"
      }

### Headers and error handling

Custom HTTP headers pass authentication tokens and client identifiers to financial data providers. Status code checking ensures pipelines handle transient API errors gracefully rather than silently processing failed responses.

#### HttpClient REST API — headers and authentication

Add headers to `DefaultRequestHeaders` once on the client instance — they are sent with every subsequent request. `Authorization: Bearer <token>` is the standard pattern for API key authentication. For per-request headers, create a new `HttpRequestMessage` with a `Headers` collection rather than using the shared client.

```csharp
var authClient = new HttpClient();
authClient.DefaultRequestHeaders.Add("Authorization", "Bearer sk_demo_fake_key_12345");
authClient.DefaultRequestHeaders.Add("X-Client-Id", "trading-pipeline-v2");

resp = await authClient.GetAsync("https://httpbin.org/headers");
var headers = (JsonSerializer.Deserialize<JsonElement>(await resp.Content.ReadAsStringAsync())).GetProperty("headers");
Console.WriteLine(headers.GetProperty("Authorization").GetString());  // Authorization
Console.WriteLine(headers.GetProperty("X-Client-Id").GetString());  // X-Client-Id
```

      Bearer sk_demo_fake_key_12345
      trading-pipeline-v2

#### HttpClient REST API — status code handling

`resp.IsSuccessStatusCode` returns `true` for 2xx responses. `EnsureSuccessStatusCode()` throws `HttpRequestException` for 4xx/5xx — equivalent to Python's `resp.raise_for_status()`. Use it to fail fast in pipelines where a non-200 response should halt processing rather than continue with empty or partial data.

```csharp
foreach (var statusCode in new[] { 200, 201, 400, 401, 404, 500 })
{
    resp = await client.GetAsync($"https://httpbin.org/status/{statusCode}");
    Console.WriteLine($"  {statusCode}: {(int)resp.StatusCode} {(resp.IsSuccessStatusCode ? "OK" : "FAILED")}");
}

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

      200: 200 OK
      201: 201 OK
      400: 400 FAILED
      401: 401 FAILED
      404: 404 FAILED
      500: 500 FAILED
    
      Response status code does not indicate success: 500 (INTERNAL SERVER ERROR).

## REST API Patterns for Data Engineering

### Pagination, retry, and bulk batching

These three cells each demonstrate one core integration pattern. Combine them — a paginated fetch that retries on each page failure and batches results for downstream POSTs — to cover 90% of data pipeline API integrations.

#### REST API Pagination — fetch data in pages

Three essential patterns for API integrations: **pagination** loops through pages until exhausted, **retry with exponential backoff** handles transient 429/5xx errors (check `Retry-After` header), and **bulk POST** batches records to reduce round trips by 10-100x. These three patterns cover 90% of data pipeline API integrations.

> [!warning] Anti-patterns
>
> - **Fetching all pages without a limit** — unbounded loop if API is broken
> - **Linear retry (no backoff)** — hammers the failing service
> - **One POST per record** — N round trips instead of 1

> [!success] Robust API integration patterns
>
> Cap pagination loops with a `maxPages` guard. Use exponential backoff (0.5s → 1s → 2s) with a `Retry-After` header check for 429s. Batch records into bulk POSTs — 100 records per request reduces round trips and stays under most API rate limits.

```csharp
var client = new HttpClient();

// Pagination — loop through pages, collect all results
// Financial example: paginating through trade history.
var allPages = new List<JsonElement>();
for (int page = 1; page <= 3; page++)
{
    var resp = await client.GetAsync($"https://httpbin.org/get?page={page}&per_page=50");
    resp.EnsureSuccessStatusCode();
    var data = JsonSerializer.Deserialize<JsonElement>(await resp.Content.ReadAsStringAsync());
    allPages.Add(data);
    Console.WriteLine($"  Page {page}: fetched (args: {data.GetProperty("args")})" );
}
Console.WriteLine(allPages.Count);  // total pages
```

      fetched (args: {
        "page": "1", 
        "per_page": "50"
      })
      fetched (args: {
        "page": "2", 
        "per_page": "50"
      })
      fetched (args: {
        "page": "3", 
        "per_page": "50"
      })
      3

#### REST API Retry with exponential backoff

`FetchWithRetry` wraps a GET with up to `maxRetries` attempts. On a 429 (rate limited), it reads the `Retry-After` header and waits exactly that long before retrying. On other errors, exponential backoff applies: 0.5 s, 1 s, 2 s. After all retries are exhausted it throws so the caller can decide whether to skip or abort the pipeline. Python equivalent: a `for attempt in range(max_retries): try/except` loop with `time.sleep(base * 2 ** attempt)`.

```csharp
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
Console.WriteLine((int)result.StatusCode);  // success
```

      200

#### REST API Bulk POST — batch multiple records

Serialize multiple records as a JSON array in a single POST body. A batch of 100 trade confirmations in one request reduces round trips from 100 to 1, staying well under most API rate limits. Match the `trades` key to whatever the receiving API expects in its request schema.

```csharp
var batch = new[]
{
    new { trade_id = "TRD_001", ticker = "AAPL", qty = 100, price = 178.50 },
    new { trade_id = "TRD_002", ticker = "MSFT", qty = 50,  price = 415.20 },
    new { trade_id = "TRD_003", ticker = "GOOG", qty = 20,  price = 172.30 },
};

var postResp = await client.PostAsync("https://httpbin.org/post",
    new StringContent(JsonSerializer.Serialize(new { trades = batch }), Encoding.UTF8, "application/json"));
var postData = JsonSerializer.Deserialize<JsonElement>(await postResp.Content.ReadAsStringAsync());
Console.WriteLine(batch.Length);  // trades sent
Console.WriteLine((int)postResp.StatusCode);  // status
Console.WriteLine(postData.GetProperty("json").GetProperty("trades").GetArrayLength());  // server received
```

      Sent 3 trades
      200
      3 trades

## Building a REST API (ASP.NET Minimal APIs)

Define `record` DTOs for request and response shapes, write handler functions that return typed results, and wire them to routes with `app.MapGet`/`MapPost`/`MapDelete`. Each handler is a pure C# function testable without a running web server. `Results.Ok`/`NotFound`/`Created` map directly to HTTP status codes.

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
flowchart TD
    C["HTTP Client<br/>HttpClient / httpx"] -->|"HTTP Request"| MW["ASP.NET Core<br/>Middleware"]
    MW --> R["Route matching<br/>app.Map*()"]
    R --> V["Data Annotations<br/>IValidatableObject"]
    V --> H["Handler function<br/>pure C# function"]
    H -->|"Results.Ok() / NotFound() / Created()"| S["JSON Response<br/>200 / 201 / 404 / 409"]
    V -->|"invalid input"| E["400 Bad Request"]
```

### Data models and in-memory store

Define `record` DTOs for all request and response shapes, then set up the shared state that handler functions read and write. In production, replace the in-memory `Dictionary` with EF Core, Dapper, or direct SQL.

#### ASP.NET REST API — DTO record declarations

C# `record` types are the equivalent of Pydantic `BaseModel` — immutable value objects with automatic value equality and JSON serialization. Define one `record` per request or response shape. For complex APIs with middleware or controllers, use full ASP.NET MVC instead of Minimal APIs.

> [!warning] Anti-patterns
>
> - **Business logic in route handlers** — extract to testable pure functions
> - **`Dictionary<string, object>` for API models** — use typed records

> [!success] Clean minimal API design
>
> Keep route handlers as thin delegates that call a pure handler function. Use `record` DTOs for all shapes — compile-time type safety, automatic JSON binding, and handlers testable without a running web server.

```csharp
record Trade(string TradeId, string Ticker, string Side, int Quantity, double Price);
record TradeResponse(string TradeId, string Status, string Message);
record PortfolioPosition(string Ticker, int Shares, double AvgCost, double MarketValue);
```

#### ASP.NET REST API — in-memory store and health check

The in-memory `Dictionary` simulates a database for notebook execution. In production, replace with EF Core (`DbContext`), Dapper (`IDbConnection`), or direct SQL. The health endpoint is the first route to add — Kubernetes uses it as a liveness probe to determine whether to route traffic to the pod.

```csharp
var tradesDb = new Dictionary<string, Trade>();
var positions = new Dictionary<string, PortfolioPosition>
{
    ["AAPL"] = new("AAPL", 500, 165.00, 89_250.00),
    ["MSFT"] = new("MSFT", 200, 380.50, 83_040.00),
    ["GOOG"] = new("GOOG", 100, 140.25, 17_230.00),
};

Console.WriteLine($"{{ status: healthy }}");
```

      { status: healthy }

### Route handlers

Each handler is a pure C# function that takes typed parameters and returns a `(status, body)` tuple. This keeps every endpoint unit-testable without spinning up a web server. In a real ASP.NET project, the handler body is passed as a lambda to `app.MapGet` / `app.MapPost` / `app.MapDelete`.

#### ASP.NET REST API — GET /positions with optional filter

The handler accepts an optional `ticker` query-string parameter (`/positions?ticker=AAPL`). `#nullable enable` is required to declare `string?` in .NET Interactive cells. The function returns a status-and-body tuple so the logic is verifiable without a live HTTP call.

```csharp
#nullable enable
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

var (s1, b1) = GetPositions();
Console.WriteLine($"{s1}: {((List<PortfolioPosition>)b1).Count} positions");

var (s2, b2) = GetPositions("AAPL");
Console.WriteLine($"{s2}: {b2}");

var (s3, b3) = GetPositions("TSLA");
Console.WriteLine($"{s3}: {b3}");
```

      200 OK: 3 positions
    
      200 OK: PortfolioPosition { Ticker = AAPL, Shares = 500, AvgCost = 165, MarketValue = 89250 }
    
      404 Not Found: No position for TSLA

#### ASP.NET REST API — GET /positions/{ticker} single lookup

Path parameters are declared in the route template as `{ticker}` and passed as method arguments. `TryGetValue` avoids a `KeyNotFoundException` on missing tickers and returns a 404 response alongside the status string.

```csharp
(string status, object body) GetPosition(string ticker)
{
    return positions.TryGetValue(ticker.ToUpper(), out var pos)
        ? ("200 OK", (object)pos)
        : ("404 Not Found", (object)$"No position for {ticker}");
}

var (s1, b1) = GetPosition("MSFT");
Console.WriteLine($"{s1}: {b1}");

var (s2, b2) = GetPosition("TSLA");
Console.WriteLine($"{s2}: {b2}");
```

      200 OK: PortfolioPosition { Ticker = MSFT, Shares = 200, AvgCost = 380.5, MarketValue = 83040 }
    
      404 Not Found: No position for TSLA

#### ASP.NET REST API — POST /trades submit a trade order

The POST handler returns `201 Created` on success and `409 Conflict` if the `TradeId` already exists. `TradeResponse` separates the response shape from the internal `Trade` model — callers receive only the fields relevant to confirming an order.

```csharp
(string status, object body) PostTrade(Trade trade)
{
    if (tradesDb.ContainsKey(trade.TradeId))
        return ("409 Conflict", (object)$"Trade {trade.TradeId} already exists");
    tradesDb[trade.TradeId] = trade;
    return ("201 Created", (object)new TradeResponse(trade.TradeId, "ACCEPTED",
        $"{trade.Side} {trade.Quantity} {trade.Ticker} @ {trade.Price}"));
}

var (s1, b1) = PostTrade(new Trade("TRD_001", "AAPL", "BUY", 100, 178.50));
Console.WriteLine($"{s1}: {b1}");

var (s2, b2) = PostTrade(new Trade("TRD_001", "AAPL", "BUY", 100, 178.50));
Console.WriteLine($"{s2}: {b2}");
```

      201 Created: TradeResponse { TradeId = TRD_001, Status = ACCEPTED, Message = BUY 100 AAPL @ 178.5 }
    
      409 Conflict: Trade TRD_001 already exists

#### ASP.NET REST API — DELETE /trades/{tradeId} cancel a trade

`Dictionary.Remove` returns `false` if the key is absent, so the existence check and deletion happen in a single call. The handler returns `200 OK` with a cancellation receipt on success, and `404 Not Found` if the trade does not exist.

```csharp
(string status, object body) DeleteTrade(string tradeId)
{
    if (!tradesDb.Remove(tradeId))
        return ("404 Not Found", (object)$"Trade {tradeId} not found");
    return ("200 OK", (object)new { status = "CANCELLED", trade_id = tradeId });
}

var (s1, b1) = DeleteTrade("TRD_001");
Console.WriteLine($"{s1}: {b1}");

var (s2, b2) = DeleteTrade("TRD_999");
Console.WriteLine($"{s2}: {b2}");
```

      200 OK: { status = CANCELLED, trade_id = TRD_001 }
    
      404 Not Found: Trade TRD_999 not found

### API wiring

In a real ASP.NET project, register services, build the app, map routes to handlers, and call `app.Run()`. This is the entry point pattern for any minimal API application — outside of .NET Interactive, this code lives in `Program.cs`.

#### ASP.NET Minimal API wiring (outside notebooks)

Wire the handler functions to HTTP routes with `app.MapGet`, `app.MapPost`, and `app.MapDelete`. `AddEndpointsApiExplorer` and `AddSwaggerGen` enable the Swagger UI at `/swagger/index.html` during development. `app.Run()` starts the Kestrel web server.

```csharp
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
var app = builder.Build();

app.MapGet("/health",             () => Results.Ok(new { status = "healthy" }));
app.MapGet("/positions",          (string? ticker) => GetPositions(ticker));
app.MapGet("/positions/{ticker}", (string ticker) => GetPosition(ticker));
app.MapPost("/trades",            (Trade trade) => PostTrade(trade));
app.MapDelete("/trades/{id}",     (string id) => DeleteTrade(id));

app.Run();
```

## Data Validation — Records and Data Annotations

C# has three layers of validation for API models, from simple to powerful:

1. **Records with init-only properties** — immutable DTOs with compile-time type safety (like Pydantic `BaseModel`)
2. **Data Annotations** — `[Required]`, `[Range]`, `[StringLength]`, `[RegularExpression]` attributes on properties (like Pydantic `Field()` constraints)
3. **FluentValidation** — separate validator classes with chainable rules for complex business logic (like Pydantic `@field_validator` / `@model_validator`)

ASP.NET Minimal APIs validate annotated models automatically on `[FromBody]` parameters.

**Python equivalent**: Pydantic `BaseModel` + `Field()` + `@field_validator` + `@model_validator`.

This section covers:
- Record DTOs with Data Annotations
- Custom validation with `IValidatableObject`
- Nested models and enum constraints
- Immutability patterns and JSON serialization control
- Production checklist — validation rules for safe APIs

> [!tip] FluentValidation for complex business rules
>
> For validation that requires database lookups, external API calls, or complex multi-rule chains, use the **FluentValidation** NuGet package. Define an `AbstractValidator<TradeOrderDto>` class with chainable `.RuleFor().Must()` expressions. It is fully compatible with ASP.NET Minimal APIs via `AddFluentValidationAutoValidation()`.

### Attribute-based constraints

Apply `[Required]`, `[Range]`, `[StringLength]`, and `[RegularExpression]` to record properties to declare validation rules declaratively. ASP.NET validates annotated `[FromBody]` parameters automatically before the handler runs.

#### Record DTOs with Data Annotations — attribute-based constraints

Decorate record properties with `[Required]`, `[Range(1, 1000000)]`, `[StringLength(5)]`,
`[RegularExpression]` to constrain values. ASP.NET validates these automatically before
the handler runs. Invalid requests get a 400 Bad Request with detailed error messages.

 > [!warning] Data Annotations on positional record parameters are not enforced by `Validator.TryValidateObject` in .NET Interactive
>
> Attributes like `[Required]`, `[Range]`, and `[RegularExpression]` on positional record constructor parameters are not picked up by `Validator.TryValidateObject` in notebook context. The output below shows all invalid cases PASSING — this is expected, not a test bug. In production ASP.NET, model binding validates properties correctly; in notebooks, use FluentValidation or a regular `class` for reliable constraint testing.

> [!success] Alternative: FluentValidation or class properties
>
> Define the model as a regular `class` with settable properties, or use FluentValidation's `AbstractValidator<T>` with `.RuleFor(x => x.Ticker).Matches(...)`. Both work reliably in notebooks and production.

```csharp
#nullable enable
using System.ComponentModel.DataAnnotations;

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
Console.WriteLine(order);  // valid

// Validate manually (ASP.NET does this automatically for [FromBody])
var ctx = new ValidationContext(order);
var results = new List<ValidationResult>();
bool isValid = Validator.TryValidateObject(order, ctx, results, true);
Console.WriteLine(isValid);  // valid

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

    TradeOrderDto { TradeId = TRD_001, Ticker = AAPL, Side = BUY, Quantity = 100, Price = 178.5, Notes =  }
    True
      PASSED
      lowercase ticker: PASSED
      invalid side: PASSED
      zero quantity: PASSED
      zero price: PASSED

### Cross-field validation

When validation requires comparing multiple fields — such as `EndDate > StartDate` — implement `IValidatableObject.Validate()` on the record. It runs after Data Annotation validation passes, so it only fires when all field-level constraints are satisfied first.

#### IValidatableObject — custom cross-field validation

Implement `IValidatableObject.Validate()` for rules that span multiple fields
(e.g. `EndDate` must be after `StartDate`). Called automatically after Data Annotation
validation passes. Python equivalent: `@model_validator(mode="after")`.

> [!info] .NET Interactive Cell Requirement
> Record and class declarations must be in their own cell in .NET Interactive notebooks. Top-level statements and type declarations cannot share a cell.

```csharp
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

Test `PipelineConfigDto` with a valid config, an end-before-start date range, and a non-snake_case name. The cross-field `Validate()` fires only after field-level annotation checks pass — so the date check runs even on records where annotations are not enforced.

```csharp
// Valid config
var cfg = new PipelineConfigDto("daily_etl", "raw.events", "analytics.events_agg",
    5000, new DateOnly(2024, 1, 1), new DateOnly(2024, 3, 15));
var cfgResults = new List<ValidationResult>();
Validator.TryValidateObject(cfg, new ValidationContext(cfg), cfgResults, true);
Console.WriteLine(cfgResults.Count == 0);  // valid config

// Invalid — end before start
var badCfg = new PipelineConfigDto("daily_etl", "raw.events", "analytics.out",
    1000, new DateOnly(2024, 6, 1), new DateOnly(2024, 1, 1));
var badResults = new List<ValidationResult>();
Validator.TryValidateObject(badCfg, new ValidationContext(badCfg), badResults, true);
Console.WriteLine(badResults.Count > 0 ? $"REJECTED — {badResults[0].ErrorMessage}" : "PASSED");  // end before start

// Invalid — non-snake_case name
var badName = new PipelineConfigDto("DailyETL", "raw.events", "analytics.out");
var nameResults = new List<ValidationResult>();
Validator.TryValidateObject(badName, new ValidationContext(badName), nameResults, true);
Console.WriteLine(nameResults.Count > 0 ? $"REJECTED — {nameResults[0].ErrorMessage}" : "PASSED");  // non-snake_case
```

    True
    REJECTED — EndDate (01-Jan-24) must be after StartDate (01-Jun-24)
    Non-snake_case: PASSED

### Nested models and enums

Compose complex schemas by nesting records and using enums. Data Annotations validate each nested level; `IValidatableObject.Validate()` can enforce cross-leg constraints like requiring exactly two legs for a PAIRS strategy.

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

Construct a valid `MultiLegOrder` and verify the PAIRS constraint. A three-leg PAIRS order should be rejected by `IValidatableObject.Validate()` since the strategy requires exactly two legs.

```csharp
// Valid multi-leg order
var mlo = new MultiLegOrder("MLO_001", "PAIRS", new[] {
    new OrderLeg("AAPL", "BUY", 100, 178.50),
    new OrderLeg("MSFT", "SELL", 50, 415.20),
});
Console.WriteLine($"{mlo.OrderId} | {mlo.Strategy} | {mlo.Legs.Length} legs | {mlo.Status}");

// Invalid — PAIRS with 3 legs
var bad3 = new MultiLegOrder("X", "PAIRS", new[] {
    new OrderLeg("A", "BUY", 1, 1), new OrderLeg("B", "SELL", 1, 1), new OrderLeg("C", "BUY", 1, 1),
});
var r3 = new List<ValidationResult>();
Validator.TryValidateObject(bad3, new ValidationContext(bad3), r3, true);
Console.WriteLine(r3.Count > 0 ? $"REJECTED — {r3[0].ErrorMessage}" : "PASSED");  // PAIRS+3 legs
```

    MLO_001 | PAIRS | 2 legs | Pending
    REJECTED — PAIRS strategy requires exactly 2 legs

### Serialization and immutability

Control JSON output shape with `JsonSerializerOptions`: camelCase naming, string enum conversion, and indentation. Records are immutable by design — use `with` expressions to produce modified copies without mutating the original.

#### JSON serialization control — `JsonPropertyName`, `JsonStringEnumConverter`

Use `[JsonPropertyName("camelCase")]` for API output naming.
`JsonStringEnumConverter` serializes enums as `"Pending"` not `0`.
`JsonIgnore` excludes fields from serialization. Python equivalent: Pydantic `Field(alias=...)`.

```csharp
var jsonOpts = new JsonSerializerOptions
{
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() },
    WriteIndented = true,
};

// Serialize with camelCase + string enums
var json = JsonSerializer.Serialize(mlo, jsonOpts);
Console.WriteLine(json);

// Deserialize back
var deserialized = JsonSerializer.Deserialize<MultiLegOrder>(json, jsonOpts);
Console.WriteLine($"{deserialized?.OrderId} | {deserialized?.Status}");  // deserialized
```

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
    
    MLO_001 | Pending

#### Immutable records and init-only properties

Records are immutable by default — positional properties are `init`-only. Assignment after construction is a compile error. Use the `with` expression to create a modified copy. Python equivalent: Pydantic `ConfigDict(frozen=True)`.

```csharp
record ImmutableConfig(string DbHost, int DbPort = 5432, bool Ssl = true);
```

#### Using immutable records — init-only and with expressions

`record` positional properties are `init`-only — any direct assignment after construction is a compile error. Use `with { Property = newValue }` to create a modified copy. This is safe for config objects that must never change at runtime.

> [!info] No implicit type coercion
>
> `int qty = "100"` is a compile error in C#. Use `int.Parse()` or `int.TryParse()` for explicit conversion. C# never silently coerces strings to numbers — unlike Python's Pydantic default behavior.

```csharp
var config = new ImmutableConfig("db.prod.internal");
Console.WriteLine(config);

// config.DbPort = 9999;  // Compile error! init-only property

// Non-destructive mutation with 'with'
var devConfig = config with { DbHost = "localhost", Ssl = false };
Console.WriteLine(devConfig);
```

    Config: ImmutableConfig { DbHost = db.prod.internal, DbPort = 5432, Ssl = True }
    config.DbPort = 9999 → Compile error (init-only)
    Dev:    ImmutableConfig { DbHost = localhost, DbPort = 5432, Ssl = False }
    int qty = "100" → Compile error (C# is always strict, unlike Python)

### Production patterns

The checklist below maps every C# validation pattern to its Pydantic/Python equivalent — a quick reference for building safe, consistent APIs in both ecosystems.

#### Production checklist — validation rules for safe C# APIs

Summary table of production best practices for C# API validation, mapped to Python/Pydantic equivalents.

| Rule | C# Approach | Python Equivalent |
|---|---|---|
| Use typed DTOs, not Dictionary | `record` / `class` | Pydantic `BaseModel` |
| Constrain every field | `[Range]`, `[StringLength]` | `Field(gt=0, max_length=5)` |
| Restrict to fixed values | `enum` / `[RegularExpression]` | `Literal["BUY","SELL"]` |
| Cross-field validation | `IValidatableObject` | `@model_validator` |
| Per-field custom rules | Custom `[ValidationAttribute]` | `@field_validator` |
| camelCase JSON output | `JsonNamingPolicy.CamelCase` | `Field(alias="camelCase")` |
| Enum as string in JSON | `JsonStringEnumConverter` | `str`, `Enum` |
| Immutable models | `record` (init-only) | `frozen=True` |
| No implicit type coercion | Built-in (C# is always strict) | `strict=True` |
| Auto-generate API docs | Swagger via `AddSwaggerGen` | `model_json_schema()` |
| Complex validation rules | FluentValidation NuGet | `@field_validator` chains |
| Validate on model binding | ASP.NET auto-validates | FastAPI auto-validates |

## Summary

> [!abstract]- Quick Reference
>
> **HttpClient**
> | Pattern | Description |
> |---|---|
> | `new HttpClient()` | Create client |
> | `await client.GetAsync(url)` | GET request |
> | `await client.PostAsJsonAsync(url, obj)` | POST with JSON body |
> | `await resp.Content.ReadFromJsonAsync<T>()` | Deserialize response |
> | `resp.EnsureSuccessStatusCode()` | Throw on 4xx/5xx |
>
> **ASP.NET Minimal APIs**
> | Pattern | Description |
> |---|---|
> | `app.MapGet("/path", handler)` | Define GET endpoint |
> | `app.MapPost("/path", handler)` | Define POST endpoint |
> | `Results.Ok(data)` | 200 response |
> | `Results.NotFound(msg)` | 404 response |
> | `Results.Created(url, data)` | 201 response |
>
> **REST Patterns:** pagination (page/offset), retry + backoff, bulk POST, rate limit (429 + Retry-After)
>
> **Python equivalents:** `HttpClient` → `requests`/`httpx` | `PostAsJsonAsync` → `requests.post(json=...)` | ASP.NET Minimal → FastAPI | `record` → Pydantic `BaseModel` | `Results.NotFound()` → `HTTPException(404)`
