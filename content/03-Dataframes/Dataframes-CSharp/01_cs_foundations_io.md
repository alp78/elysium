---
type: reference
category: programming-languages
technology:
  - csharp
  - dotnet
  - polars
tags: [pipeline, csharp, deedle, polars, dataframes]
aliases:
  - Series, DataFrames, types, CSV, Parquet
keywords: [Series, DataFrame, Index, dtypes, read_csv, read_parquet, to_csv, to_parquet, Polars.NET, Microsoft.Data.Analysis]
description: "Polars.NET / C# DataFrames reference 01/10 — Foundations & I/O (Series, DataFrames, types, CSV/Parquet). Executable examples with cell outputs. See [01_py_foundations_io](https://alp78.github.io/elysium/03-Dataframes/Dataframes-Python/01_py_foundations_io) for the Python equivalent."
created: 2026-03-27
updated: 2026-03-27
status: complete
---

# 01 – Foundations and Data Structures

> [!quote]
> "Bad programmers worry about the code. Good programmers worry about data structures and their relationships."
>
> — **Linus Torvalds**, Git mailing list post (2006)

Polars.NET vs Deedle: Series, DataFrames, and Data Types

---
## Setup & Imports

```csharp
// Suppress CS1701/CS1702 assembly version warnings in .NET Interactive.
// NuGet packages targeting .NET 8/9 trigger these on .NET 10 — harmless.
// Run this cell ONCE before any cells that use NuGet packages.

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

Console.WriteLine("WarningLevel set to 0 — CS1701/CS1702 warnings suppressed.");
```

    WarningLevel set to 0 — CS1701/CS1702 warnings suppressed.

```csharp
#r "nuget: Polars.NET, 0.4.0"
#r "nuget: Polars.NET.Native.win-x64, 0.4.0"
#r "nuget: Deedle, 4.0.1"
#r "nuget: Deedle.Interactive, 3.0.0"

using System.IO;
using System.Linq;
using System.Text.Json;
using Polars.CSharp;
using static Polars.CSharp.Polars;
using Deedle;
using Microsoft.DotNet.Interactive.Formatting;

// Redirect Deedle's FSharp.Core 10.1.0.0 request to the SDK's 11.0.0.0 already loaded
System.Runtime.Loader.AssemblyLoadContext.Default.Resolving += (ctx, name) =>
{
    if (name.Name == "FSharp.Core")
        return AppDomain.CurrentDomain.GetAssemblies()
            .FirstOrDefault(a => a.GetName().Name == "FSharp.Core");
    return null;
};

// Register HTML formatter for Polars.NET types (Deedle.Interactive handles Deedle)
Formatter.Register<DataFrame>((df, writer) =>
{
    var html = df.ToHtml();
    // Strip surrounding quotes from Polars string values in HTML
    html = System.Text.RegularExpressions.Regex.Replace(html, @"(&gt;|>)(.+?)(&lt;|<)", @"$1$2$3");
    html = System.Text.RegularExpressions.Regex.Replace(html, @">""(.+?)""<", @">$1<");
    // Override Polars default CSS to work with VS Code dark/light themes
    var css = """
        """;
    writer.Write(css + html);
}, "text/html");
Formatter.Register<Polars.CSharp.Series>((s, writer) =>
{
    var sdf = DataFrame.FromSeries(s);
    var shtml = sdf.ToHtml();
    shtml = System.Text.RegularExpressions.Regex.Replace(shtml, @"(>|>)(.+?)(<|<)", @"$1$2$3");
    shtml = System.Text.RegularExpressions.Regex.Replace(shtml, @">""(.+?)""<", @">$1<");
    var scss = @"";
    writer.Write(scss + shtml);
}, "text/html");

var DATA = Path.Combine("..", "data");
Console.WriteLine($"Data directory: {Path.GetFullPath(DATA)}");
```

    Data directory: c:\Users\aperi\DEV\LANG\data

---
## Series

- **Series**: A single column of typed, homogeneous data – the fundamental building block.
- Polars.NET uses Arrow-backed memory with native null bitmaps.
- Deedle uses .NET generics with `OptionalValue<T>` for missing data.

#### Polars.NET – Create series from arrays with Series.From&lt;T&gt;
```csharp
// Polars.NET – create a Series from an array
var prices = Polars.CSharp.Series.From("prices", new[] { 100.0, 102.5, 101.8, 103.2, 104.1 });

display($"Name: {prices.Name}  |  Length: {prices.Length}  |  DataType: {prices.DataTypeName}");
prices
```

    Name: prices  |  Length: 5  |  DataType: f64

<!-- Polars DataFrame: (5 rows, 1 columns) --><table><thead><tr><th>prices</th></tr></thead><tbody><tr><td>100</td></tr><tr><td>102.5</td></tr><tr><td>101.8</td></tr><tr><td>103.2</td></tr><tr><td>104.1</td></tr></tbody></table></div>

```csharp
// From different .NET types -- Polars maps to Arrow types automatically
var ints    = Polars.CSharp.Series.From("ids", new[] { 1, 2, 3, 4, 5 });
var strings = Polars.CSharp.Series.From("tickers", new[] { "ASML.AS", "SAP.DE", "SIE.DE" });
var dates   = Polars.CSharp.Series.From("dates", new[] {
    new DateOnly(2024, 1, 2), new DateOnly(2024, 1, 3), new DateOnly(2024, 1, 4)
});

display($"ints: {ints.DataTypeName}  |  strings: {strings.DataTypeName}  |  dates: {dates.DataTypeName}");
```

    ints: i32  |  strings: str  |  dates: date

#### Deedle – Create series with SeriesBuilder and ToOrdinalSeries
```csharp
// Deedle – quickest way: .ToOrdinalSeries() (keys = 0, 1, 2, ...)
var prices = new[] { 100.0, 102.5, 101.8, 103.2, 104.1 }.ToOrdinalSeries();
display($"KeyCount: {prices.KeyCount}");
prices
```

    KeyCount: 5

<div>
<table>
<tr><td><b>0</b></td><td class="no-wrap">-></td><td>100</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>102.5</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>101.8</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>103.2</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>104.1</td></tr>
</table>
<p>Series of <b>5</b> items<p><b>0</b> missing values</p>
</div>

```csharp
// Deedle – explicit keys via SeriesBuilder
var tickers = new SeriesBuilder<int, string>
{
    { 0, "ASML.AS" },
    { 1, "SAP.DE" },
    { 2, "SIE.DE" },
}.Series;

tickers
```

<div>
<table>
<tr><td><b>0</b></td><td class="no-wrap">-></td><td>ASML.AS</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>SAP.DE</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>SIE.DE</td></tr>
</table>
<p>Series of <b>3</b> items<p><b>0</b> missing values</p>
</div>

```csharp
// Deedle – from KeyValue pairs (useful with LINQ)
var indexed = Enumerable.Range(0, 5)
    .Select(i => KeyValue.Create(i, i * 10.0))
    .ToSeries();

indexed
```

<div>
<table>
<tr><td><b>0</b></td><td class="no-wrap">-></td><td>0</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>10</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>20</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>30</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>40</td></tr>
</table>
<p>Series of <b>5</b> items<p><b>0</b> missing values</p>
</div>

---
#### Polars.NET – Handle nulls natively in Series

```csharp
// Polars.NET – native null support via nullable types
var s = Polars.CSharp.Series.From<double?>("with_nulls",
    new double?[] { 1.0, null, 3.0, null, 5.0 });

display($"Length: {s.Length}  |  NullCount: {s.NullCount}");
s
```

    Length: 5  |  NullCount: 2

<!-- Polars DataFrame: (5 rows, 1 columns) --><table><thead><tr><th>with_nulls</th></tr></thead><tbody><tr><td>1</td></tr><tr><td class='pl-null'>null</td></tr><tr><td>3</td></tr><tr><td class='pl-null'>null</td></tr><tr><td>5</td></tr></tbody></table></div>

#### Deedle – Represent missing values with OptionalValue&lt;T&gt;
```csharp
// Deedle – missing values arise when keys are absent after alignment
var sparse = new SeriesBuilder<int, double>
{
    { 0, 1.0 },
    { 2, 3.0 },
    { 4, 5.0 },
}.Series;

// Realign to include all keys 0..4 – keys 1 and 3 become <missing>
var withGaps = sparse.Realign(Enumerable.Range(0, 5));

display($"KeyCount: {withGaps.KeyCount}");
withGaps
```

    KeyCount: 5

<div>
<table>
<tr><td><b>0</b></td><td class="no-wrap">-></td><td>1</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td><missing></td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>3</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td><missing></td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>5</td></tr>
</table>
<p>Series of <b>5</b> items<p><b>2</b> missing values</p>
</div>

---
#### Polars.NET & Deedle – Inspect Series data types across both libraries

```csharp
// Polars.NET – Arrow-based type system
var examples = new (string Name, string Type)[]
{
    ("Int32",    Polars.CSharp.Series.From("x", new[] { 1, 2, 3 }).DataTypeName),
    ("Int64",    Polars.CSharp.Series.From("x", new[] { 1L, 2L, 3L }).DataTypeName),
    ("Float64",  Polars.CSharp.Series.From("x", new[] { 1.0, 2.0 }).DataTypeName),
    ("String",   Polars.CSharp.Series.From("x", new[] { "a", "b" }).DataTypeName),
    ("Boolean",  Polars.CSharp.Series.From("x", new[] { true, false }).DataTypeName),
    ("Date",     Polars.CSharp.Series.From("x", new[] { DateOnly.MinValue }).DataTypeName),
    ("DateTime", Polars.CSharp.Series.From("x", new[] { DateTime.Now }).DataTypeName),
};

foreach (var (name, type) in examples)
    Console.WriteLine($"  {name,-12} → {type}");
```

      Int32        → i32
      Int64        → i64
      Float64      → f64
      String       → str
      Boolean      → bool
      Date         → date
      DateTime     → datetime[μs]

#### Deedle – Inspect data types with standard .NET types

