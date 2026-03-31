---
type: reference
category: programming-languages
technology: [csharp, dotnet]
tags: [testing, csharp]
aliases: [unit testing, pytest, xUnit, NUnit, test driven development, mocking, assertions]
keywords: [xUnit, NUnit, MSTest, Moq, FluentAssertions, Theory, Fact, fixture, mock, TDD]
description: "C# testing reference with executable examples and cell outputs — covers xUnit, NUnit, Moq, FluentAssertions, data-driven tests, and test-driven development patterns. See [14_py_testing](https://alp78.github.io/elysium/02-Programming-Languages/Python/14_py_testing) for the Python equivalent."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 14. Testing - C#

> [!quote]
> "Legacy code is simply code without tests."
> — **Michael Feathers**, *Working Effectively with Legacy Code* (2004)
>
> "Write tests until fear is transformed into boredom."
> — **Kent Beck**, *Test-Driven Development: By Example*

## Testing Philosophy

Testing is not about proving code works — it's about **catching bugs before they reach production**.
In data engineering, untested pipelines fail silently: wrong prices feed into models,
missing rows corrupt dashboards, schema changes break downstream consumers.
A test suite is your safety net — it runs in seconds and catches what code review cannot.

### The Testing Pyramid

Tests are organized in layers, from fast/cheap at the bottom to slow/expensive at the top:

| Layer | What it tests | Speed | Tools | Demonstrated |
|-------|--------------|-------|-------|-------------|
| **Unit tests** | One function in isolation — pure logic, no I/O | ~1ms each | `xUnit`, `Assert`, `Moq` | Sections 1–4 |
| **Integration tests** | Code + real dependencies (DB, API, files) | ~100ms each | `xUnit` + `SqlClient`, `HttpClient` | Sections 5–7 |
| **End-to-end tests** | Full pipeline from input to output | ~1s+ each | `WebApplicationFactory`, `TestServer` | Conceptual |
| **Performance tests** | Speed and memory under load | ~10s each | `BenchmarkDotNet` | Conceptual |

**Rule of thumb**: 70% unit, 20% integration, 10% E2E.
Unit tests run on every commit. Integration tests run on every PR. E2E tests run on deploy.

### C# Testing Ecosystem

- **xUnit** — the most widely used .NET test framework. `[Fact]` marks a single test, `[Theory]` + `[InlineData]` marks a parametrized test. Constructor injection gives each test a fresh instance (isolation).
- **Assert** — xUnit's assertion library. `Assert.Equal`, `Assert.True`, `Assert.Throws<T>`, `Assert.Contains`, etc. Each method tests one condition and throws on failure.
- **Moq** — the standard mocking library. `mock.Setup(...)` defines canned return values; `mock.Verify(...)` asserts how the mock was called. In this notebook we use hand-written mocks (same pattern, more explicit).
- **`[Theory]` + `[InlineData]`** — data-driven testing. Write one test method, run it with N different parameter sets.
- **Testcontainers** — spin up ephemeral Docker containers (Postgres, Redis, Kafka) for integration tests. Not shown here but essential for CI.
- **Coverlet** — code coverage for .NET. Fails CI if branch coverage drops below a threshold.

### What This Notebook Demonstrates

1. **Unit tests**: `[Fact]` tests, Assert methods, exception testing, parametrized `[Theory]` tests
2. **Mocking**: hand-written mocks (same pattern as Moq), transient failure simulation, retry testing
3. **Data engineering patterns**: trade normalization, OHLCV validation, mock index data clients
4. **Integration tests**: real SQL queries against the `stoxx` database (schema, completeness, quality, cross-layer consistency)
5. **API integration**: cross-checking Finnhub live prices against database values
6. **DI validation**: resolving services from `IServiceCollection` to catch missing registrations
7. **CI/CD**: GitHub Actions workflow with `dotnet test`, coverage thresholds

#### Warning suppression

```csharp
// Suppress CS1701/CS1702 assembly version warnings and import namespaces
using System.Reflection;
using Microsoft.DotNet.Interactive;
using Microsoft.DotNet.Interactive.CSharp;

#r "nuget: Microsoft.Data.SqlClient"
#r "nuget: Microsoft.Extensions.DependencyInjection"
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.DependencyInjection;
using System.IO;
using System.Text.RegularExpressions;
var csharpKernel = (CSharpKernel)Kernel.Root.FindKernelByName("csharp");
var optionsField = typeof(CSharpKernel).GetField("_scriptOptions",
    BindingFlags.NonPublic | BindingFlags.Instance);
var scriptOptions = optionsField.GetValue(csharpKernel);
var withWarningLevel = scriptOptions.GetType().GetMethod("WithWarningLevel");
var newOptions = withWarningLevel.Invoke(scriptOptions, new object[] { 0 });
optionsField.SetValue(csharpKernel, newOptions);

Console.WriteLine("WarningLevel set to 0 — CS1701/CS1702 warnings suppressed.");
```

    WarningLevel set to 0 — CS1701/CS1702 warnings suppressed.

#### Imports and test attribute stubs

> [!info] Notebook test infrastructure
>
> This cell defines stub versions of xUnit's `[Fact]`, `[Theory]`, and `[InlineData]` attributes, plus a lightweight `Assert` class. In a real project, xUnit NuGet provides these. The stubs avoid assembly version conflicts in .NET Interactive while keeping the API surface identical — test code is copy-pasteable into a real xUnit project.

```csharp
#nullable enable
// Lightweight Assert class — same API as xUnit, zero dependencies.
// In a real project you'd use xUnit with `dotnet test`.
// In notebooks, this avoids NuGet assembly version warnings.



// Attribute stubs for notebook use (real xUnit uses [Fact] and [Theory])
[AttributeUsage(AttributeTargets.Method)] public class FactAttribute : Attribute { }
[AttributeUsage(AttributeTargets.Method)] public class TheoryAttribute : Attribute { }
[AttributeUsage(AttributeTargets.Method, AllowMultiple = true)]
public class InlineDataAttribute : Attribute
{
    public object[] Data { get; }
    public InlineDataAttribute(params object[] data) { Data = data; }
}
```

#### Test runner

`RunTests` uses reflection to find `[Fact]`/`[Theory]` methods, invokes them, and reports PASS/FAIL — mimics what `dotnet test` does. In a real project, the xUnit runner handles this automatically.

```csharp
void RunTests(object testClass)
{
    var methods = testClass.GetType().GetMethods()
        .Where(m => m.GetCustomAttributes(typeof(FactAttribute), false).Any()
                  || m.GetCustomAttributes(typeof(TheoryAttribute), false).Any());
    int passed = 0, failed = 0;
    foreach (var method in methods)
    {
        try
        {
            method.Invoke(testClass, null);
            passed++;
            Console.WriteLine($"  PASS: {method.Name}");
        }
        catch (Exception ex)
        {
            failed++;
            var inner = ex.InnerException ?? ex;
            Console.WriteLine($"  FAIL: {method.Name} — {inner.Message}");
        }
    }
    Console.WriteLine($"  Results: {passed} passed, {failed} failed, {passed + failed} total");
}

// Attribute stubs for notebook use (real xUnit uses [Fact] and [Theory])


Console.WriteLine("  Assert class, test runner, and attributes ready.");
```

      Assert class, test runner, and attributes ready.

