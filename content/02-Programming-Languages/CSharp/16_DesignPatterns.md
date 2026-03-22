---
type: reference
category: programming-languages
technology: [csharp, dotnet]
tags: [reference, programming-languages, csharp, dotnet, design-patterns]
aliases: [design patterns, singleton, factory, observer, strategy, repository, dependency injection]
keywords: [singleton, factory, observer, strategy, repository, dependency injection, SOLID, IServiceCollection, DI container]
description: "C# design patterns and architecture reference with executable examples and cell outputs — covers singleton, factory, observer, strategy, repository patterns, and ASP.NET Core dependency injection. See [[16_DesignPatterns - Python]] for the Python equivalent."
related:
  - "[[16_DesignPatterns - Python]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 16. Design Patterns & Architecture - C#

Topics covered:
- Dependency Injection
- Design Patterns (Singleton, Factory, Observer, Strategy)
- Data Validation (DataAnnotations)
- Reflection
- Project Structure & Best Practices


```C#
// Suppress CS1701 assembly version warnings (NuGet packages on .NET 10).
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
Console.WriteLine("WarningLevel set to 0.");
```




<div>

    <div id='dotnet-interactive-this-cell-$CACHE_BUSTER$' style='display: none'>

        The below script needs to be able to find the current output cell; this is an easy method to get it.

    </div>

    <script type='text/javascript'>

async function probeAddresses(probingAddresses) {

    function timeout(ms, promise) {

        return new Promise(function (resolve, reject) {

            setTimeout(function () {

                reject(new Error('timeout'))

            }, ms)

            promise.then(resolve, reject)

        })

    }



    if (Array.isArray(probingAddresses)) {

        for (let i = 0; i < probingAddresses.length; i++) {



            let rootUrl = probingAddresses[i];



            if (!rootUrl.endsWith('/')) {

                rootUrl = `${rootUrl}/`;

            }



            try {

                let response = await timeout(1000, fetch(`${rootUrl}discovery`, {

                    method: 'POST',

                    cache: 'no-cache',

                    mode: 'cors',

                    timeout: 1000,

                    headers: {

                        'Content-Type': 'text/plain'

                    },

                    body: probingAddresses[i]

                }));



                if (response.status == 200) {

                    return rootUrl;

                }

            }

            catch (e) { }

        }

    }

}



function loadDotnetInteractiveApi() {

    probeAddresses(["http://2a02:8308:718a:f200::655c:2048/","http://2a02:8308:718a:f200:8bd4:d06d:33ed:be05:2048/","http://2a02:8308:718a:f200:812b:542c:9d38:5803:2048/","http://fe80::3212:d8da:d32d:4723%14:2048/","http://192.168.0.110:2048/","http://::1:2048/","http://127.0.0.1:2048/","http://fe80::91de:1423:fe62:933b%45:2048/","http://172.25.64.1:2048/"])

        .then((root) => {

        // use probing to find host url and api resources

        // load interactive helpers and language services

        let dotnetInteractiveRequire = require.config({

        context: '18844.Microsoft.DotNet.Interactive.Http.HttpPort',

                paths:

            {

                'dotnet-interactive': `${root}resources`

                }

        }) || require;



            window.dotnetInteractiveRequire = dotnetInteractiveRequire;



            window.configureRequireFromExtension = function(extensionName, extensionCacheBuster) {

                let paths = {};

                paths[extensionName] = `${root}extensions/${extensionName}/resources/`;

                

                let internalRequire = require.config({

                    context: extensionCacheBuster,

                    paths: paths,

                    urlArgs: `cacheBuster=${extensionCacheBuster}`

                    }) || require;



                return internalRequire

            };

        

            dotnetInteractiveRequire([

                    'dotnet-interactive/dotnet-interactive'

                ],

                function (dotnet) {

                    dotnet.init(window);

                },

                function (error) {

                    console.log(error);

                }

            );

        })

        .catch(error => {console.log(error);});

    }



// ensure `require` is available globally

