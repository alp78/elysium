---
type: reference
category: programming-languages
technology: [csharp, dotnet]
tags: [csharp]
aliases: [generics, LINQ, type parameters, generic collections, comprehensions, functional programming]
keywords: [generics, LINQ, where, select, orderby, groupby, IEnumerable, IQueryable, type constraints, variance]
description: "C# generics and LINQ reference with executable examples and cell outputs — covers generic classes, constraints, LINQ query and method syntax, deferred execution, and functional patterns. See [[07_py_generics_linq]] for the Python equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[07_py_generics_linq]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 07. Generics & LINQ - C#

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
#r "nuget: Microsoft.Data.SqlClient"
#r "nuget: Dapper"
#r "nuget: Polars.NET"
#r "nuget: Polars.NET.Native.win-x64"

using Microsoft.Data.SqlClient;
using Dapper;
using Polars.CSharp;
using static Polars.CSharp.Polars;
using Microsoft.DotNet.Interactive.Formatting;
// Register Polars DataFrame/Series HTML formatters (transparent for dark theme)
Formatter.Register<DataFrame>((df, writer) =>
{
    var html = df.ToHtml();
    html = System.Text.RegularExpressions.Regex.Replace(html, @"(>|>)&quot;(.+?)&quot;(<|<)", @"$1$2$3");
    html = System.Text.RegularExpressions.Regex.Replace(html, @">""(.+?)""<", @">$1<");
    var css = @"<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>";
    writer.Write(css + html);
}, "text/html");
Formatter.Register<Polars.CSharp.Series>((s, writer) =>
{
    var sdf = DataFrame.FromSeries(s);
    var shtml = sdf.ToHtml();
    shtml = System.Text.RegularExpressions.Regex.Replace(shtml, @"(>|>)&quot;(.+?)&quot;(<|<)", @"$1$2$3");
    shtml = System.Text.RegularExpressions.Regex.Replace(shtml, @">""(.+?)""<", @">$1<");
    var scss = @"<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>";
    writer.Write(scss + shtml);
}, "text/html");
```

## Generics

#### Generic method

```csharp
// Generic method — one method works with any type T
//
// Technique: T First<T>(T[] items) declares a type parameter T that the
//   compiler infers from the argument. One method handles int[], string[],
//   double[] — no overloads needed. Type safety preserved at compile time.
//
// Benefits:
//   - Write once — works with any type without code duplication
//   - Type-safe — compiler checks T consistency (no casting)
//   - Inference — First(new[] { 1, 2, 3 }) infers T = int automatically
//
// Anti-patterns:
//   - Using object instead of generics — loses type safety, requires casting
//   - Overusing generics for single-type methods — adds complexity without value
//
// When to use:
//   - Utility methods that work identically across types (First, Max, Swap)
//
// When NOT to use:
//   - Type-specific logic — use overloads or type-specific methods

// Generic method — one method works with any type T
// compiler infers T from the argument
T First<T>(T[] items) => items[0];

Console.WriteLine($"int:    {First(new[] { 1, 2, 3 })}");
Console.WriteLine($"string: {First(new[] { "a", "b", "c" })}");
Console.WriteLine($"double: {First(new[] { 1.1, 2.2, 3.3 })}");

// Explicit type argument (sometimes needed when inference is ambiguous)
Console.WriteLine($"explicit: {First<string>(new[] { "x", "y" })}");
```

    int:    1
    string: a
    double: 1.1
    explicit: x

<h4>Generic constraints — <code style="font-size:0.75em">where T : ...</code></h4>

```csharp
// Generic constraints — where T : IComparable restricts valid types

T Max<T>(T a, T b) where T : IComparable<T>
    => a.CompareTo(b) >= 0 ? a : b;

Console.WriteLine($"Max(3, 7):              {Max(3, 7)}");
Console.WriteLine($"Max(\"apple\", \"banana\"): {Max("apple", "banana")}");
// Max(new object(), new object());  // Compile error! object doesn't implement IComparable

// Common constraints reference
Console.WriteLine("\nwhere T : struct          — T must be a value type (int, bool, struct)");
Console.WriteLine("where T : class           — T must be a reference type (string, class)");
Console.WriteLine("where T : new()           — T must have a parameterless constructor");
Console.WriteLine("where T : IComparable<T>  — T must implement an interface");
Console.WriteLine("where T : BaseClass       — T must inherit from a specific class");
Console.WriteLine("where T : notnull         — T can't be null");
```

    Max(3, 7):              7
    Max("apple", "banana"): banana
    
    where T : struct          — T must be a value type (int, bool, struct)
    where T : class           — T must be a reference type (string, class)
    where T : new()           — T must have a parameterless constructor
    where T : IComparable<T>  — T must implement an interface
    where T : BaseClass       — T must inherit from a specific class
    where T : notnull         — T can't be null

<h4>Generic class and multiple type parameters</h4>

```csharp
// Generic class and multiple type parameters — List<T>, Dictionary<K,V>

var ints = new List<int> { 1, 2, 3 };
var lookup = new Dictionary<string, int> { ["Alice"] = 85, ["Bob"] = 92 };
Console.WriteLine($"List<int>: [{string.Join(", ", ints)}]");
Console.WriteLine($"Dict:      {string.Join(", ", lookup.Select(kv => $"{kv.Key}: {kv.Value}"))}");

// Multiple type parameters — a generic method can take more than one type parameter
(TKey, TValue) MakePair<TKey, TValue>(TKey key, TValue value) => (key, value);

var pair1 = MakePair("name", 42);
var pair2 = MakePair(1, true);
Console.WriteLine($"pair1: {pair1}");
Console.WriteLine($"pair2: {pair2}");
```

    List<int>: [1, 2, 3]
    Dict:      Alice: 85, Bob: 92
    pair1: (name, 42)
    pair2: (1, True)

## Advanced LINQ

#### Sample data

```csharp
// Sample data — anonymous type array for LINQ demonstrations
//
// Technique: new[] { new { Name, Dept, Salary, Level } } creates an array
//   of anonymous types. The compiler infers the type from the properties.
//   Used as shared test data across all LINQ demo cells.
//
// Benefits:
//   - Anonymous types eliminate class definitions for demo data
//   - Compiler-generated Equals/GetHashCode enable LINQ operations
//   - Clean tabular data representation without boilerplate
//
// Anti-patterns:
//   - Anonymous types in public APIs — they're internal-only
//   - Redefining sample data in every cell — share via a single cell
//
// When to use:
//   - LINQ demos, prototyping, internal projections
//
// When NOT to use:
//   - Public method return types — use named types or records

// Sample data used throughout the LINQ section
var employees = new[]
{
    new { Name = "Alice", Dept = "Engineering", Salary = 95000, Level = "senior" },
    new { Name = "Bob", Dept = "Sales", Salary = 65000, Level = "junior" },
    new { Name = "Charlie", Dept = "Engineering", Salary = 110000, Level = "lead" },
    new { Name = "Diana", Dept = "Sales", Salary = 78000, Level = "senior" },
    new { Name = "Eve", Dept = "Engineering", Salary = 88000, Level = "junior" },
    new { Name = "Frank", Dept = "Marketing", Salary = 72000, Level = "senior" },
};

var departments = new[]
{
    new { Dept = "Engineering", Budget = 500000, Head = "CTO" },
    new { Dept = "Sales", Budget = 300000, Head = "VP Sales" },
    new { Dept = "Marketing", Budget = 200000, Head = "CMO" },
    new { Dept = "HR", Budget = 150000, Head = "CHRO" },       // no employees
};
```

<h4><code style="font-size:0.75em">GroupBy</code> and aggregations</h4>

```csharp
// GroupBy and aggregations — split-apply-combine pattern

var byDept = employees.GroupBy(e => e.Dept);

foreach (var group in byDept)
{
    var names = string.Join(", ", group.Select(e => e.Name));
    var avgSalary = group.Average(e => e.Salary);
    Console.WriteLine($"  {group.Key,-15} ({group.Count()} people): [{names}] avg=${avgSalary:N0}");
}

// Top earner per department
Console.WriteLine("\nMax salary per dept:");
foreach (var group in byDept)
{
    var top = group.MaxBy(e => e.Salary)!;
    Console.WriteLine($"  {group.Key,-15} top earner: {top.Name} ${top.Salary:N0}");
}

// Multiple aggregations per group
Console.WriteLine("\nMultiple aggregations:");
var deptStats = employees.GroupBy(e => e.Dept).Select(g => new
{
    Dept = g.Key,
    Count = g.Count(),
    AvgSalary = g.Average(e => e.Salary),
    MaxSalary = g.Max(e => e.Salary),
    MinSalary = g.Min(e => e.Salary),
    TotalSalary = g.Sum(e => e.Salary),
});
foreach (var s in deptStats)
    Console.WriteLine($"  {s.Dept,-15} count={s.Count} avg=${s.AvgSalary:N0} range=[${s.MinSalary:N0}-${s.MaxSalary:N0}] total=${s.TotalSalary:N0}");
```

      Engineering     (3 people): [Alice, Charlie, Eve] avg=$97'667
      Sales           (2 people): [Bob, Diana] avg=$71'500
      Marketing       (1 people): [Frank] avg=$72'000
    
    Max salary per dept:
      Engineering     top earner: Charlie $110'000
      Sales           top earner: Diana $78'000
      Marketing       top earner: Frank $72'000
    
    Multiple aggregations:
      Engineering     count=3 avg=$97'667 range=[$88'000-$110'000] total=$293'000
      Sales           count=2 avg=$71'500 range=[$65'000-$78'000] total=$143'000
      Marketing       count=1 avg=$72'000 range=[$72'000-$72'000] total=$72'000

<h4><code style="font-size:0.75em">Join</code> and <code style="font-size:0.75em">GroupJoin</code></h4>

```csharp
// Join and GroupJoin — combine collections by matching keys

var innerJoin = employees.Join(
    departments,
    e => e.Dept,                                // key from employees
    d => d.Dept,                                // key from departments
    (e, d) => new { e.Name, e.Dept, d.Head, d.Budget }
);
Console.WriteLine("Inner Join:");
foreach (var r in innerJoin.Take(3))
    Console.WriteLine($"  {r.Name,-10} {r.Dept,-15} head={r.Head,-10} budget=${r.Budget:N0}");

// GroupJoin — left join (all departments, employees may be empty)
Console.WriteLine("\nLeft Join (GroupJoin):");
var leftJoin = departments.GroupJoin(
    employees,
    d => d.Dept,
    e => e.Dept,
    (d, emps) => new { d.Dept, d.Head, Count = emps.Count() }
);
foreach (var r in leftJoin)
    Console.WriteLine($"  {r.Dept,-15} head={r.Head,-10} employees={r.Count}");