#### Assert.Equal, Assert.True, Assert.Throws — xUnit assertion methods

Lightweight reimplementation of xUnit's `Assert` class — same API, zero dependencies. Methods: `Equal`, `True`/`False`, `Null`/`NotNull`, `Contains`, `Empty`/`NotEmpty`, `InRange`, `Throws<T>`, `Single`, `Matches`. Code is directly portable to a real xUnit project — just remove this class and add the NuGet package.

```csharp
public static class Assert
{
    // Equal<T> — checks that expected and actual are equal using Equals() (not ==)
    public static void Equal<T>(T expected, T actual)
    {
        if (!Equals(expected, actual))
            throw new Exception($"Assert.Equal failed: expected <{expected}>, got <{actual}>");
    }
    // Equal(double, double, precision) — floating-point comparison with tolerance (10^-precision)
    public static void Equal(double expected, double actual, int precision)
    {
        var tolerance = Math.Pow(10, -precision);
        if (Math.Abs(expected - actual) > tolerance)
            throw new Exception($"Assert.Equal failed: expected <{expected}>, got <{actual}> (precision {precision})");
    }
    // True — asserts a boolean condition is true; optional message for context on failure
    public static void True(bool condition, string msg = "")
    {
        if (!condition)
            throw new Exception($"Assert.True failed. {msg}");
    }
    // False — asserts a boolean condition is false
    public static void False(bool condition, string msg = "")
    {
        if (condition)
            throw new Exception($"Assert.False failed. {msg}");
    }
    // NotNull — asserts the object is not null (catches uninitialized or missing data)
    public static void NotNull(object? obj)
    {
        if (obj is null)
            throw new Exception("Assert.NotNull failed: object was null");
    }
    // Null — asserts the object IS null (e.g., verify a field was correctly cleared)
    public static void Null(object? obj)
    {
        if (obj is not null)
            throw new Exception($"Assert.Null failed: object was <{obj}>");
    }
    // Contains<T>(collection, predicate) — asserts at least one element matches the predicate
    public static void Contains<T>(IEnumerable<T> collection, Func<T, bool> predicate)
    {
        if (!collection.Any(predicate))
            throw new Exception("Assert.Contains failed: no matching element found");
    }
    // Contains(string, string) — asserts that actual contains expected as a substring
    public static void Contains(string expected, string actual)
    {
        if (!actual.Contains(expected))
            throw new Exception($"Assert.Contains failed: <{expected}> not found in <{actual}>");
    }
    // DoesNotContain — asserts that expected is NOT found in actual
    public static void DoesNotContain(string expected, string actual)
    {
        if (actual.Contains(expected))
            throw new Exception($"Assert.DoesNotContain failed: <{expected}> was found in <{actual}>");
    }
    // Empty — asserts the collection has zero elements (e.g., no validation errors)
    public static void Empty<T>(IEnumerable<T> collection)
    {
        if (collection.Any())
            throw new Exception($"Assert.Empty failed: collection has {collection.Count()} elements");
    }
    // NotEmpty — asserts the collection has at least one element
    public static void NotEmpty<T>(IEnumerable<T> collection)
    {
        if (!collection.Any())
            throw new Exception("Assert.NotEmpty failed: collection was empty");
    }
    // InRange — asserts actual is within [low, high] inclusive (e.g., price > 0 and < 1M)
    public static void InRange<T>(T actual, T low, T high) where T : IComparable<T>
    {
        if (actual.CompareTo(low) < 0 || actual.CompareTo(high) > 0)
            throw new Exception($"Assert.InRange failed: <{actual}> not in [{low}, {high}]");
    }
    // Single — asserts exactly one element in the collection and returns it
    public static T Single<T>(IEnumerable<T> collection)
    {
        var list = collection.ToList();
        if (list.Count != 1)
            throw new Exception($"Assert.Single failed: expected 1 element, got {list.Count}");
        return list[0];
    }
    // Matches — asserts that actual matches a regex pattern (e.g., date format, ticker format)
    public static void Matches(string pattern, string actual)
    {
        if (!System.Text.RegularExpressions.Regex.IsMatch(actual, pattern))
            throw new Exception($"Assert.Matches failed: '{actual}' does not match '{pattern}'");
    }
    // Throws<T> — asserts that the action throws exception of type T; returns it for inspection
    public static T Throws<T>(Action action) where T : Exception
    {
        try { action(); }
        catch (T ex) { return ex; }
        catch (Exception ex) { throw new Exception($"Assert.Throws<{typeof(T).Name}> failed: got {ex.GetType().Name}"); }
        throw new Exception($"Assert.Throws<{typeof(T).Name}> failed: no exception thrown");
    }
}
```

## Unit Testing with xUnit

xUnit is the most widely used testing framework in .NET. `[Fact]` marks a single test case (like pytest `test_*`). `[Theory]` + `[InlineData]` creates parametrized tests (like `@pytest.mark.parametrize`). xUnit creates a new class instance per test for isolation — no `[SetUp]`/`[TearDown]`, use constructor/`IDisposable` instead.

> [!warning] Testing anti-patterns
>
> - Don't **share state** between tests — each test should be independent
> - Don't **test private methods** — test the public API that uses them
> - Don't **assert on implementation details** — assert on observable behavior

> [!info] Running xUnit in notebooks
>
> xUnit normally runs via `dotnet test` with a test project. In notebooks, we call test methods directly and report results. In production, tests live in a separate `MyProject.Tests` project.

#### Helper to run tests in notebook

```csharp
// In a real project, `dotnet test` discovers and runs these automatically.
// Here we call them manually and catch failures.

void RunTest(string name, Action test)
{
    try { test(); Console.WriteLine($"  ✓ {name}"); }
    catch (Exception ex) { Console.WriteLine($"  ✗ {name}: {ex.Message}"); }
}

Console.WriteLine("=== Basic xUnit Tests ===");
```

    === Basic xUnit Tests ===

#### Basic Fact tests

```csharp
// Basic Fact tests
RunTest("Price calculation", () =>
{
    // Trade price: quantity × unit_price
    int quantity = 150;
    decimal unitPrice = 42.75m;
    decimal total = quantity * unitPrice;
    Assert.Equal(6412.50m, total);
});

// TEST: ticker strings are trimmed and uppercased ("  aapl  " → "AAPL")
RunTest("Ticker normalization", () =>
{
    string rawTicker = "  aapl  ";
    Assert.Equal("AAPL", rawTicker.Trim().ToUpper());
});

// TEST: a normalized portfolio's weights add up to exactly 1.0
RunTest("Portfolio weights sum to 1", () =>
{
    var weights = new Dictionary<string, double>
    {
        ["AAPL"] = 0.30, ["MSFT"] = 0.25, ["GOOG"] = 0.20, ["AMZN"] = 0.25
    };
    Assert.Equal(1.0, weights.Values.Sum(), precision: 10);
});

// TEST: a trade dictionary contains all mandatory keys
RunTest("Trade record has required fields", () =>
{
    var trade = new Dictionary<string, object>
    {
        ["trade_id"] = "TRD_001", ["ticker"] = "AAPL", ["side"] = "BUY",
        ["quantity"] = 100, ["price"] = 178.50, ["timestamp"] = "2024-03-15T14:30:00Z"
    };
    var required = new[] { "trade_id", "ticker", "side", "quantity", "price", "timestamp" };
    foreach (var field in required)
        Assert.True(trade.ContainsKey(field), $"Missing field: {field}");
});
```

      ✓ Price calculation
      ✓ Ticker normalization
      ✓ Portfolio weights sum to 1
      ✓ Trade record has required fields