```csharp
// Deedle – uses standard .NET types
var dfInt = Frame.FromRecords(new[] { new { x = 1 }, new { x = 2 } });
var dfDbl = Frame.FromRecords(new[] { new { x = 1.0 }, new { x = 2.0 } });
var dfStr = Frame.FromRecords(new[] { new { x = "a" }, new { x = "b" } });

Console.WriteLine($"  int[]    → {dfInt.ColumnTypes.First().Name}");
Console.WriteLine($"  double[] → {dfDbl.ColumnTypes.First().Name}");
Console.WriteLine($"  string[] → {dfStr.ColumnTypes.First().Name}");
```

      int[]    → Int32
      double[] → Double
      string[] → String

---
#### Polars.NET – Perform arithmetic operations on Series

```csharp
// Polars.NET – operator overloads on Series
var a = Polars.CSharp.Series.From("a", new[] { 10.0, 20.0, 30.0 });
var b = Polars.CSharp.Series.From("b", new[] { 1.0, 2.0, 3.0 });

DataFrame.FromColumns(
    ("a + b", (a + b).ToArray<double>()),
    ("a - b", (a - b).ToArray<double>()),
    ("a * b", (a * b).ToArray<double>()),
    ("a / b", (a / b).ToArray<double>())
)
```

<!-- Polars DataFrame: (3 rows, 4 columns) --><table><thead><tr><th>a + b</th><th>a - b</th><th>a * b</th><th>a / b</th></tr></thead><tbody><tr><td>11</td><td>9</td><td>10</td><td>10</td></tr><tr><td>22</td><td>18</td><td>40</td><td>10</td></tr><tr><td>33</td><td>27</td><td>90</td><td>10</td></tr></tbody></table></div>

#### Deedle – Perform arithmetic operations on Series

```csharp
// Deedle – operator overloads on Series<K,V>
var a = new[] { 10.0, 20.0, 30.0 }.ToOrdinalSeries();
var b = new[] { 1.0, 2.0, 3.0 }.ToOrdinalSeries();

var builder = new FrameBuilder.Columns<int, string>();
builder.Add("a + b", a + b);
builder.Add("a - b", a - b);
builder.Add("a * b", a * b);
builder.Add("a / b", a / b);
builder.Frame
```

<div>
<table>
<thead><th></th><th></th><th>a + b</th><th>a - b</th><th>a * b</th><th>a / b</th></thead><thead><th></th><th></th><th>(float)</th><th>(float)</th><th>(float)</th><th>(float)</th></thead>
<tr><td><b>0</b></td><td class="no-wrap">-></td><td>11</td><td>9</td><td>10</td><td>10</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>22</td><td>18</td><td>40</td><td>10</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>33</td><td>27</td><td>90</td><td>10</td></tr>
</table>
<p><b>3</b> rows x <b>4</b> columns</p><p><b>0</b> missing values</p>
</div>

---
#### Polars.NET – Compute aggregations on Series (sum, mean, std, min, max)

```csharp
// Polars.NET — basic aggregations as a summary DataFrame
var s = Polars.CSharp.Series.From("vals", new[] { 10.0, 20.0, 30.0, 40.0, 50.0 });

new DataFrame(new Polars.CSharp.Series[]
{
    Polars.CSharp.Series.From("stat", new[] { "sum", "mean", "std", "min", "max" }),
    Polars.CSharp.Series.From("value", new[] {
        s.Sum<double>(), s.Mean<double>(), s.Std().GetValue<double>(0),
        s.Min<double>(), s.Max<double>()
    })
})
```

<!-- Polars DataFrame: (5 rows, 2 columns) --><table><thead><tr><th>stat</th><th>value</th></tr></thead><tbody><tr><td>sum</td><td>150</td></tr><tr><td>mean</td><td>30</td></tr><tr><td>std</td><td>15.8113883</td></tr><tr><td>min</td><td>10</td></tr><tr><td>max</td><td>50</td></tr></tbody></table></div>

#### Deedle – Compute aggregations on Series

```csharp
// Deedle — basic aggregations as a Deedle Frame
var s = new[] { 10.0, 20.0, 30.0, 40.0, 50.0 }.ToOrdinalSeries();

var stats = new[] { "sum", "mean", "stddev", "min", "max", "median" };
var vals = new[] { s.Sum(), s.Mean(), s.StdDev(), s.Min(), s.Max(), s.Median() };
var idx = Enumerable.Range(0, stats.Length).ToArray();

var fb = new FrameBuilder.Columns<int, string>();
fb.Add("stat", new Series<int, string>(idx, stats));
fb.Add("value", new Series<int, double>(idx, vals));
fb.Frame
```

<div>
<table>
<thead><th></th><th></th><th>stat</th><th>value</th></thead><thead><th></th><th></th><th>(string)</th><th>(float)</th></thead>
<tr><td><b>0</b></td><td class="no-wrap">-></td><td>sum</td><td>150</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>mean</td><td>30</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>stddev</td><td>15.811388300841896</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>min</td><td>10</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>max</td><td>50</td></tr><tr><td><b>5</b></td><td class="no-wrap">-></td><td>median</td><td>30</td></tr>
</table>
<p><b>6</b> rows x <b>2</b> columns</p><p><b>0</b> missing values</p>
</div>

---
#### Polars.NET – Summarise a Series with Describe
```csharp
// Polars.NET – built-in describe (returns a DataFrame)
var s = Polars.CSharp.Series.From("prices", new[] { 100.0, 102.5, 101.8, 103.2, 104.1 });
// describe() is on DataFrame, so wrap in a single-column DataFrame
var df = DataFrame.FromSeries(s);
df.Describe()
```

<!-- Polars DataFrame: (9 rows, 2 columns) --><table><thead><tr><th>statistic</th><th>prices</th></tr></thead><tbody><tr><td>count</td><td>5</td></tr><tr><td>null_count</td><td>0</td></tr><tr><td>mean</td><td>102.32</td></tr><tr><td>std</td><td>1.551450934</td></tr><tr><td>min</td><td>100</td></tr><tr><td>25%</td><td>101.8</td></tr><tr><td>50%</td><td>102.5</td></tr><tr><td>75%</td><td>103.2</td></tr><tr><td>max</td><td>104.1</td></tr></tbody></table></div>

#### Deedle – Compute summary statistics manually

```csharp
// Deedle — no built-in Series describe; build a summary Frame
var s = new[] { 100.0, 102.5, 101.8, 103.2, 104.1 }.ToOrdinalSeries();

var stats = new[] { "count", "mean", "stddev", "min", "max", "median" };
var vals = new[] { (double)s.KeyCount, s.Mean(), s.StdDev(), s.Min(), s.Max(), s.Median() };
var idx = Enumerable.Range(0, stats.Length).ToArray();

var fb = new FrameBuilder.Columns<int, string>();
fb.Add("stat", new Series<int, string>(idx, stats));
fb.Add("value", new Series<int, double>(idx, vals));
fb.Frame
```

<div>
<table>
<thead><th></th><th></th><th>stat</th><th>value</th></thead><thead><th></th><th></th><th>(string)</th><th>(float)</th></thead>
<tr><td><b>0</b></td><td class="no-wrap">-></td><td>count</td><td>5</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>mean</td><td>102.32000000000001</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>stddev</td><td>1.551450933802398</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>min</td><td>100</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>max</td><td>104.1</td></tr><tr><td><b>5</b></td><td class="no-wrap">-></td><td>median</td><td>102.5</td></tr>
</table>
<p><b>6</b> rows x <b>2</b> columns</p><p><b>0</b> missing values</p>
</div>

---
#### Comparison Summary – Series

| Operation | Polars.NET | Deedle |
|---|---|---|
| Create from array | `Series.From<T>("name", arr)` | `arr.ToOrdinalSeries()` |
| Create with keys | `Series.From<T>("name", arr)` (positional) | `new SeriesBuilder<K,V> { {k,v}, ... }.Series` |
| Null / missing | Nullable types: `double?[] { 1.0, null }` | `OptionalValue<T>.Missing` via key gaps + `.Realign()` |
| Data type | `.DataTypeName` (Arrow types) | `.NET` types via `Frame.ColumnTypes` |
| Arithmetic | `+`, `-`, `*`, `/` operators | `+`, `-`, `*`, `/` operators |
| Sum / Mean / Std | `.Sum<T>()`, `.Mean<T>()`, `.Std<T>()` | `.Sum()`, `.Mean()`, `.StdDev()` |
| Min / Max | `.Min<T>()`, `.Max<T>()` | `.Min()`, `.Max()` |
| Describe | `DataFrame.FromSeries(s).Describe()` | Manual stats or `Frame.Describe()` |

---
## DataFrames

- **DataFrame**: A collection of named, typed columns – the primary data structure.
- Polars.NET: column-oriented, Arrow-backed, no row index.
- Deedle: `Frame<TRowKey, TColKey>` with a typed row index.

#### Polars.NET – Build DataFrames from columns with DataFrame.FromColumns
```csharp
// Polars.NET – from an anonymous object (each property = column)
var df = DataFrame.FromColumns(new
{
    Symbol = new[] { "ASML.AS", "SAP.DE", "SIE.DE", "TTE.PA", "AIR.PA" },
    Sector = new[] { "Technology", "Technology", "Industrials", "Energy", "Industrials" },
    Price  = new[] { 680.5, 175.2, 168.9, 58.3, 152.7 },
});

display($"Shape: {df.Shape}");
df
```

    Shape: (5, 3)

<!-- Polars DataFrame: (5 rows, 3 columns) --><table><thead><tr><th>Symbol</th><th>Sector</th><th>Price</th></tr></thead><tbody><tr><td>ASML.AS</td><td>Technology</td><td>680.5</td></tr><tr><td>SAP.DE</td><td>Technology</td><td>175.2</td></tr><tr><td>SIE.DE</td><td>Industrials</td><td>168.9</td></tr><tr><td>TTE.PA</td><td>Energy</td><td>58.3</td></tr><tr><td>AIR.PA</td><td>Industrials</td><td>152.7</td></tr></tbody></table></div>

```csharp
// Polars.NET – from named tuples (no reflection needed)
var df2 = DataFrame.FromColumns(
    ("Name",  new[] { "Alice", "Bob", "Carol" }),
    ("Age",   new[] { 30, 25, 35 }),
    ("Score", new[] { 95.5, 88.0, 92.3 })
);
df2
```