```

    Inner Join:
      Alice      Engineering     head=CTO        budget=$500'000
      Bob        Sales           head=VP Sales   budget=$300'000
      Charlie    Engineering     head=CTO        budget=$500'000
    
    Left Join (GroupJoin):
      Engineering     head=CTO        employees=3
      Sales           head=VP Sales   employees=2
      Marketing       head=CMO        employees=1
      HR              head=CHRO       employees=0

<h4>Chained pipeline, <code style="font-size:0.75em">Lookup</code>, and <code style="font-size:0.75em">Zip</code></h4>

```csharp
// Chained pipeline, Lookup, and Zip — advanced LINQ composition

var result = employees
    .Where(e => e.Salary > 75000)
    .Select(e => new { e.Name, e.Salary, Tax = e.Salary * 0.3 })
    .OrderByDescending(e => e.Salary)
    .Take(3);
Console.WriteLine("Top 3 earners (>75k) with tax:");
foreach (var r in result)
    Console.WriteLine($"  {r.Name,-10} salary=${r.Salary:N0}  tax=${r.Tax:N0}");

// Lookup — like Dictionary but allows multiple values per key
Console.WriteLine("\nLookup (multi-value dictionary):");
var empLookup = employees.ToLookup(e => e.Dept);
Console.WriteLine($"Engineering: [{string.Join(", ", empLookup["Engineering"].Select(e => e.Name))}]");
Console.WriteLine($"Unknown:     [{string.Join(", ", empLookup["Unknown"].Select(e => e.Name))}]");  // empty, no error

// Zip — pair elements from parallel sequences
Console.WriteLine("\nZip (parallel processing):");
var names = employees.Select(e => e.Name);
var salaries = employees.Select(e => e.Salary);
var raises = employees.Select(e => e.Salary * 0.1);

foreach (var (name, salary, raise_amt) in names.Zip(salaries, raises))
    Console.WriteLine($"  {name,-10} ${salary,8:N0} + ${raise_amt,7:N0} raise");
```

    Top 3 earners (>75k) with tax:
      Charlie    salary=$110'000  tax=$33'000
      Alice      salary=$95'000  tax=$28'500
      Eve        salary=$88'000  tax=$26'400
    
    Lookup (multi-value dictionary):
    Engineering: [Alice, Charlie, Eve]
    Unknown:     []
    
    Zip (parallel processing):
      Alice      $  95'000 + $  9'500 raise
      Bob        $  65'000 + $  6'500 raise
      Charlie    $ 110'000 + $ 11'000 raise
      Diana      $  78'000 + $  7'800 raise
      Eve        $  88'000 + $  8'800 raise
      Frank      $  72'000 + $  7'200 raise

<h4><code style="font-size:0.75em">SelectMany</code> — flatten nested collections</h4>

```csharp
// SelectMany — flatten nested collections into a single sequence

var people = new[]
{
    new { Name = "Alice", Skills = new[] { "C#", "LINQ", "SQL" } },
    new { Name = "Bob",   Skills = new[] { "Python", "SQL" } },
    new { Name = "Charlie", Skills = new[] { "C#", "Go" } },
};

// Select → nested (array per person)
Console.WriteLine("Select (nested):");
foreach (var arr in people.Select(p => p.Skills))
    Console.WriteLine($"  [{string.Join(", ", arr)}]");

// SelectMany → flat (one sequence)
var allSkills = people.SelectMany(p => p.Skills);
Console.WriteLine($"\nSelectMany (flat): [{string.Join(", ", allSkills)}]");

// With result selector — keeps access to the outer item
Console.WriteLine("\nSelectMany with result selector:");
var pairs = people.SelectMany(
    p => p.Skills,
    (p, skill) => $"{p.Name}: {skill}"
);
foreach (var pair in pairs)
    Console.WriteLine($"  {pair}");

// Flatten + distinct
Console.WriteLine($"\nDistinct skills: [{string.Join(", ", people.SelectMany(p => p.Skills).Distinct().OrderBy(s => s))}]");

// Flatten a List<List<int>>
var matrix = new List<List<int>>
{
    new List<int> { 1, 2, 3 },
    new List<int> { 4, 5 },
    new List<int> { 6, 7, 8, 9 },
};
Console.WriteLine($"Flat matrix: [{string.Join(", ", matrix.SelectMany(row => row))}]");
```

    Select (nested):
      [C#, LINQ, SQL]
      [Python, SQL]
      [C#, Go]
    
    SelectMany (flat): [C#, LINQ, SQL, Python, SQL, C#, Go]
    
    SelectMany with result selector:
      Alice: C#
      Alice: LINQ
      Alice: SQL
      Bob: Python
      Bob: SQL
      Charlie: C#
      Charlie: Go
    
    Distinct skills: [C#, Go, LINQ, Python, SQL]
    Flat matrix: [1, 2, 3, 4, 5, 6, 7, 8, 9]

## LINQ Analytics on Live SQL Server Data

Advanced analytics queries written in LINQ against the local `stoxx` database — the C# equivalent
of SQL window functions, running aggregates, and analytical patterns.

Tables used:
- `silver.eurostoxx50_ohlcv` — 66K rows of daily OHLCV data for 50 European stocks
- `gold.scores_daily` — composite scores with 36 metrics per stock
- `gold.index_performance` — daily index-level returns and rolling metrics
- `silver.index_dim` — company metadata (sector, country, exchange)
- `bronze.trading_calendar` — 29K trading day flags per exchange

#### Connect to SQL Server and load OHLCV data via Dapper

#### DTO records for SQL Server data mapping

```csharp
// DTO records — Dapper maps SQL columns to these by matching property names.
// Must be in their own cell because C# requires type declarations before top-level statements.

record Ohlcv(string Symbol, DateTime Date, double Open, double High, double Low,
             double Close, double AdjClose, long Volume);
record ScoreRow(string Symbol, string Sector, string Country, double CompositeScore,
               short CompositeRank, double MomentumScore, double CurrentPrice, double YtdChangePct);
```

```csharp
var connStr = "Server=localhost,1434;Database=stoxx;"
    + "User Id=sa;Password=EsgDev2026Pass1;"
    + "Encrypt=True;TrustServerCertificate=True;";


List<Ohlcv> ohlcv;
List<ScoreRow> scores;
using (var conn = new SqlConnection(connStr))
{
    conn.Open();
    ohlcv = conn.Query<Ohlcv>(
        "SELECT symbol AS Symbol, date AS Date, [open] AS [Open], high AS High, low AS Low, "
        + "[close] AS [Close], adj_close AS AdjClose, volume AS Volume "
        + "FROM silver.eurostoxx50_ohlcv").AsList();
    scores = conn.Query<ScoreRow>(
        "SELECT symbol AS Symbol, sector AS Sector, country AS Country, "
        + "composite_score AS CompositeScore, composite_rank AS CompositeRank, "
        + "momentum_score AS MomentumScore, current_price AS CurrentPrice, "
        + "ytd_change_pct AS YtdChangePct "
        + "FROM gold.scores_daily").AsList();
}
Console.WriteLine($"  OHLCV: {ohlcv.Count:N0} rows, {ohlcv.Select(r => r.Symbol).Distinct().Count()} symbols");
Console.WriteLine($"  Scores: {scores.Count:N0} rows");
Console.WriteLine($"  Date range: {ohlcv.Min(r => r.Date):yyyy-MM-dd} to {ohlcv.Max(r => r.Date):yyyy-MM-dd}");
```

      OHLCV: 66'355 rows, 50 symbols
      Scores: 466 rows
      Date range: 2021-01-04 to 2026-03-12

<h4>LINQ — <code style="font-size:0.75em">GroupBy</code> with Aggregates</h4>

Splits a collection into groups by key and applies multiple aggregate functions (Average, Sum, Min, Max, Count) to each group.

```csharp
// SQL: SELECT symbol, AVG(close), SUM(volume), MIN(low), MAX(high), COUNT(*)
//      FROM silver.eurostoxx50_ohlcv GROUP BY symbol ORDER BY AVG(close) DESC

var summary = ohlcv
    .GroupBy(r => r.Symbol)
    .Select(g => new
    {
        Symbol = g.Key,
        AvgClose = g.Average(r => r.Close),
        TotalVolume = g.Sum(r => r.Volume),
        MinLow = g.Min(r => r.Low),
        MaxHigh = g.Max(r => r.High),
        Days = g.Count(),
    })
    .OrderByDescending(s => s.AvgClose)
    .Take(10);

// Display as Polars DataFrame
var results = summary.ToList();
new DataFrame(
    Series.From("Symbol", results.Select(s => s.Symbol).ToArray()),
    Series.From("AvgClose", results.Select(s => Math.Round(s.AvgClose, 2)).ToArray()),
    Series.From("TotalVolume", results.Select(s => s.TotalVolume).ToArray()),
    Series.From("MinLow", results.Select(s => Math.Round(s.MinLow, 2)).ToArray()),
    Series.From("MaxHigh", results.Select(s => Math.Round(s.MaxHigh, 2)).ToArray()),
    Series.From("Days", results.Select(s => s.Days).ToArray()))
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(10 rows, 6 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>Symbol<span class='pl-dtype'>utf8view</span></th><th>AvgClose<span class='pl-dtype'>double</span></th><th>TotalVolume<span class='pl-dtype'>int64</span></th><th>MinLow<span class='pl-dtype'>double</span></th><th>MaxHigh<span class='pl-dtype'>double</span></th><th>Days<span class='pl-dtype'>int32</span></th></tr></thead><tbody><tr><td>RMS.PA</td><td>1761.56</td><td>81633862</td><td>839.4</td><td>2957</td><td>1331</td></tr><tr><td>ADYEN.AS</td><td>1545.98</td><td>110400463</td><td>602.8</td><td>2835</td><td>1331</td></tr><tr><td>ASML.AS</td><td>671.35</td><td>945070720</td><td>375.75</td><td>1312.8</td><td>1331</td></tr><tr><td>MC.PA</td><td>662.4</td><td>557855567</td><td>436.55</td><td>904.6</td><td>1331</td></tr><tr><td>RHM.DE</td><td>544.66</td><td>308359744</td><td>76.28</td><td>2008</td><td>1324</td></tr><tr><td>ARGX.BR</td><td>413.69</td><td>94592244</td><td>201.4</td><td>810</td><td>1331</td></tr><tr><td>OR.PA</td><td>377.54</td><td>484115375</td><td>290.1</td><td>461.85</td><td>1331</td></tr><tr><td>MUV2.DE</td><td>374.66</td><td>398802950</td><td>205.15</td><td>615.8</td><td>1324</td></tr><tr><td>RACE.MI</td><td>289.75</td><td>476686026</td><td>154.4</td><td>492.8</td><td>1321</td></tr><tr><td>ALV.DE</td><td>252.19</td><td>1101960308</td><td>156.22</td><td>396</td><td>1324</td></tr></tbody></table></div>

<h4>LINQ — Window Function <code style="font-size:0.75em">ROW_NUMBER()</code></h4>

Assigns a sequential rank to each row within a partition, ordered by a column. Equivalent to SQL ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...).