#### Testing exceptions

```csharp
// Assert.Throws<T>() verifies an exception is thrown.

// TEST: negative quantity is rejected with ArgumentException (fail-fast validation)
RunTest("Invalid quantity throws ArgumentException", () =>
{
    static void ValidateTrade(int qty)
    {
        if (qty <= 0)
            throw new ArgumentException($"Invalid quantity: {qty}");
    }

    var ex = Assert.Throws<ArgumentException>(() => ValidateTrade(-10));
    Assert.Contains("Invalid quantity", ex.Message);
});

// TEST: accessing a non-existent dict key throws KeyNotFoundException
RunTest("Missing key throws KeyNotFoundException", () =>
{
    var positions = new Dictionary<string, int> { ["AAPL"] = 100, ["MSFT"] = 50 };
    Assert.Throws<KeyNotFoundException>(() => { var _ = positions["TSLA"]; });
});
```

      ✓ Invalid quantity throws ArgumentException
      ✓ Missing key throws KeyNotFoundException

## Theory and InlineData

> [!info] xUnit test attributes
>
> - `[Fact]` — single test case
> - `[Theory]` + `[InlineData]` — parametrized (runs once per data set); C# equivalent of `@pytest.mark.parametrize`
> - In notebooks we simulate with a loop; in real projects, xUnit discovers automatically

```csharp
void RunTest(string name, Action test)
{
    try { test(); Console.WriteLine($"  ✓ {name}"); }
    catch (Exception ex) { Console.WriteLine($"  ✗ {name}: {ex.Message}"); }
}
```

#### Parametrize: fee tier calculation

In a real test project, this would use xUnit's `[Theory]` + `[InlineData]`:

```csharp
// [Theory]
// [InlineData(50_000,    30)]   // tier 1: < $100K → 30 bps
// [InlineData(500_000,   20)]   // tier 2: $100K-$1M → 20 bps
// [InlineData(5_000_000, 10)]   // tier 3: > $1M → 10 bps
// public void FeeTier_ReturnsCorrectBps(long volume, int expectedBps) { ... }

static int GetFeeBps(long volume) => volume switch
{
    < 100_000    => 30,
    < 1_000_000  => 20,
    _            => 10,
};

Console.WriteLine("=== Fee Tier [Theory] ===");
var feeCases = new (long volume, int expectedBps)[]
{
    (50_000, 30), (500_000, 20), (5_000_000, 10)
};
foreach (var (vol, bps) in feeCases)
    // TEST: each volume tier maps to the correct fee in basis points
    RunTest($"Volume ${vol:N0} → {bps} bps", () => Assert.Equal(bps, GetFeeBps(vol)));
```

    === Fee Tier [Theory] ===
      ✓ Volume $50'000 → 30 bps
      ✓ Volume $500'000 → 20 bps
      ✓ Volume $5'000'000 → 10 bps

#### Parametrize: currency conversion

> [!info] Parametrized test pattern
>
> - Array of named tuples = test cases
> - `foreach` destructures each tuple
> - `Assert.Equal(exp, amt * rate, precision: 5)` handles floating-point rounding (IEEE 754)
> - In a real project, use `[Theory]` + `[InlineData]` — xUnit runs once per row automatically

```csharp
Console.WriteLine("\n=== Currency Conversion [Theory] ===");
var fxCases = new (double amountUsd, double rate, double expected, string label)[]
{
    (1000.0, 0.92,  920.0,    "USD→EUR"),   // 1000 USD × 0.92 EUR/USD = 920 EUR
    (1000.0, 149.5, 149500.0, "USD→JPY"),   // 1000 USD × 149.5 JPY/USD = 149,500 JPY
    (1000.0, 0.79,  790.0,    "USD→GBP"),   // 1000 USD × 0.79 GBP/USD = 790 GBP
};
foreach (var (amt, rate, exp, label) in fxCases)
    // TEST: {label}: {amt} × {rate} = {exp}
    RunTest($"{label}: {amt} × {rate} = {exp}", () =>
        Assert.Equal(exp, amt * rate, precision: 5));
```

    
    === Currency Conversion [Theory] ===
      ✓ USD→EUR: 1000 × 0.92 = 920
      ✓ USD→JPY: 1000 × 149.5 = 149500
      ✓ USD→GBP: 1000 × 0.79 = 790

#### Parametrize: OHLCV validation

> [!info] OHLCV candle invariants
>
> - `high >= max(open, close)`
> - `low <= min(open, close)`
> - `volume >= 0`
>
> Financial APIs occasionally return garbage (high < open, negative volume) — a pipeline without validation feeds bad data into models.

```csharp
Console.WriteLine("\n=== OHLCV Validation [Theory] ===");

// Pure validation function — returns true if the candle is physically possible
static bool IsValidBar(double o, double h, double l, double c, long v)
    => h >= Math.Max(o, c) && l <= Math.Min(o, c) && v >= 0;

var ohlcvCases = new (double o, double h, double l, double c, long v, bool valid, string label)[]
{
    (100, 105, 98,  103, 50000, true,  "valid bar"),        // h=105 >= max(100,103), l=98 <= min(100,103), v>0
    (100, 95,  98,  99,  50000, false, "high < open"),      // h=95 < o=100 → impossible candle
    (100, 105, 98,  103, -1,    false, "negative volume"),  // v=-1 → corrupt data
};
foreach (var tc in ohlcvCases)
    // TEST: run parametrized case from the test data array
    RunTest(tc.label, () => Assert.Equal(tc.valid, IsValidBar(tc.o, tc.h, tc.l, tc.c, tc.v)));
```

    
    === OHLCV Validation [Theory] ===
      ✓ valid bar
      ✓ high < open
      ✓ negative volume

#### Parametrize: ticker validation

```csharp
// Parametrize: ticker validation
Console.WriteLine("\n=== Ticker Validation [Theory] ===");

static bool IsValidTicker(string ticker)
    => System.Text.RegularExpressions.Regex.IsMatch(ticker, @"^[A-Z]{1,5}(\.[A-Z])?$");

var tickerCases = new (string ticker, bool valid)[]
{
    ("AAPL", true), ("BRK.B", true), ("", false), ("aapl", false), ("ABCDEFGHIJ", false)
};
foreach (var (ticker, valid) in tickerCases)
    // TEST: \
    RunTest($"\"{ticker}\" → {valid}", () => Assert.Equal(valid, IsValidTicker(ticker)));
```

    
    === Ticker Validation [Theory] ===
      ✓ "AAPL" → True
      ✓ "BRK.B" → True
      ✓ "" → False
      ✓ "aapl" → False
      ✓ "ABCDEFGHIJ" → False

