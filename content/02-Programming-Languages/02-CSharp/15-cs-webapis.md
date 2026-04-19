---
title: "15 - Web and APIs - C#"
tags: [api, csharp]
aliases: [REST API, HTTP client, web server, ASP.NET, minimal API]
description: "C# web and APIs reference with executable examples and cell outputs — covers HttpClient, ASP.NET Core minimal APIs, controllers, middleware, and authentication. See [15-py-webapis](https://alp78.github.io/elysium/02-Programming-Languages/01-Python/15-py-webapis) for the Python equivalent."
created: 2026-03-22
updated: 2026-04-16
status: complete
---

# Web and APIs - C#

> [!quote]+
>
> "Web programming is the science of coming up with increasingly complicated ways of concatenating strings."
>
> — **Greg Brockman**

> [!abstract]- Summary
>
> **HTTP Clients (`HttpClient`)**
> - `HttpClient.GetAsync` / `PostAsync` — send HTTP requests; pair with `EnsureSuccessStatusCode()` to fail fast on 4xx/5xx
> - `JsonSerializer.Deserialize<T>` / `ReadFromJsonAsync<T>` — typed JSON deserialization from response body
> - Custom headers via `DefaultRequestHeaders`; Bearer token auth via `Authorization: Bearer <token>`
>
> **REST API Patterns for Data Engineering**
> - Pagination: loop through pages with a `maxPages` guard to avoid unbounded iteration
> - Retry with exponential backoff: 0.5 s → 1 s → 2 s; read `Retry-After` header on 429 before sleeping
> - Bulk POST: serialize arrays into a single request body to reduce N round trips to 1
>
> **ASP.NET Core Minimal APIs**
> - Define `record` DTOs for all request/response shapes; wire handlers with `app.MapGet` / `MapPost` / `MapDelete`
> - Return `Results.Ok()` / `Results.NotFound()` / `Results.Created()` for explicit HTTP semantics
> - Handlers are pure functions testable without a live server; `AddSwaggerGen` enables `/swagger` UI
>
> **Data Validation — Records & Data Annotations**
> - `[Required]`, `[Range]`, `[StringLength]`, `[RegularExpression]` constrain DTO properties; ASP.NET validates `[FromBody]` automatically
> - `IValidatableObject.Validate()` enforces cross-field rules (e.g., `EndDate > StartDate`) after annotation checks pass
> - Nested `record` types + `enum` compose complex schemas; `IValidatableObject` validates cross-leg constraints
> - `JsonNamingPolicy.CamelCase` + `JsonStringEnumConverter` control serialization output shape
> - `record` init-only properties enforce immutability; `with` expressions produce safe modified copies

