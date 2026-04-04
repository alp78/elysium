---
tags: [csharp]
aliases: [design patterns, singleton, factory, observer, strategy, repository, dependency injection]
description: "C# design patterns and architecture reference with executable examples and cell outputs — covers singleton, factory, observer, strategy, repository patterns, and ASP.NET Core dependency injection. See [18_py_designpatterns](https://alp78.github.io/elysium/02-Programming-Languages/Python/18_py_designpatterns) for the Python equivalent."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 18. Design Patterns & Architecture - C#

> [!quote]
> "When I see patterns in my programs, I consider it a sign of trouble. The shape of a program should reflect only the problem it needs to solve."
>
> — **Paul Graham**, *Revenge of the Nerds*, essay (2002)


```csharp
// Suppress CS1701 assembly version warnings (NuGet packages on .NET 10).
using System.Reflection;
using Microsoft.DotNet.Interactive;
using Microsoft.DotNet.Interactive.CSharp;

using System.ComponentModel.DataAnnotations;
var csharpKernel = (CSharpKernel)Kernel.Root.FindKernelByName("csharp");
var optionsField = typeof(CSharpKernel).GetField("_scriptOptions",
    BindingFlags.NonPublic | BindingFlags.Instance);
var scriptOptions = optionsField.GetValue(csharpKernel);
var withWarningLevel = scriptOptions.GetType().GetMethod("WithWarningLevel");
var newOptions = withWarningLevel.Invoke(scriptOptions, new object[] { 0 });
optionsField.SetValue(csharpKernel, newOptions);
```

    WarningLevel set to 0.

## Dependency Injection

Interface defines the contract (what, not how). Constructor injection passes dependencies via the constructor. .NET's built-in `IServiceCollection` container offers three lifetimes: `AddTransient` (new per request), `AddScoped` (one per HTTP request), `AddSingleton` (one for the entire app). Python equivalent: just pass objects via `__init__` (no container needed).

```csharp
// ─── Interfaces ───


// ─── Production wiring ───
var prodRepo = new SqlRepository("Server=prod-db;Database=stoxx");
var prodNotifier = new SlackNotifier();
var prodService = new PipelineService(prodRepo, prodNotifier);
var result = prodService.Run("ASML.AS");
result

// ─── Test wiring — swap mocks ───
var mockRepo = new MockRepository();
var mockNotifier = new MockNotifier();
var testService = new PipelineService(mockRepo, mockNotifier);
result = testService.Run("TEST.XX");
result
string.Join(", ", mockRepo.Saved)   // saved to mock
string.Join(", ", mockNotifier.Messages)  // notifications

// ─── Type declarations ───

public interface IDataRepository
{
    List<Dictionary<string, object>> GetPrices(string ticker);
    int SaveScores(List<Dictionary<string, object>> scores);
}

public interface INotificationService
{
    void Notify(string message);
}

public class SqlRepository : IDataRepository
{
    public SqlRepository(string connectionString)
    {
        Console.WriteLine($"  SqlRepository connected to: {connectionString[..Math.Min(30, connectionString.Length)]}...");
    }
    public List<Dictionary<string, object>> GetPrices(string ticker)
        => new() { new() { ["ticker"] = ticker, ["close"] = 178.50 } };
    public int SaveScores(List<Dictionary<string, object>> scores)
    {
        Console.WriteLine($"  SqlRepository: saved {scores.Count} scores");
        return scores.Count;
    }
}

public class MockRepository : IDataRepository
{
    public List<string> Saved { get; } = new();
    public List<Dictionary<string, object>> GetPrices(string ticker)
        => new() { new() { ["ticker"] = ticker, ["close"] = 100.0 } };
    public int SaveScores(List<Dictionary<string, object>> scores)
    {
        Saved.AddRange(scores.Select(s => s["ticker"].ToString()!));
        return scores.Count;
    }
}

public class SlackNotifier : INotificationService
{
    public void Notify(string message) => Console.WriteLine($"  Slack: {message}");
}

public class MockNotifier : INotificationService
{
    public List<string> Messages { get; } = new();
    public void Notify(string message) => Messages.Add(message);
}

public class PipelineService
{
    private readonly IDataRepository _repo;
    private readonly INotificationService _notifier;

    public PipelineService(IDataRepository repo, INotificationService notifier)
    {
        _repo = repo;
        _notifier = notifier;
    }

    public string Run(string ticker)
    {
        var prices = _repo.GetPrices(ticker);
        var score = new Dictionary<string, object> { ["ticker"] = ticker, ["momentum"] = 0.85 };
        _repo.SaveScores(new() { score });
        _notifier.Notify($"Pipeline done: {ticker} scored 0.85");
        return $"{ticker}: momentum=0.85";
    }
}
```

      Server=prod-db;Database=stoxx...
      saved 1 scores
      Pipeline done: ASML.AS scored 0.85
      ASML.AS: momentum=0.85
    
      TEST.XX: momentum=0.85
      TEST.XX
      Pipeline done: TEST.XX scored 0.85

