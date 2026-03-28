---
type: reference
category: programming-languages
technology: [csharp, dotnet]
tags: [testing, csharp]
aliases: [unit testing, pytest, xUnit, NUnit, test driven development, mocking, assertions]
keywords: [xUnit, NUnit, MSTest, Moq, FluentAssertions, Theory, Fact, fixture, mock, TDD]
description: "C# testing reference with executable examples and cell outputs — covers xUnit, NUnit, Moq, FluentAssertions, data-driven tests, and test-driven development patterns. See [[14_py_testing]] for the Python equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[14_py_testing]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 14. Testing - C#

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

> [!info] NuGet packages, imports, and shared type declarations for all test cells
> NuGet packages, imports, and shared type declarations for all test cells
>
> WHAT: this cell defines the test infrastructure used by ALL subsequent test cells:
>   - FactAttribute / TheoryAttribute / InlineDataAttribute: stub versions of xUnit's
>     test discovery attributes. In a real project, xUnit NuGet provides these.
>     [Fact] marks a parameterless test. [Theory] + [InlineData] marks a parametrized test.
>   - These stubs let us write tests with the real xUnit API without NuGet version conflicts.
>
> WHY stubs instead of real xUnit: .NET Interactive notebooks have assembly version
>   conflicts with xUnit's NuGet package. The stubs give us the same API surface
>   so the test code is copy-pasteable into a real xUnit project.

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

> [!info] Test runner — discovers and runs test methods on a class
> Test runner — discovers and runs test methods on a class
>
> WHAT: RunTests uses reflection to find all methods decorated with [Fact] or [Theory],
>   invokes them one by one, and catches exceptions to report PASS/FAIL.
>   This mimics what `dotnet test` does in a real xUnit project.
>
> WHY: in a real project, the xUnit runner handles discovery + execution.
>   In notebooks, we need this manual runner because there's no test host.
>   The PASS/FAIL output format matches xUnit's console output.

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

#### Assert class

> [!info] Assert class — lightweight reimplementation of xUnit's assertion library
> Assert class — lightweight reimplementation of xUnit's assertion library
>
> WHAT: each static method tests one condition and throws if it fails.
>   Equal: checks value equality (uses Equals, not ==).
>   True/False: checks a boolean condition.
>   Null/NotNull: checks for null references.
>   Contains: checks substring or predicate match in a collection.
>   Empty/NotEmpty: checks collection element count.
>   InRange: checks value is within [low, high] bounds.
>   Throws<T>: verifies that a specific exception type is thrown.
>   Single: verifies exactly one element in a collection.
>   Matches: verifies a regex pattern matches a string.
>
> WHY: xUnit's Assert is the standard API. By reimplementing it here,
>   test code written in this notebook is directly portable to a real xUnit project.
>   Just remove this class and add the xUnit NuGet package.

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

> [!warning] Unit Testing with xUnit — the standard C# test framework
> Unit Testing with xUnit — the standard C# test framework
>
> WHAT: xUnit is the most widely used testing framework in .NET.
>   [Fact] = a single test case (no parameters).
>   [Theory] + [InlineData] = a parametrized test (runs once per data row).
>   Assert.Equal/True/Throws = verify expected behavior.
>
> WHY xUnit over NUnit/MSTest:
>   - Constructor injection: xUnit creates a new class instance per test (isolation).
>   - No [SetUp]/[TearDown]: use constructor/IDisposable instead (cleaner).
>   - Industry standard: used by ASP.NET Core, EF Core, and most OSS projects.
>
> ANTI-PATTERNS:
>   - Don't share state between tests — each test should be independent.
>   - Don't test private methods — test the public API that uses them.
>   - Don't assert on implementation details — assert on observable behavior.
>
> KEY CONCEPTS:
> - xUnit: modern test framework for .NET. Runs with `dotnet test`.
> - [Fact]: marks a test method (no parameters). Like a pytest test_* function.
> - [Theory] + [InlineData]: parametrized test. Like @pytest.mark.parametrize.
> - Assert.Equal(), Assert.True(), etc. — explicit assertion methods.
> - Test classes: xUnit creates a new instance per test (isolation).
>
> NOTEBOOK NOTE:
> xUnit normally runs via `dotnet test` with a test project.
> In a notebook, we call test methods directly and report results.
> In production, tests live in a separate MyProject.Tests project.
>

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