## Mocking with Moq

```csharp
#nullable enable

// In production C#, use Moq (NuGet) to auto-generate mocks from interfaces:
//   new Mock<IService>() → mock.Setup(s => s.Method()).Returns(value)
// In notebooks, we write mocks by hand (same pattern, Moq has assembly warnings on .NET 10).
// Core idea: implement the interface with fake behavior, verify correct method calls.

void RunTest(string name, Action test)
{
    try { test(); Console.WriteLine($"  ✓ {name}"); }
    catch (Exception ex) { Console.WriteLine($"  ✗ {name}: {ex.Message}"); }
}
```

#### Interfaces — define contracts for dependency injection

```csharp
// In C#, you mock interfaces (not concrete classes).

Console.WriteLine("=== Mock Basics ===");
```

    === Mock Basics ===

#### Interface + mock classes — IMarketDataClient, IBroker for testability

In C#, you mock **interfaces**, not concrete classes. An interface declares what methods exist; a mock implements them with fake behavior. Production code depends on `IMarketDataClient` (interface) — inject `MockMarketDataClient` in tests, `RealMarketDataClient` in production.

```csharp
public interface IMarketDataClient { Quote GetQuote(string ticker); }
public interface IBrokerClient { OrderResult SubmitOrder(Order order); }
public interface IExchangeGateway { string Send(string message); }

public class Quote
{
    public string Ticker { get; set; } = "";
    public double Bid { get; set; }
    public double Ask { get; set; }
    public double Last { get; set; }
}
public class Order
{
    public string Ticker { get; set; } = "";
    public string Side { get; set; } = "";
    public int Qty { get; set; }
    public double LimitPrice { get; set; }
}
public class OrderResult
{
    public string OrderId { get; set; } = "";
    public string Status { get; set; } = "";
}
```

#### Hand-written mock classes — implement interface with canned data

```csharp
# nullable enable
// Each implements the interface + adds tracking fields for verification.

public class MockMarketDataClient : IMarketDataClient
{
    public Quote QuoteToReturn { get; set; } = new();
    public string LastRequestedTicker { get; private set; } = "";
    public int CallCount { get; private set; }
    public Quote GetQuote(string ticker)
    {
        LastRequestedTicker = ticker;
        CallCount++;
        return QuoteToReturn;
    }
}

public class MockBrokerClient : IBrokerClient
{
    public OrderResult ResultToReturn { get; set; } = new();
    public Order? LastOrder { get; private set; }
    public int CallCount { get; private set; }
    public OrderResult SubmitOrder(Order order)
    {
        LastOrder = order;
        CallCount++;
        return ResultToReturn;
    }
}

public class MockExchangeGateway : IExchangeGateway
{
    public int FailCount { get; set; }  // fail this many times before succeeding
    public int CallCount { get; private set; }
    public string Send(string message)
    {
        CallCount++;
        if (CallCount <= FailCount)
            throw new IOException("gateway timeout");
        return "ACK";
    }
}
```

#### Mock: market data client

Hand-written mock: implements the interface with canned return values, records what was called (`LastRequestedSymbol`, `CallCount`). Moq equivalent: `new Mock<IMarketDataClient>()`. Both achieve the same goal — hand-written is clearer for learning.

```csharp
// TEST: mock returns canned price, records which symbol was requested
RunTest("Mock market data quote", () =>
{
    var mock = new MockMarketDataClient();
    mock.QuoteToReturn = new Quote { Ticker = "AAPL", Bid = 178.40, Ask = 178.60, Last = 178.50 };

    var quote = mock.GetQuote("AAPL");
    Assert.Equal(178.50, quote.Last);
    Assert.True(quote.Ask > quote.Bid);  // spread must be positive
    Assert.Equal("AAPL", mock.LastRequestedTicker);  // verify call
    Assert.Equal(1, mock.CallCount);
});
```

      ✓ Mock market data quote

#### Mock: broker order submission

```csharp
// Moq equivalent: mock.Setup(b => b.SubmitOrder(It.IsAny<Order>())).Returns(...)

// TEST: mock records the order that was submitted for later verification
RunTest("Mock order submission", () =>
{
    var mock = new MockBrokerClient();
    mock.ResultToReturn = new OrderResult { OrderId = "ORD_123", Status = "FILLED" };

    var result = mock.SubmitOrder(new Order
        { Ticker = "AAPL", Side = "BUY", Qty = 100, LimitPrice = 178.00 });

    Assert.Equal("FILLED", result.Status);
    Assert.Equal("AAPL", mock.LastOrder!.Ticker);  // verify argument
    Assert.Equal(1, mock.CallCount);
});
```

      ✓ Mock order submission

#### Mock: transient failure (side_effect equivalent)

```csharp
#nullable enable
// Testing transient failures — mock that fails N times then succeeds
//
// WHAT: MockExchangeGateway.FailCount controls how many calls throw IOException
//   before returning a successful "ACK". The test retries up to 3 times.
//   This simulates real-world transient errors: network timeouts, API 503s,
//   DB deadlocks — errors that succeed if you just try again.
//
// WHY: retry logic is critical in DE pipelines. Without testing it:
//   - You don't know if your retry actually retries (off-by-one: retries 2 times not 3)
//   - You don't know if it gives up correctly after max attempts
//   - You don't know if it returns the right result on eventual success
//
// PATTERN: set mock to fail N times → run code with retry loop → assert success + call count

// TEST: retry loop handles N failures then succeeds on attempt N+1
RunTest("Mock with transient failure + retry", () =>
{
    var mock = new MockExchangeGateway();
    mock.FailCount = 2;  // first 2 calls throw IOException, 3rd succeeds

    // Retry loop — same pattern as production retry logic
    string? result = null;
    for (int i = 0; i < 3; i++)
    {
        try { result = mock.Send("NEW_ORDER"); break; }  // break on success
        catch (IOException) { continue; }                  // retry on transient error
    }

    Assert.Equal("ACK", result);     // verify we got the success response
    Assert.Equal(3, mock.CallCount); // verify it took exactly 3 attempts (2 fails + 1 success)
});

// Moq equivalent — how you'd write the same test with the Moq NuGet library
// Moq generates the mock class automatically from the interface (no hand-written mock needed).
// Setup() defines what the mock returns. Verify() asserts how it was called.
Console.WriteLine("\n=== Moq Equivalent (for real projects) ===");
Console.WriteLine(@"
  // In a real test project with Moq (NuGet: Moq):
  var mock = new Mock<IMarketDataClient>();

  // Setup: when GetQuote(""AAPL"") is called, return this canned response
  mock.Setup(c => c.GetQuote(""AAPL""))
      .Returns(new Quote { Ticker = ""AAPL"", Last = 178.50 });

  // Act: call the mock through its .Object property (the generated implementation)
  var quote = mock.Object.GetQuote(""AAPL"");

  // Assert: verify the return value AND that the method was called exactly once
  Assert.Equal(178.50, quote.Last);
  mock.Verify(c => c.GetQuote(""AAPL""), Times.Once());
");
```

      ✓ Mock with transient failure + retry
    
    === Moq Equivalent (for real projects) ===
    
      // In a real test project with Moq (NuGet: Moq):
      var mock = new Mock<IMarketDataClient>();
    
      // Setup: when GetQuote("AAPL") is called, return this canned response
      mock.Setup(c => c.GetQuote("AAPL"))
          .Returns(new Quote { Ticker = "AAPL", Last = 178.50 });
    
      // Act: call the mock through its .Object property (the generated implementation)
      var quote = mock.Object.GetQuote("AAPL");
    
      // Assert: verify the return value AND that the method was called exactly once
      Assert.Equal(178.50, quote.Last);
      mock.Verify(c => c.GetQuote("AAPL"), Times.Once());