<!-- Polars DataFrame: (3 rows, 3 columns) --><table><thead><tr><th>Name</th><th>Age</th><th>Score</th></tr></thead><tbody><tr><td>Alice</td><td>30</td><td>95.5</td></tr><tr><td>Bob</td><td>25</td><td>88</td></tr><tr><td>Carol</td><td>35</td><td>92.3</td></tr></tbody></table></div>

#### Deedle – Build DataFrames from records with Frame.FromRecords and FrameBuilder
```csharp
// Deedle – from anonymous records (row-oriented, like a list of dicts)
var df = Frame.FromRecords(new[]
{
    new { Symbol = "ASML.AS", Sector = "Technology",  Price = 680.5 },
    new { Symbol = "SAP.DE",  Sector = "Technology",  Price = 175.2 },
    new { Symbol = "SIE.DE",  Sector = "Industrials", Price = 168.9 },
    new { Symbol = "TTE.PA",  Sector = "Energy",      Price = 58.3 },
    new { Symbol = "AIR.PA",  Sector = "Industrials", Price = 152.7 },
});

display($"Shape: {df.RowCount} rows x {df.ColumnCount} cols");
df
```

    Shape: 5 rows x 3 cols

<div>
<table>
<thead><th></th><th></th><th>Symbol</th><th>Sector</th><th>Price</th></thead><thead><th></th><th></th><th>(string)</th><th>(string)</th><th>(float)</th></thead>
<tr><td><b>0</b></td><td class="no-wrap">-></td><td>ASML.AS</td><td>Technology</td><td>680.5</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>SAP.DE</td><td>Technology</td><td>175.2</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>SIE.DE</td><td>Industrials</td><td>168.9</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>TTE.PA</td><td>Energy</td><td>58.3</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>AIR.PA</td><td>Industrials</td><td>152.7</td></tr>
</table>
<p><b>5</b> rows x <b>3</b> columns</p><p><b>0</b> missing values</p>
</div>

```csharp
// Deedle – from FrameBuilder (column-oriented, preserves insertion order)
var builder = new FrameBuilder.Columns<int, string>();
builder.Add("Name",  new[] { "Alice", "Bob", "Carol" }.ToOrdinalSeries());
builder.Add("Age",   new[] { 30, 25, 35 }.ToOrdinalSeries());
builder.Add("Score", new[] { 95.5, 88.0, 92.3 }.ToOrdinalSeries());
var df2 = builder.Frame;
df2
```

<div>
<table>
<thead><th></th><th></th><th>Name</th><th>Age</th><th>Score</th></thead><thead><th></th><th></th><th>(string)</th><th>(int)</th><th>(float)</th></thead>
<tr><td><b>0</b></td><td class="no-wrap">-></td><td>Alice</td><td>30</td><td>95.5</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>Bob</td><td>25</td><td>88</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>Carol</td><td>35</td><td>92.3</td></tr>
</table>
<p><b>3</b> rows x <b>3</b> columns</p><p><b>0</b> missing values</p>
</div>

---
#### Polars.NET – Build DataFrames from record objects with DataFrame.From&lt;T&gt;
```csharp
// Polars.NET – from IEnumerable of records (anonymous types or POCOs)
var records = new[]
{
    new { Date = new DateOnly(2024, 1, 2), Open = 100.0, High = 105.0, Low = 99.0, Close = 103.5 },
    new { Date = new DateOnly(2024, 1, 3), Open = 103.5, High = 106.0, Low = 102.0, Close = 104.8 },
    new { Date = new DateOnly(2024, 1, 4), Open = 104.8, High = 107.5, Low = 103.0, Close = 106.2 },
};
var df = DataFrame.From(records);
df
```

<!-- Polars DataFrame: (3 rows, 5 columns) --><table><thead><tr><th>Date</th><th>Open</th><th>High</th><th>Low</th><th>Close</th></tr></thead><tbody><tr><td>2024-01-02</td><td>100</td><td>105</td><td>99</td><td>103.5</td></tr><tr><td>2024-01-03</td><td>103.5</td><td>106</td><td>102</td><td>104.8</td></tr><tr><td>2024-01-04</td><td>104.8</td><td>107.5</td><td>103</td><td>106.2</td></tr></tbody></table></div>

---
#### Polars.NET – Build DataFrames from existing Series with DataFrame.FromSeries
```csharp
// Polars.NET – from existing Series
var names  = Polars.CSharp.Series.From("name", new[] { "Alice", "Bob" });
var ages   = Polars.CSharp.Series.From("age", new[] { 30, 25 });
var scores = Polars.CSharp.Series.From("score", new[] { 95.5, 88.0 });

var df = DataFrame.FromSeries(names, ages, scores);
df
```

<!-- Polars DataFrame: (2 rows, 3 columns) --><table><thead><tr><th>name</th><th>age</th><th>score</th></tr></thead><tbody><tr><td>Alice</td><td>30</td><td>95.5</td></tr><tr><td>Bob</td><td>25</td><td>88</td></tr></tbody></table></div>

---
#### Polars.NET – Create an empty DataFrame with a predefined schema

```csharp
// Polars.NET – empty DataFrame with predefined schema
var schema = new PolarsSchema()
    .Add("id", DataType.Int32)
    .Add("name", DataType.String)
    .Add("value", DataType.Float64);

var empty = DataFrame.FromColumns(
    ("id",    Array.Empty<int>()),
    ("name",  Array.Empty<string>()),
    ("value", Array.Empty<double>())
);

display($"Shape: {empty.Shape}");
empty.PrintSchema();
```

    Shape: (0, 3)

    root
     |-- id: Int32
     |-- name: String
     |-- value: Float64

#### Deedle – Create an empty DataFrame

```csharp
// Deedle – empty frame
var empty = Frame.CreateEmpty<int, string>();
display($"Shape: {empty.RowCount} x {empty.ColumnCount}");
```

    Shape: 0 x 0

---
## The Index Concept

- **Polars.NET**: No row index. Rows are identified by position. This is deliberate – simpler, faster, no index alignment surprises.
- **Deedle**: First-class `Frame<TRowKey, TColKey>` where `TRowKey` can be `int`, `DateTime`, `string`, etc. Enables label-based lookup and automatic alignment.

#### Polars.NET – Access rows by position without an index

```csharp
// Polars.NET – no index. Access rows by position.
var df = DataFrame.FromColumns(new
{
    Symbol = new[] { "ASML.AS", "SAP.DE", "SIE.DE" },
    Price  = new[] { 680.5, 175.2, 168.9 },
});

// Row 0
display(df.Head(1));

// Polars uses .Filter() or .Slice() instead of index-based lookup
display(df.Filter(Col("Symbol") == Lit("SAP.DE")));
```

<!-- Polars DataFrame: (1 rows, 2 columns) --><table><thead><tr><th>Symbol</th><th>Price</th></tr></thead><tbody><tr><td>ASML.AS</td><td>680.5</td></tr></tbody></table></div>

<!-- Polars DataFrame: (1 rows, 2 columns) --><table><thead><tr><th>Symbol</th><th>Price</th></tr></thead><tbody><tr><td>SAP.DE</td><td>175.2</td></tr></tbody></table></div>

#### Deedle – Set a column as the row index for label-based lookup

```csharp
// Deedle – set a column as the row index (like Pandas .set_index())
var df = Frame.FromRecords(new[]
{
    new { Symbol = "ASML.AS", Price = 680.5 },
    new { Symbol = "SAP.DE",  Price = 175.2 },
    new { Symbol = "SIE.DE",  Price = 168.9 },
});

// Index by Symbol for label-based lookup
var indexed = df.IndexRows<string>("Symbol");

// Label-based access
display(indexed.Rows["SAP.DE"]);
```

<div>
<table>
<tr><td><b>Price</b></td><td class="no-wrap">-></td><td>175.2</td></tr>
</table>
<p>Series of <b>1</b> items<p><b>0</b> missing values</p>
</div>

#### Deedle – Automatic index alignment when combining Series

Deedle automatically aligns Series by their keys when performing operations –
if keys don't match, the result has `missing` values. Polars.NET uses explicit joins instead.

```csharp
// Deedle – automatic index alignment
var s1 = new SeriesBuilder<string, double>
{
    { "ASML", 680.5 }, { "SAP", 175.2 }, { "SIE", 168.9 }
}.Series;

var s2 = new SeriesBuilder<string, double>
{
    { "SAP", 5.0 }, { "SIE", 3.2 }, { "TTE", 58.3 }
}.Series;

// Keys are aligned automatically – ASML and TTE become <missing>
var result = s1 + s2;
result
```

<div>
<table>
<tr><td><b>ASML</b></td><td class="no-wrap">-></td><td><missing></td></tr><tr><td><b>SAP</b></td><td class="no-wrap">-></td><td>180.2</td></tr><tr><td><b>SIE</b></td><td class="no-wrap">-></td><td>172.1</td></tr><tr><td><b>TTE</b></td><td class="no-wrap">-></td><td><missing></td></tr>
</table>
<p>Series of <b>4</b> items<p><b>2</b> missing values</p>
</div>

---
## Data Types Deep Dive

- Polars.NET uses **Apache Arrow** types: `Int8`..`Int64`, `UInt8`..`UInt64`, `Float32`, `Float64`, `Utf8` (String), `Date`, `Datetime`, `Duration`, `Boolean`, `Categorical`, `Enum`, `List`, `Struct`, `Binary`.
- Deedle uses **standard .NET types**: `int`, `double`, `string`, `DateTime`, `bool`, etc. wrapped in `OptionalValue<T>` for null tracking.

#### Polars.NET – Inspect schema and data types of a real dataset

```csharp
// Polars.NET – inspect schema of a real dataset
var df = DataFrame.ReadParquet(Path.Combine(DATA, "eurostoxx50_ohlcv.parquet"));
df.PrintSchema();
display($"Shape: {df.Shape}");
```

    root
     |-- id: Int64
     |-- symbol: String
     |-- date: Date
     |-- open: Float64
     |-- high: Float64
     |-- low: Float64
     |-- close: Float64
     |-- adj_close: Float64
     |-- volume: Int64
     |-- dividends: Float64
     |-- stock_splits: Float64
     |-- is_filled: Boolean

    Shape: (66355, 12)