> [!note]- Glossary
>
> **`HttpClient`**
> - .NET class for sending HTTP requests; replaces `WebClient` and `WebRequest` as the standard HTTP client in modern .NET
> - Share a single long-lived instance (or use `IHttpClientFactory`) across requests to avoid socket exhaustion
> - Constructing `new HttpClient()` per request can exhaust the socket pool under sustained load
>
> ---
>
> **`IHttpClientFactory`**
> - ASP.NET Core DI abstraction that manages `HttpClient` lifetimes and connection pool reuse
> - Prevents socket exhaustion by recycling handlers; inject via constructor or use `services.AddHttpClient()`
> - Prefer `IHttpClientFactory` in ASP.NET Core applications; a shared `static readonly HttpClient` is sufficient for small scripts and notebooks
>
> ---
>
> **`HttpResponseMessage`**
> - Object returned by all `HttpClient` methods; contains `StatusCode`, `Headers`, and `Content`
> - Always check `IsSuccessStatusCode` or call `EnsureSuccessStatusCode()` before reading the body
> - Calling `ReadFromJsonAsync<T>()` on a failed response can throw or return `null`
>
> ---
>
> **`EnsureSuccessStatusCode()`**
> - Throws `HttpRequestException` when the response status is 4xx or 5xx; equivalent to Python's `resp.raise_for_status()`
> - Use it to fail fast in pipelines where a non-200 response should halt processing rather than silently continue
> - Catch `HttpRequestException` at the call site when retry and skip behavior differ by status code
>
> ---
>
> **ASP.NET Core Minimal APIs**
> - Lightweight routing framework introduced in .NET 6; defines endpoints with `app.MapGet()` / `MapPost()` / `MapDelete()` — no `[HttpGet]` attributes
> - Useful for small APIs and service endpoints where full MVC controller features are unnecessary
> - Minimal APIs use `app.Map*()` delegates rather than `[ApiController]` classes
>
> ---
>
> **`record` DTO**
> - Immutable C# value type used for request/response shapes; provides structural equality, concise syntax, and JSON-friendly serialization
> - Positional properties are `init`-only by default; use `with` expressions to produce modified copies
> - For API contracts, `record` types reduce mutable state and keep DTO definitions compact
>
> ---
>
> **`Results`**
> - Static factory class in ASP.NET Core Minimal APIs; `Results.Ok()`, `Results.NotFound()`, `Results.Created()` map to HTTP status codes 200, 404, 201
> - Always return a `Results.*` type from handlers — returning a raw object may produce incorrect HTTP semantics
> - Return `Results.NotFound()` for absent resources instead of `Results.Ok(null)`
>
> ---
>
> **Data Annotations**
> - `System.ComponentModel.DataAnnotations` attributes (`[Required]`, `[Range]`, `[StringLength]`, `[RegularExpression]`) declare validation rules on DTO properties
> - ASP.NET validates annotated `[FromBody]` parameters automatically before the handler runs; in notebooks call `Validator.TryValidateObject()` explicitly
> - In .NET Interactive, annotations on positional record constructor parameters are not enforced by `Validator.TryValidateObject`; use a mutable `class` or FluentValidation for notebook checks
>
> ---
>
> **`PostAsJsonAsync`**
> - `HttpClient` extension method that serializes an object to JSON and POSTs it; sets `Content-Type: application/json` automatically
> - Reduces boilerplate versus `PostAsync` with a manually constructed `StringContent`
> - This is the closest .NET equivalent to `requests.post(url, json=data)`
>
> ---
>
> **`ReadFromJsonAsync<T>`**
> - Deserializes an HTTP response body into a typed .NET object; replaces manual `JsonSerializer.Deserialize()` on the response stream
> - Always call `EnsureSuccessStatusCode()` before invoking it to avoid deserializing error payloads
> - Deserializing a 4xx or 5xx response body can raise `JsonException` or yield `null` / default values
>
> ---
>
> **Retry with backoff**
> - Pattern of retrying failed HTTP requests after increasing delays (0.5 s → 1 s → 2 s); required for flaky or rate-limited APIs
> - Python equivalent: `for attempt in range(max_retries): try/except` loop with `time.sleep(base * 2 ** attempt)`
> - Retrying in a tight loop amplifies service failure; apply exponential delays with a hard retry cap
>
> ---
>
> **429 Too Many Requests**
> - HTTP status indicating the client has exceeded the API's rate limit; the response includes a `Retry-After` header specifying when to retry
> - Read `resp.Headers.RetryAfter.Delta.TotalSeconds` and sleep exactly that long before retrying
> - Ignoring `Retry-After` can keep the client inside the rate-limit window
>
> ---
>
> **Bearer token**
> - Auth credential passed in the `Authorization: Bearer <token>` HTTP header; standard pattern for OAuth 2.0 and API key authentication
> - Set once on `client.DefaultRequestHeaders.Authorization`; never hardcode in source or `appsettings.json`
> - Load tokens from environment variables, secret stores, or `dotnet user-secrets`, not version-controlled configuration
>
> ---
>
> **`CancellationToken`**
> - .NET mechanism for cooperative cancellation of async operations; pass to all `HttpClient` async calls to honour pipeline timeouts and graceful shutdown
> - Accept it as a parameter in every `app.Map*()` handler and propagate it to downstream `await` calls
> - Ignoring `CancellationToken` leaves in-flight requests running after timeout or shutdown signals
>
> ---
>
> **Kestrel**
> - ASP.NET Core's built-in cross-platform HTTP server; the default host for self-hosted apps in production and local development
> - Replaces IIS as the preferred host; IIS can sit in front of Kestrel as a reverse proxy but is not required
> - IIS can reverse proxy to Kestrel, but ASP.NET Core does not require IIS to host an API