if ((typeof(require) !==  typeof(Function)) || (typeof(require.config) !== typeof(Function))) {

    let require_script = document.createElement('script');

    require_script.setAttribute('src', 'https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.6/require.min.js');

    require_script.setAttribute('type', 'text/javascript');

    

    

    require_script.onload = function() {

        loadDotnetInteractiveApi();

    };



    document.getElementsByTagName('head')[0].appendChild(require_script);

}

else {

    loadDotnetInteractiveApi();

}



    </script>

</div>


    WarningLevel set to 0.
    

## 1. Dependency Injection


```C#
// Dependency Injection — the foundation of testable C# architecture.
//
// KEY CONCEPTS:
// - Interface: defines the contract (what, not how).
// - Constructor injection: class receives dependencies via constructor.
// - IServiceCollection: .NET's built-in DI container.
//   builder.Services.AddTransient<IRepo, SqlRepo>() — new instance per request
//   builder.Services.AddScoped<IRepo, SqlRepo>()    — one per scope (HTTP request)
//   builder.Services.AddSingleton<IRepo, SqlRepo>() — one for entire app
// - Python equivalent: just pass objects via __init__ (no container needed).

// ─── Interfaces ───

Console.WriteLine("=== Dependency Injection ===");

// ─── Production wiring ───
var prodRepo = new SqlRepository("Server=prod-db;Database=stoxx");
var prodNotifier = new SlackNotifier();
var prodService = new PipelineService(prodRepo, prodNotifier);
var result = prodService.Run("ASML.AS");
Console.WriteLine($"  Result: {result}");

// ─── Test wiring — swap mocks ───
Console.WriteLine("\n=== Test (with mocks) ===");
var mockRepo = new MockRepository();
var mockNotifier = new MockNotifier();
var testService = new PipelineService(mockRepo, mockNotifier);
result = testService.Run("TEST.XX");
Console.WriteLine($"  Result: {result}");
Console.WriteLine($"  Saved to mock: {string.Join(", ", mockRepo.Saved)}");
Console.WriteLine($"  Notifications: {string.Join(", ", mockNotifier.Messages)}");

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

    === Dependency Injection ===
      SqlRepository connected to: Server=prod-db;Database=stoxx...
      SqlRepository: saved 1 scores
      Slack: Pipeline done: ASML.AS scored 0.85
      Result: ASML.AS: momentum=0.85
    
    === Test (with mocks) ===
      Result: TEST.XX: momentum=0.85
      Saved to mock: TEST.XX
      Notifications: Pipeline done: TEST.XX scored 0.85
    

## 2. Design Patterns


```C#
// Singleton — exactly one instance.
// C#: use static readonly field or Lazy<T>.
// In DI: AddSingleton<T>() handles this automatically.
// Python equivalent: __new__ override or module-level variable.

Console.WriteLine("=== Singleton ===");

var c1 = AppConfig.Instance;
var c2 = AppConfig.Instance;
Console.WriteLine($"  c1 == c2: {object.ReferenceEquals(c1, c2)}");  // True
Console.WriteLine($"  ProjectId: {c1.ProjectId}");

// ─── Factory ───
// Create objects without specifying exact class.
// Python equivalent: dict dispatch { "gcs": GCSClient, "s3": S3Client }.