```csharp
// ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY volume DESC)

var topVolumeDay = ohlcv
    .GroupBy(r => r.Symbol)
    .SelectMany(g => g
        .OrderByDescending(r => r.Volume)
        .Select((r, idx) => new { r.Symbol, r.Date, r.Close, r.Volume, Rank = idx + 1 })
        .Where(r => r.Rank == 1))
    .OrderByDescending(r => r.Volume)
    .Take(10);

var results = topVolumeDay.ToList();
new DataFrame(
    Series.From("Symbol", results.Select(r => r.Symbol).ToArray()),
    Series.From("Date", results.Select(r => r.Date.ToString("yyyy-MM-dd")).ToArray()),
    Series.From("Close", results.Select(r => Math.Round(r.Close, 2)).ToArray()),
    Series.From("Volume", results.Select(r => r.Volume).ToArray()))
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(10 rows, 4 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>Symbol<span class='pl-dtype'>utf8view</span></th><th>Date<span class='pl-dtype'>utf8view</span></th><th>Close<span class='pl-dtype'>double</span></th><th>Volume<span class='pl-dtype'>int64</span></th></tr></thead><tbody><tr><td>ISP.MI</td><td>2023-08-08</td><td>2.34</td><td>376391539</td></tr><tr><td>SAN.MC</td><td>2021-10-20</td><td>3.36</td><td>367211467</td></tr><tr><td>BBVA.MC</td><td>2021-09-17</td><td>5.67</td><td>228528294</td></tr><tr><td>NDA-FI.HE</td><td>2022-09-16</td><td>9.14</td><td>140675854</td></tr><tr><td>PRX.AS</td><td>2021-08-17</td><td>32.43</td><td>114772834</td></tr><tr><td>ENEL.MI</td><td>2021-10-15</td><td>6.92</td><td>101413521</td></tr><tr><td>UCG.MI</td><td>2021-12-09</td><td>12.8</td><td>82881371</td></tr><tr><td>IBE.MC</td><td>2022-10-21</td><td>9.53</td><td>82592287</td></tr><tr><td>INGA.AS</td><td>2024-02-01</td><td>12.34</td><td>55872649</td></tr><tr><td>ENI.MI</td><td>2025-04-07</td><td>12.04</td><td>48554374</td></tr></tbody></table></div>

<h4>LINQ — Window Function <code style="font-size:0.75em">LAG()</code></h4>

Accesses the value from the previous row in a sorted sequence. Implemented via Zip with a shifted copy of the list.

```csharp
// LAG(close, 1) OVER (PARTITION BY symbol ORDER BY date)

var withReturns = ohlcv
    .GroupBy(r => r.Symbol)
    .SelectMany(g =>
    {
        var sorted = g.OrderBy(r => r.Date).ToList();
        return sorted.Skip(1).Zip(sorted, (curr, prev) => new
        {
            curr.Symbol, curr.Date, curr.Close,
            PrevClose = prev.Close,
            DailyReturn = (curr.Close - prev.Close) / prev.Close * 100,
        });
    });

var topGains = withReturns.OrderByDescending(r => r.DailyReturn).Take(10);