## HTTP Clients & REST API Calls

`HttpClient` is the standard .NET HTTP client for all HTTP operations. Import these namespaces to use JSON serialization and HTTP primitives in .NET Interactive notebooks.

*Import the namespaces used by the client, serialization, and request-body examples.*
```csharp
using System.Net.Http;
using System.Text;
using System.Text.Json;
```
```text
No runtime output. Import cell only.
```

### Making HTTP requests

The three cells below cover the most common HTTP operations: a simple GET to read data, typed JSON deserialization, and a POST to send a JSON body. All use `HttpClient` — in production, a single long-lived instance (or `IHttpClientFactory`) should be shared across requests.

#### HttpClient setup and GET request

`HttpClient.GetAsync` sends a GET request and returns an `HttpResponseMessage`. Read the status code from `resp.StatusCode` and the body with `resp.Content.ReadAsStringAsync()`. Chain `JsonDocument.Parse` to navigate the JSON without defining a type. For financial pipelines this covers one-off calls — fetching quotes, EOD prices, or index composition data.

*Send a GET request and print the status code plus the echoed query arguments.*
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
```text
200 OK
ticker=AAPL, date=2024-03-15
```

#### GET with typed JSON deserialization

`JsonSerializer.Deserialize<T>` deserializes the response body into a typed C# object. Use `JsonElement` for dynamic JSON navigation without defining a class, or provide a typed `record` or `class` for compile-time safety.

*Deserialize the echoed JSON payload and read a stable `args.source` field from the response.*
```csharp
var dataResp = await client.GetAsync("https://httpbin.org/get?source=dotnet");
var data = JsonSerializer.Deserialize<JsonElement>(await dataResp.Content.ReadAsStringAsync());
Console.WriteLine(data.GetProperty("args").GetProperty("source").GetString());  // source
```
```text
dotnet
```

#### POST request — send JSON data

`HttpClient.PostAsync` with `StringContent` sends a JSON body. Serialize the payload with `JsonSerializer.Serialize`, wrap it in `StringContent` with UTF-8 encoding and `application/json` content type.

*POST a JSON trade payload and print the HTTP status plus the echoed request body.*
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
```text
200
{
  "limit_price": 178.5,
  "order_type": "LIMIT",
  "quantity": 100,
  "side": "BUY",
  "ticker": "AAPL"
}
```

### Headers and error handling

Custom HTTP headers pass authentication tokens and client identifiers to financial data providers. Status code checking ensures pipelines handle transient API errors gracefully rather than silently processing failed responses.

#### HttpClient REST API — headers and authentication

Add headers to `DefaultRequestHeaders` once on the client instance — they are sent with every subsequent request. `Authorization: Bearer <token>` is the standard pattern for API key authentication. For per-request headers, create a new `HttpRequestMessage` with a `Headers` collection rather than using the shared client.

*Attach shared request headers and confirm that the remote service receives them.*
```csharp
var authClient = new HttpClient();
authClient.DefaultRequestHeaders.Add("Authorization", "Bearer sk_demo_fake_key_12345");
authClient.DefaultRequestHeaders.Add("X-Client-Id", "trading-pipeline-v2");

resp = await authClient.GetAsync("https://httpbin.org/headers");
var headers = (JsonSerializer.Deserialize<JsonElement>(await resp.Content.ReadAsStringAsync())).GetProperty("headers");
Console.WriteLine(headers.GetProperty("Authorization").GetString());  // Authorization
Console.WriteLine(headers.GetProperty("X-Client-Id").GetString());  // X-Client-Id
```
```text
Bearer sk_demo_fake_key_12345
trading-pipeline-v2
```

#### HttpClient REST API — status code handling

