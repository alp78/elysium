---
type: reference
category: programming-languages
technology: [csharp, dotnet]
tags: [testing, csharp]
aliases: [unit testing, pytest, xUnit, NUnit, test driven development, mocking, assertions]
keywords: [xUnit, NUnit, MSTest, Moq, FluentAssertions, Theory, Fact, fixture, mock, TDD]
description: "C# testing reference with executable examples and cell outputs — covers xUnit, NUnit, Moq, FluentAssertions, data-driven tests, and test-driven development patterns. See [[12_Testing]] for the Python equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[12_Testing]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 12. Testing - C#

Topics covered:
- Unit Testing with xUnit
- Assertions & Test Organization
- Theory & InlineData (Parametrize)
- Mocking with Moq
- Test Patterns for Data Engineering


```csharp
#nullable enable
// Lightweight Assert class — same API as xUnit, zero dependencies.
// In a real project you'd use xUnit with `dotnet test`.
// In notebooks, this avoids NuGet assembly version warnings.

using System.Text.RegularExpressions;

public static class Assert
{
    public static void Equal<T>(T expected, T actual)
    {
        if (!Equals(expected, actual))
            throw new Exception($"Assert.Equal failed: expected <{expected}>, got <{actual}>");
    }
    public static void Equal(double expected, double actual, int precision)
    {
        var tolerance = Math.Pow(10, -precision);
        if (Math.Abs(expected - actual) > tolerance)
            throw new Exception($"Assert.Equal failed: expected <{expected}>, got <{actual}> (precision={precision})");
    }
    public static void Equal(decimal expected, decimal actual)
    {
        if (expected != actual)
            throw new Exception($"Assert.Equal failed: expected <{expected}>, got <{actual}>");
    }
    public static void True(bool condition, string message = "")
    {
        if (!condition)
            throw new Exception($"Assert.True failed. {message}");
    }
    public static void False(bool condition, string message = "")
    {
        if (condition)
            throw new Exception($"Assert.False failed. {message}");
    }
    public static void Null(object? value)
    {
        if (value != null)
            throw new Exception($"Assert.Null failed: got <{value}>");
    }
    public static void NotNull(object? value)
    {
        if (value == null)
            throw new Exception("Assert.NotNull failed: got null");
    }
    public static T Throws<T>(Action action) where T : Exception
    {
        try { action(); }
        catch (T ex) { return ex; }
        catch (Exception ex)
        {
            throw new Exception($"Assert.Throws failed: expected <{typeof(T).Name}>, got <{ex.GetType().Name}>: {ex.Message}");
        }
        throw new Exception($"Assert.Throws failed: expected <{typeof(T).Name}>, but no exception was thrown");
    }
    public static void Contains(string expected, string actual)
    {
        if (!actual.Contains(expected))
            throw new Exception($"Assert.Contains failed: '{expected}' not found in '{actual}'");
    }
    public static void Contains<T>(IEnumerable<T> collection, Func<T, bool> predicate)
    {
        if (!collection.Any(predicate))
            throw new Exception("Assert.Contains failed: no matching element found");
    }
    public static void Contains<T>(T item, IEnumerable<T> collection)
    {
        if (!collection.Contains(item))
            throw new Exception($"Assert.Contains failed: <{item}> not in collection");
    }
    public static void DoesNotContain<T>(T item, IEnumerable<T> collection)
    {
        if (collection.Contains(item))
            throw new Exception($"Assert.DoesNotContain failed: <{item}> found in collection");
    }
    public static void Empty<T>(IEnumerable<T> collection)
    {
        if (collection.Any())
            throw new Exception($"Assert.Empty failed: collection has {collection.Count()} elements");
    }
    public static void Single<T>(IEnumerable<T> collection)
    {
        var count = collection.Count();
        if (count != 1)
            throw new Exception($"Assert.Single failed: expected 1 element, got {count}");
    }
    public static void StartsWith(string expected, string actual)
    {
        if (!actual.StartsWith(expected))
            throw new Exception($"Assert.StartsWith failed: '{actual}' does not start with '{expected}'");
    }
    public static void Matches(string pattern, string actual)
    {
        if (!Regex.IsMatch(actual, pattern))
            throw new Exception($"Assert.Matches failed: '{actual}' does not match '{pattern}'");
    }
    public static T IsType<T>(object obj)
    {
        if (obj is T typed) return typed;
        throw new Exception($"Assert.IsType failed: expected <{typeof(T).Name}>, got <{obj?.GetType().Name}>");
    }
}
```

    
    (35,35): warning CS8632: The annotation for nullable reference types should only be used in code within a '#nullable' annotations context.
    
    (40,38): warning CS8632: The annotation for nullable reference types should only be used in code within a '#nullable' annotations context.
    
    