## Design Patterns

#### Singleton — one instance, global access point

The Singleton pattern ensures a class has exactly one instance throughout the application's lifetime and provides a global access point to it. In data engineering, singletons are common for database connection pools, configuration managers, and logging services — resources that are expensive to create and should be shared. In C#, a `static readonly` field with a private constructor is the simplest thread-safe implementation.

> [!warning] Singleton and testing
> Singletons make unit testing difficult because they carry global state between tests. Test A modifies the singleton's state, and Test B sees the modified state. Prefer dependency injection with a singleton LIFETIME (registered once in the DI container) over the classic Singleton pattern — it gives you the same single-instance behavior but with testability.

> [!success] Testable singleton via DI
> Register the dependency as `AddSingleton<T>()` in `IServiceCollection`. The DI container manages the single instance — tests can inject a mock or a fresh instance per test suite, eliminating shared state between test runs.

#### Factory — create objects without specifying exact class

The Factory pattern encapsulates object creation behind a static method or class, so the caller specifies *what* it needs (e.g., `"gcs"`) without knowing *which* concrete class gets instantiated. This decouples the consumer from the implementation — adding a new storage backend means adding one new class and one new case in the factory, with zero changes to calling code. In C#, a `switch` expression in a static method is the most concise form.

```csharp
// Singleton — exactly one instance.
// C#: use static readonly field or Lazy<T>.
// In DI: AddSingleton<T>() handles this automatically.
// Python equivalent: __new__ override or module-level variable.


var c1 = AppConfig.Instance;
var c2 = AppConfig.Instance;
object.ReferenceEquals(c1, c2)  // c1 == c2 (True)
c1.ProjectId

// ─── Factory ───
// Create objects without specifying exact class.
// Python equivalent: dict dispatch { "gcs": GCSClient, "s3": S3Client }.

foreach (var provider in new[] { "gcs", "s3", "local" })
{
    var client = StorageFactory.Create(provider);
    $"{provider,-5} -> {client.Upload("data.csv", new byte[100])}"
}

// ─── Type declarations ───

public class AppConfig
{
    // Lazy<T> ensures thread-safe, one-time initialization
    private static readonly Lazy<AppConfig> _instance = new(() => new AppConfig());
    public static AppConfig Instance => _instance.Value;

    public string ProjectId { get; } = "index-lab-2";
    public string Region { get; } = "europe-west1";
    public int BatchSize { get; } = 5000;

    private AppConfig() { Console.WriteLine("  Config loaded (once)"); }
}

public interface IStorageClient
{
    string Upload(string path, byte[] data);
}

public class GCSClient : IStorageClient
{
    public string Upload(string path, byte[] data) => $"gs://bucket/{path} ({data.Length} bytes)";
}
public class S3Client : IStorageClient
{
    public string Upload(string path, byte[] data) => $"s3://bucket/{path} ({data.Length} bytes)";
}
public class LocalClient : IStorageClient
{
    public string Upload(string path, byte[] data) => $"file://{path} ({data.Length} bytes)";
}

public static class StorageFactory
{
    public static IStorageClient Create(string provider) => provider switch
    {
        "gcs" => new GCSClient(),
        "s3" => new S3Client(),
        "local" => new LocalClient(),
        _ => throw new ArgumentException($"Unknown: {provider}")
    };
}
```

      Config loaded (once)
      c1 == c2: True
      index-lab-2
    
      gcs   -> gs://bucket/data.csv (100 bytes)
      s3    -> s3://bucket/data.csv (100 bytes)
      local -> file://data.csv (100 bytes)