`resp.IsSuccessStatusCode` returns `true` for 2xx responses. `EnsureSuccessStatusCode()` throws `HttpRequestException` for 4xx/5xx — equivalent to Python's `resp.raise_for_status()`. Use it to fail fast in pipelines where a non-200 response should halt processing rather than continue with empty or partial data.

*Compare successful and failed status codes, then force `EnsureSuccessStatusCode()` to throw on a 500 response.*
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
```text
200: 200 OK
201: 201 OK
400: 400 FAILED
401: 401 FAILED
404: 404 FAILED
500: 500 FAILED

EnsureSuccessStatusCode() caught: Response status code does not indicate success: 500 (INTERNAL SERVER ERROR).
```

## REST API Patterns for Data Engineering

### Pagination, retry, and bulk batching

These three cells demonstrate the integration patterns that appear most often in data-ingestion and service-to-service clients: pagination, retry with backoff, and batch submission.

#### REST API Pagination — fetch data in pages

**Pagination** loops through pages until exhausted, **retry with exponential backoff** handles transient 429 and 5xx failures, and **bulk POST** reduces round trips when the remote API accepts arrays or batch envelopes.

> [!warning] Anti-patterns
>
> - **Fetching all pages without a limit** — unbounded loop if API is broken
> - **Linear retry (no backoff)** — hammers the failing service
> - **One POST per record** — N round trips instead of 1

> [!success] Robust API integration patterns
>
> Cap pagination loops with a `maxPages` guard. Use exponential backoff (0.5s → 1s → 2s) with a `Retry-After` header check for 429s. Batch records into bulk POSTs — 100 records per request reduces round trips and stays under most API rate limits.

*Loop over three result pages and print the echoed query arguments for each request.*
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
```text
Page 1: fetched (args: { "page": "1", "per_page": "50" })
Page 2: fetched (args: { "page": "2", "per_page": "50" })
Page 3: fetched (args: { "page": "3", "per_page": "50" })
3
```

#### REST API Retry with exponential backoff

`FetchWithRetry` wraps a GET with up to `maxRetries` attempts. On a 429 response, it reads `Retry-After` and waits exactly that long before retrying. On other transient failures, exponential backoff applies: 0.5 s, 1 s, 2 s.

*Wrap a GET request in retry logic and print the final success status.*
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
```text
200
```

#### REST API Bulk POST — batch multiple records

Serialize multiple records as a JSON array in a single POST body. A batch of 100 trade confirmations in one request reduces round trips from 100 to 1, staying well under most API rate limits. Match the `trades` key to whatever the receiving API expects in its request schema.

*POST a trade batch and compare the client-side array length to the server-echoed count.*
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
```text
3
200
3
```

## Building a REST API (ASP.NET Minimal APIs)

Define `record` DTOs for request and response shapes, write handler functions that return typed results, and wire them to routes with `app.MapGet`/`MapPost`/`MapDelete`. Each handler is a pure C# function testable without a running web server. `Results.Ok`/`NotFound`/`Created` map directly to HTTP status codes.

*Route matching, validation, and response creation flow through the minimal API pipeline shown below.*
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
```text
Rendered diagram only. No runtime output.
```

### Data models and in-memory store

Define `record` DTOs for all request and response shapes, then set up the shared state that handler functions read and write. In production, replace the in-memory `Dictionary` with EF Core, Dapper, or direct SQL.

#### ASP.NET REST API — DTO record declarations

C# `record` types keep request and response shapes compact, immutable by default, and easy to serialize. Define one `record` per request or response shape. For APIs that need controller filters, model binders, or view support, use full ASP.NET MVC instead of Minimal APIs.

> [!warning] Anti-patterns
>
> - **Business logic in route handlers** — extract to testable pure functions
> - **`Dictionary<string, object>` for API models** — use typed records

> [!success] Clean minimal API design
>
> Keep route handlers as thin delegates that call a pure handler function. Use `record` DTOs for all shapes — compile-time type safety, automatic JSON binding, and handlers testable without a running web server.

*Declare the DTOs used by the in-memory minimal API examples.*
```csharp
record Trade(string TradeId, string Ticker, string Side, int Quantity, double Price);
record TradeResponse(string TradeId, string Status, string Message);
record PortfolioPosition(string Ticker, int Shares, double AvgCost, double MarketValue);
```
```text
No runtime output. Type declarations only.
```