## Test Patterns for Data Engineering

Key testing patterns for data engineering and finance:

1. **Test transform functions** — pure logic, no mocks needed
2. **Mock external systems** — exchange APIs, databases, cloud storage
3. **Constructor injection** for test data (xUnit creates new instance per test)
4. **Theory + InlineData** for edge cases

```csharp
void RunTest(string name, Action test)
{
    try { test(); Console.WriteLine($"  ✓ {name}"); }
    catch (Exception ex) { Console.WriteLine($"  ✗ {name}: {ex.Message}"); }
}
```

#### Domain types — IIndexDataClient, Constituent, EodPrice for pipeline testing

Domain types for pipeline testing: `IIndexDataClient` (interface for fetching index constituents — production calls a real API, tests use `MockIndexDataClient` with canned data), `Constituent` (ticker + market cap), `EodPrice` (standard OHLCV fields matching yfinance/Twelve Data — `PrevClose` enables daily return calculation). The mock records inputs and returns canned outputs — exactly what Moq does behind `mock.Setup().Returns()`.

```csharp
// Interface — the contract that both real and mock implementations satisfy
public interface IIndexDataClient { List<Constituent> GetConstituents(string index); }

// Constituent — one stock in an index
public class Constituent
{
    public string Ticker { get; set; } = "";
    public long MarketCap { get; set; }
}

// EodPrice — end-of-day OHLCV price bar for one stock
public class EodPrice
{
    public string Ticker { get; set; } = "";
    public double Close { get; set; }
    public double High { get; set; }
    public double Low { get; set; }
    public long Volume { get; set; }
    public double PrevClose { get; set; }
}

// MockIndexDataClient — test double that records calls and returns canned data
public class MockIndexDataClient : IIndexDataClient
{
    public List<Constituent> ConstituentsToReturn { get; set; } = new();
    public string LastRequestedIndex { get; private set; } = "";
    public int CallCount { get; private set; }
    public List<Constituent> GetConstituents(string index)
    {
        LastRequestedIndex = index;  // record what was requested
        CallCount++;                 // track call count
        return ConstituentsToReturn; // return the canned data set by the test
    }
}
```

#### Test a data transform

`NormalizeTrades` is a pure function — no side effects, no DB, no API. Tests verify: missing fields are skipped, tickers are uppercased, negative prices are filtered. Transform tests are the most valuable — fast (no I/O), deterministic, and catch logic bugs.

```csharp
static List<Dictionary<string, object>> NormalizeTrades(List<Dictionary<string, object>> raw)
{
    var cleaned = new List<Dictionary<string, object>>();
    foreach (var t in raw)
    {
        var id = t.GetValueOrDefault("trade_id")?.ToString();
        if (string.IsNullOrWhiteSpace(id)) continue;

        var ticker = t["ticker"].ToString()!.Trim().ToUpper();
        var side = t["side"].ToString()!.Trim().ToUpper();
        var qty = Convert.ToInt32(t["qty"]);
        var price = Convert.ToDouble(t["price"]);

        cleaned.Add(new Dictionary<string, object>
        {
            ["trade_id"] = id!.Trim(),
            ["ticker"] = ticker,
            ["side"] = side,
            ["qty"] = qty,
            ["price"] = price,
            ["notional"] = qty * price,
        });
    }
    return cleaned;
}

Console.WriteLine("=== Transform Tests ===");

// TEST: normal trades are cleaned correctly — ticker uppercased, price rounded
RunTest("NormalizeTrades basic", () =>
{
    var raw = new List<Dictionary<string, object>>
    {
        new() { ["trade_id"] = "TRD_001", ["ticker"] = " aapl ", ["side"] = "buy", ["qty"] = "100", ["price"] = "178.50" },
        new() { ["trade_id"] = "TRD_002", ["ticker"] = "MSFT",   ["side"] = "SELL", ["qty"] = 50,    ["price"] = 415.20 },
    };
    var result = NormalizeTrades(raw);
    Assert.Equal(2, result.Count);
    Assert.Equal("AAPL", result[0]["ticker"]);
    Assert.Equal(17850.0, (double)result[0]["notional"], precision: 2);
});

// TEST: trades without a trade_id are silently dropped
RunTest("NormalizeTrades drops missing ID", () =>
{
    var raw = new List<Dictionary<string, object>>
    {
        new() { ["trade_id"] = "",         ["ticker"] = "AAPL", ["side"] = "BUY", ["qty"] = 100, ["price"] = 178.5 },
        new() { ["trade_id"] = "TRD_003",  ["ticker"] = "GOOG", ["side"] = "BUY", ["qty"] = 20,  ["price"] = 172.3 },
    };
    var result = NormalizeTrades(raw);
    Assert.Single(result);
    Assert.Equal("TRD_003", result[0]["trade_id"]);
});

// TEST: empty input produces empty output (no crash on edge case)
RunTest("NormalizeTrades empty list", () =>
{
    Assert.Empty(NormalizeTrades(new List<Dictionary<string, object>>()));
});
```

    === Transform Tests ===
      ✓ NormalizeTrades basic
      ✓ NormalizeTrades drops missing ID
      ✓ NormalizeTrades empty list

#### Mock external service (hand-written)

```csharp
// Mock external service (hand-written)
Console.WriteLine("\n=== Mock External Service ===");

// TEST: weight = stock market cap / total market cap, using mock data client
RunTest("Index weight calculation with mock", () =>
{
    var mock = new MockIndexDataClient();
    mock.ConstituentsToReturn = new List<Constituent>
    {
        new() { Ticker = "AAPL", MarketCap = 3_000_000_000_000L },
        new() { Ticker = "MSFT", MarketCap = 2_800_000_000_000L },
        new() { Ticker = "GOOG", MarketCap = 2_000_000_000_000L },
    };

    var constituents = mock.GetConstituents("SP500");
    var totalMcap = constituents.Sum(c => (double)c.MarketCap);
    var aaplWeight = constituents.First(c => c.Ticker == "AAPL").MarketCap / totalMcap;

    Assert.Equal(3.0 / 7.8, aaplWeight, precision: 4);
    Assert.Equal("SP500", mock.LastRequestedIndex);
    Assert.Equal(1, mock.CallCount);
});
```

    
    === Mock External Service ===
      ✓ Index weight calculation with mock