#### Observer — one-to-many event notification

The Observer pattern establishes a one-to-many relationship: when one object (the subject) changes state, all its dependents (observers) are notified automatically. In C#, this is implemented with events and delegates — the subject exposes an `event`, and observers subscribe with `+=`. Common in data pipelines: a price feed publishes updates, and multiple consumers (dashboard, alerting system, persistence layer) each react independently.

#### Strategy — swap algorithms at runtime

The Strategy pattern encapsulates interchangeable algorithms behind a common interface, letting you swap behavior at runtime without modifying the code that uses it. Instead of an `if/else` chain selecting a scoring method, you inject the scoring function as a parameter. Each strategy (z-score normalization, percentile ranking, equal weighting) implements the same interface. The caller picks which strategy to use; the pipeline doesn't care which one it got.

```csharp
// Observer — notify multiple listeners when something happens.
// C#: event/delegate pattern (built into the language).
// Python equivalent: callback list or event bus.


var bus = new EventBus();
bus.StepCompleted += data => Console.WriteLine($"  [LOG]    {data.Step}: {data.Status}");
bus.StepCompleted += data => { if (data.Rows > 0) Console.WriteLine($"  [METRIC] rows={data.Rows}"); };
bus.StepCompleted += data => { if (data.Status == "error") Console.WriteLine($"  [ALERT]  {data.Message}"); };

bus.Publish(new StepEvent("ohlcv_load", "ok", 306, ""));
bus.Publish(new StepEvent("gold_score", "error", 0, "BQ timeout"));

// ─── Strategy ───
// Swap algorithms at runtime.
// Python equivalent: inject a strategy object with a score() method.

var prices = new double[] { 685, 690, 680, 695, 710, 700, 685 };
string.Join(", ", prices)  // prices

foreach (IScoringStrategy strategy in new IScoringStrategy[] { new MomentumStrategy(), new VolatilityStrategy() })
{
    var scorer = new StockScorer(strategy);
    var score = scorer.Evaluate("ASML.AS", prices);
    $"{strategy.Name,-15} score={score:+0.0000}"
}

// ─── Type declarations ───

public record StepEvent(string Step, string Status, int Rows, string Message);

public class EventBus
{
    // C# event + delegate — the language-level Observer pattern
    public event Action<StepEvent>? StepCompleted;
    public void Publish(StepEvent data) => StepCompleted?.Invoke(data);
}

public interface IScoringStrategy
{
    string Name { get; }
    double Score(double[] prices);
}

public class MomentumStrategy : IScoringStrategy
{
    public string Name => "Momentum";
    public double Score(double[] prices)
    {
        if (prices.Length == 0) return 0;
        var avg = prices.Average();
        return (prices[^1] - avg) / avg;
    }
}

public class VolatilityStrategy : IScoringStrategy
{
    public string Name => "Volatility";
    public double Score(double[] prices)
    {
        if (prices.Length < 2) return 0;
        var avg = prices.Average();
        var variance = prices.Select(p => Math.Pow(p - avg, 2)).Average();
        return -(Math.Sqrt(variance) / avg);
    }
}

public class StockScorer
{
    private readonly IScoringStrategy _strategy;
    public StockScorer(IScoringStrategy strategy) => _strategy = strategy;
    public double Evaluate(string ticker, double[] prices) => _strategy.Score(prices);
}
```

      [LOG]    ohlcv_load: ok
      [METRIC] rows=306
      [LOG]    gold_score: error
      [ALERT]  BQ timeout
    
    [685, 690, 680, 695, 710, 700, 685]
    
      Momentum        score=-+0.0103
      Volatility      score=-+0.0138

## Data Validation