## 1. Unit Testing with xUnit


```csharp

// Unit Testing with xUnit — the standard C# test framework
//
// KEY CONCEPTS:
// - xUnit: modern test framework for .NET. Runs with `dotnet test`.
//   Python equivalent: pytest.
// - [Fact]: marks a test method (no parameters). Like a pytest test_* function.
// - [Theory] + [InlineData]: parametrized test. Like @pytest.mark.parametrize.
// - Assert.Equal(), Assert.True(), etc. — explicit assertion methods.
//   Python equivalent: plain assert (pytest rewrites it).
// - Test classes: xUnit creates a new instance per test (isolation).
//   Python equivalent: each test function runs independently.
//
// NOTEBOOK NOTE:
// xUnit normally runs via `dotnet test` with a test project.
// In a notebook, we call test methods directly and report results.
// In production, tests live in a separate MyProject.Tests project.

// ─── Helper to run tests in notebook ───
// In a real project, `dotnet test` discovers and runs these automatically.
// Here we call them manually and catch failures.

void RunTest(string name, Action test)
{
    try { test(); Console.WriteLine($"  ✓ {name}"); }
    catch (Exception ex) { Console.WriteLine($"  ✗ {name}: {ex.Message}"); }
}

Console.WriteLine("=== Basic xUnit Tests ===");

// ─── Basic Fact tests ───

RunTest("Price calculation", () =>
{
    // Trade price: quantity × unit_price
    int quantity = 150;
    decimal unitPrice = 42.75m;
    decimal total = quantity * unitPrice;
    Assert.Equal(6412.50m, total);
});

RunTest("Ticker normalization", () =>
{
    string rawTicker = "  aapl  ";
    Assert.Equal("AAPL", rawTicker.Trim().ToUpper());
});

RunTest("Portfolio weights sum to 1", () =>
{
    var weights = new Dictionary<string, double>
    {
        ["AAPL"] = 0.30, ["MSFT"] = 0.25, ["GOOG"] = 0.20, ["AMZN"] = 0.25
    };
    Assert.Equal(1.0, weights.Values.Sum(), precision: 10);
});

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

// ─── Testing exceptions ───
// Assert.Throws<T>() verifies an exception is thrown.
// Python equivalent: pytest.raises(ExceptionType)

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

RunTest("Missing key throws KeyNotFoundException", () =>
{
    var positions = new Dictionary<string, int> { ["AAPL"] = 100, ["MSFT"] = 50 };
    Assert.Throws<KeyNotFoundException>(() => { var _ = positions["TSLA"]; });
});
```

    === Basic xUnit Tests ===
      ✓ Price calculation
      ✓ Ticker normalization
      ✓ Portfolio weights sum to 1
      ✓ Trade record has required fields
      ✓ Invalid quantity throws ArgumentException
      ✓ Missing key throws KeyNotFoundException
    

## 2. Assertions & Test Organization