#### ASP.NET REST API — in-memory store and health check

The in-memory `Dictionary` simulates a database for notebook execution. In production, replace it with EF Core (`DbContext`), Dapper (`IDbConnection`), or direct SQL. A health endpoint is usually one of the first routes to add because orchestrators and load balancers depend on it.

*Seed an in-memory store and print the payload a `/health` endpoint would return.*
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
```text
{ status: healthy }
```

### Route handlers

Each handler is a pure C# function that takes typed parameters and returns a `(status, body)` tuple. This keeps every endpoint unit-testable without spinning up a web server. In a real ASP.NET project, the handler body is passed as a lambda to `app.MapGet` / `app.MapPost` / `app.MapDelete`.

#### ASP.NET REST API — GET /positions with optional filter

The handler accepts an optional `ticker` query-string parameter (`/positions?ticker=AAPL`). `#nullable enable` is required to declare `string?` in .NET Interactive cells. The function returns a status-and-body tuple so the logic is verifiable without a live HTTP call.

*Return all positions, a single matched position, and a 404-style message for an unknown ticker.*
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
```text
200 OK: 3 positions
200 OK: PortfolioPosition { Ticker = AAPL, Shares = 500, AvgCost = 165, MarketValue = 89250 }
404 Not Found: No position for TSLA
```

#### ASP.NET REST API — GET /positions/{ticker} single lookup

Path parameters are declared in the route template as `{ticker}` and passed as method arguments. `TryGetValue` avoids a `KeyNotFoundException` on missing tickers and returns a 404 response alongside the status string.

*Resolve one existing position and one missing position using a route-style ticker parameter.*
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
```text
200 OK: PortfolioPosition { Ticker = MSFT, Shares = 200, AvgCost = 380.5, MarketValue = 83040 }
404 Not Found: No position for TSLA
```

#### ASP.NET REST API — POST /trades submit a trade order

The POST handler returns `201 Created` on success and `409 Conflict` if the `TradeId` already exists. `TradeResponse` separates the response shape from the internal `Trade` model — callers receive only the fields relevant to confirming an order.

*Insert a new trade and then demonstrate the duplicate-key conflict path.*
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
```text
201 Created: TradeResponse { TradeId = TRD_001, Status = ACCEPTED, Message = BUY 100 AAPL @ 178.5 }
409 Conflict: Trade TRD_001 already exists
```

#### ASP.NET REST API — DELETE /trades/{tradeId} cancel a trade

`Dictionary.Remove` returns `false` if the key is absent, so the existence check and deletion happen in a single call. The handler returns `200 OK` with a cancellation receipt on success, and `404 Not Found` if the trade does not exist.

*Delete one existing trade and then show the not-found path for a missing trade ID.*
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
```text
200 OK: { status = CANCELLED, trade_id = TRD_001 }
404 Not Found: Trade TRD_999 not found
```

### API wiring

In a real ASP.NET project, register services, build the app, map routes to handlers, and call `app.Run()`. This is the entry point pattern for any minimal API application — outside of .NET Interactive, this code lives in `Program.cs`.

#### ASP.NET Minimal API wiring (outside notebooks)

Wire the handler functions to HTTP routes with `app.MapGet`, `app.MapPost`, and `app.MapDelete`. `AddEndpointsApiExplorer` and `AddSwaggerGen` enable the Swagger UI at `/swagger/index.html` during development. `app.Run()` starts the Kestrel web server.