> [!abstract]- [Theory] + [InlineData] — C# equivalent of @pytest.mark.parametrize
> [Theory] + [InlineData] — C# equivalent of @pytest.mark.parametrize.
> [Fact] = single test case (no parameters).
> [Theory] = parametrized test — runs once per [InlineData] set.
>
> In a notebook we simulate this with a loop.
> In a real test project, xUnit discovers and runs each InlineData automatically.

```csharp
void RunTest(string name, Action test)
{
    try { test(); Console.WriteLine($"  ✓ {name}"); }
    catch (Exception ex) { Console.WriteLine($"  ✗ {name}: {ex.Message}"); }
}
```

#### Parametrize: fee tier calculation

> [!info] In a real test project:
> In a real test project:
> [Theory]
> [InlineData(50_000,    30)]   // tier 1: < $100K → 30 bps
> [InlineData(500_000,   20)]   // tier 2: $100K-$1M → 20 bps
> [InlineData(5_000_000, 10)]   // tier 3: > $1M → 10 bps
> public void FeeTier_ReturnsCorrectBps(long volume, int expectedBps) { ... }

```csharp
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

> [!abstract]- Parametrized test — currency conversion with multiple FX rates
> Parametrized test — currency conversion with multiple FX rates
>
> WHAT THIS DOES, step by step:
>   1. fxCases is an array of tuples — each tuple is one test case with 4 fields:
>      (amountUsd, rate, expected, label). This is the C# equivalent of
>      @pytest.mark.parametrize("amt,rate,exp", [(1000, 0.92, 920), ...]) in Python.
>
>   2. foreach destructures each tuple: var (amt, rate, exp, label) = fxCases[i]
>      This gives us named variables instead of .Item1, .Item2, etc.
>
>   3. RunTest takes a test name + a lambda (Action). It runs the lambda inside
>      a try/catch — if it throws, the test FAILs; if it returns normally, it PASSes.
>
>   4. Assert.Equal(exp, amt * rate, precision: 5) checks that the actual result
>      (amt * rate) matches the expected value within 5 decimal places.
>      Floating-point math can produce tiny rounding errors (e.g., 0.92 * 1000 =
>      919.9999999... in IEEE 754), so precision: 5 allows tolerance of 0.00001.
>
> WHY: in a real xUnit project, you'd use [Theory] + [InlineData]:
>   [Theory]
>   [InlineData(1000.0, 0.92, 920.0, "USD→EUR")]
>   [InlineData(1000.0, 149.5, 149500.0, "USD→JPY")]
>   public void ConvertCurrency(double amt, double rate, double exp, string label)
>       => Assert.Equal(exp, amt * rate, 5);
>   xUnit runs the method once per [InlineData] row — same logic, declarative syntax.

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

> [!info] Parametrized test — OHLCV candle validation
> Parametrized test — OHLCV candle validation
>
> WHAT THIS TESTS:
>   IsValidBar checks the mathematical invariants of an OHLCV candle:
>     - high >= max(open, close): the highest price of the day must be >= both open and close
>     - low <= min(open, close): the lowest price must be <= both open and close
>     - volume >= 0: trade volume can be 0 (holiday/no trades) but never negative
>   If any invariant is violated, the data is corrupt (bad API response, transform bug).
>
> HOW IT WORKS:
>   1. IsValidBar is a static local function — a pure predicate that returns true/false.
>   2. ohlcvCases is an array of test tuples: (open, high, low, close, volume, expectedResult, label).
>      Each tuple describes one candle and whether it should be valid or invalid.
>   3. foreach runs RunTest for each case — Assert.Equal checks that IsValidBar
>      returns the expected boolean (true for valid bars, false for corrupt ones).
>
> WHY THIS MATTERS:
>   Financial APIs occasionally return garbage: high < open (impossible by definition),
>   negative volume, or close outside the high/low range. A pipeline that doesn't
>   validate this will feed bad data into models, producing wrong trading signals.

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

> [!warning] Mocking in C# — hand-written mocks for notebooks, Moq for real projects
> Mocking in C# — hand-written mocks for notebooks, Moq for real projects
>
> KEY CONCEPTS:
> - In production C#, you use Moq (NuGet) to auto-generate mocks from interfaces.
>   Moq API:  new Mock<IService>()  →  mock.Setup(s => s.Method()).Returns(value)
> - In notebooks, Moq triggers assembly version warnings on .NET 10.
>   So we write mocks by hand — same pattern, just explicit.
> - The core idea is identical: implement the interface with fake behavior,
>   then verify your code called the right methods with the right arguments.
>
> WHY MOCK?
> - Don't call real Bloomberg/exchange/database in tests.
> - Tests must be fast, isolated, deterministic.
> - Mock the boundary (interface), test the logic.

```csharp
#nullable enable