```csharp
#nullable enable


// xUnit Assertions — explicit methods for each check type.
// Python uses plain `assert` (pytest rewrites for diffs).
// C# uses Assert.Equal(), Assert.True(), Assert.Contains(), etc.
//
// Mapping:
//   Python: assert x == y        → C#: Assert.Equal(expected, actual)
//   Python: assert x > 0         → C#: Assert.True(x > 0)
//   Python: assert x is None     → C#: Assert.Null(x)
//   Python: assert "foo" in bar  → C#: Assert.Contains("foo", bar)
//   Python: pytest.approx()      → C#: Assert.Equal(expected, actual, precision)

void RunTest(string name, Action test)
{
    try { test(); Console.WriteLine($"  ✓ {name}"); }
    catch (Exception ex) { Console.WriteLine($"  ✗ {name}: {ex.Message}"); }
}

Console.WriteLine("=== Numeric Assertions ===");

RunTest("PnL calculation", () =>
{
    // Profit & Loss: (exit - entry) × quantity
    decimal entry = 150.25m, exit_ = 155.80m;
    int qty = 200;
    decimal pnl = (exit_ - entry) * qty;
    Assert.Equal(1110.00m, pnl);
});

RunTest("Basis points conversion", () =>
{
    // 50 bps = 0.50% = 0.005
    int bps = 50;
    double rate = bps / 10_000.0;
    Assert.Equal(0.005, rate, precision: 10);
});

RunTest("Floating-point tolerance", () =>
{
    // 0.1 + 0.2 != 0.3 in IEEE 754 — use precision parameter
    Assert.Equal(0.3, 0.1 + 0.2, precision: 10);
});

Console.WriteLine("\n=== Collection Assertions ===");

RunTest("Index constituents", () =>
{
    var techEtf = new HashSet<string> { "AAPL", "MSFT", "GOOG", "NVDA", "META" };
    Assert.Contains("AAPL", techEtf);
    Assert.DoesNotContain("TSLA", techEtf);
});

RunTest("OHLCV bar validation", () =>
{
    var bar = new Dictionary<string, double>
    {
        ["open"] = 150.0, ["high"] = 155.0, ["low"] = 149.0, ["close"] = 153.0, ["volume"] = 1_200_000
    };
    Assert.True(bar["high"] >= bar["low"]);
    Assert.True(bar["volume"] > 0);
    foreach (var key in new[] { "open", "high", "low", "close", "volume" })
        Assert.True(bar.ContainsKey(key), $"Missing: {key}");
});

Console.WriteLine("\n=== String Assertions ===");

RunTest("ISIN format", () =>
{
    // ISIN: 2-letter country + 9 alphanum + 1 check digit = 12 chars
    string isin = "US0378331005";  // Apple Inc.
    Assert.Equal(12, isin.Length);
    Assert.Matches("^[A-Z]{2}", isin);  // starts with country code
});

RunTest("Trade log format", () =>
{
    string log = "2024-03-15T14:30:00Z | BUY | AAPL | 100 @ 178.50";
    Assert.StartsWith("2024-03-15", log);
    Assert.Contains("BUY", log);
    Assert.Contains("AAPL", log);
});

Console.WriteLine("\n=== Null & Type Assertions ===");

RunTest("Optional field is null", () =>
{
    string? limitPrice = null;
    Assert.Null(limitPrice);
});

RunTest("Type checking", () =>
{
    object price = 178.50;
    Assert.IsType<double>(price);
});
```

    === Numeric Assertions ===
      ✓ PnL calculation
      ✓ Basis points conversion
      ✓ Floating-point tolerance
    
    === Collection Assertions ===
      ✓ Index constituents
      ✓ OHLCV bar validation
    
    === String Assertions ===
      ✓ ISIN format
      ✓ Trade log format
    
    === Null & Type Assertions ===
      ✓ Optional field is null
      ✓ Type checking
    

## 3. Theory & InlineData (Parametrize)


