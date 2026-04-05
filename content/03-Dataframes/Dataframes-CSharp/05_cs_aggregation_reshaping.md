---
title: "05. Aggregation & Reshaping - C#"
tags: [csharp, deedle, polars, dataframes]
aliases:
  - groupby, window functions, joins, pivot, melt
description: "Polars.NET / C# DataFrames reference 05/10 — Aggregation & Reshaping (groupby, windows, joins, pivot, melt). Executable examples with cell outputs. See [05_py_aggregation_reshaping](https://alp78.github.io/elysium/03-Dataframes/Dataframes-Python/05_py_aggregation_reshaping) for the Python equivalent."
created: 2026-03-27
updated: 2026-03-27
status: complete
---

# 05 — Aggregation & Reshaping

> [!quote]
> "Statistics are like bikinis. What they reveal is suggestive, but what they conceal is vital."
>
> — **Aaron Levenstein**

Polars.NET vs Deedle: Group-by, aggregation, joins, concat, pivot, melt.

---
## Setup

### Warning Suppression

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
```

### NuGet Packages and Imports

#### Polars.NET / Deedle | Install NuGet packages

Install Polars.NET and Deedle via NuGet in .NET Interactive. The formatter registration renders Polars DataFrames and Series as HTML tables in the notebook output, making output cells readable.

```csharp
#r "nuget: Polars.NET, 0.4.0"
#r "nuget: Polars.NET.Native.win-x64, 0.4.0"
#r "nuget: Deedle, 4.0.1"
#r "nuget: Deedle.Interactive, 3.0.0"

using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using Polars.CSharp;
using static Polars.CSharp.Polars;
using Deedle;
using Microsoft.DotNet.Interactive.Formatting;

System.Runtime.Loader.AssemblyLoadContext.Default.Resolving += (ctx, name) =>
{
    if (name.Name == "FSharp.Core")
        return AppDomain.CurrentDomain.GetAssemblies()
            .FirstOrDefault(a => a.GetName().Name == "FSharp.Core");
    return null;
};

Formatter.Register<DataFrame>((df, writer) =>
{
    var html = df.ToHtml();
    // Strip surrounding quotes from Polars string values in HTML
    html = System.Text.RegularExpressions.Regex.Replace(html, @"(>|>)(.+?)(<|<)", @"$1$2$3");
    html = System.Text.RegularExpressions.Regex.Replace(html, @">""(.+?)""<", @">$1<");
    var css = """
        """;
    writer.Write(css + html);
}, "text/html");
Formatter.Register<Polars.CSharp.Series>((s, writer) =>
    writer.Write($"<pre style='font-size:14px'>{s}</pre>"), "text/html");