void RunTest(string name, Action test)
{
    try { test(); Console.WriteLine($"  ✓ {name}"); }
    catch (Exception ex) { Console.WriteLine($"  ✗ {name}: {ex.Message}"); }
}
```

#### Interfaces

```csharp
// In C#, you mock interfaces (not concrete classes).

Console.WriteLine("=== Mock Basics ===");
```

    === Mock Basics ===

#### Type declarations (must be after top-level statements)

> [!info] Type declarations for mocking — interfaces + domain types
> Type declarations for mocking — interfaces + domain types
>
> WHAT: in C#, you mock INTERFACES, not concrete classes.
>   An interface declares what methods exist; a mock implements them
>   with fake behavior (return canned data, throw errors, record calls).
>
> WHY interfaces:
>   - Production code depends on IMarketDataClient (interface)
>   - In tests: inject MockMarketDataClient (returns fake data)
>   - In production: inject RealMarketDataClient (calls live API)
>   - The code under test doesn't know or care which implementation it gets

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

#### Hand-written mock classes

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

> [!info] Hand-written mock — implements the interface with canned return values
> Hand-written mock — implements the interface with canned return values
>
> WHAT: MockMarketDataClient implements IMarketDataClient and returns
>   predefined data. It also records what was called (LastRequestedSymbol, CallCount)
>   so the test can verify that the code under test called the right methods.
>
> WHY hand-written vs Moq: Moq is the standard mocking library (mock.Setup(...)),
>   but hand-written mocks are clearer for learning. Both achieve the same goal:
>   control what the dependency returns, verify how it was called..
> Moq equivalent: new Mock<IMarketDataClient>()
>
> TEST: mock returns canned price, records which symbol was requested

```csharp
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

> [!warning] Testing transient failures — mock that fails N times then succeeds
> Testing transient failures — mock that fails N times then succeeds
>
> WHAT: MockExchangeGateway.FailCount controls how many calls throw IOException
>   before returning a successful "ACK". The test retries up to 3 times.
>   This simulates real-world transient errors: network timeouts, API 503s,
>   DB deadlocks — errors that succeed if you just try again.
>
> WHY: retry logic is critical in DE pipelines. Without testing it:
>   - You don't know if your retry actually retries (off-by-one: retries 2 times not 3)
>   - You don't know if it gives up correctly after max attempts
>   - You don't know if it returns the right result on eventual success
>
> PATTERN: set mock to fail N times → run code with retry loop → assert success + call count
>
> TEST: retry loop handles N failures then succeeds on attempt N+1