Attribute-based validation built into .NET: `[Required]`, `[Range]`, `[StringLength]`, `[RegularExpression]`. `Validator.TryValidateObject()` validates and collects all errors. In ASP.NET, model binding auto-validates incoming requests. For complex cross-field rules, use `IValidatableObject.Validate()` or FluentValidation. Python equivalent: Pydantic `BaseModel` with `Field()` constraints.

```csharp
var validRecord = new OhlcvRecord
{
    Symbol = "ASML.AS", Date = new DateTime(2026, 3, 20),
    Open = 685.0, High = 710.0, Low = 680.0, Close = 700.0, Volume = 1_500_000
};
var (isValid, errors) = Validate(validRecord);
isValid  // valid

var badRecords = new OhlcvRecord[]
{
    new() { Symbol = "", Date = DateTime.Now, Open = -5, High = 10, Low = 8, Close = 9, Volume = 100 },
    new() { Symbol = "X", Date = DateTime.Now, Open = 10, High = 5, Low = 8, Close = 9, Volume = -1 },
};

foreach (var r in badRecords)
{
    var (ok, errs) = Validate(r);
    $"Symbol=\"{r.Symbol}\" Open={r.Open} High={r.High} Vol={r.Volume}"
    foreach (var e in errs)
        e.ErrorMessage
}

// ─── Helper ───
static (bool, List<ValidationResult>) Validate(object obj)
{
    var results = new List<ValidationResult>();
    var ctx = new ValidationContext(obj);
    var ok = Validator.TryValidateObject(obj, ctx, results, validateAllProperties: true);
    return (ok, results);
}

// ─── Type declarations ───

public class OhlcvRecord : IValidatableObject
{
    [Required(ErrorMessage = "Symbol is required")]
    [StringLength(20, MinimumLength = 1)]
    public string Symbol { get; set; } = "";

    [Required]
    public DateTime Date { get; set; }

    [Range(0.001, double.MaxValue, ErrorMessage = "Price must be positive")]
    public double Open { get; set; }

    [Range(0.001, double.MaxValue)]
    public double High { get; set; }

    [Range(0.001, double.MaxValue)]
    public double Low { get; set; }

    [Range(0.001, double.MaxValue)]
    public double Close { get; set; }

    [Range(0, long.MaxValue, ErrorMessage = "Volume cannot be negative")]
    public long Volume { get; set; }

    // Custom cross-field validation (like Pydantic @field_validator)
    public IEnumerable<ValidationResult> Validate(ValidationContext ctx)
    {
        if (High < Low)
            yield return new ValidationResult($"High ({High}) must be >= Low ({Low})", new[] { "High" });
    }
}
```

      True
    
      Symbol="" Open=-5 High=10 Vol=100
        -> Symbol is required
        -> Price must be positive
      Symbol="X" Open=10 High=5 Vol=-1
        -> Volume cannot be negative

## Reflection

#### Reflection — inspect and manipulate types at runtime

Reflection lets you examine a type's properties, methods, and constructors at runtime — and invoke them dynamically without compile-time knowledge of the type. This is the foundation of ORMs (mapping database columns to class properties), serializers (JSON/XML), DI containers (auto-resolving constructor parameters), and test frameworks (discovering test methods). The tradeoff is performance: reflection calls are 10-100x slower than direct calls, so avoid them in hot loops.

> [!warning] Reflection performance
> `GetProperty().GetValue()` uses late binding on every call. If you need to read properties in a tight loop (e.g., mapping 100K database rows), cache the `PropertyInfo` objects or use compiled expressions / source generators instead. A single reflection call is fine; a million is not.

> [!success] Cache PropertyInfo for hot paths
> Retrieve `PropertyInfo` objects once at startup and store them in a static dictionary. For maximum throughput, compile them into typed delegates with `Expression.Lambda<Func<T, object>>()` — this brings reflection-based access down to near-direct-call performance.