```csharp

// [Theory] + [InlineData] — C# equivalent of @pytest.mark.parametrize.
// [Fact] = single test case (no parameters).
// [Theory] = parametrized test — runs once per [InlineData] set.
//
// In a notebook we simulate this with a loop.
// In a real test project, xUnit discovers and runs each InlineData automatically.

void RunTest(string name, Action test)
{
    try { test(); Console.WriteLine($"  ✓ {name}"); }
    catch (Exception ex) { Console.WriteLine($"  ✗ {name}: {ex.Message}"); }
}

// ─── Parametrize: fee tier calculation ───
// In a real test project:
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
    RunTest($"Volume ${vol:N0} → {bps} bps", () => Assert.Equal(bps, GetFeeBps(vol)));

// ─── Parametrize: currency conversion ───

Console.WriteLine("\n=== Currency Conversion [Theory] ===");
var fxCases = new (double amountUsd, double rate, double expected, string label)[]
{
    (1000.0, 0.92,  920.0,    "USD→EUR"),
    (1000.0, 149.5, 149500.0, "USD→JPY"),
    (1000.0, 0.79,  790.0,    "USD→GBP"),
};
foreach (var (amt, rate, exp, label) in fxCases)
    RunTest($"{label}: {amt} × {rate} = {exp}", () =>
        Assert.Equal(exp, amt * rate, precision: 5));

// ─── Parametrize: OHLCV validation ───

Console.WriteLine("\n=== OHLCV Validation [Theory] ===");

static bool IsValidBar(double o, double h, double l, double c, long v)
    => h >= Math.Max(o, c) && l <= Math.Min(o, c) && v >= 0;

var ohlcvCases = new (double o, double h, double l, double c, long v, bool valid, string label)[]
{
    (100, 105, 98,  103, 50000, true,  "valid bar"),
    (100, 95,  98,  99,  50000, false, "high < open"),
    (100, 105, 98,  103, -1,    false, "negative volume"),
};
foreach (var tc in ohlcvCases)
    RunTest(tc.label, () => Assert.Equal(tc.valid, IsValidBar(tc.o, tc.h, tc.l, tc.c, tc.v)));

// ─── Parametrize: ticker validation ───

Console.WriteLine("\n=== Ticker Validation [Theory] ===");

static bool IsValidTicker(string ticker)
    => System.Text.RegularExpressions.Regex.IsMatch(ticker, @"^[A-Z]{1,5}(\.[A-Z])?$");

var tickerCases = new (string ticker, bool valid)[]
{
    ("AAPL", true), ("BRK.B", true), ("", false), ("aapl", false), ("ABCDEFGHIJ", false)
};
foreach (var (ticker, valid) in tickerCases)
    RunTest($"\"{ticker}\" → {valid}", () => Assert.Equal(valid, IsValidTicker(ticker)));
```

    === Fee Tier [Theory] ===
      ✓ Volume $50'000 → 30 bps
      ✓ Volume $500'000 → 20 bps
      ✓ Volume $5'000'000 → 10 bps
    
    === Currency Conversion [Theory] ===
      ✓ USD→EUR: 1000 × 0.92 = 920
      ✓ USD→JPY: 1000 × 149.5 = 149500
      ✓ USD→GBP: 1000 × 0.79 = 790
    
    === OHLCV Validation [Theory] ===
      ✓ valid bar
      ✓ high < open
      ✓ negative volume
    
    === Ticker Validation [Theory] ===
      ✓ "AAPL" → True
      ✓ "BRK.B" → True
      ✓ "" → False
      ✓ "aapl" → False
      ✓ "ABCDEFGHIJ" → False
    

## 4. Mocking with Moq