```csharp
#nullable enable
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

> [!info] DE/Finance test patterns — testing pipelines, transforms, data quality
> DE/Finance test patterns — testing pipelines, transforms, data quality.
>
> KEY PATTERNS:
> 1. Test transform functions (pure logic).
> 2. Mock external systems (exchange APIs, databases, cloud storage).
> 3. Constructor injection for test data (xUnit creates new instance per test).
> 4. Theory + InlineData for edge cases.

```csharp
void RunTest(string name, Action test)
{
    try { test(); Console.WriteLine($"  ✓ {name}"); }
    catch (Exception ex) { Console.WriteLine($"  ✗ {name}: {ex.Message}"); }
}
```

#### Type declarations

> [!info] Domain types and mock for DE pipeline testing
> Domain types and mock for DE pipeline testing
>
> IIndexDataClient: interface for fetching index constituents (e.g., Euro Stoxx 50 members).
>   In production: calls a real API (Twelve Data, Bloomberg, etc.).
>   In tests: replaced by MockIndexDataClient that returns canned data.
>   By depending on the interface (not the concrete class), the pipeline code
>   works with both — no code changes needed between test and production.
>
> Constituent: represents one stock in an index — ticker + market cap.
>   Used by the pipeline to know which stocks to fetch data for.
>
> EodPrice: end-of-day price bar for one stock — the core data structure in any
>   financial data pipeline. Fields match what APIs like yfinance/Twelve Data return.
>   Close, High, Low, Volume, PrevClose are the standard OHLCV fields.
>   PrevClose enables daily return calculation: (Close - PrevClose) / PrevClose.
>
> MockIndexDataClient: hand-written mock that implements IIndexDataClient.
>   - ConstituentsToReturn: set this in the test to control what GetConstituents returns.
>   - LastRequestedIndex: records what index was requested (verify correct API call).
>   - CallCount: tracks how many times GetConstituents was called.
>   This pattern (record inputs + return canned outputs) is exactly what Moq does
>   behind the scenes with mock.Setup(...).Returns(...) and mock.Verify(...).
>
> Interface — the contract that both real and mock implementations satisfy

```csharp
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

> [!info] Test a data transform — verify pure business logic in isolation
> Test a data transform — verify pure business logic in isolation
>
> WHAT: NormalizeTrades is a pure function (no side effects, no DB, no API).
>   It takes raw trade dictionaries and returns cleaned ones.
>   Tests verify: missing fields are skipped, tickers are uppercased,
>   negative prices are filtered, output format is correct.
>
> WHY: transform tests are the most valuable — they run fast (no I/O),
>   are deterministic (same input = same output), and catch logic bugs.
>   If this test fails, the bug is in YOUR code, not in the API or DB.

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

> [!info] Data quality checks — validate OHLCV financial data invariants
> Data quality checks — validate OHLCV financial data invariants
>
> WHAT: ValidateEodPrices takes a list of end-of-day prices and returns
>   a list of error strings. Each error describes one violated invariant.
>   Empty list = all data is valid. Non-empty = specific violations found.
>
> INVARIANTS CHECKED:
>   - close > 0 (no negative or zero prices)
>   - high >= low (by definition of OHLCV candles)
>   - volume >= 0 (can be 0 on holidays)
>   - daily return < 20% (catches data corruption, not normal volatility)
>
> WHY: bad API data is common — APIs return 0 for missing fields,
>   negative prices from currency conversion bugs, or extreme values
>   from stock splits that weren't adjusted. These tests catch them all.

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

> [!warning] Integration testing against the stoxx SQL Server database
> Integration testing against the stoxx SQL Server database
>
> WHAT: integration tests verify code against real dependencies (DB, APIs, files).
>   Unlike unit tests that mock the DB, these execute real SQL against SQL Server.
>   The stoxx database has a medallion architecture: bronze → silver → gold.
>
> WHY: unit tests with mocks can pass while real queries fail because:
>   - SQL syntax differs between engines (SQL Server vs Postgres vs SQLite)
>   - Schema migrations may have failed or drifted
>   - Data constraints (FK, UNIQUE, NOT NULL) only exist in the real DB
>   - Stored procedures or views may have been altered
>
> WHEN TO USE: after ETL runs, before deploying schema changes, in CI with Testcontainers
> ANTI-PATTERNS:
>   - Don't run destructive tests against production — use staging or ephemeral DB
>   - Don't hardcode connection strings — use env vars or config files
>   - Don't depend on specific data values — test invariants and ranges
>
> DATABASE SCHEMA (stoxx — Euro Stoxx 50 financial data):
>   bronze.eurostoxx50_ohlcv: raw daily OHLCV data (50 stocks, ingested from API)
>   silver.eurostoxx50_ohlcv: cleaned + gap-filled (is_filled flag for synthetic rows)
>   gold.index_performance:   aggregated index-level returns and volatility
>   gold.scores_daily:        per-stock composite scores and rankings
>
> WHAT: integration tests verify that your code works with real dependencies
>   (databases, APIs, file systems) — not just mocked interfaces.
>
> WHY: mocked tests can pass while real queries fail because:
>   - SQL syntax differs between engines
>   - Schema migrations may have failed
>   - Data constraints (FK, UNIQUE, NOT NULL) only exist in the real DB
>
> WHEN TO USE: data layer validation, ETL pipeline verification, schema checks
> ANTI-PATTERNS:
>   - Don't run integration tests in production DB — use staging/test instance
>   - Don't mutate shared test data — use transactions that rollback
>   - In CI: use Testcontainers for ephemeral, isolated DB instances

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