```csharp
// Reflection — inspect types, properties, methods at runtime.
// Python equivalent: type(), dir(), vars(), inspect module.
//
// Use cases: ORMs (map columns to properties), serializers,
// plugin systems, DI containers, test frameworks.

var order = new TradeOrder("ASML.AS", "BUY", 100, 685.40);
var type = order.GetType();

type.Name       // type name
type.FullName   // full name
type.IsClass    // is class
type.IsSealed   // is sealed

// ─── Properties ───
foreach (var prop in type.GetProperties())
{
    var value = prop.GetValue(order);
    $"{prop.Name,-12} {prop.PropertyType.Name,-10} = {value}"
}

// ─── Methods ───
foreach (var method in type.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
{
    var parms = string.Join(", ", method.GetParameters().Select(p => $"{p.ParameterType.Name} {p.Name}"));
    $"{method.ReturnType.Name} {method.Name}({parms})"
}

// ─── Dynamic property access (like Python getattr) ───
foreach (var name in new[] { "Ticker", "Side", "Quantity", "Price" })
{
    var prop = type.GetProperty(name);
    if (prop != null)
        $"{name} = {prop.GetValue(order)}"
}

// ─── Constructor inspection ───
foreach (var ctor in type.GetConstructors())
{
    foreach (var p in ctor.GetParameters())
        $"{p.Name}: {p.ParameterType.Name}"
}

// ─── Create instance via reflection (like Python's cls(**kwargs)) ───
var newOrder = Activator.CreateInstance(type, "MC.PA", "SELL", 50, 890.20);
newOrder

// ─── Type declaration ───

public class TradeOrder
{
    public string Ticker { get; }
    public string Side { get; }
    public int Quantity { get; }
    public double Price { get; }
    public double Notional => Quantity * Price;

    public TradeOrder(string ticker, string side, int quantity, double price)
    {
        Ticker = ticker; Side = side; Quantity = quantity; Price = price;
    }

    public override string ToString() => $"TradeOrder({Ticker}, {Side}, {Quantity}, {Price})";
}
```

      TradeOrder
      Submission#9+TradeOrder
      True
      False
    
      Ticker       String     = ASML.AS
      Side         String     = BUY
      Quantity     Int32      = 100
      Price        Double     = 685.4
      Notional     Double     = 68540
    
      String get_Ticker()
      String get_Side()
      Int32 get_Quantity()
      Double get_Price()
      Double get_Notional()
      String ToString()
    
      Ticker = ASML.AS
      Side = BUY
      Quantity = 100
      Price = 685.4
    
      ticker: String
      side: String
      quantity: Int32
      price: Double
    
      TradeOrder(MC.PA, SELL, 50, 890.2)

## Project Structure & Best Practices