#### Deedle – Inspect column types of a CSV-loaded frame

```csharp
// Deedle — inspect types of a CSV-loaded frame as a summary Frame
var df = Frame.ReadCsv(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"));
display($"Shape: {df.RowCount} x {df.ColumnCount}");

var colNames = df.ColumnKeys.ToArray();
var colTypes = df.ColumnTypes.Select(t => t.Name).ToArray();
var idx = Enumerable.Range(0, colNames.Length).ToArray();

var fb = new FrameBuilder.Columns<int, string>();
fb.Add("column", new Series<int, string>(idx, colNames));
fb.Add("type", new Series<int, string>(idx, colTypes));
fb.Frame
```

    Shape: 66355 x 12

<div>
<table>
<thead><th></th><th></th><th>column</th><th>type</th></thead><thead><th></th><th></th><th>(string)</th><th>(string)</th></thead>
<tr><td><b>0</b></td><td class="no-wrap">-></td><td>id</td><td>Int32</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>symbol</td><td>String</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>date</td><td>DateTime</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>open</td><td>Decimal</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>high</td><td>Decimal</td></tr><tr><td><b>:</b></td><td class="no-wrap"></td><td>...</td><td>...</td></tr><tr><td><b>7</b></td><td class="no-wrap">-></td><td>adj_close</td><td>Decimal</td></tr><tr><td><b>8</b></td><td class="no-wrap">-></td><td>volume</td><td>Int32</td></tr><tr><td><b>9</b></td><td class="no-wrap">-></td><td>dividends</td><td>Decimal</td></tr><tr><td><b>10</b></td><td class="no-wrap">-></td><td>stock_splits</td><td>Decimal</td></tr><tr><td><b>11</b></td><td class="no-wrap">-></td><td>is_filled</td><td>Boolean</td></tr>
</table>
<p><b>12</b> rows x <b>2</b> columns</p><p><b>0</b> missing values</p>
</div>

---
#### Polars.NET – Cast column types with expressions

```csharp
// Polars.NET – cast columns via expressions
var df = DataFrame.FromColumns(new
{
    Id    = new[] { "1", "2", "3" },
    Value = new[] { 10, 20, 30 },
});

var casted = df.WithColumns(
    Col("Id").Cast(DataType.Int32).Alias("Id"),
    Col("Value").Cast(DataType.Float64).Alias("Value")
);

casted.PrintSchema();
casted
```

    root
     |-- Id: Int32
     |-- Value: Float64

<!-- Polars DataFrame: (3 rows, 2 columns) --><table><thead><tr><th>Id</th><th>Value</th></tr></thead><tbody><tr><td>1</td><td>10</td></tr><tr><td>2</td><td>20</td></tr><tr><td>3</td><td>30</td></tr></tbody></table></div>

```csharp
// Polars.NET – cast a string Series to Int32 (unparseable values become null)
var s = Polars.CSharp.Series.From("mixed", new[] { "1", "two", "3" });
var numeric = s.Cast(DataType.Int32);
numeric
```

<!-- Polars DataFrame: (3 rows, 1 columns) --><table><thead><tr><th>mixed</th></tr></thead><tbody><tr><td>1</td></tr><tr><td class='pl-null'>null</td></tr><tr><td>3</td></tr></tbody></table></div>

---
## Loading Real Data

#### Polars.NET – Load data from CSV, Parquet, and JSON

```csharp
// Polars.NET — load from CSV, Parquet, JSON — compare shapes
var csvDf     = DataFrame.ReadCsv(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"), tryParseDates: true);
var parquetDf = DataFrame.ReadParquet(Path.Combine(DATA, "eurostoxx50_ohlcv.parquet"));
var jsonDf    = DataFrame.ReadJson(Path.Combine(DATA, "eurostoxx50_ohlcv.json"));

new DataFrame(new Polars.CSharp.Series[]
{
    Polars.CSharp.Series.From("format", new[] { "CSV", "Parquet", "JSON" }),
    Polars.CSharp.Series.From("rows", new[] { csvDf.Height, parquetDf.Height, jsonDf.Height }),
    Polars.CSharp.Series.From("cols", new[] { csvDf.Width, parquetDf.Width, jsonDf.Width })
})
```

<!-- Polars DataFrame: (3 rows, 3 columns) --><table><thead><tr><th>format</th><th>rows</th><th>cols</th></tr></thead><tbody><tr><td>CSV</td><td>66355</td><td>12</td></tr><tr><td>Parquet</td><td>66355</td><td>12</td></tr><tr><td>JSON</td><td>66355</td><td>12</td></tr></tbody></table></div>

#### Deedle – Load data from CSV (Parquet and JSON not supported)

```csharp
// Deedle – load from CSV (Parquet and JSON are NOT natively supported)
var csvDf = Frame.ReadCsv(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"));
display($"CSV: {csvDf.RowCount} x {csvDf.ColumnCount}");

// For Parquet: use Polars.NET or ParquetSharp, then convert
// For JSON:    use System.Text.Json, then Frame.FromRecords()
```

    CSV: 66355 x 12

---
## Inspecting DataFrames

- `.Head(n)`, `.Tail(n)` – first/last N rows
- `.Shape`, `.Schema`, `.Describe()` – metadata and summary statistics

#### Polars.NET – Inspect shape, schema, head, tail, nulls, and memory

```csharp
// Polars.NET – load the main dataset
var ohlcv = DataFrame.ReadParquet(Path.Combine(DATA, "eurostoxx50_ohlcv.parquet"));

display($"Shape: {ohlcv.Shape}  |  Height: {ohlcv.Height}  |  Width: {ohlcv.Width}");
```

    Shape: (66355, 12)  |  Height: 66355  |  Width: 12

```csharp
// Head and Tail
display("First 3 rows:");
display(ohlcv.Head(3));
display("Last 3 rows:");
display(ohlcv.Tail(3));
```

    First 3 rows:

<!-- Polars DataFrame: (3 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

    Last 3 rows:

<!-- Polars DataFrame: (3 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>66876</td><td>WKL.AS</td><td>2026-03-10</td><td>68.8</td><td>69.16</td><td>66.34</td><td>67.16</td><td>67.16</td><td>1355645</td><td>0</td><td>0</td><td>false</td></tr><tr><td>66877</td><td>WKL.AS</td><td>2026-03-11</td><td>67.5</td><td>69.6</td><td>67.02</td><td>67.22</td><td>67.22</td><td>1142531</td><td>0</td><td>0</td><td>false</td></tr><tr><td>66929</td><td>WKL.AS</td><td>2026-03-12</td><td>67</td><td>67.54</td><td>66.28</td><td>67.32</td><td>67.32</td><td>210379</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

```csharp
// Schema
ohlcv.PrintSchema();
```

    root
     |-- id: Int64
     |-- symbol: String
     |-- date: Date
     |-- open: Float64
     |-- high: Float64
     |-- low: Float64
     |-- close: Float64
     |-- adj_close: Float64
     |-- volume: Int64
     |-- dividends: Float64
     |-- stock_splits: Float64
     |-- is_filled: Boolean

```csharp
// Describe (summary statistics)
ohlcv.Describe()
```

<!-- Polars DataFrame: (9 rows, 10 columns) --><table><thead><tr><th>statistic</th><th>id</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th></tr></thead><tbody><tr><td>count</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td><td>66355</td></tr><tr><td>null_count</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr><tr><td>mean</td><td>33179.7331</td><td>197.0405202</td><td>199.364124</td><td>194.5857816</td><td>197.0349004</td><td>190.4949089</td><td>5942123.691</td><td>0.01175667386</td><td>0.0001720326822</td></tr><tr><td>std</td><td>19158.20139</td><td>363.1504839</td><td>367.8738291</td><td>358.011643</td><td>363.052047</td><td>359.6353012</td><td>16156185.53</td><td>0.2831418842</td><td>0.02271628163</td></tr><tr><td>min</td><td>1</td><td>1.601</td><td>1.6628</td><td>1.5842</td><td>1.6066</td><td>1.2013</td><td>0</td><td>0</td><td>0</td></tr><tr><td>25%</td><td>16590</td><td>29.79</td><td>30.09</td><td>29.47</td><td>29.7899</td><td>28.1461</td><td>509991</td><td>0</td><td>0</td></tr><tr><td>50%</td><td>33178</td><td>70.7</td><td>71.4</td><td>69.89</td><td>70.68</td><td>63.141</td><td>1415896</td><td>0</td><td>0</td></tr><tr><td>75%</td><td>49767</td><td>186</td><td>188</td><td>184</td><td>186.1</td><td>175.2609</td><td>4089463</td><td>0</td><td>0</td></tr><tr><td>max</td><td>66930</td><td>2926</td><td>2957</td><td>2813</td><td>2839</td><td>2802.9382</td><td>376391539</td><td>22.5</td><td>5</td></tr></tbody></table></div>

```csharp
// Null counts per column — use scores_daily which has real nulls
var scoresNulls = DataFrame.ReadCsv(Path.Combine(DATA, "scores_daily.csv"), tryParseDates: true);
var ncCols = scoresNulls.Columns.ToArray();
var ncNames = new List<string>();
var ncCounts = new List<long>();
foreach (var col in ncCols)
{
    var nc = scoresNulls.Column(col).NullCount;
    if (nc > 0) { ncNames.Add(col); ncCounts.Add(nc); }
}

new DataFrame(new Polars.CSharp.Series[]
{
    Polars.CSharp.Series.From("column", ncNames.ToArray()),
    Polars.CSharp.Series.From("null_count", ncCounts.ToArray())
})
```

<!-- Polars DataFrame: (5 rows, 2 columns) --><table><thead><tr><th>column</th><th>null_count</th></tr></thead><tbody><tr><td>pe_zscore</td><td>3</td></tr><tr><td>pb_zscore</td><td>6</td></tr><tr><td>ev_ebitda_zscore</td><td>71</td></tr><tr><td>yield_zscore</td><td>35</td></tr><tr><td>recommendation_mean</td><td>14</td></tr></tbody></table></div>

```csharp
// Estimated memory size (sum of column byte sizes)
long totalBytes = 0;
foreach (var col in ohlcv.Columns)
    totalBytes += ohlcv.Column(col).Length * 8; // rough estimate
display($"Estimated size: ~{totalBytes / 1_048_576.0:F2} MB ({ohlcv.Height} rows x {ohlcv.Width} cols)");
```

    Estimated size: ~6.07 MB (66355 rows x 12 cols)

#### Deedle – Inspect shape, column types, head, tail, and describe

```csharp
// Deedle
var ohlcv = Frame.ReadCsv(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"));

display($"Shape: {ohlcv.RowCount} rows x {ohlcv.ColumnCount} cols");
```

    Shape: 66355 rows x 12 cols

```csharp
// Head and Tail (via FrameModule)
display("First 3 rows:");
display(FrameModule.Take(3, ohlcv));
display("Last 3 rows:");
display(FrameModule.TakeLast(3, ohlcv));
```

    First 3 rows:

<div>
<table>
<thead><th></th><th></th><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></thead><thead><th></th><th></th><th>(int)</th><th>(string)</th><th>(DateTime)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(int)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Boolean)</th></thead>
<tr><td><b>0</b></td><td class="no-wrap">-></td><td>21160</td><td>ABI.BR</td><td>04-Jan-21 0:00:00</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>21161</td><td>ABI.BR</td><td>05-Jan-21 0:00:00</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>21162</td><td>ABI.BR</td><td>06-Jan-21 0:00:00</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>False</td></tr>
</table>
<p><b>3</b> rows x <b>12</b> columns</p><p><b>0</b> missing values</p>
</div>

    Last 3 rows:

<div>
<table>
<thead><th></th><th></th><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></thead><thead><th></th><th></th><th>(int)</th><th>(string)</th><th>(DateTime)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(int)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Boolean)</th></thead>
<tr><td><b>66352</b></td><td class="no-wrap">-></td><td>66876</td><td>WKL.AS</td><td>10-Mar-26 0:00:00</td><td>68.8</td><td>69.16</td><td>66.34</td><td>67.16</td><td>67.16</td><td>1355645</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>66353</b></td><td class="no-wrap">-></td><td>66877</td><td>WKL.AS</td><td>11-Mar-26 0:00:00</td><td>67.5</td><td>69.6</td><td>67.02</td><td>67.22</td><td>67.22</td><td>1142531</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>66354</b></td><td class="no-wrap">-></td><td>66929</td><td>WKL.AS</td><td>12-Mar-26 0:00:00</td><td>67.0</td><td>67.54</td><td>66.28</td><td>67.32</td><td>67.32</td><td>210379</td><td>0.0</td><td>0.0</td><td>False</td></tr>
</table>
<p><b>3</b> rows x <b>12</b> columns</p><p><b>0</b> missing values</p>
</div>