Console.WriteLine("\n=== Factory ===");
foreach (var provider in new[] { "gcs", "s3", "local" })
{
    var client = StorageFactory.Create(provider);
    Console.WriteLine($"  {provider,-5} -> {client.Upload("data.csv", new byte[100])}");
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

    === Singleton ===
      Config loaded (once)
      c1 == c2: True
      ProjectId: index-lab-2
    
    === Factory ===
      gcs   -> gs://bucket/data.csv (100 bytes)
      s3    -> s3://bucket/data.csv (100 bytes)
      local -> file://data.csv (100 bytes)
    


```C#
// Observer — notify multiple listeners when something happens.
// C#: event/delegate pattern (built into the language).
// Python equivalent: callback list or event bus.

Console.WriteLine("=== Observer ===");

var bus = new EventBus();
bus.StepCompleted += data => Console.WriteLine($"  [LOG]    {data.Step}: {data.Status}");
bus.StepCompleted += data => { if (data.Rows > 0) Console.WriteLine($"  [METRIC] rows={data.Rows}"); };
bus.StepCompleted += data => { if (data.Status == "error") Console.WriteLine($"  [ALERT]  {data.Message}"); };

bus.Publish(new StepEvent("ohlcv_load", "ok", 306, ""));
bus.Publish(new StepEvent("gold_score", "error", 0, "BQ timeout"));

// ─── Strategy ───
// Swap algorithms at runtime.
// Python equivalent: inject a strategy object with a score() method.

Console.WriteLine("\n=== Strategy ===");
var prices = new double[] { 685, 690, 680, 695, 710, 700, 685 };
Console.WriteLine($"Prices: [{string.Join(", ", prices)}]\n");

foreach (IScoringStrategy strategy in new IScoringStrategy[] { new MomentumStrategy(), new VolatilityStrategy() })
{
    var scorer = new StockScorer(strategy);
    var score = scorer.Evaluate("ASML.AS", prices);
    Console.WriteLine($"  {strategy.Name,-15} score={score:+0.0000}");
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

    === Observer ===
      [LOG]    ohlcv_load: ok
      [METRIC] rows=306
      [LOG]    gold_score: error
      [ALERT]  BQ timeout
    
    === Strategy ===
    Prices: [685, 690, 680, 695, 710, 700, 685]
    
      Momentum        score=-+0.0103
      Volatility      score=-+0.0138
    

## 3. Data Validation


```C#
using System.ComponentModel.DataAnnotations;

// Data Validation with DataAnnotations — built into .NET.
// Python equivalent: Pydantic BaseModel with Field() constraints.
//
// KEY CONCEPTS:
// - [Required], [Range], [StringLength], [RegularExpression] — attribute-based.
// - Validator.TryValidateObject() — validate and collect all errors.
// - In ASP.NET, model binding auto-validates incoming requests.
// - For complex rules: IValidatableObject.Validate() or FluentValidation.

Console.WriteLine("=== Valid Data ===");
var validRecord = new OhlcvRecord
{
    Symbol = "ASML.AS", Date = new DateTime(2026, 3, 20),
    Open = 685.0, High = 710.0, Low = 680.0, Close = 700.0, Volume = 1_500_000
};
var (isValid, errors) = Validate(validRecord);
Console.WriteLine($"  Valid: {isValid}");

Console.WriteLine("\n=== Invalid Data ===");
var badRecords = new OhlcvRecord[]
{
    new() { Symbol = "", Date = DateTime.Now, Open = -5, High = 10, Low = 8, Close = 9, Volume = 100 },
    new() { Symbol = "X", Date = DateTime.Now, Open = 10, High = 5, Low = 8, Close = 9, Volume = -1 },
};

foreach (var r in badRecords)
{
    var (ok, errs) = Validate(r);
    Console.WriteLine($"  Symbol=\"{r.Symbol}\" Open={r.Open} High={r.High} Vol={r.Volume}");
    foreach (var e in errs)
        Console.WriteLine($"    -> {e.ErrorMessage}");
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

    === Valid Data ===
      Valid: True
    
    === Invalid Data ===
      Symbol="" Open=-5 High=10 Vol=100
        -> Symbol is required
        -> Price must be positive
      Symbol="X" Open=10 High=5 Vol=-1
        -> Volume cannot be negative
    

## 4. Reflection


```C#
using System.Reflection;

// Reflection — inspect types, properties, methods at runtime.
// Python equivalent: type(), dir(), vars(), inspect module.
//
// Use cases: ORMs (map columns to properties), serializers,
// plugin systems, DI containers, test frameworks.

Console.WriteLine("=== Type Inspection ===");
var order = new TradeOrder("ASML.AS", "BUY", 100, 685.40);
var type = order.GetType();

Console.WriteLine($"  Type name:     {type.Name}");        // TradeOrder
Console.WriteLine($"  Full name:     {type.FullName}");    // Submission#X+TradeOrder
Console.WriteLine($"  Is class:      {type.IsClass}");     // True
Console.WriteLine($"  Is sealed:     {type.IsSealed}");    // depends

// ─── Properties ───
Console.WriteLine("\n=== Properties ===");
foreach (var prop in type.GetProperties())
{
    var value = prop.GetValue(order);
    Console.WriteLine($"  {prop.Name,-12} {prop.PropertyType.Name,-10} = {value}");
}

// ─── Methods ───
Console.WriteLine("\n=== Methods (declared) ===");
foreach (var method in type.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
{
    var parms = string.Join(", ", method.GetParameters().Select(p => $"{p.ParameterType.Name} {p.Name}"));
    Console.WriteLine($"  {method.ReturnType.Name} {method.Name}({parms})");
}

// ─── Dynamic property access (like Python getattr) ───
Console.WriteLine("\n=== Dynamic Access ===");
foreach (var name in new[] { "Ticker", "Side", "Quantity", "Price" })
{
    var prop = type.GetProperty(name);
    if (prop != null)
        Console.WriteLine($"  {name} = {prop.GetValue(order)}");
}

// ─── Constructor inspection ───
Console.WriteLine("\n=== Constructor Parameters ===");
foreach (var ctor in type.GetConstructors())
{
    foreach (var p in ctor.GetParameters())
        Console.WriteLine($"  {p.Name}: {p.ParameterType.Name}");
}

// ─── Create instance via reflection (like Python's cls(**kwargs)) ───
Console.WriteLine("\n=== Create via Reflection ===");
var newOrder = Activator.CreateInstance(type, "MC.PA", "SELL", 50, 890.20);
Console.WriteLine($"  Created: {newOrder}");

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

    === Type Inspection ===
      Type name:     TradeOrder
      Full name:     Submission#9+TradeOrder
      Is class:      True
      Is sealed:     False
    
    === Properties ===
      Ticker       String     = ASML.AS
      Side         String     = BUY
      Quantity     Int32      = 100
      Price        Double     = 685.4
      Notional     Double     = 68540
    
    === Methods (declared) ===
      String get_Ticker()
      String get_Side()
      Int32 get_Quantity()
      Double get_Price()
      Double get_Notional()
      String ToString()
    
    === Dynamic Access ===
      Ticker = ASML.AS
      Side = BUY
      Quantity = 100
      Price = 685.4
    
    === Constructor Parameters ===
      ticker: String
      side: String
      quantity: Int32
      price: Double
    
    === Create via Reflection ===
      Created: TradeOrder(MC.PA, SELL, 50, 890.2)
    

## 5. Project Structure & Best Practices


```C#
// Project Structure — how to organize a C# data pipeline / API project.
// Python equivalent: package → module hierarchy.

Console.WriteLine(@"
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
");

```

    
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
    
    

## 6. Summary


```C#
// Summary — C# Design Patterns cheat sheet
//
// DEPENDENCY INJECTION:
// interface IRepo { ... }              Define contract
// class SqlRepo : IRepo { ... }        Implement it
// class Service(IRepo repo)            Constructor injection
// builder.Services.AddScoped<IRepo, SqlRepo>()  DI registration
//
// SINGLETON:
// static readonly Lazy<T> _instance    Thread-safe singleton
// AddSingleton<T>()                    DI-managed singleton
//
// FACTORY:
// static IClient Create(string type)   Return right implementation
//   => type switch { "gcs" => new GCS(), ... }
//
// OBSERVER:
// event Action<T> EventName            C# event/delegate
// EventName += handler                 Subscribe
// EventName?.Invoke(data)              Publish
//
// STRATEGY:
// interface IStrategy { double Score(double[] p); }
// class Scorer(IStrategy s)            Inject algorithm
//
// VALIDATION:
// [Required], [Range], [StringLength]  DataAnnotations
// IValidatableObject.Validate()        Cross-field rules
// Validator.TryValidateObject()        Manual validation
//
// REFLECTION:
// obj.GetType()                        Get runtime type
// type.GetProperties()                 List properties
// type.GetMethods()                    List methods
// prop.GetValue(obj)                   Read property dynamically
// Activator.CreateInstance(type, args) Create instance dynamically
//
// PYTHON EQUIVALENTS:
// interface                → ABC + abstractmethod
// constructor injection   → __init__(self, dep)
// AddSingleton<T>()       → module-level instance
// event Action<T>         → callback list / event bus
// DataAnnotations         → Pydantic Field()
// System.Reflection       → type(), dir(), inspect
// GetType().Name          → type(obj).__name__

```