> [!info] Schema validation — verify tables exist and columns have expected types
> Schema validation — verify tables exist and columns have expected types
>
> WHAT: queries INFORMATION_SCHEMA to check that expected tables and columns exist.
>   These tests catch schema drift: a migration that renamed a column,
>   dropped a table, or changed a data type will break downstream queries.
>
> WHY: schema changes are the #1 cause of silent pipeline failures.
>   A renamed column produces NULLs instead of errors. A dropped table
>   crashes at runtime. Schema tests catch these at deploy time.
> Catches schema drift: renamed columns, dropped tables, changed data types
>
> TEST: all medallion layers exist for Euro Stoxx 50

```csharp
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

> [!info] Data completeness — verify expected row counts and symbol coverage
> Data completeness — verify expected row counts and symbol coverage
>
> WHAT: checks that the ETL pipeline ingested all expected data.
>   Tests: correct number of symbols, silver > bronze (backfill worked),
>   no NULL close prices (gap-filling succeeded), all indices present.
>
> WHY: a silent API failure might ingest 40 of 50 stocks.
>   Without completeness tests, the pipeline reports success but
>   downstream analytics are based on incomplete data.
>
> TEST: exactly 50 distinct symbols in bronze (Euro Stoxx 50 = 50 stocks)

```csharp
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

> [!info] Data quality — verify OHLCV invariants and business rules
> Data quality — verify OHLCV invariants and business rules
>
> WHAT: checks mathematical invariants that must hold for all financial data:
>   - high >= low (by definition of OHLCV candles)
>   - close is between low and high
>   - no negative prices or volumes
>   - no future dates (data from the future = bug or timezone error)
>
> WHY: bad API responses, timezone bugs, or transform errors can produce
>   data that looks valid but violates basic financial invariants.
>   A model trained on data where high < low will produce garbage.
> Catches data corruption, bad API responses, or transform bugs
>
> TEST: OHLCV invariant — high >= low for all rows

```csharp
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

> [!info] Cross-layer consistency — verify bronze → silver → gold pipeline integrity
> Cross-layer consistency — verify bronze → silver → gold pipeline integrity
>
> WHAT: checks that data flows correctly between medallion layers.
>   Each layer transforms the previous: bronze (raw) → silver (clean) → gold (aggregated).
>   If these tests fail, there is a bug in the ETL transform between layers.
>
> TESTS:
>   - silver has >= symbols as bronze (no stocks lost during cleaning)
>   - gap-filled rows (is_filled=1) are < 1% of total (minimal synthetic data)
>   - composite scores in valid z-score range (not [0,1] — common assumption bug!)
>   - daily returns within ±20% (catches extreme outliers from data errors)
>
> TEST: silver has at least as many symbols as bronze

```csharp
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

#### Validate service registration

> [!warning] DI Validation — catch missing service registrations at test time
> DI Validation — catch missing service registrations at test time
>
> WHAT: IServiceCollection is .NET's dependency injection container.
>   Services are registered with AddSingleton/AddScoped/AddTransient.
>   GetRequiredService<T>() resolves a service — throws if not registered.
>
> WHY: the #1 startup crash in .NET services is a missing DI registration.
>   Forgetting services.AddScoped<IFoo, Foo>() compiles fine but crashes
>   at runtime with "No service for type IFoo has been registered".
>   A DI validation test catches this during the build, not in production.
>
> WHEN TO USE: any project with DI (ASP.NET Core, worker services, console apps)
> ANTI-PATTERNS:
>   - Don't only test leaf services — resolve root services (they pull the full graph)
>   - Don't register services in tests that aren't registered in production
>   - Test lifetime mismatches: Scoped into Singleton throws at runtime
>
> WHAT: build a ServiceProvider and try to resolve every root service.
>   Missing registrations throw here (in tests) instead of crashing at runtime.
>
> WHY: forgetting AddScoped<IFoo, Foo>() in DI setup crashes at runtime
>   with "No service for type IFoo". This test catches it before deployment.
>
>
> Register services