var results = topGains.ToList();
new DataFrame(
    Series.From("Symbol", results.Select(r => r.Symbol).ToArray()),
    Series.From("Date", results.Select(r => r.Date.ToString("yyyy-MM-dd")).ToArray()),
    Series.From("Close", results.Select(r => Math.Round(r.Close, 2)).ToArray()),
    Series.From("PrevClose", results.Select(r => Math.Round(r.PrevClose, 2)).ToArray()),
    Series.From("Return%", results.Select(r => Math.Round(r.DailyReturn, 2)).ToArray()))
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(10 rows, 5 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>Symbol<span class='pl-dtype'>utf8view</span></th><th>Date<span class='pl-dtype'>utf8view</span></th><th>Close<span class='pl-dtype'>double</span></th><th>PrevClose<span class='pl-dtype'>double</span></th><th>Return%<span class='pl-dtype'>double</span></th></tr></thead><tbody><tr><td>ADYEN.AS</td><td>2023-11-09</td><td>958.8</td><td>695.7</td><td>37.82</td></tr><tr><td>ARGX.BR</td><td>2023-07-17</td><td>437.6</td><td>334</td><td>31.02</td></tr><tr><td>RHM.DE</td><td>2022-02-28</td><td>133.6</td><td>107.05</td><td>24.8</td></tr><tr><td>PRX.AS</td><td>2022-03-16</td><td>24.1</td><td>19.45</td><td>23.88</td></tr><tr><td>ADS.DE</td><td>2022-11-04</td><td>114.04</td><td>93.95</td><td>21.38</td></tr><tr><td>ADYEN.AS</td><td>2024-02-08</td><td>1436.2</td><td>1183.6</td><td>21.34</td></tr><tr><td>ENR.DE</td><td>2024-11-13</td><td>46.33</td><td>38.95</td><td>18.95</td></tr><tr><td>RHM.DE</td><td>2022-03-01</td><td>156.6</td><td>133.6</td><td>17.22</td></tr><tr><td>VOW.DE</td><td>2021-03-17</td><td>308.8</td><td>266.6</td><td>15.83</td></tr><tr><td>PRX.AS</td><td>2022-06-27</td><td>28.17</td><td>24.35</td><td>15.72</td></tr></tbody></table></div>

<h4>LINQ — Window Function Cumulative <code style="font-size:0.75em">SUM()</code></h4>

Computes a running total where each row includes the sum of all preceding rows. Implemented via Aggregate with an accumulator.

```csharp
// Cumulative SUM(volume) OVER (PARTITION BY symbol ORDER BY date)

var cumVol = ohlcv
    .Where(r => r.Symbol == "ASML.AS")
    .OrderBy(r => r.Date)
    .Aggregate(
        new List<(DateTime Date, long Vol, long CumVol)>(),
        (acc, r) => { acc.Add((r.Date, r.Volume, (acc.Count > 0 ? acc[^1].CumVol : 0) + r.Volume)); return acc; });

new DataFrame(
    Series.From("Date", cumVol.TakeLast(10).Select(r => r.Date.ToString("yyyy-MM-dd")).ToArray()),
    Series.From("Volume", cumVol.TakeLast(10).Select(r => r.Vol).ToArray()),
    Series.From("CumVolume", cumVol.TakeLast(10).Select(r => r.CumVol).ToArray()))
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(10 rows, 3 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>Date<span class='pl-dtype'>utf8view</span></th><th>Volume<span class='pl-dtype'>int64</span></th><th>CumVolume<span class='pl-dtype'>int64</span></th></tr></thead><tbody><tr><td>2026-02-27</td><td>1010698</td><td>938726541</td></tr><tr><td>2026-03-02</td><td>871267</td><td>939597808</td></tr><tr><td>2026-03-03</td><td>941945</td><td>940539753</td></tr><tr><td>2026-03-04</td><td>714587</td><td>941254340</td></tr><tr><td>2026-03-05</td><td>778081</td><td>942032421</td></tr><tr><td>2026-03-06</td><td>857271</td><td>942889692</td></tr><tr><td>2026-03-09</td><td>689086</td><td>943578778</td></tr><tr><td>2026-03-10</td><td>800815</td><td>944379593</td></tr><tr><td>2026-03-11</td><td>562904</td><td>944942497</td></tr><tr><td>2026-03-12</td><td>128223</td><td>945070720</td></tr></tbody></table></div>

<h4>LINQ — Window Function <code style="font-size:0.75em">AVG()</code> Moving Average</h4>

Computes the average of a sliding window of N rows. Implemented via Skip/Take on a sorted list for each position.

```csharp
// 20-day SMA: AVG(close) OVER (ORDER BY date ROWS 19 PRECEDING)

var W = 20;
var asml = ohlcv.Where(r => r.Symbol == "ASML.AS").OrderBy(r => r.Date).ToList();

var sma = Enumerable.Range(W - 1, asml.Count - W + 1)
    .Select(i => new { asml[i].Date, asml[i].Close,
        SMA20 = asml.Skip(i - W + 1).Take(W).Average(r => r.Close) });

var results = sma.TakeLast(10).ToList();
new DataFrame(
    Series.From("Date", results.Select(r => r.Date.ToString("yyyy-MM-dd")).ToArray()),
    Series.From("Close", results.Select(r => Math.Round(r.Close, 2)).ToArray()),
    Series.From("SMA20", results.Select(r => Math.Round(r.SMA20, 2)).ToArray()))
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(10 rows, 3 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>Date<span class='pl-dtype'>utf8view</span></th><th>Close<span class='pl-dtype'>double</span></th><th>SMA20<span class='pl-dtype'>double</span></th></tr></thead><tbody><tr><td>2026-02-27</td><td>1233.4</td><td>1213.73</td></tr><tr><td>2026-03-02</td><td>1210.4</td><td>1213.01</td></tr><tr><td>2026-03-03</td><td>1161.8</td><td>1211.58</td></tr><tr><td>2026-03-04</td><td>1199.8</td><td>1214.54</td></tr><tr><td>2026-03-05</td><td>1186</td><td>1216.36</td></tr><tr><td>2026-03-06</td><td>1147</td><td>1214.02</td></tr><tr><td>2026-03-09</td><td>1147.6</td><td>1211.16</td></tr><tr><td>2026-03-10</td><td>1200</td><td>1211.51</td></tr><tr><td>2026-03-11</td><td>1198.8</td><td>1211.06</td></tr><tr><td>2026-03-12</td><td>1190.8</td><td>1211.61</td></tr></tbody></table></div>

<h4>LINQ — Window Function <code style="font-size:0.75em">NTILE()</code></h4>

Distributes rows into N equal-sized buckets based on a sort order. Implemented via index arithmetic after OrderBy.

```csharp
// NTILE(4) OVER (ORDER BY avg_close)

var symbolCount = ohlcv.Select(r => r.Symbol).Distinct().Count();
var quartiles = ohlcv
    .GroupBy(r => r.Symbol)
    .Select(g => new { Symbol = g.Key, AvgClose = g.Average(r => r.Close) })
    .OrderBy(s => s.AvgClose)
    .Select((s, idx) => new { s.Symbol, s.AvgClose, Quartile = idx * 4 / symbolCount + 1 })
    .OrderByDescending(s => s.AvgClose);

var results = quartiles.Take(10).ToList();
new DataFrame(
    Series.From("Symbol", results.Select(s => s.Symbol).ToArray()),
    Series.From("AvgClose", results.Select(s => Math.Round(s.AvgClose, 2)).ToArray()),
    Series.From("Quartile", results.Select(s => s.Quartile).ToArray()))
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(10 rows, 3 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>Symbol<span class='pl-dtype'>utf8view</span></th><th>AvgClose<span class='pl-dtype'>double</span></th><th>Quartile<span class='pl-dtype'>int32</span></th></tr></thead><tbody><tr><td>RMS.PA</td><td>1761.56</td><td>4</td></tr><tr><td>ADYEN.AS</td><td>1545.98</td><td>4</td></tr><tr><td>ASML.AS</td><td>671.35</td><td>4</td></tr><tr><td>MC.PA</td><td>662.4</td><td>4</td></tr><tr><td>RHM.DE</td><td>544.66</td><td>4</td></tr><tr><td>ARGX.BR</td><td>413.69</td><td>4</td></tr><tr><td>OR.PA</td><td>377.54</td><td>4</td></tr><tr><td>MUV2.DE</td><td>374.66</td><td>4</td></tr><tr><td>RACE.MI</td><td>289.75</td><td>4</td></tr><tr><td>ALV.DE</td><td>252.19</td><td>4</td></tr></tbody></table></div>

<h4>LINQ — <code style="font-size:0.75em">HAVING</code></h4>

Filters groups after aggregation. A Where clause applied after GroupBy + Select acts as the SQL HAVING clause.

```csharp
// HAVING AVG(volume) > 5_000_000

var highVol = ohlcv
    .GroupBy(r => r.Symbol)
    .Select(g => new { Symbol = g.Key, AvgVol = g.Average(r => (double)r.Volume) })
    .Where(s => s.AvgVol > 5_000_000)
    .OrderByDescending(s => s.AvgVol);

var results = highVol.ToList();
new DataFrame(
    Series.From("Symbol", results.Select(s => s.Symbol).ToArray()),
    Series.From("AvgVolume", results.Select(s => (long)s.AvgVol).ToArray()))
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(11 rows, 2 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>Symbol<span class='pl-dtype'>utf8view</span></th><th>AvgVolume<span class='pl-dtype'>int64</span></th></tr></thead><tbody><tr><td>ISP.MI</td><td>87588601</td></tr><tr><td>SAN.MC</td><td>41770987</td></tr><tr><td>ENEL.MI</td><td>24678699</td></tr><tr><td>BBVA.MC</td><td>16654456</td></tr><tr><td>UCG.MI</td><td>13903710</td></tr><tr><td>ENI.MI</td><td>12976208</td></tr><tr><td>INGA.AS</td><td>12803589</td></tr><tr><td>IBE.MC</td><td>12034835</td></tr><tr><td>DTE.DE</td><td>7575084</td></tr><tr><td>NDA-FI.HE</td><td>5375454</td></tr><tr><td colspan='2' style='text-align:center; font-style:italic; color:#999; padding: 10px'>... 1 more rows ...</td></tr></tbody></table></div>

<h4>LINQ — <code style="font-size:0.75em">STDEV()</code></h4>

Standard deviation of daily returns, annualized by multiplying by sqrt(252). No built-in LINQ StdDev — computed manually.

```csharp
// Annualized volatility = STDEV(daily_return) * SQRT(252)

double StdDev(IEnumerable<double> v)
{
    var l = v.ToList(); var a = l.Average();
    return Math.Sqrt(l.Sum(x => (x - a) * (x - a)) / (l.Count - 1));
}

var vol = ohlcv.GroupBy(r => r.Symbol).Select(g =>
{
    var s = g.OrderBy(r => r.Date).ToList();
    var ret = s.Skip(1).Zip(s, (c, p) => (c.Close - p.Close) / p.Close).ToList();
    return new { Symbol = g.Key, AnnVol = StdDev(ret) * Math.Sqrt(252) * 100 };
}).OrderByDescending(s => s.AnnVol).Take(10);

var results = vol.ToList();
new DataFrame(
    Series.From("Symbol", results.Select(s => s.Symbol).ToArray()),
    Series.From("AnnualVol%", results.Select(s => Math.Round(s.AnnVol, 2)).ToArray()))
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(10 rows, 2 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>Symbol<span class='pl-dtype'>utf8view</span></th><th>AnnualVol%<span class='pl-dtype'>double</span></th></tr></thead><tbody><tr><td>ADYEN.AS</td><td>50.3</td></tr><tr><td>ENR.DE</td><td>50.05</td></tr><tr><td>RHM.DE</td><td>40.85</td></tr><tr><td>PRX.AS</td><td>39.72</td></tr><tr><td>ARGX.BR</td><td>39.31</td></tr><tr><td>ASML.AS</td><td>37.62</td></tr><tr><td>IFX.DE</td><td>37.25</td></tr><tr><td>UCG.MI</td><td>35.55</td></tr><tr><td>VOW.DE</td><td>35.51</td></tr><tr><td>ADS.DE</td><td>34.37</td></tr></tbody></table></div>

<h4>LINQ — <code style="font-size:0.75em">JOIN</code></h4>

Combines two collections on a matching key. Each OHLCV aggregate row is paired with its corresponding score row by symbol.

```csharp
// JOIN ohlcv summary with scores

var joined = ohlcv
    .GroupBy(r => r.Symbol)
    .Select(g => new { Symbol = g.Key, AvgClose = g.Average(r => r.Close), AvgVol = g.Average(r => (double)r.Volume) })
    .Join(scores, o => o.Symbol, s => s.Symbol,
        (o, s) => new { o.Symbol, s.Sector, o.AvgClose, o.AvgVol, s.CompositeScore, s.CompositeRank, s.YtdChangePct })
    .OrderBy(r => r.CompositeRank)
    .Take(10);

var results = joined.ToList();
new DataFrame(
    Series.From("Symbol", results.Select(r => r.Symbol).ToArray()),
    Series.From("Sector", results.Select(r => r.Sector).ToArray()),
    Series.From("Rank", results.Select(r => (int)r.CompositeRank).ToArray()),
    Series.From("Score", results.Select(r => Math.Round(r.CompositeScore, 2)).ToArray()),
    Series.From("YTD%", results.Select(r => Math.Round(r.YtdChangePct, 1)).ToArray()),
    Series.From("AvgVol", results.Select(r => (long)r.AvgVol).ToArray()))
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(10 rows, 6 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>Symbol<span class='pl-dtype'>utf8view</span></th><th>Sector<span class='pl-dtype'>utf8view</span></th><th>Rank<span class='pl-dtype'>int32</span></th><th>Score<span class='pl-dtype'>double</span></th><th>YTD%<span class='pl-dtype'>double</span></th><th>AvgVol<span class='pl-dtype'>int64</span></th></tr></thead><tbody><tr><td>BNP.PA</td><td>Financial Services</td><td>1</td><td>0.68</td><td>0.1</td><td>3096879</td></tr><tr><td>BNP.PA</td><td>Financial Services</td><td>1</td><td>0.66</td><td>0.1</td><td>3096879</td></tr><tr><td>BNP.PA</td><td>Financial Services</td><td>1</td><td>0.68</td><td>0.1</td><td>3096879</td></tr><tr><td>DTE.DE</td><td>Communication Services</td><td>2</td><td>0.52</td><td>0.2</td><td>7575084</td></tr><tr><td>DTE.DE</td><td>Communication Services</td><td>2</td><td>0.52</td><td>0.2</td><td>7575084</td></tr><tr><td>VOW.DE</td><td>Consumer Cyclical</td><td>2</td><td>0.58</td><td>-0.1</td><td>62021</td></tr><tr><td>DTE.DE</td><td>Communication Services</td><td>3</td><td>0.49</td><td>0.2</td><td>7575084</td></tr><tr><td>IFX.DE</td><td>Technology</td><td>3</td><td>0.51</td><td>0.2</td><td>4186778</td></tr><tr><td>VOW.DE</td><td>Consumer Cyclical</td><td>3</td><td>0.46</td><td>-0.1</td><td>62021</td></tr><tr><td>TTE.PA</td><td>Energy</td><td>4</td><td>0.39</td><td>0.3</td><td>5138099</td></tr></tbody></table></div>

<h4>LINQ — Window Function <code style="font-size:0.75em">LEAD()</code></h4>

Accesses the value from the next row in a sorted sequence. Implemented via Zip with a Skip(1) shifted copy. Used here to detect date gaps.

```csharp
// LEAD(date, 1) OVER (PARTITION BY symbol ORDER BY date)

var gaps = ohlcv
    .Where(r => r.Symbol == "ASML.AS")
    .OrderBy(r => r.Date)
    .Zip(ohlcv.Where(r => r.Symbol == "ASML.AS").OrderBy(r => r.Date).Skip(1),
        (curr, next) => new { FromDate = curr.Date, ToDate = next.Date, GapDays = (next.Date - curr.Date).Days })
    .Where(g => g.GapDays > 3)
    .OrderByDescending(g => g.GapDays)
    .Take(10);

var results = gaps.ToList();
new DataFrame(
    Series.From("From", results.Select(g => g.FromDate.ToString("yyyy-MM-dd")).ToArray()),
    Series.From("To", results.Select(g => g.ToDate.ToString("yyyy-MM-dd")).ToArray()),
    Series.From("GapDays", results.Select(g => g.GapDays).ToArray()))
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(10 rows, 3 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>From<span class='pl-dtype'>utf8view</span></th><th>To<span class='pl-dtype'>utf8view</span></th><th>GapDays<span class='pl-dtype'>int32</span></th></tr></thead><tbody><tr><td>2021-04-01</td><td>2021-04-06</td><td>5</td></tr><tr><td>2022-04-14</td><td>2022-04-19</td><td>5</td></tr><tr><td>2023-04-06</td><td>2023-04-11</td><td>5</td></tr><tr><td>2023-12-22</td><td>2023-12-27</td><td>5</td></tr><tr><td>2024-03-28</td><td>2024-04-02</td><td>5</td></tr><tr><td>2025-04-17</td><td>2025-04-22</td><td>5</td></tr><tr><td>2025-12-24</td><td>2025-12-29</td><td>5</td></tr><tr><td>2022-12-23</td><td>2022-12-27</td><td>4</td></tr><tr><td>2023-04-28</td><td>2023-05-02</td><td>4</td></tr><tr><td>2023-12-29</td><td>2024-01-02</td><td>4</td></tr></tbody></table></div>

<h4>LINQ — Nested <code style="font-size:0.75em">GroupBy</code></h4>

Groups by a key and computes nested aggregates including the best element per group via OrderBy + First().

```csharp
// Sector summary from scores: avg score, best stock, count

var sectorSummary = scores
    .GroupBy(s => s.Sector)
    .Select(g => new
    {
        Sector = g.Key,
        AvgScore = g.Average(s => s.CompositeScore),
        BestStock = g.OrderBy(s => s.CompositeRank).First().Symbol,
        BestRank = g.Min(s => s.CompositeRank),
        Count = g.Count(),
    })
    .OrderByDescending(s => s.AvgScore);

var results = sectorSummary.ToList();
new DataFrame(
    Series.From("Sector", results.Select(s => s.Sector).ToArray()),
    Series.From("AvgScore", results.Select(s => Math.Round(s.AvgScore, 2)).ToArray()),
    Series.From("BestStock", results.Select(s => s.BestStock).ToArray()),
    Series.From("BestRank", results.Select(s => (int)s.BestRank).ToArray()),
    Series.From("Count", results.Select(s => s.Count).ToArray()))
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(10 rows, 5 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>Sector<span class='pl-dtype'>utf8view</span></th><th>AvgScore<span class='pl-dtype'>double</span></th><th>BestStock<span class='pl-dtype'>utf8view</span></th><th>BestRank<span class='pl-dtype'>int32</span></th><th>Count<span class='pl-dtype'>int32</span></th></tr></thead><tbody><tr><td>Technology</td><td>0.15</td><td>MU</td><td>1</td><td>75</td></tr><tr><td>Energy</td><td>0.11</td><td>DVN</td><td>1</td><td>34</td></tr><tr><td>Industrials</td><td>0.09</td><td>8001.T</td><td>1</td><td>66</td></tr><tr><td>Communication Services</td><td>0.05</td><td>DTE.DE</td><td>2</td><td>36</td></tr><tr><td>Basic Materials</td><td>0.04</td><td>4063.T</td><td>7</td><td>18</td></tr><tr><td>Healthcare</td><td>0.02</td><td>2269.HK</td><td>5</td><td>45</td></tr><tr><td>Consumer Defensive</td><td>-0.08</td><td>ABI.BR</td><td>4</td><td>36</td></tr><tr><td>Financial Services</td><td>-0.09</td><td>BNP.PA</td><td>1</td><td>96</td></tr><tr><td>Utilities</td><td>-0.1</td><td>ENEL.MI</td><td>25</td><td>6</td></tr><tr><td>Consumer Cyclical</td><td>-0.14</td><td>VOW.DE</td><td>2</td><td>54</td></tr></tbody></table></div>

## LINQ vs Polars.NET — Side-by-Side

Every operation shown first in LINQ (C# collections), then in Polars.NET (Rust DataFrame engine).
Both operate on the same OHLCV data loaded from SQL Server.

#### Load data into Polars DataFrame

```csharp
// Load the same OHLCV data as a Polars DataFrame from Parquet
var df = DataFrame.ReadParquet(@"C:\Users\aperi\DEV\LANG\data\eurostoxx50_ohlcv.parquet");
Console.WriteLine($"  Polars: {df.Height} rows x {df.Width} columns");
df.Head(3)
```

      Polars: 66355 rows x 12 columns

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(3 rows, 12 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>id<span class='pl-dtype'>int64</span></th><th>symbol<span class='pl-dtype'>utf8view</span></th><th>date<span class='pl-dtype'>date32</span></th><th>open<span class='pl-dtype'>double</span></th><th>high<span class='pl-dtype'>double</span></th><th>low<span class='pl-dtype'>double</span></th><th>close<span class='pl-dtype'>double</span></th><th>adj_close<span class='pl-dtype'>double</span></th><th>volume<span class='pl-dtype'>int64</span></th><th>dividends<span class='pl-dtype'>double</span></th><th>stock_splits<span class='pl-dtype'>double</span></th><th>is_filled<span class='pl-dtype'>bool</span></th></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

### Basic Operations

<h4>LINQ — Select columns</h4>

```csharp
// LINQ: select specific properties
var linqSelect = ohlcv.Select(r => new { r.Symbol, r.Date, r.Close }).Take(5).ToList();
new DataFrame(
    Series.From("Symbol", linqSelect.Select(r => r.Symbol).ToArray()),
    Series.From("Date", linqSelect.Select(r => r.Date.ToString("yyyy-MM-dd")).ToArray()),
    Series.From("Close", linqSelect.Select(r => r.Close).ToArray()))
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 3 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>Symbol<span class='pl-dtype'>utf8view</span></th><th>Date<span class='pl-dtype'>utf8view</span></th><th>Close<span class='pl-dtype'>double</span></th></tr></thead><tbody><tr><td>ASML.AS</td><td>2021-01-04</td><td>406.25</td></tr><tr><td>ASML.AS</td><td>2021-01-05</td><td>406.9</td></tr><tr><td>ASML.AS</td><td>2021-01-06</td><td>402.85</td></tr><tr><td>ASML.AS</td><td>2021-01-07</td><td>403.9</td></tr><tr><td>ASML.AS</td><td>2021-01-08</td><td>416.05</td></tr></tbody></table></div>

<h4>Polars DataFrame — Select columns</h4>

```csharp
// Polars: select columns by name
df.Select("symbol", "date", "close").Head(5)
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 3 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>symbol<span class='pl-dtype'>utf8view</span></th><th>date<span class='pl-dtype'>date32</span></th><th>close<span class='pl-dtype'>double</span></th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>57.18</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>58.77</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>58.4</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>57.86</td></tr></tbody></table></div>

<h4>LINQ — Filter rows</h4>

```csharp
// LINQ: Where clause
var linqFilter = ohlcv.Where(r => r.Symbol == "ASML.AS" && r.Close > 600).Take(5).ToList();
new DataFrame(
    Series.From("Symbol", linqFilter.Select(r => r.Symbol).ToArray()),
    Series.From("Date", linqFilter.Select(r => r.Date.ToString("yyyy-MM-dd")).ToArray()),
    Series.From("Close", linqFilter.Select(r => r.Close).ToArray()))
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 3 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>Symbol<span class='pl-dtype'>utf8view</span></th><th>Date<span class='pl-dtype'>utf8view</span></th><th>Close<span class='pl-dtype'>double</span></th></tr></thead><tbody><tr><td>ASML.AS</td><td>2021-07-14</td><td>609.1</td></tr><tr><td>ASML.AS</td><td>2021-07-22</td><td>620.8</td></tr><tr><td>ASML.AS</td><td>2021-07-23</td><td>638.8</td></tr><tr><td>ASML.AS</td><td>2021-07-26</td><td>638</td></tr><tr><td>ASML.AS</td><td>2021-07-27</td><td>623</td></tr></tbody></table></div>

<h4>Polars DataFrame — Filter rows</h4>

```csharp
// Polars: Filter expression
df.Filter((Col("symbol") == Lit("ASML.AS")) & (Col("close") > Lit(600.0)))
  .Select("symbol", "date", "close").Head(5)
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 12 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>id<span class='pl-dtype'>int64</span></th><th>symbol<span class='pl-dtype'>utf8view</span></th><th>date<span class='pl-dtype'>date32</span></th><th>open<span class='pl-dtype'>double</span></th><th>high<span class='pl-dtype'>double</span></th><th>low<span class='pl-dtype'>double</span></th><th>close<span class='pl-dtype'>double</span></th><th>adj_close<span class='pl-dtype'>double</span></th><th>volume<span class='pl-dtype'>int64</span></th><th>dividends<span class='pl-dtype'>double</span></th><th>stock_splits<span class='pl-dtype'>double</span></th><th>is_filled<span class='pl-dtype'>bool</span></th></tr></thead><tbody><tr><td>136</td><td>ASML.AS</td><td>2021-07-14</td><td>599.5</td><td>611.8</td><td>597.2</td><td>609.1</td><td>582.9708</td><td>641585</td><td>0</td><td>0</td><td>false</td></tr><tr><td>142</td><td>ASML.AS</td><td>2021-07-22</td><td>610</td><td>625.9</td><td>608.2</td><td>620.8</td><td>594.169</td><td>788099</td><td>0</td><td>0</td><td>false</td></tr><tr><td>143</td><td>ASML.AS</td><td>2021-07-23</td><td>622.9</td><td>639</td><td>617.5</td><td>638.8</td><td>611.3967</td><td>833737</td><td>0</td><td>0</td><td>false</td></tr><tr><td>144</td><td>ASML.AS</td><td>2021-07-26</td><td>635.2</td><td>647</td><td>631.5</td><td>638</td><td>610.631</td><td>640691</td><td>0</td><td>0</td><td>false</td></tr><tr><td>145</td><td>ASML.AS</td><td>2021-07-27</td><td>634.2</td><td>641.1</td><td>622.3</td><td>623</td><td>596.2745</td><td>705560</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

<h4>LINQ — Sort</h4>

```csharp
// LINQ: OrderByDescending
var linqSort = ohlcv.OrderByDescending(r => r.Volume).Take(5).ToList();
new DataFrame(
    Series.From("Symbol", linqSort.Select(r => r.Symbol).ToArray()),
    Series.From("Date", linqSort.Select(r => r.Date.ToString("yyyy-MM-dd")).ToArray()),
    Series.From("Volume", linqSort.Select(r => r.Volume).ToArray()))
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 3 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>Symbol<span class='pl-dtype'>utf8view</span></th><th>Date<span class='pl-dtype'>utf8view</span></th><th>Volume<span class='pl-dtype'>int64</span></th></tr></thead><tbody><tr><td>ISP.MI</td><td>2023-08-08</td><td>376391539</td></tr><tr><td>SAN.MC</td><td>2021-10-20</td><td>367211467</td></tr><tr><td>ISP.MI</td><td>2023-05-31</td><td>317362978</td></tr><tr><td>ISP.MI</td><td>2023-03-13</td><td>311886033</td></tr><tr><td>SAN.MC</td><td>2021-11-03</td><td>306973344</td></tr></tbody></table></div>

<h4>Polars DataFrame — Sort</h4>

```csharp
// Polars: Sort descending
df.Sort("volume", descending: true).Head(5)
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 12 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>id<span class='pl-dtype'>int64</span></th><th>symbol<span class='pl-dtype'>utf8view</span></th><th>date<span class='pl-dtype'>date32</span></th><th>open<span class='pl-dtype'>double</span></th><th>high<span class='pl-dtype'>double</span></th><th>low<span class='pl-dtype'>double</span></th><th>close<span class='pl-dtype'>double</span></th><th>adj_close<span class='pl-dtype'>double</span></th><th>volume<span class='pl-dtype'>int64</span></th><th>dividends<span class='pl-dtype'>double</span></th><th>stock_splits<span class='pl-dtype'>double</span></th><th>is_filled<span class='pl-dtype'>bool</span></th></tr></thead><tbody><tr><td>31078</td><td>ISP.MI</td><td>2023-08-08</td><td>2.4</td><td>2.4165</td><td>2.3285</td><td>2.338</td><td>1.8961</td><td>376391539</td><td>0</td><td>0</td><td>false</td></tr><tr><td>10783</td><td>SAN.MC</td><td>2021-10-20</td><td>3.36</td><td>3.376</td><td>3.322</td><td>3.36</td><td>2.8379</td><td>367211467</td><td>0</td><td>0</td><td>false</td></tr><tr><td>31029</td><td>ISP.MI</td><td>2023-05-31</td><td>2.1925</td><td>2.2255</td><td>2.133</td><td>2.1555</td><td>1.7481</td><td>317362978</td><td>0</td><td>0</td><td>false</td></tr><tr><td>30975</td><td>ISP.MI</td><td>2023-03-13</td><td>2.4705</td><td>2.478</td><td>2.279</td><td>2.3305</td><td>1.8196</td><td>311886033</td><td>0</td><td>0</td><td>false</td></tr><tr><td>10793</td><td>SAN.MC</td><td>2021-11-03</td><td>3.275</td><td>3.31</td><td>3.236</td><td>3.31</td><td>2.8377</td><td>306973344</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

<h4>LINQ — Add computed column</h4>

```csharp
// LINQ: Select with new property
var linqComputed = ohlcv.Take(5).Select(r => new { r.Symbol, r.Date, r.Close, Range = r.High - r.Low }).ToList();
new DataFrame(
    Series.From("Symbol", linqComputed.Select(r => r.Symbol).ToArray()),
    Series.From("Close", linqComputed.Select(r => r.Close).ToArray()),
    Series.From("Range", linqComputed.Select(r => Math.Round(r.Range, 2)).ToArray()))
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 3 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>Symbol<span class='pl-dtype'>utf8view</span></th><th>Close<span class='pl-dtype'>double</span></th><th>Range<span class='pl-dtype'>double</span></th></tr></thead><tbody><tr><td>ASML.AS</td><td>406.25</td><td>8.75</td></tr><tr><td>ASML.AS</td><td>406.9</td><td>10.9</td></tr><tr><td>ASML.AS</td><td>402.85</td><td>8</td></tr><tr><td>ASML.AS</td><td>403.9</td><td>7.45</td></tr><tr><td>ASML.AS</td><td>416.05</td><td>5.7</td></tr></tbody></table></div>

<h4>Polars DataFrame — Add computed column</h4>

```csharp
// Polars: WithColumn expression
df.WithColumns((Col("high") - Col("low")).Alias("range")).Select("symbol", "close", "range").Head(5)
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 3 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>symbol<span class='pl-dtype'>utf8view</span></th><th>close<span class='pl-dtype'>double</span></th><th>range<span class='pl-dtype'>double</span></th></tr></thead><tbody><tr><td>ABI.BR</td><td>57.21</td><td>2.07</td></tr><tr><td>ABI.BR</td><td>57.18</td><td>1.23</td></tr><tr><td>ABI.BR</td><td>58.77</td><td>1.55</td></tr><tr><td>ABI.BR</td><td>58.4</td><td>0.98</td></tr><tr><td>ABI.BR</td><td>57.86</td><td>0.97</td></tr></tbody></table></div>

### Aggregations

<h4>LINQ — GroupBy with aggregates</h4>

```csharp
// LINQ: GroupBy + multiple aggregates
var linqAgg = ohlcv.GroupBy(r => r.Symbol)
    .Select(g => new { Symbol = g.Key, AvgClose = Math.Round(g.Average(r => r.Close), 2), Count = g.Count() })
    .OrderByDescending(s => s.AvgClose).Take(5).ToList();
new DataFrame(
    Series.From("Symbol", linqAgg.Select(s => s.Symbol).ToArray()),
    Series.From("AvgClose", linqAgg.Select(s => s.AvgClose).ToArray()),
    Series.From("Count", linqAgg.Select(s => s.Count).ToArray()))
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 3 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>Symbol<span class='pl-dtype'>utf8view</span></th><th>AvgClose<span class='pl-dtype'>double</span></th><th>Count<span class='pl-dtype'>int32</span></th></tr></thead><tbody><tr><td>RMS.PA</td><td>1761.56</td><td>1331</td></tr><tr><td>ADYEN.AS</td><td>1545.98</td><td>1331</td></tr><tr><td>ASML.AS</td><td>671.35</td><td>1331</td></tr><tr><td>MC.PA</td><td>662.4</td><td>1331</td></tr><tr><td>RHM.DE</td><td>544.66</td><td>1324</td></tr></tbody></table></div>

<h4>Polars DataFrame — GroupBy with aggregates</h4>

```csharp
// Polars: GroupBy + Agg
df.GroupBy("symbol").Agg(
    Col("close").Mean().Alias("avg_close"),
    Col("close").Count().Alias("count")
).Sort("avg_close", descending: true).Head(5)
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 3 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>symbol<span class='pl-dtype'>utf8view</span></th><th>avg_close<span class='pl-dtype'>double</span></th><th>count<span class='pl-dtype'>uint32</span></th></tr></thead><tbody><tr><td>RMS.PA</td><td>1761.555748</td><td>1331</td></tr><tr><td>ADYEN.AS</td><td>1545.976409</td><td>1331</td></tr><tr><td>ASML.AS</td><td>671.3489106</td><td>1331</td></tr><tr><td>MC.PA</td><td>662.4045079</td><td>1331</td></tr><tr><td>RHM.DE</td><td>544.6615332</td><td>1324</td></tr></tbody></table></div>

<h4>LINQ — HAVING</h4>

```csharp
// LINQ: Where after GroupBy+Select = HAVING
var linqHaving = ohlcv.GroupBy(r => r.Symbol)
    .Select(g => new { Symbol = g.Key, AvgVol = g.Average(r => (double)r.Volume) })
    .Where(s => s.AvgVol > 5_000_000)
    .OrderByDescending(s => s.AvgVol).ToList();
new DataFrame(
    Series.From("Symbol", linqHaving.Select(s => s.Symbol).ToArray()),
    Series.From("AvgVol", linqHaving.Select(s => (long)s.AvgVol).ToArray()))
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(11 rows, 2 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>Symbol<span class='pl-dtype'>utf8view</span></th><th>AvgVol<span class='pl-dtype'>int64</span></th></tr></thead><tbody><tr><td>ISP.MI</td><td>87588601</td></tr><tr><td>SAN.MC</td><td>41770987</td></tr><tr><td>ENEL.MI</td><td>24678699</td></tr><tr><td>BBVA.MC</td><td>16654456</td></tr><tr><td>UCG.MI</td><td>13903710</td></tr><tr><td>ENI.MI</td><td>12976208</td></tr><tr><td>INGA.AS</td><td>12803589</td></tr><tr><td>IBE.MC</td><td>12034835</td></tr><tr><td>DTE.DE</td><td>7575084</td></tr><tr><td>NDA-FI.HE</td><td>5375454</td></tr><tr><td colspan='2' style='text-align:center; font-style:italic; color:#999; padding: 10px'>... 1 more rows ...</td></tr></tbody></table></div>

<h4>Polars DataFrame — HAVING</h4>

```csharp
// Polars: GroupBy + Agg + Filter
df.GroupBy("symbol").Agg(
    Col("volume").Mean().Alias("avg_vol")
).Filter(Col("avg_vol") > Lit(5_000_000.0)).Sort("avg_vol", descending: true)
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(11 rows, 2 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>symbol<span class='pl-dtype'>utf8view</span></th><th>avg_vol<span class='pl-dtype'>double</span></th></tr></thead><tbody><tr><td>ISP.MI</td><td>87588601.04</td></tr><tr><td>SAN.MC</td><td>41770987.15</td></tr><tr><td>ENEL.MI</td><td>24678699.42</td></tr><tr><td>BBVA.MC</td><td>16654456.88</td></tr><tr><td>UCG.MI</td><td>13903710.14</td></tr><tr><td>ENI.MI</td><td>12976208.15</td></tr><tr><td>INGA.AS</td><td>12803589.45</td></tr><tr><td>IBE.MC</td><td>12034835.18</td></tr><tr><td>DTE.DE</td><td>7575084.131</td></tr><tr><td>NDA-FI.HE</td><td>5375454.051</td></tr><tr><td colspan='2' style='text-align:center; font-style:italic; color:#999; padding: 10px'>... 1 more rows ...</td></tr></tbody></table></div>

### Window Functions

<h4>LINQ — LAG</h4>

```csharp
// LINQ: Zip with shifted list
var asmlLinq = ohlcv.Where(r => r.Symbol == "ASML.AS").OrderBy(r => r.Date).ToList();
var linqLag = asmlLinq.Skip(1).Zip(asmlLinq, (curr, prev) => new
    { curr.Date, curr.Close, PrevClose = prev.Close,
      Return = Math.Round((curr.Close - prev.Close) / prev.Close * 100, 2) })
    .TakeLast(5).ToList();
new DataFrame(
    Series.From("Date", linqLag.Select(r => r.Date.ToString("yyyy-MM-dd")).ToArray()),
    Series.From("Close", linqLag.Select(r => r.Close).ToArray()),
    Series.From("PrevClose", linqLag.Select(r => r.PrevClose).ToArray()),
    Series.From("Return%", linqLag.Select(r => r.Return).ToArray()))
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 4 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>Date<span class='pl-dtype'>utf8view</span></th><th>Close<span class='pl-dtype'>double</span></th><th>PrevClose<span class='pl-dtype'>double</span></th><th>Return%<span class='pl-dtype'>double</span></th></tr></thead><tbody><tr><td>2026-03-06</td><td>1147</td><td>1186</td><td>-3.29</td></tr><tr><td>2026-03-09</td><td>1147.6</td><td>1147</td><td>0.05</td></tr><tr><td>2026-03-10</td><td>1200</td><td>1147.6</td><td>4.57</td></tr><tr><td>2026-03-11</td><td>1198.8</td><td>1200</td><td>-0.1</td></tr><tr><td>2026-03-12</td><td>1190.8</td><td>1198.8</td><td>-0.67</td></tr></tbody></table></div>

<h4>Polars DataFrame — LAG</h4>

```csharp
// Polars: Shift(1) over partition
df.Filter(Col("symbol") == Lit("ASML.AS"))
  .Sort("date")
  .WithColumns(Col("close").Shift(1).Over("symbol").Alias("prev_close"))
  .WithColumns(((Col("close") - Col("prev_close")) / Col("prev_close") * Lit(100.0)).Alias("return_pct"))
  .Select("date", "close", "prev_close", "return_pct")
  .Tail(5)
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 4 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>date<span class='pl-dtype'>date32</span></th><th>close<span class='pl-dtype'>double</span></th><th>prev_close<span class='pl-dtype'>double</span></th><th>return_pct<span class='pl-dtype'>double</span></th></tr></thead><tbody><tr><td>2026-03-06</td><td>1147</td><td>1186</td><td>-3.28836425</td></tr><tr><td>2026-03-09</td><td>1147.6</td><td>1147</td><td>0.05231037489</td></tr><tr><td>2026-03-10</td><td>1200</td><td>1147.6</td><td>4.566050889</td></tr><tr><td>2026-03-11</td><td>1198.8</td><td>1200</td><td>-0.1</td></tr><tr><td>2026-03-12</td><td>1190.8</td><td>1198.8</td><td>-0.6673340007</td></tr></tbody></table></div>

<h4>LINQ — Cumulative SUM</h4>

```csharp
// LINQ: Aggregate with running total
var linqCum = ohlcv.Where(r => r.Symbol == "ASML.AS").OrderBy(r => r.Date)
    .Aggregate(new List<(string D, long V, long C)>(),
        (acc, r) => { acc.Add((r.Date.ToString("yyyy-MM-dd"), r.Volume,
            (acc.Count > 0 ? acc[^1].C : 0) + r.Volume)); return acc; })
    .TakeLast(5).ToList();
new DataFrame(
    Series.From("Date", linqCum.Select(r => r.D).ToArray()),
    Series.From("Volume", linqCum.Select(r => r.V).ToArray()),
    Series.From("CumVol", linqCum.Select(r => r.C).ToArray()))
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 3 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>Date<span class='pl-dtype'>utf8view</span></th><th>Volume<span class='pl-dtype'>int64</span></th><th>CumVol<span class='pl-dtype'>int64</span></th></tr></thead><tbody><tr><td>2026-03-06</td><td>857271</td><td>942889692</td></tr><tr><td>2026-03-09</td><td>689086</td><td>943578778</td></tr><tr><td>2026-03-10</td><td>800815</td><td>944379593</td></tr><tr><td>2026-03-11</td><td>562904</td><td>944942497</td></tr><tr><td>2026-03-12</td><td>128223</td><td>945070720</td></tr></tbody></table></div>

<h4>Polars DataFrame — Cumulative SUM</h4>

```csharp
// Polars: CumSum over partition
df.Filter(Col("symbol") == Lit("ASML.AS"))
  .Sort("date")
  .WithColumns(Col("volume").CumSum().Over("symbol").Alias("cum_vol"))
  .Select("date", "volume", "cum_vol")
  .Tail(5)
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 3 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>date<span class='pl-dtype'>date32</span></th><th>volume<span class='pl-dtype'>int64</span></th><th>cum_vol<span class='pl-dtype'>int64</span></th></tr></thead><tbody><tr><td>2026-03-06</td><td>857271</td><td>942889692</td></tr><tr><td>2026-03-09</td><td>689086</td><td>943578778</td></tr><tr><td>2026-03-10</td><td>800815</td><td>944379593</td></tr><tr><td>2026-03-11</td><td>562904</td><td>944942497</td></tr><tr><td>2026-03-12</td><td>128223</td><td>945070720</td></tr></tbody></table></div>

<h4>LINQ — Rolling average</h4>

```csharp
// LINQ: Skip/Take sliding window
var W = 20;
var asmlSorted = ohlcv.Where(r => r.Symbol == "ASML.AS").OrderBy(r => r.Date).ToList();
var linqSma = Enumerable.Range(W - 1, asmlSorted.Count - W + 1)
    .Select(i => new { asmlSorted[i].Date, asmlSorted[i].Close,
        SMA = Math.Round(asmlSorted.Skip(i - W + 1).Take(W).Average(r => r.Close), 2) })
    .TakeLast(5).ToList();
new DataFrame(
    Series.From("Date", linqSma.Select(r => r.Date.ToString("yyyy-MM-dd")).ToArray()),
    Series.From("Close", linqSma.Select(r => r.Close).ToArray()),
    Series.From("SMA20", linqSma.Select(r => r.SMA).ToArray()))
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 3 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>Date<span class='pl-dtype'>utf8view</span></th><th>Close<span class='pl-dtype'>double</span></th><th>SMA20<span class='pl-dtype'>double</span></th></tr></thead><tbody><tr><td>2026-03-06</td><td>1147</td><td>1214.02</td></tr><tr><td>2026-03-09</td><td>1147.6</td><td>1211.16</td></tr><tr><td>2026-03-10</td><td>1200</td><td>1211.51</td></tr><tr><td>2026-03-11</td><td>1198.8</td><td>1211.06</td></tr><tr><td>2026-03-12</td><td>1190.8</td><td>1211.61</td></tr></tbody></table></div>

<h4>Polars DataFrame — Rolling average</h4>

```csharp
// Polars: RollingMean
df.Filter(Col("symbol") == Lit("ASML.AS"))
  .Sort("date")
  .WithColumns(Col("close").RollingMean("20i").Over("symbol").Alias("sma_20"))
  .Select("date", "close", "sma_20")
  .Tail(5)
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 3 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>date<span class='pl-dtype'>date32</span></th><th>close<span class='pl-dtype'>double</span></th><th>sma_20<span class='pl-dtype'>double</span></th></tr></thead><tbody><tr><td>2026-03-06</td><td>1147</td><td>1214.02</td></tr><tr><td>2026-03-09</td><td>1147.6</td><td>1211.16</td></tr><tr><td>2026-03-10</td><td>1200</td><td>1211.51</td></tr><tr><td>2026-03-11</td><td>1198.8</td><td>1211.06</td></tr><tr><td>2026-03-12</td><td>1190.8</td><td>1211.61</td></tr></tbody></table></div>

<h4>LINQ — ROW_NUMBER / Rank</h4>

```csharp
// LINQ: GroupBy + OrderBy + index
var linqRank = ohlcv.GroupBy(r => r.Symbol)
    .SelectMany(g => g.OrderByDescending(r => r.Volume)
        .Select((r, i) => new { r.Symbol, r.Date, r.Volume, Rank = i + 1 })
        .Where(r => r.Rank <= 1))
    .OrderByDescending(r => r.Volume).Take(5).ToList();
new DataFrame(
    Series.From("Symbol", linqRank.Select(r => r.Symbol).ToArray()),
    Series.From("Date", linqRank.Select(r => r.Date.ToString("yyyy-MM-dd")).ToArray()),
    Series.From("Volume", linqRank.Select(r => r.Volume).ToArray()))
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 3 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>Symbol<span class='pl-dtype'>utf8view</span></th><th>Date<span class='pl-dtype'>utf8view</span></th><th>Volume<span class='pl-dtype'>int64</span></th></tr></thead><tbody><tr><td>ISP.MI</td><td>2023-08-08</td><td>376391539</td></tr><tr><td>SAN.MC</td><td>2021-10-20</td><td>367211467</td></tr><tr><td>BBVA.MC</td><td>2021-09-17</td><td>228528294</td></tr><tr><td>NDA-FI.HE</td><td>2022-09-16</td><td>140675854</td></tr><tr><td>PRX.AS</td><td>2021-08-17</td><td>114772834</td></tr></tbody></table></div>

<h4>Polars DataFrame — ROW_NUMBER / Rank</h4>

```csharp
// Polars: Rank over partition
df.WithColumns(Col("volume").Rank(descending: true).Over("symbol").Alias("vol_rank"))
  .Filter(Col("vol_rank") == Lit(1))
  .Sort("volume", descending: true)
  .Select("symbol", "date", "volume")
  .Head(5)
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 3 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>symbol<span class='pl-dtype'>utf8view</span></th><th>date<span class='pl-dtype'>date32</span></th><th>volume<span class='pl-dtype'>int64</span></th></tr></thead><tbody><tr><td>ISP.MI</td><td>2023-08-08</td><td>376391539</td></tr><tr><td>SAN.MC</td><td>2021-10-20</td><td>367211467</td></tr><tr><td>BBVA.MC</td><td>2021-09-17</td><td>228528294</td></tr><tr><td>NDA-FI.HE</td><td>2022-09-16</td><td>140675854</td></tr><tr><td>PRX.AS</td><td>2021-08-17</td><td>114772834</td></tr></tbody></table></div>

### Joins

<h4>LINQ — Inner Join</h4>

```csharp
// LINQ: Join on symbol
var linqJoin = ohlcv.GroupBy(r => r.Symbol)
    .Select(g => new { Symbol = g.Key, AvgClose = Math.Round(g.Average(r => r.Close), 2) })
    .Join(scores, o => o.Symbol, s => s.Symbol,
        (o, s) => new { o.Symbol, o.AvgClose, s.Sector, Rank = (int)s.CompositeRank })
    .OrderBy(r => r.Rank).Take(5).ToList();
new DataFrame(
    Series.From("Symbol", linqJoin.Select(r => r.Symbol).ToArray()),
    Series.From("AvgClose", linqJoin.Select(r => r.AvgClose).ToArray()),
    Series.From("Sector", linqJoin.Select(r => r.Sector).ToArray()),
    Series.From("Rank", linqJoin.Select(r => r.Rank).ToArray()))
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 4 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>Symbol<span class='pl-dtype'>utf8view</span></th><th>AvgClose<span class='pl-dtype'>double</span></th><th>Sector<span class='pl-dtype'>utf8view</span></th><th>Rank<span class='pl-dtype'>int32</span></th></tr></thead><tbody><tr><td>BNP.PA</td><td>60.94</td><td>Financial Services</td><td>1</td></tr><tr><td>BNP.PA</td><td>60.94</td><td>Financial Services</td><td>1</td></tr><tr><td>BNP.PA</td><td>60.94</td><td>Financial Services</td><td>1</td></tr><tr><td>DTE.DE</td><td>22.43</td><td>Communication Services</td><td>2</td></tr><tr><td>DTE.DE</td><td>22.43</td><td>Communication Services</td><td>2</td></tr></tbody></table></div>

<h4>Polars DataFrame — Inner Join</h4>

```csharp
// Polars: Join — same query as LINQ (avg close per symbol joined with scores)
var dfAvg = df.GroupBy("symbol").Agg(Col("close").Mean().Alias("avg_close"));

// Build scores DataFrame from the Dapper-loaded list
var dfScores = new DataFrame(
    Series.From("symbol", scores.Select(s => s.Symbol).ToArray()),
    Series.From("sector", scores.Select(s => s.Sector).ToArray()),
    Series.From("composite_rank", scores.Select(s => (int)s.CompositeRank).ToArray()));

dfAvg.Join(dfScores, new[] { Col("symbol") }, new[] { Col("symbol") })
    .Select("symbol", "avg_close", "sector", "composite_rank")
    .Sort("composite_rank")
    .Head(5)
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 4 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>symbol<span class='pl-dtype'>utf8view</span></th><th>avg_close<span class='pl-dtype'>double</span></th><th>sector<span class='pl-dtype'>utf8view</span></th><th>composite_rank<span class='pl-dtype'>int32</span></th></tr></thead><tbody><tr><td>BNP.PA</td><td>60.93771225</td><td>Financial Services</td><td>1</td></tr><tr><td>BNP.PA</td><td>60.93771225</td><td>Financial Services</td><td>1</td></tr><tr><td>BNP.PA</td><td>60.93771225</td><td>Financial Services</td><td>1</td></tr><tr><td>DTE.DE</td><td>22.43009743</td><td>Communication Services</td><td>2</td></tr><tr><td>DTE.DE</td><td>22.43009743</td><td>Communication Services</td><td>2</td></tr></tbody></table></div>

### CRUD-like Operations

<h4>LINQ — Add rows with Concat()</h4>

```csharp
// LINQ: Concat — appends one IEnumerable to another (lazy, no copy).
// Returns a new sequence that yields elements from both. Equivalent to SQL UNION ALL.
var newRows = new[] { new Ohlcv("TEST.XX", DateTime.Today, 100, 105, 95, 102, 102, 50000) };
var linqInsert = ohlcv.Concat(newRows).TakeLast(3).ToList();
Console.WriteLine($"  LINQ: {ohlcv.Count} + {newRows.Length} = {ohlcv.Count + newRows.Length} rows (Concat)");
new DataFrame(
    Series.From("Symbol", linqInsert.Select(r => r.Symbol).ToArray()),
    Series.From("Date", linqInsert.Select(r => r.Date.ToString("yyyy-MM-dd")).ToArray()),
    Series.From("Close", linqInsert.Select(r => r.Close).ToArray()),
    Series.From("Volume", linqInsert.Select(r => r.Volume).ToArray()))
```

      LINQ: 66355 + 1 = 66356 rows (Concat)

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(3 rows, 4 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>Symbol<span class='pl-dtype'>utf8view</span></th><th>Date<span class='pl-dtype'>utf8view</span></th><th>Close<span class='pl-dtype'>double</span></th><th>Volume<span class='pl-dtype'>int64</span></th></tr></thead><tbody><tr><td>WKL.AS</td><td>2026-03-12</td><td>67.32</td><td>210379</td></tr><tr><td>DSY.PA</td><td>2026-03-12</td><td>18.37</td><td>434417</td></tr><tr><td>TEST.XX</td><td>2026-03-28</td><td>102</td><td>50000</td></tr></tbody></table></div>

<h4>Polars DataFrame — Add rows weith VStack()</h4>

```csharp
// Polars: VStack — vertically stacks two DataFrames (appends rows).
// Both must have the same column names and types. Equivalent to SQL UNION ALL.
// Must match all 12 columns with exact types (Int64, Date, Float64, Bool).
var newDf = new DataFrame(
    Series.From("id", new[] { 0L }),
    Series.From("symbol", new[] { "TEST.XX" }),
    Series.From("date", new[] { DateOnly.FromDateTime(DateTime.Today) }),
    Series.From("open", new[] { 100.0 }),
    Series.From("high", new[] { 105.0 }),
    Series.From("low", new[] { 95.0 }),
    Series.From("close", new[] { 102.0 }),
    Series.From("adj_close", new[] { 102.0 }),
    Series.From("volume", new[] { 50000L }),
    Series.From("dividends", new[] { 0.0 }),
    Series.From("stock_splits", new[] { 0.0 }),
    Series.From("is_filled", new[] { false }));

var dfInserted = df.VStack(newDf);
Console.WriteLine($"  Polars: {df.Height} + {newDf.Height} = {dfInserted.Height} rows (VStack)");
dfInserted.Tail(3)
```

      Polars: 66355 + 1 = 66356 rows (VStack)

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(3 rows, 12 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>id<span class='pl-dtype'>int64</span></th><th>symbol<span class='pl-dtype'>utf8view</span></th><th>date<span class='pl-dtype'>date32</span></th><th>open<span class='pl-dtype'>double</span></th><th>high<span class='pl-dtype'>double</span></th><th>low<span class='pl-dtype'>double</span></th><th>close<span class='pl-dtype'>double</span></th><th>adj_close<span class='pl-dtype'>double</span></th><th>volume<span class='pl-dtype'>int64</span></th><th>dividends<span class='pl-dtype'>double</span></th><th>stock_splits<span class='pl-dtype'>double</span></th><th>is_filled<span class='pl-dtype'>bool</span></th></tr></thead><tbody><tr><td>66877</td><td>WKL.AS</td><td>2026-03-11</td><td>67.5</td><td>69.6</td><td>67.02</td><td>67.22</td><td>67.22</td><td>1142531</td><td>0</td><td>0</td><td>false</td></tr><tr><td>66929</td><td>WKL.AS</td><td>2026-03-12</td><td>67</td><td>67.54</td><td>66.28</td><td>67.32</td><td>67.32</td><td>210379</td><td>0</td><td>0</td><td>false</td></tr><tr><td>0</td><td>TEST.XX</td><td>2026-03-28</td><td>100</td><td>105</td><td>95</td><td>102</td><td>102</td><td>50000</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

<h4>LINQ — Update column</h4>

```csharp
// LINQ: Select with conditional
var linqUpdate = ohlcv.Where(r => r.Symbol == "ASML.AS").Take(5)
    .Select(r => new { r.Symbol, r.Date, AdjClose = r.Close * 1.05 }).ToList();
new DataFrame(
    Series.From("Symbol", linqUpdate.Select(r => r.Symbol).ToArray()),
    Series.From("Date", linqUpdate.Select(r => r.Date.ToString("yyyy-MM-dd")).ToArray()),
    Series.From("AdjClose", linqUpdate.Select(r => Math.Round(r.AdjClose, 2)).ToArray()))
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 3 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>Symbol<span class='pl-dtype'>utf8view</span></th><th>Date<span class='pl-dtype'>utf8view</span></th><th>AdjClose<span class='pl-dtype'>double</span></th></tr></thead><tbody><tr><td>ASML.AS</td><td>2021-01-04</td><td>426.56</td></tr><tr><td>ASML.AS</td><td>2021-01-05</td><td>427.24</td></tr><tr><td>ASML.AS</td><td>2021-01-06</td><td>422.99</td></tr><tr><td>ASML.AS</td><td>2021-01-07</td><td>424.1</td></tr><tr><td>ASML.AS</td><td>2021-01-08</td><td>436.85</td></tr></tbody></table></div>

<h4>Polars DataFrame — Update column</h4>

```csharp
// Polars: WithColumns — replaces or creates a column by expression
df.Filter(Col("symbol") == Lit("ASML.AS"))
  .WithColumns((Col("close") * Lit(1.05)).Alias("adj_close"))
  .Select("symbol", "date", "adj_close")
  .Head(5)
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(5 rows, 3 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>symbol<span class='pl-dtype'>utf8view</span></th><th>date<span class='pl-dtype'>date32</span></th><th>adj_close<span class='pl-dtype'>double</span></th></tr></thead><tbody><tr><td>ASML.AS</td><td>2021-01-04</td><td>426.5625</td></tr><tr><td>ASML.AS</td><td>2021-01-05</td><td>427.245</td></tr><tr><td>ASML.AS</td><td>2021-01-06</td><td>422.9925</td></tr><tr><td>ASML.AS</td><td>2021-01-07</td><td>424.095</td></tr><tr><td>ASML.AS</td><td>2021-01-08</td><td>436.8525</td></tr></tbody></table></div>

<h4>LINQ — Delete rows</h4>

```csharp
// LINQ: Where to keep, inverse of delete
var linqDelete = ohlcv.Where(r => r.Symbol != "ASML.AS");
Console.WriteLine($"  LINQ: {ohlcv.Count} - ASML rows = {linqDelete.Count()} remaining");
```

      LINQ: 66355 - ASML rows = 65024 remaining

<h4>Polars DataFrame — Delete rows</h4>

```csharp
// Polars: Filter (keep non-matching)
var dfFiltered = df.Filter(Col("symbol") != Lit("ASML.AS"));
Console.WriteLine($"  Polars: {df.Height} - ASML rows = {dfFiltered.Height} remaining");
```

      Polars: 66355 - ASML rows = 65024 remaining

<h4>LINQ — Drop column</h4>

```csharp
// LINQ: Select without the column (no native Drop — project only the columns you want)
var linqDrop = ohlcv.Take(3).Select(r => new
    { r.Symbol, r.Date, r.Open, r.High, r.Low, r.Close, r.AdjClose, r.Volume }).ToList();
new DataFrame(
    Series.From("Symbol", linqDrop.Select(r => r.Symbol).ToArray()),
    Series.From("Date", linqDrop.Select(r => r.Date.ToString("yyyy-MM-dd")).ToArray()),
    Series.From("Open", linqDrop.Select(r => r.Open).ToArray()),
    Series.From("High", linqDrop.Select(r => r.High).ToArray()),
    Series.From("Low", linqDrop.Select(r => r.Low).ToArray()),
    Series.From("Close", linqDrop.Select(r => r.Close).ToArray()),
    Series.From("AdjClose", linqDrop.Select(r => r.AdjClose).ToArray()),
    Series.From("Volume", linqDrop.Select(r => r.Volume).ToArray()))
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(3 rows, 8 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>Symbol<span class='pl-dtype'>utf8view</span></th><th>Date<span class='pl-dtype'>utf8view</span></th><th>Open<span class='pl-dtype'>double</span></th><th>High<span class='pl-dtype'>double</span></th><th>Low<span class='pl-dtype'>double</span></th><th>Close<span class='pl-dtype'>double</span></th><th>AdjClose<span class='pl-dtype'>double</span></th><th>Volume<span class='pl-dtype'>int64</span></th></tr></thead><tbody><tr><td>ASML.AS</td><td>2021-01-04</td><td>404</td><td>411</td><td>402.25</td><td>406.25</td><td>387.709</td><td>789502</td></tr><tr><td>ASML.AS</td><td>2021-01-05</td><td>406.55</td><td>412.05</td><td>401.15</td><td>406.9</td><td>388.3294</td><td>798787</td></tr><tr><td>ASML.AS</td><td>2021-01-06</td><td>406.8</td><td>407.2</td><td>399.2</td><td>402.85</td><td>384.4644</td><td>875711</td></tr></tbody></table></div>

<h4>Polars DataFrame — Drop column</h4>

```csharp
// Polars: Drop columns — select all except the ones to remove
var dropCols = new HashSet<string> { "dividends", "stock_splits", "is_filled" };
var keepCols = df.Columns.Where(n => !dropCols.Contains(n)).ToArray();
df.Select(keepCols).Head(3)
```

<style>.pl-dataframe,.pl-dataframe *{background:transparent!important;background-color:transparent!important;color:var(--vscode-editor-foreground,inherit)!important}.pl-dataframe{font-size:14px!important;border-collapse:collapse;width:auto}.pl-dataframe td,.pl-dataframe th{padding:6px 12px!important;text-align:left;border:1px solid var(--vscode-panel-border,#555)!important}.pl-dataframe th{font-weight:bold}.pl-dataframe .pl-dtype{font-size:11px;opacity:0.5}</style>
<style>
.pl-dataframe { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; border: 1px solid #e0e0e0; }
.pl-dataframe th { background-color: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 12px; border-bottom: 2px solid #ccc; }
.pl-dataframe td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; white-space: pre; color: #333; }
.pl-dataframe tr:nth-child(even) { background-color: #f9f9f9; }
.pl-dataframe tr:hover { background-color: #f1f1f1; }
.pl-dtype { font-size: 10px; color: #999; display: block; margin-top: 2px; font-weight: normal; }
.pl-null { color: #d0d0d0; font-style: italic; }
.pl-dim { font-family: sans-serif; font-size: 12px; color: #666; margin-bottom: 8px; }
</style><div class='pl-dim'>Polars DataFrame: <b>(3 rows, 9 columns)</b></div><div style='overflow-x:auto'><table class='pl-dataframe'><thead><tr><th>id<span class='pl-dtype'>int64</span></th><th>symbol<span class='pl-dtype'>utf8view</span></th><th>date<span class='pl-dtype'>date32</span></th><th>open<span class='pl-dtype'>double</span></th><th>high<span class='pl-dtype'>double</span></th><th>low<span class='pl-dtype'>double</span></th><th>close<span class='pl-dtype'>double</span></th><th>adj_close<span class='pl-dtype'>double</span></th><th>volume<span class='pl-dtype'>int64</span></th></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td></tr></tbody></table></div>