```csharp
#nullable enable
using System.IO;

// Mocking in C# — hand-written mocks for notebooks, Moq for real projects
//
// KEY CONCEPTS:
// - In production C#, you use Moq (NuGet) to auto-generate mocks from interfaces.
//   Moq API:  new Mock<IService>()  →  mock.Setup(s => s.Method()).Returns(value)
//   Python equivalent: unittest.mock.Mock() with mock.return_value = ...
// - In notebooks, Moq triggers assembly version warnings on .NET 10.
//   So we write mocks by hand — same pattern, just explicit.
// - The core idea is identical: implement the interface with fake behavior,
//   then verify your code called the right methods with the right arguments.
//
// WHY MOCK?
// - Don't call real Bloomberg/exchange/database in tests.
// - Tests must be fast, isolated, deterministic.
// - Mock the boundary (interface), test the logic.

void RunTest(string name, Action test)
{
    try { test(); Console.WriteLine($"  ✓ {name}"); }
    catch (Exception ex) { Console.WriteLine($"  ✗ {name}: {ex.Message}"); }
}

// ─── Interfaces ───
// In C#, you mock interfaces (not concrete classes).
// Python mocks any object (duck typing). C# needs an interface contract.

Console.WriteLine("=== Mock Basics ===");

// ─── Mock: market data client ───
// Hand-written mock implements the interface and records calls.
// Moq equivalent: new Mock<IMarketDataClient>()

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

// ─── Mock: broker order submission ───
// Moq equivalent: mock.Setup(b => b.SubmitOrder(It.IsAny<Order>())).Returns(...)

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

// ─── Mock: transient failure (side_effect equivalent) ───
// Moq equivalent: mock.Setup(...).Returns(() => { if (count < 3) throw ...; })
// Python equivalent: mock.side_effect = [Exception, Exception, value]

RunTest("Mock with transient failure + retry", () =>
{
    var mock = new MockExchangeGateway();
    mock.FailCount = 2;  // fail first 2 calls, succeed on 3rd

    string? result = null;
    for (int i = 0; i < 3; i++)
    {
        try { result = mock.Send("NEW_ORDER"); break; }
        catch (IOException) { continue; }
    }

    Assert.Equal("ACK", result);
    Assert.Equal(3, mock.CallCount);
});

Console.WriteLine("\n=== Moq Equivalent (for real projects) ===");
Console.WriteLine(@"
  // In a real test project with Moq (NuGet: Moq):
  var mock = new Mock<IMarketDataClient>();
  mock.Setup(c => c.GetQuote(""AAPL""))
      .Returns(new Quote { Ticker = ""AAPL"", Last = 178.50 });

  var quote = mock.Object.GetQuote(""AAPL"");
  Assert.Equal(178.50, quote.Last);
  mock.Verify(c => c.GetQuote(""AAPL""), Times.Once());
");

// ─── Type declarations (must be after top-level statements) ───

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

// ─── Hand-written mock classes ───
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

    === Mock Basics ===
      ✓ Mock market data quote
      ✓ Mock order submission
      ✓ Mock with transient failure + retry
    
    === Moq Equivalent (for real projects) ===
    
      // In a real test project with Moq (NuGet: Moq):
      var mock = new Mock<IMarketDataClient>();
      mock.Setup(c => c.GetQuote("AAPL"))
          .Returns(new Quote { Ticker = "AAPL", Last = 178.50 });
    
      var quote = mock.Object.GetQuote("AAPL");
      Assert.Equal(178.50, quote.Last);
      mock.Verify(c => c.GetQuote("AAPL"), Times.Once());
    
    



## 5. Test Patterns for Data Engineering


```csharp
using System.IO;

// DE/Finance test patterns — testing pipelines, transforms, data quality.
//
// KEY PATTERNS:
// 1. Test transform functions (pure logic).
// 2. Mock external systems (exchange APIs, databases, cloud storage).
// 3. Constructor injection for test data (xUnit creates new instance per test).
// 4. Theory + InlineData for edge cases.

void RunTest(string name, Action test)
{
    try { test(); Console.WriteLine($"  ✓ {name}"); }
    catch (Exception ex) { Console.WriteLine($"  ✗ {name}: {ex.Message}"); }
}

// ─── Pattern 1: Test a data transform ───

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

RunTest("NormalizeTrades empty list", () =>
{
    Assert.Empty(NormalizeTrades(new List<Dictionary<string, object>>()));
});

// ─── Pattern 2: Mock external service (hand-written) ───

Console.WriteLine("\n=== Mock External Service ===");

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

// ─── Pattern 3: Data quality checks ───

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