#### Data quality checks

> [!info] EOD price validation invariants
>
> - `close > 0`, `high >= low`, `volume >= 0`, daily return < 20%
> - Returns a list of error strings — empty = all valid
> - Bad API data is common: 0 for missing fields, negative prices from currency bugs, unadjusted splits

```csharp
Console.WriteLine("\n=== Data Quality Tests ===");

static List<string> ValidateEodPrices(List<EodPrice> prices)
{
    var errors = new List<string>();
    foreach (var p in prices)
    {
        if (p.Close <= 0)
            errors.Add($"{p.Ticker}: non-positive close {p.Close}");
        if (p.High < p.Low)
            errors.Add($"{p.Ticker}: high ({p.High}) < low ({p.Low})");
        if (p.Volume < 0)
            errors.Add($"{p.Ticker}: negative volume {p.Volume}");
        if (p.PrevClose > 0)
        {
            var dailyReturn = Math.Abs(p.Close - p.PrevClose) / p.PrevClose;
            if (dailyReturn > 0.20)
                errors.Add($"{p.Ticker}: suspicious daily move {dailyReturn:P1}");
        }
    }
    return errors;
}

// TEST: clean OHLCV data produces zero validation errors
RunTest("Valid EOD data passes", () =>
{
    var prices = new List<EodPrice>
    {
        new() { Ticker = "AAPL", Close = 178.50, High = 180.0, Low = 176.0, Volume = 50_000_000, PrevClose = 177.0 },
        new() { Ticker = "MSFT", Close = 415.20, High = 418.0, Low = 412.0, Volume = 25_000_000, PrevClose = 413.0 },
    };
    Assert.Empty(ValidateEodPrices(prices));
});

// TEST: negative close, high < low, and extreme daily move are all caught
RunTest("Catches invalid prices", () =>
{
    var prices = new List<EodPrice>
    {
        new() { Ticker = "BAD1", Close = -5.0,  High = 10.0,  Low = 8.0,   Volume = 1000, PrevClose = 10.0 },
        new() { Ticker = "BAD2", Close = 100.0, High = 90.0,  Low = 95.0,  Volume = 1000, PrevClose = 100.0 },
        new() { Ticker = "BAD3", Close = 150.0, High = 155.0, Low = 145.0, Volume = 1000, PrevClose = 100.0 },
    };
    var errors = ValidateEodPrices(prices);
    Assert.Equal(3, errors.Count);
    Assert.Contains(errors, e => e.Contains("non-positive"));
    Assert.Contains(errors, e => e.Contains("high") && e.Contains("< low"));
    Assert.Contains(errors, e => e.Contains("suspicious daily move"));
});
```

    
    === Data Quality Tests ===
      ✓ Valid EOD data passes
      ✗ Catches invalid prices: Assert.Equal failed: expected <3>, got <4>

## Integration Testing with Real Database

#### Database connection and test helper

Integration tests verify code against real dependencies (DB, APIs, files) — not just mocked interfaces. The stoxx database uses a medallion architecture: `bronze` (raw OHLCV), `silver` (cleaned + gap-filled), `gold` (scores, index performance).

> [!warning] Integration testing pitfalls
>
> - Don't run against production — use staging or Testcontainers
> - Don't hardcode connection strings — use env vars
> - Don't depend on specific data values — test invariants and ranges
> - Don't mutate shared test data — use transactions that rollback

```csharp
var connStr = "Data Source=localhost,1434;Initial Catalog=stoxx;"
            + "User ID=sa;Password=EsgDev2026Pass1;"
            + "TrustServerCertificate=True;Encrypt=True;";

// Helper: execute a query and return scalar result
T QueryScalar<T>(string sql)
{
    using var conn = new SqlConnection(connStr);
    conn.Open();
    using var cmd = new SqlCommand(sql, conn);
    return (T)cmd.ExecuteScalar();
}

// Helper: execute a query and return rows as List<Dictionary<string, object>>
List<Dictionary<string, object>> QueryRows(string sql)
{
    using var conn = new SqlConnection(connStr);
    conn.Open();
    using var cmd = new SqlCommand(sql, conn);
    using var reader = cmd.ExecuteReader();
    var results = new List<Dictionary<string, object>>();
    while (reader.Read())
    {
        var row = new Dictionary<string, object>();
        for (int i = 0; i < reader.FieldCount; i++)
            row[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
        results.Add(row);
    }
    return results;
}

// Helper: run a test and print PASS/FAIL
void AssertTest(string name, bool condition)
    => Console.WriteLine($"  {(condition ? "PASS" : "FAIL")}: {name}");

Console.WriteLine("  DB connection ready.");
```

      DB connection ready.

#### Schema validation tests

Queries `INFORMATION_SCHEMA` to verify tables and columns exist. Schema changes are the #1 cause of silent pipeline failures — a renamed column produces NULLs, a dropped table crashes at runtime. Schema tests catch these at deploy time.

```csharp
// TEST: all medallion layers exist for Euro Stoxx 50
var expectedTables = new[] {
    "bronze.eurostoxx50_ohlcv", "silver.eurostoxx50_ohlcv",
    "gold.index_performance", "gold.scores_daily",
};
foreach (var table in expectedTables)
{
    var parts = table.Split('.');
    var exists = QueryScalar<int>(
        $"SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES "
        + $"WHERE TABLE_SCHEMA = '{parts[0]}' AND TABLE_NAME = '{parts[1]}'");
    AssertTest($"table {table} exists", exists == 1);
}

// TEST: silver layer has is_filled column (added during bronze->silver transform)
var hasFilled = QueryScalar<int>(
    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
    + "WHERE TABLE_SCHEMA='silver' AND TABLE_NAME='eurostoxx50_ohlcv' AND COLUMN_NAME='is_filled'");
AssertTest("silver has is_filled column", hasFilled == 1);

// TEST (deliberate FAIL): check for a column that doesn't exist
var hasFake = QueryScalar<int>(
    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
    + "WHERE TABLE_SCHEMA='silver' AND TABLE_NAME='eurostoxx50_ohlcv' AND COLUMN_NAME='fake_column'");
AssertTest("silver has fake_column (expected FAIL)", hasFake == 1);
```

      PASS: table bronze.eurostoxx50_ohlcv exists
      PASS: table silver.eurostoxx50_ohlcv exists
      PASS: table gold.index_performance exists
      PASS: table gold.scores_daily exists
      PASS: silver has is_filled column
      FAIL: silver has fake_column (expected FAIL)

#### Data completeness tests

Verify the ETL pipeline ingested all expected data: correct symbol count, silver > bronze (backfill worked), no NULL close prices. A silent API failure might ingest 40 of 50 stocks — completeness tests catch this.