```csharp
// Column names and types
foreach (var (name, type) in ohlcv.ColumnKeys.Zip(ohlcv.ColumnTypes))
    Console.WriteLine($"  {name,-10} : {type.Name}");
```

      id         : Int32
      symbol     : String
      date       : DateTime
      open       : Decimal
      high       : Decimal
      low        : Decimal
      close      : Decimal
      adj_close  : Decimal
      volume     : Int32
      dividends  : Decimal
      stock_splits : Decimal
      is_filled  : Boolean

```csharp
// Describe
ohlcv.Describe()
```

<div>
<table>
<thead><th></th><th></th><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></thead><thead><th></th><th></th><th>(float)</th><th>(obj)</th><th>(obj)</th><th>(float)</th><th>(float)</th><th>(float)</th><th>(float)</th><th>(float)</th><th>(float)</th><th>(float)</th><th>(float)</th><th>(obj)</th></thead>
<tr><td><b>unique</b></td><td class="no-wrap">-></td><td>66355</td><td><missing></td><td><missing></td><td>29671</td><td>31651</td><td>31695</td><td>31505</td><td>57739</td><td>65199</td><td>216</td><td>6</td><td><missing></td></tr><tr><td><b>mean</b></td><td class="no-wrap">-></td><td>33179.733102253034</td><td><missing></td><td><missing></td><td>197.0405202155085</td><td>199.36412400874195</td><td>194.5857815793841</td><td>197.0349003767613</td><td>190.49490887499087</td><td>5942123.6909501925</td><td>0.011756673860296897</td><td>0.000172032682241534</td><td><missing></td></tr><tr><td><b>std</b></td><td class="no-wrap">-></td><td>19158.201385287863</td><td><missing></td><td><missing></td><td>363.15048392741073</td><td>367.8738291376105</td><td>358.0116429653695</td><td>363.0520470243152</td><td>359.6353011698428</td><td>16156185.534944274</td><td>0.28314188424599934</td><td>0.022716281632449882</td><td><missing></td></tr><tr><td><b>min</b></td><td class="no-wrap">-></td><td>1</td><td><missing></td><td><missing></td><td>1.601</td><td>1.6628</td><td>1.5842</td><td>1.6066</td><td>1.2013</td><td>0</td><td>0</td><td>0</td><td><missing></td></tr><tr><td><b>0.25</b></td><td class="no-wrap">-></td><td>16589.5</td><td><missing></td><td><missing></td><td>29.789949999999997</td><td>30.09</td><td>29.47</td><td>29.78745</td><td>28.1434</td><td>509985.5</td><td>0</td><td>0</td><td><missing></td></tr><tr><td><b>0.5</b></td><td class="no-wrap">-></td><td>33178</td><td><missing></td><td><missing></td><td>70.7</td><td>71.4</td><td>69.89</td><td>70.68</td><td>63.141</td><td>1415896</td><td>0</td><td>0</td><td><missing></td></tr><tr><td><b>0.75</b></td><td class="no-wrap">-></td><td>49766.5</td><td><missing></td><td><missing></td><td>185.99</td><td>188</td><td>184</td><td>186.1</td><td>175.2539</td><td>4089299</td><td>0</td><td>0</td><td><missing></td></tr><tr><td><b>max</b></td><td class="no-wrap">-></td><td>66930</td><td><missing></td><td><missing></td><td>2926</td><td>2957</td><td>2813</td><td>2839</td><td>2802.9382</td><td>376391539</td><td>22.5</td><td>5</td><td><missing></td></tr>
</table>
<p><b>8</b> rows x <b>12</b> columns</p><p><b>24</b> missing values</p>
</div>

---
## Edge Cases & Gotchas

#### Polars.NET wraps native Rust memory – types are IDisposable

Polars.NET types (`DataFrame`, `Series`, `LazyFrame`, `PolarsSchema`, `DataType`) wrap native Rust
memory and implement `IDisposable`. For short notebook cells this is fine (GC + finalizer will clean up),
but in production code or loops, use `using` statements to free memory deterministically.

```csharp
using var df = DataFrame.ReadParquet("big.parquet");
// df is disposed when scope exits
```

#### Deedle is F#-first – C# API workarounds

Deedle was designed for F#. The C# API sometimes requires:
- `FrameModule.Take(n, df)` instead of `df.Head(n)`
- `SeriesBuilder<K,V>` instead of a clean constructor
- Explicit type parameters like `frame.GetColumn<double>("col")`
- Casting to `dynamic` for quick column access: `dynamic dfd = df; var col = dfd.Close;`

#### Namespace collision between Polars.CSharp.Series and Deedle.Series

Both libraries define a `Series` type. When both `using Polars.CSharp` and `using Deedle` are active:
- Use `Polars.CSharp.Series.From<T>(...)` for Polars.NET
- Use `Deedle.Series<K,V>` or `SeriesBuilder<K,V>` for Deedle
- The compiler usually resolves correctly (Polars = non-generic, Deedle = generic)

```csharp
// Polars.NET — extract values to .NET types
var s = Polars.CSharp.Series.From("x", new[] { 1, 2, 3 });

// Series metadata as DataFrame
display(new DataFrame(new Polars.CSharp.Series[]
{
    Polars.CSharp.Series.From("property", new[] { "Name", "Length", "DataType", "Value[0]" }),
    Polars.CSharp.Series.From("value", new[] { s.Name, s.Length.ToString(), s.DataTypeName, s.GetValue<int>(0).ToString() })
}));

// Converting to .NET array
var arr = s.ToArray<int>();
display($"As int[]: [{string.Join(", ", arr)}]");

// DataFrame row iteration
var df = DataFrame.FromColumns(new { A = new[] { 1, 2, 3 }, B = new[] { "x", "y", "z" } });
df
```

<!-- Polars DataFrame: (4 rows, 2 columns) --><table><thead><tr><th>property</th><th>value</th></tr></thead><tbody><tr><td>Name</td><td>x</td></tr><tr><td>Length</td><td>3</td></tr><tr><td>DataType</td><td>i32</td></tr><tr><td>Value[0]</td><td>1</td></tr></tbody></table></div>

    As int[]: [1, 2, 3]

<!-- Polars DataFrame: (3 rows, 2 columns) --><table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>x</td></tr><tr><td>2</td><td>y</td></tr><tr><td>3</td><td>z</td></tr></tbody></table></div>

#### Deedle – Extract values, keys, and index from a Series

```csharp
// Deedle – extract values
var s = new[] { 1.0, 2.0, 3.0 }.ToOrdinalSeries();
display($"Value at key 0: {s[0]}");
display($"Values: [{string.Join(", ", s.Values)}]");
display($"Keys:   [{string.Join(", ", s.Keys)}]");
```

    Value at key 0: 1

    Values: [1, 2, 3]

    Keys:   [0, 1, 2]

---
## Comparison Summary — Part 1