```csharp
// Project Structure — how to organize a C# data pipeline / API project.
// Python equivalent: package → module hierarchy.

@"
=== Recommended Project Layout ===

IndexPipeline/
├── IndexPipeline.sln                # Solution file
│
├── src/
│   ├── IndexPipeline.Core/          # Domain layer (no dependencies)
│   │   ├── Interfaces/              # IDataRepository, INotificationService
│   │   ├── Models/                  # OhlcvRecord, PipelineConfig
│   │   └── Services/                # PipelineService (depends on interfaces only)
│   │
│   ├── IndexPipeline.Infra/         # Infrastructure (implements interfaces)
│   │   ├── Repositories/            # SqlRepository, BigQueryRepository
│   │   ├── Storage/                 # GCSClient, LocalClient
│   │   └── Notifications/           # SlackNotifier, PubSubNotifier
│   │
│   └── IndexPipeline.Api/           # Entry point (ASP.NET Minimal API)
│       ├── Program.cs               # DI wiring, app.MapGet/Post
│       └── appsettings.json         # Configuration
│
├── tests/
│   ├── IndexPipeline.Core.Tests/    # Unit tests (mock infra)
│   └── IndexPipeline.Infra.Tests/   # Integration tests
│
└── docker/
    └── Dockerfile                   # Multi-stage build

=== Key Principles ===

1. DEPENDENCY INVERSION
   Core defines interfaces. Infra implements them.
   Core NEVER references Infra. API wires them together via DI.
   Python equiv: ABC in models.py, implementations in fetchers/.

2. CONSTRUCTOR INJECTION
   builder.Services.AddScoped<IDataRepository, SqlRepository>();
   .NET DI container auto-resolves the dependency graph.
   Python equiv: pass objects via __init__.

3. VALIDATE AT BOUNDARIES
   DataAnnotations on DTOs. FluentValidation for complex rules.
   Internal code trusts validated models.
   Python equiv: Pydantic BaseModel.

4. CONFIGURATION
   appsettings.json + env vars (IConfiguration).
   builder.Services.Configure<PipelineOptions>(config);
   Python equiv: .env + os.environ + Pydantic Settings.

5. TEST THE LOGIC, MOCK THE BOUNDARY
   Unit test PipelineService with MockRepository.
   Integration test SqlRepository against real DB.
   Python equiv: pytest + unittest.mock.
"
```

    
    IndexPipeline/
    ├── IndexPipeline.sln                # Solution file
    │
    ├── src/
    │   ├── IndexPipeline.Core/          # Domain layer (no dependencies)
    │   │   ├── Interfaces/              # IDataRepository, INotificationService
    │   │   ├── Models/                  # OhlcvRecord, PipelineConfig
    │   │   └── Services/                # PipelineService (depends on interfaces only)
    │   │
    │   ├── IndexPipeline.Infra/         # Infrastructure (implements interfaces)
    │   │   ├── Repositories/            # SqlRepository, BigQueryRepository
    │   │   ├── Storage/                 # GCSClient, LocalClient
    │   │   └── Notifications/           # SlackNotifier, PubSubNotifier
    │   │
    │   └── IndexPipeline.Api/           # Entry point (ASP.NET Minimal API)
    │       ├── Program.cs               # DI wiring, app.MapGet/Post
    │       └── appsettings.json         # Configuration
    │
    ├── tests/
    │   ├── IndexPipeline.Core.Tests/    # Unit tests (mock infra)
    │   └── IndexPipeline.Infra.Tests/   # Integration tests
    │
    └── docker/
        └── Dockerfile                   # Multi-stage build
    
    
    1. DEPENDENCY INVERSION
       Core defines interfaces. Infra implements them.
       Core NEVER references Infra. API wires them together via DI.
       ABC in models.py, implementations in fetchers/.
    
    2. CONSTRUCTOR INJECTION
       builder.Services.AddScoped<IDataRepository, SqlRepository>();
       .NET DI container auto-resolves the dependency graph.
       pass objects via __init__.
    
    3. VALIDATE AT BOUNDARIES
       DataAnnotations on DTOs. FluentValidation for complex rules.
       Internal code trusts validated models.
       Pydantic BaseModel.
    
    4. CONFIGURATION
       appsettings.json + env vars (IConfiguration).
       builder.Services.Configure<PipelineOptions>(config);
       .env + os.environ + Pydantic Settings.
    
    5. TEST THE LOGIC, MOCK THE BOUNDARY
       Unit test PipelineService with MockRepository.
       Integration test SqlRepository against real DB.
       pytest + unittest.mock.

## Summary

> [!abstract]- C# Design Patterns Quick Reference
>
> | Pattern | C# | Usage |
> |---|---|---|
> | **Dependency Injection** | `interface IRepo` + `class SqlRepo : IRepo` | Constructor injection, `AddScoped<IRepo, SqlRepo>()` |
> | **Singleton** | `static readonly Lazy<T>` | Thread-safe; or `AddSingleton<T>()` via DI |
> | **Factory** | `static IClient Create(string type)` | `type switch { "gcs" => new GCS(), ... }` |
> | **Observer** | `event Action<T> EventName` | `+=` subscribe, `?.Invoke(data)` publish |
> | **Strategy** | `interface IStrategy` | Inject algorithm via constructor |
> | **Validation** | `[Required]`, `[Range]`, `[StringLength]` | DataAnnotations + `IValidatableObject` for cross-field |
> | **Reflection** | `obj.GetType()`, `type.GetProperties()` | `prop.GetValue(obj)`, `Activator.CreateInstance()` |
>
> **Python equivalents:** `interface` → `ABC`+`abstractmethod` | constructor injection → `__init__(dep)` | `AddSingleton<T>()` → module-level instance | `event Action<T>` → callback list | DataAnnotations → Pydantic `Field()` | `System.Reflection` → `type()`, `dir()`, `inspect`