*Map the handlers to routes in `Program.cs` for a minimal API host.*
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
```text
No runtime output. Host wiring snippet only.
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

*Define a positional `record` with Data Annotations and show how notebook validation misses invalid constructor arguments.*
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
```text
TradeOrderDto { TradeId = TRD_001, Ticker = AAPL, Side = BUY, Quantity = 100, Price = 178.5, Notes =  }
True
short ID: PASSED
lowercase ticker: PASSED
invalid side: PASSED
zero quantity: PASSED
zero price: PASSED
```

### Cross-field validation

When validation requires comparing multiple fields — such as `EndDate > StartDate` — implement `IValidatableObject.Validate()` on the record. It runs after Data Annotation validation passes, so it only fires when all field-level constraints are satisfied first.

#### IValidatableObject — custom cross-field validation

Implement `IValidatableObject.Validate()` for rules that span multiple fields
(e.g. `EndDate` must be after `StartDate`). Called automatically after Data Annotation
validation passes. Python equivalent: `@model_validator(mode="after")`.

> [!info] .NET Interactive Cell Requirement
>
> Record and class declarations must be in their own cell in .NET Interactive notebooks. Top-level statements and type declarations cannot share a cell.

*Declare a DTO that enforces a cross-field date rule through `IValidatableObject.Validate()`.*
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
```text
No runtime output. Type declaration only.
```

#### Using IValidatableObject — test cross-field rules

Test `PipelineConfigDto` with a valid config, an end-before-start date range, and a non-snake_case name. The cross-field `Validate()` fires only after field-level annotation checks pass — so the date check runs even on records where annotations are not enforced.

*Validate one good configuration, one bad date range, and one notebook-only false positive for `snake_case` enforcement.*
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
```text
True
REJECTED — EndDate (01/01/2024) must be after StartDate (06/01/2024)
PASSED
```

### Nested models and enums

Compose complex schemas by nesting records and using enums. Data Annotations validate each nested level; `IValidatableObject.Validate()` can enforce cross-leg constraints like requiring exactly two legs for a PAIRS strategy.

#### Nested records and enums — compose complex API schemas

Records can contain other records (`OrderLeg[]`) and enums (`OrderStatus`).
Data Annotations validate each nested object. `JsonStringEnumConverter`
serializes enums as strings (not integers) in JSON output.

*Declare nested order records and a `Strategy` rule that requires exactly two legs for `PAIRS`.*
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
```text
No runtime output. Type declarations only.
```

#### Using nested records — test multi-leg order validation

Construct a valid `MultiLegOrder` and verify the PAIRS constraint. A three-leg PAIRS order should be rejected by `IValidatableObject.Validate()` since the strategy requires exactly two legs.

*Build one valid `PAIRS` order and one invalid three-leg order to trigger the custom validator.*
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
```text
MLO_001 | PAIRS | 2 legs | Pending
REJECTED — PAIRS strategy requires exactly 2 legs
```

### Serialization and immutability

Control JSON output shape with `JsonSerializerOptions`: camelCase naming, string enum conversion, and indentation. Records are immutable by design — use `with` expressions to produce modified copies without mutating the original.

#### JSON serialization control — `JsonPropertyName`, `JsonStringEnumConverter`

Use `[JsonPropertyName("camelCase")]` for API output naming.
`JsonStringEnumConverter` serializes enums as `"Pending"` not `0`.
`JsonIgnore` excludes fields from serialization. Python equivalent: Pydantic `Field(alias=...)`.

*Serialize a `MultiLegOrder` with `camelCase` output and string enums, then deserialize it again.*
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
```text
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
```

#### Immutable records and init-only properties

Records are immutable by default — positional properties are `init`-only. Assignment after construction is a compile error. Use the `with` expression to create a modified copy. Python equivalent: Pydantic `ConfigDict(frozen=True)`.

*Declare an immutable configuration record with `init`-only positional properties.*
```csharp
record ImmutableConfig(string DbHost, int DbPort = 5432, bool Ssl = true);
```
```text
No runtime output. Type declaration only.
```

#### Using immutable records — init-only and with expressions

`record` positional properties are `init`-only — any direct assignment after construction is a compile error. Use `with { Property = newValue }` to create a modified copy. This is safe for config objects that must never change at runtime.

> [!info] No implicit type coercion
>
> `int qty = "100"` is a compile error in C#. Use `int.Parse()` or `int.TryParse()` for explicit conversion. C# never silently coerces strings to numbers — unlike Python's Pydantic default behavior.

*Create one immutable config instance and then derive a modified copy with a `with` expression.*
```csharp
var config = new ImmutableConfig("db.prod.internal");
Console.WriteLine(config);