| Concept | Polars.NET | Deedle |
|---|---|---|
| **Series creation** | `Series.From<T>("name", arr)` | `arr.ToOrdinalSeries()` or `SeriesBuilder<K,V>` |
| **DataFrame creation** | `DataFrame.FromColumns(new { ... })` | `Frame.FromRecords(new[] { ... })` |
| **From records** | `DataFrame.From(enumerable)` | `Frame.FromRecords(enumerable)` |
| **Read CSV** | `DataFrame.ReadCsv(path)` | `Frame.ReadCsv(path)` |
| **Read Parquet** | `DataFrame.ReadParquet(path)` | Not supported |
| **Read JSON** | `DataFrame.ReadJson(path)` | Not supported |
| **Shape** | `df.Shape` / `df.Height` / `df.Width` | `df.RowCount` / `df.ColumnCount` |
| **Schema** | `df.PrintSchema()` / `df.Schema` | `df.ColumnKeys` + `df.ColumnTypes` |
| **Head / Tail** | `df.Head(n)` / `df.Tail(n)` | `FrameModule.Take(n, df)` / `FrameModule.TakeLast(n, df)` |
| **Describe** | `df.Describe()` | `df.Describe()` |
| **Null count** | `df[col].NullCount` per column | Manual |
| **Memory size** | `df.EstimatedSize()` | Not available |
| **Row index** | None (by design) | `Frame<TRowKey, TColKey>` with typed index |
| **Index alignment** | Explicit joins | Automatic on matching keys |
| **Type casting** | `Col("c").Cast(DataType.X)` | Manual conversion |
| **Null model** | Native Arrow null bitmap | `OptionalValue<T>.Missing` |
| **IDisposable** | Yes (wraps native Rust memory) | No |

---
# Part 2: Reading & Writing Data

---
## Discovering Data Files

#### Polars.NET – List all data files with their sizes

```csharp
// List all data files with sizes
var dataDir = new DirectoryInfo(DATA);
var files = dataDir.GetFiles("*.*")
    .Where(f => new[] { ".csv", ".parquet", ".json" }.Contains(f.Extension.ToLower()))
    .OrderBy(f => f.Name)
    .Select(f => new { f.Name, SizeKB = f.Length / 1024.0 });

Console.WriteLine($"{"File",-45} {"Size (KB)",10}");
Console.WriteLine(new string('-', 56));
foreach (var f in files)
    Console.WriteLine($"{f.Name,-45} {f.SizeKB,10:F1}");
```

    File                                           Size (KB)
    --------------------------------------------------------
    bench_large.csv                                1246870.5
    bench_large.parquet                             464593.8
    bench_medium.csv                                197738.9
    bench_medium.parquet                             57876.7
    bench_small.csv                                   4745.0
    bench_small.parquet                               2173.2
    compression_results_cs.json                          0.8
    compression_results.json                             5.5
    dim_country.csv                                      2.8
    dim_country.json                                    13.0
    dim_country.parquet                                  5.0
    dim_index.csv                                        0.2
    dim_index.json                                       0.6
    dim_index.parquet                                    3.5
    duckdb_top10_export.parquet                          1.2
    eurostoxx50_ohlcv.csv                             5162.0
    eurostoxx50_ohlcv.json                           17668.3
    eurostoxx50_ohlcv.parquet                         2426.7
    index_dim.csv                                      278.0
    index_dim.json                                     371.8
    index_dim.parquet                                  145.0
    index_performance.csv                              940.1
    index_performance.json                            2432.6
    index_performance.parquet                          344.9
    large_bq_insert.csv                               5048.3
    large_sql_insert.csv                              1849.1
    large_upload.csv                               1246870.5
    medium_upload.csv                               197738.9
    oil20_ohlcv.csv                                   1849.1
    oil20_ohlcv.json                                  6511.6
    oil20_ohlcv.parquet                                882.4
    pulse.csv                                            6.8
    pulse.json                                          20.8
    pulse.parquet                                       16.4
    scores_daily.csv                                   236.6
    scores_daily.json                                  541.0
    scores_daily.parquet                               117.4
    scores_quarterly.csv                                49.0
    scores_quarterly.json                              148.1
    scores_quarterly.parquet                            33.6
    signals_daily.csv                                   84.6
    signals_daily.json                                 270.5
    signals_daily.parquet                               59.4
    signals_quarterly.csv                               28.4
    signals_quarterly.json                             112.7
    signals_quarterly.parquet                           29.2
    small_bq_insert.csv                                940.1
    small_sql_insert.csv                               236.6
    small_upload.csv                                  9893.4
    stoxxusa50_ohlcv.csv                              5048.3
    stoxxusa50_ohlcv.json                            17318.1
    stoxxusa50_ohlcv.parquet                          2522.3
    trading_calendar.csv                              1498.8
    trading_calendar.json                             7342.8
    trading_calendar.parquet                            34.8
    upload_results_cs.json                               6.6
    upload_results.json                                  9.0
    vm_transfer_results_cs.json                          4.1
    vm_transfer_results.json                             4.1
    vm_upload_results_cs.json                            6.6
    vm_upload_results.json                               9.5

---
## Reading CSV

> [!warning] Polars.NET ReadCsv UTF-8 only
>
> Polars.NET `ReadCsv` only supports UTF-8 encoding. Files from legacy systems (BCP exports, Excel CSV) may use Latin-1 or Windows-1252
> encoding. Polars.NET raises an error on non-UTF-8 bytes — preprocess with
> `File.ReadAllText(path, Encoding.Latin1)` and write to a temp file, or use
> `CsvReader` from `CsvHelper` which supports arbitrary encodings.

> [!tip] tryParseDates: true enables automatic date
>
> `tryParseDates: true` enables automatic date detection. Without it, date columns
> remain as strings. Always set this for data pipeline CSV reads to avoid downstream
> type-casting issues.

#### Polars.NET – Read CSV files with DataFrame.ReadCsv
```csharp
// Polars.NET – basic CSV read
var df = DataFrame.ReadCsv(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"),
    tryParseDates: true);

display($"Shape: {df.Shape}");
df.Head(3)
```

    Shape: (66355, 12)