var DATA = Path.Combine("..", "data");
Console.WriteLine($"Data directory: {Path.GetFullPath(DATA)}");
```

    Data directory: c:\Users\aperi\DEV\LANG\data

### Dataset Loading

#### Polars.NET / Deedle | Load datasets

Load the same CSV files into both Polars.NET and Deedle. This file uses two datasets: `eurostoxx50_ohlcv.csv` (~66K daily OHLCV rows) and `dim_index.csv` (4-row dimension table). Loading both libraries side-by-side lets us verify output parity.

```csharp
// Load datasets
var dfP = DataFrame.ReadCsv(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"), tryParseDates: true);
var dimP = DataFrame.ReadCsv(Path.Combine(DATA, "dim_index.csv"));
var dfD = Frame.ReadCsv(Path.Combine(DATA, "eurostoxx50_ohlcv.csv"));
var dimD = Frame.ReadCsv(Path.Combine(DATA, "dim_index.csv"));
display($"OHLCV — Polars: {dfP.Shape}  |  Deedle: {dfD.RowCount} x {dfD.ColumnCount}");
display($"DimIndex — Polars: {dimP.Shape}  |  Deedle: {dimD.RowCount} x {dimD.ColumnCount}");
```

    OHLCV — Polars: (66355, 12)  |  Deedle: 66355 x 12

    DimIndex — Polars: (4, 5)  |  Deedle: 4 x 5

### Exchange Dimension Construction

#### Polars.NET | Build exchange dimension table

Build a small 7-row lookup mapping exchange suffix codes (`.BR`, `.DE`, etc.) to exchange name and country. Also derives a `suffix` column on the OHLCV frame for join keys used in the Joins section below.

```csharp
// Polars.NET — Build an exchange lookup from symbol suffixes
// Symbols like ABI.BR, AD.AS, ADS.DE encode their exchange
var exchangeData = new Dictionary<string, (string name, string country)>
{
    [".BR"]  = ("Euronext Brussels", "Belgium"),
    [".AS"]  = ("Euronext Amsterdam", "Netherlands"),
    [".DE"]  = ("XETRA Frankfurt", "Germany"),
    [".PA"]  = ("Euronext Paris", "France"),
    [".MC"]  = ("Bolsa de Madrid", "Spain"),
    [".MI"]  = ("Borsa Italiana", "Italy"),
    [".HE"]  = ("Nasdaq Helsinki", "Finland")
};

var suffixes = exchangeData.Keys.ToArray();
var names = exchangeData.Values.Select(v => v.name).ToArray();
var countries = exchangeData.Values.Select(v => v.country).ToArray();

var dimExP = new DataFrame(new Polars.CSharp.Series[]
{
    Polars.CSharp.Series.From("suffix", suffixes),
    Polars.CSharp.Series.From("exchange_name", names),
    Polars.CSharp.Series.From("country", countries)
});

// Add a suffix column to OHLCV for joining
var symbolsArr = dfP.Column("symbol").ToArray<string>();
var suffixArr = symbolsArr.Select(s => "." + s.Split('.').Last()).ToArray();
var suffixSeries = Polars.CSharp.Series.From("suffix", suffixArr);
var dfPWithSuffix = dfP.HStack(suffixSeries);

dimExP
```

<!-- Polars DataFrame: (7 rows, 3 columns) --><table><thead><tr><th>suffix</th><th>exchange_name</th><th>country</th></tr></thead><tbody><tr><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td>.AS</td><td>Euronext Amsterdam</td><td>Netherlands</td></tr><tr><td>.DE</td><td>XETRA Frankfurt</td><td>Germany</td></tr><tr><td>.PA</td><td>Euronext Paris</td><td>France</td></tr><tr><td>.MC</td><td>Bolsa de Madrid</td><td>Spain</td></tr><tr><td>.MI</td><td>Borsa Italiana</td><td>Italy</td></tr><tr><td>.HE</td><td>Nasdaq Helsinki</td><td>Finland</td></tr></tbody></table></div>

#### Deedle | Build exchange dimension frame

Deedle equivalent of the exchange dimension table, built with `FrameBuilder.Columns`. Deedle requires explicit integer row keys rather than a keyless column store.

```csharp
// Deedle — Build matching exchange dimension frame
var dimExD = new FrameBuilder.Columns<int, string>()
{
    { "suffix", new SeriesBuilder<int, string>()
        { { 0, ".BR" }, { 1, ".AS" }, { 2, ".DE" }, { 3, ".PA" }, { 4, ".MC" }, { 5, ".MI" }, { 6, ".HE" } }.Series },
    { "exchange_name", new SeriesBuilder<int, string>()
        { { 0, "Euronext Brussels" }, { 1, "Euronext Amsterdam" }, { 2, "XETRA Frankfurt" }, { 3, "Euronext Paris" }, { 4, "Bolsa de Madrid" }, { 5, "Borsa Italiana" }, { 6, "Nasdaq Helsinki" } }.Series },
    { "country", new SeriesBuilder<int, string>()
        { { 0, "Belgium" }, { 1, "Netherlands" }, { 2, "Germany" }, { 3, "France" }, { 4, "Spain" }, { 5, "Italy" }, { 6, "Finland" } }.Series }
}.Frame;

// Add suffix column to Deedle frame
var deedleSymbols = dfD.GetColumn<string>("symbol");
var deedleSuffixes = new SeriesBuilder<int, string>();
foreach (var obs in deedleSymbols.Observations)
    deedleSuffixes.Add(obs.Key, "." + obs.Value.Split('.').Last());
var dfDWithSuffix = dfD.Clone();
dfDWithSuffix.AddColumn("suffix", deedleSuffixes.Series);

dimExD
```

<div>

<table>

<thead><th></th><th></th><th>suffix</th><th>exchange_name</th><th>country</th></thead><thead><th></th><th></th><th>(string)</th><th>(string)</th><th>(string)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>.AS</td><td>Euronext Amsterdam</td><td>Netherlands</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>.DE</td><td>XETRA Frankfurt</td><td>Germany</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>.PA</td><td>Euronext Paris</td><td>France</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>.MC</td><td>Bolsa de Madrid</td><td>Spain</td></tr><tr><td><b>5</b></td><td class="no-wrap">-></td><td>.MI</td><td>Borsa Italiana</td><td>Italy</td></tr><tr><td><b>6</b></td><td class="no-wrap">-></td><td>.HE</td><td>Nasdaq Helsinki</td><td>Finland</td></tr>

</table>

<p><b>7</b> rows x <b>3</b> columns</p><p><b>0</b> missing values</p>

</div>

---
## Grouping & Aggregation

> [!info] Polars.NET GroupBy() returns flat DataFrame
>
> Polars.NET `GroupBy()` always returns a flat DataFrame — no index concept.
> Deedle's `GroupRowsBy<T>()` creates a hierarchical row key, requiring explicit
> flattening before further operations. Choose Polars for pipeline code where flat
> DataFrames chain cleanly; Deedle when you need time-series-aware operations.

### GroupBy Single Column

#### Polars.NET | GroupBy single column

Group rows by one key column and compute a single aggregate. `GroupBy("col").Agg(expr)` returns a flat DataFrame with one row per group — no index. Returns results in arbitrary order; chain `.Sort()` for deterministic ordering.

_Groups the 66K-row OHLCV frame by `symbol` and computes the mean `close` price per ticker, returning a 2-column DataFrame with one row per symbol in arbitrary order._

```csharp
// Polars.NET — Average closing price per symbol
var avgCloseP = dfP
    .GroupBy("symbol")
    .Agg(Col("close").Mean().Alias("avg_close"));

avgCloseP.Head(10)
```

<!-- Polars DataFrame: (10 rows, 2 columns) --><table><thead><tr><th>symbol</th><th>avg_close</th></tr></thead><tbody><tr><td>ABI.BR</td><td>54.86423366</td></tr><tr><td>AD.AS</td><td>29.6526559</td></tr><tr><td>ADS.DE</td><td>205.4264804</td></tr><tr><td>ADYEN.AS</td><td>1545.976409</td></tr><tr><td>AI.PA</td><td>145.4284434</td></tr><tr><td>AIR.PA</td><td>134.5841172</td></tr><tr><td>ALV.DE</td><td>252.1937311</td></tr><tr><td>ARGX.BR</td><td>413.6919609</td></tr><tr><td>ASML.AS</td><td>671.3489106</td></tr><tr><td>BAS.DE</td><td>50.56185423</td></tr></tbody></table></div>

#### Deedle | GroupBy single column

Deedle `GroupRowsBy<T>()` returns a `Frame<(string,int),string>` — a hierarchical row key, not a flat result. Computing the mean requires extracting the column, grouping via LINQ, and iterating. Much more verbose than Polars.NET for simple aggregations.

_Groups the OHLCV frame on `symbol` using LINQ aggregation over grouped observations, producing a key-value sequence of symbol → average close — then prints the first 10 symbols ordered alphabetically._

```csharp
// Deedle — Average closing price per symbol
var avgCloseD = dfD.GroupRowsBy<string>("symbol")
    .GetColumn<double>("close")
    .Observations
    .GroupBy(o => o.Key.Item1)
    .Select(g => KeyValuePair.Create(g.Key, g.Average(o => o.Value)))
    .OrderBy(kv => kv.Key);

Console.WriteLine($"{"Symbol",-12} {"Avg Close",12}");
foreach (var kv in avgCloseD.Take(10))
    Console.WriteLine($"{kv.Key,-12} {kv.Value,12:F2}");
display($"Total groups: {avgCloseD.Count()}");
```

    Symbol          Avg Close
    ABI.BR              54.86
    AD.AS               29.65
    ADS.DE             205.43
    ADYEN.AS          1545.98
    AI.PA              145.43
    AIR.PA             134.58
    ALV.DE             252.19
    ARGX.BR            413.69
    ASML.AS            671.35
    BAS.DE              50.56

    Total groups: 50

### GroupBy Multiple Columns

#### Polars.NET | GroupBy multiple columns

Pass multiple column names to `GroupBy()` to create composite group keys. Polars.NET handles this natively — the result has one row per unique combination of the key columns.

_Groups by the composite key `(symbol, is_filled)` and counts rows per combination — confirming that all 50 symbols have only `False` fill flags, producing 50 groups each with 1324–1331 rows._

```csharp
// Polars.NET — Group by symbol + is_filled, count rows
var multiGroupP = dfP
    .GroupBy("symbol", "is_filled")
    .Agg(Col("close").Count().Alias("row_count"));

multiGroupP.Head(10)
```

<!-- Polars DataFrame: (10 rows, 3 columns) --><table><thead><tr><th>symbol</th><th>is_filled</th><th>row_count</th></tr></thead><tbody><tr><td>ABI.BR</td><td>false</td><td>1331</td></tr><tr><td>AD.AS</td><td>false</td><td>1331</td></tr><tr><td>ADS.DE</td><td>false</td><td>1324</td></tr><tr><td>ADYEN.AS</td><td>false</td><td>1331</td></tr><tr><td>AI.PA</td><td>false</td><td>1331</td></tr><tr><td>AIR.PA</td><td>false</td><td>1331</td></tr><tr><td>ALV.DE</td><td>false</td><td>1324</td></tr><tr><td>ARGX.BR</td><td>false</td><td>1331</td></tr><tr><td>ASML.AS</td><td>false</td><td>1331</td></tr><tr><td>BAS.DE</td><td>false</td><td>1324</td></tr></tbody></table></div>

#### Deedle | GroupBy multiple columns

Deedle's `GroupRowsBy<T>()` supports only one key column. For multi-column grouping, concatenate the key values into a composite string key and group on that.

_Works around Deedle's single-key limitation by concatenating `symbol` and `is_filled` into a `"symbol|is_filled"` composite key, then groups and counts via LINQ — the top 10 results confirm all 1331 rows per symbol share the same `False` fill flag._

```csharp
// Deedle — Group by symbol + is_filled, count rows
// Deedle GroupRowsBy supports one key; create a composite key
var symbolSeries = dfD.GetColumn<string>("symbol");
var filledVals = dfD.GetColumn<bool>("is_filled");

var compositeKeys = new SeriesBuilder<int, string>();
foreach (var obs in symbolSeries.Observations)
    compositeKeys.Add(obs.Key, $"{obs.Value}|{filledVals.TryGet(obs.Key).Value}");

var grouped = compositeKeys.Series.Values
    .GroupBy(k => k)
    .Select(g => new { Key = g.Key, Count = g.Count() })
    .OrderByDescending(x => x.Count)
    .Take(10);

Console.WriteLine($"{"Key",-30} {"Count",6}");
foreach (var r in grouped)
    Console.WriteLine($"{r.Key,-30} {r.Count,6}");
```

    Key                             Count
    ABI.BR|False                     1331
    AD.AS|False                      1331
    ADYEN.AS|False                   1331
    AI.PA|False                      1331
    AIR.PA|False                     1331
    ARGX.BR|False                    1331
    ASML.AS|False                    1331
    BN.PA|False                      1331
    BNP.PA|False                     1331
    CS.PA|False                      1331

### Multiple Aggregations

#### Polars.NET | Multiple aggregations in one Agg call

Pass a list of expressions to `.Agg()` to compute multiple aggregations in a single group-by pass. Each expression names an output column via `.Alias()`. This avoids multiple scans of the data.

_Computes six statistics (`sum`, `mean`, `count`, `min`, `max` of close, and `total_volume`) per symbol in a single `.Agg()` pass — produces a 7-column DataFrame with one row per symbol, confirming ASML.AS has the widest price range (397→1288)._

```csharp
// Polars.NET — Sum, mean, count, min, max in one GroupBy.Agg()
var multiAggP = dfP
    .GroupBy("symbol")
    .Agg(
        Col("close").Sum().Alias("sum_close"),
        Col("close").Mean().Alias("mean_close"),
        Col("close").Count().Alias("count"),
        Col("close").Min().Alias("min_close"),
        Col("close").Max().Alias("max_close"),
        Col("volume").Sum().Alias("total_volume")
    );

multiAggP.Head(10)
```

<!-- Polars DataFrame: (10 rows, 7 columns) --><table><thead><tr><th>symbol</th><th>sum_close</th><th>mean_close</th><th>count</th><th>min_close</th><th>max_close</th><th>total_volume</th></tr></thead><tbody><tr><td>ABI.BR</td><td>73024.295</td><td>54.86423366</td><td>1331</td><td>45.06</td><td>68.82</td><td>2114455849</td></tr><tr><td>AD.AS</td><td>39467.685</td><td>29.6526559</td><td>1331</td><td>21.72</td><td>41.77</td><td>3214250982</td></tr><tr><td>ADS.DE</td><td>271984.66</td><td>205.4264804</td><td>1324</td><td>93.95</td><td>336.25</td><td>740793162</td></tr><tr><td>ADYEN.AS</td><td>2057694.6</td><td>1545.976409</td><td>1331</td><td>630.8</td><td>2766</td><td>110400463</td></tr><tr><td>AI.PA</td><td>193565.2582</td><td>145.4284434</td><td>1331</td><td>103.0579</td><td>186.64</td><td>1023869587</td></tr><tr><td>AIR.PA</td><td>179131.46</td><td>134.5841172</td><td>1331</td><td>83.11</td><td>220.2</td><td>1648955654</td></tr><tr><td>ALV.DE</td><td>333904.5</td><td>252.1937311</td><td>1324</td><td>159.62</td><td>392.7</td><td>1101960308</td></tr><tr><td>ARGX.BR</td><td>550624</td><td>413.6919609</td><td>1331</td><td>208.8</td><td>803</td><td>94592244</td></tr><tr><td>ASML.AS</td><td>893565.4</td><td>671.3489106</td><td>1331</td><td>397.45</td><td>1288.4</td><td>945070720</td></tr><tr><td>BAS.DE</td><td>66943.895</td><td>50.56185423</td><td>1324</td><td>38.85</td><td>72.61</td><td>3570432622</td></tr></tbody></table></div>

#### Deedle | Multiple aggregations via LINQ

Deedle has no multi-aggregation equivalent to `Agg()`. Each statistic requires a separate LINQ scan of the grouped observations. Results are then assembled into a new frame via `FrameBuilder.Columns`.

_Performs five separate LINQ scans over grouped close observations and one over volume to compute the same six statistics as the Polars.NET version — demonstrating the multi-pass cost of Deedle's aggregation model._

> [!warning] Deedle multi-aggregation scans each column N times
>
> Computing `sum`, `mean`, `min`, `max`, and `count` requires 5 separate LINQ iterations over the grouped data. For large frames this is significantly slower than Polars.NET's single-pass `.Agg()`. Prefer Polars.NET for analytical aggregation pipelines.

```csharp
// Deedle — Deedle has no multi-agg; aggregate each stat via LINQ
var grouped = dfD.GroupRowsBy<string>("symbol");
var closeObs = grouped.GetColumn<double>("close").Observations.GroupBy(o => o.Key.Item1);
var volObs = grouped.GetColumn<double>("volume").Observations.GroupBy(o => o.Key.Item1);

var symbols = closeObs.Select(g => g.Key).ToArray();
var sumClose  = closeObs.Select(g => g.Sum(o => o.Value)).ToArray();
var meanClose = closeObs.Select(g => g.Average(o => o.Value)).ToArray();
var countArr  = closeObs.Select(g => (double)g.Count()).ToArray();
var minClose  = closeObs.Select(g => g.Min(o => o.Value)).ToArray();
var maxClose  = closeObs.Select(g => g.Max(o => o.Value)).ToArray();
var totalVol  = volObs.Select(g => g.Sum(o => o.Value)).ToArray();

var idx = Enumerable.Range(0, symbols.Length).ToArray();
var builder = new FrameBuilder.Columns<int, string>();
builder.Add("symbol", new Series<int, string>(idx, symbols));
builder.Add("sum_close", new Series<int, double>(idx, sumClose));
builder.Add("mean_close", new Series<int, double>(idx, meanClose));
builder.Add("count", new Series<int, double>(idx, countArr));
builder.Add("min_close", new Series<int, double>(idx, minClose));
builder.Add("max_close", new Series<int, double>(idx, maxClose));
builder.Add("total_volume", new Series<int, double>(idx, totalVol));
builder.Frame.Rows[Enumerable.Range(0, 10)]
```

<div>

<table>

<thead><th></th><th></th><th>symbol</th><th>sum_close</th><th>mean_close</th><th>count</th><th>min_close</th><th>max_close</th><th>total_volume</th></thead><thead><th></th><th></th><th>(string)</th><th>(float)</th><th>(float)</th><th>(float)</th><th>(float)</th><th>(float)</th><th>(float)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>73024.29499999993</td><td>54.864233658903025</td><td>1331</td><td>45.06</td><td>68.82</td><td>2114455849</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>AD.AS</td><td>39467.68500000005</td><td>29.652655897821223</td><td>1331</td><td>21.72</td><td>41.77</td><td>3214250982</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>ADS.DE</td><td>271984.6599999997</td><td>205.42648036253752</td><td>1324</td><td>93.95</td><td>336.25</td><td>740793162</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>ADYEN.AS</td><td>2057694.6</td><td>1545.9764087152519</td><td>1331</td><td>630.8</td><td>2766</td><td>110400463</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>AI.PA</td><td>193565.2581999998</td><td>145.42844342599534</td><td>1331</td><td>103.0579</td><td>186.64</td><td>1023869587</td></tr><tr><td><b>5</b></td><td class="no-wrap">-></td><td>AIR.PA</td><td>179131.46000000005</td><td>134.58411720510898</td><td>1331</td><td>83.11</td><td>220.2</td><td>1648955654</td></tr><tr><td><b>6</b></td><td class="no-wrap">-></td><td>ALV.DE</td><td>333904.5000000002</td><td>252.1937311178249</td><td>1324</td><td>159.62</td><td>392.7</td><td>1101960308</td></tr><tr><td><b>7</b></td><td class="no-wrap">-></td><td>ARGX.BR</td><td>550623.9999999994</td><td>413.6919609316299</td><td>1331</td><td>208.8</td><td>803</td><td>94592244</td></tr><tr><td><b>8</b></td><td class="no-wrap">-></td><td>ASML.AS</td><td>893565.4000000005</td><td>671.348910593539</td><td>1331</td><td>397.45</td><td>1288.4</td><td>945070720</td></tr><tr><td><b>9</b></td><td class="no-wrap">-></td><td>BAS.DE</td><td>66943.89499999997</td><td>50.561854229607235</td><td>1324</td><td>38.85</td><td>72.61</td><td>3570432622</td></tr>

</table>

<p><b>10</b> rows x <b>7</b> columns</p><p><b>0</b> missing values</p>

</div>

### Group Head (Top N per Group)

#### Polars.NET | Group head (top N per group)

Return the first N rows within each group without collapsing rows. Polars.NET has no `GroupBy().Head(n)` method on `GroupByBuilder`; the workaround uses `.CumSum().Over()` to assign an intra-group row number, then filters on that.

> [!info] GroupBy().Head() workaround in Polars.NET
>
> Polars Python supports `group_by().head(n)` natively. In Polars.NET 0.4.x this method exists on the `GroupBy` object only for some overloads. The safe workaround is `Lit(1).CumSum().Over("group_col")` to number rows within each group, then `.Filter(Col("row_num") <= Lit(n))`.

_Assigns intra-group row numbers via `Lit(1).CumSum().Over("symbol")` and filters to `row_num <= 3` — the (66355, 13) shape reveals the entire frame is returned with the numbering column appended; the filter step then selects the first 3 rows per symbol._

```csharp
// Polars.NET — First 3 rows per symbol (group head)
// GroupBy().Head() does not exist on GroupByBuilder.
// Workaround: add a row number per group, then filter <= 3
var dfNumbered = dfP.WithColumns(
    Lit(1).CumSum().Over("symbol").Alias("row_num")
);
var groupHeadP = dfNumbered.Filter(Col("row_num") <= Lit(3));

display($"Group head shape: {groupHeadP.Shape}");
groupHeadP.Select("symbol", "date", "close", "row_num").Head(9)
```

    Group head shape: (66355, 13)

<!-- Polars DataFrame: (9 rows, 4 columns) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>row_num</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td><td>1</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>57.18</td><td>0</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>58.77</td><td>0</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>58.4</td><td>0</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>57.86</td><td>0</td></tr><tr><td>ABI.BR</td><td>2021-01-11</td><td>56.61</td><td>0</td></tr><tr><td>ABI.BR</td><td>2021-01-12</td><td>56.51</td><td>0</td></tr><tr><td>ABI.BR</td><td>2021-01-13</td><td>56.48</td><td>0</td></tr><tr><td>ABI.BR</td><td>2021-01-14</td><td>56.96</td><td>0</td></tr></tbody></table></div>

#### Deedle | Group head (top N per group)

Deedle exposes group row keys via `.RowKeys`. Take the first N from each group with LINQ `.GroupBy().SelectMany(g => g.Take(n))`, then slice the frame to those keys.

_Groups the OHLCV row keys by symbol and takes the first 3 per group via `.SelectMany()`, then slices the frame to those 150 keys — the 9-row preview confirms the first 3 dates for ABI.BR, AD.AS, and ADS.DE are returned in original order._

```csharp
// Deedle — First 3 rows per symbol
var groupedD = dfD.GroupRowsBy<string>("symbol");
var headKeys = groupedD.RowKeys
    .GroupBy(k => k.Item1)
    .SelectMany(g => g.Take(3));

var groupHeadD = groupedD.Rows[headKeys];
display($"Group head rows: {groupHeadD.RowCount}");
groupHeadD.Rows[groupHeadD.RowKeys.Take(9)]
```

    Group head rows: 150

<div>

<table>

<thead><th></th><th></th><th></th><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></thead><thead><th></th><th></th><th></th><th>(int)</th><th>(string)</th><th>(DateTime)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(int)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Boolean)</th></thead>

<tr><td><b>ABI.BR</b></td><td><b>0</b></td><td class="no-wrap">-></td><td>21160</td><td>ABI.BR</td><td>04-Jan-21 0:00:00</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b></b></td><td><b>1</b></td><td class="no-wrap">-></td><td>21161</td><td>ABI.BR</td><td>05-Jan-21 0:00:00</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b></b></td><td><b>2</b></td><td class="no-wrap">-></td><td>21162</td><td>ABI.BR</td><td>06-Jan-21 0:00:00</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>AD.AS</b></td><td><b>1331</b></td><td class="no-wrap">-></td><td>59438</td><td>AD.AS</td><td>04-Jan-21 0:00:00</td><td>23.38</td><td>23.83</td><td>23.38</td><td>23.79</td><td>19.9339</td><td>3526165</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b></b></td><td><b>1332</b></td><td class="no-wrap">-></td><td>59439</td><td>AD.AS</td><td>05-Jan-21 0:00:00</td><td>23.71</td><td>23.93</td><td>23.61</td><td>23.68</td><td>19.8417</td><td>3405805</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b></b></td><td><b>1333</b></td><td class="no-wrap">-></td><td>59440</td><td>AD.AS</td><td>06-Jan-21 0:00:00</td><td>23.7</td><td>23.87</td><td>23.61</td><td>23.76</td><td>19.9088</td><td>3033335</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>ADS.DE</b></td><td><b>2662</b></td><td class="no-wrap">-></td><td>62088</td><td>ADS.DE</td><td>04-Jan-21 0:00:00</td><td>300.0</td><td>300.5</td><td>293.0</td><td>295.4</td><td>282.2904</td><td>440364</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b></b></td><td><b>2663</b></td><td class="no-wrap">-></td><td>62089</td><td>ADS.DE</td><td>05-Jan-21 0:00:00</td><td>292.9</td><td>295.4</td><td>288.2</td><td>289.6</td><td>276.7479</td><td>436591</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b></b></td><td><b>2664</b></td><td class="no-wrap">-></td><td>62090</td><td>ADS.DE</td><td>06-Jan-21 0:00:00</td><td>290.7</td><td>292.7</td><td>286.8</td><td>291.7</td><td>278.7546</td><td>392602</td><td>0.0</td><td>0.0</td><td>False</td></tr>

</table>

<p><b>9</b> rows x <b>12</b> columns</p><p><b>0</b> missing values</p>

</div>

---
## Window Functions

The SQL Server gold layer in [gold-transforms](https://alp78.github.io/elysium/04-SQL-Server/Medallion-Project/gold-transforms) applies the same windowed aggregations to produce final analytical tables.

### Mean Over Group

#### Polars.NET | Mean over group

`expr.Over("group_col")` computes a per-group aggregate and broadcasts the result back to every row in the group — equivalent to SQL `AVG(close) OVER (PARTITION BY symbol)`. The original row count is preserved; no grouping collapse occurs.

_Broadcasts the per-symbol mean close back to every row using `Mean().Over("symbol")` — the 8-row preview shows `mean_close_over` repeating `54.864` for all ABI.BR rows, confirming the original 66355-row count is preserved._

```csharp
// Polars.NET — Mean close over each symbol (broadcast back to every row)
var withMeanP = dfP
    .Select(
        Col("symbol"),
        Col("date"),
        Col("close"),
        Col("close").Mean().Over("symbol").Alias("mean_close_over")
    );

withMeanP.Head(8)
```

<!-- Polars DataFrame: (8 rows, 4 columns) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>mean_close_over</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td><td>54.86423366</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>57.18</td><td>54.86423366</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>58.77</td><td>54.86423366</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>58.4</td><td>54.86423366</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>57.86</td><td>54.86423366</td></tr><tr><td>ABI.BR</td><td>2021-01-11</td><td>56.61</td><td>54.86423366</td></tr><tr><td>ABI.BR</td><td>2021-01-12</td><td>56.51</td><td>54.86423366</td></tr><tr><td>ABI.BR</td><td>2021-01-13</td><td>56.48</td><td>54.86423366</td></tr></tbody></table></div>

#### Deedle | Mean over group

Deedle has no `.Over()` equivalent. The workaround: compute a group-mean dictionary via LINQ, then iterate every row and map the symbol to its pre-computed mean. This is O(n) but requires explicit iteration.

_Pre-computes a `symbol → mean` dictionary via LINQ, then iterates all 66355 rows to look up and assign each row's group mean — producing the same `54.864` repeated values for ABI.BR rows as the Polars.NET `.Over()` approach._

```csharp
// Deedle — Compute group mean, then map back to each row
var symbolMeansD = dfD.GroupRowsBy<string>("symbol")
    .GetColumn<double>("close")
    .Observations
    .GroupBy(o => o.Key.Item1)
    .ToDictionary(g => g.Key, g => g.Average(o => o.Value));

var symCol = dfD.GetColumn<string>("symbol");
var meanOverD = new SeriesBuilder<int, double>();
foreach (var obs in symCol.Observations)
    meanOverD.Add(obs.Key, symbolMeansD[obs.Value]);

var dfDWithMean = dfD.Clone();
dfDWithMean.AddColumn("mean_close_by_symbol", meanOverD.Series);
dfDWithMean.Columns[new[] { "symbol", "date", "close", "mean_close_by_symbol" }]
    .Rows[dfDWithMean.RowKeys.Take(8)]
```

<div>

<table>

<thead><th></th><th></th><th>symbol</th><th>date</th><th>close</th><th>mean_close_by_symbol</th></thead><thead><th></th><th></th><th>(string)</th><th>(DateTime)</th><th>(Decimal)</th><th>(float)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>04-Jan-21 0:00:00</td><td>57.21</td><td>54.864233658903025</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>05-Jan-21 0:00:00</td><td>57.18</td><td>54.864233658903025</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>06-Jan-21 0:00:00</td><td>58.77</td><td>54.864233658903025</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>07-Jan-21 0:00:00</td><td>58.4</td><td>54.864233658903025</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>08-Jan-21 0:00:00</td><td>57.86</td><td>54.864233658903025</td></tr><tr><td><b>5</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>11-Jan-21 0:00:00</td><td>56.61</td><td>54.864233658903025</td></tr><tr><td><b>6</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>12-Jan-21 0:00:00</td><td>56.51</td><td>54.864233658903025</td></tr><tr><td><b>7</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>13-Jan-21 0:00:00</td><td>56.48</td><td>54.864233658903025</td></tr>

</table>

<p><b>8</b> rows x <b>4</b> columns</p><p><b>0</b> missing values</p>

</div>

### Rank Within Group

#### Polars.NET | Rank within group

`Col("close").Rank().Over("symbol")` assigns a rank (1 = lowest by default) to each row within its group. Ties produce averaged ranks (dense or standard depending on version). Equivalent to SQL `RANK() OVER (PARTITION BY symbol ORDER BY close)`.

_Ranks each row's close price within its symbol group using `Rank().Over("symbol")` — ABI.BR's 2021-01-04 close of 57.21 ranks 946.5 out of 1331, with averaged fractional ranks for tied values._

```csharp
// Polars.NET — Rank close price within each symbol
var withRankP = dfP
    .Select(
        Col("symbol"),
        Col("date"),
        Col("close"),
        Col("close").Rank().Over("symbol").Alias("rank_in_group")
    );

withRankP.Head(8)
```

<!-- Polars DataFrame: (8 rows, 4 columns) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>rank_in_group</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td><td>946.5</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>57.18</td><td>940.5</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>58.77</td><td>1126</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>58.4</td><td>1085.5</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>57.86</td><td>1024</td></tr><tr><td>ABI.BR</td><td>2021-01-11</td><td>56.61</td><td>887.5</td></tr><tr><td>ABI.BR</td><td>2021-01-12</td><td>56.51</td><td>875.5</td></tr><tr><td>ABI.BR</td><td>2021-01-13</td><td>56.48</td><td>871</td></tr></tbody></table></div>

#### Deedle | Rank within group (manual)

Deedle has no rank window function. Sort the values within each group, assign ordinal positions with a loop, then write results into a `SeriesBuilder`.

_Sorts each symbol's closing prices in ascending order and assigns integer ordinal positions via a loop — producing rank 946 for ABI.BR's 57.21 close (vs. Polars.NET's 946.5), as this approach assigns distinct integers without averaging ties._

```csharp
// Deedle — Manual rank: sort values within group, assign ordinal rank
var closeCol = dfD.GetColumn<double>("close");
var symColR = dfD.GetColumn<string>("symbol");

var rankBuilder = new SeriesBuilder<int, int>();
var groupedObs = symColR.Observations
    .GroupBy(o => o.Value);

foreach (var grp in groupedObs)
{
    // Get close values for this group, sort, assign rank
    var sorted = grp
        .Select(o => (Key: o.Key, Close: closeCol[o.Key]))
        .OrderBy(x => x.Close)
        .ToList();

    for (int i = 0; i < sorted.Count; i++)
        rankBuilder.Add(sorted[i].Key, i + 1);
}

var dfDWithRank = dfD.Clone();
dfDWithRank.AddColumn("rank_in_group", rankBuilder.Series);
dfDWithRank.Columns[new[] { "symbol", "date", "close", "rank_in_group" }].Rows[dfDWithRank.RowKeys.Take(8)]
```

<div>

<table>

<thead><th></th><th></th><th>symbol</th><th>date</th><th>close</th><th>rank_in_group</th></thead><thead><th></th><th></th><th>(string)</th><th>(DateTime)</th><th>(Decimal)</th><th>(int)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>04-Jan-21 0:00:00</td><td>57.21</td><td>946</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>05-Jan-21 0:00:00</td><td>57.18</td><td>940</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>06-Jan-21 0:00:00</td><td>58.77</td><td>1125</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>07-Jan-21 0:00:00</td><td>58.4</td><td>1085</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>08-Jan-21 0:00:00</td><td>57.86</td><td>1023</td></tr><tr><td><b>5</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>11-Jan-21 0:00:00</td><td>56.61</td><td>887</td></tr><tr><td><b>6</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>12-Jan-21 0:00:00</td><td>56.51</td><td>875</td></tr><tr><td><b>7</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>13-Jan-21 0:00:00</td><td>56.48</td><td>871</td></tr>

</table>

<p><b>8</b> rows x <b>4</b> columns</p><p><b>0</b> missing values</p>

</div>

### Rolling Mean Over Group

#### Polars.NET | Rolling mean over group

`RollingMean("20i")` computes a 20-row trailing mean. Combining it with `.Over("symbol")` ensures the window never crosses group boundaries — rows restart from 1 at each new symbol. The `"20i"` suffix specifies an index-based (row-count) window.

> [!tip] Row-count vs time-based rolling windows
>
> Polars.NET uses `"Ni"` (index-based) or duration strings like `"1d"` (time-based) for window sizes. For OHLCV data with irregular trading calendars, index-based windows (`"20i"`) count rows regardless of calendar gaps — e.g., weekends. Use time-based windows only when actual calendar duration matters.

_Computes a per-symbol 20-row trailing mean of close prices using `RollingMean("20i").Over("symbol")` — ABI.BR's mean starts at its own close (57.21) on row 1 and converges to a stable 20-row average of 57.272 by row 10._

```csharp
// Polars.NET — 20-row rolling mean of close, per symbol
var withRollingP = dfP
    .Select(
        Col("symbol"),
        Col("date"),
        Col("close"),
        Col("close").RollingMean("20i").Over("symbol").Alias("rolling_mean_20")
    );

withRollingP.Head(10)
```

<!-- Polars DataFrame: (10 rows, 4 columns) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>rolling_mean_20</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td><td>57.21</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>57.18</td><td>57.195</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>58.77</td><td>57.72</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>58.4</td><td>57.89</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>57.86</td><td>57.884</td></tr><tr><td>ABI.BR</td><td>2021-01-11</td><td>56.61</td><td>57.67166667</td></tr><tr><td>ABI.BR</td><td>2021-01-12</td><td>56.51</td><td>57.50571429</td></tr><tr><td>ABI.BR</td><td>2021-01-13</td><td>56.48</td><td>57.3775</td></tr><tr><td>ABI.BR</td><td>2021-01-14</td><td>56.96</td><td>57.33111111</td></tr><tr><td>ABI.BR</td><td>2021-01-15</td><td>56.74</td><td>57.272</td></tr></tbody></table></div>

#### Deedle | Rolling mean over group (manual)

Deedle has no rolling window functions. Implement manually: for each group, iterate rows in order and maintain a sliding sum over the last 20 values. This is O(n) but requires explicit loops and careful index tracking.

_Computes the 20-row rolling mean per symbol by maintaining a `[i-19..i]` sliding window index in a nested loop — the 10-row preview matches the Polars.NET output but required a full per-group iteration over all 66355 rows._

```csharp
// Deedle — 20-row rolling mean per symbol using Window
var symColW = dfD.GetColumn<string>("symbol");
var closeColW = dfD.GetColumn<double>("close");

var rollingBuilder = new SeriesBuilder<int, double>();
var groupedObsW = symColW.Observations.GroupBy(o => o.Value);

foreach (var grp in groupedObsW)
{
    var keys = grp.Select(o => o.Key).ToList();
    var vals = keys.Select(k => closeColW[k]).ToList();

    for (int i = 0; i < keys.Count; i++)
    {
        int start = Math.Max(0, i - 19);
        double mean = 0;
        for (int j = start; j <= i; j++)
            mean += vals[j];
        mean /= (i - start + 1);
        rollingBuilder.Add(keys[i], mean);
    }
}

var dfDWithRolling = dfD.Clone();
dfDWithRolling.AddColumn("rolling_mean_20", rollingBuilder.Series);
dfDWithRolling.Columns[new[] { "symbol", "date", "close", "rolling_mean_20" }].Rows[dfDWithRolling.RowKeys.Take(10)]
```

<div>

<table>

<thead><th></th><th></th><th>symbol</th><th>date</th><th>close</th><th>rolling_mean_20</th></thead><thead><th></th><th></th><th>(string)</th><th>(DateTime)</th><th>(Decimal)</th><th>(float)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>04-Jan-21 0:00:00</td><td>57.21</td><td>57.21</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>05-Jan-21 0:00:00</td><td>57.18</td><td>57.195</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>06-Jan-21 0:00:00</td><td>58.77</td><td>57.72</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>07-Jan-21 0:00:00</td><td>58.4</td><td>57.89</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>08-Jan-21 0:00:00</td><td>57.86</td><td>57.884</td></tr><tr><td><b>5</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>11-Jan-21 0:00:00</td><td>56.61</td><td>57.671666666666674</td></tr><tr><td><b>6</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>12-Jan-21 0:00:00</td><td>56.51</td><td>57.50571428571429</td></tr><tr><td><b>7</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>13-Jan-21 0:00:00</td><td>56.48</td><td>57.377500000000005</td></tr><tr><td><b>8</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>14-Jan-21 0:00:00</td><td>56.96</td><td>57.33111111111111</td></tr><tr><td><b>9</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>15-Jan-21 0:00:00</td><td>56.74</td><td>57.272000000000006</td></tr>

</table>

<p><b>10</b> rows x <b>4</b> columns</p><p><b>0</b> missing values</p>

</div>

---
## Joins

> [!danger] Joins with duplicate keys silently
>
> Joins with duplicate keys silently multiply rows
> If both sides of a join have duplicate keys, the result is a Cartesian product for
> those keys — your 66K row DataFrame can explode to millions with no error or warning.
> Always check `result.Shape` after a join and compare to the expected row count.
>
> Polars.NET `Join()` has no built-in `validate` parameter like Pandas. Verify key
> uniqueness before joining: `df.Select(Col("key")).Unique().Shape` should match `df.Shape`.

> [!success] Validate key uniqueness before joining
>
> Assert uniqueness on both sides before calling `Join()`:
> ```csharp
> // Verify left key is unique
> var leftKeys = left.Select(Col("key"));
> if (leftKeys.Unique().Shape.Item1 != leftKeys.Shape.Item1)
>     throw new InvalidOperationException("Left join key contains duplicates.");
>
> // Verify right key is unique
> var rightKeys = right.Select(Col("key"));
> if (rightKeys.Unique().Shape.Item1 != rightKeys.Shape.Item1)
>     throw new InvalidOperationException("Right join key contains duplicates.");
>
> var result = left.Join(right, new[] { Col("key") }, new[] { Col("key") });
> ```
> After the join, always confirm `result.Shape.Item1` equals the expected row count.

### Inner Join

#### Polars.NET | Inner join

`df.Join(other, leftKeys, rightKeys)` defaults to an inner join — only rows where the key exists in both frames are kept. Rows without a match are silently dropped. Verify the output row count matches the expected number after joining.

_Joins the 66355-row OHLCV frame (with extracted `suffix` column) to the 7-row exchange dimension on `suffix` — the output shape (66355, 15) confirms all rows matched, as every symbol suffix maps to one of the 7 exchange codes._

```csharp
// Polars.NET — Inner join OHLCV (with suffix) to exchange dimension
var innerP = dfPWithSuffix.Join(dimExP,
    new[] { Col("suffix") }, new[] { Col("suffix") });

display($"Inner join shape: {innerP.Shape}");
innerP.Select("symbol", "date", "close", "suffix", "exchange_name", "country").Head(8)
```

    Inner join shape: (66355, 15)

<!-- Polars DataFrame: (8 rows, 6 columns) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>suffix</th><th>exchange_name</th><th>country</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>57.18</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>58.77</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>58.4</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>57.86</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td>ABI.BR</td><td>2021-01-11</td><td>56.61</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td>ABI.BR</td><td>2021-01-12</td><td>56.51</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td>ABI.BR</td><td>2021-01-13</td><td>56.48</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr></tbody></table></div>

#### Deedle | Inner join

Deedle has no native `Join(otherFrame)` on DataFrames. Simulate an inner join with a dictionary lookup: build a key → value map from the right side, iterate the left frame, and collect only matching keys.

_Simulates the inner join by building a `suffix → (name, country)` dictionary from the right frame, then collecting only OHLCV rows with a matching suffix — the 66355-row result confirms the same outcome as the Polars.NET join._

```csharp
// Deedle — Inner join by building a lookup dictionary
var exLookup = new Dictionary<string, (string name, string country)>();
var dimSuffix = dimExD.GetColumn<string>("suffix");
var dimName   = dimExD.GetColumn<string>("exchange_name");
var dimCountry = dimExD.GetColumn<string>("country");

foreach (var obs in dimSuffix.Observations)
    exLookup[obs.Value] = (dimName[obs.Key], dimCountry[obs.Key]);

var suffixColD = dfDWithSuffix.GetColumn<string>("suffix");
var exNameBuilder = new SeriesBuilder<int, string>();
var exCountryBuilder = new SeriesBuilder<int, string>();

foreach (var obs in suffixColD.Observations)
{
    if (exLookup.ContainsKey(obs.Value))
    {
        exNameBuilder.Add(obs.Key, exLookup[obs.Value].name);
        exCountryBuilder.Add(obs.Key, exLookup[obs.Value].country);
    }
}

// Inner: keep only rows that had a match
var matchedKeys = exNameBuilder.Series.Keys.ToArray();
var innerD = dfDWithSuffix.Rows[matchedKeys].Clone();
innerD.AddColumn("exchange_name", exNameBuilder.Series);
innerD.AddColumn("country", exCountryBuilder.Series);

display($"Inner join rows: {innerD.RowCount}");
innerD.Columns[new[] { "symbol", "date", "close", "suffix", "exchange_name", "country" }].Rows[innerD.RowKeys.Take(8)]
```

    Inner join rows: 66355

<div>

<table>

<thead><th></th><th></th><th>symbol</th><th>date</th><th>close</th><th>suffix</th><th>exchange_name</th><th>country</th></thead><thead><th></th><th></th><th>(string)</th><th>(DateTime)</th><th>(Decimal)</th><th>(string)</th><th>(string)</th><th>(string)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>04-Jan-21 0:00:00</td><td>57.21</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>05-Jan-21 0:00:00</td><td>57.18</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>06-Jan-21 0:00:00</td><td>58.77</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>07-Jan-21 0:00:00</td><td>58.4</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>08-Jan-21 0:00:00</td><td>57.86</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td><b>5</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>11-Jan-21 0:00:00</td><td>56.61</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td><b>6</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>12-Jan-21 0:00:00</td><td>56.51</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td><b>7</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>13-Jan-21 0:00:00</td><td>56.48</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr>

</table>

<p><b>8</b> rows x <b>6</b> columns</p><p><b>0</b> missing values</p>

</div>

### Left Join

#### Polars.NET | Left join

`JoinType.Left` keeps all rows from the left frame. Unmatched rows on the right produce `null` in the new columns. Use `.NullCount` on the joined column to verify how many rows had no match.

_Joins against a 3-exchange subset (`.DE`, `.PA`, `.AS`) using `JoinType.Left` — the output confirms 15889 null values in `exchange_name` for the four unmatched suffixes (`.BR`, `.MC`, `.MI`, `.HE`), while all 66355 left rows are preserved._

```csharp
// Polars.NET — Left join with partial dim table to demonstrate nulls
// Only include 3 of the 7 exchanges so some rows have no match
var dimPartial = new DataFrame(new Polars.CSharp.Series[]
{
    Polars.CSharp.Series.From("suffix", new[] { ".DE", ".PA", ".AS" }),
    Polars.CSharp.Series.From("exchange_name", new[] { "XETRA Frankfurt", "Euronext Paris", "Euronext Amsterdam" })
});

var leftP = dfPWithSuffix.Join(dimPartial,
    new[] { Col("suffix") }, new[] { Col("suffix") },
    JoinType.Left);

display($"Left join shape: {leftP.Shape}");
var exchCol = leftP.Column("exchange_name");
display($"Null exchange_name count: {exchCol.NullCount} (unmatched .BR, .MC, .MI, .HE)");

// Show one row per symbol to see both matched and unmatched
leftP.GroupBy("symbol").Agg(Col("suffix").First().Alias("suffix"), Col("exchange_name").First().Alias("exchange_name"))
    .Sort("suffix").Head(10)
```

    Left join shape: (66355, 14)

    Null exchange_name count: 15889 (unmatched .BR, .MC, .MI, .HE)

<!-- Polars DataFrame: (10 rows, 3 columns) --><table><thead><tr><th>symbol</th><th>suffix</th><th>exchange_name</th></tr></thead><tbody><tr><td>AD.AS</td><td>.AS</td><td>Euronext Amsterdam</td></tr><tr><td>ADYEN.AS</td><td>.AS</td><td>Euronext Amsterdam</td></tr><tr><td>ASML.AS</td><td>.AS</td><td>Euronext Amsterdam</td></tr><tr><td>INGA.AS</td><td>.AS</td><td>Euronext Amsterdam</td></tr><tr><td>PRX.AS</td><td>.AS</td><td>Euronext Amsterdam</td></tr><tr><td>WKL.AS</td><td>.AS</td><td>Euronext Amsterdam</td></tr><tr><td>ABI.BR</td><td>.BR</td><td class='pl-null'>null</td></tr><tr><td>ARGX.BR</td><td>.BR</td><td class='pl-null'>null</td></tr><tr><td>ADS.DE</td><td>.DE</td><td>XETRA Frankfurt</td></tr><tr><td>ALV.DE</td><td>.DE</td><td>XETRA Frankfurt</td></tr></tbody></table></div>

#### Deedle | Left join

Simulate a left join by iterating all rows of the left frame and looking up each key in the right-side dictionary. Rows without a match receive a sentinel value (`"N/A"`) rather than a true null — Deedle strings have no native null representation.

> [!info] Deedle uses OptionalValue, not null, for missing data
>
> Deedle represents missing values as `OptionalValue<T>.Missing`, not `null`. When building string columns with `SeriesBuilder`, there is no way to insert a true missing string — use a sentinel like `"N/A"` or `""` instead. This differs from Polars.NET, where unmatched left-join rows produce `null` in the output column.

_Iterates all 66355 OHLCV rows and fills unmatched exchange suffixes with `"N/A"` sentinel strings — since the full dimension table covers all 7 suffixes, the first 8 preview rows all show matched exchange names without any `"N/A"` values._

```csharp
// Deedle — Left join: keep all rows, fill missing with "N/A"
var leftNameBuilder = new SeriesBuilder<int, string>();
var leftCountryBuilder = new SeriesBuilder<int, string>();

foreach (var obs in suffixColD.Observations)
{
    if (exLookup.ContainsKey(obs.Value))
    {
        leftNameBuilder.Add(obs.Key, exLookup[obs.Value].name);
        leftCountryBuilder.Add(obs.Key, exLookup[obs.Value].country);
    }
    else
    {
        leftNameBuilder.Add(obs.Key, "N/A");
        leftCountryBuilder.Add(obs.Key, "N/A");
    }
}

var leftD = dfDWithSuffix.Clone();
leftD.AddColumn("exchange_name", leftNameBuilder.Series);
leftD.AddColumn("country", leftCountryBuilder.Series);

display($"Left join rows: {leftD.RowCount}");
leftD.Columns[new[] { "symbol", "close", "suffix", "exchange_name", "country" }].Rows[leftD.RowKeys.Take(8)]
```

    Left join rows: 66355

<div>

<table>

<thead><th></th><th></th><th>symbol</th><th>close</th><th>suffix</th><th>exchange_name</th><th>country</th></thead><thead><th></th><th></th><th>(string)</th><th>(Decimal)</th><th>(string)</th><th>(string)</th><th>(string)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>57.21</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>57.18</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>58.77</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>58.4</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>57.86</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td><b>5</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>56.61</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td><b>6</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>56.51</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr><tr><td><b>7</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>56.48</td><td>.BR</td><td>Euronext Brussels</td><td>Belgium</td></tr>

</table>

<p><b>8</b> rows x <b>5</b> columns</p><p><b>0</b> missing values</p>

</div>

### Anti Join

#### Polars.NET | Anti join

`JoinType.Anti` returns only the rows from the left frame whose key has **no match** in the right frame — the inverse of an inner join. Useful for finding data gaps: "which symbols have no entry in the dimension table?"

_Applies an anti join against the 3-exchange partial dim (`.DE`, `.PA`, `.AS`) — the 15889 returned rows confirm all `.BR`, `.HE`, `.MI`, and `.MC` symbols had no match in the right frame._

```csharp
// Polars.NET — Anti join: rows whose suffix is NOT in the partial dim table
// dimPartial only has .DE, .PA, .AS — so .BR, .MC, .MI, .HE rows are returned
var antiP = dfPWithSuffix.Join(dimPartial,
    new[] { Col("suffix") }, new[] { Col("suffix") },
    JoinType.Anti);

display($"Anti join shape: {antiP.Shape} (rows without .DE, .PA, .AS)");
var unmatchedSuffixes = string.Join(", ", antiP.Column("suffix").Unique().ToArray<string>());
display($"Unique unmatched suffixes: {unmatchedSuffixes}");
antiP.Select("symbol", "date", "suffix").Head(8)
```

    Anti join shape: (15889, 13) (rows without .DE, .PA, .AS)

    Unique unmatched suffixes: .BR, .HE, .MI, .MC

<!-- Polars DataFrame: (8 rows, 3 columns) --><table><thead><tr><th>symbol</th><th>date</th><th>suffix</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>.BR</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>.BR</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>.BR</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>.BR</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>.BR</td></tr><tr><td>ABI.BR</td><td>2021-01-11</td><td>.BR</td></tr><tr><td>ABI.BR</td><td>2021-01-12</td><td>.BR</td></tr><tr><td>ABI.BR</td><td>2021-01-13</td><td>.BR</td></tr></tbody></table></div>

#### Deedle | Anti join (manual set difference)

Deedle has no anti join. Filter the left frame by set difference: build a `HashSet<string>` from the right-side keys, then keep only left rows whose key is **not** in the set.

_Builds a `HashSet<string>` of all 7 dimension suffixes and retains only OHLCV rows whose suffix is not in the set — the "0 rows" result confirms all suffixes in the full OHLCV frame matched the complete dimension table, unlike the partial-dim example used in the Polars.NET anti join._

```csharp
// Deedle — Anti join: Deedle has no native anti join
// Keep rows whose suffix is NOT in the exchange dimension
var dimSuffixSet = new HashSet<string>(dimExD.GetColumn<string>("suffix").Observations.Select(o => o.Value));
var antiKeys = suffixColD.Observations
    .Where(o => !dimSuffixSet.Contains(o.Value))
    .Select(o => o.Key)
    .ToArray();

if (antiKeys.Length > 0)
{
    var antiD = dfDWithSuffix.Rows[antiKeys];
    display($"Anti join rows: {antiD.RowCount}");
    display(antiD.Rows[antiD.RowKeys.Take(5)]);
}
else
{
    display("Anti join: 0 rows — all suffixes matched the dimension table.");
}
```

    Anti join: 0 rows — all suffixes matched the dimension table.

### Semi Join

#### Polars.NET | Semi join

`JoinType.Semi` returns only the rows from the left frame whose key **has a match** in the right frame — but without adding any columns from the right. Use it to filter a large frame down to rows that exist in a reference set.

> [!info] Semi join has no Deedle equivalent
>
> Deedle has no semi join. The equivalent is a manual set-intersection filter: build a `HashSet<T>` from the right-side keys and keep left rows whose key is in the set. This is identical in behavior but requires explicit iteration.

_Filters the OHLCV frame to rows whose `suffix` exists in the 7-row exchange dimension using `JoinType.Semi` — the unchanged shape (66355, 13) confirms all rows passed the filter and no columns from the right frame were added._

```csharp
// Polars.NET — Semi join: keep OHLCV rows whose suffix is in the dimension table
// (all 7 suffixes are present, so result matches full frame)
var semiP = dfPWithSuffix.Join(dimExP,
    new[] { Col("suffix") }, new[] { Col("suffix") },
    JoinType.Semi);

display($"Semi join shape: {semiP.Shape}  (original: {dfPWithSuffix.Shape})");
semiP.Select("symbol", "date", "suffix").Head(5)
```

    Semi join shape: (66355, 13)  (original: (66355, 13))

<!-- Polars DataFrame: (5 rows, 3 columns) --><table><thead><tr><th>symbol</th><th>date</th><th>suffix</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>.BR</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>.BR</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>.BR</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>.BR</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>.BR</td></tr></tbody></table></div>

### Cross Join

#### Polars.NET | Cross join

`JoinType.Cross` produces the Cartesian product of two frames: every row on the left is paired with every row on the right. Result row count = `left.rows × right.rows`. Use for generating all combinations of two small sets.

> [!warning] Cross join row explosion
>
> A cross join of two 1,000-row frames produces 1,000,000 rows. Never cross-join large frames without filtering or limiting both sides first. Always verify `result.Shape` before using the output.

> [!info] Cross join has no Deedle equivalent
>
> Deedle has no cross join. Implement in LINQ with `from r1 in leftRows from r2 in rightRows select (r1, r2)`, then build a new frame from the paired tuples.

_Cross-joins a 2-row symbol frame (`ASML.AS`, `MC.PA`) with a 2-row exchange frame (`Primary`, `Secondary`) using empty key arrays — the (4, 2) output is the Cartesian product of all symbol × exchange combinations._

```csharp
// Polars.NET — Cross join: all symbol × suffix combinations (tiny example)
var syms = new DataFrame(new Polars.CSharp.Series[]
{
    Polars.CSharp.Series.From("symbol", new[] { "ASML.AS", "MC.PA" })
});
var exs = new DataFrame(new Polars.CSharp.Series[]
{
    Polars.CSharp.Series.From("exchange", new[] { "Primary", "Secondary" })
});
var crossP = syms.Join(exs, Array.Empty<Polars.CSharp.Series>(), Array.Empty<Polars.CSharp.Series>(), JoinType.Cross);
display($"Cross join shape: {crossP.Shape}");
crossP
```

    Cross join shape: (4, 2)

<!-- Polars DataFrame: (4 rows, 2 columns) --><table><thead><tr><th>symbol</th><th>exchange</th></tr></thead><tbody><tr><td>ASML.AS</td><td>Primary</td></tr><tr><td>ASML.AS</td><td>Secondary</td></tr><tr><td>MC.PA</td><td>Primary</td></tr><tr><td>MC.PA</td><td>Secondary</td></tr></tbody></table></div>

---
## Concatenation

### Vertical Concatenation

#### Polars.NET | Vertical concatenation

`.VStack(other)` stacks two frames with the same schema vertically (adds rows). Both frames must have identical column names and types — Polars.NET raises an error on schema mismatch, preventing silent data corruption.

_Splits the first 20 OHLCV rows into two 10-row frames and re-stacks them using `.VStack()` — the (20, 12) output confirms both frames were appended in order with the original schema preserved._

```csharp
// Polars.NET — Split first 10 and next 10, then vertical concat
var topP = dfP.Head(10);
var botP = dfP.Slice(10, 10);
var vcatP = topP.VStack(botP);

display($"Top: {topP.Shape}  Bot: {botP.Shape}  VStack: {vcatP.Shape}");
vcatP.Head(5)
```

    Top: (10, 12)  Bot: (10, 12)  VStack: (20, 12)

<!-- Polars DataFrame: (5 rows, 12 columns) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr></thead><tbody><tr><td>21160</td><td>ABI.BR</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21161</td><td>ABI.BR</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21162</td><td>ABI.BR</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21163</td><td>ABI.BR</td><td>2021-01-07</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1469911</td><td>0</td><td>0</td><td>false</td></tr><tr><td>21164</td><td>ABI.BR</td><td>2021-01-08</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1428681</td><td>0</td><td>0</td><td>false</td></tr></tbody></table></div>

#### Deedle | Vertical concatenation

`frame1.Merge(frame2)` combines two frames vertically by aligning on column names. **Row keys must not overlap** — Deedle uses integer row keys, so take rows from the original frame using non-overlapping key ranges.

_Takes rows 0–9 and rows 10–19 from the OHLCV frame using non-overlapping key ranges and merges them vertically — the (20, 12) result confirms `.Merge()` aligns on column names and requires non-overlapping integer row keys._

```csharp
// Deedle — Merge two frames vertically (row keys must not overlap)
var topD = dfD.Rows[dfD.RowKeys.Take(10)];
var botD = dfD.Rows[dfD.RowKeys.Skip(10).Take(10)];
var vcatD = topD.Merge(botD);

display($"Top: {topD.RowCount}  Bot: {botD.RowCount}  Concat: {vcatD.RowCount} x {vcatD.ColumnCount}");
vcatD.Rows[vcatD.RowKeys.Take(5)]
```

    Top: 10  Bot: 10  Concat: 20 x 12

<div>

<table>

<thead><th></th><th></th><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></thead><thead><th></th><th></th><th>(int)</th><th>(string)</th><th>(DateTime)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Decimal)</th><th>(int)</th><th>(Decimal)</th><th>(Decimal)</th><th>(Boolean)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>21160</td><td>ABI.BR</td><td>04-Jan-21 0:00:00</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>21161</td><td>ABI.BR</td><td>05-Jan-21 0:00:00</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>21162</td><td>ABI.BR</td><td>06-Jan-21 0:00:00</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>21163</td><td>ABI.BR</td><td>07-Jan-21 0:00:00</td><td>58.68</td><td>58.86</td><td>57.88</td><td>58.4</td><td>54.6905</td><td>1469911</td><td>0.0</td><td>0.0</td><td>False</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>21164</td><td>ABI.BR</td><td>08-Jan-21 0:00:00</td><td>58.16</td><td>58.4</td><td>57.43</td><td>57.86</td><td>54.1848</td><td>1428681</td><td>0.0</td><td>0.0</td><td>False</td></tr>

</table>

<p><b>5</b> rows x <b>12</b> columns</p><p><b>0</b> missing values</p>

</div>

### Horizontal Concatenation

#### Polars.NET | Horizontal concatenation

`.HStack(series)` appends a single `Series` as a new column. To add multiple columns from another frame, call `.HStack()` once per column. Both frames must have the same number of rows.

_Splits the first 5 OHLCV rows into a 3-column left frame and a 3-column right frame, then horizontally concatenates them by calling `.HStack()` once per column — the (5, 6) output confirms all three series were appended in sequence._

```csharp
// Polars.NET — Horizontal concat: split columns, then rejoin
var leftCols = dfP.Select(Col("symbol"), Col("date"), Col("close")).Head(5);
var rightCols = dfP.Select(Col("volume"), Col("high"), Col("low")).Head(5);

// HStack adds series; extract each column from right and stack
var hcatP = leftCols
    .HStack(rightCols.Column("volume"))
    .HStack(rightCols.Column("high"))
    .HStack(rightCols.Column("low"));

display($"Left: {leftCols.Shape}  Right: {rightCols.Shape}  HStacked: {hcatP.Shape}");
hcatP
```

    Left: (5, 3)  Right: (5, 3)  HStacked: (5, 6)

<!-- Polars DataFrame: (5 rows, 6 columns) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>volume</th><th>high</th><th>low</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>57.21</td><td>1513937</td><td>58.85</td><td>56.78</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>57.18</td><td>1382722</td><td>57.98</td><td>56.75</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>58.77</td><td>1370204</td><td>58.94</td><td>57.39</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>58.4</td><td>1469911</td><td>58.86</td><td>57.88</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>57.86</td><td>1428681</td><td>58.4</td><td>57.43</td></tr></tbody></table></div>

#### Deedle | Horizontal concatenation

`frame1.Join(frame2, JoinKind.Inner)` aligns two frames on their shared row keys and concatenates their columns. Use `JoinKind.Inner` to keep only rows present in both, or `JoinKind.Outer` to keep all rows and fill gaps with missing values.

_Joins two 5-row sub-frames side-by-side on their shared integer row keys using `JoinKind.Inner` — the (5, 6) result aligns `symbol/date/close` from the left with `volume/high/low` from the right on matching keys._

```csharp
// Deedle — Join frames side by side (aligns on row keys)
var leftColsD = dfD.Columns[new[] { "symbol", "date", "close" }].Rows[dfD.RowKeys.Take(5)];
var rightColsD = dfD.Columns[new[] { "volume", "high", "low" }].Rows[dfD.RowKeys.Take(5)];
var hcatD = leftColsD.Join(rightColsD, JoinKind.Inner);

display($"Left: {leftColsD.RowCount}x{leftColsD.ColumnCount}  Right: {rightColsD.RowCount}x{rightColsD.ColumnCount}  Joined: {hcatD.RowCount}x{hcatD.ColumnCount}");
hcatD
```

    Left: 5x3  Right: 5x3  Joined: 5x6

<div>

<table>

<thead><th></th><th></th><th>symbol</th><th>date</th><th>close</th><th>volume</th><th>high</th><th>low</th></thead><thead><th></th><th></th><th>(string)</th><th>(DateTime)</th><th>(Decimal)</th><th>(int)</th><th>(Decimal)</th><th>(Decimal)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>04-Jan-21 0:00:00</td><td>57.21</td><td>1513937</td><td>58.85</td><td>56.78</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>05-Jan-21 0:00:00</td><td>57.18</td><td>1382722</td><td>57.98</td><td>56.75</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>06-Jan-21 0:00:00</td><td>58.77</td><td>1370204</td><td>58.94</td><td>57.39</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>07-Jan-21 0:00:00</td><td>58.4</td><td>1469911</td><td>58.86</td><td>57.88</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>08-Jan-21 0:00:00</td><td>57.86</td><td>1428681</td><td>58.4</td><td>57.43</td></tr>

</table>

<p><b>5</b> rows x <b>6</b> columns</p><p><b>0</b> missing values</p>

</div>

---
## Reshaping

### Pivot (Long to Wide)

#### Polars.NET | Pivot (long to wide)

`.Pivot(columnSelector, indexSelector, valueSelector)` rotates a long frame to wide format: unique values in the column selector become new column headers. Use when you need one row per date and one column per symbol.

_Pivots a 30-row long subset of 3 symbols into a wide frame using symbol as the column selector — the (1, 31) output shape reveals that Polars.NET's `.Pivot()` produces one row per unique symbol value with dates as columns, rather than the more common one-row-per-date layout._

```csharp
// Polars.NET — Pivot: daily close prices with symbols as columns
var filterSyms = Polars.CSharp.Series.From("s", new[] { "SAP.DE", "ASML.AS", "MC.PA" });
var pivotSubsetP = dfP
    .Filter(Col("symbol").IsIn(Lit(filterSyms)))
    .Select("date", "symbol", "close")
    .Head(30);

display($"Subset: {pivotSubsetP.Shape}");
var pivotP = pivotSubsetP.Pivot(
    Selector.Cols("symbol"),
    Selector.Cols("date"),
    Selector.Cols("close"));
display($"Pivot shape: {pivotP.Shape}");
pivotP.Head(10)
```

    Subset: (30, 3)

    Pivot shape: (1, 31)

<!-- Polars DataFrame: (1 rows, 31 columns) --><table><thead><tr><th>symbol</th><th>2021-01-04</th><th>2021-01-05</th><th>2021-01-06</th><th>2021-01-07</th><th>2021-01-08</th><th>2021-01-11</th><th>2021-01-12</th><th>2021-01-13</th><th>2021-01-14</th><th>2021-01-15</th><th>2021-01-18</th><th>2021-01-19</th><th>2021-01-20</th><th>2021-01-21</th><th>2021-01-22</th><th>2021-01-25</th><th>2021-01-26</th><th>2021-01-27</th><th>2021-01-28</th><th>2021-01-29</th><th>2021-02-01</th><th>2021-02-02</th><th>2021-02-03</th><th>2021-02-04</th><th>2021-02-05</th><th>2021-02-08</th><th>2021-02-09</th><th>2021-02-10</th><th>2021-02-11</th><th>2021-02-12</th></tr></thead><tbody><tr><td>ASML.AS</td><td>406.25</td><td>406.9</td><td>402.85</td><td>403.9</td><td>416.05</td><td>414.9</td><td>418.95</td><td>422.45</td><td>447.35</td><td>435.85</td><td>437.6</td><td>439.9</td><td>453.15</td><td>470.55</td><td>462.9</td><td>461.35</td><td>458.55</td><td>440.65</td><td>449</td><td>439.45</td><td>454.9</td><td>457.5</td><td>457.15</td><td>459.55</td><td>460</td><td>467.1</td><td>469.75</td><td>464.1</td><td>480.45</td><td>494.75</td></tr></tbody></table></div>

#### Deedle | Pivot (manual FrameBuilder)

Deedle's native `PivotTable<R,C,V>()` API requires homogeneous types and is cumbersome for mixed-type frames. The practical alternative: build one `Series<date, double>` per symbol and assemble them into a frame with `FrameBuilder.Columns`.

> [!info] Deedle's natural pivot is a "wide" frame indexed by date
>
> Deedle's approach — one Series per symbol aligned on a shared date index — produces a frame where dates are row keys and symbols are column keys. This is the canonical Deedle representation for time-series cross-sectional data and is more idiomatic than the Polars long→wide pivot for this use case.

_Builds one date-indexed `Series<string, double>` per symbol and assembles them into a (1331 × 3) frame — date strings become row keys and symbol names become column headers, demonstrating Deedle's canonical approach to cross-sectional time series._

```csharp
// Deedle — Manual pivot: reshape long to wide
var symFilter = new HashSet<string> { "SAP.DE", "ASML.AS", "MC.PA" };
var symColPvt = dfD.GetColumn<string>("symbol");
var dateColPvt = dfD.GetColumn<string>("date");
var closeColPvt = dfD.GetColumn<double>("close");

// Build one Series<date, close> per symbol, then combine into a Frame
var builder = new FrameBuilder.Columns<string, string>();
foreach (var sym in symFilter)
{
    var keys = symColPvt.Observations.Where(o => o.Value == sym).Select(o => o.Key).ToArray();
    var dates = keys.Select(k => dateColPvt.Observations.First(o => o.Key == k).Value).ToArray();
    var closes = keys.Select(k => closeColPvt.Observations.First(o => o.Key == k).Value).ToArray();
    builder.Add(sym, new Series<string, double>(dates, closes));
}
var pivotD = builder.Frame;
display($"Pivot shape: {pivotD.RowCount} x {pivotD.ColumnCount}");
pivotD.Rows[pivotD.RowKeys.Take(10)]
```

    Pivot shape: 1331 x 3

<div>

<table>

<thead><th></th><th></th><th>SAP.DE</th><th>ASML.AS</th><th>MC.PA</th></thead><thead><th></th><th></th><th>(float)</th><th>(float)</th><th>(float)</th></thead>

<tr><td><b>04-Jan-21 0:00:00</b></td><td class="no-wrap">-></td><td>105.32</td><td>406.25</td><td>512.1</td></tr><tr><td><b>05-Jan-21 0:00:00</b></td><td class="no-wrap">-></td><td>105.04</td><td>406.9</td><td>506.2</td></tr><tr><td><b>06-Jan-21 0:00:00</b></td><td class="no-wrap">-></td><td>105.48</td><td>402.85</td><td>502.3</td></tr><tr><td><b>07-Jan-21 0:00:00</b></td><td class="no-wrap">-></td><td>104.52</td><td>403.9</td><td>515.3</td></tr><tr><td><b>08-Jan-21 0:00:00</b></td><td class="no-wrap">-></td><td>106.18</td><td>416.05</td><td>525.3</td></tr><tr><td><b>11-Jan-21 0:00:00</b></td><td class="no-wrap">-></td><td>106.04</td><td>414.9</td><td>522.4</td></tr><tr><td><b>12-Jan-21 0:00:00</b></td><td class="no-wrap">-></td><td>105.74</td><td>418.95</td><td>515.8</td></tr><tr><td><b>13-Jan-21 0:00:00</b></td><td class="no-wrap">-></td><td>105.36</td><td>422.45</td><td>512.1</td></tr><tr><td><b>14-Jan-21 0:00:00</b></td><td class="no-wrap">-></td><td>104.2</td><td>447.35</td><td>508</td></tr><tr><td><b>15-Jan-21 0:00:00</b></td><td class="no-wrap">-></td><td>103.52</td><td>435.85</td><td>493.95</td></tr>

</table>

<p><b>10</b> rows x <b>3</b> columns</p><p><b>0</b> missing values</p>

</div>

### Unpivot (Wide to Long)

#### Polars.NET | Unpivot (wide to long)

`.Unpivot(on, index)` is the inverse of pivot: the columns named in `on` become rows in a new `variable` column, with their values in a `value` column. The `index` columns are preserved as-is per row. Result shape: `n_rows × len(on)` rows.

_Melts the `open`, `high`, `low`, and `close` columns of the first 5 OHLCV rows into a long format — the (20, 4) output contains one row per price type per original row, with `variable` holding the column name and `value` holding the price._

```csharp
// Polars.NET — Melt/Unpivot: turn OHLC columns into rows
var ohlcSubset = dfP
    .Select(Col("symbol"), Col("date"), Col("open"), Col("high"), Col("low"), Col("close"))
    .Head(5);

var meltedP = ohlcSubset.Unpivot(
    on: new[] { "open", "high", "low", "close" },
    index: new[] { "symbol", "date" }
);

display($"Melted shape: {meltedP.Shape}");
meltedP.Head(12)
```

    Melted shape: (20, 4)

<!-- Polars DataFrame: (12 rows, 4 columns) --><table><thead><tr><th>symbol</th><th>date</th><th>variable</th><th>value</th></tr></thead><tbody><tr><td>ABI.BR</td><td>2021-01-04</td><td>open</td><td>58.15</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>open</td><td>56.9</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>open</td><td>57.96</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>open</td><td>58.68</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>open</td><td>58.16</td></tr><tr><td>ABI.BR</td><td>2021-01-04</td><td>high</td><td>58.85</td></tr><tr><td>ABI.BR</td><td>2021-01-05</td><td>high</td><td>57.98</td></tr><tr><td>ABI.BR</td><td>2021-01-06</td><td>high</td><td>58.94</td></tr><tr><td>ABI.BR</td><td>2021-01-07</td><td>high</td><td>58.86</td></tr><tr><td>ABI.BR</td><td>2021-01-08</td><td>high</td><td>58.4</td></tr><tr><td colspan='4'>... 2 more rows ...</td></tr></tbody></table></div>

#### Deedle | Unpivot (manual reshape)

Deedle has no melt/unpivot operation. Implement by iterating each row and emitting one output row per value column, building four parallel lists (symbol, date, variable, value) and assembling them into a new frame.

_Iterates the first 5 rows and emits four output rows per input row (one per OHLC column) by appending to four parallel lists, then assembles them into a (20, 4) frame — matching the Polars.NET Unpivot shape while requiring an explicit loop and `SeriesBuilder` assembly._

```csharp
// Deedle — Manual melt: iterate rows, emit one row per value column
var meltCols = new[] { "open", "high", "low", "close" };
var subsetD = dfD.Columns[new[] { "symbol", "date", "open", "high", "low", "close" }]
    .Rows[dfD.RowKeys.Take(5)];

var meltSymbol = new List<string>();
var meltDate   = new List<string>();
var meltVar    = new List<string>();
var meltVal    = new List<double>();

foreach (var rowKey in subsetD.RowKeys)
{
    var row = subsetD.Rows[rowKey];
    var sym = row.GetAs<string>("symbol");
    var dt  = row.GetAs<string>("date");
    foreach (var col in meltCols)
    {
        meltSymbol.Add(sym);
        meltDate.Add(dt);
        meltVar.Add(col);
        meltVal.Add(row.GetAs<double>(col));
    }
}

var sbSym = new SeriesBuilder<int, string>();
var sbDate = new SeriesBuilder<int, string>();
var sbVar = new SeriesBuilder<int, string>();
var sbVal = new SeriesBuilder<int, double>();
for (int i = 0; i < meltSymbol.Count; i++)
{
    sbSym.Add(i, meltSymbol[i]);
    sbDate.Add(i, meltDate[i]);
    sbVar.Add(i, meltVar[i]);
    sbVal.Add(i, meltVal[i]);
}

var meltedD = new FrameBuilder.Columns<int, string>()
{
    { "symbol",   sbSym.Series },
    { "date",     sbDate.Series },
    { "variable", sbVar.Series },
    { "value",    sbVal.Series }
}.Frame;

display($"Melted shape: {meltedD.RowCount} x {meltedD.ColumnCount}");
meltedD.Rows[meltedD.RowKeys.Take(12)]
```

    Melted shape: 20 x 4

<div>

<table>

<thead><th></th><th></th><th>symbol</th><th>date</th><th>variable</th><th>value</th></thead><thead><th></th><th></th><th>(string)</th><th>(string)</th><th>(string)</th><th>(float)</th></thead>

<tr><td><b>0</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>04-Jan-21 0:00:00</td><td>open</td><td>58.15</td></tr><tr><td><b>1</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>04-Jan-21 0:00:00</td><td>high</td><td>58.85</td></tr><tr><td><b>2</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>04-Jan-21 0:00:00</td><td>low</td><td>56.78</td></tr><tr><td><b>3</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>04-Jan-21 0:00:00</td><td>close</td><td>57.21</td></tr><tr><td><b>4</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>05-Jan-21 0:00:00</td><td>open</td><td>56.9</td></tr><tr><td><b>:</b></td><td class="no-wrap"></td><td>...</td><td>...</td><td>...</td><td>...</td></tr><tr><td><b>7</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>05-Jan-21 0:00:00</td><td>close</td><td>57.18</td></tr><tr><td><b>8</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>06-Jan-21 0:00:00</td><td>open</td><td>57.96</td></tr><tr><td><b>9</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>06-Jan-21 0:00:00</td><td>high</td><td>58.94</td></tr><tr><td><b>10</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>06-Jan-21 0:00:00</td><td>low</td><td>57.39</td></tr><tr><td><b>11</b></td><td class="no-wrap">-></td><td>ABI.BR</td><td>06-Jan-21 0:00:00</td><td>close</td><td>58.77</td></tr>

</table>

<p><b>12</b> rows x <b>4</b> columns</p><p><b>0</b> missing values</p>

</div>

---
## Summary Comparison

| Operation | Polars.NET | Deedle |
|---|---|---|
| **GroupBy + single agg** | `.GroupBy("col").Agg(Col("x").Mean())` | `.GroupRowsBy<T>("col").GetColumn<T>("x").LINQ GroupBy + Average(...)` |
| **GroupBy + multi agg** | `.GroupBy().Agg(sum, mean, count, ...)` in one call | Separate `LINQ GroupBy + Sum`, `LINQ GroupBy + Average`, `LINQ GroupBy + Count` calls |
| **GroupBy multiple cols** | `.GroupBy("a", "b")` | Composite key workaround |
| **Group head** | `.GroupBy("col").Head(n)` | Manual: group keys, `Take(n)` per group |
| **Window: mean over** | `Col("x").Mean().Over("g")` | Manual: compute group stat, map back |
| **Window: rank** | `Col("x").Rank().Over("g")` | Manual: sort within group, assign ordinal |
| **Window: rolling** | `Col("x").RollingMean("20i").Over("g")` | Manual loop with sliding window |
| **Inner join** | `.Join(other, on: "key")` | Dictionary lookup + manual column add |
| **Left join** | `.Join(other, on: "key", how: Left)` | Dictionary lookup, fill missing |
| **Anti join** | `.Join(other, on: "key", how: Anti)` | Manual set-difference filter |
| **Semi join** | `.Join(other, on: "key", how: Semi)` | Manual: HashSet filter (keep matching keys) |
| **Cross join** | `.Join(other, how: Cross)` | Manual: LINQ nested loop (no native support) |
| **Vertical concat** | `Polars.Concat(df1, df2)` | `frame1.Merge(frame2)` |
| **Horizontal concat** | `.HStack(series)` per column | `frame1.Join(frame2, JoinKind.Inner)` |
| **Pivot** | `.Pivot("index", "columns", "values")` | `.PivotTable<R, C, V>(rowCol, colCol, fn)` |
| **Unpivot / Melt** | `.Unpivot(on, index)` | Manual: iterate rows, build long frame |