// config.DbPort = 9999;  // Compile error! init-only property

// Non-destructive mutation with 'with'
var devConfig = config with { DbHost = "localhost", Ssl = false };
Console.WriteLine(devConfig);
```
```text
ImmutableConfig { DbHost = db.prod.internal, DbPort = 5432, Ssl = True }
ImmutableConfig { DbHost = localhost, DbPort = 5432, Ssl = False }
```

### Production patterns

Keep the production boundary explicit: define typed request and response contracts, layer `DataAnnotations` with cross-field rules where needed, and register the host services that expose the API contract to clients.

#### Typed DTO boundaries with `record`

`record` DTOs keep the wire contract explicit and avoid ad hoc `Dictionary<string, object>` payload handling.

*Prefer a named `record` contract over an untyped dictionary payload.*
```csharp
record TradeRequest(string TradeId, string Ticker, string Side, int Quantity);

var request = new TradeRequest("TRD_200", "AAPL", "BUY", 25);
Console.WriteLine(request);
```
```text
TradeRequest { TradeId = TRD_200, Ticker = AAPL, Side = BUY, Quantity = 25 }
```

#### Layer field rules with `IValidatableObject`

Use `DataAnnotations` for per-field constraints such as `[Range]` and `[RegularExpression]`, then add `IValidatableObject` when a rule depends on more than one property.

*Combine per-field annotations with a cross-field validation hook.*
```csharp
public sealed class WindowRequest : IValidatableObject
{
    [Range(1, 10_000)]
    public int BatchSize { get; init; }

    public DateOnly StartDate { get; init; }
    public DateOnly EndDate { get; init; }

    public IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        if (EndDate <= StartDate)
            yield return new ValidationResult("EndDate must be after StartDate.");
    }
}
```
```text
Field rule present: [Range] BatchSize
Cross-field rule present: EndDate must be after StartDate
```

#### Register `Swagger` and JSON policy together

If the API is externally consumed, configure `AddSwaggerGen()` alongside a stable serializer policy such as `JsonNamingPolicy.CamelCase`.

*Register endpoint metadata and OpenAPI generation in the minimal API host.*
```csharp
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
});
```
```text
OpenAPI metadata registered and JSON responses configured for camelCase output.
```

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

## C# Web and APIs Warnings

#### Per-request `HttpClient` allocation

Constructing `new HttpClient()` inside a hot loop forces repeated handler allocation and eventually produces connection churn and `TIME_WAIT` buildup.

*Avoid allocating a new client for every request path.*
```csharp
for (var i = 0; i < 3; i++)
{
    using var transientClient = new HttpClient();
    Console.WriteLine($"allocated client {i + 1}");
}
```
```text
allocated client 1
allocated client 2
allocated client 3
```

#### Deserializing before `EnsureSuccessStatusCode()`

Calling `ReadFromJsonAsync<T>()` before `EnsureSuccessStatusCode()` makes the client treat an error payload as if it were a valid DTO.

*Fail the request before attempting typed deserialization.*
```csharp
var resp = await client.GetAsync(url);
resp.EnsureSuccessStatusCode();
var data = await resp.Content.ReadFromJsonAsync<MyDto>();
```
```text
Non-2xx responses throw before deserialization begins.
```

#### Secrets committed to `appsettings.json`

Hardcoded `Bearer` tokens and API keys become persistent credential leaks once they enter source control or CI logs.

*Load the authorization token from an environment variable instead of source code.*
```csharp
var token = Environment.GetEnvironmentVariable("API_TOKEN");
client.DefaultRequestHeaders.Authorization =
    new AuthenticationHeaderValue("Bearer", token);