<!-- Polars DataFrame: (3 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

```csharp
// Polars.NET – with options
var df = DataFrame.ReadCsv(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"),
    tryParseDates: true,
    nRows: 100,
    nullValues: new[] { "", "NA", "N/A" }
);
display($"Shape: {df.Shape}");
df.PrintSchema();
```

    Shape: (100, 12)

    root
     |-- id: Int64
     |-- symbol: String
     |-- date: Date
     |-- open: Float64
     |-- high: Float64
     |-- low: Float64
     |-- close: Float64
     |-- adj_close: Float64
     |-- volume: Int64
     |-- dividends: Float64
     |-- stock_splits: Float64
     |-- is_filled: Boolean

#### Polars.NET – Lazy scan CSV with LazyFrame.ScanCsv
```csharp
// Polars.NET – lazy scan CSV (reads schema only, data loaded on Collect)
var lf = LazyFrame.ScanCsv(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"),
    tryParseDates: true);

display("Query plan:");
Console.WriteLine(lf.Explain(optimized: true));

// Materialize with a filter – only matching rows are loaded
var result = lf
    .Filter(Col("symbol") == Lit("ASML.AS"))
    .Collect()
    .Head(5);
result
```

    Query plan:

    Csv SCAN [../data/eurostoxx50_ohlcv.csv]
    PROJECT */12 COLUMNS
    ESTIMATED ROWS: 66910

<!-- Polars DataFrame: (5 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>1</td><td>ASML.AS</td><td>2021-01-04</td><td>404</td><td>411</td><td>402.25</td><td>406.25</td><td>387.709</td><td>789502</td><td>0</td><td>0</td><td>false</td></tr><tr><td>2</td><td>ASML.AS</td><td>2021-01-05</td><td>406.55</td><td>412.05</td><td>401.15</td><td>406.9</td><td>388.3294</td><td>798787</td><td>0</td><td>0</td><td>false</td></tr><tr><td>3</td><td>ASML.AS</td><td>2021-01-06</td><td>406.8</td><td>407.2</td><td>399.2</td><td>402.85</td><td>384.4644</td><td>875711</td><td>0</td><td>0</td><td>false</td></tr><tr><td>4</td><td>ASML.AS</td><td>2021-01-07</td><td>404.8</td><td>407.8</td><td>400.35</td><td>403.9</td><td>385.4664</td><td>874780</td><td>0</td><td>0</td><td>false</td></tr><tr><td>5</td><td>ASML.AS</td><td>2021-01-08</td><td>414.25</td><td>419.1</td><td>413.4</td><td>416.05</td><td>397.0618</td><td>975243</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

#### Deedle – Read CSV files with Frame.ReadCsv
```csharp
// Deedle – basic CSV read
var df = Frame.ReadCsv(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"));

display($"Shape: {df.RowCount} x {df.ColumnCount}");
FrameModule.Take(3, df)
```

    Shape: 66355 x 12

<div>
<table>
<thead><th></th><th></th><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></thead><thead><th></th><th></th><th>(int)</th><th>(string)</th><th>(DateTime)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(int)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Boolean)</th></thead>
<tr><td><b>0</b></td><td class="no-wrap">-></td><td>21160</td><td>ABI.BR</td><td>04-Jan-21 0:00:00</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>21161</td><td>ABI.BR</td><td>05-Jan-21 0:00:00</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>21162</td><td>ABI.BR</td><td>06-Jan-21 0:00:00</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>False</td></tr>
</table>
<p><b>3</b> rows x <b>12</b> columns</p><p><b>0</b> missing values</p>
</div>

```csharp
// Deedle – with options
var df = Frame.ReadCsv(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"),
    inferRows: 1000,
    maxRows: 100,
    missingValues: new[] { "", "NA", "N/A", "NaN" }
);
display($"Shape: {df.RowCount} x {df.ColumnCount}");
```

    Shape: 100 x 12

---
## Reading JSON

#### Polars.NET – Read JSON files with DataFrame.ReadJson
```csharp
// Polars.NET – read JSON
var df = DataFrame.ReadJson(Path.Combine(DATA, "eurostoxx50_ohlcv.json"));
display($"Shape: {df.Shape}");
df.Head(3)
```

    Shape: (66355, 12)

<!-- Polars DataFrame: (3 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04T00:00:00.000</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05T00:00:00.000</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06T00:00:00.000</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

> [!info] Polars.NET — NDJSON (newline-delimited JSON)
>
> ```csharp
> var df = DataFrame.ReadJson(path, jsonFormat: JsonFormat.JsonLines);
> var lf = LazyFrame.ScanNdjson(path);  // lazy scan
> ```

#### Deedle – Read JSON via System.Text.Json workaround

```csharp
// Deedle — JSON is NOT natively supported.
// Workaround: deserialize with System.Text.Json, then Frame.FromRecords()

var jsonText = File.ReadAllText(Path.Combine(DATA, "dim_country.json"));
var jsonDoc = JsonDocument.Parse(jsonText);

int count = 0;
if (jsonDoc.RootElement.ValueKind == JsonValueKind.Array)
    count = jsonDoc.RootElement.GetArrayLength();

Console.WriteLine($"Parsed {count} JSON records");
Console.WriteLine("Use Frame.FromRecords() with a typed class to create a Deedle Frame.");
```

    Parsed 212 JSON records
    Use Frame.FromRecords() with a typed class to create a Deedle Frame.

---
## Reading Parquet

#### Polars.NET – Read Parquet files with DataFrame.ReadParquet
```csharp
// Polars.NET – eager read Parquet
var df = DataFrame.ReadParquet(Path.Combine(DATA, "eurostoxx50_ohlcv.parquet"));
display($"Shape: {df.Shape}");
df.Head(3)
```

    Shape: (66355, 12)

<!-- Polars DataFrame: (3 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

```csharp
// Polars.NET – column projection (only load specific columns)
var df = DataFrame.ReadParquet(Path.Combine(DATA, "eurostoxx50_ohlcv.parquet"),
    columns: new[] { "date", "symbol", "close" });
display($"Shape: {df.Shape}");
df.PrintSchema();
```

    Shape: (66355, 3)

    root
     |-- date: Date
     |-- symbol: String
     |-- close: Float64

#### Polars.NET – Lazy scan Parquet with predicate and projection pushdown

```csharp
// Polars.NET – lazy scan Parquet (predicate & projection pushdown)
var lf = LazyFrame.ScanParquet(Path.Combine(DATA, "eurostoxx50_ohlcv.parquet"));

var result = lf
    .Select("date", "symbol", "close")
    .Filter(Col("symbol") == Lit("SAP.DE"))
    .Sort("date")
    .Collect();

display($"Shape: {result.Shape}");
result.Head(5)
```

    Shape: (1324, 3)

<!-- Polars DataFrame: (5 rows, 3 columns) --><table><thead><tr><th>date</th><th>symbol</th><th>close</th></tr></thead><tbody><tr><td>2021-01-04</td><td>SAP.DE</td><td>105.32</td></tr><tr><td>2021-01-05</td><td>SAP.DE</td><td>105.04</td></tr><tr><td>2021-01-06</td><td>SAP.DE</td><td>105.48</td></tr><tr><td>2021-01-07</td><td>SAP.DE</td><td>104.52</td></tr><tr><td>2021-01-08</td><td>SAP.DE</td><td>106.18</td></tr></tbody></table></div>

#### Deedle – Parquet is not natively supported

```csharp
// Deedle – Parquet is NOT natively supported.
// Options:
//   1. Use Polars.NET to read, then convert via AsDataReader()
//   2. Use ParquetSharp + Microsoft.Data.Analysis bridge
//   3. Export to CSV first
Console.WriteLine("Deedle cannot read Parquet natively. Use Polars.NET and convert if needed.");
```

    Deedle cannot read Parquet natively. Use Polars.NET and convert if needed.

---
## Loading All Datasets

#### Polars.NET – Load all Parquet datasets from the data directory

```csharp
// Polars.NET – load all .parquet files from the data directory
var parquetFiles = Directory.GetFiles(DATA, "*.parquet")
    .Where(f => !Path.GetFileName(f).StartsWith("bench_"))
    .OrderBy(f => f);

foreach (var file in parquetFiles)
{
    var df = DataFrame.ReadParquet(file);
    Console.WriteLine($"  {Path.GetFileName(file),-40} {df.Shape}");
}
```

      dim_country.parquet                      (212, 2)
      dim_index.parquet                        (4, 5)
      duckdb_top10_export.parquet              (10, 4)
      eurostoxx50_ohlcv.parquet                (66355, 12)
      index_dim.parquet                        (169, 26)
      index_performance.parquet                (5281, 15)
      oil20_ohlcv.parquet                      (24738, 12)
      pulse.parquet                            (40, 20)
      scores_daily.parquet                     (466, 36)
      scores_quarterly.parquet                 (170, 29)
      signals_daily.parquet                    (466, 19)
      signals_quarterly.parquet                (177, 22)
      stoxxusa50_ohlcv.parquet                 (65100, 12)
      trading_calendar.parquet                 (29335, 11)

---
## Parameter Deep-Dives

#### Polars.NET – Override column types at read time with schema overrides

Force specific columns to particular types at read time.

```csharp
// Polars.NET – schema overrides
var schema = new PolarsSchema()
    .Add("volume", DataType.Float64);

var df = DataFrame.ReadCsv(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"),
    tryParseDates: true,
    dtypeOverride: schema);

df.PrintSchema();
```

    root
     |-- id: Int64
     |-- symbol: String
     |-- date: Date
     |-- open: Float64
     |-- high: Float64
     |-- low: Float64
     |-- close: Float64
     |-- adj_close: Float64
     |-- volume: Float64
     |-- dividends: Float64
     |-- stock_splits: Float64
     |-- is_filled: Boolean

#### Polars.NET – Specify which string values to interpret as null

Specify which strings should be interpreted as null.

```csharp
// Polars.NET — custom null values (scores_daily has real nulls)
var dfNulls = DataFrame.ReadCsv(Path.Combine(DATA, "scores_daily.csv"),
    nullValues: new[] { "", "NA", "N/A", "#N/A", "-", "null" },
    tryParseDates: true);

// Build a null-count summary DataFrame (only columns with nulls)
var ncNames = new List<string>();
var ncCounts = new List<long>();
foreach (var col in dfNulls.Columns)
{
    var nc = dfNulls.Column(col).NullCount;
    if (nc > 0) { ncNames.Add(col); ncCounts.Add(nc); }
}

display($"scores_daily: {dfNulls.Shape} — {ncNames.Count} columns with nulls");
new DataFrame(new Polars.CSharp.Series[]
{
    Polars.CSharp.Series.From("column", ncNames.ToArray()),
    Polars.CSharp.Series.From("null_count", ncCounts.ToArray())
})
```

    scores_daily: (466, 36) — 5 columns with nulls

<!-- Polars DataFrame: (5 rows, 2 columns) --><table><thead><tr><th>column</th><th>null_count</th></tr></thead><tbody><tr><td>pe_zscore</td><td>3</td></tr><tr><td>pb_zscore</td><td>6</td></tr><tr><td>ev_ebitda_zscore</td><td>71</td></tr><tr><td>yield_zscore</td><td>35</td></tr><tr><td>recommendation_mean</td><td>14</td></tr></tbody></table></div>

#### Polars.NET – Use custom column separators and delimiters

```csharp
// Polars.NET — custom separator
// TSV = tab-separated values, SSV = semicolon-separated values.
// ReadCsv defaults to comma (',') so tab/semicolon files parse as a single column
// unless you specify the actual delimiter via the separator parameter.
var dfTsv = DataFrame.ReadCsv(Path.Combine(DATA, "dim_country.tsv"), separator: '\t');
display($"TSV: {dfTsv.Shape}");
display(dfTsv.Head(3));

var dfSsv = DataFrame.ReadCsv(Path.Combine(DATA, "dim_country.ssv"), separator: ';');
display($"SSV: {dfSsv.Shape}");
dfSsv.Head(3)
```

    TSV: (212, 2)

<!-- Polars DataFrame: (3 rows, 2 columns) --><table><thead><tr><th>country_name</th><th>iso_alpha2</th></tr></thead><tbody><tr><td>Afghanistan</td><td>AF</td></tr><tr><td>Albania</td><td>AL</td></tr><tr><td>Algeria</td><td>DZ</td></tr></tbody></table></div>

    SSV: (212, 2)

<!-- Polars DataFrame: (3 rows, 2 columns) --><table><thead><tr><th>country_name</th><th>iso_alpha2</th></tr></thead><tbody><tr><td>Afghanistan</td><td>AF</td></tr><tr><td>Albania</td><td>AL</td></tr><tr><td>Algeria</td><td>DZ</td></tr></tbody></table></div>

#### Deedle – Use custom separators with Frame.ReadCsv
```csharp
// Deedle — custom separator
var dfTsv = Frame.ReadCsv(Path.Combine(DATA, "dim_country.tsv"), separators: "\t");
display($"TSV: {dfTsv.RowCount} rows x {dfTsv.ColumnCount} cols");
dfTsv.Rows[Enumerable.Range(0, 3)]
```

    TSV: 212 rows x 2 cols

<div>
<table>
<thead><th></th><th></th><th>country_name</th><th>iso_alpha2</th></thead><thead><th></th><th></th><th>(string)</th><th>(string)</th></thead>
<tr><td><b>0</b></td><td class="no-wrap">-></td><td>Afghanistan</td><td>AF</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>Albania</td><td>AL</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>Algeria</td><td>DZ</td></tr>
</table>
<p><b>3</b> rows x <b>2</b> columns</p><p><b>0</b> missing values</p>
</div>

---
## Writing Data

#### Polars.NET – Write DataFrames to CSV, Parquet, and JSON

```csharp
// Polars.NET – write to all formats
var df = DataFrame.ReadParquet(Path.Combine(DATA, "dim_country.parquet"));

var outDir = Path.Combine(DATA, "_output");
Directory.CreateDirectory(outDir);

// CSV
df.WriteCsv(Path.Combine(outDir, "dim_country_out.csv"));

// Parquet
df.WriteParquet(Path.Combine(outDir, "dim_country_out.parquet"));

// JSON
df.WriteJson(Path.Combine(outDir, "dim_country_out.json"));

// Show file sizes
foreach (var f in Directory.GetFiles(outDir))
    Console.WriteLine($"  {Path.GetFileName(f),-35} {new FileInfo(f).Length / 1024.0,8:F1} KB");
```

      dim_country_out.csv                      3.5 KB
      dim_country_out.json                     9.6 KB
      dim_country_out.parquet                  3.4 KB

#### Deedle – Write DataFrames to CSV with SaveCsv
```csharp
// Deedle – write CSV
var df = Frame.ReadCsv(Path.Combine(DATA, "dim_country.csv"));
var outPath = Path.Combine(DATA, "_output", "dim_country_deedle.csv");
df.SaveCsv(outPath);
Console.WriteLine($"Saved: {outPath} ({new FileInfo(outPath).Length / 1024.0:F1} KB)");
```

    Saved: ..\data\_output\dim_country_deedle.csv (2.9 KB)

```csharp
// Cleanup
var outDir = Path.Combine(DATA, "_output");
if (Directory.Exists(outDir)) Directory.Delete(outDir, true);
Console.WriteLine("Cleaned up output files.");
```

    Cleaned up output files.

---
## Lazy Scanning vs Eager Reading (Polars.NET only)

Polars.NET's lazy API defers computation until `.Collect()` is called.
The query optimizer can:
- **Predicate pushdown**: filter rows at the file level (Parquet)
- **Projection pushdown**: skip unused columns entirely
- **Common subexpression elimination**: avoid redundant work

#### Polars.NET – Compare eager reading vs lazy scanning performance

```csharp
// Eager: reads ALL data into memory, THEN filters
var sw = System.Diagnostics.Stopwatch.StartNew();
var eager = DataFrame.ReadParquet(Path.Combine(DATA, "eurostoxx50_ohlcv.parquet"))
    .Filter(Col("symbol") == Lit("ASML.AS"))
    .Select("date", "close");
sw.Stop();
display($"Eager: {eager.Height} rows in {sw.ElapsedMilliseconds} ms");
```

    Eager: 1331 rows in 6 ms

```csharp
// Lazy: builds a query plan, optimizes, then reads only what's needed
var sw = System.Diagnostics.Stopwatch.StartNew();
var lazy = LazyFrame.ScanParquet(Path.Combine(DATA, "eurostoxx50_ohlcv.parquet"))
    .Filter(Col("symbol") == Lit("ASML.AS"))
    .Select("date", "close")
    .Collect();
sw.Stop();
display($"Lazy:  {lazy.Height} rows in {sw.ElapsedMilliseconds} ms");
```

    Lazy:  1331 rows in 1 ms

```csharp
// Inspect the optimized query plan
var plan = LazyFrame.ScanParquet(Path.Combine(DATA, "eurostoxx50_ohlcv.parquet"))
    .Filter(Col("symbol") == Lit("ASML.AS"))
    .Select("date", "close")
    .Explain(optimized: true);

Console.WriteLine("Optimized query plan:");
Console.WriteLine(plan);
```

    Optimized query plan:
    simple π 2/2 ["date", "close"]
      Parquet SCAN [../data/eurostoxx50_ohlcv.parquet]
      PROJECT 3/12 COLUMNS
      SELECTION: [(col("symbol")) == ("ASML.AS")]
      ESTIMATED ROWS: 66355

---
## Format Comparison

#### Polars.NET – Compare file sizes across CSV, JSON, and Parquet formats

```csharp
// Compare file sizes across formats as a Polars DataFrame
var baseName = "eurostoxx50_ohlcv";
var formats = new[] { "csv", "json", "parquet" };
var fmtNames = new List<string>();
var fmtSizes = new List<double>();

foreach (var fmt in formats)
{
    var path = Path.Combine(DATA, $"{baseName}.{fmt}");
    if (File.Exists(path))
    {
        fmtNames.Add(fmt);
        fmtSizes.Add(Math.Round(new FileInfo(path).Length / 1024.0, 1));
    }
}

new DataFrame(new Polars.CSharp.Series[]
{
    Polars.CSharp.Series.From("format", fmtNames.ToArray()),
    Polars.CSharp.Series.From("size_kb", fmtSizes.ToArray())
})
```

<!-- Polars DataFrame: (3 rows, 2 columns) --><table><thead><tr><th>format</th><th>size_kb</th></tr></thead><tbody><tr><td>csv</td><td>5162</td></tr><tr><td>json</td><td>17668.3</td></tr><tr><td>parquet</td><td>2426.7</td></tr></tbody></table></div>

#### Polars.NET – Benchmark read performance across formats

```csharp
// Read performance comparison (Polars.NET) as a DataFrame
var path = Path.Combine(DATA, "eurostoxx50_ohlcv");
var benchFormats = new List<string>();
var benchTimes = new List<double>();

foreach (var (label, action) in new (string, Func<DataFrame>)[]
{
    ("CSV",     () => DataFrame.ReadCsv(path + ".csv", tryParseDates: true)),
    ("JSON",    () => DataFrame.ReadJson(path + ".json")),
    ("Parquet", () => DataFrame.ReadParquet(path + ".parquet")),
})
{
    var sw = System.Diagnostics.Stopwatch.StartNew();
    for (int j = 0; j < 5; j++) { var _ = action(); }
    sw.Stop();
    benchFormats.Add(label);
    benchTimes.Add(Math.Round(sw.ElapsedMilliseconds / 5.0, 1));
}

new DataFrame(new Polars.CSharp.Series[]
{
    Polars.CSharp.Series.From("format", benchFormats.ToArray()),
    Polars.CSharp.Series.From("avg_ms", benchTimes.ToArray())
})
```

<!-- Polars DataFrame: (3 rows, 2 columns) --><table><thead><tr><th>format</th><th>avg_ms</th></tr></thead><tbody><tr><td>CSV</td><td>5.2</td></tr><tr><td>JSON</td><td>41.8</td></tr><tr><td>Parquet</td><td>4</td></tr></tbody></table></div>

---
## Gotchas & Tips

#### Polars.NET – Parse date strings into proper date types

Polars.NET: use `tryParseDates: true` in `ReadCsv` or parse strings explicitly with `.Str.ToDate()`.
Deedle: dates are read as strings by default – use `DateTime.Parse` in a column transform.

```csharp
// Polars.NET – parse dates from strings
var df = DataFrame.FromColumns(new
{
    DateStr = new[] { "2024-01-02", "2024-01-03", "2024-01-04" },
    Value   = new[] { 100.0, 102.5, 101.8 },
});

var withDate = df.WithColumns(
    Col("DateStr").Str.ToDate("%Y-%m-%d").Alias("Date")
);
withDate.PrintSchema();
withDate
```

    root
     |-- DateStr: String
     |-- Value: Float64
     |-- Date: Date

<!-- Polars DataFrame: (3 rows, 3 columns) --><table><thead><tr><th>DateStr</th><th>Value</th><th>Date</th></tr></thead><tbody><tr><td>2024-01-02</td><td>100</td><td>2024-01-02</td></tr><tr><td>2024-01-03</td><td>102.5</td><td>2024-01-03</td></tr><tr><td>2024-01-04</td><td>101.8</td><td>2024-01-04</td></tr></tbody></table></div>

#### Polars.NET – Use Categorical type for low-cardinality string columns

For columns with low cardinality (few unique values like "sector", "country"), use `Categorical` type
in Polars.NET for significantly lower memory usage and faster group-by/filter operations.

```csharp
// Polars.NET – cast to Categorical for memory savings
var df = DataFrame.ReadParquet(Path.Combine(DATA, "eurostoxx50_ohlcv.parquet"));

display($"Before: {df.Height} rows x {df.Width} cols");

var optimized = df.WithColumns(
    Col("symbol").Cast(DataType.Categorical)
);

display("Cast symbol to Categorical – reduces memory for repeated string values.");
optimized.PrintSchema();
```

    Before: 66355 rows x 12 cols

    Cast symbol to Categorical – reduces memory for repeated string values.

    root
     |-- id: Int64
     |-- symbol: Categorical
     |-- date: Date
     |-- open: Float64
     |-- high: Float64
     |-- low: Float64
     |-- close: Float64
     |-- adj_close: Float64
     |-- volume: Int64
     |-- dividends: Float64
     |-- stock_splits: Float64
     |-- is_filled: Boolean

---
## Comparison Summary – Part 2

| Operation | Polars.NET | Deedle |
|---|---|---|
| **Read CSV** | `DataFrame.ReadCsv(path, tryParseDates: true)` | `Frame.ReadCsv(path)` |
| **Read Parquet** | `DataFrame.ReadParquet(path)` | Not supported |
| **Read JSON** | `DataFrame.ReadJson(path)` | Not supported (use System.Text.Json) |
| **Lazy scan CSV** | `LazyFrame.ScanCsv(path)` | Not supported (eager only) |
| **Lazy scan Parquet** | `LazyFrame.ScanParquet(path)` | Not supported |
| **Write CSV** | `df.WriteCsv(path)` | `df.SaveCsv(path)` |
| **Write Parquet** | `df.WriteParquet(path, compression: ...)` | Not supported |
| **Write JSON** | `df.WriteJson(path)` | `df.SaveJson()` (limited) |
| **Separator** | `separator: ';'` (char) | `separators: ";"` (string) |
| **Null values** | `nullValues: new[] { "NA", "" }` | `missingValues: new[] { "NA" }` |
| **Schema override** | `dtypeOverride: PolarsSchema` | `schema: "col=type,..."` |
| **Date parsing** | `tryParseDates: true` | Manual `DateTime.Parse` |
| **Query optimization** | Predicate + projection pushdown | None |
| **Streaming** | `lf.Collect(useStreaming: true)` | None |

---

#### Key takeaways

1. **Polars.NET** is the clear choice for I/O – it supports CSV, Parquet, JSON, NDJSON, IPC, Excel, Avro, and Delta Lake with lazy scanning and query optimization.
2. **Deedle** only supports CSV natively. For other formats, use Polars.NET to read and convert via `AsDataReader()`.
3. **Always prefer Parquet** for analytical workloads – smallest files, fastest reads, full type preservation.
4. **Lazy scanning** (`LazyFrame.ScanParquet`) is faster than eager reading when you only need a subset of rows/columns.
5. **Categorical types** save memory for low-cardinality string columns.