RunTest("Valid EOD data passes", () =>
{
    var prices = new List<EodPrice>
    {
        new() { Ticker = "AAPL", Close = 178.50, High = 180.0, Low = 176.0, Volume = 50_000_000, PrevClose = 177.0 },
        new() { Ticker = "MSFT", Close = 415.20, High = 418.0, Low = 412.0, Volume = 25_000_000, PrevClose = 413.0 },
    };
    Assert.Empty(ValidateEodPrices(prices));
});

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

// ─── Type declarations ───

public interface IIndexDataClient { List<Constituent> GetConstituents(string index); }

public class Constituent
{
    public string Ticker { get; set; } = "";
    public long MarketCap { get; set; }
}

public class EodPrice
{
    public string Ticker { get; set; } = "";
    public double Close { get; set; }
    public double High { get; set; }
    public double Low { get; set; }
    public long Volume { get; set; }
    public double PrevClose { get; set; }
}

public class MockIndexDataClient : IIndexDataClient
{
    public List<Constituent> ConstituentsToReturn { get; set; } = new();
    public string LastRequestedIndex { get; private set; } = "";
    public int CallCount { get; private set; }
    public List<Constituent> GetConstituents(string index)
    {
        LastRequestedIndex = index;
        CallCount++;
        return ConstituentsToReturn;
    }
}
```

    === Transform Tests ===
      ✓ NormalizeTrades basic
      ✓ NormalizeTrades drops missing ID
      ✓ NormalizeTrades empty list
    
    === Mock External Service ===
      ✓ Index weight calculation with mock
    
    === Data Quality Tests ===
      ✓ Valid EOD data passes
      ✗ Catches invalid prices: Assert.Equal failed: expected <3>, got <4>
    

## 6. CI/CD — Running Tests in GitHub Actions


```csharp
// GitHub Actions — automated testing on every push/PR.
//
// KEY CONCEPTS:
// - Workflow file: .github/workflows/test.yml
// - `dotnet test` runs xUnit/NUnit/MSTest tests automatically.
// - Matrix: test across multiple .NET versions (net8.0, net9.0).
// - Secrets: injected as env vars for integration tests.
// - coverlet: the standard .NET code coverage tool.
//
// This cell prints a production-ready workflow file.

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
Console.WriteLine(new string('─', 60));
Console.WriteLine();
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
    
    ────────────────────────────────────────────────────────────
    
    
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
    
    


```csharp
// Summary — C# testing cheat sheet
//
// FRAMEWORK:
// dotnet test                     Run all tests
// dotnet test --filter "Trade"    Run tests matching pattern
// dotnet test -v detailed         Verbose output
//
// xUnit ATTRIBUTES:
// [Fact]                          Single test case (like pytest def test_)
// [Theory] + [InlineData]         Parametrized (like @pytest.mark.parametrize)
// [Theory] + [MemberData]         Parametrized from method/property
//
// ASSERTIONS (Xunit.Assert):
// Assert.Equal(expected, actual)  Equality
// Assert.True(condition)          Boolean
// Assert.Null(obj)                Null check
// Assert.Contains(item, coll)     Membership
// Assert.Throws<T>(() => ...)     Expect exception
// Assert.Matches(regex, str)      Regex match
// Assert.Empty(collection)        Collection empty
// Assert.Single(collection)       Exactly one element
//
// MOCKING (Moq):
// new Mock<IService>()            Create mock
// mock.Setup(s => ...).Returns()  Configure return
// mock.Object                     Get the fake instance
// mock.Verify(s => ..., Times)    Assert call was made
// It.IsAny<T>()                   Match any argument
// It.Is<T>(predicate)             Match argument by condition
//
// PYTHON EQUIVALENTS:
// xUnit           → pytest
// Assert.Equal    → assert x == y
// [Fact]          → def test_()
// [Theory]        → @pytest.mark.parametrize
// Moq             → unittest.mock
// constructor     → @pytest.fixture
// IDisposable     → yield in fixture

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
    
    