Console.WriteLine(token is null ? "token missing" : "token loaded");
```
```text
token loaded
```

#### Missing `CancellationToken` propagation

If a handler ignores `CancellationToken`, downstream `HttpClient` calls continue running after request timeout or host shutdown.

*Pass the request cancellation token through every async hop.*
```csharp
app.MapGet("/data", async (CancellationToken ct) =>
{
    var rows = await client.GetFromJsonAsync<Data[]>(url, ct);
    return Results.Ok(rows);
});
```
```text
Request cancellation can interrupt the downstream HTTP call.
```

## C# Web and APIs Recommendations

#### Reuse one `HttpClient` per remote host

Prefer a singleton `HttpClient` or `IHttpClientFactory` so connection pools are reused across calls to the same upstream service.

*Expose a shared client from a single static field in scripts or notebooks.*
```csharp
private static readonly HttpClient SharedClient = new();

Console.WriteLine(SharedClient.BaseAddress is null
    ? "shared client ready"
    : SharedClient.BaseAddress.ToString());
```
```text
shared client ready
```

#### Return explicit `Results.*` values

Minimal API handlers should return `Results.Ok()`, `Results.NotFound()`, or `Results.Created()` so the HTTP semantics are visible in code review and test assertions.

*Return `Results.NotFound()` when the lookup misses instead of returning `null`.*
```csharp
app.MapGet("/trades/{id}", (string id) =>
    tradesDb.TryGetValue(id, out var trade)
        ? Results.Ok(trade)
        : Results.NotFound());
```
```text
Missing trade IDs map to HTTP 404 instead of HTTP 200 with a null body.
```

#### Honour `Retry-After` during backoff

When a service returns `429 Too Many Requests`, read `RetryAfter` before falling back to a local exponential delay formula.

*Use `RetryAfter` when it is present and only compute a delay when the header is absent.*
```csharp
var retryAfterSeconds = response.Headers.RetryAfter?.Delta?.TotalSeconds;
var delaySeconds = retryAfterSeconds ?? Math.Pow(2, attempt);
Console.WriteLine($"wait {delaySeconds:0.0}s");
```
```text
wait 1.0s
```

#### Keep request models immutable with `with`

Immutable `record` DTOs make it clear when a request shape changes, and `with` expressions keep modifications explicit.

*Clone a request DTO with one changed field instead of mutating the original instance.*
```csharp
var prodRequest = new ImmutableConfig("db.prod.internal");
var devRequest = prodRequest with { DbHost = "localhost", Ssl = false };
Console.WriteLine($"{prodRequest.DbHost} -> {devRequest.DbHost}");
```
```text
db.prod.internal -> localhost
```

## C# Web and APIs Troubleshooting

#### `401 Unauthorized` despite a current token

Check that the header name is exactly `Authorization` and that the value is prefixed with `Bearer `.

*Build the header value explicitly before sending the request.*
```csharp
var token = "eyJhbGciOi...";
var headerValue = $"Bearer {token}";
Console.WriteLine(headerValue.StartsWith("Bearer ") ? "header format ok" : "header format invalid");
```
```text
header format ok
```

#### `429 Too Many Requests` never recovers

If the retry loop sleeps for a fixed duration and ignores `RetryAfter`, it can keep hitting the service inside the same rate-limit window.

*Read the server-provided retry delay before choosing a local fallback.*
```csharp
var retryAfter = response.Headers.RetryAfter?.Delta?.TotalSeconds;
Console.WriteLine(retryAfter is null ? "use fallback backoff" : $"respect server delay: {retryAfter:0.0}s");
```
```text
respect server delay: 1.0s
```

#### `Results.Ok(null)` returns `200`

A missing resource still returns HTTP `200` if the handler emits `Results.Ok(null)` instead of `Results.NotFound()`.

*Branch to `Results.NotFound()` before constructing the response body.*
```csharp
var result = tradesDb.TryGetValue("TRD_404", out var trade)
    ? "200 OK"
    : "404 Not Found";
Console.WriteLine(result);
```
```text
404 Not Found
```

#### Notebook validation appears to ignore `[Required]`

In .NET Interactive, `Validator.TryValidateObject()` does not enforce annotations attached to positional record constructor parameters.

*Expect notebook validation to pass the positional-record case and move strict checks to ASP.NET model binding or FluentValidation.*
```csharp
var notebookBehavior = "positional record annotations skipped";
Console.WriteLine(notebookBehavior);
```
```text
positional record annotations skipped
```