```csharp
// TEST: exactly 50 distinct symbols in bronze (Euro Stoxx 50 = 50 stocks)
var bronzeSymbols = QueryScalar<int>("SELECT COUNT(DISTINCT symbol) FROM bronze.eurostoxx50_ohlcv");
AssertTest($"bronze has {bronzeSymbols} distinct symbols (expected 50)", bronzeSymbols == 50);

// TEST: silver has more rows than bronze (historical data backfilled)
var bronzeCount = QueryScalar<int>("SELECT COUNT(*) FROM bronze.eurostoxx50_ohlcv");
var silverCount = QueryScalar<int>("SELECT COUNT(*) FROM silver.eurostoxx50_ohlcv");
AssertTest($"silver ({silverCount:N0}) > bronze ({bronzeCount:N0})", silverCount > bronzeCount);

// TEST: no NULL close prices in silver (should be gap-filled)
var nullCloses = QueryScalar<int>("SELECT COUNT(*) FROM silver.eurostoxx50_ohlcv WHERE [close] IS NULL");
AssertTest($"silver has {nullCloses} NULL close prices (expected 0)", nullCloses == 0);

// TEST: gold.index_performance covers all indices defined in dim_index
var goldIndices = QueryScalar<int>("SELECT COUNT(DISTINCT _index) FROM gold.index_performance");
var dimIndices = QueryScalar<int>("SELECT COUNT(*) FROM bronze.dim_index");
AssertTest($"gold has {goldIndices} indices (expected {dimIndices})", goldIndices >= dimIndices);
```

      PASS: bronze has 50 distinct symbols (expected 50)
      PASS: silver (66'355) > bronze (50)
      PASS: silver has 0 NULL close prices (expected 0)
      PASS: gold has 4 indices (expected 4)

#### Data quality tests

OHLCV invariants: `high >= low`, close between low and high, no negative prices/volumes, no future dates. Bad API responses or transform bugs produce data that looks valid but violates these rules.

```csharp
// TEST: OHLCV invariant — high >= low for all rows
var badOhlcv = QueryScalar<int>("SELECT COUNT(*) FROM silver.eurostoxx50_ohlcv WHERE high < low");
AssertTest($"high >= low ({badOhlcv} violations)", badOhlcv == 0);

// TEST: close is between low and high
var closeOob = QueryScalar<int>(
    "SELECT COUNT(*) FROM silver.eurostoxx50_ohlcv WHERE [close] < low OR [close] > high");
AssertTest($"close between low/high ({closeOob} violations)", closeOob == 0);

// TEST: no negative prices
var negPrices = QueryScalar<int>(
    "SELECT COUNT(*) FROM silver.eurostoxx50_ohlcv WHERE [close] < 0 OR [open] < 0");
AssertTest($"no negative prices ({negPrices} violations)", negPrices == 0);

// TEST: no future dates in the data
var futureDates = QueryScalar<int>("SELECT COUNT(*) FROM silver.eurostoxx50_ohlcv WHERE date > GETDATE()");
AssertTest($"no future dates ({futureDates} violations)", futureDates == 0);

// TEST: volume is non-negative
var negVol = QueryScalar<int>("SELECT COUNT(*) FROM silver.eurostoxx50_ohlcv WHERE volume < 0");
AssertTest($"no negative volume ({negVol} violations)", negVol == 0);
```

      PASS: high >= low (0 violations)
      PASS: close between low/high (0 violations)
      PASS: no negative prices (0 violations)
      PASS: no future dates (0 violations)
      PASS: no negative volume (0 violations)

#### Cross-layer consistency tests

Cross-layer consistency — verify data flows correctly between medallion layers (bronze → silver → gold). Tests: no stocks lost in cleaning, gap-filled rows < 1%, composite scores in valid z-score range (not [0,1]), daily returns within ±20%.

```csharp
// TEST: silver has at least as many symbols as bronze
var silverSymCount = QueryScalar<int>("SELECT COUNT(DISTINCT symbol) FROM silver.eurostoxx50_ohlcv");
AssertTest($"silver symbols ({silverSymCount}) >= bronze ({bronzeSymbols})", silverSymCount >= bronzeSymbols);

// TEST: is_filled rows are a small fraction (< 1%) of silver
var filledRows = QueryScalar<int>("SELECT COUNT(*) FROM silver.eurostoxx50_ohlcv WHERE is_filled = 1");
var filledPct = (double)filledRows / silverCount * 100;
AssertTest($"filled rows = {filledRows} ({filledPct:F3}%, expected < 1%)", filledPct < 1.0);

// TEST (real-world FAIL): composite_score appears to be [0,1] but is actually
// a normalized z-score ranging from ~-1.3 to +1.3. This test exposes a common
// assumption bug — always check actual data ranges before writing assertions.
var badScores = QueryScalar<int>(
    "SELECT COUNT(*) FROM gold.scores_daily WHERE composite_score < 0 OR composite_score > 1");
AssertTest($"composite_score in [0,1] ({badScores} violations — it's a z-score, not a percentage)", badScores == 0);

// CORRECTED test: composite_score should be in [-2, 2] (z-score range)
var reallyBad = QueryScalar<int>(
    "SELECT COUNT(*) FROM gold.scores_daily WHERE composite_score < -2 OR composite_score > 2");
AssertTest($"composite_score in [-2,2] z-score range ({reallyBad} violations)", reallyBad == 0);

// TEST: gold performance daily_return is within reasonable range (-20% to +20%)
var extremeReturns = QueryScalar<int>(
    "SELECT COUNT(*) FROM gold.index_performance WHERE ABS(daily_return) > 0.2");
AssertTest($"daily returns within +/-20% ({extremeReturns} violations)", extremeReturns == 0);
```

      PASS: silver symbols (50) >= bronze (50)
      PASS: filled rows = 6 (0.009%, expected < 1%)
      FAIL: composite_score in [0,1] (216 violations — it's a z-score, not a percentage)
      PASS: composite_score in [-2,2] z-score range (0 violations)
      PASS: daily returns within +/-20% (0 violations)

## DI Validation Testing

#### IServiceCollection — validate dependency injection registration

> [!info] DI registration testing
>
> - Build a `ServiceProvider` and try to resolve every root service
> - `GetRequiredService<T>()` throws if not registered — catches missing DI at test time
> - The #1 startup crash in .NET is forgetting `services.AddScoped<IFoo, Foo>()`

> [!warning] Resolve root services (they pull
>
> Resolve root services (they pull the full dependency graph). Don't register services in tests that aren't in production. Watch lifetime mismatches: Scoped into Singleton throws at runtime.

```csharp
// Register services
var services = new ServiceCollection();
services.AddSingleton<IMarketDataService, FakeMarketData>();
services.AddTransient<IPipelineRunner, PipelineRunner>();
var provider = services.BuildServiceProvider();

// TEST: all services resolve correctly
try
{
    var runner = provider.GetRequiredService<IPipelineRunner>();
    runner.Run();
    Console.WriteLine("  PASS: IPipelineRunner resolved and ran successfully");
}
catch (InvalidOperationException ex)
{
    Console.WriteLine($"  FAIL: DI resolution failed — {ex.Message}");
}

// TEST (deliberate FAIL): resolve an unregistered service
try
{
    provider.GetRequiredService<IDisposable>();
    Console.WriteLine("  FAIL: should have thrown");
}
catch (InvalidOperationException)
{
    Console.WriteLine("  PASS: correctly caught missing IDisposable (expected FAIL)");
}

interface IMarketDataService { string GetPrice(string symbol); }
interface IPipelineRunner { void Run(); }

class FakeMarketData : IMarketDataService
    { public string GetPrice(string symbol) => $"{symbol}: 100.00"; }

class PipelineRunner : IPipelineRunner
{
    private readonly IMarketDataService _data;
    public PipelineRunner(IMarketDataService data) { _data = data; }
    public void Run() => Console.WriteLine($"    Running with {_data.GetPrice("SAP")}");
}
```

        Running with SAP: 100.00
      PASS: IPipelineRunner resolved and ran successfully
      PASS: correctly caught missing IDisposable (expected FAIL)

## CI/CD — Running Tests in GitHub Actions

#### GitHub Actions workflow

```csharp
Console.WriteLine(@"
KEY GITHUB ACTIONS CONCEPTS:

  Trigger              Description
  ──────────────────   ──────────────────────────────────────
  push                 Runs on every push to specified branches
  pull_request         Runs on PRs targeting specified branches
  schedule             Cron-based (nightly data quality checks)
  workflow_dispatch    Manual trigger from GitHub UI

  dotnet test flags    Purpose
  ──────────────────   ──────────────────────────────────────
  --logger trx         Test results in TRX format (VS/Azure DevOps)
  --collect:coverage   Collect code coverage via coverlet
  --filter Trade       Run only tests matching pattern
  --blame              Identify tests that crash the runner

  Python equivalent    C# equivalent
  ──────────────────   ──────────────────────────────────────
  pytest               dotnet test
  pytest-cov           coverlet (built into SDK)
  --junitxml           --logger trx
  pip install -r ...   dotnet restore
  tox / nox            dotnet test matrix
");
```

    
    KEY GITHUB ACTIONS CONCEPTS:
    
      Trigger              Description
      ──────────────────   ──────────────────────────────────────
      push                 Runs on every push to specified branches
      pull_request         Runs on PRs targeting specified branches
      schedule             Cron-based (nightly data quality checks)
      workflow_dispatch    Manual trigger from GitHub UI
    
      dotnet test flags    Purpose
      ──────────────────   ──────────────────────────────────────
      --logger trx         Test results in TRX format (VS/Azure DevOps)
      --collect:coverage   Collect code coverage via coverlet
      --filter Trade       Run only tests matching pattern
      --blame              Identify tests that crash the runner
    
      Python equivalent    C# equivalent
      ──────────────────   ──────────────────────────────────────
      pytest               dotnet test
      pytest-cov           coverlet (built into SDK)
      --junitxml           --logger trx
      pip install -r ...   dotnet restore
      tox / nox            dotnet test matrix

GitHub Actions workflow for automated testing on every push/PR. `dotnet test` runs xUnit/NUnit/MSTest. Matrix tests across .NET versions. Secrets injected as env vars. `coverlet` for code coverage.

```csharp
var workflow = @"
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        dotnet-version: [8.0.x, 9.0.x]

    steps:
      - uses: actions/checkout@v4

      - name: Setup .NET
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: ${{ matrix.dotnet-version }}

      - name: Restore dependencies
        run: dotnet restore

      - name: Build
        run: dotnet build --no-restore --configuration Release

      - name: Run tests with coverage
        run: |
          dotnet test --no-build --configuration Release \
            --logger trx \
            --collect:""XPlat Code Coverage"" \
            --results-directory ./test-results
        env:
          DB_HOST: ${{ secrets.DB_HOST }}
          EXCHANGE_API_KEY: ${{ secrets.EXCHANGE_API_KEY }}

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: ./test-results/**/*.trx

      - name: Upload coverage
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: ./test-results/**/coverage.cobertura.xml
";

Console.WriteLine(workflow);
```

    
    # .github/workflows/test.yml
    name: Tests
    
    on:
      push:
        branches: [main, develop]
      pull_request:
        branches: [main]
    
    jobs:
      test:
        runs-on: ubuntu-latest
        strategy:
          matrix:
            dotnet-version: [8.0.x, 9.0.x]
    
        steps:
          - uses: actions/checkout@v4
    
          - name: Setup .NET
            uses: actions/setup-dotnet@v4
            with:
              dotnet-version: ${{ matrix.dotnet-version }}
    
          - name: Restore dependencies
            run: dotnet restore
    
          - name: Build
            run: dotnet build --no-restore --configuration Release
    
          - name: Run tests with coverage
            run: |
              dotnet test --no-build --configuration Release \
                --logger trx \
                --collect:"XPlat Code Coverage" \
                --results-directory ./test-results
            env:
              DB_HOST: ${{ secrets.DB_HOST }}
              EXCHANGE_API_KEY: ${{ secrets.EXCHANGE_API_KEY }}
    
          - name: Upload test results
            if: always()
            uses: actions/upload-artifact@v4
            with:
              name: test-results
              path: ./test-results/**/*.trx
    
          - name: Upload coverage
            if: always()
            uses: actions/upload-artifact@v4
            with:
              name: coverage
              path: ./test-results/**/coverage.cobertura.xml

#### Testing cheat sheet

> [!abstract]- C# Testing Quick Reference
>
> **Framework**
> | Command | Purpose |
> |---|---|
> | `dotnet test` | Run all tests |
> | `dotnet test --filter "Trade"` | Run tests matching pattern |
> | `dotnet test -v detailed` | Verbose output |
>
> **xUnit Attributes**
> | Attribute | Purpose | Python equivalent |
> |---|---|---|
> | `[Fact]` | Single test case | `def test_()` |
> | `[Theory]` + `[InlineData]` | Parametrized | `@pytest.mark.parametrize` |
> | `[Theory]` + `[MemberData]` | Parametrized from method | — |
>
> **Assertions** (`Assert.`)
> | Method | Purpose |
> |---|---|
> | `Equal(expected, actual)` | Equality |
> | `True(condition)` | Boolean |
> | `Null(obj)` / `NotNull(obj)` | Null check |
> | `Contains(item, coll)` | Membership |
> | `Throws<T>(() => ...)` | Expect exception |
> | `Matches(regex, str)` | Regex match |
>
> **Mocking (Moq):** `new Mock<IService>()` → `mock.Setup(s => ...).Returns()` → `mock.Object` → `mock.Verify(s => ..., Times)`
>
> **Python equivalents:** `Assert.Equal` → `assert x == y` | `Moq` → `unittest.mock` | constructor → `@pytest.fixture` | `IDisposable` → `yield` in fixture

#### Typical project layout
```
TradingPipeline/
├── src/TradingPipeline/
│   ├── Transforms/       // NormalizeTrades(), AdjustForSplits()
│   ├── Services/         // IMarketDataClient, IBrokerClient
│   ├── Quality/          // ValidateEodPrices()
│   └── Config/           // ExchangeConfig (from env vars)
├── tests/TradingPipeline.Tests/
│   ├── TransformTests.cs // Pure function tests — fast, no mocks
│   ├── MarketDataTests.cs// Mock exchange/API calls with Moq
│   ├── QualityTests.cs   // Data quality validation tests
│   └── ConfigTests.cs    // Test config loading
├── TradingPipeline.sln
└── Directory.Build.props
```