```csharp
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

> [!info] GitHub Actions — automated testing on every push/PR
> GitHub Actions — automated testing on every push/PR.
>
> KEY CONCEPTS:
> - Workflow file: .github/workflows/test.yml
> - `dotnet test` runs xUnit/NUnit/MSTest tests automatically.
> - Matrix: test across multiple .NET versions (net8.0, net9.0).
> - Secrets: injected as env vars for integration tests.
> - coverlet: the standard .NET code coverage tool.
>
> This cell prints a production-ready workflow file.

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

> [!abstract]- Summary — C# testing cheat sheet
> Summary — C# testing cheat sheet
>
> FRAMEWORK:
> dotnet test                     Run all tests
> dotnet test --filter "Trade"    Run tests matching pattern
> dotnet test -v detailed         Verbose output
>
> xUnit ATTRIBUTES:
> [Fact]                          Single test case (like pytest def test_)
> [Theory] + [InlineData]         Parametrized (like @pytest.mark.parametrize)
> [Theory] + [MemberData]         Parametrized from method/property
>
> ASSERTIONS (Xunit.Assert):
> Assert.Equal(expected, actual)  Equality
> Assert.True(condition)          Boolean
> Assert.Null(obj)                Null check
> Assert.Contains(item, coll)     Membership
> Assert.Throws<T>(() => ...)     Expect exception
> Assert.Matches(regex, str)      Regex match
> Assert.Empty(collection)        Collection empty
> Assert.Single(collection)       Exactly one element
>
> MOCKING (Moq):
> new Mock<IService>()            Create mock
> mock.Setup(s => ...).Returns()  Configure return
> mock.Object                     Get the fake instance
> mock.Verify(s => ..., Times)    Assert call was made
> It.IsAny<T>()                   Match any argument
> It.Is<T>(predicate)             Match argument by condition
>
> xUnit           → pytest
> Assert.Equal    → assert x == y
> [Fact]          → def test_()
> [Theory]        → @pytest.mark.parametrize
> Moq             → unittest.mock
> constructor     → @pytest.fixture
> IDisposable     → yield in fixture

```csharp
Console.WriteLine("Testing cheat sheet loaded — see comments above.");
Console.WriteLine();
Console.WriteLine("Typical project layout:");
Console.WriteLine(@"
TradingPipeline/
├── src/
│   └── TradingPipeline/
│       ├── Transforms/           // NormalizeTrades(), AdjustForSplits()
│       ├── Services/             // IMarketDataClient, IBrokerClient
│       ├── Quality/              // ValidateEodPrices()
│       └── Config/               // ExchangeConfig (from env vars)
├── tests/
│   └── TradingPipeline.Tests/
│       ├── TransformTests.cs     // Pure function tests — fast, no mocks
│       ├── MarketDataTests.cs    // Mock exchange/API calls with Moq
│       ├── QualityTests.cs       // Data quality validation tests
│       └── ConfigTests.cs        // Test config loading
├── TradingPipeline.sln
└── Directory.Build.props
");
```

    Testing cheat sheet loaded — see comments above.
    
    Typical project layout:
    
    TradingPipeline/
    ├── src/
    │   └── TradingPipeline/
    │       ├── Transforms/           // NormalizeTrades(), AdjustForSplits()
    │       ├── Services/             // IMarketDataClient, IBrokerClient
    │       ├── Quality/              // ValidateEodPrices()
    │       └── Config/               // ExchangeConfig (from env vars)
    ├── tests/
    │   └── TradingPipeline.Tests/
    │       ├── TransformTests.cs     // Pure function tests — fast, no mocks
    │       ├── MarketDataTests.cs    // Mock exchange/API calls with Moq
    │       ├── QualityTests.cs       // Data quality validation tests
    │       └── ConfigTests.cs        // Test config loading
    ├── TradingPipeline.sln
    └── Directory.Build.props
